/* ===================== KO finisher cinematic =====================
   Plays on the KO that ends a match (not on time-outs, draws or the tutorial). It is only a show:
   the simulation has already decided the match, so nothing here touches G or online sync.
   Two stand-ins ("puppets") copy the winner and the loser onto the main stage, the camera pushes in
   behind black bars, the winner does a big version of their signature move, the loser pops into
   fries, then a name card. A tap or key skips it; the results screen opens when it ends. */
const FIN = { on: false, t: 0, last: 0, w: 0, l: 0, wx: 0, lx: 0, dir: 1, kit: null, P: [null, null],
  parts: [], shake: 0, popped: false, done: false, cue: {}, finish: null, k: 1, use3D: false, rnd: [], rate: 1 }; // rate: tests slow or freeze it
// timeline, in ms after the final KO
const FT = { CUT: 550, ACT: 1150, HIT: 1750, POP: 2100, CARD: 2450, END: 3600 };
function finWanted(g) {
  return mode === "match" && match && !match.tutorial && g.endReason === "stocks" && (g.winner === 0 || g.winner === 1);
}
function finStart(g) {
  const W = g.fighters[g.winner], Lf = g.fighters[1 - g.winner];
  FIN.on = true; FIN.t = 0; FIN.last = performance.now(); FIN.w = g.winner; FIN.l = 1 - g.winner;
  FIN.wx = clamp(Math.round(W.x), -190, 190);
  FIN.dir = Lf.x >= W.x ? 1 : -1;
  if (Math.abs(FIN.wx + FIN.dir * 130) > 250) FIN.dir = -FIN.dir;
  FIN.lx = FIN.wx + FIN.dir * 130;
  FIN.kit = FINS[W.spec.id] || FINS.phoenix;
  FIN.parts.length = 0; FIN.shake = 0; FIN.popped = false; FIN.done = false; FIN.cue = {}; FIN.finish = null; FIN.cut = false;
  FIN.rnd = Array.from({ length: 24 }, () => Math.random());
  FIN.P = [null, null];
  FIN.P[FIN.w] = finPuppet(W, FIN.wx, FIN.dir, "w");
  FIN.P[FIN.l] = finPuppet(Lf, FIN.lx, -FIN.dir, "l");
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
  FIN.on = false; cam.yaw = 0; FIN.parts.length = 0; finFilter(0);
  if (finFull) { finFull = false; resize(); }
  const fn = FIN.finish || (() => { if (match && match.online) finishOnline(false); else finishMatch(false); });
  FIN.finish = null;
  if (mode === "match") fn();
}
function finStop() { FIN.on = false; FIN.finish = null; cam.yaw = 0; FIN.parts.length = 0; finFilter(0); if (finFull) { finFull = false; resize(); } }
// Samurai's ink frame turns the scene itself black and white (the canvases under the effects layer)
function finFilter(v) {
  const f = v > 0 ? `grayscale(${v.toFixed(2)}) contrast(${(1 + 0.9 * v).toFixed(2)}) brightness(${(1 + 0.2 * v).toFixed(2)})` : "";
  if (FIN.filter === f) return;
  FIN.filter = f; cv.style.filter = f; glcv.style.filter = f;
}
// Skipping only counts once the cinematic is on screen, so buttons still being mashed at the KO don't skip it.
function finSkip(e) {
  if (!FIN.on || FIN.t < FT.CUT + 400) return;
  if (e) { e.preventDefault(); e.stopPropagation(); }
  FIN.skipAt = performance.now();
  finEnd();
}
app.addEventListener("pointerdown", finSkip, true);
// the tap that skipped must not also press a button on the results screen that opens under the finger
app.addEventListener("click", (e) => { if (performance.now() - (FIN.skipAt || 0) < 450) { e.preventDefault(); e.stopPropagation(); } }, true);
window.addEventListener("keydown", (e) => { if (FIN.on && !e.repeat) finSkip(e); }, true);

/* ---------- helpers ---------- */
const fe = (a, b, t) => clamp((t - a) / (b - a), 0, 1);   // 0..1 progress of t through [a, b]
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;
function finProj(wx, wy) {
  if (FIN.use3D && cam.yaw) {
    const v = tv(7).set(wx, -wy, 0).project(R3.camera);
    return [(v.x + 1) / 2 * L.gw + cam.sx, (1 - v.y) / 2 * L.gh + cam.sy];
  }
  return toScreen(wx, wy);
}
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
        const [px_, py] = finProj(x, y), s = FIN.k * 1.15, ang = Math.atan2(200 - 30, 240);
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
        const [px_, py] = finProj(x, y), s = FIN.k;
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
        const [cx, cy] = finProj(FIN.lx, -4), R = 58 * FIN.k * (0.6 + 0.4 * easeOut(ring));
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
        const [px_, py] = finProj(x, y), s = FIN.k * (Math.sin(a) > 0 ? 1.1 : 0.85), fl = Math.sin(t * 0.03 + i) * 0.8;
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
        const [ax, ay] = finProj(hx - FIN.dir * 40, hy), [bx, by] = finProj(hx + FIN.dir * 90 * sp, hy);
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
        const P_ = pts.map(([x, y]) => finProj(FIN.lx + x * 0.9, y + 40));
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
        const [px_, py] = finProj(x, y), [tx, ty] = finProj(x, y - 120), s = FIN.k;
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
        for (let j = 0; j <= 10; j++) { const [sx, sy] = finProj(bx + Math.sin(t * 0.012 + j * 0.9 + i) * 6, -60 - j * 14 - i * 6); j ? o.lineTo(sx, sy) : o.moveTo(sx, sy); }
        o.stroke();
      }
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
  const scr = pts.map(([x, y]) => finProj(x, y));
  for (const [col, w] of [["#2f8f2a", 9], ["#7dff62", 4], ["#efffe8", 1.6]]) {
    o.strokeStyle = col; o.globalAlpha = a; o.lineWidth = w * FIN.k * 0.6;
    o.beginPath(); scr.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); o.stroke();
  }
  // one fork off a middle point
  const m = 3 + Math.floor(r() * 4), [fx_, fy_] = scr[m], [ex, ey] = finProj(pts[m][0] + (r() - 0.5) * 140, pts[m][1] + 60 + r() * 50);
  o.strokeStyle = "#7dff62"; o.lineWidth = 2.5 * FIN.k * 0.6; o.beginPath(); o.moveTo(fx_, fy_); o.lineTo((fx_ + ex) / 2 + (r() - 0.5) * 20, (fy_ + ey) / 2); o.lineTo(ex, ey); o.stroke();
}

/* ---------- skeleton tweaks for the two puppets (called from pose()) ---------- */
function finPose(p, P, sk) {
  const t = FIN.t;
  if (p.finRole === "l") {
    // dazed until the hit, then knocked back
    if (t < FT.HIT) { P.lean = Math.sin(t * 0.006) * 0.12; P.mouth = 0.3; return { hF: [sk.w * 0.75, -sk.leg - sk.tor * 0.3], hB: [-sk.w * 0.7, -sk.leg - sk.tor * 0.3] }; }
    P.lean = -0.5; P.mouth = 1; P.spin = 0;
    return { hF: [sk.w * 0.6, -sk.leg - sk.tor * 1.2], hB: [-sk.w * 0.6, -sk.leg - sk.tor * 1.2], fF: [sk.w * 0.45, -sk.leg * 0.35] };
  }
  const o = FIN.kit.pose(P, sk, t);
  if (!o && t > FT.POP) { P.mouth = 0.7; P.lean = -0.08; return { hF: [sk.w * 0.55, -sk.leg - sk.tor * 1.35] }; } // victory fist
  return o;
}

/* ---------- per-frame: puppets, camera, particles ---------- */
function finFrame(g, tk) {
  const now = performance.now(), dt = Math.min(80, now - FIN.last) * FIN.rate; FIN.last = now;
  if (!paused) FIN.t += dt;
  const t = FIN.t, k = dt / (1000 / 60);
  if (t >= FT.END) { finEnd(); return g; }
  if (t < FT.CUT) return g; // the real KO plays first
  if (!FIN.cut) {
    FIN.cut = true; fx.length = 0; sfx.length = 0; trails[0].length = trails[1].length = 0; combos[0] = combos[1] = null;
    hideBanner(); $("hud").hidden = true; $("ctl").hidden = true; releaseTouch();
    if (L.panel) { finFull = true; resize(); }
  }
  FIN.use3D = use3D();
  fx.length = 0; sfx.length = 0; // the real match keeps running underneath: keep its dust and sparks out of the shot
  const W = FIN.P[FIN.w], Lp = FIN.P[FIN.l];
  W.x = FIN.wx; W.y = 0;
  FIN.kit.step(t, k);
  finFilter(FIN.kit.ink ? FIN.kit.ink(t) : 0);
  // loser: knocked back at the hit, pops into fries a moment later
  if (t >= FT.HIT && !FIN.popped) { const q = fe(FT.HIT, FT.POP, t); Lp.x = FIN.lx + FIN.dir * 40 * easeOut(q); Lp.y = -26 * Math.sin(q * Math.PI); Lp.flash = (Math.floor(t / 50) % 2) * 2; }
  if (t >= FT.POP && !FIN.popped) finPop(Lp);
  W.st++; Lp.st++;
  // camera: push in on the pair, swing a little round, then ease back for the name card
  const push = easeOut(fe(FT.CUT, FT.HIT, t)), back = fe(FT.POP, FT.END, t);
  const viewH = lerp(lerp(430, 245, push), 300, easeOut(back)), viewW = viewH * 1.45;
  const cx = (FIN.wx + FIN.lx) / 2 + FIN.dir * 10, cy = -80;
  cam.x = cx; cam.y = cy;
  cam.z = Math.min(L.gh / viewH, L.gw / Math.max(380, viewW * (L.portrait ? 0.62 : 1)));
  cam.yaw = FIN.use3D ? -FIN.dir * 0.2 * easeOut(fe(FT.CUT, FT.CARD, t)) : 0;
  FIN.shake *= Math.pow(0.86, k);
  cam.sx = (Math.random() - 0.5) * FIN.shake * 2; cam.sy = (Math.random() - 0.5) * FIN.shake * 2;
  FIN.k = cam.z;
  for (const p of FIN.parts) {
    if (p.delay > 0) { p.delay -= k; continue; }
    p.t += k; p.vy += p.g * k; p.vx *= Math.pow(p.drag, k); p.vy *= Math.pow(p.drag, k);
    p.wx += p.vx * k; p.wy += p.vy * k; p.r = Math.max(0.5, p.r + p.grow * k); p.rot += p.vr * k;
  }
  for (let i = FIN.parts.length - 1; i >= 0; i--) if (FIN.parts[i].t >= FIN.parts[i].life) FIN.parts.splice(i, 1);
  return { fighters: FIN.P, projs: [], hitstop: 0, phase: "end", t: g.t };
}
function finPop(Lp) {
  FIN.popped = true; Lp.state = "gone";
  finSfx(() => Sfx.fry());
  part({ kind: "puff", col: "#ffffff", wx: Lp.x, wy: -30, life: 24, r: 20, grow: 2.2 });
  for (let i = 0; i < 10; i++) part({ kind: "puff", col: "#d9d4ea", wx: Lp.x + (Math.random() - 0.5) * 40, wy: -20 - Math.random() * 30, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3, drag: 0.92, life: 30, r: 10, grow: 0.5 });
  for (let i = 0; i < 9; i++) part({ kind: "fry", col: "#f2c14e", wx: Lp.x + (Math.random() - 0.5) * 24, wy: -30, vx: (Math.random() - 0.5) * 7, vy: -6 - Math.random() * 5, g: 0.45, life: 300, r: 9 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, floor: -3 });
  for (let i = 0; i < 8; i++) part({ kind: "chip", col: "#f2c14e", wx: Lp.x, wy: -40, vx: FIN.dir * (1 + Math.random() * 4) + (Math.random() - 0.5) * 4, vy: -9 - Math.random() * 6, g: 0.32, life: 70, r: 7, rot: Math.random() * 6, vr: 0.25, delay: i * 2 });
}
// fries land and stay in a little pile
function finFloor() { for (const p of FIN.parts) if (p.floor !== undefined && p.wy > p.floor) { p.wy = p.floor; p.vy = 0; p.vx *= 0.6; p.vr *= 0.5; } }

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
function finOverlay(o, tk) {
  if (!FIN.on || !FIN.cut) return;
  const t = FIN.t;
  finFloor();
  o.save(); o.setTransform(DPR, 0, 0, DPR, 0, 0);
  o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
  // the loser's dizzy stars
  if (t < FT.HIT) { const Lp = FIN.P[FIN.l]; for (let i = 0; i < 3; i++) { const a = t * 0.006 + (i / 3) * Math.PI * 2, [sx, sy] = finProj(Lp.x + Math.cos(a) * 18, headY(Lp) - 26 + Math.sin(a) * 5); finStar(o, sx, sy, 5 * FIN.k, "#f6d77a"); } }
  // particles
  for (const p of FIN.parts) {
    if (p.delay > 0) continue;
    const q = p.t / p.life, a = 1 - q, [x, y] = finProj(p.wx, p.wy), r = p.r * FIN.k;
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
      o.fillStyle = p.col; o.strokeStyle = "rgba(14,16,34,0.85)"; o.lineWidth = 1.5;
      o.beginPath(); o.roundRect(-r, -r * 0.22, r * 2, r * 0.44, r * 0.12); o.fill(); o.stroke(); o.restore();
    } else if (p.kind === "chip") {
      o.globalAlpha = Math.min(1, a * 2); o.save(); o.translate(x, y); o.rotate(p.rot); o.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(p.t * 0.25)));
      o.fillStyle = "#f2c14e"; o.strokeStyle = "#9a6a1e"; o.lineWidth = 1.5; o.beginPath(); o.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); o.fill(); o.stroke();
      o.strokeStyle = "rgba(255,255,255,0.6)"; o.beginPath(); o.arc(-r * 0.2, -r * 0.2, r * 0.45, Math.PI, Math.PI * 1.6); o.stroke(); o.restore();
    }
  }
  o.globalAlpha = 1; o.globalCompositeOperation = "source-over";
  FIN.kit.draw(o, t);
  // impact flash
  const fl = 1 - fe(FT.HIT, FT.HIT + 140, t);
  if (t >= FT.HIT && fl > 0) { o.fillStyle = `rgba(255,250,240,${0.32 * fl})`; o.fillRect(0, 0, L.gw, L.gh); }
  finCard(o, t);
  // black bars
  const bar = easeOut(fe(FT.CUT, FT.CUT + 260, t)) * L.gh * 0.11;
  o.fillStyle = "#05050b"; o.fillRect(0, 0, L.gw, bar); o.fillRect(0, L.gh - bar, L.gw, bar);
  if (bar > 14) {
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
