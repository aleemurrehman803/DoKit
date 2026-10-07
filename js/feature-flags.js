/* DoKit — deterministic feature-flag bucketing (frontend helper).
 *
 * Used by the admin panel (rollout % sliders on flags) and by A/B
 * experiments. Bucketing is deterministic per (subject, key): the same user
 * always lands in the same bucket — no flicker between page loads.
 *
 *   DKFlags.inRollout(uid, "new_checkout", 25)  -> true for ~25% of users
 *   DKFlags.variantFor(uid, "hero_test", 50)    -> "A" or "B"
 *
 * Vanilla JS, no dependencies, CSP-safe. Exposes window.DKFlags.
 */
(function () {
  "use strict";

  /* djb2 — small, fast, deterministic string hash. */
  function hashStr(s) {
    s = String(s == null ? "" : s);
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  /* 0..99 bucket for a (subject, key) pair. */
  function bucket(subject, key) {
    return hashStr(String(subject) + "::" + String(key)) % 100;
  }

  /* True when the subject falls inside the first `pct` percent (0-100). */
  function inRollout(subject, key, pct) {
    pct = Number(pct);
    if (!(pct > 0)) return false;
    if (pct >= 100) return true;
    return bucket(subject, key) < pct;
  }

  /* "A"/"B" split for experiments: splitPct % see B, rest see A. */
  function variantFor(subject, expKey, splitPct) {
    return inRollout(subject, String(expKey) + "::variant", Number(splitPct) || 50) ? "B" : "A";
  }

  window.DKFlags = {
    hashStr: hashStr,
    bucket: bucket,
    inRollout: inRollout,
    variantFor: variantFor
  };
})();
