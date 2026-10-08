/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "ferr_used": "This email is already registered. Try logging in instead.",
  "ferr_email": "Please enter a valid email address.",
  "ferr_pw": "Password must be at least 6 characters.",
  "ferr_nouser": "No account found with this email.",
  "ferr_wrongpw": "Incorrect password. Please try again.",
  "ferr_cred": "Incorrect email or password. Please try again.",
  "ferr_many": "Too many attempts. Please wait a little and try again.",
  "ferr_closed": "The Google sign-in window was closed before finishing.",
  "ferr_cancel": "Sign-in was cancelled. Please try again.",
  "ferr_blocked": "Your browser blocked the sign-in popup. Please allow popups and retry.",
  "ferr_net": "Network error. Check your connection and try again.",
  "ferr_unknown": "Something went wrong. Please try again.",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
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
        try {
          if (firebase.appCheck) {
            firebase.appCheck().activate(
              new firebase.appCheck.ReCaptchaEnterpriseProvider("6LcljOItAAAAAASwSZRF2YrGeqG_8NgrWJiJctnb"),
              true /* auto-refresh tokens */
            );
          }
        } catch (e) { /* App Check optional: app still works unenforced */ }
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

    /* Subscribe to auth state. cb(user|null). Returns unsubscribe fn.
       Suspension enforcement: when a user signs in, their users/{uid} doc is
       read (owner-read is allowed by Firestore rules). If suspended=true and
       the suspension has not expired, the user is signed out and sent to
       suspended.html with the reason. Expired suspensions are cleared
       opportunistically. Offline/read failure => fail open (cb(user)). */
    onUser: function (cb) {
      var a = DKF.auth();
      if (!a) { try { cb(null); } catch (e) {} return function () {}; }
      return a.onAuthStateChanged(function (user) {
        if (!user || !user.uid) { try { cb(null); } catch (e) {} return; }
        var db = DKF.db();
        if (!db) { try { cb(user); } catch (e) {} return; }
        try {
          db.collection("users").doc(user.uid).get().then(function (snap) {
            var d = (snap && snap.exists) ? (snap.data() || {}) : {};
            var until = Number(d.suspendUntil) || 0;
            var suspended = !!d.suspended && (!until || until > Date.now());
            if (suspended) {
              try {
                sessionStorage.setItem("dokit_suspended", JSON.stringify({
                  reason: String(d.suspendReason || ""),
                  until: until
                }));
              } catch (e) {}
              var done = function () {
                try { cb(null); } catch (e) {}
                if (!/suspended\.html$/.test(location.pathname)) {
                  var root = /^\/DoKit(\/|$)/.test(location.pathname) ? "/DoKit/" : "/";
                  location.href = root + "suspended.html";
                }
              };
              try {
                DKF.signOut().then(done, done);
              } catch (e) { done(); }
              return;
            }
            if (d.suspended && until && until <= Date.now()) {
              try {
                db.collection("users").doc(user.uid).set(
                  { suspended: false, suspendReason: "", suspendUntil: 0 },
                  { merge: true }).catch(function () {});
              } catch (e) {}
            }
            try { cb(user); } catch (e) {}
          }).catch(function () {
            try { cb(user); } catch (e) {}
          });
        } catch (e) {
          try { cb(user); } catch (e) {}
        }
      });
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
        "auth/email-already-in-use": dkT("ferr_used"),
        "auth/invalid-email": dkT("ferr_email"),
        "auth/weak-password": dkT("ferr_pw"),
        "auth/user-not-found": dkT("ferr_nouser"),
        "auth/wrong-password": dkT("ferr_wrongpw"),
        "auth/invalid-credential": dkT("ferr_cred"),
        "auth/too-many-requests": dkT("ferr_many"),
        "auth/popup-closed-by-user": dkT("ferr_closed"),
        "auth/cancelled-popup-request": dkT("ferr_cancel"),
        "auth/popup-blocked": dkT("ferr_blocked"),
        "auth/network-request-failed": dkT("ferr_net")
      };
      return map[code] || ((err && err.message) || dkT("ferr_unknown"));
    }
  };

  window.DKF = DKF;
})();
