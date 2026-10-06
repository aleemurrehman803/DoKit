/* ============================================================
   TypeMaster — ui.js : shared chrome (nav, footer), theme, i18n
   Every page includes: <div id="site-nav"></div> ... <div id="site-foot"></div>
   and calls UI.init({active:'home'}) on DOMContentLoaded.
   ============================================================ */
const UI = {
  strings: I18N.en,
  lang: "en",

  init(opts) {
    opts = opts || {};
    const s = DB.getSettings();
    this.lang = s.lang || "en";
    this.strings = I18N[this.lang] || I18N.en;
    document.documentElement.lang = this.lang === "ur" ? "ur" : "en";
    document.documentElement.dir = this.lang === "ur" ? "rtl" : "ltr";
    document.documentElement.setAttribute("data-theme", s.theme || "light");
    this.renderNav(opts.active);
    this.renderFooter();
    this.applyI18n();
  },

  t(key) {
    const v = this.strings[key];
    return v === undefined ? (I18N.en[key] === undefined ? key : I18N.en[key]) : v;
  },

  applyI18n(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(el => {
      const v = this.t(el.getAttribute("data-i18n"));
      if (typeof v === "string") {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = v;
        else el.textContent = v;
      }
    });
    root.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = this.t(el.getAttribute("data-i18n-ph")); });
  },

  renderNav(active) {
    const user = DB.currentUser();
    const t = k => this.t(k);
    const links = [
      ["index.html", t("nav_home"), "home"],
      ["lessons.html", t("nav_lessons"), "lessons"],
      ["test.html", t("nav_test"), "test"],
      ["progress.html", t("nav_progress"), "progress"]
    ];
    let html = '<div class="container nav-inner">' +
      '<a class="brand" href="index.html"><span class="brand-mark">T</span><span>TypeMaster</span></a>' +
      '<nav class="nav-links">';
    links.forEach(([href, label, id]) => {
      html += `<a href="${href}" class="${active === id ? "active" : ""}">${label}</a>`;
    });
    html += "</nav><div class=\"nav-tools\">";
    html += `<button class="icon-btn" id="langToggle" title="Language">${t("lang_toggle")}</button>`;
    html += `<button class="icon-btn" id="themeToggle" title="Theme">${t("theme_toggle")}</button>`;
    if (user) {
      html += `<a class="icon-btn" href="dashboard.html" style="text-decoration:none">${t("nav_dashboard")}</a>`;
      html += `<a class="icon-btn" href="profile.html" style="text-decoration:none">${t("nav_profile")}</a>`;
      html += `<button class="icon-btn" id="logoutBtn">${t("nav_logout")}</button>`;
    } else {
      html += `<a class="icon-btn" href="login.html" style="text-decoration:none">${t("nav_login")}</a>`;
      html += `<a class="icon-btn" href="signup.html" style="text-decoration:none;border-color:var(--primary);color:var(--primary)">${t("nav_signup")}</a>`;
    }
    html += "</div></div>";
    const nav = document.getElementById("site-nav");
    if (nav) nav.innerHTML = html;

    const lt = document.getElementById("langToggle");
    if (lt) lt.onclick = () => {
      const nl = this.lang === "en" ? "ur" : "en";
      DB.saveSettings({ lang: nl });
      location.reload();
    };
    const tt = document.getElementById("themeToggle");
    if (tt) tt.onclick = () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const nt = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nt);
      DB.saveSettings({ theme: nt });
    };
    const lo = document.getElementById("logoutBtn");
    if (lo) lo.onclick = () => { DB.logout(); UI.toast(this.t("logged_out")); setTimeout(() => location.href = "index.html", 600); };
  },

  renderFooter() {
    const t = k => this.t(k);
    const el = document.getElementById("site-foot");
    if (!el) return;
    el.className = "site-footer";
    el.innerHTML = '<div class="container footer-inner"><div><strong>TypeMaster</strong> — ' + t("footer_tag") + "</div>" +
      '<div><a href="lessons.html">' + t("nav_lessons") + '</a><a href="test.html">' + t("nav_test") + "</a>" +
      "<span>" + t("footer_rights") + "</span></div></div>";
  },

  toast(msg) {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 320); }, 2200);
  },

  stars(n) {
    let s = "";
    for (let i = 1; i <= 3; i++) s += `<span class="${i <= n ? "" : "off"}">★</span>`;
    return `<span class="stars">${s}</span>`;
  },

  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  levelName(level) {
    const names = (this.strings.level_names) || I18N.en.level_names;
    return names[Math.min(level, 7)] || ("Level " + level);
  }
};
