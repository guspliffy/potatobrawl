/* ===================== Wizard's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) =====================
   Cut crystal (#fffbe0 #ffd95a #8a5cf0): the staff's sweeps leave a segmented ribbon (crescent cuts on the tip's path, behind the
   fighters; the staff itself is hidden on the first active frame, fig-wizard.js reads P.hkHide), the tip flares as a faceted star, the
   slam stamps a dashed rune ring; Crystal Bolt is a long cut diamond with a segmented wake; three rune strokes on the floor; and Meteor
   Shower's payoff: each star falls as a cut crystal on a three-tone streak and leaves a crown of crystal points on the floor where it
   lands (UV_BACK, behind the fighters), the last one 1.7x the size. Flat fills only; the shared T5 tools are in ui/hk-phoenix.js. */
const HK_WIZ = HK_KIT.wizard;
HK_WIZ.charge = (c, f, P, tk, st, q, pts) => hkPhxCharge(c, f, P, tk, st, q, pts, HK_WIZ, CHARGE_GATHER.wizard);
HK_WIZ.rec = (e, f, live) => hkPhxRec(e, HK_WIZ, live);
// the floor mark: three rune strokes cut into the floor (ink under gold, a violet nick at each foot)
HK_WIZ.mark = function hkWizMark(c, x, y, w, K, a) {
  const C = K.cols, ga = c.globalAlpha, s = Math.max(5, w * 0.34);
  c.globalAlpha = ga * (a === undefined ? 1 : a); c.lineCap = "round"; c.lineJoin = "round";
  const strokes = [[[-1.3, 0.25], [-0.85, -0.55], [-0.55, 0.3]], [[-0.15, 0.35], [0.05, -0.7]], [[0.5, -0.5], [0.95, 0.05], [1.35, -0.45]]];
  for (const [lw, colr] of [[5.2, HK_INK], [2.6, C[1]]]) {
    c.lineWidth = lw; c.strokeStyle = colr; c.beginPath();
    for (const st of strokes) { c.moveTo(x + st[0][0] * s, y + st[0][1] * s * 0.5); for (let i = 1; i < st.length; i++) c.lineTo(x + st[i][0] * s, y + st[i][1] * s * 0.5); }
    c.stroke();
  }
  c.fillStyle = C[2]; for (const st of strokes) { c.beginPath(); c.arc(x + st[0][0] * s, y + st[0][1] * s * 0.5, 1.8, 0, CV_TAU); c.fill(); }
  c.globalAlpha = ga;
};
// a four-point crystal star (ink, violet edge, gold, a cream core): the tip's flare, the falling stars
function hkWizStar(c, x, y, s, rot, big) {
  const C = HK_WIZ.cols;
  c.lineJoin = "round";
  c.beginPath(); hkBurst(c, x, y, s * 1.12, 4, 0.3, rot, 999); c.fillStyle = HK_INK; c.fill();
  c.beginPath(); hkBurst(c, x, y, s, 4, 0.3, rot, 999); c.fillStyle = big ? C[1] : C[2]; c.fill();
  c.beginPath(); hkBurst(c, x, y, s * 0.78, 4, 0.3, rot, 999); c.fillStyle = big ? C[0] : C[1]; c.fill();
  c.beginPath(); hkBurst(c, x, y, s * 0.4, 4, 0.34, rot, 999); c.fillStyle = big ? "#ffffff" : C[0]; c.fill();
}
// the charge-up's gather (CHARGE_GATHER.wizard): the crystal flares as a cut star (at stage 3 with a long thin cross of light), crystal
// chips spiralling up off it
function hkWizFlare(c, x, y, tk, st, q) {
  const C = HK_WIZ.cols, s = (14 + 8 * q + (st === 3 ? 10 : 0) + Math.sin(tk * 0.3) * 2) * 0.72, ga = c.globalAlpha;
  if (st === 3) { c.fillStyle = C[2]; c.fillRect(x - 1.8, y - 28, 3.6, 56); c.fillRect(x - 28, y - 1.8, 56, 3.6); c.fillStyle = C[0]; c.fillRect(x - 0.8, y - 26, 1.6, 52); c.fillRect(x - 26, y - 0.8, 52, 1.6); }
  hkWizStar(c, x, y, s, tk * 0.04, st === 3);
  const n = st === 3 ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const ph = (tk * 0.04 + i / n) % 1, ang = i * 2.4 + tk * 0.09, rr = 8 + 11 * ph;
    c.globalAlpha = ga * Math.min(1, (1 - ph) * 1.4);
    hkShard(c, x + Math.cos(ang) * rr * 1.3, y - 4 - ph * 30 + Math.sin(ang) * 4, 2.2 + 2.6 * (1 - ph) * (0.6 + q * 0.6), ang, HK_WIZ, i);
  }
  c.globalAlpha = ga;
}
// the staff tip during a magic sweep (drawMagic, fighter space): a crystal star that flares on the first active frame, two chips trailing
function hkWizMagic(c, from, S, tk) {
  const age = S.age || 0, s = (age === 0 ? 13 : 9.5 - Math.min(3, age * 0.6)) * (1 + 0.4 * (S.ck || 0)), [x, y] = from;
  hkWizStar(c, x, y, s, tk * 0.08, age === 0);
  const ang = Math.atan2(S.ty - y, S.tx - x), ga = c.globalAlpha;
  for (let i = 1; i <= 2; i++) { c.globalAlpha = ga * (1 - i * 0.3); hkShard(c, x - Math.cos(ang) * (9 + i * 9), y - Math.sin(ang) * (9 + i * 9) + (i % 2 ? 5 : -5), 5 - i, ang, HK_WIZ, i); }
  c.globalAlpha = ga;
}
// the segmented ribbon: n crescent cuts along the arc a0 -> a1, each thicker than the last, small gaps between (cut crystal)
function hkWizRibbon(c, cx, cy, r, a0, a1, w, a, ry) {
  const n = 3, span = (a1 - a0) / n;
  for (let i = 0; i < n; i++) { const b0 = a0 + span * (i - 0.12), b1 = a0 + span * (i + 0.94); hkSmear(c, cx, cy, r, b0, b1, w * (0.5 + 0.5 * (i + 1) / n), HK_WIZ, { a, ry }); }
}
// Crystal Bolt (drawProj, style "bolt"): a segmented wake of diamonds (violet and gold in turn, growing to the bolt), a flat glow, the long
// cut diamond (gold top, violet underside, a cream facet, the ink), two twinkles. k the drawing's scale; rdy (finish-ready): a wake twice as
// long, an outer violet cut round the bolt and crystal chips tumbling behind
function hkWizBolt(c, p, tk, k, rdy) {
  const C = HK_WIZ.cols, R = p.r * k;
  c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx)); c.lineJoin = "round";
  const n = rdy ? 8 : 5;
  for (let i = n; i >= 1; i--) {
    const x = -R * 2.2 - i * R * (rdy ? 1.15 : 1.3), s = R * (0.62 - i * (rdy ? 0.045 : 0.07));
    if (s <= 1) continue;
    c.globalAlpha = 0.9 - i * (rdy ? 0.08 : 0.13); c.fillStyle = C[i % 2 ? 1 : 2];
    c.beginPath(); c.moveTo(x - s * 1.6, 0); c.lineTo(x, -s); c.lineTo(x + s * 1.6, 0); c.lineTo(x, s); c.closePath(); c.fill();
  }
  c.globalAlpha = 1;
  hkPhxHalo(c, 0, 0, R * 2.4, C[1], 0.85);
  if (rdy) {
    for (let i = 0; i < 4; i++) { const q = (tk * 0.07 + i / 4) % 1; c.globalAlpha = 1 - q; hkShard(c, -R * (1.6 + q * 7), (i % 2 ? 1 : -1) * R * (0.5 + q * 0.6), R * 0.42 * (1 - q * 0.5), tk * 0.2 + i, HK_WIZ, i); }
    c.globalAlpha = 0.6; c.fillStyle = C[2]; c.beginPath(); c.moveTo(R * 2, 0); c.lineTo(-R * 0.6, -R * 1.3); c.lineTo(-R * 3.1, 0); c.lineTo(-R * 0.6, R * 1.3); c.closePath(); c.fill();
    c.globalAlpha = 1;
  }
  const T = R * 1.5, B = -R * 2.6, M = -R * 0.4, H = R * 0.85;
  c.beginPath(); c.moveTo(T, 0); c.lineTo(M, -H); c.lineTo(B, 0); c.lineTo(M, H); c.closePath(); c.fillStyle = C[1]; c.fill();
  c.beginPath(); c.moveTo(T, 0); c.lineTo(B, 0); c.lineTo(M, H); c.closePath(); c.fillStyle = C[2]; c.fill();
  c.beginPath(); c.moveTo(T, 0); c.lineTo(M, -H * 0.62); c.lineTo(M - R * 0.9, 0); c.closePath(); c.fillStyle = C[0]; c.fill();
  c.beginPath(); c.moveTo(T, 0); c.lineTo(M, -H); c.lineTo(B, 0); c.lineTo(M, H); c.closePath(); c.lineWidth = 2.4; c.strokeStyle = HK_INK; c.stroke();
  star4(c, T * 0.7, -R * 1.25, 3.6 + 1.4 * Math.sin(tk * 0.4), C[0]); star4(c, -R * 1.6, R * 1.15, 2.6, C[0]);
  c.restore();
}

// ---- the heavies, behind the fighters (fighter space, facing +x) ----
function hkWizHeavyBack(c, f, hv) {
  const K = HK_WIZ, k = hv.key, wk = 1 + 0.6 * hv.ck;
  if (k === "hSide" || k === "hAir") {   // the thrust: a ribbon from high over the staff down onto the point in front
    const a = hkPhxFade(hv.age, 1, 5);
    if (a <= 0) return;
    const air = k === "hAir", a1 = air ? 0.14 : 0.1, a0 = -1.8 + (a1 + 1.8) * hkPhxPull(hv.age);
    hkWizRibbon(c, 18, air ? -42 : -40, air ? 54 : 58, a0, a1, 22 * wk, a, 1);
  } else if (k === "hUp") {   // the rise: front to back over the hat
    const a = hkPhxFade(hv.age, 1, 6);
    if (a <= 0) return;
    const a1 = -Math.PI + 0.4, a0 = -0.55 + (a1 + 0.55) * hkPhxPull(hv.age, 0.11);
    hkWizRibbon(c, 2, -50, 48, a0, a1, 18 * wk, a, 1);
  } else if (k === "hDown") {   // the slam: a dashed rune ring stamped round the staff's foot, a smaller one behind
    const age = hv.age + 1, a = 1 - age / 17;
    if (hv.age < 0 || a <= 0) return;
    const ga = c.globalAlpha;
    for (const [x, s] of [[46, 1], [-46, 0.7]]) {
      c.save(); c.translate(x, -2); c.scale(1, 0.26); c.globalAlpha = ga * Math.min(1, a * 1.5);
      const r = (14 + age * 5) * s;
      c.setLineDash([r * 0.5, r * 0.22]); c.lineDashOffset = age * 3;
      c.beginPath(); c.arc(0, 0, r, 0, CV_TAU); c.lineWidth = 7; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = K.cols[1]; c.stroke();
      c.setLineDash([]); c.beginPath(); c.arc(0, 0, r * 0.55, 0, CV_TAU); c.lineWidth = 2.4; c.strokeStyle = K.cols[2]; c.stroke();
      c.restore();
    }
    c.globalAlpha = ga;
  }
}

/* ---------- Meteor Shower ---------- */
// a falling star (drawProj, styles "star" / "bigstar"): a three-tone streak down from the sky, a flat glow, the crystal star turning
function hkWizFallStar(c, p, tk) {
  const big = p.style === "bigstar", C = HK_WIZ.cols, R = p.r * (big ? 1.3 : 1), tl = big ? 330 : 240, sway = Math.sin(tk * 0.2 + p.x) * 3;
  c.save(); c.translate(p.x, p.y);
  hkStreak(c, [sway - (big ? 26 : 18), -tl], [0, R * 0.2], R * (big ? 0.7 : 0.62), HK_WIZ, { head: 0.9, a: 0.92 });
  hkPhxHalo(c, 0, 0, R * 2.5, C[1], 0.85);
  hkWizStar(c, 0, 0, R * 1.05, tk * (big ? 0.05 : 0.08), big);
  for (let i = 0; i < 3; i++) { const q = (tk * 0.06 + i / 3) % 1; c.globalAlpha = 1 - q; hkShard(c, Math.sin(tk * 0.3 + i * 2.1) * R * 0.8, -R - q * tl * 0.5, (big ? 6 : 4.5) * (1 - q * 0.5), Math.PI / 2, HK_WIZ, i); }
  c.restore();
}
// the marks under the falling stars (uvFloor): the lane it falls down, a dashed ring that grows as it comes (ink under gold, violet for the
// big one) and a ring closing in on it (they meet at the hit), an X on the spot
function hkWizStarMarks(c, g, tk) {
  const C = HK_WIZ.cols, fy = STAGE.main.top;
  for (const p of g.projs) {
    if (p.style !== "star" && p.style !== "bigstar") continue;
    const big = p.style === "bigstar", q = clamp((p.y + 558) / 558, 0, 1), rm = (p.r + 22) * (0.34 + 0.66 * q), hot = q > 0.8 && tk % 6 < 3;
    c.save();
    c.globalAlpha = 0.1 + 0.1 * q; c.fillStyle = big ? C[2] : C[1]; c.fillRect(p.x - (p.r + 22), p.y, (p.r + 22) * 2, fy - p.y);   // the lane it falls down
    c.translate(p.x, fy + 1); c.scale(1, 0.27);
    c.globalAlpha = 0.18 + 0.22 * q; c.fillStyle = big ? C[2] : C[1]; c.beginPath(); c.arc(0, 0, rm, 0, CV_TAU); c.fill();
    c.globalAlpha = 0.6 + 0.4 * q; c.setLineDash([rm * 0.42, rm * 0.2]); c.lineDashOffset = -tk * 0.8;
    c.lineWidth = 7 + 3 * q; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 3.4 + 2 * q; c.strokeStyle = hot ? "#ffffff" : big ? C[2] : C[1]; c.stroke(); c.setLineDash([]);
    const rc = rm * (1 + 1.1 * (1 - q)); c.globalAlpha = 0.7 * (1 - q * 0.6); c.lineWidth = 3; c.strokeStyle = C[0]; c.beginPath(); c.arc(0, 0, rc, 0, CV_TAU); c.stroke();
    c.restore();
    c.save(); c.globalAlpha = 0.6 + 0.4 * q; c.lineCap = "round"; c.beginPath(); c.moveTo(p.x - 7, fy - 2); c.lineTo(p.x + 7, fy + 4); c.moveTo(p.x + 7, fy - 2); c.lineTo(p.x - 7, fy + 4);
    c.lineWidth = 5; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 2.4; c.strokeStyle = big ? C[2] : C[1]; c.stroke(); c.restore();
  }
}
// the crown a star leaves where it lands (uvStarLand spawns it; drawn behind the fighters): a ring of crystal points standing round the
// spot that shoot up, hold and sink back, a dashed ring on the floor; the big star's is 1.7x the size
function hkWizCrown(c, e, tk) {
  const C = HK_WIZ.cols, q = e.t / e.life, k = e.big ? 1.7 : 1, R = 40 * k, up = Math.min(1, e.t / 3), fade = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4, ga = c.globalAlpha;
  c.save(); c.translate(e.x, e.y); c.lineJoin = "round";
  c.save(); c.scale(1, 0.27); c.globalAlpha = ga * fade;
  c.beginPath(); c.arc(0, 0, R * (0.8 + 0.2 * up), 0, CV_TAU); c.globalAlpha = ga * fade * 0.25; c.fillStyle = C[1]; c.fill();
  c.globalAlpha = ga * fade; c.setLineDash([16, 8]); c.lineDashOffset = e.t * 2; c.lineWidth = 7; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = C[1]; c.stroke(); c.setLineDash([]);
  c.restore();
  const h0 = 34 * k * up * (q < 0.35 ? 1 : 1 - (q - 0.35) / 0.65 * 0.9);
  for (const back of [true, false]) for (let i = 0; i < 7; i++) {
    const an = (i / 7) * CV_TAU + 0.45, sy = Math.sin(an);
    if ((sy < 0) !== back) continue;
    const px = Math.cos(an) * R, py = sy * R * 0.27, h = h0 * (0.7 + 0.3 * nz(i * 3.7 + (e.big ? 1 : 0))) * (back ? 0.8 : 1), wd = 5.5 * k * (back ? 0.85 : 1), lean = Math.cos(an) * 6 * k;
    c.globalAlpha = ga * fade;
    c.beginPath(); c.moveTo(px - wd, py); c.lineTo(px + lean, py - h); c.lineTo(px + wd, py); c.lineTo(px + lean * 0.3, py + 3); c.closePath(); c.fillStyle = C[2]; c.fill(); c.lineWidth = 1.8; c.strokeStyle = HK_INK; c.stroke();
    c.beginPath(); c.moveTo(px - wd * 0.15, py - 1); c.lineTo(px + lean, py - h); c.lineTo(px + wd * 0.8, py - 0.5); c.closePath(); c.fillStyle = C[1]; c.fill();
    c.beginPath(); c.moveTo(px + lean * 0.5 - wd * 0.1, py - h * 0.5); c.lineTo(px + lean, py - h); c.lineTo(px + lean * 0.5 + wd * 0.35, py - h * 0.45); c.closePath(); c.fillStyle = C[0]; c.fill();
  }
  c.restore();
  c.globalAlpha = ga;
}
// the call (uvStarCall spawns it): a narrow beam from the crystal to the sky in three flat bands, thinning out
function hkWizBeam(c, e) {
  const C = HK_WIZ.cols, a = 1 - e.t / e.life, ga = c.globalAlpha, w = 5 * a + 1.5;
  c.globalAlpha = ga * a * 0.5; c.fillStyle = C[2]; c.fillRect(e.x - w * 1.8, e.y - 520, w * 3.6, 520);
  c.globalAlpha = ga * a * 0.85; c.fillStyle = C[1]; c.fillRect(e.x - w, e.y - 520, w * 2, 520);
  c.globalAlpha = ga * a; c.fillStyle = C[0]; c.fillRect(e.x - w * 0.4, e.y - 520, w * 0.8, 520);
  c.globalAlpha = ga;
}
UV_BACK.wizard = function hkWizBack(c, g, f, tk) {
  const hv = hkPhxHv(f);
  if (hv && hv.age >= 0) { c.save(); c.translate(f.x, f.y); c.scale(f.facing, 1); hkWizHeavyBack(c, f, hv); c.restore(); }
  for (const e of fx) if (e.k === "hkwiz" && e.owner === f.slot) { if (e.sub === "beam") hkWizBeam(c, e); else hkWizCrown(c, e, tk); }
  c.globalAlpha = 1;
};
