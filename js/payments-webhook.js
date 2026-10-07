/* DoKit — Payment webhook handler (scaffold, Phase 6).
 *
 * IMPORTANT: Webhooks MUST be verified server-side (Cloud Function) before
 * crediting any subscription/credits. This client-side stub exists only so
 * the shape of the code is ready; it performs NO real verification and
 * must never be used to grant paid access on its own.
 *
 * Future developer checklist:
 *  1. Create a Cloud Function endpoint /webhooks/<provider>.
 *  2. Verify the provider signature (HMAC / public key) there.
 *  3. On success, write to Firestore: subscriptions/{uid} + audit entry.
 *  4. The client only READS its subscription status from Firestore.
 */
(function () {
  "use strict";

  var Webhook = {
    /**
     * Handle an incoming provider webhook event (STUB — not wired).
     * Real verification happens server-side. This always reports "ignored".
     */
    handle: function (providerId, rawEvent) {
      return Promise.resolve({
        status: "ignored",
        provider: providerId || "unknown",
        message: "Webhook handling is not configured. No payment was processed."
      });
    },

    /**
     * Verify a provider signature (STUB).
     * Real implementation: HMAC-SHA256 with the provider secret, server-side.
     */
    verifySignature: function (providerId, payload, signature) {
      return false; // not configured — always fail closed
    }
  };

  window.DKWebhooks = Webhook;
})();
