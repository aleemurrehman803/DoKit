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
 * RATE LIMITING:
 *   Cooldowns are stored in the user's typefight_profile doc as
 *   lastEarn: { <key>: <timestamp ms> }. This is advisory (a user could
 *   tamper with their own browser clock) — production would enforce
 *   cooldowns server-side. Firestore rules still prevent editing the
 *   ledger itself.
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
   * Claim coins for an earn key (writes ledger + updates cooldown stamp).
   * Resolves with { entry } on success, or { error, waitMs } if on cooldown.
   * @param {string} uid
   * @param {string} key - Earn key.
   * @param {number} [coinsOverride] - For lessons (default LESSON_COINS).
   * @returns {Promise<object>}
   */
  function claim(uid, key, coinsOverride) {
    var def = EARN[key];
    var coins = (coinsOverride != null) ? coinsOverride : (def ? def.coins : LESSON_COINS);
    var label = def ? def.label : ("Lesson complete (" + key.replace("lesson_", "") + ")");
    return TF.getProfile(uid).then(function (profile) {
      var check = canEarn(profile, key);
      if (!check.ok) return { error: "cooldown", waitMs: check.waitMs };
      return TF.ledgerAppend(uid, coins, "earn:" + key).then(function (entry) {
        // Stamp the cooldown (merge into profile; best-effort).
        var stamp = { lastEarn: {} };
        stamp.lastEarn[key] = Date.now();
        return TF.saveProfile(uid, stamp).catch(function () {}).then(function () {
          return { entry: entry, coins: coins };
        });
      });
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
    var coins = BATTLE_REWARDS[place] || 10;
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

  window.TFWallet = {
    EARN: EARN,
    LESSON_COINS: LESSON_COINS,
    BATTLE_REWARDS: BATTLE_REWARDS,
    canEarn: canEarn,
    claim: claim,
    awardBattle: awardBattle,
    fmtWait: fmtWait
  };
})();
