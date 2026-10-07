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
     * @param {Object} order - { amount, currency, method, planId, userId }
     * @returns {Promise<{status:string, message:string}>}
     */
    initiate: function (order) {
      order = order || {};
      var method = order.method || "";
      var provider = PROVIDERS[method];
      if (!provider || !provider.isConfigured()) {
        // Scaffolding response — the UI shows "Coming soon".
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
