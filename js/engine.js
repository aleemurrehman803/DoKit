/* ============================================================
   TypeMaster — engine.js : keystroke-capture typing engine
   - Renders target text as per-character spans
   - A hidden offscreen input captures real keystrokes
   - Live green/red coloring, WPM + accuracy stats
   - Handles Backspace, Enter (for '\n'), and blind mode
   ============================================================ */

const Typer = {
  /**
   * opts: {
   *   textEl, inputEl, text, mode:'lesson'|'test',
   *   durationSec (test mode), blind (bool),
   *   onTick(stats), onDone(result)
   * }
   * stats/result: {gwpm, nwpm, acc, typos, elapsedSec, remainingSec,
   *               totalKeys, correctKeys, keyDelta, completedAll}
   */
  mount(opts) {
    const state = {
      text: opts.text, i: 0,
      totalKeys: 0, wrongKeys: 0,
      keyDelta: {},            // char -> {ok, bad}
      startTime: null, timer: null, done: false,
      spans: []
    };
    const textEl = opts.textEl, input = opts.inputEl;

    /* ---- render text ---- */
    textEl.innerHTML = "";
    textEl.classList.toggle("blind", !!opts.blind);
    for (const ch of state.text) {
      const s = document.createElement("span");
      s.className = "ch";
      if (ch === "\n") { s.innerHTML = "⏎<br>"; s.dataset.nl = "1"; }
      else s.textContent = ch;
      textEl.appendChild(s);
      state.spans.push(s);
    }
    const paintCursor = () => {
      state.spans.forEach(sp => sp.classList.remove("current"));
      if (state.i < state.spans.length) state.spans[state.i].classList.add("current");
    };
    paintCursor();

    /* ---- stats ---- */
    const stats = () => {
      const elapsedSec = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
      const min = Math.max(elapsedSec / 60, 1 / 3600);
      const correctKeys = state.totalKeys - state.wrongKeys;
      return {
        elapsedSec,
        remainingSec: opts.mode === "test" ? Math.max(0, (opts.durationSec || 60) - elapsedSec) : 0,
        totalKeys: state.totalKeys,
        correctKeys,
        typos: state.wrongKeys,
        gwpm: Math.round((state.totalKeys / 5) / min),
        nwpm: Math.max(0, Math.round((correctKeys / 5) / min)),
        acc: state.totalKeys ? Math.round((correctKeys / state.totalKeys) * 1000) / 10 : 100,
        keyDelta: state.keyDelta,
        completedAll: state.i >= state.text.length
      };
    };

    const bump = () => { if (opts.onTick && !state.done) opts.onTick(stats()); };

    const finish = () => {
      if (state.done) return;
      state.done = true;
      clearInterval(state.timer);
      const r = stats();
      if (opts.onDone) opts.onDone(r);
    };

    const ensureTimer = () => {
      if (!state.startTime) {
        state.startTime = Date.now();
        state.timer = setInterval(() => {
          bump();
          if (opts.mode === "test" && stats().remainingSec <= 0) finish();
        }, 250);
      }
    };

    const recordKey = (expected, matched) => {
      const k = expected === "\n" ? "Enter" : expected;
      if (!state.keyDelta[k]) state.keyDelta[k] = { ok: 0, bad: 0 };
      if (matched) state.keyDelta[k].ok++;
      else state.keyDelta[k].bad++;
    };

    /* ---- keystroke handling ---- */
    const onKey = e => {
      if (state.done) return;
      if (e.key === "Tab") { e.preventDefault(); return; }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (state.i > 0) {
          state.i--;
          const sp = state.spans[state.i];
          sp.classList.remove("ok", "bad", "typed");
          paintCursor();
        }
        return;
      }
      let typed = null;
      if (e.key === "Enter") typed = "\n";
      else if (e.key.length === 1) typed = e.key;
      else return; // Shift, Ctrl, arrows, etc.
      e.preventDefault();

      ensureTimer();
      if (state.i >= state.text.length) return;

      const expected = state.text[state.i];
      const matched = typed === expected;
      const sp = state.spans[state.i];
      sp.classList.remove("current");
      sp.classList.add(matched ? "ok" : "bad", "typed");
      state.totalKeys++;
      if (!matched) state.wrongKeys++;
      recordKey(expected, matched);
      state.i++;
      paintCursor();
      if (opts.onKey) opts.onKey(typed, state.i < state.text.length ? state.text[state.i] : null);
      bump();

      if (state.i >= state.text.length) finish(); // lesson complete
    };

    input.addEventListener("keydown", onKey);
    textEl.addEventListener("click", () => input.focus());
    // keep focus for desktop; mobile keyboards open on tap
    setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (err) {} }, 100);

    return {
      destroy() {
        clearInterval(state.timer);
        input.removeEventListener("keydown", onKey);
      },
      focus() { input.focus(); }
    };
  }
};
