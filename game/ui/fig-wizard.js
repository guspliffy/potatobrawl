/* ===================== Carved Ink: Wizard (ui/carve.js has the kit and the API) =====================
   A tall A: the tallest and narrowest potato under a hat as big as he is (the cone bent back, a gold star charm on its tip, the sprout on
   its front), a starred robe that flares to a gold hem and hides his legs (only the toes of his boots show), bell sleeves, kind half-closed
   eyes under white brows and a white moustache. The staff keeps today's pose logic (heldDir, 34 back and 40 forward of the hand, P.cryK,
   P.staffTip); its crystal floats in a gold crescent over the top and turns. Mockup: redesign/mockups/src/fighters.js NEWF.d.wizard;
   skins: fx.js skinPal(). */
cvFigReg("wizard", {
  pal: { skin: "#f2b04e", hat: "#3d3a78", robe: "#3d3a78", lining: "#8a66e0", gold: "#f6c64f", wood: "#8a5a36", cry: "#ffe38a", boot: "#5b3a2a",
    brow: "#fbf6ea", iris: "#3f6fb0", stem: "#4f9a3c", leaf: "#7fd35c", blush: "#ff6a5a" },
  chip: [{}, { hat: "#2f1a6a", robe: "#b79af5", gold: "#ff8ad8", lining: "#6a3fc4" }, { hat: "#3f8f52", robe: "#3f8f52", gold: "#f6c64f", lining: "#b6ff6a", cry: "#b6ff6a", wood: "#e6d9b0" }, { hat: "#f0d48a", robe: "#b3283a", gold: "#fff0b0", lining: "#ffb02e", cry: "#ff9a6a" }],
  won: { scratch: { hat: "#3a1428", robe: "#3a1428", skin: "#8c4a30", cry: "#ff8a3c", gold: "#ff7a2b", lining: "#ff5a36" },
    zorp: { hat: "#2f4f5a", robe: "#2f4f5a", skin: "#a9c8a0", cry: "#9dff5a", gold: "#9dff5a", lining: "#5affc3" },
    kraken: { hat: "#1e3a4a", robe: "#1e3a4a", skin: "#b89a62", cry: "#3ef2c0", gold: "#e6c98a", lining: "#3ef2c0" },
    harvest: { skin: "#f0b41e", hat: "#e0a01a", robe: "#a8641e", gold: "#fff3b0", lining: "#ffd66b", cry: "#fff6c8", wood: "#8a4f14", "skin/sh": "#b8761a", "skin/lt": "#fff3b0" } },
  pm: { 1: { robe: "#3a3842", skin: "#f1e8d2", cry: "#a86bff", gold: "#a86bff", brow: "#f1e8d2", hat: "#3a3842" },
    2: { skin: "#34246a", hat: "#4a2f9a", robe: "#2b1f52", gold: "#ffd36b", lining: "#ff6ad5", cry: "#ff6ad5", brow: "#f6eaff", wood: "#1a1238", boot: "#1a1238", rim: "#ff6ad5" } },
  prim: "robe",
  derive(C) {
    C.lid = cvSh(C.skin, 0.18); C.browSh = cvMix(C.brow, "#7f8fc0", 0.28); C.cryD = cvMix(C.cry, "#c0602a", 0.32);
    C.cryHi = cvMix(C.cry, "#ffffff", 0.7);
  },
  body: { x: 1, y: -40, rx: 15, ry: 22 },
  face: { x: 7, y: -45, s: 0.95, iris: "iris", brow: -0.2, browCol: "brow", browW: 3.2, browUp: 0.8, lid: 0.25, lidCol: "lid",
    mouth: { k: "none", x: 7.5, y: -31.5, s: 0.8, under: true } },   // (it shows only when he shouts: under the moustache)
  mouthPt: [8, -32],
  arm: { shF: [7, -37], shB: [-10, -38], len: 24, lenB: 20, bendB: "back", r0: 3.4, r1: 7, col: "robe",
    hand: { r: 4.6, col: "skin" }, handB: { r: 4.3, col: "skin", thumb: false } },
  carve: {
    // the potato: tall and narrow, two specks, the blush
    body(S) {
      S.cel(cvBlob(1, -40, 15, 22), "skin", { sh: [7, -5], rim: 1, in() {
        S.specks([[-8, -46, 1.2], [-10, -54, 0.9]], "skin/sh.3");
        S.add([cvCirc(-0.5, -38.6, 3.2, 1.9)], "blush", 0, 0.42); S.add([cvCirc(14.2, -40.6, 2.4, 1.6)], "blush", 0, 0.42);
      } });
    },
    // the robe over the lower half: a V neck with a gold edge, stars, the gold sash at the waist (the skirt hangs from under it, live)
    robe(S) {
      S.cel(cvSm([[-12.5, -40, 1], [-15.5, -31], [-17.5, -21.5, 1], [18, -21.5, 1], [16.8, -31], [15.2, -40, 1], [8, -34], [2, -29.5, 1], [-4, -34.5]]), "robe", {
        sh: [7, -4], rim: 1, in() {
          S.star(-8.5, -31, 3, "gold"); S.star(10.5, -28.5, 1.9, "gold"); S.star(-3, -36.5, 1.4, "lining/lt");
          S.rect(-20, -26, 40, 4.2, "gold"); S.rect(-20, -26, 12, 4.2, "gold/sh.3");
          S.rect(-20, -27, 40, 1.1, "ink"); S.rect(-20, -21.9, 40, 1.1, "ink");
        } });
      S.line([[-4, -34.5], [2, -29.5], [8, -34]], 2.2, "gold");
      S.cel(cvCirc(11, -23.8, 2.6, 2.4), "gold", { sh: [1, -1], lw: 1.6 });   // the knot
    },
    // the white moustache, under the nose (drawn over the near sleeve, which crosses the face at rest)
    stache(S) { S.cel(cvSm([[7, -39, 1], [2, -38], [-4, -32, 1], [3, -33.5], [7, -36, 1], [11, -33.5], [18, -32, 1], [12, -38]]), "brow", { sh: [1.5, -1.5], shade: "browSh", lw: 1.6 }); },
    // the hat: the cone bent back with the star charm on its tip, the gold band, the wide brim, the sprout growing out of its front
    hat(S) { S.with(0, -2, 0, 1, () => {
      S.cel(cvSm([[-13, -60, 1], [-10, -76], [-16.3, -88], [-34.4, -93.5, 1], [-11.6, -97.5], [5, -82], [15, -60, 1]]), "hat", { sh: [6, -4], rim: 1, hi: [-4, 4], hiCol: "hat/lt.22" });
      S.line([[-10, -84], [-16.3, -88], [-24.4, -91]], 1.3, "hat/sh.5");
      S.cel(cvSm([[-13, -61, 1], [-12.4, -67], [1, -65.5], [13.4, -67], [15, -61, 1], [1, -59]]), "gold", { sh: [3, -2], lw: 1.8 });
      S.cel(cvSm([[-28, -58], [-14, -53], [3, -52], [20, -53.5], [31, -58], [20, -61], [2, -62], [-16, -62]]), "hat", { sh: [4, -2.5], hi: [-3, 2.5], hiCol: "hat/lt.25" });
      S.line([[-2.5, -64], [-3.2, -68], [-2.4, -71.5]], 2.2, "stem");
      S.leaf(-2.6, -71, 8, -2.5, "leaf"); S.leaf(-2.4, -71.5, 9, -0.6, "leaf");
      S.line([[-34.4, -93.5], [-34.5, -86.5]], 1.2); S.star(-34, -83.5, 3.8, "gold", 1.2);
    }); },
    // the staff along +x (the hand at 0): the shaft 34 back and 33 forward, a leather grip, the gold crescent that cradles the crystal at 40
    staff(S) {
      S.cel(cvCapsule([-34, 0], [34, 0], 2.1, 1.8), "wood", { sh: [0, 1.3], lw: 2 });
      S.rect(-4, -2.4, 9, 4.8, "boot"); S.line([[-2, -2.2], [0, 2.2]], 0.9, "ink"); S.line([[2, -2.2], [4, 2.2]], 0.9, "ink");
      S.cel(cvCirc(-34, 0, 2.6), "gold", { lw: 1.6, sh: 0 });
      S.cel(cvWizArc(41, 0, 7, Math.PI / 2 + 0.45, Math.PI * 1.5 - 0.45, 2.4), "gold", { lw: 1.6, sh: 0 });
      S.cel(cvCirc(34, 0, 2.4), "gold", { lw: 1.6, sh: 0 });
    },
    // the crystal: a long diamond (its long axis along the staff), a darker facet and a light one
    crystal(S) {
      S.cel([[-11.9, 0], [0, -6.3], [11.9, 0], [0, 6.3]], "cry", { lw: 2.2, sh: [2.5, 3.8], shade: "cryD", hi: [-3, -2.5], hiCol: "cryHi" });
      S.line([[-11.9, 0], [11.9, 0]], 0.9, "cryD");
    },
  },
  draw(K) {
    const f = K.f, P = K.P, tk = K.tk, air = !f.grounded && f.state !== "ledge";
    // the hat: the cone lags behind on the run, lifts as he falls (a spring sheared about the brim); the brim squashes on
    // landing and springs back (steps of 0.04, so a held pose of it has a sprite of its own: K.stack)
    const run = clamp((f.vx + f.kbx) * f.facing, -10, 10);
    const sway = K.spring("hat", run * 0.014 + (air ? clamp(f.vy * 0.014, -0.12, 0.16) : 0), 0.16);
    const squash = K.spring("brim", f.state === "land" ? 0.14 : f.state === "jumpsquat" ? 0.08 : 0, 0.3);
    const sw = Math.round(sway * 25) / 25, sq = Math.round(clamp(squash, -0.08, 0.16) * 25) / 25;
    K.arm(false);
    K.rim();
    cvWizSkirt(K);
    // the hat at rest goes into the body's sprite; moving, it is a stack of its own
    const hR = !sw && !sq;
    K.stack(["body", "skin", "robe", "face", hR ? "hat" : null, hR ? "top" : null].filter(Boolean));
    if (!hR) { K.stack(["hat"], (c) => { c.translate(1, -59); c.transform(1, 0, -sw, 1 - sq, 0, 0); c.translate(-1, 59); }, sw + "," + sq); if (K.skinPass) K.skinTop(); }
    cvWizStaff(K);
    K.arm(true, cvWizCuffF);
    K.stack(["stache"]);
  },
});
// a band along an arc as a polygon (the crescent that cradles the crystal)
function cvWizArc(x, y, r, a0, a1, w) {
  const o = [], n = 14;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push([x + Math.cos(a) * (r + w / 2), y + Math.sin(a) * (r + w / 2)]); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; o.push([x + Math.cos(a) * (r - w / 2), y + Math.sin(a) * (r - w / 2)]); }
  return o;
}
// the bell sleeve's lining at the cuff of the near arm (between the sleeve and the hand: K.arm's held), turned with the forearm
function cvWizCuffF(c, K) {
  const A = K.fig.arm, h = K.hF, a = K.pt(A.shF[0], A.shF[1]), e = cvJoint(a, h, A.len, "down"), ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
  c.beginPath(); c.ellipse(h[0], h[1], 2.2, A.r1 - 1.1, ang, 0, CV_TAU); c.fillStyle = K.C.lining; c.fill();
}
// the robe's skirt from under the sash to a gold hem over the boots, spread between the feet (it follows a stride, a kick and a jump),
// two gold stars on it. Live: the ink, the cloth, the back shadow, the hem, the stars and the toes are six fills
function cvWizSkirt(K) {
  const c = K.c, C = K.C, P = K.P, f = K.f;
  const fF = P.fF, fB = P.fB, wl = K.pt(-14.5, -24), wr = K.pt(15, -24);
  const back = fF[0] < fB[0] ? fF : fB, fwd = back === fF ? fB : fF;
  const B = [Math.min(back[0] - 6, wl[0] - 6), back[1] - 1.5], F = [Math.max(fwd[0] + 8, wr[0] + 6.5), fwd[1] - 1.5];
  const M = [(B[0] + F[0]) / 2, Math.max(B[1], F[1]) + (f.grounded ? 0 : 1.5)];
  // the toes of the boots, under the hem
  c.beginPath(); for (const p of [fB, fF]) c.ellipse(p[0] + 3.2, p[1] - 1.8, 6.6, 3.9, 0, 0, CV_TAU); c.fillStyle = CV_INK; c.fill();
  c.beginPath(); for (const p of [fB, fF]) c.ellipse(p[0] + 3.2, p[1] - 2, 5.4, 2.8, 0, 0, CV_TAU); c.fillStyle = C.boot; c.fill();
  // the skirt grown by g (the ink under it, the cloth inside the line)
  const sk = (g) => {
    c.beginPath(); c.moveTo(wl[0] - g, wl[1] - g); c.lineTo(wr[0] + g, wr[1] - g);
    c.quadraticCurveTo(wr[0] + 1 + g, (wr[1] + F[1]) * 0.45, F[0] + g, F[1] + g * 0.6);
    c.quadraticCurveTo(M[0], M[1] + 3 + g, B[0] - g, B[1] + g * 0.6);
    c.quadraticCurveTo(wl[0] - 1 - g, (wl[1] + B[1]) * 0.45, wl[0] - g, wl[1] - g); c.closePath();
  };
  sk(1.3); c.fillStyle = CV_INK; c.fill(); cvMgInk(c);
  sk(-1.2); c.fillStyle = C.robe; c.fill();
  const sh = cvShC(C, "robe"), lerp2p = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  if (sh !== C.robe) {   // the back third in shadow
    const a = lerp2p(wl, wr, 0.3), b = lerp2p(B, F, 0.28);
    c.beginPath(); c.moveTo(wl[0] + 0.2, wl[1] + 1); c.lineTo(a[0], a[1] + 1); c.quadraticCurveTo(a[0] - 1, (a[1] + b[1]) / 2, b[0], b[1] - 1);
    c.lineTo(B[0] + 1.4, B[1] - 0.6); c.quadraticCurveTo(wl[0] + 0.2, (wl[1] + B[1]) * 0.45, wl[0] + 0.2, wl[1] + 1); c.closePath(); c.fillStyle = sh; c.fill();
  }
  // the gold hem: a band along the bottom edge
  c.beginPath(); c.moveTo(B[0] + 0.2, B[1] - 0.6); c.quadraticCurveTo(M[0], M[1] + 1.8, F[0] - 0.2, F[1] - 0.6);
  c.lineTo(F[0] - 1.4, F[1] - 4.2); c.quadraticCurveTo(M[0], M[1] - 1.8, B[0] + 1.6, B[1] - 4.2); c.closePath(); c.fillStyle = C.gold; c.fill();
  // two stars on the cloth (bilinear in the skirt: u across, v down)
  const at = (u, v) => lerp2p(lerp2p(wl, wr, u), lerp2p(B, F, u), v);
  c.beginPath();
  for (const [u, v, r] of [[0.32, 0.45, 2.6], [0.72, 0.62, 2]]) {
    const p = at(u, v);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * CV_TAU - Math.PI / 2, rr = i % 2 ? r * 0.36 : r; if (i) c.lineTo(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr); else c.moveTo(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr); }
    c.closePath();
  }
  c.fillStyle = C.gold; c.fill();
}
// the staff in the front hand (wizardStaff's pose logic: heldDir with the rest angle -PI/2 + 0.12, the tip 40 out, P.cryK, P.staffTip):
// the carved shaft and crescent, the crystal floating over it and turning, a soft glow and a twinkle
function cvWizStaff(K) {
  const c = K.c, P = K.P, f = K.f, tk = K.tk, C = K.C;
  const a = heldDir(f, P, rot(P.sh, P.hip, P.lean), -Math.PI / 2 + 0.12), [hx, hy] = K.hF;
  P.staffTip = [hx + Math.cos(a) * 40, hy + Math.sin(a) * 40];
  if (P.hkHide) return;   // a sweep's first active frame: the ribbon behind and the star at the tip stand in for the staff (HEAVY_LOOK.wizard)
  const fl = 1 + Math.sin(tk * 0.3) * 0.08, gf = fl * P.cryK, cf = fl * (1 + (P.cryK - 1) * 0.5);   // cryK: the crystal flares during heavy wind-ups
  const bob = Math.sin(tk * 0.08 + f.slot) * 1.2, turn = 0.45 + 0.55 * Math.abs(Math.cos(tk * 0.035 + f.slot));
  c.save(); c.translate(hx, hy); c.rotate(a);
  K.draw("staff");
  c.translate(44 + bob, 0);
  if (!K.flash) { c.globalAlpha *= 0.3; c.beginPath(); cvCircAdd(c, 0, 0, 11 * gf); c.fillStyle = C.cryHi; c.fill(); c.globalAlpha /= 0.3; }
  c.save(); c.scale(cf, cf * turn); K.draw("crystal"); c.restore();
  if (!K.flash && (tk + f.slot * 17) % 90 < 30) {   // a twinkle beside the crystal now and then
    const q = ((tk + f.slot * 17) % 90) / 30, r = 3.2 * Math.sin(Math.PI * q);
    c.beginPath(); cvWizStar(c, 7.5, -10, r); cvWizStar(c, -8.5, 7.5, r * 0.6); c.fillStyle = C.cryHi; c.fill();
  }
  c.restore();
}
// a four-point star added to the current path
function cvWizStar(c, x, y, r) {
  for (let i = 0; i < 8; i++) { const a = (i / 8) * CV_TAU - Math.PI / 2, rr = i % 2 ? r * 0.3 : r; if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}
