'use strict';
/* DoKit — Email OTP password reset: pure logic (functions/otp.js)
 *
 * WHAT: every rule the reset flow enforces — code generation, hashing,
 * expiry, rate limits, attempt lockout, input validation. Zero
 * dependencies (only node:crypto), so the whole module is unit-tested
 * with plain `node --test` (test/otp.test.js) — no Firebase, no network.
 * The Cloud Function handlers (index.js) are thin wrappers around these.
 *
 * SECURITY (all server-enforced; the client can never bypass them):
 * - The 6-digit code is NEVER stored or logged in plaintext — only its
 *   SHA-256 hash lives in Firestore (collection `passwordResets`).
 * - Code lifetime is 10 minutes; a code is single-use (marked used and
 *   its hash cleared in the same transaction that verifies it).
 * - Max 5 wrong attempts per code, then the code is locked (used=true).
 * - Requests are rate-limited per email: 1 per minute, 5 per hour.
 *   The request log is written for EVERY email — existing account or
 *   not — so the 429 behaviour is identical and cannot be used to
 *   probe whether an account exists.
 * - Responses never reveal whether the email belongs to an account:
 *   requestOtp always answers {ok:true} for a well-formed email.
 *
 * FREE-ONLY: nothing here calls a paid service. The only external call
 * in the whole feature is the Resend free plan (index.js). */
var crypto = require('node:crypto');

/* --- limits (single source of truth; index.js + tests read these) --- */
var OTP_LENGTH = 6;                          // 6-digit code, like Google's
var OTP_TTL_MS = 10 * 60 * 1000;             // 10-minute expiry
var OTP_MAX_ATTEMPTS = 5;                    // wrong codes per issued code
var OTP_REQUEST_MIN_GAP_MS = 60 * 1000;      // 1 request per minute
var OTP_REQUESTS_PER_HOUR = 5;               // 5 requests per hour
var OTP_MIN_PASSWORD_LEN = 6;                // matches the site's rule

/* Normalize once, everywhere: lookup, doc id and rate-limit key must all
 * agree, or "User@X.com" and "user@x.com" would get separate budgets. */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= OTP_MIN_PASSWORD_LEN;
}

/* 6-digit code, zero-padded ("000042" is a valid code, not "42").
 * crypto.randomInt is the CSPRNG; the injectable `randomInt` parameter
 * exists ONLY so tests can force exact values (e.g. 42 -> "000042"). */
function generateCode(randomInt) {
  var n = (randomInt || crypto.randomInt)(0, 1000000);
  return String(n).padStart(OTP_LENGTH, '0');
}

/* SHA-256 hex of the code. Fixed 64-char length, so the timing-safe
 * compare below never leaks length — and a leaked hash cannot be
 * reversed into the code (preimage resistance). */
function hashCode(code) {
  return crypto.createHash('sha256').update(String(code), 'utf8').digest('hex');
}

/* Constant-time comparison of two hex hashes. Returns false (never
 * throws) on length mismatch, so a missing/empty stored hash is simply
 * "no match" instead of a crash or a timing leak. */
function timingSafeEqualHex(a, b) {
  var ba = Buffer.from(String(a || ''), 'utf8');
  var bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) { return false; }
  return crypto.timingSafeEqual(ba, bb);
}

/* Firestore doc id for an email: SHA-256 of the normalized address.
 * The address itself never appears in a doc id (no PII in ids), and
 * the id is deterministic — request and verify always find the same doc. */
function resetDocId(email) {
  return crypto.createHash('sha256').update(normalizeEmail(email), 'utf8').digest('hex');
}

function isExpired(expiresAtMs, nowMs) {
  var now = (typeof nowMs === 'number') ? nowMs : Date.now();
  return now >= expiresAtMs;
}

/* Keep only the last hour of request timestamps (the window the hourly
 * cap counts). Old entries are dropped so the log never grows. */
function pruneRequestLog(requestLog, nowMs) {
  var now = (typeof nowMs === 'number') ? nowMs : Date.now();
  var log = Array.isArray(requestLog) ? requestLog : [];
  return log.filter(function (t) {
    return typeof t === 'number' && (now - t) < 60 * 60 * 1000;
  });
}

/* Rate-limit gate for requestOtp. `requestLog` is the stored array of
 * past request timestamps (ms). Returns {allowed, reason} where reason
 * is '' | 'too-soon' | 'too-many'. The caller maps it to HTTP 429. */
function checkRequestRateLimit(requestLog, nowMs) {
  var now = (typeof nowMs === 'number') ? nowMs : Date.now();
  var log = Array.isArray(requestLog)
    ? requestLog.filter(function (t) { return typeof t === 'number'; })
    : [];
  if (log.length) {
    var last = log[log.length - 1];
    if (now - last < OTP_REQUEST_MIN_GAP_MS) {
      return { allowed: false, reason: 'too-soon' };
    }
  }
  var inHour = pruneRequestLog(log, now).length;
  if (inHour >= OTP_REQUESTS_PER_HOUR) {
    return { allowed: false, reason: 'too-many' };
  }
  return { allowed: true, reason: '' };
}

/* Verify gate for verifyOtpAndReset. `doc` is the stored passwordResets
 * doc (or null). Every failure returns reason 'invalid' — one message
 * for missing/used/expired codes, so the caller cannot be probed for
 * which state the code is in. 'locked' is only returned once the
 * attempt budget is exhausted (the client then shows "request a new
 * code"). */
function checkVerifyAllowed(doc, nowMs) {
  if (!doc || doc.used) { return { allowed: false, reason: 'invalid' }; }
  if (isExpired(doc.expiresAtMs, nowMs)) { return { allowed: false, reason: 'invalid' }; }
  if ((doc.attempts || 0) >= OTP_MAX_ATTEMPTS) { return { allowed: false, reason: 'locked' }; }
  return { allowed: true, reason: '' };
}

/* Fresh reset doc for a new code (written by requestOtp). `requestLog`
 * is the pruned history + this request (the caller computes it, so the
 * hourly cap keeps working across requests); it defaults to [now]. */
function buildResetDoc(opts) {
  var now = (typeof opts.nowMs === 'number') ? opts.nowMs : Date.now();
  return {
    email: normalizeEmail(opts.email),
    uid: opts.uid || null,
    codeHash: opts.codeHash,
    expiresAtMs: now + OTP_TTL_MS,
    attempts: 0,
    used: false,
    createdAtMs: now,
    requestLog: opts.requestLog || [now]
  };
}

module.exports = {
  OTP_LENGTH: OTP_LENGTH,
  OTP_TTL_MS: OTP_TTL_MS,
  OTP_MAX_ATTEMPTS: OTP_MAX_ATTEMPTS,
  OTP_REQUEST_MIN_GAP_MS: OTP_REQUEST_MIN_GAP_MS,
  OTP_REQUESTS_PER_HOUR: OTP_REQUESTS_PER_HOUR,
  OTP_MIN_PASSWORD_LEN: OTP_MIN_PASSWORD_LEN,
  normalizeEmail: normalizeEmail,
  isValidEmail: isValidEmail,
  isValidPassword: isValidPassword,
  generateCode: generateCode,
  hashCode: hashCode,
  timingSafeEqualHex: timingSafeEqualHex,
  resetDocId: resetDocId,
  isExpired: isExpired,
  pruneRequestLog: pruneRequestLog,
  checkRequestRateLimit: checkRequestRateLimit,
  checkVerifyAllowed: checkVerifyAllowed,
  buildResetDoc: buildResetDoc
};
