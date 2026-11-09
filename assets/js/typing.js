
(function(){
var passageEl = document.getElementById('ty-passage');
if(!passageEl) return;
var input = document.getElementById('ty-input');
var wpmEl = document.getElementById('ty-wpm'), accEl = document.getElementById('ty-acc'), timeEl = document.getElementById('ty-time'), resEl = document.getElementById('ty-result');
var PASSAGES = {
  "home": "The quick brown fox jumps over the lazy dog while the sun sets behind the quiet hills and the evening air turns cool and calm for everyone outside.",
  "top": "Quiet people often write the longest letters because they think before they speak and they choose every word with care and patience every day.",
  "words": "The time has come to put first things first and to do the work that matters most before the day grows old and the light begins to fade away.",
  "pangram": "Pack my box with five dozen liquor jugs and watch how fast the quick brown fox can jump over the lazy dog near the river bank today.",
  "sta-easy": "The cat sat on the warm rug by the door. A dog ran past the big red barn. We had hot soup for lunch and then went out to play in the soft green grass. Mom sang a sweet song while dad read the news in his old brown chair.",
  "sta-medium": "Learning to type quickly takes patience and daily practice, but the reward is worth every minute you invest. When your fingers know where each key lives, your thoughts can flow straight onto the screen without interruption. Start slowly and focus on accuracy first; speed will follow naturally as your muscle memory grows stronger each week. Many students are surprised by how fast they improve once they stop looking down at their hands. Set a small daily goal, track your words per minute, and celebrate every new personal record you achieve.",
  "sta-hard": "The expedition set out before dawn, crossing the misty valley toward mountains that rose like silent giants against the brightening sky. Every traveler carried provisions, instruments, and a quiet determination to document whatever wonders the uncharted territory might reveal. By midday the weather shifted unexpectedly; dark clouds gathered overhead and a cold wind swept through the narrow pass, forcing the group to seek shelter beneath an overhanging cliff. While they waited, the expedition leader reviewed their charts, recalculated distances, and encouraged everyone with stories of previous journeys that had survived far worse conditions. When the storm finally passed, sunlight broke through in brilliant shafts, transforming the wet landscape into a glittering panorama that made every hardship feel worthwhile. They pressed onward with renewed energy, reaching the summit just as evening painted the horizon in shades of amber and rose.",
  "sta-benchmark": "Typing speed is measured in words per minute, where each word counts as five characters including spaces and punctuation marks. Most beginners start around twenty words per minute, while experienced typists comfortably exceed sixty with high accuracy. Professional transcriptionists often reach ninety or more, a pace that requires years of deliberate practice to maintain. This benchmark text gives you a fair, balanced sample of common English to measure your true current speed. Relax your shoulders, keep your wrists straight, and type at a steady rhythm without rushing through difficult words.",
  "sta-travel": "We left the valley town at sunrise, our backpacks full and our spirits higher than the peaks ahead of us. The trail wound through pine forests where the air smelled of resin and cold mountain water. By midday we reached a meadow dotted with wildflowers, and we stopped to share bread, cheese, and stories with a shepherd who knew every path. He warned us about the afternoon clouds and pointed toward a ridge where eagles nested each spring. The climb tested our legs, but the view from the top made every step worthwhile: ranges of blue mountains fading into the distance. We camped beside a clear lake that night, too tired to speak, and fell asleep to the sound of wind moving through the trees.",
  "sta-cooking": "To make a simple lentil soup, start by heating two spoons of olive oil in a large pot over medium heat. Add one chopped onion, two carrots, and a stalk of celery, then stir for five minutes until everything softens and turns golden. Mix in two cloves of minced garlic, a spoon of cumin, and a pinch of chili flakes, letting the spices bloom for thirty seconds. Pour in one cup of rinsed red lentils and four cups of vegetable broth, then bring the pot to a gentle boil. Lower the heat and simmer for twenty-five minutes, stirring now and then, until the lentils fall apart into a thick, creamy soup. Finish with a squeeze of lemon juice, a sprinkle of salt, and fresh herbs on top before serving with warm bread.",
  "adv-tricky": "The embarrassed committee definitely decided to accommodate the necessary occurrence, despite the weird seizure of excitement. A conscientious colleague carefully separated forty pairs of scissors while rhythmically humming through the queue. Maintenance on the fluorescent lightning rod was scheduled for February, though its existence remained questionable. She misspelled embarrassment, broccoli, and vacuum in a single paragraph, then laughed at her own perseverance. Occasionally, even excellent spellers hesitate over liaison, zucchini, and the truly troublesome onomatopoeia.",
  "adv-blind": "Close your eyes to doubt and let your fingers find their way across the familiar keyboard landscape. You have practiced these motions hundreds of times; the letters are exactly where your memory expects them to be. Breathe steadily, keep a gentle rhythm, and resist the urge to peek at what you have written. Mistakes are welcome here because they reveal which keys still need your attention and care.",
  "adv-story": "Mira found the brass key beneath the old willow on the morning of her tenth birthday. It was warm, as if someone had just been holding it, though the garden stood empty and silent. That evening she tried it in every lock in the house until, at last, the attic door clicked open. Inside, dust floated in moonbeams above a small wooden chest carved with stars. She lifted the lid slowly, half afraid of what she might find waiting in the dark.",
  "adv-science": "Your heart is a muscle about the size of your fist, and it beats roughly one hundred thousand times every single day. With each beat it pushes blood through sixty thousand miles of vessels, delivering oxygen to every cell in your body. Exercise strengthens this muscle the same way lifting weights strengthens your arms: the walls grow thicker and each beat moves more blood. Scientists measure this efficiency with a number called stroke volume, which can double in trained athletes. Sleep matters too, because the heart slows at night and uses those quiet hours to repair itself. Small daily habits — a brisk walk, less salt, deeper breathing — add up to a measurably healthier heart over the years. Even standing up and stretching once an hour gives your circulation a helpful boost.",
  "adv-history": "For over a thousand years, the Silk Road carried more than silk across the deserts of Central Asia. Caravans of camels hauled spices, paper, glass, and ideas between China, Persia, and Rome, crossing passes where a single storm could erase the trail. Merchants rarely traveled the whole route; instead, goods changed hands in oasis towns like Samarkand, where traders bargained in a dozen languages. Along with cargo came astronomy, medicine, and new religions, spreading faster than any army ever marched. The road declined when sea routes proved cheaper in the 1500s, but its legacy survives in the foods we eat and the stories we still tell. Today, tourists walk the same mountain passes, and museums display the coins, pottery, and letters those ancient travelers left behind.",
  "adv-homophones": "Their team left there early because they're training for the final match this weekend. Your report is due soon, so make sure you're using the right data before you submit it. The knight rode through the night to bring the good news to the nervous town. She will write the letter tonight and read it aloud to make sure every word is right. We ate eight sandwiches by the lake, then waited an hour before swimming again. The principal explained the principle behind the new rule with admirable patience. Whether the weather holds or not, we will meet at the station at noon. She knew the new recipe by heart, but the plain flour made the cake rise less than she had planned.",
  "pro-certificate": "This is to certify that the bearer has successfully completed the TypeMaster Professional Typing Assessment, demonstrating a sustained typing speed and accuracy consistent with professional office standards. The assessment covered continuous prose, business correspondence, and data entry formats under timed conditions. Candidates are evaluated on gross words per minute, net words per minute, and overall accuracy. A minimum accuracy of ninety-five percent is required for certification at the professional level.",
  "pro-legal": "The parties hereby agree that all confidential information disclosed during the term of this agreement shall remain strictly protected and shall not be revealed to any third party without prior written consent. Any breach of this provision shall entitle the disclosing party to seek immediate injunctive relief in addition to any other remedies available under applicable law. This agreement shall remain in full force for a period of three years from the effective date specified herein.",
  "pro-medical": "The patient presented with mild hypertension and was prescribed a daily regimen of medication alongside recommended dietary adjustments. Blood pressure was recorded at one forty over ninety, with a resting heart rate of seventy-two beats per minute. The attending physician noted improved cardiovascular response following six weeks of monitored aerobic exercise. Follow-up evaluation is scheduled in three months to assess continued progress and adjust treatment as necessary.",
  "pro-business": "Dear team, please find attached the quarterly performance report for your review ahead of Thursday's strategy meeting. Revenue grew twelve percent compared to the previous quarter, driven primarily by strong results in our enterprise segment. We propose reallocating part of the marketing budget toward customer retention, which shows the highest return on investment. Kindly confirm your availability and share any agenda items by Wednesday afternoon. Best regards.",
  "pro-coding": "function calculateWPM(chars, minutes) { return (chars / 5) / minutes; } // words per minute const user = { name: 'Alex', score: 95, active: true }; if (user.active && user.score >= 90) { console.log('pass'); } for (let i = 0; i < 10; i++) { total += data[i] * 1.5; } /* loop complete */ => done!",
  "pro-academic": "This study examines the relationship between deliberate typing practice and short-term memory retention in adult learners. Sixty participants were divided into two groups: one completed ten minutes of structured typing drills daily, while the control group received no intervention. After eight weeks, the practice group demonstrated a twenty-three percent improvement in recall accuracy on standardized memory tasks. Researchers attribute this effect to the increased cognitive load of coordinating visual, motor, and linguistic processing during typing. The findings suggest that regular typing practice may serve as a low-cost tool for supporting cognitive engagement, though further longitudinal research is recommended. All data were anonymized, and the protocol was approved by the university ethics board before testing began. Future studies will explore whether similar benefits appear in younger learners and in other types of skilled manual practice.",
  "pro-email-thread": "Hi Sam, could you send me the updated figures for the March campaign before noon? Thanks, Priya. Hi Priya, sure thing — attaching the spreadsheet now. Note that the social spend is ten percent higher than we estimated. Sam. Thanks Sam. That explains the spike in impressions. Can we shift some budget from print to cover it? Priya. Good idea. I will check with finance and confirm by Thursday. Sam. Perfect. Let us review the final numbers together on Friday morning. Priya. Sounds good. I will book the small meeting room and bring printed copies. Sam. Thanks! See you at ten. Priya. Hi both, finance just confirmed the budget shift, so we are all set for the launch. Dana. Excellent news. Thanks everyone for the quick turnaround. Priya.",
  "pro-meeting-minutes": "Minutes of the product review meeting held on Tuesday, April 14th, at 10:00 AM in conference room B. Present: Dana (chair), Luis, Amara, and Jonas. Apologies: Mei. 1. The minutes of the previous meeting were approved without amendment. 2. Luis reported that the mobile update is on schedule for release on May 2nd. 3. Amara raised concerns about server capacity during peak hours; Jonas agreed to run load tests by April 24th. 4. It was decided to postpone the pricing discussion until the next meeting. The meeting closed at 11:15 AM. Next meeting: Tuesday, April 28th. 5. Dana thanked the team for the successful launch and reminded everyone to submit holiday requests by May 1st. 6. Any other business: none. Action items: Jonas to run load tests by April 24th; Amara to draft the capacity report.",
  "pro-data-entry": "Record 1041: Aisha Khan, ID 88312, order 55021, quantity 14, total $386.40, zip 90210. Record 1042: Marco Ruiz, ID 88313, order 55022, quantity 3, total $89.97, zip 60601. Record 1043: Lena Fischer, ID 88314, order 55023, quantity 27, total $1,204.55, zip 10001. Record 1044: Omar Haddad, ID 88315, order 55024, quantity 8, total $212.80, zip 75001. Record 1045: Yuki Tanaka, ID 88316, order 55025, quantity 19, total $645.22, zip 90012. Record 1046: Sara Novak, ID 88317, order 55026, quantity 5, total $149.50, zip 30301. Record 1047: David Osei, ID 88318, order 55027, quantity 11, total $298.75, zip 20001. Record 1048: Hana Sato, ID 88319, order 55028, quantity 6, total $174.30, zip 94102. Record 1049: Ivan Petrov, ID 88320, order 55029, quantity 22, total $512.16, zip 60602.",
  "pro-support-chat": "Agent: Hello! Thanks for contacting us. How can I help you today? Customer: Hi, my order arrived yesterday but one item is missing. Agent: I am sorry to hear that. Could you please share your order number? Customer: Sure, it is 77410. The missing item is the blue notebook. Agent: Thank you. I can see the order, and I will ship the notebook today at no extra charge. Customer: That is great. How long will delivery take? Agent: It should arrive within three business days. You will receive a tracking link by email. Customer: Perfect, thank you for the quick help! Agent: You are welcome! Customer: One more thing — can I change the delivery address? Agent: Of course. Please type the new address and I will update it right away. Customer: 14 Green Street, Springfield. Agent: Done! Your notebook will go to 14 Green Street, Springfield."
};
var PASSAGE_META = {
  "home": {category: "standard", name: "Home Row Basics", words: 28, version: 1, source: "live typing.js (Phase 2b)", durationValidity: {minSeconds: 30, maxSeconds: 84}},
  "top": {category: "advanced", name: "Top Row Practice", words: 24, version: 1, source: "live typing.js (Phase 2b)", durationValidity: {minSeconds: 30, maxSeconds: 72}},
  "words": {category: "standard", name: "Common Words", words: 29, version: 1, source: "live typing.js (Phase 2b)", durationValidity: {minSeconds: 30, maxSeconds: 87}},
  "pangram": {category: "professional", name: "Pangram Challenge", words: 27, version: 1, source: "live typing.js (Phase 2b)", durationValidity: {minSeconds: 30, maxSeconds: 81}},
  "sta-easy": {category: "standard", name: "Easy Text", words: 50, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 150}},
  "sta-medium": {category: "standard", name: "Medium Text", words: 90, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 270}},
  "sta-hard": {category: "standard", name: "Hard Text", words: 139, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 417}},
  "sta-benchmark": {category: "standard", name: "Benchmark", words: 90, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 270}},
  "sta-travel": {category: "standard", name: "Travel Journal", words: 125, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 375}},
  "sta-cooking": {category: "standard", name: "Cooking", words: 132, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 396}},
  "adv-tricky": {category: "advanced", name: "Tricky Spelling", words: 75, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 225}},
  "adv-blind": {category: "advanced", name: "Blind Typing", words: 68, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 204}},
  "adv-story": {category: "advanced", name: "Story Typing", words: 82, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 246}},
  "adv-science": {category: "advanced", name: "Science", words: 133, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 399}},
  "adv-history": {category: "advanced", name: "History", words: 126, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 378}},
  "adv-homophones": {category: "advanced", name: "Tricky Homophones", words: 123, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 369}},
  "pro-certificate": {category: "professional", name: "Certificate", words: 70, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 210}},
  "pro-legal": {category: "professional", name: "Legal", words: 76, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 228}},
  "pro-medical": {category: "professional", name: "Medical", words: 67, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 201}},
  "pro-business": {category: "professional", name: "Business", words: 67, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 201}},
  "pro-coding": {category: "professional", name: "Coding", words: 57, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 171}},
  "pro-academic": {category: "professional", name: "Academic Abstract", words: 134, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 402}},
  "pro-email-thread": {category: "professional", name: "Email Thread", words: 128, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 384}},
  "pro-meeting-minutes": {category: "professional", name: "Meeting Minutes", words: 136, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 408}},
  "pro-data-entry": {category: "professional", name: "Data Entry", words: 126, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 378}},
  "pro-support-chat": {category: "professional", name: "Customer Support Chat", words: 147, version: 1, source: "legacy TEST_CATALOG", durationValidity: {minSeconds: 30, maxSeconds: 441}},
};
var passage = PASSAGES.home, typed = '', started = false, startTime = 0, timer = null, limit = 60, left = 60, done = false;
// WP-5 TYPE-09 (C6 / D-6): passage picker + duration validity.
// WHY a picker: the live test had 4 passages and no way to reach the
// 22-passage legacy catalog, so 3/5/10-min durations ended after ~30 s.
// The picker lists all 26 passages (grouped by category) from the one
// PASSAGES source above; option labels are "Name (words)" — the number
// in parentheses is the passage's word count (content, not UI text).
// WHY validity: a duration D is offered for a passage only when a
// 20 WPM typist would not finish the passage before D (Arch §7.2:
// maxSeconds = words * 3, in PASSAGE_META). Options above the
// passage's maxSeconds are disabled, and an already-selected duration
// is clamped down to the longest valid one — offering a duration the
// passage cannot fill is forbidden. 600 s is valid for no passage yet
// (longest: 147 words -> 441 s); that is the honest outcome, recorded
// in WP5_TYPE09_PASSAGES.json. Exposed as window.DKTyping so
// typing-additions.js can re-apply validity after it appends the
// 180/300/600 s options (this file runs first).
var passageSel = document.getElementById('ty-passage-sel');
function validDurations(meta){
  var out = [], i, opts = [30, 60, 120, 180, 300, 600];
  for(i = 0; i < opts.length; i++){
    if(opts[i] >= meta.durationValidity.minSeconds && opts[i] <= meta.durationValidity.maxSeconds){ out.push(opts[i]); }
  }
  return out;
}
function syncMinButtons(){
  var btns = document.querySelectorAll('[data-ta-min]');
  for(var i = 0; i < btns.length; i++){
    btns[i].setAttribute('aria-pressed', parseInt(btns[i].getAttribute('data-ta-min'), 10) === limit ? 'true' : 'false');
  }
}
function applyDurationValidity(){
  if(!passageSel || !sel){ return; }
  var meta = PASSAGE_META[passageKey] || PASSAGE_META.home;
  var max = meta.durationValidity.maxSeconds;
  for(var i = 0; i < sel.options.length; i++){
    var v = parseInt(sel.options[i].value, 10);
    sel.options[i].disabled = !isNaN(v) && v > max;
  }
  if(limit > max){
    var valid = validDurations(meta);
    limit = valid.length ? valid[valid.length - 1] : 30;
    sel.value = String(limit);
    syncMinButtons();
    reset();
  }
}
if(passageSel){
  // WHY build from PASSAGE_META, not from the buttons: the picker is
  // the one place that lists every passage, so it can never point at
  // a passage that does not exist (same DRY rule as the lesson lists).
  var catOrder = ['standard', 'advanced', 'professional'];
  var catKeys = {standard: 'rsv_1307', advanced: 'rsv_1308', professional: 'rsv_1309'};
  var catFallback = {standard: 'Standard', advanced: 'Advanced', professional: 'Professional'};
  for(var ci = 0; ci < catOrder.length; ci++){
    var cat = catOrder[ci];
    var group = document.createElement('optgroup');
    group.label = (window.dkT && catKeys[cat]) ? window.dkT(catKeys[cat], catFallback[cat]) : catFallback[cat];
    for(var pk in PASSAGE_META){
      if(!PASSAGE_META.hasOwnProperty(pk) || PASSAGE_META[pk].category !== cat){ continue; }
      var o = document.createElement('option');
      o.value = pk;
      o.textContent = PASSAGE_META[pk].name + ' (' + PASSAGE_META[pk].words + ')';
      if(pk === passageKey){ o.selected = true; }
      group.appendChild(o);
    }
    passageSel.appendChild(group);
  }
  passageSel.addEventListener('change', function(){
    var k = passageSel.value;
    if(PASSAGES[k]){ reset(PASSAGES[k], k); applyDurationValidity(); }
  });
}
window.DKTyping = {applyDurationValidity: applyDurationValidity, validDurations: validDurations, passageMeta: PASSAGE_META};
// WP-4 TYPE-02: one scoring service (dk-scoring.js, docs/scoring-metrics-v2.md).
// sessionId is unique per session start (the dedup key, paper §7);
// passageKey identifies the content (paper §4). Both are stamped on
// the saved result. newSid() falls back to a Date+random id when
// DKScoring failed to load, so dedup still works — it never throws.
var sessionId = null, passageKey = 'home';
function newSid(){
  return window.DKScoring ? window.DKScoring.newSessionId()
    : ('s-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 0xFFFFFF).toString(16));
}
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
  // WP-4 TYPE-02: score through the ONE shared service (dk-scoring.js,
  // docs/scoring-metrics-v2.md §1-2) — grapheme-aware net WPM from v2.
  // The pre-v2 UTF-16 computation below is kept ONLY as the fallback
  // when DKScoring failed to load, so a failed script load never
  // breaks typing. Both paths return the same shape.
  var elapsedMs = started ? (Date.now() - startTime) : 0;
  var st = null;
  if(window.DKScoring){ st = window.DKScoring.score(passage, typed, elapsedMs, 'en'); }
  else{
    var correct = 0; for(var i = 0; i < typed.length; i++){ if(typed[i] === passage[i]) correct++; }
    var mins = elapsedMs / 60000;
    st = {correct: correct, typed: typed.length,
      wpm: mins > 0 ? Math.round((correct / 5) / mins) : 0,
      gross: mins > 0 ? Math.round((typed.length / 5) / mins) : 0,
      acc: typed.length ? Math.round(correct / typed.length * 100) : 100,
      metricVersion: 'v1-net-utf16', graphemeVersion: 'utf16', language: 'en'};
  }
  /* T085 (P5-VIS-10): WPM is 0 until a full second has elapsed — with
   * elapsed near 0 the division would flash an absurd WPM (thousands) on
   * the live display. This is a DISPLAY clamp only, not a scoring floor:
   * finish() rejects sub-second runs before it ever calls stats(), and the
   * 1s interval's first tick is at >= 1s, so scoring is exactly as before
   * (see the WPM0 FIX comment in finish()). Accuracy needs no clamp: it
   * is exact from the first keystroke. */
  var elapsedOk = elapsedMs >= 1000;
  // Net WPM counts correct graphemes only; gross WPM counts every typed
  // grapheme. Both use the same elapsed time, so the certificate can
  // show them side by side without inventing either value.
  var wpm = elapsedOk ? st.wpm : 0;
  var gross = elapsedOk ? st.gross : 0;
  var acc = st.acc;
  wpmEl.textContent = wpm; accEl.textContent = acc + '%'; syncAccRing(acc);
  return {wpm: wpm, acc: acc, correct: st.correct, gross: gross, typed: st.typed,
    metricVersion: st.metricVersion, graphemeVersion: st.graphemeVersion};
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
    // WHY (LANG-03): the anti-cheat message was a raw English literal —
    // the i18n gate's last true raw-rendered failure. It now reads the
    // `typing_too_fast` dict key (EN fallback = the previous literal).
    np.textContent = (window.dkT ? window.dkT('typing_too_fast', 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.') : 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.');
    resEl.appendChild(np);
    return;
  }
  var st = stats();
  /* Phase F F12 (rec 12): flash the FINAL WPM/accuracy once. The live
   * stats() calls during typing do NOT flash — a flash per keystroke
   * would be constant noise. Only the finished, authoritative result
   * gets the short highlight. */
  if (window.dkFlashNum) { window.dkFlashNum(wpmEl); window.dkFlashNum(accEl); }
  resEl.innerHTML = '';
  var p = document.createElement('p');
  // WHY st.typed (grapheme count) for "out of N typed": the v2 result
  // text must count the same units the score counted (paper §2). For
  // plain ASCII it equals typed.length exactly.
  var typedCount = (typeof st.typed === 'number') ? st.typed : typed.length;
  p.textContent = (window.dkT ? window.dkT('rsv_1002', 'Result: ') : 'Result: ') + st.wpm + ' WPM, ' + st.acc + (window.dkT ? window.dkT('rsv_0956', '% accuracy, ') : '% accuracy, ') + st.correct + (window.dkT ? window.dkT('rsv_0949', ' correct characters out of ') : ' correct characters out of ') + typedCount + (window.dkT ? window.dkT('rsv_0952', ' typed.') : ' typed.');
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
      // WP-4 TYPE-02: v2 tags (paper §4) — metricVersion,
      // graphemeVersion, sessionId (dedup key), contentId, mode.
      // chars stays the UTF-16 length (the historical field, kept
      // for diagnostics); graphemes is the v2 count.
      window.DK2.saveResult({date:new Date().toISOString(),type:'Test',kind:'Test',wpm:Math.round(st.wpm),acc:Math.round(st.acc),gross:Math.round(st.gross),durationSec:limit,language:'en',chars:typed.length,graphemes:st.typed,verified:!pasted,metricVersion:st.metricVersion,graphemeVersion:st.graphemeVersion,sessionId:sessionId,contentId:'en-test:'+passageKey,mode:'timed'});
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
function reset(newPassage, key){
  if(newPassage) passage = newPassage;
  if(key) passageKey = key;
  // WHY a fresh session id per reset: a reset starts a new attempt —
  // the old session's id must never be reused, or dedup (paper §7)
  // would drop the new attempt as a re-submission of the old one.
  sessionId = newSid();
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
    // WHY generate here as well as in reset(): a page load never calls
    // reset(), so the first keystroke is the session start.
    if(!sessionId) sessionId = newSid();
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
if(sel){ sel.addEventListener('change', function(){
  // WP-5 TYPE-09: clamp to the longest duration the current passage
  // can fill (Arch §7.2); a clamped pick also re-syncs the duration
  // buttons so no button claims a duration that is not running.
  limit = parseInt(sel.value, 10) || 60;
  var meta = PASSAGE_META[passageKey] || PASSAGE_META.home;
  var max = meta.durationValidity.maxSeconds;
  if(limit > max){
    var valid = validDurations(meta);
    limit = valid.length ? valid[valid.length - 1] : 30;
    sel.value = String(limit);
    syncMinButtons();
  }
  reset();
}); }
// WP-5 TYPE-09: validity runs once the duration select exists, so the
// options offered on load already match the default passage.
applyDurationValidity();
var rb = document.getElementById('ty-restart');
if(rb){ rb.addEventListener('click', function(){ reset(); }); }
document.querySelectorAll('[data-lesson]').forEach(function(b){
  b.addEventListener('click', function(){
    var k = b.getAttribute('data-lesson');
    var p = PASSAGES[k] || PASSAGES.home;
    reset(p, k);
    // WP-5 TYPE-09: the sample-lesson buttons and the passage picker
    // are two views of the same choice — keep them in sync, then
    // re-apply duration validity for the newly loaded passage.
    if(passageSel){ passageSel.value = k; }
    applyDurationValidity();
  });
});
render();
})();
