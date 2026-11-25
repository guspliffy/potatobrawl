/* ===================== Samurai's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) ===================== */
/* Kit "Clean cuts" (white core, jade body, red edge): the spark is hitkit's one straight cut, the floor mark its single oblique score.
   The heavies' smears are drawn behind both fighters (UV_BACK.samurai, in the attacker's own space): Iaido one huge crescent for one frame
   (the blade is hidden for it: P.hkHide, ui/fig-samurai.js) and a straight cut through the foe on contact, the rising and air cuts along
   the blade tip's real path, the low sweep a flat ring on the floor. Quick Draw is three jade after-images and one ruled line (finish-ready:
   five red ones and a white line that stays, finDashTick). Thousand Cuts: as the blade slides home the screen goes ink, and on the sheath
   click (the cut's hit) eight cuts appear at once through the foe, from the third tick (the impact frames own the first two).

   The first helpers here are shared by the four T6 kits (Samurai, Odin, Gunslinger, Reaper):
     hkSamT(hv) / hkSamFade(hv, full, n)  a heavy's frames since its first active frame (-1 before), and a smear's alpha: full for `full`
                                          frames, then gone n frames later
     hkSamArc(cx, cy, r, a0, a1, n, ry)   points on an (elliptic) arc
     hkSamRibbon(c, pts, ctr, w, K, o)    a crescent smear along any path: pts is its outer edge from the trailing to the leading end, the
                                          inner edge is pulled in towards ctr, thickest towards the leading end, three tones (hkSmear's
                                          look for a path that is no circle). o: { a, ry (an elliptic ring about ctr), noInk }
     hkSamDisc(c, x, y, r, col, a)        the flat halo (two discs) that stands in for a gradient glow
     hkSamCharge(c, f, P, tk, st, q, pts, K)  the flat charge-up of a held heavy: a halo and a core at each point, the rim at stage 3
     hkSamHeavy(c, f, tk, table)          a heavy's smear behind the fighters: table[key](c, f, P, hv) in the attacker's space (P.hv as pose() has it)
     hkSamAdd(o) / hkSamOwn / hkSamOwnFx  a fighter's own world effects in the shared fx list ({ k: "hk6", sub, owner, x, y, t, life, ... }),
                                          drawn behind the fighters by the owner's UV_BACK entry: hkSamOwn[sub](c, e, q) */
const hkSamOwn = {};
const HK_SAM = { cut: [null, null, null, null], sil: [null, null, null, null] };   // Thousand Cuts: the cut that landed, per slot ({ g, t: tick, x, y }); Quick Draw's silhouette per slot
const HK_SAM_RDY = { cols: ["#ffffff", "#ffffff", "#e3453b"] };   // the finish-ready Quick Draw: a white line with a red edge
const HK_SAM_MAIN = { cols: ["#ffffff", "#e3453b", "#8c1f1a"] };   // the one red cut of the eight
const HK_SAM_PETAL = ["#ffb7c9", "#ffffff", "#ffd3dd"];
function hkSamT(hv) { return !hv || hv.phase === 0 ? -1 : hv.age; }
function hkSamFade(hv, full, n) { const t = hkSamT(hv); return t < 0 ? 0 : t < full ? 1 : Math.max(0, 1 - (t - full + 1) / (n + 1)); }
function hkSamArc(cx, cy, r, a0, a1, n, ry) {
  const o = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (ry || 1)]); }
  return o;
}
// the crescent's outline along pts (from index back * n on): out along pts, back along the inner edge pulled towards ctr by up to ww
function hkSamRibPath(c, pts, ctr, ww, back, ry) {
  const n = pts.length - 1, s = Math.min(n - 1, Math.round(back * n)), m = n - s;
  c.beginPath(); c.moveTo(pts[s][0], pts[s][1]);
  for (let i = s + 1; i <= n; i++) c.lineTo(pts[i][0], pts[i][1]);
  for (let i = n; i >= s; i--) {
    const t = (i - s) / m, th = Math.sin(Math.PI * Math.pow(t, 1.7)) * ww, dx = pts[i][0] - ctr[0], dy = pts[i][1] - ctr[1];
    const k = Math.max(0, 1 - th / (Math.hypot(dx, dy / ry) || 1));
    c.lineTo(ctr[0] + dx * k, ctr[1] + dy * k);
  }
  c.closePath();
}
function hkSamRibbon(c, pts, ctr, w, K, o) {
  if (!pts || pts.length < 3 || w < 0.6) return;
  o = o || {};
  const C = K.cols, ry = o.ry || 1, ga = c.globalAlpha;
  if (o.a !== undefined) { if (o.a <= 0) return; c.globalAlpha = ga * o.a; }
  c.lineJoin = "round";
  hkSamRibPath(c, pts, ctr, w, 0, ry); c.fillStyle = C[2]; c.fill();
  if (!o.noInk) { c.lineWidth = 2.2; c.strokeStyle = HK_INK; c.stroke(); }
  hkSamRibPath(c, pts, ctr, w * 0.62, 0.25, ry); c.fillStyle = C[1]; c.fill();
  hkSamRibPath(c, pts, ctr, w * 0.3, 0.5, ry); c.fillStyle = C[0]; c.fill();
  c.globalAlpha = ga;
}
function hkSamDisc(c, x, y, r, col, a) {
  if (a <= 0 || r <= 0) return;
  const ga = c.globalAlpha;
  c.fillStyle = col; c.globalAlpha = ga * Math.min(1, a) * 0.45;
  c.beginPath(); c.arc(x, y, r, 0, CV_TAU); c.fill();
  c.beginPath(); c.arc(x, y, r * 0.6, 0, CV_TAU); c.fill();
  c.globalAlpha = ga;
}
function hkSamCharge(c, f, P, tk, st, q, pts, K) {
  const C = K.cols, ramp = Math.min(1, P.chg / 4), pulse = 0.88 + 0.12 * Math.sin(tk * 0.5);
  const r = (st === 1 ? 15 + 6 * q : st === 2 ? 21 + 6 * q : 29) * pulse, a = (st === 1 ? 0.45 + 0.2 * q : st === 2 ? 0.65 + 0.2 * q : 0.95) * ramp;
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  if (st === 3) {   // the rim round the whole body: the kit's body colour over an ink line
    c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    c.beginPath(); c.ellipse(0, P.cy, P.rx + 3, P.ry + 3, 0, 0, CV_TAU);
    c.globalAlpha = 0.45; c.lineWidth = 5; c.strokeStyle = HK_INK; c.stroke();
    c.globalAlpha = 0.6 + 0.25 * Math.sin(tk * 0.6); c.lineWidth = 2.6; c.strokeStyle = C[1]; c.stroke();
    c.restore();
  }
  for (const p of pts) {
    c.globalAlpha = 1; hkSamDisc(c, p[0], p[1], r, C[1], a * 0.55);
    c.globalAlpha = a; c.fillStyle = C[0]; c.beginPath(); c.arc(p[0], p[1], r * (st === 3 ? 0.3 : 0.22), 0, CV_TAU); c.fill();
  }
  c.restore();
}
// a heavy's smear, behind both fighters: the attacker's own space (drawPotato's transform), the charge (HV_K) as drawHeavyFx sets it
function hkSamHeavy(c, f, tk, table) {
  if (f.state !== "attack" || !f.move || HEAVY_KEYS[f.mid] !== 1 || !table[f.mid] || f.mt <= f.move.startup) return;
  const P = pose(f, tk), hv = P.hv;
  if (!hv || hv.phase === 0) return;
  const us = uvScale(f);
  c.save(); c.translate(f.x + P.jit[0], f.y - P.hop + P.jit[1]); c.scale(f.facing * us, us);
  if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
  c.lineCap = "round"; c.lineJoin = "round";
  HV_K = hv.ck || 0;
  try { table[f.mid](c, f, P, hv); } finally { HV_K = 0; c.restore(); c.globalAlpha = 1; }
}
function hkSamAdd(o) { addFx(Object.assign({ k: "hk6", t: 0 }, o)); }
function hkSamOwnFx(c, f) {
  for (const e of fx) {
    if (e.k !== "hk6" || e.owner !== f.slot || e.t < 0) continue;
    const fn = hkSamOwn[e.sub];
    if (fn) { c.save(); fn(c, e, e.t / e.life); c.restore(); }
  }
  c.globalAlpha = 1;
}
// a straight cut through a point: a lens of the kit, len half long, w half wide
function hkSamCut(c, x, y, ang, len, w, K, o) {
  const ca = Math.cos(ang) * len, sa = Math.sin(ang) * len;
  hkStreak(c, [x - ca, y - sa], [x + ca, y + sa], w, K, o || { head: 0.5 });
}

/* ---------- the kit's own spark parts ---------- */
// the charge-up: the flat halo on the hand and the blade, and a cut of light that slides hilt to tip (two at stage 3)
HK_KIT.samurai.charge = (c, f, P, tk, st, q, pts) => {
  const K = HK_KIT.samurai;
  hkSamCharge(c, f, P, tk, st, q, pts, K);
  if (st < 2) return;
  const a = heldDir(f, P, bp(P, P.sh), -0.8), Lb = P.w * 1.35, ca = Math.cos(a), sa = Math.sin(a);
  c.save();
  for (let i = 0; i < (st === 3 ? 2 : 1); i++) {
    const t = (tk * 0.032 + i * 0.5) % 1, d = 8 + t * (Lb - 10), x = P.hF[0] + ca * d, y = P.hF[1] + sa * d, s = Math.sin(Math.PI * t), len = 7 + 9 * s * (0.7 + 0.5 * q);
    c.globalAlpha = Math.min(1, 0.35 + s);
    hkSamCut(c, x, y, a, len, 1.6 + 1.6 * s, K, { head: 0.5, noInk: true });
    hkSamCut(c, x, y, a + Math.PI / 2, len * 0.55, 1.2 + s, K, { head: 0.5, noInk: true });
  }
  c.restore();
};

/* ---------- the heavies (behind the fighters, the attacker's space) ---------- */
// petals off a rising cut, in the kit's pinks (a skin never recolours them)
function hkSamPetals(c, hv, n) {
  const age = hkSamT(hv) + 1, a = 1 - age / 20;
  if (age < 1 || a <= 0) return;
  c.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    const an = -0.4 - i * 0.55, d = 14 + age * (2.4 + (i % 3) * 0.7), x = 2 + Math.cos(an) * d * 0.8, y = -62 + Math.sin(an) * d - age * 0.6 + age * age * 0.03;
    c.save(); c.translate(x, y); c.rotate(age * 0.3 + i); c.fillStyle = HK_SAM_PETAL[i % 3]; c.beginPath(); c.ellipse(0, 0, 3.4, 1.9, 0, 0, CV_TAU); c.fill();
    c.lineWidth = 0.8; c.strokeStyle = HK_INK; c.stroke(); c.restore();
  }
  c.globalAlpha = 1;
}
// a blade (or fist, K another kit) swung round the hand: the tip's real path (hv.trail: h1, h2, a1, a2, L) as a crescent towards the hand
function hkSamTipPath(c, P, hv, wmax, full, K) {
  const T = hv.trail, a = hkSamFade(hv, full, 6);
  if (!T || a <= 0) return;
  const Lb = T.L || P.w * 1.35 + 4, pts = [];
  for (let i = 0; i <= 18; i++) { const u = i / 18, h = lerp2(T.h1, T.h2, u), an = T.a1 + (T.a2 - T.a1) * u; pts.push([h[0] + Math.cos(an) * Lb, h[1] + Math.sin(an) * Lb]); }
  hkSamRibbon(c, pts, lerp2(T.h1, T.h2, 0.5), wmax * (1 + 0.7 * HV_K), K || HK_KIT.samurai, { a });
}
// a smear on the arc about (cx, cy) from point p0 to point p1 (fighter space), the shorter way round or, with span, at least that long
function hkSamArcTo(c, cx, cy, p0, p1, w, K, a, ry, span) {
  let a0 = Math.atan2(p0[1] - cy, p0[0] - cx), a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
  while (a1 - a0 > Math.PI) a1 -= CV_TAU;
  while (a0 - a1 > Math.PI) a1 += CV_TAU;
  if (span && Math.abs(a1 - a0) < span) a0 = a1 - Math.sign(a1 - a0 || 1) * span;
  const r = Math.hypot(p1[0] - cx, p1[1] - cy);
  hkSmear(c, cx, cy, r, a0, a1, w, K, { a, ry: ry || 1 });
}
const hkSamHv = {
  // Iaido: one huge crescent on the first active frame, over him from behind and down through the cut, gone in five
  hSide(c, f, P, hv) { const a = hkSamFade(hv, 1, 5); if (a > 0) hkSmear(c, 4, -28, 78, -2.7, 0.32, 28 * (1 + 0.7 * HV_K), HK_KIT.samurai, { ry: 0.62, a }); },
  hUp(c, f, P, hv) { hkSamTipPath(c, P, hv, 24, 1); hkSamPetals(c, hv, 9); },
  // the low sweep: a flat ring on the floor, the near half ending in front, the far half behind
  hDown(c, f, P, hv) {
    if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(-P.spin); c.translate(0, P.h * 0.5); }
    const a = hkSamFade(hv, 2, 8), w = 18 * (1 + 0.7 * HV_K);
    if (a <= 0) return;
    hkSmear(c, 0, -8, 66, Math.PI - 0.35, 0.12, w, HK_KIT.samurai, { ry: 0.26, a });
    hkSmear(c, 0, -8, 66, -0.35, -Math.PI + 0.12, w, HK_KIT.samurai, { ry: 0.26, a });
  },
  hAir(c, f, P, hv) { hkSamTipPath(c, P, hv, 22, 1); },
};

/* ---------- Quick Draw: three jade after-images where he just was, and one ruled line (finish-ready: five red ones, a white line) ---------- */
// the after-image: his silhouette drawn once per dash (uvSil draws the whole figure; the dash pose holds), then reused
function hkSamSil(f, tk, colr) {
  let s = HK_SAM.sil[f.slot];
  const key = f.moveT + colr;
  if (s && s.key === key) return s.cv;
  if (!s) { const cv = document.createElement("canvas"); cv.width = cv.height = UV_SIL.S; s = HK_SAM.sil[f.slot] = { cv, cx: cv.getContext("2d"), key: "" }; }
  const src = uvSil(f, tk, colr);
  s.cx.clearRect(0, 0, UV_SIL.S, UV_SIL.S); s.cx.drawImage(src, 0, 0); s.key = key;
  return s.cv;
}
function hkSamDash(c, g, f, tk) {
  const m = f.move;
  if (f.state !== "attack" || f.mid !== "spec" || !m || m.kind !== "dash") return;
  const a0 = m.startup + 1, a1 = m.startup + m.active;
  if (f.mt < a0 || f.mt > a1 + 8) return;
  const K = HK_KIT.samurai, d = f.facing, rdy = finishReady(foeSlot(f.slot)), fade = f.mt <= a1 ? 1 : 1 - (f.mt - a1) / 9;
  const dist = Math.min(260, (m.speed || 15) * (Math.min(f.mt, a1) - m.startup)), y = f.y - f.s.h * 0.45, n = rdy ? 5 : 3, gap = Math.min(30, dist / (n + 0.5));
  if (gap > 4) {
    const sil = hkSamSil(f, tk, rdy ? K.cols[2] : K.cols[1]), S = UV_SIL.S;
    for (let i = n; i >= 1; i--) { c.globalAlpha = fade * (0.5 - (0.32 * (i - 1)) / Math.max(1, n - 1)); c.drawImage(sil, f.x - d * gap * i - S / 2, f.y - S * 0.8); }
    c.globalAlpha = 1;
  }
  if (dist > 8) hkStreak(c, [f.x - d * (dist + 10), y], [f.x + d * 24, y], (rdy ? 7 : 4.2) * (0.6 + 0.4 * fade), rdy ? HK_SAM_RDY : K, { head: 0.9, a: fade });
}
// the finish-ready dash's line stays on the path (finDashTick, effects.js)
hkSamOwn.samline = (c, e, q) => { const d = Math.sign(e.x2 - e.x1) || 1; hkStreak(c, [e.x1 - d * 10, e.y], [e.x2 + d * 24, e.y], 7 * (1 - q * 0.6), HK_SAM_RDY, { head: 0.9, a: 1 - q }); };
// Iaido's straight cut on contact: it flashes in at full length, holds, thins and goes
hkSamOwn.samcut = (c, e, q) => {
  const grow = Math.min(1, (e.t + 1) / 2), hold = q < 0.35 ? 1 : 1 - (q - 0.35) / 0.65;
  c.globalAlpha = Math.min(1, hold * 1.4);
  hkSamCut(c, e.x, e.y, e.ang, e.len * grow, e.w * (0.45 + 0.55 * hold), HK_KIT.samurai);
};

/* ---------- Thousand Cuts: the dash's line, the ink screen and the eight cuts on the sheath click ---------- */
function hkSamCuts(c, g, f, tk) {
  const held = uvHeld(f) === "cuts", d = f.facing, mt = f.mt;
  if (held && mt >= 24 && mt <= 46) {   // the line he left through the unseen dash, from where he started to where he is
    const x0 = UV.dash[f.slot] ? UV.dash[f.slot].x : f.x - d * 264, a = mt <= 35 ? 1 : 1 - (mt - 35) / 11;
    if (Math.abs(f.x - x0) > 8) hkStreak(c, [x0, f.y - 34], [f.x + d * 26, f.y - 34], 6 * (0.5 + 0.5 * a), HK_KIT.samurai, { head: 0.92, a });
  }
  const R = HK_SAM.cut[f.slot], age = R && R.g === g ? tk - R.t - 1 : 999;   // age 0: the first frame drawn after the cut landed
  let ink = held && f.ultTgt >= 0 && mt >= 56 && mt <= 66 && age > 60 ? clamp((mt - 56) / 8, 0, 1) : 0;   // the blade slides home: the screen goes ink
  if (age >= 0 && age < 40) ink = Math.max(ink, age < 26 ? 1 : 1 - (age - 26) / 14);
  if (ink <= 0) return;
  c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.globalAlpha = ink * (hkCalm() ? 0.42 : 0.86); c.fillStyle = HK_INK; c.fillRect(0, 0, L.gw, L.gh);   // (Reduce flashes: a dimmed backdrop)
  c.restore();
  if (age < 2 || age >= 40) return;   // the impact frames own the hit's first two ticks; the eight cuts take over from the third
  const grow = Math.min(1, (age - 1) / 2), thin = age < 18 ? 1 : 1 - (age - 18) / 22;
  c.save();
  for (let i = 0; i < 8; i++) {
    const an = -1.2 + i * 0.36 + nz(i * 3.1 + 0.5) * 0.2, len = (74 + nz(i * 7.3 + 1) * 36) * 1.15 * grow, main = i === 3;
    c.globalAlpha = Math.min(1, thin * 1.4);
    hkSamCut(c, R.x + (nz(i * 5.1) - 0.5) * 22, R.y + (nz(i * 2.7) - 0.5) * 30, an, len, (main ? 5.5 : 3.6) * (0.4 + 0.6 * thin), main ? HK_SAM_MAIN : HK_KIT.samurai, { head: 0.5, noInk: !main });
  }
  c.restore();
}

UV_BACK.samurai = (c, g, f, tk) => {
  hkSamOwnFx(c, f);
  hkSamHeavy(c, f, tk, hkSamHv);
  hkSamDash(c, g, f, tk);
  hkSamCuts(c, g, f, tk);
};
