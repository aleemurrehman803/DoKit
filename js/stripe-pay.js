/* DoKit — Stripe payments integration (frontend adapter).
 *
 * WHAT THIS FILE DOES:
 *   Wraps Stripe.js (https://js.stripe.com/v3/) behind a small, documented
 *   interface used by the DoKit checkout page. It handles card collection
 *   via Stripe Elements (so raw card numbers NEVER touch our servers or our
 *   JavaScript — that is what makes us PCI compliant by SAQ-A).
 *
 * HOW STRIPE PAYMENTS WORK (the full flow):
 *   1. Customer enters card details into a Stripe Element (iframe hosted by
 *      Stripe — we never see the PAN).
 *   2. Our BACKEND creates a PaymentIntent via the Stripe API and returns
 *      its `client_secret` to this page. (PaymentIntent creation MUST be
 *      server-side: only the server holds the Stripe SECRET key.)
 *   3. `StripePay.confirmPayment(clientSecret)` asks Stripe to charge the
 *      card the backend already attached.
 *   4. Our BACKEND receives the `payment_intent.succeeded` webhook, verifies
 *      the Stripe signature, and only then credits DoKit coins.
 *
 * SECURITY RULES (read before touching):
 *   - The PUBLISHABLE key (pk_...) is safe in client code. The SECRET key
 *     (sk_...) must NEVER appear in this file or anywhere client-side.
 *   - NEVER trust a client-side "payment succeeded" callback to credit coins.
 *     Only the server-side webhook (signature-verified) may credit wallets.
 *   - All amounts are in the SMALLEST currency unit (cents/paisa) when sent
 *     to Stripe. $6.00 -> 600.
 *
 * PAKISTAN LIMITATION:
 *   Stripe does NOT support businesses registered in Pakistan directly.
 *   Options for the DoKit owner:
 *     a) Paddle (paddle.com) — merchant of record, supports Pakistan.
 *        Recommended: Paddle handles tax/VAT and works with PK founders.
 *     b) Register a US LLC / UK Ltd and open Stripe there (needs EIN,
 *        US bank account via Wise/Mercury, and a real address).
 *     c) Use a Stripe Atlas company (expensive, ~$500 one-time).
 *   Until one of these is done, StripePay.init() will reject with a clear
 *   message and the UI falls back to Easypaisa/JazzCash/USDT manual deposits.
 *
 * GETTING KEYS (when ready):
 *   1. Sign up at https://dashboard.stripe.com
 *   2. Developers -> API keys -> copy "Publishable key" (pk_test_... first).
 *   3. Keep "Secret key" (sk_test_...) ONLY on the backend.
 *   4. Webhooks -> Add endpoint -> your backend URL ->
 *      select `payment_intent.succeeded` -> copy the signing secret (whsec_...).
 *
 * DEPENDENCIES: Stripe.js must be loaded before this file:
 *   <script src="https://js.stripe.com/v3/"></script>
 */
(function () {
  "use strict";

  /* Publishable key. Set via StripePay.init(key).
   * Test keys start with pk_test_, live keys with pk_live_.
   * NEVER put a secret key (sk_...) here. */
  var publishableKey = null;

  /* Stripe.js instance (created by init). */
  var stripe = null;

  /**
   * Check whether Stripe can be used in the current environment.
   *
   * Stripe is unavailable when:
   *   - Stripe.js failed to load (ad blocker, offline, CSP), or
   *   - No publishable key has been configured yet.
   *
   * @returns {boolean} true if init() succeeded and Stripe.js is present.
   */
  function isAvailable() {
    return !!(stripe && window.Stripe);
  }

  /**
   * Initialize Stripe with a publishable key.
   *
   * WHY a separate init step: the key lives in site config (admin sets it
   * in the dashboard), not hardcoded. init() is called once the config is
   * loaded. Calling twice with the same key is a no-op.
   *
   * @param {string} key - Stripe publishable key (pk_test_... / pk_live_...).
   * @returns {boolean} true on success, false if Stripe.js missing or key empty.
   */
  function init(key) {
    if (!key || typeof key !== "string" || !key.trim()) {
      return false;
    }
    if (!window.Stripe) {
      // Stripe.js blocked or failed to load — caller shows fallback UI.
      return false;
    }
    if (publishableKey === key.trim() && stripe) return true;
    publishableKey = key.trim();
    try {
      stripe = window.Stripe(publishableKey);
      return true;
    } catch (e) {
      stripe = null;
      return false;
    }
  }

  /**
   * Create a Stripe Elements card input and mount it into a container.
   *
   * Stripe Elements renders the card fields inside a Stripe-hosted iframe,
   * so card numbers never enter our DOM. We only get a token-like
   * PaymentMethod id back.
   *
   * @param {string} containerId - id of the empty div to mount into.
   * @param {Object} [style] - optional Elements appearance overrides.
   * @returns {Object|null} { elements, card } on success, null if unavailable.
   */
  function createCardElement(containerId, style) {
    if (!isAvailable()) return null;
    var container = document.getElementById(containerId);
    if (!container) return null;
    try {
      var elements = stripe.elements();
      var card = elements.create("card", style || {});
      card.mount("#" + containerId);
      return { elements: elements, card: card };
    } catch (e) {
      return null;
    }
  }

  /**
   * Turn the filled card Element into a Stripe PaymentMethod.
   *
   * This sends the card data DIRECTLY to Stripe (not through our servers)
   * and returns a payment method id like "pm_123". The backend then attaches
   * it to a PaymentIntent it created server-side.
   *
   * @param {Object} card - the Stripe card Element from createCardElement().
   * @param {Object} [billing] - optional { name, email } for the receipt.
   * @returns {Promise<{ok:boolean, paymentMethodId?:string, error?:string}>}
   */
  function createPaymentMethod(card, billing) {
    if (!isAvailable()) {
      return Promise.resolve({ ok: false, error: "Stripe is not available in this browser session." });
    }
    if (!card) {
      return Promise.resolve({ ok: false, error: "Card input is not ready yet." });
    }
    var params = { type: "card", card: card };
    if (billing && (billing.name || billing.email)) {
      params.billing_details = {};
      if (billing.name) params.billing_details.name = billing.name;
      if (billing.email) params.billing_details.email = billing.email;
    }
    return stripe.createPaymentMethod(params).then(function (result) {
      if (result.error) {
        // Card declined, invalid number, etc. — message is user-safe.
        return { ok: false, error: result.error.message || "Card was rejected." };
      }
      return { ok: true, paymentMethodId: result.paymentMethod.id };
    }).catch(function () {
      return { ok: false, error: "Could not reach Stripe. Check your connection and try again." };
    });
  }

  /**
   * Confirm a PaymentIntent that the BACKEND created.
   *
   * Flow: backend calls stripe.paymentIntents.create({ amount, currency })
   * with the SECRET key, returns { clientSecret } to this page; we pass it
   * here. Stripe handles 3-D Secure / bank redirects automatically and
   * resolves when the charge attempt finishes.
   *
   * IMPORTANT: a successful confirmation here does NOT credit coins.
   * Coins are credited only when the backend receives and verifies the
   * `payment_intent.succeeded` webhook (see js/payments-webhook.js).
   *
   * @param {string} clientSecret - from the backend (pi_..._secret_...).
   * @returns {Promise<{ok:boolean, paymentIntentId?:string, error?:string}>}
   */
  function confirmPayment(clientSecret) {
    if (!isAvailable()) {
      return Promise.resolve({ ok: false, error: "Stripe is not available in this browser session." });
    }
    if (!clientSecret || clientSecret.indexOf("pi_") !== 0) {
      return Promise.resolve({ ok: false, error: "Invalid payment session. Please start checkout again." });
    }
    return stripe.confirmCardPayment(clientSecret).then(function (result) {
      if (result.error) {
        return { ok: false, error: result.error.message || "Payment failed." };
      }
      var pi = result.paymentIntent || {};
      if (pi.status === "succeeded") {
        return { ok: true, paymentIntentId: pi.id };
      }
      // Requires further action that confirmCardPayment already handled;
      // anything else is not a completed charge.
      return { ok: false, error: "Payment is not complete (status: " + (pi.status || "unknown") + ")." };
    }).catch(function () {
      return Promise.resolve({ ok: false, error: "Could not reach Stripe. Check your connection and try again." });
    });
  }

  /**
   * Convert a decimal major-unit amount to Stripe's minor units.
   * $6.00 -> 600. Throws on invalid input (fail closed).
   *
   * @param {number|string} amount - e.g. 6 or "6.00".
   * @returns {number} integer minor units.
   */
  function toMinorUnits(amount) {
    var n = Number(amount);
    if (!isFinite(n) || n <= 0) throw new Error("Amount must be a positive number.");
    var minor = Math.round(n * 100);
    if (minor <= 0 || minor > 99999999) throw new Error("Amount out of range.");
    return minor;
  }

  /**
   * Create SPLIT Stripe Elements: separate card number / expiry / CVC fields.
   *
   * WHY split elements: a bank-style checkout shows Card Number, Expiry
   * (MM/YY) and CVC as individual fields with their own labels, tooltips and
   * per-field validation — exactly like real bank payment pages. Each field
   * still renders inside a Stripe-hosted iframe, so card data never touches
   * our DOM (PCI SAQ-A compliant).
   *
   * @param {Object} ids - { number: "card-number", expiry: "card-expiry", cvc: "card-cvc" }
   * @param {Object} [style] - optional Elements appearance overrides.
   * @returns {Object|null} { elements, cardNumber, cardExpiry, cardCvc } or null.
   */
  function createSplitCardElements(ids, style) {
    if (!isAvailable()) return null;
    ids = ids || {};
    if (!ids.number || !ids.expiry || !ids.cvc) return null;
    if (!document.getElementById(ids.number) ||
        !document.getElementById(ids.expiry) ||
        !document.getElementById(ids.cvc)) return null;
    try {
      var elements = stripe.elements();
      var opts = style || {};
      var cardNumber = elements.create("cardNumber", opts);
      var cardExpiry = elements.create("cardExpiry", opts);
      var cardCvc = elements.create("cardCvc", opts);
      cardNumber.mount("#" + ids.number);
      cardExpiry.mount("#" + ids.expiry);
      cardCvc.mount("#" + ids.cvc);
      return { elements: elements, cardNumber: cardNumber, cardExpiry: cardExpiry, cardCvc: cardCvc };
    } catch (e) {
      return null;
    }
  }

  /**
   * Create a PaymentMethod from SPLIT elements plus billing details.
   *
   * Stripe requires the card NUMBER element for createPaymentMethod; the
   * expiry/CVC elements are linked automatically because they were created
   * from the same `elements` group. Billing details (name, country, ZIP)
   * come from our own plain inputs — safe, they are not card data.
   *
   * @param {Object} split - return value of createSplitCardElements().
   * @param {Object} billing - { name, country, postalCode }.
   * @returns {Promise<{ok:boolean, paymentMethodId?:string, error?:string}>}
   */
  function createPaymentMethodSplit(split, billing) {
    if (!isAvailable()) {
      return Promise.resolve({ ok: false, error: "Stripe is not available in this browser session." });
    }
    if (!split || !split.cardNumber) {
      return Promise.resolve({ ok: false, error: "Card inputs are not ready yet." });
    }
    billing = billing || {};
    var details = { address: {} };
    if (billing.name) details.name = billing.name;
    if (billing.country) details.address.country = billing.country;
    if (billing.postalCode) details.address.postal_code = billing.postalCode;
    var params = { type: "card", card: split.cardNumber };
    if (details.name || details.address.country || details.address.postal_code) {
      params.billing_details = details;
    }
    return stripe.createPaymentMethod(params).then(function (result) {
      if (result.error) {
        return { ok: false, error: result.error.message || "Card was rejected." };
      }
      return { ok: true, paymentMethodId: result.paymentMethod.id };
    }).catch(function () {
      return { ok: false, error: "Could not reach Stripe. Check your connection and try again." };
    });
  }

  /* Card brand metadata for the visual preview + brand badge.
   * `brand` comes from Stripe's cardNumber change event (never the PAN). */
  var CARD_BRANDS = {
    visa: { label: "VISA", cls: "brand-visa" },
    mastercard: { label: "Mastercard", cls: "brand-mc" },
    amex: { label: "AMEX", cls: "brand-amex" },
    discover: { label: "Discover", cls: "brand-discover" },
    diners: { label: "Diners", cls: "brand-diners" },
    jcb: { label: "JCB", cls: "brand-jcb" },
    unionpay: { label: "UnionPay", cls: "brand-up" },
    unknown: { label: "", cls: "" }
  };

  /**
   * Get display metadata for a Stripe card brand string.
   * @param {string} brand - e.g. "visa", "mastercard", "amex", "unknown".
   * @returns {{label:string, cls:string}}
   */
  function brandInfo(brand) {
    return CARD_BRANDS[brand] || CARD_BRANDS.unknown;
  }

  /* Public surface. */
  window.StripePay = {
    init: init,
    isAvailable: isAvailable,
    createCardElement: createCardElement,
    createSplitCardElements: createSplitCardElements,
    createPaymentMethod: createPaymentMethod,
    createPaymentMethodSplit: createPaymentMethodSplit,
    brandInfo: brandInfo,
    confirmPayment: confirmPayment,
    toMinorUnits: toMinorUnits,
    /* Read-only: which key is active (first 12 chars only, never the full key in logs). */
    keyPrefix: function () { return publishableKey ? publishableKey.slice(0, 12) + "..." : ""; }
  };
})();
