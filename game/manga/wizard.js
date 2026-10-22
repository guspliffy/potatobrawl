/* ===================== Manga page: Wizard, "Starfall" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Wizard, Starfall"). Times are ms after the final hit.
   300 the freeze (panel 1, engine) goes to NIGHT: the page is washed dark indigo except a lit spot round the hit, white focus lines and stars
   1250 panel 2 "the look": a black night panel. Seven stars flare one by one and join into a potato-shaped constellation (a chime up the scale each,
        "ting" small by three of them); the Wizard raises his staff, lowers it at the loser, the crystal grows 1x to 4x and gold motes spiral in
   2000 inset on the loser's face: terror, gold light growing on it . 2250 the brightest star lets go: the meteor, drawn over the whole page
   2350 panel 3 "the strike": the meteor crawls down toward the loser, the drop at 2780 (the page holds), 2830 the fall, 2900 impact (impact frames,
        star-shaped shock ring, shards, rays, "KRISSH"), the loser turns to crystal and is flung out along the real launch direction, a dotted line of stars stays
   3500 panel 4: the staff comes down, he looks up at the new constellation (the dotted line, stars at its ends), then at the reader; gold snow falls.
   The Wizard keeps the Dragon-page timing (hit 2900, launch 90 ms later). Everything specific to this page is prefixed wiz.
   The Ultimate KO (Meteor Shower), "Big Bang": MANGA.wizard.ulti extends this script (design: Project files ultimates/manga/wizard/fable-big-bang.md; `ult` says
   which one plays). A cooler night (NIGHT_U) and a rune circle over his hat; at 2250 five stars let go: four small gold ones rain onto marked spots round the loser
   (landing 2470-2740), the big one falls last (gold, 1.3x); the loser fills with night sky instead of crystal (KRAKOOM); 3250 panel 5: a black page, stars draw the
   loser's face over its dark silhouette, the face cracks (3950), 4100 the bang (a white frame, the page turns pale gold, the stars fly out as a galaxy, he stands in
   colour, BIG BANG); 4700 panel 4 as on Starfall (its moments are MT.AFTER + offset).
   POTATALITY: "Crisp-tal Ball" = MANGA.wizard.alt (S_.alt, at the end; its helpers are prefixed crb), played on a normal KO when it is on (ui/kopages.js).
   POTATALITY 2: "Hocus Croquettes" = MANGA.wizard.alt2 (S_.alt2, after it; its helpers are prefixed hc), played when the second one is chosen (FIN.alt 2). */
MANGA.wizard = (function () {
  const COL = "#f2c14e", GOLD = "#ffd978", PALE = "#fff6d8", NIGHT = "#0b0c1c", WHT = "#fffdf4", FACET_INK = "#2a1d12", NIGHT_U = "#06071a";
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
  // the Ultimate ("Big Bang"): ult is set by start(); the shower's four small stars, the loser's face as stars (geo), its dark silhouette (neb), the cracks
  let ult = false, shower = [], geo = null, neb = null, cracks = [], nDots = [];
  let pota = false;   // pota: this play is the Potatality, Crisp-tal Ball (set by its start)
  let pota2 = false;  // this play is the second Potatality, Hocus Croquettes (set by its start)
  const night = () => (ult ? NIGHT_U : NIGHT);
  const DET_U = [2340, 2250, 2250, 2280, 2310, -1, -1];   // the Ultimate: when each star of the constellation lets go (-1: it stays)
  // a star that has left the constellation (Starfall: only the brightest, at T_DET)
  const gone = (i, t) => (ult ? DET_U[i] >= 0 && t >= DET_U[i] : i === BRIGHT && t >= T_DET);

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
    } else if (ult && t >= MT.SPLASH && t < MT.AFTER) {   // the splash: the staff goes straight up, the crystal swells, the bang throws him back a little
      const e = ease(fe(MT.SPLASH, MT.SPLASH + 250, t)), r = t >= U_BANG ? 1 - ease(fe(U_BANG, U_BANG + 300, t)) : 0;
      ang = mixN(-0.55, -1.42, e); hF = lerp2(thrust, [w * 0.6, -leg - tor * 1.32], e); hB = [-w * 0.5, -leg - tor * mixN(0.85, 1.15, e)];
      lean = mixN(0.22, 0, e) - 0.15 * r;
      cry = t < U_BANG ? mixN(2.2, 4, e) + ease(fe(3740, 3950, t)) : mixN(5, 3, ease(fe(U_BANG, MT.AFTER, t)));
    } else if (pota && t >= MT.SPLASH) {   // the Potatality: the tap on the crystal ball (splash), the crisp lifted out of the bowl (panel 4)
      const q = crbCast(t, w, leg, tor); ang = q.ang; hF = q.hF; hB = q.hB; lean = q.lean; cry = q.cry;
    } else if (pota2 && t >= MT.SPLASH && t < MT.AFTER) {   // the second Potatality: the tap on the hat's brim, the pull, the bow
      const q = hcCast(t, w, leg, tor); ang = q.ang; hF = q.hF; hB = q.hB; lean = q.lean; cry = q.cry;
    } else if (t < MT.AFTER) {
      const e = easeOut(fe(2900, 3060, t));
      ang = mixN(0.2, -0.55, e); hF = lerp2(back, thrust, e); lean = mixN(-0.12, 0.22, e); hB = [-w * 0.5, -leg - tor * 0.85];
      cry = mixN(4, 2.2, ease(fe(2900, 3500, t)));
    } else {
      const A = MT.AFTER, e = ease(fe(A, A + 350, t)), g = ease(fe(A + 400, A + 650, t));
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
    c.fillStyle = night ? (ult ? NIGHT_U : NIGHT) : MG_INK; c.fillRect(x0, 0, x1 - x0, 140);
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
    if (sil) { c.fillStyle = sil; c.fill(); } else { c.fillStyle = ult ? MG_GOLD : COL; c.fill(); c.lineWidth = Math.max(2, r * (ult ? 0.22 : 0.17)); c.strokeStyle = MG_INK; c.stroke(); }   // the Ultimate's star is lit from inside: gold body, white core
    if (!sil) {
      const in_ = [], e2 = (sg) => { const o = []; for (let i = 0; i <= n; i++) { const q = i / n; o.push([-r * 0.3 - tail * 0.72 * q, sg * r * 0.34 * Math.pow(1 - q, 0.9) * fl(i + 3)]); } return o; };
      const core = e2(1).concat(e2(-1).reverse()); c.beginPath(); core.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fillStyle = ult ? WHT : PALE; c.fill();
    }
    // the head: a kite, white, ink edge, facet lines
    c.beginPath(); c.moveTo(r * 1.35, 0); c.lineTo(r * 0.1, -r * 0.74); c.lineTo(-r * 0.8, 0); c.lineTo(r * 0.1, r * 0.74); c.closePath();
    if (sil) { c.fillStyle = sil; c.fill(); } else {
      c.fillStyle = WHT; c.fill(); c.lineWidth = Math.max(2.2, r * 0.2); c.strokeStyle = MG_INK; c.stroke();
      c.beginPath(); c.moveTo(r * 1.35, 0); c.lineTo(-r * 0.8, 0); c.moveTo(r * 0.1, -r * 0.74); c.lineTo(r * 0.1, r * 0.74); c.moveTo(r * 0.1, -r * 0.74); c.lineTo(r * 0.62, 0); c.lineTo(r * 0.1, r * 0.74);
      c.lineWidth = Math.max(1, r * 0.08); c.stroke();
      c.beginPath(); c.moveTo(r * 1.35, 0); c.lineTo(r * 0.1, -r * 0.74); c.lineTo(r * 0.62, 0); c.closePath(); c.fillStyle = ult ? MG_GOLD : COL; c.fill();
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
      { id: "look", t0: MT.LOOK, from: "w", paper: night(), freeze: MT.STRIKE, cover: MT.STRIKE,
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
        shake: (t) => {
          let a = 5 * fe(FIN.hit, FIN.hit + 30, t) * (1 - fe(3100, 3400, t));
          if (ult) for (const s of shower) if (t >= s.land && t < s.land + 90) a = Math.max(a, 2 * (1 - (t - s.land) / 90));   // 2 px on each small star's landing
          return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0];
        },
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
    if (ult) wizRunes(c, pn, t, fe(1700, 1900, t), 0.0008);
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
    const sc = Math.min(pn.h / 205, 1.25);
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    // the lines
    c.strokeStyle = WHT; c.lineWidth = 2.1 * Math.max(0.8, sc);
    for (let i = 1; i <= n; i++) {
      const a = P[i - 1], b = P[i % n], t0 = T_STAR0 + (i - 1) * T_GAP + 40, k = fe(t0, t0 + T_GAP * 1.05, t);
      if (k <= 0) continue;
      const loose = gone(i - 1, t) || gone(i % n, t);
      if (loose) { c.globalAlpha = 0.35; if (ult) c.setLineDash([6, 5]); }
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); c.stroke(); c.globalAlpha = 1; if (loose && ult) c.setLineDash([]);
    }
    // the potato fills with dots once it has closed
    const fill = fe(T_STAR0 + n * T_GAP + 60, 2250, t);
    if (fill > 0) wizTone(c, P, 7, 0.1 + 0.13 * fill, PALE, [t * 0.0006, t * 0.0004], pn);
    // the stars
    for (let i = 0; i < n; i++) {
      const t0 = T_STAR0 + i * T_GAP, k = fe(t0, t0 + 200, t); if (k <= 0) continue;
      if (gone(i, t)) {   // let go: on the Ultimate a small flare where it was (the four small ones; the bright one is the meteor)
        const k2 = ult && i !== BRIGHT ? fe(DET_U[i], DET_U[i] + 140, t) : 1;
        if (k2 < 1 && !MG.slow) { const x = P[i][0], y = P[i][1], r = 6 * Math.max(0.85, sc); c.strokeStyle = MG_GOLD; c.lineWidth = 1.6; c.globalAlpha = 1 - k2; c.beginPath(); for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4 + 0.2, r1 = r * (1.4 + 3 * easeOut(k2)); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); } c.stroke(); c.globalAlpha = 1; }
        continue;
      }
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
    c.save(); c.globalAlpha = 0.6 * lit; c.fillStyle = ult ? MG_GOLD : COL; mgPoly(c, lp); c.fill(); c.restore();
    if (ult) { const eb = pn.y0 + (edge - pn.y0) * 0.12; c.save(); c.globalAlpha = 0.7 * lit; c.fillStyle = WHT; mgPoly(c, [lp[0], lp[1], [pn.x1 + 12, eb - sl * 0.12], [pn.x0 - 12, eb + sl * 0.12]]); c.fill(); c.restore(); }   // a white-hot band in the top tenth of the gold
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
    c.fillStyle = night(); mgPoly(c, poly(-0.05, edges[0])); c.fill();
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
    if (ult) showerGround(c, pn, t);
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
    for (let i = 0; i < P.length; i++) { if (gone(i, 1e9) || gone((i + 1) % P.length, 1e9)) continue; const q = P[(i + 1) % P.length]; c.moveTo(P[i][0], P[i][1]); c.lineTo(q[0], q[1]); }
    if (ult) c.setLineDash([6, 5]);
    c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1; c.setLineDash([]);
    for (let i = 0; i < P.length; i++) { if (gone(i, 1e9)) continue; c.beginPath(); c.arc(P[i][0], P[i][1], 9, 0, 6.2832); c.strokeStyle = GOLD; c.lineWidth = 1.4; c.stroke(); wizStar(c, P[i][0], P[i][1], 8 + Math.sin(t * 0.004 + i), 0, 0.3); c.fillStyle = WHT; c.fill(); }
    c.restore();
  }
  // the star-shaped shock ring: a ring between two twelve-point stars (white, ink edge), in whatever units the context is set to
  function wizRing(c, x, y, R, a, lw) {
    const star = (r) => { c.moveTo(x + r, y); for (let i = 1; i < 24; i++) { const an = (i / 24) * 6.2832, rr = i % 2 ? r * 0.64 : r; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } c.closePath(); };
    c.save(); c.globalAlpha = a; c.beginPath(); star(R); star(R * 0.74); c.fillStyle = WHT; c.fill("evenodd"); c.lineWidth = lw; c.lineJoin = "miter"; c.strokeStyle = MG_INK; c.stroke(); c.restore();
  }
  // the blast: the star-shaped shock ring, rays, shards
  function drawBlast(c, pn, t) {
    const H0 = FIN.hit, u = t - H0; if (u < 0 || u > 700) return;
    const [x, y] = chestW();
    // shock ring: a ring between two twelve-point stars
    const k = fe(0, 190, u), R = 18 + 150 * easeOut(k), a = 1 - fe(60, 320, u);
    if (a > 0.02) wizRing(c, x, y, R, a, 2.6);
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
    const out = FIN.out || Lp.state === "gone";
    c.save(); pn.world(c);
    if (!out && ult && t >= H0) drawNightLoser(c, pn, t);
    else if (!out) {
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
      const k = fe(MT.AFTER + 260 + i * 130, MT.AFTER + 380 + i * 130, t), a = k * (1 - fe(MT.AFTER + 750, MT.AFTER + 900, t)); if (a <= 0.02) continue;
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
      const ev = FIN.ev, heavy = ult || (ev && /^h/.test(ev.mv || "")), txt = ev && ev.fin ? "ZING" : heavy ? "DOOM" : "KRAK", D = FIN.dir;   // (an Ultimate's hit is heavy)
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike, P4 = () => MG.byId.after;
      const star = (i, t) => { const p = P2(); return [p.x0 + mxu(stars[i][0]) * p.w + p.ox, p.y0 + stars[i][1] * p.h + p.oy - 0.06 * p.h * fe(MT.LOOK, MT.STRIKE, t)]; };
      const ting = (i) => ({ text: "ting", t0: T_STAR0 + i * T_GAP + 40, t1: T_STAR0 + i * T_GAP + 560, size: 0.055, jit: 0.3, rot: (i % 2 ? 0.14 : -0.16), at: (t) => { const s = star(i, t); return [s[0] + D * 20, s[1] - 16]; } });
      const mul = lay.port ? 0.5 : 1;
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.22, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        ting(0), ting(3), ting(5),
        { text: "VWOOOM", t0: T_DET, t1: FIN.hit + 40, size: 0.115, arc: 9, rot: 1.05 * D, stretch: { ang: 1.05 * D, k: 0.45 },
          at: (t) => { const m = meteorState(t); return m ? [m.x - D * 95, m.y + 80] : [L.gw / 2, L.gh / 2]; } },
        // (the Ultimate: KRAKOOM lands when its three impact frames are over and is gone before the splash has slid in)
        { text: ult ? "KRAKOOM" : "KRISSH", t0: ult ? 3050 : FIN.hit, t1: ult ? 3420 : 3560, size: 0.2, arc: 8, jag: 0.1, rot: -0.07 * D, at: () => { const p = P3(), u = ult ? (lay.port ? 0.3 : 0.12) : lay.port ? 0.36 : 0.2, v = ult ? (lay.port ? 0.72 : 0.64) : lay.port ? 0.3 : 0.36; return [p.x0 + mxu(u) * p.w + p.ox, p.y0 + p.h * v + p.oy]; } },   // (the Ultimate's loser flies almost straight up through the middle)
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
      facets = ult ? null : [facetPattern(0), facetPattern(1), facetPattern(2)];   // (the Ultimate's loser turns to night, not crystal)
      if (ult) ultBuild(r);
      // panel 1 (the engine's frozen hit) goes to night: dark indigo with a lit spot round the hit, white focus lines, stars
      const p1 = MG.panels[0], orig = p1.d.draw;
      p1.d.draw = function (c, pn, t) { orig(c, pn, t); wizNight(c, t); };
    },
    start() { ult = false; pota = false; pota2 = false; shower = []; geo = null; neb = null; cracks = []; },
    end() { neb = null; geo = null; },
    step(t) { if (t > MT.END - 50 && facets) { facets = null; } if (ult && !neb && t >= 1600) nebBuild(); },   // the loser's dark silhouette for the splash, built while the look panel plays
    // gold snow across the whole page after the strike; the gem's speed lines run along its path
    over(o, t) {
      const ms = meteorState(t), H0 = FIN.hit;
      if (ms && t >= T_DET && t < H0) {
        const fall = fe(T_FALL, H0, t), tail = (110 + 130 * easeOut(fe(T_DET, 2900, t)) + 170 * fall) * U() * (ult ? 1 + 0.4 * fall : 1), rr = U() * (19 + 7 * fe(2350, T_FALL, t) + 5 * fall) * (ult ? 1 + 0.3 * fall : 1);   // the Ultimate's big star grows as it falls
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        if (fall > 0 && !MG.reduced) for (const dt of [26, 14]) { const q = meteorState(t - dt); if (q) wizMeteor(o, q.x, q.y, q.ang, rr * 0.9, tail * 0.6, t, 0.3); }
        if (fall > 0) mgSpeed(o, ms.x - Math.cos(ms.ang) * L.gh * 0.3, ms.y - Math.sin(ms.ang) * L.gh * 0.3, L.gh * 0.9, L.gh * 0.28, ms.ang, -(t - T_FALL) * 3, 0.55, true, 1);
        wizMeteor(o, ms.x, ms.y, ms.ang, rr, tail, t, 1);
        o.restore();
      }
      if (ult && t >= 2250 && t < 2760) showerOver(o, t);
      if (t > this.hit + 80 && t < this.hit + 600 + 400 && !((pota || pota2) && t >= MT.SPLASH)) {   // (a Potatality: the loser is in the ball (the hat) from the splash on)
        const Lp = L_(), pn = MG.byId.strike, u = t - FIN.launch, a = (1 - fe(FIN.launch + 150, FIN.launch + 420, t)) * fe(FIN.launch - 40, FIN.launch + 40, t);
        if (a > 0.01) {
          const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
          o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
          mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - FIN.launch) * 1.4, 0.7 * a, false, 1);
          o.restore();
        }
      }
      const A = MT.AFTER;
      if (t > A && t < MT.FADE + 100 && !pota && !pota2) {
        const a = fe(A, A + 300, t) * (1 - fe(A + 700, A + 1000, t)), u = (t - A) / 1000;
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
      if (ult) {   // the Meteor Shower's pattern: a ring on each of the four spots and the rune ellipse over his hat
        o.save(); pn.world(o); o.strokeStyle = sil; o.lineWidth = 3.5 / pn.z;
        for (const s of shower) { o.beginPath(); o.ellipse(s.x, 0, 22, 7, 0, 0, 6.2832); o.stroke(); }
        o.beginPath(); o.ellipse(W.x, W.y - W.s.h - 12, 30, 8, 0, 0, 6.2832); o.stroke(); o.restore();
      }
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, H0 = FIN.hit;
      if (pota && t >= MT.SPLASH) return crbPose(P, sk, t, role);   // the Potatality: the ball, the bowl
      if (role === "w") {
        const cs = cast(t);
        P.holdAng = cs.ang; P.cryK = cs.cry; P.lean = cs.lean; P.mouth = t >= 2780 && t < 3300 ? 0.5 : 0;
        P.expr = t < 1700 ? "calm" : t >= MT.AFTER + 450 ? "grin" : undefined; P.exK = 1;
        if (ult && t >= MT.SPLASH && t < MT.AFTER) P.expr = t < U_BANG ? "calm" : "grin";   // the splash: eyes shut while he draws the face, the grin at the bang
        if (t >= MT.AFTER) P.crouch = 0;
        return { hF: cs.hF, hB: cs.hB };
      }
      // the loser
      const fly = t >= FIN.launch;
      P.expr = fly ? "ko" : "terror"; P.exK = fe(1900, 2350, t);
      if (!fly) {
        P.lean = -0.14 + Math.sin(t * 0.03) * 0.035 * fe(2000, 2400, t); P.mouth = t >= H0 ? 1 : 0.35 * fe(2000, 2350, t) + 0.25;
        if (ult) for (const s of shower) if (t >= s.land && t < s.land + 60) P.lean += 0.06;   // a flinch at each small star's landing
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
      cueOnce("flute2", MT.AFTER + 100, () => Cin.go(() => Cin.flute(0.8)));
      cueOnce("chime", MT.AFTER + 480, () => Cin.go(() => Cin.chime(880)));
    },
  };
  const U_BANG = 4100;   // the Ultimate: the face is gone, the page turns gold
  // the frozen hit turns to night
  function wizNight(c, t) {
    const k = easeOut(fe(MT.FREEZE + 40, 820, t));
    if (k <= 0.01) return;
    const gw = L.gw, gh = L.gh, ix = MG.ix, iy = MG.iy, R0 = Math.hypot(gw, gh), R1 = Math.min(gw, gh) * 0.4, R = R0 + (R1 - R0) * k;
    c.save();
    c.beginPath(); c.rect(0, 0, gw, gh); c.arc(ix, iy, R, 0, Math.PI * 2);
    c.fillStyle = (ult ? "rgba(6,7,26," : "rgba(11,12,28,") + ((ult ? 0.94 : 0.92) * Math.min(1, k * 1.4)).toFixed(3) + ")"; c.fill("evenodd");
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
  /* ===================== the Ultimate: "Big Bang" ===================== */
  // the four small stars of the shower: [star of the constellation, spot (world units from the loser, toward the winner's side +), landing ms]
  const SHOWER = [[2, -96, 2470], [3, 96, 2560], [4, -48, 2650], [0, 48, 2740]];
  // a five-point star (the in-game Meteor Shower's shape); the Ultimate's gold is lit from inside: white core, gold body, ink rim
  function wizStar5(c, x, y, r, rotA, k) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = rotA - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * (k || 0.46) : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  function goldStar(c, x, y, r, rotA, lw) {
    wizStar5(c, x, y, r, rotA); c.fillStyle = MG_GOLD; c.fill(); c.lineWidth = lw; c.lineJoin = "miter"; c.strokeStyle = MG_INK; c.stroke();
    wizStar5(c, x, y, r * 0.45, rotA); c.fillStyle = WHT; c.fill();
  }
  // where a polygon's border crosses the line y: [leftmost x, rightmost x]
  function polyXAt(poly, y) {
    let a = 1e9, b = -1e9;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      if (p[1] === q[1] || (p[1] - y) * (q[1] - y) > 0) continue;
      const x = p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]); a = Math.min(a, x); b = Math.max(b, x);
    }
    return [a, b];
  }
  // at the freeze: where the four small stars start (their place in the look panel) and land (a spot on the strike panel's floor, kept 30 units inside its
  // border: the strike panel is a slanted shape, so on the wide page a spot on the winner's side is pulled in), the cracks, the dots inside the night loser
  function ultBuild(r) {
    const p2 = MG.byId.look, p3 = MG.byId.strike, D = FIN.dir;
    shower = SHOWER.map(([i, off, land]) => {
      mgPlace(p3, land);
      const g = p3.p(FIN.lx, 0), [l, rr] = polyXAt(p3.poly, g[1]), sg = Math.sign(off) * D;   // the screen side of the spot
      const room = Math.max(20, (sg < 0 ? g[0] - l : rr - g[0]) / p3.z - 30), x = FIN.lx + D * Math.sign(off) * Math.abs(off) * Math.min(1, room / 96);
      const det = DET_U[i], A = [p2.x0 + mxu(stars[i][0]) * p2.w, p2.y0 + stars[i][1] * p2.h - 0.06 * p2.h * fe(MT.LOOK, MT.STRIKE, det)];
      return { i, x, det, land, A, B: p3.p(x, 0), sh: Array.from({ length: 6 }, (_, j) => ({ a: -Math.PI * (0.12 + 0.76 * (j + r()) / 6), v: 0.6 + r() * 0.6, r: 3 + r() * 3, rot: r() * 6.28 })) };
    });
    p3.ox = p3.oy = 0;
    cracks = Array.from({ length: 7 }, (_, i) => {
      let a = (i / 7) * 6.2832 + (r() - 0.5) * 0.5, x = 0, y = 0;
      const len = 0.6 + r() * 0.3, pts = [[0, 0]];
      for (let j = 0; j < 5; j++) { a += (r() - 0.5) * 0.7; const l = (len / 5) * (0.7 + r() * 0.6); x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
      return pts;
    });
    nDots = Array.from({ length: 12 }, () => ({ u: (r() - 0.5) * 1.6, v: (r() - 0.5) * 2, s: 1 + r(), ph: r() * 6.28 }));
  }
  // the four small stars falling (page space, over the panels like the big one): a pale taper up the path with three sparkles in it, the gold star turning
  function showerOver(o, t) {
    const r = 14 * U(), gh = L.gh;
    o.save(); o.beginPath(); o.rect(0, 0, L.gw, gh); o.clip();
    for (const s of shower) {
      if (t < s.det || t >= s.land) continue;
      const k = fe(s.det, s.land, t), e = easeIn(k), dx = s.B[0] - s.A[0], dy = s.B[1] - s.A[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, px = -uy, py = ux;
      const x = s.A[0] + dx * e, y = s.A[1] + dy * e, tl = gh * 0.22 * Math.min(1, k * 4);
      o.fillStyle = rgba(PALE, 0.85); o.beginPath(); o.moveTo(x + px * r * 0.6, y + py * r * 0.6); o.lineTo(x - ux * tl, y - uy * tl); o.lineTo(x - px * r * 0.6, y - py * r * 0.6); o.closePath(); o.fill();
      for (let j = 1; j <= 3; j++) { const q = j / 4, w = r * 0.5 * Math.sin(t * 0.02 + j * 2); wizStar(o, x - ux * tl * q + px * w, y - uy * tl * q + py * w, r * 0.5 * (1 - q * 0.5), 0, 0.3); o.fillStyle = WHT; o.fill(); }
      goldStar(o, x, y, r, t * 0.01 + s.i, 1.6);
    }
    o.restore();
  }
  // on the strike panel's floor (world units): each spot's mark (a gold ring closing in, a white X), then the landing (a small shock ring, shards) and the star stuck there
  function showerGround(c, pn, t) {
    pn.world(c); c.save(); c.lineJoin = "miter"; c.lineCap = "round";
    for (const s of shower) {
      if (t < s.det) continue;
      const u = t - s.land;
      if (u < 140) {
        const k = fe(s.det, s.land, t), rx = 34 - 22 * k;
        c.globalAlpha = Math.min(1, (t - s.det) / 120) * (u > 0 ? 1 - u / 140 : 1);
        c.strokeStyle = MG_GOLD; c.lineWidth = 2.6 / pn.z; c.beginPath(); c.ellipse(s.x, 1, rx, rx * 0.3, 0, 0, 6.2832); c.stroke();
        c.strokeStyle = WHT; c.lineWidth = 2.2 / pn.z; c.beginPath(); c.moveTo(s.x - 5, -2); c.lineTo(s.x + 5, 4); c.moveTo(s.x + 5, -2); c.lineTo(s.x - 5, 4); c.stroke();
      }
      if (u < 0) continue;
      c.globalAlpha = 1;
      if (u < 190) wizRing(c, s.x, -4, 12 + 42 * easeOut(fe(0, 190, u)), 1 - fe(70, 190, u), 1.6);
      for (const q of s.sh) {
        const e = 1 - Math.exp(-u / 90), d = q.v * 58 * e, al = 1 - fe(160, 420, u);
        if (al <= 0.02) continue;
        c.globalAlpha = al; c.save(); c.translate(s.x + Math.cos(q.a) * d, -5 + Math.sin(q.a) * d + 30 * Math.pow(u / 420, 2)); c.rotate(q.rot + u * 0.01);
        c.beginPath(); c.moveTo(q.r * 1.3, 0); c.lineTo(-q.r * 0.6, q.r * 0.7); c.lineTo(-q.r * 0.3, -q.r * 0.6); c.closePath(); c.fillStyle = MG_GOLD; c.fill(); c.lineWidth = 1.4 / pn.z; c.strokeStyle = MG_INK; c.stroke(); c.restore();
      }
      c.globalAlpha = 1;
      goldStar(c, s.x, -4, 7 * (1 + 0.8 * (1 - fe(0, 120, u))), 0.35 * (s.i - 2), 1.4 / pn.z);   // stuck in the floor, a little tilted
    }
    c.restore();
  }
  // the in-game rune circle over his hat (screen space, kept inside the panel): two flat ellipses, white and gold, eight pale runes turning
  function wizRunes(c, pn, t, a, spin) {
    if (a <= 0.01 || MG.slow) return;
    const W = W_(), hd = bodyPt(W, t, "head"), q = pn.p(hd[0], hd[1]), rx = clamp(pn.z * 30, 24, pn.h * 0.22), ry = rx * 0.26;
    const y = Math.max(q[1] - pn.z * W.s.h * 0.62, pn.y0 + ry + 8);
    c.save(); pn.screen(c); c.globalAlpha = a; c.translate(q[0], y);
    c.lineWidth = 1.6;
    for (const [r, col] of [[rx, WHT], [rx * 0.7, MG_GOLD]]) { c.strokeStyle = col; c.beginPath(); c.ellipse(0, 0, r, r * 0.26, 0, 0, 6.2832); c.stroke(); }
    for (let i = 0; i < 8; i++) { const an = (i / 8) * 6.2832 + t * spin; rune(c, Math.cos(an) * rx * 0.85, Math.sin(an) * ry * 0.85 - 2, 3.4 * rx / 46, i, PALE, 1.2); }
    c.restore();
  }
  // the loser after the hit: night sky instead of crystal (dark fill, white dots, the potato constellation small in the chest), a white edge, white ghosts in flight
  function nightPost(t) {
    return (lc, X) => {
      lc.fillStyle = "rgba(6,7,26,0.94)"; lc.fillRect(X.bx, X.by, X.bw, X.bh);
      const Lp = L_(), w = Lp.s.w * X.z, h = Lp.s.h * X.z, cx = X.sx, cy = X.sy - h * 0.5, d = DPR, f = Lp.facing || 1;
      lc.fillStyle = WHT;
      for (const q of nDots) { lc.globalAlpha = 0.55 + 0.45 * Math.sin(t * 0.006 + q.ph); const s = q.s * d; lc.fillRect(cx + q.u * w * 0.5 - s / 2, cy + q.v * h * 0.42 - s / 2, s, s); }
      const P = STARS_L.map(([u, v]) => [cx + (u - 0.54) * w * 1.5 * f, cy + (v - 0.37) * h * 0.62]);
      lc.globalAlpha = 0.85; lc.strokeStyle = PALE; lc.lineWidth = d; lc.beginPath();
      for (let i = 0; i < 4; i++) { lc.moveTo(P[i][0], P[i][1]); lc.lineTo(P[i + 1][0], P[i + 1][1]); }
      lc.stroke(); lc.globalAlpha = 1;
      for (const q of P) { lc.beginPath(); lc.arc(q[0], q[1], 1.5 * d, 0, 6.2832); lc.fill(); }
    };
  }
  function drawNightLoser(c, pn, t) {
    const Lp = L_(), light = dirAng(-2.1);
    if (t >= FIN.launch && !MG.slow) for (const [dt, a] of [[66, 0.08], [44, 0.14], [22, 0.2]]) {
      const [gx, gy] = loserPos(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
      mgPuppet(c, pn, Lp, t - dt, { sc: 1, a, sil: WHT });
      Lp.x = ox; Lp.y = oy;
    }
    mgPuppet(c, pn, Lp, t, { sc: 1, light, tint: 0.3, halo: 3, flash: Lp.flash > 0, post: nightPost(t) });
    if (t < FIN.launch + 900) {   // glints, as on the crystal
      const r = mgRng(((t / 60) | 0) * 7 + 3), px = Lp.x, py = Lp.y - Lp.s.h * 0.5; pn.world(c);
      for (let i = 0; i < 3; i++) wizInkStar(c, px + (r() - 0.5) * 34, py + (r() - 0.5) * 40, 3.5 + r() * 4.5, r() * 0.8, WHT, 1.4);
    }
  }
  // the splash's face: the loser's own pose at 2300 (terror), its potato body as the outline and its eyes, mouth and brows as stars, laid out on the page
  // (FH: the face's height in px; C: its centre); cp is the stand-in copy the dark silhouette is drawn from
  function faceGeo() {
    if (geo) return geo;
    const Lp = L_(), cp = Object.assign({}, Lp, { x: 0, y: 0, vx: 0, vy: 0, state: "fin", flash: 0 }), pt0 = MG.pt;
    let P;
    MG.pt = 2300; try { P = pose(cp, mgTk(2300)); } finally { MG.pt = pt0; }
    const fc = cp.facing || 1, w = P.w, er = 0.1 * w, hx = P.head[0], hy = P.head[1];
    const cy = P.cy !== undefined ? P.cy : -P.h * 0.5, ry = P.ry || P.h * 0.4, rx = P.rx || w * 0.56;
    const port = MG.lay.port, gw = L.gw, gh = L.gh, pg = MG.page;
    const FH = port ? Math.min(0.36 * gh, 0.9 * gw) : 0.72 * gh, rxo = rx * 1.14, ryo = ry * 1.1, zf = FH * 0.8 / (2 * ryo);
    const Wp = (lx, ly) => { const q = rot([lx, ly], P.hip, P.lean); return [fc * q[0], q[1]]; };
    const C = port ? [0.5 * gw, 0.29 * gh] : [pg.x + mxu(0.62) * pg.w, 0.46 * gh], oc = Wp(0, cy);   // (upright: the face over the top half, him under it)
    const toP = (q) => [C[0] + (q[0] - oc[0]) * zf, C[1] + (q[1] - oc[1]) * zf], at = (lx, ly) => toP(Wp(lx, ly));
    const r = mgRng(515), pts = [], kind = [];   // kind: 0 outline, 1 eye ring, 2 pupil, 3 mouth, 4 brow
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + k * 6.2832 / 7, j = 1 + (r() - 0.5) * 0.16; pts.push(at(Math.cos(a) * rxo * j * (1 + 0.07 * Math.sin(a)), cy + Math.sin(a) * ryo * j)); kind.push(0); }
    // the face itself is drawn 1.7x its size on the body (about a point a little under the eyes), so eyes, mouth and brows read as a face and not a cluster
    const fs = 1.7, fy0 = hy + er, ft = (lx, ly) => at(hx + (lx - hx) * fs, fy0 + (ly - fy0) * fs);
    for (const ex of [hx - 0.14 * w, hx + 0.13 * w]) {
      for (const [dx, dy] of [[1.3, 0], [0, 2], [-1.3, 0], [0, -2]]) { pts.push(ft(ex + dx * er, hy + dy * er)); kind.push(1); }
      pts.push(ft(ex + 0.15 * er, hy + 0.1 * er)); kind.push(2);
    }
    for (const [dx, dy] of [[0, 1.9], [-1, 3.1], [1, 3.1]]) { pts.push(ft(hx + dx * er, hy + dy * er)); kind.push(3); }
    pts.push(ft(hx - 0.14 * w - 1.7 * er, hy - 1.3 * er)); kind.push(4);
    pts.push(ft(hx + 0.13 * w + 1.7 * er, hy - 1.3 * er)); kind.push(4);
    const lines = [];
    for (let k = 0; k < 7; k++) lines.push([k, (k + 1) % 7]);
    for (const b of [7, 12]) for (let k = 0; k < 4; k++) lines.push([b + k, b + (k + 1) % 4]);
    lines.push([17, 18], [18, 19], [19, 17], [20, 10], [21, 15]);   // the mouth; the brows run up to the eye rings' top stars (worried)
    geo = { cp, zf, FH, C, toP, pts, kind, lines, F: ft(hx, hy - 2.6 * er), fear: ft(hx, hy - 3.1 * er) };
    return geo;
  }
  // the loser's dark silhouette behind the face (hat, horns or hair say who it is): one page-sized canvas, drawn once, dotted with a 12% pale screen
  function nebBuild() {
    if (neb) return;
    const g = faceGeo(), pt0 = MG.pt, cv_ = mgCanvas(MG.cw, MG.ch), x = cv_.getContext("2d");
    const fake = { z: g.zf, ox: 0, oy: 0, x0: 0, y0: 0, x1: L.gw, y1: L.gh, p: (wx, wy) => g.toP([wx, wy]) };
    try { mgPuppet(x, fake, g.cp, 2300, { sil: "#161a44", free: true }); } finally { MG.pt = pt0; }
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = mgTile(7, 0.12, PALE); x.fillRect(0, 0, MG.cw, MG.ch); x.globalCompositeOperation = "source-over";
    neb = cv_;
  }
  const faceR = (g, i) => g.FH * (g.kind[i] === 2 ? 0.034 : g.kind[i] === 1 ? 0.02 : 0.028);
  // 3300-4100 on the black page: the stars draw the face, the hold (fills, the fear lines), the crack
  function drawFace(c, pn, t, g) {
    const D = FIN.dir, n = g.pts.length, S = g.FH, slow = MG.slow, crack = fe(3950, 4100, t), shake = !MG.reduced && t >= 3950;
    c.save();
    if (shake) { const [cx, cy] = g.C; c.translate(cx + Math.sin(t * 0.9) * 1.5, cy + Math.cos(t * 1.3) * 1.5); c.rotate(0.04 * D * easeOut(crack)); c.translate(-cx, -cy); }
    const na = 0.9 * fe(3300, 3740, t);
    if (neb && na > 0.01) { c.globalAlpha = na; c.drawImage(neb, 0, 0, L.gw, L.gh); c.globalAlpha = 1; }
    const hk = fe(3740, 3820, t);   // the hold: the outline fills with a pale screen, the eyes with white, the mouth with dark gold
    if (hk > 0) {
      c.globalAlpha = hk;
      wizTone(c, g.pts.slice(0, 7), 7, 0.14, PALE, [t * 0.0006, 0], pn);
      wizTone(c, g.pts.slice(7, 11), 6, 0.3, WHT, null, pn); wizTone(c, g.pts.slice(12, 16), 6, 0.3, WHT, null, pn);
      wizTone(c, g.pts.slice(17, 20), 6, 0.24, MG_GOLD_D, null, pn);
      c.globalAlpha = 1;
    }
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = WHT; c.lineWidth = 2.4; c.beginPath();
    for (const [a, b] of g.lines) {
      const t0 = 3300 + Math.max(a, b) * 20 + 60, k = fe(t0, t0 + 120, t);
      if (k <= 0) continue;
      const A = g.pts[a], B = g.pts[b]; c.moveTo(A[0], A[1]); c.lineTo(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k);
    }
    c.stroke();
    for (let i = 0; i < n; i++) {
      const t0 = 3300 + i * 20, k = fe(t0, t0 + 200, t);
      if (k <= 0) continue;
      const pul = g.kind[i] === 2 && t > 3740 ? 1 + 0.15 * Math.sin(t * 0.02) : 1, r = faceR(g, i) * (1 + 0.6 * (1 - k)) * pul, [x, y] = g.pts[i];
      if (k < 1 && !slow) {   // the flare, as the constellation's stars do
        c.strokeStyle = GOLD; c.lineWidth = 1.6; c.globalAlpha = 1 - k; c.beginPath();
        for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4 + 0.2, r1 = r * (2.4 + 2.6 * easeOut(k)); c.moveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
        c.stroke(); c.globalAlpha = 1;
      }
      c.beginPath(); c.arc(x, y, r * 1.45, 0, 6.2832); c.strokeStyle = GOLD; c.lineWidth = 1.4; c.stroke();
      wizStar(c, x, y, r * 1.5, 0, 0.3); c.fillStyle = WHT; c.fill();
    }
    const fk = fe(3760, 3860, t) * (1 - fe(3950, 4000, t));   // manga fear: three lines on the forehead
    if (fk > 0) { c.strokeStyle = WHT; c.lineWidth = 2.4; c.beginPath(); for (let i = -1; i <= 1; i++) { const x = g.fear[0] + i * S * 0.05, y0 = g.fear[1] - (i ? 0 : S * 0.012); c.moveTo(x, y0); c.lineTo(x, y0 - S * (i ? 0.06 : 0.08) * fk); } c.stroke(); }
    if (t >= 3950) {   // it cracks: hairlines from the forehead, white with a gold line a pixel inside
      const m = slow ? 5 : 7, [fx, fy] = g.F;
      for (const [col, lw, off] of slow ? [[WHT, 2.4, 0]] : [[WHT, 2.6, 0], [MG_GOLD, 1.1, 0.9]]) {
        c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = "miter"; c.beginPath();
        for (let i = 0; i < m; i++) {
          const k = easeOut(fe(3950 + i * 18, 4080, t)), P = cracks[i], segs = 5 * k;
          if (k <= 0) continue;
          c.moveTo(fx + off, fy + off);
          for (let j = 1; j <= 5; j++) { const q = Math.min(1, segs - (j - 1)); if (q <= 0) break; const a = P[j - 1], b = P[j]; c.lineTo(fx + off + (a[0] + (b[0] - a[0]) * q) * S, fy + off + (a[1] + (b[1] - a[1]) * q) * S); }
        }
        c.stroke();
      }
    }
    c.restore();
  }
  // 4100-4700 on the pale gold page: the new galaxy from the face's centre (focus lines, a gold dot disc in a dark gold band, the shock ring), the face's stars flying out
  function drawGalaxy(c, pn, t, g) {
    const [cx, cy] = g.C, gh = L.gh, u = (t - U_BANG) * (MG.reduced ? 0.5 : 1), R = gh * (0.05 + 0.57 * easeOut(fe(U_BANG, 4520, t))), diag = Math.hypot(L.gw, L.gh);
    if (!MG.slow) { mgFocus(c, cx, cy, diag, t * 0.0006, 0.2); mgFocus(c, cx, cy, diag, -t * 0.0006, 0.55, MG_GOLD); }
    wizTone(c, ringPoly(cx, cy, 0.76 * R, 40), 7, 0.26 - 0.1 * fe(4150, MT.AFTER, t), MG_GOLD, [t * 0.001, 0], pn);
    if (!MG.slow) {
      const X = (cx + pn.ox) * DPR, Y = (cy + pn.oy) * DPR;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(6, 0.2, MG_GOLD_D); c.beginPath(); c.arc(X, Y, 1.14 * R * DPR, 0, 6.2832); c.arc(X, Y, R * DPR, 0, 6.2832); c.fill("evenodd"); c.restore();
    }
    wizRing(c, cx, cy, R, 1 - 0.55 * fe(4300, MT.AFTER, t), 3);
    const e = 1 - Math.exp(-u / 220), fall = fe(0, 600, u);
    for (let i = 0; i < g.pts.length; i++) {
      if (MG.slow && i % 2) continue;
      const S = g.pts[i], dx = S[0] - cx, dy = S[1] - cy, dl = Math.hypot(dx, dy) || 1, x = cx + dx * (1 + 2.2 * e) + (dx / dl) * 0.1 * gh * e, y = cy + dy * (1 + 2.2 * e) + (dy / dl) * 0.1 * gh * e;
      const r = faceR(g, i) * 1.5 * (1 - 0.35 * fall), rt = i * 0.5 + u * 0.004, pupil = g.kind[i] === 2;
      c.globalAlpha = 1 - 0.4 * fall; wizInkStar(c, x, y, r, rt, pupil ? WHT : MG_GOLD, 1.4);
      if (!pupil) { wizStar(c, x, y, r * 0.45, rt, 0.3); c.fillStyle = WHT; c.fill(); }
    }
    c.globalAlpha = 1;
  }
  function drawSplash(c, pn, t) {
    const g = faceGeo(), W = W_(), bang = t >= U_BANG;
    if (!neb) nebBuild();
    pn.screen(c);
    c.fillStyle = bang ? MG_GOLD_PALE : NIGHT_U; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4);
    if (!bang) { skyField(c, pn, t, 0, 1, 0.7); drawFace(c, pn, t, g); } else drawGalaxy(c, pn, t, g);
    if (!bang) {   // the crystal's light round him, as in the look panel: two discs of pale dots and white focus lines
      const [tx, ty] = tipW(t), [cx, cy] = pn.p(tx, ty), R = Math.min(pn.h, 260) * (MG.lay.port ? 0.28 : 0.36);
      wizTone(c, ringPoly(cx, cy, R, 36), 9, 0.3, PALE, [t * 0.001, 0], pn);
      wizTone(c, ringPoly(cx, cy, R * 0.55, 30), 7, 0.5, PALE, [-t * 0.001, 0], pn);
      if (!MG.slow) mgFocus(c, cx, cy, Math.hypot(pn.w, pn.h) * 0.6, t * 0.0004, 0.16, true);
    }
    wizGround(c, pn, !bang);
    if (!bang) mgPuppet(c, pn, W, t, { sc: 1, tint: 0.4, tone: false, post: wizShade(dirAng(-0.5)) });
    else mgPuppet(c, pn, W, t, { sc: 1, tint: 0.32, tone: false, post: wizShade(dirAng(-1.57)) });   // in colour now, lit from above
    crystalOver(c, pn, t);
    wizRunes(c, pn, t, 1 - fe(U_BANG, 4400, t), 0.002);
    if (bang) {   // the bang: one white frame (reduced motion: a soft white fade instead)
      const a = MG.reduced ? 0.5 * (1 - fe(U_BANG, 4400, t)) : t < U_BANG + 50 ? 1 : 0;
      if (a > 0.01) { pn.screen(c); c.fillStyle = rgba(WHT, a); c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); }
    }
  }
  // panel 5: the sky comes down from the top; him at the bottom (in the middle upright, on the winner's side wide), the face above / beside him
  const wizSplashPanel = (port) => mgSplashPanel({ from: "t", paper: NIGHT_U,
    cam: (t, pn) => {
      const vh = (port ? 340 : 150) * (1 + 0.05 * ease(fe(U_BANG, MT.AFTER, t))), z = pn.h / vh, pg = MG.page;
      const tx = pg.x + mxu(port ? 0.5 : 0.2) * pg.w, ty = pg.y + (port ? 0.93 : 0.95) * pg.h;
      return { wx: FIN.wx - (tx - pn.cx) / z, wy: -(ty - pn.cy) / z, vh };
    },
    shake: (t) => { const a = t >= U_BANG ? 6 * (1 - fe(U_BANG, 4300, t)) : 0; return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
    draw: drawSplash });
  S_.ulti = Object.assign({}, S_, {
    name: "Big Bang", pop: 3050,   // the launch waits for the gold impact frame
    start(g) { S_.start(g); ult = true; },
    // once the splash is in, the KO beam where the loser left the screen is cut short and its flying bits are gone (a new page)
    after(t) { if (t < 3370 || t >= MT.AFTER) return; if (FIN.beam && FIN.beam.t0 > -1e5) FIN.beam.t0 = -1e6; FIN.parts.length = 0; },
    panels(lay) { const ps = panels(lay); ps.splice(ps.findIndex((q) => q.id === "after"), 0, wizSplashPanel(lay.port)); return ps; },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, ms = lay.port ? Math.min(0.34, 0.86 * L.gw / (8 * 0.2 * L.gh * 0.72)) : 1;   // (an eight-letter word has to fit the upright page)
      ws.push({ text: "BIG BANG", t0: 4160, t1: MT.CARD + 120, size: 0.2, mul: ms, arc: 8, jag: 0.08, fill: MG_GOLD, rot: -0.06 * D,
        at: () => { const g = faceGeo(), p = MG.byId.splash; return [g.C[0] + p.ox, g.C[1] - (lay.port ? 0.2 : 0.26) * L.gh + p.oy]; } });
      return ws;
    },
    cues(t) {
      S_.cues(t);
      [2250, 2280, 2310, 2340].forEach((d, i) => cueOnce("uDet" + i, d, () => Cin.go(() => Cin.tick(3400))));
      const down = [1319, 1175, 1047, 880], up = [523, 587, 659, 784, 880, 1047, 1175];
      shower.forEach((s, i) => cueOnce("uLand" + i, s.land, () => Cin.go(() => { Cin.stamp(0.6); Cin.chime(down[i]); })));
      cueOnce("uSky", 3300, () => Cin.go(() => Cin.sub(55, 30, 1.2, 0.3)));
      up.forEach((f, i) => cueOnce("uFace" + i, 3300 + i * 20, () => Cin.go(() => Cin.chime(f))));
      cueOnce("uShim", 3652, () => Cin.go(() => Cin.shimmer(1760, 1.2)));
      cueOnce("uFlute", 3740, () => Cin.go(() => Cin.flute(0.6)));
      cueOnce("uRiser", 3940, () => Cin.go(() => Cin.riser(0.16, 0.25)));
      for (let i = 0; i < 7; i++) cueOnce("uCrack" + i, 3950 + i * 18, () => Cin.go(() => Cin.tick(2600 - i * 200)));
      cueOnce("uDrop", 4010, () => Cin.go(() => Cin.drop(0.02)));
      cueOnce("uGlass", 4060, () => Cin.go(() => Cin.glass()));
      cueOnce("uBang", U_BANG, () => Cin.go(() => { Cin.boom(1); Cin.taiko(1); Cin.sub(40, 22, 1.6, 0.6); Cin.glass(); }));
      cueOnce("uShim2", 4150, () => Cin.go(() => Cin.shimmer(1760, 2.2)));
      cueOnce("uWord", 4160, () => Cin.go(() => Cin.chime(1568)));
    },
  });
  /* ===================== the Potatality, "Crisp-tal Ball" (MANGA.wizard.alt; design: Project files step8/fable-design.md) =====================
     Starfall to the hit (the hit's word is KLINNG here: KRISSH belongs to the ball). 3250 panel 5, the splash, slides up: the night, the Wizard
     stands behind a crystal ball that sits on his palm in the foreground, the loser small inside it, hands on the glass; 3600 he raises the staff,
     3800 its crystal taps the glass (tink...), cracks creep over it while the loser looks up; 3990 KRISSH: the ball bursts (a white frame, a star-burst,
     the star ring, shards) into a shower of potato crisps that tumble and fall like stars; the biggest one has the loser's face, flutters down onto
     the palm (4430) and blinks. 4700 in panel 4's place, in colour: a bowl of crisps by the Wizard, the face crisp on top; the crystal lifts one crisp
     out into his mouth (crunch, 4990) and the face crisp sweats; the engine's POP bursts the bowl at 5250 (food()): the empty bowl and a few crumbs.
     The ball is a foreground object, set in page px where the staff's crystal lands at the tap (his staff is far too long to tap a ball held in his
     own hand at his own scale); the palm and the sleeve under it come in from the bottom edge. Every helper here is prefixed crb. */
  const CRB_RAISE = 3600, CRB_TAP = 3800, CRB_K = 3990, CRB_LAND = 4430, CRB_LIFT = 4780, CRB_EAT = 4990;
  const CRB_GOLD = "#f4c45a", CRB_GOLD_B = "#dfa443", CRB_GOLD_D = "#b9812c", CRB_GLASS = "#e4e9fb", CRB_BOWL = "#323778", CRB_IN = "#181a44", CRB_TRIM = "#d8b04a";
  const CRB_H = [22, -70], CRB_A = 0.2, CRB_AP = 1.05, CRB_B = 1.1, CRB_BP = 0.3, CRB_BX = 50;   // the front hand and the staff's angle at the tap, how far behind the ball's top the crystal lands (wide, upright); the bowl's place (world units toward the loser)
  const CRB_FLECK = [[-0.45, -0.25], [0.15, -0.4], [0.5, 0.12], [-0.12, 0.32]];
  // the heap in the bowl, back to front: [x, y (about the bowl's foot), half width, turn, how much of its face shows, shape]
  const CRB_HEAP = [[-15, -22, 8, -0.5, 0.55, 1], [14, -22, 8, 0.6, 0.6, 2], [-5, -27, 8.5, 0.3, 0.5, 3], [7, -28, 8, -0.4, 0.55, 0],
    [-19, -19, 7.5, -0.9, 0.7, 2], [19, -19, 7.5, 0.8, 0.65, 3], [-9, -21, 8.5, 0.15, 0.75, 0], [9, -21, 8.5, -0.2, 0.7, 1], [0, -24, 8, 0.05, 0.6, 2]];
  let crbShp = [], crbFly = [], crbGlass = [], crbCrack = [], crbBits = [], crbFaceFill = CRB_GOLD;
  // the Wizard's staff and hands on the long half (local units about his feet, as cast() returns them); his own back hand stays behind him
  function crbCast(t, w, leg, tor) {
    const a1 = MG.lay && MG.lay.port ? CRB_AP : CRB_A, hB = [-w * 0.05, -leg - tor * 0.45];
    if (t >= MT.AFTER) {   // panel 4: the staff upright by him, tipped toward the bowl while its crystal lifts a crisp out
      const lift = fe(CRB_LIFT - 60, CRB_LIFT, t) * (1 - fe(CRB_EAT, CRB_EAT + 120, t));
      return { ang: mixN(-1.3, -0.95, lift), hF: lerp2([w * 0.66, -leg - tor * 0.62], [w * 0.74, -leg - tor * 0.72], lift), hB: [-w * 0.5, -leg - tor * 0.7], lean: 0.03 - 0.05 * lift, cry: 1.25 + 0.8 * lift };
    }
    const rest = [w * 0.48, -leg - tor * 0.9], up = [w * 0.42, -leg - tor * 1.24];
    let ang = -1.5 + 0.05 * Math.sin(t * 0.004), hF = rest, cry = 1.2;
    if (t >= CRB_RAISE && t < CRB_TAP - 60) { const e = ease(fe(CRB_RAISE, CRB_TAP - 60, t)); ang = mixN(-1.5, -2.25, e); hF = lerp2(rest, up, e); cry = 1.2 + 0.1 * e; }
    else if (t >= CRB_TAP - 60 && t < CRB_K) {   // the chop down onto the glass, a little bounce off it
      const e = easeIn(fe(CRB_TAP - 60, CRB_TAP, t)), b = Math.sin(Math.PI * fe(CRB_TAP, CRB_TAP + 140, t));
      ang = mixN(-2.25, a1, e) - 0.07 * b; hF = lerp2(up, CRB_H, e); cry = 1.3;
    } else if (t >= CRB_K) { const e = easeOut(fe(CRB_K, CRB_K + 260, t)); ang = mixN(a1, -1.3, e); hF = lerp2(CRB_H, up, e); cry = 2.6 - 1.3 * fe(CRB_K, CRB_K + 500, t); }
    return { ang, hF, hB, lean: 0.02, cry };
  }
  function crbPose(P, sk, t, role) {
    const w = sk.w, leg = sk.leg, tor = sk.tor;
    P.spin = 0; P.exK = 1;
    if (role === "w") {
      const cs = cast(t);
      P.holdAng = cs.ang; P.cryK = cs.cry; P.lean = cs.lean; P.crouch = 0;
      if (t < MT.AFTER) { P.expr = t >= CRB_TAP - 60 && t < CRB_K ? "calm" : "grin"; P.mouth = t >= CRB_K && t < CRB_K + 380 ? 0.5 + 0.2 * Math.sin((t - CRB_K) * 0.05) : 0; }   // eyes shut for the tap, a laugh at KRISSH
      else {   // panel 4: mouth open for the crisp, then chewing with his eyes shut
        const ch = t >= CRB_EAT && t < CRB_EAT + 260;
        P.expr = ch ? "calm" : "grin"; P.mouth = t >= CRB_EAT - 60 && t < CRB_EAT ? 0.6 : ch ? 0.12 + 0.2 * Math.abs(Math.sin((t - CRB_EAT) * 0.025)) : 0;
      }
      return { hF: cs.hF, hB: cs.hB };
    }
    // the loser in the ball: hands on the glass, pounding it; from the tap he freezes and looks up at the crack
    const k = t >= CRB_TAP, q = k ? 0 : Math.sin(t * 0.034);
    P.expr = "terror"; P.lean = k ? -0.16 : 0.12 + 0.03 * q; P.mouth = k ? 1 : 0.55 + 0.35 * Math.abs(q);
    return { hF: [w * 0.8, -leg - tor * (1.02 + 0.1 * q)], hB: [w * 0.62, -leg - tor * (1.2 - 0.1 * q)], fF: [w * 0.3, 0], fB: [-w * 0.25, 0] };
  }
  // a crisp's outline: a wobbly oval, unit half width
  function crbShape(r) {
    const ph = r() * 6.28, ph2 = r() * 6.28, k1 = 0.06 + r() * 0.06, k2 = 0.03 + r() * 0.04, ry = 0.7 + r() * 0.12;
    return Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * 6.2832, m = 1 + k1 * Math.sin(3 * a + ph) + k2 * Math.sin(5 * a + ph2); return [Math.cos(a) * m, Math.sin(a) * ry * m]; });
  }
  // one crisp at (x, y) in the current units: a wavy gold disc with an ink edge, its fold and a few flecks of the loser's colour (his flavour).
  // s: its half width, fy: how much of its face shows (it tumbles; the back is a shade darker), lw: the ink line
  function crbCrisp(c, x, y, s, rotA, fy, shp, lw, fleck, fill) {
    const f = Math.max(0.16, Math.abs(fy)), n = shp.length, px = (i) => shp[i % n][0] * s, py = (i) => shp[i % n][1] * s * f;
    c.save(); c.translate(x, y); c.rotate(rotA);
    c.beginPath(); c.moveTo((px(0) + px(1)) / 2, (py(0) + py(1)) / 2);
    for (let i = 1; i <= n; i++) c.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
    c.closePath(); c.fillStyle = fill || (fy >= 0 ? CRB_GOLD : CRB_GOLD_B); c.fill(); c.lineWidth = lw; c.lineJoin = "round"; c.strokeStyle = MG_INK; c.stroke();
    if (f > 0.35) {
      c.lineWidth = lw * 0.6; c.strokeStyle = CRB_GOLD_D; c.beginPath(); c.moveTo(-s * 0.55, -s * 0.1 * f); c.quadraticCurveTo(0, s * 0.3 * f, s * 0.5, -s * 0.06 * f); c.stroke();
      if (fleck) { c.fillStyle = fleck; c.beginPath(); for (const [a, b] of CRB_FLECK) { c.moveTo(a * s + s * 0.075, b * s * f); c.arc(a * s, b * s * f, s * 0.075, 0, 6.2832); } c.fill(); }
    }
    c.restore();
  }
  // the crisp with his face: his colour washed into it and his flecks, two eyes (lk: where they look, -1..1), a small worried mouth; wide: terror, shut: a blink
  function crbFace(c, x, y, s, rotA, lw, lk, wide, shut) {
    crbCrisp(c, x, y, s, rotA, 1, crbShp[0], lw, col(L_().pal), crbFaceFill);
    c.save(); c.translate(x, y); c.rotate(rotA); c.lineWidth = lw * 0.8; c.strokeStyle = MG_INK;
    const big = wide ? 1.22 : 1;
    for (const sd of [-1, 1]) {
      const ex = sd * s * 0.3 + lk[0] * s * 0.04, ey = -s * 0.12, rx = s * 0.17 * big, ry = s * 0.21 * big * (shut ? 0.12 : 1);
      c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, rx, ry, 0, 0, 6.2832); c.fill(); c.stroke();
      if (!shut) { c.fillStyle = MG_INK; c.beginPath(); c.arc(ex + lk[0] * rx * 0.42, ey + lk[1] * ry * 0.4, rx * (wide ? 0.36 : 0.55), 0, 6.2832); c.fill(); }
    }
    c.fillStyle = "rgba(255,120,120,0.55)"; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * s * 0.54, s * 0.12, s * 0.12, s * 0.07, 0, 0, 6.2832); c.fill(); }
    c.fillStyle = "#5a1f14"; c.beginPath(); c.ellipse(lk[0] * s * 0.05, s * 0.3, s * 0.08, s * (wide ? 0.11 : 0.06), 0, 0, 6.2832); c.fill(); c.stroke();
    c.restore();
  }
  // a sweat drop flicked off the face crisp (the shape of drawFear's)
  function crbSweat(c, x, y, r, a, k) {
    c.save(); c.globalAlpha = k; c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(0, -r * 1.9); c.quadraticCurveTo(r * 1.1, -r * 0.2, r, r * 0.4); c.arc(0, r * 0.4, r, 0, Math.PI, false); c.quadraticCurveTo(-r * 1.1, -r * 0.2, 0, -r * 1.9); c.closePath();
    c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = Math.max(1, r * 0.3); c.strokeStyle = MG_INK; c.stroke(); c.restore();
  }
  function crbBuild() {
    const r = mgRng(4711);
    crbShp = [0, 1, 2, 3].map(() => crbShape(r));
    crbFly = Array.from({ length: 32 }, (_, i) => {
      const up = i < 3 || r() < 0.75;
      return { a: up ? -Math.PI * (0.06 + 0.88 * r()) : Math.PI * (0.12 + 0.76 * r()), v: i < 3 ? 0.4 + 0.25 * r() : 0.3 + 0.7 * r(), s: i < 3 ? 1.8 + 0.4 * r() : 0.75 + 0.6 * r(),
        rot: r() * 6.28, spin: (r() - 0.5) * 6, ph: r() * 6.28, sp: 0.6 + 0.8 * r(), sw: r() * 6.28, g: 0.7 + 0.6 * r(), shp: i % 4 };
    });
    crbGlass = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * 6.2832 + (r() - 0.5) * 0.4, v: 0.5 + r() * 0.6, s: 0.6 + r() * 0.7, rot: r() * 6.28, spin: (r() - 0.5) * 0.03, w: i % 2 }));
    crbCrack = [0, -0.7, 0.75, -1.25, 1.3].map((a0, i) => {
      let a = a0 + (r() - 0.5) * 0.2, x = 0, y = 0;
      const pts = [[0, 0]];
      for (let j = 0; j < 4; j++) { a += (r() - 0.5) * 0.7; const l = (i ? 0.13 : 0.2) + r() * 0.1; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
      return pts;
    });
    crbBits = Array.from({ length: 6 }, () => ({ vx: (r() - 0.5) * 70, vy: -20 - r() * 40, s: 1.2 + r() * 1.2, rot: r() * 6.28 }));
    crbFaceFill = mix(CRB_GOLD, col(L_().pal), 0.25);
  }
  // the splash's foreground, in the panel's css px: the point the crystal taps (P), the ball (C, R), the palm under it
  function crbGeo(pn) {
    const port = MG.lay.port, D = FIN.dir, a = port ? CRB_AP : CRB_A, b = port ? CRB_BP : CRB_B;
    const P = pn.p(FIN.wx + D * (CRB_H[0] + Math.cos(a) * 55.6), CRB_H[1] + Math.sin(a) * 55.6), R = (port ? 46 : 44) * pn.z;
    const C = [P[0] + D * Math.sin(b) * R, P[1] + Math.cos(b) * R];
    return { P, R, C, palm: [C[0] - D * R * 0.06, C[1] + R * 0.97] };
  }
  // the camera: the Wizard's feet at a fixed spot of the page (left of the middle, wide; upper left, upright), a slow push in
  const crbCam = (port) => (t, pn) => {
    const vh = (port ? 330 : 155) * (1 - 0.04 * ease(fe(MT.SPLASH, MT.AFTER, t))), z = pn.h / vh, pg = MG.page;
    const tx = pg.x + mxu(port ? 0.25 : 0.28) * pg.w, ty = pg.y + (port ? 0.64 : 0.72) * pg.h;
    return { wx: FIN.wx - (tx - pn.cx) / z, wy: -(ty - pn.cy) / z, vh };
  };
  function crbShake(t) {
    const a = t >= CRB_K ? 7 * (1 - fe(CRB_K, CRB_K + 300, t)) : t >= CRB_TAP ? 2 * (1 - fe(CRB_TAP, CRB_TAP + 70, t)) : 0;
    return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0];
  }
  // the palm in the foreground, cupped under the ball, and his sleeve running off the bottom of the page toward him (a white keyline: dark on the night)
  function crbPalm(c, pn, g) {
    const D = FIN.dir, [hx, hy] = g.palm, R = g.R, lw = clamp(R * 0.03, 2, 4), y1 = pn.y1 + 14;
    pn.screen(c); c.lineJoin = "round";
    const shape = (fill) => { c.lineWidth = lw * 3; c.strokeStyle = MG_PAPER; c.stroke(); c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke(); };
    const sl = [[hx - D * R * 0.28, hy - R * 0.1], [hx + D * R * 0.1, hy + R * 0.24], [hx - D * R * 0.25, y1], [hx - D * R * 0.95, y1]];
    mgPoly(c, sl); shape(W_().pal.accent);
    mgPoly(c, [lerp2(sl[0], sl[3], 0.12), lerp2(sl[1], sl[2], 0.12), lerp2(sl[1], sl[2], 0.24), lerp2(sl[0], sl[3], 0.24)]); c.fillStyle = CRB_TRIM; c.fill(); c.lineWidth = lw; c.stroke();
    c.beginPath(); c.ellipse(hx, hy, R * 0.6, R * 0.3, -0.06 * D, 0, 6.2832); shape(LIMB);
    c.strokeStyle = "rgba(241,236,226,0.45)"; c.lineWidth = lw * 1.3; c.lineCap = "round"; c.beginPath(); c.ellipse(hx, hy + R * 0.02, R * 0.48, R * 0.2, -0.06 * D, 0.35, Math.PI - 0.35); c.stroke();   // a rim of light under the cup: a mitt, not a hole
    c.beginPath(); c.ellipse(hx - D * R * 0.46, hy - R * 0.17, R * 0.13, R * 0.21, 0.45 * D, 0, 6.2832); c.fillStyle = LIMB; c.fill(); c.lineWidth = lw; c.stroke();   // the thumb over the near edge
  }
  // the loser inside the ball: his own puppet, small, through a stand-in panel that maps his feet onto the ball's floor
  function crbInside(c, pn, g, t) {
    const Lp = L_(), D = FIN.dir, [cx, cy] = g.C, R = g.R, zf = R * 1.3 / (Lp.s.h + 16), bx = cx - D * R * 0.28, fy = cy + R * 0.7;
    const keep = [Lp.x, Lp.y, Lp.state, Lp.facing, Lp.flash];
    const fake = { z: zf, ox: pn.ox, oy: pn.oy, x0: pn.x0, y0: pn.y0, x1: pn.x1, y1: pn.y1, p: (wx, wy) => [bx + (wx - Lp.x) * zf, fy + (wy - Lp.y) * zf] };
    Lp.state = "fin"; Lp.facing = -D; Lp.flash = 0;
    try { mgPuppet(c, fake, Lp, t, { sc: 1, tint: 0.3, light: dirAng(-1.2), free: true }); } finally { [Lp.x, Lp.y, Lp.state, Lp.facing, Lp.flash] = keep; }
  }
  // the cracks from the tap (the first at once, the others creeping until KRISSH) and the glint where the crystal touched
  function crbCracks(c, g, t, lw) {
    if (t < CRB_TAP) return;
    const R = g.R, [px, py] = g.P, inA = Math.atan2(g.C[1] - py, g.C[0] - px), ca = Math.cos(inA), sa = Math.sin(inA);
    c.save(); c.lineJoin = "miter"; c.lineCap = "round";
    for (const [colr, wd] of [["#ffffff", lw * 1.5], [MG_INK, lw * 0.6]]) {
      c.strokeStyle = colr; c.lineWidth = wd; c.beginPath();
      crbCrack.forEach((pts, i) => {
        const k = i ? easeOut(fe(CRB_TAP + 30 + i * 24, CRB_K - 10, t)) : easeOut(fe(CRB_TAP, CRB_TAP + 70, t)), n = (pts.length - 1) * k;
        if (k <= 0) return;
        c.moveTo(px, py);
        for (let j = 1; j < pts.length; j++) {
          const q = Math.min(1, n - (j - 1)); if (q <= 0) break;
          const a = pts[j - 1], b = pts[j], x = a[0] + (b[0] - a[0]) * q, y = a[1] + (b[1] - a[1]) * q;
          c.lineTo(px + (x * ca - y * sa) * R, py + (x * sa + y * ca) * R);
        }
      });
      c.stroke();
    }
    const gl = 1 - fe(CRB_TAP, CRB_TAP + 240, t);
    if (gl > 0) { wizStar(c, px, py, R * 0.3 * (0.4 + 0.6 * gl), 0.3, 0.22); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = MG_INK; c.stroke(); }
    c.restore();
  }
  function crbBall(c, pn, g, t) {
    const D = FIN.dir, [cx, cy] = g.C, R = g.R, lw = clamp(R * 0.035, 2.2, 4.5);
    pn.screen(c);
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fillStyle = CRB_GLASS; c.fill(); c.clip();
    wizTone(c, [[cx - R, cy + R * 0.3], [cx + R, cy + R * 0.1], [cx + R, cy + R], [cx - R, cy + R]], 6, 0.24, "#8e98cf", null, pn);   // its shadow side: a band of blue dots low in it
    crbInside(c, pn, g, t);
    c.restore();
    pn.screen(c);
    c.save(); c.translate(cx, cy); c.scale(D, 1); c.lineCap = "round"; c.strokeStyle = "#ffffff";   // the shine, away from the tap
    c.lineWidth = R * 0.075; c.beginPath(); c.arc(0, 0, R * 0.78, -1.25, -0.45); c.stroke();
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(Math.cos(-1.5) * R * 0.78, Math.sin(-1.5) * R * 0.78, R * 0.05, 0, 6.2832); c.fill();
    c.lineWidth = R * 0.035; c.globalAlpha = 0.7; c.beginPath(); c.arc(0, 0, R * 0.84, 2.0, 2.7); c.stroke();
    c.restore();
    c.lineWidth = lw; c.strokeStyle = MG_INK; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke();
    crbCracks(c, g, t, lw);
  }
  // the face crisp after KRISSH (page px): up out of the burst, then down like a leaf onto the palm. -> [x, y, turn]
  function crbFacePt(g, t) {
    const D = FIN.dir, R = g.R, [cx, cy] = g.C, top = [cx - D * R * 0.2, cy - R * 1.1], land = [g.palm[0] + D * R * 0.05, g.palm[1] - R * 0.34];
    if (t < CRB_K + 260) { const k = easeOut(fe(CRB_K, CRB_K + 260, t)); return [lerp(cx, top[0], k), lerp(cy, top[1], k), 0.7 * k * D]; }
    const k = fe(CRB_K + 260, CRB_LAND, t), sw = Math.sin(k * Math.PI * 2.5) * (1 - k);
    return [lerp(top[0], land[0], ease(k)) + sw * R * 0.6, lerp(top[1], land[1], k), (0.7 * (1 - k) - 0.5 * sw) * D];
  }
  function crbBurst(c, pn, g, t) {
    const [cx, cy] = g.C, R = g.R, u = t - CRB_K, lw = clamp(R * 0.026, 1.6, 3), port = MG.lay.port, D = FIN.dir;
    pn.screen(c);
    if (u < 50 && !MG.reduced) { c.fillStyle = "rgba(255,252,244,0.92)"; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); }   // one white frame
    if (u < 150) mgStarburst(c, cx, cy, R * (1.05 + 0.75 * easeOut(u / 150)), 0.3);
    if (u < 300) wizRing(c, cx, cy, R * (0.9 + 1.1 * easeOut(fe(0, 260, u))), 1 - fe(90, 300, u), 3);
    const ga = 1 - fe(260, 560, u);   // the glass flies out and is gone
    if (ga > 0.02) {
      c.save(); c.globalAlpha = ga; c.lineJoin = "miter";
      for (const s of crbGlass) {
        const e = 1 - Math.exp(-u / 110), d = s.v * R * 2.6 * e, r = s.s * R * 0.16;
        c.save(); c.translate(cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d + R * 0.8 * Math.pow(u / 600, 2)); c.rotate(s.rot + u * s.spin);
        c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(-r * 0.6, r * 0.75); c.lineTo(-r * 0.35, -r * 0.6); c.closePath(); c.fillStyle = s.w ? "#ffffff" : CRB_GLASS; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = MG_INK; c.stroke();
        c.restore();
      }
      c.restore();
    }
    // the crisps: out of the burst, tumbling, then falling like stars
    const Q = Math.max(pn.w, pn.h) * 0.5, e = 1 - Math.exp(-u / 160), fall = pn.h * (port ? 0.5 : 0.7) * Math.pow(u / 1000, 2), sway = fe(150, 520, u), fleck = col(L_().pal);
    for (let i = 0; i < crbFly.length; i++) {
      if (MG.slow && i % 2) continue;
      const f = crbFly[i], x = cx + Math.cos(f.a) * f.v * Q * e * (port ? 0.6 : 1) + Math.sin(u * 0.006 + f.sw) * R * 0.2 * sway, y = cy + Math.sin(f.a) * f.v * Q * e * (port ? 1 : 0.62) + fall * f.g;
      if (y < pn.y1 + 40) crbCrisp(c, x, y, f.s * R * 0.15, f.rot + f.spin * u * 0.001, Math.cos(f.ph + u * 0.008 * f.sp), crbShp[f.shp], lw, fleck);
    }
    // his crisp: wide eyes on the way, on the palm a squash, a look at the Wizard and a blink
    const F = crbFacePt(g, t), on = t >= CRB_LAND, sq = on ? 1 - 0.12 * Math.sin(Math.PI * fe(CRB_LAND, CRB_LAND + 140, t)) : 1;
    c.save(); c.translate(F[0], F[1]); c.scale(1 / sq, sq); crbFace(c, 0, 0, R * 0.4, F[2], lw, on ? [-D, 0.1] : [0, 0.6], !on, Math.abs(t - 4580) < 45); c.restore();
  }
  function crbDrawSplash(c, pn, t) {
    const g = crbGeo(pn), [cx, cy] = g.C, R = g.R, broke = t >= CRB_K;
    pn.screen(c);
    skyField(c, pn, t, 0, 1, 0.75);
    // the ball's light: two discs of pale dots and white focus lines, a flash of them at KRISSH
    const lit = broke ? 1 - 0.6 * fe(CRB_K, CRB_K + 500, t) : 0.25 + 0.2 * fe(CRB_TAP, CRB_K, t);
    wizTone(c, ringPoly(cx, cy, R * 1.8, 40), 9, 0.08 + 0.22 * lit, PALE, [t * 0.001, 0], pn);
    wizTone(c, ringPoly(cx, cy, R * 1.35, 36), 7, 0.16 + 0.3 * lit, PALE, [-t * 0.001, 0], pn);
    if (!MG.slow) mgFocus(c, cx, cy, Math.hypot(pn.w, pn.h) * 0.8, t * 0.0004, 0.12 + (broke ? 0.45 * lit : 0), true);
    const [tx, ty] = pn.p(...tipW(t));   // the crystal's own light, round his hat (his dark side reads on the night)
    wizTone(c, ringPoly(tx, ty, Math.min(pn.w, pn.h) * 0.34, 30), 8, 0.2, PALE, [-t * 0.0008, 0], pn);
    wizGround(c, pn, true);
    mgPuppet(c, pn, W_(), t, { sc: 1, tint: 0.4, tone: false, post: wizShade(dirAng(0.4)) });
    crystalOver(c, pn, t);
    crbPalm(c, pn, g);
    if (broke) crbBurst(c, pn, g, t); else crbBall(c, pn, g, t);
  }
  // panel 4: the bowl (indigo, a gold band and star), the heap with his crisp on top; once the food has popped, empty with a few crumbs
  function crbBowl(c, pn, t, x0) {
    const D = FIN.dir, lw = Math.max(1.1, 3 / pn.z), popped = mgPopped(t), fleck = col(L_().pal);
    pn.world(c); c.lineJoin = "round"; c.lineCap = "round";
    c.fillStyle = CRB_IN; c.strokeStyle = MG_INK; c.lineWidth = lw; c.beginPath(); c.ellipse(x0, -18, 26, 5.5, 0, 0, 6.2832); c.fill(); c.stroke();   // the inside, seen over the rim
    if (!popped) {
      for (const h of CRB_HEAP) crbCrisp(c, x0 + D * h[0], h[1], h[2], D * h[3], h[4], crbShp[h[5]], lw, fleck);
      if (t < CRB_LIFT) crbCrisp(c, x0 - D * 6, -31, 7.5, -0.3 * D, 0.6, crbShp[3], lw, fleck);   // the one the crystal will lift
      const lift = t >= CRB_LIFT && t < CRB_EAT, eat = t >= CRB_EAT, bob = Math.sin(t * 0.01) * 0.4;
      crbFace(c, x0 + D, -36 + bob, 9.5, 0.08 * D, lw, lift ? [-D * 0.6, -0.8] : [-D, 0.1], eat, Math.abs(t - 4860) < 40);
      const sw = fe(CRB_EAT + 20, CRB_EAT + 120, t);
      if (sw > 0) crbSweat(c, x0 + D * 11, -41 + 5 * fe(CRB_EAT + 120, 5240, t), 2, 0.4 * D, sw);
    } else for (const [dx, dy] of [[-12, -19.5], [7, -20.5]]) crbCrisp(c, x0 + D * dx, dy, 2.6, dx * 0.1, 0.8, crbShp[1], lw * 0.8);   // crumbs on the rim
    const body = () => { c.beginPath(); c.moveTo(x0 - 26, -18); c.bezierCurveTo(x0 - 25, -6, x0 - 16, -2, x0 - 9, -2); c.lineTo(x0 + 9, -2); c.bezierCurveTo(x0 + 16, -2, x0 + 25, -6, x0 + 26, -18); c.ellipse(x0, -18, 26, 5.5, 0, 0, Math.PI); c.closePath(); };
    c.fillStyle = MG_INK; c.fillRect(x0 - 10, -3, 20, 3);   // the foot
    body(); c.fillStyle = CRB_BOWL; c.fill(); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke();
    c.strokeStyle = CRB_TRIM; c.lineWidth = lw * 1.5; c.beginPath(); c.ellipse(x0, -15.5, 24.6, 5, 0, 0.15, Math.PI - 0.15); c.stroke();   // the gold band under the rim
    pn.screen(c);
    wizTone(c, [pn.p(x0 + D * 9, -12), pn.p(x0 + D * 25, -16), pn.p(x0 + D * 17, -3), pn.p(x0 + D * 8, -2)], 6, 0.4, MG_INK, null, pn);
    pn.world(c);
    wizInkStar(c, x0 - D * 4, -8.5, 4.4, 0.2, GOLD, lw * 0.8);
  }
  // the crisp the crystal lifts out of the bowl into his mouth (sparkles round it), then the crumbs falling from his mouth
  function crbLifted(c, pn, t, x0) {
    if (t < CRB_LIFT) return;
    const D = FIN.dir, lw = Math.max(1.1, 3 / pn.z), M = bodyPt(W_(), CRB_EAT, "mouthPt");
    pn.world(c);
    if (t < CRB_EAT) {
      const k = ease(fe(CRB_LIFT, CRB_EAT, t)), S = [x0 - D * 6, -31], E = [M[0] + D * 4, M[1] + 1], Q = [(S[0] + E[0]) / 2, Math.min(S[1], E[1]) - 26];
      const x = (1 - k) * (1 - k) * S[0] + 2 * k * (1 - k) * Q[0] + k * k * E[0], y = (1 - k) * (1 - k) * S[1] + 2 * k * (1 - k) * Q[1] + k * k * E[1];
      for (let j = 0; j < 3; j++) { const an = t * 0.012 + j * 2.09; wizStar(c, x + Math.cos(an) * 10, y + Math.sin(an) * 6, 2.6, 0, 0.3); c.fillStyle = PALE; c.fill(); c.lineWidth = lw * 0.6; c.strokeStyle = MG_INK; c.stroke(); }
      crbCrisp(c, x, y, 7.5 - 1.5 * k, D * (-0.3 + k * 2.2), 0.6 + 0.4 * k, crbShp[3], lw, col(L_().pal));
      return;
    }
    const u = (t - CRB_EAT) / 1000;
    c.fillStyle = CRB_GOLD; c.strokeStyle = MG_INK; c.lineWidth = lw * 0.6;
    for (const b of crbBits) {
      const x = M[0] + D * 4 + b.vx * u * D, y = Math.min(-b.s * 0.6, M[1] + 2 + b.vy * u + 170 * u * u);
      c.save(); c.translate(x, y); c.rotate(b.rot + u * 6); c.beginPath(); c.moveTo(-b.s, -b.s * 0.4); c.lineTo(b.s * 0.8, -b.s * 0.6); c.lineTo(b.s * 0.6, b.s * 0.5); c.lineTo(-b.s * 0.7, b.s * 0.4); c.closePath(); c.fill(); c.stroke(); c.restore();
    }
  }
  function crbDrawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir, x0 = FIN.wx + D * CRB_BX;
    pn.screen(c);
    // a window of night sky in the upper corner (as on Starfall's panel 4), two crisps falling through it like shooting stars
    const win = [[0.5, 0], [1.02, 0], [1.02, 0.78], [0.66, 0.56]].map(([a, b]) => [pn.x0 + mxu(a) * pn.w, pn.y0 + b * pn.h]);
    c.fillStyle = NIGHT; mgPoly(c, win); c.fill();
    c.save(); mgPoly(c, win); c.clip();
    c.fillStyle = WHT;
    for (const s of bgDots) { const x = pn.x0 + mxu(0.5 + s.u * 0.52) * pn.w, y = pn.y0 + s.v * 0.78 * pn.h; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.004 + s.ph); c.fillRect(x, y, s.r, s.r); }
    c.globalAlpha = 1;
    const u = (t - MT.AFTER) / 1000, cr = Math.min(pn.h * 0.045, 10);
    for (let i = 0; i < 2; i++) {
      const k = (u * 0.5 + i * 0.47) % 1, x = pn.x0 + mxu(0.62 + 0.3 * k + i * 0.08) * pn.w, y = pn.y0 + pn.h * (0.06 + 0.4 * k + i * 0.05);
      c.strokeStyle = PALE; c.lineWidth = 1.2; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x - D * pn.h * 0.12, y - pn.h * 0.16); c.stroke(); c.globalAlpha = 1;
      crbCrisp(c, x, y, cr, t * 0.004 + i, Math.cos(t * 0.006 + i * 2), crbShp[i + 1], 1.4);
    }
    c.restore();
    c.save(); mgPoly(c, win); c.lineWidth = 3; c.strokeStyle = MG_INK; c.stroke(); c.restore();
    wizGround(c, pn, false);
    mgPuppet(c, pn, W, t, { sc: 1, tint: 0.3, tone: false, post: wizShade(dirAng(-0.8)) });   // in colour now
    crystalOver(c, pn, t);
    crbBowl(c, pn, t, x0);
    crbLifted(c, pn, t, x0);
  }

  S_.alt = Object.assign({}, S_, {
    name: "Crisp-tal Ball",
    start(g) { S_.start(g); pota = true; },
    end() { S_.end(); pota = false; crbFly = []; crbGlass = []; },
    build(lay) { S_.build(lay); crbBuild(); },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = crbDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 118 : 100) * (1 - 0.05 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + FIN.dir * (lay.port ? 46 : 48), wy: -0.43 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: NIGHT, slide: MG.reduced ? 1 : 180, cam: crbCam(lay.port), shake: crbShake, draw: crbDrawSplash }));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, mul = lay.port ? 0.5 : 1, hit = ws.find((w) => w.text === "KRISSH");
      if (hit) Object.assign(hit, { text: "KLINNG", t1: MT.SPLASH + 150 });   // the hit's word on this page (KRISSH is the ball's), gone as the splash comes in
      const sp = (fn) => () => { const pn = MG.byId.splash; mgPlace(pn, 3700); const q = fn(crbGeo(pn), pn); return [q[0] + pn.ox, q[1] + pn.oy]; };
      ws.push(
        { text: "tink...", t0: CRB_TAP + 10, t1: CRB_K + 200, size: 0.065, mul, jit: 0.16, rot: -0.12 * D, at: sp((g) => [g.P[0] - D * g.R * 0.1, g.P[1] - g.R * 0.65]) },
        { text: "KRISSH", t0: CRB_K, t1: 4620, size: 0.2, mul, arc: 8, jag: 0.12, rot: -0.08 * D,
          at: sp((g, pn) => (lay.port ? [pn.x0 + pn.w * 0.5, pn.y0 + pn.h * 0.17] : [g.C[0] + D * g.R * 1.9, g.C[1] - g.R * 0.75])) },
        { text: "crunch", t0: CRB_EAT, t1: 5320, size: 0.06, mul, jit: 0.18, rot: 0.1 * D,
          at: () => { const pn = MG.byId.after, m = bodyPt(W_(), CRB_EAT, "mouthPt"); mgPlace(pn, CRB_EAT); const q = pn.sp(m[0] - D * 30, m[1] - 22); return [q[0], q[1]]; } },
      );
      return ws;
    },
    // the splash is night: the skip hint goes pale over it (the upright page's panel 4 is paper again)
    hint(t) { return t >= MT.SPLASH + 180 && !(MG.lay.port && t >= MT.AFTER + 120) ? "rgba(241,236,226,0.6)" : "rgba(30,28,40,0.55)"; },
    food() { const x = FIN.wx + FIN.dir * CRB_BX; return { x, y: 0, r: 26, y0: -30, lx: x + FIN.dir * 34 }; },
    cues(t) {
      S_.cues(t);
      cueOnce("crbRaise", CRB_RAISE, () => Cin.go(() => Cin.whoosh(0.25, -0.3, 0.3, 0.18)));
      cueOnce("crbTap", CRB_TAP, () => Cin.go(() => { Cin.chime(3136); Cin.tick(4200); }));
      for (let i = 0; i < 4; i++) cueOnce("crbCrack" + i, CRB_TAP + 60 + i * 40, () => Cin.go(() => Cin.tick(3000 - i * 300)));
      cueOnce("crbDrop", CRB_K - 70, () => Cin.go(() => Cin.drop(0.04)));
      cueOnce("crbKrissh", CRB_K, () => Cin.go(() => { Cin.glass(); Cin.impact(0.45); Cin.shimmer(1320, 1.4); }));
      cueOnce("crbRain", CRB_K + 120, () => Cin.go(() => Cin._noise(1.1, 0.08, 2600, 5200, "bandpass", 1.4)));
      cueOnce("crbLand", CRB_LAND, () => Cin.go(() => Cin.tick(1800)));
      cueOnce("crbLift", CRB_LIFT, () => Cin.go(() => Cin.shimmer(1760, 0.5)));
      cueOnce("crbCrunch", CRB_EAT, () => Cin.go(() => { for (let i = 0; i < 3; i++) Cin._noise(0.07, 0.35, 3000, 1400, "bandpass", 1.2, i * 0.09); }));
    },
  });
  /* ===================== the second Potatality, "Hocus Croquettes" (MANGA.wizard.alt2; design: Project files step8/fable-design-2.md §1.3) =====================
     Starfall to the hit (KRISSH is gone as the splash comes in). 3250 panel 5, the splash, slides up on paper: his hat, magic-big and upside down, floats on its
     point with the loser dropped into it head first, his feet kicking over the brim; the Wizard (upright: floating beside the brim) taps the brim with the staff's
     crystal, a star burst (ALAKAZAM). 3310-3800 the hat wobbles (220 ms, 6 degrees), twelve sparkles orbit it, the feet sink into it (gone at 3600: poof).
     3740 he reaches into the hat; 3850-4270 he pulls out a ribbon-tied chain of six croquettes like a magician's scarves, one every 70 ms, arcing over the
     hat, the first with the loser's face. 4290-4650 a small bow (ta-daa); 4450 the last croquette slips off the ribbon and drops to the ground (oops).
     4700 panel 4 as on Crisp-tal Ball, in colour: the hat beside him, resting on its floppy point like a basket, croquettes piled in it like eggs and the face
     croquette on the brim (it blinks); the engine's POP leaves the hat on its side and three stars drifting out of it.
     Splash world: the hat's point at (FIN.lx, -3). Every helper here is prefixed hc. */
  const HC = { TAP: 3300, WOB0: 3310, WOB1: 3800, SINK0: 3340, POOF: 3600, REACH: 3740, PULL0: 3850, STEP: 70, PULL1: 4270, BOW0: 4290, TADA: 4320, SLIP: 4450, OOPS: 4470, DOWN: 4600, BOW1: 4650 };
  const HC_TAU = Math.PI * 2, HC_CROQ = "#d68a34", HC_CROQ_D = "#9a5a1e", HC_CROQ_HI = "#f5c27a", HC_RIB = "#d8344a", HC_CL = 15.5, HC_CR = 5, HC_NS = 16;
  const HC_PUFF = [[0, -4, 9], [-11, -1, 7], [11, -2, 7.5], [-6, -11, 7], [7, -12, 6.5], [-17, -7, 5], [17, -8, 5]];
  const HC_SIDE = { H: 30, rxB: 26, ryB: 6, rxO: 19, ryO: 4.4 };
  const HC_PILE = [[-9, -25, 0.12], [9, -25.5, -0.1], [-1, -31, 0.06], [10, -32, 0.5], [-11, -32, -0.45]];   // the croquettes heaped in the hat (panel 4): x, y about the foot, turn
  const hcLx = new Float32Array(HC_NS + 1), hcLy = new Float32Array(HC_NS + 1), hcLs = new Float32Array(HC_NS + 1), hcQ = [0, 0, 0];
  let hcGc = null, hcIn = 0, hcWob = 0, hcFall = null;   // hcIn: 1 the Wizard, 2 the loser in the hat (their poses in the splash); hcWob: the hat's tilt now; hcFall: where the slipping croquette starts
  // the splash's layout: the hat (height, brim and mouth radii, its point), the Wizard's feet, the camera, the tap (front hand, staff angle)
  function hcGeo() {
    if (hcGc) return hcGc;
    const port = !!(MG.lay && MG.lay.port), D = FIN.dir, x = FIN.lx, w = W_().s.w;
    const G = port
      ? { port, x, H: 116, rxB: 48, ryB: 10, rxO: 35, ryO: 7.5, tipY: -3, wx0: x - D * 60, wx1: x - D * 60, cx: x - D * 14, cy: -146, vw: 150, reach: [0.6, -0.2], pull: [0.2, 2.0], sp: 23 }
      : { port, x, H: 104, rxB: 50, ryB: 10, rxO: 36, ryO: 7.5, tipY: -3, wx0: x - D * 92, wx1: x - D * 70, wy: -8, cx: x - D * 36, cy: -76, vh: 152, reach: [0.75, 1.5], pull: [-0.5, 1.75], sp: 19 };
    G.brimY = G.tipY - G.H;
    if (port) G.wy = G.brimY - 6;   // upright: he floats beside the brim, his feet level with it
    // the tap: the crystal (40 from the hand) lands on the brim's near edge; the hand's height follows from that
    const tx = D * (x - D * (G.rxB - 6) - G.wx0), ty = G.brimY - 2 - G.wy, hx = w * 0.62, dx = tx - hx, dy = Math.sqrt(Math.max(0, 1600 - dx * dx)) * (port ? -1 : 1);
    G.tapH = [hx, ty + dy]; G.tapA = Math.atan2(-dy, dx);
    return (hcGc = G);
  }
  // the hat's wobble about its point (radians, screen turn)
  const hcTilt = (t) => (MG.reduced ? 0 : 0.105 * Math.sin(((t - HC.WOB0) / 220) * Math.PI * 2) * fe(HC.WOB0, HC.WOB0 + 60, t) * (1 - fe(HC.WOB1 - 120, HC.WOB1, t)));
  // the staff and hands on the splash (local units about his feet, as cast() returns them)
  function hcCast(t, w, leg, tor) {
    const G = hcGeo(), tapH = G.tapH, up = [w * 0.5, -leg - tor * 1.0], hold = [w * 0.55, -leg - tor * 0.75];
    const rest = [-w * 0.5, -leg - tor * 0.7], R0 = [w * G.reach[0], -leg - tor * G.reach[1]], R1 = [w * G.pull[0], -leg - tor * G.pull[1]];
    let ang, hF, cry = 1.4, lean = 0;
    if (t < HC.TAP) { const e = easeIn(fe(MT.SPLASH, HC.TAP, t)); ang = mixN(G.port ? 2.4 : -1.95, G.tapA, e); hF = lerp2(up, tapH, e); cry = 1.6; }
    else if (t < HC.TAP + 120) { const b = Math.sin(Math.PI * fe(HC.TAP, HC.TAP + 120, t)); ang = G.tapA - (G.port ? -0.12 : 0.12) * b; hF = tapH; cry = 2.8 - 0.8 * fe(HC.TAP, HC.TAP + 120, t); }
    else if (t < HC.POOF) { const e = ease(fe(HC.TAP + 120, HC.TAP + 260, t)), sw = Math.sin(t * 0.025) * 0.1; ang = mixN(G.tapA, G.port ? 0.9 + sw : -1.05 + sw, e); hF = lerp2(tapH, hold, e); cry = 2 + 0.2 * Math.sin(t * 0.03); }
    else { const e = ease(fe(HC.POOF, HC.POOF + 200, t)); ang = mixN(G.port ? 0.9 : -1.05, -1.5, e); hF = hold; cry = mixN(2, 1.3, e); }
    let hB = rest;
    if (t >= HC.REACH && t < HC.PULL0) hB = lerp2(rest, R0, ease(fe(HC.REACH, HC.PULL0 - 20, t)));
    else if (t >= HC.PULL0) {
      const k = fe(HC.PULL0, HC.PULL1, t), tug = t < HC.PULL1 ? 0.06 * Math.sin(Math.PI * (((t - HC.PULL0) / HC.STEP) % 1)) : 0;
      hB = lerp2(R0, R1, easeOut(k)); hB = [hB[0] - w * tug, hB[1] - tor * tug];
    }
    if (t >= HC.BOW0) {   // the bow: he leans in, the staff hand to his chest, the chain held up
      const b = ease(fe(HC.BOW0, HC.BOW0 + 110, t)) * (1 - ease(fe(HC.BOW1 - 90, HC.BOW1, t)));
      lean = 0.22 * b; hF = lerp2(hold, [w * 0.3, -leg - tor * 0.7], b);
    }
    return { ang, hF, hB, lean, cry };
  }
  // the Wizard (or the loser in the hat) drawn at the splash's place for him, then put back
  const hcWX = (t) => { const G = hcGeo(); return lerp(G.wx0, G.wx1, ease(fe(HC.POOF + 40, HC.REACH + 40, t))); };
  function hcAsW(t, fn) {
    const G = hcGeo(), W = W_(), ox = W.x, oy = W.y, bob = Math.sin(t * 0.007) * 2;
    W.x = hcWX(t); W.y = G.wy + bob; hcIn = 1;
    try { return fn(W); } finally { W.x = ox; W.y = oy; hcIn = 0; }
  }
  // the loser upside down in the hat: his middle on the hat's axis, turned with it; s: how far his feet have sunk (0..1)
  function hcLoser(c, pn, t, G, wob) {
    const Lp = L_(), lb = Lp.spec.boss ? MG_BOSS_SC : 1, h = Lp.s.h * lb, sink = easeIn(fe(HC.SINK0, HC.POOF, t)), D = FIN.dir;
    if (sink >= 1) return;
    const yf = G.brimY - G.ryB - 30 + (h * 0.6 + 30) * sink, cx = G.x, cy = yf + h * 0.5, dx = cx - G.x, dy = cy - G.tipY, ca = Math.cos(wob), sa = Math.sin(wob);
    const mx = G.x + dx * ca - dy * sa, my = G.tipY + dx * sa + dy * ca, sv = [Lp.x, Lp.y, Lp.state, Lp.facing, Lp.flash];
    Lp.x = mx; Lp.y = my + h * 0.5; Lp.state = "fin"; Lp.facing = -D; Lp.flash = 0; hcIn = 2; hcWob = wob;
    c.save(); pn.world(c); c.translate(G.x, G.tipY); c.rotate(wob);
    c.beginPath(); c.moveTo(-G.rxO, G.brimY - G.tipY); c.ellipse(0, G.brimY - G.tipY, G.rxO, G.ryO, 0, Math.PI, 0, true); c.lineTo(G.rxO, -400); c.lineTo(-G.rxO, -400); c.closePath(); c.clip();
    try { mgPuppet(c, pn, Lp, t, { sc: 1, tint: 0.36, light: dirAng(-1.2) }); }
    finally { c.restore(); Lp.x = sv[0]; Lp.y = sv[1]; Lp.state = sv[2]; Lp.facing = sv[3]; Lp.flash = sv[4]; hcIn = 0; }
  }
  function hcLPose(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor, k = t * 0.055;
    P.spin = Math.PI + L_().facing * hcWob; P.lean = 0; P.expr = "terror"; P.exK = 1; P.mouth = 1;
    return { hF: [w * 0.45, -leg - tor * 0.9], hB: [-w * 0.45, -leg - tor * 0.9], fF: [w * (0.55 + 0.12 * Math.sin(k)), leg * 0.25 - leg * 0.6 * (0.5 + 0.5 * Math.sin(k))], fB: [-w * (0.5 + 0.12 * Math.cos(k)), leg * 0.25 - leg * 0.6 * (0.5 + 0.5 * Math.cos(k))] };
  }
  // the hat, upside down: in its own frame (the point at 0, 0; the brim's middle at y = -H); glow: the light inside it
  function hcHat(c, G, lw, glow) {
    const W = W_(), ac = W.pal.accent, D = FIN.dir, H = G.H, yB = -H, rO = G.rxO;
    const cone = () => { c.beginPath(); c.moveTo(-rO * 1.02, yB); c.quadraticCurveTo(-rO * 0.6, yB * 0.42, -D * 3, -6); c.quadraticCurveTo(D * 4, 3, D * 11, -2); c.quadraticCurveTo(D * 6, -4, D * 3, -9); c.quadraticCurveTo(rO * 0.6, yB * 0.42, rO * 1.02, yB); c.closePath(); };
    c.lineJoin = "round"; c.lineCap = "round";
    cone(); c.fillStyle = ac; c.fill();
    c.save(); c.clip();
    c.fillStyle = mix(ac, "#000000", 0.38); c.fillRect(-rO * 1.2, yB, rO * 2.4, H * 0.13);
    c.beginPath(); c.moveTo(D * rO * 0.1, yB); c.quadraticCurveTo(D * rO * 0.5, yB * 0.45, D * 6, 0); c.lineTo(D * rO * 1.3, 0); c.lineTo(D * rO * 1.3, yB); c.closePath();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(6, 0.4); c.fill(); c.restore();
    c.restore();
    cone(); c.lineWidth = lw * 1.3; c.strokeStyle = MG_INK; c.stroke();
    leaf(c, -D * rO * 0.32, yB * 0.62, 1.1, 0.5 * D); leaf(c, D * rO * 0.22, yB * 0.4, 1.1, -0.7 * D); leaf(c, -D * rO * 0.08, yB * 0.22, 0.9, 0.2 * D);
    c.beginPath(); c.ellipse(0, yB, G.rxB, G.ryB, 0, 0, HC_TAU); c.fillStyle = mix(ac, "#000000", 0.12); c.fill(); c.lineWidth = lw * 1.3; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); c.ellipse(0, yB - G.ryB * 0.12, rO, G.ryO, 0, 0, HC_TAU); c.fillStyle = mix(ac, "#000000", 0.72); c.fill();
    if (glow > 0.02) { c.globalAlpha = glow; c.beginPath(); c.ellipse(0, yB - G.ryB * 0.12, rO * 0.8, G.ryO * 0.7, 0, 0, HC_TAU); c.fillStyle = GOLD; c.fill(); c.globalAlpha = 1; }
    c.beginPath(); c.ellipse(0, yB - G.ryB * 0.12, rO, G.ryO, 0, 0, HC_TAU); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke();
  }
  // a croquette: a breaded log (gold-brown, crumbs, a light along its top) at (x, y) turned by ang, s its scale; face: the loser's face on it ({ look, shut })
  function hcCroq(c, x, y, ang, s, lw, face) {
    const L0 = HC_CL * s, R = HC_CR * s;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.roundRect(-L0 / 2, -R, L0, R * 2, R); c.fillStyle = face ? hcFaceFill() : HC_CROQ; c.fill();
    c.fillStyle = HC_CROQ_D; for (const [a, b] of [[-0.3, 0.45], [0.05, 0.6], [0.32, 0.35], [-0.12, 0.15], [0.2, -0.1]]) { c.beginPath(); c.arc(a * L0, b * R, R * 0.13, 0, HC_TAU); c.fill(); }
    c.strokeStyle = HC_CROQ_HI; c.lineWidth = R * 0.3; c.beginPath(); c.moveTo(-L0 * 0.3, -R * 0.52); c.lineTo(L0 * 0.28, -R * 0.52); c.stroke();
    c.beginPath(); c.roundRect(-L0 / 2, -R, L0, R * 2, R); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke();
    if (face) {
      const er = R * 0.36, lk = face.look || 0;
      for (const sd of [-1, 1]) {
        const ex = sd * L0 * 0.17, ey = -R * 0.12;
        if (face.shut) { c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(ex - er, ey); c.quadraticCurveTo(ex, ey + er * 0.7, ex + er, ey); c.stroke(); continue; }
        c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, er, er * 1.25, 0, 0, HC_TAU); c.fill(); c.lineWidth = lw * 0.7; c.stroke();
        c.fillStyle = MG_INK; c.beginPath(); c.arc(ex + lk * er * 0.4, ey + er * 0.15, er * 0.52, 0, HC_TAU); c.fill();
      }
      c.fillStyle = "rgba(255,120,120,0.55)"; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * L0 * 0.34, R * 0.32, R * 0.2, R * 0.12, 0, 0, HC_TAU); c.fill(); }
      c.fillStyle = "#5a1f14"; c.beginPath(); c.ellipse(0, R * 0.48, R * 0.15, R * (face.open ? 0.2 : 0.09), 0, 0, HC_TAU); c.fill(); c.lineWidth = lw * 0.6; c.stroke();
    }
    c.restore();
  }
  let hcFF = null;
  const hcFaceFill = () => hcFF || (hcFF = mix(HC_CROQ, col(L_().pal), 0.35));
  // the ribbon's curve from the hand (h) to the hat's mouth (m), bowed up so its length is about len: sampled into hcLx/hcLy, lengths in hcLs. Returns its length.
  function hcCurve(hx, hy, mx, my, len) {
    const dx = mx - hx, dy = my - hy, d = Math.hypot(dx, dy) || 1, s = Math.sqrt(Math.max(0, (len * len - d * d) * 0.1875)) * 2;
    let nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }
    const qx = (hx + mx) / 2 + nx * s, qy = (hy + my) / 2 + ny * s;
    for (let i = 0; i <= HC_NS; i++) {
      const u = i / HC_NS, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), e = u * u;
      hcLx[i] = a * hx + b * qx + e * mx; hcLy[i] = a * hy + b * qy + e * my;
      hcLs[i] = i ? hcLs[i - 1] + Math.hypot(hcLx[i] - hcLx[i - 1], hcLy[i] - hcLy[i - 1]) : 0;
    }
    return hcLs[HC_NS];
  }
  // the point at arc length s along the sampled curve, into hcQ: x, y, the angle of the curve there
  function hcAt(s) {
    let i = 1; while (i < HC_NS && hcLs[i] < s) i++;
    const seg = hcLs[i] - hcLs[i - 1] || 1, k = clamp((s - hcLs[i - 1]) / seg, 0, 1);
    hcQ[0] = hcLx[i - 1] + (hcLx[i] - hcLx[i - 1]) * k; hcQ[1] = hcLy[i - 1] + (hcLy[i] - hcLy[i - 1]) * k; hcQ[2] = Math.atan2(hcLy[i] - hcLy[i - 1], hcLx[i] - hcLx[i - 1]);
    return hcQ;
  }
  // the chain at t: the hand, the mouth, its length; the croquettes along it from the hand (i < 6; the last one is gone after it slipped)
  function hcChain(c, pn, t, G, lw) {
    if (t < HC.PULL0) return;
    const hand = hcAsW(t, (W) => bodyPt(W, t, "hB")), mx = G.x + FIN.dir * 3, my = G.brimY - 2, out = clamp((t - HC.PULL0) / HC.STEP + 0.6, 0, 6.5);
    const len = hcCurve(hand[0], hand[1], mx, my, G.sp * out);
    // the ribbon: ink under red, a bow between two croquettes
    c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(hcLx[0], hcLy[0]); for (let i = 1; i <= HC_NS; i++) c.lineTo(hcLx[i], hcLy[i]);
    c.strokeStyle = MG_INK; c.lineWidth = lw * 2.4; c.stroke(); c.strokeStyle = HC_RIB; c.lineWidth = lw * 1.1; c.stroke();
    for (let i = 5; i >= 0; i--) {
      const s = G.sp * (i + 0.5);
      if (s > len + 1 || (i === 5 && t >= HC.SLIP)) continue;
      const q = hcAt(s), x = q[0], y = q[1], a = q[2];
      if (i < 5 && s + G.sp * 0.5 < len) {   // the bow after it
        const b = hcAt(s + G.sp * 0.5), bx = b[0], by = b[1], ba = b[2];
        c.save(); c.translate(bx, by); c.rotate(ba + Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(-3.4, -2.4); c.lineTo(-3.4, 2.4); c.closePath(); c.moveTo(0, 0); c.lineTo(3.4, -2.4); c.lineTo(3.4, 2.4); c.closePath();
        c.fillStyle = HC_RIB; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = MG_INK; c.stroke(); c.restore();
      }
      hcCroq(c, x, y, a, i ? 1 : 1.4, lw, i ? null : { look: -FIN.dir * (t < HC.BOW0 ? 0.6 : 1), shut: t >= 4120 && t < 4180, open: t < HC.BOW0 });
    }
  }
  // the croquette that slipped off: a hop out over the brim, down to the ground, one bounce
  function hcDrop(c, t, G, lw) {
    if (t < HC.SLIP) return;
    if (!hcFall) {   // where the last croquette was on the ribbon as it slipped
      const hd = hcAsW(HC.SLIP - 1, (W) => bodyPt(W, HC.SLIP - 1, "hB"));
      hcCurve(hd[0], hd[1], G.x + FIN.dir * 3, G.brimY - 2, G.sp * 6.5); const q = hcAt(G.sp * 5.5); hcFall = [q[0], q[1], q[2]];
    }
    const D = FIN.dir, [x0, y0, a0] = hcFall, gx = G.x + D * (G.rxB + 16), k = fe(HC.SLIP, HC.DOWN, t), b = fe(HC.DOWN, HC.DOWN + 120, t), r = HC_CR;
    const x = lerp(x0, gx, k) + D * 6 * b, y = k < 1 ? lerp(y0, -r, k * k) - 26 * k * (1 - k) * 4 : -r - 6 * Math.sin(Math.PI * b), a = a0 + D * (k * 7 + b * 1.4);
    hcCroq(c, x, y, k >= 1 && b >= 1 ? 0 : a, 1, lw);
  }
  // a puff of smoke at the hat's mouth (poof): ink rings under, paper over
  function hcPoof(c, x, y, k, a, lw) {
    if (k <= 0 || a <= 0.02) return;
    const e = 0.5 + 0.5 * easeOut(k);
    c.save(); c.globalAlpha = a; c.lineWidth = lw * 2; c.strokeStyle = MG_INK; c.fillStyle = MG_PAPER;
    for (const [dx, dy, r] of HC_PUFF) { c.beginPath(); c.arc(x + dx * e * 1.2, y + dy * e - 10 * k, r * e, 0, HC_TAU); c.stroke(); }
    for (const [dx, dy, r] of HC_PUFF) { c.beginPath(); c.arc(x + dx * e * 1.2, y + dy * e - 10 * k, r * e - 0.4, 0, HC_TAU); c.fill(); }
    c.restore();
  }
  // twelve sparkles round the hat at mid height (back ones first, under the hat; front ones over it)
  function hcSparks(c, G, t, front, lw) {
    const a = fe(HC.WOB0, HC.WOB0 + 80, t) * (1 - fe(HC.WOB1 - 120, HC.WOB1, t));
    if (a <= 0.02) return;
    const cy = G.tipY - G.H * 0.55, rx = G.rxB + 16, ry = 15;
    c.globalAlpha = a;
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * HC_TAU + (t - HC.WOB0) * 0.006, s = Math.sin(an);
      if (front !== s > 0) continue;
      wizInkStar(c, G.x + Math.cos(an) * rx, cy + s * ry + Math.sin(an * 3 + t * 0.01) * 3, (i % 3 ? 3.2 : 4.6) * (0.85 + 0.15 * s), an, i % 2 ? GOLD : PALE, lw * 0.7);
    }
    c.globalAlpha = 1;
  }
  function hcDrawSplash(c, pn, t) {
    const G = hcGeo(), D = FIN.dir, lw = Math.max(1.1, 3 / pn.z), wob = hcTilt(t);
    pn.screen(c);
    // the stage: dots round the edges, a pale spotlight disc on the hat, focus lines
    const q = pn.p(G.x, G.tipY - G.H * 0.62), m = Math.min(pn.w, pn.h);
    wizTone(c, ringPoly(q[0], q[1], m * 0.78, 40), 10, 0.2, MG_INK, [t * 0.001, 0], pn);
    c.beginPath(); c.arc(q[0], q[1], m * 0.56, 0, HC_TAU); c.fillStyle = MG_PAPER; c.fill();
    wizTone(c, ringPoly(q[0], q[1], m * 0.5, 36), 8, 0.22, "#e8c46a", [-t * 0.0008, 0], pn);
    c.beginPath(); c.arc(q[0], q[1], m * 0.38, 0, HC_TAU); c.fillStyle = "#fffaf0"; c.fill();
    if (!MG.slow) mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.85, t * 0.0004, 0.55);
    wizGround(c, pn, false);
    pn.world(c);
    c.save(); c.globalAlpha = 0.35; c.fillStyle = MG_INK; c.beginPath(); c.ellipse(G.x, 0, G.rxO * 0.7, 3, 0, 0, HC_TAU); c.fill();   // the shadows under the hat's point and under him, floating
    if (!G.port) { c.beginPath(); c.ellipse(hcWX(t), 0, 18, 3, 0, 0, HC_TAU); c.fill(); }
    c.restore();
    hcSparks(c, G, t, false, lw);
    const glow = 0.85 * (1 - fe(HC.POOF, HC.POOF + 200, t)) + 0.7 * fe(HC.REACH, HC.PULL0, t) * (1 - fe(HC.PULL1, HC.PULL1 + 200, t));
    c.save(); c.translate(G.x, G.tipY); c.rotate(wob); hcHat(c, G, lw, glow); c.restore();
    hcLoser(c, pn, t, G, wob);
    pn.world(c);
    hcSparks(c, G, t, true, lw);
    // poof: the feet are gone
    const pk = fe(HC.POOF, HC.POOF + 320, t);
    if (pk > 0 && pk < 1) hcPoof(c, G.x, G.brimY - 4, pk, 1 - fe(HC.POOF + 160, HC.POOF + 320, t), lw);
    // the Wizard (in front of the hat's near edge), his crystal; the tap's star burst on the brim
    hcAsW(t, () => { mgPuppet(c, pn, W_(), t, { sc: 1, tint: 0.34, tone: false, post: wizShade(dirAng(-0.8)) }); crystalOver(c, pn, t); });
    const bu = t - HC.TAP;
    if (bu >= 0 && bu < 260) { const tp = pn.p(G.x - D * (G.rxB - 6), G.brimY - 2); pn.screen(c); mgStarburst(c, tp[0], tp[1], m * (0.07 + 0.09 * easeOut(bu / 260)) * (1 - 0.3 * fe(150, 260, bu)), 0.3); }
    pn.world(c);
    hcChain(c, pn, t, G, lw);
    hcDrop(c, t, G, lw);
  }
  function hcCam(t, pn) {
    const G = hcGeo(), z = 1 + 0.04 * ease(fe(MT.SPLASH, MT.AFTER, t)), vh = (G.port ? (G.vw * pn.h) / pn.w : G.vh) / z;
    return { wx: G.cx, wy: G.cy, vh };
  }
  const hcShake = (t) => { const a = 3 * fe(HC.TAP, HC.TAP + 15, t) * (1 - fe(HC.TAP + 30, HC.TAP + 200, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; };
  // panel 4: the hat as a basket (resting on its floppy point, the mouth up), croquettes piled in it, the face croquette on the near brim;
  // once he has popped out of it, the hat on its side and three stars drifting out
  const hcHatX = () => FIN.wx + FIN.dir * 60;
  function hcBasket(c, pn, t, x, lw) {
    const W = W_(), ac = W.pal.accent, D = FIN.dir, popped = mgPopped(t), yB = -22, rB = 27, rO = 19;
    pn.world(c); c.save(); c.translate(x, 0); c.lineJoin = "round"; c.lineCap = "round";
    if (popped) {   // on its side, its mouth away from him: three stars drift out of it
      c.save(); c.translate(-D * 14, -rB + 2); c.rotate(D * (Math.PI / 2 - 0.22)); hcHat(c, HC_SIDE, lw, 0.5); c.restore();
      c.restore();
      const u = (t - MT.POP) / 700, mx = x + D * 15, my = -30;
      for (let i = 0; i < 3; i++) {
        const k = clamp(u - i * 0.2, 0, 1); if (k <= 0) continue;
        const sx = mx + D * (8 + 30 * k) * (1 - 0.25 * i), sy = my - (10 + 26 * k) * (0.5 + 0.35 * i) + Math.sin(k * 6 + i) * 2;
        c.globalAlpha = 1 - fe(0.65, 1, k); wizInkStar(c, sx, sy, 3.8 - i * 0.5, k * 3 + i, i === 1 ? PALE : GOLD, lw * 0.8); c.globalAlpha = 1;
      }
      return;
    }
    // the bowl of the hat (its cone, squashed on the ground) and the point flopped out to the side, curling up
    const body = () => { c.beginPath(); c.moveTo(-rO * 1.04, yB); c.quadraticCurveTo(-rO * 1.02, -3, -rO * 0.3, 0); c.lineTo(D * rO * 0.5, 0); c.quadraticCurveTo(D * (rO + 12), 1, D * (rO + 18), -10); c.quadraticCurveTo(D * (rO + 21), -16, D * (rO + 15), -15); c.quadraticCurveTo(D * (rO + 12), -6, D * rO * 0.85, -9); c.quadraticCurveTo(D * rO * 1.04, -14, D * rO * 1.04, yB); c.closePath(); };
    body(); c.fillStyle = ac; c.fill();
    c.save(); c.clip(); c.fillStyle = mix(ac, "#000000", 0.38); c.fillRect(-rO * 1.3, yB, rO * 2.6, 4.5);
    c.beginPath(); c.rect(D > 0 ? 3 : -40, -24, 37, 25); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(6, 0.4); c.fill(); c.restore(); c.restore();
    body(); c.lineWidth = lw * 1.2; c.strokeStyle = MG_INK; c.stroke();
    leaf(c, -D * 6, -11, 0.8, 0.4 * D);
    c.beginPath(); c.ellipse(0, yB, rB, 6, 0, 0, HC_TAU); c.fillStyle = mix(ac, "#000000", 0.12); c.fill(); c.lineWidth = lw * 1.2; c.stroke();
    c.beginPath(); c.ellipse(0, yB - 0.6, rO, 4.4, 0, 0, HC_TAU); c.fillStyle = mix(ac, "#000000", 0.72); c.fill(); c.lineWidth = lw; c.stroke();
    c.restore();
    // the croquettes standing in it like eggs, the face croquette on the near brim
    pn.world(c);
    const wob = Math.sin((t - MT.AFTER) * 0.012) * 0.04;
    for (const [px, py, a] of HC_PILE) hcCroq(c, x + D * px, py, D * a + wob, 0.88, lw);
    const fx = x - D * 19, fy = -27.5 + Math.sin(t * 0.01) * 0.4;
    hcCroq(c, fx, fy, -0.18 * D, 1.05, lw, { look: -D, shut: Math.abs(t - 5000) < 40 || Math.abs(t - 5180) < 35 });
    // a sparkle on the brim now and then
    const sp = ((t - MT.AFTER) / 520) % 1;
    if (t > MT.AFTER + 200) { c.globalAlpha = Math.sin(Math.PI * sp); wizInkStar(c, x + D * 22, -30 - 6 * sp, 3.4, sp * 2, PALE, lw * 0.7); c.globalAlpha = 1; }
  }
  function hcDrawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    // the night window in the upper corner, as on Starfall's panel 4
    const win = [[0.5, 0], [1.02, 0], [1.02, 0.78], [0.66, 0.56]].map(([a, b]) => [pn.x0 + mxu(a) * pn.w, pn.y0 + b * pn.h]);
    c.fillStyle = NIGHT; mgPoly(c, win); c.fill();
    c.save(); mgPoly(c, win); c.clip();
    c.fillStyle = WHT;
    for (const s of bgDots) { const x = pn.x0 + mxu(0.5 + s.u * 0.52) * pn.w, y = pn.y0 + s.v * 0.78 * pn.h; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.004 + s.ph); c.fillRect(x, y, s.r, s.r); }
    c.globalAlpha = 1; c.restore();
    c.save(); mgPoly(c, win); c.lineWidth = 3; c.strokeStyle = MG_INK; c.stroke(); c.restore();
    wizGround(c, pn, false);
    mgPuppet(c, pn, W, t, { sc: 1, tint: 0.3, tone: false, post: wizShade(dirAng(-0.8)) });   // in colour now
    crystalOver(c, pn, t);
    hcBasket(c, pn, t, hcHatX(), Math.max(1.1, 3 / pn.z));
  }

  S_.alt2 = Object.assign({}, S_, {
    name: "Hocus Croquettes",
    start(g) { S_.start(g); pota2 = true; hcGc = null; hcIn = 0; hcWob = 0; hcFall = null; hcFF = null; },
    end() { S_.end(); pota2 = false; hcGc = null; hcIn = 0; hcFall = null; hcFF = null; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = hcDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 118 : 100) * (1 - 0.05 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + FIN.dir * (lay.port ? 50 : 52), wy: -0.43 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: MG_PAPER, slide: MG.reduced ? 1 : 180, cam: hcCam, shake: hcShake, draw: hcDrawSplash }));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, hit = ws.find((w) => w.text === "KRISSH"), small = lay.port ? 0.62 : 1;
      const ms = lay.port ? Math.min(0.5, (0.86 * L.gw) / (8 * 0.15 * L.gh * 0.72)) : 1;
      if (hit) hit.t1 = MT.SPLASH + 150;   // the hit's word is gone as the splash comes in
      const sp = (t, x, y) => { const pn = MG.byId.splash; mgPlace(pn, t); return pn.sp(x, y); };
      const half = (txt, size, mul) => txt.length * size * L.gh * mul * 0.36;
      ws.push(
        { text: "ALAKAZAM", t0: MT.SPLASH + 10, t1: HC.POOF + 60, size: 0.15, mul: ms, arc: 6, jag: 0.06, fill: GOLD, rot: -0.05 * D,
          at: (t) => { const G = hcGeo(), pn = MG.byId.splash, hw = half("ALAKAZAM", 0.15, ms), q = sp(t, G.port ? G.x - D * 14 : G.wx0 - D * 24, 0); return [clamp(q[0], hw + 6, L.gw - hw - 6), pn.y0 + pn.h * (G.port ? 0.13 : 0.15) + pn.oy]; } },
        { text: "poof", t0: HC.POOF, t1: HC.POOF + 380, size: 0.07, mul: small, jit: 0.12, rot: 0.1 * D,
          at: (t) => { const G = hcGeo(); return sp(t, G.x + D * (G.rxB + 6), G.brimY - 24); } },
        { text: "ta-daa", t0: HC.TADA, t1: HC.BOW1 + 60, size: 0.07, mul: small, jag: 0.1, rot: -0.1 * D,
          at: (t) => { const G = hcGeo(), hw = half("ta-daa", 0.07, small), q = sp(t, G.wx1 - D * 6, G.wy - 104); return [clamp(q[0], hw + 6, L.gw - hw - 6), q[1]]; } },
        { text: "oops", t0: HC.OOPS, t1: HC.BOW1 + 60, size: 0.07, mul: small, jit: 0.14, rot: 0.12 * D,
          at: (t) => { const G = hcGeo(), hw = half("oops", 0.07, small), q = sp(t, G.x + D * (G.rxB + 18), G.port ? -46 : -40); return [clamp(q[0], hw + 6, L.gw - hw - 6), q[1]]; } },
      );
      return ws;
    },
    pose(P, sk, t, role, p) {
      if (hcIn === 2 && role === "l") return hcLPose(P, sk, t);
      const r = S_.pose(P, sk, t, role, p);
      if (role !== "w" || t < MT.SPLASH || t >= MT.AFTER) return r;
      // his face on the splash: a grin at the tap and the pull, eyes shut while the feet sink and for the bow, open-mouthed at the slip
      P.crouch = 0; P.exK = 1;
      if (t >= HC.OOPS && t < HC.BOW1) { P.expr = undefined; P.mouth = 0.55; }
      else if ((t >= HC.TAP + 200 && t < HC.POOF) || (t >= HC.BOW0 + 60 && t < HC.OOPS)) { P.expr = "calm"; P.mouth = t >= HC.BOW0 ? 0.3 : 0; }
      else { P.expr = "grin"; P.mouth = t >= HC.PULL0 && t < HC.PULL1 ? 0.35 : 0; }
      return r;
    },
    food() { const x = hcHatX(); return { x, y: 0, r: 24, y0: -28, lx: x + FIN.dir * 40 }; },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("hcUp", MT.SPLASH + 40, () => Cin.go(() => Cin.page()));
      cueOnce("hcTap", HC.TAP, () => Cin.go(() => { Cin.chime(2093); Cin.tick(3600); Cin.shimmer(1320, 0.9); }));
      cueOnce("hcWob", HC.WOB0 + 40, () => Cin.go(() => { for (let i = 0; i < 4; i++) Cin._osc("sine", 660 + (i % 2) * 120, 640 + (i % 2) * 120, 0.12, 0.05, 0.01, i * 0.11); }));
      cueOnce("hcSink", HC.SINK0 + 60, () => Cin.go(() => Cin._osc("sine", 1100, 260, 0.26, 0.08, 0.01)));
      cueOnce("hcPoof", HC.POOF, () => Cin.go(() => { Cin._noise(0.28, 0.32, 1200, 300, "lowpass"); Cin.chime(1568); }));
      cueOnce("hcReach", HC.REACH, () => Cin.go(() => Cin.whoosh(0.2, -0.3 * D, 0.3 * D, 0.16)));
      for (let i = 0; i < 6; i++) cueOnce("hcPull" + i, HC.PULL0 + i * HC.STEP, () => Cin.go(() => Cin.pluck(784 * Math.pow(1.122, i))));
      cueOnce("hcTada", HC.TADA, () => Cin.go(() => { Cin.chime(1047); Cin._osc("triangle", 1568, 1568, 0.45, 0.05, 0.01, 0.12); }));
      cueOnce("hcSlip", HC.SLIP, () => Cin.go(() => Cin._osc("sine", 700, 300, 0.2, 0.08, 0.005)));
      cueOnce("hcThud", HC.DOWN, () => Cin.go(() => { Cin._osc("sine", 180, 90, 0.12, 0.16, 0.003); Cin.tick(1400); }));
      cueOnce("hcBlink", 5000, () => Cin.go(() => Cin.tick(2900)));
    },
  });
  return S_;
})();
