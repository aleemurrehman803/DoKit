'use strict';
/* DoKit — Email OTP password reset (Cloud Functions, 1st gen).
 *
 * WHAT: two HTTPS endpoints that replace the link-only reset with a
 * Google-style flow — 6-digit code by email, enter it, set a new
 * password, log in right there. The existing link flow is untouched
 * and stays as the fallback (the login page offers it in the panel).
 *
 *   POST /requestOtp          {email}            -> {ok:true} (always,
 *     for a well-formed email — never reveals account existence)
 *   POST /verifyOtpAndReset   {email, code, newPassword} -> {ok:true}
 *     or {ok:false, error:'invalid-code'|'too-many-attempts'|
 *     'invalid-input'|'too-many-requests'|'send-failed'|
 *     'not-configured'|'unknown'}
 *
 * FREE-ONLY: the only external call is Resend's free plan
 * (3,000 emails/month, no expiry). No paid service is called anywhere.
 * The functions run on Firebase Blaze's free tier (2M invocations/mo
 * free); Blaze needs a billing account on file but the usage here
 * stays inside the free quota — see README.md for the owner steps.
 *
 * SECURITY: all rules live in otp.js (hashed codes only, 10-min
 * expiry, single-use, max 5 attempts, per-email rate limits, no
 * account-existence leakage). The handlers below are thin wrappers:
 * they do I/O only — no rule is decided here, so a rule cannot be
 * accidentally skipped in one path. Firestore rules already deny
 * clients all access to `passwordResets` (default deny at the end of
 * firestore.rules covers it — no rule change was needed); only the
 * Admin SDK (this file) reads/writes it.
 *
 * SECRETS: the Resend key is NEVER in this repo. It comes from Secret
 * Manager as RESEND_API_KEY (declared in runWith({secrets:[...]}) and
 * read from process.env). RESEND_FROM is an optional plain env var;
 * the default is Resend's onboarding sender, which can only mail the
 * account owner's own address — for production the owner must set
 * RESEND_FROM to a verified-domain sender (see README.md).
 *
 * DEPLOY (owner steps — NOT done here, see README.md):
 *   firebase functions:secrets:set RESEND_API_KEY
 *   firebase deploy --only functions
 */
var functions = require('firebase-functions');
var admin = require('firebase-admin');
var otp = require('./otp');

admin.initializeApp();
var db = admin.firestore();
var COLLECTION = 'passwordResets';

/* CORS: the live GitHub Pages site + local dev origins only. Any other
 * origin gets no Access-Control-Allow-Origin header, so a browser on a
 * random site cannot call these endpoints (curl still can — CORS is a
 * browser guard, not auth; the rate limits are the real guard). */
var ALLOWED_ORIGINS = ['https://aleemurrehman803.github.io'];
function isAllowedOrigin(origin) {
  if (!origin) { return false; }
  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) { return true; }
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/* Sets CORS headers; answers OPTIONS preflights. Returns true when the
 * request was a preflight and is fully handled (caller returns). */
function withCors(req, res) {
  var origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) { res.set('Access-Control-Allow-Origin', origin); }
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return true;
  }
  return false;
}

function readJsonBody(req) {
  return (req.body && typeof req.body === 'object') ? req.body : {};
}

function sendJson(res, status, obj) {
  res.status(status).json(obj);
}

/* Send the code via Resend (free plan). Throws with .code =
 * 'not-configured' (no API key) or 'send-failed' (Resend HTTP error).
 * The email is bilingual (EN + UR) and contains only the code — no link. */
function sendOtpEmail(to, code) {
  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    var cfgErr = new Error('RESEND_API_KEY is not configured');
    cfgErr.code = 'not-configured';
    throw cfgErr;
  }
  var from = process.env.RESEND_FROM || 'DoKit <onboarding@resend.dev>';
  var subject = 'Your DoKit password reset code: ' + code;
  var text = 'Your DoKit password reset code is: ' + code + '\n\n'
    + 'It expires in 10 minutes. If you did not request this, ignore this email.\n\n'
    + 'Aap ka DoKit password reset code hai: ' + code + '\n\n'
    + 'Yeh 10 minute mein khatam ho jaye ga. Agar aap ne request nahi ki thi to is email ko ignore kar dein.';
  var html = '<p>Your DoKit password reset code is:</p>'
    + '<p style="font-size:28px;font-weight:700;letter-spacing:6px;">' + code + '</p>'
    + '<p>It expires in 10 minutes. If you did not request this, ignore this email.</p>'
    + '<hr><p>Aap ka DoKit password reset code hai:</p>'
    + '<p style="font-size:28px;font-weight:700;letter-spacing:6px;">' + code + '</p>'
    + '<p>Yeh 10 minute mein khatam ho jaye ga. Agar aap ne request nahi ki thi to is email ko ignore kar dein.</p>';
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: from, to: to, subject: subject, html: html, text: text })
  }).then(function (res) {
    if (!res.ok) {
      var err = new Error('Resend send failed: HTTP ' + res.status);
      err.code = 'send-failed';
      throw err;
    }
  });
}

/* POST /requestOtp — {email} -> {ok:true}
 * 1. Validate the email shape (400 on garbage — no info leaked).
 * 2. Look up the account (Auth cannot run inside a Firestore
 *    transaction, so this happens first). The answer is NEVER returned:
 *    a missing account gets the same {ok:true} as an existing one.
 * 3. In ONE transaction: check the per-email rate limit, append this
 *    request to the log, and — only if the account exists — store the
 *    new code hash + fresh expiry/attempt budget. The log is written
 *    for EVERY email, so 429 behaviour is identical for existing and
 *    missing accounts (no existence oracle).
 * 4. If the account exists, send the code by email. If the send fails,
 *    clear the stored code so a code nobody received can never be used.
 *    A send failure is reported honestly (502) — the client then offers
 *    the link fallback instead of pretending the code is on its way. */
exports.requestOtp = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB', secrets: ['RESEND_API_KEY'] })
  .https.onRequest(function (req, res) {
    if (withCors(req, res)) { return; }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method-not-allowed' });
      return;
    }
    var email = otp.normalizeEmail(readJsonBody(req).email);
    if (!otp.isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: 'invalid-input' });
      return;
    }
    var now = Date.now();
    var docRef = db.collection(COLLECTION).doc(otp.resetDocId(email));
    var code = otp.generateCode();
    var codeHash = otp.hashCode(code);
    var uid = null;
    admin.auth().getUserByEmail(email).then(function (user) {
      uid = user.uid;
    }).catch(function (e) {
      if (e.code !== 'auth/user-not-found') { throw e; }
      uid = null; /* no account — same generic response, no email sent */
    }).then(function () {
      return db.runTransaction(function (tx) {
        return tx.get(docRef).then(function (snap) {
          var prev = snap.exists ? snap.data() : null;
          var check = otp.checkRequestRateLimit(prev ? prev.requestLog : [], now);
          if (!check.allowed) { return true; /* rate-limited */ }
          var log = otp.pruneRequestLog(prev ? prev.requestLog : [], now);
          log.push(now);
          if (uid) {
            /* One write: fresh code hash + expiry + attempt budget, with
             * the pruned request history + this request as the log. */
            tx.set(docRef, otp.buildResetDoc({
              email: email, uid: uid, codeHash: codeHash, nowMs: now, requestLog: log
            }), { merge: true });
          } else {
            /* No account: log the request only — and void any stale
             * code left from when the account existed (deleted user),
             * so it can never verify against a dead account. */
            tx.set(docRef, { email: email, uid: null, codeHash: null, used: true, requestLog: log }, { merge: true });
          }
          return false;
        });
      });
    }).then(function (rateLimited) {
      if (rateLimited) {
        sendJson(res, 429, { ok: false, error: 'too-many-requests' });
        return;
      }
      if (!uid) {
        /* Generic success — the caller cannot tell the account is missing. */
        sendJson(res, 200, { ok: true });
        return;
      }
      return sendOtpEmail(email, code).then(function () {
        sendJson(res, 200, { ok: true });
      }).catch(function (e) {
        if (e.code === 'not-configured') {
          sendJson(res, 503, { ok: false, error: 'not-configured' });
          return;
        }
        /* Send failed: void the stored code (nobody received it) so it
         * can never be guessed-and-used later. Best-effort — a failure
         * here must not mask the real send error. */
        return docRef.update({ codeHash: null, used: true }).catch(function () {}).then(function () {
          sendJson(res, 502, { ok: false, error: 'send-failed' });
        });
      });
    }).catch(function (e) {
      functions.logger.error('requestOtp failed', e);
      sendJson(res, 500, { ok: false, error: 'unknown' });
    });
  });

/* POST /verifyOtpAndReset — {email, code, newPassword} -> {ok:true}
 * One Firestore transaction does check + consume atomically: a matching
 * code is marked used and its hash cleared IN THE SAME transaction, so
 * a replayed request can never pass twice. A wrong code counts an
 * attempt; the 5th wrong attempt locks the code (used=true). Every
 * failure answers 'invalid-code' (400) — except a locked code, which
 * answers 'too-many-attempts' (429) so the client can say "request a
 * new code". Only after the transaction commits does the password
 * change (Auth cannot run inside a transaction): updateUser, then
 * revokeRefreshTokens so a reset signs out other sessions. */
exports.verifyOtpAndReset = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onRequest(function (req, res) {
    if (withCors(req, res)) { return; }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method-not-allowed' });
      return;
    }
    var body = readJsonBody(req);
    var email = otp.normalizeEmail(body.email);
    var code = String(body.code || '').trim();
    var newPassword = String(body.newPassword || '');
    if (!otp.isValidEmail(email) || !/^\d{6}$/.test(code) ||
        !otp.isValidPassword(newPassword)) {
      sendJson(res, 400, { ok: false, error: 'invalid-input' });
      return;
    }
    var now = Date.now();
    var docRef = db.collection(COLLECTION).doc(otp.resetDocId(email));
    db.runTransaction(function (tx) {
      return tx.get(docRef).then(function (snap) {
        var doc = snap.exists ? snap.data() : null;
        var allowed = otp.checkVerifyAllowed(doc, now);
        if (!allowed.allowed) {
          return { ok: false, error: 'invalid-code' };
        }
        var attempts = (doc.attempts || 0) + 1;
        if (!otp.timingSafeEqualHex(otp.hashCode(code), doc.codeHash || '')) {
          tx.update(docRef, {
            attempts: attempts,
            used: attempts >= otp.OTP_MAX_ATTEMPTS
          });
          return {
            ok: false,
            error: attempts >= otp.OTP_MAX_ATTEMPTS ? 'too-many-attempts' : 'invalid-code'
          };
        }
        tx.update(docRef, { attempts: attempts, used: true, codeHash: null });
        return { ok: true, uid: doc.uid };
      });
    }).then(function (outcome) {
      if (!outcome.ok) {
        var status = outcome.error === 'too-many-attempts' ? 429 : 400;
        sendJson(res, status, { ok: false, error: outcome.error });
        return;
      }
      return admin.auth().updateUser(outcome.uid, { password: newPassword }).then(function () {
        /* A reset must not leave a stolen session alive: revoke other
         * sessions' refresh tokens. Best-effort — it never fails the
         * reset itself (the new password is already set). */
        return admin.auth().revokeRefreshTokens(outcome.uid).catch(function () {});
      }).then(function () {
        sendJson(res, 200, { ok: true });
      });
    }).catch(function (e) {
      functions.logger.error('verifyOtpAndReset failed', e);
      sendJson(res, 500, { ok: false, error: 'unknown' });
    });
  });
