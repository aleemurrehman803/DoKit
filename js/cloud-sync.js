/* DoKit — Cloud history & sync.
   Syncs journey/activity data between localStorage and Firestore.
   - Dashboard loads: merges cloud + local (dedupe by id)
   - New activities: saved to both (local immediate, cloud best-effort)
   - Works offline: local is source of truth, syncs when online + signed in.
*/
(function () {
  "use strict";

  var LOCAL_KEY = "dokit_journey";
  var SYNC_KEY = "dokit_journey_synced"; // timestamps already pushed to cloud

  function readLocal() {
    try {
      var v = localStorage.getItem(LOCAL_KEY);
      var a = v ? JSON.parse(v) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  function writeLocal(a) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(a.slice(0, 100))); } catch (e) {}
  }

  function readSynced() {
    try {
      var v = localStorage.getItem(SYNC_KEY);
      var a = v ? JSON.parse(v) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  function writeSynced(a) {
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(a.slice(0, 200))); } catch (e) {}
  }

  function getDb() {
    try {
      if (!window.DKF || !DKF.db) return null;
      return DKF.db();
    } catch (e) { return null; }
  }

  function getUid() {
    try {
      var auth = (window.DKF && DKF.auth && DKF.auth()) || null;
      var user = auth && auth.currentUser;
      return user && user.uid ? user.uid : null;
    } catch (e) { return null; }
  }

  // Push unsynced local entries to Firestore
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

  // Pull cloud entries and merge with local (dedupe by ts+tool+action)
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

  // Full sync: push pending, then pull and merge
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
