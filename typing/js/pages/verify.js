/* DoKit — Typing Certificate Verification page
 * Public page (no login required). Reads ?reg=, looks the registration
 * number up in this browser's stored certificates, and shows VALID / INVALID.
 */
document.addEventListener("DOMContentLoaded", function () {
  UI.init({ active: "verify" });

  var form = document.getElementById("verifyForm");
  var input = document.getElementById("verifyInput") || document.getElementById("regInput");
  var out = document.getElementById("verifyResult");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function normReg(s) {
    return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  }
  function validFormat(s) {
    return /^DK-\d{4}-[A-Z0-9]{6}$/.test(s);
  }
  function t(key, fallback) {
    try {
      var s = UI.t(key);
      if (typeof s === "string" && s !== key) return s;
    } catch (e) { /* ignore */ }
    return fallback;
  }
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return "—";
    }
  }
  function row(k, v, cls) {
    return '<div class="verify-row"><span class="k">' + esc(k) + '</span>' +
      '<span class="v' + (cls ? " " + cls : "") + '">' + esc(v) + "</span></div>";
  }

  function render(regNo) {
    regNo = normReg(regNo);
    if (!regNo) { out.innerHTML = ""; return; }

    var rec = null;
    if (validFormat(regNo)) {
      try { rec = Certificate.findByRegNo(regNo); } catch (e) { rec = null; }
    }

    if (rec) {
      var acc = (typeof rec.acc === "number" && !isNaN(rec.acc))
        ? String(Math.round(10 * rec.acc) / 10) + "%" : "—";
      out.innerHTML =
        '<div class="card verify-card verify-valid">' +
        '<div class="verify-badge" aria-hidden="true">✅</div>' +
        "<h2>" + esc(t("verify_valid", "Certificate is VALID")) + "</h2>" +
        '<div class="verify-details">' +
        row(t("cert_reg_no", "Registration No."), rec.regNo, "verify-reg") +
        row(t("verify_name", "Name"), rec.name) +
        row(t("cert_l_wpm", "Best typing speed"), rec.wpm > 0 ? String(rec.wpm) : "—") +
        row(t("cert_l_acc", "Best accuracy"), acc) +
        row(t("cert_issued", "Issued"), fmtDate(rec.issuedAt)) +
        "</div></div>";
    } else {
      out.innerHTML =
        '<div class="card verify-card verify-invalid">' +
        '<div class="verify-badge" aria-hidden="true">❌</div>' +
        "<h2>" + esc(t("verify_invalid", "Certificate not found")) + "</h2>" +
        '<p class="text-muted">' + esc(t("verify_invalid_msg",
          "No certificate exists with this registration number. Check the number and try again.")) + "</p>" +
        '<div class="verify-details">' +
        row(t("cert_reg_no", "Registration No."), regNo, "verify-reg") +
        "</div></div>";
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    render(input.value);
  });

  /* Auto-verify when opened via the QR code / certificate link (?reg=...). */
  try {
    var q = new URLSearchParams(window.location.search).get("reg");
    if (q) {
      input.value = normReg(q);
      render(q);
    }
  } catch (e) { /* ignore */ }
});
