/* TypeMaster — login page (typing/login.html).
 *
 * CQ-001 (10 Nov 2026): this file used to call
 *   document.getElementById("forgotLink").addEventListener(...)
 * unguarded, but typing/login.html has NO #forgotLink element (its
 * "Forgot password?" link is a plain anchor to ../account/login.html).
 * The null lookup threw at DOMContentLoaded, so the loginForm submit
 * handler on the very next line NEVER bound: submitting the form fell
 * through to a native GET submit (credentials in the URL, no login).
 * Fix: guard every element lookup, so one missing element can never
 * kill the other bindings. Behaviour is otherwise unchanged. */
document.addEventListener("DOMContentLoaded", () => {
  UI.init({ active: "" });

  /* Show (or clear) an inline field error. No-op when the target
   * element is absent, so a missing error slot cannot throw. */
  const showErr = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = key ? UI.t(key) : "";
  };

  /* "Forgot password?" toast — only when the page actually provides
   * a #forgotLink element. On typing/login.html the link is a plain
   * anchor to the account login page, so this simply stays unwired
   * and the anchor keeps its normal navigation. */
  const forgotLink = document.getElementById("forgotLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      UI.toast(UI.t("reset_msg"));
    });
  }

  const form = document.getElementById("loginForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showErr("err-email", null);
      showErr("err-password", null);
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      let invalid = false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showErr("err-email", "err_email");
        invalid = true;
      }
      if (!password) {
        showErr("err-password", "err_wrong_pw");
        invalid = true;
      }
      if (invalid) return;
      const res = await DB.login(email, password);
      if (res.ok) {
        location.href = "dashboard.html";
      } else if (res.error === "nouser") {
        showErr("err-email", "err_no_user");
      } else {
        showErr("err-password", "err_wrong_pw");
      }
    });
  }
});
