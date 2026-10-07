/* DoKit — lightweight canvas CAPTCHA. No external keys or services needed.
   Shows a fresh distorted code on every page load and after every attempt.
   Usage:
     var cap = DKCaptcha.init(canvasEl, inputEl, refreshBtnEl);
     if (!cap.validate()) { cap.refresh(); /* show error *\/ return; }
*/
(function () {
  "use strict";

  var CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  var LEN = 6;

  function rand(n) { return Math.floor(Math.random() * n); }

  function makeCode() {
    var s = "";
    for (var i = 0; i < LEN; i++) s += CHARS.charAt(rand(CHARS.length));
    return s;
  }

  function draw(canvas, code) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var W = canvas.width, H = canvas.height;
    var i, x, y, ang;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f4f2ff";
    ctx.fillRect(0, 0, W, H);
    // noise dots
    for (i = 0; i < 70; i++) {
      ctx.fillStyle = "rgba(108,76,241," + (0.06 + Math.random() * 0.16).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 0, 6.3);
      ctx.fill();
    }
    // distorted characters
    var step = W / (code.length + 1);
    var colors = ["#23232f", "#6C4CF1", "#b3541e", "#1e7b54", "#a32c2c"];
    for (i = 0; i < code.length; i++) {
      x = step * (i + 1);
      y = H / 2 + (Math.random() * 12 - 6);
      ang = (Math.random() * 36 - 18) * Math.PI / 180;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.font = "bold " + (24 + rand(10)) + "px Verdana, Geneva, sans-serif";
      ctx.fillStyle = colors[rand(colors.length)];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code.charAt(i), 0, 0);
      ctx.restore();
    }
    // noise curves
    ctx.lineWidth = 1.5;
    for (i = 0; i < 4; i++) {
      ctx.strokeStyle = "rgba(108,76,241," + (0.25 + Math.random() * 0.25).toFixed(2) + ")";
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.bezierCurveTo(Math.random() * W, Math.random() * H,
                        Math.random() * W, Math.random() * H,
                        Math.random() * W, Math.random() * H);
      ctx.stroke();
    }
  }

  window.DKCaptcha = {
    init: function (canvas, input, refreshBtn, audioBtn) {
      var state = { code: "" };
      function refresh() {
        state.code = makeCode();
        draw(canvas, state.code);
        if (input) input.value = "";
      }
      function speak() {
        if (!("speechSynthesis" in window)) return;
        try {
          window.speechSynthesis.cancel();
          // Speak each character separately for clarity
          var chars = state.code.split("").join(" ");
          var u = new SpeechSynthesisUtterance(chars);
          u.rate = 0.8;
          u.lang = "en-US";
          window.speechSynthesis.speak(u);
        } catch (e) {}
      }
      if (refreshBtn) {
        refreshBtn.addEventListener("click", function (ev) { ev.preventDefault(); refresh(); });
      }
      if (audioBtn) {
        audioBtn.addEventListener("click", function (ev) { ev.preventDefault(); speak(); });
      }
      refresh();
      return {
        refresh: refresh,
        speak: speak,
        validate: function () {
          if (!input) return false;
          var v = (input.value || "").trim().toLowerCase();
          return v.length === LEN && v === state.code.toLowerCase();
        }
      };
    }
  };
})();
