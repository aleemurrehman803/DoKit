# DoKit API Roadmap — Suggestions

*What APIs should DoKit build next, and why? Written for decision-making: each
idea has the business value first, technical notes second.*

**Priority key:** P0 = build first (money/retention) · P1 = build next (growth)
· P2 = later (nice to have)

---

## 1. NEED APIs (high value)

### P0 — Batch image processing (`POST /v1/image/batch`)
- **Why:** The #1 Pro feature request pattern. Photographers, bloggers, and
  e-commerce sellers resize/compress *hundreds* of images. One-by-one in a
  browser is painful; an API that takes a ZIP (or list of URLs) and returns a
  ZIP of processed images is the reason people pay $6/mo instead of using a
  free website.
- **Users:** Shopify/WooCommerce store owners, bloggers, real-estate sites.
- **Complexity:** Medium. Async job + webhook/callback when done (files can be
  large). Needs the job queue from §3.

### P0 — Webhooks (`certificate.issued`, `payment.completed`, `job.done`)
- **Why:** APIs without webhooks are toys. A school that issues 500 typing
  certificates needs to know *when* each is ready without polling. Webhooks
  turn one-off calls into integrations people depend on — and depend on =
  don't churn.
- **Users:** Schools, HR departments, any business automation (Zapier/Make).
- **Complexity:** Medium. HMAC-SHA256 signed payloads, retry with backoff,
  per-endpoint secrets, delivery log in dashboard.

### P0 — Certificate issuance API (`POST /v1/certificates`)
- **Why:** DoKit already has HEC/IBCC-style verifiable certificates — that is
  *rare* and valuable. Schools, training institutes, and freelancing platforms
  will pay to issue branded, verifiable certificates programmatically
  (e.g. "every student who finishes our course gets a DoKit-verified cert").
  Verification stays free (trust flywheel); issuance is metered.
- **Users:** Online academies, corporate training, test-prep centers.
- **Complexity:** Low-Medium. Reuse existing cert pipeline; add org templates.

### P1 — Async job queue (the foundation under batch + video)
- **Why:** Anything slower than ~10 seconds (big batches, future video work)
  must not block an HTTP request. Pattern: `POST /v1/jobs` → returns
  `job_id` → `GET /v1/jobs/{id}` polls status → webhook fires on completion.
- **Users:** Indirect — enables batch, and any future heavy feature.
- **Complexity:** Medium. Cloud Tasks / Firestore-backed queue + worker.

### P1 — Usage & billing API (`GET /v1/usage`, `GET /v1/billing/invoices`)
- **Why:** Team-plan buyers ($29/mo) need to see *who on their team* burned the
  quota. Without a usage API, finance teams can't approve the purchase.
  Boring, but it unblocks enterprise sales.
- **Users:** Team admins, finance.
- **Complexity:** Low. Read-only over existing metering data.

---

## 2. NICE TO HAVE

### P1 — Python & PHP SDKs
- **Why:** The JS SDK covers websites. Python covers data/automation people;
  PHP covers the huge WordPress ecosystem in Pakistan (a plugin that
  auto-compresses uploads via DoKit = distribution). Build *after* the REST
  API is stable — SDKs are just thin wrappers.
- **Complexity:** Low (each ~200 lines over the REST contract).

### P1 — Urdu typing test API (`POST /v1/typing/urdu/score`)
- **Why:** Niche but defensible: government/typing-test centers in Pakistan
  need *verifiable* Urdu typing scores. DoKit is one of very few platforms
  with Urdu typing + verifiable certificates. Small market, near-zero
  competition.
- **Complexity:** Low-Medium. Anti-cheat heuristics must run server-side.

### P2 — Embeddable widgets (`<script src=".../widget.js">`)
- **Why:** A "compress image" widget other blogs embed = free SEO backlinks
  (the SEO flywheel in IDEAS.md). The widget itself calls the public API
  behind the scenes. More distribution than revenue directly.
- **Complexity:** Medium (iframe sandboxing, theming, key scoping).

### P2 — GraphQL
- **Why:** Not needed. REST covers everything DoKit does today. Revisit only
  if mobile apps need flexible field selection at scale. Don't pay the
  complexity tax early.

---

## 3. DON'T need APIs (and why)

| Feature | Why no API |
|---|---|
| Doki AI assistant chat | Conversational UI is the product; an API for it invites prompt-injection abuse and token-cost surprises. If ever: separate, heavily rate-limited product. |
| On-screen Urdu keyboard | Pure client-side input method — nothing for a server to do. |
| Guides / blog / FAQ content | Static content; an API adds nothing over the website + sitemap. |
| Admin panel | Internal tool by design. Exposing it as an API = attack surface for zero benefit. |
| Referral link generation | Trivial client-side URL building (`?ref=`); server only needs to *record* redemptions, which the website already does. |
| Real-time TypeFight battles | WebSockets ≠ REST API. If live PvP ever ships, it's a socket protocol, not this API. Don't conflate them. |

---

## 4. Suggested build order

1. **v1.0 (now):** Document the contract (done — `api/docs.html`), ship JS SDK
   (done — `js/dokit-sdk.js`), ship key management (done — `account/api-keys.html`).
   Backend stubs return honest errors.
2. **v1.1:** Live backend for the 7 documented endpoints + webhooks +
   async job queue.
3. **v1.2:** Batch endpoint + certificate issuance API (the two money makers).
4. **v1.3:** Python/PHP SDKs, usage/billing API, Urdu typing score API.
5. **Later:** Widgets; GraphQL only if a real customer asks.

---

## 5. Notes for the backend build (when it starts)

- **Auth:** Hash the presented Bearer token with SHA-256, compare against
  `users/{uid}/api_keys/{keyId}.keyHash`; reject if `revoked == true`.
  Keys never travel except over TLS.
- **Rate limiting:** Token bucket per `keyHash` in Firestore (or Memorystore);
  Free 100/day, Pro 10k/day, Team 100k/day; always return `Retry-After` on 429.
- **File uploads:** 25 MB cap, virus-scan on ingest (Cloud Storage trigger),
  strip EXIF (privacy promise), process in a worker — never in the request
  handler.
- **Idempotency:** Accept `Idempotency-Key` header on POSTs; store
  key→response for 24h so retries never double-charge or double-issue.
- **Versioning:** `/v1/` in the path; never break v1 — ship v2 alongside.
- **Status page:** The existing `status.html` should gain an "API" component
  with uptime once the backend is live.
