/* DoKit — TypeFight public certificate verifier.
 * No sign-in needed. Reads ?id=, fetches the certificate doc, recomputes
 * the signature client-side, and shows Valid / Invalid. */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("typefight"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var loading = document.getElementById("verifyLoading");
  var result = document.getElementById("verifyResult");

  function kindLabel(kind) {
    if (kind === "battle_win") return "Battle victory";
    if (kind === "wpm_milestone") return "60+ WPM milestone";
    return "Achievement";
  }

  function check(id, serial) {
    id = (id || "").trim();
    serial = (serial || "").trim().toUpperCase();
    loading.style.display = "";
    result.style.display = "none";
    if (!id && !serial) {
      loading.style.display = "none";
      result.style.display = "";
      result.innerHTML = '<div class="verdict verdict-invalid"><h2>❌ No ID given</h2>' +
        "<p>Enter a certificate ID or registration number above, or scan a certificate QR code.</p></div>";
      return;
    }
    // Wait for DKF (deferred scripts).
    var tries = 0;
    (function waitDk() {
      if (window.TF && window.DKF && DKF.db()) { run(id, serial); return; }
      if (++tries > 40) {
        loading.style.display = "none";
        result.style.display = "";
        result.innerHTML = '<div class="verdict verdict-invalid"><h2>❌ Service unavailable</h2>' +
          "<p>Could not reach the verification service. Try again later.</p></div>";
        return;
      }
      setTimeout(waitDk, 250);
    })();
  }

  function run(id, serial) {
    var p = serial ? TF.verifyCertificateBySerial(serial)
                   : TF.verifyCertificate(id);
    p.then(function (res) {
      loading.style.display = "none";
      result.style.display = "";
      var showId = res.id || id || serial;
      if (res.valid) {
        var c = res.cert;
        result.innerHTML = '<div class="verdict verdict-valid"><div style="font-size:3rem">✅</div>' +
          "<h2>Valid certificate</h2>" +
          "<p><strong>" + TF.esc(c.username) + "</strong></p>" +
          "<p>" + TF.esc(kindLabel(c.kind)) + " — " + c.wpm + " WPM · " + c.accuracy + "% accuracy</p>" +
          "<p style='font-family:ui-monospace,monospace;font-weight:700;font-size:1.1rem'>" + TF.esc(c.serial || "") + "</p>" +
          "<p style='color:var(--text-muted)'>Issued " + TF.esc(c.date) + " · Doc ID <code>" + TF.esc(showId) + "</code></p></div>";
      } else {
        var why = res.reason === "not_found" ? "No certificate found for this ID / registration number."
                : res.reason === "bad_signature" ? "The signature does not match — this certificate may be forged."
                : "Verification failed. Try again later.";
        result.innerHTML = '<div class="verdict verdict-invalid"><div style="font-size:3rem">❌</div>' +
          "<h2>Invalid certificate</h2><p>" + TF.esc(why) + "</p></div>";
      }
    });
  }

  /* Accept either a document ID or a DK-YYYY-NNNNNN serial. */
  function parseInput(raw) {
    var v = String(raw || "").trim();
    if (/^DK-\d{4}-\d+$/i.test(v)) return { id: "", serial: v.toUpperCase() };
    return { id: v, serial: "" };
  }

  document.getElementById("verifyForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var parsed = parseInput(document.getElementById("verifyId").value);
    if (parsed.serial) {
      history.replaceState(null, "", "?serial=" + encodeURIComponent(parsed.serial));
    } else {
      history.replaceState(null, "", "?id=" + encodeURIComponent(parsed.id));
    }
    check(parsed.id, parsed.serial);
  });

  var params = new URLSearchParams(location.search);
  var qid = params.get("id") || "";
  var qserial = params.get("serial") || "";
  if (qserial) document.getElementById("verifyId").value = qserial;
  else if (qid) document.getElementById("verifyId").value = qid;
  check(qid, qserial);
});
