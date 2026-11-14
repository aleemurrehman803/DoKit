/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "tfw_verified": "⛓ Ledger verified ({n} entries)",
  "tfw_broken": "⚠ Chain broken at entry {n}",
  "tfw_hist_fail": "Could not load history.",
  "tfw_r_test": "Typing test complete",
  "tfw_r_streak": "Daily streak",
  "tfw_r_lesson": "Lesson complete",
  "tfw_r_battle": "Battle — {place}",
  "tfw_r_played": "played",
  /* Referral awards carry the invitee UID in the ledger reason
   * ("referral:<uid>") — the label below is what the history shows
   * instead of leaking that UID into the "What" column. */
  "tfw_r_referral": "Referral bonus",
  "tfw_ready": "Ready to claim.",
  "tfw_wait": "Available in {wait}.",
  "tfw_cooldown": "On cooldown — come back later",
  "tfw_claiming": "Claiming…",
  "tfw_coins": "+{n} coins!",
  "tfw_claim_fail": "Claim failed — try again",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
/* WHY the DK_STR fallback (not just the engine): on the canonical
 * directory page the i18n engine (assets/js/i18n.js, loaded
 * dynamically by main.js) arrives AFTER this script's top-level
 * DKI18N.add("en", DK_STR) above ran, so the add is skipped — and
 * the engine's t() returns null for keys absent from every dict.
 * The old dkT returned that null straight through: history labels
 * rendered blank (TF.esc(null) === "") and the claim toast threw
 * (null.replace) — live, Nov 2026: blank "What" column, no toast.
 * The engine's dict is still consulted first (a translated string
 * wins); DK_STR is the fallback for this page's own keys only. */
function dkT(k) {
  try {
    if (window.DKI18N) {
      var v = DKI18N.t(k);
      if (typeof v === "string" && v !== "") return v;
    }
  } catch (e) {}
  return DK_STR[k] || k;
}
/* DoKit — TypeFight wallet page controller.
 *
 * WHAT THIS DOES:
 *   - Shows the coin balance (sum of the immutable ledger).
 *   - Verifies the ledger hash chain and shows a verified/tampered badge.
 *   - Renders transaction history (newest first).
 *   - "Claim" buttons for typing-test (+10/hr) and daily streak (+5/day),
 *     with cooldown enforcement via TFWallet (ledger-aware: see
 *     TFWallet.earnStatus — the ledger, not the profile stamp, is the
 *     source of truth for exactly-once).
 *
 * TWO PAGES share this controller:
 *   - typefight/wallet.html (legacy flat page: tfGate/tfApp, wBalance,
 *     chainBadge, txnLoading/txnTable/txnBody/txnEmpty all present).
 *   - typefight/wallet/index.html (canonical directory page: NO tfGate/
 *     tfApp — account.js owns wf-guest/wf-main instead — and NO
 *     wBalance/chainBadge/txn* elements until the Earn section is
 *     rendered; the directory page HAS wf-coins, updated here too).
 *   Every element lookup below is therefore NULL-SAFE: a missing
 *   element skips that part instead of throwing (an uncaught throw
 *   here would surface as the global "Something went wrong" toast
 *   from js/ui.js's window error handler).
 *
 * All coin writes go through TF.ledgerAppend -> Firestore
 * users/{uid}/coin_ledger (append-only).
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("typefight"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  /* Ledger modules are required for everything below (balance, history,
   * claims). If any failed to load, degrade silently: the directory page
   * still shows the account.js wallet (daily coins), and the flat page
   * shows "—" instead of a stuck "…" — never a global error toast. */
  if (!window.TF || !window.TFWallet) {
    var b0 = document.getElementById("wBalance");
    if (b0) b0.textContent = "—";
    return;
  }

  var currentUser = null;
  /* Last known ledger balance (set by refresh(), updated optimistically
   * on a successful claim). Used for the optimistic balance update. */
  var lastBalance = null;
  var balanceEl = document.getElementById("wBalance");
  var wfCoinsEl = document.getElementById("wf-coins");
  var chainBadge = document.getElementById("chainBadge");
  var txnLoading = document.getElementById("txnLoading");
  var txnTable = document.getElementById("txnTable");
  var txnBody = document.getElementById("txnBody");
  var txnEmpty = document.getElementById("txnEmpty");
  /* Balance-read timeout handle: cleared when the read settles, and
   * re-armed on every refresh() so a slow read can never leave "…". */
  var balanceTimer = null;

  function toast(t) { try { window.DKUI && DKUI.toast && DKUI.toast(t); } catch (e) {} }

  /* Refresh balance, chain badge, and history. Null-safe: any of the
   * elements above may be absent (directory page). */
  function refresh(uid) {
    /* Show "…" only while the balance is still UNKNOWN (first load).
     * Once a balance is known — from a previous read or an optimistic
     * claim update — keep showing it during re-reads: resetting to
     * "…" here would wipe an optimistic "🪙 10" the moment a claim
     * calls refresh() to reconcile (T4: slow ledger reads). */
    if (balanceEl && lastBalance == null) balanceEl.textContent = "…";
    if (balanceTimer) { clearTimeout(balanceTimer); balanceTimer = null; }
    /* Read timeout (~8s): a stalled balance read shows "—" instead of
     * leaving "…" on screen forever. Cleared when the read settles. */
    balanceTimer = setTimeout(function () {
      balanceTimer = null;
      if (balanceEl && balanceEl.textContent === "…") balanceEl.textContent = "—";
    }, 8000);
    TF.ledgerBalance(uid).then(function (b) {
      if (balanceTimer) { clearTimeout(balanceTimer); balanceTimer = null; }
      lastBalance = b;
      if (balanceEl) balanceEl.textContent = "🪙 " + b;
      /* Directory page: keep its "Coins: <b id=wf-coins>" line in sync
       * with the ledger sum (the source of truth; account.js only sets
       * it once from the cached user-doc coins field at load). */
      if (wfCoinsEl) wfCoinsEl.textContent = String(b);
    }).catch(function () {
      if (balanceTimer) { clearTimeout(balanceTimer); balanceTimer = null; }
      if (balanceEl) balanceEl.textContent = "—";
    });

    TF.ledgerVerify(uid).then(function (r) {
      if (!chainBadge) return;
      chainBadge.style.display = "";
      if (r.ok) {
        chainBadge.className = "chain-badge chain-ok";
        chainBadge.textContent = dkT("tfw_verified").replace("{n}", r.checked);
      } else {
        chainBadge.className = "chain-badge chain-bad";
        chainBadge.textContent = dkT("tfw_broken").replace("{n}", (r.brokenAt + 1));
      }
    }).catch(function () { if (chainBadge) chainBadge.style.display = "none"; });

    TF.ledgerHistory(uid, 50).then(function (entries) {
      if (txnLoading) txnLoading.style.display = "none";
      if (!entries.length) { if (txnEmpty) txnEmpty.style.display = ""; return; }
      if (txnTable) txnTable.style.display = "";
      if (txnBody) {
        txnBody.innerHTML = entries.map(function (e) {
          var amt = e.amount | 0;
          var cls = amt >= 0 ? "txn-pos" : "txn-neg";
          var sign = amt >= 0 ? "+" : "";
          var label = humanReason(e.reason);
          return "<tr><td>" + TF.esc(TF.relTime(e.clientTs)) + "</td>" +
                 "<td>" + TF.esc(label) + "</td>" +
                 '<td style="text-align:end" class="' + cls + '">' + sign + amt + "</td></tr>";
        }).join("");
      }
    }).catch(function () {
      if (txnLoading) txnLoading.innerHTML = "<p style='color:var(--text-muted)'>" + dkT("tfw_hist_fail") + "</p>";
    });
  }

  /* Turn ledger reason codes into friendly labels. */
  function humanReason(reason) {
    var r = String(reason || "");
    if (r.indexOf("earn:typing_test") === 0) return dkT("tfw_r_test");
    if (r.indexOf("earn:daily_streak") === 0) return dkT("tfw_r_streak");
    if (r.indexOf("earn:lesson_") === 0) return dkT("tfw_r_lesson");
    if (r.indexOf("battle_") === 0) {
      var m = /place(\d)/.exec(r);
      return dkT("tfw_r_battle").replace("{place}", (m ? ("#" + m[1] + " place") : dkT("tfw_r_played")));
    }
    /* Referral awards store the invitee UID in the reason
     * ("referral:<uid>") — show the label, never the raw UID. */
    if (r.indexOf("referral:") === 0) return dkT("tfw_r_referral");
    return r;
  }

  /* Claim button wiring with cooldown feedback. */
  function wireClaim(btnId, noteId, key) {
    var btn = document.getElementById(btnId);
    var note = document.getElementById(noteId);
    /* Missing button/note (a page variant without this earn card):
     * skip silently — throwing here would toast a global error. */
    if (!btn || !note) return;
    function updateNote() {
      if (!currentUser) return;
      /* Ledger-aware status: shows the wait state even when the
       * profile cooldown stamp is missing (denied stamp write). */
      TFWallet.earnStatus(currentUser.uid, key).then(function (c) {
        /* Ledger could not be checked (read timeout / error): leave
         * the note AND the button exactly as-is — no guess, no
         * disabled-with-no-feedback state. */
        if (c.error) return;
        if (c.ok) { note.textContent = dkT("tfw_ready"); btn.disabled = false; }
        else { note.textContent = dkT("tfw_wait").replace("{wait}", TFWallet.fmtWait(c.waitMs)); btn.disabled = true; }
      }).catch(function () {});
    }
    btn.addEventListener("click", function () {
      if (!currentUser) return;
      btn.disabled = true;
      /* Immediate feedback: a claim takes several sequential
       * Firestore round trips (live: seconds), so say so at once
       * instead of leaving the stale "Ready to claim." note under a
       * disabled button. The previous note is restored if the claim
       * is refused (ledger unavailable) or throws. */
      var prevNote = note.textContent;
      note.textContent = dkT("tfw_claiming");
      TFWallet.claim(currentUser.uid, key).then(function (res) {
        if (res.error === "in_progress") {
          /* Another claim for this key is still running (double-click /
           * double-tap race): say NOTHING and toast nothing — the
           * button stays disabled until updateNote() below re-checks
           * the ledger. (Before this fix the code fell through to the
           * success branch and toasted "+undefined coins!".) */
        } else if (res.error === "unavailable") {
          /* Ledger could not be checked (read timeout / error): the
           * claim was refused, not taken. Surface the existing
           * failure toast and re-enable the button so the user can
           * retry — it must never stay disabled with no feedback.
           * updateNote() below tolerates the timeout too (leaves
           * the note as-is). */
          toast(dkT("tfw_claim_fail"));
          note.textContent = prevNote;
          btn.disabled = false;
        } else if (res.error === "cooldown") {
          note.textContent = dkT("tfw_wait").replace("{wait}", TFWallet.fmtWait(res.waitMs));
          toast(dkT("tfw_cooldown"));
        } else {
          /* OPTIMISTIC UI from the claim result, BEFORE refresh():
           * the ledger append already committed, so show the new
           * balance + history row now instead of waiting for the
           * re-read (live, Nov 2026: after a claim the balance sat
           * at 0 with no toast until a manual reload). refresh()
           * below still reconciles from the server. */
          var newBalance = (lastBalance == null ? 0 : lastBalance) + (res.coins | 0);
          lastBalance = newBalance;
          if (balanceEl) balanceEl.textContent = "🪙 " + newBalance;
          if (wfCoinsEl) wfCoinsEl.textContent = String(newBalance);
          if (txnBody) {
            if (txnLoading) txnLoading.style.display = "none";
            if (txnEmpty) txnEmpty.style.display = "none";
            if (txnTable) txnTable.style.display = "";
            var label = res.entry ? humanReason(res.entry.reason) : humanReason("earn:" + key);
            txnBody.insertAdjacentHTML("afterbegin",
              "<tr><td>" + TF.esc(TF.relTime(Date.now())) + "</td>" +
              "<td>" + TF.esc(label) + "</td>" +
              '<td style="text-align:end" class="txn-pos">+' + (res.coins | 0) + "</td></tr>");
          }
          /* Wait state immediately (no stale "Ready to claim."). */
          var cd = (TFWallet.EARN[key] && TFWallet.EARN[key].cooldownMs) || 60 * 60 * 1000;
          note.textContent = dkT("tfw_wait").replace("{wait}", TFWallet.fmtWait(cd));
          toast(dkT("tfw_coins").replace("{n}", res.coins));
          refresh(currentUser.uid);
        }
        updateNote();
      }).catch(function () {
        toast(dkT("tfw_claim_fail"));
        note.textContent = prevNote;
        btn.disabled = false;
      });
    });
    updateNote();
  }

  /* Wait for the Firebase SDK before the auth gate. The directory page
   * loads the SDKs DYNAMICALLY (account.js injects the compat scripts
   * in order, then initialises the app), so window.firebase may not
   * exist yet when this deferred script runs; the flat page loads them
   * as static tags, so the check passes on the first tick there.
   * Poll every 250ms, up to ~10s; on timeout proceed anyway and let
   * TF.requireAuth show the sign-in gate (it resolves null when the
   * SDK is absent, never rejects).
   * WHY DKF.ready() inside the poll: nothing initialises the app
   * before requireAuth on the flat page, so a bare apps.length check
   * would burn the full 10s there every time. DKF.ready() is
   * idempotent (guarded on firebase.apps.length, same config as DKA)
   * and its App Check activation is try/catch-guarded, as is DKA's —
   * so calling it early cannot break the directory page's own init. */
  function waitForSdk(done) {
    var tries = 0;
    (function poll() {
      tries++;
      try {
        if (window.DKF && window.DKF.ready) window.DKF.ready();
      } catch (e) {}
      if (window.firebase && firebase.apps && firebase.apps.length) { done(); return; }
      if (tries >= 40) { done(); return; }
      setTimeout(poll, 250);
    })();
  }

  waitForSdk(function () {
    /* Gate/app ids stay "tfGate"/"tfApp": they exist only on the flat
     * page (absent on the directory page -> requireAuth no-ops them).
     * Do NOT pass wf-guest/wf-main: account.js owns them via the
     * `hidden` ATTRIBUTE, which requireAuth's style.display toggling
     * would fight (a signed-out guest prompt would stay hidden). */
    try {
      TF.requireAuth("tfGate", "tfApp", location.pathname).then(function (user) {
        currentUser = user;
        if (!user) return;
        refresh(user.uid);
        wireClaim("earnTest", "noteTest", "typing_test");
        wireClaim("earnStreak", "noteStreak", "daily_streak");
      }).catch(function () {});
    } catch (e) {}
  });
});
