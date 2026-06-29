import * as vscode from "vscode";

export function getWebviewContent(
  webview: vscode.Webview,
  mediaBase = ""
): string {
  const nonce = getNonce();
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    body { background: transparent; }
    #stage { width: 100%; display: block; cursor: pointer; }
    #hint {
      position: fixed; left: 0; right: 0; bottom: 4px;
      text-align: center; font-family: var(--vscode-font-family);
      font-size: 11px; opacity: 0.45; color: var(--vscode-foreground);
      pointer-events: none; user-select: none;
    }
  </style>
</head>
<body>
  <canvas id="stage"></canvas>
  <div id="hint">Click a pet to chat · double-click to rename · floor for a treat 🦴</div>
  <script nonce="${nonce}">
  (function () {
    var vscode = acquireVsCodeApi();
    var canvas = document.getElementById("stage");
    var hint = document.getElementById("hint");
    var ctx = canvas.getContext("2d");
    var MEDIA = "${mediaBase}";

    var SPRITES = {};
    function loadSprite(type, file) {
      if (!MEDIA) { return; }
      var img = new Image();
      var rec = { img: img, ok: false, frames: 1 };
      img.onload = function () {
        rec.ok = true;
        rec.frames = Math.max(1, Math.round(img.width / img.height));
      };
      img.onerror = function () { rec.ok = false; };
      img.src = MEDIA + "/" + file;
      SPRITES[type] = rec;
    }
    loadSprite("cat", "cat.png");
    loadSprite("dog", "dog.png");
    loadSprite("duck", "duck.png");
    loadSprite("robot", "robot.png");
    loadSprite("unique", "unique.png");

    var SIZES = { nano: 2, small: 3, medium: 4, large: 5 };
    var S = 3;
    var floorY = 0;
    var ceilY = 0;
    var cornerInset = 0;
    var showNames = true;
    var dpr = window.devicePixelRatio || 1;

    var PALETTES = {
      black:  { body: "#2b2b33", dark: "#16161b", belly: "#4a4a55", eye: "#f2f2f2" },
      white:  { body: "#f1f1f4", dark: "#c7c7d0", belly: "#ffffff", eye: "#1b1b22" },
      ginger: { body: "#e8924a", dark: "#b5662a", belly: "#f6c79a", eye: "#1b1b22" },
      gray:   { body: "#8a8f99", dark: "#5c616b", belly: "#c2c6cd", eye: "#1b1b22" },
      brown:  { body: "#8a5a36", dark: "#5e3a20", belly: "#c08a5e", eye: "#1b1b22" },
      gold:   { body: "#d9a441", dark: "#a9761f", belly: "#f0cd83", eye: "#1b1b22" },
      yellow: { body: "#f5d33b", dark: "#c9a017", belly: "#fff0a8", eye: "#1b1b22" }
    };
    var NOSE = "#e58aa0";
    var BEAK = "#f08a2c";

    function pal(name) { return PALETTES[name] || PALETTES.gray; }

    var PHRASES = {
      cat:    ["meow", "feed me", "nap time", "knock it off the desk", "purr...", "mine now", "ship it", "ignore the bug"],
      dog:    ["woof!", "good code!", "walk?", "treat? treat?!", "you're the best", "let's gooo", "tail wag", "best build ever"],
      duck:   ["quack", "rubber duck me", "explain the bug", "honk", "waddle waddle", "looks fine to me", "splash"],
      robot:  ["beep boop", "01000010", "compiling...", "does not compute", "recharging", "I am robot", "running diagnostics", "affirmative"],
      unique: ["???", "hello human", "compile faster", "I am unique", "01101000", "weird flex", "beep boop"]
    };
    var EATING = ["nom nom", "yum!", "more please", "*munch*", "tasty bytes"];

    function phraseFor(type) {
      var list = PHRASES[type] || PHRASES.cat;
      return list[Math.floor(Math.random() * list.length)];
    }

    var ERROR_LINES = ["Faaaah!", "uh oh, bug!", "red squiggles!", "fix me!", "something broke", "check the problems tab"];
    var WARN_LINES  = ["a few warnings", "lint says hi", "tidy up?", "yellow squiggles"];
    var CLEAR_LINES = ["all clear", "clean build!", "no bugs", "nice, fixed!", "ship it"];
    var SAVE_LINES  = ["clean save", "saved!", "looking good", "nice and tidy"];
    var lastErrors = 0;
    var lastWarnings = 0;
    var alarm = false;
    var alarmHead = "";

    function errorLine() {
      return Math.random() < 0.5
        ? "Faaaah! " + alarmHead
        : ERROR_LINES[Math.floor(Math.random() * ERROR_LINES.length)];
    }

    function reactToDiag(errors, warnings) {
      if (!pets.length) { lastErrors = errors; lastWarnings = warnings; return; }
      var pet = pets[Math.floor(Math.random() * pets.length)];
      if (errors > 0) {
        var head = errors + " error" + (errors > 1 ? "s" : "");
        if (warnings > 0) { head += " · " + warnings + " warn"; }
        alarm = true;
        alarmHead = head;
        if (errors !== lastErrors) {
          for (var i = 0; i < pets.length; i++) {
            var p = pets[i];
            p.dir = -1;
            say(p, errorLine(), 1.2);
            p.hopT = 0.7;
            p.sayNext = 0;
          }
        }
      } else if (errors === 0 && lastErrors > 0) {
        alarm = false;
        say(pet, CLEAR_LINES[Math.floor(Math.random() * CLEAR_LINES.length)], 3);
        pet.hopT = 0.5;
        pet.sayNext = 8 + Math.random() * 8;
      } else if (errors === 0 && warnings > 0 && warnings !== lastWarnings) {
        var w = Math.random() < 0.5
          ? warnings + " warning" + (warnings > 1 ? "s" : "")
          : WARN_LINES[Math.floor(Math.random() * WARN_LINES.length)];
        say(pet, w, 3);
        pet.sayNext = 8 + Math.random() * 8;
      }
      lastErrors = errors;
      lastWarnings = warnings;
    }

    function reactToSave() {
      if (!pets.length || Math.random() > 0.4) { return; }
      var pet = pets[Math.floor(Math.random() * pets.length)];
      say(pet, SAVE_LINES[Math.floor(Math.random() * SAVE_LINES.length)], 2.5);
      pet.sayNext = 6 + Math.random() * 8;
    }
    function say(pet, text, secs) {
      pet.say = text;
      pet.sayTimer = secs;
    }

    var pets = [];
    var treats = [];
    var TREAT_KINDS = ["bone", "fish", "cookie", "apple", "battery"];

    function makePet(spec) {
      return {
        type: spec.type,
        name: spec.name || "",
        p: pal(spec.color),
        x: 20 + Math.random() * 60,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: 18 + Math.random() * 14,
        state: "walk",
        timer: 1 + Math.random() * 3,
        phase: Math.random() * 6.28,
        target: null,
        surface: "floor",
        y: floorY,
        say: null,
        sayTimer: 0,
        sayNext: 3 + Math.random() * 7,
        hopT: 0
      };
    }

    function setPets(specs) {
      pets = specs.map(makePet);
    }

    function resize() {
      var cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 200;
      var band = showNames ? 4 : 2;
      var minRows = 12 + band;
      var availH = window.innerHeight || 0;
      var cssH = Math.max(minRows * S, availH - 2);
      canvas.style.height = cssH + "px";
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      floorY = cssH - band * S;
      ceilY = 2 * S;
      cornerInset = 6 * S;
      var tooShort = (floorY - ceilY) <= 14 * S;
      for (var i = 0; i < pets.length; i++) {
        var p = pets[i];
        p.x = Math.min(Math.max(p.x, cornerInset), cssW - cornerInset);
        if (tooShort && p.surface !== "floor") { p.surface = "floor"; p.state = "walk"; }
        if (p.surface === "floor") { p.y = floorY; }
        else if (p.surface === "ceiling") { p.y = ceilY; }
        else { p.y = Math.min(Math.max(p.y, ceilY), floorY); }
      }
    }

    function block(bx, by, bw, bh, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(bx * S), Math.round(by * S),
                   Math.ceil(bw * S), Math.ceil(bh * S));
    }

    function legs(p, phase, moving, frontX, backX) {
      var sw = moving ? 1.2 : 0;
      var f = frontX + Math.sin(phase) * sw;
      var b = backX + Math.sin(phase + Math.PI) * sw;
      block(f - 1, -3, 1.6, 3, p.dark);
      block(b - 1, -3, 1.6, 3, p.dark);
      block(f, -3, 1.6, 3, p.body);
      block(b, -3, 1.6, 3, p.body);
    }

    function drawCat(p, phase, moving) {
      var wag = Math.sin(phase * 0.6);
      legs(p, phase, moving, 2.4, -3.4);
      block(-5, -6, 1, 1, p.body);
      block(-6, -7, 1, 1, p.body);
      block(-6, -8, 1, 1, p.body);
      block(-5 + wag, -9, 1, 1, p.body);
      block(-4, -6, 9, 3, p.body);
      block(-4, -3.2, 9, 1.2, p.belly);
      block(-4, -7, 6, 1, p.body);
      block(2, -9, 5, 4, p.body);
      block(2, -10, 1.2, 1.2, p.body);
      block(5, -10, 1.2, 1.2, p.body);
      block(6, -6.2, 1, 1, p.belly);
      block(6.1, -5.4, 0.8, 0.8, NOSE);
      block(5, -8, 1, 1, p.eye);
    }

    function drawDog(p, phase, moving) {
      var wag = Math.sin(phase * 1.2);
      legs(p, phase, moving, 2.4, -3.4);
      block(-5, -7, 1, 1, p.body);
      block(-6, -8, 1, 1, p.body);
      block(-6 + wag, -9, 1, 1, p.body);
      block(-4, -6, 9, 3, p.body);
      block(-4, -3.2, 9, 1.2, p.belly);
      block(2, -9, 5, 4, p.body);
      block(2, -9, 1.2, 3, p.dark);
      block(6, -7, 2, 2, p.belly);
      block(7.2, -6.2, 0.9, 0.9, "#1b1b22");
      block(5, -8, 1, 1, p.eye);
    }

    function drawDuck(p, phase, moving) {
      var sw = moving ? 1.2 : 0;
      var l1 = -1 + Math.sin(phase) * sw;
      var l2 = 1.5 + Math.sin(phase + Math.PI) * sw;
      block(l1, -3, 1, 3, BEAK);
      block(l2, -3, 1, 3, BEAK);
      block(-3, -7, 6, 4, p.body);
      block(-4, -8, 1.5, 2, p.body);
      block(-2, -6, 3, 2, p.dark);
      block(1, -10, 4, 4, p.body);
      block(4, -9, 2, 1.6, BEAK);
      block(3, -9, 1, 1, p.eye);
    }

    var BOLT = "#7fd0ff";
    var ANTENNA = "#ff5b5b";

    function drawRobot(p, phase, moving) {
      legs(p, phase, moving, 2.2, -3.2);
      block(-6, -7.5, 1.4, 3.5, p.dark);
      block(6.5, -7.5, 1.4, 3.5, p.body);
      block(-4, -8, 8, 5, p.body);
      block(-4, -3.4, 8, 1.2, p.dark);
      block(-3, -7, 6, 2.6, p.dark);
      block(-1, -6.4, 1.6, 1.3, BOLT);
      block(0.4, -9, 2, 1.2, p.dark);
      block(-1.5, -12.6, 7, 3.8, p.body);
      block(-0.4, -12.1, 5, 2.6, p.dark);
      block(0.3, -11.7, 1.5, 1.5, BOLT);
      block(3, -11.7, 1.5, 1.5, BOLT);
      block(1.5, -13.6, 0.8, 1.1, p.dark);
      var on = Math.sin(phase * 1.5) > -0.3;
      block(1.1, -14.5, 1.5, 1, on ? ANTENNA : p.dark);
    }

    function drawSprite(pet, rec, moving) {
      var fh = rec.img.height;
      var fw = rec.img.width / rec.frames;
      var targetH = 12 * S;
      var scale = targetH / fh;
      var dw = fw * scale;
      var frame = 0;
      if (rec.frames > 1 && moving) {
        frame = Math.floor(pet.phase * 1.5) % rec.frames;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(rec.img, frame * fw, 0, fw, fh, -dw / 2, -targetH, dw, targetH);
    }

    function draw(pet) {
      var moving = pet.state === "walk" || pet.state === "run";
      var hop = pet.hopT > 0
        ? Math.abs(Math.sin((0.7 - pet.hopT) * 16)) * 3 * S
        : 0;
      var n = surfaceNormal(pet.surface);
      var w = canvas.clientWidth;
      var sx, sy;
      if (pet.surface === "wallL") { sx = cornerInset; sy = pet.y; }
      else if (pet.surface === "wallR") { sx = w - cornerInset; sy = pet.y; }
      else if (pet.surface === "ceiling") { sx = pet.x; sy = ceilY; }
      else { sx = pet.x; sy = floorY; }
      sx += n.x * hop;
      sy += n.y * hop;
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.rotate(surfaceAngle(pet.surface));
      ctx.scale(faceSign(pet.surface) * pet.dir, 1);
      var rec = SPRITES[pet.type];
      if (rec && rec.ok) { drawSprite(pet, rec, moving); }
      else if (pet.type === "dog") { drawDog(pet.p, pet.phase, moving); }
      else if (pet.type === "duck") { drawDuck(pet.p, pet.phase, moving); }
      else if (pet.type === "robot") { drawRobot(pet.p, pet.phase, moving); }
      else { drawCat(pet.p, pet.phase, moving); }
      ctx.restore();
    }

    function drawName(pet) {
      if (!showNames || !pet.name || pet.surface !== "floor") { return; }
      var fontPx = Math.max(8, 2.4 * S);
      ctx.font = fontPx + "px var(--vscode-font-family), sans-serif";
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillStyle = "var(--vscode-foreground)";
      ctx.globalAlpha = 0.5;
      ctx.fillText(pet.name, pet.x, floorY + 1);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }

    function drawBubble(pet) {
      if (!pet.say) { return; }
      var pad = 4;
      var fontPx = Math.max(9, 3 * S);
      ctx.font = fontPx + "px var(--vscode-font-family), sans-serif";
      ctx.textBaseline = "middle";
      var tw = ctx.measureText(pet.say).width;
      var bw = tw + pad * 2;
      var bh = fontPx + pad * 2;
      var r = 4;
      var gap = 5;
      var petH = 12 * S;
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;

      var n = surfaceNormal(pet.surface);
      var sx, sy;
      if (pet.surface === "wallL") { sx = cornerInset; sy = pet.y; }
      else if (pet.surface === "wallR") { sx = w - cornerInset; sy = pet.y; }
      else if (pet.surface === "ceiling") { sx = pet.x; sy = ceilY; }
      else { sx = pet.x; sy = floorY; }
      var hx = sx + n.x * petH;
      var hy = sy + n.y * petH;

      var bx, by;
      if (n.x === 0) {
        bx = hx - bw / 2;
        by = n.y < 0 ? hy - gap - bh : hy + gap;
      } else {
        by = hy - bh / 2;
        bx = n.x < 0 ? hx - gap - bw : hx + gap;
      }
      if (bx < 2) { bx = 2; }
      if (bx + bw > w - 2) { bx = w - 2 - bw; }
      if (by < 2) { by = 2; }
      if (by + bh > h - 2) { by = h - 2 - bh; }

      ctx.fillStyle = "rgba(245,245,248,0.96)";
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
      ctx.arcTo(bx, by + bh, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#1b1b22";
      ctx.fillText(pet.say, bx + pad, by + bh / 2);
    }

    function drawTreat(t) {
      var x = Math.round(t.x), y = Math.round(t.y);
      if (t.kind === "fish") {
        ctx.fillStyle = "#9ecbff";
        ctx.fillRect(x - 4, y - 2, 6, 4);
        ctx.beginPath();
        ctx.moveTo(x + 2, y); ctx.lineTo(x + 6, y - 3); ctx.lineTo(x + 6, y + 3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#1b1b22"; ctx.fillRect(x - 3, y - 1, 1, 1);
      } else if (t.kind === "cookie") {
        ctx.fillStyle = "#c8893f";
        ctx.beginPath(); ctx.arc(x, y - 1, 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = "#5b3a1e";
        ctx.fillRect(x - 2, y - 2, 1, 1);
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 3, 1, 1);
      } else if (t.kind === "apple") {
        ctx.fillStyle = "#e0504b";
        ctx.beginPath(); ctx.arc(x, y - 1, 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = "#6b3b1c"; ctx.fillRect(x, y - 6, 1, 2);
        ctx.fillStyle = "#5fae4e"; ctx.fillRect(x + 1, y - 6, 2, 1);
      } else if (t.kind === "battery") {
        ctx.fillStyle = "#7bd06f";
        ctx.fillRect(x - 4, y - 3, 8, 5);
        ctx.fillStyle = "#3a8a32"; ctx.fillRect(x - 4, y - 3, 8, 1);
        ctx.fillStyle = "#cfcfcf"; ctx.fillRect(x + 4, y - 2, 1, 3);
        ctx.fillStyle = "#173d14"; ctx.fillRect(x - 1, y, 2, 1); ctx.fillRect(x, y - 1, 0.6, 3);
      } else {
        ctx.fillStyle = "#e7e3d6";
        ctx.fillRect(x - 4, y - 1, 8, 2);
        ctx.fillRect(x - 5, y - 2, 2, 4);
        ctx.fillRect(x + 3, y - 2, 2, 4);
      }
    }

    function drawFloor() {
      var w = canvas.clientWidth;
      ctx.fillStyle = "rgba(127,127,127,0.25)";
      ctx.fillRect(0, floorY + 1, w, 1);
    }

    function surfaceAngle(s) {
      if (s === "wallL") { return Math.PI / 2; }
      if (s === "wallR") { return -Math.PI / 2; }
      if (s === "ceiling") { return Math.PI; }
      return 0;
    }
    function surfaceNormal(s) {
      if (s === "wallL") { return { x: 1, y: 0 }; }
      if (s === "wallR") { return { x: -1, y: 0 }; }
      if (s === "ceiling") { return { x: 0, y: 1 }; }
      return { x: 0, y: -1 };
    }
    function faceSign(s) {
      return (s === "wallR" || s === "ceiling") ? -1 : 1;
    }
    function isWall(s) { return s === "wallL" || s === "wallR"; }
    function surfaceRange(pet) {
      if (isWall(pet.surface)) { return [ceilY, floorY]; }
      return [cornerInset, canvas.clientWidth - cornerInset];
    }
    function petCoord(pet) { return isWall(pet.surface) ? pet.y : pet.x; }
    function setCoord(pet, v) {
      if (isWall(pet.surface)) { pet.y = v; } else { pet.x = v; }
    }

    function enterNeighbor(pet, atHi) {
      var w = canvas.clientWidth;
      var s = pet.surface;
      if (s === "floor") {
        if (atHi) { pet.surface = "wallR"; pet.x = w - cornerInset; }
        else { pet.surface = "wallL"; pet.x = cornerInset; }
        pet.y = floorY; pet.dir = -1;
      } else if (s === "wallR") {
        if (atHi) { pet.surface = "floor"; pet.x = w - cornerInset; pet.dir = -1; }
        else { pet.surface = "ceiling"; pet.x = w - cornerInset; pet.dir = -1; }
        pet.y = atHi ? floorY : ceilY;
      } else if (s === "wallL") {
        if (atHi) { pet.surface = "floor"; pet.x = cornerInset; pet.dir = 1; }
        else { pet.surface = "ceiling"; pet.x = cornerInset; pet.dir = 1; }
        pet.y = atHi ? floorY : ceilY;
      } else {
        if (atHi) { pet.surface = "wallR"; pet.x = w - cornerInset; }
        else { pet.surface = "wallL"; pet.x = cornerInset; }
        pet.y = ceilY; pet.dir = 1;
      }
      pet.state = "walk";
      pet.say = null;
    }

    function moveAlong(pet, dt) {
      var spd = pet.speed * (pet.state === "run" ? 1.8 : 1);
      var r = surfaceRange(pet);
      var v = petCoord(pet) + pet.dir * spd * dt;
      if (v > r[0] && v < r[1]) { setCoord(pet, v); return; }
      var atHi = v >= r[1];
      setCoord(pet, atHi ? r[1] : r[0]);
      var canClimb = (floorY - ceilY) > 14 * S;
      var climbProb = pet.surface === "floor" ? 0.4 : 0.6;
      if (!canClimb || Math.random() > climbProb) { pet.dir *= -1; return; }
      enterNeighbor(pet, atHi);
    }

    function nearestTreat(pet) {
      var best = null, bd = 1e9;
      for (var i = 0; i < treats.length; i++) {
        if (!treats[i].landed) { continue; }
        var d = Math.abs(treats[i].x - pet.x);
        if (d < bd) { bd = d; best = treats[i]; }
      }
      return best;
    }

    function update(dt) {
      for (var i = 0; i < treats.length; i++) {
        var t = treats[i];
        if (!t.landed) {
          t.vy += 600 * dt;
          t.y += t.vy * dt;
          if (t.y >= floorY) { t.y = floorY; t.landed = true; }
        }
      }

      for (var k = 0; k < pets.length; k++) {
        var pet = pets[k];
        var moving = pet.state === "walk" || pet.state === "run";
        pet.phase += dt * (pet.state === "run" ? 14 : moving ? 8 : 1.6);
        if (pet.hopT > 0) { pet.hopT -= dt; if (pet.hopT < 0) { pet.hopT = 0; } }

        if (pet.sayTimer > 0) {
          pet.sayTimer -= dt;
          if (pet.sayTimer <= 0) { pet.say = null; }
        } else {
          pet.sayNext -= dt;
          if (pet.sayNext <= 0) {
            if (alarm) {
              pet.dir = -1;
              say(pet, errorLine(), 1.0);
              pet.sayNext = 0.3 + Math.random() * 0.5;
            } else {
              say(pet, phraseFor(pet.type), 2.2);
              pet.sayNext = 6 + Math.random() * 10;
            }
          }
        }

        if (pet.surface !== "floor") {
          pet.state = "walk";
          moveAlong(pet, dt);
          continue;
        }

        var t2 = nearestTreat(pet);
        if (t2) {
          pet.state = "run";
          pet.dir = t2.x < pet.x ? -1 : 1;
          pet.x += pet.dir * (pet.speed * 1.8) * dt;
          if (Math.abs(pet.x - t2.x) < 1.5 * S) {
            var idx = treats.indexOf(t2);
            if (idx >= 0) { treats.splice(idx, 1); }
            pet.state = "eat";
            pet.timer = 1.2;
            say(pet, EATING[Math.floor(Math.random() * EATING.length)], 1.5);
          }
          continue;
        }

        if (pet.state === "walk") {
          moveAlong(pet, dt);
          pet.timer -= dt;
          if (pet.timer <= 0) {
            pet.state = Math.random() < 0.5 ? "idle" : "walk";
            pet.timer = 1.5 + Math.random() * 3;
            if (Math.random() < 0.3) { pet.dir *= -1; }
          }
        } else {
          pet.timer -= dt;
          if (pet.timer <= 0) {
            pet.state = "walk";
            pet.timer = 2 + Math.random() * 3;
          }
        }
      }
    }

    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawFloor();
      for (var i = 0; i < treats.length; i++) { drawTreat(treats[i]); }
      for (var j = 0; j < pets.length; j++) { draw(pets[j]); }
      for (var n = 0; n < pets.length; n++) { drawName(pets[n]); }
      for (var b = 0; b < pets.length; b++) { drawBubble(pets[b]); }
      requestAnimationFrame(loop);
    }

    function dropTreat(x, kind) {
      if (!kind) { kind = TREAT_KINDS[Math.floor(Math.random() * TREAT_KINDS.length)]; }
      treats.push({ x: x, y: -4, vy: 0, landed: false, kind: kind });
      if (treats.length > 12) { treats.shift(); }
    }

    function petAt(x, y) {
      var best = null, bd = 7 * S;
      for (var i = 0; i < pets.length; i++) {
        var d = Math.abs(pets[i].x - x);
        if (d < bd && y >= floorY - 12 * S && y <= floorY + 2 * S) {
          bd = d; best = pets[i];
        }
      }
      return best;
    }

    canvas.addEventListener("click", function (e) {
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var pet = petAt(x, y);
      if (pet) {
        pet.dir = x < pet.x ? -1 : 1;
        say(pet, phraseFor(pet.type), 2.2);
        pet.sayNext = 6 + Math.random() * 10;
      } else {
        dropTreat(x);
      }
      hint.style.display = "none";
    });

    canvas.addEventListener("dblclick", function (e) {
      var rect = canvas.getBoundingClientRect();
      var pet = petAt(e.clientX - rect.left, e.clientY - rect.top);
      if (pet) {
        var index = pets.indexOf(pet);
        if (index >= 0) { vscode.postMessage({ type: "renameRequest", index: index }); }
      }
    });

    window.addEventListener("resize", resize);

    window.addEventListener("message", function (e) {
      var msg = e.data || {};
      if (msg.type === "init") {
        if (msg.size && SIZES[msg.size]) { S = SIZES[msg.size]; }
        if (typeof msg.showNames === "boolean") { showNames = msg.showNames; }
        resize();
        setPets(msg.pets || []);
      } else if (msg.type === "add") {
        pets.push(makePet(msg.pet));
      } else if (msg.type === "clear") {
        pets = [];
      } else if (msg.type === "treat") {
        dropTreat(20 + Math.random() * (canvas.clientWidth - 40));
        hint.style.display = "none";
      } else if (msg.type === "diag") {
        reactToDiag(msg.errors || 0, msg.warnings || 0);
      } else if (msg.type === "save") {
        reactToSave();
      }
    });

    resize();
    requestAnimationFrame(loop);
    vscode.postMessage({ type: "ready" });
  })();
  </script>
</body>
</html>`;
}

function getNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
