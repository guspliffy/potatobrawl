/* ===================== Carved Ink: Phoenix (ui/carve.js has the kit and the API) =====================
   A comet: a slim sweet potato tipped forward, all flame behind him: the crest swept back over his head, one big wing, two tail ribbons,
   each in three flame tones (f1 the edge, f2, f3 the hot core) that lag the body (a spring), embers rising off the crest. Thin bird legs
   with talons, a yellow fist under a feather sleeve, raised brows, an open beak-smile; the sprout sits green in the fire. The wing is
   driven like the old flameWing (draw-fighters.js): P.flap, P.wingUp, spread in the air. Mockup: redesign/mockups/src/fighters.js
   NEWF.d.phoenix; skins: fx.js skinPal(). */
const CV_PHX_TAIL = [[-8, -20, 1], [-24, -24], [-44, -12, 1], [-28, -12], [-36, -2, 1], [-20, -8], [-10, -10, 1]];
const CV_PHX_WING = [[-4, -46, 1], [-22, -60], [-46, -66, 1], [-32, -52], [-50, -46, 1], [-32, -42], [-44, -30, 1], [-26, -34], [-30, -22, 1], [-10, -30]];
const CV_PHX_CREST = [[13, -55, 1], [12, -70, 1], [5, -63], [1, -86, 1], [-6, -68], [-17, -84, 1], [-15, -64], [-30, -70, 1], [-18, -50]];
// a flame: the edge tone carved, its inner tones the same shape shrunk about (ox, oy) (k2: a third, hot core)
function cvPhxFlame(S, pts, ox, oy, k, k2, edge, mid) {
  const P = cvSm(pts), rel = cvShift(P, -ox, -oy);
  S.cel(P, edge || "f1", { sh: [2.5, -2] });
  S.with(ox, oy, 0, k, () => S.fill(rel, mid || "f2"));
  if (k2) S.with(ox, oy, 0, k2, () => S.fill(rel, "f3"));
}
cvFigReg("phoenix", {
  pal: { skin: "#f8bd4c", f1: "#ff5326", f2: "#ff9a1f", f3: "#ffe05a", leg: "#e27a1f", stem: "#3f7d3a", leaf: "#7fd35c", iris: "#e2541c",
    blush: "#ff6050" },
  chip: [{}, { f1: "#2f8cff", f2: cvLt("#2f8cff", 0.42), f3: cvLt("#2f8cff", 0.8) }, { f1: "#2fb85a", f2: cvLt("#2fb85a", 0.42), f3: "#f4ffb0" },
    { f1: "#ff9d0a", f2: "#ffd23f", f3: "#fffbe0", leg: "#c98a1a" }],
  won: { scratch: { f1: "#ff3d1f", f2: cvLt("#ff3d1f", 0.42), f3: cvLt("#ff3d1f", 0.8), skin: "#8c4a30" },
    zorp: { f1: "#5aff9a", f2: cvLt("#5aff9a", 0.42), f3: cvLt("#5aff9a", 0.8), skin: "#a9c8a0" },
    kraken: { f1: "#ff7a8a", f2: cvLt("#ff7a8a", 0.42), f3: "#fff0d6", skin: "#b89a62" },
    harvest: { f1: "#ff9a1f", f2: "#ffd23f", f3: "#fffbe0", skin: "#f8cc52" } },
  pm: { 1: { f1: "#ff6a2b", f2: "#d8cfb8", f3: "#f1e8d2", skin: "#f1e8d2" }, 2: { f1: "#ff6a9a", f2: "#ffb0e0", f3: "#fff0fa", skin: "#34246a" } },
  prim: "f1",
  derive(C) { C.hi = cvLt(C.skin, 0.6); C.legB = cvSh(C.leg, 0.25); },
  body: { x: 2, y: -36, rx: 16.5, ry: 23.5, o: { pear: -0.14, lean: 0.14 } },
  face: { x: 9, y: -43, s: 1, iris: "iris", brow: -0.28, browUp: 2.4, mouth: { k: "open", x: 10, y: -33.5, s: 0.95 },
    extra(S) { S.add([cvCirc(0.5, -35.5, 3.4, 2), cvCirc(18.5, -36, 2.7, 1.6)], "blush", 1, 0.42); } },
  mouthPt: [13, -33],
  arm: { shF: [11, -25], shB: [-8, -37], len: 23, lenB: 15, bendB: "back", r0: 4.2, r1: 3.5, col: "f2",
    hand: { r: 5.2, col: "f3" }, handB: { r: 4.8, col: "f2", thumb: false } },
  leg: { hipF: [6, -16], hipB: [-4, -16], len: 14, draw: (c, K, hip, foot, front) => cvPhxLeg(c, K, hip, foot, front) },
  carve: {
    // the two tail ribbons, low behind
    tail(S) { cvPhxFlame(S, CV_PHX_TAIL, -12, -16, 0.62); },
    // the wing: four flame feathers off the back (its root (-6, -42))
    wing(S) { cvPhxFlame(S, CV_PHX_WING, -10, -42, 0.66, 0.36); },
    // the crest, swept back behind the head
    crest(S) { cvPhxFlame(S, CV_PHX_CREST, -4, -58, 0.66, 0.36); },
    // the sweet potato tipped forward, a glossy brow, the sprout green in the fire
    body(S) {
      S.cel(cvBlob(2, -36, 16.5, 23.5, { pear: -0.14, lean: 0.14 }), "skin", { sh: [8, -5], rim: 1, in() {
        S.specks([[-6, -24, 1.3], [-9, -34, 1], [0, -18, 1.1]], "skin/sh.3");
        S.fill(cvCirc(11, -52, 5, 2.4, -0.5), "hi");
      } });
      S.line([[12, -55], [11.5, -60.3], [12.5, -63.3]], 2.4, "stem");
      S.leaf(12, -62.7, 8.9, -2.5, "leaf"); S.leaf(12, -63.2, 10, -0.6, "leaf");
    },
    // the feather sleeve: three feathers hanging under the front arm, swept back (carved for an arm 20 units long, along +x)
    sleeve(S) {
      const P = cvSm([[0, -2.5, 1], [18, -2, 1], [17, 3], [13.5, 13, 1], [10, 5], [5, 14.5, 1], [3, 5], [-4, 11, 1], [-2, 1]]);
      S.cel(P, "f1", { sh: 0, lw: 2 });
      S.with(6, 2, 0, 0.62, () => S.fill(cvShift(P, -6, -2), "f2"));
    },
  },
  draw(K) {
    const f = K.f, P = K.P, tk = K.tk, air = !f.grounded && f.state !== "ledge";
    // the flames lag the body: they stream back on the run and lift as he falls (a spring); in steps of 0.04 rad, so a held pose of them
    // has a sprite of its own (K.stack), no sprite per animation step. Their flicker is live: embers off the crest (cvPhxEmbers)
    const run = clamp((f.vx + f.kbx) * f.facing, -10, 10), calm = clamp(1 - Math.abs(run) / 4, 0, 1);   // (the idle sway stops on the run: one pose)
    const lag = K.spring("flame", -run * 0.025 + (air ? clamp(f.vy * 0.025, -0.15, 0.2) : 0) + Math.sin(tk * 0.06 + f.slot) * 0.03 * calm, 0.3), lq = Math.round(lag * 25) / 25;
    K.stack(["tail"], (c) => { c.translate(-10, -14); c.rotate(lq * 1.4); c.translate(10, 14); }, lq.toFixed(2));
    // the wing: P.flap beats it, P.wingUp raises it (a heavy's flare, the Ultimate), the air spreads it (as the old flameWing); in steps of
    // 0.03 rad, so a held pose of it has a sprite of its own (K.stack)
    const wa = K.spring("wing", P.flap + P.wingUp * 0.9 + (air ? -0.3 : 0) + lag * 0.6, 0.45), wq = Math.round(wa / 0.03) * 0.03, ws = air ? 1.18 : 1;
    K.stack(["wing"], (c) => { c.translate(-6, -42); c.rotate(wq); c.scale(ws, ws); c.translate(6, 42); }, wq.toFixed(2) + "," + ws);
    // in the air the front wing-arm spreads forward, clear of the face (the rig raises it over the head)
    if (K.rest && air) K.hF = [P.hF[0] + 12, P.hF[1] + 9];
    K.arm(false);
    K.leg(false); K.leg(true);
    K.rim();
    K.stack(["crest"], (c) => { c.translate(-4, -54); c.rotate(lq * 0.8); c.translate(4, 54); }, lq.toFixed(2));
    if (!K.flash) K.body((c) => cvPhxEmbers(c, K, lq));
    K.stack(["body", "skin", "face", "top"]);
    cvPhxSleeve(K);
    K.arm(true);
  },
});
// embers: three sparks that rise off the crest's tips and drift back as they shrink (one live fill)
function cvPhxEmbers(c, K, lq) {
  const t = K.tk * 0.035 + K.f.slot * 0.3;
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const ph = (t + i / 3) % 1, r = 1.9 * (1 - ph) + 0.3, x = [1, -17, -30][i] - ph * (9 - lq * 40), y = [-84, -82, -68][i] - ph * 13;
    c.moveTo(x, y - r * 1.6); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.2); c.lineTo(x - r, y); c.closePath();
  }
  c.fillStyle = K.C.f2; c.fill();
}
// the feather sleeve under the front arm, shoulder to fist (paths: it turns with the arm); it hangs under the arm, or behind it when the
// arm is raised
function cvPhxSleeve(K) {
  const A = K.fig.arm, a = K.pt(A.shF[0], A.shF[1]), h = K.hF, dx = h[0] - a[0], dy = h[1] - a[1], d = Math.hypot(dx, dy);
  if (d < 6) return;
  const th = Math.atan2(dy, dx), flip = Math.cos(th) + Math.sin(th) < 0 ? -1 : 1, c = K.c;
  c.save(); c.translate(a[0], a[1]); c.rotate(th); c.scale(clamp(d / 20, 0.5, 1.4) * 0.9, flip);
  K.draw("sleeve");
  c.restore();
}
// the talon in its foot's frame (standing on (0, 0), the ankle over x = 0): its ink (the outline and two claws) and its fill, wound like a
// limb's contour so that one fill of the shin and the foot is their union (cvPhxLeg)
const CV_PHX_FOOT = cvSm([[-4, 0, 1], [-3, -4], [2, -4.5], [9.5, 0, 1]]), cvPhxCw = (P) => cvPos(P).slice().reverse();
const CV_PHX_TALON = [[cvOffset(CV_PHX_FOOT, 1), [[8.4, -0.3], [12.2, 0.6], [9.6, -2.6]], [[3.2, -0.4], [6.6, 0.7], [4.2, -2.8]]].map(cvPhxCw),
  [cvPhxCw(cvOffset(CV_PHX_FOOT, -1))]];
// a bird leg in two fills (the ink, the leg's one tone): thin, its knee bent back, on a three-toed foot that turns with the shin off the floor
function cvPhxLeg(c, K, a, ft, front) {
  const f = K.f, flat = f.grounded && ft[1] > -2 && f.state !== "attack";
  const kn = cvJoint(a, ft, 14, "back"), ang = flat ? 0 : clamp(-Math.atan2(ft[0] - kn[0], ft[1] - kn[1]) * 0.8, -1.4, 1.4);
  const cs = Math.cos(ang), sn = Math.sin(ang), an = [ft[0] + sn * 3, ft[1] - cs * 3], e = cvJoint(a, an, 14, "back");
  for (let i = 0; i < 2; i++) {
    const g = i ? -1 : 1;   // (the ink: the limb 1 wider; the fill: 1 narrower)
    c.beginPath(); cvLimbAdd(c, a, e, an, 2.6 + g, 2.35 + g, 2.1 + g, 0, 0, false, false);
    for (const Q of CV_PHX_TALON[i]) {
      for (let j = 0; j < Q.length; j++) { const x = ft[0] + Q[j][0] * cs - Q[j][1] * sn, y = ft[1] + Q[j][0] * sn + Q[j][1] * cs; if (j) c.lineTo(x, y); else c.moveTo(x, y); }
      c.closePath();
    }
    if (i) { c.fillStyle = front ? K.C.leg : K.C.legB; c.fill(); } else { c.fillStyle = CV_INK; c.fill(); cvMgInk(c); }
  }
}
