/* ============================================================
   TypeMaster — charts.js : tiny dependency-free canvas charts
   ============================================================ */
const Charts = {
  /* Draws a dual-line chart: labels[], seriesA (WPM, blue), seriesB (Acc %, purple).
     Handles devicePixelRatio for crisp rendering. */
  trend(canvas, labels, wpm, acc) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 600, H = 260;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const grid = css.getPropertyValue("--border").trim() || "#e2e8f0";
    const muted = css.getPropertyValue("--muted").trim() || "#64748b";
    const padL = 44, padR = 44, padT = 18, padB = 34;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxW = Math.max(10, ...wpm) * 1.15;

    ctx.clearRect(0, 0, W, H);
    // gridlines + y labels (WPM on left, % on right)
    ctx.font = "11px system-ui"; ctx.fillStyle = muted;
    for (let g = 0; g <= 4; g++) {
      const y = padT + (ih * g) / 4;
      ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(Math.round(maxW * (1 - g / 4)), 6, y + 4);
      ctx.fillText(Math.round(100 * (1 - g / 4)) + "%", W - padR + 6, y + 4);
    }
    const n = wpm.length;
    const x = i => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const yW = v => padT + ih * (1 - v / maxW);
    const yA = v => padT + ih * (1 - v / 100);

    const line = (data, yFn, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      data.forEach((v, i) => { const px = x(i), py = yFn(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
      ctx.fillStyle = color;
      data.forEach((v, i) => { ctx.beginPath(); ctx.arc(x(i), yFn(v), 3.5, 0, 7); ctx.fill(); });
    };
    line(wpm, yW, "#1a56db");
    line(acc, yA, "#7c3aed");

    // x labels (first/mid/last to avoid crowding)
    ctx.fillStyle = muted;
    const picks = n <= 6 ? [...Array(n).keys()] : [0, Math.floor(n / 2), n - 1];
    picks.forEach(i => ctx.fillText(labels[i], x(i) - 14, H - 12));

    // legend
    ctx.fillStyle = "#1a56db"; ctx.fillRect(padL, 4, 14, 4);
    ctx.fillStyle = muted; ctx.fillText("WPM", padL + 18, 10);
    ctx.fillStyle = "#7c3aed"; ctx.fillRect(padL + 70, 4, 14, 4);
    ctx.fillStyle = muted; ctx.fillText("Accuracy %", padL + 88, 10);
  },

  /* 7-day streak calendar: cells for last 7 days, filled if practiced. */
  streakCal(container, progress) {
    const practiced = new Set();
    (progress.tests || []).forEach(t => practiced.add(new Date(t.date).toDateString()));
    Object.keys(progress.lessons || {}).forEach(() => {}); // lessons counted via streak.last below
    if (progress.streak && progress.streak.last) practiced.add(progress.streak.last);
    // NOTE: lesson completion dates aren't stored per-day; streak.last covers recent activity.
    container.innerHTML = "";
    const names = ["S", "M", "T", "W", "T", "F", "S"];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(Date.now() - d * 864e5);
      const cell = document.createElement("div");
      const hit = practiced.has(day.toDateString());
      cell.style.cssText = "text-align:center;padding:10px 4px;border-radius:10px;font-weight:700;" +
        (hit ? "background:var(--primary);color:#fff;" : "background:var(--surface-2);color:var(--muted);");
      cell.innerHTML = `<div style="font-size:.75rem">${names[day.getDay()]}</div><div>${day.getDate()}</div>`;
      cell.title = day.toDateString() + (hit ? " ✓" : "");
      container.appendChild(cell);
    }
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(7,1fr)";
    container.style.gap = "8px";
  }
};
