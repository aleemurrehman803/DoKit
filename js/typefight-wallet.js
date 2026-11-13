/* DoKit — TypeFight wallet helpers (virtual coins).
 *
 * WHAT THIS IS:
 *   Earning logic for TypeFight virtual coins. All earns are written to
 *   the immutable Firestore ledger via TF.ledgerAppend() (see js/typefight.js).
 *
 * EARN TABLE (virtual coins — no cash value):
 *   - Complete a typing test ......... +10  (claimable once per hour)
 *   - Daily streak check-in .......... +5   (claimable once per day)
 *   - Complete a lesson .............. +3   (per lesson, once per day)
 *   - Battle 1st place ............... +50  (per battle win)
 *   - Battle 2nd place ............... +30
 *   - Battle 3rd place ............... +20
 *   - Battle participation ........... +10
 *
 * RATE LIMITING (two sources — the LEDGER is the source of truth):
 *   Cooldowns are stamped in the user's typefight_profile doc as
 *   lastEarn: { <key>: <timestamp ms> } AND recorded immutably in the
 *   coin ledger as earn entries. The profile stamp is advisory: it can
 *   be DENIED by Firestore rules (live, Nov 2026: no rule existed for
 *   users/{uid}/typefight_profile/profile, so the stamp write was
 *   denied while the ledger append succeeded — and the same claim
 *   credited twice after a reload). earnStatus() therefore checks
 *   BOTH sources and takes the LONGER wait; claim() is gated on it.
 *   A user tampering with their own browser clock can only shorten
 *   their own wait — production would enforce cooldowns server-side.
 *   Firestore rules still prevent editing the ledger itself.
 *
 * KNOWN LIMITATIONS (require server-side enforcement for production):
 *   - H2: Coins are client-mintable. A technically skilled user could call
 *     TF.ledgerAppend() from the browser console to mint coins. Mitigation:
 *     Firestore rules make the ledger append-only and public-readable, so
 *     fraud is DETECTABLE via ledgerVerify(), but not PREVENTABLE client-side.
 *     Production must move minting to a Cloud Function.
 *   - M2: Referral farming. Nothing stops a user creating fake accounts to
 *     earn referral bonuses. Mitigation: referrals are virtual coins only
 *     (no cash value), and admin can audit via admin_audit. Production needs
 *     phone/email verification + server-side referral validation.
 *   - M13: Usernames are not unique. Two users could pick the same display
 *     name, enabling certificate impersonation confusion. Certificates use
 *     UID (not username) as the source of truth. Production should enforce
 *     unique usernames via a usernames/{name} claim collection.
 */
(function () {
  "use strict";

  /* Earn definitions: key -> { coins, cooldownMs, label } */
  var EARN = {
    typing_test:  { coins: 10, cooldownMs: 60 * 60 * 1000,      label: "Typing test complete" },
    daily_streak: { coins: 5,  cooldownMs: 24 * 60 * 60 * 1000, label: "Daily streak" }
    // lessons use dynamic keys: "lesson_<lessonId>"
  };
  var LESSON_COINS = 3;
  var LESSON_COOLDOWN = 24 * 60 * 60 * 1000;

  var BATTLE_REWARDS = { 1: 50, 2: 30, 3: 20, 4: 10 };

  /**
   * Check whether an earn key is off cooldown.
   * @param {object|null} profile - TypeFight profile doc (may be null).
   * @param {string} key - Earn key, e.g. "typing_test" or "lesson_3".
   * @returns {{ok:boolean, waitMs:number}} ok=true if claimable now.
   */
  function canEarn(profile, key) {
    var def = EARN[key] || { cooldownMs: LESSON_COOLDOWN };
    var last = profile && profile.lastEarn && profile.lastEarn[key];
    if (!last) return { ok: true, waitMs: 0 };
    var waitMs = (Number(last) + def.cooldownMs) - Date.now();
    if (waitMs <= 0) return { ok: true, waitMs: 0 };
    return { ok: false, waitMs: waitMs };
  }

  /**
   * Ledger-aware earn status: combines BOTH cooldown sources and takes
   * the LONGER wait.
   *   (a) Profile stamp — TF.getProfile + canEarn() (may be missing:
   *       the stamp write is best-effort and can be denied by rules).
   *   (b) Ledger — TF.ledgerLastEarn(): an earn entry within the key's
   *       cooldown means NOT ok. The ledger is append-only, so this
   *       check survives reloads and denied stamp writes — it is what
   *       makes exactly-once hold.
   * A failed read on the PROFILE side fails OPEN for that side (treated
   * as "no cooldown seen") so a read error can never lock a user out;
   * the ledger append itself is still the final guard. The LEDGER side
   * NEVER fails open: if the ledger read times out (~8s) or rejects,
   * the ledger could not be checked, so this resolves
   * {ok:false, error:"unavailable"} and claim() refuses the claim —
   * a claim must never be allowed when the ledger could not be
   * checked. If the client is an older cached copy without
   * TF.ledgerLastEarn, the profile check alone applies (same behaviour
   * as before this fix).
   * @param {string} uid
   * @param {string} key - Earn key, e.g. "typing_test" or "lesson_3".
   * @returns {Promise<{ok:boolean, waitMs:number, error?:string}>}
   */
  var LEDGER_READ_TIMEOUT_MS = 8000;
  function earnStatus(uid, key) {
    var def = EARN[key] || { cooldownMs: LESSON_COOLDOWN };
    var cooldownMs = def.cooldownMs;
    var profileP = TF.getProfile(uid).then(function (p) {
      return canEarn(p, key);
    }).catch(function () { return { ok: true, waitMs: 0 }; });
    var ledgerP;
    if (typeof TF.ledgerLastEarn === "function") {
      /* Race the ledger read against the timeout so a hung read can
       * never stall the claim gate (or the button) forever. A read
       * ERROR is treated exactly like a timeout (unavailable). */
      ledgerP = new Promise(function (resolve) {
        var settled = false;
        var timer = setTimeout(function () {
          if (!settled) {
            settled = true;
            resolve({ ok: false, waitMs: 0, error: "unavailable" });
          }
        }, LEDGER_READ_TIMEOUT_MS);
        TF.ledgerLastEarn(uid, key).then(function (entry) {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (!entry) { resolve({ ok: true, waitMs: 0 }); return; }
          var waitMs = (Number(entry.clientTs) || 0) + cooldownMs - Date.now();
          if (waitMs <= 0) resolve({ ok: true, waitMs: 0 });
          else resolve({ ok: false, waitMs: waitMs });
        }).catch(function () {
          if (settled) return;
          settled = true; clearTimeout(timer);
          resolve({ ok: false, waitMs: 0, error: "unavailable" });
        });
      });
    } else {
      ledgerP = Promise.resolve({ ok: true, waitMs: 0 });
    }
    return Promise.all([profileP, ledgerP]).then(function (results) {
      var a = results[0], b = results[1];
      if (b.error) return { ok: false, waitMs: 0, error: b.error };
      if (a.ok && b.ok) return { ok: true, waitMs: 0 };
      return { ok: false, waitMs: Math.max(a.waitMs, b.waitMs) };
    });
  }

  /* In-memory locks prevent double-click races: two rapid claim() calls
   * for the same uid+key would both pass canEarn() before either stamps
   * the cooldown. The lock is held until the claim settles. */

  var claimLocks = {};

  /**
   * Claim coins for an earn key (writes ledger + updates cooldown stamp).
   * Resolves with { entry } on success, { error:"cooldown", waitMs } if
   * on cooldown, or { error:"unavailable" } if the ledger could not be
   * checked (read timeout / error) — the claim is REFUSED in that case,
   * never allowed on the profile hint alone.
   * Gate is earnStatus() (profile stamp AND ledger) — the ledger check
   * is what keeps exactly-once when the stamp write is denied by rules.
   * The stamp write stays best-effort: it may be denied until the
   * typefight_profile rules branch lands, but a stamp failure NEVER
   * blocks or hides a successful claim — the LEDGER is the source of
   * truth for exactly-once, and the stamp is only a fast-path hint.
   * @param {string} uid
   * @param {string} key - Earn key.
   * @param {number} [coinsOverride] - For lessons (default LESSON_COINS).
   * @returns {Promise<object>}
   */
  function claim(uid, key, coinsOverride) {
    var lockKey = uid + "|" + key;
    if (claimLocks[lockKey]) {
      return Promise.resolve({ error: "in_progress", waitMs: 0 });
    }
    claimLocks[lockKey] = true;
    var def = EARN[key];
    var coins = (coinsOverride != null) ? coinsOverride : (def ? def.coins : LESSON_COINS);
    var label = def ? def.label : ("Lesson complete (" + key.replace("lesson_", "") + ")");
    return earnStatus(uid, key).then(function (check) {
      if (check.error) {
        /* Ledger could not be checked (read timeout / error): refuse
         * the claim — never fail-open. The caller surfaces this as a
         * retryable failure, not a cooldown. */
        delete claimLocks[lockKey];
        return { error: check.error, waitMs: 0 };
      }
      if (!check.ok) {
        delete claimLocks[lockKey];
        return { error: "cooldown", waitMs: check.waitMs };
      }
      return TF.ledgerAppend(uid, coins, "earn:" + key).then(function (entry) {
        // Stamp the cooldown (merge into profile; best-effort — a denied
        // stamp must NEVER fail or hide this claim: the ledger entry
        // above is already committed and is the exactly-once record.
        var stamp = { lastEarn: {} };
        stamp.lastEarn[key] = Date.now();
        return TF.saveProfile(uid, stamp).catch(function () {}).then(function () {
          delete claimLocks[lockKey];
          return { entry: entry, coins: coins };
        });
      }, function (err) {
        delete claimLocks[lockKey];
        throw err;
      });
    }, function (err) {
      delete claimLocks[lockKey];
      throw err;
    });
  }

  /**
   * Award battle placement coins. No cooldown (each battle is unique).
   * @param {string} uid
   * @param {number} place - 1..4
   * @param {string} battleId - For the ledger reason.
   * @returns {Promise<object>} { entry, coins }
   */
  function awardBattle(uid, place, battleId) {
    /* Validate place: must be 1-4. Unknown/invalid place = no reward (not a default). */
    place = Number(place) | 0;
    if (!BATTLE_REWARDS[place]) {
      return Promise.reject(new Error("Invalid battle place: " + place));
    }
    var coins = BATTLE_REWARDS[place];
    var reason = "battle_" + battleId + "_place" + place;
    return TF.ledgerAppend(uid, coins, reason).then(function (entry) {
      return { entry: entry, coins: coins };
    });
  }

  /**
   * Human-readable cooldown, e.g. "3h 12m" or "45m".
   * @param {number} waitMs
   * @returns {string}
   */
  function fmtWait(waitMs) {
    var m = Math.ceil(waitMs / 60000);
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    var rest = m % 60;
    return h + "h" + (rest ? " " + rest + "m" : "");
  }

  /* ------------------------------------------------------------------ */
  /* Withdrawals — LOCKED until legal clearance + payment rails (Phase 6).
   *
   * SECURITY DESIGN (Binance/bank-grade, ready to activate):
   *  1. 24h cooldown AFTER the last deposit before any withdrawal.
   *  2. Daily withdrawal limit (configurable cap).
   *  3. 2FA (TOTP) required — FinSec.hasRecentAuth() must be true, else
   *     the user is asked to re-authenticate.
   *  4. Email confirmation — a confirmation token is emailed; the
   *     withdrawal only executes after the link is clicked (stub).
   *  5. Manual review flag — amounts >= REVIEW_THRESHOLD create a
   *     `withdrawals/{id}` doc with status "pending_review" for an admin.
   *  6. Idempotency key — double-clicks / retries can't create two requests.
   *  7. Every attempt (allowed or denied) is audit-logged.
   *
   * requestWithdrawal() currently ALWAYS returns { status: "locked" }.
   * Flip WITHDRAWALS_ENABLED only after legal clearance + server-side
   * Cloud Function enforcement is live.
   * ------------------------------------------------------------------ */
  var WITHDRAWALS_ENABLED = false; // <-- flip only after legal clearance
  var WITHDRAW_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h between withdrawals
  var DEPOSIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;  // 24h after a deposit
  var DAILY_WITHDRAW_LIMIT = 50000;               // coins per 24h (tunable)
  var REVIEW_THRESHOLD = 100000;                  // >= this -> manual review
  var LS_LAST_WITHDRAW = "dokit_last_withdraw";
  var LS_LAST_DEPOSIT = "dokit_last_deposit";
  var LS_WITHDRAWN_TODAY = "dokit_withdrawn_today"; // { date, total }

  function secW() { return window.FinSec || null; }

  /**
   * Check withdrawal eligibility (scaffold — always locked for now).
   * When enabled, enforces: deposit cooldown, withdrawal cooldown,
   * daily limit, 2FA re-auth, and flags large amounts for review.
   * @param {*} rawAmount
   * @returns {{status:string, waitMs:number, message:string, needsReview:boolean}}
   */
  function withdrawalStatus(rawAmount) {
    var S = secW();
    if (!WITHDRAWALS_ENABLED) {
      return { status: "locked", waitMs: 0, needsReview: false,
               message: "Withdrawals are locked pending legal clearance." };
    }
    var amount = 0;
    try { amount = S ? S.validateAmount(rawAmount) : Math.trunc(Number(rawAmount)); }
    catch (e) { return { status: "invalid", waitMs: 0, needsReview: false, message: e.message }; }

    // 2FA / re-auth gate for this sensitive action.
    if (S && !S.hasRecentAuth()) {
      return { status: "reauth", waitMs: 0, needsReview: false,
               message: "Please re-authenticate (2FA) to withdraw." };
    }
    // 24h cooldown after the last deposit.
    var lastDeposit = 0, lastWithdraw = 0;
    try {
      lastDeposit = parseInt(localStorage.getItem(LS_LAST_DEPOSIT), 10) || 0;
      lastWithdraw = parseInt(localStorage.getItem(LS_LAST_WITHDRAW), 10) || 0;
    } catch (e) {}
    var depWait = DEPOSIT_COOLDOWN_MS - (Date.now() - lastDeposit);
    if (lastDeposit && depWait > 0) {
      return { status: "deposit_cooldown", waitMs: depWait, needsReview: false,
               message: "Withdrawals unlock " + fmtWait(depWait) + " after your last deposit." };
    }
    // 24h cooldown between withdrawals.
    var wdWait = WITHDRAW_COOLDOWN_MS - (Date.now() - lastWithdraw);
    if (lastWithdraw && wdWait > 0) {
      return { status: "cooldown", waitMs: wdWait, needsReview: false,
               message: "Next withdrawal available in " + fmtWait(wdWait) + "." };
    }
    // Daily limit.
    var today = new Date().toISOString().slice(0, 10);
    var dayTotal = 0;
    try {
      var rec = JSON.parse(localStorage.getItem(LS_WITHDRAWN_TODAY) || "{}");
      if (rec.date === today) dayTotal = rec.total | 0;
    } catch (e) {}
    if (dayTotal + amount > DAILY_WITHDRAW_LIMIT) {
      return { status: "daily_limit", waitMs: 0, needsReview: false,
               message: "Daily withdrawal limit is " + DAILY_WITHDRAW_LIMIT + " coins." };
    }
    // Large amounts go to manual review instead of auto-processing.
    var needsReview = amount >= REVIEW_THRESHOLD;
    return { status: needsReview ? "review" : "eligible", waitMs: 0, needsReview: needsReview,
             message: needsReview ? "This amount requires manual review." : "Eligible." };
  }

  /**
   * Request a withdrawal (scaffold — returns "locked", processes nothing).
   * When enabled: idempotency-guarded, audit-logged, email-confirmed.
   */
  function requestWithdrawal(rawAmount) {
    var S = secW();
    var st = withdrawalStatus(rawAmount);
    if (S) S.auditLog("withdrawal_request", {
      amount: typeof rawAmount === "number" ? rawAmount : null,
      result: st.status
    });
    if (st.status !== "eligible" && st.status !== "review") return Promise.resolve(st);
    // Idempotency: one key per request — retries can't duplicate it.
    var key = S ? S.newIdempotencyKey("withdrawal") : ("withdrawal_" + Date.now());
    if (S && !S.claimIdempotencyKey(key)) {
      return Promise.resolve({ status: "duplicate", waitMs: 0, needsReview: false,
                               message: "This withdrawal was already submitted." });
    }
    /* Real implementation (NOT ACTIVE):
       1. Create withdrawals/{key} doc { uid, amount, status: needsReview
          ? "pending_review" : "pending_email", idempotencyKey: key }.
       2. Send email confirmation link with token.
       3. On email confirm -> 24h admin review window for large amounts,
          else queue payout. NOT ACTIVE. */
    return Promise.resolve({ status: "locked", waitMs: 0, needsReview: false,
                             message: "Withdrawals are not active yet." });
  }

  /**
   * Award coins for a generic reason (e.g. referrals). No cooldown.
   * Used by referral system and other one-time rewards.
   * @param {string} uid - Recipient user ID.
   * @param {number} coins - Amount to award (positive integer).
   * @param {string} reason - Ledger reason label.
   * @returns {Promise<object>} { entry, coins }
   */
  function award(uid, coins, reason) {
    coins = Math.floor(Number(coins)) || 0;
    if (coins <= 0) return Promise.resolve({ error: "invalid_amount" });
    if (coins > 10000) return Promise.resolve({ error: "amount_too_large" });
    var safeReason = String(reason || "award").replace(/[^a-z0-9_:\-]/gi, "").substring(0, 64);
    return TF.ledgerAppend(uid, coins, safeReason).then(function (entry) {
      return { entry: entry, coins: coins };
    });
  }

  window.TFWallet = {
    EARN: EARN,
    LESSON_COINS: LESSON_COINS,
    BATTLE_REWARDS: BATTLE_REWARDS,
    canEarn: canEarn,
    earnStatus: earnStatus,
    claim: claim,
    awardBattle: awardBattle,
    award: award,
    fmtWait: fmtWait,
    withdrawalStatus: withdrawalStatus,
    requestWithdrawal: requestWithdrawal,
    WITHDRAWALS_ENABLED: WITHDRAWALS_ENABLED
  };
})();
