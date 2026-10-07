/* DoKit — TypeFight certificate PDF generator (A4, client-side).
 *
 * WHAT THIS DOES:
 *   Renders an official-looking A4 (210x297mm, portrait) certificate PDF
 *   with jsPDF: double border, DoKit branding, holder name, achievement,
 *   WPM/accuracy, serial number, issue date, QR code, and verify URL.
 *
 *   Exposes window.TFPdf.generate(cert, certId) -> Promise<void>
 *     cert: { username, wpm, accuracy, date, kind, serial }
 *
 * DEPENDENCIES: jsPDF UMD from cdnjs (window.jspdf.jsPDF). If jsPDF fails
 * to load, generate() rejects and the caller should hide the button.
 * QR IMAGE: fetched from api.qrserver.com and embedded. If the fetch
 * fails (offline/CORS), the PDF is still generated — with the verify URL
 * printed as text instead of the QR image.
 */
(function () {
  "use strict";

  function kindLabel(kind) {
    if (kind === "battle_win") return "Battle Victory";
    if (kind === "wpm_milestone") return "Typing Excellence — 60+ WPM";
    return "Typing Achievement";
  }

  /**
   * Fetch the QR PNG for a URL and return it as a data URL.
   * Resolves with null on any failure (caller draws without QR).
   */
  function qrDataUrl(url) {
    var qrApi = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=" +
      encodeURIComponent(url);
    return fetch(qrApi).then(function (r) {
      if (!r.ok) throw new Error("qr http " + r.status);
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(new Error("qr read")); };
        fr.readAsDataURL(blob);
      });
    }).catch(function () { return null; });
  }

  /**
   * Generate and download the A4 certificate PDF.
   * @param {object} cert - { username, wpm, accuracy, date, kind, serial }
   * @param {string} certId - Document ID (for the verify URL).
   * @returns {Promise<void>}
   */
  function generate(cert, certId) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      return Promise.reject(new Error("PDF library not loaded"));
    }
    var verifyUrl = "https://aleemurrehman803.github.io/dokit/typefight/verify/?id=" + certId;

    return qrDataUrl(verifyUrl).then(function (qrImg) {
      var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      var W = 210, H = 297;
      var brand = [108, 76, 241];   // DoKit purple #6C4CF1
      var ink = [30, 30, 40];
      var muted = [110, 110, 125];

      /* --- Double border (official document look) --- */
      doc.setDrawColor(brand[0], brand[1], brand[2]);
      doc.setLineWidth(1.6);
      doc.rect(8, 8, W - 16, H - 16);
      doc.setLineWidth(0.5);
      doc.rect(12, 12, W - 24, H - 24);

      var cx = W / 2;
      var y = 34;

      /* --- Brand header --- */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(brand[0], brand[1], brand[2]);
      doc.text("DoKit  •  TypeFight", cx, y, { align: "center" });
      y += 14;

      /* --- Title --- */
      doc.setFontSize(30);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text("Certificate of Achievement", cx, y, { align: "center" });
      y += 10;
      doc.setDrawColor(brand[0], brand[1], brand[2]);
      doc.setLineWidth(0.8);
      doc.line(cx - 45, y, cx + 45, y);
      y += 14;

      /* --- Presented to --- */
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("This certificate is proudly presented to", cx, y, { align: "center" });
      y += 13;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(String(cert.username).slice(0, 30), cx, y, { align: "center" });
      y += 13;

      /* --- Achievement --- */
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("for outstanding performance in", cx, y, { align: "center" });
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(brand[0], brand[1], brand[2]);
      doc.text(kindLabel(cert.kind), cx, y, { align: "center" });
      y += 14;

      /* --- Stats row --- */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(cert.wpm + " WPM", cx - 32, y, { align: "center" });
      doc.text(cert.accuracy + "% accuracy", cx + 32, y, { align: "center" });
      y += 14;

      /* --- Serial number (prominent, monospace) --- */
      doc.setFont("courier", "bold");
      doc.setFontSize(14);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text("Reg. No: " + cert.serial, cx, y, { align: "center" });
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("Issue date: " + cert.date, cx, y, { align: "center" });
      y += 18;

      /* --- QR code + verify URL --- */
      if (qrImg) {
        try { doc.addImage(qrImg, "PNG", cx - 22, y, 44, 44); } catch (e) { qrImg = null; }
      }
      if (qrImg) y += 50;
      doc.setFontSize(10);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("Scan to verify, or enter the registration number at:", cx, y, { align: "center" });
      y += 6;
      doc.setTextColor(brand[0], brand[1], brand[2]);
      doc.text("aleemurrehman803.github.io/dokit/typefight/verify/", cx, y, { align: "center" });
      y += 20;

      /* --- Signature line --- */
      doc.setDrawColor(ink[0], ink[1], ink[2]);
      doc.setLineWidth(0.4);
      doc.line(cx - 40, y, cx + 40, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("DoKit TypeFight", cx, y, { align: "center" });

      /* --- Footer note --- */
      doc.setFontSize(8);
      doc.text("Virtual achievement — no cash value.", cx, H - 20, { align: "center" });

      var safeName = String(cert.username).replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 24) || "fighter";
      doc.save("DoKit-TypeFight-Certificate-" + cert.serial + "-" + safeName + ".pdf");
    });
  }

  window.TFPdf = { generate: generate };
})();
