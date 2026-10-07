/**
 * DoKit — Cloud History & Sync Module
 * ====================================
 * WHAT: Two-way sync of user's journey/activity history between localStorage
 *       (device-local) and Firestore (cloud). Enables cross-device history.
 *
 * WHY: Users switch devices (phone → laptop). Without sync, their "Your Journey"
 *      timeline would be empty on each new device. This module ensures history
 *      follows the user.
 *
 * HOW IT WORKS:
 *   1. PUSH: Unsynced local entries → Firestore (batched write)
 *      - Tracks synced timestamps in localStorage ("dokit_journey_synced")
 *      - Only pushes entries not yet synced (dedupe by timestamp)
 *   2. PULL: Firestore entries → merged with local (dedupe by ts+tool+action)
 *      - Sorts newest-first, limits to 100 entries
 *      - Updates localStorage with merged result
 *   3. Full sync = pushPending() then pullAndMerge()
 *
 * OFFLINE STRATEGY:
 *   - localStorage is the source of truth (always available)
 *   - Firestore sync is best-effort (fails silently offline)
 *   - Dashboard calls DKSync.sync() on load and when tab becomes visible
 *
 * DEPENDENCIES:
 *   - window.DKF (Firebase wrapper) — optional, sync skipped if unavailable
 *   - window.Journey (journey.js) — shares the "dokit_journey" localStorage key
 *   - localStorage — required
 *
 * FIRESTORE SCHEMA:
 *   users/{uid}/tool_runs/{autoId}:
 *     - tool: string, action: string, details: string
 *     - ts: number (client timestamp, for ordering)
 *     - createdAt: Timestamp (server timestamp)
 *
 * SECURITY:
 *   - Only syncs when user is signed in (getUid() returns null otherwise)
 *   - Never throws — all operations wrapped in try/catch or .catch()
 *   - Batch writes are atomic (all-or-nothing per batch)
 *
 * @module DKSync
 */
(function () {
  "use strict";

  var LOCAL_KEY = "dokit_journey";
  var SYNC_KEY = "dokit_journey_synced"; // timestamps already pushed to cloud

  /**
   * Read journey entries from localStorage.
   * WHY localStorage: Always available, works offline. This is the source of truth
   * for the user's history on this device. Cloud sync merges into this.
   * @returns {Array<object>} Entries newest-first, or [] on error/corrupt data.
   */
  function readLocal() {
    try {
      var v = localStorage.getItem(LOCAL_KEY);
      var a = v ? JSON.parse(v) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  /**
   * Write journey entries to localStorage, capped at 100 entries.
   * WHY cap at 100: Prevents unbounded storage growth. Older entries are less
   * useful; 100 covers months of activity for most users.
   * Silently fails if storage unavailable (private mode, quota exceeded).
   * @param {Array<object>} a - Entries to persist (newest first).
   */
  function writeLocal(a) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(a.slice(0, 100))); } catch (e) {}
  }

  /**
   * Read the list of timestamps already pushed to Firestore.
   * WHY track synced: Prevents duplicate cloud writes. Without this, every sync
   * would re-upload all 100 entries. We only push what's new.
   * @returns {Array<number>} Timestamps (ms) of synced entries.
   */
  function readSynced() {
    try {
      var v = localStorage.getItem(SYNC_KEY);
      var a = v ? JSON.parse(v) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  /**
   * Persist synced timestamps. Capped at 200 (covers 100 entries + margin for
   * clock-skew duplicates). Oldest timestamps pruned first.
   * @param {Array<number>} a - Timestamps to persist.
   */
  function writeSynced(a) {
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(a.slice(0, 200))); } catch (e) {}
  }

  /**
   * Get the Firestore database instance via the DKF wrapper.
   * WHY wrapper: DKF (js/firebase.js) handles Firebase initialization, App Check,
   * and graceful degradation. We never touch firebase.* directly.
   * @returns {object|null} Firestore instance, or null if Firebase unavailable.
   */
  function getDb() {
    try {
      if (!window.DKF || !DKF.db) return null;
      return DKF.db();
    } catch (e) { return null; }
  }

  /**
   * Get the current signed-in user's UID.
   * WHY needed: Cloud sync is per-user (users/{uid}/tool_runs). Anonymous users
   * only get local history — no UID means no cloud sync, which is correct.
   * @returns {string|null} Firebase UID, or null if signed out / unavailable.
   */
  function getUid() {
    try {
      var auth = (window.DKF && DKF.auth && DKF.auth()) || null;
      var user = auth && auth.currentUser;
      return user && user.uid ? user.uid : null;
    } catch (e) { return null; }
  }

  /**
   * Push unsynced local journey entries to Firestore.
   * Uses batched writes for efficiency. Tracks synced timestamps to avoid duplicates.
   * @returns {Promise<number>} Count of entries pushed (0 if none or offline).
   */
  function pushPending() {
    var db = getDb(), uid = getUid();
    if (!db || !uid) return Promise.resolve(0);

    var local = readLocal();
    var synced = readSynced();
    var syncedSet = {};
    synced.forEach(function (ts) { syncedSet[ts] = 1; });

    var pending = local.filter(function (e) { return !syncedSet[e.ts]; });
    if (!pending.length) return Promise.resolve(0);

    var col = db.collection("users").doc(uid).collection("tool_runs");
    var batch = db.batch();
    pending.forEach(function (e) {
      var ref = col.doc();
      batch.set(ref, {
        tool: e.tool || "",
        action: e.action || "",
        details: e.details || "",
        ts: e.ts || Date.now(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    return batch.commit().then(function () {
      var newSynced = synced.concat(pending.map(function (e) { return e.ts; }));
      writeSynced(newSynced);
      return pending.length;
    }).catch(function () { return 0; });
  }

  /**
   * Pull journey entries from Firestore and merge with local storage.
   * Deduplicates by (timestamp + tool + action) composite key.
   * Updates localStorage with the merged, sorted result.
   * @returns {Promise<Array>} Merged entries, newest first.
   */
  function pullAndMerge() {
    var db = getDb(), uid = getUid();
    if (!db || !uid) return Promise.resolve(readLocal());

    return db.collection("users").doc(uid).collection("tool_runs")
      .orderBy("ts", "desc").limit(100).get()
      .then(function (snap) {
        var cloud = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          cloud.push({
            tool: d.tool || "",
            action: d.action || "",
            details: d.details || "",
            ts: d.ts || 0
          });
        });

        var local = readLocal();
        var seen = {};
        local.forEach(function (e) { seen[e.ts + "|" + e.tool + "|" + e.action] = 1; });

        var merged = local.slice();
        cloud.forEach(function (e) {
          var key = e.ts + "|" + e.tool + "|" + e.action;
          if (!seen[key]) {
            merged.push(e);
            seen[key] = 1;
          }
        });

        // Sort newest first, limit 100
        merged.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
        merged = merged.slice(0, 100);
        writeLocal(merged);

        // Mark cloud entries as synced
        var synced = readSynced();
        var syncedSet = {};
        synced.forEach(function (ts) { syncedSet[ts] = 1; });
        cloud.forEach(function (e) { if (!syncedSet[e.ts]) { synced.push(e.ts); syncedSet[e.ts] = 1; } });
        writeSynced(synced);

        return merged;
      })
      .catch(function () { return readLocal(); });
  }

  /**
   * Perform full two-way sync: push local changes first, then pull and merge.
   * Push-first ensures local entries aren't lost if pull overwrites.
   * @returns {Promise<Array>} Merged entries after sync.
   */
  function sync() {
    return pushPending().then(pullAndMerge);
  }

  window.DKSync = {
    sync: sync,
    pushPending: pushPending,
    pullAndMerge: pullAndMerge,
    getUid: getUid
  };
})();
