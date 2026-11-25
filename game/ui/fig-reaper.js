/* ===================== Carved Ink: Reaper (ui/carve.js has the kit and the API) =====================
   No legs to see: a ragged bell of a cloak that reaches the floor with a torn hem, a rope at the waist, a hooked hood with a wilted
   sprout on the hook, the face in the hood's shadow with two eye slits that glow (soul), a smirk, bone-pale hands and soul motes drifting
   off the back of the hem. On the floor the hem stays on the floor (the cloak is turned back from the body's lean and stretched to the
   crouch; K.stack's fn), so he glides; off the floor it hangs from the body, trails behind as he moves, lifts as he falls. The face is the
   figure's own (the slits are no kit eyes): carved at rest, live with an expression, hitstun, a blink or a shout (cvRprFace).
   The scythe keeps today's pose logic (scythe(): scyAng, P.bladeS, P.scyK, P.scyBack, P.scyTip), carved in this skin's colours;
   graveCloud (P.cloud) and reapLightTrail are today's. Mockup: redesign/mockups/src/fighters.js NEWF.d.reaper;
   skins: fx.js skinPal(). */
const CV_RPR_TOP = -50;   // the top of the cloak (the stretch to the crouch and the trail turn about it)
const CV_RPR_EYES = [[4.6, 3.5, 0.35], [12.6, 3, -0.3]];   // the slits: x (at y -50.5), half length, tilt
const CV_RPR_CLOAK = [[-13, -50, 1], [-20, -30], [-25, -8], [-23, 0, 1], [-18, -8], [-13, 0, 1], [-7, -7], [-1, 0, 1], [5, -7], [11, 0, 1], [16, -8], [23, 0, 1], [21, -28], [14, -50, 1]];
const CV_RPR_HOOD = [[-16, -38, 1], [-21, -56], [-10, -72], [6, -78], [19, -72, 1], [11, -70], [19, -60], [18, -46], [11, -35, 1], [-3, -33]];
let cvRprRims = null;   // the outlines of the cloak and the hood for the 2v2 team rim (the body's silhouette sits inside the cloak)
cvFigReg("reaper", {
  pal: { cloak: "#565069", deep: "#17131f", skin: "#e2a95c", soul: "#8dffd0", bone: "#efe9da", wood: "#6e4a33", steel: "#e3e9f0",
    stem: "#4f7d4a", leaf: "#86b56a" },
  chip: [{}, { cloak: "#3f6e3a", soul: "#c6ff6a" }, { cloak: "#3a3340", soul: "#ff8a3c", steel: "#ffd9b0" },
    { cloak: "#ebe6d8", soul: "#8dffd0", bone: "#3a3644", wood: "#3a3644" }],
  won: { scratch: { cloak: "#3a1410", skin: "#8c4a30", soul: "#ff7a2b" }, zorp: { cloak: "#2d4a3e", skin: "#a9c8a0", soul: "#9dff5a" },
    kraken: { cloak: "#22343a", skin: "#b89a62", soul: "#3ef2c0" }, harvest: { cloak: "#5a3a1c", skin: "#f8cc52", soul: "#ffe08a", steel: "#fff0b0" } },
  pm: { 1: { cloak: "#3a3842", deep: "#1b1a22", soul: "#ffb444", skin: "#f1e8d2" }, 2: { cloak: "#9b5cff", skin: "#34246a", soul: "#ff6ad5", steel: "#f0e0ff" } },
  prim: "cloak",
  // (the face in the hood is dark, towards deep, so the two bright slits carry it)
  derive(C) { C.band = cvSh(C.steel, 0.45); C.shade = cvMix(C.skin, C.deep, 0.6); C.shadeD = cvMix(C.skin, C.deep, 0.8); C.soulHi = cvMix(C.soul, "#ffffff", 0.7); },
  body: { x: 0, y: -38, rx: 19, ry: 33 },
  face: { x: 8.5, y: -50.5, s: 0.9, mouth: { k: "smirk", x: 9.5, y: -42.5, s: 0.85 } },   // (the slits are cvRprFace's; the kit draws the mouth)
  mouthPt: [9.5, -42],
  arm: { shF: [6, -35], shB: [-10, -39], len: 20, lenB: 18, bendB: "back", r0: 4.6, r1: 5.8, col: "cloak",
    hand: { r: 4.9, col: "bone" }, handB: { r: 4.6, col: "bone", thumb: false } },
  carve: {
    // the bell: the dark inside showing between the tatters, the torn hem on the floor, two folds and the rope at the waist
    cloak(S) {
      S.fill(cvSm([[-18, -20, 1], [-20, 0, 1], [18, 0, 1], [18, -20, 1]]), "deep");
      S.cel(cvSm(CV_RPR_CLOAK), "cloak", { sh: [8, -4], rim: 1, hi: [-5, 2], hiCol: "cloak/lt.22" });
      S.line([[-6, -34], [-10, -12]], 1.3, "cloak/sh.5"); S.line([[7, -34], [9, -12]], 1.3, "cloak/sh.5");
      S.line([[-14, -31], [0, -27], [16, -31]], 2.6, "wood");
      S.line([[1, -27.5], [-1, -20], [1.5, -14]], 1.6, "wood"); S.cel(cvCirc(0.5, -27.5, 2.2, 2), "wood", { lw: 1.4, sh: 0 });
    },
    // the hood with its hook, the opening dark, the face in its shadow
    hood(S) {
      S.cel(cvSm(CV_RPR_HOOD), "cloak", { sh: [6, -5], rim: 1, hi: [-4, 5], hiCol: "cloak/lt.22" });
      S.line([[-12, -64], [-15, -52], [-12, -41]], 1.3, "cloak/sh.5");
      S.cel(cvBlob(7.5, -51, 10.8, 13.4), "deep", { shade: 0, lw: 2.2 });
      S.cel(cvBlob(8.5, -48.5, 9, 10.6), "shade", { sh: [3, 7], shade: "shadeD", lw: 0 });
    },
    // the face at rest: the glow of the slits, the slits, the smirk
    eyes(S) {
      for (const [x, w, a] of CV_RPR_EYES) {
        S.add([cvCirc(x, -50.5, 7)], "soul", 1, 0.2); S.add([cvCirc(x, -50.5, 4.2)], "soul", 1, 0.35);
        S.with(x, -50.5, a, 1, () => S.cel(cvSm([[-w, 0.8, 1], [0, -2.4], [w, -0.6, 1], [0, 1.6]]), "soulHi", { lw: 1.2, sh: 0 }));
      }
      cvMouth(S, 9.5, -42.5, "smirk", 0.85);
    },
    // the scythe in the hand's frame (at 0, along +x; today's measures for w 46: SCY in draw-fighters.js): the snath and its knob, the
    // collar at the head, the blade from the collar (its side +y; cvRprScythe flips and squashes it as scythe() does) with a soul edge
    snath(S) { cvRprSnath(S); },
    collar(S) { cvRprCollar(S); },
    blade(S) { cvRprBlade(S); },
    // the wilted sprout off the hook
    sprout(S) { S.line([[4, -77], [9, -84], [16, -82]], 2.2, "stem"); S.leaf(16, -82, 9, 0.9, "leaf"); S.leaf(6, -80, 7, -2.4, "leaf"); },
  },
  draw(K) {
    const f = K.f, P = K.P, tk = K.tk, c = K.c;
    graveCloud(c, f, P, tk, P.cloud);   // Grave rise (draw-fighters.js)
    cvRprMotes(c, K);
    if (P.scyBack) cvRprScythe(c, K);   // Harvest: the blade swings behind him
    K.arm(false);
    // the cloak: on the floor its hem stays there (g 1: turned back from the lean, the top sheared along with it, stretched to the crouch);
    // off it, it hangs (g 0), lifting as he falls and stretching as he rises; the hem trails behind as he moves (all in steps: K.stack)
    const grd = f.grounded && f.state !== "ledge" && !(f.state === "hitstun" && P.spin);
    const g = Math.round(clamp(K.spring("rgnd", grd ? 1 : 0, 0.35), 0, 1) * 10) / 10;
    const dq = Math.round(P.cvDrop * 2) / 2, lq = K.ls / 50;
    const tr = Math.round(K.spring("rtrail", clamp(-(f.vx + f.kbx) * f.facing * (grd ? 0.6 : 0.9), -8, 8) + (grd ? 0 : Math.sin(tk * 0.2 + f.slot) * 0.8), 0.2));
    const ka = grd ? 1 : Math.round((1 - clamp((f.vy || 0) * 0.012, -0.08, 0.12)) * 50) / 50;
    const fn = cvRprCloakFn(P, g, dq, lq, tr, ka);
    if (TEAM_RIM && !K.at) cvRprRim(c, K, fn);
    // at rest (no transform) the cloak goes into the hood's sprite and the skin pass lies on the bell (fig.sil); otherwise the cloak is a
    // stack of its own, and the skin pass goes on the cloak (in its transform), then on the hood
    if (fn) { K.stack(["cloak"], fn, g + "," + dq + "," + tr + "," + ka); if (K.skinPass) cvRprSkin(K, CV_RPR_SIL.cloak, fn); }
    const skin = !fn ? "skin" : K.skinPass ? cvRprSkinHood : null;
    K.stack([fn ? null : "cloak", "hood", skin, K.faceRest && !(P.mouth > 0.5) ? "eyes" : cvRprFaceK, "sprout", "top"].filter(Boolean));
    K.arm(true, P.scyBack ? null : cvRprScythe);
    reapLightTrail(c, f, P);   // a light's swing trail (draw-fighters.js)
  },
});
// the silhouette potatoPath() replays (glaze, the Road and Pommes skin passes): the bell he reads as, the cloak and the hood as one
// outline (the body's ellipse sits hidden inside the cloak); and each alone, for the skin pass of a cloak that is turned (cvRprSkin)
const CV_RPR_SIL = (() => {
  const flat = (Q) => { const o = new Float64Array(Q.length * 2); Q.forEach((q, i) => { o[i * 2] = q[0]; o[i * 2 + 1] = q[1]; }); return o; };
  const A = cvPos(cvSm(CV_RPR_CLOAK)), B = cvPos(cvSm(CV_RPR_HOOD));
  return { all: flat(cvRprUnion(A, B)), cloak: flat(A), hood: flat(B) };
})();
CV_FIG.reaper.sil = CV_RPR_SIL.all;
// the outline of the union of two simple polygons of one winding (dense points, as cvSm makes them): walk one; where it runs into the
// other, go on along the other from its nearest point outside the first, and back; stop on a point already walked
function cvRprUnion(A, B) {
  const ins = (Q, p) => cvInside(Q, p[0], p[1]), out = [], seen = new Set();
  let P = A, Q = B, onA = true, i = A.findIndex((p) => !ins(B, p));
  for (let n = 0; n < 4 * (A.length + B.length); n++) {
    if (onA) { if (seen.has(i)) break; seen.add(i); }
    out.push(P[i]);
    let j = (i + 1) % P.length;
    if (ins(Q, P[j])) {
      let bd = Infinity;
      Q.forEach((q, k) => { const d = (q[0] - P[j][0]) ** 2 + (q[1] - P[j][1]) ** 2; if (d < bd && !ins(P, q)) { bd = d; j = k; } });
      [P, Q] = [Q, P]; onA = !onA;
    }
    i = j;
  }
  return out;
}
// the skin pass (K.skinBody: glaze, a Road or Pommes skin) on one silhouette; with fn, in the cloak's transform: the kit's squash and lean
// come first in skinBody, so fn (after the drop) is moved in front of them: M = A X A^-1
function cvRprSkin(K, sil, fn) {
  const fig = K.fig, s0 = fig.sil, c = K.c, P = K.P;
  fig.sil = sil; c.save();
  try {
    if (fn) {
      const h = P.hip, d = P.cvDrop, X = new DOMMatrix().translateSelf(0, d);
      const A = new DOMMatrix().scaleSelf(K.sx, K.sy).translateSelf(h[0], h[1]).rotateSelf((P.lean * 180) / Math.PI).translateSelf(-h[0], -h[1]);
      fn({ translate: (x, y) => X.translateSelf(x, y), rotate: (a) => X.rotateSelf((a * 180) / Math.PI), scale: (x, y) => X.scaleSelf(x, y),
        transform: (a, b, cc, dd, e, f) => X.multiplySelf(new DOMMatrix([a, b, cc, dd, e, f])) });
      X.translateSelf(0, -d);
      const M = A.multiply(X).multiply(A.inverse());
      c.transform(M.a, M.b, M.c, M.d, M.e, M.f);
    }
    K.skinBody();
  } finally { c.restore(); fig.sil = s0; }
}
const cvRprSkinHood = (K) => cvRprSkin(K, CV_RPR_SIL.hood, null);
// the cloak's transform in the standing frame (after the kit's lean and drop), or null when it has none
function cvRprCloakFn(P, g, dq, lq, tr, ka) {
  const T = CV_RPR_TOP, hx = P.hip[0], hy = P.hip[1] - P.cvDrop;
  const k = 1 - (g * dq) / -T + (1 - g) * (ka - 1);   // the hem on the floor at y -dq (then the drop puts it at 0)
  const kx = g && lq ? (g * ((T - hy) * Math.sin(lq))) / (T + dq) : 0, sx = tr / -T;
  if (!(g && lq) && !kx && !sx && k === 1) return null;
  return (c) => {
    if (g && lq) { c.translate(hx, hy); c.rotate(-lq * g); c.translate(-hx, -hy); }
    if (kx) { c.translate(0, -dq); c.transform(1, 0, -kx, 1, 0, 0); c.translate(0, dq); }
    if (sx) { c.translate(0, T); c.transform(1, 0, sx, 1, 0, 0); c.translate(0, -T); }
    if (k !== 1) { c.translate(0, T); c.scale(1, k); c.translate(0, -T); }
  };
}
// the 2v2 team rim: the cloak's and the hood's outlines (teamRimBody's width), behind them
function cvRprRim(c, K, fn) {
  const tc = TEAM_COL[K.f.team];
  if (!tc) return;
  if (!cvRprRims) cvRprRims = [cvPath([cvSm(CV_RPR_CLOAK)]), cvPath([cvSm(CV_RPR_HOOD)])];
  c.lineJoin = "round"; c.lineWidth = 2.5 + 4 / cam.z; c.strokeStyle = tc;
  K.body((cc) => { if (fn) fn(cc); cc.stroke(cvRprRims[0]); });
  K.body((cc) => cc.stroke(cvRprRims[1]));
}
// soul motes rising off the back of the hem: three, live (two fills)
function cvRprMotes(c, K) {
  const tk = K.tk, f = K.f, a0 = c.globalAlpha, M = [];
  for (let i = 0; i < 3; i++) {
    const t = (tk * 0.011 + i / 3 + f.slot * 0.17) % 1, r = (3.2 - i * 0.6) * (1 - t * 0.55);
    M.push([K.pt(-23 - i * 4 + Math.sin(tk * 0.07 + i * 2.1) * 2.5 - t * 4, -3 - t * 30), r, 1 - t]);
  }
  c.beginPath(); for (const [p, r] of M) cvCircAdd(c, p[0], p[1], r * 2.6);
  c.globalAlpha = a0 * 0.22; c.fillStyle = K.C.soul; c.fill();
  c.beginPath(); for (const [p, r, q] of M) if (q > 0.15) cvCircAdd(c, p[0], p[1], r);
  c.globalAlpha = a0 * 0.9; c.fill();
  c.globalAlpha = a0;
}
// the scythe in the front hand: scythe()'s pose (scyAng, P.bladeS, P.scyK, P.scyBack) and P.scyTip (scyTipAt), drawn from the carved
// parts as paths (a turned sprite costs more than their few fills): the snath foreshortened by scyK, the blade flipped and squashed by
// bladeS; between the arm and the mitten, or behind him in Harvest. The top chip skin keeps its ghost-lit edge
function cvRprScythe(c, K) {
  const P = K.P, f = K.f, a = scyAng(f, P), s = P.bladeS, k = P.scyK, w = P.w, h = K.hF, u = w / 46;
  c.save(); c.translate(h[0], h[1]); c.rotate(a); if (u !== 1) c.scale(u, u);
  c.save(); c.scale(k, 1); K.draw("snath"); c.restore();
  c.translate(46.92 * k, 0);
  K.draw("collar");
  if (Math.abs(s) > 0.06) {
    c.scale(k * 0.5 + 0.5, s); K.draw("blade");
    if (skinLvl(f) === 3 && !K.flash && !P.dim) {
      c.globalAlpha *= 0.45; c.strokeStyle = K.C.soul; c.lineWidth = 4 / Math.max(0.4, Math.abs(s)); c.lineCap = "round";
      c.beginPath(); c.moveTo(-1, 5); c.quadraticCurveTo(6.3, 21.2, -10.8, 41.9); c.stroke(); c.globalAlpha /= 0.45;
    }
  }
  c.restore();
  P.scyTip = scyTipAt(h, a, s, w, k);
}
// a quadratic curve as points
function cvRprQuad(p0, q, p1) {
  const o = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, m = 1 - t; o.push([m * m * p0[0] + 2 * m * t * q[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * q[1] + t * t * p1[1]]); }
  return o;
}
// the face when it is not at rest: the slits for the moment (an expression, hitstun, a blink, a shout) and the kit's mouth
const cvRprFaceK = (K) => K.body((c) => cvRprFace(c, K));
function cvRprFace(c, K) {
  const P = K.P, f = K.f, C = K.C, F = K.fig.face, ex = P.expr || "", xk = P.exK === undefined ? 1 : P.exK, a0 = c.globalAlpha, y = -50.5;
  const hurt = !ex && f.state === "hitstun", bl = !ex && !hurt && ((K.tk + f.slot * 53) % 211) < 4;
  const glow = ex === "ko" ? 0 : ex === "rage" ? 1.5 : ex === "terror" ? 1.2 : bl || ex === "calm" ? 0.5 : 1;
  if (glow && !C.flat) {
    c.beginPath(); for (const e of CV_RPR_EYES) cvCircAdd(c, e[0], y, 6.5); c.globalAlpha = a0 * 0.22 * glow; c.fillStyle = C.soul; c.fill();
    c.beginPath(); for (const e of CV_RPR_EYES) cvCircAdd(c, e[0], y, 4); c.globalAlpha = a0 * Math.min(0.6, 0.35 * glow); c.fill();
    c.globalAlpha = a0;
  }
  c.lineCap = "round"; c.lineJoin = "round";
  const strokes = (w, add) => { c.beginPath(); CV_RPR_EYES.forEach(add); c.lineWidth = w + 1.6; c.strokeStyle = CV_INK; c.stroke(); cvMgInk(c); c.lineWidth = w; c.strokeStyle = C.soulHi; c.stroke(); };
  if (hurt) strokes(1.8, ([x], i) => { const d = i ? -1 : 1; c.moveTo(x - d * 2.6, y - 2.6); c.lineTo(x + d * 2, y); c.lineTo(x - d * 2.6, y + 2.6); });   // > <
  else if (ex === "ko") strokes(1.9, ([x]) => { c.moveTo(x - 2.6, y - 2.6); c.lineTo(x + 2.6, y + 2.6); c.moveTo(x + 2.6, y - 2.6); c.lineTo(x - 2.6, y + 2.6); });
  else if (ex === "dazed") strokes(1.2, ([x], i) => { for (let a = 0; a <= Math.PI * 5; a += 0.3) { const r = 3.6 * (0.1 + (0.8 * a) / (Math.PI * 5)), px = x + Math.cos(a + i * 2) * r, py = y + Math.sin(a + i * 2) * r; if (a) c.lineTo(px, py); else c.moveTo(px, py); } });
  else if (ex === "calm") strokes(1.6, ([x]) => { c.moveTo(x + 3 * Math.cos(0.25), y - 1 + 3 * Math.sin(0.25)); c.arc(x, y - 1, 3, 0.25, Math.PI - 0.25); });   // closed, content
  else if (ex === "grin") strokes(1.9, ([x]) => { c.moveTo(x - 3.1 * Math.cos(0.35), y + 1.6 - 3.1 * Math.sin(0.35)); c.arc(x, y + 1.6, 3.1, Math.PI + 0.35, -0.35); });   // ^ ^
  else if (bl) strokes(1.3, ([x, w, a]) => { c.moveTo(x - Math.cos(a) * w, y - Math.sin(a) * w); c.lineTo(x + Math.cos(a) * w, y + Math.sin(a) * w); });
  else {
    // open: the slits (rage: tilted hard inwards, narrower), terror: wide round eyes with a dot of a pupil
    const tr = ex === "terror", k = tr ? 1 + 0.45 * xk : 1;
    const E = CV_RPR_EYES.map(([x, w, a], i) => (tr ? [x, 3 * k, 3 * k, 0] : ex === "rage" ? [x, w * 1.05, 1.2, i ? -0.75 : 0.75] : [x, w, 1.7, a]));
    const lay = (d, col) => { c.beginPath(); for (const [x, rx, ry, a] of E) { c.moveTo(x + (rx + d) * Math.cos(a), y + (rx + d) * Math.sin(a)); c.ellipse(x, y, rx + d, ry + d, a, 0, CV_TAU); } c.fillStyle = col; c.fill(); };
    lay(0.85, CV_INK); cvMgInk(c); lay(0, C.soulHi);
    if (tr) { c.beginPath(); for (const [x] of E) cvCircAdd(c, x + 0.6, y + 0.3, 1.2 * (1 - 0.4 * xk) + 0.4); c.fillStyle = CV_INK; c.fill(); }
  }
  cvMouthFor(c, K, F, hurt, ex, xk);
}
// the snath and its knob; the collar (at the head); the blade from the collar (its side +y), a soul edge along the cut
function cvRprSnath(S) {
  S.cel(cvCapsule([-20.24, 0], [46.92, 0], 2.5, 2.5), "wood", { lw: 1.4, sh: [0, -1.4] });
  S.cel(cvCirc(-20.24, 0, 3.3), "wood", { lw: 1.3, sh: [1, -1] });
}
function cvRprCollar(S) { S.cel(cvRect(-6, -3.6, 9, 7.2), "band", { lw: 1.3, sh: [1.5, -1] }); }
function cvRprBlade(S) {
  const B = cvRprQuad([3, -3], [26.1, 13.5], [-12.6, 45.1]).concat(cvRprQuad([-12.6, 45.1], [7.2, 19.8], [-3, 3.5]).slice(1));
  S.cel(B, "steel", { lw: 1.8, sh: [-3, 1.5], shade: "steel/sh" });
  S.line(cvRprQuad([-1, 5], [6.3, 21.2], [-10.8, 41.9]), 1.6, "soul");
}
