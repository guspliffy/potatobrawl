/* ===================== Bosses: Old Scratch's drawing, his fire, his tells on the floor, his sounds (UI only) =====================
   The simulation (core.js BOSSES, bossAct/bossStep/bossHit) never reads anything here. Hooks: drawFighter (draw-fighters.js) hands a
   boss to drawBoss, drawProj (draw-world.js) offers every projectile to drawBossProj first, render2D (effects.js) calls bossFloor after
   the stage, handleEvent (effects.js) passes every event to bossEvent.
   Fable's design: /mnt/project-files/boss/fable-boss.md section 1 (world units, 60 frames a second). Old Scratch is the roster's
   potato at rx 50 / ry 62, roasted, with bone horns, cloven hooves, a spade tail, a rope belt with a potato buckle and a pitchfork.
   Every move has a tell on his body (pose, face, the tines lighting) and one on the floor (bossFloor), then its strike and its end
   lag (the punish window). His face changes with what he is doing: smug at rest, wide-eyed in a wind-up, roaring in a strike, spiral
   eyes when staggered, eyes squeezed shut when broken, the red rage face below rageAt % HP.
   Reads the fighter, the game and its projectiles only (never writes them). Once-per-tick work (cues, particles, sounds) runs from
   bossFloor when the UI tick has moved on (bsTick). Gradients are made once per canvas context, the glow is one sprite, no shadowBlur. */
const BS = {
  hi: "#e06a4a", mid: "#b8402e", lo: "#6e1f18", char: "#3a1a14", ember: "#ff9a3a", hoof: "#2a2024", horn: "#f2d9a8", hornSh: "#a68a5c",
  shaft: "#3a2a24", steel: "#c9ced8", tine: "#ff7a2b", eye: "#ffd84a", rope: "#2a1f1c", brass: "#d9a531", tooth: "#f6efe0", throat: "#ff6a2b",
  tongue: "#e05a68", sweat: "#cfe8ff", rage: "#ff3b2b", dim: "#8a2a1a", gold: "#ffd84a", mouth: "#3a0e0c",
};
const BS_N = { mid: BS.mid, limb: BS.lo, key: "n" }, BS_D = { mid: BS.dim, limb: "#5a2018", key: "b" }, BS_W = { mid: "#ffffff", limb: "#ffffff", key: "w" };   // normal / broken (his reds fade) / hit flash
const BS_P = { rx: 50, ry: 62, cy: -80 };   // the body in potatoPath's units: 100 x 124, its bottom 18 over the hooves (horns to hooves 156)
const BS_HIP = -26, BS_FX = 10, BS_EY = -95.5, BS_MY = -70;   // hip pivot; the face's centre line (towards his front), eye line, mouth
const BS_TAU = Math.PI * 2;
const BS_PATCH = [[-45, -104, 7, 5, 0.6], [47, -66, 6.5, 4.5, -0.4], [-40, -40, 8, 5.5, 0.3], [26, -137, 6, 4, 0.2]];   // charred patches on the rim: x, y, rx, ry, angle
// ember cracks low on the body: x, y, pulse phase, the crack's points, and one branch (from point b to the last pair)
const BS_CRACK = [[-34, -36, 0, [[0, 0], [4, -3], [6, 2], [11, -1], [15, 4]], 2, [8, 8]], [0, -26, 2.1, [[0, 0], [3, 4], [8, 3], [10, 9]], 1, [-1, 9]], [30, -38, 4.2, [[0, 0], [-3, 4], [1, 8], [-1, 14]], 2, [5, 11]]];
const BS_IDLE = { lean: 0, drop: 0, fF: [22, 0], fB: [-20, 0], hF: [50, -62], hB: [-50, -58], fa: -1.85, fg: 60 };
const bsOut = (x) => 1 - (1 - x) * (1 - x);
const bsMix2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ---- cached art: the body path, his gradients (per canvas context: the KO page draws on its own layer), the fire glow sprite ----
let BS_PATH = null, BS_GLOW = null;
const bsGradCache = new WeakMap();
function bsPath() {
  if (BS_PATH) return BS_PATH;
  const p = new Path2D(), { rx, ry, cy } = BS_P;   // potatoPath's outline, made once
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * BS_TAU, bump = 1 + 0.025 * Math.sin(a * 4 + 0.7) + 0.015 * Math.sin(a * 7 + 2), wide = 1 + 0.07 * Math.sin(a);
    const x = Math.cos(a) * rx * bump * wide, y = cy + Math.sin(a) * ry * bump;
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return (BS_PATH = p);
}
function bsGrads(c) {
  let G0 = bsGradCache.get(c);
  if (!G0) {
    const { rx, ry, cy } = BS_P;
    const mk = (a, b, d) => { const g = c.createRadialGradient(-rx * 0.35, cy - ry * 0.45, ry * 0.1, 0, cy, ry * 1.3); g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, d); return g; };
    G0 = { n: mk(BS.hi, BS.mid, BS.lo), b: mk("#9a4634", BS.dim, "#4a1810"), w: "#ffffff" };
    bsGradCache.set(c, G0);
  }
  return G0;
}
function bsGlow() {
  if (BS_GLOW) return BS_GLOW;
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const x = cv.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,170,80,0.9)"); g.addColorStop(0.4, "rgba(255,110,40,0.4)"); g.addColorStop(1, "rgba(255,80,30,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (BS_GLOW = cv);
}
function bsGlowAt(c, x, y, r, a) { if (a <= 0 || r <= 0) return; const ga = c.globalAlpha; c.globalAlpha = ga * Math.min(1, a); c.drawImage(bsGlow(), x - r, y - r, r * 2, r * 2); c.globalAlpha = ga; }

// ---- who and what ----
function bsOf(g) { if (g) for (const f of g.fighters) if (f.spec.boss) return f; return null; }
// a boss's layer drawn in screen space after the fight, before the HUD (BOSS_ART[id].screen; Kraken Spud's ink)
function bossScreen(c, g, tk) { const A = bossArt(bsOf(g)); if (A && A.screen) A.screen(c, g, tk); }
function bsRage(f) {
  const lv = RG && RG.lv != null ? RG.lv : 0, B = f.spec.boss;
  return !!B && f.hpMax > 0 && f.hp * 100 <= f.hpMax * B.rageAt[clamp(lv, 0, 2)];
}
// the move being played: phase 0 tell (mt <= startup), 1 strike, 2 end lag; k = progress through that phase
function bsPhase(f) {
  const m = f.move;
  if (f.state !== "attack" || !m) return null;
  const a0 = m.startup + 1, a1 = m.startup + m.active, mt = f.mt, ph = mt < a0 ? 0 : mt <= a1 ? 1 : 2;
  const k = ph === 0 ? clamp(mt / Math.max(1, m.startup), 0, 1) : ph === 1 ? (m.active > 1 ? clamp((mt - a0) / (m.active - 1), 0, 1) : 1) : clamp((mt - a1) / Math.max(1, m.endlag), 0, 1);
  return { key: m.boss || f.mid, m, a0, a1, mt, ph, k, e: mt - a1 };
}
const bsAtWall = (f) => { const S = STAGE.main; return (f.facing > 0 ? S.x2 - f.x : f.x - S.x1) < f.s.w / 2 + 24; };

/* ---- the pose: where his feet, hands, fork and tail are, how he leans and squashes, which face he wears (fighter space, facing +x,
   feet at 0). Hands, feet and the fork are in the ground frame; the body, face and horns turn by `lean` about the hip. ---- */
function bsPose(f, tk) {
  const Q = { lean: 0, drop: 0, sx: 1, sy: 1, spin: 0, back: false, kneel: false,
    fF: [22, 0], fB: [-20, 0], hF: [50, -62], hB: [-50, -58],
    fork: 1, fa: -1.85, fg: 60, ha: null, gripB: false, fbx: 0, fby: 0, glow: 0, tc: null, clip: false,
    tail: 0, tu: 0, face: "smug", dim: false, rage: false, stars: false, stab: -1, trails: false, sweep: -1, tap: 0 };
  const st = f.state === "fin" ? "stagger" : f.state;   // the KO page's puppet: drawn reeling, "he's done"
  const breath = 0.01 * (1 - Math.cos((tk / 120) * BS_TAU));
  Q.sy = 1 + breath; Q.sx = 1 - breath * 0.5;
  Q.rage = bsRage(f) && st !== "broken" && st !== "hitstun" && f.state !== "fin";
  const blendIdle = (r) => {
    if (r <= 0) return;
    const I = BS_IDLE;
    Q.lean += (I.lean - Q.lean) * r; Q.drop += (I.drop - Q.drop) * r;
    Q.fF = bsMix2(Q.fF, I.fF, r); Q.fB = bsMix2(Q.fB, I.fB, r); Q.hF = bsMix2(Q.hF, I.hF, r); Q.hB = bsMix2(Q.hB, I.hB, r);
    Q.fa += (I.fa - Q.fa) * r; Q.fg += (I.fg - Q.fg) * r;
  };
  const P = bsPhase(f);
  if (st === "run") {
    const ph = f.anim ? f.anim.run : f.x * 0.05;
    Q.fF = [22 + Math.sin(ph) * 16, -Math.max(0, Math.cos(ph)) * 9]; Q.fB = [-20 - Math.sin(ph) * 16, -Math.max(0, -Math.cos(ph)) * 9];
    Q.drop = -Math.abs(Math.sin(ph)) * 2.5; Q.lean = 0.07; Q.hB = [-48 + Math.sin(ph) * 9, -58];
  } else if (st === "air") {
    Q.fF = [24, -12]; Q.fB = [-20, -8]; Q.hB = [-56, -84];
  } else if (st === "stagger") {
    // he reels (0.4 s sine), the fork lies on the floor tines up, spiral eyes, stars round the horns
    const w = Math.sin((tk / 24) * BS_TAU), w2 = Math.cos((tk / 24) * BS_TAU);
    Q.lean = 0.25 * w; Q.drop = 6; Q.fF = [24 + 5 * w, 0]; Q.fB = [-22 + 5 * w, 0];
    Q.hF = [56 + 10 * w, -104 - 12 * w2]; Q.hB = [-58 + 8 * w, -98 + 12 * w2];
    const fall = f.state === "fin" ? 1 : clamp(f.st / 9, 0, 1);
    Q.fork = 2; Q.fbx = 34; Q.fby = -4 - 14 * (1 - fall); Q.fa = -0.5 * (1 - fall); Q.ha = Q.fa - 1.1 * fall;
    Q.face = "stag"; Q.stars = true; Q.sy = 1; Q.sx = 1;
  } else if (st === "broken") {
    // one knee down, the fork planted as a crutch, head down, smoking; his reds fade
    Q.drop = 14; Q.lean = 0.24; Q.kneel = true; Q.dim = true; Q.face = "broken";
    Q.fF = [40, 0]; Q.fB = [-32, -1];
    Q.fork = 2; Q.fbx = 70; Q.fby = 0; Q.fa = -1.66; Q.ha = Q.fa;
    Q.hF = [70 + Math.cos(Q.fa) * 84, Math.sin(Q.fa) * 84]; Q.hB = [-28, -30];
    Q.sy = 1 + breath * 0.5; Q.sx = 1;
  } else if (st === "hitstun") {
    // the final launch: tumbling out of the arena, limbs out, fork still in his fist
    Q.spin = f.st * 0.24 * (f.kbx * f.facing >= 0 ? 1 : -1);
    Q.hF = [64, -122]; Q.hB = [-62, -112]; Q.fF = [34, -18]; Q.fB = [-30, -8]; Q.fa = -1.2; Q.fg = 70; Q.face = "launch"; Q.sy = 1; Q.sx = 1;
  } else if (P) {
    const { key, ph, k, e } = P, mt = f.mt, kk = ease(k);
    Q.glow = ph === 0 ? 1 : 0;   // the tines light whenever a move is coming
    Q.face = ph === 0 ? "windup" : ph === 1 ? "strike" : "smug";
    if (key === "stab") {
      // both hands on the shaft, held low under his grin: the butt at (bx, by), the back hand 14 along it, the front hand g2 along it
      const grip = (bx, by, a, g2) => { const ca = Math.cos(a), sa = Math.sin(a); Q.fa = a; Q.fg = g2; Q.hF = [bx + ca * g2, by + sa * g2]; return [bx + ca * 14, by + sa * 14]; };
      const IB = [66.6, -4.4];   // where the butt rests (the fork on his shoulder)
      if (ph === 0) {   // the fork drawn back past the hip, the tines flash yellow to white
        const b = bsMix2(IB, [-90, -38], kk), hb = grip(b[0], b[1], -1.85 + 1.72 * ease(Math.min(1, k * 1.6)), 60 + 20 * kk);
        Q.hB = bsMix2([-50, -58], hb, ease(Math.min(1, k * 2))); Q.gripB = k >= 0.5;
        Q.lean = -0.1 * kk; Q.fF = [30, 0]; Q.fB = [-32, 0];
        Q.tc = mix(BS.eye, "#ffffff", k);
      } else if (ph === 1) {   // the 4-frame lunge
        const u = bsOut(clamp((mt - P.a0 + 1) / 4, 0, 1)), b = bsMix2([-90, -38], [20, -50], u);
        Q.hB = grip(b[0], b[1], -0.13, 80); Q.gripB = true; Q.lean = 0.1 * u;
        Q.fF = [30 + 16 * u, 0]; Q.fB = [-32 + 6 * u, 0]; Q.tc = "#ffffff"; Q.glow = 1 - 0.5 * u; Q.stab = mt - P.a0;
      } else if (e <= 22) {   // end lag: the tines stuck in the floor, him leaning on it, puffing (the punish window)
        const t = ease(Math.min(1, e / 4)), b = bsMix2([20, -50], [54, -62], t);
        grip(b[0], b[1], -0.13 + 0.45 * t, 80 - 50 * t); Q.clip = true;
        Q.lean = 0.14; Q.drop = 6 * t; Q.face = "puff"; Q.hB = [-26, -42]; Q.fF = [46, 0]; Q.fB = [-28, 0];
      } else {   // pulls it out and shoulders it again
        const t = ease(clamp((e - 22) / 8, 0, 1)), b = bsMix2([54, -62], IB, t);
        grip(b[0], b[1], 0.32 + (-1.85 - 0.32) * t, 30 + 30 * t); Q.clip = t < 0.5;
        Q.lean = 0.14 * (1 - t); Q.drop = 6 * (1 - t); Q.fF = bsMix2([46, 0], [22, 0], t); Q.fB = bsMix2([-28, 0], [-20, 0], t); Q.hB = bsMix2([-26, -42], [-50, -58], t);
        Q.face = t < 0.5 ? "puff" : "smug";
      }
    } else if (key === "whip") {
      // he turns his back (the face hidden), the spade tail rises and glows from frame 1, then sweeps 180 degrees round both sides
      const back = ph === 1 || (ph === 0 && mt >= 3) || (ph === 2 && k < 0.7);
      if (ph === 0 && mt < 6) Q.sx *= 1 - 0.45 * Math.sin((mt / 6) * Math.PI);
      if (ph === 2 && k >= 0.6 && k < 0.8) Q.sx *= 1 - 0.45 * Math.sin(((k - 0.6) / 0.2) * Math.PI);
      if (back) {
        Q.back = true; Q.face = "";
        Q.fF = [24, 0]; Q.fB = [-24, 0]; Q.hF = [58, -66]; Q.hB = [-56, -62]; Q.fa = -Math.PI / 2 - 0.04; Q.fg = 66;
        if (ph === 0) { Q.tail = 1; Q.tu = ease(Math.min(1, mt / 8)); Q.glow = 1; }
        else if (ph === 1) { Q.tail = 2; Q.tu = ease(k); Q.sweep = k; Q.drop = 3; }
        else { Q.tail = 2; Q.tu = 1; Q.sweep = e <= 8 ? 1 + e / 8 : -1; }
      } else if (ph === 2) blendIdle(ease((k - 0.7) / 0.3));
    } else if (key === "stomp") {
      // a squash, the hop (a red ring marks where he lands), the landing squash with the shockwave, then up again
      if (ph === 0) {
        Q.sy = mt < 8 ? 0.85 + 0.23 * ease(mt / 8) : f.vy < 0 ? 1.06 : 1;
        Q.fF = f.vy > 2 ? [26, -4] : [24, -16]; Q.fB = f.vy > 2 ? [-24, -3] : [-22, -12];
        Q.hF = [56, -148]; Q.hB = [-46, -136]; Q.fa = -Math.PI / 2 + 0.12; Q.fg = 90; Q.lean = -0.06;
      } else if (ph === 1) {
        Q.sy = 0.82; Q.drop = 4; Q.fF = [36, 0]; Q.fB = [-34, 0]; Q.hF = [58, -74]; Q.fa = -Math.PI / 2 + 0.1; Q.fg = 74; Q.hB = [-60, -66];
      } else {
        Q.sy = 0.86 + 0.14 * ease(Math.min(1, e / 10)); Q.drop = 4 * (1 - Math.min(1, e / 10));
        Q.fF = [36, 0]; Q.fB = [-34, 0]; Q.hF = [58, -74]; Q.fa = -Math.PI / 2 + 0.1; Q.fg = 74; Q.hB = [-60, -66];
        blendIdle(ease(clamp((k - 0.4) / 0.6, 0, 1)));
      }
      Q.sx = 1 + (1 - Q.sy) * 0.7;
    } else if (key === "rain") {
      // the fork pointed straight up, the tines lit, the fireballs called down
      const up = ease(Math.min(1, ph === 0 ? k * 2.5 : 1));
      Q.hF = bsMix2([50, -62], [54, -150], up); Q.fa = -1.85 + (-Math.PI / 2 + 0.06 + 1.85) * up; Q.fg = 60 + 50 * up;
      Q.hB = bsMix2([-50, -58], [-50, -100], up); Q.lean = -0.1 * up;
      if (ph > 0) {
        const s = mt - P.a0;
        if (s < 4) { Q.tc = "#ffffff"; Q.glow = 1; }
        Q.face = "smug";
        blendIdle(ease(clamp((s - 6) / 18, 0, 1)));
      }
    } else if (key === "charge") {
      // head down, a hoof pawing the ground, smoke from the nose; then the run, horns first, fire behind; dazed at the wall
      Q.fa = -2.25; Q.fg = 56; Q.hF = [34, -46]; Q.hB = [-40, -56];   // the fork held across him, tines up and back, out of the way of the horns
      if (ph === 0) {
        Q.lean = 0.3 * ease(Math.min(1, k * 3)); Q.drop = 8; Q.fF = [26, 0];
        const pp = (mt % 16) / 16;
        Q.fB = pp < 0.6 ? [-20 - 30 * (pp / 0.6), 0] : [-50 + 30 * ((pp - 0.6) / 0.4), -8 * Math.sin(((pp - 0.6) / 0.4) * Math.PI)];
      } else if (ph === 1) {
        const rp = (mt - P.a0) * 0.6;
        Q.lean = 0.42; Q.drop = 6; Q.trails = true;
        Q.fF = [24 + 24 * Math.sin(rp), -Math.max(0, Math.cos(rp)) * 12]; Q.fB = [-22 - 24 * Math.sin(rp), -Math.max(0, -Math.cos(rp)) * 12];
      } else if (bsAtWall(f) && e < 22) {
        const w = 1 - e / 22;
        Q.lean = -0.2 * w + 0.07 * Math.sin(e * 0.9) * w; Q.drop = 4 * w; Q.face = "dazed"; Q.stars = true;
        Q.hF = [52, -66]; Q.fa = -1.85; Q.fg = 60; Q.fF = [26, 0]; Q.fB = [-22, 0];
        blendIdle(0);
      } else {
        Q.hF = [52, -66]; Q.fa = -1.85; Q.fg = 60;
        blendIdle(ease(clamp(bsAtWall(f) ? (e - 22) / 12 : k * 2, 0, 1)));
      }
    }
  } else if (st === "idle" && f.st > 40) {
    // every 6 s a tap of the fork on the floor (a puff of embers where it lands, see bsTick)
    const q = (tk + 23) % 360;
    if (q < 22) {
      Q.tap = q < 8 ? -10 * ease(q / 8) : q < 11 ? -10 * (11 - q) / 3 : -3 * Math.sin(((q - 11) / 11) * Math.PI);
      Q.hF = [50, -62 + Q.tap];
    }
  }
  if (Q.rage) { Q.glow = Math.max(Q.glow, 1); if (Q.face === "smug" || Q.face === "windup" || Q.face === "strike" || Q.face === "puff") Q.face = "rage"; }
  return Q;
}

/* ---- drawing pieces (fighter space) ---- */
function bsHoof(c, x, y) {
  c.fillStyle = BS.hoof; c.strokeStyle = OUT; c.lineWidth = 1.5;
  for (const dx of [-5.5, 1.5]) { c.beginPath(); c.roundRect(x + dx, y - 8, 6.5, 8, [3.2, 3.2, 1, 1]); c.fill(); c.stroke(); }
}
function bsHand(c, x, y, col, grip, a) {
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 1.5;
  // three fingers: wrapped round the shaft (grip, along its angle a) or loose, pointing down and forward
  const dx = grip ? Math.cos(a) : 0.55, dy = grip ? Math.sin(a) : 0.84, nx = grip ? -dy : 0.84, ny = grip ? dx : -0.55;
  for (let i = -1; i <= 1; i++) {
    const fx_ = x + dx * i * 4.6 + nx * (grip ? 6 : 6.5), fy_ = y + dy * i * 4.6 + ny * (grip ? 6 : 6.5);
    c.beginPath(); c.arc(fx_, fy_, 3.1, 0, BS_TAU); c.fill(); c.stroke();
  }
  c.beginPath(); c.arc(x, y, 7.5, 0, BS_TAU); c.fill(); c.stroke();
}
// the pitchfork: butt at (bx, by) along angle a; the head (bar and tines) along ha (null: the same); glow 0..1 lights the tines, tc overrides their colour
function bsFork(c, bx, by, a, ha, glow, tc, flash) {
  const ca = Math.cos(a), sa = Math.sin(a), ex = bx + ca * 170, ey = by + sa * 170;
  if (ha == null) ha = a;
  const hc = Math.cos(ha), hs = Math.sin(ha), px = -hs, py = hc;
  c.lineCap = "round";
  c.strokeStyle = OUT; c.lineWidth = 12; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = flash ? "#ffffff" : BS.shaft; c.lineWidth = 7; c.stroke();
  if (!flash) { c.strokeStyle = "rgba(255,220,190,0.16)"; c.lineWidth = 2; c.beginPath(); c.moveTo(bx + px * 1.5, by + py * 1.5); c.lineTo(ex + px * 1.5, ey + py * 1.5); c.stroke(); }
  const tines = () => {
    c.beginPath();
    for (const o of [-18, 0, 18]) {
      const len = o ? 28 : 34, sx = ex + px * o, sy = ey + py * o, tx = sx + hc * len + px * o * 0.14, ty = sy + hs * len + py * o * 0.14;
      c.moveTo(sx, sy); c.quadraticCurveTo(sx + hc * len * 0.55, sy + hs * len * 0.55, tx, ty);
    }
  };
  const tcx = ex + hc * 18, tcy = ey + hs * 18;
  if (glow > 0 && !flash) { bsGlowAt(c, tcx, tcy, 44, 0.75 * glow); c.strokeStyle = `rgba(255,122,43,${(0.5 * glow).toFixed(3)})`; c.lineWidth = 14; tines(); c.stroke(); }
  c.strokeStyle = OUT; c.lineWidth = 7.5; tines(); c.stroke();
  c.strokeStyle = flash ? "#ffffff" : tc || (glow > 0 ? BS.tine : BS.steel); c.lineWidth = 3.6; c.stroke();
  c.strokeStyle = OUT; c.lineWidth = 10; c.beginPath(); c.moveTo(ex - px * 22, ey - py * 22); c.lineTo(ex + px * 22, ey + py * 22); c.stroke();
  c.strokeStyle = flash ? "#ffffff" : BS.steel; c.lineWidth = 5; c.stroke();
  if (!flash) { c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ex - px * 19 - hc * 1.2, ey - py * 19 - hs * 1.2); c.lineTo(ex + px * 19 - hc * 1.2, ey + py * 19 - hs * 1.2); c.stroke(); }
  return [ex + hc * 36, ey + hs * 36];   // the middle tine's tip
}
// the tail: a quadratic chain base -> ctrl -> tip, 8 -> 4 wide, a spade at the end; glow lights the spade (Tail Whip's tell)
function bsTail(c, bx, by, cx, cy, tx, ty, col, glow, flash) {
  const N = 8;
  const at = (t) => { const u = 1 - t; return [u * u * bx + 2 * u * t * cx + t * t * tx, u * u * by + 2 * u * t * cy + t * t * ty]; };
  if (glow > 0 && !flash) bsGlowAt(c, tx, ty, 40, glow);
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = pass ? col : OUT;
    let p0 = at(0);
    for (let i = 1; i <= N; i++) {
      const p1 = at(i / N), w = 8 - (4 * i) / N;
      c.lineWidth = pass ? w : w + 3.5; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
      p0 = p1;
    }
  }
  const ang = Math.atan2(ty - cy, tx - cx);
  c.save(); c.translate(tx, ty); c.rotate(ang);
  c.beginPath(); c.moveTo(13, 0); c.quadraticCurveTo(8, 6, 0, 7); c.quadraticCurveTo(-5, 6, -3, 0); c.quadraticCurveTo(-5, -6, 0, -7); c.quadraticCurveTo(8, -6, 13, 0); c.closePath();
  if (glow > 0 && !flash) { c.strokeStyle = `rgba(255,122,43,${(0.6 * glow).toFixed(3)})`; c.lineWidth = 9; c.stroke(); }
  c.fillStyle = flash ? "#ffffff" : glow > 0 ? mix(col, BS.tine, 0.45 * glow) : col; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  c.restore();
}
// one horn: base (x, y) on the head, 18 wide, 26 tall, curling outward (d -1 left, +1 right), three rings
function bsHorn(c, x, y, d, flash) {
  c.beginPath(); c.moveTo(x - 9 * d, y + 3); c.quadraticCurveTo(x - 7 * d, y - 19, x + 15 * d, y - 26); c.quadraticCurveTo(x + 12 * d, y - 8, x + 9 * d, y + 3); c.closePath();
  c.fillStyle = flash ? "#ffffff" : BS.horn; c.fill();
  if (!flash) {
    c.save(); c.clip(); c.strokeStyle = BS.hornSh; c.lineWidth = 7;
    c.beginPath(); c.moveTo(x + 12 * d, y + 4); c.quadraticCurveTo(x + 15 * d, y - 9, x + 17 * d, y - 27); c.stroke(); c.restore();
  }
  c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.lineWidth = 1.5; c.beginPath();
  for (const t of [0.3, 0.52, 0.72]) {   // the rings, across the horn's centre line
    const u = 1 - t, mx = u * u * x + 2 * u * t * (x + 1 * d) + t * t * (x + 15 * d), my = u * u * (y + 3) + 2 * u * t * (y - 14) + t * t * (y - 26), hw = 9 * (1 - t * 0.85);
    c.moveTo(mx - hw, my - 0.5 * d); c.quadraticCurveTo(mx, my + 2.2, mx + hw, my + 0.5 * d);
  }
  c.stroke();
  return [x + 15 * d, y - 26];
}
function bsSpiral(c, x, y, r, tk, i) {
  c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath();
  for (let a = 0; a <= Math.PI * 6; a += 0.3) { const rr = r * (0.1 + 0.85 * a / (Math.PI * 6)), q = a + tk * 0.25 + i * 2; const px_ = x + Math.cos(q) * rr, py_ = y + Math.sin(q) * rr; if (a) c.lineTo(px_, py_); else c.moveTo(px_, py_); }
  c.stroke();
}
function bsBrow(c, x1, y1, x2, y2, w) { c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
// teeth along a mouth's top edge: n squares from x0, size s, the gold one at index gold
function bsTeeth(c, x0, y, n, s, gap, gold) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = i === gold ? BS.brass : BS.tooth; c.fillRect(x0 + i * (s + gap), y, s, s);
    c.strokeStyle = OUT; c.lineWidth = 0.9; c.strokeRect(x0 + i * (s + gap), y, s, s);
  }
}
// the face on the body (eyes er 7, 22 apart; brows OUT bars 14x4; the mouth)
function bsFace(c, mode, tk, lid, flash) {
  const er = 7, ey = BS_EY, mx = BS_FX + 1, my = BS_MY, rage = mode === "rage";
  c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 0; i < 2; i++) {
    const ex = BS_FX + (i ? 11 : -11);
    if (mode === "broken") {   // squeezed shut
      c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.moveTo(ex - 6, ey + 2); c.quadraticCurveTo(ex, ey - 6, ex + 6, ey + 2); c.stroke();
      continue;
    }
    const R = mode === "windup" || mode === "launch" ? er * 1.15 : er;
    c.beginPath(); c.arc(ex, ey, R, 0, BS_TAU); c.fillStyle = flash ? "#ffffff" : rage ? BS.rage : BS.eye; c.fill(); c.lineWidth = 1.7; c.strokeStyle = OUT; c.stroke();
    if (mode === "stag" || mode === "dazed" || mode === "launch") bsSpiral(c, ex, ey, R * 0.95, tk, i);
    else if (mode === "windup") { c.fillStyle = OUT; c.beginPath(); c.arc(ex + 0.8, ey, 1.8, 0, BS_TAU); c.fill(); }
    else { c.strokeStyle = rage ? "#ffffff" : OUT; c.lineWidth = rage || mode === "strike" ? 3.4 : 3; c.beginPath(); c.moveTo(ex + 1.2, ey - R * 0.68); c.lineTo(ex + 1.2, ey + R * 0.68); c.stroke(); }
    if (mode === "smug" || mode === "puff") {   // half-lidded: a red lid over the top 40% (55% when puffing)
      const lk = mode === "puff" ? 0.55 : 0.4, ly = ey - R + 2 * R * lk;
      c.save(); c.beginPath(); c.arc(ex, ey, R + 0.3, 0, BS_TAU); c.clip();
      c.fillStyle = lid; c.fillRect(ex - R - 1, ey - R - 1, 2 * R + 2, ly - (ey - R - 1)); c.restore();
      const hw = Math.sqrt(Math.max(0, R * R - (ly - ey) * (ly - ey)));
      c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); c.moveTo(ex - hw, ly); c.lineTo(ex + hw, ly); c.stroke();
    }
  }
  // brows
  c.strokeStyle = OUT; c.lineCap = "butt";
  const xa = BS_FX - 11, xb = BS_FX + 11;
  if (rage) { c.lineJoin = "miter"; c.lineWidth = 5; c.beginPath(); c.moveTo(xa - 9, ey - 16); c.lineTo(BS_FX, ey - 6.5); c.lineTo(xb + 9, ey - 16); c.stroke(); c.lineJoin = "round"; }
  else if (mode === "windup") { bsBrow(c, xa - 7, ey - 16.5, xa + 7, ey - 14.5, 4); bsBrow(c, xb - 7, ey - 14.5, xb + 7, ey - 16.5, 4); }
  else if (mode === "strike") { bsBrow(c, xa - 7, ey - 15, xa + 7, ey - 7.5, 4.5); bsBrow(c, xb - 7, ey - 7.5, xb + 7, ey - 15, 4.5); }
  else if (mode === "stag" || mode === "dazed" || mode === "launch") { bsBrow(c, xa - 7, ey - 15, xa + 7, ey - 12, 4); bsBrow(c, xb - 7, ey - 17, xb + 7, ey - 19.5, 4); }
  else if (mode === "broken") { bsBrow(c, xa - 7, ey - 9, xa + 7, ey - 14, 4); bsBrow(c, xb - 7, ey - 14, xb + 7, ey - 9, 4); }
  else if (mode === "puff") { bsBrow(c, xa - 7, ey - 11.5, xa + 7, ey - 10.5, 4); bsBrow(c, xb - 7, ey - 10.5, xb + 7, ey - 11.5, 4); }
  else { bsBrow(c, xa - 7, ey - 14, xa + 7, ey - 9.5, 4); bsBrow(c, xb - 7, ey - 9.5, xb + 7, ey - 14, 4); }   // smug: angled in
  c.lineCap = "round";
  // mouth
  const dark = flash ? "#ffffff" : BS.mouth;
  if (mode === "smug") {   // the smug grin, 36 wide: four square teeth, one gold
    c.beginPath(); c.moveTo(mx - 18, my - 3); c.quadraticCurveTo(mx, my + 4, mx + 18, my - 5); c.quadraticCurveTo(mx + 2, my + 15, mx - 18, my - 3); c.closePath();
    c.fillStyle = dark; c.fill();
    if (!flash) { c.save(); c.clip(); bsTeeth(c, mx - 11, my - 1, 4, 5, 0.6, 2); c.restore(); }
    c.beginPath(); c.moveTo(mx - 18, my - 3); c.quadraticCurveTo(mx, my + 4, mx + 18, my - 5); c.quadraticCurveTo(mx + 2, my + 15, mx - 18, my - 3); c.closePath();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(mx + 16, my - 8); c.quadraticCurveTo(mx + 20.5, my - 6, mx + 19, my - 2); c.stroke();   // the smug corner
  } else if (mode === "windup") {   // open, a glow in the throat
    c.beginPath(); c.ellipse(mx, my + 2, 12, 8, 0, 0, BS_TAU); c.fillStyle = dark; c.fill();
    if (!flash) { c.fillStyle = BS.throat; c.beginPath(); c.ellipse(mx, my + 5.5, 7, 3.6, 0, 0, BS_TAU); c.fill(); }
    c.beginPath(); c.ellipse(mx, my + 2, 12, 8, 0, 0, BS_TAU); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  } else if (mode === "strike" || rage) {   // the roar (fixed in rage): teeth on top, the throat lit
    const rw = rage ? 16 : 14.5, rh = rage ? 10.5 : 9.5;
    c.beginPath(); c.ellipse(mx, my + 3, rw, rh, 0, 0, BS_TAU); c.fillStyle = dark; c.fill();
    if (!flash) {
      c.save(); c.clip();
      c.fillStyle = BS.throat; c.beginPath(); c.ellipse(mx, my + 3 + rh * 0.55, rw * 0.62, rh * 0.45, 0, 0, BS_TAU); c.fill();
      if (rage) { c.fillStyle = BS.gold; c.beginPath(); c.ellipse(mx, my + 3 + rh * 0.62, rw * 0.3, rh * 0.22, 0, 0, BS_TAU); c.fill(); }
      bsTeeth(c, mx - 12, my + 3 - rh - 0.5, 4, 5.4, 0.8, 2);
      c.restore();
    }
    c.beginPath(); c.ellipse(mx, my + 3, rw, rh, 0, 0, BS_TAU); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
  } else if (mode === "stag") {   // gaping, tongue out
    c.beginPath(); c.ellipse(mx, my + 2, 11, 7, 0.15, 0, BS_TAU); c.fillStyle = dark; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
    const wag = Math.sin(tk * 0.3) * 0.25;
    c.save(); c.translate(mx + 4, my + 6); c.rotate(0.3 + wag);
    c.beginPath(); c.moveTo(-5.5, -2); c.lineTo(-5.5, 6); c.quadraticCurveTo(0, 13, 5.5, 6); c.lineTo(5.5, -2); c.closePath();
    c.fillStyle = flash ? "#ffffff" : BS.tongue; c.fill(); c.lineWidth = 1.6; c.stroke();
    c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 6); c.stroke(); c.restore();
  } else if (mode === "dazed") {
    c.lineWidth = 2.2; c.strokeStyle = OUT; c.beginPath(); c.moveTo(mx - 12, my + 1);
    for (let q = 1; q <= 6; q++) c.lineTo(mx - 12 + q * 4, my + 1 + (q % 2 ? 3 : -1.5));
    c.stroke();
  } else if (mode === "broken") {   // gritted teeth, two sweat drops
    c.beginPath(); c.roundRect(mx - 12, my - 4, 24, 10, 3); c.fillStyle = flash ? "#ffffff" : BS.tooth; c.fill();
    c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath();
    for (let q = 1; q < 5; q++) { c.moveTo(mx - 12 + q * 4.8, my - 4); c.lineTo(mx - 12 + q * 4.8, my + 6); }
    c.moveTo(mx - 12, my + 1); c.lineTo(mx + 12, my + 1); c.stroke();
    c.beginPath(); c.roundRect(mx - 12, my - 4, 24, 10, 3); c.lineWidth = 2.2; c.stroke();
    for (const [dx, dy, ph] of [[BS_FX + 34, ey - 6, 0], [BS_FX - 31, ey - 16, 0.5]]) {
      const q = (tk / 70 + ph) % 1, yy = dy + q * 10;
      c.globalAlpha = q < 0.85 ? 1 : (1 - q) / 0.15;
      c.beginPath(); c.moveTo(dx, yy - 6.5); c.quadraticCurveTo(dx + 4.6, yy + 1, dx, yy + 3.6); c.quadraticCurveTo(dx - 4.6, yy + 1, dx, yy - 6.5); c.closePath();
      c.fillStyle = BS.sweat; c.fill(); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();
      c.globalAlpha = 1;
    }
  } else if (mode === "launch") {
    c.beginPath(); c.ellipse(mx, my + 3, 9, 11, 0, 0, BS_TAU); c.fillStyle = dark; c.fill(); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
  } else if (mode === "puff") {   // out of breath: puffed cheeks, a small round mouth
    c.fillStyle = "rgba(255,150,120,0.35)";
    for (const dx of [-15, 17]) { c.beginPath(); c.ellipse(mx + dx, my - 3, 7, 5, 0, 0, BS_TAU); c.fill(); }
    c.beginPath(); c.ellipse(mx + 3, my + 1, 4.6, 4 + Math.sin(tk * 0.4) * 1.2, 0, 0, BS_TAU); c.fillStyle = dark; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  }
}
// the body: roasted gradient, charred patches on the rim, ember cracks, the rope belt and its potato buckle (or its knot, from behind)
function bsBody(c, Q, pal, tk, flash, armor, rage) {
  const path = bsPath(), G0 = bsGrads(c);
  c.fillStyle = flash ? "#ffffff" : G0[pal.key]; c.fill(path);
  if (!flash) {
    c.save(); c.clip(path);
    c.fillStyle = BS.char; c.strokeStyle = OUT; c.lineWidth = 1;
    for (const [px_, py_, rx, ry, a] of BS_PATCH) { c.beginPath(); c.ellipse(px_, py_, rx, ry, a, 0, BS_TAU); c.fill(); c.stroke(); }
    // three ember cracks, pulsing 0.6 <-> 1 (cold and dark once he is broken, quick in rage)
    const sp = rage ? 0.16 : 0.08;
    c.lineJoin = "miter";
    for (const [cx, cy, ph, pts, bi, br] of BS_CRACK) {
      if (!Q.dim) bsGlowAt(c, cx + pts[2][0], cy + pts[2][1], 13, 0.35 + 0.2 * Math.sin(tk * sp + ph));   // the heat under the crack
      c.beginPath(); c.moveTo(cx + pts[0][0], cy + pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(cx + pts[i][0], cy + pts[i][1]);
      c.moveTo(cx + pts[bi][0], cy + pts[bi][1]); c.lineTo(cx + br[0], cy + br[1]);
      c.strokeStyle = BS.char; c.lineWidth = 3.4; c.stroke();
      c.globalAlpha = Q.dim ? 0.25 : 0.8 + 0.2 * Math.sin(tk * sp + ph); c.strokeStyle = BS.ember; c.lineWidth = 1.6; c.stroke(); c.globalAlpha = 1;
    }
    c.lineJoin = "round";
    // the belt: charred rope, 7 units at cy + ry * 0.55
    const by = BS_P.cy + BS_P.ry * 0.55;
    c.fillStyle = BS.rope; c.fillRect(-62, by - 3.5, 124, 7);
    c.strokeStyle = "rgba(150,110,85,0.45)"; c.lineWidth = 1.2; c.beginPath();
    for (let x = -60; x < 62; x += 5) { c.moveTo(x, by + 3); c.lineTo(x + 4, by - 3); }
    c.stroke();
    c.restore();
    if (Q.back) {   // the knot at his back, two loose ends
      c.fillStyle = BS.rope; c.strokeStyle = OUT; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, by, 6, 5, 0, 0, BS_TAU); c.fill(); c.stroke();
      c.lineWidth = 3.4; c.strokeStyle = BS.rope; c.beginPath(); c.moveTo(-2, by + 3); c.quadraticCurveTo(-6, by + 10, -4, by + 16); c.moveTo(2, by + 3); c.quadraticCurveTo(7, by + 9, 6, by + 14); c.stroke();
    } else {   // the brass buckle, shaped like a potato with eye holes
      const bx = BS_FX + 4;
      c.beginPath(); c.ellipse(bx, by, 9, 6.6, -0.12, 0, BS_TAU); c.fillStyle = BS.brass; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = "#fff0b0"; c.beginPath(); c.ellipse(bx - 3.5, by - 2.6, 2.6, 1.3, -0.3, 0, BS_TAU); c.fill();
      c.fillStyle = BS.rope; for (const [dx, dy] of [[-2.6, 0.6], [2.8, -0.2], [0.4, 3]]) { c.beginPath(); c.arc(bx + dx, by + dy, 1.15, 0, BS_TAU); c.fill(); }
    }
  }
  c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(path);
  if (armor > 0 && !flash) { c.strokeStyle = `rgba(255,216,74,${(0.9 * Math.min(1, armor / 8)).toFixed(3)})`; c.lineWidth = 4.5; c.stroke(path); }   // a hit he tanked (poise): a gold rim
}
function bsStars(c, tk) {
  for (let i = 0; i < 3; i++) {
    const a = tk * 0.12 + (i * BS_TAU) / 3, x = BS_FX + Math.cos(a) * 40, y = -154 + Math.sin(a) * 10, s = 7 + Math.sin(a) * 1.2;
    star4(c, x, y, s + 3, OUT); star4(c, x, y, s, BS.gold); star4(c, x, y, s * 0.4, "#fff6d8");
  }
}

/* ---- the other bosses' art (ui/draw-zorp.js, ui/draw-kraken.js) registers here by boss id:
   { draw(c, f, tk, at), proj(c, p, tk) -> true when it drew p, floor(c, g, f, tk) (his tells, once per frame, under the fighters; also
   runs his per-tick cues), event(g, e, live) -> true when it fully handled e }. Old Scratch is this file. ---- */
const BOSS_ART = {};
const bossArt = (f) => (f && f.spec.boss ? BOSS_ART[f.spec.id] || null : null);

/* ---- drawBoss: the fighter (or the KO page's puppet with `at`) ---- */
function drawBoss(c, f, tk, at) {
  const A = bossArt(f);
  if (A) return A.draw(c, f, tk, at);
  const x = at ? at[0] : f.x, y = at ? at[1] : f.y;
  const Q = bsPose(f, tk), flash = f.flash > 0 && f.flash % 2 === 0, pal = flash ? BS_W : Q.dim ? BS_D : BS_N;
  c.save();
  try {
    c.translate(x, y); c.scale(f.facing, 1);
    if (Q.spin) { c.translate(0, -80); c.rotate(Q.spin); c.translate(0, 80); }
    c.scale(Q.sx, Q.sy);
    c.lineCap = "round"; c.lineJoin = "round";
    const hipY = BS_HIP + Q.drop, cl = Math.cos(Q.lean), sl = Math.sin(Q.lean);
    const B = (px_, py_) => [px_ * cl - (py_ - BS_HIP) * sl, hipY + px_ * sl + (py_ - BS_HIP) * cl];   // a body point in the ground frame
    // the fork when it is not in his hand: lying on the floor (stagger) or planted as a crutch (broken)
    let tip = null;
    if (Q.fork === 2 && !Q.kneel) tip = bsFork(c, Q.fbx, Q.fby, Q.fa, Q.ha, 0, null, flash);
    // the tail behind him (front view)
    if (!Q.back) {
      const sw = Math.sin((tk / 90) * BS_TAU) * 0.3, b0 = B(-42, -40), c0 = B(-90, -26 + sw * 14), t0 = B(-104 + sw * 18, -92 + sw * 10);
      bsTail(c, b0[0], b0[1], c0[0], c0[1], t0[0], t0[1], pal.limb, 0, flash);
    }
    // charge: the orange horn trails stream behind
    if (Q.trails) {
      for (const hx of [BS_FX - 38, BS_FX + 38]) {   // tapered fire streaks off the horn tips
        const p = B(hx, -156), j = Math.sin(tk * 0.9 + hx) * 6;
        c.fillStyle = "rgba(255,154,58,0.55)"; c.beginPath(); c.moveTo(p[0] + 2, p[1] - 5); c.lineTo(p[0] - 100 - j, p[1] + 6); c.lineTo(p[0] + 2, p[1] + 5); c.closePath(); c.fill();
        c.fillStyle = "rgba(255,240,192,0.85)"; c.beginPath(); c.moveTo(p[0] + 2, p[1] - 2); c.lineTo(p[0] - 58 - j, p[1] + 3); c.lineTo(p[0] + 2, p[1] + 2); c.closePath(); c.fill();
      }
    }
    // back arm (front view; from behind both arms are drawn after the body)
    const shF = B(Q.back ? 44 : 40, -90), shB = B(Q.back ? -44 : -38, -92);
    if (!Q.back) { limbPath(c, shB, Q.hB, 48, "down", 11, pal.limb); if (!Q.gripB) bsHand(c, Q.hB[0], Q.hB[1], pal.limb, false, 0); }
    // legs and hooves
    const hipF = [16 * cl - 0 * sl + 0, hipY + 16 * sl], hipB = [-16 * cl, hipY - 16 * sl];
    if (Q.kneel) {   // one knee down: the back knee on the floor, the shin lying back; the front foot planted, its knee up
      const kn = [-30, -2];
      limbPath(c, hipB, kn, 20, "fwd", 12, pal.limb);
      c.strokeStyle = OUT; c.lineWidth = 15.5; c.beginPath(); c.moveTo(kn[0], kn[1]); c.lineTo(-50, -5); c.stroke();
      c.strokeStyle = pal.limb; c.lineWidth = 12; c.stroke();
      c.save(); c.translate(-54, -4); c.rotate(-1.35); bsHoof(c, 0, 4); c.restore();
      limbPath(c, hipF, Q.fF, 44, "fwd", 12, pal.limb); bsHoof(c, Q.fF[0], Q.fF[1]);
      tip = bsFork(c, Q.fbx, Q.fby, Q.fa, Q.ha, 0, null, flash);
    } else {
      limbPath(c, hipB, Q.fB, 30, "fwd", 12, pal.limb); bsHoof(c, Q.fB[0], Q.fB[1]);
      limbPath(c, hipF, Q.fF, 30, "fwd", 12, pal.limb); bsHoof(c, Q.fF[0], Q.fF[1]);
    }
    // the body, the face (or his back), the horns
    c.save(); c.translate(0, hipY); c.rotate(Q.lean); c.translate(0, -BS_HIP);
    bsBody(c, Q, pal, tk, flash, f.armorFlash || 0, Q.rage);
    if (!Q.back) bsFace(c, Q.face, tk, pal.mid, flash);
    const h1 = bsHorn(c, Q.back ? -23 : BS_FX - 23, -130, -1, flash), h2 = bsHorn(c, Q.back ? 23 : BS_FX + 23, -131, 1, flash);
    if (Q.rage && !flash) for (const [hx, hy] of [h1, h2]) {   // 8-unit flames on the horn tips
      const fl = 0.75 + 0.25 * Math.sin(tk * 0.7 + hx);
      tongue(c, hx, hy + 3, 15 * fl, 4.4, Math.sin(tk * 0.4 + hx) * 2, BS.tine, BS.gold);
    }
    if (Q.stars) bsStars(c, tk);
    c.restore();
    // the fork in his hand, then the hand over the shaft
    if (Q.fork === 1) {
      const ca = Math.cos(Q.fa), sa = Math.sin(Q.fa), bx = Q.hF[0] - ca * Q.fg, by = Q.hF[1] - sa * Q.fg;
      if (Q.clip) { c.save(); c.beginPath(); c.rect(-400, -600, 900, 600.5); c.clip(); }
      tip = bsFork(c, bx, by, Q.fa, Q.ha, Q.glow, Q.tc, flash);
      if (Q.clip) c.restore();
      if (Q.gripB) bsHand(c, Q.hB[0], Q.hB[1], pal.limb, true, Q.fa);
      if (Q.back) { limbPath(c, shB, Q.hB, 48, "down", 11, pal.limb); bsHand(c, Q.hB[0], Q.hB[1], pal.limb, false, 0); }
      limbPath(c, shF, Q.hF, 48, "down", 11, pal.limb); bsHand(c, Q.hF[0], Q.hF[1], pal.limb, true, Q.fa);
    } else {
      if (Q.back) { limbPath(c, shB, Q.hB, 48, "down", 11, pal.limb); bsHand(c, Q.hB[0], Q.hB[1], pal.limb, false, 0); }
      limbPath(c, shF, Q.hF, 48, "down", 11, pal.limb); bsHand(c, Q.hF[0], Q.hF[1], pal.limb, Q.kneel, Q.fa);
    }
    // the stab: three tine streaks behind the lunge, a spark star at the tip
    if (Q.stab >= 0 && tip && !flash) {
      const a = Math.max(0, 1 - Q.stab / 6);
      c.globalAlpha = a; c.lineCap = "round";
      for (const o of [-18, 0, 18]) {
        c.strokeStyle = "rgba(255,200,120,0.7)"; c.lineWidth = 5; c.beginPath(); c.moveTo(tip[0] - 8 - (o ? 6 : 0), tip[1] + o); c.lineTo(tip[0] - 96, tip[1] + o * 1.05); c.stroke();
        c.strokeStyle = "#fff6d8"; c.lineWidth = 2; c.stroke();
      }
      c.globalAlpha = 1;
      if (Q.stab < 3) { const s = 18 * (1 - Q.stab / 4); star4(c, tip[0] + 6, tip[1], s + 4, BS.tine); star4(c, tip[0] + 6, tip[1], s, "#ffffff"); }
    }
    // the tail in front of him when he shows his back (Tail Whip): raised and glowing in the tell, then the 180-degree sweep
    if (Q.back) {
      const b0 = [0, -40 + Q.drop];
      if (Q.tail === 2) {
        const th = Math.PI - Math.PI * clamp(Q.tu, 0, 1), tx = 150 * Math.cos(th), ty = -38 + 34 * Math.sin(th);
        if (Q.sweep >= 0 && !flash) {   // the red crescent trail round both sides
          const fade = Q.sweep > 1 ? 2 - Q.sweep : 1;
          c.globalAlpha = 0.85 * fade;
          c.strokeStyle = "rgba(255,59,43,0.55)"; c.lineWidth = 24; c.beginPath(); c.ellipse(0, -38, 150, 34, 0, Math.PI, th, true); c.stroke();
          c.strokeStyle = "rgba(255,154,58,0.9)"; c.lineWidth = 8; c.stroke();
          c.strokeStyle = "rgba(255,240,192,0.9)"; c.lineWidth = 2.5; c.stroke();
          c.globalAlpha = 1;
        }
        bsTail(c, b0[0], b0[1], tx * 0.42, -4, tx, ty, pal.limb, Q.sweep >= 0 && Q.sweep < 1 ? 0.7 : 0, flash);
      } else {
        const u = Q.tu, tx = -36 - 30 * u + Math.sin(tk * 0.5) * 3 * u, ty = -20 - 112 * u;
        bsTail(c, b0[0], b0[1], -76, -16 - 10 * u, tx, ty, pal.limb, Q.tail === 1 ? 0.4 + 0.6 * u : 0, flash);
      }
    }
  } finally { c.restore(); }
}

/* ---- his fire (world space): Stomp's floor flames, Brimstone Rain's fireballs and their bursts, Horn Charge's fire trail ---- */
function drawBossProj(c, p, tk) {
  const A = bossArt(RG && RG.fighters[p.owner]);
  if (A) return A.proj(c, p, tk);
  const s = p.style;
  if (s === "flame") { bsFlameRow(c, p, tk); return true; }
  if (s === "brim") { bsBrim(c, p, tk); return true; }
  if (s === "trail") { bsTrailFire(c, p, tk); return true; }
  if (s === "burst") { const o = RG && RG.fighters[p.owner]; if (o && o.spec.boss) { bsBurst(c, p); return true; } }
  return false;
}
// a flame tongue with a dark-red rim (reads on the dark field), orange body, yellow core
function bsTongue(c, x, y, h, wd, lean) {
  tongue(c, x, y, h * 1.08, wd * 1.25, lean, "#a8261a", null);
  tongue(c, x, y, h, wd, lean, BS.tine, BS.gold);
}
function bsFlameRow(c, p, tk) {   // three tongues, 28 tall, leaning back from the run
  const base = p.y + p.r - 2, d = p.dir || Math.sign(p.vx) || 1, env = Math.min(1, p.t / 4) * Math.min(1, (p.life - p.t) / 10);
  if (env <= 0) return;
  bsGlowAt(c, p.x - d * 12, base - 12, 38, 0.55 * env);
  for (let i = 2; i >= 0; i--) {
    const fl = 0.82 + 0.18 * Math.sin(tk * 0.65 + i * 2.1 + p.x * 0.05);
    bsTongue(c, p.x - d * i * 13, base, [28, 23, 17][i] * fl * env, 7 - i, -d * (5 + i * 2));
  }
}
function bsTrailFire(c, p, tk) {   // the charge's fire on the floor: 24 tall, flaring on each burn tick
  const base = p.y + p.r - 4, env = Math.min(1, p.t / 5) * Math.min(1, (p.life - p.t) / 18);
  if (env <= 0) return;
  const pulse = p.pulse && p.t % p.pulse < 3 ? 1.18 : 1;
  c.fillStyle = "rgba(30,10,8,0.45)"; c.beginPath(); c.ellipse(p.x, base, 18, 3.5, 0, 0, BS_TAU); c.fill();
  bsGlowAt(c, p.x, base - 10, 30, 0.45 * env * pulse);
  for (let i = 0; i < 3; i++) {
    const fl = 0.75 + 0.25 * Math.sin(tk * 0.55 + i * 2.3 + p.x * 0.07);
    bsTongue(c, p.x + (i - 1) * 9, base, (i === 1 ? 24 : 17) * fl * env * pulse, i === 1 ? 6 : 4.5, Math.sin(tk * 0.3 + i + p.x) * 2.5);
  }
}
function bsBrim(c, p, tk) {   // a burning lump of brimstone: white-hot on its leading (lower) face, dark rock on top, flames streaming up behind its fall
  const x = p.x, y = p.y;
  bsGlowAt(c, x, y, 48, 0.7);
  for (let i = 0; i < 3; i++) {
    const fl = 0.8 + 0.2 * Math.sin(tk * 0.8 + i * 2);
    bsTongue(c, x + (i - 1) * 8, y - 4, (i === 1 ? 44 : 30) * fl, 8 - Math.abs(i - 1) * 2, Math.sin(tk * 0.5 + i) * 3);
  }
  c.save();
  c.beginPath(); c.arc(x, y, 17, 0, BS_TAU); c.fillStyle = BS.ember; c.fill(); c.clip();
  c.fillStyle = "#5a1a12"; c.beginPath(); c.ellipse(x - 2, y - 13, 20, 10, -0.15, 0, BS_TAU); c.fill();   // the dark crust on top
  c.fillStyle = BS.gold; c.beginPath(); c.ellipse(x, y + 6, 12, 8, 0, 0, BS_TAU); c.fill();   // white-hot underneath
  c.fillStyle = "#fff6d8"; c.beginPath(); c.ellipse(x, y + 8, 6, 3.6, 0, 0, BS_TAU); c.fill();
  c.restore();
  c.beginPath(); c.arc(x, y, 17, 0, BS_TAU); c.lineWidth = 2; c.strokeStyle = "#7a1e12"; c.stroke();
}
function bsBurst(c, p) {   // where a fireball lands: a fire ring and spikes, 6 frames
  const k = p.t / Math.max(1, p.life), r = p.r * (0.45 + 0.55 * ease(Math.min(1, k * 1.4))), a = 1 - k;
  bsGlowAt(c, p.x, p.y, r * 1.5, a);
  c.strokeStyle = mix(BS.gold, BS.tine, k); c.globalAlpha = a; c.lineWidth = 6 * a + 1.5;
  c.beginPath(); c.arc(p.x, p.y, r, Math.PI, BS_TAU); c.stroke();
  c.lineWidth = 3;
  c.beginPath();
  for (let i = 0; i < 7; i++) { const an = Math.PI + (i + 0.5) * (Math.PI / 7); c.moveTo(p.x + Math.cos(an) * r * 0.55, p.y + Math.sin(an) * r * 0.55); c.lineTo(p.x + Math.cos(an) * r * 1.15, p.y + Math.sin(an) * r * 1.15); }
  c.stroke(); c.globalAlpha = 1;
}

/* ---- per game UI state: cues already played (by move instance), stomp shockwaves and scorch marks on the floor ---- */
const BX = { g: null, tk: -1, cues: new Set(), rings: [], scorch: [], beat: 0 };
function bsReset(g) { BX.g = g; BX.tk = -1; BX.cues.clear(); BX.rings.length = 0; BX.scorch.length = 0; BX.beat = 0; }
function bsCue(f, name) { const k = f.moveT + "." + name; if (BX.cues.has(k)) return false; BX.cues.add(k); return true; }
const bsLive = (g) => mode === "match" && g === G && !FIN.on && !paused;
const bsW = (f, lx, ly) => [f.x + f.facing * lx, f.y + ly];   // a point near him in the world (lean ignored: for particles)

/* ---- bossFloor: his tells on the floor (world space, after the stage, under the fighters) ---- */
function bossFloor(c, g, tk) {
  if (BX.g !== g) bsReset(g);
  const f = bsOf(g), A = bossArt(f);
  if (A) { A.floor(c, g, f, tk); return; }
  if (tk !== BX.tk) { BX.tk = tk; bsTick(g, f, tk); }
  if (!f && !BX.rings.length && !BX.scorch.length) return;
  const S = STAGE.main, top = S.top;
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  // scorch marks (2 s) where fireballs landed
  for (const s of BX.scorch) {
    const age = tk - s.t, a = 1 - age / 120;
    if (a <= 0) continue;
    c.fillStyle = `rgba(24,10,8,${(0.55 * a).toFixed(3)})`; c.beginPath(); c.ellipse(s.x, top + 0.5, 28, 5, 0, 0, BS_TAU); c.fill();
    if (age < 70) { c.fillStyle = BS.ember; c.globalAlpha = (1 - age / 70) * (0.6 + 0.4 * Math.sin(tk * 0.5 + s.x)); for (const dx of [-12, 3, 14]) c.fillRect(s.x + dx, top - 1, 2.5, 1.6); c.globalAlpha = 1; }
  }
  // Hellfire Stomp's shockwave: r 0 -> 110 in 10 frames, #fff0c0 -> #ff7a2b
  for (const r of BX.rings) {
    const age = tk - r.t;
    if (age > 18) continue;
    const k = Math.min(1, age / 10), rr = 110 * ease(k), a = age < 10 ? 1 : 1 - (age - 10) / 8;
    c.globalAlpha = a; c.strokeStyle = mix("#fff0c0", BS.tine, k); c.lineWidth = 7 * (1 - k) + 2.5;
    c.beginPath(); c.ellipse(r.x, top + 1, rr, rr * 0.22, 0, 0, BS_TAU); c.stroke();
    c.globalAlpha = a * 0.45; c.lineWidth = 3; c.beginPath(); c.arc(r.x, top, rr * 0.7, Math.PI, BS_TAU); c.stroke();
    c.globalAlpha = 1;
  }
  // Brimstone Rain: a crosshair on the floor under each fireball, filling over its last 30 frames of fall
  for (const p of g.projs) {
    if (p.style !== "brim") continue;
    const left = (top - p.y) / Math.max(1, p.vy), fill = clamp(1 - left / 30, 0, 1), cy = top - 17, a = clamp(p.t / 6, 0, 1);
    c.globalAlpha = a;
    c.fillStyle = `rgba(255,74,43,${(0.12 + 0.2 * fill).toFixed(3)})`; c.beginPath(); c.ellipse(p.x, top + 0.5, 16 + 10 * fill, 4 + 2 * fill, 0, 0, BS_TAU); c.fill();
    if (fill > 0) { c.fillStyle = "rgba(255,74,43,0.45)"; c.beginPath(); c.moveTo(p.x, cy); c.arc(p.x, cy, 16, -Math.PI / 2, -Math.PI / 2 + fill * BS_TAU); c.closePath(); c.fill(); }
    c.strokeStyle = OUT; c.lineWidth = 5; c.beginPath(); c.arc(p.x, cy, 16, 0, BS_TAU); c.moveTo(p.x - 23, cy); c.lineTo(p.x - 8, cy); c.moveTo(p.x + 8, cy); c.lineTo(p.x + 23, cy); c.moveTo(p.x, cy - 23); c.lineTo(p.x, cy - 8); c.moveTo(p.x, cy + 8); c.lineTo(p.x, cy + 16); c.stroke();
    c.strokeStyle = "#ff4a2b"; c.lineWidth = 2.5; c.stroke();
    c.globalAlpha = 1;
  }
  if (f && f.state !== "gone" && f.state !== "dead") {
    const P = bsPhase(f), d = f.facing;
    // rage: a red ring under him
    if (bsRage(f) && f.state !== "broken" && f.state !== "hitstun") {
      const pu = 1 + 0.05 * Math.sin(tk * 0.2);
      c.fillStyle = "rgba(255,60,40,0.3)"; c.beginPath(); c.ellipse(f.x, top + 1, 70 * pu, 12 * pu, 0, 0, BS_TAU); c.fill();
      c.strokeStyle = "rgba(255,90,50,0.55)"; c.lineWidth = 2; c.stroke();
    }
    if (P && P.key === "stab" && P.ph === 0) {   // the dotted reach line (the fork's true reach)
      const x0 = f.x + d * 46, x1 = f.x + d * 240, a = 0.35 + 0.65 * P.k;
      c.globalAlpha = a; c.setLineDash([2, 9]); c.lineDashOffset = -tk * 0.6;
      c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(x0, top - 2); c.lineTo(x1, top - 2); c.stroke();
      c.strokeStyle = BS.tine; c.lineWidth = 3.5; c.stroke(); c.setLineDash([]);
      c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(x1, top - 12); c.lineTo(x1, top + 1); c.stroke();
      c.strokeStyle = BS.tine; c.lineWidth = 3; c.stroke();
      c.globalAlpha = 1;
    }
    if (P && P.key === "stomp" && P.ph === 0 && !f.grounded) {   // where he will land: a red ring, shrinking as he falls
      const k = clamp((top - f.y) / 120, 0, 1), rx = 60 * (0.55 + 0.45 * k), ry = 12 * (0.55 + 0.45 * k);
      c.fillStyle = "rgba(255,74,43,0.22)"; c.beginPath(); c.ellipse(f.x, top + 1, rx, ry, 0, 0, BS_TAU); c.fill();
      c.strokeStyle = "rgba(255,74,43,0.5)"; c.lineWidth = 3.5; c.stroke();
      c.strokeStyle = "rgba(255,200,150,0.5)"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(f.x, top + 1, rx * 0.5, ry * 0.5, 0, 0, BS_TAU); c.stroke();
    }
    if (P && P.key === "charge" && P.ph === 0) {   // a red chevron trail his way, lighting up towards the far wall
      const room = d > 0 ? S.x2 - f.x : f.x - S.x1, n = Math.max(1, Math.min(6, Math.floor((room - 60) / 60)));
      for (let i = 0; i < n; i++) {
        const lit = clamp(P.k * (n + 1) - i, 0, 1), cx = f.x + d * (80 + i * 60), pul = 0.75 + 0.25 * Math.sin(tk * 0.3 - i);
        if (lit <= 0) continue;
        c.globalAlpha = lit * pul;
        c.beginPath(); c.moveTo(cx - d * 18, top - 15); c.lineTo(cx + d * 10, top - 7); c.lineTo(cx - d * 18, top + 1); c.lineTo(cx - d * 8, top - 7); c.closePath();
        c.fillStyle = BS.rage; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      }
      c.globalAlpha = 1;
    }
  }
  c.restore();
}

/* ---- once per UI tick: the cues of the move being played, his particles, the flames' crackle, the rage heartbeat ---- */
function bsTick(g, f, tk) {
  const live = bsLive(g);
  for (let i = BX.rings.length - 1; i >= 0; i--) if (tk - BX.rings[i].t > 20) BX.rings.splice(i, 1);
  for (let i = BX.scorch.length - 1; i >= 0; i--) if (tk - BX.scorch[i].t > 120) BX.scorch.splice(i, 1);
  let fl = 0;
  for (const p of g.projs) {
    if (p.style !== "flame" && p.style !== "trail") continue;
    fl++;
    if (Math.random() < (p.style === "flame" ? 0.25 : 0.06)) ember(p.x + (Math.random() - 0.5) * 20, p.y + p.r - 10, (Math.random() - 0.5) * 1.2, -1 - Math.random() * 1.6);
  }
  if (live && fl && Math.random() < 0.2) BSND.crackle();
  if (!f || f.state === "gone" || f.state === "dead") return;
  const P = bsPhase(f), d = f.facing, rage = bsRage(f) && f.state !== "broken" && f.state !== "hitstun";
  if (P) {
    const { key, ph, mt, a0, a1 } = P;
    if (key === "stab") {
      if (ph >= 1 && bsCue(f, "lunge")) { if (live) BSND.lunge(); }
      if (ph === 2 && mt - a1 <= 22 && (mt - a1) % 9 === 4) { const p = bsW(f, BS_FX + 26, -68 + 6); addFx({ k: "puff", x: p[0], y: p[1], vx: d * 1.2, vy: -0.6, r: 4, t: 0, life: 22, col: "#e8dcd0" }); }
      if (ph === 2 && mt - a1 === 2 && bsCue(f, "stuck")) { const p = bsW(f, 200, 0); dust(p[0], p[1], 5, 26); }
    } else if (key === "whip") {
      if (ph >= 1 && bsCue(f, "swish")) { if (live) BSND.swish(); }
      if (mt >= a0 + 3 && bsCue(f, "crack")) { if (live) BSND.crack(); }
      if (ph === 0 && tk % 4 === 0) { const p = bsW(f, 50, -130); addFx({ k: "mote", x: p[0] + (Math.random() - 0.5) * 16, y: p[1], vx: 0, vy: -0.8, col: BS.tine, r: 1.6, t: 0, life: 24, g: -0.02, damp: 0.96 }); }
    } else if (key === "rain") {
      if (ph === 0 && tk % 3 === 0) { const p = bsW(f, 30, -230); addFx({ k: "mote", x: p[0] + (Math.random() - 0.5) * 30, y: p[1] + Math.random() * 20, vx: 0, vy: -1.6, col: Math.random() < 0.5 ? BS.gold : BS.tine, r: 1.8, t: 0, life: 26, g: -0.04, damp: 0.97 }); }
    } else if (key === "charge") {
      if (ph === 0) {
        if (mt % 16 === 9) { const p = bsW(f, -48, 0); dust(p[0], p[1], 3, 14); }
        if (mt % 10 === 2) { const p = bsW(f, BS_FX + 40, -64); for (const s of [-1, 1]) addFx({ k: "puff", x: p[0], y: p[1] + s * 3, vx: d * (1.4 + Math.random()), vy: -0.5 + s * 0.3, r: 3.5, t: 0, life: 20, col: "#cfc4c4" }); }
        if (mt >= 4 && bsCue(f, "snort")) { if (live) BSND.snorts(); }
      } else if (ph === 1) {
        if (bsCue(f, "roar")) { if (live) BSND.roar(); cam.shake = Math.max(cam.shake, 3); }
        if (tk % 2 === 0) ember(f.x - d * 30, f.y - 6, -d * (1 + Math.random() * 2), -0.6 - Math.random() * 1.4);
      } else if (bsCue(f, "wall") && bsAtWall(f)) {   // he hits the wall: a shake, the floor's end puffs embers, 20 frames dazed
        cam.shake = Math.max(cam.shake, 8);
        const S = STAGE.main, wx = d > 0 ? S.x2 : S.x1;
        for (let i = 0; i < 10; i++) ember(wx - d * Math.random() * 10, S.top - 4, -d * (0.5 + Math.random() * 2.5), -1.5 - Math.random() * 3);
        dust(f.x + d * 40, f.y, 6, 30);
        if (live) BSND.thunk();
      }
    } else if (key === "stomp") {
      if (ph === 0 && f.mt === 1) dust(f.x, f.y, 5, 40);
    }
  } else if (f.state === "idle" && f.st > 40 && (tk + 23) % 360 === 11) {   // the idle fork tap: five embers where the butt lands
    const p = bsW(f, 50 + Math.cos(-1.85) * -60, 0);
    for (let i = 0; i < 5; i++) ember(p[0] + (Math.random() - 0.5) * 8, p[1] - 2, (Math.random() - 0.5) * 2.4, -1.2 - Math.random() * 1.8);
  }
  if (rage) {
    if (tk % 4 === 0) { const p = bsW(f, (Math.random() - 0.5) * 90, -30 - Math.random() * 100); addFx({ k: "mote", x: p[0], y: p[1], vx: (Math.random() - 0.5) * 0.4, vy: -1.2, col: Math.random() < 0.6 ? BS.ember : BS.gold, r: 1.5 + Math.random(), t: 0, life: 40, g: -0.02, damp: 0.97 }); }
    if (live && f.state !== "stagger" && ++BX.beat >= 36) { BX.beat = 0; BSND.heart(); }
  }
  if (f.state === "broken" && tk % 7 === 0) {   // smoke off the horns
    for (const hx of [BS_FX - 34, BS_FX + 34]) { const p = bsW(f, hx, -150 + 14); addFx({ k: "puff", x: p[0] + (Math.random() - 0.5) * 6, y: p[1], vx: (Math.random() - 0.5) * 0.5, vy: -0.9 - Math.random() * 0.5, r: 4 + Math.random() * 3, t: 0, life: 40, col: "#3c2828", damp: 0.98 }); }
  }
}

/* ---- events: his moves, staggers and fall (looks and sounds; sounds only while `live`). Returns true for an event it fully handled
   (a boss fireball's "burst": fire, not the Alchemist's green; effects.js may skip its own case for it). ---- */
function bossEvent(g, e, live) {
  if (BX.g !== g) bsReset(g);
  const A = bossArt(bsOf(g));
  if (A) return A.event(g, e, live);
  switch (e.type) {
    case "bossMove":
      if (e.mv === "stomp") { if (live) BSND.hop(); }
      else if (e.mv === "rain") { if (live) BSND.hum(); }
      return false;
    case "bossStomp": {
      BX.rings.push({ x: e.x, t: tick });
      dust(e.x - 50, e.y, 6, 40); dust(e.x + 50, e.y, 6, 40);
      for (let i = 0; i < 8; i++) ember(e.x + (Math.random() - 0.5) * 80, e.y - 4, (Math.random() - 0.5) * 5, -1 - Math.random() * 3);
      cam.shake = Math.max(cam.shake, 7);
      if (live) BSND.stomp();
      return false;
    }
    case "bossRain": {
      const f = g.fighters[e.slot], p = f ? bsW(f, 30, -230) : [e.x, e.y - 230];
      addFx({ k: "ring", x: p[0], y: p[1], t: 0, life: 14, r0: 6, r1: 40, col: BS.gold });
      for (let i = 0; i < 8; i++) addFx({ k: "line", x: p[0], y: p[1], vx: (Math.random() - 0.5) * 4, vy: -6 - Math.random() * 6, t: 0, life: 10 + Math.random() * 6, col: i % 2 ? "#fff0c0" : BS.tine, w: 2.5 });
      return false;
    }
    case "bossStagger": {
      const f = g.fighters[e.slot], p = f ? bsW(f, BS_FX, -150) : [e.x, e.y - 150];
      addFx({ k: "ring", x: p[0], y: p[1] + 40, t: 0, life: 18, r0: 20, r1: 110, col: BS.gold });
      addFx({ k: "star", x: p[0], y: p[1] + 40, t: 0, life: 9, s: 46 });
      if (f) { const q = bsW(f, 120, -20); dust(q[0], f.y, 5, 50); }   // the fork hits the floor
      cam.shake = Math.max(cam.shake, 6);
      if (live) BSND.stagger();
      return false;
    }
    case "bossBroken": {
      const f = g.fighters[e.slot];
      for (let i = 0; i < 12; i++) addFx({ k: "puff", x: e.x + (Math.random() - 0.5) * 80, y: e.y - 40 - Math.random() * 90, vx: (Math.random() - 0.5) * 1.5, vy: -0.6 - Math.random(), r: 6 + Math.random() * 6, t: 0, life: 50, col: "#3c2828", damp: 0.97 });
      if (f) dust(f.x, f.y, 8, 70);
      cam.shake = Math.max(cam.shake, 9);
      if (live) BSND.broken();
      return false;
    }
    case "burst": {
      const o = g.fighters[e.slot];
      if (!o || !o.spec.boss) return false;
      addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 8, r1: e.r * 1.1, col: BS.tine });
      for (let i = 0; i < 4; i++) ember(e.x + (Math.random() - 0.5) * 16, e.y - 2, (Math.random() - 0.5) * 5, -2 - Math.random() * 3);
      BX.scorch.push({ x: e.x, t: tick });
      if (BX.scorch.length > 12) BX.scorch.shift();
      cam.shake = Math.max(cam.shake, 3);
      if (live) BSND.fwump();
      return true;
    }
    case "hit": {
      if (e.boss) {
        if (e.down) {   // the final launch: he goes out in a burst of embers
          addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 22, r0: 20, r1: 170, col: BS.gold });
          for (let i = 0; i < 22; i++) { const a = Math.random() * BS_TAU, sp = 3 + Math.random() * 7; ember(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp - 2); }
          cam.shake = Math.max(cam.shake, 14);
          if (live) BSND.down();
        } else if (e.stag) {   // hit sparks turn gold while he is staggered
          addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 12, r0: 6, r1: 34 + e.dmg * 1.5, col: BS.gold });
          for (let i = 0; i < 7; i++) { const a = Math.random() * BS_TAU, sp = 3 + Math.random() * 5; addFx({ k: "line", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 9 + Math.random() * 6, col: i % 2 ? "#fff2c2" : BS.gold, w: 2.6 }); }
        } else if (e.broken) {   // a light hit on a broken boss does nothing: a dull tink
          addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 8, r0: 4, r1: 18, col: "#c9ced8" });
        }
      } else if (g.fighters[e.slot] && g.fighters[e.slot].spec.boss) {
        if (e.mv === "stab" && !e.ps && live) BSND.stabHit();
        for (let i = 0; i < 5; i++) ember(e.x, e.y, (Math.random() - 0.5) * 5, -Math.random() * 3);
      }
      return false;
    }
  }
  return false;
}

/* ---- his sounds (base.js Sfx helpers; quiet like the rest of the game) ---- */
const BSND = {
  lunge() { Sfx.tone(600, 1800, 0.12, "sine", 0.05); Sfx.noiseF(0.12, 0.12, "highpass", 1800, 3600, 0.9); },
  stabHit() { Sfx.noise(0.08, 0.32, 300); Sfx.tone(110, 108, 0.12, "sine", 0.3); },
  hop() { Sfx.noiseF(0.32, 0.2, "bandpass", 300, 1300, 0.9); },
  stomp() { Sfx.tone(80, 40, 0.3, "sine", 0.55); Sfx.noise(0.18, 0.28, 500); },
  crackle() { Sfx.noiseF(0.012 + Math.random() * 0.014, 0.16, "highpass", 2600, 4200, 0.8); },
  swish() { Sfx.noiseF(0.18, 0.2, "highpass", 1100, 4200, 1); },
  crack() { Sfx.noiseF(0.03, 0.45, "highpass", 2000, 2100, 0.7); Sfx.tone(1900, 900, 0.03, "square", 0.03); },
  hum() { Sfx.tone(110, 220, 0.6, "sine", 0.1); Sfx.tone(110, 220, 0.6, "triangle", 0.035); },
  fwump() { Sfx.noise(0.09, 0.4, 400); Sfx.tone(120, 60, 0.09, "sine", 0.18); },
  snorts() { Sfx.noise(0.06, 0.3, 500); Sfx.later(160, () => Sfx.noise(0.06, 0.3, 500)); },
  roar() { Sfx.noiseF(0.5, 0.24, "bandpass", 420, 200, 1.2); Sfx.tone(140, 70, 0.5, "sawtooth", 0.05); Sfx.tone(50, 50, 0.5, "sine", 0.45); },
  thunk() { Sfx.tone(90, 40, 0.25, "sine", 0.45); Sfx.noise(0.12, 0.3, 700); },
  heart() { Sfx.tone(45, 45, 0.04, "sine", 0.5); },
  stagger() { Sfx.tone(520, 260, 0.25, "triangle", 0.06); Sfx.later(120, () => Sfx.tone(440, 220, 0.25, "triangle", 0.05)); },
  broken() { Sfx.tone(160, 55, 0.6, "sawtooth", 0.05); Sfx.noise(0.4, 0.18, 400); },
  down() { Sfx.tone(70, 28, 0.6, "sine", 0.5); Sfx.noise(0.45, 0.3, 900); },
};
