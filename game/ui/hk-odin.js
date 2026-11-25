/* ===================== Odin's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) ===================== */
/* Kit "Rune storm" (white core, gold body, blue edge): hitkit's four-point star in a dashed rune ring, arrow shards; the floor mark here is
   a dashed ring with stamped chevrons. The heavies' smears are drawn behind both fighters (UV_BACK.odin, the attacker's own space; the
   classic swoosh is off for them, X.replace): Hammer fists one gold arc from over his head down onto the fists, the uppercut an arc up the
   fist's path, the stomp two rune rings on the floor, the air hammer the fists' real path; a rune ring opens where a heavy lands
   (hkSamOwn.odnring). Raven: a real bird with swept wings and a pennant wake, feathers shed on the turn (finish-ready: bigger, a gold
   pennant, the eyes burn). Gungnir: the spear draws a stage-long gold line behind it, rune rings open where it passes, a pennant streams
   from it on the way back. Helpers shared by the T6 kits are in ui/hk-samurai.js (hkSam*). */
const HK_ODN = { ln: [null, null, null, null] };   // Gungnir's line per slot: { g, x0, x1, xf, y, dir, p, px, back, end (the tick it went, or -1), thru (it hit) }
const HK_ODN_WAKE = { cols: ["#fffbe8", "#9cc4f2", "#4f8fe0"] };   // the raven's pennant: pale blue (finish-ready: the kit's gold)
const HK_ODN_BIRD = "#26304f";
// a dashed rune ring with four chevrons stamped round it, pointing out (ry < 1: lying on the floor)
function hkOdnRing(c, x, y, r, ry, a, rot) {
  if (a <= 0 || r <= 1) return;
  const K = HK_KIT.odin, C = K.cols, ga = c.globalAlpha;
  c.globalAlpha = ga * Math.min(1, a);
  c.save(); c.translate(x, y); c.scale(1, ry);
  c.setLineDash([r * 0.5, r * 0.2]); c.lineDashOffset = -rot * r;
  c.beginPath(); c.arc(0, 0, r, 0, CV_TAU); c.lineWidth = 4.6; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 2.4; c.strokeStyle = C[1]; c.stroke();
  c.setLineDash([]); c.lineDashOffset = 0;
  c.restore();
  for (let i = 0; i < 4; i++) { const an = rot + 0.785 + (i * Math.PI) / 2, d = r + 5; hkShard(c, x + Math.cos(an) * d, y + Math.sin(an) * d * ry, Math.max(3, r * 0.16), an, K, i); }
  c.globalAlpha = ga;
}
// a chevron stamped on the floor (a flat V, pointing along an)
function hkOdnChev(c, x, y, s, an, C) {
  const ca = Math.cos(an), sa = Math.sin(an), P = (u, v) => [x + u * ca - v * sa, y + (u * sa + v * ca) * 0.45];
  const a = P(-s * 0.6, -s), b = P(s * 0.5, 0), d = P(-s * 0.6, s);
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]);
  c.lineWidth = 4.6; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = C[1]; c.stroke();
}

/* ---------- the kit's own parts ---------- */
// the floor mark: the dashed rune ring and three chevrons stamped into the floor
HK_KIT.odin.mark = (c, x, y, w, K, a) => {
  const C = K.cols, ga = c.globalAlpha;
  c.globalAlpha = ga * (a === undefined ? 1 : a);
  c.save(); c.translate(x, y); c.scale(1, 0.26);
  c.setLineDash([16, 6]); c.beginPath(); c.arc(0, 0, w, 0, CV_TAU); c.lineWidth = 5; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = C[1]; c.stroke();
  c.setLineDash([]); c.restore();
  c.lineCap = "round"; c.lineJoin = "round";
  hkOdnChev(c, x - w * 0.55, y, 5, Math.PI, C); hkOdnChev(c, x + w * 0.55, y, 5, 0, C); hkOdnChev(c, x, y + 1, 5, -Math.PI / 2, C);
  c.globalAlpha = ga;
};
// the charge-up: the flat halo on the fists, arrows of the kit closing in on them (stage 2 and 3)
HK_KIT.odin.charge = (c, f, P, tk, st, q, pts) => {
  const K = HK_KIT.odin;
  hkSamCharge(c, f, P, tk, st, q, pts, K);
  if (st < 2) return;
  const n = st === 3 ? 4 : 3;
  c.save();
  for (const [x, y] of pts) for (let i = 0; i < n; i++) {
    const ph = (tk * 0.06 + i / n) % 1, an = (i / n) * CV_TAU + 0.4 + (tk >> 4) * 0.3, d = 30 - ph * 22;
    c.globalAlpha = Math.sin(Math.PI * ph);
    hkShard(c, x + Math.cos(an) * d, y + Math.sin(an) * d, 4.2 + 1.2 * q, an + Math.PI, K, i);
  }
  c.restore();
};

/* ---------- the heavies (behind the fighters, the attacker's space) ---------- */
const hkOdnHv = {
  // Hammer fists: one gold arc from over his head down onto the fists, a rune ring opening on them
  hSide(c, f, P, hv) {
    const K = HK_KIT.odin, a = hkSamFade(hv, 2, 6), cx = 6, cy = hv.ty + 18, r = Math.hypot(hv.tx - cx, hv.ty - cy) + 8, a1 = Math.atan2(hv.ty - cy, hv.tx - cx) + 0.2;
    if (a > 0) hkSmear(c, cx, cy, r, a1 - 2.55, a1, 26 * (1 + 0.7 * HV_K), K, { a });
    const age = hkSamT(hv);
    if (age >= 0 && age < 10) hkOdnRing(c, hv.tx + hv.b.r * 0.4, hv.ty, hv.b.r * (0.75 + age * 0.07), 1, 1 - age / 10, age * 0.08);
  },
  // the uppercut: an arc up the fist's path from in front and over his head (the box sweeps front to back over it), the rune ring over it
  hUp(c, f, P, hv) {
    const K = HK_KIT.odin, b = hv.b, a = hkSamFade(hv, 1, 6), x2 = b.x2 !== undefined ? b.x2 : hv.tx, y2 = b.y2 !== undefined ? b.y2 : hv.ty;
    if (a > 0) hkSamArcTo(c, (b.x + x2) / 2, (b.y + y2) / 2 + 22, [b.x + 8, b.y + 30], [x2, y2], 22 * (1 + 0.7 * HV_K), K, a, 1, 0);
    const age = hkSamT(hv);
    if (age >= 0 && age < 10) hkOdnRing(c, 4, y2 - 16, 13 + age * 1.2, 1, 1 - age / 10, age * 0.08);
  },
  // the stomp: both fists driven down, two rune rings open on the floor either side
  hDown(c, f, P, hv) {
    const K = HK_KIT.odin, b = hv.b, a = hkSamFade(hv, 1, 5), age = Math.max(0, hkSamT(hv) + 1), al = 1 - age / 16;
    if (a > 0) {   // each fist's arc from over his head down to the floor, one each side
      const w = 16 * (1 + 0.7 * HV_K);
      hkSamArcTo(c, 0, -40, [P.w * 0.3, -P.h * 0.98], [b.x, -6], w, K, a, 1, 0);
      hkSamArcTo(c, 0, -40, [-P.w * 0.05, -P.h * 0.92], [-b.x * 0.9, -6], w, K, a, 1, 0);
    }
    if (hkSamT(hv) >= 0 && al > 0) for (const sx of [1, -1]) hkOdnRing(c, sx * 40, -3, 12 + age * 4.2, 0.26, al, age * 0.05 * sx);
  },
  // the air hammer: the fists' real path from overhead down in front, a rune ring where they land
  hAir(c, f, P, hv) {
    hkSamTipPath(c, P, hv, 22, 2, HK_KIT.odin);
    const age = hkSamT(hv);
    if (age >= 0 && age < 10) hkOdnRing(c, hv.tx + hv.b.r * 0.4, hv.ty, hv.b.r * (0.7 + age * 0.07), 1, 1 - age / 10, age * 0.08);
  },
};
// a rune ring opening on a landed heavy, on the stomp's floor, on Gungnir's throw and catch
hkSamOwn.odnring = (c, e, q) => { const k = ease(Math.min(1, q * 1.6)); hkOdnRing(c, e.x, e.y, lerp(e.r0, e.r1, k), e.ry || 1, 1 - q, q * 0.8); };

/* ---------- the raven ---------- */
// a pennant: a long swallow-tailed flag streaming from (x, y) back along an, three tones over an ink edge
function hkOdnPennant(c, x, y, an, len, w, K, a) {
  if (len < 6 || a <= 0) return;
  const C = K.cols, ca = Math.cos(an), sa = Math.sin(an), ga = c.globalAlpha;
  const flag = (s, ww) => {   // s: how much of the length, ww: the half width at the root
    const P = (u, v) => [x - u * ca - v * sa, y - u * sa + v * ca];
    c.beginPath(); hkPoly(c, [P(0, -ww), P(len * s, -ww * 0.22), P(len * s * 0.84, 0), P(len * s, ww * 0.22), P(0, ww)]);
  };
  c.globalAlpha = ga * a; c.lineJoin = "round";
  flag(1, w); c.fillStyle = C[2]; c.fill(); c.lineWidth = 2; c.strokeStyle = HK_INK; c.stroke();
  flag(0.78, w * 0.6); c.fillStyle = C[1]; c.fill();
  flag(0.5, w * 0.28); c.fillStyle = C[0]; c.fill();
  c.globalAlpha = ga;
}
// the bird: dark, swept wings, a gold beak, a red eye (rdy: bigger, the eye ringed and burning)
function hkOdnBird(c, s, flap, rdy) {
  c.save(); c.scale(s, s); c.lineJoin = "round"; c.lineWidth = 1.5 / s * 1.2; c.strokeStyle = HK_INK;
  const up = flap * 5;
  c.fillStyle = "#1c2238"; c.beginPath(); hkPoly(c, [[2, 2], [-9, 13 + up * 0.4], [-15, 11 + up * 0.4], [-5, 3]]); c.fill(); c.stroke();   // the far wing
  c.fillStyle = HK_ODN_BIRD;
  c.beginPath(); hkPoly(c, [[-8, -1], [-21, -6], [-17, 0], [-21, 5], [-8, 2]]); c.fill(); c.stroke();   // the tail fan
  c.beginPath(); c.ellipse(0, 0, 11, 5.4, -0.08, 0, CV_TAU); c.fill(); c.stroke();
  c.beginPath(); c.arc(9, -2.5, 5, 0, CV_TAU); c.fill(); c.stroke();
  c.fillStyle = HK_KIT.odin.cols[1]; c.beginPath(); hkPoly(c, [[13, -4.5], [20.5, -2], [13, -0.6]]); c.fill(); c.stroke();   // the beak
  c.fillStyle = HK_ODN_BIRD; c.beginPath(); hkPoly(c, [[5, -3], [-6, -18 - up], [-13, -21 - up], [-10, -14 - up * 0.6], [-5, -2]]); c.fill(); c.stroke();   // the near wing, swept back
  c.strokeStyle = HK_KIT.odin.cols[2]; c.lineWidth = 1.3 / s * 1.2; c.beginPath(); c.moveTo(3, -4); c.lineTo(-7, -17 - up); c.stroke();   // its blue edge
  if (rdy) { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(10, -3.4, 2.6, 0, CV_TAU); c.fill(); }
  c.fillStyle = "#e3453b"; c.beginPath(); c.arc(10, -3.4, rdy ? 1.9 : 1.3, 0, CV_TAU); c.fill();
  c.restore();
}
// a shed feather (flat, ink edge)
function hkOdnFeather(c, x, y, rot, a) {
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = a;
  c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, -3.2, 6, 0); c.quadraticCurveTo(0, 3.2, -6, 0); c.closePath();
  c.fillStyle = HK_ODN_BIRD; c.fill(); c.lineWidth = 1; c.strokeStyle = HK_INK; c.stroke();
  c.strokeStyle = HK_KIT.odin.cols[2]; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke();
  c.restore();
}
// the raven in flight (drawProj, draw-world.js): the pennant wake behind it, feathers shed on the turn, the bird
function hkOdnRaven(c, p, tk, rdy) {
  const s = p.vx >= 0 ? 1 : -1, sp = Math.abs(p.vx), life = p.life || 80, h = life / 2, n = p.t || 0, dir = p.dir || s, spd = p.speed || 9.5;
  if (n >= h && n < h + 34) {   // the turn: where it stood still (the boomerang's path, core.js), feathers drift down from it
    const ext = (m) => m - (m * (m + 1)) / life, tx = p.x - dir * spd * (ext(n) - ext(h)), age = n - h;
    c.save();
    for (let i = 0; i < 4; i++) hkOdnFeather(c, tx + (nz(i * 3.1) - 0.5) * 26 + Math.sin(age * 0.18 + i * 2) * 6, p.y - 6 + age * (0.8 + nz(i * 1.7) * 0.6) + i * 3, age * 0.12 + i * 1.3, Math.max(0, 1 - age / 34));
    c.restore();
  }
  if (!rdy) hkOdnPennant(c, p.x - s * 10, p.y - 1, s > 0 ? 0 : Math.PI, 26 + sp * 8, 7, HK_ODN_WAKE, Math.min(1, 0.35 + sp / 9.5));
  c.save(); c.translate(p.x, p.y); c.scale(s, 1);
  hkOdnBird(c, rdy ? 1.5 : 1.25, Math.sin(tk * 0.6) * 0.7, rdy);
  c.restore();
}

/* ---------- Gungnir: a stage-long gold line, rune rings opening where it passed, a pennant on the way back ---------- */
function hkOdnSpear(c, g, f, tk) {
  let p = null;
  for (const q of g.projs) if (q.owner === f.slot && q.style === "spear") { p = q; break; }
  let L = HK_ODN.ln[f.slot];
  if (L && L.g !== g) L = HK_ODN.ln[f.slot] = null;
  if (p) {
    const life = p.life || 100, h = life / 2, n = p.t || 0, dir = p.dir || 1, spd = p.speed || 22, ext = (m) => spd * (m - (m * (m + 1)) / life);
    const x0 = p.x - dir * ext(n), x1 = x0 + dir * ext(Math.min(n, h));
    L = HK_ODN.ln[f.slot] = { g, x0, x1, xf: x0 + dir * ext(h), dir, y: L && L.p === p && n > h ? L.y : p.y, p, px: p.x, back: n > h, end: -1 };
  } else if (L && L.end < 0) { L.end = tk; L.thru = Math.abs(L.px - f.x) > 100; }   // gone far from him: it hit (a spear that comes home is caught)
  if (!L) return;
  const thru = L.end >= 0 && L.thru;   // it hit: the line runs on through him
  const age = L.end < 0 ? 0 : tk - L.end, a = L.end < 0 ? 1 : thru ? 1 - Math.max(0, age - 22) / 14 : 1 - age / 16;
  if (a <= 0) { HK_ODN.ln[f.slot] = null; return; }
  const K = HK_KIT.odin, C = K.cols, d = L.dir, y = L.y, xa = L.x0 + d * 30;
  const x1 = thru && !L.back ? L.x1 + (L.xf - L.x1) * ease(clamp((age - 1) / 6, 0, 1)) : L.x1;   // (from the third tick of the hit: the impact frames own the first two)
  if (d * (x1 - xa) < 4) return;
  c.save(); c.globalAlpha = a; c.lineCap = "butt";
  hkStreak(c, [L.x0 - d * 6, y], [xa + d * 2, y], 5.5, K, { head: 1 });   // the line's root: a short lens out of his hand
  for (const [w, col] of [[9, HK_INK], [6.6, C[2]], [4.2, C[1]], [1.5, C[0]]]) { c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.moveTo(xa, y); c.lineTo(x1, y); c.stroke(); }
  if (thru && !L.back && age >= 2) hkStreak(c, [x1 - d * 40, y], [x1 + d * 26, y], 7, K, { head: 0.75 });   // the line's head running on
  for (let i = 0; ; i++) {   // the rune rings, standing across the line, each opens as the spear passes it
    const x = xa + d * (60 + i * 104), past = d * (x1 - x);
    if (past < 0) break;
    const k = L.back ? 1 : ease(clamp(past / 70, 0, 1));
    hkOdnRing(c, x, y, 6 + 26 * k, 1, k, i * 0.7);
    c.save(); c.translate(x, y); c.scale(0.3, 1); c.beginPath(); c.arc(0, 0, 4 + 30 * k, 0, CV_TAU); c.lineWidth = 2.2; c.strokeStyle = C[0]; c.globalAlpha = a * 0.7 * k; c.stroke(); c.restore();
    c.globalAlpha = a;
  }
  c.restore();
}

UV_BACK.odin = (c, g, f, tk) => {
  hkSamOwnFx(c, f);
  hkSamHeavy(c, f, tk, hkOdnHv);
  hkOdnSpear(c, g, f, tk);
};
