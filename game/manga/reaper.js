/* ===================== Manga page: Reaper, "Last Rites" =====================
   Script for the engine in ui/manga.js (Jonny's plan: the one page that inverts). Times are ms after the final hit.
   The page turns into a negative: near-black paper, white ink, one spot colour, candle amber, on his cheeks and on the loser's soul.
   How: every panel is drawn as on any page (ink on paper), then page(c, t) (the engine's last pass over the page) turns the whole page over
   with one "difference" fill; the puppets are drawn grey (mgPuppet's mono), their eyes redrawn so that once turned they are white with a dark
   pupil, the picture of the hit is swapped for a grey copy that stays dark once turned, a covered panel dims toward white (dark once turned),
   and the amber inside a panel is drawn in its complement (NCOL) so it comes out amber. Over the page (words, the soul, the stroke, the card)
   nothing is turned: drawn as it should look.
   Words: the hit's (SHUNK / WHAK), gooong, SHHK, shhh...
   300 the freeze (panel 1, engine picture, colour) . 840 the bell tolls and the dark spreads from the hit over the whole page (to 1180), the colour
   drains with it . 1250 panel 2 "the look": a white moon, the scythe rises behind his hood (bladed back over it, as in the picture) while the loser's
   shadow stretches up the wall behind him . 2000 inset: his face, the sly smirk, amber cheeks; at 2180 the smirk widens and a glint . 2350 panel 3:
   he glides in, the scythe drawn back low behind him; 2780 the silence; 2900 the hook: impact frames, one white crescent across the whole page
   (SHHK, the echo of the reach crescent his scythe shows while charging) . 2990 the loser flies along the real launch direction (Last Rites: up,
   out through the top border) and his soul stays behind, amber, then drifts up and out through the top border . 3500 panel 4: scythe on his
   shoulder, eyes closed for a moment (shhh...), a tombstone pops out of the paper with the loser's name and R.I.P.; the cheeky smirk comes back.
   Script fields: col, name, flight, panels(lay), words(lay), start(g), build(lay), step(t, k), pose(P, sk, t, role, p), page(c, t), hint(t), over(o, t),
   cues(t), impact(o, pn, sil, t), hitPt(). Every helper of this page is prefixed rpr. */
MANGA.reaper = (function () {
  const COL = "#ffb444", HOT = "#ffe2a8", INK = MG_INK, PAPER = MG_PAPER, TAU = Math.PI * 2;
  // a colour drawn inside a panel comes out as its complement once the page is turned: so amber is painted as its complement
  const neg = (hex) => "#" + (0xffffff ^ parseInt(hex.slice(1), 16)).toString(16).padStart(6, "0");
  const NCOL = neg(COL), NHOT = neg(HOT), NIGHT = "#0e131d";   // NIGHT: the paper once turned (what the overlay paints to match the page)
  const HIT = MT.HIT, TOLL = 840, TURNED = 1180, RISE0 = 1330, RISE1 = 2150, SMIRK = 2180, GLIDE0 = 2420, GLIDE1 = 2800, SETTLE = 3260,
    HUSH = 3640, HUSH1 = 3990, STONE = 3720, GAP = 64;
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const BOX = [-112, -132, 112, 20];   // what he and his scythe can cover (world units about the feet)
  const own = new WeakMap();           // this page's canvases live and die with the engine's picture of the hit (freed at the end of the page)
  const box = () => { let b = own.get(MG.snap); if (!b) { b = {}; own.set(MG.snap, b); } return b; };
  let dust = [], motes = [], soul = null, cornerT = TURNED, stoneName = "", stoneFont = 5, tear2 = null;

  /* ---- where things are (world units), from the puppets' own poses ---- */
  function rprPt(p, t, key, dx, dy) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot([P[key][0] + (dx || 0), P[key][1] + (dy || 0)], P.hip, P.lean);
    return [p.x + p.facing * q[0], p.y + q[1]];
  }
  const glideK = (t) => ease(fe(GLIDE0, GLIDE1, t));
  const wX = (t) => FIN.wx + FIN.dir * (130 - GAP) * glideK(t);   // he glides up to the loser before the hook
  const loserAt = (tt) => { if (tt < FIN.launch) return [FIN.lx - (tt >= HIT ? FIN.dir * 5 : 0), 0]; const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr]; };
  const rprTone = (c, pn, poly, size, cover, drift) => mgToneFill(c, poly.map(([x, y]) => [x + pn.ox, y + pn.oy]), size, cover, drift);
  const rprDisc = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);
  const rprRng = (seed) => { const r = mgRng(Math.imul(seed + 1, 2654435761) >>> 0); r(); r(); return r; };

  /* ---- grey copies (once per page) ---- */
  function rprGrey(src) {   // the saturation blend with black keeps the luminance and drops the colour
    const a = mgCanvas(src.width, src.height), x = a.getContext("2d");
    x.drawImage(src, 0, 0); x.globalCompositeOperation = "saturation"; x.fillStyle = "#000"; x.fillRect(0, 0, a.width, a.height); x.globalCompositeOperation = "source-over";
    return a;
  }
  // the inked hit for the turned page: a dark game picture turned over would come out light, so it is screened with itself first
  // (once turned that is the negative squared: the darks stay dark, the ink and the dots come out white)
  function rprScreen(a) { const x = a.getContext("2d"); x.globalCompositeOperation = "screen"; x.drawImage(a, 0, 0); x.globalCompositeOperation = "source-over"; return a; }
  // the eyes, redrawn for the negative: once turned a white eye with a dark grey iris, a dark pupil and a white catch light (as a page inked
  // white on black would have them), not the photographic negative's black eye with a white pupil. Same geometry as potatoFace in
  // draw-fighters.js; the heavy lid and the outline stay as drawn (the repaint is cut to the eye, below the lid).
  function rprEyes(lc, X, p, P) {
    const ex = P.expr || "", look = p.spec.look, style = look.face, cos = look.costume;
    if (ex === "ko" || ex === "calm" || ex === "dazed" || p.state === "hitstun" || P.spin) return;
    const w = P.w, [hx, hy] = P.head, er = w * 0.1, xk = P.exK === undefined ? 1 : P.exK;
    lc.save();
    lc.setTransform(X.z * p.facing, 0, 0, X.z, X.sx + P.jit[0] * X.z, X.sy + (P.jit[1] - P.hop) * X.z);
    lc.translate(P.hip[0], P.hip[1]); lc.rotate(P.lean); lc.translate(-P.hip[0], -P.hip[1]);
    [[hx - w * 0.14, hy], [hx + w * 0.13, hy]].forEach((e, i) => {
      if (cos === "odin" && i === 0) return;   // the eyepatch
      let k = style === "eager" ? 1.1 : 1, hk = style === "focused" ? 0.8 : 1, pk = 1;
      if (ex === "terror") { k *= 1 + 0.5 * xk; hk = 1; pk = 1 - 0.7 * xk; } else if (ex === "rage") hk = 0.8; else if (ex === "grin") hk = 0.88;
      const lid = ex ? ex === "rage" || ex === "grin" : style === "focused" || style === "fierce" || style === "sly", sd = i ? 1 : -1;
      lc.save();
      lc.beginPath(); lc.ellipse(e[0], e[1], er * k * 0.94, er * 1.15 * k * hk * 0.94, 0, 0, TAU); lc.clip();
      if (lid) { lc.beginPath(); lc.moveTo(e[0] - er * 1.3, e[1] - er * (0.25 - sd * 0.3)); lc.lineTo(e[0] + er * 1.3, e[1] - er * (0.25 + sd * 0.3)); lc.lineTo(e[0] + er * 1.3, e[1] + er * 2); lc.lineTo(e[0] - er * 1.3, e[1] + er * 2); lc.closePath(); lc.clip(); }
      lc.fillStyle = INK; lc.fillRect(e[0] - er * 2, e[1] - er * 2, er * 4, er * 4);
      const px = e[0] + er * 0.15, py = e[1] + er * 0.1;
      lc.fillStyle = "#c4c4c4"; lc.beginPath(); lc.arc(px, py, er * 0.68 * k * hk * (ex === "terror" ? 0.5 + 0.5 * pk : 1), 0, TAU); lc.fill();
      lc.fillStyle = PAPER; lc.beginPath(); lc.arc(px, py, er * 0.38 * k * hk * pk, 0, TAU); lc.fill();
      lc.fillStyle = INK; lc.beginPath(); lc.arc(e[0] + er * 0.4, e[1] - er * 0.25, er * 0.22, 0, TAU); lc.fill();
      lc.restore();
    });
    lc.restore();
  }
  // his cheeks, candle amber (painted as the complement: the page turns afterwards), with three blush strokes of ink (white once turned)
  function rprCheeks(lc, X, p, P, k) {
    const w = P.w, er = w * 0.1, [hx, hy] = P.head, f = p.facing;
    for (const [cx, cy] of [[hx - w * 0.14 - er * 0.4, hy + er * 1.75], [hx + w * 0.13 + er * 0.55, hy + er * 1.75]]) {
      const q = rot([cx, cy], P.hip, P.lean), x = X.sx + (P.jit[0] + f * q[0]) * X.z, y = X.sy + (q[1] - P.hop + P.jit[1]) * X.z, rx = er * 1.05 * X.z, ry = er * 0.66 * X.z;
      lc.fillStyle = rgba(NCOL, Math.min(1, 0.95 * k)); lc.beginPath(); lc.ellipse(x, y, rx, ry, f * P.lean, 0, TAU); lc.fill();
      lc.fillStyle = rgba(NHOT, 0.85 * k); lc.beginPath(); lc.ellipse(x - rx * 0.18, y - ry * 0.2, rx * 0.45, ry * 0.4, f * P.lean, 0, TAU); lc.fill();
      if (k > 0.4 && X.ze > 1.6) {
        lc.strokeStyle = rgba(INK, Math.min(1, (k - 0.4) * 2)); lc.lineWidth = Math.max(1, er * 0.16 * X.z); lc.lineCap = "round"; lc.beginPath();
        for (const d of [-0.5, 0, 0.5]) { const ax = x + d * rx * 0.9, ay = y; lc.moveTo(ax + rx * 0.16, ay - ry * 0.55); lc.lineTo(ax - rx * 0.16, ay + ry * 0.55); }
        lc.stroke();
      }
    }
  }
  function rprPost(p, t, cheek) {
    MG.pt = t;
    const P = pose(p, mgTk(t));
    return (lc, X) => { rprEyes(lc, X, p, P); if (cheek > 0.01) rprCheeks(lc, X, p, P, cheek); };
  }
  const cheekK = (t) => 0.75 + 0.25 * fe(SMIRK, SMIRK + 160, t);

  /* ---- panels ---- */
  function panels(lay) {
    const port = lay.port, D = FIN.dir;
    return [
      { id: "look", t0: MT.LOOK, from: "w", freeze: MT.STRIKE, cover: MT.STRIKE, dim: "255,255,255",
        poly: port ? [[0, 0], [1, 0], [1, 0.39], [0, 0.42]] : [[0, 0], [0.46, 0], [0.42, 1], [0, 1]],
        // a tall panel (1280x760) shows more height: widen the view so the moon, the blade and the shadow's base all stay in
        cam: (t, pn) => { const v0 = Math.max(port ? 140 : 128, 124 * pn.h / pn.w), vh = v0 * (1 - 0.07 * fe(MT.LOOK, MT.STRIKE, t)); return { wx: FIN.wx + D * (port ? 10 : 14), wy: 4 - vh / 2 - (v0 - 128) * 0.08, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "t", slide: 150, freeze: MT.STRIKE, cover: MT.STRIKE, dim: "255,255,255",
        poly: port ? [[0.47, 0.29], [0.98, 0.27], [0.98, 0.5], [0.45, 0.52]] : [[0.625, 0.05], [0.975, 0.02], [0.96, 0.47], [0.605, 0.5]],
        cam: (t) => { const h = rprPt(W_(), Math.min(t, MT.STRIKE), "head"); return { wx: h[0] + FIN.dir * 1.5, wy: h[1] + 3, vh: 31 - 4 * ease(fe(MT.INSET, MT.STRIKE, t)) }; },
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.AFTER, cover: MT.AFTER, dim: "255,255,255",
        poly: port ? [[0, 0.38], [1, 0.41], [1, 0.74], [0, 0.72]] : [[0, 0.37], [1, 0.3], [1, 1], [0, 1]],
        cam: (t) => { const k = ease(fe(MT.STRIKE, HIT, t)), vh = (port ? 205 : 150) * (1 - 0.06 * k); return { wx: FIN.wx + D * (port ? 92 : 78 + 10 * k), wy: -(port ? 0.36 : 0.33) * vh, vh }; },
        shake: (t) => { const a = 4 * fe(HIT + 100, HIT + 130, t) * (1 - fe(HIT + 130, HIT + 400, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a * 0.6] : [0, 0]; },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b", live: true,
        poly: port ? [[0, 0.69], [1, 0.67], [1, 1], [0, 1]] : [[0, 0.43], [0.64, 0.4], [0.6, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 112 : 96) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: wX(t) + D * (port ? 30 : 28), wy: -0.43 * vh, vh }; },
        draw: drawAfter },
    ];
  }

  /* ---- shared scenery: the night ground (paper under a white horizon once turned), a light screen of sky, the moon ---- */
  function rprGround(c, pn, t) {
    const gy = pn.p(FIN.wx, 0)[1];
    if (gy < pn.y1 + 4) {
      c.fillStyle = INK; c.fillRect(pn.x0 - 6, gy - 1.2, pn.w + 12, Math.max(2, pn.z * 0.9));
      pn.world(c); c.strokeStyle = INK; c.lineCap = "round";
      const r = rprRng(77), D = FIN.dir;
      for (let i = 0; i < 18; i++) { const x = FIN.wx + D * (-260 + r() * 640), y = 4 + r() * 18, len = 8 + r() * 30; c.lineWidth = 0.5 + r() * 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + D * len, y + (r() - 0.5) * 0.6); c.stroke(); }
      c.beginPath();
      for (let x = FIN.wx - 300; x < FIN.wx + 420; x += 11) { const h = 2 + ((x * 7919) % 4); c.moveTo(x, 0.4); c.lineTo(x + 2.2, -h); c.lineTo(x + 4.6, 0.4); }
      c.fillStyle = INK; c.fill();
      pn.screen(c);
    }
  }
  function rprSky(c, pn, t, depth) {
    if (MG.slow) return;
    rprTone(c, pn, [[pn.x0 - 6, pn.y0 - 6], [pn.x1 + 6, pn.y0 - 6], [pn.x1 + 6, pn.y0 + pn.h * depth], [pn.x0 - 6, pn.y0 + pn.h * depth * 1.15]], 11, 0.07, [t * 0.0006, 0]);
  }
  // the moon: an ink disc (white once turned) with a few craters of tone and a thin paper ring
  function rprMoon(c, x, y, r) {
    c.fillStyle = INK; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = PAPER; c.lineWidth = Math.max(1.5, r * 0.05); c.beginPath(); c.arc(x, y, r * 0.9, 0, TAU); c.stroke();
    c.fillStyle = PAPER;
    for (const [dx, dy, s] of [[-0.3, -0.2, 0.16], [0.25, 0.1, 0.11], [-0.05, 0.38, 0.09], [0.35, -0.35, 0.07]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, s * r, 0, TAU); c.fill(); }
  }

  /* ---- panel 1: the real hit (engine picture, in colour); the night spreads over it as a dark grey copy (turned with the page) ---- */
  function drawHit(c, pn, t) {
    const ink = MG.inkOK ? easeOut(fe(MT.FREEZE + 30, MT.INKED - 40, t)) : 0, life = easeOut(fe(MT.FREEZE, MT.END, t)), s = 1 + 0.07 * life, ix = MG.ix, iy = MG.iy, B = box(), k = fe(TOLL, TURNED, t);
    if (k > 0 && !B.inkG && MG.inkOK) B.inkG = rprScreen(rprGrey(MG.ink));   // (normally made in the hold by the build queue)
    const G = B.inkG, push = () => { c.translate(ix, iy); c.scale(s, s); c.translate(-ix, -iy); };
    if (k < 1 || !G) {
      c.save(); push();
      if (ink < 1) c.drawImage(MG.snap, 0, 0, L.gw, L.gh);
      if (ink > 0) { c.globalAlpha = ink; c.drawImage(MG.ink, 0, 0, L.gw, L.gh); }
      c.restore();
    }
    if (k > 0 && G) {
      c.save();
      if (k < 1) { c.setTransform(1, 0, 0, 1, 0, 0); rprPool(c, k); c.clip(); c.setTransform(DPR, 0, 0, DPR, DPR * pn.ox, DPR * pn.oy); }
      push(); c.drawImage(G, 0, 0, L.gw, L.gh);
      c.restore();
    }
    if (ink > 0) { const R = Math.hypot(Math.max(ix, L.gw - ix), Math.max(iy, L.gh - iy)); mgFocus(c, ix, iy, R, t * 0.00035, 0.9 * ink); }
  }

  /* ---- panel 2: the look. The moon, the scythe rising behind his hood, the loser's shadow stretching up the wall behind him ---- */
  function drawLook(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    rprSky(c, pn, t, 0.5);
    const m = pn.p(FIN.wx - D * 10, -97);
    rprMoon(c, m[0], m[1], 25 * pn.z);
    rprShadow(c, pn, t);
    rprGround(c, pn, t);
    mgPuppet(c, pn, W, t, { light: dirAng(-0.6), box: BOX, mono: true, post: rprPost(W, t, cheekK(t)) });
    pn.screen(c);
    // a glint runs along the blade as it tops the hood
    const g = Math.sin(Math.PI * fe(RISE1 - 120, RISE1 + 260, t));
    if (g > 0.02) { const tip = rprBladeTip(W, t), q = pn.p(tip[0], tip[1]); rprStar(c, q[0], q[1], (4 + 8 * g) * pn.z / 3.2); }
  }
  // the tip of the blade (world), from the scythe's own geometry (SCY in draw-fighters.js)
  function rprBladeTip(p, t) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), a = P.holdAng == null ? -1.75 : P.holdAng, q = scyTipAt(P.hF, a, P.bladeS == null ? 1 : P.bladeS, P.w, P.scyK == null ? 1 : P.scyK);
    return [p.x + p.facing * q[0], p.y + q[1]];
  }
  function rprStar(c, x, y, s) {   // a four-point glint: ink (white once turned) with a paper core
    c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.2, y - s * 0.2); c.lineTo(x + s, y); c.lineTo(x + s * 0.2, y + s * 0.2); c.lineTo(x, y + s); c.lineTo(x - s * 0.2, y + s * 0.2); c.lineTo(x - s, y); c.lineTo(x - s * 0.2, y - s * 0.2); c.closePath();
    c.fillStyle = INK; c.fill();
  }
  // the loser's shadow on the wall behind him: his own silhouette (drawn once, with an ink edge and close horizontal hatching, white once turned),
  // stretched up and leaning over the Reaper: one blit a frame
  const SH_BOX = [-64, -118, 64, 8];
  function rprShadowSprite(pn) {
    const B = box();
    if (B.shSpr) return B.shSpr;
    const Lp = L_(), zs = pn.z * DPR, w = Math.ceil((SH_BOX[2] - SH_BOX[0]) * zs), h = Math.ceil((SH_BOX[3] - SH_BOX[1]) * zs);
    const sil = mgCanvas(w, h), sx = sil.getContext("2d"), spr = mgCanvas(w, h), x = spr.getContext("2d");
    sx.setTransform(zs, 0, 0, zs, -SH_BOX[0] * zs, -SH_BOX[1] * zs);
    MG.pt = 2100; drawFighter(sx, Lp, mgTk(2100), [0, 0]); sx.setTransform(1, 0, 0, 1, 0, 0);
    const e = 2 * DPR;   // the edge: the silhouette grown by e px all round, minus the silhouette
    for (let i = 0; i < 8; i++) x.drawImage(sil, Math.cos(i * TAU / 8) * e, Math.sin(i * TAU / 8) * e);
    x.globalCompositeOperation = "source-in"; x.fillStyle = INK; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "destination-out"; x.drawImage(sil, 0, 0);
    sx.globalCompositeOperation = "source-in"; sx.fillStyle = INK;   // the hatching inside
    const gap = 3.1 * DPR, th = Math.max(1, 1.15 * DPR);   // (one path, one fill: each fill in source-in clears whatever lies outside it)
    sx.beginPath(); for (let y = gap * 0.5; y < h; y += gap) sx.rect(0, y, w, th);
    sx.fill();
    x.globalCompositeOperation = "source-over"; x.drawImage(sil, 0, 0);
    B.shSpr = { cv: spr, zs };
    return B.shSpr;
  }
  function rprShadow(c, pn, t) {
    const k = ease(fe(MT.LOOK + 60, 2250, t)), stretch = 1.05 + 0.75 * k, lean = 0.12 + 0.3 * k, D = FIN.dir;
    const spr = rprShadowSprite(pn), [fx, fy] = pn.p(FIN.wx + D * 47, 0.5), tr = Math.sin(t * 0.045) * 0.4 * pn.z * fe(MT.INSET, MT.STRIKE, t);   // it trembles with him
    const zz = pn.z * DPR / spr.zs;
    c.save(); c.globalAlpha = Math.min(1, 0.3 + 0.9 * fe(MT.LOOK, MT.LOOK + 400, t));
    c.setTransform(zz, 0, D * lean * zz * stretch, zz * stretch, (fx + tr + pn.ox) * DPR, (fy + pn.oy) * DPR);
    c.drawImage(spr.cv, SH_BOX[0] * spr.zs, SH_BOX[1] * spr.zs);
    c.restore();
  }

  /* ---- the inset: his face, the sly smirk; the cheeks glow up, the smirk widens, a glint ---- */
  function drawInset(c, pn, t) {
    const W = W_(), tt = Math.min(t, MT.STRIKE);
    pn.screen(c);
    const [hx, hy] = pn.p(...rprPt(W, tt, "head"));
    mgFocus(c, hx, hy, Math.hypot(pn.w, pn.h) * 0.85, t * 0.0004, 0.55);
    mgPuppet(c, pn, W, tt, { light: dirAng(-0.6), tint: 0.5, box: BOX, mono: true, post: rprPost(W, tt, cheekK(tt)) });
    pn.screen(c);
    // the glint in his front eye as the smirk widens
    const g = Math.sin(Math.PI * fe(SMIRK + 10, SMIRK + 300, t));
    if (g > 0.02) { MG.pt = tt; const P = pose(W, mgTk(tt)), e = pn.p(...rprPt(W, tt, "head", P.w * 0.13 + P.w * 0.04, -P.w * 0.04)); rprStar(c, e[0], e[1], (3 + 7 * g) * pn.z / 3.4); }
  }

  /* ---- panel 3: the hook ---- */
  function drawStrike(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    rprSky(c, pn, t, 0.42);
    const m = pn.p(FIN.wx + D * 210, -112);
    rprMoon(c, m[0], m[1], 21 * pn.z);
    // the ground he glides over: a few streaks of his passing
    rprGround(c, pn, t);
    if (t > GLIDE0 && t < HIT + 200) {   // the glide: speed lines behind him, low, fading as he stops
      const a = 0.45 * Math.sin(Math.PI * fe(GLIDE0, GLIDE1 + 60, t)), q = pn.p(wX(t) - D * 46, -34);
      if (a > 0.02) mgSpeed(c, q[0], q[1], 70 * pn.z, 46 * pn.z, D > 0 ? 0 : Math.PI, -t * 0.5 * D, a, false, 0.7);
    }
    if (t >= HIT + 100) { const hp = pn.p(FIN.lx, -34); mgFocus(c, hp[0], hp[1], Math.hypot(pn.w, pn.h), t * 0.0005, 0.6 * (1 - fe(HIT + 100, 3400, t))); }
    mgPuppet(c, pn, W, t, { light: dirAng(-0.55), box: BOX, mono: true, post: rprPost(W, t, cheekK(t)) });
    if (!MG.broke) rprLoser(c, pn, t);
    pn.screen(c);
    // where the blade caught him: a white burst, after the impact frames
    const hb = fe(HIT + 100, HIT + 280, t);
    if (hb > 0 && hb < 1) { const q = pn.p(FIN.lx - D * 4, -36); mgStarburst(c, q[0], q[1], (34 - 26 * hb) * pn.z / 1.7, 0.3); }
  }
  // the loser: terror, the white freeze of the hit, then out along the real launch direction with three ghosts
  function rprLoser(c, pn, t) {
    const Lp = L_();
    if (FIN.out || Lp.state === "gone") return;
    const fl = t >= FIN.launch;
    let ghosts = null;
    if (fl && !MG.slow) { const b = pn.p(...loserAt(t)); ghosts = [70, 46, 23].map((dt) => { const a = pn.p(...loserAt(t - dt)); return [a[0] - b[0], a[1] - b[1], 0.26 - dt * 0.0026]; }); }
    mgPuppet(c, pn, Lp, t, { light: Math.PI - dirAng(-0.55), free: MG.broke, ghosts, flash: Lp.flash > 0, mono: true, post: rprPost(Lp, t, 0) });
  }

  /* ---- panel 4: the scythe on his shoulder, a moment of silence, the tombstone pops out of the paper ---- */
  function drawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    rprSky(c, pn, t, 0.4);
    rprGround(c, pn, t);
    rprStone(c, pn, t, wX(t) + D * 62);
    mgPuppet(c, pn, W, t, { light: dirAng(-0.55), box: BOX, mono: true, post: rprPost(W, t, cheekK(t)) });
    pn.screen(c);
  }
  // the pop: flat on the page until STONE, then it stands up with an overshoot, like the page of a pop-up book
  function stoneK(t) {
    const u = t - STONE;
    if (u <= 0) return 0;
    return u < 150 ? 1.16 * easeOut(u / 150) : u < 250 ? 1.16 - 0.22 * ease((u - 150) / 100) : 0.94 + 0.06 * ease(Math.min(1, (u - 250) / 90));
  }
  function rprStone(c, pn, t, x0) {
    const k = stoneK(t), D = FIN.dir, SW = 30, SH = 40;
    pn.world(c);
    if (k <= 0.01) {   // the fold it will rise from: a cut line on the ground
      const a = fe(MT.AFTER + 100, STONE, t);
      if (a > 0) { c.save(); c.globalAlpha = a; c.strokeStyle = INK; c.lineWidth = 1.2; c.setLineDash([2.5, 2]); c.beginPath(); c.moveTo(x0 - SW / 2 - 4, 1.5); c.lineTo(x0 + SW / 2 + 4, 1.5); c.stroke(); c.setLineDash([]); c.restore(); }
      return;
    }
    c.save(); c.translate(x0, 1); c.scale(1 / Math.sqrt(Math.max(0.6, k)), k);
    const lw = Math.max(1.4, 4 / pn.z) * 1.0;
    const body = () => { c.beginPath(); c.moveTo(-SW / 2, -2); c.lineTo(-SW / 2, -SH + SW / 2); c.arc(0, -SH + SW / 2, SW / 2, Math.PI, 0); c.lineTo(SW / 2, -2); c.closePath(); };
    // the slab under it
    c.fillStyle = PAPER; c.strokeStyle = INK; c.lineWidth = lw; c.lineJoin = "round";
    c.beginPath(); c.rect(-SW / 2 - 4, -3, SW + 8, 4.5); c.fill(); c.stroke();
    body(); c.fill(); c.stroke();
    c.restore();
    // tone in screen space (mgToneFill wants css px)
    if (k > 0.3) {
      const sk = (x, y) => pn.sp(x0 + (x) / Math.sqrt(Math.max(0.6, k)), 1 + y * k);
      rprTonePoly(c, [sk(D * SW * 0.3, -2), sk(D * SW * 0.5, -2), sk(D * SW * 0.5, -SH + SW / 2), sk(D * SW * 0.4, -SH + SW * 0.2), sk(D * SW * 0.27, -SH + SW * 0.5)], 6, 0.4);   // the shaded edge, clear of the name
    }
    pn.world(c);
    c.save(); c.translate(x0, 1); c.scale(1 / Math.sqrt(Math.max(0.6, k)), k);
    // the engraving: R.I.P. and the loser's name, in ink (white once turned); a crack down one side
    c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `900 italic 9.5px "Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`; c.fillText("R.I.P.", 0, -SH * 0.6);
    c.font = `800 ${stoneFont}px "Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`; c.strokeStyle = PAPER; c.lineWidth = 1.4; c.strokeText(stoneName, 0, -SH * 0.33); c.fillText(stoneName, 0, -SH * 0.33);
    c.strokeStyle = INK; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-SW * 0.12, -SH * 0.78); c.lineTo(SW * 0.12, -SH * 0.78); c.stroke();
    c.lineWidth = 0.9; c.beginPath(); c.moveTo(-D * SW * 0.5, -SH * 0.22); c.lineTo(-D * SW * 0.38, -SH * 0.17); c.lineTo(-D * SW * 0.43, -SH * 0.11); c.lineTo(-D * SW * 0.32, -SH * 0.05); c.stroke();   // (below the name)
    c.restore();
    // it lands: puffs of ink either side and a ring of short strokes
    const kk = fe(STONE + 120, STONE + 520, t);
    if (kk > 0 && kk < 1) {
      c.save(); c.globalAlpha = 1 - kk; c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = 1.3;
      for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { const r0 = SW * 0.62 + 10 * easeOut(kk) + j * 2.5; c.beginPath(); c.moveTo(x0 + sd * r0, -1 - j * 2.4); c.lineTo(x0 + sd * (r0 + 4 + 3 * kk), -3 - j * 3.6); c.stroke(); }
      c.restore();
    }
    pn.screen(c);
  }
  function rprTonePoly(c, pts, size, cover) {   // pts already in screen css px
    mgToneFill(c, pts, size, cover);
  }

  /* ---- over the page (not turned: drawn as it should look) ---- */
  // the white stroke: one crescent from his side low across the whole page up through the loser to the far top corner, tapered at both ends
  function rprStrokePts(n) {
    const pg = MG.page, D = FIN.dir, pn = MG.byId.strike, hx = (fx) => pg.x + (D > 0 ? fx : 1 - fx) * pg.w;
    const A = [hx(0.0), pg.y + pg.h * 0.97], C = [hx(1.0), pg.y + pg.h * 0.04];
    mgPlace(pn, HIT + 200);
    const B = pn.sp(FIN.lx, -36), Q = [2 * B[0] - (A[0] + C[0]) / 2, 2 * B[1] - (A[1] + C[1]) / 2];
    mgPlace(pn, FIN.t);   // (back where the engine had it this frame)
    return qpts(A, Q, C, n);
  }
  function rprCrescent(o, pts, upto, th, fill, edge) {
    const n = pts.length - 1, m = Math.max(1, Math.round(n * upto)), Lp = [], Rp = [];
    for (let i = 0; i <= m; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const wd = th * Math.pow(Math.sin(Math.PI * (0.02 + 0.96 * i / n)), 0.75);
      Lp.push([pts[i][0] + dy * wd * 0.15, pts[i][1] - dx * wd * 0.15]); Rp.push([pts[i][0] - dy * wd, pts[i][1] + dx * wd]);   // the inner edge bulges: a crescent
    }
    o.beginPath(); o.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i <= m; i++) o.lineTo(Lp[i][0], Lp[i][1]);
    for (let i = m; i >= 0; i--) o.lineTo(Rp[i][0], Rp[i][1]);
    o.closePath(); o.fillStyle = fill; o.fill();
    if (edge) { o.lineWidth = 1; o.strokeStyle = edge; o.stroke(); }
    return Lp[m];
  }
  function rprStroke(o, t) {
    if (t < HIT + 100 || t > 3700 || !MG.byId.strike) return;
    const B = box();
    if (!B.stroke) B.stroke = rprStrokePts(40);
    const up = easeOut(fe(HIT + 100, HIT + 190, t)), th = Math.min(L.gw, L.gh) * 0.034 * (1 - 0.75 * ease(fe(3250, 3650, t))), a = 1 - fe(3450, 3700, t);
    o.save(); o.globalAlpha = 0.3 * a; rprCrescent(o, B.stroke, up, th * 1.9, "#ffffff"); o.restore();
    o.save(); o.globalAlpha = a; const tip = rprCrescent(o, B.stroke, up, th, "#ffffff", "rgba(20,15,30,0.6)"); o.restore();
    if (up >= 1 && a > 0) { const s = Math.min(L.gw, L.gh) * 0.03 * (0.85 + 0.15 * Math.sin(t * 0.03)) * a; o.save(); o.globalAlpha = a; star4(o, tip[0], tip[1], s, "#ffffff"); o.restore(); }
  }
  // the soul: an amber ghost of the loser's potato with a wisp of a tail, eyes closed, a little sprout; it stays where the blade caught him, then drifts up
  function rprSoulAt(t) {
    if (!soul || t < soul.t0) return null;
    const u = t - soul.t0, pop = u < 150 ? 1.18 * easeOut(u / 150) : 1.18 - 0.18 * ease(Math.min(1, (u - 150) / 120));
    const rise = Math.max(0, u - 260), dy = 0.00011 * rise * rise + 0.05 * rise, sway = Math.sin(u * 0.0042) * 9 * fe(200, 700, u);
    return { x: soul.x + sway, y: soul.y - dy, s: soul.s * pop, a: 1, tilt: Math.cos(u * 0.0042) * 0.12 };
  }
  function rprSoul(o, t) {
    const S = rprSoulAt(t);
    if (!S || S.y < -S.s * 3) return;
    const s = S.s, u = t - soul.t0;
    // motes shed on the way up
    for (const m of motes) {
      const age = u - m.t; if (age < 0 || age > m.life) continue;
      const q = age / m.life, born = rprSoulAt(soul.t0 + m.t);
      if (!born) continue;
      const x = born.x + m.dx * s + Math.sin(age * 0.006 + m.ph) * 4, y = born.y + s * 0.9 + age * 0.012, r = m.r * (1 - q);
      if (r < 0.4) continue;
      o.fillStyle = "#ffffff"; o.beginPath(); o.arc(x, y, r + 1, 0, TAU); o.fill();
      o.fillStyle = COL; o.beginPath(); o.arc(x, y, r, 0, TAU); o.fill();
    }
    o.save(); o.translate(S.x, S.y); o.rotate(S.tilt);
    // the tail: a tapered wisp that waves under it
    const pts = [];
    for (let i = 0; i <= 10; i++) { const q = i / 10; pts.push([Math.sin(q * 4.2 - u * 0.009) * s * 0.35 * q, s * 0.45 + q * s * 1.6]); }
    const lw = Math.max(1.6, s * 0.09);
    const tail = (wmax) => {
      const Lq = [], Rq = [];
      for (let i = 0; i <= 10; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(10, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; const wd = wmax * (1 - i / 10) + 0.2; Lq.push([pts[i][0] - dy * wd, pts[i][1] + dx * wd]); Rq.push([pts[i][0] + dy * wd, pts[i][1] - dx * wd]); }
      o.beginPath(); o.moveTo(Lq[0][0], Lq[0][1]); for (const p of Lq) o.lineTo(p[0], p[1]); for (let i = Rq.length - 1; i >= 0; i--) o.lineTo(Rq[i][0], Rq[i][1]); o.closePath(); o.fill();
    };
    o.fillStyle = "#ffffff"; tail(s * 0.62 + lw);
    o.fillStyle = COL; tail(s * 0.62);
    // the body: the potato's oval, white edge, amber, a hot core
    o.fillStyle = "#ffffff"; o.beginPath(); o.ellipse(0, 0, s * 0.8 + lw, s * 0.92 + lw, 0, 0, TAU); o.fill();
    o.fillStyle = COL; o.beginPath(); o.ellipse(0, 0, s * 0.8, s * 0.92, 0, 0, TAU); o.fill();
    o.fillStyle = HOT; o.beginPath(); o.ellipse(-s * 0.22, -s * 0.28, s * 0.36, s * 0.32, -0.4, 0, TAU); o.fill();
    // the face: eyes closed (soft arcs), a small content smile, in the night of the page
    o.strokeStyle = NIGHT; o.lineCap = "round"; o.lineWidth = Math.max(1.4, s * 0.075);
    for (const ex of [-0.28, 0.26]) { o.beginPath(); o.arc(ex * s, s * 0.02, s * 0.15, 0.25, Math.PI - 0.25); o.stroke(); }
    o.beginPath(); o.arc(0, s * 0.3, s * 0.13, 0.35, Math.PI - 0.35); o.stroke();
    // a little sprout of white line
    o.strokeStyle = "#ffffff"; o.lineWidth = Math.max(1.4, s * 0.07); o.beginPath(); o.moveTo(0, -s * 0.9); o.quadraticCurveTo(-s * 0.05, -s * 1.12, s * 0.04, -s * 1.28); o.stroke();
    for (const sd of [-1, 1]) { o.beginPath(); o.ellipse(sd * s * 0.17 + s * 0.02, -s * 1.3, s * 0.17, s * 0.08, sd * 0.5, 0, TAU); o.fillStyle = COL; o.fill(); o.stroke(); }
    o.restore();
  }
  // where the soul crosses the strike panel's top border (when the loser left another way, the soul tears its own way out): a gap in the white line
  function rprSoulTear(o, t) {
    const pn = MG.byId.strike, S = rprSoulAt(t);
    if (!pn || !S) return;
    if (!tear2) {
      const a = pn.poly[0], b = pn.poly[1], q = clamp((S.x - pn.ox - a[0]) / ((b[0] - a[0]) || 1), 0, 1), yb = a[1] + (b[1] - a[1]) * q + pn.oy;
      if (S.y - S.s > yb) return;
      // the loser already tore the border here: nothing to add
      const lb = MG.broke && MG.brokeT ? pn.sp(...loserAt(MG.brokeT)) : null;
      tear2 = { x: S.x, y: yb, t0: t, w: S.s * 2.2, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), skip: !!(lb && Math.hypot(lb[0] - S.x, lb[1] - yb) < S.s * 2.6) };
    }
    if (tear2.skip) return;
    const T = tear2, bw = MG.bw, r = rprRng(4040), hw = T.w / 2;
    o.save(); o.translate(T.x, T.y); o.rotate(T.ang);
    o.fillStyle = NIGHT; o.fillRect(-hw, -bw * 1.2, T.w, bw * 2.4);
    o.strokeStyle = "#f4f5ed"; o.lineWidth = bw * 0.8; o.lineJoin = "miter"; o.beginPath();
    for (const sg of [-1, 1]) { o.moveTo(sg * hw, 0); for (let j = 1; j <= 4; j++) o.lineTo(sg * (hw - j * (3 + r() * 3)), (j % 2 ? 1 : -1) * (3 + r() * 4)); }
    o.stroke();
    const k = fe(T.t0, T.t0 + 420, t);   // a few flecks of white thrown up
    if (k < 1) { o.fillStyle = "#f4f5ed"; for (let i = 0; i < 6; i++) { const an = -Math.PI / 2 + (r() - 0.5) * 1.6, d = (8 + r() * 26) * easeOut(k); o.globalAlpha = 1 - k; o.fillRect(Math.cos(an) * d - 1.5, Math.sin(an) * d - 1.5, 3, 3); } }
    o.restore();
  }

  /* ---- the turn: a ragged pool of night spreading from the hit (device px) ---- */
  function rprPool(c, k) {
    const B = box(), ix = MG.ix * DPR, iy = MG.iy * DPR, R = B.poolR * ease(k), r = rprRng(1313), n = 44;
    c.beginPath();
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, rr = R * (0.9 + 0.1 * Math.sin(a * 3 + 1.3) + 0.06 * Math.sin(a * 7 + 0.4) + 0.04 * (r() - 0.5)); i ? c.lineTo(ix + Math.cos(a) * rr, iy + Math.sin(a) * rr) : c.moveTo(ix + Math.cos(a) * rr, iy + Math.sin(a) * rr); }
    c.closePath();
    for (let i = 0; i < 9; i++) {   // drops thrown ahead of the edge
      const a = r() * TAU, d = R * (1.04 + r() * 0.2), s = R * (0.025 + r() * 0.05) * (1 - k * 0.5);
      c.moveTo(ix + Math.cos(a) * d + s, iy + Math.sin(a) * d); c.arc(ix + Math.cos(a) * d, iy + Math.sin(a) * d, s, 0, TAU);
    }
  }

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "Last Rites", flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, mv = ev ? ev.mv || "" : "", big = !ev || ev.fin || mv === "spec" || /^h/.test(mv), D = FIN.dir;
      return [
        { text: big ? "SHUNK" : "WHAK", t0: 600, t1: 1330, size: 0.24, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        // the bell, small and long, high over the page as the dark spreads
        { text: "gooong", t0: TOLL + 20, t1: 1900, size: 0.085, arc: 9, jit: 0.1, rot: 0.05 * D, space: 0.08,
          at: () => [MG.page.x + MG.page.w * (D > 0 ? 0.54 : 0.46), MG.page.y + L.gh * (lay.port ? 0.47 : 0.12)] },
        // the stroke: along the crescent, above it, stretched along it
        { text: "SHHK", t0: HIT + 100, t1: 3560, size: 0.22, arc: 10, jit: 0.12, fill: "#ffffff", stretch: { ang: D > 0 ? -0.5 : Math.PI + 0.5, k: 0.3 },
          rot: -0.42 * D,
          at: () => { const B = box(); if (!B.stroke) B.stroke = rprStrokePts(40); const p = B.stroke[Math.round(B.stroke.length * 0.62)], q = B.stroke[Math.round(B.stroke.length * 0.62) - 2]; let nx = -(p[1] - q[1]), ny = p[0] - q[0]; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d; if (ny > 0) { nx = -nx; ny = -ny; } return [p[0] + nx * L.gh * 0.13, p[1] + ny * L.gh * 0.13]; } },
        // his whisper, eyes closed
        { text: "shhh...", t0: HUSH + 30, t1: 4380, size: 0.075, jit: 0.12, rot: -0.1 * D, space: 0.08,
          at: () => { const p = MG.byId.after, m = p.sp(...rprPt(W_(), HUSH + 60, "head")); return [m[0] - D * p.z * 34, m[1] - p.z * 22]; } },
      ];
    },
    start(g) { dust = []; motes = []; soul = null; tear2 = null; },
    build(lay) {
      const B = box(), gw = L.gw, gh = L.gh;
      MG.panels[0].d.draw = drawHit;
      // the pool of night must reach every corner
      B.poolR = Math.max(Math.hypot(MG.ix, MG.iy), Math.hypot(gw - MG.ix, MG.iy), Math.hypot(MG.ix, gh - MG.iy), Math.hypot(gw - MG.ix, gh - MG.iy)) * DPR / 0.82;
      // when the night reaches the skip hint (bottom right), the hint turns light
      const hx = (gw - MG.m - 40) * DPR, hy = (gh - MG.m * 0.5) * DPR, dh = Math.hypot(hx - MG.ix * DPR, hy - MG.iy * DPR);
      cornerT = TURNED; for (let tt = TOLL; tt <= TURNED; tt += 10) if (B.poolR * ease(fe(TOLL, TURNED, tt)) * 0.82 >= dh) { cornerT = tt; break; }
      const r = mgRng(1660);
      motes = Array.from({ length: MG.slow ? 8 : 16 }, (_, i) => ({ t: 120 + i * 70 + r() * 40, life: 500 + r() * 400, dx: (r() - 0.5) * 0.9, r: 1.2 + r() * 2.2, ph: r() * 6.28 }));
      // the name on the stone, set to fit
      const Lp = L_(); stoneName = Lp.spec.name.toUpperCase();
      const mc = mgCanvas(4, 4).getContext("2d"); mc.font = `800 10px "Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
      stoneFont = clamp(10 * 25 / Math.max(1, mc.measureText(stoneName).width), 3.2, 6);
      FIN.cardSub = FIN.ev && FIN.ev.fin ? "Last Rites finish" : "Final chapter: Last Rites";   // his finishing special is Last Rites (the signature's name, Harvest, is the plain special)
    },
    step(t, k) {
      const W = W_();
      W.x = wX(t);
      W.y = t > GLIDE0 - 60 && t < GLIDE1 + 120 ? -2.5 * Math.sin(Math.PI * fe(GLIDE0 - 60, GLIDE1 + 120, t)) : 0;   // he lifts off the ground as he glides
      if (!soul && t >= FIN.launch && MG.byId.strike) { const pn = MG.byId.strike, q = pn.sp(FIN.lx, -34); soul = { t0: FIN.launch, x: q[0], y: q[1], s: L_().s.w * 0.36 * clamp(pn.z, 1.1, 2.4) }; }
      const B = box();
      if (!B.queued) {   // the one-off canvases join the end of the engine's build queue, so they are made in the hold before the skip (after the inked copy)
        B.queued = true;
        MG.todo.push(() => { if (MG.inkOK && !B.inkG) B.inkG = rprScreen(rprGrey(MG.ink)); }, () => { const pn = MG.byId.look; if (pn) { mgPlace(pn, MT.STRIKE); rprShadowSprite(pn); } });
      }
      MG.pt = t;
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor;
      if (role === "w") {
        P.exK = 1; P.scyK = 1;
        if (t < MT.STRIKE + 70) {   // the look: the scythe rises behind the hood, the blade hooked back over it (as in the picture)
          const r = ease(fe(RISE0, RISE1, t));
          P.scyBack = true; P.bladeS = -1; P.holdAng = -1.5 - 0.06 * r; P.lean = -0.05 * r;
          P.expr = t >= SMIRK ? "grin" : undefined;
          return { hF: [w * 0.6, lerp(-leg + 6, -leg - tor * 0.6, r)], hB: [-w * 0.62, -leg - tor * 0.25] };
        }
        const up = [w * 0.6, -leg - tor * 0.6], back = [w * 0.05, -leg - tor * 0.22], high = [w * 0.75, -leg - tor * 1.05];
        if (t < HIT) {   // the glide: the scythe goes back over his head and down behind him, low (the hook comes from behind and under)
          const q = ease(fe(GLIDE0 - 40, GLIDE1, t));
          P.scyBack = true; P.holdAng = lerp(-1.56, Math.PI - 0.2 - TAU, q); P.bladeS = q < 0.5 ? -1 : lerp(-1, 1, (q - 0.5) * 2);
          P.crouch = 0.28 * q; P.lean = -0.05 - 0.08 * q; P.expr = "grin"; P.mouth = 0;
          const h = lerp2(up, back, q), grip = [h[0] - Math.cos(P.holdAng) * 13, h[1] - Math.sin(P.holdAng) * 13];
          return { hF: h, hB: lerp2([-w * 0.62, -leg - tor * 0.25], grip, ease(fe(0.4, 0.9, q))), fF: [w * 0.5, 0], fB: [-w * 0.35, 0] };
        }
        if (t < SETTLE) {   // the hook (between two frames: during the impact frames), then the follow-through held high
          const d = easeOut(fe(HIT, HIT + 70, t));
          P.crouch = 0.28 * (1 - d); P.lean = -0.13 + 0.31 * d; P.holdAng = lerp(Math.PI - 0.2, -1.35, d); P.bladeS = lerp(1, -1, Math.min(1, d * 3)); P.scyBack = d < 0.3; P.expr = "grin";
          const h = lerp2(back, high, d);
          return { hF: h, hB: [h[0] - Math.cos(P.holdAng) * 13, h[1] - Math.sin(P.holdAng) * 13], fF: [w * 0.5, 0], fB: [-w * 0.35, 0] };
        }
        // the scythe settles on his shoulder; in panel 4 he closes his eyes for a moment (the whisper), then the smirk is back
        const q = easeOut(fe(SETTLE, SETTLE + 260, t));
        P.holdAng = lerp(-1.35, -2.25, q); P.bladeS = lerp(-1, 1, q); P.lean = 0.18 * (1 - q) - 0.04; P.scyBack = false;
        P.expr = t >= HUSH && t < HUSH1 ? "calm" : t >= HUSH1 + 120 ? "grin" : undefined;
        return { hF: lerp2(high, [w * 0.62, -leg - tor * 0.75], q) };
      }
      // the loser: terror (the pupils shrink as the silence comes), then flung, spinning
      const fly = t >= FIN.launch;
      P.expr = fly ? "ko" : "terror"; P.exK = fe(MT.STRIKE, 2850, t);
      if (!fly) {
        P.lean = Math.sin(t * 0.03) * 0.035 * fe(2000, 2500, t); P.mouth = 0.3;
        return { hF: [w * 0.75, -leg - tor * 0.42], hB: [-w * 0.7, -leg - tor * 0.42] };
      }
      P.lean = -0.5; P.mouth = 1; P.spin = ((t - FIN.launch) / FMS) * 0.3;
      return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
    },
    // the engine's last pass over the page: the night spreads from the hit (colour drains, the page turns), then the whole page stays turned
    page(c, t) {
      const k = fe(TOLL, TURNED, t);
      if (k <= 0) return;
      const pn = MG.byId.strike;
      if (MG.broke && pn && !FIN.out && L_().state !== "gone") { c.save(); mgPlace(pn, t); rprLoser(c, pn, t); c.restore(); }   // out of its panel: over the whole page, turned with it
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      if (k < 1) { rprPool(c, k); c.clip(); }
      c.globalCompositeOperation = "difference"; c.fillStyle = "#ffffff"; c.fillRect(0, 0, MG.cw, MG.ch);
      c.restore();
    },
    hint(t) { return t >= cornerT ? "rgba(214,216,228,0.62)" : "rgba(30,28,40,0.55)"; },
    over(o, t) {
      if (t > FIN.launch && t < FIN.launch + 420 && MG.byId.strike) {   // white speed lines along the real launch direction (ink ones would vanish in the night)
        const Lp = L_(), pn = MG.byId.strike, a = 1 - fe(FIN.launch + 200, FIN.launch + 420, t);
        const q = pn.sp(...loserAt(Math.min(t, FIN.launch + 200)).map((v, i) => (i ? v - Lp.s.h * 0.5 : v))), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.3, ang, -(t - FIN.launch) * 1.3, 0.75 * a, true, 0.85);
        o.restore();
      }
      rprStroke(o, t);
      rprSoulTear(o, t);
      rprSoul(o, t);
    },
    hitPt() { return [FIN.lx, -36]; },
    impact(o, pn, sil, t) {
      mgPuppet(o, pn, W_(), HIT + 60, { sil, free: true, box: BOX });
      mgPuppet(o, pn, L_(), HIT + 10, { sil, free: true });
      // the crescent, flat
      const B = box(); if (!B.stroke) B.stroke = rprStrokePts(40);
      rprCrescent(o, B.stroke, 1, Math.min(L.gw, L.gh) * 0.03, sil);
    },
    cues(t) {
      // (not a sound) the tear's glow is drawn inside the panel, so amber would come out as its complement: white ink instead. cues run after the
      // engine has made the tear, before the frame is drawn
      const sp = MG.byId.strike;
      if (sp) for (const g of sp.glows) g.col = INK;
      cueOnce("toll", TOLL, () => Cin.go(() => {   // a big bronze bell: the hum an octave down, the strike note, a minor third, the fifth, the octave; long tails
        for (const [f, v, d] of [[55, 0.13, 3.4], [110, 0.17, 3.0], [131, 0.07, 2.4], [165, 0.06, 2.0], [220, 0.06, 1.7], [293, 0.035, 1.3], [370, 0.025, 1.0]]) Cin._osc("sine", f, f * 0.997, d, v, 0.006);
        Cin._noise(0.07, 0.18, 1700, 700, "bandpass", 1.3);
      }));
      cueOnce("rise", RISE0, () => Cin.go(() => { Cin._noise(0.8, 0.05, 900, 3800, "bandpass", 3); Cin._osc("sine", 1320, 1980, 0.8, 0.012, 0.6); }));
      cueOnce("ting", RISE1, () => Cin.go(() => Cin.chime(2637)));
      cueOnce("pluck", MT.INSET, () => Cin.go(() => Cin.pluck(990)));
      cueOnce("smirk", SMIRK + 20, () => Cin.go(() => { Cin._osc("triangle", 2350, 2349, 0.18, 0.03, 0.003); Cin._osc("triangle", 3520, 3519, 0.22, 0.02, 0.003, 0.07); }));
      cueOnce("glide", GLIDE0, () => Cin.go(() => { Cin._noise(0.5, 0.07, 500, 1100, "bandpass", 1.4, 0, -0.4); Cin._noise(0.45, 0.05, 1100, 600, "bandpass", 1.4, 0.2, 0.4); }));
      cueOnce("back", 2620, () => Cin.go(() => Cin.whoosh(0.22, 0.4, -0.5, 0.18)));
      cueOnce("stroke", HIT, () => Cin.go(() => {   // SHHK: a sweep up through the hiss, a click at the end, the blade ringing on
        Cin._noise(0.17, 0.55, 2000, 9000, "highpass", 0.8); Cin._noise(0.05, 0.3, 7000, 4200, "bandpass", 2, 0.13);
        Cin._osc("sine", 3100, 3060, 1.1, 0.03, 0.004, 0.03); Cin._osc("sine", 4650, 4600, 0.8, 0.018, 0.004, 0.03);
      }));
      cueOnce("fly", FIN.launch, () => Cin.go(() => Cin.whoosh(0.35, 0, 0, 0.4)));
      cueOnce("soul", FIN.launch + 120, () => Cin.go(() => { Cin._osc("sine", 520, 780, 0.35, 0.05, 0.05); Cin._osc("sine", 1040, 1560, 0.3, 0.02, 0.05, 0.05); }));
      cueOnce("whisper", HUSH, () => Cin.go(() => {   // a whisper: a long hush, then a breath through two formants
        Cin._noise(0.75, 0.075, 4400, 3200, "bandpass", 1.3, 0, -0.25);
        Cin._noise(0.5, 0.035, 850, 700, "bandpass", 5, 0.5, -0.2); Cin._noise(0.5, 0.025, 2300, 2050, "bandpass", 6, 0.5, -0.2);
      }));
      cueOnce("stone", STONE, () => Cin.go(() => { Cin.stamp(0.7); Cin._noise(0.12, 0.12, 1800, 900, "bandpass", 1.2); }));
      cueOnce("toll2", 4150, () => Cin.go(() => { for (const [f, v, d] of [[110, 0.05, 2.2], [131, 0.02, 1.6], [220, 0.02, 1.2]]) Cin._osc("sine", f, f * 0.997, d, v, 0.01); }));
    },
  };
  return S_;
})();
