/* ===================== Manga page: Odin, "Judgement" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Odin, Judgement"). Times are ms after the final hit.
   300 the freeze (panel 1, engine), snow from 800 . 1250 panel 2 "the look": the cape, the helmet, two ravens lift off and become twenty (a vortex round a
   column of light that drops onto the loser's spot, a rune ring under it), 2000 inset: the loser in the column freezes into a crystal, 2200 Gungnir
   flashes into his fist . 2350 panel 3 "the strike": the lunge with ghosts, 2780 the tip touches the ice and the cracks run (the hold, the drop),
   2900 the shatter (impact frames, ink shards), 2990 the loser is launched stiff as a statue and the ravens chase it out of the page
   3500 panel 4: the spear rests on his shoulder, the ravens land on it, one slow nod.
   Page-level things (snow, ravens, the column over the first page, shards, dust) are drawn in over(), which the engine puts above all panels.
   Script fields: col, name, flight, panels(lay), words(lay), build(lay), step(t, k), pose(P, sk, t, role, p), over(o, t), cues(t), drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt(). */
MANGA.odin = (function () {
  const COL = "#8fd8ff", DEEP = "#3f8fc8", SNOW = "#fbfaf6", RAV = "#15131c", FIST = "#9b9796";
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const T_RING = 1700, T_COL = 1760, T_SPEAR = 2200, TOUCH = 2780, FROZE = 2330, LAND = 3760, T_BACK = 3300;
  const SP_BUTT = 60, SP_TIP = 70;      // Gungnir: world units behind and in front of the grip
  const LUNGE0 = -44, LUNGE1 = -14;     // Odin's x in the strike panel from FIN.wx, towards the loser: the ready stance, the end of the thrust
  let snow = [], flock = [], shards = [], rubble = [], dust = [], cracks = [], LY = { xc: 0.66, tx: 0, port: false };
  const rnd = (seed) => mgRng(seed);
  const ink = MG_INK;

  /* ---------- where things are ---------- */
  function handPt(p, t, key, x) {   // a hand (a raw skeleton point: the hands are not turned with the lean) of puppet p standing at x
    MG.pt = t;
    const P = pose(p, mgTk(t));
    return [x + p.facing * P[key][0], p.y + P[key][1]];
  }
  function bodyPt(p, t, key, x) {   // a point of the leaning body (head, mouthPt, ...)
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot(P[key], P.hip, P.lean);
    return [x + p.facing * q[0], p.y + q[1]];
  }
  const lungeK = (t) => easeOut(fe(2580, 2770, t));
  const wxAt = (t) => (t < MT.STRIKE ? FIN.wx : FIN.wx + FIN.dir * (LUNGE0 + (LUNGE1 - LUNGE0) * lungeK(t)));
  const colX = () => LY.tx;
  function loserAt(tt) {   // the loser (feet, world) at page time tt
    if (tt < FIN.launch) return [FIN.lx - (tt >= FIN.hit ? FIN.dir * 5 : 0), 0];
    const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr];
  }
  const strikePn = () => MG.byId.strike;
  const loserScr = (tt) => { const q = loserAt(tt); return strikePn().sp(q[0], q[1] - 30); };

  /* ---------- panels ---------- */
  function panels(lay) {
    const port = lay.port, pg = lay.page, D = FIN.dir;
    const fxn = clamp(((D > 0 ? MG.ix : lay.gw - MG.ix) - pg.x) / pg.w, 0, 1);
    LY.port = port; LY.xc = port ? 0.74 : clamp(fxn, 0.6, 0.7);
    LY.tx = pg.x + (D > 0 ? LY.xc : 1 - LY.xc) * pg.w;
    return [
      { id: "look", t0: MT.LOOK, from: port ? "t" : "w", slide: 150, freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0], [1, 0], [1, 0.40], [0, 0.43]] : [[0, 0], [0.5, 0], [0.53, 1], [0, 1]],
        cam: (t) => { const u = ease(fe(MT.LOOK, MT.STRIKE, t)), vh = (port ? 104 : 112) - 8 * u; return { wx: FIN.wx - D * (port ? 4 : 6), wy: -(port ? 46 : 46) - 8 * u, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "l", slide: 140, live: true,
        poly: port ? [[0.52, 0.30], [0.98, 0.28], [0.98, 0.52], [0.5, 0.54]] : [[0.745, 0.04], [0.985, 0.03], [0.985, 0.5], [0.725, 0.53]],
        cam: (t) => ({ wx: L_().x, wy: -48, vh: 112 - 5 * fe(MT.INSET, MT.STRIKE, t) }),
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.AFTER, cover: MT.AFTER,
        poly: port ? [[0, 0.39], [1, 0.37], [1, 0.72], [0, 0.74]] : [[0, 0.30], [1, 0.36], [1, 1], [0, 1]],
        cam: (t, pn) => {
          const k = fe(MT.STRIKE, MT.AFTER, t), vh = (port ? 182 : 116) * (1 - 0.05 * k), z = pn.h / vh;
          return { wx: FIN.lx - (colX() - pn.cx) / z, wy: -0.34 * vh, vh };
        },
        shake: (t) => { const a = 4 * fe(MT.HIT, MT.HIT + 40, t) * (1 - fe(3300, 3500, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b", live: true,
        poly: port ? [[0, 0.68], [1, 0.66], [1, 1], [0, 1]] : [[0, 0.40], [0.66, 0.37], [0.62, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 124 : 112) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + FIN.dir * 4, wy: -0.46 * vh, vh }; },
        draw: drawAfter },
    ];
  }

  /* ---------- small shapes ---------- */
  // the slab as one flat ink shape with a rim of snow (white lumps with an ink edge); leaves the screen transform set
  function ground(c, pn) {
    pn.world(c);
    const x0 = FIN.wx - 420, x1 = FIN.wx + 420, lw = 2.4 / pn.z;
    c.fillStyle = ink; c.fillRect(x0, 4, x1 - x0, 140);
    c.beginPath(); c.moveTo(x0, 6);
    for (let x = x0; x < x1; x += 11) { const h = 3 + ((x * 7919) % 5) * 1.1, q = (x * 31 % 7) / 7; c.quadraticCurveTo(x + 5.5, -h - 3 - q * 2, x + 11, 2 + q); }
    c.lineTo(x1, 6); c.closePath(); c.fillStyle = SNOW; c.fill(); c.lineWidth = lw; c.strokeStyle = ink; c.stroke();
    pn.screen(c);
  }
  // a far range of jagged peaks on the horizon (tone with an ink ridge line) so the strike and the last page are not an empty cream field
  const PEAKS = [0, 0.5, 0.18, 0.82, 0.3, 0.58, 0.12, 0.7, 0.38, 0.95, 0.25, 0.62, 0.2, 0.5, 0];
  function peaks(c, pn, gy, hmax, shift) {
    const n = PEAKS.length - 1, pts = [[pn.x0 - 6, gy + 3]];
    for (let i = 0; i <= n; i++) pts.push([pn.x0 - 6 + ((pn.w + 12) * i) / n, gy - PEAKS[(i + shift) % PEAKS.length] * hmax]);
    pts.push([pn.x1 + 6, gy + 3]);
    c.save(); mgToneFill(c, pts, 7, 0.42, [0, 0]);
    c.strokeStyle = ink; c.lineWidth = 2.2; c.lineJoin = "miter"; c.beginPath(); pts.slice(1, -1).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.restore();
  }
  // a raven in profile (beak towards +x, mirrored by face): the near wing flaps (fl -1..1), a halo of paper keeps it readable on dark tone
  function raven(c, x, y, s, fl, face, perched) {
    c.save(); c.translate(x, y); c.scale(face * s, s); c.lineJoin = "round";
    for (const halo of [true, false]) {
      c.lineWidth = halo ? 0.4 : 0.15; c.strokeStyle = halo ? SNOW : ink; c.fillStyle = RAV;
      const paint = () => { if (!halo) c.fill(); c.stroke(); };
      c.beginPath(); c.moveTo(-0.8, 0.0); c.lineTo(-1.8, perched ? 0.8 : 0.35); c.lineTo(-1.45, perched ? 0.25 : -0.05); c.lineTo(-1.85, perched ? 0 : -0.4); c.lineTo(-0.7, -0.2); c.closePath(); paint();
      c.beginPath(); c.ellipse(0, 0, 1.05, 0.62, -0.12, 0, 7); paint();
      c.beginPath(); c.arc(0.95, -0.52, 0.44, 0, 7); paint();
      c.beginPath(); c.moveTo(1.3, -0.68); c.lineTo(2.05, -0.42); c.lineTo(1.3, -0.3); c.closePath(); paint();
      if (!halo) {
        const ty = -1.6 * fl - 0.3;
        c.beginPath(); c.moveTo(-0.4, -0.25); c.quadraticCurveTo(-0.7, ty * 0.6, -1.25, ty); c.quadraticCurveTo(-0.6, ty * 0.45 + 0.2, 0.3, -0.05); c.closePath();
        c.fillStyle = "#34323f"; c.fill(); c.stroke();
      }
    }
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(1.08, -0.6, 0.13, 0, 7); c.fill();
    c.restore();
  }
  // a far-away bird in profile (beak towards +x before the face flip): body, head, beak, tail, one feathered wing; builds the path only (fl -1..1: wing down .. up)
  function birdPath(c, x, y, s, fl, face) {
    const ty = -0.1 - 1.9 * fl, m = (a, b) => ty * a + b;
    c.save(); c.translate(x, y); c.scale(face * s, s);
    c.beginPath();
    c.moveTo(2.15, -0.34); c.lineTo(1.35, -0.7); c.quadraticCurveTo(0.85, -0.62, 0.55, -0.3);   // beak, head, neck
    c.lineTo(0.15, -0.28); c.quadraticCurveTo(-0.2, m(0.5, -0.3), -0.95, ty);                    // the wing: shoulder out to the tip
    c.lineTo(-0.7, m(0.72, 0.15)); c.lineTo(-1.2, m(0.5, 0.3)); c.lineTo(-0.75, m(0.3, 0.3)); c.lineTo(-1.05, m(0.1, 0.4)); c.lineTo(-0.5, 0.0);  // the feather notches back to the body
    c.lineTo(-1.15, -0.1); c.lineTo(-2.1, 0.1); c.lineTo(-2.0, 0.42); c.lineTo(-1.1, 0.32);       // the tail
    c.quadraticCurveTo(-0.1, 0.8, 0.8, 0.3); c.lineTo(1.2, -0.12); c.lineTo(1.45, -0.28);          // belly, chest, throat
    c.closePath();
    c.restore();
  }
  // Gungnir: grip (gx, gy) in px, direction `a` (screen angle of grip -> tip), z px per world unit. Butt SP_BUTT behind the grip, tip SP_TIP in front.
  function spear(c, gx, gy, a, z, alpha) {
    c.save(); c.globalAlpha = alpha === undefined ? 1 : alpha; c.translate(gx, gy); c.rotate(a); c.lineJoin = "miter";
    const th = Math.max(2.4, 1.9 * z), bl = SP_BUTT, tl = SP_TIP;
    c.fillStyle = ink; c.fillRect(-bl * z, -th, (bl + tl - 14) * z, th * 2);
    for (const s0 of [6, 22, 38]) {   // the three ice bands
      c.fillStyle = COL; c.fillRect(s0 * z, -th, 8 * z, th * 2);
      c.strokeStyle = ink; c.lineWidth = Math.max(1, 0.5 * z); c.beginPath(); c.moveTo(s0 * z, -th); c.lineTo(s0 * z, th); c.moveTo((s0 + 8) * z, -th); c.lineTo((s0 + 8) * z, th); c.stroke();
    }
    c.fillStyle = ink; c.beginPath(); c.moveTo(-bl * z, -th * 1.4); c.lineTo(-(bl + 6) * z, 0); c.lineTo(-bl * z, th * 1.4); c.closePath(); c.fill();
    // the blade: a white leaf with an ink edge and an ice line, a guard under it
    const b0 = (tl - 17) * z, bwd = Math.max(5.5, 4.6 * z);
    c.fillStyle = SNOW; c.strokeStyle = ink; c.lineWidth = Math.max(1.8, 1 * z);
    c.beginPath(); c.moveTo(b0 - 2 * z, 0); c.quadraticCurveTo(b0 + 2 * z, -bwd, b0 + 8 * z, -bwd * 0.8); c.lineTo(tl * z + 9 * z, 0); c.lineTo(b0 + 8 * z, bwd * 0.8); c.quadraticCurveTo(b0 + 2 * z, bwd, b0 - 2 * z, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = COL; c.lineWidth = Math.max(1.2, 0.9 * z); c.beginPath(); c.moveTo(b0, 0); c.lineTo(tl * z + 5 * z, 0); c.stroke();
    c.fillStyle = ink; c.beginPath(); c.moveTo(b0 - 4 * z, -th * 2); c.lineTo(b0 + 1 * z, -th * 1.3); c.lineTo(b0 + 1 * z, th * 1.3); c.lineTo(b0 - 4 * z, th * 2); c.closePath(); c.fill();
    c.restore();
  }
  // the winner's spear at page time t (x: where he stands): grip in world units and the screen angle of grip -> tip; null while it is not there yet
  function spearAt(t, x) {
    if (t < T_SPEAR) return null;
    const D = FIN.dir, h = handPt(W_(), t, "hF", x);
    let a;
    if (t >= MT.AFTER) return { gx: h[0], gy: h[1], a: D > 0 ? Math.PI + 0.66 : -0.66 };   // over the shoulder: the tip points back and up
    if (t < 2580) a = -0.08; else if (t < TOUCH) a = -0.08 + 0.26 * easeOut(fe(2580, 2770, t)); else a = 0.18;
    return { gx: h[0], gy: h[1], a: D > 0 ? a : Math.PI - a };
  }
  const discPoly = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 6.2832) * r, cy + Math.sin((i / n) * 6.2832) * r]);

  /* ---------- state built at the freeze ---------- */
  function build(lay) {
    const r = rnd(1301), g = L.gw, h = L.gh, n = MG.slow ? 70 : 120;
    snow = Array.from({ length: n }, () => ({ x: r() * g, y: r() * h, v: 9 + r() * 16, s: 1.1 + r() * 2.2, ph: r() * 6.28 }));
    const q = rnd(404);
    flock = Array.from({ length: 20 }, (_, i) => ({ u0: q(), ph: q() * 6.28, sp: 0.8 + q() * 0.5, sz: 0.8 + q() * 0.5, fl: q() * 6.28, born: i < 2 ? 1400 : 1560 + (i - 2) * 22, rank: 0 }));
    flock.map((_, i) => i).sort(() => q() - 0.5).forEach((i, k) => { flock[i].rank = k; });
    // the cracks that run through the ice from where the tip touches it (world units from the contact point)
    const c = rnd(909); cracks = [];
    for (let i = 0; i < 8; i++) {
      const pts = [[0, 0]]; let x = 0, y = 0, a = (c() - 0.5) * 1.7; const n_ = 5 + ((c() * 3) | 0);
      for (let j = 0; j < n_; j++) { a += (c() - 0.5) * 1.1; const len = 7 + c() * 9; x += Math.cos(a) * len; y += Math.sin(a) * len * 1.25; pts.push([x, y]); }
      cracks.push(pts);
    }
    const s = rnd(77); shards = [];
    for (let i = 0; i < 40; i++) {
      const sx = (s() - 0.5) * 60, sy = -6 - s() * 66, ang = (s() - 0.5) * 1.3 - 0.1, sp = 90 + s() * 230;
      shards.push({ sx, sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 50, sz: 5 + s() * 11, rot: s() * 6.28, vr: (s() - 0.5) * 12, w: s() < 0.55 ? COL : SNOW, a1: s() * 1.2, a2: s() * 1.2 });
    }
    rubble = Array.from({ length: 9 }, (_, i) => ({ x: (i - 4) * 9 + (s() - 0.5) * 6, h: 5 + s() * 11, w: 4 + s() * 6, c: i % 2 ? COL : SNOW, lean: (s() - 0.5) * 6 }));
    dust = Array.from({ length: MG.slow ? 14 : 28 }, () => ({ d: s() * 0.35, ox: (s() - 0.5) * 30, oy: (s() - 0.5) * 30, r: 1.6 + s() * 2.6, w: s() < 0.5 }));
  }

  /* ---------- panel 2: the look ---------- */
  function drawCape(c, pn, t) {
    const D = FIN.dir, wx = FIN.wx, u = ease(fe(1250, 2050, t)), sw = (k) => Math.sin(t * 0.0042 + k) * (3 + 5 * u);
    const P = (a, b) => pn.p(wx + D * a, b);
    const pts = [[-12, -61], [-30, -64], [-52, -72 - 14 * u + sw(0)], [-78, -86 - 26 * u + sw(1)], [-110, -100 - 36 * u + sw(2)], [-150, -92 - 30 * u + sw(3)],
      [-152, -50 + sw(4)], [-146, -6], [-120, 5], [-80, 6], [-46, 5], [-30, 2], [-29, -14], [-33, -36], [-27, -53]].map(([a, b]) => P(a, b));
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    c.fillStyle = ink; c.fill();
    c.save(); c.clip();
    const [x0, y0] = P(-110, -30);
    mgToneFill(c, [[x0 - 260, y0 + 10], [x0 + 260, y0 - 40], [x0 + 260, y0 + 300], [x0 - 260, y0 + 300]], 6, 0.3, [t * 0.0006, 0]);
    c.fillStyle = SNOW;
    for (const [a0, b0, a1, b1, w] of [[-34, -60, -100, -68 - 14 * u, 2.4], [-31, -50, -118, -44 - 4 * u, 2.8], [-30, -34, -122, -12, 2.4], [-33, -22, -96, 3, 2]]) {
      const A = P(a0, b0), B = P(a1, b1 + sw(1) * 0.5), n = [-(B[1] - A[1]), B[0] - A[0]], nl = Math.hypot(n[0], n[1]) || 1, k = (w * pn.z) / nl;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0] + n[0] * k * 0.2, B[1] + n[1] * k * 0.2); c.lineTo(B[0] - n[0] * k * 0.2, B[1] - n[1] * k * 0.2); c.closePath(); c.globalAlpha = 0.92; c.fill(); c.globalAlpha = 1;
    }
    c.restore();
    c.strokeStyle = SNOW; c.lineWidth = Math.max(1.5, 0.5 * pn.z); c.beginPath();   // the rim light along the top edge
    for (let i = 0; i < 5; i++) { const [x, y] = pts[i]; i ? c.lineTo(x, y + 5) : c.moveTo(x, y + 5); }
    c.stroke();
    c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
  }
  function drawLook(c, pn, t) {
    const W = W_(), D = FIN.dir, x = FIN.wx;
    pn.screen(c);
    const [hx, hy] = pn.p(...bodyPt(W, t, "head", x));
    for (let i = 0; i < 3; i++) { const h = pn.h * (0.14 + 0.1 * i); mgToneFill(c, [[pn.x0, pn.y0], [pn.x1, pn.y0], [pn.x1, pn.y0 + h], [pn.x0, pn.y0 + h]], 8, 0.6 - 0.19 * i, [t * 0.0007, 0]); }
    mgSpeed(c, pn.cx, pn.cy + pn.h * 0.12, pn.w, pn.h * 0.4, 0, t * 0.9 * D, 0.28, false, 1.3);
    const mr = pn.h * 0.34, mx = hx + D * pn.w * 0.13, my = hy - pn.h * 0.05;   // the moon behind the helmet
    mgToneFill(c, discPoly(mx, my, mr * 1.1, 44), 8, 0.4, [-t * 0.0008, 0]);
    c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fillStyle = SNOW; c.fill(); c.lineWidth = 3.2; c.strokeStyle = ink; c.stroke();
    ground(c, pn);
    const sp = spearAt(t, x);
    if (sp) { const [gx, gy] = pn.p(sp.gx, sp.gy); spear(c, gx, gy, sp.a, pn.z, fe(T_SPEAR, T_SPEAR + 40, t)); }
    const ox = W.x; W.x = x;
    mgPuppet(c, pn, W, t, { light: dirAng(-0.5) });
    W.x = ox;
    pn.screen(c);
    drawCape(c, pn, t);
    if (t >= T_SPEAR && t < T_SPEAR + 150) {   // the flash that brings the spear
      const h = pn.p(...handPt(W, t, "hF", x)), k = fe(T_SPEAR, T_SPEAR + 150, t);
      mgStarburst(c, h[0], h[1], pn.h * 0.2 * easeOut(k) * (1 - 0.6 * k), t * 0.01);
    }
  }

  /* ---------- the crystal: the loser frozen in ice (world units from the loser's feet), shared by the strike panel and the impact frames ---------- */
  const SHELL = [[-33, 3], [-38, -16], [-35, -38], [-41, -55], [-30, -67], [-24, -70], [-27, -94], [-13, -79], [-6, -102], [4, -81], [15, -92], [19, -72], [30, -66], [39, -52], [36, -30], [41, -13], [34, 3]];
  const FACETS = [[0, 1, 15, 16], [1, 2, 14, 15], [2, 3, 4, 13, 14], [4, 5, 6, 7, 12, 13], [7, 8, 9, 10, 11, 12], [5, 6, 7], [9, 10, 11]];
  function crystal(c, map, t, z, sil, gk) {   // map(u, v) -> px; gk 0..1: how far the ice has climbed from his feet (jagged front)
    const P = SHELL.map(([u, v]) => map(u, v));
    c.save(); c.lineJoin = "miter";
    let front = null;
    if (!sil && gk < 1) {
      const yb = map(0, 8)[1], yt = map(0, -110)[1], lvl = yb + (yt - yb) * gk, xa = map(-60, 0)[0], xb = map(60, 0)[0], q = rnd(31), n = 10;
      front = [];
      for (let i = 0; i <= n; i++) front.push([xa + ((xb - xa) * i) / n, lvl + (i % 2 ? -1 : 1) * z * (1.5 + 4.5 * q())]);
      c.beginPath(); c.moveTo(xa, yb + 30 * z); front.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(xb, yb + 30 * z); c.closePath(); c.clip();
    }
    c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    if (sil) { c.fillStyle = sil; c.fill(); c.restore(); return; }
    c.fillStyle = "rgba(143,216,255,0.22)"; c.fill();
    c.save(); c.clip();
    FACETS.forEach((f, i) => {
      c.beginPath(); f.forEach((j, n) => { const [x, y] = P[j]; n ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
      c.fillStyle = i % 2 ? "rgba(255,255,255,0.3)" : "rgba(63,143,200,0.2)"; c.fill();
    });
    const g = ((t * 0.0011) % 3) - 0.4;   // a glint sweeps across now and then
    if (g > 0 && g < 1) { const a = map(-40 + 80 * g, -90), b = map(-40 + 80 * g - 30, 0); c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = Math.max(2, 0.9 * z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = Math.max(1.6, 0.7 * z); c.beginPath();
    for (const [a0, b0, a1, b1] of [[-30, -20, -14, -52], [6, -62, 22, -34], [-8, -90, 0, -64]]) { const A = map(a0, b0), B = map(a1, b1); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); }
    c.stroke();
    c.strokeStyle = ink; c.lineWidth = Math.max(2.4, 1.1 * z); c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    if (front) { c.save(); c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip(); c.beginPath(); front.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineWidth = Math.max(2.6, 1.2 * z); c.stroke(); c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = Math.max(1.2, 0.5 * z); c.stroke(); c.restore(); }
    c.restore();
  }
  // the cracks, growing from the contact point (cx, cy in px)
  function crackLines(c, cx, cy, z, k, dirx) {
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    for (const [col, lw, o] of [[ink, Math.max(2, 0.9 * z), 0], ["rgba(255,255,255,0.9)", Math.max(1, 0.35 * z), 1]]) {
      c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
      for (const pts of cracks) {
        const total = pts.length - 1, upto = k * total; c.moveTo(cx + o, cy - o);
        for (let i = 1; i <= total && i - 1 < upto; i++) { const f = Math.min(1, upto - (i - 1)), p0 = pts[i - 1], p1 = pts[i]; c.lineTo(cx + o + dirx * (p0[0] + (p1[0] - p0[0]) * f) * z, cy - o + (p0[1] + (p1[1] - p0[1]) * f) * z); }
      }
      c.stroke();
    }
    c.restore();
  }

  /* ---------- the inset: the whole loser in the column, ice climbing up him from the rune ring at his feet ---------- */
  function drawInset(c, pn, t) {
    const Lp = L_(), gk = ease(fe(2060, 2330, t)), z = pn.z;
    pn.screen(c);
    const half = pn.w * 0.36, x0 = pn.cx - half, x1 = pn.cx + half;   // the column behind him: paper white, ice edges, upward tone, rising motes
    c.fillStyle = SNOW; c.fillRect(x0, pn.y0 - 5, half * 2, pn.h + 10);
    for (const [a, b] of [[x0, x0 + half * 0.3], [x1 - half * 0.3, x1]]) mgToneFill(c, [[a, pn.y0 - 5], [b, pn.y0 - 5], [b, pn.y1 + 5], [a, pn.y1 + 5]], 7, 0.4, [0, -t * 0.03]);
    mgSpeed(c, pn.cx, pn.cy, half * 1.4, pn.h, Math.PI / 2, t * 0.3, 0.3, false, 1);
    c.strokeStyle = COL; c.lineWidth = 6; c.beginPath(); c.moveTo(x0, pn.y0 - 5); c.lineTo(x0, pn.y1 + 5); c.moveTo(x1, pn.y0 - 5); c.lineTo(x1, pn.y1 + 5); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 - 3.5, pn.y0 - 5); c.lineTo(x0 - 3.5, pn.y1 + 5); c.moveTo(x1 + 3.5, pn.y0 - 5); c.lineTo(x1 + 3.5, pn.y1 + 5); c.stroke();
    const r = rnd(66);
    for (let i = 0; i < 14; i++) { const px_ = x0 + 6 + r() * (half * 2 - 12), v = 30 + r() * 50, y = pn.y1 - (((t * v * 0.001) + r() * pn.h) % pn.h), s = 1.4 + r() * 2.2; c.fillStyle = r() < 0.5 ? COL : SNOW; c.beginPath(); c.arc(px_, y, s, 0, 7); c.fill(); c.lineWidth = 1; c.strokeStyle = ink; c.stroke(); }
    const feet = pn.p(Lp.x, Lp.y);
    ringShape(c, feet[0], feet[1] + 2, 44 * z, 1, t, z);
    // him: the pose stops at 2250 (the face stops breathing), the pupils shrink before that
    mgPuppet(c, pn, Lp, Math.min(t, 2250), { sc: 1, light: dirAng(-0.5), tint: 0.15 });
    pn.screen(c);
    if (gk > 0) crystal(c, (u, v) => [feet[0] + u * z, feet[1] + v * z], t, z, null, gk);
  }

  /* ---------- panel 3: the strike ---------- */
  function drawStrike(c, pn, t) {
    const W = W_(), D = FIN.dir, H0 = FIN.hit, z = pn.z;
    pn.screen(c);
    const k1 = fe(MT.STRIKE, H0, t);   // behind: tone creeping down from the top, ground mist, speed lines for the thrust, focus lines after the hit
    for (let i = 0; i < 3; i++) { const h = pn.h * (0.1 + 0.08 * i) * (0.3 + 0.7 * k1); mgToneFill(c, [[pn.x0, pn.y0], [pn.x1, pn.y0], [pn.x1, pn.y0 + h], [pn.x0, pn.y0 + h]], 7, 0.5 - 0.16 * i, [t * 0.0007, 0]); }
    const gy = pn.p(0, 0)[1];
    for (let i = 0; i < 3; i++) { const h = pn.h * (0.05 + 0.045 * i); mgToneFill(c, [[pn.x0, gy - h], [pn.x1, gy - h], [pn.x1, gy], [pn.x0, gy]], 7, 0.5 - 0.17 * i, [-t * 0.0008, 0]); }
    const tp = pn.p(FIN.lx - D * 34, -36);
    if (t >= H0) mgFocus(c, tp[0], tp[1], Math.hypot(pn.w, pn.h), t * 0.0006, 0.7 * (1 - 0.5 * fe(H0, 3300, t)));
    mgSpeed(c, pn.cx, pn.cy, pn.w, pn.h * 0.5, 0, -t * 0.5 * D, 0.4 * fe(2500, 2700, t) * (1 - fe(TOUCH, TOUCH + 30, t)), false, 1);
    peaks(c, pn, gy, pn.h * 0.2, 0);
    ground(c, pn);
    frost(c, pn, t);
    if (t < H0 + 200) { ring(c, pn, t); columnP3(c, pn, t); }
    if (t >= H0) rubbleFx(c, pn, t);
    // the winner: ghosts and a swept wedge during the thrust, then him and the spear; from the touch to the shatter everything is still
    const tw = Math.min(t, TOUCH);
    const drawW = (tt, a) => {
      const x = wxAt(tt), sp = spearAt(tt, x);
      if (sp) { const g = pn.p(sp.gx, sp.gy); spear(c, g[0], g[1], sp.a, z, a); }
      const ox = W.x; W.x = x; mgPuppet(c, pn, W, tt, { light: dirAng(-0.5), a }); W.x = ox; pn.screen(c);
    };
    if (t >= 2620 && t < TOUCH && !MG.slow) {
      drawW(tw - 60, 0.2); drawW(tw - 30, 0.38);
      const s0 = spearAt(tw, wxAt(tw)), sg = spearAt(tw - 60, wxAt(tw - 60));
      if (s0 && sg) {
        const tipOf = (s) => [s.gx + Math.cos(s.a) * SP_TIP, s.gy + Math.sin(s.a) * SP_TIP], t1 = pn.p(...tipOf(s0)), t0 = pn.p(...tipOf(sg)), g1 = pn.p(s0.gx, s0.gy), g0 = pn.p(sg.gx, sg.gy);
        c.save(); c.globalAlpha = 0.5; c.fillStyle = COL; mgPoly(c, [t1, t0, g0, g1]); c.fill(); c.restore();
      }
    }
    drawW(tw, 1);
    if (!MG.broke) drawLoserFn(c, pn, t);
    pn.screen(c);
    if (t >= TOUCH && t < H0) {   // the touch and the cracks
      const ct = pn.p(FIN.lx - D * 36, -36);
      crackLines(c, ct[0], ct[1], z, easeOut(fe(TOUCH, H0 - 10, t)), D);
    }
  }
  // frost spreading over the slab from the loser, spikes of ice with an ink edge
  function frost(c, pn, t) {
    const k = easeOut(fe(2050, 2700, t));
    if (k <= 0.02) return;
    pn.world(c);
    const r = rnd(12);
    c.lineWidth = 1.8 / pn.z; c.strokeStyle = ink; c.lineJoin = "miter";
    for (let i = -14; i <= 14; i++) {
      const dx = i * 7 + (r() - 0.5) * 3, reach = Math.abs(dx) / 98, h0 = 4 + r() * 12, lean = (r() - 0.5) * 2;
      if (reach > k) continue;
      const h = h0 * (1 - reach * 0.55) * Math.min(1, (k - reach) * 5 + 0.2), x = FIN.lx + dx;
      c.beginPath(); c.moveTo(x - 2.6, 0.6); c.lineTo(x + lean, -h); c.lineTo(x + 2.6, 0.6); c.closePath(); c.fillStyle = i % 2 ? COL : SNOW; c.fill(); c.stroke();
    }
    pn.screen(c);
  }
  function rubbleFx(c, pn, t) {   // ice rubble where the statue stood
    const k = easeOut(fe(FIN.hit, FIN.hit + 220, t));
    pn.world(c);
    c.lineWidth = 2 / pn.z; c.strokeStyle = ink; c.lineJoin = "miter";
    for (const b of rubble) {
      const x = FIN.lx + b.x * (0.4 + 0.6 * k), h = b.h * k;
      c.beginPath(); c.moveTo(x - b.w, 0.6); c.lineTo(x + b.lean, -h); c.lineTo(x + b.w, 0.6); c.closePath(); c.fillStyle = b.c; c.fill(); c.stroke();
    }
    pn.screen(c);
  }
  const RUNES = [[[0, -1, 0, 1], [0, -0.6, 0.7, -0.25, 0, 0.1]], [[0, -1, 0, 1], [0, -0.1, -0.7, -0.8], [0, -0.1, 0.7, -0.8]], [[0, -1, 0, 1], [-0.7, -0.3, 0, -1, 0.7, -0.3]], [[0, -1, 0, 1], [0, -0.45, 0.7, -0.95], [0, 0.15, 0.7, -0.35]],
    [[-0.6, 1, 0, -1, 0.6, 1], [-0.45, 0.2, 0.45, 0.2]], [[-0.6, -1, 0.6, 1], [0.6, -1, -0.6, 1]], [[0, -1, 0, 1], [0, -0.7, 0.6, -0.1, 0, 0.4]], [[-0.5, -1, 0.5, 0, -0.5, 1]], [[-0.5, -1, -0.5, 1], [0.5, -1, 0.5, 1], [-0.5, -0.3, 0.5, 0.3]], [[0, -1, 0, 1], [-0.5, -0.5, 0.5, 0.5]], [[0, -1, 0, 1]], [[-0.4, -1, -0.4, 0.1, 0.5, 1]]];
  // the rune ring: a flat ellipse, two ink lines with an ice band between, twelve ink runes; k 0..1 how far it has drawn itself
  const RING_Y = 0.3, RING_IN = 0.62;
  function ringShape(c, cx, cy, rx, k, t, z) {
    const ry = rx * RING_Y;
    c.save(); c.lineJoin = "round"; c.lineCap = "round";
    const lw = Math.max(2.4, 1.3 * z), rot = t * 0.0004;
    c.fillStyle = "rgba(143,216,255,0.62)";
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2 * k); c.ellipse(cx, cy, rx * RING_IN, ry * RING_IN, 0, Math.PI * 2 * k, 0, true); c.fill();
    c.strokeStyle = ink; c.lineWidth = lw;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2 * k); c.stroke();
    c.beginPath(); c.ellipse(cx, cy, rx * RING_IN, ry * RING_IN, 0, 0, Math.PI * 2 * k); c.stroke();
    const mid = (1 + RING_IN) / 2, sx = rx * 0.062, sy = ry * (1 - RING_IN) * 0.42;
    c.lineWidth = lw * 0.9; c.beginPath();
    for (let i = 0; i < 12; i++) {
      const q = (i + 0.5) / 12; if (q > k) break;
      const a = q * Math.PI * 2 + rot, x = cx + Math.cos(a) * rx * mid, y = cy + Math.sin(a) * ry * mid;
      for (const line of RUNES[i]) { c.moveTo(x + line[0] * sx, y + line[1] * sy); for (let j = 2; j < line.length; j += 2) c.lineTo(x + line[j] * sx, y + line[j + 1] * sy); }
    }
    c.stroke();
    c.restore();
  }
  function ring(c, pn, t) {
    const k = easeOut(fe(T_RING, T_RING + 380, t)), a = 1 - fe(2900, 3050, t);
    if (k <= 0.01 || a <= 0) return;
    const g = pn.p(FIN.lx, 0);
    c.save(); c.globalAlpha = a; ringShape(c, g[0], g[1] + 1, 62 * pn.z, k, t, pn.z); c.restore();
  }
  // the column of light: paper white, ice edges, tone that slides upward. Over the first page (page level) and behind the loser in the strike panel.
  function columnShape(c, x, half, y0, y1, t, a) {
    c.save(); c.globalAlpha = a;
    c.fillStyle = SNOW; c.fillRect(x - half, y0, half * 2, y1 - y0);
    for (const [p, q] of [[x - half, x - half * 0.62], [x + half * 0.62, x + half]]) mgToneFill(c, [[p, y0], [q, y0], [q, y1], [p, y1]], 7, 0.4, [0, -t * 0.03]);
    mgSpeed(c, x, (y0 + y1) / 2, half * 1.3, y1 - y0, Math.PI / 2, t * 0.3, 0.28, false, 1);
    c.strokeStyle = COL; c.lineWidth = 6; c.beginPath(); c.moveTo(x - half, y0); c.lineTo(x - half, y1); c.moveTo(x + half, y0); c.lineTo(x + half, y1); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x - half - 3.5, y0); c.lineTo(x - half - 3.5, y1); c.moveTo(x + half + 3.5, y0); c.lineTo(x + half + 3.5, y1); c.stroke();
    c.restore();
  }
  function columnP3(c, pn, t) { columnShape(c, pn.p(FIN.lx, 0)[0], 26 * pn.z, pn.y0 - 4, pn.p(FIN.lx, 0)[1], t, 1 - fe(2900, 3050, t)); }

  /* ---------- the loser: a crystal statue, then launched stiff along the real direction ---------- */
  function drawLoserFn(c, pn, t) {
    const Lp = L_();
    if (FIN.out || Lp.state === "gone") return;
    const fl = t >= FIN.launch, base = { sc: 1, light: dirAng(-0.5), tint: 0.18 };
    if (fl && !MG.slow) for (const dt of [70, 46, 23]) {   // three ghosts
      const [gx, gy] = loserAt(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
      mgPuppet(c, pn, Lp, FROZE, Object.assign({}, base, { a: 0.3 - dt * 0.003, wash: [COL, 0.5], tone: false }));
      Lp.x = ox; Lp.y = oy;
    }
    mgPuppet(c, pn, Lp, FROZE, Object.assign({}, base, { flash: Lp.flash > 0, post: (lc, X) => {
      lc.fillStyle = rgba(COL, fl ? 0.26 : 0.14); lc.fillRect(0, 0, MG.cw, MG.ch);
      lc.strokeStyle = "rgba(255,255,255,0.9)"; lc.lineWidth = Math.max(2, 0.9 * X.z); lc.beginPath(); lc.moveTo(X.sx - 20 * X.z, X.sy - 54 * X.z); lc.lineTo(X.sx - 6 * X.z, X.sy - 30 * X.z); lc.moveTo(X.sx + 4 * X.z, X.sy - 62 * X.z); lc.lineTo(X.sx + 20 * X.z, X.sy - 44 * X.z); lc.stroke();
    } }));
    if (t < FIN.hit) { const feet = pn.p(Lp.x, Lp.y); crystal(c, (u, v) => [feet[0] + u * pn.z, feet[1] + v * pn.z], t, pn.z); }
  }

  /* ---------- panel 4: the aftermath ---------- */
  function drawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir, x = FIN.wx + D * 4;
    pn.screen(c);
    const [fx, fy] = pn.p(...bodyPt(W, t, "head", x));
    mgToneFill(c, [[pn.x0, pn.y0], [pn.x1, pn.y0], [pn.x1, pn.y0 + pn.h * 0.3], [pn.x0, pn.y0 + pn.h * 0.3]], 8, 0.38, [t * 0.0006, 0]);
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.4);
    peaks(c, pn, pn.p(0, 0)[1], pn.h * 0.18, 5);
    ground(c, pn);
    const ox = W.x; W.x = x; mgPuppet(c, pn, W, t, { light: dirAng(-0.5) }); W.x = ox;
    pn.screen(c);
    const sp = spearAt(t, x);   // the spear over his shoulder, in front of him; the fist is drawn again over it
    if (sp) {
      const g = pn.p(sp.gx, sp.gy); spear(c, g[0], g[1], sp.a, pn.z, 1);
      c.fillStyle = FIST; c.strokeStyle = ink; c.lineWidth = Math.max(2.4, 1.1 * pn.z); c.beginPath(); c.arc(g[0], g[1], 5 * pn.z, 0, 7); c.fill(); c.stroke();
    }
  }

  /* ---------- the script ---------- */
  const S_ = {
    col: COL, name: "Judgement", flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "KAAAW" : heavy ? "DOOM" : "KRAK", D = FIN.dir;
      const P3 = () => MG.byId.strike, m = lay.port ? 0.4 : 1;   // word sizes are shares of the screen height: scaled down on the upright phone
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.24, mul: m, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        { text: "CAW CAW", t0: 1520, t1: 2250, size: 0.075, mul: m, jit: 0.16, rot: -0.08 * D, at: () => [colX() + D * L.gw * 0.14, MG.page.y + L.gh * 0.16] },
        { text: "VMMMM", t0: 1800, t1: 2330, size: 0.1, mul: m, rot: -Math.PI / 2 * D, stretch: { ang: 0, k: 0.5 }, at: () => [colX() - D * 2, MG.page.y + MG.page.h * 0.34] },
        { text: "krk krk", t0: TOUCH + 10, t1: 2960, size: 0.06, mul: m, jit: 0.2, rot: 0.1 * D, at: () => { const q = P3().sp(FIN.lx - D * 20, -110); return [q[0], q[1]]; } },
        { text: "KRASSHH", t0: FIN.hit, t1: 3560, size: 0.22, mul: m, arc: 9, rot: -0.07 * D, at: () => { const p = P3(); return [p.cx + D * p.w * 0.02, p.y0 + p.h * 0.2 + p.oy]; } },
      ];
    },
    build,
    step(t) {
      const W = W_();
      W._ravenOut = t >= MT.LOOK;   // the page draws his ravens
      if (t >= MT.STRIKE) W.x = wxAt(t);
      MG.pt = t;
    },
    pose(P, sk, t, role) {
      const w = sk.w, leg = sk.leg, tor = sk.tor;
      if (role === "w") {
        let hF = [w * 0.72, -leg - tor * 0.42], hB = [-w * 0.62, -leg - tor * 0.42], lean = 0, fF;
        if (t >= 2100) {
          const up = ease(fe(2100, 2330, t));
          hF = [w * 0.72 + (w * 0.6 - w * 0.72) * up, -leg - tor * 0.42 + (-tor * 0.36) * up]; hB = [w * 0.4 + (-w * 0.62 - w * 0.4) * (1 - up), -leg - tor * 0.78]; lean = -0.12 * up;
        }
        if (t >= MT.STRIKE) {
          const k = lungeK(t);
          hF = [w * 0.6 + w * 0.32 * k, -leg - tor * 0.78 + tor * 0.16 * k]; hB = [w * 0.36 + w * 0.28 * k, hF[1] + 2];
          lean = -0.12 + 0.46 * k; fF = [w * 0.25 + w * 0.5 * k, 0];
        }
        if (t >= 3200 && t < MT.AFTER) lean *= 1 - 0.6 * ease(fe(3200, 3500, t));
        const nod = Math.sin(Math.PI * fe(4000, 4450, t));
        if (t >= MT.AFTER) { hF = [w * 0.56, -leg - tor * 0.66]; hB = [w * 0.4, -leg - tor * 0.66]; lean = 0.02 + 0.1 * nod; fF = undefined; }
        P.lean = lean;
        P.mouth = t >= 2700 && t < 3250 ? 1 : 0;
        P.expr = t >= MT.AFTER ? (nod > 0.12 ? "calm" : undefined) : t >= T_SPEAR && t < 3400 ? "rage" : undefined; P.exK = 1;
        return { hF, hB, fF };
      }
      // the loser: terror (pupils shrink between 2000 and 2250), then a statue with its hands up
      P.expr = "terror"; P.exK = fe(2000, 2250, t); P.lean = 0; P.mouth = 1;
      return { hF: [w * 0.62, -leg - tor * 0.95], hB: [-w * 0.52, -leg - tor * 0.9], fF: [w * 0.3, 0], fB: [-w * 0.25, 0] };
    },
    over(o, t) { odnOver(o, t); },
    drawLoser: drawLoserFn,
    hitPt() { return [FIN.lx - FIN.dir * 34, -36]; },
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_(), z = pn.z, x = wxAt(TOUCH), sp = spearAt(TOUCH, x);
      if (sp) { const g = pn.sp(sp.gx, sp.gy); spear(o, g[0], g[1], sp.a, z, 1); }
      const ox = W.x; W.x = x; mgPuppet(o, pn, W, TOUCH, { sc: 1, sil }); W.x = ox;
      mgPuppet(o, pn, Lp, FROZE, { sc: 1, sil });
      const feet = pn.sp(FIN.lx, 0); crystal(o, (u, v) => [feet[0] + u * z, feet[1] + v * z], t, z, sil);
    },
    cues(t) {
      const caw = (v, f) => Cin.go(() => { Cin._osc("sawtooth", f, f * 0.55, 0.16, 0.07 * v, 0.01); Cin._noise(0.14, 0.05 * v, 2400, 900, "bandpass", 1.5); });
      cueOnce("lift", 1400, () => Cin.go(() => Cin.whoosh(0.5, -0.6, 0.6, 0.4)));
      cueOnce("caw1", 1420, () => caw(1, 760));
      cueOnce("caw2", 1560, () => caw(0.8, 640));
      cueOnce("caw3", 1720, () => caw(0.7, 700));
      cueOnce("ring", T_RING, () => Cin.go(() => { Cin.chime(660); Cin.riser(0.45, 0.1); }));
      cueOnce("col", T_COL, () => Cin.go(() => { Cin.whoosh(0.25, 0, 0, 0.35); Cin.sub(110, 96, 0.9, 0.3); }));
      cueOnce("pluck", 2000, () => Cin.go(() => Cin.pluck(1480)));
      cueOnce("flute", 2050, () => Cin.go(() => Cin.flute(0.7)));
      cueOnce("freeze", 2150, () => Cin.go(() => { Cin.tick(3600); Cin.shimmer(1320, 0.8); }));
      cueOnce("freeze2", 2260, () => Cin.go(() => Cin.tick(4200)));
      cueOnce("spear", T_SPEAR, () => Cin.go(() => { Cin._noise(0.22, 0.4, 6000, 1500, "highpass"); Cin.chime(1760); }));
      cueOnce("thrust", 2600, () => Cin.go(() => Cin.whoosh(0.2, -0.5, 0.5, 0.5)));
      cueOnce("tip", TOUCH, () => Cin.go(() => Cin.clack()));
      cueOnce("cr1", TOUCH + 30, () => Cin.go(() => Cin.tick(2400)));
      cueOnce("cr2", TOUCH + 70, () => Cin.go(() => Cin.tick(2900)));
      cueOnce("cr3", TOUCH + 100, () => Cin.go(() => Cin.tick(3500)));
      cueOnce("shatter", FIN.hit + 10, () => Cin.go(() => { Cin.glass(); Cin.boom(0.5); }));
      cueOnce("go", FIN.launch, () => Cin.go(() => Cin.whoosh(0.35, -0.8, 0.8, 0.5)));
      cueOnce("cawA", 3030, () => caw(0.9, 720));
      cueOnce("cawB", 3150, () => caw(0.7, 600));
      cueOnce("back", 3480, () => Cin.go(() => Cin.whoosh(0.4, 0.6, -0.4, 0.3)));
      cueOnce("cawC", 3660, () => caw(0.5, 520));
      cueOnce("hm", 4050, () => Cin.go(() => Cin.sub(72, 48, 0.7, 0.5)));
    },
  };

  /* ---------- the layer over the page: snow, the vortex round the column, shards, ice dust, ravens ---------- */
  function snowFx(o, t) {
    if (t < 800 || t > MT.FADE) return;
    const a = fe(800, 1200, t), u = (t - Math.min(Math.max(t - 2900, 0), 200)) / 1000;   // the snow holds still for 200 ms at the shatter
    o.save(); o.globalAlpha = a;
    o.beginPath(); for (const d of snow) { const y = ((d.y + d.v * u) % L.gh + L.gh) % L.gh, x = d.x + Math.sin(u * 0.9 + d.ph) * 12 + d.v * 0.4 * u; o.moveTo(x + d.s, y); o.arc(x, y, d.s, 0, 7); }
    o.fillStyle = SNOW; o.fill(); o.lineWidth = 1; o.strokeStyle = "rgba(17,16,28,0.7)"; o.stroke();
    o.restore();
  }
  // the vortex round the column
  function funnel() {
    const pn = strikePn(), z = pn.z, g = pn.p(FIN.lx, 0), crown = pn.p(FIN.lx, -104), yTop = MG.page.y + 2;
    return { x: colX(), yTop, yBase: Math.max(yTop + 50, crown[1] + 6), rMin: 24 * z, rMax: LY.port ? MG.page.w * 0.34 : MG.page.w * 0.18, ringY: g[1] };
  }
  function orbit(b, t, F) {
    const h = 1 - ((b.u0 + t * 0.00017 * b.sp) % 1), R = F.rMin + (F.rMax - F.rMin) * Math.pow(h, 0.85), ph = b.ph + t * 0.0036 * (1.3 - 0.6 * h) * b.sp;
    return { x: F.x + Math.cos(ph) * R, y: F.yBase - (F.yBase - F.yTop) * h + Math.sin(ph) * R * 0.27, d: Math.sin(ph), a: Math.min(1, h * 8) * Math.min(1, (1 - h) * 6 + 0.25) };
  }
  // the two hero ravens perch on his shoulders at 1250; later on the spear (P4)
  function perchLook(i, t) {
    const W = W_(), D = FIN.dir; MG.pt = t;
    const P = pose(W, mgTk(t)), p = i ? [P.w * 0.3, P.top + P.ry * 0.4] : [-P.w * 0.38, P.top + P.ry * 0.62];
    return MG.byId.look.sp(FIN.wx + D * p[0], p[1]);
  }
  function perchSpear(i) {
    const D = FIN.dir, pn = MG.byId.after, x = FIN.wx + D * 4, sp = spearAt(MT.AFTER + 100, x), s = i ? 66 : 52, u = [Math.cos(sp.a), Math.sin(sp.a)];
    return pn.sp(sp.gx + u[0] * s, sp.gy + u[1] * s - 4);
  }
  function streamPt(b, i, t) {   // behind the loser along its flight (world path), off to the side by a wobble
    const d = 90 + b.rank * 26, q = loserScr(t - d), pr = loserScr(t - d - 20), lx = q[0] - pr[0], ly = q[1] - pr[1], ll = Math.hypot(lx, ly) || 1, off = Math.sin(i * 1.7 + t * 0.012) * (12 + b.rank);
    return [q[0] - (ly / ll) * off, q[1] + (lx / ll) * off];
  }
  // where bird i is at page time t, or null
  function birdAt(i, t, F) {
    const b = flock[i];
    let p;
    if (i < 2 && t < b.born) { const q = perchLook(i, t); return { x: q[0], y: q[1], d: 1, a: 1, perched: true }; }
    if (t < b.born) return null;
    const ob = orbit(b, t, F), lift = easeOut(fe(b.born, b.born + (i < 2 ? 520 : 380), t));
    let sx, sy;
    if (i < 2) { const q = perchLook(i, b.born); sx = q[0]; sy = q[1] - Math.sin(lift * Math.PI) * 60; }
    else { const h = birdAt(i & 1, b.born, F); sx = h ? h.x : F.x; sy = h ? h.y : F.yTop; }
    p = { x: sx + (ob.x - sx) * lift, y: sy + (ob.y - sy) * lift, d: ob.d, a: i < 2 ? 1 : lift * ob.a, perched: false };
    const ts = FIN.launch + b.rank * 8;
    if (t >= ts - 40) {   // the stream chases the loser out of the page
      const q = streamPt(b, i, t), k = ease(fe(ts - 40, ts + 300, t));
      p = { x: p.x + (q[0] - p.x) * k, y: p.y + (q[1] - p.y) * k, d: p.d, a: Math.max(p.a, k), perched: false };
    }
    if (i < 2 && t >= T_BACK) {   // the heroes come back and land on the spear
      const from = streamPt(b, i, T_BACK), to = perchSpear(i), k = ease(fe(T_BACK, LAND, t)), C = [MG.page.x + MG.page.w * 0.5, MG.page.y + MG.page.h * 0.1], m = 1 - k;
      p = { x: m * m * from[0] + 2 * m * k * C[0] + k * k * to[0], y: m * m * from[1] + 2 * m * k * C[1] + k * k * to[1], d: 1, a: 1, perched: t >= LAND, back: true, k };
    }
    return p;
  }
  function odnOver(o, t) {
    snowFx(o, t);
    const F = funnel(), pn3 = strikePn();
    if (t >= T_COL && t < 3200) {   // the column over the first page (above the strike panel once that has slid in)
      const k = easeIn(fe(T_COL, T_COL + 220, t)), a = 1 - fe(2900, 3050, t);
      o.save();
      if (t >= MT.STRIKE) { o.beginPath(); o.rect(0, 0, L.gw, L.gh); const q = pn3.poly; o.moveTo(q[0][0] + pn3.ox, q[0][1] + pn3.oy); for (let i = 1; i < q.length; i++) o.lineTo(q[i][0] + pn3.ox, q[i][1] + pn3.oy); o.closePath(); o.clip("evenodd"); }
      columnShape(o, F.x, 26 * pn3.z, MG.page.y - 2, MG.page.y + (F.ringY - MG.page.y) * k, t, a);
      o.restore();
    }
    if (t >= T_SPEAR && t < MT.STRIKE) {   // the blade of Gungnir breaks out of the second panel over the border
      const pn2 = MG.byId.look, sp = spearAt(t, FIN.wx);
      if (pn2 && sp) {
        const g = pn2.sp(sp.gx, sp.gy), q = pn2.poly;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.moveTo(q[0][0] + pn2.ox, q[0][1] + pn2.oy); for (let i = 1; i < q.length; i++) o.lineTo(q[i][0] + pn2.ox, q[i][1] + pn2.oy); o.closePath(); o.clip("evenodd");
        spear(o, g[0], g[1], sp.a, pn2.z, fe(T_SPEAR, T_SPEAR + 40, t) * (1 - fe(MT.STRIKE - 60, MT.STRIKE, t)));
        o.restore();
      }
    }
    if (t >= T_RING && t < MT.STRIKE) ringShape(o, F.x, F.ringY, 62 * pn3.z, easeOut(fe(T_RING, T_RING + 380, t)), t, pn3.z);
    if (t >= MT.LOOK && t < 3900) flockFx(o, t, F);
    if (t >= FIN.hit) shardFx(o, t);
    if (t > FIN.launch && t < FIN.launch + 420) {   // speed lines along the real launch direction
      const a = 1 - fe(FIN.launch + 200, FIN.launch + 420, t), q = loserScr(t), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
      o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
      mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - FIN.launch) * 1.4, 0.8 * a, false, 1);
      o.restore();
    }
  }
  function flockFx(o, t, F) {
    const items = [];
    for (let i = 0; i < flock.length; i++) { const p = birdAt(i, t, F); if (p) items.push([i, p]); }
    items.sort((a, b) => a[1].d - b[1].d);
    const fs = Math.max(9, Math.min(L.gw, L.gh) * 0.036);
    for (const [i, p] of items) {
      const b = flock[i], fl = Math.sin(t * 0.021 + b.fl), face = Math.cos(b.ph + t * 0.0036) > 0 ? -1 : 1, sc = fs * b.sz * (0.8 + 0.3 * p.d);
      o.save(); o.globalAlpha = clamp(p.a, 0, 1);
      if (p.perched || (i < 2 && (t < 1900 || p.back))) {
        const hero = Math.min(L.gw, L.gh) * 0.045, sz = p.back ? hero * (1 + 0.15 * (1 - p.k)) : hero;
        raven(o, p.x, p.y, sz, p.perched ? 0 : Math.sin(t * 0.024 + i) * (p.back ? 1 - 0.8 * fe(LAND - 200, LAND, t) : 1), p.back || p.perched ? FIN.dir : face, p.perched);
      } else {
        if (!MG.slow && t < FIN.hit && t > b.born + 450) {   // a short trail along the orbit
          const q1 = orbit(b, t - 26, F), q2 = orbit(b, t - 62, F);
          o.lineCap = "round"; o.beginPath(); o.moveTo(q2.x, q2.y); o.quadraticCurveTo(q1.x, q1.y, p.x, p.y);
          o.strokeStyle = SNOW; o.lineWidth = 3; o.globalAlpha *= 0.5; o.stroke(); o.strokeStyle = ink; o.lineWidth = 1.1; o.globalAlpha *= 1.7; o.stroke(); o.globalAlpha = clamp(p.a, 0, 1);
        }
        o.lineJoin = "round"; o.strokeStyle = SNOW; o.lineWidth = 2.8; birdPath(o, p.x, p.y, sc * 0.95, fl, face); o.stroke();
        o.fillStyle = RAV; birdPath(o, p.x, p.y, sc * 0.95, fl, face); o.fill();
      }
      o.restore();
    }
  }
  function shardFx(o, t) {
    const pn = strikePn(), z = pn.z, D = FIN.dir, tau = (t - FIN.hit) / 1000;
    if (tau < 0 || tau > 1.2) return;
    const o0 = pn.sp(FIN.lx, 0), a = 1 - fe(FIN.hit + 700, FIN.hit + 1200, t);
    o.save(); o.lineJoin = "miter"; o.lineWidth = 1.8; o.strokeStyle = ink;
    for (const s of shards) {
      const x = o0[0] + (s.sx + D * s.vx * tau) * z, y = o0[1] + (s.sy + s.vy * tau + 280 * tau * tau) * z, r = s.sz * z * 0.5 * (1 - 0.35 * tau), ang = s.rot + s.vr * tau;
      o.globalAlpha = a; o.fillStyle = s.w;
      o.beginPath(); o.moveTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r); o.lineTo(x + Math.cos(ang + 1.8 + s.a1) * r * 0.9, y + Math.sin(ang + 1.8 + s.a1) * r * 0.9); o.lineTo(x + Math.cos(ang - 1.4 - s.a2) * r * 0.5, y + Math.sin(ang - 1.4 - s.a2) * r * 0.5); o.closePath(); o.fill(); o.stroke();
    }
    o.restore();
    if (t > FIN.launch) {   // ice dust drifting in the loser's wake
      o.save(); o.strokeStyle = ink; o.lineWidth = 1;
      for (const d of dust) { const q = loserScr(Math.max(FIN.launch - 20, t - 40 - d.d * 700)); o.globalAlpha = Math.max(0, 1 - (t - FIN.launch) / 800) * 0.9; o.fillStyle = d.w ? SNOW : COL; o.beginPath(); o.arc(q[0] + d.ox, q[1] + d.oy, d.r * (1 + (t - FIN.launch) / 900), 0, 7); o.fill(); o.stroke(); }
      o.restore();
    }
  }
  return S_;
})();
