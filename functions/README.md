# DoKit — Email OTP password reset (Cloud Functions)

Google-style forgot password: 6-digit code by email, enter it, set a new
password, log in right there. The old link flow is untouched and stays as
the fallback on the login page.

**FREE-ONLY.** The only external call is Resend's free plan (3,000
emails/month, no expiry). No paid service is called anywhere in this
feature. Functions run on Firebase Blaze's free tier (2M invocations/month
free) — Blaze needs a billing account on file, but usage at DoKit's scale
stays inside the free quota (bill $0). WhatsApp/SMS OTP are NOT built —
they are paid, by owner order.

## Files

| File | What it is |
|---|---|
| `index.js` | The two HTTPS endpoints: `requestOtp`, `verifyOtpAndReset` (1st-gen `onRequest`, region `us-central1`). Thin wrappers — all rules live in `otp.js`. |
| `otp.js` | Pure logic, zero dependencies: code generation, SHA-256 hashing, timing-safe compare, 10-min expiry, single-use, max 5 attempts, 1 req/min + 5 req/hour per email, input validation. |
| `test/otp.test.js` | Unit tests (`node --test`, no Firebase, no network). |
| `package.json` | `firebase-admin` + `firebase-functions` (v5, 1st-gen API — chosen so the endpoint URL is the predictable `https://us-central1-dokit-app-2e81d.cloudfunctions.net/<name>` that the login page calls). |

## Security (server-enforced, client cannot bypass)

- Codes are stored as **SHA-256 hashes only** in Firestore collection
  `passwordResets` — never plaintext, never logged.
- **10-minute expiry**, **single-use** (marked used + hash cleared in the
  same transaction that verifies it — a replay can never pass twice).
- **Max 5 wrong attempts** per code, then the code is locked.
- **Rate limits per email:** 1 request/minute, 5 requests/hour.
- **No account-existence leakage:** `requestOtp` always answers
  `{ok:true}` for a well-formed email. A missing account gets the same
  response as an existing one, and the rate-limit log is written for
  every email, so 429 behaviour is identical too.
- After a successful reset, other sessions' refresh tokens are revoked
  (`revokeRefreshTokens`) — a reset signs out other devices.
- **Firestore rules:** no change needed. `passwordResets` has no `match`
  rule, so the default deny at the end of `firestore.rules`
  (`match /{document=**} { allow read, write: if false; }`) blocks all
  client access. Only the Admin SDK (these functions) touches it.
  **Verify this after deploy** (a client `get()` on the collection must
  be denied).

## Owner steps — deployment is BLOCKED until these are done

Do NOT deploy, create accounts, or change billing from the agent side.
The owner does these two steps, then says the word:

### 1. Firebase Blaze upgrade (billing account on file, bill stays $0)

Cloud Functions do not run on the free Spark plan, and they need outbound
network access (to Resend). In the Firebase console for project
`dokit-app-2e81d`: **Upgrade → Blaze (pay-as-you-go)** and attach a
billing account. There is no monthly fee; the free tier covers 2M
function invocations/month, and this feature's usage is far below that.
Set a budget alert in Google Cloud Console (e.g. $1) so a surprise is
impossible.

### 2. Resend free account + API key

1. Create a free account at https://resend.com (3,000 emails/month free,
   no expiry — **do NOT use SendGrid**: its permanent free plan is gone,
   only a 60-day trial remains).
2. In Resend: **API Keys → Create** (full access), copy the key.
3. Store it as a Function secret (never in code, never in chat):
   ```
   firebase functions:secrets:set RESEND_API_KEY
   ```
4. **Sender address (production):** the default sender
   `onboarding@resend.dev` can only mail the Resend account owner's own
   address. For real users, verify a domain in Resend (e.g. `getdokit.com`,
   DNS records) and set the sender as a plain environment variable on the
   deployed function — Firebase console → Functions → `requestOtp` →
   **Environment variables** → add `RESEND_FROM` =
   `DoKit <noreply@getdokit.com>` (or put it in a local `functions/.env`
   file, which is git-ignored — never commit secrets). Until then, OTP
   mail only reaches the owner's inbox (fine for testing, not for users).

### 3. Deploy (after 1 + 2)

```
cd <repo>
npm --prefix functions install
firebase deploy --only functions
```

Endpoints (1st-gen, predictable URLs — the login page already calls these):

- `https://us-central1-dokit-app-2e81d.cloudfunctions.net/requestOtp`
- `https://us-central1-dokit-app-2e81d.cloudfunctions.net/verifyOtpAndReset`

### 4. Verify after deploy (before telling users)

1. `curl` requestOtp with a real account email → `{ok:true}`, code arrives.
2. Same with a non-existent email → still `{ok:true}`, no email sent.
3. Wrong code 5 times → 6th verify returns `too-many-attempts`; a new
   code must be requested.
4. Correct code → `{ok:true}`; reuse of the same code → `invalid-code`.
5. Wait 10 minutes → code returns `invalid-code` (expired).
6. 6 rapid requests → 6th returns 429 `too-many-requests`.
7. Client `get()` on `passwordResets/<any>` → permission denied.
8. Login page: full flow — code → new password → "Log in now" lands on
   the dashboard; "Stay signed in" unchecked signs out on tab close.

## Local tests (no Firebase, no network)

```
node --test test/otp.test.js   # or: npm --prefix functions test
node --check otp.js            # syntax
node --check index.js          # syntax (deps not required for --check)
```

Live end-to-end tests need the deploy above — they are intentionally NOT
in this repo (no live credentials, no test accounts committed).

## What is NOT built (by owner order)

- WhatsApp OTP / SMS OTP — paid (Meta charges per authentication
  message from the first one; Firebase SMS is $0.01–$0.46/message).
  Parked until the owner approves a cost.
- Flat login page (`account/login.html`) OTP UI — it uses a different
  code path (`js/pages/login.js` + `js/i18n-account.js`). The `otp_*`
  keys are already in `js/i18n-account.js` so the flat page can reuse
  them later; the UI wiring is a follow-up.
