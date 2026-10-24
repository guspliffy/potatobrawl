/* ===================== input ===================== */
const touch = { x: 0, y: 0, jump: false, light: false, heavy: false, special: false, dodge: false, ulti: false, id: null, ox: 0, oy: 0 };
const latch = new Set();
const keys = new Set();
const KEYMAP = {
  Space: "jump", KeyJ: "light", KeyZ: "light", KeyK: "heavy", KeyX: "heavy", KeyL: "special", KeyC: "special",
  ShiftLeft: "dodge", ShiftRight: "dodge", KeyV: "dodge", Semicolon: "dodge",
  KeyU: "ulti",
};
const GAMEKEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", ...Object.keys(KEYMAP)]);
/* The sprint (core.js TUNE.sprint): a flick of the stick (touch, a gamepad's stick) or a direction tapped twice (keys, a gamepad's d-pad)
   sends one `sprint` press, the stick full to that side. A sprint frame carries no button presses (its online code has no room), so one
   that meets a new press waits a frame. n counts frames (readPlayer calls); low = the last frame the stick was in the middle. */
const SPR = { n: 0, low: -99, hi: false, tapS: 0, tapT: -99, want: 0, padX: 0, glowT: 0 };
const SIDEKEY = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
function sprTap(side) {
  if (SPR.tapS === side && SPR.n - SPR.tapT <= BL.TUNE.sprint.tap) { SPR.want = side; SPR.tapT = -99; }
  else { SPR.tapS = side; SPR.tapT = SPR.n; }
}
function sprFlick(ax) {
  const [lo, hi, win] = BL.TUNE.sprint.flick, a = Math.abs(ax);
  if (a < lo) SPR.low = SPR.n;
  if (a > hi && !SPR.hi && SPR.n - SPR.low <= win) SPR.want = Math.sign(ax);
  SPR.hi = a > hi;
}
window.addEventListener("keydown", (e) => {
  Sfx.init();
  if (mode === "match" && (e.code === "Escape" || e.code === "KeyP")) { e.preventDefault(); togglePause(); return; }
  if (mode === "match" && e.code === "Tab" && match && match.duo) { e.preventDefault(); if (!e.repeat) duoFocusNext(); return; }   // 2v2: Focus (ui/duo.js)
  if (mode === "match" && GAMEKEYS.has(e.code)) e.preventDefault();
  if (!keys.has(e.code) && KEYMAP[e.code]) latch.add(KEYMAP[e.code]);
  if (!keys.has(e.code) && SIDEKEY[e.code] && mode === "match") sprTap(SIDEKEY[e.code]);
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => { keys.clear(); releaseTouch(); });
// a phone switching apps (or a hidden tab) may never send blur or the key-up: let go of everything there too
document.addEventListener("visibilitychange", () => { if (document.hidden) { keys.clear(); releaseTouch(); } });

function readPad() {
  const r = { x: 0, y: 0 };
  let pads = [];
  try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return r; }
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    r.x = Math.abs(ax) > 0.2 ? ax : (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
    r.ax = Math.abs(ax) > 0.2 ? ax : 0; r.dx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0);   // the stick alone (flicks), the d-pad alone (double taps)
    r.y = Math.abs(ay) > 0.2 ? ay : (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
    r.light = b(0); r.special = b(1); r.jump = b(2); r.ulti = b(3); r.heavy = b(4) || b(6); r.dodge = b(5) || b(7);
    break;
  }
  return r;
}
function readPlayer() {
  if (window.__blInput && mode === "match" && G) return Object.assign(BL.blankInput(), window.__blInput(G));   // tests only: scripted input
  const pad = readPad();
  const kx = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const ky = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  const held = (k) => touch[k] || latch.has(k) || !!pad[k] || Object.keys(KEYMAP).some((c) => KEYMAP[c] === k && keys.has(c));
  const inp = {
    x: clamp(touch.x + kx + pad.x, -1, 1), y: clamp(touch.y + ky + pad.y, -1, 1),
    jump: held("jump"), light: held("light"), heavy: held("heavy"), special: held("special"), dodge: held("dodge"), ulti: held("ulti"), sprint: false,
  };
  SPR.n++;
  sprFlick(clamp(touch.x + (pad.ax || 0), -1, 1));
  if (pad.dx && pad.dx !== SPR.padX) sprTap(pad.dx);
  SPR.padX = pad.dx || 0;
  if (SPR.want && !latch.size) { inp.sprint = true; inp.x = SPR.want; SPR.want = 0; sprGlow(); }
  latch.clear();
  return inp;
}

const stickZone = $("stickZone"), stickBase = $("stickBase"), stickKnob = $("stickKnob");
const STICK_R = 50;
function placeBase(x, y) { stickBase.style.left = x + "px"; stickBase.style.top = y + "px"; stickBase.style.bottom = "auto"; stickBase.style.margin = "-58px 0 0 -58px"; }
function resetBase() { stickBase.style.left = ""; stickBase.style.top = ""; stickBase.style.bottom = ""; stickBase.style.margin = ""; stickKnob.style.transform = ""; stickBase.classList.remove("on"); stickKnob.classList.remove("full"); }
// the knob glows ember at a full push to a side (where a flick sprints), brighter for a moment when a sprint goes out
function sprGlow() { stickKnob.classList.add("spr"); clearTimeout(SPR.glowT); SPR.glowT = setTimeout(() => stickKnob.classList.remove("spr"), 300); }
stickZone.addEventListener("pointerdown", (e) => {
  e.preventDefault(); Sfx.init();
  if (touch.id !== null) return;
  touch.id = e.pointerId;
  try { stickZone.setPointerCapture(e.pointerId); } catch (_) {}
  const p = toApp(e.clientX, e.clientY);
  touch.ox = p[0]; touch.oy = p[1];
  placeBase(p[0] - stickZone.offsetLeft, p[1] - stickZone.offsetTop);
  stickBase.classList.add("on");
});
stickZone.addEventListener("pointermove", (e) => {
  if (e.pointerId !== touch.id) return;
  const p = toApp(e.clientX, e.clientY);
  let dx = p[0] - touch.ox, dy = p[1] - touch.oy;
  const m = Math.hypot(dx, dy);
  if (m > STICK_R) {
    touch.ox += dx * (1 - STICK_R / m); touch.oy += dy * (1 - STICK_R / m);
    dx *= STICK_R / m; dy *= STICK_R / m;
    placeBase(touch.ox - stickZone.offsetLeft, touch.oy - stickZone.offsetTop);
  }
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  const nx = dx / STICK_R, ny = dy / STICK_R;
  touch.x = Math.abs(nx) < 0.2 ? 0 : nx;
  touch.y = Math.abs(ny) < 0.2 ? 0 : ny;
  stickKnob.classList.toggle("full", Math.abs(touch.x) > BL.TUNE.sprint.flick[1]);
});
function endStick(e) {
  if (e && e.pointerId !== touch.id) return;
  touch.id = null; touch.x = 0; touch.y = 0; resetBase();
}
stickZone.addEventListener("pointerup", endStick);
stickZone.addEventListener("pointercancel", endStick);
stickZone.addEventListener("lostpointercapture", endStick);

const padBtns = [...document.querySelectorAll(".pb")];
const padHeld = new Map();   // button -> the fingers on it: two thumbs on one button, the first lifting must not let go of it
for (const b of padBtns) {
  const k = b.dataset.k, held = new Set();
  padHeld.set(b, held);
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault(); Sfx.init();
    try { b.setPointerCapture(e.pointerId); } catch (_) {}
    held.add(e.pointerId); touch[k] = true; latch.add(k); b.classList.add("on");
  });
  const up = (e) => { held.delete(e.pointerId); if (held.size) return; touch[k] = false; b.classList.remove("on"); };
  b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
}
function releaseTouch() { for (const b of padBtns) { padHeld.get(b).clear(); touch[b.dataset.k] = false; b.classList.remove("on"); } endStick(); }
app.addEventListener("contextmenu", (e) => { if (mode === "match") e.preventDefault(); });
document.addEventListener("gesturestart", (e) => e.preventDefault());
const touchUI = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || navigator.maxTouchPoints > 0;
/* ----- fullscreen (Android, computers) and the home-screen app (iPhone) -----
   Only the website build can go fullscreen; the Claude artifact view can't. iPhone Safari has no
   fullscreen for pages, so there the way out of the browser bars is Add to Home Screen. */
const FS = {
  web: !!window.__blStandalone && /^https?:$/.test(location.protocol),
  app: !!((window.matchMedia && (matchMedia("(display-mode: fullscreen)").matches || matchMedia("(display-mode: standalone)").matches)) || navigator.standalone),
  ios: /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
};
FS.can = FS.web && !FS.app && !/iPhone|iPod/.test(navigator.userAgent) && !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
FS.btn = FS.can || (FS.web && FS.ios && !FS.app);   // the menu's fullscreen button: the real thing, or on iPhone the Add to Home Screen steps
const fsWanted = () => (P.fs === undefined ? touchUI : !!P.fs);   // "Fullscreen in fights" (Settings)
const isFull = () => !!document.fullscreenElement;
// Called from taps that start play (Fight, Rematch, Host, Join): browsers only allow fullscreen from a tap.
function goFull() { if (fsWanted()) enterFull(); }
function enterFull() {
  if (!FS.can || isFull()) return;
  try {
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(() => {
      if (touchUI && P.screen !== "up" && screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
    }, () => {});
  } catch (e) { /* not allowed here */ }
}
function leaveFull() { if (isFull()) document.exitFullscreen().catch(() => {}); }
document.addEventListener("fullscreenchange", () => { fsSync(); setTimeout(resize, 60); });   // fsSync (ui/menus.js): the button and the Settings row follow the real state

