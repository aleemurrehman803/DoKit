/* DoKit — Deposit page controller.
 *
 * Flow:
 * 1. On load: fetch admin-configured payment accounts (Easypaisa/JazzCash/USDT)
 *    from Firestore config/payments and display them.
 * 2. User fills the form (amount, method, txn ID, sender, optional screenshot).
 * 3. Screenshot is read as a data URL client-side (max 500KB, images only).
 * 4. DKPayReal.submitDeposit() validates + creates a "pending" deposit doc.
 * 5. History table shows the user's deposits with status badges.
 *
 * Security: all validation happens in payments-real.js (FinSec-backed).
 * This file only handles DOM wiring and user feedback.
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("deposit"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var $ = function (id) { return document.getElementById(id); };
  var form = $("depForm"), accountsBox = $("depAccounts");
  var errEl = $("depErr"), okEl = $("depOk"), submitBtn = $("depSubmit");

  function showErr(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.style.display = "";
    if (okEl) okEl.style.display = "none";
  }
  function showOk(msg) {
    if (!okEl) return;
    okEl.textContent = msg;
    okEl.style.display = "";
    if (errEl) errEl.style.display = "none";
  }
  function hideMsgs() {
    if (errEl) errEl.style.display = "none";
    if (okEl) okEl.style.display = "none";
  }

  /* ---- Step 1: display payment accounts ---- */
  function renderAccounts(cfg) {
    if (!accountsBox) return;
    var e = window.DKPayReal ? DKPayReal.esc : function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
      });
    };
    accountsBox.innerHTML =
      '<div class="grid" style="gap:var(--sp-3)">' +
      '<div class="card" style="margin:0"><h4>💚 Easypaisa</h4>' +
      '<p style="font-size:1.25rem;font-weight:700;user-select:all">' + e(cfg.easypaisa_number) + '</p>' +
      '<p style="color:var(--text-muted);font-size:var(--fs-sm)">Account title: DoKit</p></div>' +
      '<div class="card" style="margin:0"><h4>❤️ JazzCash</h4>' +
      '<p style="font-size:1.25rem;font-weight:700;user-select:all">' + e(cfg.jazzcash_number) + '</p>' +
      '<p style="color:var(--text-muted);font-size:var(--fs-sm)">Account title: DoKit</p></div>' +
      '<div class="card" style="margin:0"><h4>₮ USDT (TRC20)</h4>' +
      '<p style="font-size:0.95rem;font-weight:700;word-break:break-all;user-select:all">' + e(cfg.usdt_address) + '</p>' +
      '<p style="color:var(--text-muted);font-size:var(--fs-sm)">Network: TRC20 only</p></div>' +
      '</div>';
  }

  function loadAccounts() {
    if (!window.DKPayReal) {
      if (accountsBox) accountsBox.innerHTML = '<p style="color:var(--text-muted)">Payments module not loaded.</p>';
      return;
    }
    DKPayReal.getPaymentConfig().then(renderAccounts);
  }

  /* ---- Card (Stripe) hint: card payments use the dedicated checkout page,
        not the manual TID flow below. Toggle the hint + disable Step 2 when
        "stripe" is selected so users can't submit a card "deposit" by mistake. ---- */
  (function wireStripeHint() {
    var methodSel = $("depMethod"), hint = $("stripeHint");
    if (!methodSel || !hint) return;
    var step2Fields = form ? form.querySelectorAll("input, select, button") : [];
    function sync() {
      var isStripe = methodSel.value === "stripe";
      hint.style.display = isStripe ? "" : "none";
      for (var i = 0; i < step2Fields.length; i++) {
        if (step2Fields[i] !== methodSel) step2Fields[i].disabled = isStripe;
      }
    }
    methodSel.addEventListener("change", sync);
    sync();
  })();

  /* ---- Step 2: form submission ---- */
  function readScreenshot(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve(null);
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        return reject(new Error("Screenshot must be PNG, JPEG, or WebP."));
      }
      if (file.size > 500 * 1024) {
        return reject(new Error("Screenshot too large. Maximum 500KB."));
      }
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(new Error("Could not read screenshot.")); };
      r.readAsDataURL(file);
    });
  }

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      hideMsgs();
      if (!window.DKPayReal) return showErr("Payments module not loaded. Please refresh.");

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";

      var shotFile = $("depShot") && $("depShot").files ? $("depShot").files[0] : null;

      readScreenshot(shotFile).then(function (dataUrl) {
        return DKPayReal.submitDeposit({
          amount: $("depAmount").value,
          method: $("depMethod").value,
          txnId: $("depTxn").value,
          sender: $("depSender").value,
          screenshotDataUrl: dataUrl
        });
      }).then(function () {
        showOk("✅ Deposit submitted! Status: Pending verification — admin will verify within 24 hours.");
        form.reset();
        loadHistory();
      }).catch(function (err) {
        showErr(err && err.message ? err.message : "Submission failed. Please try again.");
      }).then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit deposit";
      });
    });
  }

  /* ---- History ---- */
  function statusBadge(s) {
    var map = {
      pending:  '<span class="badge badge-amber">⏳ Pending</span>',
      approved: '<span class="badge badge-green">✅ Approved</span>',
      rejected: '<span class="badge" style="background:#fde2e2;color:#a33">❌ Rejected</span>'
    };
    return map[s] || '<span class="badge">' + String(s) + '</span>';
  }

  function fmtDate(ms) {
    try { return new Date(ms).toLocaleString(); } catch (e) { return "—"; }
  }

  function loadHistory() {
    var box = $("depHistory");
    if (!box || !window.DKPayReal) return;
    DKPayReal.getMyHistory(20).then(function (h) {
      if (!h.deposits.length) {
        box.innerHTML = '<p style="color:var(--text-muted)">No deposits yet.</p>';
        return;
      }
      var e = DKPayReal.esc;
      var html = '<table style="width:100%;font-size:var(--fs-sm)"><thead><tr>' +
        '<th>Date</th><th>Amount</th><th>Method</th><th>Txn ID</th><th>Status</th></tr></thead><tbody>';
      h.deposits.forEach(function (d) {
        html += '<tr><td>' + fmtDate(d.createdAtMs) + '</td>' +
          '<td><strong>Rs ' + e(d.amount) + '</strong></td>' +
          '<td>' + e(d.method) + '</td>' +
          '<td><code>' + e(d.txnId) + '</code></td>' +
          '<td>' + statusBadge(d.status) +
          (d.status === "rejected" && d.rejectReason ? '<br><small>' + e(d.rejectReason) + '</small>' : '') +
          '</td></tr>';
      });
      box.innerHTML = html + '</tbody></table>';
    });
  }

  /* ---- init (wait for Firebase auth) ---- */
  var tries = 0;
  (function init() {
    tries++;
    var ready = window.DKPayReal && window.DKF;
    if (ready || tries > 40) {
      loadAccounts();
      loadHistory();
    } else {
      setTimeout(init, 250);
    }
  })();
});
