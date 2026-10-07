/* DoKit — TypeFight certificate page controller.
 *
 * WHAT THIS DOES:
 *   Two views:
 *   1. ?id=<certId> — shows a single certificate with its QR code
 *      (QR image generated via api.qrserver.com; the verify URL is also
 *      a plain link so the page works even if the QR API is down).
 *   2. No ?id — lists all of the signed-in user's certificates.
 *
 * QR CONTENT: the public verify URL
 *   https://aleemurrehman803.github.io/DoKit/typefight/verify/?id=<certId>
 *
 * Certificates are created by TF.createCertificate() (see js/typefight.js)
 * after a battle win or a 60+ WPM milestone, and REQUIRE a fighter profile.
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("typefight"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var currentUser = null;

  function qrSrc(url) {
    return "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(url);
  }

  function kindLabel(kind) {
    if (kind === "battle_win") return "Battle victory";
    if (kind === "wpm_milestone") return "60+ WPM milestone";
    return "Achievement";
  }

  /* Single certificate view. */
  function showSingle(certId) {
    document.getElementById("certList").style.display = "none";
    var single = document.getElementById("certSingle");
    single.style.display = "";
    TF.verifyCertificate(certId).then(function (res) {
      if (!res.valid && res.reason === "not_found") {
        single.innerHTML = '<div class="card" style="text-align:center"><h3>Not found</h3>' +
          "<p style='color:var(--text-muted)'>This certificate does not exist.</p></div>";
        return;
      }
      var c = res.cert;
      document.getElementById("cName").textContent = c.username;
      document.getElementById("cDetail").textContent =
        kindLabel(c.kind) + " — " + c.wpm + " WPM · " + c.accuracy + "% accuracy";
      document.getElementById("cSerial").textContent = c.serial || "—";
      document.getElementById("cDate").textContent = c.date;
      document.getElementById("cId").textContent = certId;
      var url = TF.verifyUrl(certId);
      document.getElementById("cQr").src = qrSrc(url);
      var link = document.getElementById("cVerifyLink");
      link.href = url;
      // Avatar: look up from viewer's own profile if it's theirs.
      if (currentUser && c.userId === currentUser.uid) {
        TF.getProfile(currentUser.uid).then(function (p) {
          if (p && p.avatar) document.getElementById("cAvatar").textContent = p.avatar;
        }).catch(function () {});
      }
      wirePdfPrint(c, certId);
    }).catch(function () {
      single.innerHTML = '<div class="card" style="text-align:center"><h3>Error</h3>' +
        "<p style='color:var(--text-muted)'>Could not load this certificate.</p></div>";
    });
  }

  /* Wire the Download PDF (A4) and Print buttons for one certificate. */
  function wirePdfPrint(c, certId) {
    var pdfBtn = document.getElementById("pdfBtn");
    var printBtn = document.getElementById("printBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function () { window.print(); });
    }
    if (!pdfBtn) return;
    // Hide the PDF button if jsPDF didn't load (offline / blocked CDN).
    if (!window.jspdf || !window.TFPdf) {
      pdfBtn.style.display = "none";
      return;
    }
    pdfBtn.addEventListener("click", function () {
      pdfBtn.disabled = true;
      pdfBtn.textContent = "⏳ Generating…";
      window.TFPdf.generate(c, certId).then(function () {
        pdfBtn.disabled = false;
        pdfBtn.textContent = "⬇ Download PDF (A4)";
      }).catch(function () {
        pdfBtn.disabled = false;
        pdfBtn.textContent = "⬇ Download PDF (A4)";
        try { window.DKUI && DKUI.toast && DKUI.toast("PDF failed — try Print instead"); } catch (e) {}
      });
    });
  }

  /* List all of the user's certificates. */
  function showList(uid) {
    var loading = document.getElementById("certLoading");
    var items = document.getElementById("certItems");
    var empty = document.getElementById("certEmpty");
    DKF.db().collection("certificates")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc").limit(20).get()
      .then(function (snap) {
        loading.style.display = "none";
        if (snap.empty) { empty.style.display = ""; return; }
        var html = "";
        snap.forEach(function (d) {
          var c = d.data();
          html += '<a class="card" style="display:block;text-decoration:none;color:inherit" ' +
            'href="./certificate.html?id=' + encodeURIComponent(d.id) + '">' +
            "<h3>🏆 " + TF.esc(kindLabel(c.kind)) + "</h3>" +
            "<p style='color:var(--text-muted)'>" + c.wpm + " WPM · " + c.accuracy +
            "% · " + TF.esc(c.date) + "</p>" +
            "<p style='font-family:ui-monospace,monospace;font-weight:700'>" +
            TF.esc(c.serial || "") + "</p></a>";
        });
        items.innerHTML = html;
      })
      .catch(function () {
        loading.innerHTML = "<p style='color:var(--text-muted)'>Could not load certificates.</p>";
      });
  }

  TF.requireAuth("tfGate", "tfApp", location.pathname).then(function (user) {
    currentUser = user;
    if (!user) return;
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    if (id) showSingle(id);
    else showList(user.uid);
  });
});
