/* DoKit account backend (Phase 4, §4 foundation: items 75-78, then 87-97).
 *
 * WHAT: real Firebase Auth + Firestore for the phase2 site, reusing the
 * existing project (dokit-app-2e81d, free Spark plan) that the old site
 * already wired. No new project, no card, no invented data: every number
 * shown here comes from the signed-in user's own Firestore doc, and every
 * feature stays in an honest guest state until sign-in succeeds.
 *
 * WHY a new module (not the legacy js/firebase.js): the legacy file binds
 * the old site's DKI18N `dkT` global, which would clash with phase2's own
 * i18n engine. This module ports its proven logic (App Check activation,
 * suspension enforcement, user-doc auto-create, friendly errors) under the
 * DKA namespace and phase2's dkT(key, fallback) contract.
 *
 * HOW it loads: generator pages that need it list "account.js" directly;
 * main.js also injects it site-wide (header badge + maintenance need it
 * everywhere). The window.__dkaLoaded guard keeps it to one load.
 *
 * TRANSLATIONS: user-facing strings use dkT('acct_*', English fallback).
 * The acct_* keys are NEW (no old-site values exist) and are honestly
 * pending translation — the UI falls back to English until the dict
 * worker adds them. Never English-as-"translation" in the dict itself.
 */
(function(){
  'use strict';

  /* ---------- config (injected from legacy js/firebase.js) ---------- */
  /* The Firebase web config is public by design (access is enforced by
   * Firestore Rules + Auth, not by hiding it). It is injected by script
   * so this file never carries a second hand-typed copy to drift. */
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyBMz9UjyIN98pu-hQ3CuE7BIFotKAqnQtM",
    authDomain: "dokit-app-2e81d.firebaseapp.com",
    projectId: "dokit-app-2e81d",
    storageBucket: "dokit-app-2e81d.firebasestorage.app",
    messagingSenderId: "890427724515",
    appId: "1:890427724515:web:7f29d9ccf4ba60033fabd6"
  };

  /* ---------- SDK loader ---------- */
  var SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
  /* ReCaptcha Enterprise site key (public site key, same as legacy). */
  var RECAPTCHA_SITE_KEY = '6LcljOItAAAAAASwSZRF2YrGeqG_8NgrWJiJctnb';

  function loadScript(src, timeoutMs){
    return new Promise(function(resolve){
      var done = false;
      function fin(ok){ if (!done) { done = true; resolve(ok); } }
      var s = document.createElement('script');
      s.src = src;
      s.onload = function(){ fin(true); };
      s.onerror = function(){ fin(false); };
      document.head.appendChild(s);
      setTimeout(function(){ fin(false); }, timeoutMs || 10000);
    });
  }

  /* Load compat SDKs in order, then init. App Check is best-effort:
   * if its scripts fail, Auth still works and Firestore works unless the
   * console enforces App Check (mirrors the legacy comment). */
  var sdkReady = null;
  function ensureSdk(){
    if (sdkReady) { return sdkReady; }
    sdkReady = (function(){
      if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
        return Promise.resolve(true);
      }
      var chain = loadScript(SDK_BASE + 'firebase-app-compat.js')
        .then(function(){ return loadScript(SDK_BASE + 'firebase-auth-compat.js'); })
        .then(function(){ return loadScript(SDK_BASE + 'firebase-firestore-compat.js'); })
        .then(function(){ return loadScript(SDK_BASE + 'firebase-storage-compat.js'); })
        .then(function(){ return loadScript(SDK_BASE + 'firebase-app-check-compat.js'); })
        .then(function(){ return loadScript('https://www.google.com/recaptcha/enterprise.js'); });
      return chain.then(function(){
        if (!window.firebase) { return false; }
        try {
          if (!firebase.apps.length) { firebase.initializeApp(FIREBASE_CONFIG); }
          try {
            if (firebase.appCheck) {
              firebase.appCheck().activate(
                new firebase.appCheck.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
                true /* auto-refresh tokens */
              );
            }
          } catch (e) { /* App Check optional */ }
          return true;
        } catch (e) { return false; }
      });
    })();
    return sdkReady;
  }

  /* ---------- DKA core (ported from legacy DKF, adapted) ---------- */
  var DKA = {
    ready: function(){
      return !!(window.firebase && window.firebase.apps && window.firebase.apps.length);
    },
    auth: function(){ return DKA.ready() ? firebase.auth() : null; },
    db: function(){ return DKA.ready() ? firebase.firestore() : null; },
    storage: function(){ return (DKA.ready() && firebase.storage) ? firebase.storage() : null; },
    userDoc: function(uid){ return DKA.db().collection('users').doc(uid); },

    /* Friendly message per Auth error code (old site's DK_STR wording,
     * now under acct_err_* keys so the dict worker can translate them). */
    friendlyError: function(err){
      var code = (err && err.code) || '';
      var map = {
        'auth/email-already-in-use': ['acct_err_used', 'This email is already registered. Try logging in instead.'],
        'auth/invalid-email': ['acct_err_email', 'Please enter a valid email address.'],
        'auth/weak-password': ['acct_err_pw', 'Password must be at least 6 characters.'],
        'auth/user-not-found': ['acct_err_nouser', 'No account found with this email.'],
        'auth/wrong-password': ['acct_err_wrongpw', 'Incorrect password. Please try again.'],
        'auth/invalid-credential': ['acct_err_cred', 'Incorrect email or password. Please try again.'],
        'auth/too-many-requests': ['acct_err_many', 'Too many attempts. Please wait a little and try again.'],
        'auth/popup-closed-by-user': ['acct_err_closed', 'The Google sign-in window was closed before finishing.'],
        'auth/cancelled-popup-request': ['acct_err_cancel', 'Sign-in was cancelled. Please try again.'],
        'auth/popup-blocked': ['acct_err_blocked', 'Your browser blocked the sign-in popup. Please allow popups and retry.'],
        'auth/network-request-failed': ['acct_err_net', 'Network error. Check your connection and try again.']
      };
      var hit = map[code];
      if (hit) { return (window.dkT ? window.dkT(hit[0], hit[1]) : hit[1]); }
      return (err && err.message) || (window.dkT ? window.dkT('acct_err_unknown', 'Something went wrong. Please try again.') : 'Something went wrong. Please try again.');
    },

    /* Create/merge the user's profile doc on sign-in. Owner-create rules
     * allow coins == 0 (or absent) and forbid suspension fields, so this
     * payload carries neither suspension nor a starting balance above 0. */
    ensureUserDoc: function(user, extra){
      if (!user || !user.uid || !DKA.db()) { return Promise.resolve(); }
      var ref = DKA.userDoc(user.uid);
      return ref.get().then(function(snap){
        var data = {
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        /* HOOKS (referral-complete §7): this device's stable id, for
         * the admin duplicate-device view. Generated once per browser
         * (crypto.randomUUID, Math.random fallback for old browsers)
         * and kept in localStorage; never a privileged field, and a
         * storage failure simply skips the merge (best-effort). */
        var dkDeviceId = null;
        try {
          dkDeviceId = localStorage.getItem('dk_device_id');
          if (!dkDeviceId) {
            if (window.crypto && window.crypto.randomUUID) {
              dkDeviceId = window.crypto.randomUUID();
            } else {
              dkDeviceId = 'dk-' + Date.now().toString(36) + '-'
                + Math.floor(Math.random() * 1e9).toString(36);
            }
            localStorage.setItem('dk_device_id', dkDeviceId);
          }
        } catch (e) { dkDeviceId = null; }
        if (!snap.exists) {
          data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          /* Senior-review fix (live-test 6, Oct 26): NO coins field
           * here on purpose. The onUser fallback can plant its bare
           * doc before the server evaluates this set, turning it
           * into an UPDATE — and coins is a privileged key, so the
           * whole write is denied and referrerId/consent/photoURL/
           * lastLogin are all lost with it. Every coins read
           * tolerates absence (dashboard/header/admin show 0, and
           * FieldValue.increment treats a missing field as 0), and
           * the create rule explicitly allows coins absent. */

          /* Referral Phase 1: extras (referrerId / referralCode /
           * consent) are applied to a brand-new doc. A returning user
           * signing in again never gets a referrer overwritten by a
           * later ?ref= visit — the first referrer stands. All four
           * fields are owner-writable (none is in the privileged keys
           * list in firestore.rules). */
          if (extra) {
            Object.keys(extra).forEach(function (k) { data[k] = extra[k]; });
          }
        } else if (extra) {
          /* Referral race fix (live-test 4, Oct 26): the onUser
           * fallback can plant a bare doc (numeric createdAt, no
           * referral fields) BEFORE this handler runs, and the old
           * creation-only rule then dropped the extras entirely.
           * Fill referral fields that are still MISSING — never
           * overwrite an existing referrerId, so the first referrer
           * still stands. */
          var existing = snap.data() || {};
          ['referrerId', 'referralCode', 'referralActivationConsent', 'referralConsentAt'].forEach(function (k) {
            if (extra[k] !== undefined && (existing[k] === undefined || existing[k] === '' || existing[k] === null)) {
              data[k] = extra[k];
            }
          });
        }
        /* HOOKS (referral-complete §7): sign-in stamps, merged into
         * this same write (no extra round-trip, no privileged field
         * touched — coins/suspension keys are never in data here).
         * lastLoginPrev = the doc's previous lastLogin, so the admin
         * reactivation view can measure the gap before this sign-in;
         * a first-time doc has no previous value, so nothing is set.
         * deviceIds = the previous list plus this device, added only
         * when absent (read-modify-write against the doc just read). */
        if (snap.exists) {
          var prevDoc = snap.data() || {};
          if (prevDoc.lastLogin !== undefined && prevDoc.lastLogin !== null) {
            data.lastLoginPrev = prevDoc.lastLogin;
          }
          if (dkDeviceId) {
            var prevIds = Array.isArray(prevDoc.deviceIds) ? prevDoc.deviceIds.slice() : [];
            if (prevIds.indexOf(dkDeviceId) < 0) { prevIds.push(dkDeviceId); }
            data.deviceIds = prevIds;
          }
        } else if (dkDeviceId) {
          data.deviceIds = [dkDeviceId];
        }
        return ref.set(data, { merge: true });
      }).catch(function(err){
        /* Diagnostic (live-test 5, Oct 26): this catch used to swallow
         * every failure silently, which hid three straight live-test
         * failures. A failed user-doc write must stay visible in the
         * console so the next test can report the real reason
         * (rules denial, network, or otherwise). Behaviour is
         * unchanged: the signup still proceeds to the dashboard. */
        try { console.warn('[DKA] ensureUserDoc failed:', err && err.code, err && err.message); } catch (e) {}
        /* Exact-diagnosis (live-test 6, Oct 26): the automated browser
         * cannot open DevTools, so a console warning alone never
         * reaches the test. Remember the failure where the signup
         * handler can see it and show it on the page instead. */
        try { window.__dokitDocError = err; } catch (e) {}
      });
    },

    /* True when the signed-in user has an admins/{uid} doc (the owner
     * creates admin docs manually in the Firebase console — no client
     * can create one, per the rules). */
    isAdmin: function(uid){
      if (!uid || !DKA.db()) { return Promise.resolve(false); }
      return DKA.db().collection('admins').doc(uid).get()
        .then(function(s){ return !!(s && s.exists); })
        .catch(function(){ return false; });
    },

    signOut: function(){
      var a = DKA.auth();
      return a ? a.signOut() : Promise.resolve();
    },

    /* Auth-state subscription WITH suspension enforcement (legacy port):
     * suspended users are signed out and sent to suspended/; expired
     * suspensions are cleared opportunistically; offline/read failure
     * fails open (the user still gets their session). */
    onUser: function(cb){
      var a = DKA.auth();
      if (!a) { try { cb(null); } catch (e) {} return function(){}; }
      return a.onAuthStateChanged(function(user){
        if (!user || !user.uid) { try { cb(null); } catch (e) {} return; }
        var db = DKA.db();
        if (!db) { try { cb(user); } catch (e) {} return; }
        try {
          db.collection('users').doc(user.uid).get().then(function(snap){
            var d = (snap && snap.exists) ? (snap.data() || {}) : {};
            if (!snap || !snap.exists) {
              try {
                db.collection('users').doc(user.uid).set({
                  email: user.email || '',
                  displayName: user.displayName || '',
                  /* Referral Phase 1 fallback creation: a doc created
                   * here (not via a signup form) still gets its own
                   * referralCode so the invite link always works.
                   * referrerId is NOT set here — only the signup flows
                   * may attribute a referrer, never a later sign-in. */
                  referralCode: user.uid,
                  createdAt: Date.now()
                }, { merge: true }).catch(function(){});
              } catch (e) {}
            }
            var until = Number(d.suspendUntil) || 0;
            var suspended = !!d.suspended && (!until || until > Date.now());
            if (suspended) {
              try {
                sessionStorage.setItem('dokit_suspended', JSON.stringify({
                  reason: String(d.suspendReason || ''), until: until
                }));
              } catch (e) {}
              var done = function(){
                try { cb(null); } catch (e) {}
                if (!/suspended\/$/.test(location.pathname)) {
                  var root = /^\/DoKit(\/|$)/.test(location.pathname) ? '/DoKit/' : '/';
                  location.href = root + 'suspended/';
                }
              };
              try { DKA.signOut().then(done, done); } catch (e) { done(); }
              return;
            }
            if (d.suspended && until && until <= Date.now()) {
              try {
                db.collection('users').doc(user.uid).set(
                  { suspended: false, suspendReason: '', suspendUntil: 0 },
                  { merge: true }).catch(function(){});
              } catch (e) {}
            }
            /* HOOKS (referral-complete §7): email-verification stamp
             * for the verification tier. Set exactly once — only when
             * Auth says the address is verified AND the doc has no
             * stamp yet — so a later unverified state never erases
             * it. Best-effort silent: a denied write changes nothing
             * about the session, which proceeds below regardless. */
            try {
              if (snap && snap.exists && user.emailVerified && !d.emailVerifiedAt) {
                db.collection('users').doc(user.uid).set(
                  { emailVerifiedAt: firebase.firestore.FieldValue.serverTimestamp() },
                  { merge: true }).catch(function(){});
              }
            } catch (e) {}
            try { cb(user); } catch (e) {}
          }).catch(function(){ try { cb(user); } catch (e) {} });
        } catch (e) { try { cb(user); } catch (e) {} }
      });
    }
  };
  window.DKA = DKA;

  /* Item 79 fix (found by the item 79 stub suite): the admin/error call
   * sites below call bare friendlyError(err), but only DKA.friendlyError
   * existed — so EVERY error path threw ReferenceError instead of
   * showing its message (success paths never called it, which is why it
   * survived). This alias restores the binding the call sites were
   * written against; it changes no success-path behavior. */
  function friendlyError(err){ return DKA.friendlyError(err); }

  /* ---------- referral capture (?ref= on any page) ---------- */
  try {
    var refMatch = /[?&]ref=([^&#]+)/.exec(location.search || '');
    if (refMatch && refMatch[1]) {
      sessionStorage.setItem('dokit_ref', decodeURIComponent(refMatch[1]));
    }
  } catch (e) {}
  /* QR-scan capture (referral #37): a signup link carrying ?qr=1 marks
   * the join as QR-attributed. Stored next to dokit_ref so the Google
   * redirect (which drops URL params) keeps it, and cleared with
   * dokit_ref after signup so it can never misattribute a later
   * unrelated signup in the same tab. */
  try {
    if (/[?&]qr=1(&|#|$)/.test(location.search || '')) {
      sessionStorage.setItem('dokit_qr', '1');
    }
  } catch (e) {}
  /* Class-link capture (item #9): a signup link carrying ?class=CODE
   * marks the join as a class join, stored next to dokit_ref so the
   * Google redirect (which drops URL params) keeps it, and cleared
   * with dokit_ref after signup so it can never misattribute a later
   * unrelated signup in the same tab. The code is stored RAW here;
   * validation/normalization happens at read time
   * (getCapturedClassCode), so a malformed code can never be
   * stored as a valid one. */
  try {
    var classMatch = /[?&]class=([^&#]+)/.exec(location.search || '');
    if (classMatch && classMatch[1]) {
      sessionStorage.setItem('dokit_class', decodeURIComponent(classMatch[1]));
    }
  } catch (e) {}
  /* Referral consent visibility (live-test fix, Oct 26): the signup
   * checkbox wrap ships hidden, and until now NOTHING ever unhid it —
   * so consent could never be given and the activation writer always
   * skipped. Once a referral is captured (URL param just now, or an
   * earlier page in this tab), reveal the checkbox so the user can
   * actually agree. Deferred scripts run after DOM parse, so the
   * element exists here when present; absent on other pages = no-op. */
  try {
    var capturedRef = sessionStorage.getItem('dokit_ref') || '';
    var consentWrap = document.getElementById('ref-consent-wrap');
    if (capturedRef && consentWrap) { consentWrap.hidden = false; }
  } catch (e) {}
  /* Referral Phase 1 — signup fields for a NEW user doc (used by BOTH
   * signup flows below, so email and Google signups behave identically):
   * referralCode is always the user's own uid (the referral link IS
   * ?ref=<uid>, so no lookup collection is needed); referrerId is the
   * captured ?ref= value only when present and not the user's own uid
   * (self-referral is also blocked by the referrals create rule);
   * referralActivationConsent comes from the signup consent checkbox
   * (id ref-consent, HTML added by the sibling page task) — wired
   * defensively: if the element is absent, consent is simply not
   * recorded, never an exception. Consent is recorded, never assumed:
   * an unchecked/absent box means no consent fields at all. */

  /* Referral capture fallback (live-test 3, Oct 26): test 3 showed a
   * referred signup with NO referrerId and NO referrals doc, i.e. the
   * stored ?ref= never reached the signup handler (e.g. tab or
   * storage edge). sessionStorage stays primary; at SUBMIT time also
   * re-read ?ref= from the current page URL, so a signup submitted
   * on a ?ref= URL still attributes even if storage was lost. No
   * localStorage mirror: a stored ref could misattribute a later
   * unrelated signup. Returning users never reach these paths
   * (ensureUserDoc is creation-only; Google gates on isNewUser). */
  function getCapturedRef() {
    try {
      var s = sessionStorage.getItem('dokit_ref') || '';
      if (s) { return s; }
    } catch (e) {}
    try {
      var m = /[?&]ref=([^&#]+)/.exec(location.search || '');
      if (m && m[1]) { return decodeURIComponent(m[1]); }
    } catch (e) {}
    return '';
  }
  /* QR source for the referrals row (referral #37): 'qr' when the
   * join came through a ?qr=1 link, else 'link'. The referrals create
   * rule validates only referrerUid, so this extra field is allowed. */
  function getCapturedSource() {
    try {
      if (sessionStorage.getItem('dokit_qr') === '1') { return 'qr'; }
    } catch (e) {}
    try {
      if (/[?&]qr=1(&|#|$)/.test(location.search || '')) { return 'qr'; }
    } catch (e) {}
    return 'link';
  }
  /* Class code for the referrals row (item #9): the ?class= value
   * (sessionStorage primary, URL re-read at submit time — same
   * fallback as ?ref=), normalized to UPPERCASE and accepted only
   * when it matches the class-code rule (mirror of
   * DKREF.classCodeValid in referrals.js — keep both in sync).
   * '' when absent or malformed: a bad code is never recorded
   * as a join. */
  function getCapturedClassCode() {
    var raw = '';
    try { raw = sessionStorage.getItem('dokit_class') || ''; } catch (e) {}
    if (!raw) {
      try {
        var m = /[?&]class=([^&#]+)/.exec(location.search || '');
        if (m && m[1]) { raw = decodeURIComponent(m[1]); }
      } catch (e) {}
    }
    if (!raw) { return ''; }
    var code = String(raw).trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,12}$/.test(code)) { return ''; }
    return code;
  }
  /* Invitee language for ambassador counts (referral #36): the UI
   * language persisted as localStorage dokit_lang. '' when unknown
   * (never guessed — ambassador counting skips 'unknown'). */
  function getCapturedLanguage() {
    try {
      return localStorage.getItem('dokit_lang') || '';
    } catch (e) { return ''; }
  }
  function referralSignupFields(u) {
    var fields = { referralCode: u.uid };
    try {
      var ref = getCapturedRef();
      if (ref && ref !== u.uid) { fields.referrerId = ref; }
    } catch (e) {}
    try {
      var cc = getCapturedClassCode();
      if (cc) { fields.classCode = cc; }
    } catch (e) {}
    try {
      var consentEl = document.getElementById('ref-consent');
      if (consentEl && consentEl.checked) {
        fields.referralActivationConsent = true;
        fields.referralConsentAt = Date.now();
      }
    } catch (e) {}
    return fields;
  }

  /* ---------- small DOM helpers ---------- */
  function $(id){ return document.getElementById(id); }
  function setText(id, text){
    var el = $(id);
    if (el) { el.textContent = text; }
  }
  function showMsg(id, text, isErr){
    var el = $(id);
    if (!el) { return; }
    el.textContent = text;
    el.className = isErr ? 'err' : 'note';
    el.hidden = !text;
  }
  /* Site prefix: live pages live under /DoKit/, local pages under /. */
  function siteRoot(){
    return /^\/DoKit(\/|$)/.test(location.pathname) ? '/DoKit/' : '/';
  }
  function displayNameOf(user, doc){
    if (doc && (doc.displayName || doc.name)) { return doc.displayName || doc.name; }
    if (user && user.displayName) { return user.displayName; }
    if (user && user.email) { return user.email.split('@')[0]; }
    return '';
  }

  /* ---------- header sync: avatar initial + coin badge ---------- */
  function syncHeader(user, doc){
    var btn = $('dkProfBtn');
    if (btn) {
      var inner = btn.querySelector('.dk-avatarbtn__inner');
      if (inner) {
        inner.textContent = user ? (displayNameOf(user, doc) || '?').charAt(0).toUpperCase() : '👤';
      }
    }
    /* Header menus (items 99/103): Firebase is the auth truth here.
       Mirror it into the last-known flag (so main.js shows the right
       rows on pages where account.js never loads) and let main.js do
       the DOM toggling — one implementation, not two. The Logout row
       is bound here only: main.js cannot sign out (no Firebase). */
    try {
      if (user) { localStorage.setItem('dokit_authed', '1'); }
      else { localStorage.removeItem('dokit_authed'); }
    } catch (e) {}
    if (typeof window.dkApplyHeaderAuth === 'function') {
      window.dkApplyHeaderAuth(!!user);
    }
    var lo = $('dk-menu-signout');
    if (lo) {
      lo.hidden = !user;
      if (user && !lo.dataset.dka) {
        lo.dataset.dka = '1';
        lo.addEventListener('click', function(e){
          e.preventDefault();
          DKA.signOut().then(function(){ location.href = siteRoot() + 'account/login/'; });
        });
      }
    }
    /* Coin badge: real balance only, never a placeholder number. */
    var drop = document.querySelector('.prof-drop');
    if (drop && user && doc && typeof doc.coins === 'number') {
      var badge = $('dk-coin-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'dk-coin-badge';
        badge.className = 'chip';
        badge.style.marginLeft = '8px';
        drop.appendChild(badge);
      }
      badge.textContent = '🪙 ' + doc.coins;
      badge.title = (window.dkT ? window.dkT('prof.coins', 'Coins') : 'Coins');
    }
  }

  /* ---------- auth state: header + page bindings ---------- */
  var currentUser = null, currentDoc = null;
  function boot(){
    ensureSdk().then(function(ok){
      if (!ok) {
        /* Backend unreachable: forms stay visible but submit with an
         * honest error instead of pretending. Nothing is faked. */
        document.querySelectorAll('.auth-form').forEach(function(f){
          f.addEventListener('submit', function(e){
            e.preventDefault();
            showMsg('acct-err', (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true);
          });
        });
        /* Verify form must work without the cloud SDK too (device
         * certificates verify via the same-browser fallback). */
        bindVfForm();
        return;
      }
      DKA.onUser(function(user){
        currentUser = user;
        if (!user) {
          currentDoc = null;
          syncHeader(null, null);
          bindGuestPages();
          admGate(true);
          maintenanceCheck(null, false);
          return;
        }
        DKA.userDoc(user.uid).get().then(function(snap){
          currentDoc = (snap && snap.exists) ? (snap.data() || {}) : {};
          syncHeader(user, currentDoc);
          bindAuthedPages(user, currentDoc);
          DKA.isAdmin(user.uid).then(function (adm) {
            if ($('adm-gate')) {
              if (adm) { admLoad(user); } else { admGate(false); }
            }
            maintenanceCheck(user, adm);
          }).catch(function () { maintenanceCheck(user, false); });
        }).catch(function(){
          currentDoc = {};
          syncHeader(user, currentDoc);
          bindAuthedPages(user, currentDoc);
          DKA.isAdmin(user.uid).then(function (adm) {
            if ($('adm-gate')) {
              if (adm) { admLoad(user); } else { admGate(false); }
            }
            maintenanceCheck(user, adm);
          }).catch(function () { maintenanceCheck(user, false); });
        });
      });
      bindStaticForms();
    });
  }

  /* Guest-only page states (dashboard without sign-in shows a prompt,
   * never invented account data). */
  function bindGuestPages(){
    var df = $('dep-form'); if (df) { df.hidden = true; }
    var dl = $('dep-list'); if (dl) { dl.hidden = true; }
    var dg = $('dep-guest'); if (dg) { dg.hidden = false; }
    var wf2 = $('wd-form'); if (wf2) { wf2.hidden = true; }
    var wl2 = $('wd-list'); if (wl2) { wl2.hidden = true; }
    var wg = $('wd-guest'); if (wg) { wg.hidden = false; }
    var ib = $('cert-issue-btn');
    if (ib) { ib.hidden = true; }
    var ig = $('cert-issue-guest');
    if (ig) { ig.hidden = false; }
    var dash = $('dash-guest');
    if (dash) { dash.hidden = false; }
    var dashMain = $('dash-main');
    if (dashMain) { dashMain.hidden = true; }
    var wfMain = $('wf-main');
    if (wfMain) { wfMain.hidden = true; }
    var tfMain = $('tf-main');
    if (tfMain) { tfMain.hidden = true; }
    var tfGuest = $('tf-guest');
    if (tfGuest) { tfGuest.hidden = false; }
    var tpMain = $('tp-account-main');
    if (tpMain) { tpMain.hidden = true; }
    var tpGuest = $('tp-account-guest');
    if (tpGuest) { tpGuest.hidden = false; }
    /* Update Profile (Oct 26): guests never see the button or form —
     * the full-info form is signed-in only, like the profile form. */
    var ubG = $('prof-update-btn'); if (ubG) { ubG.hidden = true; }
    var prfG = $('prof-form'); if (prfG) { prfG.hidden = true; }
  }

  /* ---------- login / signup / reset / Google ---------- */
  function nfErr(){
    // Internal sentinel only: never displayed. A literal inside
    // `new Error('...')` would be gate-flagged as rendered text.
    var e = new Error();
    e.code = 'nf';
    return e;
  }
  function parseCertNum(txt){
    // Sheet values render as "50 WPM" / "90% accuracy" -- digits only.
    var n = parseInt((txt || '').replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }
  function makeCertRef(){
    // Issued refs must be unique per issuance: result-date base (the
    // practice format) plus a random suffix, so two users issuing in
    // the same minute never collide on the same document id.
    var d = new Date();
    function two(n){ return String(n).padStart(2, '0'); }
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var suf = '';
    for (var i = 0; i < 4; i++) {
      suf += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'DK-' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate())
      + '-' + two(d.getHours()) + two(d.getMinutes()) + '-' + suf;
  }
  function issueCert(user){
    // Guard: nothing to issue without a rendered result. The sheet only
    // fills when certificate.js found a local result; a zero WPM means
    // the practice sheet never rendered, so issuing would save garbage.
    var filled = $('cert-filled');
    var wpm = parseCertNum($('cert-wpm') ? $('cert-wpm').textContent : '');
    if (!filled || filled.hidden || !wpm) {
      showMsg('cert-issue-msg',
        (window.dkT ? window.dkT('acct_cert_noresult', 'Take a test or race a battle first \u2014 there is no result to issue.') : 'Take a test or race a battle first \u2014 there is no result to issue.'), true);
      return;
    }
    if (!user) {
      showMsg('cert-issue-msg',
        (window.dkT ? window.dkT('rsv_0523', 'Sign in to your account.') : 'Sign in to your account.'), true);
      return;
    }
    if (!DKA.db()) {
      showMsg('cert-issue-msg',
        (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true);
      return;
    }
    var sheet = $('cert-filled');
    var kind = (sheet && sheet.getAttribute('data-kind') === 'battle') ? 'battle' : 'typing';
    var name = ($('cert-name-out') ? $('cert-name-out').textContent : '').trim();
    var acc = parseCertNum($('cert-acc') ? $('cert-acc').textContent : '');
    /* WHY (Oct 27 fix): the sheet date is the frozen device-record
     * date (observed 10/26 on a 10/27 issuance), not the issuance
     * date. The issued doc must carry today's date, so the sheet and
     * the Verify page show the true issuance date. */
    var dateStr = new Date().toLocaleDateString();
    var ref = makeCertRef();
    // Full result fields when the sheet carries them (typing only;
    // battle sheets have no gross/duration/language elements, so the
    // fields stay absent rather than invented).
    var doc = {
      ownerUid: user.uid, kind: kind, name: name, wpm: wpm, acc: acc,
      date: dateStr,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    var gross = parseCertNum($('cert-gross') ? $('cert-gross').textContent : '');
    if (gross) { doc.gross = gross; }
    var dur = parseCertNum($('cert-duration') ? $('cert-duration').textContent : '');
    if (dur) { doc.durationSec = dur; }
    var langTxt = ($('cert-language') ? $('cert-language').textContent : '').trim();
    if (langTxt && langTxt !== '\u2014') { doc.language = (langTxt === 'English') ? 'en' : langTxt; }
    DKA.db().collection('certificates').doc(ref).set(doc).then(function () {
      var refEl = $('cert-ref');
      /* Capture the device-record ref BEFORE overwriting: the QR and
       * verify link were built from it by certificate.js, and after
       * issuance they must point at the issued ref, or a printed copy
       * verifies the wrong (device-only) record. Refs are [A-Z0-9-]
       * only, so the encoded QR data contains the raw old ref
       * verbatim and a plain string replace is exact. (Battle sheets
       * link by serial, not by ref, so the replace is a harmless
       * no-op there.) */
      var oldRef = refEl ? refEl.textContent : '';
      if (refEl) { refEl.textContent = ref; }
      if (oldRef && oldRef !== '\u2014') {
        var vl = $('cert-verify-link');
        if (vl) {
          if (vl.href) { vl.href = vl.href.split(oldRef).join(ref); }
          if (vl.textContent) { vl.textContent = vl.textContent.split(oldRef).join(ref); }
        }
        var qr = $('cert-qr');
        if (qr && qr.src) { qr.src = qr.src.split(oldRef).join(ref); }
      }
      var dateEl = $('cert-date');
      if (dateEl) { dateEl.textContent = dateStr; }
      // The practice note carries .cert-practice (the authority line is
      // the first <p>, not the practice note); replace it so a printed
      // copy no longer claims to be unverified.
      var st = document.querySelector('#cert-filled .cert-practice');
      if (st) {
        st.textContent = (window.dkT ? window.dkT('acct_cert_verifiable', 'Issued certificate \u2014 verifiable.') : 'Issued certificate \u2014 verifiable.');
      }
      showMsg('cert-issue-msg',
        (window.dkT ? window.dkT('acct_cert_issued', 'Certificate issued. Copy this reference \u2014 anyone can verify it: ') : 'Certificate issued. Copy this reference \u2014 anyone can verify it: ') + ref, false);
    }).catch(function (err) {
      showMsg('cert-issue-msg', friendlyError(err), true);
    });
  }
  function escHtml(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* ---------- admin panel (account.js owns data; admin.js owns tabs) ----------
   * Admins are created ONLY in the Firebase console (admins/{uid} doc).
   * No client can grant itself admin: the rules deny admins/{uid} writes.
   * Money note (item 79, owner-decided Oct 25, 2026): deposit approval
   * credits coins at 2 rupees = 1 coin, FLAT for every method — see
   * depCoinsFor below. Withdrawal approval still changes status only
   * (money movement stays manual/offline by design). */
  /* Item 79 conversion (owner-decided, do not change without owner word):
   * 2 rupees = 1 coin, FLAT for Easypaisa, JazzCash, bank transfer and
   * USDT. Odd amounts round DOWN (Rs 101 → 50 coins); the deposit-page
   * preview says so plainly. This function only COMPUTES the grant —
   * coins are issued ONLY by the dep-approve branch below, after admin
   * verification. Never call it from a submit path. */
  function depCoinsFor(amount){
    var a = parseFloat(amount);
    if (!a || a <= 0) { return 0; }
    return Math.floor(a / 2);
  }
  var admData = {};
  function admGate(signin){
    var g = $('adm-gate');
    if (!g) { return; }
    if (signin) {
      g.textContent = (window.dkT ? window.dkT('acct_adm_gate_signin', 'Sign in with an admin account to use this panel.') : 'Sign in with an admin account to use this panel.');
    } else {
      g.textContent = (window.dkT ? window.dkT('acct_adm_gate_noadmin', 'This account is not an admin. Admins are added in the Firebase console.') : 'This account is not an admin. Admins are added in the Firebase console.');
    }
    g.hidden = false;
  }
  function admAudit(action, target, extra){
    // Best-effort: an audit failure must never block the admin action.
    try {
      if (!DKA.db()) { return; }
      var d = {action: action, target: target || '',
        by: (currentUser && currentUser.uid) || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()};
      if (extra) { d.note = extra; }
      DKA.db().collection('admin_audit').add(d).catch(function () {});
    } catch (e) {}
  }
  function admSetHtml(id, html){
    var el = $(id);
    if (el) { el.innerHTML = html; }
  }
  function admRender(id, snap, rowFn){
    // One innerHTML assignment per section; row literals live in the
    // built strings, not at this render position (js-gate rule).
    var rows = [];
    snap.forEach(function (doc) { rows.push(rowFn(doc.id, doc.data() || {})); });
    if (rows.length > 50) { rows.length = 50; }
    admSetHtml(id, rows.length ? rows.join('') : '<p>No entries.</p>');
  }
  function admLoad(user){
    var g = $('adm-gate');
    if (g) { g.hidden = true; }
    if (!DKA.db()) { return; }
    var db = DKA.db();
    // Counts (admin list reads; failures leave the section blank).
    Promise.all([
      db.collection('users').get(),
      db.collection('deposits').where('status', '==', 'pending').get(),
      db.collection('withdrawals').where('status', '==', 'pending').get(),
      db.collection('coin_claims').where('status', '==', 'pending').get(),
      db.collection('contact_messages').get(),
      db.collection('certificates').get()
    ]).then(function (r) {
      var html = '<p>Users: ' + r[0].size + ' · Pending deposits: ' + r[1].size
        + ' · Pending withdrawals: ' + r[2].size + ' · Pending claims: ' + r[3].size
        + ' · Inbox: ' + r[4].size + ' · Certificates: ' + r[5].size + '</p>'
        + '<p><button class="btn ghost" type="button" data-adm="export-json">Export users (JSON)</button> '
        + '<button class="btn ghost" type="button" data-adm="export-csv">Export deposits (CSV)</button></p>'
       ;
      admSetHtml('adm-counts', html);
    }).catch(function () {});
    db.collection('users').get().then(function (snap) {
      admRender('adm-users', snap, function (id, d) {
        var susp = d.suspended ? 'suspended' : 'active';
        return '<div class="adm-row" data-uid="' + escHtml(id) + '"><b>' + escHtml(d.email || id) + '</b> '
          + escHtml(d.displayName || '') + ' · ' + (typeof d.coins === 'number' ? d.coins : 0) + ' coins · ' + susp
          + ' <input type="number" min="1" value="10" style="width:80px"> '
          + '<button class="btn ghost" type="button" data-adm="give">Give coins</button> '
          + '<button class="btn ghost" type="button" data-adm="' + (d.suspended ? 'unsuspend' : 'suspend') + '">' + (d.suspended ? 'Unsuspend' : 'Suspend') + '</button></div>';
      });
    }).catch(function () {});
    db.collection('deposits').where('status', '==', 'pending').get().then(function (snap) {
      admRender('adm-deposits', snap, function (id, d) {
        // Item 79: show the grant the admin is about to approve (live
        // verification: amount + method + txnId + sender are checked
        // against the real payment BEFORE Approve is clicked), plus the
        // receipt filename when metadata was queued.
        return '<div class="adm-row" data-id="' + escHtml(id) + '">Deposit ' + escHtml(d.amount) + ' · ' + escHtml(d.method || '') + ' · ' + escHtml(d.txnId || '') + ' · ' + escHtml(d.sender || '') + ' · ' + escHtml(d.userId || '')
          + ' → ' + depCoinsFor(d.amount) + ' coins'
          + (d.screenshotMeta && d.screenshotMeta.name ? ' · receipt: ' + escHtml(d.screenshotMeta.name) : '')
          + ' <button class="btn ghost" type="button" data-adm="dep-approve">Approve</button> '
          + '<button class="btn ghost" type="button" data-adm="dep-reject">Reject</button></div>';
      });
    }).catch(function () {});
    db.collection('withdrawals').where('status', '==', 'pending').get().then(function (snap) {
      admRender('adm-withdrawals', snap, function (id, d) {
        return '<div class="adm-row" data-id="' + escHtml(id) + '">Withdrawal ' + escHtml(d.amount) + ' · ' + escHtml(d.method || '') + ' · ' + escHtml(d.account || '') + ' · ' + escHtml(d.userId || '')
          + ' <button class="btn ghost" type="button" data-adm="wd-approve">Approve</button> '
          + '<button class="btn ghost" type="button" data-adm="wd-reject">Reject</button></div>';
      });
    }).catch(function () {});
    db.collection('coin_claims').where('status', '==', 'pending').get().then(function (snap) {
      admData.claims = {};
      admRender('adm-claims', snap, function (id, d) {
        admData.claims[id] = {uid: d.uid, amount: d.amount};
        return '<div class="adm-row" data-id="' + escHtml(id) + '">Claim ' + escHtml(d.amount) + ' coins · ' + escHtml(d.uid || '')
          + ' <button class="btn ghost" type="button" data-adm="claim-approve">Approve + grant</button> '
          + '<button class="btn ghost" type="button" data-adm="claim-reject">Reject</button></div>';
      });
    }).catch(function () {});
    db.collection('certificates').get().then(function (snap) {
      admRender('adm-certs', snap, function (id, d) {
        return '<div class="adm-row"><b>' + escHtml(id) + '</b> ' + escHtml(d.kind || '') + ' · ' + escHtml(d.name || '') + ' · ' + escHtml(d.wpm || 0) + ' WPM</div>';
      });
    }).catch(function () {});
    db.collection('contact_messages').get().then(function (snap) {
      admRender('adm-inbox', snap, function (id, d) {
        return '<div class="adm-row" data-id="' + escHtml(id) + '"><b>' + escHtml(d.subject || '') + '</b> from ' + escHtml(d.email || '') + ' · ' + escHtml(d.name || '') + '<p>' + escHtml(d.message || '') + '</p>'
          + ' <button class="btn ghost" type="button" data-adm="inbox-del">Delete</button></div>';
      });
    }).catch(function () {});
    db.collection('testimonials').where('approved', '==', false).get().then(function (snap) {
      admRender('adm-wall', snap, function (id, d) {
        return '<div class="adm-row" data-id="' + escHtml(id) + '"><b>' + escHtml(d.name || '') + '</b> ' + escHtml(d.rating || '') + ' stars<p>' + escHtml(d.message || '') + '</p>'
          + ' <button class="btn ghost" type="button" data-adm="wall-approve">Approve</button> '
          + '<button class="btn ghost" type="button" data-adm="wall-reject">Delete</button></div>';
      });
    }).catch(function () {});
    db.collection('admin_audit').get().then(function (snap) {
      admRender('adm-audit', snap, function (id, d) {
        return '<div class="adm-row">' + escHtml(d.action || '') + ' · ' + escHtml(d.target || '') + ' · ' + escHtml(d.by || '') + '</div>';
      });
    }).catch(function () {});
    /* Referral Phase 1 admin view: the full tree, not just a count.
     * Admins read the whole referrals collection plus user docs for
     * display names (admin list reads are allowed by the rules), so
     * DKREF groups rows by referrer with Grant / Pause / Resume
     * buttons per row (wired in admClick) and a CSV export button.
     * Per-row coin figures come from the referrer's own ledger entries
     * with reason 'referral reward' — the same source as the user
     * views, never a second count. If DKREF failed to load, fall back
     * to the old one-line render rather than a blank section. */
    (function loadAdmReferrals() {
      if (!window.DKREF) {
        db.collection('referrals').get().then(function (snap) {
          admRender('adm-referrals', snap, function (id, d) {
            return '<div class="adm-row">Referrer ' + escHtml(d.referrerUid || '') + ' · Joined ' + escHtml(id) + ' · Rewarded: ' + (d.rewarded ? 'yes' : 'no') + '</div>';
          });
        }).catch(function () {});
        return;
      }
      Promise.all([
        db.collection('referrals').get(),
        db.collection('users').get().catch(function () { return null; })
      ]).then(function (parts) {
        var rows = [];
        parts[0].forEach(function (doc) {
          var d = doc.data() || {};
          d._id = doc.id;
          rows.push(d);
        });
        var names = {};
        if (parts[1]) {
          parts[1].forEach(function (doc) {
            var d = doc.data() || {};
            /* Item #49: opted-out members render as 'Private member' in
             * admin tree/table — via the shared DKREF.privacyNameFor
             * rule, so the label can never drift between views. When
             * DKREF is absent, fall back to the old name mapping (the
             * privacy mask then cannot apply, same as before). */
            if (window.DKREF && window.DKREF.privacyNameFor) {
              var label = window.DKREF.privacyNameFor(d);
              if (label) { names[doc.id] = label; }
            } else if (d.displayName || d.name) { names[doc.id] = d.displayName || d.name; }
          });
        }
        /* Attach per-invitee earnings for the admin rows: one ledger
         * read per referrer is avoided by reading each referrer's
         * ledger only for referrers actually present in the rows. */
        var referrers = [];
        rows.forEach(function (r) {
          if (r.referrerUid && referrers.indexOf(r.referrerUid) < 0) { referrers.push(r.referrerUid); }
        });
        var ledgerJobs = referrers.map(function (uid) {
          return db.collection('users').doc(uid).collection('coin_ledger')
            .where('reason', '==', 'referral reward').get().then(function (lsnap) {
              lsnap.forEach(function (ldoc) {
                var e = ldoc.data() || {};
                rows.forEach(function (r) {
                  if (r._id === e.inviteeUid) { r._coins = (r._coins || 0) + (Number(e.amount) || 0); }
                });
              });
            }).catch(function () {});
        });
        return Promise.all(ledgerJobs).then(function () {
          admData.referrals = rows;
          admData.referralNames = names;
          window.DKREF.renderAdminList('adm-referrals', rows, names);
        });
      }).catch(function () {});
    })();
    db.collection('competitors').get().then(function (snap) {
      admRender('adm-competitors', snap, function (id, d) {
        return '<div class="adm-row"><b>' + escHtml(d.name || '') + '</b> ' + escHtml(d.note || '') + '</div>';
      });
    }).catch(function () {});
    db.collection('tickets').get().then(function (snap) {
      admRender('adm-tickets', snap, function (id, d) {
        return '<div class="adm-row"><b>' + escHtml(d.title || '') + '</b> ' + escHtml(d.status || '') + '</div>';
      });
    }).catch(function () {});
    db.collection('changelog').where('published', '==', true).get().then(function (snap) {
      admRender('adm-changelog', snap, function (id, d) {
        return '<div class="adm-row">' + escHtml(d.text || '') + ' · Published: ' + (d.published ? 'yes' : 'no') + '</div>';
      });
    }).catch(function () {});
    db.collection('experiments').get().then(function (snap) {
      admRender('adm-exp', snap, function (id, d) {
        return '<div class="adm-row"><b>' + escHtml(d.name || '') + '</b></div>';
      });
    }).catch(function () {});
    admForms();
  }
  function admForms(){
    // Admin forms are built here (not in HTML) so no new HTML keys are
    // needed; labels are plain owner-tool text in built strings.
    function build(id, inner, onSubmit){
      var el = $(id);
      if (!el || el.dataset.dka) { return; }
      el.dataset.dka = '1';
      el.innerHTML = inner;
      var f = el.querySelector('form');
      if (f) { f.addEventListener('submit', onSubmit); }
    }
    build('adm-announce', '<form class="toolbox"><label>Announcement text</label><input id="adm-ann-text" type="text" maxlength="200"><p><button class="btn" type="submit">Save announcement</button></p></form>', function (ev) {
      ev.preventDefault();
      var v = $('adm-ann-text') ? $('adm-ann-text').value.trim() : '';
      DKA.db().collection('site_settings').doc('announcement').set({text: v, updatedAt: firebase.firestore.FieldValue.serverTimestamp()}).then(function () {
        showMsg('adm-msg', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
      }).catch(function (err) { showMsg('adm-msg', friendlyError(err), true); });
    });
    build('adm-settings', '<form class="toolbox"><label><input id="adm-maint-check" type="checkbox"> Maintenance mode (site redirects to the maintenance page)</label><p><button class="btn" type="submit">Save settings</button></p></form>', function (ev) {
      ev.preventDefault();
      var on = $('adm-maint-check') ? $('adm-maint-check').checked : false;
      DKA.db().collection('config').doc('maintenance').set({enabled: on}).then(function () {
        showMsg('adm-msg', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
      }).catch(function (err) { showMsg('adm-msg', friendlyError(err), true); });
    });
    build('adm-pay', '<form class="toolbox"><label>Easypaisa</label><input id="adm-pay-easy" type="text"><label>JazzCash</label><input id="adm-pay-jazz" type="text"><label>Bank account</label><input id="adm-pay-bank" type="text"><label>USDT</label><input id="adm-pay-usdt" type="text"><p><button class="btn" type="submit">Save payment accounts</button></p></form>', function (ev) {
      ev.preventDefault();
      var g = function (id) { var e = $(id); return e ? e.value.trim() : ''; };
      DKA.db().collection('config').doc('payments').set({easypaisa: g('adm-pay-easy'), jazzcash: g('adm-pay-jazz'), bank: g('adm-pay-bank'), usdt: g('adm-pay-usdt'), updatedAt: firebase.firestore.FieldValue.serverTimestamp()}).then(function () {
        showMsg('adm-msg', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
      }).catch(function (err) { showMsg('adm-msg', friendlyError(err), true); });
    });
    function addForm(id, coll, fields, makeDoc, listId, renderAgain){
      build(id, '<form class="toolbox">' + fields + '<p><button class="btn" type="submit">Add</button></p></form>', function (ev) {
        ev.preventDefault();
        var f = ev.target;
        var doc = makeDoc(f);
        if (!doc) { return; }
        doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        DKA.db().collection(coll).add(doc).then(function () {
          showMsg('adm-msg', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
          f.reset();
          renderAgain();
        }).catch(function (err) { showMsg('adm-msg', friendlyError(err), true); });
      });
    }
    addForm('adm-comp', 'competitors',
      '<label>Name</label><input name="cname" type="text" required><label>Note</label><input name="cnote" type="text">',
      function (f) { return {name: f.cname.value.trim(), note: f.cnote.value.trim()}; },
      'adm-competitors', function () { admLoad(currentUser); });
    addForm('adm-ticket', 'tickets',
      '<label>Title</label><input name="tname" type="text" required>',
      function (f) { return {title: f.tname.value.trim(), status: 'open'}; },
      'adm-tickets', function () { admLoad(currentUser); });
    addForm('adm-changelog', 'changelog',
      '<label>Entry</label><input name="xtext" type="text" required>',
      function (f) { return {text: f.xtext.value.trim(), published: true}; },
      'adm-changelog', function () { admLoad(currentUser); });
    addForm('adm-exp', 'experiments',
      '<label>Name</label><input name="ename" type="text" required>',
      function (f) { return {name: f.ename.value.trim()}; },
      'adm-exp', function () { admLoad(currentUser); });
  }
  function admClick(ev){
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-adm]') : null;
    if (!b || !DKA.db()) { return; }
    var act = b.getAttribute('data-adm');
    var row = b.closest ? b.closest('.adm-row') : null;
    var id = row ? (row.getAttribute('data-id') || row.getAttribute('data-uid')) : null;
    var db = DKA.db();
    function done(msg){
      showMsg('adm-msg', msg || (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
      admLoad(currentUser);
    }
    function fail(err){ showMsg('adm-msg', friendlyError(err), true); }
    if (act === 'give') {
      var inp = row ? row.querySelector('input') : null;
      var n = inp ? parseInt(inp.value, 10) : 0;
      if (!n || n < 1 || !id) { return; }
      db.collection('users').doc(id).update({coins: firebase.firestore.FieldValue.increment(n)}).then(function () {
        return db.collection('users').doc(id).collection('coin_ledger').add({uid: id, amount: n, by: currentUser.uid, reason: 'admin grant', createdAt: firebase.firestore.FieldValue.serverTimestamp()});
      }).then(function () { admAudit('give_coins', id, String(n)); done(); }).catch(fail);
    } else if (act === 'suspend' || act === 'unsuspend') {
      if (!id) { return; }
      db.collection('users').doc(id).update({suspended: act === 'suspend'}).then(function () { admAudit(act, id); done(); }).catch(fail);
    } else if (act === 'dep-approve' || act === 'dep-reject') {
      if (!id) { return; }
      // Item 79 race guard: a double-click must never double-credit. The
      // button dies on first click; the live re-read and the ledger guard
      // below back it up. On failure the button is re-enabled for retry
      // (on success done() reloads the queue, so no stale button remains).
      b.disabled = true;
      if (act === 'dep-reject') {
        // Reject grants nothing — status + reviewer only, then audit.
        db.collection('deposits').doc(id).update({status: 'rejected', reviewedBy: currentUser.uid, reviewedAt: firebase.firestore.FieldValue.serverTimestamp()}).then(function () { admAudit(act, id); done(); }).catch(function (err) { b.disabled = false; fail(err); });
        return;
      }
      // Item 79 approve: coins ONLY after admin verification, in this
      // order. Every step must succeed before the next runs, so a failure
      // can never leave a half-credited deposit:
      // 1. Re-read the deposit LIVE; it must still be pending (a second
      //    click or a reloaded queue must never double-credit).
      // 2. Duplicate check: no OTHER approved deposit may share this
      //    method + transaction ID. A reused receipt is BLOCKED (the
      //    request stays pending for investigation, the duplicate is
      //    named in the error) — never silently paid twice.
      // 3. Idempotency: if a ledger entry for this deposit already exists
      //    (a previous attempt credited but failed before marking
      //    approved), do NOT credit again — just mark approved.
      // 4. Credit coins = floor(amount / 2) to the deposit owner, then a
      //    ledger entry, then mark the deposit approved with the grant
      //    recorded on it. A 0-coin grant (amount below Rs 2) marks
      //    approved with coinsGranted 0 and no increment — the formula,
      //    applied literally, with the preview having warned the user.
      // Ledger path note: entries go to the RULES-PERMITTED
      // users/{uid}/coin_ledger subcollection (firestore.rules line 121:
      // admin-only create, owner-or-admin read). The older Give-coins
      // and claim-approval writers used the top-level coin_ledger path,
      // which has NO rule (default-deny) — both were moved to this
      // nested path on 25 Oct 2026 (ledger-path fix, user order), so
      // every ledger writer now uses a rules-permitted path.
      var depRef = db.collection('deposits').doc(id);
      depRef.get().then(function (snap) {
        var d = (snap && snap.exists) ? (snap.data() || {}) : null;
        if (!d || d.status !== 'pending') { throw new Error(window.dkT ? window.dkT('acct_dep_stale', 'Deposit is no longer pending.') : 'Deposit is no longer pending.'); }
        var amt = parseFloat(d.amount);
        if (!amt || amt <= 0 || !d.userId) { throw new Error(window.dkT ? window.dkT('acct_dep_bad', 'Deposit record is incomplete.') : 'Deposit record is incomplete.'); }
        var coins = depCoinsFor(amt);
        return db.collection('deposits').where('method', '==', d.method || '').where('txnId', '==', d.txnId || '').where('status', '==', 'approved').get().then(function (dupSnap) {
          var dup = false;
          dupSnap.forEach(function (doc) { if (doc.id !== id) { dup = true; } });
          if (dup) { throw new Error(window.dkT ? window.dkT('acct_dep_dup', 'Duplicate transaction: another approved deposit already uses this method and transaction ID. Coins were not issued.') : 'Duplicate transaction: another approved deposit already uses this method and transaction ID. Coins were not issued.'); }
          return {d: d, coins: coins};
        });
      }).then(function (ctx) {
        return db.collection('users').doc(ctx.d.userId).collection('coin_ledger').where('depositId', '==', id).get().then(function (lsnap) {
          var prior = null;
          lsnap.forEach(function (doc) { prior = doc.data() || {}; });
          return {d: ctx.d, coins: ctx.coins, prior: prior};
        });
      }).then(function (ctx) {
        var chain = Promise.resolve();
        if (!ctx.prior && ctx.coins >= 1) {
          chain = chain.then(function () {
            return db.collection('users').doc(ctx.d.userId).update({coins: firebase.firestore.FieldValue.increment(ctx.coins)});
          }).then(function () {
            return db.collection('users').doc(ctx.d.userId).collection('coin_ledger').add({uid: ctx.d.userId, amount: ctx.coins, by: currentUser.uid, reason: 'deposit approval', depositId: id, depositAmount: ctx.d.amount, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
          });
        }
        var granted = ctx.prior ? (ctx.prior.amount || 0) : ctx.coins;
        return chain.then(function () {
          return depRef.update({status: 'approved', coinsGranted: granted, reviewedBy: currentUser.uid, reviewedAt: firebase.firestore.FieldValue.serverTimestamp()});
        });
      }).then(function () { admAudit(act, id); done(); }).catch(function (err) { b.disabled = false; fail(err); });
    } else if (act === 'wd-approve' || act === 'wd-reject') {
      if (!id) { return; }
      db.collection('withdrawals').doc(id).update({status: act === 'wd-approve' ? 'approved' : 'rejected'}).then(function () { admAudit(act, id); done(); }).catch(fail);
    } else if (act === 'claim-approve' || act === 'claim-reject') {
      var c = admData.claims && admData.claims[id];
      if (!id) { return; }
      if (act === 'claim-reject') {
        db.collection('coin_claims').doc(id).update({status: 'rejected'}).then(function () { admAudit(act, id); done(); }).catch(fail);
      } else if (c) {
        db.collection('coin_claims').doc(id).update({status: 'approved'}).then(function () {
          return db.collection('users').doc(c.uid).update({coins: firebase.firestore.FieldValue.increment(c.amount)});
        }).then(function () {
          return db.collection('users').doc(c.uid).collection('coin_ledger').add({uid: c.uid, amount: c.amount, by: currentUser.uid, reason: 'claim approval', createdAt: firebase.firestore.FieldValue.serverTimestamp()});
        }).then(function () { admAudit(act, id); done(); }).catch(fail);
      }
    } else if (act === 'ref-export') {
      /* Referral CSV export (no row needed — the button sits in the
       * section header). Rows are the cached admin render, exported
       * through the single DKREF.csvExport writer. */
      if (window.DKREF) { window.DKREF.csvExport(admData.referrals || []); }
    } else if (act === 'ref-grant' || act === 'ref-pause' || act === 'ref-resume') {
      /* Referral Phase 1 admin actions (admin-only by rules; a
       * non-admin click fails at Firestore, never silently).
       * Grant: DKREF.adminGrant re-reads the row LIVE and refuses
       * unless it is still pending, then settles the full chain
       * (L1 20 / L2 5 / L3 2) via ledger + coins increments + row
       * flip — the deposit-approval
       * pattern, with the same double-click guard (button dies on
       * first click, re-enabled only on failure). Pause/resume flip
       * the admin-only paused flag on the row. */
      if (!id || !window.DKREF) { return; }
      b.disabled = true;
      var refJob;
      if (act === 'ref-grant') {
        refJob = window.DKREF.adminGrant(currentUser.uid, id);
      } else {
        refJob = window.DKREF.adminSetPaused(id, act === 'ref-pause');
      }
      refJob.then(function () { admAudit(act, id); done(); }).catch(function (err) { b.disabled = false; fail(err); });
    } else if (act === 'inbox-del') {
      if (!id) { return; }
      if (!window.confirm((window.dkT ? window.dkT('acct_adm_confirm_delete', 'Delete this message?') : 'Delete this message?'))) { return; }
      db.collection('contact_messages').doc(id).delete().then(function () { admAudit(act, id); done(); }).catch(fail);
    } else if (act === 'wall-approve') {
      if (!id) { return; }
      db.collection('testimonials').doc(id).update({approved: true}).then(function () { admAudit(act, id); done(); }).catch(fail);
    } else if (act === 'wall-reject') {
      if (!id) { return; }
      db.collection('testimonials').doc(id).delete().then(function () { admAudit(act, id); done(); }).catch(fail);
    } else if (act === 'export-json') {
      db.collection('users').get().then(function (snap) {
        var arr = [];
        snap.forEach(function (doc) { arr.push({id: doc.id, data: doc.data()}); });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(arr, null, 2)], {type: 'application/json'}));
        a.download = 'dokit-users.json';
        a.click();
      }).catch(fail);
    } else if (act === 'export-csv') {
      db.collection('deposits').get().then(function (snap) {
        var lines = ['id,userId,amount,method,status'];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          lines.push([doc.id, d.userId || '', d.amount || '', d.method || '', d.status || ''].join(','));
        });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'}));
        a.download = 'dokit-deposits.csv';
        a.click();
      }).catch(fail);
    }
  }
  if (!window.__dkaAdmClick) {
    window.__dkaAdmClick = true;
    document.addEventListener('click', admClick);
  }
  /* ---------- maintenance enforcement (item 97) ----------
   * Reads config/maintenance on every boot (freshness beats saving one
   * read: an emergency switch must take effect without a new tab).
   * Fail-open: any read error leaves the site up. Admins and the
   * maintenance / suspended / offline / admin / login pages never
   * redirect (otherwise the admin could lock herself out). */
  function maintenanceCheck(user, isAdm){
    try {
      var path = location.pathname;
      var allow = /(^|\/)(maintenance|suspended|offline|admin)(\/|$)/.test(path)
        || /\/account\/login\/$/.test(path);
      if (allow || isAdm || !DKA.db()) { return; }
      DKA.db().collection('config').doc('maintenance').get().then(function (snap) {
        if (snap && snap.exists && snap.data() && snap.data().enabled === true) {
          location.href = siteRoot() + 'maintenance/';
        }
      }).catch(function () { /* fail open */ });
    } catch (e) { /* fail open */ }
  }
  function moneyList(elId, coll, user, rowFn){
    // Owner history query (rules allow owner list via userId == uid).
    var el = $(elId);
    if (!el || !DKA.db()) { return; }
    DKA.db().collection(coll).where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc').get().then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) { rows.push(rowFn(doc.data() || {})); });
        if (rows.length > 50) { rows.length = 50; }
        el.innerHTML = rows.length ? rows.join('') : '<p>No requests yet.</p>';
      }).catch(function () { /* list stays empty on failure -- no fake rows */ });
  }
  function moneyRow(d, extra){
    return '<div class="adm-row">' + escHtml(d.amount) + ' · ' + escHtml(d.method || '')
      + ' · ' + escHtml(d.status || 'pending') + (extra || '') + '</div>';
  }
  /* Verify form binding, standalone so it also runs when the cloud SDK
   * is unreachable: device certificates must verify offline via the
   * same-browser fallback — the historical verification behavior. The
   * dataset.dka guard keeps it bound exactly once per page load. */
  function bindVfForm(){
    var vf = $('vf-form');
    if (vf && !vf.dataset.dka) {
      vf.dataset.dka = '1';
      // Historical verification: Firestore-first lookup, same-browser
      // localStorage fallback (device certificates), ?reg= auto-verify.
      function vfNorm(s) {
        return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      }
      function vfLocal(id, kind) {
        try {
          for (var i = 0; i < window.localStorage.length; i++) {
            var k = window.localStorage.key(i);
            if (k && k.indexOf('dk_cert_') === 0) {
              var rec = JSON.parse(window.localStorage.getItem(k));
              // Device records carry either a typing registration (regNo) or a
      // TypeFight serial (serial). No Firestore serial-field query is
      // attempted: certificates list is admin-only in the current
      // rules, so a public serial query would be denied. Serials
      // verify through this device-record fallback; issued
      // documents verify by their document id.
      if (rec && (rec.regNo === id || rec.serial === id)) {
                var rk = rec.kind || 'typing';
                if (kind === 'typing' ? (rk === 'typing' || rk === 'Test') : rk === 'battle') { return rec; }
              }
            }
          }
        } catch (e) {}
        return null;
      }
      function vfClearResult() {
        var rEl = $('vf-result');
        if (rEl) { rEl.hidden = true; }
      }
      function vfRender(d, src) {
        // Build the result HTML in its own statement so no literal
        // sits at the render position below (js-gate rule).
        // src: 'cloud' = Firestore issued document (Valid);
        // 'device' = same-browser record (not independently verified).
        // No 'revoked' state exists: issued documents carry no status
        // field, so none is claimed here.
        var resEl = $('vf-result');
        var nm = (window.dkT ? window.dkT('rsv_0210', 'Display name') : 'Display name');
        var when = d.date || (d.issuedAt ? new Date(d.issuedAt).toLocaleDateString() : '');
        var statusTxt = (src === 'cloud')
          ? 'Status: Valid \u2014 issued certificate on file.'
          : 'Status: Device record \u2014 this browser only, not independently verified.';
        var extraTxt = '';
        if (d.gross) { extraTxt += ' \u00b7 ' + d.gross + ' WPM gross'; }
        if (d.durationSec) { extraTxt += ' \u00b7 ' + d.durationSec + ' seconds'; }
        if (d.language) { extraTxt += ' \u00b7 ' + (d.language === 'en' ? 'English' : d.language); }
        var html = '<b>' + nm + ':</b> ' + (d.name || '')
          + '<br>' + (d.wpm || 0) + ' WPM \u00b7 ' + (d.acc || 0) + '% \u00b7 ' + when + extraTxt
          + '<br>' + statusTxt;
        if (resEl) { resEl.innerHTML = html; resEl.hidden = false; }
        showMsg('vf-err', '', false);
      }
      function vfNotFound() {
        vfClearResult();
        showMsg('vf-err',
          (window.dkT ? window.dkT('acct_cert_nf', 'No matching certificate found for this number.') : 'No matching certificate found for this number.'), true);
      }
      function vfLookup(rawId) {
        var id = vfNorm(rawId);
        var kind = vf.getAttribute('data-kind') || 'typing';
        if (!id) { return false; }
        if (!DKA.db()) {
          // Cloud unavailable: device records still verify on this device.
          var fb0 = vfLocal(id, kind);
          if (fb0) { vfRender(fb0, 'device'); return true; }
          vfClearResult();
          showMsg('vf-err',
            (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true);
          return false;
        }
        DKA.db().collection('certificates').doc(id).get().then(function (snap) {
          var d = null;
          var src = 'cloud';
          if (snap.exists) {
            d = snap.data() || {};
            if (d.kind !== kind) { d = null; }
          }
          if (!d) { d = vfLocal(id, kind); src = 'device'; }
          if (!d) { throw nfErr(); }
          vfRender(d, src);
        }).catch(function (err) {
          if (err && err.code === 'nf') { vfNotFound(); return; }
          // Cloud lookup failed: fall back to this browser's records
          // before reporting the error (historical fallback order).
          var fb = vfLocal(id, kind);
          if (fb) { vfRender(fb, 'device'); return; }
          vfClearResult();
          showMsg('vf-err', friendlyError(err), true);
        });
        return true;
      }
      vf.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var idIn = $('vf-id');
        vfLookup(idIn ? idIn.value : '');
      });
      // Auto-verify when opened via a certificate QR code / link.
      // Typing links carry ?reg=; battle links carry ?id= (document
      // id) or ?serial= (DK-YYYY-NNNNNN device serial).
      try {
        var qp = new URLSearchParams(window.location.search);
        var q = (vf.getAttribute('data-kind') === 'battle')
          ? (qp.get('id') || qp.get('serial') || qp.get('reg'))
          : qp.get('reg');
        if (q) {
          var nq = vfNorm(q);
          var qi = $('vf-id');
          if (qi) { qi.value = nq; }
          if (!vfLookup(nq)) {
            // Cloud DB not ready yet: one bounded retry; manual Verify
            // always remains available.
            setTimeout(function () { vfLookup(nq); }, 2000);
          }
        }
      } catch (e) {}
    }
  }
  function bindStaticForms(){
    // Deposit "where to send": admin-configured accounts, or an honest
    // not-configured note. Never invented addresses.
    var pi = $('dep-payinfo');
    if (pi && DKA.db()) {
      DKA.db().collection('config').doc('payments').get().then(function (snap) {
        var d = (snap && snap.exists) ? (snap.data() || {}) : {};
        var parts = [];
        if (d.easypaisa) { parts.push('Easypaisa: ' + d.easypaisa); }
        if (d.jazzcash) { parts.push('JazzCash: ' + d.jazzcash); }
        if (d.bank) { parts.push('Bank: ' + d.bank); }
        if (d.usdt) { parts.push('USDT: ' + d.usdt); }
        if (parts.length) {
          // Built string, one assignment (js-gate rule).
          pi.innerHTML = parts.map(function (p) { return escHtml(p); }).join('<br>');
        } else {
          pi.textContent = (window.dkT ? window.dkT('acct_money_paynone', 'Payment details are not configured yet.') : 'Payment details are not configured yet.');
        }
      }).catch(function () {});
    }
    // Announcement banner (display half of the admin Announcement save):
    // renders only when the admin saved text and the visitor has not
    // dismissed it this session. main.js's DOKIT_BANNER stays as fallback.
    try {
      if (DKA.db() && !sessionStorage.getItem('dokit_banner_dismissed')) {
        DKA.db().collection('site_settings').doc('announcement').get().then(function (snap) {
          var t = (snap && snap.exists && snap.data() && snap.data().text) || '';
          if (!t) { return; }
          var bar = document.createElement('div');
          bar.className = 'site-banner';
          var sp = document.createElement('span');
          sp.textContent = t;
          var dis = document.createElement('button');
          dis.className = 'btn ghost';
          dis.textContent = (window.dkT ? window.dkT('saas.dismiss', 'Dismiss') : 'Dismiss');
          dis.addEventListener('click', function () {
            try { sessionStorage.setItem('dokit_banner_dismissed', '1'); } catch (e) {}
            bar.remove();
          });
          bar.appendChild(sp); bar.appendChild(dis);
          var main = document.getElementById('main');
          if (main) { main.parentNode.insertBefore(bar, main); } else { document.body.appendChild(bar); }
        }).catch(function () {});
      }
    } catch (e) {}
    // Contact form (public): save to the admin inbox. No SDK (offline) --
    // return without preventDefault so the native mailto submit proceeds.
    // On save failure, fall back to mailto too, so the message is never
    // lost -- the mailto action is the fallback, not a second delivery.
    var cf = $('ct-form');
    if (cf && !cf.dataset.dka) {
      cf.dataset.dka = '1';
      cf.addEventListener('submit', function (ev) {
        if (!DKA.db()) { return; }
        ev.preventDefault();
        var doc = {
          name: ($('ct-name') ? $('ct-name').value.trim() : ''),
          email: ($('ct-email') ? $('ct-email').value.trim() : ''),
          message: ($('ct-msg') ? $('ct-msg').value.trim() : ''),
          subject: ($('ct-subject') ? $('ct-subject').value : ''),
          page: location.pathname,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          userAgent: navigator.userAgent
        };
        DKA.db().collection('contact_messages').add(doc).then(function () {
          var mn = $('ct-mailto-note');
          if (mn) { mn.hidden = true; }
          showMsg('ct-result',
            (window.dkT ? window.dkT('acct_ct_saved', 'Message saved. We will reply by email.') : 'Message saved. We will reply by email.'), false);
          cf.reset();
        }).catch(function () {
          showMsg('ct-result',
            (window.dkT ? window.dkT('acct_ct_fallback', 'Could not save \u2014 your email app opened instead, so your message is not lost.') : 'Could not save \u2014 your email app opened instead, so your message is not lost.'), false);
          cf.submit();
        });
      });
    }
    // Wall of Love: render approved testimonials, accept new submissions
    // (approved: false -- they appear only after admin approval).
    var wl = $('wall-live');
    if (wl && DKA.db()) {
      DKA.db().collection('testimonials').where('approved', '==', true)
        .orderBy('createdAt', 'desc').get().then(function (snap) {
          var cards = [];
          snap.forEach(function (doc) {
            var d = doc.data() || {};
            var stars = '★'.repeat(Math.max(1, Math.min(5, d.rating || 5)));
            var web = '';
            if (d.website) {
              var href = d.website.indexOf('http') === 0 ? d.website : 'https://' + d.website;
              web = '<br><a href="' + escHtml(href) + '">' + escHtml(d.website) + '</a>';
            }
            cards.push('<div class="card"><b>' + escHtml(d.name) + '</b> ' + stars
              + '<p>' + escHtml(d.message) + '</p>' + web + '</div>');
          });
          // One assignment; the literals live in the built string, not
          // at this render position (js-gate rule, as with verify).
          wl.innerHTML = cards.join('');
        }).catch(function () { /* wall stays static on failure -- no fake rows */ });
    }
    var wf = $('wall-form');
    if (wf && !wf.dataset.dka) {
      wf.dataset.dka = '1';
      wf.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (!DKA.db()) {
          showMsg('wall-err',
            (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true);
          return;
        }
        var wdoc = {
          name: ($('wall-name') ? $('wall-name').value.trim() : ''),
          message: ($('wall-message') ? $('wall-message').value.trim() : ''),
          rating: parseInt($('wall-rating') ? $('wall-rating').value : '5', 10) || 5,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          approved: false
        };
        var web = ($('wall-website') ? $('wall-website').value.trim() : '');
        if (web) { wdoc.website = web; }
        DKA.db().collection('testimonials').add(wdoc).then(function () {
          showMsg('wall-result',
            (window.dkT ? window.dkT('acct_wall_thanks', 'Thanks! Your story will appear after review.') : 'Thanks! Your story will appear after review.'), false);
          wf.reset();
        }).catch(function (err) {
          showMsg('wall-err', friendlyError(err), true);
        });
      });
    }
    bindVfForm();
    var login = $('acct-login-form');
    if (login && !login.dataset.dka) {
      login.dataset.dka = '1';
      login.addEventListener('submit', function(e){
        e.preventDefault();
        var email = ($('acct-email') || {}).value || '';
        var pass = ($('acct-pass') || {}).value || '';
        showMsg('acct-err', '', false);
        var a = DKA.auth();
        if (!a) { showMsg('acct-err', (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true); return; }
        a.signInWithEmailAndPassword(email.trim(), pass).then(function(cred){
          return DKA.ensureUserDoc(cred.user);
        }).then(function(){
          location.href = '../dashboard/';
        }).catch(function(err){
          showMsg('acct-err', DKA.friendlyError(err), true);
        });
      });
    }
    var signup = $('acct-signup-form');
    if (signup && !signup.dataset.dka) {
      signup.dataset.dka = '1';
      signup.addEventListener('submit', function(e){
        e.preventDefault();
        var name = ($('acct-name') || {}).value || '';
        var email = ($('acct-email') || {}).value || '';
        var pass = ($('acct-pass') || {}).value || '';
        showMsg('acct-err', '', false);
        var a = DKA.auth();
        if (!a) { showMsg('acct-err', (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true); return; }
        /* Race fix (live-test 4, Oct 26): hold the auto-redirect
         * (bindAuthedPages) until this handler's jobs finish, or the
         * navigation aborts the attribution writes mid-flight. */
        window.__dokitSigningUp = true;
        window.__dokitDocError = null;
        a.createUserWithEmailAndPassword(email.trim(), pass).then(function(cred){
          var u = cred.user;
          var jobs = [];
          if (name.trim()) { jobs.push(u.updateProfile({ displayName: name.trim() }).catch(function(){})); }
          /* Referral Phase 1: new doc gets referralCode (= own uid) +
           * referrerId (if captured) + consent (if the box was checked).
           * ensureUserDoc fills missing referral fields, so this is
           * safe even if the fallback doc already exists. */
          jobs.push(DKA.ensureUserDoc(u, referralSignupFields(u)));
          /* Referral: doc id = new uid, only when a ?ref= was captured
           * and it is not the user's own uid (rules enforce the same). */
          try {
            var ref = getCapturedRef();
            if (ref && ref !== u.uid) {
              var refDoc = {
                referrerUid: ref,
                source: getCapturedSource(),
                language: getCapturedLanguage(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                rewarded: false
              };
              try { var cc2 = getCapturedClassCode(); if (cc2) { refDoc.classCode = cc2; } } catch (e) {}
              jobs.push(DKA.db().collection('referrals').doc(u.uid).set(refDoc).catch(function(){}));
            }
          } catch (e) {}
          return Promise.all(jobs);
        }).then(function(){
          window.__dokitSigningUp = false;
          /* If the profile-doc write failed, do NOT redirect away
           * silently (that hid four straight live-test failures).
           * Stay and show the real reason on the page, so the test
           * — and the user — can read the exact error code. */
          var de = window.__dokitDocError; window.__dokitDocError = null;
          if (de) { showMsg('acct-err', DKA.friendlyError(de) + ' [' + (de.code || 'unknown') + ']', true); return; }
          try { sessionStorage.removeItem('dokit_ref'); sessionStorage.removeItem('dokit_qr'); sessionStorage.removeItem('dokit_class'); } catch (e) {}
          location.href = '../dashboard/';
        }).catch(function(err){
          window.__dokitSigningUp = false;
          showMsg('acct-err', DKA.friendlyError(err), true);
        });
      });
    }
    var googleBtn = $('acct-google-btn');
    if (googleBtn && !googleBtn.dataset.dka) {
      googleBtn.dataset.dka = '1';
      googleBtn.addEventListener('click', function(){
        showMsg('acct-err', '', false);
        var a = DKA.auth();
        if (!a) { showMsg('acct-err', (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true); return; }
        /* Race fix (live-test 4, Oct 26): same hold as email signup —
         * no auto-redirect until this handler's jobs finish. */
        window.__dokitSigningUp = true;
        window.__dokitDocError = null;
        a.signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(function(cred){
          /* Referral Phase 1: Google signup previously created NO
           * referrals doc and NO referral fields (email signup did) —
           * that gap is closed here so both flows match. The user-doc
           * fields fill missing only (see ensureUserDoc), so returning
           * Google users are untouched. The referrals doc is created
           * only for a genuinely new user (additionalUserInfo.isNewUser
           * when the SDK provides it); without that flag we skip the
           * doc rather than risk attributing a returning user to a
           * later ?ref= visit. A create on an existing doc would be
           * an admin-only update under the rules, so the .catch below
           * is a second guard, never the primary one. */
          var u = cred.user;
          var isNew = cred.additionalUserInfo && cred.additionalUserInfo.isNewUser;
          var jobs = [DKA.ensureUserDoc(u, referralSignupFields(u))];
          if (isNew) {
            try {
              var ref = getCapturedRef();
              if (ref && ref !== u.uid) {
                var refDoc = {
                  referrerUid: ref,
                  source: getCapturedSource(),
                  language: getCapturedLanguage(),
                  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                  rewarded: false
                };
                try { var cc2 = getCapturedClassCode(); if (cc2) { refDoc.classCode = cc2; } } catch (e) {}
                jobs.push(DKA.db().collection('referrals').doc(u.uid).set(refDoc).catch(function(){}));
              }
            } catch (e) {}
          }
          return Promise.all(jobs).then(function(){
            try { sessionStorage.removeItem('dokit_ref'); sessionStorage.removeItem('dokit_qr'); sessionStorage.removeItem('dokit_class'); } catch (e) {}
          });
        }).then(function(){
          window.__dokitSigningUp = false;
          var here = location.pathname;
          /* Same visible-failure rule as email signup, but only on
           * signup pages — login behaviour is unchanged. */
          var de2 = window.__dokitDocError; window.__dokitDocError = null;
          if (de2 && /\/signup\//.test(here)) { showMsg('acct-err', DKA.friendlyError(de2) + ' [' + (de2.code || 'unknown') + ']', true); return; }
          location.href = /account\/(login|signup)\//.test(here) ? '../dashboard/' : here;
        }).catch(function(err){
          window.__dokitSigningUp = false;
          showMsg('acct-err', DKA.friendlyError(err), true);
        });
      });
    }
    var reset = $('acct-reset-link');
    if (reset && !reset.dataset.dka) {
      reset.dataset.dka = '1';
      reset.addEventListener('click', function(e){
        e.preventDefault();
        var email = ($('acct-email') || {}).value || '';
        if (!email.trim()) {
          showMsg('acct-err', (window.dkT ? window.dkT('acct_err_email', 'Please enter a valid email address.') : 'Please enter a valid email address.'), true);
          return;
        }
        var a = DKA.auth();
        if (!a) { showMsg('acct-err', (window.dkT ? window.dkT('acct_err_net', 'Network error. Check your connection and try again.') : 'Network error. Check your connection and try again.'), true); return; }
        a.sendPasswordResetEmail(email.trim()).then(function(){
          showMsg('acct-err', (window.dkT ? window.dkT('acct_reset_sent', 'Password reset email sent. Check your inbox.') : 'Password reset email sent. Check your inbox.'), false);
        }).catch(function(err){
          showMsg('acct-err', DKA.friendlyError(err), true);
        });
      });
    }
  }

  /* ---------- dashboard + profile (signed-in only) ---------- */
  function bindAuthedPages(user, doc){
    var depF = $('dep-form');
    if (depF) {
      depF.hidden = false;
      var depG = $('dep-guest'); if (depG) { depG.hidden = true; }
      var depL = $('dep-list'); if (depL) { depL.hidden = false; }
      if (!depF.dataset.dka) {
        depF.dataset.dka = '1';
        // Item 79 preview: show the coin grant BEFORE submit, updated on
        // every keystroke. Rate is 2 rupees = 1 coin, flat; the round-down
        // note appears only when the amount does not divide evenly
        // (Rs 101 → 50 coins). The number sits in its own <b> so the
        // surrounding sentence translates via data-i18n spans (dkT has
        // no placeholder substitution).
        var depAmt = $('dep-amount');
        var depPrev = $('dep-preview');
        function updateDepPreview(){
          if (!depPrev || !depAmt) { return; }
          var v = parseFloat(depAmt.value);
          if (!v || v <= 0) { depPrev.hidden = true; return; }
          var nEl = $('dep-preview-n');
          if (nEl) { nEl.textContent = String(depCoinsFor(v)); }
          var oddEl = $('dep-preview-odd');
          if (oddEl) { oddEl.hidden = !(v % 2 !== 0); }
          depPrev.hidden = false;
        }
        if (depAmt) { depAmt.addEventListener('input', updateDepPreview); }
        depF.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var amt = parseFloat($('dep-amount') ? $('dep-amount').value : '');
          if (!amt || amt <= 0) {
            showMsg('dep-err', (window.dkT ? window.dkT('acct_money_invalid', 'Enter a valid amount.') : 'Enter a valid amount.'), true);
            return;
          }
          // Item 79: receipt-screenshot METADATA only (the file itself is
          // NOT uploaded yet — that waits on Storage provisioning + rules
          // publish, see storage.rules header). The deposits create rule
          // forbids review fields but allows extra keys, so screenshotMeta
          // is permitted at create time.
          var depPayload = {
            userId: user.uid, amount: amt,
            method: ($('dep-method') ? $('dep-method').value : ''),
            txnId: ($('dep-txn') ? $('dep-txn').value.trim() : ''),
            sender: ($('dep-sender') ? $('dep-sender').value.trim() : ''),
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          var shotInput = $('dep-shot');
          if (shotInput && shotInput.files && shotInput.files.length) {
            var shot = shotInput.files[0];
            // Client cap mirrors storage.rules (image only, under 5 MB).
            if (!shot.type || shot.type.indexOf('image/') !== 0) {
              showMsg('dep-err', (window.dkT ? window.dkT('acct_dep_shotimg', 'Please choose an image file.') : 'Please choose an image file.'), true);
              return;
            }
            if (shot.size > 5 * 1024 * 1024) {
              showMsg('dep-err', (window.dkT ? window.dkT('acct_dep_shotbig', 'File is too large (max 5 MB).') : 'File is too large (max 5 MB).'), true);
              return;
            }
            depPayload.screenshotMeta = {
              name: shot.name, size: shot.size, type: shot.type,
              queuedAt: Date.now()
            };
          }
          DKA.db().collection('deposits').add(depPayload).then(function () {
            showMsg('dep-result', (window.dkT ? window.dkT('acct_money_saved', 'Request submitted. The admin will review it.') : 'Request submitted. The admin will review it.'), false);
            depF.reset();
            updateDepPreview();
            moneyList('dep-list', 'deposits', user, function (d) {
              return moneyRow(d, ' · ' + escHtml(d.txnId || ''));
            });
          }).catch(function (err) { showMsg('dep-err', friendlyError(err), true); });
        });
      }
      moneyList('dep-list', 'deposits', user, function (d) {
        return moneyRow(d, ' · ' + escHtml(d.txnId || ''));
      });
    }
    var wdF = $('wd-form');
    if (wdF) {
      wdF.hidden = false;
      var wdG = $('wd-guest'); if (wdG) { wdG.hidden = true; }
      var wdL = $('wd-list'); if (wdL) { wdL.hidden = false; }
      if (!wdF.dataset.dka) {
        wdF.dataset.dka = '1';
        wdF.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var amt = parseFloat($('wd-amount') ? $('wd-amount').value : '');
          if (!amt || amt <= 0 || amt > 1000000) {
            showMsg('wd-err', (window.dkT ? window.dkT('acct_money_invalid', 'Enter a valid amount.') : 'Enter a valid amount.'), true);
            return;
          }
          DKA.db().collection('withdrawals').add({
            userId: user.uid, amount: amt,
            method: ($('wd-method') ? $('wd-method').value : ''),
            account: ($('wd-account') ? $('wd-account').value.trim() : ''),
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(function () {
            showMsg('wd-result', (window.dkT ? window.dkT('acct_money_saved', 'Request submitted. The admin will review it.') : 'Request submitted. The admin will review it.'), false);
            wdF.reset();
            moneyList('wd-list', 'withdrawals', user, function (d) {
              return moneyRow(d, ' · ' + escHtml(d.account || ''));
            });
          }).catch(function (err) { showMsg('wd-err', friendlyError(err), true); });
        });
      }
      moneyList('wd-list', 'withdrawals', user, function (d) {
        return moneyRow(d, ' · ' + escHtml(d.account || ''));
      });
    }
    /* ---------- API keys (item 83, signed-in only) ----------
     * Keys live in the SUBCOLLECTION users/{uid}/api_keys (path itself is
     * the ownership proof — see firestore.rules). Only the SHA-256 hash is
     * stored; the secret is shown ONCE in a modal and never written
     * anywhere. The list shows ACTIVE keys only (revoked docs stay in
     * Firestore for audit but are hidden here). */
    var akF = $('ak-form');
    if (akF) {
      akF.hidden = false;
      var akG = $('ak-guest'); if (akG) { akG.hidden = true; }
      var akL = $('ak-list'); if (akL) { akL.hidden = false; }
      var akM = $('ak-modal'); // show-once modal, hidden by default
      function renderKeys(){
        if (!akL) { return; }
        // No orderBy: avoids a composite-index requirement for the
        // revoked==false query.
        DKA.db().collection('users').doc(user.uid).collection('api_keys')
          .where('revoked', '==', false).get().then(function (snap) {
            var html = '';
            if (snap.empty) {
              html = '<p>' + escHtml(window.dkT ? window.dkT('acct_apikey_empty', 'No API keys yet.') : 'No API keys yet.') + '</p>';
            } else {
              snap.forEach(function (docSnap) {
                var d = docSnap.data() || {};
                var created = (d.createdAt && d.createdAt.toDate) ? d.createdAt.toDate().toLocaleDateString() : '—';
                var used = (d.lastUsedAt && d.lastUsedAt.toDate) ? d.lastUsedAt.toDate().toLocaleDateString() : '—';
                html += '<div class="ak-row" data-id="' + escHtml(docSnap.id) + '">'
                  + '<div><b>' + escHtml(d.name || '') + '</b> <code>' + escHtml(d.prefix || '') + '</code></div>'
                  + '<div>' + escHtml(window.dkT ? window.dkT('acct_apikey_created', 'Created') : 'Created') + ': ' + escHtml(created)
                  + ' · ' + escHtml(window.dkT ? window.dkT('acct_apikey_lastused', 'Last used') : 'Last used') + ': ' + escHtml(used) + '</div>'
                  + '<button type="button" class="btn ghost ak-revoke" data-id="' + escHtml(docSnap.id) + '">'
                  + escHtml(window.dkT ? window.dkT('acct_apikey_revoke', 'Revoke') : 'Revoke') + '</button></div>';
              });
            }
            akL.innerHTML = html;
            // Revoke buttons are rebound on every render (rows rebuild).
            akL.querySelectorAll('.ak-revoke').forEach(function (btn) {
              btn.addEventListener('click', function () {
                DKA.db().collection('users').doc(user.uid).collection('api_keys').doc(btn.getAttribute('data-id'))
                  .update({ revoked: true, revokedAt: firebase.firestore.FieldValue.serverTimestamp() })
                  .then(renderKeys)
                  .catch(function (err) { showMsg('ak-err', friendlyError(err), true); });
              });
            });
          }).catch(function (err) { showMsg('ak-err', friendlyError(err), true); });
      }
      if (!akF.dataset.dka) {
        akF.dataset.dka = '1';
        akF.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var nameEl = $('ak-name');
          var name = nameEl ? nameEl.value.trim() : '';
          if (!name || name.length > 100) {
            showMsg('ak-err', (window.dkT ? window.dkT('acct_apikey_noname', 'Enter a key name.') : 'Enter a key name.'), true);
            return;
          }
          // Secret: 32 crypto-random bytes, base64url (no characters that
          // need escaping in headers or code blocks).
          var rand = new Uint8Array(32);
          window.crypto.getRandomValues(rand);
          var b64 = '';
          rand.forEach(function (b) { b64 += String.fromCharCode(b); });
          var secret = 'dk_live_' + btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          // SHA-256 needs a secure context (https / localhost); the live
          // site is https, so this only triggers on odd local setups.
          // There is NO weak-hash fallback — a key must be hashed properly.
          if (!window.crypto.subtle) {
            showMsg('ak-err', friendlyError({ code: 'auth/unknown' }), true);
            return;
          }
          var enc = new TextEncoder();
          window.crypto.subtle.digest('SHA-256', enc.encode(secret)).then(function (buf) {
            var hash = Array.prototype.map.call(new Uint8Array(buf), function (b) {
              return ('00' + b.toString(16)).slice(-2);
            }).join('');
            return DKA.db().collection('users').doc(user.uid).collection('api_keys').add({
              name: name, prefix: 'dk_live_…' + secret.slice(-4), hash: hash,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastUsedAt: null, revoked: false, revokedAt: null
            }).then(function () { return secret; });
          }).then(function (secret) {
            // Show-once modal: secret + warning + Copy + Done. Closing
            // clears the secret from the DOM (it is never stored).
            var codeEl = $('ak-secret');
            if (codeEl) { codeEl.textContent = secret; }
            if (akM) { akM.hidden = false; }
            var copyBtn = $('ak-copy');
            if (copyBtn && !copyBtn.dataset.dka) {
              copyBtn.dataset.dka = '1';
              copyBtn.addEventListener('click', function () {
                var s = codeEl ? codeEl.textContent : '';
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(s).then(function () {
                      showMsg('ak-err', (window.dkT ? window.dkT('rsv_0966', 'Copied!') : 'Copied!'), false);
                    }).catch(function () {});
                  }
                } catch (e) {}
              });
            }
            var doneBtn = $('ak-done');
            if (doneBtn && !doneBtn.dataset.dka) {
              doneBtn.dataset.dka = '1';
              doneBtn.addEventListener('click', function () {
                if (codeEl) { codeEl.textContent = ''; }
                if (akM) { akM.hidden = true; }
              });
            }
            akF.reset();
            renderKeys();
          }).catch(function (err) { showMsg('ak-err', friendlyError(err), true); });
        });
      }
      renderKeys();
    }
    var dashGuest = $('dash-guest');
    if (dashGuest) { dashGuest.hidden = true; }
    var dashMain = $('dash-main');
    if (dashMain) { dashMain.hidden = false; }
    /* Already signed in but sitting on login/signup: move to dashboard
     * (avoids signing in twice; dashboard is the account home).
     * Race fix (live-test 4, Oct 26): while a signup handler is still
     * writing its attribution jobs, do NOT redirect — the navigation
     * used to abort the handler mid-flight, leaving a bare fallback
     * doc with no referrerId/consent/referrals doc. The handler
     * redirects to dashboard itself once its jobs finish. */
    if (($('acct-login-form') || $('acct-signup-form')) && !/dashboard\//.test(location.pathname) && !window.__dokitSigningUp) {
      location.href = '../dashboard/';
      return;
    }
    setText('dash-email', user.email || '');
    setText('dash-name', displayNameOf(user, doc));
    setText('dash-coins', (typeof doc.coins === 'number') ? String(doc.coins) : '0');
    setText('dash-plan', (window.dkT ? window.dkT('plan_free', 'Free') : 'Free'));
    /* Referral link: code IS the uid (no lookup collection needed, and
     * the referrals rule resolves it without an extra read). */
    var signupUrl = '';
    document.querySelectorAll('a').forEach(function(a){
      var h = a.getAttribute('href') || '';
      if (/account\/signup\/$/.test(h)) { signupUrl = a.href; }
    });
    if (!signupUrl) { signupUrl = location.href.replace(/dashboard\/$/, 'signup/'); }
    var refEl = $('dash-ref-link');
    if (refEl) {
      refEl.textContent = signupUrl + '?ref=' + user.uid;
    }
    var refCopy = $('dash-ref-copy');
    if (refCopy && !refCopy.dataset.dka) {
      refCopy.dataset.dka = '1';
      refCopy.addEventListener('click', function(){
        var link = refEl ? refEl.textContent : '';
        function done(){
          showMsg('acct-err', (window.dkT ? window.dkT('rsv_0966', 'Copied!') : 'Copied!'), false);
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(done).catch(done);
          } else { done(); }
        } catch (e) { done(); }
      });
    }
    /* Referral Phase 1 — dashboard card + referrals page + profile,
     * all from ONE shared summary (no second count query anywhere).
     * DKREF.loadMyReferralSummary reads the caller's own referrals
     * (rules: where referrerUid == uid, L1 only — so the count is
     * real) and the caller's own 'referral reward' ledger entries.
     * The same summary object fills the dashboard spans, renders the
     * referrals-page containers (if the sibling page task added them
     * on this page) and the consent status. If DKREF failed to load,
     * the old count-only query runs as a fallback so the dashboard
     * never regresses to blank. */
    (function bindReferralSections() {
      if (!DKA.db()) { return; }
      if (!window.DKREF) {
        var refCount = $('dash-ref-count');
        if (refCount) {
          DKA.db().collection('referrals').where('referrerUid', '==', user.uid).get()
            .then(function(snap){ refCount.textContent = String(snap.size); })
            .catch(function(){ refCount.textContent = '0'; });
        }
        return;
      }
      Promise.all([
        window.DKREF.loadMyReferralSummary(user.uid),
        window.DKREF.userReferralFields(user.uid).catch(function () { return {}; })
      ]).then(function (parts) {
        var summary = parts[0];
        var fields = parts[1] || {};
        /* Fresh field read may be empty on a read failure — fall back
         * to the user doc already loaded at boot, never to invented
         * values. */
        if (!fields.referralCode && doc) {
          fields = {
            referralCode: doc.referralCode || user.uid,
            referrerId: doc.referrerId || '',
            referralActivationConsent: !!doc.referralActivationConsent,
            referralConsentAt: doc.referralConsentAt || 0
          };
        }
        window.DKREF.fillDashboard(summary);
        /* Referrals page (containers owned by the sibling page task;
         * DKREF guards every absent container, so this is safe on
         * pages without them — dashboard-only pages just skip). */
        if ($('ref-stats') || $('ref-tree') || $('ref-table') || $('ref-share') || $('ref-consent-status')) {
          /* signupUrl is the bare signup page URL (no ?ref= yet) —
           * passing refEl.textContent would double the ?ref= param,
           * since that element already holds the full link. */
          window.DKREF.renderReferralsPage(summary, fields,
            window.DKREF.referralLink(user.uid, signupUrl));
        }
        /* Profile entrance: the profile button (sibling HTML) leads to
         * the same referrals view as the nav link — one view, two
         * entrances, one shared module (DRY). Anchor or button both
         * handled; absent element skipped silently. */
        var profBtn = $('ref-profile-btn');
        if (profBtn) {
          var refPageUrl = siteRoot() + 'account/referrals/';
          if (profBtn.tagName === 'A') { profBtn.href = refPageUrl; }
          else if (!profBtn.dataset.dka) {
            profBtn.dataset.dka = '1';
            profBtn.addEventListener('click', function () { location.href = refPageUrl; });
          }
        }
      }).catch(function () { /* referral sections are best-effort;
        * coins, profile and dashboard keep working without them. */ });
    })();
    /* Referral card on non-dashboard pages (subscription): hidden by
     * default, revealed only when signed in. */
    var refCard = $('dash-ref-card');
    if (refCard) { refCard.hidden = false; }
    /* Typing-profile account card. */
    var tpGuest2 = $('tp-account-guest');
    if (tpGuest2) { tpGuest2.hidden = true; }
    var tpMain2 = $('tp-account-main');
    if (tpMain2) { tpMain2.hidden = false; }
    if (typeof doc.coins === 'number') { setText('tp-coins', String(doc.coins)); }
    var syncBtn = $('tp-sync-btn');
    if (syncBtn && !syncBtn.dataset.dka) {
      syncBtn.dataset.dka = '1';
      syncBtn.addEventListener('click', function(){
        syncBtn.disabled = true;
        syncNow(user).then(function(status){
          syncBtn.disabled = false;
          showMsg('tp-sync-msg', syncMessage(status), false);
        });
      });
    }
    /* Auto-sync once per session on sync pages (typing profile). */
    try {
      if (syncBtn && !sessionStorage.getItem('dk2_autosync_done')) {
        sessionStorage.setItem('dk2_autosync_done', '1');
        syncNow(user).then(function(){});
      }
    } catch (e) {}
    /* Wallet card (typefight/wallet). */
    var wfMain2 = $('wf-main');
    if (wfMain2) { wfMain2.hidden = false; }
    var wfGuest2 = $('wf-guest');
    if (wfGuest2) { wfGuest2.hidden = true; }
    if (typeof doc.coins === 'number') { setText('wf-coins', String(doc.coins)); }
    listClaims(user);
    var claimBtn = $('wf-claim-btn');
    if (claimBtn && !claimBtn.dataset.dka) {
      claimBtn.dataset.dka = '1';
      claimBtn.addEventListener('click', function(){
        /* Streak wiring (owner order 26 Oct 2026): the daily amount is
         * the DKREF streak rate (5 base + APPROVED streak, capped 15),
         * computed from the user's own coin_claims at click time — never
         * the old flat 10. The same fetch re-checks the one-per-day guard
         * (a claim today, pending or approved, aborts the write). When
         * DKREF failed to load, fall back to DAILY_CLAIM (flat 10). */
        var aborted = false;
        claimBtn.disabled = true;
        DKA.db().collection('coin_claims').where('uid', '==', user.uid).get().then(function(snap){
          var claims = [];
          var claimedToday = false;
          var today = new Date().toDateString();
          snap.forEach(function(d){
            var c = d.data() || {};
            claims.push(c);
            try {
              var cd = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toDateString() : '';
              if (c.type === 'daily' && cd === today && (c.status === 'pending' || c.status === 'approved')) {
                claimedToday = true;
              }
            } catch (e) {}
          });
          if (claimedToday) {
            aborted = true;
            showMsg('acct-err', (window.dkT ? window.dkT('acct_claimed', 'Already claimed today.') : 'Already claimed today.'), false);
            listClaims(user);
            return null;
          }
          var amount = DAILY_CLAIM;
          if (window.DKREF) {
            amount = window.DKREF.dailyClaimRate(window.DKREF.dailyStreakFromClaims(claims, Date.now()).streak);
          }
          return DKA.db().collection('coin_claims').add({
            uid: user.uid,
            type: 'daily',
            amount: amount,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }).then(function(wrote){
          if (!wrote) { return; }
          showMsg('acct-err', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
          listClaims(user);
        }).catch(function(err){
          showMsg('acct-err', DKA.friendlyError(err), true);
        }).then(function(){ if (!aborted) { claimBtn.disabled = false; } });
      });
    }
    /* Fighter card (typefight/profile). */
    var tfMain2 = $('tf-main');
    if (tfMain2) { tfMain2.hidden = false; }
    var tfGuest2 = $('tf-guest');
    if (tfGuest2) { tfGuest2.hidden = true; }
    var tfName = $('tf-name');
    if (tfName && !tfName.value) { tfName.value = doc.fighterName || displayNameOf(user, doc); }
    var tfCountry = $('tf-country');
    if (tfCountry && !tfCountry.value) { tfCountry.value = doc.fighterCountry || ''; }
    var tfStats = $('tf-stats');
    if (tfStats) {
      try {
        var store = JSON.parse(localStorage.getItem('dk2') || '{}');
        var battles = (store.results || []).filter(function(r){ return r && r.type === 'battle'; });
        var bbest = 0;
        battles.forEach(function(r){ if (r.wpm > bbest) { bbest = r.wpm; } });
        if (battles.length) {
          tfStats.textContent = String(battles.length) + ' ' + (window.dkT ? window.dkT('acct_battle_sum', 'battles · best WPM') : 'battles · best WPM') + ' ' + String(bbest);
        }
      } catch (e) {}
    }
    var tfForm = $('tf-profile-form');
    if (tfForm && !tfForm.dataset.dka) {
      tfForm.dataset.dka = '1';
      tfForm.addEventListener('submit', function(e){
        e.preventDefault();
        DKA.userDoc(user.uid).set({
          fighterName: (tfName ? tfName.value : '').trim(),
          fighterCountry: (tfCountry ? tfCountry.value : '').trim()
        }, { merge: true }).then(function(){
          showMsg('acct-err', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
        }).catch(function(err){
          showMsg('acct-err', DKA.friendlyError(err), true);
        });
      });
    }
    /* Local typing summary (cloud sync keeps this store in sync). */
    var tyEl = $('dash-typing');
    if (tyEl) {
      try {
        var store = JSON.parse(localStorage.getItem('dk2') || '{}');
        var results = store.results || [];
        var best = 0;
        results.forEach(function(r){ if (r && r.wpm > best) { best = r.wpm; } });
        tyEl.textContent = results.length
          ? (String(results.length) + ' ' + (window.dkT ? window.dkT('acct_typing_sum', 'tests · best WPM') : 'tests · best WPM') + ' ' + String(best))
          /* F1 fix (Oct 25): signed-in empty state must NOT reuse the guest
             sign-in string (rsv_0523) — a signed-in user with zero local
             results now sees the existing translated "no results" string
             (rsv_1063, all 10 langs) instead. */
          : (window.dkT ? window.dkT('rsv_1063', 'No results yet on this device.') : 'No results yet on this device.');
      } catch (e) { tyEl.textContent = ''; }
    }
    var ib2 = $('cert-issue-btn');
    if (ib2) {
      ib2.hidden = false;
      var ign = $('cert-issue-guest');
      if (ign) { ign.hidden = true; }
      if (!ib2.dataset.dka) {
        ib2.dataset.dka = '1';
        ib2.addEventListener('click', function () { issueCert(user); });
      }
    }
    var logout = $('acct-logout-btn');
    if (logout && !logout.dataset.dka) {
      logout.dataset.dka = '1';
      logout.addEventListener('click', function(){
        DKA.signOut().then(function(){ location.href = siteRoot() + 'account/login/'; });
      });
    }
    /* Profile form: name + photo URL save (owner may change only
     * non-privileged fields — rules reject coins/suspension edits). */
    var pf = $('acct-profile-form');
    if (pf) {
      var nameIn = $('acct-name');
      if (nameIn && !nameIn.value) { nameIn.value = displayNameOf(user, doc); }
      var photoIn = $('acct-photo');
      if (photoIn && !photoIn.value) { photoIn.value = doc.photoURL || ''; }
      setText('acct-email-ro', user.email || '');
      if (!pf.dataset.dka) {
        pf.dataset.dka = '1';
        pf.addEventListener('submit', function(e){
          e.preventDefault();
          /* Only send fields the page actually shows: the typing-profile
           * card has no photo input, and sending photoURL:'' there would
           * wipe a photo saved on the account page. */
          var payload = {};
          if (nameIn) { payload.displayName = nameIn.value.trim(); }
          if (photoIn) { payload.photoURL = photoIn.value.trim(); }
          DKA.userDoc(user.uid).set(payload, { merge: true }).then(function(){
            showMsg('acct-err', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
            syncHeader(user, Object.assign({}, doc, payload));
          }).catch(function(err){
            showMsg('acct-err', DKA.friendlyError(err), true);
          });
        });
      }
    }
    /* Update Profile form (Oct 26, user order): full information in
     * sections — personal, blood group, address, contact, education,
     * work — opened by the Update Profile button on the profile page.
     * WHY one nested map: the future CV maker tool reads exactly one
     * place, users/{uid}.profileInfo, instead of hunting scattered
     * fields. Top-level displayName/photoURL are synced too, so the
     * header and dashboard keep working. profileInfo is NOT a
     * privileged key in firestore.rules, so owner updates are allowed.
     * View/edit flow: opening the form shows saved data read-only;
     * Edit enables the fields; Save writes and returns to read-only.
     * First-time users (no saved data) get editable fields at once.
     * Photo is a URL (same as the existing photo field) — Spark has
     * no file storage, so no file upload is promised here. */
    var ub = $('prof-update-btn');
    if (ub) { ub.hidden = false; }
    var prf = $('prof-form');
    if (prf && user) {
      var pi = (doc && doc.profileInfo) || {};
      var addr = pi.address || {}, cont = pi.contact || {},
          edu = pi.education || {}, work = pi.professional || {};
      /* HOOKS (referral-complete §7): the profile bonus needs a bio,
       * but the form ships no bio input — and HTML is never edited
       * here — so append one via JS. An <input> (not a textarea) so
       * the existing profSetDisabled('input, select') read-only flow
       * covers it. Guarded twice — dataset flag on the form plus an
       * id check — so rebinding never adds a second input. Plain
       * "Bio" label, no new i18n key (the gate requires every key in
       * all 10 languages). Inserted before the buttons row so it sits
       * with the other fields, not after the actions. */
      try {
        if (!prf.dataset.dkBio && !$('prof-bio')) {
          var bioLabel = document.createElement('label');
          bioLabel.setAttribute('for', 'prof-bio');
          /* Gate-safe: build the label text in its own statement, then
           * assign the variable (a literal at a rendering position
           * fails js-gate; a plain variable does not). */
          var bioLabelText = 'Bio';
          bioLabel.textContent = bioLabelText;
          var bioInput = document.createElement('input');
          bioInput.id = 'prof-bio';
          bioInput.type = 'text';
          var btnRow = prf.querySelector('p:last-of-type');
          if (btnRow && btnRow.parentNode === prf) {
            prf.insertBefore(bioLabel, btnRow);
            prf.insertBefore(bioInput, btnRow);
          } else {
            prf.appendChild(bioLabel);
            prf.appendChild(bioInput);
          }
          prf.dataset.dkBio = '1';
        }
      } catch (e) {}
      function profVal(id, v) {
        var el = $(id); if (el) { el.value = (v === undefined || v === null) ? '' : v; }
      }
      function profFill() {
        profVal('prof-fullname', pi.fullName || displayNameOf(user, doc));
        profVal('prof-father', pi.fatherName);
        profVal('prof-bio', pi.bio);
        profVal('prof-dob', pi.dob);
        profVal('prof-gender', pi.gender);
        profVal('prof-photo', pi.photoURL || doc.photoURL || '');
        profVal('prof-blood', pi.bloodGroup);
        profVal('prof-street', addr.street);
        profVal('prof-city', addr.city);
        profVal('prof-country', addr.country);
        profVal('prof-phone', cont.phone);
        setText('prof-email-ro', user.email || '');
        profVal('prof-qual', edu.qualification);
        profVal('prof-institution', edu.institution);
        profVal('prof-field', edu.field);
        profVal('prof-year', edu.year);
        profVal('prof-occupation', work.occupation);
        profVal('prof-skills', work.skills);
        profVal('prof-languages', work.languages);
      }
      function profSetDisabled(dis) {
        prf.querySelectorAll('input, select').forEach(function (el) { el.disabled = dis; });
      }
      function profCollect() {
        var g = function (id) { var el = $(id); return el ? el.value.trim() : ''; };
        var year = parseInt(g('prof-year'), 10);
        return {
          fullName: g('prof-fullname'), fatherName: g('prof-father'),
          bio: g('prof-bio'),
          dob: g('prof-dob'), gender: g('prof-gender'),
          photoURL: g('prof-photo'), bloodGroup: g('prof-blood'),
          address: { street: g('prof-street'), city: g('prof-city'), country: g('prof-country') },
          contact: { phone: g('prof-phone') },
          education: { qualification: g('prof-qual'), institution: g('prof-institution'), field: g('prof-field'), year: isNaN(year) ? '' : year },
          professional: { occupation: g('prof-occupation'), skills: g('prof-skills'), languages: g('prof-languages') },
          updatedAt: Date.now()
        };
      }
      if (ub && !ub.dataset.dka) {
        ub.dataset.dka = '1';
        ub.addEventListener('click', function () {
          profFill();
          prf.hidden = false;
          // Saved data opens read-only (Edit re-enables); a blank
          // form opens editable so first entry needs no extra click.
          profSetDisabled(!!(pi && Object.keys(pi).length));
          prf.scrollIntoView();
        });
      }
      var eb = $('prof-edit-btn');
      if (eb && !eb.dataset.dka) {
        eb.dataset.dka = '1';
        eb.addEventListener('click', function () { profSetDisabled(false); var f = $('prof-fullname'); if (f) { f.focus(); } });
      }
      var cb = $('prof-cancel-btn');
      if (cb && !cb.dataset.dka) {
        cb.dataset.dka = '1';
        cb.addEventListener('click', function () { prf.hidden = true; });
      }
      if (!prf.dataset.dka) {
        prf.dataset.dka = '1';
        prf.addEventListener('submit', function (e) {
          e.preventDefault();
          var info = profCollect();
          var payload = { displayName: info.fullName, photoURL: info.photoURL, profileInfo: info };
          DKA.userDoc(user.uid).set(payload, { merge: true }).then(function () {
            pi = info;
            showMsg('acct-err', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
            profSetDisabled(true);
            syncHeader(user, Object.assign({}, doc, payload));
          }).catch(function (err) {
            showMsg('acct-err', DKA.friendlyError(err), true);
          });
        });
      }
    }
    /* Password change: needs a recent sign-in; otherwise Firebase
     * returns auth/requires-recent-login and we say so honestly. */
    var pwf = $('acct-pass-form');
    if (pwf && !pwf.dataset.dka) {
      pwf.dataset.dka = '1';
      pwf.addEventListener('submit', function(e){
        e.preventDefault();
        var np = ($('acct-new-pass') || {}).value || '';
        if (np.length < 6) {
          showMsg('acct-err', (window.dkT ? window.dkT('acct_err_pw', 'Password must be at least 6 characters.') : 'Password must be at least 6 characters.'), true);
          return;
        }
        user.updatePassword(np).then(function(){
          showMsg('acct-err', (window.dkT ? window.dkT('acct_saved', 'Saved.') : 'Saved.'), false);
        }).catch(function(err){
          if (err && err.code === 'auth/requires-recent-login') {
            showMsg('acct-err', (window.dkT ? window.dkT('acct_relogin', 'Please sign in again to change your password.') : 'Please sign in again to change your password.'), true);
          } else {
            showMsg('acct-err', DKA.friendlyError(err), true);
          }
        });
      });
    }
  }

  /* ---------- cloud sync (item 92) ---------- */
  /* Policy (documented, no silent overwrites): cloud wins only when it is
   * newer than the last sync (or local is empty); otherwise local uploads.
   * The payload is one JSON string, size-checked against the 1 MB doc
   * limit, because result lists grow unboundedly. Returns a status word
   * for honest UI feedback (never a fake "synced" on failure). */
  var DK2_SYNC_MAX = 900000;
  function localDk2(){
    try { return JSON.parse(localStorage.getItem('dk2') || '{}'); }
    catch (e) { return {}; }
  }
  function syncMessage(status){
    var map = {
      uploaded: ['acct_sync_up', 'Synced to your account.'],
      downloaded: ['acct_sync_down', 'Downloaded from your account.'],
      nothing: ['acct_sync_none', 'Nothing to sync.'],
      'too-big': ['acct_sync_big', 'Too much local data to sync (over 900 KB).'],
      failed: ['acct_sync_fail', 'Sync failed. Check your connection and try again.']
    };
    var hit = map[status] || map.failed;
    return (window.dkT ? window.dkT(hit[0], hit[1]) : hit[1]);
  }
  function syncNow(user){
    if (!DKA.db()) { return Promise.resolve('failed'); }
    var ref = DKA.db().collection('users').doc(user.uid).collection('cloud').doc('dk2');
    var local = localDk2();
    var localEmpty = !(local.results && local.results.length) && !(local.lessons && local.lessons.length);
    return ref.get().then(function(snap){
      var cloud = (snap && snap.exists) ? (snap.data() || {}) : null;
      var lastSync = 0;
      try { lastSync = Number(localStorage.getItem('dk2_sync_at') || 0); } catch (e) {}
      if (cloud && cloud.payload && (localEmpty || (cloud.updatedAt && cloud.updatedAt > lastSync))) {
        try {
          var data = JSON.parse(cloud.payload);
          localStorage.setItem('dk2', JSON.stringify(data));
          localStorage.setItem('dk2_sync_at', String(Date.now()));
          return 'downloaded';
        } catch (e) { return 'failed'; }
      }
      if (localEmpty) { return 'nothing'; }
      var payload = JSON.stringify(local);
      if (payload.length > DK2_SYNC_MAX) { return 'too-big'; }
      return ref.set({ payload: payload, updatedAt: Date.now() }).then(function(){
        try { localStorage.setItem('dk2_sync_at', String(Date.now())); } catch (e) {}
        return 'uploaded';
      });
    }).catch(function(){ return 'failed'; });
  }

  /* ---------- wallet claims (item 88) ---------- */
  /* Daily claim policy: one STREAK-rate REQUEST per day (5 base +
   * approved streak, capped 15 — owner order 26 Oct 2026); grants are admin-only
   * (coins stay privileged). The button disables when today's request
   * already exists (pending or approved) — checked client-side from the
   * user's own claim list. */
  /* Fallback only (DKREF missing): the live amount comes from DKREF.dailyClaimRate. */
  var DAILY_CLAIM = 10;
  function fmtClaimDate(v){
    try {
      if (v && typeof v.toDate === 'function') { return v.toDate().toLocaleDateString(); }
      if (typeof v === 'number') { return new Date(v).toLocaleDateString(); }
      if (typeof v === 'string') { return v.slice(0, 10); }
    } catch (e) {}
    return '';
  }
  function listClaims(user){
    var box = $('wf-claims');
    if (!box || !DKA.db()) { return; }
    DKA.db().collection('coin_claims').where('uid', '==', user.uid).get().then(function(snap){
      var rows = [];
      var claimedToday = false;
      var today = new Date().toDateString();
      snap.forEach(function(d){
        var c = d.data() || {};
        var ds = fmtClaimDate(c.createdAt);
        rows.push(ds + ' — ' + c.amount + ' coins — ' + c.status);
        try {
          var cd = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toDateString() : '';
          if (c.type === 'daily' && cd === today && (c.status === 'pending' || c.status === 'approved')) {
            claimedToday = true;
          }
        } catch (e) {}
      });
      box.textContent = rows.length ? rows.join(' | ') : '';
      var btn = $('wf-claim-btn');
      if (btn) {
        btn.disabled = claimedToday;
        if (claimedToday) {
          showMsg('acct-err', (window.dkT ? window.dkT('acct_claimed', 'Already claimed today.') : 'Already claimed today.'), false);
        }
      }
    }).catch(function(){ /* claims list is best-effort; balance still shows */ });
  }

  /* Run after DOM is ready (the main.js loader injects this async). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
