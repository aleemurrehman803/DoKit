/* DoKit — admin panel gate.
   Access requires: (1) signed-in Firebase user, AND (2) a document
   admins/{uid} in Firestore. Create that doc in the Firebase console to
   grant someone admin access. Writes to admins/* are denied by rules. */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("admin"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var gate = document.getElementById("adminGate");
  var panel = document.getElementById("adminPanel");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function deny(msg) {
    panel.style.display = "none";
    gate.style.display = "";
    gate.innerHTML =
      '<div class="card" style="text-align:center;max-width:520px;margin:0 auto">' +
      "<h3>🔒 Restricted area</h3>" +
      "<p style='color:var(--text-muted)'>" + msg + "</p>" +
      '<p><a class="btn btn-primary" href="../account/login.html">Log in</a></p>' +
      "</div>";
  }

  if (!window.DKF || !DKF.db()) { deny("Admin tools are unavailable right now. Please try again later."); return; }

  DKF.onUser(function (user) {
    if (!user) { deny("Please log in with an admin account to view this panel."); return; }
    DKF.db().collection("admins").doc(user.uid).get().then(function (snap) {
      if (snap.exists) {
        gate.style.display = "none";
        panel.style.display = "";
      } else {
        deny("This account (" + esc(user.email || "signed in") + ") is not an admin. " +
             "Ask the site owner to grant access in the Firebase console (Firestore → admins → your UID).");
      }
    }).catch(function () {
      deny("Could not verify admin access. Check your connection and try again.");
    });
  });
});
