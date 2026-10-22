/* ===================== Manga page: Samurai, "One Cut" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Samurai, One Cut"). Times are ms after the final hit.
   The pure black-and-white page: paper, ink and dots, the puppets turned grey in code (no CSS filter: the engine draws its words, card and K.O. seal
   on the same canvas as the page, so a filter would grey them too); the only colour is jade: the blade's edge, the sash, SHING, the cut.
   300 the freeze (panel 1, engine): colour drains into the inked page . 900 petals . 1250 panel 2: his eyes, 500 ms of nothing, the flute
   2000 inset: the loser's eye, a sweat drop . 2350 panel 3: both small on paper, the stance . 2560 one frame: he stands behind the loser, blade out,
   a white line at hip height . 2600 the brush stroke . 2780 silence . 2900 SHING, the page holds 100 ms (no impact frames: S.noImpact)
   3000 the loser comes apart along the cut, both halves launched along the real direction . 3500 panel 4: he sheathes (click), turns away,
   the colour floods back from the blade (a growing circle), the petals turn pink.
   Script fields: col, name, hit, pop, flight, noImpact, panels(lay), words(lay), build(lay), start(g), step(t, k), pose(P, sk, t, role, p), after(t), over(o, t),
   cues(t), drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt().
   ULTIMATE: "Hundred Petals" = MANGA.samurai.ulti (S_.ulti, below the script; design: ultimates/fable-ultimate-pages.md section 1), played when the KO hit is his Ultimate
   (Thousand Cuts), on the long timeline MT_U (see manga.js). The same page to 2350; 2560 the dash through, three ghosts along the path; 2600-2780 nothing moves, the loser
   trembles; 2880 the hand starts the sheath; 2900 the click is the cut: three impact frames (black, white, gold: the gold one shows the hairline across the loser); 3000,
   3080, 3160 three page-wide brush strokes through the hit point (ink with a white hairline core, SHK) while the loser comes apart (3050) and flies out; 3250 the SPLASH:
   the page so far is cut by the three lines into seven slabs that part and fall away, under them pale gold paper, a hundred pink petals bursting from the sheath and
   him full page in colour, sheathed, half turned; 3700 HUNDRED PETALS; 4700 the aftermath panel as in One Cut (shifted by 1200 ms: its moments are MT.AFTER + offset).
   Both pages share their code: `ult` says which one is playing and setTimes() moves the few moments that differ.
   POTATALITY: "Hasselback" = MANGA.samurai.alt (S_.alt, at the end; its helpers are prefixed hb; `pota` says it is playing), played on a normal KO when it is on
   (ui/kopages.js).
   POTATALITY 2: "Snake Eyes" = MANGA.samurai.alt2 (S_.alt2, after it; its helpers are prefixed snk; `pota2` says it is playing), played when it is the one picked. */
MANGA.samurai = (function () {
  const COL = "#3fe0a8", EDGE = "#effff8", PINK = "#ffbdd3", PINK_D = "#b84a73", PAPER_G = "#dedad3";
  const TILT = 0.15;
  // the moments that differ between One Cut and Hundred Petals (setTimes, called by start): the post-aftermath ones are MT.AFTER + offset, so panel 4 serves both
  let HIT = 2900, POP = 3000, CUT_T = 2560, STROKE_T = 2600, SHEATH0 = 3560, CLICK = 3780, FLOOD = 3780, TURN = 3850, ult = false;
  function setTimes(u) {
    ult = u; HIT = 2900; CUT_T = 2560;
    if (u) { POP = 3050; STROKE_T = 3000; SHEATH0 = 2880; CLICK = 2900; FLOOD = MT.SPLASH; TURN = MT.AFTER + 350; }   // sheathed at the cut; the colour floods the page at the splash
    else { POP = 3000; STROKE_T = 2600; SHEATH0 = MT.AFTER + 60; CLICK = MT.AFTER + 280; FLOOD = MT.AFTER + 280; TURN = MT.AFTER + 350; }
  }
  const far = () => (L.portrait ? 92 : 140);   // how far past the loser he stands
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  let petals = [], snapC = null, half = null, flick = 0, floodAt = null;
  let pota = false;   // pota: this play is the Potatality, Hasselback (set by its start): the cut is not seen at the hit, he never comes apart, the relief before SHING
  let pota2 = false;   // pota2: this play is the second Potatality, Snake Eyes (set by its start): he never comes apart, the blade flicks him up into the splash
  const scratch = new WeakMap();   // the grey pass's scratch canvas lives and dies with the page's layer canvas (freed by the engine at the end of the page)
  const D_ = () => FIN.dir;
  const wx_ = (t) => (t >= CUT_T ? FIN.lx + FIN.dir * far() : FIN.wx);   // where he stands: before the cut, and one frame later behind the loser
  // facing as a squash: 1 -> -1 (he turns away); on the Ultimate page he is half turned in the splash, the rest of the way at the aftermath
  const faceK = (t) => { const k = ult ? 0.3 * ease(fe(MT.SPLASH + 100, MT.SPLASH + 800, t)) + 0.7 * ease(fe(TURN, TURN + 260, t)) : fe(TURN, TURN + 220, t), c = Math.cos(Math.PI * k); return Math.abs(c) < 0.04 ? (k < 0.5 ? 0.04 : -0.04) : c; };

  /* ---- grey: the puppets are drawn as always, then turned grey where they are opaque (a copy of the layer, the saturation blend with black = grey of the same luminance,
          drawn back with source-atop so the silhouette stays); the picture of the real hit gets the same treatment once, with more contrast ---- */
  function greyOf(src, hard) {
    const W = src.width, H = src.height, a = mgCanvas(W, H), x = a.getContext("2d");
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = "saturation"; x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
    if (hard) { const b = mgCanvas(W, H), bx = b.getContext("2d"); for (let i = 0; i < hard; i++) { bx.globalCompositeOperation = "copy"; bx.drawImage(a, 0, 0); x.globalCompositeOperation = "overlay"; x.drawImage(b, 0, 0); } }
    x.globalCompositeOperation = "source-over";
    return a;
  }
  // post hook for mgPuppet (lc: the layer, source-atop is on, device px). rad: half the width of the box to turn grey, in world units
  function greyPost(lc, X, rad) {
    rad = rad || 120;
    const x0 = Math.max(0, Math.floor(X.sx - rad * X.z)), x1 = Math.min(MG.cw, Math.ceil(X.sx + rad * X.z)), y0 = Math.max(0, Math.floor(X.sy - rad * 1.0 * X.z)), y1 = Math.min(MG.ch, Math.ceil(X.sy + rad * 0.35 * X.z));
    const w = x1 - x0, h = y1 - y0;
    if (w < 2 || h < 2) return;
    let sc = scratch.get(MG.layer);
    if (!sc) { sc = { cv: mgCanvas(w, h) }; sc.x = sc.cv.getContext("2d"); scratch.set(MG.layer, sc); } else if (sc.cv.width < w || sc.cv.height < h) { sc.cv.width = Math.max(sc.cv.width, w); sc.cv.height = Math.max(sc.cv.height, h); sc.x = sc.cv.getContext("2d"); }
    const tmp = sc.cv, tx = sc.x;
    tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = "source-over"; tx.clearRect(0, 0, w, h);
    tx.drawImage(MG.layer, x0, y0, w, h, 0, 0, w, h);
    tx.globalCompositeOperation = "saturation"; tx.fillStyle = "#000"; tx.fillRect(0, 0, w, h);
    tx.globalCompositeOperation = "source-over";
    lc.drawImage(tmp, 0, 0, w, h, x0, y0, w, h);
  }
  const grey = (rad) => (lc, X) => greyPost(lc, X, rad);

  // where things are on a puppet (world units), from its own pose
  function bodyPt(p, t, key, dx, dy) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot([P[key][0] + (dx || 0), P[key][1] + (dy || 0)], P.hip, P.lean);
    return [p.x + p.facing * q[0], p.y + q[1]];
  }
  const samTone = (c, pn, poly, size, cover, drift) => mgToneFill(c, poly.map(([x, y]) => [x + pn.ox, y + pn.oy]), size, cover, drift);
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const frontLight = () => dirAng(-0.75);                    // from above and in front of him (so his face is lit)
  const loserLight = () => Math.PI - dirAng(-0.75);        // ... and in front of the loser, who faces the other way
  const topLight = () => dirAng(-1.35);                      // the wide shots: nearly from above

  /* ---- the cut: one slanted line through the loser at hip height, rising towards the launch side ---- */
  const cutH = () => L_().s.h * 0.4;
  const cutU = () => [FIN.dir * Math.cos(TILT), -Math.sin(TILT)];            // along the cut (world, unit)
  const cutN = () => { const u = cutU(); let n = [u[1], -u[0]]; if (n[1] > 0) n = [-n[0], -n[1]]; return n; };   // up from the cut
  const loserBase = (t) => { if (t < FIN.launch) return [FIN.lx, 0]; const tr = finTrav((t - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr]; };
  // the state of one half (k = 1 the top, -1 the bottom) fl frames after the cut opens: its own rotation, its own offset
  function halfAt(k, fl) {
    const D = FIN.dir, n = cutN(), u = cutU(), sep = Math.min(fl, 2) * 3.5 + Math.max(0, fl - 2) * 1.05, slide = k > 0 ? 6 * easeOut(Math.min(1, fl / 6)) : 0;
    const th = k > 0 ? -D * (0.2 * fl + 0.12 * easeOut(Math.min(1, fl / 4))) : D * 0.13 * fl;
    return { k, th, ox: n[0] * sep * 0.5 * k + u[0] * slide, oy: n[1] * sep * 0.5 * k + u[1] * slide };
  }
  // the cut line of a half in world space: a point on it, its direction, the normal that points to the half's own side
  function halfLine(Lp, B, hs) {
    const cs = Math.cos(hs.th), sn = Math.sin(hs.th), R = (v) => [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs], cx = B[0] + hs.ox, cy = B[1] + hs.oy - Lp.s.h * 0.5;
    const off = R([0, Lp.s.h * 0.5 - cutH()]), u = R(cutU()), n = R(cutN());
    return { x: cx + off[0], y: cy + off[1], u, n: [n[0] * hs.k, n[1] * hs.k] };
  }

  /* ---- panels ---- */
  function panels(lay) {
    const port = lay.port, D = FIN.dir;
    return [
      { id: "look", t0: MT.LOOK, from: "w", freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0.1], [1, 0.07], [1, 0.27], [0, 0.3]] : [[0, 0.17], [1, 0.14], [1, 0.5], [0, 0.53]],
        cam: (t, pn) => {
          const h = bodyPt(W_(), Math.min(t, MT.STRIKE), "head"), vh = (port ? 21 : 18.5) * (1 - 0.06 * fe(MT.LOOK, MT.STRIKE, t));
          // the face stands left of the middle (towards his own side), the gaze has room in front of it
          return { wx: h[0] + D * (port ? 4 : 0.2 * pn.w / (pn.h / vh)), wy: h[1] + 0.8, vh };
        },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "l", slide: 140, freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0.34, 0.25], [0.98, 0.22], [0.96, 0.43], [0.32, 0.46]] : [[0.6, 0.05], [0.97, 0.02], [0.95, 0.44], [0.58, 0.47]],
        cam: (t) => { const h = bodyPt(L_(), Math.min(t, MT.STRIKE), "head"); return { wx: h[0], wy: h[1] + 0.8, vh: (port ? 19 : 21) - 2 * fe(MT.INSET, MT.STRIKE, t) }; },
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "l", freeze: ult ? MT.SPLASH : MT.AFTER, cover: ult ? MT.SPLASH : MT.AFTER,
        poly: port ? [[0, 0.44], [1, 0.41], [1, 0.74], [0, 0.77]] : [[0, 0.5], [1, 0.47], [1, 1], [0, 1]],
        cam: (t) => { const k = fe(MT.STRIKE, HIT, t), vh = (port ? 262 : 120) * (1 - 0.06 * k); return { wx: FIN.wx + D * (port ? 108 : 126), wy: -0.27 * vh, vh }; },
        draw: drawStrike },
      ...(ult ? [mgSplashPanel({ from: "t", paper: MG_GOLD_PALE, before: grabSlabs, draw: drawSplash,
        cam: (t, pn) => {   // him full page: tall on the page, a little left of the middle (to the right of the middle when the winner is on the right); a 6% pull-out
          const vh = (port ? 150 : 116) * (1 - 0.06 * fe(MT.SPLASH, MT.AFTER, t)), z = pn.h / vh;   // (116, not 100: the name needs room above his sprout)
          return { wx: wx_(t) + D * (port ? 0 : 0.13) * pn.w / z, wy: port ? -0.36 * vh : -0.44 * vh, vh };
        } })] : []),
      { id: "after", t0: MT.AFTER, from: "b", live: true,
        poly: port ? [[0, 0.62], [1, 0.6], [1, 1], [0, 1]] : [[0, 0.4], [0.62, 0.37], [0.58, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 120 : 112) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: wx_(t) - FIN.dir * 4, wy: -0.4 * vh, vh }; },
        draw: drawAfter },
    ];
  }

  /* ---- the frozen real hit: the colour drains into the inked, greyscale page (300 ms) ---- */
  function drawHit(c, pn, t) {
    const dr = fe(MT.FREEZE, MT.FREEZE + 300, t), life = easeOut(fe(MT.FREEZE, MT.END, t)), s = 1 + 0.07 * life, ix = MG.ix, iy = MG.iy;
    c.save(); c.translate(ix, iy); c.scale(s, s); c.translate(-ix, -iy);
    if (dr < 1 && snapC) c.drawImage(snapC, 0, 0, L.gw, L.gh);
    c.globalAlpha = dr; c.drawImage(MG.ink, 0, 0, L.gw, L.gh); c.globalAlpha = 1;
    c.restore();
    const R = Math.hypot(Math.max(ix, L.gw - ix), Math.max(iy, L.gh - iy));
    mgFocus(c, ix, iy, R, t * 0.00035, 0.9 * dr);
    // inked harder than the other pages: the corners close in with a 70% screen
    const k = dr * 0.3, a = L.gw * k, b = L.gh * k * 1.4;
    mgToneFill(c, [[0, 0], [a, 0], [0, b]], 6, 0.7); mgToneFill(c, [[L.gw, L.gh], [L.gw - a, L.gh], [L.gw, L.gh - b]], 6, 0.7);
  }

  /* ---- jade: the sash and the blade's edge, drawn over the grey puppet (the only colour on the page) ---- */
  function jade(c, pn, p, t, a) {
    if (a <= 0.01) return;
    MG.pt = t;
    const P = pose(p, mgTk(t));
    c.save(); pn.world(c); c.translate(p.x, p.y); c.scale(p.facing, 1); c.globalAlpha = a;
    // sash and band: the red bands of the costume, again in jade
    c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    potatoPath(c, P); c.clip();
    c.fillStyle = COL;
    c.fillRect(-P.rx * 1.3, P.cy - P.ry * 0.66, P.rx * 2.6, P.ry * 0.2);
    c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.6, P.rx * 2.6, 3); c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.8, P.rx * 2.6, 3);
    c.restore();
    c.beginPath(); c.ellipse(-P.rx * 0.98, P.cy - P.ry * 0.56, 2.8, 2.6, 0, 0, Math.PI * 2); c.ellipse(-P.rx * 1.12, P.cy - P.ry * 0.42, 1.7, 4.8, 0.7, 0, Math.PI * 2); c.fill();
    // the edge of the blade: the lower curve of the blade, a jade line with a pale core
    const ang = P.holdAng != null ? P.holdAng : -0.8, Ll = P.w * 1.35, sh = P.sheath, Lb = sh > 0 ? 4 + (Ll - 4) * (1 - sh) : Ll;
    if (Lb > 9) {
      c.translate(P.hF[0], P.hF[1]); c.rotate(ang); c.lineCap = "round";
      c.beginPath(); c.moveTo(Lb, -5.5); c.quadraticCurveTo(Lb * 0.55, 0.9, 4, 2.1);
      c.strokeStyle = COL; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = EDGE; c.lineWidth = 0.9; c.stroke();
    }
    c.restore();
  }
  const bladeTip = (p, t) => {   // the tip of the blade (or the hand when it is sheathed), world
    MG.pt = t; const P = pose(p, mgTk(t)), ang = P.holdAng != null ? P.holdAng : -0.8, Ll = P.w * 1.35 * (P.sheath > 0 ? 1 - 0.7 * P.sheath : 1), q = rot([P.hF[0] + Math.cos(ang) * Ll, P.hF[1] + Math.sin(ang) * Ll], P.hip, 0);
    return [p.x + FIN.dir * q[0], p.y + q[1]];
  };

  /* ---- the sakura petals: page-wide, drifting sideways (in the direction of the wind, towards the loser); grey until the colour floods back ---- */
  const pClock = (t) => t - Math.min(ult ? 150 : 100, Math.max(0, t - HIT));   // the page holds for 100 ms at SHING (150 on the Ultimate: three impact frames)
  function petalShape(o, r) { o.beginPath(); o.moveTo(-r, 0); o.bezierCurveTo(-r * 0.5, -r * 0.95, r * 0.75, -r * 0.8, r, -r * 0.12); o.lineTo(r * 0.78, 0.02 * r); o.lineTo(r, r * 0.16); o.bezierCurveTo(r * 0.75, r * 0.8, -r * 0.5, r * 0.95, -r, 0); o.closePath(); }
  function drawPetal(o, x, y, r, rot, fl, pink) {
    o.save(); o.translate(x, y); o.rotate(rot); o.scale(1, fl); petalShape(o, r);
    o.fillStyle = pink ? PINK : PAPER_G; o.fill(); o.lineWidth = 1.3; o.strokeStyle = pink ? PINK_D : MG_INK; o.stroke(); o.restore();
  }
  function petalsOver(o, t) {
    if (t < 900 || t > MT.FADE + 100) return;
    const D = FIN.dir, u = (pClock(t) - 900) / 1000, a = fe(900, 1200, t), fl = flood(t), gw = L.gw + 60, gh = L.gh + 60;
    o.save(); o.globalAlpha = a;
    for (const p of petals) {
      const x = (((p.x + D * p.vx * u) % gw) + gw) % gw - 30, y = (((p.y + p.vy * u + Math.sin(u * p.f + p.ph) * p.a * 12) % gh) + gh) % gh - 30;
      const pink = fl.r > 0 && Math.hypot(x - fl.x, y - fl.y) < fl.r;
      drawPetal(o, x, y, p.s, p.ph + u * p.sp * 2, 0.35 + 0.65 * Math.abs(Math.cos(u * p.f * 1.7 + p.ph)), pink);
    }
    o.restore();
  }

  /* ---- panel 2: his eyes ---- */
  function drawLook(c, pn, t) {
    const W = W_(), D = FIN.dir, nar = ease(fe(1990, 2350, t)), R = Math.hypot(pn.w, pn.h);
    pn.screen(c);
    const hp = bodyPt(W, t, "head"), [fx, fy] = pn.p(hp[0], hp[1]);
    mgFocus(c, fx, fy, R, t * 0.00012, 0.6);
    // the strip is screened at the edges: a 70% band under the top border, a 40% band over the bottom one; they drift one pixel a second
    const sl = pn.poly;
    samTone(c, pn, [[pn.x0 - 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 + pn.h * 0.11], [pn.x0 - 4, pn.y0 + pn.h * 0.15]], 6, 0.7, [t * 0.001, 0]);
    samTone(c, pn, [[pn.x0 - 4, pn.y1 + 4], [pn.x1 + 4, pn.y1 + 4], [pn.x1 + 4, pn.y1 - pn.h * 0.12], [pn.x0 - 4, pn.y1 - pn.h * 0.16]], 8, 0.4, [-t * 0.001, 0]);
    mgPuppet(c, pn, W, t, { sc: 1, light: frontLight(), post: grey(120) });
    pn.screen(c);
    // the eyes narrow: two ink lids come down over the upper half of each eye
    if (nar > 0.01) {
      MG.pt = t;
      const P = pose(W, mgTk(t)), er = P.w * 0.1, z = pn.z;
      for (const [dx, side] of [[-P.w * 0.14, -1], [P.w * 0.13, 1]]) {
        const q = rot([P.head[0] + dx, P.head[1]], P.hip, P.lean), [ex, ey] = pn.p(W.x + W.facing * q[0], W.y + q[1]), F = Math.sign(W.facing) || 1, inn = side < 0 ? F : -F, e = er * z;
        c.save(); c.beginPath(); c.ellipse(ex, ey, e * 1.12, e * 1.02, 0, 0, Math.PI * 2); c.clip();
        const y0 = ey - e * 0.4 + e * 0.62 * nar, sl_ = e * 0.28;
        c.fillStyle = MG_INK; c.beginPath(); c.moveTo(ex - e * 1.4, ey - e * 1.6); c.lineTo(ex + e * 1.4, ey - e * 1.6); c.lineTo(ex + e * 1.4, y0 + inn * sl_); c.lineTo(ex - e * 1.4, y0 - inn * sl_); c.closePath(); c.fill();
        c.restore();
      }
    }
    // the guard of the blade: a line of jade along the bottom edge, drawn from his side
    const a = sl[3], b = sl[2], k = easeOut(fe(MT.LOOK + 20, MT.LOOK + 360, t)), up = pn.h * 0.1;
    if (k > 0) {
      const x1 = a[0] + (b[0] - a[0]) * 0.86 * k, y1 = a[1] + (b[1] - a[1]) * 0.86 * k - up;
      c.lineCap = "butt"; c.beginPath(); c.moveTo(a[0], a[1] - up); c.lineTo(x1, y1);
      c.strokeStyle = MG_INK; c.lineWidth = Math.max(5, pn.h * 0.065); c.stroke();
      c.strokeStyle = COL; c.lineWidth = Math.max(2.4, pn.h * 0.028); c.stroke();
      const g = fe(2230, 2350, t) * (1 - 0.3 * fe(2350, MT.STRIKE, t));
      if (g > 0) { const s = (6 + 14 * g) * Math.max(1, pn.h / 120), gx = a[0] + (b[0] - a[0]) * 0.5, gy = a[1] + (b[1] - a[1]) * 0.5 - up; star(c, gx, gy, s, EDGE); }
    }
    // a faint breath: the ink of the top band stays; nothing else moves between 1500 and 2000 but the petals (page overlay) and a drift of 0.3 px
  }
  // a four-point glint with an ink edge
  function star(c, x, y, s, fill) {
    c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.2, y - s * 0.2); c.lineTo(x + s, y); c.lineTo(x + s * 0.2, y + s * 0.2); c.lineTo(x, y + s); c.lineTo(x - s * 0.2, y + s * 0.2); c.lineTo(x - s, y); c.lineTo(x - s * 0.2, y - s * 0.2); c.closePath();
    c.fillStyle = fill; c.fill(); c.lineWidth = 1.6; c.strokeStyle = MG_INK; c.stroke();
  }

  /* ---- the inset: the loser's eye, a sweat drop slides down the temple ---- */
  function drawInset(c, pn, t) {
    const Lp = L_(), D = FIN.dir, u = fe(MT.INSET, MT.STRIKE, t), tt = Math.min(t, MT.STRIKE);
    pn.screen(c);
    const hp = bodyPt(Lp, tt, "head"), [fx, fy] = pn.p(hp[0], hp[1]);
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0005, 0.9);
    const d = pn.w * 0.4 * u;
    samTone(c, pn, [[pn.x1 + 4, pn.y0 - 4], [pn.x1 - d - pn.w * 0.1, pn.y0 - 4], [pn.x1 + 4, pn.y0 + d + pn.h * 0.1]], 6, 0.7);
    mgPuppet(c, pn, Lp, tt, { sc: 1, light: loserLight(), post: grey(120) });
    pn.screen(c);
    // the sweat drop: from the temple, sliding down; a few ticks beside it
    const z = pn.z, k = ease(fe(2030, 2350, t)), sx = fx + D * 7 * z, sy = fy - 5 * z + k * 9 * z, r = 1.5 * z;
    if (k > 0 && sy < pn.y1) {
      c.save(); c.translate(sx, sy); c.beginPath(); c.moveTo(0, -r * 1.9); c.bezierCurveTo(r * 1.25, -r * 0.2, r * 1.1, r * 1.1, 0, r * 1.15); c.bezierCurveTo(-r * 1.1, r * 1.1, -r * 1.25, -r * 0.2, 0, -r * 1.9); c.closePath();
      c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = Math.max(2.5, r * 0.34); c.strokeStyle = MG_INK; c.lineJoin = "round"; c.stroke();
      c.beginPath(); c.arc(-r * 0.32, r * 0.2, r * 0.26, 0, Math.PI * 2); c.fillStyle = MG_INK; c.fill();
      c.lineWidth = Math.max(2, r * 0.22); c.beginPath(); for (const o of [-1, 1]) { c.moveTo(o * r * 1.9, -r * 0.6 - k * r); c.lineTo(o * r * 2.5, -r * 1.3 - k * r); } c.stroke();
      c.restore();
    }
  }

  /* ---- panel 3: the strike. Both small on paper; he stands in his stance; one frame; the brush stroke; SHING; the cut ---- */
  function ground(c, pn) {
    pn.world(c);
    const D = FIN.dir, x0 = FIN.wx - 420, x1 = FIN.wx + 420;
    c.fillStyle = MG_INK; c.beginPath(); c.moveTo(x0, -1.2);
    for (let x = x0; x <= x1; x += 21) c.lineTo(x, -1.4 + ((x * 7919) % 9) / 9 * 1.4);
    c.lineTo(x1, 2.4); c.lineTo(x0, 2.4); c.closePath(); c.fill();
    c.lineCap = "round"; c.strokeStyle = MG_INK;
    for (let i = 0; i < 26; i++) {   // dry-brush hatching under the line
      const r = mgRng(40 + i), x = FIN.wx - 330 + r() * 700, y = 5 + (i % 6) * 5.5 + r() * 2, len = 30 + r() * 110;
      c.lineWidth = 1.1 + r() * 1.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + (r() - 0.5) * 1.2); c.stroke();
    }
    // a few blades of grass at his feet and the loser's
    c.lineWidth = 1.5;
    for (const gx of [FIN.wx - D * 30, FIN.wx + D * 40, FIN.lx - D * 46, FIN.lx + D * 46, FIN.lx + D * 150]) for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(gx + j * 3.2, -0.5); c.quadraticCurveTo(gx + j * 3.2 + (j - 1.5) * 1.1, -7, gx + j * 3.2 + (j - 1.5) * 2.4 + Math.sin(0.002 * flick + j) * 0.8, -9 - (j % 2) * 3); c.stroke(); }
  }
  // the brush stroke of the cut: through the loser's hip, rising towards the launch side, a dry tail behind
  function cutStroke(c, pn, t) {
    if (ult) return;   // (the Ultimate's strokes are the three page-wide ones, strokesOver)
    const k = easeOut(fe(STROKE_T, STROKE_T + 130, t));
    if (k <= 0) return;
    const D = FIN.dir, h = cutH(), pts = [], n = 22, x0 = FIN.wx - D * 30, x1 = FIN.lx + D * 330;
    const y = (x) => -h - (x - FIN.lx) * D * Math.tan(TILT);
    pn.world(c);
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * (i / n); pts.push([x, y(x)]); }
    c.fillStyle = MG_INK; brush(c, pts, 17 * (0.55 + 0.45 * k), Math.max(1, Math.round(n * k)));
    // flecks of dry ink along the stroke
    if (k > 0.3) for (let i = 0; i < 9; i++) { const r = mgRng(300 + i), q = r(), x = x0 + (x1 - x0) * q, yy = y(x) + (r() - 0.5) * 22; c.beginPath(); c.arc(x, yy, 0.9 + r() * 2, 0, Math.PI * 2); c.fill(); }
  }
  function drawStrike(c, pn, t) {
    const W = W_(), Lp = L_(), D = FIN.dir;
    flick = t;
    pn.screen(c);
    // a band of mist (a 25% screen) over the ground, cut hard
    const gy = pn.p(FIN.wx, 0)[1];
    samTone(c, pn, [[pn.x0 - 4, gy - pn.h * 0.2], [pn.x1 + 4, gy - pn.h * 0.24], [pn.x1 + 4, gy], [pn.x0 - 4, gy]], 7, 0.22, [t * 0.0007, 0]);
    ground(c, pn);
    cutStroke(c, pn, t);
    // him: the stance, then (one frame) behind the loser with the blade out
    // (Ultimate: after the dash three ghosts of him trail along the path, 30 units apart, and fade out before the silence)
    const gh = ult && t >= CUT_T && t < CUT_T + 260 ? 1 - fe(CUT_T + 140, CUT_T + 220, t) : 0;
    mgPuppet(c, pn, W, t, { sc: 1, light: topLight(), post: grey(120), ghosts: gh > 0.01 ? [[-D * 30 * pn.z, 0, 0.5 * gh], [-D * 60 * pn.z, 0, 0.3 * gh], [-D * 90 * pn.z, 0, 0.15 * gh]] : undefined });
    jade(c, pn, W, t, 1);
    pn.screen(c);
    if (!MG.broke) S_.drawLoser(c, pn, t);
    // the white line at hip height: one frame (two on a slow screen), no smear
    if (!ult && t >= CUT_T && t < CUT_T + 40) {
      const a = 1 - fe(CUT_T + 8, CUT_T + 40, t), x0 = FIN.wx + D * 10, x1 = FIN.lx + D * (far() + 20), y = -cutH();
      pn.world(c); c.lineCap = "round"; c.globalAlpha = a;
      c.strokeStyle = MG_INK; c.lineWidth = 5.2; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      c.strokeStyle = "#ffffff"; c.lineWidth = 2.4; c.stroke(); c.globalAlpha = 1;
    }
  }

  /* ---- the loser: stands with terror in his eyes, is cut, comes apart along the cut, the halves fly along the real launch direction ---- */
  function drawHalfEdge(c, pn, ln, len) {
    const a = pn.sp(ln.x - ln.u[0] * len, ln.y - ln.u[1] * len), b = pn.sp(ln.x + ln.u[0] * len, ln.y + ln.u[1] * len);
    c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.lineCap = "round"; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
    c.strokeStyle = MG_INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = COL; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = EDGE; c.lineWidth = 0.9; c.stroke(); c.restore();
  }
  function drawLoserFn(c, pn, t) {
    const Lp = L_(), D = FIN.dir;
    if (FIN.out || Lp.state === "gone") return;
    if (t < POP) {
      // (Ultimate: after the dash he stands whole, eyes wide, and trembles 2 px)
      const ox_ = Lp.x, shake = ult && t >= CUT_T ? (Math.floor(t / FMS) % 2 ? 1 : -1) / pn.z : 0;
      Lp.x += shake;
      mgPuppet(c, pn, Lp, t, { sc: 1, light: topLight(), post: grey(120) });
      Lp.x = ox_;
      // the hairline of light opens across him, from the side the blade came from (on the Ultimate it is in the gold impact frame instead)
      if (!ult && !pota && t >= HIT) {
        const k = easeOut(fe(HIT, HIT + 80, t)), u = cutU(), cx = Lp.x, cy = Lp.y - cutH(), len = Lp.s.w * 0.62;
        const a = pn.sp(cx - u[0] * len, cy - u[1] * len), b = pn.sp(cx - u[0] * len + u[0] * 2 * len * k, cy - u[1] * len + u[1] * 2 * len * k);
        c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.lineCap = "round"; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
        c.strokeStyle = MG_INK; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = COL; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = EDGE; c.lineWidth = 0.8; c.stroke(); c.restore();
      }
      return;
    }
    const fl = (t - POP) / FMS, B = loserBase(t), BIG = 900;
    for (const k of [-1, 1]) {   // the bottom first, then the top over it
      const hs = halfAt(k, fl), ln = halfLine(Lp, B, hs), cs = pn.sp(ln.x, ln.y), nx = ln.n[0], ny = ln.n[1], ux = ln.u[0], uy = ln.u[1];
      const ox = Lp.x, oy = Lp.y;
      Lp.x = B[0] + hs.ox; Lp.y = B[1] + hs.oy; half = { th: hs.th };
      c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.beginPath(); c.moveTo(cs[0] - ux * BIG, cs[1] - uy * BIG); c.lineTo(cs[0] + ux * BIG, cs[1] + uy * BIG); c.lineTo(cs[0] + ux * BIG + nx * BIG, cs[1] + uy * BIG + ny * BIG); c.lineTo(cs[0] - ux * BIG + nx * BIG, cs[1] - uy * BIG + ny * BIG); c.closePath(); c.clip();
      mgPuppet(c, pn, Lp, t, { sc: 1, light: topLight(), post: grey(120) });
      c.restore();
      Lp.x = ox; Lp.y = oy; half = null;
      drawHalfEdge(c, pn, ln, Lp.s.w * 0.55);
    }
  }
  // the loser's trail: petals spun off the halves, and parallel speed lines along the real launch direction
  function trailOver(o, t) {
    if (t <= POP || t > POP + 460) return;
    const pn = MG.byId.strike, a = 1 - fe(POP + 220, POP + 460, t), ang = Math.atan2(FIN.ldy, FIN.ldx);
    for (let j = 0; j < 12; j++) {
      const age = 24 + j * 30, tt = t - age;
      if (tt < POP) continue;
      const B = loserBase(tt), r = mgRng(500 + j), q = pn.sp(B[0] + (r() - 0.5) * 40, B[1] - L_().s.h * 0.5 + (r() - 0.5) * 40 + age * 0.01 * 9);
      const f = 1 - age / 420; if (f <= 0) continue;
      o.save(); o.globalAlpha = f; drawPetal(o, q[0], q[1] + age * 0.02, 4 + r() * 3, r() * 6 + t * 0.004 * (j % 2 ? 1 : -1), 0.4 + 0.6 * Math.abs(Math.sin(t * 0.01 + j)), false); o.restore();
    }
    const Lp = L_(), q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), len = Math.hypot(L.gw, L.gh) * 0.7;
    o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
    mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.3, ang, -(t - POP) * 1.3, 0.6 * a, false, 0.8);
    o.restore();
  }

  // the light of the cut: when the loser comes apart, a long lens of jade light runs along the cut across the whole page for a moment
  function flare(o, t) {
    if (t < POP || t > POP + 150) return;
    const pn = MG.byId.strike, u = cutU(), C = pn.sp(FIN.lx, -cutH()), a = 1 - fe(POP + 30, POP + 150, t), len = Math.hypot(L.gw, L.gh), k = easeOut(fe(POP, POP + 40, t)), nx = -u[1], ny = u[0];
    o.save(); o.globalAlpha = a;
    for (const [w, col] of [[7 * (1 - 0.5 * (1 - a)), MG_INK], [4.4, COL], [1.6, "#ffffff"]]) {
      o.fillStyle = col; o.beginPath(); o.moveTo(C[0] - u[0] * len * k, C[1] - u[1] * len * k); o.lineTo(C[0] + nx * w, C[1] + ny * w); o.lineTo(C[0] + u[0] * len * k, C[1] + u[1] * len * k); o.lineTo(C[0] - nx * w, C[1] - ny * w); o.closePath(); o.fill();
    }
    o.restore();
  }

  /* ---- panel 4: he sheathes the blade, turns away; the colour floods back from the blade (a growing circle) ---- */
  const NOFLOOD = { x: 0, y: 0, r: 0, full: false }, FULLFLOOD = { x: 0, y: 0, r: 1e5, full: true };
  function flood(t) {
    const pn = MG.byId.after;
    if (ult) return t >= FLOOD ? FULLFLOOD : NOFLOOD;   // the splash is the flood: the whole page is in colour from 3250
    if (!pn || t < FLOOD) return NOFLOOD;
    if (floodAt && floodAt.t === t) return floodAt.v;
    const tip = bladeTip(W_(), FLOOD), q = pn.sp(tip[0], tip[1]), R = Math.hypot(Math.max(q[0], L.gw - q[0]), Math.max(q[1], L.gh - q[1])) * 1.02, r = R * easeOut(fe(FLOOD, FLOOD + 500, t));
    // full: the circle has swallowed the whole panel, so the grey puppet underneath is not drawn any more
    const cn = Math.max(Math.hypot(pn.x0 - q[0], pn.y0 - q[1]), Math.hypot(pn.x1 - q[0], pn.y0 - q[1]), Math.hypot(pn.x0 - q[0], pn.y1 - q[1]), Math.hypot(pn.x1 - q[0], pn.y1 - q[1]));
    const v = { x: q[0], y: q[1], r, full: r > cn + 4 };
    floodAt = { t, v };
    return v;
  }
  function enso(c, x, y, r, k, col, w) {   // one brush stroke in a circle, open at the top right
    const pts = [], n = 36, a0 = -0.35 * Math.PI, sweep = Math.PI * 2 * 0.93 * k;
    for (let i = 0; i <= n; i++) { const a = a0 + sweep * (i / n), rr = r * (1 + 0.035 * Math.sin(a * 2.1 + 1) - 0.05 * (i / n)); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    c.fillStyle = col; brush(c, pts, w, n);
  }
  function drawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir, fl = flood(t), z = pn.z;
    pn.screen(c);
    const bx = pn.p(wx_(t), 0), hd = pn.p(...bodyPt(W, t, "head"));
    mgFocus(c, hd[0], hd[1], Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.28);
    const ek = easeOut(fe(MT.AFTER + 60, MT.AFTER + 650, t)), er = pn.h * 0.5;
    enso(c, bx[0] - D * 0, pn.cy - pn.h * 0.04, er, ek, MG_INK, pn.h * 0.1);
    // ground
    pn.world(c);
    c.fillStyle = MG_INK; c.fillRect(FIN.wx - 600, -1.4, 1500, 3.6);
    c.lineCap = "round"; c.strokeStyle = MG_INK;
    for (let i = 0; i < 12; i++) { const r = mgRng(90 + i), x = wx_(t) - 160 + r() * 320, y = 5 + (i % 4) * 5.5 + r() * 2; c.lineWidth = 1 + r() * 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 25 + r() * 70, y); c.stroke(); }
    if (!fl.full) mgPuppet(c, pn, W, t, { sc: 1, light: topLight(), post: grey(120) });
    if (fl.r > 2) {   // colour: the puppet as he really looks, inside the circle
      c.save(); pn.screen(c); if (fl.r < 1e4) { c.beginPath(); c.arc(fl.x - pn.ox, fl.y - pn.oy, fl.r, 0, Math.PI * 2); c.clip(); }
      mgPuppet(c, pn, W, t, { sc: 1, light: topLight(), tint: 0.32 });
      c.restore();
    }
    jade(c, pn, W, t, 1);
    pn.screen(c);
    // the click: four short lines at the hand as the blade reaches the scabbard
    const ck = fe(CLICK, CLICK + 140, t);
    if (ck > 0 && ck < 1) {
      const h = pn.p(...bladeTip(W, t)), a = 1 - ck;
      c.save(); c.globalAlpha = a; c.lineCap = "round";
      for (let i = 0; i < 5; i++) { const an = -0.5 * Math.PI + (i - 2) * 0.55 + (D < 0 ? 0.0 : 0), r0 = 7 + 8 * ck, r1 = 14 + 22 * ck; c.beginPath(); c.moveTo(h[0] + Math.cos(an) * r0, h[1] + Math.sin(an) * r0); c.lineTo(h[0] + Math.cos(an) * r1, h[1] + Math.sin(an) * r1); c.strokeStyle = MG_INK; c.lineWidth = 3.2; c.stroke(); }
      c.restore();
    }
  }

  /* ---- ULTIMATE: the three page-wide strokes, the slabs they cut the page into, the splash ---- */
  const T_STROKE = [3000, 3080, 3160], A_STROKE = [-0.15, 0.95, -0.55];   // when each stroke starts (130 ms each) and its tilt (the screen angle with the winner on the left; mirrored with FIN.dir)
  let lines = null, slab = null, burst = [], petalSpr = null;
  // where the cut goes through the loser on the screen, from the strike panel's camera at the hit (it does not move after that)
  function hitScreen() {
    const pn = MG.byId.strike, cm = pn.camAt(HIT), z = pn.h / cm.vh;
    return [pn.cx + (cm.px || 0) + (FIN.lx - cm.wx) * z, pn.cy + (cm.py || 0) + (-cutH() - cm.wy) * z];
  }
  // the three lines (two on a slow phone): each runs edge to edge through the hit point, the 2nd and 3rd a little to the side so that they make a small triangle (seven pieces, not six)
  function LN() {
    if (lines) return lines;
    const D = FIN.dir, P = hitScreen(), gw = L.gw, gh = L.gh, m = Math.min(gw, gh), n = MG.slow ? 2 : 3, offs = [0, 0.05, -0.045];
    lines = [];
    for (let i = 0; i < n; i++) {
      const a = A_STROKE[i], ux = D * Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, off = offs[i] * m, px = P[0] + nx * off, py = P[1] + ny * off;
      let lo = -1e9, hi = 1e9;   // the stretch of the line inside the screen
      for (const [p0, u, g] of [[px, ux, gw], [py, uy, gh]]) if (Math.abs(u) > 1e-6) { const s1 = -p0 / u, s2 = (g - p0) / u; lo = Math.max(lo, Math.min(s1, s2)); hi = Math.min(hi, Math.max(s1, s2)); }
      const pts = [];
      for (let j = 0; j <= 26; j++) { const q = lo + (hi - lo) * (j / 26); pts.push([px + ux * q, py + uy * q]); }
      lines.push({ t0: T_STROKE[i], px, py, ux, uy, nx, ny, pts, ang: Math.atan2(uy, ux), w: clamp(m * 0.045, 9, 24) });
    }
    return lines;
  }
  // the strokes: tapered ink brush with a white hairline core, growing over 130 ms each; `o` has the css transform
  function drawStrokes(o, t) {
    for (const ln of LN()) {
      const k = fe(ln.t0, ln.t0 + 130, t);
      if (k <= 0) continue;
      const n = Math.max(1, Math.round((ln.pts.length - 1) * k));
      o.fillStyle = MG_INK; brush(o, ln.pts, ln.w, n);
      o.fillStyle = "#ffffff"; brush(o, ln.pts, Math.max(1.6, ln.w * 0.12), n);
    }
  }
  function strokesOver(o, t) { if (t >= T_STROKE[0] && t < MT.SPLASH) drawStrokes(o, t); }   // from the splash on they are part of the slabs
  const clipPoly = (poly, nx, ny, d) => {   // the part of a convex polygon with nx*x + ny*y >= d
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { const k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out;
  };
  // the splash's `before` hook: the page as it stands (panels, no splash yet) is copied once, the strokes drawn on it, and cut by the lines into the pieces (the sign
  // combinations of the half-planes; one of the eight is empty)
  function grabSlabs(c, t) {
    const cvs = mgCanvas(MG.cw, MG.ch), x = cvs.getContext("2d"), D = DPR, ls = LN(), P = hitScreen(), pcs = [];
    x.drawImage(c.canvas, 0, 0);
    x.setTransform(D, 0, 0, D, 0, 0); drawStrokes(x, t);
    for (let mask = 0; mask < 1 << ls.length; mask++) {
      let poly = [[0, 0], [L.gw, 0], [L.gw, L.gh], [0, L.gh]];
      for (let i = 0; i < ls.length && poly.length >= 3; i++) { const sg = (mask >> i) & 1 ? 1 : -1, ln = ls[i]; poly = clipPoly(poly, sg * ln.nx, sg * ln.ny, sg * (ln.nx * ln.px + ln.ny * ln.py)); }
      if (poly.length < 3) continue;
      let ar = 0, cx = 0, cy = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], cr = a[0] * b[1] - b[0] * a[1];
        ar += cr; cx += (a[0] + b[0]) * cr; cy += (a[1] + b[1]) * cr; x0 = Math.min(x0, a[0]); y0 = Math.min(y0, a[1]); x1 = Math.max(x1, a[0]); y1 = Math.max(y1, a[1]);
      }
      ar /= 2;
      if (Math.abs(ar) < 30) continue;
      cx /= 6 * ar; cy /= 6 * ar;
      let vx = cx - P[0], vy = cy - P[1], vl = Math.hypot(vx, vy);
      if (vl < 8) { vx = FIN.dir * 0.3; vy = -1; vl = Math.hypot(vx, vy); }   // the little triangle in the middle goes up and back
      const sx = Math.max(0, Math.floor(x0 * D)), sy = Math.max(0, Math.floor(y0 * D)), sw = Math.min(MG.cw - sx, Math.ceil((x1 - x0) * D) + 2), sh = Math.min(MG.ch - sy, Math.ceil((y1 - y0) * D) + 2);
      pcs.push({ poly, cx, cy, r: Math.max(x1 - x0, y1 - y0), nx: vx / vl, ny: vy / vl, sx, sy, sw, sh });
    }
    pcs.sort((a, b) => b.cy - a.cy);   // the lowest piece lets go first
    pcs.forEach((q, i) => { q.delay = i * 16; q.rs = i % 2 ? 1 : -1; });
    slab = { cv: cvs, pcs };
  }
  // the pieces part (16 px along their outward normal by 300 ms), then fall off the page (0.9 px/frame^2, turning +-0.25 rad), gone by about 4150
  function drawSlabs(c, t) {
    if (!slab || t < MT.SPLASH) return;
    const D = DPR, g = Math.max(0.9, L.gh / 430);
    let alive = false;
    c.save(); c.setTransform(D, 0, 0, D, 0, 0); c.lineJoin = "round"; c.strokeStyle = MG_INK; c.lineWidth = 2.4;
    for (const q of slab.pcs) {
      let dx = 0, dy = 0, rot = 0, a = 1;
      if (MG.reduced) a = 1 - fe(MT.SPLASH, MT.SPLASH + 400, t);   // reduced motion: they fade instead of falling
      else {
        const k = easeOut(fe(MT.SPLASH, MT.SPLASH + 300, t)), f = Math.max(0, t - MT.SPLASH - 300 - q.delay) / FMS;
        dx = q.nx * (16 * k + 0.35 * f); dy = q.ny * (16 * k + 0.35 * f) + 0.5 * g * f * f; rot = MG.slow ? 0 : q.rs * 0.25 * easeIn(Math.min(1, f / 30));
      }
      if (a <= 0.01 || q.cy + dy - q.r > L.gh + 24) continue;
      alive = true;
      c.save(); c.translate(q.cx + dx, q.cy + dy); c.rotate(rot); c.translate(-q.cx, -q.cy);
      mgPoly(c, q.poly); c.save(); c.clip(); c.globalAlpha = a;
      c.drawImage(slab.cv, q.sx, q.sy, q.sw, q.sh, q.sx / D, q.sy / D, q.sw / D, q.sh / D);
      c.restore(); c.globalAlpha = a; c.stroke();   // the edge of the paper
      c.restore();
    }
    c.restore();
    if (!alive) slab = null;   // all gone: the page copy is freed
  }
  // a hundred pink petals bursting from the sheath (350 ms, then the wind), as small sprites; drawn in the panel
  function burstBuild() {
    const r = mgRng(515), D = DPR, s = Math.max(5, L.gh * 0.014), w = Math.ceil(s * 2.6 * D), h = Math.ceil(s * 2.2 * D);
    burst = Array.from({ length: MG.slow ? 50 : 100 }, () => ({ a: r() * 6.2832, d: 0.18 + 0.82 * Math.sqrt(r()), tt: 260 + r() * 200, ph: r() * 6.28, f: 1.3 + r() * 2, sc: 0.7 + r() * 0.8, sp: (r() - 0.5) * 7, wv: 0.6 + r() * 0.9 }));
    petalSpr = mgCanvas(w, h);
    const x = petalSpr.getContext("2d"); x.setTransform(D, 0, 0, D, w / 2, h / 2); petalShape(x, s); x.fillStyle = PINK; x.fill(); x.lineWidth = 1.3; x.strokeStyle = PINK_D; x.stroke();
  }
  function burstDraw(c, pn, t) {
    const u = t - MT.SPLASH;
    if (u < 0 || !petalSpr) return;
    const D = FIN.dir, o = pn.p(...bladeTip(W_(), t)), R = Math.hypot(pn.w, pn.h) * 0.42, a0 = Math.min(1, u / 80) * (1 - fe(MT.AFTER - 450, MT.AFTER - 40, t)), sw = petalSpr.width / DPR, sh = petalSpr.height / DPR;
    if (a0 <= 0.01) return;
    c.save(); c.globalAlpha = a0;
    for (const b of burst) {
      const k = easeOut(Math.min(1, u / b.tt)), late = Math.max(0, u - b.tt), x = o[0] + Math.cos(b.a) * R * b.d * k + D * b.wv * late * 0.035 + Math.sin(late * 0.003 + b.ph) * 5 * Math.min(1, late / 300), y = o[1] + Math.sin(b.a) * R * b.d * k * 0.8 + late * 0.014 + Math.sin(late * 0.004 * b.f + b.ph) * 6 * Math.min(1, late / 300);
      c.save(); c.translate(x, y); c.rotate(b.ph + u * 0.001 * b.sp); c.scale(b.sc, b.sc * (0.35 + 0.65 * Math.abs(Math.cos(u * 0.0035 * b.f + b.ph)))); c.drawImage(petalSpr, -sw / 2, -sh / 2, sw, sh); c.restore();
    }
    c.restore();
  }
  // panel 5, the splash: pale gold paper, white lines from his chest, the ground, him full page in colour (sheathed, half turned), the petals bursting
  function drawSplash(c, pn, t) {
    const W = W_();
    pn.screen(c);
    const ch = pn.p(...bodyPt(W, t, "hip", 0, -10));
    mgFocus(c, ch[0], ch[1], Math.hypot(pn.w, pn.h) * 0.85, t * 0.00025, 0.6 * easeOut(fe(MT.SPLASH, MT.SPLASH + 300, t)), true);
    pn.world(c);
    c.fillStyle = MG_INK; c.fillRect(FIN.lx - 700, -1.4, 1700, 3.6);
    c.lineCap = "round"; c.strokeStyle = MG_INK;
    for (let i = 0; i < 12; i++) { const r = mgRng(90 + i), x = wx_(t) - 160 + r() * 320, y = 5 + (i % 4) * 5.5 + r() * 2; c.lineWidth = 1 + r() * 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 25 + r() * 70, y); c.stroke(); }
    mgPuppet(c, pn, W, t, { sc: 1, light: topLight(), tint: 0.32 });
    jade(c, pn, W, t, 1);
    pn.screen(c);
    burstDraw(c, pn, t);
  }

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "One Cut", hit: HIT, pop: POP, flight: "strike", noImpact: true,
    panels,
    words(lay) {
      const D = FIN.dir, P3 = () => MG.byId.strike, port = lay.port;
      const ws = [
        { text: "...", t0: 600, t1: 1330, size: port ? 0.085 : 0.15, rot: -0.06 * D, space: 0.12, at: () => [clamp(MG.ix + D * L.gw * 0.05, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.26, L.gh * 0.2, L.gh * 0.5)] },
        { text: "SHING", t0: ult ? 3050 : HIT, t1: ult ? MT.SPLASH + 250 : 3560, size: port ? 0.075 : 0.2, arc: 12, rot: -TILT * D, fill: COL, stretch: { ang: -TILT * D, k: 0.5 },   // (Ultimate: it lands when the impact frames end)
          at: () => { const p = P3(), q = p.sp(FIN.lx - D * (port ? 84 : 108), -cutH() - (port ? 40 : 54)); return [q[0], q[1]]; } },
      ];
      if (!ult) return ws;
      // SHK at the far end of each stroke (gold: the engine's strike-word rule), then the name of the Ultimate above his head in the splash
      for (let i = 0; i < (MG.slow ? 2 : 3); i++) {
        ws.push({ text: "SHK", t0: T_STROKE[i], t1: T_STROKE[i] + 440, size: port ? 0.05 : 0.07, arc: 8, rot: (A_STROKE[i] * D) * 0.6, stretch: { ang: A_STROKE[i] * D, k: 0.3 },
          at: () => { const ln = LN()[i], B = ln.pts[ln.pts.length - 1], m = Math.min(L.gw, L.gh) * 0.13; return [B[0] - ln.ux * m, B[1] - ln.uy * m]; } });
      }
      ws.push({ text: "HUNDRED PETALS", t0: 3700, t1: MT.AFTER + 100, size: port ? 0.048 : 0.16, arc: 10, rot: -0.06 * D, fill: COL,
        at: (t) => { const sz = port ? 0.048 : 0.16, W = W_(), top = MG.byId.splash.sp(W.x, W.y - 82), h = MG.byId.splash.sp(...bodyPt(W, t, "head")); return [h[0] + D * L.gw * (port ? 0 : 0.05), top[1] - L.gh * (sz * 0.5 + 0.02)]; } });   // centred just above the sprout
      return ws;
    },
    start(g) { FIN.cue.drone = true; FIN.cue.taiko = true; setTimes(false); pota = false; pota2 = false; petals = []; snapC = null; half = null; flick = 0; floodAt = null; lines = slab = petalSpr = null; burst = []; },   // no drone (wind and petals only), no taiko (SHING is the hit)
    build(lay) {
      const r = mgRng(2026), g = L.gw, h = L.gh;
      petals = Array.from({ length: MG.slow ? 20 : 34 }, () => ({ x: r() * (g + 60), y: r() * (h + 60), vx: 24 + r() * 34, vy: 7 + r() * 15, a: 0.5 + r() * 1.5, f: 1.1 + r() * 1.6, ph: r() * 6.28, s: 3.6 + r() * 3.2, sp: (r() - 0.5) * 2.4 }));
      snapC = MG.snap; MG.snap = greyOf(snapC, 2);
      const p1 = MG.panels[0]; p1.d.draw = drawHit; p1.d.bw = MG.bw * 1.45;
      if (ult) burstBuild();
    },
    step(t, k) {
      const W = W_(), Lp = L_();
      W.x = wx_(t); W.facing = faceK(t) * FIN.dir;
      if (t > 700 && snapC) snapC = null;
      MG.pt = t;
    },
    after(t) {
      const Lp = L_();
      Lp.flash = 0;
      if (t < FIN.launch) { Lp.x = FIN.lx; Lp.y = 0; }   // he does not recoil: the page holds
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, D = FIN.dir;
      if (role === "w") {
        P.expr = (ult ? t >= MT.SPLASH : t >= TURN + 150) ? "calm" : undefined; P.exK = 1;
        if (t < CUT_T) {   // the stance: hand on the hilt at the front hip, the scabbard pointing back
          const k = ease(fe(MT.STRIKE - 100, MT.STRIKE + 200, t));
          P.sheath = 1; P.holdAng = Math.PI - 0.14; P.crouch = 0.32 * k; P.lean = 0.22 * k;
          return { hF: [w * 0.62, -leg - tor * 0.36], hB: [-w * 0.2, -leg - tor * 0.34], fF: [w * 0.5, 0], fB: [-w * 0.42, 0] };
        }
        if (t < SHEATH0) {   // blade out, level at hip height, past the loser
          P.sheath = 0; P.holdAng = 0.1; P.crouch = 0.28; P.lean = 0.2;
          return { hF: [w * 0.95, -leg - tor * 0.5], hB: [-w * 0.45, -leg - tor * 0.3], fF: [w * 0.55, 0], fB: [-w * 0.6, 0] };
        }
        const q = ease(fe(SHEATH0, CLICK, t)), s = ease(fe(CLICK, ult ? MT.SPLASH + 400 : pota ? CLICK + 300 : TURN + 300, t));   // sheathes, stands tall, turns away (Hasselback: tall at once, then he holds still)
        P.sheath = Math.max(0.001, q); P.holdAng = 0.1 + (Math.PI - 0.14 - 0.1) * q; P.crouch = 0.28 * (1 - s); P.lean = 0.2 * (1 - s);
        return { hF: [w * (0.95 - 0.33 * q), -leg - tor * (0.5 - 0.14 * q)], hB: [-w * 0.45 + w * 0.25 * s, -leg - tor * 0.32], fF: [w * (0.55 - 0.1 * s), 0], fB: [-w * (0.6 - 0.2 * s), 0] };
      }
      // the loser
      if (pota && t >= CLICK + 60) {   // the Potatality: after the click, relief (eyes shut, a smile, the hands come down); at SHING the eyes go wide again
        const ok = t < HB.SHING;
        P.expr = ok ? "calm" : "terror"; P.exK = 1; P.lean = 0; P.mouth = ok ? 0 : 1;
        return ok ? { hF: [w * 0.6, -leg - tor * 0.15], hB: [-w * 0.6, -leg - tor * 0.15] } : { hF: [w * 0.75, -leg - tor * 0.5], hB: [-w * 0.7, -leg - tor * 0.5] };
      }
      const cut = t >= POP;
      P.expr = cut ? "ko" : "terror"; P.exK = fe(MT.INSET, MT.STRIKE, t);
      if (!cut) {
        P.lean = Math.sin(t * 0.03) * 0.035 * fe(2000, 2400, t); P.mouth = 0.3 * fe(2000, 2350, t);
        return { hF: [w * 0.75, -leg - tor * 0.45], hB: [-w * 0.7, -leg - tor * 0.45] };
      }
      P.lean = -0.4; P.mouth = 1; P.spin = half ? half.th * p.facing : 0;
      return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
    },
    // over everything: the petals, the colour wash and its ring, the speed lines of the flight
    over(o, t) {
      petalsOver(o, t);
      trailOver(o, t);
      if (ult) strokesOver(o, t); else flare(o, t);
      const fl = flood(t);
      if (fl.r > 2 && !ult) {
        o.save(); o.beginPath(); o.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2); o.clip();
        o.globalCompositeOperation = "multiply"; o.fillStyle = "#ffe6d2"; o.fillRect(0, 0, L.gw, L.gh);
        o.restore();
        const a = 1 - fe(FLOOD + 300, FLOOD + 520, t);
        if (a > 0.01) { o.save(); o.globalAlpha = a; o.beginPath(); o.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2); o.strokeStyle = MG_INK; o.lineWidth = 6; o.stroke(); o.strokeStyle = COL; o.lineWidth = 3; o.stroke(); o.restore(); }
      }
    },
    drawLoser: drawLoserFn,
    hitPt() { return [FIN.lx, -cutH()]; },
    // One Cut has no impact frames (noImpact); the Ultimate's three show him and the loser as flat silhouettes, and the gold one the hairline of the cut across the loser
    impact(o, pn, sil, t) {
      if (!ult) return;
      mgPuppet(o, pn, W_(), t, { sc: 1, sil });
      mgPuppet(o, pn, L_(), t, { sc: 1, sil });
      if (sil === MG_INK) {
        const Lp = L_(), u = cutU(), len = Lp.s.w * 0.62, cx = Lp.x, cy = Lp.y - cutH(), a = pn.sp(cx - u[0] * len, cy - u[1] * len), b = pn.sp(cx + u[0] * len, cy + u[1] * len);
        o.save(); o.lineCap = "round"; o.beginPath(); o.moveTo(a[0], a[1]); o.lineTo(b[0], b[1]); o.strokeStyle = "#ffffff"; o.lineWidth = 3.4; o.stroke(); o.restore();
      }
    },
    cues(t) {
      cueOnce("wind", 900, () => Cin.go(() => Cin._noise(1.6, 0.06, 420, 900, "bandpass", 0.9)));
      cueOnce("flute", 1500, () => Cin.go(() => Cin.flute(0.95)));
      cueOnce("pluck", 2000, () => Cin.go(() => Cin.pluck(1480)));
      cueOnce("whistle", 2000, () => Cin.go(() => Cin._noise(0.4, 0.14, 700, 2600, "bandpass", 11)));
      cueOnce("drum", 2200, () => Cin.go(() => { Cin.sub(66, 40, 0.5, 0.45); Cin._noise(0.1, 0.18, 500, 120, "lowpass"); }));
      cueOnce("cutwhoosh", CUT_T, () => Cin.go(() => Cin._noise(ult ? 0.22 : 0.1, 0.5, 8200, 2400, "highpass", 0.7)));
      cueOnce("shing", HIT, () => Cin.go(() => {   // steel: partials ringing out, a spark of air on top; a little late, the silence before it has not quite ended
        for (const [f, v, d] of [[2637, 0.1, 1.1], [3951, 0.07, 0.8], [5274, 0.045, 0.6], [7458, 0.025, 0.4]]) Cin._osc("sine", f, f * 0.997, d, v, 0.002, 0.05);
        Cin._noise(0.06, 0.4, 9000, 3500, "highpass", 0.7, 0.05);
      }));
      cueOnce("parts", POP, () => Cin.go(() => { Cin.sub(58, 34, 0.38, 0.5); Cin.whoosh(0.35, -0.5, 0.7, 0.4); }));
      cueOnce("click", CLICK, () => Cin.go(() => { Cin.clack(); Cin.tick(3200); }));
      if (!ult) { cueOnce("flood", FLOOD + 40, () => Cin.go(() => { Cin.chime(1568); Cin.shimmer(1568, 1.3); })); return; }
      // Ultimate: a cut whoosh per stroke, the slabs part (three page sounds, a low rise), the shimmer as the colour floods, the name lands with a taiko
      LN().forEach((ln, i) => cueOnce("sk" + i, ln.t0, () => Cin.go(() => Cin._noise(0.14, 0.4, 8200 - i * 900, 2400, "highpass", 0.7))));
      cueOnce("pg2", MT.SPLASH + 80, () => Cin.go(() => Cin.page()));
      cueOnce("pg3", MT.SPLASH + 160, () => Cin.go(() => Cin.page()));
      cueOnce("rise", MT.SPLASH, () => Cin.go(() => Cin.sub(58, 34, 0.5, 0.45)));
      cueOnce("shim", MT.SPLASH + 50, () => Cin.go(() => Cin.shimmer(1568, 1.6)));
      cueOnce("name", 3700, () => Cin.go(() => Cin.taiko(0.8)));
    },
  };
  // the Ultimate cut: the same script with its own name, launch, panels, words, hooks (it reads `ult`, set by start)
  S_.ulti = Object.assign({}, S_, {
    name: "Hundred Petals", pop: 3050, noImpact: false,
    start(g) { S_.start(g); setTimes(true); },   // (S_.start resets everything and says One Cut; this one then moves the moments)
    page(c, t) { drawSlabs(c, t); },
    end() { slab = null; lines = null; burst = []; petalSpr = null; },
  });
  /* ===================== the Potatality, "Hasselback" (MANGA.samurai.alt; design: Project files step8/fable-design.md) =====================
     One Cut to the brush stroke, but the cut is not seen: at 2900 no hairline, no SHING, he does not come apart (no launch at all: pop 1e9); he stands there
     trembling, "?". 3250 the splash comes down from the top: the loser big, the samurai with his back to him (beside him; upright in front, nearer, cut by
     the page's foot) sliding the blade home; 3420 click; the loser is whole: relief, eyes shut, a smile (phew). 3800 SHING: eight jade hairlines run down him,
     3880 he fans open into nine slices joined above the legs, the cut flesh in cream between them (a hasselback), a little overshoot, then the silence (...).
     4700 in panel 4's place: the samurai as on One Cut (the enso, the colour flooding from his hand), the loser as a hasselback on a plate on a low board:
     the skin in his costume colour, golden cuts, one eye per slice (the blinks ripple along), butter, jade chives, steam; a wooden knife rest with a small
     knife. The engine's POP lifts him off the plate at 5250 (food()): crumbs and a chive are left.
     The slices: at 3880 the loser's puppet is drawn once into hbCap (the picture, and his silhouette as cut flesh, cropped to his box, device px); every band
     of it is then drawn turned about its foot. The splash's camera never moves, so that picture, and the pictures hbPup keeps of a puppet holding still (the
     loser while relieved, the samurai once tall: he straightens at once on this page), stay where they were taken. Helpers: hb. */
  const HB = { SHEATH0: 3260, CLICK: 3420, PHEW: 3540, SHING: 3800, FAN0: 3880, FAN1: 4160, HUSH: 4260 };
  const HB_N = 9, HB_BOX = [-75, -128, 75, 12], HB_BASE = 0.2, HB_FAN = 0.3;   // the slices: how many; the box the picture is taken from; where the cuts stop (share of his height); the outer slices' turn (rad)
  const hbHW = () => L_().s.w * 0.62, hbBS = () => (L_().spec.boss ? MG_BOSS_SC : 1);   // the half width the slices cover (his own units), a boss's scale
  const HB_FLESH = "#f6e2a0", TAU_ = Math.PI * 2;
  let hbCap = null, hbPal = null, hbKeep = {};
  // the splash: its height in world units (vh), the camera's centre from the loser (cx), the loser's scale (lsc), the ground's height (gy); the samurai: where he
  // stands (wx, wy: upright he is in front, nearer: his feet below the ground line and off the page), his scale, drawn over the loser (front)
  const hbLay = () => (L.portrait ? { vh: 290, cx: 20, wx: 52, lsc: 1.25, gy: 0.31, wy: 64, wsc: 1.4, front: true } : { vh: 140, cx: 34, wx: 78, lsc: 1.15, gy: 0.36, wy: 0, wsc: 1, front: false });
  // the aftermath, wide: a wider still shot with the ground low, the samurai on the right, the hasselback big in the open middle, room on the left for the hop
  // (the loser springs up from the plate and lands there, under the title band all the way: the band leaves about 145 of these units above the ground)
  const HB_AW = { vh: 160, wy: -0.435 * 160, sam: 105, plate: 119, land: 101 };
  const hbPX = () => FIN.lx + FIN.dir * (far() - (L.portrait ? 60 : HB_AW.plate)), hbFS = () => (L.portrait ? 1 : 2.4);   // the plate (the board's middle) in the aftermath, the food's scale
  // the splash's big puppets: grey only inside the box mgPuppet drew (greyPost greys a square 240 of his units wide, a lot of pixels at this size)
  const HB_WBOX = [-100, -112, 100, 14];
  function hbGreyBox(lc, X) {
    const w = X.bw, h = X.bh;
    if (w < 2 || h < 2) return;
    let sc = scratch.get(MG.layer);
    if (!sc) { sc = { cv: mgCanvas(w, h) }; sc.x = sc.cv.getContext("2d"); scratch.set(MG.layer, sc); } else if (sc.cv.width < w || sc.cv.height < h) { sc.cv.width = Math.max(sc.cv.width, w); sc.cv.height = Math.max(sc.cv.height, h); sc.x = sc.cv.getContext("2d"); }
    const tx = sc.x;
    tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = "source-over"; tx.clearRect(0, 0, w, h);
    tx.drawImage(MG.layer, X.bx, X.by, w, h, 0, 0, w, h);
    tx.globalCompositeOperation = "saturation"; tx.fillStyle = "#000"; tx.fillRect(0, 0, w, h);
    tx.globalCompositeOperation = "source-over";
    lc.drawImage(sc.cv, 0, 0, w, h, X.bx, X.by, w, h);
  }
  function hbGrey(hex) { const n = parseInt(hex.slice(1), 16), v = Math.round(((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11)), h = v.toString(16).padStart(2, "0"); return "#" + h + h + h; }
  function hbPalettes() {
    const c = { wood: "#a9733f", woodD: "#6e4522", plate: "#fbfaf6", gold: "#e3a944", flesh: HB_FLESH, crisp: "#a8692a", skin: L_().pal.accent || col(L_().pal), blade: "#e9eef0", handle: "#3b2416", crumb: "#d99a3a", butter: "#fff1a6" };
    const g = {};
    for (const k in c) g[k] = hbGrey(c[k]);
    hbPal = { c, g };
  }
  // the loser's picture, taken once (the pose of 3880: eyes wide) into two cropped canvases (device px): as drawn, and the cut flesh: his silhouette in cream
  // with an ink rim, the cut lines inked across it (what shows between the slices as they open)
  function hbCapture(pn) {
    const Lp = L_(), Y = hbLay(), boss = !!Lp.spec.boss, ze = pn.z * Y.lsc * (boss ? MG_BOSS_SC : 1), bq = boss ? MG_BOSS_BOX : HB_BOX, D = DPR;
    const sp = pn.p(Lp.x, Lp.y), X = sp[0] + pn.ox, Yf = sp[1] + pn.oy;   // (as mgPuppet places it, so the crop is the part of the layer it has just drawn)
    const x0 = X + bq[0] * ze, y0 = Yf + bq[1] * ze, x1 = X + bq[2] * ze, y1 = Yf + bq[3] * ze;
    const bx = Math.max(0, Math.floor(x0 * D)), by = Math.max(0, Math.floor(y0 * D)), bw = Math.min(MG.cw - bx, Math.ceil((x1 - x0) * D) + 1), bh = Math.min(MG.ch - by, Math.ceil((y1 - y0) * D) + 1);
    if (bw <= 2 || bh <= 2) { hbCap = { none: true }; return; }
    mgPuppet(mgCanvas(1, 1).getContext("2d"), pn, Lp, HB.FAN0, { sc: Y.lsc, light: loserLight(), post: hbGreyBox, free: true, box: bq });
    const cvA = mgCanvas(bw, bh), cvK = mgCanvas(bw, bh), cvS = mgCanvas(bw, bh), xk = cvK.getContext("2d"), xs = cvS.getContext("2d"), ZE = ze * D, FX = X * D - bx;
    cvA.getContext("2d").drawImage(MG.layer, bx, by, bw, bh, 0, 0, bw, bh);
    xk.drawImage(cvA, 0, 0); xk.globalCompositeOperation = "source-in"; xk.fillStyle = MG_INK; xk.fillRect(0, 0, bw, bh);   // his silhouette in ink
    const rim = Math.max(1, Math.round(1.2 * D));
    for (const [dx, dy] of [[0, 0], [rim, 0], [-rim, 0], [0, rim], [0, -rim]]) xs.drawImage(cvK, dx, dy);   // ... a little fatter: the rim
    xk.fillStyle = HB_FLESH; xk.fillRect(0, 0, bw, bh); xs.drawImage(cvK, 0, 0);   // the flesh inside it
    const HW = hbHW(), sw = (2 * HW) / HB_N;
    xs.globalCompositeOperation = "source-atop"; xs.fillStyle = MG_INK;
    for (let i = 1; i < HB_N; i++) xs.fillRect(Math.round(FX + (-HW + i * sw) * ZE - 0.8 * D), 0, Math.max(1, Math.round(1.6 * D)), bh);
    xs.fillStyle = "rgba(168,105,42,0.22)"; xs.fillRect(0, 0, bw, bh * 0.4);   // a little crisp towards the top
    hbCap = { cvA, cvS, bx, by, bw, bh, fx: X * D, fy: Yf * D, ze: ZE };
  }
  // the fan: band i of the picture turned about its foot (the cuts stop above the legs: that part stays whole and joins them), the outer ones most;
  // each band brings its cut face on its inner side (its own silhouette in cream, one band over), so the gap that opens towards the middle shows cream
  // (drawn outside in, the middle last)
  function hbSlices(c, t) {
    const H = hbCap;
    if (!H || H.none) return;
    const HW = hbHW(), k = fe(HB.FAN0, HB.FAN1, t), fan = MG.reduced ? 1 : 1 - Math.exp(-5 * k) * Math.cos(8 * k), mid = (HB_N - 1) / 2, sw = (2 * HW) / HB_N, ze = H.ze;
    const py = Math.round(H.fy - L_().s.h * HB_BASE * ze), ph = py - H.by, cl = (x) => Math.max(0, Math.min(H.bw, x - H.bx));
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    if (ph > 1) for (let j = 0; j < HB_N; j++) {
      const i = j === HB_N - 1 ? mid : j % 2 ? HB_N - 1 - (j >> 1) : j >> 1, sg = Math.sign(i - mid);
      const xl = cl(i ? H.fx + (-HW + i * sw) * ze : -1e5), xr = cl(i < HB_N - 1 ? H.fx + (-HW + (i + 1) * sw) * ze : 1e5), px = H.fx + (-HW + (i + 0.5) * sw) * ze;
      if (xr - xl < 1) continue;
      c.save(); c.translate(px, py); c.rotate(((i - mid) / mid) * HB_FAN * fan); c.translate(-px, -py);
      if (sg) { const w = Math.min(xr - xl, sw * ze), sx = sg < 0 ? xr - w : xl; c.drawImage(H.cvS, sx, 0, w, ph, H.bx + sx - sg * w, H.by, w, ph); }   // (its own outline, so the flesh never stands above the slice)
      c.drawImage(H.cvA, xl, 0, xr - xl, ph, H.bx + xl, H.by, xr - xl, ph);
      c.restore();
    }
    const q = Math.max(0, ph);
    if (H.bh - q > 1) c.drawImage(H.cvA, 0, q, H.bw, H.bh - q, H.bx, H.by + q, H.bw, H.bh - q);   // the legs and the uncut foot, whole
    c.restore();
  }
  // SHING: the eight cuts show as jade hairlines down him, top to the base in a quick run from his back to his front, gone as he opens
  function hbCuts(c, pn, t) {
    const a = 1 - fe(HB.FAN0 + 10, HB.FAN0 + 90, t);
    if (t < HB.SHING || a <= 0) return;
    const Y = hbLay(), D = FIN.dir, HW = hbHW(), sw = (2 * HW) / HB_N, sc = Y.lsc * hbBS(), h = L_().s.h, y0 = -h * 1.15 * sc, y1 = -h * HB_BASE * sc;
    c.save(); c.globalAlpha = a; c.lineCap = "round";
    for (let i = 1; i < HB_N; i++) {
      const o = (D > 0 ? HB_N - i : i) * 7, k = easeOut(fe(HB.SHING + o, HB.SHING + o + 50, t));
      if (k <= 0) continue;
      const x = FIN.lx + (-HW + i * sw) * sc, top = pn.p(x, y0), bot = pn.p(x, y0 + (y1 - y0) * k);
      for (const [w, colr] of [[4.2, MG_INK], [2.2, COL], [0.8, EDGE]]) { c.strokeStyle = colr; c.lineWidth = w; c.beginPath(); c.moveTo(top[0], top[1]); c.lineTo(bot[0], bot[1]); c.stroke(); }
    }
    c.restore();
  }
  // the splash: plain paper, a 70% band under the top border, focus lines on him, the mist and the ground; the samurai (grey, jade) sheathing with his back to the
  // loser, the click; the loser whole (live) until 3880, then the slices
  function hbDrawSplash(c, pn, t) {
    const Lp = L_(), Y = hbLay();
    pn.screen(c);
    const hd = pn.p(FIN.lx, -46 * Y.lsc), gy = pn.p(FIN.lx, 0)[1];
    mgFocus(c, hd[0], hd[1], Math.hypot(pn.w, pn.h) * 0.85, t * 0.0002, 0.3);
    samTone(c, pn, [[pn.x0 - 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 + pn.h * 0.08], [pn.x0 - 4, pn.y0 + pn.h * 0.12]], 6, 0.7, [t * 0.001, 0]);
    samTone(c, pn, [[pn.x0 - 4, gy - pn.h * 0.14], [pn.x1 + 4, gy - pn.h * 0.17], [pn.x1 + 4, gy], [pn.x0 - 4, gy]], 7, 0.22, [t * 0.0007, 0]);
    ground(c, pn);
    if (!Y.front) hbSam(c, pn, t, Y);
    if (t < HB.FAN0) { hbPup(c, pn, Lp, t, { sc: Y.lsc, light: loserLight(), post: hbGreyBox, box: Lp.spec.boss ? MG_BOSS_BOX : HB_BOX }, "L", t >= CLICK + 60 && t < HB.SHING); pn.screen(c); }
    else { if (!hbCap) hbCapture(pn); hbSlices(c, t); pn.screen(c); }
    hbCuts(c, pn, t);
    if (Y.front) hbSam(c, pn, t, Y);
  }
  // a puppet that holds still from here on (still): its picture is kept from the first such frame (once the splash is in) and drawn again, as mgPuppet drew it
  function hbPup(c, pn, p, t, o, key, still) {
    const K = still && hbKeep[key];
    if (K) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(K.cv, K.bx, K.by); c.restore(); return; }
    mgPuppet(c, pn, p, t, o);
    if (!still || t < MT.SPLASH + 200) return;
    const boss = !!p.spec.boss, D = DPR, ze = pn.z * (o.sc || 1) * (boss ? MG_BOSS_SC : 1), sp = pn.p(p.x, p.y), bq = o.box || (boss ? MG_BOSS_BOX : MG_BOX);
    const x0 = Math.max(sp[0] + pn.ox + bq[0] * ze, pn.x0 + pn.ox - 2), y0 = Math.max(sp[1] + pn.oy + bq[1] * ze, pn.y0 + pn.oy - 2), x1 = Math.min(sp[0] + pn.ox + bq[2] * ze, pn.x1 + pn.ox + 2), y1 = Math.min(sp[1] + pn.oy + bq[3] * ze, pn.y1 + pn.oy + 2);
    const bx = Math.max(0, Math.floor(x0 * D)), by = Math.max(0, Math.floor(y0 * D)), bw = Math.min(MG.cw - bx, Math.ceil((x1 - x0) * D) + 1), bh = Math.min(MG.ch - by, Math.ceil((y1 - y0) * D) + 1);
    if (bw <= 2 || bh <= 2) return;
    const cv = mgCanvas(bw, bh); cv.getContext("2d").drawImage(MG.layer, bx, by, bw, bh, 0, 0, bw, bh);
    hbKeep[key] = { cv, bx, by };
  }
  // the samurai in the splash (grey, jade), sheathing with his back to the loser, and the click at his hand. Upright he stands in front, nearer (bigger, lower)
  function hbSam(c, pn, t, Y) {
    const W = W_(), D = FIN.dir, s = Y.wsc, ox = W.x, oy = W.y, X = FIN.lx + D * Y.wx;
    const pz = Object.assign(Object.create(pn), { world: (cc) => { pn.world(cc); cc.translate(X, Y.wy); cc.scale(s, s); cc.translate(-X, -Y.wy); } });   // jade() draws at his scale
    let hand = null;
    W.x = X; W.y = Y.wy;
    try {
      hbPup(c, pn, W, t, { sc: s, light: topLight(), post: hbGreyBox, box: HB_WBOX }, "W", t >= CLICK + 320);
      jade(c, pz, W, t, 1);
      const b = bladeTip(W, t); hand = pn.p(X + (b[0] - X) * s, Y.wy + (b[1] - Y.wy) * s);
    } finally { W.x = ox; W.y = oy; }
    pn.screen(c);
    const ck = fe(CLICK, CLICK + 160, t);   // the click: short lines at his hand as the blade goes home
    if (ck > 0 && ck < 1) {
      const m = Math.max(1, s * 0.85);
      c.save(); c.globalAlpha = 1 - ck; c.lineCap = "round"; c.strokeStyle = MG_INK; c.lineWidth = 3.2 * m;
      for (let i = 0; i < 5; i++) { const an = -0.5 * Math.PI + (i - 2) * 0.55, r0 = (8 + 9 * ck) * m, r1 = (16 + 26 * ck) * m; c.beginPath(); c.moveTo(hand[0] + Math.cos(an) * r0, hand[1] + Math.sin(an) * r0); c.lineTo(hand[0] + Math.cos(an) * r1, hand[1] + Math.sin(an) * r1); c.stroke(); }
      c.restore();
    }
  }
  // the hasselback on its plate on a low board, the knife rest at his end of the board (food units: the plate's middle at 0, on the ground; P: colours or greys)
  function hbFood(c, pn, t, P, popped) {
    const D = FIN.dir, s = hbFS(), lw = Math.max(1.1, 2.6 / pn.z) / s, cx = -D * 4;
    pn.world(c);
    c.save(); c.translate(hbPX(), 0); c.scale(s, s); c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = MG_INK; c.lineWidth = lw;
    c.fillStyle = P.woodD; for (const sd of [-1, 1]) { c.beginPath(); c.rect(sd * 26 - 3, -3, 6, 3); c.fill(); c.stroke(); }
    c.fillStyle = P.wood; c.beginPath(); c.rect(-34, -7.2, 68, 4.4); c.fill(); c.stroke();
    // the knife rest: a little wooden block with a dip, a small knife across it (jade edge), its tip towards the plate
    const kx = D * 26;
    c.fillStyle = P.wood; c.beginPath(); c.moveTo(kx - 4.8, -7.2); c.lineTo(kx - 4.8, -10.8); c.quadraticCurveTo(kx, -8.6, kx + 4.8, -10.8); c.lineTo(kx + 4.8, -7.2); c.closePath(); c.fill(); c.stroke();
    c.save(); c.translate(kx, -10.6); c.rotate(-0.05 * D); c.scale(D, 1);
    c.fillStyle = P.blade; c.beginPath(); c.moveTo(-9, 0.6); c.quadraticCurveTo(-7.5, -1.9, 1, -1.9); c.lineTo(1, 0.9); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = COL; c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(-8.2, 0.5); c.lineTo(0.6, 0.7); c.stroke();
    c.strokeStyle = MG_INK; c.lineWidth = lw; c.fillStyle = P.handle; c.beginPath(); c.roundRect(1, -1.6, 10, 2.6, 1); c.fill(); c.stroke();
    c.restore();
    // the plate
    c.fillStyle = P.plate; c.beginPath(); c.ellipse(cx, -9.2, 22, 4.2, 0, 0, TAU_); c.fill(); c.stroke();
    c.lineWidth = lw * 0.6; c.beginPath(); c.ellipse(cx, -9.6, 16, 2.8, 0, 0, TAU_); c.stroke(); c.lineWidth = lw;
    if (popped) {   // what he left: crumbs, a chive, a smear of butter
      c.fillStyle = P.crumb; for (const [dx, dy, r] of [[-6, -9.4, 0.9], [-2, -10.4, 0.6], [4, -9, 0.8], [7, -10.2, 0.5]]) { c.beginPath(); c.arc(cx + dx, dy, r, 0, TAU_); c.fill(); }
      c.strokeStyle = COL; c.lineWidth = lw * 1.2; c.beginPath(); c.moveTo(cx + 1, -9.6); c.lineTo(cx + 4, -10.3); c.stroke();
      c.restore();
      return;
    }
    // the hasselback lying on the plate: a long low dome cut into eight slices that lean apart a little (his colour on the skin, the golden flesh showing
    // in each cut), joined along the bottom; one eye on each slice (the blinks ripple along)
    const n = 8, Lh = 36, Hh = 17, base = -10.4, sw = Lh / n, x0 = cx - Lh / 2, b0 = MT.AFTER + 420, cyc = (t - b0) % 1600;
    const dh = (x) => Hh * Math.sqrt(Math.max(0, 1 - ((x - cx) / (Lh / 2)) ** 2));
    const dome = () => { c.beginPath(); c.moveTo(x0, base); c.ellipse(cx, base, Lh / 2, Hh, 0, Math.PI, TAU_); c.closePath(); };
    for (let j = 0; j < n; j++) {
      const i = j % 2 ? n - 1 - (j >> 1) : j >> 1, q = (i + 0.5) / n * 2 - 1, xa = x0 + i * sw, xm = xa + sw / 2, inn = q < 0 ? 1 : -1;
      const a = q * 0.3 + (MG.reduced ? 0 : Math.sin(t * 0.004 + i) * 0.012);
      c.save(); c.translate(xm, base); c.rotate(a); c.translate(-xm, -base);
      c.save(); c.beginPath(); c.rect(xa - 0.02, base - Hh - 3, sw + 0.04, Hh + 3); c.clip(); dome(); c.clip();
      c.fillStyle = P.skin; c.fillRect(xa - 1, base - Hh - 3, sw + 2, Hh + 4);
      c.fillStyle = P.gold; c.fillRect(inn > 0 ? xa + sw * 0.52 : xa, base - Hh - 3, sw * 0.48, Hh + 3);   // the cut face on its inner side
      c.fillStyle = P.crisp; c.fillRect(inn > 0 ? xa + sw * 0.52 : xa + sw * 0.48 - 0.5, base - Hh - 3, 0.5, Hh + 3);
      dome(); c.lineWidth = lw * 1.1; c.stroke();
      c.restore();
      c.lineWidth = lw * 0.8;
      for (const ex of [xa, xa + sw]) { const h = dh(ex); if (h > 0.5) { c.beginPath(); c.moveTo(ex, base - 2.6); c.lineTo(ex, base - h); c.stroke(); } }
      c.lineWidth = lw;
      const h = dh(xm);
      if (h > 7) {   // the eye
        const ex = xm - inn * sw * 0.2, ey = base - h + 5, bl = t >= b0 && cyc >= i * 50 && cyc < i * 50 + 90;
        if (bl) { c.beginPath(); c.moveTo(ex - 1.7, ey); c.lineTo(ex + 1.7, ey); c.lineWidth = lw * 0.8; c.stroke(); c.lineWidth = lw; }
        else { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(ex, ey, 1.95, 0, TAU_); c.fill(); c.lineWidth = lw * 0.7; c.stroke(); c.lineWidth = lw; c.fillStyle = MG_INK; c.beginPath(); c.arc(ex - FIN.dir * 0.5, ey + 0.3, 0.95, 0, TAU_); c.fill(); }
      }
      c.restore();
    }
    c.save(); c.beginPath(); c.rect(x0 - 1, base - 2.6, Lh + 2, 3); c.clip(); dome(); c.fillStyle = P.skin; c.fill(); dome(); c.stroke(); c.restore();   // the uncut bottom joins them
    c.beginPath(); c.moveTo(x0 + 0.6, base - 2.6); c.lineTo(x0 + Lh - 0.6, base - 2.6); c.lineWidth = lw * 0.7; c.stroke(); c.lineWidth = lw;
    c.save(); c.translate(cx, base - Hh - 0.6); c.rotate(-0.1);   // a pat of butter, melting down the middle slices
    c.fillStyle = P.butter; c.beginPath(); c.roundRect(-3.6, -2.2, 7.2, 3, 0.8); c.moveTo(0.7, 0.6); c.quadraticCurveTo(1.3, 3.4, 0.7, 4.9); c.quadraticCurveTo(0.1, 5.7, -0.3, 4.8); c.quadraticCurveTo(-0.5, 2.6, -0.9, 0.8); c.fill(); c.lineWidth = lw * 0.8; c.stroke(); c.lineWidth = lw;
    c.restore();
    c.strokeStyle = COL; c.lineWidth = lw * 1.3;   // jade chives
    for (const [dx, dy, a] of [[-9, -22.5, 0.6], [-2, -28.5, -0.4], [5, -27, 0.3], [11, -21, -0.7]]) { c.beginPath(); c.moveTo(cx + dx - Math.cos(a) * 1.6, dy - Math.sin(a) * 1.6); c.lineTo(cx + dx + Math.cos(a) * 1.6, dy + Math.sin(a) * 1.6); c.stroke(); }
    if (!MG.slow) {   // steam (wide, where the food is big, it rises less far: the title band is above it)
      const sr = L.portrait ? 22 : 13, sn = L.portrait ? 8 : 5;
      c.strokeStyle = MG_INK; c.lineWidth = lw * 0.8;
      for (let i = 0; i < 3; i++) {
        const sx = cx + (i - 1) * 9, ph = ((t - MT.AFTER) * 0.02 + i * 7) % sr;
        c.globalAlpha = 0.7 * (1 - ph / sr);
        c.beginPath(); for (let j = 0; j <= sn; j++) { const yy = -31 - ph - j * 1.9, xx = sx + Math.sin(j * 0.8 + t * 0.006 + i) * 2.2; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
      }
      c.globalAlpha = 1;
    }
    c.restore();
  }
  // the aftermath: One Cut's panel 4 (the enso, him, the colour flooding from his hand) and the food, grey until the flood reaches it
  function hbDrawAfter(c, pn, t) {
    drawAfter(c, pn, t);
    if (!hbPal) hbPalettes();
    const fl = flood(t), popped = mgPopped(t);
    if (!fl.full) hbFood(c, pn, t, hbPal.g, popped);
    if (fl.r > 2) {
      c.save(); pn.screen(c); if (fl.r < 1e4) { c.beginPath(); c.arc(fl.x - pn.ox, fl.y - pn.oy, fl.r, 0, TAU_); c.clip(); }
      hbFood(c, pn, t, hbPal.c, popped);
      c.restore();
    }
    pn.screen(c);
  }

  S_.alt = Object.assign({}, S_, {
    name: "Hasselback", pop: 1e9,   // (he never flies: the engine's POP takes him off the plate)
    start(g) {
      S_.start(g); pota = true; hbCap = null; hbPal = null; hbKeep = {};
      POP = 1e9; SHEATH0 = HB.SHEATH0; CLICK = HB.CLICK; FLOOD = MT.AFTER + 100;   // the click is in the splash; the colour floods back as the aftermath comes in
      FIN.cue.shing = true;   // (SHING sounds at the cut in the splash)
    },
    end() { pota = false; hbCap = null; hbPal = null; hbKeep = {}; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = hbDrawAfter;
      after.cam = lay.port ? (t) => { const vh = 120 * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: wx_(t) - FIN.dir * 34, wy: -0.4 * vh, vh }; }
        : (t) => ({ wx: wx_(t) - FIN.dir * HB_AW.sam, wy: HB_AW.wy, vh: HB_AW.vh });
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "t", paper: MG_PAPER, slide: MG.reduced ? 1 : 180,
        cam: () => { const Y = hbLay(); return { wx: FIN.lx + FIN.dir * Y.cx, wy: -Y.gy * Y.vh, vh: Y.vh }; },   // (still: the pictures it keeps stay where they were taken)
        draw: hbDrawSplash }));
      return ps;
    },
    words(lay) {
      const D = FIN.dir, port = lay.port, Y = hbLay(), ws = S_.words(lay).filter((w) => w.text !== "SHING");
      const at = (id, tt, wx, wy) => () => { const pn = MG.byId[id]; mgPlace(pn, tt); const q = pn.sp(wx, wy); return [q[0], q[1]]; };
      ws.push(
        { text: "?", t0: HIT + 60, t1: MT.SPLASH, size: port ? 0.05 : 0.1, rot: 0.12 * D, at: at("strike", HIT + 60, FIN.lx - D * 14, -L_().s.h - (port ? 30 : 22)) },
        { text: "click", t0: HB.CLICK, t1: HB.CLICK + 520, size: port ? 0.035 : 0.07, rot: -0.1 * D, jit: 0.1, at: at("splash", HB.CLICK, FIN.lx + D * (Y.wx + (port ? 12 : 22)), port ? -46 : -60) },
        { text: "phew", t0: HB.PHEW, t1: HB.SHING + 20, size: port ? 0.035 : 0.07, rot: 0.08 * D, jit: 0.12, at: at("splash", HB.PHEW, FIN.lx - D * (port ? 14 : 50), port ? -130 : -62) },
        { text: "SHING", t0: HB.SHING, t1: HB.HUSH + 40, size: port ? 0.085 : 0.2, arc: 12, rot: -TILT * D, fill: COL, stretch: { ang: -TILT * D, k: 0.4 },
          at: port ? at("splash", HB.SHING, FIN.lx + D * Y.cx, -168) : at("splash", HB.SHING, FIN.lx + D * 112, -100) },
        { text: "...", t0: HB.HUSH, t1: MT.AFTER + 60, size: port ? 0.06 : 0.12, space: 0.12, rot: -0.06 * D,
          at: port ? at("splash", HB.HUSH, FIN.lx + D * Y.cx, -168) : at("splash", HB.HUSH, FIN.lx + D * 112, -100) },
        { text: "fsss", t0: MT.AFTER + 320, t1: MT.POP, size: port ? 0.03 : 0.055, rot: -0.08 * D, jit: 0.15, at: at("after", MT.AFTER + 320, hbPX() + D * 10 * hbFS(), -44 * hbFS()) },
      );
      return ws;
    },
    food() {   // (wide: a low hop from the plate, so the loser and his weapon stay under the title band, into the open ground on the left)
      const x = hbPX() - FIN.dir * 4 * hbFS(), s = hbFS();
      return L.portrait ? { x, y: 0, r: 18 * s, y0: -16 * s, lx: x - FIN.dir * 24 } : { x, y: 0, r: 18, y0: 0, lx: x - FIN.dir * HB_AW.land };
    },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("hbQ", HIT + 60, () => Cin.go(() => Cin._osc("sine", 660, 900, 0.14, 0.05, 0.005)));
      cueOnce("hbSheath", HB.SHEATH0, () => Cin.go(() => Cin._noise(0.16, 0.12, 5200, 2200, "bandpass", 1.4)));
      cueOnce("hbPhew", HB.PHEW, () => Cin.go(() => Cin._noise(0.45, 0.06, 500, 1300, "bandpass", 1.2)));
      cueOnce("hbShing", HB.SHING, () => Cin.go(() => {   // the steel of One Cut's SHING, at last
        for (const [f, v, d] of [[2637, 0.1, 1.1], [3951, 0.07, 0.8], [5274, 0.045, 0.6], [7458, 0.025, 0.4]]) Cin._osc("sine", f, f * 0.997, d, v, 0.002, 0.03);
        Cin._noise(0.06, 0.4, 9000, 3500, "highpass", 0.7, 0.03);
      }));
      cueOnce("hbFan", HB.FAN0, () => Cin.go(() => { for (let i = 0; i < HB_N; i++) Cin._osc("triangle", 1800 + i * 90, 1500 + i * 80, 0.05, 0.035, 0.002, i * 0.025); Cin.whoosh(0.2, -0.3 * D, 0.3 * D, 0.2); }));
      cueOnce("hbSteam", MT.AFTER + 300, () => Cin.go(() => Cin._noise(0.9, 0.03, 3000, 5200, "highpass", 0.8)));
    },
  });
  /* ===================== the second Potatality, "Snake Eyes" (MANGA.samurai.alt2; design: Project files step8/fable-design-2.md §1.6) =====================
     One Cut to SHING (the hairline shows), but he does not come apart (no launch: pop 1e9): 3120 the blade flicks him up out of the strike panel.
     3250 the splash comes up from the foot: the loser high in the middle, flailing, under a lattice of sixteen brush cuts (3270-3390, SHA SHA SHA), the
     samurai below as a blur, two after-images of the blade sweeping up to him; 3460 the loser falls apart into nine cubes, each with black potato eyes for
     the pips of a die, and they land as a 3 x 3 stack, row by row (3540-3630, clack) while the samurai sheathes (click 3660). 3720 he sweeps them into his
     hand, shakes them four times (3800-4040, rattle) and throws them low: they roll along the ground, the two in front stop last (4245) on one and one, and
     the two pips are the loser's eyes: they blink (snake eyes; upright the pair is also shown big in a panel of its own across the top of the page). 4370 the
     smallest fist pump; a petal settles on a die (4630). 4700 in panel 4's place, One Cut's aftermath (the enso, the colour flooding from his hand): he kneels
     beside a wooden dice cup on its side, the cubes in and around its mouth, the two eyes in front, blinking. The engine's POP lifts the loser out of the
     cup's mouth (food()): the cup is left, two cubes still rolling to a stop.
     Helpers: snk. */
  const SNK = { LIFT: 3120, CUT0: 3270, CUT1: 3390, DICE: 3460, LAND: [3540, 3585, 3630], SH0: 3470, CLICK: 3660, SW0: 3720, SK0: 3800, SK1: 4040, STOP: 4245,
    BLINK: [4310, 4550], PUMP0: 4370, PUMP1: 4480, PET0: 4280, PET1: 4630 };
  // the pips of a die, 1-6 (face units: the corners at +-1)
  const SNK_PIP = [null, [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
  const SNK_STACK = [5, 2, 6, 3, 4, 2, 6, 1, 3];   // the faces on the stack, top row first (die m: row m / 3, column m % 3 counted along FIN.dir)
  // where each die stops after the throw: [along FIN.dir from the loser's spot, the ground under it (+ nearer), its size (x the die), its face, when it stops];
  // the last two are the pair in front, the snake eyes
  const SNK_END_W = [[66, -4, 0.85, 3, 4170], [104, -5, 0.8, 5, 4185], [50, -7, 0.8, 6, 4165], [128, -4, 0.8, 2, 4200], [84, -3, 0.85, 4, 4190], [150, -6, 0.75, 2, 4210],
    [-2, -5, 0.8, 6, 4180], [13, 6, 1.6, 1, 4245], [38, 6, 1.6, 1, 4235]];
  const SNK_END_U = [[31, -6, 0.75, 3, 4170], [37, -2, 0.75, 5, 4185], [17, -7, 0.75, 6, 4165], [-3, -4, 0.75, 2, 4200], [42, -9, 0.7, 4, 4190], [24, -10, 0.7, 2, 4210],
    [8, -8, 0.7, 6, 4180], [4, 8, 1.35, 1, 4245], [24, 8, 1.35, 1, 4235]];
  // the aftermath: the dice about the cup [out from its mouth, the ground under it (+ nearer), size, turn, face, an eye], in food units; and the two left after POP
  const SNK_AFT = [[9, -3, 7.5, 0, 3], [9, -10.5, 7.5, 0.12, 2], [21, -4, 7.5, -0.1, 6], [32, -3, 7, 0.2, 4], [40, -5, 6.5, 0, 2], [1.5, -1, 8, 0.45, 5], [38, 3, 7, -0.25, 3],
    [12.5, 4, 11, 0, 1, 1], [26.5, 4, 11, 0, 1, 1]];
  const SNK_LEFT = [[4, 17, 2, 0], [7, 31, 6, -2]];
  const SNK_F = [[0, 0], [0, 0], [0, 0], [0, 0]], SNK_O = { x: 0, y: 0, s: 0, a: 0, f: 1 }, SNK_EYE = { b: 0, lx: 0, ly: 0 }, SNK_ARC = Array.from({ length: 13 }, () => [0, 0]);
  // the boxes the splash's puppets are drawn and greyed in (their own units about the feet; the samurai's reaches further in front, FIN.dir > 0 and < 0)
  const SNK_WBOX = [-64, -120, 72, 12], SNK_WBOXL = [-72, -120, 64, 12], SNK_LBOX = [-76, -132, 76, 14];
  let snkPal = null, snkCut = null, snkOrd = null, snkRel = null, snkHT = null;
  // the splash: the camera at the cut (vh0, wy0, cx0) and on the ground (vh1, wy1, cx1); the loser in the air (lx, ly: his feet, lsc); the samurai (wx, wy, wsc);
  // the dice (ds: their size, sx: the stack's middle); x along FIN.dir from the loser's spot
  const SNK_LAY_U = { vh0: 300, wy0: -100, vh1: 190, wy1: -72, cx0: -2, cx1: -6, lx: 6, ly: -78, lsc: 1.5, wx: -34, wy: 0, wsc: 1.15, ds: 13, sx: 14 };
  const SNK_LAY_W = { vh0: 210, wy0: -90, vh1: 128, wy1: -38, cx0: -10, cx1: 20, lx: 4, ly: -44, lsc: 1.4, wx: -66, wy: 0, wsc: 1, ds: 14, sx: 0 };
  const snkLay = () => (L.portrait ? SNK_LAY_U : SNK_LAY_W);
  const snkEnd = () => (L.portrait ? SNK_END_U : SNK_END_W);
  const snkLc = (Y, t) => [FIN.lx + FIN.dir * Y.lx, Y.ly - 10 * easeOut(fe(MT.SPLASH, SNK.DICE, t)) - L_().s.h * Y.lsc * 0.5];   // the middle of the loser in the air
  function snkPalettes() {
    const c = { flesh: HB_FLESH, side: "#d6ae58", skin: L_().pal.accent || col(L_().pal), wood: "#a9733f", band: "#5a3519", hole: "#2b1a0e" };
    const g = {};
    for (const k in c) g[k] = hbGrey(c[k]);
    snkPal = { c, g };
  }
  function snkCam(t) {
    const Y = snkLay(), k = MG.reduced ? (t >= SNK.DICE ? 1 : 0) : ease(fe(SNK.DICE + 20, SNK.LAND[0] + 40, t));
    return { wx: FIN.lx + FIN.dir * lerp(Y.cx0, Y.cx1, k), wy: lerp(Y.wy0, Y.wy1, k), vh: lerp(Y.vh0, Y.vh1, k) };
  }
  // his poses from the splash on (his own units; the splash draws him at Y.wsc), and the loser's in the air
  function snkPoseW(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor, rest = [w * 0.62, -leg - tor * 0.36], restB = [-w * 0.2, -leg - tor * 0.34], up = [w * 0.6, -leg - tor * 1.0], upB = [w * 0.3, -leg - tor * 0.92];
    P.exK = 1;
    if (t >= MT.AFTER) {   // the aftermath: kneeling by the cup, hands on his thighs, breathing
      const b = MG.reduced ? 0 : Math.sin((t - MT.AFTER) * 0.004);
      P.expr = "calm"; P.sheath = 1; P.holdAng = Math.PI - 0.14; P.crouch = 0.9; P.lean = 0.06 + 0.02 * b;
      return { hF: [w * 0.62, -leg * 0.62 + b * 0.6], hB: [w * 0.3, -leg * 0.6], fF: [w * 0.5, 0], fB: [-w * 0.55, 0] };
    }
    if (t < SNK.SH0) {   // the follow-through of sixteen cuts: the blade high, both hands on it
      P.sheath = 0; P.holdAng = -1.25; P.crouch = 0.3; P.lean = -0.06;
      return { hF: up, hB: upB, fF: [w * 0.6, 0], fB: [-w * 0.6, 0] };
    }
    if (t < SNK.CLICK + 60) {   // he sheathes it: the blade swings up and back over, home
      const q = ease(fe(SNK.SH0, SNK.CLICK, t));
      P.sheath = Math.max(0.001, q); P.holdAng = lerp(-1.25, -Math.PI - 0.14, q); P.crouch = lerp(0.3, 0.1, q); P.lean = -0.06 * (1 - q); P.expr = q > 0.9 ? "calm" : undefined;
      return { hF: lerp2(up, rest, q), hB: lerp2(upB, restB, q), fF: [w * lerp(0.6, 0.5, q), 0], fB: [-w * lerp(0.6, 0.42, q), 0] };
    }
    P.expr = "calm"; P.sheath = 1; P.holdAng = Math.PI - 0.14;
    const fF = [w * 0.5, 0], fB = [-w * 0.42, 0];
    if (t < SNK.SK0) {   // the sweep: he leans in, one hand out to the stack, and back
      const r = ease(fe(SNK.SW0 - 30, SNK.SW0 + 30, t)) * (1 - ease(fe(SNK.SW0 + 60, SNK.SK0, t)));
      P.crouch = 0.1 + 0.35 * r; P.lean = 0.3 * r;
      return { hF: lerp2(rest, [w * 1.15, -leg * 0.7], r), hB: restB, fF, fB };
    }
    const fist = [w * 1.0, -leg - tor * 0.95];
    if (t < SNK.SK1) {   // shaken four times in his fist, in front of his chest
      const y = -5 * Math.sin(TAU_ * 4 * fe(SNK.SK0, SNK.SK1, t)), r = ease(fe(SNK.SK0 - 40, SNK.SK0 + 30, t));
      P.crouch = 0.12; P.lean = 0.04;
      return { hF: [lerp(rest[0], fist[0], r), lerp(rest[1], fist[1], r) + y], hB: restB, fF, fB };
    }
    // the throw, low and forward, held while they roll, then back; the smallest fist pump
    const k1 = easeOut(fe(SNK.SK1, SNK.SK1 + 50, t)), k2 = ease(fe(SNK.STOP + 20, SNK.PUMP0 - 40, t)), th = k1 * (1 - k2);
    P.crouch = 0.12 + 0.22 * th; P.lean = 0.04 + 0.22 * th;
    const hF = lerp2(lerp2(fist, [w * 1.15, -leg * 0.8], k1), rest, k2);
    const kp = ease(fe(SNK.PUMP0 - 50, SNK.PUMP0, t)) * (1 - ease(fe(SNK.PUMP1, SNK.PUMP1 + 120, t)));
    if (kp > 0) return { hF: lerp2(hF, [w * 0.86, -leg - tor * 0.42 + 4 * Math.sin(Math.PI * fe(SNK.PUMP0, SNK.PUMP1, t))], kp), hB: restB, fF, fB };
    return { hF, hB: restB, fF, fB };
  }
  function snkPoseL(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor, a = MG.reduced ? 0 : t * 0.045;
    P.expr = "terror"; P.exK = 1; P.mouth = 1; P.lean = 0.12 * Math.sin(a * 0.5);
    return { hF: [w * 0.8, -leg - tor * 1.2 + 3 * Math.sin(a)], hB: [-w * 0.78, -leg - tor * 1.15 + 3 * Math.cos(a * 1.3)], fF: [w * 0.35, -leg * 0.25 + 2 * Math.sin(a * 1.1)], fB: [-w * 0.3, -leg * 0.1] };
  }
  // his front hand in the splash (world), at time t
  function snkHand(t, Y) {
    const W = W_(), s = Y.wsc, ox = W.x, oy = W.y, X = FIN.lx + FIN.dir * Y.wx;
    W.x = X; W.y = Y.wy;
    try { const a = bodyPt(W, t, "hF"); return [X + (a[0] - X) * s, Y.wy + (a[1] - Y.wy) * s]; }
    finally { W.x = ox; W.y = oy; }
  }
  // one die (world units; the panel's world transform is on): its middle, side s, turned a, face f, colours P; e: the pip is an eye ({ b: shut 0-1, lx, ly: its look })
  function snkDie(c, x, y, s, a, f, P, lw, e) {
    const h = s / 2, cs = Math.cos(a), sn = Math.sin(a), ex = s * 0.2, ey = -s * 0.17, F = SNK_F;
    for (let i = 0; i < 4; i++) { const u = i === 0 || i === 3 ? -h : h, v = i < 2 ? -h : h; F[i][0] = x + u * cs - v * sn; F[i][1] = y + u * sn + v * cs; }
    c.lineWidth = lw; c.lineJoin = "round"; c.strokeStyle = MG_INK;
    for (let i = 0; i < 4; i++) {   // the sides towards the depth (up and right): the skin on top
      const A = F[i], B = F[(i + 1) % 4], nx = B[1] - A[1], ny = A[0] - B[0];
      if (nx * ex + ny * ey <= 0) continue;
      c.fillStyle = ny < -0.5 * s ? P.skin : P.side;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(B[0] + ex, B[1] + ey); c.lineTo(A[0] + ex, A[1] + ey); c.closePath(); c.fill(); c.stroke();
    }
    c.fillStyle = P.flesh; c.beginPath(); c.moveTo(F[0][0], F[0][1]); for (let i = 1; i < 4; i++) c.lineTo(F[i][0], F[i][1]); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = MG_INK;
    if (e) {   // the eye: a big pip with a light in it and a lid line over it, shut to a curve
      const r = s * 0.19;
      c.lineWidth = lw * 0.9; c.lineCap = "round";
      if (e.b > 0.8) { c.beginPath(); c.arc(x, y - r * 0.9, r * 1.3, 0.22 * Math.PI, 0.78 * Math.PI); c.stroke(); return; }
      const ry = r * (1 - e.b);
      c.beginPath(); c.ellipse(x, y, r, Math.max(0.3, ry), 0, 0, TAU_); c.fill();
      c.beginPath(); c.arc(x, y + r * 1.2, r * 2.6, 1.3 * Math.PI, 1.7 * Math.PI); c.stroke();
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(x + e.lx * r * 0.38, y + (e.ly - 0.3) * ry * 0.7, r * 0.34, 0, TAU_); c.fill();
      return;
    }
    const pp = SNK_PIP[f], m = s * 0.27, r = s * 0.085;
    c.beginPath();
    for (let i = 0; i < pp.length; i++) { const u = pp[i][0], v = pp[i][1], px = x + (u * cs - v * sn) * m, py = y + (u * sn + v * cs) * m; c.moveTo(px + r * 1.12, py); c.ellipse(px, py, r * 1.12, r * 0.86, 0, 0, TAU_); }
    c.fill();
  }
  // the order the dice are drawn in: the stack from the bottom row, left to right on the screen; after the throw, the far ones first
  function snkOrders() {
    const D = FIN.dir, E = snkEnd(), s = [], r = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (const j of [2, 1, 0]) for (const i of D > 0 ? [0, 1, 2] : [2, 1, 0]) s.push(j * 3 + i);
    r.sort((a, b) => E[a][1] - E[b][1] || D * (E[a][0] - E[b][0]));
    snkOrd = { s, r };
  }
  // where die m is at t (into o, world); false while it is not drawn (before the cut, in his hands)
  function snkDieAt(m, t, Y, o) {
    const D = FIN.dir, X0 = FIN.lx, ds = Y.ds, i = m % 3, j = (m / 3) | 0, sw0 = SNK.SW0 + 10 + m * 7, sw1 = sw0 + 55, tl = SNK.SK1 + m * 5;
    if (t < SNK.DICE) return false;
    const sx = X0 + D * (Y.sx + (i - 1) * ds), sy = -(2 - j) * ds - ds / 2;
    if (t < sw0) {   // the grid where he was, opening, falling into the stack row by row
      const lc = snkLc(Y, SNK.DICE), gap = 4 * easeOut(fe(SNK.DICE, SNK.DICE + 40, t)), lt = SNK.LAND[2 - j], k = fe(SNK.DICE + 40, lt, t);
      o.x = lerp(lc[0] + D * (i - 1) * (ds + gap), sx, ease(k)); o.y = lerp(lc[1] + (j - 1) * (ds + gap), sy, easeIn(k)) - 2.5 * Math.sin(Math.PI * fe(lt, lt + 80, t));
      o.s = ds; o.a = (m % 2 ? 0.22 : -0.18) * D * (1 - k); o.f = SNK_STACK[m];
      return true;
    }
    if (t < sw1) {   // swept into his hands
      const H = snkHT || snkHand(t, Y), k = easeIn(fe(sw0, sw1, t));
      o.x = lerp(sx, H[0], k); o.y = lerp(sy, H[1], k) - 14 * Math.sin(Math.PI * k); o.s = ds * (1 - 0.45 * k); o.a = D * 1.4 * k; o.f = SNK_STACK[m];
      return true;
    }
    if (t < tl) return false;
    if (!snkRel) snkRel = snkHand(SNK.SK1 + 10, Y);
    const E = snkEnd()[m], H = snkRel, ex = X0 + D * E[0], gx = lerp(H[0], ex, 0.3), tg = tl + 50, s = ds * E[2];
    if (t < tg) {   // out of his hands, a low arc to the ground
      const k = fe(tl, tg, t), sk = ds * lerp(0.55, E[2], k);
      o.x = lerp(H[0], gx, k); o.y = lerp(H[1], E[1] - sk / 2, k) - 12 * Math.sin(Math.PI * k); o.s = sk; o.a = D * k * Math.PI * 0.5; o.f = ((m * 5 + 1) % 6) + 1;
      return true;
    }
    // rolling along the ground, edge over edge, to a stop square on its face
    const n = Math.max(1, Math.round(Math.abs(ex - gx) / s)), v = fe(tg, E[4], t), q = easeOut(v), a = Math.PI * 0.5 * (1 + n * q);
    o.x = lerp(gx, ex, q); o.y = E[1] - (s / 2) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))); o.s = s; o.a = D * a;
    o.f = v >= 1 ? E[3] : ((m * 5 + Math.floor(a / (Math.PI * 0.5)) * 3) % 6) + 1;
    if (o.f === 1 && v < 1) o.f = 4;   // (no one shows before they stop)
    return true;
  }
  // the two pips in front are his eyes: they blink, look at the samurai, then at us
  function snkEye(t) {
    let b = 0;
    for (const bt of SNK.BLINK) { const k = fe(bt, bt + 120, t); if (k > 0 && k < 1) b = Math.sin(Math.PI * k); }
    const lk = t < SNK.PUMP0 + 60;
    SNK_EYE.b = b; SNK_EYE.lx = lk ? -FIN.dir : 0; SNK_EYE.ly = lk ? 0 : 0.3;
    return SNK_EYE;
  }
  // the lattice: sixteen brush cuts over him, crossing (nearly level / nearly upright in turn), drawn one after another in 120 ms
  function snkCuts(Y) {
    const r = mgRng(616), D = FIN.dir, C = snkLc(Y, SNK.CUT0 + 60), bw = L_().s.w * Y.lsc, bh = L_().s.h * Y.lsc, out = [], ord = [3, 6, 1, 4, 0, 7, 2, 5];
    for (let s = 0; s < 16; s++) {
      const v = s % 2, m = ord[s >> 1], an = v ? Math.PI / 2 + 0.24 * D + (r() - 0.5) * 0.14 : -0.16 * D + (r() - 0.5) * 0.14, o = ((m - 3.5) / 3.5) * (v ? bw * 0.62 : bh * 0.52) + (r() - 0.5) * 3;
      const ux = Math.cos(an), uy = Math.sin(an), len = (v ? bh : bw) * (1.1 + r() * 0.35) + 34, sg = r() < 0.5 ? 1 : -1, pts = [];
      for (let i = 0; i <= 10; i++) { const q = (i / 10 - 0.5) * len * sg; pts.push([C[0] - uy * o + ux * q, C[1] + ux * o + uy * q]); }
      out.push({ pts, t0: SNK.CUT0 + s * 7.5, w: L.portrait ? 3.2 : 4 });
    }
    return out;
  }
  function snkDrawCuts(c, pn, t) {
    const a = 1 - fe(SNK.DICE, SNK.DICE + 60, t);
    if (t < SNK.CUT0 || a <= 0) return;
    pn.world(c); c.globalAlpha = a;
    for (const st of snkCut) {
      const k = easeOut(fe(st.t0, st.t0 + 30, t));
      if (k <= 0) continue;
      const n = Math.max(1, Math.round(10 * k));
      c.fillStyle = MG_INK; brush(c, st.pts, st.w, n);
      c.fillStyle = "#ffffff"; brush(c, st.pts, st.w * 0.24, n);
    }
    c.globalAlpha = 1;
  }
  // the two after-images of the blade: wide arcs from his shoulder up to where the loser hangs (ink, the jade edge)
  function snkArcs(c, pn, t, Y) {
    const a = 0.7 * (1 - fe(SNK.CUT1 - 40, SNK.SH0 + 20, t));
    if (a <= 0.01) return;
    const D = FIN.dir, s = Y.wsc, cx = FIN.lx + D * (Y.wx + 8 * s), cy = Y.wy - 34 * s, pts = SNK_ARC;
    pn.world(c); c.globalAlpha = a;
    for (let g = 0; g < 2; g++) {
      const R = (g ? 60 : 82) * s, a0 = g ? 0.45 : 0.2, a1 = g ? -1.75 : -1.4;
      for (let i = 0; i <= 12; i++) { const th = a0 + (a1 - a0) * (i / 12); pts[i][0] = cx + D * Math.cos(th) * R; pts[i][1] = cy + Math.sin(th) * R; }
      c.globalAlpha = a * (g ? 0.55 : 1);
      c.fillStyle = MG_INK; brush(c, pts, 6.5 * s, 12);
      c.fillStyle = COL; brush(c, pts, 2.2 * s, 12);
    }
    c.globalAlpha = 1;
  }
  // the samurai in the splash (grey, jade), at his own spot and scale; a blur (two copies behind him) while the cuts are fresh; the click at his hand
  function snkSam(c, pn, t, Y) {
    const W = W_(), D = FIN.dir, s = Y.wsc, ox = W.x, oy = W.y, X = FIN.lx + D * Y.wx, ga = 1 - fe(SNK.CUT1, SNK.SH0, t);
    const pz = Object.assign(Object.create(pn), { world: (cc) => { pn.world(cc); cc.translate(X, Y.wy); cc.scale(s, s); cc.translate(-X, -Y.wy); } });   // jade() draws at his scale
    let hand = null, fist = null;
    W.x = X; W.y = Y.wy;
    try {
      mgPuppet(c, pn, W, t, { sc: s, light: topLight(), post: hbGreyBox, box: D > 0 ? SNK_WBOX : SNK_WBOXL, ghosts: ga > 0.01 && !MG.reduced ? [[-D * 9 * pn.z, 0, 0.45 * ga], [-D * 18 * pn.z, 0, 0.22 * ga]] : undefined });
      jade(c, pz, W, t, 1);
      const b = bladeTip(W, t); hand = pn.p(X + (b[0] - X) * s, Y.wy + (b[1] - Y.wy) * s);
      if (t >= SNK.PUMP0 && t < SNK.PUMP1 + 90) { const f = bodyPt(W, t, "hF"); fist = pn.p(X + (f[0] - X) * s, Y.wy + (f[1] - Y.wy) * s); }
    } finally { W.x = ox; W.y = oy; }
    pn.screen(c);
    if (fist) {   // the smallest fist pump: three short marks over the fist as it tugs down
      const m = Math.max(1, s * 0.85) * (L.portrait ? 1.2 : 1), k = fe(SNK.PUMP0 + 20, SNK.PUMP1 + 90, t);
      c.save(); c.globalAlpha = 1 - k * k; c.lineCap = "round"; c.beginPath();
      for (let i = 0; i < 3; i++) { const an = -0.5 * Math.PI + D * 0.35 + (i - 1) * 0.55, r0 = (16 + 4 * k) * m, r1 = (27 + 5 * k) * m; c.moveTo(fist[0] + Math.cos(an) * r0, fist[1] + Math.sin(an) * r0); c.lineTo(fist[0] + Math.cos(an) * r1, fist[1] + Math.sin(an) * r1); }
      c.strokeStyle = "#ffffff"; c.lineWidth = 5.6 * m; c.stroke(); c.strokeStyle = MG_INK; c.lineWidth = 2.6 * m; c.stroke();
      c.restore();
    }
    const ck = fe(SNK.CLICK, SNK.CLICK + 160, t);   // the click: short lines at his hand as the blade goes home
    if (ck > 0 && ck < 1) {
      const m = Math.max(1, s * 0.85);
      c.save(); c.globalAlpha = 1 - ck; c.lineCap = "round"; c.strokeStyle = MG_INK; c.lineWidth = 3.2 * m;
      for (let i = 0; i < 5; i++) { const an = -0.5 * Math.PI + (i - 2) * 0.55, r0 = (8 + 9 * ck) * m, r1 = (16 + 26 * ck) * m; c.beginPath(); c.moveTo(hand[0] + Math.cos(an) * r0, hand[1] + Math.sin(an) * r0); c.lineTo(hand[0] + Math.cos(an) * r1, hand[1] + Math.sin(an) * r1); c.stroke(); }
      c.restore();
    }
  }
  // the dice held in his cupped hands, rattling (short marks above and below while he shakes)
  function snkHeld(c, pn, t, Y, P, lw) {
    if (t < SNK.SW0 + 70 || t >= SNK.SK1 + 20) return;
    const H = snkHT, ds = Y.ds * 0.55, D = FIN.dir, sh = t >= SNK.SK0 && t < SNK.SK1;
    pn.world(c);
    for (let i = 0; i < 3; i++) snkDie(c, H[0] + D * (i - 1) * ds * 0.72, H[1] - ds * (0.45 + 0.35 * (i % 2)), ds, (sh ? Math.sin(t * 0.09 + i * 2) * 0.5 : 0.2) + i * 0.5, ((i * 2 + 2) % 6) + 1, P, lw * 0.8, null);
    if (!sh) return;
    pn.screen(c);
    const q = pn.p(H[0], H[1] - ds * 0.5), z = pn.z, u = ((t - SNK.SK0) % 60) / 60;
    c.save(); c.strokeStyle = MG_INK; c.lineWidth = Math.max(1.6, 0.7 * z); c.lineCap = "round"; c.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(u * Math.PI)); c.beginPath();
    for (const sg of [-1, 1]) for (let i = -1; i <= 1; i++) { const x = q[0] + i * ds * 0.75 * z, y0 = q[1] + sg * ds * 1.3 * z, y1 = y0 + sg * ds * (0.7 + 0.25 * (i & 1)) * z; c.moveTo(x, y0); c.lineTo(x + sg * i * 2, y1); }
    c.stroke(); c.restore();
  }
  // upright, the snake eyes again in a panel of their own across the empty top of the page: the two dice big, blinking, the petal settling on one
  const snkBox = (pn) => [pn.x0 + pn.w * 0.07, pn.y0 + pn.h * 0.13, pn.w * 0.86, pn.h * 0.28];
  function snkInset(c, pn, t) {
    const k = MG.reduced ? (t >= SNK.STOP + 10 ? 1 : 0) : easeOut(fe(SNK.STOP + 10, SNK.STOP + 130, t));
    if (k <= 0) return;
    const D = FIN.dir, B = snkBox(pn), x0 = B[0] + D * (1 - k) * (pn.w + 30), y0 = B[1], w = B[2], h = B[3], gy = y0 + h * 0.8, s = w * 0.29, P = snkPal.g;
    pn.screen(c);
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.fillStyle = MG_PAPER; c.fill(); c.clip();
    mgFocus(c, x0 + w / 2, gy - s * 0.6, Math.hypot(w, h) * 0.75, t * 0.0003, 0.4);
    samTone(c, pn, [[x0 - 2, gy], [x0 + w + 2, gy], [x0 + w + 2, y0 + h + 2], [x0 - 2, y0 + h + 2]], 6, 0.3, [t * 0.001, 0]);
    c.fillStyle = MG_INK; c.fillRect(x0 - 2, gy - 1.5, w + 4, 3);
    const e = snkEye(t), cx = x0 + w / 2 - s * 0.1, g = s * 0.12;
    for (const sg of [-1, 1]) snkDie(c, cx + sg * (s + g) / 2, gy - s / 2, s, 0, 1, P, 3, e);
    const pk = fe(SNK.PET0 + 40, SNK.PET1, t), m = 1 - pk;   // the petal, onto the die further from the samurai
    if (pk > 0) drawPetal(c, cx + D * (s + g) / 2 + D * (w * 0.32 * m + 10 * Math.sin(pk * 9) * m), gy - s - 4 - h * 0.75 * m, Math.max(6, s * 0.14), 0.25 * D + Math.sin(pk * 7) * 0.9 * m, pk >= 1 ? 0.45 : 0.35 + 0.65 * Math.abs(Math.cos(pk * 6)), false);
    c.restore();
    c.lineWidth = Math.max(3, MG.bw); c.strokeStyle = MG_INK; c.lineJoin = "round"; c.strokeRect(x0, y0, w, h);
  }
  // a petal drifting down onto the right-hand snake eye
  function snkPetal(c, pn, t, Y) {
    if (t < SNK.PET0 || L.portrait) return;
    const E = snkEnd()[8], D = FIN.dir, s = Y.ds * E[2], x1 = FIN.lx + D * (E[0] + s * 0.1), y1 = E[1] - s - 1.2, k = fe(SNK.PET0, SNK.PET1, t), m = 1 - k;
    const x = x1 + D * (34 * m + 7 * Math.sin(k * 9) * m), y = y1 - 82 * m * (L.portrait ? 1.3 : 1), q = pn.p(x, y);
    pn.screen(c);
    drawPetal(c, q[0], q[1], Math.max(4, s * 0.3 * pn.z), 0.25 * D + Math.sin(k * 7) * 0.9 * m, k >= 1 ? 0.45 : 0.35 + 0.65 * Math.abs(Math.cos(k * 6)), false);
  }
  // the strike as on One Cut, but from 3120 the loser rises out of the panel, flicked up by the blade (the hairline with him), speed lines under him
  function snkDrawStrike(c, pn, t) {
    const Lp = L_(), oy = Lp.y, k = easeOut(fe(SNK.LIFT, MT.SPLASH, t));
    Lp.y = oy - 110 * k;
    try { drawStrike(c, pn, t); } finally { Lp.y = oy; }
    if (k > 0.05 && !MG.reduced) { pn.screen(c); const q = pn.p(FIN.lx, -110 * k), g = pn.p(FIN.lx, 0)[1]; mgSpeed(c, q[0], (g + q[1]) / 2, g - q[1], Lp.s.w * pn.z * 1.5, -Math.PI / 2, -(t - SNK.LIFT) * 0.8, 0.6, false, 0.8); }
  }
  // the splash: plain paper, focus lines, the top band, the mist and the ground; the samurai below (a blur, the after-images of the blade), the loser in the
  // air under the lattice; then the nine dice: the stack, the sweep, the rattle, the roll, the snake eyes
  function snkDrawSplash(c, pn, t) {
    const Y = snkLay(), D = FIN.dir, P = snkPal.g, lw = Math.max(1.1, 2.4 / pn.z), lc = snkLc(Y, t), air = t < SNK.DICE;
    if (!snkCut) snkCut = snkCuts(Y);
    if (!snkOrd) snkOrders();
    snkHT = t >= SNK.SW0 - 40 && t < SNK.SK1 + 40 ? snkHand(t, Y) : null;
    pn.screen(c);
    const fc = air ? pn.p(lc[0], lc[1]) : pn.p(FIN.lx + D * (t < SNK.SK1 ? Y.sx : snkEnd()[7][0] + Y.ds * 0.7), -Y.ds), gy = pn.p(FIN.lx, 0)[1];
    mgFocus(c, fc[0], fc[1], Math.hypot(pn.w, pn.h) * 0.85, t * 0.0002, air ? 0.5 : 0.24);
    samTone(c, pn, [[pn.x0 - 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 + pn.h * 0.07], [pn.x0 - 4, pn.y0 + pn.h * 0.11]], 6, 0.7, [t * 0.001, 0]);
    samTone(c, pn, [[pn.x0 - 4, gy - pn.h * 0.12], [pn.x1 + 4, gy - pn.h * 0.15], [pn.x1 + 4, gy], [pn.x0 - 4, gy]], 7, 0.22, [t * 0.0007, 0]);
    ground(c, pn);
    if (air) {   // flicked up: speed lines under him, his grey puppet flailing
      const sa = 0.55 * (1 - fe(MT.SPLASH + 60, SNK.DICE - 40, t)), q = pn.p(lc[0], lc[1] + L_().s.h * Y.lsc * 0.3), g = pn.p(lc[0], 0)[1];
      if (sa > 0.01 && g > q[1] + 4) mgSpeed(c, q[0], (q[1] + g) / 2, g - q[1], L_().s.w * Y.lsc * pn.z * 1.7, -Math.PI / 2, -(t - MT.SPLASH) * 0.6, sa, false, 0.8);
      const Lp = L_(), ox = Lp.x, oy = Lp.y;
      Lp.x = lc[0]; Lp.y = lc[1] + L_().s.h * Y.lsc * 0.5;
      try { mgPuppet(c, pn, Lp, t, { sc: Y.lsc, light: loserLight(), post: hbGreyBox, box: Lp.spec.boss ? MG_BOSS_BOX : SNK_LBOX }); } finally { Lp.x = ox; Lp.y = oy; }
    }
    snkSam(c, pn, t, Y);
    snkArcs(c, pn, t, Y);
    if (air) snkDrawCuts(c, pn, t);
    else {
      // bits of the cut flying off as he falls apart
      const u = t - SNK.DICE;
      if (u < 200) {
        const k = easeOut(u / 200), lc0 = snkLc(Y, SNK.DICE);
        pn.world(c); c.fillStyle = MG_INK;
        for (let i = 0; i < 12; i++) { const an = i * 0.5236 + 0.3, d = (34 + (i % 3) * 16) * k, r = (1.8 + (i % 2)) * (1 - 0.7 * k); c.beginPath(); c.arc(lc0[0] + Math.cos(an) * d, lc0[1] + Math.sin(an) * d * 0.8, r, 0, TAU_); c.fill(); }
      }
      pn.world(c);
      const o = SNK_O;
      for (const m of t >= SNK.SK1 ? snkOrd.r : snkOrd.s) if (snkDieAt(m, t, Y, o)) snkDie(c, o.x, o.y, o.s, o.a, o.f, P, lw, m >= 7 && t >= snkEnd()[m][4] ? snkEye(t) : null);
      // a puff of dust as the bottom row lands
      const dk = fe(SNK.LAND[0], SNK.LAND[0] + 160, t);
      if (dk > 0 && dk < 1) {
        pn.screen(c); c.save(); c.strokeStyle = MG_INK; c.lineCap = "round"; c.lineWidth = Math.max(1.6, 0.8 * pn.z); c.globalAlpha = 1 - dk; c.beginPath();
        for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) { const b = pn.p(FIN.lx + D * (Y.sx + sg * (Y.ds * 1.6 + 3 + 6 * dk + i * 3)), -1 - i * 2.5); c.moveTo(b[0], b[1]); c.lineTo(b[0] + sg * D * (5 + 5 * dk) * pn.z * 0.5, b[1] - (2 + 3 * dk) * pn.z * 0.5); }
        c.stroke(); c.restore();
      }
      if (snkHT) snkHeld(c, pn, t, Y, P, lw);
      snkPetal(c, pn, t, Y);
      if (L.portrait) snkInset(c, pn, t);
    }
    pn.screen(c);
  }

  // the aftermath: the cup on its side (its bottom towards him, kneeling), its mouth away from him; the dice in and around it (food units: the cup's middle at 0)
  const snkFS = () => (L.portrait ? 1.1 : 1.6), snkSp = () => (L.portrait ? 0.75 : 1);   // the food's scale; how far the dice spread from the mouth
  const snkCX = () => FIN.lx + FIN.dir * (far() - (L.portrait ? 26 : 30) - 13 * snkFS());
  const snkMX = () => snkCX() - FIN.dir * 13 * snkFS();   // its mouth
  const SNK_EYEA = { b: 0, lx: 0, ly: 0 };
  function snkCup(c, pn, t, P, popped) {
    const D = FIN.dir, s = snkFS(), XC = snkCX(), XM = snkMX(), lw = Math.max(1.1, 2.6 / pn.z);
    pn.world(c);
    c.save(); c.translate(XC, 0); c.scale(D * s, s); c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = MG_INK; c.lineWidth = lw / s;
    c.fillStyle = P.wood; c.beginPath(); c.moveTo(-13, -22); c.lineTo(13, -22); c.ellipse(13, -11, 4.5, 11, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(-13, 0); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = (lw / s) * 0.6; c.beginPath(); c.moveTo(-9, -17); c.lineTo(10, -17.6); c.moveTo(-7, -6); c.lineTo(11, -5.4); c.stroke();   // the grain
    c.strokeStyle = P.band; c.lineWidth = 2.2;
    for (const bx of [-6, 6]) { c.beginPath(); c.ellipse(bx, -11, 4.5, 10.6, 0, -Math.PI / 2, Math.PI / 2); c.stroke(); }
    c.strokeStyle = MG_INK; c.lineWidth = lw / s;
    c.fillStyle = P.hole; c.beginPath(); c.ellipse(-13, -11, 4.8, 11, 0, 0, TAU_); c.fill(); c.stroke();
    c.lineWidth = (lw / s) * 0.6; c.beginPath(); c.ellipse(-13, -11, 3.3, 9.2, 0, 0, TAU_); c.stroke();
    c.restore();
    if (popped) {   // the two left, still rolling to a stop
      const k = easeOut(fe(MT.POP + 40, MT.POP + 160, t)), sz = 8 * s;
      for (const [u0, u1, f, v] of SNK_LEFT) {
        const dist = (u1 - u0) * s * snkSp(), n = Math.max(1, Math.round(dist / sz)), a = Math.PI * 0.5 * n * k;
        snkDie(c, XM - D * (u0 * s + dist * k), v * s - (sz / 2) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))), sz, -D * a, k >= 1 ? f : ((f + Math.floor(a / (Math.PI * 0.5))) % 6) + 1, P, lw, null);
      }
      return;
    }
    const cyc = (t - MT.AFTER - 300) % 1500, bl = t > MT.AFTER + 300 && cyc < 120 ? Math.sin(Math.PI * cyc / 120) : 0, lk = t < MT.AFTER + 900;
    SNK_EYEA.b = bl; SNK_EYEA.lx = lk ? D : 0; SNK_EYEA.ly = lk ? 0 : 0.3;
    const sp = snkSp(), ue = (d) => (d[5] ? d[0] - 12.5 * (1 - sp) : d[0] * sp);   // (upright they lie closer; the two eyes keep their spacing)
    for (const d of SNK_AFT) snkDie(c, XM - D * ue(d) * s, (d[1] - d[2] / 2) * s, d[2] * s, d[3] * D, d[4], P, lw, d[5] ? SNK_EYEA : null);
    const e = SNK_AFT[8], q = pn.p(XM - D * (ue(e) + 1) * s, (e[1] - e[2]) * s - 1.2);   // the petal, still on it
    c.save(); pn.screen(c); drawPetal(c, q[0], q[1], Math.max(3.5, e[2] * s * 0.3 * pn.z), 0.25 * D, 0.45, P === snkPal.c); c.restore();
  }
  // panel 4 of One Cut (the enso, him, the colour flooding from his hand) with the cup, grey until the flood reaches it
  function snkDrawAfter(c, pn, t) {
    drawAfter(c, pn, t);
    const fl = flood(t), popped = mgPopped(t);
    if (!fl.full) snkCup(c, pn, t, snkPal.g, popped);
    if (fl.r > 2) {
      c.save(); pn.screen(c); if (fl.r < 1e4) { c.beginPath(); c.arc(fl.x - pn.ox, fl.y - pn.oy, fl.r, 0, TAU_); c.clip(); }
      snkCup(c, pn, t, snkPal.c, popped);
      c.restore();
    }
    pn.screen(c);
  }

  S_.alt2 = Object.assign({}, S_, {
    name: "Snake Eyes", pop: 1e9,   // (he never flies: the engine's POP takes him out of the cup)
    start(g) {
      S_.start(g); pota2 = true; snkPal = null; snkCut = null; snkOrd = null; snkRel = null; snkHT = null;
      POP = 1e9; SHEATH0 = SNK.SH0; CLICK = SNK.CLICK; FLOOD = MT.AFTER + 100;   // the click is in the splash; the colour floods back as the aftermath comes in
      snkPalettes();
    },
    end() { pota2 = false; snkPal = null; snkCut = null; snkOrd = null; snkRel = null; snkHT = null; },
    step(t, k) { S_.step(t, k); if (t >= MT.AFTER) W_().facing = -FIN.dir; },   // (kneeling, he faces the cup)
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      strike.draw = snkDrawStrike;
      after.draw = snkDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 112 : 112) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: wx_(t) - FIN.dir * (lay.port ? 36 : 58), wy: -0.4 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", slide: MG.reduced ? 1 : 100, cam: snkCam, draw: snkDrawSplash,
        shake: (t) => { const a = t >= SNK.LAND[0] ? 2.5 * (1 - fe(SNK.LAND[0], SNK.LAND[0] + 120, t)) : 0; return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; } }));
      return ps;
    },
    pose(P, sk, t, role, p) {
      if (pota2 && role === "w" && t >= MT.SPLASH) return snkPoseW(P, sk, t);
      if (pota2 && role !== "w" && t >= SNK.LIFT) return snkPoseL(P, sk, t);
      return S_.pose(P, sk, t, role, p);
    },
    words(lay) {
      const D = FIN.dir, port = lay.port, Y = snkLay(), ws = S_.words(lay), sh = ws.find((w) => w.text === "SHING");
      if (sh) sh.t1 = MT.SPLASH + 100;   // (gone as the splash comes up)
      const at = (tt, wx, wy) => () => { const pn = MG.byId.splash; mgPlace(pn, tt); const q = pn.sp(wx(), wy()); return [q[0], q[1]]; };
      const SH = port ? [[-30, -66, 0.16], [30, -14, -0.12], [-24, 46, 0.1]] : [[-82, -40, 0.14], [80, -10, -0.12], [-60, 40, 0.08]];
      SH.forEach(([dx, dy, r], i) => ws.push({ text: "SHA", t0: SNK.CUT0 + 5 + i * 40, t1: SNK.DICE + 60 + i * 15, size: 0.15, mul: port ? 0.42 : 1, arc: 6, jag: 0.1, jit: 0.12, rot: r * D,
        at: at(SNK.DICE, () => snkLc(Y, SNK.CUT0)[0] + D * dx, () => snkLc(Y, SNK.CUT0)[1] + dy) }));
      ws.push(
        { text: "clack", t0: SNK.LAND[0], t1: SNK.SW0, size: 0.07, mul: port ? 0.6 : 1, jit: 0.15, rot: -0.08 * D,
          at: at(SNK.LAND[0] + 100, () => FIN.lx + D * (Y.sx + Y.ds * (port ? 1.2 : 2.6)), () => -Y.ds * (port ? 4.4 : 3.6)) },
        { text: "rattle", t0: SNK.SK0 + 20, t1: SNK.SK1 + 80, size: 0.065, mul: port ? 0.6 : 1, jit: 0.2, rot: 0.1 * D,
          at: at(SNK.SK0 + 100, () => FIN.lx + D * (Y.wx + (port ? 30 : 46)), () => port ? -100 : -78) },
        { text: "snake eyes", t0: SNK.STOP + 30, t1: MT.AFTER + 40, size: 0.08, mul: port ? 0.62 : 1, jit: 0.1, rot: -0.06 * D,
          at: port ? () => { const pn = MG.byId.splash; mgPlace(pn, SNK.STOP + 200); const B = snkBox(pn); return [B[0] + B[2] / 2 + pn.ox, B[1] + pn.oy + 4]; }
            : at(SNK.STOP + 100, () => FIN.lx + D * (snkEnd()[7][0] + snkEnd()[8][0]) / 2, () => -42) },
      );
      return ws;
    },
    food() {   // the cup's mouth
      const x = snkMX(), s = snkFS();
      return { x, y: 0, r: 20 * s, y0: -22 * s, lx: x - FIN.dir * (L.portrait ? 22 : 28) * s };
    },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("snkFlick", SNK.LIFT, () => Cin.go(() => Cin.whoosh(0.22, 0, 0, 0.25)));
      for (let i = 0; i < 4; i++) cueOnce("snkCut" + i, SNK.CUT0 + i * 30, () => Cin.go(() => Cin._noise(0.07, 0.3, 8600 - i * 700, 2600, "highpass", 0.7)));
      cueOnce("snkDice", SNK.DICE, () => Cin.go(() => { for (let i = 0; i < 5; i++) Cin._osc("triangle", 1900 + i * 140, 1200 + i * 120, 0.04, 0.03, 0.002, i * 0.012); }));
      SNK.LAND.forEach((lt, i) => cueOnce("snkLand" + i, lt, () => Cin.go(() => Cin.clack())));
      cueOnce("snkSweep", SNK.SW0, () => Cin.go(() => Cin.whoosh(0.16, 0.3 * D, -0.3 * D, 0.2)));
      for (let i = 0; i < 4; i++) cueOnce("snkShake" + i, SNK.SK0 + i * 60, () => Cin.go(() => { Cin.tick(2200 + (i % 2) * 500); Cin._noise(0.05, 0.12, 3800, 1800, "bandpass", 1.4); }));
      cueOnce("snkThrow", SNK.SK1, () => Cin.go(() => Cin.whoosh(0.14, -0.2 * D, 0.3 * D, 0.2)));
      for (let i = 0; i < 5; i++) cueOnce("snkRoll" + i, SNK.SK1 + 80 + i * 30, () => Cin.go(() => Cin.tick(1500 + i * 170)));
      cueOnce("snkStop", SNK.STOP, () => Cin.go(() => Cin.clack()));
      cueOnce("snkEyes", SNK.STOP + 60, () => Cin.go(() => Cin.pluck(1480)));
      cueOnce("snkPump", SNK.PUMP0 + 40, () => Cin.go(() => Cin.tick(900)));
      cueOnce("snkPetal", SNK.PET1, () => Cin.go(() => Cin._osc("sine", 2349, 2349, 0.5, 0.03, 0.01)));
    },
  });
  return S_;
})();
