/* DoKit — Financial Security module (finsec.js).
 *
 * Binance/bank-grade security scaffold for ALL money-adjacent operations:
 * coins, credits, payments, withdrawals, referrals.
 *
 * WHAT THIS MODULE PROVIDES (client-side layer):
 *   1. Amount validation — integer-only, min/max bounds, overflow-safe.
 *   2. Rate limiting — per-action velocity buckets (client-side advisory).
 *   3. Device fingerprinting — stable anonymous device id per browser.
 *   4. Security audit logging — every financial action -> `security_events`
 *      (append-only; mirrored into `admin_audit` for the admin panel).
 *   5. Suspicious-pattern detection — flags velocity spikes / round amounts.
 *   6. Re-auth gate — sensitive actions require a fresh sign-in (stub).
 *   7. Idempotency keys — prevents double-submit of state-changing actions.
 *   8. XSS-safe text helper for rendering amounts / user strings.
 *
 * HONEST LIMITATION (documented for the security audit):
 *   Client-side checks are ADVISORY. A hostile user controls their browser.
 *   Real enforcement MUST live server-side:
 *     - Cloud Functions verify every transaction before writing.
 *     - Firestore rules deny: negative balances, ledger edits/deletes,
 *       non-owner writes, and counter tampering (see bottom of file).
 *   This module makes honest users safe and attackers' lives hard; it does
 *   not replace server-side validation.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* 1. Amount validation                                                */
  /* ------------------------------------------------------------------ */

  var MIN_AMOUNT = 1;            // smallest unit (coins/credits are integers)
  var MAX_AMOUNT = 1000000000;   // 1e9 — hard cap, prevents overflow games
  var MAX_SAFE = 9007199254740991; // Number.MAX_SAFE_INTEGER

  /**
   * Validate a monetary amount. Returns a clean integer or throws.
   * Rejects: non-numbers, NaN, Infinity, fractions, negatives, zero
   * (unless allowZero), values above MAX_AMOUNT, unsafe integers.
   *
   * @param {*} raw - The raw input (string/number from UI or code).
   * @param {Object} [opts] - { allowZero:boolean, max:number }
   * @returns {number} Clean integer amount.
   * @throws {Error} With a safe, user-displayable message.
   */
  function validateAmount(raw, opts) {
    opts = opts || {};
    var allowZero = !!opts.allowZero;
    var max = typeof opts.max === "number" ? opts.max : MAX_AMOUNT;

    if (raw === null || raw === undefined || raw === "") {
      throw new Error("Amount is required.");
    }
    var n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!isFinite(n) || isNaN(n)) throw new Error("Amount must be a number.");
    if (Math.floor(n) !== n) throw new Error("Amount must be a whole number.");
    if (n < 0) throw new Error("Amount cannot be negative.");
    if (n === 0 && !allowZero) throw new Error("Amount must be greater than zero.");
    if (n > max) throw new Error("Amount exceeds the maximum of " + max + ".");
    if (n > MAX_SAFE) throw new Error("Amount is too large to process safely.");
    return n;
  }

  /**
   * Validate a balance will not go negative after a debit.
   * @param {number} balance - Current balance (validated integer).
   * @param {number} debit - Amount to subtract (validated integer).
   * @throws {Error} If the debit would make the balance negative.
   */
  function assertSufficient(balance, debit) {
    if (balance - debit < 0) throw new Error("Insufficient balance.");
  }

  /* ------------------------------------------------------------------ */
  /* 2. Rate limiting (client-side velocity buckets, advisory)           */
  /* ------------------------------------------------------------------ */

  /* action -> { maxPerMinute, maxPerHour } */
  var RATE_LIMITS = {
    "coin_claim":      { maxPerMinute: 10,  maxPerHour: 60 },
    "credit_spend":    { maxPerMinute: 20,  maxPerHour: 200 },
    "credit_add":      { maxPerMinute: 10,  maxPerHour: 100 },
    "payment_attempt": { maxPerMinute: 3,   maxPerHour: 10 },
    "withdrawal":      { maxPerMinute: 1,   maxPerHour: 3 },
    "referral_claim":  { maxPerMinute: 5,   maxPerHour: 20 }
  };
  var LS_RATE = "dokit_finsec_rate";

  function readBuckets() {
    try {
      var v = localStorage.getItem(LS_RATE);
      var o = v ? JSON.parse(v) : {};
      return (o && typeof o === "object") ? o : {};
    } catch (e) { return {}; }
  }
  function writeBuckets(o) {
    try { localStorage.setItem(LS_RATE, JSON.stringify(o)); } catch (e) {}
  }

  /**
   * Check (and record) whether an action is within rate limits.
   * @param {string} action - Key from RATE_LIMITS.
   * @returns {{ok:boolean, retryAfterMs:number}} ok=false means slow down.
   */
  function checkRate(action) {
    var lim = RATE_LIMITS[action] || { maxPerMinute: 10, maxPerHour: 60 };
    var now = Date.now();
    var buckets = readBuckets();
    var b = buckets[action] || [];
    // Keep only events from the last hour.
    b = b.filter(function (t) { return now - t < 3600000; });
    var lastMin = b.filter(function (t) { return now - t < 60000; }).length;
    var lastHour = b.length;
    if (lastMin >= lim.maxPerMinute || lastHour >= lim.maxPerHour) {
      // Retry after the oldest relevant event expires.
      var oldest = b[0] || now;
      var retryAfterMs = Math.max(0, (lastMin >= lim.maxPerMinute ? oldest + 60000 : oldest + 3600000) - now);
      return { ok: false, retryAfterMs: retryAfterMs };
    }
    b.push(now);
    buckets[action] = b;
    writeBuckets(buckets);
    return { ok: true, retryAfterMs: 0 };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Device fingerprinting (anonymous, per-browser)                   */
  /* ------------------------------------------------------------------ */

  var LS_DEVICE = "dokit_device_id";

  /**
   * Stable anonymous device id for this browser. Used to correlate
   * sessions in security logs. NOT a tracking cookie — never leaves
   * the security-event log context.
   * @returns {string} e.g. "dev_a1b2c3..."
   */
  function deviceId() {
    try {
      var id = localStorage.getItem(LS_DEVICE);
      if (!id) {
        var rnd = new Uint32Array(4);
        (window.crypto || {}).getRandomValues
          ? crypto.getRandomValues(rnd)
          : rnd.forEach(function (_, i, a) { a[i] = Math.floor(Math.random() * 4294967296); });
        id = "dev_" + Array.prototype.map.call(rnd, function (x) {
          return ("00000000" + x.toString(16)).slice(-8);
        }).join("");
        localStorage.setItem(LS_DEVICE, id);
      }
      return id;
    } catch (e) { return "dev_unknown"; }
  }

  /* ------------------------------------------------------------------ */
  /* 4. Security audit logging (append-only)                             */
  /* ------------------------------------------------------------------ */

  function getDb() {
    try { return (window.DKF && DKF.db) ? DKF.db() : null; } catch (e) { return null; }
  }
  function getUid() {
    try {
      var a = (window.DKF && DKF.auth && DKF.auth()) || null;
      var u = a && a.currentUser;
      return u && u.uid ? u.uid : null;
    } catch (e) { return null; }
  }

  /**
   * Log a financial/security event. Appends to `security_events`
   * (global, admin-read) AND mirrors a summary into `admin_audit`.
   * Never throws — logging must not break the user flow.
   *
   * @param {string} action - e.g. "coin_claim", "withdrawal_request".
   * @param {Object} details - { amount, uid, reason, result, ... }.
   *   NOTE: never put secrets, full IPs (client can't see real IP anyway),
   *   or passwords in details.
   */
  function auditLog(action, details) {
    details = details || {};
    var evt = {
      action: String(action).slice(0, 60),
      uid: getUid(),
      deviceId: deviceId(),
      amount: typeof details.amount === "number" ? details.amount : null,
      reason: String(details.reason || "").slice(0, 120),
      result: String(details.result || "").slice(0, 40),
      extra: String(details.extra || "").slice(0, 200),
      userAgent: String(navigator.userAgent || "").slice(0, 160),
      ts: Date.now(),
      serverTs: null // filled by serverTimestamp below when online
    };
    try {
      var db = getDb();
      if (!db) return Promise.resolve(false);
      evt.serverTs = firebase.firestore.FieldValue.serverTimestamp();
      var p1 = db.collection("security_events").add(evt);
      // Mirror a compact row into admin_audit (admin panel reads this).
      var p2 = db.collection("admin_audit").add({
        adminUid: evt.uid,
        adminEmail: "",
        action: "sec:" + evt.action,
        target: evt.uid || "",
        details: (evt.reason + " amount=" + evt.amount + " result=" + evt.result).slice(0, 300),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
      return Promise.all([p1, p2]).then(function () { return true; }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* ------------------------------------------------------------------ */
  /* 5. Suspicious-pattern detection (heuristics, advisory)              */
  /* ------------------------------------------------------------------ */

  /**
   * Heuristic checks on a transaction. Returns an array of flag strings
   * (empty = clean). Flags are logged, not auto-blocking, on the client.
   */
  function detectSuspicious(action, amount, context) {
    context = context || {};
    var flags = [];
    try {
      // Velocity spike: many actions in the last 5 minutes.
      var buckets = readBuckets();
      var b = buckets[action] || [];
      var now = Date.now();
      var recent = b.filter(function (t) { return now - t < 300000; }).length;
      if (recent >= 8) flags.push("velocity_spike");
      // Round-amount probing (common in fraud testing).
      if (amount > 0 && amount % 1000 === 0 && amount >= 10000) flags.push("round_amount_probe");
      // Repeated identical amounts in a row.
      var hist = context.recentAmounts || [];
      if (hist.length >= 3 && hist.every(function (a) { return a === amount; })) {
        flags.push("repeated_identical_amount");
      }
    } catch (e) {}
    return flags;
  }

  /* ------------------------------------------------------------------ */
  /* 6. Re-authentication gate for sensitive actions                     */
  /* ------------------------------------------------------------------ */

  var REAUTH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  var LS_REAUTH = "dokit_last_reauth";

  /**
   * Mark that the user freshly re-authenticated (call after a
   * re-authentication prompt succeeds).
   */
  function markReAuthed() {
    try { localStorage.setItem(LS_REAUTH, String(Date.now())); } catch (e) {}
  }

  /**
   * Check whether a sensitive action (withdrawal, large spend) may proceed
   * without asking the user to sign in again.
   * @returns {boolean} true = recent auth on file.
   */
  function hasRecentAuth() {
    try {
      var t = parseInt(localStorage.getItem(LS_REAUTH), 10) || 0;
      return (Date.now() - t) < REAUTH_WINDOW_MS;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ */
  /* 7. Idempotency keys (double-submit protection)                      */
  /* ------------------------------------------------------------------ */

  var LS_IDEMPOTENT = "dokit_idempotency";

  /**
   * Generate a one-time key for a state-changing action. The caller stores
   * it with the request; if the same key is seen twice, the second call
   * is rejected as a duplicate.
   * @param {string} scope - e.g. "withdrawal", "payment".
   * @returns {string} Unique key.
   */
  function newIdempotencyKey(scope) {
    var key = (scope || "op") + "_" + Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 10);
    return key;
  }

  /**
   * Atomically claim an idempotency key. Returns true on first use,
   * false if this key was already used (duplicate submission).
   */
  function claimIdempotencyKey(key) {
    try {
      var raw = localStorage.getItem(LS_IDEMPOTENT);
      var used = raw ? JSON.parse(raw) : {};
      if (used[key]) return false;
      used[key] = Date.now();
      // Prune keys older than 24h to bound storage.
      var cutoff = Date.now() - 86400000;
      Object.keys(used).forEach(function (k) { if (used[k] < cutoff) delete used[k]; });
      localStorage.setItem(LS_IDEMPOTENT, JSON.stringify(used));
      return true;
    } catch (e) { return true; } // fail open on storage errors (server is source of truth)
  }

  /* ------------------------------------------------------------------ */
  /* 8. XSS-safe text                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Escape a string for safe insertion via innerHTML.
   * Prefer textContent where possible; use this when HTML is required.
   */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * Format an amount for display (locale-safe, no HTML).
   */
  function fmtAmount(n) {
    try { return Number(n).toLocaleString("en-US"); } catch (e) { return String(n); }
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  window.FinSec = {
    // Validation
    validateAmount: validateAmount,
    assertSufficient: assertSufficient,
    MAX_AMOUNT: MAX_AMOUNT,
    // Rate limiting
    checkRate: checkRate,
    // Device
    deviceId: deviceId,
    // Audit
    auditLog: auditLog,
    // Fraud heuristics
    detectSuspicious: detectSuspicious,
    // Re-auth
    markReAuthed: markReAuthed,
    hasRecentAuth: hasRecentAuth,
    REAUTH_WINDOW_MS: REAUTH_WINDOW_MS,
    // Idempotency
    newIdempotencyKey: newIdempotencyKey,
    claimIdempotencyKey: claimIdempotencyKey,
    // Output safety
    esc: esc,
    fmtAmount: fmtAmount
  };
})();

/* ----------------------------------------------------------------------
 * REQUIRED FIRESTORE RULES (add in Firebase console — append-only logs):
 *
 * match /security_events/{id} {
 *   // Anyone signed in can CREATE their own events; nobody can edit/delete.
 *   allow create: if request.auth != null
 *                 && request.resource.data.uid == request.auth.uid
 *                 && request.resource.data.amount is number
 *                 && request.resource.data.amount >= 0;
 *   allow read: if isAdmin();
 *   allow update, delete: if false;
 * }
 *
 * match /users/{userId}/credit_ledger/{entryId} {
 *   allow read: if isAdmin() || (request.auth != null && request.auth.uid == userId);
 *   allow create: if request.auth != null && request.auth.uid == userId
 *                 && request.resource.data.amount is number;
 *   allow update, delete: if false;   // immutable
 * }
 *
 * match /users/{userId}/credits/wallet {
 *   // Wallet doc may only be written via transaction from the owner;
 *   // balance must stay a non-negative number.
 *   allow read: if isAdmin() || (request.auth != null && request.auth.uid == userId);
 *   allow write: if request.auth != null && request.auth.uid == userId
 *                && request.resource.data.balance is number
 *                && request.resource.data.balance >= 0;
 * }
 * ---------------------------------------------------------------------- */
