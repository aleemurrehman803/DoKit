/* DoKit — Typing Certificate
 * Profile completion is MANDATORY before the certificate is shown.
 * The mandatory field for now: full name (min 2 characters).
 *
 * Every certificate carries:
 *  - a unique registration number (DK-YYYY-XXXXXX), frozen at first issue
 *  - a QR code encoding the public verification URL
 *  - the issue date + time
 *  - a clickable verification link printed below the certificate
 */
window.Certificate = {
  VERIFY_BASE: "https://aleemurrehman803.github.io/DoKit/typing/verify.html",
  QR_API: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=",
  CERT_KEY_PREFIX: "tm_cert_",
  REG_ALPHABET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",

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

  /* ---------- registration numbers ---------- */
  _rand6: function () {
    var out = "", a = this.REG_ALPHABET, i;
    try {
      var cryptoObj = window.crypto || window.msCrypto;
      var buf = new Uint32Array(6);
      cryptoObj.getRandomValues(buf);
      for (i = 0; i < 6; i++) out += a.charAt(buf[i] % a.length);
    } catch (e) {
      for (i = 0; i < 6; i++) out += a.charAt(Math.floor(Math.random() * a.length));
    }
    return out;
  },
  makeRegNo: function () {
    return "DK-" + new Date().getFullYear() + "-" + this._rand6();
  },
  verifyUrl: function (regNo) {
    return this.VERIFY_BASE + "?reg=" + encodeURIComponent(regNo);
  },

  /* ---------- persistence (per-user, localStorage) ---------- */
  _certKey: function (email) {
    return this.CERT_KEY_PREFIX + String(email || "").toLowerCase();
  },
  loadRecord: function (email) {
    try {
      var raw = window.localStorage.getItem(this._certKey(email));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  saveRecord: function (email, rec) {
    try {
      window.localStorage.setItem(this._certKey(email), JSON.stringify(rec));
    } catch (e) { /* storage full/blocked: cert still renders, just not re-verifiable */ }
  },
  /* Scan every stored certificate — used by the verification page. */
  findByRegNo: function (regNo) {
    var out = null;
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(this.CERT_KEY_PREFIX) === 0) {
          var rec = JSON.parse(window.localStorage.getItem(k));
          if (rec && rec.regNo === regNo) { out = rec; break; }
        }
      }
    } catch (e) { /* ignore */ }
    return out;
  },
  regNoTaken: function (regNo) {
    return !!this.findByRegNo(regNo);
  },

  /* Returns the user's certificate record, creating it on first view.
   * regNo + issuedAt are frozen at first issuance; name/stats refresh. */
  getOrCreateRecord: function (email, name, wpm, acc) {
    var rec = this.loadRecord(email);
    if (!rec || !rec.regNo) {
      var regNo = this.makeRegNo();
      var guard = 0;
      while (this.regNoTaken(regNo) && guard < 10) { regNo = this.makeRegNo(); guard++; }
      rec = { regNo: regNo, name: name, wpm: wpm, acc: acc, issuedAt: Date.now() };
      this.saveRecord(email, rec);
    } else {
      rec.name = name;
      if (typeof wpm === "number" && wpm > (rec.wpm || 0)) rec.wpm = wpm;
      if (typeof acc === "number" && !isNaN(acc) &&
          (typeof rec.acc !== "number" || isNaN(rec.acc) || acc > rec.acc)) {
        rec.acc = acc;
      }
      this.saveRecord(email, rec);
    }
    return rec;
  },

  /* ---------- rendering ---------- */
  t: function (key, fallback) {
    try {
      if (typeof UI !== "undefined" && UI.t) {
        var s = UI.t(key);
        if (typeof s === "string" && s !== key) return s;
      }
    } catch (e) { /* ignore */ }
    return fallback;
  },
  formatIssued: function (ts) {
    var d = new Date(ts), dateStr = "", timeStr = "";
    try {
      dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch (e) { /* ignore */ }
    var issued = this.t("cert_issued", "Issued");
    var at = this.t("cert_at", "at");
    return issued + ": " + dateStr + " " + at + " " + timeStr;
  },

  fill: function () {
    var self = this;
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

    /* Case 1: not logged in -> login prompt only. */
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

    /* Registration record: stable regNo + issue date, refreshing bests. */
    var rec = self.getOrCreateRecord(u.email, name, wpm, bestAcc);
    set("certReg", rec.regNo);
    set("certIssued", self.formatIssued(rec.issuedAt));

    /* QR code encoding the verification URL. */
    var qr = get("certQr");
    if (qr) {
      qr.src = self.QR_API + encodeURIComponent(self.verifyUrl(rec.regNo));
    }

    /* Clickable verification link printed below the certificate. */
    var vlink = get("certVerifyLink");
    if (vlink) {
      var url = self.verifyUrl(rec.regNo);
      vlink.href = url;
      vlink.textContent = url;
    }

    var printBtn = get("printBtn");
    if (printBtn) printBtn.onclick = function () { window.print(); };
  }
};
