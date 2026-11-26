/* ===================== Carved Ink: Dragon (ui/carve.js has the kit and the API) =====================
   A pear: bottom-heavy, a jaw that sticks out with an underbite fang and a smoking nostril, a heavy brow, horns forward, the scaled back
   with its spikes, cream belly plates, two raised bat wings behind him and a thick curled tail with a spade tip. Clawed feet, a clawed
   fist. The wings are driven like the old batWing (draw-fighters.js): P.flap beats them, P.wingUp spreads them, the air opens them; they
   bob on his footfalls. The tail counter-swings at rest and follows P.tailTo in the Tail sweep (as the old dragonTail). Mockup:
   redesign/mockups/src/fighters.js NEWF.d.dragon; skins: fx.js skinPal(). */
const CV_DRG_WING = [[-13, -48, 1], [-18, -64], [-32, -88, 1], [-34, -66], [-56, -60, 1], [-40, -50], [-50, -34, 1], [-28, -38], [-16, -34, 1]];
const CV_DRG_FOOT = [[-7, 0, 1], [-7, -9], [2, -11], [6, -5], [12, -4], [13, 0, 1]];
const CV_DRG_TOE = [4, 8, 12].map((d) => [[d - 2, 0], [d + 1.5, 0], [d + 1.6, -3.4]]);
// a bat wing at (dx, dy) from the mockup's, nine tenths its size about its root (-10, -44): the membrane, the arm bone inked, two finger bones
function cvDrgWing(S, dx, dy, bone, mem) {
  S.with(dx - 1, dy - 4.4, 0, 0.9, () => {
    S.cel(cvSm(CV_DRG_WING), mem, { sh: [3, -2.5] });
    S.line([[-11.5, -49], [-18, -64], [-32, -88]], 4.4, "ink"); S.line([[-11.5, -49], [-18, -64], [-32, -88]], 2.4, bone);
    S.line([[-20, -66], [-36, -62], [-55, -60]], 1.5, bone); S.line([[-19, -64], [-34, -48], [-49, -35]], 1.5, bone);
  });
}
// a clawed foot standing on (0, 0), the ankle over x = 0: the foot, then its three horn claws
function cvDrgFoot(S, col, shade) {
  S.cel(cvSm(CV_DRG_FOOT), col, shade ? { sh: [2, -2], lw: 2.2 } : { sh: 0, lw: 2.2 });
  S.add(CV_DRG_TOE.map((t) => cvOffset(cvPos(t), 0.5)), "ink"); S.add(CV_DRG_TOE.map((t) => cvOffset(cvPos(t), -0.5)), "horn");
}
cvFigReg("dragon", {
  pal: { skin: "#efac5a", sc: "#d9562a", mem: "#ffa24a", belly: "#ffe6b3", horn: "#fff3da", leaf: "#7fd35c", iris: "#f2b21f" },
  chip: [{}, { sc: "#8fdc6a", mem: "#1f6a4a", belly: "#f6f3c0" }, { sc: "#2a2240", mem: "#7a64c8", belly: "#b8aee0", horn: "#e6e0ff" }, { sc: "#c2202a", mem: "#ffd23f", belly: "#3a0f14", horn: "#2a1418" }],
  won: { scratch: { sc: "#a01f1f", horn: "#c9262a", skin: "#8c4a30", mem: "#ff7a1f", belly: "#ffb86a" },
    zorp: { sc: "#3fbf7a", skin: "#a9c8a0", mem: "#b6ffb0", belly: "#e6ffd6" },
    kraken: { sc: "#3f7a8a", skin: "#b89a62", mem: "#7ae0d6", belly: "#f0e6c0" },
    harvest: { skin: "#ffd66b", sc: "#e0a01a", mem: "#8a4f14", belly: "#fff3c8", horn: "#fff6dc", "skin/sh": "#b8761a", "skin/lt": "#fff3b0" } },
  pm: { 1: { sc: "#ffc21f", skin: "#f1e8d2", mem: "#d8cfb8" }, 2: { skin: "#34246a", sc: "#4a2f9a", mem: "#ff6ad5", belly: "#c9a6ff", horn: "#ffe6fa", iris: "#ff8c42", rim: "#ff6ad5" } },
  prim: "sc",
  derive(C) {
    C.lid = cvSh(C.skin, 0.18); C.scB = cvSh(C.sc, 0.3); C.memB = cvSh(C.mem, 0.42); C.bellyLn = cvMix(C.belly, "#a0602a", 0.42);
    C.hornSh = cvMix(C.horn, "#c8863a", 0.38); C.hornB = cvSh(C.horn, 0.18);
  },
  body: { x: 0, y: -31, rx: 20.5, ry: 24, o: { pear: 0.2, sq: 0.95 } },
  face: { x: 9.5, y: -43, s: 1, iris: "iris", brow: 0.5, lid: 0.26, lidCol: "lid", browW: 3, browUp: 0,
    mouth: { k: "none", x: 20.5, y: -31, s: 0.9 } },   // (the mouth line and the fang are carved on the jaw; a shout opens it there)
  mouthPt: [27, -32],
  arm: { shF: [8, -27], shB: [-15, -32], len: 24, lenB: 14, bendB: "back", r0: 5.6, r1: 3.4, col: "skin", colB: "sc", colU: "sc",
    hand: { r: 7.6, col: "sc", thumb: false, k: 1.3, more: (c, K, x, y, front, ang) => cvDrgClaws(c, K, x, y, ang) }, handB: { r: 5.6, col: "sc", thumb: false } },
  leg: { hipF: [10, -14], hipB: [-9, -14], len: 9, draw: (c, K, hip, foot, front) => cvDrgLeg(c, K, hip, foot, front) },
  carve: {
    wingB(S) { cvDrgWing(S, -4, -3, "scB", "memB"); },
    wingF(S) { cvDrgWing(S, 3, 3, "sc", "mem"); },
    // the tail, curled up behind, and its spade
    tail(S) {
      S.cel(cvSm([[-15, -22, 1], [-26, -17], [-36, -20], [-41, -28], [-42, -37], [-46, -43, 1], [-50, -37], [-50, -25], [-43, -11], [-30, -5], [-15, -5, 1]]), "sc", { sh: [3, -3] });
      S.cel(cvSm([[-45, -34, 1], [-56, -40, 1], [-48, -50, 1], [-38, -41, 1]]), "mem", { sh: [2, -2], lw: 2.2 });
    },
    // the spade alone, pointing along +x (the live tail of the Tail sweep)
    spade(S) { S.cel(cvSm([[-3, 0, 1], [5, -6, 1], [13, 0, 1], [5, 6, 1]]), "mem", { sh: [2, -2], lw: 2.2 }); },
    // the clawed feet, standing on (0, 0), the ankle over x = 0 (the far one in the scales' shadow)
    foot(S) { cvDrgFoot(S, "sc", true); },
    footB(S) { cvDrgFoot(S, "sc/sh", false); },
    // the back spikes and the far horn (k: the horn's size about its root (-2, -54); Devil's Roast wears it 1.25 times bigger: backDR)
    back(S, k) {
      for (const [x, y, a] of [[-9, -53, -0.9], [-17, -45, -1.25], [-22, -34, -1.5], [-24, -23, -1.75]])
        S.with(x, y, a + Math.PI / 2, 1, () => S.cel(cvSm([[-4, 2, 1], [0, -8, 1], [4, 2, 1]]), "horn", { sh: [1, -1], shade: "hornSh", lw: 1.8 }));
      S.with(-2, -54, 0, k || 1, () => S.cel(cvSm([[-4, 1, 1], [-2, -10], [7, -18, 1], [3, -8], [4, 0, 1]]), "hornB", { sh: [1, -1], lw: 2 }));
    },
    backDR(S) { this.back(S, 1.25); },
    // the pear and its jaw under one outline: the scaled back, the belly plates, the jaw's shadow, the mouth with its fang, the nostril
    body(S) {
      const B = cvPos(cvBlob(0, -31, 20.5, 24, { pear: 0.2, sq: 0.95 })), J = cvPos(cvBlob(19, -33, 9, 6.6)), Ji = cvOffset(J, -1.3);
      S.fill(cvOffset(B, 1.3), "ink"); S.fill(cvOffset(J, 1.3), "ink");
      S.fill(Ji, "skin");
      S.cel(cvOffset(B, -1.3), "skin", { lw: 0, sh: [9, -6], rim: 1, in() {
        S.specks([[2, -48, 1.1], [-4, -40, 1]], "skin/sh.3");
        S.cel(cvSm([[-30, -60, 1], [-2, -60, 1], [-8, -50], [-4, -44], [-11, -38], [-7, -30], [-14, -24], [-10, -16], [-16, -6, 1], [-30, -6, 1]]), "sc", { sh: [3, -2], lw: 1.6 });
        S.cel(cvCirc(7, -19, 12.5, 13.5), "belly", { sh: 0, lw: 1.6 });
        for (const y of [-25, -19, -13]) S.line([[-6, y], [7, y + 2.5], [20, y]], 1.4, "bellyLn");
      } });
      S.fill(cvClip(cvRect(8, -29.5, 30, 6), cvHull(Ji)), "skin/sh");
      S.line([[13, -30.5], [20, -29], [27, -31.5]], 1.9);
      S.cel([[20, -29.4], [21.6, -34.4], [23.6, -30]], "eye", { lw: 1.2, sh: 0 });
      S.fill(cvCirc(24.5, -36, 1.1, 1.7, 0.3), "ink");
    },
    // the near horn over the brow (k: its size about its root (9, -54); Devil's Roast: hornsDR), and the sprout between the horns
    horns(S, k) {
      S.with(9, -54, 0, k || 1, () => S.cel(cvSm([[-4, 0, 1], [0, -10], [12, -17, 1], [5, -7], [4, 1, 1]]), "horn", { sh: [1.4, -1.4], shade: "hornSh", lw: 2 }));
      S.leaf(-2, -55, 8, -1.9, "leaf"); S.leaf(-1, -55, 8.5, -1.1, "leaf");
    },
    hornsDR(S) { this.horns(S, 1.25); },
  },
  draw(K) {
    const f = K.f, P = K.P, tk = K.tk, air = !f.grounded && f.state !== "ledge";
    // (calm: 1 standing, 0 on the run; the idle breathing stops on the run, so a run holds one pose of each part: K.stack)
    const run = clamp((f.vx + f.kbx) * f.facing, -10, 10), calm = clamp(1 - Math.abs(run) / 4, 0, 1), c = K.c;
    // the wings (one sprite, the far one a little behind and darker): P.wingUp spreads them (+ raises), P.flap beats them, the air opens
    // them a little lower and wider, and they settle late (a spring); in steps of 0.04 rad, so a held pose has a sprite of its own
    // (K.stack). They bob on each footfall of the run (a lift: it needs no sprite of its own). Wings and tail ride on the body but do not
    // tip with its lean (they trail): turned no more than their own swing, their sprites stay small and mostly upright
    const bob = f.state === "run" && f.grounded ? -Math.abs(Math.sin(f.anim.run)) * 2.4 : 0, ul = -P.lean;
    const wt = P.wingUp * 0.6 - P.flap * 0.8 + (air ? -0.15 : 0) + Math.sin(tk * 0.05 + f.slot) * 0.02 * calm;
    const wq = Math.round(K.spring("wings", wt, 0.45) * 25) / 25, ws = air ? 1.12 : 1;
    c.save(); c.translate(0, bob);
    K.stack(["wingB", "wingF"], (c) => { c.translate(-8, -43); c.rotate(wq + ul); c.scale(ws, ws); c.translate(8, 43); }, wq.toFixed(2) + "," + ws);
    c.restore();
    // the tail: it counter-swings against the run and lifts a little as he falls; in the Tail sweep it follows P.tailTo (live)
    if (P.tailTo) cvDrgTailLive(K);
    else {
      const ta = K.spring("tail", run * 0.02 + (air ? clamp(-f.vy * 0.015, -0.12, 0.12) : 0) + Math.sin(tk * 0.07 + f.slot) * 0.04 * calm, 0.2), tq = Math.round(ta * 25) / 25;
      K.stack(["tail"], (c) => { c.translate(-12, -14); c.rotate(tq + ul); c.translate(12, 14); }, tq.toFixed(2));
    }
    // at rest the fist stays under the jaw; in the air it goes out in front, clear of the face (the rig raises it over the head)
    if (K.rest) K.hF = air ? [P.hF[0] + 14, P.hF[1] + 10] : [P.hF[0] - 6, P.hF[1] + 7];
    K.arm(false);
    K.leg(false); K.leg(true);
    K.rim();
    const dr = skinRoad(f) === "scratch";   // Devil's Roast: his own horns, bigger (skinfx.js has the other fighters' horns)
    K.stack([dr ? "backDR" : "back", "body", "skin", "face", dr ? "hornsDR" : "horns", "top"]);
    if (calm > 0.5 && f.state !== "attack" && P.mouth <= 0.5 && !K.flash) cvDrgSmoke(K);   // (standing, between moves)
    K.arm(true);
  },
});
// the claws on the front fist (three bone-white points along the forearm)
const CV_DRG_CLAWS = [[4, -5, -0.5], [6.5, -0.5, 0], [4.5, 4, 0.5]].map(([x, y, a]) => cvPos([[-1, -1.8], [4.6, 0], [-1, 1.8]].map(([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)])));
const CV_DRG_CLAW = cvPath(CV_DRG_CLAWS), CV_DRG_CLAWI = cvPath(CV_DRG_CLAWS.map((p) => cvOffset(p, 1.1)));
function cvDrgClaws(c, K, x, y, ang) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(1.15, 1.15);   // (carved for a fist of radius 6.6)
  c.fillStyle = CV_INK; c.fill(CV_DRG_CLAWI); cvMgInk(c, CV_DRG_CLAWI); c.fillStyle = K.C.horn; c.fill(CV_DRG_CLAW);
  c.restore();
}
// smoke from the nostril while he stands: three puffs rising and fading (one fill)
function cvDrgSmoke(K) {
  const tk = K.tk, s = K.f.slot;
  K.body((c) => {
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const ph = (tk * 0.018 + i / 3 + s * 0.17) % 1, r = 1.3 + ph * 2.2;
      cvCircAdd(c, 26 + ph * 6 + Math.sin(ph * 6 + i) * 1.5, -37.5 - ph * 15, r * (ph > 0.8 ? (1 - ph) * 5 : 1));
    }
    const ga = c.globalAlpha; c.globalAlpha = ga * 0.7; c.fillStyle = "#ffffff"; c.fill(); c.globalAlpha = ga;
  });
}
// the tail in the Tail sweep: a bowed, tapered tail from the hip to P.tailTo (drawn live), the spade at its tip
function cvDrgTailLive(K) {
  const P = K.P, c = K.c, C = K.C, a = K.pt(-12, -16), t = P.tailTo, dx = t[0] - a[0], dy = t[1] - a[1], d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const e = [(a[0] + t[0]) / 2 + nx * d * 0.22, (a[1] + t[1]) / 2 + ny * d * 0.22];
  cvLimb(c, a, e, t, 7, 3, C.sc, cvShC(C, "sc"), 2.4, null, false, true);
  c.save(); c.translate(t[0], t[1]); c.rotate(Math.atan2(t[1] - e[1], t[0] - e[0])); K.draw("spade"); c.restore();
}
// a short leg on a clawed foot (paths) that turns with the shin off the floor
function cvDrgLeg(c, K, a, ft, front) {
  const C = K.C, f = K.f, flat = f.grounded && ft[1] > -2 && f.state !== "attack", sc = cvShC(C, "sc");
  const ang = flat ? 0 : clamp(-Math.atan2(ft[0] - a[0], ft[1] - a[1]) * 0.8, -1.4, 1.4);
  const ax = ft[0] + Math.sin(ang) * 6, ay = ft[1] - Math.cos(ang) * 6;
  cvLimb(c, a, null, [ax, ay], 5.4, 5, front ? C.sc : sc, sc, 2.2, null, false, false);
  c.save(); c.translate(ft[0], ft[1]); if (ang) c.rotate(ang); K.draw(front ? "foot" : "footB"); c.restore();
}
