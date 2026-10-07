/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "wd_avail": " coins available",
  "wd_nomod": "Payments module not loaded. Please refresh.",
  "wd_confirm": "Request withdrawal of Rs {amount} via {method}?\n\nYour coins will be LOCKED immediately and released only if the request is rejected.",
  "wd_submitting": "Submitting…",
  "wd_ok": "✅ Withdrawal requested! Status: Pending — admin will process within 48 hours. Coins are now locked.",
  "wd_fail": "Submission failed. Please try again.",
  "wd_submit": "Request withdrawal",
  "wd_pending": "⏳ Pending",
  "wd_processed": "✅ Processed",
  "wd_rejected": "❌ Rejected",
  "wd_none": "No withdrawals yet.",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
/* DoKit — Withdraw page controller.
 *
 * Flow:
 * 1. On load: show the user's coin balance (total, locked-pending, available).
 * 2. User fills the form (amount, method, destination account).
 * 3. Confirm dialog (acts as a re-confirmation gate before locking coins).
 * 4. DKPayReal.submitWithdrawal() runs an atomic Firestore transaction:
 *    - checks sufficient available balance (total − pending_withdrawal)
 *    - checks 24h cooldown since last withdrawal
 *    - locks coins (increments pending_withdrawal) + creates withdrawal doc
 * 5. History table shows the user's withdrawals with status badges.
 *
 * Security: all validation + the atomic transaction live in payments-real.js.
 * This file only handles DOM wiring and user feedback.
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("withdraw"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var $ = function (id) { return document.getElementById(id); };
  var form = $("wdForm");
  var errEl = $("wdErr"), okEl = $("wdOk"), submitBtn = $("wdSubmit");

  /* HTML-escape: prefer shared DKUtils. */
  /* Shared esc (js/dk-utils.js) with local fallback — resolved once at load. */
  var esc = (window.DKUtils && DKUtils.esc) || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };

  function showErr(msg) {
    if (!errEl) return;
    errEl.textContent = msg; errEl.style.display = "";
    if (okEl) okEl.style.display = "none";
  }
  function showOk(msg) {
    if (!okEl) return;
    okEl.textContent = msg; okEl.style.display = "";
    if (errEl) errEl.style.display = "none";
  }
  function hideMsgs() {
    if (errEl) errEl.style.display = "none";
    if (okEl) okEl.style.display = "none";
  }

  /* ---- balance ---- */
  function loadBalance() {
    if (!window.DKPayReal) return;
    DKPayReal.getBalance().then(function (b) {
      var balEl = $("wdBalance");
      if (balEl) balEl.textContent = b.available + dkT("wd_avail");
      var wrap = $("wdPendingWrap");
      if (wrap) {
        if (b.pending > 0) {
          wrap.hidden = false;
          $("wdPending").textContent = b.pending;
        } else {
          wrap.hidden = true;
        }
      }
    });
  }

  /* ---- form ---- */
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      hideMsgs();
      if (!window.DKPayReal) return showErr(dkT("wd_nomod"));

      var amount = $("wdAmount").value;
      var method = $("wdMethod").value;
      var account = $("wdAccount").value;

      // Re-confirmation gate (user must explicitly confirm locking coins)
      var methodLabel = { easypaisa: "Easypaisa", jazzcash: "JazzCash", usdt: "USDT (TRC20)" }[method] || method;
      if (!window.confirm(
        dkT("wd_confirm").replace("{amount}", amount).replace("{method}", methodLabel)
      )) return;

      submitBtn.disabled = true;
      submitBtn.textContent = dkT("wd_submitting");

      DKPayReal.submitWithdrawal({ amount: amount, method: method, account: account })
        .then(function () {
          showOk(dkT("wd_ok"));
          form.reset();
          loadBalance();
          loadHistory();
        })
        .catch(function (err) {
          showErr(err && err.message ? err.message : dkT("wd_fail"));
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = dkT("wd_submit");
        });
    });
  }

  /* ---- history ---- */
  function statusBadge(s) {
    var map = {
      pending:   '<span class="badge badge-amber">' + dkT("wd_pending") + '</span>',
      processed: '<span class="badge badge-green">' + dkT("wd_processed") + '</span>',
      rejected:  '<span class="badge" style="background:#fde2e2;color:#a33">' + dkT("wd_rejected") + '</span>'
    };
    return map[s] || '<span class="badge">' + esc(String(s)) + '</span>';
  }

  function fmtDate(ms) {
    try { return new Date(ms).toLocaleString(); } catch (e) { return "—"; }
  }

  function loadHistory() {
    var box = $("wdHistory");
    if (!box || !window.DKPayReal) return;
    DKPayReal.getMyHistory(20).then(function (h) {
      if (!h.withdrawals.length) {
        box.innerHTML = '<p style="color:var(--text-muted)">' + dkT("wd_none") + '</p>';
        return;
      }
      var e = DKPayReal.esc;
      var html = '<table style="width:100%;font-size:var(--fs-sm)"><thead><tr>' +
        '<th>Date</th><th>Amount</th><th>Method</th><th>Account</th><th>Status</th></tr></thead><tbody>';
      h.withdrawals.forEach(function (w) {
        html += '<tr><td>' + fmtDate(w.createdAtMs) + '</td>' +
          '<td><strong>Rs ' + e(w.amount) + '</strong></td>' +
          '<td>' + e(w.method) + '</td>' +
          '<td><code>' + e(w.account) + '</code></td>' +
          '<td>' + statusBadge(w.status) +
          (w.status === "rejected" && w.rejectReason ? '<br><small>' + e(w.rejectReason) + '</small>' : '') +
          '</td></tr>';
      });
      box.innerHTML = html + '</tbody></table>';
    });
  }

  /* ---- init ---- */
  var tries = 0;
  (function init() {
    tries++;
    if ((window.DKPayReal && window.DKF) || tries > 40) {
      loadBalance();
      loadHistory();
    } else {
      setTimeout(init, 250);
    }
  })();
});
