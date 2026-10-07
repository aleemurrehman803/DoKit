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
    { id: "users",     label: "👥 Users" },
    { id: "content",   label: "🧩 Content" },
    { id: "audit",     label: "📜 Audit log" },
    { id: "security",  label: "🔐 Security" },
    { id: "deposits",  label: "💰 Deposits" },
    { id: "withdrawals", label: "💸 Withdrawals" },
    { id: "paysettings", label: "⚙️ Pay settings" }
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

  /* ================= 2. USERS ================= */

  function loadUsers() {
    var d = db();
    if (!d) { setHtml("admUsersBody", '<tr><td colspan="6">' + errHtml("Database unavailable.") + "</td></tr>"); return; }
    setHtml("admUsersBody", '<tr><td colspan="6">' + SPINNER + "</td></tr>");
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
            lastLogin: toMillis(u.lastLogin)
          });
        });
        state.userPage = 0;
        renderUsers();
      })
      .catch(function (err) {
        setHtml("admUsersBody", '<tr><td colspan="6">' + errHtml("Could not load users. " + friendlyDbErr(err)) + "</td></tr>");
      });
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
      setHtml("admUsersBody", '<tr><td colspan="6" style="color:var(--text-muted)">No users found.</td></tr>');
    } else {
      setHtml("admUsersBody", page.map(function (u) {
        var rc = state.runCounts[u.uid];
        return "<tr>" +
          "<td><strong>" + esc(u.name || "(no name)") + "</strong></td>" +
          "<td>" + esc(u.email || "—") + "</td>" +
          "<td>" + esc(u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—") + "</td>" +
          '<td><span class="badge">' + fmtNum(u.coins) + " 🪙</span></td>" +
          "<td>" + (rc == null ? "…" : fmtNum(rc)) + "</td>" +
          '<td><button class="btn btn-sm" data-view-user="' + esc(u.uid) + '">View</button></td>' +
          "</tr>";
      }).join(""));
    }

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
        "<h4>Journey history</h4>" + runsHtml +
        "</div>");

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
              '<button class="btn btn-sm" type="button" data-reject-dep="' + esc(dep.id) + '">❌ Reject</button>' +
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
            return "<tr>" +
              "<td>" + fmtTime(wd.createdAtMs) + "</td>" +
              "<td>" + esc(r.uname) + "<br><small style='color:var(--text-muted)'>" + esc(r.uemail) + "</small></td>" +
              "<td><strong>Rs " + esc(wd.amount) + "</strong></td>" +
              "<td>" + esc(wd.method) + "</td>" +
              "<td><code>" + esc(wd.account) + "</code></td>" +
              "<td style='white-space:nowrap'>" +
              '<button class="btn btn-sm btn-primary" type="button" data-process-wd="' + esc(wd.id) + '" data-amt="' + esc(wd.amount) + '">✅ Processed</button> ' +
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
   * Mark a withdrawal as processed (admin has sent the money manually).
   * The locked coins stay deducted (they were already removed from available).
   */
  function processWithdrawal(wdId, amount) {
    var d = db();
    if (!d) return;
    if (!window.confirm(
      "Mark withdrawal of Rs " + amount + " as PROCESSED?\n\n" +
      "Only click this AFTER you have manually sent the money to the user's account."
    )) return;

    var wdRef = d.collection("withdrawals").doc(wdId);

    d.runTransaction(function (tx) {
      return tx.get(wdRef).then(function (snap) {
        if (!snap.exists) throw new Error("Withdrawal not found.");
        var wdData = snap.data();
        if (wdData.status !== "pending") throw new Error("Withdrawal is no longer pending.");
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
            processedBy: currentAdminUid(),
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedAtMs: Date.now()
          });
        });
      });
    }).then(function () {
      logAudit("withdrawal_processed", wdId, "amount:" + amount);
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
      var t = ev.target.closest("[data-approve-dep],[data-reject-dep],[data-process-wd],[data-reject-wd],[data-shot]");
      if (!t) return;

      if (t.hasAttribute("data-approve-dep")) {
        approveDeposit(t.getAttribute("data-approve-dep"),
          Number(t.getAttribute("data-amt")) || 0,
          t.getAttribute("data-uid"));
      } else if (t.hasAttribute("data-reject-dep")) {
        rejectDeposit(t.getAttribute("data-reject-dep"));
      } else if (t.hasAttribute("data-process-wd")) {
        processWithdrawal(t.getAttribute("data-process-wd"),
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

  /* ---------------- boot ---------------- */

  function boot() {
    wireTabs();
    wireUsers();
    wirePaymentActions();
    wirePaySettings();
    loadDashboard();
    loadUsers();
    loadContent();
    loadAudit();
    loadSecurityEvents();
    loadPaySettings();
    // Refresh tabs when opened (new entries may exist).
    var bar = $("admTabs");
    if (bar) bar.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-tab]");
      if (!btn) return;
      var tab = btn.getAttribute("data-tab");
      if (tab === "audit") loadAudit();
      if (tab === "security") loadSecurityEvents();
      if (tab === "deposits") loadDeposits();
      if (tab === "withdrawals") loadWithdrawals();
      if (tab === "paysettings") loadPaySettings();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { whenPanelVisible(verifyAndBoot); });
  } else {
    whenPanelVisible(verifyAndBoot);
  }
})();
