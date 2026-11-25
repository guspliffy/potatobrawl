/* ===================== Dragon's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) =====================
   Rolling flame (#fff0b0 #ff8a1f #d92c1f): three claw crescents for the rakes, a flame crescent for the horn toss and a flat ring of
   flame round the floor for the tail sweep (all behind the fighters: UV_BACK), Flame Breath's five puffs drawn together as one tongue of
   overlapping lobes with an ink edge and a hot core, a scalloped scorch on the floor, and Hellfire's payoff: one beam with a white core
   that fills the lane, lobes rolling along its edges, the foe a crisp shadow inside it. Flat fills only; the shared T5 tools are in
   ui/hk-phoenix.js (hkPhx*). */
const HK_DRG = HK_KIT.dragon;
HK_DRG.charge = (c, f, P, tk, st, q, pts) => hkPhxCharge(c, f, P, tk, st, q, pts, HK_DRG, CHARGE_GATHER.dragon);
HK_DRG.rec = (e, f, live) => hkPhxRec(e, HK_DRG, live);
// the floor mark: a scalloped scorch (a dark disc with a lobed rim), a red rim line and a few embers on it
HK_DRG.mark = function hkDrgMark(c, x, y, w, K, a) {
  const C = K.cols, ga = c.globalAlpha, al = ga * (a === undefined ? 1 : a);
  c.save(); c.translate(x, y); c.scale(1, 0.26);
  c.beginPath(); c.arc(0, 0, w * 0.82, 0, CV_TAU);
  for (let i = 0; i < 9; i++) { const an = (i / 9) * CV_TAU + 0.2, rx = Math.cos(an) * w * 0.82, ry = Math.sin(an) * w * 0.82; c.moveTo(rx + w * 0.24, ry); c.arc(rx, ry, w * 0.24, 0, CV_TAU); }
  c.globalAlpha = al * 0.5; c.fillStyle = HK_INK; c.fill();
  c.globalAlpha = al; c.setLineDash([w * 0.5, w * 0.3]); c.beginPath(); c.arc(0, 0, w * 0.7, 0, CV_TAU); c.lineWidth = 3; c.strokeStyle = C[2]; c.stroke(); c.setLineDash([]);
  c.restore();
  c.fillStyle = C[1];
  for (let i = 0; i < 4; i++) { c.globalAlpha = al * (i % 2 ? 0.9 : 0.6); c.beginPath(); c.arc(x - w * 0.6 + i * w * 0.4, y - 1 - (i % 2) * 3, 1.8 + (i % 2), 0, CV_TAU); c.fill(); }
  c.globalAlpha = ga;
};
// lobes: discs that overlap into one shape, drawn in layers across all of them (the ink under all, then the edge, the body and the hot
// core of each nudged forward and down), so a cluster reads as one rolling flame. L = [[x, y, r, alpha], ...]; C the three colours
function hkDrgLobes(c, L, C, core) {
  const ga = c.globalAlpha;
  for (const [k, colr, ink] of [[1, C[2], 1], [0.7, C[1], 0], [core || 0.38, C[0], 0]]) {
    c.fillStyle = ink ? HK_INK : colr;
    for (const [x, y, r, a] of L) { c.globalAlpha = ga * (a === undefined ? 1 : a); c.beginPath(); c.arc(x + (1 - k) * r * 0.45, y + (1 - k) * r * 0.15, ink ? r + 2.2 : r * k, 0, CV_TAU); c.fill(); }
    if (ink) { c.fillStyle = colr; for (const [x, y, r, a] of L) { c.globalAlpha = ga * (a === undefined ? 1 : a); c.beginPath(); c.arc(x, y, r, 0, CV_TAU); c.fill(); } }
  }
  c.globalAlpha = ga;
}

// Flame Breath (drawProj, style "fire" from a Dragon): the five puffs of one breath are drawn together by the first of them, as lobes that
// grow as they roll out (a puff lives 16 ticks) so the stream overlaps into one tongue. rdy (finish-ready): every puff half as big again
// and dragging two lobes back towards the mouth (one thick stream) with a hotter core
function hkDrgBreath(c, p, tk, k, rdy) {
  const all = RG && RG.projs ? RG.projs : null, own = all ? all.filter((q) => q.style === "fire" && q.owner === p.owner) : [];
  if (own.length > 1 && own.indexOf(p) > 0) return;   // drawn with the first
  const list = own.indexOf(p) === 0 ? own : [p], L = [];
  for (let i = 1; i < list.length; i++) {   // a lobe between each two puffs, so the stream reads as one tongue
    const q0 = list[i - 1], q1 = list[i], u0 = Math.min(1, q0.t / (q0.life || 16)), u1 = Math.min(1, q1.t / (q1.life || 16));
    if (Math.hypot(q1.x - q0.x, q1.y - q0.y) < 70 * k) L.push([(q0.x + q1.x) / 2, (q0.y + q1.y) / 2, (q0.r + q1.r) * 0.5 * k * (0.5 + 0.35 * (u0 + u1)), u0 > 0.78 || u1 > 0.78 ? 0.6 : 1]);
  }
  for (const q of list) {
    const u = Math.min(1, q.t / (q.life || 16)), R = q.r * k * (0.55 + 0.7 * u), a = u > 0.78 ? Math.max(0, 1 - (u - 0.78) / 0.22) : 1;
    const sp = Math.hypot(q.vx, q.vy) || 1, dx = q.vx / sp, dy = q.vy / sp, roll = Math.sin(tk * 0.5 + q.x * 0.07) * R * 0.12;
    if (rdy) for (let j = 2; j >= 1; j--) L.push([q.x - dx * R * 0.7 * j, q.y - dy * R * 0.7 * j, R * (0.85 - j * 0.12), a]);
    L.push([q.x - dx * R * 0.35 - dy * R * 0.42, q.y - dy * R * 0.35 + dx * R * 0.42 + roll, R * 0.62, a]);
    L.push([q.x - dx * R * 0.35 + dy * R * 0.42, q.y - dy * R * 0.35 - dx * R * 0.42 - roll, R * 0.62, a]);
    L.push([q.x, q.y, R * 0.8, a]);
  }
  hkDrgLobes(c, L, HK_DRG.cols, rdy ? 0.5 : 0.38);
}

// a fire light (drawFlame, fighter space): four lobes rolling out of the mouth to the contact point (never past it), growing as they go
function hkDrgFlame(c, P, S, tk) {
  const m = rot(P.mouthPt || [P.head[0] + P.hr * 1.5, P.head[1] + P.hr * 0.25], P.hip, P.lean), dx = S.tx - m[0], dy = S.ty - m[1];
  const R = S.r * (S.hv ? 0.72 : 0.6) * (1 + 0.5 * (S.ck || 0)) * (S.age === 0 ? 1.12 : 1), L = [];
  for (let i = 0; i < 4; i++) { const u = 0.18 + i * 0.26, r = R * (0.42 + 0.2 * i), w = Math.sin(tk * 0.6 + i * 1.9) * r * 0.12; L.push([m[0] + dx * u - dy / (Math.hypot(dx, dy) || 1) * w, m[1] + dy * u + w, r, 1]); }
  hkDrgLobes(c, L, HK_DRG.cols, 0.42);
}

// ---- the heavies' swing, behind the fighters (fighter space, facing +x) ----
function hkDrgHeavyBack(c, f, hv) {
  const K = HK_DRG, k = hv.key, wk = 1 + 0.6 * hv.ck;
  if (k === "hSide" || k === "hAir") {   // three claw crescents raked from above the head down onto the point, one frame full, then fading
    const a = hkPhxFade(hv.age, 1, 5);
    if (a <= 0) return;
    const air = k === "hAir", t = hkPhxPull(hv.age, 0.15);
    for (let i = 0; i < 3; i++) {
      const d = i * 9, a1 = (air ? 0.46 : 0.36) - i * 0.02, a0 = -2.0 + (a1 + 2.0) * t;
      hkSmear(c, 12 + d * 0.6 - (air ? 4 : 0), -42 + d, 66 - d * 0.3, a0, a1, (i === 1 ? 19 : 16) * wk, K, { a: a * (i === 1 ? 1 : 0.92) });
    }
  } else if (k === "hUp") {   // the horn toss: a flame crescent over the head, back to front, lobes thrown off its edge
    const a = hkPhxFade(hv.age, 2, 6);
    if (a <= 0) return;
    const a1 = -0.32, a0 = -Math.PI + 0.32 + (a1 + Math.PI - 0.32) * hkPhxPull(hv.age, 0.1);
    hkSmear(c, 2, -46, 50, a0, a1, 18 * wk, K, { a, ry: 0.92 });
    if (hv.age <= 2) { const ga = c.globalAlpha; c.globalAlpha = ga * a; for (let i = 0; i < 3; i++) { const an = -2.4 + i * 0.75; hkShard(c, 2 + Math.cos(an) * 58, -46 + Math.sin(an) * 54, 5 - i * 0.6, an, K, i); } c.globalAlpha = ga; }
  } else if (k === "hDown") {   // the tail sweep: a flat ring of flame round the feet, the near half first, the far half after it
    const a = hkPhxFade(hv.age, 2, 9);
    if (a <= 0) return;
    const t = hkPhxPull(hv.age, 0.08);
    hkSmear(c, 0, -9, 64, Math.PI + 0.2 - (Math.PI - 0.1) * t, 0.1, 15 * wk, K, { a, ry: 0.28 });
    hkSmear(c, 0, -9, 64, -0.05, -Math.PI + 0.35, 11 * wk, K, { a: a * 0.8, ry: 0.28 });
  }
}

/* ---------- Hellfire ---------- */
// the foe as a shadow: drawn once a frame into a small canvas at twice the world scale, filled with one dark colour (crisp at dsf 2)
const HK_DRG_SIL = { cv: null, x: null, S: 300, k: 2 };
function hkDrgShadow(c, o, tk) {
  const Z = HK_DRG_SIL, S = Z.S, k = Z.k;
  if (!Z.cv) { Z.cv = document.createElement("canvas"); Z.cv.width = Z.cv.height = S * k; Z.x = Z.cv.getContext("2d"); }
  const x = Z.x;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, S * k, S * k);
  x.setTransform(k, 0, 0, k, (S / 2) * k, S * 0.78 * k);
  drawFighter0(x, o, tk, [0, 0]);
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
  x.globalCompositeOperation = "source-in"; x.fillStyle = "#3a0e12"; x.fillRect(0, 0, S * k, S * k); x.globalCompositeOperation = "source-over";
  c.drawImage(Z.cv, o.x - S / 2, o.y - S * 0.78, S, S);
}
// the beam (front, world space, mt 25..73): a wedge from the mouth to the far end in five tones (ink, red, orange, gold, a white core),
// lobes rolling out along both edges, the blast (mt 61..66) wider with a flare of lobes at the far end; then every fighter it holds is
// drawn over it as a shadow
function hkDrgHellfire(c, g, f, tk) {
  const mt = f.mt, d = f.facing, K = HK_DRG, C = K.cols;
  if (mt < 25 || mt > 73) return;
  const blast = mt >= 61 && mt <= 66, len = mt <= 66 ? 408 * easeOut2(clamp((mt - 24) / 6, 0, 1)) : 408 * Math.max(0, 1 - (mt - 66) / 7);
  if (len < 12) return;
  const [ox, oy] = uvMouthWorld(f, tk), ex = f.x + d * len, ey = f.y - 50, L = Math.hypot(ex - ox, ey - oy), ang = Math.atan2(ey - oy, ex - ox);
  const hw1 = blast ? 64 : 46, hw = (u) => 6 + (hw1 - 6) * Math.pow(u, 0.7), N = 14, ga = c.globalAlpha;
  c.save(); c.globalAlpha = ga * (mt > 66 ? Math.max(0, 1 - (mt - 66) / 7) : 1);
  c.translate(ox, oy); c.rotate(ang); c.lineJoin = "round";
  const wedge = (k, extra, colr, ph) => {
    c.beginPath(); c.moveTo(0, -(4 * k + extra));
    for (let i = 1; i <= N; i++) { const u = i / N; c.lineTo(u * L, -(hw(u) * k + extra) + Math.sin(tk * 0.9 - u * 11 + ph) * (1.5 + 3 * u) * k); }
    c.lineTo(L + hw1 * 0.32 * k + extra, 0);
    for (let i = N; i >= 1; i--) { const u = i / N; c.lineTo(u * L, hw(u) * k + extra + Math.sin(tk * 0.9 - u * 11 + ph + 2.1) * (1.5 + 3 * u) * k); }
    c.lineTo(0, 4 * k + extra); c.closePath(); c.fillStyle = colr; c.fill();
  };
  wedge(1, 3, HK_INK, 0); wedge(1, 0, C[2], 0); wedge(0.74, 0, C[1], 1.2); wedge(0.48, 0, C[0], 2.3); wedge(0.2, 0, "#ffffff", 3.1);
  // lobes rolling out along both edges, bigger towards the far end
  const Lb = [];
  for (let i = 0; i < 9; i++) {
    const u = ((i + tk * 0.11) % 9) / 9, r = (5 + 13 * u) * (blast ? 1.25 : 1), x = 18 + u * (L - 18), h = hw(x / L);
    Lb.push([x, -h + r * 0.35, r, Math.min(1, u * 6)]); Lb.push([x + 9, h - r * 0.35, r * 0.92, Math.min(1, u * 6)]);
  }
  if (blast) for (let i = 0; i < 8; i++) { const an = (i / 8) * CV_TAU + tk * 0.05, rr = 34 + 26 * ((mt - 61) / 5); Lb.push([L + Math.cos(an) * rr * 0.6, Math.sin(an) * rr, 15 - i % 2 * 4, 1]); }
  hkDrgLobes(c, Lb, [C[1], C[2], C[2]], 0.38);
  c.restore();
  // the fighters it holds: shadows inside the beam
  for (const o of g.fighters) {
    if (o === f || o.state === "dead" || o.state === "gone" || o.team === f.team && o.team !== undefined && g.fighters.length > 2) continue;
    const u = (o.x - ox) * d / Math.max(1, Math.abs(ex - ox)), cy = o.y - o.s.h * 0.5;
    if (u < 0 || u > 1.08 || Math.abs(cy - (oy + (ey - oy) * Math.min(1, u))) > hw(Math.min(1, u)) + o.s.h * 0.3) continue;
    c.globalAlpha = ga; hkDrgShadow(c, o, tk);
  }
  c.globalAlpha = ga;
}
// behind the fighters while he breathes: the lane lit (a flat band) and the floor scorched under the stream
function hkDrgHellBack(c, f, tk) {
  const mt = f.mt, d = f.facing, C = HK_DRG.cols;
  if (mt < 25 || mt > 80) return;
  const len = mt <= 66 ? 408 * easeOut2(clamp((mt - 24) / 6, 0, 1)) : 408, a = mt <= 66 ? 1 : Math.max(0, 1 - (mt - 66) / 14);
  if (len < 12) return;
  const x0 = f.x + d * 40, x1 = f.x + d * len, ga = c.globalAlpha;
  if (mt <= 73) {   // the lane lit: two flat wedges widening from the mouth to the far end, cut off at the floor
    const wedge = (h0, h1, colr, al) => { c.globalAlpha = ga * a * al; c.fillStyle = colr; c.beginPath(); c.moveTo(x0, f.y - 52 - h0); c.lineTo(x1, f.y - 50 - h1); c.lineTo(x1, f.y + 4); c.lineTo(x0, Math.min(f.y + 4, f.y - 52 + h0)); c.closePath(); c.fill(); };
    wedge(26, 96, C[1], 0.16); wedge(14, 58, C[0], 0.14);
  }
  c.save(); c.translate(0, f.y); c.scale(1, 0.26); c.globalAlpha = ga * a * 0.55; c.fillStyle = HK_INK;   // the scorch under the stream: a row of lobes
  c.beginPath(); for (let i = 0; i <= 8; i++) { const x = x0 + (x1 - x0) * (i / 8), r = 16 + i * 3; c.moveTo(x + r, 0); c.arc(x, 0, r, 0, CV_TAU); } c.fill();
  c.restore();
  c.globalAlpha = ga;
}
UV_BACK.dragon = function hkDrgBack(c, g, f, tk) {
  const hv = hkPhxHv(f);
  if (hv && hv.age >= 0) { c.save(); c.translate(f.x, f.y); c.scale(f.facing, 1); hkDrgHeavyBack(c, f, hv); c.restore(); }
  if (uvHeld(f) === "hellfire") hkDrgHellBack(c, f, tk);
  c.globalAlpha = 1;
};
