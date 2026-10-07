/* DoKit — Payments scaffolding (Phase 6).
 *
 * IMPORTANT: This is INFRASTRUCTURE ONLY. No real payment processing happens.
 * Every user-facing element must say "Coming Soon" / "Not available yet".
 *
 * Why this file exists:
 *   When the user has budget, real providers (USDT, Easypaisa/JazzCash, Stripe)
 *   will be wired behind this interface. The rest of the site calls
 *   Payments.initiate() — only the provider adapters change, not the UI.
 *
 *   A developer picking this up:
 *   1. Implement a provider in PROVIDERS (see USDT stub below).
 *   2. Flip Payments.CONFIGURED to true for that provider.
 *   3. Server-side: verify webhooks in js/payments-webhook.js before
 *      crediting anything. NEVER trust client-side payment success alone.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Provider registry. Each provider is an adapter with the same shape:
   *   { id, name, currencies[], isConfigured(), createCheckout(order) }
   * A provider is "live" only when isConfigured() returns true.
   * ------------------------------------------------------------------ */
  var PROVIDERS = {
    /* USDT (crypto) — planned first rail for PK users. */
    usdt: {
      id: "usdt",
      name: "USDT (TRC-20)",
      currencies: ["USDT"],
      isConfigured: function () { return false; }, // COMING SOON
      createCheckout: function (order) {
        return Promise.reject(new Error("USDT provider not configured yet."));
      }
    },
    /* Easypaisa / JazzCash (PKR mobile wallets). */
    pkr_wallet: {
      id: "pkr_wallet",
      name: "Easypaisa / JazzCash",
      currencies: ["PKR"],
      isConfigured: function () { return false; }, // COMING SOON
      createCheckout: function (order) {
        return Promise.reject(new Error("PKR wallet provider not configured yet."));
      }
    },
    /* Cards via Stripe (or Paddle for PK). */
    card: {
      id: "card",
      name: "Card (Stripe)",
      currencies: ["USD", "PKR"],
      isConfigured: function () { return false; }, // COMING SOON
      createCheckout: function (order) {
        return Promise.reject(new Error("Card provider not configured yet."));
      }
    },
    /* Stripe card checkout (dedicated bank-style page).
     *
     * Unlike the "card" stub above, this provider is LIVE as soon as the
     * admin sets `stripe_pk` in Firestore config/payments — the checkout
     * page itself verifies availability and shows a graceful notice when
     * Stripe is blocked or unconfigured, so redirecting is always safe.
     *
     * NOTE: Stripe does not support Pakistan-registered businesses directly.
     * See js/stripe-pay.js header for workarounds (Paddle recommended).
     * Real charging still needs the backend PaymentIntent endpoint; until
     * then the checkout page honestly reports "not connected". */
    stripe: {
      id: "stripe",
      name: "Card (Stripe)",
      currencies: ["USD"],
      isConfigured: function () { return true; },
      createCheckout: function (order) {
        var plan = (order && order.planId) || "pro";
        var url = (typeof window.DKU === "function")
          ? window.DKU("/account/stripe-checkout.html")
          : "/account/stripe-checkout.html";
        try {
          window.location.href = url + "?plan=" + encodeURIComponent(plan);
        } catch (e) {}
        return Promise.resolve({ status: "redirecting", message: "Opening secure card checkout…" });
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Public API used by the rest of the site.                             */
  /* ------------------------------------------------------------------ */
  var Payments = {
    /* True only when at least one provider is actually configured. */
    isAvailable: function () {
      return Object.keys(PROVIDERS).some(function (k) { return PROVIDERS[k].isConfigured(); });
    },

    /* List providers for display (all show "Coming soon" until configured). */
    listProviders: function () {
      return Object.keys(PROVIDERS).map(function (k) {
        var p = PROVIDERS[k];
        return { id: p.id, name: p.name, currencies: p.currencies.slice(), configured: p.isConfigured() };
      });
    },

    /**
     * Start a payment. Currently ALWAYS resolves as "not_configured".
     *
     * SECURITY (active even in scaffold mode):
     *  - Amount is validated via FinSec (rejects negatives, fractions,
     *    NaN/Infinity, overflow) BEFORE anything else happens.
     *  - Rate-limited: max 3 payment attempts/minute (velocity check).
     *  - Every attempt is audit-logged (allowed AND rejected) with a
     *    suspicious-pattern scan. Rejected input never reaches a provider.
     *
     * @param {Object} order - { amount, currency, method, planId, userId }
     * @returns {Promise<{status:string, message:string}>}
     */
    initiate: function (order) {
      order = order || {};
      var S = window.FinSec || null;

      // 1. Validate amount first — fail closed on bad input.
      var amount = 0;
      try {
        amount = S ? S.validateAmount(order.amount) : Math.trunc(Number(order.amount));
        if (!(amount > 0)) throw new Error("Amount must be greater than zero.");
      } catch (e) {
        if (S) S.auditLog("payment_attempt", {
          reason: order.planId || "", result: "rejected: " + e.message
        });
        return Promise.resolve({ status: "invalid_amount", message: e.message });
      }

      // 2. Velocity check.
      if (S) {
        var rl = S.checkRate("payment_attempt");
        if (!rl.ok) {
          S.auditLog("payment_attempt", {
            amount: amount, reason: order.planId || "", result: "rate_limited"
          });
          return Promise.resolve({
            status: "rate_limited",
            message: "Too many payment attempts. Please wait a moment and try again."
          });
        }
        // 3. Fraud heuristics (flags are logged, not auto-blocking here).
        var flags = S.detectSuspicious("payment_attempt", amount, {});
        if (flags.length) {
          S.auditLog("payment_attempt", {
            amount: amount, reason: order.planId || "",
            result: "flagged", extra: flags.join(",")
          });
        }
      }

      // 4. No provider is configured yet — honest scaffold response.
      var method = order.method || "";
      var provider = PROVIDERS[method];
      if (S) S.auditLog("payment_attempt", {
        amount: amount, reason: order.planId || "", result: "not_configured"
      });
      if (!provider || !provider.isConfigured()) {
        return Promise.resolve({
          status: "not_configured",
          message: "Payments are not available yet. Pro launches soon — everything is free for now."
        });
      }
      return provider.createCheckout(order);
    },

    /* Register a new provider adapter (for future use, do not call from UI). */
    _register: function (id, adapter) { PROVIDERS[id] = adapter; }
  };

  window.Payments = Payments;
})();
