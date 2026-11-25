/* ===================== Alchemist's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) =====================
   Bubbling acid (#f0ffd0 #8dff3a #7a3fd0): the zaps a forked bolt (ink, purple, lime, a cream core) re-forked every other frame, full for
   two frames and flickering after, with a lime ribbon on the flask's arc behind the fighters; the flask smash a splash crown of beads on
   both sides; the Toxic Orb an orb with a dark crescent and a meniscus, two shrinking droplets behind it and a dashed dome where it will
   burst; the burst a cluster of beads inside its dashed true size; puddle beads on the floor; and Mutagen Cloud's payoff: one giant living
   cell with a broken lime rim, a clear inside and two nuclei, the last pulse a thick cream ring over a faint lime wash. Flat fills only; the
   shared T5 tools are in ui/hk-phoenix.js (hkPhx*). */
const HK_ALC = HK_KIT.alchemist;
HK_ALC.charge = (c, f, P, tk, st, q, pts) => hkPhxCharge(c, f, P, tk, st, q, pts, HK_ALC, CHARGE_GATHER.alchemist);
HK_ALC.rec = (e, f, live) => hkPhxRec(e, HK_ALC, live);
// the floor mark: a lime puddle with a purple edge and the ink under it, three beads beside it
HK_ALC.mark = function hkAlcMark(c, x, y, w, K, a) {
  const C = K.cols, ga = c.globalAlpha;
  c.globalAlpha = ga * (a === undefined ? 1 : a);
  const blob = (k) => { c.beginPath(); for (let i = 0; i <= 12; i++) { const an = (i / 12) * CV_TAU, r = w * k * (0.82 + 0.18 * Math.sin(i * 2.7)); c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r * 0.26); } c.closePath(); };
  blob(0.78); c.fillStyle = C[2]; c.fill(); c.lineWidth = 2; c.strokeStyle = HK_INK; c.stroke();
  blob(0.6); c.fillStyle = C[1]; c.fill();
  c.fillStyle = C[0]; c.beginPath(); c.ellipse(x - w * 0.22, y - 1, w * 0.16, w * 0.04 + 0.6, 0, 0, CV_TAU); c.fill();
  for (let i = 0; i < 3; i++) hkShard(c, x - w * 0.95 + i * w * 0.95, y - 3 - (i % 2) * 5, 4 - (i % 2), 0, K, i);
  c.globalAlpha = ga;
};
// a bolt: a polyline stroked four times (ink, purple, lime, cream), miter joins (the mockup's bolt)
function hkAlcBolt(c, pts, C, w) {
  c.lineJoin = "miter"; c.lineCap = "round";
  for (const [lw, colr] of [[w + 4, HK_INK], [w, C[2]], [w * 0.58, C[1]], [w * 0.24, C[0]]]) {
    c.lineWidth = lw; c.strokeStyle = colr; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  }
  c.lineJoin = "round";
}
// a few beads (shards of the kit) round a point, still: the bubble burst at a bolt's end
function hkAlcBeads(c, x, y, r, n, seed) {
  for (let i = 0; i < n; i++) { const an = nz(seed + i * 3.3) * CV_TAU, d = r * (0.3 + 0.7 * nz(seed + i * 7.1)); hkShard(c, x + Math.cos(an) * d, y + Math.sin(an) * d, r * (0.32 + 0.22 * nz(seed + i * 1.9)), 0, HK_ALC, i); }
}
// the charge-up's gather (CHARGE_GATHER.alchemist): short kit bolts forking out of the hand, re-rolled every other tick, beads at
// their ends; q how far it has built up (more forks past half), r their reach
function hkAlcCrackle(c, x, y, tk, q, r) {
  const seed = (tk >> 1) * 7.13, n = 3 + (q > 0.55 ? 2 : 0);
  for (let i = 0; i < n; i++) {
    const a0 = nz(seed + i * 3.1) * CV_TAU, len = r * (0.7 + 0.8 * nz(seed + i * 5.7)), ca = Math.cos(a0), sa = Math.sin(a0), pts = [[x + ca * 4, y + sa * 4]];
    for (let j = 1; j <= 3; j++) { const t = j / 3, jt = (nz(seed + i * 9.1 + j * 2.7) - 0.5) * 9; pts.push([x + ca * (4 + len * t) - sa * jt, y + sa * (4 + len * t) + ca * jt]); }
    hkAlcBolt(c, pts, HK_ALC.cols, 2.2);
    if (i < 2) hkShard(c, pts[3][0], pts[3][1], 3.4, 0, HK_ALC, i);
  }
}
// the zap (drawZap, fighter space): from the chest through the flask hand to the contact point (the box's centre, never past it), the
// shape re-forked every other frame, a fork off the middle; full for the first two active frames, then a thinner flicker. alt: the
// 200-chip skin's second fork in its own colour (kept from the old zap)
function hkAlcZap(c, from, S, tk, alt) {
  const C = HK_ALC.cols, age = S.age || 0, ck = S.ck || 0;
  const x1 = S.tx + 0, y1 = S.ty, dx0 = x1 - from[0], dy0 = y1 - from[1], dl = Math.hypot(dx0, dy0) || 1, ux = dx0 / dl, uy = dy0 / dl;
  const x0 = from[0] - ux * 22, y0 = from[1] - uy * 22, dx = x1 - x0, dy = y1 - y0, nx = -uy, ny = ux, seed = (tk >> 1) * 5.3, n = 6;
  const pts = [[x0, y0]];
  for (let i = 1; i < n; i++) { const j = (nz(seed + i * 1.7) - 0.5) * 2 * (i % 2 ? 9 : 6); pts.push([x0 + dx * (i / n) + nx * j, y0 + dy * (i / n) + ny * j]); }
  pts.push([x1, y1]);
  const full = age < 2, w = (full ? 6.5 : 4.4) * (1 + 0.6 * ck), ga = c.globalAlpha;
  if (!full) c.globalAlpha = ga * (0.62 + 0.3 * (age & 1));
  hkAlcBolt(c, pts, C, w);
  const m = pts[3], fs = nz(seed + 9) > 0.5 ? 1 : -1;   // the fork
  hkAlcBolt(c, [m, [m[0] + dx * 0.16 + nx * 12 * fs, m[1] + dy * 0.16 + ny * 12 * fs], [m[0] + dx * 0.3 + nx * 8 * fs, m[1] + dy * 0.3 + ny * 18 * fs]], C, w * 0.55);
  if (alt) {
    c.strokeStyle = alt; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const j = (nz(seed + i * 4.1 + 2) - 0.5) * 2 * 10; c.lineTo(x0 + dx * (i / n) + nx * j, y0 + dy * (i / n) + ny * j); }
    c.lineTo(x1, y1); c.stroke();
  }
  hkAlcBeads(c, x1, y1, full ? 9 : 7, full ? 5 : 3, (tk >> 1) + 3);   // the bubble burst on the contact point
  c.globalAlpha = ga;
}
// the Toxic Orb (drawProj, style "orb"): two shrinking droplets behind it, a flat lime glow, the orb (ink, a purple rim, lime, a dark
// crescent below, a cream meniscus line that tips with the flight, a highlight). k the drawing's scale; rdy (finish-ready): a lime
// ribbon tail and drips falling off it
function hkAlcOrb(c, p, tk, k, rdy) {
  const C = HK_ALC.cols, R = p.r * 0.9 * k, sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
  c.save(); c.lineJoin = "round";
  if (rdy) {
    hkStreak(c, [p.x - ux * R * 4.6, p.y - uy * R * 4.6], [p.x, p.y], R * 0.85, HK_ALC, { head: 0.8, a: 0.9 });
    for (let i = 0; i < 5; i++) {   // drips falling off the tail
      const ph = (tk * 0.045 + i / 5 + nz(i * 3.3) * 0.2) % 1, x = p.x - p.vx * (1.4 + i * 1.8) + (nz(i * 9.7) - 0.5) * 8, y = p.y + R * 0.5 + ph * 30 + i;
      c.globalAlpha = Math.min(1, (1 - ph) * 1.3); c.fillStyle = i % 2 ? C[0] : C[1];
      c.beginPath(); c.moveTo(x, y - 6.2); c.quadraticCurveTo(x + 3.8, y + 1.2, x, y + 3.8); c.quadraticCurveTo(x - 3.8, y + 1.2, x, y - 6.2); c.fill(); c.lineWidth = 1.2; c.strokeStyle = HK_INK; c.stroke();
    }
    c.globalAlpha = 1;
  } else for (let i = 1; i <= 2; i++) {   // two droplets left behind on the arc, shrinking
    const x = p.x - p.vx * i * 2.4, y = p.y - p.vy * i * 2.4, r = R * (0.36 - i * 0.1);
    c.beginPath(); c.arc(x, y, r, 0, CV_TAU); c.fillStyle = C[1]; c.fill(); c.lineWidth = 1.4; c.strokeStyle = HK_INK; c.stroke();
  }
  hkPhxHalo(c, p.x, p.y, R * 2.1, C[1], 0.8);
  c.translate(p.x, p.y);
  c.beginPath(); c.arc(0, 0, R + 1.3, 0, CV_TAU); c.fillStyle = HK_INK; c.fill();
  c.beginPath(); c.arc(0, 0, R, 0, CV_TAU); c.fillStyle = C[2]; c.fill();
  c.beginPath(); c.arc(0, 0, R * 0.8, 0, CV_TAU); c.fillStyle = C[1]; c.fill();
  c.save(); c.beginPath(); c.arc(0, 0, R * 0.8, 0, CV_TAU); c.clip();
  c.rotate(Math.atan2(p.vy, p.vx) * 0.3 + Math.sin(tk * 0.2) * 0.1);   // the liquid tips with the flight and sloshes
  c.fillStyle = cvMix(C[1], HK_INK, 0.42); c.beginPath(); c.arc(0, 0, R * 0.8, 0.25, Math.PI - 0.25); c.arc(-R * 0.1, -R * 0.32, R * 0.86, Math.PI - 0.5, 0.5, true); c.closePath(); c.fill();   // the dark crescent
  c.strokeStyle = C[0]; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-R * 0.8, R * 0.06); c.quadraticCurveTo(-R * 0.3, -R * 0.08, 0, R * 0.04); c.quadraticCurveTo(R * 0.4, R * 0.14, R * 0.8, -R * 0.02); c.stroke();   // the meniscus
  c.restore();
  c.fillStyle = C[0]; c.beginPath(); c.ellipse(-R * 0.36, -R * 0.42, R * 0.3, R * 0.15, -0.6, 0, CV_TAU); c.fill();
  c.restore();
}
// where an orb will burst (UV_BACK, behind the fighters): its flight stepped on like core.js does (gravity, then the move) until it meets
// the main floor or its life runs out; there a dashed dome of the burst's true size and a dashed ring on the floor
function hkAlcLanding(c, p, tk) {
  const S = STAGE.main, b = p.burst;
  if (!b || p.t < 2) return;
  let x = p.x, y = p.y, vx = p.vx, vy = p.vy, t = p.t, hitFloor = false;
  for (; t < p.life; t++) {
    vy += p.grav; x += vx; y += vy;
    if (x > S.x1 && x < S.x2 && y > S.top - 2 && y < S.bottom) { hitFloor = true; y = S.top - 6; break; }
  }
  const C = HK_ALC.cols, a = Math.min(1, (p.t - 2) / 6), r = b.r, ga = c.globalAlpha;
  c.save(); c.globalAlpha = ga * a; c.lineCap = "round";
  c.setLineDash([7, 6]); c.lineDashOffset = -tk * 0.4; c.lineWidth = 2.2; c.strokeStyle = C[1];
  c.beginPath(); if (hitFloor) c.arc(x, y + 6, r, Math.PI, CV_TAU); else c.arc(x, y, r, 0, CV_TAU); c.stroke();
  if (hitFloor) {
    c.translate(x, S.top); c.scale(1, 0.26); c.beginPath(); c.arc(0, 0, r * 0.8, 0, CV_TAU);
    c.setLineDash([10, 7]); c.lineWidth = 6; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = C[1]; c.stroke();
  }
  c.setLineDash([]); c.restore();
  c.globalAlpha = ga;
}
// the burst event (handleEvent "burst"): beads thrown up and out, and a lime puddle with its beads where it met the main floor
function hkAlcBurstFx(e) {
  const S = STAGE.main;
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 16, r0: 8, r1: e.r * 1.2, col: HK_ALC.cols[1] });
  hkPhxShards(HK_ALC, e.x, e.y, 10, -Math.PI / 2, 2.8, 7, 5, 22, 0.25);
  if (Math.abs(e.y - (S.top - 6)) < 3 && e.x > S.x1 && e.x < S.x2) addFx({ k: "hkm", kit: HK_ALC, x: e.x, y: S.top, w: e.r * 0.62, t: 0, life: 70 });
}
// the burst (drawProj, style "burst", 12 ticks): the dashed true size flaring out, a cluster of beads popping inside it
function hkAlcBurst(c, p, tk) {
  const K = HK_ALC, C = K.cols, q = p.t / p.life, R = p.r * (0.55 + 0.45 * ease(Math.min(1, q * 1.6))), a = 1 - q * q;
  c.save(); c.globalAlpha = a; c.lineJoin = "round";
  c.setLineDash([9, 7]); c.lineWidth = 2.6; c.strokeStyle = C[1]; c.beginPath(); c.arc(p.x, p.y, p.r * (0.92 + 0.08 * q), 0, CV_TAU); c.stroke(); c.setLineDash([]);
  hkPhxHalo(c, p.x, p.y, R, C[1], 0.8);
  const s = R * 0.5 * (1 - q * 0.4);
  hkLayer(c, p.x, p.y, s, "bubble", q * 1.5, 0, 0); c.fillStyle = C[2]; c.fill(); c.lineWidth = 2.2; c.strokeStyle = HK_INK; c.stroke();
  hkLayer(c, p.x, p.y, s * 0.72, "bubble", q * 1.5 + 0.45, 0, 0); c.fillStyle = C[1]; c.fill();
  hkLayer(c, p.x, p.y, s * 0.4, "bubble", q * 1.5, 0, 0); c.fillStyle = C[0]; c.fill();
  c.restore();
}

// ---- the heavies, behind the fighters (fighter space, facing +x) ----
function hkAlcHeavyBack(c, f, hv) {
  const K = HK_ALC, k = hv.key, wk = 1 + 0.6 * hv.ck;
  if (k === "hSide" || k === "hAir" || k === "hUp") {   // the flask's arc: a lime ribbon, full on the first active frame
    const a = hkPhxFade(hv.age, 1, 4);
    if (a <= 0) return;
    if (k === "hUp") { const a1 = -1.72, a0 = -0.2 + (a1 + 0.2) * hkPhxPull(hv.age, 0.14); hkSmear(c, 0, -36, 40, a0, a1, 14 * wk, K, { a }); }
    else { const a1 = -0.12, a0 = -2.35 + (a1 + 2.35) * hkPhxPull(hv.age, 0.14); hkSmear(c, 2, -30, 40, a0, a1, 14 * wk, K, { a }); }
  } else if (k === "hDown") {   // the flask smashed: on both sides a splash ring on the floor and a crown of beads thrown up and out
    const age = hv.age + 1, a = 1 - age / 15;
    if (hv.age < 0 || a <= 0) return;
    const ga = c.globalAlpha;
    for (const sx of [1, -1]) {
      const x = sx * 33, r = 10 + age * 3.4;
      c.globalAlpha = ga * Math.min(1, a * 1.4);
      c.save(); c.translate(x, -3); c.scale(1, 0.26); c.setLineDash([9, 6]); c.lineDashOffset = sx * age * 2;
      c.beginPath(); c.arc(0, 0, r, 0, CV_TAU); c.lineWidth = 7; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = K.cols[1]; c.stroke();
      c.setLineDash([]); c.restore();
      for (let i = 0; i < 6; i++) {   // the crown: beads thrown up in a fan, falling back
        const an = -Math.PI / 2 + (i - 2.5) * 0.36, v = 2.6 + (i % 3) * 0.7, bx = x + Math.cos(an) * v * age * 1.3 * (1 + 0.3 * hv.ck), by = -4 + Math.sin(an) * v * age * 1.6 + age * age * 0.12;
        if (by < 2) hkShard(c, bx, by, (5.4 - (i % 3)) * (1 - age / 30), 0, K, i);
      }
    }
    c.globalAlpha = ga;
  }
}

/* ---------- Mutagen Cloud ---------- */
// the living cell (drawProj, style "cloud": already under the fighters): a clear inside (a faint lime tint), a broken rim (ink and lime
// dashes on a wobbling outline that swells on every pulse), an inner membrane, two purple nuclei drifting, bubbles rising and popping;
// in the 30 ticks before the last pulse it trembles and its rim turns cream
function hkAlcCell(c, p, tk) {
  const C = HK_ALC.cols, r = p.r, grow = easeOut2(clamp(p.t / 10, 0, 1)), ph = p.t % 30;
  const pulse = p.t >= 30 ? Math.max(0, 1 - ph / 12) : 0, charge = p.t >= p.life - 31 ? clamp((p.t - (p.life - 31)) / 30, 0, 1) : 0;
  const R = r * grow * (1 + 0.1 * pulse + 0.04 * charge + Math.sin(tk * 0.15) * 0.012);
  if (R < 4) return;
  c.save(); c.translate(p.x + (charge ? Math.sin(tk * 1.9) * 2.4 * charge : 0), p.y); c.lineJoin = "round"; c.lineCap = "butt";
  const blob = (k, ph0) => { c.beginPath(); for (let i = 0; i <= 36; i++) { const an = (i / 36) * CV_TAU, w = 1 + 0.035 * Math.sin(an * 3 + tk * 0.06 + ph0) + 0.025 * Math.sin(an * 5 - tk * 0.045); if (i) c.lineTo(Math.cos(an) * R * k * w, Math.sin(an) * R * k * w * 0.94); else c.moveTo(Math.cos(an) * R * k * w, Math.sin(an) * R * k * w * 0.94); } c.closePath(); };
  blob(1, 0);
  c.globalAlpha = 0.13 + 0.08 * pulse + 0.12 * charge; c.fillStyle = charge > 0.5 ? C[0] : C[1]; c.fill();
  c.globalAlpha = 0.16; c.fillStyle = C[0]; blob(0.62, 1.7); c.fill();   // the clearer middle
  // the nuclei: two purple blobs with the ink and a highlight, drifting round the middle
  c.globalAlpha = 1;
  for (let i = 0; i < 2; i++) {
    const an = tk * 0.012 * (i ? -1 : 1) + i * 2.6, d = R * (0.46 + 0.08 * Math.sin(tk * 0.03 + i)), x = Math.cos(an) * d, y = Math.sin(an) * d * 0.8, s = R * (i ? 0.1 : 0.14);
    c.beginPath(); c.ellipse(x, y, s * 1.25, s, an, 0, CV_TAU); c.fillStyle = C[2]; c.fill(); c.lineWidth = 2; c.strokeStyle = HK_INK; c.stroke();
    c.fillStyle = cvMix(C[2], "#ffffff", 0.45); c.beginPath(); c.ellipse(x - s * 0.35, y - s * 0.35, s * 0.35, s * 0.2, -0.6, 0, CV_TAU); c.fill();
  }
  // bubbles rise inside and pop at the top (outlines, a highlight)
  for (let i = 0; i < 8; i++) {
    const per = 70 + nz(i * 4.4) * 50, k = ((tk + nz(i * 8.8) * per) % per) / per, bx = (nz(i * 1.7) - 0.5) * R * 1.3, half = Math.sqrt(Math.max(0, R * R - bx * bx)) * 0.82;
    const by = half - k * half * 2, br = 3.5 + nz(i * 6.1) * 6 * (k < 0.9 ? 1 : 1 + (k - 0.9) * 8);
    c.globalAlpha = k > 0.94 ? (1 - k) / 0.06 : 0.9;
    c.beginPath(); c.arc(bx, by, br, 0, CV_TAU); c.lineWidth = 1.6; c.strokeStyle = C[0]; c.stroke();
    c.fillStyle = C[0]; c.beginPath(); c.arc(bx - br * 0.32, by - br * 0.32, br * 0.24, 0, CV_TAU); c.fill();
  }
  // the inner membrane, then the broken rim: thick ink dashes with the lime over them, turning slowly
  c.globalAlpha = 0.8; c.setLineDash([8, 10]); c.lineDashOffset = tk * 0.3; c.lineWidth = 2; c.strokeStyle = C[0]; blob(0.82, 3.1); c.stroke();
  c.globalAlpha = 1; blob(1, 0); c.setLineDash([R * 0.5, R * 0.2]); c.lineDashOffset = -tk * 0.25;
  c.lineWidth = 10 + 4 * pulse; c.strokeStyle = HK_INK; c.stroke();
  c.lineWidth = 5.4 + 3 * pulse; c.strokeStyle = charge > 0.5 ? C[0] : C[1]; c.stroke();
  c.setLineDash([]);
  c.restore();
}
// the cloud's pulse rings and the last pulse's flash (spawned by uvCloudTick, drawn behind the fighters): a pulse is a dashed lime ring
// running out from the rim; the last pulse washes the cell lime at 15 % and throws a thick cream ring
function hkAlcPulse(c, e) {
  const C = HK_ALC.cols, q = e.t / e.life, a = 1 - q, ga = c.globalAlpha;
  const R = lerp(e.r0, e.r1, easeOut2(q));
  c.save(); c.translate(e.x, e.y); c.lineCap = "butt";
  if (e.last) { c.globalAlpha = ga * a * 0.15; c.fillStyle = C[1]; c.beginPath(); c.arc(0, 0, e.r0 * (1 + 0.15 * q), 0, CV_TAU); c.fill(); }   // a clear inside (the victim stays readable): the flash is the thick ring
  c.globalAlpha = ga * a; c.setLineDash([R * 0.42, R * 0.18]); c.lineDashOffset = q * 30;
  c.beginPath(); c.arc(0, 0, R, 0, CV_TAU); c.lineWidth = (e.last ? 12 : 7) * a + 3; c.strokeStyle = HK_INK; c.stroke();
  c.lineWidth = (e.last ? 7 : 4) * a + 1.4; c.strokeStyle = e.last ? C[0] : C[1]; c.stroke();
  c.setLineDash([]); c.restore();
  c.globalAlpha = ga;
}
UV_BACK.alchemist = function hkAlcBack(c, g, f, tk) {
  const hv = hkPhxHv(f);
  if (hv && hv.age >= 0) { c.save(); c.translate(f.x, f.y); c.scale(f.facing, 1); hkAlcHeavyBack(c, f, hv); c.restore(); }
  for (const p of g.projs) if (p.style === "orb" && p.owner === f.slot) hkAlcLanding(c, p, tk);
  for (const e of fx) if (e.k === "hkalc" && e.owner === f.slot) hkAlcPulse(c, e);
  c.globalAlpha = 1;
};
