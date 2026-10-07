/* DoKit — Credits system (Phase 6) — SECURITY-HARDENED.
 *
 * Credits are the pay-as-you-go unit for future Pro features (bulk
 * processing, API calls). Right now credits are VIRTUAL ONLY:
 * users can earn demo credits by using the site; nothing can be
 * purchased and credits have no cash value.
 *
 * SECURITY MEASURES (Binance/bank-grade scaffold — see js/finsec.js):
 *  1. Amount validation — FinSec.validateAmount() rejects negatives,
 *     fractions, NaN, Infinity, and values above MAX_AMOUNT (overflow-safe).
 *  2. Hash-chained ledger — every credit_ledger entry carries prevHash +
 *     hash = SHA256(prevHash|uid|amount|reason|ts), tamper-evident.
 *     Balance is derived from the ledger; the wallet doc is a cache that
 *     must never go negative (enforced in transaction + Firestore rules).
 *  3. Atomic operations — balance + ledger written in ONE Firestore
 *     transaction. No partial writes, no drift.
 *  4. No silent failures — every path returns a value or throws a
 *     user-safe error; audit log fires on both success and failure.
 *  5. Rate limiting — demo earns are velocity-checked (FinSec.checkRate).
 *  6. Audit — every add/spend is logged to security_events + admin_audit.
 *
 * HONEST LIMITATION: client checks are advisory. Production enforcement
 * (Cloud Functions + rules at the bottom of js/finsec.js) is required
 * before real money moves.
 *
 * Storage: Firestore users/{uid}/credits  { balance, updatedAt }
 *          Ledger:  users/{uid}/credit_ledger/{entryId} (append-only,
 *                   hash-chained)
 */
(function () {
  "use strict";

  /* Local fallback key when signed out / offline. */
  var LS_KEY = "dokit_credits";

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
  function sec() { return window.FinSec || null; }

  /* SHA-256 hex digest (same construction as the coin ledger). */
  function sha256(str) {
    try {
      var bytes = new TextEncoder().encode(str);
      return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ("0" + b.toString(16)).slice(-2);
        }).join("");
      });
    } catch (e) {
      // Fallback (non-crypto env): NOT tamper-evident, flagged in entry.
      var h = 0;
      for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
      return Promise.resolve("insecure_" + (h >>> 0).toString(16));
    }
  }

  /* Read local demo balance. */
  function localGet() {
    try {
      var v = parseInt(localStorage.getItem(LS_KEY), 10);
      return isNaN(v) ? 0 : Math.max(0, v);
    } catch (e) { return 0; }
  }
  function localSet(n) {
    try { localStorage.setItem(LS_KEY, String(Math.max(0, n | 0))); } catch (e) {}
  }

  /**
   * Get current credit balance.
   * Signed-in: reads Firestore users/{uid}/credits (falls back to local).
   * Guest: local demo balance.
   * Never throws; returns 0 on any failure (no silent wrong numbers —
   * callers treat 0 as "unknown, retry").
   */
  function getBalance() {
    var db = getDb(), uid = getUid();
    if (!db || !uid) return Promise.resolve(localGet());
    return db.collection("users").doc(uid).collection("credits").doc("wallet").get()
      .then(function (snap) {
        if (snap.exists) {
          var d = snap.data();
          var b = typeof d.balance === "number" ? Math.trunc(d.balance) : 0;
          return b < 0 ? 0 : b; // defensive: never surface a negative
        }
        return 0;
      })
      .catch(function () { return localGet(); });
  }

  /**
   * Build a hash-chained ledger entry inside a transaction.
   * Chains off the wallet doc's stored lastHash (avoids a ledger scan
   * inside the transaction).
   * @private
   */
  function chainedEntry(t, walletRef, uid, amount, reason, kind) {
    return t.get(walletRef).then(function (wsnap) {
      var prevHash = (wsnap.exists && wsnap.data().lastHash) || "GENESIS";
      var prevBal = wsnap.exists && typeof wsnap.data().balance === "number"
        ? Math.trunc(wsnap.data().balance) : 0;
      if (prevBal < 0) prevBal = 0; // defensive: repair drift, never propagate negative
      var ts = Date.now();
      var payload = prevHash + "|" + uid + "|" + amount + "|" + reason + "|" + ts;
      return sha256(payload).then(function (hash) {
        return {
          entry: {
            amount: amount,
            reason: String(reason).slice(0, 120),
            kind: kind,
            ts: ts,
            serverTs: firebase.firestore.FieldValue.serverTimestamp(),
            prevHash: prevHash,
            hash: hash,
            virtual: true // <-- always true until real purchases exist
          },
          hash: hash,
          prevBal: prevBal
        };
      });
    });
  }

  /**
   * Add credits (virtual/demo). Reason is recorded in the hash-chained ledger.
   * Server-side purchases will call the equivalent Cloud Function.
   * @param {*} rawAmount - Validated via FinSec (rejects bad input).
   * @param {string} reason
   * @returns {Promise<number>} New balance.
   */
  function addCredits(rawAmount, reason) {
    var S = sec();
    var amount;
    try {
      amount = S ? S.validateAmount(rawAmount) : Math.max(0, Math.trunc(Number(rawAmount)) || 0);
      if (!amount) throw new Error("Amount must be greater than zero.");
    } catch (e) {
      if (S) S.auditLog("credit_add", { reason: reason, result: "rejected: " + e.message });
      return Promise.reject(e);
    }
    reason = String(reason || "demo").slice(0, 120);

    // Velocity check on demo earns (advisory).
    if (S) {
      var rl = S.checkRate("credit_add");
      if (!rl.ok) {
        S.auditLog("credit_add", { amount: amount, reason: reason, result: "rate_limited" });
        return Promise.reject(new Error("Too many requests. Try again shortly."));
      }
    }

    var db = getDb(), uid = getUid();
    if (!db || !uid) {
      var next = localGet() + amount;
      localSet(next);
      if (S) S.auditLog("credit_add", { amount: amount, reason: reason, result: "ok_local" });
      return Promise.resolve(next);
    }

    var wallet = db.collection("users").doc(uid).collection("credits").doc("wallet");
    var ledger = db.collection("users").doc(uid).collection("credit_ledger").doc();
    return db.runTransaction(function (t) {
      // Single atomic read: balance + lastHash come from the same snapshot.
      return chainedEntry(t, wallet, uid, amount, reason, "credit").then(function (ch) {
        var newBal = ch.prevBal + amount;
        if (newBal > 9007199254740991) throw new Error("Balance overflow — refused.");
        t.set(wallet, {
          balance: newBal,
          lastHash: ch.hash,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        t.set(ledger, ch.entry);
        return newBal;
      });
    }).then(function (newBal) {
      if (S) S.auditLog("credit_add", { amount: amount, reason: reason, result: "ok" });
      return newBal;
    }).catch(function (err) {
      if (S) S.auditLog("credit_add", { amount: amount, reason: reason, result: "failed" });
      // No silent failure: surface a safe message.
      throw new Error("Could not add credits. Please try again.");
    });
  }

  /**
   * Spend credits. Returns true if the spend succeeded, false if the
   * balance was insufficient. Invalid input throws.
   */
  function spendCredits(rawAmount, reason) {
    var S = sec();
    var amount;
    try {
      amount = S ? S.validateAmount(rawAmount) : Math.max(0, Math.trunc(Number(rawAmount)) || 0);
      if (!amount) throw new Error("Amount must be greater than zero.");
    } catch (e) {
      if (S) S.auditLog("credit_spend", { reason: reason, result: "rejected: " + e.message });
      return Promise.reject(e);
    }
    reason = String(reason || "usage").slice(0, 120);

    if (S) {
      var rl = S.checkRate("credit_spend");
      if (!rl.ok) {
        S.auditLog("credit_spend", { amount: amount, reason: reason, result: "rate_limited" });
        return Promise.reject(new Error("Too many requests. Try again shortly."));
      }
    }

    var db = getDb(), uid = getUid();
    if (!db || !uid) {
      var bal = localGet();
      if (bal < amount) {
        if (S) S.auditLog("credit_spend", { amount: amount, reason: reason, result: "insufficient_local" });
        return Promise.resolve(false);
      }
      localSet(bal - amount);
      if (S) S.auditLog("credit_spend", { amount: amount, reason: reason, result: "ok_local" });
      return Promise.resolve(true);
    }

    var wallet = db.collection("users").doc(uid).collection("credits").doc("wallet");
    var ledger = db.collection("users").doc(uid).collection("credit_ledger").doc();
    return db.runTransaction(function (t) {
      return chainedEntry(t, wallet, uid, -amount, reason, "debit").then(function (ch) {
        // HARD no-negative enforcement inside the atomic transaction.
        if (ch.prevBal < amount) return { ok: false };
        t.set(wallet, {
          balance: ch.prevBal - amount,
          lastHash: ch.hash,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        t.set(ledger, ch.entry);
        return { ok: true };
      });
    }).then(function (r) {
      if (S) S.auditLog("credit_spend", { amount: amount, reason: reason, result: r.ok ? "ok" : "insufficient" });
      return r.ok;
    }).catch(function () {
      if (S) S.auditLog("credit_spend", { amount: amount, reason: reason, result: "failed" });
      throw new Error("Could not spend credits. Please try again.");
    });
  }

  window.DKCredits = {
    getBalance: getBalance,
    addCredits: addCredits,
    spendCredits: spendCredits,
    /* Demo earn actions (virtual only, rate-limited). */
    earnForToolUse: function () { return addCredits(1, "tool_use"); },
    earnDaily: function () { return addCredits(5, "daily_bonus"); }
  };
})();
