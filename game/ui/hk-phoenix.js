/* ===================== Phoenix's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) =====================
   Feather fire (#fff3b0 #ff9a1f #ff4a26): a tapered flame crescent behind every swing, the headbutt's flame a three-tone lens that ends at
   the contact point with feather cinders, the fireball a pointed ball with a cream nose and a feather wake, a broken ring with feather
   cinders on the floor, and Solar Dive's payoff: a three-prong comet into the mark and the floor crowned in flame (UV_BACK, behind the
   fighters, so the one it lands on stays readable). Flat fills only: no gradients, no shadowBlur.
   The first block holds the tools the Dragon, Alchemist and Wizard kits use too (hkPhx*: the flat glow, the heavy's clock read from the
   fighter alone, kit shards, the flat charge-up, a three-tone flame tongue). Nothing here writes to a fighter or a game. */

/* ---------- the T5 kit tools ---------- */
// a flat glow: three discs of one colour, each smaller and a little stronger (in place of a radial gradient)
function hkPhxHalo(c, x, y, r, colr, a) {
  if (!(a > 0) || r <= 0) return;
  const ga = c.globalAlpha;
  c.fillStyle = colr;
  c.globalAlpha = ga * a * 0.13; c.beginPath(); c.arc(x, y, r, 0, CV_TAU); c.fill();
  c.globalAlpha = ga * a * 0.17; c.beginPath(); c.arc(x, y, r * 0.66, 0, CV_TAU); c.fill();
  c.globalAlpha = ga * a * 0.24; c.beginPath(); c.arc(x, y, r * 0.38, 0, CV_TAU); c.fill();
  c.globalAlpha = ga;
}
// the heavy a fighter is playing, from the fighter alone (UV_BACK has no pose): the key, age (frames since the hit window opened, 0 on
// the first active frame, negative in the wind-up), post (frames since it closed), the charge (0..1, as pose() reads it); null otherwise
function hkPhxHv(f) {
  const m = f.move;
  if (f.state !== "attack" || !m || HEAVY_KEYS[f.mid] !== 1) return null;
  const a0 = m.startup + 1, a1 = m.startup + m.active;
  return { key: f.mid, m, age: f.mt - a0, post: f.mt - a1, ck: f.chg > 0 && m.charge ? f.chg / BL.TUNE.chgMax : 0 };
}
// a smear's strength: full for `full` frames from the first active frame, then fading out over `fade` frames
const hkPhxFade = (age, full, fade) => (age < 0 ? 0 : age < full ? 1 : Math.max(0, 1 - (age - full + 1) / (fade + 1)));
// how far a smear's tail has drawn in towards its leading end (0 on the first active frame)
const hkPhxPull = (age, k) => Math.min(0.75, Math.max(0, age) * (k || 0.13));
// n shards of a kit flying from (x, y) round the angle dir (screen y down), sp their speed, s their size; g a pull down (falling feathers)
function hkPhxShards(K, x, y, n, dir, spread, sp, s, life, g) {
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - 0.5) * spread, v = sp * (0.55 + Math.random() * 0.6);
    addFx({ k: "hkg", kit: K, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: s * (0.75 + Math.random() * 0.5), rot: a, vr: (Math.random() - 0.5) * 0.3, i,
      t: 0, life: life * (0.8 + Math.random() * 0.4), damp: 0.9, g: g || 0 });
  }
}
// the launch angle of a hit event (screen y down; facing when the event has none)
const hkPhxDir = (e, att) => (e.dirx || e.diry ? Math.atan2(e.diry || 0, e.dirx || 0) : att && att.facing < 0 ? Math.PI : 0);
// a three-tone flame tongue standing on (x, y), h tall, wd half wide at its foot, its tip leaning by lean; an ink edge unless ink === false
function hkPhxTongue(c, x, y, h, wd, lean, K, ink) {
  if (h < 2) return;
  const C = K.cols, t = (hh, ww, ll) => {
    c.beginPath(); c.moveTo(x - ww, y); c.quadraticCurveTo(x - ww * 0.9 + ll * 0.3, y - hh * 0.55, x + ll, y - hh);
    c.quadraticCurveTo(x + ww * 0.9 + ll * 0.3, y - hh * 0.5, x + ww, y); c.closePath();
  };
  t(h, wd, lean); c.fillStyle = C[2]; c.fill();
  if (ink !== false) { c.lineWidth = 1.7; c.strokeStyle = HK_INK; c.stroke(); }
  t(h * 0.72, wd * 0.6, lean * 0.8); c.fillStyle = C[1]; c.fill();
  t(h * 0.42, wd * 0.3, lean * 0.6); c.fillStyle = C[0]; c.fill();
}
// a cluster of tongues rising from a point, each flickering on its own (the charge-up's gather, the floor flames)
function hkPhxTongues(c, x, y, n, h, spread, tk, q, K) {
  for (let j = 0; j < n; j++) {
    const i = j % 2 ? (n - 1 - (j >> 1)) : j >> 1, m = i - (n - 1) / 2, fl = 0.72 + 0.28 * Math.sin(tk * 0.55 + i * 2.3);   // the outer ones first, the middle on top
    hkPhxTongue(c, x + m * spread, y, h * fl * (1 - Math.abs(m) * 0.16), 3.2 + q * 1.8, Math.sin(tk * 0.32 + i * 1.7) * 2.6, K);
  }
}
// the flat charge-up of a T5 kit (HK_KIT.<id>.charge, drawn by drawCharge in place of its gradient glow): a flat glow in the kit's body
// colour at each charge point with the kit's spark shape turning in it, stage 2 and 3 the fighter's element (CHARGE_GATHER), stage 3 a
// dashed rim of the body colour round the potato (the body shakes 1 px: pose() sets P.jit)
function hkPhxCharge(c, f, P, tk, st, q, pts, K, gather) {
  if (!P.rx) return;
  const C = K.cols, ramp = Math.min(1, P.chg / 4), pulse = 0.9 + 0.1 * Math.sin(tk * 0.5);
  const r = (st === 1 ? 14 + 6 * q : st === 2 ? 20 + 6 * q : 28) * pulse, ga = c.globalAlpha;
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  if (st === 3) {
    c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    c.globalAlpha = ga * (0.6 + 0.25 * Math.sin(tk * 0.6)); c.setLineDash([10, 6]); c.lineDashOffset = -tk * 0.7;
    c.beginPath(); c.ellipse(0, P.cy, P.rx + 4, P.ry + 4, 0, 0, CV_TAU); c.lineWidth = 4.4; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 2.4; c.strokeStyle = C[1]; c.stroke();
    c.setLineDash([]);
    c.restore();
  }
  for (const [x, y] of pts) {
    c.globalAlpha = ga * ramp;
    hkPhxHalo(c, x, y, r, C[1], 1);
    const s = r * (st === 1 ? 0.3 : 0.36), rot = tk * 0.06;
    hkLayer(c, x, y, s, K.shape, rot, -Math.PI / 2, 7); c.fillStyle = C[2]; c.fill(); c.lineWidth = 1.6; c.strokeStyle = HK_INK; c.stroke();
    hkLayer(c, x, y, s * 0.62, K.shape, rot + 0.3, -Math.PI / 2, 7); c.fillStyle = C[0]; c.fill();
  }
  c.globalAlpha = ga;
  if (st >= 2 && gather) gather(c, f, P, tk, st, q, pts);
  c.restore();
}
// the recovery's lift-off (HK_KIT.<id>.rec, from handleEvent's "jump" case): a ring in the kit's body colour under the feet and a few
// kit shards thrown down and out, the jump sound
function hkPhxRec(e, K, live) {
  addFx({ k: "ring", x: e.x, y: e.y - 4, t: 0, life: 14, r0: 6, r1: 34, col: K.cols[1] });
  hkPhxShards(K, e.x, e.y - 8, 5, Math.PI / 2, 2.2, 4.4, 4.6, 20, 0.08);
  if (live) Sfx.jump();
}
// a fireball ends (projEnd, style "fire"): the Phoenix's in a broken kit ring and feathers, a Dragon's breath puff in two lobes and embers
function hkPhxFireEnd(e, K) {
  const drg = K === HK_KIT.dragon;
  if (!drg) addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 6, r1: 34, col: K.cols[1] });
  hkPhxShards(K, e.x, e.y, drg ? 2 : 5, -Math.PI / 2, 2.4, 4.5, drg ? 6 : 5, 20, 0.08);
  for (let i = 0; i < (drg ? 4 : 8); i++) ember(e.x, e.y, (Math.random() - 0.5) * 6, -Math.random() * 4);
}

/* ---------- Phoenix ---------- */
const HK_PHX = HK_KIT.phoenix;
HK_PHX.charge = (c, f, P, tk, st, q, pts) => hkPhxCharge(c, f, P, tk, st, q, pts, HK_PHX, CHARGE_GATHER.phoenix);
HK_PHX.rec = (e, f, live) => hkPhxRec(e, HK_PHX, live);
// the floor mark: a ring broken in three, ink under the flame colours, with three feather cinders curling up off it
HK_PHX.mark = function hkPhxMark(c, x, y, w, K, a) {
  const C = K.cols, ga = c.globalAlpha;
  c.globalAlpha = ga * (a === undefined ? 1 : a);
  c.save(); c.translate(x, y); c.scale(1, 0.26); c.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a0 = 0.35 + i * 2.09; c.beginPath(); c.arc(0, 0, w, a0, a0 + 1.4);
    c.lineWidth = 7; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = C[i === 1 ? 1 : 2]; c.stroke();
  }
  c.restore();
  for (let i = 0; i < 3; i++) hkShard(c, x - w * 0.62 + i * w * 0.62, y - 4 - (i % 2) * 5, 4.4, -1.95 + i * 0.4, K, i);
  c.globalAlpha = ga;
};

// the headbutt's flame (drawFlame, fighter space): a three-tone lens from just behind the mouth to the contact point (never past it), its
// widest part near the head, flickering; a heavy's sheds feather cinders back off its edges. S is P.swoosh (tx, ty the box, r its radius)
function hkPhxFlame(c, P, S, tk) {
  if (P.fig && P.fig === CV_FIG.dragon) return hkDrgFlame(c, P, S, tk);   // a Dragon's fire lights roll out as lobes (ui/hk-dragon.js)
  const K = HK_PHX, m = rot(P.mouthPt || [P.head[0] + P.hr * 1.5, P.head[1] + P.hr * 0.25], P.hip, P.lean);
  const ang = Math.atan2(S.ty - m[1], S.tx - m[0]), ca = Math.cos(ang), sa = Math.sin(ang);
  const len = Math.hypot(S.tx - m[0], S.ty - m[1]) + S.r * (S.hv ? 0.3 : 0.15), first = S.age === 0 ? 1.15 : 1;
  const R = Math.min(len * 0.3, S.r * (S.hv ? 0.6 : 0.42) * (1 + 0.5 * (S.ck || 0)) * first) * (1 + 0.06 * Math.sin(tk * 1.3));   // a pointed lens, never a fat card
  const a = [m[0] - ca * 8, m[1] - sa * 8], b = [m[0] + ca * len, m[1] + sa * len];
  hkStreak(c, a, b, R, K, { head: 0.62 });
  if (!S.hv) return;
  const ga = c.globalAlpha;
  for (let i = 0; i < 4; i++) {   // feather cinders peel back off the edges
    const q = (tk * 0.11 + i * 0.27) % 1, side = i % 2 ? 1 : -1, d = len * (0.85 - q * 0.75), off = R * (0.75 + q * 0.9) * side;
    c.globalAlpha = ga * (1 - q * 0.8);
    hkShard(c, m[0] + ca * d - sa * off, m[1] + sa * d + ca * off, 4.2 - q * 1.6, ang + Math.PI + side * 0.5, K, i);
  }
  c.globalAlpha = ga;
}

// the fireball (drawProj, style "fire" thrown by a Phoenix): a pointed ball, its cream nose forward, a three-tone flame lens behind it and
// feathers peeling off the wake. k scales the drawing (finish-ready: 1.6, never the hitbox); rdy the finish-ready look: the wake twice as
// long with an outer flame and more feathers
function hkPhxBall(c, p, tk, k, rdy) {
  const K = HK_PHX, C = K.cols, R = p.r * k, fl = 1 + Math.sin(tk * 0.9 + p.x * 0.05) * 0.05;
  c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx)); c.lineJoin = "round";
  hkPhxHalo(c, -R * 0.4, 0, R * (rdy ? 2.6 : 2.1), C[1], 0.85);
  const wl = R * (rdy ? 7.2 : 3.9) * fl;
  if (rdy) hkStreak(c, [-wl * 1.08, 0], [R * 0.5, 0], R * 1.05, K, { head: 0.86, a: 0.55 });   // the outer flame of a finish-ready ball
  hkStreak(c, [-wl, 0], [R * 0.3, 0], R * 0.68, K, { head: 0.86 });
  const n = rdy ? 7 : 4;
  for (let i = 0; i < n; i++) {   // feathers peeling off the wake, up and down in turn, drifting back
    const q = ((tk * 0.06 + i / n) % 1), side = i % 2 ? 1 : -1;
    c.globalAlpha = 1 - q * 0.85;
    hkShard(c, -R * 0.9 - q * wl * 0.9, side * R * (0.55 + q * 0.7), R * (0.34 - q * 0.16), Math.PI + side * 0.45, K, i);
  }
  c.globalAlpha = 1;
  // the ball: the flame-red edge with the ink line, the orange body, the cream nose at its point
  const shape = (s, x0) => { const T = R * 1.45 * s, B = R * 0.95 * s, H = R * 0.78 * s;
    c.beginPath(); c.moveTo(x0 + T, 0); c.quadraticCurveTo(x0 + T * 0.25, -H * 1.12, x0 - B * 0.35, -H * 0.95); c.quadraticCurveTo(x0 - B * 1.08, -H * 0.55, x0 - B, 0);
    c.quadraticCurveTo(x0 - B * 1.08, H * 0.55, x0 - B * 0.35, H * 0.95); c.quadraticCurveTo(x0 + T * 0.25, H * 1.12, x0 + T, 0); c.closePath(); };
  shape(1, 0); c.fillStyle = C[2]; c.fill(); c.lineWidth = 2.4; c.strokeStyle = HK_INK; c.stroke();
  shape(0.72, R * 0.36); c.fillStyle = C[1]; c.fill();
  shape(0.38, R * 0.86); c.fillStyle = C[0]; c.fill();
  c.restore();
}

// ---- the heavies' swing, drawn behind the fighters (UV_BACK): the smear on the move's real path, full on the first active frame ----
function hkPhxHeavyBack(c, f, hv) {
  const K = HK_PHX, k = hv.key, wk = 1 + 0.6 * hv.ck;
  if (k === "hSide" || k === "hAir") {   // the whole body becomes the beak: a tapered flame crescent from behind the crest down onto the point
    const a = hkPhxFade(hv.age, 1, 5);
    if (a <= 0) return;
    const a1 = k === "hAir" ? -0.36 : -0.42, a0 = -2.85 + (a1 + 2.85) * hkPhxPull(hv.age), cx = -20, cy = -26, r = 74;   // wide of the crest
    hkSmear(c, cx, cy, r, a0, a1, 30 * wk, K, { a });
    if (hv.age <= 1) for (let i = 0; i < 3; i++) { const an = a0 + (a1 - a0) * (0.3 + i * 0.22), rr = r + 6 + (i % 2) * 6; hkShard(c, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr, 5.6 - i * 0.8, an - 1.4, K, i); }
  } else if (k === "hUp") {   // the wings flare: a flame crescent over the head, back to front
    const a = hkPhxFade(hv.age, 2, 6);
    if (a <= 0) return;
    const a1 = -0.28, a0 = -Math.PI + 0.25 + (a1 + Math.PI - 0.25) * hkPhxPull(hv.age, 0.1);
    hkSmear(c, 0, -42, 56, a0, a1, 22 * wk, K, { a, ry: 0.95 });
  } else if (k === "hDown") {   // both feet stamp: a broken ring of flame on the floor each side, tongues rising and falling back
    const age = hv.age + 1, a = 1 - age / 15;
    if (hv.age < 0 || a <= 0) return;
    const ga = c.globalAlpha;
    for (const sx of [1, -1]) {
      const x = sx * 34, r = 12 + age * 3.6;
      c.globalAlpha = ga * Math.min(1, a * 1.4);
      c.save(); c.translate(x, -2); c.scale(1, 0.26); c.setLineDash([r * 0.7, r * 0.3]); c.lineDashOffset = sx * age * 2;
      c.beginPath(); c.arc(0, 0, r, 0, CV_TAU); c.lineWidth = 7; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = K.cols[1]; c.stroke();
      c.setLineDash([]); c.restore();
      const h = (26 + 8 * hv.ck) * Math.min(1, age / 2) * a;
      for (let i = -1; i <= 1; i++) hkPhxTongue(c, x + i * 11 + sx * age * 0.8, -1, h * (i ? 0.66 : 1), 5.2 * wk, sx * (2 + age * 0.6) + i * 2, K);
    }
    c.globalAlpha = ga;
  }
}

/* ---------- Solar Dive ---------- */
// the comet (mt 31..59, behind the figure): three prongs, a thick flame lens straight up from him and two thin ones converging on him from
// either side, feathers torn off the trail; the front part (uvAhead) is a feather star at the point
function hkPhxComet(c, f, tk, back) {
  const K = HK_PHX, C = K.cols, x = f.x, y = f.y - 34;
  if (back) {
    const fl = Math.sin(tk * 0.9) * 6;
    hkPhxHalo(c, x, y, 82, C[1], 0.9);
    hkStreak(c, [x - 120, y - 300 + fl], [x - 4, y + 4], 13, K, { head: 0.9, a: 0.85 });
    hkStreak(c, [x + 120, y - 300 - fl], [x + 4, y + 4], 13, K, { head: 0.9, a: 0.85 });
    hkStreak(c, [x + fl * 0.4, y - 380], [x, y + 16], 36, K, { head: 0.86 });
    for (let i = 0; i < 4; i++) { const q = (tk * 0.09 + i / 4) % 1, s = i % 2 ? 1 : -1; c.globalAlpha = 1 - q; hkShard(c, x + s * (30 + q * 40), y - 40 - q * 190, 7 - q * 3, -Math.PI / 2 + s * 0.4, K, i); }
    c.globalAlpha = 1;
  } else {
    c.lineJoin = "round";
    hkSpark(c, x, y + 12, 22 + 3 * Math.sin(tk * 0.7), K, 2, -Math.PI / 2, 5, 0);
  }
}
// the landing (from the ultLand cue to the end of the move, behind the fighters): the three prongs driven into the mark for a few frames,
// then the floor crowned in flame (a ring of tongues round the blast's reach) that rises, holds and burns down; a broken ring under it
function hkPhxCrown(c, e, tk) {
  const K = HK_PHX, C = K.cols, q = e.t / e.life, x = e.x, y = e.y, R = 82;
  if (e.t < 5) {   // the prongs strike: the sky end comes down into the mark
    const k = e.t / 5, top = y - 34 - 300 * (1 - k);
    hkStreak(c, [x - 110 * (1 - k), top], [x, y + 6], 12 * (1 - k * 0.5), K, { head: 0.9, a: 0.9 });
    hkStreak(c, [x + 110 * (1 - k), top], [x, y + 6], 12 * (1 - k * 0.5), K, { head: 0.9, a: 0.9 });
    hkStreak(c, [x, top - 60 * (1 - k)], [x, y + 10], 34 * (1 - k * 0.4), K, { head: 0.9 });
  }
  const grow = Math.min(1, e.t / 4), fade = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45, ga = c.globalAlpha;
  c.save(); c.translate(x, y); c.lineJoin = "round";
  c.globalAlpha = ga * fade;
  c.save(); c.scale(1, 0.26);   // the scorched floor and the broken ring at the blast's reach
  c.beginPath(); c.arc(0, 0, R * (0.6 + 0.4 * grow), 0, CV_TAU); c.globalAlpha = ga * fade * 0.28; c.fillStyle = C[1]; c.fill();
  c.globalAlpha = ga * fade; c.setLineDash([26, 12]); c.lineDashOffset = -e.t * 2; c.lineWidth = 8; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 4; c.strokeStyle = C[0]; c.stroke(); c.setLineDash([]);
  c.restore();
  // the crown: twelve tongues standing on the ring, the back ones first (smaller: further away), the tallest at the sides
  const h0 = 70 * grow * (q < 0.3 ? 1 : 1 - (q - 0.3) / 0.7 * 0.85);
  for (const back of [true, false]) for (let i = 0; i < 12; i++) {
    const an = (i / 12) * CV_TAU + 0.26, sy = Math.sin(an);
    if ((sy < 0) !== back) continue;
    const px = Math.cos(an) * R, py = sy * R * 0.26, h = h0 * (0.62 + 0.38 * Math.abs(Math.cos(an))) * (0.8 + 0.2 * Math.sin(tk * 0.6 + i * 1.9)) * (back ? 0.82 : 1);
    hkPhxTongue(c, px, py, h, 8 * (back ? 0.85 : 1), Math.cos(an) * 10 + Math.sin(tk * 0.4 + i) * 2, K);
  }
  c.restore();
  c.globalAlpha = ga;
}
// UV_BACK.phoenix: the heavies' swing and Solar Dive's comet and crown, behind the fighters
UV_BACK.phoenix = function hkPhxBack(c, g, f, tk) {
  const hv = hkPhxHv(f);
  if (hv && hv.age >= 0) { c.save(); c.translate(f.x, f.y); c.scale(f.facing, 1); hkPhxHeavyBack(c, f, hv); c.restore(); }
  for (const e of fx) if (e.k === "hkphx" && e.owner === f.slot) hkPhxCrown(c, e, tk);
  c.globalAlpha = 1;
};
