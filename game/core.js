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
  ultDealt: 1,
  ultTaken: 0.5,
  ultHeart: 10,
  ultFreeze: 30,
};
const LIGHT = new Set(["jab", "side", "up", "down", "nair", "sair", "uair", "dair"]);

const STAGE = {
  main: { x1: -330, x2: 330, top: 0, bottom: 64 },
  plats: [
    { x1: -250, x2: -110, y: -125 },
    { x1: 110, x2: 250, y: -125 },
    { x1: -70, x2: 70, y: -245 },
  ],
  blast: { left: -760, right: 760, top: -650, bottom: 460 },
  spawns: [{ x: -170, f: 1 }, { x: 170, f: -1 }],
  respawnY: -330,
};

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
      { name: "Verdant", price: 120, body: "#e9c070", trim: "#1f1d26", accent: "#47c96a", ui: "#5fd67f" },
      { name: "Solar", price: 200, body: "#f6d27a", trim: "#1f1d26", accent: "#ffc21f", ui: "#ffd23f" },
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
      ulti:  M(60, 6, 34, 26, 8, 15, 82, [[0, -16, 40], [-52, -10, 24], [52, -10, 24]], { limb: "body", ult: "dive", inv: [1, 60], armor: [1, 60] }),
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
      { name: "Midnight", price: 120, body: "#d99a48", trim: "#1f1d26", accent: "#2f4a8a", ui: "#5b82d6" },
      { name: "Bone", price: 200, body: "#e8b25c", trim: "#1f1d26", accent: "#d9d2c0", ui: "#e6dfcc" },
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
      { name: "Gold", price: 120, body: "#e0a050", trim: "#1f1d26", accent: "#d9a531", ui: "#f0c35a" },
      { name: "Shadow", price: 200, body: "#d9984a", trim: "#1f1d26", accent: "#4b4b5a", ui: "#9aa0b8" },
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
      { name: "Forest", price: 120, body: "#eba84a", trim: "#1f1d26", accent: "#2f6b45", ui: "#57c27e" },
      { name: "Crimson", price: 200, body: "#f0b85a", trim: "#1f1d26", accent: "#8a2b35", ui: "#e05a68" },
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
      { name: "Blood Moon", price: 120, body: "#d29a58", trim: "#1f1d26", accent: "#e0443a", ui: "#ef5a4f" },
      { name: "Violet", price: 200, body: "#dcac68", trim: "#1f1d26", accent: "#9b6bff", ui: "#b08aff" },
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
      { name: "Obsidian", price: 120, body: "#e6a250", trim: "#1f1d26", accent: "#4b3d6e", ui: "#8f7bd0" },
      { name: "Inferno", price: 200, body: "#f0b262", trim: "#1f1d26", accent: "#d63c2c", ui: "#f05a48" },
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
      ulti:  M(24, 42, 34, 4, 3, 1, 25, [[60, -46, 34], [130, -46, 38], [210, -46, 40], [290, -46, 40], [370, -46, 38]],
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
      { name: "Sheriff", price: 120, body: "#ebb46a", trim: "#1f1d26", accent: "#e6dfcd", ui: "#8fc0ea" },
      { name: "Gold Rush", price: 200, body: "#efb866", trim: "#1f1d26", accent: "#d4a02c", ui: "#f2c94c" },
    ],
    moves: {
      jab:   M(3, 3, 9,   3, 4, 2, 40, [28, -36, 16], { limb: "arm" }),
      side:  M(6, 4, 13,  7, 4.5, 9, 32, [36, -32, 19], { limb: "arm" }),
      up:    M(5, 5, 12,  6, 5, 8, 86, [16, -70, 20, -16, -72], { limb: "arm" }),
      down:  M(5, 3, 11,  5, 4, 7, 18, [32, -6, 16], { limb: "leg" }),
      // Fan the hammer: a point-blank blast that kicks him back in a small hop
      hSide: M(13, 4, 24, 15, 7, 20, 34, [36, -38, 21, 56, -36], { limb: "arm", impulse: [-5, -3] }),
      hUp:   M(11, 6, 22, 13, 7, 18, 88, [10, -88, 26], { limb: "arm" }),
      hDown: M(11, 4, 24, 12, 6.5, 16, 25, [[38, -10, 19], [-38, -10, 19]], { limb: "arm" }),
      nair:  M(4, 7, 10,  7, 4.5, 8, 45, [0, -32, 30], { limb: "body", landLag: 6 }),
      sair:  M(6, 4, 14,  8, 5, 12, 40, [36, -32, 19], { limb: "arm", landLag: 8 }),
      uair:  M(5, 5, 12,  7, 5, 12, 82, [14, -70, 21, -14, -70], { limb: "arm", landLag: 7 }),
      dair:  M(9, 5, 16,  9, 5, 10, -65, [4, 0, 19], { limb: "leg", landLag: 11 }),
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
      { name: "Ember Wake", price: 120, body: "#dfa456", trim: "#1f1d26", accent: "#3a3440", ui: "#f08a3c" },
      { name: "Bone", price: 200, body: "#e8b466", trim: "#1f1d26", accent: "#e9e4d6", ui: "#f0ece0" },
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
for (const f of FIGHTERS) for (const k of AIR_MOVES) { f.moves[k].air = true; if (f.moves[k].landLag == null) f.moves[k].landLag = 6; }
for (const f of FIGHTERS) for (const k of ["hSide", "hUp", "hDown"]) f.moves[k].charge = true;

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
    anim: { run: 0 },
  };
}

function newGame(o) {
  const g = {
    t: 0, phase: "countdown", cd: o.countdown ?? 150, hitstop: 0, timer: (o.time ?? 240) * 60, timed: (o.time ?? 240) > 0, sudden: false,
    fighters: [], projs: [], events: [], winner: -1, endT: 0, endReason: "",
    rng: mulberry32(o.seed ?? ((Math.random() * 1e9) | 0)), stocks: o.stocks ?? 3,
  };
  o.players.forEach((p, i) => {
    const sp = STAGE.spawns[i];
    const f = newFighter(p.spec, i, p.pal, sp.x, sp.f);
    f.stocks = g.stocks;
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
  if (f.invuln > 0 || f.doomed) return true;
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
function circRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x1, b.x2), ny = clamp(cy, b.y1, b.y2);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/* ---------- main step ---------- */
function step(g, inputs) {
  if (g.phase === "over") return;
  const live = g.phase === "play";
  const frozen = g.hitstop > 0;
  // Inputs are read even during hitstop so presses made in the freeze are buffered, not lost.
  g.fighters.forEach((f, i) => readInput(f, live && f.state !== "dead" ? inputs[i] || blankInput() : blankInput(), frozen));
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

  switch (f.state) {
    case "respawn": {
      const b = f.buf, i = f.inp;
      const anyIn = Math.abs(i.x) > 0.3 || i.y > 0.5 || b.jump || b.light || b.heavy || b.special || b.dodge;
      if (f.st > 150 || (f.st > 20 && anyIn)) { setState(f, "air"); f.invuln = 100; }
      return;
    }
    case "ledge": updateLedge(g, f); return;
    case "idle": case "run": case "air": actOrMove(g, f); break;
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
const foe = (g, f) => g.fighters.find((o) => o !== f && o.state !== "gone");
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
      if (t.state === "hitstun" && !t.doomed) applyHit(g, { att: f, def: t, hit: Object.assign({ ult: true }, m.cut), lx: 0, bx: t.x, by: t.y - t.s.h * 0.5 });
    }
    return false;
  }
  if (k === "harvest" && mt >= m.pull[0] && mt <= m.pull[1]) {
    // the tug: strong on the ground, weak in the air; it stops close to him
    for (const o of g.fighters) {
      if (o === f || intangible(o) || o.state === "ledge" || o.state === "dead" || o.state === "gone") continue;
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
  if (key === "spec") f.finShot = !!(m.proj && m.proj.finCount && g.fighters.some((o) => o !== f && o.percent >= TUNE.finishPct));
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
    else if (down && f.dropT <= 0) {
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
  if (f.ledgeCd > 0 || f.vy + f.kby < 0) return;
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
    if (p.boomer) {
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
    if (p.t >= p.life) p.done = true;
    if (p.style !== "burst" && !p.pulse && p.x > S.x1 && p.x < S.x2 && p.y > S.top - (p.boomer ? -4 : 2) && p.y < S.bottom) {
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
      if (def === att || intangible(def)) continue;
      const mv = att.move, last = att.hitLog[def.slot];
      // a move with a `last` block hits once more with those numbers from its frame `from`
      const blast = mv.last && att.mt >= mv.last.from;
      if (last !== undefined && !(mv.multi && att.mt - last >= mv.multi) && !(blast && last < mv.last.from)) continue;
      const r = hurt(def);
      for (const b of boxes) {
        if (circRect(b.x, b.y, b.r, r)) { hits.push({ att, def, hit: blast ? Object.assign({}, mv, mv.last) : mv, lx: b.lx, bx: b.x, by: b.y }); break; }
      }
    }
  }
  for (const p of g.projs) {
    if (p.done) continue;
    // a pulsing cloud only hurts on its pulses, stays after a hit, and its last pulse uses the `last` numbers
    if (p.pulse && p.t % p.pulse !== 0) continue;
    for (const def of g.fighters) {
      if (def.slot === p.owner || intangible(def)) continue;
      if (circRect(p.x, p.y, p.r, hurt(def))) {
        const hit = p.pulse && p.last && p.t + p.pulse > p.life ? Object.assign({}, p.hit, p.last) : p.hit;
        hits.push({ att: g.fighters[p.owner], def, hit, proj: p, bx: p.x, by: p.y });
        if (!p.pulse) { p.done = true; break; }
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
    const h = newGame({ players: g.fighters.map((f) => ({ spec: f.spec, pal: f.pal })), seed: 1, stocks: g.stocks, countdown: 0 });
    restore(h, snap);
    // projectiles still in the air stay in the look-ahead (a Meteor Shower star or a flame puff still coming is part of the call)
    h.look = true; h.timed = false;
    let died = false;
    for (let t = 0; t < TUNE.lookFrames && !died; t++) {
      const ins = [blankInput(), blankInput()];
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
  const final = def.stocks === 1 && g.phase === "play";
  g.events.push({ type: "lethal", slot: def.slot, by: att.slot, final, mv: L.mv, fin: L.fin, chg: L.chg, kb: L.kb, dirx: L.dirx, diry: L.diry, x: def.x, y: def.y });
  if (!final) return;
  // the match is decided at the hit: count the KO now; the launch plays out and the blast line only removes the loser
  def.doomed = true;
  def.stocks = 0; def.falls++; att.kos++;
  endGame(g, att.slot, "stocks", true);
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
    const other = g.fighters.find((o) => o !== f);
    endGame(g, other ? other.slot : -1, "stocks");
  } else { setState(f, "dead"); f.dead = 70; }
}
function respawn(g, f) {
  f.x = f.slot === 0 ? -70 : 70; f.y = STAGE.respawnY;
  f.vx = f.vy = f.kbx = f.kby = 0; f.grounded = false; f.plat = -1;
  setState(f, "respawn");
  f.percent = 0; f.airJumps = f.s.airJumps; f.recUsed = false; f.airDodged = false; f.ff = false;
  f.facing = f.slot === 0 ? 1 : -1; f.move = null; f.specCd = 0;
}
function endGame(g, winner, reason, hit) {
  if (g.phase === "end" || g.phase === "over") return;
  g.phase = "end"; g.winner = winner; g.endT = 0; g.endReason = reason;
  g.events.push({ type: "game", winner, hit: !!hit });
}
function endByTime(g) {
  const [a, b] = g.fighters;
  if (a.stocks !== b.stocks) return endGame(g, a.stocks > b.stocks ? 0 : 1, "time");
  if (g.sudden) return endGame(g, -1, "time"); // sudden death ran out too: draw
  startSudden(g);
}
// Equal stocks when time runs out: one life each at 150%, next KO wins.
function startSudden(g) {
  g.sudden = true; g.timer = TUNE.suddenTime; g.projs = []; g.hitstop = 0;
  g.fighters.forEach((f, i) => {
    const sp = STAGE.spawns[i];
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
  wizard:    { gap: 1.8, back: 0.8, rng: 14, poke: 0.9 },                              // pokes at staff range
  dragon:    { edge: 0.6 },                                                            // guards the edge
  gunslinger:{ gap: 1.2, back: 0.3, spec: 1.3, heavy: 1.2 },                           // keeps a mid distance, shoots often, hammers a finish-ready opponent
  reaper:    { gap: 1.35, rng: 14, shuffle: 0.2, charge: 0.4 },                        // stands at scythe range, charges the arc
};
function makeBot(level, style) {
  return { d: level, st: Object.assign({}, BOT_NEUTRAL, style), mem: [], think: 0, hold: { x: 0, y: 0 }, cool: 0, wasPress: false, ledgeWait: -1, chg: 0 };
}
function botInput(g, me, opp, bot) {
  const out = blankInput();
  if (bot.d < 0 || g.phase !== "play" || me.state === "dead" || me.state === "gone") return out;
  const d = bot.d, R = g.rng, S = STAGE.main, st = bot.st;
  bot.mem.push({
    x: opp.x, y: opp.y, st: opp.state, mv: opp.move, mt: opp.mt, pct: opp.percent,
    gone: opp.state === "dead" || opp.state === "gone" || opp.state === "respawn", inv: intangible(opp),
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
    if (fits && (o.pct >= lerp(150, 105, d) || late) && R() < lerp(0.08, 0.35, d)) return press("ulti", sx, 0, 20);
  }
  if (act && bot.cool <= 0 && o.st === "attack" && o.mv && o.mt <= o.mv.startup && adx < 120 && Math.abs(dy) < 100 && R() < lerp(0.04, 0.5, d)) {
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
        if ((o.pct > killPct && R() < 0.65) || R() < 0.12 * st.heavy) {
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

/* ---------- snapshots for online desync recovery ---------- */
const FKEYS = ["x", "y", "vx", "vy", "kbx", "kby", "facing", "grounded", "plat", "state", "st", "mid", "mt", "poundT",
  "airJumps", "airDodged", "ff", "dropT", "downHold", "dodgeKind", "dodgeDir", "landT", "percent", "stocks", "invuln",
  "hitstun", "tumble", "specCd", "recUsed", "ledge", "ledgeCd", "ledgeInv", "flash", "armorFlash", "dead",
  "inp", "prevInp", "buf", "kos", "dmgDealt", "falls", "sds", "lastHitT",
  "freeT", "strN", "strBy", "strMv", "strLaunched", "combo", "comboDmg", "comboBy", "moveT", "techT", "techLock", "techDir",
  "chg", "doomed", "finShot", "link", "lk", "ult", "ultN", "ultX", "ultTgt"];
const PKEYS = ["owner", "x", "y", "dir", "vx", "vy", "grav", "boomer", "style", "speed", "r", "life", "t", "hit", "burst", "pulse", "last"];
const copy = (v) => (v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v);
function serialize(g) {
  return {
    g: [g.t, g.phase, g.cd, g.hitstop, g.timer, g.winner, g.endT, g.endReason, g.timed, g.sudden],
    f: g.fighters.map((f) => [
      ...FKEYS.map((k) => copy(f[k])),
      f.lastHitBy ? f.lastHitBy.slot : -1,
      [0, 1].map((i) => (f.hitLog[i] === undefined ? null : f.hitLog[i])),
    ]),
    p: g.projs.map((p) => PKEYS.map((k) => copy(p[k]))),
  };
}
function restore(g, s) {
  [g.t, g.phase, g.cd, g.hitstop, g.timer, g.winner, g.endT, g.endReason, g.timed, g.sudden] = s.g;
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
  mix(g.t); mix(g.phase); mix(g.timer); mix(g.sudden);
  for (const f of g.fighters) for (const k of ["x", "y", "vx", "vy", "kbx", "kby", "percent", "stocks", "state", "st", "mt", "facing", "specCd", "invuln", "airJumps", "strN", "strLaunched", "techT", "chg", "doomed", "finShot", "link", "lk", "ult", "ultN", "ultX", "ultTgt"]) mix(f[k]);
  for (const p of g.projs) { mix(p.x); mix(p.y); mix(p.t); }
  return h >>> 0;
}

root.BL = { ultReady, ultNeed, serialize, restore, checksum, STAGE, FIGHTERS, TUNE, newGame, step, makeBot, botInput, BOT_STYLES, canAct, intangible, armored, activeBoxes, knockback, blankInput, clamp, lerp, sign };
})(typeof module !== "undefined" ? module.exports : window);
