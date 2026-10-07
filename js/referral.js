/* DoKit — Referral system (Phase 6).
 *
 * How it works (virtual rewards for now):
 *  1. Signed-in user shares their link:  https://aleemurrehman803.github.io/dokit/?ref={uid}
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
  var SITE = "https://aleemurrehman803.github.io/dokit/";

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
        // Uses TFWallet.award() which appends to the immutable coin ledger.
        // NOTE: under strict coin_ledger rules (owner-only create) a
        // cross-user award is denied server-side; the status below reports
        // the ACTUAL outcome so the UI never claims a reward that failed.
        try {
          if (window.TFWallet && TFWallet.award) {
            return TFWallet.award(ref, 25, "referral:" + uid).then(function (res) {
              if (res && !res.error) {
                return doc.update({ rewarded: true }).then(
                  function () { return true; },
                  function () { return false; }
                );
              }
              return false;
            }).then(function (ok) { return { status: "recorded", rewarded: !!ok }; });
          }
        } catch (e) { /* wallet unavailable - referral still recorded */ }
        return { status: "recorded", rewarded: false };
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

/* ----------------------------------------------------------------------
 * REQUIRED FIRESTORE RULES (add in Firebase console — this collection had
 * no rules coverage before the final audit):
 *
 * function isAdmin() {
 *   return request.auth != null &&
 *     exists(/databases/$(database)/documents/admins/$(request.auth.uid));
 * }
 *
 * match /referrals/{newUid} {
 *   // The NEW user records their own referral exactly once (doc id == uid).
 *   // "create" on an existing doc fails by definition, so concurrent
 *   // double-submits are rejected server-side (no double rewards).
 *   // NOTE (M2, see js/typefight-wallet.js): nothing stops fake-account
 *   // farming client-side. Referral rewards are VIRTUAL coins only;
 *   // production needs phone/email verification + server-side validation.
 *   allow create: if request.auth != null && request.auth.uid == newUid
 *                 && request.resource.data.referredUid == request.auth.uid
 *                 && request.resource.data.referrerUid is string
 *                 && request.resource.data.referrerUid != request.auth.uid
 *                 && request.resource.data.rewarded == false
 *                 && request.resource.data.virtual == true;
 *   // Readable by: the referred user, the referrer (their dashboard lists
 *   // referrals via where("referrerUid","==",uid) — this rule allows it),
 *   // and admins.
 *   allow read: if isAdmin()
 *               || (request.auth != null
 *                   && (request.auth.uid == newUid
 *                       || resource.data.referrerUid == request.auth.uid));
 *   // Only the "rewarded" flag may flip (by the awarding flow); admins
 *   // can correct anything.
 *   allow update: if isAdmin()
 *                 || (request.auth != null && request.auth.uid == newUid
 *                     && request.resource.data.diff(resource.data)
 *                          .affectedKeys().hasOnly(["rewarded"]));
 *   allow delete: if false;
 * }
 * ---------------------------------------------------------------------- */
