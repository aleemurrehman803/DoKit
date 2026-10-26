
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
  var wpm = mins > 0 ? Math.round((correct / 5) / mins) : 0;
  // Net WPM counts correct characters only; gross WPM counts every typed
  // character. Both use the same elapsed time, so the certificate can
  // show them side by side without inventing either value.
  var gross = mins > 0 ? Math.round((typed.length / 5) / mins) : 0;
  var acc = typed.length ? Math.round(correct / typed.length * 100) : 100;
  wpmEl.textContent = wpm; accEl.textContent = acc + '%'; return {wpm: wpm, acc: acc, correct: correct, gross: gross};
}
function finish(){
  if(done) return;
  done = true; clearInterval(timer);
  var st = stats();
  resEl.innerHTML = '';
  var p = document.createElement('p');
  p.textContent = (window.dkT ? window.dkT('rsv_1002', 'Result: ') : 'Result: ') + st.wpm + ' WPM, ' + st.acc + (window.dkT ? window.dkT('rsv_0956', '% accuracy, ') : '% accuracy, ') + st.correct + (window.dkT ? window.dkT('rsv_0949', ' correct characters out of ') : ' correct characters out of ') + typed.length + (window.dkT ? window.dkT('rsv_0952', ' typed.') : ' typed.');
  resEl.appendChild(p);
  // Phase 2b: record the finished test on this device
  // (only if the shared store loaded; never crash).
  try{
    if(window.DK2){
      window.DK2.saveResult({date:new Date().toISOString(),kind:'Test',wpm:Math.round(st.wpm),acc:Math.round(st.acc),gross:Math.round(st.gross),durationSec:limit,language:'en'});
    }
  }catch(e){}
  // Referral activation (silent): first consented test only; never breaks typing.
  try{ if(window.DKREF && window.DKREF.recordActivation){ window.DKREF.recordActivation(st.wpm, st.acc, typed.length); } }catch(e){}
  // Gamification (Task 5, historical rules): test XP + badges, once per
  // identical result per day; never breaks typing. wpm here is already
  // net-style (correct chars / 5 / minutes), i.e. historical nwpm.
  try{
    if(window.DK2 && window.DK2.afterActivity){
      var day = new Date().toISOString().slice(0, 10);
      var testKey = 'test:' + day + ':' + Math.round(st.wpm) + ':' + Math.round(st.acc);
      window.DK2.afterActivity('test', { nwpm: Math.round(st.wpm), dur: limit, acc: Math.round(st.acc) }, { testKey: testKey });
    }
  }catch(e){}
}
function reset(newPassage){
  if(newPassage) passage = newPassage;
  typed = ''; started = false; done = false; clearInterval(timer); left = limit;
  input.value = ''; input.disabled = false; timeEl.textContent = left + 's'; wpmEl.textContent = '0'; accEl.textContent = '100%';
  resEl.innerHTML = ''; render(); input.focus();
}
input.addEventListener('input', function(){
  if(done) return;
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
