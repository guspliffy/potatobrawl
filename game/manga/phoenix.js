/* ===================== Manga page: Phoenix, "Rebirth" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Phoenix, Rebirth"). Times are ms after the final hit.
   300 the freeze (panel 1, engine) . 1250 panel 2 "the look": a sun disc rises behind her, the wings spread and catch fire, 1700 her eyes snap white
   2000 inset on the loser's eyes (a sun in each pupil) . 2180 she shoots straight up through the top border of panel 2 . 2350 panel 3 "the strike": the loser alone,
   looking up, vertical speed lines; 2690-2900 the comet comes straight down the page (the one fast moment), 2900 the hit (impact frames, a six-pointed ink star),
   2990 the loser is launched burning along the real direction . 3500 panel 4: she crouches in the dust, wings cool from fire to ink, the grin, feathers settle.
   The Ultimate KO (Solar Dive), "Supernova": MANGA.phoenix.ulti extends this script (design: ultimates/fable-ultimate-pages.md section 3). The same page to 2690, then a bigger
   comet with a gold core and a tail to the top of the page, three impact frames (the gold one holds the star at 2x), the NOVA word, 3050 the loser leaves as ash (a black
   silhouette erased from the feet up, flakes along the launch direction), 3250 panel 5: the white page (a huge sun disc with 12 gold wedges, she stands wings full as a white
   silhouette with a gold edge, the ink bleeds back 3400-3800, a heap of ash with two eyes, ash falling), SUPERNOVA at 3600, 4700 panel 4 (the same aftermath, MT.AFTER + offset).
   Script fields: see game/manga/dragon.js. Everything here is prefixed phx / kept inside this closure. */
MANGA.phoenix = (function () {
  const COL = "#ff7a3d", MIDC = "#ffb45e", CORE = "#fff3c4", ASH = "#2c2933", ASH2 = "#57525f";
  const T = { LAUNCH: 2180, DIVE: 2650, LAND: 3000 };
  let spr = null, fth = [], spk = [], torn = false, topWY = -220, hitY = -64, cmt = null;
  let ult = false, ashF = [], inSplash = false;   // ult: this play is the Ultimate page (set by start())
  const SPL = () => MT.SPLASH || 3250;
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const wcol = () => { const W = W_(); return (W && W.pal && W.pal.accent) || COL; };
  // colour mixing that stays hex (the game's mix() returns rgb() strings, which it cannot read back)
  const phxMix = (a, b, k) => { const A = rgb(a), B = rgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
  const phxHalf = (txt, size, mul) => txt.length * size * L.gh * (mul || 1) * 0.36;
  const phxInk = (pn) => Math.max(1.3, 5.5 / pn.z);

  // a point of a puppet's skeleton (world units) at page time t
  function pt(p, t, key, sc) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot(P[key], P.hip, P.lean), s = sc || 1;
    return [p.x + p.facing * q[0] * s, p.y + q[1] * s];
  }
  // the transform of a puppet's body (feet origin, facing, the lean about the hip), so face details can be drawn exactly on the face
  function phxLocal(c, p, t) {
    MG.pt = t;
    const P = pose(p, mgTk(t));
    c.translate(p.x, p.y); c.scale(p.facing, 1);
    if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
    c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    return P;
  }

  /* ---- where the winner is: stands and lifts a little, shoots straight up out of panel 2, falls as a comet onto the loser, lands ---- */
  function wPos(t) {
    const W = W_(), D = FIN.dir, hh = W.s.h / 2, H0 = FIN.hit, ds = diveSc(t);
    if (t < T.LAUNCH) return [FIN.wx, -8 * ease(fe(1700, 2150, t)) - 1.3 * Math.sin(t * 0.004) * fe(1700, 2000, t)];
    if (t < T.DIVE) { const s = (t - T.LAUNCH) / 1000; return [FIN.wx, Math.max(-900, -8 - 2000 * s * s)]; }
    if (t < H0) { const k = Math.pow(fe(T.DIVE, H0, t), 1.06); return [FIN.lx - D * 4, lerp(topWY + 6, hitY, k) + hh * ds]; }
    if (t < T.LAND) { const k = easeOut(fe(H0, T.LAND, t)); return [FIN.lx - D * (4 + 6 * k), lerp(hitY + hh * DSC(), 0, k)]; }
    return [FIN.lx - D * 10, 0];
  }
  // her head where she stands (the sun and the glow stay put when she has shot up out of the panel)
  function restHead(t) {
    const W = W_(), ox = W.x, oy = W.y, [x, y] = wPos(Math.min(t, 2100)); W.x = x; W.y = y;
    const h = pt(W, Math.min(t, 2100), "head"); W.x = ox; W.y = oy; return h;
  }
  // she is bigger than life in the dive (scale about her feet) and shrinks back as she lands
  const DSC = () => (ult ? 1.4 : 1.28);
  const diveSc = (t) => (t < T.DIVE ? 1 : t < FIN.hit ? DSC() : lerp(DSC(), 1, easeOut(fe(FIN.hit, T.LAND, t))));
  const diving = (t) => t >= T.DIVE && t < FIN.hit + 90;
  const burstPt = () => [FIN.lx - FIN.dir * 6, -L_().s.h * 0.55];

  /* ---- panels ---- */
  function panels(lay) {
    const port = lay.port, D = FIN.dir;
    return [
      { id: "look", t0: MT.LOOK, from: "w", freeze: 2620, cover: MT.STRIKE,
        poly: port ? [[0, 0.03], [1, 0.01], [1, 0.5], [0, 0.53]] : [[0, 0.07], [0.43, 0.03], [0.47, 1], [0, 1]],
        cam: (t) => { const vh = 92 * (1 + 0.1 * ease(fe(MT.LOOK, MT.STRIKE, t))); return { wx: FIN.wx + D * 4, wy: -22 - vh * 0.5, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "l", slide: 140, live: true,
        poly: port ? [[0.14, 0.4], [0.98, 0.37], [0.98, 0.53], [0.14, 0.56]] : [[0.27, 0.6], [0.67, 0.56], [0.68, 0.88], [0.28, 0.92]],
        cam: (t) => { const h = pt(L_(), Math.min(t, MT.STRIKE), "head"); return { wx: h[0], wy: h[1] + 1, vh: port ? 34 : 29 - 4 * fe(MT.INSET, MT.STRIKE, t) }; },
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.AFTER, cover: MT.AFTER,
        poly: port ? [[0, 0.3], [1, 0.28], [1, 0.82], [0, 0.85]] : [[0, 0.31], [1, 0.27], [1, 1], [0, 1]],
        cam: (t) => { const k = fe(MT.STRIKE, MT.AFTER, t), vh = (port ? 240 : 132) * (1 - 0.05 * k); return { wx: FIN.lx + D * (port ? 10 : 52), wy: -(port ? 0.3 : 0.27) * vh, vh }; },
        shake: (t) => { const a = t >= FIN.hit ? 6 * (1 - fe(FIN.hit, FIN.hit + 260, t)) : 0; return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b", live: true,
        poly: port ? [[0, 0.7], [1, 0.68], [1, 1], [0, 1]] : [[0, 0.46], [1, 0.42], [1, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 112 : 84) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.lx - D * 10 + D * vh * (port ? 0.05 : 0.83), wy: -0.38 * vh, vh }; },
        draw: drawAfter },
    ];
  }

  /* ---- little shared drawing: dot tone through a path, ink-edged flame tongues, a 4-point glint, the six-pointed star ---- */
  // fill the path made by fn(c) (css px in the panel frame) with a dot screen that stays in device space like the engine's tone
  function phxTone(c, pn, size, cover, fn, drift, rule) {
    const pat = mgTile(size, cover);
    if (drift) mgDrift(pat, drift[0] * DPR, drift[1] * DPR);
    c.save(); c.setTransform(DPR, 0, 0, DPR, DPR * pn.ox, DPR * pn.oy); c.beginPath(); fn(c);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = pat; c.fill(rule || "nonzero"); c.restore();
  }
  function phxTongue(c, x, y, h, wd, lean, colr, core, ink) {
    if (ink) tongue(c, x, y + ink * 0.6, h + ink * 1.8, wd + ink, lean, MG_INK, null);
    tongue(c, x, y, h, wd, lean, colr, core);
  }
  function phxGlint(c, x, y, r, col) {
    c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r * 0.55, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r * 0.55, y); c.quadraticCurveTo(x, y, x, y - r);
    c.fillStyle = col || "#fff"; c.fill(); c.lineWidth = Math.max(1, r * 0.1); c.strokeStyle = MG_INK; c.lineJoin = "round"; c.stroke();
  }
  function phxStar6(c, x, y, R, rot, fill, ink, lw) {
    c.beginPath();
    for (let i = 0; i < 12; i++) { const r = i % 2 ? R * 0.36 : R * (i % 4 === 0 ? 1 : 0.9), a = rot + (i / 12) * Math.PI * 2; i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath(); c.lineJoin = "miter"; c.miterLimit = 6;
    if (ink) { c.lineWidth = lw; c.strokeStyle = ink; c.stroke(); }
    c.fillStyle = fill; c.fill();
  }

  /* ---- the big manga wings: a fan of flame feathers behind the puppet, from fire to ash. o: { spread 0..1, heat 0..1 (ash..fire), flame (tongue scale) } ---- */
  function phxWings(c, pn, p, t, o) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), sp = o.spread, dr = o.droop || 0, ink = phxInk(pn), ac = wcol();
    const base = phxMix(ASH, ac, o.heat), mid = phxMix(ASH2, phxMix(ac, "#ffd27a", 0.55), o.heat), core = phxMix("#7a7584", phxMix(ac, "#fff6d8", 0.8), o.heat);
    const a1 = rot([-P.w * 0.2, P.cy - P.ry * 0.2], P.hip, P.lean), a2 = rot([P.w * 0.05, P.cy - P.ry * 0.3], P.hip, P.lean);
    const sets = [
      { a: a1, ang: lerp(lerp(-2.3, -2.62, sp), -3.55, dr) + P.lean, L: P.w * lerp(1.15, 2.0, sp) * (1 - 0.2 * dr), n: 7, gap: lerp(0.2, 0.3, sp), dk: 0.22 },
      { a: a2, ang: lerp(lerp(-1.15, -0.55, sp), 0.5, dr) + P.lean, L: P.w * lerp(1.0, 1.75, sp) * (1 - 0.2 * dr), n: 6, gap: lerp(0.2, 0.3, sp), dk: 0 },
    ];
    c.save(); c.translate(p.x, p.y); c.scale(p.facing, 1); c.lineJoin = "round";
    for (const wg of sets) {
      const tips = [];
      for (let i = wg.n - 1; i >= 0; i--) {
        const m = i - (wg.n - 1) / 2, ang = wg.ang + m * wg.gap, L = wg.L * (1 - Math.abs(m) * 0.1) * (1 + 0.035 * Math.sin(t * 0.017 + i * 1.7 + wg.n)), wd = L * 0.19;
        const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca, ax = wg.a[0], ay = wg.a[1], tx = ax + ca * L, ty = ay + sa * L;
        const leaf = (k, w2) => { const l = L * k, ex = ax + ca * l, ey = ay + sa * l; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax + ca * l * 0.5 + nx * wd * w2, ay + sa * l * 0.5 + ny * wd * w2, ex, ey); c.quadraticCurveTo(ax + ca * l * 0.5 - nx * wd * w2 * 0.85, ay + sa * l * 0.5 - ny * wd * w2 * 0.85, ax, ay); };
        if (o.sil) { leaf(1, 1); c.fillStyle = o.sil; c.fill(); tips.push([tx, ty, i]); continue; }
        leaf(1, 1); c.fillStyle = wg.dk ? phxMix(base, "#000000", wg.dk) : base; c.fill(); c.lineWidth = ink; c.strokeStyle = MG_INK; c.stroke();
        leaf(0.84, 0.58); c.fillStyle = mid; c.fill();
        leaf(0.6, 0.28); c.fillStyle = core; c.fill();
        tips.push([tx, ty, i]);
      }
      if (o.flame > 0.02 && !o.sil) for (const [tx, ty, i] of tips) {
        const f = 0.7 + 0.3 * Math.sin(t * 0.03 + i * 2.1), h = (9 + (i % 3) * 3.5) * o.flame * f;
        phxTongue(c, tx, ty + 1, h, 2.6, Math.sin(t * 0.021 + i * 1.3) * 2.2, base, core, ink * 0.8);
      }
    }
    c.restore();
  }

  /* ---- panel 2: the look. The sun: a flat white disc, its rim in dots, 24 ink rays; the wings spread and catch fire; her eyes snap white at 1700 ---- */
  function phxSun(c, pn, t, hd) {
    const k = ease(fe(1250, 2150, t)), R = pn.h * (0.27 + 0.37 * k), cx = hd[0] - FIN.dir * pn.w * 0.02, cy = lerp(pn.y1 + R * 0.5, hd[1] - pn.h * 0.04, k);
    // the dawn: a screen of dots over the panel, driven back by the light
    phxTone(c, pn, 9, 0.2, (g) => g.rect(pn.x0 - 4, pn.y0 - 4, pn.w + 8, pn.h + 8), [t * 0.001, -t * 0.0007]);
    // 24 ink rays: wide at the sun, narrowing to a point
    const r0 = R * 1.1, far = Math.hypot(pn.w, pn.h) * 1.25, rt = t * 0.00016;
    c.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = rt + (i / 24) * Math.PI * 2, hb = i % 2 ? 0.032 : 0.058, tipR = i % 3 ? far : far * 0.78;
      c.moveTo(cx + Math.cos(a - hb) * r0, cy + Math.sin(a - hb) * r0); c.lineTo(cx + Math.cos(a) * tipR, cy + Math.sin(a) * tipR); c.lineTo(cx + Math.cos(a + hb) * r0, cy + Math.sin(a + hb) * r0); c.closePath();
    }
    c.fillStyle = MG_INK; c.fill();
    // the white halo, the disc with its rim in two hard dot bands
    c.beginPath(); c.arc(cx, cy, R * 1.1, 0, 7); c.fillStyle = MG_PAPER; c.fill();
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = "#ffffff"; c.fill();
    phxTone(c, pn, 7, 0.4, (g) => { g.arc(cx, cy, R * 0.96, 0, 7); g.arc(cx, cy, R * 0.8, 0, 7, true); }, [-t * 0.002, 0], "evenodd");
    phxTone(c, pn, 6, 0.7, (g) => { g.arc(cx, cy, R * 0.99, 0, 7); g.arc(cx, cy, R * 0.9, 0, 7, true); }, null, "evenodd");
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.lineWidth = Math.max(3, pn.h * 0.012); c.strokeStyle = MG_INK; c.stroke();
  }
  function drawLook(c, pn, t) {
    const W = W_(), R = Math.hypot(pn.w, pn.h), power = fe(1250, 2150, t), onPage = t < T.LAUNCH;
    pn.screen(c);
    const hd = pn.p(...restHead(t));
    phxSun(c, pn, t, hd);
    // embers rise off the wings
    for (const e of spk) {
      const u = ((t - 1250) * e.v + e.y0) % 1.15, a = fe(1350, 1700, t) * (1 - fe(T.LAUNCH, T.LAUNCH + 200, t));
      if (a <= 0.02 || u < 0) continue;
      const x = pn.x0 + (0.08 + e.x * 0.84) * pn.w + Math.sin(t * 0.004 + e.ph) * 7, y = pn.y1 - u * pn.h * 1.05, r = 1.4 + e.r * 2.6 * (1 - u * 0.5);
      c.globalAlpha = a; c.beginPath(); c.arc(x, y, r + 1.3, 0, 7); c.fillStyle = MG_INK; c.fill(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = e.hot ? CORE : COL; c.fill();
    }
    c.globalAlpha = 1;
    if (onPage) {
      phxWinner(c, pn, t, { light: dirAng(-1.4), spread: ease(fe(1300, 1900, t)), heat: 1, flame: 0.4 + 0.6 * power });
      phxEyes(c, pn, t);
    }
    // the edge of the page darkens as the power gathers: a 70% screen creeping in from the lower corners
    const q = fe(1500, 2150, t);
    if (q > 0.02) {
      const d = pn.w * 0.17 * q;
      phxTone(c, pn, 7, 0.55, (g) => { g.moveTo(pn.x0, pn.y1); g.lineTo(pn.x0 + d * 1.5, pn.y1); g.lineTo(pn.x0, pn.y1 - d * 1.3); g.closePath(); });
      phxTone(c, pn, 7, 0.55, (g) => { g.moveTo(pn.x1, pn.y1); g.lineTo(pn.x1 - d * 1.5, pn.y1); g.lineTo(pn.x1, pn.y1 - d * 1.3); g.closePath(); });
    }
    // 1700: the eyes snap open, white: a flash of the whole panel
    const fl = 0.75 * (1 - fe(1700, 1790, t)) * (t >= 1700 ? 1 : 0);
    if (fl > 0.01) { c.fillStyle = `rgba(255,255,255,${fl.toFixed(3)})`; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); }
  }
  // winner = wings + puppet (the one function every panel uses)
  function phxWinner(c, pn, t, o) {
    const W = W_();
    pn.world(c);
    phxWings(c, pn, W, t, o);
    mgPuppet(c, pn, W, t, { sc: 1, light: o.light, post: o.post, a: o.a, tone: o.tone, tint: 0.34 });
    pn.world(c);
  }
  // 1700: blank white eyes (no pupils), a glint on each
  function phxEyes(c, pn, t) {
    const k = fe(1700, 1760, t);
    if (k <= 0 || t >= T.LAUNCH) return;
    const W = W_(), s = 1 + 0.6 * (1 - easeOut(k)), ink = phxInk(pn) * 0.7;
    c.save(); pn.world(c);
    const P = phxLocal(c, W, t), er = P.w * 0.1, hx = P.head[0], hy = P.head[1];
    [hx - P.w * 0.14, hx + P.w * 0.13].forEach((ex, i) => {
      // a blank white almond: wide and narrow, the outer corner up
      const sg = i ? 1 : -1, w2 = er * 1.55 * s, h2 = er * 0.95 * s;
      c.save(); c.translate(ex, hy); c.rotate(-sg * 0.2);
      c.beginPath(); c.moveTo(-w2, 0); c.quadraticCurveTo(0, -h2 * 1.5, w2, 0); c.quadraticCurveTo(0, h2 * 1.15, -w2, 0); c.closePath();
      c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = ink * 1.3; c.lineJoin = "round"; c.strokeStyle = MG_INK; c.stroke();
      c.restore();
    });
    const g = fe(1700, 1820, t) * (1 - fe(1950, 2050, t));
    if (g > 0.05) { phxGlint(c, hx + P.w * 0.13 + er * 1.9, hy - er * 2.6, er * 2.6 * g); phxGlint(c, hx - P.w * 0.14 - er * 1.7, hy - er * 2.3, er * 1.7 * g); }
    c.restore();
  }

  /* ---- the inset: the loser's eyes, a sun growing in each pupil, light from above sweeping down the face ---- */
  function drawInset(c, pn, t) {
    const Lp = L_(), tt = Math.min(t, MT.STRIKE), lit = fe(MT.INSET, MT.STRIKE, t);
    pn.screen(c);
    const [fx, fy] = pn.p(...pt(Lp, tt, "head"));
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0005, 0.85);
    const edgeY = pn.y0 + pn.h * (0.1 + 1.1 * lit), sl = pn.w * 0.12;
    const lightPoly = (g, mulOx) => { const ox = mulOx ? pn.ox : 0, oy = mulOx ? pn.oy : 0; g.moveTo(pn.x0 - 10 + ox, pn.y0 - 10 + oy); g.lineTo(pn.x1 + 10 + ox, pn.y0 - 10 + oy); g.lineTo(pn.x1 + 10 + ox, edgeY - sl + oy); g.lineTo(pn.x0 - 10 + ox, edgeY + sl + oy); g.closePath(); };
    c.save(); c.globalAlpha = 0.32; c.fillStyle = COL; c.beginPath(); lightPoly(c, false); c.fill(); c.restore();
    mgPuppet(c, pn, Lp, tt, { sc: 1, light: dirAng(-1.45), tint: 0.14, tone: false, post: (lc, X) => {
      lc.save(); lc.setTransform(DPR, 0, 0, DPR, 0, 0); lc.beginPath(); lightPoly(lc, true); lc.clip(); lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.fillStyle = rgba(COL, 0.3); lc.fillRect(0, 0, MG.cw, MG.ch); lc.restore();
    } });
    // the sun in each pupil
    const P = pose(Lp, mgTk(tt)), w = P.w, er = w * 0.1, cos = Lp.spec.look.costume, g = easeOut(fe(2050, 2350, t));
    if (g > 0.02) {
      c.save(); pn.world(c); const lp = phxLocal(c, Lp, tt), ink = phxInk(pn) * 0.45;
      [lp.head[0] - w * 0.14, lp.head[0] + w * 0.13].forEach((ex, i) => {
        if (cos === "odin" && i === 0) return;
        const ey = lp.head[1], px_ = ex + er * 0.15, py_ = ey + er * 0.1;
        // the light of the sun in the iris: an accent ring, a pinpoint pupil, a white glint that grows
        c.beginPath(); c.arc(px_, py_, er * 0.78, 0, 7); c.arc(px_, py_, er * 0.3, 0, 7, true); c.globalAlpha = g; c.fillStyle = COL; c.fill("evenodd"); c.globalAlpha = 1;
        c.beginPath(); c.arc(px_, py_, er * 0.12, 0, 7); c.fillStyle = MG_INK; c.fill();
        c.beginPath(); c.arc(px_ + er * 0.42, py_ - er * 0.4, er * 0.34 * g, 0, 7); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = ink; c.strokeStyle = MG_INK; c.stroke();
      });
      c.restore();
    }
    // a sweat drop
    pn.screen(c);
    const sx = fx + (-FIN.dir) * pn.w * 0.2, sy = pn.y0 + pn.h * (0.2 + 0.5 * lit);
    c.beginPath(); c.moveTo(sx, sy - 11); c.quadraticCurveTo(sx + 8, sy + 3, sx, sy + 8); c.quadraticCurveTo(sx - 8, sy + 3, sx, sy - 11); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 2.6; c.strokeStyle = MG_INK; c.stroke();
  }

  /* ---- the world under panels 3 and 4: the slab as one flat ink shape, tufts of grass ---- */
  function ground(c, pn, t, crack) {
    pn.world(c);
    const x0 = FIN.wx - 420, x1 = FIN.wx + 420;
    c.fillStyle = MG_INK; c.fillRect(x0, 0, x1 - x0, 140);
    c.beginPath();
    for (let x = x0; x < x1; x += 13) { const h = 3 + ((x * 7919) % 5); c.moveTo(x, 0.5); c.lineTo(x + 2.5, -h); c.lineTo(x + 5.5, 0.5); }
    c.fill();
    if (crack > 0) {   // cracks in the slab, from the point of impact
      const b = burstPt(), r = mgRng(404);
      c.strokeStyle = MG_PAPER; c.lineWidth = Math.max(1.2, 3 / pn.z); c.lineCap = "round"; c.beginPath();
      for (let i = 0; i < 7; i++) {
        const dx = (i - 3) * 0.62 + (r() - 0.5) * 0.3, len = (28 + r() * 40) * easeOut(crack); let x = b[0], y = 2;
        c.moveTo(x, y); for (let j = 1; j <= 3; j++) { x = b[0] + dx * len * (j / 3) * 1.5 + (r() - 0.5) * 5; y = 2 + Math.abs(dx) * 8 * j + r() * 5 + len * 0.12 * j; c.lineTo(x, y); }
      }
      c.stroke();
    }
  }
  // the dust that goes out along the slab: overlapping puffs with one ink outline round the whole bank (outlines first, then the paper fills over the joins), shrinking away
  function dust(c, pn, x, k, a) {
    if (k <= 0 || a <= 0.02) return;
    const e = easeOut(k), sh = 0.3 + 0.7 * a, r0 = mgRng(12), puffs = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1, j = i >> 1, r = (13 - j * 1.1 + r0() * 3) * (0.45 + 0.55 * e) * sh;
      puffs.push([x + side * (4 + 11 * j + r0() * 4) * (0.2 + 0.8 * e), -r * 0.62 - r0() * 3, r]);
    }
    c.save(); c.lineWidth = Math.max(3, 6.5 / pn.z); c.strokeStyle = MG_INK; c.fillStyle = MG_PAPER;
    for (const [px, py, r] of puffs) { c.beginPath(); c.arc(px, py, r, 0, 7); c.stroke(); }
    for (const [px, py, r] of puffs) { c.beginPath(); c.arc(px, py, r - 0.3, 0, 7); c.fill(); }
    c.restore();
  }

  /* ---- the comet: a wedge of fire with her at its point ---- */
  // a flame wedge: tip at (x, y) pointing along `ang`, trailing back `len`, half-width `wd` near the tip; ink edge, accent body, pale core, tongues along the edges
  function phxWedge(c, x, y, ang, len, wd, t, sil, ink, core) {
    if (len < 4) return;
    const N = 14, ca = Math.cos(ang), sa = Math.sin(ang);
    const edge = (sgn, g) => {
      const o = [];
      for (let i = 0; i <= N; i++) {
        const s = i / N, h = wd * Math.pow(1 - s, 0.8) * Math.min(1, 0.2 + s * 7), fk = (1 + 0.13 * Math.sin(t * 0.03 + i * 2.1 + sgn)) * (i % 2 ? 1.2 : 0.88);
        const hh = i === 0 ? 0 : Math.max(0.5, h * fk * g), bx = x - ca * len * s, by = y - sa * len * s;
        o.push([bx - sa * hh * sgn, by + ca * hh * sgn]);
      }
      return o;
    };
    const poly = (g) => edge(1, g).concat(edge(-1, g).reverse());
    if (sil) { c.fillStyle = sil; mgPoly(c, poly(1)); c.fill(); return; }
    c.lineJoin = "miter"; c.lineWidth = ink; c.strokeStyle = MG_INK; c.fillStyle = COL; mgPoly(c, poly(1)); c.fill(); c.stroke();
    c.fillStyle = MIDC; mgPoly(c, poly(0.66)); c.fill();
    const a = edge(1, 0.3), b = edge(-1, 0.3).reverse(), q = a.slice(5, 12).concat(b.slice(b.length - 12, b.length - 5));
    c.fillStyle = core || "rgba(255,243,196,0.95)"; mgPoly(c, q); c.fill();
    // tongues streaming off the edges, backwards
    for (let i = 1; i <= 5; i++) for (const sgn of [1, -1]) {
      const s = i / 6.5, h = wd * Math.pow(1 - s, 0.8) * Math.min(1, 0.2 + s * 7) * 0.92, bx = x - ca * len * s - sa * h * sgn, by = y - sa * len * s + ca * h * sgn;
      c.save(); c.translate(bx, by); c.rotate(Math.atan2(-ca, sa) + sgn * 0.18);
      phxTongue(c, 0, 0, Math.min(len, 230) * 0.13 * (0.7 + 0.3 * Math.sin(t * 0.04 + i * 3 + sgn)), 2.4 + wd * 0.04, 0, COL, MIDC, ink * 0.35);
      c.restore();
    }
  }
  // the comet's state at page time t: where its point is, how long its tail is
  function comet(t) {
    if (t < T.DIVE || t >= T.LAND + 60) return null;
    const W = W_(), [x, y] = wPos(t), hh = W.s.h / 2 * diveSc(t);
    const tipY = y - hh + hh * 0.85, len = (ult ? Math.max(210, tipY - topWY + 24) : 210) * (1 - easeIn(fe(FIN.hit, FIN.hit + 150, t))) * easeOut(fe(T.DIVE, T.DIVE + 120, t));
    return { x, cy: y - hh, tipY, len };
  }
  // the winner's dive: spin so that her face leads, arms and feet swept back
  const DIVE_SPIN = 3.0;
  function phxComet(c, pn, t, sil) {
    const cm = comet(t), W = W_();
    if (!cm) return;
    pn.world(c);
    const wd = W.s.w * 0.92 * diveSc(t), ink = Math.max(2, 5.5 / pn.z);
    phxWedge(c, cm.x, cm.tipY, Math.PI / 2, cm.len, wd, t, sil, ink, ult ? MG_GOLD : null);
    if (sil) return;
    // the smear: two earlier copies of her above
    if (!MG.slow && t < FIN.hit + 20) for (const [dt, al] of [[60, 0.16], [30, 0.34]]) {
      const ox = W.x, oy = W.y, [gx, gy] = wPos(t - dt); W.x = gx; W.y = gy;
      mgPuppet(c, pn, W, t - dt, { sc: DSC(), a: al, tone: false, light: dirAng(-1.57) });
      W.x = ox; W.y = oy;
    }
    mgPuppet(c, pn, W, t, { sc: diveSc(t), light: dirAng(-1.57), tint: 0.26 });
  }

  /* ---- panel 3: the strike ---- */
  function drawStrike(c, pn, t) {
    const W = W_(), Lp = L_(), H0 = FIN.hit, D = FIN.dir;
    pn.screen(c);
    // behind: a dark sky of cut dot bands (darkest at the top) that deepens as the light gathers, white speed lines falling through it, a glint that grows
    const k1 = fe(MT.STRIKE, H0, t), sl = pn.h * 0.06 * D, lx = pn.p(FIN.lx - D * 4, 0)[0];
    let prev = 0;
    [[0.13, 1], [0.24, 0.74], [0.36, 0.52], [0.48, 0.3]].forEach(([e, cov], i) => {
      const e0 = prev, e1 = pn.h * (e + 0.08 * k1); prev = e1;
      phxTone(c, pn, 7, cov, (g) => { g.moveTo(pn.x0 - 4, pn.y0 + e0 - sl); g.lineTo(pn.x1 + 4, pn.y0 + e0 + sl); g.lineTo(pn.x1 + 4, pn.y0 + e1 + sl); g.lineTo(pn.x0 - 4, pn.y0 + e1 - sl); g.closePath(); }, [t * 0.001, 0]);
    });
    const gl = fe(2450, T.DIVE, t) * (t < H0 ? 1 : 0);
    if (gl > 0.02) mgFocus(c, lx, pn.y0 - pn.h * 0.05, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0004, 0.8 * gl, true);
    const va = fe(2500, 2800, t) * (1 - fe(H0, H0 + 60, t));
    mgSpeed(c, pn.cx, pn.y0 + pn.h * 0.26, pn.h * 0.52, pn.w, Math.PI / 2, t * 0.9, 0.9 * va, true, 2.2);
    mgSpeed(c, pn.cx, pn.y0 + pn.h * 0.72, pn.h * 0.56, pn.w, Math.PI / 2, t * 0.9, 0.8 * va, false, 2.2);
    if (gl > 0.02) phxGlint(c, lx, pn.y0 + pn.h * (0.1 + 0.04 * gl), pn.h * (0.03 + 0.17 * gl), COL);
    const hp = pn.p(...burstPt());
    if (t >= H0) mgFocus(c, hp[0], hp[1], Math.hypot(pn.w, pn.h), t * 0.0006, 0.75 * (1 - 0.5 * fe(H0, 3300, t)));
    ground(c, pn, t, t >= H0 ? fe(H0, H0 + 200, t) : 0);
    pn.world(c);
    // the six-pointed star-burst, in ink, that holds
    if (t >= H0) {
      const [bx, by] = burstPt(), k = easeOut(fe(H0, H0 + 110, t)), R = 108 * k, wob = 1 + 0.025 * Math.sin(t * 0.02);
      phxStar6(c, bx, by, R * wob, 0.3 + t * 0.00022, MG_INK, MG_PAPER, Math.max(2, 7 / pn.z));
      phxStar6(c, bx, by, R * 0.7 * wob, 0.3 + t * 0.00022, "#ffffff", null);
      phxStar6(c, bx, by, R * 0.34, 0.3 + t * 0.00022 + 0.26, COL, MG_INK, Math.max(1.4, 3.4 / pn.z));
      dust(c, pn, FIN.lx - D * 6, fe(H0 + 60, 3300, t), 1 - fe(3100, 3500, t));
    }
    // the loser: stands looking up (until it bursts through the border)
    if (!MG.broke) S_.drawLoser(c, pn, t);
    pn.world(c);
    // after the dive she is here, in the dust
    if (t >= T.LAND && t < MT.AFTER) {   // (panel 4 shows her close up: the frozen strike panel keeps only the star)
      const heat = 1, sp = lerp(0.55, 0.45, fe(T.LAND, MT.AFTER, t));
      phxWinner(c, pn, t, { light: dirAng(-1.57), spread: sp, heat, flame: 0.8 });
    }
  }

  /* ---- the loser: stands, looks up, is hit, is launched burning along the real direction ---- */
  function loserAt(tt) {
    if (tt < FIN.launch) return [FIN.lx - (tt >= FIN.hit ? FIN.dir * 5 : 0), 0];
    const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr];
  }
  function drawLoserFn(c, pn, t) {
    const Lp = L_(), ang = Math.atan2(FIN.ldy, FIN.ldx), fl = t >= FIN.launch, burn = fe(FIN.hit, FIN.launch + 60, t);
    const hh = Lp.s.h * 0.5, bo = FIN.beam ? 1 - fe(FIN.beam.t0, FIN.beam.t0 + 150, t) : 1;
    if (ult && fl) { phxAshLoser(c, pn, t); return; }   // the Ultimate: no fire, the loser leaves as ash
    c.save(); pn.world(c);
    // the tail of fire behind the flying loser
    if (fl && bo > 0.02) {
      const len = 150 * easeOut(fe(FIN.launch, FIN.launch + 140, t)) * bo;
      phxWedge(c, Lp.x, Lp.y - hh, ang + Math.PI, len, Lp.s.w * 0.95, t, null, Math.max(2, 5 / pn.z));
    }
    c.restore();
    if (FIN.out || Lp.state === "gone") return;
    const base = { sc: 1, light: dirAng(-1.57) };
    if (fl && !MG.slow) for (const dt of [66, 44, 22]) {
      const [gx, gy] = loserAt(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
      mgPuppet(c, pn, Lp, t - dt, Object.assign({}, base, { a: 0.3 - dt * 0.0025, wash: [COL, 0.7], tone: false }));
      Lp.x = ox; Lp.y = oy;
    }
    const wash = burn > 0 ? [COL, 0.55 * burn] : null;
    mgPuppet(c, pn, Lp, t, Object.assign({}, base, { wash, tint: 0.4, flash: Lp.flash > 0 }));
    // flames licking round the body
    if (burn > 0.05) {
      c.save(); pn.world(c);
      const cx = Lp.x, cy = Lp.y - hh, back = fl ? ang + Math.PI : -Math.PI / 2, ink = Math.max(1.6, 4.2 / pn.z);
      for (let i = 0; i < 7; i++) {
        const a = back + (i - 3) * (fl ? 0.5 : 0.62), r = Lp.s.w * 0.5, h = (13 + 9 * Math.sin(t * 0.04 + i * 2.4)) * burn;
        c.save(); c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.1); c.rotate(a + Math.PI / 2);
        phxTongue(c, 0, 0, h, 3.8, Math.sin(t * 0.03 + i) * 2, COL, CORE, ink * 0.7); c.restore();
      }
      c.restore();
    }
  }

  /* ---- panel 4: the aftermath ---- */
  function drawAfter(c, pn, t) {
    const W = W_(), u = fe(MT.AFTER, MT.END, t), D = FIN.dir;
    pn.screen(c);
    const hd = pn.p(...pt(W, t, "head"));
    // a white halo and a ring of dots behind her, then the focus lines
    const R = pn.h * 0.62;
    // dots only where the page is not busy: the two ends of the wide panel
    phxTone(c, pn, 8, 0.3, (g) => { g.moveTo(pn.x0 - 3, pn.y0 - 3); g.lineTo(pn.x0 + pn.w * 0.26, pn.y0 - 3); g.lineTo(pn.x0 + pn.w * 0.17, pn.y1 + 3); g.lineTo(pn.x0 - 3, pn.y1 + 3); g.closePath(); });
    phxTone(c, pn, 8, 0.3, (g) => { g.moveTo(pn.x1 + 3, pn.y0 - 3); g.lineTo(pn.x1 - pn.w * 0.26, pn.y0 - 3); g.lineTo(pn.x1 - pn.w * 0.17, pn.y1 + 3); g.lineTo(pn.x1 + 3, pn.y1 + 3); g.closePath(); });
    c.beginPath(); c.arc(hd[0], hd[1], R, 0, 7); c.fillStyle = MG_PAPER; c.fill();
    mgFocus(c, hd[0], hd[1], Math.hypot(pn.w, pn.h) * 0.95, t * 0.0003, 0.55);
    c.beginPath(); c.arc(hd[0], hd[1], R * 0.82, 0, 7); c.fillStyle = "#ffffff"; c.fill();
    ground(c, pn, t, 1);
    pn.world(c);
    const A = MT.AFTER;
    dust(c, pn, W.x, fe(A, A + 600, t), 1 - fe(A + 400, A + 800, t));
    const heat = 1 - ease(fe(A, A + 400, t));
    phxWinner(c, pn, t, { light: dirAng(-0.8), spread: 0.7, droop: ease(fe(A + 100, A + 450, t)), heat, flame: heat * 0.8 });
    // smoke curls off the cooling wings: tone puffs rising and fading
    pn.screen(c);
    if (heat < 0.98) for (let i = 0; i < 4; i++) {
      const q = ((t - (A + 60) - i * 120) / 700), a = (1 - q) * (q > 0 && q < 1 ? 1 : 0) * 0.9; if (a <= 0.02) continue;
      const px = hd[0] - D * (pn.w * (0.12 + 0.05 * i)) + Math.sin(q * 5 + i) * 7, py = hd[1] - pn.h * (0.05 + 0.5 * q), r = 7 + 12 * q;
      c.globalAlpha = a; c.beginPath(); c.arc(px, py, r, 0, 7); c.fillStyle = MG_PAPER; c.fill(); c.lineWidth = 2.2; c.strokeStyle = MG_INK; c.stroke();
      phxTone(c, pn, 5, 0.45, (g) => g.arc(px + r * 0.25, py + r * 0.2, r * 0.7, 0, 7)); c.globalAlpha = 1;
    }
  }

  /* ---- the Ultimate: the loser leaves as ash ---- */
  // a black silhouette, erased from the trailing end forward (the feet, for a launch straight up) by a plane that sweeps the body 3050-3300 along the launch direction
  function phxAshLoser(c, pn, t) {
    const Lp = L_(), k = easeOut(fe(FIN.launch, FIN.launch + 250, t));
    if (k >= 1 || FIN.out || Lp.state === "gone") return;
    const al = Math.hypot(FIN.ldx, FIN.ldy) || 1, dx = FIN.ldx / al, dy = FIN.ldy / al, px = -dy, py = dx, hh = Lp.s.h * 0.5, R = hh * 1.25;
    const cx = Lp.x, cy = Lp.y - hh, s = -R + 2 * R * k, B = 420;   // kept: the points whose offset from the centre along d is at least s
    c.save(); pn.world(c);
    c.beginPath();
    c.moveTo(cx + dx * s + px * B, cy + dy * s + py * B); c.lineTo(cx + dx * s - px * B, cy + dy * s - py * B);
    c.lineTo(cx + dx * (s + B) - px * B, cy + dy * (s + B) - py * B); c.lineTo(cx + dx * (s + B) + px * B, cy + dy * (s + B) + py * B);
    c.closePath(); c.clip();
    mgPuppet(c, pn, Lp, t, { sc: 1, sil: "#000000" });
    c.restore();
  }
  // 60 ash flakes (2-4 px squares), born on the body while the plane sweeps it, streaming off along the launch direction and slowing down; drawn over the page (css px, o is in the page transform)
  function phxAshFlakes(o, t) {
    if (!ult || !ashF.length || t < FIN.launch || t > FIN.launch + 720) return;
    const pn = MG.byId[S_.flight], hh = L_().s.h * 0.5, al = Math.hypot(FIN.ldx, FIN.ldy) || 1, dx = FIN.ldx / al, dy = FIN.ldy / al, px = -dy, py = dx;
    for (let i = 0; i < ashF.length; i++) {
      if (MG.slow && (i & 1)) continue;
      const f = ashF[i], tau = (t - (FIN.launch + f.tb)) / 1000;
      if (tau < 0 || tau > f.life) continue;
      const [lx, ly] = loserAt(FIN.launch + f.tb), s = f.v * 0.4 * (1 - Math.exp(-tau / 0.4)), fan = f.lat * s * 0.5;
      const wx = lx + dx * (s + f.a * hh) + px * (fan + f.b * 20), wy = ly - hh + dy * (s + f.a * hh) + py * (fan + f.b * 20) + 150 * tau * tau;
      const [sx, sy] = pn.sp(wx, wy), a = Math.pow(1 - tau / f.life, 0.7);
      if (sx < -8 || sx > L.gw + 8 || sy < -8 || sy > L.gh + 8) continue;
      o.globalAlpha = a * 0.8; o.fillStyle = "#f1ece2"; o.fillRect(sx - f.z / 2 - 1, sy - f.z / 2 - 1, f.z + 2, f.z + 2);   // a paper edge, so the grey squares read on the dark sky
      o.globalAlpha = a; o.fillStyle = f.dk ? ASH : ASH2; o.fillRect(sx - f.z / 2, sy - f.z / 2, f.z, f.z);
    }
    o.globalAlpha = 1;
  }

  /* ---- the Ultimate, panel 5: the white page ---- */
  // where she stands on the white page, and where the camera looks (between her and the loser's heap)
  const splDx = () => (L.portrait ? 24 : 46);
  const splX = () => FIN.lx - FIN.dir * splDx();
  // the sun: centred on her landing point (the ground under her), a huge rising sun that fills the page
  function phxSunGeo(pn, t) {
    const [cx, cy] = pn.p(splX(), 0), t0 = SPL(), grow = 0.8 + 0.2 * easeOut(fe(t0, t0 + 260, t));
    return { cx, cy, R: Math.min(pn.h * 0.72, pn.w * 0.95) * grow };
  }
  // the heap of ash where the loser stood, two eyes in it that open at 3800 and blink at 4100 and 4500
  function phxHeap(c, pn, t) {
    const k = easeOut(fe(SPL() + 80, 3880, t));
    if (k <= 0.01) return;
    const x = FIN.lx, w = 16 * k, h = 12 * k, ink = Math.max(1.6, 4 / pn.z), D = FIN.dir;
    pn.world(c);
    c.beginPath(); c.moveTo(x - w, 0.5);
    c.bezierCurveTo(x - w * 0.95, -h * 0.5, x - w * 0.5, -h * 0.85, x - w * 0.12, -h);
    c.bezierCurveTo(x + w * 0.14, -h * 1.12, x + w * 0.52, -h * 0.72, x + w * 0.66, -h * 0.5);
    c.bezierCurveTo(x + w * 0.88, -h * 0.3, x + w * 1.0, -h * 0.12, x + w, 0.5); c.closePath();
    c.fillStyle = ASH2; c.fill(); c.lineWidth = ink; c.lineJoin = "round"; c.strokeStyle = MG_INK; c.stroke();
    c.save(); c.clip(); c.fillStyle = ASH; c.beginPath(); c.moveTo(x - w * 1.1, 1); c.lineTo(x - w * 1.1, -h * 0.28); c.lineTo(x + w * 1.1, -h * 0.4); c.lineTo(x + w * 1.1, 1); c.fill(); c.restore();
    c.fillStyle = MG_INK; for (const [fx, fy, fr] of [[-0.55, -0.32, 0.7], [0.4, -0.2, 0.55], [0.1, -0.88, 0.5], [0.68, -0.4, 0.45]]) { c.beginPath(); c.arc(x + w * fx, h * fy, fr * k * 1.1, 0, 7); c.fill(); }
    const op = fe(3800, 3900, t);
    if (op > 0) {
      const closed = (t >= 4100 && t < 4175) || (t >= 4500 && t < 4575), er = 2.7 * k;
      for (const sg of [-1, 1]) {
        const ex = x + sg * w * 0.3, ey = -h * 0.58;
        if (closed) { c.beginPath(); c.moveTo(ex - er, ey); c.quadraticCurveTo(ex, ey + er * 0.55, ex + er, ey); c.lineWidth = ink * 0.9; c.lineCap = "round"; c.strokeStyle = MG_INK; c.stroke(); continue; }
        c.beginPath(); c.ellipse(ex, ey, er, er * 1.2 * op, 0, 0, 7); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = ink * 0.75; c.strokeStyle = MG_INK; c.stroke();
        c.beginPath(); c.arc(ex - D * er * 0.32, ey + er * 0.1, er * 0.5, 0, 7); c.fillStyle = MG_INK; c.fill();
        c.beginPath(); c.arc(ex - D * er * 0.1, ey - er * 0.25, er * 0.17, 0, 7); c.fillStyle = "#ffffff"; c.fill();
      }
    }
  }
  // she stands, wings full: a white silhouette with a gold edge (a second print, 3 px off), then the ink bleeds back (3400-3800): the silhouette turns to colour.
  // The picture of the fighter is a big layer blit, so every pass gets a tight box (her own size, not the 200 x 139 units of a spear fighter) and the silhouettes stop once they are faint.
  const SPL_BOX = [-54, -86, 54, 6];
  function phxStand(c, pn, t, bleed) {
    const W = W_(), ox = W.x, oy = W.y, off = 3 / pn.z, gold = bleed < 0.8, white = bleed < 0.94;
    W.x = splX(); W.y = 0; inSplash = true;
    try {
      if (white) {
        pn.world(c);
        if (gold) { W.x += off; W.y += off; c.globalAlpha = 1 - bleed; phxWings(c, pn, W, t, { spread: 1, heat: 1, flame: 0, sil: MG_GOLD }); c.globalAlpha = 1; W.x -= off; W.y -= off; }
        phxWings(c, pn, W, t, { spread: 1, heat: 1, flame: 0, sil: "#ffffff" });
      }
      if (bleed > 0) { pn.world(c); c.globalAlpha = bleed; phxWings(c, pn, W, t, { spread: 1, heat: 1, flame: 1 }); c.globalAlpha = 1; }
      if (gold) { W.x += off; W.y += off; mgPuppet(c, pn, W, t, { sc: 1, sil: MG_GOLD, a: 1 - bleed, box: SPL_BOX }); W.x -= off; W.y -= off; }
      if (white) mgPuppet(c, pn, W, t, { sc: 1, sil: "#ffffff", box: SPL_BOX });
      if (bleed > 0) mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-1.2), tint: 0.32, a: bleed, box: SPL_BOX });
    } finally { W.x = ox; W.y = oy; c.globalAlpha = 1; inSplash = false; }
  }
  function drawSplash(c, pn, t) {
    const bleed = fe(3400, 3800, t), sg = phxSunGeo(pn, t), cx = sg.cx, cy = sg.cy, R = sg.R;
    pn.screen(c);
    c.fillStyle = bleed > 0.001 ? phxMix("#ffffff", MG_GOLD_PALE, bleed) : "#ffffff"; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4);
    // 12 gold wedges, wide at the rim, narrowing to a point (half transparent), turning slowly; then the disc with its gold ring (2% of the page height)
    const far = Math.hypot(pn.w, pn.h) * 1.3, rt = t * 0.00012;
    c.globalAlpha = 0.5; c.fillStyle = MG_GOLD; c.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = rt + (i / 12) * Math.PI * 2, hb = i % 2 ? 0.075 : 0.12;
      c.moveTo(cx + Math.cos(a - hb) * R, cy + Math.sin(a - hb) * R); c.lineTo(cx + Math.cos(a) * far, cy + Math.sin(a) * far); c.lineTo(cx + Math.cos(a + hb) * R, cy + Math.sin(a + hb) * R); c.closePath();
    }
    c.fill(); c.globalAlpha = 1;
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = "#ffffff"; c.fill();
    const rw = pn.h * 0.02;
    c.lineWidth = rw; c.strokeStyle = MG_GOLD; c.stroke();
    c.lineWidth = 2; c.strokeStyle = MG_INK; c.beginPath(); c.arc(cx, cy, R + rw / 2, 0, 7); c.stroke(); c.beginPath(); c.arc(cx, cy, R - rw / 2, 0, 7); c.stroke();
    ground(c, pn, t, 0);
    phxHeap(c, pn, t);
    phxStand(c, pn, t, bleed);
  }
  const phxSplashPanel = (port) => mgSplashPanel({ from: "b", paper: "#ffffff", dim: "120,80,6",
    cam: (t) => ({ wx: splX() + FIN.dir * splDx() * 0.35, wy: -W_().s.h * 0.55 - (port ? 190 : 104) * 0.06, vh: (port ? 190 : 104) * (1 + 0.06 * fe(SPL(), MT.AFTER, t)) }), draw: drawSplash });

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "Rebirth", hit: 2900, flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "FWOOSH" : heavy ? "DOOM" : "KRAK", D = FIN.dir, mul = lay.port ? 0.5 : 1;
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike;
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.24, mul, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        { text: "FWAAA", t0: 1420, t1: 2330, size: 0.2, mul, arc: 7, rot: -0.1 * D, stretch: { ang: -Math.PI / 2, k: 0.3 }, at: (t) => { const p = P2(), k = fe(1420, 2300, t), hw = phxHalf("FWAAA", 0.2, mul); return [clamp(p.x0 + p.w * (FIN.dir > 0 ? 0.86 : 0.14), hw + 4, L.gw - hw - 4), p.y0 + p.h * (0.4 - 0.08 * k)]; } },
        { text: "SHAAA", t0: 2660, t1: 3140, size: 0.2, mul, jag: 0.1, rot: 0.04 * D, stretch: { ang: Math.PI / 2, k: 1.3 }, at: () => { const p = P3(), q = p.sp(FIN.lx - D * 4, 0), hw = phxHalf("SHAAA", 0.2, mul); return [clamp(q[0] + D * L.gw * (lay.port ? 0.2 : 0.27), hw + 4, L.gw - hw - 4), p.y0 + p.h * 0.36]; } },
        { text: "DOOOM", t0: FIN.hit + 95, t1: 3560, size: 0.24, mul, arc: 9, rot: -0.07 * D, at: () => { const p = P3(), hw = phxHalf("DOOOM", 0.24, mul); return [clamp(p.cx - D * p.w * 0.06, hw + 4, L.gw - hw - 4), p.y0 + p.h * 0.2 + p.oy]; } },
      ];
    },
    // the loser's stand-in is a copy of a doomed fighter, which draws it half see-through and blinking: here it is solid
    start() { ult = false; spr = null; fth = []; spk = []; ashF = []; inSplash = false; const Lp = L_(); if (Lp) Lp.doomed = false; },
    end() { spr = null; fth = []; spk = []; ashF = []; },
    build(lay) {
      const r = mgRng(31415), g = L.gw, h = L.gh, port = lay.port;
      torn = false; cmt = null;
      spk = Array.from({ length: 24 }, () => ({ x: r(), y0: r(), v: 0.00045 + r() * 0.00035, ph: r() * 6.28, r: r(), hot: r() < 0.35 }));
      // feather sprites: white with a dot-shaded half, accent, ink
      const fl = clamp(h * 0.085, 24, 56), mk = (kind) => {
        const w = fl * 1.35, hh = fl * 0.7, cv = mgCanvas(w * DPR, hh * DPR), x = cv.getContext("2d"), wd = fl * 0.2;
        x.scale(DPR, DPR); x.translate(w / 2, hh / 2);
        x.beginPath(); x.moveTo(-fl / 2, 0); x.quadraticCurveTo(-fl * 0.05, -wd * 1.4, fl / 2, 0); x.quadraticCurveTo(-fl * 0.05, wd * 1.2, -fl / 2, 0); x.closePath();
        x.fillStyle = kind === 1 ? COL : kind === 2 ? MG_INK : "#f7f3ea"; x.fill();
        x.save(); x.clip();
        if (kind === 0) { x.fillStyle = MG_INK; for (let i = -6; i <= 6; i++) for (let j = 0; j <= 3; j++) { x.beginPath(); x.arc(i * 3 + (j % 2) * 1.5, 1 + j * 2.7, 0.95, 0, 7); x.fill(); } }
        if (kind === 1) { x.fillStyle = MIDC; x.beginPath(); x.ellipse(fl * 0.08, 0, fl * 0.3, wd * 0.5, 0, 0, 7); x.fill(); }
        x.restore();
        x.strokeStyle = kind === 2 ? "#f1ece2" : MG_INK; x.lineWidth = 1; x.beginPath(); x.moveTo(-fl / 2, 0); x.lineTo(fl * 0.42, 0); x.stroke();
        x.beginPath(); x.moveTo(-fl / 2, 0); x.quadraticCurveTo(-fl * 0.05, -wd * 1.4, fl / 2, 0); x.quadraticCurveTo(-fl * 0.05, wd * 1.2, -fl / 2, 0); x.closePath(); x.lineWidth = 1.7; x.strokeStyle = MG_INK; x.stroke();
        return { cv, w, h: hh };
      };
      spr = [mk(0), mk(1), mk(2)];
      // ambient feathers drifting down the whole page, and the burst that scatters when she shoots up
      fth = [];
      const n = port ? 22 : 15;
      for (let i = 0; i < n; i++) fth.push({ kind: i % 5 === 4 ? 1 : i % 3 === 2 ? 2 : 0, x0: r() * g, y0: r() * h, vy: 16 + r() * 22, sw: 8 + r() * 16, ph: r() * 6.28, w: 0.7 + r() * 1.1, tilt: r() * 6.28, sc: 0.8 + r() * 0.5, burst: false, t0: 700 });
      for (let i = 0; i < 18; i++) fth.push({ kind: i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : 2, a: -Math.PI / 2 + (r() - 0.5) * 2.9, sp: 330 + r() * 420, ph: r() * 6.28, w: 0.8 + r() * 1.4, tilt: r() * 6.28, sc: 0.8 + r() * 0.6, burst: true, t0: T.LAUNCH + r() * 90 });
      // the geometry the comet needs: the top of the screen and the loser's head, in the strike panel's world
      const pn = MG.byId.strike; mgPlace(pn, 2800);
      topWY = pn.wy - (pn.cy + pn.py + pn.oy) / pn.z - 6;
      hitY = -L_().s.h * 0.95;
      pn.ox = pn.oy = 0;
      if (!ult) return;
      // the Ultimate: ash falls over the white page like the feathers (kind 3: 2-4 px squares), and 60 flakes stream off the loser along the launch direction
      const na = MG.slow ? 18 : 36;
      for (let i = 0; i < na; i++) fth.push({ kind: 3, x0: r() * g, y0: r() * h * 0.45, vy: 40 + r() * 60, sw: 5 + r() * 12, ph: r() * 6.28, w: 0.8 + r() * 1.2, tilt: r() * 6.28, sc: 1, sz: 2 + r() * 2, burst: false, t0: SPL() + 40 + r() * 500 });
      ashF = [];
      for (let i = 0; i < 60; i++) ashF.push({ tb: 160 * Math.pow(r(), 1.3), v: 110 + r() * 330, a: (r() - 0.5) * 1.6, b: (r() - 0.5) * 2, lat: (r() - 0.5) * 2, life: 0.3 + r() * 0.22, z: 2 + Math.round(r() * 2), dk: r() < 0.55 });
    },
    step(t, k) {
      const W = W_(), Lp = L_();
      MG.pt = t;
      const [x, y] = wPos(t); W.x = x; W.y = y;
      // 2180: she shoots up through the top border of panel 2: the border tears (once)
      if (!torn && t >= T.LAUNCH + 60) {
        const pn = MG.byId.look; mgPlace(pn, t);
        const head = pn.p(x, y - W.s.h);
        if (head[1] < pn.y0 + 4) { torn = true; mgTear(pn, pn.p(x, y)[0], pn.y0, W.s.w * pn.z * 1.25, t, COL); }
      }
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, H0 = FIN.hit;
      if (role === "w") {
        const open = ease(fe(1300, 1900, t)), landed = t >= T.LAND;
        P.wingUp = open * 0.5; P.flap = 0.1 + Math.sin(t * 0.006) * 0.06;
        P.lean = -0.3 * ease(fe(1250, 1700, t));
        P.mouth = 0;
        if (ult && inSplash) {   // the white page: she stands tall, arms up in a V, wings full, eyes closed and calm
          P.wingUp = 0.9; P.flap = 0.1 + Math.sin(t * 0.004) * 0.05; P.lean = -0.1 + 0.03 * Math.sin(t * 0.003); P.expr = "calm"; P.exK = 1;
          return { hF: [w * 0.82, -leg - tor * 0.8], hB: [-w * 0.8, -leg - tor * 0.74] };
        }
        P.expr = t >= MT.AFTER + 100 ? "grin" : t >= T.DIVE && t < T.LAND + 200 ? "rage" : t >= 1250 && t < T.LAUNCH ? "calm" : undefined; P.exK = 1;
        // the lift-off and the rocket up: arms back, feet together, wings beating
        if (t >= T.LAUNCH && t < T.DIVE) { P.lean = 0; P.flap = Math.sin(t * 0.05) * 0.8; return { hF: [-w * 0.25, -leg - tor * 0.25], hB: [-w * 0.35, -leg - tor * 0.25], fF: [w * 0.05, -leg * 0.3], fB: [-w * 0.15, -leg * 0.3] }; }
        if (t >= T.DIVE && t < T.LAND) {
          // the dive: her face leads, spun to point down the page; she uncurls into the landing after the hit
          const k = easeOut(fe(H0 + 20, T.LAND, t));
          P.spin = DIVE_SPIN * (1 - k); P.lean = 0; P.mouth = 0.5; P.flap = 0.3; P.wingUp = 0.8;
          P.crouch = 0.45 * k;
          return { hF: [w * 0.7, -leg * 0.7], hB: [-w * 0.6, -leg * 0.5], fF: [w * 0.35, -leg - tor * 1.15], fB: [-w * 0.3, -leg - tor * 1.2] };
        }
        if (t >= T.LAND) {
          // landed in a crouch, rises at panel 4
          const up = ease(fe(MT.AFTER + 60, MT.AFTER + 450, t));
          P.crouch = 0.45 * (1 - up); P.lean = 0.1 * (1 - up) - 0.05 * up; P.wingUp = 0.5 * (1 - up); P.flap = 0.05;
          return { hF: [w * 0.6, -leg * (1 - up * 0.2) - tor * (0.12 + 0.35 * up)], hB: [-w * 0.55, -leg - tor * (0.1 + 0.3 * up)], fF: [w * 0.5, 0], fB: [-w * 0.35, 0] };
        }
        // panel 2: arms out in a V, face up
        const a = ease(fe(1300, 1800, t));
        return { hF: [w * (0.7 + 0.1 * a), -leg * 0.9], hB: [-w * (0.65 + 0.1 * a), -leg * 0.9] };
      }
      // the loser
      const fly = t >= FIN.launch;
      P.expr = fly ? "ko" : "terror"; P.exK = fly ? 1 : fe(MT.INSET, MT.STRIKE, t);
      if (!fly) {
        P.lean = -0.2 + Math.sin(t * 0.03) * 0.03 * fe(2000, 2400, t); P.mouth = t >= H0 ? 1 : 0.5;
        return { hF: [w * 0.98, -leg - tor * 0.78], hB: [-w * 0.9, -leg - tor * 0.7] };
      }
      P.lean = -0.5; P.mouth = 1; P.spin = ((t - FIN.launch) / FMS) * 0.3;
      return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
    },
    // feathers over the whole page; the comet, and her rocketing up out of panel 2, over the borders; speed lines along the loser's flight
    over(o, t) {
      o.save();
      if (t >= T.LAUNCH && t < T.DIVE) {
        const pn = MG.byId.look; mgPlace(pn, t);
        if (wPos(t)[1] > -900) phxWinnerOver(o, pn, t);
      }
      if (t >= T.DIVE && t < T.LAND) { const pn = MG.byId.strike; mgPlace(pn, t); phxComet(o, pn, t, null); }
      o.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (spr && t > 700 && t < MT.FADE) {
        const gh = L.gh, gw = L.gw;
        for (let fi = 0; fi < fth.length; fi++) {
          const f = fth[fi];
          if (t < f.t0) continue;
          if (f.kind === 3 && MG.slow && (fi & 1)) continue;
          const s = (t - f.t0) / 1000;
          let x, y, a;
          if (f.kind === 3) {   // ash: a grey square, falling and turning
            x = f.x0 + Math.sin(s * f.w + f.ph) * f.sw; y = (((f.y0 + f.vy * s) % (gh + 60)) + gh + 60) % (gh + 60) - 30; a = fe(f.t0, f.t0 + 300, t) * 0.9;
            a *= 1 - fe(MT.AFTER + 500, MT.AFTER + 900, t);
            if (a < 0.02 || y < -30 || y > gh + 30 || x < -30 || x > gw + 30) continue;
            o.globalAlpha = a; o.save(); o.translate(x, y); o.rotate(f.tilt + s * f.w); o.fillStyle = f.sz > 3 ? ASH : ASH2; o.fillRect(-f.sz / 2, -f.sz / 2, f.sz, f.sz); o.restore();
            continue;
          }
          if (f.burst) {
            const T0 = 0.8, e = T0 * (1 - Math.exp(-s / T0));
            if (!f.ox) { const pn = MG.byId.look; mgPlace(pn, 2100); const q = pn.p(FIN.wx, -30); f.ox = q[0]; f.oy = q[1] - pn.h * 0.05; pn.ox = pn.oy = 0; }
            x = f.ox + Math.cos(f.a) * f.sp * e + Math.sin(s * f.w * 2 + f.ph) * 10 * Math.min(1, s); y = f.oy + Math.sin(f.a) * f.sp * e + 26 * s * s * 0.5 + 24 * Math.max(0, s - 0.4);
            a = Math.min(1, s * 6);
          } else {
            x = f.x0 + Math.sin(s * f.w + f.ph) * f.sw; y = (((f.y0 + f.vy * s) % (gh + 60)) + gh + 60) % (gh + 60) - 30; a = fe(700, 1100, t) * 0.8;
          }
          a *= 1 - fe(MT.AFTER + 500, MT.AFTER + 900, t);
          if (a < 0.02 || y < -30 || y > gh + 30 || x < -30 || x > gw + 30) continue;
          const sp_ = spr[f.kind], flip = 0.35 + 0.65 * Math.abs(Math.cos(s * f.w * 1.6 + f.ph));
          o.globalAlpha = a; o.save(); o.translate(x, y); o.rotate(f.tilt + Math.sin(s * f.w + f.ph) * 0.9); o.scale(f.sc, f.sc * flip);
          o.drawImage(sp_.cv, -sp_.w / 2, -sp_.h / 2, sp_.w, sp_.h); o.restore();
        }
        o.globalAlpha = 1;
      }
      phxAshFlakes(o, t);
      if (t > FIN.launch && t < FIN.launch + 420) {
        const Lp = L_(), pn = MG.byId.strike, a = 1 - fe(FIN.launch + 200, FIN.launch + 420, t);
        const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - FIN.launch) * 1.4, 0.8 * a, false, 1);
        o.restore();
      }
      o.restore();
      if (t >= MT.FADE - 1 && spr) spr = null;
    },
    drawLoser: drawLoserFn,
    hitPt() { return burstPt(); },
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_();
      o.save();
      phxComet(o, pn, FIN.hit, sil);
      mgPuppet(o, pn, W, FIN.hit + 10, { sc: diveSc(FIN.hit + 10), sil });
      mgPuppet(o, pn, Lp, FIN.hit + 10, { sc: 1, sil });
      pn.world(o);
      const [bx, by] = burstPt(); phxStar6(o, bx, by, ult && sil === MG_INK ? 80 : 40, 0.3, sil, null);   // the Ultimate's third (gold) frame: the star at 2x
      o.restore();
    },
    cues(t) {
      cueOnce("sun", 1280, () => Cin.go(() => { Cin.shimmer(440, 1.5); Cin.sub(58, 50, 1.1, 0.22); }));
      cueOnce("wings", 1420, () => Cin.go(() => Cin.whoosh(0.4, -0.6, 0.6, 0.4)));
      cueOnce("snap", 1700, () => Cin.go(() => { Cin.pluck(1760); Cin.chime(1320); }));
      cueOnce("flute", 2050, () => Cin.go(() => Cin.flute(0.7)));
      cueOnce("up", T.LAUNCH, () => Cin.go(() => { Cin.clack(); Cin.whoosh(0.3, 0, 0, 0.55); }));
      cueOnce("dive", T.DIVE - 30, () => Cin.go(() => { Cin._osc("sawtooth", 1500, 220, 0.22, 0.05, 0.02); Cin._noise(0.22, 0.32, 5200, 800, "bandpass", 1); }));
      cueOnce("stab", this.hit, () => Cin.go(() => { Cin.stab(196, 0.8); Cin.rumble(0.5); }));
      cueOnce("burn", FIN.launch, () => Cin.go(() => { Cin.whoosh(0.35, -0.9, 0.9, 0.5); Cin.sub(66, 30, 0.3, 0.5); }));
      cueOnce("thud", MT.AFTER, () => Cin.go(() => { Cin.sub(80, 36, 0.3, 0.5); Cin._noise(0.18, 0.3, 900, 200, "lowpass"); }));
      cueOnce("cool", MT.AFTER + 120, () => Cin.go(() => Cin._noise(0.6, 0.12, 1800, 600, "bandpass", 1.2)));
      cueOnce("chimeEnd", MT.AFTER + 460, () => Cin.go(() => Cin.chime(880)));
      if (!ult) return;
      cueOnce("riser", T.DIVE - 10, () => Cin.go(() => Cin.riser(0.25, 0.3)));
      cueOnce("embers", FIN.launch, () => Cin.go(() => Cin._noise(0.4, 0.2, 2600, 900, "lowpass")));
      cueOnce("nova", SPL() + 50, () => Cin.go(() => { Cin.shimmer(880, 1.6); Cin.sub(50, 40, 1.2, 0.3); }));
      cueOnce("supernova", 3600, () => Cin.go(() => Cin.taiko(0.8)));
      cueOnce("blink1", 4100, () => Cin.go(() => Cin.tick(2600)));
      cueOnce("blink2", 4500, () => Cin.go(() => Cin.tick(2600)));
    },
  };
  // she rockets up out of panel 2: drawn over the borders, wings still beating
  function phxWinnerOver(o, pn, t) {
    o.setTransform(DPR, 0, 0, DPR, 0, 0);
    const k = fe(T.LAUNCH, T.DIVE, t);
    phxWinner(o, pn, t, { light: dirAng(-1.75), spread: lerp(1, 0.55, easeOut(fe(T.LAUNCH, T.LAUNCH + 200, t))), heat: 1, flame: 1 });
  }
  /* ---- the Ultimate page, "Supernova": the same script, with the changes of the design (MT is the Ultimate table while it plays: AFTER 4700, SPLASH 3250) ---- */
  S_.ulti = Object.assign({}, S_, {
    name: "Supernova", pop: 3050,   // the launch waits for the gold impact frame
    start(g) { S_.start(g); ult = true; },
    // the KO beam where the loser left the screen is cut short once the white page is in (it would run through her for another half second)
    after(t) { if (FIN.beam && t >= SPL() + 120 && FIN.beam.t0 > -1e5) FIN.beam.t0 = -1e6; },
    panels(lay) {
      const ps = panels(lay), inset = ps.find((q) => q.id === "inset");   // (the white page is opaque: the panels under it are not drawn once it has slid in)
      inset.freeze = MT.STRIKE + 130;            // the strike panel has slid over it by then: drawn once, then a bitmap
      ps.splice(ps.length - 1, 0, phxSplashPanel(lay.port));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, mul = lay.port ? 0.5 : 1, P3 = () => MG.byId.strike;
      // NOVA takes the place of DOOOM
      ws[3] = { text: "NOVA", t0: FIN.hit + 95, t1: 3420, size: 0.24, mul, arc: 9, fill: MG_GOLD, rot: -0.07 * D, at: () => { const p = P3(), hw = phxHalf("NOVA", 0.24, mul); return [clamp(p.cx - D * p.w * 0.06, hw + 4, L.gw - hw - 4), p.y0 + p.h * 0.2 + p.oy]; } };
      // SUPERNOVA across the sun's upper rim (a nine-letter word has to fit the upright page)
      const ms = lay.port ? Math.min(0.5, 0.86 * L.gw / (9 * 0.2 * L.gh * 0.72)) : 1;
      ws.push({ text: "SUPERNOVA", t0: 3600, t1: MT.CARD + 120, size: 0.2, mul: ms, arc: 5, fill: MG_GOLD, rot: -0.05 * D, at: (t) => {
        const p = MG.byId.splash, hw = phxHalf("SUPERNOVA", 0.2, ms); mgPlace(p, t);
        const g = phxSunGeo(p, t); return [clamp(g.cx, hw + 4, L.gw - hw - 4), g.cy - g.R * 0.94 + p.oy];
      } });
      return ws;
    },
  });
  return S_;
})();
