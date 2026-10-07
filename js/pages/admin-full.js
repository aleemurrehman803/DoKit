/* DoKit — Full Admin Panel (admin-full.js).
   Runs AFTER js/pages/admin.js (the gate). Only loads data once the admin
   panel is visible AND the admin doc check passes (verified again here).

   Sections:
   1. Dashboard — real Firestore stats
   2. Users — searchable table, detail view, coin actions
   3. Content — tool enable/disable toggles, guides/blog lists
   4. Audit log — every admin action logged to `admin_audit`
   5. Security — 2FA / IP whitelist / rate limits / OTP (Phase 6 scaffolding;
      UI only until launch; enforcement is server-side)

   All queries wrapped in try/catch with loading + error states.
   Never throws on the page; guests/non-admins see nothing. */
(function () {
  "use strict";

  var USERS_FETCH_LIMIT = 200;
  var PAGE_SIZE = 20;
  var RUNS_SCAN_LIMIT = 500; // cap for 30-day scan (read-budget guard)

  var state = {
    admin: null,       // { uid, email }
    booted: false,
    users: [],         // fetched user docs
    userQuery: "",
    userPage: 0,
    runCounts: {},     // uid -> number (cached)
    detailUid: null,
    bulk: [],          // selected user uids for bulk actions (#9)
    tools: [
      { id: "image-resizer",    name: "Image Resizer",    href: "../tools/image-resizer/" },
      { id: "image-compressor", name: "Image Compressor", href: "../tools/image-compressor/" },
      { id: "image-converter",  name: "Image Converter",  href: "../tools/image-converter/" },
      { id: "word-counter",     name: "Word Counter",     href: "../tools/word-counter/" },
      { id: "case-converter",   name: "Case Converter",   href: "../tools/case-converter/" },
      { id: "typing",           name: "TypeMaster",       href: "../typing/" },
      { id: "typefight",        name: "TypeFight",        href: "../typefight/" }
    ],
    guides: [
      { name: "Resize images guide",   href: "../guides/resize-images-guide.html" },
      { name: "Compress images guide", href: "../guides/compress-images-guide.html" },
      { name: "Count words guide",     href: "../guides/count-words-guide.html" },
      { name: "Convert images guide",  href: "../guides/convert-images-guide.html" },
      { name: "Convert case guide",    href: "../guides/convert-case-guide.html" }
    ],
    posts: [
      { name: "Website images too big", href: "../blog/website-images-too-big.html" },
      { name: "Word count targets",     href: "../blog/word-count-targets.html" },
      { name: "Touch typing 30 days",   href: "../blog/touch-typing-30-days.html" }
    ]
  };

  /* ---------------- helpers ---------------- */

  function $(id) { return document.getElementById(id); }

  /* Shared esc (js/dk-utils.js) with local fallback — resolved once at load. */
  var esc = (window.DKUtils && DKUtils.esc) || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function db() {
    try { return (window.DKF && DKF.db()) || null; } catch (e) { return null; }
  }

  function fv() {
    try { return firebase.firestore.FieldValue; } catch (e) { return null; }
  }

  /* Normalize Firestore Timestamp / Date / epoch-ms to epoch-ms. */
  function toMillis(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (v instanceof Date) return v.getTime();
    try { if (typeof v.toMillis === "function") return v.toMillis(); } catch (e) {}
    if (typeof v.seconds === "number") return v.seconds * 1000;
    return 0;
  }

  function relTime(ms) {
    if (!ms) return "—";
    var d = Date.now() - ms;
    if (d < 0) d = 0;
    var m = Math.floor(d / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var days = Math.floor(h / 24);
    if (days < 30) return days + "d ago";
    return new Date(ms).toLocaleDateString();
  }

  function fmtDate(ms) {
    if (!ms) return "—";
    try { return new Date(ms).toLocaleString(); } catch (e) { return "—"; }
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  var SPINNER = '<span class="adm-spin" aria-hidden="true"></span><span class="sr-note">Loading…</span>';

  function setHtml(id, html) { var n = $(id); if (n) n.innerHTML = html; }

  function errHtml(msg) {
    return '<p class="adm-err">⚠️ ' + esc(msg) + "</p>";
  }

  /* ---------------- audit log ---------------- */

  function logAudit(action, target, details) {
    try {
      var d = db();
      if (!d || !state.admin) return;
      var F = fv();
      d.collection("admin_audit").add({
        adminUid: state.admin.uid,
        adminEmail: state.admin.email || "",
        action: action,
        target: target || "",
        details: details || "",
        timestamp: F ? F.serverTimestamp() : new Date()
      }).catch(function () { /* best-effort */ });
    } catch (e) { /* never break the UI */ }
  }

  /* Exposed for js/pages/admin-plus.js (the 20-improvements extension). */
  window.DKAdmin = window.DKAdmin || {};
  window.DKAdmin.logAudit = logAudit;
  window.DKAdmin.getAdmin = function () { return state.admin; };

  /* ---------------- gate: wait for admin.js to reveal the panel ---------------- */

  function whenPanelVisible(cb) {
    var panel = $("adminPanel");
    if (panel && panel.style.display !== "none") { cb(); return; }
    var obs = new MutationObserver(function () {
      var p = $("adminPanel");
      if (p && p.style.display !== "none") { obs.disconnect(); cb(); }
    });
    obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["style"] });
    // Safety net: stop observing after 30s.
    setTimeout(function () { try { obs.disconnect(); } catch (e) {} }, 30000);
  }

  function verifyAndBoot() {
    if (state.booted) return;
    var d = db();
    if (!d) return;
    try {
      DKF.onUser(function (user) {
        if (!user || state.booted) return;
        d.collection("admins").doc(user.uid).get().then(function (snap) {
          if (snap.exists && !state.booted) {
            state.booted = true;
            state.admin = { uid: user.uid, email: user.email || "" };
            boot();
          }
        }).catch(function () { /* gate already denied */ });
      });
    } catch (e) {}
  }

  /* ---------------- tabs ---------------- */

  var TABS = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "analytics", label: "📈 Analytics" },
    { id: "users",     label: "👥 Users" },
    { id: "content",   label: "🧩 Content" },
    { id: "audit",     label: "📜 Audit log" },
    { id: "security",  label: "🔐 Security" },
    { id: "deposits",  label: "💰 Deposits" },
    { id: "withdrawals", label: "💸 Withdrawals" },
    { id: "paysettings", label: "⚙️ Pay settings" },
    { id: "settings",  label: "⚙️ Settings" },
    { id: "flags",     label: "🚩 Feature flags" },
    { id: "announce",  label: "📢 Announcement" },
    { id: "inbox",     label: "📥 Inbox" },
    { id: "competitors", label: "👀 Competitors" },
    { id: "alerts",    label: "🔔 Alerts" },
    { id: "ab",        label: "🎯 A/B tests" },
    { id: "cohorts",   label: "📊 Cohorts" },
    { id: "fraud",     label: "🛡️ Fraud" },
    { id: "tickets",   label: "🎫 Tickets" },
    { id: "changelog", label: "📝 Changelog" },
    { id: "referrals", label: "🔗 Referrals" },
    { id: "tiers",     label: "🎖️ Tiers" },
    { id: "kb",        label: "🧠 Knowledge" },
    { id: "i18n",      label: "🌍 Translations" },
    { id: "import",    label: "📤 Import" },
    { id: "og",        label: "🖼️ OG images" },
    { id: "views",     label: "🗂️ Views" }
  ];

  function wireTabs() {
    var bar = $("admTabs");
    if (!bar) return;
    bar.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-tab]");
      if (!btn) return;
      var id = btn.getAttribute("data-tab");
      TABS.forEach(function (t) {
        var b = bar.querySelector('[data-tab="' + t.id + '"]');
        var sec = $("admTab-" + t.id);
        var on = t.id === id;
        if (b) { b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); }
        if (sec) sec.style.display = on ? "" : "none";
      });
    });
  }

  /* ================= 1. DASHBOARD ================= */

  function loadDashboard() {
    var d = db();
    if (!d) { setHtml("admDashErr", errHtml("Database unavailable.")); return; }

    ["statUsers", "statRuns", "statCoins", "statNew"].forEach(function (id) {
      setHtml(id, SPINNER);
    });
    setHtml("admActivity", SPINNER);

    var now = Date.now();
    var d30 = now - 30 * 864e5;
    var d7 = now - 7 * 864e5;

    var pUsers = d.collection("users").get();
    var pRuns = d.collectionGroup("tool_runs").limit(RUNS_SCAN_LIMIT).get();

    Promise.all([pUsers, pRuns]).then(function (res) {
      var uSnap = res[0], rSnap = res[1];

      // Users + coins + new users
      var coins = 0, newUsers = 0;
      uSnap.forEach(function (doc) {
        var u = doc.data() || {};
        coins += Number(u.coins) || 0;
        if (toMillis(u.createdAt) >= d7) newUsers++;
      });
      setHtml("statUsers", "<strong>" + fmtNum(uSnap.size) + "</strong>");
      setHtml("statCoins", "<strong>" + fmtNum(coins) + "</strong>");
      setHtml("statNew", "<strong>" + fmtNum(newUsers) + "</strong>");

      // Tool runs (30d) + recent activity
      var runs = [];
      rSnap.forEach(function (doc) {
        var r = doc.data() || {};
        var ts = toMillis(r.ts);
        if (!ts) ts = toMillis(r.createdAt);
        runs.push({ id: doc.id, tool: r.tool || "?", action: r.action || "", ts: ts, ref: doc.ref });
      });
      var recent = runs.filter(function (r) { return r.ts >= d30; });
      setHtml("statRuns", "<strong>" + fmtNum(recent.length) + "</strong>");

      renderActivity(runs);
    }).catch(function (err) {
      var msg = "Could not load stats. " + friendlyDbErr(err);
      ["statUsers", "statRuns", "statCoins", "statNew"].forEach(function (id) {
        setHtml(id, errHtml("—"));
      });
      setHtml("admActivity", errHtml(msg));
      setHtml("admDashErr", errHtml(msg));
    });
  }

  function renderActivity(runs) {
    runs.sort(function (a, b) { return b.ts - a.ts; });
    var top = runs.slice(0, 10);
    if (!top.length) {
      setHtml("admActivity", '<p style="color:var(--text-muted)">No tool activity yet.</p>');
      return;
    }
    // Resolve user names for the activity rows.
    var d = db();
    var uids = {};
    top.forEach(function (r) {
      try {
        var uid = r.ref.parent.parent.id;
        if (uid) uids[uid] = true;
      } catch (e) {}
    });
    var ids = Object.keys(uids);
    Promise.all(ids.map(function (uid) {
      return d.collection("users").doc(uid).get().then(function (s) {
        var u = (s.exists && s.data()) || {};
        return { uid: uid, name: u.name || u.email || uid.slice(0, 8) + "…" };
      }).catch(function () { return { uid: uid, name: uid.slice(0, 8) + "…" }; });
    })).then(function (names) {
      var map = {};
      names.forEach(function (n) { map[n.uid] = n.name; });
      var html = '<ul class="adm-feed">' + top.map(function (r) {
        var uid = "";
        try { uid = r.ref.parent.parent.id; } catch (e) {}
        var who = esc(map[uid] || "Someone");
        var what = esc(r.tool) + (r.action ? " — " + esc(String(r.action).slice(0, 60)) : "");
        return '<li><span class="adm-feed-dot" aria-hidden="true"></span>' +
          "<div><strong>" + who + "</strong> used " + what +
          '<div class="adm-muted">' + esc(relTime(r.ts)) + "</div></div></li>";
      }).join("") + "</ul>";
      setHtml("admActivity", html);
    }).catch(function () {
      setHtml("admActivity", '<p style="color:var(--text-muted)">Activity loaded, names unavailable.</p>');
    });
  }

  /* ================= 1b. ANALYTICS =================
   * Reads the Firestore `analytics` collection (privacy-friendly page-view
   * telemetry: {page, ts, ref, lang} — NO PII by contract). Shows total page
   * views, views in the last 24h, and the top 5 pages. Read-budget guard:
   * orderBy ts desc, limit 500. */

  function loadAnalytics() {
    var d = db();
    if (!d) {
      setHtml("statPageViews", "—");
      setHtml("statViewsToday", "—");
      setHtml("admAnalyticsBody", '<tr><td colspan="3">' + errHtml("Database unavailable.") + "</td></tr>");
      return;
    }
    setHtml("statPageViews", SPINNER);
    setHtml("statViewsToday", SPINNER);
    setHtml("admAnalyticsBody", '<tr><td colspan="3">' + SPINNER + "</td></tr>");
    d.collection("analytics").orderBy("ts", "desc").limit(500).get()
      .then(function (snap) {
        var total = snap.size;
        var dayAgo = Date.now() - 864e5;
        var today = 0;
        var byPage = {};
        snap.forEach(function (doc) {
          var e = doc.data() || {};
          var ts = toMillis(e.ts);
          if (ts >= dayAgo) today++;
          var p = String(e.page || "(unknown)").slice(0, 120);
          if (!byPage[p]) byPage[p] = { count: 0, last: 0 };
          byPage[p].count++;
          if (ts > byPage[p].last) byPage[p].last = ts;
        });
        setHtml("statPageViews", "<strong>" + fmtNum(total) + "</strong>");
        setHtml("statViewsToday", "<strong>" + fmtNum(today) + "</strong>");
        var pages = Object.keys(byPage).map(function (p) {
          return { page: p, count: byPage[p].count, last: byPage[p].last };
        }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5);
        if (!pages.length) {
          setHtml("admAnalyticsBody",
            '<tr><td colspan="3" style="color:var(--text-muted)">No page views recorded yet.</td></tr>');
        } else {
          setHtml("admAnalyticsBody", pages.map(function (r) {
            return "<tr><td><code>" + esc(r.page) + "</code></td>" +
              "<td><strong>" + fmtNum(r.count) + "</strong></td>" +
              "<td>" + esc(relTime(r.last)) + "</td></tr>";
          }).join(""));
        }
        logAudit("analytics_view", "analytics", "views:" + total);
      })
      .catch(function (err) {
        setHtml("statPageViews", errHtml("—"));
        setHtml("statViewsToday", errHtml("—"));
        setHtml("admAnalyticsBody",
          '<tr><td colspan="3">' + errHtml("Could not load analytics. " + friendlyDbErr(err)) + "</td></tr>");
      });
  }

  /* ================= 1c. BACKUP REMINDER =================
   * "Last backup" is tracked in localStorage ('dokit_last_backup_ts').
   * "Export now (JSON)" downloads: site_settings/announcement,
   * site_settings/flags, and counts of newsletter/feedback docs.
   * Deliberately NO user PII — only settings + aggregate counts. */

  var BACKUP_TS_KEY = "dokit_last_backup_ts";

  function renderBackupWhen() {
    var el = $("admBackupWhen");
    if (!el) return;
    var ts = 0;
    try { ts = Number(localStorage.getItem(BACKUP_TS_KEY)) || 0; } catch (e) {}
    if (!ts) { el.textContent = "Never"; return; }
    var days = Math.floor((Date.now() - ts) / 864e5);
    el.textContent = days <= 0 ? "today"
      : days === 1 ? "1 day ago"
      : days + " days ago";
  }

  function downloadJson(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  function exportBackup() {
    var d = db();
    if (!d) { alert("Database unavailable — cannot export."); return; }
    var pAnn = d.collection("site_settings").doc("announcement").get().catch(function () { return null; });
    var pFlags = d.collection("site_settings").doc("flags").get().catch(function () { return null; });
    var pNews = d.collection("newsletter").get().catch(function () { return null; });
    var pFb = d.collection("feedback").get().catch(function () { return null; });
    Promise.all([pAnn, pFlags, pNews, pFb]).then(function (res) {
      var payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: currentAdminUid(),
        site_settings: {
          announcement: (res[0] && res[0].exists) ? res[0].data() : null,
          flags: (res[1] && res[1].exists) ? res[1].data() : null
        },
        counts: {
          newsletter: res[2] ? res[2].size : 0,
          feedback: res[3] ? res[3].size : 0
        }
      };
      downloadJson("dokit-backup-" + new Date().toISOString().slice(0, 10) + ".json", payload);
      try { localStorage.setItem(BACKUP_TS_KEY, String(Date.now())); } catch (e) {}
      renderBackupWhen();
      logAudit("backup_export", "site_settings+counts",
        "newsletter:" + payload.counts.newsletter + " feedback:" + payload.counts.feedback);
    }).catch(function (err) {
      alert("Backup export failed: " + friendlyDbErr(err));
    });
  }

  function wireBackup() {
    var btn = $("admBackupBtn");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", exportBackup);
    renderBackupWhen();
  }

  /* ================= 2. USERS ================= */

  function loadUsers() {
    var d = db();
    if (!d) { setHtml("admUsersBody", '<tr><td colspan="7">' + errHtml("Database unavailable.") + "</td></tr>"); return; }
    setHtml("admUsersBody", '<tr><td colspan="7">' + SPINNER + "</td></tr>");
    d.collection("users").orderBy("createdAt", "desc").limit(USERS_FETCH_LIMIT).get()
      .then(function (snap) {
        state.users = [];
        snap.forEach(function (doc) {
          var u = doc.data() || {};
          state.users.push({
            uid: doc.id,
            name: u.name || "",
            email: u.email || "",
            photoURL: u.photoURL || "",
            coins: Number(u.coins) || 0,
            createdAt: toMillis(u.createdAt),
            lastLogin: toMillis(u.lastLogin),
            suspended: !!u.suspended,
            suspendReason: u.suspendReason || "",
            suspendUntil: toMillis(u.suspendUntil)
          });
        });
        state.userPage = 0;
        renderUsers();
      })
      .catch(function (err) {
        setHtml("admUsersBody", '<tr><td colspan="7">' + errHtml("Could not load users. " + friendlyDbErr(err)) + "</td></tr>");
      });
  }

  /* True while a suspension is in force (no expiry, or expiry in future). */
  function suspensionActive(u) {
    if (!u || !u.suspended) return false;
    return !u.suspendUntil || u.suspendUntil > Date.now();
  }

  function filteredUsers() {
    var q = (state.userQuery || "").toLowerCase().trim();
    if (!q) return state.users;
    return state.users.filter(function (u) {
      return (u.name || "").toLowerCase().indexOf(q) !== -1 ||
             (u.email || "").toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderUsers() {
    var list = filteredUsers();
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.userPage >= pages) state.userPage = pages - 1;
    var start = state.userPage * PAGE_SIZE;
    var page = list.slice(start, start + PAGE_SIZE);

    if (!page.length) {
      setHtml("admUsersBody", '<tr><td colspan="7" style="color:var(--text-muted)">No users found.</td></tr>');
    } else {
      setHtml("admUsersBody", page.map(function (u) {
        var rc = state.runCounts[u.uid];
        var checked = state.bulk.indexOf(u.uid) !== -1 ? " checked" : "";
        var suspBadge = suspensionActive(u)
          ? ' <span class="badge badge-amber" title="' + esc(u.suspendReason || "Suspended") + '">🚫 Suspended</span>'
          : "";
        return "<tr>" +
          '<td><input type="checkbox" data-bulk-uid="' + esc(u.uid) + '"' + checked +
          ' aria-label="Select ' + esc(u.email || u.name || "user") + '" style="width:1.05rem;height:1.05rem"></td>' +
          "<td><strong>" + esc(u.name || "(no name)") + "</strong>" + suspBadge + "</td>" +
          "<td>" + esc(u.email || "—") + "</td>" +
          "<td>" + esc(u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—") + "</td>" +
          '<td><span class="badge">' + fmtNum(u.coins) + " 🪙</span></td>" +
          "<td>" + (rc == null ? "…" : fmtNum(rc)) + "</td>" +
          '<td><button class="btn btn-sm" data-view-user="' + esc(u.uid) + '">View</button></td>' +
          "</tr>";
      }).join(""));
    }
    updateBulkBar();

    setHtml("admUsersInfo",
      "Showing " + (list.length ? start + 1 : 0) + "–" + Math.min(start + PAGE_SIZE, list.length) +
      " of " + fmtNum(list.length) + " users");
    var prev = $("admUsersPrev"), next = $("admUsersNext");
    if (prev) prev.disabled = state.userPage <= 0;
    if (next) next.disabled = state.userPage >= pages - 1;

    // Lazy-load run counts for this page (cached).
    var d = db();
    page.forEach(function (u) {
      if (state.runCounts[u.uid] != null || !d) return;
      d.collection("users").doc(u.uid).collection("tool_runs").get()
        .then(function (s) { state.runCounts[u.uid] = s.size; renderUsers(); })
        .catch(function () { state.runCounts[u.uid] = 0; renderUsers(); });
    });
  }

  function openUserDetail(uid) {
    var u = null;
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].uid === uid) { u = state.users[i]; break; }
    }
    if (!u) return;
    state.detailUid = uid;
    logAudit("user_view", uid, (u.email || u.name || uid));

    var d = db();
    setHtml("admUserDetail", '<div class="card">' + SPINNER + "</div>");
    $("admUserDetail").style.display = "";

    var pRuns = d ? d.collection("users").doc(uid).collection("tool_runs")
      .orderBy("ts", "desc").limit(20).get().catch(function () { return null; })
      : Promise.resolve(null);

    pRuns.then(function (rSnap) {
      var runsHtml;
      if (!rSnap || rSnap.empty) {
        runsHtml = '<p style="color:var(--text-muted)">No tool activity recorded.</p>';
      } else {
        var items = [];
        rSnap.forEach(function (doc) {
          var r = doc.data() || {};
          var ts = toMillis(r.ts) || toMillis(r.createdAt);
          items.push({ tool: r.tool || "?", action: r.action || "", ts: ts });
        });
        items.sort(function (a, b) { return b.ts - a.ts; });
        runsHtml = '<ul class="adm-feed">' + items.map(function (r) {
          return '<li><span class="adm-feed-dot" aria-hidden="true"></span><div><strong>' +
            esc(r.tool) + "</strong>" + (r.action ? " — " + esc(String(r.action).slice(0, 80)) : "") +
            '<div class="adm-muted">' + esc(relTime(r.ts)) + "</div></div></li>";
        }).join("") + "</ul>";
      }

      var suspOn = suspensionActive(u);
      var suspSection;
      if (suspOn) {
        suspSection =
          '<div class="adm-err" style="margin:var(--sp-3) 0"><strong>🚫 Suspended</strong>' +
          (u.suspendReason ? " — " + esc(u.suspendReason) : "") +
          (u.suspendUntil ? "<br><span class='adm-muted'>Until: " + esc(fmtDate(u.suspendUntil)) + "</span>"
                          : "<br><span class='adm-muted'>Permanent</span>") +
          '<div style="margin-top:.5rem"><button class="btn btn-sm btn-primary" id="admUnsuspendBtn">Lift suspension</button></div></div>';
      } else {
        suspSection =
          '<div style="margin:var(--sp-3) 0;padding:.7rem .9rem;border:1px solid var(--border,#e5e7eb);border-radius:.5rem">' +
          "<h4 style='margin-top:0'>🚫 Suspend user</h4>" +
          '<div class="adm-row">' +
          '<input id="admSuspendReason" class="text-input" type="text" maxlength="200" placeholder="Reason (shown in logs)…" style="flex:2;min-width:180px" aria-label="Suspension reason">' +
          '<select id="admSuspendDays" class="text-input" aria-label="Suspension length">' +
          '<option value="1">24 hours</option><option value="7" selected>7 days</option>' +
          '<option value="30">30 days</option><option value="0">Permanent</option></select>' +
          '<button class="btn btn-sm" id="admSuspendBtn" style="border-color:var(--danger,#C93A3A);color:var(--danger,#C93A3A)">Suspend</button>' +
          "</div></div>";
      }

      setHtml("admUserDetail",
        '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:start;gap:1rem;flex-wrap:wrap">' +
        "<div><h3 style='margin-top:0'>" + esc(u.name || "(no name)") + "</h3>" +
        "<p class='adm-muted'>" + esc(u.email || "—") + "<br>" +
        "Joined: " + esc(fmtDate(u.createdAt)) + "<br>" +
        "Last login: " + esc(fmtDate(u.lastLogin)) + "<br>" +
        "UID: <code>" + esc(u.uid) + "</code></p></div>" +
        '<button class="btn btn-sm" id="admDetailClose">Close ✕</button>' +
        "</div>" +
        '<p><span class="badge" style="font-size:1rem">' + fmtNum(u.coins) + " 🪙 coins</span></p>" +
        '<div class="adm-row">' +
        '<input id="admCoinAmt" class="text-input" type="number" min="1" value="10" style="max-width:120px" aria-label="Coins amount">' +
        '<button class="btn btn-sm btn-primary" id="admCoinAdd">Add coins</button>' +
        '<button class="btn btn-sm" id="admCoinReset" style="border-color:var(--danger);color:var(--danger)">Reset to 0</button>' +
        "</div>" +
        suspSection +
        '<div id="admNotesWrap"></div>' +
        "<h4>Journey history</h4>" + runsHtml +
        "</div>");
      // Internal admin notes (#3) — rendered by js/pages/admin-plus.js if loaded.
      try {
        var nw = $("admNotesWrap");
        if (nw && window.DKNotes && typeof window.DKNotes.render === "function") {
          window.DKNotes.render(uid, nw);
        }
      } catch (e) { /* notes optional */ }

      $("admDetailClose").addEventListener("click", function () {
        $("admUserDetail").style.display = "none";
        state.detailUid = null;
      });
      $("admCoinAdd").addEventListener("click", function () {
        var amt = parseInt(($("admCoinAmt") || {}).value, 10);
        if (!amt || amt <= 0) { alert("Enter a positive number of coins."); return; }
        adjustCoins(u, amt);
      });
      $("admCoinReset").addEventListener("click", function () {
        if (!confirm("Reset " + (u.email || u.name || "this user") + "'s coins to 0?")) return;
        setCoins(u, 0);
      });
      var suspBtn = $("admSuspendBtn");
      if (suspBtn) suspBtn.addEventListener("click", function () {
        var reason = (($("admSuspendReason") || {}).value || "").trim();
        var days = parseInt(($("admSuspendDays") || {}).value, 10);
        if (!reason) { alert("Please enter a suspension reason."); return; }
        if (!confirm("Suspend " + (u.email || u.name || "this user") + (days > 0 ? " for " + days + " day(s)?" : " permanently?"))) return;
        suspendUser(u, reason, days);
      });
      var unsuspBtn = $("admUnsuspendBtn");
      if (unsuspBtn) unsuspBtn.addEventListener("click", function () {
        if (!confirm("Lift the suspension for " + (u.email || u.name || "this user") + "?")) return;
        unsuspendUser(u);
      });
      var detail = $("admUserDetail");
      if (detail && detail.scrollIntoView) detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function adjustCoins(u, amt) {
    var d = db(), F = fv();
    if (!d || !F) return;
    d.collection("users").doc(u.uid).update({ coins: F.increment(amt) })
      .then(function () {
        u.coins += amt;
        renderUsers();
        logAudit("coins_add", u.uid, "+" + amt + " coins (" + (u.email || u.name) + ")");
        openUserDetail(u.uid); // refresh
      })
      .catch(function (err) { alert("Could not update coins: " + friendlyDbErr(err)); });
  }

  function setCoins(u, val) {
    var d = db();
    if (!d) return;
    d.collection("users").doc(u.uid).update({ coins: val })
      .then(function () {
        u.coins = val;
        renderUsers();
        logAudit("coins_reset", u.uid, "set to 0 (" + (u.email || u.name) + ")");
        openUserDetail(u.uid);
      })
      .catch(function (err) { alert("Could not reset coins: " + friendlyDbErr(err)); });
  }

  /* ================= 2b. BAN / SUSPEND (#8) =================
   * users/{uid}: { suspended: bool, suspendReason: string, suspendUntil: ms|0 }
   * suspendUntil = 0 (or absent) means permanent. Expiry is enforced by
   * checking suspensionActive() wherever access is gated. */

  function suspendUser(u, reason, days) {
    var d = db();
    if (!d) return;
    var until = days > 0 ? Date.now() + days * 864e5 : 0;
    d.collection("users").doc(u.uid).update({
      suspended: true,
      suspendReason: String(reason).slice(0, 200),
      suspendUntil: until
    }).then(function () {
      u.suspended = true;
      u.suspendReason = reason;
      u.suspendUntil = until;
      renderUsers();
      logAudit("user_suspended", u.uid,
        "reason:" + reason + " days:" + days + " (" + (u.email || u.name) + ")");
      openUserDetail(u.uid); // refresh panel
    }).catch(function (err) { alert("Could not suspend user: " + friendlyDbErr(err)); });
  }

  function unsuspendUser(u) {
    var d = db();
    if (!d) return;
    d.collection("users").doc(u.uid).update({
      suspended: false,
      suspendReason: "",
      suspendUntil: 0
    }).then(function () {
      u.suspended = false;
      u.suspendReason = "";
      u.suspendUntil = 0;
      renderUsers();
      logAudit("user_unsuspended", u.uid, (u.email || u.name || ""));
      openUserDetail(u.uid); // refresh panel
    }).catch(function (err) { alert("Could not lift suspension: " + friendlyDbErr(err)); });
  }

  /* ================= 2c. BULK USER ACTIONS (#9) ================= */

  function updateBulkBar() {
    var bar = $("admBulkBar");
    if (!bar) return;
    var n = state.bulk.length;
    bar.style.display = n ? "" : "none";
    var count = $("admBulkCount");
    if (count) count.textContent = n + " selected";
    var all = $("admBulkAll");
    if (all) {
      // Reflect page-level selection state (checked only if every row on page is selected).
      var boxes = document.querySelectorAll('#admUsersBody [data-bulk-uid]');
      var sel = 0;
      for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) sel++;
      all.checked = boxes.length > 0 && sel === boxes.length;
    }
  }

  function toggleBulk(uid, on) {
    var i = state.bulk.indexOf(uid);
    if (on && i === -1) state.bulk.push(uid);
    if (!on && i !== -1) state.bulk.splice(i, 1);
    updateBulkBar();
  }

  function bulkGiveCoins() {
    var d = db(), F = fv();
    if (!d || !F) return;
    var amt = parseInt(($("admBulkCoinsAmt") || {}).value, 10);
    if (!amt || amt <= 0) { alert("Enter a positive number of coins."); return; }
    var uids = state.bulk.slice();
    if (!uids.length) return;
    if (!confirm("Give " + amt + " coins to " + uids.length + " user(s)?")) return;
    var batch = d.batch();
    uids.forEach(function (uid) {
      batch.update(d.collection("users").doc(uid), { coins: F.increment(amt) });
    });
    batch.commit().then(function () {
      // Optimistic local update.
      state.users.forEach(function (u) {
        if (uids.indexOf(u.uid) !== -1) u.coins += amt;
      });
      logAudit("bulk_coins_add", uids.length + " users", "+" + amt + " coins each");
      state.bulk = [];
      renderUsers();
      alert("Done — " + amt + " coins given to " + uids.length + " user(s).");
    }).catch(function (err) { alert("Bulk coin grant failed: " + friendlyDbErr(err)); });
  }

  function bulkSuspend() {
    var d = db();
    if (!d) return;
    var uids = state.bulk.slice();
    if (!uids.length) return;
    var reason = window.prompt("Suspension reason for " + uids.length + " user(s):", "Bulk suspension");
    if (reason === null || !reason.trim()) return;
    reason = reason.trim().slice(0, 200);
    var daysStr = window.prompt("Suspend for how many days? (0 = permanent)", "7");
    if (daysStr === null) return;
    var days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 0) { alert("Invalid number of days."); return; }
    if (!confirm("Suspend " + uids.length + " user(s)" + (days > 0 ? " for " + days + " day(s)?" : " permanently?"))) return;
    var until = days > 0 ? Date.now() + days * 864e5 : 0;
    var batch = d.batch();
    uids.forEach(function (uid) {
      batch.update(d.collection("users").doc(uid), {
        suspended: true, suspendReason: reason, suspendUntil: until
      });
    });
    batch.commit().then(function () {
      state.users.forEach(function (u) {
        if (uids.indexOf(u.uid) !== -1) {
          u.suspended = true; u.suspendReason = reason; u.suspendUntil = until;
        }
      });
      logAudit("bulk_suspend", uids.length + " users", "reason:" + reason + " days:" + days);
      state.bulk = [];
      renderUsers();
      alert("Done — " + uids.length + " user(s) suspended.");
    }).catch(function (err) { alert("Bulk suspend failed: " + friendlyDbErr(err)); });
  }

  function bulkExport() {
    var uids = state.bulk.slice();
    if (!uids.length) return;
    var rows = [["uid", "name", "email", "coins", "joined", "suspended"]];
    state.users.forEach(function (u) {
      if (uids.indexOf(u.uid) === -1) return;
      rows.push([
        u.uid, u.name || "", u.email || "", String(u.coins),
        u.createdAt ? new Date(u.createdAt).toISOString() : "",
        suspensionActive(u) ? "yes" : "no"
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dokit-users-export.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    logAudit("bulk_export", uids.length + " users", "CSV download");
  }

  function wireBulk() {
    var all = $("admBulkAll");
    if (all && !all.dataset.wired) {
      all.dataset.wired = "1";
      all.addEventListener("change", function () {
        var boxes = document.querySelectorAll('#admUsersBody [data-bulk-uid]');
        for (var i = 0; i < boxes.length; i++) {
          boxes[i].checked = all.checked;
          toggleBulk(boxes[i].getAttribute("data-bulk-uid"), all.checked);
        }
      });
    }
    // Row checkboxes (delegated — rows re-render on paging/search).
    document.addEventListener("click", function (ev) {
      var box = ev.target.closest ? ev.target.closest("[data-bulk-uid]") : null;
      if (box) toggleBulk(box.getAttribute("data-bulk-uid"), box.checked);
    });
    function once(id, fn) {
      var el = $(id);
      if (el && !el.dataset.wired) { el.dataset.wired = "1"; el.addEventListener("click", fn); }
    }
    once("admBulkGive", bulkGiveCoins);
    once("admBulkSuspend", bulkSuspend);
    once("admBulkExport", bulkExport);
    once("admBulkClear", function () { state.bulk = []; renderUsers(); });
  }

  function wireUsers() {
    var search = $("admUserSearch");
    if (search) search.addEventListener("input", function () {
      state.userQuery = search.value;
      state.userPage = 0;
      renderUsers();
    });
    var prev = $("admUsersPrev"), next = $("admUsersNext");
    if (prev) prev.addEventListener("click", function () {
      if (state.userPage > 0) { state.userPage--; renderUsers(); }
    });
    if (next) next.addEventListener("click", function () { state.userPage++; renderUsers(); });

    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-view-user]");
      if (btn) openUserDetail(btn.getAttribute("data-view-user"));
    });
  }

  /* ================= 3. CONTENT ================= */

  function loadContent() {
    var d = db();
    // Tools with enable/disable toggles.
    var wrap = $("admTools");
    if (!wrap) return;
    wrap.innerHTML = SPINNER;

    function render(enabled) {
      wrap.innerHTML = state.tools.map(function (t) {
        var on = enabled[t.id] !== false; // default enabled
        return '<div class="adm-toolrow">' +
          '<div><strong>' + esc(t.name) + "</strong><br>" +
          '<a class="adm-muted" href="' + esc(t.href) + '">Open →</a></div>' +
          '<label class="adm-switch"><input type="checkbox" data-tool-toggle="' + esc(t.id) + '"' +
          (on ? " checked" : "") + '><span class="adm-slider"></span>' +
          '<span class="sr-note">' + esc(t.name) + " enabled</span></label>" +
          "</div>";
      }).join("") +
      '<p class="adm-muted">Toggles are stored in Firestore (<code>config/tools</code>). ' +
      "Turning a tool off hides it from listings once the site reads this config.</p>";
    }

    if (d) {
      d.collection("config").doc("tools").get().then(function (snap) {
        var data = (snap.exists && snap.data()) || {};
        render(data.enabled || {});
      }).catch(function () { render({}); });
    } else { render({}); }

    wrap.addEventListener("change", function (ev) {
      var input = ev.target.closest("[data-tool-toggle]");
      if (!input || !d) return;
      var id = input.getAttribute("data-tool-toggle");
      var on = input.checked;
      var F = fv();
      d.collection("config").doc("tools").set(
        { enabled: (function (o) { o[id] = on; return o; })({}), updatedAt: F ? F.serverTimestamp() : new Date(), updatedBy: state.admin.email || state.admin.uid },
        { merge: true }
      ).then(function () {
        logAudit("tool_toggle", id, "enabled=" + on);
      }).catch(function (err) {
        input.checked = !on;
        alert("Could not save: " + friendlyDbErr(err));
      });
    });

    // Guides + blog (static lists with links).
    setHtml("admGuides", "<ul>" + state.guides.map(function (g) {
      return '<li><a href="' + esc(g.href) + '">' + esc(g.name) + "</a></li>";
    }).join("") + "</ul>");
    setHtml("admBlog", "<ul>" + state.posts.map(function (p) {
      return '<li><a href="' + esc(p.href) + '">' + esc(p.name) + "</a></li>";
    }).join("") + "</ul>");
  }

  /* ================= 4. AUDIT LOG ================= */

  function loadAudit() {
    var d = db();
    var body = $("admAuditBody");
    if (!body) return;
    if (!d) {
      body.innerHTML = '<tr><td colspan="5">' + errHtml("Database unavailable.") + "</td></tr>";
      return;
    }
    body.innerHTML = '<tr><td colspan="5">' + SPINNER + "</td></tr>";
    d.collection("admin_audit").orderBy("timestamp", "desc").limit(50).get()
      .then(function (snap) {
        if (snap.empty) {
          body.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted)">No admin actions logged yet.</td></tr>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var a = doc.data() || {};
          rows.push("<tr>" +
            "<td>" + esc(relTime(toMillis(a.timestamp))) + "</td>" +
            "<td>" + esc(a.adminEmail || a.adminUid || "—") + "</td>" +
            "<td><span class='badge'>" + esc(a.action || "—") + "</span></td>" +
            "<td><code>" + esc(String(a.target || "—").slice(0, 40)) + "</code></td>" +
            "<td>" + esc(String(a.details || "—").slice(0, 120)) + "</td>" +
            "</tr>");
        });
        body.innerHTML = rows.join("");
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="5">' + errHtml("Could not load audit log. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  /* ================= 5. SECURITY EVENTS =================
   * Reads the append-only `security_events` log (written by FinSec.auditLog
   * on every financial action). Flagged rows (result contains "flagged",
   * "rate_limited", or "rejected") are highlighted for admin review.
   * This is the fraud-monitoring surface until server-side alerting ships.
   */
  function loadSecurityEvents() {
    var d = db();
    var body = $("admSecBody");
    if (!body) return;
    if (!d) {
      body.innerHTML = '<tr><td colspan="6">' + errHtml("Database unavailable.") + "</td></tr>";
      return;
    }
    body.innerHTML = '<tr><td colspan="6">' + SPINNER + "</td></tr>";
    d.collection("security_events").orderBy("ts", "desc").limit(50).get()
      .then(function (snap) {
        if (snap.empty) {
          body.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted)">No security events yet. Financial actions will appear here.</td></tr>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var e = doc.data() || {};
          var result = String(e.result || "—");
          var flagged = /flagged|rate_limited|rejected|failed/i.test(result);
          var badge = flagged
            ? "<span class='badge badge-amber'>" + esc(result.slice(0, 40)) + "</span>"
            : "<span class='badge'>" + esc(result.slice(0, 40)) + "</span>";
          rows.push("<tr" + (flagged ? " style='background:rgba(201,58,58,.06)'" : "") + ">" +
            "<td>" + esc(relTime(toMillis(e.serverTs) || e.ts)) + "</td>" +
            "<td><code>" + esc(String(e.action || "—").slice(0, 40)) + "</code></td>" +
            "<td><code>" + esc(String(e.uid || "anon").slice(0, 18)) + "</code></td>" +
            "<td>" + (e.amount == null ? "—" : esc(String(e.amount))) + "</td>" +
            "<td>" + badge + "</td>" +
            "<td><code>" + esc(String(e.deviceId || "—").slice(0, 18)) + "</code></td>" +
            "</tr>");
        });
        body.innerHTML = rows.join("");
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="6">' + errHtml("Could not load security events. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  /* ================= 6. DEPOSITS (manual verification) ================= */

  /**
   * Load pending deposits for admin review.
   * Each row shows user info, amount, method, txn ID, sender, and screenshot.
   * Admin can Approve (credits coins 1:1 via atomic transaction) or Reject.
   */
  function loadDeposits() {
    var d = db();
    var body = $("admDepBody");
    if (!body) return;
    if (!d) { body.innerHTML = '<tr><td colspan="8">' + errHtml("Database unavailable.") + "</td></tr>"; return; }

    body.innerHTML = '<tr><td colspan="8"><span class="adm-spin" aria-hidden="true"></span></td></tr>';

    d.collection("deposits").where("status", "==", "pending")
      .orderBy("createdAtMs", "desc").limit(50).get()
      .then(function (snap) {
        var countEl = $("admDepCount");
        if (countEl) countEl.textContent = "(" + snap.size + " pending)";

        if (snap.empty) {
          body.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted)">No pending deposits. 🎉</td></tr>';
          return;
        }

        // Resolve user names for display
        var rows = [];
        var promises = [];
        snap.forEach(function (doc) {
          var dep = Object.assign({ id: doc.id }, doc.data());
          promises.push(
            d.collection("users").doc(dep.userId).get().then(function (uSnap) {
              var uname = "Unknown";
              var uemail = "";
              if (uSnap.exists) {
                var ud = uSnap.data() || {};
                uname = ud.displayName || ud.name || "User";
                uemail = ud.email || "";
              }
              rows.push({ dep: dep, uname: uname, uemail: uemail });
            }).catch(function () {
              rows.push({ dep: dep, uname: "Unknown", uemail: "" });
            })
          );
        });

        Promise.all(promises).then(function () {
          // Sort by createdAtMs desc (already ordered, but ensure after async)
          rows.sort(function (a, b) { return (b.dep.createdAtMs || 0) - (a.dep.createdAtMs || 0); });
          body.innerHTML = rows.map(function (r) {
            var dep = r.dep;
            var shotBtn = dep.screenshot
              ? '<button class="btn btn-sm" type="button" data-shot="' + dep.id + '">🖼️ View</button>'
              : '<span style="color:var(--text-muted)">—</span>';
            return "<tr>" +
              "<td>" + fmtTime(dep.createdAtMs) + "</td>" +
              "<td>" + esc(r.uname) + "<br><small style='color:var(--text-muted)'>" + esc(r.uemail) + "</small></td>" +
              "<td><strong>Rs " + esc(dep.amount) + "</strong></td>" +
              "<td>" + esc(dep.method) + "</td>" +
              "<td><code>" + esc(dep.txnId) + "</code></td>" +
              "<td><code>" + esc(dep.sender) + "</code></td>" +
              "<td>" + shotBtn + "</td>" +
              "<td style='white-space:nowrap'>" +
              '<button class="btn btn-sm btn-primary" type="button" data-approve-dep="' + esc(dep.id) + '" data-amt="' + esc(dep.amount) + '" data-uid="' + esc(dep.userId) + '">✅ Approve</button> ' +
              '<button class="btn btn-sm" type="button" data-reject-dep="' + esc(dep.id) + '">❌ Reject</button> ' +
              '<button class="btn btn-sm" type="button" data-receipt-dep="' + esc(dep.id) + '">🧾 Receipt</button>' +
              "</td></tr>";
          }).join("");

          // Store screenshots for the view buttons
          rows.forEach(function (r) {
            if (r.dep.screenshot) {
              var btn = body.querySelector('[data-shot="' + r.dep.id + '"]');
              if (btn) btn._shotData = r.dep.screenshot;
            }
          });
        });
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="8">' + errHtml("Could not load deposits. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  /**
   * Approve a deposit: atomically credit coins 1:1 + hash-chained ledger entry
   * + mark deposit as approved. Uses a Firestore transaction (all-or-nothing).
   */
  function approveDeposit(depId, amount, userId) {
    var d = db();
    if (!d) return;
    /* Defense in depth: the amount arrives via DOM data attributes — coerce
     * and validate here so a tampered value can never corrupt the ledger
     * (string concatenation) or mint a bad balance. */
    amount = Math.floor(Number(amount)) || 0;
    if (amount <= 0 || !userId || typeof userId !== "string") {
      alert("Invalid deposit data. Aborted.");
      return;
    }
    if (!window.confirm("Approve deposit of Rs " + amount + "?\n\nThis will credit " + amount + " coins to the user.")) return;

    var adminUid = currentAdminUid();
    var depRef = d.collection("deposits").doc(depId);
    var userRef = d.collection("users").doc(userId);
    var ledgerCol = userRef.collection("coin_ledger");
    var ledgerRef = ledgerCol.doc();

    /* Ledger schema MUST match js/typefight.js ledgerAppend/ledgerVerify:
     * { amount, reason, clientTs, ts, prevHash, hash }
     * hash = sha256(prevHash|uid|amount|reason|clientTs)
     * We read the last entry for prevHash, compute the hash, THEN transact.
     */
    function sha256hex(str) {
      var bytes = new TextEncoder().encode(str);
      return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
        var arr = new Uint8Array(buf), hex = "";
        for (var i = 0; i < arr.length; i++) hex += ("0" + arr[i].toString(16)).slice(-2);
        return hex;
      });
    }

    ledgerCol.orderBy("clientTs", "desc").limit(1).get().then(function (snap) {
      var prevHash = "GENESIS";
      snap.forEach(function (doc) { prevHash = doc.data().hash || "GENESIS"; });
      var clientTs = Date.now();
      var reason = "deposit:" + depId;
      var payload = prevHash + "|" + userId + "|" + amount + "|" + reason + "|" + clientTs;
      return sha256hex(payload).then(function (entryHash) {
        return d.runTransaction(function (tx) {
          return tx.get(depRef).then(function (depSnap) {
            if (!depSnap.exists) throw new Error("Deposit not found.");
            var depData = depSnap.data();
            if (depData.status !== "pending") throw new Error("Deposit is no longer pending.");

            return tx.get(userRef).then(function (userSnap) {
              var udata = userSnap.exists ? userSnap.data() : {};
              var curCoins = Number(udata.coins) || 0;
              var newCoins = curCoins + amount;

              // Atomic: update balance + ledger + deposit status
              tx.update(userRef, { coins: newCoins });
              tx.set(ledgerRef, {
                amount: amount,
                reason: reason,
                clientTs: clientTs,
                ts: firebase.firestore.FieldValue.serverTimestamp(),
                prevHash: prevHash,
                hash: entryHash
              });
              tx.update(depRef, {
                status: "approved",
                reviewedBy: adminUid,
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
                reviewedAtMs: Date.now()
              });
            });
          });
        });
      });
    }).then(function () {
      logAudit("deposit_approved", depId, "user:" + userId + " amount:" + amount);
      loadDeposits();
      loadDashboard();
    }).catch(function (err) {
      alert("Failed to approve: " + (err.message || "Unknown error"));
    });
  }

  /**
   * Reject a deposit with a reason. No coins are credited.
   */
  function rejectDeposit(depId) {
    var d = db();
    if (!d) return;
    var reason = window.prompt("Rejection reason (shown to user):", "Transaction not found");
    if (reason === null) return; // cancelled

    /* Transactional: only reject if still pending (prevents clobbering an approval). */
    var depRef = d.collection("deposits").doc(depId);
    d.runTransaction(function (tx) {
      return tx.get(depRef).then(function (snap) {
        if (!snap.exists) throw new Error("Deposit not found.");
        if (snap.data().status !== "pending") throw new Error("Deposit is no longer pending.");
        tx.update(depRef, {
          status: "rejected",
          rejectReason: String(reason).slice(0, 200),
          reviewedBy: currentAdminUid(),
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
          reviewedAtMs: Date.now()
        });
      });
    }).then(function () {
      logAudit("deposit_rejected", depId, "reason:" + reason);
      loadDeposits();
    }).catch(function (err) {
      alert("Failed to reject: " + (err.message || "Unknown error"));
    });
  }

  /* ================= 7. WITHDRAWALS (manual processing) ================= */

  /**
   * Load pending withdrawals for admin review.
   * Admin sends money manually, then marks as processed.
   * Rejecting refunds the locked coins back to available balance.
   */
  function loadWithdrawals() {
    var d = db();
    var body = $("admWdBody");
    if (!body) return;
    if (!d) { body.innerHTML = '<tr><td colspan="6">' + errHtml("Database unavailable.") + "</td></tr>"; return; }

    body.innerHTML = '<tr><td colspan="6"><span class="adm-spin" aria-hidden="true"></span></td></tr>';

    d.collection("withdrawals").where("status", "==", "pending")
      .orderBy("createdAtMs", "desc").limit(50).get()
      .then(function (snap) {
        var countEl = $("admWdCount");
        if (countEl) countEl.textContent = "(" + snap.size + " pending)";

        if (snap.empty) {
          body.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted)">No pending withdrawals. 🎉</td></tr>';
          return;
        }

        var rows = [];
        var promises = [];
        snap.forEach(function (doc) {
          var wd = Object.assign({ id: doc.id }, doc.data());
          promises.push(
            d.collection("users").doc(wd.userId).get().then(function (uSnap) {
              var uname = "Unknown", uemail = "";
              if (uSnap.exists) {
                var ud = uSnap.data() || {};
                uname = ud.displayName || ud.name || "User";
                uemail = ud.email || "";
              }
              rows.push({ wd: wd, uname: uname, uemail: uemail });
            }).catch(function () {
              rows.push({ wd: wd, uname: "Unknown", uemail: "" });
            })
          );
        });

        Promise.all(promises).then(function () {
          rows.sort(function (a, b) { return (b.wd.createdAtMs || 0) - (a.wd.createdAtMs || 0); });
          body.innerHTML = rows.map(function (r) {
            var wd = r.wd;
            var appr = Array.isArray(wd.approvals) ? wd.approvals : [];
            var apprBadge = appr.length
              ? ' <span class="badge badge-amber" title="Approvals">' + appr.length + "/2</span>"
              : "";
            return "<tr>" +
              "<td>" + fmtTime(wd.createdAtMs) + "</td>" +
              "<td>" + esc(r.uname) + "<br><small style='color:var(--text-muted)'>" + esc(r.uemail) + "</small></td>" +
              "<td><strong>Rs " + esc(wd.amount) + "</strong></td>" +
              "<td>" + esc(wd.method) + "</td>" +
              "<td><code>" + esc(wd.account) + "</code></td>" +
              "<td style='white-space:nowrap'>" +
              '<button class="btn btn-sm btn-primary" type="button" data-approve-wd="' + esc(wd.id) + '" data-amt="' + esc(wd.amount) + '">✅ Approve' + apprBadge + "</button> " +
              '<button class="btn btn-sm" type="button" data-reject-wd="' + esc(wd.id) + '" data-uid="' + esc(wd.userId) + '" data-amt="' + esc(wd.amount) + '">❌ Reject</button>' +
              "</td></tr>";
          }).join("");
        });
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="6">' + errHtml("Could not load withdrawals. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  /**
   * Maker-checker approval for withdrawals (#12): TWO different admins must
   * approve before money moves. First approval records approvals[] only;
   * the second approval settles (money movement + status processed).
   * The same admin can never approve twice (enforced in the transaction).
   */
  function approveWithdrawal(wdId, amount) {
    var d = db();
    if (!d) return;
    var me = currentAdminUid();
    if (!window.confirm(
      "Approve withdrawal of Rs " + amount + "?\n\n" +
      "Maker-checker: a SECOND admin must also approve before it is processed.\n" +
      "Only approve AFTER you have manually sent the money to the user's account."
    )) return;

    var wdRef = d.collection("withdrawals").doc(wdId);

    d.runTransaction(function (tx) {
      return tx.get(wdRef).then(function (snap) {
        if (!snap.exists) throw new Error("Withdrawal not found.");
        var wdData = snap.data();
        if (wdData.status !== "pending") throw new Error("Withdrawal is no longer pending.");
        var approvals = Array.isArray(wdData.approvals) ? wdData.approvals.slice() : [];
        if (approvals.some(function (a) { return a && a.by === me; })) {
          throw new Error("You already approved this — a second admin must confirm.");
        }
        approvals.push({ by: me, at: Date.now() });

        if (approvals.length < 2) {
          // First approval: record only, stays pending.
          tx.update(wdRef, { approvals: approvals });
          return { settled: false, count: approvals.length };
        }

        // Second approval: settle the money movement.
        var wdAmount = Number(wdData.amount) || 0;
        var wdUserId = wdData.userId;
        return tx.get(d.collection("users").doc(wdUserId)).then(function (userSnap) {
          var udata = userSnap.exists ? userSnap.data() : {};
          var coins = Number(udata.coins) || 0;
          var pendingWd = Number(udata.pending_withdrawal) || 0;

          /* Settle: remove from BOTH coins and pending_withdrawal.
           * The coins were locked at request time; now they leave the system. */
          tx.update(d.collection("users").doc(wdUserId), {
            coins: Math.max(0, coins - wdAmount),
            pending_withdrawal: Math.max(0, pendingWd - wdAmount)
          });
          tx.update(wdRef, {
            status: "processed",
            approvals: approvals,
            processedBy: me,
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedAtMs: Date.now()
          });
          return { settled: true, count: approvals.length };
        });
      });
    }).then(function (res) {
      if (res && res.settled) {
        logAudit("withdrawal_processed", wdId, "amount:" + amount + " (2/2 approvals)");
      } else {
        logAudit("withdrawal_approved_1of2", wdId, "amount:" + amount + " by " + me);
      }
      loadWithdrawals();
    }).catch(function (err) {
      alert("Failed: " + (err.message || "Unknown error"));
    });
  }

  /**
   * Reject a withdrawal: refund the locked coins back to available balance.
   * Atomically decrements pending_withdrawal (coins become available again).
   */
  function rejectWithdrawal(wdId, userId, amount) {
    var d = db();
    if (!d) return;
    var reason = window.prompt("Rejection reason (shown to user):", "Invalid account details");
    if (reason === null) return;

    var wdRef = d.collection("withdrawals").doc(wdId);
    var userRef = d.collection("users").doc(userId);
    amount = Number(amount) || 0;

    d.runTransaction(function (tx) {
      return tx.get(wdRef).then(function (wdSnap) {
        if (!wdSnap.exists) throw new Error("Withdrawal not found.");
        if (wdSnap.data().status !== "pending") throw new Error("Withdrawal is no longer pending.");

        return tx.get(userRef).then(function (userSnap) {
          var udata = userSnap.exists ? userSnap.data() : {};
          var pending = Number(udata.pending_withdrawal) || 0;

          // Refund: reduce the locked amount (coins become available again)
          tx.update(userRef, {
            pending_withdrawal: Math.max(0, pending - amount)
          });
          tx.update(wdRef, {
            status: "rejected",
            rejectReason: String(reason).slice(0, 200),
            processedBy: currentAdminUid(),
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedAtMs: Date.now()
          });
        });
      });
    }).then(function () {
      logAudit("withdrawal_rejected", wdId, "user:" + userId + " amount:" + amount + " reason:" + reason);
      loadWithdrawals();
    }).catch(function (err) {
      alert("Failed: " + (err.message || "Unknown error"));
    });
  }

  /* ================= 8. PAYMENT SETTINGS ================= */

  /**
   * Load current payment accounts into the admin form.
   */
  function loadPaySettings() {
    var d = db();
    if (!d) return;
    d.collection("config").doc("payments").get().then(function (snap) {
      var c = snap.exists ? snap.data() : {};
      var e1 = $("admPayEasypaisa"), e2 = $("admPayJazzcash"), e3 = $("admPayUsdt");
      if (e1) e1.value = c.easypaisa_number || "";
      if (e2) e2.value = c.jazzcash_number || "";
      if (e3) e3.value = c.usdt_address || "";
    }).catch(function () {});
  }

  /**
   * Save payment accounts. Validates non-empty before writing.
   */
  function wirePaySettings() {
    var form = $("admPayForm");
    if (!form || form.dataset.wired) return;
    form.dataset.wired = "1";
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = db();
      if (!d) return;
      var msg = $("admPayMsg");

      var ep = ($("admPayEasypaisa").value || "").trim();
      var jc = ($("admPayJazzcash").value || "").trim();
      var usdt = ($("admPayUsdt").value || "").trim();

      if (!ep || !jc || !usdt) {
        if (msg) { msg.textContent = "All three accounts are required."; msg.style.display = ""; msg.style.color = "#C93A3A"; }
        return;
      }

      d.collection("config").doc("payments").set({
        easypaisa_number: ep,
        jazzcash_number: jc,
        usdt_address: usdt,
        updatedBy: currentAdminUid(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).then(function () {
        logAudit("payment_settings_updated", "config/payments", "settings saved");
        if (msg) { msg.textContent = "✅ Payment accounts saved."; msg.style.display = ""; msg.style.color = "#1F7A4D"; }
      }).catch(function (err) {
        if (msg) { msg.textContent = "Failed: " + (err.message || "Unknown"); msg.style.display = ""; msg.style.color = "#C93A3A"; }
      });
    });
  }

  /* ---- shared helpers for the payment tabs ---- */

  function currentAdminUid() {
    try {
      var a = (window.DKF && DKF.auth && DKF.auth()) || null;
      return (a && a.currentUser && a.currentUser.uid) || "unknown";
    } catch (e) { return "unknown"; }
  }

  function fmtTime(ms) {
    try { return new Date(Number(ms) || 0).toLocaleString(); } catch (e) { return "—"; }
  }

  /**
   * Wire click handlers for deposit/withdrawal action buttons (event delegation).
   */
  function wirePaymentActions() {
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-approve-dep],[data-reject-dep],[data-approve-wd],[data-reject-wd],[data-shot]");
      if (!t) return;

      if (t.hasAttribute("data-approve-dep")) {
        approveDeposit(t.getAttribute("data-approve-dep"),
          Number(t.getAttribute("data-amt")) || 0,
          t.getAttribute("data-uid"));
      } else if (t.hasAttribute("data-reject-dep")) {
        rejectDeposit(t.getAttribute("data-reject-dep"));
      } else if (t.hasAttribute("data-approve-wd")) {
        approveWithdrawal(t.getAttribute("data-approve-wd"),
          Number(t.getAttribute("data-amt")) || 0);
      } else if (t.hasAttribute("data-reject-wd")) {
        rejectWithdrawal(t.getAttribute("data-reject-wd"),
          t.getAttribute("data-uid"),
          Number(t.getAttribute("data-amt")) || 0);
      } else if (t.hasAttribute("data-shot") && t._shotData) {
        // Open screenshot in a new window (XSS-safe: validate data URL, use Image src property)
        var shotData = t._shotData;
        // Strict validation: must be a valid image data URL (prevents XSS via malformed src)
        if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+\/=]+$/.test(shotData)) {
          var w = window.open("", "_blank", "width=600,height=600");
          if (w) {
            var img = w.document.createElement("img");
            img.style.maxWidth = "100%";
            img.alt = "Deposit screenshot";
            // Assign via property (not string concatenation) - browser handles escaping
            img.src = shotData;
            w.document.body.appendChild(img);
          }
        }
      }
    });
  }

  function friendlyDbErr(err) {
    var code = (err && err.code) || "";
    if (code === "permission-denied") return "Permission denied — check Firestore security rules for admin reads.";
    if (code === "unavailable" || code === "failed-precondition") return "Firestore unavailable or needs an index (check console).";
    return (err && err.message) ? String(err.message).slice(0, 120) : "Unknown error.";
  }

  /* ================= 9. SITE SETTINGS (#16) =================
   * Reads/writes Firestore `site_settings/general`:
   * { siteName, tagline, contactEmail, footerNote,
   *   maintenanceMode, maintenanceMessage, updatedAt, updatedBy } */

  function loadSettings() {
    var d = db();
    if (!d) { showSettingsMsg("Database unavailable.", false); return; }
    d.collection("site_settings").doc("general").get().then(function (snap) {
      var c = snap.exists ? snap.data() : {};
      setVal("admSetSiteName", c.siteName || "DoKit");
      setVal("admSetTagline", c.tagline || "");
      setVal("admSetContactEmail", c.contactEmail || "");
      setVal("admSetFooterNote", c.footerNote || "");
      var mm = $("admSetMaintenance");
      if (mm) mm.checked = !!c.maintenanceMode;
      setVal("admSetMaintMsg", c.maintenanceMessage || "");
    }).catch(function (err) {
      showSettingsMsg("Could not load settings: " + friendlyDbErr(err), false);
    });
  }

  function setVal(id, v) { var el = $(id); if (el) el.value = v; }

  function showSettingsMsg(msg, ok) {
    var el = $("admSettingsMsg");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "";
    el.style.color = ok ? "#1F7A4D" : "#C93A3A";
  }

  function wireSettings() {
    var btn = $("admSettingsSave");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", function () {
      var d = db(), F = fv();
      if (!d) { showSettingsMsg("Database unavailable.", false); return; }
      var email = (($("admSetContactEmail") || {}).value || "").trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showSettingsMsg("Contact email looks invalid.", false);
        return;
      }
      var data = {
        siteName: (($("admSetSiteName") || {}).value || "").trim().slice(0, 60),
        tagline: (($("admSetTagline") || {}).value || "").trim().slice(0, 140),
        contactEmail: email,
        footerNote: (($("admSetFooterNote") || {}).value || "").trim().slice(0, 160),
        maintenanceMode: !!($("admSetMaintenance") || {}).checked,
        maintenanceMessage: (($("admSetMaintMsg") || {}).value || "").trim().slice(0, 200),
        updatedBy: currentAdminUid(),
        updatedAt: F ? F.serverTimestamp() : new Date()
      };
      d.collection("site_settings").doc("general").set(data, { merge: true })
        .then(function () {
          logAudit("settings_updated", "site_settings/general",
            "maintenanceMode=" + data.maintenanceMode);
          showSettingsMsg("✅ Settings saved.", true);
        })
        .catch(function (err) { showSettingsMsg("Save failed: " + friendlyDbErr(err), false); });
    });
  }

  /* ================= 10. FEATURE FLAGS (#17) =================
   * Reads/writes Firestore `site_settings/flags` as { flagId: bool }.
   * (Per-tool on/off toggles already live in the Content tab → config/tools.) */

  var FEATURE_FLAGS = [
    { id: "contact_form",    name: "Contact form",    desc: "Show the contact form on contact.html" },
    { id: "announcement_bar", name: "Announcement bar", desc: "Allow the announcement bar on public pages" },
    { id: "user_signup",     name: "User sign-up",    desc: "Allow new account registrations" },
    { id: "blog",            name: "Blog section",    desc: "Show the blog in navigation" },
    { id: "guides",          name: "Guides section",  desc: "Show guides in navigation" },
    { id: "typefight",       name: "TypeFight",       desc: "Show the TypeFight game section" }
  ];

  function loadFlags() {
    var d = db();
    var wrap = $("admFlags");
    if (!wrap) return;
    wrap.innerHTML = SPINNER;
    function renderFlagsList(flags) {
      wrap.innerHTML = FEATURE_FLAGS.map(function (f) {
        var on = flags[f.id] !== false; // default enabled
        var rollout = Number(flags[f.id + "__rollout"]);
        if (!(rollout >= 0)) rollout = 100;
        return '<div class="adm-toolrow" style="display:block">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">' +
          "<div><strong>" + esc(f.name) + "</strong><br>" +
          '<span class="adm-muted">' + esc(f.desc) + "</span></div>" +
          '<label class="adm-switch"><input type="checkbox" data-flag-toggle="' + esc(f.id) + '"' +
          (on ? " checked" : "") + '><span class="adm-slider"></span>' +
          '<span class="sr-note">' + esc(f.name) + " enabled</span></label>" +
          "</div>" +
          '<div class="adm-rollout"><label for="rollout-' + esc(f.id) + '">Rollout:</label>' +
          '<input type="range" id="rollout-' + esc(f.id) + '" min="0" max="100" step="5" value="' + rollout + '" data-rollout="' + esc(f.id) + '" aria-label="' + esc(f.name) + ' rollout percent">' +
          '<strong data-rollout-val="' + esc(f.id) + '">' + rollout + '%</strong></div>' +
          "</div>";
      }).join("") +
      '<p class="adm-muted" style="margin-top:.6rem">Rollout uses deterministic bucketing (<code>js/feature-flags.js</code> — <code>DKFlags.inRollout(uid, flagId, pct)</code>). 100% = everyone, 0% = nobody.</p>';
    }
    if (!d) { renderFlagsList({}); return; }
    d.collection("site_settings").doc("flags").get().then(function (snap) {
      renderFlagsList((snap.exists && snap.data()) || {});
    }).catch(function (err) {
      wrap.innerHTML = errHtml("Could not load flags: " + friendlyDbErr(err));
    });
    if (!wrap.dataset.wired) {
      wrap.dataset.wired = "1";
      wrap.addEventListener("change", function (ev) {
        if (!d) return;
        var F = fv();
        var t = ev.target.closest ? ev.target.closest("[data-flag-toggle],[data-rollout]") : null;
        if (!t) return;
        var id, val, auditAction;
        if (t.hasAttribute("data-rollout")) {
          id = t.getAttribute("data-rollout") + "__rollout";
          val = Math.max(0, Math.min(100, parseInt(t.value, 10) || 0));
          var lbl = wrap.querySelector('[data-rollout-val="' + t.getAttribute("data-rollout") + '"]');
          if (lbl) lbl.textContent = val + "%";
          auditAction = "flag_rollout";
        } else {
          id = t.getAttribute("data-flag-toggle");
          val = t.checked;
          auditAction = "flag_toggle";
        }
        var patch = { updatedBy: currentAdminUid(), updatedAt: F ? F.serverTimestamp() : new Date() };
        patch[id] = val;
        d.collection("site_settings").doc("flags").set(patch, { merge: true })
          .then(function () { logAudit(auditAction, id, "value=" + val); })
          .catch(function (err) {
            if (t.hasAttribute("data-flag-toggle")) t.checked = !val;
            alert("Could not save flag: " + friendlyDbErr(err));
          });
      });
    }
  }

  /* ================= 11. ANNOUNCEMENT BAR (#18) =================
   * Reads/writes Firestore `site_settings/announcement`:
   * { enabled, text, linkText, linkUrl, startDate, endDate, updatedAt, updatedBy }
   * Rendered on public pages by js/site-wide.js. */

  function loadAnnounce() {
    var d = db();
    if (!d) { showAnnMsg("Database unavailable.", false); return; }
    d.collection("site_settings").doc("announcement").get().then(function (snap) {
      var c = snap.exists ? snap.data() : {};
      var en = $("admAnnEnabled");
      if (en) en.checked = !!c.enabled;
      setVal("admAnnText", c.text || "");
      setVal("admAnnLinkText", c.linkText || "");
      setVal("admAnnLinkUrl", c.linkUrl || "");
      setVal("admAnnStart", c.startDate || "");
      setVal("admAnnEnd", c.endDate || "");
      var pubAt = $("admAnnPublishAt");
      if (pubAt && !pubAt.dataset.added) {
        // Scheduled publishing (#5): publishAt field injected once.
        pubAt.dataset.added = "1";
      }
      if (pubAt) {
        try {
          if (c.publishAt) {
            var ms = (c.publishAt.toMillis ? c.publishAt.toMillis() : Number(c.publishAt)) || 0;
            if (ms > 0) {
              var dt = new Date(ms);
              var pad = function (n) { return (n < 10 ? "0" : "") + n; };
              pubAt.value = dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()) +
                "T" + pad(dt.getHours()) + ":" + pad(dt.getMinutes());
            }
          }
        } catch (e) {}
      }
    }).catch(function (err) {
      showAnnMsg("Could not load announcement: " + friendlyDbErr(err), false);
    });
  }

  function showAnnMsg(msg, ok) {
    var el = $("admAnnMsg");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "";
    el.style.color = ok ? "#1F7A4D" : "#C93A3A";
  }

  function isSafeLinkUrl(u) {
    if (!u) return true;
    u = u.trim();
    return u.charAt(0) === "/" || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(u);
  }

  function wireAnnounce() {
    var btn = $("admAnnSave");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", function () {
      var d = db(), F = fv();
      if (!d) { showAnnMsg("Database unavailable.", false); return; }
      var text = (($("admAnnText") || {}).value || "").trim().slice(0, 160);
      var linkUrl = (($("admAnnLinkUrl") || {}).value || "").trim().slice(0, 200);
      if (!text) { showAnnMsg("Message text is required.", false); return; }
      if (!isSafeLinkUrl(linkUrl)) {
        showAnnMsg("Link URL must start with / or http(s)://", false);
        return;
      }
      var start = (($("admAnnStart") || {}).value || "").trim();
      var end = (($("admAnnEnd") || {}).value || "").trim();
      if (start && end && start > end) { showAnnMsg("Start date must be before end date.", false); return; }
      // Scheduled publishing (#5): future publishAt => status "scheduled".
      var pubAtRaw = (($("admAnnPublishAt") || {}).value || "").trim();
      var pubAtMs = pubAtRaw ? Date.parse(pubAtRaw) : 0;
      if (pubAtRaw && isNaN(pubAtMs)) { showAnnMsg("Publish date/time is invalid.", false); return; }
      var status = (pubAtMs && pubAtMs > Date.now()) ? "scheduled" : "live";
      var data = {
        enabled: !!($("admAnnEnabled") || {}).checked,
        text: text,
        linkText: (($("admAnnLinkText") || {}).value || "").trim().slice(0, 40),
        linkUrl: linkUrl,
        startDate: start,
        endDate: end,
        publishAt: pubAtMs || null,
        status: status,
        updatedBy: currentAdminUid(),
        updatedAt: F ? F.serverTimestamp() : new Date()
      };
      d.collection("site_settings").doc("announcement").set(data, { merge: true })
        .then(function () {
          logAudit("announcement_updated", "site_settings/announcement",
            "enabled=" + data.enabled + " text:" + text.slice(0, 60));
          showAnnMsg("✅ Announcement saved.", true);
        })
        .catch(function (err) { showAnnMsg("Save failed: " + friendlyDbErr(err), false); });
    });
  }

  /* ================= 12. CONTACT INBOX (#37) =================
   * Reads Firestore `contact_messages` (written by js/pages/contact-form.js):
   * { name, email, subject, message, page, userAgent, createdAt }.
   * Actions: mark read / delete. All actions audit-logged. */

  function loadInbox() {
    var d = db();
    var body = $("admInboxBody");
    if (!body) return;
    if (!d) {
      body.innerHTML = '<tr><td colspan="7">' + errHtml("Database unavailable.") + "</td></tr>";
      return;
    }
    body.innerHTML = '<tr><td colspan="7">' + SPINNER + "</td></tr>";
    d.collection("contact_messages").orderBy("createdAt", "desc").limit(50).get()
      .then(function (snap) {
        var countEl = $("admInboxCount");
        var unread = 0;
        snap.forEach(function (doc) { if (!(doc.data() || {}).read) unread++; });
        if (countEl) countEl.textContent = snap.empty ? "" : "(" + snap.size + " total, " + unread + " unread)";
        if (snap.empty) {
          body.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted)">No messages yet. 🎉</td></tr>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var m = doc.data() || {};
          var read = !!m.read;
          rows.push("<tr" + (read ? "" : " style='font-weight:600'") + ">" +
            "<td style='white-space:nowrap'>" + esc(relTime(toMillis(m.createdAt))) + "</td>" +
            "<td>" + esc(m.name || "—") + "</td>" +
            "<td><a href='mailto:" + esc(m.email || "") + "'>" + esc(m.email || "—") + "</a></td>" +
            "<td>" + esc(m.subject || "—") + "</td>" +
            "<td style='max-width:280px'>" + esc(String(m.message || "").slice(0, 200)) +
            (String(m.message || "").length > 200 ? "…" : "") + "</td>" +
            "<td>" + (read
              ? "<span class='badge'>read</span>"
              : "<span class='badge badge-amber'>new</span>") + "</td>" +
            "<td style='white-space:nowrap'>" +
            (read ? "" : '<button class="btn btn-sm" type="button" data-inbox-read="' + esc(doc.id) + '">✓ Read</button> ') +
            '<button class="btn btn-sm" type="button" data-inbox-del="' + esc(doc.id) + '" style="border-color:var(--danger,#C93A3A);color:var(--danger,#C93A3A)">Delete</button>' +
            "</td></tr>");
        });
        body.innerHTML = rows.join("");
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="7">' + errHtml("Could not load inbox. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  function wireInbox() {
    var body = $("admInboxBody");
    if (!body || body.dataset.wired) return;
    body.dataset.wired = "1";
    body.addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target.closest("[data-inbox-read],[data-inbox-del]") : null;
      if (!t) return;
      var d = db();
      if (!d) return;
      if (t.hasAttribute("data-inbox-read")) {
        var id = t.getAttribute("data-inbox-read");
        d.collection("contact_messages").doc(id).update({ read: true, readAt: fv() ? fv().serverTimestamp() : new Date() })
          .then(function () {
            logAudit("inbox_read", id, "marked read");
            loadInbox();
          })
          .catch(function (err) { alert("Could not mark as read: " + friendlyDbErr(err)); });
      } else {
        var delId = t.getAttribute("data-inbox-del");
        if (!confirm("Delete this message permanently?")) return;
        d.collection("contact_messages").doc(delId).delete()
          .then(function () {
            logAudit("inbox_deleted", delId, "message deleted");
            loadInbox();
          })
          .catch(function (err) { alert("Could not delete message: " + friendlyDbErr(err)); });
      }
    });
  }

  /* ================= 14. COMPETITOR WATCH =================
   * Reads/writes Firestore `competitors` docs:
   * { name, url, notes, updatedAt }. Admin-only collection.
   * Add form + per-row delete + prompt-based notes edit. All audit-logged. */

  function loadCompetitors() {
    var d = db();
    var body = $("admCompBody");
    if (!body) return;
    if (!d) {
      body.innerHTML = '<tr><td colspan="5">' + errHtml("Database unavailable.") + "</td></tr>";
      return;
    }
    body.innerHTML = '<tr><td colspan="5">' + SPINNER + "</td></tr>";
    d.collection("competitors").orderBy("updatedAt", "desc").limit(100).get()
      .then(function (snap) {
        var countEl = $("admCompCount");
        if (countEl) countEl.textContent = snap.empty ? "" : "(" + snap.size + " tracked)";
        if (snap.empty) {
          body.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted)">No competitors tracked yet. Add the first one above. 👀</td></tr>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var c = doc.data() || {};
          rows.push("<tr>" +
            "<td><strong>" + esc(c.name || "—") + "</strong></td>" +
            '<td><a href="' + esc(c.url || "#") + '" target="_blank" rel="noopener">' +
            esc(String(c.url || "—").slice(0, 60)) + "</a></td>" +
            '<td style="max-width:280px">' + esc(String(c.notes || "—").slice(0, 200)) +
            (String(c.notes || "").length > 200 ? "…" : "") + "</td>" +
            "<td style='white-space:nowrap'>" + esc(relTime(toMillis(c.updatedAt))) + "</td>" +
            "<td style='white-space:nowrap'>" +
            '<button class="btn btn-sm" type="button" data-comp-edit="' + esc(doc.id) + '">✏️ Edit notes</button> ' +
            '<button class="btn btn-sm" type="button" data-comp-del="' + esc(doc.id) + '" ' +
            'style="border-color:var(--danger,#C93A3A);color:var(--danger,#C93A3A)">Delete</button>' +
            "</td></tr>");
        });
        body.innerHTML = rows.join("");
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="5">' + errHtml("Could not load competitors. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  function showCompMsg(msg, ok) {
    var el = $("admCompMsg");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "";
    el.style.color = ok ? "#1F7A4D" : "#C93A3A";
  }

  function wireCompetitors() {
    var form = $("admCompForm");
    if (form && !form.dataset.wired) {
      form.dataset.wired = "1";
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = db(), F = fv();
        if (!d) { showCompMsg("Database unavailable.", false); return; }
        var name = (($("admCompName") || {}).value || "").trim().slice(0, 80);
        var url = (($("admCompUrl") || {}).value || "").trim().slice(0, 200);
        var notes = (($("admCompNotes") || {}).value || "").trim().slice(0, 500);
        if (!name) { showCompMsg("Name is required.", false); return; }
        if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
          showCompMsg("URL must start with http(s)://", false);
          return;
        }
        d.collection("competitors").add({
          name: name,
          url: url,
          notes: notes,
          updatedAt: F ? F.serverTimestamp() : new Date(),
          updatedBy: currentAdminUid()
        }).then(function () {
          form.reset();
          logAudit("competitor_added", name, url);
          showCompMsg("✅ Competitor added.", true);
          loadCompetitors();
        }).catch(function (err) {
          showCompMsg("Could not add: " + friendlyDbErr(err), false);
        });
      });
    }
    // Per-row edit/delete (delegated — rows re-render on load).
    var body = $("admCompBody");
    if (body && !body.dataset.wired) {
      body.dataset.wired = "1";
      body.addEventListener("click", function (ev) {
        var t = ev.target.closest ? ev.target.closest("[data-comp-edit],[data-comp-del]") : null;
        if (!t) return;
        var d = db(), F = fv();
        if (!d) return;
        if (t.hasAttribute("data-comp-edit")) {
          var id = t.getAttribute("data-comp-edit");
          d.collection("competitors").doc(id).get().then(function (snap) {
            if (!snap.exists) return;
            var cur = (snap.data() || {}).notes || "";
            var next = window.prompt("Edit notes:", cur);
            if (next === null) return; // cancelled
            next = String(next).slice(0, 500);
            return d.collection("competitors").doc(id).update({
              notes: next,
              updatedAt: F ? F.serverTimestamp() : new Date(),
              updatedBy: currentAdminUid()
            }).then(function () {
              logAudit("competitor_notes_edited", id, next.slice(0, 60));
              loadCompetitors();
            });
          }).catch(function (err) { alert("Could not edit notes: " + friendlyDbErr(err)); });
        } else {
          var delId = t.getAttribute("data-comp-del");
          if (!confirm("Delete this competitor permanently?")) return;
          d.collection("competitors").doc(delId).delete()
            .then(function () {
              logAudit("competitor_deleted", delId, "competitor deleted");
              loadCompetitors();
            })
            .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
        }
      });
    }
  }

  /* ---------------- boot ---------------- */

  function boot() {
    wireTabs();
    wireUsers();
    wireBulk();
    wireBackup();
    wirePaymentActions();
    wirePaySettings();
    wireSettings();
    wireAnnounce();
    wireInbox();
    wireCompetitors();
    loadDashboard();
    loadAnalytics();
    loadUsers();
    loadContent();
    loadAudit();
    loadSecurityEvents();
    loadCompetitors();
    loadPaySettings();
    // Refresh tabs when opened (new entries may exist).
    var bar = $("admTabs");
    if (bar) bar.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-tab]");
      if (!btn) return;
      var tab = btn.getAttribute("data-tab");
      if (tab === "audit") loadAudit();
      if (tab === "security") loadSecurityEvents();
      if (tab === "analytics") loadAnalytics();
      if (tab === "deposits") loadDeposits();
      if (tab === "withdrawals") loadWithdrawals();
      if (tab === "paysettings") loadPaySettings();
      if (tab === "settings") loadSettings();
      if (tab === "flags") loadFlags();
      if (tab === "announce") loadAnnounce();
      if (tab === "inbox") loadInbox();
      if (tab === "competitors") loadCompetitors();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { whenPanelVisible(verifyAndBoot); });
  } else {
    whenPanelVisible(verifyAndBoot);
  }
})();
