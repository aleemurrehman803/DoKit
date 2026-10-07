/* DoKit — TypeFight fighter profile page.
 *
 * WHAT THIS DOES:
 *   Lets a signed-in user create/edit their TypeFight fighter identity:
 *   battle username, avatar (emoji), country, bio. Saved to Firestore at
 *   users/{uid}/typefight_profile/profile.
 *
 * WHY A PROFILE EXISTS:
 *   Certificates print the fighter's username, so a profile is REQUIRED
 *   before any certificate can be generated (enforced on certificate.html).
 *
 * VALIDATION:
 *   Username 3-20 chars, letters/numbers/underscore only. Checked both
 *   here (UX) and should ideally be re-checked server-side in production.
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("typefight"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  /* Avatar choices — a fixed emoji set keeps rendering consistent. */
  var AVATARS = ["🦊","🐼","🦁","🐯","🦄","🐸","🐵","🦉","🐺","🦅","🐙","🦖",
                 "🤖","👾","🎃","⚡","🔥","💎","🚀","🌟","🍀","🎯","🏆","👑"];

  /* Country list — common countries + "Other". Kept short on purpose. */
  var COUNTRIES = ["Pakistan","India","United States","United Kingdom","Canada",
    "Australia","Germany","France","UAE","Saudi Arabia","Bangladesh","Other"];

  var AVATAR_KEY = "avatar", selectedAvatar = AVATARS[0];
  var currentUser = null;

  var avatarGrid = document.getElementById("avatarGrid");
  var countrySel = document.getElementById("pfCountry");
  var form = document.getElementById("profileForm");
  var msg = document.getElementById("formMsg");
  var saveBtn = document.getElementById("saveBtn");
  var bioInput = document.getElementById("pfBio");
  var bioCount = document.getElementById("bioCount");

  /* Build avatar picker buttons. */
  AVATARS.forEach(function (a) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = a;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", "Avatar " + a);
    b.setAttribute("aria-pressed", a === selectedAvatar ? "true" : "false");
    b.addEventListener("click", function () {
      selectedAvatar = a;
      Array.prototype.forEach.call(avatarGrid.children, function (el) {
        el.setAttribute("aria-pressed", el === b ? "true" : "false");
      });
    });
    avatarGrid.appendChild(b);
  });

  /* Build country dropdown. */
  COUNTRIES.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c; o.textContent = c;
    countrySel.appendChild(o);
  });

  bioInput.addEventListener("input", function () {
    bioCount.textContent = bioInput.value.length;
  });

  function setMsg(text, isError) {
    msg.textContent = text;
    msg.style.color = isError ? "var(--danger-text, #C93A3A)" : "var(--success-text, #1F7A4D)";
  }

  function validUsername(u) {
    return /^[A-Za-z0-9_]{3,20}$/.test(u);
  }

  /* Load existing profile (if any) into the form. */
  function loadProfile(uid) {
    TF.getProfile(uid).then(function (p) {
      if (!p) return;
      if (p.username) document.getElementById("pfUsername").value = p.username;
      if (p.bio) { bioInput.value = p.bio; bioCount.textContent = p.bio.length; }
      if (p.country) countrySel.value = p.country;
      if (p.avatar && AVATARS.indexOf(p.avatar) !== -1) {
        selectedAvatar = p.avatar;
        Array.prototype.forEach.call(avatarGrid.children, function (el) {
          el.setAttribute("aria-pressed", el.textContent === selectedAvatar ? "true" : "false");
        });
      }
    }).catch(function () { /* offline or new user — form stays blank */ });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!currentUser) { setMsg("Please sign in first.", true); return; }
    var username = document.getElementById("pfUsername").value.trim();
    var bio = bioInput.value.trim().slice(0, 140);
    var country = countrySel.value;

    if (!validUsername(username)) {
      setMsg("Username must be 3–20 characters: letters, numbers, underscore only.", true);
      return;
    }
    saveBtn.disabled = true;
    setMsg("Saving…", false);
    TF.saveProfile(currentUser.uid, {
      username: username,
      avatar: selectedAvatar,
      bio: bio,
      country: country,
      usernameLower: username.toLowerCase() // for future uniqueness checks
    }).then(function () {
      setMsg("✅ Profile saved! You're ready to battle.", false);
      try { window.DKUI && DKUI.toast && DKUI.toast("Profile saved"); } catch (e) {}
    }).catch(function (err) {
      setMsg("Could not save: " + ((err && err.message) || "network error"), true);
    }).then(function () { saveBtn.disabled = false; });
  });

  /* Auth gate: TypeFight needs a signed-in user. */
  TF.requireAuth("tfGate", "tfApp", location.pathname).then(function (user) {
    currentUser = user;
    if (user) loadProfile(user.uid);
  });
});
