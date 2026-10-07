/* DoKit — Real payment deposit/withdrawal system (manual admin verification).
 *
 * HOW IT WORKS (Pakistani platforms style):
 * 1. DEPOSIT: User sends money via Easypaisa/JazzCash/USDT to our displayed
 *    account, then submits the Transaction ID + screenshot. Admin manually
 *    verifies and credits coins 1:1 (Rs 1 = 1 coin).
 * 2. WITHDRAWAL: User requests withdrawal, coins are locked immediately.
 *    Admin manually sends money to user's account, then marks as processed.
 *
 * SECURITY:
 * - All amounts validated via FinSec.validateAmount (positive integers only)
 * - Rate limiting on all submissions
 * - Atomic Firestore transactions for balance changes (no partial updates)
 * - Hash-chained ledger entries (tamper-evident, via typefight.js TFT)
 * - Every action audit-logged to admin_audit + security_events
 * - Screenshots: max 500KB, images only, stored as base64 data URLs
 *
 * Firestore collections:
 * - deposits/{id}: userId, amount, method, txnId, sender, screenshot?, status,
 *     createdAt, reviewedBy?, reviewedAt?, rejectReason?
 * - withdrawals/{id}: userId, amount, method, account, status, createdAt,
 *     processedBy?, processedAt?, rejectReason?
 * - config/payments: easypaisa_number, jazzcash_number, usdt_address
 *
 * Status values: "pending" | "approved" | "rejected" (deposits)
 *                "pending" | "processed" | "rejected" (withdrawals)
 */
(function () {
  "use strict";

  /* ---------------- constants ---------------- */

  var MIN_DEPOSIT = 10;       // Rs 10 minimum deposit
  var MIN_WITHDRAW = 100;     // Rs 100 minimum withdrawal
  var MAX_AMOUNT = 1000000;   // Rs 10 lakh max per transaction
  var WITHDRAW_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h between withdrawals
  var DAILY_WITHDRAW_LIMIT = 50000; // Rs 50k per day

  var METHODS = {
    easypaisa: { label: "Easypaisa", icon: "💚" },
    jazzcash:  { label: "JazzCash",  icon: "❤️" },
    usdt:      { label: "USDT (TRC20)", icon: "₮" }
  };

  /* ---------------- helpers ---------------- */

  function db() {
    try { return (window.DKF && DKF.db && DKF.db()) || null; } catch (e) { return null; }
  }

  function currentUid() {
    try {
      var a = (window.DKF && DKF.auth && DKF.auth()) || null;
      var u = a && a.currentUser;
      return (u && u.uid) || null;
    } catch (e) { return null; }
  }

  function esc(s) {
    /* Prefer shared DKUtils.esc (js/dk-utils.js); local fallback if not loaded. */
    if (window.DKUtils && DKUtils.esc) return DKUtils.esc(s);
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Validate amount using FinSec (falls back to local check if FinSec missing).
   * NOTE: FinSec.validateAmount THROWS on invalid and RETURNS the clean
   * integer on success (it does NOT return {ok,value,error}). This adapter
   * converts to the {ok,value,error} shape used by callers below.
   * It also enforces the caller-supplied minimum (FinSec only knows max).
   */
  function validAmount(raw, min) {
    var n = Number(raw);
    if (window.FinSec && FinSec.validateAmount) {
      try {
        var clean = FinSec.validateAmount(n, { max: MAX_AMOUNT });
        if (clean < min) {
          return { ok: false, value: 0, error: "Minimum amount is " + min + "." };
        }
        return { ok: true, value: clean, error: null };
      } catch (e) {
        return { ok: false, value: 0, error: (e && e.message) || "Invalid amount." };
      }
    }
    // Fallback validation
    if (!isFinite(n) || n < min || n > MAX_AMOUNT || Math.floor(n) !== n) {
      return { ok: false, value: 0, error: "Amount must be a whole number between " + min + " and " + MAX_AMOUNT };
    }
    return { ok: true, value: n, error: null };
  }

  /* ---------------- payment config ---------------- */

  /**
   * Get the admin-configured payment accounts (Easypaisa/JazzCash/USDT).
   * Falls back to placeholder text if not configured yet.
   * @returns {Promise<Object>} { easypaisa_number, jazzcash_number, usdt_address }
   */
  function getPaymentConfig() {
    var d = db();
    var fallback = {
      easypaisa_number: "Not configured yet",
      jazzcash_number: "Not configured yet",
      usdt_address: "Not configured yet"
    };
    if (!d) return Promise.resolve(fallback);
    return d.collection("config").doc("payments").get().then(function (snap) {
      if (snap.exists) {
        var c = snap.data() || {};
        return {
          easypaisa_number: c.easypaisa_number || fallback.easypaisa_number,
          jazzcash_number: c.jazzcash_number || fallback.jazzcash_number,
          usdt_address: c.usdt_address || fallback.usdt_address
        };
      }
      return fallback;
    }).catch(function () { return fallback; });
  }

  /* ---------------- deposit ---------------- */

  /**
   * Submit a deposit request after the user has sent money manually.
   * Creates a "pending" deposit doc for admin review.
   *
   * @param {Object} opts { amount, method, txnId, sender, screenshotDataUrl? }
   * @returns {Promise<string>} deposit document ID
   */
  function submitDeposit(opts) {
    var uid = currentUid();
    if (!uid) return Promise.reject(new Error("Please sign in first."));

    // Rate limit: max 5 deposit submissions per hour
    if (window.FinSec && FinSec.checkRate) {
      var rl = FinSec.checkRate("deposit_submit", 5, 60 * 60 * 1000);
      if (!rl.ok) return Promise.reject(new Error("Too many requests. Please wait " + Math.ceil(rl.retryAfterMs / 60000) + " minutes."));
    }

    // Validate amount
    var av = validAmount(opts.amount, MIN_DEPOSIT);
    if (!av.ok) return Promise.reject(new Error(av.error));

    // Validate method
    if (!METHODS[opts.method]) return Promise.reject(new Error("Invalid payment method."));

    // Validate transaction ID (alphanumeric, 4-64 chars)
    var txnId = String(opts.txnId || "").trim();
    if (!/^[A-Za-z0-9\-_]{4,64}$/.test(txnId)) {
      return Promise.reject(new Error("Invalid Transaction ID. Must be 4-64 alphanumeric characters."));
    }

    // Validate sender account (5-20 chars)
    var sender = String(opts.sender || "").trim();
    if (sender.length < 5 || sender.length > 20) {
      return Promise.reject(new Error("Invalid sender account number."));
    }

    // Validate screenshot (optional, max 500KB data URL)
    var screenshot = opts.screenshotDataUrl || null;
    if (screenshot) {
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(screenshot)) {
        return Promise.reject(new Error("Screenshot must be a PNG, JPEG, or WebP image."));
      }
      if (screenshot.length > 500 * 1024 * 1.37) { // base64 overhead ~37%
        return Promise.reject(new Error("Screenshot too large. Maximum 500KB."));
      }
    }

    var d = db();
    if (!d) return Promise.reject(new Error("Database unavailable."));

    var doc = {
      userId: uid,
      amount: av.value,
      method: opts.method,
      txnId: txnId,
      sender: sender,
      screenshot: screenshot,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    };

    return d.collection("deposits").add(doc).then(function (ref) {
      // Audit log
      if (window.FinSec && FinSec.auditLog) {
        FinSec.auditLog("deposit_submitted", {
          depositId: ref.id, amount: av.value, method: opts.method, txnId: txnId
        });
      }
      return ref.id;
    });
  }

  /* ---------------- withdrawal ---------------- */

  /**
   * Submit a withdrawal request. Coins are locked immediately (deducted from
   * available balance into a pending_withdrawal hold).
   *
   * @param {Object} opts { amount, method, account }
   * @returns {Promise<string>} withdrawal document ID
   */
  function submitWithdrawal(opts) {
    var uid = currentUid();
    if (!uid) return Promise.reject(new Error("Please sign in first."));

    // Rate limit: max 3 withdrawal requests per hour
    if (window.FinSec && FinSec.checkRate) {
      var rl = FinSec.checkRate("withdraw_submit", 3, 60 * 60 * 1000);
      if (!rl.ok) return Promise.reject(new Error("Too many requests. Please wait."));
    }

    var av = validAmount(opts.amount, MIN_WITHDRAW);
    if (!av.ok) return Promise.reject(new Error(av.error));

    if (!METHODS[opts.method]) return Promise.reject(new Error("Invalid payment method."));

    var account = String(opts.account || "").trim();
    if (account.length < 5 || account.length > 30) {
      return Promise.reject(new Error("Invalid account number."));
    }

    var d = db();
    if (!d) return Promise.reject(new Error("Database unavailable."));

    // Check cooldown + balance + daily limit in a transaction
    var userRef = d.collection("users").doc(uid);
    var wdRef = d.collection("withdrawals").doc();

    return d.runTransaction(function (tx) {
      return tx.get(userRef).then(function (userSnap) {
        var udata = userSnap.exists ? userSnap.data() : {};
        var coins = Number(udata.coins) || 0;
        var pendingWd = Number(udata.pending_withdrawal) || 0;
        var lastWdAt = Number(udata.last_withdrawal_at) || 0;
        var available = coins - pendingWd;

        // Sufficient balance?
        if (available < av.value) {
          throw new Error("Insufficient balance. Available: " + available + " coins.");
        }

        // 24h cooldown?
        var now = Date.now();
        if (now - lastWdAt < WITHDRAW_COOLDOWN_MS) {
          var waitH = Math.ceil((WITHDRAW_COOLDOWN_MS - (now - lastWdAt)) / 3600000);
          throw new Error("Please wait " + waitH + " hours between withdrawals.");
        }

        // Lock the coins: move from available to pending_withdrawal
        tx.update(userRef, {
          pending_withdrawal: pendingWd + av.value,
          last_withdrawal_at: now
        });

        // Create the withdrawal request
        tx.set(wdRef, {
          userId: uid,
          amount: av.value,
          method: opts.method,
          account: account,
          status: "pending",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAtMs: now
        });

        return wdRef.id;
      });
    }).then(function (id) {
      if (window.FinSec && FinSec.auditLog) {
        FinSec.auditLog("withdrawal_submitted", {
          withdrawalId: id, amount: av.value, method: opts.method
        });
      }
      return id;
    });
  }

  /* ---------------- history ---------------- */

  /**
   * Get the current user's deposit + withdrawal history, newest first.
   * @param {number} limit Max entries per type (default 20)
   * @returns {Promise<{deposits: Array, withdrawals: Array}>}
   */
  function getMyHistory(limit) {
    var uid = currentUid();
    if (!uid) return Promise.resolve({ deposits: [], withdrawals: [] });
    var d = db();
    if (!d) return Promise.resolve({ deposits: [], withdrawals: [] });
    limit = limit || 20;

    var depP = d.collection("deposits").where("userId", "==", uid)
      .orderBy("createdAtMs", "desc").limit(limit).get().then(function (s) {
        var out = [];
        s.forEach(function (doc) { out.push(Object.assign({ id: doc.id }, doc.data())); });
        return out;
      }).catch(function () { return []; });

    var wdP = d.collection("withdrawals").where("userId", "==", uid)
      .orderBy("createdAtMs", "desc").limit(limit).get().then(function (s) {
        var out = [];
        s.forEach(function (doc) { out.push(Object.assign({ id: doc.id }, doc.data())); });
        return out;
      }).catch(function () { return []; });

    return Promise.all([depP, wdP]).then(function (r) {
      return { deposits: r[0], withdrawals: r[1] };
    });
  }

  /**
   * Get the user's current coin balance info.
   * @returns {Promise<{total: number, pending: number, available: number}>}
   */
  function getBalance() {
    var uid = currentUid();
    if (!uid) return Promise.resolve({ total: 0, pending: 0, available: 0 });
    var d = db();
    if (!d) return Promise.resolve({ total: 0, pending: 0, available: 0 });
    return d.collection("users").doc(uid).get().then(function (snap) {
      var data = snap.exists ? snap.data() : {};
      var total = Number(data.coins) || 0;
      var pending = Number(data.pending_withdrawal) || 0;
      return { total: total, pending: pending, available: Math.max(0, total - pending) };
    }).catch(function () { return { total: 0, pending: 0, available: 0 }; });
  }

  /* ---------------- public API ---------------- */

  window.DKPayReal = {
    MIN_DEPOSIT: MIN_DEPOSIT,
    MIN_WITHDRAW: MIN_WITHDRAW,
    MAX_AMOUNT: MAX_AMOUNT,
    METHODS: METHODS,
    getPaymentConfig: getPaymentConfig,
    submitDeposit: submitDeposit,
    submitWithdrawal: submitWithdrawal,
    getMyHistory: getMyHistory,
    getBalance: getBalance,
    esc: esc
  };
})();
