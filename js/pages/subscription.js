/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "sub_signin": "Sign in to get your link",
  "sub_copied": "Copied ✓",
  "sub_copy": "Copy",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
/* DoKit — Subscription page controller (Phase 6 scaffold).
 *
 * What this page does:
 *  - Shows the current plan (always "Free" until payments launch).
 *  - Shows the virtual credit balance (demo only, no cash value).
 *  - Upgrade buttons are DISABLED with "Coming soon" (no checkout exists).
 *  - Billing history is an empty state (nobody has ever been charged).
 *  - Referral link: works today, rewards are virtual coins only.
 *
 * Future developer: when payments launch, read the plan from
 * Firestore subscriptions/{uid} and enable the upgrade buttons via
 * Payments.initiate(). Do not invent a plan from client state.
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("subscription"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var planEl = document.getElementById("subPlan");
  var creditsEl = document.getElementById("subCredits");
  var refLink = document.getElementById("refLink");
  var refCopy = document.getElementById("refCopyBtn");
  var refCount = document.getElementById("refCount");

  /* Payments scaffold: always reports not_configured for now. */
  function refreshPaymentsState() {
    try {
      if (window.Payments && !Payments.isAvailable() && planEl) {
        planEl.textContent = "Free";
      }
    } catch (e) {}
  }

  /* Credit balance (virtual demo credits). */
  function refreshCredits() {
    if (!creditsEl) return;
    try {
      if (window.DKCredits) {
        DKCredits.getBalance().then(function (b) {
          creditsEl.textContent = String(b);
        }).catch(function () { creditsEl.textContent = "0"; });
      }
    } catch (e) { creditsEl.textContent = "0"; }
  }

  /* Referral link + count (works today; rewards are virtual). */
  function refreshReferral() {
    try {
      if (window.DKReferral) {
        var link = DKReferral.myLink();
        if (refLink) refLink.value = link || dkT("sub_signin");
        DKReferral.myReferrals().then(function (list) {
          if (refCount) refCount.textContent = String(list.length);
        }).catch(function () {});
      }
    } catch (e) {}
  }

  if (refCopy) {
    refCopy.addEventListener("click", function () {
      try {
        if (refLink) {
          refLink.select();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(refLink.value);
          } else {
            document.execCommand("copy");
          }
          refCopy.textContent = dkT("sub_copied");
          setTimeout(function () { refCopy.textContent = dkT("sub_copy"); }, 1500);
        }
      } catch (e) {}
    });
  }

  /* Upgrade buttons stay disabled — honest "coming soon". */
  ["upgradeProBtn", "upgradeTeamBtn"].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function (ev) { ev.preventDefault(); });
  });

  refreshPaymentsState();
  refreshCredits();
  refreshReferral();
  /* Re-check after Firebase auth settles (referral link needs a UID). */
  setTimeout(function () { refreshReferral(); refreshCredits(); }, 2500);
});
