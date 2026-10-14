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
   Both pages share their code: `ult` says which one is playing and setTimes() moves the few moments that differ. */
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
      if (!ult && t >= HIT) {
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
    start(g) { FIN.cue.drone = true; FIN.cue.taiko = true; setTimes(false); petals = []; snapC = null; half = null; flick = 0; floodAt = null; lines = slab = petalSpr = null; burst = []; },   // no drone (wind and petals only), no taiko (SHING is the hit)
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
        const q = ease(fe(SHEATH0, CLICK, t)), s = ease(fe(CLICK, ult ? MT.SPLASH + 400 : TURN + 300, t));   // sheathes, stands tall, turns away
        P.sheath = Math.max(0.001, q); P.holdAng = 0.1 + (Math.PI - 0.14 - 0.1) * q; P.crouch = 0.28 * (1 - s); P.lean = 0.2 * (1 - s);
        return { hF: [w * (0.95 - 0.33 * q), -leg - tor * (0.5 - 0.14 * q)], hB: [-w * 0.45 + w * 0.25 * s, -leg - tor * 0.32], fF: [w * (0.55 - 0.1 * s), 0], fB: [-w * (0.6 - 0.2 * s), 0] };
      }
      // the loser
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
  return S_;
})();
