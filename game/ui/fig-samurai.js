/* ===================== Carved Ink: Samurai (ui/carve.js has the kit and the API) =====================
   A low wedge: wide hakama legs, lacquered plates with jade lacing at the shoulders, the red headband with two tails that snap, the
   sprout tied up as his topknot, level focused eyes and a small scar. The blade lives in its sheath (across his back, the hilt forward
   under his hand) until a move draws it: every attack but a kick has it out (katana(), draw-fighters.js), Iaido and Thousand Cuts hold
   the sheath in the hand (P.sheath). Mockup: redesign/mockups/src/fighters.js NEWF.d.samurai; skins: fx.js skinPal(). */
cvFigReg("samurai", {
  pal: { skin: "#dba862", lac: "#2b2f48", jade: "#2fd39a", red: "#e3453b", hak: "#35467a", steel: "#eaf2f6", gold: "#ecb53a",
    tsuka: "#f3ead2", stem: "#3f7d3a", leaf: "#7fd35c", iris: "#1f9a72" },
  chip: [{}, { jade: "#dfe7f0", hak: "#5c6680", lac: "#3d4358", red: "#3f8fe0" }, { jade: "#ff4a3a", hak: "#5a1c28", lac: "#1f1a24", red: "#f6efe0" },
    { jade: "#b08aff", hak: "#3d2a78", lac: "#2a2148", red: "#ffd23f" }],
  won: { scratch: { jade: "#ff5a36", skin: "#8c4a30", lac: "#241418", hak: "#3a1a1c", red: "#ffb02e" },
    zorp: { jade: "#6cf0c8", skin: "#a9c8a0", lac: "#1f3a36", hak: "#2a5a52", red: "#9dff5a" },
    kraken: { jade: "#3ef2c0", skin: "#b89a62", lac: "#162a36", hak: "#1f4a5a", red: "#ff7a8a" },
    harvest: { jade: "#ffd66b", skin: "#f8cc52", lac: "#5a3a1c", hak: "#8a531e", red: "#fff0b0" } },
  pm: { 1: { jade: "#2fd39a", skin: "#f1e8d2" }, 2: { jade: "#ff3fa4", skin: "#34246a", lac: "#1a1238", hak: "#4a2a8a", red: "#c9a6ff" } },
  prim: "jade",
  derive(C) {
    C.lid = cvSh(C.skin, 0.18); C.scar = cvSh(C.skin, 0.45); C.lacHi = cvMix(C.lac, "#a0a8e0", 0.35); C.lacSh = cvSh(C.lac, 0.4);
    C.hakB = cvSh(C.hak, 0.18); C.redSh = cvSh(C.red, 0.2);
  },
  body: { x: 1, y: -37, rx: 18, ry: 20.5, o: { lean: 0.08 } },
  face: { x: 9.5, y: -42, s: 1, iris: "iris", brow: 0.2, browUp: 0.6, lid: 0.3, lidCol: "lid", mouth: { k: "line", x: 11, y: -33.5, s: 0.9 },
    extra(S) { S.line([[16, -47], [18.5, -38]], 1.1, "scar"); } },
  mouthPt: [12, -33],
  arm: { shF: [3, -31], shB: [-13, -32], len: 19, lenB: 14, bendB: "back", r0: 4.2, r1: 3.8, col: "lac",
    hand: { r: 4.9, col: "skin" }, handB: { r: 4.6, col: "skin", thumb: false } },
  leg: { hipF: [5.5, -23], hipB: [-6, -23], len: 22, draw: (c, K, hip, foot, front) => cvHakama(c, K, hip, foot, front) },
  carve: {
    // the two headband tails, from the knot back
    tails(S) {
      S.cel(cvSm([[-13, -51, 1], [-24, -56], [-34, -52], [-44, -57, 1], [-40, -50, 1], [-32, -47], [-22, -50], [-14, -47, 1]]), "red", { sh: [2, -1.5], lw: 2.2 });
      S.cel(cvSm([[-13, -49, 1], [-22, -46], [-30, -40], [-40, -41, 1], [-37, -35, 1], [-27, -36], [-18, -42], [-12, -45, 1]]), "redSh", { sh: [2, -1.5], lw: 2.2 });
    },
    // the scabbard low on the belt, crossing behind
    sheath(S) {
      S.cel(cvCapsule([12, -22.5], [-36, -10.5], 2.6, 2.2), "lac", { sh: [1, -1.2], lw: 2.2, hi: [0, 1.6], hiCol: "lacHi" });
      S.cel(cvCirc(-35, -10.7, 2.6), "gold", { lw: 1.6, sh: 0 });
    },
    // the potato in the lacquered wrap with jade lacing, the headband and its knot, the topknot (the sprout, tied up)
    body(S) {
      S.cel(cvBlob(1, -37, 18, 20.5, { lean: 0.08 }), "skin", { sh: [8, -5], rim: 1, in() {
        S.rect(-24, -31, 48, 16, "lac"); S.rect(-24, -31, 16, 16, "lacSh");
        S.rect(-24, -27.9, 48, 1.8, "jade"); S.rect(-24, -23.4, 48, 1.8, "jade");
        S.rect(-24, -32, 48, 1.4, "ink");
        S.rect(-24, -53, 48, 5.4, "red"); S.rect(-24, -53, 14, 5.4, "redSh");
        S.rect(-24, -54, 48, 1.3, "ink"); S.rect(-24, -47.8, 48, 1.3, "ink");
      } });
      S.cel(cvCirc(-14.5, -50, 3.4), "red", { sh: [1, -1], lw: 1.8 });
      S.line([[-1, -57], [-2, -62]], 3.2, "stem"); S.rect(-4.6, -61.5, 5.4, 2.4, "red");
      S.leaf(-2, -62, 11, -2.1, "leaf"); S.leaf(-2, -62.5, 12, -1.2, "leaf");
    },
    // the two shoulder plates (sode), big, two lames each with a broad jade lace
    plates(S) {
      for (const [x, y, a, k] of [[-20, -48, 0.8, 1.17], [-7, -47, 0.2, 1.1]]) {
        S.with(x, y, a, k, () => {
          for (let i = 0; i < 2; i++) {
            S.cel([[-7 - i, i * 6], [7 + i, i * 6], [8.5 + i, i * 6 + 7], [-8.5 - i, i * 6 + 7]], "lac", { sh: [2, -1.2], lw: 2 });
            S.rect(-7.5 - i, i * 6 + 4, 15 + 2 * i, 2.3, "jade");
          }
        });
      }
    },
    // the hilt out of the sheath, its wrap and guard (only while the blade is sheathed)
    hilt(S) {
      S.cel(cvCapsule([12, -22.5], [25, -26], 2.4, 2.2), "tsuka", { sh: [1, -1], lw: 2, in() { for (let x = 14; x < 26; x += 3.2) S.line([[x, -27], [x + 2.4, -21.5]], 1.1, "lac"); } });
      S.cel(cvCirc(12.5, -22.7, 2.2, 4.6, 0.26), "gold", { lw: 1.6, sh: 0 });
    },
  },
  draw(K) {
    const f = K.f, P = K.P, tk = K.tk, air = !f.grounded && f.state !== "ledge";
    const out = f.state === "attack" && f.move && f.move.limb !== "leg";   // the blade is drawn
    // at rest the front hand sits on the hilt, low on the belt (under the mouth)
    if (K.rest && !out) K.hF = K.pt(19, -23.5);
    // the tails: they hang at rest, stream back on the run, lift as he falls and snap on a swing (a spring about the knot)
    const run = clamp(Math.abs(f.vx + f.kbx), 0, 12), snap = out && P.hv ? 0.25 : out ? 0.12 : 0;
    const ang = K.spring("tails", -0.42 + run * 0.05 + (air ? clamp(f.vy * 0.06, -0.5, 0.55) : 0) + snap + Math.sin(tk * 0.07 + f.slot) * 0.05, 0.3);
    // (in steps of 0.04, so a held pose of them has a sprite of its own: K.stack; they flutter only on the move)
    const aq = Math.round(ang * 25) / 25, flut = run > 3 || air ? Math.round((1 + 0.12 * Math.sin(tk * 0.45)) * 25) / 25 : 1;
    K.stack(["tails"], (c) => { c.translate(-14, -50); c.rotate(aq); c.scale(1, flut); c.translate(14, 50); }, aq + "," + flut);
    if (!(P.sheath > 0 && out)) K.stack(["sheath"]);
    K.arm(false);
    K.leg(false); K.leg(true);
    K.rim();
    K.stack(["body", "skin", "face", "plates", out ? null : "hilt", "top"]);
    K.arm(true, out && !P.hkHide ? cvSamKatana : null);   // P.hkHide: the smear frame of the side heavy (ui/hk-samurai.js)
  },
});
// the katana in the fist (draw-fighters.js katana(): its pose and its sheath logic; the colours come from this skin)
function cvSamKatana(c, K) {
  const P = K.P;
  cvKatC = K.C;
  try { katana(c, P, K.f, rot(P.sh, P.hip, P.lean), K.f.pal); } finally { cvKatC = null; }
}
// a hakama leg: a wide trouser leg from the hip to the floor, flared, a darker back fold, a sandal on the floor. On the floor the hem lies
// flat and the two legs splay apart (a wedge with a split between the hems, inside the hurtbox but for 3 units a side); a leg off the
// floor (a kick, a jump) hangs straight from the hip, its hem across it (the splay eases in and out: a spring)
function cvHakama(c, K, a, ft, front) {
  const C = K.C, f = K.f, col = front ? C.hak : C.hakB, sh = cvShC(C, front ? "hak" : "hakB"), side = front ? 1 : -1;
  const flat = f.grounded && ft[1] > -2, sp = K.spring(front ? "hakF" : "hakB", flat && f.state !== "run" ? 1 : 0, 0.35);
  const t0 = 7.2, t1 = 8 + (1 - sp) * 1.5, bx = ft[0] + side * (front ? 4.6 : 6.4) * sp, by = ft[1];
  const dx = bx - a[0], dy = by - a[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;   // u: down the leg, n: to its front
  const hx = flat ? 1 : -nx, hy = flat ? 0 : -ny;   // along the hem, to the front
  // the leg's corners (top back, top front, hem front, hem back), and the quad grown by g all round (mitred)
  const Q = [[a[0] + nx * t0, a[1] + ny * t0], [a[0] - nx * t0, a[1] - ny * t0], [bx + hx * t1, by + hy * t1], [bx - hx * t1, by - hy * t1]];
  if ((Q[1][0] - Q[0][0]) * (Q[2][1] - Q[1][1]) - (Q[1][1] - Q[0][1]) * (Q[2][0] - Q[1][0]) < 0) Q.reverse();
  const grow = (g) => {
    const o = [];
    for (let i = 0; i < 4; i++) {
      const p0 = Q[(i + 3) % 4], p1 = Q[i], p2 = Q[(i + 1) % 4];
      let ax = p1[0] - p0[0], ay = p1[1] - p0[1], la = Math.hypot(ax, ay) || 1, bx2 = p2[0] - p1[0], by2 = p2[1] - p1[1], lb = Math.hypot(bx2, by2) || 1;
      const n1 = [ay / la, -ax / la], n2 = [by2 / lb, -bx2 / lb], k = g / Math.max(0.3, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
      o.push([p1[0] + (n1[0] + n2[0]) * k, p1[1] + (n1[1] + n2[1]) * k]);
    }
    c.beginPath(); c.moveTo(o[0][0], o[0][1]); for (let i = 1; i < 4; i++) c.lineTo(o[i][0], o[i][1]); c.closePath();
    return o;
  };
  grow(1.3); c.fillStyle = CV_INK; c.fill(); cvMgInk(c);
  const I = grow(-1.3); c.fillStyle = col; c.fill();
  // the corners of the cloth by name: TB top back, TF top front, HF hem front, HB hem back
  const by0 = (p) => p[0] * hx + p[1] * hy, srt = I.slice().sort((p, q) => (p[0] - a[0]) * ux + (p[1] - a[1]) * uy - ((q[0] - a[0]) * ux + (q[1] - a[1]) * uy));
  const top = srt.slice(0, 2).sort((p, q) => by0(p) - by0(q)), hem = srt.slice(2).sort((p, q) => by0(p) - by0(q));
  const [TB, TF] = top, [HB, HF] = hem, L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  if (sh !== col) {   // the shadow on the back third
    const p = L(TB, TF, 0.36), q = L(HB, HF, 0.3);
    c.beginPath(); c.moveTo(TB[0], TB[1]); c.lineTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.lineTo(HB[0], HB[1]); c.closePath(); c.fillStyle = sh; c.fill();
  }
  // the pleat, and the sandal on the floor edge
  const p0 = L(L(TB, TF, 0.6), L(HB, HF, 0.62), 0.25), p1 = L(L(TB, TF, 0.6), L(HB, HF, 0.62), 0.92);
  c.beginPath(); cvSegAdd(c, p0[0], p0[1], p1[0], p1[1], 1.2); c.fillStyle = cvShC(C, "hakB"); c.fill();
  c.beginPath(); cvSegAdd(c, HB[0] + hx * 0.4 - ux * 0.2, HB[1] + hy * 0.4 - uy * 0.2, HF[0] - hx * 0.4 - ux * 0.2, HF[1] - hy * 0.4 - uy * 0.2, 2.4); c.fillStyle = CV_INK; c.fill();
}
