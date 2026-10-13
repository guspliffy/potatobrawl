/* ===================== Manga page: Wizard, "Starfall" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Wizard, Starfall"). Times are ms after the final hit.
   300 the freeze (panel 1, engine) goes to NIGHT: the page is washed dark indigo except a lit spot round the hit, white focus lines and stars
   1250 panel 2 "the look": a black night panel. Seven stars flare one by one and join into a potato-shaped constellation (a chime up the scale each,
        "ting" small by three of them); the Wizard raises his staff, lowers it at the loser, the crystal grows 1x to 4x and gold motes spiral in
   2000 inset on the loser's face: terror, gold light growing on it . 2250 the brightest star lets go: the meteor, drawn over the whole page
   2350 panel 3 "the strike": the meteor crawls down toward the loser, the drop at 2780 (the page holds), 2830 the fall, 2900 impact (impact frames,
        star-shaped shock ring, shards, rays, "KRISSH"), the loser turns to crystal and is flung out along the real launch direction, a dotted line of stars stays
   3500 panel 4: the staff comes down, he looks up at the new constellation (the dotted line, stars at its ends), then at the reader; gold snow falls.
   The Wizard keeps the Dragon-page timing (hit 2900, launch 90 ms later). Everything specific to this page is prefixed wiz. */
MANGA.wizard = (function () {
  const COL = "#f2c14e", GOLD = "#ffd978", PALE = "#fff6d8", NIGHT = "#0b0c1c", WHT = "#fffdf4", FACET_INK = "#2a1d12";
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const mxu = (u) => (FIN.dir > 0 ? u : 1 - u);                       // a share of a panel's width, counted from the winner's side
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const mixN = (a, b, k) => a + (b - a) * k;
  const T_STAR0 = 1340, T_GAP = 92, T_DET = 2250, T_DROP = 2780, T_FALL = 2830;
  const BRIGHT = 1;                                                    // the star that lets go
  // the constellation: a potato outline, seven stars (shares of panel 2's width and height, winner's side first)
  const STARS_L = [[0.37, 0.42], [0.43, 0.17], [0.56, 0.09], [0.67, 0.21], [0.71, 0.45], [0.62, 0.64], [0.47, 0.6]];
  const STARS_P = [[0.3, 0.27], [0.4, 0.09], [0.58, 0.04], [0.76, 0.1], [0.88, 0.25], [0.8, 0.38], [0.52, 0.38]];
  let stars = STARS_L, sky = [], motes = [], flakes = [], facets = null, facetS = 0, shards = [], bgDots = [], lay_ = null;

  /* ---- the Wizard's staff and hands in time (used by pose() and to find the crystal) ---- */
  function skel() { const p = W_(), lk = p.spec.look; return { w: p.s.w, leg: p.s.h * lk.leg, tor: p.s.h * lk.torso }; }
  function cast(t) {
    const { w, leg, tor } = skel();
    const up = [w * 0.78, -leg - tor * 1.25], fwd = [w * 0.76, -leg - tor * 1.15], back = [w * 0.36, -leg - tor * 1.12], thrust = [w * 0.98, -leg - tor * 1.0], low = [w * 0.66, -leg - tor * 0.62];
    let ang = -1.25, hF = up, hB = [-w * 0.55, -leg - tor * 1.3], lean = -0.1, cry = 1;
    if (t < 1700) { ang = -1.25 + 0.05 * Math.sin(t * 0.004); cry = 1 + 0.5 * ease(fe(1250, 1700, t)); }
    else if (t < 2900) {
      const e = ease(fe(1700, 2150, t));
      ang = mixN(-1.25, 0.2, e); hF = lerp2(up, fwd, e); lean = mixN(-0.1, 0.08, e); hB = [-w * 0.55, -leg - tor * mixN(1.3, 0.9, e)];
      cry = 1.5 + 2.5 * ease(fe(1700, 2300, t)) + (t > 2300 ? 0.3 * Math.sin(t * 0.012) : 0);
      if (t > T_DROP) { const q = ease(fe(T_DROP, 2900, t)); hF = lerp2(fwd, back, q); lean = mixN(0.08, -0.12, q); }
    } else if (t < 3500) {
      const e = easeOut(fe(2900, 3060, t));
      ang = mixN(0.2, -0.55, e); hF = lerp2(back, thrust, e); lean = mixN(-0.12, 0.22, e); hB = [-w * 0.5, -leg - tor * 0.85];
      cry = mixN(4, 2.2, ease(fe(2900, 3500, t)));
    } else {
      const e = ease(fe(3500, 3850, t)), g = ease(fe(3900, 4150, t));
      ang = mixN(-0.55, -1.3, e); hF = lerp2(thrust, low, e); hB = [-w * 0.5, -leg - tor * 0.7];
      lean = mixN(0.22, -0.16, e); lean = mixN(lean, 0.03, g); cry = mixN(2.2, 1.25, e);
    }
    return { ang, hF, hB, lean, cry };
  }
  // the crystal at the staff's tip, in world units
  function tipW(t) { const p = W_(), c = cast(t); return [p.x + p.facing * (c.hF[0] + Math.cos(c.ang) * 40), p.y + c.hF[1] + Math.sin(c.ang) * 40]; }
  const bodyPt = (p, t, key) => { MG.pt = t; const P = pose(p, mgTk(t)), q = rot(P[key], P.hip, P.lean); return [p.x + p.facing * q[0], p.y + q[1]]; };
  const headL = (t) => bodyPt(L_(), t, "head");
  const U = () => Math.min(L.gw, L.gh) / 390;                          // one unit = a 390 px short side (the meteor's size, in page px)
  const loserPos = (tt) => { if (tt < FIN.launch) return [FIN.lx - (tt >= FIN.hit ? FIN.dir * 5 : 0), 0]; const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr]; };
  const chestW = () => [FIN.lx, -38];

  /* ---- small drawing helpers ---- */
  const ringPoly = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 6.2832) * r, cy + Math.sin((i / n) * 6.2832) * r]);
  // a polygon filled with a dot screen (page css px + the panel's own slide offset), in ink dots or in a colour
  function wizTone(c, poly, size, cover, colr, drift, pn) {
    const pat = mgTile(size, Math.max(0.04, Math.round(cover * 25) / 25), colr), ox = pn ? pn.ox : 0, oy = pn ? pn.oy : 0;   // covers in steps of 4%: every one is a cached tile
    if (drift) mgDrift(pat, drift[0] * DPR, drift[1] * DPR);
    c.save(); c.fillStyle = pat; c.setTransform(1, 0, 0, 1, 0, 0);
    c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo((x + ox) * DPR, (y + oy) * DPR) : c.moveTo((x + ox) * DPR, (y + oy) * DPR))); c.closePath(); c.fill(); c.restore();
  }
  // a four-point star (k: how deep the waist is)
  function wizStar(c, x, y, r, rotA, k) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = rotA - Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * (k || 0.3) : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  // a star with an ink edge: fill, then stroke
  function wizInkStar(c, x, y, r, rotA, fill, lw) {
    wizStar(c, x, y, r, rotA, 0.42); c.fillStyle = fill; c.fill(); c.lineWidth = lw || Math.max(1.1, r * 0.17); c.lineJoin = "miter"; c.strokeStyle = MG_INK; c.stroke();
  }
  // the slab: one flat shape. At night it is black with a pale edge line and a band of dots under it; by day it is ink with tufts of grass
  function wizGround(c, pn, night) {
    pn.world(c);
    const x0 = FIN.wx - 560, x1 = FIN.wx + 560;
    c.fillStyle = night ? NIGHT : MG_INK; c.fillRect(x0, 0, x1 - x0, 140);
    c.beginPath();
    for (let x = x0; x < x1; x += 13) { const h = 3 + ((x * 7919) % 5); c.moveTo(x, 0.5); c.lineTo(x + 2.5, -h); c.lineTo(x + 5.5, 0.5); }
    c.fillStyle = night ? PALE : MG_INK; c.fill();
    if (night) { c.fillStyle = PALE; c.fillRect(x0, 0, x1 - x0, 1.8); }
  }
  // the frame line of a night panel: a paper-white keyline just inside the ink border (ink on ink would vanish against the dark page)
  function wizFrame(c, pn) {
    c.save(); pn.screen(c); mgPoly(c, pn.poly); c.lineWidth = 12; c.lineJoin = "miter"; c.strokeStyle = MG_PAPER; c.stroke(); c.restore();
  }
  // the field of tiny stars of a night panel (seeded, built once): shares of the panel box
  function skyField(c, pn, t, shiftY, v1, a) {
    c.fillStyle = WHT;
    for (const s of sky) {
      if (s.v > v1) continue;
      const tw = 0.55 + 0.45 * Math.sin(t * 0.004 + s.ph), x = pn.x0 + mxu(s.u) * pn.w, y = pn.y0 + s.v * pn.h + shiftY * 0.6;
      c.globalAlpha = a * tw;
      if (s.big) { wizStar(c, x, y, s.r * 2.6, 0, 0.22); c.fill(); } else c.fillRect(x - s.r * 0.5, y - s.r * 0.5, s.r, s.r);
    }
    c.globalAlpha = 1;
  }

  /* ---- the meteor: an ink-outlined diamond with a white core, a long gold tail. Units are whatever the context is set to (here: page css px) ---- */
  function wizMeteor(c, x, y, ang, r, tail, t, a, sil) {
    c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate(ang);
    c.lineJoin = "miter"; c.miterLimit = 3;
    const n = 7, fl = (i) => 1 + 0.16 * Math.sin(t * 0.03 + i * 2.1);
    const edge = (sg) => { const o = []; for (let i = 0; i <= n; i++) { const q = i / n, w = r * 0.95 * Math.pow(1 - q, 0.85) * fl(i) * (i % 2 ? 1.18 : 0.92); o.push([-r * 0.3 - tail * q, sg * w]); } return o; };
    const body = edge(1).concat(edge(-1).reverse());
    c.beginPath(); body.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath();
    if (sil) { c.fillStyle = sil; c.fill(); } else { c.fillStyle = COL; c.fill(); c.lineWidth = Math.max(2, r * 0.17); c.strokeStyle = MG_INK; c.stroke(); }
    if (!sil) {
      const in_ = [], e2 = (sg) => { const o = []; for (let i = 0; i <= n; i++) { const q = i / n; o.push([-r * 0.3 - tail * 0.72 * q, sg * r * 0.34 * Math.pow(1 - q, 0.9) * fl(i + 3)]); } return o; };
      const core = e2(1).concat(e2(-1).reverse()); c.beginPath(); core.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fillStyle = PALE; c.fill();
    }
    // the head: a kite, white, ink edge, facet lines
    c.beginPath(); c.moveTo(r * 1.35, 0); c.lineTo(r * 0.1, -r * 0.74); c.lineTo(-r * 0.8, 0); c.lineTo(r * 0.1, r * 0.74); c.closePath();
    if (sil) { c.fillStyle = sil; c.fill(); } else {
      c.fillStyle = WHT; c.fill(); c.lineWidth = Math.max(2.2, r * 0.2); c.strokeStyle = MG_INK; c.stroke();
      c.beginPath(); c.moveTo(r * 1.35, 0); c.lineTo(-r * 0.8, 0); c.moveTo(r * 0.1, -r * 0.74); c.lineTo(r * 0.1, r * 0.74); c.moveTo(r * 0.1, -r * 0.74); c.lineTo(r * 0.62, 0); c.lineTo(r * 0.1, r * 0.74);
      c.lineWidth = Math.max(1, r * 0.08); c.stroke();
      c.beginPath(); c.moveTo(r * 1.35, 0); c.lineTo(r * 0.1, -r * 0.74); c.lineTo(r * 0.62, 0); c.closePath(); c.fillStyle = COL; c.fill();
    }
    c.restore();
  }
  // where the meteor is (page css px) and which way it points, at page time t
  function meteorState(t) {
    const p2 = MG.byId.look, p3 = MG.byId.strike;
    if (!p2 || !p3) return null;
    const A = [p2.x0 + mxu(stars[BRIGHT][0]) * p2.w, p2.y0 + stars[BRIGHT][1] * p2.h + (-0.06 * p2.h)], B = p3.p(...chestW());
    let s;
    if (t < 2350) s = 0.07 * easeIn(fe(T_DET, 2350, t));
    else if (t < T_FALL) s = 0.07 + 0.2 * (0.5 * fe(2350, T_FALL, t) + 0.5 * easeOut(fe(2350, T_FALL, t)));
    else s = 0.27 + 0.73 * easeIn(fe(T_FALL, FIN.hit, t));
    const x = A[0] + (B[0] - A[0]) * s, y = A[1] + (B[1] - A[1]) * s, ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
    return { x, y, ang, s, A, B };
  }

  // the Wizard's own shading: the engine's two bands cover half of a small figure, so only the thin 70% crescent on the side away from the light is used
  function wizShade(light, cover) {
    return (lc, X) => {
      const R = 40 * X.z, cx = X.sx, cy = X.sy - 33 * X.z, sdx = Math.cos(light + Math.PI), sdy = Math.sin(light + Math.PI), px_ = -sdy, py_ = sdx, B = R * 5, d = 0.5 * R, bx = cx + sdx * d, by = cy + sdy * d;
      lc.fillStyle = mgTile(X.ze >= 2.2 ? 12 : 8, cover || 0.7);
      lc.beginPath(); lc.moveTo(bx + px_ * B, by + py_ * B); lc.lineTo(bx - px_ * B, by - py_ * B); lc.lineTo(bx - px_ * B + sdx * B, by - py_ * B + sdy * B); lc.lineTo(bx + px_ * B + sdx * B, by + py_ * B + sdy * B); lc.closePath(); lc.fill();
    };
  }

  /* ---- panels ---- */
  function panels(lay) {
    const port = lay.port, D = FIN.dir;
    stars = port ? STARS_P : STARS_L;
    return [
      { id: "look", t0: MT.LOOK, from: "w", paper: NIGHT, freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0], [1, 0], [1, 0.37], [0, 0.4]] : [[0, 0], [1, 0], [1, 0.52], [0, 0.57]],
        cam: (t, pn) => { const u = fe(MT.LOOK, MT.STRIKE, t), vh = (port ? 205 : 138) * (1 - 0.05 * u), z = pn.h / vh, vw = pn.w / z; return { wx: FIN.wx + D * (0.5 - (port ? 0.3 : 0.2)) * vw, wy: 8 + 14 * u - vh / 2, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "l", slide: 140, freeze: MT.STRIKE,
        poly: port ? [[0.52, 0.27], [0.98, 0.25], [0.98, 0.46], [0.52, 0.48]] : [[0.71, 0.17], [0.95, 0.13], [0.95, 0.66], [0.69, 0.7]],
        cam: (t) => { const h = headL(Math.min(t, 2350)); return { wx: h[0], wy: h[1], vh: 38 - 4 * fe(MT.INSET, MT.STRIKE, t) }; },
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "t", freeze: MT.AFTER, cover: MT.AFTER,
        poly: port ? [[0, 0.36], [1, 0.32], [1, 0.74], [0, 0.78]] : [[0.38, 0.07], [0.965, 0.02], [0.965, 0.99], [0.47, 0.99]],
        cam: (t, pn) => {
          const k = fe(MT.STRIKE, MT.AFTER, t), vh = (port ? 240 : 265) * (1 - 0.08 * k), z = pn.h / vh;
          const fx = port ? 0.45 : 0.6, sx = MG.page.x + (FIN.dir > 0 ? fx : 1 - fx) * MG.page.w;
          return { wx: FIN.lx - (sx - pn.cx) / z, wy: 24 - vh / 2 - 0.1 * vh * (1 - ease(fe(MT.STRIKE, FIN.hit, t))), vh };
        },
        shake: (t) => { const a = 5 * fe(FIN.hit, FIN.hit + 30, t) * (1 - fe(3100, 3400, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b",
        poly: port ? [[0, 0.7], [1, 0.67], [1, 1], [0, 1]] : [[0, 0.5], [0.5, 0.46], [0.4, 1], [0, 1]],
        cam: (t, pn) => { const u = fe(MT.AFTER, MT.END, t), vh = (port ? 150 : 146) * (1 - 0.06 * u), z = pn.h / vh, vw = pn.w / z; return { wx: FIN.wx + D * (0.5 - (port ? 0.34 : 0.3)) * vw, wy: 10 - vh / 2, vh }; },
        draw: drawAfter },
    ];
  }

  /* ---- panel 2: the look ---- */
  function drawLook(c, pn, t) {
    const W = W_(), power = fe(1650, 2300, t), shiftY = -0.06 * pn.h * fe(MT.LOOK, MT.STRIKE, t);
    pn.screen(c);
    skyField(c, pn, t, shiftY, 1, 0.9);
    const tip = tipW(t), [cx, cy] = pn.p(tip[0], tip[1]);
    // the crystal's light: a screen of white dots in a disc that grows with the power, white focus lines
    if (power > 0) {
      const R = Math.min(pn.h, 211) * (0.22 + 0.34 * power);
      wizTone(c, ringPoly(cx, cy, R, 36), 9, 0.14 + 0.2 * power, PALE, [t * 0.001, 0], pn);
      wizTone(c, ringPoly(cx, cy, R * 0.55, 30), 7, 0.3 + 0.25 * power, PALE, [-t * 0.001, 0], pn);
      mgFocus(c, cx, cy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0004, 0.12 + 0.4 * power, true);
    }
    drawConst(c, pn, t, shiftY);
    wizGround(c, pn, true);
    mgPuppet(c, pn, W, t, { sc: 1, tint: 0.4, tone: false, post: wizShade(dirAng(-0.5)) });
    crystalOver(c, pn, t);
    // gold motes spiral into the crystal
    pn.screen(c);
    for (const m of motes) {
      const k = (t - m.t0) / m.life; if (k < 0 || k > 1) continue;
      const r = m.r0 * Math.pow(1 - ease(k), 1.5) * (pn.h / 205), a = m.a0 + m.sp * k * 6.28, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.72, s = (1.8 + 1.8 * m.s) * (0.6 + 0.6 * (1 - k));
      wizStar(c, x, y, s * 1.9, a, 0.3); c.fillStyle = m.hot ? WHT : GOLD; c.fill();
    }
    wizFrame(c, pn);
  }
  // the staff's crystal swells: hard rings of gold pulse off it and a white glint sits in it
  function crystalOver(c, pn, t) {
    const W = W_(), cs = cast(t), [x, y] = tipW(t), ang = cs.ang;
    pn.world(c);
    const k = cs.cry, pulse = (t * 0.0012);
    for (let j = 0; j < 3; j++) {
      const ph = (pulse + j / 3) % 1, r = (8 + 40 * ph) * (0.6 + 0.3 * k), a = (1 - ph) * Math.min(1, (k - 1) * 0.9);
      if (a <= 0.02) continue;
      c.globalAlpha = a; c.strokeStyle = COL; c.lineWidth = 2.2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
    // the crystal itself: a gem with ink facets, drawn over the staff's own (which is only the glow underneath)
    const cf = 1 + (k - 1) * 0.5;
    wizGem(c, x, y, (FIN.dir > 0 ? ang : Math.PI - ang) + Math.PI / 2, cf * 1.05, t);
    if (k > 1.8) { c.fillStyle = WHT; wizStar(c, x, y, (6 + 5 * (k - 1.8)) * 1.0, 0, 0.22); c.fill(); c.lineWidth = 1.2; c.strokeStyle = MG_INK; c.stroke(); }
  }
  // an elongated gem, point up in its own frame (rotA turns it): facets in pale gold and white, ink between them
  function wizGem(c, x, y, rotA, s, t) {
    const V = [[0, -13], [5.5, -5], [4.5, 4], [0, 8.5], [-4.5, 4], [-5.5, -5]], C = [0, -1], cols = [WHT, PALE, GOLD, "#ffe9a8", PALE, WHT];
    c.save(); c.translate(x, y); c.rotate(rotA); c.scale(s, s); c.lineJoin = "miter";
    for (let i = 0; i < 6; i++) { const a = V[i], b = V[(i + 1) % 6]; c.beginPath(); c.moveTo(C[0], C[1]); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.closePath(); c.fillStyle = cols[(i + ((t / 140) | 0)) % 6]; c.fill(); }
    c.lineWidth = 1.3 / Math.max(0.8, s * 0.6); c.strokeStyle = MG_INK;
    c.beginPath(); V.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.stroke();
    c.lineWidth = 0.8 / Math.max(0.8, s * 0.6); c.beginPath(); V.forEach(([px, py]) => { c.moveTo(C[0], C[1]); c.lineTo(px, py); }); c.stroke();
    c.restore();
  }
  // the constellation: stars flare one by one, lines grow from star to star, the potato closes and fills with a screen of dots
  function drawConst(c, pn, t, shiftY) {
    const n = stars.length, P = stars.map(([u, v]) => [pn.x0 + mxu(u) * pn.w, pn.y0 + v * pn.h + shiftY]);
    const sc = Math.min(pn.h / 205, 1.25), det = t >= T_DET;
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    // the lines
    c.strokeStyle = WHT; c.lineWidth = 2.1 * Math.max(0.8, sc);
    for (let i = 1; i <= n; i++) {
      const a = P[i - 1], b = P[i % n], t0 = T_STAR0 + (i - 1) * T_GAP + 40, k = fe(t0, t0 + T_GAP * 1.05, t);
      if (k <= 0) continue;
      if (det && (i - 1 === BRIGHT || i % n === BRIGHT)) { c.globalAlpha = 0.35; }
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); c.stroke(); c.globalAlpha = 1;
    }
    // the potato fills with dots once it has closed
    const fill = fe(T_STAR0 + n * T_GAP + 60, 2250, t);
    if (fill > 0) wizTone(c, P, 7, 0.1 + 0.13 * fill, PALE, [t * 0.0006, t * 0.0004], pn);
    // the stars
    for (let i = 0; i < n; i++) {
      const t0 = T_STAR0 + i * T_GAP, k = fe(t0, t0 + 200, t); if (k <= 0) continue;
      if (det && i === BRIGHT) continue;
      const big = i === BRIGHT ? 1.45 : 1, r = (6 + 5.5 * (1 - k) + 1.2 * Math.sin(t * 0.005 + i)) * big * Math.max(0.85, sc), x = P[i][0], y = P[i][1];
      if (k < 1) {   // the flare: a burst of rays and a ring
        c.strokeStyle = GOLD; c.lineWidth = 1.6; c.globalAlpha = 1 - k; c.beginPath();
        for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4 + 0.2, r0 = r * 1.1, r1 = r * (2.4 + 2.6 * easeOut(k)); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
        c.stroke(); c.globalAlpha = 1;
      }
      c.beginPath(); c.arc(x, y, r * 1.55, 0, Math.PI * 2); c.strokeStyle = GOLD; c.lineWidth = 1.5; c.stroke();
      wizStar(c, x, y, r * 1.5, 0, 0.3); c.fillStyle = WHT; c.fill();
    }
    c.restore();
  }

  /* ---- the inset: the loser looks up, gold light grows on its face ---- */
  function drawInset(c, pn, t) {
    const Lp = L_(), tt = Math.min(t, 2350), lit = fe(MT.INSET, MT.STRIKE, t);
    pn.screen(c);
    const [fx, fy] = pn.p(...headL(tt));
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0005, 0.7);
    // the gold light comes from above (the meteor): hard bands of screen and accent, growing down the panel
    const edge = pn.y0 + pn.h * (0.1 + 0.95 * lit), sl = pn.w * 0.28 * (FIN.dir > 0 ? 1 : -1), lp = [[pn.x0 - 12, pn.y0 - 12], [pn.x1 + 12, pn.y0 - 12], [pn.x1 + 12, edge - sl], [pn.x0 - 12, edge + sl]];
    c.save(); c.globalAlpha = 0.6 * lit; c.fillStyle = COL; mgPoly(c, lp); c.fill(); c.restore();
    wizTone(c, lp.map(([x, y]) => [x, y + (y > pn.y0 ? pn.h * 0.16 : 0)]), 6, 0.3 * lit, MG_INK, [t * 0.001, 0], pn);
    mgPuppet(c, pn, Lp, tt, { sc: 1, light: dirAng(-2.1), tint: 0.5, post: (lc, X) => {
      lc.fillStyle = rgba(COL, 0.34 * lit); lc.fillRect(0, 0, MG.cw, MG.ch);
      const hx = X.sx, hy = X.sy - 40 * X.z;
      for (const [r, a] of [[1.2, 0.2], [0.8, 0.3], [0.45, 0.4]]) { lc.fillStyle = rgba(PALE, a * lit); lc.beginPath(); lc.ellipse(hx - FIN.dir * 8 * X.z, hy - 14 * X.z, r * 22 * X.z, r * 17 * X.z, 0, 0, Math.PI * 2); lc.fill(); }
    } });
  }

  /* ---- panel 3: the strike ---- */
  function strikeSky(c, pn, t, dark) {
    // the night sky above: black, then a 70% screen, 40%, 18%; the bands slope a little and creep down at the drop
    const x0 = pn.x0 - 6, x1 = pn.x1 + 6, y0 = pn.y0 - 6, h = pn.h, sl = pn.w * 0.04 * (FIN.dir > 0 ? 1 : -1), up = 1 + 0.5 * dark;
    const band = (f) => { const y = y0 + h * f; return [[x0, y - sl], [x1, y + sl], [x1, y + sl * 0.2], [x0, y - sl * 0.2]]; };
    const edges = [0.2 * up, 0.31 * up, 0.42 * up, 0.53 * up];
    const poly = (a, b) => [[x0, y0 + h * a - sl], [x1, y0 + h * a + sl], [x1, y0 + h * b + sl], [x0, y0 + h * b - sl]];
    c.fillStyle = NIGHT; mgPoly(c, poly(-0.05, edges[0])); c.fill();
    wizTone(c, poly(edges[0], edges[1]), 6, 0.62, MG_INK, [t * 0.001, 0], pn);
    wizTone(c, poly(edges[1], edges[2]), 6, 0.4, MG_INK, [-t * 0.001, 0], pn);
    wizTone(c, poly(edges[2], edges[3]), 7, 0.18, MG_INK, [t * 0.0008, 0], pn);
    return edges;
  }
  function drawStrike(c, pn, t) {
    const W = W_(), Lp = L_(), H0 = FIN.hit, dark = fe(T_DROP, H0, t), ms = meteorState(t);
    pn.screen(c);
    const edges = strikeSky(c, pn, t, dark);
    skyField(c, pn, t, 0, edges[0] - 0.02, 0.95);
    // the constellation, small, high in the sky, one star short
    drawConstSmall(c, pn, t);
    // the page shakes in focus lines from the impact: white on the sky, ink below
    const hp = pn.p(...chestW());
    if (t >= H0) mgFocus(c, hp[0], hp[1], Math.hypot(pn.w, pn.h), t * 0.0006, 0.75 * (1 - 0.35 * fe(H0, 3300, t)));
    else if (t >= T_DROP) { const hd = pn.p(...headL(t)); mgFocus(c, hd[0], hd[1], pn.h * 0.8, t * 0.0004, 0.9 * easeOut(fe(T_DROP, T_DROP + 70, t))); }
    wizGround(c, pn, false);
    pn.world(c);
    if (!MG.broke) { S_.drawLoser(c, pn, t); drawFear(c, pn, t); }
    pn.world(c);
    drawBlast(c, pn, t);
    drawDotted(c, pn, t);
  }
  // the constellation again, where panel 2 had it (the stars belong to the page), one star short: the meteor is out of it
  // manga fear: three vertical lines over the forehead and sweat drops flicked off the head
  function drawFear(c, pn, t) {
    if (t < 2400 || t >= FIN.hit + 60) return;
    const h = headL(Math.min(t, FIN.hit)), D = FIN.dir, k = fe(2400, 2520, t), q = t * 0.02;
    c.save(); pn.world(c); c.lineCap = "round"; c.strokeStyle = MG_INK; c.lineWidth = 2.4;
    c.beginPath();
    for (let i = -1; i <= 1; i++) { const x = h[0] + i * 7 + Math.sin(q + i) * 0.6, y0 = h[1] - 24 - (i === 0 ? 3 : 0), len = (11 + (i === 0 ? 4 : 0)) * k; c.moveTo(x, y0); c.lineTo(x, y0 - len); }
    c.stroke();
    for (let j = 0; j < 3; j++) {
      const ph = ((t - 2430 - j * 150) % 470) / 470; if (ph < 0 || t < 2430 + j * 150) continue;
      const x = h[0] + D * (14 + 26 * ph) , y = h[1] - 18 - 22 * ph + 46 * ph * ph, r = 4.4 * (1 - 0.3 * ph);
      c.save(); c.translate(x, y); c.rotate(D * (0.5 + ph * 1.1));
      c.beginPath(); c.moveTo(0, -r * 1.9); c.quadraticCurveTo(r * 1.1, -r * 0.2, r, r * 0.4); c.arc(0, r * 0.4, r, 0, Math.PI, false); c.quadraticCurveTo(-r * 1.1, -r * 0.2, 0, -r * 1.9); c.closePath();
      c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.5; c.stroke(); c.restore();
    }
    c.restore();
  }
  function drawConstSmall(c, pn, t) {
    const p2 = MG.byId.look, P = stars.map(([u, v]) => [p2.x0 + mxu(u) * p2.w, p2.y0 + v * p2.h - 0.06 * p2.h]);
    c.save(); c.strokeStyle = WHT; c.lineWidth = 1.9; c.lineJoin = "round"; c.lineCap = "round"; c.beginPath();
    for (let i = 0; i < P.length; i++) { if (i === BRIGHT || (i + 1) % P.length === BRIGHT) continue; const q = P[(i + 1) % P.length]; c.moveTo(P[i][0], P[i][1]); c.lineTo(q[0], q[1]); }
    c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1;
    for (let i = 0; i < P.length; i++) { if (i === BRIGHT) continue; c.beginPath(); c.arc(P[i][0], P[i][1], 9, 0, 6.2832); c.strokeStyle = GOLD; c.lineWidth = 1.4; c.stroke(); wizStar(c, P[i][0], P[i][1], 8 + Math.sin(t * 0.004 + i), 0, 0.3); c.fillStyle = WHT; c.fill(); }
    c.restore();
  }
  // the blast: the star-shaped shock ring, rays, shards
  function drawBlast(c, pn, t) {
    const H0 = FIN.hit, u = t - H0; if (u < 0 || u > 700) return;
    const [x, y] = chestW();
    // shock ring: a ring between two twelve-point stars
    const k = fe(0, 190, u), R = 18 + 150 * easeOut(k), a = 1 - fe(60, 320, u);
    if (a > 0.02) {
      const star = (r) => { c.moveTo(x + r, y); for (let i = 1; i < 24; i++) { const an = (i / 24) * 6.2832, rr = i % 2 ? r * 0.64 : r; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } c.closePath(); };
      c.save(); c.globalAlpha = a; c.beginPath(); star(R); star(R * 0.74); c.fillStyle = WHT; c.fill("evenodd"); c.lineWidth = 2.6; c.lineJoin = "miter"; c.strokeStyle = MG_INK; c.stroke(); c.restore();
    }
    // facet shards
    c.save(); c.lineJoin = "miter";
    for (const s of shards) {
      const e = 1 - Math.exp(-u / 120), d = s.v * 150 * e, al = 1 - fe(260, 620, u); if (al <= 0.02) continue;
      const px = x + Math.cos(s.a) * d, py = y + Math.sin(s.a) * d + 22 * Math.pow(u / 600, 2), r = s.r * (1 - 0.4 * fe(0, 600, u));
      c.globalAlpha = al; c.save(); c.translate(px, py); c.rotate(s.rot + u * s.spin);
      c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(-r * 0.6, r * 0.7); c.lineTo(-r * 0.3, -r * 0.6); c.closePath(); c.fillStyle = s.c; c.fill(); c.lineWidth = 1.8; c.strokeStyle = MG_INK; c.stroke(); c.restore();
    }
    c.restore();
  }
  // the dotted line of stars the loser leaves along its path (stays on the page)
  const DOT_N = 10, DOT_GAP = 36;
  function drawDotted(c, pn, t) {
    if (t < FIN.launch) return;
    const tr = finTrav((t - FIN.launch) / FMS), [x0, y0] = chestW();
    c.save();
    for (let i = 1; i <= DOT_N; i++) {
      const d = i * DOT_GAP; if (tr < d) break;
      const tt = FIN.launch + 16.667 * (Math.sqrt(289 + 2.4 * d) - 17) / 1.2, age = t - tt, pop = 1 + 0.9 * (1 - fe(0, 110, age));
      wizInkStar(c, x0 + FIN.ldx * d, y0 + FIN.ldy * d, (i === DOT_N ? 13 : 8.6) * pop, i * 0.4, i % 3 ? GOLD : WHT, 1.3);
    }
    c.restore();
  }

  /* ---- the loser: stands looking up, turns to crystal at the hit, is flung as a gem with sparkles streaming ---- */
  function facetPattern(v) {
    const S = facetS, n = 3, cs = S / n, r = mgRng(88 + v * 1013), tc = mgCanvas(S, S), x = tc.getContext("2d");
    const J = []; for (let i = 0; i < n; i++) { J.push([]); for (let j = 0; j < n; j++) J[i].push([(r() - 0.5) * cs * 0.55, (r() - 0.5) * cs * 0.55]); }
    const rr = mgRng(404);   // the geometry is the same in every variant, the colours are not
    const cols = [PALE, WHT, "#ffe9a8", GOLD, "#f6cf6a", WHT, "#fff0b8", PALE];
    const pt = (i, j) => { const a = ((i % n) + n) % n, b = ((j % n) + n) % n; return [i * cs + J[a][b][0], j * cs + J[a][b][1]]; };
    x.lineJoin = "miter"; x.lineWidth = Math.max(1, 1.1 * DPR); x.strokeStyle = FACET_INK;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c_ = pt(i + 1, j + 1), d = pt(i, j + 1), flip = (i + j) % 2;
      const tris = flip ? [[a, b, d], [b, c_, d]] : [[a, b, c_], [a, c_, d]];
      for (const tri of tris) { const ci = ((rr() * 8) | 0), shift = (ci + v * 3) % 8; x.beginPath(); tri.forEach(([px, py], q) => (q ? x.lineTo(px + ox, py + oy) : x.moveTo(px + ox, py + oy))); x.closePath(); x.fillStyle = cols[shift]; x.fill(); x.stroke(); }
    }
    return ctx.createPattern(tc, "repeat");
  }
  function crystalPost(t, alpha) {
    return (lc, X) => {
      if (!facets) return;
      const q = (t / 46) | 0, pat = facets[q % 3];
      if (pat.setTransform) { try { pat.setTransform(new DOMMatrix([1, 0, 0, 1, X.sx + ((q * 29) % facetS), X.sy + ((q * 17) % facetS)])); } catch (e) { /* no pattern transforms */ } }
      lc.save(); lc.globalAlpha = alpha; lc.fillStyle = pat; lc.fillRect(0, 0, MG.cw, MG.ch); lc.restore();
    };
  }
  function drawLoserFn(c, pn, t) {
    const Lp = L_(), H0 = FIN.hit;
    const gone = FIN.out || Lp.state === "gone";
    c.save(); pn.world(c);
    if (!gone) {
      const cr = t >= H0, fl = t >= FIN.launch, light = dirAng(-2.1);
      if (cr) {
        // the gem's ink rim: a black silhouette a hair bigger, about the body's middle
        const ox = Lp.x, oy = Lp.y, sc = 1.07; Lp.y = oy + (sc - 1) * Lp.s.h * 0.5;
        mgPuppet(c, pn, Lp, t, { sc, sil: MG_INK });
        Lp.y = oy; Lp.x = ox;
      }
      if (fl && !MG.slow) for (const dt of [66, 44, 22]) {   // three ghosts
        const [gx, gy] = loserPos(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
        mgPuppet(c, pn, Lp, t - dt, { sc: 1, a: 0.26 - dt * 0.0025, light, post: crystalPost(t - dt, 0.9), tone: false, tint: 0.3 });
        Lp.x = ox; Lp.y = oy;
      }
      mgPuppet(c, pn, Lp, t, { sc: 1, light, tint: cr ? 0.3 : 0.56, flash: Lp.flash > 0, post: cr ? crystalPost(t, 0.86) : null });
      // glints on the facets
      if (cr && t < FIN.launch + 900) {
        const r = mgRng(((t / 60) | 0) * 7 + 3), [px, py] = [Lp.x, Lp.y - Lp.s.h * 0.5]; pn.world(c);
        for (let i = 0; i < 3; i++) wizInkStar(c, px + (r() - 0.5) * 34, py + (r() - 0.5) * 40, 3.5 + r() * 4.5, r() * 0.8, WHT, 1.4);
      }
    }
    // sparkles streaming behind the gem
    pn.world(c);
    for (let j = 1; j <= 15; j++) {
      const age = j * 24, tt = t - age; if (tt < FIN.launch || age > 400) continue;
      const [px, py] = loserPos(tt), q = mgRng(j * 31 + 7), a = 1 - age / 400;
      c.globalAlpha = Math.min(1, a * 1.6); wizInkStar(c, px + (q() - 0.5) * 26, py - Lp.s.h * 0.5 + (q() - 0.5) * 26, (3 + q() * 4) * (0.5 + a * 0.5), j, j % 3 ? GOLD : WHT, 1.4);
    }
    c.globalAlpha = 1; c.restore();
  }

  /* ---- panel 4: the aftermath ---- */
  function drawAfter(c, pn, t) {
    const W = W_(), u = fe(MT.AFTER, MT.END, t), D = FIN.dir;
    pn.screen(c);
    // a window of night sky in the upper corner: the dotted line of stars, a star at each end
    const win = [[0.5, 0], [1.02, 0], [1.02, 0.78], [0.66, 0.56]].map(([a, b]) => [pn.x0 + mxu(a) * pn.w, pn.y0 + b * pn.h]);
    c.fillStyle = NIGHT; mgPoly(c, win); c.fill();
    c.save(); mgPoly(c, win); c.clip();
    c.fillStyle = WHT;
    for (const s of bgDots) { const x = pn.x0 + mxu(0.5 + s.u * 0.52) * pn.w, y = pn.y0 + s.v * 0.78 * pn.h; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.004 + s.ph); c.fillRect(x, y, s.r, s.r); }
    c.globalAlpha = 1;
    const cxw = (win[0][0] + win[1][0]) / 2 + mxu(0.5) * 0 + (win[2][0] - win[0][0]) * 0, cy = pn.y0 + pn.h * 0.31, ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.min(pn.w * 0.34, pn.h * 0.7);
    const mx_ = pn.x0 + mxu(0.76) * pn.w, a0 = [mx_ - Math.cos(ang) * len * 0.5, cy - Math.sin(ang) * len * 0.5], a1 = [mx_ + Math.cos(ang) * len * 0.5, cy + Math.sin(ang) * len * 0.5];
    const born = fe(MT.AFTER + 90, MT.AFTER + 700, t);
    for (let i = 1; i < 9; i++) { const q = i / 9; if (q > born) break; const x = a0[0] + (a1[0] - a0[0]) * q, y = a0[1] + (a1[1] - a0[1]) * q; wizStar(c, x, y, 5, i * 0.5, 0.3); c.fillStyle = PALE; c.fill(); }
    for (const [e, i] of [[a0, 0], [a1, 1]]) {
      const k = fe(MT.AFTER + 90 + i * 560, MT.AFTER + 330 + i * 560, t); if (k <= 0) continue;
      c.beginPath(); c.arc(e[0], e[1], 19 * k, 0, 7); c.strokeStyle = GOLD; c.lineWidth = 1.6; c.stroke();
      wizStar(c, e[0], e[1], (14 + 1.5 * Math.sin(t * 0.005 + i)) * (0.5 + 0.5 * k), 0, 0.28); c.fillStyle = WHT; c.fill();
    }
    c.restore();
    c.save(); mgPoly(c, win); c.lineWidth = 3; c.strokeStyle = MG_INK; c.stroke(); c.restore();
    wizGround(c, pn, false);
    mgPuppet(c, pn, W, t, { sc: 1, tint: 0.5, tone: false, post: wizShade(dirAng(-0.8)) });
    crystalOver(c, pn, t);
    // "...": three dots by his head, popping in one by one; the page is quiet
    pn.screen(c);
    const hd = pn.p(...bodyPt(W, t, "head"));
    for (let i = 0; i < 3; i++) {
      const k = fe(3760 + i * 130, 3760 + i * 130 + 120, t), a = k * (1 - fe(4250, 4400, t)); if (a <= 0.02) continue;
      const x = hd[0] + D * (pn.h * 0.3 + i * pn.h * 0.09), y = hd[1] - pn.h * 0.5 - (i === 1 ? 3 : 0) + (1 - k) * 6;
      c.globalAlpha = a; c.beginPath(); c.arc(x, y, pn.h * 0.034 * (0.6 + 0.4 * k), 0, 6.2832); c.fillStyle = WHT; c.fill(); c.lineWidth = 2.4; c.strokeStyle = MG_INK; c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "Starfall", hit: 2900, flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "ZING" : heavy ? "DOOM" : "KRAK", D = FIN.dir;
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike, P4 = () => MG.byId.after;
      const star = (i, t) => { const p = P2(); return [p.x0 + mxu(stars[i][0]) * p.w + p.ox, p.y0 + stars[i][1] * p.h + p.oy - 0.06 * p.h * fe(MT.LOOK, MT.STRIKE, t)]; };
      const ting = (i) => ({ text: "ting", t0: T_STAR0 + i * T_GAP + 40, t1: T_STAR0 + i * T_GAP + 560, size: 0.055, jit: 0.3, rot: (i % 2 ? 0.14 : -0.16), at: (t) => { const s = star(i, t); return [s[0] + D * 20, s[1] - 16]; } });
      const mul = lay.port ? 0.5 : 1;
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.22, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        ting(0), ting(3), ting(5),
        { text: "VWOOOM", t0: T_DET, t1: FIN.hit + 40, size: 0.115, arc: 9, rot: 1.05 * D, stretch: { ang: 1.05 * D, k: 0.45 },
          at: (t) => { const m = meteorState(t); return m ? [m.x - D * 95, m.y + 80] : [L.gw / 2, L.gh / 2]; } },
        { text: "KRISSH", t0: FIN.hit, t1: 3560, size: 0.2, arc: 8, jag: 0.1, rot: -0.07 * D, at: () => { const p = P3(); return [p.x0 + mxu(0.2) * p.w + p.ox, p.y0 + p.h * 0.36 + p.oy]; } },
      ].map((w) => Object.assign(w, { mul }));
    },
    build(lay) {
      lay_ = lay;
      const r = mgRng(2026), g = L.gw, h = L.gh;
      sky = Array.from({ length: lay.port ? 46 : 64 }, () => ({ u: r(), v: r(), r: 1 + r() * 1.5, ph: r() * 6.28, big: r() < 0.14 }));
      bgDots = Array.from({ length: 22 }, () => ({ u: r(), v: r(), r: 1.4 + r() * 1.4, ph: r() * 6.28 }));
      motes = Array.from({ length: MG.slow ? 18 : 34 }, (_, i) => ({ t0: 1650 + (i / 34) * 560, life: 520 + r() * 280, a0: r() * 6.28, r0: 70 + r() * 100, sp: (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.5), s: r(), hot: r() < 0.3 }));
      flakes = Array.from({ length: 46 }, () => ({ x: r() * g, y: r() * h, v: 12 + r() * 20, s: 1.2 + r() * 2, ph: r() * 6.28 }));
      shards = Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * 6.2832 + (r() - 0.5) * 0.2, v: 0.5 + r() * 0.9, r: 4 + r() * 6, rot: r() * 6.28, spin: (r() - 0.5) * 0.02, c: i % 3 ? GOLD : WHT }));
      facetS = Math.max(48, Math.round(57 * DPR));
      facets = [facetPattern(0), facetPattern(1), facetPattern(2)];
      // panel 1 (the engine's frozen hit) goes to night: dark indigo with a lit spot round the hit, white focus lines, stars
      const p1 = MG.panels[0], orig = p1.d.draw;
      p1.d.draw = function (c, pn, t) { orig(c, pn, t); wizNight(c, t); };
    },
    step(t) { if (t > 4650 && facets) { facets = null; } },
    // gold snow across the whole page after the strike; the gem's speed lines run along its path
    over(o, t) {
      const ms = meteorState(t), H0 = FIN.hit;
      if (ms && t >= T_DET && t < H0) {
        const fall = fe(T_FALL, H0, t), tail = (110 + 130 * easeOut(fe(T_DET, 2900, t)) + 170 * fall) * U(), rr = U() * (19 + 7 * fe(2350, T_FALL, t) + 5 * fall);
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        if (fall > 0 && !MG.reduced) for (const dt of [26, 14]) { const q = meteorState(t - dt); if (q) wizMeteor(o, q.x, q.y, q.ang, rr * 0.9, tail * 0.6, t, 0.3); }
        if (fall > 0) mgSpeed(o, ms.x - Math.cos(ms.ang) * L.gh * 0.3, ms.y - Math.sin(ms.ang) * L.gh * 0.3, L.gh * 0.9, L.gh * 0.28, ms.ang, -(t - T_FALL) * 3, 0.55, true, 1);
        wizMeteor(o, ms.x, ms.y, ms.ang, rr, tail, t, 1);
        o.restore();
      }
      if (t > this.hit + 80 && t < this.hit + 600 + 400) {
        const Lp = L_(), pn = MG.byId.strike, u = t - FIN.launch, a = (1 - fe(FIN.launch + 150, FIN.launch + 420, t)) * fe(FIN.launch - 40, FIN.launch + 40, t);
        if (a > 0.01) {
          const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
          o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
          mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - FIN.launch) * 1.4, 0.7 * a, false, 1);
          o.restore();
        }
      }
      if (t > 3500 && t < MT.FADE + 100) {
        const a = fe(3500, 3800, t) * (1 - fe(4200, 4500, t)), u = (t - 3500) / 1000;
        o.save(); o.globalAlpha = a;
        for (const d of flakes) {
          const y = ((d.y + d.v * u) % L.gh + L.gh) % L.gh, x = d.x + Math.sin(u * 1.4 + d.ph) * 12;
          o.fillStyle = GOLD; o.strokeStyle = MG_INK; o.lineWidth = 0.8; wizStar(o, x, y, d.s * 2.2, u * 0.6 + d.ph, 0.42); o.fill(); o.stroke();
        }
        o.restore();
      }
    },
    drawLoser: drawLoserFn,
    hitPt() { return chestW(); },
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_();
      mgPuppet(o, pn, W, FIN.hit + 10, { sc: 1, sil });
      mgPuppet(o, pn, Lp, FIN.hit + 10, { sc: 1, sil });
      // the meteor's last stretch, as a flat shape, and the star-shaped ring
      const ms = meteorState(FIN.hit - 4);
      if (ms) wizMeteor(o, ms.x, ms.y, ms.ang, U() * 26, U() * 230, t, 1, sil);
      const [x, y] = chestW(); o.save(); pn.world(o); o.fillStyle = sil; const R = 42 + (t - FIN.hit) * 1.4;
      o.beginPath(); for (let i = 0; i < 24; i++) { const an = (i / 24) * 6.2832, rr = i % 2 ? R * 0.6 : R; i ? o.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr) : o.moveTo(x + rr, y); } o.closePath(); o.fill(); o.restore();
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, H0 = FIN.hit;
      if (role === "w") {
        const cs = cast(t);
        P.holdAng = cs.ang; P.cryK = cs.cry; P.lean = cs.lean; P.mouth = t >= 2780 && t < 3300 ? 0.5 : 0;
        P.expr = t < 1700 ? "calm" : t >= 3950 ? "grin" : undefined; P.exK = 1;
        if (t >= 3500) P.crouch = 0;
        return { hF: cs.hF, hB: cs.hB };
      }
      // the loser
      const fly = t >= FIN.launch;
      P.expr = fly ? "ko" : "terror"; P.exK = fe(1900, 2350, t);
      if (!fly) {
        P.lean = -0.14 + Math.sin(t * 0.03) * 0.035 * fe(2000, 2400, t); P.mouth = t >= H0 ? 1 : 0.35 * fe(2000, 2350, t) + 0.25;
        return { hF: [w * 0.62, -leg - tor * 1.2], hB: [-w * 0.5, -leg - tor * 1.15] };
      }
      P.lean = -0.5; P.mouth = 1; P.spin = ((t - FIN.launch) / FMS) * 0.3;
      return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
    },
    cues(t) {
      const notes = [523, 587, 659, 784, 880, 1047, 1175];
      notes.forEach((f, i) => cueOnce("star" + i, T_STAR0 + i * T_GAP, () => Cin.go(() => Cin.chime(f))));
      cueOnce("shim", 1700, () => Cin.go(() => { Cin.shimmer(660, 1.3); Cin.riser(0.65, 0.1); }));
      cueOnce("pluck", 2000, () => Cin.go(() => Cin.pluck(1480)));
      cueOnce("flute", 2050, () => Cin.go(() => Cin.flute(0.7)));
      cueOnce("det", T_DET, () => Cin.go(() => { Cin.whoosh(0.5, -0.5, 0.7, 0.35); Cin.sub(90, 150, 0.5, 0.25); }));
      cueOnce("blast", FIN.hit, () => Cin.go(() => { Cin.stab(440, 0.8); Cin.shimmer(1320, 1.5); Cin.glass(); }));
      cueOnce("fling", FIN.launch, () => Cin.go(() => Cin.whoosh(0.35, -0.9, 0.9, 0.5)));
      cueOnce("dots", 3250, () => Cin.go(() => Cin.chime(1568)));
      cueOnce("flute2", 3600, () => Cin.go(() => Cin.flute(0.8)));
      cueOnce("chime", 3980, () => Cin.go(() => Cin.chime(880)));
    },
  };
  // the frozen hit turns to night
  function wizNight(c, t) {
    const k = easeOut(fe(MT.FREEZE + 40, 820, t));
    if (k <= 0.01) return;
    const gw = L.gw, gh = L.gh, ix = MG.ix, iy = MG.iy, R0 = Math.hypot(gw, gh), R1 = Math.min(gw, gh) * 0.4, R = R0 + (R1 - R0) * k;
    c.save();
    c.beginPath(); c.rect(0, 0, gw, gh); c.arc(ix, iy, R, 0, Math.PI * 2);
    c.fillStyle = "rgba(11,12,28," + (0.92 * Math.min(1, k * 1.4)).toFixed(3) + ")"; c.fill("evenodd");
    c.clip("evenodd");
    mgFocus(c, ix, iy, R0, t * 0.00035, 0.55 * k, true);
    c.fillStyle = WHT;
    for (const s of sky) { const x = s.u * gw, y = s.v * gh; c.globalAlpha = k * (0.5 + 0.5 * Math.sin(t * 0.004 + s.ph)); if (s.big) { wizStar(c, x, y, s.r * 2.8, 0, 0.22); c.fill(); } else c.fillRect(x, y, s.r, s.r); }
    c.globalAlpha = 1; c.restore();
    // the spot's edge: a screen of dots just outside it and a paper-white ring
    if (R < R0 * 0.9) {
      c.save(); c.beginPath(); c.arc(ix, iy, R + 20, 0, 6.2832); c.arc(ix, iy, R, 0, 6.2832); c.clip("evenodd");
      c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(7, Math.max(0.08, Math.round(0.5 * k * 25) / 25), PALE); c.fillRect(0, 0, MG.cw, MG.ch); c.restore();
      c.save(); c.lineWidth = 3; c.strokeStyle = MG_PAPER; c.globalAlpha = k; c.beginPath(); c.arc(ix, iy, R, 0, Math.PI * 2); c.stroke(); c.restore();
    }
  }
  return S_;
})();
