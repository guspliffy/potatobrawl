/* ===================== Carved Ink: Alchemist (ui/carve.js has the kit and the API) =====================
   A round goblin: the shortest and roundest, hunched under a hood whose tip hooks back, a torn mantle that drags behind, brass goggles
   with lit green lenses for eyes (the kit's eyes behind green glass, so every expression still reads), a toothy grin, two vials on a
   leather bandolier. The flask in his front hand is the special's ready sign (the old greenOrb, draw-fighters.js): it shows, lit and
   bubbling, only while f.specCd <= 0, outside the Ultimate (which holds its own flask) and the Flask smash (P.flask). Mockup:
   redesign/mockups/src/fighters.js NEWF.d.alchemist; skins: fx.js skinPal(). */
const CV_ALC_EYES = [[3.1, -37, 4.5, 5.6], [14.1, -37.3, 3.9, 5.3]];   // the kit's two eyes for face x 8.6, y -37, s 1 (near, far)
cvFigReg("alchemist", {
  pal: { skin: "#e2a352", hood: "#6f42b8", lining: "#2c1a52", brass: "#e0a93f", goo: "#8dff3a", hide: "#5b3a2a", vial: "#ff5aa8",
    leaf: "#9be86a", stem: "#3f7d3a", glass: "#d8f6ff", iris: "#3a2450" },
  chip: [{}, { hood: "#8f1c34", lining: "#ffd9c9", brass: "#f0e6d2", hide: "#2a1218" }, { hood: "#141c44", lining: "#0a0e26", brass: "#c9d6f2", hide: "#c9d6f2" }, { hood: "#e6dfcc", lining: "#3a2f4a", brass: "#6b3fa0", hide: "#3a2f4a" }],
  won: { scratch: { hood: "#5a1436", lining: cvSh("#5a1436", 0.62), skin: "#8c4a30", goo: "#ff7a2b", brass: "#ffb02e" },
    zorp: { hood: "#2a6e5a", lining: cvSh("#2a6e5a", 0.62), skin: "#a9c8a0", goo: "#c6ff5a", brass: "#d6f6e0" },
    kraken: { hood: "#3a2f6e", lining: cvSh("#3a2f6e", 0.62), skin: "#b89a62", goo: "#3ef2c0", brass: "#e6c98a" },
    harvest: { skin: "#f0b41e", hood: "#a8641e", lining: "#5a3210", brass: "#fff3b0", goo: "#fff0a0", hide: "#5a3210", "skin/sh": "#b8761a", "skin/lt": "#fff3b0" } },
  pm: { 1: { hood: "#3a3842", lining: "#1b1a22", goo: "#8dff3a", skin: "#f1e8d2" },
    2: { skin: "#34246a", hood: "#4a2f9a", lining: "#ff6ad5", brass: "#5effc3", goo: "#5effc3", vial: "#ff6ad5", hide: "#1a1238", rim: "#ff6ad5" } },
  prim: "hood",
  derive(C) {
    C.mantle = cvSh(C.hood, 0.22); C.pants = cvSh(C.hood, 0.3); C.hoodLn = cvSh(C.hood, 0.5); C.faceSh = cvSh(C.skin, 0.45);
    C.gooHi = cvLt(C.goo, 0.55); C.lensHi = cvLt(C.goo, 0.75);
  },
  body: { x: 0, y: -28, rx: 21, ry: 20, o: { sq: 0.92 } },
  face: { x: 8.6, y: -37, s: 1, iris: "iris", brow: 0.32, browUp: 2.2, browW: 2.8, lid: 0.18, lidCol: "faceSh", mouth: { k: "grin", x: 10, y: -27.2, s: 1.05 } },
  mouthPt: [11, -26],
  arm: { shF: [14, -18], shB: [-12, -26], len: 20, lenB: 12, bendB: "back", r0: 4.4, r1: 3.8, col: "hood",
    hand: { r: 5, col: "hide" }, handB: { r: 4.6, col: "hide", thumb: false } },
  leg: { hipF: [7.2, -12], hipB: [-6.4, -12], len: 8, bones: 1, r0: 4, r1: 3.6, col: "pants", boot: { s: 0.95, col: "hide" } },
  carve: {
    // the torn mantle, hanging from the back of the hood
    mantle(S) { S.cel(cvSm([[-14, -42, 1], [-26, -30], [-33, -7, 1], [-27, -12], [-23, -3, 1], [-17, -10], [-12, -4, 1], [-6, -18]]), "mantle", { sh: [3, -2] }); },
    // the round potato, the leather bandolier across it with its two vials
    body(S) {
      S.cel(cvBlob(0, -28, 21, 20, { sq: 0.92 }), "skin", { sh: [9, -6], rim: 1, in() {
        S.specks([[-10, -16, 1.3], [-14, -24, 1], [2, -12, 1.1]], "skin/sh.3");
        S.fill(cvBrush([[-24, -24.6], [24, -9.4]], 6.6), "ink"); S.fill(cvBrush([[-24, -24.6], [24, -9.4]], 4.2), "hide");
      } });
      for (const [x, y, col] of [[-6, -17.5, "vial"], [3, -14.5, "goo"]]) {
        S.with(x, y, 0.3, 1, () => { S.cel(cvSm([[-2.4, -4, 1], [2.4, -4, 1], [2.4, 3], [0, 5], [-2.4, 3]]), col, { sh: [1, -1], lw: 1.5 }); S.rect(-2.6, -5.6, 5.2, 2, "hide"); });
      }
    },
    // the hood with its hooked tip, its dark lining round the face, the face in its shadow, the sprout, the goggles' strap and brass rims
    hood(S) {
      S.cel(cvSm([[19, -30, 1], [20, -44], [10, -57], [-6, -60], [-22, -68], [-40, -62, 1], [-30, -58], [-25, -44], [-25, -28], [-21, -20, 1], [-6, -24], [8, -21]]), "hood",
        { sh: [6, -5], rim: 1, hi: [-5, 5] });
      S.line([[-22, -52], [-30, -58], [-36, -61]], 1.4, "hoodLn");
      S.cel(cvBlob(6.5, -34, 15, 14.2), "lining", { sh: 0, lw: 2.2 });
      S.cel(cvBlob(8, -33, 12.5, 12), "skin", { sh: [5, -5], shade: "faceSh", lw: 0 });
      S.line([[1, -56], [0.5, -60.8], [1.5, -63.5]], 2.4, "stem");
      S.leaf(1, -63, 7.7, -2.5, "leaf"); S.leaf(1, -63.5, 8.6, -0.6, "leaf");
      S.line([[-7, -40], [2, -37.5], [20, -38]], 3.2, "hide");
      for (const [x, y, rx, ry] of CV_ALC_EYES.slice().reverse()) S.cel(cvCirc(x, y, rx + 2.6, ry + 2.3), "brass", { sh: [1.5, -1.5], lw: 2 });
    },
    // the lit lenses over the eyes: green glass and a glint
    lens(S) {
      for (const [x, y, rx, ry] of CV_ALC_EYES) {
        const E = cvCirc(x, y, rx + 0.6, ry + 0.6);
        S.add([E], "goo", 1, 0.34);
        S.add([cvClip(cvPos([[x - rx, y - 1], [x + 1, y - ry - 1], [x + 3.5, y - ry - 1], [x - rx, y + 2.5]]), cvPos(E))], "lensHi", 1, 0.75);
      }
    },
    // the flask (the ready sign), its origin the hand: a glow, the round glass, the goo, its meniscus and glint, the cork
    flask(S) {
      S.add([cvCirc(3, -13, 13.5)], "gooHi", 1, 0.3);
      const G = [[0.6, -27], [0.6, -20]];
      for (let i = 0; i <= 28; i++) { const a = -1.9 - (i / 28) * (CV_TAU - 0.65); G.push([3 + Math.cos(a) * 8, -12 + Math.sin(a) * 8]); }
      G.push([5.4, -27]);
      S.cel(G, "glass", { lw: 2, sh: [1.5, -1.2], in() {
        S.rect(-7, -13, 20, 12, "goo"); S.rect(-7, -13, 20, 1.6, "gooHi");
        S.fill(cvCirc(-0.8, -14, 1.4, 3.4, 0.4), "#ffffff");
      } });
      S.cel(cvRect(-0.4, -30, 6.8, 3.4), "hide", { lw: 1.6, sh: 0 });
    },
  },
  draw(K) {
    const f = K.f, P = K.P, tk = K.tk, air = !f.grounded && f.state !== "ledge";
    // the mantle drags: it trails behind on the run and settles late (a spring), lifts when he falls (sheared about the shoulders, in steps
    // of 0.02 and 0.05, so a held pose has a sprite of its own: K.stack)
    const run = clamp((f.vx + f.kbx) * f.facing, -10, 10), calm = clamp(1 - Math.abs(run) / 4, 0, 1);   // (the idle sway stops on the run: one pose)
    const sway = K.spring("mantle", -run * 0.06 + Math.sin(tk * 0.06 + f.slot) * 0.03 * calm + (air ? -0.12 : 0), 0.14);
    const sw = Math.round(sway * 50) / 50, lift = air ? Math.round(clamp(f.vy * 0.03, -0.1, 0.3) * 20) / 20 : 0;
    K.stack(["mantle"], (c) => { c.translate(-14, -42); c.transform(1, 0, sw, 1 - lift, 0, 0); c.translate(14, 42); }, sw + "," + lift);
    // the special is ready: the flask is up in his hand (at rest he holds it high, by his face)
    const ready = f.specCd <= 0 && !K.flash && f.mid !== "ulti" && !P.flask;
    if (ready && K.rest && f.grounded) K.hF = [P.hF[0] - 6, P.hF[1] - 4];
    K.arm(false);
    K.leg(false); K.leg(true);
    K.rim();
    K.stack(["body", "skin", "hood", "face", "lens", "top"]);
    K.arm(true, ready ? cvAlcFlask : null);
  },
});
// the flask in the fist (one small sprite, upright) and its bubbles rising off the cork (live)
function cvAlcFlask(c, K) {
  const [x, y] = K.hF, tk = K.tk;
  c.save(); c.translate(x, y); K.sprite(["flask"]);
  c.beginPath();
  for (let i = 0; i < 3; i++) { const ph = (tk * 0.04 + i / 3) % 1; cvCircAdd(c, 3 + Math.sin(ph * 5 + i * 2) * 2.2, -33 - ph * 14, (1 + 1.2 * Math.sin(ph * Math.PI)) * (i === 1 ? 1.2 : 1)); }
  c.fillStyle = K.C.goo; c.fill();
  c.restore();
}
