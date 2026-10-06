/* ============================================================
   TypeMaster — keyboard.js : on-screen QWERTY guide
   Keys are color-coded by standard touch-typing finger zones.
   Keyboard.highlight(char) spotlights the NEXT key to press.
   ============================================================ */

const Keyboard = (() => {
  // rows of [display, value, finger, wide?]
  const ROWS = [
    [["`","`","lpinky"],["1","1","lpinky"],["2","2","lring"],["3","3","lmiddle"],["4","4","lindex"],
     ["5","5","lindex"],["6","6","rindex"],["7","7","rindex"],["8","8","rmiddle"],["9","9","rring"],
     ["0","0","rpinky"],["-","-","rpinky"],["=","=","rpinky"],["Backspace","Backspace","rpinky",1]],
    [["Tab","Tab","lpinky",1],["q","q","lpinky"],["w","w","lring"],["e","e","lmiddle"],["r","r","lindex"],
     ["t","t","lindex"],["y","y","rindex"],["u","u","rindex"],["i","i","rmiddle"],["o","o","rring"],
     ["p","p","rpinky"],["[","[","rpinky"],["]","]","rpinky"]],
    [["Caps","CapsLock","lpinky",1],["a","a","lpinky"],["s","s","lring"],["d","d","lmiddle"],["f","f","lindex"],
     ["g","g","lindex"],["h","h","rindex"],["j","j","rindex"],["k","k","rmiddle"],["l","l","rring"],
     [";", ";","rpinky"],["'","'","rpinky"],["Enter","Enter","rpinky",1]],
    [["Shift","Shift","lpinky",1],["z","z","lpinky"],["x","x","lring"],["c","c","lmiddle"],["v","v","lindex"],
     ["b","b","lindex"],["n","n","rindex"],["m","m","rindex"],[",",",","rmiddle"],[".",".","rring"],
     ["/","/","rpinky"],["Shift","Shift","rpinky",1]],
    [["Space"," ","thumb",2]]
  ];

  let keyEls = {};   // value(lower) -> element
  let hintEl = null;

  function fingerName(f) {
    const names = (UI.strings && UI.strings.finger_names) || {};
    return names[f] || f;
  }

  function render(container, hintTarget) {
    container.innerHTML = "";
    container.className = "kb";
    keyEls = {};
    ROWS.forEach(row => {
      const r = document.createElement("div");
      r.className = "kb-row";
      row.forEach(([label, val, finger, wide]) => {
        const k = document.createElement("div");
        k.className = "key f-" + finger + (wide ? " wide" : "") + (val === " " ? " space" : "");
        k.textContent = label;
        k.dataset.val = val.toLowerCase();
        r.appendChild(k);
        if (!keyEls[k.dataset.val]) keyEls[k.dataset.val] = k;
      });
      container.appendChild(r);
    });
    hintEl = hintTarget || null;
  }

  function highlight(char) {
    Object.values(keyEls).forEach(el => el.classList.remove("next"));
    if (!char) { if (hintEl) hintEl.textContent = ""; return; }
    const key = char === "\n" ? "enter" : char.toLowerCase();
    const el = keyEls[key];
    if (el) {
      el.classList.add("next");
      const finger = (el.className.match(/f-(\w+)/) || [])[1];
      if (hintEl && UI.strings) {
        const shown = char === " " ? "Space" : char === "\n" ? "Enter" : char;
        hintEl.textContent = `${UI.t("press_key")} "${shown}" ${UI.t("with_finger")} ${fingerName(finger)}`;
      }
    } else if (hintEl) hintEl.textContent = "";
  }

  function pressFlash(char) {
    const key = char === "\n" ? "enter" : (char || "").toLowerCase();
    const el = keyEls[key];
    if (el) { el.classList.add("pressed"); setTimeout(() => el.classList.remove("pressed"), 120); }
  }

  return { render, highlight, pressFlash };
})();
