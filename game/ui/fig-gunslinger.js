/* ===================== Carved Ink: Gunslinger (ui/carve.js has the kit and the API) =====================
   A flat hat over a poncho triangle on long legs: the lankiest potato, a hat wider than he is (it tips as he rises and falls), the shadow of
   the brim over his eyes, a smirk with a wheat stalk (his sprout, chewed), a red bandana whose two tails stream behind, a striped poncho
   with a pointed hem, denim legs in boots with spurs, and two long-barrel revolvers. The pistols keep today's pose logic (heldDir with the
   rest angle -0.3, P.gunB, P.shotF / P.shotB and the muzzle flash gunFlash() at gunMuzzle(): the barrel ends at 18.5 along it, as in
   gunHeld()); they are carved here, steel and grip in the skin's colours. Mockup: redesign/mockups/src/fighters.js NEWF.d.gunslinger;
   skins: fx.js skinPal(). */
cvFigReg("gunslinger", {
  pal: { skin: "#e9b268", hat: "#8f5c33", pon: "#c8793a", cream: "#f6dfae", teal: "#2f9a94", red: "#dd4238", denim: "#3f5285", hide: "#4a2f22",
    steel: "#cdd4de", gold: "#ecb53a", grip: "#6e4526", iris: "#2f8f8a", stalk: "#c9a14a", wheat: "#d9c05a" },
  chip: [{}, { hat: "#2c2836", pon: "#3f3848", cream: "#b3a6d0", teal: "#dd4238", denim: "#2a2a36" },
    { hat: "#f3ecd9", pon: "#5a82b8", cream: "#f6dfae", teal: "#ecb53a", red: "#2f5fa8" },
    { hat: "#3a2a1a", pon: "#dba62c", cream: "#fff3b8", teal: "#8a5a1a", steel: "#f2c94c", red: "#8a1f1f" }],
  won: { scratch: { pon: "#4a2018", skin: "#8c4a30", hat: "#2a1512", cream: "#ff7a2b", teal: "#ffb02e", denim: "#2a1a1c" },
    zorp: { pon: "#7a9a8a", skin: "#a9c8a0", hat: "#3a5a52", cream: "#9dff5a", teal: "#d6f6e0", denim: "#2a4a4a" },
    kraken: { pon: "#6a8a8a", skin: "#b89a62", hat: "#2a3a46", cream: "#3ef2c0", teal: "#ff7a8a", denim: "#1f3a4a" },
    harvest: { pon: "#7a5226", skin: "#f8cc52", hat: "#8a531e", cream: "#ffe08a", teal: "#fff6c8", steel: "#f2c94c", denim: "#5a3a1c" } },
  pm: { 1: { pon: "#3a3842", skin: "#f1e8d2", teal: "#3ef2c0", red: "#3ef2c0" },
    2: { pon: "#c7ff5a", skin: "#34246a", hat: "#1a1238", cream: "#ff6ad5", teal: "#2b1f52", denim: "#1a1238", red: "#ff6ad5" } },
  prim: "pon",
  derive(C) { C.lid = cvSh(C.skin, 0.34); C.redSh = cvSh(C.red, 0.2); C.steelHi = cvMix(C.steel, "#ffffff", 0.6); },
  body: { x: 0, y: -39, rx: 16, ry: 20.5 },
  face: { x: 7.5, y: -46, s: 0.92, iris: "iris", brow: 0.12, noBrow: true, lid: 0.42, lidCol: "lid", mouth: { k: "smirk", x: 9, y: -38.5, s: 0.9 } },
  mouthPt: [10, -38],
  arm: { shF: [8, -33], shB: [-11, -34], len: 22, lenB: 20, bendB: "back", r0: 4, r1: 3.6, col: "pon",
    hand: { r: 4.7, col: "hide" }, handB: { r: 4.4, col: "hide", thumb: false } },
  leg: { hipF: [5, -21], hipB: [-5, -21], len: 18, r0: 4.6, r1: 4, col: "denim", boot: { s: 1.12, col: "hide" } },
  carve: {
    // the two bandana tails, from the knot at the back of the neck, hanging at rest (turned 0.3 down about the knot)
    tails(S) {
      const T = (pts) => cvSm(pts.map((p) => [p[0] + 10, p[1] + 45, p[2]]));
      S.with(-10, -45, -0.3, 1, () => {
        S.cel(T([[-10, -47, 1], [-22, -52], [-30, -46], [-40, -50, 1], [-36, -42, 1], [-28, -40], [-20, -44], [-10, -42, 1]]), "red", { sh: [2, -1.5], lw: 2.2 });
        S.cel(T([[-10, -45, 1], [-19, -41], [-26, -36], [-34, -36, 1], [-31, -31, 1], [-23, -32], [-16, -38], [-9, -41, 1]]), "redSh", { sh: [2, -1.5], lw: 2.2 });
      });
    },
    // the potato, the shadow of the brim across its top
    body(S) {
      S.cel(cvBlob(0, -39, 16, 20.5), "skin", { sh: [7, -5], rim: 1, in() {
        S.specks([[-8, -30, 1.2], [-11, -38, 0.9]], "skin/sh.3");
        S.rect(-20, -62, 40, 12.5, "skin/sh");
      } });
    },
    // the poncho: a triangle with a pointed hem, a cream and a teal stripe along it; the bandana knotted at the neck
    poncho(S) {
      S.cel(cvSm([[-13, -46, 1], [-20, -36], [-26, -22, 1], [-10, -19], [5, -12, 1], [14, -22], [24, -28, 1], [18, -38], [13, -47, 1], [0, -43]]), "pon", {
        sh: [6, -4], rim: 1, in() {
          S.line([[-26, -27], [-10, -24], [5, -17], [14, -27], [25, -33]], 3.4, "cream");
          S.line([[-26, -32], [-10, -29], [5, -22], [14, -32], [25, -38]], 2.2, "teal");
        } });
      S.cel(cvSm([[-11, -47, 1], [1, -43], [13, -48, 1], [10, -41], [3, -36, 1], [-6, -41]]), "red", { sh: [3, -2], lw: 2 });
    },
    // the wheat stalk he chews (his sprout)
    stalk(S) { S.line([[13.5, -39.5], [22, -43], [27, -42]], 1.5, "stalk"); S.leaf(26, -42, 6, -0.5, "wheat"); },
    // the hat: a dented crown with the band and its gold star, the wide brim with its sides curled up
    hat(S) {
      S.cel(cvSm([[-12, -59, 1], [-12, -71], [-5, -76], [1, -72], [8, -77], [14, -71], [14, -58, 1]]), "hat", { sh: [5, -3], hi: [-3, 4], hiCol: "hat/lt.25" });
      S.cel(cvSm([[-12, -60, 1], [-12.2, -64.5], [1, -63], [14.2, -64.5], [14, -59, 1], [1, -57]]), "red", { sh: [3, -2], lw: 1.6 });
      S.star(4, -61, 2.8, "gold", 1);
      S.cel(cvSm([[-31, -62], [-15, -55], [3, -53.5], [22, -52.5], [35, -55], [24, -59.5], [3, -60], [-17, -62.5]]), "hat", { sh: [4, -2.4], rim: 1, hi: [-3, 2.4], hiCol: "hat/lt.25" });
    },
    // a long-barrel revolver in the hand at 0, along +x: the barrel to 18.5 (the muzzle, gunMuzzle()), the cylinder, the grip down
    gun(S) { cvGnsGun(S, false); },
    gunB(S) { cvGnsGun(S, true); },
  },
  draw(K) {
    const f = K.f, P = K.P, air = !f.grounded && f.state !== "ledge";
    // the bandana tails: they hang at rest, stream back and flutter on the run, lift as he falls (a spring about the knot; steps of 0.04)
    const run = clamp(Math.abs(f.vx + f.kbx), 0, 12);
    const ang = K.spring("tails", run * 0.045 + (air ? clamp(f.vy * 0.05, -0.45, 0.5) : 0), 0.28) + (run > 3 || air ? 0.06 * Math.sin(K.tk * 0.45) : 0);
    const aq = Math.round(ang * 25) / 25;
    // the hat: it tips back as he rises and forward as he falls (steps of 0.03)
    const tilt = K.spring("ghat", air ? clamp(f.vy * 0.008, -0.07, 0.07) : 0, 0.3), tq = Math.round(tilt / 0.03) * 0.03;
    K.arm(false, cvGnsGunB);
    K.leg(false); K.leg(true);
    K.rim();
    // at rest the tails and the hat go into the body's sprite; moving, each is a stack of its own
    const tR = !aq, hR = !tq;
    if (!tR) K.stack(["tails"], (c) => { c.translate(-10, -45); c.rotate(aq); c.translate(10, 45); }, String(aq));
    K.stack([tR ? "tails" : null, "body", "skin", "poncho", "face", "stalk", hR ? "hat" : null, hR ? "top" : null].filter(Boolean));
    if (!hR) { K.stack(["hat"], (c) => { c.translate(2, -58); c.rotate(tq); c.translate(-2, 58); }, String(tq)); if (K.skinPass) K.skinTop(); }
    K.arm(true, cvGnsGunF);
  },
});
// spurs on the boots: a gold rowel at the heel (the kit carves the boots from leg.boot; this adds the rowel to the same parts)
CV_FIG.gunslinger.carve.boot = (S) => { S.boot(0, 0, 1.12, "hide"); S.line([[-5.6, -3.4], [-7.6, -3.6]], 1.2, "ink"); S.star(-8.4, -3.6, 2.6, "gold", 1); };
CV_FIG.gunslinger.carve.bootB = (S) => { S.boot(0, 0, 1.12, "hide"); S.line([[-5.6, -3.4], [-7.6, -3.6]], 1.2, "ink"); S.star(-8.4, -3.6, 2.6, "gold/sh", 1); };
// the revolver, carved (far: the one in the back hand, in shadow tones and flat): one ink under all its pieces, the grip, the steel,
// their shadows, the lines (six fills, four far: it is drawn as paths, turned with the hand)
function cvGnsGun(S, far) {
  const st = far ? "steel/sh.3" : "steel", sd = "steel/sh", gr = far ? "grip/sh.3" : "grip", gd = "grip/sh";
  const G = cvPos(cvSm([[-4.2, -1.6, 1], [2, -1.6, 1], [-0.6, 8.6, 1], [-7, 8, 1]])), B = cvPos(cvRect(3, -4.4, 15.5, 3.4));
  const H = cvPos([[-4.4, -4.8], [-7.8, -7.8], [-2.6, -5.4]]), Y = cvPos(cvSm([[-5, -5.6, 1], [5.2, -5.6, 1], [5.2, 1.6, 1], [-5, 1.6, 1]]));
  S.add([G, B, H, Y].map((P) => cvOffset(P, 0.8)).concat([cvRect(15.4, -6.3, 1.7, 2)]), "ink");
  const gi = cvOffset(G, -0.8), bi = cvOffset(B, -0.8), yi = cvOffset(Y, -0.8);
  S.add([gi], gr); if (!far) S.add(cvMinus(gi, cvShift(G, 1.2, -1)), gd, 1);
  S.add([bi, cvOffset(H, -0.6), yi], st);
  if (!far) S.add(cvMinus(bi, cvShift(B, 0, -1.1)).concat(cvMinus(yi, cvShift(Y, 0, -1.6))), sd, 1);
  S.line([[-3, -1.9], [3.4, -1.9]], 0.8, "ink"); S.line([[5.2, -5], [5.2, 1]], 1, "ink"); S.line([[0.2, 1.6], [1.6, 4.6], [4.2, 1.6]], 1, "ink");
}
// a pistol in the hand (gunHeld's pose and size: the far one 0.92; the muzzle flash when it has just fired), between the arm and the fist
function cvGnsGunAt(c, K, front) {
  const P = K.P, f = K.f, h = front ? K.hF : K.hB;
  const a = front ? heldDir(f, P, rot(P.sh, P.hip, P.lean), -0.3) : P.gunB != null ? P.gunB : Math.PI + 0.35, shot = front ? P.shotF : P.shotB;
  c.save(); c.translate(h[0], h[1]); c.rotate(a); if (!front) c.scale(0.92, 0.92);
  K.draw(front ? "gun" : "gunB");
  if (shot >= 0 && !K.flash) { const big = front ? P.bigF : P.bigB; gunFlash(c, 18.5, -2.7, shot, big ? 1.9 : f.finShot && front ? 1.6 : P.ultShots ? 1.3 : 1, big || (f.finShot && front)); }
  c.restore();
}
const cvGnsGunF = (c, K) => cvGnsGunAt(c, K, true), cvGnsGunB = (c, K) => cvGnsGunAt(c, K, false);
