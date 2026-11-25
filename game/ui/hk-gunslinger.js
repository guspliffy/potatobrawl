/* ===================== Gunslinger's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) ===================== */
/* Kit "Powder and brass" (ivory core, brass body, teal edge): hitkit's angular eight-point star; the shards here are square brass chips
   (and brass shells, HK_GUN_SHELL), the floor mark a nick with two chips. Every shot is a ruled tracer (constant width, three tones over an
   ink line) with a squared brass head (finish-ready: a gold slug twice the size and a longer ruled line). The heavies' muzzle blasts are
   flat lenses with the kit's star, drawn behind both fighters (UV_BACK.gunslinger, hkGunHv). Dead Eye: five ivory dashes, then the sixth
   is one gold line from the muzzle through the red cross-hair and on across the stage. Helpers shared by the T6 kits: ui/hk-samurai.js. */
const HK_GUN = { gold: [null, null, null, null] };   // Dead Eye's sixth shot per slot: { g, t: tick, x, y, d, p (the slug) }
const HK_GUN_IVORY = "#fffbe8", HK_GUN_RED = "#e3453b", HK_GUN_CASE = "#c98a2a";
// a brass shell (k "hkg" with this kit): a capsule, brass with a darker rim
const HK_GUN_SHELL = { id: "gunslinger", shape: "chip", cols: ["#fffbe8", "#f6c040", "#2fa8a0"], shard(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.roundRect(-s * 1.1, -s * 0.5, s * 2.2, s, s * 0.35); c.fillStyle = HK_GUN_CASE; c.fill(); c.lineWidth = 1; c.strokeStyle = HK_INK; c.stroke();
  c.fillStyle = "#f6c040"; c.fillRect(-s * 0.7, -s * 0.5, s * 1.1, s * 0.35);
  c.restore();
} };

/* ---------- the kit's own parts ---------- */
// square brass chips (ivory every third)
HK_KIT.gunslinger.shard = (c, x, y, s, rot, K, i) => {
  const cs = Math.cos(rot), sn = Math.sin(rot), h = s * 0.55, P = (u, v) => [x + u * cs - v * sn, y + u * sn + v * cs];
  c.beginPath(); hkPoly(c, [P(-h, -h), P(h, -h), P(h, h), P(-h, h)]);
  c.fillStyle = K.cols[(i || 0) % 3 === 0 ? 0 : 1]; c.fill();
  c.lineWidth = Math.min(1.4, 0.16 * s + 0.3); c.strokeStyle = HK_INK; c.lineJoin = "round"; c.stroke();
};
// the floor mark: a nick in the floor (a thin dark gouge with a brass lip) and two chips by it
HK_KIT.gunslinger.mark = (c, x, y, w, K, a) => {
  const C = K.cols, ga = c.globalAlpha, L = w * 0.7;
  c.globalAlpha = ga * (a === undefined ? 1 : a);
  c.beginPath(); hkPoly(c, [[x - L, y + 1], [x + L * 0.3, y - 2.4], [x + L, y - 0.6], [x + L * 0.2, y + 1.6]]);
  c.fillStyle = HK_INK; c.fill();
  c.lineWidth = 1.6; c.strokeStyle = C[1]; c.beginPath(); c.moveTo(x - L * 0.8, y - 0.6); c.lineTo(x + L * 0.3, y - 3.4); c.lineTo(x + L * 0.9, y - 1.8); c.stroke();
  HK_KIT.gunslinger.shard(c, x + L * 0.55, y - 6, 4.2, 0.4, K, 1); HK_KIT.gunslinger.shard(c, x - L * 0.4, y - 5, 3.4, -0.3, K, 0);
  c.globalAlpha = ga;
};
// the charge-up: the flat halo on both muzzles, square chips spitting off them (stage 2 and 3)
HK_KIT.gunslinger.charge = (c, f, P, tk, st, q, pts) => {
  const K = HK_KIT.gunslinger;
  hkSamCharge(c, f, P, tk, st, q, pts, K);
  if (st < 2) return;
  c.save();
  for (const [x, y] of pts) for (let i = 0; i < (st === 3 ? 5 : 3); i++) {
    const ph = (tk * 0.11 + i / 5 + nz(i * 4.1)) % 1, an = nz(i * 7.7 + (tk >> 3)) * CV_TAU, d = 5 + ph * (12 + 8 * q);
    c.globalAlpha = 1 - ph; K.shard(c, x + Math.cos(an) * d, y + Math.sin(an) * d, 4 - ph * 2, an, K, i);
  }
  c.restore();
};

/* ---------- shots ---------- */
// a ruled tracer from a to b: constant width, ink, teal, brass, an ivory core (w the ink width)
function hkGunRule(c, ax, ay, bx, by, w, a) {
  if (a <= 0) return;
  const C = HK_KIT.gunslinger.cols, ga = c.globalAlpha;
  c.globalAlpha = ga * a; c.lineCap = "butt";
  for (const [k, col] of [[1, HK_INK], [0.74, C[2]], [0.5, C[1]], [0.2, C[0]]]) { c.lineWidth = w * k; c.strokeStyle = col; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
  c.globalAlpha = ga;
}
// a squared brass head along +x, nose at x = r * 1.4 (gold: the finish-ready slug, gold and ivory with a teal band)
function hkGunSlug(c, r, gold) {
  c.lineJoin = "round";
  c.beginPath(); c.roundRect(-r * 1.7, -r, r * 3.1, r * 2, [r * 0.25, r * 0.95, r * 0.95, r * 0.25]);
  c.fillStyle = gold ? "#f6c040" : HK_GUN_CASE; c.fill(); c.lineWidth = Math.max(1.2, r * 0.32); c.strokeStyle = HK_INK; c.stroke();
  c.fillStyle = gold ? HK_GUN_IVORY : "#f6c040"; c.fillRect(-r * 0.2, -r * 0.62, r * 1.2, r * 0.5);
  if (gold) { c.fillStyle = HK_KIT.gunslinger.cols[2]; c.fillRect(-r * 1.1, -r, r * 0.45, r * 2); }
}
// a bullet in flight (drawProj, draw-world.js): the ruled tracer and the squared head; Dead Eye's first five are ivory dashes
function hkGunBullet(c, p, tk) {
  const gold = p.style === "gold", ult = !!(p.hit && p.hit.ult), sp = Math.hypot(p.vx, p.vy) || 1, r = gold ? (ult ? 7 : 5.2) : ult ? 3.4 : 3;
  const len = Math.min(gold ? sp * (ult ? 9 : 7) : sp * (ult ? 5 : 3), p.t * sp + 4);
  c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
  if (ult && !gold) {   // an ivory dash: a dashed rule and a small ivory head
    c.lineCap = "butt"; c.setLineDash([16, 9]); c.lineDashOffset = p.t * sp * 0.5;
    c.lineWidth = 4.6; c.strokeStyle = HK_INK; c.beginPath(); c.moveTo(-len * 1.4, 0); c.lineTo(-r, 0); c.stroke();
    c.lineWidth = 2.4; c.strokeStyle = HK_GUN_IVORY; c.stroke(); c.setLineDash([]);
    c.beginPath(); c.roundRect(-r * 1.6, -r * 0.8, r * 3, r * 1.6, r * 0.6); c.fillStyle = HK_GUN_IVORY; c.fill(); c.lineWidth = 1.2; c.strokeStyle = HK_INK; c.stroke();
  } else {
    hkGunRule(c, -len, 0, -r * 1.2, 0, gold ? 7.5 : 5, 1);
    if (gold) hkGunRule(c, -len * 0.7, -r * 1.5, -r * 2, -r * 1.5, 3.4, 0.9);   // the finish-ready slug's second rule
    hkGunSlug(c, r, gold);
  }
  c.restore();
}
// the muzzle star (pistol frame, x along the barrel): the kit's eight-point star with a forward spike, k frames old, s its scale
function hkGunFlash(c, x, y, k, s, gold) {
  const q = 1 - k / 3;
  if (q <= 0) return;
  const K = HK_KIT.gunslinger, C = K.cols;
  c.save(); c.translate(x, y); c.scale(s * (0.7 + 0.5 * q), s * (0.7 + 0.5 * q)); c.globalAlpha = q; c.lineJoin = "round";
  c.beginPath(); hkPoly(c, [[-2, -5], [5, -2.6], [18, 0], [5, 2.6], [-2, 5], [1, 0]]); c.fillStyle = C[2]; c.fill(); c.lineWidth = 1.1; c.strokeStyle = HK_INK; c.stroke();
  hkSpark(c, 4, 0, 7.5, K, 1, 0, 5, 0);
  if (gold) { c.fillStyle = "#f6c040"; c.beginPath(); hkPoly(c, [[6, -3], [24, 0], [6, 3]]); c.fill(); }
  c.restore();
}

/* ---------- the heavies' blasts (behind the fighters, the attacker's space) ---------- */
// a heavy's blast from the muzzle at m along a: a flat three-tone cone and the kit's star in the hit window, then flat smoke
function hkGunBlast(c, P, hv, m, a, len) {
  const age = Math.max(0, hv.age + 1), K = HK_KIT.gunslinger;
  c.save(); c.translate(m[0], m[1]); c.rotate(a);
  if (hv.phase === 1) {
    const q = 1 - hv.u * 0.35, L_ = len * (0.85 + 0.2 * (age % 2)) * (1 + 0.6 * HV_K);
    hkStreak(c, [0, 0], [L_ + 6, 0], 10 * q * (1 + 0.4 * HV_K), K, { head: 0.45 });
    hkSpark(c, 6, 0, (len * 0.5 + 4 * (age % 2)) * q * (1 + 0.5 * HV_K), K, 2, 0, 7 + age, 0);   // a muzzle star bigger than his head
  }
  const sm = hv.phase === 2 ? hv.post : 0, k = sm / 16;
  if (hv.phase === 2 && k < 1) {
    c.globalAlpha = 0.6 * (1 - k); c.fillStyle = "#cfc8d8"; c.lineWidth = 1.2; c.strokeStyle = HK_INK;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(8 + i * 7 + sm * 0.8, -sm * (0.5 + i * 0.25), 4 + i * 1.5 + sm * 0.45, 0, CV_TAU); c.fill(); }
  }
  c.restore();
}
const hkGunHv = {
  hSide(c, f, P, hv) { hkGunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 34); },
  hUp(c, f, P, hv) { hkGunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 30); hkGunBlast(c, P, hv, gunMuzzle(P, P.hB, P.gunB, true), P.gunB, 24); },
  hDown(c, f, P, hv) {
    hkGunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 22); hkGunBlast(c, P, hv, gunMuzzle(P, P.hB, P.gunB, true), P.gunB, 22);
    const age = Math.max(0, hv.age + 1), a = 1 - age / 14;
    if (a > 0) for (const sx of [1, -1]) { c.globalAlpha = a; HK_KIT.gunslinger.mark(c, sx * 38, -1, 10 + age * 2.4, HK_KIT.gunslinger, 1); }
    c.globalAlpha = 1;
  },
  hAir(c, f, P, hv) { hkGunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 30); },
};

/* ---------- Dead Eye: the sixth, one gold line through the red cross-hair and on across the stage ---------- */
function hkGunGold(c, g, f, tk) {
  const R = HK_GUN.gold[f.slot];
  if (!R || R.g !== g) return;
  const slug = g.projs.includes(R.p) ? R.p : null;
  if (!slug && R.end === undefined) R.end = tk;
  const age = slug ? 0 : tk - R.end, a = slug ? 1 : 1 - Math.max(0, age - 24) / 14;
  if (a <= 0) { HK_GUN.gold[f.slot] = null; return; }
  const x1 = slug ? slug.x : R.xEnd + (R.x + R.d * 900 - R.xEnd) * ease(clamp((age - 1) / 5, 0, 1));   // (from the hit's third tick: the impact frames own the first two)
  if (slug) R.xEnd = slug.x;
  const C = HK_KIT.gunslinger.cols;
  c.save(); c.globalAlpha = a; c.lineCap = "butt";
  for (const [w, col] of [[11, HK_INK], [8, C[2]], [5.4, C[1]], [2, C[0]]]) { c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.moveTo(R.x, R.y); c.lineTo(x1, R.y); c.stroke(); }
  c.restore();
}
UV_BACK.gunslinger = (c, g, f, tk) => {
  hkSamHeavy(c, f, tk, hkGunHv);
  hkGunGold(c, g, f, tk);
};
