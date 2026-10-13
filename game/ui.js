(function () {
"use strict";
const { STAGE, FIGHTERS, newGame, step, makeBot, botInput, intangible, clamp, lerp, sign, serialize, restore, checksum } = BL;
const FIG = Object.fromEntries(FIGHTERS.map((f) => [f.id, f]));
const $ = (id) => document.getElementById(id);
const app = $("app"), cv = $("cv"), ctx = cv.getContext("2d");
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === "number" ? r : 0, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}
const STEP = 1000 / 60;

/* ===================== profile (per device) ===================== */
const SAVE_KEY = "potatobrawl.profile.v1", OLD_SAVE_KEY = "blastline.profile.v1";
function defProfile() {
  return {
    rating: 1000, peak: 1000, wins: 0, losses: 0, draws: 0, matches: 0, tokens: 0, streak: 0,
    owned: Object.fromEntries(FIGHTERS.map((f) => [f.id, [0]])), pal: Object.fromEntries(FIGHTERS.map((f) => [f.id, 0])),
    last: FIGHTERS[0].id, sound: true, history: [], screen: "cw", gfx: "3d", rules: { l: 3, t: 4, b: 1 },
  };
}
let firstRun = false;
function loadProfile() {
  const p = defProfile();
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY);
    firstRun = !raw;
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(p, s);
      p.owned = Object.assign(defProfile().owned, s.owned || {});
      p.pal = Object.assign(defProfile().pal, s.pal || {});
      p.rules = validRules(s.rules) ? s.rules : defProfile().rules;
      if (!FIG[p.last]) p.last = FIGHTERS[0].id;
    }
  } catch (e) { /* storage unavailable: play without saving */ }
  return p;
}
/* Friend match rules: lives, minutes (0 = no limit), single match or best of 3. */
const RULES = { l: [1, 3, 5], t: [2, 4, 0], b: [1, 3] };
function validRules(r) { return !!r && typeof r === "object" && RULES.l.includes(r.l) && RULES.t.includes(r.t) && RULES.b.includes(r.b); }
function ruleText(r) { return `${r.l} ${r.l === 1 ? "life" : "lives"} · ${r.t ? r.t + " min" : "no time limit"} · ${r.b === 3 ? "best of 3" : "single match"}`; }
function saveProfile() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } }
let P = loadProfile();

const TIERS = [
  { name: "Tin", min: 0, col: "#9097ad" },
  { name: "Bronze", min: 900, col: "#cd8f5b" },
  { name: "Silver", min: 1050, col: "#c9d0e4" },
  { name: "Gold", min: 1200, col: "#f0c35a" },
  { name: "Platinum", min: 1350, col: "#7fd6c8" },
  { name: "Diamond", min: 1500, col: "#8fb6ff" },
  { name: "Blastmaster", min: 1650, col: "#ef7a52" },
];
function tierIdx(r) { let i = 0; for (let k = 0; k < TIERS.length; k++) if (r >= TIERS[k].min) i = k; return i; }
function tierInfo(r) {
  const i = tierIdx(r), t = TIERS[i];
  if (i === TIERS.length - 1) return { i, t, p: 1, next: null, need: 0 };
  const lo = i === 0 ? 750 : t.min, hi = TIERS[i + 1].min;
  return { i, t, p: clamp((r - lo) / (hi - lo), 0, 1), next: TIERS[i + 1], need: hi - r };
}
function paintBadge(el, i) { el.style.setProperty("--tc", TIERS[i].col); el.textContent = TIERS[i].name[0]; }

/* ===================== sound (WebAudio, synthesized) ===================== */
const Sfx = {
  ctx: null, out: null, noiseBuf: null,
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain(); this.out.gain.value = 0.55; this.out.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  ok() { return P.sound && this.ctx && this.ctx.state === "running"; },
  env(g, t, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  tone(f0, f1, dur, type, vol) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, vol, dur); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol, freq) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = "lowpass"; f.frequency.value = freq;
    this.env(g, t, vol, dur); s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },
  hit(kb) { const k = Math.min(1, kb / 30); this.noise(0.05 + k * 0.14, 0.3 + k * 0.45, 2600 - k * 1700); this.tone(190 - k * 100, 45, 0.08 + k * 0.16, "sine", 0.45 + k * 0.4); },
  armor() { this.tone(520, 380, 0.12, "square", 0.08); this.noise(0.05, 0.2, 3000); },
  ko() { this.noise(0.7, 0.75, 700); this.tone(110, 28, 0.8, "sawtooth", 0.3); this.tone(900, 180, 0.45, "square", 0.06); },
  jump() { this.tone(280, 520, 0.08, "triangle", 0.1); },
  swing(h) { this.noise(h ? 0.13 : 0.06, h ? 0.12 : 0.06, h ? 1000 : 2200); },
  count(go) { this.tone(go ? 880 : 440, go ? 880 : 440, go ? 0.32 : 0.12, "square", 0.08); },
  ui() { this.tone(620, 840, 0.05, "triangle", 0.07); },
  fire() { this.noise(0.35, 0.3, 900); this.tone(170, 80, 0.3, "sawtooth", 0.06); },
  bolt(low) { this.tone(low ? 420 : 900, low ? 260 : 1500, 0.12, "triangle", 0.07); },
  burst() { this.noise(0.25, 0.35, 1400); this.tone(220, 90, 0.2, "sine", 0.25); },
  caw() { this.tone(700, 420, 0.09, "sawtooth", 0.05); setTimeout(() => this.tone(650, 380, 0.08, "sawtooth", 0.045), 110); },
  fry() { this.tone(980, 520, 0.06, "square", 0.045); this.noise(0.04, 0.08, 4000); },
};

/* ===================== input ===================== */
const touch = { x: 0, y: 0, jump: false, light: false, heavy: false, special: false, dodge: false, id: null, ox: 0, oy: 0 };
const latch = new Set();
const keys = new Set();
const KEYMAP = {
  Space: "jump", KeyJ: "light", KeyZ: "light", KeyK: "heavy", KeyX: "heavy", KeyL: "special", KeyC: "special",
  ShiftLeft: "dodge", ShiftRight: "dodge", KeyV: "dodge", Semicolon: "dodge",
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
    r.light = b(0); r.special = b(1); r.jump = b(2) || b(3); r.heavy = b(4) || b(6); r.dodge = b(5) || b(7);
    break;
  }
  return r;
}
function readPlayer() {
  const pad = readPad();
  const kx = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const ky = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  const held = (k) => touch[k] || latch.has(k) || !!pad[k] || Object.keys(KEYMAP).some((c) => KEYMAP[c] === k && keys.has(c));
  const inp = {
    x: clamp(touch.x + kx + pad.x, -1, 1), y: clamp(touch.y + ky + pad.y, -1, 1),
    jump: held("jump"), light: held("light"), heavy: held("heavy"), special: held("special"), dodge: held("dodge"),
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

/* ===================== layout & camera ===================== */
let W = 1, H = 1, DPR = 1;
const L = { gw: 1, gh: 1, panel: 0, portrait: false };
/* Sideways mode: when the viewer stays upright (the Claude app's artifact view does not rotate),
   the whole game is rotated 90 degrees so it plays in landscape with the phone turned. */
let rotMode = 0;
const rotBox = { W0: 1, H0: 1 };
function toApp(cx, cy) {
  if (!rotMode) { const r = app.getBoundingClientRect(); return [cx - r.left, cy - r.top]; }
  const b = document.body.getBoundingClientRect(), x = cx - b.left, y = cy - b.top;
  return rotMode === 1 ? [y, rotBox.W0 - x] : [rotBox.H0 - y, x];
}
function resize() {
  const W0 = Math.max(1, document.body.clientWidth), H0 = Math.max(1, document.body.clientHeight);
  const uprightView = H0 > W0 * 1.05;
  rotMode = touchUI && uprightView && P.screen !== "up" ? (P.screen === "ccw" ? -1 : 1) : 0;
  rotBox.W0 = W0; rotBox.H0 = H0;
  if (rotMode) {
    app.style.width = H0 + "px"; app.style.height = W0 + "px";
    app.style.transform = rotMode === 1 ? `translate(${W0}px, 0) rotate(90deg)` : `translate(0, ${H0}px) rotate(-90deg)`;
  } else { app.style.width = ""; app.style.height = ""; app.style.transform = ""; }
  app.classList.toggle("rot", !!rotMode);
  W = Math.max(1, app.clientWidth); H = Math.max(1, app.clientHeight);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  L.portrait = H > W * 1.05;
  L.panel = L.portrait && mode === "match" && touchUI ? Math.round(clamp(H * 0.36, 200, 300)) : 0;
  L.gw = W; L.gh = H - L.panel;
  app.classList.toggle("portrait", L.portrait);
  app.style.setProperty("--panelH", L.panel + "px");
  app.style.setProperty("--uh", H / 100 + "px");
  app.style.setProperty("--um", Math.min(W, H) / 100 + "px");
  app.classList.toggle("short", H < 520);
  app.classList.toggle("tiny", H < 360);
  app.classList.toggle("narrow", W < 420);
  $("rotHint").hidden = !(L.portrait && touchUI);
  L.canRotate = touchUI && uprightView;
  if (!$("scrSettings").hidden) renderSettings();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 120));

const cam = { x: 0, y: -110, z: 0.6, shake: 0, sx: 0, sy: 0 };
function camTarget(g) {
  const B = STAGE.blast;
  const base = L.portrait ? 250 : 360, pad = L.portrait ? 110 : 150;
  let x1 = -base, x2 = base, y1 = -300, y2 = 110;
  for (const f of g.fighters) {
    if (f.state === "dead" || f.state === "gone") continue;
    x1 = Math.min(x1, f.x - pad); x2 = Math.max(x2, f.x + pad);
    y1 = Math.min(y1, f.y - f.s.h - 130); y2 = Math.max(y2, f.y + 90);
  }
  x1 = Math.max(x1, B.left + 40); x2 = Math.min(x2, B.right - 40);
  y1 = Math.max(y1, B.top + 40); y2 = Math.min(y2, B.bottom - 20);
  const zFit = Math.min(L.gw / (x2 - x1), L.gh / (y2 - y1));
  const zMin = Math.min(L.gw / 1450, L.gh / 1000);
  const zMax = L.portrait ? Math.min(L.gw / 540, L.gh / 420) : Math.min(L.gw / 740, L.gh / 470);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, z: clamp(zFit, zMin, Math.max(zMin, zMax)) };
}
function camStep(g, snap) {
  const t = camTarget(g), k = snap ? 1 : 0.075;
  cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k; cam.z += (t.z - cam.z) * k;
  cam.shake *= 0.85; if (cam.shake < 0.3) cam.shake = 0;
  cam.sx = (Math.random() - 0.5) * cam.shake * 2; cam.sy = (Math.random() - 0.5) * cam.shake * 2;
}
const toScreen = (wx, wy) => [L.gw / 2 + (wx - cam.x) * cam.z + cam.sx, L.gh / 2 + (wy - cam.y) * cam.z + cam.sy];

/* ===================== colors ===================== */
const OUT = "#11101c";
const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(hex, v); }
  return v;
}
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; }
function rgba(hex, a) { const A = rgb(hex); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
const palExtra = new WeakMap();
function px(p) {
  let e = palExtra.get(p);
  if (!e) { e = { back: mix(p.body, "#0b0c18", 0.4), dim: mix(p.body, "#55556a", 0.6), hi: mix(p.body, "#ffffff", 0.4) }; palExtra.set(p, e); }
  return e;
}
const col = (p) => p.ui || p.body;
const PORTRAITS = /*PORTRAITS*/{};
function pctColor(p) {
  const stops = [[0, "#f4f2ec"], [50, "#f6d77a"], [100, "#f39a4c"], [150, "#e8503a"], [220, "#b8263a"]];
  for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; return mix(ca, cb, (p - a) / (b - a)); }
  return stops[stops.length - 1][1];
}

/* ===================== drawing: fighters ===================== */
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const ease = (x) => x * x * (3 - 2 * x);
function rot(p, c, a) { const dx = p[0] - c[0], dy = p[1] - c[1], cs = Math.cos(a), sn = Math.sin(a); return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs]; }

function pose(f, tk) {
  const L_ = f.spec.look, s = f.s, w = s.w, h = s.h;
  const leg = h * L_.leg, tor = h * L_.torso, hr = h * L_.headR;
  const P = { leg, tor, hr, w, h, crouch: 0, lean: 0, spin: 0, swoosh: null, dim: false, mouth: 0, tailTo: null, flap: 0 };
  let fF = [w * 0.24, 0], fB = [-w * 0.2, 0];
  let hF = [w * 0.5, -leg - tor * 0.52], hB = [w * 0.2, -leg - tor * 0.42];
  const st = f.state;
  let bob = 0;
  if (st === "idle" || st === "getup" || st === "respawn") bob = Math.sin(tk * 0.09 + f.slot * 2) * 1.6;
  if (st === "land" || st === "jumpsquat" || st === "getup") P.crouch = 0.35;
  if (st === "run") {
    const ph = f.anim.run;
    fF = [Math.sin(ph) * w * 0.55, -Math.max(0, Math.cos(ph)) * 10];
    fB = [-Math.sin(ph) * w * 0.55, -Math.max(0, -Math.cos(ph)) * 10];
    hF = [w * 0.15 - Math.sin(ph) * w * 0.45, -leg - tor * 0.45];
    hB = [w * 0.05 + Math.sin(ph) * w * 0.45, -leg - tor * 0.4];
    P.lean = 0.16;
  }
  const airy = st === "air" || st === "helpless" || (st === "dodge" && f.dodgeKind === "air");
  if (airy) {
    fF = [w * 0.32, -leg * 0.42]; fB = [-w * 0.12, -leg * 0.22];
    if (f.vy < 0) { hF = [w * 0.32, -leg - tor * 1.15]; hB = [-w * 0.3, -leg - tor * 1.05]; }
    else { hF = [w * 0.55, -leg - tor * 0.75]; hB = [-w * 0.35, -leg - tor * 0.65]; }
  }
  if (st === "helpless") { P.dim = true; hF = [w * 0.25, -leg - tor * 1.25]; hB = [-w * 0.2, -leg - tor * 1.25]; }
  if (st === "hitstun") {
    P.spin = f.tumble ? f.st * 0.3 * (f.kbx * f.facing >= 0 ? -1 : 1) : 0;
    P.lean = f.tumble ? 0 : -0.3;
    fF = [w * 0.42, -leg * 0.25]; fB = [-w * 0.42, -leg * 0.12];
    hF = [w * 0.6, -leg - tor * 1.1]; hB = [-w * 0.55, -leg - tor * 1.0];
  }
  if (st === "dodge") {
    if (f.dodgeKind === "roll") { P.spin = (f.st / 24) * Math.PI * 2 * f.dodgeDir[0] * f.facing; P.crouch = 0.3; fF = [w * 0.2, -leg * 0.5]; fB = [-w * 0.1, -leg * 0.4]; }
    else if (f.dodgeKind === "spot") { P.crouch = 0.25; hF = [w * 0.3, -leg - tor * 0.9]; hB = [w * 0.1, -leg - tor * 0.9]; }
  }
  if (st === "ledge") {
    hF = [w * 0.5 + 2, -h + 8]; hB = [w * 0.38, -h + 6];
    fF = [w * 0.15, 2]; fB = [-w * 0.08, 6]; P.lean = 0.12;
  }
  if (st === "attack" && f.move) {
    const m = f.move, a0 = m.startup + 1, a1 = m.startup + m.active;
    const b = m.boxes[0];
    let tx = w * 0.9, ty = -leg - tor * 0.6;
    if (b) { const t = m.active > 1 ? clamp((f.mt - a0) / (m.active - 1), 0, 1) : 0; tx = b.x + (b.x2 - b.x) * t; ty = b.y + (b.y2 - b.y) * t; }
    const phase = f.mt < a0 ? 0 : f.mt <= a1 ? 1 : 2;
    const k = phase === 0 ? f.mt / Math.max(1, m.startup) : phase === 2 ? (f.mt - a1) / Math.max(1, m.endlag) : 1;
    const wind = [-Math.abs(tx) * 0.3 - w * 0.25, ty * 0.85 + 4];
    const reach = (rest) => (phase === 0 ? lerp2(rest, wind, ease(k)) : phase === 1 ? [tx, ty] : lerp2([tx, ty], rest, ease(k)));
    if (m.limb === "arm") hF = reach(hF);
    else if (m.limb === "leg") { fF = reach(fF); if (phase < 2) P.lean = ty > -leg ? -0.2 : 0; }
    else if (m.limb === "both") { hF = reach(hF); if (phase > 0) fF = [w * 0.55, 0]; P.lean = phase === 0 ? -0.25 * ease(k) : phase === 1 ? 0.25 : 0.25 * (1 - k); }
    else if (m.limb === "tail") { P.tailTo = reach([-w * 1.3, -leg * 0.4]); P.lean = phase === 1 ? 0.15 : 0; }
    else if (m.limb === "head") {
      P.lean = phase === 0 ? -0.18 * ease(k) : phase === 1 ? 0.3 : 0.3 * (1 - k);
      P.mouth = phase === 0 ? 0.4 * k : phase === 1 ? 1 : 1 - k;
      hF = [w * 0.35, -leg - tor * 0.35]; hB = [w * 0.05, -leg - tor * 0.3];
    }
    else if (m.limb === "body") {
      if (phase === 1) P.spin = ((f.mt - a0) / m.active) * Math.PI * 2;
      fF = [w * 0.3, -leg * 0.45]; fB = [-w * 0.2, -leg * 0.3];
      hF = [w * 0.6, -leg - tor * 0.7]; hB = [-w * 0.55, -leg - tor * 0.7];
    }
    if (m.boxes[1] && m.limb !== "body") { const b2 = m.boxes[1]; const rest = fB; fB = phase === 1 ? [b2.x, b2.y] : phase === 0 ? lerp2(rest, [0, -leg * 0.4], ease(k)) : lerp2([b2.x, b2.y], rest, ease(k)); }
    if (m.kind === "dash") {
      P.spin = 0; P.lean = phase === 1 ? 0.75 : 0.2;
      hF = [-w * 0.3, -leg - tor * 0.5]; hB = [-w * 0.6, -leg - tor * 0.35]; fF = [-w * 0.1, -leg * 0.25]; fB = [-w * 0.55, -leg * 0.15];
    }
    if (phase === 1) P.mouth = Math.max(P.mouth, 1);
    if (m.kind === "projectile" && m.limb !== "head") { hF = phase === 0 ? lerp2(hF, [-w * 0.6, -leg - tor * 0.9], ease(k)) : lerp2([w * 1.1, -leg - tor * 0.7], hF, phase === 2 ? ease(k) : 0); }
    if (m.kind === "charge" && phase === 0) P.crouch = 0.3 * ease(k);
    if (m.pound) { fF = [w * 0.08, 4]; fB = [-w * 0.12, 2]; hF = [w * 0.42, -leg - tor * 1.15]; hB = [-w * 0.42, -leg - tor * 1.1]; }
    if (phase === 1 && b) P.swoosh = { tx, ty, r: b.r, body: m.limb === "body", sweep: b.x2 !== b.x || b.y2 !== b.y, sx: b.x, sy: b.y, heavy: m.dmg >= 12, fire: !!m.fire };
  }
  if (L_.wings) {
    const fast = st === "attack" && f.move && (f.move.rec || f.mid === "spec");
    P.flap = f.grounded || st === "ledge" ? 0 : Math.sin(tk * (fast ? 0.9 : 0.35)) * (f.vy < 0 || fast ? 0.6 : 0.3);
  }
  // assemble skeleton
  const drop = P.crouch * leg * 0.45 - bob;
  P.hip = [0, -leg + drop];
  P.sh = [0, -leg - tor * 0.86 + drop];
  P.head = [w * 0.05, -leg - tor - hr * 0.85 + drop];
  P.fF = fF; P.fB = fB; P.hF = hF; P.hB = hB;
  if (L_.build === "potato") {
    P.top = P.hip[1] - (h - leg) + 2;
    const by = P.hip[1] + 5;
    P.cy = (by + P.top) / 2; P.ry = (by - P.top) / 2; P.rx = w * 0.56;
    P.sh = [w * 0.38, P.cy + P.ry * 0.15]; P.shB = [-w * 0.32, P.cy + P.ry * 0.15];
    P.hipF = [w * 0.15, P.hip[1]]; P.hipB = [-w * 0.13, P.hip[1]];
    P.head = [w * 0.16, P.cy - P.ry * 0.28];
    P.mouthPt = [w * 0.16, P.cy - P.ry * 0.28 + w * 0.23];
    // arms hang outside the round body when they're not doing something
    if (st !== "attack" && st !== "ledge" && st !== "hitstun") {
      if (P.hF[0] < w * 0.75) P.hF = [w * 0.75 + (P.hF[0] - w * 0.5) * 0.4, P.hF[1] + 4];
      if (P.hB[0] > -w * 0.68) P.hB = [-w * 0.68 + (P.hB[0] + w * 0.3) * 0.3, P.hB[1] + 4];
    }
  }
  return P;
}

function limbPath(c, a, b, len, bend, wdt, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const half = len / 2;
  let mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (d < len) {
    const off = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
    let nx = -dy / d, ny = dx / d;
    if (bend === "fwd" ? nx < 0 : ny < 0) { nx = -nx; ny = -ny; }
    mid = [mid[0] + nx * off, mid[1] + ny * off];
  }
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(mid[0], mid[1]); c.lineTo(b[0], b[1]);
  c.strokeStyle = OUT; c.lineWidth = wdt + 3.5; c.stroke();
  c.strokeStyle = col; c.lineWidth = wdt; c.stroke();
}

function drawTorso(c, look, P, pal, X) {
  const w = P.w, top = P.sh[1] - 3, bot = P.hip[1] + 3;
  c.beginPath();
  if (look.build === "wedge") {
    c.moveTo(-w * 0.44, top + 2); c.lineTo(w * 0.52, top); c.lineTo(w * 0.24, bot); c.lineTo(-w * 0.22, bot); c.closePath();
  } else if (look.build === "block") {
    c.roundRect(-w * 0.56, top - 2, w * 1.12, bot - top + 4, 10);
  } else if (look.build === "dragon") {
    c.roundRect(-w * 0.44, top - 2, w * 0.88, bot - top + 6, 13);
  } else if (look.build === "potato") {
    const by = P.hip[1] + 5, cy = (by + P.top) / 2, ry = (by - P.top) / 2, rx = w * 0.56;
    c.moveTo(rx, cy);
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2, bump = 1 + 0.035 * Math.sin(a * 5 + 1.3) + 0.02 * Math.sin(a * 3);
      c.lineTo(Math.cos(a) * rx * bump, cy + Math.sin(a) * ry * bump);
    }
    c.closePath();
  } else {
    c.roundRect(-w * 0.31, top, w * 0.62, bot - top, w * 0.28);
  }
  c.fillStyle = pal.body; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  // detail
  c.save(); c.clip();
  if (look.build === "wedge") {
    c.strokeStyle = pal.trim; c.lineWidth = 3; c.beginPath();
    const y0 = top + (bot - top) * 0.25, y1 = top + (bot - top) * 0.75;
    c.moveTo(w * 0.15, y0); c.lineTo(-w * 0.05, (y0 + y1) / 2); c.lineTo(w * 0.12, (y0 + y1) / 2); c.lineTo(-w * 0.08, y1); c.stroke();
  } else if (look.build === "block") {
    c.fillStyle = pal.trim; c.fillRect(-w, bot - 9, w * 2, 6);
    c.fillStyle = X.hi; c.fillRect(-w * 0.45, top + 4, w * 0.5, 4);
  } else if (look.build === "dragon") {
    const mid = (top + bot) / 2;
    c.fillStyle = pal.accent; c.beginPath(); c.ellipse(w * 0.2, mid + 2, w * 0.26, (bot - top) * 0.46, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgba(pal.trim, 0.35); c.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(w * 0.0, mid + i * 6); c.lineTo(w * 0.42, mid + i * 6); c.stroke(); }
  } else if (look.build === "potato") {
    const by = P.hip[1] + 5, ry = (by - P.top) / 2;
    c.fillStyle = mix(pal.body, "#1a1208", 0.35);
    for (const [sx, sy, sr] of [[-0.28, 0.25, 2.2], [0.05, 0.62, 1.8], [-0.12, -0.35, 1.6], [0.32, 0.2, 1.4]]) {
      c.beginPath(); c.ellipse(sx * w, P.top + ry + sy * ry, sr * 1.6, sr, 0.4, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = rgba("#ffffff", 0.22); c.lineWidth = 3;
    c.beginPath(); c.ellipse(-w * 0.08, P.top + ry, w * 0.42, ry * 0.8, 0, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
  } else {
    c.strokeStyle = pal.trim; c.lineWidth = 5; c.beginPath(); c.moveTo(-w * 0.4, top + 4); c.lineTo(w * 0.4, bot - 6); c.stroke();
  }
  c.restore();
}
function drawHead(c, look, P, pal) {
  const [hx, hy] = P.head, r = P.hr;
  c.lineWidth = 2.5; c.strokeStyle = OUT;
  if (look.head === "crest") {
    c.beginPath();
    c.moveTo(hx - r * 0.5, hy - r * 0.55); c.lineTo(hx - r * 1.7, hy - r * 1.35); c.lineTo(hx - r * 0.9, hy - r * 1.05);
    c.lineTo(hx - r * 1.35, hy - r * 2.0); c.lineTo(hx + r * 0.25, hy - r * 0.8); c.closePath();
    c.fillStyle = pal.accent; c.fill(); c.stroke();
    c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fillStyle = pal.body; c.fill(); c.stroke();
    c.beginPath(); c.roundRect(hx - r * 0.05, hy - r * 0.38, r * 1.12, r * 0.46, r * 0.22); c.fillStyle = pal.trim; c.fill();
    c.fillStyle = pal.accent; c.fillRect(hx + r * 0.55, hy - r * 0.28, r * 0.3, r * 0.12);
  } else if (look.head === "brute") {
    c.beginPath(); c.roundRect(hx - r, hy - r * 0.9, r * 2, r * 1.8, r * 0.45); c.fillStyle = pal.body; c.fill(); c.stroke();
    c.save(); c.clip(); c.fillStyle = pal.trim; c.fillRect(hx - r * 1.2, hy - r * 1.0, r * 2.4, r * 0.62); c.restore();
    c.fillStyle = pal.accent; c.fillRect(hx + r * 0.1, hy - r * 0.18, r * 0.75, r * 0.2);
  } else if (look.head === "dragon") {
    c.fillStyle = "#efe6cf";
    c.beginPath(); c.moveTo(hx - r * 0.2, hy - r * 0.75); c.quadraticCurveTo(hx - r * 1.1, hy - r * 1.3, hx - r * 1.7, hy - r * 1.55); c.lineTo(hx - r * 0.75, hy - r * 0.35); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(hx + r * 0.2, hy - r * 0.85); c.quadraticCurveTo(hx - r * 0.4, hy - r * 1.6, hx - r * 0.9, hy - r * 2.0); c.lineTo(hx - r * 0.25, hy - r * 0.6); c.closePath(); c.fill(); c.stroke();
    c.save(); c.translate(hx + r * 0.25, hy + r * 0.1); c.rotate(P.mouth * 0.55);
    c.beginPath(); c.roundRect(0, -r * 0.05, r * 1.3, r * 0.45, r * 0.2); c.fillStyle = mix(pal.body, "#0b0c18", 0.25); c.fill(); c.stroke();
    c.restore();
    if (P.mouth > 0.3) { c.fillStyle = `rgba(255,170,60,${P.mouth * 0.9})`; c.beginPath(); c.arc(hx + r * 1.1, hy + r * 0.25, r * 0.32 * P.mouth, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fillStyle = pal.body; c.fill(); c.stroke();
    c.beginPath(); c.roundRect(hx + r * 0.15, hy - r * 0.5, r * 1.5, r * 0.62, r * 0.28); c.fill(); c.stroke();
    c.fillStyle = OUT; c.beginPath(); c.arc(hx + r * 1.45, hy - r * 0.3, r * 0.09, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.accent; c.beginPath(); c.ellipse(hx + r * 0.05, hy - r * 0.32, r * 0.32, r * 0.22, -0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = OUT; c.fillRect(hx + r * 0.08, hy - r * 0.48, r * 0.1, r * 0.32);
  } else if (look.head === "potato") {
    const er = Math.max(3.2, r * 0.42);
    for (const [ex, ey] of [[hx - r * 0.25, hy], [hx + r * 0.8, hy + r * 0.05]]) {
      c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.arc(ex + er * 0.3, ey + er * 0.1, er * 0.5, 0, Math.PI * 2); c.fillStyle = OUT; c.fill();
    }
    c.strokeStyle = OUT; c.lineWidth = 1.8;
    if (P.mouth > 0.5) { c.beginPath(); c.ellipse(hx + r * 0.35, hy + r * 1.05, r * 0.32, r * 0.24, 0, 0, Math.PI * 2); c.fillStyle = "#3a1a14"; c.fill(); }
    else { c.beginPath(); c.arc(hx + r * 0.35, hy + r * 0.7, r * 0.35, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke(); }
    const sx = -P.w * 0.04, sy = P.top + 1;
    c.strokeStyle = "#3f7d4a"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(sx, sy + 2); c.quadraticCurveTo(sx - 1, sy - 4, sx + 1, sy - 8); c.stroke();
    c.fillStyle = "#6fbf73";
    c.beginPath(); c.ellipse(sx - 4, sy - 8, 4.5, 2.2, -0.5, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.ellipse(sx + 5, sy - 9, 4.5, 2.2, 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  } else {
    c.beginPath(); c.moveTo(hx, hy - r * 1.2); c.lineTo(hx + r * 1.0, hy); c.lineTo(hx, hy + r * 1.05); c.lineTo(hx - r * 1.0, hy); c.closePath();
    c.fillStyle = pal.body; c.fill(); c.stroke();
    c.save(); c.clip(); c.fillStyle = pal.trim; c.fillRect(hx - r * 1.2, hy - r * 0.32, r * 2.4, r * 0.42); c.restore();
    c.beginPath(); c.arc(hx + r * 0.42, hy - r * 0.1, r * 0.16, 0, Math.PI * 2); c.fillStyle = OUT; c.fill();
  }
}

function drawScarf(c, f, tk) {
  const a = f.anim;
  const L_ = f.spec.look, s = f.s;
  const nx = f.x - f.facing * s.w * 0.1, ny = f.y - s.h * (L_.leg + L_.torso * 0.95);
  if (!a.scarf) a.scarf = Array.from({ length: 5 }, () => [nx, ny]);
  const pts = a.scarf;
  pts[0] = [nx, ny];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    const tx = q[0] - f.facing * 6 - (f.vx + f.kbx) * 0.4, ty = q[1] + 3.5 + Math.sin(tk * 0.2 + i * 0.9) * 2 - (f.vy + f.kby) * 0.3;
    p[0] += (tx - p[0]) * 0.5; p[1] += (ty - p[1]) * 0.5;
    const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy);
    if (d > 8) { p[0] = q[0] + (dx / d) * 8; p[1] = q[1] + (dy / d) * 8; }
  }
  c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]);
  c.strokeStyle = OUT; c.lineWidth = 9; c.stroke();
  c.strokeStyle = f.pal.trim; c.lineWidth = 6; c.stroke();
}

function drawTail(c, P, pal, X, tk, slot) {
  const w = P.w, base = [-w * 0.25, P.hip[1] - 2];
  const tip = P.tailTo || [-w * 1.3, P.hip[1] + P.leg * 0.55 + Math.sin(tk * 0.08 + slot) * 3];
  const dx = tip[0] - base[0], dy = tip[1] - base[1], d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d; if (nx > 0) { nx = -nx; ny = -ny; }
  const bulge = P.tailTo ? d * 0.4 : d * 0.25;
  const ctrl = [(base[0] + tip[0]) / 2 + nx * bulge, (base[1] + tip[1]) / 2 + ny * bulge + (P.tailTo ? 0 : 8)];
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, u = 1 - t; pts.push([u * u * base[0] + 2 * u * t * ctrl[0] + t * t * tip[0], u * u * base[1] + 2 * u * t * ctrl[1] + t * t * tip[1]]); }
  c.lineCap = "round";
  for (const pass of [0, 1]) {
    for (let i = 1; i < pts.length; i++) {
      const wd = lerp(P.leg * 0.55, 3, i / pts.length);
      c.strokeStyle = pass ? pal.body : OUT; c.lineWidth = pass ? wd : wd + 3.5;
      c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    }
  }
  const a = pts[10], b = pts[8], ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
  c.save(); c.translate(a[0], a[1]); c.rotate(ang);
  c.beginPath(); c.moveTo(9, 0); c.lineTo(-2, -6); c.lineTo(1, 0); c.lineTo(-2, 6); c.closePath();
  c.fillStyle = pal.accent; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  c.restore();
}
function drawWing(c, P, pal, f) {
  const w = P.w, anchor = rot([-w * 0.1, P.sh[1] + 5], P.hip, P.lean);
  const air = !f.grounded && f.state !== "ledge";
  const span = w * (air ? 1.35 : 0.95);
  const ang = air ? -0.45 + P.flap : 0.3;
  const shape = [[0, 0], [-span * 0.5, -span * 0.75], [-span, -span * 0.5], [-span * 0.82, -span * 0.08], [-span * 0.52, span * 0.12], [-span * 0.24, span * 0.08]];
  const pts = shape.map((p) => { const cs = Math.cos(ang), sn = Math.sin(ang); return [anchor[0] + p[0] * cs - p[1] * sn, anchor[1] + p[0] * sn + p[1] * cs]; });
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  c.lineTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]);
  c.quadraticCurveTo((pts[2][0] + pts[3][0]) / 2 + 4, (pts[2][1] + pts[3][1]) / 2, pts[3][0], pts[3][1]);
  c.quadraticCurveTo((pts[3][0] + pts[4][0]) / 2 + 4, (pts[3][1] + pts[4][1]) / 2, pts[4][0], pts[4][1]);
  c.quadraticCurveTo((pts[4][0] + pts[5][0]) / 2 + 3, (pts[4][1] + pts[5][1]) / 2, pts[5][0], pts[5][1]);
  c.closePath();
  c.fillStyle = mix(pal.body, pal.trim, 0.35); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = pal.trim; c.lineWidth = 2.5; c.lineCap = "round";
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]);
  c.moveTo(pts[1][0], pts[1][1]); c.lineTo(pts[3][0], pts[3][1]); c.moveTo(pts[1][0], pts[1][1]); c.lineTo(pts[4][0], pts[4][1]); c.stroke();
}
function drawFlame(c, P, S, tk) {
  const m = rot(P.mouthPt || [P.head[0] + P.hr * 1.5, P.head[1] + P.hr * 0.25], P.hip, P.lean);
  const len = Math.hypot(S.tx - m[0], S.ty - m[1]) + S.r, ang = Math.atan2(S.ty - m[1], S.tx - m[0]);
  const fl = Math.sin(tk * 1.3) * 3;
  c.save(); c.translate(m[0], m[1]); c.rotate(ang);
  const gr = c.createLinearGradient(0, 0, len, 0);
  gr.addColorStop(0, "#fff6c8"); gr.addColorStop(0.3, "#ffc04d"); gr.addColorStop(0.7, "#ff6a2b"); gr.addColorStop(1, "rgba(255,70,30,0)");
  c.fillStyle = gr; c.globalAlpha = 0.95;
  c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(len * 0.5, -(S.r + fl), len, -S.r * 0.35);
  c.lineTo(len, S.r * 0.35); c.quadraticCurveTo(len * 0.5, S.r + fl, 0, 3); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,250,220,0.85)";
  c.beginPath(); c.moveTo(0, -1.5); c.quadraticCurveTo(len * 0.4, -S.r * 0.35, len * 0.65, 0); c.quadraticCurveTo(len * 0.4, S.r * 0.35, 0, 1.5); c.fill();
  c.restore();
}

/* ===================== potato fighters =====================
   One shared potato body and face, plus a costume per fighter: flame wings (Phoenix),
   hood, cape and orb (Alchemist), hair, beard, armor, cape and raven (Odin), hat and
   staff (Wizard), sash and katana (Samurai). */
const LIMB = "#2b2934", LIMB_BACK = "#1c1b23";
const SPECKS = [[-0.55, 0.35, 1.3], [-0.2, 0.62, 1.1], [0.36, 0.5, 1.2], [-0.62, -0.05, 1], [0.05, 0.3, 0.9], [0.58, 0.18, 1]];
function potatoPath(c, P) {
  const { rx, ry, cy } = P;
  c.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const bump = 1 + 0.025 * Math.sin(a * 4 + 0.7) + 0.015 * Math.sin(a * 7 + 2);
    const wide = 1 + 0.07 * Math.sin(a);
    const x = Math.cos(a) * rx * bump * wide, y = cy + Math.sin(a) * ry * bump;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}
function potatoBody(c, P, pal) {
  const { rx, ry, cy } = P;
  potatoPath(c, P);
  const g = c.createRadialGradient(-rx * 0.35, cy - ry * 0.45, ry * 0.1, 0, cy, ry * 1.3);
  g.addColorStop(0, mix(pal.body, "#ffffff", 0.35)); g.addColorStop(0.55, pal.body); g.addColorStop(1, mix(pal.body, "#6b3a12", 0.35));
  c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = mix(pal.body, "#5a3410", 0.45);
  for (const [sx, sy, sr] of SPECKS) { c.beginPath(); c.ellipse(sx * rx, cy + sy * ry, sr, sr * 0.7, 0.5, 0, Math.PI * 2); c.fill(); }
}
function leaf(c, x, y, s, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.beginPath(); c.ellipse(0, 0, 5.5 * s, 2.6 * s, 0, 0, Math.PI * 2);
  c.fillStyle = "#7cc85a"; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = "#4f9a3c"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-4 * s, 0); c.lineTo(4 * s, 0); c.stroke();
  c.restore();
}
function sprout(c, x, y, s) {
  c.strokeStyle = "#3f7d3a"; c.lineWidth = 2.2; c.lineCap = "round";
  c.beginPath(); c.moveTo(x, y + 2); c.quadraticCurveTo(x - 1, y - 4 * s, x + 1, y - 7 * s); c.stroke();
  leaf(c, x - 5 * s, y - 8 * s, s, -0.5); leaf(c, x + 6 * s, y - 9 * s, s, 0.5);
}
function potatoFace(c, f, P, look) {
  const w = P.w, [hx, hy] = P.head, er = w * 0.1;
  const e1 = [hx - w * 0.14, hy], e2 = [hx + w * 0.13, hy];
  const hurt = f.state === "hitstun", style = look.face, cos = look.costume;
  c.fillStyle = "rgba(255,105,105,0.5)";
  c.beginPath(); c.ellipse(e1[0] - er * 0.4, hy + er * 1.75, er * 0.85, er * 0.5, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(e2[0] + er * 0.55, hy + er * 1.75, er * 0.85, er * 0.5, 0, 0, Math.PI * 2); c.fill();
  c.lineCap = "round"; c.lineJoin = "round";
  [e1, e2].forEach((e, i) => {
    if (hurt) {
      const s = i ? -1 : 1;
      c.strokeStyle = OUT; c.lineWidth = 2;
      c.beginPath(); c.moveTo(e[0] - s * er * 0.6, e[1] - er * 0.55); c.lineTo(e[0] + s * er * 0.5, e[1]); c.lineTo(e[0] - s * er * 0.6, e[1] + er * 0.55); c.stroke();
      return;
    }
    if (cos === "odin" && i === 0) {
      // the Allfather's eyepatch, strap running up over the hair
      c.fillStyle = "#2a1d18"; c.beginPath(); c.ellipse(e[0], e[1], er * 1.05, er * 1.0, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#2a1d18"; c.lineWidth = 1.8; c.beginPath(); c.moveTo(e[0] - er * 0.6, e[1] - er * 0.7); c.lineTo(e[0] - er * 2.2, e[1] - er * 3.2); c.moveTo(e[0] + er * 0.7, e[1] - er * 0.6); c.lineTo(e[0] + er * 2.4, e[1] - er * 2.6); c.stroke();
      return;
    }
    const k = style === "eager" ? 1.1 : 1, hk = style === "focused" ? 0.8 : 1;
    c.beginPath(); c.ellipse(e[0], e[1], er * k, er * 1.15 * k * hk, 0, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.68 * k * hk, 0, Math.PI * 2); c.fillStyle = cos === "dragon" ? "#e6a52a" : "#4a1f14"; c.fill();
    c.beginPath();
    if (cos === "dragon") c.ellipse(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.13, er * 0.55, 0, 0, Math.PI * 2); else c.arc(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.38 * k * hk, 0, Math.PI * 2);
    c.fillStyle = "#120a08"; c.fill();
    c.beginPath(); c.arc(e[0] + er * 0.4, e[1] - er * 0.25, er * 0.22, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill();
    if (style === "focused" || style === "fierce") {
      // heavy upper lid in skin colour
      const s = i ? 1 : -1;
      c.save(); c.beginPath(); c.ellipse(e[0], e[1], er * k * 1.05, er * 1.2 * hk, 0, 0, Math.PI * 2); c.clip();
      c.fillStyle = f.pal.body; c.beginPath(); c.moveTo(e[0] - er * 1.3, e[1] - er * 1.4); c.lineTo(e[0] + er * 1.3, e[1] - er * 1.4);
      c.lineTo(e[0] + er * 1.3, e[1] - er * (0.25 + s * 0.3)); c.lineTo(e[0] - er * 1.3, e[1] - er * (0.25 - s * 0.3)); c.closePath(); c.fill();
      c.restore();
    }
    if (cos === "wizard") { c.strokeStyle = "#d8b04a"; c.lineWidth = 1.6; c.beginPath(); c.arc(e[0], e[1], er * 1.35, 0, Math.PI * 2); c.stroke(); }
  });
  if (cos === "wizard" && !hurt) { c.strokeStyle = "#d8b04a"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(e1[0] + er * 1.35, e1[1]); c.lineTo(e2[0] - er * 1.35, e2[1]); c.stroke(); }
  c.strokeStyle = style === "stern" ? "#f3efe6" : OUT;
  c.lineWidth = style === "stern" ? 3.4 : 2.2;
  [[e1, -1], [e2, 1]].forEach(([e, side]) => {
    c.beginPath();
    if (style === "evil" || style === "fierce" || style === "focused") { c.moveTo(e[0] + side * er * 0.9, e[1] - er * (style === "focused" ? 1.6 : 1.8)); c.lineTo(e[0] - side * er * 0.7, e[1] - er * (style === "focused" ? 1.15 : 1.2)); }
    else if (style === "stern") { c.moveTo(e[0] - er * 1.1, e[1] - er * 1.45); c.lineTo(e[0] + er * 1.1, e[1] - er * 1.3); }
    else c.arc(e[0], e[1] - er * 0.6, er * 1.1, -2.4, -0.75);
    c.stroke();
  });
  if (style === "stern") return;
  const mx = hx, my = hy + er * 2.3;
  c.strokeStyle = OUT;
  if (P.mouth > 0.5 || hurt) {
    c.beginPath(); c.ellipse(mx, my + 1, er * 0.75, er * (hurt ? 0.5 : 0.65), 0, 0, Math.PI * 2);
    c.fillStyle = "#5a1a14"; c.fill(); c.lineWidth = 1.5; c.stroke();
  } else if (style === "evil") {
    c.beginPath(); c.moveTo(mx - er * 1.3, my - er * 0.3); c.quadraticCurveTo(mx, my + er * 1.3, mx + er * 1.3, my - er * 0.3);
    c.quadraticCurveTo(mx, my + er * 0.2, mx - er * 1.3, my - er * 0.3);
    c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.6; c.stroke();
    c.lineWidth = 1; c.beginPath(); c.moveTo(mx - er * 0.3, my + er * 0.05); c.lineTo(mx - er * 0.3, my + er * 0.6); c.moveTo(mx + er * 0.4, my + er * 0.05); c.lineTo(mx + er * 0.4, my + er * 0.55); c.stroke();
  } else if (style === "eager") {
    c.beginPath(); c.moveTo(mx - er * 1.1, my - er * 0.3); c.quadraticCurveTo(mx, my + er * 1.5, mx + er * 1.1, my - er * 0.3); c.closePath();
    c.fillStyle = "#5a1a14"; c.fill(); c.lineWidth = 1.6; c.stroke();
  } else if (style === "focused") {
    c.beginPath(); c.moveTo(mx - er * 0.7, my + er * 0.1); c.quadraticCurveTo(mx, my - er * 0.15, mx + er * 0.7, my + er * 0.1); c.lineWidth = 1.8; c.stroke();
  } else if (style === "fierce") {
    c.beginPath(); c.moveTo(mx - er * 1.0, my - er * 0.1); c.quadraticCurveTo(mx, my + er * 0.6, mx + er * 1.1, my - er * 0.5); c.lineWidth = 1.8; c.stroke();
    c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(mx + er * 0.25, my + er * 0.2); c.lineTo(mx + er * 0.4, my + er * 0.7); c.lineTo(mx + er * 0.58, my + er * 0.12); c.closePath(); c.fill(); c.lineWidth = 0.8; c.stroke();
  } else {
    c.beginPath(); c.arc(mx, my - er * 0.6, er * (style === "kind" ? 0.85 : 1.05), 0.35, Math.PI - 0.35); c.lineWidth = 1.8; c.stroke();
  }
}
function flameWing(c, ax, ay, ang, len, pal, dark) {
  for (let i = 4; i >= 0; i--) {
    const a = ang + (i - 2) * 0.27, L = len * (1 - Math.abs(i - 2) * 0.13);
    const ca = Math.cos(a), sa = Math.sin(a), tx = ax + ca * L, ty = ay + sa * L, nx = -sa, ny = ca, wd = len * 0.17;
    c.beginPath(); c.moveTo(ax, ay);
    c.quadraticCurveTo(ax + ca * L * 0.55 + nx * wd, ay + sa * L * 0.55 + ny * wd, tx, ty);
    c.quadraticCurveTo(ax + ca * L * 0.55 - nx * wd, ay + sa * L * 0.55 - ny * wd, ax, ay);
    const gr = c.createLinearGradient(ax, ay, tx, ty);
    gr.addColorStop(0, dark ? mix(pal.accent, "#000000", 0.25) : pal.accent); gr.addColorStop(1, mix(pal.accent, "#ffd27a", 0.6));
    c.fillStyle = gr; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
  }
}
// Dragon (2D fallback): bat wing with finger bones, and a tapered tail behind
function batWing(c, ax, ay, ang, len, pal, dark, mirror) {
  c.save(); c.translate(ax, ay); c.rotate(ang); c.scale(len, len * (mirror ? -1 : 1));
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.42, -0.44, 1, -0.42);
  c.quadraticCurveTo(0.86, -0.22, 0.72, -0.08); c.quadraticCurveTo(0.57, -0.13, 0.46, 0.02);
  c.quadraticCurveTo(0.31, -0.03, 0.2, 0.1); c.quadraticCurveTo(0.09, 0.02, 0, 0);
  c.fillStyle = dark ? mix(pal.accent, "#000000", 0.25) : pal.accent; c.fill();
  c.lineWidth = 2.2 / len; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = mix(pal.accent, "#2a1a14", 0.5); c.lineWidth = 1.6 / len;
  c.beginPath(); c.moveTo(0.5, -0.36); for (const [x, y] of [[0.72, -0.08], [0.46, 0.02], [0.2, 0.1]]) { c.moveTo(0.5, -0.36); c.lineTo(x, y); } c.stroke();
  c.restore();
}
function dragonTail(c, P, pal, tk, f) {
  const sw = Math.sin(tk * 0.07 + f.slot) * 3;
  const pts = [[-P.w * 0.2, P.hip[1] - 6], [-P.w * 0.75, P.hip[1] + 2], [-P.w * 1.15, -4 + sw * 0.3], [-P.w * 1.45 + sw, -7]];
  c.lineCap = "round";
  for (const [wd, col] of [[P.w * 0.3 + 3, OUT], [P.w * 0.3, pal.accent]]) {
    for (let i = 0; i < pts.length - 1; i++) {
      c.strokeStyle = col; c.lineWidth = Math.max(1.5, wd * (1 - i * 0.3));
      c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.stroke();
    }
  }
}
function capeShape(c, P, f, tk, color, long) {
  const w = P.w, sway = Math.sin(tk * 0.12 + f.slot) * 2 - clamp((f.vx + f.kbx) * f.facing * 0.8, -8, 8);
  const topY = P.cy - P.ry * (long ? 0.45 : 0.6), botY = P.hip[1] + (long ? 9 : 5);
  c.beginPath(); c.moveTo(w * 0.1, topY); c.lineTo(-w * 0.3, topY - 2);
  c.quadraticCurveTo(-w * 0.9 + sway, (topY + botY) / 2, -w * 0.82 + sway * 1.5, botY);
  c.lineTo(w * 0.05, botY - 2); c.closePath();
  c.fillStyle = color; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
}
function ravenShape(c, x, y, s, flap) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineWidth = 1.4; c.strokeStyle = OUT;
  c.fillStyle = "#16151c"; c.beginPath(); c.moveTo(-6, 2); c.lineTo(-17, 8); c.lineTo(-15, 1); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, 0, 9, 6.5, -0.15, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(7, -5, 4.6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#3a3844"; c.beginPath(); c.moveTo(10.5, -6.5); c.lineTo(16.5, -4.5); c.lineTo(10.5, -3); c.closePath(); c.fill();
  c.fillStyle = "#e33b3b"; c.beginPath(); c.arc(8, -6, 1.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#24232c"; c.beginPath(); c.ellipse(-2, -2 - flap * 4, 8, 4, -0.35 - flap, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}
function odinFront(c, P, pal) {
  const { rx, ry, cy } = P, w = P.w, [hx, hy] = P.head, er = w * 0.1;
  c.save(); potatoPath(c, P); c.clip();
  c.fillStyle = "#26252e"; c.beginPath(); c.moveTo(-rx * 1.2, cy + ry * 0.22); c.quadraticCurveTo(0, cy + ry * 0.05, rx * 1.2, cy + ry * 0.22); c.lineTo(rx * 1.2, cy + ry * 1.3); c.lineTo(-rx * 1.2, cy + ry * 1.3); c.fill();
  c.strokeStyle = "#4a4958"; c.lineWidth = 1.4;
  for (const sx of [-0.45, 0.35]) { c.beginPath(); c.arc(sx * rx, cy + ry * 0.48, ry * 0.14, 0.4, 5.6); c.stroke(); }
  c.fillStyle = pal.accent; c.fillRect(-rx * 1.2, cy + ry * 0.66, rx * 2.4, ry * 0.14);
  c.fillStyle = "#f3efe6";
  c.beginPath(); c.moveTo(-rx * 1.3, P.top + ry * 1.1); c.lineTo(-rx * 1.3, P.top - 6); c.lineTo(rx * 1.3, P.top - 6); c.lineTo(rx * 1.3, P.top + ry * 0.3);
  c.quadraticCurveTo(rx * 0.1, P.top + ry * 0.5, -rx * 0.55, P.top + ry * 0.62); c.quadraticCurveTo(-rx * 0.8, P.top + ry * 0.9, -rx * 1.3, P.top + ry * 1.1); c.fill();
  c.restore();
  potatoPath(c, P); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
}
function odinBeard(c, P, pal) {
  const { rx, ry, cy } = P, w = P.w, [hx, hy] = P.head, er = w * 0.1;
  c.beginPath();
  c.moveTo(hx - w * 0.34, hy + er * 1.2);
  c.quadraticCurveTo(hx - w * 0.32, cy + ry * 0.72, hx - w * 0.02, cy + ry * 1.0);
  c.quadraticCurveTo(hx + w * 0.32, cy + ry * 0.72, hx + w * 0.37, hy + er * 1.2);
  c.quadraticCurveTo(hx + w * 0.2, hy + er * 2.3, hx + w * 0.02, hy + er * 1.95);
  c.quadraticCurveTo(hx - w * 0.17, hy + er * 2.3, hx - w * 0.34, hy + er * 1.2);
  c.fillStyle = "#f3efe6"; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = "#d6cfbf"; c.lineWidth = 1;
  for (const k of [-0.15, 0, 0.15]) { c.beginPath(); c.moveTo(hx + k * w, hy + er * 2.4); c.quadraticCurveTo(hx + k * w * 1.2, cy + ry * 0.55, hx + k * w * 0.4, cy + ry * 0.85); c.stroke(); }
  c.beginPath(); c.ellipse(hx + w * 0.02, hy + er * 1.3, er * 0.75, er * 0.65, 0, 0, Math.PI * 2);
  c.fillStyle = mix(pal.body, "#d0704a", 0.35); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = "#f3efe6"; c.strokeStyle = OUT; c.lineWidth = 1;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(rx * 0.86 - i * 0.6, P.top + ry * 0.75 + i * ry * 0.2, 3.2, 3.8, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
}
function alchemistHood(c, P, pal) {
  const { rx, ry, cy } = P, w = P.w, [hx, hy] = P.head;
  c.save();
  c.beginPath(); c.rect(-rx * 1.6, cy - ry * 2.2, rx * 3.2, ry * 2.45); c.clip();
  c.beginPath();
  c.ellipse(-rx * 0.04, cy - ry * 0.16, rx * 1.12, ry * 1.0, 0, 0, Math.PI * 2);
  c.ellipse(hx + w * 0.01, hy + P.ry * 0.12, w * 0.36, ry * 0.52, 0, 0, Math.PI * 2);
  c.fillStyle = pal.accent; c.fill("evenodd"); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  c.restore();
  c.strokeStyle = mix(pal.accent, "#000000", 0.35); c.lineWidth = 1.6;
  c.beginPath(); c.arc(hx, hy + ry * 0.12, w * 0.44, -2.75, -0.5); c.stroke();
  c.beginPath(); c.ellipse(0, cy + ry * 0.3, rx * 1.02, ry * 0.13, 0, 0, Math.PI * 2);
  c.fillStyle = mix(pal.accent, "#000000", 0.2); c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
  leaf(c, -w * 0.18, cy - ry * 1.12, 1, -0.6); leaf(c, w * 0.1, cy - ry * 1.15, 1, 0.5);
}
function wizardHat(c, P, pal, tk) {
  const { rx, ry } = P, by = P.top + ry * 0.22, sway = Math.sin(tk * 0.06) * 2;
  c.beginPath();
  c.moveTo(-rx * 0.75, by);
  c.quadraticCurveTo(-rx * 0.45, by - ry * 0.9, -rx * 0.25, by - ry * 1.35);
  c.quadraticCurveTo(-rx * 0.55 + sway, by - ry * 1.75, -rx * 1.05 + sway, by - ry * 1.55);
  c.quadraticCurveTo(-rx * 0.3, by - ry * 1.65, rx * 0.12, by - ry * 1.1);
  c.quadraticCurveTo(rx * 0.45, by - ry * 0.6, rx * 0.75, by);
  c.closePath();
  c.fillStyle = pal.accent; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  c.save(); c.clip(); c.fillStyle = mix(pal.accent, "#000000", 0.35); c.fillRect(-rx * 1.2, by - ry * 0.32, rx * 2.4, ry * 0.16); c.restore();
  c.beginPath(); c.ellipse(0, by, rx * 1.32, ry * 0.18, 0, 0, Math.PI * 2);
  c.fillStyle = mix(pal.accent, "#000000", 0.12); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  leaf(c, -rx * 0.3, by - ry * 0.62, 0.8, -0.4); leaf(c, rx * 0.2, by - ry * 0.4, 0.8, 0.6); leaf(c, -rx * 0.45, by - ry * 1.25, 0.75, 0.2);
}
function heldDir(f, P, shR, rest) {
  const m = f.state === "attack" && f.move;
  if (m && m.kind === "dash") return 0.05;
  if (m && (m.limb === "arm" || m.limb === "both")) return Math.atan2(P.hF[1] - shR[1], P.hF[0] - shR[0]);
  return rest;
}
function wizardStaff(c, P, f, shR, tk) {
  const a = heldDir(f, P, shR, -Math.PI / 2 + 0.12), dx = Math.cos(a), dy = Math.sin(a), [hx, hy] = P.hF;
  const b = [hx - dx * 34, hy - dy * 34], t = [hx + dx * 40, hy + dy * 40];
  c.lineCap = "round";
  c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(t[0], t[1]); c.stroke();
  c.strokeStyle = "#7a4a26"; c.lineWidth = 3.5; c.stroke();
  const fl = 1 + Math.sin(tk * 0.3) * 0.08;
  const glow = c.createRadialGradient(t[0], t[1], 1, t[0], t[1], 16 * fl);
  glow.addColorStop(0, "rgba(255,226,140,0.85)"); glow.addColorStop(1, "rgba(255,200,90,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(t[0], t[1], 16 * fl, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(t[0], t[1]); c.rotate(a + Math.PI / 2);
  c.beginPath(); c.moveTo(0, -11 * fl); c.lineTo(4.5, -2); c.lineTo(2.5, 4); c.lineTo(-2.5, 4); c.lineTo(-4.5, -2); c.closePath();
  c.fillStyle = "#ffd27a"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = "#a8701c"; c.stroke();
  c.fillStyle = "#fff6d8"; c.beginPath(); c.moveTo(0, -7 * fl); c.lineTo(2, -1); c.lineTo(-2, -1); c.closePath(); c.fill();
  c.restore();
  P.staffTip = t;
}
function katana(c, P, f, shR, pal) {
  const a = heldDir(f, P, shR, -0.8), L = P.w * 1.35;
  c.save(); c.translate(P.hF[0], P.hF[1]); c.rotate(a);
  c.lineCap = "round";
  c.strokeStyle = OUT; c.lineWidth = 5.5; c.beginPath(); c.moveTo(-9, 0); c.lineTo(2, 0); c.stroke();
  c.strokeStyle = "#3a2a22"; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.moveTo(4, -1.8); c.quadraticCurveTo(L * 0.55, -3.6, L, -5.5); c.quadraticCurveTo(L * 0.55, 0.6, 4, 1.8); c.closePath();
  c.fillStyle = pal.accent; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1; c.beginPath(); c.moveTo(7, -1); c.quadraticCurveTo(L * 0.55, -2.5, L - 4, -4.5); c.stroke();
  c.beginPath(); c.ellipse(3, 0, 2.2, 5.2, 0, 0, Math.PI * 2); c.fillStyle = "#c9a227"; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.restore();
}
function greenOrb(c, x, y, r, tk) {
  const fl = 1 + Math.sin(tk * 0.25) * 0.08;
  const glow = c.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4 * fl);
  glow.addColorStop(0, "rgba(140,255,120,0.55)"); glow.addColorStop(1, "rgba(80,255,90,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(x, y, r * 2.4 * fl, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#eaffd8"); g.addColorStop(0.45, "#7dff62"); g.addColorStop(1, "#2fbf3a");
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.5; c.strokeStyle = "#1d6b26"; c.stroke();
}
function drawZap(c, from, S, tk, alt) {
  const [x0, y0] = from, x1 = S.tx, y1 = S.ty, n = 7;
  const pts = [[x0, y0]];
  for (let i = 1; i < n; i++) {
    const t = i / n, j = ((Math.sin(tk * 1.7 + i * 12.9) * 43758.5) % 1) * 2 - 1;
    pts.push([x0 + (x1 - x0) * t + j * 7, y0 + (y1 - y0) * t + j * 9]);
  }
  pts.push([x1, y1]);
  for (const [col, wd] of [["rgba(160,255,140,0.45)", 9], ["#d9ffcf", 3.5], ["#ffffff", 1.5]]) {
    c.strokeStyle = col; c.lineWidth = wd; c.lineJoin = "round"; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke();
  }
  c.fillStyle = "rgba(200,255,190,0.55)"; c.beginPath(); c.arc(x1, y1, S.r * 0.7, 0, Math.PI * 2); c.fill();
  if (alt) {
    c.strokeStyle = alt; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const t = i / n, j = ((Math.sin(tk * 2.3 + i * 7.1) * 43758.5) % 1) * 2 - 1; c.lineTo(x0 + (x1 - x0) * t + j * 9, y0 + (y1 - y0) * t + j * 11); }
    c.lineTo(x1, y1); c.stroke();
  }
}
function drawMagic(c, from, S, tk) {
  const len = Math.hypot(S.tx - from[0], S.ty - from[1]) + S.r, ang = Math.atan2(S.ty - from[1], S.tx - from[0]);
  const fl = Math.sin(tk * 1.1) * 3;
  c.save(); c.translate(from[0], from[1]); c.rotate(ang);
  const gr = c.createLinearGradient(0, 0, len, 0);
  gr.addColorStop(0, "#fffbe6"); gr.addColorStop(0.35, "#ffe08a"); gr.addColorStop(0.75, "#7fe3ff"); gr.addColorStop(1, "rgba(120,220,255,0)");
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(len * 0.5, -(S.r + fl), len, -S.r * 0.3); c.lineTo(len, S.r * 0.3); c.quadraticCurveTo(len * 0.5, S.r + fl, 0, 3); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,0.8)";
  for (let i = 1; i <= 3; i++) { const t = ((tk * 0.07 + i / 3) % 1) * len; c.beginPath(); c.arc(t, Math.sin(tk * 0.4 + i) * S.r * 0.4, 2, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
function drawPotato(c, f, tk, at) {
  const ox = at ? at[0] : f.x, oy = at ? at[1] : f.y;
  const look = f.spec.look, pal0 = f.pal, cos = look.costume;
  const P = pose(f, tk);
  let alpha = 1;
  if (intangible(f) && f.state !== "respawn" && f.state !== "getup") alpha = (tk >> 2) % 2 ? 0.55 : 0.8;
  if (f.state === "dodge" && f.st >= 3 && f.st <= (f.dodgeKind === "air" ? 20 : 16)) alpha = 0.45;
  const flash = f.flash > 0 && f.flash % 2 === 0;
  const pal = flash ? { body: "#ffffff", trim: "#ffffff", accent: "#ffffff" } : P.dim ? { body: mix(pal0.body, "#6a6a7a", 0.45), trim: pal0.trim, accent: mix(pal0.accent, "#6a6a7a", 0.45) } : pal0;
  const limbF = flash ? "#ffffff" : LIMB, limbB = flash ? "#e8e8f0" : LIMB_BACK;
  c.save();
  c.translate(ox, oy); c.globalAlpha = alpha; c.scale(f.facing, 1);
  if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
  c.lineCap = "round"; c.lineJoin = "round";
  const lw = look.limbW, legLen = Math.max(P.leg * 1.25, 12), armLen = P.tor * 0.85;
  const shR = rot(P.sh, P.hip, P.lean), shB = rot(P.shB, P.hip, P.lean);
  if (cos === "phoenix") {
    const air = !f.grounded && f.state !== "ledge";
    const len = P.w * (air ? 1.35 : 1.0);
    const a1 = rot([-P.w * 0.2, P.cy - P.ry * 0.2], P.hip, P.lean), a2 = rot([P.w * 0.05, P.cy - P.ry * 0.3], P.hip, P.lean);
    flameWing(c, a1[0], a1[1], (air ? -2.7 : -2.4) + P.flap + P.lean, len, pal, true);
    flameWing(c, a2[0], a2[1], (air ? -0.75 : -1.2) - P.flap * 0.7 + P.lean, len * 0.9, pal, false);
  }
  if (cos === "dragon") {
    dragonTail(c, P, pal, tk, f);
    const air = !f.grounded && f.state !== "ledge", len = P.w * (air ? 1.1 : 0.95);
    const a1 = rot([-P.w * 0.3, P.cy + P.ry * 0.1], P.hip, P.lean), a2 = rot([P.w * 0.2, P.cy + P.ry * 0.05], P.hip, P.lean);
    batWing(c, a1[0], a1[1], Math.PI + 0.18 - P.flap + P.lean, len, pal, true, true);
    batWing(c, a2[0], a2[1], -0.25 + P.flap * 0.7 + P.lean, len * 0.9, pal, false, false);
  }
  if (cos === "alchemist") capeShape(c, P, f, tk, mix(pal.accent, "#000000", 0.15), false);
  if (cos === "odin") capeShape(c, P, f, tk, pal.accent, true);
  limbPath(c, P.hipB, P.fB, legLen, "fwd", lw, limbB);
  c.fillStyle = limbB; c.beginPath(); c.ellipse(P.fB[0] + 2, P.fB[1] - 1, 5, 3, 0, 0, Math.PI * 2); c.fill();
  limbPath(c, shB, P.hB, armLen, "down", lw - 0.5, limbB);
  c.fillStyle = limbB; c.beginPath(); c.arc(P.hB[0], P.hB[1], lw * (look.fist ? 1 : 0.85), 0, Math.PI * 2); c.fill();
  limbPath(c, P.hipF, P.fF, legLen, "fwd", lw, limbF);
  c.fillStyle = limbF; c.beginPath(); c.ellipse(P.fF[0] + 2, P.fF[1] - 1, 5.5, 3.2, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
  potatoBody(c, P, pal);
  if (cos === "odin") odinFront(c, P, pal);
  if (cos === "samurai") {
    c.save(); potatoPath(c, P); c.clip();
    c.fillStyle = "#24222c"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.42, P.rx * 2.6, P.ry);
    c.fillStyle = "#c8352b"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.62, P.rx * 2.6, 1.6); c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.82, P.rx * 2.6, 1.6);
    c.fillStyle = "#2a2833"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.3, P.rx * 2.6, P.ry * 0.17);
    c.fillStyle = "#c8352b"; c.fillRect(-P.rx * 1.3, P.cy - P.ry * 0.62, P.rx * 2.6, P.ry * 0.13);
    c.restore();
    c.fillStyle = "#c8352b"; c.beginPath(); c.ellipse(-P.rx * 0.98, P.cy - P.ry * 0.56, 2.6, 2.4, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-P.rx * 1.12, P.cy - P.ry * 0.42, 1.5, 4.5, 0.7, 0, Math.PI * 2); c.fill();
  }
  if (cos === "wizard") {
    c.save(); potatoPath(c, P); c.clip();
    c.fillStyle = mix(pal.accent, "#000000", 0.25); c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.45, P.rx * 2.6, P.ry);
    c.fillStyle = "#d8b04a"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.45, P.rx * 2.6, 1.8);
    c.restore();
  }
  if (cos === "dragon") {
    c.fillStyle = mix(pal.body, "#fff0c6", 0.45); c.beginPath(); c.ellipse(P.rx * 0.18, P.cy + P.ry * 0.55, P.rx * 0.55, P.ry * 0.32, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = mix(pal.body, "#7a4a22", 0.4); c.lineWidth = 1.2;
    for (const t of [-0.3, 0, 0.3]) { const yy = P.cy + P.ry * (0.55 + t * 0.6), hw2 = P.rx * 0.5 * Math.sqrt(1 - t * t * 1.6); c.beginPath(); c.moveTo(P.rx * 0.18 - hw2, yy); c.lineTo(P.rx * 0.18 + hw2, yy); c.stroke(); }
  }
  potatoFace(c, f, P, look);
  if (cos === "odin") odinBeard(c, P, pal);
  if (cos === "alchemist") {
    alchemistHood(c, P, pal);
    const [gx, gy] = P.head, er = P.w * 0.1;
    for (const dx of [-1.25, 1.2]) { c.fillStyle = "#b8863b"; c.beginPath(); c.arc(gx + dx * er, gy - er * 3.1, er * 0.75, 0, Math.PI * 2); c.fill(); c.fillStyle = "#8fe8d2"; c.beginPath(); c.arc(gx + dx * er, gy - er * 3.1, er * 0.5, 0, Math.PI * 2); c.fill(); }
  }
  if (cos === "wizard") wizardHat(c, P, pal, tk);
  if (cos === "phoenix") for (const a of [-2.2, -1.75, -1.3]) flameWing(c, -P.w * 0.12, P.top + P.ry * 0.2, a, P.w * 0.42, pal, false);
  if (cos === "dragon") {
    c.fillStyle = "#efe3c8"; c.strokeStyle = OUT; c.lineWidth = 1.2;
    for (const x0 of [-P.w * 0.2, P.w * 0.12]) { c.beginPath(); c.moveTo(x0 - 3.5, P.top + 5); c.quadraticCurveTo(x0 - 3, P.top - 8, x0 - 9, P.top - 15); c.quadraticCurveTo(x0 + 1, P.top - 6, x0 + 3.5, P.top + 4); c.closePath(); c.fill(); c.stroke(); }
  }
  if (cos === "samurai") { c.fillStyle = "#1c1714"; c.beginPath(); c.ellipse(-P.w * 0.04, P.top - 2, 5.5, 4.5, 0, 0, Math.PI * 2); c.fill(); sprout(c, -P.w * 0.04, P.top - 5, 0.85); }
  if (cos === "phoenix" || cos === "dragon") sprout(c, -P.w * 0.04, P.top + 1, 1);
  if (cos === "odin") sprout(c, P.w * 0.06, P.top - 3, 0.9);
  c.restore();
  if (cos === "odin" && !f._ravenOut) {
    const p = rot([-P.w * 0.38, P.top + P.ry * 0.62], P.hip, P.lean);
    ravenShape(c, p[0], p[1], 0.85, Math.sin(tk * 0.08) > 0.95 ? 0.4 : 0);
  }
  limbPath(c, shR, P.hF, armLen, "down", lw, limbF);
  c.fillStyle = limbF; c.beginPath(); c.arc(P.hF[0], P.hF[1], lw * (look.fist ? 1.15 : 0.95), 0, Math.PI * 2); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  if (cos === "wizard") wizardStaff(c, P, f, shR, tk);
  if (cos === "samurai") katana(c, P, f, shR, pal);
  if (cos === "alchemist" && f.specCd <= 0 && !flash) greenOrb(c, P.hF[0] + 2, P.hF[1] - 4, P.w * 0.15, tk);
  if (f.armorFlash > 0 || (BL.armored(f) && tk % 6 < 3)) {
    c.strokeStyle = "rgba(255,240,200,0.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -P.h * 0.5, P.w * 0.9, P.h * 0.62, 0, 0, Math.PI * 2); c.stroke();
  }
  if (P.swoosh) {
    const S = P.swoosh, m = f.move;
    c.globalAlpha = alpha * (S.heavy ? 0.75 : 0.55);
    c.strokeStyle = pal0.accent; c.lineCap = "round";
    if (S.fire) { c.globalAlpha = alpha; drawFlame(c, P, S, tk); }
    else if (m && m.zap) { c.globalAlpha = alpha; drawZap(c, [P.hF[0], P.hF[1] - 4], S, tk, skinLvl(f) >= 3 ? pal0.accent : null); }
    else if (m && m.magic) { c.globalAlpha = alpha * 0.95; drawMagic(c, P.staffTip || P.hF, S, tk); }
    else drawSwoosh(c, f, P, S);
  }
  c.restore();
}
// Slash arcs. Samurai skins from 120 chips get an ink-brush underlay with the same shape and size.
function drawSwoosh(c, f, P, S) {
  const ink = f.spec.look.costume === "samurai" && skinLvl(f) >= 2 && !S.body;
  const path = () => {
    c.beginPath();
    if (S.body) c.arc(0, -P.h * 0.5, S.r + 4, P.spin - 2.2, P.spin + 0.4);
    else if (S.sweep) { c.moveTo(S.sx, S.sy); c.quadraticCurveTo((S.sx + S.tx) / 2, Math.min(S.sy, S.ty) - S.r * 0.8, S.tx, S.ty); }
    else c.arc(S.tx - S.r * 0.45, S.ty, S.r * 0.95, -1.15, 1.15);
  };
  const lw = S.body ? 5 : S.sweep ? S.r * 0.6 : S.r * (S.heavy ? 0.5 : 0.35);
  if (ink) {
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.8; c.strokeStyle = "rgba(20,15,30,0.85)"; c.lineWidth = lw; path(); c.stroke();
    c.globalAlpha = ga; c.strokeStyle = f.pal.accent; c.lineWidth = lw * 0.45; path(); c.stroke();
    c.strokeStyle = "rgba(20,15,30,0.5)"; c.lineWidth = 1.2; c.setLineDash([2, 5]); path(); c.stroke(); c.setLineDash([]);
    return;
  }
  c.lineWidth = lw; path(); c.stroke();
}

function drawFighter(c, f, tk, at) {
  if (f.spec.look.build === "potato") return drawPotato(c, f, tk, at);
  const ox = at ? at[0] : f.x, oy = at ? at[1] : f.y;
  const look = f.spec.look, pal0 = f.pal, X = px(pal0);
  const P = pose(f, tk);
  let alpha = 1;
  if (intangible(f) && f.state !== "respawn" && f.state !== "getup") alpha = (tk >> 2) % 2 ? 0.55 : 0.8;
  if (f.state === "dodge" && f.st >= 3 && f.st <= (f.dodgeKind === "air" ? 20 : 16)) alpha = 0.45;
  const flash = f.flash > 0 && f.flash % 2 === 0;
  const pal = P.dim ? { body: X.dim, trim: pal0.trim, accent: pal0.accent } : flash ? { body: "#ffffff", trim: "#ffffff", accent: "#ffffff" } : pal0;
  const back = flash ? "#e8e8f0" : P.dim ? mix(X.dim, "#0b0c18", 0.35) : X.back;
  if (look.scarf && !at) { c.save(); c.globalAlpha = alpha; drawScarf(c, f, tk); c.restore(); }
  c.save();
  c.translate(ox, oy); c.globalAlpha = alpha;
  c.scale(f.facing, 1);
  if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
  c.lineCap = "round"; c.lineJoin = "round";
  const lw = look.limbW, legLen = P.leg * 1.05, armLen = P.tor * 0.95;
  const shR = rot(P.sh, P.hip, P.lean);
  if (look.wings) drawWing(c, P, pal, f);
  if (look.tail) drawTail(c, P, pal, X, tk, f.slot);
  limbPath(c, P.hip, P.fB, legLen, "fwd", lw, back);
  limbPath(c, shR, P.hB, armLen, "down", lw - 1, back);
  if (look.fist) { c.beginPath(); c.arc(P.hB[0], P.hB[1], lw * 0.75, 0, Math.PI * 2); c.fillStyle = back; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); }
  limbPath(c, P.hip, P.fF, legLen, "fwd", lw, pal.body);
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
  drawTorso(c, look, P, pal, X);
  drawHead(c, look, P, pal);
  c.restore();
  limbPath(c, shR, P.hF, armLen, "down", lw, pal.body);
  if (look.fist) { c.beginPath(); c.arc(P.hF[0], P.hF[1], lw * 0.8, 0, Math.PI * 2); c.fillStyle = pal.trim; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); }
  if (f.armorFlash > 0 || (BL.armored(f) && tk % 6 < 3)) {
    c.strokeStyle = "rgba(255,240,200,0.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -P.h * 0.5, P.w * 0.9, P.h * 0.62, 0, 0, Math.PI * 2); c.stroke();
  }
  if (P.swoosh) {
    const S = P.swoosh;
    c.globalAlpha = alpha * (S.heavy ? 0.75 : 0.55);
    c.strokeStyle = pal0.accent; c.lineCap = "round";
    if (S.fire) {
      c.globalAlpha = alpha; drawFlame(c, P, S, tk);
    } else if (S.body) {
      c.lineWidth = 5; c.beginPath(); c.arc(0, -P.h * 0.5, S.r + 4, P.spin - 2.2, P.spin + 0.4); c.stroke();
    } else if (S.sweep) {
      c.lineWidth = S.r * 0.6; c.beginPath(); c.moveTo(S.sx, S.sy); c.quadraticCurveTo((S.sx + S.tx) / 2, Math.min(S.sy, S.ty) - S.r * 0.8, S.tx, S.ty); c.stroke();
    } else {
      c.lineWidth = S.r * (S.heavy ? 0.5 : 0.35); c.beginPath(); c.arc(S.tx - S.r * 0.45, S.ty, S.r * 0.95, -1.15, 1.15); c.stroke();
    }
  }
  c.restore();
}

/* ===================== drawing: world ===================== */
const STARS = Array.from({ length: 70 }, (_, i) => { const r = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1; return { x: r(1), y: r(2), s: r(3) < 0.2 ? 2 : 1, a: 0.25 + r(4) * 0.5 }; });
const ISLES = [{ x: 0.08, w: 0.2, h: 0.05 }, { x: 0.33, w: 0.12, h: 0.03 }, { x: 0.86, w: 0.24, h: 0.065 }, { x: 0.58, w: 0.08, h: 0.02 }];
// The moon is a potato: lumpy outline, a few "eyes" for craters.
function potatoMoon(c, x, y, r) {
  c.save(); c.translate(x, y); c.rotate(-0.22);
  c.beginPath();
  for (let i = 0; i <= 44; i++) {
    const a = (i / 44) * Math.PI * 2, k = 1 + 0.05 * Math.sin(a * 3 + 0.6) + 0.035 * Math.sin(a * 5 + 1.9);
    const px = Math.cos(a) * r * 1.2 * k, py = Math.sin(a) * r * 0.88 * k;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath();
  const gr = c.createRadialGradient(-r * 0.35, -r * 0.3, r * 0.1, 0, 0, r * 1.3);
  gr.addColorStop(0, "#fbe3ac"); gr.addColorStop(0.6, "#f6c98a"); gr.addColorStop(1, "#dca46a");
  c.fillStyle = gr; c.fill();
  for (const [ex, ey, er] of [[-0.55, -0.16, 0.09], [0.08, -0.44, 0.07], [0.5, 0.1, 0.1], [-0.14, 0.38, 0.065], [0.86, -0.28, 0.05]]) {
    c.beginPath(); c.ellipse(ex * r, ey * r, er * r * 1.4, er * r, 0.3, 0, Math.PI * 2); c.fillStyle = "rgba(176,114,60,0.5)"; c.fill();
    c.beginPath(); c.ellipse(ex * r + er * r * 0.35, ey * r - er * r * 0.3, er * r * 0.75, er * r * 0.4, 0.3, 0, Math.PI * 2); c.fillStyle = "rgba(255,238,196,0.35)"; c.fill();
  }
  c.restore();
}
// Far out at sea, in the same muted tones as the islands: a fry box and two giant fries.
function farFries(c, gw, gh, hz) {
  const u = Math.min(gw, gh), px = -cam.x * cam.z * 0.08;
  const fry = (x, base, len, wd, ang) => {
    c.save(); c.translate(x, base); c.rotate(ang);
    c.fillStyle = "#7a5660"; c.beginPath(); c.roundRect(-wd / 2, -len, wd, len + 4, wd * 0.22); c.fill();
    c.fillStyle = "rgba(255,214,150,0.16)"; c.fillRect(-wd / 2 + wd * 0.16, -len + wd * 0.35, wd * 0.24, len - wd * 0.35);
    c.fillStyle = "rgba(40,22,40,0.35)"; c.fillRect(-wd / 2, -len, wd, wd * 0.28);
    c.restore();
  };
  // fry box
  const bx = gw * 0.2 + px, bw = u * 0.075, bh = u * 0.05, top = hz - bh;
  for (const [dx, len, ang] of [[-0.3, 0.07, -0.18], [-0.1, 0.085, -0.05], [0.1, 0.075, 0.08], [0.28, 0.065, 0.2]]) fry(bx + dx * bw, top + 3, u * len, u * 0.012, ang);
  c.fillStyle = "#58304d";
  c.beginPath(); c.moveTo(bx - bw * 0.55, top); c.lineTo(bx + bw * 0.55, top); c.lineTo(bx + bw * 0.45, hz + 2); c.lineTo(bx - bw * 0.45, hz + 2); c.closePath(); c.fill();
  c.fillStyle = "#6b3a5c"; c.fillRect(bx - bw * 0.5, top + bh * 0.3, bw, bh * 0.16);
  // two giant fries standing in the water
  fry(gw * 0.47 + px, hz + 2, u * 0.13, u * 0.026, 0.16);
  fry(gw * 0.5 + px, hz + 2, u * 0.09, u * 0.022, -0.1);
  fry(gw * 0.95 + px, hz + 2, u * 0.11, u * 0.024, -0.12);
}
function drawBackground(c, tk) {
  const gw = L.gw, gh = L.gh;
  const hz = gh * 0.7 - (cam.y + 110) * cam.z * 0.16;
  const sky = c.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#121530"); sky.addColorStop(0.5, "#2a2853"); sky.addColorStop(0.85, "#7b4a66"); sky.addColorStop(1, "#d97c5c");
  c.fillStyle = sky; c.fillRect(0, 0, gw, Math.max(0, hz) + 1);
  for (const s of STARS) {
    const x = (((s.x * gw - cam.x * cam.z * 0.02) % gw) + gw) % gw, y = s.y * hz * 0.75;
    c.fillStyle = `rgba(240,236,255,${s.a})`; c.fillRect(x, y, s.s, s.s);
  }
  const sr = Math.min(gw, gh) * 0.12, sx = gw * 0.7 - cam.x * cam.z * 0.04, sy = hz - sr * 0.3;
  const glow = c.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.2);
  glow.addColorStop(0, "rgba(246,190,130,0.45)"); glow.addColorStop(1, "rgba(246,190,130,0)");
  c.fillStyle = glow; c.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
  potatoMoon(c, sx, sy, sr);
  c.fillStyle = "#3a2f55";
  for (const I of ISLES) {
    const ix = I.x * gw - cam.x * cam.z * 0.08, iw = I.w * gw, ih = I.h * gh;
    c.beginPath(); c.moveTo(ix - iw / 2, hz + 1);
    c.quadraticCurveTo(ix - iw * 0.25, hz - ih * 1.1, ix, hz - ih); c.quadraticCurveTo(ix + iw * 0.3, hz - ih * 0.9, ix + iw / 2, hz + 1); c.fill();
  }
  farFries(c, gw, gh, hz);
  const sea = c.createLinearGradient(0, hz, 0, gh);
  sea.addColorStop(0, "#463e6a"); sea.addColorStop(1, "#11132b");
  c.fillStyle = sea; c.fillRect(0, hz, gw, gh - hz);
  for (let i = 0; i < 9; i++) {
    const y = hz + 3 + i * i * 2.6 + i * 3;
    if (y > gh) break;
    const wd = sr * (1.5 - i * 0.12) * (0.75 + 0.25 * Math.sin(tk * 0.035 + i * 1.7));
    c.fillStyle = `rgba(246,201,138,${0.42 - i * 0.04})`; c.fillRect(sx - wd / 2, y, wd, 2);
  }
}

function drawStage(c, tk) {
  const S = STAGE.main;
  // hanging rock body
  c.beginPath();
  c.moveTo(S.x1, S.top); c.lineTo(S.x2, S.top); c.lineTo(S.x2, S.top + 26); c.lineTo(S.x2 - 14, S.bottom - 6);
  c.lineTo(S.x2 - 70, S.bottom + 4); c.lineTo(S.x2 - 150, S.bottom); c.lineTo(S.x2 - 230, S.bottom + 8); c.lineTo(S.x1 + 240, S.bottom + 6);
  c.lineTo(S.x1 + 150, S.bottom + 10); c.lineTo(S.x1 + 60, S.bottom + 2); c.lineTo(S.x1 + 14, S.bottom - 6); c.lineTo(S.x1, S.top + 26); c.closePath();
  const rock = c.createLinearGradient(0, S.top, 0, S.bottom + 10);
  rock.addColorStop(0, "#4a4566"); rock.addColorStop(1, "#211e37");
  c.fillStyle = rock; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
  c.save(); c.clip();
  c.strokeStyle = "rgba(14,16,34,0.35)"; c.lineWidth = 2;
  for (const [y, a, b] of [[24, -300, -80], [30, 40, 290], [44, -200, 120]]) { c.beginPath(); c.moveTo(a, y); c.lineTo(b, y + 3); c.stroke(); }
  c.restore();
  // moss lip
  c.beginPath(); c.roundRect(S.x1 - 4, S.top - 3, S.x2 - S.x1 + 8, 12, 5);
  c.fillStyle = "#5f8f6d"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = "#a7d29b"; c.fillRect(S.x1, S.top - 2, S.x2 - S.x1, 3);
  // ledge marks
  c.fillStyle = "#f3d9a4";
  c.fillRect(S.x1 - 4, S.top - 3, 8, 3); c.fillRect(S.x2 - 4, S.top - 3, 8, 3);
  // soft platforms
  for (const p of STAGE.plats) {
    const gy = p.y + 18 + Math.sin(tk * 0.03 + p.x1) * 2;
    c.fillStyle = "rgba(127,214,200,0.12)"; c.beginPath(); c.ellipse((p.x1 + p.x2) / 2, gy, (p.x2 - p.x1) * 0.4, 5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.roundRect(p.x1, p.y - 1, p.x2 - p.x1, 11, 5);
    c.fillStyle = "#4b4672"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "#d8d2f0"; c.fillRect(p.x1 + 4, p.y, p.x2 - p.x1 - 8, 2.5);
  }
}

function drawShadow(c, f) {
  const S = STAGE.main;
  if (f.state === "dead" || f.state === "gone" || f.x < S.x1 || f.x > S.x2) return;
  let gy = S.top;
  for (const p of STAGE.plats) if (f.x >= p.x1 && f.x <= p.x2 && f.y <= p.y + 1 && p.y < gy) gy = p.y;
  const hgt = gy - f.y;
  if (hgt < -2) return;
  const a = clamp(0.35 - hgt / 900, 0.05, 0.35), sc = clamp(1 - hgt / 600, 0.4, 1);
  c.fillStyle = `rgba(8,8,20,${a})`; c.beginPath(); c.ellipse(f.x, gy + 1, f.s.w * 0.75 * sc, 4 * sc, 0, 0, Math.PI * 2); c.fill();
}

function drawRespawnPlat(c, f, tk) {
  if (f.state !== "respawn") return;
  const pulse = 0.6 + Math.sin(tk * 0.15) * 0.2;
  c.fillStyle = rgba(col(f.pal), 0.25 * pulse); c.beginPath(); c.ellipse(f.x, f.y + 8, 52, 14, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.roundRect(f.x - 40, f.y, 80, 8, 4); c.fillStyle = col(f.pal); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
}

function drawProj(c, p, tk) {
  if (p.style === "orb") {
    for (let i = 3; i >= 1; i--) { c.fillStyle = `rgba(120,255,110,${0.12 * (4 - i)})`; c.beginPath(); c.arc(p.x - p.vx * i * 1.6, p.y - p.vy * i * 1.6, p.r * (1 - i * 0.15), 0, Math.PI * 2); c.fill(); }
    greenOrb(c, p.x, p.y, p.r * 0.9, tk);
    return;
  }
  if (p.style === "burst") {
    const k = p.t / p.life, r = p.r * (0.55 + 0.45 * ease(Math.min(1, k * 1.6)));
    const g = c.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r);
    g.addColorStop(0, `rgba(230,255,210,${0.9 * (1 - k)})`); g.addColorStop(0.5, `rgba(120,255,100,${0.6 * (1 - k)})`); g.addColorStop(1, "rgba(60,200,70,0)");
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    return;
  }
  if (p.style === "raven") {
    c.save(); c.translate(p.x, p.y); c.scale(p.vx >= 0 ? 1 : -1, 1);
    ravenShape(c, 0, 0, 1.25, Math.sin(tk * 0.6) * 0.7);
    c.restore();
    return;
  }
  if (p.style === "bolt") {
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
    const g = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 2);
    g.addColorStop(0, "rgba(255,240,180,0.9)"); g.addColorStop(1, "rgba(120,220,255,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(-p.r * 0.6, 0, p.r * 2.4, p.r * 1.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(p.r * 1.1, 0); c.lineTo(0, -p.r * 0.55); c.lineTo(-p.r * 0.9, 0); c.lineTo(0, p.r * 0.55); c.closePath();
    c.fillStyle = "#ffe08a"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = "#a8701c"; c.stroke();
    c.restore();
    return;
  }
  if (p.style === "fire") {
    const fl = Math.sin(tk * 0.9 + p.x * 0.05);
    for (let i = 4; i >= 1; i--) {
      c.fillStyle = `rgba(255,${110 + i * 18},40,${0.2 * (5 - i) / 4})`;
      c.beginPath(); c.arc(p.x - p.vx * i * 1.7, p.y - p.vy * i * 1.7, p.r * (1 - i * 0.13), 0, Math.PI * 2); c.fill();
    }
    const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.5);
    gr.addColorStop(0, "#fffbe0"); gr.addColorStop(0.3, "#ffd166"); gr.addColorStop(0.65, "#ff7a2b"); gr.addColorStop(1, "rgba(255,70,30,0)");
    c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, p.r * 1.5 + fl * 1.5, 0, Math.PI * 2); c.fill();
    return;
  }
  if (p.style === "fry") {
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx) + Math.sin(p.t * 0.6) * 0.08);
    c.strokeStyle = "rgba(255,240,200,0.45)"; c.lineWidth = 2; c.lineCap = "round";
    c.beginPath(); c.moveTo(-20, -2); c.lineTo(-34, -2); c.moveTo(-20, 3); c.lineTo(-28, 3); c.stroke();
    c.beginPath(); c.roundRect(-15, -4, 30, 8, 2.5); c.fillStyle = "#f2c14e"; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "#ffe48f"; c.fillRect(-12, -2.5, 20, 2);
    c.fillStyle = "#c9862b"; c.fillRect(10, -2.5, 3, 5);
    c.restore();
    return;
  }
  const a = tk * 0.5 * p.dir;
  c.save(); c.translate(p.x, p.y);
  c.strokeStyle = rgba(p.pal.body, 0.35); c.lineWidth = 3; c.lineCap = "round";
  for (let i = 1; i <= 3; i++) { c.beginPath(); c.moveTo(-sign(p.vx) * (p.r + i * 6), -6 + i * 4); c.lineTo(-sign(p.vx) * (p.r + i * 14), -6 + i * 4); c.stroke(); }
  c.rotate(a);
  c.beginPath(); c.arc(0, 0, p.r, 0, Math.PI * 2); c.fillStyle = p.pal.body; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = p.pal.trim; c.lineWidth = 3;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, p.r * 0.6, i * 2.1, i * 2.1 + 1.2); c.stroke(); }
  c.restore();
}

function drawTag(c, f, isP1, lift) {
  if (f.state === "dead" || f.state === "gone") return;
  const label = isP1 ? "YOU" : match && match.online ? (NET.oppName || "FRIEND").slice(0, 10).toUpperCase() : match && match.tutorial ? "DUMMY" : "CPU";
  const k = 1 / cam.z, y = f.y - f.s.h - (22 + (lift || 0)) * k;
  c.save(); c.translate(f.x, y); c.scale(k, k);
  c.fillStyle = isP1 ? "#f3d9a4" : "#a4a9c8";
  c.beginPath(); c.moveTo(-6, -2); c.lineTo(6, -2); c.lineTo(0, 6); c.closePath(); c.fill();
  c.font = '800 12px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center";
  c.fillText(label, 0, -6);
  c.restore();
}

/* ===================== effects ===================== */
const fx = [], sfx = [], trails = [[], []], combos = [null, null];
function addFx(o) { if (fx.length < 260) fx.push(o); }
function spark(x, y, col, kb, dx, dy) {
  const n = 6 + Math.min(10, (kb * 0.35) | 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * (4 + kb * 0.35);
    addFx({ k: "line", x, y, vx: Math.cos(a) * sp + (dx || 0) * kb * 0.25, vy: Math.sin(a) * sp + (dy || 0) * kb * 0.25, t: 0, life: 9 + Math.random() * 8, col: i % 2 ? "#ffffff" : col, w: 2 + kb * 0.08 });
  }
  addFx({ k: "ring", x, y, t: 0, life: 14, r0: 8, r1: 26 + kb * 2.4, col });
  if (kb > 14) addFx({ k: "star", x, y, t: 0, life: 7, s: 26 + kb * 1.6 });
}
function dust(x, y, n, spread) {
  for (let i = 0; i < n; i++) addFx({ k: "puff", x: x + (Math.random() - 0.5) * spread, y: y - 2, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.4, r: 4 + Math.random() * 5, t: 0, life: 16 + Math.random() * 10 });
}
function ember(x, y, vx, vy) { addFx({ k: "ember", x, y, vx, vy, t: 0, life: 12 + Math.random() * 10, r: 1.8 + Math.random() * 2.4 }); }
function updateFx(g) {
  skinTick(g, tick);
  for (const p of g.projs) if (p.style === "fire" && Math.random() < 0.7) ember(p.x - p.vx * 0.6 + (Math.random() - 0.5) * 10, p.y + (Math.random() - 0.5) * 10, -p.vx * 0.12 + (Math.random() - 0.5), -0.6 - Math.random());
  for (const f of g.fighters) {
    if (f.state !== "attack" || !f.move || !f.move.fire) continue;
    const bx = BL.activeBoxes(f);
    if (bx) for (const b of bx) ember(b.x + (Math.random() - 0.5) * b.r, b.y + (Math.random() - 0.5) * b.r, f.facing * (1 + Math.random() * 2), -0.8 - Math.random());
  }
  for (const e of fx) {
    e.t++;
    if (e.vx !== undefined) { const d = e.damp || 0.9; e.x += e.vx; e.y += e.vy; e.vx *= d; e.vy = e.vy * d + (e.g || 0); }
    if (e.vr) e.rot += e.vr;
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t >= fx[i].life) fx.splice(i, 1);
  for (const e of sfx) e.t++;
  for (let i = 0; i < 2; i++) { const cb = combos[i]; if (cb) { cb.t++; cb.pop *= 0.82; if (cb.t > 80) combos[i] = null; } }
  for (let i = sfx.length - 1; i >= 0; i--) if (sfx[i].t >= sfx[i].life) sfx.splice(i, 1);
  g.fighters.forEach((f, i) => {
    const tr = trails[i];
    if (f.state === "hitstun" && Math.hypot(f.kbx, f.kby) > 7) tr.push([f.x, f.y - f.s.h * 0.5]);
    else if (tr.length) tr.shift();
    if (tr.length > 16) tr.shift();
    if (f.state === "dead" || f.state === "gone") tr.length = 0;
  });
}
function drawFx(c) {
  for (const e of fx) {
    const a = 1 - e.t / e.life;
    if (drawSkinFx(c, e, a)) continue;
    if (e.k === "line") { c.strokeStyle = e.col; c.globalAlpha = a; c.lineWidth = e.w; c.lineCap = "round"; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x - e.vx * 1.8, e.y - e.vy * 1.8); c.stroke(); }
    else if (e.k === "ring") { c.strokeStyle = e.col; c.globalAlpha = a * 0.8; c.lineWidth = 3 * a + 1; c.beginPath(); c.arc(e.x, e.y, lerp(e.r0, e.r1, ease(e.t / e.life)), 0, Math.PI * 2); c.stroke(); }
    else if (e.k === "ember") { const q = e.t / e.life; c.fillStyle = q < 0.4 ? "#ffe08a" : q < 0.75 ? "#ff8a3d" : "#c9362b"; c.globalAlpha = a; c.beginPath(); c.arc(e.x, e.y, e.r * (1 - q * 0.5), 0, Math.PI * 2); c.fill(); }
    else if (e.k === "puff") { c.fillStyle = e.col || "#d9d4ea"; c.globalAlpha = a * 0.5; c.beginPath(); c.arc(e.x, e.y, e.r * (1 + e.t / e.life), 0, Math.PI * 2); c.fill(); }
    else if (e.k === "star") {
      c.fillStyle = "#ffffff"; c.globalAlpha = a; const s = e.s * (0.6 + 0.4 * a);
      c.beginPath(); c.moveTo(e.x, e.y - s); c.lineTo(e.x + s * 0.18, e.y - s * 0.18); c.lineTo(e.x + s, e.y); c.lineTo(e.x + s * 0.18, e.y + s * 0.18);
      c.lineTo(e.x, e.y + s); c.lineTo(e.x - s * 0.18, e.y + s * 0.18); c.lineTo(e.x - s, e.y); c.lineTo(e.x - s * 0.18, e.y - s * 0.18); c.closePath(); c.fill();
    } else if (e.k === "shock") {
      c.strokeStyle = "#f3d9a4"; c.globalAlpha = a * 0.8; c.lineWidth = 4 * a + 1;
      const r = lerp(10, 90, ease(e.t / e.life)); c.beginPath(); c.ellipse(e.x, e.y, r, r * 0.22, 0, Math.PI, Math.PI * 2); c.stroke();
    }
  }
  c.globalAlpha = 1;
}
function drawTrails(c, g) {
  g.fighters.forEach((f, i) => {
    const tr = trails[i];
    if (tr.length < 2) return;
    c.lineCap = "round"; c.lineJoin = "round";
    for (let k = 1; k < tr.length; k++) {
      const a = k / tr.length;
      c.strokeStyle = rgba(f.lastHitBy ? col(f.lastHitBy.pal) : "#ffffff", 0.35 * a);
      c.lineWidth = f.s.w * 0.9 * a;
      c.beginPath(); c.moveTo(tr[k - 1][0], tr[k - 1][1]); c.lineTo(tr[k][0], tr[k][1]); c.stroke();
    }
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(tr[0][0], tr[0][1]); for (const p of tr) c.lineTo(p[0], p[1]); c.stroke();
  });
}
function drawScreenFx(c) {
  for (const e of sfx) {
    const a = 1 - e.t / e.life;
    if (e.k === "flash") { c.fillStyle = `rgba(255,248,235,${a * 0.35})`; c.fillRect(0, 0, L.gw, L.gh); continue; }
    if (e.k === "beam") {
      const [sx0, sy0] = toScreen(e.wx, e.wy);
      const x = clamp(sx0, 0, L.gw), y = clamp(sy0, 0, L.gh);
      const ang = Math.atan2(L.gh / 2 - y, L.gw / 2 - x);
      const len = Math.max(L.gw, L.gh) * 0.75 * (0.5 + 0.5 * ease(Math.min(1, e.t / 8)));
      const wd = Math.min(L.gw, L.gh) * 0.16 * (e.t < 6 ? e.t / 6 : a);
      c.save(); c.translate(x, y); c.rotate(ang);
      const gr = c.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, rgba(e.col, 0.95)); gr.addColorStop(1, rgba(e.col, 0));
      c.fillStyle = gr; c.beginPath(); c.moveTo(-10, -wd); c.lineTo(len, 0); c.lineTo(-10, wd); c.closePath(); c.fill();
      const gw2 = c.createLinearGradient(0, 0, len * 0.7, 0);
      gw2.addColorStop(0, "rgba(255,255,255,0.95)"); gw2.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gw2; c.beginPath(); c.moveTo(-10, -wd * 0.35); c.lineTo(len * 0.7, 0); c.lineTo(-10, wd * 0.35); c.closePath(); c.fill();
      if (e.fries) for (const fr of e.fries) {
        const d = fr.sp * e.t, fx_ = Math.cos(fr.da) * d, fy_ = Math.sin(fr.da) * d;
        c.save(); c.translate(fx_, fy_); c.rotate(fr.rot + fr.vr * e.t); c.globalAlpha = Math.min(1, a * 1.4);
        c.fillStyle = "#f2c14e"; c.strokeStyle = "rgba(14,16,34,0.8)"; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect(-fr.len / 2, -2.5, fr.len, 5, 1.5); c.fill(); c.stroke();
        c.restore();
      }
      c.restore();
    }
  }
}
// "3 HIT · 14%" pop-up above the fighter taking the combo
function drawCombos(c, g) {
  for (let i = 0; i < 2; i++) {
    const cb = combos[i], f = g.fighters[i];
    if (!cb || !f) continue;
    const alive = f.state !== "dead" && f.state !== "gone";
    if (alive) cb.at = toScreen(f.x, f.y - f.s.h);
    if (!cb.at) continue;
    const x = clamp(cb.at[0], 50, L.gw - 50), y = clamp(cb.at[1] - 58, 70, L.gh - 40);
    const a = cb.t < 60 ? 1 : 1 - (cb.t - 60) / 20, sc = 1 + cb.pop * 0.5;
    c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(sc, sc);
    c.textAlign = "center"; c.lineJoin = "round";
    c.font = 'italic 900 24px "Barlow Condensed", "Arial Narrow", sans-serif';
    c.lineWidth = 5; c.strokeStyle = "rgba(14,16,34,0.85)"; c.strokeText(`${cb.n} HIT`, 0, 0);
    c.fillStyle = cb.col; c.fillText(`${cb.n} HIT`, 0, 0);
    c.font = '800 14px "Barlow Condensed", "Arial Narrow", sans-serif';
    const sub = cb.fin ? `${cb.dmg}% · LAUNCH` : `${cb.dmg}%`;
    c.lineWidth = 4; c.strokeText(sub, 0, 16); c.fillStyle = "#f3efe6"; c.fillText(sub, 0, 16);
    c.restore();
  }
}
function drawBubbles(c, g, tk, img) {
  for (const f of g.fighters) {
    if (f.state === "dead" || f.state === "gone") continue;
    const [sx, sy] = toScreen(f.x, f.y - f.s.h * 0.5);
    const m = 6;
    if (sx > m && sx < L.gw - m && sy > m && sy < L.gh - m) continue;
    const R = 28, bx = clamp(sx, R + 10, L.gw - R - 10), by = clamp(sy, R + 64, L.gh - R - 10);
    const ang = Math.atan2(sy - by, sx - bx);
    c.save();
    c.fillStyle = col(f.pal);
    c.beginPath(); c.moveTo(bx + Math.cos(ang) * (R + 12), by + Math.sin(ang) * (R + 12));
    c.lineTo(bx + Math.cos(ang + 0.45) * R, by + Math.sin(ang + 0.45) * R); c.lineTo(bx + Math.cos(ang - 0.45) * R, by + Math.sin(ang - 0.45) * R); c.fill();
    c.beginPath(); c.arc(bx, by, R, 0, Math.PI * 2); c.fillStyle = "rgba(14,16,34,0.88)"; c.fill(); c.lineWidth = 3; c.strokeStyle = col(f.pal); c.stroke();
    c.save(); c.beginPath(); c.arc(bx, by, R - 2, 0, Math.PI * 2); c.clip();
    if (img && img[f.slot]) c.drawImage(img[f.slot], bx - R, by - R, R * 2, R * 2);
    else { const sc = (R * 1.5) / f.s.h; c.translate(bx, by + R * 0.62); c.scale(sc, sc); drawFighter(c, f, tk, [0, 0]); }
    c.restore();
    c.font = '800 14px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center"; c.fillStyle = pctColor(f.percent);
    c.fillText(Math.floor(f.percent) + "%", bx, by + R + 15);
    c.restore();
  }
}

/*SKINFX*/

/*GFX3D*/

function render(g, tk) {
  if (use3D()) { render3D(g, tk); return; }
  r3Layers(false);
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.save(); c.beginPath(); c.rect(0, 0, L.gw, L.gh); c.clip();
  drawBackground(c, tk);
  const ox = L.gw / 2 - cam.x * cam.z + cam.sx, oy = L.gh / 2 - cam.y * cam.z + cam.sy;
  c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * ox, DPR * oy);
  drawStage(c, tk);
  for (const f of g.fighters) drawShadow(c, f);
  drawTrails(c, g);
  for (const f of g.fighters) drawRespawnPlat(c, f, tk);
  for (const f of g.fighters) f._ravenOut = g.projs.some((p) => p.owner === f.slot && p.style === "raven");
  for (const p of g.projs) drawProj(c, p, tk);
  const order = [...g.fighters].sort((a, b) => (a.slot === 0 ? 1 : 0) - (b.slot === 0 ? 1 : 0));
  for (const f of order) if (f.state !== "dead" && f.state !== "gone") drawFighter(c, f, tk);
  drawFx(c);
  if (mode === "match") {
    const [a, b] = g.fighters;
    const close = Math.abs(a.x - b.x) * cam.z < 44 && Math.abs((a.y - a.s.h) - (b.y - b.s.h)) * cam.z < 22;
    drawTag(c, a, meSlot === 0, meSlot === 1 && close ? 20 : 0); drawTag(c, b, meSlot === 1, meSlot === 0 && close ? 20 : 0);
  }
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawScreenFx(c);
  if (mode === "match") drawCombos(c, g);
  drawBubbles(c, g, tk);
  c.restore();
}

/* ===================== events from the simulation ===================== */
function handleEvent(g, e, live) {
  skinEvent(g, e);
  switch (e.type) {
    case "hit":
      spark(e.x, e.y, e.fire ? "#ff8a3d" : col(e.pal), e.kb, e.dirx, e.diry);
      if (e.combo >= 2 && e.def !== undefined) combos[e.def] = { n: e.combo, dmg: Math.round(e.comboDmg), t: 0, col: col(e.pal), fin: !!e.finisher, pop: 1, at: combos[e.def] && combos[e.def].at };
      if (e.finisher) cam.shake = Math.max(cam.shake, 7);
      if (e.fire) for (let i = 0; i < 10; i++) ember(e.x, e.y, (Math.random() - 0.5) * 6, -Math.random() * 4);
      if (e.kb > 12) cam.shake = Math.max(cam.shake, Math.min(16, e.kb * 0.45));
      if (live) e.armor ? Sfx.armor() : Sfx.hit(e.kb);
      break;
    case "ko":
      sfx.push({ k: "beam", wx: e.x, wy: e.y, t: 0, life: 50, col: col(e.pal),
        fries: Array.from({ length: 8 }, () => ({ da: (Math.random() - 0.5) * 1.1, sp: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, len: 12 + Math.random() * 8 })) });
      sfx.push({ k: "flash", t: 0, life: 10 });
      cam.shake = 20; trails[e.slot].length = 0;
      if (live) Sfx.ko();
      break;
    case "jump": if (e.ground) dust(e.x, e.y, 5, 18); else addFx({ k: "ring", x: e.x, y: e.y - 4, t: 0, life: 12, r0: 6, r1: 26, col: "#d9d4ea" }); if (live) Sfx.jump(); break;
    case "land": dust(e.x, e.y, 3, 22); break;
    case "bounce": dust(e.x, e.y, 6, 30); break;
    case "pound": addFx({ k: "shock", x: e.x, y: e.y, t: 0, life: 18 }); dust(e.x, e.y, 8, 50); cam.shake = Math.max(cam.shake, 6); break;
    case "swing": if (live) Sfx.swing(e.heavy); break;
    case "proj":
      if (e.style === "orb" || e.style === "bolt") { if (live) Sfx.bolt(e.style === "orb"); }
      else if (e.style === "raven") { if (live) Sfx.caw(); }
      else if (e.style === "fire") { for (let i = 0; i < 6; i++) ember(e.x, e.y, (Math.random() - 0.5) * 3, -Math.random() * 2); if (live) Sfx.fire(); }
      else if (e.style === "fry") { if (live) Sfx.fry(); }
      else if (live) Sfx.swing(true);
      break;
    case "burst":
      addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 16, r0: 8, r1: e.r * 1.2, col: "#7dff62" });
      for (let i = 0; i < 12; i++) addFx({ k: "line", x: e.x, y: e.y, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 7, t: 0, life: 12 + Math.random() * 8, col: i % 2 ? "#d9ffcf" : "#55e05a", w: 2.5 });
      cam.shake = Math.max(cam.shake, 5);
      if (live) Sfx.burst();
      break;
    case "projEnd":
      if (e.style === "fire") { addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 6, r1: 34, col: "#ff8a3d" }); for (let i = 0; i < 10; i++) ember(e.x, e.y, (Math.random() - 0.5) * 6, -Math.random() * 4); }
      else dust(e.x, e.y, 2, 10);
      break;
    case "go": if (live) { showBanner("Go!", "", "go", 650); Sfx.count(true); } break;
    case "tech": dust(e.x, e.y, 6, 30); addFx({ k: "ring", x: e.x, y: e.y - 4, t: 0, life: 12, r0: 8, r1: 30, col: "#d9d4ea" }); if (live) Sfx.jump(); break;
    case "sudden":
      combos[0] = combos[1] = null; trails[0].length = trails[1].length = 0;
      if (live) { showBanner("Sudden death", "Next KO wins", "game", 1700); Sfx.count(true); }
      camStep(g, true);
      break;
    case "game": if (live) { showBanner(g.endReason === "time" ? "Time!" : "Game!", "", "game", 0); } break;
    case "over": if (live) { if (match && match.online) finishOnline(false); else finishMatch(false); } else newAttract(); break;
  }
}

/* ===================== screens & flow ===================== */
let mode = "menu", paused = false, G = null, match = null, attract = null, tick = 0, lastCount = 0, meSlot = 0;
const screens = { menu: $("scrMenu"), select: $("scrSelect"), result: $("scrResult"), pause: $("scrPause"), help: $("scrHelp"), settings: $("scrSettings"), online: $("scrOnline") };
function show(name) { for (const k of ["menu", "select", "result", "online"]) screens[k].hidden = k !== name; }
function modal(name, on) { screens[name].hidden = !on; }

const bannerEl = $("banner"), bMain = bannerEl.querySelector(".b-main"), bSub = bannerEl.querySelector(".b-sub");
let bannerT = 0;
function showBanner(main, sub, cls, ms) {
  bannerEl.className = cls || ""; bMain.textContent = main; bSub.textContent = sub || ""; bannerEl.hidden = false;
  void bannerEl.offsetWidth; bannerEl.classList.add("show");
  clearTimeout(bannerT); if (ms) bannerT = setTimeout(() => { bannerEl.hidden = true; }, ms);
}
function hideBanner() { clearTimeout(bannerT); bannerEl.hidden = true; }

function newAttract() {
  const pick = () => FIGHTERS[(Math.random() * FIGHTERS.length) | 0];
  const a = pick(), b = pick();
  const g = newGame({ players: [{ spec: a, pal: a.palettes[(Math.random() * 4) | 0] }, { spec: b, pal: b.palettes[a === b ? 1 : 0] }], countdown: 30, stocks: 2 });
  attract = { g, b0: makeBot(0.75), b1: makeBot(0.75) };
  trails[0].length = trails[1].length = 0;
}

function renderMenu() {
  const ti = tierInfo(P.rating);
  const rank = $("mRank"); rank.style.setProperty("--tc", ti.t.col);
  paintBadge($("mBadge"), ti.i);
  $("mTier").textContent = ti.t.name;
  $("mSub").textContent = ti.next ? `${P.rating} rating · ${ti.need} to ${ti.next.name}` : `${P.rating} rating · top tier`;
  $("mBar").style.setProperty("--p", ti.p);
  $("mTokens").innerHTML = `<span class="tokglyph"></span>${P.tokens}`;
  $("mRec").textContent = `${P.wins}W · ${P.losses}L${P.streak > 1 ? ` · ${P.streak} streak` : ""}`;
  const onOk = onlineAvailable();
  $("bOnline").disabled = !onOk;
  $("mOnline").textContent = onOk ? "online" : "needs the game's web link";
}
// a downloaded copy of the page has no way to reach other players
function onlineAvailable() {
  const c = window.claude && typeof window.claude.use === "function";
  return !!c && !(window.__blStandalone && !/^https?:$/.test(location.protocol));
}
function goMenu() {
  if (NET.mr) leaveMatchRoom();
  if (NET.phase !== "idle") { resetNet(); NET.phase = "idle"; lobbyPresence(); }
  tutEnd();
  mode = "menu"; paused = false; G = null; match = null; meSlot = 0;
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  modal("pause", false); modal("help", false); modal("settings", false);
  renderMenu(); show("menu"); resize();
  trails[0].length = trails[1].length = 0; fx.length = 0; sfx.length = 0;
  if (!attract) newAttract();
}

/* ----- fighter select: one row of fighter tiles, one detail panel for the picked fighter ----- */
const LEVELS = [{ name: "Dummy", d: -1 }, { name: "Easy", d: 0.15 }, { name: "Normal", d: 0.5 }, { name: "Hard", d: 0.9 }];
const sel = { mode: "ranked", fighter: P.last, opp: "random", level: 2, pending: null };
const cardArt = [];
function statBars(spec) {
  const s = spec.stats, mv = spec.moves;
  const heavy = [mv.hSide, mv.hUp, mv.hDown].reduce((a, m) => a + m.dmg, 0) / 3;
  const airH = (s.jump * s.jump + s.airJumps * s.airJump * s.airJump) / (2 * s.gravity);
  const q = (v, a, b) => clamp(Math.round(1 + ((v - a) / (b - a)) * 4), 1, 5);
  return [["Power", q(heavy, 11, 18)], ["Speed", q(s.run, 4.6, 7.4)], ["Weight", q(s.weight, 82, 120)], ["Air", q(airH, 260, 560)]];
}
function selPalIdx(spec) { return sel.pending && sel.pending.id === spec.id ? sel.pending.i : P.pal[spec.id] || 0; }
function buildTiles() {
  const wrap = $("tiles"); wrap.innerHTML = "";
  for (const spec of FIGHTERS) {
    const b = document.createElement("button");
    const on = sel.fighter === spec.id;
    b.className = "tile" + (on ? " on" : "");
    b.style.setProperty("--fc", col(spec.palettes[P.pal[spec.id] || 0]));
    b.setAttribute("aria-pressed", String(on));
    b.innerHTML = `${PORTRAITS[spec.id] ? `<img src="${PORTRAITS[spec.id]}" alt="">` : ""}<span>${spec.name}</span>`;
    b.addEventListener("click", () => {
      Sfx.init(); Sfx.ui();
      if (sel.fighter === spec.id) return;
      sel.fighter = spec.id; sel.pending = null; P.last = spec.id; saveProfile();
      buildTiles(); buildDetail();
    });
    wrap.appendChild(b);
  }
}
function buildDetail() {
  const spec = FIG[sel.fighter], pi = selPalIdx(spec), pal = spec.palettes[pi] || spec.palettes[0];
  const d = $("detail");
  d.style.setProperty("--fc", col(pal));
  d.style.setProperty("--fcglow", rgba(col(pal), 0.34));
  $("dName").textContent = spec.name;
  $("dRole").textContent = spec.role;
  $("dBlurb").textContent = spec.blurb;
  $("dStats").innerHTML = statBars(spec).map(([n, v]) => `<span>${n}</span><span class="seg" aria-label="${n} ${v} of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? "on" : ""}"></i>`).join("")}</span>`).join("");
  $("dSig").innerHTML = `<b>${spec.signature.name}</b><span>${spec.signature.text}</span>`;
  const pals = $("dPals"); pals.innerHTML = "";
  spec.palettes.forEach((p, i) => {
    const own = P.owned[spec.id].includes(i), cur = (P.pal[spec.id] || 0) === i, pend = !!sel.pending && sel.pending.id === spec.id && sel.pending.i === i;
    const b = document.createElement("button");
    b.className = `sw${cur ? " cur" : ""}${own ? "" : " lock"}${pend ? " pending" : ""}`;
    b.style.setProperty("--c", col(p));
    b.setAttribute("aria-label", `${p.name}${own ? "" : `, locked, ${p.price} chips`}`);
    b.innerHTML = `<i>${i ? `<em>${"✦".repeat(i)}</em>` : ""}</i>${own ? p.name : `<span><span class="tokglyph"></span>${p.price}</span>`}`;
    b.addEventListener("click", () => {
      Sfx.init(); Sfx.ui();
      if (own) { P.pal[spec.id] = i; sel.pending = null; saveProfile(); }
      else sel.pending = { id: spec.id, i }; // locked: preview it on the model; the Upgrade button buys it
      buildTiles(); buildDetail();
    });
    pals.appendChild(b);
  });
  $("dNote").textContent = skinNote(spec, pi);
  // the big model shows the skin being looked at, locked or not
  const f = BL.newGame({ players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
  f.x = 0; f.y = 0; f.facing = 1;
  cardArt.length = 0;
  cardArt.push({ cv: $("dArt"), f, fit: 0.74, bottom: 0.93 });
  $("selTokens").textContent = P.tokens;
  updateUpgrade();
}
function buildCards() { buildTiles(); buildDetail(); }
function skinNote(spec, i) {
  const p = spec.palettes[i], fx = FXTEXT[spec.id] && FXTEXT[spec.id][i];
  return `${p.name}: ${fx || "base look"}.`;
}
function updateUpgrade() {
  const btn = $("selUp"), pd = sel.pending;
  btn.hidden = !pd;
  if (!pd) return;
  const spec = FIG[pd.id], p = spec.palettes[pd.i], short = p.price - P.tokens;
  btn.disabled = short > 0;
  btn.querySelector("span").textContent = "Upgrade";
  if (short > 0) $("dNote").textContent = `${skinNote(spec, pd.i)} ${short} more chips needed.`;
  btn.setAttribute("aria-label", short > 0 ? `${p.name} costs ${p.price} chips, you need ${short} more` : `Upgrade ${spec.name} to ${p.name} for ${p.price} chips`);
}
function buyPending() {
  const pd = sel.pending;
  if (!pd) return;
  const spec = FIG[pd.id], p = spec.palettes[pd.i];
  if (P.tokens < p.price || P.owned[spec.id].includes(pd.i)) { updateUpgrade(); return; }
  P.tokens -= p.price; P.owned[spec.id].push(pd.i); P.pal[spec.id] = pd.i; sel.pending = null; saveProfile();
  Sfx.ui();
  buildTiles(); buildDetail();
  $("dNote").textContent = `Upgraded to ${p.name}. ${FXTEXT[spec.id][pd.i] || ""}`.trim();
}
// a tall, narrow stage (desktop) shows the model smaller so wings and tails stay in view
function artFit(a) { const w = a.cv.clientWidth, h = a.cv.clientHeight || 1; return Math.min(a.fit || 0.7, Math.max(0.42, (a.fit || 0.7) * 1.1 * w / h)); }
function drawCards(tk) {
  if (R3.on) return;
  for (const a of cardArt) {
    const r = { width: a.cv.clientWidth, height: a.cv.clientHeight };
    if (!r.width) continue;
    const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR);
    if (a.cv.width !== w || a.cv.height !== h) { a.cv.width = w; a.cv.height = h; }
    const c = a.cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    const sc = (h * artFit(a)) / a.f.s.h;
    c.setTransform(sc, 0, 0, sc, w * 0.5, h * (a.bottom || 0.95));
    drawFighter(c, a.f, tk);
  }
}
/* practice: opponent and CPU level are small pickers in the header */
function closePops() { $("oppPop").hidden = true; $("lvlPop").hidden = true; }
function buildPractice() {
  $("oppPick").innerHTML = `<small>vs</small>${sel.opp === "random" ? "Random" : FIG[sel.opp].name}`;
  $("lvlPick").innerHTML = `<small>CPU</small>${LEVELS[sel.level].name}`;
  const fill = (pop, items, isOn, pick) => {
    pop.innerHTML = "";
    items.forEach((it) => {
      const b = document.createElement("button");
      b.textContent = it.label; if (isOn(it)) b.className = "on";
      b.addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); Sfx.ui(); pick(it); closePops(); buildPractice(); });
      pop.appendChild(b);
    });
  };
  fill($("oppPop"), [{ id: "random", label: "Random" }, ...FIGHTERS.map((f) => ({ id: f.id, label: f.name }))], (it) => it.id === sel.opp, (it) => { sel.opp = it.id; });
  fill($("lvlPop"), LEVELS.map((l, i) => ({ i, label: l.name })), (it) => it.i === sel.level, (it) => { sel.level = it.i; });
}
for (const [btn, pop] of [["oppPick", "oppPop"], ["lvlPick", "lvlPop"]]) {
  $(btn).addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); Sfx.ui(); const open = $(pop).hidden; closePops(); $(pop).hidden = !open; });
}
app.addEventListener("click", (e) => { if (!e.target.closest(".pickwrap")) closePops(); });
function openSelect(m) {
  sel.mode = m; sel.pending = null;
  mode = "select";
  const ti = tierInfo(P.rating);
  $("selMode").textContent = m === "ranked" ? `Ranked match · ${ti.t.name} ${P.rating}` : m === "online" ? "Play friends" : "Practice · no rating, no chips";
  $("pracOpts").hidden = m !== "practice"; closePops();
  $("selGo").querySelector("span").textContent = m === "online" ? "Done" : "Fight";
  buildCards(); if (m === "practice") buildPractice();
  show("select"); $("hud").hidden = true; $("ctl").hidden = true; resize();
}

/* ----- match ----- */
function startMatch() {
  Sfx.init();
  const ranked = sel.mode === "ranked";
  const me = FIG[sel.fighter], myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  let opp, d, oppRating = 0;
  if (ranked) {
    opp = FIGHTERS[(Math.random() * FIGHTERS.length) | 0];
    oppRating = clamp(Math.round(P.rating + (Math.random() - 0.5) * 140), 600, 2100);
    d = clamp((oppRating - 750) / 1000, 0.08, 0.98);
  } else {
    opp = sel.opp === "random" ? FIGHTERS[(Math.random() * FIGHTERS.length) | 0] : FIG[sel.opp];
    d = LEVELS[sel.level].d;
  }
  let oppPal = opp.palettes[0];
  if (opp.id === me.id) oppPal = opp.palettes[(P.pal[me.id] + 1) % opp.palettes.length];
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: oppPal }], stocks: 3, time: 240, countdown: 150 });
  match = { ranked, d, oppRating, bot: makeBot(d), level: ranked ? null : LEVELS[sel.level].name };
  meSlot = 0;
  enterMatchUI();
}
function enterMatchUI() {
  mode = "match"; paused = false; lastCount = 0;
  show(null); hideOnline(); modal("pause", false); modal("help", false); modal("settings", false);
  $("hud").hidden = false; $("ctl").hidden = !touchUI; $("netBadge").hidden = true; $("pingBadge").hidden = true; $("pingBadge").textContent = "";
  [0, 1].forEach((i) => {
    const f = G.fighters[i], el = $("pc" + i);
    el.style.setProperty("--fc", col(f.pal));
    el.querySelector(".pc-name").textContent = f.spec.name;
    el.querySelector(".pc-tag").textContent = i === meSlot ? "You" : match.online ? NET.oppName || "Friend" : match.tutorial ? "Dummy" : "CPU";
    hudCache[i] = { pct: -1, stocks: -1, out: null };
  });
  document.querySelector('.pb[data-k="special"]').style.setProperty("--fc", col(G.fighters[meSlot].pal));
  fx.length = 0; sfx.length = 0; trails[0].length = trails[1].length = 0; combos[0] = combos[1] = null;
  if (!match.tutorial) tutEnd(); else { $("tut").hidden = false; app.classList.add("tut"); }
  releaseTouch(); resize(); camStep(G, true);
}
const hudCache = [{}, {}];
function vsLine() {
  const me = G.fighters[meSlot].spec.name, op = G.fighters[1 - meSlot].spec.name;
  if (match.online) return `${me} vs ${op} · ${NET.oppName || "Friend"}, online`;
  if (match.ranked) { const ti = tierInfo(match.oppRating); return `${me} vs ${op} · CPU ${ti.t.name} ${match.oppRating}`; }
  return `${me} vs ${op} · ${match.level}`;
}
function updateHud() {
  for (let i = 0; i < 2; i++) {
    const f = G.fighters[i], el = $("pc" + i), hc = hudCache[i];
    const pct = Math.floor(f.percent);
    const num = el.querySelector(".num"), wrap = el.querySelector(".pc-pct");
    if (hc.pct !== pct) { num.textContent = pct; wrap.style.color = pctColor(pct); hc.pct = pct; }
    const fl = f.flash;
    wrap.style.transform = fl > 0 ? `scale(${1 + fl * 0.035}) translateX(${(Math.random() - 0.5) * fl * 0.8}px)` : "";
    if (hc.stocks !== f.stocks) { el.querySelector(".pc-stocks").innerHTML = "<i></i>".repeat(Math.max(0, f.stocks)); hc.stocks = f.stocks; }
    const out = f.state === "dead" || f.state === "gone";
    if (hc.out !== out) { el.classList.toggle("out", out); hc.out = out; }
  }
  const secs = Math.max(0, Math.ceil(G.timer / 60));
  const clock = $("clock");
  const txt = !G.timed ? "∞" : `${G.sudden ? "SD " : ""}${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (clock.textContent !== txt) { clock.textContent = txt; clock.classList.toggle("warn", G.timed && (secs <= 30 || G.sudden)); }
  const pb = $("pingBadge"), ms = match && match.online ? NET.rttLive || NET.rtt || 0 : 0;
  const ptxt = ms ? `${Math.round(ms)} ms` : "";
  if (pb.textContent !== ptxt) { pb.textContent = ptxt; pb.hidden = !ptxt; pb.className = ms < 90 ? "good" : ms < 170 ? "ok" : "bad"; }
  const me = G.fighters[meSlot], cd = me.spec.moves.spec.cooldown || 1;
  document.querySelector('.pb[data-k="special"]').style.setProperty("--cd", (me.specCd / cd).toFixed(3));
}
function togglePause(force) {
  if (mode !== "match" || (G && G.phase === "over")) return;
  const open = force !== undefined ? force : screens.pause.hidden;
  paused = match && match.online ? false : open;
  modal("pause", open); modal("help", false);
  quitArmed = false;
  $("pResume").querySelector("span").textContent = match && match.online ? "Back to match" : "Resume";
  $("pQuit").querySelector("span").textContent = match && match.online ? "Leave match" : match && match.ranked ? "Forfeit" : "Quit to menu";
  $("pNote").textContent = match && match.online ? "Online matches keep running while this is open." : match && match.ranked ? "Forfeiting counts as a loss." : "";
  releaseTouch();
}
let quitArmed = false;
function finishMatch(forfeit) {
  if (mode !== "match") return;
  if (match && match.tutorial) { tutDone(); return; }
  const me = G.fighters[0], op = G.fighters[1];
  const res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5;
  const R = { res, forfeit, ranked: match.ranked, me, op, lines: [], total: 0 };
  if (match.ranked) {
    const before = P.rating, K = P.matches < 10 ? 48 : 32;
    const E = 1 / (1 + Math.pow(10, (match.oppRating - P.rating) / 400));
    const delta = Math.round(K * (res - E));
    P.rating = Math.max(0, P.rating + delta); P.peak = Math.max(P.peak, P.rating); P.matches++;
    if (res === 1) { P.wins++; P.streak = Math.max(0, P.streak) + 1; }
    else if (res === 0) { P.losses++; P.streak = 0; }
    else P.draws++;
    if (!forfeit) {
      if (res === 1) {
        R.lines.push(["Win", 20]);
        if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 5]);
        const sb = Math.min(20, (P.streak - 1) * 5); if (sb > 0) R.lines.push([`${P.streak} win streak`, sb]);
      } else if (res === 0.5) { R.lines.push(["Draw", 10]); if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 3]); }
      else { R.lines.push(["Match played", 6]); if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 2]); }
    }
    R.total = R.lines.reduce((a, l) => a + l[1], 0);
    P.tokens += R.total;
    P.history.unshift({ r: res, d: delta, me: me.spec.id, op: op.spec.id, opr: match.oppRating, t: Date.now() });
    P.history = P.history.slice(0, 20);
    Object.assign(R, { before, after: P.rating, delta, tb: tierIdx(before), ta: tierIdx(P.rating) });
    saveProfile();
  }
  showResults(R);
}
function showResults(R) {
  mode = "result"; paused = false;
  modal("pause", false); modal("help", false); hideBanner();
  $("ctl").hidden = true; $("hud").hidden = true; releaseTouch();
  const sheet = $("resSheet");
  sheet.classList.remove("solo");
  sheet.classList.toggle("win", R.res === 1); sheet.classList.toggle("loss", R.res === 0);
  $("rMode").textContent = R.online ? (R.set ? `Friendly match · best of 3 · game ${R.set.n}` : "Friendly match · online") : R.ranked ? "Ranked match" : `Practice · ${match.level}`;
  $("rTitle").textContent = R.lost ? "Disconnected" : R.left ? "Opponent left" : R.forfeit ? "Forfeit" : R.res === 1 ? "Victory" : R.res === 0 ? "Defeat" : "Draw";
  const mn = R.me.spec.name, on = R.op.spec.name;
  const who = R.online ? NET.oppName || "Your friend" : on;
  const how = G.sudden && G.endReason === "stocks" ? " in sudden death" : G.endReason === "time" ? " on time" : "";
  $("rSub").textContent = R.lost ? `The connection to ${who} dropped.` : R.left ? `${who} left the match.` :
    R.online && R.res === 1 ? `You beat ${who}${how || ` with ${R.me.stocks} ${R.me.stocks === 1 ? "life" : "lives"} left`}.` :
    R.online && R.res === 0 ? `${who} beat you${how}.` :
    R.forfeit ? "You left the match. It counts as a loss." :
    R.res === 1 ? `${mn} beat ${on}${how || ` with ${R.me.stocks} ${R.me.stocks === 1 ? "life" : "lives"} left`}.` :
    R.res === 0 ? `${on} beat ${mn}${how}.` : "Nobody scored a KO in sudden death either.";
  if (R.set) {
    const hi = Math.max(R.set.mine, R.set.theirs), lo = Math.min(R.set.mine, R.set.theirs);
    $("rSub").textContent += !R.set.over ? ` Set ${R.set.mine}–${R.set.theirs}.` : R.set.mine > R.set.theirs ? ` You win the set ${hi}–${lo}.` : R.set.mine < R.set.theirs ? ` ${who} wins the set ${hi}–${lo}.` : ` The set ends ${hi}–${lo}.`;
  }
  const pick = $("rPick");
  pick.hidden = !(R.set && !R.set.over && R.res !== 1 && !R.left && !R.lost);
  if (!pick.hidden) buildNextPick();
  $("rRank").hidden = !R.ranked;
  if (R.ranked) {
    const ti = tierInfo(R.after);
    $("rRank").style.setProperty("--tc", ti.t.col);
    paintBadge($("rBadge"), ti.i);
    $("rTier").textContent = ti.t.name;
    $("rRating").textContent = `${R.before} → ${R.after}${ti.next ? ` · ${ti.need} to ${ti.next.name}` : ""}`;
    const bar = $("rBar"); bar.style.setProperty("--p", tierInfo(R.before).i === ti.i ? tierInfo(R.before).p : 0);
    requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty("--p", ti.p)));
    const d = $("rDelta"); d.textContent = (R.delta >= 0 ? "+" : "") + R.delta; d.className = "delta " + (R.delta >= 0 ? "up" : "down");
    $("rPromo").textContent = R.ta > R.tb ? `Promoted to ${TIERS[R.ta].name}` : R.ta < R.tb ? `Dropped to ${TIERS[R.ta].name}` : "";
  }
  const k = R.me.kos, fl = R.me.falls;
  $("rStats").innerHTML = `<b>${k}</b> KO${k === 1 ? "" : "s"} · <b>${Math.round(R.me.dmgDealt)}%</b> damage dealt · <b>${fl}</b> fall${fl === 1 ? "" : "s"}`;
  const why = R.lines.length > 1 ? R.lines.map(([n, v]) => `${n} +${v}`).join(" · ") : R.lines.length ? R.lines[0][0] : "";
  $("rChips").innerHTML = R.ranked || (R.online && R.lines.length)
    ? `<b><span class="tokglyph"></span>+${R.total} chips</b>${why}`
    : R.online ? "No chips for an unfinished match. Friendly matches don't change your rating."
    : "Practice doesn't change your rating or earn chips.";
  $("rAgain").querySelector("span").textContent = R.ranked ? "Next match" : R.set && !R.set.over ? "Next game" : "Rematch";
  $("rAgain").disabled = !!(R.online && (R.left || R.lost));
  $("rChange").querySelector("span").textContent = R.online ? "Lobby" : "Fighters";
  show("result");
}

// In a best-of-3, whoever lost a game may switch fighter before the next one.
function buildNextPick() {
  const row = $("rPickChips"); row.innerHTML = "";
  if (!FIG[NET.nextF]) NET.nextF = G.fighters[meSlot].spec.id;
  for (const spec of FIGHTERS) {
    const b = document.createElement("button");
    b.className = "chip" + (NET.nextF === spec.id ? " on" : ""); b.textContent = spec.name;
    b.disabled = NET.rm === NET.matchId + 1;
    b.addEventListener("click", () => { Sfx.init(); Sfx.ui(); NET.nextF = spec.id; buildNextPick(); });
    row.appendChild(b);
  }
}

/* ===================== online play =====================
   Built on the page's `room` capability: everyone with this page open shares a lobby;
   each match is a named room. Both phones run the same deterministic simulation in
   lockstep and exchange only inputs, carried in each player's presence object
   (presence is coalesced, so it always carries a short history of recent frames).
   A small input delay, sized from the measured ping, hides the network round trip.
   Checksums every second catch any divergence; the host then sends a full snapshot. */
/* Bumped whenever a change could make two copies of the game simulate differently,
   so a friend with an older copy open is told to reload instead of joining and drifting apart. */
const PROTO = 2;
const NET = {
  room: null, user: null, tried: false, ok: false, connected: false, dead: null,
  myPeer: null, myName: "", oppName: "", lobbyPeers: [], note: "",
  mr: null, mrCode: null, unsubs: [], myPres: {}, role: null, hostCode: null,
  phase: "idle", oppPeer: null, oppBy: null, lastOpp: null, joinT: 0,
  matchId: 0, startSeen: 0, pingSent: new Map(), pingSeen: new Set(), pings: [], pingT: 0, hsT: 0, lastStart: null,
  D: 6, frame: 0, myLog: [], opLog: [], oppFrame: 0, stall: 0, ckMine: new Map(), ckSend: null,
  syncN: 0, syncSent: null, lastSync: 0, desyncs: 0, rm: 0, oppLeft: false,
  standalone: !!window.__blStandalone, invite: null, inviteT: 0,
};
{
  const jm = /^#join-([a-z0-9][a-z0-9_.-]{2,47})$/.exec(location.hash || "");
  if (jm) { NET.invite = jm[1]; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* sandboxed */ } }
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64I = Object.fromEntries([...B64].map((ch, i) => [ch, i]));
const NEUTRAL = 1280;
function encIn(i) {
  const qx = clamp(Math.round(i.x * 4), -4, 4), qy = clamp(Math.round(i.y * 4), -4, 4);
  return ((qx + 4) * 9 + (qy + 4)) * 32 + (i.jump ? 1 : 0) + (i.light ? 2 : 0) + (i.heavy ? 4 : 0) + (i.special ? 8 : 0) + (i.dodge ? 16 : 0);
}
function decIn(v) {
  const b = v & 31, q = v >> 5;
  return { x: (Math.floor(q / 9) - 4) / 4, y: ((q % 9) - 4) / 4, jump: !!(b & 1), light: !!(b & 2), heavy: !!(b & 4), special: !!(b & 8), dodge: !!(b & 16) };
}
const packIn = (v) => B64[v >> 6] + B64[v & 63];
function palIdx(id) { const i = P.pal[id] || 0; return P.owned[id] && P.owned[id].includes(i) ? i : 0; }

async function netInit() {
  if (NET.tried) return;
  NET.tried = true;
  try {
    const c = window.claude && typeof window.claude.use === "function" ? window.claude : null;
    if (c) [NET.room, NET.user] = await Promise.all([c.use("room"), c.use("user")]);
  } catch (e) { NET.room = null; }
  NET.ok = !!NET.room;
  if (!NET.ok) { renderOnline(); return; }
  NET.room.onConnection((on) => { NET.connected = on; renderOnline(); }, (err) => { NET.ok = false; NET.dead = err.code; renderOnline(); });
  NET.room.onPeers((ch) => {
    NET.lobbyPeers = ch.peers;
    const me = ch.peers.find((p) => p.sameTab);
    if (me) NET.myPeer = me.peer;
    renderOnline();
  });
  if (NET.user) { try { NET.myName = (await NET.user.me()).name || ""; } catch (e) { /* no name */ } }
  lobbyPresence();
  renderOnline();
}
function lobbyPresence() {
  if (!NET.room || !NET.ok) return;
  const busy = NET.phase === "match" || NET.phase === "handshake" || NET.phase === "result";
  const hosting = NET.phase === "hosting";
  NET.room.presence({ v: PROTO, f: sel.fighter, host: hosting ? NET.hostCode : null, r: hosting ? P.rules : null, busy }).catch(() => {});
}
function buildRules() {
  const edit = NET.phase === "idle" || NET.phase === "hosting";
  // rebuild only on change, so a tap is never lost to a re-render
  const sig = JSON.stringify(P.rules) + edit + NET.phase, box = $("onRules");
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  for (const [k, id, label] of [["l", "ruleL", (v) => String(v)], ["t", "ruleT", (v) => (v ? v + " min" : "No limit")], ["b", "ruleB", (v) => (v === 3 ? "Best of 3" : "Single")]]) {
    const row = $(id); row.innerHTML = "";
    for (const v of RULES[k]) {
      const b = document.createElement("button");
      b.className = "chip" + (P.rules[k] === v ? " on" : ""); b.textContent = label(v); b.disabled = !edit;
      b.addEventListener("click", () => {
        Sfx.init(); Sfx.ui(); P.rules = Object.assign({}, P.rules, { [k]: v }); saveProfile(); buildRules();
        if (NET.phase === "hosting") { namedPresence({ r: P.rules }); lobbyPresence(); }
      });
      row.appendChild(b);
    }
  }
}
function namedPresence(patch) {
  if (!NET.mr) return;
  for (const k in patch) { if (patch[k] === null) delete NET.myPres[k]; else NET.myPres[k] = patch[k]; }
  NET.mr.presence(patch).catch((e) => { if (e && e.code === "invalid_argument") console.warn("presence:", e.message); });
}
async function namesFor(peers) {
  const ids = [...new Set(peers.map((p) => p.by).filter(Boolean))];
  let ps = {};
  if (NET.user && ids.length) { try { ps = await NET.user.profiles(ids); } catch (e) { ps = {}; } }
  const out = {};
  for (const p of peers) out[p.peer] = (p.by && ps[p.by] && ps[p.by].name) || (p.sameTab ? NET.myName || "You" : "Friend");
  return out;
}
async function resolveOppName() {
  const peers = NET.mr ? NET.mr.peers().filter((p) => p.peer === NET.oppPeer) : [];
  if (!peers.length) return;
  const n = await namesFor(peers);
  NET.oppName = n[NET.oppPeer] || "Friend";
  if (mode === "match" && match && match.online) $("pc" + (1 - meSlot)).querySelector(".pc-tag").textContent = NET.oppName;
}

function openOnline() {
  mode = "online"; G = null; match = null; meSlot = 0;
  if (NET.invite && !NET.inviteT) NET.inviteT = performance.now();
  show("online");
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  modal("pause", false); modal("help", false);
  resize();
  netInit().then(() => { lobbyPresence(); renderOnline(); });
  renderOnline();
}
function hideOnline() { screens.online.hidden = true; }
let onSeq = 0;
async function renderOnline() {
  if (mode !== "online") return;
  const seq = ++onSeq;
  const st = $("onStatus"), hostBtn = $("onHost"), note = $("onNote"), list = $("onList");
  $("onTokens").textContent = P.tokens;
  buildRules();
  const spec = FIG[sel.fighter];
  $("onMyFighter").textContent = `${spec.name} · ${spec.role}`;
  if (NET.tried && !NET.ok) {
    st.textContent = NET.dead ? "Disconnected from online play" : "Online play isn't available here";
    st.className = "kicker on-status bad";
    hostBtn.disabled = true;
    $("onMyName").textContent = "You";
    list.innerHTML = ""; list.dataset.sig = "";
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = NET.standalone ? "Online play needs the game's web link. A downloaded copy can't reach other players." : "Online play works when this page is open in Claude and you're signed in. It doesn't work from a public link or a downloaded copy.";
    list.appendChild(li);
    $("onHere").textContent = "";
    note.textContent = ""; note.className = "on-note";
    return;
  }
  const peers = NET.lobbyPeers.filter((p) => p.kind === "viewer");
  const others = peers.filter((p) => !p.sameTab);
  st.textContent = !NET.tried ? "Connecting" : NET.connected ? `Online · ${peers.length || 1} here` : "Connecting";
  st.className = "kicker on-status" + (NET.connected ? " ok" : "");
  const names = await namesFor(peers);
  if (seq !== onSeq || mode !== "online") return;
  $("onMyName").textContent = NET.myName || "You";
  const nameIn = $("onName");
  $("onMyName").hidden = NET.standalone; nameIn.hidden = !NET.standalone;
  if (NET.standalone && document.activeElement !== nameIn) nameIn.value = NET.myName;
  // build off-DOM and swap in only when something changed, so a tap on "Join" is never lost to a re-render
  const frag = document.createDocumentFragment();
  let hosts = others.filter((p) => p.presence && typeof p.presence.host === "string" && !p.presence.busy);
  if (NET.invite) {
    const inv = hosts.find((h) => h.presence.host === NET.invite);
    if (inv) hosts = [inv, ...hosts.filter((h) => h !== inv)];
    else {
      const li = document.createElement("li"); li.className = "empty";
      li.textContent = performance.now() - NET.inviteT < 6000 ? "Looking for your friend's match…" : "That invite's match isn't open anymore. Ask your friend for a new link.";
      frag.appendChild(li);
    }
  }
  if (!hosts.length && !NET.invite) {
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = NET.phase === "hosting" ? "No other open matches." : NET.standalone ? "No open matches yet. Host one and send your friend the link." : "No open matches yet. Host one, or ask a friend to.";
    frag.appendChild(li);
  }
  for (const h of hosts) {
    const li = document.createElement("li");
    if (NET.invite && h.presence.host === NET.invite) li.className = "invited";
    const who = document.createElement("div"); who.className = "who";
    const b = document.createElement("b"); b.textContent = names[h.peer] || "Friend";
    const sp = document.createElement("span"); const hf = FIG[h.presence.f];
    const old = h.presence.v !== PROTO;
    if (old) li.classList.add("old");
    sp.textContent = old ? "Different game version. Both of you reload the page." :
      (NET.invite && h.presence.host === NET.invite ? "Invited you · " : "") + (hf ? hf.name : "Fighter") + (validRules(h.presence.r) ? ` · ${ruleText(h.presence.r)}` : "");
    who.append(b, sp);
    const btn = document.createElement("button"); btn.className = "chip";
    const joining = NET.phase === "joining" && NET.mrCode === h.presence.host;
    btn.textContent = joining ? "Joining" : "Join";
    btn.disabled = old || joining || NET.phase === "handshake" || !NET.connected;
    btn.addEventListener("click", () => { Sfx.init(); Sfx.ui(); netJoin(h.presence.host); });
    li.dataset.h = h.presence.host; li.append(who, btn); frag.appendChild(li);
  }
  const sig = [...frag.childNodes].map((li) => `${li.className}:${li.dataset.h || ""}:${li.textContent}:${li.querySelector("button") ? li.querySelector("button").disabled : ""}`).join("|");
  if (list.dataset.sig !== sig) { list.replaceChildren(frag); list.dataset.sig = sig; }
  $("onHere").textContent = others.length
    ? others.map((p) => `${names[p.peer] || "Friend"}${p.presence && p.presence.busy ? " (in a match)" : ""}`).join(", ")
    : "Just you. Friends show up here when they open this page.";
  hostBtn.disabled = !NET.connected || NET.phase === "joining" || NET.phase === "handshake";
  hostBtn.querySelector("span").textContent = NET.phase === "hosting" ? "Cancel" : "Host a match";
  note.className = "on-note" + (NET.phase !== "idle" ? " live" : "");
  note.textContent =
    NET.phase === "hosting" ? "Waiting for a challenger. Your match is listed for everyone here." :
    NET.phase === "joining" ? "Joining…" :
    NET.phase === "handshake" ? `Connecting to ${NET.oppName || "your friend"}…` :
    NET.note || (NET.standalone ? "Pick the rules, host, then send your friend the link." : "Pick the rules and host. Your friends see the match in their list.");
  const inv = $("onInvite");
  inv.hidden = !(NET.standalone && NET.phase === "hosting" && NET.hostCode);
  if (!inv.hidden) {
    $("onLink").textContent = inviteLink();
    $("onShare").hidden = !navigator.share;
  }
  $("onHelp").textContent = NET.standalone
    ? "No account needed. Matches connect while both of you have the page open."
    : "Friends need a Claude account and access to this page. Share it from the page's Share menu, then you both open it and pick Play friends. A public link won't connect.";
}
function inviteLink() { return location.origin + location.pathname + "#join-" + NET.hostCode; }
function onlineArtFighter() {
  const spec = FIG[sel.fighter], o = onlineArtFighter;
  if (!o.f || o.f.spec !== spec || o.pi !== palIdx(spec.id)) {
    o.pi = palIdx(spec.id);
    o.f = newGame({ players: [{ spec, pal: spec.palettes[o.pi] }, { spec, pal: spec.palettes[0] }], countdown: 1 }).fighters[0];
    o.f.x = 0; o.f.y = 0;
  }
  return o.f;
}
function drawOnlineArt(tk) {
  if (R3.on) return;
  const cvA = $("onArt"); if (!cvA || !cvA.clientWidth) return;
  onlineArtFighter();
  const w = Math.round(cvA.clientWidth * DPR), h = Math.round(cvA.clientHeight * DPR);
  if (cvA.width !== w || cvA.height !== h) { cvA.width = w; cvA.height = h; }
  const c = cvA.getContext("2d"); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
  const f = onlineArtFighter.f, sc = (h * 0.8) / f.s.h;
  c.setTransform(sc, 0, 0, sc, w * 0.5, h * 0.92);
  drawFighter(c, f, tk);
}

async function openMatchRoom(code) {
  const mr = await NET.room.join(code);
  NET.mr = mr; NET.mrCode = code; NET.myPres = {};
  NET.unsubs = [mr.onPeers(onMatchPeers, () => { if (NET.mr === mr) matchRoomLost(); })];
}
function leaveMatchRoom() {
  const mr = NET.mr;
  NET.unsubs.forEach((u) => { try { u(); } catch (e) { /* gone */ } });
  NET.unsubs = []; NET.mr = null; NET.mrCode = null; NET.myPres = {};
  if (mr) mr.leave().catch(() => {});
}
function resetNet() {
  Object.assign(NET, { role: null, hostCode: null, oppPeer: null, oppBy: null, oppName: "", lastOpp: null, matchId: 0, startSeen: 0,
    pings: [], pingT: 0, hsT: 0, rm: 0, lastSync: 0, syncSent: null, oppLeft: false, lastStart: null });
  NET.pingSent = new Map(); NET.pingSeen = new Set();
}
function netCancel() { leaveMatchRoom(); resetNet(); NET.phase = "idle"; lobbyPresence(); renderOnline(); }
async function netHost() {
  if (!NET.ok || NET.phase !== "idle") return;
  const code = "bl" + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, "0");
  resetNet();
  NET.phase = "hosting"; NET.role = "host"; NET.hostCode = code; NET.note = "";
  renderOnline();
  try { await openMatchRoom(code); }
  catch (e) { NET.phase = "idle"; NET.role = null; NET.hostCode = null; NET.note = "Couldn't open a match. Try again."; renderOnline(); return; }
  namedPresence({ role: "host", f: sel.fighter, pi: palIdx(sel.fighter), r: P.rules });
  lobbyPresence(); renderOnline();
}
async function netJoin(code) {
  if (typeof code !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(code)) return;
  if (NET.phase === "hosting") netCancel();
  if (NET.phase !== "idle") return;
  resetNet();
  NET.phase = "joining"; NET.role = "guest"; NET.note = ""; NET.joinT = performance.now();
  NET.mrCode = code;
  renderOnline();
  try { await openMatchRoom(code); }
  catch (e) { NET.phase = "idle"; NET.role = null; NET.mrCode = null; NET.note = "Couldn't join that match."; renderOnline(); return; }
  namedPresence({ role: "guest", f: sel.fighter, pi: palIdx(sel.fighter) });
  if (NET.invite === code) NET.invite = null;
  lobbyPresence(); renderOnline();
}
function matchRoomLost() {
  if (NET.phase === "match") { finishOnline(false, true); return; }
  leaveMatchRoom(); resetNet(); NET.phase = "idle"; NET.note = "The match connection dropped.";
  if (mode === "online") renderOnline();
}
function onMatchPeers(ch) {
  const peers = ch.peers;
  if (NET.role === "host") {
    if (NET.oppPeer && !peers.some((p) => p.peer === NET.oppPeer)) return opponentLeft();
    if (!NET.oppPeer && NET.phase === "hosting") {
      const g = peers.find((p) => !p.sameTab && p.kind === "viewer" && p.presence && p.presence.role === "guest");
      if (g) {
        NET.oppPeer = g.peer; NET.oppBy = g.by; NET.phase = "handshake"; NET.hsT = 0;
        namedPresence({ opp: g.peer }); lobbyPresence(); resolveOppName().then(renderOnline); renderOnline();
      }
    }
  } else if (NET.role === "guest") {
    const host = peers.find((p) => !p.sameTab && p.presence && p.presence.role === "host");
    if (!host) { if (NET.oppPeer) opponentLeft(); return; }
    const opp = host.presence.opp;
    if (NET.phase === "joining" && typeof opp === "string" && opp !== NET.myPeer) { NET.note = "That match just filled up."; netCancel(); return; }
    if (NET.phase === "joining" && opp === NET.myPeer) {
      NET.oppPeer = host.peer; NET.oppBy = host.by; NET.phase = "handshake";
      lobbyPresence(); resolveOppName().then(renderOnline); renderOnline();
    }
  }
}
function opponentLeft() {
  if (NET.phase === "match") { NET.oppLeft = true; finishOnline(true); return; }
  if (NET.phase === "result") { NET.oppLeft = true; $("rAgain").disabled = true; $("rAgain").querySelector("span").textContent = `${NET.oppName || "Your friend"} left`; return; }
  if (NET.role === "host") {
    NET.oppPeer = null; NET.oppBy = null; NET.oppName = ""; NET.phase = "hosting";
    namedPresence({ opp: null, start: null }); lobbyPresence(); renderOnline(); return;
  }
  NET.note = "The host left."; netCancel();
}

function handshakeTick(now) {
  const opp = NET.oppPeer && NET.mr ? NET.mr.peers().find((p) => p.peer === NET.oppPeer) : null;
  if (NET.role === "guest" && NET.phase === "joining" && now - NET.joinT > 8000) { NET.note = "No answer from the host."; netCancel(); return; }
  if (!opp) return;
  const pr = opp.presence || {};
  const echo = typeof pr.pg === "number" ? pr.pg : null;
  if (now - NET.pingT > 110) {
    NET.pingT = now;
    const t = Math.round(now) % 1000000000;
    NET.pingSent.set(t, now);
    if (NET.pingSent.size > 60) NET.pingSent.delete(NET.pingSent.keys().next().value);
    namedPresence({ pg: t, po: echo });
  } else if (echo !== null && NET.myPres.po !== echo) namedPresence({ po: echo });
  if (NET.role === "host") {
    if (!NET.hsT) NET.hsT = now;
    if (typeof pr.po === "number" && NET.pingSent.has(pr.po) && !NET.pingSeen.has(pr.po)) {
      NET.pingSeen.add(pr.po); NET.pings.push(now - NET.pingSent.get(pr.po));
    }
    const waited = now - NET.hsT;
    if (NET.pings.length >= 6 || (waited > 3000 && NET.pings.length) || waited > 7000) {
      const sorted = [...NET.pings].sort((a, b) => a - b);
      const rtt = sorted.length ? sorted[sorted.length >> 1] : 260;
      const pad = typeof window.__blDpad === "number" ? window.__blDpad : 4;
      const D = clamp(Math.ceil((rtt / 2 + pad) / 16.67) + 1, 3, 15);
      const gf = FIG[pr.f] ? pr.f : FIGHTERS[0].id;
      const gpi = Number.isInteger(pr.pi) && pr.pi >= 0 && pr.pi < FIG[gf].palettes.length ? pr.pi : 0;
      const hf = sel.fighter, hpi = palIdx(hf);
      const st = { id: NET.matchId + 1, seed: (Math.random() * 1e9) | 0, d: D, f: [hf, gf], p: [hpi, gf === hf && gpi === hpi ? (gpi + 1) % FIG[gf].palettes.length : gpi], rtt: Math.round(rtt),
        r: Object.assign({}, P.rules), set: { n: 1, w: [0, 0] } };
      NET.lastStart = st;
      namedPresence({ start: st });
      startOnlineMatch(st);
    }
  } else {
    const st = pr.start;
    if (validStart(st) && st.id > NET.startSeen) startOnlineMatch(st);
  }
}
function validStart(st) {
  return st && typeof st === "object" && Number.isInteger(st.id) && Number.isInteger(st.seed) && Number.isInteger(st.d) && st.d >= 1 && st.d <= 20 &&
    Array.isArray(st.f) && st.f.length === 2 && st.f.every((id) => FIG[id]) && Array.isArray(st.p) && st.p.length === 2 &&
    st.p.every((v, i) => Number.isInteger(v) && v >= 0 && v < FIG[st.f[i]].palettes.length) &&
    validRules(st.r) && st.set && Number.isInteger(st.set.n) && st.set.n >= 1 && st.set.n <= 3 && Array.isArray(st.set.w) && st.set.w.length === 2 && st.set.w.every((v) => Number.isInteger(v) && v >= 0 && v <= 2);
}
function startOnlineMatch(st) {
  Object.assign(NET, { matchId: st.id, startSeen: st.id, D: st.d, frame: 0, myLog: [], opLog: [], oppFrame: 0, stall: 0,
    ckMine: new Map(), ckSend: null, syncSent: null, lastSync: 0, rm: 0, lastOpp: null, oppLeft: false, rtt: st.rtt || 0,
    rules: st.r, set: st.set, setRes: null, nextF: null, rttLive: 0, rttS: [], myPg: null, echo: null, pgT: 0 });
  for (let i = 0; i < NET.D; i++) { NET.myLog.push(NEUTRAL); NET.opLog.push(NEUTRAL); }
  const specs = st.f.map((id) => FIG[id]);
  meSlot = NET.role === "host" ? 0 : 1;
  G = newGame({ players: specs.map((spec, i) => ({ spec, pal: spec.palettes[st.p[i]] })), stocks: st.r.l, time: st.r.t * 60, countdown: 150, seed: st.seed });
  match = { online: true, ranked: false, level: null };
  NET.phase = "match";
  namedPresence({ m: st.id, s: 0, i: "", fr: 0, ck: null, sync: null, rm: null, pg: null, po: null, nf: null, np: null });
  lobbyPresence();
  enterMatchUI();
  resolveOppName();
}
function readOpp(pr) {
  if (pr.m !== NET.matchId) return;
  // live ping: echo their stamp back, and time how long ours took to come back
  if (typeof pr.pg === "number") NET.echo = pr.pg;
  if (typeof pr.po === "number" && NET.pingSent.has(pr.po) && !NET.pingSeen.has(pr.po)) {
    NET.pingSeen.add(pr.po);
    NET.rttS.push(performance.now() - NET.pingSent.get(pr.po)); if (NET.rttS.length > 5) NET.rttS.shift();
    NET.rttLive = [...NET.rttS].sort((a, b) => a - b)[NET.rttS.length >> 1];
    if (NET.pingSeen.size > 300) NET.pingSeen.clear();
  }
  if (Number.isInteger(pr.s) && typeof pr.i === "string") {
    for (let k = 0; k * 2 + 1 < pr.i.length; k++) {
      const fr = pr.s + k;
      if (NET.opLog[fr] !== undefined) continue;
      const a = B64I[pr.i[k * 2]], b = B64I[pr.i[k * 2 + 1]];
      if (a === undefined || b === undefined) break;
      const v = a * 64 + b;
      if (v > 2591) break;
      NET.opLog[fr] = v;
    }
  }
  if (Number.isInteger(pr.fr)) NET.oppFrame = pr.fr;
  if (Array.isArray(pr.ck) && pr.ck.length === 2) {
    const mine = NET.ckMine.get(pr.ck[0]);
    if (mine !== undefined && mine !== pr.ck[1]) onDesync(pr.ck[0]);
    else if (mine !== undefined && NET.syncSent && pr.ck[0] > NET.syncSent.f) { NET.syncSent = null; namedPresence({ sync: null }); }
  }
  if (NET.role === "guest" && pr.sync && typeof pr.sync === "object" && Number.isInteger(pr.sync.n) && pr.sync.n > NET.lastSync) applySync(pr.sync);
}
function onDesync(F) {
  if (NET.role !== "host") return;
  if (NET.syncSent && NET.syncSent.f >= F) return;
  NET.desyncs++; NET.syncN++;
  NET.syncSent = { n: NET.syncN, f: NET.frame };
  namedPresence({ sync: { n: NET.syncN, f: NET.frame, st: serialize(G) } });
}
function applySync(sy) {
  NET.lastSync = sy.n;
  if (!Number.isInteger(sy.f) || !sy.st) return;
  try {
    const cur = NET.frame;
    restore(G, sy.st);
    for (const k of [...NET.ckMine.keys()]) if (k > sy.f) NET.ckMine.delete(k);
    if (cur > sy.f) {
      for (let fr = sy.f; fr < cur; fr++) {
        if (NET.myLog[fr] === undefined || NET.opLog[fr] === undefined) break;
        const ins = []; ins[meSlot] = decIn(NET.myLog[fr]); ins[1 - meSlot] = decIn(NET.opLog[fr]);
        step(G, ins); G.events.length = 0;
        if ((fr + 1) % 60 === 0) NET.ckMine.set(fr + 1, checksum(G));
      }
    } else {
      NET.frame = sy.f;
      while (NET.myLog.length < NET.frame + NET.D) NET.myLog.push(NEUTRAL);
    }
    NET.desyncs++;
  } catch (e) { console.warn("resync failed", e); }
}
function netTick() {
  const now = performance.now();
  if (mode === "online" && NET.invite && NET.phase === "idle" && now - (NET.inviteR || 0) > 1000) { NET.inviteR = now; renderOnline(); }
  if (NET.phase === "joining" || NET.phase === "handshake") { handshakeTick(now); return; }
  if (!NET.mr) return;
  const opp = NET.oppPeer ? NET.mr.peers().find((p) => p.peer === NET.oppPeer) : null;
  if (NET.phase === "result") { resultTick(opp); return; }
  if (NET.phase !== "match" || !G) return;
  if (opp && opp.presence !== NET.lastOpp) { NET.lastOpp = opp.presence; readOpp(opp.presence); }
  const maxSteps = NET.oppFrame - NET.frame > 3 ? 2 : 1;
  let steps = 0;
  while (steps < maxSteps) {
    if (NET.myLog.length <= NET.frame + NET.D) NET.myLog.push(encIn(readPlayer()));
    const ov = NET.opLog[NET.frame];
    if (ov === undefined) break;
    const ins = []; ins[meSlot] = decIn(NET.myLog[NET.frame]); ins[1 - meSlot] = decIn(ov);
    step(G, ins);
    NET.frame++;
    // test hook: lets an automated test change both players' games at the same frame
    if (window.__blTestAt && window.__blTestAt.f === NET.frame) window.__blTestAt.fn(G);
    if (NET.frame % 60 === 0) {
      const h = checksum(G);
      NET.ckMine.set(NET.frame, h); NET.ckSend = [NET.frame, h];
      if (NET.ckMine.size > 40) NET.ckMine.delete(NET.ckMine.keys().next().value);
    }
    steps++;
    if (G.phase === "over") break;
  }
  NET.stall = steps ? 0 : NET.stall + 1;
  NET.ticks = (NET.ticks || 0) + 1; if (!steps) NET.stallTotal = (NET.stallTotal || 0) + 1;
  const from = Math.max(0, NET.myLog.length - 72, Math.min(NET.oppFrame, NET.myLog.length) - 2);
  let str = "";
  for (let fr = from; fr < NET.myLog.length; fr++) str += packIn(NET.myLog[fr]);
  if (now - NET.pgT > 1000) {
    NET.pgT = now; NET.myPg = Math.round(now) % 1000000000;
    NET.pingSent.set(NET.myPg, now);
    if (NET.pingSent.size > 60) NET.pingSent.delete(NET.pingSent.keys().next().value);
  }
  namedPresence({ m: NET.matchId, s: from, i: str, fr: NET.frame, ck: NET.ckSend, pg: NET.myPg, po: NET.echo });
  const badge = $("netBadge");
  if (NET.stall > 20) { badge.hidden = false; badge.className = "warn"; badge.textContent = `Waiting for ${NET.oppName || "your friend"}`; }
  else if (!badge.hidden) badge.hidden = true;
  if (NET.stall > 60 * 15) finishOnline(false, true);
}
function resultTick(opp) {
  if (!opp) return;
  const pr = opp.presence || {};
  if (pr !== NET.lastOpp) { NET.lastOpp = pr; updateRematchLabel(); }
  const next = NET.matchId + 1;
  if (NET.rm !== next) return;
  if (NET.role === "host" && pr.rm === next && NET.lastStart) {
    const prev = NET.lastStart, res = NET.setRes, f = [...prev.f], p = [...prev.p];
    let set = { n: 1, w: [0, 0] };
    if (prev.r.b === 3 && res && !res.over) {
      // next game of the set: the loser (or both, after a draw) may have picked a new fighter
      set = { n: prev.set.n + 1, w: res.w };
      if (G.winner !== 0 && FIG[NET.nextF]) { f[0] = NET.nextF; p[0] = palIdx(NET.nextF); }
      if (G.winner !== 1 && FIG[pr.nf]) { f[1] = pr.nf; p[1] = Number.isInteger(pr.np) && pr.np >= 0 && pr.np < FIG[pr.nf].palettes.length ? pr.np : 0; }
      if (f[0] === f[1] && p[0] === p[1]) p[1] = (p[1] + 1) % FIG[f[1]].palettes.length;
    }
    const st = Object.assign({}, prev, { id: next, seed: (Math.random() * 1e9) | 0, f, p, set });
    NET.lastStart = st;
    namedPresence({ start: st });
    startOnlineMatch(st);
  } else if (NET.role === "guest" && validStart(pr.start) && pr.start.id === next) startOnlineMatch(pr.start);
}
function updateRematchLabel() {
  if (mode !== "result" || !match || !match.online || NET.oppLeft) return;
  const opp = NET.mr && NET.mr.peers().find((p) => p.peer === NET.oppPeer);
  const theyWant = opp && opp.presence && opp.presence.rm === NET.matchId + 1;
  const iWant = NET.rm === NET.matchId + 1;
  const who = NET.oppName || "Your friend", inSet = NET.setRes && !NET.setRes.over;
  $("rAgain").querySelector("span").textContent = iWant ? `Waiting for ${who}` : theyWant ? `${who} ${inSet ? "is ready" : "wants a rematch"}` : inSet ? "Next game" : "Rematch";
}
function finishOnline(left, lost) {
  if (mode !== "match" || !match || !match.online) return;
  const me = G.fighters[meSlot], op = G.fighters[1 - meSlot];
  const res = left ? 1 : lost ? 0.5 : G.winner === meSlot ? 1 : G.winner === 1 - meSlot ? 0 : 0.5;
  const R = { res, online: true, left: !!left, lost: !!lost, me, op, lines: [], total: 0 };
  if (!left && !lost && NET.rules && NET.rules.b === 3 && NET.set) {
    const w = [...NET.set.w];
    if (G.winner === 0 || G.winner === 1) w[G.winner]++;
    NET.setRes = { n: NET.set.n, w, over: w[0] >= 2 || w[1] >= 2 || NET.set.n >= 3 };
    R.set = { n: NET.set.n, mine: w[meSlot], theirs: w[1 - meSlot], over: NET.setRes.over };
  }
  if (!left && !lost) {
    if (res === 1) R.lines.push(["Win against a friend", 15]);
    else if (res === 0.5) R.lines.push(["Draw", 8]);
    else R.lines.push(["Match played", 5]);
    if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 2]);
    R.total = R.lines.reduce((a, l) => a + l[1], 0);
    P.tokens += R.total;
    P.friendW = (P.friendW || 0) + (res === 1 ? 1 : 0); P.friendL = (P.friendL || 0) + (res === 0 ? 1 : 0);
    saveProfile();
  }
  if (lost || left) { leaveMatchRoom(); NET.phase = "idle"; }
  else NET.phase = "result";
  $("netBadge").hidden = true;
  showResults(R);
  lobbyPresence();
}

/* ----- wiring ----- */
const tap = (id, fn) => $(id).addEventListener("click", (e) => { Sfx.init(); Sfx.ui(); fn(e); });
tap("bRanked", () => openSelect("ranked"));
tap("bPractice", () => openSelect("practice"));
tap("bHelp", openHelp);
tap("hClose", () => modal("help", false));
tap("selBack", goMenu);
tap("selUp", buyPending);
tap("selGo", () => { if (sel.mode === "online") { P.last = sel.fighter; saveProfile(); openOnline(); } else startMatch(); });
tap("pauseBtn", () => togglePause(true));
tap("pResume", () => togglePause(false));
tap("pHelp", openHelp);
tap("pQuit", () => {
  if (match && match.online) {
    if (!quitArmed) { quitArmed = true; $("pQuit").querySelector("span").textContent = "Tap again to leave"; return; }
    leaveMatchRoom(); resetNet(); NET.phase = "idle"; NET.note = "You left the match."; openOnline(); return;
  }
  if (!match.ranked) { goMenu(); return; }
  if (!quitArmed) { quitArmed = true; $("pQuit").querySelector("span").textContent = "Tap again to forfeit"; return; }
  finishMatch(true);
});
tap("rAgain", () => {
  if (match && match.tutorial) { openSelect("ranked"); return; }
  if (match && match.online) {
    NET.rm = NET.matchId + 1;
    const nf = FIG[NET.nextF] ? NET.nextF : null;
    namedPresence({ rm: NET.rm, nf, np: nf ? palIdx(nf) : null });
    $("rAgain").disabled = true; updateRematchLabel();
    if (!$("rPick").hidden) buildNextPick();
    return;
  }
  if (match && match.ranked) { sel.mode = "ranked"; }
  startMatch();
});
tap("rChange", () => {
  if (match && match.tutorial) { openSelect("practice"); return; }
  if (match && match.online) { leaveMatchRoom(); resetNet(); NET.phase = "idle"; openOnline(); return; }
  openSelect(match && !match.ranked ? "practice" : "ranked");
});
tap("rMenu", goMenu);
tap("bOnline", openOnline);
tap("onBack", goMenu);
tap("onChange", () => openSelect("online"));
tap("onHost", () => { if (NET.phase === "hosting") netCancel(); else netHost(); });
{
  const nameIn = $("onName");
  const commit = () => { if (window.__blSetName) { NET.myName = window.__blSetName(nameIn.value); nameIn.value = NET.myName; renderOnline(); } };
  nameIn.addEventListener("change", commit);
  nameIn.addEventListener("blur", commit);
  nameIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") nameIn.blur(); });
  nameIn.addEventListener("keyup", (e) => e.stopPropagation());
}
tap("onCopy", () => {
  const link = inviteLink(), btn = $("onCopy");
  const done = (ok) => { btn.textContent = ok ? "Copied" : "Select and copy"; setTimeout(() => { btn.textContent = "Copy link"; }, 1800); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents($("onLink")); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); done(false); };
  try { navigator.clipboard.writeText(link).then(() => done(true), fallback); } catch (e) { fallback(); }
});
tap("onShare", () => { try { navigator.share({ title: "PotatoBrawl", text: "Fight me in PotatoBrawl", url: inviteLink() }).catch(() => {}); } catch (e) { /* not available */ } });
/* ----- settings: sound, graphics, screen turning, reset ----- */
let resetArmed = false;
function chipRow(id, items, cur, pick, disabled) {
  const row = $(id); row.innerHTML = "";
  for (const [v, label] of items) {
    const b = document.createElement("button");
    b.className = "chip" + (v === cur ? " on" : ""); b.textContent = label; b.disabled = !!(disabled && disabled(v));
    b.addEventListener("click", () => { Sfx.init(); pick(v); Sfx.ui(); renderSettings(); });
    row.appendChild(b);
  }
}
function renderSettings() {
  chipRow("setSound", [[true, "On"], [false, "Off"]], !!P.sound, (v) => { P.sound = v; saveProfile(); });
  chipRow("setGfx", [["3d", "3D"], ["2d", "2D"]], R3.failed ? "2d" : P.gfx === "2d" ? "2d" : "3d", (v) => { P.gfx = v; saveProfile(); }, (v) => R3.failed && v === "3d");
  $("setGfxNote").hidden = !R3.failed; $("setGfxNote").textContent = "3D isn't supported on this device.";
  $("setScreenRow").hidden = !L.canRotate;
  chipRow("setScreen", [["cw", "Sideways"], ["ccw", "Flipped"], ["up", "Upright"]], P.screen || "cw", (v) => { P.screen = v; saveProfile(); releaseTouch(); resize(); });
  const rb = $("setReset");
  rb.textContent = resetArmed ? "Tap again to erase rating, chips and skins" : "Reset progress";
}
function openSettings() { resetArmed = false; renderSettings(); modal("settings", true); }
tap("bSettings", openSettings);
tap("pSettings", openSettings);
tap("setClose", () => { modal("settings", false); if (mode === "menu") renderMenu(); });
tap("setReset", () => {
  if (!resetArmed) { resetArmed = true; renderSettings(); return; }
  resetArmed = false; P = defProfile(); P.tut = true; saveProfile(); sel.fighter = P.last; renderSettings(); renderMenu();
});

/* In sideways mode the browser's own touch scrolling would run along the wrong axis,
   so scrollable panels are dragged by hand, with a little momentum. */
let drag = null, suppressClick = false, glide = 0;
app.addEventListener("pointerdown", (e) => {
  if (!rotMode) return;
  const sc = e.target.closest(".scroll");
  if (!sc) return;
  cancelAnimationFrame(glide);
  const p = toApp(e.clientX, e.clientY);
  drag = { sc, id: e.pointerId, y0: p[1], top: sc.scrollTop, moved: false, ly: p[1], lt: performance.now(), v: 0 };
}, true);
app.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const p = toApp(e.clientX, e.clientY), now = performance.now();
  const dy = p[1] - drag.y0;
  if (!drag.moved && Math.abs(dy) > 8) drag.moved = true;
  if (drag.moved) {
    drag.sc.scrollTop = drag.top - dy;
    const dt = Math.max(1, now - drag.lt);
    drag.v = 0.7 * drag.v + 0.3 * ((p[1] - drag.ly) / dt);
    drag.ly = p[1]; drag.lt = now;
    e.preventDefault();
  }
}, true);
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.moved) {
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    const sc = drag.sc; let v = drag.v * 16;
    const run = () => { if (Math.abs(v) < 0.4) return; sc.scrollTop -= v; v *= 0.94; glide = requestAnimationFrame(run); };
    glide = requestAnimationFrame(run);
  }
  drag = null;
}
app.addEventListener("pointerup", endDrag, true);
app.addEventListener("pointercancel", endDrag, true);
app.addEventListener("click", (e) => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);

document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "match" && !paused && !(match && match.online)) togglePause(true); });
window.addEventListener("pointerdown", () => Sfx.init(), { passive: true });

/* ----- how to play: a picture of the controls, one line per control ----- */
const CTRL = [
  { k: "stick", name: "Stick", col: "#f3d9a4", key: "A D W S", text: "Move, and aim attacks up, down or sideways." },
  { k: "light", name: "Light", col: "#f3d9a4", key: "J", text: "Quick hits. The third in a row launches." },
  { k: "heavy", name: "Heavy", col: "#ef7a52", key: "K", text: "Strong hit. Up + Heavy in the air flies you back." },
  { k: "special", name: "Special", col: "#8fb6ff", key: "L", text: "Signature move, then a short recharge." },
  { k: "jump", name: "Jump", col: "#eef0fa", key: "Space", text: "Works again in the air." },
  { k: "dodge", name: "Dodge", col: "#a4a9c8", key: "Shift", text: "Slip through attacks. Softens a hard landing." },
];
function phoneFig() {
  // positions follow the real touch layout; the empty middle of the screen is left out
  const PAD = [["light", 708, 332, 40], ["heavy", 623, 323, 33], ["jump", 791, 255, 35], ["special", 705, 245, 29], ["dodge", 791, 337, 27]], sh = 280;
  const C = Object.fromEntries(CTRL.map((c) => [c.k, c]));
  const btn = ([k, x, y, r]) => { const c = C[k], fs = k === "special" ? 11.5 : k === "dodge" ? 12 : 16;
    return `<circle cx="${x - sh}" cy="${y}" r="${r}" fill="rgba(14,16,34,.55)" stroke="${c.col}" stroke-width="3"/><text x="${x - sh}" y="${y + fs * 0.36}" font-size="${fs}" fill="${c.col}" text-anchor="middle">${c.name}</text>`; };
  return `<svg class="help-fig" viewBox="0 150 564 240" role="img" aria-label="Touch controls: stick on the left, five buttons on the right">
    <rect x="2" y="152" width="560" height="236" rx="26" fill="#14172e" stroke="rgba(206,210,255,.18)" stroke-width="2"/>
    <circle cx="120" cy="290" r="58" fill="rgba(14,16,34,.4)" stroke="rgba(243,217,164,.45)" stroke-width="3"/>
    <circle cx="142" cy="280" r="25" fill="#f3d9a4"/>
    <text x="120" y="210" font-size="16" fill="#f3d9a4" text-anchor="middle">Stick</text>
    ${PAD.map(btn).join("")}</svg>`;
}
function keysFig() {
  const key = (x, y, w, label, sub, c) => `<rect x="${x}" y="${y}" width="${w}" height="52" rx="8" fill="#232746" stroke="${c}" stroke-width="2.5"/><rect x="${x + 3}" y="${y + 46}" width="${w - 6}" height="4" rx="2" fill="rgba(0,0,0,.3)"/>
    <text x="${x + w / 2}" y="${y + 27}" font-size="20" fill="#eef0fa" text-anchor="middle">${label}</text><text x="${x + w / 2}" y="${y + 43}" font-size="11" fill="${c}" text-anchor="middle">${sub}</text>`;
  const S = "#f3d9a4";
  return `<svg class="help-fig" viewBox="0 0 470 186" role="img" aria-label="Keyboard controls">
    ${key(64, 6, 52, "W", "up", S)}${key(6, 64, 52, "A", "left", S)}${key(64, 64, 52, "S", "down", S)}${key(122, 64, 52, "D", "right", S)}
    ${key(256, 6, 52, "J", "light", "#f3d9a4")}${key(314, 6, 52, "K", "heavy", "#ef7a52")}${key(372, 6, 52, "L", "special", "#8fb6ff")}
    ${key(6, 128, 110, "Shift", "dodge", "#a4a9c8")}${key(126, 128, 240, "Space", "jump", "#eef0fa")}${key(376, 128, 88, "Esc", "pause", "#a4a9c8")}</svg>`;
}
function openHelp() {
  $("helpFig").innerHTML = touchUI ? phoneFig() : keysFig();
  $("helpKeys").innerHTML = CTRL.map((c) => `<dt style="--kc:${c.col}">${c.name}${touchUI ? "" : `<kbd>${c.key}</kbd>`}</dt><dd>${c.text}</dd>`).join("");
  $("helpGo").hidden = mode === "match";
  $("helpPadK").hidden = $("helpPad").hidden = touchUI;
  modal("help", true);
}

/* ----- guided practice: short prompts the first time someone plays ----- */
const LIGHTK = new Set(["jab", "side", "up", "down", "nair", "sair", "uair", "dair"]);
const TUT = { on: false, i: 0, x0: 0, lights: 0, hold: 0 };
function tutSteps() {
  const t = touchUI, spec = G.fighters[0].spec;
  return [
    { t: "Move", h: t ? "Drag on the left side of the screen." : "A and D, or the arrow keys.", b: null },
    { t: "Jump, then jump again", h: t ? "Tap Jump twice. The second jump happens in the air." : "Space twice. The second jump happens in the air.", b: "jump" },
    { t: "Three light hits", h: `${t ? "Tap Light" : "Press J"} three times next to the dummy. The third hit launches.`, b: "light" },
    { t: "Heavy attack", h: `${t ? "Tap Heavy" : "Press K"}. Slower, but it hits hard. Hold up or down to aim it.`, b: "heavy" },
    { t: spec.signature.name, h: `${t ? "Tap Special" : "Press L"} for your signature move. It recharges after each use.`, b: "special" },
    { t: "Knock them off", h: "Their damage is high now, so they fly far. Hit them off the screen.", b: null },
  ];
}
function startTutorial() {
  Sfx.init(); hideOnline(); modal("help", false); modal("settings", false);
  P.tut = true; saveProfile();
  const me = FIG[sel.fighter] || FIGHTERS[0], opp = me.id === "odin" ? FIG.wizard : FIG.odin;
  const myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: opp.palettes[0] }], stocks: 9, time: 0, countdown: 120 });
  match = { ranked: false, tutorial: true, d: -1, bot: makeBot(-1), level: "Tutorial" };
  meSlot = 0;
  Object.assign(TUT, { on: true, i: 0, x0: G.fighters[0].x, lights: 0, hold: 0 });
  enterMatchUI();
  tutShow();
}
function tutShow() {
  const st = tutSteps(), s = st[TUT.i], el = $("tut");
  el.classList.remove("done");
  $("tutN").textContent = `Tutorial · ${TUT.i + 1} of ${st.length}`;
  $("tutT").textContent = s.t; $("tutH").textContent = s.h;
  for (const b of padBtns) b.classList.toggle("tutpulse", b.dataset.k === s.b);
}
function tutEnd() {
  TUT.on = false; $("tut").hidden = true; app.classList.remove("tut");
  for (const b of padBtns) b.classList.remove("tutpulse");
}
function tutTick(evs) {
  if (!TUT.on || !match || !match.tutorial || !G || G.phase !== "play") return;
  const me = G.fighters[0], op = G.fighters[1];
  me.stocks = Math.max(me.stocks, 5); // nobody runs out of lives while learning
  if (TUT.hold > 0) {
    if (--TUT.hold === 0) {
      TUT.i++;
      if (TUT.i === 5) { op.percent = Math.max(op.percent, 120); op.stocks = 1; }
      tutShow();
    }
    return;
  }
  let done = false;
  switch (TUT.i) {
    case 0: done = Math.abs(me.x - TUT.x0) > 110; break;
    case 1: done = evs.some((e) => e.type === "jump" && e.slot === 0 && !e.ground); break;
    case 2: for (const e of evs) if (e.type === "hit" && e.slot === 0 && LIGHTK.has(me.mid)) TUT.lights++; done = TUT.lights >= 3; break;
    case 3: done = me.state === "attack" && !!me.mid && !LIGHTK.has(me.mid) && me.mid !== "spec"; break;
    case 4: done = me.mid === "spec"; break;
  }
  if (done) {
    TUT.hold = 50; $("tut").classList.add("done"); $("tutT").textContent = "Nice!";
    for (const b of padBtns) b.classList.remove("tutpulse");
    Sfx.ui();
  }
}
function tutDone() {
  tutEnd();
  mode = "result"; paused = false;
  modal("pause", false); modal("help", false); hideBanner();
  $("ctl").hidden = true; $("hud").hidden = true; releaseTouch();
  const sheet = $("resSheet"); sheet.classList.add("win", "solo"); sheet.classList.remove("loss");
  $("rMode").textContent = "Tutorial";
  $("rTitle").textContent = "Ready!";
  $("rSub").textContent = "That's the basics. Ranked matches earn potato chips, and chips unlock new skins.";
  $("rRank").hidden = true; $("rPick").hidden = true;
  $("rStats").textContent = ""; $("rChips").textContent = "";
  $("rAgain").disabled = false;
  $("rAgain").querySelector("span").textContent = "Ranked match";
  $("rChange").querySelector("span").textContent = "Practice";
  show("result");
}
tap("tutSkip", () => { tutEnd(); goMenu(); });
tap("hTry", startTutorial);

/* ===================== loop ===================== */
function simTick() {
  if (mode === "result") { if (match && match.online) netTick(); return; }
  if (mode === "online" || mode === "select") netTick();
  const live = mode === "match" && G;
  const g = live ? G : attract.g;
  if (live) {
    if (paused) return;
    if (match.online) netTick();
    else {
      const pi = readPlayer();
      const bi = botInput(G, G.fighters[1], G.fighters[0], match.bot);
      step(G, [pi, bi]);
    }
    if (G.phase === "countdown") {
      const n = Math.ceil(G.cd / 50);
      if (n !== lastCount && n > 0) { lastCount = n; showBanner(String(n), vsLine(), "count", 0); Sfx.count(false); }
    }
  } else {
    latch.clear();
    step(g, [botInput(g, g.fighters[0], g.fighters[1], attract.b0), botInput(g, g.fighters[1], g.fighters[0], attract.b1)]);
  }
  const evs = g.events.splice(0);
  if (live && match && match.tutorial) tutTick(evs);
  for (const e of evs) handleEvent(g, e, live);
  if (mode === "match" && G !== g) return;
  updateFx(g);
  camStep(g, false);
  tick++;
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = now - last; last = now;
  if (dt > 120) dt = 120;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) { acc -= STEP; n++; simTick(); }
  if (n === 5) acc = 0;
  const g = (mode === "match" || mode === "result") && G ? G : attract.g;
  render(g, tick);
  if (mode === "match" && G) updateHud();
  if (mode === "select") drawCards(tick);
  if (mode === "online") drawOnlineArt(tick);
}

window.__blastline = { get game() { return G; }, get mode() { return mode; }, get net() { return NET; }, r3: R3 };
newAttract();
goMenu();
if (NET.invite) openOnline();
else if (firstRun) startTutorial(); // a brand-new player starts with the guided round
camStep(attract.g, true);
requestAnimationFrame(frame);
})();
