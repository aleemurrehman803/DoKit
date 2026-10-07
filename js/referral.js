/* DoKit — Referral system (Phase 6).
 *
 * How it works (virtual rewards for now):
 *  1. Signed-in user shares their link:  https://aleemurrehman803.github.io/DoKit/?ref={uid}
 *  2. A visitor opens the link; the landing page stores ?ref= in localStorage.
 *  3. When the visitor signs up, a referral doc is created:
 *         referrals/{newUid} = { referrerUid, createdAt, rewarded }
 *  4. The referrer earns VIRTUAL coins (clearly marked, no cash value).
 *
 * Real-money referral rewards are LOCKED until payments launch and legal
 * clearance is obtained. The reward logic below grants virtual coins only.
 */
(function () {
  "use strict";

  var LS_REF = "dokit_referrer"; // captured ?ref= on landing
  var SITE = "https://aleemurrehman803.github.io/DoKit/";

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

  /* Capture ?ref= from the URL (call on landing pages). */
  function captureFromUrl() {
    try {
      var m = /[?&]ref=([A-Za-z0-9_-]{6,64})/.exec(location.search || "");
      if (m && m[1]) {
        var me = getUid();
        if (!me || me !== m[1]) localStorage.setItem(LS_REF, m[1]);
      }
    } catch (e) {}
  }

  /* This user's shareable referral link (signed-in only). */
  function myLink() {
    var uid = getUid();
    return uid ? SITE + "?ref=" + encodeURIComponent(uid) : null;
  }

  /* The referrer UID captured for this browser (if any). */
  function capturedReferrer() {
    try { return localStorage.getItem(LS_REF) || null; } catch (e) { return null; }
  }

  /**
   * Record a referral when a NEW user signs up.
   * Called once after signup; rewards the referrer with virtual coins.
   * Safe to call when there is no referrer (no-op).
   */
  function recordSignup() {
    var db = getDb(), uid = getUid(), ref = capturedReferrer();
    if (!db || !uid || !ref || ref === uid) return Promise.resolve({ status: "none" });
    var doc = db.collection("referrals").doc(uid);
    return doc.get().then(function (snap) {
      if (snap.exists) return { status: "exists" };
      return doc.set({
        referrerUid: ref,
        referredUid: uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        rewarded: false,
        virtual: true
      }).then(function () {
        // Reward the referrer with VIRTUAL coins (TypeFight wallet module).
        try {
          if (window.DKTFWallet && DKTFWallet.awardTo) {
            return DKTFWallet.awardTo(ref, 25, "referral").then(function () {
              return doc.update({ rewarded: true }).catch(function () {});
            }).then(function () { return { status: "recorded" }; });
          }
        } catch (e) {}
        return { status: "recorded" };
      });
    }).then(function (r) {
      try { localStorage.removeItem(LS_REF); } catch (e) {}
      return r;
    }).catch(function () { return { status: "error" }; });
  }

  /**
   * List users this account referred (for the dashboard).
   */
  function myReferrals() {
    var db = getDb(), uid = getUid();
    if (!db || !uid) return Promise.resolve([]);
    return db.collection("referrals").where("referrerUid", "==", uid).limit(50).get()
      .then(function (snap) {
        var out = [];
        snap.forEach(function (d) { out.push(d.data()); });
        return out;
      })
      .catch(function () { return []; });
  }

  window.DKReferral = {
    captureFromUrl: captureFromUrl,
    myLink: myLink,
    capturedReferrer: capturedReferrer,
    recordSignup: recordSignup,
    myReferrals: myReferrals
  };

  /* Auto-capture on every page load. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", captureFromUrl);
  } else {
    captureFromUrl();
  }
})();
