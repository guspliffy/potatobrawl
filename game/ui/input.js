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
window.addEventListener("keydown", (e) => {
  Sfx.init();
  if (mode === "match" && (e.code === "Escape" || e.code === "KeyP")) { e.preventDefault(); togglePause(); return; }
  if (mode === "match" && GAMEKEYS.has(e.code)) e.preventDefault();
  if (!keys.has(e.code) && KEYMAP[e.code]) latch.add(KEYMAP[e.code]);
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => { keys.clear(); releaseTouch(); });

function readPad() {
  const r = { x: 0, y: 0 };
  let pads = [];
  try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return r; }
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    r.x = Math.abs(ax) > 0.2 ? ax : (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
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
    jump: held("jump"), light: held("light"), heavy: held("heavy"), special: held("special"), dodge: held("dodge"), ulti: held("ulti"),
  };
  latch.clear();
  return inp;
}

const stickZone = $("stickZone"), stickBase = $("stickBase"), stickKnob = $("stickKnob");
const STICK_R = 50;
function placeBase(x, y) { stickBase.style.left = x + "px"; stickBase.style.top = y + "px"; stickBase.style.bottom = "auto"; stickBase.style.margin = "-58px 0 0 -58px"; }
function resetBase() { stickBase.style.left = ""; stickBase.style.top = ""; stickBase.style.bottom = ""; stickBase.style.margin = ""; stickKnob.style.transform = ""; stickBase.classList.remove("on"); }
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
});
function endStick(e) {
  if (e && e.pointerId !== touch.id) return;
  touch.id = null; touch.x = 0; touch.y = 0; resetBase();
}
stickZone.addEventListener("pointerup", endStick);
stickZone.addEventListener("pointercancel", endStick);
stickZone.addEventListener("lostpointercapture", endStick);

const padBtns = [...document.querySelectorAll(".pb")];
for (const b of padBtns) {
  const k = b.dataset.k;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault(); Sfx.init();
    try { b.setPointerCapture(e.pointerId); } catch (_) {}
    touch[k] = true; latch.add(k); b.classList.add("on");
  });
  const up = () => { touch[k] = false; b.classList.remove("on"); };
  b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
}
function releaseTouch() { for (const b of padBtns) { touch[b.dataset.k] = false; b.classList.remove("on"); } endStick(); }
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
const fsWanted = () => (P.fs === undefined ? touchUI : !!P.fs);
const isFull = () => !!document.fullscreenElement;
// Called from taps that start play (Fight, Rematch, Host, Join): browsers only allow fullscreen from a tap.
function goFull() {
  if (!FS.can || !fsWanted() || isFull()) return;
  try {
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(() => {
      if (touchUI && P.screen !== "up" && screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
    }, () => {});
  } catch (e) { /* not allowed here */ }
}
function leaveFull() { if (isFull()) document.exitFullscreen().catch(() => {}); }
document.addEventListener("fullscreenchange", () => setTimeout(resize, 60));

