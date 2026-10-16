/* ===== BLASTLINE CORE: simulation, fighter specs, bot (no DOM) ===== */
(function (root) {
"use strict";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
/* Online play runs the same simulation on every device, so the simulation only uses
   +, -, *, / and sqrt, which IEEE 754 makes identical in every browser. */
const dist = (x, y) => Math.sqrt(x * x + y * y);
const TRIG = new Map();
function trig(deg) {
  let v = TRIG.get(deg);
  if (v) return v;
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  const r = (a / 180) * 3.141592653589793;
  let sn = 0, cs = 0, ts = r, tc = 1;
  for (let n = 0; n < 14; n++) {
    sn += ts; cs += tc;
    ts = (-ts * r * r) / ((2 * n + 2) * (2 * n + 3));
    tc = (-tc * r * r) / ((2 * n + 1) * (2 * n + 2));
  }
  v = [cs, sn];
  TRIG.set(deg, v);
  return v;
}

/* Global feel constants. Knockback decays linearly in magnitude every frame. */
const TUNE = {
  kbScale: 1.1,
  kbDecay: 0.52,
  hitstunK: 1.45,
  tumbleKb: 9,
  hitGrav: 0.75,
  armorKb: 13,
  buffer: 7,
  // Light-attack strings: the third light hit in a row launches. "In a row" means the defender
  // had fewer than strGap free frames since its last hitstun (every escape needs 3).
  strGap: 20,
  strSafe: 30,
  strLaunchKb: 9.5,
  strLaunchAngle: 48,
  // Knockback steering: holding the stick when launched bends the launch angle by up to this many degrees.
  diMax: 15,
  // Breakfall: dodge pressed up to techWindow frames before a hitstun landing; one try per techLock frames.
  techWindow: 10,
  techLock: 30,
  suddenTime: 45 * 60,
  // Finish mode: a special that hits an opponent at finishPct or more (before its damage) uses the move's
  // fin numbers and freezes the game for finishStop frames.
  finishPct: 175,
  finishStop: 22,
  // Charge: a ground heavy still held chgHold frames before its hitbox waits there and charges, up to chgMax
  // frames; at full charge +chgDmg damage and +chgKb knockback.
  chgHold: 3,
  chgMax: 60,
  chgDmg: 0.25,
  chgKb: 0.2,
  // KO at the hit: a launch is played this many frames ahead against every escape before it counts as lethal.
  lookFrames: 360,
  // The link: the second light hit in a row stuns linkStun frames longer, and for linkWin frames after it lands that light's
  // end lag can be cancelled into a heavy, a special or a jump; a heavy or special started then skips linkFast wind-up frames.
  linkWin: 12,
  linkFast: 6,
  linkStun: 8,
  // Combo damage: hits from the 4th of a combo deal comboK4, from the 6th comboK6 (so combos can't loop damage forever).
  comboK4: 0.85,
  comboK6: 0.7,
  // The pop-up: a linked up light (the second light in a row, aimed up) lifts at least this hard, so jump + an air attack can follow.
  linkPop: 13,
  // Ultimates: the bar fills ultDealt per % dealt, ultTaken per % taken and ultHeart per heart lost, up to ultNeed[n] for the
  // n-th use (ultMax uses a match). Pressing ULTI with a full bar spends it and freezes the game for ultFreeze frames (the
  // super freeze, so the opponent always sees it coming). Every ulti's first hit comes 24 frames or more after the freeze.
  ultNeed: [100, 120],
  ultMax: 2,
  // (Jonny, 2026-10-14 16:37 UTC: the bar filled too fast; 0.6x of the first numbers 1 / 0.5 / 10)
  ultDealt: 0.6,
  ultTaken: 0.3,
  ultHeart: 6,
  ultFreeze: 30,
  ultKb: 1.75,     // every ulti hit's knockback, times (Jonny 2026-10-14 20:45 UTC: 75-80% stronger, they hardly ever KO'd)
  // 2v2 (a team game with no boss), the Catch: a fighter free to act that touches a teammate tumbling from a launch (catchAfter frames
  // or more into it, never the final one) ends that launch: hitstun over, every speed x catchSlow. The catcher waits catchCd frames
  // before the next one; both get catchUlt on the ulti bar. catchPad: px added around both boxes (a forgiving touch).
  catchAfter: 14,
  catchKb: 5,
  catchCd: 90,
  catchSlow: 0.5,
  catchUlt: 5,
  catchPad: 10,
};
const LIGHT = new Set(["jab", "side", "up", "down", "nair", "sair", "uair", "dair"]);

// Maps (Jonny, 2026-10-14): each map has its own fight layout; the blast zones are the same everywhere, so KO percents stay fair.
// main = the one flat floor (grabbable ledges at x1/x2), plats = soft drop-through platforms (inside main's x range).
// STAGE is the layout in use: useStage(g) points it at g.map's layout at every entry point (newGame, step, botInput), so the
// rest of the simulation (and the UI, after BL.useStage(G)) reads STAGE as before. g.map is fixed for a match.
const BLAST = { left: -760, right: 760, top: -650, bottom: 460 };
const MAPS = [
  { id: "moon", main: { x1: -330, x2: 330, top: 0, bottom: 64 },
    plats: [{ x1: -250, x2: -110, y: -125 }, { x1: 110, x2: 250, y: -125 }, { x1: -70, x2: 70, y: -245 }],
    blast: BLAST, spawns: [{ x: -170, f: 1 }, { x: 170, f: -1 }], respawnY: -330 },
  { id: "bay", main: { x1: -280, x2: 280, top: 0, bottom: 64 },
    plats: [{ x1: -160, x2: 160, y: -110 }, { x1: -55, x2: 55, y: -250 }],
    blast: BLAST, spawns: [{ x: -150, f: 1 }, { x: 150, f: -1 }], respawnY: -330 },
  { id: "castle", main: { x1: -380, x2: 380, top: 0, bottom: 64 },
    plats: [{ x1: -340, x2: -200, y: -165 }, { x1: 200, x2: 340, y: -165 }],
    blast: BLAST, spawns: [{ x: -200, f: 1 }, { x: 200, f: -1 }], respawnY: -330 },
  { id: "fryer", main: { x1: -320, x2: 320, top: 0, bottom: 64 },
    plats: [{ x1: -250, x2: -130, y: -105 }, { x1: 130, x2: 250, y: -105 }, { x1: -190, x2: -80, y: -225 }, { x1: 80, x2: 190, y: -225 }],
    blast: BLAST, spawns: [{ x: -170, f: 1 }, { x: 170, f: -1 }], respawnY: -330 },
  // The Field (Old Scratch's arena; in the Practice map picker, not in the random draw): the widest floor, two low side platforms, no top platform
  { id: "field", pool: false, main: { x1: -400, x2: 400, top: 0, bottom: 64 },
    plats: [{ x1: -330, x2: -190, y: -125 }, { x1: 190, x2: 330, y: -125 }],
    blast: BLAST, spawns: [{ x: -200, f: 1 }, { x: 200, f: -1 }], respawnY: -330 },
  // The Kitchen (Zorp's arena, Fable's design /mnt/project-files/bosses2/fable-design.md section 3): the counters at -120 reach his
  // hovering saucer, the pot rack over the middle is the perch his Dome Bump punishes
  { id: "kitchen", pool: false, main: { x1: -360, x2: 360, top: 0, bottom: 64 },
    plats: [{ x1: -300, x2: -170, y: -120 }, { x1: 170, x2: 300, y: -120 }, { x1: -70, x2: 70, y: -250 }],
    blast: BLAST, spawns: [{ x: -200, f: 1 }, { x: 200, f: -1 }], respawnY: -330 },
  // The Deep (Kraken Spud's arena, section 4): a long jetty, harbour end left, open sea right where his head waits; crates and lobster pots
  { id: "deep", pool: false, main: { x1: -360, x2: 360, top: 0, bottom: 64 },
    plats: [{ x1: -290, x2: -170, y: -115 }, { x1: 170, x2: 290, y: -115 }],
    blast: BLAST, spawns: [{ x: -190, f: 1 }, { x: 190, f: -1 }], respawnY: -330 },
];
// the maps the random draw picks from (ranked, online, the daily, the cup, the tests' MAP=all): the first POOL; arena maps come after them.
// (The Field stays out: on its wide flat floor Dragon wins 42% and Phoenix 57% of bot games, against 44-58% everywhere else.)
const POOL = MAPS.filter((m) => m.pool !== false).length;
const STAGE = { id: "", map: 0, main: null, plats: null, blast: null, spawns: null, respawnY: 0 };
function useStage(g) {
  const i = g && MAPS[g.map] ? g.map : 0;
  if (STAGE.map === i && STAGE.main) return STAGE;
  const m = MAPS[i];
  Object.assign(STAGE, { id: m.id, map: i, main: m.main, plats: m.plats, blast: m.blast, spawns: m.spawns, respawnY: m.respawnY });
  return STAGE;
}
useStage(null);

/* Move constructor. Boxes are circles relative to the fighter's feet:
   [x, y, r] or a sweep [x, y, r, x2, y2]; x points forward, negative y is up.
   Angle is the launch angle in degrees (0 = away from attacker, 90 = up). */
function M(startup, active, endlag, dmg, bkb, kbg, angle, boxes, o) {
  const list = boxes.length && Array.isArray(boxes[0]) ? boxes : boxes.length ? [boxes] : [];
  return Object.assign(
    {
      startup, active, endlag, dmg, bkb, kbg, angle,
      boxes: list.map((b) => ({ x: b[0], y: b[1], r: b[2], x2: b[3] ?? b[0], y2: b[4] ?? b[1] })),
    },
    o || {}
  );
}
const AIR_MOVES = ["nair", "sair", "uair", "dair", "hAir", "rec", "pound"];

/* ---------- Fighter specs: pure data. The engine only reads these numbers. ---------- */
const FIGHTERS = [
  {
    id: "phoenix", name: "Phoenix", role: "Fire flyer",
    blurb: "Flame wings, three air jumps and a fireball. Rules the sky.",
    signature: { name: "Fireball", text: "Spits a fireball that flies far and slowly drops. 1.25 s cooldown." },
    ultimate: { name: "Solar Dive", text: "Flies out the top and comes back as a comet on the opponent's spot. The landing blast hits the floor: be in the air." },
    look: { build: "potato", costume: "phoenix", leg: 0.2, torso: 0.66, headR: 0.13, limbW: 5, face: "eager", wings: true },
    stats: { w: 44, h: 64, weight: 99, run: 6.1, accel: 1.15, airSpeed: 5.0, airAccel: 0.5, gravity: 0.48, fallSpeed: 8.8, fastFall: 13.5, jump: 12.4, airJump: 10.8, airJumps: 3 },
    palettes: [
      { name: "Ember", price: 0, body: "#f2c46b", trim: "#1f1d26", accent: "#ff6a2b", ui: "#ff7a3d" },
      { name: "Azure", price: 60, body: "#f0cf7a", trim: "#1f1d26", accent: "#3fa7ff", ui: "#56b4ff" },
      { name: "Verdant", price: 150, body: "#e9c070", trim: "#1f1d26", accent: "#47c96a", ui: "#5fd67f" },
      { name: "Solar", price: 300, body: "#f6d27a", trim: "#1f1d26", accent: "#ffc21f", ui: "#ffd23f" },
    ],
    moves: {
      jab:   M(3, 3, 8,   4, 4, 2, 38, [30, -36, 17], { limb: "arm" }),
      side:  M(6, 4, 13,  8, 4.5, 9, 32, [38, -28, 20], { limb: "leg" }),
      up:    M(6, 5, 12,  6, 5.5, 9, 86, [18, -72, 20, -16, -72], { limb: "arm" }),
      down:  M(5, 3, 11,  5, 4, 7, 15, [32, -8, 16], { limb: "leg" }),
      hSide: M(15, 6, 24, 14, 7, 20, 36, [32, -40, 20, 60, -36], { limb: "head", fire: true }),
      hUp:   M(12, 6, 22, 13, 7, 20, 87, [0, -80, 28], { limb: "arm" }),
      hDown: M(11, 4, 24, 11, 6.5, 16, 25, [[34, -10, 18], [-34, -10, 18]], { limb: "leg" }),
      nair:  M(5, 8, 10,  7, 4.5, 8, 50, [0, -34, 32], { limb: "body", landLag: 6 }),
      sair:  M(7, 4, 14,  9, 5.5, 12, 38, [36, -32, 20], { limb: "leg", landLag: 8 }),
      uair:  M(6, 5, 12,  8, 5.5, 12, 84, [16, -72, 22, -16, -72], { limb: "leg", landLag: 7 }),
      dair:  M(9, 5, 16,  9, 5, 10, -65, [2, -2, 18], { limb: "leg", landLag: 10 }),
      hAir:  M(13, 6, 20, 13, 6.5, 16, 40, [32, -40, 20, 58, -34], { limb: "head", fire: true, landLag: 14 }),
      rec:   M(6, 10, 10, 6, 5, 7, 80, [0, -40, 30], { limb: "body", rec: true, vyStart: -14.5, vxStick: 4, helpless: true, glide: true, landLag: 8 }),
      pound: M(9, 1, 18,  10, 6, 11, -78, [0, -6, 22], { limb: "leg", pound: true, vyStart: 16, landLag: 14 }),
      spec:  M(12, 1, 16, 0, 0, 0, 0, [], { limb: "head", kind: "projectile", cooldown: 75,
               proj: { style: "fire", speed: 8.5, life: 76, r: 15, ox: 36, oy: -40, grav: 0.03, dmg: 8, bkb: 5.5, kbg: 8, angle: 38,
                       fin: { dmg: 10, bkb: 10, kbg: 14, angle: 40 } } }),
      // Solar Dive: up and out of sight (intangible), the spot is picked at mt 15, a comet dive, the blast where it lands
      ulti:  M(60, 6, 34, 26, 6, 10, 82, [[0, -16, 40], [-52, -10, 24], [52, -10, 24]], { limb: "body", ult: "dive", inv: [1, 60], armor: [1, 60] }),
    },
  },
  {
    id: "alchemist", name: "Alchemist", role: "Potion zoner",
    blurb: "Hooded and grinning. Lobs toxic orbs and zaps anyone who gets close.",
    signature: { name: "Toxic Orb", text: "Lobs an orb in an arc. It bursts where it lands. 1.75 s cooldown." },
    ultimate: { name: "Mutagen Cloud", text: "Leaves a green cloud in front of him for 2.5 s. It stings every half second and the last pulse launches: leave the cloud." },
    look: { build: "potato", costume: "alchemist", leg: 0.2, torso: 0.66, headR: 0.13, limbW: 5, face: "evil" },
    stats: { w: 42, h: 62, weight: 95, run: 6.1, accel: 1.15, airSpeed: 4.9, airAccel: 0.5, gravity: 0.66, fallSpeed: 12, fastFall: 17, jump: 13.8, airJump: 12.4, airJumps: 2 },
    palettes: [
      { name: "Nightshade", price: 0, body: "#e3a64f", trim: "#1f1d26", accent: "#6b3fa0", ui: "#9b6bd6" },
      { name: "Crimson", price: 60, body: "#e3a64f", trim: "#1f1d26", accent: "#a3324a", ui: "#e0566e" },
      { name: "Midnight", price: 150, body: "#d99a48", trim: "#1f1d26", accent: "#2f4a8a", ui: "#5b82d6" },
      { name: "Bone", price: 300, body: "#e8b25c", trim: "#1f1d26", accent: "#d9d2c0", ui: "#e6dfcc" },
    ],
    moves: {
      jab:   M(3, 3, 9,   4, 4, 2, 40, [30, -30, 16], { limb: "arm" }),
      side:  M(6, 4, 14,  8, 4.5, 9, 32, [40, -26, 19], { limb: "arm" }),
      up:    M(5, 5, 12,  6, 5, 9, 86, [14, -66, 18, -12, -66], { limb: "arm" }),
      down:  M(5, 3, 11,  5, 4, 7, 18, [30, -6, 15], { limb: "leg" }),
      hSide: M(14, 6, 24, 14, 7, 18, 36, [44, -30, 25], { limb: "arm", zap: true }),
      hUp:   M(11, 6, 22, 13, 7, 18, 88, [0, -74, 26], { limb: "arm", zap: true }),
      hDown: M(10, 4, 24, 12, 6.5, 16, 25, [[32, -8, 18], [-32, -8, 18]], { limb: "leg" }),
      nair:  M(4, 7, 10,  7, 4.5, 8, 45, [0, -30, 30], { limb: "body", landLag: 6 }),
      sair:  M(6, 4, 14,  9, 5, 12, 40, [34, -30, 18], { limb: "arm", landLag: 8 }),
      uair:  M(5, 4, 12,  8, 5, 12, 82, [12, -64, 20, -12, -64], { limb: "arm", landLag: 7 }),
      dair:  M(9, 5, 16,  10, 5, 10, -70, [2, 0, 20], { limb: "body", landLag: 12 }),
      hAir:  M(12, 4, 20, 13, 6.5, 16, 38, [38, -30, 22], { limb: "arm", zap: true, landLag: 14 }),
      rec:   M(5, 12, 12, 5, 5, 7, 80, [0, -30, 26], { limb: "body", rec: true, vyStart: -15.5, vxStick: 5, helpless: true, landLag: 10 }),
      pound: M(8, 1, 18,  11, 6, 12, -80, [0, -4, 24], { limb: "leg", pound: true, vyStart: 18, landLag: 16 }),
      spec:  M(10, 1, 16, 0, 0, 0, 0, [], { limb: "arm", kind: "projectile", cooldown: 105,
               proj: { style: "orb", speed: 7, vy0: -3.5, life: 90, r: 15, ox: 26, oy: -40, grav: 0.3, dmg: 8, bkb: 5, kbg: 6, angle: 50,
                       fin: { dmg: 10, bkb: 10, kbg: 14, angle: 60 },
                       burst: { r: 46, life: 12, dmg: 8, bkb: 6, kbg: 8, angle: 70, fin: { dmg: 10, bkb: 10, kbg: 14, angle: 70 } } } }),
      // Mutagen Cloud: a still cloud that pulses every 30 frames; the fifth pulse launches
      ulti:  M(24, 1, 40, 0, 0, 0, 0, [], { limb: "arm", ult: "cloud", kind: "projectile", armor: [1, 24],
               proj: { style: "cloud", speed: 0, life: 151, r: 96, ox: 100, oy: -44, pulse: 30, ult: true, dmg: 3, bkb: 3, kbg: 1, angle: 20,
                       last: { dmg: 22, bkb: 8, kbg: 16, angle: 80 } } }),
    },
  },
  {
    id: "odin", name: "Odin", role: "Allfather",
    blurb: "Old, armored and very hard to launch. His raven does the scouting.",
    signature: { name: "Raven", text: "Sends his raven out and back. 2.5 s cooldown." },
    ultimate: { name: "Gungnir", text: "Throws his spear low across the stage; it flies back to his hand. Stand on a platform or jump it." },
    look: { build: "potato", costume: "odin", leg: 0.2, torso: 0.66, headR: 0.12, limbW: 7, face: "stern", fist: true },
    stats: { w: 50, h: 72, weight: 108, run: 5.2, accel: 1.0, airSpeed: 4.4, airAccel: 0.4, gravity: 0.74, fallSpeed: 13, fastFall: 18, jump: 14.8, airJump: 13, airJumps: 1 },
    palettes: [
      { name: "Allfather", price: 0, body: "#e6a95a", trim: "#1f1d26", accent: "#b3282d", ui: "#e0484e" },
      { name: "Frost", price: 60, body: "#e6b26a", trim: "#1f1d26", accent: "#3d7fbf", ui: "#5aa2e6" },
      { name: "Gold", price: 150, body: "#e0a050", trim: "#1f1d26", accent: "#d9a531", ui: "#f0c35a" },
      { name: "Shadow", price: 300, body: "#d9984a", trim: "#1f1d26", accent: "#4b4b5a", ui: "#9aa0b8" },
    ],
    moves: {
      jab:   M(5, 3, 12,  5, 4.5, 3, 40, [34, -42, 20], { limb: "arm" }),
      side:  M(8, 4, 16,  10, 5, 11, 32, [46, -36, 24], { limb: "arm" }),
      up:    M(8, 5, 18,  9, 6, 10, 86, [26, -84, 22, -20, -86], { limb: "arm" }),
      down:  M(7, 4, 16,  8, 4.5, 9, 18, [40, -10, 20], { limb: "leg" }),
      hSide: M(19, 5, 30, 20, 8, 20, 36, [52, -38, 28], { limb: "both", armor: [5, 19] }),
      hUp:   M(15, 6, 26, 17, 8, 20, 88, [30, -84, 28, -26, -86], { limb: "arm" }),
      hDown: M(14, 5, 28, 16, 7.5, 18, 28, [[42, -10, 22], [-42, -10, 22]], { limb: "both" }),
      nair:  M(6, 6, 14,  9, 5, 9, 45, [0, -38, 34], { limb: "body", landLag: 9 }),
      sair:  M(10, 4, 18, 13, 6, 14, 40, [42, -40, 22], { limb: "arm", landLag: 12 }),
      uair:  M(8, 5, 16,  12, 6, 13, 84, [18, -84, 24, -18, -84], { limb: "arm", landLag: 10 }),
      dair:  M(14, 4, 20, 14, 6, 12, -75, [6, -2, 24], { limb: "leg", landLag: 16 }),
      hAir:  M(16, 5, 24, 18, 7, 17, 38, [48, -40, 26], { limb: "both", landLag: 18 }),
      rec:   M(5, 12, 16, 9, 6.5, 9, 78, [18, -64, 26], { limb: "arm", rec: true, vyStart: -17, vxStick: 3.5, helpless: true, landLag: 12 }),
      pound: M(10, 1, 22, 14, 7, 14, -80, [0, -6, 28], { limb: "leg", pound: true, vyStart: 20, landLag: 22 }),
      spec:  M(12, 1, 18, 0, 0, 0, 0, [], { limb: "arm", kind: "projectile", cooldown: 150,
               proj: { style: "raven", boomer: true, speed: 9.5, life: 80, r: 16, ox: 24, oy: -60, dmg: 7, bkb: 5, kbg: 7, angle: 40,
                       fin: { dmg: 10, bkb: 10, kbg: 14, angle: 40 } } }),
      // Gungnir: a low spear that crosses the stage and comes back (a boomerang, like the raven)
      ulti:  M(26, 1, 40, 0, 0, 0, 0, [], { limb: "arm", ult: "spear", kind: "projectile", armor: [1, 26],
               proj: { style: "spear", boomer: true, speed: 22, life: 100, r: 22, ox: 30, oy: -30, ult: true, dmg: 28, bkb: 8, kbg: 16, angle: 40 } }),
    },
  },
  {
    id: "wizard", name: "Wizard", role: "Staff mage",
    blurb: "Calm, patient, long reach. The crystal on his staff does the talking.",
    signature: { name: "Crystal Bolt", text: "Fires a fast bolt from the staff. 1.1 s cooldown." },
    ultimate: { name: "Meteor Shower", text: "Calls five stars down around the opponent; each spot is marked before it lands. Read the marks and step out." },
    look: { build: "potato", costume: "wizard", leg: 0.2, torso: 0.68, headR: 0.13, limbW: 5, face: "kind" },
    stats: { w: 44, h: 68, weight: 104, run: 5.9, accel: 1.05, airSpeed: 4.7, airAccel: 0.44, gravity: 0.6, fallSpeed: 11, fastFall: 16, jump: 13.8, airJump: 12.4, airJumps: 2 },
    palettes: [
      { name: "Dusk", price: 0, body: "#f2b04e", trim: "#1f1d26", accent: "#3b3a52", ui: "#f2c14e" },
      { name: "Arcane", price: 60, body: "#f2b04e", trim: "#1f1d26", accent: "#5b3fa8", ui: "#a37cff" },
      { name: "Forest", price: 150, body: "#eba84a", trim: "#1f1d26", accent: "#2f6b45", ui: "#57c27e" },
      { name: "Crimson", price: 300, body: "#f0b85a", trim: "#1f1d26", accent: "#8a2b35", ui: "#e05a68" },
    ],
    moves: {
      jab:   M(4, 3, 10,  4, 4, 3, 40, [36, -38, 18], { limb: "arm" }),
      side:  M(7, 4, 14,  9, 5, 10, 32, [50, -32, 22], { limb: "arm" }),
      up:    M(7, 5, 15,  8, 6, 10, 86, [24, -86, 22, -20, -88], { limb: "arm" }),
      down:  M(6, 4, 13,  7, 4.5, 8, 18, [46, -6, 18], { limb: "arm" }),
      hSide: M(16, 6, 26, 16, 7.5, 20, 36, [44, -44, 22, 72, -40], { limb: "arm", magic: true }),
      hUp:   M(12, 6, 24, 15, 7.5, 19, 88, [26, -90, 26, -22, -92], { limb: "arm", magic: true }),
      hDown: M(13, 5, 26, 14, 7, 18, 28, [[46, -10, 22], [-46, -10, 22]], { limb: "body" }),
      nair:  M(5, 7, 12,  8, 4.5, 9, 45, [0, -34, 34], { limb: "body", landLag: 7 }),
      sair:  M(8, 4, 16,  10, 5.5, 13, 40, [46, -34, 20], { limb: "arm", landLag: 10 }),
      uair:  M(7, 5, 14,  10, 5.5, 12, 82, [20, -82, 22, -20, -82], { limb: "arm", landLag: 9 }),
      dair:  M(12, 4, 18, 12, 5.5, 11, -72, [6, 6, 22], { limb: "arm", landLag: 14 }),
      hAir:  M(14, 6, 22, 15, 6.5, 16, 38, [38, -44, 20, 66, -40], { limb: "arm", magic: true, landLag: 16 }),
      rec:   M(5, 14, 14, 6, 5, 7, 80, [0, -40, 28], { limb: "body", rec: true, vyStart: -15.5, vxStick: 4.5, multi: 6, helpless: true, landLag: 10 }),
      pound: M(10, 1, 20, 12, 6.5, 13, -80, [0, -6, 26], { limb: "leg", pound: true, vyStart: 19, landLag: 20 }),
      spec:  M(12, 1, 16, 0, 0, 0, 0, [], { limb: "arm", kind: "projectile", cooldown: 65,
               proj: { style: "bolt", speed: 12, life: 50, r: 13, ox: 46, oy: -52, dmg: 9, bkb: 5.5, kbg: 8, angle: 35,
                       fin: { dmg: 10, bkb: 10, kbg: 14, angle: 38 } } }),
      // Meteor Shower: five stars spawned at mt 6, 14, 22, 30, 38 around the opponent, falling 31 frames; the last one on the spot
      ulti:  M(40, 1, 30, 0, 0, 0, 0, [], { limb: "arm", ult: "stars", armor: [1, 40],
               star: { dmg: 6, bkb: 6, kbg: 8, angle: 80 }, big: { dmg: 16, bkb: 8, kbg: 16, angle: 80 } }),
    },
  },
  {
    id: "samurai", name: "Samurai", role: "Swordmaster",
    blurb: "Fast feet, long blade. Closes the gap in a blink.",
    signature: { name: "Quick Draw", text: "Dashes forward with a draw-cut. Works in the air. 2.6 s cooldown." },
    ultimate: { name: "Thousand Cuts", text: "An unseen dash through the opponent; the cut lands when the sword clicks back into its sheath. Jump the dash." },
    look: { build: "potato", costume: "samurai", leg: 0.2, torso: 0.66, headR: 0.13, limbW: 5, face: "focused" },
    stats: { w: 42, h: 64, weight: 91, run: 6.8, accel: 1.3, airSpeed: 5.5, airAccel: 0.55, gravity: 0.7, fallSpeed: 12, fastFall: 17, jump: 14.6, airJump: 13, airJumps: 2 },
    palettes: [
      { name: "Jade", price: 0, body: "#d9a660", trim: "#1f1d26", accent: "#2fd39a", ui: "#3fe0a8" },
      { name: "Steel", price: 60, body: "#d9a660", trim: "#1f1d26", accent: "#c9d3df", ui: "#d3dbe6" },
      { name: "Blood Moon", price: 150, body: "#d29a58", trim: "#1f1d26", accent: "#e0443a", ui: "#ef5a4f" },
      { name: "Violet", price: 300, body: "#dcac68", trim: "#1f1d26", accent: "#9b6bff", ui: "#b08aff" },
    ],
    moves: {
      jab:   M(3, 3, 8,   3, 4, 2, 40, [30, -36, 17], { limb: "arm" }),
      side:  M(6, 3, 13,  7, 4.5, 9, 32, [40, -32, 19], { limb: "arm" }),
      up:    M(5, 5, 12,  5, 5, 8, 88, [22, -70, 20, -18, -72], { limb: "arm" }),
      down:  M(5, 3, 10,  4, 4, 6, 18, [40, -8, 16], { limb: "arm" }),
      hSide: M(13, 4, 24, 15, 7, 20, 38, [46, -34, 23], { limb: "arm", impulse: [4, 0] }),
      hUp:   M(10, 6, 22, 13, 7, 18, 86, [32, -62, 22, -28, -64], { limb: "arm" }),
      hDown: M(10, 4, 24, 12, 6.5, 17, 25, [[42, -10, 20], [-42, -10, 20]], { limb: "body" }),
      nair:  M(4, 6, 10,  6, 4, 9, 45, [0, -32, 32], { limb: "body", landLag: 6 }),
      sair:  M(6, 3, 14,  8, 5, 12, 40, [42, -34, 20], { limb: "arm", landLag: 9 }),
      uair:  M(5, 4, 12,  7, 5, 12, 80, [18, -70, 22, -18, -70], { limb: "arm", landLag: 7 }),
      dair:  M(10, 4, 16, 9, 5, 10, -70, [6, 4, 20], { limb: "arm", landLag: 12 }),
      hAir:  M(12, 4, 20, 13, 6.5, 16, 36, [46, -36, 24], { limb: "arm", landLag: 14 }),
      rec:   M(4, 14, 12, 4, 5, 6, 80, [0, -36, 28], { limb: "body", rec: true, vyStart: -15.5, vxStick: 5, multi: 5, helpless: true, landLag: 10 }),
      pound: M(8, 1, 18,  10, 6, 12, -80, [0, -6, 22], { limb: "leg", pound: true, vyStart: 18, landLag: 16 }),
      spec:  M(9, 10, 20, 8, 6, 10, 30, [10, -32, 24], { limb: "arm", kind: "dash", speed: 15, cooldown: 155,
               fin: { dmg: 10, bkb: 10, kbg: 14, angle: 32 } }),
      // Thousand Cuts: an intangible dash; whoever it passes is held still, and the cut lands at the sheath click (mt 66)
      ulti:  M(23, 12, 45, 0, 0, 0, 0, [10, -32, 28], { limb: "arm", ult: "cuts", kind: "dash", speed: 22, mark: true, inv: [1, 70], cutAt: 66,
               cut: { dmg: 30, bkb: 8, kbg: 17, angle: 42 } }),
    },
  },
  {
    id: "dragon", name: "Dragon", role: "Fire breather",
    blurb: "Leathery wings, claws and a tail. Breathes fire up close and glides back to the stage.",
    signature: { name: "Flame Breath", text: "Breathes a short stream of fire that hits several times. 2.5 s cooldown." },
    ultimate: { name: "Hellfire", text: "Grows huge and breathes a fire stream across the stage that keeps burning, then blasts. Get above him." },
    look: { build: "potato", costume: "dragon", leg: 0.2, torso: 0.66, headR: 0.13, limbW: 6, face: "fierce", wings: true, fist: true },
    stats: { w: 46, h: 66, weight: 106, run: 5.7, accel: 1.08, airSpeed: 4.8, airAccel: 0.46, gravity: 0.6, fallSpeed: 11, fastFall: 16, jump: 13.6, airJump: 12.2, airJumps: 2 },
    palettes: [
      { name: "Drake", price: 0, body: "#eeaa58", trim: "#1f1d26", accent: "#e0893a", ui: "#f29a48" },
      { name: "Emerald", price: 60, body: "#eeaa58", trim: "#1f1d26", accent: "#3faa66", ui: "#55c47f" },
      { name: "Obsidian", price: 150, body: "#e6a250", trim: "#1f1d26", accent: "#4b3d6e", ui: "#8f7bd0" },
      { name: "Inferno", price: 300, body: "#f0b262", trim: "#1f1d26", accent: "#d63c2c", ui: "#f05a48" },
    ],
    moves: {
      jab:   M(4, 3, 10,  4, 4, 3, 40, [34, -36, 18], { limb: "arm" }),
      side:  M(7, 4, 14,  9, 5, 10, 32, [40, -30, 20], { limb: "arm" }),
      up:    M(6, 5, 13,  7, 5.5, 9, 86, [18, -76, 21, -16, -76], { limb: "arm" }),
      down:  M(5, 3, 12,  6, 4.5, 8, 15, [34, -8, 17], { limb: "leg" }),
      hSide: M(15, 5, 25, 15, 7.5, 19, 36, [36, -38, 22, 62, -34], { limb: "arm" }),
      hUp:   M(12, 6, 23, 14, 7.5, 19, 88, [0, -84, 28], { limb: "arm" }),
      hDown: M(12, 5, 25, 13, 7, 17, 25, [[36, -10, 19], [-36, -10, 19]], { limb: "body" }),
      nair:  M(5, 8, 11,  7, 4.5, 8, 50, [0, -34, 32], { limb: "body", landLag: 7 }),
      sair:  M(7, 4, 14,  9, 5.5, 12, 38, [38, -32, 20], { limb: "arm", landLag: 8 }),
      uair:  M(6, 5, 13,  8, 5.5, 12, 84, [16, -74, 22, -16, -74], { limb: "leg", landLag: 7 }),
      dair:  M(9, 5, 17,  9, 5, 10, -65, [2, -2, 18], { limb: "leg", landLag: 10 }),
      hAir:  M(13, 6, 21, 14, 6.5, 16, 38, [36, -40, 22, 60, -34], { limb: "arm", landLag: 15 }),
      rec:   M(6, 12, 12, 6, 5, 7, 80, [0, -40, 30], { limb: "body", rec: true, vyStart: -15, vxStick: 4.5, helpless: true, glide: true, landLag: 9 }),
      pound: M(9, 1, 19,  11, 6.5, 12, -78, [0, -6, 24], { limb: "leg", pound: true, vyStart: 17, landLag: 16 }),
      // a short stream of five small fire puffs from the mouth
      spec:  M(10, 17, 8, 0, 0, 0, 0, [], { limb: "head", kind: "projectile", cooldown: 150,
               proj: { style: "fire", speed: 6.5, life: 16, r: 12, ox: 30, oy: -38, count: 5, interval: 4, spreadVy: [-0.5, 0.3, -0.2, 0.5, 0], dmg: 2, bkb: 3.5, kbg: 3, angle: 35, short: true,
                       fin: { dmg: 10, bkb: 10, kbg: 14, angle: 42 } } }),
      // Hellfire: a long, low fire stream ticking every 7 frames; the last 6 frames blast
      ulti:  M(24, 42, 34, 4, 3, 1, 25, [[60, -50, 40], [130, -50, 44], [210, -50, 46], [290, -50, 46], [370, -50, 44]],
               { limb: "head", ult: "hellfire", fire: true, multi: 7, armor: [1, 24], last: { from: 61, dmg: 16, bkb: 8, kbg: 17, angle: 40 } }),
    },
  },
  {
    id: "gunslinger", name: "Gunslinger", role: "Sharpshooter",
    blurb: "Two pistols and a wide hat. Chips away from afar, then finishes up close.",
    signature: { name: "Twin Shot", text: "Fires two fast shots that barely push. 0.8 s cooldown." },
    ultimate: { name: "Dead Eye", text: "Six fanned shots, 8 frames apart; the sixth is golden and launches. Dodge between the shots." },
    look: { build: "potato", costume: "gunslinger", leg: 0.2, torso: 0.66, headR: 0.13, limbW: 5, face: "cocky" },
    stats: { w: 44, h: 64, weight: 93, run: 6.3, accel: 1.2, airSpeed: 5.0, airAccel: 0.5, gravity: 0.66, fallSpeed: 12, fastFall: 17, jump: 14.0, airJump: 12.6, airJumps: 2 },
    palettes: [
      { name: "Desert", price: 0, body: "#e8b066", trim: "#1f1d26", accent: "#c27a3a", ui: "#e8964a" },
      { name: "Outlaw", price: 60, body: "#e3aa60", trim: "#1f1d26", accent: "#3b3542", ui: "#a99cc4" },
      { name: "Sheriff", price: 150, body: "#ebb46a", trim: "#1f1d26", accent: "#e6dfcd", ui: "#8fc0ea" },
      { name: "Gold Rush", price: 300, body: "#efb866", trim: "#1f1d26", accent: "#d4a02c", ui: "#f2c94c" },
    ],
    moves: {
      // the lights are point-blank shots: a short tracer (the box sweeps out from the muzzle over the active frames)
      jab:   M(3, 3, 9,   3, 4, 2, 40, [24, -38, 10, 62, -38, 10], { limb: "arm", shot: true }),
      side:  M(6, 4, 13,  6, 4.5, 9, 32, [28, -36, 11, 80, -36, 11], { limb: "arm", shot: true }),
      up:    M(5, 5, 12,  6, 5, 8, 86, [12, -60, 11, 12, -112, 11], { limb: "arm", shot: true }),
      down:  M(5, 3, 11,  5, 4, 7, 18, [26, -10, 11, 70, -8, 11], { limb: "arm", shot: true }),
      // Fan the hammer: a point-blank blast that kicks him back in a small hop
      hSide: M(13, 4, 24, 15, 7, 20, 34, [36, -38, 21, 56, -36], { limb: "arm", impulse: [-5, -3] }),
      hUp:   M(11, 6, 22, 13, 7, 18, 88, [10, -88, 26], { limb: "arm" }),
      hDown: M(11, 4, 24, 12, 6.5, 16, 25, [[38, -10, 19], [-38, -10, 19]], { limb: "arm" }),
      nair:  M(4, 7, 10,  7, 4.5, 8, 45, [[22, -36, 11, 64, -36, 11], [-22, -36, 11, -64, -36, 11]], { limb: "body", shot: true, landLag: 6 }),
      sair:  M(6, 4, 14,  7, 5, 12, 40, [28, -36, 11, 78, -36, 11], { limb: "arm", shot: true, landLag: 8 }),
      uair:  M(5, 5, 12,  7, 5, 12, 82, [10, -60, 11, 10, -112, 11], { limb: "arm", shot: true, landLag: 7 }),
      dair:  M(9, 5, 16,  9, 5, 10, -65, [6, 2, 11, 6, 50, 11], { limb: "arm", shot: true, landLag: 11 }),
      hAir:  M(12, 4, 22, 13, 6.5, 16, 36, [36, -36, 21, 54, -34], { limb: "arm", impulse: [-3, -1], landLag: 15 }),
      // Powder jump: a shot fired down at his feet lifts him; the blast under him knocks down and away
      rec:   M(5, 6, 14, 5, 4.5, 4, -60, [0, 6, 24], { limb: "leg", rec: true, vyStart: -15.5, vxStick: 4.5, helpless: true, landLag: 10 }),
      pound: M(9, 1, 18,  10, 6, 11, -78, [0, -6, 22], { limb: "leg", pound: true, vyStart: 17, landLag: 15 }),
      // two quick weak shots; against a finish-ready opponent one golden bullet instead ("High Noon", see finCount)
      spec:  M(8, 9, 12, 0, 0, 0, 0, [], { limb: "arm", kind: "projectile", cooldown: 48,
               proj: { style: "bullet", speed: 15, life: 30, r: 8, ox: 34, oy: -38, count: 2, interval: 8, dmg: 4, bkb: 2.5, kbg: 1.5, angle: 20,
                       finCount: 1, finStyle: "gold", fin: { dmg: 10, bkb: 10, kbg: 14, angle: 30 } } }),
      // Dead Eye: six fanned shots, the sixth a golden bullet
      ulti:  M(24, 41, 30, 0, 0, 0, 0, [], { limb: "arm", ult: "deadeye", kind: "projectile", armor: [1, 24],
               proj: { style: "bullet", speed: 16, life: 40, r: 9, ox: 34, oy: -38, count: 6, interval: 8, spreadVy: [-1.2, 0.9, -0.5, 1.4, 0.2, 0], ult: true,
                       dmg: 4, bkb: 3, kbg: 2, angle: 20, lastShot: { style: "gold", dmg: 14, bkb: 8, kbg: 14, angle: 35 } } }),
    },
  },
  {
    id: "reaper", name: "Reaper", role: "Soul harvester",
    blurb: "Hood, sprouts and a farm scythe. Slow on his feet, long in the reach, and he hits behind him too.",
    signature: { name: "Harvest", text: "A sliding spin that tugs the opponent in towards him. 2.5 s cooldown." },
    ultimate: { name: "Soul Harvest", text: "Tugs the opponent in from across the stage, then one scythe sweep up. Hold away and jump." },
    look: { build: "potato", costume: "reaper", leg: 0.2, torso: 0.68, headR: 0.13, limbW: 5, face: "sly" },
    stats: { w: 46, h: 68, weight: 104, run: 5.6, accel: 1.0, airSpeed: 4.6, airAccel: 0.44, gravity: 0.56, fallSpeed: 9.5, fastFall: 15, jump: 14.2, airJump: 13.2, airJumps: 1 },
    palettes: [
      { name: "Shroud", price: 0, body: "#e2a95c", trim: "#1f1d26", accent: "#5d5a66", ui: "#a9a6b8" },
      { name: "Moss", price: 60, body: "#e2a95c", trim: "#1f1d26", accent: "#3f6b3a", ui: "#6fbf62" },
      { name: "Ember Wake", price: 150, body: "#dfa456", trim: "#1f1d26", accent: "#3a3440", ui: "#f08a3c" },
      { name: "Bone", price: 300, body: "#e8b466", trim: "#1f1d26", accent: "#e9e4d6", ui: "#f0ece0" },
    ],
    moves: {
      // handle pokes: the longest light thrust to the side
      jab:   M(4, 3, 10,  4, 4, 3, 40, [38, -36, 18], { limb: "arm" }),
      side:  M(6, 4, 15,  8, 5, 9, 32, [58, -32, 19], { limb: "arm" }),
      up:    M(7, 5, 15,  7, 5.5, 9, 86, [26, -84, 22, -22, -86], { limb: "arm" }),
      down:  M(6, 4, 14,  6, 4.5, 8, 18, [50, -6, 17], { limb: "arm" }),
      // Reap: the full scythe arc, in front and behind him
      hSide: M(14, 6, 28, 15, 7.5, 19, 36, [[40, -40, 23, 74, -30], [-46, -34, 21]], { limb: "arm", scythe: true }),
      // overhead arc, his anti-air: both sides
      hUp:   M(11, 7, 25, 14, 7.5, 19, 88, [36, -64, 24, -36, -64], { limb: "arm", scythe: true }),
      // grave sweep: in front and behind at once
      hDown: M(12, 5, 27, 14, 7, 18, 28, [[54, -10, 22], [-54, -10, 22]], { limb: "arm", scythe: true }),
      nair:  M(6, 8, 13,  8, 4.5, 9, 45, [0, -36, 38], { limb: "arm", landLag: 8 }),
      sair:  M(9, 4, 17,  10, 5.5, 13, 40, [52, -36, 22], { limb: "arm", landLag: 10 }),
      uair:  M(7, 5, 15,  9, 5.5, 12, 84, [22, -82, 24, -22, -82], { limb: "arm", landLag: 9 }),
      dair:  M(12, 4, 19, 11, 5.5, 10, -75, [6, 6, 22], { limb: "arm", landLag: 14 }),
      hAir:  M(15, 5, 24, 14, 6.5, 16, 38, [[42, -42, 23, 70, -34], [-40, -34, 20]], { limb: "arm", scythe: true, landLag: 17 }),
      // grave rise: a dark cloud lifts him, then he drifts down like the gliders
      rec:   M(6, 12, 14, 6, 5, 7, 80, [0, -40, 30], { limb: "body", rec: true, vyStart: -15, vxStick: 4.5, helpless: true, glide: true, landLag: 10 }),
      pound: M(10, 1, 20, 12, 6.5, 13, -80, [0, -6, 26], { limb: "arm", pound: true, vyStart: 18, landLag: 18 }),
      // Harvest: a slow sliding spin whose hit points back towards him (a tug); Last Rites hooks the finish-ready straight up
      spec:  M(12, 12, 22, 7, 5, 4, 160, [16, -34, 28], { limb: "arm", kind: "dash", speed: 8, cooldown: 150, scythe: true,
               fin: { dmg: 12, bkb: 12, kbg: 17, angle: 80 } }),
      // Soul Harvest: a tug from mt 4 to 23 (strong on the ground, weak in the air), then a sweep up on both sides
      ulti:  M(24, 7, 40, 30, 8, 16, 86, [[44, -44, 46], [-44, -44, 46]], { limb: "arm", ult: "harvest", scythe: true, armor: [1, 24], pull: [4, 23] }),
    },
  },
];
// the Road skins (Fable, bosses2/fable-design.md section 6): won from a boss (pal.road = his id), never bought; after the chip skins.
// One body / trim / ui per boss, the accent (the costume) per fighter. The simulation never reads a palette.
const ROAD_SKINS = [
  { name: "Devil's Roast", road: "scratch", body: "#8c4a30", trim: "#2a1512", ui: "#ff5a36",
    accent: { phoenix: "#ff3d1f", alchemist: "#4a1030", odin: "#8a1a1a", wizard: "#2a1020", samurai: "#c9262a", dragon: "#a01f1f", gunslinger: "#3a1a14", reaper: "#2a0e0c" }, lining: "#ff6a2b" },
  { name: "Specimen", road: "zorp", body: "#a9c0a0", trim: "#1f2a26", ui: "#9dff5a",
    accent: { phoenix: "#5aff9a", alchemist: "#2a6e5a", odin: "#9fb8c9", wizard: "#2f4f5a", samurai: "#6cf0c8", dragon: "#3fbf7a", gunslinger: "#7a9a8a", reaper: "#2d4a3e" }, lining: "#9dff5a" },
  { name: "Deep Catch", road: "kraken", body: "#b89a62", trim: "#1a2430", ui: "#3ef2c0",
    accent: { phoenix: "#ff7a8a", alchemist: "#3a2f6e", odin: "#4a7a8a", wizard: "#1e3a4a", samurai: "#1fa88a", dragon: "#5a8a9a", gunslinger: "#8a7a5a", reaper: "#22343a" }, lining: "#3ef2c0" },
];
for (const f of FIGHTERS) for (const r of ROAD_SKINS)
  f.palettes.push({ name: r.name, road: r.road, price: 0, body: r.body, trim: r.trim, accent: r.accent[f.id], ui: r.ui, lining: r.lining });
for (const f of FIGHTERS) for (const k of AIR_MOVES) { f.moves[k].air = true; if (f.moves[k].landLag == null) f.moves[k].landLag = 6; }
for (const f of FIGHTERS) for (const k of ["hSide", "hUp", "hDown"]) f.moves[k].charge = true;

/* ---------- Bosses (2v1): not in the roster. A boss is a fighter spec with a `boss` block; the engine gives him HP and
   poise instead of percent, keeps him on the main floor, and drives him with bossAct (his brain, on g.br, so every phone
   agrees). Lights never interrupt him; full poise staggers him (x stagK damage); at 0 HP he is "broken" and the next
   non-light hit sends him out (bossDown: the KO decided at the hit, like a final lethal launch). ---------- */
// Zorp's probes: they fall, walk walkT frames and pop (burst); touching a player pops one with the same numbers
const ZORP_PROBE = { r: 14, grav: 0.5, walkT: 120, life: 600, dmg: 9, bkb: 6, kbg: 14, angle: 80, burst: { r: 40, life: 6, dmg: 9, bkb: 6, kbg: 14, angle: 80 } };
const BOSSES = [
  {
    id: "scratch", name: "Old Scratch", role: "The Devil", map: "field",
    blurb: "A roasted red potato with horns, a pitchfork and a temper. Owns The Field.",
    look: { build: "boss", costume: "devil", scale: 2.5 },
    stats: { w: 100, h: 156, weight: 400, run: 2.6, accel: 0.35, airSpeed: 2, airAccel: 0.2, gravity: 0.75, fallSpeed: 14, fastFall: 14, jump: 10, airJump: 0, airJumps: 0 },
    palettes: [{ name: "Brimstone", price: 0, body: "#b8332a", trim: "#1f1d26", accent: "#ff8a2b", ui: "#ff4a36" }],
    // Per difficulty [Normal, Hard, Nightmare] (Fable's design): hp x lvHp; poise to fill for a stagger of stagger[lv] frames;
    // rage from rageAt[lv] % HP (stagger x rageStag, gaps x rageGap, fast wind-ups skip rageFast more); gap[lv] = idle frames between
    // moves (base + rng x span); fast moves skip lvFast[lv] of their wind-up; Horn Charge from chargeAt[lv] % HP; rainN[lv] fireballs;
    // the charge's fire burns trailLife[lv] frames. stagK = damage x while staggered, lightK = lights' damage x.
    // Tuned with tests/boss.js (two bots at 0.6: Normal 85% wins in ~66 s, Hard ~48%, Nightmare ~0; bots at 0.8 win Nightmare ~10%).
    boss: { fireHits: true, hp: 1150, lvHp: [1, 1.15, 1.45], poise: 40, stagger: [150, 135, 120], rageAt: [20, 25, 35], rageStag: 1.3, rageGap: 0.65, rageFast: 0.25,
            stagK: 1.5, lightK: 1, near: 120, gap: [[30, 30], [32, 30], [24, 24]], lvFast: [0, 0.08, 0.15], chargeAt: [50, 50, 100],
            rainN: [6, 7, 8], trailLife: [84, 84, 150], order: ["stab", "whip", "stomp", "rain", "charge"] },
    moves: {
      // Pitchfork Stab: the tines glow, then a long poke at waist height (jump it or step out)
      stab:   M(24, 6, 30, 14, 7, 17, 30, [70, -78, 26, 215, -74], { limb: "fork", boss: "stab", fast: true }),
      // Tail Whip: he turns his back, the tail sweeps out on both sides low (jump it)
      whip:   M(26, 8, 26, 12, 7, 17, 42, [[-60, -40, 40, -150, -36], [60, -40, 40, 150, -36]], { limb: "tail", boss: "whip", fast: true }),
      // Hellfire Stomp: a hop (shadow ring where he lands), a shockwave around him and two floor flames running out (jump them)
      stomp:  M(30, 4, 30, 13, 7, 16, 75, [[-70, -24, 46], [70, -24, 46], [0, -10, 60]], { limb: "body", boss: "stomp", hop: 10.5,
                flame: { dx: 70, vx: 6.5, r: 20, life: 56, dmg: 9, bkb: 6, kbg: 10, angle: 75 } }),
      // Brimstone Rain: he points up, six fireballs fall on spots marked on the floor (one on each player, one near, the rest anywhere)
      rain:   M(40, 1, 34, 0, 0, 0, 0, [], { limb: "fork", boss: "rain", fast: true,
                ball: { r: 26, vy: 15, life: 90, dmg: 11, bkb: 6.5, kbg: 13, angle: 85, burst: { r: 46, life: 6, dmg: 8, bkb: 6, kbg: 12, angle: 80 } } }),
      // Horn Charge (from half HP): he paws the ground, then runs to the far wall leaving fire (a platform or a double jump escapes)
      charge: M(40, 70, 40, 16, 8, 17, 35, [[50, -70, 44], [20, -40, 46]], { limb: "body", boss: "charge", fast: true, speed: 10.5,
                trail: { every: 6, r: 22, life: 84, pulse: 12, dmg: 5, bkb: 5.5, kbg: 6, angle: 75 } }),
    },
  },
  {
    id: "zorp", name: "Zorp", role: "The Alien", map: "kitchen",
    blurb: "A small green potato in a big saucer. Came for the kitchen, staying for samples. Owns The Kitchen.",
    look: { build: "boss", costume: "saucer", scale: 1 },
    stats: { w: 160, h: 120, weight: 400, run: 2.2, accel: 0.35, airSpeed: 2, airAccel: 0.2, gravity: 0.75, fallSpeed: 14, fastFall: 14, jump: 10, airJump: 0, airJumps: 0 },
    palettes: [{ name: "Specimen Jar", price: 0, body: "#a9c0a0", trim: "#1f2a26", accent: "#9dff5a", ui: "#9dff5a" }],
    // Fable's design (/mnt/project-files/bosses2/fable-design.md section 1). Old Scratch's block, plus: fly = his hover (floor at y -fly.y,
    // sinking to -fly.sink in a stagger, drifting fly.speed toward the target within x +-fly.range); at crashAt[lv] % HP the saucer
    // crashes (phase 2: f.ph 1, on the floor) and he lies dazed crashStag frames; probeN[lv] probes walking probeSpeed[lv]; the laser
    // turns laserBack[lv] times at the walls; the thrown player hits the partner from throwLv; swap: Eye Beam both ways from Hard or in rage.
    // Tuned with tests/boss.js: shorter gaps and more HP on Hard / Nightmare than Fable's numbers (the bots won Hard every time).
    boss: { hp: 1050, lvHp: [1, 1.4, 1.6], poise: 40, stagger: [150, 135, 120], rageAt: [20, 25, 35], rageStag: 1.3, rageGap: 0.65, rageFast: 0.25,
            stagK: 1.5, lightK: 1, near: 120, gap: [[22, 24], [24, 24], [18, 20]], lvFast: [0, 0.1, 0.18],
            fly: { y: 130, sink: 40, speed: 2.2, range: 200 }, crashAt: [55, 50, 45], crashStag: 90,
            probeN: [3, 4, 5], probeSpeed: [2.5, 2.5, 3.5], laserBack: [0, 1, 3], throwLv: 1, swap: { eye: "eye2" },
            order: ["beam", "laser", "probe", "abduct", "bump", "eye", "toss", "spin", "hop"] },
    moves: {
      // Tractor Beam: the dish glows, a beam straight down catches a player on the floor under him, lifts them while he drifts to
      // the nearer ledge and throws them out (jump: the air is never caught)
      beam:   M(36, 30, 30, 11, 7, 16, 30, [], { boss: "beam", fast: true, zone: 55, lift: 90, liftT: 20, drift: 3 }),
      // Laser Sweep: a laser runs along the floor to the far wall (Hard: and back; Nightmare: out and back twice)
      laser:  M(42, 80, 24, 0, 0, 0, 0, [], { boss: "laser", fast: true, shot: { r: 24, vx: 9, life: 600, dmg: 12, bkb: 7, kbg: 17, angle: 75 } }),
      // Probe Drop: three probes drop, walk (left, right, at the nearest player) and pop
      probe:  M(30, 1, 40, 0, 0, 0, 0, [], { boss: "probe", fast: true, probe: ZORP_PROBE }),
      // Abduct: a spotlight chases the target, stops, and whoever stands in it is pulled up and thrown at the partner
      abduct: M(60, 20, 40, 0, 0, 0, 0, [], { boss: "abduct", fast: true, col: 35, follow: [2.2, 48], pull: 100, pullT: 12,
                toss: { vx: 14, vy: -5, dmg: 12, stun: 36 }, body: { r: 28, life: 24, dmg: 8, bkb: 6, kbg: 8, angle: 70 } }),
      // Dome Bump: someone sits on the pot rack over him: the saucer jumps up into them
      bump:   M(30, 10, 30, 10, 6.5, 11, 85, [0, -116, 46], { boss: "bump", fast: true, rise: 11 }),
      // the crash (not picked: it starts at crashAt % HP): he falls 60 frames, lands with a ring, then lies dazed
      crash:  M(60, 6, 64, 10, 7, 10, 80, [0, -10, 120], { boss: "crash" }),
      // phase 2, on the floor: Eye Beam forward (eye2: both ways), Probe Toss, Saucer Spin (two hits), Thruster Hop
      eye:    M(32, 8, 34, 12, 7, 17, 40, [60, -60, 22, 380, -44], { boss: "eye", fast: true }),
      eye2:   M(32, 8, 34, 12, 7, 17, 40, [[60, -60, 22, 380, -44], [-60, -60, 22, -380, -44]], { boss: "eye", base: "eye", fast: true }),
      toss:   M(28, 1, 36, 0, 0, 0, 0, [], { boss: "toss", fast: true, probe: ZORP_PROBE }),
      spin:   M(28, 12, 30, 9, 6, 15, 45, [[-110, -20, 34], [110, -20, 34]], { boss: "spin", fast: true, multi: 6 }),
      hop:    M(36, 6, 40, 12, 7, 16, 80, [0, -20, 95], { boss: "hop", fast: true, hopT: 28, range: 300 }),
    },
  },
  {
    id: "kraken", name: "Kraken Spud", role: "The Sea Monster", map: "deep",
    blurb: "A purple potato the size of a boat, under the pier. The fish sent him. Owns The Deep.",
    look: { build: "boss", costume: "kraken", scale: 1 },
    // his box is the head lying on the deck (170 x 130); in the sea it can't be hit
    stats: { w: 170, h: 130, weight: 400, run: 0, accel: 0, airSpeed: 0, airAccel: 0, gravity: 0.75, fallSpeed: 14, fastFall: 14, jump: 0, airJump: 0, airJumps: 0 },
    palettes: [{ name: "Deep Purple", price: 0, body: "#6a3f8f", trim: "#3a1f55", accent: "#3ef2c0", ui: "#c77dff" }],
    // Fable's design section 2. Old Scratch's block, plus: sea = where his head waits past the right ledge (hidden: hide, he can only be
    // hit through a part on the deck, his head lying there, or while staggered / broken); slams come in pairs from pairAt[lv] % HP,
    // Chomp from chompAt[lv] %; a slammed tentacle stays stay[lv] frames (rage: rageStay[lv]); inkN[lv] blots for inkT[lv] frames (UI only);
    // the Wave pushes wavePush[lv] a frame and is waveH[lv] tall; sweepN[lv] sweeps (the second from the right ledge, 30 frames later).
    // Tuned with tests/boss.js: with Fable's numbers (950 HP, tentacles down 70 frames, Chomp from half HP) the bots could hit him
    // a third of the time and fights ran past four minutes; now 600 HP, slams in pairs and Chomp from the start, the tentacles stay
    // longer on Normal (the window) and shorter on the harder levels (the difficulty), shorter gaps (bots at 0.6: Normal ~100% in
    // ~96 s, Hard ~58%, Nightmare ~8%).
    boss: { hp: 600, lvHp: [1, 1, 1.2], poise: 32, stagger: [150, 135, 120], rageAt: [20, 25, 35], rageStag: 1.3, rageGap: 0.65, rageFast: 0.25,
            stagK: 1.5, lightK: 1, near: 0, gap: [[20, 24], [18, 20], [14, 16]], lvFast: [0, 0.15, 0.25],
            hide: true, sea: { x: 470, y: -20 }, pairAt: [100, 100, 100], chompAt: [100, 100, 100], stay: [110, 80, 70], rageStay: [80, 60, 55],
            inkN: [7, 9, 11], inkT: [132, 156, 180], wavePush: [4.5, 5.5, 6.5], waveH: [60, 60, 80], sweepN: [1, 1, 2],
            order: ["slam", "sweep", "ink", "wave", "chomp"] },
    moves: {
      // Tentacle Slam: a foam ring where the target stands, the tip slams there and the tentacle stays on the deck (hit it now);
      // in pairs (one per player, 30 frames apart) from pairAt
      slam:  M(36, 6, 82, 0, 0, 0, 0, [], { boss: "slam", fast: true, spot: true, tip: { r: 50, life: 6, dmg: 13, bkb: 7, kbg: 16, angle: 80 }, part: [30, 120], pairT: 30 }),
      // Low Sweep: a tentacle from the left ledge sweeps the deck to the right (Nightmare: a second one back from the right)
      sweep: M(40, 60, 20, 0, 0, 0, 0, [], { boss: "sweep", fast: true, shot: { r: 30, vx: 12, life: 600, dmg: 10, bkb: 6, kbg: 12, angle: 70 } }),
      // Ink Spray: blots over the screen (UI only); his next gap is halved
      ink:   M(48, 1, 40, 0, 0, 0, 0, [], { boss: "ink", fast: true, halfGap: true }),
      // Wave: a wall of water rolls from the right ledge to the left; pushes, 4% once, no knockback
      wave:  M(50, 90, 20, 0, 0, 0, 0, [], { boss: "wave", fast: true, half: 45, vx: 8, dmg: 4 }),
      // Chomp: the head lunges onto the deck where the target stood, the mouth catches one player (3 bites, spat up); then the head
      // lies on the deck (catch: 150 frames, miss: 90): the big window; 20 frames to slide back
      chomp: M(44, 12, 206, 0, 0, 0, 0, [], { boss: "chomp", fast: true, spot: true, lunge: 10, mouth: [55, 10, 100], bites: [12, 5], chew: 36, down: 150, miss: 90, slide: 20,
               spit: { dmg: 1, bkb: 9, kbg: 12, angle: 88 } }),
    },
  },
];

/* ---------- state ---------- */
const BTN = ["jump", "light", "heavy", "special", "dodge", "ulti"];
const blankInput = () => ({ x: 0, y: 0, jump: false, light: false, heavy: false, special: false, dodge: false, ulti: false });

function newFighter(spec, slot, pal, x, facing) {
  const s = spec.stats;
  return {
    spec, s, slot, pal,
    x, y: STAGE.main.top, vx: 0, vy: 0, kbx: 0, kby: 0, facing,
    grounded: true, plat: -1, state: "idle", st: 0,
    move: null, mid: null, mt: 0, hitLog: {}, poundT: 0,
    airJumps: s.airJumps, airDodged: false, ff: false, dropT: 0, downHold: 0,
    dodgeKind: null, dodgeDir: [0, 0], landT: 0,
    percent: 0, stocks: 3, invuln: 0, hitstun: 0, tumble: false,
    specCd: 0, recUsed: false, ledge: 0, ledgeCd: 0, ledgeInv: false,
    flash: 0, armorFlash: 0, dead: 0,
    inp: blankInput(), prevInp: blankInput(), buf: { jump: 0, light: 0, heavy: 0, special: 0, dodge: 0, ulti: 0 },
    kos: 0, dmgDealt: 0, falls: 0, sds: 0, lastHitBy: null, lastHitT: -9999,
    freeT: 99, strN: 0, strBy: -1, strMv: -1, strLaunched: false, combo: 0, comboDmg: 0, comboBy: -1, moveT: 0,
    techT: 0, techLock: 0, techDir: 0, chg: 0, doomed: false, finShot: false, link: 0, lk: false,
    ult: 0, ultN: 0, ultX: 0, ultTgt: -1,
    // teams (no friendly fire; 1v1: team = slot) and the boss's own state: hp/hpMax, poise, stag (stagger frames left),
    // bq (his last move), bt (idle frames before his next move), aim (the slot he goes after)
    team: slot, hp: 0, hpMax: 0, poise: 0, stag: 0, bq: "", bt: 0, aim: -1, lifePct: 0,
    // ph: the boss's phase (Zorp: 1 once his saucer has crashed; Kraken Spud: 1 while his head lies on the deck, hurtable);
    // held: the boss slot holding this fighter (-1 = free);
    // bx: the spot his move aims at (the target's x at its start; Abduct's spotlight), bk: his move's own counter
    ph: 0, held: -1, bx: 0, bk: 0,
    // catchCd: frames until this fighter can make its next Catch (2v2)
    catchCd: 0,
    anim: { run: 0 },
  };
}

// a team game without a boss: 2v2. Its own rules (respawn and spawn sides, time-out by team hearts, sudden death for four, the Catch)
// only run here, so 1v1 and the boss fights play exactly as before.
const teamGame = (g) => g.fighters.length > 2 && !g.fighters.some((f) => f.spec.boss);
// 2v2 spots: the k-th fighter of a team (slot order) on its side of the map, the first on the map's own spawn, the second further out
function teamSpot(team, k) {
  const sp = STAGE.spawns[team ? 1 : 0];
  return { x: k ? Math.round(sp.x * 1.55) : sp.x, f: sp.f };
}
// o: players [{spec, pal, team?}], seed, stocks, time (s, 0 = none), countdown, map, level (boss difficulty 0-2), hpMul (boss HP x).
// g.winner is the winning TEAM (1v1: team = slot). With a boss in the game: the boss is team 1, everyone else team 0.
function newGame(o) {
  const seed = o.seed ?? ((Math.random() * 1e9) | 0);
  const g = {
    t: 0, phase: "countdown", cd: o.countdown ?? 150, hitstop: 0, timer: (o.time ?? 240) * 60, timed: (o.time ?? 240) > 0, sudden: false,
    fighters: [], projs: [], events: [], winner: -1, endT: 0, endReason: "",
    rng: mulberry32(seed), stocks: o.stocks ?? 3,
    map: MAPS[o.map | 0] ? o.map | 0 : 0, lv: clamp(o.level | 0, 0, 2), br: (seed ^ 0x5bd1e995) | 0,
  };
  useStage(g);
  const bossGame = o.players.some((p) => p.spec.boss);
  const tm = o.players.map((p, i) => p.team ?? (bossGame ? (p.spec.boss ? 1 : 0) : i));
  o.players.forEach((p, i) => {
    // three or more on stage: each team lines up on its own side (team 0 left); 1v1 keeps the map's spawns; 2v2 uses teamSpot
    const k = tm.slice(0, i).filter((t) => t === tm[i]).length, S = STAGE.main;
    const sp = o.players.length <= 2 ? STAGE.spawns[i] : !bossGame ? teamSpot(tm[i], k)
      : tm[i] === 0 ? { x: Math.round(S.x1 * 0.575) + k * 90, f: 1 } : { x: Math.round(S.x2 * 0.5) - k * 90, f: -1 };
    const f = newFighter(p.spec, i, p.pal, sp.x, sp.f);
    f.team = tm[i];
    f.stocks = p.stocks || g.stocks;
    // handicaps (the Road's stops): p.pct = the percent the first life starts at, p.lifePct = the percent every life starts at
    if (p.lifePct) f.lifePct = p.lifePct;
    f.percent = p.pct || f.lifePct;
    if (p.spec.boss) {
      const B = p.spec.boss; f.stocks = 1; f.hp = f.hpMax = Math.round(B.hp * B.lvHp[g.lv] * (o.hpMul ?? 1));
      if (B.fly) { f.y = STAGE.main.top - B.fly.y; f.grounded = false; f.state = "air"; }
      if (B.sea) { f.x = B.sea.x; f.y = B.sea.y; f.facing = -1; f.grounded = false; f.state = "air"; }
    }
    g.fighters.push(f);
  });
  return g;
}

function setState(f, s) { f.state = s; f.st = 0; }
function endLaunch(f) { if (f.strLaunched) { f.strLaunched = false; f.invuln = Math.max(f.invuln, TUNE.strSafe); } }
function consume(f, k) { f.buf[k] = 0; }
function faceStick(f) { if (Math.abs(f.inp.x) > 0.3) f.facing = sign(f.inp.x); }
function dirOf(inp) {
  const ax = Math.abs(inp.x), ay = Math.abs(inp.y);
  if (ay > 0.5 && ay >= ax * 0.9) return inp.y < 0 ? "up" : "down";
  if (ax > 0.35) return "side";
  return "n";
}
function canAct(f) { return f.state === "idle" || f.state === "run" || f.state === "air"; }
function intangible(f) {
  if (f.invuln > 0 || f.doomed || f.held >= 0) return true;
  const s = f.state;
  if (s === "respawn" || s === "getup" || s === "dead" || s === "gone") return true;
  if (s === "attack" && f.move && f.move.inv && f.mt >= f.move.inv[0] && f.mt <= f.move.inv[1]) return true;
  if (s === "dodge") { const end = f.dodgeKind === "air" ? 20 : 16; return f.st >= 3 && f.st <= end; }
  return false;
}
function armored(f) {
  // no armour while a heavy waits charging (it would make a charging Odin unstoppable for over a second)
  if (f.chg > 0 && f.move && f.mt === f.move.startup - TUNE.chgHold) return false;
  return f.state === "attack" && f.move && f.move.armor && f.mt >= f.move.armor[0] && f.mt <= f.move.armor[1];
}
function hurt(f) { const hw = f.s.w / 2; return { x1: f.x - hw, x2: f.x + hw, y1: f.y - f.s.h, y2: f.y }; }
// where a fighter can be hit: its box. A boss can also be hit through his parts (his projectiles with a `part` box [half width, height]:
// a tentacle resting on the pier), and a hidden boss (boss.hide: Kraken Spud behind the pier) only while he is open (bossOpen).
function hurtsOf(g, f) {
  if (!f.spec.boss) return [hurt(f)];
  const out = f.spec.boss.hide && !bossOpen(f) ? [] : [hurt(f)];
  for (const p of g.projs) if (p.part && p.owner === f.slot && !p.done) out.push({ x1: p.x - p.part[0], x2: p.x + p.part[0], y1: p.y - p.part[1], y2: p.y });
  return out;
}
// where a bot aims at a boss: his feet, or the resting part nearest to `me` (ok = false: nothing of him can be hit right now)
function bossSpot(g, f, me) {
  const body = !(f.spec.boss.hide && !bossOpen(f));
  let x = f.x, y = f.y, best = body ? Math.abs(f.x - me.x) : 1e9;
  for (const p of g.projs) if (p.part && p.owner === f.slot && !p.done && Math.abs(p.x - me.x) < best) { best = Math.abs(p.x - me.x); x = p.x; y = p.y; }
  return { x, y, ok: best < 1e9 };
}
// (a staggered hidden boss: once his head has flopped onto the deck; ph 1: his head lies there after a Chomp)
const bossOpen = (f) => (f.state === "stagger" && (!f.spec.boss.hide || f.st >= 10)) || f.state === "broken" || f.doomed || (!!f.spec.boss.hide && f.ph === 1) ||
  (f.state === "attack" && !!f.move && !!f.move.open && f.mt >= f.move.open[0] && f.mt <= f.move.open[1]);
function circRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x1, b.x2), ny = clamp(cy, b.y1, b.y2);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/* ---------- main step ---------- */
function step(g, inputs) {
  if (g.phase === "over") return;
  useStage(g);
  const live = g.phase === "play";
  const frozen = g.hitstop > 0;
  // Inputs are read even during hitstop so presses made in the freeze are buffered, not lost.
  // a boss takes no input: his brain (bossAct) moves him
  g.fighters.forEach((f, i) => readInput(f, live && f.state !== "dead" && !f.spec.boss ? inputs[i] || blankInput() : blankInput(), frozen));
  if (frozen) { g.hitstop--; return; }
  if (g.phase === "countdown") {
    g.cd--;
    if (g.cd <= 0) { g.phase = "play"; g.events.push({ type: "go" }); }
  }
  if (g.phase === "end") {
    g.endT++;
    if (g.endT > 150) { g.phase = "over"; g.events.push({ type: "over" }); return; }
    if (g.endT % 2) return; // half-speed slow motion
  }
  g.t++;
  g.launches = [];
  for (const f of g.fighters) updateFighter(g, f);
  updateProjs(g);
  detectHits(g);
  if (live && teamGame(g)) catches(g);
  for (const f of g.fighters) checkBlast(g, f);
  if (live && !g.look) for (const L of g.launches) checkLethal(g, L);
  if (live && g.timed && g.phase === "play") { g.timer--; if (g.timer <= 0) endByTime(g); }
}

function readInput(f, inp, frozen) {
  f.prevInp = f.inp;
  f.inp = { x: clamp(inp.x || 0, -1, 1), y: clamp(inp.y || 0, -1, 1), jump: !!inp.jump, light: !!inp.light, heavy: !!inp.heavy, special: !!inp.special, dodge: !!inp.dodge, ulti: !!inp.ulti };
  for (const k of BTN) {
    if (f.inp[k] && !f.prevInp[k]) f.buf[k] = TUNE.buffer;
    else if (f.buf[k] > 0 && !frozen) f.buf[k]--;
  }
}

function updateFighter(g, f) {
  if (f.state === "gone") return;
  if (f.state === "dead") { if (--f.dead <= 0) respawn(g, f); return; }
  f.st++;
  f.freeT = f.state === "hitstun" ? 0 : f.freeT + 1;
  if (f.techT > 0) f.techT--;
  if (f.techLock > 0) f.techLock--;
  if (f.invuln > 0) f.invuln--;
  if (f.specCd > 0) f.specCd--;
  if (f.ledgeCd > 0) f.ledgeCd--;
  if (f.dropT > 0) f.dropT--;
  if (f.flash > 0) f.flash--;
  if (f.armorFlash > 0) f.armorFlash--;
  if (f.link > 0) f.link--;
  if (f.catchCd > 0) f.catchCd--;

  switch (f.state) {
    case "respawn": {
      const b = f.buf, i = f.inp;
      const anyIn = Math.abs(i.x) > 0.3 || i.y > 0.5 || b.jump || b.light || b.heavy || b.special || b.dodge;
      if (f.st > 150 || (f.st > 20 && anyIn)) { setState(f, "air"); f.invuln = 100; }
      return;
    }
    case "ledge": updateLedge(g, f); return;
    case "idle": case "run": case "air": if (f.spec.boss) bossAct(g, f); else actOrMove(g, f); break;
    case "stagger": f.vx *= 0.8; if (bossFlying(f)) bossHover(f, f.spec.boss.fly.sink); if (f.spec.boss && f.spec.boss.sea) bossFlop(f); if (--f.stag <= 0) { f.poise = 0; setState(f, "idle"); } break;
    case "broken": f.vx *= 0.8; if (f.spec.boss && f.spec.boss.sea) bossFlop(f); break;
    case "jumpsquat":
      f.vx *= 0.9;
      if (f.st >= 3) {
        const short = !f.inp.jump;
        f.vy = -(short ? f.s.jump * 0.72 : f.s.jump);
        f.vx = clamp(f.vx + f.inp.x * 1.2, -f.s.airSpeed * 1.15, f.s.airSpeed * 1.15);
        f.grounded = false; f.plat = -1;
        setState(f, "air");
        g.events.push({ type: "jump", x: f.x, y: f.y, ground: true, slot: f.slot });
      }
      break;
    case "attack": updateAttack(g, f); break;
    case "land": f.vx *= 0.8; if (f.st >= f.landT) setState(f, "idle"); break;
    case "getup": f.vx = 0; if (f.st >= 12) setState(f, "idle"); break;
    case "dodge": updateDodge(g, f); break;
    case "tech": updateTech(g, f); break;
    case "hitstun":
      // a dodge press while in hitstun is a breakfall attempt for the next landing
      if (f.buf.dodge && f.techLock <= 0) { consume(f, "dodge"); f.techT = TUNE.techWindow; f.techLock = TUNE.techLock; }
      f.hitstun--;
      if (f.grounded) f.vx *= 0.8; else { f.vx += f.inp.x * 0.08; f.vx *= 0.98; }
      if (f.hitstun <= 0) { setState(f, f.grounded ? "idle" : "air"); endLaunch(f); }
      break;
    case "helpless": airDrift(f, 0.6); break;
  }
  physics(g, f);
  if (!f.grounded && f.state !== "ledge") tryLedge(g, f);
}

function actOrMove(g, f) {
  const b = f.buf, dir = dirOf(f.inp);
  if (b.ulti) { consume(f, "ulti"); if (ultReady(g, f)) return startUlti(g, f); }
  if (f.grounded) {
    if (b.dodge) { consume(f, "dodge"); return startDodge(g, f); }
    if (b.jump) { consume(f, "jump"); f.tumble = false; return setState(f, "jumpsquat"); }
    if (heavyOrSpecial(g, f, dir)) return;
    if (b.light) {
      consume(f, "light");
      if (dir === "side") faceStick(f);
      return startMove(g, f, dir === "up" ? "up" : dir === "down" ? "down" : dir === "side" ? "side" : "jab");
    }
    groundMove(g, f);
  } else {
    if (f.state !== "air") setState(f, "air");
    if (b.dodge && !f.airDodged) { consume(f, "dodge"); return startDodge(g, f); }
    if (b.jump && f.airJumps > 0) { consume(f, "jump"); return airJump(g, f); }
    if (heavyOrSpecial(g, f, dir)) return;
    if (b.light) {
      consume(f, "light");
      if (dir === "side") faceStick(f);
      return startMove(g, f, dir === "up" ? "uair" : dir === "down" ? "dair" : dir === "side" ? "sair" : "nair");
    }
    airDrift(f, 1);
    fastFallCheck(f);
  }
}

/* ---------- Ultimates ---------- */
const ultNeed = (f) => (f.ultN < TUNE.ultMax ? TUNE.ultNeed[f.ultN] : 0);
function ultReady(g, f) { return g.phase === "play" && f.ultN < TUNE.ultMax && f.ult >= ultNeed(f); }
function ultGain(f, v) { if (f.ultN < TUNE.ultMax) f.ult = Math.min(ultNeed(f), f.ult + v); }
// the charge is spent on the press; the super freeze holds everyone (presses made in it are buffered, not lost)
function startUlti(g, f) {
  f.ult = 0; f.ultN++; f.ultTgt = -1; f.ultX = 0;
  faceStick(f);
  startMove(g, f, "ulti");
  g.hitstop = Math.max(g.hitstop, TUNE.ultFreeze);
  g.events.push({ type: "ulti", slot: f.slot, x: f.x, y: f.y, n: f.ultN, name: f.spec.ultimate.name, id: f.spec.id });
}
// the opponent an ulti aims at: the nearest one of the other team still on the stage (2v2), else the one still in the match
// (1v1 and boss fights have only one, so this is the old pick there)
function foe(g, f) {
  let best = null, bd = Infinity;
  for (const o of g.fighters) {
    if (o.team === f.team || o.state === "gone" || o.state === "dead") continue;
    const d = Math.abs(o.x - f.x);
    if (d < bd) { bd = d; best = o; }
  }
  return best || g.fighters.find((o) => o.team !== f.team && o.state !== "gone");
}
// what each ulti does beyond the plain move: runs after mt++ in updateAttack; true = it moved the fighter itself
function ultStep(g, f, m) {
  const S = STAGE.main, k = m.ult, mt = f.mt;
  if (k === "dive") {
    if (mt < 15) {
      // up and out of sight
      if (mt === 1) { f.grounded = false; f.plat = -1; }
      f.vx = 0; f.vy = -26;
      return true;
    }
    if (mt < 31) {
      // above the screen: the spot is picked at mt 15 (the opponent's x, kept on the stage), shown as a mark until the dive
      // the comet falls through platforms unless the opponent stood on one (ultTgt = that platform)
      if (mt === 15) { const o = foe(g, f); f.ultX = clamp(o ? o.x : 0, S.x1 + 40, S.x2 - 40); f.ultTgt = o && o.grounded ? o.plat : -1; g.events.push({ type: "ultMark", slot: f.slot, x: f.ultX }); }
      f.x = f.ultX; f.y = STAGE.blast.top + f.s.h + 70; f.vx = 0; f.vy = 0;
      return true;
    }
    if (mt < m.startup) {
      if (f.grounded) { f.mt = m.startup; f.vx = 0; g.events.push({ type: "ultLand", slot: f.slot, x: f.x, y: f.y }); return true; }
      f.vx = 0; f.vy = 30;
      if (f.ultTgt < 0) f.dropT = 2;
      // still falling at the end of the dive: wait here (a safety cap ends the move if nothing is ever landed on)
      if (mt === m.startup - 1) { if (f.poundT++ < 90) f.mt = m.startup - 2; }
      return true;
    }
    return false;
  }
  if (k === "stars") {
    // five stars, each 31 frames from spawn to the floor; four around the opponent's spot, the last on it
    const i = (mt - 6) / 8;
    if (i >= 0 && i < 5 && i === Math.floor(i)) {
      const o = foe(g, f), off = [-96, 96, -48, 48, 0][i];
      const x = clamp((o ? o.x : f.x) + off, S.x1 + 10, S.x2 - 10), hit = Object.assign({ fire: false, fin: null, ult: true }, i === 4 ? m.big : m.star);
      g.projs.push({ owner: f.slot, x, y: S.top - 558, dir: f.facing, vx: 0, vy: 18, grav: 0, boomer: false, style: i === 4 ? "bigstar" : "star", burst: null,
        speed: 0, r: i === 4 ? 30 : 24, life: 40, t: 0, pal: f.pal, pulse: 0, last: null, hit });
      g.events.push({ type: "proj", slot: f.slot, style: "star", x, y: S.top - 558 });
    }
    return false;
  }
  if (k === "cuts") {
    const t = f.ultTgt >= 0 ? g.fighters[f.ultTgt] : null;
    if (t && mt < m.cutAt) { t.vx = 0; t.vy = 0; t.kbx = 0; t.kby = 0; }
    if (mt === m.cutAt && t) {
      f.ultTgt = -1;
      if ((t.state === "hitstun" || t.spec.boss) && !t.doomed) applyHit(g, { att: f, def: t, hit: Object.assign({ ult: true }, m.cut), lx: 0, bx: t.x, by: t.y - t.s.h * 0.5 });
    }
    return false;
  }
  if (k === "harvest" && mt >= m.pull[0] && mt <= m.pull[1]) {
    // the tug: strong on the ground, weak in the air; it stops close to him
    for (const o of g.fighters) {
      if (o.team === f.team || o.spec.boss || intangible(o) || o.state === "ledge" || o.state === "dead" || o.state === "gone") continue;
      const dx = f.x - o.x, ad = Math.abs(dx);
      if (ad > 520 || ad < 56) continue;
      o.x += sign(dx) * Math.min(ad - 56, o.grounded ? 10 : 5);
    }
  }
  return false;
}
// Thousand Cuts: the dash passing someone holds them still until the cut (no damage yet)
function ultMark(g, att, def) {
  if (att.ultTgt >= 0) return;
  att.ultTgt = def.slot;
  def.move = null; def.mid = null; def.ledge = 0; def.link = 0;
  setState(def, "hitstun");
  def.hitstun = att.move.cutAt - att.mt + 6;
  def.vx = def.vy = def.kbx = def.kby = 0; def.tumble = false; def.flash = 6;
  def.lastHitBy = att; def.lastHitT = g.t;
  g.events.push({ type: "ultMark", slot: att.slot, def: def.slot, x: def.x, y: def.y });
}

// a buffered special or heavy starts here (also from a light's end lag while the link is open); true if one started
function heavyOrSpecial(g, f, dir) {
  const b = f.buf;
  if (b.special && f.specCd <= 0) { consume(f, "special"); faceStick(f); startMove(g, f, "spec"); return true; }
  if (!b.heavy) return false;
  if (f.grounded) {
    consume(f, "heavy");
    if (dir === "side") faceStick(f);
    startMove(g, f, dir === "up" ? "hUp" : dir === "down" ? "hDown" : "hSide");
    return true;
  }
  if (dir === "up") { if (f.recUsed) return false; consume(f, "heavy"); startMove(g, f, "rec"); return true; }
  consume(f, "heavy");
  if (dir === "side") faceStick(f);
  startMove(g, f, dir === "down" ? "pound" : "hAir");
  return true;
}

function groundMove(g, f) {
  const s = f.s, x = f.inp.x;
  if (Math.abs(x) > 0.25) {
    f.facing = sign(x);
    const target = x * s.run;
    f.vx += clamp(target - f.vx, -s.accel, s.accel);
    if (f.state !== "run") setState(f, "run");
    f.anim.run += Math.abs(f.vx) * 0.075;
  } else {
    f.vx *= 0.72;
    if (Math.abs(f.vx) < 0.1) f.vx = 0;
    if (f.state !== "idle") setState(f, "idle");
  }
  if (f.plat >= 0 && f.inp.y > 0.65) {
    if (++f.downHold >= 4) {
      f.grounded = false; f.dropT = 14; f.y += 1; f.downHold = 0;
      setState(f, "air");
    }
  } else f.downHold = 0;
}

function airDrift(f, mult) {
  const s = f.s, x = f.inp.x;
  if (Math.abs(x) > 0.2) {
    const cap = s.airSpeed;
    const nv = f.vx + s.airAccel * x * mult;
    if (Math.abs(nv) <= cap || Math.abs(nv) < Math.abs(f.vx)) f.vx = nv;
    else if (Math.abs(f.vx) < cap) f.vx = sign(nv) * cap;
  } else f.vx *= 0.97;
  if (Math.abs(f.vx) > s.airSpeed) f.vx *= 0.97;
}
function fastFallCheck(f) {
  if (!f.ff && f.vy > -2 && f.inp.y > 0.65 && f.prevInp.y <= 0.65) { f.ff = true; f.vy = Math.max(f.vy, f.s.fastFall); }
}
function airJump(g, f) {
  f.vy = -f.s.airJump;
  f.vx = f.inp.x * f.s.airSpeed;
  f.airJumps--; f.ff = false; f.tumble = false;
  setState(f, "air");
  g.events.push({ type: "jump", x: f.x, y: f.y, ground: false, slot: f.slot });
}

function startMove(g, f, key) {
  const m = f.spec.moves[key];
  setState(f, "attack");
  f.move = m; f.mid = key; f.mt = 0; f.hitLog = {}; f.poundT = 0; f.downHold = 0; f.tumble = false; f.moveT = g.t; f.chg = 0;
  if (key === "spec") f.specCd = m.cooldown || 0;
  // the link: started from (or soon after) the second light hit in a row, the wind-up skips its first linkFast frames
  // (a charging heavy still reaches the frame where it charges)
  f.lk = f.link > 0 && !LIGHT.has(key) && key !== "ulti";
  if (f.lk) { f.mt = Math.max(0, Math.min(TUNE.linkFast, m.startup - (m.charge ? TUNE.chgHold : 1))); f.link = 0; }
  // a projectile special with finCount fires only finCount shots, in finStyle, when it starts against a finish-ready opponent
  if (key === "spec") f.finShot = !!(m.proj && m.proj.finCount && g.fighters.some((o) => o.team !== f.team && o.percent >= TUNE.finishPct));
  if (m.rec) { f.recUsed = true; faceStick(f); f.ff = false; }
  if (m.pound) f.ff = false;
  g.events.push({ type: "swing", heavy: key[0] === "h" || key === "spec" || key === "pound" || key === "ulti", slot: f.slot, ult: key === "ulti" });
}

function updateAttack(g, f) {
  const m = f.move;
  // the link: the light that opened it can be cancelled into a heavy, a special or a jump
  if (f.link > 0 && LIGHT.has(f.mid)) {
    if (heavyOrSpecial(g, f, dirOf(f.inp))) return;
    if (f.buf.jump && (f.grounded || f.airJumps > 0)) {
      consume(f, "jump"); f.move = null; f.mid = null;
      if (f.grounded) { f.tumble = false; setState(f, "jumpsquat"); } else airJump(g, f);
      return;
    }
  }
  // a ground heavy still held at the end of its wind-up waits there and charges
  if (m.charge && f.grounded && f.mt === m.startup - TUNE.chgHold && f.inp.heavy && f.chg < TUNE.chgMax) {
    f.chg++; f.vx *= 0.82;
    if (f.chg === TUNE.chgMax) g.events.push({ type: "chargeMax", slot: f.slot });
    return;
  }
  f.mt++;
  const a0 = m.startup + 1, a1 = m.startup + m.active, total = m.startup + m.active + m.endlag;
  if (m.ult && ultStep(g, f, m)) return;
  if (m.boss && bossStep(g, f, m)) return;
  if (m.rec) {
    if (f.mt < m.startup) { f.vy = Math.min(f.vy, 0.5); f.vx *= 0.85; }
    else if (f.mt === m.startup) {
      f.vy = m.vyStart; f.vx = clamp(f.inp.x, -1, 1) * m.vxStick; f.grounded = false; f.plat = -1;
      g.events.push({ type: "jump", x: f.x, y: f.y, ground: false, slot: f.slot, rec: true });
    } else airDrift(f, 0.5);
  } else if (m.pound) {
    if (f.mt < m.startup) { f.vy = lerp(f.vy, -1, 0.5); f.vx *= 0.8; }
    else if (f.mt === m.startup) { f.vy = m.vyStart; f.vx *= 0.25; }
    if (f.mt > a1 && !f.grounded && f.poundT < 50) { f.mt = a1; f.poundT++; }
  } else if (m.kind === "dash") {
    if (f.mt < a0) { f.vx *= 0.6; if (!f.grounded) f.vy = Math.min(f.vy, 0) * 0.5; }
    else if (f.mt <= a1) { f.vx = f.facing * m.speed; if (!f.grounded) f.vy = 0; }
    else if (f.mt === a1 + 1) f.vx = f.facing * m.speed * 0.3;
    else if (f.grounded) f.vx *= 0.85;
  } else {
    if (m.impulse && f.mt === m.startup) { f.vx += m.impulse[0] * f.facing; f.vy += m.impulse[1]; }
    if (m.kind === "charge" && f.mt === m.startup) f.vx = f.facing * m.slide;
    if (m.kind === "projectile") {
      const pr = m.proj, iv = pr.interval || 1, k = f.mt - m.startup;
      if (k >= 0 && k % iv === 0 && k / iv < (f.finShot ? pr.finCount : pr.count || 1)) spawnProj(g, f, m, k / iv);
    }
    if (f.grounded) f.vx *= m.kind === "charge" && f.mt >= m.startup && f.mt <= a1 ? 0.95 : 0.82;
    else { airDrift(f, 0.85); fastFallCheck(f); }
  }
  if (f.mt >= total && f.state === "attack") {
    f.move = null; f.mid = null;
    if (f.grounded) setState(f, "idle");
    else setState(f, m.helpless ? "helpless" : "air");
  }
}

function updateTech(g, f) {
  if (f.techDir) {
    f.vx = f.st >= 2 && f.st <= 14 ? f.techDir * 6 : f.vx * 0.6;
    if (f.st >= 20) setState(f, "idle");
  } else {
    f.vx *= 0.5;
    if (f.st >= 12) setState(f, "idle");
  }
}
function startDodge(g, f) {
  const i = f.inp;
  setState(f, "dodge"); f.ff = false; f.tumble = false;
  if (f.grounded) {
    if (Math.abs(i.x) > 0.4) { f.dodgeKind = "roll"; f.dodgeDir = [sign(i.x), 0]; }
    else { f.dodgeKind = "spot"; f.dodgeDir = [0, 0]; }
  } else {
    f.airDodged = true; f.dodgeKind = "air";
    const mag = dist(i.x, i.y);
    if (mag > 0.4) { f.dodgeDir = [i.x / mag, i.y / mag]; f.vx = f.dodgeDir[0] * 9; f.vy = f.dodgeDir[1] * 9; }
    else { f.dodgeDir = [0, 0]; f.vy *= 0.3; }
  }
  g.events.push({ type: "dodge", slot: f.slot });
}
function updateDodge(g, f) {
  const k = f.dodgeKind;
  if (k === "roll") {
    f.vx = f.st >= 3 && f.st <= 16 ? f.dodgeDir[0] * 7 : f.vx * 0.6;
    if (f.st >= 24) setState(f, f.grounded ? "idle" : "air");
  } else if (k === "spot") {
    f.vx *= 0.6;
    if (f.st >= 22) setState(f, f.grounded ? "idle" : "air");
  } else {
    if (f.st < 18 && (f.dodgeDir[0] || f.dodgeDir[1])) { f.vx *= 0.9; f.vy *= 0.9; }
    else airDrift(f, 0.5);
    if (f.st >= 26) setState(f, "air");
  }
}

function physics(g, f) {
  const s = f.s;
  // a boss in the sea (Kraken Spud) is placed by his moves, no gravity, until the launch that ends him
  if (f.spec.boss && f.spec.boss.sea && !f.doomed) { f.vx = f.vy = f.kbx = f.kby = 0; f.grounded = false; return; }
  if (!f.grounded) {
    let grav = s.gravity, maxFall = f.ff ? s.fastFall : s.fallSpeed;
    if (f.state === "helpless" && f.spec.moves.rec.glide) { grav *= 0.4; maxFall = 4.2; }
    if (f.state === "hitstun") grav *= TUNE.hitGrav;
    let noGrav = false;
    const m = f.move;
    if (f.state === "attack" && m) {
      if (m.kind === "dash" && f.mt > m.startup && f.mt <= m.startup + m.active) noGrav = true;
      if (m.ult === "dive" && f.mt < m.startup) noGrav = true;
      if (m.pound && f.mt >= m.startup) maxFall = Math.max(maxFall, m.vyStart);
    }
    if (f.state === "dodge" && f.dodgeKind === "air" && f.st < 18 && (f.dodgeDir[0] || f.dodgeDir[1])) noGrav = true;
    if (f.held >= 0 || bossFlying(f)) noGrav = true;   // carried by a boss; a boss in the air on purpose (Zorp's saucer)
    if (!noGrav) {
      if (f.vy < maxFall) f.vy = Math.min(f.vy + grav, maxFall);
      else f.vy = Math.max(maxFall, f.vy - 0.5);
    }
  }
  if (f.kbx !== 0 || f.kby !== 0) {
    const mag = dist(f.kbx, f.kby), n = mag - TUNE.kbDecay;
    if (n <= 0) { f.kbx = 0; f.kby = 0; } else { f.kbx *= n / mag; f.kby *= n / mag; }
  }
  const px = f.x, py = f.y;
  f.x += f.vx + f.kbx;
  f.y += f.vy + f.kby;
  collide(g, f, px, py);
}

function collide(g, f, px, py) {
  const S = STAGE.main, hw = f.s.w / 2, h = f.s.h;
  if (f.grounded) {
    let ok;
    if (f.plat < 0) ok = f.x >= S.x1 - 2 && f.x <= S.x2 + 2;
    else { const p = STAGE.plats[f.plat]; ok = f.x >= p.x1 - 2 && f.x <= p.x2 + 2; }
    if (ok && f.vy >= 0 && f.kby >= 0) {
      f.y = f.plat < 0 ? S.top : STAGE.plats[f.plat].y;
      f.vy = 0; f.kby = 0;
    } else {
      f.grounded = false;
      if (f.state === "idle" || f.state === "run" || f.state === "land" || f.state === "getup" || f.state === "tech") setState(f, "air");
    }
  }
  if (!f.grounded) {
    const down = f.y >= py;
    if (down && py <= S.top + 0.5 && f.y >= S.top && f.x >= S.x1 - 2 && f.x <= S.x2 + 2) land(g, f, S.top, -1);
    else if (down && f.dropT <= 0 && !f.spec.boss) {
      for (let i = 0; i < STAGE.plats.length; i++) {
        const p = STAGE.plats[i];
        if (py <= p.y + 0.5 && f.y >= p.y && f.x >= p.x1 - 2 && f.x <= p.x2 + 2) { land(g, f, p.y, i); break; }
      }
    }
    if (!f.grounded && f.y > S.top + 0.5 && f.y - h < S.bottom && f.x + hw > S.x1 && f.x - hw < S.x2) {
      if (py - h >= S.bottom - 0.5) { f.y = S.bottom + h; if (f.vy < 0) f.vy = 0; if (f.kby < 0) f.kby = -f.kby * 0.5; }
      else if (f.x < 0) { f.x = S.x1 - hw; if (f.vx > 0) f.vx = 0; if (f.kbx > 0) f.kbx = -f.kbx * 0.5; }
      else { f.x = S.x2 + hw; if (f.vx < 0) f.vx = 0; if (f.kbx < 0) f.kbx = -f.kbx * 0.5; }
    }
  }
  // a boss never leaves the main floor (until the launch that ends him)
  if (f.spec.boss && !f.doomed) {
    if (f.x < S.x1 + hw) { f.x = S.x1 + hw; if (f.vx < 0) f.vx = 0; }
    else if (f.x > S.x2 - hw) { f.x = S.x2 - hw; if (f.vx > 0) f.vx = 0; }
  }
}

function land(g, f, y, plat) {
  if (f.state === "hitstun" && f.techT > 0) {
    // breakfall: no bounce, a short recovery (or a roll if the stick is held), briefly intangible
    f.y = y; f.grounded = true; f.plat = plat; f.vy = 0; f.kby = 0; f.kbx = 0; f.vx = 0; f.ff = false; f.tumble = false;
    f.airJumps = f.s.airJumps; f.airDodged = false; f.recUsed = false; f.ledgeInv = false;
    f.techDir = Math.abs(f.inp.x) > 0.4 ? sign(f.inp.x) : 0;
    setState(f, "tech"); f.hitstun = 0; f.techT = 0;
    f.invuln = Math.max(f.invuln, f.techDir ? 18 : 12);
    g.events.push({ type: "tech", x: f.x, y, slot: f.slot, roll: f.techDir });
    endLaunch(f);
    return;
  }
  if (f.state === "hitstun" && dist(f.kbx, f.kby) > 4.5 && f.kby + f.vy > 2) {
    f.y = y; f.kby = -Math.abs(f.kby) * 0.6; f.vy = -Math.abs(f.vy) * 0.3;
    g.events.push({ type: "bounce", x: f.x, y });
    return;
  }
  f.y = y; f.grounded = true; f.plat = plat; f.vy = 0; f.kby = 0; f.ff = false; f.tumble = false;
  f.airJumps = f.s.airJumps; f.airDodged = false; f.recUsed = false; f.ledgeInv = false;
  const st = f.state;
  if (st === "hitstun") {
    if (f.strLaunched) { setState(f, "land"); f.landT = 4; f.hitstun = 0; f.freeT = -4; endLaunch(f); }
    else { setState(f, "land"); f.landT = 12; f.hitstun = 0; f.freeT = -12; }
  }
  else if (st === "attack") {
    const m = f.move;
    if (m.air) {
      setState(f, "land"); f.landT = m.landLag; f.move = null; f.mid = null;
      if (m.pound) g.events.push({ type: "pound", x: f.x, y, slot: f.slot });
    }
  } else if (st === "helpless") { setState(f, "land"); f.landT = 12; }
  else if (st === "dodge" && f.dodgeKind === "air") { setState(f, "land"); f.landT = 8; }
  else if (st === "air") { setState(f, "land"); f.landT = 3; }
  g.events.push({ type: "land", x: f.x, y });
}

function tryLedge(g, f) {
  if (f.ledgeCd > 0 || f.vy + f.kby < 0 || f.spec.boss) return;
  const st = f.state;
  const ok = st === "air" || st === "helpless" || (st === "attack" && f.move && f.move.rec && f.mt > f.move.startup + 2);
  if (!ok) return;
  const S = STAGE.main, hw = f.s.w / 2, h = f.s.h;
  const handY = f.y - h;
  if (handY < S.top - 36 || handY > S.top + 30) return;
  for (const side of [-1, 1]) {
    const ex = side < 0 ? S.x1 : S.x2;
    const out = (f.x - ex) * side;
    if (out > hw - 14 && out < hw + 34) {
      if (g.fighters.some((o) => o !== f && o.state === "ledge" && o.ledge === side)) continue;
      setState(f, "ledge");
      f.ledge = side; f.move = null; f.mid = null;
      f.x = ex + side * (hw + 2); f.y = S.top + h - 8;
      f.vx = f.vy = f.kbx = f.kby = 0; f.ff = false; f.tumble = false;
      f.facing = -side;
      f.airJumps = f.s.airJumps; f.recUsed = false; f.airDodged = false;
      if (!f.ledgeInv) { f.invuln = Math.max(f.invuln, 40); f.ledgeInv = true; }
      g.events.push({ type: "ledge", slot: f.slot });
      return;
    }
  }
}

function updateLedge(g, f) {
  const S = STAGE.main, side = f.ledge, toward = -side, i = f.inp, b = f.buf;
  const ex = side < 0 ? S.x1 : S.x2, hw = f.s.w / 2;
  f.vx = f.vy = f.kbx = f.kby = 0;
  if (f.st < 6) return;
  if (b.jump) {
    consume(f, "jump");
    f.x = ex + side * (hw + 2); f.vy = -f.s.jump; f.vx = toward * 2.5;
    setState(f, "air"); f.ledgeCd = 24; f.ledge = 0;
    g.events.push({ type: "jump", x: f.x, y: f.y, ground: false, slot: f.slot });
    return;
  }
  if (b.light || b.heavy || b.special || b.dodge || i.x * toward > 0.6 || i.y < -0.6) {
    for (const k of BTN) consume(f, k);
    f.x = ex + toward * (hw + 8); f.y = S.top; f.grounded = true; f.plat = -1; f.ledge = 0;
    setState(f, "getup"); f.invuln = Math.max(f.invuln, 14);
    return;
  }
  if (i.y > 0.6 || i.x * toward < -0.6 || f.st > 240) {
    setState(f, "air"); f.ledgeCd = 30; f.x += side * 3; f.y += 4; f.ledge = 0;
  }
}

/* ---------- hits ---------- */
function activeBoxes(f) {
  if (f.state !== "attack" || !f.move) return null;
  const m = f.move, a0 = m.startup + 1, a1 = m.startup + m.active;
  if (f.mt < a0 || f.mt > a1 || !m.boxes.length) return null;
  const t = m.active > 1 ? (f.mt - a0) / (m.active - 1) : 0;
  return m.boxes.map((b) => {
    const lx = b.x + (b.x2 - b.x) * t, ly = b.y + (b.y2 - b.y) * t;
    return { x: f.x + lx * f.facing, y: f.y + ly, r: b.r, lx, ly };
  });
}

function spawnProj(g, f, m, i) {
  const p = m.proj, ls = p.lastShot && i === (p.count || 1) - 1 ? p.lastShot : null;
  const style = (ls && ls.style) || (f.finShot && p.finStyle) || p.style || "disc", n = ls || p;
  g.projs.push({
    owner: f.slot, x: f.x + f.facing * p.ox, y: f.y + p.oy, dir: f.facing, vx: f.facing * p.speed,
    vy: p.spreadVy ? p.spreadVy[i] || 0 : p.vy0 || 0, grav: p.grav || 0, boomer: !!p.boomer, style, burst: p.burst || null,
    speed: p.speed, r: p.r, life: p.life, t: 0, pal: f.pal, pulse: p.pulse || 0, last: p.last || null,
    hit: { dmg: n.dmg, bkb: n.bkb, kbg: n.kbg, angle: n.angle, fire: style === "fire", fin: p.fin || null, ult: !!p.ult },
  });
  g.events.push({ type: "proj", slot: f.slot, style, x: f.x + f.facing * p.ox, y: f.y + p.oy });
}
function spawnBurst(g, p, x, y) {
  const b = p.burst;
  g.projs.push({ owner: p.owner, x, y, dir: p.dir, vx: 0, vy: 0, grav: 0, boomer: false, style: "burst", burst: null,
    speed: 0, r: b.r, life: b.life, t: 0, pal: p.pal, pulse: 0, last: null, hit: { dmg: b.dmg, bkb: b.bkb, kbg: b.kbg, angle: b.angle, fire: false, fin: b.fin || null } });
  g.events.push({ type: "burst", x, y, r: b.r, slot: p.owner });
}
function updateProjs(g) {
  const S = STAGE.main;
  for (const p of g.projs) {
    p.t++;
    if (p.z) bossProjStep(g, p);
    else if (p.boomer) {
      p.vx -= p.dir * ((2 * p.speed) / p.life);
      p.x += p.vx;
      const o = g.fighters[p.owner];
      if (p.t > p.life / 2 && o.state !== "dead" && o.state !== "gone") {
        p.y += clamp(o.y - 34 - p.y, -2, 2);
        if (Math.abs(p.x - o.x) < 22 && Math.abs(p.y - (o.y - 34)) < 40) p.done = true;
      }
    } else {
      p.vy += p.grav; p.x += p.vx; p.y += p.vy;
    }
    if (p.t >= p.life || (p.style === "flame" && (p.x < S.x1 || p.x > S.x2))) p.done = true;
    if (p.style !== "burst" && !p.pulse && !p.part && !p.z && p.x > S.x1 && p.x < S.x2 && p.y > S.top - (p.boomer ? -4 : 2) && p.y < S.bottom) {
      p.done = true;
      if (!p.boomer) g.events.push({ type: "projEnd", x: p.x, y: Math.min(p.y, S.top), style: p.style, slot: p.owner });
      if (p.burst) spawnBurst(g, p, p.x, S.top - 6);
    } else if (p.t >= p.life && p.burst) spawnBurst(g, p, p.x, p.y);
  }
  g.projs = g.projs.filter((p) => !p.done);
}

function detectHits(g) {
  const hits = [];
  for (const att of g.fighters) {
    const boxes = activeBoxes(att);
    if (!boxes) continue;
    for (const def of g.fighters) {
      if (def.team === att.team || intangible(def)) continue;
      const mv = att.move, last = att.hitLog[def.slot];
      // a move with a `last` block hits once more with those numbers from its frame `from`
      const blast = mv.last && att.mt >= mv.last.from;
      if (last !== undefined && !(mv.multi && att.mt - last >= mv.multi) && !(blast && last < mv.last.from)) continue;
      const rs = hurtsOf(g, def);
      for (const b of boxes) {
        if (rs.some((r) => circRect(b.x, b.y, b.r, r))) { hits.push({ att, def, hit: blast ? Object.assign({}, mv, mv.last) : mv, lx: b.lx, bx: b.x, by: b.y }); break; }
      }
    }
  }
  for (const p of g.projs) {
    if (p.done || !p.hit) continue;
    // a pulsing cloud only hurts on its pulses, stays after a hit, and its last pulse uses the `last` numbers
    if (p.pulse && p.t % p.pulse !== 0) continue;
    for (const def of g.fighters) {
      if (def.team === g.fighters[p.owner].team || intangible(def)) continue;
      // a passing projectile (pass = a mask of the slots it has hit: Zorp's laser) hits each fighter once and goes on
      if (p.pass != null && (p.pass >> def.slot) & 1) continue;
      if (hurtsOf(g, def).some((r) => circRect(p.x, p.y, p.r, r))) {
        const hit = p.pulse && p.last && p.t + p.pulse > p.life ? Object.assign({}, p.hit, p.last) : p.hit;
        hits.push({ att: g.fighters[p.owner], def, hit, proj: p, bx: p.x, by: p.y });
        if (p.pass != null) p.pass |= 1 << def.slot;
        else if (!p.pulse) { p.done = true; break; }
      }
    }
  }
  for (const h of hits) if (!h.proj) h.att.hitLog[h.def.slot] = h.att.mt;
  for (const h of hits) applyHit(g, h);
  if (hits.some((h) => h.proj)) g.projs = g.projs.filter((p) => !p.done);
}

function knockback(hit, percent, weight) {
  return (hit.bkb + (hit.kbg * percent) / 100) * (100 / weight) * TUNE.kbScale;
}

function applyHit(g, h) {
  const { att, def } = h;
  if (def.spec.boss) return bossHit(g, h);
  if (h.hit.mark) return ultMark(g, att, def);
  // finish mode: a special on an opponent at finishPct or more (the number shown before the hit) finishes
  const fin = !!(h.hit.fin && def.percent >= TUNE.finishPct);
  const hit = fin ? Object.assign({}, h.hit, h.hit.fin) : h.hit;
  // charge: up to +chgDmg damage and +chgKb knockback for a fully charged heavy
  const ck = !h.proj && att.chg > 0 ? att.chg / TUNE.chgMax : 0;
  // combo counter (all hits): hits in a row with fewer than strGap free frames between them
  const chained = def.comboBy === att.slot && def.freeT < TUNE.strGap;
  const nth = chained ? def.combo + 1 : 1;
  let dmg = ck ? Math.round(hit.dmg * (1 + TUNE.chgDmg * ck)) : hit.dmg;
  if (nth >= 4) dmg = Math.max(1, Math.round(dmg * (nth >= 6 ? TUNE.comboK6 : TUNE.comboK4)));
  def.percent = Math.min(999, def.percent + dmg);
  att.dmgDealt += dmg;
  // the ulti bar: dealt and taken damage fill it (an ulti's own hits don't)
  const ultHit = !!h.hit.ult || (!h.proj && att.mid === "ulti");
  if (!ultHit) { ultGain(att, dmg * TUNE.ultDealt); ultGain(def, dmg * TUNE.ultTaken); }
  let kb = knockback(hit, def.percent, def.s.weight);
  if (ck) kb *= 1 + TUNE.chgKb * ck;
  if (ultHit && kb >= TUNE.tumbleKb) kb *= TUNE.ultKb;   // only the launching hits, so a multi-hit ulti still carries its target into the last hit
  let hdir;
  if (h.proj) hdir = sign(h.proj.vx) || h.proj.dir;
  else if (Math.abs(h.lx) < 8) hdir = sign(def.x - att.x) || att.facing;
  else hdir = h.lx >= 0 ? att.facing : -att.facing;
  let tr = trig(hit.angle);
  let dx = tr[0] * hdir, dy = -tr[1];
  const ex = (h.bx + def.x) / 2, ey = (h.by + (def.y - def.s.h * 0.5)) / 2;

  if (armored(def) && kb < TUNE.armorKb) {
    def.armorFlash = 12; def.flash = 4;
    g.hitstop = Math.max(g.hitstop, 5);
    g.events.push({ type: "hit", x: ex, y: ey, dmg, kb: 3, armor: true, slot: att.slot, pal: att.pal, fire: !!hit.fire });
    return;
  }
  // combo counter and light-attack strings
  def.combo = nth;
  def.comboDmg = (chained ? def.comboDmg : 0) + dmg;
  def.comboBy = att.slot;
  let finisher = false, link = false;
  if (!h.proj && LIGHT.has(att.mid)) {
    if (chained && def.strBy === att.slot && def.strN > 0) { if (def.strMv !== att.moveT) { def.strN++; link = def.strN === 2; } }
    else def.strN = 1;
    def.strBy = att.slot; def.strMv = att.moveT;
    if (def.strN >= 3) {
      // third light hit in a row: launch the defender away so a fourth can't connect
      finisher = true; def.strN = 0; def.strLaunched = true;
      tr = trig(TUNE.strLaunchAngle);
      dx = tr[0] * (sign(def.x - att.x) || att.facing); dy = -tr[1];
      kb = Math.max(kb * 1.25, TUNE.strLaunchKb);
    }
  } else if (!chained) def.strN = 0;

  if (def.grounded && dy > 0.2) { dy = -dy * 0.75; kb *= 0.8; }
  if (link && dy < -0.9) kb = Math.max(kb, TUNE.linkPop);

  def.move = null; def.mid = null; def.ledge = 0; def.link = 0;
  setState(def, "hitstun");
  def.hitstun = Math.max(8, Math.round(kb * TUNE.hitstunK));
  if (def.grounded && kb < 6 && dy > -0.75) {
    def.kbx = dx * kb * 0.7; def.kby = 0;
    def.hitstun = Math.round(8 + kb * 1.3);
  } else {
    // knockback steering: the defender's stick bends the launch angle (whole degrees, so it stays deterministic)
    let ix = def.inp.x, iy = def.inp.y;
    const im = dist(ix, iy);
    if (im > 0.3) {
      if (im > 1) { ix /= im; iy /= im; }
      const deg = Math.round(TUNE.diMax * clamp(dx * iy - dy * ix, -1, 1));
      if (deg) { const r = trig(deg), ndx = dx * r[0] - dy * r[1]; dy = dx * r[1] + dy * r[0]; dx = ndx; }
    }
    def.grounded = false; def.y -= 1;
    def.kbx = dx * kb; def.kby = dy * kb;
  }
  if (link) { def.hitstun += TUNE.linkStun; att.link = TUNE.linkWin; }
  def.vx = 0; def.vy = 0; def.ff = false;
  def.tumble = kb >= TUNE.tumbleKb;
  def.lastHitBy = att; def.lastHitT = g.t;
  def.recUsed = false; def.airDodged = false; if (def.airJumps < 1) def.airJumps = 1;
  def.ledgeCd = Math.max(def.ledgeCd, 20);
  def.flash = 8;
  g.hitstop = Math.max(g.hitstop, Math.min(16, Math.round(3 + dmg * 0.45 + kb * 0.12)));
  if (fin) g.hitstop = Math.max(g.hitstop, TUNE.finishStop);
  const mv = ultHit ? "ulti" : h.proj ? "spec" : att.mid;
  if (def.tumble) g.launches.push({ att, def, mv, fin, chg: att.chg, kb, dirx: dx, diry: dy });
  g.events.push({ type: "hit", x: ex, y: ey, dmg, kb, dirx: dx, diry: dy, slot: att.slot, def: def.slot, pal: att.pal, fire: !!hit.fire, combo: def.combo, comboDmg: def.comboDmg, finisher, ps: h.proj ? h.proj.style : null, mv, fin, chg: ck ? att.chg : 0, link, lk: !h.proj && att.lk, mi: h.proj ? -1 : att.moveT, ult: ultHit });
}

/* ---------- Bosses: the brain (bossAct, on g.br), his moves (bossStep), hits on him (bossHit) and his end (bossDown) ---------- */
// the boss's own random numbers: a mulberry32 step on g.br (an integer in the game state, so snapshots and the KO look-ahead carry it)
function brand(g) {
  const a = (g.br = (g.br + 0x6D2B79F5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const bossRage = (g, f) => f.hp * 100 <= f.hpMax * f.spec.boss.rageAt[g.lv];
const bossLive = (o) => o.state !== "gone" && o.state !== "dead" && o.state !== "respawn" && !o.doomed;
// who he goes after next: the nearest player most of the time, the other one sometimes
function bossAim(g, f) {
  const c = g.fighters.filter((o) => o.team !== f.team && bossLive(o));
  if (!c.length) return -1;
  c.sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x) || a.slot - b.slot);
  return c.length > 1 && brand(g) >= 0.7 ? c[1].slot : c[0].slot;
}
function bossAct(g, f) {
  f.inp.x = 0;
  // a flying boss (Zorp's saucer) keeps his height and drifts; a boss in the sea (Kraken Spud) waits there, his head out of reach;
  // the others fall like anyone
  const fly = bossFlying(f), sea = !!f.spec.boss.sea, still = () => { if (fly) f.vx *= 0.85; else if (!sea) groundMove(g, f); };
  if (sea) { if (f.state !== "air") setState(f, "air"); f.ph = 0; bossHome(f); }
  else if (fly) { if (f.state !== "air") setState(f, "air"); bossHover(f, f.spec.boss.fly.y); }
  else if (!f.grounded) { if (f.state !== "air") setState(f, "air"); airDrift(f, 0.5); return; }
  // the KO look-ahead and the countdown: he stands (an attack already running plays out)
  if (g.look || g.phase !== "play") return still();
  let t = f.aim >= 0 ? g.fighters[f.aim] : null;
  if (!t || !bossLive(t)) { f.aim = bossAim(g, f); t = f.aim >= 0 ? g.fighters[f.aim] : null; }
  if (!t) return still();
  const dx = t.x - f.x, adx = Math.abs(dx), up = f.y - t.y;
  if (f.bt > 0) f.bt--;
  else {
    const key = bossPick(g, f, t, dx, up);
    if (key) { if (!sea) f.facing = sign(dx) || f.facing; return bossStart(g, f, key, t); }
  }
  if (sea) return;
  if (fly) {
    // over the target, within his range
    const F = f.spec.boss.fly, d = clamp(t.x, -F.range, F.range) - f.x;
    f.vx = Math.abs(d) > F.speed ? sign(d) * F.speed : d;
    if (dx) f.facing = sign(dx);
    return;
  }
  if (adx > f.spec.boss.near) f.inp.x = sign(dx);
  groundMove(g, f);
  if (!f.inp.x && dx) f.facing = sign(dx);
}
// the next move: each boss weighs his moves (his boss.order) by where the target is; "" = walk in first
function bossPick(g, f, t, dx, up) {
  const B = f.spec.boss, w = BOSS_WEIGH[f.spec.id](g, f, t, dx, up);
  if (!w) return "";
  const last = B.order.indexOf(f.bq);
  if (last >= 0) w[last] /= 3;
  let sum = 0;
  for (const v of w) sum += v;
  let r = brand(g) * sum;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (w[i] > 0 && r < 0) return B.order[i]; }
  return "";
}
// Old Scratch: stab, whip, stomp, rain, charge (null = walk in first)
function scratchWeigh(g, f, t, dx, up) {
  const S = STAGE.main, adx = Math.abs(dx), half = f.hp * 100 <= f.hpMax * f.spec.boss.chargeAt[g.lv];
  const back = g.fighters.some((o) => o.team !== f.team && o !== t && bossLive(o) && Math.abs(o.x - f.x) < 170 && sign(o.x - f.x) !== sign(dx));
  const room = dx > 0 ? S.x2 - f.x : f.x - S.x1;
  const w = [
    adx < 250 && up < 110 ? 3 : 0,                     // stab
    adx < 170 && up < 100 ? (back ? 6 : 2.5) : 0,      // whip
    adx < 300 && up < 140 ? 2 : 0,                     // stomp
    up > 70 || adx > 320 ? 2 : 1,                      // rain
    half && adx > 90 && up < 90 && room > 300 ? 3 : 0,   // charge
  ];
  if (adx > 330 && !w[4] && brand(g) < 0.6) return null;
  return w;
}
// Zorp: beam, laser, probe, abduct, bump while he hovers; eye, toss, spin, hop once he has crashed (null = drift over first)
function zorpWeigh(g, f, t, dx, up) {
  const adx = Math.abs(dx), foes = g.fighters.filter((o) => o.team !== f.team && bossLive(o));
  if (f.ph === 0) {
    const mate = foes.find((o) => o !== t);
    // someone sitting on the pot rack over him (Nightmare: on a counter beside him too), or in the air over his dome
    const perch = foes.some((o) => o.grounded && o.plat >= 0 && Math.abs(o.x - f.x) < (g.lv === 2 ? 200 : 130) && (o.y < f.y - 40 || g.lv === 2));
    const over = foes.some((o) => !o.grounded && o.y < f.y - 80 && Math.abs(o.x - f.x) < 100);
    const w = [
      t.grounded && t.plat < 0 && adx < 120 ? 3 : 0,                          // beam
      adx > 200 && t.plat < 0 ? 2.5 : 0,                                      // laser
      adx >= 120 && adx <= 300 ? 2 : 1,                                       // probe
      t.grounded && !!mate && Math.abs(mate.x - t.x) < 400 ? 2 : 0,           // abduct
      perch ? 4 : over ? 1.5 : 0,                                             // bump
      0, 0, 0, 0,
    ];
    if (adx > 330 && brand(g) < 0.6) return null;
    return w;
  }
  const w = [
    0, 0, 0, 0, 0,
    up < 60 ? (adx >= 120 && adx <= 400 ? 3 : adx > 80 ? 1 : 0) : 0,   // eye
    adx > 150 ? 2 : 1,                                                // toss
    adx < 150 && up < 90 ? 3 : 0,                                     // spin
    adx > 250 ? 2.5 : adx > 150 ? 1 : 0,                              // hop
  ];
  if (adx > 420 && brand(g) < 0.6) return null;
  return w;
}
// Kraken Spud: slam, sweep, ink, wave, chomp (he never walks in)
function krakenWeigh(g, f, t, dx, up) {
  const B = f.spec.boss, foes = g.fighters.filter((o) => o.team !== f.team && bossLive(o));
  const partDown = g.projs.some((p) => p.owner === f.slot && p.part && !p.done);
  return [
    4,                                                                                   // slam
    foes.every((o) => o.grounded && o.x < 0) ? 3 : 2,                                    // sweep
    f.bq === "ink" || g.t < 750 || partDown ? 0 : 1,                                     // ink: never twice running, not in the first 10 s
    foes.every((o) => o.x > 0) ? 3 : 1.5,                                                // wave
    f.hp * 100 <= f.hpMax * B.chompAt[g.lv] && t.grounded && t.x > 40 ? 3 : 0,           // chomp
  ];
}
const BOSS_WEIGH = { scratch: scratchWeigh, zorp: zorpWeigh, kraken: krakenWeigh };
// t: the fighter he picked the move against (f.bx = where they stand; the move's own counter f.bk starts at 0)
function bossStart(g, f, key, t) {
  const B = f.spec.boss, rage = bossRage(g, f);
  // a stronger version from Hard (or in rage): Zorp's Eye Beam both ways
  if (B.swap && B.swap[key] && (g.lv >= 1 || rage)) key = B.swap[key];
  const m = f.spec.moves[key];
  startMove(g, f, key);
  f.bq = m.base || key; f.bx = t ? t.x : f.x; f.bk = 0;
  // harder levels and rage skip part of the wind-up (the tell is shorter, the hit frames are the same)
  if (m.fast) f.mt = Math.round(m.startup * (B.lvFast[g.lv] + (rage ? B.rageFast : 0)));
  if (m.hop) { f.vy = -m.hop; f.grounded = false; f.plat = -1; }
  const gp = B.gap[g.lv];
  f.bt = Math.round((gp[0] + brand(g) * gp[1]) * (rage ? B.rageGap : 1) * (m.halfGap ? 0.5 : 1));
  f.aim = bossAim(g, f);
  g.events.push({ type: "bossMove", slot: f.slot, mv: f.bq, x: f.x, y: f.y, rage });
}
function bossProj(f, x, y, vx, vy, style, o, extra) {
  return Object.assign({ owner: f.slot, x, y, dir: f.facing, vx, vy, grav: 0, boomer: false, style, burst: null, speed: Math.abs(vx), r: o.r, life: o.life,
    t: 0, pal: f.pal, pulse: 0, last: null, hit: { dmg: o.dmg, bkb: o.bkb, kbg: o.kbg, angle: o.angle, fire: !!f.spec.boss.fireHits, fin: null } }, extra);
}
// per-move behaviour after mt++ in updateAttack (each boss his own); true = it moved him itself this frame
const bossStep = (g, f, m) => BOSS_STEP[f.spec.id](g, f, m);
function scratchStep(g, f, m) {
  const S = STAGE.main, k = m.boss, mt = f.mt, a0 = m.startup + 1, a1 = m.startup + m.active;
  if (k === "stomp" && mt === a0) {
    // still in the air at the end of the hop: wait for the landing (a cap ends the wait)
    if (!f.grounded && f.poundT++ < 40) { f.mt = m.startup; return false; }
    const fl = m.flame;
    for (const d of [-1, 1]) g.projs.push(bossProj(f, f.x + d * fl.dx, S.top - fl.r + 2, d * fl.vx, 0, "flame", fl, { dir: d }));
    g.events.push({ type: "bossStomp", slot: f.slot, x: f.x, y: f.y });
  }
  if (k === "rain" && mt === a0) {
    // a fireball on every player, one near each, the rest anywhere on the floor; they land one after another
    const xs = [];
    for (const o of g.fighters) if (o.team !== f.team && bossLive(o)) xs.push(o.x, o.x + (brand(g) < 0.5 ? -1 : 1) * (70 + brand(g) * 60));
    const n = f.spec.boss.rainN[g.lv];
    while (xs.length < n) xs.push(S.x1 + 40 + brand(g) * (S.x2 - S.x1 - 80));
    const b = m.ball;
    xs.slice(0, n).forEach((x, i) => g.projs.push(bossProj(f, clamp(x, S.x1 + 30, S.x2 - 30), S.top - 520 - i * 36, 0, b.vy, "brim", b, { burst: b.burst })));
    g.events.push({ type: "bossRain", slot: f.slot, x: f.x, y: f.y });
  }
  if (k === "charge" && mt >= a0 && mt <= a1) {
    // the run: to the far wall, a fire trail behind him
    const hw = f.s.w / 2, wall = f.facing > 0 ? S.x2 - hw - 12 : S.x1 + hw + 12, tr = m.trail;
    f.vx = f.facing * m.speed;
    if ((mt - a0) % tr.every === 0) g.projs.push(bossProj(f, f.x - f.facing * 30, S.top - tr.r + 4, 0, 0, "trail", tr, { pulse: tr.pulse, life: f.spec.boss.trailLife[g.lv] }));
    if ((f.x - wall) * f.facing >= 0) f.mt = a1;
    return true;
  }
  return false;
}
// Zorp's moves: he runs the whole move himself (hover, drift, grabs, throws, the crash and its landing) and ends it
const ZORP_DROP = [[-26, -1.6, -1], [26, 1.6, 1], [0, 0, 0], [-46, -3, -1], [46, 3, 1]];   // probes dropped: x offset, vx, walk dir (0: at the nearest player)
function zorpStep(g, f, m) {
  const S = STAGE.main, B = f.spec.boss, k = m.boss, mt = f.mt, a0 = m.startup + 1, a1 = m.startup + m.active, total = a1 + m.endlag;
  const foes = g.fighters.filter((o) => o.team !== f.team && bossLive(o)), held = g.fighters.find((o) => o.held === f.slot) || null;
  if (bossFlying(f) && k !== "crash" && !(k === "bump" && mt >= a0 && mt <= a1)) { f.vx *= 0.85; bossHover(f, B.fly.y); }
  else if (f.grounded) f.vx *= 0.82;
  if (k === "beam") {
    // the beam catches one player on the floor under him; held: lifted while he drifts to the nearer ledge, then thrown out
    if (!held && !f.bk && mt >= a0 && mt <= a1)
      for (const o of foes) if (o.grounded && o.plat < 0 && !intangible(o) && Math.abs(o.x - f.x) < m.zone) { bossHold(g, f, o); f.bk = 1; f.bx = sign(f.x) || f.facing; break; }
    if (held) {
      f.vx = f.bx * m.drift;
      bossCarry(held, f.x, Math.max(S.top - m.lift, held.y - 4.5), 0.3, 1);
      if (++f.bk > m.liftT) { bossLet(g, f, m, f.bx); f.bk = -1; }
    }
  }
  if (k === "laser" && mt === a0) {
    const L = m.shot;
    g.projs.push(bossProj(f, f.x, S.top - L.r, f.facing * L.vx, 0, "laser", L, { z: "laser", w: B.laserBack[g.lv], pass: 0 }));
  }
  if (k === "probe" && mt === a0)
    for (const [ox, vx, d] of ZORP_DROP.slice(0, B.probeN[g.lv])) zorpProbe(g, f, m.probe, f.x + ox, f.y + 4, vx, -2, d);
  if (k === "toss" && mt === a0) {
    // lobbed forward to 120 / 220 / 320 (rage: 420), they walk back at him
    const n = bossRage(g, f) ? 4 : 3, y0 = f.y - 70;
    for (let i = 0; i < n; i++) {
      const tx = clamp(f.x + f.facing * (120 + 100 * i), S.x1 + 20, S.x2 - 20), air = 43;
      zorpProbe(g, f, m.probe, f.x + f.facing * 30, y0, (tx - f.x - f.facing * 30) / air, -9, -f.facing);
    }
  }
  if (k === "abduct") {
    // the spotlight chases his target until follow[1], then holds still; a player standing in it in the active frames is pulled up
    // and thrown at the partner (from throwLv the thrown body hits the partner)
    const t = f.aim >= 0 ? g.fighters[f.aim] : null;
    if (mt <= m.follow[1] && t && bossLive(t)) f.bx += clamp(t.x - f.bx, -m.follow[0], m.follow[0]);
    if (!held && !f.bk && mt >= a0 && mt <= a1)
      for (const o of foes) if (o.grounded && !intangible(o) && Math.abs(o.x - f.bx) < m.col) { bossHold(g, f, o); f.bk = 1; break; }
    if (held) {
      bossCarry(held, f.bx, S.top - m.pull, 0.25, 0.25);
      if (++f.bk > m.pullT) {
        const mate = foes.find((o) => o !== held && o.held < 0), dir = mate ? sign(mate.x - held.x) || 1 : sign(held.x) || 1;
        bossThrow(g, f, held, dir, m.toss);
        if (mate && g.lv >= B.throwLv) g.projs.push(bossProj(f, held.x, held.y - held.s.h * 0.5, dir * m.toss.vx, 0, "ride", m.body, { z: "ride", w: held.slot, pass: 1 << held.slot }));
        f.bk = -1;
      }
    }
  }
  if (k === "bump" && mt >= a0 && mt <= a1) { f.y -= m.rise; f.vy = 0; }
  if (k === "crash") {
    // from the height he was at (f.bx) to the floor in the wind-up, then the landing ring; phase 2 from the landing
    f.vx *= 0.9;
    if (mt <= m.startup) { const q = mt / m.startup; f.y = f.bx + (S.top - f.bx) * q * q; f.vy = 0; }
    if (mt === m.startup) {
      f.y = S.top; f.grounded = true; f.plat = -1; f.ph = 1;
      g.events.push({ type: "bossCrashLand", slot: f.slot, x: f.x, y: f.y });
    }
  }
  if (k === "hop") {
    // a crouch, then a thruster hop that lands on the spot (f.bx) at the hitbox frame; still in the air there: wait for the landing
    if (!f.bk && f.grounded && mt >= m.startup - m.hopT) {
      const T = Math.max(8, m.startup - mt + 1), tx = clamp(f.bx, -m.range, m.range);
      f.vx = (tx - f.x) / T; f.vy = -f.s.gravity * T / 2; f.grounded = false; f.plat = -1; f.bk = 1;
      g.events.push({ type: "bossHop", slot: f.slot, x: f.x, y: f.y });
    }
    if (mt === a0 && !f.grounded && f.poundT++ < 40) f.mt = m.startup;
  }
  if (f.mt >= total) {
    f.move = null; f.mid = null; bossLet(g, f, null);
    if (k === "crash") {
      // dazed on the floor: a free stagger
      setState(f, "stagger"); f.stag = B.crashStag; f.poise = 0;
      g.events.push({ type: "bossStagger", slot: f.slot, by: -1, x: f.x, y: f.y, n: f.stag });
    } else setState(f, f.grounded ? "idle" : "air");
  }
  return true;
}
// Kraken Spud's moves: tentacles and the wave are projectiles (a slammed tentacle is a `part`: he can be hit through it); only the
// Chomp moves his head (onto the deck: hurtable while it lies there, f.ph 1); f.bx = the first slam's spot / the Chomp's,
// f.bk = the second slam's spot (from pairT; 1e4 = none) / the Chomp's state (0 reaching, 1.. chewing, -1 lying on the deck)
function krakenStep(g, f, m) {
  const S = STAGE.main, B = f.spec.boss, k = m.boss, mt = f.mt, a0 = m.startup + 1, a1 = m.startup + m.active, total = a1 + m.endlag;
  const foes = g.fighters.filter((o) => o.team !== f.team && bossLive(o)), held = g.fighters.find((o) => o.held === f.slot) || null;
  if (k !== "chomp") { f.ph = 0; bossHome(f); }
  if (k === "slam") {
    if (mt === m.pairT) {
      // pairs (from pairAt % HP, or in rage): the second on the other player, pairT frames after the first
      let o2 = null, best = -1;
      if (f.hp * 100 <= f.hpMax * B.pairAt[g.lv] || bossRage(g, f)) for (const o of foes) if (Math.abs(o.x - f.bx) > best) { best = Math.abs(o.x - f.bx); o2 = o; }
      f.bk = o2 ? clamp(o2.x, S.x1 + 30, S.x2 - 30) : 1e4;
    }
    if (mt === a0) krakenSlam(g, f, m, f.bx);
    if (mt === a0 + m.pairT && f.bk < 1e4) krakenSlam(g, f, m, f.bk);
  }
  if (k === "sweep") {
    const L = m.shot;
    if (mt === a0) g.projs.push(bossProj(f, S.x1 + L.r, S.top - L.r, L.vx, 0, "sweep", L, { z: "laser", w: 0, pass: 0, dir: 1 }));
    if (mt === a0 + 30 && B.sweepN[g.lv] > 1) g.projs.push(bossProj(f, S.x2 - L.r, S.top - L.r, -L.vx, 0, "sweep", L, { z: "laser", w: 0, pass: 0, dir: -1 }));
  }
  if (k === "ink" && mt === a0) g.events.push({ type: "bossInk", slot: f.slot, n: B.inkN[g.lv], dur: B.inkT[g.lv], seed: g.t, x: f.x, y: f.y });
  if (k === "wave" && mt === a0)
    g.projs.push(Object.assign(bossProj(f, S.x2 + m.half, S.top, -m.vx, 0, "wave", { r: m.half, life: 600 }), { hit: null, z: "wave", w: B.waveH[g.lv], speed: B.wavePush[g.lv], pass: 0, dir: -1 }));
  if (k === "chomp") {
    const H = B.sea, lx = clamp(f.bx, 40, 300), lt = m.startup - m.lunge;
    f.ph = 0;
    if (mt <= lt) { f.x += (H.x - f.x) * 0.2; f.y += (H.y - 60 - f.y) * 0.2; }   // he rears up
    else if (mt <= m.startup) { const q = (mt - lt) / m.lunge; f.x += (lx - f.x) * q; f.y += (S.top - f.y) * q; }   // the lunge onto the deck
    else if (mt <= total - m.slide) {
      f.x = lx; f.y = S.top;
      if (!f.bk && mt <= a1) {
        // the mouth catches one player (hidden while it reaches; a box over the deck)
        const [hw, y1, y2] = m.mouth;
        for (const o of foes) {
          if (intangible(o) || o.held >= 0) continue;
          const r = hurt(o);
          if (r.x2 > lx - hw && r.x1 < lx + hw && r.y2 > S.top - y2 && r.y1 < S.top - y1) { bossHold(g, f, o); f.bk = 1; break; }
        }
        // a miss: the head lies on the deck miss frames
        if (!f.bk && mt === a1) { f.bk = -1; f.mt = a1 + m.chew + m.down - m.miss; }
      }
      if (held && f.bk > 0) {
        bossCarry(held, lx, S.top - 40, 0.4, 0.4);
        const n = f.bk++;
        if (n % m.bites[0] === 0) {
          held.percent = Math.min(999, held.percent + m.bites[1]); f.dmgDealt += m.bites[1]; ultGain(held, m.bites[1] * TUNE.ultTaken); held.flash = 6;
          g.events.push({ type: "bossBite", slot: f.slot, def: held.slot, x: held.x, y: held.y, dmg: m.bites[1] });
        }
        // spat straight up, then the head lies on the deck (the window): from the end of the chew on the clock
        if (n >= m.chew) { bossLet(g, f, m.spit, 1); f.bk = -1; f.mt = a1 + m.chew; }
      }
      if (f.bk === -1) f.ph = 1;
    } else bossHome(f, 0.2);   // slides back
  }
  if (f.mt >= total) { f.move = null; f.mid = null; f.ph = 0; bossLet(g, f, null); setState(f, "air"); }
  return true;
}
// a slam at x: the tip's hit (6 frames) and the tentacle left on the deck (a part: he can be hit through it)
function krakenSlam(g, f, m, x) {
  const S = STAGE.main, B = f.spec.boss;
  x = clamp(x, S.x1 + 30, S.x2 - 30);
  g.projs.push(bossProj(f, x, S.top - 30, 0, 0, "slam", m.tip, { pass: 0 }));
  g.projs.push(Object.assign(bossProj(f, x, S.top, 0, 0, "tent", { r: 30, life: (bossRage(g, f) ? B.rageStay : B.stay)[g.lv] }), { hit: null, part: m.part }));
  g.events.push({ type: "bossSlam", slot: f.slot, x, y: S.top });
}
// where his strike will land on the floor (bots step out of it): the slams' spots, the Chomp's; null once it has landed
function bossThreat(f) {
  const m = f.move, a0 = m.startup + 1;
  if (f.mid === "slam") { if (f.mt <= a0) return f.bx; if (f.mt >= m.pairT && f.bk < 1e4 && f.mt <= a0 + m.pairT) return f.bk; }
  if (f.mid === "chomp" && f.mt <= a0 + m.active) return clamp(f.bx, 40, 300);
  return null;
}
// his head eases home (in the sea past the ledge)
function bossHome(f, k) { const H = f.spec.boss.sea; f.x += (H.x - f.x) * (k || 0.15); f.y += (H.y - f.y) * (k || 0.15); }
// staggered or broken: the head flops onto the deck at f.bx
function bossFlop(f) { f.x += (f.bx - f.x) * 0.3; f.y += (STAGE.main.top - f.y) * 0.3; }
const BOSS_STEP = { scratch: scratchStep, zorp: zorpStep, kraken: krakenStep };
// a probe: falls (grav), walks once it lands (w: its direction; 0 = at the nearest player then), pops after walkT frames
function zorpProbe(g, f, P, x, y, vx, vy, d) {
  g.projs.push(bossProj(f, x, y, vx, vy, "probe", P, { z: "probe", w: d, grav: P.grav, speed: f.spec.boss.probeSpeed[g.lv], burst: P.burst }));
}
// the boss projectiles that move themselves (p.z): probes, the laser, the body thrown by Abduct
function bossProjStep(g, p) {
  const S = STAGE.main;
  if (p.z === "probe") {
    if (p.grav) {
      const py = p.y;
      p.vy += p.grav; p.x += p.vx; p.y += p.vy;
      let fy = null;
      if (p.vy > 0) {
        if (p.x > S.x1 && p.x < S.x2 && py + p.r <= S.top + 0.5 && p.y + p.r >= S.top) fy = S.top;
        else for (const q of STAGE.plats) if (p.x >= q.x1 && p.x <= q.x2 && py + p.r <= q.y + 0.5 && p.y + p.r >= q.y) { fy = q.y; break; }
      }
      if (fy !== null) {
        // landed: walk (the first landing starts its walkT frames)
        if (!p.w) {
          let best = 1e9;
          for (const o of g.fighters) if (o.team !== g.fighters[p.owner].team && bossLive(o) && Math.abs(o.x - p.x) < best) { best = Math.abs(o.x - p.x); p.w = sign(o.x - p.x) || 1; }
          if (!p.w) p.w = 1;
        }
        p.y = fy - p.r; p.vy = 0; p.grav = 0; p.vx = p.w * p.speed; p.dir = p.w;
        if (p.life >= ZORP_PROBE.life) p.life = p.t + ZORP_PROBE.walkT;
        g.events.push({ type: "probeLand", x: p.x, y: fy, slot: p.owner });
      } else if (p.y > S.bottom + 200) p.done = true;
    } else {
      p.x += p.vx;
      const fy = p.y + p.r, q = Math.abs(fy - S.top) < 1 ? null : STAGE.plats.find((q) => Math.abs(q.y - fy) < 1);
      // off the stage's edge: it fizzles; off a platform: it falls again
      if (!q && (p.x < S.x1 || p.x > S.x2)) { p.done = true; g.events.push({ type: "projEnd", x: p.x, y: fy, style: p.style, slot: p.owner }); }
      else if (q && (p.x < q.x1 || p.x > q.x2)) p.grav = ZORP_PROBE.grav;
    }
  } else if (p.z === "laser") {
    p.x += p.vx;
    if (p.x <= S.x1 + p.r || p.x >= S.x2 - p.r) {
      p.x = clamp(p.x, S.x1 + p.r, S.x2 - p.r);
      if (p.w > 0) { p.w--; p.vx = -p.vx; p.dir = -p.dir; p.pass = 0; g.events.push({ type: "laserTurn", x: p.x, y: p.y, slot: p.owner }); }
      else { p.done = true; g.events.push({ type: "projEnd", x: p.x, y: p.y, style: p.style, slot: p.owner }); }
    }
  } else if (p.z === "wave") {
    // Kraken's Wave: rolls along the deck; pushes everyone inside (p.speed on the floor, 2 in the air) and hurts each once (4%)
    p.x += p.vx;
    const d = sign(p.vx), owner = g.fighters[p.owner];
    for (const o of g.fighters) {
      if (o.team === owner.team || !bossLive(o) || o.held >= 0 || o.state === "ledge") continue;
      if (Math.abs(o.x - p.x) > p.r + o.s.w / 2 || o.y < S.top - p.w || o.y > S.top + 1 || o.plat >= 0) continue;
      o.x += d * (o.grounded ? p.speed : 2);
      if (!((p.pass >> o.slot) & 1)) {
        p.pass |= 1 << o.slot;
        o.percent = Math.min(999, o.percent + 4); owner.dmgDealt += 4; ultGain(o, 4 * TUNE.ultTaken); o.flash = 6;
        g.events.push({ type: "bossWave", slot: p.owner, def: o.slot, x: o.x, y: o.y, dmg: 4 });
      }
    }
    if (p.x < S.x1 - p.r - 20) p.done = true;
  } else if (p.z === "ride") {
    const o = g.fighters[p.w];
    if (o.state !== "hitstun" || o.held >= 0) p.done = true;
    else { p.vx = o.kbx + o.vx || p.vx; p.x = o.x; p.y = o.y - o.s.h * 0.5; }
  }
}
// a hit on the boss: HP instead of percent, poise, no flinch (lights or not) until poise is full; never launched until he is broken
function bossHit(g, h) {
  const { att, def } = h, B = def.spec.boss;
  // Thousand Cuts: the dash marks him, the cut lands at the sheath click (ultStep)
  if (h.hit.mark) { if (att.ultTgt < 0) att.ultTgt = def.slot; return; }
  const ultHit = !!h.hit.ult || (!h.proj && att.mid === "ulti");
  const light = !ultHit && !h.proj && (LIGHT.has(att.mid) || att.mid === "rec");
  const mv = ultHit ? "ulti" : h.proj ? "spec" : att.mid;
  const hdir = h.proj ? sign(h.proj.vx) || h.proj.dir : Math.abs(h.lx) < 8 ? sign(def.x - att.x) || att.facing : h.lx >= 0 ? att.facing : -att.facing;
  const ex = (h.bx + def.x) / 2, ey = (h.by + (def.y - def.s.h * 0.5)) / 2;
  if (def.state === "broken") {
    if (!light) return bossDown(g, att, def, h, mv, hdir, ex, ey);
    def.flash = 4;
    g.events.push({ type: "hit", x: ex, y: ey, dmg: 0, kb: 1, dirx: hdir, diry: 0, slot: att.slot, def: def.slot, pal: att.pal, fire: !!h.hit.fire, combo: 0, comboDmg: 0, finisher: false, ps: h.proj ? h.proj.style : null, mv, fin: false, chg: 0, link: false, lk: false, mi: h.proj ? -1 : att.moveT, ult: ultHit, boss: true, broken: true });
    return;
  }
  const stag = def.state === "stagger", rage = bossRage(g, def);
  const ck = !h.proj && att.chg > 0 ? att.chg / TUNE.chgMax : 0;
  let dmg = ck ? Math.round(h.hit.dmg * (1 + TUNE.chgDmg * ck)) : h.hit.dmg;
  dmg = Math.max(1, Math.round(dmg * (light ? B.lightK : 1) * (stag ? B.stagK : 1)));
  def.hp = Math.max(0, def.hp - dmg);
  att.dmgDealt += dmg;
  if (!ultHit) ultGain(att, dmg * TUNE.ultDealt);
  // the combo pop-up counts everyone's hits on him within strGap frames of each other
  const chained = def.combo > 0 && g.t - def.lastHitT < TUNE.strGap;
  def.combo = chained ? def.combo + 1 : 1;
  def.comboDmg = (chained ? def.comboDmg : 0) + dmg;
  def.comboBy = att.slot; def.lastHitBy = att; def.lastHitT = g.t;
  def.flash = 6; def.armorFlash = stag ? 0 : 8;
  if (!stag) def.poise = Math.min(B.poise, def.poise + (ultHit ? 10 : h.proj || att.mid === "spec" ? 4 : light ? 1 : 3));
  g.hitstop = Math.max(g.hitstop, Math.min(8, Math.round(2 + dmg * 0.3)));
  g.events.push({ type: "hit", x: ex, y: ey, dmg, kb: light ? 2 : 5, dirx: hdir, diry: 0, slot: att.slot, def: def.slot, pal: att.pal, fire: !!h.hit.fire, combo: def.combo, comboDmg: def.comboDmg, finisher: false, ps: h.proj ? h.proj.style : null, mv, fin: false, chg: ck ? att.chg : 0, link: false, lk: !h.proj && att.lk, mi: h.proj ? -1 : att.moveT, ult: ultHit, boss: true, stag });
  if (def.hp <= 0) {
    // broken: he kneels, his fire goes out; the next non-light hit ends him
    def.move = null; def.mid = null; def.poise = 0; def.stag = 0; def.vx = 0;
    setState(def, "broken");
    bossLet(g, def, null);
    if (B.fly) def.ph = 1;   // a flying boss falls to the floor
    if (B.sea) { def.bx = clamp(def.ph === 1 ? def.x : h.bx, 60, 290); def.ph = 0; }   // the head flops onto the deck where he was hit
    g.projs = g.projs.filter((p) => p.owner !== def.slot);
    g.events.push({ type: "bossBroken", slot: def.slot, by: att.slot, x: def.x, y: def.y });
  } else if (B.crashAt && def.ph === 0 && def.mid !== "crash" && def.hp * 100 <= def.hpMax * B.crashAt[g.lv]) {
    // Zorp's saucer gives out: the crash (phase 2 from its landing)
    bossLet(g, def, null);
    startMove(g, def, "crash");
    def.bq = ""; def.bx = def.y; def.bk = 0; def.stag = 0; def.poise = 0;
    g.events.push({ type: "bossCrash", slot: def.slot, by: att.slot, x: def.x, y: def.y });
  } else if (!stag && def.poise >= B.poise && def.mid !== "crash") {
    def.move = null; def.mid = null; def.vx = 0;
    bossLet(g, def, null);
    if (B.sea) { def.bx = clamp(def.ph === 1 ? def.x : h.bx, 60, 290); def.ph = 0; g.projs = g.projs.filter((p) => !(p.owner === def.slot && p.part)); }
    setState(def, "stagger");
    def.stag = Math.round(B.stagger[g.lv] * (rage ? B.rageStag : 1));
    g.events.push({ type: "bossStagger", slot: def.slot, by: att.slot, x: def.x, y: def.y, n: def.stag });
  }
}
// a flying boss (boss.fly: Zorp's saucer before his phase 2) keeps his height himself: no gravity until he comes down or is launched
const bossFlying = (f) => !!f.spec.boss && !!f.spec.boss.fly && f.ph === 0 && !f.doomed;
// he eases to h over the floor (4 a frame)
function bossHover(f, h) { f.vy = 0; f.grounded = false; f.plat = -1; f.y += clamp(STAGE.main.top - h - f.y, -4, 4); }
// a boss holds a player (a beam, jaws): no input, no hits on them, no gravity; the boss's move carries them (bossCarry) until bossLet
function bossHold(g, f, o) {
  o.held = f.slot; o.move = null; o.mid = null; o.ledge = 0; o.link = 0; o.chg = 0; o.ff = false;
  setState(o, "hitstun"); o.hitstun = 999; o.tumble = false;
  o.vx = o.vy = o.kbx = o.kby = 0; o.grounded = false; o.plat = -1;
  o.lastHitBy = f; o.lastHitT = g.t;
  g.events.push({ type: "bossGrab", slot: f.slot, def: o.slot, mv: f.mid, x: o.x, y: o.y });
}
function bossCarry(o, x, y, kx, ky) { o.x += (x - o.x) * kx; o.y += (y - o.y) * ky; o.vx = o.vy = o.kbx = o.kby = 0; }
// let go of everyone he holds: thrown with `hit` toward dir (a normal launch through applyHit), or dropped (no hit: a short tumble)
function bossLet(g, f, hit, dir) {
  for (const o of g.fighters) {
    if (o.held !== f.slot) continue;
    o.held = -1;
    if (hit) { g.events.push({ type: "bossThrow", slot: f.slot, def: o.slot, mv: f.mid, x: o.x, y: o.y, dir }); applyHit(g, { att: f, def: o, hit, lx: dir * f.facing * 10, bx: o.x, by: o.y - o.s.h * 0.5 }); }
    else { o.hitstun = 18; o.invuln = Math.max(o.invuln, 30); }
  }
}
// thrown by the boss at a set speed (Abduct: at the partner): T = { vx, vy, dmg, stun }
function bossThrow(g, f, o, dir, T) {
  o.held = -1;
  o.percent = Math.min(999, o.percent + T.dmg); f.dmgDealt += T.dmg; ultGain(o, T.dmg * TUNE.ultTaken);
  setState(o, "hitstun"); o.hitstun = T.stun; o.tumble = true; o.grounded = false; o.plat = -1;
  o.vx = o.vy = 0; o.kbx = dir * T.vx; o.kby = T.vy;
  o.lastHitBy = f; o.lastHitT = g.t; o.flash = 8; o.recUsed = false; o.airDodged = false; if (o.airJumps < 1) o.airJumps = 1;
  g.hitstop = Math.max(g.hitstop, 6);
  g.events.push({ type: "bossThrow", slot: f.slot, def: o.slot, mv: f.mid, x: o.x, y: o.y, dir });
  g.events.push({ type: "hit", x: o.x, y: o.y - o.s.h * 0.5, dmg: T.dmg, kb: 8, dirx: dir, diry: -0.35, slot: f.slot, def: o.slot, pal: f.pal, fire: false, combo: 1, comboDmg: T.dmg, finisher: false, ps: null, mv: f.mid, fin: false, chg: 0, link: false, lk: false, mi: f.moveT, ult: false });
}

// the end: launched out of the arena; decided at the hit like a final lethal launch, so the KO page plays from it
function bossDown(g, att, def, h, mv, hdir, ex, ey) {
  const tr = trig(50), dx = tr[0] * hdir, dy = -tr[1], kb = 46;
  bossLet(g, def, null);
  def.doomed = true; def.stocks = 0; def.falls++; att.kos++;
  def.move = null; def.mid = null; def.poise = 0;
  setState(def, "hitstun");
  def.hitstun = 999; def.tumble = true; def.grounded = false; def.y -= 1;
  def.vx = 0; def.vy = 0; def.kbx = dx * kb; def.kby = dy * kb;
  def.lastHitBy = att; def.lastHitT = g.t; def.flash = 8;
  g.hitstop = Math.max(g.hitstop, TUNE.finishStop);
  g.events.push({ type: "hit", x: ex, y: ey, dmg: 0, kb, dirx: dx, diry: dy, slot: att.slot, def: def.slot, pal: att.pal, fire: !!h.hit.fire, combo: 0, comboDmg: 0, finisher: true, ps: h.proj ? h.proj.style : null, mv, fin: false, chg: 0, link: false, lk: false, mi: h.proj ? -1 : att.moveT, ult: mv === "ulti", boss: true, down: true });
  g.events.push({ type: "lethal", slot: def.slot, by: att.slot, final: true, mv, fin: false, chg: 0, kb, dirx: dx, diry: dy, x: def.x, y: def.y, boss: true });
  endGame(g, att.team, "boss", true);
}

/* ---------- KO at the hit ----------
   After a launching hit the next lookFrames frames are played on a scratch copy with the defender trying
   four escapes (steer home and recover; steer up; air dodge home; ride the launch out, then recover) and the
   attacker idle. Only when every escape still ends at a blast line is the hit lethal. Lethal on the last life
   decides the match right there: the loser is "doomed" (no more input or hits) and the KO finisher can play
   from the hit itself. */
function escapeInput(f, t, kind) {
  const i = blankInput();
  const home = f.x > 0 ? -1 : 1;
  if (f.state === "hitstun") { if (kind !== 3) { i.x = home; if (kind === 1) i.y = -1; } return i; }
  if (f.grounded || f.state === "ledge") return i;
  i.x = home;
  if (kind === 2 && !f.airDodged && f.state === "air") { if (t & 1) { i.dodge = true; i.y = -0.5; } return i; }
  if (kind === 3 && dist(f.kbx, f.kby) > 0.5) return i;
  if (f.state === "air") {
    if (f.airJumps > 0 && f.vy > -2 && (t & 1)) i.jump = true;
    else if (f.airJumps === 0 && !f.recUsed && (t & 1)) { i.heavy = true; i.y = -1; }
  }
  return i;
}
function lethal(g, slot) {
  const snap = serialize(g);
  for (let kind = 0; kind < 4; kind++) {
    const h = newGame({ players: g.fighters.map((f) => ({ spec: f.spec, pal: f.pal, team: f.team })), seed: 1, stocks: g.stocks, countdown: 0, map: g.map, level: g.lv });
    restore(h, snap);
    // projectiles still in the air stay in the look-ahead (a Meteor Shower star or a flame puff still coming is part of the call)
    h.look = true; h.timed = false;
    let died = false;
    for (let t = 0; t < TUNE.lookFrames && !died; t++) {
      const ins = h.fighters.map(() => blankInput());
      ins[slot] = escapeInput(h.fighters[slot], t, kind);
      step(h, ins);
      for (const e of h.events) if (e.type === "ko" && e.slot === slot) died = true;
      h.events.length = 0;
      const f = h.fighters[slot];
      if (!died && (f.grounded || f.state === "ledge") && f.state !== "hitstun") return false;
    }
    if (!died) return false;
  }
  return true;
}
function checkLethal(g, L) {
  const { att, def } = L;
  if (def.state !== "hitstun" || def.doomed || att.state === "dead" || att.state === "gone") return;
  if (!lethal(g, def.slot)) return;
  // the last life of the last one standing on that team
  const final = def.stocks === 1 && g.phase === "play" && g.fighters.every((o) => o === def || o.team !== def.team || o.state === "gone");
  g.events.push({ type: "lethal", slot: def.slot, by: att.slot, final, mv: L.mv, fin: L.fin, chg: L.chg, kb: L.kb, dirx: L.dirx, diry: L.diry, x: def.x, y: def.y });
  if (!final) return;
  // the match is decided at the hit: count the KO now; the launch plays out and the blast line only removes the loser
  def.doomed = true;
  def.stocks = 0; def.falls++; att.kos++;
  endGame(g, att.team, "stocks", true);
}

/* ---------- 2v2: the Catch ---------- */
// A fighter free to act (standing, running or in the air) that touches a teammate tumbling from a launch ends that launch: the
// teammate's hitstun is over and every speed halves (no free invincibility: they can be hit again at once). Not on the final launch
// (the match is decided at that hit), not in its first catchAfter frames (a hit in a crowd still sends you), one per catchCd frames.
function catches(g) {
  const P = TUNE.catchPad;
  for (const c of g.fighters) {
    if (c.catchCd > 0 || !canAct(c) || c.held >= 0) continue;
    const a = hurt(c);
    for (const t of g.fighters) {
      if (t === c || t.team !== c.team || t.state !== "hitstun" || !t.tumble || t.doomed || t.held >= 0 || t.st < TUNE.catchAfter || Math.hypot(t.kbx, t.kby) < TUNE.catchKb) continue;
      const b = hurt(t);
      if (a.x2 + P < b.x1 || b.x2 + P < a.x1 || a.y2 + P < b.y1 || b.y2 + P < a.y1) continue;
      const k = TUNE.catchSlow;
      t.hitstun = 0; t.tumble = false; t.vx *= k; t.vy *= k; t.kbx *= k; t.kby *= k;
      setState(t, t.grounded ? "idle" : "air"); endLaunch(t);
      c.catchCd = TUNE.catchCd;
      ultGain(c, TUNE.catchUlt); ultGain(t, TUNE.catchUlt);
      g.events.push({ type: "catch", slot: t.slot, by: c.slot, x: (c.x + t.x) / 2, y: Math.min(c.y, t.y) - 30 });
      break;
    }
  }
}

/* ---------- KO / match end ---------- */
function checkBlast(g, f) {
  if (f.state === "dead" || f.state === "gone") return;
  const B = STAGE.blast;
  if (f.x < B.left || f.x > B.right || f.y > B.bottom) return ko(g, f);
  if (f.y - f.s.h < B.top) {
    // the top line only takes a life when a hit carried you there; jumping and recovering just bump a ceiling
    if (f.state === "hitstun" || f.kby < 0) return ko(g, f);
    f.y = B.top + f.s.h;
    if (f.vy < 0) f.vy = 0;
  }
}
function ko(g, f) {
  if (f.doomed) {
    g.events.push({ type: "ko", x: f.x, y: f.y, slot: f.slot, pal: f.pal, sd: false, doomed: true });
    Object.assign(f, { vx: 0, vy: 0, kbx: 0, kby: 0, move: null, mid: null, hitstun: 0, tumble: false, ledge: 0 });
    setState(f, "gone");
    return;
  }
  f.stocks--; f.falls++;
  ultGain(f, TUNE.ultHeart);
  const killer = f.lastHitBy && f.lastHitBy !== f && g.t - f.lastHitT < 480 ? f.lastHitBy : null;
  if (killer) killer.kos++; else f.sds++;
  g.events.push({ type: "ko", x: f.x, y: f.y, slot: f.slot, pal: f.pal, sd: !killer });
  g.hitstop = Math.max(g.hitstop, 6);
  Object.assign(f, { vx: 0, vy: 0, kbx: 0, kby: 0, move: null, mid: null, hitstun: 0, percent: 0, tumble: false, ledge: 0, lastHitBy: null, strLaunched: false, chg: 0, link: 0, lk: false, ultTgt: -1 });
  g.projs = g.projs.filter((p) => p.owner !== f.slot);
  if (f.stocks <= 0) {
    setState(f, "gone");
    // the team is out when all of it is gone
    if (g.fighters.every((o) => o.team !== f.team || o.state === "gone")) {
      const other = g.fighters.find((o) => o.team !== f.team && o.state !== "gone");
      endGame(g, other ? other.team : -1, "stocks");
    }
  } else { setState(f, "dead"); f.dead = 70; }
}
function respawn(g, f) {
  // 2v2: over your team's side (the second of a team a little further out); otherwise slot 0 left, everyone else right
  if (teamGame(g)) { const k = g.fighters.filter((o) => o.team === f.team && o.slot < f.slot).length; f.x = (f.team ? 1 : -1) * (70 + 60 * k); }
  else f.x = f.slot === 0 ? -70 : 70;
  f.y = STAGE.respawnY;
  f.vx = f.vy = f.kbx = f.kby = 0; f.grounded = false; f.plat = -1;
  setState(f, "respawn");
  f.percent = f.lifePct; f.airJumps = f.s.airJumps; f.recUsed = false; f.airDodged = false; f.ff = false;
  f.facing = teamGame(g) ? (f.team ? -1 : 1) : f.slot === 0 ? 1 : -1; f.move = null; f.specCd = 0;
}
function endGame(g, winner, reason, hit) {
  if (g.phase === "end" || g.phase === "over") return;
  g.phase = "end"; g.winner = winner; g.endT = 0; g.endReason = reason;
  g.events.push({ type: "game", winner, hit: !!hit });
}
function endByTime(g) {
  // a boss fight that runs out of time is the boss's
  const boss = g.fighters.find((f) => f.spec.boss);
  if (boss) return endGame(g, boss.team, "time");
  if (teamGame(g)) {
    // 2v2: the team with more hearts left wins; a tie goes to sudden death, and sudden death running out is a draw
    if (g.sudden) return endGame(g, -1, "time");
    const h = [0, 1].map((t) => g.fighters.reduce((n, f) => n + (f.team === t ? Math.max(0, f.stocks) : 0), 0));
    if (h[0] !== h[1]) return endGame(g, h[0] > h[1] ? 0 : 1, "time");
    return startSudden(g);
  }
  const [a, b] = g.fighters;
  if (a.stocks !== b.stocks) return endGame(g, a.stocks > b.stocks ? 0 : 1, "time");
  if (g.sudden) return endGame(g, -1, "time"); // sudden death ran out too: draw
  startSudden(g);
}
// Equal stocks when time runs out: one life each at 150%, next KO wins.
function startSudden(g) {
  g.sudden = true; g.timer = TUNE.suddenTime; g.projs = []; g.hitstop = 0;
  const tg = teamGame(g);
  g.fighters.forEach((f, i) => {
    // 2v2: everyone still in the match, on their team's spots; a fighter already out stays out
    if (tg && f.state === "gone") return;
    const sp = tg ? teamSpot(f.team, g.fighters.filter((o) => o.team === f.team && o.slot < f.slot && o.state !== "gone").length) : STAGE.spawns[i];
    Object.assign(f, {
      x: sp.x, y: STAGE.main.top, vx: 0, vy: 0, kbx: 0, kby: 0, facing: sp.f, grounded: true, plat: -1, move: null, mid: null,
      percent: 150, stocks: 1, hitstun: 0, tumble: false, ledge: 0, ledgeCd: 0, invuln: 90, specCd: 0, airJumps: f.s.airJumps,
      recUsed: false, airDodged: false, ff: false, strN: 0, strLaunched: false, combo: 0, freeT: 99, techT: 0, lastHitBy: null, dead: 0, link: 0, lk: false,
      chg: 0, doomed: false, ultTgt: -1,
    });
    setState(f, "idle");
  });
  g.events.push({ type: "sudden" });
}

/* ---------- Bot: drives the same virtual controller a human uses ---------- */
/* Fighting styles: a few numbers that bias the decisions in botInput (not a second brain). BOT_NEUTRAL is what every number
   means when it is left out, and it is exactly the old bot: makeBot(level) with no style plays input for input as before.
   Offline only (tutorial, ranked, practice, tournament, attract), so none of this touches the online protocol. */
const BOT_NEUTRAL = {
  gap: 1,        // preferred distance, times the old walk-in distance
  back: 0,       // steps back when closer than this share of the preferred distance (0 = never)
  shuffle: 0.3,  // chance per decision to step back instead of holding still when in range
  rng: 0,        // starts a melee attack this many px further out
  poke: 0.55,    // chance that a ground light is a sideways tilt instead of a jab
  atk: 1,        // melee attack rate, times
  heavy: 1,      // heavy rate, times
  charge: 0.3,   // chance that a heavy is charged
  spec: 1,       // special rate, times
  air: 0,        // chance per decision to take to the air near the opponent (and to jump again to stay up)
  edge: 0,       // chance per decision to jump out after an opponent knocked past the ledge and swing at them
};
// by fighter id; tests/botstyle.js keeps each of them about as strong as the neutral bot
const BOT_STYLES = {
  samurai:   { gap: 0.4, shuffle: 0, spec: 1.3, atk: 0.8 },                            // rushes in
  alchemist: { gap: 1.6, back: 0.4, spec: 1.3, atk: 1.15, heavy: 1.25 },               // stays back and lobs
  odin:      { gap: 0.8, shuffle: 0, charge: 0.75, heavy: 2.5 },                       // walks forward, charges heavies
  phoenix:   { air: 0.35, atk: 1.25, heavy: 0.6 },                                     // fights from the air
  wizard:    { gap: 1.4, back: 0.4, rng: 10, poke: 0.8 },                              // pokes at staff range
  dragon:    { edge: 0.6 },                                                            // guards the edge
  gunslinger:{ gap: 1.2, back: 0.3, spec: 1.15, heavy: 1.1 },                          // keeps a mid distance, shoots often, hammers a finish-ready opponent
  reaper:    { gap: 1.35, rng: 14, shuffle: 0.2, charge: 0.4 },                        // stands at scythe range, charges the arc
};
function makeBot(level, style) {
  return { d: level, st: Object.assign({}, BOT_NEUTRAL, style), mem: [], think: 0, hold: { x: 0, y: 0 }, cool: 0, wasPress: false, ledgeWait: -1, chg: 0 };
}
function botInput(g, me, opp, bot) {
  const out = blankInput();
  if (bot.d < 0 || g.phase !== "play" || me.state === "dead" || me.state === "gone") return out;
  useStage(g);
  const d = bot.d, R = g.rng, S = STAGE.main, st = bot.st;
  // a boss is aimed at where he can be hit (his body, or the nearest resting tentacle); nothing to hit counts as gone
  const sp = opp.spec.boss ? bossSpot(g, opp, me) : null;
  bot.mem.push({
    x: sp ? sp.x : opp.x, y: sp ? sp.y : opp.y, st: opp.state, mv: opp.move, mt: opp.mt, pct: opp.percent,
    gone: opp.state === "dead" || opp.state === "gone" || opp.state === "respawn" || (!!opp.spec.boss && !sp.ok), inv: intangible(opp),
    // a boss target: 0 fighting, 1 staggered, 2 broken (-1 = not a boss)
    bs: opp.spec.boss ? (opp.state === "broken" ? 2 : opp.state === "stagger" ? 1 : 0) : -1,
    // where a boss's strike aimed at a spot on the floor is about to land (null = none)
    sx: opp.spec.boss && opp.state === "attack" && opp.move && opp.move.spot ? bossThreat(opp) : null,
  });
  const delay = Math.round(lerp(18, 4, d));
  while (bot.mem.length > delay + 1) bot.mem.shift();
  const o = bot.mem[0];
  if (bot.cool > 0) bot.cool--;
  // keep holding heavy while a charge is wanted (any interruption ends it)
  if (bot.chg > 0) {
    if (me.state === "attack" && me.move && me.move.charge) { bot.chg--; bot.wasPress = false; out.heavy = true; out.x = bot.hold.x; out.y = bot.hold.y; return out; }
    bot.chg = 0;
  }
  if (bot.wasPress) { bot.wasPress = false; out.x = bot.hold.x; out.y = bot.hold.y; return out; }
  const press = (k, x, y, cool) => {
    bot.hold.x = x; bot.hold.y = y; out.x = x; out.y = y; out[k] = true;
    bot.wasPress = true; bot.cool = cool ?? 4; return out;
  };

  if (me.state === "hitstun") {
    // steer the knockback upward (survives longer) and try to break the fall before landing on stage
    if (bot.hitT !== me.lastHitT) { bot.hitT = me.lastHitT; bot.diOn = R() < lerp(0.15, 0.85, d); bot.techOn = R() < lerp(0.1, 0.6, d); bot.teched = false; }
    // drift back toward the stage when knocked out past an edge or below the top, as before
    const outside = me.x < S.x1 + 20 || me.x > S.x2 - 20 || me.y > S.top + 2;
    if (outside) out.x = -sign(me.x) || 0;
    if (bot.diOn) { out.y = -1; if (!outside) out.x = 0; }
    const vyT = me.vy + me.kby;
    if (bot.techOn && !bot.teched && vyT > 1 && me.x > S.x1 - 10 && me.x < S.x2 + 10 && me.y > S.top - 60 && me.y < S.top + 2) { bot.teched = true; out.dodge = true; }
    bot.wasPress = false;
    return out;
  }
  if (me.state === "ledge") {
    if (bot.ledgeWait < 0) bot.ledgeWait = Math.round(lerp(45, 8, d) * (0.4 + R()));
    if (bot.ledgeWait-- > 0) return out;
    bot.ledgeWait = -1;
    if (R() < 0.45) return press("jump", 0, 0, 10);
    bot.hold.x = -me.ledge; bot.hold.y = 0; out.x = -me.ledge; return out;
  }
  bot.ledgeWait = -1;

  const off = !me.grounded && (me.x < S.x1 - 2 || me.x > S.x2 + 2 || me.y > S.top + 2);
  if (off) {
    const hw = me.s.w / 2, out_ = sign(me.x) || me.facing;
    const edgeX = out_ < 0 ? S.x1 : S.x2;
    // Below the stage's underside: get clear of the edge first, or the stage blocks the way up.
    const belowBottom = me.y - me.s.h > S.bottom - 6;
    let toward;
    if (belowBottom) {
      const tx = edgeX + out_ * (hw + 28);
      toward = Math.abs(tx - me.x) < 6 ? 0 : sign(tx - me.x);
    } else toward = -out_;
    bot.hold.x = toward; bot.hold.y = 0; out.x = toward;
    if (!canAct(me)) return out;
    if (st.edge && bot.cool <= 0 && !belowBottom && (Math.abs(o.x) > S.x2 || o.y > S.top + 40) && Math.abs(o.x - me.x) < hw + 64 && Math.abs(o.y - me.y) < 70) return press("light", sign(o.x - me.x), 0, 6);
    const vyT = me.vy + me.kby;
    const clear = (me.x - edgeX) * out_ > hw + 10;
    if (belowBottom && !clear) {
      if (bot.cool <= 0 && vyT > 5 && me.airJumps > 0 && me.y > S.bottom + 140) return press("jump", toward, 0, 16);
      return out;
    }
    const lowish = me.y > S.top - 40, far = Math.abs(me.x) > S.x2 + 140;
    if (bot.cool <= 0 && (lowish || far) && vyT > -1.5) {
      if (me.airJumps > 0) return press("jump", belowBottom ? 0 : toward, 0, 14);
      if (!me.recUsed && (me.y > S.top + 10 || far || vyT > 3)) return press("heavy", belowBottom ? 0 : toward * 0.5, -1, 20);
    }
    return out;
  }

  const dodgeHold = () => { out.x = bot.hold.x; out.y = bot.hold.y; avoidEdge(me, out); return out; };
  if (bot.think > 0) { bot.think--; return dodgeHold(); }
  bot.think = Math.round(lerp(12, 2, d) + R() * lerp(8, 3, d));
  bot.hold.x = 0; bot.hold.y = 0;
  // a boss's strike aimed at a spot on the floor (Kraken Spud's slams and Chomp): get out of it; his sweeps and waves: jump them
  if (canAct(me) && me.grounded && opp.spec.boss) {
    if (o.sx !== null && Math.abs(me.x - o.sx) < 100 && R() < lerp(0.25, 0.85, d)) {
      const away = sign(me.x - o.sx) || -sign(me.x) || 1;
      bot.hold.x = away; out.x = away; avoidEdge(me, out); return out;
    }
    for (const p of g.projs)
      if ((p.z === "laser" || p.z === "wave") && p.owner === opp.slot && sign(me.x - p.x) === sign(p.vx) && Math.abs(me.x - p.x) < 40 + Math.abs(p.vx) * 12 && R() < lerp(0.2, 0.8, d)) return press("jump", 0, 0, 14);
  }
  if (o.gone) {
    bot.hold.x = Math.abs(me.x) > 60 ? -sign(me.x) : 0;
    out.x = bot.hold.x; return out;
  }
  const dx = o.x - me.x, dy = o.y - me.y, adx = Math.abs(dx), sx = sign(dx) || me.facing;
  const reach = me.s.w / 2 + 34;
  const act = canAct(me);

  // the opponent's ulti: jump the low ones, step away from the clouds and stars
  if (act && bot.cool <= 0 && o.st === "attack" && o.mv && o.mv.ult && (o.mv.ult !== "dive" || o.mt > 24) && R() < lerp(0.08, 0.6, d)) {
    const uk = o.mv.ult;
    if (uk === "cloud" || uk === "stars") { bot.hold.x = -sx; out.x = -sx; avoidEdge(me, out); return out; }
    if (me.grounded) return press("jump", uk === "harvest" ? -sx : 0, 0, 14);
  }
  // our ulti: when the bar is full, the opponent is in its reach and near KO (or time is running out)
  if (act && bot.cool <= 0 && !o.inv && ultReady(g, me)) {
    const uk = me.spec.moves.ulti.ult, ady = Math.abs(dy), onStage = Math.abs(o.x) < S.x2 && o.y <= S.top + 2 && o.y > S.top - 140;
    const fits = uk === "dive" || uk === "stars" ? onStage
      : uk === "cloud" ? adx < 150 && ady < 60
      : uk === "spear" ? adx < 520 && ady < 24
      : uk === "cuts" ? adx > 30 && adx < 230 && ady < 30 && Math.abs(me.x + sx * 270) < S.x2
      : uk === "hellfire" ? adx < 380 && ady < 40
      : uk === "deadeye" ? adx < 520 && ady < 50
      : adx < 320 && ady < 60;
    const late = g.timed && g.timer < 40 * 60 && o.pct > 40;
    if (fits && (o.pct >= lerp(150, 105, d) || late || o.bs >= 0) && R() < lerp(0.08, 0.35, d)) return press("ulti", sx, 0, 20);
  }
  // a boss's long wind-ups: dodge late, when the hit is about to come (and from further away: his reach is long)
  const bw = o.mv && o.mv.boss ? o.mt >= o.mv.startup - 10 && adx < 260 : adx < 120;
  if (act && bot.cool <= 0 && o.st === "attack" && o.mv && o.mt <= o.mv.startup && bw && Math.abs(dy) < 100 && R() < lerp(0.04, 0.5, d)) {
    return press("dodge", me.grounded && R() < 0.6 ? -sx : 0, 0, 20);
  }
  if (act && bot.cool <= 0 && !o.inv) {
    const k = me.spec.moves.spec.kind;
    if (me.specCd <= 0) {
      // finish-ready opponent: go for the special more often and from further away
      const fr = o.pct >= TUNE.finishPct, spx = fr ? 2 : 1;
      const short = k === "projectile" && me.spec.moves.spec.proj.short;
      if (short && adx < 115 && Math.abs(dy) < 40 && R() < lerp(0.15, 0.5, d) * spx * st.spec) return press("special", sx, 0, 10);
      if (k === "projectile" && !short && adx > (fr ? 80 : 110) && adx < (fr ? 340 : 300) && Math.abs(dy) < 50 && R() < lerp(0.15, 0.5, d) * spx * st.spec) return press("special", sx, 0, 10);
      const dashEnd = me.x + sx * 200;
      if (k === "dash" && adx > 70 && adx < 230 && Math.abs(dy) < 36 && dashEnd > S.x1 && dashEnd < S.x2 && R() < lerp(0.1, 0.4, d) * spx * st.spec) return press("special", sx, 0, 12);
      if (k === "charge" && adx < reach + 40 && Math.abs(dy) < 40 && R() < lerp(0.08, 0.3, d) * st.spec) return press("special", sx, 0, 12);
    }
    if (adx < reach + 18 + st.rng && Math.abs(dy) < 56 && R() < lerp(0.3, 0.9, d) * st.atk) {
      if (me.grounded) {
        const killPct = lerp(150, 95, d) * (100 / me.s.weight);
        if ((o.pct > killPct && R() < 0.65) || R() < 0.12 * st.heavy || o.bs >= 1) {
          // sometimes charge: weak bots too long (easy to punish), strong bots a short top-up
          if (R() < st.charge) bot.chg = Math.round(lerp(40, 8, d) + R() * lerp(20, 12, d));
          return press("heavy", sx, R() < 0.2 ? 1 : 0, 10);
        }
        const r = R();
        return press("light", r < st.poke ? sx : 0, r > 0.85 ? 1 : 0, 6);
      }
      if (dy < -26) return press("light", 0, -1, 6);
      if (dy > 26) return press(o.pct > 90 && R() < 0.4 ? "heavy" : "light", 0, 1, 6);
      return press(R() < 0.3 && o.pct > 80 ? "heavy" : "light", sx, 0, 6);
    }
    if (adx < 70 && dy < -50 && dy > -150) {
      if (me.grounded) return R() < 0.5 ? press("light", 0, -1, 8) : o.pct > 90 ? press("heavy", 0, -1, 10) : press("jump", 0, 0, 10);
      return press("light", 0, -1, 8);
    }
    if (me.grounded && dy < -80 && adx < 160 && R() < 0.6) return press("jump", sx, 0, 12);
  }
  // air style: take off near the opponent, and jump again to stay up
  if (st.air && act && bot.cool <= 0 && adx < 260) {
    if (me.grounded && R() < st.air) return press("jump", sx, 0, 12);
    if (!me.grounded && me.airJumps > 0 && me.vy > 0 && dy < 40 && R() < st.air) return press("jump", sx, 0, 14);
  }
  // edge style: an opponent knocked out past the ledge is followed out (the off-stage code below swings at them in reach)
  if (st.edge && act && bot.cool <= 0 && me.grounded && me.plat < 0 && o.pct > 60 && Math.abs(o.x) > S.x2 && Math.abs(o.x) < S.x2 + 170 && Math.abs(o.y - me.y) < 130 &&
      Math.abs(me.x - sign(o.x) * S.x2) < 70 && R() < st.edge) return press("jump", sign(o.x), 0, 14);
  const want = reach * 0.8 * st.gap;
  let hx = adx > want ? sx : R() < st.shuffle ? -sx : 0;
  if (st.back && adx < want * st.back) hx = sign(me.x) === -sx && Math.abs(me.x) > S.x2 - 80 ? 0 : -sx;   // keeps its distance unless cornered
  let hy = 0;
  if (me.grounded && me.plat >= 0 && dy > 50) hy = 1;
  // hold up while the opponent swings nearby: steers a launch upward if it connects
  if (!hy && o.st === "attack" && adx < 140 && Math.abs(dy) < 120 && R() < lerp(0.1, 0.7, d)) hy = -1;
  bot.hold.x = hx; bot.hold.y = hy;
  out.x = hx; out.y = hy; avoidEdge(me, out);
  return out;
}
function avoidEdge(me, out) {
  const S = STAGE.main;
  if (me.grounded && me.plat < 0 && ((me.x < S.x1 + 30 && out.x < 0) || (me.x > S.x2 - 30 && out.x > 0))) out.x = 0;
}

/* ---------- 2v2 CPUs (offline, like botInput: the UI and the tests call it, a step never does) ----------
   teamBotInput picks the opponent botInput plays against and adds what a teammate does: run under a tumbling partner to catch them.
   On the bot: tgt / tgtT = the slot it is on and the frame it may switch; focus / focusT = a foe forced until that frame (the
   player's Focus command for a partner); catchFor / catchOn = the launch it decided on and whether it goes for the Catch. */
function teamTarget(g, me, bot) {
  const up = (o) => !!o && o.team !== me.team && o.state !== "gone" && o.state !== "dead" && o.state !== "respawn";
  const on = (o, hold) => { if (bot.tgt !== o.slot) { bot.tgt = o.slot; bot.mem.length = 0; } if (hold) bot.tgtT = g.t + hold; return o; };
  if (!g.fighters.some(up)) return g.fighters.find((o) => o.team !== me.team && o.state !== "gone") || null;
  if (bot.focusT > g.t && up(g.fighters[bot.focus])) return on(g.fighters[bot.focus], 0);
  // whoever is hitting my partner right now
  for (const m of g.fighters) if (m !== me && m.team === me.team && m.state === "hitstun" && up(m.lastHitBy) && g.t - m.lastHitT < 30) return on(m.lastHitBy, 45);
  const cur = g.fighters[bot.tgt];
  if (up(cur) && g.t < bot.tgtT) return cur;
  // a foe at finish percent while my special is ready, else the nearest (a little stickiness so it doesn't flip every frame)
  let best = null, bd = Infinity;
  for (const o of g.fighters) {
    if (!up(o)) continue;
    const d = Math.abs(o.x - me.x) + Math.abs(o.y - me.y) * 0.5 - (me.specCd <= 0 && o.percent >= TUNE.finishPct ? 200 : 0) - (o === cur ? 60 : 0);
    if (d < bd) { bd = d; best = o; }
  }
  return on(best, 40);
}
function teamBotInput(g, me, bot) {
  const opp = teamTarget(g, me, bot);
  if (!opp) return blankInput();
  const out = botInput(g, me, opp, bot);
  if (g.phase !== "play" || me.catchCd > 0 || !canAct(me)) return out;
  // a teammate tumbling from a launch: go under where it is heading and catch it (decided once per launch, more often the stronger the CPU)
  const S = STAGE.main;
  for (const t of g.fighters) {
    if (t === me || t.team !== me.team || t.state !== "hitstun" || !t.tumble || t.doomed) continue;
    if (bot.catchFor !== t.lastHitT) { bot.catchFor = t.lastHitT; bot.catchOn = g.rng() < lerp(0.25, 0.85, bot.d); }
    if (!bot.catchOn) continue;
    const tx = t.x + (t.vx + t.kbx) * 10, ty = t.y + (t.vy + t.kby) * 10, dx = tx - me.x;
    if (Math.abs(dx) > 280 || tx < S.x1 - 40 || tx > S.x2 + 40 || ty > S.top + 40) continue;
    Object.assign(out, { light: false, heavy: false, special: false, dodge: false, ulti: false, y: 0 });
    out.x = Math.abs(dx) > 12 ? sign(dx) : 0;
    out.jump = me.grounded && ty < me.y - 70 && Math.abs(dx) < 140;
    avoidEdge(me, out);
    return out;
  }
  return out;
}

/* ---------- snapshots for online desync recovery ---------- */
const FKEYS = ["x", "y", "vx", "vy", "kbx", "kby", "facing", "grounded", "plat", "state", "st", "mid", "mt", "poundT",
  "airJumps", "airDodged", "ff", "dropT", "downHold", "dodgeKind", "dodgeDir", "landT", "percent", "stocks", "invuln",
  "hitstun", "tumble", "specCd", "recUsed", "ledge", "ledgeCd", "ledgeInv", "flash", "armorFlash", "dead",
  "inp", "prevInp", "buf", "kos", "dmgDealt", "falls", "sds", "lastHitT",
  "freeT", "strN", "strBy", "strMv", "strLaunched", "combo", "comboDmg", "comboBy", "moveT", "techT", "techLock", "techDir",
  "chg", "doomed", "finShot", "link", "lk", "ult", "ultN", "ultX", "ultTgt", "team", "hp", "hpMax", "poise", "stag", "bq", "bt", "aim", "lifePct", "ph", "held", "bx", "bk", "catchCd"];
const PKEYS = ["owner", "x", "y", "dir", "vx", "vy", "grav", "boomer", "style", "speed", "r", "life", "t", "hit", "burst", "pulse", "last", "part", "z", "w", "pass"];
const copy = (v) => (v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v);
function serialize(g) {
  return {
    g: [g.t, g.phase, g.cd, g.hitstop, g.timer, g.winner, g.endT, g.endReason, g.timed, g.sudden, g.br],
    f: g.fighters.map((f) => [
      ...FKEYS.map((k) => copy(f[k])),
      f.lastHitBy ? f.lastHitBy.slot : -1,
      g.fighters.map((o, i) => (f.hitLog[i] === undefined ? null : f.hitLog[i])),
    ]),
    p: g.projs.map((p) => PKEYS.map((k) => copy(p[k]))),
  };
}
function restore(g, s) {
  [g.t, g.phase, g.cd, g.hitstop, g.timer, g.winner, g.endT, g.endReason, g.timed, g.sudden, g.br] = s.g;
  g.fighters.forEach((f, i) => {
    const a = s.f[i];
    FKEYS.forEach((k, j) => { f[k] = copy(a[j]); });
    f.move = f.mid ? f.spec.moves[f.mid] : null;
    const lh = a[FKEYS.length];
    f.lastHitBy = lh >= 0 ? g.fighters[lh] : null;
    f.hitLog = {};
    a[FKEYS.length + 1].forEach((v, k) => { if (v !== null) f.hitLog[k] = v; });
  });
  g.projs = s.p.map((a) => {
    const p = {};
    PKEYS.forEach((k, j) => { p[k] = copy(a[j]); });
    p.pal = g.fighters[p.owner].pal;
    return p;
  });
  g.events.length = 0;
}
function checksum(g) {
  let h = 2166136261;
  const mix = (v) => { const t = String(v); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } };
  mix(g.t); mix(g.phase); mix(g.timer); mix(g.sudden); mix(g.map); mix(g.br);
  for (const f of g.fighters) for (const k of ["x", "y", "vx", "vy", "kbx", "kby", "percent", "stocks", "state", "st", "mt", "facing", "specCd", "invuln", "airJumps", "strN", "strLaunched", "techT", "chg", "doomed", "finShot", "link", "lk", "ult", "ultN", "ultX", "ultTgt", "team", "hp", "poise", "stag", "bt", "aim", "lifePct", "ph", "held", "bx", "bk", "catchCd"]) mix(f[k]);
  for (const p of g.projs) { mix(p.x); mix(p.y); mix(p.t); }
  return h >>> 0;
}

root.BL = { teamGame, teamBotInput, ultReady, ultNeed, serialize, restore, checksum, STAGE, MAPS, POOL, useStage, FIGHTERS, BOSSES, TUNE, newGame, step, makeBot, botInput, BOT_STYLES, canAct, intangible, armored, activeBoxes, knockback, blankInput, clamp, lerp, sign };
})(typeof module !== "undefined" ? module.exports : window);
