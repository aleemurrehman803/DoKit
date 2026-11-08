
(function(){
var passageEl = document.getElementById('ty-passage');
if(!passageEl) return;
var input = document.getElementById('ty-input');
var wpmEl = document.getElementById('ty-wpm'), accEl = document.getElementById('ty-acc'), timeEl = document.getElementById('ty-time'), resEl = document.getElementById('ty-result');
var PASSAGES = {
  home: 'The quick brown fox jumps over the lazy dog while the sun sets behind the quiet hills and the evening air turns cool and calm for everyone outside.',
  top: 'Quiet people often write the longest letters because they think before they speak and they choose every word with care and patience every day.',
  words: 'The time has come to put first things first and to do the work that matters most before the day grows old and the light begins to fade away.',
  pangram: 'Pack my box with five dozen liquor jugs and watch how fast the quick brown fox can jump over the lazy dog near the river bank today.'
};
var passage = PASSAGES.home, typed = '', started = false, startTime = 0, timer = null, limit = 60, left = 60, done = false;
// WPM0 FIX (28 Oct 2026, local only): minimum elapsed time for a
// finish to count as a scored test. This is a REJECTION gate, never
// a scoring floor/divisor — see the guard inside finish().
var MIN_ELAPSED_MS = 1000;
// HOOKS (referral-complete §7): true once a paste lands during this
// test (paste event or insertFromPaste input). Decides the verified
// flag on the saved result; reset() clears it for the next test.
var pasted = false;
function render(){
  passageEl.innerHTML = '';
  for(var i = 0; i < passage.length; i++){
    var s = document.createElement('span'); s.textContent = passage[i];
    if(i < typed.length){ s.className = typed[i] === passage[i] ? 'ok' : 'bad'; }
    else if(i === typed.length){ s.className = 'cur'; }
    passageEl.appendChild(s);
  }
}
function stats(){
  var correct = 0; for(var i = 0; i < typed.length; i++){ if(typed[i] === passage[i]) correct++; }
  var mins = (Date.now() - startTime) / 60000;
  /* T085 (P5-VIS-10): WPM is 0 until a full second has elapsed — with
   * elapsed near 0 the division would flash an absurd WPM (thousands) on
   * the live display. This is a DISPLAY clamp only, not a scoring floor:
   * finish() rejects sub-second runs before it ever calls stats(), and the
   * 1s interval's first tick is at >= 1s, so scoring is exactly as before
   * (see the WPM0 FIX comment in finish()). Accuracy needs no clamp: it
   * is exact from the first keystroke. */
  var elapsedOk = mins >= 1 / 60;
  var wpm = elapsedOk && mins > 0 ? Math.round((correct / 5) / mins) : 0;
  // Net WPM counts correct characters only; gross WPM counts every typed
  // character. Both use the same elapsed time, so the certificate can
  // show them side by side without inventing either value.
  var gross = elapsedOk && mins > 0 ? Math.round((typed.length / 5) / mins) : 0;
  var acc = typed.length ? Math.round(correct / typed.length * 100) : 100;
  wpmEl.textContent = wpm; accEl.textContent = acc + '%'; syncAccRing(acc); return {wpm: wpm, acc: acc, correct: correct, gross: gross};
}
/* B77: accuracy dial — the ring fills in proportion to the same live
 * acc value, on the same keystroke cadence as the text (stats() is
 * called per keystroke by T085, and reset() calls this too). The %
 * text stays beside the ring, so colour is never the only signal.
 * Thresholds: >=95 good (green), 90-94 warn (amber), <90 bad (red) —
 * the existing --good/--amber/--bad tokens, no new colours. */
function syncAccRing(acc){
  var ring = document.getElementById('ty-acc-ring'), arc = document.getElementById('ty-acc-arc');
  if(!ring || !arc){ return; }
  arc.style.strokeDashoffset = String(100 - acc);
  ring.setAttribute('aria-valuenow', String(acc));
  ring.setAttribute('data-acc', acc >= 95 ? 'good' : (acc >= 90 ? 'warn' : 'bad'));
}
// HOOKS (referral-complete §7): stamp the signed-in user's doc with
// lastTestAt and, when set, clear coinsFrozen (a finished test proves
// the account is back in use). Read-then-update, signed-in only,
// best-effort silent: every failure path swallows, so typing never
// breaks. No privileged field is touched (coins/suspension keys are
// never in the update); the FieldValue fallback is Date.now().
function stampLastTest(){
  try{
    var db = null, auth = null;
    try{ if(window.DKA && window.DKA.db){ db = window.DKA.db(); } }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
    if(!db){ try{ if(window.firebase && window.firebase.firestore){ db = window.firebase.firestore(); } }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); } }
    try{
      if(window.DKA && window.DKA.auth){ auth = window.DKA.auth(); }
      else if(window.firebase && window.firebase.auth){ auth = window.firebase.auth(); }
    }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
    var user = auth ? auth.currentUser : null;
    if(!db || !user || !user.uid){ return; }
    var ref = db.collection('users').doc(user.uid);
    ref.get().then(function(snap){
      var d = (snap && snap.exists) ? (snap.data() || {}) : null;
      if(!d){ return; }
      var upd = {};
      try{ upd.lastTestAt = window.firebase.firestore.FieldValue.serverTimestamp(); }
      catch(e){ upd.lastTestAt = Date.now(); }
      if(d.coinsFrozen){ upd.coinsFrozen = false; }
      ref.update(upd).catch(function (e) { window.dkSwallow && window.dkSwallow(e, 'typing.js'); });
    }).catch(function (e) { window.dkSwallow && window.dkSwallow(e, 'typing.js'); });
  }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
}
// HOOKS (referral-complete §7): when a challenge marker is pending in
// localStorage, record the local completion marker the challenge
// renderer confirms. typing.js NEVER writes challenge docs — only
// this local key. The marker may be JSON ({challengeId, uid?}) or a
// bare challenge id; a marker naming another user is not ours and is
// skipped. Pending is left for the renderer to clear, so a repeated
// finish only refreshes the same marker's timestamp.
function recordChallengeDone(){
  try{
    var raw = localStorage.getItem('dk_challenge_pending');
    if(!raw){ return; }
    var challengeId = null, pendingUid = null;
    try{
      var parsed = JSON.parse(raw);
      if(parsed && typeof parsed === 'object'){ challengeId = parsed.challengeId || parsed.id || null; pendingUid = parsed.uid || parsed.toUid || null; }
      else{ challengeId = String(parsed); }
    }catch(e){ challengeId = raw; }
    if(!challengeId){ return; }
    var uid = null;
    try{
      var auth2 = null;
      if(window.DKA && window.DKA.auth){ auth2 = window.DKA.auth(); }
      else if(window.firebase && window.firebase.auth){ auth2 = window.firebase.auth(); }
      uid = auth2 ? auth2.currentUser.uid : null;
    }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
    if(pendingUid && uid && pendingUid !== uid){ return; }
    localStorage.setItem('dk_challenge_done', JSON.stringify({ challengeId: challengeId, at: Date.now() }));
  }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
}
/* P5-RTE-03: referrals.js (263 KB) is NOT loaded with the typing page —
 * only the activation writer is needed here, and only after a test
 * finishes. Idempotent shared promise, mirroring main.js ensureKb:
 * resolves true when window.DKREF lands, false on load error / 3s
 * timeout, so the finish flow never hangs and never throws. One
 * deliberate difference from ensureKb: a failed load clears the shared
 * promise so the next finished test retries (a transient failure must
 * not lose the user's referral activation for the whole session). */
var __dkRefPromise = null;
function ensureReferrals(){
  if (window.DKREF && window.DKREF.recordActivation) { return Promise.resolve(true); }
  if (__dkRefPromise) { return __dkRefPromise; }
  __dkRefPromise = new Promise(function (resolve) {
    var done = false;
    function finish(ok){
      if (!done) {
        done = true;
        if (!ok) { __dkRefPromise = null; }
        resolve(ok);
      }
    }
    try {
      var base = window.__dkJsBase || '';
      if (!base) {
        var m = document.querySelector('script[src$="assets/js/typing.js"]');
        base = m ? m.src.replace(/assets\/js\/typing\.js.*$/, 'assets/js/') : '';
      }
      if (!base) { finish(false); return; }
      var s = document.createElement('script');
      s.src = base + 'referrals.js';
      s.onload = function(){ finish(true); };
      s.onerror = function(){ finish(false); };
      document.head.appendChild(s);
      setTimeout(function(){ finish(false); }, 3000);
    } catch (e) { finish(false); }
  });
  return __dkRefPromise;
}
function finish(){
  if(done) return;
  done = true; clearInterval(timer);
  // WPM0 FIX (28 Oct 2026, local only): reject sub-second finishes
  // instead of scoring them. A same-event start+finish has elapsed 0,
  // and the old stats() guard turned that into a saved 0 WPM; flooring
  // elapsed at 1s instead would turn a paste into ~1,764 WPM. So
  // MIN_ELAPSED_MS is a REJECTION gate, never a scoring divisor: a run
  // finishing below it is not saved, not scored, and earns no XP,
  // referral activation, lastTestAt stamp, or challenge marker. The
  // user can press Restart and take the test genuinely. Runs at or
  // above the gate are scored exactly as before (stats() untouched).
  var elapsedMs = started ? (Date.now() - startTime) : 0;
  if(elapsedMs < MIN_ELAPSED_MS){
    resEl.innerHTML = '';
    var np = document.createElement('p');
    np.textContent = 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.';
    resEl.appendChild(np);
    return;
  }
  var st = stats();
  resEl.innerHTML = '';
  var p = document.createElement('p');
  p.textContent = (window.dkT ? window.dkT('rsv_1002', 'Result: ') : 'Result: ') + st.wpm + ' WPM, ' + st.acc + (window.dkT ? window.dkT('rsv_0956', '% accuracy, ') : '% accuracy, ') + st.correct + (window.dkT ? window.dkT('rsv_0949', ' correct characters out of ') : ' correct characters out of ') + typed.length + (window.dkT ? window.dkT('rsv_0952', ' typed.') : ' typed.');
  resEl.appendChild(p);
  // Phase 2b: record the finished test on this device
  // (only if the shared store loaded; never crash).
  try{
    if(window.DK2){
      // HOOKS (referral-complete §7): verified is true only when no
      // paste landed during this test. New results only — old DK2
      // results are never rewritten (DK2.saveResult stores the
      // object as given, so the flag persists for the speed-
      // milestone check, which counts verified-only results).
      window.DK2.saveResult({date:new Date().toISOString(),kind:'Test',wpm:Math.round(st.wpm),acc:Math.round(st.acc),gross:Math.round(st.gross),durationSec:limit,language:'en',chars:typed.length,verified:!pasted});
    }
  }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
  // Referral activation (silent): first consented test only; never breaks typing.
  // P5-RTE-03: referrals.js loads lazily — only after a test finishes
  // (263 KB saved up front). Already loaded (e.g. a previous test this
  // session): the writer runs synchronously, exactly as before.
  try {
    if (window.DKREF && window.DKREF.recordActivation) {
      window.DKREF.recordActivation(st.wpm, st.acc, typed.length);
    } else {
      ensureReferrals().then(function(){
        try { if (window.DKREF && window.DKREF.recordActivation) { window.DKREF.recordActivation(st.wpm, st.acc, typed.length); } } catch (e) { window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
      });
    }
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
  // HOOKS (referral-complete §7): lastTestAt (+ unfreeze) and the
  // local challenge-done marker; both silent, neither breaks typing.
  try{ stampLastTest(); }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
  try{ recordChallengeDone(); }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
  // Gamification (Task 5, historical rules): test XP + badges, once per
  // identical result per day; never breaks typing. wpm here is already
  // net-style (correct chars / 5 / minutes), i.e. historical nwpm.
  try{
    if(window.DK2 && window.DK2.afterActivity){
      var day = new Date().toISOString().slice(0, 10);
      var testKey = 'test:' + day + ':' + Math.round(st.wpm) + ':' + Math.round(st.acc);
      window.DK2.afterActivity('test', { nwpm: Math.round(st.wpm), dur: limit, acc: Math.round(st.acc) }, { testKey: testKey });
    }
  }catch(e){ window.dkSwallow && window.dkSwallow(e, 'typing.js'); }
}
function reset(newPassage){
  if(newPassage) passage = newPassage;
  typed = ''; started = false; done = false; pasted = false; clearInterval(timer); left = limit;
  input.value = ''; input.disabled = false; timeEl.textContent = left + 's'; wpmEl.textContent = '0'; accEl.textContent = '100%'; syncAccRing(100);
  resEl.innerHTML = ''; render(); input.focus();
}
// HOOKS (referral-complete §7): pasting is allowed in the typing
// test (unlike TypeFight), but a pasted test is not a verified one —
// the paste event and the insertFromPaste input type both set the
// flag that finish() turns into verified: false on the new result.
input.addEventListener('paste', function(){ pasted = true; });
input.addEventListener('input', function(ev){
  if(done) return;
  if(ev && ev.inputType === 'insertFromPaste'){ pasted = true; }
  typed = input.value;
  if(!started && typed.length > 0){
    started = true; startTime = Date.now(); left = limit;
    timer = setInterval(function(){
      left--; timeEl.textContent = left + 's';
      if(started) stats();
      if(left <= 0){ finish(); input.disabled = true; }
    }, 1000);
  }
  if(typed.length >= passage.length){ finish(); input.disabled = true; }
  /* T085 (P5-VIS-10): update the visible stats on every keystroke, not
   * only on the 1s interval — a wrong character left accuracy showing the
   * previous value (100%) for up to a second. stats() itself clamps WPM
   * to 0 in the first second, so no spike; the interval still drives the
   * countdown. */
  if(started) stats();
  render();
});
var sel = document.getElementById('ty-time-sel');
if(sel){ sel.addEventListener('change', function(){ limit = parseInt(sel.value, 10) || 60; reset(); }); }
var rb = document.getElementById('ty-restart');
if(rb){ rb.addEventListener('click', function(){ reset(); }); }
document.querySelectorAll('[data-lesson]').forEach(function(b){
  b.addEventListener('click', function(){
    var p = PASSAGES[b.getAttribute('data-lesson')] || PASSAGES.home;
    reset(p);
  });
});
render();
})();
