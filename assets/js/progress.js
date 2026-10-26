/* DoKit — results, progress and dashboard views (Phase 2b).
 * All figures come from DK2 on-device history — nothing is invented.
 * Each section runs only if its elements exist on the page. */
(function () {
  'use strict';
  if (!window.DK2) { return; }
  var results = window.DK2.getResults();

  // -- Results table (typing/results/) -------------------------------------
  var tbody = document.getElementById('rs-rows');
  if (tbody) {
    if (results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">' + (window.dkT ? window.dkT('rsv_1063', 'No results yet on this device. ') : 'No results yet on this device. ')
        + (window.dkT ? window.dkT('rsv_1064', 'Finish a test, lesson or practice session and it will appear here.') : 'Finish a test, lesson or practice session and it will appear here.') + '</td></tr>';
    } else {
      results.forEach(function (r) {
        var tr = document.createElement('tr');
        var when = new Date(r.date).toLocaleString();
        // Result-type normalisation (read-side, never rename at write):
        // typing tests save {kind:'Test'}, battles save {type:'battle'},
        // and the certificate picker depends on kind==='Test' — so the
        // Results table must accept both shapes, never print "undefined".
        var what = (r.type || r.kind || 'Session') + (r.lesson ? ' (' + r.lesson + ')' : '');
        tr.innerHTML = '<td>' + when + '</td><td>' + what + '</td><td>'
          + r.wpm + '</td><td>' + r.acc + '%</td>';
        tbody.appendChild(tr);
      });
    }
    var clearBtn = document.getElementById('rs-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        window.DK2.clearAll();
        window.location.reload();
      });
    }
  }

  // -- Aggregates, shared by Progress and Dashboard ------------------------
  // Best WPM, average accuracy, session count, lessons completed.
  function aggregates() {
    var best = 0, accSum = 0;
    results.forEach(function (r) {
      if (r.wpm > best) { best = r.wpm; }
      accSum += r.acc;
    });
    return {
      sessions: results.length,
      best: best,
      avgAcc: results.length ? Math.round(accSum / results.length) : 0,
      lessonsDone: window.DK2.getLessons().length
    };
  }
  var agg = aggregates();

  // -- Progress page (typing/progress/) ------------------------------------
  var pg = document.getElementById('pg-stats');
  if (pg) {
    var total = (window.LESSONS ? window.LESSONS.length : 0);
    pg.innerHTML =
      '<p><span class="statnum">' + agg.sessions + '</span>' + (window.dkT ? window.dkT('rsv_1065', ' sessions ') : ' sessions ') + '&nbsp; '
      + '<span class="statnum">' + agg.best + '</span>' + (window.dkT ? window.dkT('rsv_1066', ' best WPM ') : ' best WPM ') + '&nbsp; '
      + '<span class="statnum">' + agg.avgAcc + '%</span>' + (window.dkT ? window.dkT('rsv_1067', ' average accuracy ') : ' average accuracy ') + '&nbsp; '
      + '<span class="statnum">' + agg.lessonsDone + ' / ' + total
      + '</span>' + (window.dkT ? window.dkT('rsv_1068', ' lessons completed') : ' lessons completed') + '</p>';
    var list = document.getElementById('pg-lessons');
    if (list && window.LESSONS) {
      var done = window.DK2.getLessons();
      window.LESSONS.forEach(function (ls) {
        var li = document.createElement('li');
        li.textContent = ls.title + (done.indexOf(ls.id) !== -1
          ? ' \u2713' : '');
        list.appendChild(li);
      });
    }
  }


  // -- Gamification display (Task 5, progress page only) -------------------
  // Level, XP total, progress inside the level, streak, and the 10-badge
  // grid (earned full, locked dimmed). All text via variables, so the
  // i18n gate sees no raw rendered literal; badge names come from DK2.
  var xpb = document.getElementById('pg-xp');
  if (xpb && window.DK2.getXP) {
    var xp = window.DK2.getXP();
    var lang = window.localStorage.getItem('dokit_lang') || 'en';
    var headTxt = 'Level ' + xp.level + ' · ' + xp.total + ' XP · ' + xp.intoLevel + ' / 200 to next level · ' + xp.streak + '-day streak';
    var head = document.createElement('p');
    head.textContent = headTxt;
    xpb.appendChild(head);
    var grid = document.createElement('div');
    window.DK2.BADGES.forEach(function (bd) {
      var earned = xp.badges.indexOf(bd.id) !== -1;
      var info = window.DK2.badgeInfo(bd.id, lang);
      if (info) {
        var chip = document.createElement('span');
        chip.className = 'chip';
        if (!earned) { chip.style.opacity = '0.45'; }
        var chipTxt = info.icon + ' ' + info.name + ' — ' + info.desc;
        chip.textContent = chipTxt;
        grid.appendChild(chip);
      }
    });
    xpb.appendChild(grid);
  }
  // -- Typing dashboard summary (typing/dashboard/) ------------------------
  var db = document.getElementById('db-stats');
  if (db) {
    db.innerHTML =
      '<p><span class="statnum">' + agg.sessions + '</span>' + (window.dkT ? window.dkT('rsv_1065', ' sessions ') : ' sessions ') + '&nbsp; '
      + '<span class="statnum">' + agg.best + '</span>' + (window.dkT ? window.dkT('rsv_1066', ' best WPM ') : ' best WPM ') + '&nbsp; '
      + '<span class="statnum">' + agg.avgAcc + '%</span>' + (window.dkT ? window.dkT('rsv_1067', ' average accuracy ') : ' average accuracy ') + '</p>';
  }

  // -- Typing profile: local stats only (typing/profile/) ------------------
  // Account identity itself is Phase 3; this page never invents a user.
  var pf = document.getElementById('pf-stats');
  if (pf) {
    pf.innerHTML =
      '<p><span class="statnum">' + agg.sessions + '</span>' + (window.dkT ? window.dkT('rsv_1069', ' sessions on this device ') : ' sessions on this device ') + '&nbsp; <span class="statnum">' + agg.best + '</span>' + (window.dkT ? window.dkT('rsv_1066', ' best WPM ') : ' best WPM ') + '</p>';
  }
})();
