/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "sc_pay": "🔒 Pay {amt}",
  "sc_name": "Enter the name as printed on the card.",
  "sc_country": "Please select your country.",
  "sc_zip": "Enter a valid postal / ZIP code.",
  "sc_blocked": "Stripe could not be loaded in this browser (it may be blocked by an extension or firewall).",
  "sc_noserver": "Could not reach our servers. Please check your connection and try again.",
  "sc_noconfig": "Card payments are not configured yet. Our team is setting up Stripe — meanwhile you can deposit with Easypaisa, JazzCash, or USDT.",
  "sc_nostart": "Could not start the secure card form. Please try again.",
  "sc_badnum": "Invalid card number.",
  "sc_badexp": "Invalid expiry date.",
  "sc_ratelimit": "Too many attempts. Please wait a moment and try again.",
  "sc_f_number": "card number",
  "sc_f_expiry": "expiry date",
  "sc_f_cvc": "security code",
  "sc_invalid_x": "Invalid {field}.",
  "sc_required": "This field is required.",
  "sc_fix": "Please fix the highlighted fields and try again.",
  "sc_rejected": "Card was rejected.",
  "sc_nobackend": "Card accepted by Stripe, but our payment server is not connected yet. No charge was made. Card payments are coming soon — please use Easypaisa / JazzCash / USDT for now.",
  "sc_confirmed": "Payment confirmed! Your plan activates once our server verifies Stripe's webhook (usually under a minute).",
  "sc_yourname": "YOUR NAME",
  "sc_failed": "Payment failed.",
  "sc_servererr": "Something went wrong talking to the payment server. No charge was made — please try again.",
  "sc_processing": "Processing…",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
/* DoKit — Stripe checkout page controller (bank-style form).
 *
 * WHAT THIS FILE DOES:
 *   Wires the bank-style card form (name / number / expiry / CVC / country /
 *   ZIP) to Stripe Elements. Card fields are Stripe-hosted iframes — our JS
 *   NEVER sees the PAN, expiry or CVC values. The only card-related signal
 *   we read is the *brand* (visa/mastercard/...) and per-field validity
 *   flags, which Stripe exposes deliberately and safely.
 *
 * LIVE CARD PREVIEW:
 *   The visual card updates as the user types: brand logo appears on
 *   detection, holder name mirrors the text input, and masked dots fill as
 *   digits are entered. Dot-fill is a best-effort keystroke heuristic (Stripe
 *   never reveals digit counts); it resets when the field is emptied and
 *   normalizes when the field validates complete. No card data is logged,
 *   stored, or rendered — only • characters.
 *
 * VALIDATION:
 *   - Name: 2+ letters, letters/spaces/hyphens/apostrophes only.
 *   - Country: must be selected from the dropdown.
 *   - ZIP: 3–10 chars (kept loose — formats vary by country).
 *   - Card fields: Stripe's own real-time validation (invalid number,
 *     past expiry, wrong CVC length) shown under each field.
 *
 * SUBMIT FLOW:
 *   1. Validate our fields + check all three Elements report no error.
 *   2. StripePay.createPaymentMethodSplit() -> paymentMethodId.
 *   3. POST to backend (BACKEND_URL) which creates the PaymentIntent
 *      server-side and returns { clientSecret }.
 *   4. StripePay.confirmPayment(clientSecret) handles 3-D Secure.
 *   5. Coins are credited ONLY by the server-side signed webhook.
 *
 * CURRENT STATE: BACKEND_URL is empty (no backend yet), so step 3 shows an
 * honest "not connected, no charge made" message. Nothing is faked.
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("stripe-checkout"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var $ = function (id) { return document.getElementById(id); };
  var notice = $("stripeNotice"), noticeText = $("stripeNoticeText");
  var grid = $("payGrid"), form = $("cardForm");
  var payErr = $("payErr"), payOk = $("payOk"), payBtn = $("payBtn");

  /* Backend endpoint that creates a PaymentIntent -> { clientSecret }.
   * Empty = not implemented yet. */
  var BACKEND_URL = "";

  /* Fixed plans — amounts are NOT user-editable (prevents tampering). */
  var PLANS = {
    pro:  { label: "Pro plan (monthly)",  usd: 6,  coins: 600 },
    team: { label: "Team plan (monthly)", usd: 29, coins: 3000 }
  };

  /* Country list (ISO-2 codes Stripe expects in billing_details.address). */
  var COUNTRIES = [
    ["PK", "Pakistan"], ["US", "United States"], ["GB", "United Kingdom"],
    ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["CA", "Canada"],
    ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"],
    ["IN", "India"], ["BD", "Bangladesh"], ["MY", "Malaysia"], ["SG", "Singapore"],
    ["TR", "Turkey"], ["QA", "Qatar"], ["KW", "Kuwait"], ["OM", "Oman"],
    ["BH", "Bahrain"], ["EG", "Egypt"], ["ZA", "South Africa"], ["NG", "Nigeria"],
    ["KE", "Kenya"], ["PH", "Philippines"], ["ID", "Indonesia"], ["TH", "Thailand"],
    ["JP", "Japan"], ["KR", "South Korea"], ["CN", "China"], ["NZ", "New Zealand"],
    ["IE", "Ireland"], ["ES", "Spain"], ["IT", "Italy"], ["SE", "Sweden"],
    ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"], ["CH", "Switzerland"],
    ["AT", "Austria"], ["BE", "Belgium"], ["PT", "Portugal"], ["GR", "Greece"],
    ["PL", "Poland"], ["RO", "Romania"], ["UA", "Ukraine"], ["BR", "Brazil"],
    ["MX", "Mexico"], ["AR", "Argentina"]
  ];

  /* ---------- small helpers ---------- */
  function showNotice(msg) {
    if (noticeText) noticeText.textContent = msg;
    if (notice) notice.style.display = "";
    if (grid) grid.style.display = "none";
  }
  function showGrid() {
    if (notice) notice.style.display = "none";
    if (grid) grid.style.display = "";
  }
  function setPayErr(msg) {
    if (payErr) { payErr.textContent = msg || ""; payErr.style.display = msg ? "" : "none"; }
    if (msg && payOk) payOk.style.display = "none";
  }
  function setPayOk(msg) {
    if (payOk) { payOk.textContent = msg || ""; payOk.style.display = msg ? "" : "none"; }
    if (msg && payErr) payErr.style.display = "none";
  }
  function setBusy(busy) {
    if (payBtn) {
      payBtn.disabled = busy;
      payBtn.textContent = busy ? dkT("sc_processing") : dkT("sc_pay").replace("{amt}", fmtUsd(selectedPlan().plan.usd));
    }
  }
  function fmtUsd(n) { return "$" + Number(n).toFixed(2); }
  function selectedPlan() {
    var c = document.querySelector('input[name="plan"]:checked');
    var id = (c && PLANS[c.value]) ? c.value : "pro";
    return { id: id, plan: PLANS[id] };
  }
  function fieldError(inputId, msg) {
    var err = $("e-" + inputId), wrap = $("f-" + inputId);
    if (err) err.textContent = msg || "";
    if (wrap) wrap.classList.toggle("invalid", !!msg);
  }
  function db() {
    try { return (window.DKF && DKF.db) ? DKF.db() : null; } catch (e) { return null; }
  }

  /* ---------- country dropdown ---------- */
  function fillCountries() {
    var sel = $("ccCountry");
    if (!sel) return;
    COUNTRIES.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c[0]; o.textContent = c[1];
      sel.appendChild(o);
    });
  }

  /* ---------- live card preview ---------- */
  var pvBrand = null, pvNumber = null, pvName = null, pvExpiry = null, brandBadge = null;
  var digitCount = 0; // best-effort keystroke heuristic; Stripe never reveals the count

  function brandBadgeHTML(brand) {
    // Renders a small brand mark from Stripe's brand string (no card data).
    if (brand === "visa") return '<span style="color:#fff;font-style:italic;font-weight:800">VISA</span>';
    if (brand === "mastercard") {
      return '<span class="mc-circles"><i></i><i></i></span>';
    }
    if (brand === "amex") return '<span style="color:#fff;font-weight:800">AMEX</span>';
    var info = window.StripePay ? window.StripePay.brandInfo(brand) : null;
    if (info && info.label) {
      return '<span style="color:#fff;font-weight:700;font-size:0.8rem">' + info.label + "</span>";
    }
    return "";
  }

  function renderDots() {
    // Groups of 4 (Amex: 4-6-5). Pure • characters — never real digits.
    if (!pvNumber) return;
    var isAmex = currentBrand === "amex";
    var total = isAmex ? 15 : 16;
    var n = Math.min(digitCount, total);
    var groups = isAmex ? [4, 6, 5] : [4, 4, 4, 4];
    var out = [];
    groups.forEach(function (g) {
      var s = "";
      for (var i = 0; i < g; i++) s += "•";
      out.push(s);
    });
    pvNumber.textContent = out.join("  ");
    pvNumber.style.opacity = n === 0 ? 0.55 : 1;
  }

  var currentBrand = "unknown";

  function onBrand(brand) {
    currentBrand = brand || "unknown";
    var html = brandBadgeHTML(currentBrand);
    if (brandBadge) brandBadge.innerHTML = html;
    if (pvBrand) pvBrand.innerHTML = html;
    // Amex has 15 digits: clamp the heuristic.
    if (currentBrand === "amex" && digitCount > 15) digitCount = 15;
    renderDots();
  }

  function wirePreview(nameInput) {
    pvBrand = $("pvBrand"); pvNumber = $("pvNumber");
    pvName = $("pvName"); pvExpiry = $("pvExpiry");
    brandBadge = $("brandBadge");
    if (nameInput && pvName) {
      var syncName = function () {
        var v = (nameInput.value || "").trim();
        pvName.textContent = v ? v.toUpperCase().slice(0, 22) : "YOUR NAME";
      };
      nameInput.addEventListener("input", syncName);
      syncName();
    }
    renderDots();
  }

  /* ---------- per-field validation (our own fields) ---------- */
  function validateOwnFields() {
    var ok = true;
    var name = ($("ccName") || {}).value || "";
    if (!/^[A-Za-z][A-Za-z .'\-]{1,63}$/.test(name.trim())) {
      fieldError("name", dkT("sc_name"));
      ok = false;
    } else fieldError("name", "");

    if (!$("ccCountry") || !$("ccCountry").value) {
      fieldError("country", dkT("sc_country"));
      ok = false;
    } else fieldError("country", "");

    var zip = (($("ccZip") || {}).value || "").trim();
    if (zip.length < 3 || zip.length > 16) {
      fieldError("zip", dkT("sc_zip"));
      ok = false;
    } else fieldError("zip", "");
    return ok;
  }

  /* ---------- boot ---------- */
  var split = null;
  var stripeFieldState = { number: {}, expiry: {}, cvc: {} };

  function boot() {
    fillCountries();
    wirePreview($("ccName"));
    if (!window.StripePay) {
      showNotice(dkT("sc_blocked"));
      return;
    }
    var d = db();
    if (!d) {
      showNotice(dkT("sc_noserver"));
      return;
    }
    d.collection("config").doc("payments").get().then(function (snap) {
      var pk = snap.exists ? ((snap.data() || {}).stripe_pk || "") : "";
      if (!pk) {
        showNotice(dkT("sc_noconfig"));
        return;
      }
      if (!window.StripePay.init(pk)) {
        showNotice("Stripe.js was blocked (ad blocker or network). Please allow js.stripe.com or use another payment method.");
        return;
      }
      split = window.StripePay.createSplitCardElements(
        { number: "card-number", expiry: "card-expiry", cvc: "card-cvc" }
      );
      if (!split) {
        showNotice(dkT("sc_nostart"));
        return;
      }
      // Real-time validation + brand detection + preview hooks.
      split.cardNumber.on("change", function (ev) {
        stripeFieldState.number = ev;
        fieldError("number", ev.error ? (ev.error.message || dkT("sc_badnum")) : "");
        onBrand(ev.brand);
        if (ev.empty) { digitCount = 0; renderDots(); }
        else if (!ev.complete) { digitCount = Math.min(digitCount + 1, currentBrand === "amex" ? 15 : 16); renderDots(); }
        else { digitCount = currentBrand === "amex" ? 15 : 16; renderDots(); }
      });
      split.cardExpiry.on("change", function (ev) {
        stripeFieldState.expiry = ev;
        fieldError("expiry", ev.error ? (ev.error.message || dkT("sc_badexp")) : "");
        if (pvExpiry) pvExpiry.textContent = ev.complete ? "••/••" : (ev.empty ? "MM/YY" : "••/••");
      });
      split.cardCvc.on("change", function (ev) {
        stripeFieldState.cvc = ev;
        fieldError("cvc", ev.error ? (ev.error.message || "Invalid security code.") : "");
      });
      wireSubmit();
      wirePlanRadios();
      showGrid();
    }).catch(function () {
      showNotice(dkT("sc_noserver"));
    });
  }

  function wirePlanRadios() {
    var radios = document.querySelectorAll('input[name="plan"]');
    // Preselect from ?plan=team|pro (e.g. when redirected from Payments.initiate).
    try {
      var q = new URLSearchParams(window.location.search).get("plan");
      if (q && PLANS[q]) {
        for (var k = 0; k < radios.length; k++) {
          if (radios[k].value === q) { radios[k].checked = true; break; }
        }
      }
    } catch (e) {}
    var update = function () {
      var sel = selectedPlan();
      if ($("sumPlan")) $("sumPlan").textContent = sel.plan.label;
      if ($("sumPrice")) $("sumPrice").textContent = fmtUsd(sel.plan.usd);
      if ($("sumCoins")) $("sumCoins").textContent = sel.plan.coins + " coins";
      if ($("sumTotal")) $("sumTotal").textContent = fmtUsd(sel.plan.usd);
      if (payBtn && !payBtn.disabled) payBtn.textContent = "🔒 Pay " + fmtUsd(sel.plan.usd);
    };
    for (var i = 0; i < radios.length; i++) radios[i].addEventListener("change", update);
    update();
  }

  /* ---------- submit ---------- */
  function wireSubmit() {
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      setPayErr(""); setPayOk("");
      var sel = selectedPlan();
      var S = window.FinSec || null;

      if (S) {
        var rl = S.checkRate("stripe_pay");
        if (!rl.ok) {
          S.auditLog("stripe_pay", { plan: sel.id, result: "rate_limited" });
          setPayErr(dkT("sc_ratelimit"));
          return;
        }
      }

      // 1. Our fields.
      var ownOk = validateOwnFields();
      // 2. Stripe fields must have no errors and not be empty.
      var stripeOk = true;
      [["number", dkT("sc_f_number")], ["expiry", dkT("sc_f_expiry")], ["cvc", dkT("sc_f_cvc")]].forEach(function (pair) {
        var st = stripeFieldState[pair[0]] || {};
        if (st.error) { fieldError(pair[0], st.error.message || dkT("sc_invalid_x").replace("{field}", pair[1])); stripeOk = false; }
        else if (st.empty) { fieldError(pair[0], dkT("sc_required")); stripeOk = false; }
      });
      if (!ownOk || !stripeOk) {
        setPayErr(dkT("sc_fix"));
        return;
      }

      setBusy(true);
      var billing = {
        name: ($("ccName").value || "").trim(),
        country: $("ccCountry").value,
        postalCode: ($("ccZip").value || "").trim()
      };

      // 3. Create PaymentMethod (card data goes Stripe <-browser-> only).
      window.StripePay.createPaymentMethodSplit(split, billing).then(function (pm) {
        if (!pm.ok) {
          setBusy(false);
          if (S) S.auditLog("stripe_pay", { plan: sel.id, result: "pm_failed" });
          setPayErr(pm.error || dkT("sc_rejected"));
          return null;
        }
        // 4. Backend creates the PaymentIntent (secret key never leaves server).
        if (!BACKEND_URL) {
          setBusy(false);
          if (S) S.auditLog("stripe_pay", { plan: sel.id, result: "backend_missing" });
          setPayErr(dkT("sc_nobackend"));
          return null;
        }
        return fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId: pm.paymentMethodId, planId: sel.id, amountUsd: sel.plan.usd })
        }).then(function (r) { return r.json(); });
      }).then(function (backend) {
        if (!backend) return;
        if (!backend.clientSecret) throw new Error("bad_backend");
        return window.StripePay.confirmPayment(backend.clientSecret);
      }).then(function (conf) {
        if (!conf) return;
        setBusy(false);
        if (conf.ok) {
          if (S) S.auditLog("stripe_pay", { plan: sel.id, result: "confirmed" });
          setPayOk(dkT("sc_confirmed"));
          form.reset();
          digitCount = 0; renderDots();
          if (pvName) pvName.textContent = dkT("sc_yourname");
          if (pvExpiry) pvExpiry.textContent = "MM/YY";
          onBrand("unknown");
        } else {
          if (S) S.auditLog("stripe_pay", { plan: sel.id, result: "confirm_failed" });
          setPayErr(conf.error || dkT("sc_failed"));
        }
      }).catch(function () {
        setBusy(false);
        if (S) S.auditLog("stripe_pay", { plan: sel.id, result: "error" });
        setPayErr(dkT("sc_servererr"));
      });
    });
  }

  boot();
});
