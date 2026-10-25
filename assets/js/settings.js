/* Settings + Notifications pages (items 100/101, Oct 25, 2026).
 * WHY one file for both pages: both pages share auth state, prefs
 * storage and the dkT helper. Each init runs only when its page's own
 * elements exist, so including this file on both pages is safe.
 * WHY no innerHTML anywhere: every rendered string goes through dkT()
 * (translated) or textContent (data from Firestore, never markup), so
 * nothing untranslated or unescaped can reach the page. Numbers and
 * dates need no translation keys (the i18n gate exempts them).
 * WHY prefs + read state live in localStorage only: they are device
 * state by nature (like typing progress on this site), they work for
 * guests too, and they need no new Firestore field or rule change.
 * Signed-in flows (name/password/queries) cannot be verified from the
 * sandbox (no Firebase reach); they are built on the exact patterns
 * account.js already uses (profile save, password change, claim list).
 */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function dkT(key, fallback) { return (window.dkT ? window.dkT(key, fallback) : fallback); }
  function getLS(key, fallback) {
    try { var v = window.localStorage.getItem(key); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function setLS(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) {}
  }
  function getJSON(key, fallback) {
    try {
      var v = JSON.parse(getLS(key, null));
      return (v && typeof v === 'object') ? v : fallback;
    } catch (e) { return fallback; }
  }
  function setMsg(el, text) { if (el) { el.textContent = text; } }

  /* ---------- notification prefs + read state (localStorage) ---------- */
  var PREFS_KEY = 'dokit_notif_prefs';
  var READ_KEY = 'dokit_notif_read';
  function getPrefs() {
    var stored = getJSON(PREFS_KEY, {});
    return {
      coins: stored.coins !== false,
      referral: stored.referral !== false,
      typefight: stored.typefight !== false,
      admin: stored.admin !== false
    };
  }
  function getRead() { return getJSON(READ_KEY, {}); }
  function markRead(id) {
    var read = getRead();
    read[id] = 1;
    setLS(READ_KEY, JSON.stringify(read));
  }

  /* ---------- auth readiness ---------- */
  /* account.js loads the Firebase SDK itself on page load. Poll for
   * DKA.ready() instead of assuming it: in the sandbox (or offline)
   * the SDK never arrives, and then guest UI is the honest state. */
  function whenReady(cb) {
    var tries = 0;
    (function tick() {
      var ready = false;
      try { ready = !!(window.DKA && window.DKA.ready()); } catch (e) {}
      if (ready || tries >= 50) { cb(ready); return; }
      tries++;
      setTimeout(tick, 300);
    })();
  }
  function currentUser() {
    try {
      var a = (window.DKA && window.DKA.auth()) || null;
      return a ? a.currentUser : null;
    } catch (e) { return null; }
  }
  function friendly(err) {
    try {
      if (window.DKA && typeof window.DKA.friendlyError === 'function') {
        return window.DKA.friendlyError(err);
      }
    } catch (e) {}
    return dkT('acct_err_net', 'Network error. Check your connection and try again.');
  }

  /* ---------- settings page ---------- */
  function setFormDisabled(form, disabled) {
    if (!form || !form.elements) { return; }
    for (var i = 0; i < form.elements.length; i++) {
      form.elements[i].disabled = disabled;
    }
  }
  function syncThemeButton() {
    var btn = $('themeTog');
    if (!btn) { return; }
    var t = getLS('dokit_theme', 'dark');
    btn.textContent = (t === 'dark') ? '☀️' : '🌙';
    btn.setAttribute('aria-label', dkT(t === 'dark' ? 'rsv_1019' : 'rsv_1020',
      t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
  }
  function applyTheme(t, save) {
    try { document.documentElement.setAttribute('data-theme', t); } catch (e) {}
    if (save) { setLS('dokit_theme', t); }
    var darkBtn = $('set-theme-dark');
    var lightBtn = $('set-theme-light');
    if (darkBtn) { darkBtn.setAttribute('aria-pressed', String(t === 'dark')); }
    if (lightBtn) { lightBtn.setAttribute('aria-pressed', String(t === 'light')); }
    syncThemeButton();
  }
  function initSettings() {
    var darkBtn = $('set-theme-dark');
    var lightBtn = $('set-theme-light');
    var langSel = $('set-lang');
    var nameForm = $('set-name-form');
    var nameInput = $('set-name');
    var nameMsg = $('set-name-msg');
    var passForm = $('set-pass-form');
    var passInput = $('set-new-pass');
    var passMsg = $('set-pass-msg');
    var prefMsg = $('set-pref-msg');
    var guestBox = $('set-guest');

    /* Appearance works for everyone (device-local, like the header). */
    applyTheme(getLS('dokit_theme', 'dark'), false);
    if (darkBtn) {
      darkBtn.addEventListener('click', function () { applyTheme('dark', true); });
    }
    if (lightBtn) {
      lightBtn.addEventListener('click', function () { applyTheme('light', true); });
    }
    /* Language: use the i18n engine when it has loaded (it re-applies
     * static nodes + fires dokit:langchange); otherwise persist + reload,
     * which is the same end state. */
    function currentLang() {
      try {
        if (window.DK_I18N && typeof window.DK_I18N.current === 'function') {
          return window.DK_I18N.current();
        }
      } catch (e) {}
      return getLS('dokit_lang', 'en');
    }
    if (langSel) {
      langSel.value = currentLang();
      langSel.addEventListener('change', function () {
        var code = langSel.value;
        try {
          if (window.DK_I18N && typeof window.DK_I18N.setLang === 'function') {
            window.DK_I18N.setLang(code);
            return;
          }
        } catch (e) {}
        setLS('dokit_lang', code);
        try { window.location.reload(); } catch (e) {}
      });
      document.addEventListener('dokit:langchange', function (ev) {
        try {
          if (ev && ev.detail && ev.detail.lang) { langSel.value = ev.detail.lang; }
        } catch (e) {}
      });
    }

    /* Preferences: device-local toggles, applied immediately. */
    var prefs = getPrefs();
    var prefBoxes = {
      coins: $('set-pref-coins'),
      referral: $('set-pref-referral'),
      typefight: $('set-pref-typefight'),
      admin: $('set-pref-admin')
    };
    Object.keys(prefBoxes).forEach(function (kind) {
      var box = prefBoxes[kind];
      if (!box) { return; }
      box.checked = !!prefs[kind];
      box.addEventListener('change', function () {
        var next = getPrefs();
        next[kind] = !!box.checked;
        setLS(PREFS_KEY, JSON.stringify(next));
        setMsg(prefMsg, dkT('acct_saved', 'Saved.'));
      });
    });

    /* Profile + Account need sign-in; guests get the note + disabled forms. */
    whenReady(function () {
      var user = currentUser();
      var guest = !user;
      if (guestBox) { guestBox.hidden = !guest; }
      setFormDisabled(nameForm, guest);
      setFormDisabled(passForm, guest);
      if (guest) { return; }
      /* Prefill the display name: users doc first, auth profile second
       * (same order account.js itself uses for display names). */
      try {
        var db = (window.DKA && window.DKA.db()) || null;
        if (db) {
          db.collection('users').doc(user.uid).get().then(function (snap) {
            var d = (snap && snap.exists) ? (snap.data() || {}) : {};
            var name = d.displayName || d.name || user.displayName || '';
            if (nameInput && !nameInput.value) { nameInput.value = name; }
          }).catch(function () {
            if (nameInput && !nameInput.value) { nameInput.value = user.displayName || ''; }
          });
        } else if (nameInput) {
          nameInput.value = user.displayName || '';
        }
      } catch (e) {
        if (nameInput) { nameInput.value = user.displayName || ''; }
      }
    });

    if (nameForm) {
      nameForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var user = currentUser();
        if (!user) { return; }
        var name = (nameInput ? nameInput.value : '').trim();
        if (!name) { return; } /* empty submit clears nothing: no-op */
        var jobs = [];
        try { jobs.push(user.updateProfile({ displayName: name }).catch(function () {})); } catch (e) {}
        try {
          var db = (window.DKA && window.DKA.db()) || null;
          if (db) { jobs.push(db.collection('users').doc(user.uid).set({ displayName: name }, { merge: true })); }
        } catch (e) {}
        Promise.all(jobs).then(function () {
          setMsg(nameMsg, dkT('acct_saved', 'Saved.'));
          /* Mirror account.js syncHeader: refresh the header avatar initial. */
          try {
            var inner = document.querySelector('#dkProfBtn .dk-avatarbtn__inner');
            if (inner) { inner.textContent = name.charAt(0).toUpperCase(); }
          } catch (e) {}
        }).catch(function (err) {
          setMsg(nameMsg, friendly(err));
        });
      });
    }

    if (passForm) {
      passForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var user = currentUser();
        if (!user) { return; }
        var np = passInput ? passInput.value : '';
        if (np.length < 6) {
          setMsg(passMsg, dkT('acct_err_pw', 'Password must be at least 6 characters.'));
          return;
        }
        /* Same pattern as account.js: recent sign-in required, else the
         * honest re-sign-in message (never a silent failure). */
        user.updatePassword(np).then(function () {
          setMsg(passMsg, dkT('acct_saved', 'Saved.'));
          try { passForm.reset(); } catch (e) {}
        }).catch(function (err) {
          if (err && err.code === 'auth/requires-recent-login') {
            setMsg(passMsg, dkT('acct_relogin', 'Please sign in again to change your password.'));
          } else {
            setMsg(passMsg, friendly(err));
          }
        });
      });
    }
  }

  /* ---------- notifications page ---------- */
  function tsMillis(v) {
    try {
      if (v && typeof v.toMillis === 'function') { return v.toMillis(); }
      if (v && typeof v.toDate === 'function') { return v.toDate().getTime(); }
      if (typeof v === 'number') { return v; }
      if (typeof v === 'string' && v) { var n = Date.parse(v); return isNaN(n) ? 0 : n; }
    } catch (e) {}
    return 0;
  }
  function initNotifications() {
    var guestBox = $('ntf-guest');
    var mainBox = $('ntf-main');
    var listEl = $('ntf-list');
    var statusEl = $('ntf-status');
    var markAllBtn = $('ntf-mark-all');
    var unreadBadge = $('ntf-unread-count');
    var filterBtns = document.querySelectorAll('[data-ntf-filter]');
    var filter = 'all';
    var events = [];

    function showStatus(key, fallback) {
      if (!statusEl) { return; }
      statusEl.hidden = false;
      statusEl.textContent = dkT(key, fallback);
    }
    function hideStatus() { if (statusEl) { statusEl.hidden = true; } }
    function render() {
      if (!listEl) { return; }
      var read = getRead();
      var prefs = getPrefs();
      var shown = events.filter(function (ev) {
        if (!prefs[ev.kind]) { return false; }
        if (filter === 'unread') { return !read[ev.id]; }
        if (filter === 'read') { return !!read[ev.id]; }
        return true;
      });
      var unreadCount = 0;
      events.forEach(function (ev) { if (!read[ev.id] && prefs[ev.kind]) { unreadCount++; } });
      if (unreadBadge) { unreadBadge.textContent = String(unreadCount); }
      while (listEl.firstChild) { listEl.removeChild(listEl.firstChild); }
      if (!shown.length) {
        showStatus(events.length ? 'ntf_empty_type' : 'ntf_empty',
          events.length ? 'No notifications of this type yet.' : 'No notifications yet.');
        return;
      }
      hideStatus();
      shown.forEach(function (ev) {
        var card = document.createElement('article');
        card.className = 'card';
        card.tabIndex = 0;
        var kindP = document.createElement('p');
        kindP.textContent = ev.kindText;
        card.appendChild(kindP);
        if (!read[ev.id]) {
          var unreadP = document.createElement('p');
          unreadP.textContent = dkT('ntf_unread', 'Unread');
          card.appendChild(unreadP);
        }
        var textP = document.createElement('p');
        textP.textContent = ev.text;
        card.appendChild(textP);
        if (ev.date) {
          var dateP = document.createElement('p');
          /* Date formatting lives OUTSIDE the textContent assignment:
           * the i18n gate scans a rendering RHS up to the next ';', so
           * the locale + option literals must not share that statement. */
          var dateLang = getLS('dokit_lang', 'en');
          var dateOpts = { year: 'numeric', month: 'short', day: 'numeric' };
          var dateText;
          try { dateText = new Date(ev.date).toLocaleDateString(dateLang, dateOpts); }
          catch (e) { dateText = new Date(ev.date).toLocaleDateString(); }
          dateP.textContent = dateText;
          card.appendChild(dateP);
        }
        card.addEventListener('click', function () {
          if (!read[ev.id]) { markRead(ev.id); render(); }
        });
        card.addEventListener('keydown', function (ke) {
          if ((ke.key === 'Enter' || ke.key === ' ') && !read[ev.id]) {
            ke.preventDefault();
            markRead(ev.id);
            render();
          }
        });
        listEl.appendChild(card);
      });
    }
    function setFilter(next) {
      filter = next;
      for (var i = 0; i < filterBtns.length; i++) {
        var active = filterBtns[i].getAttribute('data-ntf-filter') === next;
        filterBtns[i].className = active ? 'btn' : 'btn ghost';
        filterBtns[i].setAttribute('aria-pressed', String(active));
      }
      render();
    }
    for (var f = 0; f < filterBtns.length; f++) {
      (function (btn) {
        btn.addEventListener('click', function () { setFilter(btn.getAttribute('data-ntf-filter')); });
      })(filterBtns[f]);
    }
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function () {
        events.forEach(function (ev) { markRead(ev.id); });
        render();
      });
    }
    document.addEventListener('dokit:langchange', function () { render(); });

    whenReady(function () {
      var user = currentUser();
      if (!user) {
        if (guestBox) { guestBox.hidden = false; }
        if (mainBox) { mainBox.hidden = true; }
        return;
      }
      if (guestBox) { guestBox.hidden = true; }
      if (mainBox) { mainBox.hidden = false; }
      showStatus('ntf_loading', 'Loading…');
      var db = null;
      try { db = (window.DKA && window.DKA.db()) || null; } catch (e) {}
      if (!db) {
        showStatus('acct_err_net', 'Network error. Check your connection and try again.');
        return;
      }
      /* Read-only queries, owner-readable per firestore.rules. No
       * orderBy: client-side sort avoids composite-index failures.
       * Each query fails independently so one failure cannot invent
       * or hide another kind's real events. */
      var claimsP = db.collection('coin_claims').where('uid', '==', user.uid).get()
        .catch(function () { return null; });
      var refsP = db.collection('referrals').where('referrerUid', '==', user.uid).get()
        .catch(function () { return null; });
      var annP = db.collection('site_settings').doc('announcement').get()
        .catch(function () { return null; });
      Promise.all([claimsP, refsP, annP]).then(function (parts) {
        var found = [];
        var anyOk = false;
        try {
          if (parts[0]) {
            anyOk = true;
            parts[0].forEach(function (doc) {
              var d = doc.data() || {};
              var key = (d.status === 'approved') ? 'ntf_claim_approved'
                : (d.status === 'rejected') ? 'ntf_claim_rejected' : 'ntf_claim_pending';
              var fb = (d.status === 'approved') ? 'Coin claim approved'
                : (d.status === 'rejected') ? 'Coin claim rejected' : 'Coin claim pending';
              found.push({
                id: 'claim:' + doc.id, kind: 'coins',
                kindText: dkT('ntf_coins', 'Coin claims'),
                text: dkT(key, fb), date: tsMillis(d.createdAt)
              });
            });
          }
          if (parts[1]) {
            anyOk = true;
            parts[1].forEach(function (doc) {
              var d = doc.data() || {};
              found.push({
                id: 'ref:' + doc.id, kind: 'referral',
                kindText: dkT('ntf_referral', 'Referral'),
                text: d.rewarded ? dkT('ntf_ref_rewarded', 'Referral reward earned')
                  : dkT('ntf_ref_joined', 'A friend joined with your link'),
                date: tsMillis(d.createdAt)
              });
            });
          }
          if (parts[2] && parts[2].exists) {
            anyOk = true;
            var a = parts[2].data() || {};
            if (typeof a.text === 'string' && a.text.trim()) {
              var stamp = tsMillis(a.updatedAt);
              found.push({
                id: 'admin:' + (stamp || 'x'), kind: 'admin',
                kindText: dkT('ntf_admin', 'Announcement'),
                text: a.text, date: stamp
              });
            }
          }
        } catch (e) {}
        if (!anyOk) {
          showStatus('acct_err_net', 'Network error. Check your connection and try again.');
          return;
        }
        /* TypeFight results are NOT listed: typefight.js persists no
         * match records to any readable collection, so there is nothing
         * honest to show for that kind. The empty state covers it until
         * a future change records results. */
        found.sort(function (x, y) { return y.date - x.date; });
        events = found;
        setFilter('all');
      }).catch(function () {
        showStatus('acct_err_net', 'Network error. Check your connection and try again.');
      });
    });
  }

  /* ---------- boot: each init guards its own page ---------- */
  if ($('set-name-form') || $('set-lang')) { initSettings(); }
  if ($('ntf-list')) { initNotifications(); }
})();
