/* DoKit — Admin Panel Extensions (admin-plus.js).
 * Implements the "20 improvements" batch on top of js/pages/admin-full.js.
 * Loads AFTER admin-full.js (defer order in admin/index.html).
 *
 * Uses window.DKAdmin (exposed by admin-full.js): logAudit(), getAdmin().
 * New tabs: alerts, ab, cohorts, fraud, tickets, changelog, referrals,
 * tiers, kb, i18n, import, og, views.
 *
 * Conventions (owner's "write once" rule): every Firestore call has .catch
 * with a user-friendly message; no inline onclick (CSP-safe); all user
 * content escaped via esc(); every new action is audit-logged.
 * Cloud-Function TODOs are marked explicitly (project is on Spark/Blaze-less).
 */
(function () {
  "use strict";

  /* ---------------- shared helpers (local copies) ---------------- */

  function $(id) { return document.getElementById(id); }

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

  function fmtNum(n) { return Number(n || 0).toLocaleString("en-US"); }

  var SPINNER = '<span class="adm-spin" aria-hidden="true"></span><span class="sr-note">Loading…</span>';

  function setHtml(id, html) { var n = $(id); if (n) n.innerHTML = html; }

  function errHtml(msg) { return '<p class="adm-err">⚠️ ' + esc(msg) + "</p>"; }

  function showMsg(id, msg, ok) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = "";
    el.style.color = ok ? "#1F7A4D" : "#C93A3A";
  }

  function audit(action, target, details) {
    try {
      if (window.DKAdmin && typeof window.DKAdmin.logAudit === "function") {
        window.DKAdmin.logAudit(action, target, details);
      }
    } catch (e) { /* best-effort */ }
  }

  function adminUid() {
    try {
      var a = window.DKAdmin && typeof window.DKAdmin.getAdmin === "function"
        ? window.DKAdmin.getAdmin() : null;
      return (a && a.uid) || "unknown";
    } catch (e) { return "unknown"; }
  }

  function adminEmail() {
    try {
      var a = window.DKAdmin && typeof window.DKAdmin.getAdmin === "function"
        ? window.DKAdmin.getAdmin() : null;
      return (a && a.email) || "";
    } catch (e) { return ""; }
  }

  function friendlyDbErr(err) {
    var m = (err && (err.message || err.code)) || "";
    m = String(m);
    if (/permission-denied|PERMISSION_DENIED/i.test(m)) return "Permission denied — check Firestore rules.";
    if (/unavailable|UNAVAILABLE/i.test(m)) return "Database unavailable — check your connection.";
    return m.slice(0, 160) || "Unknown error.";
  }

  /* Wait until the admin panel is revealed (same pattern as admin-full.js). */
  function whenReady(cb) {
    var panel = $("adminPanel");
    if (panel && panel.style.display !== "none") { cb(); return; }
    var done = false;
    var obs = new MutationObserver(function () {
      var p = $("adminPanel");
      if (!done && p && p.style.display !== "none") { done = true; obs.disconnect(); cb(); }
    });
    obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["style"] });
    setTimeout(function () { try { obs.disconnect(); } catch (e) {} }, 30000);
  }

  /* ================= ITEM 2 — ADMIN PRESENCE =================
   * Firestore `admin_presence/{uid}` with 60s heartbeat; docs older than
   * 3 minutes count as offline. (Firestore has no onDisconnect — RTDB would,
   * but the task constrains us to Firestore only.) */

  function startPresence() {
    var d = db();
    var uid = adminUid();
    if (!d || !uid || uid === "unknown") return;
    var F = fv();
    var ref = d.collection("admin_presence").doc(uid);

    function beat() {
      ref.set({
        uid: uid,
        email: adminEmail(),
        lastSeen: F ? F.serverTimestamp() : new Date()
      }, { merge: true }).catch(function () { /* best-effort */ });
    }
    beat();
    setInterval(beat, 60000);
    window.addEventListener("beforeunload", function () {
      try { ref.delete(); } catch (e) { /* best-effort */ }
    });

    function render() {
      d.collection("admin_presence").get().then(function (snap) {
        var now = Date.now(), online = [];
        snap.forEach(function (doc) {
          var p = doc.data() || {};
          var ls = toMillis(p.lastSeen);
          // Skip docs whose serverTimestamp hasn't resolved yet on read.
          if (ls && now - ls < 3 * 60000) online.push(p);
        });
        var pill = $("admPresence");
        if (!pill) return;
        var avatars = online.map(function (p) {
          var label = String(p.email || p.uid || "?");
          var init = label.charAt(0).toUpperCase();
          return '<span class="avatar" title="' + esc(label) + '">' + esc(init) + "</span>";
        }).join("");
        pill.innerHTML = '<span class="dot" aria-hidden="true"></span>' + avatars +
          '<span>' + online.length + " online</span>";
        pill.title = online.length
          ? "Online now: " + online.map(function (p) { return p.email || p.uid; }).join(", ")
          : "No other admins online";
      }).catch(function () { /* best-effort */ });
    }
    render();
    setInterval(render, 30000);
  }

  /* ================= ITEM 3 — USER NOTES (mini CRM) =================
   * Subcollection `users/{uid}/notes/{noteId}`: { text, byUid, byEmail, createdAt }.
   * Rendered into #admNotesWrap inside the user drawer (hook in admin-full.js). */

  function renderNotes(uid, container) {
    var d = db();
    container.innerHTML = "<h4>📝 Internal notes</h4><div>" + SPINNER + "</div>";
    function paint(listHtml) {
      container.innerHTML = "<h4>📝 Internal notes</h4>" + listHtml +
        '<div class="adm-row" style="margin-top:.4rem">' +
        '<input id="admNoteText" class="text-input" type="text" maxlength="300" placeholder="Private note (admins only)…" style="flex:2;min-width:180px" aria-label="Note text">' +
        '<button class="btn btn-sm btn-primary" type="button" id="admNoteAdd">Add note</button>' +
        "</div>";
      var addBtn = $("admNoteAdd");
      if (addBtn) addBtn.addEventListener("click", function () {
        var dd = db(), F = fv();
        if (!dd) { alert("Database unavailable."); return; }
        var text = (($("admNoteText") || {}).value || "").trim().slice(0, 300);
        if (!text) { alert("Write something first."); return; }
        dd.collection("users").doc(uid).collection("notes").add({
          text: text,
          byUid: adminUid(),
          byEmail: adminEmail(),
          createdAt: F ? F.serverTimestamp() : new Date()
        }).then(function () {
          audit("user_note_added", uid, text.slice(0, 80));
          renderNotes(uid, container);
        }).catch(function (err) { alert("Could not save note: " + friendlyDbErr(err)); });
      });
    }
    if (!d) { paint(errHtml("Database unavailable.")); return; }
    d.collection("users").doc(uid).collection("notes")
      .orderBy("createdAt", "desc").limit(20).get()
      .then(function (snap) {
        if (snap.empty) {
          paint('<p class="adm-muted" style="margin:.2rem 0">No notes yet.</p>');
          return;
        }
        var items = [];
        snap.forEach(function (doc) {
          var n = doc.data() || {};
          items.push(
            '<div style="border:1px solid var(--border,#e5e7eb);border-radius:.5rem;padding:.5rem .7rem;margin-bottom:.4rem">' +
            "<div>" + esc(n.text || "") + "</div>" +
            '<div class="adm-muted">' + esc(n.byEmail || n.byUid || "admin") + " · " + esc(relTime(toMillis(n.createdAt))) +
            ' <button class="btn btn-sm" type="button" data-note-del="' + esc(doc.id) + '" style="margin-inline-start:.5rem">Delete</button></div>' +
            "</div>");
        });
        paint(items.join(""));
      })
      .catch(function (err) { paint(errHtml("Could not load notes. " + friendlyDbErr(err))); });

    // Delete delegation: attached ONCE per container (paint() re-runs on
    // every add/delete, so this must live outside it).
    if (!container.dataset.notesWired) {
      container.dataset.notesWired = "1";
      container.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-note-del]") : null;
        if (!b) return;
        if (!confirm("Delete this note?")) return;
        var dd = db();
        if (!dd) return;
        dd.collection("users").doc(uid).collection("notes").doc(b.getAttribute("data-note-del")).delete()
          .then(function () {
            audit("user_note_deleted", uid, b.getAttribute("data-note-del"));
            renderNotes(uid, container);
          })
          .catch(function (err) { alert("Could not delete note: " + friendlyDbErr(err)); });
      });
    }
  }

  window.DKNotes = { render: renderNotes };

  /* ================= ITEM 5 — SCHEDULED PUBLISHING (due-check) =================
   * Announcements/changelog with status "scheduled" and publishAt <= now go
   * live when the admin panel opens. True scheduled reliability needs a
   * Cloud Function (TODO — Blaze plan required). */

  function checkScheduled() {
    var d = db();
    if (!d) return;
    var now = Date.now();
    d.collection("site_settings").doc("announcement").get().then(function (snap) {
      if (!snap.exists) return;
      var a = snap.data() || {};
      var pubAt = Number(a.publishAt) || 0;
      if (a.status === "scheduled" && pubAt && pubAt <= now) {
        snap.ref.update({ status: "live" }).then(function () {
          audit("announcement_auto_live", "site_settings/announcement", "scheduled time reached");
        }).catch(function () { /* best-effort */ });
      }
    }).catch(function () { /* best-effort */ });
    d.collection("changelog").where("status", "==", "scheduled").get().then(function (snap) {
      snap.forEach(function (doc) {
        var c = doc.data() || {};
        var pubAt = Number(c.publishAt) || 0;
        if (pubAt && pubAt <= now) {
          doc.ref.update({ status: "live", published: true }).then(function () {
            audit("changelog_auto_live", doc.id, (c.version || "").slice(0, 20));
          }).catch(function () { /* best-effort */ });
        }
      });
    }).catch(function () { /* best-effort */ });
  }

  /* ================= ITEM 6 — CRITICAL ALERT RULES =================
   * Per-admin rules in `admins/{uid}/alertRules`. Push DELIVERY runs in a
   * Cloud Function (TODO — needs Blaze plan); device tokens would live in
   * `admins/{uid}/fcmTokens`. This tab manages the rules only. */

  var ALERT_EVENTS = {
    big_deposit: "Big deposit (≥ threshold Rs)",
    failed_logins: "Failed logins spike (count / 10 min)",
    new_user_spike: "New users spike (count / hour)",
    withdrawal_request: "Any withdrawal request"
  };

  function loadAlerts() {
    var d = db(), wrap = $("admAlertList");
    if (!wrap) return;
    if (!d) { wrap.innerHTML = errHtml("Database unavailable."); return; }
    var uid = adminUid();
    wrap.innerHTML = SPINNER;
    d.collection("admins").doc(uid).collection("alertRules").get()
      .then(function (snap) {
        if (snap.empty) {
          wrap.innerHTML = '<p class="adm-muted">No alert rules yet. Add one below.</p>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var r = doc.data() || {};
          rows.push('<div class="adm-toolrow">' +
            "<div><strong>" + esc(ALERT_EVENTS[r.event] || r.event || "—") + "</strong><br>" +
            '<span class="adm-muted">Threshold: ' + esc(r.threshold) + (r.enabled === false ? " · disabled" : "") + "</span></div>" +
            '<button class="btn btn-sm" type="button" data-alert-del="' + esc(doc.id) + '">Delete</button>' +
            "</div>");
        });
        wrap.innerHTML = rows.join("");
      })
      .catch(function (err) { wrap.innerHTML = errHtml("Could not load alert rules. " + friendlyDbErr(err)); });
  }

  function wireAlerts() {
    var add = $("admAlertAdd");
    if (add && !add.dataset.wired) {
      add.dataset.wired = "1";
      add.addEventListener("click", function () {
        var d = db(), F = fv();
        if (!d) { showMsg("admAlertMsg", "Database unavailable.", false); return; }
        var event = ($("admAlertEvent") || {}).value || "big_deposit";
        var threshold = Math.max(1, parseInt(($("admAlertThreshold") || {}).value, 10) || 1);
        d.collection("admins").doc(adminUid()).collection("alertRules").add({
          event: event, threshold: threshold, enabled: true,
          createdAt: F ? F.serverTimestamp() : new Date()
        }).then(function () {
          audit("alert_rule_added", event, "threshold=" + threshold);
          showMsg("admAlertMsg", "✅ Rule added. Push delivery needs a Cloud Function (Blaze plan).", true);
          loadAlerts();
        }).catch(function (err) { showMsg("admAlertMsg", "Could not add rule: " + friendlyDbErr(err), false); });
      });
    }
    var wrap = $("admAlertList");
    if (wrap && !wrap.dataset.wired) {
      wrap.dataset.wired = "1";
      wrap.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-alert-del]") : null;
        if (!b) return;
        if (!confirm("Delete this alert rule?")) return;
        var d = db();
        if (!d) return;
        d.collection("admins").doc(adminUid()).collection("alertRules").doc(b.getAttribute("data-alert-del")).delete()
          .then(function () { audit("alert_rule_deleted", b.getAttribute("data-alert-del"), ""); loadAlerts(); })
          .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
      });
    }
  }

  /* ================= ITEM 4 — A/B TESTS (basic, client-side) =================
   * `experiments/{id}`: { name, goal, variantA, variantB, splitB, status,
   * createdAt, createdBy }. Results counted from `events` docs
   * { exp, variant: 'A'|'B', event, ts }. Bucketing: DKFlags.variantFor. */

  function loadAb() {
    var d = db(), wrap = $("admAbList");
    if (!wrap) return;
    if (!d) { wrap.innerHTML = errHtml("Database unavailable."); return; }
    wrap.innerHTML = SPINNER;
    d.collection("experiments").orderBy("createdAt", "desc").limit(30).get()
      .then(function (snap) {
        if (snap.empty) {
          wrap.innerHTML = '<p class="adm-muted">No experiments yet. Create one above.</p>';
          return;
        }
        var exps = [];
        snap.forEach(function (doc) {
          exps.push(Object.assign({ id: doc.id }, doc.data()));
        });
        // For each experiment, count exposures + goal conversions per variant.
        var jobs = exps.map(function (e) {
          return d.collection("events").where("exp", "==", e.id).limit(2000).get()
            .then(function (esnap) {
              var stats = { A: { exp: 0, conv: 0 }, B: { exp: 0, conv: 0 } };
              esnap.forEach(function (edoc) {
                var ev = edoc.data() || {};
                var v = ev.variant === "B" ? "B" : "A";
                if (ev.event === "exposure") stats[v].exp++;
                else if (ev.event === e.goal) stats[v].conv++;
              });
              return { e: e, stats: stats };
            })
            .catch(function () { return { e: e, stats: null }; });
        });
        return Promise.all(jobs);
      })
      .then(function (results) {
        if (!results) return;
        var html = results.map(function (r) {
          var e = r.e, s = r.stats;
          function pct(v) {
            if (!s || !s[v].exp) return "—";
            return Math.round(100 * s[v].conv / s[v].exp) + "%";
          }
          var winner = "";
          if (s && s.A.exp >= 20 && s.B.exp >= 20) {
            var ra = s.A.conv / s.A.exp, rb = s.B.conv / s.B.exp;
            winner = rb > ra
              ? ' <span class="badge" style="background:#1F7A4D;color:#fff">B wins</span>'
              : ' <span class="badge" style="background:#1F7A4D;color:#fff">A wins</span>';
          }
          return '<div class="adm-toolrow" style="display:block">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">' +
            "<div><strong>" + esc(e.name || "—") + "</strong>" + winner + "<br>" +
            '<span class="adm-muted">Goal: ' + esc(e.goal || "—") + " · B traffic: " + esc(e.splitB) + "% · Status: " + esc(e.status || "running") + "</span></div>" +
            '<span><button class="btn btn-sm" type="button" data-ab-toggle="' + esc(e.id) + '" data-status="' + esc(e.status || "running") + '">' +
            (e.status === "stopped" ? "▶ Resume" : "⏸ Stop") + "</button> " +
            '<button class="btn btn-sm" type="button" data-ab-del="' + esc(e.id) + '" style="border-color:var(--danger,#C93A3A);color:var(--danger,#C93A3A)">Delete</button></span>' +
            "</div>" +
            '<div class="adm-muted" style="margin-top:.3rem">A "' + esc(String(e.variantA || "").slice(0, 60)) + '": ' +
            (s ? fmtNum(s.A.exp) + " exposures → " + fmtNum(s.A.conv) + " conversions (" + pct("A") + ")" : "…") +
            ' &nbsp;·&nbsp; B "' + esc(String(e.variantB || "").slice(0, 60)) + '": ' +
            (s ? fmtNum(s.B.exp) + " exposures → " + fmtNum(s.B.conv) + " conversions (" + pct("B") + ")" : "…") + "</div>" +
            "</div>";
        }).join("");
        wrap.innerHTML = html || '<p class="adm-muted">No experiments yet.</p>';
      })
      .catch(function (err) { wrap.innerHTML = errHtml("Could not load experiments. " + friendlyDbErr(err)); });
  }

  function wireAb() {
    var split = $("admAbSplit"), splitVal = $("admAbSplitVal");
    if (split && !split.dataset.wired) {
      split.dataset.wired = "1";
      split.addEventListener("input", function () {
        if (splitVal) splitVal.textContent = split.value + "%";
      });
    }
    var create = $("admAbCreate");
    if (create && !create.dataset.wired) {
      create.dataset.wired = "1";
      create.addEventListener("click", function () {
        var d = db(), F = fv();
        if (!d) { showMsg("admAbMsg", "Database unavailable.", false); return; }
        var name = (($("admAbName") || {}).value || "").trim().slice(0, 60);
        var a = (($("admAbA") || {}).value || "").trim().slice(0, 120);
        var b = (($("admAbB") || {}).value || "").trim().slice(0, 120);
        if (!name || !a || !b) { showMsg("admAbMsg", "Name and both variants are required.", false); return; }
        d.collection("experiments").add({
          name: name, goal: ($("admAbGoal") || {}).value || "announcement_click",
          variantA: a, variantB: b,
          splitB: Math.max(10, Math.min(90, parseInt(split.value, 10) || 50)),
          status: "running",
          createdAt: F ? F.serverTimestamp() : new Date(),
          createdBy: adminUid()
        }).then(function () {
          audit("ab_created", name, "splitB=" + split.value);
          showMsg("admAbMsg", "✅ Experiment created.", true);
          loadAb();
        }).catch(function (err) { showMsg("admAbMsg", "Could not create: " + friendlyDbErr(err), false); });
      });
    }
    var list = $("admAbList");
    if (list && !list.dataset.wired) {
      list.dataset.wired = "1";
      list.addEventListener("click", function (ev) {
        var t = ev.target.closest ? ev.target.closest("[data-ab-toggle],[data-ab-del]") : null;
        if (!t) return;
        var d = db();
        if (!d) return;
        if (t.hasAttribute("data-ab-toggle")) {
          var next = t.getAttribute("data-status") === "stopped" ? "running" : "stopped";
          d.collection("experiments").doc(t.getAttribute("data-ab-toggle")).update({ status: next })
            .then(function () { audit("ab_status", t.getAttribute("data-ab-toggle"), next); loadAb(); })
            .catch(function (err) { alert("Could not update: " + friendlyDbErr(err)); });
        } else if (confirm("Delete this experiment permanently?")) {
          d.collection("experiments").doc(t.getAttribute("data-ab-del")).delete()
            .then(function () { audit("ab_deleted", t.getAttribute("data-ab-del"), ""); loadAb(); })
            .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
        }
      });
    }
  }

  /* ================= ITEM 10 — COHORT RETENTION (basic, client-side) ================= */

  function monthKey(ms) {
    var dt = new Date(ms);
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return dt.getFullYear() + "-" + pad(dt.getMonth() + 1);
  }

  function addMonths(key, n) {
    var parts = key.split("-");
    var dt = new Date(Number(parts[0]), Number(parts[1]) - 1 + n, 1);
    var pad = function (x) { return (x < 10 ? "0" : "") + x; };
    return dt.getFullYear() + "-" + pad(dt.getMonth() + 1);
  }

  function loadCohorts() {
    var d = db();
    var head = $("admCohortHead"), body = $("admCohortBody");
    if (!head || !body) return;
    if (!d) { body.innerHTML = '<tr><td>' + errHtml("Database unavailable.") + "</td></tr>"; return; }
    body.innerHTML = '<tr><td>' + SPINNER + "</td></tr>";
    var pUsers = d.collection("users").limit(500).get();
    var pRuns = d.collectionGroup("tool_runs").limit(1500).get();
    Promise.all([pUsers, pRuns]).then(function (res) {
      var cohorts = {};   // monthKey -> [uid]
      var active = {};    // uid -> { monthKey: true }
      res[0].forEach(function (doc) {
        var u = doc.data() || {};
        var mk = monthKey(toMillis(u.createdAt) || Date.now());
        (cohorts[mk] = cohorts[mk] || []).push(doc.id);
      });
      res[1].forEach(function (doc) {
        var r = doc.data() || {};
        var ts = toMillis(r.ts) || toMillis(r.createdAt);
        if (!ts) return;
        var uid = "";
        try { uid = doc.ref.parent.parent.id; } catch (e) {}
        if (!uid) return;
        var mk = monthKey(ts);
        (active[uid] = active[uid] || {})[mk] = true;
      });
      var keys = Object.keys(cohorts).sort().slice(-6);
      if (!keys.length) {
        body.innerHTML = '<tr><td style="color:var(--text-muted)">No user data yet.</td></tr>';
        return;
      }
      head.innerHTML = "<th>Cohort</th><th>Users</th>" +
        [0, 1, 2, 3, 4, 5].map(function (m) { return "<th>M" + m + "</th>"; }).join("");
      body.innerHTML = keys.map(function (k) {
        var members = cohorts[k];
        var cells = [0, 1, 2, 3, 4, 5].map(function (m) {
          var mk = addMonths(k, m);
          var n = members.filter(function (uid) { return active[uid] && active[uid][mk]; }).length;
          var pct = members.length ? Math.round(100 * n / members.length) : 0;
          var bg = pct >= 50 ? "#1F7A4D" : pct >= 20 ? "#B7791F" : "#C93A3A";
          return '<td><span class="badge" style="background:' + bg + ';color:#fff" title="' + n + " of " + members.length + ' active">' + pct + "%</span></td>";
        }).join("");
        return "<tr><td><strong>" + esc(k) + "</strong></td><td>" + fmtNum(members.length) + "</td>" + cells + "</tr>";
      }).join("");
    }).catch(function (err) {
      body.innerHTML = '<tr><td>' + errHtml("Could not load cohorts. " + friendlyDbErr(err)) + "</td></tr>";
    });
  }

  /* ================= ITEM 11 — FRAUD RULES + REVIEW QUEUE =================
   * Rules UI + `flagged_transactions` queue work now. Automatic DETECTION
   * runs in a Cloud Function (TODO — needs Blaze plan). */

  function loadFraudRules() {
    var d = db(), wrap = $("admFraudRules");
    if (!wrap) return;
    if (!d) { wrap.innerHTML = errHtml("Database unavailable."); return; }
    wrap.innerHTML = SPINNER;
    d.collection("site_settings").doc("fraud_rules").get()
      .then(function (snap) {
        var rules = ((snap.exists && snap.data()) || {}).rules || [];
        if (!rules.length) {
          wrap.innerHTML = '<p class="adm-muted">No fraud rules yet. Detection runs in a Cloud Function (TODO).</p>';
          return;
        }
        wrap.innerHTML = rules.map(function (r, i) {
          return '<div class="adm-toolrow"><div><strong>' + esc(r.kind || "—") + "</strong><br>" +
            '<span class="adm-muted">Threshold: ' + esc(r.threshold) + "</span></div>" +
            '<button class="btn btn-sm" type="button" data-fraudrule-del="' + i + '">Delete</button></div>';
        }).join("");
      })
      .catch(function (err) { wrap.innerHTML = errHtml("Could not load fraud rules. " + friendlyDbErr(err)); });
  }

  function loadFraudQueue() {
    var d = db(), body = $("admFraudQueue");
    if (!body) return;
    if (!d) { body.innerHTML = '<tr><td colspan="8">' + errHtml("Database unavailable.") + "</td></tr>"; return; }
    body.innerHTML = '<tr><td colspan="8">' + SPINNER + "</td></tr>";
    d.collection("flagged_transactions").orderBy("createdAt", "desc").limit(50).get()
      .then(function (snap) {
        var countEl = $("admFraudCount");
        if (countEl) countEl.textContent = snap.empty ? "" : "(" + snap.size + " flagged)";
        if (snap.empty) {
          body.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted)">Nothing flagged. 🎉</td></tr>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var f = doc.data() || {};
          var risk = Number(f.risk) || 0;
          var riskBg = risk >= 70 ? "#C93A3A" : risk >= 40 ? "#B7791F" : "#1F7A4D";
          rows.push("<tr>" +
            "<td>" + esc(relTime(toMillis(f.createdAt))) + "</td>" +
            "<td>" + esc(f.kind || "—") + "</td>" +
            "<td>" + esc(f.userEmail || f.userId || "—") + "</td>" +
            "<td><strong>Rs " + esc(f.amount) + "</strong></td>" +
            "<td style='max-width:220px'>" + esc(String(f.reason || "").slice(0, 120)) + "</td>" +
            '<td><span class="badge" style="background:' + riskBg + ';color:#fff">' + risk + "</span></td>" +
            "<td>" + esc(f.status || "pending") + "</td>" +
            "<td style='white-space:nowrap'>" +
            '<button class="btn btn-sm" type="button" data-fraud-ok="' + esc(doc.id) + '">✅ Legit</button> ' +
            '<button class="btn btn-sm" type="button" data-fraud-block="' + esc(doc.id) + '" style="border-color:var(--danger,#C93A3A);color:var(--danger,#C93A3A)">⛔ Block</button>' +
            "</td></tr>");
        });
        body.innerHTML = rows.join("");
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="8">' + errHtml("Could not load queue. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  function wireFraud() {
    var add = $("admFraudAdd");
    if (add && !add.dataset.wired) {
      add.dataset.wired = "1";
      add.addEventListener("click", function () {
        var d = db(), F = fv();
        if (!d) { showMsg("admFraudMsg", "Database unavailable.", false); return; }
        var kind = ($("admFraudKind") || {}).value || "deposits_per_day";
        var threshold = Math.max(1, parseInt(($("admFraudThreshold") || {}).value, 10) || 1);
        var ref = d.collection("site_settings").doc("fraud_rules");
        ref.get().then(function (snap) {
          var rules = ((snap.exists && snap.data()) || {}).rules || [];
          rules.push({ kind: kind, threshold: threshold, enabled: true });
          return ref.set({
            rules: rules,
            updatedBy: adminUid(),
            updatedAt: F ? F.serverTimestamp() : new Date()
          }, { merge: true });
        }).then(function () {
          audit("fraud_rule_added", kind, "threshold=" + threshold);
          showMsg("admFraudMsg", "✅ Rule saved. Detection runs in a Cloud Function (TODO).", true);
          loadFraudRules();
        }).catch(function (err) { showMsg("admFraudMsg", "Could not save: " + friendlyDbErr(err), false); });
      });
    }
    var rulesWrap = $("admFraudRules");
    if (rulesWrap && !rulesWrap.dataset.wired) {
      rulesWrap.dataset.wired = "1";
      rulesWrap.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-fraudrule-del]") : null;
        if (!b) return;
        if (!confirm("Delete this fraud rule?")) return;
        var d = db(), F = fv();
        if (!d) return;
        var idx = parseInt(b.getAttribute("data-fraudrule-del"), 10);
        var ref = d.collection("site_settings").doc("fraud_rules");
        ref.get().then(function (snap) {
          var rules = ((snap.exists && snap.data()) || {}).rules || [];
          rules.splice(idx, 1);
          return ref.set({ rules: rules, updatedBy: adminUid(), updatedAt: F ? F.serverTimestamp() : new Date() }, { merge: true });
        }).then(function () { audit("fraud_rule_deleted", "index " + idx, ""); loadFraudRules(); })
          .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
      });
    }
    var queue = $("admFraudQueue");
    if (queue && !queue.dataset.wired) {
      queue.dataset.wired = "1";
      queue.addEventListener("click", function (ev) {
        var t = ev.target.closest ? ev.target.closest("[data-fraud-ok],[data-fraud-block]") : null;
        if (!t) return;
        var d = db(), F = fv();
        if (!d) return;
        var id = t.hasAttribute("data-fraud-ok") ? t.getAttribute("data-fraud-ok") : t.getAttribute("data-fraud-block");
        var status = t.hasAttribute("data-fraud-ok") ? "legit" : "blocked";
        if (!confirm("Mark this flagged transaction as " + status.toUpperCase() + "?")) return;
        d.collection("flagged_transactions").doc(id).update({
          status: status, reviewedBy: adminUid(),
          reviewedAt: F ? F.serverTimestamp() : new Date()
        }).then(function () {
          audit("fraud_reviewed", id, status);
          loadFraudQueue();
        }).catch(function (err) { alert("Could not update: " + friendlyDbErr(err)); });
      });
    }
  }

  /* ================= ITEM 20 — SUPPORT TICKETS (kanban) =================
   * `tickets/{id}`: { subject, message, name, email, userId, status
   * ('open'|'in_progress'|'closed'), assignee, messages: [{by,text,at}],
   * createdAt, updatedAt }. The contact form writes BOTH contact_messages
   * AND a ticket (see js/pages/contact-form.js) — the form itself is NOT
   * duplicated. SLA: open tickets older than 24h get a red badge. */

  var TICKET_SLA_MS = 24 * 60 * 60 * 1000;

  function ticketCard(t, id) {
    var age = Date.now() - toMillis(t.createdAt);
    var sla = (t.status === "open" || !t.status) && age > TICKET_SLA_MS
      ? ' <span class="adm-sla" title="Open for over 24h">⏰ SLA</span>' : "";
    return '<div class="adm-ticket" data-ticket-open="' + esc(id) + '" role="button" tabindex="0" aria-label="Open ticket">' +
      "<strong>" + esc(String(t.subject || "(no subject)").slice(0, 60)) + "</strong>" + sla + "<br>" +
      '<span class="adm-muted">' + esc(String(t.name || t.email || "—").slice(0, 40)) + " · " + esc(relTime(toMillis(t.createdAt))) + "</span>" +
      "</div>";
  }

  function loadTickets() {
    var d = db();
    var cols = { open: $("admTicketOpen"), prog: $("admTicketProg"), closed: $("admTicketClosed") };
    if (!cols.open) return;
    if (!d) {
      cols.open.innerHTML = errHtml("Database unavailable.");
      return;
    }
    Object.keys(cols).forEach(function (k) { cols[k].innerHTML = SPINNER; });
    d.collection("tickets").orderBy("updatedAt", "desc").limit(100).get()
      .then(function (snap) {
        var buckets = { open: [], in_progress: [], closed: [] };
        snap.forEach(function (doc) {
          var t = doc.data() || {};
          var st = t.status === "closed" ? "closed" : t.status === "in_progress" ? "in_progress" : "open";
          buckets[st].push(ticketCard(t, doc.id));
        });
        cols.open.innerHTML = buckets.open.join("") || '<p class="adm-muted">Empty.</p>';
        cols.prog.innerHTML = buckets.in_progress.join("") || '<p class="adm-muted">Empty.</p>';
        cols.closed.innerHTML = buckets.closed.join("") || '<p class="adm-muted">Empty.</p>';
      })
      .catch(function (err) {
        cols.open.innerHTML = errHtml("Could not load tickets. " + friendlyDbErr(err));
      });
  }

  function openTicket(id) {
    var d = db(), wrap = $("admTicketDetailWrap"), det = $("admTicketDetail");
    if (!d || !wrap || !det) return;
    wrap.style.display = "";
    det.innerHTML = SPINNER;
    d.collection("tickets").doc(id).get()
      .then(function (snap) {
        if (!snap.exists) { det.innerHTML = errHtml("Ticket not found."); return; }
        var t = Object.assign({ id: id }, snap.data() || {});
        var msgs = Array.isArray(t.messages) ? t.messages : [];
        var thread = msgs.map(function (m) {
          return '<div style="border-inline-start:3px solid var(--primary,#6C4CF1);padding:.3rem .6rem;margin-bottom:.4rem">' +
            "<div>" + esc(m.text || "") + "</div>" +
            '<div class="adm-muted">' + esc(m.by || "—") + " · " + esc(relTime(toMillis(m.at))) + "</div></div>";
        }).join("") || '<p class="adm-muted">No replies yet.</p>';
        det.innerHTML =
          "<p><strong>" + esc(t.subject || "(no subject)") + "</strong><br>" +
          '<span class="adm-muted">From: ' + esc(t.name || "—") + " &lt;" + esc(t.email || "—") + "&gt; · " + esc(fmtDate(toMillis(t.createdAt))) + "</span></p>" +
          '<p style="white-space:pre-wrap">' + esc(t.message || "") + "</p>" +
          "<h4>Replies</h4>" + thread +
          '<div class="adm-row"><input id="admTicketReply" class="text-input" type="text" maxlength="1000" placeholder="Write a reply…" style="flex:2;min-width:180px">' +
          '<button class="btn btn-sm btn-primary" type="button" data-ticket-reply="' + esc(id) + '">Reply</button></div>' +
          '<div class="adm-row" style="margin-top:.5rem">' +
          '<input id="admTicketAssign" class="text-input" type="text" maxlength="80" placeholder="Assignee email" value="' + esc(t.assignee || "") + '" style="max-width:200px">' +
          '<button class="btn btn-sm" type="button" data-ticket-assign="' + esc(id) + '">Assign</button>' +
          '<button class="btn btn-sm" type="button" data-ticket-status="' + esc(id) + '|open">📥 Open</button>' +
          '<button class="btn btn-sm" type="button" data-ticket-status="' + esc(id) + '|in_progress">🔄 In progress</button>' +
          '<button class="btn btn-sm btn-primary" type="button" data-ticket-status="' + esc(id) + '|closed">✅ Close</button></div>';
        det.dataset.wired = "";
      })
      .catch(function (err) { det.innerHTML = errHtml("Could not load ticket. " + friendlyDbErr(err)); });
  }

  function wireTickets() {
    var board = $("admTab-tickets");
    if (board && !board.dataset.wired) {
      board.dataset.wired = "1";
      board.addEventListener("click", function (ev) {
        var card = ev.target.closest ? ev.target.closest("[data-ticket-open]") : null;
        if (card) { openTicket(card.getAttribute("data-ticket-open")); return; }
        var t = ev.target.closest ? ev.target.closest("[data-ticket-reply],[data-ticket-assign],[data-ticket-status]") : null;
        if (!t) return;
        var d = db(), F = fv();
        if (!d) { alert("Database unavailable."); return; }
        if (t.hasAttribute("data-ticket-reply")) {
          var id = t.getAttribute("data-ticket-reply");
          var text = (($("admTicketReply") || {}).value || "").trim().slice(0, 1000);
          if (!text) { alert("Write a reply first."); return; }
          var ref = d.collection("tickets").doc(id);
          ref.get().then(function (snap) {
            var msgs = ((snap.exists && snap.data()) || {}).messages || [];
            msgs.push({ by: adminEmail() || "admin", text: text, at: F ? F.serverTimestamp() : new Date() });
            return ref.update({
              messages: msgs,
              status: "in_progress",
              updatedAt: F ? F.serverTimestamp() : new Date()
            });
          }).then(function () {
            audit("ticket_replied", id, text.slice(0, 80));
            openTicket(id); loadTickets();
          }).catch(function (err) { alert("Could not reply: " + friendlyDbErr(err)); });
        } else if (t.hasAttribute("data-ticket-assign")) {
          var aid = t.getAttribute("data-ticket-assign");
          var assignee = (($("admTicketAssign") || {}).value || "").trim().slice(0, 80);
          d.collection("tickets").doc(aid).update({
            assignee: assignee, updatedAt: F ? F.serverTimestamp() : new Date()
          }).then(function () { audit("ticket_assigned", aid, assignee); openTicket(aid); })
            .catch(function (err) { alert("Could not assign: " + friendlyDbErr(err)); });
        } else if (t.hasAttribute("data-ticket-status")) {
          var parts = t.getAttribute("data-ticket-status").split("|");
          d.collection("tickets").doc(parts[0]).update({
            status: parts[1], updatedAt: F ? F.serverTimestamp() : new Date()
          }).then(function () {
            audit("ticket_status", parts[0], parts[1]);
            openTicket(parts[0]); loadTickets();
          }).catch(function (err) { alert("Could not update: " + friendlyDbErr(err)); });
        }
      });
      board.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          var card = ev.target.closest ? ev.target.closest("[data-ticket-open]") : null;
          if (card) { ev.preventDefault(); openTicket(card.getAttribute("data-ticket-open")); }
        }
      });
    }
    var neu = $("admTicketNew");
    if (neu && !neu.dataset.wired) {
      neu.dataset.wired = "1";
      neu.addEventListener("click", function () {
        var wrap = $("admTicketDetailWrap"), det = $("admTicketDetail");
        if (!wrap || !det) return;
        wrap.style.display = "";
        det.innerHTML =
          "<h4>New ticket</h4>" +
          '<div class="adm-row"><input id="admTicketNewSubject" class="text-input" type="text" maxlength="120" placeholder="Subject" style="flex:1;min-width:180px"></div>' +
          '<p><textarea id="admTicketNewMsg" class="text-input" rows="4" style="width:100%" maxlength="5000" placeholder="Message…"></textarea></p>' +
          '<p style="margin-bottom:0"><button class="btn btn-sm btn-primary" type="button" id="admTicketCreateBtn">Create ticket</button></p>';
        var btn = $("admTicketCreateBtn");
        btn.addEventListener("click", function () {
          var d = db(), F = fv();
          if (!d) { alert("Database unavailable."); return; }
          var subject = ($("admTicketNewSubject").value || "").trim().slice(0, 120);
          var message = ($("admTicketNewMsg").value || "").trim().slice(0, 5000);
          if (!subject || !message) { alert("Subject and message are required."); return; }
          d.collection("tickets").add({
            subject: subject, message: message,
            name: "Admin", email: adminEmail(),
            status: "open", messages: [],
            createdAt: F ? F.serverTimestamp() : new Date(),
            updatedAt: F ? F.serverTimestamp() : new Date()
          }).then(function () {
            audit("ticket_created", subject.slice(0, 60), "manual");
            wrap.style.display = "none";
            loadTickets();
          }).catch(function (err) { alert("Could not create ticket: " + friendlyDbErr(err)); });
        });
      });
    }
  }

  /* ================= ITEM 19 — CHANGELOG =================
   * `changelog/{id}`: { version, date, items[], publishAt, published, status,
   * createdAt, createdBy }. Public page changelog.html lists published ones. */

  function loadChangelog() {
    var d = db(), wrap = $("admClList");
    if (!wrap) return;
    if (!d) { wrap.innerHTML = errHtml("Database unavailable."); return; }
    wrap.innerHTML = SPINNER;
    d.collection("changelog").orderBy("date", "desc").limit(50).get()
      .then(function (snap) {
        if (snap.empty) {
          wrap.innerHTML = '<p class="adm-muted">No entries yet.</p>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var c = doc.data() || {};
          var items = Array.isArray(c.items) ? c.items : [];
          var state = c.status === "scheduled"
            ? '<span class="badge badge-amber">⏰ scheduled</span>'
            : c.published ? '<span class="badge" style="background:#1F7A4D;color:#fff">live</span>'
            : '<span class="badge badge-amber">draft</span>';
          rows.push('<div class="adm-toolrow" style="display:block">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">' +
            "<div><strong>" + esc(c.version || "—") + "</strong> " + state + "<br>" +
            '<span class="adm-muted">' + esc(c.date || "") + " · " + items.length + " changes</span></div>" +
            '<button class="btn btn-sm" type="button" data-cl-del="' + esc(doc.id) + '" style="border-color:var(--danger,#C93A3A);color:var(--danger,#C93A3A)">Delete</button></div>' +
            '<ul style="margin:.4rem 0 0;padding-inline-start:1.2rem">' +
            items.slice(0, 5).map(function (it) { return "<li>" + esc(String(it).slice(0, 160)) + "</li>"; }).join("") +
            (items.length > 5 ? "<li class='adm-muted'>…+" + (items.length - 5) + " more</li>" : "") +
            "</ul></div>");
        });
        wrap.innerHTML = rows.join("");
      })
      .catch(function (err) { wrap.innerHTML = errHtml("Could not load changelog. " + friendlyDbErr(err)); });
  }

  function wireChangelog() {
    var save = $("admClSave");
    if (save && !save.dataset.wired) {
      save.dataset.wired = "1";
      save.addEventListener("click", function () {
        var d = db(), F = fv();
        if (!d) { showMsg("admClMsg", "Database unavailable.", false); return; }
        var version = (($("admClVersion") || {}).value || "").trim().slice(0, 20);
        var date = (($("admClDate") || {}).value || "").trim();
        var rawItems = (($("admClItems") || {}).value || "").split("\n").map(function (l) { return l.trim().slice(0, 300); }).filter(Boolean);
        if (!version || !rawItems.length) { showMsg("admClMsg", "Version and at least one change are required.", false); return; }
        var pubAtRaw = (($("admClPublishAt") || {}).value || "").trim();
        var pubAtMs = pubAtRaw ? Date.parse(pubAtRaw) : 0;
        if (pubAtRaw && isNaN(pubAtMs)) { showMsg("admClMsg", "Publish date/time is invalid.", false); return; }
        var published = !!($("admClPublished") || {}).checked;
        var status = (pubAtMs && pubAtMs > Date.now()) ? "scheduled" : (published ? "live" : "draft");
        d.collection("changelog").add({
          version: version, date: date || new Date().toISOString().slice(0, 10),
          items: rawItems,
          publishAt: pubAtMs || null,
          published: published && status !== "scheduled",
          status: status,
          createdAt: F ? F.serverTimestamp() : new Date(),
          createdBy: adminUid()
        }).then(function () {
          audit("changelog_saved", version, status);
          showMsg("admClMsg", "✅ Entry saved (" + status + ").", true);
          loadChangelog();
        }).catch(function (err) { showMsg("admClMsg", "Could not save: " + friendlyDbErr(err), false); });
      });
    }
    var list = $("admClList");
    if (list && !list.dataset.wired) {
      list.dataset.wired = "1";
      list.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-cl-del]") : null;
        if (!b) return;
        if (!confirm("Delete this changelog entry?")) return;
        var d = db();
        if (!d) return;
        d.collection("changelog").doc(b.getAttribute("data-cl-del")).delete()
          .then(function () { audit("changelog_deleted", b.getAttribute("data-cl-del"), ""); loadChangelog(); })
          .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
      });
    }
  }

  /* ================= ITEM 15 — REFERRALS =================
   * Rules in `site_settings/referral`. `referrals` collection rows:
   * { referrerUid, refereeUid, createdAt }. Reward PAYOUT runs in a
   * Cloud Function (TODO — abuse-proof; needs Blaze). */

  function loadReferrals() {
    var d = db();
    if (!d) return;
    d.collection("site_settings").doc("referral").get()
      .then(function (snap) {
        var r = (snap.exists && snap.data()) || {};
        if ($("admRefReward")) $("admRefReward").value = r.rewardCoins != null ? r.rewardCoins : 20;
        if ($("admRefMax")) $("admRefMax").value = r.maxPerUser != null ? r.maxPerUser : 50;
        if ($("admRefMinDays")) $("admRefMinDays").value = r.minAccountDays != null ? r.minAccountDays : 0;
      }).catch(function () { /* keep defaults */ });
    var board = $("admRefBoard");
    if (!board) return;
    board.innerHTML = SPINNER;
    d.collection("referrals").limit(500).get()
      .then(function (snap) {
        var counts = {};
        snap.forEach(function (doc) {
          var r = doc.data() || {};
          var ref = r.referrerUid;
          if (ref) counts[ref] = (counts[ref] || 0) + 1;
        });
        var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 10);
        if (!top.length) {
          board.innerHTML = '<p class="adm-muted">No referrals yet.</p>';
          return;
        }
        return Promise.all(top.map(function (uid) {
          return d.collection("users").doc(uid).get().then(function (us) {
            var u = (us.exists && us.data()) || {};
            return { uid: uid, name: u.displayName || u.name || u.email || uid.slice(0, 8), count: counts[uid] };
          }).catch(function () { return { uid: uid, name: uid.slice(0, 8), count: counts[uid] }; });
        })).then(function (rows) {
          board.innerHTML = '<div class="adm-tablewrap"><table class="adm-table"><thead><tr><th>#</th><th>Referrer</th><th>Referrals</th></tr></thead><tbody>' +
            rows.map(function (r, i) {
              return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.name) + "</td><td><strong>" + r.count + "</strong></td></tr>";
            }).join("") + "</tbody></table></div>";
        });
      })
      .catch(function (err) { board.innerHTML = errHtml("Could not load leaderboard. " + friendlyDbErr(err)); });
  }

  function wireReferrals() {
    var save = $("admRefSave");
    if (save && !save.dataset.wired) {
      save.dataset.wired = "1";
      save.addEventListener("click", function () {
        var d = db(), F = fv();
        if (!d) { showMsg("admRefMsg", "Database unavailable.", false); return; }
        var data = {
          rewardCoins: Math.max(0, parseInt(($("admRefReward") || {}).value, 10) || 0),
          maxPerUser: Math.max(1, parseInt(($("admRefMax") || {}).value, 10) || 50),
          minAccountDays: Math.max(0, parseInt(($("admRefMinDays") || {}).value, 10) || 0),
          updatedBy: adminUid(),
          updatedAt: F ? F.serverTimestamp() : new Date()
        };
        d.collection("site_settings").doc("referral").set(data, { merge: true })
          .then(function () {
            audit("referral_rules_saved", "site_settings/referral", "reward=" + data.rewardCoins);
            showMsg("admRefMsg", "✅ Rules saved. Payouts run in a Cloud Function (TODO).", true);
          })
          .catch(function (err) { showMsg("admRefMsg", "Could not save: " + friendlyDbErr(err), false); });
      });
    }
  }

  /* ================= ITEM 16 — LOYALTY TIERS =================
   * Stored in `site_settings/tiers` as { tiers: [{ name, threshold,
   * perks, color }] }. Recalculation runs in a Cloud Function (TODO). */

  function loadTiers() {
    var d = db(), wrap = $("admTierList");
    if (!wrap) return;
    if (!d) { wrap.innerHTML = errHtml("Database unavailable."); return; }
    wrap.innerHTML = SPINNER;
    d.collection("site_settings").doc("tiers").get()
      .then(function (snap) {
        var tiers = ((snap.exists && snap.data()) || {}).tiers || [];
        if (!tiers.length) {
          wrap.innerHTML = '<p class="adm-muted">No tiers yet — add the first below.</p>';
          return;
        }
        wrap.innerHTML = tiers.map(function (t, i) {
          return '<div class="adm-toolrow">' +
            '<div style="display:flex;align-items:center;gap:.6rem">' +
            '<span class="badge" style="background:' + esc(t.color || "#888") + ';color:#fff">' + esc(t.name || "—") + "</span>" +
            "<div><strong>" + esc(t.name || "—") + "</strong><br>" +
            '<span class="adm-muted">≥ ' + fmtNum(t.threshold) + " tool runs · " + esc(t.perks || "—") + "</span></div></div>" +
            '<button class="btn btn-sm" type="button" data-tier-del="' + i + '">Delete</button></div>';
        }).join("");
      })
      .catch(function (err) { wrap.innerHTML = errHtml("Could not load tiers. " + friendlyDbErr(err)); });
  }

  function wireTiers() {
    var save = $("admTierSave");
    if (save && !save.dataset.wired) {
      save.dataset.wired = "1";
      save.addEventListener("click", function () {
        var d = db(), F = fv();
        if (!d) { showMsg("admTierMsg", "Database unavailable.", false); return; }
        var name = (($("admTierName") || {}).value || "").trim().slice(0, 30);
        if (!name) { showMsg("admTierMsg", "Tier name is required.", false); return; }
        var tier = {
          name: name,
          threshold: Math.max(0, parseInt(($("admTierThreshold") || {}).value, 10) || 0),
          perks: (($("admTierPerks") || {}).value || "").trim().slice(0, 160),
          color: ($("admTierColor") || {}).value || "#888888"
        };
        var ref = d.collection("site_settings").doc("tiers");
        ref.get().then(function (snap) {
          var tiers = ((snap.exists && snap.data()) || {}).tiers || [];
          var idx = -1;
          for (var i = 0; i < tiers.length; i++) {
            if (String(tiers[i].name).toLowerCase() === name.toLowerCase()) { idx = i; break; }
          }
          if (idx >= 0) tiers[idx] = tier; else tiers.push(tier);
          tiers.sort(function (a, b) { return (a.threshold || 0) - (b.threshold || 0); });
          return ref.set({ tiers: tiers, updatedBy: adminUid(), updatedAt: F ? F.serverTimestamp() : new Date() }, { merge: true });
        }).then(function () {
          audit("tier_saved", name, "threshold=" + tier.threshold);
          showMsg("admTierMsg", "✅ Tier saved. Recalculation runs in a Cloud Function (TODO).", true);
          loadTiers();
        }).catch(function (err) { showMsg("admTierMsg", "Could not save: " + friendlyDbErr(err), false); });
      });
    }
    var list = $("admTierList");
    if (list && !list.dataset.wired) {
      list.dataset.wired = "1";
      list.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-tier-del]") : null;
        if (!b) return;
        if (!confirm("Delete this tier?")) return;
        var d = db(), F = fv();
        if (!d) return;
        var idx = parseInt(b.getAttribute("data-tier-del"), 10);
        var ref = d.collection("site_settings").doc("tiers");
        ref.get().then(function (snap) {
          var tiers = ((snap.exists && snap.data()) || {}).tiers || [];
          tiers.splice(idx, 1);
          return ref.set({ tiers: tiers, updatedBy: adminUid(), updatedAt: F ? F.serverTimestamp() : new Date() }, { merge: true });
        }).then(function () { audit("tier_deleted", "index " + idx, ""); loadTiers(); })
          .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
      });
    }
  }

  /* ================= ITEM 9 — DOKI KNOWLEDGE BASE =================
   * `ai_knowledge/{id}`: { q, a, cat, keywords[], createdAt, updatedAt, updatedBy }.
   * window.DKKbSearch(q) is the keyword-overlap hook Doki calls before its
   * built-in answers; returns a Promise resolving to the best match or null. */

  function kbTokens(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(function (w) { return w.length > 2; });
  }

  function searchKb(q) {
    var d = db();
    if (!d) return Promise.resolve(null);
    return d.collection("ai_knowledge").limit(200).get().then(function (snap) {
      var qt = kbTokens(q);
      if (!qt.length) return null;
      var best = null, bestScore = 0;
      snap.forEach(function (doc) {
        var e = doc.data() || {};
        var et = kbTokens((e.q || "") + " " + (e.keywords || []).join(" ") + " " + (e.cat || ""));
        var score = 0;
        qt.forEach(function (w) {
          if (et.indexOf(w) !== -1) score += (e.q || "").toLowerCase().indexOf(w) !== -1 ? 3 : 1;
        });
        // Title-weighted: question match counts triple.
        if (score > bestScore) { bestScore = score; best = Object.assign({ id: doc.id }, e); }
      });
      return bestScore > 0 ? best : null;
    });
  }

  window.DKKbSearch = searchKb;

  function loadKb() {
    var d = db(), wrap = $("admKbList");
    if (!wrap) return;
    if (!d) { wrap.innerHTML = errHtml("Database unavailable."); return; }
    wrap.innerHTML = SPINNER;
    d.collection("ai_knowledge").orderBy("updatedAt", "desc").limit(100).get()
      .then(function (snap) {
        if (snap.empty) {
          wrap.innerHTML = '<p class="adm-muted">No entries yet. Add the first above.</p>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var e = doc.data() || {};
          rows.push('<div class="adm-toolrow" style="display:block">' +
            '<div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start">' +
            "<div><strong>" + esc(e.q || "—") + "</strong><br>" +
            '<span class="adm-muted">' + esc(e.cat || "general") + "</span></div>" +
            '<button class="btn btn-sm" type="button" data-kb-del="' + esc(doc.id) + '" style="border-color:var(--danger,#C93A3A);color:var(--danger,#C93A3A)">Delete</button></div>' +
            '<p style="margin:.3rem 0 0;white-space:pre-wrap">' + esc(String(e.a || "").slice(0, 300)) + "</p></div>");
        });
        wrap.innerHTML = rows.join("");
      })
      .catch(function (err) { wrap.innerHTML = errHtml("Could not load knowledge base. " + friendlyDbErr(err)); });
  }

  function wireKb() {
    var save = $("admKbSave");
    if (save && !save.dataset.wired) {
      save.dataset.wired = "1";
      save.addEventListener("click", function () {
        var d = db(), F = fv();
        if (!d) { showMsg("admKbMsg", "Database unavailable.", false); return; }
        var q = (($("admKbQ") || {}).value || "").trim().slice(0, 160);
        var a = (($("admKbA") || {}).value || "").trim().slice(0, 2000);
        var cat = (($("admKbCat") || {}).value || "").trim().slice(0, 40) || "general";
        if (!q || !a) { showMsg("admKbMsg", "Question and answer are both required.", false); return; }
        d.collection("ai_knowledge").add({
          q: q, a: a, cat: cat,
          keywords: kbTokens(q + " " + cat),
          createdAt: F ? F.serverTimestamp() : new Date(),
          updatedAt: F ? F.serverTimestamp() : new Date(),
          updatedBy: adminUid()
        }).then(function () {
          audit("kb_added", cat, q.slice(0, 60));
          showMsg("admKbMsg", "✅ Entry saved.", true);
          loadKb();
        }).catch(function (err) { showMsg("admKbMsg", "Could not save: " + friendlyDbErr(err), false); });
      });
    }
    var test = $("admKbTestBtn");
    if (test && !test.dataset.wired) {
      test.dataset.wired = "1";
      test.addEventListener("click", function () {
        var out = $("admKbTestOut");
        var q = (($("admKbTestQ") || {}).value || "").trim();
        if (!q) { if (out) out.innerHTML = errHtml("Ask something first."); return; }
        if (out) out.innerHTML = SPINNER;
        searchKb(q).then(function (hit) {
          if (!out) return;
          out.innerHTML = hit
            ? '<div style="border:1px solid var(--border,#e5e7eb);border-radius:.5rem;padding:.6rem .8rem">' +
              "<strong>Matched:</strong> " + esc(hit.q || "") + "<br>" +
              "<div>" + esc(hit.a || "") + "</div></div>"
            : '<p class="adm-muted">No keyword match — Doki would fall back to its built-in answers.</p>';
        }).catch(function (err) {
          if (out) out.innerHTML = errHtml("Search failed: " + friendlyDbErr(err));
        });
      });
    }
    var list = $("admKbList");
    if (list && !list.dataset.wired) {
      list.dataset.wired = "1";
      list.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-kb-del]") : null;
        if (!b) return;
        if (!confirm("Delete this knowledge entry?")) return;
        var d = db();
        if (!d) return;
        d.collection("ai_knowledge").doc(b.getAttribute("data-kb-del")).delete()
          .then(function () { audit("kb_deleted", b.getAttribute("data-kb-del"), ""); loadKb(); })
          .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
      });
    }
  }

  /* ================= ITEM 8 — TRANSLATION STATUS MATRIX =================
   * `i18n_status` docs keyed `{pageId}_{lang}`: { done, updatedBy, updatedAt }. */

  var I18N_PAGES = [
    ["home", "Homepage"], ["all-tools", "All tools"], ["typing", "Typing school"],
    ["tool-image-resizer", "Tool: Image Resizer"], ["tool-image-compressor", "Tool: Image Compressor"],
    ["tool-word-counter", "Tool: Word Counter"], ["tool-qr-generator", "Tool: QR Generator"],
    ["tool-json-formatter", "Tool: JSON Formatter"], ["tool-password-generator", "Tool: Password Generator"],
    ["tool-unit-converter", "Tool: Unit Converter"], ["guides", "Guides index"],
    ["guide-typing", "Guide: typing"], ["guide-images", "Guide: images"], ["blog", "Blog index"],
    ["blog-1", "Blog post 1"], ["blog-2", "Blog post 2"], ["blog-3", "Blog post 3"],
    ["faq", "FAQ"], ["pricing", "Pricing"], ["about", "About"], ["contact", "Contact"]
  ];
  var I18N_LANGS = ["en", "ur", "ar", "es", "fr", "de", "ru", "tr", "hi", "zh"];

  function loadI18n() {
    var d = db(), head = $("admI18nHead"), body = $("admI18nBody");
    if (!head || !body) return;
    if (!d) { body.innerHTML = '<tr><td>' + errHtml("Database unavailable.") + "</td></tr>"; return; }
    head.innerHTML = "<th>Page</th>" + I18N_LANGS.map(function (l) { return "<th>" + esc(l) + "</th>"; }).join("");
    body.innerHTML = '<tr><td colspan="' + (I18N_LANGS.length + 1) + '">' + SPINNER + "</td></tr>";
    d.collection("i18n_status").get()
      .then(function (snap) {
        var done = {};
        snap.forEach(function (doc) {
          var s = doc.data() || {};
          if (s.done) done[doc.id] = true;
        });
        body.innerHTML = I18N_PAGES.map(function (p) {
          var cells = I18N_LANGS.map(function (l) {
            var key = p[0] + "_" + l;
            return '<td style="text-align:center"><button type="button" class="adm-cell' + (done[key] ? " done" : "") +
              '" data-i18n-toggle="' + esc(key) + '" data-done="' + (done[key] ? "1" : "0") +
              '" title="' + esc(p[1] + " / " + l + (done[key] ? " — done" : " — pending")) + '" aria-label="' +
              esc(p[1] + " in " + l + ": " + (done[key] ? "done" : "pending")) + '"></button></td>';
          }).join("");
          return "<tr><td><strong>" + esc(p[1]) + "</strong><br><code class='adm-muted'>" + esc(p[0]) + "</code></td>" + cells + "</tr>";
        }).join("");
      })
      .catch(function (err) {
        body.innerHTML = '<tr><td colspan="' + (I18N_LANGS.length + 1) + '">' + errHtml("Could not load status. " + friendlyDbErr(err)) + "</td></tr>";
      });
  }

  function wireI18n() {
    var body = $("admI18nBody");
    if (body && !body.dataset.wired) {
      body.dataset.wired = "1";
      body.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-i18n-toggle]") : null;
        if (!b) return;
        var d = db(), F = fv();
        if (!d) return;
        var key = b.getAttribute("data-i18n-toggle");
        var next = b.getAttribute("data-done") !== "1";
        d.collection("i18n_status").doc(key).set({
          done: next,
          updatedBy: adminUid(),
          updatedAt: F ? F.serverTimestamp() : new Date()
        }, { merge: true }).then(function () {
          b.classList.toggle("done", next);
          b.setAttribute("data-done", next ? "1" : "0");
          audit("i18n_status", key, next ? "done" : "pending");
        }).catch(function (err) { alert("Could not save: " + friendlyDbErr(err)); });
      });
    }
  }

  /* ================= ITEM 14 — CSV IMPORT =================
   * Coupons: validated + batched writes (admin-allowed). Users: validate
   * only — creating accounts client-side is a job for a Cloud Function. */

  function parseCsv(text) {
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows.filter(function (r) { return r.some(function (f) { return String(f).trim() !== ""; }); });
  }

  function wireImport() {
    var fileInput = $("admCsvFile"), preview = $("admCsvPreview"), report = $("admCsvReport");
    var btn = $("admCsvImport");
    if (!fileInput || !btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    var cachedRows = null;
    fileInput.addEventListener("change", function () {
      cachedRows = null;
      if (preview) preview.innerHTML = "";
      if (report) report.innerHTML = "";
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var rows = parseCsv(String(reader.result || ""));
          cachedRows = rows;
          var target = (($("admCsvTarget") || {}).value || "coupons");
          var cols = target === "coupons"
            ? "code, reward, maxUses, expiry(YYYY-MM-DD)"
            : "email, displayName";
          if (preview) {
            preview.innerHTML = '<p class="adm-muted">Expected columns: <code>' + esc(cols) + '</code> — ' + rows.length + " data rows.</p>" +
              '<div class="adm-tablewrap"><table class="adm-table"><tbody>' +
              rows.slice(0, 5).map(function (r) {
                return "<tr>" + r.slice(0, 6).map(function (c) { return "<td>" + esc(String(c).slice(0, 60)) + "</td>"; }).join("") + "</tr>";
              }).join("") + "</tbody></table></div>" +
              (rows.length > 5 ? '<p class="adm-muted">…showing 5 of ' + rows.length + "</p>" : "");
          }
        } catch (err) {
          if (preview) preview.innerHTML = errHtml("Could not parse CSV.");
        }
      };
      reader.onerror = function () { if (preview) preview.innerHTML = errHtml("Could not read file."); };
      reader.readAsText(f);
    });
    btn.addEventListener("click", function () {
      var d = db(), F = fv();
      if (!d) { if (report) report.innerHTML = errHtml("Database unavailable."); return; }
      if (!cachedRows || !cachedRows.length) { if (report) report.innerHTML = errHtml("Choose a CSV file first."); return; }
      var target = (($("admCsvTarget") || {}).value || "coupons");
      if (report) report.innerHTML = SPINNER;
      // Auto-skip a header row (e.g. "code,reward,maxUses,expiry").
      var rows = cachedRows.slice();
      var first = String((rows[0] || [])[0] || "").trim().toLowerCase();
      if ((target === "coupons" && first === "code") || (target === "users" && first === "email")) {
        rows = rows.slice(1);
      }
      if (!rows.length) { report.innerHTML = errHtml("No data rows found."); return; }
      if (target === "users") {
        // Validate only — honest limit.
        var bad = [];
        rows.forEach(function (r, i) {
          var email = String(r[0] || "").trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad.push(i + 1);
        });
        report.innerHTML = '<div class="card" style="margin-top:var(--sp-3)"><h4>Validation report</h4>' +
          "<p>" + rows.length + " rows checked · " + bad.length + " bad emails.</p>" +
          (bad.length ? "<p>Bad rows: " + esc(bad.slice(0, 20).join(", ")) + (bad.length > 20 ? "…" : "") + "</p>" : "") +
          '<p class="adm-muted">Creating accounts client-side is blocked by Firestore rules — a Cloud Function is required (TODO).</p></div>';
        audit("csv_import_validated", "users", rows.length + " rows");
        return;
      }
      // Coupons: validate then batched writes.
      var ok = [], failed = [];
      rows.forEach(function (r, i) {
        var code = String(r[0] || "").trim().toUpperCase().slice(0, 40);
        var reward = parseInt(r[1], 10), maxUses = parseInt(r[2], 10);
        var expiry = String(r[3] || "").trim();
        if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !(reward > 0) || !(maxUses > 0)) {
          failed.push({ row: i + 1, why: "bad code/reward/maxUses" });
          return;
        }
        ok.push({ code: code, reward: reward, maxUses: maxUses, expiry: expiry });
      });
      var batches = [], batch = d.batch(), n = 0;
      ok.forEach(function (c) {
        var ref = d.collection("coupons").doc(c.code);
        batch.set(ref, {
          code: c.code, reward: c.reward, maxUses: c.maxUses, usedCount: 0,
          expiry: c.expiry || null,
          createdAt: F ? F.serverTimestamp() : new Date(),
          createdBy: adminUid()
        }, { merge: true });
        if (++n >= 400) { batches.push(batch); batch = d.batch(); n = 0; }
      });
      batches.push(batch);
      (function run(i) {
        if (i >= batches.length) {
          report.innerHTML = '<div class="card" style="margin-top:var(--sp-3)"><h4>Import report</h4>' +
            "<p>✅ Imported: <strong>" + ok.length + "</strong> coupons · ❌ Failed validation: <strong>" + failed.length + "</strong></p>" +
            (failed.length ? "<ul>" + failed.slice(0, 20).map(function (f) {
              return "<li>Row " + f.row + ": " + esc(f.why) + "</li>";
            }).join("") + (failed.length > 20 ? "<li>…+" + (failed.length - 20) + " more</li>" : "") + "</ul>" : "") +
            "</div>";
          audit("csv_import_coupons", "coupons", "ok=" + ok.length + " failed=" + failed.length);
          return;
        }
        batches[i].commit().then(function () { run(i + 1); })
          .catch(function (err) {
            report.innerHTML = errHtml("Batch " + (i + 1) + " failed: " + friendlyDbErr(err) + " — earlier batches may have committed.");
          });
      })(0);
    });
  }

  /* ================= ITEM 17 — OG IMAGE GENERATOR =================
   * Canvas 1200×630 per-tool previews. Download PNG → upload to Storage
   * (og/) manually → set URL in page meta. No Storage SDK upload here:
   * honest manual step, noted in the UI. */

  var OG_TOOLS = [
    ["image-resizer", "Image Resizer"], ["image-compressor", "Image Compressor"],
    ["word-counter", "Word Counter"], ["qr-generator", "QR Generator"],
    ["json-formatter", "JSON Formatter"], ["password-generator", "Password Generator"],
    ["unit-converter", "Unit Converter"], ["typing", "Typing School"],
    ["guides", "Guides"], ["blog", "Blog"]
  ];

  function drawOg(canvas, toolName, template) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return false;
    var W = 1200, H = 630;
    var grad;
    if (template === "dark") {
      grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#14121f"); grad.addColorStop(1, "#2b2350");
    } else {
      grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#6C4CF1"); grad.addColorStop(1, "#3a2a8f");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Decorative circles.
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(1050, 90, 190, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(130, 560, 150, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Brand.
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 54px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DoKit", W / 2, 200);
    ctx.font = "400 30px system-ui, sans-serif";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Every tool you'll ever need.", W / 2, 255);
    ctx.globalAlpha = 1;
    // Tool name.
    ctx.font = "800 96px system-ui, sans-serif";
    var label = String(toolName || "DoKit");
    if (ctx.measureText(label).width > 1000) {
      var size = 96;
      while (size > 40 && ctx.measureText(label).width > 1000) { size -= 6; ctx.font = "800 " + size + "px system-ui, sans-serif"; }
    }
    ctx.fillText(label, W / 2, 430);
    ctx.font = "400 28px system-ui, sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText("Free · No sign-up · Runs in your browser", W / 2, 500);
    ctx.globalAlpha = 1;
    return true;
  }

  function wireOg() {
    var sel = $("admOgTool"), canvas = $("admOgCanvas"), dl = $("admOgDownload");
    if (!sel || sel.dataset.wired) return;
    sel.dataset.wired = "1";
    sel.innerHTML = OG_TOOLS.map(function (t) {
      return '<option value="' + esc(t[1]) + '">' + esc(t[1]) + "</option>";
    }).join("");
    function generate(toolName) {
      if (!drawOg(canvas, toolName, (($("admOgTemplate") || {}).value || "gradient"))) {
        alert("Canvas not supported in this browser.");
        return;
      }
      if (dl) {
        try {
          dl.href = canvas.toDataURL("image/png");
          dl.download = "og-" + String(toolName).toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png";
        } catch (e) { /* tainted canvas edge */ }
      }
      audit("og_generated", toolName, (($("admOgTemplate") || {}).value || "gradient"));
    }
    $("admOgGen").addEventListener("click", function () { generate(sel.value); });
    $("admOgGenAll").addEventListener("click", function () {
      if (!confirm("Generate + download PNG for all " + OG_TOOLS.length + " pages? Your browser may ask permission for multiple downloads.")) return;
      var i = 0;
      (function next() {
        if (i >= OG_TOOLS.length) return;
        generate(OG_TOOLS[i][1]);
        if (dl) { try { dl.click(); } catch (e) {} }
        i++;
        setTimeout(next, 700);
      })();
    });
  }

  /* ================= ITEM 13 — SAVED VIEWS =================
   * Per-admin: `admins/{uid}/savedViews/{id}`: { name, tab, query }. */

  function currentUsersQuery() {
    return (($("admUserSearch") || {}).value || "").trim();
  }

  function loadViews() {
    var d = db(), wrap = $("admViewsList");
    if (!wrap) return;
    if (!d) { wrap.innerHTML = errHtml("Database unavailable."); return; }
    wrap.innerHTML = SPINNER;
    d.collection("admins").doc(adminUid()).collection("savedViews").orderBy("createdAt", "desc").get()
      .then(function (snap) {
        if (snap.empty) {
          wrap.innerHTML = '<p class="adm-muted">No saved views yet.</p>';
          return;
        }
        var rows = [];
        snap.forEach(function (doc) {
          var v = doc.data() || {};
          rows.push('<div class="adm-toolrow"><div><strong>' + esc(v.name || "—") + "</strong><br>" +
            '<span class="adm-muted">Tab: ' + esc(v.tab || "—") + (v.query ? " · query: “" + esc(v.query) + "”" : "") + "</span></div>" +
            '<span><button class="btn btn-sm btn-primary" type="button" data-view-apply="' + esc(doc.id) + '">Open</button> ' +
            '<button class="btn btn-sm" type="button" data-view-del="' + esc(doc.id) + '">Delete</button></span></div>');
        });
        wrap.innerHTML = rows.join("");
      })
      .catch(function (err) { wrap.innerHTML = errHtml("Could not load views. " + friendlyDbErr(err)); });
  }

  function wireViews() {
    function saveView(tab) {
      var d = db(), F = fv();
      if (!d) { alert("Database unavailable."); return; }
      var name = prompt("Name this view:", tab + (tab === "users" && currentUsersQuery() ? ' — "' + currentUsersQuery() + '"' : ""));
      if (!name) return;
      d.collection("admins").doc(adminUid()).collection("savedViews").add({
        name: name.trim().slice(0, 60),
        tab: tab,
        query: tab === "users" ? currentUsersQuery() : "",
        createdAt: F ? F.serverTimestamp() : new Date()
      }).then(function () {
        audit("view_saved", tab, name.slice(0, 60));
        loadViews();
      }).catch(function (err) { alert("Could not save view: " + friendlyDbErr(err)); });
    }
    [["admViewSaveUsers", "users"], ["admViewSaveDeposits", "deposits"], ["admViewSaveWithdrawals", "withdrawals"]]
      .forEach(function (pair) {
        var b = $(pair[0]);
        if (b && !b.dataset.wired) {
          b.dataset.wired = "1";
          b.addEventListener("click", function () { saveView(pair[1]); });
        }
      });
    var list = $("admViewsList");
    if (list && !list.dataset.wired) {
      list.dataset.wired = "1";
      list.addEventListener("click", function (ev) {
        var t = ev.target.closest ? ev.target.closest("[data-view-apply],[data-view-del]") : null;
        if (!t) return;
        var d = db();
        if (!d) return;
        var id = t.hasAttribute("data-view-apply") ? t.getAttribute("data-view-apply") : t.getAttribute("data-view-del");
        if (t.hasAttribute("data-view-del")) {
          if (!confirm("Delete this view?")) return;
          d.collection("admins").doc(adminUid()).collection("savedViews").doc(id).delete()
            .then(function () { loadViews(); })
            .catch(function (err) { alert("Could not delete: " + friendlyDbErr(err)); });
          return;
        }
        d.collection("admins").doc(adminUid()).collection("savedViews").doc(id).get()
          .then(function (snap) {
            if (!snap.exists) return;
            var v = snap.data() || {};
            var tabBtn = document.querySelector('.adm-tab[data-tab="' + v.tab + '"]');
            if (tabBtn) tabBtn.click();
            if (v.tab === "users" && v.query) {
              var q = $("admUserSearch");
              if (q) {
                q.value = v.query;
                var evt = new Event("input", { bubbles: true });
                q.dispatchEvent(evt);
              }
            }
          })
          .catch(function (err) { alert("Could not open view: " + friendlyDbErr(err)); });
      });
    }
  }

  /* ================= ITEM 7 — DEPOSIT RECEIPT (print view) ================= */

  function openReceipt(depId) {
    var d = db();
    if (!d) { alert("Database unavailable."); return; }
    d.collection("deposits").doc(depId).get()
      .then(function (snap) {
        if (!snap.exists) { alert("Deposit not found."); return; }
        var dep = snap.data() || {};
        return d.collection("users").doc(dep.userId).get().then(function (us) {
          var u = (us.exists && us.data()) || {};
          var w = window.open("", "_blank", "width=700,height=800");
          if (!w) { alert("Popup blocked — allow popups to print receipts."); return; }
          function row(k, v) {
            return '<tr><td style="padding:8px;border:1px solid #ddd;color:#555">' + esc(k) +
              '</td><td style="padding:8px;border:1px solid #ddd"><strong>' + esc(v) + "</strong></td></tr>";
          }
          var html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>DoKit receipt " +
            esc(depId) + "</title></head><body style='font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;color:#111'>" +
            "<h1 style='margin:0'>DoKit</h1><p style='color:#555;margin-top:4px'>Payment receipt</p><hr>" +
            "<table style='border-collapse:collapse;width:100%'>" +
            row("Receipt ID", depId) +
            row("Date", fmtDate(toMillis(dep.createdAt) || dep.createdAtMs)) +
            row("User", (u.displayName || u.name || "User")) +
            row("Email", u.email || "—") +
            row("Amount", "Rs " + (dep.amount != null ? dep.amount : "—")) +
            row("Method", dep.method || "—") +
            row("Txn ID", dep.txnId || "—") +
            row("Sender", dep.sender || "—") +
            row("Status", dep.status || "—") +
            "</table><hr><p style='color:#555'>Printed by " + esc(adminEmail() || "admin") + " · " +
            new Date().toLocaleString() + "</p>" +
            "<p><button onclick='window.print()' style='padding:10px 24px;font-size:16px;cursor:pointer'>🖨️ Print</button></p>" +
            "</body></html>";
          w.document.write(html);
          w.document.close();
          w.focus();
          audit("receipt_printed", depId, "Rs " + (dep.amount != null ? dep.amount : "?"));
        });
      })
      .catch(function (err) { alert("Could not load deposit: " + friendlyDbErr(err)); });
  }

  /* ================= BOOT ================= */

  var NEW_TABS = {
    alerts: function () { wireAlerts(); loadAlerts(); },
    ab: function () { wireAb(); loadAb(); },
    cohorts: loadCohorts,
    fraud: function () { wireFraud(); loadFraudRules(); loadFraudQueue(); },
    tickets: function () { wireTickets(); loadTickets(); },
    changelog: function () { wireChangelog(); loadChangelog(); },
    referrals: function () { wireReferrals(); loadReferrals(); },
    tiers: function () { wireTiers(); loadTiers(); },
    kb: function () { wireKb(); loadKb(); },
    i18n: function () { wireI18n(); loadI18n(); },
    import: wireImport,
    og: wireOg,
    views: function () { wireViews(); loadViews(); }
  };

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  onReady(function () {
    // Tab-click routing for the 13 new tabs (admin-full.js handles the old ones).
    var bar = $("admTabs");
    if (bar && !bar.dataset.plusWired) {
      bar.dataset.plusWired = "1";
      bar.addEventListener("click", function (ev) {
        var btn = ev.target.closest ? ev.target.closest(".adm-tab") : null;
        if (!btn) return;
        var id = btn.getAttribute("data-tab");
        if (NEW_TABS[id]) {
          try { NEW_TABS[id](); } catch (e) { /* loader guards itself */ }
        }
      });
    }
    // Receipt buttons (item 7) live in deposits rows rendered by admin-full.js.
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-receipt-dep]") : null;
      if (b) openReceipt(b.getAttribute("data-receipt-dep"));
    });

    whenReady(function () {
      startPresence();
      checkScheduled();
    });
  });
})();
