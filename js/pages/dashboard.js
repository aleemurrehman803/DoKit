/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "db_login_link": "Log in to get your link",
  "db_member": "Member",
  "db_logout": "Log out",
  "db_name": "Please enter your name.",
  "db_pw": "Password must be at least 6 characters.",
  "db_photo_type": "Please choose an image file.",
  "db_photo_size": "Photo must be smaller than 2MB.",
  "db_saving": "Saving…",
  "db_save": "Save Changes",
  "db_relogin": "For security, please log out and log back in, then change your password.",
  "db_save_fail": "Could not save. Please try again.",
  "db_storage": "Photo storage is not ready yet. Details were saved without the photo.",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
/* DoKit — dashboard (Firebase Auth + Firestore profile). Keeps the old
   localStorage fallbacks for guests / offline. */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("dashboard"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }

  /* ---- Your Journey timeline ---- */
  /* Shared esc (js/dk-utils.js) with local fallback — resolved once at load. */
  var esc = (window.DKUtils && DKUtils.esc) || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function renderJourney() {
    var list = document.getElementById("journeyList");
    var empty = document.getElementById("journeyEmpty");
    if (!list || !empty) return;
    var items = (window.Journey && Journey.get()) || [];
    if (!items.length) {
      list.innerHTML = "";
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";
    list.innerHTML = items.map(function (it) {
      var icon = window.Journey ? Journey.iconFor(it.tool) : "🧰";
      var when = window.Journey ? Journey.relTime(it.ts) : "";
      return '<li class="journey-item"><span class="journey-dot" aria-hidden="true">' + icon +
        '</span><p><strong>' + esc(it.tool) + "</strong> — " + esc(it.action) +
        '</p><p class="journey-time">' + esc(when) + "</p></li>";
    }).join("");
  }
  renderJourney();

  /* ---- Cloud sync: merge Firestore history when signed in ---- */
  function doCloudSync() {
    if (!window.DKSync) return;
    try {
      DKSync.sync().then(function () {
        renderJourney(); // re-render with merged data
      }).catch(function () {});
    } catch (e) {}
  }
  // Sync after a short delay (let Firebase auth initialize)
  setTimeout(doCloudSync, 2000);
  // Also sync when page becomes visible again
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) doCloudSync();
  });

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
  var photoEl = document.getElementById("dashPhoto");
  var photoFb = document.getElementById("dashPhotoFallback");
  var bioWrap = document.getElementById("dashBioWrap");
  var bioEl = document.getElementById("dashBio");
  var phoneWrap = document.getElementById("dashPhoneWrap");
  var phoneEl = document.getElementById("dashPhone");
  var editBtn = document.getElementById("editProfileBtn");
  var formCard = document.getElementById("profileFormCard");
  var profileForm = document.getElementById("profileForm");

  function renderPhoto(url, name) {
    if (url) {
      photoEl.src = url;
      photoEl.style.display = "";
      photoFb.style.display = "none";
    } else {
      photoEl.style.display = "none";
      photoFb.style.display = "flex";
      photoFb.textContent = (name && name.charAt(0).toUpperCase()) || "?";
    }
  }
  renderPhoto("", "");

  function setRefLink(uid) {
    // Prefer the canonical link builder (js/referral.js); fall back to the
    // manual construction for guests/offline when it is unavailable.
    var link = null;
    try {
      if (window.DKReferral && typeof DKReferral.myLink === "function") {
        link = DKReferral.myLink();
      }
    } catch (e) { link = null; }
    if (!link) {
      link = uid
        ? ("https://aleemurrehman803.github.io/DoKit/?ref=" + uid)
        : dkT("db_login_link");
    }
    refEl.textContent = link;
    copyBtn.onclick = function () {
      if (link && link.indexOf("http") === 0 && navigator.clipboard) {
        navigator.clipboard.writeText(link).catch(function () {});
      }
    };
  }

  /* Referral count: number of `referrals` docs where referrerUid == this uid
     (exact field name from js/referral.js recordSignup). DKReferral.myReferrals()
     runs exactly that query. Shows "0" gracefully when signed out, when
     Firebase is missing, or when the query is denied by security rules. */
  function loadReferralCount() {
    var el = document.getElementById("dashRefCount");
    if (!el) return;
    el.textContent = "0";
    try {
      if (window.DKReferral && typeof DKReferral.myReferrals === "function") {
        DKReferral.myReferrals().then(function (list) {
          el.textContent = String((list && list.length) || 0);
        }).catch(function () { el.textContent = "0"; });
        return;
      }
    } catch (e) { /* fall through to direct query */ }
    try {
      var d = (window.DKF && typeof DKF.db === "function") ? DKF.db() : null;
      var a = (window.DKF && typeof DKF.auth === "function") ? DKF.auth() : null;
      var u = a && a.currentUser;
      if (d && u && u.uid) {
        d.collection("referrals").where("referrerUid", "==", u.uid).limit(50).get()
          .then(function (snap) { el.textContent = String(snap.size); })
          .catch(function () { el.textContent = "0"; });
      }
    } catch (e2) { el.textContent = "0"; }
  }

  // Guest/local fallbacks (unchanged behavior).
  var acct = lsGet("dk_account", null);
  if (acct) {
    nameEl.textContent = acct.name || acct.email || dkT("db_member");
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
    var displayName = user.displayName || user.email || "Member";
    nameEl.textContent = displayName;
    emailEl.textContent = user.email || "";
    renderPhoto(user.photoURL || "", displayName);
    try {
      sinceEl.textContent = (user.metadata && user.metadata.creationTime)
        ? new Date(user.metadata.creationTime).toLocaleDateString() : "—";
    } catch (e) {}
    authBtn.textContent = dkT("db_logout");
    authBtn.href = "#";
    authBtn.onclick = function (ev) {
      ev.preventDefault();
      DKF.signOut().then(function () { location.reload(); });
    };
    editBtn.style.display = "";
    setRefLink(user.uid);
    loadReferralCount();

    // Live profile from Firestore (coins + any synced stats).
    DKF.userDoc(user.uid).get().then(function (snap) {
      if (!snap.exists) return;
      var d = snap.data() || {};
      if (typeof d.coins === "number") coinsEl.textContent = d.coins;
      if (typeof d.toolsUsed === "number") toolsEl.textContent = d.toolsUsed;
      if (typeof d.imagesProcessed === "number") imagesEl.textContent = d.imagesProcessed;
      if (typeof d.streakDays === "number") streakEl.textContent = d.streakDays + " days";
      if (d.name) { nameEl.textContent = d.name; displayName = d.name; }
      if (d.bio) { bioEl.textContent = d.bio; bioWrap.style.display = ""; }
      if (d.phone) { phoneEl.textContent = d.phone; phoneWrap.style.display = ""; }
      renderPhoto(d.photoURL || user.photoURL || "", displayName);
    }).catch(function () { /* offline: keep local values */ });

    initProfileEditor(user);
  });

  /* ---- Update Profile ---- */
  var editorInit = false;
  function initProfileEditor(user) {
    if (editorInit) return;
    editorInit = true;

    var pfName = document.getElementById("pfName");
    var pfBio = document.getElementById("pfBio");
    var pfPhone = document.getElementById("pfPhone");
    var pfPhoto = document.getElementById("pfPhoto");
    var pfPassword = document.getElementById("pfPassword");
    var saveBtn = document.getElementById("pfSaveBtn");

    function err(id, msg) {
      var el = document.getElementById(id);
      if (el) el.textContent = msg || "";
    }

    editBtn.addEventListener("click", function () {
      // prefill from current values
      pfName.value = user.displayName || "";
      err("err-pfName", ""); err("err-pfPhoto", ""); err("err-pfPassword", ""); err("err-pfGeneral", "");
      DKF.userDoc(user.uid).get().then(function (snap) {
        var d = (snap.exists && snap.data()) || {};
        if (d.name) pfName.value = d.name;
        pfBio.value = d.bio || "";
        pfPhone.value = d.phone || "";
      }).catch(function () {});
      formCard.style.display = "";
      formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("pfCancelBtn").addEventListener("click", function () {
      formCard.style.display = "none";
      profileForm.reset();
    });

    profileForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      err("err-pfName", ""); err("err-pfPhoto", ""); err("err-pfPassword", ""); err("err-pfGeneral", "");
      var ok = true;
      var nm = pfName.value.trim();
      var bio = pfBio.value.trim();
      var phone = pfPhone.value.trim();
      var newPw = pfPassword.value;
      var file = pfPhoto.files && pfPhoto.files[0];

      if (nm.length < 2) { err("err-pfName", dkT("db_name")); ok = false; }
      if (newPw && newPw.length < 6) { err("err-pfPassword", dkT("db_pw")); ok = false; }
      if (file) {
        if (file.type.indexOf("image/") !== 0) { err("err-pfPhoto", dkT("db_photo_type")); ok = false; }
        else if (file.size > 2 * 1024 * 1024) { err("err-pfPhoto", dkT("db_photo_size")); ok = false; }
      }
      if (!ok) return;

      saveBtn.disabled = true;
      saveBtn.textContent = dkT("db_saving");

      function finish(msg) {
        saveBtn.disabled = false;
        saveBtn.textContent = dkT("db_save");
        if (msg) err("err-pfGeneral", msg);
      }

      // 1) photo upload (if chosen)
      var photoPromise = Promise.resolve(null);
      if (file && DKF.storage()) {
        var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        var ref = DKF.storage().ref("profile-photos/" + user.uid + "/photo." + ext);
        photoPromise = ref.put(file).then(function () { return ref.getDownloadURL(); });
      }

      photoPromise.then(function (photoURL) {
        // 2) Auth profile (name + photo)
        var updates = {};
        if (nm && nm !== user.displayName) updates.displayName = nm;
        if (photoURL) updates.photoURL = photoURL;
        var p = Object.keys(updates).length ? user.updateProfile(updates) : Promise.resolve();
        return p.then(function () { return photoURL; });
      }).then(function (photoURL) {
        // 3) Firestore user doc
        var data = { name: nm, bio: bio, phone: phone, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (photoURL) data.photoURL = photoURL;
        return DKF.userDoc(user.uid).set(data, { merge: true });
      }).then(function () {
        // 4) password (optional; may require recent login)
        if (!newPw) return null;
        return user.updatePassword(newPw).catch(function (e) {
          if (e && e.code === "auth/requires-recent-login") {
            throw { friendly: dkT("db_relogin") };
          }
          throw e;
        });
      }).then(function () {
        finish("");
        formCard.style.display = "none";
        profileForm.reset();
        location.reload(); // show fresh profile
      }).catch(function (e) {
        var msg = (e && e.friendly) || (window.DKF && DKF.friendlyError(e)) || dkT("db_save_fail");
        // storage-not-enabled hint
        if (e && e.code === "storage/unknown") msg = dkT("db_storage");
        finish(msg);
      });
    });
  }
});
