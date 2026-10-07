/* DoKit — TypeFight shared module (virtual coins mode).
 *
 * WHAT THIS IS:
 *   Shared helpers for the TypeFight typing-competition section:
 *   profile, wallet (immutable coin ledger), battles, certificates.
 *
 *   ALL COINS ARE VIRTUAL — they have no cash value and cannot be
 *   withdrawn or exchanged. This is stated on every user-facing page.
 *
 * SECURITY MODEL:
 *   - Users must be signed in (Firebase Auth) to use TypeFight pages.
 *   - The coin ledger (users/{uid}/coin_ledger) is APPEND-ONLY: entries
 *     can be created but never updated or deleted (enforced by Firestore
 *     rules — see note at the bottom of this file).
 *   - Each ledger entry links to the previous entry's hash, forming a
 *     tamper-evident chain. If anyone edits history, the chain breaks.
 *   - Certificates are signed with a client-side keyed hash. Honest
 *     limitation: true unforgeable signing needs a server. The verify
 *     page recomputes the signature; a backend would do this with a
 *     secret key instead.
 *
 * DEPENDENCIES: firebase-compat SDK + js/firebase.js (window.DKF).
 * Load order: firebase-app-compat.js, firebase-auth-compat.js,
 *             firebase-firestore-compat.js, js/firebase.js, then this file.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * Crypto helpers
   * ------------------------------------------------------------------ */

  /**
   * SHA-256 hex digest of a UTF-8 string.
   * Uses the Web Crypto API (available in all modern browsers, including
   * the GitHub Pages HTTPS origin). Async because crypto.subtle is async.
   * @param {string} str - Input string.
   * @returns {Promise<string>} Lowercase hex digest (64 chars).
   */
  function sha256(str) {
    var bytes = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      var arr = new Uint8Array(buf);
      var hex = "";
      for (var i = 0; i < arr.length; i++) {
        hex += ("0" + arr[i].toString(16)).slice(-2);
      }
      return hex;
    });
  }

  /**
   * Generate a random ID suitable for certificate / document IDs.
   * Uses crypto.getRandomValues (not Math.random) so IDs are unpredictable.
   * @param {number} len - Desired length in characters (default 12).
   * @returns {string} URL-safe random string.
   */
  function randomId(len) {
    len = len || 12;
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var rnd = new Uint8Array(len);
    crypto.getRandomValues(rnd);
    var out = "";
    for (var i = 0; i < len; i++) out += chars[rnd[i] % chars.length];
    return out;
  }

  /* ------------------------------------------------------------------
   * XSS-safe HTML escaping (all user content rendered via innerHTML
   * MUST go through this).
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------------------
   * Auth gate
   * ------------------------------------------------------------------ */

  /**
   * Ensure a Firebase user is signed in before showing TypeFight content.
   * @param {string} gateId  - ID of the "please sign in" gate element.
   * @param {string} appId   - ID of the main app element (hidden until authed).
   * @param {string} returnUrl - Where login should send the user back to.
   * @returns {Promise<object|null>} Resolves with the Firebase user, or null
   *          if not signed in (gate is shown instead).
   */
  function requireAuth(gateId, appId, returnUrl) {
    return new Promise(function (resolve) {
      var gate = document.getElementById(gateId);
      var app = document.getElementById(appId);
      function showGate() {
        if (gate) gate.style.display = "";
        if (app) app.style.display = "none";
        resolve(null);
      }
      if (!window.DKF || !DKF.auth()) { showGate(); return; }
      DKF.onUser(function (user) {
        if (!user) { showGate(); return; }
        if (gate) gate.style.display = "none";
        if (app) app.style.display = "";
        // Keep a lightweight user doc in sync (best-effort).
        try { DKF.ensureUserDoc(user); } catch (e) {}
        resolve(user);
      });
      // Fix the login link to return here after sign-in.
      try {
        var loginLink = gate && gate.querySelector('a[href*="login.html"]');
        if (loginLink && returnUrl) {
          loginLink.href = "../account/login.html?next=" + encodeURIComponent(returnUrl);
        }
      } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------
   * Firestore refs
   * ------------------------------------------------------------------ */
  function db() { return (window.DKF && DKF.db()) || null; }

  /** users/{uid}/coin_ledger collection ref. */
  function ledgerRef(uid) {
    return db().collection("users").doc(uid).collection("coin_ledger");
  }

  /** users/{uid}/typefight_profile document ref (single doc, id "profile"). */
  function profileRef(uid) {
    return db().collection("users").doc(uid).collection("typefight_profile").doc("profile");
  }

  /* ------------------------------------------------------------------
   * Immutable coin ledger (hash-chained, append-only)
   *
   * Each entry: { amount, reason, clientTs, ts (server), prevHash, hash }
   *   hash = SHA256(prevHash + "|" + uid + "|" + amount + "|" + reason
   *                 + "|" + clientTs)
   * The first entry uses prevHash = "GENESIS".
   *
   * Balance is ALWAYS derived as the sum of the ledger — never stored
   * separately — so it cannot drift out of sync with history.
   * ------------------------------------------------------------------ */

  /**
   * Append a coin transaction to the user's immutable ledger.
   * Positive amount = earn, negative = spend. Resolves with the new entry.
   * @param {string} uid
   * @param {number} amount - Integer, non-zero.
   * @param {string} reason - Human-readable reason (e.g. "battle_win_1st").
   * @returns {Promise<object>} The written entry (without server ts).
   */
  function ledgerAppend(uid, amount, reason) {
    amount = Math.trunc(amount);
    reason = String(reason || "misc").slice(0, 120);
    if (!amount) return Promise.reject(new Error("amount must be non-zero"));
    var col = ledgerRef(uid);
    // Read the latest entry to chain the hash. Order by clientTs desc, limit 1.
    return col.orderBy("clientTs", "desc").limit(1).get().then(function (snap) {
      var prevHash = "GENESIS";
      snap.forEach(function (d) { prevHash = d.data().hash || "GENESIS"; });
      var clientTs = Date.now();
      var payload = prevHash + "|" + uid + "|" + amount + "|" + reason + "|" + clientTs;
      return sha256(payload).then(function (hash) {
        var entry = {
          amount: amount,
          reason: reason,
          clientTs: clientTs,
          ts: firebase.firestore.FieldValue.serverTimestamp(),
          prevHash: prevHash,
          hash: hash
        };
        return col.add(entry).then(function () { return entry; });
      });
    });
  }

  /**
   * Compute the user's coin balance = sum of all ledger entries.
   * @param {string} uid
   * @returns {Promise<number>} Balance (can be 0 for new users).
   */
  function ledgerBalance(uid) {
    return ledgerRef(uid).get().then(function (snap) {
      var total = 0;
      snap.forEach(function (d) { total += (d.data().amount | 0); });
      return total;
    });
  }

  /**
   * Get recent ledger entries, newest first.
   * @param {string} uid
   * @param {number} limit - Max entries (default 50).
   * @returns {Promise<Array>} Entry objects with .id.
   */
  function ledgerHistory(uid, limit) {
    limit = limit || 50;
    return ledgerRef(uid).orderBy("clientTs", "desc").limit(limit).get()
      .then(function (snap) {
        var out = [];
        snap.forEach(function (d) {
          var data = d.data();
          data.id = d.id;
          out.push(data);
        });
        return out;
      });
  }

  /**
   * Verify the hash chain integrity of a user's ledger.
   * Recomputes every hash and checks linkage. Used by the wallet page
   * to display a "chain verified" badge.
   * @param {string} uid
   * @returns {Promise<{ok:boolean, checked:number, brokenAt:number}>}
   */
  function ledgerVerify(uid) {
    return ledgerRef(uid).orderBy("clientTs", "asc").get().then(function (snap) {
      var entries = [];
      snap.forEach(function (d) { entries.push(d.data()); });
      var prevHash = "GENESIS";
      var chain = [];
      entries.forEach(function (e) { chain.push(e); });
      // Sequential async verification.
      var i = 0, brokenAt = -1;
      function step() {
        if (i >= chain.length) {
          return Promise.resolve({ ok: brokenAt === -1, checked: chain.length, brokenAt: brokenAt });
        }
        var e = chain[i];
        if (e.prevHash !== prevHash) { brokenAt = i; return Promise.resolve({ ok: false, checked: chain.length, brokenAt: brokenAt }); }
        var payload = e.prevHash + "|" + uid + "|" + e.amount + "|" + e.reason + "|" + e.clientTs;
        return sha256(payload).then(function (h) {
          if (h !== e.hash) { brokenAt = i; }
          else { prevHash = e.hash; }
          i++;
          return step();
        });
      }
      return step();
    });
  }

  /* ------------------------------------------------------------------
   * TypeFight profile
   * ------------------------------------------------------------------ */

  /**
   * Load the user's TypeFight profile (or null if not created yet).
   * @param {string} uid
   * @returns {Promise<object|null>}
   */
  function getProfile(uid) {
    return profileRef(uid).get().then(function (snap) {
      return snap.exists ? snap.data() : null;
    }).catch(function () { return null; });
  }

  /**
   * Save (create or overwrite) the TypeFight profile.
   * @param {string} uid
   * @param {object} data - { username, avatar, bio, country, ... }
   * @returns {Promise<void>}
   */
  function saveProfile(uid, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return profileRef(uid).set(data, { merge: true });
  }

  /* ------------------------------------------------------------------
   * Certificates (signed, publicly verifiable, HEC/IBCC-style)
   *
   * Each certificate carries:
   *   - id: random 12-char document ID (used in QR code / verify URL)
   *   - serial: human-readable registration number "DK-2026-000001",
   *     auto-incremented via a Firestore transaction on
   *     config/cert_counter (atomic — no duplicates even under race)
   *   - holder name, WPM, accuracy, issue date, kind, QR code, signature
   *
   * Signature = SHA256(id | serial | userId | username | wpm | accuracy |
   *                     date | kind | SIGN_SALT)
   * SIGN_SALT is a client-side constant. HONEST LIMITATIONS:
   *   (a) anyone who reads this source can forge signatures;
   *   (b) the counter is writable by any signed-in user, so serial gaps
   *       are possible (never duplicates — the transaction is atomic).
   * Production MUST move signing + serial issuance to a server
   * (Cloud Function) holding a real secret. The verify page recomputes
   * the signature the same way.
   * ------------------------------------------------------------------ */
  var SIGN_SALT = "dokit-typefight-v1";

  /**
   * Atomically reserve the next certificate serial number.
   * Format: DK-<year>-<6-digit zero-padded sequence>, e.g. DK-2026-000001.
   * Uses a Firestore transaction so concurrent issuances never collide.
   * @returns {Promise<string>} The reserved serial, e.g. "DK-2026-000042".
   */
  function nextSerial() {
    var ref = db().collection("config").doc("cert_counter");
    return db().runTransaction(function (t) {
      return t.get(ref).then(function (snap) {
        var seq = (snap.exists && snap.data().seq) || 0;
        seq += 1;
        t.set(ref, { seq: seq, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return seq;
      });
    }).then(function (seq) {
      var year = new Date().getFullYear();
      return "DK-" + year + "-" + String(seq).padStart(6, "0");
    });
  }

  /**
   * Create a signed certificate document in Firestore.
   * Requires the user to have a TypeFight profile (checked by caller).
   * @param {object} opts - { uid, username, wpm, accuracy, kind }
   *   kind: "battle_win" | "wpm_milestone"
   * @returns {Promise<{id:string, serial:string, signature:string}>}
   */
  function createCertificate(opts) {
    var id = randomId(12);
    var date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    var wpm = Math.round(opts.wpm);
    var accuracy = Math.round(opts.accuracy * 10) / 10;
    // Reserve the serial first (atomic transaction), then sign + write.
    return nextSerial().then(function (serial) {
      var payload = [id, serial, opts.uid, opts.username, wpm, accuracy, date, opts.kind, SIGN_SALT].join("|");
      return sha256(payload).then(function (sig) {
        var doc = {
          userId: opts.uid,
          username: opts.username,
          wpm: wpm,
          accuracy: accuracy,
          date: date,
          kind: opts.kind,
          serial: serial,
          signature: sig,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db().collection("certificates").doc(id).set(doc).then(function () {
          return { id: id, serial: serial, signature: sig };
        });
      });
    });
  }

  /**
   * Verify a certificate by document ID: fetch it and recompute the signature.
   * @param {string} certId
   * @returns {Promise<{valid:boolean, cert:object|null, reason:string}>}
   */
  function verifyCertificate(certId) {
    return db().collection("certificates").doc(certId).get().then(function (snap) {
      if (!snap.exists) return { valid: false, cert: null, reason: "not_found" };
      return checkSignature(certId, snap.data());
    }).catch(function () {
      return { valid: false, cert: null, reason: "error" };
    });
  }

  /**
   * Verify a certificate by its serial/registration number
   * (e.g. DK-2026-000001) — the HEC/IBCC-style manual lookup.
   * @param {string} serial
   * @returns {Promise<{valid:boolean, cert:object|null, id:string|null, reason:string}>}
   */
  function verifyCertificateBySerial(serial) {
    serial = String(serial || "").trim().toUpperCase();
    return db().collection("certificates").where("serial", "==", serial).limit(1).get()
      .then(function (snap) {
        if (snap.empty) return { valid: false, cert: null, id: null, reason: "not_found" };
        var found = null;
        snap.forEach(function (d) { found = { id: d.id, data: d.data() }; });
        return checkSignature(found.id, found.data).then(function (r) {
          r.id = found.id;
          return r;
        });
      })
      .catch(function () {
        return { valid: false, cert: null, id: null, reason: "error" };
      });
  }

  /**
   * Recompute the signature for a fetched certificate document and compare.
   * @param {string} certId
   * @param {object} c - Certificate document data.
   * @returns {Promise<{valid:boolean, cert:object, reason:string}>}
   */
  function checkSignature(certId, c) {
    var payload = [certId, c.serial || "", c.userId, c.username, c.wpm, c.accuracy, c.date, c.kind, SIGN_SALT].join("|");
    return sha256(payload).then(function (sig) {
      if (sig === c.signature) return { valid: true, cert: c, reason: "ok" };
      return { valid: false, cert: c, reason: "bad_signature" };
    });
  }

  /** Public verify URL for a certificate ID. */
  function verifyUrl(certId) {
    return "https://aleemurrehman803.github.io/DoKit/typefight/verify/?id=" + encodeURIComponent(certId);
  }

  /* ------------------------------------------------------------------
   * Relative time formatter ("2h ago")
   * ------------------------------------------------------------------ */
  function relTime(ts) {
    var t = Number(ts) || 0;
    if (!t) return "—";
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 10) return "just now";
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24);
    if (d < 30) return d + "d ago";
    return new Date(t).toLocaleDateString();
  }

  /* Public API */
  window.TF = {
    sha256: sha256,
    randomId: randomId,
    esc: esc,
    relTime: relTime,
    requireAuth: requireAuth,
    ledgerAppend: ledgerAppend,
    ledgerBalance: ledgerBalance,
    ledgerHistory: ledgerHistory,
    ledgerVerify: ledgerVerify,
    getProfile: getProfile,
    saveProfile: saveProfile,
    createCertificate: createCertificate,
    verifyCertificate: verifyCertificate,
    verifyCertificateBySerial: verifyCertificateBySerial,
    verifyUrl: verifyUrl,
    SIGN_SALT: SIGN_SALT
  };
})();

/* ----------------------------------------------------------------------
 * REQUIRED FIRESTORE RULES (to be added in Firebase console):
 *
 * function isAdmin() {
 *   return request.auth != null &&
 *     exists(/databases/$(database)/documents/admins/$(request.auth.uid));
 * }
 *
 * match /users/{userId}/coin_ledger/{entryId} {
 *   // Owner (or admin) can read; owner can only CREATE (append).
 *   // Updates and deletes are forbidden -> immutable.
 *   allow read: if isAdmin() || (request.auth != null && request.auth.uid == userId);
 *   allow create: if request.auth != null && request.auth.uid == userId;
 *   allow update, delete: if false;
 * }
 *
 * match /users/{userId}/typefight_profile/{doc} {
 *   allow read, write: if isAdmin() || (request.auth != null && request.auth.uid == userId);
 * }
 *
 * match /certificates/{certId} {
 *   allow read: if true;   // public verification
 *   allow create: if request.auth != null
 *                 && request.resource.data.userId == request.auth.uid;
 *   allow update, delete: if false;
 * }
 *
 * match /config/cert_counter {
 *   // Any signed-in user may advance the counter (atomic transaction
 *   // prevents duplicates; gaps are possible). Production should move
 *   // serial issuance to a Cloud Function.
 *   allow read: if true;
 *   allow write: if request.auth != null;
 * }
 * ---------------------------------------------------------------------- */
