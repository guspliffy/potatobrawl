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

