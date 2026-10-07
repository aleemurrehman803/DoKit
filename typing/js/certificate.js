/* DoKit — Typing Certificate
 * Profile completion is MANDATORY before the certificate is shown.
 * The mandatory field for now: full name (min 2 characters).
 */
window.Certificate = {
  /* Returns true only when the signed-in user has a valid full name. */
  profileComplete: function () {
    try {
      var u = (typeof DB !== "undefined" && DB.currentUser) ? DB.currentUser() : null;
      var name = (u && u.name) ? String(u.name).trim() : "";
      return name.length >= 2;
    } catch (e) {
      return false;
    }
  },

  fill: function () {
    var get = function (id) { return document.getElementById(id); };
    var set = function (id, v) { var el = get(id); if (el) el.textContent = v; };

    var u = null;
    try {
      u = (typeof DB !== "undefined" && DB.currentUser) ? DB.currentUser() : null;
    } catch (e) {
      u = null;
    }

    var loginBox = get("certLogin");
    var paper = get("certPaper");
    var profileBox = get("certProfile");
    var printWrap = get("printWrap");

    var hide = function (el) { if (el) el.classList.add("hidden"); };
    var show = function (el) { if (el) el.classList.remove("hidden"); };

    /* Case 1: not logged in -> login prompt only (existing behaviour). */
    if (!u) {
      show(loginBox);
      hide(paper);
      hide(profileBox);
      hide(printWrap);
      return;
    }
    hide(loginBox);

    /* Case 2: profile incomplete -> mandatory profile prompt, hide certificate. */
    var name = ((u.name || "") + "").trim();
    if (name.length < 2) {
      hide(paper);
      hide(printWrap);
      show(profileBox);
      if (typeof UI !== "undefined" && UI.applyI18n) UI.applyI18n(profileBox);
      return;
    }

    /* Case 3: profile complete -> show certificate with the real name. */
    hide(profileBox);
    show(paper);
    show(printWrap);
    set("certName", name);

    var wpm = 0;
    try { wpm = (DB.bestWPM ? DB.bestWPM() : 0) || 0; } catch (e) { wpm = 0; }
    set("certWpm", wpm > 0 ? String(wpm) : "—");

    var bestAcc = null;
    try {
      (DB.getProgress().tests || []).forEach(function (t) {
        if (t && t.acc !== undefined && t.acc !== null) {
          var a = Number(t.acc);
          if (!isNaN(a) && (bestAcc === null || a > bestAcc)) bestAcc = a;
        }
      });
    } catch (e) {
      bestAcc = null;
    }
    set("certAcc", bestAcc === null ? "—" : String(Math.round(10 * bestAcc) / 10));

    var dateStr = "—";
    try {
      dateStr = (new Date()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {}
    set("certDate", dateStr);

    var printBtn = get("printBtn");
    if (printBtn) printBtn.onclick = function () { window.print(); };
  }
};
