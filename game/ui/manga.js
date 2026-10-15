/* ===================== manga KO finisher: the winner's finisher as a page of comic panels =====================
   Pure 2D canvas, everything drawn in code, UI only (nothing here reads or writes the game state G; the match keeps running underneath
   and both online browsers play their own copy). Design: Project files finisher-films/fable-manga.md.
   Flow, ms after the final hit (MT): 0-300 the real hit as always; 300 the freeze: the picture stops and is inked (paper tint, dot tone,
   a hand-drawn border, focus lines, the sound word); panels slide in over the page and stay visible under each other (every panel is
   one slow camera move); the strike with the drop, two impact frames and the loser bursting through the border along the real launch
   direction (finLoser/finOut/finTrav in finisher.js); the aftermath hold; the manga title block and the red K.O. seal; fade to the results.
   A fighter's page is a script, MANGA[id], in game/manga/<id>.js (spliced in by build.py at the marker at the end of this part). A fighter without one
   (and any error while the page plays) keeps the 2D finisher of finisher.js.
   Phone budget: no ctx.filter, no shadowBlur, no per-frame getImageData; patterns, the focus disc, speed strips and word canvases are
   built once per page and freed at its end.
   ULTIMATES (design: ultimates/fable-ultimate-pages.md). When the lethal hit is an Ultimate (the event's mv === "ulti"; finisher.js sets FIN.ulti) the engine
   sets MG.ulti = true and MG.ultiName = the fighter's ultimate name, and adds the GENERIC Ultimate layer to whatever page plays, all in this file:
   a third impact frame (gold paper, ink silhouettes, white rays; 50 ms each, so the launch waits until hit + 150), the tear glows gold, every word that comes
   at or after the hit and has no fill of its own is gold, the card says "ULTIMATE: <name>" in gold over a second, gold strip, the K.O. hanko is gold and chimes.
   A page that has its own Ultimate cut puts a full script on MANGA[id].ulti (an object with the fields of any page, usually Object.assign({}, S_, {...})): the engine
   then plays that script on the LONGER timeline MT_U (5.9 s: SPLASH 3250, AFTER 4700, CARD 4850, SEAL 5050, FADE 5600, END 5900; MT is overwritten from MT_N or MT_U
   in mangaStart, so a page always reads MT.AFTER etc.; its own post-aftermath moments are MT.AFTER + offset). Its panels(lay) include one splash panel, a full
   page panel from mgSplashPanel({ from, paper, cam, draw, ... }) at MT.SPLASH. Panel fields added for this: opaque (the panel covers the whole page once it has
   slid in, so the panels below it are no longer drawn) and before(c, t, pn) (called once, on the first frame the panel is drawn, just before it is: c holds the
   page so far, which the Samurai copies to cut it into slabs). A script may also define end() (called when the page ends or is skipped, to free its own canvases).
   The gold colours are MG_GOLD (lettering, third impact frame, the strike word), MG_GOLD_D (strokes, the misprint ghost), MG_GOLD_PALE (splash paper), MG_GOLD_SEAL. */

/* ===================== B13: the cinema sound kit (Web Audio synth, one compressed bus) ===================== */
const Cin = {
  bus: null, comp: null, duck: false,
  ok() { return Sfx.ok(); },
  open() {
    if (!Sfx.ok()) return false;
    if (this.bus && this.bus.context === Sfx.ctx) return true;
    const c = Sfx.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0.85;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.knee.value = 12; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.18;
    this.bus.connect(this.comp); this.comp.connect(c.destination);
    return true;
  },
  close() {
    try { if (this.bus) { this.bus.disconnect(); this.comp.disconnect(); } } catch (e) { /* gone */ }
    this.bus = null; this.comp = null;
    try { if (this.duck && Sfx.out) { Sfx.out.gain.cancelScheduledValues(0); Sfx.out.gain.value = 0.55; } } catch (e) { /* gone */ }
    this.duck = false;
  },
  // the game's own sounds dip to a hum while the page plays; the page's bus is untouched
  dipGame(to, sec) {
    if (!Sfx.ok()) return; const g = Sfx.out.gain, t = Sfx.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + sec); this.duck = true;
  },
  _pan(c, v) { if (!c.createStereoPanner) return null; const p = c.createStereoPanner(); p.pan.value = v; return p; },
  _env(g, t, a, peak, dur, tail) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (tail || 0)); },
  _osc(type, f0, f1, dur, vol, a, when, detune) {
    const c = Sfx.ctx, t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur); if (detune) o.detune.value = detune;
    this._env(g, t, a || 0.01, vol, dur); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.1); return o;
  },
  _noise(dur, vol, f0, f1, type, q, when, pan) {
    const c = Sfx.ctx, t = c.currentTime + (when || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = Sfx.noiseBuf; f.type = type || "lowpass"; f.Q.value = q || 0.7; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this._env(g, t, Math.min(0.05, dur * 0.3), vol, dur); s.connect(f); f.connect(g);
    const p = pan === undefined ? null : this._pan(c, pan);
    if (p) { g.connect(p); p.connect(this.bus); } else g.connect(this.bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1); return s;
  },
  // the silence before a blast: the page's bus dips to 10% in 60 ms, holds, then snaps back
  drop(hold) { if (!this.bus) return; const g = this.bus.gain, t = Sfx.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.1, t + 0.06); g.setValueAtTime(0.1, t + 0.06 + hold); g.linearRampToValueAtTime(0.85, t + 0.08 + hold); },
  go(fn) { try { if (this.open()) fn(); } catch (e) { /* sound off or not ready */ } },
  sub(f0, f1, dur, vol) { this._osc("sine", f0 || 55, f1 || 28, dur || 0.5, vol || 0.7, 0.01); },
  riser(dur, vol) { this._noise(dur, (vol || 0.3), 300, 5200, "bandpass", 1.2); this._osc("sawtooth", 180, 520, dur, (vol || 0.3) * 0.25, dur * 0.8); this._osc("sawtooth", 184, 528, dur, (vol || 0.3) * 0.25, dur * 0.8, 0, 8); },
  impact(vol) { const v = vol || 1; this._osc("sine", 90, 26, 0.9, 0.9 * v, 0.004); this._noise(0.5, 0.6 * v, 3200, 200, "lowpass", 0.7); this._noise(0.9, 0.18 * v, 1200, 400, "lowpass", 0.5, 0.12); },
  stab(f, dur) { for (const d of [-9, 0, 9]) this._osc("sawtooth", (f || 110) * 1.5, (f || 110) * 1.5 * 0.7, dur || 0.7, 0.07, 0.01, 0, d); },
  shimmer(f, dur) { for (let i = 0; i < 6; i++) this._osc("sine", (f || 880) * (1 + i * 0.5), (f || 880) * (1 + i * 0.5) * 0.99, dur || 1.6, 0.035, 0.2, 0, i * 6); },
  whoosh(dur, from, to, vol) { this._noise(dur, vol || 0.4, 400, 3600, "bandpass", 0.9, 0, from); if (to !== undefined) { /* pan sweep is approximated by two overlapping sweeps */ this._noise(dur, (vol || 0.4) * 0.7, 3600, 500, "bandpass", 0.9, dur * 0.35, to); } },
  chime(f) { this._osc("sine", f || 1760, f || 1760, 0.9, 0.08, 0.004); this._osc("sine", (f || 1760) * 2, (f || 1760) * 2, 0.5, 0.04, 0.004); },
  growl(dur) { const o = this._osc("sawtooth", 55, 50, dur || 1, 0.22, 0.2); try { const c = Sfx.ctx, l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 9; lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency); l.start(); l.stop(c.currentTime + (dur || 1) + 0.2); } catch (e) { /* no lfo */ } this._noise(dur || 1, 0.1, 260, 120, "lowpass"); },
  rumble(dur) { this._osc("sawtooth", 40, 36, dur || 1, 0.3, 0.05); this._noise(dur || 1, 0.35, 420, 140, "lowpass"); },
  inhale(dur) { this._noise(dur, 0.45, 500, 3400, "bandpass", 1.6); this._osc("sawtooth", 120, 400, dur, 0.1, dur * 0.85); },
  roar(dur) { this._noise(dur, 0.55, 1400, 700, "bandpass", 0.8); this._osc("sawtooth", 70, 58, dur, 0.28, 0.06); this._osc("square", 140, 110, dur, 0.06, 0.06); },
  tick(f) { this._osc("triangle", f || 2600, (f || 2600) * 0.4, 0.05, 0.12, 0.002); this._noise(0.03, 0.2, 7000, 3000, "highpass"); },
  glass() { this._noise(0.35, 0.5, 9000, 2400, "highpass"); this._osc("triangle", 3200, 900, 0.3, 0.1, 0.002); this._noise(0.9, 0.2, 6000, 1800, "bandpass", 2, 0.05); },
  clack() { this._noise(0.05, 0.5, 5200, 1400, "highpass"); this._osc("square", 300, 90, 0.08, 0.12, 0.002); },
  boom(vol) { this.sub(70, 24, 0.9, vol || 0.9); this._noise(0.6, 0.4 * (vol || 1), 900, 120, "lowpass"); },
};

/* the page's own sounds: silence with hits. All of them run through Cin.go (which fails quietly with sound off). */
Object.assign(Cin, {
  page() { this._noise(0.09, 0.2, 3200, 6500, "highpass", 0.6); },                                  // a panel pushed over the paper
  brush() { this._noise(0.13, 0.15, 1700, 3600, "bandpass", 2.2); },                                  // the border drawn by a brush
  stamp(v) { v = v || 1; this._osc("sine", 90, 40, 0.12, 0.5 * v, 0.004); this._noise(0.02, 0.22 * v, 5200, 2500, "highpass"); },   // lettering lands
  taiko(v) { v = v || 1; this._osc("sine", 60, 38, 0.42, 0.85 * v, 0.003); this._noise(0.14, 0.45 * v, 2600, 260, "lowpass"); },
  flute(dur) {                                                                                         // breathy: a sine with vibrato plus a little air
    const c = Sfx.ctx, t = c.currentTime, o = c.createOscillator(), lf = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = "sine"; o.frequency.value = 880; lf.frequency.value = 5; lg.gain.value = 9; lf.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); lf.start(t); o.stop(t + dur + 0.05); lf.stop(t + dur + 0.05);
    this._noise(dur, 0.02, 2400, 2400, "bandpass", 3);
  },
  pluck(f) {                                                                                           // a koto string: a 20 ms noise burst into a ringing band-pass
    const c = Sfx.ctx, t = c.currentTime, s = c.createBufferSource(), b = c.createBiquadFilter(), g = c.createGain();
    s.buffer = Sfx.noiseBuf; b.type = "bandpass"; b.frequency.value = f || 1320; b.Q.value = 38;
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    s.connect(b); b.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.4); s.stop(t + 0.02);
  },
  droneO: null,
  drone(on) {                                                                                          // two detuned saws at 55 Hz through a low-pass, very quiet
    if (!on) {
      if (this.droneO) { try { const [a, b, g] = this.droneO, t = Sfx.ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.18); a.stop(t + 0.25); b.stop(t + 0.25); } catch (e) { /* gone */ } this.droneO = null; }
      return;
    }
    if (this.droneO) return;
    const c = Sfx.ctx, t = c.currentTime, a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    a.type = b.type = "sawtooth"; a.frequency.value = 55; b.frequency.value = 55.45; lp.type = "lowpass"; lp.frequency.value = 190;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.6);
    a.connect(lp); b.connect(lp); lp.connect(g); g.connect(this.bus); a.start(t); b.start(t);
    this.droneO = [a, b, g];
  },
});

/* ---------- constants, state ---------- */
const MANGA = {};   // MANGA[fighter id] = script (game/manga/<id>.js, spliced in at the end of this part)
// ms after the final hit. FREEZE: the picture stops (the loser has left the shot by 520, so the picture is taken while it is still in it); INKED: the ink is down.
// Two tables: MT_N (every normal page, and the generic Ultimate layer on a page without its own Ultimate cut, 4.7 s) and MT_U (a page with its own Ultimate cut,
// 5.9 s: everything from the aftermath on is shifted by U = 1200 and the splash panel sits at 3250). mangaStart copies the right one into MT before the page is built.
const MT_N = { FREEZE: 300, INKED: 520, SKIP: 1000, LOOK: 1250, INSET: 2000, STRIKE: 2350, DROP: 2780, HIT: 2900, SPLASH: 1e9, AFTER: 3500, CARD: 3650, SEAL: 3850, FADE: 4400, END: 4700 };
const MT_U = { FREEZE: 300, INKED: 520, SKIP: 1000, LOOK: 1250, INSET: 2000, STRIKE: 2350, DROP: 2780, HIT: 2900, SPLASH: 3250, AFTER: 4700, CARD: 4850, SEAL: 5050, FADE: 5600, END: 5900 };
const MT = Object.assign({}, MT_N);
const MG_BOX = [-100, -125, 100, 14];
const MG_GOLD = "#f3c84a", MG_GOLD_D = "#b8860b", MG_GOLD_PALE = "#fff2c2", MG_GOLD_SEAL = "#e0b43a";   // the Ultimate's gold: it joins the page's accent, never replaces it
const MG_PAPER = "#f1ece2", MG_INK = "#0b0a12", MG_CTX = CanvasRenderingContext2D.prototype, MG_GRAD = CanvasGradient.prototype;
const MG = { on: false, ulti: false, ultiCut: false, ultiName: "", script: null, snap: null, ink: null, layer: null, lc: null, panels: [], words: [], tiles: new Map(), disc: null, discW: null, discC: {}, strip: null, stripW: null,
  snapPending: false, tintK: 0.56, ix: 0, iy: 0, broke: false, pt: 0, stat: { n: 0, sum: 0, max: 0, last: 0 }, reduced: false, slow: false, fixed: false, avg: 0, cw: 0, ch: 0, m: 8, bw: 4, page: null, cards: null, flash: [] };
const mgClock = () => (window.__realNow ? window.__realNow() : performance.now());   // the tests step performance.now themselves; this one stays real
function mgRng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function mgCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
const mgTk = (t) => t / FMS;   // the puppets' animation tick (60 per second of page time)
function mgWarn(e) { try { console.warn("Manga finisher failed, using the 2D finisher:", e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e); } catch (x) { /* no console */ } }

/* ---------- ink: fat black outlines, flat tint and cel shading, without touching the fighter drawing code ---------- */
// While a fighter is drawn into the page layer: OUT strokes turn pure ink and get k times heavier (limb outlines, which are a wide stroke under the limb
// colour, grow by a fixed amount instead); every colour the fighter sets is pulled toward the paper (light colours a lot, dark ones not at all, so the ink
// stays black and the skin shows as a weak tint); every gradient turns into hard bands: manga has flat shapes and cut tone, no gradients.
const MG_FS = Object.getOwnPropertyDescriptor(MG_CTX, "fillStyle"), MG_SS = Object.getOwnPropertyDescriptor(MG_CTX, "strokeStyle"), MG_TC = new Map();
function mgTintCss(s, k) {
  const mono = MG.mono, key = mono ? "m" + k + s : k + s;   // mono: the puppet is drawn in greys (mgPuppet's o.mono)
  let v = MG_TC.get(key);
  if (v !== undefined) return v;
  let r, g, b, a = 1, m;
  if (s.charCodeAt(0) === 35 && s.length === 7) { const n = parseInt(s.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  else if (s.charCodeAt(0) === 35 && s.length === 4) { r = parseInt(s[1] + s[1], 16); g = parseInt(s[2] + s[2], 16); b = parseInt(s[3] + s[3], 16); }
  else if ((m = /^rgba?\(([^)]*)\)$/.exec(s))) { const q = m[1].split(","); r = +q[0]; g = +q[1]; b = +q[2]; if (q.length > 3) a = +q[3]; }
  else { MG_TC.set(key, s); return s; }
  const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255, u = clamp((lum - 0.1) / 0.4, 0, 1), w = k * u * u * (3 - 2 * u);
  let R = Math.round(r + (241 - r) * w), G = Math.round(g + (236 - g) * w), B = Math.round(b + (226 - b) * w);
  if (mono) R = G = B = Math.round(R * 0.3 + G * 0.59 + B * 0.11);
  v = `rgba(${R},${G},${B},${a})`;
  MG_TC.set(key, v);
  return v;
}
function mgCel(g) {
  let prev = null, po = 0;
  g.addColorStop = function (o, colr) {
    if (typeof colr === "string") colr = mgTintCss(colr, MG.tintK);
    if (prev === null) MG_GRAD.addColorStop.call(g, o, colr);
    else { const b = po + (o - po) * 0.4; MG_GRAD.addColorStop.call(g, b, prev); MG_GRAD.addColorStop.call(g, b, colr); }
    prev = colr; po = o;
  };
  return g;
}
// hal > 0 draws the halo pass instead: everything flat white, every line widened by 2 * hal (world units), meant for destination-over, behind the picture
function mgInkOn(c, k, hal) {
  Object.defineProperty(c, "fillStyle", { configurable: true, get() { return MG_FS.get.call(this); }, set(v) { MG_FS.set.call(this, hal ? "#ffffff" : typeof v === "string" ? mgTintCss(v, MG.tintK) : v); } });
  Object.defineProperty(c, "strokeStyle", { configurable: true, get() { return MG_SS.get.call(this); }, set(v) { MG_SS.set.call(this, hal ? "#ffffff" : typeof v === "string" ? (v === OUT ? MG_INK : mgTintCss(v, MG.tintK)) : v); } });
  c.stroke = function () {
    const lw = this.lineWidth;
    if (hal) this.lineWidth = (lw <= 4 ? lw * k : lw + 3.5 * (k - 1)) + 2 * hal;
    else if (this.strokeStyle === MG_INK) this.lineWidth = lw <= 4 ? lw * k : lw + 3.5 * (k - 1);
    MG_CTX.stroke.apply(this, arguments);
    this.lineWidth = lw;
  };
  c.createRadialGradient = function () { return mgCel(MG_CTX.createRadialGradient.apply(this, arguments)); };
  c.createLinearGradient = function () { return mgCel(MG_CTX.createLinearGradient.apply(this, arguments)); };
}
function mgInkOff(c) { delete c.stroke; delete c.createRadialGradient; delete c.createLinearGradient; delete c.fillStyle; delete c.strokeStyle; }

/* ---------- cached art: tone tiles, focus disc, speed strips (built once per page, freed at its end) ---------- */
// a 45 degree dot screen: `cover` is the share of the paper the dots cover (0.4 = a 40% screen), `size` the pitch of the tile in css px
function mgTile(size, cover, colr) {
  const key = size + "/" + cover + "/" + (colr || "");
  let p = MG.tiles.get(key);
  if (p) return p;
  const s = Math.max(4, Math.round(size * DPR)), tc = mgCanvas(s, s), x = tc.getContext("2d"), r = Math.sqrt(cover * s * s / (2 * Math.PI));
  x.fillStyle = colr || MG_INK;
  for (const [dx, dy] of [[0, 0], [s / 2, s / 2]]) for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.beginPath(); x.arc(dx + ox, dy + oy, r, 0, Math.PI * 2); x.fill(); }
  p = ctx.createPattern(tc, "repeat"); MG.tiles.set(key, p);
  return p;
}
function mgDrift(pat, dx, dy) { try { if (pat.setTransform) pat.setTransform(new DOMMatrix([1, 0, 0, 1, dx, dy])); } catch (e) { /* no pattern transforms */ } }
// the burst of wedges from one point (focus lines); thin at the centre end, so the middle of the picture stays clear.
// `white`: false = ink, true = white, or a CSS colour string for a disc of that colour (one more cached canvas per colour, MG.discC)
function mgFocusDisc(white) {
  const S = 1024, R = S / 2, c = mgCanvas(S, S), x = c.getContext("2d"), r = mgRng(777);
  x.translate(R, R); x.fillStyle = typeof white === "string" ? white : white ? "#ffffff" : MG_INK;
  for (let i = 0; i < 84; i++) {
    const a = (i / 84) * Math.PI * 2 + (r() - 0.5) * 0.05, hw = (0.3 + r() * 1.2) * Math.PI / 180 * (r() < 0.14 ? 2.4 : 1), rin = R * (0.3 + r() * 0.42);
    x.beginPath(); x.moveTo(Math.cos(a) * rin, Math.sin(a) * rin); x.lineTo(Math.cos(a - hw) * R, Math.sin(a - hw) * R); x.lineTo(Math.cos(a + hw) * R, Math.sin(a + hw) * R); x.closePath(); x.fill();
  }
  return c;
}
// parallel streaks, tileable along x
function mgSpeedStrip(white) {
  const c = mgCanvas(512, 64), x = c.getContext("2d"), r = mgRng(4242);
  x.fillStyle = white ? "#ffffff" : MG_INK;
  for (let i = 0; i < 40; i++) {
    const y = r() * 64, len = 60 + r() * 380, x0 = r() * 512, th = 0.8 + r() * 2.4;
    for (const sh of [0, -512]) { x.beginPath(); x.moveTo(x0 + sh, y); x.lineTo(x0 + sh + len, y - th / 2); x.lineTo(x0 + sh + len, y + th / 2); x.closePath(); x.fill(); }
  }
  return c;
}
// focus lines centred on (cx, cy), reaching out to R css px, turning slowly; the caller clips
// the shared pictures are made when first asked for (or by the queue after the freeze, whichever comes first), so a script never meets a missing one
function mgNeedLayer() { if (!MG.layer) { MG.layer = mgCanvas(MG.cw, MG.ch); MG.lc = MG.layer.getContext("2d"); } }
function mgNeedDisc(white) { if (typeof white === "string") { if (!MG.discC[white]) MG.discC[white] = mgFocusDisc(white); } else if (white) { if (!MG.discW) MG.discW = mgFocusDisc(true); } else if (!MG.disc) MG.disc = mgFocusDisc(false); }
function mgNeedStrip(white) { if (white) { if (!MG.stripW) MG.stripW = mgSpeedStrip(true); } else if (!MG.strip) MG.strip = mgSpeedStrip(false); }
function mgFocus(c, cx, cy, R, rot, alpha, white) {
  mgNeedDisc(white);
  c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.rotate(rot); c.drawImage(typeof white === "string" ? MG.discC[white] : white ? MG.discW : MG.disc, -R, -R, R * 2, R * 2); c.restore();
}
// speed lines in a w x h box centred on (x, y), running along `ang`, scrolling by `off` px; the caller sets the clip if it wants one
function mgSpeed(c, x, y, w, h, ang, off, alpha, white, th) {
  mgNeedStrip(white);
  const strip = white ? MG.stripW : MG.strip, sc = th || 1, sw = 512 * sc, sh = 64 * sc;
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(ang); c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.clip();
  const o = ((off % sw) + sw) % sw;
  for (let ix = -w / 2 - o; ix < w / 2; ix += sw) for (let iy = -h / 2; iy < h / 2; iy += sh) c.drawImage(strip, ix, iy, sw, sh);
  c.restore();
}
// a polygon (css px, as [[x, y], ...]) filled with a dot screen; c must have the css transform (DPR scale) set
function mgToneFill(c, poly, size, cover, drift) {
  const pat = mgTile(size, cover);
  if (drift) mgDrift(pat, drift[0] * DPR, drift[1] * DPR);
  c.save(); c.fillStyle = pat; c.setTransform(1, 0, 0, 1, 0, 0);
  c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x * DPR, y * DPR) : c.moveTo(x * DPR, y * DPR))); c.closePath(); c.fill(); c.restore();
}
const mgPoly = (c, poly) => { c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

/* ---------- lettering: the sound words, drawn once into their own canvas ---------- */
// white letters with a thick black stroke and a second offset stroke (a pen look), every letter rotated a little and nudged off the baseline
// (fixed per word), the whole word on a slight arc. size in css px; o: { seed, arc (radius in word widths), jit, jag, fill, space, weight }
function mgWord(text, o) {
  o = o || {};
  const D = DPR, size = o.size, font = `${o.weight || 900} italic ${size}px "Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  const m = mgCanvas(4, 4).getContext("2d"); m.font = font;
  const chars = [...text], rnd = mgRng(o.seed || 91), sp = size * (o.space === undefined ? 0.05 : o.space);
  const adv = chars.map((ch) => m.measureText(ch).width + sp), tw = adv.reduce((a, b) => a + b, 0), R = tw * (o.arc || 6);
  const cw = tw + size * 1.1, ch_ = size * 1.9, cvs = mgCanvas(cw * D, ch_ * D), x = cvs.getContext("2d");
  x.scale(D, D); x.translate(cw / 2, ch_ / 2); x.font = font; x.textBaseline = "alphabetic"; x.textAlign = "center"; x.lineJoin = "miter"; x.miterLimit = 3;
  let s = -tw / 2;
  chars.forEach((chr, i) => {
    const mid = s + adv[i] / 2; s += adv[i];
    const th = mid / R, px_ = R * Math.sin(th), py_ = R * (1 - Math.cos(th)) - (o.arc ? 0 : 0);
    let rot = th + (rnd() - 0.5) * (o.jit === undefined ? 0.2 : o.jit), dy = (rnd() - 0.5) * 0.18 * size;
    if (o.jag) { rot += (i % 2 ? 1 : -1) * o.jag * (0.5 + rnd() * 0.5); dy += (i % 2 ? 1 : -1) * size * 0.09; }
    x.save(); x.translate(px_, py_ + dy + size * 0.32); x.rotate(rot);
    x.strokeStyle = MG_INK; x.lineWidth = size * 0.3; x.strokeText(chr, size * 0.045, size * 0.05);       // the offset second stroke
    x.lineWidth = size * 0.22; x.strokeText(chr, 0, 0);
    x.fillStyle = o.fill || "#ffffff"; x.fillText(chr, 0, 0);
    x.restore();
  });
  return { cv: cvs, w: cw, h: ch_ };
}
// the script's words. On an upright phone the page is tall and narrow, so a word sized by the page height is far too wide: unless the page sets its own sizes there
// (its words differ between the upright and the wide layout) or sets ownWords = true, every word is scaled to the width (a page that already scales is left alone, never twice).
function mgWordDefs(S) {
  const lay = MG.lay, ws = S.words ? S.words(lay) : [];
  if (!lay.port || S.ownWords === true || !ws.length) return ws;
  let own = false;
  try {
    const wide = S.words(Object.assign({}, lay, { port: false }));
    own = wide.length !== ws.length || wide.some((w, i) => w.size !== ws[i].size || (w.mul || 1) !== (ws[i].mul || 1));
  } catch (e) { own = false; }
  if (own) return ws;
  const k = Math.min(1, L.gw * 0.9 / L.gh);
  return ws.map((w) => Object.assign({}, w, { mul: (w.mul || 1) * k }));
}
// a word instance of the script: { text, t0, t1, size (share of the screen height), at(t) -> [x, y] css px, rot, arc, jag, stretch: { ang, k } }
function mgWordPrep(w) { if (!w.img) { const sz = Math.round(w.size * L.gh * (w.mul || 1)); w.img = mgWord(w.text, { size: sz, seed: w.seed, arc: w.arc, jag: w.jag, jit: w.jit, fill: w.fill, space: w.space }); } }
function mgWordDraw(c, w, t) {
  if (t < w.t0 || t > w.t1) return;
  mgWordPrep(w);
  const u = t - w.t0, k = fe(0, 120, u), slam = 1 + 0.6 * (1 - k) * (1 - k) - 0.07 * Math.sin(k * Math.PI), grow = 1 + 0.06 * fe(0, 1500, u);
  const a = Math.min(1, k * 3) * (1 - fe(w.t1 - 220, w.t1, t)), [x0, y0] = w.at(t);
  const cr = Math.abs(Math.cos(w.rot || 0)), sr = Math.abs(Math.sin(w.rot || 0)), sx_ = 1 + (w.stretch ? w.stretch.k * easeOut(fe(0, w.t1 - w.t0, u)) : 0) * (w.stretch ? Math.abs(Math.cos(w.stretch.ang - (w.rot || 0))) : 0);
  const hw = 0.42 * (w.img.w * cr * sx_ + w.img.h * sr), hh = 0.42 * (w.img.w * sr * sx_ + w.img.h * cr);
  const x = hw * 2 < L.gw ? clamp(x0, hw, L.gw - hw) : L.gw / 2, y = hh * 2 < L.gh ? clamp(y0, hh, L.gh - hh) : L.gh / 2;   // the lettering may cross a border, never the edge of the page
  c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.globalAlpha = a; c.translate(x, y); c.rotate(w.rot || 0);
  if (w.stretch) { const st = w.stretch.k * easeOut(fe(0, w.t1 - w.t0, u)); c.rotate(w.stretch.ang); c.scale(1 + st, 1); c.rotate(-w.stretch.ang); }
  c.scale(slam * grow, slam * grow);
  c.drawImage(w.img.cv, -w.img.w / 2, -w.img.h / 2, w.img.w, w.img.h);
  c.restore();
}

/* ---------- panels ---------- */
// A panel def (from the script, or the engine's own first panel): { id, t0, from: "w" | "l" | "t" | "b" (the side it slides in from; w = the winner's),
//   slide (ms), poly: [[x, y] x4] as shares of the page area drawn for a winner on the left (mirrored when the winner is on the right),
//   cam(t, pn) -> { wx, wy, vh, px, py } (the world point at the panel's centre, the world height the panel shows, a pan in px),
//   draw(c, pn, t), freeze (ms: the panel is drawn once into a bitmap and stays as it was), cover (ms: a later panel covers it from here: it dims),
//   shake(t) -> [dx, dy], live (keep drawing every frame), paper, dim ("r,g,b" of the dimming once covered; ink by default),
//   opaque (a full-page panel: once it has slid in, the panels below it are not drawn any more), before(c, t, pn) (called once, just before the panel's first frame: c holds the page so far) }
function mgPanel(d, idx) {
  const pg = MG.page, mx = (x) => (FIN.dir > 0 ? x : 1 - x);
  const poly = d.poly.map(([fx, fy]) => [pg.x + mx(fx) * pg.w, pg.y + fy * pg.h]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pn = { d, id: d.id, idx, t0: d.t0, slide: d.slide === undefined ? 120 : d.slide, poly, x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    off: [0, 0], ox: 0, oy: 0, z: 1, wx: 0, wy: 0, px: 0, py: 0, cache: null, tears: [], glows: [], pts: [], cum: [], total: 0, k: 0, u: 0 };
  const side = d.from || "w", west = FIN.dir > 0 ? "l" : "r", dirn = side === "w" ? west : side === "l" ? (west === "l" ? "r" : "l") : side;
  pn.off = dirn === "l" ? [-(x1 + 6), 0] : dirn === "r" ? [L.gw - x0 + 6, 0] : dirn === "t" ? [0, -(y1 + 6)] : [0, L.gh - y0 + 6];
  // the hand-drawn border: a polyline that wobbles a pixel or two every ~40 px (seeded by the finisher's random numbers)
  const r = mgRng(((FIN.rnd[idx % FIN.rnd.length] || 0.37) * 1e6) | 0 || 5);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = Math.max(1, Math.round(len / 38)), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    for (let j = 0; j < n; j++) { const q = j / n, o = j === 0 ? 0 : (r() - 0.5) * 2.6; pn.pts.push([a[0] + (b[0] - a[0]) * q + nx * o, a[1] + (b[1] - a[1]) * q + ny * o]); }
  }
  pn.pts.push(pn.pts[0].slice());
  pn.cum.push(0);
  for (let i = 1; i < pn.pts.length; i++) pn.cum.push(pn.cum[i - 1] + Math.hypot(pn.pts[i][0] - pn.pts[i - 1][0], pn.pts[i][1] - pn.pts[i - 1][1]));
  pn.total = pn.cum[pn.cum.length - 1];
  // world <-> panel (css px, in the panel's own frame: the slide and the shake are applied by the engine as a translate)
  pn.p = (wx, wy) => [pn.cx + pn.px + (wx - pn.wx) * pn.z, pn.cy + pn.py + (wy - pn.wy) * pn.z];
  pn.sp = (wx, wy) => { const q = pn.p(wx, wy); return [q[0] + pn.ox, q[1] + pn.oy]; };   // ... as it lands on the screen
  pn.world = (c) => c.setTransform(DPR * pn.z, 0, 0, DPR * pn.z, DPR * (pn.ox + pn.cx + pn.px - pn.wx * pn.z), DPR * (pn.oy + pn.cy + pn.py - pn.wy * pn.z));
  pn.screen = (c) => c.setTransform(DPR, 0, 0, DPR, DPR * pn.ox, DPR * pn.oy);
  pn.camAt = (t) => { const cm = d.cam ? d.cam(t, pn) : { wx: 0, wy: 0, vh: 100 }; return cm; };
  return pn;
}
function mgPlace(pn, t) {
  const d = pn.d, ks = easeOut(fe(pn.t0, pn.t0 + pn.slide, t)), sh = d.shake && !MG.reduced ? d.shake(t) : [0, 0];
  pn.ox = pn.off[0] * (1 - ks) + sh[0]; pn.oy = pn.off[1] * (1 - ks) + sh[1];
  pn.u = t - pn.t0;
  const cm = pn.camAt(t);
  pn.wx = cm.wx; pn.wy = cm.wy; pn.px = cm.px || 0; pn.py = cm.py || 0; pn.z = pn.h / cm.vh;
}
function mgDrawPanel(c, pn, t) {
  const D = DPR, d = pn.d;
  mgPlace(pn, t);
  c.save();
  c.setTransform(D, 0, 0, D, D * pn.ox, D * pn.oy);
  mgPoly(c, pn.poly); c.clip();
  c.fillStyle = d.paper || MG_PAPER; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4);
  d.draw(c, pn, t);
  c.restore();
  c.save(); c.setTransform(D, 0, 0, D, D * pn.ox, D * pn.oy); mgBorder(c, pn, t); c.restore();
}
function mgPanelFrame(c, pn, t) {
  const d = pn.d, D = DPR;
  if (d.freeze !== undefined && t >= d.freeze) {
    if (!pn.cache) { const cc = mgCanvas(MG.cw, MG.ch), x = cc.getContext("2d"); mgDrawPanel(x, pn, d.freeze); pn.cache = cc; }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    const bx = Math.max(0, Math.floor((pn.x0 - 10) * D)), by = Math.max(0, Math.floor((pn.y0 - 10) * D)), bw = Math.min(MG.cw - bx, Math.ceil((pn.w + 20) * D)), bh = Math.min(MG.ch - by, Math.ceil((pn.h + 20) * D));
    c.drawImage(pn.cache, bx, by, bw, bh, bx, by, bw, bh);
    c.restore();
  } else mgDrawPanel(c, pn, t);
  // the page fills up: a panel that a later one covers is dimmed
  if (d.cover !== undefined && t > d.cover) {
    const a = 0.2 * fe(d.cover, d.cover + 200, t);
    c.save(); c.setTransform(D, 0, 0, D, D * pn.ox, D * pn.oy); c.fillStyle = `rgba(${d.dim || "11,10,18"},${a.toFixed(3)})`; mgPoly(c, pn.poly); c.fill(); c.restore();
  }
}
// the border draws itself over 160 ms; tears are gaps with jagged ends where a body burst through; a glow is the ink going accent, then cooling
function mgBorder(c, pn, t) {
  const prog = fe(pn.t0, pn.t0 + 160, t), end = prog * pn.total;
  if (end <= 0) return;
  const bw = pn.d.bw || MG.bw;
  // the runs of the perimeter that are drawn: [0, end] minus the tears
  let runs = [[0, end]];
  for (const tr of pn.tears) { const nr = []; for (const [a, b] of runs) { if (tr.b <= a || tr.a >= b) nr.push([a, b]); else { if (tr.a > a) nr.push([a, tr.a]); if (tr.b < b) nr.push([tr.b, b]); } } runs = nr; }
  const pts = pn.pts, cum = pn.cum;
  const trace = (a, b) => {
    let i = 1; while (i < cum.length && cum[i] < a) i++;
    const at = (s, j) => { const q = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1); return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * q, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * q]; };
    const s0 = at(a, Math.min(i, cum.length - 1)); c.moveTo(s0[0], s0[1]);
    for (; i < cum.length && cum[i] <= b; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (i < cum.length) { const e = at(b, i); c.lineTo(e[0], e[1]); }
  };
  c.lineJoin = "miter"; c.miterLimit = 4; c.lineCap = "butt";
  c.strokeStyle = MG_INK; c.lineWidth = bw; c.beginPath();
  for (const [a, b] of runs) if (b - a > 0.5) trace(a, b);
  c.stroke();
  for (const g of pn.glows) {
    const a = 1 - fe(g.t0, g.t0 + g.dur, t);
    if (a <= 0 || t < g.t0) continue;
    c.strokeStyle = rgba(g.col, a); c.lineWidth = bw * 1.5; c.beginPath(); trace(Math.max(0, g.a - 120), Math.min(pn.total, g.b + 120)); c.stroke();
  }
  // the torn ends: a zigzag of ink reaching into the gap
  for (const tr of pn.tears) {
    c.strokeStyle = MG_INK; c.lineWidth = bw * 0.8; c.beginPath();
    for (const [s, sgn] of [[tr.a, 1], [tr.b, -1]]) {
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const q = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), x0 = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * q, y0 = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * q;
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl * sgn, uy = dy / dl * sgn;
      c.moveTo(x0, y0);
      for (let j = 1; j <= 4; j++) { const off = (j % 2 ? 1 : -1) * (3 + tr.j[j] * 5), len = j * (3.2 + tr.j[0] * 4); c.lineTo(x0 + ux * len - uy * off, y0 + uy * len + ux * off); }
    }
    c.stroke();
  }
}
// a body crossing a panel's border: the tear (gap + jagged ends) and a glow of the effect's colour where the ink burned
function mgTear(pn, sx, sy, wdt, t, glowCol) {
  // the nearest point of the border to (sx, sy), in the panel's frame
  let best = 1e9, bs = 0;
  for (let i = 1; i < pn.pts.length; i++) {
    const ax = pn.pts[i - 1][0], ay = pn.pts[i - 1][1], bx = pn.pts[i][0], by = pn.pts[i][1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const q = clamp(((sx - ax) * dx + (sy - ay) * dy) / l2, 0, 1), d = Math.hypot(ax + dx * q - sx, ay + dy * q - sy);
    if (d < best) { best = d; bs = pn.cum[i - 1] + (pn.cum[i] - pn.cum[i - 1]) * q; }
  }
  const half = wdt / 2, a = Math.max(0, bs - half), b = Math.min(pn.total, bs + half), r = mgRng(31337);
  pn.tears.push({ a, b, t0: t, j: [r(), r(), r(), r(), r()] });
  if (glowCol) pn.glows.push({ a, b, t0: t, dur: 300, col: glowCol });
}

/* ---------- a fighter drawn into a panel: fat ink, paper tint, cut tone ---------- */
// o: { sc (scale about the feet), halo (css px of white edge), under (lc, p) (art behind the fighter, inked like it), box ([l, t, r, b] world units about the feet that the drawing may cover), free (not cut to the panel), a (alpha), sil ("#fff" | "#000": a flat silhouette), tint, light (angle the light comes from), wash: [hex, alpha],
//      post(lc, X) (extra source-atop art in device px: X = { sx, sy, z } is the feet and the device px per world unit), tone (false: no dots), k (ink), mono (every colour grey) }
function mgPuppet(c, pn, p, tt, o) {
  o = o || {};
  const D = DPR, sc = o.sc || 1, ze = pn.z * sc, [sx, sy] = pn.p(p.x, p.y), bq = o.box || MG_BOX;
  // the box the fighter can cover (world units about its feet: left, top, right, bottom; o.box widens it for a long spear), cut to the panel (the panel clips it anyway) when drawn into the page, not when drawn into the overlay or when o.free says so
  let x0 = sx + pn.ox + bq[0] * ze, y0 = sy + pn.oy + bq[1] * ze, x1 = sx + pn.ox + bq[2] * ze, y1 = sy + pn.oy + bq[3] * ze;
  if (!(o.free === undefined ? c !== ctx : o.free)) { x0 = Math.max(x0, pn.x0 + pn.ox - 2); x1 = Math.min(x1, pn.x1 + pn.ox + 2); y0 = Math.max(y0, pn.y0 + pn.oy - 2); y1 = Math.min(y1, pn.y1 + pn.oy + 2); }
  const bx = Math.max(0, Math.floor(x0 * D)), by = Math.max(0, Math.floor(y0 * D)), bw = Math.min(MG.cw - bx, Math.ceil((x1 - x0) * D) + 1), bh = Math.min(MG.ch - by, Math.ceil((y1 - y0) * D) + 1);
  if (bw <= 2 || bh <= 2) return;
  mgNeedLayer();
  const lc = MG.lc, k = o.k || clamp(10 / (2.5 * ze), 1, 2.2);
  lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(bx, by, bw, bh);
  lc.save(); lc.beginPath(); lc.rect(bx, by, bw, bh); lc.clip();
  lc.setTransform(D * ze, 0, 0, D * ze, D * (sx + pn.ox), D * (sy + pn.oy));
  MG.pt = tt; MG.tintK = o.tint === undefined ? 0.56 : o.tint; MG.mono = !!o.mono;
  if (o.flash) p.flash = 2;
  mgInkOn(lc, k);
  try {
    if (o.under) { lc.save(); lc.scale(p.facing, 1); o.under(lc, p); lc.restore(); }   // art behind the fighter that goes through the same ink (the Dragon's big wings), in the fighter's own units
    drawFighter(lc, p, mgTk(tt), [0, 0]);
  } finally { mgInkOff(lc); p.flash = 0; }
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = "source-atop";
  if (o.sil) { lc.fillStyle = o.sil; lc.fillRect(bx, by, bw, bh); }
  else {
    if (o.tone !== false && !MG.slow) mgToneBands(lc, (sx + pn.ox) * D, (sy + pn.oy - 33 * ze) * D, 40 * ze * D, o.light === undefined ? -2.3 : o.light, ze >= 2.2 ? 12 : 8);
    if (o.wash) { lc.fillStyle = rgba(o.wash[0], o.wash[1]); lc.fillRect(bx, by, bw, bh); }
    if (o.post) o.post(lc, { sx: (sx + pn.ox) * D, sy: (sy + pn.oy) * D, z: ze * D, ze, bx, by, bw, bh });
  }
  lc.globalCompositeOperation = "source-over";
  lc.restore();
  const a0 = o.a === undefined ? 1 : o.a;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = a0;
  if (o.ghosts) {   // earlier positions, as copies of this same picture: [dx, dy (css px), alpha]
    for (const g of o.ghosts) { c.globalAlpha = g[2] * a0; c.drawImage(MG.layer, bx, by, bw, bh, bx + Math.round(g[0] * D), by + Math.round(g[1] * D), bw, bh); }
    c.globalAlpha = a0;
  }
  if (o.halo && !o.sil) {   // a white edge round the shape (a black fighter on a dark panel stays readable): the fighter once more, flat white with wide lines, drawn behind its own picture
    lc.save(); lc.beginPath(); lc.rect(bx, by, bw, bh); lc.clip();
    lc.globalCompositeOperation = "destination-over";
    lc.setTransform(D * ze, 0, 0, D * ze, D * (sx + pn.ox), D * (sy + pn.oy));
    mgInkOn(lc, k, o.halo / ze);
    try {
      if (o.under) { lc.save(); lc.scale(p.facing, 1); o.under(lc, p); lc.restore(); }
      drawFighter(lc, p, mgTk(tt), [0, 0]);
    } finally { mgInkOff(lc); }
    lc.restore();
  }
  c.drawImage(MG.layer, bx, by, bw, bh, bx, by, bw, bh);
  c.restore();
}
// two tone bands on the side away from the light: a 40% screen from just past the middle, a 70% screen near the edge (device px, over source-atop)
function mgToneBands(lc, cx, cy, R, lightAng, tile) {
  const sdx = Math.cos(lightAng + Math.PI), sdy = Math.sin(lightAng + Math.PI), px_ = -sdy, py_ = sdx, B = R * 5;
  for (const [d, cover] of [[0.12 * R, 0.4], [0.62 * R, 0.7]]) {
    const bx = cx + sdx * d, by = cy + sdy * d;
    lc.fillStyle = mgTile(tile, cover);
    lc.beginPath(); lc.moveTo(bx + px_ * B, by + py_ * B); lc.lineTo(bx - px_ * B, by - py_ * B); lc.lineTo(bx - px_ * B + sdx * B, by - py_ * B + sdy * B); lc.lineTo(bx + px_ * B + sdx * B, by + py_ * B + sdy * B); lc.closePath(); lc.fill();
  }
}
// the freeze: the picture is inked once (paper tint, dots in the dark areas: a 70% screen where it is darkest, a 40% screen in the middle tones).
// One readback of a half-size copy, now, not per frame. It runs as three small tasks (mgWork) so no single frame pays for all of it.
function mgInkA() {
  const W = MG.cw, H = MG.ch, ik = mgCanvas(W, H), x = ik.getContext("2d");
  x.drawImage(MG.snap, 0, 0);
  x.fillStyle = "rgba(241,236,226,0.45)"; x.fillRect(0, 0, W, H);
  const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1), sm = mgCanvas(hw, hh), sx = sm.getContext("2d");
  sx.drawImage(MG.snap, 0, 0, hw, hh);
  let id = null;
  try { id = sx.getImageData(0, 0, hw, hh); } catch (e) { id = null; }
  MG.inkS = { ik, x, hw, hh, id };
}
function mgInkB() {
  const S = MG.inkS, hw = S.hw, hh = S.hh, dark = mgCanvas(hw, hh), mid = mgCanvas(hw, hh);
  if (S.id) {
    const d = S.id.data, dk = new ImageData(hw, hh), md = new ImageData(hw, hh);
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      if (lum < 0.3) dk.data[i + 3] = 255; else if (lum < 0.52) md.data[i + 3] = 255;
    }
    dark.getContext("2d").putImageData(dk, 0, 0); mid.getContext("2d").putImageData(md, 0, 0);
  } else { const mx = mid.getContext("2d"); mx.fillStyle = "#000"; mx.fillRect(0, 0, hw, hh); }
  S.id = null; S.dark = dark; S.mid = mid;
}
function mgInkC(which) {
  const S = MG.inkS, W = MG.cw, H = MG.ch, mask = which ? S.dark : S.mid, tl = mgCanvas(W, H), t = tl.getContext("2d");
  t.fillStyle = mgTile(8, which ? 0.7 : 0.4); t.fillRect(0, 0, W, H);
  t.globalCompositeOperation = "destination-in"; t.imageSmoothingEnabled = true; t.drawImage(mask, 0, 0, W, H);
  S.x.drawImage(tl, 0, 0);
  if (which) { MG.ink = S.ik; MG.inkOK = true; MG.inkT = MG.pt; MG.inkS = null; }
}

/* ---------- building the page (at the freeze) ---------- */
// panel 1 is the engine's own: the real hit, frozen and inked, the whole page
function mgFirstPanel() { return { id: "hit", t0: MT.FREEZE, slide: 0, live: true, poly: [[0, 0], [1, 0], [1, 1], [0, 1]], draw: mgDrawHit }; }
// THE HOOK for an Ultimate page's splash (panel 5): one full-page panel at MT.SPLASH that slides in over the page in 180 ms, opaque (nothing below it is drawn once it is in),
// frozen into a bitmap when the aftermath panel arrives (MT.AFTER) and dimmed under it. A page's Ultimate script returns it from panels(lay) (the order of the list is
// the order of drawing: ...strike, splash, aftermath) and fills in o: from ("t" | "b"), paper (the page's paper colour), cam(t, pn), draw(c, pn, t), and any panel field
// (before, shake, dim, slide, freeze...). The slide direction is a share of the whole page, so on the upright layout it needs no change.
function mgSplashPanel(o) {
  return Object.assign({ id: "splash", t0: MT.SPLASH, from: "b", slide: 180, opaque: true, live: true, freeze: MT.AFTER, cover: MT.AFTER, poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }, o);
}
function mgDrawHit(c, pn, t) {
  const ink = MG.inkOK ? easeOut(fe(MT.FREEZE + 30, MT.INKED - 40, t)) : 0, life = easeOut(fe(MT.FREEZE, MT.END, t)), s = 1 + 0.07 * life, ix = MG.ix, iy = MG.iy;
  c.save(); c.translate(ix, iy); c.scale(s, s); c.translate(-ix, -iy);
  if (ink < 1) c.drawImage(MG.snap, 0, 0, L.gw, L.gh);
  if (ink > 0) { c.globalAlpha = ink; c.drawImage(MG.ink, 0, 0, L.gw, L.gh); }
  c.restore();
  if (ink > 0) { const R = Math.hypot(Math.max(ix, L.gw - ix), Math.max(iy, L.gh - iy)); mgFocus(c, ix, iy, R, t * 0.00035, 0.9 * ink); }
}
// at the freeze: the screen is copied (cheap) and a queue of small build tasks is set up; mgWork runs them one or two per frame while the first panel holds
function mgSnapshot() {
  const S = MG.script, gw = L.gw, gh = L.gh;
  MG.snap = mgCanvas(cv.width, cv.height); MG.snap.getContext("2d").drawImage(cv, 0, 0);
  MG.ink = MG.snap; MG.inkOK = false;   // until the inked copy is done, a page that draws MG.ink gets the plain picture
  const ev = FIN.ev, d = FIN.P[FIN.l], q = ev ? toScreen(ev.x, ev.y - d.s.h * 0.5) : [gw / 2, gh / 2];
  MG.ix = clamp(q[0], gw * 0.2, gw * 0.8); MG.iy = clamp(q[1], gh * 0.25, gh * 0.75);
  MG.cw = cv.width; MG.ch = cv.height;
  MG.m = clamp(Math.min(gw, gh) * 0.026, 6, 16); MG.bw = clamp(Math.min(gw, gh) * 0.0105, 3, 9);
  MG.page = { x: MG.m, y: MG.m, w: gw - 2 * MG.m, h: gh - 2 * MG.m };
  MG.lay = { port: L.portrait, dir: FIN.dir, m: MG.m, page: MG.page, gw, gh };
  // the script's panels, words and build() are made right now, so every hook of the script (step, over, cues...) finds them; the heavy canvas work is queued below
  MG.panels = [mgFirstPanel()].concat(S.panels(MG.lay)).map((dd, i) => mgPanel(dd, i));
  MG.byId = {}; for (const pn of MG.panels) MG.byId[pn.id] = pn;
  MG.words = mgWordDefs(S).map((w, i) => Object.assign({ seed: 91 + i * 17 }, w));
  if (MG.ulti) for (const w of MG.words) if (w.t0 >= FIN.hit && !w.fill) w.fill = MG_GOLD;   // the Ultimate's strike words are gold unless the page colours them itself
  if (S.build) S.build(MG.lay);
  MG.todo = [
    () => { mgNeedLayer(); mgNeedDisc(false); },
    () => { mgNeedDisc(true); mgNeedStrip(false); mgNeedStrip(true); },
    mgInkA, mgInkB, () => mgInkC(0), () => mgInkC(1),
  ];
  MG.todo.push(() => { for (const w of MG.words.slice(0, 2)) mgWordPrep(w); }, () => { for (const w of MG.words.slice(2, 4)) mgWordPrep(w); }, () => { for (const w of MG.words.slice(4)) mgWordPrep(w); }, mgCardPrep);
}
function mgWork(t) {
  let n = t > 1000 ? 99 : 1;
  while (n-- > 0 && MG.todo.length) MG.todo.shift()();
}

/* ---------- start, tick, draw, end ---------- */
function mangaStart(g) {
  const W = g.fighters[FIN.w], base = MANGA[W.spec.id];
  if (!base) return false;
  // an Ultimate KO (FIN.ulti, from the lethal event): a page with its own Ultimate cut plays that script on the long timeline, the others play their normal page plus the gold layer
  const ulti = !!FIN.ulti, cut = ulti && !!base.ulti, S = cut ? base.ulti : base;
  try {
    Object.assign(MT, cut ? MT_U : MT_N);
    MG.ulti = ulti; MG.ultiCut = cut; MG.ultiName = ulti && W.spec.ultimate ? W.spec.ultimate.name : "";
    MG.script = S; MG.snap = MG.ink = MG.layer = MG.lc = MG.disc = MG.discW = MG.strip = MG.stripW = null; MG.discC = {}; MG.panels = []; MG.words = []; MG.tiles.clear(); MG.flash = [];
    MG.snapPending = false; MG.broke = false; MG.pt = 0; MG.todo = []; MG.inkS = null; MG.cards = null; MG.stat = { n: 0, sum: 0, max: 0, last: 0 };
    MG.reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    MG.slow = PERF.q >= 2 || window.__mangaSlow === true; MG.fixed = window.__mangaSlow !== undefined; MG.avg = 0; MG.gap = 16.7; MG.lw = 0;   // the tests pin the tier with window.__mangaSlow; otherwise a slow device drops to the cheap tier
    if (S.start) S.start(g);
    FIN.hit = S.hit || MT.HIT; FIN.launch = S.pop || FIN.hit + FLAUNCH;
    if (ulti) FIN.launch = Math.max(FIN.launch, FIN.hit + 150);   // the launch waits for the third (gold) impact frame
    FIN.endT = MT.END;   // (read by the tests: the page's length)
    FIN.kit = { col: S.col, step() {}, pose: () => null, draw() {} };
    FIN.cardSub = ulti ? `Ultimate: ${cut ? S.name : MG.ultiName || S.name}` : FIN.ev && FIN.ev.fin ? `${W.spec.signature.name} finish` : `Final chapter: ${S.name}`;
    FIN.mgStat = MG.stat;
    for (const p of FIN.P) if (p) { p.mk = {}; p.doomed = false; p.finPose = (P, sk) => mgPose(p, P, sk); }   // the doomed flag (a copy on the stand-in) would make the drawing blink as intangible
    MG.on = true;
    return true;
  } catch (e) { MG.on = false; mgWarn(e); return false; }
}
// the puppets' skeletons come from the script (MG.pt is the page time of the picture being drawn: smears draw earlier moments)
function mgPose(p, P, sk) { return MG.script.pose(P, sk, MG.pt, p.finRole, p) || null; }
function mangaTick(g, t, k) {
  if (t >= MT.END) { finEnd(); return g; }
  if (t < MT.FREEZE) return g;
  try {
    if (!FIN.cut) {   // the freeze: the real hit stops here
      FIN.cut = true; fx.length = 0; sfx.length = 0; clearTrails(); combos.fill(null);
      hideBanner(); fxHitOff(); $("hud").hidden = true; $("ctl").hidden = true; releaseTouch();
      if (L.panel) { finFull = true; resize(); }
      MG.snapPending = true;
      Cin.go(() => Cin.dipGame(0.1, 0.2));
      return g;   // this frame is the real game once more; mangaDraw takes the picture
    }
    if (MG.snapPending) return g;
    fx.length = 0; sfx.length = 0;
    const S = MG.script, W = FIN.P[FIN.w], Lp = FIN.P[FIN.l];
    W.x = FIN.wx; W.y = 0;
    MG.pt = t;
    S.step(t, k);
    mgSetCam(t);
    const lf = Math.max(0, (t - FIN.launch) / FMS), trav = finTrav(lf);
    finLoser(Lp, t, lf, trav);
    if (S.after) S.after(t);
    mgBreak(t);
    W.st++; Lp.st++;
    for (const p of FIN.parts) {
      if (p.delay > 0) { p.delay -= k; continue; }
      p.t += k; p.vy += p.g * k; p.vx *= Math.pow(p.drag, k); p.vy *= Math.pow(p.drag, k);
      p.wx += p.vx * k; p.wy += p.vy * k; p.r = Math.max(0.5, p.r + p.grow * k); p.rot += p.vr * k;
    }
    for (let i = FIN.parts.length - 1; i >= 0; i--) if (FIN.parts[i].t >= FIN.parts[i].life) FIN.parts.splice(i, 1);
    mgCues(t);
  } catch (e) { mangaBail(e); return g; }
  return { fighters: FIN.P, projs: [], hitstop: 0, phase: "end", t: g.t };
}
// the flight panel's camera, handed to the global one so finLoser/finOut (finisher.js) project the loser exactly as the panel does
function mgSetCam(t) {
  const pn = MG.byId[MG.script.flight];
  if (!pn) return;
  mgPlace(pn, t);
  cam.z = pn.z; cam.x = pn.wx - (pn.cx + pn.px + pn.ox - L.gw / 2) / pn.z; cam.y = pn.wy - (pn.cy + pn.py + pn.oy - L.gh / 2) / pn.z; cam.sx = 0; cam.sy = 0; FIN.k = pn.z;
}
// the loser reaches the border of the flight panel: it tears, the ink glows in the effect's colour, and from then on the loser is drawn over the whole page
function mgBreak(t) {
  if (MG.broke || FIN.out || t < FIN.launch) return;
  const pn = MG.byId[MG.script.flight], Lp = FIN.P[FIN.l];
  if (!pn) return;
  const [sx, sy] = pn.p(Lp.x, Lp.y - Lp.s.h * 0.5), r = Lp.s.h * 0.42 * pn.z;
  let inside = true, dmin = 1e9;
  for (let i = 0; i < pn.poly.length; i++) {
    const a = pn.poly[i], b = pn.poly[(i + 1) % pn.poly.length], ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1;
    const sd = ((sx - a[0]) * ey - (sy - a[1]) * ex) / el;   // signed distance; the sign of an inside point depends on the winding
    pn._wind = pn._wind || (((pn.poly[1][0] - pn.poly[0][0]) * (pn.poly[2][1] - pn.poly[1][1]) - (pn.poly[1][1] - pn.poly[0][1]) * (pn.poly[2][0] - pn.poly[1][0])) > 0 ? 1 : -1);
    const d = -sd * pn._wind;
    if (d < 0) inside = false;
    dmin = Math.min(dmin, d);
  }
  if (!inside || dmin < r) { MG.broke = true; MG.brokeT = t; mgTear(pn, sx, sy, Lp.s.w * pn.z * 2.4, t, MG.ulti ? MG_GOLD : MG.script.col); }
}
function mangaDraw(g, tk) {
  const t0 = mgClock();
  try {
    if (FIN.t < MT.FREEZE || !FIN.cut) { render2D(g, tk); return; }
    if (MG.snapPending) { render2D(g, tk); mgSnapshot(); MG.snapPending = false; }
    else if (cv.width !== MG.cw || cv.height !== MG.ch) throw new Error("the screen was resized during the page");
    mgPage(ctx, FIN.t);
    mgWork(FIN.t);
  } catch (e) { mangaBail(e); render2D(g, tk); }
  const ms = mgClock() - t0;
  if (MG.snap) { const s = MG.stat; s.n++; s.sum += ms; s.last = ms; if (ms > s.max) s.max = ms; }
}
function mgPage(c, t) {
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
  c.fillStyle = MG_PAPER; c.fillRect(0, 0, L.gw, L.gh);
  const PN = MG.panels; let from = 0;
  for (let i = 1; i < PN.length && t >= PN[i].t0; i++) if (PN[i].d.opaque && t >= PN[i].t0 + PN[i].slide) from = i;   // a full-page panel that is in covers everything below it
  for (let i = from; i < PN.length; i++) {
    const pn = PN[i];
    if (t < pn.t0) break;
    if (pn.d.before && !pn.grabbed) { pn.grabbed = true; pn.d.before(c, t, pn); }
    mgPanelFrame(c, pn, t);
  }
  if (MG.script.page) MG.script.page(c, t);   // a last pass over the whole page (the Reaper's page turns into a negative here)
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
}
// anything thrown while the page plays: the 2D finisher takes over from its own start (the results always follow)
function mangaBail(e) {
  mgWarn(e);
  const id = FIN.P[FIN.w] ? FIN.P[FIN.w].spec.id : "phoenix";
  mangaEnd();
  FIN.t = FT.CUT - 1; FIN.cut = false; FIN.cue = {}; FIN.parts.length = 0; FIN.flashes.length = 0; FIN.trail.length = 0; FIN.beam = null; FIN.out = false; FIN.lastIn = null;
  FIN.hit = FT.HIT; FIN.launch = FLAUNCH_T; FIN.kit = FINS[id] || FINS.phoenix; FIN.cardSub = "";
  for (const p of FIN.P) if (p) { p.finPose = (P, sk) => finPose(p, P, sk); p.mk = null; p.flash = 0; p.state = "fin"; }
  if (FIN.P[FIN.l]) { FIN.P[FIN.l].x = FIN.lx; FIN.P[FIN.l].y = 0; }
  fxHitOff(); try { cam.sx = cam.sy = 0; } catch (x) { /* ok */ }
}
function mangaEnd() {
  FIN.manga = false; MG.on = false;
  try { if (MG.script && MG.script.end) MG.script.end(); } catch (e) { /* a script that cannot tidy up */ }
  for (const pn of MG.panels) pn.cache = null;
  MG.snap = MG.ink = MG.layer = MG.lc = MG.disc = MG.discW = MG.strip = MG.stripW = MG.l2 = MG.l2c = null; MG.discC = {}; MG.panels = []; MG.words = []; MG.tiles.clear(); MG.flash = []; MG.todo = []; MG.inkS = null; MG.cards = null;
  try { Cin.drone(false); Cin.close(); } catch (e) { /* sound off */ }
}
function mangaFinish() {
  if (!FIN.on) return;
  FIN.skipAt = performance.now();
  mangaEnd();
  finEnd();
}

/* ---------- sound cues every page shares (a script adds its own in cues(t)) ---------- */
function mgCues(t) {
  const S = MG.script, H0 = FIN.hit;
  cueOnce("brush0", MT.FREEZE + 40, () => Cin.go(() => Cin.brush()));
  cueOnce("drone", 600, () => Cin.go(() => Cin.drone(true)));
  MG.panels.forEach((pn, i) => { if (!i) return; cueOnce("page" + i, pn.t0, () => Cin.go(() => Cin.page())); cueOnce("pbr" + i, pn.t0 + 60, () => Cin.go(() => Cin.brush())); });
  MG.words.forEach((w, i) => cueOnce("word" + i, w.t0, () => Cin.go(() => Cin.stamp(w.size > 0.12 ? 1 : 0.55))));
  cueOnce("drop", H0 - 120, () => Cin.go(() => Cin.drop(0.1)));
  cueOnce("taiko", H0, () => Cin.go(() => { Cin.taiko(1); Cin.impact(0.8); }));
  cueOnce("cardDrone", MT.CARD, () => Cin.go(() => Cin.drone(false)));
  if (MG.ulti) cueOnce("gold", H0 + 100, () => Cin.go(() => { Cin.taiko(0.6); Cin.chime(1568); }));   // the third impact frame, the gold one
  cueOnce("seal", MT.SEAL, () => Cin.go(() => { Cin.stamp(1.2); Cin.sub(70, 34, 0.3, 0.4); if (MG.ulti) Cin.chime(1568); }));
  if (S.cues) S.cues(t);
}

/* ---------- the layer over the page: unclipped things, words, impact frames, the title block, the fade ---------- */
function mangaOverlay(o, tk) {
  const t = FIN.t, D = DPR, t0 = mgClock();
  try {
    o.save(); o.setTransform(D, 0, 0, D, 0, 0); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
    if (t < MT.FREEZE || !MG.snap) {   // the real hit: the black bars slide in as today
      const bar = easeOut(fe(0, 240, t)) * L.gh * 0.11;
      o.fillStyle = "#05050b"; o.fillRect(0, 0, L.gw, bar); o.fillRect(0, L.gh - bar, L.gw, bar);
      o.restore(); return;
    }
    const S = MG.script, fl = (1 - fe(MT.FREEZE, MT.FREEZE + 130, t)) * (MG.reduced ? 0.25 : 0.9);
    if (S.over) S.over(o, t);
    for (const w of MG.words) mgWordDraw(o, w, t);
    mgLoserOver(o, t);
    if (t >= FIN.launch) finScene(o, t);
    mgBeam(o, t);
    mgImpact(o, t);
    for (const f of MG.flash) { const a = f.a * (1 - fe(f.t0, f.t0 + f.dur, t)); if (t >= f.t0 && a > 0.01) { o.fillStyle = `rgba(255,252,244,${a.toFixed(3)})`; o.fillRect(0, 0, L.gw, L.gh); } }
    if (fl > 0.01) { o.fillStyle = `rgba(255,252,244,${fl.toFixed(3)})`; o.fillRect(0, 0, L.gw, L.gh); }
    if (t >= MT.CARD) mgCard(o, t);
    if (t > MT.SKIP && t < MT.FADE) {
      o.font = `600 ${Math.round(clamp(MG.m * 1.05, 9, 12))}px system-ui, sans-serif`; o.textAlign = "right"; o.textBaseline = "middle";
      o.fillStyle = S.hint ? S.hint(t) : "rgba(30,28,40,0.55)"; o.fillText(touchUI ? "Tap to skip" : "Click or press a key to skip", L.gw - MG.m - 4, L.gh - MG.m * 0.5);
    }
    const fade = fe(MT.FADE, MT.END, t);
    if (fade > 0) { o.fillStyle = `rgba(14,16,34,${(0.9 * fade).toFixed(3)})`; o.fillRect(0, 0, L.gw, L.gh); }
    o.restore();
  } catch (e) { try { o.restore(); } catch (x) { /* ok */ } mangaBail(e); }
  if (MG.snap) {   // the page's drawing time counts both layers; a device that cannot keep up drops the smears and the tone on the fighters (the cheap tier)
    const st = MG.stat, ms = mgClock() - t0; st.sum += ms; st.last += ms; if (st.last > st.max) st.max = st.last;
    MG.avg = MG.avg * 0.9 + st.last * 0.1;
    // the browser's own pace counts too: on a GPU the drawing calls return at once and the work lands later, so the gap between frames is the honest number
    const wall = performance.now();   // (the game's clock; the tests step it)
    if (MG.lw) MG.gap = MG.gap * 0.9 + clamp(wall - MG.lw, 0, 120) * 0.1;
    MG.lw = wall;
    if (!MG.fixed && !MG.slow && st.n > 30 && (MG.avg > 11 || MG.gap > 36)) MG.slow = true;
  }
}
// the loser, once it has burst through its panel's border, is drawn over the whole page
function mgLoserOver(o, t) {
  const S = MG.script, pn = MG.byId[S.flight];
  if (!MG.broke || !pn || !S.drawLoser) return;
  S.drawLoser(o, pn, t);
}
// the KO beam where the loser left the screen: an ink wedge with a white core, a white star-burst, fries
function mgBeam(o, t) {
  const bm = FIN.beam;
  if (!bm) return;
  const bt = (t - bm.t0) / FMS;
  if (bt < 0 || bt > 50) return;
  const x = bm.sx, y = bm.sy, ang = Math.atan2(-FIN.ldy, -FIN.ldx), len = Math.max(L.gw, L.gh) * 0.55 * (0.5 + 0.5 * easeOut(Math.min(1, bt / 8))), a = 1 - bt / 50, wd = Math.min(L.gw, L.gh) * 0.13 * (bt < 6 ? bt / 6 : a);
  o.save(); o.translate(x, y); o.rotate(ang);
  o.fillStyle = MG_INK; o.beginPath(); o.moveTo(-10, -wd); o.lineTo(len, 0); o.lineTo(-10, wd); o.closePath(); o.fill();
  o.fillStyle = "#ffffff"; o.beginPath(); o.moveTo(-10, -wd * 0.4); o.lineTo(len * 0.7, 0); o.lineTo(-10, wd * 0.4); o.closePath(); o.fill();
  o.restore();
  // the star-burst at the edge
  const sb = easeOut(Math.min(1, bt / 9)) * (1 - fe(10, 30, bt)), R = Math.min(L.gw, L.gh) * 0.36 * sb;
  if (R > 2) mgStarburst(o, x, y, R, 0.4);
  if (bm.fries) for (const fr of bm.fries) {
    const d = fr.sp * bt, fx_ = x + Math.cos(ang + fr.da) * d, fy_ = y + Math.sin(ang + fr.da) * d;
    o.save(); o.translate(fx_, fy_); o.rotate(fr.rot + fr.vr * bt); o.globalAlpha = Math.min(1, a * 1.4);
    o.fillStyle = MG_PAPER; o.strokeStyle = MG_INK; o.lineWidth = 2; o.beginPath(); o.roundRect(-fr.len / 2, -2.5, fr.len, 5, 1.5); o.fill(); o.stroke(); o.restore();
  }
}
// a spiky white burst with an ink edge (n points)
function mgStarburst(o, x, y, R, rot) {
  const n = 14;
  o.save(); o.translate(x, y); o.rotate(rot); o.beginPath();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? R * 0.42 : R * (0.85 + 0.15 * ((i * 7919) % 5) / 4), a = (i / (n * 2)) * Math.PI * 2; i ? o.lineTo(Math.cos(a) * r, Math.sin(a) * r) : o.moveTo(r, 0); }
  o.closePath(); o.fillStyle = "#ffffff"; o.fill(); o.lineWidth = Math.max(2, R * 0.04); o.lineJoin = "miter"; o.strokeStyle = MG_INK; o.stroke(); o.restore();
}
// the impact frames (50 ms each): the scene as white silhouettes on black, then black silhouettes on white with the rays; an Ultimate adds a third, gold one
// (ink silhouettes on gold paper, white rays: S.impact gets sil = MG_INK); then a white flash falls off
function mgImpact(o, t) {
  const S = MG.script, H0 = FIN.hit, pn = MG.byId[S.flight];
  if (!pn || t < H0 || (S.noImpact && !MG.ultiCut)) return;   // S.noImpact (the Samurai page): no impact frames, the page holds instead (an Ultimate page with its own cut plays them)
  if (MG.reduced) { const a = 0.5 * (1 - fe(H0, H0 + 300, t)); if (a > 0.01) { o.fillStyle = `rgba(255,252,244,${a.toFixed(3)})`; o.fillRect(0, 0, L.gw, L.gh); } return; }
  const span = MG.ulti ? 150 : 100;
  if (t < H0 + span) {
    const fr = Math.floor((t - H0) / 50);   // 0 black, 1 white, 2 gold (Ultimate)
    o.fillStyle = fr === 0 ? "#000000" : fr === 1 ? "#ffffff" : MG_GOLD; o.fillRect(0, 0, L.gw, L.gh);
    mgPlace(pn, t);
    const hp = S.hitPt ? pn.sp(...S.hitPt()) : [L.gw / 2, L.gh / 2], R = Math.hypot(Math.max(hp[0], L.gw - hp[0]), Math.max(hp[1], L.gh - hp[1]));
    mgFocus(o, hp[0], hp[1], R * 1.05, t * 0.001, 1, fr !== 1);
    S.impact(o, pn, fr === 0 ? "#ffffff" : fr === 1 ? "#000000" : MG_INK, t);
  } else {
    const a = 0.4 * (1 - fe(H0 + span, H0 + span + 100, t));
    if (a > 0.01) { o.fillStyle = `rgba(255,252,244,${a.toFixed(3)})`; o.fillRect(0, 0, L.gw, L.gh); }
  }
}

/* ---------- the title block: a slanted black band, the name in hand lettering, a screened accent strip, the red hanko K.O. seal ---------- */
function mgCardPrep() {
  const S = MG.script, W = FIN.P[FIN.w], accent = S.col, subCol = MG.ulti ? MG_GOLD : "#f1ece2";   // an Ultimate's sub-line ("ULTIMATE: <name>") is gold
  if (!MG.cards) {
    const hh = Math.min(L.gh * 0.17, 86, L.gw * 0.2), nm = W.spec.name.toUpperCase();
    MG.cards = { hh, name: mgWord(nm, { size: hh * 0.74, seed: 7, arc: 14, jit: 0.1, space: 0.04 }), win: mgWord(W.slot === meSlot ? "YOU WIN" : "WINS", { size: hh * 0.3, seed: 11, arc: 20, jit: 0.1, fill: accent }),
      sub: mgWord(FIN.cardSub.toUpperCase(), { size: hh * 0.27, seed: 13, arc: 30, jit: 0.06, weight: 800, fill: subCol }), ko: mgWord("K.O.", { size: hh * 0.95, seed: 17, arc: 12, jit: 0.1, fill: "#ffffff", weight: 900 }) };
    // a line that is wider than the band (a long name on a narrow screen) is set again, smaller; on the upright phone the sub line also stays clear of the seal
    const x0 = Math.max(16, L.gw * 0.06), room = L.gw - x0 - 8, C = MG.cards;
    if (C.sub.w > room) C.sub = mgWord(FIN.cardSub.toUpperCase(), { size: hh * 0.27 * room / C.sub.w, seed: 13, arc: 30, jit: 0.06, weight: 800, fill: subCol });
    if (C.name.w + C.win.w * 0.9 > room) { const q = room / (C.name.w + C.win.w * 0.9); C.name = mgWord(nm, { size: hh * 0.74 * q, seed: 7, arc: 14, jit: 0.1, space: 0.04 }); C.win = mgWord(W.slot === meSlot ? "YOU WIN" : "WINS", { size: hh * 0.3 * q, seed: 11, arc: 20, jit: 0.1, fill: accent }); }
  }
}
function mgCard(o, t) {
  const S = MG.script, accent = S.col;
  mgCardPrep();
  const C = MG.cards, hh = C.hh, k = easeOut(fe(MT.CARD, MT.CARD + 260, t)), slide = (1 - k) * L.gw * (FIN.dir > 0 ? -1 : 1);
  const y = L.portrait ? L.gh * 0.12 + hh * 0.5 : L.gh * 0.17 + hh * 0.5, sl = L.gh * 0.035;
  o.save(); o.translate(slide, 0);
  o.fillStyle = MG_INK;
  o.beginPath(); o.moveTo(-20, y - hh / 2 + sl); o.lineTo(L.gw + 20, y - hh / 2 - sl); o.lineTo(L.gw + 20, y + hh / 2 - sl); o.lineTo(-20, y + hh / 2 + sl); o.closePath(); o.fill();
  // the screened accent strip under the band
  const strip = [[-20, y + hh / 2 + sl], [L.gw + 20, y + hh / 2 - sl], [L.gw + 20, y + hh / 2 - sl + hh * 0.16], [-20, y + hh / 2 + sl + hh * 0.16]];
  o.fillStyle = accent; mgPoly(o, strip); o.fill();
  const at = (pl) => pl.map(([x, y]) => [x + slide, y]);   // (mgToneFill works in device px and ignores the translate, so the slide is added by hand)
  mgToneFill(o, at(strip), 6, 0.38);
  if (MG.ulti) {   // a second, gold strip under it, half as high
    const g2 = [[-20, y + hh / 2 + sl + hh * 0.16], [L.gw + 20, y + hh / 2 - sl + hh * 0.16], [L.gw + 20, y + hh / 2 - sl + hh * 0.24], [-20, y + hh / 2 + sl + hh * 0.24]];
    o.fillStyle = MG_GOLD; mgPoly(o, g2); o.fill();
    mgToneFill(o, at(g2), 6, 0.38);
  }
  const x0 = Math.max(16, L.gw * 0.06), nm = C.name;
  o.drawImage(nm.cv, x0 - size0(nm) * 0.05, y - nm.h / 2 - hh * 0.02, nm.w, nm.h);
  o.drawImage(C.win.cv, x0 + nm.w * 0.86, y - C.win.h / 2 + hh * 0.2, C.win.w, C.win.h);
  o.drawImage(C.sub.cv, x0 - 2, y + hh * 0.2, C.sub.w, C.sub.h);
  o.restore();
  // the seal
  const s = fe(MT.SEAL, MT.SEAL + 140, t);
  if (s > 0) {
    const sc = 1 + 0.9 * (1 - easeOut(s)), sz = hh * 1.25, kx = L.portrait ? L.gw - sz * 0.72 : Math.min(L.gw - sz * 0.7, L.gw * 0.86), ky = L.portrait ? y + hh * 0.5 + sz * 0.68 : y + hh * 0.62;
    o.save(); o.translate(kx, ky); o.rotate(-0.09); o.scale(sc, sc); o.globalAlpha = Math.min(1, s * 3);
    for (const [dx, dy, al] of [[2.2, 1.6, 0.55], [0, 0, 1]]) {   // misprinted: a faint second print, a hair off
      o.save(); o.translate(dx, dy); o.globalAlpha *= al;
      o.fillStyle = MG.ulti ? (al < 1 ? MG_GOLD_D : MG_GOLD_SEAL) : "#c8281f"; o.beginPath(); o.roundRect(-sz / 2, -sz / 2, sz, sz, sz * 0.14); o.fill();   // the Ultimate's hanko is gold, its misprint ghost dark gold
      o.strokeStyle = MG.ulti ? MG_INK : "#f1ece2"; o.lineWidth = Math.max(2, sz * 0.045); o.beginPath(); o.roundRect(-sz / 2 + sz * 0.08, -sz / 2 + sz * 0.08, sz * 0.84, sz * 0.84, sz * 0.07); o.stroke();
      o.drawImage(C.ko.cv, -C.ko.w * 0.5, -C.ko.h * 0.5, C.ko.w, C.ko.h);
      o.restore();
    }
    o.restore();
  }
}
const size0 = (w) => w.h * 0.12;

/*MANGA*/
