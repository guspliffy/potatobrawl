/* ===================== Carved Ink: Odin (ui/carve.js has the kit and the API) =====================
   A boulder: the widest, a square russet under a helm whose wings are his sprout leaves, a forked beard, a floor-length cape that settles
   late, steel gauntlets 17 units wide, one cold blue eye under a white brow and a patch on the other, the raven on his back shoulder.
   Mockup: redesign/mockups/src/fighters.js NEWF.d.odin; colours of the ten skins: fx.js skinPal(). */
cvFigReg("odin", {
  pal: { skin: "#e3a45a", steel: "#b9c4d6", cape: "#b8262d", beard: "#f6f1e7", gold: "#ecb53a", fur: "#8a6248", raven: "#2b3052",
    belt: "#5b3a2a", leaf: "#7fd35c", leafFar: "#63b548", iris: "#4a86c9", eyeR: "#ff5a4a" },
  chip: [{}, { cape: "#3d7fbf", steel: "#d3e6f6", gold: "#9fd6ff" }, { cape: "#7a3a1e", steel: "#ecc452", gold: "#fff2b0" },
    { cape: "#3d3d4c", steel: "#6e7289", gold: "#b6bbd6", raven: "#15131f" }],
  won: { scratch: { cape: "#8a1a1a", skin: "#8c4a30", steel: "#5a4a52", gold: "#ff7a2b" },
    zorp: { cape: "#5f8fa0", skin: "#a9c8a0", steel: "#cfe6de", gold: "#9dff5a", beard: "#e6ffe0" },
    kraken: { cape: "#2f6a7a", skin: "#b89a62", steel: "#8fc0c6", gold: "#3ef2c0", beard: "#e0f6f0" },
    harvest: { cape: "#a8641e", skin: "#f8cc52", steel: "#f2c94c", gold: "#fff6c8", beard: "#fff6dc" } },
  pm: { 1: { cape: "#ff3d57", skin: "#f1e8d2", beard: "#f1e8d2" },
    2: { cape: "#cfa9ff", skin: "#34246a", steel: "#e0d0ff", gold: "#ff6ad5", beard: "#f6eaff", raven: "#0e0a1f" } },
  prim: "cape",
  derive(C) {
    C.greave = cvSh(C.steel, 0.35); C.steelHi = cvMix(C.steel, "#ffffff", 0.72); C.lid = cvSh(C.skin, 0.2);
    C.beardSh = cvMix(C.beard, "#7f8fc0", 0.3); C.beardLn = cvMix(C.beard, "#5a6aa0", 0.4); C.capeIn = cvSh(C.cape, 0.5);
  },
  body: { x: 0, y: -36, rx: 24.5, ry: 26, o: { sq: 0.8 } },
  face: { x: 11.5, y: -43, s: 1.05, one: "far", iris: "iris", brow: -0.3, browCol: "beard", browW: 3.2, browUp: 0.6, lid: 0.22, lidCol: "lid",
    mouth: { k: "none", x: 8.5, y: -31, s: 0.85, under: true } },   // (it shows only when he shouts: under the moustache)
  mouthPt: [13, -33],
  arm: { shF: [15, -27], shB: [-19, -38], len: 26, lenB: 15, bendB: "back", r0: 6, r1: 5.4, col: "skin",
    hand: { r: 8.6, col: "steel", k: 1.56, thumb: false, more: (c, K, x, y, front, ang) => cvOdinFist(c, K, x, y, ang) }, handB: { r: 8, col: "steel", k: 1.28, thumb: false } },
  leg: { hipF: [9.9, -14], hipB: [-9.9, -14], len: 10.5, bones: 1, r0: 5.6, r1: 5.2, col: "greave", boot: { s: 1.2, col: "steel" } },
  carve: {
    // the cape hangs from the back of the shoulders to the floor, its hem cut in points
    cape(S) {
      S.cel(cvSm([[-14, -58, 1], [-28, -50], [-34, -24], [-40, -1, 1], [-30, -5], [-22, -1, 1], [-14, -5], [-6, -2, 1], [-4, -30]]), "cape", { sh: [4, -3] });
      S.line([[-17, -50], [-24, -30], [-29, -6]], 1.3, "capeIn");
    },
    // the square russet, the belt across it, the fur collar on the back shoulder
    body(S) {
      S.cel(cvBlob(0, -36, 24.5, 26, { sq: 0.8 }), "skin", { sh: [10, -6], rim: 1, in() {
        S.specks([[-14, -24, 1.4], [-18, -34, 1.1]], "skin/sh.3");
        S.rect(-30, -22, 60, 7, "belt"); S.rect(-30, -22, 22, 7, "belt/sh"); S.rect(10, -22.5, 7, 8, "gold");
        S.rect(-30, -23, 60, 1.4, "ink"); S.rect(-30, -15.6, 60, 1.4, "ink"); S.rect(10, -22.5, 1.2, 8, "ink"); S.rect(16.4, -22.5, 1.2, 8, "ink");
      } });
      S.cel(cvSm([[-24, -46], [-27, -54], [-19, -57], [-12, -52], [-14, -44], [-20, -41]]), "fur", { sh: [2, -2], lw: 2.2 });
    },
    // the raven, hunched on the shoulder (its perch (-20, -64)): gold beak, red eye
    raven(S) {
      S.cel(cvSm([[-34, -62, 1], [-26, -70], [-17, -72], [-12, -68], [-6, -67, 1], [-12, -64], [-15, -58], [-24, -56]]), "raven", { sh: [2, -2], lw: 2.2 });
      S.fill([[-11.5, -68.6], [-5, -67], [-11.5, -65.2]], "gold");
      S.fill(cvCirc(-15.5, -67.6, 1.3), "eyeR");
    },
    // the helm (steel cap, gold rim, nose guard) with the two leaves for wings, the patch and its strap, the forked beard
    head(S) {
      S.leaf(-8, -62, 17, -2.05, "leafFar");
      S.cel(cvSm([[-22, -47, 1], [-23, -60], [0, -70], [22, -61], [22.5, -47, 1], [14, -49], [12, -40, 1], [8.5, -40, 1], [7, -49], [-8, -48]]), "steel", { sh: [7, -5], hi: [-5, 6], hiCol: "steelHi" });
      S.line([[-22, -48.5], [-8, -49.5], [7, -50.5]], 2.6, "gold"); S.line([[14, -50.5], [22, -48.5]], 2.6, "gold");
      S.leaf(9, -63, 19, -2.2, "leaf"); S.cel(cvCirc(9, -61.5, 3.2), "gold", { sh: [1, -1], lw: 1.6 });
      S.fill(cvBlob(1.5, -43, 5, 4.6), "ink"); S.line([[-20, -47], [-6, -44], [3, -43]], 1.8);
      S.cel(cvSm([[-13, -37, 1], [-2, -35], [10, -37.5], [20, -35], [25.5, -38, 1], [25, -24], [17, -7, 1], [13, -19], [9, -17, 1], [4, -3, 1], [-6, -18], [-14, -26]]), "beard", { sh: [5, -3], shade: "beardSh", lw: 2.4 });
      S.line([[1, -28], [3, -16]], 1.2, "beardLn"); S.line([[16, -28], [16, -19]], 1.2, "beardLn");
    },
    // the moustache, over the mouth
    stache(S) { S.cel(cvSm([[10, -38, 1], [4, -37], [-5, -30, 1], [4, -31], [10, -34, 1], [17, -31], [26, -31, 1], [17, -37]]), "beard", { sh: [2, -2], shade: "beardSh", lw: 1.8 }); },
  },
  draw(K) {
    const f = K.f, P = K.P, tk = K.tk, air = !f.grounded && f.state !== "ledge";
    // the cape: it trails behind on the run and settles late (a spring), lifts when he falls, breathes at rest (sheared about the
    // shoulders; in steps of 0.02 and 0.05, so a held pose of it has a sprite of its own: K.stack)
    const run = clamp((f.vx + f.kbx) * f.facing, -10, 10), sway = K.spring("cape", -run * 0.05 + Math.sin(tk * 0.05 + f.slot) * 0.025 + (air ? -0.1 : 0), 0.16);
    const sw = Math.round(sway * 50) / 50, lift = air ? Math.round(clamp(f.vy * 0.025, -0.1, 0.28) * 20) / 20 : 0;
    K.stack(["cape"], (c) => { c.translate(-12, -56); c.transform(1, 0, sw, 1 - lift, 0, 0); c.translate(12, 56); }, sw + "," + lift);
    K.arm(false);
    K.leg(false); K.leg(true);
    K.rim();
    // the raven sits in the body's sprite while it is perched; when it lifts off it is drawn on its own
    const perched = !f._ravenOut && !(P.ravenTo && P.ravenK > 0);
    K.stack(["body", "skin", perched ? "raven" : f._ravenOut ? null : cvOdinRaven, "head", "face", "stache", "top"]);
    K.arm(true);
  },
});
// the front gauntlet over its round steel fist: the highlight on top, a gold plate on its back and the knuckles (turned with the forearm)
const CV_ODIN_PLATE = cvPath([cvClip(cvRect(-9, -3.5, 5, 7), cvCirc(0, 0, 7.5))]), CV_ODIN_KNUCKLE = cvPath([cvBrush(cvSm([[2, -6], [6, -1], [3, 5]], true), 1.3)]);
function cvOdinFist(c, K, x, y, ang) {
  const C = K.C;
  if (!C.flat) { c.beginPath(); cvArcAdd(c, x + 0.6, y - 0.6, 5.3, -2.2, -0.5, 2); c.fillStyle = C.steelHi; c.fill(); }
  c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = C.gold; c.fill(CV_ODIN_PLATE); c.fillStyle = CV_INK; c.fill(CV_ODIN_KNUCKLE); c.restore();
}
// the raven on the back shoulder: it shifts its weight now and then, lifts off with the fist (Raven rise: P.ravenTo, P.ravenK)
function cvOdinRaven(K) {
  const P = K.P, f = K.f, c = K.c, tk = K.tk;
  let p = K.pt(-20, -64), wob = Math.sin(tk * 0.031 + f.slot) > 0.93 ? 0.09 : 0, flap = Math.sin(tk * 0.08 + f.slot) > 0.95 ? 0.5 : 0;
  if (P.ravenTo && P.ravenK > 0) { p = lerp2(p, P.ravenTo, P.ravenK); if (P.ravenK > 0.3) flap = 0.5 + 0.5 * Math.sin(tk * 1.1); }
  c.save(); c.translate(p[0], p[1]); if (P.lean + wob) c.rotate(P.lean + wob);
  if (flap) {   // the wing, raised
    const C = K.C; c.save(); c.translate(-4, -4); c.rotate(-0.4 - flap * 1.1);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-6, -9, -16, -8); c.lineTo(-11, -4); c.lineTo(-14, -1); c.quadraticCurveTo(-6, 3, 0, 0); c.closePath();
    c.fillStyle = C.raven; c.fill(); c.lineWidth = 1.8; c.strokeStyle = CV_INK; c.lineJoin = "round"; c.stroke(); c.restore();
  }
  c.translate(20, 64); K.draw("raven");
  c.restore();
}
