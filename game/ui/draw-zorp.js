/* ===================== Bosses: Zorp, the Alien (UI only): his saucer, his beams and probes, his tells on the floor, his sounds =====================
   Registers BOSS_ART.zorp (the registry and the hand-over are in draw-boss.js): drawBoss / drawBossProj / bossFloor / bossEvent come here
   for him. Fable's design: /mnt/project-files/bosses2/fable-design.md section 1 (world units, 60 frames a second). The simulation
   (core.js zorpStep / bossProjStep) never reads anything here; this file reads the fighter, the game and its projectiles only.
   Fighter space: facing +x, y 0 = the saucer's underside (f.y); the hurtbox is 160 x 120 (the dome's top at -120). A small green potato
   (rx 38 / ry 46, bigger would not fit under the glass) sits in a saucer under a glass dome (rx 62 / ry 76 off the collar at -44, a touch
   taller than Fable's 58 / 66 so the antennae and the face read on a phone); his three-fingered hands press flat on the inside of the glass,
   his two antennae are his brows. f.ph 0: he hovers (a 1.6 s bob, a tilt from his drift, cyan thruster cones, a hum); f.ph 1: the saucer
   lies on the floor, the dome cracked and open top-right, and he scoots. Every move has a tell on him (face, antennae, lights, dish,
   hatch) and on the floor (zFloor), then its strike and its end lag; every tell has a sound too. Once-per-tick work (cues, particles,
   sounds) runs from zFloor when the UI tick has moved on. Gradients are made once per canvas context, glows are sprites, no shadowBlur. */
const ZC = {
  skinHi: "#a9c0a0", skin: "#6f8a6c", skinLo: "#3b4f3f", freckle: "#c6d8bc", stalk: "#4a5f4c", green: "#9dff5a", glass: "#d8f3ff",
  collar: "#7f8b93", top: "#c9d2d6", topLo: "#8f9ba3", ring: "#dbe3e6", rim: "#6a757d", red: "#ff5a5a", under: "#4a545c", underLo: "#2d343a",
  dish: "#3bff9a", sclera: "#cfe9c9", rage: "#ff3b2b", tongue: "#8a5a9a", tin: "#c9d2d6", dead: "#3a4046", mouth: "#1a2a1c", stagLit: "#ff8a5a",
};
const ZP = { rx: 38, ry: 46, cy: -52 };   // the potato, in potatoPath's units: its top at -98, its bottom hidden in the saucer
const Z_DY = -44, Z_DRX = 62, Z_DRY = 76;   // the dome: its base line (the collar's top) and radii (its top at -120)
const Z_RIM = -26, Z_UND = -16;   // the top lens sits on y -26 (ry 22), the rim band runs -26..-16, the underside below it (ry 16, its bottom at 0)
const Z_EY = -68, Z_FX = 3, Z_MY = -52;   // the eye line, the face's centre line (towards his front), the mouth
const Z_TAU = Math.PI * 2;
const Z_EX = [-22, 0, 22], Z_ER = [8, 9, 8];
const Z_FRECK = [[-30, -56], [30, -57], [-13, -88], [5, -92], [19, -85], [-24, -82]];
const Z_THR = [-50, 0, 50];
// the crack after the crash: a zigzag from the collar to the crown and three branches (from point i to a tip)
const Z_CRACK = [[[18, -45], [11, -58], [21, -71], [9, -86], [17, -100], [8, -116]], [[1, [-3, -66]], [3, [-5, -94]], [2, [34, -80]]]];

// ---- cached art: the body path, the glass outlines, gradients per canvas context, glow sprites ----
let Z_PATH = null;
const zGradCache = new WeakMap(), Z_GLOW = {}, Z_GLASS = {};
function zPath() {
  if (Z_PATH) return Z_PATH;
  const p = new Path2D(), { rx, ry, cy } = ZP;
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Z_TAU, bump = 1 + 0.03 * Math.sin(a * 4 + 1.3) + 0.02 * Math.sin(a * 7 + 0.4), wide = 1 + 0.06 * Math.sin(a);
    const x = Math.cos(a) * rx * bump * wide, y = cy + Math.sin(a) * ry * bump;
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return (Z_PATH = p);
}
function zGrads(c) {
  let G0 = zGradCache.get(c);
  if (!G0) {
    const { rx, ry, cy } = ZP;
    const skin = (a, b, d) => { const g = c.createRadialGradient(-rx * 0.35, cy - ry * 0.45, ry * 0.1, 0, cy, ry * 1.3); g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, d); return g; };
    const lin = (y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
    G0 = { n: skin(ZC.skinHi, ZC.skin, ZC.skinLo), b: skin("#8a9488", "#5c6a5c", "#323b34"), top: lin(-48, -26, ZC.top, ZC.topLo), under: lin(-16, 2, ZC.under, ZC.underLo),
      topB: lin(-48, -26, "#a3aaae", "#6f777d") };
    zGradCache.set(c, G0);
  }
  return G0;
}
function zGlowSprite(key, r, g, b) {
  if (Z_GLOW[key]) return Z_GLOW[key];
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const x = cv.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},0.95)`); gr.addColorStop(0.4, `rgba(${r},${g},${b},0.42)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (Z_GLOW[key] = cv);
}
function zGlow(c, x, y, r, a, key) {
  if (a <= 0 || r <= 0) return;
  const spr = key === "red" ? zGlowSprite("red", 255, 70, 50) : key === "cyan" ? zGlowSprite("cyan", 120, 230, 255) : key === "white" ? zGlowSprite("white", 235, 255, 240) : zGlowSprite("green", 157, 255, 90);
  const ga = c.globalAlpha; c.globalAlpha = ga * Math.min(1, a); c.drawImage(spr, x - r, y - r, r * 2, r * 2); c.globalAlpha = ga;
}
// the glass's outline: "full", "open" (a jagged chunk gone top right: phase 2) or "half" (broken: the right top half gone)
function zGlassPts(kind) {
  if (Z_GLASS[kind]) return Z_GLASS[kind];
  const pts = [], E = (a, k = 1) => [Math.cos(a * Math.PI) * Z_DRX * k, Z_DY + Math.sin(a * Math.PI) * Z_DRY * k];
  const arc = (a0, a1) => { for (let i = 0; i <= 30; i++) { const a = 1 + i / 30; if (a >= a0 - 1e-6 && a <= a1 + 1e-6) pts.push(E(a)); } };
  if (kind === "open") {   // in from the edge and back out, jagged
    arc(1, 1.6);
    for (const [a, k] of [[1.64, 0.8], [1.68, 0.88], [1.72, 0.7], [1.77, 0.82], [1.8, 0.68], [1.84, 0.86]]) pts.push(E(a, k));
    arc(1.86, 2);
  } else if (kind === "half") {   // what is left: the left side up to the crown's left, then a jagged break down to the right collar
    arc(1, 1.4);
    for (const p of [[-6, -112], [-2, -100], [8, -104], [12, -90], [24, -94], [28, -78], [40, -82], [44, -66], [54, -68], [56, -54], [62, -50], [Z_DRX, Z_DY]]) pts.push(p);
  } else arc(1, 2);
  return (Z_GLASS[kind] = pts);
}
function zPoly(c, pts, close) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (close) c.closePath(); }

// ---- who and what ----
function zRage(f) {
  const lv = RG && RG.lv != null ? RG.lv : 0, B = f.spec.boss;
  return !!B && f.hpMax > 0 && f.hp * 100 <= f.hpMax * B.rageAt[clamp(lv, 0, 2)];
}
// the move being played: phase 0 tell (mt <= startup), 1 strike, 2 end lag; k = progress through that phase
function zPhase(f) {
  const m = f.move;
  if (f.state !== "attack" || !m) return null;
  const a0 = m.startup + 1, a1 = m.startup + m.active, mt = f.mt, ph = mt < a0 ? 0 : mt <= a1 ? 1 : 2;
  const k = ph === 0 ? clamp(mt / Math.max(1, m.startup), 0, 1) : ph === 1 ? (m.active > 1 ? clamp((mt - a0) / (m.active - 1), 0, 1) : 1) : clamp((mt - a1) / Math.max(1, m.endlag), 0, 1);
  return { key: m.boss || f.mid, m, a0, a1, mt, ph, k, e: mt - a1 };
}
const zHovering = (f) => f.ph === 0 && f.state !== "broken" && f.state !== "fin" && f.state !== "hitstun" && !(f.mid === "crash" && f.move && f.mt >= f.move.startup);
const zBob = (f, tk) => (zHovering(f) && f.state !== "stagger" && f.mid !== "crash" ? 5 * Math.sin((tk / 96) * Z_TAU) : 0);

/* ---- the look: tilt, face, antennae, lights, dish, hatch, fog, crack, thrusters (fighter space, facing +x) ---- */
function zLook(f, tk) {
  const st = f.state, P = zPhase(f), hover = zHovering(f), d = f.facing || 1;
  const Q = { bob: zBob(f, tk), tilt: 0, face: "idle", ant: "rest", lights: "norm", dead: 0, dish: 0, dishRed: false, hatch: 0, fog: 0, slide: 0,
    crack: f.ph === 1 || st === "broken" || st === "fin" || st === "hitstun", glass: f.ph === 1 || st === "fin" ? "open" : "full", dim: false,
    duck: 0, thr: hover ? 1 : 0, thrCol: "cyan", eyeLit: 0, beam: -1, both: false, spin: -1, lid: 0, look: [1.6, 0.4], stars: false,
    roll: 0, rage: false, grin: false };
  Q.rage = zRage(f) && st !== "broken" && st !== "hitstun" && st !== "fin";
  if (hover) Q.tilt = clamp(f.vx * 0.08, -0.25, 0.25);
  else if (st === "run") Q.tilt = Math.sin(f.x * 0.21) * 0.035;
  if (st === "stagger") {
    Q.face = "stag"; Q.ant = "droop"; Q.fog = 1; Q.lights = "stag"; Q.stars = true;
    Q.tilt = (f.ph === 0 ? 0.25 : 0.1) * d + Math.sin((tk / 30) * Z_TAU) * 0.03; Q.slide = clamp(f.st / 30, 0, 1); Q.thr = f.ph === 0 ? 0.5 : 0;
  } else if (st === "broken") {
    Q.face = "broken"; Q.ant = "bent"; Q.lights = "dead"; Q.glass = "half"; Q.dim = true; Q.thr = 0; Q.tilt = 0.12 * d; Q.slide = 1;
  } else if (st === "fin") {   // the KO page's puppet: down on the floor, dazed, the dome cracked open
    Q.face = "stag"; Q.ant = "droop"; Q.lights = "dead"; Q.thr = 0; Q.tilt = 0.08 * d; Q.slide = 1; Q.stars = true;
  } else if (st === "hitstun") {   // launched out: the saucer spins off like a frisbee with him screaming inside
    Q.face = "launch"; Q.ant = "up"; Q.lights = "strobe"; Q.glass = "half"; Q.thr = 0; Q.roll = f.st * 0.32 * (f.kbx >= 0 ? 1 : -1);
  } else if (P) {
    const { key, ph, k, mt, a0 } = P;
    Q.face = ph === 0 ? "windup" : ph === 1 ? "strike" : "idle";
    Q.ant = ph === 0 ? "fwd" : "rest";
    if (key === "beam") {
      // the saucer tilts to the target, the dish lights; held: the grin
      if (ph === 0) { Q.tilt = 0.2 * d * ease(Math.min(1, k * 1.5)); Q.dish = 1; }
      else if (ph === 1) { Q.dish = 1; Q.tilt = clamp(f.vx * 0.08, -0.25, 0.25); Q.face = "lock"; }
      else { Q.dish = Math.max(0, 1 - k * 3); }
      if (RG && RG.fighters.some((o) => o.held === f.slot)) { Q.face = "grin"; Q.grin = true; }
    } else if (key === "laser") {
      if (ph <= 1) { Q.lights = "red"; Q.dish = 1; Q.dishRed = true; }
      if (ph === 1) Q.face = "grin";
    } else if (key === "probe") {
      Q.hatch = ph === 0 ? ease(Math.min(1, k * 2)) : ph === 1 ? 1 : Math.max(0, 1 - k * 2);
      if (ph === 0) Q.face = "windup";
    } else if (key === "abduct") {
      if (ph === 0) { Q.face = "lock"; Q.lights = "siren"; Q.dish = mt >= 48 ? 1 : 0.5; }
      else if (ph === 1) { Q.dish = 1; Q.face = "lock"; }
      if (RG && RG.fighters.some((o) => o.held === f.slot)) Q.face = "grin";
      const ex = (f.bx - f.x) * d, ey = STAGE.main.top - f.y - Z_EY, l = Math.hypot(ex, ey) || 1;
      if (Q.face === "lock") Q.look = [(ex / l) * 2.6, (ey / l) * 2.6];
    } else if (key === "bump") {
      Q.look = [0.5, -3];
      if (ph === 0) { Q.face = "up"; Q.tilt = 0.1 * Math.sin((mt / 4) * Z_TAU); Q.thr = 2; }
      else if (ph === 1) { Q.face = "strike"; Q.look = [0.5, -3]; Q.thr = 2.6; }
    } else if (key === "crash") {
      if (mt < P.m.startup) {   // the fall: tilting, wobbling, the lights dying, the thrusters sputtering
        Q.face = "panic"; Q.ant = "up"; Q.lights = "dying"; Q.dead = Math.floor(mt / 5); Q.thrCol = "grey"; Q.thr = (tk >> 1) % 3 ? 0.8 : 0.2; Q.crack = true;
        Q.tilt = 0.35 * d * ease(Math.min(1, mt / 20)) + 0.08 * Math.sin(mt * 0.55);
      } else {   // down: lying cocked, dazed
        Q.face = "stag"; Q.ant = "droop"; Q.lights = "dead"; Q.thr = 0; Q.tilt = 0.06 * d * Math.max(0, 1 - (mt - P.m.startup) / 12) * Math.cos((mt - P.m.startup) * 0.9); Q.stars = mt > P.m.startup + 10;
      }
    } else if (key === "eye") {
      // the eyes light red one by one (10 frames each), then the beam sweeps, then they cool
      if (ph === 0) { Q.eyeLit = Math.min(3, 1 + Math.floor(mt / 10)); Q.face = "windup"; }
      else if (ph === 1) { Q.eyeLit = 3; Q.beam = k; Q.both = f.mid !== "eye"; Q.face = "strike"; }
      else Q.eyeLit = k < 0.3 ? 3 * (1 - k / 0.3) : 0;
    } else if (key === "toss") {
      Q.lid = ph === 0 ? ease(Math.min(1, k * 1.6)) : ph === 1 ? 1 : Math.max(0, 1 - k * 2);
    } else if (key === "spin") {
      if (ph === 0) { Q.lights = "chase3"; Q.duck = 20 * ease(Math.min(1, k * 2)); Q.face = "windup"; }
      else if (ph === 1) { Q.duck = 20; Q.spin = mt - a0; Q.lights = "chase3"; Q.face = "windup"; }
      else Q.duck = 20 * (1 - ease(Math.min(1, k * 2)));
    } else if (key === "hop") {
      if (ph === 0 && f.grounded) Q.tilt = -0.14 * d * ease(Math.min(1, k * 2.5));   // he rocks back
      else if (ph === 0) { Q.tilt = 0.1 * d; Q.thr = 2.2; Q.thrCol = "green"; }
      else if (ph === 1) Q.face = "strike";
    }
  } else if (st === "run" && f.ph === 1) Q.face = "idle";
  if (f.ph === 1 && Q.lights === "norm") Q.lights = "cracked";
  if (Q.rage) {
    Q.ant = "out"; if (Q.lights === "norm" || Q.lights === "cracked") Q.lights = "strobe";
    if (Q.face === "idle" || Q.face === "windup" || Q.face === "strike" || Q.face === "grin" || Q.face === "lock" || Q.face === "up") Q.face = "rage";
  }
  return Q;
}

/* ---- the saucer (fighter space) ---- */
function zThrusters(c, Q, tk, flash) {
  if (flash) return;
  for (let i = 0; i < 3; i++) {
    const x = Z_THR[i], y0 = i === 1 ? 4 : -16 + 16 * Math.sqrt(1 - (x / 80) * (x / 80)) + 2;
    c.fillStyle = ZC.rim; c.strokeStyle = OUT; c.lineWidth = 1.5;
    if (i !== 1) { c.beginPath(); c.rect(x - 5, y0 - 6, 10, 8); c.fill(); c.stroke(); }
    if (Q.thr <= 0) continue;
    const fl = 0.78 + 0.22 * Math.sin(Math.floor(tk / 2) * 2.3 + i * 1.7), len = (10 + 8 * fl) * Q.thr, w = 4 + Q.thr;
    const col = Q.thrCol === "green" ? "rgba(157,255,90,0.75)" : Q.thrCol === "grey" ? "rgba(150,155,160,0.55)" : "rgba(120,230,255,0.6)";
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y0 + 2); c.quadraticCurveTo(x - w * 0.4, y0 + len * 0.6, x, y0 + 2 + len); c.quadraticCurveTo(x + w * 0.4, y0 + len * 0.6, x + w, y0 + 2); c.closePath(); c.fill();
    if (Q.thrCol !== "grey") { c.fillStyle = "rgba(240,255,255,0.8)"; c.beginPath(); c.moveTo(x - w * 0.4, y0 + 2); c.lineTo(x, y0 + 2 + len * 0.5); c.lineTo(x + w * 0.4, y0 + 2); c.closePath(); c.fill(); }
  }
}
function zLightCol(Q, i, tk) {
  // [colour, brightness 0..1] of rim light i (0 = back left ... 7 = front right)
  const base = i % 2 ? ZC.red : ZC.green;
  switch (Q.lights) {
    case "red": return [ZC.rage, 0.75 + 0.25 * Math.sin(tk * 0.5 + i)];
    case "stag": return [ZC.stagLit, ((tk >> 3) & 1) ? 1 : 0.15];
    case "dead": return [ZC.dead, 0];
    case "dying": return i < Q.dead ? [ZC.dead, 0] : [base, (i === (Math.floor(tk / 10) % 8)) ? 1 : 0.5];
    case "strobe": return [((tk >> 2) + i) & 1 ? ZC.rage : ZC.green, ((tk >> 2) & 1) ? 1 : 0.25];
    case "siren": return [i < 4 ? ZC.red : ZC.green, ((tk / 9 | 0) % 2) === (i < 4 ? 0 : 1) ? 1 : 0.2];
    case "chase3": return [base, i === (Math.floor(tk / 3) % 8) ? 1 : 0.35];
    case "cracked": if (i === 2 || i === 5) return [ZC.dead, 0];   // two lights died in the crash
    // falls through
    default: return [base, i === (Math.floor(tk / 10) % 8) ? 1 : 0.5];
  }
}
function zSaucer(c, Q, tk, flash, armor) {
  const G0 = zGrads(c);
  zThrusters(c, Q, tk, flash);
  // the underside, the dish at its centre (its glow r 40 when a beam move is coming)
  c.beginPath(); c.ellipse(0, Z_UND, 80, 16, 0, 0, Math.PI); c.closePath();
  c.fillStyle = flash ? "#ffffff" : G0.under; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
  if (!flash) { c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, Z_UND, 70, 10, 0, 0.3, Math.PI - 0.3); c.stroke(); }
  if (Q.dish > 0 && !flash) zGlow(c, 0, -2, 40, 0.85 * Q.dish, Q.dishRed ? "red" : "green");
  const h = Q.hatch;
  c.beginPath(); c.ellipse(0, -3, 26, 7, 0, 0, Z_TAU);
  c.fillStyle = flash ? "#ffffff" : Q.dish > 0 ? (Q.dishRed ? mix("#ff8a7a", ZC.rage, 0.3) : mix("#1f6a4a", ZC.dish, Q.dish)) : "#1f6a4a"; c.fill();
  c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  if (!flash) { c.fillStyle = "rgba(240,255,245,0.45)"; c.beginPath(); c.ellipse(-8, -6, 9, 2, -0.1, 0, Z_TAU); c.fill(); }
  if (h > 0 && !flash) {   // Probe Drop's hatch: the dish slides open, three antennae poke out blinking
    const gw = 22 * h;
    c.fillStyle = "#0d1114"; c.beginPath(); c.ellipse(0, -3, gw, 6 * Math.min(1, h * 1.5), 0, 0, Z_TAU); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      const ax = i * 9 * h, ay = 2 + 9 * h + (i ? 0 : 3 * h), on = ((tk >> 3) + i + 1) % 3 !== 0;
      c.beginPath(); c.moveTo(ax, -2); c.lineTo(ax, ay); c.stroke();
      c.fillStyle = on ? ZC.rage : "#5a2020"; c.beginPath(); c.arc(ax, ay + 1.5, 2.4, 0, Z_TAU); c.fill(); c.lineWidth = 1.2; c.stroke(); c.lineWidth = 2;
      if (on) zGlow(c, ax, ay + 1.5, 8, 0.7, "red");
    }
  }
  // the rim band (10 tall) and its eight lights
  c.beginPath(); c.moveTo(-80, Z_RIM); c.ellipse(0, Z_RIM, 80, 6, 0, Math.PI, 0, true); c.lineTo(80, Z_UND); c.ellipse(0, Z_UND, 80, 6, 0, 0, Math.PI, false); c.closePath();
  c.fillStyle = flash ? "#ffffff" : ZC.rim; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  for (let i = 0; i < 8; i++) {
    const x = -70 + i * 20, y = -21 + 6 * Math.sqrt(1 - (x / 80) * (x / 80)), [col, on] = flash ? ["#ffffff", 0] : zLightCol(Q, i, tk);
    if (on > 0.6) zGlow(c, x, y, 11, 0.8 * on, col === ZC.rage || col === ZC.red || col === ZC.stagLit ? "red" : "green");
    c.fillStyle = on > 0 ? mix(ZC.dead, col, 0.35 + 0.65 * on) : ZC.dead; c.beginPath(); c.arc(x, y, 4, 0, Z_TAU); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
    if (on > 0.6) { c.fillStyle = "rgba(255,255,255,0.75)"; c.beginPath(); c.arc(x - 1.2, y - 1.2, 1.2, 0, Z_TAU); c.fill(); }
  }
  // Saucer Spin: the rim a blur of motion arcs on both sides
  if (Q.spin >= 0 && !flash) {
    const a = Q.spin < 3 || (Q.spin >= 6 && Q.spin < 9) ? 1 : 0.55;
    c.strokeStyle = `rgba(230,240,245,${(0.85 * a).toFixed(3)})`; c.lineWidth = 3;
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { c.beginPath(); c.ellipse(0, -21, 96 + j * 9, 10 + j * 3, 0, s > 0 ? -0.5 + j * 0.05 : Math.PI - 0.5, s > 0 ? 0.6 : Math.PI + 0.6 - j * 0.05); c.stroke(); }
  }
  // the top lens, its inner ring
  c.beginPath(); c.ellipse(0, Z_RIM, 80, 22, 0, Math.PI, Z_TAU); c.closePath();
  c.fillStyle = flash ? "#ffffff" : Q.dim ? G0.topB : G0.top; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
  if (!flash) {
    c.strokeStyle = "rgba(219,227,230,0.5)"; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, Z_RIM - 3, 66, 13, 0, Math.PI + 0.12, Z_TAU - 0.12); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, Z_RIM, 74, 18, 0, Math.PI + 0.25, Math.PI + 0.75); c.stroke();
    if (Q.crack || Q.dim) {   // dents and a scorch from the crash
      c.fillStyle = "rgba(40,45,50,0.35)"; c.beginPath(); c.ellipse(-56, -33, 8, 3, 0.2, 0, Z_TAU); c.ellipse(64, -31, 6, 2.4, -0.3, 0, Z_TAU); c.fill();
      c.strokeStyle = "rgba(17,16,28,0.5)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-60, -31); c.lineTo(-52, -35); c.moveTo(60, -30); c.lineTo(67, -33); c.stroke();
    }
  }
  // Probe Toss: the lid at his back flips open, the probes sit up inside blinking
  if (Q.lid > 0 && !flash) {
    for (let i = 0; i < 3; i++) {
      const px_ = -66 + i * 9, py_ = -32 - 10 * Q.lid + (i === 1 ? -2 : 0), on = ((tk >> 3) + i) % 2;
      c.fillStyle = ZC.tin; c.strokeStyle = OUT; c.lineWidth = 1.3; c.beginPath(); c.roundRect(px_ - 4, py_, 8, 9, 2); c.fill(); c.stroke();
      c.fillStyle = ZC.rage; c.beginPath(); c.arc(px_ + 1, py_ + 4, 1.6, 0, Z_TAU); c.fill();
      c.beginPath(); c.moveTo(px_, py_); c.lineTo(px_, py_ - 5); c.stroke();
      c.fillStyle = on ? ZC.green : "#2a5a1a"; c.beginPath(); c.arc(px_, py_ - 6, 1.8, 0, Z_TAU); c.fill(); c.stroke();
    }
    c.save(); c.translate(-46, -36); c.rotate(-1.9 * Q.lid);
    c.fillStyle = ZC.topLo; c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.roundRect(-26, -3, 26, 5, 2); c.fill(); c.stroke();
    c.restore();
  }
  if (armor > 0 && !flash) {   // a hit he tanked (poise): a gold rim round the saucer
    c.strokeStyle = `rgba(255,216,74,${(0.9 * Math.min(1, armor / 8)).toFixed(3)})`; c.lineWidth = 4;
    c.beginPath(); c.ellipse(0, Z_RIM, 82, 24, 0, Math.PI, Z_TAU); c.stroke();
    c.beginPath(); c.ellipse(0, Z_UND, 82, 18, 0, 0, Math.PI); c.stroke();
  }
}

/* ---- the pilot (fighter space, inside the glass) ---- */
// an antenna: base (bx, by), angle a from straight up (+ = towards his front), length l; returns the bulb
function zAntenna(c, bx, by, a, l, kink, bulb, flash) {
  const tx = bx + Math.sin(a) * l, ty = by - Math.cos(a) * l, mx = bx + Math.sin(a * 0.45) * l * 0.55 + kink, my = by - Math.cos(a * 0.45) * l * 0.55;
  c.strokeStyle = OUT; c.lineWidth = 5.4; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
  c.strokeStyle = flash ? "#ffffff" : ZC.stalk; c.lineWidth = 3; c.stroke();
  if (bulb > 0 && !flash) zGlow(c, tx, ty, 9, 0.6 * bulb, "green");
  c.fillStyle = flash ? "#ffffff" : bulb > 0 ? ZC.green : "#5a7a5a"; c.beginPath(); c.arc(tx, ty, 4, 0, Z_TAU); c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
  if (!flash && bulb > 0) { c.fillStyle = "rgba(255,255,255,0.8)"; c.beginPath(); c.arc(tx - 1.3, ty - 1.3, 1.2, 0, Z_TAU); c.fill(); }
  return [tx, ty];
}
function zAntennae(c, Q, tk, flash) {
  const sw = Math.sin((tk / 70) * Z_TAU) * 0.06, by = ZP.cy - ZP.ry * 0.94, out = [];
  let A = [-0.85 + sw, 0.85 - sw], l = 20, kink = [0, 0], bulb = 1;
  if (Q.ant === "fwd") A = [0.25, 0.6];
  else if (Q.ant === "droop") A = [-2.05 + sw, 1.95 - sw];
  else if (Q.ant === "out") A = [-1.5 + Math.sin(tk * 0.9) * 0.04, 1.5 + Math.sin(tk * 1.1) * 0.04];
  else if (Q.ant === "up") { A = [-0.3 + Math.sin(tk * 0.8) * 0.15, 0.3 - Math.sin(tk * 0.8) * 0.15]; }
  else if (Q.ant === "bent") { A = [-1.1, 2.3]; kink = [-6, 5]; bulb = 0; l = 18; }
  if (Q.lights === "dead" || Q.dim) bulb = 0;
  for (let i = 0; i < 2; i++) out.push(zAntenna(c, (i ? 9 : -9) + Z_FX * 0.5, by + 2, A[i], l, kink[i], bulb, flash));
  return out;
}
// a three-fingered hand pressed flat on the inside of the glass (palm towards us, fingers up)
function zHand(c, x, y, s, col, flash) {
  c.fillStyle = flash ? "#ffffff" : col; c.strokeStyle = OUT; c.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(x + i * 3.6 * s, y - 6.5 + Math.abs(i) * 1.2, 1.9, 3.6, i * 0.25 * s, 0, Z_TAU); c.fill(); c.stroke(); }
  c.beginPath(); c.ellipse(x, y, 5.6, 5, 0, 0, Z_TAU); c.fill(); c.stroke();
  if (!flash) { c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.ellipse(x, y, 7.5, 7, 0, 0, Z_TAU); c.fill(); }   // the squish on the glass
}
function zSpiral(c, x, y, r, tk, i) {
  c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath();
  for (let a = 0; a <= Math.PI * 6; a += 0.3) { const rr = r * (0.1 + 0.85 * a / (Math.PI * 6)), q = a + tk * 0.25 + i * 2; const px_ = x + Math.cos(q) * rr, py_ = y + Math.sin(q) * rr; if (a) c.lineTo(px_, py_); else c.moveTo(px_, py_); }
  c.stroke();
}
function zFace(c, Q, tk, flash, lid) {
  const mode = Q.face, ey = Z_EY, rage = mode === "rage";
  c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const ex = Z_EX[i] + Z_FX, r0 = Z_ER[i];
    if (mode === "broken") {   // squeezed shut
      c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(ex - r0 * 0.75, ey + 2); c.quadraticCurveTo(ex, ey - r0 * 0.7, ex + r0 * 0.75, ey + 2); c.stroke();
      continue;
    }
    const R = mode === "windup" || mode === "panic" || mode === "launch" ? r0 * 1.15 : r0, lit = i >= 3 - Q.eyeLit;   // the eye beam lights them back to front
    if (lit && !flash) zGlow(c, ex, ey, R * 2.6, 0.9, "red");
    c.beginPath(); c.arc(ex, ey, R, 0, Z_TAU); c.fillStyle = flash ? "#ffffff" : rage || lit ? ZC.rage : ZC.sclera; c.fill(); c.lineWidth = 1.7; c.strokeStyle = OUT; c.stroke();
    if (mode === "stag" || mode === "launch") zSpiral(c, ex, ey, R * 0.92, tk, i);
    else if (lit && Q.beam >= 0) { c.fillStyle = "#fff0e0"; c.beginPath(); c.arc(ex + 1, ey, R * 0.5, 0, Z_TAU); c.fill(); }
    else if (mode === "windup" || mode === "panic") {
      const j = mode === "panic" ? Math.sin(tk * 1.7 + i) * 0.8 : 0;
      c.fillStyle = OUT; c.beginPath(); c.arc(ex + 1 + j, ey, 1.7, 0, Z_TAU); c.fill();
    } else {
      let dx = Q.look[0], dy = Q.look[1];
      if (mode === "idle" && i !== 1) { dx = 2 * Math.sin((tk / 180) * Z_TAU + (i ? Math.PI : 0)); dy = 0.4; }   // the outer two scan
      const pr = rage ? 3.4 : 4;
      c.fillStyle = rage ? "#d8ffd8" : OUT; c.beginPath(); c.arc(ex + dx, ey + dy, pr, 0, Z_TAU); c.fill();
      if (!rage && !flash) { c.fillStyle = ZC.green; c.beginPath(); c.arc(ex + dx - 1.3, ey + dy - 1.4, 1.2, 0, Z_TAU); c.fill(); }
      if (mode === "idle" && i === 1) {   // the middle eye half-lidded
        const ly = ey - R + 2 * R * 0.45;
        c.save(); c.beginPath(); c.arc(ex, ey, R + 0.3, 0, Z_TAU); c.clip(); c.fillStyle = flash ? "#ffffff" : lid; c.fillRect(ex - R - 1, ey - R - 1, 2 * R + 2, ly - (ey - R - 1)); c.restore();
        const hw = Math.sqrt(Math.max(0, R * R - (ly - ey) * (ly - ey)));
        c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); c.moveTo(ex - hw, ly); c.lineTo(ex + hw, ly); c.stroke();
      }
    }
  }
  // the mouth
  const mx = Z_FX + 1, my = Z_MY, dark = flash ? "#ffffff" : ZC.mouth;
  c.strokeStyle = OUT;
  if (mode === "idle" || mode === "up") {   // a small "w"
    c.lineWidth = 2; c.beginPath(); c.moveTo(mx - 7, my - 1.5); c.quadraticCurveTo(mx - 3.5, my + 2.5, mx, my - 0.5); c.quadraticCurveTo(mx + 3.5, my + 2.5, mx + 7, my - 1.5); c.stroke();
  } else if (mode === "windup" || mode === "panic") {   // an "o" with a green throat glow
    const ry = mode === "panic" ? 4.6 + Math.sin(tk * 0.9) * 1 : 4.4;
    c.beginPath(); c.ellipse(mx, my, 4.6, ry, 0, 0, Z_TAU); c.fillStyle = dark; c.fill();
    if (!flash) { c.fillStyle = ZC.green; c.beginPath(); c.ellipse(mx, my + ry * 0.45, 2.6, 1.6, 0, 0, Z_TAU); c.fill(); }
    c.lineWidth = 1.8; c.beginPath(); c.ellipse(mx, my, 4.6, ry, 0, 0, Z_TAU); c.stroke();
  } else if (mode === "strike" || mode === "grin" || mode === "lock") {   // the toothy grin (lock: a tight one)
    const w = mode === "lock" ? 7 : 10;
    c.beginPath(); c.moveTo(mx - w, my - 3); c.quadraticCurveTo(mx, my + 1, mx + w, my - 3); c.quadraticCurveTo(mx, my + (mode === "lock" ? 4 : 7), mx - w, my - 3); c.closePath();
    c.fillStyle = dark; c.fill();
    if (!flash) { c.save(); c.clip(); c.fillStyle = "#eef6e8"; for (let q = 0; q < 5; q++) c.fillRect(mx - w + 2 + q * (w * 0.4), my - 2.6, w * 0.3, 2.4); c.restore(); }
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(mx - w, my - 3); c.quadraticCurveTo(mx, my + 1, mx + w, my - 3); c.quadraticCurveTo(mx, my + (mode === "lock" ? 4 : 7), mx - w, my - 3); c.closePath(); c.stroke();
  } else if (mode === "stag") {   // gaping, the tongue out
    c.beginPath(); c.ellipse(mx, my - 1, 5.5, 3.6, 0.1, 0, Z_TAU); c.fillStyle = dark; c.fill(); c.lineWidth = 1.8; c.stroke();
    const wag = Math.sin(tk * 0.3) * 0.25;
    c.save(); c.translate(mx + 2, my + 1.5); c.rotate(0.3 + wag);
    c.beginPath(); c.moveTo(-3, -1); c.lineTo(-3, 3); c.quadraticCurveTo(0, 7, 3, 3); c.lineTo(3, -1); c.closePath();
    c.fillStyle = flash ? "#ffffff" : ZC.tongue; c.fill(); c.lineWidth = 1.3; c.stroke(); c.restore();
  } else if (mode === "broken") {   // a zigzag of gritted teeth, two green sweat drops
    c.beginPath(); c.roundRect(mx - 8, my - 4, 16, 7, 2); c.fillStyle = flash ? "#ffffff" : "#eef6e8"; c.fill(); c.lineWidth = 1.6; c.stroke();
    c.lineWidth = 1.1; c.beginPath(); c.moveTo(mx - 8, my - 0.5); for (let q = 1; q <= 8; q++) c.lineTo(mx - 8 + q * 2, my - 0.5 + (q % 2 ? -2 : 2)); c.stroke();
    for (const [dx, dy, ph] of [[Z_FX + 32, ey - 4, 0], [Z_FX - 30, ey - 12, 0.5]]) {
      const q = (tk / 70 + ph) % 1, yy = dy + q * 10;
      c.globalAlpha = q < 0.85 ? 1 : (1 - q) / 0.15;
      c.beginPath(); c.moveTo(dx, yy - 5.5); c.quadraticCurveTo(dx + 4, yy + 1, dx, yy + 3); c.quadraticCurveTo(dx - 4, yy + 1, dx, yy - 5.5); c.closePath();
      c.fillStyle = ZC.green; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
      c.globalAlpha = 1;
    }
  } else if (mode === "rage") {   // a fixed snarl, two rows of tiny teeth
    c.beginPath(); c.ellipse(mx, my - 0.5, 10, 4.6, 0, 0, Z_TAU); c.fillStyle = dark; c.fill();
    if (!flash) {
      c.save(); c.clip(); c.fillStyle = "#eef6e8";
      for (let q = 0; q < 6; q++) { c.beginPath(); c.moveTo(mx - 9 + q * 3.2, my - 5); c.lineTo(mx - 7.4 + q * 3.2, my - 2); c.lineTo(mx - 5.8 + q * 3.2, my - 5); c.fill(); c.beginPath(); c.moveTo(mx - 9 + q * 3.2, my + 4); c.lineTo(mx - 7.4 + q * 3.2, my + 1); c.lineTo(mx - 5.8 + q * 3.2, my + 4); c.fill(); }
      c.restore();
    }
    c.lineWidth = 1.8; c.beginPath(); c.ellipse(mx, my - 0.5, 10, 4.6, 0, 0, Z_TAU); c.stroke();
  } else if (mode === "launch") {   // screaming
    c.beginPath(); c.ellipse(mx, my, 5.5, 6.5, 0, 0, Z_TAU); c.fillStyle = dark; c.fill(); c.lineWidth = 1.8; c.stroke();
  }
  // rage: the antennae are straight out and sparking (zAntennae); the brows are the antennae, so no brows here
}
function zPilot(c, Q, tk, flash) {
  const path = zPath(), G0 = zGrads(c), skin = flash ? "#ffffff" : Q.dim ? G0.b : G0.n, limb = flash ? "#ffffff" : Q.dim ? "#4a554c" : ZC.stalk;
  const bulbs = zAntennae(c, Q, tk, flash);
  // the body
  c.fillStyle = skin; c.fill(path);
  if (!flash) {
    c.fillStyle = ZC.freckle; for (const [x, y] of Z_FRECK) { c.beginPath(); c.arc(x, y, 1.5, 0, Z_TAU); c.fill(); }
    c.save(); c.clip(path); c.fillStyle = "rgba(157,255,90,0.12)"; c.beginPath(); c.ellipse(0, -46, 34, 12, 0, 0, Z_TAU); c.fill(); c.restore();   // the green light off the console
  }
  c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke(path);
  zFace(c, Q, tk, flash, Q.dim ? "#5c6a5c" : ZC.skin);
  // the arms and the hands on the glass (they slide down in a stagger)
  const sl = Q.slide * 20;
  for (const s of [-1, 1]) {
    const hx = s * 47, hy = -70 + sl, sx = s * 30, sy = -54;
    c.strokeStyle = OUT; c.lineWidth = 7; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(s * 42, -54 + sl * 0.3, hx, hy + 3); c.stroke();
    c.strokeStyle = limb; c.lineWidth = 4; c.stroke();
    zHand(c, hx, hy, s, limb, flash);
    if (Q.slide > 0.05 && !flash) { c.strokeStyle = "rgba(230,255,245,0.25)"; c.lineWidth = 6; c.beginPath(); c.moveTo(hx, -70); c.lineTo(hx, hy - 4); c.stroke(); }   // the smear on the glass
  }
  // rage: sparks off the antennae
  if (Q.rage && !flash) for (const [x, y] of bulbs) if ((tk + x) % 5 < 2) { const a = tk * 1.9 + x; star4(c, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4.5, ZC.green); }
}
function zCollar(c, flash) {
  c.beginPath(); c.moveTo(-Z_DRX, Z_DY); c.ellipse(0, Z_DY, Z_DRX, 5, 0, Math.PI, 0, true); c.lineTo(Z_DRX, Z_DY + 6); c.ellipse(0, Z_DY + 6, Z_DRX, 5, 0, 0, Math.PI, false); c.closePath();
  c.fillStyle = flash ? "#ffffff" : ZC.collar; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  if (!flash) { c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, Z_DY + 1.5, Z_DRX - 3, 5, 0, 0.25, Math.PI - 0.25); c.stroke(); }
  c.fillStyle = OUT;
  for (const x of [-42, -14, 14, 42]) { c.beginPath(); c.arc(x, Z_DY + 3 + 5 * Math.sqrt(1 - (x / Z_DRX) * (x / Z_DRX)), 1.7, 0, Z_TAU); c.fill(); }
}
function zGlassArt(c, Q, tk, flash) {
  const pts = zGlassPts(Q.glass), full = Q.glass === "full";
  zPoly(c, pts, true);
  c.fillStyle = Q.fog > 0 ? `rgba(200,255,220,${(0.35 * Q.fog).toFixed(3)})` : "rgba(170,235,255,0.14)"; c.fill();
  if (flash) { c.fillStyle = "rgba(255,255,255,0.5)"; c.fill(); }
  // the outline: ink outside, the glass inside (open along the base when broken)
  zPoly(c, pts, false);
  c.lineWidth = 4.6; c.strokeStyle = OUT; c.stroke();
  c.lineWidth = 2.5; c.strokeStyle = "rgba(216,243,255,0.7)"; c.stroke();
  if (!flash) {
    // the highlight, top left
    c.strokeStyle = "rgba(230,255,245,0.45)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, Z_DY, Z_DRX * 0.84, Z_DRY * 0.86, 0, Math.PI * 1.13, Math.PI * 1.36); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, Z_DY, Z_DRX * 0.72, Z_DRY * 0.76, 0, Math.PI * 1.18, Math.PI * 1.24); c.stroke();
  }
  if (Q.crack && Q.glass !== "half") {   // the crack, collar to crown (it glows from inside in rage)
    const [main, br] = Z_CRACK;
    const crack = () => { c.beginPath(); c.moveTo(main[0][0], main[0][1]); for (let i = 1; i < main.length; i++) c.lineTo(main[i][0], main[i][1]); for (const [i, p] of br) { c.moveTo(main[i][0], main[i][1]); c.lineTo(p[0], p[1]); } };
    c.lineJoin = "miter";
    if (Q.rage && !flash) { crack(); c.strokeStyle = `rgba(157,255,90,${(0.35 + 0.15 * Math.sin(tk * 0.3)).toFixed(3)})`; c.lineWidth = 7; c.stroke(); }
    crack(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    crack(); c.strokeStyle = "rgba(230,250,255,0.55)"; c.lineWidth = 0.8; c.stroke();
    c.lineJoin = "round";
  }
  if (!full && !flash) {   // the broken edge catches the light
    c.strokeStyle = "rgba(230,250,255,0.6)"; c.lineWidth = 1;
    zPoly(c, pts.filter((p) => Math.hypot(p[0] / Z_DRX, (p[1] - Z_DY) / Z_DRY) < 0.97), false); c.stroke();
  }
}
// stagger: three little stars circling the dome
function zStars(c, tk) {
  for (let i = 0; i < 3; i++) {
    const a = tk * 0.12 + (i * Z_TAU) / 3, x = Math.cos(a) * 54, y = -128 + Math.sin(a) * 10, s = 6.5 + Math.sin(a) * 1.2;
    star4(c, x, y, s + 3, OUT); star4(c, x, y, s, "#d8ff7a"); star4(c, x, y, s * 0.4, "#ffffff");
  }
}
// the eye beam (phase 2): from his eyes to the sweeping box, forward (and back: eye2)
function zEyeBeam(c, Q, tk) {
  const k = Q.beam, lx = 60 + (380 - 60) * k, ly = -60 + 16 * k, ex = Z_FX + 4, ey = Z_EY + 4;
  for (const s of Q.both ? [1, -1] : [1]) {
    const tx = s * lx;
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,59,43,0.35)"; c.lineWidth = 22; c.beginPath(); c.moveTo(s * ex, ey); c.lineTo(tx, ly); c.stroke();
    c.strokeStyle = ZC.rage; c.lineWidth = 9; c.stroke();
    c.strokeStyle = "#ffe0e0"; c.lineWidth = 3.5; c.stroke();
    zGlow(c, tx, ly, 34, 1, "red");
    star4(c, tx, ly, 16 + Math.sin(tk * 1.3) * 3, "#ffe0e0");
  }
}

/* ---- draw: the fighter (or the KO page's puppet with `at`) ---- */
function zDraw(c, f, tk, at) {
  const x = at ? at[0] : f.x, y = at ? at[1] : f.y;
  const Q = zLook(f, tk), flash = f.flash > 0 && f.flash % 2 === 0;
  c.save();
  try {
    c.translate(x, y + Q.bob);
    c.lineCap = "round"; c.lineJoin = "round";
    // tilt (world frame: + dips his right side) and the launch-out's frisbee roll, about the saucer's middle
    if (Q.tilt || Q.roll) { c.translate(0, -30); c.rotate(Q.tilt + Q.roll); c.translate(0, 30); }
    c.scale(f.facing || 1, 1);
    zSaucer(c, Q, tk, flash, f.armorFlash || 0);
    // the cockpit: the pilot under the glass (clipped to the dome, so nothing pokes through)
    c.save();
    c.beginPath(); c.ellipse(0, Z_DY, Z_DRX - 1, Z_DRY + 1, 0, Math.PI, Z_TAU); c.ellipse(0, Z_DY, Z_DRX - 1, 5, 0, 0, Math.PI); c.closePath(); c.clip();
    c.fillStyle = "rgba(20,40,40,0.35)"; c.fillRect(-Z_DRX, Z_DY - Z_DRY - 2, Z_DRX * 2, Z_DRY + 8);   // the dark inside of the dome
    if (Q.duck) c.translate(0, Q.duck);
    zPilot(c, Q, tk, flash);
    c.restore();
    zCollar(c, flash);
    zGlassArt(c, Q, tk, flash);
    if (Q.stars) zStars(c, tk);
    if (Q.beam >= 0 && !flash) zEyeBeam(c, Q, tk);
  } finally { c.restore(); }
}

/* ---- his projectiles (world space): the laser, the probes, their pops, the thrown body's streak ---- */
function zProj(c, p, tk) {
  const z = p.z || p.style;
  if (z === "laser") { zLaser(c, p, tk); return true; }
  if (z === "probe") { zProbe(c, p, tk); return true; }
  if (p.style === "burst") { zBurst(c, p); return true; }
  if (z === "ride") { zRide(c, p); return true; }
  return false;
}
// where his dish is in the world (bob and tilt included), for beams drawn outside his own drawing
function zDish(f, tk) {
  const Q = zLook(f, tk), a = Q.tilt + Q.roll, py = -3 + 30;   // the dish at (0, -3), the pivot 30 above the underside
  return [f.x - Math.sin(a) * py, f.y + Q.bob - 30 + Math.cos(a) * py];
}
function zLaser(c, p, tk) {
  const o = RG && RG.fighters[p.owner], fy = STAGE.main.top, env = Math.min(1, p.t / 3);
  const sx = p.x, sy = fy - 3;
  // the scorch trail behind the spot
  const back = -(Math.sign(p.vx) || p.dir || 1);
  c.strokeStyle = "rgba(255,59,43,0.35)"; c.lineWidth = 6; c.lineCap = "round"; c.beginPath(); c.moveTo(sx, fy - 1); c.lineTo(sx + back * 70, fy - 1); c.stroke();
  c.strokeStyle = "rgba(255,200,170,0.55)"; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, fy - 1.5); c.lineTo(sx + back * 40, fy - 1.5); c.stroke();
  // the beam from the dish to the spot while he sweeps it (6 wide, a pale core); after the move the spot runs on alone
  if (o && o.state === "attack" && o.mid === "laser") {
    const [dx, dy] = zDish(o, tk), w = 6 * env * (0.85 + 0.15 * Math.sin(tk * 1.7));
    c.strokeStyle = "rgba(255,59,43,0.3)"; c.lineWidth = w * 3.4; c.beginPath(); c.moveTo(dx, dy); c.lineTo(sx, sy); c.stroke();
    c.strokeStyle = ZC.rage; c.lineWidth = w; c.stroke();
    c.strokeStyle = "#ffe0e0"; c.lineWidth = w * 0.4; c.stroke();
  }
  // the spot: a burning flare on the floor, as tall as the hitbox
  zGlow(c, sx, fy - 18, 44, 0.9 * env, "red");
  c.fillStyle = "rgba(255,90,60,0.55)"; c.beginPath(); c.moveTo(sx - 12, fy); c.quadraticCurveTo(sx - 6, fy - 26, sx, fy - 44 - Math.sin(tk * 0.9) * 4); c.quadraticCurveTo(sx + 6, fy - 26, sx + 12, fy); c.closePath(); c.fill();
  c.fillStyle = "#ffe0e0"; c.beginPath(); c.ellipse(sx, fy - 2, 14, 4.5, 0, 0, Z_TAU); c.fill();
  c.strokeStyle = ZC.rage; c.lineWidth = 2; c.stroke();
  star4(c, sx, fy - 6, 10 + Math.sin(tk * 1.4) * 2.5, "#fff2ee");
}
// a probe: a tin can with one red eye, an antenna and two stick legs (walking once it lands); it flashes red before it pops
function zProbe(c, p, tk) {
  const x = p.x, y = p.y, d = p.dir || (p.vx >= 0 ? 1 : -1), walking = !p.grav, left = p.life - p.t, warn = walking && left < 30;
  const bob = walking ? Math.abs(Math.sin(p.t * 0.5)) * 1.5 : 0, shake = warn ? Math.sin(p.t * 2.1) * 1.2 : 0;
  c.save(); c.translate(x + shake, y - bob);
  c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = OUT;
  // legs
  const ph = p.t * 0.5;
  c.lineWidth = 3.4;
  for (const s of [-1, 1]) {
    const fx_ = walking ? s * 4 + Math.sin(ph + (s > 0 ? Math.PI : 0)) * 4 : s * 5, fy_ = walking ? 14 + bob - Math.max(0, Math.cos(ph + (s > 0 ? Math.PI : 0))) * 3 : 15;
    c.beginPath(); c.moveTo(s * 4, 7); c.lineTo(fx_, fy_); c.stroke();
  }
  c.strokeStyle = "#7f8b93"; c.lineWidth = 1.6;
  for (const s of [-1, 1]) { const fx_ = walking ? s * 4 + Math.sin(ph + (s > 0 ? Math.PI : 0)) * 4 : s * 5, fy_ = walking ? 14 + bob - Math.max(0, Math.cos(ph + (s > 0 ? Math.PI : 0))) * 3 : 15; c.beginPath(); c.moveTo(s * 4, 7); c.lineTo(fx_, fy_); c.stroke(); }
  // the antenna, its light blinking (fast and red before the pop)
  const on = warn ? (p.t >> 1) & 1 : (p.t >> 3) & 1;
  c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3, -11); c.lineTo(-5, -19); c.stroke();
  if (on) zGlow(c, -5, -20, 8, 0.8, warn ? "red" : "green");
  c.fillStyle = on ? (warn ? ZC.rage : ZC.green) : "#3a5a2a"; c.beginPath(); c.arc(-5, -20, 2.4, 0, Z_TAU); c.fill(); c.lineWidth = 1.2; c.stroke();
  // the can
  c.fillStyle = warn && on ? mix(ZC.tin, ZC.rage, 0.45) : ZC.tin; c.lineWidth = 1.8;
  c.beginPath(); c.roundRect(-10, -11, 20, 19, 3); c.fill(); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(-7, -8, 3, 13);
  c.fillStyle = "rgba(17,16,28,0.25)"; c.fillRect(-10, -5, 20, 1.5); c.fillRect(-10, 3, 20, 1.5);
  c.fillStyle = "#9aa3ab"; c.beginPath(); c.ellipse(0, -11, 10, 2.6, 0, 0, Z_TAU); c.fill(); c.stroke();
  // the eye, on the side it walks to
  c.fillStyle = ZC.rage; c.beginPath(); c.arc(d * 4, -2, 4, 0, Z_TAU); c.fill(); c.lineWidth = 1.4; c.stroke();
  c.fillStyle = "#ffe0e0"; c.beginPath(); c.arc(d * 4 - 1.2, -3.2, 1.2, 0, Z_TAU); c.fill();
  c.restore();
}
function zBurst(c, p) {   // a probe pops: a green ring with spikes, 6 frames
  const k = p.t / Math.max(1, p.life), r = p.r * (0.45 + 0.55 * ease(Math.min(1, k * 1.4))), a = 1 - k;
  zGlow(c, p.x, p.y, r * 1.5, a, "green");
  c.globalAlpha = a; c.strokeStyle = mix("#f0ffe0", ZC.green, k); c.lineWidth = 6 * a + 1.5;
  c.beginPath(); c.arc(p.x, p.y, r, 0, Z_TAU); c.stroke();
  c.lineWidth = 3; c.beginPath();
  for (let i = 0; i < 9; i++) { const an = (i + 0.5) * (Z_TAU / 9); c.moveTo(p.x + Math.cos(an) * r * 0.5, p.y + Math.sin(an) * r * 0.5); c.lineTo(p.x + Math.cos(an) * r * 1.15, p.y + Math.sin(an) * r * 1.15); }
  c.stroke(); c.globalAlpha = 1;
}
function zRide(c, p) {   // the thrown body (Abduct, Hard and up): a green streak behind it, the hitbox the partner should dodge
  const d = Math.sign(p.vx) || 1, a = Math.min(1, (p.life - p.t) / 8);
  c.globalAlpha = a; c.lineCap = "round";
  c.strokeStyle = "rgba(157,255,90,0.35)"; c.lineWidth = 34; c.beginPath(); c.moveTo(p.x - d * 8, p.y); c.lineTo(p.x - d * 70, p.y + 6); c.stroke();
  c.strokeStyle = "rgba(220,255,200,0.6)"; c.lineWidth = 6; c.beginPath(); c.moveTo(p.x - d * 14, p.y - 8); c.lineTo(p.x - d * 80, p.y - 2); c.moveTo(p.x - d * 14, p.y + 9); c.lineTo(p.x - d * 64, p.y + 12); c.stroke();
  c.globalAlpha = 1;
}

/* ---- per game UI state: cues already played, rings and marks on the floor, crash bolts ---- */
const ZX = { g: null, tk: -1, cues: new Set(), rings: [], marks: [], bolts: [], beat: 0, hum: 0, buzz: 0 };
function zReset(g) { ZX.g = g; ZX.tk = -1; ZX.cues.clear(); ZX.rings.length = 0; ZX.marks.length = 0; ZX.bolts.length = 0; ZX.beat = 0; ZX.hum = 0; ZX.buzz = 0; }
function zCue(f, name) { const k = f.moveT + "." + f.mid + "." + name; if (ZX.cues.has(k)) return false; ZX.cues.add(k); if (ZX.cues.size > 400) ZX.cues.clear(); return true; }
const zW = (f, lx, ly) => [f.x + f.facing * lx, f.y + ly];

/* ---- floor: his tells on the floor (world space, after the stage, under the fighters) ---- */
function zFloor(c, g, f, tk) {
  if (ZX.g !== g) zReset(g);
  if (tk !== ZX.tk) { ZX.tk = tk; zTick(g, f, tk); }
  const S = STAGE.main, top = S.top;
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  // goo where probes popped (2 s)
  for (const m of ZX.marks) {
    const a = 1 - (tk - m.t) / 120;
    if (a <= 0) continue;
    c.fillStyle = `rgba(120,200,70,${(0.4 * a).toFixed(3)})`; c.beginPath(); c.ellipse(m.x, m.y + 0.5, 22, 4, 0, 0, Z_TAU); c.ellipse(m.x + 14, m.y + 0.5, 7, 2, 0, 0, Z_TAU); c.fill();
  }
  // rings on the floor: the crash landing (r 0 -> 130 in 10 frames, green), the thruster hop's landing (r 0 -> 110)
  for (const r of ZX.rings) {
    const age = tk - r.t;
    if (age > 18) continue;
    const k = Math.min(1, age / 10), rr = r.r * ease(k), a = age < 10 ? 1 : 1 - (age - 10) / 8;
    c.globalAlpha = a; c.strokeStyle = mix("#e8ffd0", r.crash ? ZC.dish : ZC.green, k); c.lineWidth = 7 * (1 - k) + 2.5;
    c.beginPath(); c.ellipse(r.x, r.y + 1, rr, rr * 0.22, 0, 0, Z_TAU); c.stroke();
    c.globalAlpha = a * 0.45; c.lineWidth = 3; c.beginPath(); c.arc(r.x, r.y, rr * 0.7, Math.PI, Z_TAU); c.stroke();
    c.globalAlpha = 1;
  }
  // the crash's bolts and shards (flying, then lying on the floor)
  for (const b of ZX.bolts) {
    c.save(); c.translate(b.x, b.y); c.rotate(b.rot);
    if (b.glass) { c.fillStyle = "rgba(216,243,255,0.8)"; c.beginPath(); c.moveTo(0, -5); c.lineTo(3.5, 3); c.lineTo(-3.5, 3); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(); }
    else { c.fillStyle = "#9aa3ab"; c.strokeStyle = OUT; c.lineWidth = 1.2; c.beginPath(); c.rect(-1.5, -5, 3, 8); c.fill(); c.stroke(); c.beginPath(); c.rect(-3.5, -6.5, 7, 3); c.fill(); c.stroke(); }
    c.restore();
  }
  if (f && f.state !== "gone" && f.state !== "dead") {
    const P = zPhase(f), d = f.facing || 1;
    // rage: a red ring under him
    if (zRage(f) && f.state !== "broken" && f.state !== "hitstun") {
      const pu = 1 + 0.05 * Math.sin(tk * 0.2);
      c.fillStyle = "rgba(255,60,40,0.24)"; c.beginPath(); c.ellipse(f.x, top + 1, 92 * pu, 14 * pu, 0, 0, Z_TAU); c.fill();
      c.strokeStyle = "rgba(255,90,50,0.55)"; c.lineWidth = 2; c.stroke();
    }
    // whoever he holds glows green
    if (g) for (const o of g.fighters) if (o.held === f.slot && o.state !== "dead" && o.state !== "gone") zGlow(c, o.x, o.y - o.s.h * 0.5, o.s.h * 0.95, 0.75, "green");
    if (P) {
      const { key, ph, mt, k } = P;
      if (key === "beam" && ph <= 1) {
        // the cone: dim and flickering until frame 24, then solid with a ring on the floor (rx 55); 50 wide at the dish, 110 at the floor
        const solid = ph === 1 || mt >= 24;
        if (solid || ((tk >> 1) & 1)) {
          const [dx, dy] = zDish(f, tk);
          c.fillStyle = solid ? "rgba(60,255,160,0.3)" : "rgba(60,255,160,0.18)";
          c.beginPath(); c.moveTo(dx - 25, dy); c.lineTo(dx + 25, dy); c.lineTo(f.x + 55, top); c.lineTo(f.x - 55, top); c.closePath(); c.fill();
          if (solid) {
            c.strokeStyle = "rgba(157,255,90,0.75)"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(dx - 25, dy); c.lineTo(f.x - 55, top); c.moveTo(dx + 25, dy); c.lineTo(f.x + 55, top); c.stroke();
            c.strokeStyle = "rgba(220,255,210,0.45)"; c.lineWidth = 2;   // rings running up the beam
            for (let i = 0; i < 3; i++) { const q = ((tk * 0.035 + i / 3) % 1), yy = top + (dy - top) * q, hw = 55 + (25 - 55) * q; c.beginPath(); c.ellipse((f.x + (dx - f.x) * q), yy, hw, 4 + 4 * (1 - q), 0, 0, Z_TAU); c.stroke(); }
            c.fillStyle = "rgba(157,255,90,0.3)"; c.beginPath(); c.ellipse(f.x, top + 1, 55, 10, 0, 0, Z_TAU); c.fill();
            c.strokeStyle = ZC.green; c.lineWidth = 3; c.stroke();
          }
        }
      }
      if (key === "laser" && ph === 0) {
        // red dots every 40 along the floor to the far wall, one per 2 frames; at frame 36 they join into a line
        const wall = d > 0 ? S.x2 : S.x1, n = Math.max(1, Math.floor(Math.abs(wall - f.x) / 40)), shown = Math.min(n, Math.floor(mt / 2) + 1);
        if (mt >= 36) {
          c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(f.x, top - 2); c.lineTo(wall, top - 2); c.stroke();
          c.strokeStyle = ZC.rage; c.lineWidth = 3.5; c.stroke();
        }
        for (let i = 0; i < shown; i++) {
          const x = f.x + d * i * 40;
          c.fillStyle = OUT; c.beginPath(); c.arc(x, top - 2, 5.6, 0, Z_TAU); c.fill();
          c.fillStyle = ZC.rage; c.beginPath(); c.arc(x, top - 2, 4, 0, Z_TAU); c.fill();
        }
      }
      if (key === "probe" && ph === 0) {   // a shadow on the floor under him: where they drop
        c.fillStyle = `rgba(0,0,0,${(0.3 * Math.min(1, k * 2)).toFixed(3)})`; c.beginPath(); c.ellipse(f.x, top + 1, 40, 8, 0, 0, Z_TAU); c.fill();
      }
      if (key === "abduct" && ph <= 1) {
        // the spotlight disc follows the target until frame 48, then goes solid; the column from the dish in the strike
        const solid = ph === 1 || mt >= 48, bx = f.bx;
        if (ph === 1) {
          const [dx, dy] = zDish(f, tk);
          c.fillStyle = "rgba(157,255,90,0.24)"; c.beginPath(); c.moveTo(dx - 15, dy); c.lineTo(dx + 15, dy); c.lineTo(bx + 35, top); c.lineTo(bx - 35, top); c.closePath(); c.fill();
          c.strokeStyle = "rgba(157,255,90,0.7)"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(dx - 15, dy); c.lineTo(bx - 35, top); c.moveTo(dx + 15, dy); c.lineTo(bx + 35, top); c.stroke();
        }
        const pu = solid ? 1 : 0.85 + 0.15 * Math.sin(tk * 0.4);
        c.fillStyle = solid ? "rgba(157,255,90,0.5)" : "rgba(157,255,90,0.35)"; c.beginPath(); c.ellipse(bx, top + 1, 40 * pu, 9 * pu, 0, 0, Z_TAU); c.fill();
        c.strokeStyle = solid ? ZC.green : "rgba(157,255,90,0.7)"; c.lineWidth = solid ? 3 : 2; c.stroke();
        if (!solid) { c.strokeStyle = "rgba(157,255,90,0.4)"; c.setLineDash([4, 6]); c.lineDashOffset = -tk * 0.8; c.beginPath(); c.ellipse(bx, top + 1, 52, 12, 0, 0, Z_TAU); c.stroke(); c.setLineDash([]); }
      }
      if (key === "crash" && mt < P.m.startup) {   // the shadow grows under him: the landing ring
        const q = mt / P.m.startup, rx = 40 + 70 * q;
        c.fillStyle = `rgba(0,0,0,${(0.18 + 0.2 * q).toFixed(3)})`; c.beginPath(); c.ellipse(f.x, top + 1, rx, rx * 0.2, 0, 0, Z_TAU); c.fill();
        c.strokeStyle = "rgba(157,255,90,0.55)"; c.lineWidth = 2.5; c.beginPath(); c.ellipse(f.x, top + 1, 110, 22, 0, 0, Z_TAU); c.stroke();
      }
      if (key === "hop" && ph === 0) {   // a green ring on the landing spot
        const tx = clamp(f.bx, -300, 300), pu = 0.9 + 0.1 * Math.sin(tk * 0.35);
        c.fillStyle = "rgba(157,255,90,0.22)"; c.beginPath(); c.ellipse(tx, top + 1, 60 * pu, 12 * pu, 0, 0, Z_TAU); c.fill();
        c.strokeStyle = "rgba(157,255,90,0.6)"; c.lineWidth = 3; c.stroke();
        c.lineWidth = 1.5; c.beginPath(); c.ellipse(tx, top + 1, 30, 6, 0, 0, Z_TAU); c.stroke();
      }
      if (key === "spin" && ph === 0) {   // a grey ring round him: two widths past the rim is safe
        c.fillStyle = "rgba(200,205,215,0.1)"; c.beginPath(); c.ellipse(f.x, top + 1, 120, 22, 0, 0, Z_TAU); c.fill();
        c.strokeStyle = "rgba(17,16,28,0.4)"; c.lineWidth = 3; c.stroke();
        c.strokeStyle = "rgba(220,225,235,0.5)"; c.lineWidth = 1.5; c.setLineDash([8, 6]); c.lineDashOffset = -tk; c.stroke(); c.setLineDash([]);
      }
      if (key === "eye" && ph === 0) {   // a thin red guide line on the floor to the wall he faces (both ways: eye2)
        const a = 0.35 + 0.65 * k;
        c.globalAlpha = a;
        for (const s of f.mid === "eye" ? [d] : [d, -d]) {
          const x0 = f.x + s * 60, x1 = s > 0 ? S.x2 : S.x1;
          c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, top - 2); c.lineTo(x1, top - 2); c.stroke();
          c.strokeStyle = ZC.rage; c.lineWidth = 2; c.setLineDash([10, 6]); c.lineDashOffset = -tk * s; c.stroke(); c.setLineDash([]);
        }
        c.globalAlpha = 1;
      }
    }
  }
  c.restore();
}

/* ---- once per UI tick: the cues of the move being played, his particles, the hover hum, the rage beat ---- */
function zTick(g, f, tk) {
  const live = bsLive(g), S = STAGE.main;
  for (let i = ZX.rings.length - 1; i >= 0; i--) if (tk - ZX.rings[i].t > 20) ZX.rings.splice(i, 1);
  for (let i = ZX.marks.length - 1; i >= 0; i--) if (tk - ZX.marks[i].t > 120) ZX.marks.splice(i, 1);
  for (let i = ZX.bolts.length - 1; i >= 0; i--) {   // fly, land on the floor, lie there a while
    const b = ZX.bolts[i];
    if (!b.rest) { b.x += b.vx; b.y += b.vy; b.vy += 0.4; b.rot += b.vr; if (b.y >= S.top - 2 && b.vy > 0 && b.x > S.x1 && b.x < S.x2) { b.y = S.top - 2; b.rest = true; } }
    if (++b.t > 200 || b.y > S.bottom + 300) ZX.bolts.splice(i, 1);
  }
  // the probes: a tick every 15 frames while any walk; the laser: a buzz while it runs, sparks off its spot
  let walk = 0, laser = null;
  for (const p of g.projs) {
    if (p.z === "probe" && !p.grav) walk++;
    if (p.z === "laser") { laser = p; if (tk % 2 === 0) addFx({ k: "line", x: p.x, y: S.top - 4, vx: (Math.random() - 0.5) * 5 - p.vx * 0.3, vy: -2 - Math.random() * 4, t: 0, life: 8 + Math.random() * 6, col: Math.random() < 0.5 ? "#ffe0e0" : ZC.rage, w: 2 }); }
  }
  if (live && walk && tk % 15 === 0) ZSND.tick();
  if (live && laser && ++ZX.buzz >= 6) { ZX.buzz = 0; ZSND.buzz(); }
  if (!f || f.state === "gone" || f.state === "dead") return;
  const P = zPhase(f), d = f.facing || 1, hover = zHovering(f), rage = zRage(f) && f.state !== "broken" && f.state !== "hitstun";
  // the hover: a hum (sines 90 + 135 Hz, about -34 dB), a steam puff every 40 ticks
  if (hover) {
    if (live && Sfx.ok() && Sfx.ctx.currentTime >= ZX.hum) { ZX.hum = Sfx.ctx.currentTime + 1; ZSND.hum(); }
    if (tk % 40 === 0) { const s = tk % 80 ? 1 : -1, p = [f.x + s * 78, f.y - 20]; addFx({ k: "puff", x: p[0], y: p[1], vx: s * 0.8, vy: -0.4, r: 5, t: 0, life: 30, col: "#e8f2f0", damp: 0.97 }); }
  }
  // held: green motes rise round whoever he holds; a throb while he holds them
  if (g.fighters.some((o) => o.held === f.slot)) {
    for (const o of g.fighters) if (o.held === f.slot && tk % 3 === 0) addFx({ k: "mote", x: o.x + (Math.random() - 0.5) * 40, y: o.y - Math.random() * o.s.h, vx: 0, vy: -1.4, col: ZC.green, r: 1.6, t: 0, life: 24, g: -0.02, damp: 0.97 });
    if (live && tk % 4 === 0) ZSND.throb();
  }
  if (P) {
    const { key, ph, mt, a0, a1 } = P;
    if (key === "beam") {
      if (ph === 0 && mt >= 24 && zCue(f, "solid")) { if (live) ZSND.solid(); }
      if (ph === 2 && f.bk === 0 && P.e < 14 && tk % 2 === 0) { const [dx, dy] = zDish(f, tk); addFx({ k: "line", x: dx + (Math.random() - 0.5) * 30, y: dy + 2, vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, t: 0, life: 8, col: ZC.dish, w: 2 }); if (zCue(f, "fizz") && live) ZSND.fizz(); }   // nobody: the dish fizzles
    } else if (key === "laser") {
      if (ph === 0 && mt >= 36 && zCue(f, "join")) { if (live) ZSND.join(); }
    } else if (key === "probe") {
      if (ph >= 1 && zCue(f, "boips")) { if (live) ZSND.boips(f.spec.boss.probeN[clamp(g.lv, 0, 2)]); }
    } else if (key === "abduct") {
      if (ph === 0 && mt < 48 && mt % 18 === 0 && live) ZSND.siren((mt / 18) & 1);
      if (ph === 0 && mt >= 48 && zCue(f, "lock")) { if (live) ZSND.lock(); }
    } else if (key === "bump") {
      if (ph === 0 && tk % 3 === 0) for (const x of [-50, 50]) addFx({ k: "puff", x: f.x + x, y: f.y + 8, vx: 0, vy: 1.2, r: 4, t: 0, life: 14, col: "#a8eaff" });
      if (ph === 1 && zCue(f, "roar")) { if (live) ZSND.roar(); }
      // the dome meets the rack on the way up: bonk
      const rack = STAGE.plats.find((q) => q.y < -200);
      if (rack && ph === 1 && f.y - 120 <= rack.y && f.x + 40 > rack.x1 && f.x - 40 < rack.x2 && zCue(f, "bonk")) {
        if (live) ZSND.bonk();
        addFx({ k: "star", x: f.x, y: rack.y + 4, t: 0, life: 8, s: 26 }); cam.shake = Math.max(cam.shake, 4);
      }
    } else if (key === "crash") {
      if (mt < P.m.startup && tk % 3 === 0) { const p = [f.x + (Math.random() - 0.5) * 100, f.y + 4]; addFx({ k: "puff", x: p[0], y: p[1], vx: (Math.random() - 0.5), vy: -1.2, r: 5 + Math.random() * 4, t: 0, life: 34, col: "#5a6066", damp: 0.97 }); }
      if (mt < P.m.startup && tk % 4 === 0) ember(f.x + (Math.random() - 0.5) * 140, f.y - 20, (Math.random() - 0.5) * 3, -1 - Math.random() * 2);
    } else if (key === "eye") {
      if (ph === 0) for (let i = 0; i < 3; i++) if (mt >= i * 10 && zCue(f, "tik" + i)) { if (live) ZSND.tik(); }
      if (ph === 1 && zCue(f, "zap")) { if (live) ZSND.zap(); cam.shake = Math.max(cam.shake, 3); }
      if (ph === 1) {   // sparks where the beam meets
        const k = P.k, lx = 60 + 320 * k, ly = -60 + 16 * k;
        for (const s of f.mid === "eye" ? [d] : [d, -d]) addFx({ k: "line", x: f.x + s * lx, y: f.y + ly, vx: (Math.random() - 0.5) * 6, vy: -1 - Math.random() * 4, t: 0, life: 8, col: Math.random() < 0.5 ? "#ffe0e0" : ZC.rage, w: 2.2 });
      }
    } else if (key === "toss") {
      if (ph >= 1 && zCue(f, "boings")) { if (live) ZSND.boings(rage ? 4 : 3); }
    } else if (key === "spin") {
      if (ph === 1) for (const q of [0, 6]) if (mt - a0 >= q && zCue(f, "shing" + q)) {
        if (live) ZSND.shing();
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) addFx({ k: "line", x: f.x + s * 104, y: f.y - 20, vx: s * (2 + Math.random() * 4), vy: (Math.random() - 0.5) * 4, t: 0, life: 9, col: i % 2 ? "#ffffff" : "#d8dce6", w: 2.4 });
      }
    } else if (key === "hop") {
      if (ph === 0 && f.grounded && mt % 12 === 6) for (const x of Z_THR) addFx({ k: "puff", x: f.x + x, y: f.y - 2, vx: (Math.random() - 0.5), vy: -0.6, r: 5, t: 0, life: 22, col: "#b8ff8a" });   // three green thruster puffs
      if (ph === 0 && !f.grounded && tk % 2 === 0) addFx({ k: "puff", x: f.x + (Math.random() - 0.5) * 100, y: f.y + 10, vx: 0, vy: 1.4, r: 4, t: 0, life: 14, col: "#c8ff9a" });
      if (ph >= 1 && mt >= a0 && zCue(f, "crunch")) {
        ZX.rings.push({ x: f.x, y: S.top, t: tk, r: 110 });
        dust(f.x - 60, f.y, 5, 40); dust(f.x + 60, f.y, 5, 40); cam.shake = Math.max(cam.shake, 7);
        if (live) ZSND.crunch();
      }
    }
  } else if (f.ph === 1 && f.state === "run") {
    // the scoot: sparks off the rim, a coughing exhaust; once every 10 s the dead dish sparks for 20 frames (the joke)
    if (tk % 3 === 0) addFx({ k: "line", x: f.x - d * 76, y: f.y - 6, vx: -d * (1 + Math.random() * 3), vy: -1 - Math.random() * 2, t: 0, life: 9, col: Math.random() < 0.5 ? "#fff2c2" : "#ffb347", w: 2 });
    if (tk % 24 === 0) { addFx({ k: "puff", x: f.x - d * 70, y: f.y - 24, vx: -d * 1.2, vy: -0.6, r: 5, t: 0, life: 30, col: "#4a4e52", damp: 0.97 }); if (live) ZSND.cough(); }
    if (tk % 600 < 20 && tk % 2 === 0) { addFx({ k: "line", x: f.x + (Math.random() - 0.5) * 30, y: f.y - 2, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 3, t: 0, life: 8, col: ZC.dish, w: 2 }); if (live && tk % 600 === 0) ZSND.fizz(); }
  }
  if (f.state === "stagger" && tk % 5 === 0) {   // stagger: the dome fogged, little green sparks off the rim
    addFx({ k: "mote", x: f.x + (Math.random() - 0.5) * 150, y: f.y - 20, vx: 0, vy: -0.8, col: ZC.stagLit, r: 1.4, t: 0, life: 22, g: -0.02, damp: 0.96 });
  }
  if (rage) {
    if (tk % 4 === 0) { const p = zW(f, (Math.random() - 0.5) * 120, -40 - Math.random() * 70); addFx({ k: "mote", x: p[0], y: p[1], vx: (Math.random() - 0.5) * 0.4, vy: -1.2, col: Math.random() < 0.6 ? ZC.green : ZC.rage, r: 1.5 + Math.random(), t: 0, life: 40, g: -0.02, damp: 0.97 }); }
    if (live && f.state !== "stagger" && ++ZX.beat >= 30) { ZX.beat = 0; ZSND.wub(); }
  }
  if ((f.state === "broken" || f.state === "fin") && tk % 6 === 0) {   // grey smoke off the crack
    const p = zW(f, 14 + (Math.random() - 0.5) * 20, -100);
    addFx({ k: "puff", x: p[0], y: p[1], vx: (Math.random() - 0.5) * 0.5, vy: -0.9 - Math.random() * 0.5, r: 5 + Math.random() * 3, t: 0, life: 42, col: "#50645a", damp: 0.98 });
  }
  if (f.state === "hitstun" && tk % 2 === 0) {   // launched out: shards trailing and a green exhaust spiral
    const a = tk * 0.6;
    addFx({ k: "mote", x: f.x + Math.cos(a) * 40, y: f.y - 40 + Math.sin(a) * 40, vx: -f.kbx * 0.2, vy: -f.kby * 0.2, col: ZC.green, r: 2, t: 0, life: 26, damp: 0.95 });
    if (tk % 4 === 0) addFx({ k: "shard", x: f.x, y: f.y - 70, vx: (Math.random() - 0.5) * 4 - f.kbx * 0.15, vy: (Math.random() - 0.5) * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, r: 3, col: "rgba(216,243,255,0.85)", t: 0, life: 30, g: 0.1, damp: 0.96 });
  }
}

/* ---- events: his moves, grabs, throws, the crash, staggers and fall (looks and sounds; sounds only while `live`) ---- */
function zEvent(g, e, live) {
  if (ZX.g !== g) zReset(g);
  const S = STAGE.main, zf = g.fighters.find((o) => o.spec.boss) || null, mine = (slot) => !!zf && slot === zf.slot;
  switch (e.type) {
    case "bossMove":
      if (!mine(e.slot)) return false;
      if (live) {
        if (e.mv === "beam") ZSND.beamHum();
        else if (e.mv === "laser") ZSND.whine();
        else if (e.mv === "probe") ZSND.clank();
        else if (e.mv === "spin") ZSND.spinUp();
        else if (e.mv === "toss") ZSND.clank();
      }
      return false;
    case "bossGrab": {
      if (!mine(e.slot)) return false;
      addFx({ k: "ring", x: e.x, y: e.y - 30, t: 0, life: 16, r0: 10, r1: 50, col: ZC.green });
      for (let i = 0; i < 6; i++) addFx({ k: "mote", x: e.x + (Math.random() - 0.5) * 40, y: e.y - Math.random() * 40, vx: 0, vy: -2, col: ZC.green, r: 2, t: 0, life: 22, damp: 0.95 });
      if (live) ZSND.shoomp();
      return false;
    }
    case "bossThrow": {
      if (!mine(e.slot)) return false;
      addFx({ k: "ring", x: e.x, y: e.y - 30, t: 0, life: 12, r0: 8, r1: 40, col: "#e8ffd0" });
      for (let i = 0; i < 5; i++) addFx({ k: "line", x: e.x, y: e.y - 30, vx: (e.dir || 1) * (3 + Math.random() * 5), vy: (Math.random() - 0.5) * 4, t: 0, life: 10, col: ZC.green, w: 2.5 });
      if (live) ZSND.fwip();
      return false;
    }
    case "bossCrash": {
      if (!mine(e.slot)) return false;
      // the crack: a green flash (never white), glass bits, three cracks, the siren dying
      addFx({ k: "ring", x: e.x, y: e.y - 90, t: 0, life: 12, r0: 20, r1: 110, col: ZC.green });
      addFx({ k: "ring", x: e.x, y: e.y - 90, t: 0, life: 6, r0: 50, r1: 70, col: "#e8ffd0" });
      for (let i = 0; i < 6; i++) addFx({ k: "shard", x: e.x + (Math.random() - 0.5) * 60, y: e.y - 100 + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, r: 3.4, col: "rgba(216,243,255,0.9)", t: 0, life: 30, g: 0.2, damp: 0.97 });
      cam.shake = Math.max(cam.shake, 5);
      if (live) ZSND.crack();
      return false;
    }
    case "bossCrashLand": {
      if (!mine(e.slot)) return false;
      ZX.rings.push({ x: e.x, y: S.top, t: tick, r: 130, crash: true });
      dust(e.x - 70, e.y, 7, 50); dust(e.x + 70, e.y, 7, 50); dust(e.x, e.y, 5, 60);
      for (let i = 0; i < 6; i++) ZX.bolts.push({ x: e.x + (Math.random() - 0.5) * 120, y: e.y - 20, vx: (Math.random() - 0.5) * 9, vy: -5 - Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, t: 0, glass: i % 3 === 2 });
      cam.shake = Math.max(cam.shake, 10);
      if (live) ZSND.land();
      return false;
    }
    case "bossHop": {
      if (!mine(e.slot)) return false;
      for (const x of Z_THR) { addFx({ k: "ring", x: e.x + x, y: e.y, t: 0, life: 12, r0: 4, r1: 22, col: ZC.green }); addFx({ k: "puff", x: e.x + x, y: e.y - 2, vx: (Math.random() - 0.5) * 2, vy: 0.4, r: 7, t: 0, life: 26, col: "#c8ff9a" }); }
      if (live) ZSND.roar();
      return false;
    }
    case "bossStagger": {
      if (!mine(e.slot)) return false;
      const p = zf ? [zf.x, zf.y - 90] : [e.x, e.y - 90];
      addFx({ k: "ring", x: p[0], y: p[1], t: 0, life: 18, r0: 20, r1: 120, col: "#d8ff7a" });
      addFx({ k: "star", x: p[0], y: p[1], t: 0, life: 9, s: 46 });
      cam.shake = Math.max(cam.shake, 6);
      if (live) ZSND.stagger();
      return false;
    }
    case "bossBroken": {
      if (!mine(e.slot)) return false;
      for (let i = 0; i < 10; i++) addFx({ k: "shard", x: e.x + 20 + (Math.random() - 0.5) * 60, y: e.y - 90 + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.3) * 6, vy: -2 - Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, r: 4, col: "rgba(216,243,255,0.9)", t: 0, life: 40, g: 0.22, damp: 0.97 });
      for (let i = 0; i < 10; i++) addFx({ k: "puff", x: e.x + (Math.random() - 0.5) * 120, y: e.y - 30 - Math.random() * 70, vx: (Math.random() - 0.5) * 1.5, vy: -0.6 - Math.random(), r: 6 + Math.random() * 6, t: 0, life: 50, col: "#50645a", damp: 0.97 });
      if (zf) dust(zf.x, S.top, 8, 90);
      cam.shake = Math.max(cam.shake, 9);
      if (live) ZSND.broken();
      return false;
    }
    case "probeLand":
      if (!mine(e.slot)) return false;
      dust(e.x, e.y, 2, 12);
      if (live) ZSND.tink();
      return false;
    case "laserTurn":
      if (!mine(e.slot)) return false;
      for (let i = 0; i < 8; i++) addFx({ k: "line", x: e.x, y: S.top - 10, vx: (Math.random() - 0.5) * 8, vy: -2 - Math.random() * 5, t: 0, life: 10, col: i % 2 ? "#ffe0e0" : ZC.rage, w: 2.4 });
      addFx({ k: "ring", x: e.x, y: S.top - 12, t: 0, life: 12, r0: 6, r1: 40, col: ZC.rage });
      if (live) ZSND.join();
      return false;
    case "projEnd":
      if (!mine(e.slot)) return false;
      if (e.style === "probe") { addFx({ k: "puff", x: e.x, y: e.y - 10, vx: 0, vy: -0.5, r: 7, t: 0, life: 24, col: "#b8ff8a" }); if (live) ZSND.fizz(); }
      else if (e.style === "laser") addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 12, r0: 6, r1: 36, col: ZC.rage });
      return true;
    case "burst": {
      if (!mine(e.slot)) return false;
      zPop(e.x, e.y, e.r, live);
      return true;
    }
    case "hit": {
      if (e.boss && zf && e.def === zf.slot) {
        if (e.down) {   // the final launch: glass everywhere, a green burst, the doppler siren
          addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 22, r0: 20, r1: 170, col: ZC.green });
          for (let i = 0; i < 16; i++) { const a = Math.random() * Z_TAU, sp = 3 + Math.random() * 7; addFx({ k: "shard", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, r: 3.6, col: i % 3 ? "rgba(216,243,255,0.9)" : ZC.green, t: 0, life: 36, g: 0.15, damp: 0.97 }); }
          cam.shake = Math.max(cam.shake, 14);
          if (live) ZSND.down();
        } else if (e.stag) {   // hit sparks turn gold-green while he is staggered
          addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 12, r0: 6, r1: 34 + e.dmg * 1.5, col: "#d8ff7a" });
          for (let i = 0; i < 7; i++) { const a = Math.random() * Z_TAU, sp = 3 + Math.random() * 5; addFx({ k: "line", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 9 + Math.random() * 6, col: i % 2 ? "#fff2c2" : "#d8ff7a", w: 2.6 }); }
        } else if (e.broken) addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 8, r0: 4, r1: 18, col: "#c9ced8" });
        else if (live && e.y < (zf.y - 50)) ZSND.glass();   // a hit on the dome: a glassy tink under the thud
      } else if (zf && e.slot === zf.slot) {
        if (e.ps === "probe") zPop(e.x, e.y, 30, live);   // touching a probe pops it
        else for (let i = 0; i < 5; i++) addFx({ k: "mote", x: e.x, y: e.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 3, col: e.ps === "laser" || e.mv === "eye" || e.mv === "eye2" ? ZC.rage : ZC.green, r: 1.8, t: 0, life: 20, damp: 0.93 });
      }
      return false;
    }
  }
  return false;
}
// a probe pops: a ring, tin bits, goo on the floor
function zPop(x, y, r, live) {
  addFx({ k: "ring", x, y, t: 0, life: 14, r0: 8, r1: r * 1.1, col: ZC.green });
  for (let i = 0; i < 5; i++) addFx({ k: "shard", x, y, vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, r: 3, col: i % 2 ? ZC.tin : "#7f8b93", t: 0, life: 26, g: 0.25, damp: 0.97 });
  const fy = STAGE.main.top;
  if (Math.abs(y - fy) < 60) { ZX.marks.push({ x, y: fy, t: tick }); if (ZX.marks.length > 10) ZX.marks.shift(); }
  cam.shake = Math.max(cam.shake, 3);
  if (live) ZSND.pop();
}

/* ---- his sounds (base.js Sfx helpers; quiet like the rest of the game) ---- */
const ZSND = {
  hum() {   // the hover: sines at 90 and 135 Hz, about -34 dB, laid as 1.5 s beds every second with soft fades
    if (!Sfx.ok()) return;
    const a = Sfx.ctx, t = a.currentTime, D = 1.5, g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.5); g.gain.setValueAtTime(1, t + D - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + D);
    g.connect(Sfx.out);
    for (const fr of [90, 135]) { const o = a.createOscillator(), og = a.createGain(); o.frequency.value = fr; og.gain.value = 0.014; o.connect(og); og.connect(g); o.start(t); o.stop(t + D + 0.05); }
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, (D + 0.3) * 1000);
  },
  beamHum() { Sfx.tone(180, 420, 0.6, "sine", 0.08); Sfx.tone(181, 423, 0.6, "triangle", 0.03); },
  solid() { Sfx.tone(420, 460, 0.12, "sine", 0.06); },
  throb() { Sfx.tone(55, 55, 0.03, "sine", 0.3); },
  fwip() { Sfx.noiseF(0.04, 0.3, "highpass", 1500, 1600, 0.8); Sfx.noiseF(0.25, 0.16, "bandpass", 500, 1800, 0.8); },
  fizz() { Sfx.noiseF(0.12, 0.12, "highpass", 3000, 5000, 0.9); Sfx.tone(1200, 400, 0.1, "square", 0.015); },
  whine() { Sfx.tone(900, 2200, 0.7, "sine", 0.05); },
  join() { Sfx.tone(2200, 1800, 0.06, "square", 0.025); Sfx.noiseF(0.06, 0.12, "highpass", 3000, 3000, 0.8); },
  buzz() { Sfx.tone(110, 110, 0.1, "square", 0.022); Sfx.noiseF(0.08, 0.05, "highpass", 3000, 3200, 0.7); },
  clank() { Sfx.noise(0.06, 0.3, 800); Sfx.tone(320, 260, 0.05, "square", 0.03); },
  boips(n) { for (let i = 0; i < n; i++) Sfx.at(i * 0.07, 600, 300, 0.08, "sine", 0.1); },
  tick() { Sfx.tone(2400, 2400, 0.012, "square", 0.012); },
  tink() { Sfx.tone(1700, 1500, 0.04, "triangle", 0.04); },
  pop() { Sfx.noise(0.05, 0.3, 1500); Sfx.tone(200, 200, 0.08, "sine", 0.2); },
  siren(hi) { Sfx.tone(hi ? 900 : 600, hi ? 600 : 900, 0.3, "sine", 0.045); },
  lock() { Sfx.tone(1400, 1400, 0.03, "square", 0.03); Sfx.at(0.05, 1800, 1800, 0.04, "square", 0.03); },
  shoomp() { Sfx.tone(200, 800, 0.15, "sine", 0.14); },
  roar() { Sfx.noiseF(0.25, 0.26, "lowpass", 600, 300, 0.8); Sfx.tone(70, 55, 0.25, "sine", 0.2); },
  bonk() { Sfx.tone(300, 150, 0.14, "sine", 0.25); Sfx.noise(0.04, 0.15, 1200); },
  crack() { for (let i = 0; i < 3; i++) Sfx.later(i * 70, () => Sfx.noiseF(0.04, 0.42, "highpass", 2000, 2200, 0.7)); Sfx.tone(900, 200, 1, "sine", 0.06); },
  land() {
    Sfx.tone(90, 35, 0.4, "sine", 0.55); Sfx.noise(0.25, 0.3, 500);
    for (let i = 0; i < 4; i++) Sfx.later(120 + i * 80 + Math.random() * 40, () => { Sfx.tone(1400 - i * 120, 900 - i * 80, 0.16, "sine", 0.1); Sfx.noise(0.03, 0.12, 2000); });   // a clatter of pans
  },
  tik() { Sfx.tone(1800, 1800, 0.02, "sine", 0.07); },
  zap() { Sfx.tone(400, 90, 0.2, "sawtooth", 0.06); Sfx.noiseF(0.18, 0.2, "highpass", 4000, 4200, 0.8); },
  boings(n) { for (let i = 0; i < n; i++) Sfx.at(i * 0.09, 300, 700, 0.07, "sine", 0.1); },
  spinUp() { Sfx.tone(200, 800, 0.3, "sine", 0.07); Sfx.tone(203, 806, 0.3, "triangle", 0.03); },
  shing() { Sfx.noiseF(0.03, 0.35, "highpass", 5000, 5200, 0.8); Sfx.tone(2600, 2400, 0.08, "triangle", 0.03); },
  crunch() { Sfx.noise(0.1, 0.35, 300); Sfx.tone(70, 40, 0.22, "sine", 0.45); },
  cough() { Sfx.noise(0.07, 0.12, 400); },
  wub() { Sfx.tone(60, 60, 0.05, "sine", 0.5); },
  glass() { Sfx.tone(2400, 2200, 0.05, "triangle", 0.025); },
  stagger() { Sfx.tone(700, 350, 0.25, "triangle", 0.06); Sfx.later(120, () => Sfx.tone(560, 280, 0.25, "triangle", 0.05)); Sfx.later(240, () => Sfx.tone(450, 225, 0.25, "triangle", 0.04)); },
  broken() { Sfx.noiseF(0.3, 0.4, "highpass", 2500, 4000, 0.8); Sfx.tone(600, 60, 0.7, "sawtooth", 0.04); Sfx.noise(0.4, 0.18, 400); },
  down() { Sfx.tone(900, 300, 0.6, "sine", 0.08); Sfx.tone(70, 28, 0.6, "sine", 0.45); Sfx.noise(0.45, 0.3, 900); },
};

BOSS_ART.zorp = { draw: zDraw, proj: zProj, floor: zFloor, event: zEvent };
