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
  const HIT = MT.HIT, TOLL = 840, TURNED = 1180, RISE0 = 1330, RISE1 = 2150, SMIRK = 2180, GLIDE0 = 2420, GLIDE1 = 2800, SETTLE = 3260, GAP = 64;
  // the aftermath's moments are MT.AFTER + offset (3500 on Last Rites, 4700 on the Ultimate page), set by start()
  let HUSH = 3640, HUSH1 = 3990, STONE = 3720, TOLL2 = 4150, SHHH1 = 4380;
  const setTimes = () => { const A = MT.AFTER; HUSH = A + 140; HUSH1 = A + 490; STONE = A + 220; TOLL2 = A + 650; SHHH1 = A + 880; };
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const BOX = [-112, -132, 112, 20];   // what he and his scythe can cover (world units about the feet)
  const own = new WeakMap();           // this page's canvases live and die with the engine's picture of the hit (freed at the end of the page)
  const box = () => { let b = own.get(MG.snap); if (!b) { b = {}; own.set(MG.snap, b); } return b; };
  let dust = [], motes = [], soul = null, cornerT = TURNED, stoneName = "", stoneFont = 5, tear2 = null;
  let ult = false, boat = false;   // ult: this play is the Ultimate page, The Ferryman (set by its start); boat: he is being posed standing in the ferry (the splash)
  let pota = false;                // pota: this play is the Potatality, Rest in Peel (set by its start)

  /* ---- where things are (world units), from the puppets' own poses ---- */
  function rprPt(p, t, key, dx, dy) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot([P[key][0] + (dx || 0), P[key][1] + (dy || 0)], P.hip, P.lean);
    return [p.x + p.facing * q[0], p.y + q[1]];
  }
  const glideK = (t) => ease(fe(GLIDE0, GLIDE1, t));
  // he glides up to the loser before the hook (The Ferryman: he stands at that spot from the strike panel on and drags the loser in instead)
  const wX = (t) => FIN.wx + FIN.dir * (130 - GAP) * (ult ? (t >= MT.STRIKE ? 1 : 0) : glideK(t));
  const loserAt = (tt) => { if (tt < FIN.launch) return [ult ? fmLoserX(tt) : FIN.lx - (tt >= HIT ? FIN.dir * 5 : 0), 0]; const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr]; };
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
    if (ult) fmHeels(c, pn, t);
    else if (t > GLIDE0 && t < HIT + 200) {   // the glide: speed lines behind him, low, fading as he stops
      const a = 0.45 * Math.sin(Math.PI * fe(GLIDE0, GLIDE1 + 60, t)), q = pn.p(wX(t) - D * 46, -34);
      if (a > 0.02) mgSpeed(c, q[0], q[1], 70 * pn.z, 46 * pn.z, D > 0 ? 0 : Math.PI, -t * 0.5 * D, a, false, 0.7);
    }
    if (t >= HIT + 100) { const hp = pn.p(FIN.lx, -34); mgFocus(c, hp[0], hp[1], Math.hypot(pn.w, pn.h), t * 0.0005, 0.6 * (1 - fe(HIT + 100, 3400, t))); }
    mgPuppet(c, pn, W, t, { light: dirAng(-0.55), box: BOX, mono: true, post: rprPost(W, t, cheekK(t)) });
    if (!MG.broke) rprLoser(c, pn, t);
    if (ult) fmChains(c, pn, t);
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
  // (mirror: the other crescent of the Ultimate, from the far side low to his side high, through the same point)
  function rprStrokePts(n, mirror) {
    const pg = MG.page, D = FIN.dir, pn = MG.byId.strike, hx = (fx) => pg.x + (D > 0 ? fx : 1 - fx) * pg.w;
    const A = [hx(mirror ? 1 : 0), pg.y + pg.h * 0.97], C = [hx(mirror ? 0 : 1), pg.y + pg.h * 0.04];
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
    if (ult && !B.stroke2) B.stroke2 = rprStrokePts(40, true);
    // (the Ultimate: two crescents, an X through the loser, gone as the river comes in: over it they would float)
    const up = easeOut(fe(HIT + 100, HIT + 190, t)), th = Math.min(L.gw, L.gh) * 0.034 * (1 - 0.75 * ease(fe(3250, 3650, t))), a = (1 - fe(3450, 3700, t)) * (ult || pota ? fmTide(t) : 1);
    if (a <= 0) return;
    for (const pts of ult ? [B.stroke, B.stroke2] : [B.stroke]) {
      o.save(); o.globalAlpha = 0.3 * a; rprCrescent(o, pts, up, th * 1.9, "#ffffff"); o.restore();
      o.save(); o.globalAlpha = a; const tip = rprCrescent(o, pts, up, th, "#ffffff", "rgba(20,15,30,0.6)"); o.restore();
      if (up >= 1 && a > 0) { const s = Math.min(L.gw, L.gh) * 0.03 * (0.85 + 0.15 * Math.sin(t * 0.03)) * a; o.save(); o.globalAlpha = a; star4(o, tip[0], tip[1], s, "#ffffff"); o.restore(); }
    }
  }
  // the soul: an amber ghost of the loser's potato with a wisp of a tail, eyes closed, a little sprout; it stays where the blade caught him, then drifts up
  const rprSoulAt = (t) => (ult && t >= F_SOUL ? fmSoulAt(t) : rprSoulBase(t));
  function rprSoulBase(t) {
    if (!soul || t < soul.t0) return null;
    const u = t - soul.t0, pop = u < 150 ? 1.18 * easeOut(u / 150) : 1.18 - 0.18 * ease(Math.min(1, (u - 150) / 120));
    const rise = Math.max(0, u - 260), dy = 0.00011 * rise * rise + 0.05 * rise, sway = Math.sin(u * 0.0042) * 9 * fe(200, 700, u);
    return { x: soul.x + sway, y: soul.y - dy, s: soul.s * pop, a: 1, tilt: Math.cos(u * 0.0042) * 0.12 };
  }
  function rprSoul(o, t) {
    const S = rprSoulAt(t);
    if (!S || S.y < -S.s * 3 || S.a <= 0.01) return;
    const s = S.s, u = t - soul.t0;
    o.save(); o.globalAlpha = S.a;
    // motes shed on the way up
    for (const m of motes) {
      const age = u - m.t; if (age < 0 || age > m.life || (ult && (soul.t0 + m.t >= F_SOUL || t >= MT.SPLASH + 100))) continue;
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
    o.restore();
  }
  // where the soul crosses the strike panel's top border (when the loser left another way, the soul tears its own way out): a gap in the white line
  function rprSoulTear(o, t) {
    const pn = MG.byId.strike, S = rprSoulAt(t);
    if (!pn || !S || ult) return;   // (the ferry's soul never leaves through the border)
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

  // the glide: the scythe goes back over his head and down behind him, low (the hook comes from behind and under); q 0..1
  function rprGlidePose(P, w, leg, tor, q) {
    const up = [w * 0.6, -leg - tor * 0.6], back = [w * 0.05, -leg - tor * 0.22];
    P.scyBack = true; P.holdAng = lerp(-1.56, Math.PI - 0.2 - TAU, q); P.bladeS = q < 0.5 ? -1 : lerp(-1, 1, (q - 0.5) * 2);
    P.crouch = 0.28 * q; P.lean = -0.05 - 0.08 * q; P.expr = "grin"; P.mouth = 0;
    const h = lerp2(up, back, q), grip = [h[0] - Math.cos(P.holdAng) * 13, h[1] - Math.sin(P.holdAng) * 13];
    return { hF: h, hB: lerp2([-w * 0.62, -leg - tor * 0.25], grip, ease(fe(0.4, 0.9, q))), fF: [w * 0.5, 0], fB: [-w * 0.35, 0] };
  }

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "Last Rites", flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, mv = ev ? ev.mv || "" : "", big = !ev || ev.fin || mv === "spec" || mv === "ulti" || /^h/.test(mv), D = FIN.dir;
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
        { text: "shhh...", t0: HUSH + 30, t1: SHHH1, size: 0.075, jit: 0.12, rot: -0.1 * D, space: 0.08,
          at: () => { const p = MG.byId.after, m = p.sp(...rprPt(W_(), HUSH + 60, "head")); return [m[0] - D * p.z * 34, m[1] - p.z * 22]; } },
      ];
    },
    start(g) { dust = []; motes = []; soul = null; tear2 = null; ult = false; boat = false; pota = false; setTimes(); },
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
      if (!MG.ulti && !MG.alt) FIN.cardSub = FIN.ev && FIN.ev.fin ? "Last Rites finish" : "Final chapter: Last Rites";   // his finishing special is Last Rites (the signature's name, Harvest, is the plain special); an Ultimate and a Potatality keep the engine's line
    },
    step(t, k) {
      const W = W_();
      W.x = wX(t);
      W.y = !ult && t > GLIDE0 - 60 && t < GLIDE1 + 120 ? -2.5 * Math.sin(Math.PI * fe(GLIDE0 - 60, GLIDE1 + 120, t)) : 0;   // he lifts off the ground as he glides
      if (!soul && !pota && t >= FIN.launch && MG.byId.strike) { const pn = MG.byId.strike, q = pn.sp(FIN.lx, -34); soul = { t0: FIN.launch, x: q[0], y: q[1], s: L_().s.w * 0.36 * clamp(pn.z, 1.1, 2.4) }; }
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
        if (ult && boat) return fmPoseBoat(P, w, leg, tor, t);                  // The Ferryman: in the boat (the splash)
        if (ult && t >= MT.STRIKE && t < HIT) return fmPoseStrike(P, w, leg, tor, t);   // ... planted: the chains, the tug, the whip back
        if (t < MT.STRIKE + 70) {   // the look: the scythe rises behind the hood, the blade hooked back over it (as in the picture)
          const r = ease(fe(RISE0, RISE1, t));
          P.scyBack = true; P.bladeS = -1; P.holdAng = -1.5 - 0.06 * r; P.lean = -0.05 * r;
          P.expr = t >= SMIRK ? "grin" : undefined;
          return { hF: [w * 0.6, lerp(-leg + 6, -leg - tor * 0.6, r)], hB: [-w * 0.62, -leg - tor * 0.25] };
        }
        const up = [w * 0.6, -leg - tor * 0.6], back = [w * 0.05, -leg - tor * 0.22], high = [w * 0.75, -leg - tor * 1.05];
        if (t < HIT) return rprGlidePose(P, w, leg, tor, ease(fe(GLIDE0 - 40, GLIDE1, t)));   // the glide
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
      if (ult && !fly && t < 2850) return fmPoseLoser(P, w, leg, tor, t);   // The Ferryman: dragged in by the chains
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
      if (MG.broke && pn && !FIN.out && L_().state !== "gone" && !((ult || pota) && t >= MT.SPLASH)) { c.save(); mgPlace(pn, t); rprLoser(c, pn, t); c.restore(); }   // out of its panel: over the whole page, turned with it
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      if (k < 1) { rprPool(c, k); c.clip(); }
      c.globalCompositeOperation = "difference"; c.fillStyle = "#ffffff"; c.fillRect(0, 0, MG.cw, MG.ch);
      c.restore();
    },
    hint(t) { return t >= cornerT ? "rgba(214,216,228,0.62)" : "rgba(30,28,40,0.55)"; },
    over(o, t) {
      if (t > FIN.launch && t < FIN.launch + 420 && MG.byId.strike) {   // white speed lines along the real launch direction (ink ones would vanish in the night)
        const Lp = L_(), pn = MG.byId.strike, a = (1 - fe(FIN.launch + 200, FIN.launch + 420, t)) * (ult || pota ? fmTide(t) : 1);
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
      if (ult) { if (!B.stroke2) B.stroke2 = rprStrokePts(40, true); rprCrescent(o, B.stroke2, 1, Math.min(L.gw, L.gh) * 0.03, sil); }
    },
    cues(t) {
      // (not a sound) the tear's glow is drawn inside the panel, so amber would come out as its complement: white ink instead. cues run after the
      // engine has made the tear, before the frame is drawn
      const sp = MG.byId.strike;
      if (sp) for (const g of sp.glows) g.col = ult ? NGOLD : INK;   // (the Ultimate's tear burns gold: gold's complement)
      cueOnce("toll", TOLL, () => Cin.go(() => {   // a big bronze bell: the hum an octave down, the strike note, a minor third, the fifth, the octave; long tails
        for (const [f, v, d] of [[55, 0.13, 3.4], [110, 0.17, 3.0], [131, 0.07, 2.4], [165, 0.06, 2.0], [220, 0.06, 1.7], [293, 0.035, 1.3], [370, 0.025, 1.0]]) Cin._osc("sine", f, f * 0.997, d, v, 0.006);
        Cin._noise(0.07, 0.18, 1700, 700, "bandpass", 1.3);
      }));
      cueOnce("rise", RISE0, () => Cin.go(() => { Cin._noise(0.8, 0.05, 900, 3800, "bandpass", 3); Cin._osc("sine", 1320, 1980, 0.8, 0.012, 0.6); }));
      cueOnce("ting", RISE1, () => Cin.go(() => Cin.chime(2637)));
      cueOnce("pluck", MT.INSET, () => Cin.go(() => Cin.pluck(990)));
      cueOnce("smirk", SMIRK + 20, () => Cin.go(() => { Cin._osc("triangle", 2350, 2349, 0.18, 0.03, 0.003); Cin._osc("triangle", 3520, 3519, 0.22, 0.02, 0.003, 0.07); }));
      if (!ult) cueOnce("glide", GLIDE0, () => Cin.go(() => { Cin._noise(0.5, 0.07, 500, 1100, "bandpass", 1.4, 0, -0.4); Cin._noise(0.45, 0.05, 1100, 600, "bandpass", 1.4, 0.2, 0.4); }));
      if (!ult) cueOnce("back", 2620, () => Cin.go(() => Cin.whoosh(0.22, 0.4, -0.5, 0.18)));
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
      cueOnce("toll2", TOLL2, () => Cin.go(() => { for (const [f, v, d] of [[110, 0.05, 2.2], [131, 0.02, 1.6], [220, 0.02, 1.2]]) Cin._osc("sine", f, f * 0.997, d, v, 0.01); }));
    },
  };

  /* ===================== the Ultimate page, "The Ferryman" (MANGA.reaper.ulti; design: Project files ultimates/manga/reaper/fable-ferryman.md) =====================
     Played when the lethal hit is his Soul Harvest (the engine's long timeline: SPLASH 3250, AFTER 4700). Last Rites to the strike panel; from 2350 he stands
     planted at his strike spot, the scythe swings forward and Soul Harvest's ghost chains fly out of the blade (2420), bite round the loser's middle at the far
     edge (2500) and drag him in, heels dug in, little souls sliding up the chains (to 2760); he lets go, whips the scythe back low behind him, the drop, and the
     hook is two crescents at once (an X through the loser), a gold SHHK, the tear burns gold; 3050 the loser goes straight up and out, the soul stays.
     3250 the tide: panel 5 is the river, turned with the page like every panel (night water, a white moon and its broken reflection, the near shore with reeds,
     the far bank with three small stones, a bare tree and a gate) and him standing in a punt, the scythe as the pole, a candle lantern hung on the blade;
     3300 the soul comes down onto the bow; 3450 the push, the boat crosses (3500-4300) with the harvest's little souls bobbing in its wake; 3750 the fare:
     a gold coin rises out of the soul, 3850 the flip, 4050 he catches it (ting), 4100 bites it, tucks it under the hood; 4300 the bow touches the bank (tok);
     4330 the soul goes up the bank through the gate and fades, he bows his head; 4700 panel 4 of Last Rites (the stone: the far bank's receipt).
     Inside a panel every colour is painted as its complement (neg: the page is turned afterwards); over the page (the soul, the coin, the words) as it looks.
     The splash's world: the waterline is y = 0 (-1 the surface), the boat starts at x = 0 and crosses to X1 (fmGeo). Every helper here is prefixed fm. */
  const NGHOST = neg("#bfffe0"), NGOLD = neg(MG_GOLD), POLE = "#8a8a8a", HULL = "#a9a9a9";   // ghost green and gold, painted as their complements; the pole's grey core, the hull's grey
  const F_RAISE = 2420, F_BITE = 2500, F_LET = 2760, F_WHIP = 2800, F_HOLD = 2880, F_SOUL = 3300, F_SEAT = 3520, F_GO = 3500, F_STOP = 4300,
    F_COIN = 3750, F_FLIP = 3850, F_CATCH = 4050, F_LAND = 4330, F_GONE = 4650, GATE = 47;
  const LX0 = () => (MG.lay && MG.lay.port ? 150 : 120);
  const fmTide = (t) => 1 - fe(MT.SPLASH, MT.SPLASH + (MG.reduced ? 1 : 100), t);   // what floats over the strike goes as the river comes in (at once with reduced motion)   // how far beyond his spot the loser starts (world units; upright off the panel's edge)
  let fmStarsA = [], fmWaterA = [];

  /* ---- the strike: the drag ---- */
  function fmLoserX(t) {
    if (t >= HIT) return FIN.lx - FIN.dir * 5;
    if (MG.reduced) return FIN.lx;
    return FIN.lx + FIN.dir * LX0() * (1 - ease(fe(F_BITE, F_LET, t)));
  }
  // he stands where he was in the look and the inset (both are drawn at MT.STRIKE, when the Ultimate has him at his strike spot already)
  function fmHome(fn) { const W = W_(), ox = W.x, oy = W.y; W.x = FIN.wx; W.y = 0; try { return fn(); } finally { W.x = ox; W.y = oy; } }
  // the heels dig in: short speed lines low behind the loser while he is dragged (panel px)
  function fmHeels(c, pn, t) {
    const a = 0.4 * fe(F_BITE, F_BITE + 60, t) * (1 - fe(F_LET - 40, F_LET + 60, t));
    if (a < 0.02 || MG.reduced) return;
    const q = pn.p(loserAt(t)[0] + FIN.dir * 30, -4);
    mgSpeed(c, q[0], q[1], 64 * pn.z, 12 * pn.z, 0, t * 0.5 * FIN.dir, a, false, 0.6);
  }
  // Soul Harvest's ghost chains from the blade's tip to the loser's middle (world units): six thin ghost lines, two chains (dashed links in ghost green,
  // a white core), from 2500 three loops round his middle and the little souls sliding up the chains to the blade; they fly out with a wave, go taut, go slack
  function fmChains(c, pn, t) {
    if (t < F_RAISE || t > F_LET + 100) return;
    const grow = MG.reduced ? 1 : easeOut(fe(F_RAISE, F_BITE, t)), fade = 1 - fe(F_LET, F_LET + 100, t);
    if (grow <= 0.01 || fade <= 0.01) return;
    const Lp = L_(), A = rprBladeTip(W_(), t), lx = loserAt(t)[0], B = [lx, -Lp.s.h * 0.42];
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const taut = t >= F_BITE && t < F_LET, d = Math.abs(lx - FIN.lx) / LX0();
    const sag = t < F_BITE ? 8 : taut ? 2 + 4 * d : 3 + 12 * fe(F_LET, F_LET + 100, t);
    const wave = MG.reduced ? 0 : 8 * (1 - fe(F_BITE, F_BITE + 60, t)), jit = taut && !MG.reduced ? Math.sin(t * 0.19) : 0;
    const at = (u, off, kink) => { const s = Math.sin(Math.PI * u), o = off * s + (wave * Math.sin((u * len) / 40 * TAU - t * 0.05) + kink * Math.sin(u * TAU * 1.5 + off) + jit) * s; return [A[0] + dx * u + nx * o, A[1] + dy * u + ny * o + sag * s]; };
    const line = (off, kink, n) => { c.beginPath(); for (let i = 0; i <= n; i++) { const q = at((i / n) * grow, off, kink); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); } };
    pn.world(c); c.save(); c.lineCap = "round"; c.lineJoin = "round";
    const nl = MG.slow ? 3 : 6;
    c.globalAlpha = 0.5 * fade; c.strokeStyle = NGHOST; c.lineWidth = 0.6;
    for (let i = 0; i < nl; i++) { line((i / (nl - 1) - 0.5) * 16, 3, 16); c.stroke(); }
    c.globalAlpha = fade;
    const chain = () => { c.setLineDash([3, 2]); c.strokeStyle = NGHOST; c.lineWidth = 2.2; c.stroke(); c.setLineDash([]); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke(); };
    for (const off of [-3.5, 3.5]) { line(off, 0, 22); chain(); }
    if (t >= F_BITE) {   // the bite: three loops round his middle
      const k = MG.reduced ? 1 : easeOut(fe(F_BITE, F_BITE + 90, t)), cy = -Lp.s.h * 0.4, rx = Lp.s.w * 0.6 * k + 0.5;
      for (let j = 0; j < 3; j++) { c.beginPath(); c.ellipse(lx, cy + (j - 1) * 4.5, rx + j * 1.5, 3.2, (j - 1) * 0.1, 0, TAU); chain(); }
      const n = MG.slow ? 1 : 3;   // the little souls of the harvest, from him up to the blade
      for (const off of [-3.5, 3.5]) for (let i = 0; i < n; i++) {
        const u = 1 - ((t * 0.0011 + i / n + (off > 0 ? 0.17 : 0)) % 1), q = at(u * grow, off, 0), q2 = at(Math.min(1, u * grow + 0.03), off, 0);
        fmWisp(c, q[0], q[1], 2.5, Math.atan2(q[1] - q2[1], q[0] - q2[0]), t * 0.012 + i * 2);
      }
    }
    c.restore(); pn.screen(c);
  }
  // a little soul of the harvest (world units, inside a panel): ghost green (as its complement), a white rim and two white dot eyes once turned, the tail streaming
  // behind it; ang: where it is heading
  function fmWisp(c, x, y, r, ang, ph) {
    const tx = -Math.cos(ang), ty = -Math.sin(ang), px = -ty, py = tx, w1 = Math.sin(ph) * r * 0.7, w2 = Math.sin(ph + 1.3) * r * 0.5;
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(px * r * 0.7, py * r * 0.7);
    c.quadraticCurveTo(tx * r * 1.7 + px * w1, ty * r * 1.7 + py * w1, tx * r * 2.8 + px * w2, ty * r * 2.8 + py * w2);
    c.quadraticCurveTo(tx * r * 1.5 - px * r * 0.2, ty * r * 1.5 - py * r * 0.2, -px * r * 0.7, -py * r * 0.7); c.closePath();
    c.fillStyle = NGHOST; c.fill();
    c.beginPath(); c.ellipse(0, 0, r, r * 1.15, 0, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = Math.max(0.5, r * 0.22); c.stroke();
    c.fillStyle = INK; for (const ex of [-0.35, 0.35]) { c.beginPath(); c.arc(ex * r, -r * 0.1, r * 0.17, 0, TAU); c.fill(); }
    c.restore();
  }
  // him on the strike panel: from the look's last pose the scythe swings forward over the top (2350-2420), the chains fly, he hauls (2500-2760, leaning back, both
  // hands on the snath, the back foot sliding), lets go and whips it back over his head (2760-2800), the glide's wind-up behind him (2800-2880), the hold
  function fmPoseStrike(P, w, leg, tor, t) {
    const lookF = [w * 0.6, -leg - tor * 0.6], lookB = [-w * 0.62, -leg - tor * 0.25], out = [w * 0.7, -leg - tor * 0.95];
    P.expr = "grin"; P.mouth = 0;
    if (t < F_LET) {
      const k = easeOut(fe(MT.STRIKE, F_RAISE, t)), tug = MG.reduced ? (t >= F_BITE ? 1 : 0) : ease(fe(F_BITE, F_BITE + 120, t));
      P.holdAng = lerp(-1.56, -0.35, k); P.bladeS = lerp(-1, 1, k); P.scyBack = t < 2385;
      P.crouch = 0.12 * k; P.lean = lerp(-0.05, -0.04, k) - 0.16 * tug + (MG.reduced ? 0 : Math.sin(t * 0.07) * 0.015 * tug);
      const hF = lerp2(lookF, out, k), grip = [hF[0] - Math.cos(P.holdAng) * 10, hF[1] - Math.sin(P.holdAng) * 10];
      return { hF, hB: lerp2(lerp2(lookB, [w * 0.3, -leg - tor * 0.6], k), grip, tug), fF: [w * 0.4, 0], fB: [-w * 0.3 - 5 * tug, 0] };
    }
    if (t < F_WHIP) {
      const k = easeOut(fe(F_LET, F_WHIP, t)), grip = [out[0] - Math.cos(-0.35) * 10, out[1] - Math.sin(-0.35) * 10];
      P.holdAng = lerp(-0.35, -1.56, k); P.bladeS = lerp(1, -1, k); P.scyBack = k > 0.5; P.crouch = 0.12 * (1 - k); P.lean = lerp(-0.2, -0.05, k);
      return { hF: lerp2(out, lookF, k), hB: lerp2(grip, lookB, k), fF: lerp2([w * 0.4, 0], [w * 0.5, 0], k), fB: lerp2([-w * 0.3 - 5, 0], [-w * 0.35, 0], k) };
    }
    return rprGlidePose(P, w, leg, tor, ease(fe(F_WHIP, F_HOLD, t)));
  }
  // the loser on the strike panel: terror at the far edge, leaning away, hands up; hauled in, heels dug in, hands on the chain; let go: a bounce on his spot
  function fmPoseLoser(P, w, leg, tor, t) {
    P.expr = "terror"; P.exK = fe(MT.STRIKE, 2850, t);
    const tug = MG.reduced ? (t >= F_BITE ? 1 : 0) : ease(fe(F_BITE, F_BITE + 100, t));
    const upF = [w * 0.8, -leg - tor * 0.85], upB = [w * 0.45, -leg - tor * 0.95], grabF = [w * 0.55, -leg - tor * 0.4], grabB = [w * 0.25, -leg - tor * 0.45];
    if (t < F_LET) {
      P.lean = -0.3 - 0.06 * tug + (MG.reduced ? 0 : Math.sin(t * 0.05) * 0.03 * tug); P.mouth = 0.6 + 0.3 * tug;
      return { hF: lerp2(upF, grabF, tug), hB: lerp2(upB, grabB, tug), fF: [w * (0.24 + 0.3 * tug), 0], fB: [-w * (0.2 - 0.15 * tug), 0] };
    }
    const k = ease(fe(F_LET, 2850, t));
    P.hop = MG.reduced ? 0 : 3 * Math.sin(Math.PI * fe(F_LET, 2840, t)); P.lean = lerp(-0.36, 0, k); P.mouth = lerp(0.9, 0.3, k);
    return { hF: lerp2(grabF, [w * 0.75, -leg - tor * 0.42], k), hB: lerp2(grabB, [-w * 0.7, -leg - tor * 0.42], k), fF: lerp2([w * 0.54, 0], [w * 0.24, 0], k), fB: lerp2([-w * 0.05, 0], [-w * 0.2, 0], k) };
  }

  /* ---- the river (panel 5) ---- */
  // the splash's world: wide, a fixed camera (the near shore at 0.1 of the page, the boat from 0.24 to 0.65, the far bank's foot at 0.78); upright, the camera
  // follows the boat, leading it more and more (the shore slides out, the bank and its gate slide in). Once per page (the panel's size is fixed).
  function fmGeo(pn) {
    const B = box();
    if (B.fmG) return B.fmG;
    const port = !!MG.lay.port, D = FIN.dir, vh = port ? 440 : 240, VW = (vh * pn.w) / pn.h, BH = 62, wl = port ? 0.68 : 0.74;
    const trav = port ? 200 : Math.max(60, 0.68 * VW - (2 * BH + 10));
    const G = { port, vh, VW, BH, WY: -(wl - 0.5) * vh, X0: 0, X1: D * trav, CX: port ? 0 : D * (0.4 * VW - (BH + 6)), far: port ? 0.6 : 0.56 };
    G.shoreX = G.X0 - D * (BH + 6); G.bankX = G.X1 + D * (BH + 4);
    return (B.fmG = G);
  }
  const fmBoatX = (t, G) => G.X0 + (G.X1 - G.X0) * (MG.reduced && G.port ? 1 : ease(fe(F_GO, F_STOP, t)));
  const fmBob = (t) => (MG.reduced ? 0 : 1.2 * Math.sin(t * 0.004));
  const fmTilt = (t) => (MG.reduced ? 0 : 0.015 * Math.cos(t * 0.004) + 0.04 * easeOut(fe(F_STOP, F_STOP + 80, t)) * (1 - ease(fe(F_STOP + 80, F_STOP + 230, t))));   // the bow dips as it touches the bank
  const fmStandX = (t, G) => fmBoatX(t, G) - FIN.dir * G.BH * 0.42;   // he stands in the stern half, the soul sits at the bow
  const fmCam = (t, pn) => { const G = fmGeo(pn); return { wx: G.port ? fmBoatX(t, G) + FIN.dir * G.VW * lerp(0.03, 0.2, MG.reduced ? 1 : ease(fe(F_GO, F_STOP, t))) : G.CX, wy: G.WY, vh: G.vh }; };
  // a world point of the river on the screen at page time tt, as the engine places the panel (its slide in from the bottom included); touches no panel state
  function fmSp(tt, wx, wy) {
    const pn = MG.byId.splash, cm = fmCam(tt, pn), z = pn.h / cm.vh, ks = easeOut(fe(pn.t0, pn.t0 + pn.slide, tt));
    return [pn.cx + (wx - cm.wx) * z + pn.off[0] * (1 - ks), pn.cy + (wy - cm.wy) * z + pn.off[1] * (1 - ks)];
  }
  // fn(W, G) with him standing in the boat at page time t (his place and the bob; the pose's boat branch), then everything as it was
  function fmAt(t, fn) {
    const W = W_(), G = fmGeo(MG.byId.splash), ox = W.x, oy = W.y;
    W.x = fmStandX(t, G); W.y = fmBob(t); boat = true;
    try { return fn(W, G); } finally { W.x = ox; W.y = oy; boat = false; }
  }
  const fmHandScr = (t) => fmAt(t, (W) => { const q = rprPt(W, t, "hB"); return fmSp(t, q[0], q[1]); });
  // him in the boat: the scythe held up as the pole (the blade forward over the boat, the lantern on its tip), the hands slide up, the push, the pole upright;
  // the free hand catches the coin, takes it to his mouth (the bite) and back to his chest; a small bow of the head as the soul leaves
  function fmPoseBoat(P, w, leg, tor, t) {
    const r = MG.reduced, slide = r ? 0 : ease(fe(3450, 3550, t)), push = r ? 0 : ease(fe(3550, 3750, t)), back = r ? 1 : ease(fe(3750, 3900, t));
    const a = lerp(lerp(lerp(-1.5, -1.3, slide), -1.75, push), -1.57, back), off = lerp(lerp(lerp(0, 12, slide), -4, push), 0, back);
    P.holdAng = a; P.bladeS = 1; P.scyBack = false; P.scyK = 1; P.mouth = t >= 4180 && t < 4260 ? 0.35 : 0;
    P.expr = t >= 4420 ? "calm" : "grin";
    const hF = [w * 0.55 + Math.cos(a) * off, -leg - tor * 0.62 + Math.sin(a) * off], onPole = [hF[0] - Math.cos(a) * 14, hF[1] - Math.sin(a) * 14];
    const chest = [w * 0.3, -leg - tor * 0.42], catchP = [w * 0.48, -leg - tor * 0.86], mouth = [w * 0.32, -leg - tor * 0.47];
    const free = r ? 1 : ease(fe(3750, 3870, t)), lift = ease(fe(3950, F_CATCH, t)), bite = ease(fe(4100, 4200, t)), down = ease(fe(4260, F_LAND, t));
    const hB = lerp2(lerp2(lerp2(lerp2(onPole, chest, free), catchP, lift), mouth, bite), chest, down);
    P.lean = lerp(lerp(lerp(0, 0.1, slide), -0.05, push), 0, back) - 0.06 * bite * (1 - down) + 0.08 * ease(fe(4380, F_GONE, t));
    return { hF, hB, fF: [w * 0.3, 0], fB: [-w * 0.3, 0] };
  }
  const fmMoonAt = (pn, G) => { const u = G.port ? 0.62 : 0.5; return [pn.x0 + (FIN.dir > 0 ? u : 1 - u) * pn.w, pn.y0 + (G.port ? 0.19 : 0.15) * pn.h, (G.port ? 0.085 : 0.09) * pn.h]; };
  // the far bank's profile: d world units past its foot (toward the far side), y up is negative: a steep slope, then nearly flat
  const bankY = (d) => (d < 44 ? -64 * (1 - (1 - d / 44) * (1 - d / 44)) : -64 - (d - 44) * 0.06);
  function fmDrawSplash(c, pn, t) {
    const G = fmGeo(pn), bx = fmBoatX(t, G), bob = fmBob(t), tilt = fmTilt(t), mo = fmMoonAt(pn, G), fy = pn.y0 + pn.h * G.far;
    pn.screen(c);
    rprSky(c, pn, t, G.far * 0.9);
    c.fillStyle = INK; c.beginPath();
    for (const [u, v, k] of fmStarsA) { const x = pn.x0 + u * pn.w, y = pn.y0 + v * pn.h; if (Math.hypot(x - mo[0], y - mo[1]) > mo[2] * 1.35 && y < fy - 6) { c.moveTo(x + 1.3, y); c.arc(x, y, k > 0.8 ? 1.7 : 1.2, 0, TAU); } }
    c.fill();
    rprMoon(c, mo[0], mo[1], mo[2]);
    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(pn.x0 - 4, fy); c.lineTo(pn.x1 + 4, fy); c.stroke();   // the far shore
    fmWater(c, pn, t, G, mo, fy);
    pn.world(c);
    fmBank(c, G);
    fmShore(c, G);
    fmWake(c, t, G);
    fmAt(t, (W) => {
      const tip = rprBladeTip(W, t);
      if (!MG.slow) {   // the lantern's light, round it and on the water (candle amber: painted as its complement)
        c.fillStyle = rgba(NCOL, 0.12); c.beginPath(); c.ellipse(tip[0], -0.5, 26, 5, 0, 0, TAU); c.fill();
        c.fillStyle = rgba(NCOL, 0.14); c.beginPath(); c.arc(tip[0], tip[1] + 11, 10, 0, TAU); c.fill();
      }
      pn.screen(c);
      mgPuppet(c, pn, W, t, { light: dirAng(-0.5), box: BOX, mono: true, post: rprPost(W, t, cheekK(t)) });
      pn.world(c);
      fmBoat(c, bx, bob, tilt, G);
      fmPole(c, W, t);
      fmLantern(c, tip, t, tilt);
    });
    pn.screen(c);
  }
  // the water: short strokes drifting against the boat's way (with the camera too, upright), the moon's broken reflection under it (panel px)
  function fmWater(c, pn, t, G, mo, fy) {
    const drift = MG.reduced ? 0 : -(fmBoatX(t, G) - G.X0) * pn.z * (G.port ? 1 : 0.4), Wd = pn.w + 60, n = MG.slow ? 10 : fmWaterA.length;
    c.strokeStyle = INK; c.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const s = fmWaterA[i], y = fy + 7 + s.y * (pn.y1 - fy - 9), len = (0.02 + 0.04 * s.y) * pn.w;
      const x = pn.x0 - 30 + ((((s.x * Wd + drift * (0.7 + 0.3 * s.y) - (MG.reduced ? 0 : t * 0.004 * (1 + s.dr))) % Wd) + Wd) % Wd);
      c.lineWidth = 0.8 + 1.4 * s.y; c.beginPath(); c.moveTo(x - len / 2, y); c.lineTo(x + len / 2, y); c.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const q = i / 6, y = fy + 5 + q * (pn.y1 - fy) * 0.8, hw = (0.02 + 0.03 * q) * pn.w, x = mo[0] + (MG.reduced || MG.slow ? 0 : Math.sin(t * 0.003 + i * 1.7) * 0.01 * pn.w);
      c.lineWidth = 1.2 + q * 1.4; c.beginPath(); c.moveTo(x - hw, y); c.lineTo(x - hw * 0.25, y); c.moveTo(x - hw * 0.05, y); c.lineTo(x + hw, y); c.stroke();
    }
  }
  // the far bank (world): night ground with a white edge and hatching under it, three small stones, a bare tree and the gate at the top of the slope
  function fmBank(c, G) {
    const D = FIN.dir, X = (d) => G.bankX + D * d, edge = () => { c.moveTo(X(-2), 1.5); for (let d = 0; d <= 280; d += 7) c.lineTo(X(d), bankY(d)); };
    c.beginPath(); c.moveTo(X(-12), 300); edge(); c.lineTo(X(280), 300); c.closePath(); c.fillStyle = PAPER; c.fill();
    c.strokeStyle = INK; c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = 0.8; c.beginPath();
    for (let d = 3; d < 270; d += 9) { const y = bankY(d) + 3; c.moveTo(X(d), y); c.lineTo(X(d - 7), y + 13); }
    c.stroke();
    c.lineWidth = 1.8; c.beginPath(); edge(); c.stroke();
    for (const [d, sc, tl] of [[20, 0.8, -0.12], [70, 1, 0.06], [108, 0.75, -0.05]]) fmGrave(c, X(d), bankY(d) + 1, sc, tl * D);
    // the tree: five strokes
    const tx = X(89), ty = bankY(89) + 1;
    c.lineWidth = 1.7; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + D * 3, ty - 34); c.stroke();
    c.lineWidth = 1.1; c.beginPath(); c.moveTo(tx + D * 2, ty - 20); c.lineTo(tx + D * 12, ty - 30); c.lineTo(tx + D * 18, ty - 33); c.moveTo(tx + D * 3, ty - 34); c.lineTo(tx - D * 6, ty - 44); c.moveTo(tx + D * 3, ty - 34); c.lineTo(tx + D * 9, ty - 47); c.stroke();
    // the gate: two posts, a lintel with turned-up ends, a bar
    const gx = X(GATE), gy = bankY(GATE) + 0.5;
    c.fillStyle = PAPER; c.lineWidth = 1.1;
    for (const sd of [-1, 1]) { c.beginPath(); c.rect(gx + sd * 8 - 1.8, gy - 27, 3.6, 27); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(gx - 14, gy - 31.5); c.quadraticCurveTo(gx, gy - 29.5, gx + 14, gy - 31.5); c.lineTo(gx + 13, gy - 28); c.quadraticCurveTo(gx, gy - 26.5, gx - 13, gy - 28); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(gx - 8, gy - 21); c.lineTo(gx + 8, gy - 21); c.stroke();
  }
  function fmGrave(c, x, y, sc, tl) {
    c.save(); c.translate(x, y); c.rotate(tl); c.scale(sc, sc);
    c.beginPath(); c.moveTo(-4.5, 0); c.lineTo(-4.5, -8); c.arc(0, -8, 4.5, Math.PI, 0); c.lineTo(4.5, 0); c.closePath();
    c.fillStyle = PAPER; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.1; c.stroke();
    c.lineWidth = 0.7; c.beginPath(); c.moveTo(-1.6, -8.5); c.lineTo(1.6, -8.5); c.moveTo(0, -10.5); c.lineTo(0, -5.5); c.stroke();   // a small cross cut in it
    c.restore();
  }
  // the near shore (world): the bank the boat pushes off from, reeds at the water's edge
  function fmShore(c, G) {
    const D = FIN.dir, X = (d) => G.shoreX - D * d, edge = () => { c.moveTo(X(0), 1); c.quadraticCurveTo(X(5), -5.5, X(14), -6.5); c.lineTo(X(420), -8); };
    c.beginPath(); c.moveTo(X(-6), 300); edge(); c.lineTo(X(420), 300); c.closePath(); c.fillStyle = PAPER; c.fill();
    c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = 0.8; c.beginPath();
    for (let d = 6; d < 400; d += 9) { c.moveTo(X(d), -4); c.lineTo(X(d + 7), 9); }
    c.stroke();
    c.lineWidth = 1.8; c.beginPath(); edge(); c.stroke();
    c.lineWidth = 1.1; c.beginPath();
    for (let i = 0; i < 6; i++) { const x0 = X(3 + i * 5.5), h = 14 + ((i * 7) % 4) * 3.5, ln = (i % 2 ? 0.28 : -0.12) * D; c.moveTo(x0, -5.5); c.quadraticCurveTo(x0 + ln * h * 0.3, -5.5 - h * 0.6, x0 + ln * h, -5.5 - h); }
    c.stroke();
  }
  // the wake: a fan of lines off the stern while the boat moves, and the harvest's little souls following it, bobbing on the water
  function fmWake(c, t, G) {
    if (t < 3550) return;
    const D = FIN.dir, mv = MG.reduced ? 0 : Math.sin(Math.PI * fe(F_GO, F_STOP, t)), sx = fmBoatX(t, G) - D * (G.BH + 2);
    if (mv > 0.05) {
      c.save(); c.globalAlpha = mv; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < 4; i++) { c.moveTo(sx - D * 3, -1); c.lineTo(sx - D * (16 + i * 8), -1 + (i % 2 ? 2 + i * 1.6 : -1 - i * 0.6)); }
      c.stroke(); c.restore();
    }
    const n = MG.slow ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const a = fe(3550 + i * 90, 3700 + i * 90, t);
      if (a <= 0) continue;
      const x = fmBoatX(t - (i + 1) * (MG.slow ? 240 : 120), G) - D * (G.BH + 10 + i * 5), y = -4 + (MG.reduced ? 0 : 1.6 * Math.sin(t * 0.005 + i * 1.9));
      c.save(); c.globalAlpha = a; fmWisp(c, x, y, 4.8, D > 0 ? 0 : Math.PI, t * 0.008 + i * 2); c.restore();
    }
  }
  // the punt (world, centre bx): a flat hull with the bow curling up, planks, a seat board at the bow; the water closes over its lower half and his feet
  function fmBoat(c, bx, bob, tilt, G) {
    const H = G.BH;
    c.save(); c.translate(bx, bob); c.scale(FIN.dir, 1); c.rotate(tilt); c.lineJoin = "round"; c.lineCap = "round";
    c.beginPath(); c.moveTo(-H - 1, -17); c.lineTo(-H + 5, 6); c.lineTo(H - 22, 6); c.quadraticCurveTo(H - 3, 5, H + 2, -18); c.quadraticCurveTo(H + 4, -27, H - 2, -29); c.quadraticCurveTo(H - 1, -21, H - 11, -16.5); c.quadraticCurveTo(0, -15.5, -H - 1, -17); c.closePath();
    c.fillStyle = HULL; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
    c.lineWidth = 0.8; c.beginPath(); c.moveTo(-H + 1, -11.5); c.lineTo(H - 7, -11.5); c.moveTo(-H + 2.5, -6); c.lineTo(H - 4, -6); c.stroke();
    c.fillStyle = INK; c.fillRect(H - 32, -19.5, 14, 3);
    c.restore();
    c.fillStyle = PAPER; c.fillRect(bx - H - 2, -1, 2 * H + 6, 14);
    c.strokeStyle = INK; c.lineWidth = 1.2; c.lineCap = "round"; c.beginPath(); c.moveTo(bx - H - 9, -1); c.lineTo(bx + H + 10, -1); c.stroke();
  }
  // the pole below his hands: the snath goes on down past the gunwale to the water (in front of the hull), two rings where it goes in
  function fmPole(c, W, t) {
    MG.pt = t;
    const P = pose(W, mgTk(t)), a = P.holdAng + P.lean, D = W.facing, Lb = P.w * SCY.butt;
    const q = rot([P.hF[0] - Math.cos(P.holdAng) * Lb, P.hF[1] - Math.sin(P.holdAng) * Lb], P.hip, P.lean), x0 = W.x + D * q[0], y0 = W.y + q[1], dx = -D * Math.cos(a), dy = -Math.sin(a);
    if (dy < 0.3) return;
    const len = Math.min(80, (-1 - y0) / dy);
    if (len <= 0) return;
    const x1 = x0 + dx * len;
    c.lineCap = "round"; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, -1);
    c.strokeStyle = INK; c.lineWidth = 4.4; c.stroke(); c.strokeStyle = POLE; c.lineWidth = 2.2; c.stroke();
    if (MG.slow || MG.reduced) return;
    c.strokeStyle = INK; c.lineWidth = 0.9;
    for (let i = 0; i < 2; i++) { const u = (t * 0.0014 + i * 0.5) % 1; c.globalAlpha = 1 - u; c.beginPath(); c.ellipse(x1, -1, 3 + 11 * u, 0.8 + 1.6 * u, 0, 0, TAU); c.stroke(); }
    c.globalAlpha = 1;
  }
  // the lantern hung on the blade's tip: a cap, a cage, a candle-amber flame (as its complement); it swings with the hull
  function fmLantern(c, tip, t, tilt) {
    const sw = (MG.reduced ? 0 : 0.1 * Math.sin(t * 0.004 + 0.8)) + tilt * 2, fl = MG.reduced ? 1 : 1 + 0.12 * Math.sin(t * 0.031);
    c.save(); c.translate(tip[0], tip[1]); c.rotate(sw); c.lineJoin = "round";
    c.strokeStyle = INK; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 4); c.stroke();
    c.lineWidth = 1.1; c.fillStyle = PAPER;
    c.beginPath(); c.moveTo(-4.6, 6.5); c.lineTo(0, 3.6); c.lineTo(4.6, 6.5); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.rect(-3.6, 6.5, 7.2, 8.6); c.fill(); c.stroke();
    c.fillStyle = NCOL; c.beginPath(); c.moveTo(0, 12.6 - 4.4 * fl); c.quadraticCurveTo(2.3, 11.4, 0, 13.6); c.quadraticCurveTo(-2.3, 11.4, 0, 12.6 - 4.4 * fl); c.fill();
    c.restore();
  }

  /* ---- over the page: the soul in the boat, the coin ---- */
  // the soul from 3300: it comes down onto the bow (dipping below the line), rides there, then goes up the bank through the gate and fades (screen px)
  function fmSoulAt(t) {
    const b = rprSoulBase(F_SOUL), pn = MG.byId.splash;
    if (!b || !pn || t >= F_GONE) return null;
    const G = fmGeo(pn), D = FIN.dir, s1 = L_().s.w * 0.36 * clamp(pn.h / G.vh, 1.1, 2.4);
    const seat = (tt) => { const q = fmSp(tt, fmBoatX(tt, G) + D * (G.BH - 25), fmBob(tt) - 19); return [q[0], q[1] - s1 * 1.25]; };
    if (t < F_SEAT) { const k = ease(fe(F_SOUL, F_SEAT, t)), e = seat(t); return { x: lerp(b.x, e[0], k), y: lerp(b.y, e[1], k) + pn.h * 0.04 * Math.sin(Math.PI * k), s: lerp(b.s, s1, k), a: 1, tilt: b.tilt * (1 - k) }; }
    if (t < F_LAND || MG.reduced) { const e = seat(Math.min(t, F_LAND)); return { x: e[0], y: e[1], s: s1, a: MG.reduced ? 1 - fe(F_LAND, 4500, t) : 1, tilt: fmTilt(t) * D + 0.06 * Math.sin(t * 0.003) }; }
    const k = easeOut(fe(F_LAND, 4620, t)), e0 = seat(F_LAND), gt = fmSp(t, G.bankX + D * GATE, bankY(GATE) - 13), ctl = [lerp(e0[0], gt[0], 0.55), Math.min(e0[1], gt[1]) - pn.h * 0.14], u = 1 - k;
    return { x: u * u * e0[0] + 2 * u * k * ctl[0] + k * k * gt[0], y: u * u * e0[1] + 2 * u * k * ctl[1] + k * k * gt[1], s: s1 * (1 - 0.35 * k), a: 1 - fe(4520, F_GONE, t), tilt: 0.1 * Math.sin(t * 0.004) };
  }
  // the fare: it rises out of the soul's crown, flips over to his free hand (spinning), rides in his fist to his mouth and back, and goes under the hood
  function fmCoinAt(t) {
    if (t < F_COIN || t >= 4360) return null;
    const crown = (tt) => { const S = fmSoulAt(tt); return S ? [S.x, S.y - S.s * 1.3] : [0, 0]; };
    if (t < F_FLIP) { const k = easeOut(fe(F_COIN, F_FLIP, t)), c0 = crown(t); return { x: c0[0], y: c0[1] - L.gh * 0.05 * k, a: k, sp: 1 }; }
    if (t < F_CATCH) {
      const c0 = crown(F_FLIP), p0 = [c0[0], c0[1] - L.gh * 0.05], p1 = fmHandScr(F_CATCH), k = fe(F_FLIP, F_CATCH, t);
      if (MG.reduced) return k < 0.5 ? { x: p0[0], y: p0[1], a: 1 - 2 * k, sp: 1 } : { x: p1[0], y: p1[1], a: 2 * k - 1, sp: 1 };
      const ctl = [(p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - L.gh * 0.24], u = 1 - k;
      return { x: u * u * p0[0] + 2 * u * k * ctl[0] + k * k * p1[0], y: u * u * p0[1] + 2 * u * k * ctl[1] + k * k * p1[1], a: 1, sp: Math.cos(t * 0.035), apex: Math.abs(k - 0.5) < 0.08 };
    }
    const h = fmHandScr(t);
    return { x: h[0], y: h[1] - 1, a: 1 - fe(4300, 4360, t), sp: 1, held: true };
  }
  function fmCoin(o, t) {
    const C = fmCoinAt(t);
    if (!C || C.a <= 0.01) return;
    const r = L.gh * 0.026 * (C.held ? 0.85 : 1), rx = r * Math.max(0.12, Math.abs(C.sp)), g = C.apex ? 1.3 : 0.55 + 0.45 * Math.sin(t * 0.02);
    o.save(); o.globalAlpha = C.a; o.translate(C.x, C.y);
    o.fillStyle = MG_GOLD; o.strokeStyle = MG_GOLD_D; o.lineWidth = Math.max(1.2, r * 0.22);
    o.beginPath(); o.ellipse(0, 0, rx, r, 0, 0, TAU); o.fill(); o.stroke();
    if (rx > r * 0.4) { o.lineWidth = Math.max(0.8, r * 0.1); o.beginPath(); o.ellipse(0, 0, rx * 0.6, r * 0.6, 0, 0, TAU); o.stroke(); }
    star4(o, -rx * 0.35, -r * 0.45, r * 0.75 * g, MG_GOLD_PALE);
    o.restore();
  }
  // the kit's flute at any pitch (two falling notes as the soul goes through the gate)
  function fmFlute(f, dur) {
    const c = Sfx.ctx, t = c.currentTime, o = c.createOscillator(), lf = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = "sine"; o.frequency.value = f; lf.frequency.value = 5; lg.gain.value = f * 0.01; lf.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Cin.bus); o.start(t); lf.start(t); o.stop(t + dur + 0.05); lf.stop(t + dur + 0.05);
    Cin._noise(dur, 0.02, f * 2.7, f * 2.7, "bandpass", 3);
  }

  S_.ulti = Object.assign({}, S_, {
    name: "The Ferryman", pop: 3050, ownWords: true,   // pop: the launch waits for the gold impact frame; ownWords: the upright sizes are set here
    start(g) { S_.start(g); ult = true; },
    end() { ult = false; boat = false; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike");
      for (const q of [by("look"), by("inset")]) { const d0 = q.draw, c0 = q.cam; q.draw = (c, pn, t) => fmHome(() => d0(c, pn, t)); q.cam = (t, pn) => fmHome(() => c0(t, pn)); }
      strike.freeze = strike.cover = MT.SPLASH;   // the river covers the whole page from here: the strike is drawn once more, then a bitmap
      ps.splice(ps.findIndex((q) => q.id === "after"), 0, mgSplashPanel({ from: "b", paper: PAPER, dim: "255,255,255", slide: MG.reduced ? 1 : 180, cam: fmCam, draw: fmDrawSplash }));
      return ps;
    },
    build(lay) {
      S_.build(lay);
      const r = mgRng(2718);
      fmStarsA = Array.from({ length: 9 }, () => [0.04 + r() * 0.92, 0.05 + r() * 0.42, r()]);
      fmWaterA = Array.from({ length: 20 }, () => ({ x: r(), y: r(), dr: r() }));
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, k = lay.port ? Math.min(1, (L.gw * 0.9) / L.gh) : 1, m = lay.port ? 0.7 : 1;
      for (const w of ws) w.mul = (w.mul || 1) * k;
      Object.assign(ws.find((w) => w.text === "SHHK"), { size: 0.26, fill: MG_GOLD, t1: MT.SPLASH + 150 });   // gone as the river comes in
      ws.find((w) => w.text === "shhh...").fill = "#ffffff";   // (the engine makes the unfilled words after the hit gold)
      ws.push(
        { text: "ting", t0: F_CATCH, t1: 4420, size: 0.06, mul: m, jit: 0.1, rot: -0.08 * D, fill: MG_GOLD, at: () => { const h = fmHandScr(F_CATCH); return [h[0] + D * L.gw * 0.06, h[1] - L.gh * 0.07]; } },
        { text: "tok", t0: F_STOP, t1: 4600, size: 0.045, mul: m, jit: 0.1, fill: "#ffffff", at: () => { const G = fmGeo(MG.byId.splash), q = fmSp(F_STOP, fmBoatX(F_STOP, G) + D * G.BH, -28); return [q[0], q[1] - L.gh * 0.05]; } },
      );
      return ws;
    },
    // the drag (finLoser has just put the loser on his spot); once the river is in, the KO beam and its flying bits are gone
    after(t) {
      if (t < FIN.launch && !FIN.out) L_().x = fmLoserX(t);
      if (t >= MT.SPLASH && t < MT.AFTER) { if (FIN.beam && FIN.beam.t0 > -1e5) FIN.beam.t0 = -1e6; FIN.parts.length = 0; }
    },
    over(o, t) { S_.over(o, t); fmCoin(o, t); },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("fmSwing", 2360, () => Cin.go(() => Cin.whoosh(0.2, -0.4 * D, 0.4 * D, 0.3)));
      cueOnce("fmChains", F_RAISE, () => Cin.go(() => { Cin._noise(0.45, 0.07, 1400, 3000, "bandpass", 1.6); Cin._osc("sine", 660, 990, 0.3, 0.03, 0.02); }));   // the ghost breath
      cueOnce("fmBite", F_BITE, () => Cin.go(() => { Cin.tick(2800); Cin.clack(); Cin.growl(0.3); Cin._noise(0.3, 0.05, 300, 900, "bandpass", 1.2, 0, 0.3 * D); Cin.rumble(0.3); }));
      cueOnce("fmBack", F_LET, () => Cin.go(() => Cin.whoosh(0.22, 0.4, -0.5, 0.18)));
      cueOnce("fmTide", MT.SPLASH, () => Cin.go(() => { Cin._noise(0.7, 0.08, 250, 700, "bandpass", 1.1); Cin.sub(40, 28, 1.3, 0.4); }));
      cueOnce("fmPush", 3450, () => Cin.go(() => { Cin._noise(0.35, 0.05, 500, 250, "bandpass", 1.5); Cin.whoosh(0.3, 0.2 * D, -0.2 * D, 0.2); }));
      cueOnce("fmSeat", 3480, () => Cin.go(() => Cin._osc("sine", 780, 520, 0.3, 0.03, 0.05)));
      for (const lt of [3650, 3980, 4180]) cueOnce("fmLap" + lt, lt, () => Cin.go(() => Cin._osc("sine", 900, 600, 0.08, 0.02)));
      cueOnce("fmCoin", F_COIN, () => Cin.go(() => Cin.shimmer(2093, 0.25)));
      cueOnce("fmFlip", F_FLIP, () => Cin.go(() => Cin.tick(5200)));
      cueOnce("fmCatch", F_CATCH, () => Cin.go(() => { Cin.clack(); Cin.chime(2093); }));
      cueOnce("fmTeeth", 4220, () => Cin.go(() => Cin.tick(2400)));
      cueOnce("fmBank", F_STOP, () => Cin.go(() => { Cin._osc("sine", 110, 80, 0.25, 0.05); Cin._noise(0.12, 0.08, 150, 400, "bandpass", 1.5); }));
      cueOnce("fmSoul", F_LAND, () => Cin.go(() => { Cin._osc("sine", 520, 780, 0.35, 0.05, 0.05); Cin._osc("sine", 1040, 1560, 0.3, 0.02, 0.05, 0.05); }));
      cueOnce("fmFlute1", 4360, () => Cin.go(() => fmFlute(440, 0.3)));
      cueOnce("fmFlute2", 4520, () => Cin.go(() => fmFlute(370, 0.4)));
      cueOnce("fmDrone", 4600, () => Cin.go(() => Cin.drone(false)));
    },
  });
  /* ===================== the Potatality, "Rest in Peel" (MANGA.reaper.alt; design: Project files step8/fable-design.md) =====================
     Last Rites to the hook (no soul here: the peel is the ghost). 3250 the lights come on: panel 5, the splash, slides up over the night, plain ink on paper
     (page() turns only what is still above it): the loser stands there bare, a peeled potato, in his own skin's stripes for a moment while the scythe's
     second swing runs across the page (shhhhhk); 3380-3950 the long spiral peel lifts off him and rises like a ghost, his colour outside, cream inside, a
     little face at its top; 4050 it waves bye; he shivers and blushes. 4700 in panel 4's place, in colour: a pot by the Reaper, the bare potato sitting in
     it with a bay leaf, the lid drops on (plop), two eyes peek out from under it, steam; the engine's POP lifts the lid at 5250 (food()).
     The splash's world: the potato's feet at (0, 0), his middle at y = -36. Every helper here is prefixed rip. */
  const RIP_SKIN = "#f6e7c1", RIP_FLESH = "#efd9a8", RIP_BLUSH = "#ff8f9e", RIP_LEAF = "#8fbf6a";
  const R_SWING = 3270, R_PEEL0 = 3380, R_PEEL1 = 3950, R_WAVE = 4050, R_WAVE1 = 4560, R_LID = 4780, R_PLOP = 4860;
  const potX = (t) => wX(t) + FIN.dir * 62;   // the pot stands where the tombstone would
  const ripLw = (pn) => Math.max(1.1, 3 / pn.z);   // an ink line, in world units
  function ripCam(t, pn) {
    const port = MG.lay && MG.lay.port, vh = (port ? 320 : 215) * (1 - 0.05 * fe(MT.SPLASH, MT.AFTER, t));
    return { wx: 0, wy: -vh * (port ? 0.36 : 0.42), vh };
  }
  // the peel: n + 1 points along a helix that starts wrapped round him (k 0) and rises above him, swaying (k 1); f: which face shows (cos of the turn)
  function ripPeel(t) {
    const k = ease(fe(R_PEEL0, R_PEEL1, t)), n = 48, out = [], spin = (t - MT.SPLASH) * 0.0022 * k;
    for (let i = 0; i <= n; i++) {
      const s = i / n, th = s * 3.4 * TAU + spin, wy = -5 - s * 62, wr = 27.5 * Math.sqrt(Math.max(0.04, 1 - Math.pow((wy + 36) / 37, 2)));
      const y = lerp(wy, -76 - s * 92, k), R = lerp(wr, 15 - 8 * s, k), sway = Math.sin(t * 0.004 + s * 3.2) * 13 * k * s;
      out.push({ x: Math.sin(th) * R + sway, y, f: Math.cos(th) });
    }
    return out;
  }
  // one face of the peel: its runs of consecutive segments (one path each: ink, then colour, so a run has no seams)
  function ripPeelRuns(c, P, front, w, colr, lw) {
    c.lineCap = "round"; c.lineJoin = "round";
    let run = null;
    const flush = () => {
      if (!run || run.length < 2) { run = null; return; }
      for (const [wd, st] of [[w + lw * 2, INK], [w, colr]]) { c.strokeStyle = st; c.lineWidth = wd; c.beginPath(); c.moveTo(run[0].x, run[0].y); for (let i = 1; i < run.length; i++) c.lineTo(run[i].x, run[i].y); c.stroke(); }
      run = null;
    };
    for (let i = 1; i < P.length; i++) {
      const on = (P[i - 1].f + P[i].f) / 2 >= 0 === front;
      if (on) { if (!run) run = [P[i - 1]]; run.push(P[i]); } else flush();
    }
    flush();
  }
  // the bare potato: shivering, arms crossed over himself, eyes away, blushing
  function ripBare(c, pn, t, x, lw) {
    const D = FIN.dir, blush = ease(fe(3550, 3900, t)), cx = x, cy = -36;
    c.fillStyle = RIP_SKIN; c.strokeStyle = INK; c.lineWidth = lw * 1.3;
    c.beginPath(); c.ellipse(cx, cy, 26, 35, 0.05 * D, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = INK;   // a few potato eyes
    for (const [dx, dy, r] of [[-12, -18, 1.1], [14, -2, 0.9], [-6, 20, 1], [10, 22, 0.8]]) { c.beginPath(); c.ellipse(cx + dx * D, cy + dy, r * 1.6, r, 0.4, 0, TAU); c.fill(); }
    // the face: looking away from the Reaper's side, brows up
    const look = -D * 3, ey = cy - 12;
    for (const sd of [-1, 1]) {
      const ex = cx + sd * 8.5 + look * 0.4;
      c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, 5, 6.2, 0, 0, TAU); c.fill(); c.lineWidth = lw; c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(ex + look * 0.6, ey + 1.5, 2.4, 0, TAU); c.fill();
      c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(ex - sd * 4.5, ey - 9.5); c.lineTo(ex + sd * 3.5, ey - 11.5); c.stroke();
    }
    if (blush > 0.01) { c.save(); c.globalAlpha = 0.85 * blush; c.fillStyle = RIP_BLUSH; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(cx + sd * 13 + look * 0.3, cy - 2, 5.5, 3.2, 0, 0, TAU); c.fill(); } c.restore(); }
    c.lineWidth = lw; c.beginPath(); c.moveTo(cx - 3 + look * 0.3, cy + 4); c.quadraticCurveTo(cx + look * 0.3, cy + 2.5, cx + 3 + look * 0.3, cy + 4.5); c.stroke();   // a wobbly little mouth
    // the arms, crossed in front: two short skin-coloured sausages with an ink edge
    c.lineCap = "round";
    for (const sd of [-1, 1]) {
      const a = [cx + sd * 24, cy - 2], b = [cx - sd * 7, cy + 9];
      c.strokeStyle = INK; c.lineWidth = 7.4 + lw * 2; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx + sd * 8, cy + 13, b[0], b[1]); c.stroke();
      c.strokeStyle = RIP_SKIN; c.lineWidth = 7.4; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx + sd * 8, cy + 13, b[0], b[1]); c.stroke();
    }
    // shiver marks either side
    const sh = fe(3500, 3650, t);
    if (sh > 0) {
      c.strokeStyle = INK; c.lineWidth = lw * 0.9; c.globalAlpha = sh;
      for (const sd of [-1, 1]) for (let j = 0; j < 2; j++) { const xx = cx + sd * (33 + j * 5), w2 = Math.sin(t * 0.06 + j) * 1.5; c.beginPath(); c.moveTo(xx + w2, cy - 10); c.quadraticCurveTo(xx + sd * 3 - w2, cy - 2, xx + w2, cy + 6); c.stroke(); }
      c.globalAlpha = 1;
    }
  }
  // the ghost's head at the top of the peel: a little face, and from 4050 a flap of peel that waves
  function ripGhost(c, P, t, colr, lw) {
    const k = fe(3700, R_PEEL1, t);
    if (k <= 0) return;
    const h = P[P.length - 1], D = FIN.dir, r = 10 * easeOut(k);
    c.save(); c.globalAlpha = Math.min(1, k * 1.5);
    const wave = t >= R_WAVE ? Math.sin((t - R_WAVE) * 0.024) * 0.75 * (1 - fe(R_WAVE1 - 120, R_WAVE1, t)) : 0;
    c.lineCap = "round";
    for (const [wd, st] of [[4.6 + lw * 2, INK], [4.6, colr]]) { c.strokeStyle = st; c.lineWidth = wd; c.beginPath(); c.moveTo(h.x + D * r * 0.7, h.y + 2); c.lineTo(h.x + D * (r + 8 * Math.cos(wave - 0.9)), h.y + 2 - 8 * Math.sin(-wave + 0.9)); c.stroke(); }
    c.fillStyle = colr; c.strokeStyle = INK; c.lineWidth = lw;
    c.beginPath(); c.arc(h.x, h.y, r, Math.PI, 0); c.lineTo(h.x + r, h.y + r * 0.9); for (let i = 1; i <= 4; i++) c.lineTo(h.x + r - (i * r * 2) / 4, h.y + r * (i % 2 ? 0.55 : 0.9)); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = INK; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(h.x + sd * r * 0.36, h.y - r * 0.1, r * 0.13, r * 0.2, 0, 0, TAU); c.fill(); }
    c.beginPath(); c.ellipse(h.x, h.y + r * 0.36, r * 0.14, r * 0.18, 0, 0, TAU); c.fill();
    c.restore();
  }
  function ripDrawSplash(c, pn, t) {
    const D = FIN.dir, Lp = L_(), colr = col(Lp.pal), lw = ripLw(pn);
    pn.screen(c);
    rprTone(c, pn, [[pn.x0 - 6, pn.y0 - 6], [pn.x1 + 6, pn.y0 - 6], [pn.x1 + 6, pn.y0 + pn.h * 0.26], [pn.x0 - 6, pn.y0 + pn.h * 0.32]], 10, 0.1, [t * 0.0005, 0]);
    const q = pn.p(0, -40);
    mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.75, t * 0.0003, 0.3);
    const g = pn.p(0, 0);
    c.fillStyle = INK; c.fillRect(pn.x0 - 4, g[1] - 1, pn.w + 8, Math.max(2, pn.z * 0.8));
    rprTone(c, pn, [pn.p(-30, 0.5), pn.p(30, 0.5), pn.p(26, 6), pn.p(-26, 6)], 6, 0.45);   // his shadow
    pn.world(c);
    const x = Math.sin(t * 0.11) * 0.9 * fe(3500, 3700, t), P = ripPeel(t);
    for (const pt of P) pt.x += x;
    ripPeelRuns(c, P, false, 9, RIP_FLESH, lw);   // the inside of the peel, behind him while it is wrapped
    ripBare(c, pn, t, x, lw);
    ripPeelRuns(c, P, true, 9, colr, lw);         // his colour outside
    ripGhost(c, P, t, colr, lw);
    pn.screen(c);
    // the swing: one white crescent across the page, through him
    const up = easeOut(fe(R_SWING, R_SWING + 90, t)), a = 1 - fe(R_SWING + 200, R_SWING + 420, t);
    if (up > 0 && a > 0) {
      const A = [pn.x0 + (D > 0 ? 0.02 : 0.98) * pn.w, pn.y0 + pn.h * 0.78], C = [pn.x0 + (D > 0 ? 0.98 : 0.02) * pn.w, pn.y0 + pn.h * 0.1], B = pn.p(0, -44);
      const pts = qpts(A, [2 * B[0] - (A[0] + C[0]) / 2, 2 * B[1] - (A[1] + C[1]) / 2], C, 40);
      c.save(); c.globalAlpha = a; rprCrescent(c, pts, up, Math.min(L.gw, L.gh) * 0.03, "#ffffff", INK); c.restore();
    }
  }
  // the lid: off the top of the panel, dropped on at R_PLOP with a little bounce, a hair askew; gone at the pop
  function ripLidY(t) {
    if (t < R_LID) return null;
    if (t < R_PLOP) return lerp(-120, -24, Math.pow(fe(R_LID, R_PLOP, t), 2));
    return -24 - Math.sin(Math.PI * fe(R_PLOP, R_PLOP + 110, t)) * 4;
  }
  function ripPot(c, pn, t, x0) {
    const D = FIN.dir, lw = ripLw(pn), popped = mgPopped(t), ly = popped ? null : ripLidY(t), lidOn = ly !== null && t >= R_PLOP;
    pn.world(c);
    c.strokeStyle = INK; c.lineWidth = lw; c.lineJoin = "round"; c.lineCap = "round";
    // the back of the rim and the water
    c.fillStyle = "#d8d2c6"; c.beginPath(); c.ellipse(x0, -22, 21, 4.5, 0, Math.PI, TAU); c.fill(); c.stroke();
    if (!popped && !lidOn) {   // the bare potato sitting in it, the bay leaf beside him
      c.save(); c.translate(x0 + D * 9, -25); c.rotate(-0.5 * D);
      c.fillStyle = RIP_LEAF; c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(5, -2, 0, -12); c.quadraticCurveTo(-5, -2, 0, 6); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -9); c.lineWidth = lw * 0.6; c.stroke(); c.restore();
      c.lineWidth = lw;
      c.fillStyle = RIP_SKIN; c.beginPath(); c.ellipse(x0 - D * 3, -27, 12.5, 11.5, 0, 0, TAU); c.fill(); c.stroke();
      for (const sd of [-1, 1]) { c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(x0 - D * 3 + sd * 4.4, -30, 2.6, 3.2, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(x0 - D * 3 + sd * 4.4 - D, -30.5, 1.2, 0, TAU); c.fill(); }
      c.save(); c.globalAlpha = 0.85; c.fillStyle = RIP_BLUSH; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(x0 - D * 3 + sd * 7.5, -25.5, 2.8, 1.6, 0, 0, TAU); c.fill(); } c.restore();
    }
    // the pot's body (it hides his lower half), its handles, a band of tone on the far side
    const body = () => { c.beginPath(); c.moveTo(x0 - 20, -22); c.lineTo(x0 - 19, -4); c.quadraticCurveTo(x0 - 18, 0, x0 - 13, 0); c.lineTo(x0 + 13, 0); c.quadraticCurveTo(x0 + 18, 0, x0 + 19, -4); c.lineTo(x0 + 20, -22); c.ellipse(x0, -22, 20, 4.2, 0, 0, Math.PI); c.closePath(); };
    c.fillStyle = "#bfc4cc"; body(); c.fill(); c.stroke();
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x0 + sd * 20, -18); c.quadraticCurveTo(x0 + sd * 27, -17, x0 + sd * 26, -12); c.quadraticCurveTo(x0 + sd * 25, -9, x0 + sd * 19.5, -10); c.stroke(); }
    c.beginPath(); c.ellipse(x0, -22, 21, 4.5, 0, 0, Math.PI); c.stroke();
    pn.screen(c);
    rprTone(c, pn, [pn.p(x0 + D * 9, -21), pn.p(x0 + D * 19.5, -21), pn.p(x0 + D * 18.5, -2), pn.p(x0 + D * 9, -0.5)], 6, 0.4);
    pn.world(c);
    if (lidOn || (ly !== null && !popped)) {   // the lid (falling, then on, a hair askew), and from under it two eyes and the steam
      c.save(); c.translate(x0, ly); c.rotate(lidOn ? 0.07 * D : 0);
      c.fillStyle = "#c9ced6"; c.lineWidth = lw; c.strokeStyle = INK;
      c.beginPath(); c.ellipse(0, 0, 22, 5, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, -1.5, 18, 3.6, 0, Math.PI, TAU); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.ellipse(0, -5.5, 4, 2.4, 0, 0, TAU); c.fill();
      c.restore();
      if (lidOn) {
        const peek = fe(R_PLOP + 120, R_PLOP + 220, t), blink = Math.abs(t - 5080) < 60 ? 0.15 : 1;
        if (peek > 0) {
          c.fillStyle = INK; c.beginPath(); c.ellipse(x0 - D * 11, -21.2, 7, 1.8 * peek, 0.07 * D, 0, TAU); c.fill();
          c.fillStyle = "#ffffff"; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(x0 - D * 11 + sd * 2.8, -21.2, 1.4, 1.1 * peek * blink, 0, 0, TAU); c.fill(); }
        }
        const st = fe(R_PLOP + 80, R_PLOP + 300, t);   // three curls of steam
        if (st > 0) {
          c.save(); c.globalAlpha = st * 0.8; c.strokeStyle = INK; c.lineWidth = lw * 0.8;
          for (let i = 0; i < 3; i++) {
            const sx = x0 + (i - 1) * 11, ph = ((t - R_PLOP) * 0.02 + i * 7) % 26;
            c.beginPath(); for (let j = 0; j <= 10; j++) { const yy = -32 - ph - j * 2.2, xx = sx + Math.sin(j * 0.8 + t * 0.006 + i) * 2.6; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
          }
          c.restore();
        }
      }
    }
    pn.screen(c);
  }
  function ripDrawAfter(c, pn, t) {
    const W = W_();
    pn.screen(c);
    rprSky(c, pn, t, 0.4);
    rprGround(c, pn, t);
    mgPuppet(c, pn, W, t, { light: dirAng(-0.55), box: BOX });   // in his own colours: the lights are on
    ripPot(c, pn, t, potX(t));
  }

  S_.alt = Object.assign({}, S_, {
    name: "Rest in Peel",
    start(g) { S_.start(g); pota = true; FIN.cue.stone = FIN.cue.toll2 = FIN.cue.whisper = true; },   // (Last Rites' stone, second bell and whisper belong to its own panel 4)
    end() { pota = false; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = ripDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 120 : 100) * (1 - 0.05 * fe(MT.AFTER, MT.END, t)); return { wx: wX(t) + FIN.dir * (lay.port ? 58 : 44), wy: -0.43 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: PAPER, slide: MG.reduced ? 1 : 180, cam: ripCam, draw: ripDrawSplash }));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay).filter((w) => w.text !== "shhh..."), D = FIN.dir;
      Object.assign(ws.find((w) => w.text === "SHHK"), { t1: MT.SPLASH + 150 });   // gone as the lights come on
      ws.push(
        { text: "shhhhhk", t0: R_SWING + 40, t1: 3900, size: 0.15, arc: 8, jit: 0.1, rot: -0.32 * D, stretch: { ang: D > 0 ? -0.4 : Math.PI + 0.4, k: 0.25 },
          at: () => [L.gw * (D > 0 ? 0.64 : 0.36), L.gh * 0.26] },
        { text: "bye~", t0: R_WAVE + 40, t1: 4650, size: 0.07, jit: 0.12, rot: 0.1 * D,
          at: () => { const pn = MG.byId.splash, P = ripPeel(R_WAVE + 200), h = P[P.length - 1]; mgPlace(pn, R_WAVE + 200); const q = pn.sp(h.x + D * 26, h.y - 10); return [q[0], q[1]]; } },
        { text: "plop", t0: R_PLOP, t1: 5200, size: 0.07, jit: 0.12, rot: -0.08 * D,
          at: () => { const pn = MG.byId.after; mgPlace(pn, R_PLOP); const q = pn.sp(potX(R_PLOP) - D * 6, -44); return [q[0], q[1]]; } },
      );
      return ws;
    },
    // the night stays on what the splash hasn't covered yet; once it is in, the lights are on
    page(c, t) {
      const sp = MG.byId.splash;
      if (!sp || t < MT.SPLASH) { S_.page(c, t); return; }
      if (t >= sp.t0 + sp.slide) return;
      mgPlace(sp, t);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(0, 0, MG.cw, Math.max(0, (sp.y0 + sp.oy) * DPR)); c.clip(); S_.page(c, t); c.restore();
    },
    hint(t) { return t >= MT.SPLASH + 180 ? "rgba(30,28,40,0.55)" : S_.hint(t); },
    food() { const x = potX(MT.POP); return { x, y: 0, r: 22, y0: -24, lx: x + FIN.dir * 40 }; },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("ripSwing", R_SWING, () => Cin.go(() => { Cin.whoosh(0.3, -0.5 * D, 0.5 * D, 0.32); Cin._noise(0.2, 0.25, 3000, 8000, "highpass", 0.8); }));
      cueOnce("ripPeel", R_PEEL0, () => Cin.go(() => { Cin._noise(0.6, 0.06, 600, 2600, "bandpass", 2); Cin._osc("sine", 300, 900, 0.6, 0.03, 0.3); }));
      cueOnce("ripShiver", 3560, () => Cin.go(() => { for (let i = 0; i < 6; i++) Cin._osc("triangle", 900 + i * 40, 880, 0.05, 0.02, 0.002, i * 0.07); }));
      cueOnce("ripGhost", 3900, () => Cin.go(() => { Cin._osc("sine", 520, 440, 0.5, 0.04, 0.08); Cin._osc("sine", 780, 660, 0.45, 0.02, 0.08, 0.05); }));
      cueOnce("ripBye", R_WAVE + 40, () => Cin.go(() => Cin.chime(2093)));
      cueOnce("ripLid", R_PLOP, () => Cin.go(() => { Cin.clack(); Cin._osc("sine", 520, 260, 0.12, 0.08, 0.003); }));
      cueOnce("ripSteam", R_PLOP + 120, () => Cin.go(() => Cin._noise(0.9, 0.04, 3000, 5000, "highpass", 0.8)));
    },
  });
  return S_;
})();
