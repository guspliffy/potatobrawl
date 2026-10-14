/* ===================== KO finisher cinematic =====================
   Plays on the final lethal hit that decides a match (the engine's "lethal" event with final:true, then "game"
   with hit:true; not on time-outs, draws, the tutorial or a last life lost without a lethal hit). It is only a
   show: the simulation has already decided the match, so nothing here touches G or online sync.
   Beat 0, the real hit: the engine is in hitstop and then slow motion; the camera punches in on the impact
   (view.js camPunch), a white frame, black bars slide in. Then a smash cut to the stage: two stand-ins
   ("puppets") copy the winner and the loser onto the main stage, the camera pushes in, the winner does a big
   version of their signature move, and on its impact the loser is launched out of the arena in the real
   launch direction, spinning. It leaves the screen, the KO beam and a burst of fries and chips mark the
   edge, then the name card. A tap or key skips it; the results screen opens when it ends. */
const FIN = { on: false, t: 0, last: 0, w: 0, l: 0, wx: 0, lx: 0, dir: 1, kit: null, P: [null, null], parts: [], shake: 0, out: false,
  cue: {}, finish: null, manga: false, hit: 1520, launch: 1610, cardSub: "", k: 1, rnd: [], rate: 1, pend: null, ev: null, ldx: 1, ldy: -0.5, beam: null, flashes: [], trail: [], lastIn: null, cut: false }; // rate: tests slow or freeze it
// timeline, in ms after the final hit. The loser stays put FLAUNCH ms after HIT (impact freeze), then flies.
const FT = { CUT: 520, ACT: 920, HIT: 1520, OUT: 2020, CARD: 2400, END: 3800 };
const FLAUNCH = 90, FLAUNCH_T = FT.HIT + FLAUNCH, FMS = 1000 / 60;
// finish line of the loser's flight: world units travelled, `f` frames after the launch
const finTrav = (f) => 17 * f + 0.6 * f * f;
function finWanted(g) {
  return mode === "match" && match && !match.tutorial && g.endReason === "stocks" && (g.winner === 0 || g.winner === 1);
}
function finStart(g) {
  const W = g.fighters[g.winner], Lf = g.fighters[1 - g.winner];
  const ev = FIN.pend && FIN.pend.slot === Lf.slot ? FIN.pend : null;
  FIN.pend = null; FIN.ev = ev;
  FIN.on = true; FIN.t = 0; FIN.last = performance.now(); FIN.w = g.winner; FIN.l = 1 - g.winner;
  FIN.wx = clamp(Math.round(W.x), -190, 190);
  // the real launch direction (unit vector, y up is negative); with no event, away from the winner and a little up
  const rdx = ev ? ev.dirx : (Lf.x >= W.x ? 0.8 : -0.8), rdy = ev ? ev.diry : -0.6;
  FIN.dir = Math.abs(rdx) > 0.2 ? sign(rdx) : (Lf.x >= W.x ? 1 : -1);
  if (Math.abs(FIN.wx + FIN.dir * 130) > 250) FIN.dir = -FIN.dir;   // too close to the stage edge: mirror the whole staging
  FIN.lx = FIN.wx + FIN.dir * 130;
  // on the stage the loser always flies away from the winner and up (a spike or flat launch would go through the floor)
  const ux = Math.abs(rdx), uy = clamp(rdy, -1, -0.16), ul = Math.hypot(ux, uy) || 1;
  FIN.ldx = FIN.dir * ux / ul; FIN.ldy = uy / ul;
  FIN.kit = FINS[W.spec.id] || FINS.phoenix;
  FIN.parts.length = 0; FIN.shake = 0; FIN.out = false; FIN.cue = {}; FIN.finish = null; FIN.cut = false; FIN.hit = FT.HIT; FIN.launch = FLAUNCH_T; FIN.manga = false;
  FIN.beam = null; FIN.flashes.length = 0; FIN.trail.length = 0; FIN.lastIn = null;
  FIN.rnd = Array.from({ length: 24 }, () => Math.random());
  FIN.P = [null, null];
  FIN.P[FIN.w] = finPuppet(W, FIN.wx, FIN.dir, "w");
  FIN.P[FIN.l] = finPuppet(Lf, FIN.lx, -FIN.dir, "l");
  // a winner with a manga page (manga.js, MANGA[id]) plays that; anything missing or broken falls back to the 2D staging below
  FIN.cardSub = "";
  if (MANGA[W.spec.id]) FIN.manga = mangaStart(g);
}
function finPuppet(f, x, facing, role) {
  const p = Object.assign({}, f, { x, y: 0, vx: 0, vy: 0, kbx: 0, kby: 0, facing, grounded: true, plat: 0, state: "fin", st: 0,
    move: null, mid: null, mt: 0, invuln: 0, hitstun: 0, tumble: false, flash: 0, armorFlash: 0, ledge: 0, finRole: role, finPose: null });
  p.finPose = (P, sk) => finPose(p, P, sk);
  return p;
}
// Called when the sim says the match is over; returns true while the cinematic still holds the results.
function finHold(fn) { if (!FIN.on) return false; FIN.finish = fn; return true; }
function finEnd() {
  if (!FIN.on) return;
  finClear();
  const fn = FIN.finish || (() => { if (match && match.online) finishOnline(false); else finishMatch(false); });
  FIN.finish = null;
  if (mode === "match") fn();
}
function finStop() { finClear(); FIN.finish = null; FIN.pend = null; }
function finClear() {
  if (FIN.manga) mangaEnd();
  FIN.on = false; FIN.parts.length = 0; FIN.beam = null; FIN.flashes.length = 0; FIN.trail.length = 0; finFilter(0); fxHitOff();
  if (finFull) { finFull = false; resize(); }
}
// Samurai's ink frame turns the scene itself black and white (the canvases under the effects layer)
function finFilter(v) {
  const f = v > 0 ? `grayscale(${v.toFixed(2)}) contrast(${(1 + 0.9 * v).toFixed(2)}) brightness(${(1 + 0.2 * v).toFixed(2)})` : "";
  if (FIN.filter === f) return;
  FIN.filter = f; cv.style.filter = f;
}
// Skipping only counts once the cinematic is on screen, so buttons still being mashed at the KO don't skip it.
function finSkip(e) {
  if (!FIN.on || FIN.t < (FIN.manga ? MT.SKIP : FT.CUT + 400)) return;
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (FIN.manga) { mangaFinish(); return; }
  FIN.skipAt = performance.now();
  finEnd();
}
app.addEventListener("pointerdown", finSkip, true);
// the tap that skipped must not also press a button on the results screen that opens under the finger
app.addEventListener("click", (e) => { if (performance.now() - (FIN.skipAt || 0) < 450) { e.preventDefault(); e.stopPropagation(); } }, true);
window.addEventListener("keydown", (e) => { if (FIN.on && !e.repeat) finSkip(e); }, true);

/* ---------- the hit itself: KO zoom, white frame, finishing-special banner (all UI, DOM layers above the arena) ---------- */
const fxHitEl = $("fxHit"), finBanEl = $("finBan"), finBanT = finBanEl.querySelector(".fb-t");
let finBanAt = -1e9;
function fxRestart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
// white frame + vignette (+ speed lines when big) centred on a world point; the punch-in pulls that point towards the middle
function fxHit(wx, wy, big) {
  const [sx, sy] = toScreen(wx, wy);
  fxHitEl.style.setProperty("--hx", lerp(sx, L.gw / 2, 0.45).toFixed(0) + "px"); fxHitEl.style.setProperty("--hy", lerp(sy, L.gh / 2, 0.45).toFixed(0) + "px");
  fxHitEl.style.setProperty("--hw", big ? "0.9" : "0.7"); fxHitEl.style.setProperty("--hd", big ? "0.75s" : "0.5s");
  fxHitEl.classList.toggle("big", !!big);
  fxRestart(fxHitEl, "go");
}
function fxHitOff() { fxHitEl.classList.remove("go"); finBanEl.hidden = true; finBanEl.classList.remove("go"); }
finBanEl.addEventListener("animationend", () => { finBanEl.hidden = true; });
// diagonal "<SPECIAL> FINISH" band in the attacker's colour, a crunch, and a white frame
function finishBan(g, attSlot) {
  const now = performance.now();
  if (now - finBanAt < 400) return;      // the hit event and the lethal event of the same hit both call this
  finBanAt = now;
  const a = g.fighters[attSlot];
  if (!a) return;
  finBanEl.style.setProperty("--fb", col(a.pal)); finBanT.textContent = FIN_NAME[a.spec.id] || `${a.spec.signature.name} finish`;
  finBanEl.hidden = false; fxRestart(finBanEl, "go");
  finSfx(() => { Sfx.noise(0.07, 0.9, 6500); Sfx.noise(0.55, 0.85, 1000); Sfx.tone(150, 34, 0.6, "sawtooth", 0.3); Sfx.tone(2300, 260, 0.14, "square", 0.06); });
}
// a finishing special with its own name on the band, the Finish! banner and the Special button (the Gunslinger's golden bullet, the Reaper's hook)
const FIN_NAME = { gunslinger: "High Noon", reaper: "Last Rites" };
const finName = (spec) => FIN_NAME[spec.id] || spec.signature.name;
// "hit" event with fin:true (called from the hit case in effects.js): a finishing special landed, lethal or not
function finHit(g, e) {
  if (!e.fin) return;
  finishBan(g, e.slot);
  fxHit(e.x, e.y, true);
}
// "lethal" event: this hit kills whatever the defender tries. Last life: it starts the finisher (finStart on the game event);
// earlier lives: a short punch-in on the impact and back.
function finLethal(g, e) {
  const d = g.fighters[e.slot];
  if (!d) return;
  const hx = e.x, hy = e.y - d.s.h * 0.5;
  if (e.final) { FIN.pend = e; hideBanner(); }   // the cinematic owns the screen from the hit
  camPunch(hx, hy, e.final ? 1.25 : 1, e.final ? 36 : 21);
  cam.shake = Math.max(cam.shake, e.final ? 16 : 10);
  fxHit(hx, hy, e.final);
  if (e.fin) finishBan(g, e.by);
  finSfx(() => { Sfx.tone(120, 36, 0.34, "sine", 0.55); Sfx.noise(0.14, 0.5, 2200); if (e.final) Sfx.tone(70, 28, 0.8, "sine", 0.35); });
}
// "chargeMax" event of the local fighter: the Heavy button's ring is full
function finChargeMax() {
  finSfx(() => { Sfx.tone(1175, 1175, 0.12, "triangle", 0.12); setTimeout(() => Sfx.tone(1760, 1760, 0.2, "triangle", 0.1), 70); });
  try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* no haptics */ }
  fxRestart(btnHeavy, "chgfull"); setTimeout(() => btnHeavy.classList.remove("chgfull"), 450);
}

/* ---------- helpers ---------- */
const fe = (a, b, t) => clamp((t - a) / (b - a), 0, 1);   // 0..1 progress of t through [a, b]
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;
const glowCache = new Map();
function glowSprite(col) {
  let s = glowCache.get(col);
  if (!s) {
    s = document.createElement("canvas"); s.width = s.height = 64;
    const c = s.getContext("2d"), g = c.createRadialGradient(32, 32, 0, 32, 32, 32), [r, gg, b] = rgb(col);
    g.addColorStop(0, `rgba(${r},${gg},${b},1)`); g.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    glowCache.set(col, s);
  }
  return s;
}
function part(o) { if (FIN.parts.length < 420) FIN.parts.push(Object.assign({ t: 0, vx: 0, vy: 0, g: 0, drag: 1, grow: 0, rot: 0, vr: 0, a: 1 }, o)); }
function cueOnce(name, t, fn) { if (FIN.t >= t && !FIN.cue[name]) { FIN.cue[name] = true; fn(); } }
function finSfx(fn) { try { fn(); } catch (e) { /* sound off or not ready */ } }
const headY = (p) => -p.s.h * 0.62;

/* ---------- per-fighter finishers ----------
   step(t, k): spawns particles and moves the winner (k = frames elapsed, 60 per second).
   pose(P, sk, t): bends the winner's skeleton.  draw(o, t): shapes that aren't particles. */
const FINS = {
  phoenix: {
    col: "#ff7a3d",
    step(t, k) {
      const W = FIN.P[FIN.w], up = fe(FT.ACT, FT.ACT + 320, t), down = fe(FT.HIT - 260, FT.HIT - 40, t);
      W.y = -110 * easeOut(up) + 110 * easeIn(down);
      W.x = FIN.wx + FIN.dir * 60 * down;
      if (t > FT.HIT && t < FT.HIT + 650) for (let i = 0; i < 2.5 * k; i++) {
        const r = Math.random();
        part({ kind: "glow", col: r < 0.3 ? "#fff0b0" : r < 0.75 ? "#ff9a3d" : "#e8402b", wx: FIN.lx + (Math.random() - 0.5) * 50, wy: -Math.random() * 12,
          vx: (Math.random() - 0.5) * 0.8, vy: -9 - Math.random() * 7, life: 26 + Math.random() * 16, r: 18 + Math.random() * 14, grow: -0.3 });
      }
      if (t > FT.HIT) for (let i = 0; i < 1.2 * k; i++) part({ kind: "ember", col: Math.random() < 0.5 ? "#ffd27a" : "#ff7a3d", wx: FIN.wx + (Math.random() - 0.5) * 520,
        wy: -330 - Math.random() * 40, vx: (Math.random() - 0.5) * 0.8, vy: 2.4 + Math.random() * 1.8, life: 120, r: 2 + Math.random() * 2.2 });
      cueOnce("bird", FT.ACT + 200, () => finSfx(() => Sfx.fire()));
      cueOnce("hit", FT.HIT, () => { FIN.shake = 16; finSfx(() => Sfx.ko()); finRing(FIN.lx, -10, "#ffb35a", 150); });
    },
    pose(P, sk, t) {
      const air = t > FT.ACT && t < FT.HIT;
      P.flap = air ? Math.sin(t * 0.04) * 0.9 : 0;
      if (t > FT.HIT - 260 && t < FT.HIT + 120) { P.lean = 0.55; P.mouth = 1; return { hF: [sk.w * 0.6, -sk.leg - sk.tor * 0.2], hB: [-sk.w * 0.6, -sk.leg - sk.tor * 0.3] }; }
      if (air) { P.mouth = 0.6; return { hF: [sk.w * 0.45, -sk.leg - sk.tor * 1.3], hB: [-sk.w * 0.45, -sk.leg - sk.tor * 1.3], fF: [sk.w * 0.3, -sk.leg * 0.5], fB: [-sk.w * 0.2, -sk.leg * 0.3] }; }
      return null;
    },
    draw(o, t) {
      // the firebird dives from high behind the winner onto the loser
      const k = fe(FT.ACT + 200, FT.HIT, t);
      if (k > 0 && k < 1) {
        const sx = FIN.lx - FIN.dir * 240, sy = -200, q = easeIn(k);
        const x = lerp(sx, FIN.lx, q), y = lerp(sy, -30, q);
        const [px_, py] = toScreen(x, y), s = FIN.k * 1.15, ang = Math.atan2(200 - 30, 240);
        o.save(); o.translate(px_, py); o.rotate(FIN.dir > 0 ? ang : Math.PI - ang); o.scale(s, s * FIN.dir);
        o.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) { o.globalAlpha = 0.18 * (1 - i / 6); o.drawImage(glowSprite("#ff7a3d"), -40 - i * 16, -26, 52, 52); }
        o.globalAlpha = 0.95;
        const fl = Math.sin(t * 0.05) * 10;
        o.fillStyle = "#ffcf6a";
        o.beginPath(); o.moveTo(18, 0); o.quadraticCurveTo(-4, -30 - fl, -34, -46 - fl); o.quadraticCurveTo(-18, -14, -26, -4);
        o.quadraticCurveTo(-18, 14, -34, 46 + fl); o.quadraticCurveTo(-4, 30 + fl, 18, 0); o.fill();
        o.fillStyle = "#fff6d8"; o.beginPath(); o.ellipse(6, 0, 12, 6, 0, 0, Math.PI * 2); o.fill();
        o.fillStyle = "#ff8a3d"; o.beginPath(); o.moveTo(-24, 0); o.lineTo(-62, -12); o.lineTo(-52, 0); o.lineTo(-62, 12); o.closePath(); o.fill();
        o.restore();
      }
    },
  },
  alchemist: {
    col: "#7dff62",
    step(t, k) {
      cueOnce("throw", FT.ACT + 250, () => finSfx(() => Sfx.swing(false)));
      cueOnce("hit", FT.HIT, () => {
        FIN.shake = 14; finSfx(() => Sfx.burst());
        for (let i = 0; i < 3; i++) part({ kind: "ring", col: i === 1 ? "#d9ffcf" : "#55e05a", wx: FIN.lx, wy: -30, life: 26 + i * 6, r: 10, grow: 3.6 + i * 1.2, w: 5 - i, delay: i * 5 });
        for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6;
          part({ kind: "glow", col: i % 3 ? "#55e05a" : "#d9ffcf", wx: FIN.lx, wy: -30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.93, life: 24 + Math.random() * 14, r: 10 + Math.random() * 8 }); }
      });
      if (t > FT.HIT) for (let i = 0; i < 0.35 * k; i++) part({ kind: "vapour", col: Math.random() < 0.5 ? "#7dd96a" : "#a8e89a", wx: FIN.lx + (Math.random() - 0.5) * 110,
        wy: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 0.9, vy: -0.6 - Math.random() * 0.8, life: 80 + Math.random() * 30, r: 12 + Math.random() * 10, grow: 0.18 });
    },
    pose(P, sk, t) {
      if (t > FT.ACT && t < FT.ACT + 250) { const k = fe(FT.ACT, FT.ACT + 250, t); P.lean = -0.3 * k; return { hF: [-sk.w * 0.7, -sk.leg - sk.tor * 1.1] }; }
      if (t >= FT.ACT + 250 && t < FT.HIT) { P.lean = 0.2; return { hF: [sk.w * 1.1, -sk.leg - sk.tor * 0.8] }; }
      if (t >= FT.HIT) { P.mouth = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.02)); P.lean = -0.12; return { hF: [sk.w * 0.5, -sk.leg - sk.tor * 1.3], hB: [-sk.w * 0.5, -sk.leg - sk.tor * 1.3] }; }
      return null;
    },
    draw(o, t) {
      // the potion arcs over, then forked green lightning hits the loser
      const k = fe(FT.ACT + 250, FT.HIT, t);
      if (k > 0 && k < 1) {
        const x = lerp(FIN.wx + FIN.dir * 30, FIN.lx, k), y = lerp(-50, -30, k) - Math.sin(k * Math.PI) * 130;
        const [px_, py] = toScreen(x, y), s = FIN.k;
        o.save(); o.translate(px_, py); o.rotate(k * 9 * FIN.dir); o.scale(s, s);
        o.globalCompositeOperation = "lighter"; o.globalAlpha = 0.7; o.drawImage(glowSprite("#55e05a"), -22, -22, 44, 44);
        o.globalCompositeOperation = "source-over"; o.globalAlpha = 1;
        o.fillStyle = "#7dff62"; o.strokeStyle = "#11101c"; o.lineWidth = 2;
        o.beginPath(); o.arc(0, 3, 8, 0, Math.PI * 2); o.fill(); o.stroke();
        o.fillStyle = "#d9d4ea"; o.fillRect(-3, -10, 6, 7); o.strokeRect(-3, -10, 6, 7);
        o.restore();
      }
      if (t > FT.HIT && t < FT.HIT + 520) {
        const seed = Math.floor(t / 60), a = 1 - fe(FT.HIT + 300, FT.HIT + 520, t);
        o.save(); o.globalCompositeOperation = "lighter"; o.lineJoin = "round"; o.lineCap = "round";
        for (let b = 0; b < 3; b++) finBolt(o, FIN.lx + (b - 1) * 90, -420, FIN.lx + (b - 1) * 20, -20, seed * 7 + b, a);
        o.restore();
      }
    },
  },
  odin: {
    col: "#8fd8ff",
    step(t, k) {
      const W = FIN.P[FIN.w], lunge = fe(FT.HIT - 200, FT.HIT - 40, t), back = fe(FT.HIT + 200, FT.HIT + 500, t);
      W.x = FIN.wx + FIN.dir * (55 * easeOut(lunge) - 30 * back);
      cueOnce("ravens", FT.ACT, () => finSfx(() => Sfx.caw()));
      cueOnce("thrust", FT.HIT - 200, () => finSfx(() => Sfx.swing(true)));
      cueOnce("hit", FT.HIT, () => {
        FIN.shake = 15; finSfx(() => Sfx.ko());
        finRing(FIN.lx, -30, "#d8f4ff", 170);
        for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 8;
          part({ kind: "shard", col: i % 2 ? "#ffffff" : "#8fd8ff", wx: FIN.lx, wy: -32, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.18, drag: 0.96, life: 40 + Math.random() * 20, r: 6 + Math.random() * 8, rot: a, vr: (Math.random() - 0.5) * 0.3 }); }
      });
      if (t > FT.HIT) for (let i = 0; i < 0.5 * k; i++) part({ kind: "ember", col: "#e8f8ff", wx: FIN.lx + (Math.random() - 0.5) * 300, wy: -300 - Math.random() * 40, vx: (Math.random() - 0.5) * 0.6, vy: 1.4 + Math.random(), life: 140, r: 1.6 + Math.random() * 1.6 });
    },
    pose(P, sk, t) {
      if (t > FT.ACT && t < FT.HIT - 200) { P.lean = -0.15; return { hF: [-sk.w * 0.4, -sk.leg - sk.tor * 1.0] }; }
      if (t >= FT.HIT - 200 && t < FT.HIT + 350) { P.lean = 0.35; P.mouth = 1; return { hF: [sk.w * 1.25, -sk.leg - sk.tor * 0.62], fF: [sk.w * 0.7, 0] }; }
      return null;
    },
    draw(o, t) {
      // rune ring under the loser, two ravens circling, the spear
      const ring = fe(FT.ACT, FT.ACT + 350, t) * (1 - fe(FT.HIT + 300, FT.HIT + 700, t));
      if (ring > 0) {
        const [cx, cy] = toScreen(FIN.lx, -4), R = 58 * FIN.k * (0.6 + 0.4 * easeOut(ring));
        o.save(); o.translate(cx, cy); o.scale(1, 0.3);
        o.globalCompositeOperation = "lighter"; o.globalAlpha = ring;
        o.strokeStyle = "#8fd8ff"; o.lineWidth = 3; o.beginPath(); o.arc(0, 0, R, 0, Math.PI * 2); o.stroke();
        o.lineWidth = 1.5; o.beginPath(); o.arc(0, 0, R * 0.78, 0, Math.PI * 2); o.stroke();
        o.rotate(t * 0.0012);
        o.font = `800 ${Math.round(14 * FIN.k)}px "Barlow Condensed", "Arial Narrow", sans-serif`; o.fillStyle = "#d8f4ff"; o.textAlign = "center"; o.textBaseline = "middle";
        const runes = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ";
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; o.save(); o.translate(Math.cos(a) * R * 0.89, Math.sin(a) * R * 0.89); o.rotate(a + Math.PI / 2); o.fillText(runes[i], 0, 0); o.restore(); }
        o.restore();
      }
      const rv = fe(FT.ACT, FT.ACT + 300, t) * (1 - fe(FT.CARD, FT.CARD + 300, t));
      if (rv > 0) for (let i = 0; i < 2; i++) {
        const a = t * 0.004 + i * Math.PI, x = FIN.lx + Math.cos(a) * 85, y = -70 + Math.sin(a) * 26 - i * 10;
        const [px_, py] = toScreen(x, y), s = FIN.k * (Math.sin(a) > 0 ? 1.1 : 0.85), fl = Math.sin(t * 0.03 + i) * 0.8;
        o.save(); o.translate(px_, py); o.scale(s * (Math.cos(a + Math.PI / 2) > 0 ? 1 : -1), s); o.globalAlpha = rv;
        o.fillStyle = "#15131f";
        o.beginPath(); o.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); o.fill();
        o.beginPath(); o.moveTo(-2, 0); o.lineTo(-10, -16 * fl - 4); o.lineTo(4, -2); o.fill();
        o.beginPath(); o.moveTo(-2, 0); o.lineTo(-12, 12 * fl + 4); o.lineTo(4, 2); o.fill();
        o.fillStyle = "#f2c14e"; o.beginPath(); o.moveTo(10, -1); o.lineTo(16, 0); o.lineTo(10, 2); o.fill();
        o.restore();
      }
      const sp = fe(FT.HIT - 200, FT.HIT - 60, t) * (1 - fe(FT.HIT + 250, FT.HIT + 450, t));
      if (sp > 0) {
        const W = FIN.P[FIN.w], hx = W.x + FIN.dir * W.s.w * 1.0, hy = -W.s.h * 0.55;
        const [ax, ay] = toScreen(hx - FIN.dir * 40, hy), [bx, by] = toScreen(hx + FIN.dir * 90 * sp, hy);
        o.save(); o.lineCap = "round";
        o.strokeStyle = "#5a3b22"; o.lineWidth = 4 * FIN.k; o.beginPath(); o.moveTo(ax, ay); o.lineTo(bx, by); o.stroke();
        o.globalCompositeOperation = "lighter"; o.globalAlpha = sp;
        o.drawImage(glowSprite("#8fd8ff"), bx - 26 * FIN.k, by - 26 * FIN.k, 52 * FIN.k, 52 * FIN.k);
        o.fillStyle = "#e8f8ff"; o.beginPath(); o.moveTo(bx + FIN.dir * 14 * FIN.k, by); o.lineTo(bx, by - 5 * FIN.k); o.lineTo(bx, by + 5 * FIN.k); o.fill();
        o.restore();
      }
    },
  },
  wizard: {
    col: "#f2c14e",
    step(t, k) {
      cueOnce("meteor", FT.HIT - 350, () => finSfx(() => Sfx.bolt(false)));
      cueOnce("hit", FT.HIT, () => {
        FIN.shake = 15; finSfx(() => Sfx.ko());
        part({ kind: "star", col: "#fff3c4", wx: FIN.lx, wy: -40, life: 24, r: 34, grow: 3 });
        for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
          part({ kind: "star", col: i % 2 ? "#f2c14e" : "#bfe6ff", wx: FIN.lx, wy: -40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.94, life: 30 + Math.random() * 20, r: 5 + Math.random() * 6 }); }
        finRing(FIN.lx, -40, "#bfe6ff", 160);
      });
      if (t > FT.HIT) for (let i = 0; i < 0.5 * k; i++) part({ kind: "star", col: "#fff3c4", wx: FIN.lx + (Math.random() - 0.5) * 320, wy: -40 - Math.random() * 260, life: 30, r: 3 + Math.random() * 4 });
    },
    pose(P, sk, t) {
      if (t > FT.ACT && t < FT.HIT + 200) { P.lean = -0.1; P.mouth = t > FT.HIT - 350 ? 1 : 0.3; return { hF: [sk.w * 0.55, -sk.leg - sk.tor * 1.45], hB: [-sk.w * 0.35, -sk.leg - sk.tor * 1.05] }; }
      return null;
    },
    draw(o, t) {
      // a constellation draws itself overhead, then a crystal meteor drops from it
      const pts = [[-110, -300], [-60, -340], [-5, -310], [40, -350], [95, -315], [60, -270], [-20, -262]];
      const sh = fe(FT.ACT, FT.HIT - 380, t) * (1 - fe(FT.HIT + 100, FT.HIT + 450, t));
      if (sh > 0) {
        const n = pts.length, shown = sh * n;
        const P_ = pts.map(([x, y]) => toScreen(FIN.lx + x * 0.9, y + 40));
        o.save(); o.globalCompositeOperation = "lighter"; o.lineCap = "round";
        o.strokeStyle = "rgba(191,230,255,0.7)"; o.lineWidth = 1.6;
        for (let i = 1; i < n && i < shown; i++) { const q = Math.min(1, shown - i); o.beginPath(); o.moveTo(P_[i - 1][0], P_[i - 1][1]); o.lineTo(lerp(P_[i - 1][0], P_[i][0], q), lerp(P_[i - 1][1], P_[i][1], q)); o.stroke(); }
        for (let i = 0; i < n && i < shown + 1; i++) {
          const s = (10 + 4 * Math.sin(t * 0.01 + i)) * FIN.k * 0.5;
          o.drawImage(glowSprite("#bfe6ff"), P_[i][0] - s * 2, P_[i][1] - s * 2, s * 4, s * 4);
          finStar(o, P_[i][0], P_[i][1], s * 0.8, "#ffffff");
        }
        o.restore();
      }
      const m = fe(FT.HIT - 350, FT.HIT, t);
      if (m > 0 && m < 1) {
        const x = lerp(FIN.lx - 5, FIN.lx, m), y = lerp(-270, -30, easeIn(m));
        const [px_, py] = toScreen(x, y), [tx, ty] = toScreen(x, y - 120), s = FIN.k;
        o.save(); o.globalCompositeOperation = "lighter";
        const gr = o.createLinearGradient(px_, py, tx, ty); gr.addColorStop(0, "rgba(191,230,255,0.9)"); gr.addColorStop(1, "rgba(191,230,255,0)");
        o.strokeStyle = gr; o.lineWidth = 14 * s; o.lineCap = "round"; o.beginPath(); o.moveTo(px_, py); o.lineTo(tx, ty); o.stroke();
        o.drawImage(glowSprite("#8fb6ff"), px_ - 34 * s, py - 34 * s, 68 * s, 68 * s);
        o.globalCompositeOperation = "source-over";
        o.translate(px_, py); o.rotate(t * 0.01); o.fillStyle = "#c9e4ff"; o.strokeStyle = "#3b4f9a"; o.lineWidth = 1.5;
        o.beginPath(); o.moveTo(0, -16 * s); o.lineTo(10 * s, 0); o.lineTo(0, 16 * s); o.lineTo(-10 * s, 0); o.closePath(); o.fill(); o.stroke();
        o.restore();
      }
    },
  },
  samurai: {
    col: "#3fe0a8",
    ink: (t) => fe(FT.HIT - 20, FT.HIT, t) * (1 - fe(FT.HIT + 380, FT.HIT + 650, t)),
    step(t, k) {
      const W = FIN.P[FIN.w], dash = fe(FT.HIT - 120, FT.HIT - 20, t);
      W.x = FIN.wx + FIN.dir * 230 * easeOut(dash);
      if (dash > 0 && dash < 1) for (let i = 0; i < 3 * k; i++) part({ kind: "line", col: "#ffffff", wx: W.x - FIN.dir * Math.random() * 60, wy: -10 - Math.random() * 50, vx: -FIN.dir * 10, life: 8, r: 2 });
      if (t > FT.ACT) for (let i = 0; i < (t > FT.HIT ? 1.6 : 0.3) * k; i++) part({ kind: "petal", col: Math.random() < 0.5 ? "#ffb7d0" : "#ffd6e4", wx: FIN.lx + (Math.random() - 0.3) * 420 * -FIN.dir,
        wy: -320 - Math.random() * 30, vx: FIN.dir * (0.6 + Math.random()), vy: 1.2 + Math.random() * 1.2, life: 160, r: 4 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.15 });
      cueOnce("draw", FT.HIT - 120, () => finSfx(() => Sfx.swing(true)));
      cueOnce("hit", FT.HIT, () => { FIN.shake = 12; finSfx(() => Sfx.ko()); });
    },
    pose(P, sk, t) {
      if (t > FT.ACT && t < FT.HIT - 120) { P.crouch = 0.35; P.lean = 0.2; return { hF: [-sk.w * 0.1, -sk.leg - sk.tor * 0.35], hB: [-sk.w * 0.35, -sk.leg - sk.tor * 0.4] }; }
      if (t >= FT.HIT - 120 && t < FT.HIT + 700) { P.lean = 0.3; P.crouch = 0.25; return { hF: [sk.w * 1.2, -sk.leg - sk.tor * 0.9], fF: [sk.w * 0.7, 0], fB: [-sk.w * 0.6, 0] }; }
      return null;
    },
    draw(o, t) {
      // black-and-white ink frame with one brush stroke across the whole screen
      const a = fe(FT.HIT - 20, FT.HIT, t) * (1 - fe(FT.HIT + 380, FT.HIT + 650, t));
      if (a <= 0) return;
      o.save();
      o.fillStyle = `rgba(238,233,222,${0.4 * a})`; o.fillRect(0, 0, L.gw, L.gh);
      const draw = fe(FT.HIT, FT.HIT + 110, t), x0 = FIN.dir > 0 ? -40 : L.gw + 40, x1 = FIN.dir > 0 ? L.gw + 40 : -40;
      const y0 = L.gh * 0.72, y1 = L.gh * 0.28, ex = lerp(x0, x1, draw), ey = lerp(y0, y1, draw), thick = Math.min(L.gw, L.gh) * 0.09;
      const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1, ux = nx / nl, uy = ny / nl;
      o.globalAlpha = a; o.fillStyle = "#14121c";
      o.beginPath(); o.moveTo(x0, y0);
      for (let i = 0; i <= 20; i++) { const q = i / 20, w_ = thick * Math.sin(Math.min(1, q * 1.15) * Math.PI) * (0.85 + 0.15 * FIN.rnd[i]); o.lineTo(lerp(x0, ex, q) + ux * w_, lerp(y0, ey, q) + uy * w_); }
      for (let i = 20; i >= 0; i--) { const q = i / 20, w_ = thick * 0.35 * Math.sin(Math.min(1, q * 1.15) * Math.PI); o.lineTo(lerp(x0, ex, q) - ux * w_, lerp(y0, ey, q) - uy * w_); }
      o.closePath(); o.fill();
      for (let i = 0; i < 9; i++) { const q = FIN.rnd[i + 4], sx = lerp(x0, ex, q), sy = lerp(y0, ey, q); o.beginPath(); o.arc(sx + ux * thick * (FIN.rnd[i + 12] - 0.3) * 2.2, sy + uy * thick * (FIN.rnd[i + 12] - 0.3) * 2.2, 3 + FIN.rnd[i] * 6, 0, Math.PI * 2); o.fill(); }
      o.restore();
    },
  },
  dragon: {
    col: "#ff8a3d",
    step(t, k) {
      const W = FIN.P[FIN.w];
      W.y = -14 * Math.sin(fe(FT.ACT, FT.ACT + 450, t) * Math.PI);
      const roar = t > FT.HIT - 220 && t < FT.HIT + 600;
      if (roar) {
        FIN.shake = Math.max(FIN.shake, 5);
        const mx = W.x + FIN.dir * W.s.w * 0.45, my = -W.s.h * 0.62;
        for (let i = 0; i < 3.5 * k; i++) {
          const a = Math.atan2(-25, FIN.dir * 120) + (Math.random() - 0.5) * 0.42, sp = 7 + Math.random() * 5, r = Math.random();
          part({ kind: "glow", col: r < 0.12 ? "#fff3c4" : r < 0.65 ? "#ff8a2d" : "#d93a24", wx: mx, wy: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.6, drag: 0.97, life: 26 + Math.random() * 10, r: 6 + Math.random() * 4, grow: 0.75 });
        }
      }
      cueOnce("roar", FT.HIT - 220, () => finSfx(() => Sfx.fire()));
      cueOnce("hit", FT.HIT, () => { FIN.shake = 14; finSfx(() => Sfx.ko()); });
    },
    pose(P, sk, t) {
      P.flap = t > FT.ACT && t < FT.HIT + 600 ? 0.9 + Math.sin(t * 0.02) * 0.15 : 0.2;
      if (t > FT.ACT && t < FT.HIT - 220) { const k = fe(FT.ACT, FT.HIT - 220, t); P.lean = -0.35 * easeOut(k); P.mouth = 0.5 * k; return { hF: [sk.w * 0.6, -sk.leg - sk.tor * 1.3], hB: [-sk.w * 0.6, -sk.leg - sk.tor * 1.25] }; }
      if (t >= FT.HIT - 220 && t < FT.HIT + 600) { P.lean = 0.25; P.mouth = 1; return { hF: [sk.w * 0.75, -sk.leg - sk.tor * 0.9], hB: [-sk.w * 0.75, -sk.leg - sk.tor * 0.9] }; }
      return null;
    },
    draw(o, t) {
      // heat shimmer over the fire
      const a = fe(FT.HIT - 200, FT.HIT, t) * (1 - fe(FT.HIT + 500, FT.HIT + 900, t));
      if (a <= 0) return;
      o.save(); o.globalAlpha = 0.22 * a; o.strokeStyle = "#fff0d0"; o.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const bx = lerp(FIN.wx, FIN.lx, 0.3 + i * 0.15);
        o.beginPath();
        for (let j = 0; j <= 10; j++) { const [sx, sy] = toScreen(bx + Math.sin(t * 0.012 + j * 0.9 + i) * 6, -60 - j * 14 - i * 6); j ? o.lineTo(sx, sy) : o.moveTo(sx, sy); }
        o.stroke();
      }
      o.restore();
    },
  },
  gunslinger: {
    // High Noon: a stand-off under a white sun, a tumbleweed rolls between them, the draw, one golden bullet, smoke blown off the barrel
    col: "#ffd27a",
    muzzle: () => { const W = FIN.P[FIN.w]; return [W.x + FIN.dir * 63, -43]; },
    step(t, k) {
      const W = FIN.P[FIN.w];
      W.x = FIN.wx - FIN.dir * 5 * fe(FT.HIT, FT.HIT + 60, t) * (1 - fe(FT.HIT + 60, FT.HIT + 300, t));   // the kick of the shot
      if (t > FT.HIT + 420 && t < FT.CARD + 900) for (let i = 0; i < 0.5 * k; i++) {
        const [mx, my] = [W.x + FIN.dir * 30, -74];
        part({ kind: "smoke", col: "#e6e0ee", wx: mx + (Math.random() - 0.5) * 4, wy: my, vx: (Math.random() - 0.5) * 0.4, vy: -0.7 - Math.random() * 0.4, life: 70, r: 5 + Math.random() * 3, grow: 0.12 });
      }
      cueOnce("wind", FT.ACT, () => finSfx(() => Sfx.noiseF(1.2, 0.18, "bandpass", 500, 900, 0.8)));
      cueOnce("draw", FT.HIT - 170, () => finSfx(() => { Sfx.tone(1500, 900, 0.04, "square", 0.07); Sfx.noise(0.03, 0.2, 5000); }));
      cueOnce("hit", FT.HIT, () => {
        FIN.shake = 16; finSfx(() => { Sfx.shot(true); Sfx.ko(); });
        const [mx, my] = FINS.gunslinger.muzzle();
        finRing(FIN.lx, -32, "#ffcf3d", 160);
        part({ kind: "glow", col: "#fff4c8", wx: mx, wy: my, life: 12, r: 26, grow: 1.5 });
        for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
          part({ kind: "star", col: i % 2 ? "#ffcf3d" : "#fff4c8", wx: FIN.lx, wy: -32, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.93, life: 26 + Math.random() * 14, r: 4 + Math.random() * 4 }); }
        for (let i = 0; i < 6; i++) part({ kind: "smoke", col: "#e6e0ee", wx: mx + FIN.dir * Math.random() * 20, wy: my + (Math.random() - 0.5) * 8, vx: FIN.dir * (0.5 + Math.random()), vy: -0.4 - Math.random() * 0.5, life: 60, r: 8 + Math.random() * 6, grow: 0.25 });
      });
    },
    pose(P, sk, t) {
      const low = [sk.w * 0.66, -sk.leg - sk.tor * 0.08], aim = [sk.w * 1.02, -sk.leg - sk.tor * 0.64], restB = [-sk.w * 0.62, -sk.leg - sk.tor * 0.3];
      if (t > FT.ACT && t < FT.HIT - 170) { P.crouch = 0.22; P.lean = 0.06; P.holdAng = 1.35; P.gunB = Math.PI - 1.35; return { hF: low, hB: [-sk.w * 0.5, -sk.leg - sk.tor * 0.08] }; }   // hands over the holsters
      if (t >= FT.HIT - 170 && t < FT.HIT + 420) {
        const d = easeOut(fe(FT.HIT - 170, FT.HIT - 110, t)), kick = fe(FT.HIT, FT.HIT + 50, t) * (1 - fe(FT.HIT + 50, FT.HIT + 260, t));
        P.crouch = 0.22 * (1 - d) + 0.1; P.lean = -0.04 - 0.12 * kick; P.holdAng = lerp(1.35, 0, d) - kick * 0.6; P.gunB = Math.PI - 1.35;
        if (t >= FT.HIT && t < FT.HIT + 50) P.shotF = Math.floor((t - FT.HIT) / FMS);
        return { hF: [lerp(low[0], aim[0], d), lerp(low[1], aim[1], d) - kick * 6], hB: [-sk.w * 0.5, -sk.leg - sk.tor * 0.08] };
      }
      if (t >= FT.HIT + 420 && t < FT.END) {   // blows the smoke off the barrel
        const q = easeOut(fe(FT.HIT + 420, FT.HIT + 620, t));
        P.mouth = 0.7 * q; P.lean = -0.05; P.holdAng = lerp(0, -1.95, q); P.gunB = Math.PI + 0.35;
        return { hF: [lerp(aim[0], sk.w * 0.6, q), lerp(aim[1], -sk.leg - sk.tor * 0.55, q)], hB: restB };
      }
      return null;
    },
    draw(o, t) {
      // a white noon sun behind them
      const sun = fe(FT.CUT, FT.ACT, t) * (1 - fe(FT.CARD, FT.END, t));
      if (sun > 0) {
        const [sx, sy] = toScreen((FIN.wx + FIN.lx) / 2, -250), R = 64 * FIN.k;
        o.save(); o.globalCompositeOperation = "lighter"; o.globalAlpha = 0.5 * sun;
        o.drawImage(glowSprite("#ffd27a"), sx - R * 2.4, sy - R * 2.4, R * 4.8, R * 4.8);
        o.globalAlpha = 0.85 * sun; o.fillStyle = "#fff6dc"; o.beginPath(); o.arc(sx, sy, R * 0.55, 0, Math.PI * 2); o.fill();
        o.restore();
      }
      // a tumbleweed rolls between them during the stand-off
      const tw = fe(FT.ACT, FT.HIT - 200, t);
      if (tw > 0 && tw < 1) {
        const x = lerp(FIN.wx - FIN.dir * 300, FIN.lx + FIN.dir * 300, tw), y = -13 - Math.abs(Math.sin(tw * Math.PI * 4)) * 16;
        const [px_, py] = toScreen(x, y), r = 13 * FIN.k, rot = tw * 14 * FIN.dir;
        o.save(); o.translate(px_, py); o.rotate(rot); o.strokeStyle = "#8a6238"; o.lineWidth = Math.max(1, 1.6 * FIN.k * 0.6); o.lineCap = "round";
        for (let i = 0; i < 7; i++) { const a = i * 0.9; o.beginPath(); o.ellipse(0, 0, r, r * (0.45 + 0.08 * i), a, 0, Math.PI * 2); o.stroke(); }
        o.restore();
      }
      // the golden bullet's line from the muzzle through the loser
      const ln = fe(FT.HIT - 10, FT.HIT + 30, t) * (1 - fe(FT.HIT + 120, FT.HIT + 320, t));
      if (ln > 0) {
        const [mx, my] = FINS.gunslinger.muzzle(), [ax, ay] = toScreen(mx, my), [bx, by] = toScreen(FIN.lx + FIN.dir * 40, -32);
        o.save(); o.lineCap = "round"; o.globalCompositeOperation = "lighter";
        o.globalAlpha = 0.5 * ln; o.strokeStyle = "#ffcf3d"; o.lineWidth = 10 * FIN.k * 0.6; o.beginPath(); o.moveTo(ax, ay); o.lineTo(bx, by); o.stroke();
        o.globalAlpha = ln; o.strokeStyle = "#fff8dc"; o.lineWidth = 3 * FIN.k * 0.6; o.stroke();
        o.restore();
      }
    },
  },
  reaper: {
    // Last Rites: the light goes cold under a pale moon, wisps rise round his feet, the scythe comes from behind and under in one
    // rising hook; a huge pale crescent sweeps up through the loser, little souls float off, and he sets the scythe back on his shoulder
    col: "#c8ffe0",
    // the crescent: world points on an arc round his feet that passes through the loser (q 0..1 along it)
    arc: (q) => { const R = 150, cx = FIN.lx - FIN.dir * 145, a = lerp(0.02, -2.05, q); return [cx + FIN.dir * Math.cos(a) * R, 5 + Math.sin(a) * R]; },
    step(t, k) {
      const W = FIN.P[FIN.w];
      W.x = FIN.wx + FIN.dir * 24 * easeOut(fe(FT.HIT - 160, FT.HIT, t));
      if (t > FT.ACT && t < FT.HIT + 200) for (let i = 0; i < 0.6 * k; i++) part({ kind: "smoke", col: "#4a4458", wx: W.x + (Math.random() - 0.5) * 70, wy: -2, vx: (Math.random() - 0.5) * 0.3, vy: -0.5 - Math.random() * 0.5, life: 70, r: 7 + Math.random() * 5, grow: 0.1 });
      if (t > FT.HIT && t < FT.CARD) for (let i = 0; i < 0.25 * k; i++) part({ kind: "glow", col: "#c8ffe0", wx: FIN.lx + (Math.random() - 0.5) * 60, wy: -30 - Math.random() * 40, vx: (Math.random() - 0.5) * 0.6, vy: -0.8 - Math.random() * 0.7, life: 70, r: 4 + Math.random() * 3 });
      cueOnce("wind", FT.ACT, () => finSfx(() => Sfx.graveRise()));
      cueOnce("swing", FT.HIT - 160, () => finSfx(() => Sfx.harvest()));
      cueOnce("hit", FT.HIT, () => {
        FIN.shake = 14; finSfx(() => { Sfx.heavy("reaper", "hUp"); Sfx.ko(); });
        finRing(FIN.lx, -32, "#c8ffe0", 150);
        part({ kind: "glow", col: "#ffffff", wx: FIN.lx, wy: -32, life: 14, r: 30, grow: 1.6 });
        for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, sp = 2.5 + Math.random() * 6;
          part({ kind: "star", col: i % 3 ? "#ffffff" : "#c8ffe0", wx: FIN.lx, wy: -32, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, drag: 0.93, life: 26 + Math.random() * 14, r: 3 + Math.random() * 4 }); }
      });
    },
    pose(P, sk, t) {
      const back = [sk.w * 0.05, -sk.leg - sk.tor * 0.22], high = [sk.w * 0.75, -sk.leg - sk.tor * 1.05];
      if (t > FT.ACT && t < FT.HIT - 160) { P.crouch = 0.28; P.lean = -0.12; P.holdAng = Math.PI - 0.2; P.bladeS = 1; P.scyBack = true; return { hF: back, hB: [-sk.w * 0.3, -sk.leg - sk.tor * 0.3] }; }
      if (t >= FT.HIT - 160 && t < FT.HIT + 420) {
        const d = easeOut(fe(FT.HIT - 160, FT.HIT - 10, t));
        P.crouch = 0.28 * (1 - d); P.lean = -0.12 + 0.3 * d; P.holdAng = lerp(Math.PI - 0.2, -1.35, d); P.bladeS = lerp(1, -1, Math.min(1, d * 3)); P.scyBack = d < 0.3; P.mouth = d > 0.5 ? 1 : 0;
        const h = lerp2(back, high, d);
        return { hF: h, hB: [h[0] - Math.cos(P.holdAng) * 13, h[1] - Math.sin(P.holdAng) * 13], fF: [sk.w * 0.5, 0], fB: [-sk.w * 0.35, 0] };
      }
      if (t >= FT.HIT + 420 && t < FT.END) {   // the scythe back over his shoulder
        const q = easeOut(fe(FT.HIT + 420, FT.HIT + 650, t));
        P.holdAng = lerp(-1.35, -2.25, q); P.bladeS = lerp(-1, 1, q); P.lean = 0.18 * (1 - q) - 0.04;
        return { hF: lerp2(high, [sk.w * 0.62, -sk.leg - sk.tor * 0.75], q) };
      }
      return null;
    },
    draw(o, t) {
      // the light goes cold, a pale moon behind them
      const dim = fe(FT.CUT, FT.ACT, t) * (1 - fe(FT.CARD, FT.END, t));
      if (dim > 0) {
        o.save(); o.fillStyle = `rgba(16,14,36,${0.32 * dim})`; o.fillRect(0, 0, L.gw, L.gh);
        const [sx, sy] = toScreen((FIN.wx + FIN.lx) / 2 - FIN.dir * 110, -160), R = 40 * FIN.k;
        o.globalCompositeOperation = "lighter"; o.globalAlpha = 0.35 * dim; o.drawImage(glowSprite("#dfe8ff"), sx - R * 2.6, sy - R * 2.6, R * 5.2, R * 5.2);
        o.globalCompositeOperation = "source-over"; o.globalAlpha = 0.9 * dim; o.fillStyle = "#eef2ff"; o.beginPath(); o.arc(sx, sy, R * 0.6, 0, Math.PI * 2); o.fill();
        o.fillStyle = `rgba(16,14,36,${0.9 * dim})`; o.beginPath(); o.arc(sx + R * 0.26, sy - R * 0.12, R * 0.5, 0, Math.PI * 2); o.fill();   // a crescent moon
        o.restore();
      }
      // the reaping crescent, drawn as it sweeps (the tip leads), then fading
      const grow = fe(FT.HIT - 70, FT.HIT + 40, t), fade = 1 - fe(FT.HIT + 260, FT.HIT + 700, t);
      if (grow <= 0 || fade <= 0) return;
      const n = 24, thick = 26 * FIN.k * 0.6, Lp = [], Rp = [], arc = FINS.reaper.arc;
      for (let i = 0; i <= n; i++) {
        const q = (i / n) * grow, [x, y] = toScreen(...arc(q)), [x2, y2] = toScreen(...arc(Math.min(1, q + 0.01)));
        let dx = x2 - x, dy = y2 - y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const wd = thick * Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * i / n)), 0.6);
        Lp.push([x - dy * wd, y + dx * wd]); Rp.push([x + dy * wd * 0.25, y - dx * wd * 0.25]);
      }
      const shape = () => { o.beginPath(); Lp.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); for (let i = Rp.length - 1; i >= 0; i--) o.lineTo(Rp[i][0], Rp[i][1]); o.closePath(); };
      o.save();
      o.globalCompositeOperation = "lighter"; o.globalAlpha = 0.35 * fade; o.fillStyle = "#c8ffe0"; o.lineWidth = 10 * FIN.k * 0.6; o.lineJoin = "round"; o.strokeStyle = "#c8ffe0"; shape(); o.stroke();
      o.globalCompositeOperation = "source-over"; o.globalAlpha = 0.95 * fade; o.fillStyle = "#eef1f8"; shape(); o.fill();
      o.globalAlpha = fade; o.strokeStyle = "#ffffff"; o.lineWidth = 2.4 * FIN.k * 0.6; o.beginPath(); Rp.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); o.stroke();
      o.restore();
    },
  },
};
function finRing(wx, wy, col, r1) { part({ kind: "ring", col, wx, wy, life: 26, r: 10, grow: (r1 - 10) / 26, w: 4 }); }
function finStar(o, x, y, s, col) {
  o.fillStyle = col; o.beginPath(); o.moveTo(x, y - s); o.lineTo(x + s * 0.2, y - s * 0.2); o.lineTo(x + s, y); o.lineTo(x + s * 0.2, y + s * 0.2);
  o.lineTo(x, y + s); o.lineTo(x - s * 0.2, y + s * 0.2); o.lineTo(x - s, y); o.lineTo(x - s * 0.2, y - s * 0.2); o.closePath(); o.fill();
}
function finBolt(o, x0, y0, x1, y1, seed, a) {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = [[x0, y0]];
  for (let i = 1; i < 9; i++) { const q = i / 9; pts.push([lerp(x0, x1, q) + (r() - 0.5) * 60, lerp(y0, y1, q) + (r() - 0.5) * 16]); }
  pts.push([x1, y1]);
  const scr = pts.map(([x, y]) => toScreen(x, y));
  for (const [col, w] of [["#2f8f2a", 9], ["#7dff62", 4], ["#efffe8", 1.6]]) {
    o.strokeStyle = col; o.globalAlpha = a; o.lineWidth = w * FIN.k * 0.6;
    o.beginPath(); scr.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); o.stroke();
  }
  // one fork off a middle point
  const m = 3 + Math.floor(r() * 4), [fx_, fy_] = scr[m], [ex, ey] = toScreen(pts[m][0] + (r() - 0.5) * 140, pts[m][1] + 60 + r() * 50);
  o.strokeStyle = "#7dff62"; o.lineWidth = 2.5 * FIN.k * 0.6; o.beginPath(); o.moveTo(fx_, fy_); o.lineTo((fx_ + ex) / 2 + (r() - 0.5) * 20, (fy_ + ey) / 2); o.lineTo(ex, ey); o.stroke();
}

/* ---------- skeleton tweaks for the two puppets (called from pose()) ---------- */
function finPose(p, P, sk) {
  const t = FIN.t;
  if (p.finRole === "l") {
    // dazed until the hit; then flung, spinning, along the launch
    if (t < FT.HIT) { P.lean = Math.sin(t * 0.006) * 0.12; P.mouth = 0.3; return { hF: [sk.w * 0.75, -sk.leg - sk.tor * 0.3], hB: [-sk.w * 0.7, -sk.leg - sk.tor * 0.3] }; }
    P.lean = -0.5; P.mouth = 1; P.spin = t >= FLAUNCH_T ? ((t - FLAUNCH_T) / FMS) * 0.3 : 0;   // same spin the real tumble has
    return { hF: [sk.w * 0.6, -sk.leg - sk.tor * 1.2], hB: [-sk.w * 0.6, -sk.leg - sk.tor * 1.2], fF: [sk.w * 0.45, -sk.leg * 0.35] };
  }
  const o = FIN.kit.pose(P, sk, t);
  if (!o && t > FT.OUT) { P.mouth = 0.7; P.lean = -0.08; return { hF: [sk.w * 0.55, -sk.leg - sk.tor * 1.35] }; } // victory fist
  return o;
}

/* ---------- per-frame: puppets, camera, particles ---------- */
function finFrame(g, tk) {
  const now = performance.now(), dt = Math.min(80, now - FIN.last) * FIN.rate; FIN.last = now;
  if (!paused) FIN.t += dt;
  const t = FIN.t, k = dt / FMS;
  if (FIN.manga) return mangaTick(g, t, k);
  if (t >= FT.END) { finEnd(); return g; }
  if (t < FT.CUT) return g; // beat 0: the real hit plays (hitstop, then slow motion) under the camera punch-in
  if (!FIN.cut) {
    FIN.cut = true; fx.length = 0; sfx.length = 0; trails[0].length = trails[1].length = 0; combos[0] = combos[1] = null;
    hideBanner(); fxHitOff(); $("hud").hidden = true; $("ctl").hidden = true; releaseTouch();
    if (L.panel) { finFull = true; resize(); }
    finSfx(() => { Sfx.noise(0.18, 0.4, 3000); Sfx.tone(300, 1100, 0.14, "triangle", 0.06); });
  }
  fx.length = 0; sfx.length = 0; // the real match keeps running underneath: keep its dust and sparks out of the shot
  const W = FIN.P[FIN.w], Lp = FIN.P[FIN.l];
  W.x = FIN.wx; W.y = 0;
  FIN.kit.step(t, k);
  finFilter(FIN.kit.ink ? FIN.kit.ink(t) : 0);
  // where the loser would be if it kept flying (the camera follows this point even after the puppet has left)
  const lf = Math.max(0, (t - FLAUNCH_T) / FMS), trav = finTrav(lf), ctrav = Math.min(trav, 300), flx = FIN.lx + FIN.ldx * ctrav, fly = FIN.ldy * ctrav - 30;
  // camera: push in on the pair, follow the launch for a moment, then ease back for the name card
  const push = easeOut(fe(FT.CUT, FT.HIT, t)), wide = easeOut(fe(FLAUNCH_T, FLAUNCH_T + 420, t)), back = fe(FLAUNCH_T + 500, FT.END, t);
  const viewH = lerp(lerp(lerp(430, 245, push), 330, wide), 300, easeOut(back)), viewW = viewH * 1.45;
  const follow = 0.42 * easeOut(fe(FLAUNCH_T, FLAUNCH_T + 260, t)) * (1 - easeOut(fe(FLAUNCH_T + 380, FT.CARD + 200, t)));
  const bx = (FIN.wx + FIN.lx) / 2 + FIN.dir * 10, by = -80;
  cam.x = bx + (flx - bx) * follow; cam.y = by + (fly - by) * follow;
  cam.z = Math.min(L.gh / viewH, L.gw / Math.max(380, viewW * (L.portrait ? 0.62 : 1)));
  FIN.shake *= Math.pow(0.86, k);
  cam.sx = (Math.random() - 0.5) * FIN.shake * 2; cam.sy = (Math.random() - 0.5) * FIN.shake * 2;
  FIN.k = cam.z;
  finLoser(Lp, t, lf, trav);
  W.st++; Lp.st++;
  if (FIN.beam) {
    // the KO beam is pinned to the screen edge where the loser left; the effects layer takes world coordinates, so map the screen point back
    const bm = FIN.beam, bt = (t - bm.t0) / FMS;
    if (bt < 50) sfx.push({ k: "beam", wx: cam.x + (bm.sx - L.gw / 2 - cam.sx) / cam.z, wy: cam.y + (bm.sy - L.gh / 2 - cam.sy) / cam.z, t: bt, life: 50, col: bm.col, fries: bm.fries });
  }
  for (const p of FIN.parts) {
    if (p.delay > 0) { p.delay -= k; continue; }
    p.t += k; p.vy += p.g * k; p.vx *= Math.pow(p.drag, k); p.vy *= Math.pow(p.drag, k);
    p.wx += p.vx * k; p.wy += p.vy * k; p.r = Math.max(0.5, p.r + p.grow * k); p.rot += p.vr * k;
  }
  for (let i = FIN.parts.length - 1; i >= 0; i--) if (FIN.parts[i].t >= FIN.parts[i].life) FIN.parts.splice(i, 1);
  return { fighters: FIN.P, projs: [], hitstop: 0, phase: "end", t: g.t };
}
// the loser: dazed on the spot, a short impact freeze, then launched along the real launch direction, spinning, until it leaves the picture
function finLoser(Lp, t, lf, trav) {
  if (FIN.out) { if (FIN.trail.length) FIN.trail.shift(); return; }
  Lp.flash = t >= FIN.hit && t < FIN.launch ? 2 : 0;   // white silhouette during the impact freeze
  if (t < FIN.launch) { Lp.x = FIN.lx - (t >= FIN.hit ? FIN.dir * 5 : 0); Lp.y = 0; return; }
  Lp.x = FIN.lx + FIN.ldx * trav; Lp.y = FIN.ldy * trav;
  const mid = [Lp.x, Lp.y - Lp.s.h * 0.5];
  const [sx, sy] = toScreen(mid[0], mid[1]);
  const barH = FIN.manga ? 0 : easeOut(fe(0, 240, t)) * L.gh * 0.11, m = Lp.s.h * 0.3 * FIN.k;
  if (sx > m && sx < L.gw - m && sy > barH + m && sy < L.gh - barH - m) {
    FIN.lastIn = mid;
    if (FIN.trail.push(mid) > 14) FIN.trail.shift();
    cueOnce("whoosh", FIN.launch, () => finSfx(() => { Sfx.noise(0.4, 0.45, 2600); Sfx.tone(260, 1000, 0.3, "triangle", 0.05); }));
    if (t < FIN.hit + 800) return;   // (past that it is sent out regardless)
  }
  finOut(Lp, sx, sy);
}
// the loser crosses the edge of the picture: KO beam and flash there, fries and chips burst back into the shot
function finOut(Lp, sx, sy) {
  FIN.out = true; Lp.state = "gone";
  const barH = FIN.manga ? 0 : easeOut(fe(0, 240, FIN.t)) * L.gh * 0.11;
  const ex = clamp(sx, 0, L.gw), ey = clamp(sy, barH, L.gh - barH);
  FIN.beam = { sx: ex, sy: ey, t0: FIN.t, col: col(Lp.pal),
    fries: Array.from({ length: 8 }, () => ({ da: (Math.random() - 0.5) * 1.1, sp: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, len: 12 + Math.random() * 8 })) };
  FIN.flashes.push({ t0: FIN.t, dur: 230, a: 0.5 });
  FIN.shake = 22;
  const [wx, wy] = FIN.lastIn || [Lp.x, Lp.y - Lp.s.h * 0.5], back = Math.atan2(-FIN.ldy, -FIN.ldx);
  finRing(wx, wy, "#ffffff", 150);
  part({ kind: "puff", col: "#ffffff", wx, wy, life: 22, r: 22, grow: 2.4 });
  for (let i = 0; i < 9; i++) part({ kind: "puff", col: "#d9d4ea", wx: wx + (Math.random() - 0.5) * 40, wy: wy + (Math.random() - 0.5) * 40, vx: Math.cos(back) * 3 + (Math.random() - 0.5) * 3, vy: Math.sin(back) * 3 + (Math.random() - 0.5) * 3, drag: 0.92, life: 30, r: 10, grow: 0.5 });
  for (let i = 0; i < 14; i++) {
    const a = back + (Math.random() - 0.5) * 1.9, sp = 4 + Math.random() * 8;
    part({ kind: "fry", col: "#f2c14e", wx, wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: 0.34, life: 110 + Math.random() * 30, r: 9 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
  }
  for (let i = 0; i < 10; i++) {
    const a = back + (Math.random() - 0.5) * 2.2, sp = 3 + Math.random() * 7;
    part({ kind: "chip", col: "#f2c14e", wx, wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.3, life: 80, r: 7, rot: Math.random() * 6, vr: 0.25, delay: i * 1.5 });
  }
  finSfx(() => { Sfx.ko(); setTimeout(() => Sfx.fry(), 70); });
}
/* ---------- drawing ---------- */
// behind the stage: darken the sky and light the winner from behind
function finSkyTint(c) {
  if (!FIN.on || !FIN.cut) return;
  const a = fe(FT.CUT, FT.CUT + 250, FIN.t);
  c.fillStyle = `rgba(6,5,16,${0.62 * a})`; c.fillRect(0, 0, L.gw, L.gh);
  const [x, y] = toScreen(FIN.wx, -60), R = Math.max(L.gw, L.gh) * 0.5;
  const gr = c.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, rgba(FIN.kit.col, 0.35 * a)); gr.addColorStop(1, rgba(FIN.kit.col, 0));
  c.fillStyle = gr; c.fillRect(0, 0, L.gw, L.gh);
}
// the staged scene's own shapes: the loser's trail and dizzy stars, particles, the kit's shapes
function finScene(o, t) {
  // streak behind the flying loser
  if (FIN.trail.length > 1 && !FIN.manga) {
    const col_ = col(FIN.P[FIN.l].pal);
    o.lineCap = "round"; o.lineJoin = "round";
    for (let i = 1; i < FIN.trail.length; i++) {
      const a = i / FIN.trail.length, [x0, y0] = toScreen(FIN.trail[i - 1][0], FIN.trail[i - 1][1]), [x1, y1] = toScreen(FIN.trail[i][0], FIN.trail[i][1]);
      o.strokeStyle = rgba(col_, 0.45 * a); o.lineWidth = FIN.P[FIN.l].s.w * 0.9 * a * FIN.k; o.beginPath(); o.moveTo(x0, y0); o.lineTo(x1, y1); o.stroke();
      o.strokeStyle = `rgba(255,255,255,${0.7 * a})`; o.lineWidth = 3 * a * FIN.k + 0.5; o.stroke();
    }
  }
  // the loser's dizzy stars
  if (t < FT.HIT && !FIN.manga) { const Lp = FIN.P[FIN.l]; for (let i = 0; i < 3; i++) { const a = t * 0.006 + (i / 3) * Math.PI * 2, [sx, sy] = toScreen(Lp.x + Math.cos(a) * 18, headY(Lp) - 26 + Math.sin(a) * 5); finStar(o, sx, sy, 5 * FIN.k, "#f6d77a"); } }
  // particles
  for (const p of FIN.parts) {
    if (p.delay > 0) continue;
    const q = p.t / p.life, a = 1 - q, [x, y] = toScreen(p.wx, p.wy), r = p.r * FIN.k;
    if (p.kind === "glow" || p.kind === "ember") {
      o.globalCompositeOperation = "lighter"; o.globalAlpha = p.kind === "ember" ? Math.min(1, a * 2) : a * 0.6;
      const s = p.kind === "ember" ? r * 3 : r * 2; o.drawImage(glowSprite(p.col), x - s, y - s, s * 2, s * 2);
      o.globalCompositeOperation = "source-over";
    } else if (p.kind === "smoke" || p.kind === "vapour" || p.kind === "puff") {
      o.globalAlpha = (p.kind === "puff" ? 0.8 : p.kind === "smoke" ? 0.3 : 0.3) * a; const s = r * 1.6; o.drawImage(glowSprite(p.col), x - s, y - s, s * 2, s * 2);
    } else if (p.kind === "ring") {
      o.globalCompositeOperation = "lighter"; o.globalAlpha = a; o.strokeStyle = p.col; o.lineWidth = (p.w || 3) * a * FIN.k * 0.7 + 1;
      o.beginPath(); o.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); o.stroke(); o.globalCompositeOperation = "source-over";
    } else if (p.kind === "shard") {
      o.globalAlpha = a; o.fillStyle = p.col; o.save(); o.translate(x, y); o.rotate(p.rot);
      o.beginPath(); o.moveTo(r, 0); o.lineTo(-r * 0.5, r * 0.3); o.lineTo(-r * 0.5, -r * 0.3); o.closePath(); o.fill(); o.restore();
    } else if (p.kind === "star") {
      o.globalCompositeOperation = "lighter"; o.globalAlpha = a; finStar(o, x, y, r * (0.6 + 0.4 * a), p.col); o.globalCompositeOperation = "source-over";
    } else if (p.kind === "line") {
      o.globalAlpha = a * 0.8; o.strokeStyle = p.col; o.lineWidth = 2; o.beginPath(); o.moveTo(x, y); o.lineTo(x - p.vx * 3 * FIN.k, y); o.stroke();
    } else if (p.kind === "petal") {
      o.globalAlpha = Math.min(1, a * 3); o.fillStyle = p.col; o.save(); o.translate(x, y); o.rotate(p.rot); o.scale(1, 0.55 + 0.45 * Math.sin(p.t * 0.12));
      o.beginPath(); o.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); o.fill(); o.restore();
    } else if (p.kind === "fry") {
      o.globalAlpha = Math.min(1, a * 4); o.save(); o.translate(x, y); o.rotate(p.rot);
      o.fillStyle = FIN.manga ? MG_PAPER : p.col; o.strokeStyle = FIN.manga ? MG_INK : "rgba(14,16,34,0.85)"; o.lineWidth = FIN.manga ? 2 : 1.5;   // (on a manga page: ink and paper)
      o.beginPath(); o.roundRect(-r, -r * 0.22, r * 2, r * 0.44, r * 0.12); o.fill(); o.stroke(); o.restore();
    } else if (p.kind === "chip") {
      o.globalAlpha = Math.min(1, a * 2); o.save(); o.translate(x, y); o.rotate(p.rot); o.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(p.t * 0.25)));
      o.fillStyle = FIN.manga ? MG_PAPER : "#f2c14e"; o.strokeStyle = FIN.manga ? MG_INK : "#9a6a1e"; o.lineWidth = FIN.manga ? 2 : 1.5; o.beginPath(); o.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); o.fill(); o.stroke();
      if (!FIN.manga) { o.strokeStyle = "rgba(255,255,255,0.6)"; o.beginPath(); o.arc(-r * 0.2, -r * 0.2, r * 0.45, Math.PI, Math.PI * 1.6); o.stroke(); }
      o.restore();
    }
  }
  o.globalAlpha = 1; o.globalCompositeOperation = "source-over";
  FIN.kit.draw(o, t);
}
function finOverlay(o, tk) {
  if (!FIN.on) return;
  if (FIN.manga) { mangaOverlay(o, tk); return; }
  const t = FIN.t;
  o.save(); o.setTransform(DPR, 0, 0, DPR, 0, 0);
  o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
  if (FIN.cut) finScene(o, t);
  // white frames: the cut (rises just before it, falls after), the winner's impact, the loser leaving the picture
  let fl = fe(FT.CUT - 90, FT.CUT, t) * (1 - fe(FT.CUT, FT.CUT + 220, t)) * 0.95;
  if (t >= FT.HIT) fl = Math.max(fl, (1 - fe(FT.HIT, FT.HIT + 140, t)) * 0.45);
  for (const f of FIN.flashes) fl = Math.max(fl, f.a * (1 - fe(f.t0, f.t0 + f.dur, t)));
  if (fl > 0.01) { o.fillStyle = `rgba(255,250,240,${fl.toFixed(3)})`; o.fillRect(0, 0, L.gw, L.gh); }
  if (FIN.cut) finCard(o, t);
  // black bars (they slide in with the real hit, before the cut)
  const bar = easeOut(fe(0, 240, t)) * L.gh * 0.11;
  o.fillStyle = "#05050b"; o.fillRect(0, 0, L.gw, bar); o.fillRect(0, L.gh - bar, L.gw, bar);
  if (bar > 14 && FIN.cut) {
    o.font = `600 ${Math.round(clamp(bar * 0.34, 10, 14))}px system-ui, sans-serif`; o.textAlign = "right"; o.textBaseline = "middle";
    o.fillStyle = "rgba(217,212,234,0.6)"; o.fillText(touchUI ? "Tap to skip" : "Click or press a key to skip", L.gw - 16, L.gh - bar / 2);
  }
  // fade towards the results screen
  const fade = fe(FT.END - 260, FT.END, t);
  if (fade > 0) { o.fillStyle = `rgba(14,16,34,${0.85 * fade})`; o.fillRect(0, 0, L.gw, L.gh); }
  o.restore();
}
// name card: a slanted band in the winner's color, the name, and a K.O. stamp
function finCard(o, t) {
  const k = fe(FT.CARD, FT.CARD + 260, t);
  if (k <= 0) return;
  const W = FIN.P[FIN.w], c1 = col(W.pal), h = Math.min(L.gh * 0.18, 92), y = L.gh * 0.11 + h * 0.5 + L.gh * 0.05, slide = (1 - easeOut(k)) * L.gw * FIN.dir;
  o.save(); o.translate(slide, 0);
  o.globalAlpha = 0.92; o.fillStyle = "#0e1022";
  o.beginPath(); o.moveTo(-20, y - h / 2 + 14); o.lineTo(L.gw + 20, y - h / 2 - 14); o.lineTo(L.gw + 20, y + h / 2 - 14); o.lineTo(-20, y + h / 2 + 14); o.closePath(); o.fill();
  o.globalAlpha = 1; o.fillStyle = c1;
  o.beginPath(); o.moveTo(-20, y + h / 2 + 8); o.lineTo(L.gw + 20, y + h / 2 - 20); o.lineTo(L.gw + 20, y + h / 2 - 12); o.lineTo(-20, y + h / 2 + 16); o.closePath(); o.fill();
  const fs = Math.round(h * 0.62);
  o.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`; o.textBaseline = "middle"; o.textAlign = "left";
  const x = Math.max(18, L.gw * 0.08);
  o.fillStyle = "#f4f2ec"; o.fillText(W.spec.name.toUpperCase(), x, y);
  const nw = o.measureText(W.spec.name.toUpperCase()).width;
  o.font = `700 ${Math.round(fs * 0.36)}px "Barlow Condensed", "Arial Narrow", sans-serif`; o.fillStyle = c1;
  o.fillText(W.slot === meSlot ? "YOU WIN" : "WINS", x + nw + 12, y + fs * 0.12);
  o.restore();
  // K.O. stamp
  const s = fe(FT.CARD + 180, FT.CARD + 420, t);
  if (s > 0) {
    const bandY = L.gh * 0.11 + Math.min(L.gh * 0.18, 92) * 0.5 + L.gh * 0.05, narrow = L.gw < 560;
    const sc = 1 + 1.6 * (1 - easeOut(s)), kx = narrow ? L.gw * 0.5 : L.gw * 0.8, ky = narrow ? bandY + Math.min(L.gh * 0.18, 92) * 1.3 : bandY;
    o.save(); o.translate(kx, ky); o.rotate(-0.12); o.scale(sc, sc); o.globalAlpha = Math.min(1, s * 2);
    o.font = `800 ${Math.round(Math.min(L.gh * 0.2, 110))}px "Barlow Condensed", "Arial Narrow", sans-serif`; o.textAlign = "center"; o.textBaseline = "middle";
    o.lineJoin = "round"; o.lineWidth = 10; o.strokeStyle = "#0e1022"; o.strokeText("K.O.", 0, 0);
    o.fillStyle = "#ff6a3d"; o.fillText("K.O.", 0, 0);
    o.restore();
  }
}
