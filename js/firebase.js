/* DoKit Firebase — project "dokit-app" (dokit-app-2e81d), free Spark plan.
   Loaded AFTER the firebase-*-compat.js CDN scripts. Exposes window.DKF. */
(function () {
  "use strict";

  // Firebase web API keys are public by design; access is enforced by
  // Firestore Security Rules + Auth, not by hiding this config.
  var firebaseConfig = {
    apiKey: "AIzaSyBMz9UjyIN98pu-hQ3CuE7BIFotKAqnQtM",
    authDomain: "dokit-app-2e81d.firebaseapp.com",
    projectId: "dokit-app-2e81d",
    storageBucket: "dokit-app-2e81d.firebasestorage.app",
    messagingSenderId: "890427724515",
    appId: "1:890427724515:web:7f29d9ccf4ba60033fabd6"
  };

  function ready() {
    if (!window.firebase) return false;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        // Bot protection: Firebase App Check (reCAPTCHA Enterprise).
        // Requests to Auth/Firestore carry an App Check token; the
        // Firebase console enforces it once "Enforce" is turned on.
        // DIAGNOSTIC (2026-10-07): App Check temporarily disabled to isolate
        // the Google sign-in auth/internal-error. Will re-enable after test.
        // try {
        //   if (firebase.appCheck) {
        //     firebase.appCheck().activate(
        //       new firebase.appCheck.ReCaptchaEnterpriseProvider("6LcljOItAAAAAASwSZRF2YrGeqG_8NgrWJiJctnb"),
        //       true /* auto-refresh tokens */
        //     );
        //   }
        // } catch (e) { /* App Check optional: app still works unenforced */ }
      }
      return true;
    } catch (e) { return false; }
  }

  var DKF = {
    ready: ready,
    config: firebaseConfig,

    auth: function () {
      return ready() ? firebase.auth() : null;
    },

    db: function () {
      return ready() ? firebase.firestore() : null;
    },

    storage: function () {
      return (ready() && firebase.storage) ? firebase.storage() : null;
    },

    /* Subscribe to auth state. cb(user|null). Returns unsubscribe fn. */
    onUser: function (cb) {
      var a = DKF.auth();
      if (!a) { try { cb(null); } catch (e) {} return function () {}; }
      return a.onAuthStateChanged(cb);
    },

    signOut: function () {
      var a = DKF.auth();
      return a ? a.signOut() : Promise.resolve();
    },

    googleProvider: function () {
      return new firebase.auth.GoogleAuthProvider();
    },

    userDoc: function (uid) {
      return DKF.db().collection("users").doc(uid);
    },

    /* Create/merge the user's profile doc on sign-in. Offline-safe. */
    ensureUserDoc: function (user) {
      if (!user || !user.uid || !DKF.db()) return Promise.resolve();
      var ref = DKF.userDoc(user.uid);
      return ref.get().then(function (snap) {
        var data = {
          email: user.email || "",
          name: user.displayName || "",
          photoURL: user.photoURL || "",
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!snap.exists) {
          data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          data.coins = 0;
        }
        return ref.set(data, { merge: true });
      }).catch(function () { /* ignore offline errors */ });
    },

    /* Record a tool usage event for stats (best-effort). */
    trackToolUse: function (uid, toolId) {
      if (!uid || !DKF.db()) return;
      try {
        DKF.db().collection("users").doc(uid).collection("tool_runs").add({
          tool: toolId,
          ts: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {});
      } catch (e) {}
    },

    friendlyError: function (err) {
      var code = (err && err.code) || "";
      var map = {
        "auth/email-already-in-use": "This email is already registered. Try logging in instead.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/invalid-credential": "Incorrect email or password. Please try again.",
        "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
        "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
        "auth/cancelled-popup-request": "Sign-in was cancelled. Please try again.",
        "auth/popup-blocked": "Your browser blocked the sign-in popup. Please allow popups and retry.",
        "auth/network-request-failed": "Network error. Check your connection and try again."
      };
      return map[code] || ((err && err.message) || "Something went wrong. Please try again.");
    }
  };

  window.DKF = DKF;
})();
