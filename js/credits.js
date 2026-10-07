/* DoKit — Credits system (Phase 6).
 *
 * Credits are the pay-as-you-go unit for future Pro features (bulk
 * processing, API calls). Right now credits are VIRTUAL ONLY:
 * users can earn demo credits by using the site; nothing can be
 * purchased and credits have no cash value.
 *
 * Storage: Firestore users/{uid}/credits  { balance, updatedAt }
 *          Ledger:  users/{uid}/credit_ledger/{entryId} (append-only)
 *
 * A developer picking this up:
 *  - Purchase flow: after a VERIFIED webhook, a Cloud Function adds
 *    credits via the same addCredits() shape (server-side).
 *  - Spend flow: deduct before running the paid job; refund on failure.
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

  /* Read local demo balance. */
  function localGet() {
    try {
      var v = parseInt(localStorage.getItem(LS_KEY), 10);
      return isNaN(v) ? 0 : v;
    } catch (e) { return 0; }
  }
  function localSet(n) {
    try { localStorage.setItem(LS_KEY, String(Math.max(0, n | 0))); } catch (e) {}
  }

  /**
   * Get current credit balance.
   * Signed-in: reads Firestore users/{uid}/credits (falls back to local).
   * Guest: local demo balance.
   */
  function getBalance() {
    var db = getDb(), uid = getUid();
    if (!db || !uid) return Promise.resolve(localGet());
    return db.collection("users").doc(uid).collection("credits").doc("wallet").get()
      .then(function (snap) {
        if (snap.exists) {
          var d = snap.data();
          return typeof d.balance === "number" ? d.balance : 0;
        }
        return 0;
      })
      .catch(function () { return localGet(); });
  }

  /**
   * Add credits (virtual/demo). Reason is recorded in the ledger.
   * Server-side purchases will call the equivalent Cloud Function.
   */
  function addCredits(amount, reason) {
    amount = Math.max(0, amount | 0);
    reason = reason || "demo";
    var db = getDb(), uid = getUid();
    var entry = {
      amount: amount,
      reason: reason,
      kind: "credit",
      ts: Date.now(),
      virtual: true // <-- always true until real purchases exist
    };
    if (!db || !uid) {
      localSet(localGet() + amount);
      return Promise.resolve(localGet());
    }
    var wallet = db.collection("users").doc(uid).collection("credits").doc("wallet");
    var ledger = db.collection("users").doc(uid).collection("credit_ledger").doc();
    return db.runTransaction(function (t) {
      return t.get(wallet).then(function (snap) {
        var bal = snap.exists && typeof snap.data().balance === "number" ? snap.data().balance : 0;
        var next = bal + amount;
        t.set(wallet, { balance: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        t.set(ledger, entry);
        return next;
      });
    }).catch(function () {
      localSet(localGet() + amount);
      return localGet();
    });
  }

  /**
   * Spend credits. Returns true if the spend succeeded.
   * Spends are recorded in the ledger (negative amount).
   */
  function spendCredits(amount, reason) {
    amount = Math.max(0, amount | 0);
    reason = reason || "usage";
    var db = getDb(), uid = getUid();
    if (!db || !uid) {
      var bal = localGet();
      if (bal < amount) return Promise.resolve(false);
      localSet(bal - amount);
      return Promise.resolve(true);
    }
    var wallet = db.collection("users").doc(uid).collection("credits").doc("wallet");
    var ledger = db.collection("users").doc(uid).collection("credit_ledger").doc();
    return db.runTransaction(function (t) {
      return t.get(wallet).then(function (snap) {
        var bal2 = snap.exists && typeof snap.data().balance === "number" ? snap.data().balance : 0;
        if (bal2 < amount) return false;
        t.set(wallet, { balance: bal2 - amount, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        t.set(ledger, { amount: -amount, reason: reason, kind: "debit", ts: Date.now(), virtual: true });
        return true;
      });
    }).catch(function () { return false; });
  }

  window.DKCredits = {
    getBalance: getBalance,
    addCredits: addCredits,
    spendCredits: spendCredits,
    /* Demo earn actions (virtual only). */
    earnForToolUse: function () { return addCredits(1, "tool_use"); },
    earnDaily: function () { return addCredits(5, "daily_bonus"); }
  };
})();
