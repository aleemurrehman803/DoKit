/* DoKit — dashboard (Firebase Auth + Firestore profile). Keeps the old
   localStorage fallbacks for guests / offline. */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("dashboard"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }

  var nameEl = document.getElementById("dashName");
  var emailEl = document.getElementById("dashEmail");
  var sinceEl = document.getElementById("dashSince");
  var coinsEl = document.getElementById("dashCoins");
  var toolsEl = document.getElementById("dashToolsUsed");
  var imagesEl = document.getElementById("dashImages");
  var streakEl = document.getElementById("dashStreak");
  var refEl = document.getElementById("dashRefLink");
  var copyBtn = document.getElementById("copyRefBtn");
  var authBtn = document.getElementById("dashAuthBtn");

  function setRefLink(uid) {
    var link = uid
      ? ("https://aleemurrehman803.github.io/DoKit/?ref=" + uid)
      : "Log in to get your link";
    refEl.textContent = link;
    copyBtn.onclick = function () {
      if (uid && navigator.clipboard) navigator.clipboard.writeText(link).catch(function () {});
    };
  }

  // Guest/local fallbacks (unchanged behavior).
  var acct = lsGet("dk_account", null);
  if (acct) {
    nameEl.textContent = acct.name || acct.email || "Member";
    emailEl.textContent = acct.email || "";
    sinceEl.textContent = acct.ts ? new Date(acct.ts).toLocaleDateString() : "—";
  }
  var coins = lsGet("dk_coins", 0);
  coinsEl.textContent = Number(coins) || 0;
  var streak = lsGet("dk_streak", null);
  streakEl.textContent = (streak && streak.count ? streak.count : 0) + " days";
  var toolsUsed = lsGet("dk_tools_used", null);
  var toolCount = 0;
  if (toolsUsed && typeof toolsUsed === "object") {
    for (var k in toolsUsed) { if (Object.prototype.hasOwnProperty.call(toolsUsed, k)) toolCount++; }
  } else if (typeof toolsUsed === "number") { toolCount = toolsUsed; }
  toolsEl.textContent = toolCount;
  var localUid = "";
  try { localUid = localStorage.getItem("dk_uid") || ""; } catch (e) {}
  setRefLink(localUid);

  if (!window.DKF) return;

  DKF.onUser(function (user) {
    if (!user) return; // stay on guest view
    nameEl.textContent = user.displayName || user.email || "Member";
    emailEl.textContent = user.email || "";
    try {
      sinceEl.textContent = (user.metadata && user.metadata.creationTime)
        ? new Date(user.metadata.creationTime).toLocaleDateString() : "—";
    } catch (e) {}
    authBtn.textContent = "Log out";
    authBtn.href = "#";
    authBtn.onclick = function (ev) {
      ev.preventDefault();
      DKF.signOut().then(function () { location.reload(); });
    };
    setRefLink(user.uid);

    // Live profile from Firestore (coins + any synced stats).
    DKF.userDoc(user.uid).get().then(function (snap) {
      if (!snap.exists) return;
      var d = snap.data() || {};
      if (typeof d.coins === "number") coinsEl.textContent = d.coins;
      if (typeof d.toolsUsed === "number") toolsEl.textContent = d.toolsUsed;
      if (typeof d.imagesProcessed === "number") imagesEl.textContent = d.imagesProcessed;
      if (typeof d.streakDays === "number") streakEl.textContent = d.streakDays + " days";
      if (d.name) nameEl.textContent = d.name;
    }).catch(function () { /* offline: keep local values */ });
  });
});
