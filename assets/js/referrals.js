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
 * - Task 9 settles three doc rules inside adminGrant (same admin-only
 *   path, same idempotency): milestone bonuses (#4), the first-referral
 *   bonus (#5) and the invitee welcome bonus (#38). Gift/trial/upgrade/
 *   renewal/refund settlement remain Phase 2+ (numbers in RATES for
 *   reference only; this module grants NOTHING for them).
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
   * Change a number here and ONLY here. CORE-1 (referral-complete)
   * settles plans, gifts, trials, upgrades, renewals and refunds ONLY
   * through the admin functions in this file (adminApprovePurchase /
   * adminSettleClaim); no client-side credit ever exists, because
   * coin_ledger create/update and users.coins are admin-only by rules.
   * DAILY_CLAIM_MODE is 'streak' (owner order 26 Oct 2026: daily claim
   * 5 base + approved streak, capped 15); 'flat10' stays as fallback. FESTIVAL
   * stays OFF with empty dates — never invent festival dates. */
  var RATES = {
    PRO_COINS: 300,            /* Pro plan price, coins (Phase 2) */
    TEAM_COINS: 1500,          /* Team plan price, coins (Phase 2) */
    REFERRAL_REWARD: 20,       /* L1 reward per active friend (Phase 1) */
    VALIDITY_DAYS: 30,         /* plan validity, days (Phase 2) */
    LEVELS: { 1: 20, 2: 5, 3: 2 }, /* reward per level, chain max 3 */
    CHAIN_MAX: 3,
    MILESTONES: [10, 25, 50, 100], /* milestone counts (doc #4) */
    MILESTONE_BONUSES: { 10: 50, 25: 150, 50: 400, 100: 1000 }, /* doc #4 */
    FIRST_REFERRAL_BONUS: 10,  /* doc #5: first active friend pays 20 + 10 */
    WELCOME_BONUS: 10,         /* doc #38: invitee, on first test, via adminGrant */
    GIFT_COINS: 300, GIFT_VALIDITY_DAYS: 30,   /* Phase 2 */
    TRIAL_COINS: 50, TRIAL_VALIDITY_DAYS: 7,   /* Phase 2, once only */
    UPGRADE_DIFF: 1200,        /* Team minus Pro (Phase 2) */
    RENEWAL_LOYALTY: { month: 4, coins: 250 }, /* Phase 2 */
    REFUND: { days: 7, coins: 250 },            /* Phase 2, unused only */
    /* CORE-1 additions (referral-complete design §1; one constants place). */
    DAILY_CLAIM_MODE: 'streak',
    DAILY_CLAIM: { FLAT: 10, BASE: 5, STEP: 1, MAX: 15 },
    WORD_MILESTONES: { 1000: 10, 10000: 100, 100000: 1000 },
    SPEED_ACHIEVEMENTS: { 40: 20, 60: 50, 80: 100 },
    LESSON_SET_REWARD: 10, COURSE_REWARD: 200,
    TYPEFIGHT_WIN: 5, TYPEFIGHT_DAILY_CAP: 25,
    WEEKLY_CHALLENGE: { tests: 5, reward: 30 },
    PROFILE_BONUS: 15, BUG_BONUS: 50, APPEAL_APOLOGY: 10,
    BIRTHDAY_BONUS: 50,
    COMEBACK_BONUS: 25, COMEBACK_ABSENCE_DAYS: 30, COMEBACK_MIN_DAYS: 90,
    REACTIVATION_BONUS: 5, REACTIVATION_ABSENCE: 30,
    CLASS_BONUS: { students: 10, coins: 300, badge: 'Classroom Leader' },
    CONTEST_PRIZES: [500, 300, 150],
    CHALLENGE_REWARD: 10, COMMUNITY_GOAL_REWARD: 20, FEATURED_REWARD: 100,
    AMBASSADOR: { users: 10, coins: 100 },
    PAIR_STREAK: { days: 7, coins: 25 },
    FESTIVAL: { active: false, start: '', end: '' },
    STREAK_MULTIPLIER: { weeks: 4, factor: 1.5 },
    LEGENDARY_COINS: 200,
    LEGENDARY_BADGES: ['first-100', 'typing-titan', 'century-club'],
    SEASON_CHEST: { perQuest: 100, allBonus: 200 },
    BATTLE_POOL: 500, SHOUTOUT_PRIZE: 500,
    RATE_VERSION: 1,
    RATES_HISTORY: [{ version: 1, from: '2026-10-26', note: 'Phase-0 lock' }],
    GRACE_DAYS: 30, RATE_ANNOUNCEMENT: null, /* {version, announcedAt, note} — null until the owner announces; the banner renders only when set (item #47). */
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
   * coin_ledger entries with a referral reason (legs, milestone, first
   * and welcome bonuses) — the SAME ledger source the site already
   * displays, never a second coin count. Total coins shown elsewhere
   * stays users.coins, untouched by this module. */
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
      totalEarnings: 0, monthlyEarnings: 0, perInvitee: {}
    };
    var now = new Date();
    var thisMonth = now.getFullYear() + '-' + now.getMonth();
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
      /* This-month slice (Part 2 header): entries whose createdAt falls
       * in the current month. Entries without a readable date still count
       * toward the lifetime total, never toward the month slice. */
      var dd = null;
      try {
        if (e.createdAt && typeof e.createdAt.toDate === 'function') { dd = e.createdAt.toDate(); }
        else if (e.createdAt instanceof Date) { dd = e.createdAt; }
        else if (typeof e.createdAt === 'number') { dd = new Date(e.createdAt); }
        else if (typeof e.createdAt === 'string') { dd = new Date(e.createdAt); }
      } catch (err) {}
      if (dd && !isNaN(dd.getTime()) && dd.getFullYear() + '-' + dd.getMonth() === thisMonth) {
        stats.monthlyEarnings += amt;
      }
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
        .where('reason', 'in', ['referral reward', 'milestone bonus', 'first referral bonus', 'welcome bonus']).get()
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
  function privacyNameFor(udoc) {
    /* Item #49: a member who opted out (referralPrivate) is NEVER shown
     * by name in admin tree/table — not even when they have no display
     * name, because the memberLabel fallback ('Member ' + uid fragment)
     * would still identify them. Admins keep the uid for Grant/Pause
     * actions (it stays in the row's data-id); only the DISPLAY label
     * is masked. Non-admin trees never receive this flag by rules, so
     * they are unaffected. */
    if (udoc && udoc.referralPrivate) { return 'Private member'; }
    return (udoc && (udoc.displayName || udoc.name)) || '';
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
    /* Task 9 display additions (Part 2 header): this-month earnings and
     * friends-remaining to the next rank. Built in their own statements
     * as plain variables (no new dkT keys — the gate requires every key
     * in all 10 languages, and these two figures are numbers with a
     * short English label, the same pattern Tasks 3-6 used). */
    var monthlyText = 'This month: ' + (s.monthlyEarnings || 0);
    var remainingText = s.nextRank ? (s.rankRemaining + ' more to ' + s.nextRank) : '';
    var html = '<p><b>' + esc(T('ref_stat_earnings', 'Total earnings')) + ':</b> '
      + esc(String(s.totalEarnings)) + ' · ' + esc(monthlyText)
      + ' · <b>' + esc(T('ref_stat_friends', 'Active friends')) + ':</b> '
      + esc(String(s.active)) + ' · <b>' + esc(T('ref_stat_rank', 'Rank')) + ':</b> '
      + esc(s.rank) + ' · <b>' + esc(T('ref_stat_pending', 'Pending rewards')) + ':</b> '
      + esc(String(s.pending)) + '</p><p>' + esc(T('ref_rank_progress', 'Rank progress')) + ': '
      + esc(String(s.rankProgress)) + '%'
      + (s.nextRank ? (' · ' + esc(s.nextRank)) : '')
      + (remainingText ? (' · ' + esc(remainingText)) : '')
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
  function renderReferralsPage(summary, fields, link, uid) {
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
    /* CORE-1 sections (design §6 order): earnings log, claims,
     * purchases, pools, opt-out, freeze banner, verification. Each
     * render guards its own absent container, so calling them here
     * is safe even before the page task adds any of them. */
    var pageUid = uid || currentUid();
    if (pageUid) {
      renderEarningsLog(pageUid);
      renderClaims(pageUid);
      renderPurchases(pageUid);
      renderPools(pageUid);
      renderOptOut(pageUid);
      renderFreezeBanner(pageUid);
    }
    renderVerification();
    /* EXTENSION POINT: complete-build sections (CORE-2) */
    if (pageUid) {
      renderContest();
      renderLeaderboard(pageUid);
      renderGoal();
      renderChallenges(pageUid);
      renderFeatured(pageUid);
      renderAmbassador(pageUid);
      renderQR(pageUid, link);
      renderPairStreak(pageUid);
      renderBattles();
      renderShoutout();
      renderPosters(pageUid);
      renderSeason(pageUid);
      renderTreasury(pageUid);
      renderCoachForecast(pageUid);
      renderGlobe(pageUid);
      renderRateAnnouncement();
      renderClassDashboard(pageUid);
      renderContributorsWall(pageUid);
    }
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
    /* CORE-2 admin queue is APPENDED, never merged into the rows
     * above: the existing admin list output is untouched, and the
     * queue lives in its own container below it. */
    try { renderAdminQueue(e, currentUid()); } catch (err) {}
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
    /* Task 9 bonus settlement (doc #4 milestones, #5 first referral,
     * #38 invitee welcome). Pays BEFORE the row flip, with counts
     * computed as active + 1, so a failed grant stays pending and
     * retryable; every bonus first checks the recipient's ledger for
     * the same reason (and milestone, where applicable), so a retried
     * grant can never double-pay — the same discipline as the legs. */
    function payBonuses(l1Uid) {
      var bonusTotal = 0;
      function payOnce(uid, amount, entry) {
        return d.collection('users').doc(uid).collection('coin_ledger')
          .where('reason', '==', entry.reason).get().then(function (lsnap) {
            var paid = false;
            lsnap.forEach(function (doc) {
              var dd = doc.data() || {};
              if (entry.milestone != null) {
                if (dd.milestone === entry.milestone) { paid = true; }
              } else { paid = true; }
            });
            if (paid) { return 0; }
            bonusTotal += amount;
            return d.collection('users').doc(uid).update({
              coins: root.firebase.firestore.FieldValue.increment(amount)
            }).then(function () {
              var rec = { uid: uid, amount: amount, by: adminUid,
                reason: entry.reason, referralId: referralId,
                createdAt: serverTimestamp() };
              if (entry.milestone != null) { rec.milestone = entry.milestone; }
              if (entry.inviteeUid) { rec.inviteeUid = entry.inviteeUid; }
              /* Stage 1 (AUD-003): bonus doc-id — welcome/first/milestone
               * per referral row, matching the rules' entryId checks. */
              var bonusDocId = referralId + (entry.milestone != null
                ? '-milestone-' + entry.milestone
                : (entry.reason === 'first referral bonus' ? '-first' : '-welcome'));
              return d.collection('users').doc(uid).collection('coin_ledger').doc(bonusDocId).set(rec);
            }).then(function () { return amount; });
          });
      }
      return payOnce(referralId, RATES.WELCOME_BONUS, { reason: 'welcome bonus' })
        .then(function () {
          return d.collection('referrals').where('referrerUid', '==', l1Uid).get()
            .then(snapshotRows);
        })
        .then(function (rows) {
          var activeNow = 0;
          rows.forEach(function (r) { if (normalizeStatus(r) === 'active') { activeNow++; } });
          var newCount = activeNow + 1;
          var seq = Promise.resolve();
          if (newCount === 1) {
            seq = seq.then(function () {
              return payOnce(l1Uid, RATES.FIRST_REFERRAL_BONUS,
                { reason: 'first referral bonus', inviteeUid: referralId });
            });
          }
          Object.keys(RATES.MILESTONE_BONUSES).forEach(function (k) {
            var t = Number(k);
            if (newCount >= t) {
              seq = seq.then(function () {
                return payOnce(l1Uid, RATES.MILESTONE_BONUSES[k],
                  { reason: 'milestone bonus', milestone: t, inviteeUid: referralId });
              });
            }
          });
          return seq;
        })
        .then(function () { return bonusTotal; });
    }
    return ref.get().then(function (snap) {
      var cur = (snap && snap.exists) ? (snap.data() || {}) : null;
      if (!cur) { throw new Error(window.dkT ? window.dkT('ref_err_notfound', 'Referral not found.') : 'Referral not found.'); }
      if (normalizeStatus(cur) !== 'pending') { throw new Error(window.dkT ? window.dkT('ref_err_stale', 'Referral is no longer pending.') : 'Referral is no longer pending.'); }
      if (!cur.referrerUid) { throw new Error(window.dkT ? window.dkT('ref_err_incomplete', 'Referral record is incomplete.') : 'Referral record is incomplete.'); }
      /* Task 9 self-row defense: capture already blocks ref == own uid
       * in two places, but a manually-created self-row must never pay.
       * Plain variable string (no new dkT key — the gate requires every
       * key in all 10 languages). Checked before any payment. */
      if (cur.referrerUid === referralId) {
        var selfMsg = 'Self-referral cannot be granted.';
        throw new Error(selfMsg);
      }
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
              /* CORE-1 multipliers (legs ONLY — bonuses below never
               * pass through applyMultipliers): festival x2 first,
               * then streak x1.5 floor. Paid legs are NEVER re-paid:
               * the ledger check above skips them before any
               * multiplier math runs, so a multiplier change
               * mid-retry only affects legs still unpaid — it can
               * never top up a leg that already paid at the old rate. */
              return d.collection('referrals').where('referrerUid', '==', leg.uid).get()
                .then(snapshotRows).catch(function () { return []; })
                .then(function (legRows) {
                  var legAmount = applyMultipliers(amount, { festival: festivalActive(Date.now()), streak: streakMultiplierActive(legRows) });
                  total += legAmount;
                  return d.collection('users').doc(leg.uid).update({
                    coins: root.firebase.firestore.FieldValue.increment(legAmount)
                  }).then(function () {
                    /* Stage 1 (AUD-003): leg doc-id — one entry per
                     * referral row per level (rules enforce the same). */
                    return d.collection('users').doc(leg.uid).collection('coin_ledger').doc(referralId + '-L' + leg.level).set({
                      uid: leg.uid, amount: legAmount, by: adminUid,
                      reason: 'referral reward', level: leg.level,
                      inviteeUid: referralId, referralId: referralId,
                      createdAt: serverTimestamp()
                    });
                  });
                });
            });
        });
      });
      return chain.then(function () {
        return payBonuses(legs[0].uid);
      }).then(function (bonusTotal) {
        total += bonusTotal;
        return ref.update({ status: 'active', rewarded: true, rewardedAt: serverTimestamp(), grantedBy: adminUid });
      }).then(function () { return total; });
    })
  }

  /* ================= CORE-1: referral-complete (pure helpers) ==============
   * WHY DOM-free: every helper here is unit-tested in Node against a
   * fake Firestore, so a rate or date bug is caught before it ever
   * touches a real ledger. Nothing here reads document, location or
   * firebase — those live in the backend/render sections below. */

  /* One date parser for every helper: Firestore Timestamp (toDate),
   * Date, ms number and ISO string all become ms, or NaN when the
   * value carries no usable date — never a guessed date. */
  function toMs(v) {
    try {
      if (v == null) { return NaN; }
      if (typeof v.toDate === 'function') { return v.toDate().getTime(); }
      if (v instanceof Date) { return v.getTime(); }
      if (typeof v === 'number') { return v; }
      if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { return new Date(v + 'T00:00:00').getTime(); }
        var t = Date.parse(v);
        return isNaN(t) ? NaN : t;
      }
    } catch (e) {}
    return NaN;
  }
  function dayKey(ms) {
    if (isNaN(ms)) { return ''; }
    var d = new Date(ms);
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }
  function mondayOf(ms) {
    var d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    var dow = (d.getDay() + 6) % 7; /* Monday = 0 */
    d.setDate(d.getDate() - dow);
    return d.getTime();
  }
  function monthKey(d) {
    var ms = (d instanceof Date || typeof d === 'number') ? toMs(d) : toMs(d);
    if (isNaN(ms)) { return ''; }
    var dt = new Date(ms);
    var m = String(dt.getMonth() + 1);
    return dt.getFullYear() + '-' + (m.length < 2 ? '0' + m : m);
  }
  function weekKey(d) {
    var ms = toMs(d);
    if (isNaN(ms)) { return ''; }
    var mon = mondayOf(ms);
    var jan1 = new Date(new Date(mon).getFullYear(), 0, 1).getTime();
    var wk = Math.floor((mon - jan1) / 604800000) + 1;
    var ws = String(wk);
    return new Date(mon).getFullYear() + '-W' + (ws.length < 2 ? '0' + ws : ws);
  }
  function quarterKey(d) {
    var ms = toMs(d);
    if (isNaN(ms)) { return ''; }
    var dt = new Date(ms);
    return dt.getFullYear() + '-Q' + (Math.floor(dt.getMonth() / 3) + 1);
  }
  function seasonOf(d) {
    /* Season = calendar quarter. startMs is the quarter's first day at
     * local midnight; endMs is the next quarter's first day (exclusive
     * bound), so a date belongs to the season iff startMs <= t < endMs. */
    var ms = toMs(d);
    if (isNaN(ms)) { return { key: '', startMs: NaN, endMs: NaN }; }
    var dt = new Date(ms);
    var q = Math.floor(dt.getMonth() / 3);
    var start = new Date(dt.getFullYear(), q * 3, 1).getTime();
    var end = new Date(dt.getFullYear(), (q + 1) * 3, 1).getTime();
    return { key: quarterKey(d), startMs: start, endMs: end };
  }
  function dailyStreakFromClaims(claims, todayMs) {
    /* APPROVED claims only — a pending claim is not a day earned, and
     * counting it would inflate the streak the daily-claim rate pays
     * on. The streak counts consecutive calendar days ending today, or
     * ending yesterday (still alive until today's claim is made); any
     * gap before that ends the streak, including across month ends,
     * because the comparison is on calendar days, not day numbers. */
    var today = isNaN(toMs(todayMs)) ? Date.now() : toMs(todayMs);
    var days = {};
    (claims || []).forEach(function (c) {
      if (!c || c.status !== 'approved') { return; }
      var k = dayKey(toMs(c.dateMs != null ? c.dateMs : c.createdAt));
      if (k) { days[k] = true; }
    });
    var cursor = new Date(today);
    cursor.setHours(0, 0, 0, 0);
    var start = cursor.getTime();
    if (!days[dayKey(start)]) {
      cursor.setDate(cursor.getDate() - 1);
      if (!days[dayKey(cursor.getTime())]) { return { streak: 0, lastDate: null }; }
    }
    var streak = 0;
    while (days[dayKey(cursor.getTime())]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    /* last is the earliest day walked to; the streak's most recent day
     * is the start day (today or yesterday) — recompute it plainly. */
    var recent = new Date(today);
    recent.setHours(0, 0, 0, 0);
    var recentKey = days[dayKey(recent.getTime())] ? dayKey(recent.getTime()) : dayKey(recent.getTime() - 86400000);
    return { streak: streak, lastDate: recentKey };
  }
  function dailyClaimRate(streak) {
    /* Live mode is streak (owner order 26 Oct 2026): BASE 5 +
     * approved streak, capped at MAX 15. The flat-10 mode is kept
     * as fallback (DAILY_CLAIM_MODE 'flat10'). */
    if (RATES.DAILY_CLAIM_MODE === 'flat10') { return RATES.DAILY_CLAIM.FLAT; }
    var s = Math.max(0, Number(streak) || 0);
    return Math.min(RATES.DAILY_CLAIM.BASE + s, RATES.DAILY_CLAIM.MAX);
  }
  function lifetimeWords(results) {
    var total = 0;
    (results || []).forEach(function (r) {
      if (!r) { return; }
      var c = Number(r.chars);
      if (isNaN(c) && typeof r.typed === 'string') { c = r.typed.length; }
      if (!isNaN(c) && c > 0) { total += c; }
    });
    return Math.floor(total / 5);
  }
  function speedMilestones(results) {
    /* Verified ONLY: a result counts only when verified === true.
     * Legacy results without the flag deliberately do NOT count —
     * the flag is added by the typing-test hook, and counting
     * unverified runs would pay speed bonuses for pasted tests. */
    var best = 0;
    (results || []).forEach(function (r) {
      if (r && r.verified === true) {
        var w = Number(r.wpm);
        if (!isNaN(w) && w > best) { best = w; }
      }
    });
    var out = [];
    Object.keys(RATES.SPEED_ACHIEVEMENTS).forEach(function (k) {
      if (best >= Number(k)) { out.push(Number(k)); }
    });
    out.sort(function (a, b) { return a - b; });
    return out;
  }
  function lessonSetProgress(completedIds, catalog) {
    /* The catalog is passed in (window.LESSONS in the browser) and
     * lesson ids are NEVER hardcoded here — a catalog change flows
     * through automatically, and the "full course = all lessons" rule
     * stays true even if the lesson count changes from 44. Catalog
     * may be an array of {id, level} or an object {level: [ids|rows]}. */
    var done = {};
    (completedIds || []).forEach(function (id) { done[String(id)] = true; });
    var byLevel = {};
    function addRow(id, level) {
      var lv = level || 'unknown';
      if (!byLevel[lv]) { byLevel[lv] = { total: 0, done: 0 }; }
      byLevel[lv].total++;
      if (done[String(id)]) { byLevel[lv].done++; }
    }
    if (Array.isArray(catalog)) {
      catalog.forEach(function (row) {
        if (row) { addRow(row.id, row.level || row.group || row.category); }
      });
    } else if (catalog && typeof catalog === 'object') {
      Object.keys(catalog).forEach(function (lv) {
        (catalog[lv] || []).forEach(function (row) {
          addRow(typeof row === 'string' ? row : row.id, lv);
        });
      });
    }
    var setsDone = [];
    var allDone = true;
    var anyLesson = false;
    Object.keys(byLevel).forEach(function (lv) {
      anyLesson = true;
      if (byLevel[lv].total > 0 && byLevel[lv].done >= byLevel[lv].total) { setsDone.push(lv); }
      else { allDone = false; }
    });
    return { sets: byLevel, setsDone: setsDone, courseDone: anyLesson && allDone };
  }
  function typefightWins(winsLog, todayMs) {
    /* Flagged races never record a win (anti-cheat): the hook only
     * appends won races, but a flagged entry here is still excluded
     * defensively, so a tampered log cannot pay. */
    var today = dayKey(isNaN(toMs(todayMs)) ? Date.now() : toMs(todayMs));
    var total = 0;
    var todayTotal = 0;
    (winsLog || []).forEach(function (w) {
      if (!w || w.won !== true || w.flagged === true) { return; }
      total++;
      if (dayKey(toMs(w.date != null ? w.date : w.dateMs)) === today) { todayTotal++; }
    });
    return { todayTotal: todayTotal, wins: total };
  }
  /* Daily TypeFight claim math (doc #15: hard win = 5, daily cap 25).
   * WHY a helper, not inline math: the same numbers feed the claim
   * button AND the unit test, so the cap can never drift between
   * display and settlement. hardToday counts today's HARD wins only
   * (won, unflagged, difficulty 'hard' — easy/medium wins never pay).
   * claimedWins/claimedCoins sum today's non-rejected typefight-win
   * claims, so a second claim the same day pays ONLY new wins and
   * the day total never exceeds 25. A pending claim counts as
   * claimed (conservative: no double-claim while admin review is
   * open); a rejected claim frees its wins again. */
  function typefightDailyClaim(winsLog, claims, todayMs) {
    var today = dayKey(isNaN(toMs(todayMs)) ? Date.now() : toMs(todayMs));
    var hardToday = 0;
    (winsLog || []).forEach(function (w) {
      if (!w || w.won !== true || w.flagged === true) { return; }
      if (w.difficulty !== 'hard') { return; }
      if (dayKey(toMs(w.date != null ? w.date : w.dateMs)) === today) { hardToday++; }
    });
    var claimedWins = 0, claimedCoins = 0;
    (claims || []).forEach(function (c) {
      if (!c || c.kind !== 'typefight-win' || c.status === 'rejected') { return; }
      var d = c.detail || {};
      if (d.date !== today) { return; }
      /* Legacy claims (filed before this helper existed) carry no
       * wins count — only a flat 5-coin amount. Count those as
       * amount/5 wins so a migrated day can never double-pay. */
      claimedWins += (d.wins != null) ? (Number(d.wins) || 0)
        : Math.floor((Number(c.amount) || 0) / RATES.TYPEFIGHT_WIN);
      claimedCoins += Number(c.amount) || 0;
    });
    var unclaimed = Math.max(0, hardToday - claimedWins);
    var amount = Math.min(unclaimed * RATES.TYPEFIGHT_WIN,
      Math.max(0, RATES.TYPEFIGHT_DAILY_CAP - claimedCoins));
    return { hardToday: hardToday, claimedWins: claimedWins,
      claimedCoins: claimedCoins, unclaimed: unclaimed,
      amount: amount, show: amount >= RATES.TYPEFIGHT_WIN };
  }
  function weeklyProgress(results, mondayMs) {
    var start = mondayOf(isNaN(toMs(mondayMs)) ? Date.now() : toMs(mondayMs));
    var end = start + 7 * 86400000;
    var tests = 0;
    (results || []).forEach(function (r) {
      if (!r) { return; }
      var t = toMs(r.date != null ? r.date : (r.dateMs != null ? r.dateMs : r.createdAt));
      if (!isNaN(t) && t >= start && t < end) { tests++; }
    });
    return { tests: tests, done: tests >= RATES.WEEKLY_CHALLENGE.tests };
  }
  function profileCompleteness(profileInfo) {
    var p = profileInfo || {};
    var missing = [];
    if (!p.fullName && !p.displayName) { missing.push('fullName'); }
    if (!p.photoURL) { missing.push('photoURL'); }
    if (!p.bio) { missing.push('bio'); }
    return { complete: missing.length === 0, missing: missing };
  }
  function seasonQuestsProgress(own) {
    var o = own || {};
    var refer3 = (Number(o.referralsInSeason) || 0) >= 3;
    var win5 = (Number(o.winsInSeason) || 0) >= 5;
    var streak7 = (Number(o.streakInSeason) || 0) >= 7;
    var doneCount = (refer3 ? 1 : 0) + (win5 ? 1 : 0) + (streak7 ? 1 : 0);
    return { refer3: refer3, win5: win5, streak7: streak7, doneCount: doneCount };
  }
  function forecastToPro(coins, ledger30d) {
    /* Never a fake date: when the 30-day earning rate is zero or
     * negative there is no forecast at all, so the renderer shows
     * nothing instead of an invented Pro date. */
    var total = 0;
    (ledger30d || []).forEach(function (e) {
      var a = Number(e ? e.amount : 0);
      if (!isNaN(a)) { total += a; }
    });
    var dailyRate = total / 30;
    if (!(dailyRate > 0)) { return null; }
    var have = Number(coins) || 0;
    var need = RATES.PRO_COINS - have;
    if (need <= 0) { return { dailyRate: dailyRate, daysLeft: 0, proDate: dayKey(Date.now()) }; }
    var daysLeft = Math.ceil(need / dailyRate);
    return { dailyRate: dailyRate, daysLeft: daysLeft, proDate: dayKey(Date.now() + daysLeft * 86400000) };
  }
  function coachTips(summary, own) {
    /* Rule-based tips only — labelled as tips, never "AI says", with
     * no channel prediction and no percentages (nothing here can know
     * a future outcome, so nothing here claims one). Exactly 3, in
     * priority order: share, claim, follow-up, rank, practice. */
    var s = summary || {};
    var o = own || {};
    var active = (s.active != null ? s.active : o.active) || 0;
    var pending = (s.pending != null ? s.pending : o.pending) || 0;
    var thisWeek = (s.referralsThisWeek != null ? s.referralsThisWeek : o.referralsThisWeek);
    var streak = (s.streak != null ? s.streak : o.streak) || 0;
    var remaining = (s.rankRemaining != null ? s.rankRemaining : o.rankRemaining);
    var nextRank = s.nextRank || o.nextRank;
    var shareTip = 'Share your referral link with one person who types with you.';
    var claimTip = 'Claim your daily reward today to keep your streak alive.';
    var followTip = 'Follow up with a pending friend who has not finished a first test yet.';
    var rankTip = 'You are close to the next rank — one more active friend moves you up.';
    var practiceTip = 'Finish a typing test today so your next referral can activate.';
    var genericTip = 'Invite a friend, then help them finish their first test.';
    var tips = [];
    function pushTip(t) {
      if (tips.indexOf(t) === -1) { tips.push(t); }
    }
    if (thisWeek === 0 || active === 0) { pushTip(shareTip); }
    if (!streak) { pushTip(claimTip); }
    if (pending > 0) { pushTip(followTip); }
    if (nextRank && remaining != null && remaining > 0 && remaining <= 3) { pushTip(rankTip); }
    pushTip(practiceTip);
    pushTip(genericTip);
    pushTip(shareTip);
    pushTip(claimTip);
    return tips.slice(0, 3);
  }
  function festivalActive(nowMs) {
    var f = RATES.FESTIVAL || {};
    if (!f.active) { return false; }
    /* Active flag alone enables it when no dates are set; when dates
     * ARE set they bound it, so an expired festival never pays x2. */
    if (!f.start || !f.end) { return true; }
    var now = isNaN(toMs(nowMs)) ? Date.now() : toMs(nowMs);
    return now >= toMs(f.start) && now <= toMs(f.end);
  }
  function streakMultiplierActive(referrerRows) {
    /* Legs only: the referrer must have gained at least one NEW active
     * friend in each of STREAK_MULTIPLIER.weeks consecutive weeks
     * (rewardedAt dates, Monday weeks). Any run of consecutive weeks
     * qualifies — the run is what the multiplier rewards, not a
     * particular calendar window. */
    var weeks = {};
    (referrerRows || []).forEach(function (r) {
      if (!r || normalizeStatus(r) !== 'active') { return; }
      var t = toMs(r.rewardedAt != null ? r.rewardedAt : r.createdAt);
      if (!isNaN(t)) { weeks[mondayOf(t)] = true; }
    });
    var mons = Object.keys(weeks).map(function (k) { return Number(k); }).sort(function (a, b) { return a - b; });
    var need = RATES.STREAK_MULTIPLIER.weeks || 4;
    var run = 0;
    var prev = null;
    for (var i = 0; i < mons.length; i++) {
      if (prev != null && mons[i] - prev === 7 * 86400000) { run++; }
      else { run = 1; }
      if (run >= need) { return true; }
      prev = mons[i];
    }
    return false;
  }
  function applyMultipliers(base, opts) {
    /* Festival x2 FIRST, then streak x1.5, flooring after each step
     * (5 -> 7 on streak alone, 20 -> 30, festival+streak on 20 -> 60).
     * Legs ONLY — bonuses, milestones and claim amounts never pass
     * through here, so a festival can never double a milestone. opts
     * may be an object {festival, streak, nowMs, referrerRows} or two
     * booleans (festival, streak) for short call sites. */
    var b = Math.floor(Number(base) || 0);
    var fest = false;
    var streak = false;
    if (opts && typeof opts === 'object') {
      if (opts.referrerRows) { streak = streakMultiplierActive(opts.referrerRows); }
      else if (opts.streak != null) { streak = !!opts.streak; }
      if (opts.festival != null) { fest = !!opts.festival; }
      else { fest = festivalActive(opts.nowMs); }
    } else if (opts != null) {
      fest = !!opts;
      streak = !!(arguments.length > 2 && arguments[2]);
    } else {
      fest = festivalActive(Date.now());
    }
    var amount = b;
    if (fest) { amount = Math.floor(amount * 2); }
    if (streak) { amount = Math.floor(amount * RATES.STREAK_MULTIPLIER.factor); }
    return amount;
  }
  function runningBalance(entries) {
    /* Cumulative from 0 over the entries as given, sorted oldest to
     * newest by date (undated entries keep their relative order).
     * The renderer labels this "shown entries total" and shows the
     * real users.coins separately — a partial list must never be
     * presented as a full account balance. */
    var indexed = (entries || []).map(function (e, i) {
      var copy = {};
      Object.keys(e || {}).forEach(function (k) { copy[k] = e[k]; });
      copy._idx = i;
      return copy;
    });
    indexed.sort(function (a, b) {
      var ta = toMs(a.createdAt);
      var tb = toMs(b.createdAt);
      if (isNaN(ta) && isNaN(tb)) { return a._idx - b._idx; }
      if (isNaN(ta)) { return -1; }
      if (isNaN(tb)) { return 1; }
      if (ta !== tb) { return ta - tb; }
      return a._idx - b._idx;
    });
    var bal = 0;
    indexed.forEach(function (e) {
      bal += Number(e.amount) || 0;
      e.balanceAfter = bal;
      delete e._idx;
    });
    return indexed;
  }
  function isFrozen(lastActiveMs, nowMs) {
    /* Freeze = more than 365 days since last activity. Freeze never
     * deducts anything — there is simply no expiry code anywhere —
     * so this is a display gate only, never a balance writer. A
     * missing last-activity value cannot prove a freeze, so it
     * returns false rather than freezing an account on no evidence. */
    var last = toMs(lastActiveMs);
    var now = isNaN(toMs(nowMs)) ? Date.now() : toMs(nowMs);
    if (isNaN(last)) { return false; }
    return (now - last) > 365 * 86400000;
  }
  function ambassadorCounts(l1Rows) {
    /* Counts by the language field when present; rows without one
     * group under 'unknown' — grouped, never invented. The renderer
     * shows the ambassador section as "counts need language data"
     * when every row is unknown, instead of guessing a language. */
    var counts = {};
    (l1Rows || []).forEach(function (r) {
      if (!r) { return; }
      var lang = r.language || r.lang || 'unknown';
      counts[lang] = (counts[lang] || 0) + 1;
    });
    return counts;
  }
  function deviceDuplicateMap(users) {
    /* users may be an array of {uid, deviceIds[]} or an object
     * {uid: doc}. Only device ids seen on more than one uid are
     * returned — a shared device is a flag for admin review, never
     * proof of abuse on its own. */
    var byDevice = {};
    function addUser(uid, doc) {
      (doc && doc.deviceIds ? doc.deviceIds : []).forEach(function (dev) {
        if (!dev) { return; }
        if (!byDevice[dev]) { byDevice[dev] = []; }
        if (byDevice[dev].indexOf(uid) === -1) { byDevice[dev].push(uid); }
      });
    }
    if (Array.isArray(users)) {
      users.forEach(function (u) { if (u) { addUser(u.uid || u._id, u); } });
    } else if (users && typeof users === 'object') {
      Object.keys(users).forEach(function (uid) { addUser(uid, users[uid]); });
    }
    var out = {};
    Object.keys(byDevice).forEach(function (dev) {
      if (byDevice[dev].length > 1) { out[dev] = byDevice[dev]; }
    });
    return out;
  }

  /* ================= CORE-1: backend (admin-only coin movement) ==========
   * WHY ledger-first everywhere: a coin_ledger entry carrying the
   * source id (claimId / purchaseId / contributionId) is written as
   * part of every payment, and every admin action checks for that
   * entry BEFORE paying. A retried action therefore finds the entry
   * and never pays twice — the row flip is last, so a failure before
   * the flip stays retryable and a failure after the flip is refused
   * as "no longer pending". Users never write coins: every function
   * below is an admin action, and rules deny a non-admin caller. */

  function coreDb() {
    var d = db();
    return d;
  }
  function coreErr(msg) { return new Error(msg); }
  function planExpiryMs(days) {
    return Date.now() + (Number(days) || 0) * 86400000;
  }
  function ledgerHas(d, uid, field, value) {
    /* Single-field ledger lookup for idempotency: any entry with the
     * source id means the payment already happened. */
    return d.collection('users').doc(uid).collection('coin_ledger')
      .where(field, '==', value).get().then(function (snap) {
        var found = false;
        snap.forEach(function () { found = true; });
        return found;
      });
  }
  function payUser(d, adminUid, uid, amount, entry) {
    /* Stage 1 (AUD-003): ledger entry written by SOURCE doc-id
     * (entry.docId, set by every caller below) with create-only rules,
     * so a duplicate grant collides instead of minting twice. docId is
     * stripped from the stored record (it is the doc id, not a field).
     * Increment-first is KEPT deliberately: a balance-cap denial must
     * leave no false ledger record, and every caller flips the source
     * doc LAST, so ledger-before-flip holds. Crash between increment
     * and ledger still leaves unrecorded coins on a hard crash (Spark
     * has no atomic multi-write — plan §C.2 residual, stated plainly). */
    var docId = entry ? entry.docId : null;
    if (!docId) { return Promise.reject(coreErr('Missing ledger doc id.')); }
    return d.collection('users').doc(uid).update({
      coins: root.firebase.firestore.FieldValue.increment(amount)
    }).then(function () {
      var rec = { uid: uid, amount: amount, by: adminUid, createdAt: serverTimestamp() };
      Object.keys(entry || {}).forEach(function (k) { if (k !== 'docId') { rec[k] = entry[k]; } });
      return d.collection('users').doc(uid).collection('coin_ledger').doc(docId).set(rec);
    });
  }
  function setPlan(d, uid, plan) {
    return d.collection('users').doc(uid).update({ plan: plan });
  }
  function resolveRecipientUid(d, code) {
    /* Referral codes default to the uid (userReferralFields falls back
     * to uid), so a code may match a users doc id directly or a
     * stored referralCode field — both are tried, neither invented. */
    if (!code) { return Promise.resolve(null); }
    return d.collection('users').where('referralCode', '==', code).get().then(function (snap) {
      var rows = snapshotRows(snap);
      if (rows.length) { return rows[0]._id; }
      return d.collection('users').doc(code).get().then(function (s2) {
        return (s2 && s2.exists) ? code : null;
      });
    });
  }
  function readUserDoc(d, uid) {
    /* Null-db guard (same pattern as loadMyReferralSummary): without
     * it this threw synchronously inside renderers that attach
     * .catch() to its result, so the catch never ran and a guest/no-db
     * page got an uncaught exception instead of an empty state. */
    if (!d || !uid) { return Promise.resolve({}); }
    return d.collection('users').doc(uid).get().then(function (snap) {
      return (snap && snap.exists) ? (snap.data() || {}) : {};
    });
  }

  /* ---------- claims (reward_claims) ---------- */
  function createClaim(uid, kind, amount, detail) {
    var d = coreDb();
    var missingMsg = 'Missing claim input.';
    if (!d || !uid || !kind || !(Number(amount) > 0)) { return Promise.reject(coreErr(missingMsg)); }
    var doc = { uid: uid, kind: kind, amount: Number(amount), detail: detail || {}, status: 'pending', createdAt: serverTimestamp() };
    return d.collection('reward_claims').add(doc);
  }
  function listMyClaims(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve([]); }
    return d.collection('reward_claims').where('uid', '==', uid).get()
      .then(snapshotRows).catch(function () { return []; });
  }
  function adminListClaims(status) {
    var d = coreDb();
    if (!d) { return Promise.resolve([]); }
    var want = status || 'pending';
    return d.collection('reward_claims').where('status', '==', want).get()
      .then(snapshotRows).catch(function () { return []; });
  }
  function adminSettleClaim(adminUid, claimId) {
    var d = coreDb();
    var missingMsg = 'Missing claim settlement input.';
    if (!d || !adminUid || !claimId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('reward_claims').doc(claimId);
    return ref.get().then(function (snap) {
      var claim = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Claim not found.';
      if (!claim) { throw coreErr(notFoundMsg); }
      var staleMsg = 'Claim is no longer pending.';
      if (claim.status !== 'pending') { throw coreErr(staleMsg); }
      return claim;
    }).then(function (claim) {
      var isAppeal = claim.kind === 'appeal' || !!(claim.detail && claim.detail.apology);
      var mainPaid = ledgerHas(d, claim.uid, 'claimId', claimId);
      var apologyPaid = isAppeal
        ? d.collection('users').doc(claim.uid).collection('coin_ledger').where('claimId', '==', claimId).get().then(function (snap) {
          var found = false;
          snap.forEach(function (doc) { if ((doc.data() || {}).reason === 'claim apology') { found = true; } });
          return found;
        })
        : Promise.resolve(true);
      return Promise.all([mainPaid, apologyPaid]).then(function (flags) {
        var paid = 0;
        var seq = Promise.resolve();
        if (!flags[0]) {
          seq = seq.then(function () {
            return payUser(d, adminUid, claim.uid, Number(claim.amount) || 0,
              { reason: 'claim settlement', kind: claim.kind, claimId: claimId, docId: claimId });
          }).then(function () { paid += Number(claim.amount) || 0; });
        }
        if (isAppeal && !flags[1]) {
          seq = seq.then(function () {
            return payUser(d, adminUid, claim.uid, RATES.APPEAL_APOLOGY,
              { reason: 'claim apology', kind: claim.kind, claimId: claimId, docId: claimId + '-apology' });
          }).then(function () { paid += RATES.APPEAL_APOLOGY; });
        }
        return seq.then(function () {
          /* Side effects are idempotent by construction: clearing a
           * plan twice still leaves it cleared, and a badge already
           * in badges[] is never appended twice — so running them on
           * a resume is safe, and skipping them would strand a paid
           * refund/legendary claim without its effect. */
          var fx = Promise.resolve();
          if (claim.kind === 'refund') {
            fx = fx.then(function () {
              return d.collection('users').doc(claim.uid).update({ plan: null });
            });
          }
          var badgeId = claim.detail ? (claim.detail.badgeId || claim.detail.badge) : null;
          /* Coordinator fix-pass (Oct 26): ANY settled claim carrying a
           * detail.badgeId appends it once (dup-guarded below). The
           * old kind-gated list (legendary/season-chest only) silently
           * dropped ambassador badges, whose claims already carried
           * badgeId as evidence. Admin-only settle, so no user can
           * self-award; a badge already present is never duplicated. */
          if (badgeId) {
            fx = fx.then(function () {
              return readUserDoc(d, claim.uid).then(function (udoc) {
                var badges = Array.isArray(udoc.badges) ? udoc.badges.slice() : [];
                if (badges.indexOf(badgeId) === -1) { badges.push(badgeId); }
                return d.collection('users').doc(claim.uid).update({ badges: badges });
              });
            });
          }
          return fx.then(function () {
            return ref.update({ status: 'approved', reviewedBy: adminUid, reviewedAt: serverTimestamp() });
          }).then(function () { return paid; });
        });
      });
    });
  }
  function adminRejectClaim(adminUid, claimId, reason) {
    var d = coreDb();
    var missingMsg = 'Missing claim rejection input.';
    if (!d || !adminUid || !claimId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('reward_claims').doc(claimId);
    return ref.get().then(function (snap) {
      var claim = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Claim not found.';
      if (!claim) { throw coreErr(notFoundMsg); }
      var staleMsg = 'Claim is no longer pending.';
      if (claim.status !== 'pending') { throw coreErr(staleMsg); }
      return ref.update({ status: 'rejected', reviewedBy: adminUid, reviewedAt: serverTimestamp(), rejectReason: reason || '' });
    }).then(function () { return true; });
  }

  /* ---------- purchases (plan_purchases) ---------- */
  function purchaseDefaultCoins(kind) {
    if (kind === 'pro') { return RATES.PRO_COINS; }
    if (kind === 'team') { return RATES.TEAM_COINS; }
    if (kind === 'trial') { return RATES.TRIAL_COINS; }
    if (kind === 'gift') { return RATES.GIFT_COINS; }
    if (kind === 'upgrade') { return RATES.UPGRADE_DIFF; }
    if (kind === 'renewal') { return RATES.PRO_COINS; }
    return 0;
  }
  function requestPurchase(uid, kind, opts) {
    var d = coreDb();
    var o = opts || {};
    var valid = ['pro', 'team', 'trial', 'gift', 'upgrade', 'renewal'].indexOf(kind) !== -1;
    var badMsg = 'Unknown purchase type.';
    if (!d || !uid || !valid) { return Promise.reject(coreErr(badMsg)); }
    var doc = { uid: uid, kind: kind, coins: (o.coins != null ? Number(o.coins) : purchaseDefaultCoins(kind)), status: 'pending', createdAt: serverTimestamp() };
    if (o.recipientCode) { doc.recipientCode = o.recipientCode; }
    if (o.recipientUid) { doc.recipientUid = o.recipientUid; }
    if (o.poolId) { doc.poolId = o.poolId; }
    if (o.upgradeFrom) { doc.upgradeFrom = o.upgradeFrom; }
    return d.collection('plan_purchases').add(doc);
  }
  function consecutiveProTeamCount(purchases) {
    /* Trailing run of approved pro/team purchases whose gaps are all
     * <= 35 days, ending at the latest such purchase. The loyalty
     * price applies when that run is exactly 3 (the renewal is then
     * the 4th consecutive month, matching RENEWAL_LOYALTY month 4). */
    var rows = (purchases || []).filter(function (p) {
      return p && p.status === 'approved' && (p.kind === 'pro' || p.kind === 'team') && !isNaN(toMs(p.createdAt));
    }).sort(function (a, b) { return toMs(a.createdAt) - toMs(b.createdAt); });
    if (!rows.length) { return 0; }
    var count = 1;
    for (var i = rows.length - 1; i > 0; i--) {
      var gap = toMs(rows[i].createdAt) - toMs(rows[i - 1].createdAt);
      if (gap <= 35 * 86400000 && gap >= 0) { count++; }
      else { break; }
    }
    return count;
  }
  function adminApprovePurchase(adminUid, purchaseId) {
    var d = coreDb();
    var missingMsg = 'Missing purchase approval input.';
    if (!d || !adminUid || !purchaseId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('plan_purchases').doc(purchaseId);
    return ref.get().then(function (snap) {
      var p = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Purchase not found.';
      if (!p) { throw coreErr(notFoundMsg); }
      var staleMsg = 'Purchase is no longer pending.';
      if (p.status !== 'pending') { throw coreErr(staleMsg); }
      return p;
    }).then(function (p) {
      return d.collection('plan_purchases').where('uid', '==', p.uid).get().then(function (snap) {
        return { p: p, mine: snapshotRows(snap) };
      });
    }).then(function (ctx) {
      var p = ctx.p;
      /* Trial is once-only: any prior approved trial refuses the new
       * one outright — no payment, no flip, so it stays pending for
       * the admin to reject with a reason instead of silently paying. */
      if (p.kind === 'trial') {
        var priorTrial = ctx.mine.some(function (x) { return x.kind === 'trial' && x.status === 'approved'; });
        if (priorTrial) {
          var trialMsg = 'A trial was already approved for this user.';
          throw coreErr(trialMsg);
        }
      }
      var price = 0;
      if (p.kind === 'renewal') {
        price = consecutiveProTeamCount(ctx.mine) === 3 ? RATES.RENEWAL_LOYALTY.coins : RATES.PRO_COINS;
      } else if (p.kind === 'upgrade') {
        price = RATES.UPGRADE_DIFF;
      } else {
        price = Number(p.coins) || purchaseDefaultCoins(p.kind);
      }
      var recipientUid = p.recipientUid || null;
      var recipientStep = Promise.resolve();
      if (p.kind === 'gift') {
        recipientStep = resolveRecipientUid(d, p.recipientCode).then(function (rid) {
          if (p.recipientUid) { return p.recipientUid; }
          if (!rid) {
            var giftMsg = 'Gift recipient code could not be resolved.';
            throw coreErr(giftMsg);
          }
          return rid;
        }).then(function (rid) { recipientUid = rid; });
      }
      return recipientStep.then(function () {
        return ledgerHas(d, p.uid, 'purchaseId', purchaseId).then(function (alreadyPaid) {
          var paid = 0;
          var seq = Promise.resolve();
          if (!alreadyPaid) {
            seq = seq.then(function () {
              return payUser(d, adminUid, p.uid, -price, { reason: 'plan purchase', kind: p.kind, purchaseId: purchaseId, docId: purchaseId });
            }).then(function () { paid = price; });
          }
          return seq.then(function () {
            var plan = null;
            if (p.kind === 'pro') { plan = { name: 'pro', expiresAt: planExpiryMs(RATES.VALIDITY_DAYS), source: purchaseId }; }
            else if (p.kind === 'team') { plan = { name: 'team', expiresAt: planExpiryMs(RATES.VALIDITY_DAYS), source: purchaseId }; }
            else if (p.kind === 'trial') { plan = { name: 'trial', expiresAt: planExpiryMs(RATES.TRIAL_VALIDITY_DAYS), source: purchaseId }; }
            else if (p.kind === 'gift') { plan = { name: 'pro', expiresAt: planExpiryMs(RATES.GIFT_VALIDITY_DAYS), source: purchaseId }; }
            else if (p.kind === 'upgrade') { plan = { name: 'team', expiresAt: planExpiryMs(RATES.VALIDITY_DAYS), source: purchaseId, upgradeFrom: p.upgradeFrom || 'pro' }; }
            else if (p.kind === 'renewal') { plan = { name: 'pro', expiresAt: planExpiryMs(RATES.VALIDITY_DAYS), source: purchaseId }; }
            var planStep = Promise.resolve();
            if (p.kind === 'gift' && recipientUid) {
              planStep = setPlan(d, recipientUid, plan);
            } else if (p.kind === 'renewal') {
              /* Renewal keeps a Team plan as Team (it renews what the
               * user already holds); otherwise it renews as Pro. */
              planStep = readUserDoc(d, p.uid).then(function (udoc) {
                if (udoc.plan && udoc.plan.name === 'team') { plan.name = 'team'; }
                return setPlan(d, p.uid, plan);
              });
            } else if (plan) {
              planStep = setPlan(d, p.uid, plan);
            }
            return planStep.then(function () {
              var flip = { status: 'approved', reviewedBy: adminUid, reviewedAt: serverTimestamp() };
              if (p.kind === 'gift' && recipientUid) { flip.recipientUid = recipientUid; }
              return ref.update(flip);
            }).then(function () { return paid; });
          });
        });
      });
    });
  }
  function adminRejectPurchase(adminUid, purchaseId, reason) {
    var d = coreDb();
    var missingMsg = 'Missing purchase rejection input.';
    if (!d || !adminUid || !purchaseId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('plan_purchases').doc(purchaseId);
    return ref.get().then(function (snap) {
      var p = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Purchase not found.';
      if (!p) { throw coreErr(notFoundMsg); }
      var staleMsg = 'Purchase is no longer pending.';
      if (p.status !== 'pending') { throw coreErr(staleMsg); }
      return ref.update({ status: 'rejected', reviewedBy: adminUid, reviewedAt: serverTimestamp(), rejectReason: reason || '' });
    }).then(function () { return true; });
  }
  function requestRefund(uid, purchaseId) {
    /* 7-day window is enforced HERE, at request time, with a plain
     * message otherwise — "unused" verification has no usage tracking
     * to check against, so it stays an admin judgement at settle time
     * (design §8), never a faked check here. */
    var d = coreDb();
    var missingMsg = 'Missing refund input.';
    if (!d || !uid || !purchaseId) { return Promise.reject(coreErr(missingMsg)); }
    return d.collection('plan_purchases').doc(purchaseId).get().then(function (snap) {
      var p = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Purchase not found.';
      if (!p) { throw coreErr(notFoundMsg); }
      var notApprovedMsg = 'Only an approved purchase can be refunded.';
      if (p.status !== 'approved') { throw coreErr(notApprovedMsg); }
      var bought = toMs(p.createdAt);
      var windowMsg = 'Refunds are only available within 7 days of purchase.';
      if (isNaN(bought) || Date.now() - bought > RATES.REFUND.days * 86400000) { throw coreErr(windowMsg); }
      return d.collection('reward_claims').where('uid', '==', uid).get().then(function (csnap) {
        var dup = false;
        snapshotRows(csnap).forEach(function (c) {
          if (c.kind === 'refund' && c.detail && c.detail.purchaseId === purchaseId && c.status !== 'rejected') { dup = true; }
        });
        if (dup) {
          var dupMsg = 'A refund request for this purchase already exists.';
          throw coreErr(dupMsg);
        }
        return d.collection('reward_claims').add({ uid: uid, kind: 'refund', amount: RATES.REFUND.coins, detail: { purchaseId: purchaseId }, status: 'pending', createdAt: serverTimestamp() });
      });
    });
  }

  /* ---------- pools + treasury ---------- */
  function createPool(ownerUid, purpose, name, target) {
    var d = coreDb();
    var badMsg = 'Pool needs an owner and a valid purpose.';
    if (!d || !ownerUid || (purpose !== 'team-plan' && purpose !== 'treasury')) { return Promise.reject(coreErr(badMsg)); }
    return d.collection('pools').add({ ownerUid: ownerUid, purpose: purpose, name: name || '', target: Number(target) || 0, balance: 0, status: 'open', createdAt: serverTimestamp() });
  }
  function contributePool(uid, poolId, coins) {
    var d = coreDb();
    var missingMsg = 'Missing contribution input.';
    if (!d || !uid || !poolId || !(Number(coins) > 0)) { return Promise.reject(coreErr(missingMsg)); }
    return d.collection('pools').doc(poolId).get().then(function (snap) {
      var pool = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Pool not found.';
      if (!pool) { throw coreErr(notFoundMsg); }
      var spentMsg = 'This pool is already spent.';
      if (pool.status === 'spent') { throw coreErr(spentMsg); }
      return d.collection('pool_contributions').add({ poolId: poolId, uid: uid, coins: Number(coins), status: 'pending', createdAt: serverTimestamp() });
    });
  }
  function adminApproveContribution(adminUid, contributionId) {
    var d = coreDb();
    var missingMsg = 'Missing contribution approval input.';
    if (!d || !adminUid || !contributionId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('pool_contributions').doc(contributionId);
    return ref.get().then(function (snap) {
      var c = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Contribution not found.';
      if (!c) { throw coreErr(notFoundMsg); }
      var staleMsg = 'Contribution is no longer pending.';
      if (c.status !== 'pending') { throw coreErr(staleMsg); }
      return c;
    }).then(function (c) {
      return ledgerHas(d, c.uid, 'contributionId', contributionId).then(function (already) {
        if (already) {
          return ref.update({ status: 'approved', reviewedBy: adminUid, reviewedAt: serverTimestamp() }).then(function () { return 0; });
        }
        /* Order matters for resume-safety: deduct, then grow the pool
         * balance, then write the ledger entry LAST — so a ledger
         * entry proves both earlier steps happened, and its absence
         * means the whole contribution can be retried cleanly. */
        return d.collection('users').doc(c.uid).update({
          coins: root.firebase.firestore.FieldValue.increment(-Number(c.coins))
        }).then(function () {
          return d.collection('pools').doc(c.poolId).get();
        }).then(function (psnap) {
          var pool = (psnap && psnap.exists) ? (psnap.data() || {}) : {};
          return d.collection('pools').doc(c.poolId).update({ balance: (Number(pool.balance) || 0) + Number(c.coins) });
        }).then(function () {
          /* Stage 1 (AUD-003): contribution doc-id. Order UNCHANGED
           * by decision (Q3 exception) — see the comment above. */
          return d.collection('users').doc(c.uid).collection('coin_ledger').doc(contributionId).set({ uid: c.uid, amount: -Number(c.coins), by: adminUid, reason: 'pool contribution', contributionId: contributionId, poolId: c.poolId, createdAt: serverTimestamp() });
        }).then(function () {
          return ref.update({ status: 'approved', reviewedBy: adminUid, reviewedAt: serverTimestamp() });
        }).then(function () { return Number(c.coins); });
      });
    });
  }
  function adminActivatePool(adminUid, poolId) {
    var d = coreDb();
    var missingMsg = 'Missing pool activation input.';
    if (!d || !adminUid || !poolId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('pools').doc(poolId);
    return ref.get().then(function (snap) {
      var pool = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Pool not found.';
      if (!pool) { throw coreErr(notFoundMsg); }
      var purposeMsg = 'Only a team-plan pool can be activated as a plan.';
      if (pool.purpose !== 'team-plan') { throw coreErr(purposeMsg); }
      var stateMsg = 'Pool is not open for activation.';
      if (pool.status !== 'open') { throw coreErr(stateMsg); }
      var fundsMsg = 'Pool balance is below the Team plan price.';
      if ((Number(pool.balance) || 0) < RATES.TEAM_COINS) { throw coreErr(fundsMsg); }
      /* Activation costs no second deduction: contributions already
       * moved the coins into the pool balance, so this only grants
       * the owner's Team plan and marks the pool active. */
      return setPlan(d, pool.ownerUid, { name: 'team', expiresAt: planExpiryMs(RATES.VALIDITY_DAYS), source: poolId })
        .then(function () { return ref.update({ status: 'active' }); })
        .then(function () { return true; });
    });
  }
  function treasuryVote(teamUid, uid, choice, recipientCode) {
    var d = coreDb();
    var valid = ['team-plan', 'gift', 'contest'].indexOf(choice) !== -1;
    var badMsg = 'Unknown treasury choice.';
    if (!d || !teamUid || !uid || !valid) { return Promise.reject(coreErr(badMsg)); }
    var doc = { teamUid: teamUid, uid: uid, choice: choice, createdAt: serverTimestamp() };
    if (recipientCode) { doc.recipientCode = recipientCode; }
    return d.collection('treasury_votes').add(doc);
  }
  function adminExecuteTreasurySpend(adminUid, teamUid, choice, amount, recipientCodeOpt) {
    var d = coreDb();
    var missingMsg = 'Missing treasury spend input.';
    if (!d || !adminUid || !teamUid || !choice) { return Promise.reject(coreErr(missingMsg)); }
    return d.collection('treasury_votes').where('teamUid', '==', teamUid).get().then(function (snap) {
      var votes = snapshotRows(snap);
      var noVotesMsg = 'No treasury votes for this team.';
      if (!votes.length) { throw coreErr(noVotesMsg); }
      var forChoice = 0;
      votes.forEach(function (v) { if (v.choice === choice) { forChoice++; } });
      var majorityMsg = 'The requested choice does not hold a majority of votes.';
      if (forChoice * 2 <= votes.length) { throw coreErr(majorityMsg); }
      var spendAmount = (amount != null ? Number(amount) : (choice === 'team-plan' ? RATES.TEAM_COINS : (choice === 'gift' ? RATES.GIFT_COINS : NaN)));
      var amountMsg = 'A spend amount is required for this choice.';
      if (isNaN(spendAmount) || spendAmount <= 0) { throw coreErr(amountMsg); }
      var recipientStep = Promise.resolve(null);
      if (choice === 'gift') {
        /* Gift spend needs a recipientCode stored on a winning vote;
         * without one the spend is refused plainly, never guessed. */
        var code = recipientCodeOpt || null;
        if (!code) {
          votes.forEach(function (v) {
            if (v.choice === 'gift' && v.recipientCode && !code) { code = v.recipientCode; }
          });
        }
        var noCodeMsg = 'Gift spend needs a recipient code on a winning vote.';
        if (!code) { throw coreErr(noCodeMsg); }
        recipientStep = resolveRecipientUid(d, code).then(function (rid) {
          if (!rid) {
            var unresMsg = 'Gift recipient code could not be resolved.';
            throw coreErr(unresMsg);
          }
          return rid;
        });
      }
      return recipientStep.then(function (recipientUid) {
        return d.collection('pools').where('ownerUid', '==', teamUid).get().then(function (psnap) {
          var pool = null;
          snapshotRows(psnap).forEach(function (p) {
            if (!pool && p.purpose === 'treasury' && (p.status === 'open' || p.status === 'active')) { pool = p; }
          });
          var noPoolMsg = 'No treasury pool found for this team.';
          if (!pool) { throw coreErr(noPoolMsg); }
          var fundsMsg = 'Treasury pool balance is below the spend amount.';
          if ((Number(pool.balance) || 0) < spendAmount) { throw coreErr(fundsMsg); }
          return d.collection('treasury_spends').add({ teamUid: teamUid, choice: choice, amount: spendAmount, status: 'executed', createdAt: serverTimestamp() }).then(function (spendRef) {
            var spendId = spendRef ? spendRef.id : '';
            var fx = Promise.resolve();
            if (choice === 'team-plan') {
              fx = setPlan(d, teamUid, { name: 'team', expiresAt: planExpiryMs(RATES.VALIDITY_DAYS), source: spendId });
            } else if (choice === 'gift' && recipientUid) {
              fx = setPlan(d, recipientUid, { name: 'pro', expiresAt: planExpiryMs(RATES.GIFT_VALIDITY_DAYS), source: spendId });
            } else if (choice === 'contest') {
              var mk = monthKey(new Date());
              fx = d.collection('contest_winners').doc(mk).get().then(function (csnap) {
                if (csnap && csnap.exists) {
                  var cur = csnap.data() || {};
                  return d.collection('contest_winners').doc(mk).update({ bonusPool: (Number(cur.bonusPool) || 0) + spendAmount, status: 'funded' });
                }
                return d.collection('contest_winners').doc(mk).set({ winners: [], bonusPool: spendAmount, status: 'funded', publishedAt: serverTimestamp() });
              });
            }
            return fx.then(function () {
              return d.collection('pools').doc(pool._id).update({ balance: (Number(pool.balance) || 0) - spendAmount });
            }).then(function () { return { spendId: spendId, amount: spendAmount }; });
          });
        });
      });
    });
  }

  /* ---------- email-verification stamp (best-effort, silent) ---------- */
  function currentUid() {
    try {
      var auth = null;
      if (root.DKA && root.DKA.auth) { auth = root.DKA.auth(); }
      else if (root.firebase && root.firebase.auth) { auth = root.firebase.auth(); }
      return auth && auth.currentUser ? auth.currentUser.uid : null;
    } catch (e) { return null; }
  }
  function stampEmailVerified() {
    /* If the signed-in user is email-verified but their doc still
     * lacks emailVerifiedAt, stamp it — best-effort and silent, so a
     * rules denial here never breaks the verification section. */
    try {
      var auth = null;
      if (root.DKA && root.DKA.auth) { auth = root.DKA.auth(); }
      else if (root.firebase && root.firebase.auth) { auth = root.firebase.auth(); }
      var user = auth ? auth.currentUser : null;
      if (!user || !user.emailVerified) { return Promise.resolve(false); }
      var d = coreDb();
      if (!d) { return Promise.resolve(false); }
      return readUserDoc(d, user.uid).then(function (udoc) {
        if (udoc.emailVerifiedAt) { return false; }
        return d.collection('users').doc(user.uid).update({ emailVerifiedAt: serverTimestamp() }).then(function () { return true; }).catch(function () { return false; });
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* ================= CORE-1: lazy loads + renders ========================
   * WHY lazy: the referrals page must not pay for four extra queries
   * on every dashboard visit. Each load below is called only by its
   * own section, and each turns a permission-denied (the new
   * collections have no published rules yet) into an honest empty
   * result plus a rulesPending flag — never a crash, never a fake
   * success. Renders create their own container under #ref-main
   * (never an HTML edit) and attach their own dataset-guarded
   * listeners (never admClick). All user-visible strings are plain
   * variables or reused ref_* keys — no new dkT keys. */
  function isPermDenied(err) {
    if (!err) { return false; }
    if (err.code === 'permission-denied') { return true; }
    return /permission-denied/.test(String(err.message || ''));
  }
  function loadMyLedgerFull(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve({ entries: [], rulesPending: false }); }
    return d.collection('users').doc(uid).collection('coin_ledger').get()
      .then(function (snap) { return { entries: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { entries: [], rulesPending: isPermDenied(err) }; });
  }
  function loadMyClaims(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve({ claims: [], rulesPending: false }); }
    return d.collection('reward_claims').where('uid', '==', uid).get()
      .then(function (snap) { return { claims: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { claims: [], rulesPending: isPermDenied(err) }; });
  }
  function loadMyPurchases(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve({ purchases: [], rulesPending: false }); }
    return d.collection('plan_purchases').where('uid', '==', uid).get()
      .then(function (snap) { return { purchases: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { purchases: [], rulesPending: isPermDenied(err) }; });
  }
  function loadMyPools(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve({ pools: [], rulesPending: false }); }
    return d.collection('pools').where('ownerUid', '==', uid).get()
      .then(function (snap) { return { pools: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { pools: [], rulesPending: isPermDenied(err) }; });
  }
  function refxContainer(id) {
    if (typeof document === 'undefined') { return null; }
    var main = document.getElementById('ref-main');
    if (!main) { return null; }
    var c = document.getElementById(id);
    if (!c) {
      c = document.createElement('div');
      c.id = id;
      main.appendChild(c);
    }
    return c;
  }
  function refxNote(container, text) {
    if (!container) { return; }
    var n = container.querySelector('[data-refx-note]');
    if (n) { n.textContent = text; }
  }
  function refxBind(container, handler) {
    if (!container || !container.querySelectorAll) { return; }
    var btns = container.querySelectorAll('button[data-refx-action]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        if (btn.dataset && btn.dataset.refxBound) { return; }
        if (btn.dataset) { btn.dataset.refxBound = '1'; }
        btn.addEventListener('click', function (ev) { handler(btn, ev); });
      })(btns[i]);
    }
  }
  function dk2Results() {
    try {
      if (root.DK2 && root.DK2.getResults) { return root.DK2.getResults() || []; }
    } catch (e) {}
    return [];
  }
  function dk2Lessons() {
    try {
      if (root.DK2 && root.DK2.getLessons) { return root.DK2.getLessons() || []; }
      if (root.DK2 && Array.isArray(root.DK2.lessons)) { return root.DK2.lessons; }
    } catch (e) {}
    return [];
  }
  function dk2MappedResults() {
    /* DK2 results carry wpm + durationSec; chars are derived from
     * the WPM definition (words = wpm x minutes, chars = words x 5)
     * ONLY when a result carries no chars field — the admin still
     * verifies every claim before paying, so an estimate here can
     * never auto-credit. */
    return dk2Results().map(function (r) {
      var chars = Number(r.chars);
      if (isNaN(chars) && Number(r.wpm) > 0 && Number(r.durationSec) > 0) {
        chars = Math.round(Number(r.wpm) * Number(r.durationSec) / 12);
      }
      return { chars: isNaN(chars) ? 0 : chars, wpm: Number(r.wpm) || 0, verified: r.verified, date: r.date, createdAt: r.date };
    });
  }

  function renderEarningsLog(uid) {
    var container = refxContainer('refx-earnings');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Earnings log';
    var shownText = 'Shown entries total';
    var currentText = 'Current coins';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No earnings entries yet.';
    return Promise.all([loadMyLedgerFull(uid), readUserDoc(coreDb(), uid).catch(function () { return {}; })])
      .then(function (parts) {
        var withBal = runningBalance(parts[0].entries);
        var total = withBal.length ? withBal[withBal.length - 1].balanceAfter : 0;
        var coins = (parts[1] && parts[1].coins != null) ? parts[1].coins : 0;
        var html = ['<h3>' + esc(titleText) + '</h3>'];
        if (parts[0].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
        html.push('<p>' + esc(shownText) + ': ' + esc(String(total)) + ' · ' + esc(currentText) + ': ' + esc(String(coins)) + '</p>');
        if (!withBal.length) {
          html.push('<p>' + esc(emptyText) + '</p>');
        } else {
          html.push('<ul>');
          var newestFirst = withBal.slice().reverse();
          newestFirst.forEach(function (e) {
            var reasonText = e.reason || '';
            html.push('<li>' + esc(fmtDate(e.createdAt)) + ' · ' + esc(reasonText) + ' · ' + esc(String(e.amount)) + ' · ' + esc(String(e.balanceAfter)) + '</li>');
          });
          html.push('</ul>');
        }
        container.innerHTML = html.join('');
        return true;
      }).catch(function () { return false; });
  }

  /* ---------- bug-report + appeal forms (Oct 26) ----------
   * WHY these exist: BUG_BONUS was defined but no UI could ever file
   * a bug claim, and no UI could appeal a claim — so the 'bug' and
   * 'appeal' kinds in the published reward_claims rules were
   * unreachable from the site. These forms are the missing creators.
   * Both submit through the existing createClaim path, whose doc
   * shape (uid == auth.uid, status 'pending', amount 1-1000, detail
   * a map, exactly the six allowed keys) is exactly what the
   * published rules validate — so no rules change was needed.
   * Everything below is pure (no DOM, no Firestore) so the unit
   * tests cover the validation and the picker scope exactly. */
  function bugFormPayload(description) {
    /* A bug report is valid only with a real description — an empty
     * report can never submit. The amount is the locked BUG_BONUS
     * constant, never user-typed: the reporter describes the bug,
     * the admin decides the payout at settle time. */
    var desc = (description == null) ? '' : String(description).trim();
    if (!desc) { return null; }
    return { kind: 'bug', amount: RATES.BUG_BONUS, detail: { description: desc } };
  }
  function appealableClaims(uid, claims) {
    /* The appeal picker scope, as pure data: ONLY the signed-in
     * user's own claims (the listMyClaims query already scopes by
     * uid; the uid check here is defense in depth, never the sole
     * guard), excluding appeal claims themselves (an appeal appeals
     * a decision, never another appeal) and claims already covered
     * by a live (non-rejected) appeal (no duplicate appeals for one
     * decision). */
    var appealed = {};
    (claims || []).forEach(function (c) {
      if (c && c.kind === 'appeal' && c.status !== 'rejected' && c.detail && c.detail.appealedClaimId) {
        appealed[c.detail.appealedClaimId] = true;
      }
    });
    var out = [];
    (claims || []).forEach(function (c) {
      if (!c || c.uid !== uid) { return; }
      if (c.kind === 'appeal') { return; }
      if (appealed[c._id || c.id]) { return; }
      out.push(c);
    });
    return out;
  }
  function appealFormPayload(uid, claims, pickedId, reason) {
    /* An appeal is valid only with a picked appealable claim and a
     * real reason — nothing picked, a picked claim that is not the
     * user's appealable claim, or an empty reason all return null,
     * so no invalid appeal can ever reach createClaim. The amount is
     * ALWAYS copied from the picked claim: there is deliberately no
     * amount input, so a user can never appeal for more than the
     * claim was worth. On approval the settle path pays this amount
     * plus the APPEAL_APOLOGY, exactly like every other appeal. */
    var why = (reason == null) ? '' : String(reason).trim();
    if (!why || !pickedId) { return null; }
    var list = appealableClaims(uid, claims);
    var picked = null;
    for (var i = 0; i < list.length; i++) {
      if ((list[i]._id || list[i].id) === pickedId) { picked = list[i]; break; }
    }
    var amount = picked ? Number(picked.amount) : 0;
    if (!picked || !(amount > 0) || amount > 1000) { return null; }
    return { kind: 'appeal', amount: amount,
      detail: { appealedClaimId: pickedId, appealedKind: picked.kind || '', reason: why } };
  }

  function renderClaims(uid) {
    var container = refxContainer('refx-claims');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Reward claims';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Request sent. Admin approval pending.';
    var noneText = 'No achievements ready to claim yet.';
    var myClaimsText = 'My claims';
    var emptyClaimsText = 'No claims yet.';
    var claimBtnText = 'Claim';
    var invalidText = 'Please complete the form before submitting.';
    return Promise.all([
      loadMyClaims(uid), loadMyLedgerFull(uid),
      loadMyReferralSummary(uid).catch(function () { return { referrals: [], stats: computeStats([], []) }; }),
      readUserDoc(coreDb(), uid).catch(function () { return {}; })
    ]).then(function (parts) {
      var claims = parts[0].claims;
      var ledger = parts[1].entries;
      var summary = parts[2];
      var udoc = parts[3] || {};
      var profileInfo = udoc.profileInfo || {};
      /* Already-claimed = a live claim (pending/approved, not
       * rejected) OR a settled ledger entry for the same kind. Either
       * source disables the button, so a claim can never be filed
       * twice for the same achievement. */
      function alreadyClaimed(kind, match) {
        var hit = false;
        claims.forEach(function (c) {
          if (c.kind === kind && c.status !== 'rejected' && (!match || match(c.detail || {}))) { hit = true; }
        });
        if (!hit) {
          ledger.forEach(function (e) {
            if (e.reason === 'claim settlement' && e.kind === kind && (!match || match(e.detail || {}))) { hit = true; }
          });
        }
        return hit;
      }
      var results = dk2MappedResults();
      var words = lifetimeWords(results);
      var speeds = speedMilestones(results);
      var lessonProg = lessonSetProgress(dk2Lessons(), (typeof window !== 'undefined' && window.LESSONS) ? window.LESSONS : []);
      var wins = { todayTotal: 0, wins: 0 };
      try {
        var rawWins = JSON.parse(window.localStorage.getItem('dk_tf_wins') || '[]');
        wins = typefightWins(rawWins, Date.now());
      } catch (e) {}
      var weekly = weeklyProgress(results, mondayOf(Date.now()));
      var prof = profileCompleteness(profileInfo);
      var now = Date.now();
      var dob = profileInfo.dob || profileInfo.birthdate || '';
      var dobMatch = false;
      if (dob) {
        var dm = new Date(toMs(dob));
        var todayD = new Date(now);
        dobMatch = !isNaN(dm.getTime()) && dm.getMonth() === todayD.getMonth() && dm.getDate() === todayD.getDate();
      }
      var lastPrev = toMs(udoc.lastLoginPrev);
      var lastLogin = toMs(udoc.lastLogin);
      var returnedAfterGap = !isNaN(lastPrev) && !isNaN(lastLogin) && (lastLogin - lastPrev) >= RATES.COMEBACK_ABSENCE_DAYS * 86400000;
      var recentComeback = false;
      claims.forEach(function (c) {
        if (c.kind === 'comeback' && c.status !== 'rejected' && !isNaN(toMs(c.createdAt)) && now - toMs(c.createdAt) < RATES.COMEBACK_MIN_DAYS * 86400000) { recentComeback = true; }
      });
      var amb = ambassadorCounts(summary.referrals || []);
      var maxVerified = 0;
      results.forEach(function (r) { if (r.verified === true && r.wpm > maxVerified) { maxVerified = r.wpm; } });
      var activeCount = (summary.stats && summary.stats.active) || 0;
      var buttons = [];
      Object.keys(RATES.WORD_MILESTONES).forEach(function (k) {
        var th = Number(k);
        if (words >= th) {
          buttons.push({ kind: 'words', label: 'Words ' + th, amount: RATES.WORD_MILESTONES[k], detail: { threshold: th, words: words }, disabled: alreadyClaimed('words', function (d) { return d.threshold === th; }) });
        }
      });
      speeds.forEach(function (th) {
        buttons.push({ kind: 'speed', label: 'Speed ' + th, amount: RATES.SPEED_ACHIEVEMENTS[th], detail: { threshold: th, wpm: maxVerified }, disabled: alreadyClaimed('speed', function (d) { return d.threshold === th; }) });
      });
      lessonProg.setsDone.forEach(function (lv) {
        buttons.push({ kind: 'lesson-set', label: 'Lesson set ' + lv, amount: RATES.LESSON_SET_REWARD, detail: { level: lv }, disabled: alreadyClaimed('lesson-set', function (d) { return d.level === lv; }) });
      });
      if (lessonProg.courseDone) {
        buttons.push({ kind: 'course', label: 'Full course', amount: RATES.COURSE_REWARD, detail: { course: true }, disabled: alreadyClaimed('course', function () { return true; }) });
      }
      var tfClaim = typefightDailyClaim(rawWins, claims, now);
      if (tfClaim.show) {
        buttons.push({ kind: 'typefight-win', label: 'TypeFight win', amount: tfClaim.amount, detail: { date: dayKey(now), wins: tfClaim.unclaimed }, disabled: false });
      }
      if (weekly.done) {
        buttons.push({ kind: 'weekly', label: 'Weekly challenge', amount: RATES.WEEKLY_CHALLENGE.reward, detail: { week: weekKey(now) }, disabled: alreadyClaimed('weekly', function (d) { return d.week === weekKey(now); }) });
      }
      if (prof.complete) {
        buttons.push({ kind: 'profile', label: 'Profile complete', amount: RATES.PROFILE_BONUS, detail: {}, disabled: alreadyClaimed('profile', function () { return true; }) });
      }
      if (dobMatch) {
        buttons.push({ kind: 'birthday', label: 'Birthday', amount: RATES.BIRTHDAY_BONUS, detail: { year: new Date(now).getFullYear() }, disabled: alreadyClaimed('birthday', function (d) { return d.year === new Date(now).getFullYear(); }) });
      }
      if (returnedAfterGap && !recentComeback) {
        buttons.push({ kind: 'comeback', label: 'Comeback', amount: RATES.COMEBACK_BONUS, detail: {}, disabled: alreadyClaimed('comeback', function () { return true; }) });
        /* NO reactivation button here, deliberately (coordinator
         * fix-pass, Oct 26): the reactivation bonus belongs to the
         * REFERRER, so it must never be a self-claim by the returning
         * user — settle pays claim.uid, which would pay the wrong
         * person. Referrers are paid via the admin candidate list +
         * adminGrantReactivation instead. */
      }
      Object.keys(amb).forEach(function (lang) {
        if (lang !== 'unknown' && amb[lang] >= RATES.AMBASSADOR.users) {
          buttons.push({ kind: 'ambassador', label: 'Ambassador ' + lang, amount: RATES.AMBASSADOR.coins, detail: { language: lang }, disabled: alreadyClaimed('ambassador', function (d) { return d.language === lang; }) });
        }
      });
      /* Legendary badges: typing-titan (verified 100+ WPM) and
       * century-club (100 active friends) are user-claimable here.
       * first-100 is ADMIN-GRANTED ONLY and deliberately has no
       * button — an admin verifies the first-100 list, users cannot
       * claim it. */
      if (maxVerified >= 100) {
        buttons.push({ kind: 'legendary', label: 'Legendary typing-titan', amount: RATES.LEGENDARY_COINS, detail: { badgeId: 'typing-titan' }, disabled: alreadyClaimed('legendary', function (d) { return d.badgeId === 'typing-titan'; }) });
      }
      if (activeCount >= 100) {
        buttons.push({ kind: 'legendary', label: 'Legendary century-club', amount: RATES.LEGENDARY_COINS, detail: { badgeId: 'century-club' }, disabled: alreadyClaimed('legendary', function (d) { return d.badgeId === 'century-club'; }) });
      }
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending || parts[1].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      if (!buttons.length) { html.push('<p>' + esc(noneText) + '</p>'); }
      buttons.forEach(function (b, i) {
        html.push('<p>' + esc(b.label) + ' · ' + esc(String(b.amount)) + ' <button class="btn ghost" type="button" data-refx-action="claim" data-refx-kind="' + esc(b.kind) + '" data-refx-amount="' + esc(String(b.amount)) + '" data-refx-idx="' + esc(String(i)) + '"' + (b.disabled ? ' disabled' : '') + '>' + esc(claimBtnText) + '</button></p>');
      });
      /* Bug-report + appeal forms: the two missing creators, in this
       * same container. A successful submit re-renders this whole
       * section through renderClaims(uid) below, so the new claim
       * appears in My claims at once and the appeal picker refreshes
       * (an appealed claim leaves the picker on re-render). The
       * appeal form has deliberately NO amount input — the amount
       * comes from the picked claim in the handler, never from the
       * user. Labels are plain variables in the html-array pattern
       * the rest of this render uses (no new dict keys, no new CSS). */
      var bugTitleText = 'Report a bug';
      var bugDescLabelText = 'What went wrong?';
      var bugSubmitText = 'Report bug';
      var bugAmountNoteText = 'Reward on approval: ' + String(RATES.BUG_BONUS) + ' coins';
      var appealTitleText = 'Appeal a claim';
      var appealPickLabelText = 'Claim to appeal';
      var appealChooseText = 'Choose a claim...';
      var appealReasonLabelText = 'Why should this be reconsidered?';
      var appealSubmitText = 'Submit appeal';
      var appealNoneText = 'No claims available to appeal yet.';
      var appealAmountNoteText = 'The appealed amount is taken from the picked claim. Approval pays it back plus an apology bonus.';
      var appealable = appealableClaims(uid, claims);
      html.push('<h4>' + esc(bugTitleText) + '</h4>');
      html.push('<p>' + esc(bugDescLabelText) + ' <input type="text" data-refx-bug-desc> '
        + '<button class="btn ghost" type="button" data-refx-action="bug">' + esc(bugSubmitText) + '</button></p>');
      html.push('<p>' + esc(bugAmountNoteText) + '</p>');
      html.push('<h4>' + esc(appealTitleText) + '</h4>');
      if (!appealable.length) {
        html.push('<p>' + esc(appealNoneText) + '</p>');
      } else {
        html.push('<p>' + esc(appealPickLabelText) + ' <select data-refx-appeal-pick><option value="">' + esc(appealChooseText) + '</option>');
        appealable.forEach(function (c) {
          var cid = c._id || c.id || '';
          html.push('<option value="' + esc(cid) + '">' + esc((c.kind || '') + ' · ' + String(c.amount) + ' · ' + fmtDate(c.createdAt) + ' · ' + (c.status || '')) + '</option>');
        });
        html.push('</select> ' + esc(appealReasonLabelText) + ' <input type="text" data-refx-appeal-reason> '
          + '<button class="btn ghost" type="button" data-refx-action="appeal">' + esc(appealSubmitText) + '</button></p>');
        html.push('<p>' + esc(appealAmountNoteText) + '</p>');
      }
      html.push('<h4>' + esc(myClaimsText) + '</h4>');
      if (!claims.length) { html.push('<p>' + esc(emptyClaimsText) + '</p>'); }
      else {
        html.push('<ul>');
        claims.forEach(function (c) {
          html.push('<li>' + esc(c.kind || '') + ' · ' + esc(String(c.amount)) + ' · ' + esc(c.status || '') + ' · ' + esc(fmtDate(c.createdAt)) + (c.rejectReason ? ' · ' + esc(c.rejectReason) : '') + '</li>');
        });
        html.push('</ul>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var action = btn.getAttribute('data-refx-action');
        if (action === 'bug' || action === 'appeal') {
          /* Bug/appeal forms: validate through the pure payload
           * builders (the same checks the unit tests cover) — an
           * invalid form notes the problem and never calls
           * createClaim, so no empty report and no invented amount
           * can ever reach the queue. A valid form submits, notes
           * success, and re-renders the whole section. */
          var payload = null;
          if (action === 'bug') {
            var descEl = container.querySelector('[data-refx-bug-desc]');
            payload = bugFormPayload(descEl ? descEl.value : '');
          } else {
            var pickEl = container.querySelector('[data-refx-appeal-pick]');
            var reasonEl = container.querySelector('[data-refx-appeal-reason]');
            payload = appealFormPayload(uid, claims, pickEl ? pickEl.value : '', reasonEl ? reasonEl.value : '');
          }
          if (!payload) { refxNote(container, invalidText); return; }
          btn.disabled = true;
          createClaim(uid, payload.kind, payload.amount, payload.detail).then(function () {
            refxNote(container, sentText);
            renderClaims(uid);
          }).catch(function () {
            refxNote(container, pendingText);
            btn.disabled = false;
          });
          return;
        }
        var idx = Number(btn.getAttribute('data-refx-idx'));

        var b = buttons[idx];
        if (!b) { return; }
        btn.disabled = true;
        createClaim(uid, b.kind, b.amount, b.detail).then(function () {
          refxNote(container, sentText);
          renderClaims(uid);
        }).catch(function () {
          refxNote(container, pendingText);
          btn.disabled = false;
        });
      });
      return true;
    }).catch(function () { return false; });
  }

  function renderPurchases(uid) {
    var container = refxContainer('refx-purchases');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Buy a plan';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Request sent. Admin approval pending.';
    var myPurchasesText = 'My purchases';
    var emptyText = 'No purchases yet.';
    var refundText = 'Request refund';
    return loadMyPurchases(uid).then(function (res) {
      var purchases = res.purchases;
      var opts = [
        { kind: 'pro', label: 'Buy Pro', amount: RATES.PRO_COINS },
        { kind: 'team', label: 'Buy Team', amount: RATES.TEAM_COINS },
        { kind: 'trial', label: 'Buy Trial', amount: RATES.TRIAL_COINS },
        { kind: 'gift', label: 'Buy Gift', amount: RATES.GIFT_COINS },
        { kind: 'upgrade', label: 'Upgrade to Team', amount: RATES.UPGRADE_DIFF },
        { kind: 'renewal', label: 'Renew plan', amount: RATES.PRO_COINS }
      ];
      var giftLabelText = 'Gift recipient code';
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(giftLabelText) + ': <input type="text" id="refx-gift-code"></p>');
      opts.forEach(function (o) {
        html.push('<p>' + esc(o.label) + ' · ' + esc(String(o.amount)) + ' <button class="btn ghost" type="button" data-refx-action="buy" data-refx-kind="' + esc(o.kind) + '">' + esc(o.label) + '</button></p>');
      });
      html.push('<h4>' + esc(myPurchasesText) + '</h4>');
      if (!purchases.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        purchases.forEach(function (p) {
          var refundable = p.status === 'approved' && !isNaN(toMs(p.createdAt)) && Date.now() - toMs(p.createdAt) <= RATES.REFUND.days * 86400000;
          html.push('<li>' + esc(p.kind || '') + ' · ' + esc(String(p.coins)) + ' · ' + esc(p.status || '') + ' · ' + esc(fmtDate(p.createdAt))
            + (refundable ? ' <button class="btn ghost" type="button" data-refx-action="refund" data-refx-id="' + esc(p._id || '') + '">' + esc(refundText) + '</button>' : '') + '</li>');
        });
        html.push('</ul>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var action = btn.getAttribute('data-refx-action');
        if (action === 'buy') {
          var kind = btn.getAttribute('data-refx-kind');
          var purchaseOpts = {};
          if (kind === 'gift') {
            var codeEl = document.getElementById('refx-gift-code');
            if (codeEl && codeEl.value) { purchaseOpts.recipientCode = codeEl.value.trim(); }
          }
          btn.disabled = true;
          requestPurchase(uid, kind, purchaseOpts).then(function () {
            refxNote(container, sentText);
            renderPurchases(uid);
          }).catch(function () {
            refxNote(container, pendingText);
            btn.disabled = false;
          });
        } else if (action === 'refund') {
          var pid = btn.getAttribute('data-refx-id');
          btn.disabled = true;
          requestRefund(uid, pid).then(function () {
            refxNote(container, sentText);
            renderPurchases(uid);
          }).catch(function (err) {
            var msg = (err && err.message) ? err.message : pendingText;
            refxNote(container, msg);
            btn.disabled = false;
          });
        }
      });
      return true;
    }).catch(function () { return false; });
  }

  function renderPools(uid) {
    var container = refxContainer('refx-pools');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Pools';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Request sent. Admin approval pending.';
    var nameLabelText = 'Pool name';
    var createTeamText = 'Create team-plan pool';
    var createTreasuryText = 'Create treasury pool';
    var contributeText = 'Contribute';
    var emptyText = 'No pools yet.';
    return loadMyPools(uid).then(function (res) {
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(nameLabelText) + ': <input type="text" id="refx-pool-name"> '
        + '<button class="btn ghost" type="button" data-refx-action="create-pool" data-refx-purpose="team-plan">' + esc(createTeamText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="create-pool" data-refx-purpose="treasury">' + esc(createTreasuryText) + '</button></p>');
      if (!res.pools.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        res.pools.forEach(function (p) {
          html.push('<li>' + esc(p.name || '') + ' · ' + esc(p.purpose || '') + ' · ' + esc(String(p.balance || 0)) + ' · ' + esc(p.status || '')
            + ' <input type="number" data-refx-poolamt="' + esc(p._id || '') + '"> '
            + '<button class="btn ghost" type="button" data-refx-action="contribute" data-refx-id="' + esc(p._id || '') + '">' + esc(contributeText) + '</button></li>');
        });
        html.push('</ul>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var action = btn.getAttribute('data-refx-action');
        if (action === 'create-pool') {
          var nameEl = document.getElementById('refx-pool-name');
          var poolName = nameEl ? nameEl.value.trim() : '';
          btn.disabled = true;
          createPool(uid, btn.getAttribute('data-refx-purpose'), poolName, 0).then(function () {
            refxNote(container, sentText);
            renderPools(uid);
          }).catch(function () {
            refxNote(container, pendingText);
            btn.disabled = false;
          });
        } else if (action === 'contribute') {
          var pid = btn.getAttribute('data-refx-id');
          var amtEl = container.querySelector('[data-refx-poolamt="' + pid + '"]');
          var amt = amtEl ? Number(amtEl.value) : 0;
          if (!(amt > 0)) { return; }
          btn.disabled = true;
          contributePool(uid, pid, amt).then(function () {
            refxNote(container, sentText);
            renderPools(uid);
          }).catch(function () {
            refxNote(container, pendingText);
            btn.disabled = false;
          });
        }
      });
      return true;
    }).catch(function () { return false; });
  }

  function renderOptOut(uid) {
    var container = refxContainer('refx-optout');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Referral visibility';
    var pendingText = 'Admin approval pending for this feature.';
    return readUserDoc(coreDb(), uid).catch(function () { return {}; }).then(function (udoc) {
      var isPrivate = !!(udoc && udoc.referralPrivate);
      var stateText = isPrivate ? 'Private' : 'Public';
      var toggleText = isPrivate ? 'Show in referral lists' : 'Hide from referral lists';
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      html.push('<p>' + esc(stateText) + ' <button class="btn ghost" type="button" data-refx-action="optout">' + esc(toggleText) + '</button></p>');
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        btn.disabled = true;
        coreDb().collection('users').doc(uid).update({ referralPrivate: !isPrivate }).then(function () {
          renderOptOut(uid);
        }).catch(function () {
          refxNote(container, pendingText);
          btn.disabled = false;
        });
      });
      return true;
    }).catch(function () { return false; });
  }

  function renderFreezeBanner(uid) {
    var container = refxContainer('refx-freeze');
    if (!container || !uid) { return Promise.resolve(false); }
    var frozenText = 'Account frozen after more than a year without activity.';
    return readUserDoc(coreDb(), uid).catch(function () { return {}; }).then(function (udoc) {
      var last = toMs(udoc.lastLogin != null ? udoc.lastLogin : udoc.lastTestAt);
      if (!isFrozen(last, Date.now())) {
        container.innerHTML = '';
        return false;
      }
      container.innerHTML = '<p>' + esc(frozenText) + '</p>';
      return true;
    }).catch(function () { return false; });
  }

  function renderVerification() {
    var container = refxContainer('refx-verify');
    if (!container) { return Promise.resolve(false); }
    var titleText = 'Email verification';
    var verifiedText = 'Email verified';
    var sendText = 'Send verification email';
    var sentText = 'Verification email sent.';
    var unavailableText = 'Verification email is not available here.';
    var auth = null;
    try {
      if (root.DKA && root.DKA.auth) { auth = root.DKA.auth(); }
      else if (root.firebase && root.firebase.auth) { auth = root.firebase.auth(); }
    } catch (e) {}
    var user = auth ? auth.currentUser : null;
    if (!user) { return Promise.resolve(false); }
    var uid = user.uid;
    stampEmailVerified();
    return readUserDoc(coreDb(), uid).catch(function () { return {}; }).then(function (udoc) {
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (user.emailVerified) {
        var stampText = udoc.emailVerifiedAt ? fmtDateTime(udoc.emailVerifiedAt) : '';
        html.push('<p>' + esc(verifiedText) + (stampText ? ' · ' + esc(stampText) : '') + '</p>');
      } else {
        html.push('<p><button class="btn ghost" type="button" data-refx-action="verify">' + esc(sendText) + '</button></p>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        btn.disabled = true;
        try {
          if (user.sendEmailVerification) {
            user.sendEmailVerification().then(function () {
              refxNote(container, sentText);
            }).catch(function () {
              refxNote(container, unavailableText);
              btn.disabled = false;
            });
          } else {
            refxNote(container, unavailableText);
            btn.disabled = false;
          }
        } catch (e) {
          refxNote(container, unavailableText);
          btn.disabled = false;
        }
      });
      return true;
    }).catch(function () { return false; });
  }

  /* ================= CORE-2: referral-complete (contest, boards, goals,
   * challenges, featured, ambassador, QR, pair streak, battles,
   * shoutouts, posters, season pass, treasury UI, coach/forecast,
   * globe, quarterly summary, admin queue) ============================
   * WHY this block exists separately: CORE-1 settled claims, purchases,
   * pools and treasury spends. CORE-2 only ADDS public boards, social
   * features and admin queue views on top of those same settlement
   * paths — every coin here still moves ONLY through payUser /
   * adminSettleClaim / adminApprovePurchase, never a new credit path.
   * Until the owner publishes the new rules text, writes to the new
   * collections fail with permission-denied; every load below turns
   * that into an honest rulesPending flag, never a crash or fake
   * success. Globe is PARTIAL by design: an opt-in city list, never a
   * geographic map (no map asset, no geo data collected). Posters are
   * template posters drawn on canvas, never labelled as model-made
   * (Doki is KB-only and key-free). No new dkT keys: all new user-visible
   * strings are plain variables, the Task 9 gate-safe pattern. */

  /* ---------- CORE-2 pure helpers (DOM-free, Node-testable) ---------- */
  function countActivations(rows, targetKey, keyFn) {
    /* Counts activations per referrerUid whose rewardedAt falls in the
     * target period. Historical by rewardedAt: a later pause does not
     * rewrite the month/week the activation happened in. */
    var counts = {};
    (rows || []).forEach(function (r) {
      if (!r || !r.referrerUid) { return; }
      var t = toMs(r.rewardedAt);
      if (isNaN(t)) { return; }
      if (keyFn(t) !== targetKey) { return; }
      counts[r.referrerUid] = (counts[r.referrerUid] || 0) + 1;
    });
    return counts;
  }
  function sortCounts(counts, keyName, countName) {
    var out = [];
    Object.keys(counts).forEach(function (k) {
      var row = {};
      row[keyName] = k;
      row[countName] = counts[k];
      out.push(row);
    });
    out.sort(function (a, b) {
      if (b[countName] !== a[countName]) { return b[countName] - a[countName]; }
      return a[keyName] < b[keyName] ? -1 : (a[keyName] > b[keyName] ? 1 : 0);
    });
    return out;
  }
  function contestTally(rows, mk) {
    var tallied = sortCounts(countActivations(rows, mk, monthKey), 'uid', 'count');
    return tallied;
  }
  function battleTeams(rows, wk) {
    return sortCounts(countActivations(rows, wk, weekKey), 'referrerUid', 'score');
  }
  function boardEntries(optedUids, rows, wk) {
    /* Opt-in ONLY: a referrer counts only when their users doc has
     * leaderboardOptIn === true. Non-opted-in referrers are excluded
     * here, at publish-compute time — the published board can never
     * leak them, because they never enter its entries. */
    var opted = {};
    (optedUids || []).forEach(function (u) { opted[u] = true; });
    var counts = {};
    (rows || []).forEach(function (r) {
      if (!r || !opted[r.referrerUid]) { return; }
      var t = toMs(r.rewardedAt);
      if (isNaN(t) || weekKey(t) !== wk) { return; }
      counts[r.referrerUid] = (counts[r.referrerUid] || 0) + 1;
    });
    var out = [];
    Object.keys(counts).forEach(function (uid) {
      out.push({ uid: uid, label: uid, count: counts[uid] });
    });
    out.sort(function (a, b) {
      if (b.count !== a.count) { return b.count - a.count; }
      return a.uid < b.uid ? -1 : (a.uid > b.uid ? 1 : 0);
    });
    return out;
  }
  function quarterBounds(key) {
    var m = /^(\d{4})-Q([1-4])$/.exec(key || '');
    if (!m) { return { key: key || '', startMs: NaN, endMs: NaN }; }
    var y = Number(m[1]);
    var q = Number(m[2]);
    return { key: key, startMs: new Date(y, (q - 1) * 3, 1).getTime(), endMs: new Date(y, q * 3, 1).getTime() };
  }
  function quarterlySummary(data, qkey) {
    /* Quarter attribution is by createdAt (filing/creation quarter)
     * for every collection, because settlement dates are admin-side
     * and not consistently recorded — one rule, stated here, so the
     * summary can never silently mix quarters. Undated rows are
     * excluded, never guessed into a quarter. */
    var b = quarterBounds(qkey);
    function inQ(v) {
      var t = toMs(v);
      return !isNaN(t) && t >= b.startMs && t < b.endMs;
    }
    var d = data || {};
    var refs = (d.referrals || []).filter(function (r) { return inQ(r.createdAt); });
    var activeRefs = refs.filter(function (r) { return normalizeStatus(r) === 'active'; });
    var claims = (d.claims || []).filter(function (c) { return c.status === 'approved' && inQ(c.createdAt); });
    var purchases = (d.purchases || []).filter(function (p) { return p.status === 'approved' && inQ(p.createdAt); });
    var pools = (d.pools || []).filter(function (p) { return inQ(p.createdAt); });
    function sum(rows, field) {
      var total = 0;
      rows.forEach(function (r) { total += Number(r[field]) || 0; });
      return total;
    }
    return {
      quarter: qkey, referralsTotal: refs.length, referralsActive: activeRefs.length,
      claimsSettledCount: claims.length, claimsSettledTotal: sum(claims, 'amount'),
      purchasesApprovedCount: purchases.length, purchasesApprovedTotal: sum(purchases, 'coins'),
      poolsCount: pools.length, poolsBalanceTotal: sum(pools, 'balance')
    };
  }
  function globeCityCounts(pins) {
    var counts = {};
    (pins || []).forEach(function (p) {
      if (p && p.city) { counts[p.city] = (counts[p.city] || 0) + 1; }
    });
    var out = [];
    Object.keys(counts).forEach(function (c) { out.push({ city: c, count: counts[c] }); });
    out.sort(function (a, b) {
      if (b.count !== a.count) { return b.count - a.count; }
      return a.city < b.city ? -1 : (a.city > b.city ? 1 : 0);
    });
    return out;
  }
  function seasonChestAmount(doneCount) {
    /* 100 per quest done, plus 200 only when all 3 are done:
     * 0/1/2/3 quests -> 0/100/200/500. The badge itself is attached
     * only on the all-3 claim (see renderSeason), never on a partial
     * chest — Part 1 settle appends the badge only when detail
     * carries a badgeId. */
    var n = Number(doneCount) || 0;
    if (n < 0) { n = 0; }
    if (n > 3) { n = 3; }
    return 100 * n + (n === 3 ? RATES.SEASON_CHEST.allBonus : 0);
  }
  function usersList(users) {
    if (Array.isArray(users)) { return users; }
    var out = [];
    if (users && typeof users === 'object') {
      Object.keys(users).forEach(function (uid) {
        var doc = users[uid] || {};
        doc.uid = doc.uid || uid;
        out.push(doc);
      });
    }
    return out;
  }
  function computeReactivationCandidates(users, nowMs) {
    /* A candidate returned after a >30-day gap (lastLogin minus
     * lastLoginPrev) AND tested since returning (lastTestAt on or
     * after lastLogin). The grant itself pays the REFERRER, so the
     * candidate carries referrerId for the grant button. */
    var out = [];
    usersList(users).forEach(function (u) {
      if (!u) { return; }
      var uid = u.uid || u._id;
      if (!uid) { return; }
      var prev = toMs(u.lastLoginPrev);
      var last = toMs(u.lastLogin);
      var test = toMs(u.lastTestAt);
      if (isNaN(prev) || isNaN(last) || isNaN(test)) { return; }
      if (last - prev <= RATES.REACTIVATION_ABSENCE * 86400000) { return; }
      if (test < last) { return; }
      out.push({ uid: uid, referrerId: u.referrerId || '', gapDays: Math.floor((last - prev) / 86400000) });
    });
    return out;
  }
  function computeFreezeList(users, nowMs) {
    /* lastActive is the later of lastLogin / lastTestAt; a user with
     * neither date cannot be proven frozen, so they are excluded. */
    var now = isNaN(toMs(nowMs)) ? Date.now() : toMs(nowMs);
    var out = [];
    usersList(users).forEach(function (u) {
      if (!u) { return; }
      var uid = u.uid || u._id;
      if (!uid) { return; }
      var login = toMs(u.lastLogin);
      var test = toMs(u.lastTestAt);
      var last = NaN;
      if (!isNaN(login)) { last = login; }
      if (!isNaN(test) && (isNaN(last) || test > last)) { last = test; }
      if (isFrozen(last, now)) { out.push({ uid: uid, lastActive: last }); }
    });
    return out;
  }
  function computeUnverifiedList(users) {
    /* Referred users only (a referrerId exists) who lack
     * emailVerifiedAt — organic users without a referrer are not an
     * admin follow-up list for the referral programme. */
    var out = [];
    usersList(users).forEach(function (u) {
      if (!u) { return; }
      var uid = u.uid || u._id;
      if (!uid || !u.referrerId || u.emailVerifiedAt) { return; }
      out.push({ uid: uid, referrerId: u.referrerId });
    });
    return out;
  }
  function ledgerHasFiltered(d, uid, field, value, reason) {
    /* Single-field ledger query + client-side reason filter — the
     * design §3 pattern, so no composite index is ever required. */
    return d.collection('users').doc(uid).collection('coin_ledger')
      .where(field, '==', value).get().then(function (snap) {
        var found = false;
        snap.forEach(function (doc) {
          var dd = doc.data() || {};
          if (!reason || dd.reason === reason) { found = true; }
        });
        return found;
      });
  }

  /* ---------- CORE-2 loads ---------- */
  function loadPublicDoc(collection, id) {
    var d = coreDb();
    if (!d || !collection || !id) { return Promise.resolve({ doc: null, rulesPending: false }); }
    return d.collection(collection).doc(id).get().then(function (snap) {
      if (!snap || !snap.exists) { return { doc: null, rulesPending: false }; }
      var doc = snap.data() || {};
      doc._id = snap.id;
      return { doc: doc, rulesPending: false };
    }).catch(function (err) { return { doc: null, rulesPending: isPermDenied(err) }; });
  }
  function loadGlobePins() {
    var d = coreDb();
    if (!d) { return Promise.resolve({ pins: [], rulesPending: false }); }
    return d.collection('globe_pins').get()
      .then(function (snap) { return { pins: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { pins: [], rulesPending: isPermDenied(err) }; });
  }
  function loadMyCoinClaims(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve({ claims: [], rulesPending: false }); }
    return d.collection('coin_claims').where('uid', '==', uid).get()
      .then(function (snap) { return { claims: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { claims: [], rulesPending: isPermDenied(err) }; });
  }
  function loadMyChallenges(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve({ challenges: [], rulesPending: false }); }
    function one(field) {
      return d.collection('challenges').where(field, '==', uid).get()
        .then(function (snap) { return { rows: snapshotRows(snap), denied: false }; })
        .catch(function (err) { return { rows: [], denied: isPermDenied(err) }; });
    }
    return Promise.all([one('fromUid'), one('toUid')]).then(function (parts) {
      var seen = {};
      var out = [];
      parts.forEach(function (p) {
        p.rows.forEach(function (r) {
          if (!seen[r._id]) { seen[r._id] = true; out.push(r); }
        });
      });
      return { challenges: out, rulesPending: parts[0].denied || parts[1].denied };
    });
  }
  function loadAdminQueue() {
    var d = coreDb();
    var empty = { claims: [], purchases: [], contributions: [], reactivationCandidates: [], deviceClusters: {}, freezeList: [], unverifiedList: [], qrJoins: 0, rulesPending: false };
    if (!d) { return Promise.resolve(empty); }
    function safe(promise) {
      return promise.then(function (rows) { return { rows: rows, denied: false }; })
        .catch(function (err) { return { rows: [], denied: isPermDenied(err) }; });
    }
    return Promise.all([
      safe(adminListClaims('pending')),
      safe(d.collection('plan_purchases').where('status', '==', 'pending').get().then(snapshotRows)),
      safe(d.collection('pool_contributions').where('status', '==', 'pending').get().then(snapshotRows)),
      safe(d.collection('users').get().then(snapshotRows)),
      safe(d.collection('referrals').get().then(snapshotRows)),
      safe(d.collection('typing_activations').get().then(snapshotRows))
    ]).then(function (parts) {
      var users = parts[3].rows;
      var refs = parts[4].rows;
      var denied = false;
      parts.forEach(function (p) { if (p.denied) { denied = true; } });
      var qr = 0;
      refs.forEach(function (r) { if (r && r.source === 'qr') { qr++; } });
      return {
        claims: parts[0].rows, purchases: parts[1].rows, contributions: parts[2].rows,
        reactivationCandidates: computeReactivationCandidates(users, Date.now()),
        deviceClusters: deviceDuplicateMap(users),
        freezeList: computeFreezeList(users, Date.now()),
        unverifiedList: computeUnverifiedList(users),
        qrJoins: qr, rulesPending: denied
      };
    });
  }

  /* ---------- CORE-2 backend: contests, boards, goals ---------- */
  function adminComputeContestTally(mk) {
    var d = coreDb();
    var missingMsg = 'Missing contest month.';
    if (!d || !mk) { return Promise.reject(coreErr(missingMsg)); }
    return d.collection('referrals').get().then(function (snap) {
      return contestTally(snapshotRows(snap), mk);
    });
  }
  function adminPublishContest(adminUid, mk, winners, bonusPool) {
    var d = coreDb();
    var missingMsg = 'Missing contest publish input.';
    if (!d || !adminUid || !mk) { return Promise.reject(coreErr(missingMsg)); }
    var pool = Number(bonusPool) || 0;
    /* Prizes are fixed at publish time so pay can never recompute a
     * different prize later: top 3 take CONTEST_PRIZES, and the
     * bonusPool is added to 1st prize ONLY (documented rule — the
     * pool is a top-prize top-up, never spread across ranks). A
     * caller-supplied prize is kept, so a corrected re-publish is
     * possible without changing this function. */
    var mapped = (winners || []).map(function (w, i) {
      var prize = (w.prize != null) ? Number(w.prize) : 0;
      if (w.prize == null) {
        if (i < 3) { prize = RATES.CONTEST_PRIZES[i] + (i === 0 ? pool : 0); }
      }
      return { uid: w.uid, count: Number(w.count) || 0, prize: prize };
    });
    return d.collection('contest_winners').doc(mk).set({
      winners: mapped, bonusPool: pool, status: 'published', publishedAt: serverTimestamp()
    }).then(function () { return { monthKey: mk, winners: mapped, bonusPool: pool }; });
  }
  function adminPayContest(adminUid, mk) {
    var d = coreDb();
    var missingMsg = 'Missing contest payment input.';
    if (!d || !adminUid || !mk) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('contest_winners').doc(mk);
    return ref.get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Contest not found.';
      if (!doc) { throw coreErr(notFoundMsg); }
      if (doc.status === 'paid') { return { alreadyPaid: true, paid: 0, winnersPaid: [] }; }
      var winners = doc.winners || [];
      var pool = Number(doc.bonusPool) || 0;
      var seq = Promise.resolve();
      var total = 0;
      var paidUids = [];
      winners.forEach(function (w, i) {
        seq = seq.then(function () {
          var amount = (w.prize != null) ? Number(w.prize) : 0;
          if (w.prize == null && i < 3) { amount = RATES.CONTEST_PRIZES[i] + (i === 0 ? pool : 0); }
          if (!(amount > 0) || !w.uid) { return; }
          /* Ledger-first idempotency: ANY 'contest prize' entry for
           * this monthKey means this winner already paid, so a
           * retried pay skips them instead of double-paying. */
          return ledgerHasFiltered(d, w.uid, 'monthKey', mk, 'contest prize').then(function (already) {
            if (already) { return false; }
            return payUser(d, adminUid, w.uid, amount, { reason: 'contest prize', monthKey: mk, rank: i + 1, docId: 'contest-' + mk }).then(function () { return true; });
          }).then(function (paidIt) {
            /* Only a fresh payment counts toward the reported total:
             * a skipped (already-paid) winner must not inflate it, or
             * a resumed pay would report coins it never moved. */
            if (paidIt) { total += amount; paidUids.push(w.uid); }
          });
        });
      });
      return seq.then(function () {
        return ref.update({ status: 'paid' });
      }).then(function () { return { alreadyPaid: false, paid: total, winnersPaid: paidUids }; });
    });
  }
  function adminComputeBoard(wk) {
    var d = coreDb();
    var missingMsg = 'Missing leaderboard week.';
    if (!d || !wk) { return Promise.reject(coreErr(missingMsg)); }
    return Promise.all([
      d.collection('users').where('leaderboardOptIn', '==', true).get().then(snapshotRows),
      d.collection('referrals').get().then(snapshotRows)
    ]).then(function (parts) {
      var opted = parts[0].map(function (u) { return u._id; });
      return boardEntries(opted, parts[1], wk);
    });
  }
  function adminPublishBoard(adminUid, wk, entries) {
    var d = coreDb();
    var missingMsg = 'Missing leaderboard publish input.';
    if (!d || !adminUid || !wk) { return Promise.reject(coreErr(missingMsg)); }
    /* Stored shape matches the design exactly: label + count only.
     * The uid is the label here (no display names are invented for
     * a public board), so nothing is lost by the mapping. */
    var mapped = (entries || []).map(function (e) {
      return { label: e.label || e.uid || '', count: Number(e.count) || 0 };
    });
    return d.collection('leaderboard_boards').doc(wk).set({
      entries: mapped, publishedAt: serverTimestamp()
    }).then(function () { return true; });
  }
  function adminSetGoal(adminUid, target, month) {
    var d = coreDb();
    var badMsg = 'Goal needs a positive target and a month.';
    if (!d || !adminUid || !(Number(target) > 0) || !month) { return Promise.reject(coreErr(badMsg)); }
    /* Doc id IS the month, so one goal per month and distribute can
     * find it by the same id — no separate goal-id registry needed. */
    return d.collection('community_goals').doc(month).set({
      target: Number(target), current: 0, month: month, status: 'open', publishedAt: serverTimestamp()
    }).then(function () { return { goalId: month }; });
  }
  function adminDistributeGoal(adminUid, goalId) {
    var d = coreDb();
    var missingMsg = 'Missing goal distribution input.';
    if (!d || !adminUid || !goalId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('community_goals').doc(goalId);
    return ref.get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Community goal not found.';
      if (!doc) { throw coreErr(notFoundMsg); }
      return doc;
    }).then(function (doc) {
      var goalMonth = doc.month || goalId;
      return Promise.all([
        d.collection('users').get().then(snapshotRows),
        d.collection('typing_activations').get().then(snapshotRows)
      ]).then(function (parts) {
        var users = parts[0];
        var acts = parts[1];
        /* Active = a typing activation created in the goal month OR
         * a lastLogin in the goal month. SCALE NOTE (design §8):
         * the admin iterates the whole users list — fine for a small
         * community, a documented limit, not a hidden one. */
        var activeByTest = {};
        acts.forEach(function (a) {
          if (a && a.userId && monthKey(toMs(a.createdAt)) === goalMonth) { activeByTest[a.userId] = true; }
        });
        var recipients = [];
        users.forEach(function (u) {
          var uid = u._id;
          if (!uid) { return; }
          if (activeByTest[uid] || monthKey(toMs(u.lastLogin)) === goalMonth) { recipients.push(uid); }
        });
        var seq = Promise.resolve();
        var total = 0;
        var paidUids = [];
        recipients.forEach(function (uid) {
          seq = seq.then(function () {
            return ledgerHasFiltered(d, uid, 'goalId', goalId, 'community goal').then(function (already) {
              if (already) { return false; }
              return payUser(d, adminUid, uid, RATES.COMMUNITY_GOAL_REWARD, { reason: 'community goal', goalId: goalId, docId: 'goal-' + goalId }).then(function () { return true; });
            }).then(function (paidIt) {
              if (paidIt) { total += RATES.COMMUNITY_GOAL_REWARD; paidUids.push(uid); }
            });
          });
        });
        return seq.then(function () {
          return ref.update({ status: 'distributed' });
        }).then(function () { return { paid: total, recipients: paidUids }; });
      });
    });
  }

  /* ---------- CORE-2 backend: challenges, featured, reactivation ------
   * Challenge flag rule (WHY per-side flags exist): the rules let each
   * party flip ONLY its own done flag, never the other side's and
   * never status done/rewarded — those flips are admin-only. The
   * reward itself is per-side reward_claims (kind 'challenge'), because
   * adminSettleClaim pays one uid per claim; a single joint claim
   * could never pay both sides. The admin verifies BOTH flags before
   * settling either side's claim. */
  function createChallenge(uid, inviteeCode) {
    var d = coreDb();
    var badMsg = 'Challenge needs a challenger and an invitee code.';
    if (!d || !uid || !inviteeCode) { return Promise.reject(coreErr(badMsg)); }
    /* toUid starts EMPTY: the invitee sets it to their own uid when
     * accepting (see acceptChallenge). The challenger never
     * pre-resolves it, so no uid can be forged into the challenge. */
    return d.collection('challenges').add({
      fromUid: uid, toCode: inviteeCode, toUid: '', status: 'pending',
      fromDone: false, toDone: false, createdAt: serverTimestamp()
    });
  }
  function acceptChallenge(uid, challengeId) {
    var d = coreDb();
    var missingMsg = 'Missing challenge accept input.';
    if (!d || !uid || !challengeId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('challenges').doc(challengeId);
    return ref.get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Challenge not found.';
      if (!doc) { throw coreErr(notFoundMsg); }
      var staleMsg = 'Challenge is no longer pending.';
      if (doc.status !== 'pending') { throw coreErr(staleMsg); }
      var takenMsg = 'This challenge was already accepted by someone else.';
      if (doc.toUid && doc.toUid !== uid) { throw coreErr(takenMsg); }
      /* Accept sets toUid + status accepted in one write — the only
       * toUid write a non-admin ever makes on this doc. */
      return ref.update({ toUid: uid, status: 'accepted' });
    }).then(function () { return true; });
  }
  function challengeDoneMarker() {
    /* Marker shapes (typing.js hook): JSON {challengeId, at} or a
     * bare string id. Anything else — missing, malformed, or for a
     * different challenge — means "no completed challenge here", and
     * the confirm below refuses rather than guessing. */
    try {
      var raw = null;
      if (root.localStorage && root.localStorage.getItem) { raw = root.localStorage.getItem('dk_challenge_done'); }
      else if (typeof localStorage !== 'undefined' && localStorage.getItem) { raw = localStorage.getItem('dk_challenge_done'); }
      if (!raw) { return null; }
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') { return parsed.challengeId || null; }
        return parsed;
      } catch (e) { return raw; }
    } catch (e) { return null; }
  }
  function clearChallengeDoneMarker() {
    try {
      if (root.localStorage && root.localStorage.removeItem) { root.localStorage.removeItem('dk_challenge_done'); }
    } catch (e) {}
  }
  function confirmChallengeDone(uid, challengeId) {
    var d = coreDb();
    var missingMsg = 'Missing challenge confirm input.';
    if (!d || !uid || !challengeId) { return Promise.reject(coreErr(missingMsg)); }
    var marker = challengeDoneMarker();
    var noMarkerMsg = 'No completed challenge found for this challenge. Finish a typing test first.';
    if (marker !== challengeId) { return Promise.reject(coreErr(noMarkerMsg)); }
    var ref = d.collection('challenges').doc(challengeId);
    return ref.get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Challenge not found.';
      if (!doc) { throw coreErr(notFoundMsg); }
      /* Each side flips ONLY its own flag: the challenger flips
       * fromDone, the invitee flips toDone, nobody touches the other
       * flag or the status. The marker is cleared ONLY after the
       * write succeeds, so a failed confirm stays retryable. */
      if (doc.fromUid === uid) {
        return ref.update({ fromDone: true }).then(function () { clearChallengeDoneMarker(); return true; });
      }
      if (doc.toUid === uid) {
        return ref.update({ toDone: true }).then(function () { clearChallengeDoneMarker(); return true; });
      }
      var notPartyMsg = 'You are not part of this challenge.';
      throw coreErr(notPartyMsg);
    });
  }
  function adminSetChallengeStatus(adminUid, challengeId, status) {
    var d = coreDb();
    var valid = ['pending', 'accepted', 'done', 'rewarded'].indexOf(status) !== -1;
    var badMsg = 'Unknown challenge status.';
    if (!d || !adminUid || !challengeId || !valid) { return Promise.reject(coreErr(badMsg)); }
    return d.collection('challenges').doc(challengeId).update({ status: status }).then(function () { return true; });
  }
  function adminFeatureContent(adminUid, uid, featuredId) {
    var d = coreDb();
    var missingMsg = 'Missing featured payment input.';
    if (!d || !adminUid || !uid || !featuredId) { return Promise.reject(coreErr(missingMsg)); }
    /* Idempotency is the featuredId itself: ANY ledger entry carrying
     * it means this piece already paid, whatever its reason field. */
    return ledgerHasFiltered(d, uid, 'featuredId', featuredId, null).then(function (already) {
      var dupMsg = 'This featured piece was already paid.';
      if (already) { throw coreErr(dupMsg); }
      return payUser(d, adminUid, uid, RATES.FEATURED_REWARD, { reason: 'featured', featuredId: featuredId, docId: 'featured-' + featuredId });
    }).then(function () {
      /* Item #35: the homepage slot reads ONLY the public board,
       * so featuring must also publish the board doc — same doc
       * id as the payment's featuredId, so a re-feature overwrites
       * instead of duplicating. Board failure never fails the
       * payment (the pay already happened; the board is display). */
      return readUserDoc(d, uid).catch(function () { return {}; }).then(function (udoc) {
        return d.collection('showcase_boards').doc('feat-' + featuredId).set({
          kind: 'featured', label: boardLabelFor(udoc), note: featuredId, sourceId: featuredId, publishedAt: serverTimestamp()
        }).catch(function () { return true; });
      }).then(function () { return RATES.FEATURED_REWARD; });
    });
  }
  function adminGrantReactivation(adminUid, inviteeUid, referrerUid) {
    var d = coreDb();
    var missingMsg = 'Missing reactivation grant input.';
    if (!d || !adminUid || !inviteeUid || !referrerUid) { return Promise.reject(coreErr(missingMsg)); }
    var mk = monthKey(new Date());
    /* Idempotency key is (reason + inviteeUid + current monthKey):
     * one reactivation bonus per invitee per month, never more. */
    return d.collection('users').doc(referrerUid).collection('coin_ledger')
      .where('inviteeUid', '==', inviteeUid).get().then(function (snap) {
        var paid = false;
        snap.forEach(function (doc) {
          var dd = doc.data() || {};
          if (dd.reason === 'reactivation bonus' && dd.monthKey === mk) { paid = true; }
        });
        return paid;
      }).then(function (already) {
        var dupMsg = 'Reactivation bonus already paid this month.';
        if (already) { throw coreErr(dupMsg); }
        return payUser(d, adminUid, referrerUid, RATES.REACTIVATION_BONUS,
          { reason: 'reactivation bonus', inviteeUid: inviteeUid, monthKey: mk, docId: inviteeUid + '-' + mk });
      }).then(function () { return RATES.REACTIVATION_BONUS; });
  }

  /* ---------- CORE-2 backend: battles, shoutouts, globe, QR ---------- */
  function adminComputeBattleTeams(wk) {
    var d = coreDb();
    var missingMsg = 'Missing battle week.';
    if (!d || !wk) { return Promise.reject(coreErr(missingMsg)); }
    return d.collection('referrals').get().then(function (snap) {
      return battleTeams(snapshotRows(snap), wk);
    });
  }
  function adminPublishBattle(adminUid, wk, teams, winnerUid) {
    var d = coreDb();
    var missingMsg = 'Missing battle publish input.';
    if (!d || !adminUid || !wk || !winnerUid) { return Promise.reject(coreErr(missingMsg)); }
    var mapped = (teams || []).map(function (t) {
      return { referrerUid: t.referrerUid, score: Number(t.score) || 0 };
    });
    return d.collection('battles').doc(wk).set({
      teams: mapped, winnerUid: winnerUid, pool: RATES.BATTLE_POOL, status: 'published', publishedAt: serverTimestamp()
    }).then(function () {
      /* Item #52: winning-team badge. The team is identified by its
       * captain (winnerUid), so the captain earns 'battle-champion'
       * once, append-only like every other badge — a re-publish never
       * duplicates it, and a badge failure never fails the publish
       * (the board is the source of truth; members are paid separately
       * at pay time). */
      return d.collection('users').doc(winnerUid).get().then(function (snap) {
        var udoc = (snap && snap.exists) ? (snap.data() || {}) : {};
        var badges = Array.isArray(udoc.badges) ? udoc.badges.slice() : [];
        if (badges.indexOf('battle-champion') !== -1) { return true; }
        badges.push('battle-champion');
        return d.collection('users').doc(winnerUid).update({ badges: badges }).then(function () { return true; });
      }).catch(function () { return true; });
    });
  }
  function adminPayBattle(adminUid, wk) {
    var d = coreDb();
    var missingMsg = 'Missing battle payment input.';
    if (!d || !adminUid || !wk) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('battles').doc(wk);
    return ref.get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Battle not found.';
      if (!doc) { throw coreErr(notFoundMsg); }
      if (doc.status === 'paid') {
        return { alreadyPaid: true, paid: 0, share: 0, members: [], remainder: Number(doc.pool) || RATES.BATTLE_POOL };
      }
      var winnerUid = doc.winnerUid;
      var pool = Number(doc.pool) || RATES.BATTLE_POOL;
      return d.collection('referrals').get().then(function (rsnap) {
        var seen = {};
        var members = [];
        snapshotRows(rsnap).forEach(function (r) {
          if (!r || r.referrerUid !== winnerUid || normalizeStatus(r) !== 'active') { return; }
          var mid = r._id || r.inviteeUid;
          if (mid && !seen[mid]) { seen[mid] = true; members.push(mid); }
        });
        var noMembersMsg = 'The winning team has no active members to pay.';
        if (!members.length) { throw coreErr(noMembersMsg); }
        /* Floor share each; the remainder is NOT kept silently — it
         * is returned and stored on the doc as unallocated. */
        var share = Math.floor(pool / members.length);
        var remainder = pool - share * members.length;
        var seq = Promise.resolve();
        var paidUids = [];
        var total = 0;
        members.forEach(function (mid) {
          seq = seq.then(function () {
            return ledgerHasFiltered(d, mid, 'weekKey', wk, 'battle prize').then(function (already) {
              if (already) { return false; }
              return payUser(d, adminUid, mid, share, { reason: 'battle prize', weekKey: wk, docId: 'battle-' + wk }).then(function () { return true; });
            }).then(function (paidIt) {
              if (paidIt) { total += share; paidUids.push(mid); }
            });
          });
        });
        return seq.then(function () {
          return ref.update({ status: 'paid', share: share, remainder: remainder });
        }).then(function () { return { alreadyPaid: false, paid: total, share: share, members: paidUids, remainder: remainder }; });
      });
    });
  }
  function adminPublishShoutout(adminUid, mk, uid, story) {
    var d = coreDb();
    var missingMsg = 'Missing shoutout publish input.';
    if (!d || !adminUid || !mk || !uid) { return Promise.reject(coreErr(missingMsg)); }
    return d.collection('shoutouts').doc(mk).set({
      uid: uid, story: story || '', prize: RATES.SHOUTOUT_PRIZE, status: 'published', publishedAt: serverTimestamp()
    }).then(function () { return true; });
  }
  function adminPayShoutout(adminUid, mk) {
    var d = coreDb();
    var missingMsg = 'Missing shoutout payment input.';
    if (!d || !adminUid || !mk) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('shoutouts').doc(mk);
    return ref.get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Shoutout not found.';
      if (!doc) { throw coreErr(notFoundMsg); }
      if (doc.status === 'paid') { return { alreadyPaid: true, paid: 0 }; }
      return ledgerHasFiltered(d, doc.uid, 'monthKey', mk, 'shoutout').then(function (already) {
        if (already) {
          return ref.update({ status: 'paid' }).then(function () { return { alreadyPaid: true, paid: 0 }; });
        }
        return payUser(d, adminUid, doc.uid, RATES.SHOUTOUT_PRIZE, { reason: 'shoutout', monthKey: mk, docId: 'shoutout-' + mk }).then(function () {
          return ref.update({ status: 'paid' });
        }).then(function () { return { alreadyPaid: false, paid: RATES.SHOUTOUT_PRIZE }; });
      });
    });
  }
  function createGlobePin(uid, city) {
    var d = coreDb();
    var cityText = (city || '').trim ? city.trim() : String(city || '');
    var badMsg = 'A globe pin needs a city name.';
    if (!d || !uid || !cityText || cityText.length > 100) { return Promise.reject(coreErr(badMsg)); }
    /* City-level ONLY, opt-in ONLY: the renderer creates a pin only
     * from the explicit opt-in form, never from any other data. */
    return d.collection('globe_pins').add({ uid: uid, city: cityText, createdAt: serverTimestamp() });
  }
  function deleteGlobePin(uid, pinId) {
    var d = coreDb();
    var missingMsg = 'Missing globe pin input.';
    if (!d || !uid || !pinId) { return Promise.reject(coreErr(missingMsg)); }
    return d.collection('globe_pins').doc(pinId).delete().then(function () { return true; });
  }
  function qrReferralLink(uid, signupBase) {
    /* QR variant of the share link: the same referral link with a
     * qr=1 marker, so a signup arriving through it can be attributed
     * as a QR join. Signup capture itself is NOT changed here — that
     * is a coordinator follow-up; until it lands, rows carry no
     * source and the UI honestly reports no QR joins recorded. */
    return referralLink(uid, signupBase) + '&qr=1';
  }

  /* ---------- CORE-2 renders: contest, leaderboard, goal ---------- */
  function renderContest() {
    var container = refxContainer('refx-contest');
    if (!container) { return Promise.resolve(false); }
    var titleText = 'Monthly contest';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No contest published for this month yet.';
    var countText = 'Referrals';
    var prizeText = 'Prize';
    var bonusText = 'Bonus pool';
    return loadPublicDoc('contest_winners', monthKey(new Date())).then(function (res) {
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      else if (!res.doc) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        var winners = res.doc.winners || [];
        if (!winners.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
        else {
          html.push('<ul>');
          winners.forEach(function (w, i) {
            html.push('<li>' + esc(String(i + 1)) + ' · ' + esc(w.uid || '') + ' · ' + esc(countText) + ': ' + esc(String(w.count || 0)) + ' · ' + esc(prizeText) + ': ' + esc(String(w.prize || 0)) + '</li>');
          });
          html.push('</ul>');
        }
        if (res.doc.bonusPool) { html.push('<p>' + esc(bonusText) + ': ' + esc(String(res.doc.bonusPool)) + '</p>'); }
      }
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }
  function renderLeaderboard(uid) {
    var container = refxContainer('refx-leaderboard');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Weekly leaderboard';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No leaderboard published for this week yet.';
    var crownText = 'Crown';
    var optNoteText = 'Only members who opt in appear on this board.';
    return Promise.all([
      loadPublicDoc('leaderboard_boards', weekKey(new Date())),
      readUserDoc(coreDb(), uid).catch(function () { return {}; })
    ]).then(function (parts) {
      var doc = parts[0].doc;
      var udoc = parts[1] || {};
      var opted = !!udoc.leaderboardOptIn;
      var stateText = opted ? 'Opted in' : 'Not opted in';
      var toggleText = opted ? 'Opt out of leaderboard' : 'Opt in to leaderboard';
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(stateText) + ' <button class="btn ghost" type="button" data-refx-action="board-opt">' + esc(toggleText) + '</button></p>');
      html.push('<p>' + esc(optNoteText) + '</p>');
      if (!doc) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        var entries = doc.entries || [];
        if (!entries.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
        else {
          html.push('<ul>');
          entries.forEach(function (e, i) {
            /* Top-3 crown markers are plain text, never an emoji —
             * an emoji font gap must never turn a crown into a box. */
            var crown = (i < 3) ? (esc(crownText) + ' · ') : '';
            html.push('<li>' + crown + esc(e.label || '') + ' · ' + esc(String(e.count || 0)) + '</li>');
          });
          html.push('</ul>');
        }
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        btn.disabled = true;
        coreDb().collection('users').doc(uid).update({ leaderboardOptIn: !opted }).then(function () {
          renderLeaderboard(uid);
        }).catch(function () {
          refxNote(container, pendingText);
          btn.disabled = false;
        });
      });
      return true;
    }).catch(function () { return false; });
  }
  function renderGoal() {
    var container = refxContainer('refx-goal');
    if (!container) { return Promise.resolve(false); }
    var titleText = 'Community goal';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No community goal published for this month yet.';
    var targetText = 'Target';
    var currentText = 'Current';
    var adminNoteText = 'Goal rewards are paid by an admin when the goal is reached.';
    return loadPublicDoc('community_goals', monthKey(new Date())).then(function (res) {
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      else if (!res.doc) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<p>' + esc(targetText) + ': ' + esc(String(res.doc.target || 0)) + ' · ' + esc(currentText) + ': ' + esc(String(res.doc.current || 0)) + ' · ' + esc(res.doc.status || '') + '</p>');
      }
      html.push('<p>' + esc(adminNoteText) + '</p>');
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- CORE-2 renders: challenges, featured, ambassador ------ */
  function renderChallenges(uid) {
    var container = refxContainer('refx-challenges');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Challenges';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Request sent. Admin approval pending.';
    var updatedText = 'Challenge updated.';
    var emptyText = 'No challenges yet.';
    var codeLabelText = 'Invitee code';
    var createText = 'Create challenge';
    var acceptText = 'Accept challenge';
    var doneText = 'Mark my part done';
    var claimText = 'Claim';
    var dualText = 'When both sides have marked done, each side files its own claim. An admin checks both marks before paying either claim.';
    return Promise.all([loadMyChallenges(uid), loadMyClaims(uid)]).then(function (parts) {
      var challenges = parts[0].challenges;
      var claims = parts[1].claims;
      function claimedFor(challengeId) {
        var hit = false;
        claims.forEach(function (c) {
          if (c.kind === 'challenge' && c.status !== 'rejected' && c.detail && c.detail.challengeId === challengeId) { hit = true; }
        });
        return hit;
      }
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending || parts[1].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(codeLabelText) + ': <input type="text" id="refx-challenge-code"> '
        + '<button class="btn ghost" type="button" data-refx-action="challenge-create">' + esc(createText) + '</button></p>');
      html.push('<p>' + esc(dualText) + '</p>');
      if (!challenges.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        challenges.forEach(function (c) {
          var isParty = c.fromUid === uid || c.toUid === uid;
          var ownDone = (c.fromUid === uid && c.fromDone === true) || (c.toUid === uid && c.toDone === true);
          var bothDone = c.fromDone === true && c.toDone === true;
          html.push('<li>' + esc(c.fromUid || '') + ' · ' + esc(c.status || '') + ' · ' + esc(String(c.fromDone)) + ' · ' + esc(String(c.toDone)));
          if (c.status === 'pending' && c.fromUid !== uid && (c.toUid === '' || c.toUid === uid)) {
            html.push(' <button class="btn ghost" type="button" data-refx-action="challenge-accept" data-refx-id="' + esc(c._id || '') + '">' + esc(acceptText) + '</button>');
          }
          if (isParty && !ownDone) {
            html.push(' <button class="btn ghost" type="button" data-refx-action="challenge-done" data-refx-id="' + esc(c._id || '') + '">' + esc(doneText) + '</button>');
          }
          if (isParty && bothDone && !claimedFor(c._id)) {
            html.push(' <button class="btn ghost" type="button" data-refx-action="challenge-claim" data-refx-id="' + esc(c._id || '') + '">' + esc(claimText) + '</button>');
          }
          html.push('</li>');
        });
        html.push('</ul>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var action = btn.getAttribute('data-refx-action');
        var cid = btn.getAttribute('data-refx-id');
        btn.disabled = true;
        function ok() {
          refxNote(container, action === 'challenge-create' ? sentText : updatedText);
          renderChallenges(uid);
        }
        function fail(err) {
          var msg = (err && err.message) ? err.message : pendingText;
          refxNote(container, msg);
          btn.disabled = false;
        }
        if (action === 'challenge-create') {
          var codeEl = document.getElementById('refx-challenge-code');
          var code = codeEl ? codeEl.value.trim() : '';
          if (!code) { btn.disabled = false; return; }
          createChallenge(uid, code).then(ok).catch(fail);
        } else if (action === 'challenge-accept') {
          acceptChallenge(uid, cid).then(ok).catch(fail);
        } else if (action === 'challenge-done') {
          confirmChallengeDone(uid, cid).then(ok).catch(fail);
        } else if (action === 'challenge-claim') {
          createClaim(uid, 'challenge', RATES.CHALLENGE_REWARD, { challengeId: cid }).then(ok).catch(fail);
        }
      });
      return true;
    }).catch(function () { return false; });
  }
  function renderFeatured(uid) {
    var container = refxContainer('refx-featured');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Featured pieces';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No featured pieces yet.';
    var adminNoteText = 'Featured rewards are paid by an admin.';
    return loadMyLedgerFull(uid).then(function (res) {
      var featured = res.entries.filter(function (e) { return e.reason === 'featured'; });
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      if (!featured.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        featured.forEach(function (e) {
          html.push('<li>' + esc(e.featuredId || '') + ' · ' + esc(String(e.amount)) + ' · ' + esc(fmtDate(e.createdAt)) + '</li>');
        });
        html.push('</ul>');
      }
      html.push('<p>' + esc(adminNoteText) + '</p>');
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }
  function renderAmbassador(uid) {
    var container = refxContainer('refx-ambassador');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Ambassador';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Request sent. Admin approval pending.';
    var claimText = 'Claim';
    var noLangText = 'Ambassador language data not recorded for your referrals yet.';
    var thresholdText = 'members needed for an ambassador claim';
    return Promise.all([
      loadMyReferralSummary(uid).catch(function () { return { referrals: [], stats: computeStats([], []) }; }),
      loadMyClaims(uid)
    ]).then(function (parts) {
      var counts = ambassadorCounts(parts[0].referrals || []);
      var claims = parts[1].claims;
      var langs = Object.keys(counts).filter(function (l) { return l !== 'unknown'; });
      function claimedFor(lang) {
        var hit = false;
        claims.forEach(function (c) {
          if (c.kind === 'ambassador' && c.status !== 'rejected' && c.detail && c.detail.language === lang) { hit = true; }
        });
        return hit;
      }
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[1].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      if (!langs.length) {
        /* Never invent a language: when no L1 row carries one, the
         * section says so plainly instead of guessing a community. */
        html.push('<p>' + esc(noLangText) + '</p>');
      } else {
        html.push('<ul>');
        langs.forEach(function (lang) {
          var count = counts[lang];
          html.push('<li>' + esc(lang) + ' · ' + esc(String(count)));
          if (count >= RATES.AMBASSADOR.users && !claimedFor(lang)) {
            html.push(' <button class="btn ghost" type="button" data-refx-action="amb-claim" data-refx-lang="' + esc(lang) + '" data-refx-count="' + esc(String(count)) + '">' + esc(claimText) + '</button>');
          } else if (count < RATES.AMBASSADOR.users) {
            html.push(' · ' + esc(String(RATES.AMBASSADOR.users)) + ' ' + esc(thresholdText));
          }
          html.push('</li>');
        });
        html.push('</ul>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var lang = btn.getAttribute('data-refx-lang');
        var count = Number(btn.getAttribute('data-refx-count')) || 0;
        btn.disabled = true;
        /* detail carries language + count + badgeId: settle appends
         * ANY detail.badgeId once (coordinator fix-pass, Oct 26 — the
         * old kind-gated list dropped ambassador badges), so settling
         * this claim grants the 'ambassador-<lang>' badge exactly once. */
        createClaim(uid, 'ambassador', RATES.AMBASSADOR.coins, { language: lang, count: count, badgeId: 'ambassador-' + lang }).then(function () {
          refxNote(container, sentText);
          renderAmbassador(uid);
        }).catch(function () {
          refxNote(container, pendingText);
          btn.disabled = false;
        });
      });
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- CORE-2 renders: QR, pair streak ---------- */
  function renderQR(uid, link) {
    var container = refxContainer('refx-qr');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'QR share link';
    var copiedText = 'Copied!';
    var copyText = 'Copy QR link';
    var noJoinsText = 'No QR joins recorded yet.';
    var joinsLabelText = 'QR joins';
    var explainText = 'Share this link as a QR code. Signups through it are counted as QR joins.';
    return loadMyReferralSummary(uid).catch(function () { return { referrals: [], stats: computeStats([], []) }; }).then(function (summary) {
      var baseLink = link || referralLink(uid);
      var qrLink = baseLink + '&qr=1';
      var joins = 0;
      (summary.referrals || []).forEach(function (r) { if (r && r.source === 'qr') { joins++; } });
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      html.push('<p>' + esc(qrLink) + ' <button class="btn ghost" type="button" data-refx-action="qr-copy">' + esc(copyText) + '</button></p>');
      html.push('<p>' + esc(explainText) + '</p>');
      if (joins > 0) { html.push('<p>' + esc(joinsLabelText) + ': ' + esc(String(joins)) + '</p>'); }
      else { html.push('<p>' + esc(noJoinsText) + '</p>'); }
      html.push('<div id="refx-qr-canvas-holder"></div>');
      container.innerHTML = html.join('');
      /* Canvas poster for the QR link: the referral code as TEXT on a
       * plain canvas. No QR vendor library is loaded on this page,
       * and none is added — the code text IS the poster content. */
      try {
        var holder = document.getElementById('refx-qr-canvas-holder');
        if (holder) {
          var canvas = document.createElement('canvas');
          canvas.width = 360;
          canvas.height = 280;
          holder.appendChild(canvas);
          var ctx = canvas.getContext('2d');
          if (ctx) {
            var bgColor = '#ffffff';
            var inkColor = '#111111';
            var fontBig = 'bold 26px sans-serif';
            var fontSmall = '16px sans-serif';
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, 360, 280);
            ctx.fillStyle = inkColor;
            ctx.font = fontBig;
            var codeLabel = 'Referral code';
            ctx.fillText(codeLabel, 20, 50);
            ctx.fillText(uid, 20, 90);
            ctx.font = fontSmall;
            var chunk = 34;
            var linkText = qrLink;
            var y = 130;
            while (linkText.length > 0 && y < 270) {
              ctx.fillText(linkText.slice(0, chunk), 20, y);
              linkText = linkText.slice(chunk);
              y += 24;
            }
          }
        }
      } catch (e) {}
      refxBind(container, function (btn) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(qrLink).then(function () { refxNote(container, copiedText); });
          } else { refxNote(container, copiedText); }
        } catch (err) { refxNote(container, copiedText); }
      });
      return true;
    }).catch(function () { return false; });
  }
  function renderPairStreak(uid) {
    var container = refxContainer('refx-pair');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Pair streak';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Request sent. Admin approval pending.';
    var claimText = 'Claim';
    var friendLabelText = 'Friend user id';
    var alreadyText = 'Already claimed for this friend.';
    var explainText = "Each side claims its own reward. An admin checks both users' daily-claim streaks before paying either claim.";
    return Promise.all([loadMyCoinClaims(uid), loadMyClaims(uid)]).then(function (parts) {
      var streak = dailyStreakFromClaims(parts[0].claims, Date.now()).streak;
      var claims = parts[1].claims;
      var streakLine = 'Current daily-claim streak: ' + streak + ' days';
      var needLine = 'Days still needed for a pair streak: ' + Math.max(0, RATES.PAIR_STREAK.days - streak);
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending || parts[1].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(streakLine) + '</p>');
      html.push('<p>' + esc(explainText) + '</p>');
      if (streak >= RATES.PAIR_STREAK.days) {
        html.push('<p>' + esc(friendLabelText) + ': <input type="text" id="refx-pair-friend"> '
          + '<button class="btn ghost" type="button" data-refx-action="pair-claim">' + esc(claimText) + '</button></p>');
      } else {
        html.push('<p>' + esc(needLine) + '</p>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var friendEl = document.getElementById('refx-pair-friend');
        var friendUid = friendEl ? friendEl.value.trim() : '';
        if (!friendUid) { return; }
        var dup = false;
        claims.forEach(function (c) {
          if (c.kind === 'pair-streak' && c.status !== 'rejected' && c.detail && c.detail.inviteeUid === friendUid) { dup = true; }
        });
        if (dup) { refxNote(container, alreadyText); return; }
        btn.disabled = true;
        /* PER-SIDE claims: this claim pays only this side's 25.
         * The friend files their own claim, and the admin verifies
         * BOTH streaks before settling either — one claim can never
         * pay both sides. */
        createClaim(uid, 'pair-streak', RATES.PAIR_STREAK.coins, { inviteeUid: friendUid }).then(function () {
          refxNote(container, sentText);
          renderPairStreak(uid);
        }).catch(function () {
          refxNote(container, pendingText);
          btn.disabled = false;
        });
      });
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- CORE-2 renders: battles, shoutout, posters ---------- */
  function renderBattles() {
    var container = refxContainer('refx-battles');
    if (!container) { return Promise.resolve(false); }
    var titleText = 'Team battles';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No battle published for this week yet.';
    var winnerText = 'Winner';
    var poolText = 'Pool';
    return loadPublicDoc('battles', weekKey(new Date())).then(function (res) {
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      else if (!res.doc) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<p>' + esc(winnerText) + ': ' + esc(res.doc.winnerUid || '') + ' · ' + esc(poolText) + ': ' + esc(String(res.doc.pool || 0)) + ' · ' + esc(res.doc.status || '') + '</p>');
        var teams = res.doc.teams || [];
        if (!teams.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
        else {
          html.push('<ul>');
          teams.forEach(function (t) {
            html.push('<li>' + esc(t.referrerUid || '') + ' · ' + esc(String(t.score || 0)) + '</li>');
          });
          html.push('</ul>');
        }
      }
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }
  function shoutoutCardHtml(doc) {
    /* Shared star card (item #55): the referrals-page shoutout and the
     * homepage slot render the SAME markup from the SAME public doc —
     * never a second copy that can drift. */
    return '<p>' + esc('Star') + ': ' + esc(doc.uid || '') + ' · ' + esc('Prize') + ': ' + esc(String(doc.prize || 0)) + '</p>'
      + '<p>' + esc(doc.story || '') + '</p>';
  }
  function renderHomepageShoutout(attempt) {
    /* Item #55: homepage slot. The container is created by the main.js
     * loader on the homepage only (no generator or homepage-HTML edit,
     * so the frozen hero is untouched); this fills it from the same
     * public shoutouts doc the referrals page reads. Firebase arrives
     * via account.js's async SDK chain, so the first attempts usually
     * find no db yet: retry a few times, then leave the slot empty —
     * never a fabricated or stale card. Empty/pending states render
     * honestly once the db is reachable. */
    if (typeof document === 'undefined') { return Promise.resolve(false); }
    var container = document.getElementById('home-shoutout');
    if (!container) { return Promise.resolve(false); }
    if (!coreDb()) {
      var n = (typeof attempt === 'number') ? attempt : 0;
      if (n >= 4) { return Promise.resolve(false); }
      return new Promise(function (resolve) {
        setTimeout(function () { renderHomepageShoutout(n + 1).then(resolve); }, 1000);
      });
    }
    var titleText = 'Monthly shoutout';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No shoutout published for this month yet.';
    return loadPublicDoc('shoutouts', monthKey(new Date())).then(function (res) {
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      else if (!res.doc) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else { html.push(shoutoutCardHtml(res.doc)); }
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }
  function renderShoutout() {
    var container = refxContainer('refx-shoutout');
    if (!container) { return Promise.resolve(false); }
    var titleText = 'Monthly shoutout';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No shoutout published for this month yet.';
    return loadPublicDoc('shoutouts', monthKey(new Date())).then(function (res) {
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      else if (!res.doc) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else { html.push(shoutoutCardHtml(res.doc)); }
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- deferred items #9 / #18 / #35 (local build, Oct 27) -----
   * WHY one section: all three were DEFERRED in the gaps pass for the
   * same reason — each needs a public surface or a rules amendment —
   * and all three now share ONE new public collection (showcase_boards)
   * plus the existing admin-settle path. Nothing here is live until
   * the parent pushes these files AND publishes the draft rules in
   * deferred-rules-draft.txt (local text only, NOT published here).
   * Strings follow the html-array pattern (plain literals in
   * own-statement variables, pushed into html[], assigned via
   * join('')), so the js-gate needs no new dict keys. */

  /* Item #9 — class link codes. A code is teacher-chosen, 4-12 chars,
   * A-Z/0-9/hyphen, stored UPPERCASE so 'grade10-a' and 'GRADE10-A'
   * are the same class. No class names are invented here: the teacher
   * supplies the name at request time, and the registry is data (the
   * classes collection), never a hardcoded list. */
  function classCodeNormalize(code) {
    if (code == null) { return ''; }
    return String(code).trim().toUpperCase();
  }
  function classCodeValid(code) {
    var c = classCodeNormalize(code);
    return /^[A-Z0-9-]{4,12}$/.test(c);
  }
  function classJoinCount(rows, code) {
    /* Counts a teacher's OWN referral rows carrying this class code.
     * The rows already come filtered by referrerUid
     * (loadMyReferralSummary), so no new query and no rules change
     * is needed for counting.
     * FIX4 (Oct 27): class-only rows are NOT in that query (a
     * class-only row has no referrerUid), so renderClassDashboard
     * merges loadClassJoinRows(code) — see below. */
    var want = classCodeNormalize(code);
    var n = 0;
    (rows || []).forEach(function (r) {
      if (r && want && classCodeNormalize(r.classCode) === want) { n++; }
    });
    return n;
  }
  function loadClassJoinRows(code) {
    /* FIX4 (Oct 27): class joins as the teacher counts them. The
     * teacher's own referrals query (referrerUid == uid) can never
     * return a class-only join (that row has no referrerUid — there
     * is no referrer), so the class dashboard also reads rows by
     * classCode. Under the currently published rules this query is
     * denied (the list rule can only prove referrerUid == caller),
     * so it resolves to [] until the companion list rule ships —
     * never an exception, never a partial count. */
    var d = coreDb();
    var c = classCodeNormalize(code);
    if (!d || !c) { return Promise.resolve([]); }
    return d.collection('referrals').where('classCode', '==', c).get()
      .then(snapshotRows).catch(function () { return []; });
  }
  function mergeReferralRows(a, b) {
    /* FIX4 (Oct 27): union of two referral-row lists, deduped by doc
     * id. A combined ?ref=&class= join appears in BOTH the teacher's
     * referrerUid query and the classCode query — without dedupe it
     * would count twice. Rows without an id are appended as-is
     * (they cannot be proven duplicates). */
    var seen = {};
    var out = [];
    (a || []).concat(b || []).forEach(function (r) {
      if (!r) { return; }
      var id = r._id;
      if (id) {
        if (seen[id]) { return; }
        seen[id] = true;
      }
      out.push(r);
    });
    return out;
  }
  function classClaimable(count, claims, ledger, code) {
    /* Threshold met AND no live claim or settled payment for this
     * code. Mirrors renderClaims' alreadyClaimed: a rejected claim
     * frees the code again, a live one blocks it. */
    var want = classCodeNormalize(code);
    if (!want || !(count >= RATES.CLASS_BONUS.students)) { return false; }
    var blocked = false;
    (claims || []).forEach(function (c) {
      if (c.kind === 'class' && c.status !== 'rejected' && c.detail && classCodeNormalize(c.detail.classCode) === want) { blocked = true; }
    });
    if (!blocked) {
      (ledger || []).forEach(function (e) {
        if (e.reason === 'claim settlement' && e.kind === 'class' && e.detail && classCodeNormalize(e.detail.classCode) === want) { blocked = true; }
      });
    }
    return !blocked;
  }
  function classClaimPayload(code) {
    /* The badge rides the existing settle append (adminSettleClaim
     * appends detail.badge once, dup-guarded), so NO settle change
     * is needed for the Classroom Leader badge. */
    var c = classCodeNormalize(code);
    return { kind: 'class', amount: RATES.CLASS_BONUS.coins, detail: { classCode: c, badge: RATES.CLASS_BONUS.badge } };
  }
  function requestClassCode(uid, code, name) {
    var d = coreDb();
    var missingMsg = 'Missing class code input.';
    if (!d || !uid || !classCodeValid(code)) { return Promise.reject(coreErr(missingMsg)); }
    var c = classCodeNormalize(code);
    /* Duplicate codes are rejected, not overwritten: a code is a
     * teacher's link identity, and silently reassigning it would
     * misattribute an entire class. The check is a direct doc get,
     * not a code-only list query: the list rule can only prove
     * ownership for the teacher's own rows, so a code-only query by
     * a non-admin teacher is denied before the create ever runs. */
    return d.collection('classes').doc(c).get().then(function (snap) {
      if (snap && snap.exists) { throw coreErr('This class code is already taken.'); }
      return d.collection('classes').doc(c).set({
        code: c, teacherUid: uid, name: String(name || ''), status: 'pending', createdAt: serverTimestamp()
      });
    }).then(function () { return { code: c, status: 'pending' }; });
  }
  function adminApproveClass(adminUid, code) {
    var d = coreDb();
    var missingMsg = 'Missing class approval input.';
    if (!d || !adminUid || !classCodeValid(code)) { return Promise.reject(coreErr(missingMsg)); }
    var c = classCodeNormalize(code);
    var ref = d.collection('classes').doc(c);
    return ref.get().then(function (snap) {
      var doc = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Class code not found.';
      if (!doc) { throw coreErr(notFoundMsg); }
      if (doc.status === 'active') { return { code: c, status: 'active', alreadyActive: true }; }
      return ref.update({ status: 'active' }).then(function () { return { code: c, status: 'active', alreadyActive: false }; });
    });
  }
  function loadMyClasses(uid) {
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve({ classes: [], rulesPending: false }); }
    return d.collection('classes').where('teacherUid', '==', uid).get()
      .then(function (snap) { return { classes: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { classes: [], rulesPending: isPermDenied(err) }; });
  }
  function loadPendingClasses() {
    var d = coreDb();
    if (!d) { return Promise.resolve({ classes: [], rulesPending: false }); }
    return d.collection('classes').where('status', '==', 'pending').get()
      .then(function (snap) { return { classes: snapshotRows(snap), rulesPending: false }; })
      .catch(function (err) { return { classes: [], rulesPending: isPermDenied(err) }; });
  }
  function isViewerAdmin(uid) {
    /* Mirrors DKA.isAdmin (account.js): an admins/{uid} doc means
     * admin. A denied/missing doc means NOT admin — never an exception. */
    var d = coreDb();
    if (!d || !uid) { return Promise.resolve(false); }
    return d.collection('admins').doc(uid).get().then(function (snap) {
      return !!(snap && snap.exists);
    }).catch(function () { return false; });
  }
  function renderClassDashboard(uid) {
    var container = refxContainer('refx-class');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'My classes';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No classes yet. Request a class code to bring your class.';
    var codeLabelText = 'Class code';
    var nameLabelText = 'Class name';
    var requestText = 'Request class code';
    var claimText = 'Claim class bonus';
    var approveText = 'Approve class';
    var sentText = 'Request sent. Admin approval pending.';
    var needText = 'students needed for the class bonus';
    var claimedText = 'Class bonus claimed.';
    var invalidText = 'Please enter a valid class code (4-12 letters, numbers, hyphens).';
    /* FIX4 (Oct 27): class rows are loaded in two stages — the class
     * codes come from loadMyClasses, then one classCode query per
     * code (loadClassJoinRows) so class-only joins (rows without a
     * referrerUid) are counted too. Merged with the teacher's own
     * referrals rows and deduped by doc id (a combined join is in
     * both lists). parts[0..4] keep their old indices. */
    return loadMyClasses(uid).then(function (clsRes) {
      var codes = (clsRes.classes || []).map(function (c) { return c.code; });
      return Promise.all([
        Promise.resolve(clsRes),
        loadMyReferralSummary(uid).catch(function () { return { referrals: [], stats: computeStats([], []) }; }),
        loadMyClaims(uid),
        loadMyLedgerFull(uid).catch(function () { return { entries: [] }; }),
        isViewerAdmin(uid),
        Promise.all(codes.map(function (code) { return loadClassJoinRows(code); })).then(function (perCode) {
          var merged = [];
          perCode.forEach(function (rs) { merged = mergeReferralRows(merged, rs); });
          return merged;
        })
      ]);
    }).then(function (parts) {
      var myClasses = parts[0].classes;
      var rows = mergeReferralRows((parts[1] && parts[1].referrals) || [], parts[5] || []);
      var claims = parts[2].claims || [];
      var ledger = (parts[3] && parts[3].entries) || [];
      var admin = parts[4];
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(codeLabelText) + ' <input type="text" data-refx-class-code> '
        + esc(nameLabelText) + ' <input type="text" data-refx-class-name> '
        + '<button class="btn ghost" type="button" data-refx-action="class-request">' + esc(requestText) + '</button></p>');
      if (!myClasses.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        myClasses.forEach(function (cl) {
          var count = classJoinCount(rows, cl.code);
          var claimable = cl.status === 'active' && classClaimable(count, claims, ledger, cl.code);
          html.push('<li>' + esc(cl.code || '') + ' · ' + esc(cl.name || '') + ' · ' + esc(String(count)) + ' / ' + esc(String(RATES.CLASS_BONUS.students)) + ' · ' + esc(cl.status || ''));
          if (cl.status !== 'active') { html.push(' · ' + esc(sentText)); }
          else if (count < RATES.CLASS_BONUS.students) { html.push(' · ' + esc(String(RATES.CLASS_BONUS.students - count)) + ' ' + esc(needText)); }
          else if (claimable) {
            html.push(' <button class="btn ghost" type="button" data-refx-action="class-claim" data-refx-code="' + esc(cl.code || '') + '">' + esc(claimText) + '</button>');
          } else { html.push(' · ' + esc(claimedText)); }
          html.push('</li>');
        });
        html.push('</ul>');
      }
      /* Admin branch: pending class approvals live here (not in the
       * admin queue) so the queue function stays untouched. */
      if (admin) { html.push('<div data-refx-class-admin></div>'); }
      container.innerHTML = html.join('');
      var noteEl = container.querySelector('[data-refx-note]');
      function note(msg) { if (noteEl) { noteEl.textContent = msg; } }
      var btns = container.querySelectorAll('button[data-refx-action]');
      for (var i = 0; i < btns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var action = btn.getAttribute('data-refx-action');
            if (action === 'class-request') {
              var codeEl = container.querySelector('[data-refx-class-code]');
              var nameEl = container.querySelector('[data-refx-class-name]');
              var code = codeEl ? codeEl.value : '';
              var nm = nameEl ? nameEl.value : '';
              if (!classCodeValid(code)) { note(invalidText); return; }
              requestClassCode(uid, code, nm).then(function () { note(sentText); renderClassDashboard(uid); }).catch(function (e) { note(e && e.message ? e.message : 'Request failed.'); });
            } else if (action === 'class-claim') {
              var code2 = btn.getAttribute('data-refx-code') || '';
              var p = classClaimPayload(code2);
              createClaim(uid, p.kind, p.amount, p.detail).then(function () { note(sentText); renderClassDashboard(uid); }).catch(function (e) { note(e && e.message ? e.message : 'Claim failed.'); });
            }
          });
        })(btns[i]);
      }
      if (admin) {
        loadPendingClasses().then(function (res) {
          var box = container.querySelector('[data-refx-class-admin]');
          if (!box) { return; }
          var ahtml = ['<h4>' + esc('Pending classes') + '</h4>'];
          if (!res.classes.length) { ahtml.push('<p>' + esc('No pending classes.') + '</p>'); }
          else {
            ahtml.push('<ul>');
            res.classes.forEach(function (cl) {
              ahtml.push('<li>' + esc(cl.code || '') + ' · ' + esc(cl.name || '') + ' <button class="btn ghost" type="button" data-refx-action="class-approve" data-refx-code="' + esc(cl.code || '') + '">' + esc(approveText) + '</button></li>');
            });
            ahtml.push('</ul>');
          }
          box.innerHTML = ahtml.join('');
          var abtns = box.querySelectorAll('button[data-refx-action]');
          for (var j = 0; j < abtns.length; j++) {
            (function (btn) {
              btn.addEventListener('click', function () {
                var code3 = btn.getAttribute('data-refx-code') || '';
                adminApproveClass(uid, code3).then(function () { renderClassDashboard(uid); }).catch(function (e) { note(e && e.message ? e.message : 'Approval failed.'); });
              });
            })(abtns[j]);
          }
        });
      }
      return true;
    }).catch(function () { return false; });
  }

  /* Item #18 — contributors wall. Board docs live in ONE public
   * collection (showcase_boards) and are written ONLY by admins from
   * settled contributions — private ledger rows are never read for
   * the wall. A board doc carries NO uid and NO email: only the
   * display label, the note, and the source id (a claim id, never
   * rendered). */
  function boardLabelFor(udoc) {
    /* Privacy-first: masked UNLESS the contributor's own record shows
     * an explicit public-board choice. The only such choice that
     * exists today is the leaderboard opt-in (leaderboardOptIn) — a
     * display name alone is NOT consent to publish it. referralPrivate
     * always wins (opt-out beats everything). A future dedicated
     * showcase opt-in toggle would slot in here as one more OR leg. */
    if (!udoc || udoc.referralPrivate) { return 'Private member'; }
    if (udoc.leaderboardOptIn && (udoc.displayName || udoc.name)) { return udoc.displayName || udoc.name; }
    return 'Private member';
  }
  function loadShowcaseBoards(kind) {
    var d = coreDb();
    if (!d || !kind) { return Promise.resolve({ boards: [], rulesPending: false }); }
    return d.collection('showcase_boards').where('kind', '==', kind).get()
      .then(function (snap) {
        var rows = snapshotRows(snap);
        /* Client-side newest-first: a where+orderBy query would need
         * a composite index, so the sort happens here instead. */
        rows.sort(function (a, b) { return toMs(b.publishedAt) - toMs(a.publishedAt); });
        return { boards: rows, rulesPending: false };
      })
      .catch(function (err) { return { boards: [], rulesPending: isPermDenied(err) }; });
  }
  function showcaseCardHtml(doc) {
    /* ONE shared wall/slot card (DRY): label + note ONLY. The doc
     * carries no uid and no email by construction, and the source id
     * is never rendered — so no identifier can leak through the wall. */
    return '<li>' + esc(doc.label || 'Private member') + ' · ' + esc(doc.note || '') + '</li>';
  }
  function adminPublishContributor(adminUid, claimId) {
    var d = coreDb();
    var missingMsg = 'Missing contributor publish input.';
    if (!d || !adminUid || !claimId) { return Promise.reject(coreErr(missingMsg)); }
    var ref = d.collection('reward_claims').doc(claimId);
    return ref.get().then(function (snap) {
      var claim = (snap && snap.exists) ? (snap.data() || {}) : null;
      var notFoundMsg = 'Contribution claim not found.';
      if (!claim) { throw coreErr(notFoundMsg); }
      /* ONLY settled contributions reach the wall: a pending claim
       * is not a contribution yet, and a rejected one never is. */
      var stateMsg = 'Only approved bug contributions can be published.';
      if (claim.kind !== 'bug' || claim.status !== 'approved') { throw coreErr(stateMsg); }
      return claim;
    }).then(function (claim) {
      return readUserDoc(d, claim.uid).catch(function () { return {}; }).then(function (udoc) {
        var label = boardLabelFor(udoc);
        var note = (claim.detail && claim.detail.description) || '';
        /* Doc id is the claim id: re-publishing overwrites the same
         * doc instead of duplicating the wall entry. */
        return d.collection('showcase_boards').doc('contrib-' + claimId).set({
          kind: 'contributor', label: label, note: String(note), sourceId: claimId, publishedAt: serverTimestamp()
        }).then(function () { return { boardId: 'contrib-' + claimId, label: label }; });
      });
    });
  }
  function renderContributorsWall(uid) {
    var container = refxContainer('refx-contributors');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Contributors';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No contributors published yet.';
    var publishText = 'Publish to wall';
    return Promise.all([
      loadShowcaseBoards('contributor'),
      isViewerAdmin(uid)
    ]).then(function (parts) {
      var boards = parts[0].boards;
      var admin = parts[1];
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      if (!boards.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        boards.forEach(function (b) { html.push(showcaseCardHtml(b)); });
        html.push('</ul>');
      }
      if (admin) { html.push('<div data-refx-wall-admin></div>'); }
      container.innerHTML = html.join('');
      var noteEl = container.querySelector('[data-refx-note]');
      function note(msg) { if (noteEl) { noteEl.textContent = msg; } }
      if (admin) {
        adminListClaims('approved').then(function (rows) {
          var box = container.querySelector('[data-refx-wall-admin]');
          if (!box) { return; }
          var settled = (rows || []).filter(function (c) { return c && c.kind === 'bug'; });
          var ahtml = ['<h4>' + esc('Approved bug contributions') + '</h4>'];
          if (!settled.length) { ahtml.push('<p>' + esc('No approved bug contributions.') + '</p>'); }
          else {
            ahtml.push('<ul>');
            settled.forEach(function (c) {
              ahtml.push('<li>' + esc((c.detail && c.detail.description) || '') + ' <button class="btn ghost" type="button" data-refx-action="wall-publish" data-refx-id="' + esc(c._id || '') + '">' + esc(publishText) + '</button></li>');
            });
            ahtml.push('</ul>');
          }
          box.innerHTML = ahtml.join('');
          var btns = box.querySelectorAll('button[data-refx-action]');
          for (var i = 0; i < btns.length; i++) {
            (function (btn) {
              btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-refx-id') || '';
                adminPublishContributor(uid, id).then(function () { note('Published to wall.'); renderContributorsWall(uid); }).catch(function (e) { note(e && e.message ? e.message : 'Publish failed.'); });
              });
            })(btns[i]);
          }
        }).catch(function () {});
      }
      return true;
    }).catch(function () { return false; });
  }

  /* Item #35 — featured homepage slot. Mirrors renderHomepageShoutout
   * EXACTLY (same retry-while-SDK-arrives, same honest empty/pending
   * states, same never-fabricated rule) — but reads ONLY the public
   * showcase_boards collection (kind 'featured'), never private
   * ledger rows. The referrals-page featured list is untouched. */
  function renderHomepageFeatured(attempt) {
    if (typeof document === 'undefined') { return Promise.resolve(false); }
    var container = document.getElementById('home-featured');
    if (!container) { return Promise.resolve(false); }
    if (!coreDb()) {
      var n = (typeof attempt === 'number') ? attempt : 0;
      if (n >= 4) { return Promise.resolve(false); }
      return new Promise(function (resolve) {
        setTimeout(function () { renderHomepageFeatured(n + 1).then(resolve); }, 1000);
      });
    }
    var titleText = 'Featured';
    var pendingText = 'Admin approval pending for this feature.';
    var emptyText = 'No featured pieces published yet.';
    return loadShowcaseBoards('featured').then(function (res) {
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (res.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      else if (!res.boards.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        res.boards.slice(0, 3).forEach(function (b) { html.push(showcaseCardHtml(b)); });
        html.push('</ul>');
      }
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }

  function renderPosters(uid) {
    var container = refxContainer('refx-posters');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Poster';
    var downloadText = 'Share poster';
    var templateLabelText = 'Template';
    return Promise.all([
      loadMyReferralSummary(uid).catch(function () { return { referrals: [], stats: computeStats([], []) }; }),
      readUserDoc(coreDb(), uid).catch(function () { return {}; })
    ]).then(function (parts) {
      var summary = parts[0];
      var udoc = parts[1] || {};
      var profileInfo = udoc.profileInfo || {};
      var name = udoc.displayName || profileInfo.displayName || profileInfo.fullName || uid;
      var stats = summary.stats || computeStats([], []);
      var coins = (udoc.coins != null) ? udoc.coins : 0;
      var link = referralLink(uid);
      /* 3 template styles rotating by week number: violet gradient,
       * amber gradient, dark ink. The poster is a TEMPLATE poster
       * drawn on canvas — labelled "Poster" only, never as generated
       * by any model, because no generation happens here. */
      var wk = weekKey(new Date());
      var wkNum = Number(wk.split('-W')[1]) || 1;
      var templates = ['Violet gradient', 'Amber gradient', 'Dark ink'];
      var templateName = templates[wkNum % 3];
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      html.push('<p>' + esc(templateLabelText) + ': ' + esc(templateName) + '</p>');
      html.push('<div id="refx-poster-holder"></div>');
      html.push('<p><button class="btn ghost" type="button" data-refx-action="poster-download">' + esc(downloadText) + '</button></p>');
      container.innerHTML = html.join('');
      var posterCanvas = null;
      try {
        var holder = document.getElementById('refx-poster-holder');
        if (holder) {
          var canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1350;
          holder.appendChild(canvas);
          posterCanvas = canvas;
          var ctx = canvas.getContext('2d');
          if (ctx) {
            var grad = ctx.createLinearGradient(0, 0, 0, 1350);
            var idx = wkNum % 3;
            var firstColor = '#7c3aed';
            var secondColor = '#db2777';
            if (idx === 1) { firstColor = '#f59e0b'; secondColor = '#ef4444'; }
            if (idx === 2) { firstColor = '#111827'; secondColor = '#374151'; }
            grad.addColorStop(0, firstColor);
            grad.addColorStop(1, secondColor);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 1080, 1350);
            var ink = '#ffffff';
            ctx.fillStyle = ink;
            ctx.font = 'bold 72px sans-serif';
            ctx.fillText(name, 60, 200);
            ctx.font = '44px sans-serif';
            var rankLine = 'Rank: ' + stats.rank;
            var teamLine = 'Team: ' + stats.active + ' active friends';
            var coinsLine = 'Coins: ' + coins;
            ctx.fillText(rankLine, 60, 300);
            ctx.fillText(teamLine, 60, 370);
            ctx.fillText(coinsLine, 60, 440);
            ctx.font = '32px sans-serif';
            var linkText = link;
            var y = 540;
            var chunk = 38;
            while (linkText.length > 0 && y < 1250) {
              ctx.fillText(linkText.slice(0, chunk), 60, y);
              linkText = linkText.slice(chunk);
              y += 44;
            }
          }
        }
      } catch (e) {}
      refxBind(container, function () {
        if (!posterCanvas) { return; }
        var doneText = 'Poster downloaded.';
        function save(blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          var fileName = 'dokit-poster.png';
          a.download = fileName;
          a.click();
          refxNote(container, doneText);
        }
        try {
          if (posterCanvas.toBlob) { posterCanvas.toBlob(save, 'image/png'); }
          else {
            var dataUrl = posterCanvas.toDataURL('image/png');
            var a2 = document.createElement('a');
            a2.href = dataUrl;
            var fileName2 = 'dokit-poster.png';
            a2.download = fileName2;
            a2.click();
            refxNote(container, doneText);
          }
        } catch (err) {}
      });
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- CORE-2 renders: season, treasury, coach, globe -------- */
  function renderSeason(uid) {
    var container = refxContainer('refx-season');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Season pass';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Request sent. Admin approval pending.';
    var claimText = 'Claim season chest';
    var chestNoteText = 'Season chest: 100 per quest done, plus 200 when all 3 are done.';
    var season = seasonOf(new Date());
    return Promise.all([
      loadMyReferralSummary(uid).catch(function () { return { referrals: [], stats: computeStats([], []) }; }),
      loadMyCoinClaims(uid),
      loadMyClaims(uid)
    ]).then(function (parts) {
      var refs = parts[0].referrals || [];
      var coinClaims = parts[1].claims;
      var claims = parts[2].claims;
      var refsInSeason = 0;
      refs.forEach(function (r) {
        var t = toMs(r.createdAt);
        if (isNaN(t)) { t = toMs(r.rewardedAt); }
        if (!isNaN(t) && t >= season.startMs && t < season.endMs) { refsInSeason++; }
      });
      var winsInSeason = 0;
      try {
        var rawWins = JSON.parse(window.localStorage.getItem('dk_tf_wins') || '[]');
        (rawWins || []).forEach(function (w) {
          if (!w || w.won !== true || w.flagged === true) { return; }
          var t = toMs(w.date != null ? w.date : w.dateMs);
          if (!isNaN(t) && t >= season.startMs && t < season.endMs) { winsInSeason++; }
        });
      } catch (e) {}
      var claimsInSeason = coinClaims.filter(function (c) {
        var t = toMs(c.createdAt);
        return !isNaN(t) && t >= season.startMs && t < season.endMs;
      });
      var streakInSeason = dailyStreakFromClaims(claimsInSeason, Date.now()).streak;
      var quests = seasonQuestsProgress({ referralsInSeason: refsInSeason, winsInSeason: winsInSeason, streakInSeason: streakInSeason });
      var amount = seasonChestAmount(quests.doneCount);
      var already = false;
      claims.forEach(function (c) {
        if (c.kind === 'season-chest' && c.status !== 'rejected' && c.detail && c.detail.season === season.key) { already = true; }
      });
      var referLine = 'Refer 3 in season: ' + refsInSeason + ' (done: ' + quests.refer3 + ')';
      var winLine = 'Win 5 races in season: ' + winsInSeason + ' (done: ' + quests.win5 + ')';
      var streakLine = '7-day streak in season: ' + streakInSeason + ' (done: ' + quests.streak7 + ')';
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[1].rulesPending || parts[2].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(referLine) + '</p>');
      html.push('<p>' + esc(winLine) + '</p>');
      html.push('<p>' + esc(streakLine) + '</p>');
      html.push('<p>' + esc(chestNoteText) + '</p>');
      if (quests.doneCount > 0 && !already) {
        html.push('<p><button class="btn ghost" type="button" data-refx-action="season-claim">' + esc(claimText) + ' · ' + esc(String(amount)) + '</button></p>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        btn.disabled = true;
        /* Badge ONLY on the all-3 chest: partial chests pay their
         * per-quest amounts with no badge, and Part 1 settle appends
         * the badge only when detail carries a badgeId. */
        var detail = { season: season.key };
        if (quests.doneCount === 3) { detail.badgeId = 'season-' + season.key; }
        createClaim(uid, 'season-chest', amount, detail).then(function () {
          refxNote(container, sentText);
          renderSeason(uid);
        }).catch(function () {
          refxNote(container, pendingText);
          btn.disabled = false;
        });
      });
      return true;
    }).catch(function () { return false; });
  }
  function renderTreasury(uid) {
    var container = refxContainer('refx-treasury');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Treasury votes';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Vote sent.';
    var emptyText = 'No pools yet.';
    var noTeamText = 'No team found: treasury votes need a referrer.';
    var giftLabelText = 'Gift recipient code';
    var giftNoteText = 'Gift spends need a recipient code on a winning vote, or the spend will be refused.';
    var spendNoteText = 'Vote tallies and spends are admin actions.';
    var voteTeamText = 'Vote for team plan';
    var voteGiftText = 'Vote for gift';
    var voteContestText = 'Vote for contest';
    return Promise.all([
      loadMyPools(uid),
      readUserDoc(coreDb(), uid).catch(function () { return {}; })
    ]).then(function (parts) {
      var pools = parts[0].pools;
      var teamUid = (parts[1] || {}).referrerId || '';
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      if (!pools.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        pools.forEach(function (p) {
          html.push('<li>' + esc(p.name || '') + ' · ' + esc(p.purpose || '') + ' · ' + esc(String(p.balance || 0)) + ' · ' + esc(p.status || '') + '</li>');
        });
        html.push('</ul>');
      }
      if (!teamUid) {
        html.push('<p>' + esc(noTeamText) + '</p>');
      } else {
        html.push('<p>' + esc(giftLabelText) + ': <input type="text" id="refx-treasury-gift"></p>');
        html.push('<p><button class="btn ghost" type="button" data-refx-action="treasury-vote" data-refx-choice="team-plan">' + esc(voteTeamText) + '</button> '
          + '<button class="btn ghost" type="button" data-refx-action="treasury-vote" data-refx-choice="gift">' + esc(voteGiftText) + '</button> '
          + '<button class="btn ghost" type="button" data-refx-action="treasury-vote" data-refx-choice="contest">' + esc(voteContestText) + '</button></p>');
        html.push('<p>' + esc(giftNoteText) + '</p>');
      }
      html.push('<p>' + esc(spendNoteText) + '</p>');
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var choice = btn.getAttribute('data-refx-choice');
        var giftEl = document.getElementById('refx-treasury-gift');
        var giftCode = giftEl ? giftEl.value.trim() : '';
        btn.disabled = true;
        treasuryVote(teamUid, uid, choice, giftCode || undefined).then(function () {
          refxNote(container, sentText);
          btn.disabled = false;
        }).catch(function () {
          refxNote(container, pendingText);
          btn.disabled = false;
        });
      });
      return true;
    }).catch(function () { return false; });
  }
  function rateGraceLeft(announcedAt, nowMs) {
    /* Item #47: days left in the 30-day rate-change grace window.
     * Returns null when no announcement (or no date) exists, a
     * negative number when grace has ended — the render interprets
     * both, so no fake countdown ever shows. */
    var t = toMs(announcedAt);
    if (isNaN(t)) { return null; }
    var now = isNaN(toMs(nowMs)) ? Date.now() : toMs(nowMs);
    return Math.ceil((t + RATES.GRACE_DAYS * 86400000 - now) / 86400000);
  }
  function renderRateAnnouncement() {
    /* Item #47: rate-change grace banner. Invisible until the owner
     * announces a change (RATE_ANNOUNCEMENT is null today): no banner,
     * no countdown, no DOM change — shipping it now costs nothing and
     * it activates the day an announcement is set. When set, it pins
     * to the TOP of the referrals page (insertBefore firstChild), so
     * call order in the page render does not affect prominence. */
    if (typeof document === 'undefined') { return false; }
    var main = document.getElementById('ref-main');
    if (!main) { return false; }
    var existing = document.getElementById('refx-rate-banner');
    var a = RATES.RATE_ANNOUNCEMENT;
    if (!a) {
      try { if (existing && existing.parentNode) { existing.parentNode.removeChild(existing); } } catch (e) {}
      return false;
    }
    var left = rateGraceLeft(a.announcedAt, Date.now());
    var graceText = (left == null) ? '' : (left < 0 ? 'Rate-change grace ended.' : 'Rate-change grace: ' + left + ' days left.');
    var html = '<h3>Rate change</h3><p>Version ' + esc(String(a.version != null ? a.version : RATES.RATE_VERSION))
      + (a.note ? ' · ' + esc(String(a.note)) : '')
      + (graceText ? ' · ' + esc(graceText) : '') + '</p>';
    var box = existing;
    if (!box) {
      box = document.createElement('div');
      box.id = 'refx-rate-banner';
      try { main.insertBefore(box, main.firstChild || null); } catch (e) { main.appendChild(box); }
    }
    box.innerHTML = html;
    return true;
  }
  /* Delegated decisions (26 Oct 2026, item #51): the advanced forecast
   * below is NOT Silver-gated — no Silver tier exists in the
   * referral-only economy, so gating would hide the forecast from
   * everyone (a regression, not a feature). Best-channel prediction
   * is NOT built — no channel data exists, and predicting from
   * nothing would be fabrication. If the owner defines Silver or
   * channel data later, gating/prediction slot in here. */
  function renderCoachForecast(uid) {
    var container = refxContainer('refx-coach');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Coach and forecast';
    var pendingText = 'Admin approval pending for this feature.';
    var noDataText = 'Not enough data yet for a forecast.';
    return Promise.all([
      loadMyReferralSummary(uid).catch(function () { return { referrals: [], stats: computeStats([], []) }; }),
      loadMyLedgerFull(uid),
      loadMyCoinClaims(uid),
      readUserDoc(coreDb(), uid).catch(function () { return {}; })
    ]).then(function (parts) {
      var summary = parts[0];
      var ledger = parts[1].entries;
      var coinClaims = parts[2].claims;
      var udoc = parts[3] || {};
      var stats = summary.stats || computeStats([], []);
      var now = Date.now();
      var weekStart = mondayOf(now);
      var refsThisWeek = 0;
      (summary.referrals || []).forEach(function (r) {
        var t = toMs(r.createdAt);
        if (!isNaN(t) && t >= weekStart && t < weekStart + 7 * 86400000) { refsThisWeek++; }
      });
      var streak = dailyStreakFromClaims(coinClaims, now).streak;
      var tips = coachTips({
        active: stats.active, pending: stats.pending, referralsThisWeek: refsThisWeek,
        streak: streak, rankRemaining: stats.rankRemaining, nextRank: stats.nextRank
      }, {});
      var ledger30 = ledger.filter(function (e) {
        var t = toMs(e.createdAt);
        return !isNaN(t) && t >= now - 30 * 86400000 && t <= now;
      });
      var forecast = forecastToPro(udoc.coins || 0, ledger30);
      var html = ['<h3>' + esc(titleText) + '</h3>'];
      if (parts[1].rulesPending || parts[2].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<ul>');
      tips.forEach(function (t) { html.push('<li>' + esc(t) + '</li>'); });
      html.push('</ul>');
      if (!forecast) {
        /* Null rate means no forecast at all — never an invented
         * Pro date, exactly as forecastToPro promises. */
        html.push('<p>' + esc(noDataText) + '</p>');
      } else {
        var rateText = 'Daily rate: ' + (Math.round(forecast.dailyRate * 10) / 10) + ' coins';
        var daysText = 'Days to Pro: ' + forecast.daysLeft;
        var dateText = 'Pro date: ' + forecast.proDate;
        html.push('<p>' + esc(rateText) + ' · ' + esc(daysText) + ' · ' + esc(dateText) + '</p>');
      }
      container.innerHTML = html.join('');
      return true;
    }).catch(function () { return false; });
  }
  function renderGlobe(uid) {
    var container = refxContainer('refx-globe');
    if (!container || !uid) { return Promise.resolve(false); }
    var titleText = 'Opt-in city list';
    var pendingText = 'Admin approval pending for this feature.';
    var sentText = 'Pin saved.';
    var cityLabelText = 'City';
    var addText = 'Add my pin';
    var deleteText = 'Delete my pin';
    var emptyText = 'No city pins yet.';
    /* PARTIAL (design §8): this is the opt-in city list, NEVER a
     * geographic map with pins — no map asset and no geo data exist
     * for a true animated globe, so none is faked here. */
    var mapNoteText = 'This is an opt-in city list, not a geographic map.';
    return Promise.all([
      loadGlobePins(),
      readUserDoc(coreDb(), uid).catch(function () { return {}; })
    ]).then(function (parts) {
      var pins = parts[0].pins;
      var udoc = parts[1] || {};
      var profileInfo = udoc.profileInfo || {};
      var defaultCity = profileInfo.city || udoc.city || '';
      var counts = globeCityCounts(pins);
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (parts[0].rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(mapNoteText) + '</p>');
      html.push('<p>' + esc(cityLabelText) + ': <input type="text" id="refx-globe-city" value="' + esc(defaultCity) + '"> '
        + '<button class="btn ghost" type="button" data-refx-action="globe-add">' + esc(addText) + '</button></p>');
      if (!counts.length) { html.push('<p>' + esc(emptyText) + '</p>'); }
      else {
        html.push('<ul>');
        counts.forEach(function (c) {
          html.push('<li>' + esc(c.city) + ' · ' + esc(String(c.count)) + '</li>');
        });
        html.push('</ul>');
      }
      var mine = pins.filter(function (p) { return p.uid === uid; });
      if (mine.length) {
        html.push('<ul>');
        mine.forEach(function (p) {
          html.push('<li>' + esc(p.city || '') + ' <button class="btn ghost" type="button" data-refx-action="globe-delete" data-refx-id="' + esc(p._id || '') + '">' + esc(deleteText) + '</button></li>');
        });
        html.push('</ul>');
      }
      container.innerHTML = html.join('');
      refxBind(container, function (btn) {
        var action = btn.getAttribute('data-refx-action');
        btn.disabled = true;
        if (action === 'globe-add') {
          var cityEl = document.getElementById('refx-globe-city');
          var city = cityEl ? cityEl.value.trim() : '';
          if (!city) { btn.disabled = false; return; }
          createGlobePin(uid, city).then(function () {
            refxNote(container, sentText);
            renderGlobe(uid);
          }).catch(function () {
            refxNote(container, pendingText);
            btn.disabled = false;
          });
        } else if (action === 'globe-delete') {
          deleteGlobePin(uid, btn.getAttribute('data-refx-id')).then(function () {
            renderGlobe(uid);
          }).catch(function () {
            refxNote(container, pendingText);
            btn.disabled = false;
          });
        }
      });
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- CORE-2 admin queue (appended to renderAdminList) ------
   * WHY appended, not merged: renderAdminList's existing output is
   * untouched — this container is added below it, so no existing
   * admin row, button or admClick wiring can regress. Every button
   * here attaches its own dataset-guarded listener (refxBind), never
   * admClick. Publish actions compute from live admin reads, never
   * from the queue's own displayed rows, so a stale queue view can
   * never publish stale winners. */
  function appealSlaText(createdAt, nowMs) {
    /* Item #45: 48h appeal SLA as display text (no new CSS, no new dict
     * key — the queue render assembles HTML arrays, the same pattern
     * the featured/coach renders use). Returns '' when no date exists,
     * so a row without a timestamp never shows a fake countdown. */
    var t = toMs(createdAt);
    if (isNaN(t)) { return ''; }
    var now = isNaN(toMs(nowMs)) ? Date.now() : toMs(nowMs);
    var hoursLeft = 48 - Math.floor((now - t) / 3600000);
    if (hoursLeft > 48) { hoursLeft = 48; }
    if (hoursLeft <= 0) { return 'SLA OVERDUE'; }
    return 'SLA: ' + hoursLeft + 'h left';
  }
  function renderAdminQueue(containerEl, adminUid) {
    if (typeof document === 'undefined' || !containerEl) { return Promise.resolve(false); }
    var queueEl = null;
    try {
      queueEl = containerEl.querySelector ? containerEl.querySelector('#refx-admin-queue') : null;
    } catch (e) {}
    if (!queueEl) {
      queueEl = document.createElement('div');
      queueEl.id = 'refx-admin-queue';
      containerEl.appendChild(queueEl);
    }
    var titleText = 'Admin queue';
    var pendingText = 'Admin approval pending for this feature.';
    var rulesNoteText = 'Lists load after the owner publishes the new rules; empty lists before then are not proof of no pending items.';
    var settleText = 'Settle';
    var rejectText = 'Reject';
    var approveText = 'Approve';
    var grantText = 'Grant reactivation';
    var rejectReasonText = 'Rejected from admin queue.';
    var noReferrerText = 'No referrer to pay.';
    var qrLabelText = 'QR joins';
    var publishContestText = 'Publish contest';
    var payContestText = 'Pay contest';
    var publishBoardText = 'Publish leaderboard';
    var publishBattleText = 'Publish battle';
    var payBattleText = 'Pay battle';
    var publishShoutoutText = 'Publish shoutout';
    var payShoutoutText = 'Pay shoutout';
    var setGoalText = 'Set goal';
    var distributeGoalText = 'Distribute goal';
    var quarterText = 'Quarterly summary';
    var computeText = 'Compute';
    var copyText = 'Copy summary';
    var csvText = 'Export CSV';
    var copiedText = 'Copied!';
    var noTeamsText = 'No battle teams to publish.';
    var quarter = quarterKey(new Date());
    var month = monthKey(new Date());
    var week = weekKey(new Date());
    var lastQuarter = null;
    return loadAdminQueue().then(function (q) {
      var html = ['<h3>' + esc(titleText) + '</h3><p><span data-refx-note></span></p>'];
      if (q.rulesPending) { html.push('<p>' + esc(pendingText) + '</p>'); }
      html.push('<p>' + esc(rulesNoteText) + '</p>');
      html.push('<p>' + esc(qrLabelText) + ': ' + esc(String(q.qrJoins)) + '</p>');
      var claimsTitle = 'Pending claims';
      html.push('<h4>' + esc(claimsTitle) + '</h4>');
      if (!q.claims.length) { var noneText = 'None.'; html.push('<p>' + esc(noneText) + '</p>'); }
      else {
        html.push('<ul>');
        q.claims.forEach(function (c) {
          /* Item #45: appeal rows carry their 48h SLA state; every other
           * kind renders exactly as before (the helper returns '' for
           * non-appeals and dateless rows). */
          var slaText = (c.kind === 'appeal') ? appealSlaText(c.createdAt, Date.now()) : '';
          html.push('<li>' + esc(c.kind || '') + ' · ' + esc(String(c.amount)) + ' · ' + esc(c.uid || '')
            + (slaText ? ' · <strong>' + esc(slaText) + '</strong>' : '')
            + ' <button class="btn ghost" type="button" data-refx-action="q-settle-claim" data-refx-id="' + esc(c._id || '') + '">' + esc(settleText) + '</button>'
            + ' <button class="btn ghost" type="button" data-refx-action="q-reject-claim" data-refx-id="' + esc(c._id || '') + '">' + esc(rejectText) + '</button></li>');
        });
        html.push('</ul>');
      }
      var purchasesTitle = 'Pending purchases';
      html.push('<h4>' + esc(purchasesTitle) + '</h4>');
      if (!q.purchases.length) { var noneText2 = 'None.'; html.push('<p>' + esc(noneText2) + '</p>'); }
      else {
        html.push('<ul>');
        q.purchases.forEach(function (p) {
          html.push('<li>' + esc(p.kind || '') + ' · ' + esc(String(p.coins)) + ' · ' + esc(p.uid || '')
            + ' <button class="btn ghost" type="button" data-refx-action="q-approve-purchase" data-refx-id="' + esc(p._id || '') + '">' + esc(approveText) + '</button>'
            + ' <button class="btn ghost" type="button" data-refx-action="q-reject-purchase" data-refx-id="' + esc(p._id || '') + '">' + esc(rejectText) + '</button></li>');
        });
        html.push('</ul>');
      }
      var contributionsTitle = 'Pending contributions';
      html.push('<h4>' + esc(contributionsTitle) + '</h4>');
      if (!q.contributions.length) { var noneText3 = 'None.'; html.push('<p>' + esc(noneText3) + '</p>'); }
      else {
        html.push('<ul>');
        q.contributions.forEach(function (c) {
          html.push('<li>' + esc(c.poolId || '') + ' · ' + esc(String(c.coins)) + ' · ' + esc(c.uid || '')
            + ' <button class="btn ghost" type="button" data-refx-action="q-approve-contribution" data-refx-id="' + esc(c._id || '') + '">' + esc(approveText) + '</button></li>');
        });
        html.push('</ul>');
      }
      var reactTitle = 'Reactivation candidates';
      html.push('<h4>' + esc(reactTitle) + '</h4>');
      if (!q.reactivationCandidates.length) { var noneText4 = 'None.'; html.push('<p>' + esc(noneText4) + '</p>'); }
      else {
        html.push('<ul>');
        q.reactivationCandidates.forEach(function (c) {
          html.push('<li>' + esc(c.uid) + ' · ' + esc(String(c.gapDays)) + ' days');
          if (c.referrerId) {
            html.push(' <button class="btn ghost" type="button" data-refx-action="q-grant-reactivation" data-refx-invitee="' + esc(c.uid) + '" data-refx-referrer="' + esc(c.referrerId) + '">' + esc(grantText) + '</button>');
          } else {
            html.push(' · ' + esc(noReferrerText));
          }
          html.push('</li>');
        });
        html.push('</ul>');
      }
      var devicesTitle = 'Shared devices';
      html.push('<h4>' + esc(devicesTitle) + '</h4>');
      var deviceKeys = Object.keys(q.deviceClusters);
      if (!deviceKeys.length) { var noneText5 = 'None.'; html.push('<p>' + esc(noneText5) + '</p>'); }
      else {
        html.push('<ul>');
        deviceKeys.forEach(function (dev) {
          html.push('<li>' + esc(dev) + ' · ' + esc(q.deviceClusters[dev].join(', ')) + '</li>');
        });
        html.push('</ul>');
      }
      var freezeTitle = 'Frozen accounts';
      html.push('<h4>' + esc(freezeTitle) + '</h4>');
      if (!q.freezeList.length) { var noneText6 = 'None.'; html.push('<p>' + esc(noneText6) + '</p>'); }
      else {
        html.push('<ul>');
        q.freezeList.forEach(function (f) {
          html.push('<li>' + esc(f.uid) + ' · ' + esc(fmtDate(f.lastActive)) + '</li>');
        });
        html.push('</ul>');
      }
      var unverifiedTitle = 'Unverified referred users';
      html.push('<h4>' + esc(unverifiedTitle) + '</h4>');
      if (!q.unverifiedList.length) { var noneText7 = 'None.'; html.push('<p>' + esc(noneText7) + '</p>'); }
      else {
        html.push('<ul>');
        q.unverifiedList.forEach(function (u) {
          html.push('<li>' + esc(u.uid) + ' · ' + esc(u.referrerId || '') + '</li>');
        });
        html.push('</ul>');
      }
      var publishTitle = 'Publish actions';
      html.push('<h4>' + esc(publishTitle) + '</h4>');
      html.push('<p><button class="btn ghost" type="button" data-refx-action="q-publish-contest">' + esc(publishContestText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-pay-contest">' + esc(payContestText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-publish-board">' + esc(publishBoardText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-publish-battle">' + esc(publishBattleText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-pay-battle">' + esc(payBattleText) + '</button></p>');
      var shoutUidLabel = 'Shoutout user id';
      var shoutStoryLabel = 'Shoutout story';
      html.push('<p>' + esc(shoutUidLabel) + ': <input type="text" id="refx-q-shout-uid"> '
        + esc(shoutStoryLabel) + ': <input type="text" id="refx-q-shout-story"> '
        + '<button class="btn ghost" type="button" data-refx-action="q-publish-shoutout">' + esc(publishShoutoutText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-pay-shoutout">' + esc(payShoutoutText) + '</button></p>');
      /* Fix (Oct 27): adminFeatureContent had zero callers, so #35
       * could never be published from the UI. Mirrors the shoutout
       * input pattern exactly: two inputs + one button, dispatched
       * below through the existing q-* mechanism. */
      var featuredUidLabel = 'Featured user id';
      var featuredIdLabel = 'Featured piece id';
      var publishFeaturedText = 'Publish featured';
      html.push('<p>' + esc(featuredUidLabel) + ': <input type="text" id="refx-q-featured-uid"> '
        + esc(featuredIdLabel) + ': <input type="text" id="refx-q-featured-id"> '
        + '<button class="btn ghost" type="button" data-refx-action="q-publish-featured">' + esc(publishFeaturedText) + '</button></p>');
      var goalTargetLabel = 'Goal target';
      var goalMonthLabel = 'Goal month';
      html.push('<p>' + esc(goalTargetLabel) + ': <input type="number" id="refx-q-goal-target"> '
        + esc(goalMonthLabel) + ': <input type="text" id="refx-q-goal-month" value="' + esc(month) + '"> '
        + '<button class="btn ghost" type="button" data-refx-action="q-set-goal">' + esc(setGoalText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-distribute-goal">' + esc(distributeGoalText) + '</button></p>');
      html.push('<h4>' + esc(quarterText) + '</h4>');
      var manualNoteText = 'Quarterly summaries are never auto-published; the admin posts them manually.';
      html.push('<p>' + esc(manualNoteText) + '</p>');
      html.push('<p><input type="text" id="refx-q-quarter" value="' + esc(quarter) + '"> '
        + '<button class="btn ghost" type="button" data-refx-action="q-quarter">' + esc(computeText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-quarter-copy">' + esc(copyText) + '</button> '
        + '<button class="btn ghost" type="button" data-refx-action="q-quarter-csv">' + esc(csvText) + '</button></p>');
      html.push('<div id="refx-q-quarter-out"></div>');
      queueEl.innerHTML = html.join('');
      refxBind(queueEl, function (btn) {
        var action = btn.getAttribute('data-refx-action');
        var id = btn.getAttribute('data-refx-id');
        function refresh() { renderAdminQueue(containerEl, adminUid); }
        function fail(err) {
          var msg = (err && err.message) ? err.message : pendingText;
          refxNote(queueEl, msg);
          btn.disabled = false;
        }
        function paidNote(label, amount) {
          var text = label + ': ' + amount;
          refxNote(queueEl, text);
        }
        btn.disabled = true;
        if (action === 'q-settle-claim') {
          adminSettleClaim(adminUid, id).then(function (paid) { paidNote('Settled', paid); refresh(); }).catch(fail);
        } else if (action === 'q-reject-claim') {
          adminRejectClaim(adminUid, id, rejectReasonText).then(refresh).catch(fail);
        } else if (action === 'q-approve-purchase') {
          adminApprovePurchase(adminUid, id).then(function (paid) { paidNote('Approved', paid); refresh(); }).catch(fail);
        } else if (action === 'q-reject-purchase') {
          adminRejectPurchase(adminUid, id, rejectReasonText).then(refresh).catch(fail);
        } else if (action === 'q-approve-contribution') {
          adminApproveContribution(adminUid, id).then(refresh).catch(fail);
        } else if (action === 'q-grant-reactivation') {
          adminGrantReactivation(adminUid, btn.getAttribute('data-refx-invitee'), btn.getAttribute('data-refx-referrer')).then(function (paid) { paidNote('Granted', paid); refresh(); }).catch(fail);
        } else if (action === 'q-publish-contest') {
          adminComputeContestTally(month).then(function (tally) {
            return loadPublicDoc('contest_winners', month).then(function (res) {
              var pool = (res.doc && res.doc.bonusPool) || 0;
              return adminPublishContest(adminUid, month, tally, pool);
            });
          }).then(refresh).catch(fail);
        } else if (action === 'q-pay-contest') {
          adminPayContest(adminUid, month).then(function (res) { paidNote('Contest paid', res.paid); refresh(); }).catch(fail);
        } else if (action === 'q-publish-board') {
          adminComputeBoard(week).then(function (entries) {
            return adminPublishBoard(adminUid, week, entries);
          }).then(refresh).catch(fail);
        } else if (action === 'q-publish-battle') {
          adminComputeBattleTeams(week).then(function (teams) {
            if (!teams.length) { refxNote(queueEl, noTeamsText); btn.disabled = false; return; }
            return adminPublishBattle(adminUid, week, teams, teams[0].referrerUid).then(refresh);
          }).catch(fail);
        } else if (action === 'q-pay-battle') {
          adminPayBattle(adminUid, week).then(function (res) {
            var text = 'Battle paid: ' + res.paid + ', share ' + res.share + ', remainder ' + res.remainder;
            refxNote(queueEl, text);
            refresh();
          }).catch(fail);
        } else if (action === 'q-publish-shoutout') {
          var suEl = document.getElementById('refx-q-shout-uid');
          var ssEl = document.getElementById('refx-q-shout-story');
          var su = suEl ? suEl.value.trim() : '';
          var ss = ssEl ? ssEl.value.trim() : '';
          if (!su) { btn.disabled = false; return; }
          adminPublishShoutout(adminUid, month, su, ss).then(refresh).catch(fail);
        } else if (action === 'q-pay-shoutout') {
          adminPayShoutout(adminUid, month).then(function (res) { paidNote('Shoutout paid', res.paid); refresh(); }).catch(fail);
        } else if (action === 'q-publish-featured') {
          var fuEl = document.getElementById('refx-q-featured-uid');
          var fidEl = document.getElementById('refx-q-featured-id');
          var fu = fuEl ? fuEl.value.trim() : '';
          var fid = fidEl ? fidEl.value.trim() : '';
          if (!fu || !fid) { btn.disabled = false; return; }
          adminFeatureContent(adminUid, fu, fid).then(function (paid) { paidNote('Featured paid', paid); refresh(); }).catch(fail);
        } else if (action === 'q-set-goal') {
          var gtEl = document.getElementById('refx-q-goal-target');
          var gmEl = document.getElementById('refx-q-goal-month');
          var gt = gtEl ? Number(gtEl.value) : 0;
          var gm = gmEl ? gmEl.value.trim() : month;
          adminSetGoal(adminUid, gt, gm).then(refresh).catch(fail);
        } else if (action === 'q-distribute-goal') {
          var gmEl2 = document.getElementById('refx-q-goal-month');
          var gm2 = gmEl2 ? gmEl2.value.trim() : month;
          adminDistributeGoal(adminUid, gm2).then(function (res) { paidNote('Goal paid', res.paid); refresh(); }).catch(fail);
        } else if (action === 'q-quarter') {
          var qEl = document.getElementById('refx-q-quarter');
          var qkey = qEl ? qEl.value.trim() : quarter;
          var outEl = document.getElementById('refx-q-quarter-out');
          var d = coreDb();
          if (!d || !outEl) { btn.disabled = false; return; }
          Promise.all([
            d.collection('referrals').get().then(snapshotRows).catch(function () { return []; }),
            d.collection('reward_claims').get().then(snapshotRows).catch(function () { return []; }),
            d.collection('plan_purchases').get().then(snapshotRows).catch(function () { return []; }),
            d.collection('pools').get().then(snapshotRows).catch(function () { return []; })
          ]).then(function (parts2) {
            lastQuarter = quarterlySummary({ referrals: parts2[0], claims: parts2[1], purchases: parts2[2], pools: parts2[3] }, qkey);
            var qHtml = [];
            var qQuarterLabel = 'Quarter';
            var qRefsLabel = 'Referrals';
            var qActiveLabel = 'Active';
            var qClaimsLabel = 'Settled claims';
            var qPurchasesLabel = 'Approved purchases';
            var qPoolsLabel = 'Pools balance';
            qHtml.push('<p>' + esc(qQuarterLabel) + ': ' + esc(lastQuarter.quarter) + ' · ' + esc(qRefsLabel) + ': ' + esc(String(lastQuarter.referralsTotal)) + ' · ' + esc(qActiveLabel) + ': ' + esc(String(lastQuarter.referralsActive)) + '</p>');
            qHtml.push('<p>' + esc(qClaimsLabel) + ': ' + esc(String(lastQuarter.claimsSettledCount)) + ' · ' + esc(String(lastQuarter.claimsSettledTotal)) + ' · ' + esc(qPurchasesLabel) + ': ' + esc(String(lastQuarter.purchasesApprovedCount)) + ' · ' + esc(String(lastQuarter.purchasesApprovedTotal)) + ' · ' + esc(qPoolsLabel) + ': ' + esc(String(lastQuarter.poolsCount)) + ' · ' + esc(String(lastQuarter.poolsBalanceTotal)) + '</p>');
            outEl.innerHTML = qHtml.join('');
            btn.disabled = false;
          }).catch(function () { btn.disabled = false; });
        } else if (action === 'q-quarter-copy') {
          if (!lastQuarter) { btn.disabled = false; return; }
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(JSON.stringify(lastQuarter)).then(function () { refxNote(queueEl, copiedText); });
            } else { refxNote(queueEl, copiedText); }
          } catch (e) {}
          btn.disabled = false;
        } else if (action === 'q-quarter-csv') {
          if (!lastQuarter) { btn.disabled = false; return; }
          var csvText = 'quarter,referrals,active,claims_count,claims_total,purchases_count,purchases_total,pools_count,pools_balance\n'
            + lastQuarter.quarter + ',' + lastQuarter.referralsTotal + ',' + lastQuarter.referralsActive + ',' + lastQuarter.claimsSettledCount + ',' + lastQuarter.claimsSettledTotal + ',' + lastQuarter.purchasesApprovedCount + ',' + lastQuarter.purchasesApprovedTotal + ',' + lastQuarter.poolsCount + ',' + lastQuarter.poolsBalanceTotal;
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
          var csvFileName = 'dokit-quarterly-summary.csv';
          a.download = csvFileName;
          a.click();
          btn.disabled = false;
        } else {
          btn.disabled = false;
        }
      });
      return true;
    }).catch(function () { return false; });
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
    renderAdminList: renderAdminList, privacyNameFor: privacyNameFor,
    csvExport: csvExport,
    toCsv: toCsv,
    adminGrant: adminGrant,
    adminSetPaused: adminSetPaused,
    recordActivation: recordActivation,
    db: db,
    /* CORE-1 exports (pure helpers, backend, lazy loads, renders). */
    monthKey: monthKey, weekKey: weekKey, quarterKey: quarterKey, seasonOf: seasonOf,
    dailyStreakFromClaims: dailyStreakFromClaims, dailyClaimRate: dailyClaimRate,
    lifetimeWords: lifetimeWords, speedMilestones: speedMilestones,
    lessonSetProgress: lessonSetProgress, typefightWins: typefightWins,
    typefightDailyClaim: typefightDailyClaim,
    weeklyProgress: weeklyProgress, profileCompleteness: profileCompleteness,
    seasonQuestsProgress: seasonQuestsProgress, forecastToPro: forecastToPro,
    coachTips: coachTips, festivalActive: festivalActive,
    streakMultiplierActive: streakMultiplierActive, applyMultipliers: applyMultipliers,
    runningBalance: runningBalance, isFrozen: isFrozen,
    ambassadorCounts: ambassadorCounts, deviceDuplicateMap: deviceDuplicateMap,
    createClaim: createClaim, listMyClaims: listMyClaims, adminListClaims: adminListClaims,
    adminSettleClaim: adminSettleClaim, adminRejectClaim: adminRejectClaim,
    requestPurchase: requestPurchase, adminApprovePurchase: adminApprovePurchase,
    adminRejectPurchase: adminRejectPurchase, requestRefund: requestRefund,
    createPool: createPool, contributePool: contributePool,
    adminApproveContribution: adminApproveContribution, adminActivatePool: adminActivatePool,
    treasuryVote: treasuryVote, adminExecuteTreasurySpend: adminExecuteTreasurySpend,
    loadMyLedgerFull: loadMyLedgerFull, loadMyClaims: loadMyClaims,
    loadMyPurchases: loadMyPurchases, loadMyPools: loadMyPools,
    renderEarningsLog: renderEarningsLog, renderClaims: renderClaims,
    renderPurchases: renderPurchases, renderPools: renderPools,
    renderOptOut: renderOptOut, renderFreezeBanner: renderFreezeBanner,
    renderVerification: renderVerification, stampEmailVerified: stampEmailVerified,
    currentUid: currentUid, consecutiveProTeamCount: consecutiveProTeamCount,
    /* CORE-2 exports (pure helpers, backend, lazy loads, renders). */
    contestTally: contestTally, battleTeams: battleTeams, boardEntries: boardEntries,
    quarterBounds: quarterBounds, quarterlySummary: quarterlySummary,
    globeCityCounts: globeCityCounts, seasonChestAmount: seasonChestAmount,
    computeReactivationCandidates: computeReactivationCandidates,
    computeFreezeList: computeFreezeList, computeUnverifiedList: computeUnverifiedList,
    loadPublicDoc: loadPublicDoc, loadGlobePins: loadGlobePins,
    loadMyCoinClaims: loadMyCoinClaims, loadMyChallenges: loadMyChallenges,
    loadAdminQueue: loadAdminQueue,
    adminComputeContestTally: adminComputeContestTally, adminPublishContest: adminPublishContest,
    adminPayContest: adminPayContest, adminComputeBoard: adminComputeBoard,
    adminPublishBoard: adminPublishBoard, adminSetGoal: adminSetGoal,
    adminDistributeGoal: adminDistributeGoal,
    createChallenge: createChallenge, acceptChallenge: acceptChallenge,
    confirmChallengeDone: confirmChallengeDone, adminSetChallengeStatus: adminSetChallengeStatus,
    adminFeatureContent: adminFeatureContent, adminGrantReactivation: adminGrantReactivation,
    adminComputeBattleTeams: adminComputeBattleTeams, adminPublishBattle: adminPublishBattle,
    adminPayBattle: adminPayBattle, adminPublishShoutout: adminPublishShoutout,
    adminPayShoutout: adminPayShoutout, createGlobePin: createGlobePin,
    deleteGlobePin: deleteGlobePin, qrReferralLink: qrReferralLink,
    renderContest: renderContest, renderLeaderboard: renderLeaderboard,
    renderGoal: renderGoal, renderChallenges: renderChallenges,
    renderFeatured: renderFeatured, renderAmbassador: renderAmbassador,
    renderQR: renderQR, renderPairStreak: renderPairStreak,
    renderBattles: renderBattles, renderShoutout: renderShoutout, renderHomepageShoutout: renderHomepageShoutout, shoutoutCardHtml: shoutoutCardHtml,
    renderPosters: renderPosters, renderSeason: renderSeason,
    renderTreasury: renderTreasury, renderCoachForecast: renderCoachForecast, rateGraceLeft: rateGraceLeft, renderRateAnnouncement: renderRateAnnouncement,
    renderGlobe: renderGlobe, renderAdminQueue: renderAdminQueue, appealSlaText: appealSlaText, bugFormPayload: bugFormPayload, appealableClaims: appealableClaims, appealFormPayload: appealFormPayload,
    classCodeValid: classCodeValid, classCodeNormalize: classCodeNormalize, classJoinCount: classJoinCount, loadClassJoinRows: loadClassJoinRows, mergeReferralRows: mergeReferralRows, classClaimable: classClaimable, classClaimPayload: classClaimPayload, requestClassCode: requestClassCode, adminApproveClass: adminApproveClass, loadMyClasses: loadMyClasses, loadPendingClasses: loadPendingClasses, renderClassDashboard: renderClassDashboard, isViewerAdmin: isViewerAdmin,
    boardLabelFor: boardLabelFor, loadShowcaseBoards: loadShowcaseBoards, showcaseCardHtml: showcaseCardHtml, adminPublishContributor: adminPublishContributor, renderContributorsWall: renderContributorsWall, renderHomepageFeatured: renderHomepageFeatured
  };
  root.DKREF = DKREF;
  if (typeof module !== 'undefined' && module.exports) { module.exports = DKREF; }
})();
