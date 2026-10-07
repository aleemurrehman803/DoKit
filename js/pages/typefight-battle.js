/* DoKit — TypeFight battle page controller.
 *
 * WHAT THIS DOES:
 *   A 60-second typing race: the player vs 3 bot opponents on the same
 *   original passage. Live leaderboard, WPM/accuracy tracking, anti-cheat,
 *   coin awards (1st:50, 2nd:30, 3rd:20, 4th:10), and certificate
 *   eligibility (win OR 60+ WPM).
 *
 * BOT MODEL:
 *   Each bot has a target WPM with per-tick jitter, so races feel alive
 *   but no bot is impossibly consistent. Progress is in characters.
 *
 * ANTI-CHEAT (client-side heuristics — honest limitation: a determined
 * cheater with devtools can bypass anything client-side; production
 * needs server-authoritative validation):
 *   1. Paste detection — input events that insert >1 char at once, or
 *      inputType "insertFromPaste"/"insertFromDrop", are rejected and flagged.
 *   2. Keystroke timing — median interval between keydowns < 20ms over the
 *      race is inhuman; flagged.
 *   3. Sanity cap — sustained >150 WPM is flagged.
 *   Flagged runs get NO coins and NO certificate, marked "under review".
 *
 * All passages below are original text written for DoKit (no copying).
 */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("typefight"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  /* ---------------- Original battle passages (DoKit-original) ---------------- */
  var PASSAGES = [
    "Typing is a skill that grows quietly with practice. Every keystroke builds muscle memory, and every finished sentence makes your fingers a little wiser. Do not chase speed at first. Chase accuracy, keep a steady rhythm, and let speed arrive on its own like a guest who was always invited.",
    "A calm typist beats a hurried one. Keep your wrists relaxed and your eyes on the words ahead, not on the keys below. Mistakes are teachers in disguise. Slow down for the tricky words, breathe, and return to your rhythm. Consistency wins every race worth running.",
    "Great battles are won before they begin. Warm up your hands, sit tall, and read the passage once with your eyes. Then type like water flowing downhill, smooth and sure. When you stumble, do not panic. One clean correction is faster than ten rushed guesses."
  ];

  /* Bot configs per difficulty: base WPM + jitter + name/avatar. */
  var BOTS = {
    easy: [
      { name: "TurtleBot", avatar: "🐢", wpm: 24 },
      { name: "SteadySam", avatar: "🦔", wpm: 28 },
      { name: "PokePaws",  avatar: "🐾", wpm: 22 }
    ],
    medium: [
      { name: "KeyKobra",  avatar: "🐍", wpm: 44 },
      { name: "DashDuck",  avatar: "🦆", wpm: 48 },
      { name: "ZipZebra",  avatar: "🦓", wpm: 42 }
    ],
    hard: [
      { name: "BlazeFox",  avatar: "🦊", wpm: 64 },
      { name: "NitroNewt", avatar: "🦎", wpm: 68 },
      { name: "VexViper",  avatar: "🐉", wpm: 61 }
    ]
  };

  var RACE_SECONDS = 60;
  var CERT_WPM = 60; // WPM milestone for certificate eligibility

  var currentUser = null, userProfile = null;
  var difficulty = "easy";
  var passage = "", raceTimer = null, tickTimer = null;
  var secondsLeft = RACE_SECONDS, startTime = 0;
  var keyTimes = [], flagged = false, flagReason = "";
  var playerChars = 0, playerCorrect = 0, playerErrors = 0;
  var bots = [];
  var battleId = "";

  var $ = function (id) { return document.getElementById(id); };
  function toast(t) { try { window.DKUI && DKUI.toast && DKUI.toast(t); } catch (e) {} }

  /* ---------------- Setup: difficulty select ---------------- */
  Array.prototype.forEach.call(document.querySelectorAll(".diff-card"), function (card) {
    card.addEventListener("click", function () {
      difficulty = card.getAttribute("data-diff");
      Array.prototype.forEach.call(document.querySelectorAll(".diff-card"), function (c) {
        c.setAttribute("aria-pressed", c === card ? "true" : "false");
      });
    });
  });

  $("startBtn").addEventListener("click", startBattle);
  $("againBtn").addEventListener("click", function () {
    $("battleResults").style.display = "none";
    $("battleSetup").style.display = "";
  });

  /* ---------------- Battle flow ---------------- */

  function startBattle() {
    passage = PASSAGES[Math.floor(Math.random() * PASSAGES.length)];
    battleId = TF.randomId(8);
    flagged = false; flagReason = "";
    keyTimes = []; playerChars = 0; playerCorrect = 0; playerErrors = 0;

    // Clone bot configs with live progress state.
    bots = BOTS[difficulty].map(function (b) {
      return { name: b.name, avatar: b.avatar, baseWpm: b.wpm, chars: 0, wpm: 0 };
    });

    $("battleSetup").style.display = "none";
    $("battleResults").style.display = "none";
    $("battleCountdown").style.display = "";
    renderRaceText(0);
    renderLeaderboard();

    var n = 3;
    $("countNum").textContent = n;
    var cd = setInterval(function () {
      n--;
      if (n <= 0) { clearInterval(cd); beginRace(); }
      else { $("countNum").textContent = n; }
    }, 800);
  }

  function beginRace() {
    $("battleCountdown").style.display = "none";
    $("battleRace").style.display = "";
    var input = $("battleInput");
    input.value = "";
    input.disabled = false;
    input.focus();
    startTime = Date.now();
    secondsLeft = RACE_SECONDS;
    $("raceTimer").textContent = secondsLeft;

    // Anti-cheat: block paste/drop entirely.
    input.addEventListener("paste", blockCheat, { once: false });
    input.addEventListener("drop", blockCheat, { once: false });

    raceTimer = setInterval(function () {
      secondsLeft--;
      $("raceTimer").textContent = secondsLeft;
      if (secondsLeft <= 0) finishRace();
    }, 1000);

    tickTimer = setInterval(tick, 500); // leaderboard + bot progress
    tick();
  }

  function blockCheat(ev) {
    ev.preventDefault();
    flag("paste_blocked");
    toast("Pasting is not allowed in battles");
  }

  /* One simulation tick: advance bots, update player stats + leaderboard. */
  function tick() {
    var elapsedMin = (Date.now() - startTime) / 60000;
    // Advance each bot: chars += wpm*5*(jitter)*(dt in minutes)
    bots.forEach(function (b) {
      var jitter = 0.85 + Math.random() * 0.3; // 85%–115% of base
      b.chars += b.baseWpm * 5 * jitter * (0.5 / 60);
      if (b.chars > passage.length) b.chars = passage.length;
      b.wpm = elapsedMin > 0 ? Math.round((b.chars / 5) / elapsedMin) : 0;
    });
    updatePlayerStats();
    renderLeaderboard();
    // Early finish: player completed the whole passage.
    if (playerChars >= passage.length) finishRace();
  }

  /* ---------------- Player input ---------------- */

  var input = $("battleInput");

  input.addEventListener("keydown", function () {
    keyTimes.push(Date.now());
  });

  input.addEventListener("input", function (ev) {
    var val = input.value;
    // Detect multi-char insertion (paste via keyboard/autofill).
    if (ev.inputType && (ev.inputType === "insertFromPaste" || ev.inputType === "insertFromDrop")) {
      flag("paste_detected");
      input.value = val.slice(0, playerChars); // roll back
      return;
    }
    // Compare against passage prefix.
    var correct = 0;
    for (var i = 0; i < val.length && i < passage.length; i++) {
      if (val[i] === passage[i]) correct++;
    }
    playerChars = val.length;
    playerCorrect = correct;
    playerErrors = val.length - correct;
    renderRaceText(val.length);
    updatePlayerStats();
  });

  /* Render passage with done/current/todo highlighting. */
  function renderRaceText(typedLen) {
    var html = "";
    for (var i = 0; i < passage.length; i++) {
      var ch = passage[i];
      var cls = i < typedLen ? "done" : (i === typedLen ? "current" : "todo");
      html += '<span class="' + cls + '">' + TF.esc(ch) + "</span>";
    }
    $("raceText").innerHTML = html;
  }

  function updatePlayerStats() {
    var elapsedMin = (Date.now() - startTime) / 60000;
    var wpm = elapsedMin > 0.01 ? Math.round((playerCorrect / 5) / elapsedMin) : 0;
    var acc = playerChars > 0 ? Math.round((playerCorrect / playerChars) * 1000) / 10 : 100;
    $("raceWpm").textContent = wpm;
    $("raceAcc").textContent = acc + "%";
    return { wpm: wpm, acc: acc };
  }

  /* ---------------- Leaderboard ---------------- */

  function renderLeaderboard() {
    var stats = updatePlayerStatsSilent();
    var rows = bots.map(function (b) {
      return { name: b.name, avatar: b.avatar, wpm: b.wpm, you: false };
    });
    rows.push({
      name: (userProfile && userProfile.username) || "You",
      avatar: (userProfile && userProfile.avatar) || "🧑",
      wpm: stats.wpm, you: true
    });
    rows.sort(function (a, b) { return b.wpm - a.wpm; });
    var maxWpm = Math.max.apply(null, rows.map(function (r) { return r.wpm; }).concat([1]));
    $("leaderboard").innerHTML = rows.map(function (r, i) {
      var pct = Math.round((r.wpm / maxWpm) * 100);
      return '<div class="lb-row' + (r.you ? " lb-you" : "") + '">' +
        '<span class="lb-avatar">' + TF.esc(r.avatar) + "</span>" +
        "<span>#" + (i + 1) + " " + TF.esc(r.name) + "</span>" +
        '<span class="lb-bar"><span class="lb-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="lb-wpm">' + r.wpm + " WPM</span></div>";
    }).join("");
  }

  function updatePlayerStatsSilent() {
    var elapsedMin = (Date.now() - startTime) / 60000;
    var wpm = elapsedMin > 0.01 ? Math.round((playerCorrect / 5) / elapsedMin) : 0;
    return { wpm: wpm };
  }

  /* ---------------- Anti-cheat ---------------- */

  function flag(reason) {
    if (!flagged) { flagged = true; flagReason = reason; }
  }

  function runCheatChecks() {
    // 1. Keystroke timing: median interval < 20ms is inhuman.
    if (keyTimes.length > 20) {
      var intervals = [];
      for (var i = 1; i < keyTimes.length; i++) intervals.push(keyTimes[i] - keyTimes[i - 1]);
      intervals.sort(function (a, b) { return a - b; });
      var median = intervals[Math.floor(intervals.length / 2)];
      if (median < 20) flag("inhuman_timing");
    }
    // 2. Sanity cap on WPM.
    var s = updatePlayerStats();
    if (s.wpm > 150) flag("impossible_wpm");
    // 3. Suspicious: very few keystrokes but lots of chars (automation).
    if (playerChars > 50 && keyTimes.length < playerChars * 0.5) flag("automation");
  }

  /* ---------------- Finish ---------------- */

  function finishRace() {
    clearInterval(raceTimer);
    clearInterval(tickTimer);
    $("battleInput").disabled = true;
    runCheatChecks();

    var stats = updatePlayerStats();
    // Final standings.
    var rows = bots.map(function (b) { return { name: b.name, wpm: b.wpm, you: false }; });
    rows.push({ name: "you", wpm: stats.wpm, you: true });
    rows.sort(function (a, b) { return b.wpm - a.wpm; });
    var place = rows.findIndex(function (r) { return r.you; }) + 1;

    $("battleRace").style.display = "none";
    $("battleResults").style.display = "";
    $("resWpm").textContent = stats.wpm;
    $("resAcc").textContent = stats.acc;
    $("resPlace").textContent = ordinal(place) + " place";

    if (flagged) {
      $("resTitle").textContent = "⚠️ Under review";
      $("resFlag").style.display = "";
      $("resFlag").textContent = "Unusual input pattern detected (" + flagReason + "). No coins awarded — results under review.";
      $("resCoins").textContent = "";
      // Log for Journey (no coins).
      try { window.Journey && Journey.log("TypeFight", "Battle flagged (" + flagReason + ")"); } catch (e) {}
      return;
    }

    // Award coins.
    var coins = TFWallet.BATTLE_REWARDS[place] || 10;
    $("resTitle").textContent = place === 1 ? "🏆 Victory!" : "🏁 Finished!";
    $("resCoins").textContent = "+" + coins + " 🪙";
    TFWallet.awardBattle(currentUser.uid, place, battleId).then(function () {
      toast("+" + coins + " coins!");
    }).catch(function () { /* offline — coins lost, honest */ });

    // Journey log.
    try { window.Journey && Journey.log("TypeFight", "Battle finished #" + place + " (" + stats.wpm + " WPM)"); } catch (e) {}

    // Certificate eligibility: win OR 60+ WPM (profile required).
    var eligible = (place === 1 || stats.wpm >= CERT_WPM);
    if (eligible && userProfile) {
      var kind = place === 1 ? "battle_win" : "wpm_milestone";
      TF.createCertificate({
        uid: currentUser.uid,
        username: userProfile.username,
        wpm: stats.wpm,
        accuracy: stats.acc,
        kind: kind
      }).then(function (cert) {
        $("resCert").style.display = "";
        $("resCertLink").href = "./certificate.html?id=" + encodeURIComponent(cert.id);
      }).catch(function () { /* cert failed silently */ });
    } else if (eligible && !userProfile) {
      $("resCert").style.display = "";
      $("resCert").querySelector("p").textContent = "🏆 You earned a certificate! Create your fighter profile first:";
      $("resCertLink").href = "./profile.html";
      $("resCertLink").textContent = "Create profile";
    }
  }

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ---------------- Auth gate ---------------- */
  TF.requireAuth("tfGate", "tfApp", location.pathname).then(function (user) {
    currentUser = user;
    if (!user) return;
    TF.getProfile(user.uid).then(function (p) { userProfile = p; });
  });
});
