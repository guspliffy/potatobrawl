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
   Script fields: see game/manga/dragon.js. Everything here is prefixed phx / kept inside this closure.
   POTATALITY: "Well Done" = MANGA.phoenix.alt (S_.alt, at the end; its helpers are prefixed wd), played on a normal KO when it is on (ui/kopages.js).
   POTATALITY 2: "New Potatoes" = MANGA.phoenix.alt2 (S_.alt2, after it; its helpers are prefixed np), played when the second one is chosen (FIN.alt 2). */
MANGA.phoenix = (function () {
  const COL = "#ff7a3d", MIDC = "#ffb45e", CORE = "#fff3c4", ASH = "#2c2933", ASH2 = "#57525f";
  const T = { LAUNCH: 2180, DIVE: 2650, LAND: 3000 };
  let spr = null, fth = [], spk = [], torn = false, topWY = -220, hitY = -64, cmt = null;
  let ult = false, ashF = [], inSplash = false;   // ult: this play is the Ultimate page (set by start())
  let pota = false;   // this play is the Potatality, "Well Done" (set by its start)
  let pota2 = false;  // this play is the second Potatality, "New Potatoes" (set by its start)
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
    start() { ult = false; pota = false; pota2 = false; spr = null; fth = []; spk = []; ashF = []; inSplash = false; const Lp = L_(); if (Lp) Lp.doomed = false; },
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
          a *= (1 - fe(MT.AFTER + 500, MT.AFTER + 900, t)) * (pota || pota2 ? 1 - fe(SPL(), SPL() + 250, t) : 1);   // (the Potatalities' splashes stay clear of them)
          if (a < 0.02 || y < -30 || y > gh + 30 || x < -30 || x > gw + 30) continue;
          const sp_ = spr[f.kind], flip = 0.35 + 0.65 * Math.abs(Math.cos(s * f.w * 1.6 + f.ph));
          o.globalAlpha = a; o.save(); o.translate(x, y); o.rotate(f.tilt + Math.sin(s * f.w + f.ph) * 0.9); o.scale(f.sc, f.sc * flip);
          o.drawImage(sp_.cv, -sp_.w / 2, -sp_.h / 2, sp_.w, sp_.h); o.restore();
        }
        o.globalAlpha = 1;
      }
      phxAshFlakes(o, t);
      if (t > FIN.launch && t < FIN.launch + 420) {
        const Lp = L_(), pn = MG.byId.strike, a = (1 - fe(FIN.launch + 200, FIN.launch + 420, t)) * (pota || pota2 ? 1 - fe(MT.SPLASH - 100, MT.SPLASH, t) : 1);
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
  /* ===================== the Potatality, "Well Done" (MANGA.phoenix.alt; design: Project files step8/fable-design.md) =====================
     Rebirth up to the dive and the hit (the flight's speed lines are gone as the page turns). 3250 panel 5, the splash, slides up: an oven, open; inside, the
     loser as a roast potato with a rosemary sprig on an enamel tray in his colour, panicking; her flame wings spread on the oven's front either side of it.
     3400 the wings sweep in and shut: they are the oven's doors (3570 clunk), with a window between them. The oven heats (the element glows, heat waves, he
     browns, the timer ticks down); 3930 DING. 4040 the doors fly open in a burst of steam, two oven mitts on feathered sleeves reach in and pull the tray
     out at us: done, eyes shut; 4500 one eye opens. 4700 panel 4 as on Rebirth, in oven mitts, the tray on the ground in front of her: one eye open, a
     curl of steam, "well done"; the engine's POP at 5250 leaves the empty tray. The splash is drawn in the panel's px; every helper here is prefixed wd. */
  const WD = { SHUT0: 3400, SHUT: 3570, DING: 3930, OPEN0: 4040, OPEN: 4190, REACH: 4070, PULL0: 4140, PULL: 4370, EYE: 4500 };
  const WD_TAU = Math.PI * 2, WD_TICKS = ["wdTick1", "wdTick2", "wdTick3"];
  let wdGc = null, wdC = null;   // the splash's layout (made per page size) and the colours (once per page)
  const wdHex = (v) => {
    if (!v) return "#e6b26a";
    if (v[0] === "#") return v.length === 4 ? "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v.slice(0, 7);
    const m = v.match(/\d+/g); return m ? "#" + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("") : "#e6b26a";
  };
  function wdCols() {
    if (wdC) return wdC;
    const pal = L_().pal || {}, body = wdHex(pal.body), ui = wdHex(col(pal)), ac = wdHex(wcol());
    wdC = { raw: phxMix(body, "#fff2d6", 0.4), done: phxMix(body, "#a5531a", 0.5), rawTop: phxMix(body, "#fffaf0", 0.65), doneTop: phxMix(body, "#ffcf4d", 0.45), speck: "#5a2c0e",
      tray: phxMix(ui, "#f1ece2", 0.12), trayIn: phxMix(ui, "#1d1418", 0.5),
      wing: ac, wingDk: phxMix(ac, "#000000", 0.2), wingMid: phxMix(ac, "#ffd27a", 0.55), wingCore: phxMix(ac, "#fff6d8", 0.8), plate: phxMix(ac, "#2a1208", 0.55),
      mitt: phxMix(ac, "#c8281f", 0.55), cuff: "#fff4d8", steel: "#ece6da", frame: "#3d3a42", frameHi: "#9a96a2", timer: "#e8452c", bell: "#f4cf55", wedge: "#ff9a8a",
      back: "#5b3a2b", side: "#46291e", ceil: "#341d15", floor: "#3d2419", cold: "#6e3424", rack: "#d9d0c2", sprig: "#4f8046", sprigDone: "#2f4d2a", stem: "#6b5a2e" };
    return wdC;
  }
  // the splash's layout in the panel's px: the oven's mouth (o..), the window between the shut doors (w..), the timer, the tray inside and pulled out, the mitts;
  // and the doors' feathers (the left door; the right one is its mirror): per row the shut y, length and bulge, and the open (wing) angle, length and bulge
  function wdGeo(pn) {
    const key = pn.x0 + pn.y0 * 7 + pn.w * 131 + pn.h * 1709;
    if (wdGc && wdGc.key === key) return wdGc;
    const port = !!(MG.lay && MG.lay.port), w = pn.w, h = pn.h, ow = port ? w * 0.94 : Math.min(w * 0.56, h * 1.3), oh = port ? h * 0.5 : h * 0.7;
    const cx = pn.x0 + w / 2, cy = pn.y0 + h * (port ? 0.57 : 0.6), ww = ow * (port ? 0.6 : 0.56), wh = oh * (port ? 0.56 : 0.6), tr = port ? w * 0.12 : h * 0.095;
    const G = { key, port, cx, cy, ow, oh, ww, wh, ox0: cx - ow / 2, ox1: cx + ow / 2, oy0: cy - oh / 2, oy1: cy + oh / 2, wx0: cx - ww / 2, wx1: cx + ww / 2, wy0: cy - wh / 2, wy1: cy + wh / 2,
      fw: wh * 0.075, lw: Math.max(1.6, Math.min(w, h) * 0.0068), tr, tx: cx, ty: port ? cy - oh / 2 - tr - h * 0.045 : (pn.y0 + cy - oh / 2) / 2 + tr * 0.08,
      rx: ow * (port ? 0.155 : 0.13), tY: cy + oh * 0.21, tw: ow * (port ? 0.22 : 0.25), td: oh * 0.07, th: oh * 0.04, pY: port ? cy + oh / 2 + h * 0.1 : pn.y0 + h * 0.93, pS: port ? 1.85 : 1.9,
      ms: port ? w * 0.24 : h * 0.2, hxo: port ? ow * 0.06 : 0, rows: null, n: 0 };
    const band = (oh - wh) / 2, ns = port ? 6 : 5, sp = wh / ns, nb = band > sp * 1.5 ? 2 : 1, n = ns + 2 * nb, R = new Float32Array(n * 6);
    const A0 = port ? 1.5 : 1.0, A1 = port ? 1.45 : 0.85, Lo0 = port ? h * 0.3 : (G.ox0 - pn.x0) * 1.02;
    let j = 0;
    const row = (v, L, bw) => {
      const u = j / (n - 1), ao = u < 0.6 ? -Math.PI + A0 * (1 - u / 0.6) : Math.PI - A1 * (u - 0.6) / 0.4, Lo = Lo0 * (0.78 + 0.3 * Math.sin(Math.PI * u));
      R[j * 6] = v; R[j * 6 + 1] = L; R[j * 6 + 2] = bw; R[j * 6 + 3] = ao; R[j * 6 + 4] = Lo; R[j * 6 + 5] = Lo * 0.2; j++;
    };
    for (let b = 0; b < nb; b++) row(G.oy0 + band * (b + 0.5) / nb, ow / 2 * 1.08, band / nb * 1.3);
    for (let k = 0; k < ns; k++) row(G.wy0 + sp * (k + 0.5), G.wx0 - G.ox0 + G.fw * 0.8, sp * 1.3);
    for (let b = 0; b < nb; b++) row(G.wy1 + band * (b + 0.5) / nb, ow / 2 * 1.08, band / nb * 1.3);
    G.rows = R; G.n = n;
    return (wdGc = G);
  }
  // dot tone through a path made by fn(c) in the current transform (the dots stay in device space)
  function wdTone(c, size, cover, fn, rule) { c.save(); c.beginPath(); fn(c); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(size, cover); c.fill(rule || "nonzero"); c.restore(); }
  // the doors: 0 open (spread on the oven's front like wings), 1 shut; quick in, a slam, and flung open after the DING
  function wdShut(t) {
    const J = WD;
    if (t < J.SHUT0) return 0;
    if (t < J.SHUT) return easeIn(fe(J.SHUT0, J.SHUT, t));
    if (t < J.OPEN0) return 1;
    return 1 - easeOut(fe(J.OPEN0, J.OPEN, t));
  }
  // a flame feather as on her wings: from (ax, ay) along (ca, sa), length L, bulge bw; k and w2 make the inner layers
  function wdLeaf(c, ax, ay, ca, sa, L, bw, k, w2) {
    const l = L * k, nx = -sa, ny = ca, mx = ax + ca * l * 0.5, my = ay + sa * l * 0.5;
    c.moveTo(ax, ay); c.quadraticCurveTo(mx + nx * bw * w2, my + ny * bw * w2, ax + ca * l, ay + sa * l); c.quadraticCurveTo(mx - nx * bw * w2 * 0.85, my - ny * bw * w2 * 0.85, ax, ay);
  }
  function wdFeather(c, ax, ay, ang, L, bw, C, lw, dk) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    c.beginPath(); wdLeaf(c, ax, ay, ca, sa, L, bw, 1, 1); c.fillStyle = dk ? C.wingDk : C.wing; c.fill(); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); wdLeaf(c, ax, ay, ca, sa, L, bw, 0.84, 0.58); c.fillStyle = C.wingMid; c.fill();
    c.beginPath(); wdLeaf(c, ax, ay, ca, sa, L, bw, 0.6, 0.28); c.fillStyle = C.wingCore; c.fill();
  }
  // a door: the left one (sg -1; the right one through a mirror). Open, its feathers fan out from the shoulder like a wing, aflame at the tips; shutting, they sweep
  // in to lie side by side across the oven's mouth (a dark plate behind them as they land), short where the window is
  const WD_TIP = new Float32Array(32);
  function wdDoor(c, G, t, k, sg) {
    const C = wdCols(), R = G.rows, n = G.n, lw = G.lw, hx = G.ox0, cx = G.cx, fl = 1 - k;
    c.save();
    if (sg > 0) { c.translate(2 * cx, 0); c.scale(-1, 1); }
    c.lineJoin = "round";
    const pa = fe(0.7, 1, k);
    if (pa > 0.01) {
      const ov = G.ow * 0.03;
      c.globalAlpha = pa; c.beginPath(); c.moveTo(hx, G.oy0); c.lineTo(cx + ov, G.oy0); c.lineTo(cx + ov, G.wy0); c.lineTo(G.wx0, G.wy0); c.lineTo(G.wx0, G.wy1); c.lineTo(cx + ov, G.wy1); c.lineTo(cx + ov, G.oy1); c.lineTo(hx, G.oy1); c.closePath();
      c.fillStyle = C.plate; c.fill(); c.globalAlpha = 1;
    }
    for (let j = 0; j < n; j++) {
      const o = j * 6, v = R[o], ang = lerp(R[o + 3] + Math.sin(t * 0.005 + j * 1.3) * 0.06 * fl, 0, k), L = lerp(R[o + 4], R[o + 1], k), bw = lerp(R[o + 5], R[o + 2], k), ay = lerp(G.cy + (v - G.cy) * 0.22, v, k);
      const ax = lerp(hx + G.hxo, hx, k);
      wdFeather(c, ax, ay, ang, L, bw, C, lw, j % 2);
      WD_TIP[j * 2] = ax + Math.cos(ang) * L; WD_TIP[j * 2 + 1] = ay + Math.sin(ang) * L;
    }
    if (fl > 0.05 && !MG.slow) for (let j = 0; j < n; j++) {
      const h = G.oh * (0.045 + 0.018 * (j % 3)) * fl * (0.75 + 0.25 * Math.sin(t * 0.03 + j * 2.1));
      phxTongue(c, WD_TIP[j * 2], WD_TIP[j * 2 + 1] + 1, h, h * 0.24, Math.sin(t * 0.021 + j * 1.3) * h * 0.2, C.wing, C.wingCore, lw * 0.8);
    }
    c.restore();
  }
  // the window between the shut doors: warm glass with two glare streaks, a dark steel frame
  function wdWindow(c, G, t, heat) {
    const C = wdCols(), x0 = G.wx0, y0 = G.wy0, w = G.ww, h = G.wh, f = G.fw, r = h * 0.09, lw = G.lw;
    c.save(); c.beginPath(); c.roundRect(x0, y0, w, h, r); c.clip();
    c.globalAlpha = 0.08 + 0.14 * heat; c.fillStyle = "#ffb070"; c.fillRect(x0, y0, w, h);
    c.globalAlpha = 0.42; c.fillStyle = "#ffffff"; c.beginPath();
    c.moveTo(x0, y0 + h * 0.4); c.lineTo(x0 + w * 0.22, y0); c.lineTo(x0 + w * 0.29, y0); c.lineTo(x0, y0 + h * 0.53); c.closePath();
    c.moveTo(x0, y0 + h * 0.64); c.lineTo(x0 + w * 0.35, y0); c.lineTo(x0 + w * 0.38, y0); c.lineTo(x0, y0 + h * 0.7); c.closePath(); c.fill();
    c.restore();
    c.beginPath(); c.roundRect(x0 - f, y0 - f, w + 2 * f, h + 2 * f, r + f); c.roundRect(x0, y0, w, h, r);
    c.fillStyle = C.frame; c.fill("evenodd"); c.lineWidth = lw * 1.3; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); c.roundRect(x0 - f * 0.5, y0 - f * 0.5, w + f, h + f, r + f * 0.5); c.lineWidth = lw * 0.6; c.strokeStyle = C.frameHi; c.stroke();
  }
  // inside the oven: walls in perspective round a back wall, the heat's orange wash, the element (a coil across the top of the back wall), the rack
  function wdCavity(c, G, t, heat) {
    const C = wdCols(), lw = G.lw, cx = G.cx, cy = G.cy, s = 0.58, bw = G.ow * s / 2, bh = G.oh * s / 2, bx0 = cx - bw, bx1 = cx + bw, by0 = cy - bh, by1 = cy + bh;
    c.fillStyle = C.ceil; c.fillRect(G.ox0, G.oy0, G.ow, G.oh);
    c.beginPath(); c.moveTo(G.ox0, G.oy0); c.lineTo(bx0, by0); c.lineTo(bx0, by1); c.lineTo(G.ox0, G.oy1); c.closePath(); c.moveTo(G.ox1, G.oy0); c.lineTo(bx1, by0); c.lineTo(bx1, by1); c.lineTo(G.ox1, G.oy1); c.closePath();
    c.fillStyle = C.side; c.fill();
    c.beginPath(); c.moveTo(G.ox0, G.oy1); c.lineTo(bx0, by1); c.lineTo(bx1, by1); c.lineTo(G.ox1, G.oy1); c.closePath(); c.fillStyle = C.floor; c.fill();
    c.fillStyle = C.back; c.fillRect(bx0, by0, bw * 2, bh * 2);
    wdTone(c, 6, 0.3, (g) => { g.rect(G.ox0, G.oy0, G.ow, G.oh); g.rect(bx0, by0, bw * 2, bh * 2); }, "evenodd");
    c.lineWidth = lw; c.strokeStyle = MG_INK; c.beginPath();
    c.moveTo(G.ox0, G.oy0); c.lineTo(bx0, by0); c.moveTo(G.ox1, G.oy0); c.lineTo(bx1, by0); c.moveTo(G.ox0, G.oy1); c.lineTo(bx0, by1); c.moveTo(G.ox1, G.oy1); c.lineTo(bx1, by1); c.rect(bx0, by0, bw * 2, bh * 2);
    c.stroke();
    if (heat > 0.01) {
      c.globalAlpha = 0.5 * heat; c.fillStyle = COL; c.fillRect(G.ox0, G.oy0, G.ow, G.oh);
      c.globalAlpha = 0.35 * heat; c.fillStyle = MIDC; c.beginPath(); c.ellipse(cx, cy, bw * 1.05, bh, 0, 0, WD_TAU); c.fill();
      c.globalAlpha = 0.3 * heat; c.fillStyle = CORE; c.beginPath(); c.ellipse(cx, cy, bw * 0.6, bh * 0.55, 0, 0, WD_TAU); c.fill(); c.globalAlpha = 1;
    }
    const ex0 = bx0 + bw * 0.12, ex1 = bx1 - bw * 0.12, eyA = by0 + bh * 0.1, eyB = by0 + bh * 0.24, N = 9;
    c.beginPath(); for (let i = 0; i <= N; i++) { const x = lerp(ex0, ex1, i / N), y = i % 2 ? eyB : eyA; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.lineJoin = "round"; c.lineCap = "round";
    if (heat > 0.02) { c.globalAlpha = 0.4 * heat; c.lineWidth = lw * 6; c.strokeStyle = MIDC; c.stroke(); c.globalAlpha = 1; }
    c.lineWidth = lw * 2.8; c.strokeStyle = MG_INK; c.stroke();
    c.lineWidth = lw * 1.5; c.strokeStyle = heat > 0.02 ? phxMix(C.cold, "#ff6a2a", heat) : C.cold; c.stroke();
    if (heat > 0.3) { c.globalAlpha = (heat - 0.3) / 0.7; c.lineWidth = lw * 0.6; c.strokeStyle = CORE; c.stroke(); c.globalAlpha = 1; }
    const ry0 = cy + G.oh * 0.25, ry1 = cy + G.oh * 0.25 * s;
    c.beginPath(); c.moveTo(G.ox0, ry0); c.lineTo(G.ox1, ry0); c.moveTo(bx0, ry1); c.lineTo(bx1, ry1);
    for (let i = 0; i <= 8; i++) { const u = i / 8 - 0.5; c.moveTo(cx + u * G.ow, ry0); c.lineTo(cx + u * bw * 2, ry1); }
    c.lineWidth = lw * 1.9; c.strokeStyle = MG_INK; c.stroke(); c.lineWidth = lw * 0.8; c.strokeStyle = C.rack; c.stroke();
  }
  // heat waves rising over him
  function wdWaves(c, G, t, a, x, y, rx) {
    if (a <= 0.02) return;
    c.save(); c.globalAlpha = a; c.lineWidth = G.lw * 1.1; c.strokeStyle = "#ffe7b8"; c.lineCap = "round"; c.beginPath();
    for (let i = 0; i < 3; i++) {
      const bx = x + (i - 1) * rx * 0.62;
      for (let j = 0; j <= 8; j++) { const q = j / 8, yy = y - q * G.oh * 0.2, xx = bx + Math.sin(q * 9 - t * 0.012 + i * 2) * rx * 0.08; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
    }
    c.stroke(); c.restore();
  }
  // the oven's dials either side of the timer (the first pair turns up as the doors slam) and its light, on while it heats
  function wdKnobs(c, G, t, heat) {
    const lw = G.lw, kr = G.tr * 0.4, n = G.port ? 1 : 2, turn = ease(fe(WD.SHUT, WD.SHUT + 140, t)), y = G.ty + G.tr * 0.12;
    c.strokeStyle = MG_INK; c.lineCap = "round";
    for (let i = 1; i <= n; i++) for (let sd = -1; sd <= 1; sd += 2) {
      const x = G.tx + sd * G.tr * (1.35 + 1.3 * i), a = -Math.PI / 2 + sd * (i === 1 ? 0.4 + 1.9 * turn : 0.7);
      c.beginPath(); c.arc(x, y, kr, 0, WD_TAU); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = lw * 1.1; c.stroke();
      wdTone(c, 5, 0.4, (g) => g.arc(x, y, kr, 0.2, Math.PI - 0.2));
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * kr * 0.85, y + Math.sin(a) * kr * 0.85); c.lineWidth = lw * 1.4; c.stroke();
    }
    c.beginPath(); c.arc(G.tx - G.tr * 1.32, G.ty + G.tr * 0.95, kr * 0.32, 0, WD_TAU); c.fillStyle = heat > 0.1 ? "#ff3b2a" : "#8a6a62"; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
  }
  // the upright page has room under the oven for its drawer
  function wdDrawer(c, G, pn) {
    const lw = G.lw, x0 = G.ox0 + G.ow * 0.03, x1 = G.ox1 - G.ow * 0.03, y0 = G.oy1 + pn.h * 0.035, y1 = pn.y1 - pn.h * 0.03;
    if (y1 - y0 < 20) return;
    c.beginPath(); c.roundRect(x0, y0, x1 - x0, y1 - y0, 6); c.lineWidth = lw * 1.6; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); c.roundRect(G.cx - G.ow * 0.22, y0 + (y1 - y0) * 0.2, G.ow * 0.44, Math.max(6, (y1 - y0) * 0.1), 4); c.fillStyle = "#cfc8bc"; c.fill(); c.stroke();
  }
  // the kitchen timer on top of the oven: a bell, a red body, a white face; the red wedge of time left ticks away (3 ticks) to the DING, where it rings and hops
  function wdTimer(c, G, t, ring) {
    const C = wdCols(), J = WD, r = G.tr, lw = G.lw, u = t - J.DING, wob = ring * 0.2 * Math.sin(u * 0.11), hop = ring * Math.abs(Math.sin(u * 0.055)) * r * 0.16;
    const k = fe(J.SHUT, J.DING, t) * 4, kk = t >= J.DING ? 1 : Math.min(4, Math.floor(k) + easeOut(fe(0, 0.3, k % 1))) / 4, a = 2.4 * (1 - kk);
    c.save(); c.translate(G.tx, G.ty - hop); c.rotate(wob); c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = MG_INK;
    c.beginPath(); c.moveTo(-r * 0.42, -r * 0.86); c.quadraticCurveTo(-r * 0.4, -r * 1.36, 0, -r * 1.38); c.quadraticCurveTo(r * 0.4, -r * 1.36, r * 0.42, -r * 0.86); c.closePath();
    c.fillStyle = C.bell; c.fill(); c.lineWidth = lw * 1.2; c.stroke();
    c.beginPath(); c.arc(0, -r * 1.46, r * 0.09, 0, WD_TAU); c.fill(); c.stroke();
    c.lineWidth = lw * 2; c.beginPath(); c.moveTo(-r * 0.5, r * 0.82); c.lineTo(-r * 0.66, r * 1.08); c.moveTo(r * 0.5, r * 0.82); c.lineTo(r * 0.66, r * 1.08); c.stroke();
    c.beginPath(); c.arc(0, 0, r, 0, WD_TAU); c.fillStyle = C.timer; c.fill(); c.lineWidth = lw * 1.5; c.stroke();
    wdTone(c, 5, 0.35, (g) => { g.arc(0, 0, r, 0.6, 2.6); g.arc(0, 0, r * 0.8, 2.6, 0.6, true); });
    c.beginPath(); c.arc(0, 0, r * 0.76, 0, WD_TAU); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = lw; c.stroke();
    if (a > 0.02) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r * 0.5, -Math.PI / 2, -Math.PI / 2 + a); c.closePath(); c.fillStyle = C.wedge; c.fill(); }
    c.beginPath();
    for (let i = 0; i < 12; i++) { const b = i * Math.PI / 6, r0 = r * (i % 3 ? 0.62 : 0.54); c.moveTo(Math.cos(b) * r0, Math.sin(b) * r0); c.lineTo(Math.cos(b) * r * 0.7, Math.sin(b) * r * 0.7); }
    c.lineWidth = lw * 0.8; c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - Math.PI / 2) * r * 0.6, Math.sin(a - Math.PI / 2) * r * 0.6); c.lineWidth = lw * 1.6; c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.09, 0, WD_TAU); c.fillStyle = MG_INK; c.fill();
    c.restore();
    if (ring > 0.02) {   // ringing: arcs either side of the bell
      c.save(); c.globalAlpha = ring; c.lineWidth = lw * 1.4; c.strokeStyle = MG_INK; c.lineCap = "round"; c.beginPath();
      const bx = G.tx, by = G.ty - hop - r * 0.7;
      for (let i = 0; i < 3; i++) {
        const rr = r * (0.9 + 0.3 * i + 0.08 * Math.sin(u * 0.05 + i));
        for (let sd = -1; sd <= 1; sd += 2) { const m = -Math.PI / 2 + sd * 1.0; c.moveTo(bx + Math.cos(m - 0.32) * rr, by + Math.sin(m - 0.32) * rr); c.arc(bx, by, rr, m - 0.32, m + 0.32); }
      }
      c.stroke(); c.restore();
    }
  }
  // the burst of steam as the doors fly open: one cloud of puffs (one ink outline round all of them) billowing out of the top of the oven, rising off the page
  const WD_PUFF = [-0.55, 0.1, 0.8, -0.3, -0.15, 1.0, 0, 0.05, 1.1, 0.3, -0.12, 0.95, 0.56, 0.08, 0.8, -0.15, -0.45, 0.85, 0.18, -0.48, 0.9, 0.45, -0.38, 0.7, -0.45, -0.32, 0.7, 0, -0.72, 0.75];
  function wdBurst(c, G, t) {
    const u = fe(WD.OPEN0, WD.OPEN0 + 300, t), up = easeIn(fe(WD.OPEN0 + 220, WD.OPEN0 + 620, t));
    if (u <= 0 || up >= 1) return;
    const e = easeOut(u), R = G.oh * (0.1 + 0.13 * e) * (1 - 0.3 * up), lw = G.lw, sx = G.ow * 0.5 * (0.6 + 0.5 * e), sy = G.oh * 0.5 * (0.6 + 0.5 * e), y0 = G.oy0 + G.oh * (0.35 - 0.38 * e) - (G.oy0 + G.oh * 0.6) * up;
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (let i = 0; i < WD_PUFF.length; i += 3) {
        const x = G.cx + WD_PUFF[i] * sx, y = y0 + WD_PUFF[i + 1] * sy, r = R * WD_PUFF[i + 2] + (pass ? 0 : lw * 1.3);
        c.moveTo(x + r, y); c.arc(x, y, r, 0, WD_TAU);
      }
      c.fillStyle = pass ? "#ffffff" : MG_INK; c.fill();
    }
  }
  // a curl of steam: a white ribbon with ink edges, waving up from (x, y)
  function wdCurl(c, x, y, len, t, a, lw, ph) {
    if (a <= 0.02) return;
    const s = (t * 0.0012 + ph) % 1;
    c.save(); c.globalAlpha = a; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath();
    for (let j = 0; j <= 10; j++) { const q = j / 10, yy = y - len * q - len * 0.12 * s, xx = x + Math.sin(q * 5.2 + ph + t * 0.004) * len * 0.12 * (0.4 + q); j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
    c.lineWidth = lw * 2.8; c.strokeStyle = MG_INK; c.stroke(); c.lineWidth = lw * 1.5; c.strokeStyle = "#ffffff"; c.stroke();
    c.restore();
  }
  // the enamel roasting tray in the loser's colour, a little from above: front-bottom centre (x, y), half-width w at the front, top face d high, front face h high
  // (any units; lw an ink line in them). part 0: the floor and the back wall (empty: crumbs and a shine of oil), part 1: the front face and the handles
  const WD_TSPK = [-0.7, 0.4, -0.35, 0.7, 0.1, 0.35, 0.45, 0.65, 0.8, 0.45, -0.9, 0.75, 0.62, 0.25];
  const WD_CRUMB = [-0.3, 0.5, 0.05, 0.12, 0.35, 0.04, 0.3, 0.6, 0.035, -0.05, 0.7, 0.03];
  function wdTray(c, x, y, w, d, h, lw, part, empty) {
    const C = wdCols(), yb = y - h, yt = yb - d, wb = w * 0.9;
    c.lineJoin = "round"; c.strokeStyle = MG_INK;
    if (part === 0) {
      c.beginPath(); c.moveTo(x - w, yb); c.lineTo(x - wb, yt); c.lineTo(x + wb, yt); c.lineTo(x + w, yb); c.closePath();
      c.fillStyle = C.trayIn; c.fill(); c.lineWidth = lw; c.stroke();
      c.beginPath(); c.moveTo(x - wb, yt); c.lineTo(x + wb, yt); c.lineTo(x + wb * 0.95, yt + d * 0.3); c.lineTo(x - wb * 0.95, yt + d * 0.3); c.closePath(); c.fillStyle = C.tray; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
      if (empty) {
        c.globalAlpha = 0.6; c.fillStyle = "#fff6d8"; c.beginPath(); c.ellipse(x, yb - d * 0.42, w * 0.32, d * 0.18, 0, 0, WD_TAU); c.fill(); c.globalAlpha = 1;
        c.fillStyle = C.doneTop; c.lineWidth = lw * 0.5;
        for (let i = 0; i < WD_CRUMB.length; i += 3) { c.beginPath(); c.arc(x + WD_CRUMB[i] * w, yb - d * WD_CRUMB[i + 1], WD_CRUMB[i + 2] * w, 0, WD_TAU); c.fill(); c.stroke(); }
      }
      return;
    }
    c.beginPath(); c.moveTo(x - w, yb); c.lineTo(x + w, yb); c.lineTo(x + w * 0.96, y); c.lineTo(x - w * 0.96, y); c.closePath();
    c.fillStyle = C.tray; c.fill(); c.lineWidth = lw * 1.2; c.stroke();
    const D = FIN.dir;
    wdTone(c, 5, 0.35, (g) => { g.moveTo(x + D * w * 0.3, yb); g.lineTo(x + D * w, yb); g.lineTo(x + D * w * 0.96, y); g.lineTo(x + D * w * 0.25, y); g.closePath(); });
    c.fillStyle = MG_INK;
    for (let i = 0; i < WD_TSPK.length; i += 2) { c.beginPath(); c.arc(x + WD_TSPK[i] * w, yb + WD_TSPK[i + 1] * h, Math.max(lw * 0.3, h * 0.07), 0, WD_TAU); c.fill(); }
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = Math.max(lw * 0.5, h * 0.12); c.beginPath(); c.moveTo(x - D * w * 0.85, yb + h * 0.25); c.lineTo(x - D * w * 0.4, yb + h * 0.25); c.stroke();
    const hr = w * 0.1;
    for (let sd = -1; sd <= 1; sd += 2) {
      c.beginPath(); c.ellipse(x + sd * w * 0.98, yb + h * 0.3, hr, hr * 0.62, 0, -Math.PI / 2, Math.PI / 2, sd < 0);
      c.lineWidth = lw * 2.8; c.strokeStyle = MG_INK; c.stroke(); c.lineWidth = lw * 1.3; c.strokeStyle = C.tray; c.stroke();
    }
    c.strokeStyle = MG_INK;
  }
  // a rosemary sprig along a curve (x0, y0) -> (x1, y1) (control qx, qy), needles nl long; darker as it roasts
  function wdSprig(c, x0, y0, x1, y1, qx, qy, nl, lw, k) {
    const C = wdCols(), green = k > 0.01 ? phxMix(C.sprig, C.sprigDone, k) : C.sprig;
    c.lineCap = "round"; c.strokeStyle = MG_INK;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(qx, qy, x1, y1); c.lineWidth = lw * 2.2; c.stroke(); c.lineWidth = lw * 0.9; c.strokeStyle = C.stem; c.stroke(); c.strokeStyle = MG_INK;
    c.fillStyle = green; c.lineWidth = lw * 0.55;
    for (let i = 0; i < 6; i++) {
      const s = 0.12 + i * 0.15, u = 1 - s, px = u * u * x0 + 2 * u * s * qx + s * s * x1, py = u * u * y0 + 2 * u * s * qy + s * s * y1;
      const a = Math.atan2(2 * u * (qy - y0) + 2 * s * (y1 - qy), 2 * u * (qx - x0) + 2 * s * (x1 - qx)), L = nl * (1 - 0.35 * s);
      for (let sd = -1; sd <= 1; sd += 2) { const b = a + sd * 0.8; c.beginPath(); c.ellipse(px + Math.cos(b) * L * 0.5, py + Math.sin(b) * L * 0.5, L * 0.5, L * 0.14, b, 0, WD_TAU); c.fill(); c.stroke(); }
    }
  }
  // a rounded polygon through the points P (a flat list, in rx and ry from the bottom centre (x, y)), mirrored by D
  function wdPoly(c, P, x, y, rx, ry, D, r) {
    const n = P.length / 2;
    c.moveTo(x + D * (P[2 * n - 2] + P[0]) / 2 * rx, y + (P[2 * n - 1] + P[1]) / 2 * ry);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; c.arcTo(x + D * P[2 * i] * rx, y + P[2 * i + 1] * ry, x + D * P[2 * j] * rx, y + P[2 * j + 1] * ry, r); }
    c.closePath();
  }
  const WD_RO = [-1, -0.04, -0.97, -0.5, -0.78, -0.98, -0.32, -1.24, 0.22, -1.27, 0.68, -1.1, 0.97, -0.68, 1.02, -0.26, 0.92, -0.02];
  const WD_RT = [-0.7, -0.95, -0.3, -1.16, 0.2, -1.19, 0.6, -1.04, 0.4, -0.8, -0.46, -0.74];
  const WD_SPK = [-0.7, -0.35, 0.03, -0.42, -0.62, 0.025, 0.3, -0.5, 0.03, 0.72, -0.4, 0.028, 0.55, -0.85, 0.022, -0.82, -0.75, 0.024, 0.1, -0.2, 0.02, -0.25, -0.15, 0.022, 0.85, -0.2, 0.02];
  const WD_GL = [-0.5, -0.9, 0.08, 0.3, -1.12, 0.06, 0.82, -0.75, 0.05];
  // the roast: the loser as a chunky roast potato with a cut face on top, bottom centre (x, y), half-width rx (any units). o: { roast 0..1 (pale .. golden
  // brown), eyes "panic" | "shut" | "one" (the near eye shut, the other open by o.open), shake, sweat 0..1 }
  function wdRoast(c, x, y, rx, lw, o, t) {
    const C = wdCols(), D = FIN.dir, ry = rx * 0.66, k = o.roast, sh = o.shake || 0;
    x += Math.sin(t * 0.07) * sh * 0.5;
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = MG_INK;
    c.beginPath(); wdPoly(c, WD_RO, x, y, rx, ry, D, rx * 0.22); c.fillStyle = k > 0.01 ? phxMix(C.raw, C.done, k) : C.raw; c.fill();
    c.save(); c.clip();
    wdTone(c, 6, 0.4, (g) => { g.rect(x - rx * 2, y - ry * 2.2, rx * 4, ry * 2.4); g.ellipse(x - D * rx * 0.28, y - ry * 0.98, rx * 1.02, ry * 0.86, 0, 0, WD_TAU); }, "evenodd");
    if (k > 0.05) {
      c.globalAlpha = k; c.fillStyle = C.speck;
      for (let i = 0; i < WD_SPK.length; i += 3) { c.beginPath(); c.arc(x + D * WD_SPK[i] * rx, y + WD_SPK[i + 1] * ry, WD_SPK[i + 2] * rx, 0, WD_TAU); c.fill(); }
      c.globalAlpha = 1;
    }
    c.restore();
    c.beginPath(); wdPoly(c, WD_RO, x, y, rx, ry, D, rx * 0.22); c.lineWidth = lw * 1.4; c.stroke();
    c.beginPath(); wdPoly(c, WD_RT, x, y, rx, ry, D, rx * 0.12); c.fillStyle = k > 0.01 ? phxMix(C.rawTop, C.doneTop, k) : C.rawTop; c.fill(); c.lineWidth = lw * 0.9; c.stroke();
    c.fillStyle = "#ffffff"; c.globalAlpha = 0.55 + 0.4 * k;
    for (let i = 0; i < WD_GL.length; i += 3) { c.beginPath(); c.ellipse(x + D * WD_GL[i] * rx, y + WD_GL[i + 1] * ry, WD_GL[i + 2] * rx * 1.5, WD_GL[i + 2] * rx * 0.6, -0.5 * D, 0, WD_TAU); c.fill(); }
    c.globalAlpha = 1;
    wdSprig(c, x - D * rx * 0.3, y - ry * 1.17, x + D * rx * 0.66, y - ry * 1.42, x + D * rx * 0.16, y - ry * 1.55, rx * 0.17, lw, k);
    wdFace(c, x, y, rx, ry, lw, o, t, D);
  }
  // his face on the front of the roast (Odin keeps his eyepatch)
  function wdFace(c, x, y, rx, ry, lw, o, t, D) {
    const er = rx * 0.13, sh = o.shake || 0, jx = Math.sin(t * 0.09) * sh, jy = Math.cos(t * 0.13) * sh * 0.5, fx = x - D * rx * 0.08 + jx, ey = y - ry * 0.52 + jy;
    const patch = L_().spec.look.costume === "odin";
    c.strokeStyle = MG_INK; c.lineCap = "round";
    for (let sd = -1; sd <= 1; sd += 2) {
      const ex = fx + sd * rx * 0.26, near = sd === D;
      if (patch && near) {
        c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(ex - er * 1.6, ey - er * 1.6); c.lineTo(ex + er * 1.8, ey + er * 0.2); c.stroke();
        c.beginPath(); c.ellipse(ex, ey, er * 0.95, er * 0.85, 0, 0, WD_TAU); c.fillStyle = MG_INK; c.fill(); continue;
      }
      if (o.eyes === "shut" || (o.eyes === "one" && (near || o.open < 0.2))) {
        c.lineWidth = lw * 1.1; c.beginPath(); c.moveTo(ex - er * 0.9, ey + er * 0.15); c.quadraticCurveTo(ex, ey - er * 0.55, ex + er * 0.9, ey + er * 0.15); c.stroke(); continue;
      }
      if (o.eyes === "one") {   // the one open eye, half-lidded, looking at us: done
        const h2 = er * 1.05 * o.open;
        c.beginPath(); c.ellipse(ex, ey, er * 0.88, h2, 0, 0, Math.PI); c.closePath(); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = lw * 0.9; c.stroke();
        c.beginPath(); c.arc(ex - D * er * 0.12, ey + h2 * 0.42, Math.min(er * 0.3, h2 * 0.45), 0, WD_TAU); c.fillStyle = MG_INK; c.fill();
        c.lineWidth = lw * 1.5; c.beginPath(); c.moveTo(ex - er * 1.05, ey - er * 0.05 * sd); c.lineTo(ex + er * 1.05, ey + er * 0.05 * sd); c.stroke();
        continue;
      }
      c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, er * 0.85, er * 1.15, 0, 0, WD_TAU); c.fill(); c.lineWidth = lw * 0.9; c.stroke();
      c.fillStyle = MG_INK; c.beginPath(); c.arc(ex, ey + er * 0.12, er * 0.26, 0, WD_TAU); c.fill();
      c.lineWidth = lw; c.beginPath(); c.moveTo(ex + sd * er * 1.0, ey - er * 1.45); c.lineTo(ex - sd * er * 0.55, ey - er * 2.0); c.stroke();
    }
    const mx = fx, my = y - ry * 0.2 + jy;
    if (o.eyes === "panic") { c.beginPath(); c.ellipse(mx, my, er * 0.42, er * 0.58, 0, 0, WD_TAU); c.fillStyle = "#5a2418"; c.fill(); c.lineWidth = lw * 0.8; c.stroke(); }
    else { c.beginPath(); c.moveTo(mx - er * 0.7, my); c.quadraticCurveTo(mx - er * 0.35, my - er * 0.3, mx, my); c.quadraticCurveTo(mx + er * 0.35, my + er * 0.3, mx + er * 0.7, my); c.lineWidth = lw; c.stroke(); }
    if (o.sweat > 0.02) for (let i = 0; i < 2; i++) {
      const q = (t * 0.0022 + i * 0.5) % 1, sd = i ? 1 : -1, sx = x + sd * rx * (0.78 + 0.35 * q), sy = y - ry * (1.25 + 0.3 * Math.sin(Math.PI * q)) + q * ry * 0.4, s2 = er * 0.75 * (1 - 0.4 * q);
      c.globalAlpha = o.sweat * (1 - q); c.beginPath(); c.moveTo(sx, sy - s2 * 1.3); c.quadraticCurveTo(sx + s2, sy + s2 * 0.3, sx, sy + s2 * 0.8); c.quadraticCurveTo(sx - s2, sy + s2 * 0.3, sx, sy - s2 * 1.3);
      c.fillStyle = "#dff0ff"; c.fill(); c.lineWidth = lw * 0.8; c.stroke(); c.globalAlpha = 1;
    }
  }
  // the tray and the roast, in the oven (p 0) or pulled out at us (p 1): panicking in the cold oven and as it heats, eyes shut from the DING, one eye open at 4500
  function wdTrayRoast(c, G, t, roast, p) {
    const J = WD, D = FIN.dir, S = lerp(1, G.pS, p), x = G.cx, y = lerp(G.tY, G.pY, p), w = G.tw * S, d = G.td * S * (1 + 0.6 * p), h = G.th * S, rx = G.rx * S, lw = G.lw * (1 + 0.3 * p), yr = y - h - d * 0.45;
    wdTray(c, x, y, w, d, h, lw, 0, false);
    const eyes = t < J.DING ? "panic" : t < J.EYE ? "shut" : "one", shake = t < J.DING ? (t < J.SHUT ? 0.8 : 1.2 + 1.8 * roast) * lw * 0.5 : 0;
    wdRoast(c, x, yr, rx, lw, { roast, eyes, open: easeOut(fe(J.EYE, J.EYE + 90, t)), shake, sweat: t < J.DING ? (t < J.SHUT ? 0.6 : 1) : 0 }, t);
    wdTray(c, x, y, w, d, h, lw, 1, false);
    if (p <= 0) wdWaves(c, G, t, 0.85 * fe(J.SHUT + 60, J.SHUT + 200, t) * (1 - fe(J.DING + 60, J.OPEN0, t)), x, yr - rx * 0.9, rx);
    else { const a = fe(J.PULL - 120, J.PULL + 60, t); wdCurl(c, x - D * rx * 0.3, yr - rx * 0.86, rx * 0.95, t, a, lw, 0); wdCurl(c, x + D * rx * 0.35, yr - rx * 0.8, rx * 0.75, t, a, lw, 2.3); }
  }
  // her arm (a fighter's ink limb, seen close) from (x0, y0) to the cuff (x1, y1), a pale shine along it
  function wdArm(c, x0, y0, x1, y1, wd, lw) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, px = -dy / L * wd, py = dx / L * wd;
    c.beginPath(); c.moveTo(x0 + px * 1.3, y0 + py * 1.3); c.lineTo(x1 + px, y1 + py); c.lineTo(x1 - px, y1 - py); c.lineTo(x0 - px * 1.3, y0 - py * 1.3); c.closePath();
    c.fillStyle = MG_INK; c.fill();
    c.beginPath(); c.moveTo(x0 - px * 0.55, y0 - py * 0.55); c.lineTo(x1 - px * 0.45, y1 - py * 0.45); c.lineWidth = lw * 0.9; c.lineCap = "round"; c.strokeStyle = "rgba(255,255,255,0.35)"; c.stroke();
  }
  // an oven mitt, quilted, its cuff at (x, y), the fingers along ang, s long (the thumb stays on top)
  function wdMittPath(c, w, s) { c.beginPath(); c.moveTo(-w * 0.52, 0); c.lineTo(-w * 0.58, -s * 0.62); c.quadraticCurveTo(-w * 0.56, -s * 1.04, 0, -s * 1.04); c.quadraticCurveTo(w * 0.56, -s * 1.04, w * 0.55, -s * 0.62); c.lineTo(w * 0.5, 0); c.closePath(); }
  function wdMitt(c, x, y, s, ang, lw, C) {
    const w = s * 0.5;
    c.save(); c.translate(x, y); c.rotate(ang + Math.PI / 2); if (Math.cos(ang) > 0) c.scale(-1, 1);
    c.lineJoin = "round"; c.strokeStyle = MG_INK;
    c.beginPath(); c.ellipse(w * 0.6, -s * 0.48, w * 0.3, s * 0.21, 0.4, 0, WD_TAU); c.fillStyle = C.mitt; c.fill(); c.lineWidth = lw; c.stroke();
    wdMittPath(c, w, s); c.fillStyle = C.mitt; c.fill();
    c.save(); c.clip();
    c.globalAlpha = 0.4; c.lineWidth = lw * 0.6; c.beginPath();
    for (let i = -3; i <= 3; i++) { const o = i * w * 0.45; c.moveTo(-w + o, 0); c.lineTo(w + o, -s * 1.1); c.moveTo(w + o, 0); c.lineTo(-w + o, -s * 1.1); }
    c.stroke(); c.globalAlpha = 1;
    wdTone(c, 5, 0.42, (g) => g.rect(w * 0.12, -s * 1.1, w, s * 1.2));
    c.restore();
    wdMittPath(c, w, s); c.lineWidth = lw * 1.2; c.stroke();
    c.beginPath(); c.roundRect(-w * 0.66, -s * 0.06, w * 1.32, s * 0.25, s * 0.06); c.fillStyle = C.cuff; c.fill(); c.lineWidth = lw; c.stroke();
    c.restore();
  }
  // her arms come in from the bottom corners, the mitts take the tray's handles and pull it out with them
  function wdMitts(c, pn, G, t) {
    const J = WD, m = easeOut(fe(J.REACH, J.PULL0, t));
    if (m <= 0.001) return;
    const C = wdCols(), p = ease(fe(J.PULL0, J.PULL, t)), S = lerp(1, G.pS, p), x = G.cx, y = lerp(G.tY, G.pY, p), w = G.tw * S, h = G.th * S, lw = G.lw * (1 + 0.3 * p), s = G.ms * lerp(1, 1.25, p);
    for (let sd = -1; sd <= 1; sd += 2) {
      const hx = x + sd * w * 1.06, hy = y - h * 0.7, sx = sd < 0 ? pn.x0 - pn.w * 0.06 : pn.x1 + pn.w * 0.06, sy = pn.y1 + pn.h * 0.08;
      const ang = Math.atan2(hy - sy, hx - sx), ca = Math.cos(ang), sa = Math.sin(ang), gx = lerp(sx, hx, m), gy = lerp(sy, hy, m), mx = gx - ca * s * 0.5, my = gy - sa * s * 0.5;
      wdArm(c, sx - ca * s * 2, sy - sa * s * 2, mx, my, s * 0.17, lw);
      wdMitt(c, mx, my, s, ang, lw, C);
    }
  }
  function wdDrawSplash(c, pn, t) {
    const G = wdGeo(pn), C = wdCols(), J = WD, lw = G.lw;
    const shut = wdShut(t), heat = fe(J.SHUT, J.SHUT + 220, t) * (1 - 0.75 * fe(J.OPEN0, J.OPEN0 + 450, t)), roast = ease(fe(J.SHUT + 40, J.DING - 40, t)), ring = t >= J.DING ? 1 - fe(J.DING + 380, J.DING + 700, t) : 0;
    pn.screen(c);
    // the oven's front: warm white steel in light dots
    c.fillStyle = C.steel; c.fillRect(pn.x0 - 4, pn.y0 - 4, pn.w + 8, pn.h + 8);
    wdTone(c, 8, 0.16, (g) => g.rect(pn.x0 - 4, pn.y0 - 4, pn.w + 8, pn.h + 8));
    if (G.port) wdDrawer(c, G, pn);
    // DING: focus lines and a burst round the timer, over the top of the oven
    if (ring > 0.02) {
      c.save(); c.beginPath(); c.rect(pn.x0 - 4, pn.y0 - 4, pn.w + 8, G.oy0 - pn.y0 + 2); c.clip();
      mgFocus(c, G.tx, G.ty, Math.hypot(pn.w, G.oy0 - pn.y0) * 0.9, t * 0.0004, 0.75 * ring);
      c.restore();
      const b = easeOut(fe(J.DING, J.DING + 70, t)) * (1 - fe(J.DING + 120, J.DING + 260, t));
      if (b > 0.02) mgStarburst(c, G.tx, G.ty, G.tr * (1.2 + 1.3 * b), 0.3);
    }
    wdKnobs(c, G, t, heat);
    // inside the oven (the tray stays in there until the doors are open)
    const inside = t < J.OPEN0 + 80;
    c.save(); c.beginPath(); c.rect(G.ox0, G.oy0, G.ow, G.oh); c.clip();
    wdCavity(c, G, t, heat);
    if (inside) wdTrayRoast(c, G, t, roast, 0);
    c.restore();
    c.lineWidth = lw * 2.6; c.strokeStyle = MG_INK; c.strokeRect(G.ox0, G.oy0, G.ow, G.oh);
    // her wings: the oven's doors
    wdDoor(c, G, t, shut, -1); wdDoor(c, G, t, shut, 1);
    if (t >= J.SHUT && t < J.OPEN0) wdWindow(c, G, t, heat);
    wdTimer(c, G, t, ring);
    wdBurst(c, G, t);
    if (!inside) wdTrayRoast(c, G, t, roast, ease(fe(J.PULL0, J.PULL, t)));
    wdMitts(c, pn, G, t);
    const fl = 0.55 * (1 - fe(J.SHUT, J.SHUT + 90, t)) * (t >= J.SHUT ? 1 : 0);
    if (fl > 0.01) { c.fillStyle = `rgba(255,252,244,${fl.toFixed(3)})`; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); }
  }
  const wdShake = (t) => {
    const J = WD, a = 7 * fe(J.SHUT, J.SHUT + 15, t) * (1 - fe(J.SHUT + 40, J.SHUT + 240, t)) + 3.5 * fe(J.DING, J.DING + 15, t) * (1 - fe(J.DING + 60, J.DING + 300, t));
    return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0];
  };
  const wdCam = () => ({ wx: FIN.lx, wy: -60, vh: 200 });   // (the splash draws in the panel's px)
  // panel 4: Rebirth's aftermath in oven mitts, the tray on the ground in front of her: the roast with one eye open (a blink at 5000), a curl of steam; once
  // he has popped out, the empty tray with the sprig left on it
  const WD_AL = { ax: 62, tw: 32, rx: 24, land: 48 }, WD_AP = { ax: 48, tw: 25, rx: 18.5, land: 34 }, WD_HANDS = ["hB", "shB", "hF", "sh"];
  const wdAGeo = () => (MG.lay && MG.lay.port ? WD_AP : WD_AL);
  const wdAX = () => FIN.lx - FIN.dir * 10 + FIN.dir * wdAGeo().ax;
  function wdDrawAfter(c, pn, t) {
    drawAfter(c, pn, t);
    const A = wdAGeo(), D = FIN.dir, W = W_(), C = wdCols(), x = wdAX(), popped = mgPopped(t), lw = Math.max(1.1, 3 / pn.z), d = A.tw * 0.16, h = A.tw * 0.1, yr = -h - d * 0.45, s = W.s.w * 0.36;
    for (let i = 0; i < 4; i += 2) {
      const hp = pt(W, t, WD_HANDS[i]), sp = pt(W, t, WD_HANDS[i + 1]), ang = Math.atan2(hp[1] - sp[1], hp[0] - sp[0]);
      pn.world(c); wdMitt(c, hp[0] - Math.cos(ang) * s * 0.4, hp[1] - Math.sin(ang) * s * 0.4, s, ang, lw, C);
    }
    pn.world(c);
    wdTray(c, x, 0, A.tw, d, h, lw, 0, popped);
    if (popped) wdSprig(c, x - D * A.tw * 0.4, yr + d * 0.1, x + D * A.tw * 0.3, yr - d * 0.05, x - D * A.tw * 0.05, yr - d * 0.5, A.tw * 0.1, lw, 1);
    else wdRoast(c, x, yr, A.rx, lw, { roast: 1, eyes: "one", open: t >= 5000 && t < 5070 ? 0 : 1, shake: 0, sweat: 0 }, t);
    wdTray(c, x, 0, A.tw, d, h, lw, 1, popped);
    wdCurl(c, x + D * A.rx * 0.15, yr - A.rx * 0.88, A.rx * 1.4, t, fe(MT.AFTER + 80, MT.AFTER + 280, t) * (popped ? 0.6 : 1), lw, 0.7);
  }

  S_.alt = Object.assign({}, S_, {
    name: "Well Done",
    start(g) { S_.start(g); pota = true; wdGc = null; wdC = null; },
    end() { S_.end(); pota = false; wdGc = null; wdC = null; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), inset = by("inset"), strike = by("strike"), after = by("after"), D = FIN.dir;
      inset.freeze = MT.STRIKE + 130;              // the strike panel has slid over it by then: drawn once, then a bitmap
      strike.freeze = strike.cover = MT.SPLASH;   // the splash covers the whole page from here: the strike is drawn once more, then a bitmap
      after.draw = wdDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 112 : 84) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.lx - D * 10 + D * vh * (lay.port ? 0.27 : 0.62), wy: -0.38 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: MG_PAPER, slide: MG.reduced ? 1 : 180, cam: wdCam, shake: wdShake, draw: wdDrawSplash }));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, ms = lay.port ? Math.min(0.5, 0.86 * L.gw / (5 * 0.22 * L.gh * 0.72)) : 1;
      ws[3].t1 = MT.SPLASH + 150;   // DOOOM is gone as the splash comes up
      const spl = (t) => { const pn = MG.byId.splash; mgPlace(pn, t); return pn; };
      ws.push(
        { text: "clunk", t0: WD.SHUT, t1: WD.SHUT + 420, size: 0.075, mul: lay.port ? 0.62 : 1, jit: 0.12, rot: 0.1 * D,
          at: (t) => { const pn = spl(t), G = wdGeo(pn); return [G.cx - D * G.ow * 0.2, (G.oy0 + G.wy0) / 2 + pn.oy]; } },
        { text: "DING!", t0: WD.DING, t1: WD.OPEN + 280, size: 0.22, mul: ms, arc: 8, jag: 0.1, fill: "#ffe066", rot: -0.08 * D,
          at: (t) => {
            const pn = spl(t), G = wdGeo(pn), hw = phxHalf("DING!", 0.22, ms);
            return lay.port ? [G.tx, G.ty - G.tr * 1.55 - L.gh * 0.22 * ms * 0.42 + pn.oy] : [clamp(G.tx + D * (G.tr * 1.7 + hw), hw + 4, L.gw - hw - 4), G.ty + G.tr * 0.15 + pn.oy];
          } },
        { text: "well done", t0: MT.AFTER + 260, t1: MT.POP + 20, size: 0.06, mul: lay.port ? 0.62 : 1, jit: 0.1, rot: -0.07 * D,
          at: () => { const pn = MG.byId.after, A = wdAGeo(); mgPlace(pn, MT.AFTER + 400); return pn.sp(wdAX() + D * A.rx * 1.2, -A.rx * 2.5); } },
      );
      return ws;
    },
    // panel 4: she presents the tray with one mitt, the other on her hip
    pose(P, sk, t, role, p) {
      const r = S_.pose(P, sk, t, role, p);
      if (role !== "w" || t < MT.AFTER) return r;
      const w = sk.w, leg = sk.leg, tor = sk.tor, up = ease(fe(MT.AFTER + 60, MT.AFTER + 450, t));
      return { hF: [w * (0.62 + 0.3 * up), -leg - tor * (0.12 + 0.24 * up)], hB: [-w * 0.6, -leg - tor * (0.1 + 0.16 * up)], fF: r.fF, fB: r.fB };
    },
    food() { const A = wdAGeo(), x = wdAX(), h = A.tw * 0.1, d = A.tw * 0.16; return { x, y: 0, r: A.rx, y0: -(h + d * 0.45 + A.rx * 0.6), lx: x + FIN.dir * A.land }; },
    cues(t) {
      S_.cues(t);
      cueOnce("wdUp", MT.SPLASH + 40, () => Cin.go(() => Cin.page()));
      cueOnce("wdSweep", WD.SHUT0 + 40, () => Cin.go(() => Cin.whoosh(0.2, -0.6, 0.6, 0.45)));
      cueOnce("wdClunk", WD.SHUT, () => Cin.go(() => { Cin.clack(); Cin.sub(90, 40, 0.22, 0.6); }));
      cueOnce("wdHeat", WD.SHUT + 60, () => Cin.go(() => Cin._noise(0.85, 0.08, 220, 700, "lowpass")));
      for (let i = 0; i < 3; i++) cueOnce(WD_TICKS[i], WD.SHUT + (WD.DING - WD.SHUT) * (i + 1) / 4, () => Cin.go(() => Cin.tick(2300)));
      cueOnce("wdDing", WD.DING, () => Cin.go(() => { Cin.chime(2093); Cin.chime(2637); Cin._osc("triangle", 4186, 4186, 0.5, 0.03, 0.002); }));
      cueOnce("wdOpen", WD.OPEN0, () => Cin.go(() => { Cin.whoosh(0.3, 0.6, -0.6, 0.5); Cin._noise(0.7, 0.18, 2600, 900, "bandpass", 0.8); }));
      cueOnce("wdPull", WD.PULL0, () => Cin.go(() => { Cin.clack(); Cin._noise(0.22, 0.12, 1400, 600, "bandpass", 1.2); }));
      cueOnce("wdEye", WD.EYE, () => Cin.go(() => Cin.tick(2900)));
      cueOnce("wdSizzle", MT.AFTER + 140, () => Cin.go(() => Cin._noise(0.7, 0.05, 3000, 5200, "highpass", 0.8)));
      cueOnce("wdBlink", 5000, () => Cin.go(() => Cin.tick(2900)));
    },
  });
  /* ===================== the second Potatality, "New Potatoes" (MANGA.phoenix.alt2; design: Project files step8/fable-design-2.md §1.2) =====================
     Rebirth up to the dive and the hit (the flight's speed lines are gone as the page turns). 3250 panel 5, the splash, slides up: the Solar Dive's flame ring,
     0.8 of the short side, the loser curled up asleep in its middle, the Phoenix beside it (upright: hovering over it) with her wings of fire (FWOOSH over the ring).
     3330-3590 the ring closes down to a point on the ground and the loser with it: poof, a grey ash heap with his eyes; two embers on it blink out; the camera
     pushes in on the heap (upright, she comes down beside it). 3650 a sprout pops up out of the ash (boing), 3800 a second; 3890 a baby potato (the loser at
     0.45, a dummy in its mouth) climbs out and 4030 sits down in front (plop); 4050 / 4100 two more peek out under the sprouts. 4180 the Phoenix wipes a tear
     (aww), 4330-4650 she fans them with her wings. 4700 panel 4 as on Rebirth, a tiny watering can in her hand, a terracotta pot beside her with three babies
     in it, the middle one with the loser's face; the engine's POP at 5250 leaves the pot in two halves, the soil spilled, one sprout.
     Splash world: the ring's foot and the heap at (FIN.lx, 0). Every helper here is prefixed np. */
  const NP = { RING: 3260, CLOSE0: 3400, POOF: 3590, PUSH: 3600, DOWN: 3620, SPR1: 3650, SPR2: 3800, CLIMB: 3890, OUT: 3950, PLOP: 4030, PEEK1: 4050, PEEK2: 4100, TEAR: 4180, FAN: 4330, FAN1: 4650 };
  const NP_TAU = Math.PI * 2;
  let npGc = null, npC = null, npIn = 0;   // npIn: 1 the Phoenix, 2 the loser curled in the ring, 3 the baby (their poses in the splash and the pot); npGc / npC: layout, colours
  // the layout: the ring's radius, the loser's scale in it and a baby's, the heap's half-width and height, the Phoenix over / beside the ring and beside the heap,
  // where the first baby sits, the camera before (c0) and after (c1) the push
  function npGeo() {
    if (npGc) return npGc;
    const port = !!(MG.lay && MG.lay.port), D = FIN.dir, x = FIN.lx, Lp = L_(), lb = Lp.spec.boss ? MG_BOSS_SC : 1;
    npGc = { port, x, Rr: 80, lb, lsc: Math.min(1.3, 96 / (Lp.s.h * lb)), bsc: 0.45, hw: 44, hh: 36,
      wx0: port ? x - D * 16 : x - D * 150, wy0: port ? -250 : 0, wx1: port ? x - D * 24 : x - D * 150, wy1: port ? -128 : 0, bx: x - D * (port ? 54 : 50),
      c0: port ? x - D * 4 : x - D * 40, c1: port ? x - D * 9 : x - D * 72, kz: port ? 1.6 : 1.45 };
    return npGc;
  }
  function npCols() {
    if (npC) return npC;
    const pal = L_().pal || {}, body = wdHex(pal.body), ac = wdHex(wcol());
    npC = { bud: phxMix(body, "#f1ece2", 0.25), budDk: phxMix(body, "#1d1418", 0.35), ring: ac, ringMid: phxMix(ac, "#ffd27a", 0.55), ringCore: phxMix(ac, "#fff6d8", 0.8),
      glow: phxMix(ac, "#fff6d8", 0.75), leaf: "#7cc85a", leafDk: "#3f7d3a", pot: "#d0703f", potDk: "#9c4a26", potHi: "#e89a68", soil: "#4a2e1e", soilHi: "#6b4630",
      can: "#7fb8a8", canDk: "#4d8a7a", water: "#9fd8f0", dummy: "#8fd0ea" };
    return npC;
  }
  // the ring: its radius closes to nothing on its foot (it stays standing on the ground) from CLOSE0 to POOF
  const npR = (t) => npGeo().Rr * (1 - easeIn(fe(NP.CLOSE0, NP.POOF, t)));
  // the ash heap's top line: u from -1 to 1 across it, k its growth
  const npHeapY = (u, k) => -npGeo().hh * k * Math.pow(Math.max(0, 1 - u * u), 0.7) * (1 + 0.06 * Math.sin(u * 7.3));
  // the Phoenix: beside the ring (upright: hovering over it, bobbing), then on the ground beside the heap
  function npWAt(t) {
    const G = npGeo(), k = ease(fe(NP.DOWN, NP.DOWN + 200, t)), bob = G.port ? Math.sin(t * 0.008) * 3 : 0;
    return [lerp(G.wx0, G.wx1, k), lerp(G.wy0, G.wy1, k) + bob];
  }
  function npAsW(t, fn) {
    const W = W_(), ox = W.x, oy = W.y, q = npWAt(t); W.x = q[0]; W.y = q[1]; npIn = 1;
    try { return fn(W); } finally { W.x = ox; W.y = oy; npIn = 0; }
  }
  // the loser drawn as a stand-in at (x, y) (feet) in a pose of this page (mode 2: curled in the ring, 3: a baby), s his scale
  function npAsL(t, x, y, mode, fn) {
    const Lp = L_(), sv = [Lp.x, Lp.y, Lp.state, Lp.facing, Lp.flash];
    Lp.x = x; Lp.y = y; Lp.state = "fin"; Lp.facing = -FIN.dir; Lp.flash = 0; npIn = mode;
    try { return fn(Lp); } finally { Lp.x = sv[0]; Lp.y = sv[1]; Lp.state = sv[2]; Lp.facing = sv[3]; Lp.flash = sv[4]; npIn = 0; }
  }
  // her pose in the splash: hands out to the ring, then watching the heap, the tear wiped away, fanning them
  function npPose(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor;
    P.wingUp = 0.5; P.flap = 0.1 + Math.sin(t * 0.006) * 0.06; P.mouth = 0; P.exK = 1;
    if (t < NP.POOF) { P.expr = "rage"; P.lean = -0.08; return { hF: [w * 1.0, -leg - tor * 0.85], hB: [w * 0.55, -leg - tor * 0.95] }; }
    if (t < NP.TEAR - 60) { P.expr = t < NP.SPR1 ? "terror" : undefined; P.exK = 0.6; P.lean = 0.06; P.mouth = t < NP.SPR1 ? 0.5 : 0; return { hF: [w * 0.8, -leg - tor * 0.4], hB: [-w * 0.7, -leg - tor * 0.4] }; }
    if (t < NP.FAN) { const k = ease(fe(NP.TEAR - 60, NP.TEAR + 40, t)), sw = Math.sin((t - NP.TEAR) * 0.03) * 0.05 * k; P.expr = "calm"; P.lean = 0.1 * k; P.mouth = 0.2; return { hF: [w * lerp(0.8, 0.66, k), -leg - tor * lerp(0.4, 1.08 + sw, k)], hB: [-w * 0.6, -leg - tor * 0.5] }; }
    const f = Math.sin((t - NP.FAN) * 0.03);
    P.expr = "calm"; P.lean = 0.08 + 0.04 * f; P.mouth = 0.3;
    return { hF: [w * (0.75 + 0.08 * f), -leg - tor * 0.45], hB: [-w * (0.75 + 0.08 * f), -leg - tor * 0.45] };
  }
  // the loser curled up asleep in the ring; a baby climbing out of the ash (arms up) and sitting
  function npLPose(P, sk, t, mode) {
    const w = sk.w, leg = sk.leg, tor = sk.tor;
    P.exK = 1; P.mouth = 0; P.spin = 0;
    if (mode === 2) { P.expr = "calm"; P.lean = 0.32; P.crouch = 0.6; return { hF: [w * 0.5, -leg * 0.75], hB: [w * 0.15, -leg * 0.6], fF: [w * 0.4, -leg * 0.55], fB: [w * 0.1, -leg * 0.45] }; }
    P.expr = ""; P.lean = t < NP.PLOP ? 0 : 0.05 * Math.sin(t * 0.012);
    if (t < NP.PLOP) return { hF: [w * 0.75, -leg - tor * 1.25], hB: [-w * 0.7, -leg - tor * 1.2] };
    P.crouch = 0.5;
    return { hF: [w * 0.6, -leg - tor * 0.55], hB: [-w * 0.6, -leg - tor * 0.5], fF: [w * 0.55, -leg * 0.15], fB: [w * 0.15, -leg * 0.1] };
  }
  // phxLocal at a scale: the frame of a puppet drawn at sc s (feet, facing, spin, lean)
  function npLocal(c, p, t, s) {
    MG.pt = t;
    const P = pose(p, mgTk(t));
    c.translate(p.x, p.y); c.scale(p.facing * s, s);
    if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
    c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    return P;
  }
  // the baby: the loser at a baby's size, a dummy in its mouth
  function npBaby(c, pn, t, x, y, s) {
    npAsL(t, x, y, 3, (Lp) => {
      mgPuppet(c, pn, Lp, t, { sc: s, light: dirAng(-1.2), tint: 0.36 });
      if (Lp.spec.look.build !== "potato" || Lp.spec.boss) return;
      const C = npCols(), ss = s * npGeo().lb;
      c.save(); pn.world(c);
      const P = npLocal(c, Lp, t, ss), er = P.w * 0.1, mx = P.head[0], my = P.head[1] + er * 2.4, lw = Math.max(0.5, 1.8 / (pn.z * ss)), suck = 1 + 0.08 * Math.sin(t * 0.03);
      c.strokeStyle = MG_INK; c.lineCap = "round";
      c.beginPath(); c.arc(mx, my + er * 1.5, er * 0.95, 0, NP_TAU); c.lineWidth = lw * 2.6; c.stroke(); c.strokeStyle = C.dummy; c.lineWidth = lw * 1.2; c.stroke();
      c.beginPath(); c.ellipse(mx, my, er * 2.0 * suck, er * 1.3 * suck, 0, 0, NP_TAU); c.fillStyle = C.dummy; c.fill(); c.strokeStyle = MG_INK; c.lineWidth = lw; c.stroke();
      c.beginPath(); c.arc(mx, my, er * 0.6, 0, NP_TAU); c.fillStyle = "#ffffff"; c.fill(); c.stroke();
      npSprout(c, P.head[0], -P.h + 3, 1.5, 1, lw, t);   // a new potato: a sprout on top
      c.restore();
    });
  }
  // a sprout: a stem and two leaves, k its growth (it pops up with a little boing)
  function npSprout(c, x, y, s, k, lw, t) {
    if (k <= 0.01) return;
    const C = npCols(), D = FIN.dir, sw = Math.sin(t * 0.009 + x) * 0.08;
    c.save(); c.translate(x, y); c.scale(s * D, s * k); c.rotate(sw); c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = MG_INK; c.lineWidth = 3.4 + lw * 2 / s; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-1.5, -6, 0.5, -11); c.stroke();
    c.strokeStyle = C.leafDk; c.lineWidth = 3.4; c.stroke();
    for (const [lx, ly, a] of [[-5, -12, -0.5], [6, -13, 0.5]]) {
      c.save(); c.translate(lx, ly); c.rotate(a);
      c.beginPath(); c.ellipse(0, 0, 5.4, 2.6, 0, 0, NP_TAU); c.fillStyle = C.leaf; c.fill(); c.strokeStyle = MG_INK; c.lineWidth = lw / s; c.stroke();
      c.restore();
    }
    c.restore();
  }
  // a baby's head peeking out (a little potato in his colour, round eyes, a sprout on top), r its size, o: { look -1..1, blink }
  function npBud(c, x, y, r, lw, t, o) {
    const C = npCols(), D = FIN.dir;
    c.save(); c.translate(x, y); c.scale(D, 1); c.lineJoin = "round";
    c.beginPath(); c.ellipse(0, 0, r, r * 1.08, 0, 0, NP_TAU); c.fillStyle = C.bud; c.fill(); c.strokeStyle = MG_INK; c.lineWidth = lw * 1.1; c.stroke();
    c.save(); c.clip(); c.fillStyle = mgTile(5, 0.35); c.beginPath(); c.ellipse(r * 0.35, r * 0.25, r * 0.9, r * 1.0, 0, 0, NP_TAU); c.ellipse(r * 0.05, -r * 0.1, r * 0.95, r * 0.95, 0, 0, NP_TAU, true);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fill(); c.restore(); c.restore();
    const er = r * 0.26;
    for (const sd of [-1, 1]) {
      const ex = sd * r * 0.36 - r * 0.08, ey = -r * 0.05;
      if (o.blink) { c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(ex - er, ey); c.quadraticCurveTo(ex, ey + er * 0.6, ex + er, ey); c.stroke(); continue; }
      c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, er * 0.85, er * 1.1, 0, 0, NP_TAU); c.fill(); c.lineWidth = lw * 0.7; c.stroke();
      c.fillStyle = MG_INK; c.beginPath(); c.arc(ex + (o.look || 0) * er * 0.35, ey + er * 0.15, er * 0.5, 0, NP_TAU); c.fill();
    }
    c.fillStyle = "rgba(255,120,120,0.55)"; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * r * 0.55 - r * 0.08, r * 0.38, r * 0.2, r * 0.12, 0, 0, NP_TAU); c.fill(); }
    c.restore();
  }
  // the ash heap: grey, dot-shaded underneath, his eyes in its front; o: { k growth, look, blink, e1, e2 (the embers, 0..1) }
  function npHeap(c, pn, x, lw, t, o) {
    const G = npGeo(), D = FIN.dir, k = o.k, hw = G.hw * (0.4 + 0.6 * k);
    if (k <= 0.01) return;
    const n = 18, line = (g) => { g.moveTo(x - hw, 0.5); for (let i = 1; i < n; i++) { const u = -1 + (2 * i) / n; g.lineTo(x + u * hw, npHeapY(u, k)); } g.lineTo(x + hw, 0.5); g.closePath(); };
    c.beginPath(); line(c); c.fillStyle = ASH2; c.fill();
    c.save(); c.clip();
    c.fillStyle = ASH; c.beginPath(); c.moveTo(x - hw * 1.1, 1); c.lineTo(x - hw * 1.1, -G.hh * k * 0.3); c.quadraticCurveTo(x, -G.hh * k * 0.42, x + hw * 1.1, -G.hh * k * 0.25); c.lineTo(x + hw * 1.1, 1); c.fill();
    c.beginPath(); line(c); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(6, 0.3); c.fill();
    c.restore();
    c.beginPath(); line(c); c.strokeStyle = MG_INK; c.lineWidth = lw * 1.3; c.lineJoin = "round"; c.stroke();
    c.fillStyle = MG_INK; for (const [fx, fy, fr] of [[-0.6, -0.25, 1.2], [0.45, -0.18, 1], [0.15, -0.72, 0.9], [0.7, -0.38, 0.8], [-0.3, -0.6, 0.8]]) { c.beginPath(); c.arc(x + D * fx * hw, fy * G.hh * k, fr, 0, NP_TAU); c.fill(); }
    // two embers in the ash, glowing, that blink and go out
    for (const [e, fx, fy] of [[o.e1, -0.38, -0.66], [o.e2, 0.5, -0.45]]) {
      if (e <= 0.02) continue;
      const ex = x + D * fx * hw, ey = fy * G.hh * k;
      c.globalAlpha = e; c.beginPath(); c.arc(ex, ey, 3.4, 0, NP_TAU); c.fillStyle = npCols().ring; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
      c.beginPath(); c.arc(ex, ey, 1.5, 0, NP_TAU); c.fillStyle = CORE; c.fill(); c.globalAlpha = 1;
    }
    // his eyes, in the front of the heap (Odin keeps his patch)
    const op = o.eyes, er = 5.6, patch = L_().spec.look.costume === "odin";
    if (op > 0.02) for (const sd of [-1, 1]) {
      const ex = x + sd * 10.5 - D * 2, ey = -G.hh * k * 0.42;
      if (patch && sd === -D) { c.fillStyle = MG_INK; c.beginPath(); c.ellipse(ex, ey, er * 1.05, er, 0, 0, NP_TAU); c.fill(); continue; }
      if (o.blink) { c.beginPath(); c.moveTo(ex - er, ey); c.quadraticCurveTo(ex, ey + er * 0.55, ex + er, ey); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke(); continue; }
      c.beginPath(); c.ellipse(ex, ey, er, er * 1.2 * op, 0, 0, NP_TAU); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = lw * 0.9; c.strokeStyle = MG_INK; c.stroke();
      c.beginPath(); c.arc(ex + (o.lx || 0) * er * 0.4, ey + (o.ly || 0) * er * 0.4, er * 0.5, 0, NP_TAU); c.fillStyle = MG_INK; c.fill();
      c.beginPath(); c.arc(ex + (o.lx || 0) * er * 0.4 - er * 0.18, ey + (o.ly || 0) * er * 0.4 - er * 0.22, er * 0.17, 0, NP_TAU); c.fillStyle = "#ffffff"; c.fill();
    }
  }
  // the Solar Dive ring: a thick band of fire (ink edge, accent, light, a white-hot line), its tongues licking outward, turning
  function npRing(c, x, y, r, t, lw) {
    if (r < 1) return;
    const C = npCols(), th = Math.max(3, r * 0.17), n = MG.slow ? 12 : 18, k = r / npGeo().Rr;
    c.lineJoin = "round";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * NP_TAU + t * 0.0014, f = 0.7 + 0.3 * Math.sin(t * 0.03 + i * 2.1), h = (r * 0.24 + 4) * f * (i % 2 ? 1 : 0.75);
      c.save(); c.translate(x + Math.cos(a) * (r + th * 0.35), y + Math.sin(a) * (r + th * 0.35)); c.rotate(a + Math.PI / 2);
      phxTongue(c, 0, 0, h, th * 0.5, Math.sin(t * 0.02 + i) * 2 * k, C.ring, C.ringCore, lw * 0.9); c.restore();
    }
    c.beginPath(); c.arc(x, y, r + th / 2, 0, NP_TAU); c.arc(x, y, Math.max(0.3, r - th / 2), 0, NP_TAU, true); c.fillStyle = C.ring; c.fill("evenodd"); c.lineWidth = lw * 1.4; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); c.arc(x, y, r + th * 0.22, 0, NP_TAU); c.arc(x, y, Math.max(0.2, r - th * 0.22), 0, NP_TAU, true); c.fillStyle = C.ringMid; c.fill("evenodd");
    c.beginPath(); c.arc(x, y, r, 0, NP_TAU); c.lineWidth = th * 0.16; c.strokeStyle = C.ringCore; c.stroke();
  }
  // a tear on her cheek, wiped away
  function npTear(c, pn, t) {
    const a = fe(NP.TEAR - 40, NP.TEAR, t) * (1 - fe(NP.TEAR + 260, NP.TEAR + 360, t));
    if (a <= 0.02) return;
    const W = W_(), D = FIN.dir, h = npAsW(t, (w) => pt(w, t, "head")), s = W.s.w * 0.07, y = h[1] + s * 1.5 + s * 3 * fe(NP.TEAR, NP.TEAR + 300, t), x = h[0] + D * s * 3.2, lw = Math.max(1.1, 3 / pn.z);
    pn.world(c); c.globalAlpha = a;
    c.beginPath(); c.moveTo(x, y - s * 1.4); c.quadraticCurveTo(x + s, y + s * 0.3, x, y + s * 0.85); c.quadraticCurveTo(x - s, y + s * 0.3, x, y - s * 1.4);
    c.fillStyle = "#dff0ff"; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = MG_INK; c.stroke(); c.globalAlpha = 1;
  }
  // a breeze from her wings to the babies: three soft curved strokes
  function npBreeze(c, t, ax, ay, bx, by, lw) {   // from her (a) toward the babies (b)
    const a = fe(NP.FAN, NP.FAN + 60, t) * (1 - fe(NP.FAN1 - 80, NP.FAN1, t));
    if (a <= 0.02) return;
    const L0 = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / L0, dy = (by - ay) / L0, nx = -dy, ny = dx, bend = FIN.dir * 5;
    c.save(); c.globalAlpha = a * 0.8; c.strokeStyle = MG_INK; c.lineWidth = lw; c.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const ph = ((t - NP.FAN) * 0.0035 + i / 3) % 1, o = (i - 1) * 10 + Math.sin(ph * 6) * 2, xa = ax + dx * L0 * ph * 0.6 + nx * o, ya = ay + dy * L0 * ph * 0.6 + ny * o, xb = xa + dx * L0 * 0.32, yb = ya + dy * L0 * 0.32;
      c.beginPath(); c.moveTo(xa, ya); c.quadraticCurveTo((xa + xb) / 2 + nx * bend, (ya + yb) / 2 + ny * bend, xb, yb); c.stroke();
    }
    c.restore();
  }
  function npDrawSplash(c, pn, t) {
    const G = npGeo(), D = FIN.dir, x = G.x, lw = Math.max(1.1, 3 / pn.z), r = npR(t), cy = -r - 6 * (r / G.Rr), heat = 1 - fe(NP.POOF - 120, NP.POOF + 80, t);
    pn.screen(c);
    // behind: dots, a paper disc and the focus lines round the ring (orange while it burns), then round the heap
    const q = pn.p(x, lerp(-G.Rr - 6, -14, fe(NP.CLOSE0, NP.PUSH + 120, t))), m = Math.min(pn.w, pn.h);
    phxTone(c, pn, 10, 0.22, (g) => { g.moveTo(q[0] + m * 0.7, q[1]); g.arc(q[0], q[1], m * 0.7, 0, NP_TAU); }, [t * 0.001, -t * 0.001]);
    c.beginPath(); c.arc(q[0], q[1], m * 0.52, 0, NP_TAU); c.fillStyle = MG_PAPER; c.fill();
    mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.5 + 0.3 * heat);
    ground(c, pn, t, 0);
    pn.world(c);
    // the ring and the loser asleep in its middle, closing down to its foot
    if (r > 0.5) {
      c.beginPath(); c.arc(x, cy, r, 0, NP_TAU); c.fillStyle = npCols().glow; c.fill();
      const s = G.lsc * (r / G.Rr);
      if (s > 0.08) npAsL(t, x, cy + L_().s.h * 0.5 * s * G.lb, 2, (Lp) => mgPuppet(c, pn, Lp, t, { sc: s, light: dirAng(-1.2), tint: 0.36, wash: [COL, 0.22] }));
      pn.world(c);
      npRing(c, x, cy, r, t, lw);
    }
    // poof: a bank of smoke where the ring closed, a flash
    const pk = fe(NP.POOF, NP.POOF + 300, t);
    if (pk > 0 && pk < 1) { pn.world(c); dust(c, pn, x, pk, 1 - fe(NP.POOF + 120, NP.POOF + 330, t)); }
    // the babies that peek out later are under the ash now: their sprouts pop up out of it (boing); then the first baby climbs out over the top
    const hk = easeOut(fe(NP.POOF + 10, NP.POOF + 90, t));
    pn.world(c);
    for (const [t0, tp, u, look] of [[NP.SPR1, NP.PEEK1, -0.38, -0.6], [NP.SPR2, NP.PEEK2, 0.42, -1]]) {
      if (t < t0) continue;
      const bx = x + D * u * G.hw, sy = npHeapY(u, 1), rr = 7.5, up = easeOut(fe(tp, tp + 110, t)), hy = sy + rr * 1.3 - rr * 1.9 * up, b = fe(t0, t0 + 300, t), boing = easeOut(fe(t0, t0 + 90, t)) * (1 + 0.35 * Math.sin(Math.PI * fe(t0 + 60, t0 + 300, t)) * (1 - b));
      if (up > 0.01) npBud(c, bx, hy, rr, lw, t, { look, blink: (t >= tp + 300 && t < tp + 370) });
      npSprout(c, bx, hy - rr * 0.95, 0.8, boing, lw, t);
    }
    const climb = ease(fe(NP.CLIMB, NP.OUT, t)), bs = G.bsc;
    if (t >= NP.CLIMB && t < NP.OUT) npBaby(c, pn, t, x + D * 2, npHeapY(0, 1) + 22 * (1 - climb), bs);
    pn.world(c);
    const e1 = t < 3700 ? (t > 3620 && ((t / 60) | 0) % 2 ? 0.35 : 1) : 1 - fe(3700, 3740, t), e2 = t < 3780 ? (t > 3700 && ((t / 60) | 0) % 2 ? 0.35 : 1) : 1 - fe(3780, 3820, t);
    const lookX = t < NP.SPR2 ? -0.5 * D : t < NP.CLIMB ? 0.5 * D : t < NP.TEAR ? -0.9 * D : -0.6 * D, lookY = t >= NP.SPR1 && t < NP.CLIMB + 60 ? -0.8 : 0.2;
    npHeap(c, pn, x, lw, t, { k: hk, eyes: fe(NP.POOF + 60, NP.POOF + 140, t), blink: (t >= 3720 && t < 3790) || (t >= 4300 && t < 4370), lx: lookX, ly: lookY, e1: hk * e1, e2: hk * e2 });
    // the first baby: hops down in front and sits (plop)
    if (t >= NP.OUT) {
      const u = ease(fe(NP.OUT, NP.PLOP, t)), sx = lerp(x + D * 2, G.bx, u), sy = lerp(npHeapY(0, 1), 0, u) - 18 * 4 * u * (1 - u);
      npBaby(c, pn, t, sx, sy, bs);
    }
    // the Phoenix: wings of fire while the ring burns, cooling as she watches; the tear, the fanning
    const sp = t < NP.POOF ? 1 : t < NP.FAN ? 0.7 : 0.62 + 0.38 * Math.sin((t - NP.FAN) * 0.03), hot = 1 - 0.55 * fe(NP.POOF, NP.POOF + 400, t);
    npAsW(t, () => phxWinner(c, pn, t, { light: dirAng(-1.2), spread: sp, heat: hot, flame: hot * (t < NP.POOF ? 1 : 0.4) }));
    npTear(c, pn, t);
    pn.world(c);
    const wq = npWAt(t);
    if (G.port) npBreeze(c, t, wq[0] + D * 8, wq[1] + 6, G.x - D * 12, -44, lw);
    else npBreeze(c, t, wq[0] + D * 30, -34, G.bx, -26, lw);
    const fl = 0.6 * (1 - fe(NP.POOF, NP.POOF + 110, t)) * (t >= NP.POOF ? 1 : 0);
    if (fl > 0.01) { pn.screen(c); c.fillStyle = `rgba(255,252,244,${fl.toFixed(3)})`; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); }
  }
  function npCam(t, pn) {
    const G = npGeo(), push = MG.reduced ? 0 : ease(fe(NP.PUSH, NP.PUSH + 240, t)), z = 1 + (G.kz - 1) * push, v = (G.port ? (200 * pn.h) / pn.w : 200) / z;
    return { wx: lerp(G.c0, G.c1, push), wy: (G.port ? 22 : 10) - v / 2, vh: v };
  }
  const npShake = (t) => { const a = 4 * fe(NP.POOF, NP.POOF + 15, t) * (1 - fe(NP.POOF + 40, NP.POOF + 240, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; };
  // panel 4: Rebirth's aftermath, a tiny watering can in her hand sprinkling the pot beside her: three babies in the soil, the middle one with the loser's face;
  // once he has popped out, the pot in two halves, the soil spilled, one sprout
  const npPotX = () => FIN.lx - FIN.dir * 10 + FIN.dir * 60;
  const NP_POT = { b: 19, t: 26, h: 24, rim: 6 };
  function npPotHalf(c, sd, lw, C) {   // one half of the pot (sd -1 the near-left half, 1 the right), drawn about its own foot
    const P = NP_POT;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(sd * P.b, 0); c.lineTo(sd * P.t, -P.h); c.lineTo(sd * (P.t + 3), -P.h); c.lineTo(sd * (P.t + 3), -P.h - P.rim); c.lineTo(0, -P.h - P.rim);
    for (let i = 1; i <= 4; i++) c.lineTo(sd * (i % 2 ? 2.5 : -1.5), -P.h - P.rim + (i * (P.h + P.rim)) / 4);
    c.closePath(); c.fillStyle = C.pot; c.fill(); c.lineWidth = lw * 1.1; c.strokeStyle = MG_INK; c.stroke();
  }
  function npPot(c, pn, t, x, lw, popped) {
    const C = npCols(), D = FIN.dir, P = NP_POT, top = -P.h - P.rim;
    c.save(); c.translate(x, 0); c.lineJoin = "round"; c.lineCap = "round";
    if (popped) {   // in two halves, the soil spilled between them, one sprout in it
      c.beginPath(); c.moveTo(-P.t * 1.3, 0.5); c.quadraticCurveTo(-P.t * 0.6, -9, 0, -10); c.quadraticCurveTo(P.t * 0.7, -9, P.t * 1.35, 0.5); c.closePath(); c.fillStyle = C.soil; c.fill(); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke();
      for (const sd of [-1, 1]) { c.save(); c.translate(sd * (P.b + 12), 0); c.rotate(sd * 1.05); c.translate(-sd * P.b, 0); npPotHalf(c, sd, lw, C); c.restore(); }
      c.restore();
      npSprout(c, x + D * 2, -9, 0.75, 1, lw, t);
      return;
    }
    // the back of the rim and the soil
    c.beginPath(); c.ellipse(0, top, P.t + 3, 4.5, 0, 0, NP_TAU); c.fillStyle = C.potDk; c.fill(); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); c.ellipse(0, top + 1, P.t + 0.5, 3.4, 0, 0, NP_TAU); c.fillStyle = C.soil; c.fill();
    c.restore();
    // the three babies: the side ones are buds in his colour, the middle one is him
    const wet = t >= MT.AFTER + 260 ? Math.sin((t - MT.AFTER) * 0.02) * 0.6 : 0;
    pn.world(c);
    npBud(c, x - D * 15, top - 4, 7, lw, t, { look: -1, blink: t >= 5000 && t < 5060 });
    npSprout(c, x - D * 15, top - 11, 0.7, 1 + 0.05 * wet, lw, t);
    npBud(c, x + D * 15, top - 3.5, 6.6, lw, t, { look: -0.5, blink: t >= 5120 && t < 5180 });
    npSprout(c, x + D * 15, top - 10.2, 0.68, 1 - 0.05 * wet, lw, t);
    npBaby(c, pn, t, x, top + 6, npGeo().bsc);
    pn.world(c); c.save(); c.translate(x, 0); c.lineJoin = "round";
    // the pot's front: terracotta, the rim band, a band of dots on the far side
    c.beginPath(); c.moveTo(-P.t, -P.h); c.lineTo(-P.b, 0); c.lineTo(P.b, 0); c.lineTo(P.t, -P.h); c.closePath(); c.fillStyle = C.pot; c.fill(); c.lineWidth = lw * 1.2; c.strokeStyle = MG_INK; c.stroke();
    c.save(); c.clip(); c.scale(D, 1); c.beginPath(); c.rect(P.b * 0.35, -P.h - 2, P.t, P.h + 4); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(6, 0.4); c.fill(); c.restore();
    c.beginPath(); c.rect(-P.t - 3, top, (P.t + 3) * 2, P.rim); c.fillStyle = C.potHi; c.fill(); c.lineWidth = lw * 1.2; c.stroke();
    c.restore();
  }
  // the watering can in her front hand, tipped toward the pot; drops arc from its rose
  function npCan(c, pn, t, lw) {
    const W = W_(), C = npCols(), D = FIN.dir, h = pt(W, t, "hF"), tip = ease(fe(MT.AFTER + 200, MT.AFTER + 360, t)) * (1 - ease(fe(MT.POP - 120, MT.POP, t))), s = W.s.w * 0.016;
    pn.world(c); c.save(); c.translate(h[0], h[1]); c.scale(D * s, s); c.rotate(0.55 * tip); c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = MG_INK;
    c.beginPath(); c.arc(-6, -12, 8, Math.PI, 0); c.lineWidth = 4.2; c.stroke(); c.strokeStyle = C.canDk; c.lineWidth = 2; c.stroke(); c.strokeStyle = MG_INK;   // the handle
    c.beginPath(); c.moveTo(8, -8); c.lineTo(30, -24); c.lineWidth = 6.4; c.stroke(); c.strokeStyle = C.can; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = MG_INK;   // the spout
    c.beginPath(); c.ellipse(32, -25.5, 4.4, 2.6, -0.65, 0, NP_TAU); c.fillStyle = C.canDk; c.fill(); c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.roundRect(-18, -12, 26, 18, 4); c.fillStyle = C.can; c.fill(); c.lineWidth = 2; c.stroke();   // the body
    c.beginPath(); c.moveTo(-14, -6); c.lineTo(4, -6); c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 2; c.stroke();
    c.restore();
    if (tip < 0.6) return;
    const P = npPotX(), a = 0.55 * tip, ca = Math.cos(a), sa = Math.sin(a), rose = [h[0] + D * s * (32 * ca + 25.5 * sa), h[1] + s * (32 * sa - 25.5 * ca)];
    c.fillStyle = C.water; c.strokeStyle = MG_INK; c.lineWidth = Math.max(0.6, 1.4 / pn.z);
    for (let i = 0; i < 6; i++) {
      const u = ((t * 0.0025 + i / 6) % 1), dx = (P - rose[0]) * u + (i % 3 - 1) * 2.5 * u, dy = (-NP_POT.h - NP_POT.rim - 6 - rose[1]) * u * u;
      c.beginPath(); c.ellipse(rose[0] + dx, rose[1] + dy, 1.3, 1.9, 0, 0, NP_TAU); c.fill(); c.stroke();
    }
  }
  function npDrawAfter(c, pn, t) {
    drawAfter(c, pn, t);
    const lw = Math.max(1.1, 3 / pn.z), popped = mgPopped(t);
    npPot(c, pn, t, npPotX(), lw, popped);
    npCan(c, pn, t, lw);
  }

  S_.alt2 = Object.assign({}, S_, {
    name: "New Potatoes",
    start(g) { S_.start(g); pota2 = true; npGc = null; npC = null; npIn = 0; },
    end() { S_.end(); pota2 = false; npGc = null; npC = null; npIn = 0; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), inset = by("inset"), strike = by("strike"), after = by("after"), D = FIN.dir;
      inset.freeze = MT.STRIKE + 130;              // the strike panel has slid over it by then: drawn once, then a bitmap
      strike.freeze = strike.cover = MT.SPLASH;   // the splash covers the whole page from here: the strike is drawn once more, then a bitmap
      after.draw = npDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 118 : 96) * (1 - 0.05 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.lx - D * 10 + D * (lay.port ? 40 : 44), wy: -0.42 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: MG_PAPER, slide: MG.reduced ? 1 : 180, cam: npCam, shake: npShake, draw: npDrawSplash }));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, ms = lay.port ? Math.min(0.5, (0.86 * L.gw) / (6 * 0.15 * L.gh * 0.72)) : 1, small = lay.port ? 0.62 : 1;
      ws[3].t1 = MT.SPLASH + 150;   // DOOOM is gone as the splash comes up
      const sp = (t, w) => { const pn = MG.byId.splash; mgPlace(pn, t); return pn.sp(w[0], w[1]); };
      ws.push(
        { text: "FWOOSH", t0: NP.RING, t1: NP.POOF + 40, size: 0.15, mul: ms, arc: 1.4, jag: 0.08, fill: "#ffd27a", rot: -0.05 * D,
          at: (t) => { const G = npGeo(); return sp(t, [G.x, -2 * G.Rr - 6]); } },
        { text: "poof", t0: NP.POOF, t1: NP.SPR1 + 200, size: 0.07, mul: small, jit: 0.12, rot: 0.1 * D,
          at: (t) => { const G = npGeo(), q = sp(t, [G.x + D * G.hw * 1.1, -G.hh * 1.5]), hw = phxHalf("poof", 0.07, small); q[0] = clamp(q[0], hw + 4, L.gw - hw - 4); return q; } },
        { text: "boing", t0: NP.SPR1, t1: NP.SPR2 + 120, size: 0.07, mul: small, jag: 0.14, rot: -0.12 * D,
          at: (t) => { const G = npGeo(); return sp(t, [G.x - D * G.hw * 0.6, -G.hh * 2.1]); } },
        { text: "plop", t0: NP.PLOP, t1: NP.TEAR + 60, size: 0.07, mul: small, jit: 0.12, rot: 0.08 * D,
          at: (t) => { const G = npGeo(), q = sp(t, [G.bx + D * 10, -50]), hw = phxHalf("plop", 0.07, small); q[0] = clamp(q[0], hw + 4, L.gw - hw - 4); return q; } },
        { text: "aww", t0: NP.TEAR, t1: NP.FAN1 + 40, size: 0.07, mul: small, jit: 0.1, rot: -0.1 * D,
          at: (t) => { const q = npWAt(t), W = W_(); return sp(t, [q[0] + D * W.s.w * 1.1, q[1] - W.s.h * 1.15]); } },
      );
      return ws;
    },
    pose(P, sk, t, role, p) {
      if (npIn === 1 && role === "w") return npPose(P, sk, t);
      if (npIn >= 2 && role === "l") return npLPose(P, sk, t, npIn);
      const r = S_.pose(P, sk, t, role, p);
      if (role !== "w" || t < MT.AFTER) return r;
      // panel 4: the watering can held out toward the pot, the other hand on her hip
      const w = sk.w, leg = sk.leg, tor = sk.tor, up = ease(fe(MT.AFTER + 60, MT.AFTER + 450, t));
      return { hF: [w * (0.7 + 0.1 * up), -leg - tor * (0.2 + 0.85 * up)], hB: [-w * 0.6, -leg - tor * (0.1 + 0.16 * up)], fF: r.fF, fB: r.fB };
    },
    food() { const x = npPotX(); return { x, y: 0, r: 24, y0: -28, lx: x + FIN.dir * 40 }; },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("npUp", MT.SPLASH + 40, () => Cin.go(() => Cin.page()));
      cueOnce("npFwoosh", NP.RING, () => Cin.go(() => { Cin.whoosh(0.5, -0.4 * D, 0.4 * D, 0.45); Cin._noise(0.7, 0.2, 1400, 600, "bandpass", 0.9); }));
      cueOnce("npClose", NP.CLOSE0, () => Cin.go(() => Cin.riser(0.26, 0.18)));
      cueOnce("npPoof", NP.POOF, () => Cin.go(() => { Cin._noise(0.3, 0.4, 900, 260, "lowpass"); Cin._osc("sine", 220, 90, 0.2, 0.15, 0.003); }));
      cueOnce("npEmber1", 3700, () => Cin.go(() => Cin.tick(3200)));
      cueOnce("npEmber2", 3780, () => Cin.go(() => Cin.tick(3400)));
      cueOnce("npBoing1", NP.SPR1, () => Cin.go(() => { Cin._osc("sine", 300, 900, 0.14, 0.12, 0.004); Cin._osc("sine", 900, 420, 0.2, 0.06, 0.004, 0.12); }));
      cueOnce("npBoing2", NP.SPR2, () => Cin.go(() => { Cin._osc("sine", 360, 1080, 0.14, 0.11, 0.004); Cin._osc("sine", 1080, 500, 0.2, 0.05, 0.004, 0.12); }));
      cueOnce("npClimb", NP.CLIMB, () => Cin.go(() => { for (let i = 0; i < 3; i++) Cin._osc("triangle", 700 + i * 90, 640, 0.05, 0.03, 0.002, i * 0.05); }));
      cueOnce("npPlop", NP.PLOP, () => Cin.go(() => Cin._osc("sine", 420, 160, 0.12, 0.14, 0.003)));
      cueOnce("npPeek1", NP.PEEK1, () => Cin.go(() => Cin.tick(2900)));
      cueOnce("npPeek2", NP.PEEK2, () => Cin.go(() => Cin.tick(3300)));
      cueOnce("npAww", NP.TEAR, () => Cin.go(() => { Cin._osc("triangle", 520, 640, 0.25, 0.05, 0.03); Cin._osc("triangle", 640, 440, 0.35, 0.05, 0.03, 0.22); }));
      cueOnce("npFan", NP.FAN, () => Cin.go(() => Cin.whoosh(0.3, 0.3 * D, -0.3 * D, 0.2)));
      cueOnce("npWater", MT.AFTER + 300, () => Cin.go(() => Cin._noise(0.6, 0.05, 2400, 4800, "bandpass", 1.5)));
    },
  });
  return S_;
})();
