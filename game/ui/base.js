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
    last: FIGHTERS[0].id, sound: true, history: [], screen: "cw", rules: { l: 3, t: 4, b: 1 },
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
function saveProfile() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* ignore */ }
  try { acctDirty(); } catch (e) { /* accounts (ui/acct.js) not set up yet */ }   // a linked account saves itself shortly after
}
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
  ctx: null, out: null, noiseBuf: null, humO: null, humG: null, humT: 0,
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
  // Gunslinger: a crisp crack with a low thump; the golden High Noon shot is heavier and leaves a whine
  shot(gold) {
    this.noiseF(0.07, 0.5, "highpass", 2400, 900, 0.7); this.noise(0.09, 0.3, 2600); this.tone(260, 55, 0.1, "sine", 0.3);
    if (gold) { this.noise(0.35, 0.4, 1200); this.tone(150, 38, 0.35, "sine", 0.45); this.later(90, () => this.tone(2600, 1300, 0.3, "sine", 0.04)); }
  },
  // Reaper: Harvest is a low whoosh with two passing swishes as the scythe comes round; Grave rise a soft dark rush
  harvest() {
    this.noiseF(0.55, 0.26, "bandpass", 260, 820, 0.9); this.tone(92, 58, 0.45, "sine", 0.2);
    for (let i = 1; i <= 2; i++) this.later(i * 120, () => this.noiseF(0.12, 0.16, "highpass", 1400, 3800, 1.1));
  },
  graveRise() { this.noiseF(0.5, 0.22, "lowpass", 700, 180, 0.8); this.tone(70, 110, 0.4, "sine", 0.16); },
  // filtered noise with a sweep: type "bandpass" | "highpass" | "lowpass"
  noiseF(dur, vol, type, f0, f1, q) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    this.env(g, t, vol, dur); s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },
  later(ms, fn) { setTimeout(() => { if (this.ok()) fn(); }, ms); },
  // Charge hum: ONE oscillator rising 140 -> 420 Hz across the charge. humStep() (effects.js) calls hum(frames) every rendered frame while a
  // heavy is held; hum(0) stops it. A dead-man timer stops it by itself when the frames stop coming (hidden tab), so it can never keep droning.
  hum(chg) {
    if (!(chg > 0) || !this.ok()) { this.humOff(); return; }
    const c = this.ctx, t = c.currentTime, k = Math.min(1, chg / 60), fr = 140 + 280 * k, v = 0.04 + 0.03 * k;
    if (!this.humO) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(fr, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.06);
      o.connect(g); g.connect(this.out); o.start(t);
      this.humO = o; this.humG = g;
    } else { this.humO.frequency.setTargetAtTime(fr, t, 0.03); this.humG.gain.setTargetAtTime(v, t, 0.04); }
    clearTimeout(this.humT); this.humT = setTimeout(() => this.humOff(), 260);
  },
  humOff() {
    clearTimeout(this.humT); this.humT = 0;
    const o = this.humO, g = this.humG;
    if (!o) return;
    this.humO = this.humG = null;
    try { const t = this.ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.02); o.stop(t + 0.1); } catch (e) { /* already stopped */ }
    setTimeout(() => { try { o.disconnect(); g.disconnect(); } catch (e) { /* gone */ } }, 300);
  },
  // Heavy attacks: a low "whoomp" under every heavy, then a signature per fighter and move (id = fighter, key = hSide / hUp / hDown / hAir)
  heavy(id, key) {
    if (!this.ok()) return;
    const up = key === "hUp", dn = key === "hDown", air = key === "hAir";
    this.tone(180, 50, 0.3, "sine", 0.42); this.noise(0.22, 0.2, 500);
    switch (id) {
      case "dragon": // a rip and a short growl; fwap for the horn toss, low whoosh and thud for the tail
        this.noiseF(0.22, 0.3, "bandpass", 1800, 1800, 1.1);
        this.tone(105, 62, 0.32, "sawtooth", 0.12); this.tone(112, 70, 0.28, "sawtooth", 0.09);
        if (up) this.noiseF(0.16, 0.35, "bandpass", 500, 1700, 1.4);
        if (dn) { this.noiseF(0.3, 0.3, "lowpass", 900, 200, 0.8); this.later(110, () => this.tone(95, 38, 0.2, "sine", 0.4)); }
        break;
      case "samurai": // shing
        this.noiseF(0.28, 0.22, "highpass", 2600, 6500, 2.2); this.tone(2300, 3600, 0.26, "sine", 0.07); this.tone(3400, 5200, 0.2, "triangle", 0.035);
        if (key === "hSide") this.later(330, () => { this.tone(1500, 900, 0.05, "square", 0.09); this.noise(0.03, 0.2, 5000); });   // the click as the blade is sheathed
        break;
      case "odin": // deep thud with ice crackle, a caw for the raven, a boom for the stomp
        this.tone(95, 38, 0.42, "sine", 0.55);
        this.noiseF(0.18, 0.18, "highpass", 5200, 3600, 2);
        if (up) this.later(60, () => this.caw());
        if (dn) { this.tone(70, 28, 0.6, "sine", 0.55); this.noise(0.4, 0.3, 380); }
        if (!up && !dn) this.later(80, () => { this.noiseF(0.1, 0.12, "highpass", 6200, 5200, 3); this.noiseF(0.08, 0.1, "highpass", 4600, 6200, 3); });
        break;
      case "wizard": // a chime over the whoomp; boom plus chime for the slam
        this.tone(880, 880, 0.5, "sine", 0.07); this.later(70, () => this.tone(1318, 1318, 0.5, "sine", 0.06));
        if (dn) { this.tone(80, 30, 0.5, "sine", 0.55); this.noise(0.3, 0.25, 420); this.later(120, () => { this.tone(1760, 1760, 0.6, "sine", 0.05); this.tone(2093, 2093, 0.5, "sine", 0.035); }); }
        break;
      case "phoenix": // a fire roar; fwap plus fire for the wing flare; thud and sizzle for the stomp
        this.noiseF(0.4, 0.3, "lowpass", 1300, 500, 0.7); this.tone(210, 90, 0.34, "sawtooth", 0.06);
        if (up) this.noiseF(0.14, 0.3, "bandpass", 600, 1800, 1.4);
        if (dn) { this.tone(90, 34, 0.3, "sine", 0.45); this.later(80, () => this.noiseF(0.35, 0.16, "highpass", 3800, 7000, 1.3)); }
        break;
      case "gunslinger": // three fanned cracks for the side blast, two cracks for the sky and floor shots, a dull thud of dust for the floor
        for (let i = 0; i < (up || dn ? 2 : 3); i++) this.later(i * (up || dn ? 30 : 55), () => { this.noiseF(0.06, 0.45, "highpass", 2600, 1000, 0.7); this.tone(240, 60, 0.08, "sine", 0.22); });
        if (dn) this.later(40, () => this.noise(0.25, 0.2, 500));
        if (!up && !dn && !air) this.later(170, () => this.tone(1800, 1500, 0.06, "triangle", 0.03));   // a spent shell rings on the floor
        break;
      case "reaper": // "shhk": a fast hiss rising through the swing, a thin metal ring off the blade; a second swish for the full turns, earth for the grave sweep
        this.noiseF(0.16, 0.34, "highpass", 1600, 5600, 1.3); this.later(70, () => this.tone(3100, 2500, 0.12, "sine", 0.045));
        if (!up) this.later(110, () => this.noiseF(0.14, 0.24, "highpass", 2200, 5200, 1.3));
        if (dn) this.later(60, () => this.noise(0.28, 0.2, 480));
        break;
      case "alchemist": // zap crackle; glass and a burst for the flask
        if (dn) {
          this.noiseF(0.2, 0.2, "highpass", 3200, 6800, 1.5); this.tone(2600, 1700, 0.18, "triangle", 0.06); this.tone(3600, 2400, 0.14, "triangle", 0.04);
          this.later(60, () => this.burst());
        } else { for (let i = 0; i < 4; i++) this.later(i * 38, () => this.tone(900 + Math.random() * 1500, 300 + Math.random() * 400, 0.05, "square", 0.05)); this.noiseF(0.18, 0.12, "highpass", 4000, 6000, 1); }
        break;
    }
  },
};

