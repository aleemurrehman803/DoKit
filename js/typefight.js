/* DoKit — TypeFight shared module (virtual coins mode).
 *
 * WHAT THIS IS:
 *   Shared helpers for the TypeFight typing-competition section:
 *   profile, wallet (immutable coin ledger), battles, certificates.
 *
 *   ALL COINS ARE VIRTUAL — they have no cash value and cannot be
 *   withdrawn or exchanged. This is stated on every user-facing page.
 *
 * SECURITY MODEL:
 *   - Users must be signed in (Firebase Auth) to use TypeFight pages.
 *   - The coin ledger (users/{uid}/coin_ledger) is APPEND-ONLY: entries
 *     can be created but never updated or deleted (enforced by Firestore
 *     rules — see note at the bottom of this file).
 *   - Each ledger entry links to the previous entry's hash, forming a
 *     tamper-evident chain. If anyone edits history, the chain breaks.
 *   - Certificates are signed with a client-side keyed hash. Honest
 *     limitation: true unforgeable signing needs a server. The verify
 *     page recomputes the signature; a backend would do this with a
 *     secret key instead.
 *
 * DEPENDENCIES: firebase-compat SDK + js/firebase.js (window.DKF).
 * Load order: firebase-app-compat.js, firebase-auth-compat.js,
 *             firebase-firestore-compat.js, js/firebase.js, then this file.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * Crypto helpers
   * ------------------------------------------------------------------ */

  /**
   * SHA-256 hex digest of a UTF-8 string.
   * Uses the Web Crypto API (available in all modern browsers, including
   * the GitHub Pages HTTPS origin). Async because crypto.subtle is async.
   * @param {string} str - Input string.
   * @returns {Promise<string>} Lowercase hex digest (64 chars).
   */
  function sha256(str) {
    var bytes = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      var arr = new Uint8Array(buf);
      var hex = "";
      for (var i = 0; i < arr.length; i++) {
        hex += ("0" + arr[i].toString(16)).slice(-2);
      }
      return hex;
    });
  }

  /**
   * Generate a random ID suitable for certificate / document IDs.
   * Uses crypto.getRandomValues (not Math.random) so IDs are unpredictable.
   * @param {number} len - Desired length in characters (default 12).
   * @returns {string} URL-safe random string.
   */
  function randomId(len) {
    len = len || 12;
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var rnd = new Uint8Array(len);
    crypto.getRandomValues(rnd);
    var out = "";
    for (var i = 0; i < len; i++) out += chars[rnd[i] % chars.length];
    return out;
  }

  /* ------------------------------------------------------------------
   * XSS-safe HTML escaping (all user content rendered via innerHTML
   * MUST go through this).
   * ------------------------------------------------------------------ */
  /* Shared esc (js/dk-utils.js) with local fallback — resolved once at load. */
  var esc = (window.DKUtils && DKUtils.esc) || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------------------
   * Auth gate
   * ------------------------------------------------------------------ */

  /**
   * Ensure a Firebase user is signed in before showing TypeFight content.
   * @param {string} gateId  - ID of the "please sign in" gate element.
   * @param {string} appId   - ID of the main app element (hidden until authed).
   * @param {string} returnUrl - Where login should send the user back to.
   * @returns {Promise<object|null>} Resolves with the Firebase user, or null
   *          if not signed in (gate is shown instead).
   */
  function requireAuth(gateId, appId, returnUrl) {
    return new Promise(function (resolve) {
      var gate = document.getElementById(gateId);
      var app = document.getElementById(appId);
      function showGate() {
        if (gate) gate.style.display = "";
        if (app) app.style.display = "none";
        resolve(null);
      }
      if (!window.DKF || !DKF.auth()) { showGate(); return; }
      DKF.onUser(function (user) {
        if (!user) { showGate(); return; }
        if (gate) gate.style.display = "none";
        if (app) app.style.display = "";
        // Keep a lightweight user doc in sync (best-effort).
        try { DKF.ensureUserDoc(user); } catch (e) {}
        resolve(user);
      });
      // Fix the login link to return here after sign-in.
      try {
        var loginLink = gate && gate.querySelector('a[href*="login.html"]');
        if (loginLink && returnUrl) {
          loginLink.href = "../account/login.html?next=" + encodeURIComponent(returnUrl);
        }
      } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------
   * Firestore refs
   * ------------------------------------------------------------------ */
  function db() { return (window.DKF && DKF.db()) || null; }

  /** users/{uid}/coin_ledger collection ref. */
  function ledgerRef(uid) {
    return db().collection("users").doc(uid).collection("coin_ledger");
  }

  /** users/{uid}/typefight_profile document ref (single doc, id "profile"). */
  function profileRef(uid) {
    return db().collection("users").doc(uid).collection("typefight_profile").doc("profile");
  }

  /* ------------------------------------------------------------------
   * Immutable coin ledger (hash-chained, append-only)
   *
   * Each entry: { amount, reason, clientTs, ts (server), prevHash, hash }
   *   hash = SHA256(prevHash + "|" + uid + "|" + amount + "|" + reason
   *                 + "|" + clientTs)
   * The first entry uses prevHash = "GENESIS".
   *
   * Balance is ALWAYS derived as the sum of the ledger — never stored
   * separately — so it cannot drift out of sync with history. (The
   * users/{uid}.coins field is a cached copy for quick reads; the
   * ledger sum is the source of truth.)
   *
   * Chain head: users/{uid}.lastLedgerHash mirrors the latest entry's
   * hash. It is the ONLY source ledgerAppend trusts for prevHash once
   * present; a missing field is bootstrapped once from the latest
   * entry (legacy users — see ledgerAppend step 2).
   *
   * TWO-PHASE APPEND (R1, 12 Nov 2026 — live Firestore rules split the
   * append because rules evaluate each write against PRE-transaction
   * state and cannot see the other write in the same transaction):
   *   Phase 1 (transaction): create the entry with DETERMINISTIC id =
   *     its hash, and advance lastLedgerHash to that hash. NO coins
   *     change here — the transaction only links the chain.
   *   Phase 2 (plain write): credit the coins (coins = newCoins) and
   *     stamp lastCreditedHash = the entry hash. The rules accept this
   *     write only if coins == old coins + entry amount exactly and
   *     lastCreditedHash == the head — so a stale or replayed credit
   *     is denied, never applied twice.
   *   settlePending(uid): if phase 1 committed but phase 2 never
   *     landed (lost response / crash), the entry is a valid chain
   *     link whose amount was never credited. The next append (or
   *     retry) settles it first: credit the head entry's amount and
   *     stamp lastCreditedHash = head. Best-effort, never throws.
   *   A retry that finds its OWN previous entry already settled
   *   (head == credited == its hash) returns that entry instead of
   *   appending again — otherwise one earn would be credited twice.
   * ------------------------------------------------------------------ */

  /**
   * Settle a pending (phase-1-committed, phase-2-uncredited) ledger entry.
   * Reads the user doc; if lastLedgerHash exists and differs from
   * lastCreditedHash, the head entry was linked but never credited —
   * credit its amount and stamp lastCreditedHash = head. If the head
   * entry doc does NOT exist, it is a legacy entry (auto-id, created
   * by the old single-transaction client) that was already credited
   * with its coins in the old transaction — do nothing.
   * Best-effort: never throws. On any error, resolves null and the
   * caller continues (the append below will settle again / retry).
   * Resolves { entry, user }: entry is the settled entry or null,
   * and user is the user-doc data AFTER any settle update (or as read
   * when nothing settled) — the caller reuses it instead of re-reading
   * the same doc (one round trip saved per append; live, Nov 2026:
   * part of the ~10s claim delay). A null result means the settle
   * itself failed; the caller must then read the doc fresh.
   * @param {string} uid
   * @returns {Promise<{entry: object|null, user: object|null}|null>}
   */
  function settlePending(uid) {
    var db = DKF.db();
    var userRef = db.collection("users").doc(uid);
    return userRef.get().then(function (userDoc) {
      if (!userDoc.exists) return { entry: null, user: null };
      var data = userDoc.data() || {};
      var head = data.lastLedgerHash || null;
      var credited = data.lastCreditedHash || null;
      if (!head || head === credited) return { entry: null, user: data };
      return ledgerRef(uid).doc(head).get().then(function (entryDoc) {
        if (!entryDoc.exists) return { entry: null, user: data };
        var entry = entryDoc.data() || {};
        var newCoins = (data.coins | 0) + (entry.amount | 0);
        return userRef.update({
          coins: newCoins,
          lastCreditedHash: head
        }).then(function () {
          /* Post-settle state, computed locally: exactly what the
           * update above wrote, so the caller can trust it as if it
           * had re-read the doc (same values a fresh read returns). */
          data.coins = newCoins;
          data.lastCreditedHash = head;
          return { entry: entry, user: data };
        });
      });
    }).catch(function () { return null; });
  }

  /**
   * Append a coin transaction to the user's immutable ledger.
   * Positive amount = earn, negative = spend. Resolves with the new entry.
   *
   * TWO-PHASE FLOW (R1 — see the ledger header above): settlePending,
   * then a legacy head init, then phase 1 (transaction: entry with
   * deterministic id = hash + head advance, no coins) and phase 2
   * (plain write: coins + lastCreditedHash). The whole flow retries
   * up to 5 times; a retry that finds its own previous entry already
   * settled returns that entry instead of appending again.
   * @param {string} uid
   * @param {number} amount - Integer, non-zero.
   * @param {string} reason - Human-readable reason (e.g. "battle_win_1st").
   * @returns {Promise<object>} The written entry (without server ts).
   */
  function ledgerAppend(uid, amount, reason) {
    amount = Math.trunc(amount);
    reason = String(reason || "misc").slice(0, 120);
    if (!amount) return Promise.reject(new Error("amount must be non-zero"));
    var db = DKF.db();
    var col = ledgerRef(uid);
    var userRef = db.collection("users").doc(uid);
    var MAX_ATTEMPTS = 5;
    /* The previous attempt's phase-1 entry, if it committed: its hash
     * lets the retry recognise it as already-settled instead of
     * appending a second entry for the same earn. Set only after
     * phase 1 resolves (a failed phase 1 leaves nothing behind). */
    var prevAttempt = null;

    /* One attempt = steps 1-4. On ANY failure, the caller retries the
     * whole flow (fresh clientTs -> fresh hash -> fresh entry id);
     * an entry the previous attempt committed is a valid chain link
     * that settlePending credits on the retry — never deleted, and
     * its hash is never reused for a new entry. */
    function attemptOnce(attemptNo) {
      /* Step 1: settle any pending (phase-1-committed, uncredited) entry.
       * settlePending ALSO returns the user doc it already read (post-
       * settle state), so this attempt does NOT re-read it: the extra
       * read cost a full round trip on every append (live, Nov 2026:
       * part of the ~10s claim delay). A null result means settlePending
       * itself failed — fall back to a fresh read, exactly as before.
       * The values this step consumes (lastLedgerHash, lastCreditedHash)
       * are the same ones a fresh read would return; the coins credit
       * itself is computed inside the transaction below (tx.get), never
       * from this pre-read. */
      return settlePending(uid).then(function (settled) {
        if (settled && settled.user) return settled.user;
        return userRef.get().then(function (userDoc) {
          return userDoc.exists ? (userDoc.data() || {}) : {};
        });
      }).then(function (data) {
        /* Own-entry recognition: the previous attempt's entry committed
         * and settlePending just credited it (head == credited == its
         * hash). The earn has landed — return it, do NOT append again.
         * WITHOUT this, a phase-1-committed / phase-2-failed attempt
         * would be credited twice (once by settle, once by the retry's
         * fresh entry). */
        if (prevAttempt && data.lastLedgerHash === prevAttempt.hash &&
            data.lastCreditedHash === prevAttempt.hash) {
          return { done: true, entry: prevAttempt.entry };
        }
        var head = data.lastLedgerHash || null;
        if (head) return { done: false, head: head };
        /* Step 2: legacy head init — user doc has no lastLedgerHash yet.
         * If the ledger is non-empty, the latest entry is the head:
         * write it to the user doc FIRST (plain merge write, NOT in
         * the transaction) so phase 1 can anchor to it. If the ledger
         * is empty, the head is "GENESIS". */
        return col.orderBy("clientTs", "desc").limit(1).get().then(function (snap) {
          var latestHash = null;
          snap.forEach(function (d) { latestHash = d.data().hash || null; });
          if (!latestHash) return { done: false, head: "GENESIS" };
          return writeHead(latestHash).then(function () {
            return { done: false, head: latestHash };
          });
        });
      }).then(function (r) {
        if (r.done) return r.entry;
        return runPhases(r.head);
      }).catch(function (err) {
        if (attemptNo >= MAX_ATTEMPTS) throw err;
        return attemptOnce(attemptNo + 1);
      });
    }

    /* Plain head write (step 2). update() preserves the other user-doc
     * fields; if the user doc does not exist yet, create it with a
     * merge set instead. */
    function writeHead(hash) {
      return userRef.update({ lastLedgerHash: hash }).catch(function (err) {
        if (err && err.code === "not-found") {
          return userRef.set({ lastLedgerHash: hash }, { merge: true });
        }
        throw err;
      });
    }

    /* Steps 3-4: phase 1 (transaction) then phase 2 (plain write). */
    function runPhases(head) {
      /* REWORK (TYPEFIGHT, 12 Nov 2026 — fixes the T3 hash-chain fork the
       * E04-A6 gate reproduced 1-in-6 at HEAD 301cdd0): the previous fix
       * read the latest ledger entry with a PLAIN collection read inside
       * the update function and claimed "concurrent appends serialize on
       * [the user doc] and the plain read re-executes on retry — no
       * hash-chain forks". That claim was FALSE, gate-proven: a plain
       * read is INVISIBLE to Firestore transaction contention validation
       * (real Firestore tracks only transaction.get() reads). B could
       * plain-read an empty ledger (prevHash GENESIS), A could commit,
       * and B's tx.get(userRef) would then record the NEW user-doc
       * version — so B committed cleanly with the stale GENESIS
       * prevHash. No retry, forked chain, correct balances.
       * The chain head now lives ON the user doc as `lastLedgerHash`
       * and is read via tx.get(userRef) — a TRANSACTION-TRACKED read.
       * Why this serializes: the user doc is in the transaction's
       * tracked read set, so EITHER a concurrent committer bumps its
       * version first (the loser's commit fails validation, the SDK
       * retries, and the retry re-reads the fresh lastLedgerHash) OR
       * the tx.get happens after the commit (and sees the fresh field
       * directly). In both cases the new entry anchors to the true
       * latest hash and the chain stays linear.
       * That tracked-head read is UNCHANGED by the R1 two-phase split
       * below — only the coins credit moved out of the transaction
       * (the live rules evaluate each write against pre-transaction
       * state and cannot see the other write in the same transaction,
       * so the entry + head advance and the coins credit are now two
       * separate writes). Hash formula, reward math, ledger schema,
       * return value, error strings and caller contracts are unchanged. */
      return db.runTransaction(function (tx) {
        return tx.get(userRef).then(function (userDoc) {
          var currentCoins = 0;
          /* The tracked read wins when present; otherwise fall back to
           * the head resolved before the transaction (step 2 already
           * initialised it, so this covers the missing-doc case). */
          var txHead = head;
          if (userDoc.exists) {
            var data = userDoc.data() || {};
            currentCoins = data.coins | 0;
            if (data.lastLedgerHash) txHead = data.lastLedgerHash;
          }
          var newCoins = currentCoins + amount;
          // Prevent negative balance (defense in depth - rules should also enforce)
          if (newCoins < 0) {
            throw new Error("Insufficient balance: cannot go negative");
          }
          var clientTs = Date.now();
          var payload = txHead + "|" + uid + "|" + amount + "|" + reason + "|" + clientTs;
          return sha256(payload).then(function (hash) {
            var entry = {
              amount: amount,
              reason: reason,
              clientTs: clientTs,
              ts: firebase.firestore.FieldValue.serverTimestamp(),
              prevHash: txHead,
              hash: hash
            };
            /* DETERMINISTIC id = hash (the rules require id == hash);
             * head advance ONLY here — NO coins in this transaction. */
            tx.set(col.doc(hash), entry);
            tx.set(userRef, { lastLedgerHash: hash }, { merge: true });
            return { entry: entry, newCoins: newCoins, hash: hash };
          });
        });
      }).then(function (result) {
        prevAttempt = { hash: result.hash, entry: result.entry };
        /* Step 4 — phase 2, plain write (NOT a transaction): credit the
         * coins and stamp the entry as credited. If this fails (lost
         * response / stale coins under concurrency), the outer retry
         * settles the entry via settlePending and recognises it above. */
        return userRef.update({ coins: result.newCoins, lastCreditedHash: result.hash })
          .then(function () { return result.entry; });
      });
    }

    return attemptOnce(1);
  }

  /**
   * Compute the user's coin balance = sum of all ledger entries.
   * @param {string} uid
   * @returns {Promise<number>} Balance (can be 0 for new users).
   */
  function ledgerBalance(uid) {
    return ledgerRef(uid).get().then(function (snap) {
      var total = 0;
      snap.forEach(function (d) { total += (d.data().amount | 0); });
      return total;
    });
  }

  /**
   * Get recent ledger entries, newest first.
   * @param {string} uid
   * @param {number} limit - Max entries (default 50).
   * @returns {Promise<Array>} Entry objects with .id.
   */
  function ledgerHistory(uid, limit) {
    limit = limit || 50;
    return ledgerRef(uid).orderBy("clientTs", "desc").limit(limit).get()
      .then(function (snap) {
        var out = [];
        snap.forEach(function (d) {
          var data = d.data();
          data.id = d.id;
          out.push(data);
        });
        return out;
      });
  }

  /**
   * Find the most recent ledger entry for one earn key.
   * Plain read (NOT in a transaction) — used by TFWallet.earnStatus()
   * as the ledger-side cooldown check. No orderBy: a single-field
   * equality filter uses Firestore's automatic single-field indexes,
   * so no composite index is needed; the newest entry is picked
   * client-side by max clientTs. WHY the ledger, not just the profile
   * stamp: the profile stamp write (TF.saveProfile) can be DENIED by
   * Firestore rules while the ledger append succeeds, so a profile-only
   * check would let the same earn be claimed again after a reload.
   * The ledger is append-only and cannot be edited, so it is the
   * source of truth for exactly-once.
   * @param {string} uid
   * @param {string} key - Earn key, e.g. "typing_test".
   * @returns {Promise<object|null>} The newest matching entry, or null.
   */
  function ledgerLastEarn(uid, key) {
    return ledgerRef(uid).where("reason", "==", "earn:" + key).get()
      .then(function (snap) {
        var best = null;
        snap.forEach(function (d) {
          var data = d.data();
          if (!best || (Number(data.clientTs) || 0) > (Number(best.clientTs) || 0)) best = data;
        });
        return best;
      });
  }

  /**
   * Verify the hash chain integrity of a user's ledger.
   * Recomputes every hash and checks linkage. Used by the wallet page
   * to display a "chain verified" badge.
   * @param {string} uid
   * @returns {Promise<{ok:boolean, checked:number, brokenAt:number}>}
   */
  function ledgerVerify(uid) {
    return ledgerRef(uid).orderBy("clientTs", "asc").get().then(function (snap) {
      var entries = [];
      snap.forEach(function (d) { entries.push(d.data()); });
      var prevHash = "GENESIS";
      var chain = [];
      entries.forEach(function (e) { chain.push(e); });
      // Sequential async verification.
      var i = 0, brokenAt = -1;
      function step() {
        if (i >= chain.length) {
          return Promise.resolve({ ok: brokenAt === -1, checked: chain.length, brokenAt: brokenAt });
        }
        var e = chain[i];
        if (e.prevHash !== prevHash) { brokenAt = i; return Promise.resolve({ ok: false, checked: chain.length, brokenAt: brokenAt }); }
        var payload = e.prevHash + "|" + uid + "|" + e.amount + "|" + e.reason + "|" + e.clientTs;
        return sha256(payload).then(function (h) {
          /* Record only the FIRST break (where tampering started); keep scanning
           * to count all entries but don't overwrite brokenAt. */
          if (h !== e.hash) { if (brokenAt === -1) brokenAt = i; }
          else { prevHash = e.hash; }
          i++;
          return step();
        });
      }
      return step();
    });
  }

  /* ------------------------------------------------------------------
   * TypeFight profile
   * ------------------------------------------------------------------ */

  /**
   * Load the user's TypeFight profile (or null if not created yet).
   * @param {string} uid
   * @returns {Promise<object|null>}
   */
  function getProfile(uid) {
    return profileRef(uid).get().then(function (snap) {
      return snap.exists ? snap.data() : null;
    }).catch(function () { return null; });
  }

  /**
   * Save (create or overwrite) the TypeFight profile.
   * @param {string} uid
   * @param {object} data - { username, avatar, bio, country, ... }
   * @returns {Promise<void>}
   */
  function saveProfile(uid, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return profileRef(uid).set(data, { merge: true });
  }

  /* ------------------------------------------------------------------
   * Certificates (signed, publicly verifiable, HEC/IBCC-style)
   *
   * Each certificate carries:
   *   - id: random 12-char document ID (used in QR code / verify URL)
   *   - serial: human-readable registration number "DK-2026-000001",
   *     auto-incremented via a Firestore transaction on
   *     config/cert_counter (atomic — no duplicates even under race)
   *   - holder name, WPM, accuracy, issue date, kind, QR code, signature
   *
   * Signature = SHA256(id | serial | userId | username | wpm | accuracy |
   *                     date | kind | SIGN_SALT)
   * SIGN_SALT is a client-side constant. HONEST LIMITATIONS:
   *   (a) anyone who reads this source can forge signatures;
   *   (b) the counter is writable by any signed-in user, so serial gaps
   *       are possible (never duplicates — the transaction is atomic).
   * Production MUST move signing + serial issuance to a server
   * (Cloud Function) holding a real secret. The verify page recomputes
   * the signature the same way.
   * ------------------------------------------------------------------ */
  var SIGN_SALT = "dokit-typefight-v1";

  /**
   * Atomically reserve the next certificate serial number.
   * Format: DK-<year>-<6-digit zero-padded sequence>, e.g. DK-2026-000001.
   * Uses a Firestore transaction so concurrent issuances never collide.
   * @returns {Promise<string>} The reserved serial, e.g. "DK-2026-000042".
   */
  function nextSerial() {
    var ref = db().collection("config").doc("cert_counter");
    return db().runTransaction(function (t) {
      return t.get(ref).then(function (snap) {
        var seq = (snap.exists && snap.data().seq) || 0;
        seq += 1;
        t.set(ref, { seq: seq, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return seq;
      });
    }).then(function (seq) {
      var year = new Date().getFullYear();
      return "DK-" + year + "-" + String(seq).padStart(6, "0");
    });
  }

  /**
   * Create a signed certificate document in Firestore.
   * Requires the user to have a TypeFight profile (checked by caller).
   * @param {object} opts - { uid, username, wpm, accuracy, kind }
   *   kind: "battle_win" | "wpm_milestone"
   * @returns {Promise<{id:string, serial:string, signature:string}>}
   */
  function createCertificate(opts) {
    var id = randomId(12);
    var date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    var wpm = Math.round(opts.wpm);
    var accuracy = Math.round(opts.accuracy * 10) / 10;
    // Reserve the serial first (atomic transaction), then sign + write.
    return nextSerial().then(function (serial) {
      var payload = [id, serial, opts.uid, opts.username, wpm, accuracy, date, opts.kind, SIGN_SALT].join("|");
      return sha256(payload).then(function (sig) {
        var doc = {
          userId: opts.uid,
          username: opts.username,
          wpm: wpm,
          accuracy: accuracy,
          date: date,
          kind: opts.kind,
          serial: serial,
          signature: sig,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db().collection("certificates").doc(id).set(doc).then(function () {
          return { id: id, serial: serial, signature: sig };
        });
      });
    });
  }

  /**
   * Verify a certificate by document ID: fetch it and recompute the signature.
   * @param {string} certId
   * @returns {Promise<{valid:boolean, cert:object|null, reason:string}>}
   */
  function verifyCertificate(certId) {
    return db().collection("certificates").doc(certId).get().then(function (snap) {
      if (!snap.exists) return { valid: false, cert: null, reason: "not_found" };
      return checkSignature(certId, snap.data());
    }).catch(function () {
      return { valid: false, cert: null, reason: "error" };
    });
  }

  /**
   * Verify a certificate by its serial/registration number
   * (e.g. DK-2026-000001) — the HEC/IBCC-style manual lookup.
   * @param {string} serial
   * @returns {Promise<{valid:boolean, cert:object|null, id:string|null, reason:string}>}
   */
  function verifyCertificateBySerial(serial) {
    serial = String(serial || "").trim().toUpperCase();
    return db().collection("certificates").where("serial", "==", serial).limit(1).get()
      .then(function (snap) {
        if (snap.empty) return { valid: false, cert: null, id: null, reason: "not_found" };
        var found = null;
        snap.forEach(function (d) { found = { id: d.id, data: d.data() }; });
        return checkSignature(found.id, found.data).then(function (r) {
          r.id = found.id;
          return r;
        });
      })
      .catch(function () {
        return { valid: false, cert: null, id: null, reason: "error" };
      });
  }

  /**
   * Recompute the signature for a fetched certificate document and compare.
   * @param {string} certId
   * @param {object} c - Certificate document data.
   * @returns {Promise<{valid:boolean, cert:object, reason:string}>}
   */
  function checkSignature(certId, c) {
    var payload = [certId, c.serial || "", c.userId, c.username, c.wpm, c.accuracy, c.date, c.kind, SIGN_SALT].join("|");
    return sha256(payload).then(function (sig) {
      if (sig === c.signature) return { valid: true, cert: c, reason: "ok" };
      return { valid: false, cert: c, reason: "bad_signature" };
    });
  }

  /** Public verify URL for a certificate ID. */
  function verifyUrl(certId) {
    return "https://aleemurrehman803.github.io/dokit/typefight/verify/?id=" + encodeURIComponent(certId);
  }

  /* ------------------------------------------------------------------
   * Relative time formatter ("2h ago")
   * ------------------------------------------------------------------ */
  function relTime(ts) {
    var t = Number(ts) || 0;
    if (!t) return "—";
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 10) return "just now";
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24);
    if (d < 30) return d + "d ago";
    return new Date(t).toLocaleDateString();
  }

  /* Public API */
  window.TF = {
    sha256: sha256,
    randomId: randomId,
    esc: esc,
    relTime: relTime,
    requireAuth: requireAuth,
    ledgerAppend: ledgerAppend,
    settlePending: settlePending,
    ledgerBalance: ledgerBalance,
    ledgerHistory: ledgerHistory,
    ledgerLastEarn: ledgerLastEarn,
    ledgerVerify: ledgerVerify,
    getProfile: getProfile,
    saveProfile: saveProfile,
    createCertificate: createCertificate,
    verifyCertificate: verifyCertificate,
    verifyCertificateBySerial: verifyCertificateBySerial,
    verifyUrl: verifyUrl,
    SIGN_SALT: SIGN_SALT
  };
})();

/* ----------------------------------------------------------------------
 * REQUIRED FIRESTORE RULES (summary only — DO NOT paste this as rules):
 *
 * The authoritative rules live in the deploy folder
 * (dokit-audit/publish-df3ef92c-2026-11-03/deploy/firestore.rules).
 * TypeFight earns use a TWO-PHASE append (R1, 12 Nov 2026) because
 * rules evaluate each write against PRE-transaction state:
 *   Phase 1 (transaction): create the entry with id == its hash AND
 *     advance users/{uid}.lastLedgerHash to that hash (no coins).
 *   Phase 2 (plain write): set {coins, lastCreditedHash} — allowed
 *     ONLY if the entry already exists at coin_ledger/{head}, the
 *     amount is PINNED per reason (typing_test 10, daily_streak 5,
 *     lesson_* 3, battle places 50/30/20/10), and
 *     coins == old coins + entry amount exactly.
 * An UNVALIDATED owner-create rule (any entry, any amount) would be
 * an open minting hole — never use one. Suspended users cannot earn
 * or credit. Negative amounts (spends) are NOT whitelisted.
 *
 * function isAdmin() {
 *   return request.auth != null &&
 *     exists(/databases/$(database)/documents/admins/$(request.auth.uid));
 * }
 *
 * match /users/{userId}/coin_ledger/{entryId} {
 *   // Owner (or admin) can read. Owner CREATE is allowed ONLY for
 *   // TypeFight entries passing ledgerTypefightEntry() (pinned
 *   // reason/amount, exact 6-field shape, id == hash) AND
 *   // ledgerTypefightHead() (prevHash == current head), and only
 *   // while not suspended. The full rule text lives in the
 *   // deploy-folder firestore.rules — copy it from there, never
 *   // from this comment. Updates and deletes are forbidden.
 *   allow read: if isAdmin() || (request.auth != null && request.auth.uid == userId);
 *   allow update, delete: if false;
 * }
 *
 * match /users/{userId}/typefight_profile/{doc} {
 *   allow read, write: if isAdmin() || (request.auth != null && request.auth.uid == userId);
 * }
 *
 * match /certificates/{certId} {
 *   allow read: if true;   // public verification
 *   allow create: if request.auth != null
 *                 && request.resource.data.userId == request.auth.uid;
 *   allow update, delete: if false;
 * }
 *
 * match /config/cert_counter {
 *   // Any signed-in user may advance the counter (atomic transaction
 *   // prevents duplicates; gaps are possible). Production should move
 *   // serial issuance to a Cloud Function.
 *   allow read: if true;
 *   allow write: if request.auth != null;
 * }
 * ---------------------------------------------------------------------- */
