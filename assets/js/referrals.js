/* DoKit Referral Phase 1 — shared referrals module (window.DKREF).
 *
 * WHY one module: the referrals page, the profile section, the dashboard
 * card and the admin view must never keep separate copies of the counts.
 * Every section reads the SAME sources through this module (the referrals
 * collection for membership, the user's own coin_ledger for earnings), so
 * the numbers agree everywhere by construction. This is the auto-sync
 * requirement: one query, one summary object, many renderers.
 *
 * WHAT Phase 1 covers — and what it deliberately does NOT:
 * - Locked rates live ONLY here (DKREF.RATES). No other file hardcodes a
 *   referral number; changing a rate means changing it here, once.
 * - Rewards are NEVER auto-credited client-side. firestore.rules allows
 *   users/{uid}/coin_ledger create/update for ADMINS ONLY, and users.coins
 *   is a privileged field owners can never write. So the only credit path
 *   is DKREF.adminGrant (admin only), which writes the ledger entry, the
 *   coins increment, the referrals-doc status flip and an admin_audit log
 *   — the same writer pattern as give-coins / deposit-approval / claim
 *   approval in account.js. A non-admin calling it gets a rules denial,
 *   never a silent credit.
 * - Milestone BONUS amounts, welcome-bonus granting, gift/trial/upgrade/
 *   renewal/refund settlement are Phase 2. Their numbers are recorded in
 *   RATES for reference only; this module grants NOTHING for them and
 *   shows the welcome bonus as planned, never as granted coins.
 * - typing_activations: the match block WAS approved (owner-delegated
 *   expert decision, Oct 26) and lives in firestore.rules right after
 *   the referrals block. recordActivation below writes ONE proof doc
 *   per invited friend (consent-gated, first test only); the reward
 *   itself still pays ONLY through the admin grant — this collection
 *   is proof, never a coin writer.
 * - L2/L3 visibility: firestore.rules lets a non-admin LIST referrals
 *   only where referrerUid == their own uid (L1 only). So a non-admin
 *   client CANNOT read its L2/L3 chain, and the tree renderer says so
 *   honestly (ref_note_rules) instead of inventing members. Admins read
 *   everything, so the admin tree is built from the full collection.
 *
 * PRIVACY: the referral table shows member labels (a display name when an
 * admin supplies one, otherwise a short uid fragment) — NEVER emails or
 * phone numbers, per the referral growth plan.
 *
 * i18n: every user-visible string goes through dkT(key, EnglishFallback)
 * using ONLY the keys in the Phase 1 contract (ref_*). No other new keys.
 * Until the i18n task adds translations, the English fallback shows.
 *
 * LOAD ORDER: this file is safe to load before or after account.js. It
 * never assumes window.DKA exists at load time; DKREF.db() resolves the
 * Firestore handle lazily (DKA.db() first, then firebase.firestore()).
 * In Node (node --check / simulation) the pure helpers are exposed via
 * module.exports without touching document or firebase.
 */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window
    : (typeof global !== 'undefined' ? global : {});

  /* ---------- helpers (internal; DOM-free where possible) ---------- */
  function T(key, fallback) {
    try {
      if (root.dkT) { return root.dkT(key, fallback); }
    } catch (e) {}
    return fallback;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(idOrEl) {
    if (!idOrEl) { return null; }
    if (typeof idOrEl === 'string') {
      return (typeof document !== 'undefined') ? document.getElementById(idOrEl) : null;
    }
    return idOrEl;
  }
  function setHtml(idOrEl, html) {
    var e = el(idOrEl);
    if (e) { e.innerHTML = html; }
    return !!e;
  }
  function siteRoot() {
    try {
      return /^\/DoKit(\/|$)/.test(location.pathname) ? '/DoKit/' : '/';
    } catch (e) { return '/'; }
  }
  function fmtDate(v) {
    try {
      if (!v) { return ''; }
      if (typeof v.toDate === 'function') { return v.toDate().toLocaleDateString(); }
      if (typeof v === 'number') { return new Date(v).toLocaleDateString(); }
      if (typeof v === 'string') { return v.slice(0, 10); }
    } catch (e) {}
    return '';
  }
  function fmtDateTime(v) {
    try {
      if (!v) { return ''; }
      if (typeof v.toDate === 'function') { return v.toDate().toLocaleString(); }
      if (typeof v === 'number') { return new Date(v).toLocaleString(); }
      if (typeof v === 'string') { return v; }
    } catch (e) {}
    return '';
  }

  /* ---------- LOCKED NUMBERS (Phase 0 owner answers, 26 Oct 2026) ----------
   * Change a number here and ONLY here. Phase 2/3/4 numbers are NOT
   * implemented in this phase — the Phase 2 figures below are reference
   * constants only (plans, gift, trial, upgrade, renewal, refund) and no
   * code in this file spends, grants or settles them. */
  var RATES = {
    PRO_COINS: 300,            /* Pro plan price, coins (Phase 2) */
    TEAM_COINS: 1500,          /* Team plan price, coins (Phase 2) */
    REFERRAL_REWARD: 20,       /* L1 reward per active friend (Phase 1) */
    VALIDITY_DAYS: 30,         /* plan validity, days (Phase 2) */
    LEVELS: { 1: 20, 2: 5, 3: 2 }, /* reward per level, chain max 3 */
    CHAIN_MAX: 3,
    MILESTONES: [10, 25, 50, 100], /* counts only — bonus amounts Phase 2 */
    WELCOME_BONUS: 10,         /* planned only — NOT granted client-side */
    GIFT_COINS: 300, GIFT_VALIDITY_DAYS: 30,   /* Phase 2 */
    TRIAL_COINS: 50, TRIAL_VALIDITY_DAYS: 7,   /* Phase 2, once only */
    UPGRADE_DIFF: 1200,        /* Team minus Pro (Phase 2) */
    RENEWAL_LOYALTY: { month: 4, coins: 250 }, /* Phase 2 */
    REFUND: { days: 7, coins: 250 }            /* Phase 2, unused only */
  };
  /* Rank thresholds by ACTIVE friends. Starter is the base rank (no
   * minimum); the brief lists it first (Starter 1) — it is the rank every
   * referrer holds until Bronze at 10. */
  var RANK_THRESHOLDS = { Starter: 1, Bronze: 10, Silver: 25, Gold: 50, Diamond: 100 };
  var RANK_ORDER = [
    { name: 'Starter', min: 0 },
    { name: 'Bronze', min: 10 },
    { name: 'Silver', min: 25 },
    { name: 'Gold', min: 50 },
    { name: 'Diamond', min: 100 }
  ];

  /* ---------- status normalization (ONE definition, used everywhere) -----
   * Old referrals docs carry only { rewarded: bool }. Newer docs may carry
   * an explicit status string and/or an admin-set paused flag. The paused
   * flag wins over everything (an admin pause must never look active),
   * then an explicit status, then the legacy rewarded bool. Status
   * strings are identical everywhere because every renderer calls this. */
  function normalizeStatus(d) {
    d = d || {};
    if (d.paused === true || d.status === 'paused') { return 'paused'; }
    if (d.status === 'pending' || d.status === 'active') { return d.status; }
    return d.rewarded === true ? 'active' : 'pending';
  }
  function statusLabel(status) {
    var map = {
      pending: ['ref_status_pending', 'Pending'],
      active: ['ref_status_active', 'Active'],
      paused: ['ref_status_paused', 'Paused']
    };
    var hit = map[status] || map.pending;
    return T(hit[0], hit[1]);
  }

  /* ---------- rank + reward math (pure; unit-tested by simulation) ------ */
  function rankFor(activeCount) {
    var n = Number(activeCount) || 0;
    var rank = RANK_ORDER[0];
    var next = null;
    var i;
    for (i = 0; i < RANK_ORDER.length; i++) {
      if (n >= RANK_ORDER[i].min) { rank = RANK_ORDER[i]; }
      else if (!next) { next = RANK_ORDER[i]; }
    }
    return {
      rank: rank.name,
      nextRank: next ? next.name : null,
      /* Friends still needed for the next rank (0 at Diamond). */
      remaining: next ? (next.min - n) : 0,
      /* Progress toward the next rank as 0-100 (100 at Diamond). */
      progress: next ? Math.round((n - rank.min) / (next.min - rank.min) * 100) : 100
    };
  }
  function rewardForLevel(level) {
    var r = RATES.LEVELS[level];
    return (typeof r === 'number') ? r : 0;
  }
  /* One invitee activating pays the whole chain: L1 20 + L2 5 + L3 2 = 27.
   * Each leg is granted against its own referrals row (see adminGrant),
   * so no single grant ever pays more than its own level's rate. */
  function chainRewardTotal() {
    return rewardForLevel(1) + rewardForLevel(2) + rewardForLevel(3);
  }

  /* ---------- shared summary (ONE query pair, shared result) ------------
   * loadMyReferralSummary runs exactly two reads: the caller's own
   * referrals (rules: referrerUid == uid, L1 only) and the caller's own
   * coin_ledger entries with reason 'referral reward' — the SAME ledger
   * source the site already displays, never a second coin count. Total
   * coins shown elsewhere stays users.coins, untouched by this module. */
  function db() {
    try {
      if (root.DKA && root.DKA.db) {
        var d = root.DKA.db();
        if (d) { return d; }
      }
    } catch (e) {}
    try {
      if (root.firebase && root.firebase.firestore) { return root.firebase.firestore(); }
    } catch (e) {}
    return null;
  }
  function serverTimestamp() {
    return root.firebase.firestore.FieldValue.serverTimestamp();
  }
  function snapshotRows(snap) {
    var rows = [];
    if (!snap) { return rows; }
    snap.forEach(function (doc) {
      var d = doc.data() || {};
      d._id = doc.id;
      rows.push(d);
    });
    return rows;
  }
  function computeStats(referrals, ledgerEntries) {
    var stats = {
      total: 0, active: 0, pending: 0, paused: 0,
      totalEarnings: 0, perInvitee: {}
    };
    (referrals || []).forEach(function (r) {
      var st = normalizeStatus(r);
      stats.total++;
      if (st === 'active') { stats.active++; }
      else if (st === 'paused') { stats.paused++; }
      else { stats.pending++; }
    });
    (ledgerEntries || []).forEach(function (e) {
      var amt = Number(e.amount) || 0;
      stats.totalEarnings += amt;
      if (e.inviteeUid) {
        stats.perInvitee[e.inviteeUid] = (stats.perInvitee[e.inviteeUid] || 0) + amt;
      }
    });
    var rk = rankFor(stats.active);
    stats.rank = rk.rank;
    stats.nextRank = rk.nextRank;
    stats.rankRemaining = rk.remaining;
    stats.rankProgress = rk.progress;
    return stats;
  }
  function loadMyReferralSummary(uid) {
    var d = db();
    if (!d || !uid) { return Promise.resolve({ referrals: [], ledger: [], stats: computeStats([], []) }); }
    return Promise.all([
      d.collection('referrals').where('referrerUid', '==', uid).get()
        .then(snapshotRows).catch(function () { return []; }),
      d.collection('users').doc(uid).collection('coin_ledger')
        .where('reason', '==', 'referral reward').get()
        .then(snapshotRows).catch(function () { return []; })
    ]).then(function (parts) {
      return { referrals: parts[0], ledger: parts[1], stats: computeStats(parts[0], parts[1]) };
    });
  }
  function userReferralFields(uid) {
    var d = db();
    if (!d || !uid) { return Promise.resolve({}); }
    return d.collection('users').doc(uid).get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : {};
      return {
        referralCode: doc.referralCode || uid,
        referrerId: doc.referrerId || '',
        referralActivationConsent: !!doc.referralActivationConsent,
        referralConsentAt: doc.referralConsentAt || 0
      };
    }).catch(function () { return {}; });
  }

  /* ---------- member labels (privacy: never emails or phones) ---------- */
  function memberLabel(row, names) {
    var id = row._id || row.inviteeUid || '';
    if (names && names[id]) { return names[id]; }
    /* No display name available to this reader (non-admins cannot read
     * other users' docs): a short uid fragment identifies the row
     * without exposing any contact detail. The word before it reuses
     * the contract's member-column key, so no new i18n key is needed. */
    var word = T('ref_table_col_member', 'Member');
    return id ? (word + ' ' + String(id).slice(0, 6)) : word;
  }
  function referralLink(uid, signupBase) {
    var base = signupBase;
    if (!base) {
      try {
        base = location.origin + siteRoot() + 'account/signup/';
      } catch (e) { base = 'account/signup/'; }
    }
    var sep = (base.indexOf('?') >= 0) ? '&' : '?';
    return base + sep + 'ref=' + encodeURIComponent(uid);
  }

  /* ---------- shared renderers (all sections use these, none re-derive) - */
  function renderStats(idOrEl, summary) {
    var s = (summary && summary.stats) || computeStats([], []);
    var html = '<p><b>' + esc(T('ref_stat_earnings', 'Total earnings')) + ':</b> '
      + esc(String(s.totalEarnings)) + ' · <b>' + esc(T('ref_stat_friends', 'Active friends')) + ':</b> '
      + esc(String(s.active)) + ' · <b>' + esc(T('ref_stat_rank', 'Rank')) + ':</b> '
      + esc(s.rank) + ' · <b>' + esc(T('ref_stat_pending', 'Pending rewards')) + ':</b> '
      + esc(String(s.pending)) + '</p><p>' + esc(T('ref_rank_progress', 'Rank progress')) + ': '
      + esc(String(s.rankProgress)) + '%'
      /* Next rank + remaining count stay in the summary object (rankFor)
       * for callers that have a full sentence key for them; the stats
       * header does not assemble a sentence from fragments, because a
       * fragment sentence would not translate correctly. */
      + (s.nextRank ? (' · ' + esc(s.nextRank)) : '')
      + '</p>';
    return setHtml(idOrEl, html);
  }
  function levelList(rows, stats, names) {
    if (!rows || !rows.length) {
      return '<p>' + esc(T('ref_tree_empty', 'No members at this level yet.')) + '</p>';
    }
    var parts = ['<ul>'];
    rows.forEach(function (r) {
      var coins = (stats && stats.perInvitee && stats.perInvitee[r._id]) || 0;
      parts.push('<li>' + esc(memberLabel(r, names)) + ' · '
        + esc(fmtDate(r.createdAt)) + ' · ' + esc(statusLabel(normalizeStatus(r)))
        + ' · ' + esc(String(coins)) + '</li>');
    });
    parts.push('</ul>');
    return parts.join('');
  }
  function renderTree(idOrEl, summary, opts) {
    opts = opts || {};
    var rows = (summary && summary.referrals) || [];
    var stats = (summary && summary.stats) || computeStats(rows, []);
    /* Non-admin readers see L1 only by rules. Deeper levels are NOT
     * faked: when no L2/L3 data was supplied, the honest rules note
     * renders instead of invented members. Admin callers pass
     * opts.levels = { l2: [...], l3: [...] } built from the full
     * collection, and only then are those levels rendered. */
    var l2 = opts.levels && opts.levels.l2;
    var l3 = opts.levels && opts.levels.l3;
    var note = '<p>' + esc(T('ref_note_rules', 'Deeper team levels need a future update before they can be shown here. Level 1 and admin settlement already work.')) + '</p>';
    var html = '<h3>' + esc(T('ref_tree_title', 'Team tree')) + '</h3>'
      + '<h4>' + esc(T('ref_tree_l1', 'Level 1')) + '</h4>' + levelList(rows, stats, opts.names)
      + '<h4>' + esc(T('ref_tree_l2', 'Level 2')) + '</h4>'
      + (l2 ? levelList(l2, stats, opts.names) : note)
      + '<h4>' + esc(T('ref_tree_l3', 'Level 3')) + '</h4>'
      + (l3 ? levelList(l3, stats, opts.names) : note);
    return setHtml(idOrEl, html);
  }
  function formatReferralRow(row, names) {
    /* Admin row (also the CSV row shape): member label, join date,
     * status, coins earned from this member — no emails, no phones. The
     * data-id is the referrals doc id (= invitee uid), which admClick
     * uses for grant / pause / resume. */
    var st = normalizeStatus(row);
    var coins = (typeof row._coins === 'number') ? row._coins : 0;
    var html = '<div class="adm-row" data-id="' + esc(row._id || '') + '">'
      + esc(memberLabel(row, names)) + ' · '
      + esc(T('ref_table_col_joined', 'Joined')) + ' ' + esc(fmtDate(row.createdAt)) + ' · '
      + esc(statusLabel(st)) + ' · ' + esc(String(coins)) + ' coins'
      + ' <button class="btn ghost" type="button" data-adm="ref-grant">' + esc(T('ref_admin_grant', 'Grant reward')) + '</button>'
      + (st === 'paused'
        ? ' <button class="btn ghost" type="button" data-adm="ref-resume">' + esc(T('ref_admin_resume', 'Resume')) + '</button>'
        : ' <button class="btn ghost" type="button" data-adm="ref-pause">' + esc(T('ref_admin_pause', 'Pause')) + '</button>')
      + '</div>';
    return html;
  }
  function renderTable(idOrEl, summary, opts) {
    opts = opts || {};
    var rows = (summary && summary.referrals) || [];
    var stats = (summary && summary.stats) || computeStats(rows, []);
    var parts = ['<h3>' + esc(T('ref_table_title', 'Referral table')) + '</h3>'];
    if (!rows.length) {
      parts.push('<p>' + esc(T('ref_tree_empty', 'No members at this level yet.')) + '</p>');
    } else {
      parts.push('<table><thead><tr><th>' + esc(T('ref_table_col_member', 'Member')) + '</th><th>'
        + esc(T('ref_table_col_joined', 'Joined')) + '</th><th>' + esc(T('ref_table_col_status', 'Status')) + '</th><th>'
        + esc(T('ref_table_col_coins', 'Coins')) + '</th></tr></thead><tbody>');
      rows.forEach(function (r) {
        parts.push('<tr><td>' + esc(memberLabel(r, opts.names)) + '</td><td>' + esc(fmtDate(r.createdAt))
          + '</td><td>' + esc(statusLabel(normalizeStatus(r))) + '</td><td>'
          + esc(String((stats.perInvitee && stats.perInvitee[r._id]) || 0)) + '</td></tr>');
      });
      parts.push('</tbody></table>');
    }
    return setHtml(idOrEl, parts.join(''));
  }
  function renderShare(idOrEl, link) {
    var e = el(idOrEl);
    if (!e || !link) { return false; }
    var enc = encodeURIComponent(link);
    var qrBoxId = 'ref-qr-box';
    var html = '<h3>' + esc(T('ref_share_title', 'Share your referral link')) + '</h3>'
      + '<p>' + esc(T('ref_link_label', 'Referral link')) + ': ' + esc(link) + '</p>'
      + '<p><button class="btn ghost" type="button" data-dkref="copy">' + esc(T('ref_share_copy', 'Copy link')) + '</button> '
      + '<a href="https://wa.me/?text=' + enc + '" target="_blank" rel="noopener">WhatsApp</a> · '
      + '<a href="https://twitter.com/intent/tweet?text=' + enc + '" target="_blank" rel="noopener">X</a> · '
      + '<a href="https://www.facebook.com/sharer/sharer.php?u=' + enc + '" target="_blank" rel="noopener">Facebook</a></p>'
      + '<div id="' + qrBoxId + '"></div><p><span data-dkref="copied"></span></p>';
    e.innerHTML = html;
    var copyBtn = e.querySelector('[data-dkref="copy"]');
    var copiedEl = e.querySelector('[data-dkref="copied"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        function done() { if (copiedEl) { copiedEl.textContent = T('ref_share_copied', 'Copied!'); } }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(done).catch(done);
          } else { done(); }
        } catch (err) { done(); }
      });
    }
    /* QR: the site already vendors qrcodejs at assets/js/vendor/
     * qrcode.min.js (same library the QR Generator tool uses). If that
     * script was not loaded on this page, do NOT add a new library —
     * link to the QR Generator tool page instead, where the same link
     * can be turned into a QR code. */
    var qrBox = document.getElementById(qrBoxId);
    if (qrBox) {
      if (typeof root.QRCode !== 'undefined') {
        try {
          new root.QRCode(qrBox, { text: link, width: 180, height: 180, correctLevel: root.QRCode.CorrectLevel.M });
        } catch (err) { /* QR failure never breaks the share tools */ }
      } else {
        var a = document.createElement('a');
        a.href = siteRoot() + 'tools/qr-generator/';
        a.textContent = T('ref_link_label', 'Referral link');
        qrBox.appendChild(a);
      }
    }
    return true;
  }
  function renderConsent(idOrEl, fields) {
    var f = fields || {};
    var yes = !!f.referralActivationConsent;
    var html = '<p>' + esc(T('ref_consent_status', 'Referral consent')) + ': '
      + esc(yes ? T('ref_consent_yes', 'Yes') : T('ref_consent_no', 'No'))
      + (yes && f.referralConsentAt ? ' · ' + esc(fmtDateTime(f.referralConsentAt)) : '') + '</p>';
    return setHtml(idOrEl, html);
  }
  function renderReferralsPage(summary, fields, link) {
    /* Defensive: the sibling page task owns the HTML. Every container is
     * guarded — an absent container is skipped, never an exception. */
    /* Signed-in flip (live-test fix, Oct 26): the page ships with the
     * guest card visible and #ref-main hidden, and until now NOTHING
     * ever flipped them — so a signed-in user still saw the "Sign in"
     * prompt. This render runs only for signed-in users (account.js
     * authed binding), so hiding the guest card and revealing the
     * main view here is exactly the signed-in state. */
    try {
      var guestEl = (typeof document !== 'undefined') ? document.getElementById('ref-guest') : null;
      var mainEl = (typeof document !== 'undefined') ? document.getElementById('ref-main') : null;
      if (guestEl) { guestEl.hidden = true; }
      if (mainEl) { mainEl.hidden = false; }
    } catch (e) {}
    renderStats('ref-stats', summary);
    renderTree('ref-tree', summary);
    renderTable('ref-table', summary);
    if (link) { renderShare('ref-share', link); }
    renderConsent('ref-consent-status', fields);
  }
  function fillDashboard(summary) {
    /* Dashboard spans are filled from the SAME summary object the
     * referrals page renders — one query, shared result, no second
     * count query anywhere. */
    var s = (summary && summary.stats) || computeStats([], []);
    function setTxt(id, val) {
      var e = (typeof document !== 'undefined') ? document.getElementById(id) : null;
      if (e) { e.textContent = val; }
    }
    setTxt('dash-ref-earnings', String(s.totalEarnings));
    setTxt('dash-ref-active', String(s.active));
    setTxt('dash-ref-pending', String(s.pending));
    setTxt('dash-ref-rank', s.rank);
    setTxt('dash-ref-count', String(s.total));
    /* Card / profile labels use contract keys only (defensive: the
     * elements exist only where the sibling page task added them). */
    setTxt('ref-card-title', T('ref_card_title', 'Referral Earnings'));
    setTxt('ref-card-view', T('ref_card_view', 'View referrals'));
    setTxt('ref-profile-btn', T('ref_profile_btn', 'Referral Earnings'));
  }

  /* ---------- admin helpers (admin only; rules enforce it) ------------- */
  function csvEscape(v) {
    var s = String(v == null ? '' : v);
    return (/[",\n]/.test(s)) ? ('"' + s.replace(/"/g, '""') + '"') : s;
  }
  function toCsv(rows) {
    var lines = ['id,referrerUid,inviteeUid,joined,status,coins'];
    (rows || []).forEach(function (r) {
      lines.push([
        csvEscape(r._id || r.id || ''), csvEscape(r.referrerUid || ''),
        csvEscape(r._id || r.inviteeUid || ''), csvEscape(fmtDate(r.createdAt)),
        csvEscape(normalizeStatus(r)), csvEscape(typeof r._coins === 'number' ? r._coins : 0)
      ].join(','));
    });
    return lines.join('\n');
  }
  function csvExport(rows, filename) {
    if (typeof document === 'undefined') { return toCsv(rows); }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }));
    a.download = filename || 'dokit-referrals.csv';
    a.click();
    return true;
  }
  function renderAdminList(idOrEl, rows, names) {
    /* Admin tree, grouped by referrer: admins read the whole referrals
     * collection plus user docs for display names, so groups are real.
     * Each row carries Grant / Pause / Resume buttons wired by
     * account.js admClick (data-adm). */
    var e = el(idOrEl);
    if (!e) { return false; }
    var groups = {};
    var order = [];
    (rows || []).forEach(function (r) {
      var key = r.referrerUid || '';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(r);
    });
    var parts = ['<h3>' + esc(T('ref_admin_title', 'Referrals')) + '</h3>'
      + '<p><button class="btn ghost" type="button" data-adm="ref-export">' + esc(T('ref_admin_export', 'Export CSV')) + '</button></p>'];
    if (!order.length) {
      parts.push('<p>' + esc(T('ref_tree_empty', 'No members at this level yet.')) + '</p>');
    } else {
      order.forEach(function (key) {
        parts.push('<h4>' + esc(key ? memberLabel({ _id: key }, names) : '') + '</h4>');
        groups[key].forEach(function (r) { parts.push(formatReferralRow(r, names)); });
      });
    }
    e.innerHTML = parts.join('');
    return true;
  }
  function adminSetPaused(id, paused, reason) {
    /* Admin-only update (rules: referrals update is admin-only). Pause
     * sets the paused flag; resume clears it and restores the status the
     * rewarded flag implies, so a resumed row never stays 'paused'. */
    var d = db();
    if (!d || !id) { return Promise.reject(new Error(window.dkT ? window.dkT('ref_err_nodb', 'No database connection.') : 'No database connection.')); }
    var ref = d.collection('referrals').doc(id);
    if (!paused) {
      return ref.get().then(function (snap) {
        var cur = (snap && snap.exists) ? (snap.data() || {}) : {};
        return ref.update({ paused: false, pausedReason: '', status: cur.rewarded === true ? 'active' : 'pending' });
      });
    }
    return ref.update({ paused: true, pausedReason: reason || '', status: 'paused' });
  }
  /* ---------- referral activation record (consent-gated, first-test-only) -----
   * WHY: a referral counts as "active" only when the invited friend
   * actually finishes a typing test. The admin grant pays the chain,
   * but the grant needs proof — this writer stores that proof as ONE
   * typing_activations/{uid} doc. It is SILENT by design: it never
   * shows UI, never throws, and never touches users.coins, coin_ledger
   * or any privileged field (rewards stay admin-grant-only). Gates,
   * ALL required: a signed-in Firebase user; referralActivationConsent
   * === true on that user's doc (set at signup from the #ref-consent
   * checkbox); a non-empty referrerId (no referrer = nothing to
   * activate for); no existing doc with id == uid (first test only —
   * get-then-create, so a later test never overwrites or duplicates).
   * No anti-cheat is claimed: flags carry only what finish() passes
   * (source + typed chars); there is no paste detection here. */
  function recordActivation(wpm, accuracy, chars) {
    try {
      var d = db();
      if (!d) { return Promise.resolve(); }
      var auth = null;
      try {
        if (root.DKA && root.DKA.auth) { auth = root.DKA.auth(); }
        else if (root.firebase && root.firebase.auth) { auth = root.firebase.auth(); }
      } catch (e) {}
      var user = auth ? auth.currentUser : null;
      if (!user || !user.uid) { return Promise.resolve(); }
      var uid = user.uid;
      var w = Math.round(Number(wpm));
      var a = Math.round(Number(accuracy));
      var c = Math.round(Number(chars));
      if (!isFinite(w) || !isFinite(a) || !isFinite(c)) { return Promise.resolve(); }
      return d.collection('users').doc(uid).get().then(function (snap) {
        var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
        if (!doc) { return; }
        if (doc.referralActivationConsent !== true) { return; }
        if (!doc.referrerId || typeof doc.referrerId !== 'string') { return; }
        return d.collection('typing_activations').doc(uid).get().then(function (act) {
          if (act && act.exists) { return; }
          return d.collection('typing_activations').doc(uid).set({
            userId: uid,
            testId: 'typing-' + Date.now(),
            wpm: w,
            accuracy: a,
            createdAt: serverTimestamp(),
            flags: { source: 'typing-test', chars: c }
          });
        });
      }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }

  function adminGrant(adminUid, referralId) {
    /* Admin-only referral grant, mirroring the deposit-approval flow:
     * 1. LIVE re-read — the row must still be pending (a double-click or
     *    a reloaded queue must never double-credit).
     * 2. Idempotency — if a ledger entry for this referral already
     *    exists, do NOT credit again, just mark the row active.
     * 3. Credit L1 (20) to the row's referrer ONLY: ledger entry with
     *    reason 'referral reward' (+ level, inviteeUid, referralId),
     *    then the users.coins increment, then the row flip to
     *    active/rewarded. The caller (account.js admClick) adds the
     *    admin_audit log, as the other admin actions do.
     * Chain settlement: ONE grant pays the whole chain for THIS
     * invitee's activation — L1 20 to the row's referrer, L2 5 to
     * the referrer's referrer, L3 2 to the next link (chain walk
     * above). Granting a referrer's own row later pays for THAT
     * row's invitee, never for this one — so rates stay exact. */
    var d = db();
    if (!d || !adminUid || !referralId) { return Promise.reject(new Error(window.dkT ? window.dkT('ref_err_input', 'Missing grant input.') : 'Missing grant input.')); }
    var ref = d.collection('referrals').doc(referralId);
    return ref.get().then(function (snap) {
      var cur = (snap && snap.exists) ? (snap.data() || {}) : null;
      if (!cur) { throw new Error(window.dkT ? window.dkT('ref_err_notfound', 'Referral not found.') : 'Referral not found.'); }
      if (normalizeStatus(cur) !== 'pending') { throw new Error(window.dkT ? window.dkT('ref_err_stale', 'Referral is no longer pending.') : 'Referral is no longer pending.'); }
      if (!cur.referrerUid) { throw new Error(window.dkT ? window.dkT('ref_err_incomplete', 'Referral record is incomplete.') : 'Referral record is incomplete.'); }
      return { cur: cur, referrerUid: cur.referrerUid };
    }).then(function (ctx) {
      /* Walk the referrer chain (admin reads all referrals docs, so
       * this works for L2/L3 where a non-admin could not read them).
       * Leg 1 = the row's referrer, leg 2 = referrer's referrer,
       * leg 3 = the next link. A missing doc ends the chain (the
       * member joined organically, with no referrer); a uid already
       * in the chain is skipped, so a cycle can never double-pay. */
      var legs = [{ uid: ctx.referrerUid, level: 1 }];
      var seen = {};
      seen[ctx.referrerUid] = true;
      var nextUid = ctx.referrerUid;
      var walk = Promise.resolve();
      [2, 3].forEach(function (level) {
        walk = walk.then(function () {
          if (!nextUid) { return; }
          return d.collection('referrals').doc(nextUid).get().then(function (snap) {
            var dd = (snap && snap.exists) ? (snap.data() || {}) : null;
            if (dd && dd.referrerUid && dd.referrerUid !== nextUid && !seen[dd.referrerUid]) {
              legs.push({ uid: dd.referrerUid, level: level });
              seen[dd.referrerUid] = true;
              nextUid = dd.referrerUid;
            } else { nextUid = null; }
          });
        });
      });
      return walk.then(function () { return legs; });
    }).then(function (legs) {
      /* Pay each leg once, resume-safe: a leg already paid for this
       * referral is skipped, so a retried grant never double-credits.
       * The row flips to active ONLY after all legs succeed, so a
       * failed grant stays pending and can be retried. */
      var chain = Promise.resolve();
      var total = 0;
      legs.forEach(function (leg) {
        chain = chain.then(function () {
          var amount = rewardForLevel(leg.level);
          if (amount < 1) { return; }
          return d.collection('users').doc(leg.uid).collection('coin_ledger')
            .where('referralId', '==', referralId).get().then(function (lsnap) {
              var paid = false;
              lsnap.forEach(function (doc) {
                if ((doc.data() || {}).level === leg.level) { paid = true; }
              });
              if (paid) { return; }
              total += amount;
              return d.collection('users').doc(leg.uid).update({
                coins: root.firebase.firestore.FieldValue.increment(amount)
              }).then(function () {
                return d.collection('users').doc(leg.uid).collection('coin_ledger').add({
                  uid: leg.uid, amount: amount, by: adminUid,
                  reason: 'referral reward', level: leg.level,
                  inviteeUid: referralId, referralId: referralId,
                  createdAt: serverTimestamp()
                });
              });
            });
        });
      });
      return chain.then(function () {
        return ref.update({ status: 'active', rewarded: true, rewardedAt: serverTimestamp(), grantedBy: adminUid });
      }).then(function () { return total; });
    })
  }

  var DKREF = {
    RATES: RATES,
    RANK_THRESHOLDS: RANK_THRESHOLDS,
    normalizeStatus: normalizeStatus,
    statusLabel: statusLabel,
    rankFor: rankFor,
    rewardForLevel: rewardForLevel,
    chainRewardTotal: chainRewardTotal,
    computeStats: computeStats,
    loadMyReferralSummary: loadMyReferralSummary,
    userReferralFields: userReferralFields,
    referralLink: referralLink,
    renderStats: renderStats,
    renderTree: renderTree,
    renderTable: renderTable,
    renderShare: renderShare,
    renderConsent: renderConsent,
    renderReferralsPage: renderReferralsPage,
    fillDashboard: fillDashboard,
    formatReferralRow: formatReferralRow,
    renderAdminList: renderAdminList,
    csvExport: csvExport,
    toCsv: toCsv,
    adminGrant: adminGrant,
    adminSetPaused: adminSetPaused,
    recordActivation: recordActivation,
    db: db
  };
  root.DKREF = DKREF;
  if (typeof module !== 'undefined' && module.exports) { module.exports = DKREF; }
})();
