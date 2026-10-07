/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "ak_load": "Could not load API keys. ",
  "ak_rules": "Firestore rules for api_keys are not published yet.",
  "ak_retry": "Please try again.",
  "ak_signin": "Please sign in first.",
  "ak_unnamed": "Unnamed key",
  "ak_created": "Created: ",
  "ak_lastused": "Last used: ",
  "ak_revoke_btn": "Revoke",
  "ak_create": "Could not create key. ",
  "ak_revoke_q": "Revoke this API key? Apps using it will stop working immediately.",
  "ak_revoked": "API key revoked.",
  "ak_revoke_fail": "Could not revoke key. Please try again.",
  "ak_prompt": "Copy your API key now (you will not see it again):",
  "ak_copied": "Copied ✓",
  "ak_copy": "Copy",
  "ak_auth": "Auth not loaded.",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
/* DoKit — API keys page controller (account/api-keys.html).
 *
 * Flow:
 * 1. User signs in. We read Firestore users/{uid}/api_keys (their own keys only).
 * 2. "Generate key": creates a random 32-char secret client-side, stores ONLY its
 *    SHA-256 hash in Firestore (the raw secret is shown ONCE in a modal and then
 *    never stored anywhere — like GitHub personal access tokens).
 * 3. "Revoke": sets revoked=true + revokedAt (we never delete, for audit).
 * 4. "Copy": copies the raw secret to clipboard (only available in the modal).
 *
 * Security notes:
 * - The raw key NEVER leaves the user's browser except over the initial
 *   display. Firestore holds only the hash.
 * - The backend (when live) will hash the presented Bearer token and compare.
 * - Rate limits are enforced server-side per keyHash (documented in api/docs.html).
 *
 * REQUIRED Firestore rules (parent: add via Firebase console):
 *   match /users/{userId}/api_keys/{keyId} {
 *     allow read: if isAdmin() || (request.auth != null && request.auth.uid == userId);
 *     allow create: if request.auth != null && request.auth.uid == userId
 *                   && request.resource.data.keyHash is string
 *                   && request.resource.data.revoked == false;
 *     // Owner may only flip revoked / touch name. keyHash is IMMUTABLE
 *     // after creation: otherwise the owner could swap the stored hash to
 *     // one they control without going through the generate-key flow.
 *     allow update: if isAdmin()
 *                   || (request.auth != null && request.auth.uid == userId
 *                       && request.resource.data.diff(resource.data)
 *                            .affectedKeys().hasOnly(["revoked", "revokedAt", "name"]));
 *     allow delete: if false;   // never delete keys — revoke only, for audit
 *   }
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("api-keys"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var $ = function (id) { return document.getElementById(id); };
  var gate = $("keysGate"), panel = $("keysPanel");
  var listEl = $("keysList"), emptyEl = $("keysEmpty");
  var genBtn = $("genKeyBtn"), nameInput = $("keyName");
  var errEl = $("keysErr"), okEl = $("keysOk");
  var modal = $("keyModal"), modalKey = $("modalKeyValue"), modalClose = $("modalClose");
  var modalCopy = $("modalCopyBtn");

  /* Shared esc (js/dk-utils.js) with local fallback — resolved once at load. */
  var esc = (window.DKUtils && DKUtils.esc) || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function showErr(m) { if (errEl) { errEl.textContent = m; errEl.style.display = ""; } if (okEl) okEl.style.display = "none"; }
  function showOk(m) { if (okEl) { okEl.textContent = m; okEl.style.display = ""; } if (errEl) errEl.style.display = "none"; }
  function hideMsgs() { if (errEl) errEl.style.display = "none"; if (okEl) okEl.style.display = "none"; }

  function getDb() {
    try { return (window.DKF && DKF.db) ? DKF.db() : null; } catch (e) { return null; }
  }
  function getUid() {
    try {
      var a = (window.DKF && DKF.auth && DKF.auth()) || null;
      var u = a && a.currentUser;
      return u && u.uid ? u.uid : null;
    } catch (e) { return null; }
  }

  /**
   * SHA-256 hex digest (async; WebCrypto). Used so we store only key hashes.
   * @param {string} str
   * @returns {Promise<string>} lowercase hex
   */
  function sha256(str) {
    var bytes = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      var arr = new Uint8Array(buf), hex = "";
      for (var i = 0; i < arr.length; i++) hex += ("0" + arr[i].toString(16)).slice(-2);
      return hex;
    });
  }

  /**
   * Generate a random API secret: "dk_" + 32 URL-safe chars.
   * Uses crypto.getRandomValues — never Math.random (predictable).
   * @returns {string}
   */
  function randomSecret() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var rnd = new Uint8Array(32);
    crypto.getRandomValues(rnd);
    var out = "dk_";
    for (var i = 0; i < 32; i++) out += chars[rnd[i] % chars.length];
    return out;
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    try {
      var d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return "—"; }
  }

  function renderKeys(keys) {
    if (!listEl) return;
    if (!keys.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    listEl.innerHTML = keys.map(function (k) {
      var revoked = !!k.revoked;
      var badge = revoked
        ? '<span class="badge" style="background:#fee;color:#a00">Revoked</span>'
        : '<span class="badge badge-green">Active</span>';
      var btn = revoked ? "" :
        '<button class="btn btn-sm" type="button" data-revoke="' + esc(k.id) + '">" + dkT("ak_revoke_btn") + "</button>';
      return '<li class="card" style="margin:0 0 var(--sp-3);display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;justify-content:space-between">' +
        '<div><strong>' + esc(k.name || dkT("ak_unnamed")) + '</strong> ' + badge +
        '<p style="margin:var(--sp-1) 0 0;color:var(--text-muted);font-size:var(--fs-sm)">' +
        dkT("ak_created") + esc(fmtDate(k.createdAt)) + ' &nbsp;•&nbsp; ' + dkT("ak_lastused") + esc(fmtDate(k.lastUsed)) + ' &nbsp;•&nbsp; ' +
        '<code>dk_…' + esc((k.keyPrefix || "")) + '</code></p></div>' +
        '<div>' + btn + '</div></li>';
    }).join("");
    listEl.querySelectorAll("[data-revoke]").forEach(function (b) {
      b.addEventListener("click", function () { revokeKey(b.getAttribute("data-revoke")); });
    });
  }

  var currentUid = null;

  function loadKeys() {
    var db = getDb();
    if (!db || !currentUid) return;
    hideMsgs();
    db.collection("users").doc(currentUid).collection("api_keys")
      .orderBy("createdAt", "desc").get()
      .then(function (snap) {
        var keys = [];
        snap.forEach(function (d) {
          var data = d.data() || {};
          data.id = d.id;
          keys.push(data);
        });
        renderKeys(keys);
      })
      .catch(function (e) {
        showErr(dkT("ak_load") +
          (e && e.code === "permission-denied"
            ? dkT("ak_rules")
            : dkT("ak_retry")));
      });
  }

  function generateKey() {
    hideMsgs();
    var db = getDb();
    if (!db || !currentUid) { showErr(dkT("ak_signin")); return; }
    var name = (nameInput && nameInput.value || "").trim().slice(0, 60) || dkT("ak_unnamed");
    genBtn.disabled = true;

    var secret = randomSecret();
    sha256(secret).then(function (hash) {
      var doc = {
        name: name,
        keyHash: hash,                       // ONLY the hash is stored — never the secret
        keyPrefix: secret.slice(3, 9),       // "dk_…" + 6 chars so the user can identify it
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUsed: null,
        revoked: false,
        revokedAt: null
      };
      return db.collection("users").doc(currentUid).collection("api_keys").add(doc);
    }).then(function () {
      genBtn.disabled = false;
      if (nameInput) nameInput.value = "";
      showKeyModal(secret);   // show raw secret ONCE
      loadKeys();
    }).catch(function (e) {
      genBtn.disabled = false;
      showErr(dkT("ak_create") +
        (e && e.code === "permission-denied" ? dkT("ak_rules") : dkT("ak_retry")));
    });
  }

  function revokeKey(keyId) {
    if (!confirm(dkT("ak_revoke_q"))) return;
    var db = getDb();
    if (!db || !currentUid) return;
    db.collection("users").doc(currentUid).collection("api_keys").doc(keyId).update({
      revoked: true,
      revokedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      showOk(dkT("ak_revoked"));
      loadKeys();
    }).catch(function () { showErr(dkT("ak_revoke_fail")); });
  }

  /* ---- one-time secret modal ---- */
  function showKeyModal(secret) {
    if (!modal || !modalKey) { prompt(dkT("ak_prompt"), secret); return; }
    modalKey.textContent = secret;
    modal.style.display = "flex";
    if (modalCopy) {
      modalCopy.onclick = function () {
        var done = function () { modalCopy.textContent = dkT("ak_copied"); setTimeout(function () { modalCopy.textContent = dkT("ak_copy"); }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(secret).then(done, done);
        } else { done(); }
      };
    }
  }
  function hideKeyModal() { if (modal) modal.style.display = "none"; if (modalKey) modalKey.textContent = ""; }
  if (modalClose) modalClose.addEventListener("click", hideKeyModal);
  if (modal) modal.addEventListener("click", function (e) { if (e.target === modal) hideKeyModal(); });

  if (genBtn) genBtn.addEventListener("click", generateKey);

  /* ---- auth gate ---- */
  function boot() {
    try {
      if (!window.DKF || !DKF.auth) { if (gate) gate.innerHTML = "<p>" + dkT("ak_auth") + "</p>"; return; }
      DKF.onUser(function (user) {
        if (!user) {
          if (gate) gate.style.display = "";
          if (panel) panel.style.display = "none";
          return;
        }
        currentUid = user.uid;
        if (gate) gate.style.display = "none";
        if (panel) panel.style.display = "";
        loadKeys();
      });
    } catch (e) { /* never break the page */ }
  }
  // Firebase scripts use defer; wait a tick for DKF to exist.
  setTimeout(boot, 800);
});
