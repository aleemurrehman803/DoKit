/* DoKit — TypeFight wallet page controller.
 *
 * WHAT THIS DOES:
 *   - Shows the coin balance (sum of the immutable ledger).
 *   - Verifies the ledger hash chain and shows a verified/tampered badge.
 *   - Renders transaction history (newest first).
 *   - "Claim" buttons for typing-test (+10/hr) and daily streak (+5/day),
 *     with cooldown enforcement via TFWallet.
 *
 * All coin writes go through TF.ledgerAppend -> Firestore
 * users/{uid}/coin_ledger (append-only).
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("typefight"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var currentUser = null;
  var balanceEl = document.getElementById("wBalance");
  var chainBadge = document.getElementById("chainBadge");
  var txnLoading = document.getElementById("txnLoading");
  var txnTable = document.getElementById("txnTable");
  var txnBody = document.getElementById("txnBody");
  var txnEmpty = document.getElementById("txnEmpty");

  function toast(t) { try { window.DKUI && DKUI.toast && DKUI.toast(t); } catch (e) {} }

  /* Refresh balance, chain badge, and history. */
  function refresh(uid) {
    balanceEl.textContent = "…";
    TF.ledgerBalance(uid).then(function (b) {
      balanceEl.textContent = "🪙 " + b;
    }).catch(function () { balanceEl.textContent = "—"; });

    TF.ledgerVerify(uid).then(function (r) {
      chainBadge.style.display = "";
      if (r.ok) {
        chainBadge.className = "chain-badge chain-ok";
        chainBadge.textContent = "⛓ Ledger verified (" + r.checked + " entries)";
      } else {
        chainBadge.className = "chain-badge chain-bad";
        chainBadge.textContent = "⚠ Chain broken at entry " + (r.brokenAt + 1);
      }
    }).catch(function () { chainBadge.style.display = "none"; });

    TF.ledgerHistory(uid, 50).then(function (entries) {
      txnLoading.style.display = "none";
      if (!entries.length) { txnEmpty.style.display = ""; return; }
      txnTable.style.display = "";
      txnBody.innerHTML = entries.map(function (e) {
        var amt = e.amount | 0;
        var cls = amt >= 0 ? "txn-pos" : "txn-neg";
        var sign = amt >= 0 ? "+" : "";
        var label = humanReason(e.reason);
        return "<tr><td>" + TF.esc(TF.relTime(e.clientTs)) + "</td>" +
               "<td>" + TF.esc(label) + "</td>" +
               '<td style="text-align:end" class="' + cls + '">' + sign + amt + "</td></tr>";
      }).join("");
    }).catch(function () {
      txnLoading.innerHTML = "<p style='color:var(--text-muted)'>Could not load history.</p>";
    });
  }

  /* Turn ledger reason codes into friendly labels. */
  function humanReason(reason) {
    var r = String(reason || "");
    if (r.indexOf("earn:typing_test") === 0) return "Typing test complete";
    if (r.indexOf("earn:daily_streak") === 0) return "Daily streak";
    if (r.indexOf("earn:lesson_") === 0) return "Lesson complete";
    if (r.indexOf("battle_") === 0) {
      var m = /place(\d)/.exec(r);
      return "Battle — " + (m ? ("#" + m[1] + " place") : "played");
    }
    return r;
  }

  /* Claim button wiring with cooldown feedback. */
  function wireClaim(btnId, noteId, key) {
    var btn = document.getElementById(btnId);
    var note = document.getElementById(noteId);
    function updateNote() {
      if (!currentUser) return;
      TF.getProfile(currentUser.uid).then(function (p) {
        var c = TFWallet.canEarn(p, key);
        if (c.ok) { note.textContent = "Ready to claim."; btn.disabled = false; }
        else { note.textContent = "Available in " + TFWallet.fmtWait(c.waitMs) + "."; btn.disabled = true; }
      }).catch(function () {});
    }
    btn.addEventListener("click", function () {
      btn.disabled = true;
      TFWallet.claim(currentUser.uid, key).then(function (res) {
        if (res.error === "cooldown") {
          note.textContent = "Available in " + TFWallet.fmtWait(res.waitMs) + ".";
          toast("On cooldown — come back later");
        } else {
          toast("+" + res.coins + " coins!");
          refresh(currentUser.uid);
        }
        updateNote();
      }).catch(function () {
        toast("Claim failed — try again");
        btn.disabled = false;
      });
    });
    updateNote();
  }

  TF.requireAuth("tfGate", "tfApp", location.pathname).then(function (user) {
    currentUser = user;
    if (!user) return;
    refresh(user.uid);
    wireClaim("earnTest", "noteTest", "typing_test");
    wireClaim("earnStreak", "noteStreak", "daily_streak");
  });
});
