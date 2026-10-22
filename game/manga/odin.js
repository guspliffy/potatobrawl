/* ===================== Manga page: Odin, "Judgement" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Odin, Judgement"). Times are ms after the final hit.
   300 the freeze (panel 1, engine), snow from 800 . 1250 panel 2 "the look": the cape, the helmet, two ravens lift off and become twenty (a vortex round a
   column of light that drops onto the loser's spot, a rune ring under it), 2000 inset: the loser in the column freezes into a crystal, 2200 Gungnir
   flashes into his fist . 2350 panel 3 "the strike": the lunge with ghosts, 2780 the tip touches the ice and the cracks run (the hold, the drop),
   2900 the shatter (impact frames, ink shards), 2990 the loser is launched stiff as a statue and the ravens chase it out of the page
   3500 panel 4: the spear rests on his shoulder, the ravens land on it, one slow nod.
   Page-level things (snow, ravens, the column over the first page, shards, dust) are drawn in over(), which the engine puts above all panels.
   The Ultimate KO (Gungnir), "Ragnarök": MANGA.odin.ulti extends this script (design: Project files ultimates/manga/odin/fable-odin-ultimate.md; `ult` says
   which one plays). Judgement to the inset, but the flash at 2200 brings the golden Gungnir of the game (gold shaft, red wraps, three runes); 2350 the strike is a
   THROW (a wider shot, the wind-up, the swing at 2560, the spear flies low 2640-2780 and sticks in the statue, the shatter, the pop at 3050, the stuck spear turns
   round in the air 3110-3250); 3250 panel 5: him big with his hand open, 48 ravens dive and drag the night down until the page is black, 3400-3700 Gungnir flies
   back to his fist with the statue's shards in its wake, the catch, the shards fly on and land as RAGNARÖK in gold at 3900, the flock wheels off, his eye glints;
   4700 panel 4 as on Judgement (its moments are MT.AFTER + offset).
   Script fields: col, name, flight, panels(lay), words(lay), build(lay), step(t, k), pose(P, sk, t, role, p), over(o, t), cues(t), drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt().
   POTATALITY: "Frozen Fries" = MANGA.odin.alt (S_.alt, at the end; its helpers are prefixed fzf), played on a normal KO when it is on (ui/kopages.js).
   POTATALITY 2: "Smash Landing" = MANGA.odin.alt2 (S_.alt2, after it; its helpers are prefixed sml, `pota2` says it is playing), played when it is the one picked. */
MANGA.odin = (function () {
  const COL = "#8fd8ff", DEEP = "#3f8fc8", SNOW = "#fbfaf6", RAV = "#15131c", FIST = "#9b9796";
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const T_RING = 1700, T_COL = 1760, T_SPEAR = 2200, TOUCH = 2780, FROZE = 2330;
  const LAND = () => MT.AFTER + (ult ? 460 : 260), T_BACK = () => MT.AFTER - (ult ? 0 : 200);   // the hero ravens come back and land on the spear (3300 / 3760 on Judgement)
  const SP_BUTT = 60, SP_TIP = 70;      // Gungnir: world units behind and in front of the grip
  const LUNGE0 = -44, LUNGE1 = -14;     // Odin's x in the strike panel from FIN.wx, towards the loser: the ready stance, the end of the thrust
  let snow = [], flock = [], shards = [], rubble = [], dust = [], cracks = [], LY = { xc: 0.66, tx: 0, port: false };
  let ult = false, cutA = 1, rgB = [], rgT = null;   // ult: this play is the Ultimate page (set by start()); cutA: the strike's over-layer things fade under the splash
  let pota = false;   // pota: this play is the Potatality, Frozen Fries (set by its start): the strike's flock, shards and speed lines leave under its splash too
  let pota2 = false;  // pota2: this play is the second Potatality, Smash Landing (set by its start, which also sets pota for the same exit of the strike)
  // the Ultimate: the throw (wind-up, swing, release), the spear stuck in the statue (A_STUCK, TIP_IN units deep) and its turn; the splash's beats
  const T_WIND = 2500, T_SWING = 2560, T_THROW = 2640, T_TURN0 = 3110, T_TURN1 = 3250, A_STUCK = 0.08, TIP_IN = 34;
  const UT = { IN: 3250, BLACK: 3520, RET: 3400, CATCH: 3700, OFF: 3820, NAME: 3900, GLINT: 4200, OUT: 4300 };
  const GUNG = "#e2ad3c", WRAP = "#b3282d", NIGHT = "#0f0e14";
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
  const lungeK = (t) => easeOut(fe(2580, 2770, t)), throwK = (t) => easeOut(fe(T_SWING, T_THROW, t));
  // (the Ultimate's throw: he stands further back in a wider shot and steps 12 units into the swing)
  const wxAt = (t) => (t < MT.STRIKE ? FIN.wx : FIN.wx + FIN.dir * (ult ? (LY.port ? -88 : -98) + 12 * throwK(t) : LUNGE0 + (LUNGE1 - LUNGE0) * lungeK(t)));
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
          const k = fe(MT.STRIKE, MT.AFTER, t), vh = (port ? (ult ? 290 : 182) : (ult ? 150 : 116)) * (1 - 0.05 * k), z = pn.h / vh;
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
    if (ult && t >= MT.STRIKE && t < MT.AFTER) return rgSpearAt(t);
    const D = FIN.dir, h = handPt(W_(), t, "hF", x);
    let a;
    if (t >= MT.AFTER) return { gx: h[0], gy: h[1], a: D > 0 ? Math.PI + 0.66 : -0.66 };   // over the shoulder: the tip points back and up
    if (t < 2580) a = -0.08; else if (t < TOUCH) a = -0.08 + 0.26 * easeOut(fe(2580, 2770, t)); else a = 0.18;
    return { gx: h[0], gy: h[1], a: D > 0 ? a : Math.PI - a };
  }
  const drawSpear = (c, gx, gy, a, z, al, t) => (ult ? rgSpear(c, gx, gy, a, z, al, t) : spear(c, gx, gy, a, z, al));
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
    if (sp) { const [gx, gy] = pn.p(sp.gx, sp.gy); drawSpear(c, gx, gy, sp.a, pn.z, fe(T_SPEAR, T_SPEAR + 40, t), t); }
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
    if (ult) rgStrikeW(c, pn, t);
    // the winner: ghosts and a swept wedge during the thrust, then him and the spear; from the touch to the shatter everything is still
    const tw = Math.min(t, TOUCH);
    const drawW = (tt, a) => {
      const x = wxAt(tt), sp = spearAt(tt, x);
      if (sp) { const g = pn.p(sp.gx, sp.gy); spear(c, g[0], g[1], sp.a, z, a); }
      const ox = W.x; W.x = x; mgPuppet(c, pn, W, tt, { light: dirAng(-0.5), a }); W.x = ox; pn.screen(c);
    };
    if (!ult && t >= 2620 && t < TOUCH && !MG.slow) {
      drawW(tw - 60, 0.2); drawW(tw - 30, 0.38);
      const s0 = spearAt(tw, wxAt(tw)), sg = spearAt(tw - 60, wxAt(tw - 60));
      if (s0 && sg) {
        const tipOf = (s) => [s.gx + Math.cos(s.a) * SP_TIP, s.gy + Math.sin(s.a) * SP_TIP], t1 = pn.p(...tipOf(s0)), t0 = pn.p(...tipOf(sg)), g1 = pn.p(s0.gx, s0.gy), g0 = pn.p(sg.gx, sg.gy);
        c.save(); c.globalAlpha = 0.5; c.fillStyle = COL; mgPoly(c, [t1, t0, g0, g1]); c.fill(); c.restore();
      }
    }
    if (!ult) drawW(tw, 1);
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
      const g = pn.p(sp.gx, sp.gy); drawSpear(c, g[0], g[1], sp.a, pn.z, 1, t);
      c.fillStyle = FIST; c.strokeStyle = ink; c.lineWidth = Math.max(2.4, 1.1 * pn.z); c.beginPath(); c.arc(g[0], g[1], 5 * pn.z, 0, 7); c.fill(); c.stroke();
    }
  }

  /* ---------- the script ---------- */
  const S_ = {
    col: COL, name: "Judgement", flight: "strike",
    start() { ult = false; pota = false; pota2 = false; cutA = 1; },
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
        if (ult && t >= MT.STRIKE && t < MT.AFTER) return rgPose(P, sk, t);
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
        const nod = Math.sin(Math.PI * fe(MT.AFTER + 500, MT.AFTER + 950, t));
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
      const caw = odnCaw;
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
      if (!ult) cueOnce("thrust", 2600, () => Cin.go(() => Cin.whoosh(0.2, -0.5, 0.5, 0.5)));
      cueOnce("tip", TOUCH, () => Cin.go(() => Cin.clack()));
      cueOnce("cr1", TOUCH + 30, () => Cin.go(() => Cin.tick(2400)));
      cueOnce("cr2", TOUCH + 70, () => Cin.go(() => Cin.tick(2900)));
      cueOnce("cr3", TOUCH + 100, () => Cin.go(() => Cin.tick(3500)));
      cueOnce("shatter", FIN.hit + 10, () => Cin.go(() => { Cin.glass(); Cin.boom(0.5); }));
      cueOnce("go", FIN.launch, () => Cin.go(() => Cin.whoosh(0.35, -0.8, 0.8, 0.5)));
      cueOnce("cawA", 3030, () => caw(0.9, 720));
      cueOnce("cawB", 3150, () => caw(0.7, 600));
      cueOnce("back", MT.AFTER + (ult ? 180 : -20), () => Cin.go(() => Cin.whoosh(0.4, 0.6, -0.4, 0.3)));
      cueOnce("cawC", MT.AFTER + (ult ? 360 : 160), () => caw(0.5, 520));
      cueOnce("hm", MT.AFTER + 550, () => Cin.go(() => Cin.sub(72, 48, 0.7, 0.5)));
    },
  };

  const odnCaw = (v, f) => Cin.go(() => { Cin._osc("sawtooth", f, f * 0.55, 0.16, 0.07 * v, 0.01); Cin._noise(0.14, 0.05 * v, 2400, 900, "bandpass", 1.5); });

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
    if (i < 2 && t >= T_BACK()) {   // the heroes come back and land on the spear
      const from = streamPt(b, i, T_BACK()), to = perchSpear(i), k = ease(fe(T_BACK(), LAND(), t)), C = [MG.page.x + MG.page.w * 0.5, MG.page.y + MG.page.h * 0.1], m = 1 - k;
      p = { x: m * m * from[0] + 2 * m * k * C[0] + k * k * to[0], y: m * m * from[1] + 2 * m * k * C[1] + k * k * to[1], d: 1, a: 1, perched: t >= LAND(), back: true, k };
    }
    return p;
  }
  function odnOver(o, t) {
    snowFx(o, t);
    const F = funnel(), pn3 = strikePn();
    cutA = 1;
    if ((ult || pota) && t >= MT.SPLASH + 40) { if (ult && t >= MT.AFTER) flockFx(o, t, F, 2); return; }   // the splash covers the page: the snow over it, then (Ragnarök) the two heroes coming back to the spear
    if (ult || pota) cutA = 1 - fe(MT.SPLASH - 80, MT.SPLASH + 40, t);   // the strike's flock, shards and speed lines leave as the splash comes down
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
        drawSpear(o, g[0], g[1], sp.a, pn2.z, fe(T_SPEAR, T_SPEAR + 40, t) * (1 - fe(MT.STRIKE - 60, MT.STRIKE, t)), t);
        o.restore();
      }
    }
    if (t >= T_RING && t < MT.STRIKE) ringShape(o, F.x, F.ringY, 62 * pn3.z, easeOut(fe(T_RING, T_RING + 380, t)), t, pn3.z);
    if (t >= MT.LOOK && t < MT.AFTER + 400) flockFx(o, t, F);
    else if (t >= MT.AFTER + 400) flockFx(o, t, F, 2);   // the two heroes stay perched on the spear (they used to vanish 140 ms after landing)
    if (t >= FIN.hit) shardFx(o, t);
    if (t > FIN.launch && t < FIN.launch + 420) {   // speed lines along the real launch direction
      const a = 1 - fe(FIN.launch + 200, FIN.launch + 420, t), q = loserScr(t), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
      o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
      mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - FIN.launch) * 1.4, 0.8 * a * cutA, false, 1);
      o.restore();
    }
  }
  function flockFx(o, t, F, only) {   // only: draw just the first `only` birds (the two heroes)
    const items = [];
    for (let i = 0; i < (only || flock.length); i++) { const p = birdAt(i, t, F); if (p) items.push([i, p]); }
    items.sort((a, b) => a[1].d - b[1].d);
    const fs = Math.max(9, Math.min(L.gw, L.gh) * 0.036);
    for (const [i, p] of items) {
      const b = flock[i], fl = Math.sin(t * 0.021 + b.fl), face = Math.cos(b.ph + t * 0.0036) > 0 ? -1 : 1, sc = fs * b.sz * (0.8 + 0.3 * p.d);
      o.save(); o.globalAlpha = clamp(p.a, 0, 1) * cutA;
      if (p.perched || (i < 2 && (t < 1900 || p.back))) {
        const hero = Math.min(L.gw, L.gh) * 0.045, sz = p.back ? hero * (1 + 0.15 * (1 - p.k)) : hero;
        raven(o, p.x, p.y, sz, p.perched ? 0 : Math.sin(t * 0.024 + i) * (p.back ? 1 - 0.8 * fe(LAND() - 200, LAND(), t) : 1), p.back || p.perched ? FIN.dir : face, p.perched);
      } else {
        if (!MG.slow && t < FIN.hit && t > b.born + 450) {   // a short trail along the orbit
          const q1 = orbit(b, t - 26, F), q2 = orbit(b, t - 62, F);
          o.lineCap = "round"; o.beginPath(); o.moveTo(q2.x, q2.y); o.quadraticCurveTo(q1.x, q1.y, p.x, p.y);
          o.strokeStyle = SNOW; o.lineWidth = 3; o.globalAlpha *= 0.5; o.stroke(); o.strokeStyle = ink; o.lineWidth = 1.1; o.globalAlpha *= 1.7; o.stroke(); o.globalAlpha = clamp(p.a, 0, 1) * cutA;
        }
        o.lineJoin = "round"; o.strokeStyle = SNOW; o.lineWidth = 2.8; birdPath(o, p.x, p.y, sc * 0.95, fl, face); o.stroke();
        o.fillStyle = RAV; birdPath(o, p.x, p.y, sc * 0.95, fl, face); o.fill();
      }
      o.restore();
    }
  }
  // an ice shard: a ragged triangle of size r turned by ang (s: its own random cut)
  function shardTri(o, x, y, r, ang, s) {
    o.beginPath(); o.moveTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r); o.lineTo(x + Math.cos(ang + 1.8 + s.a1) * r * 0.9, y + Math.sin(ang + 1.8 + s.a1) * r * 0.9); o.lineTo(x + Math.cos(ang - 1.4 - s.a2) * r * 0.5, y + Math.sin(ang - 1.4 - s.a2) * r * 0.5); o.closePath();
  }
  function shardFx(o, t) {
    const pn = strikePn(), z = pn.z, D = FIN.dir, tau = (t - FIN.hit) / 1000;
    if (tau < 0 || tau > 1.2) return;
    const o0 = pn.sp(FIN.lx, 0), a = 1 - fe(FIN.hit + 700, FIN.hit + 1200, t);
    o.save(); o.lineJoin = "miter"; o.lineWidth = 1.8; o.strokeStyle = ink;
    for (const s of shards) {
      const x = o0[0] + (s.sx + D * s.vx * tau) * z, y = o0[1] + (s.sy + s.vy * tau + 280 * tau * tau) * z, r = s.sz * z * 0.5 * (1 - 0.35 * tau), ang = s.rot + s.vr * tau;
      o.globalAlpha = a * cutA; o.fillStyle = s.w;
      shardTri(o, x, y, r, ang, s); o.fill(); o.stroke();
    }
    o.restore();
    if (t > FIN.launch) {   // ice dust drifting in the loser's wake
      o.save(); o.strokeStyle = ink; o.lineWidth = 1;
      for (const d of dust) { const q = loserScr(Math.max(FIN.launch - 20, t - 40 - d.d * 700)); o.globalAlpha = Math.max(0, 1 - (t - FIN.launch) / 800) * 0.9 * cutA; o.fillStyle = d.w ? SNOW : COL; o.beginPath(); o.arc(q[0] + d.ox, q[1] + d.oy, d.r * (1 + (t - FIN.launch) / 900), 0, 7); o.fill(); o.stroke(); }
      o.restore();
    }
  }

  /* ===================== the Ultimate page, "Ragnarök" (MT is the Ultimate table while it plays: SPLASH 3250, AFTER 4700) ===================== */
  // the golden Gungnir: spear()'s geometry (butt SP_BUTT behind the grip, tip SP_TIP + 9 ahead) in the game's colours: a gold shaft, three red wraps, three runes,
  // the pale leaf blade. Its runes pulse while it flies (from the throw to just after the catch) and flare while it turns; sil: the whole spear in one colour.
  function rgSpear(c, gx, gy, a, z, alpha, t, sil) {
    const al = alpha === undefined ? 1 : alpha;
    if (al <= 0.01) return;
    c.save(); c.globalAlpha = al; c.translate(gx, gy); c.rotate(a); c.lineJoin = "miter";
    const th = Math.max(2.4, 1.9 * z), bl = SP_BUTT, tl = SP_TIP, b0 = (tl - 17) * z, bwd = Math.max(5.5, 4.6 * z), len = (bl + tl - 14) * z;
    const cap = () => { c.beginPath(); c.moveTo(-bl * z, -th * 1.4); c.lineTo(-(bl + 6) * z, 0); c.lineTo(-bl * z, th * 1.4); c.closePath(); };
    const leaf = () => { c.beginPath(); c.moveTo(b0 - 2 * z, 0); c.quadraticCurveTo(b0 + 2 * z, -bwd, b0 + 8 * z, -bwd * 0.8); c.lineTo(tl * z + 9 * z, 0); c.lineTo(b0 + 8 * z, bwd * 0.8); c.quadraticCurveTo(b0 + 2 * z, bwd, b0 - 2 * z, 0); c.closePath(); };
    const guard = () => { c.beginPath(); c.moveTo(b0 - 4 * z, -th * 2); c.lineTo(b0 + 1 * z, -th * 1.3); c.lineTo(b0 + 1 * z, th * 1.3); c.lineTo(b0 - 4 * z, th * 2); c.closePath(); };
    if (sil) { c.fillStyle = sil; c.fillRect(-bl * z, -th, len, th * 2); cap(); c.fill(); leaf(); c.fill(); guard(); c.fill(); c.restore(); return; }
    const live = t >= T_THROW && t < UT.CATCH + 300, flare = t >= T_TURN0 && t < T_TURN1 + 80;
    if (live || flare) {   // the tip shines: two flat gold discs
      c.fillStyle = MG_GOLD;
      for (const [r, k] of [[9, 0.18], [4.5, 0.4]]) { c.globalAlpha = al * k; c.beginPath(); c.arc((tl + 9) * z, 0, r * z, 0, 7); c.fill(); }
      c.globalAlpha = al;
    }
    const ins = Math.max(1.2, 0.6 * z), lw = Math.max(1, 0.5 * z);
    c.fillStyle = ink; c.fillRect(-bl * z, -th, len, th * 2);
    c.fillStyle = GUNG; c.fillRect(-bl * z + ins, -th + ins, len - 2 * ins, th * 2 - 2 * ins);
    c.fillStyle = "#fff3b0"; c.fillRect(-bl * z + ins, -th * 0.4 - 0.5, len - 2 * ins, 1);
    c.strokeStyle = ink; c.lineWidth = lw;
    for (const s0 of [6, 22, 38]) { c.fillStyle = WRAP; c.fillRect(s0 * z, -th, 8 * z, th * 2); c.beginPath(); c.moveTo(s0 * z, -th); c.lineTo(s0 * z, th); c.moveTo((s0 + 8) * z, -th); c.lineTo((s0 + 8) * z, th); c.stroke(); }
    c.fillStyle = ink; cap(); c.fill();
    c.fillStyle = GUNG; c.beginPath(); c.arc(-bl * z, 0, 2.6 * z, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "#f7ebb6"; c.lineWidth = Math.max(1.8, 1 * z); leaf(); c.fill(); c.stroke();
    c.strokeStyle = GUNG; c.lineWidth = Math.max(1.2, 0.9 * z); c.beginPath(); c.moveTo(b0, 0); c.lineTo(tl * z + 5 * z, 0); c.stroke();
    c.fillStyle = MG_GOLD_D; c.strokeStyle = ink; c.lineWidth = Math.max(1.2, 0.6 * z); guard(); c.fill(); c.stroke();
    for (let i = 0; i < 3; i++) {   // the three runes over the shaft (the game's rune shapes)
      c.globalAlpha = al * (flare ? 1 : live ? 0.45 + 0.5 * Math.sin(t * 0.012 + i * 1.9) ** 2 : 0.6);
      rune(c, (18 + 16 * i) * z, -th - 4 * z, 3.5 * z, i + 1, "#fff2b8", 1.3);
    }
    c.restore();
  }
  // the gold streak behind a flying spear (grip gx, gy and its screen angle a), from the butt back len px, with four sparks
  function rgStreak(c, gx, gy, a, len, z, t, al) {
    if (al <= 0.01) return;
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, bx = gx - ux * (SP_BUTT + 6) * z, by = gy - uy * (SP_BUTT + 6) * z;
    c.save(); c.globalAlpha = 0.55 * al; c.fillStyle = MG_GOLD;
    c.beginPath(); c.moveTo(bx + nx * 7 * z, by + ny * 7 * z); c.lineTo(bx - ux * len, by - uy * len); c.lineTo(bx - nx * 7 * z, by - ny * 7 * z); c.closePath(); c.fill();
    c.globalAlpha = 0.85 * al; c.fillStyle = MG_GOLD_PALE;
    c.beginPath(); c.moveTo(bx + nx * 2 * z, by + ny * 2 * z); c.lineTo(bx - ux * len * 0.6, by - uy * len * 0.6); c.lineTo(bx - nx * 2 * z, by - ny * 2 * z); c.closePath(); c.fill();
    if (!MG.slow) for (let i = 0; i < 4; i++) {
      const k = (t * 0.004 + i / 4) % 1, o = (i % 2 ? 3 : -3) * z;
      c.globalAlpha = al * (1 - k); star4(c, bx - ux * len * k + nx * o, by - uy * len * k + ny * o, 3.5 * z * (1 - 0.5 * k), i % 2 ? "#fff6d8" : "#ffd23f");
    }
    c.restore();
  }
  // a gold star-burst (mgStarburst in another colour)
  function rgBurst(c, x, y, R, rot, col) {
    const n = 14;
    c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? R * 0.42 : R * (0.85 + 0.15 * ((i * 7919) % 5) / 4), a = (i / (n * 2)) * Math.PI * 2; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(r, 0); }
    c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = Math.max(2, R * 0.04); c.lineJoin = "miter"; c.strokeStyle = ink; c.stroke(); c.restore();
  }

  /* ---------- the strike: the throw ---------- */
  const scrA = (a) => (FIN.dir > 0 ? a : Math.PI - a);   // an angle drawn for a winner on the left, as the screen angle
  // the spear once it sticks: the tip TIP_IN units into the statue's front face at chest height, the butt quivering until the shatter;
  // 3110-3250 it turns round about its middle and slides 20 units back towards him, ready to fly back
  function rgStuck(t) {
    const D = FIN.dir, a = A_STUCK + 0.035 * Math.sin(t * 0.08) * (1 - fe(TOUCH, FIN.hit, t)), u = [D * Math.cos(a), Math.sin(a)], reach = SP_TIP + 9;
    const tip = [FIN.lx - D * (36 - TIP_IN), -36];
    let g = [tip[0] - u[0] * reach, tip[1] - u[1] * reach], ang = a;
    if (t >= T_TURN0) {
      const k = ease(fe(T_TURN0, T_TURN1, t)), mid = 6.5, m = [g[0] + u[0] * mid - D * 20 * k, g[1] + u[1] * mid];
      ang = a + Math.PI * k;
      const v = [D * Math.cos(ang), Math.sin(ang)];
      g = [m[0] - v[0] * mid, m[1] - v[1] * mid];
    }
    return { gx: g[0], gy: g[1], a: scrA(ang) };
  }
  // the spear from the strike on (world units: grip, screen angle grip -> tip): in his hand for the wind-up and the swing, flying low from the release, then stuck
  function rgSpearAt(t) {
    const W = W_();
    if (t < T_THROW) {
      const h = handPt(W, t, "hF", wxAt(t)), a = t < T_SWING ? -0.08 - 0.12 * ease(fe(MT.STRIKE, T_WIND, t)) : -0.2 + 0.2 * throwK(t);
      return { gx: h[0], gy: h[1], a: scrA(a) };
    }
    if (t < TOUCH) {
      const h = handPt(W, T_THROW, "hF", wxAt(T_THROW)), s = rgStuck(TOUCH), k = fe(T_THROW, TOUCH, t);
      return { gx: h[0] + (s.gx - h[0]) * k, gy: h[1] + (s.gy - h[1]) * k, a: scrA(A_STUCK * k) };
    }
    return rgStuck(t);
  }
  // the strike panel's winner on the Ultimate page: the spear behind his fist while he holds it, in front of everything once it flies (three ghosts, the gold streak)
  function rgStrikeW(c, pn, t) {
    const W = W_(), z = pn.z, x = wxAt(t), sp = spearAt(t, x), held = t < T_THROW;
    if (sp && held) { const g = pn.p(sp.gx, sp.gy); rgSpear(c, g[0], g[1], sp.a, z, 1, t); }
    const ox = W.x; W.x = x; mgPuppet(c, pn, W, Math.min(t, UT.IN - 1), { light: dirAng(-0.5) }); W.x = ox;
    pn.screen(c);
    if (!sp || held) return;
    if (t < TOUCH + 120) { const s = spearAt(Math.min(t, TOUCH), x), g = pn.p(s.gx, s.gy); rgStreak(c, g[0], g[1], s.a, 90 * z, z, t, 1 - fe(TOUCH, TOUCH + 120, t)); }
    if (!MG.slow) for (const [dt, a] of [[60, 0.1], [40, 0.2], [20, 0.35]]) {
      const ts = t - dt;
      if (ts >= T_THROW && ts < TOUCH) { const s = spearAt(ts, x), g = pn.p(s.gx, s.gy); rgSpear(c, g[0], g[1], s.a, z, a, ts); }
    }
    const g = pn.p(sp.gx, sp.gy); rgSpear(c, g[0], g[1], sp.a, z, 1, t);
  }
  // his body from the strike to the aftermath: the wind-up (the spear hand back past the hip, the off hand pointing at the statue), the swing, the follow-through;
  // on the splash the arm out and the hand open for the spear, the recoil of the catch
  function rgPose(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor;
    P.expr = t < UT.OUT ? "rage" : undefined; P.exK = 1;
    if (t >= UT.IN) {
      const r = Math.sin(Math.PI * fe(UT.CATCH, UT.CATCH + 160, t));
      P.lean = 0.12 - 0.17 * r; P.mouth = t >= UT.CATCH && t < UT.NAME ? 1 : 0;
      return { hF: [w * (0.9 - 0.15 * r), -leg - tor * 0.6], hB: [-w * 0.5, -leg - tor * 0.38], fF: [w * 0.35, 0] };
    }
    const wk = ease(fe(MT.STRIKE, T_WIND, t)), tk = throwK(t);
    let hF = [w * 0.6 - w * 0.7 * wk, -leg - tor * 0.78 + tor * 0.28 * wk], lean = -0.12 - 0.02 * wk, fF;
    const hB = [w * 0.4 + w * 0.15 * wk, -leg - tor * 0.78 + tor * 0.18 * wk];
    if (t >= T_SWING) { hF = [-w * 0.1 + w * 1.05 * tk, -leg - tor * 0.5 - tor * 0.02 * tk]; lean = -0.14 + 0.44 * tk; fF = [w * 0.6 * tk, 0]; }
    if (t >= T_THROW) lean = 0.3 - 0.2 * ease(fe(FIN.hit, 3150, t));
    P.lean = lean; P.mouth = t >= T_SWING && t < 3100 ? 1 : 0;
    return { hF, hB, fF };
  }

  /* ---------- panel 5: the blackout, the return, the catch, the title ---------- */
  const rgP = (pn, ux, uy) => [pn.x0 + (FIN.dir > 0 ? ux : 1 - ux) * pn.w, pn.y0 + uy * pn.h];   // a point of the splash (shares, drawn for a winner on the left)
  function rgTitle() { const pg = MG.page; return [pg.x + (FIN.dir > 0 ? (LY.port ? 0.5 : 0.6) : (LY.port ? 0.5 : 0.4)) * pg.w, pg.y + 0.3 * pg.h]; }   // where RAGNARÖK lands (css px)
  const wakeLen = (pn) => (LY.port ? 0.3 * pn.h : 0.5 * pn.w);
  // the returning spear (panel px): along a quadratic from beyond the far edge, dipping low, up to his fist (k^1.6 over 3400-3700); its angle follows the path
  // (the tip leads); after the catch it swings up to rest behind his head. { g grip, a path angle, u, ang drawn angle, k, f fist }
  function rgRet(pn, t) {
    const port = LY.port, z = pn.z, f = pn.p(...handPt(W_(), Math.min(t, MT.AFTER - 1), "hF", FIN.wx));
    const p0 = rgP(pn, port ? 1.05 : 1.02, port ? 0.08 : 0.26), cp = rgP(pn, port ? 0.7 : 0.6, port ? 0.5 : 0.72);
    const d0 = Math.hypot(cp[0] - p0[0], cp[1] - p0[1]) || 1, back = (SP_TIP + 12) * z, P0 = [p0[0] - ((cp[0] - p0[0]) / d0) * back, p0[1] - ((cp[1] - p0[1]) / d0) * back];   // the whole spear starts outside
    const k = Math.pow(fe(UT.RET, UT.CATCH, t), 1.6), m = 1 - k;
    const g = [m * m * P0[0] + 2 * m * k * cp[0] + k * k * f[0], m * m * P0[1] + 2 * m * k * cp[1] + k * k * f[1]];
    const a = Math.atan2(m * (cp[1] - P0[1]) + k * (f[1] - cp[1]), m * (cp[0] - P0[0]) + k * (f[0] - cp[0]));
    let ang = a;
    if (t > UT.CATCH) { const rest = FIN.dir > 0 ? Math.PI + 0.5 : -0.5, d = Math.atan2(Math.sin(rest - a), Math.cos(rest - a)); ang = a + d * ease(fe(UT.CATCH + 60, UT.CATCH + 320, t)); }
    return { g, a, u: [Math.cos(a), Math.sin(a)], ang, k, f, P0 };
  }
  // shard i riding the wake of the returning spear R (px)
  function rgWake(i, R, z, len) {
    const s = shards[i], f = 0.15 + (0.85 * i) / (shards.length - 1), lat = s.sx * 0.35 * z, b = [R.g[0] - R.u[0] * (SP_BUTT + 6) * z, R.g[1] - R.u[1] * (SP_BUTT + 6) * z];
    return [b[0] - R.u[0] * len * f - R.u[1] * lat, b[1] - R.u[1] * len * f + R.u[0] * lat];
  }
  // where each shard lands on the title: a 10 x 4 grid over the word's box, jittered (made once, at the catch)
  function rgTargets(pn) {
    if (rgT) return rgT;
    const r = mgRng(515), [cx, cy] = rgTitle(), bw = pn.w * (LY.port ? 0.8 : 0.34), bh = pn.h * (LY.port ? 0.075 : 0.15);
    rgT = shards.map((_, i) => [cx - bw / 2 + ((i % 10) + 0.5 + (r() - 0.5) * 0.66) * (bw / 10), cy - bh / 2 + (((i / 10) | 0) % 4 + 0.5 + (r() - 0.5) * 0.66) * (bh / 4)]);
    return rgT;
  }
  // the night: a curtain the flock drags down from the top edge (a wobbling lower edge); reduced motion: it fades in
  function rgNight(c, pn, t) {
    const kc = ease(fe(UT.IN, UT.BLACK, t));
    if (kc <= 0) return;
    c.save(); c.fillStyle = NIGHT;
    if (MG.reduced) { c.globalAlpha = kc; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); }
    else {
      const edge = pn.y0 + 1.1 * pn.h * kc;
      c.beginPath(); c.moveTo(pn.x0 - 2, pn.y0 - 2); c.lineTo(pn.x1 + 2, pn.y0 - 2);
      for (let i = 12; i >= 0; i--) c.lineTo(pn.x0 - 2 + ((pn.w + 4) * i) / 12, edge + 0.04 * pn.h * Math.sin(i * 1.7 + t * 0.01) * (i % 2 ? 1 : -0.6));
      c.closePath(); c.fill();
    }
    c.restore();
  }
  // the flock: 48 ravens diving just ahead of the curtain's lower edge, wings fast; once the page is black they slide into a slow wide wheel (half seen), hold still
  // for the catch, then wheel off the top edge in three waves. Birds near the returning spear are pushed off its line.
  function rgFlock(c, pn, t, R) {
    const H = pn.h, Wd = pn.w, n = MG.slow ? 20 : rgB.length, kc = ease(fe(UT.IN, UT.BLACK, t)), edge = pn.y0 + 1.1 * H * kc;
    const tq = t < UT.CATCH ? t : t < UT.OFF ? UT.CATCH : t - (UT.OFF - UT.CATCH);   // (the flock's own clock stops for the catch)
    const F = { x: rgP(pn, 0.55, 0)[0], yTop: pn.y0 + 0.05 * H, yBase: pn.y0 + 0.95 * H, rMin: 0.3 * Wd, rMax: 0.5 * Wd };
    const wk = MG.reduced ? 1 : easeOut(fe(UT.BLACK, UT.BLACK + 180, t)), fs = 0.035 * H;
    let seg = null;
    if (R && !MG.slow && !MG.reduced && t < UT.CATCH) { const z = pn.z, b = [R.g[0] - R.u[0] * SP_BUTT * z, R.g[1] - R.u[1] * SP_BUTT * z]; seg = [b, [R.g[0] + R.u[0] * (SP_TIP + 9) * z, R.g[1] + R.u[1] * (SP_TIP + 9) * z]]; }
    c.save(); c.lineJoin = "round";
    for (let i = 0; i < n; i++) {
      const b = rgB[i], ob = orbit(b, tq, F);
      let x = ob.x, y = ob.y, ang = 0, face = ob.d > 0 ? -1 : 1, a = MG.reduced ? 0.55 * kc * ob.a : 0.55 * ob.a, sz = fs * b.sz * (0.8 + 0.3 * ob.d);
      if (wk < 1) {   // the dive
        const dx = rgP(pn, b.lane, 0)[0] + Math.sin(b.ph + t * 0.004) * 0.02 * Wd, dy = edge + (0.02 + 0.1 * b.lag) * H;   // (just ahead of the curtain, dark on the paper it is about to cover)
        x = dx + (x - dx) * wk; y = dy + (y - dy) * wk; ang = b.face * (1 - wk); a = 1 + (a - 1) * wk; sz = fs * b.sz * 1.25 + (sz - fs * b.sz * 1.25) * wk;
        if (wk < 0.5) face = b.face;
      }
      y -= 0.9 * H * easeIn(fe(UT.OFF + (i % 3) * 140, UT.OUT, t));
      if (seg) {   // pushed off the spear's line
        const [p, q] = seg, ex = q[0] - p[0], ey = q[1] - p[1], l2 = ex * ex + ey * ey || 1, s = clamp(((x - p[0]) * ex + (y - p[1]) * ey) / l2, 0, 1), px_ = p[0] + ex * s, py_ = p[1] + ey * s, d = Math.hypot(x - px_, y - py_) || 1;
        if (d < 0.12 * H) { const push = 0.1 * H * (1 - d / (0.12 * H)); x += ((x - px_) / d) * push; y += ((y - py_) / d) * push; }
      }
      if (a < 0.02 || y < pn.y0 - 40) continue;
      const fl = Math.sin(tq * (wk < 1 ? 0.05 : 0.021) + b.fl);
      c.globalAlpha = clamp(a, 0, 1);
      c.save(); c.translate(x, y); c.rotate(ang); birdPath(c, 0, 0, sz, fl, face); c.restore();
      c.fillStyle = RAV; c.fill(); c.globalAlpha *= 0.6; c.lineWidth = 0.9; c.strokeStyle = SNOW; c.stroke();
    }
    c.restore();
  }
  // the spear coming back (behind him: it ends behind his head), with its streak; reduced motion: it fades in at his hand, its streak a still line to the far edge
  function rgSplashSpear(c, pn, t) {
    const z = pn.z;
    if (MG.reduced) {
      const al = fe(UT.CATCH - 100, UT.CATCH, t);
      if (al <= 0) return null;
      const R = rgRet(pn, Math.max(t, UT.CATCH)), b = [R.g[0] - R.u[0] * (SP_BUTT + 6) * z, R.g[1] - R.u[1] * (SP_BUTT + 6) * z];
      c.save(); c.globalAlpha = 0.5 * al * (1 - fe(UT.CATCH, UT.NAME, t)); c.strokeStyle = MG_GOLD; c.lineWidth = 3 * z; c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(R.P0[0], R.P0[1]); c.stroke(); c.restore();
      rgSpear(c, R.g[0], R.g[1], R.ang, z, al, t);
      return R;
    }
    if (t < UT.RET) return null;
    const R = rgRet(pn, t);
    if (R.k < 1) rgStreak(c, R.g[0], R.g[1], R.a, wakeLen(pn), z, t, 1);
    rgSpear(c, R.g[0], R.g[1], R.ang, z, 1, t);
    return R;
  }
  // the statue's shards: in the spear's wake, then (the catch) kicked off it and flown to the title, where they vanish under the word
  function rgShards(c, pn, t, R) {
    if (!R || t >= UT.NAME) return;
    const z = pn.z, len = wakeLen(pn), step = MG.slow ? 2 : 1, cR = t >= UT.CATCH ? rgRet(pn, UT.CATCH) : R, T = t >= UT.CATCH ? rgTargets(pn) : null;
    c.save(); c.lineJoin = "miter"; c.lineWidth = 1.8; c.strokeStyle = ink;
    for (let i = 0; i < shards.length; i += step) {
      const s = shards[i], p0 = rgWake(i, cR, z, len);
      let x = p0[0], y = p0[1], r = s.sz * z * 0.5, ang = s.rot + s.vr * (t / 1000), al = 1;
      if (MG.reduced) al = fe(UT.CATCH - 100, UT.CATCH, t) * (1 - fe(UT.CATCH, UT.NAME, t));
      else if (T) {   // kicked out from the fist, then to the title
        const e = Math.pow(fe(UT.CATCH, UT.NAME, t), 1.5), dx = p0[0] - cR.f[0], dy = p0[1] - cR.f[1], dl = Math.hypot(dx, dy) || 1, kx = p0[0] + (dx / dl) * 0.06 * pn.h, ky = p0[1] + (dy / dl) * 0.06 * pn.h, m = 1 - e;
        x = m * m * p0[0] + 2 * m * e * kx + e * e * T[i][0]; y = m * m * p0[1] + 2 * m * e * ky + e * e * T[i][1];
        ang = s.rot + s.vr * (UT.CATCH / 1000) + s.vr * ((t - UT.CATCH) / 1000) * 3; r *= 1 - 0.4 * e;
      }
      if (al <= 0.01) continue;
      c.globalAlpha = al; c.fillStyle = s.w; shardTri(c, x, y, r, ang, s); c.fill(); c.stroke();
    }
    c.restore();
  }
  // his one open eye (the patch is on the other), in world units, at page time t
  function rgEye(t) { const W = W_(); MG.pt = t; const P = pose(W, mgTk(t)), q = rot([P.head[0] + P.w * 0.13, P.head[1]], P.hip, P.lean); return [FIN.wx + W.facing * q[0], q[1]]; }
  function drawSplash(c, pn, t) {
    const W = W_(), z = pn.z, H = pn.h, port = LY.port, tt = Math.min(t, MT.AFTER - 1);
    pn.screen(c);
    rgNight(c, pn, t);
    const [mx, my] = rgP(pn, port ? 0.72 : 0.88, port ? 0.12 : 0.24), mr = H * (port ? 0.09 : 0.12);   // the moon: the one other light
    c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fillStyle = SNOW; c.fill(); c.lineWidth = 3; c.strokeStyle = ink; c.stroke();
    ground(c, pn);   // (on the black page only the snow rim of the slab shows)
    const R = MG.reduced ? null : t >= UT.RET ? rgRet(pn, t) : null;
    rgFlock(c, pn, t, R);
    const ch = pn.p(FIN.wx, -36);   // moonlight on his chest, three soft rings
    c.save(); c.globalAlpha = 0.035; c.fillStyle = SNOW; for (const r of [0.5, 0.38, 0.26]) { c.beginPath(); c.arc(ch[0], ch[1], r * H, 0, 7); c.fill(); } c.restore();
    const Rs = rgSplashSpear(c, pn, t);
    const ox = W.x; W.x = FIN.wx;
    try { mgPuppet(c, pn, W, tt, { light: dirAng(-0.5), tint: 0.3, halo: MG.slow ? 0 : 2.5 }); } finally { W.x = ox; }
    pn.screen(c);
    if (Rs && (Rs.k >= 1 || MG.reduced)) { c.fillStyle = FIST; c.strokeStyle = ink; c.lineWidth = Math.max(2.4, 1.1 * z); c.beginPath(); c.arc(Rs.g[0], Rs.g[1], 5 * z, 0, 7); c.fill(); c.stroke(); }   // the fist over the shaft
    rgShards(c, pn, t, Rs);
    if (!MG.reduced) {
      const kc = fe(UT.CATCH, UT.CATCH + 150, t);   // the catch
      if (kc > 0 && kc < 1 && Rs) rgBurst(c, Rs.f[0], Rs.f[1], 0.12 * H * easeOut(kc) * (1 - 0.6 * kc), t * 0.01, MG_GOLD);
      const kn = fe(UT.NAME, UT.NAME + 120, t);   // the title lands (the word itself is the engine's, over the page)
      if (kn > 0 && kn < 1) { const q = rgTitle(); rgBurst(c, q[0] - pn.ox, q[1] - pn.oy, 0.2 * H * easeOut(kn) * (1 - 0.6 * kn), 0.3, MG_GOLD); }
    }
    const kg = fe(UT.GLINT, UT.GLINT + 150, t);   // his eye glints
    if (kg > 0 && kg < 1) { const e = pn.p(...rgEye(tt)), s = 0.025 * H * Math.sin(Math.PI * kg); star4(c, e[0], e[1], s * 1.35, ink); star4(c, e[0], e[1], s, SNOW); }
  }
  // panel 5 comes down from the top on pale gold paper (the night is drawn into it); a 4% push; the page shakes at the catch
  const rgSplashPanel = (port) => mgSplashPanel({ from: "t", paper: MG_GOLD_PALE,
    cam: (t, pn) => { const vh = (port ? 240 : 150) * (1 - (MG.reduced ? 0 : 0.04 * fe(UT.IN, MT.AFTER, t))); return { wx: FIN.wx + FIN.dir * (port ? 0.22 : 0.3) * vh * (pn.w / pn.h), wy: -(port ? 0.38 : 0.36) * vh, vh }; },
    shake: (t) => { const a = 3 * fe(UT.CATCH, UT.CATCH + 15, t) * (1 - fe(UT.CATCH + 60, UT.CATCH + 150, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
    draw: drawSplash });

  S_.ulti = Object.assign({}, S_, {
    name: "Ragnarök", pop: 3050,   // the launch waits for the gold impact frame
    start(g) { S_.start(g); ult = true; rgT = null; },
    end() { rgB = []; rgT = null; },
    panels(lay) {
      const ps = panels(lay), strike = ps.find((q) => q.id === "strike"), inset = ps.find((q) => q.id === "inset");
      strike.freeze = strike.cover = MT.SPLASH;   // panel 5 covers the whole page from here: the strike is drawn once more, then a bitmap
      inset.freeze = MT.STRIKE + 130;
      ps.splice(ps.findIndex((q) => q.id === "after"), 0, rgSplashPanel(lay.port));
      return ps;
    },
    build(lay) {
      S_.build(lay);
      const q = rnd(4242), D = FIN.dir, n = 48;
      rgT = null;
      rgB = Array.from({ length: n }, (_, i) => ({ lane: (((i * 29) % n) + 0.2 + q() * 0.6) / n, lag: q(), ph: q() * 6.28, fl: q() * 6.28, sz: 0.8 + q() * 0.5, u0: q(), sp: 0.8 + q() * 0.5, face: q() < 0.7 ? D : -D }));
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, m = lay.port ? 0.4 : 1, P3 = () => MG.byId.strike;
      ws[4] = Object.assign({}, ws[4], { t1: MT.SPLASH + 150 });   // KRASSHH is gone once the page turns
      const ms = lay.port ? Math.min(0.5, (0.86 * L.gw) / (8 * 0.15 * L.gh * 0.62)) : 1;   // (an eight-letter title has to fit the upright page)
      ws.push(
        { text: "VWOOM", t0: 2650, t1: 2820, size: 0.08, mul: m, fill: MG_GOLD, rot: -0.04 * D, stretch: { ang: 0, k: 0.5 }, at: () => { const q = P3().sp((FIN.wx + FIN.lx) / 2 - D * 20, -100); return [q[0], q[1]]; } },
        { text: "RAGNARÖK", t0: UT.NAME, t1: MT.CARD + 120, size: 0.15, mul: ms, arc: 10, fill: MG_GOLD, rot: -0.06 * D, at: () => { const q = rgTitle(), p = MG.byId.splash; return [q[0] + p.ox, q[1] + p.oy]; } },
      );
      return ws;
    },
    // once panel 5 is in, the KO beam where the loser left the screen is cut short and its flying bits are gone; the loser is no longer drawn
    after(t) { if (t >= MT.SPLASH && t < MT.AFTER) { if (FIN.beam && FIN.beam.t0 > -1e5) FIN.beam.t0 = -1e6; FIN.parts.length = 0; } },
    drawLoser(c, pn, t) { if (t < MT.SPLASH) drawLoserFn(c, pn, t); },
    // the impact frames: him in the follow-through, the spear stuck in the statue, the statue
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_(), z = pn.z, sp = rgSpearAt(FIN.hit);
      const ox = W.x; W.x = wxAt(TOUCH); mgPuppet(o, pn, W, TOUCH, { sc: 1, sil }); W.x = ox;
      const g = pn.sp(sp.gx, sp.gy); rgSpear(o, g[0], g[1], sp.a, z, 1, t, sil);
      mgPuppet(o, pn, Lp, FROZE, { sc: 1, sil });
      const feet = pn.sp(FIN.lx, 0); crystal(o, (u, v) => [feet[0] + u * z, feet[1] + v * z], t, z, sil);
    },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("uWind", T_SWING, () => Cin.go(() => Cin.growl(0.25)));
      cueOnce("uThrow", T_THROW, () => Cin.go(() => { Cin.whoosh(0.18, -0.6 * D, 0.7 * D, 0.55); Cin.shimmer(1760, 0.3); }));
      cueOnce("uStick", TOUCH + 5, () => Cin.go(() => Cin.tick(4200)));
      cueOnce("uTurn", T_TURN0, () => Cin.go(() => { Cin.shimmer(1320, 0.4); Cin.whoosh(0.15, 0.7 * D, -0.2 * D, 0.3); }));
      cueOnce("uNight", UT.IN, () => Cin.go(() => { Cin.sub(48, 30, 1.4, 0.5); Cin.whoosh(0.5, -0.6, 0.6, 0.45); }));
      cueOnce("uCaw1", 3280, () => odnCaw(1, 700)); cueOnce("uCaw2", 3360, () => odnCaw(0.9, 620)); cueOnce("uCaw3", 3450, () => odnCaw(0.8, 560));
      cueOnce("uRet", UT.RET, () => Cin.go(() => { Cin.riser(0.3, 0.14); Cin.shimmer(1320, 0.5); }));
      cueOnce("uRet2", UT.RET + 20, () => Cin.go(() => Cin.whoosh(0.3, 0.8 * D, -0.6 * D, 0.45)));
      cueOnce("uCatch", UT.CATCH, () => Cin.go(() => { Cin.impact(0.8); Cin.clack(); }));
      cueOnce("uCatch2", UT.CATCH + 20, () => Cin.go(() => Cin.chime(1760)));
      cueOnce("uCatch3", UT.CATCH + 60, () => Cin.go(() => Cin.tick(2600)));
      cueOnce("uCatch4", UT.CATCH + 130, () => Cin.go(() => Cin.tick(3200)));
      cueOnce("uName", UT.NAME, () => Cin.go(() => { Cin.taiko(0.8); Cin.chime(1568); Cin.glass(); }));
      cueOnce("uOff", 4100, () => Cin.go(() => { Cin.whoosh(0.4, 0.3, -0.3, 0.3); Cin.drone(false); }));
      cueOnce("uCaw4", 4120, () => odnCaw(0.6, 600)); cueOnce("uCaw5", 4260, () => odnCaw(0.5, 520));
      cueOnce("uGlint", UT.GLINT, () => Cin.go(() => Cin.pluck(1760)));
    },
  });
  /* ===================== the Potatality, "Frozen Fries" (MANGA.odin.alt; design: Project files step8/fable-design.md) =====================
     Judgement to the shatter (the statue flies, the flock chases it). 3250 the splash (panel 5) slides up on icy paper: the statue hangs at the top of its
     flight and Gungnir's blade slides in at the edge; 3420-3470 an ice beam crosses the page (KRISSH), the cracks run, 3530 it bursts and the shards are
     frosted fries: they spray out and rain down one by one into a paper bag standing in the snow (3720-4060) while the camera pushes in on the bag; 4100 the
     loser's face stamps onto the bag as its logo; 4130-4360 the two ravens swoop in and perch on the rim; 4380 brrr: frost climbs the bag, icicles grow, bag,
     ravens and logo shiver. 4700 in panel 4's place:
     Odin with the spear on his shoulder beside the frosty bag, the ravens on its rim, one fry waving, the logo's teeth chattering (brr...), a cold mist; the
     engine's POP bursts the bag at 5250 (food()): the empty bag lies tipped over, two fries spilled, the ravens flap up.
     The splash's world (fzfLay): the bag's bottom on the ground at fzfBX(), the statue up and to the loser's side. A bag is drawn in its own units, scaled
     (fzfBag*: the bottom's middle at 0, 42 wide, the front's rim at -46). Every helper here is prefixed fzf. */
  const FZF_GOLD = "#f2cf6b", FZF_GOLD_D = "#d49a3c", FZF_FROST = "#eaf7ff", FZF_BAG = "#d8b17b", FZF_BAG_IN = "#8a6238", FZF_CREAM = "#fff6e2", FZF_PAPER = "#eef5f7";
  const FZ = { BEAM: 3420, HIT: 3470, SHAT: 3530, LAND0: 3720, LAND1: 4060, LOGO: 4100, RAV: 4130, PERCH: 4290, BRRR: 4380 };
  const FZF_ICE = [[-15, 5], [-8, 3.4], [1, 6], [8, 4], [15, 3.2]];   // the icicles under the front rim: x, length
  let fzfFries = [], fzfWave = 0;
  // the splash: its height in world units (vh) and the camera's offset from FIN.wx (cx), both pushed in on the bag while the fries land (vh2, cx2); the bag
  // (bx from FIN.wx, its scale bs), the statue's feet (sx, sy) and scale (sc), the fries' spray (spr)
  const fzfLay = () => (LY.port ? { vh: 215, vh2: 160, cx: 0, cx2: 0, bx: 0, bs: 1, sx: 8, sy: -102, sc: 0.62, spr: 0.45 }
    : { vh: 150, vh2: 118, cx: 22, cx2: -18, bx: -34, bs: 1.1, sx: 84, sy: -42, sc: 0.7, spr: 1 });
  const fzfBX = () => FIN.wx + FIN.dir * fzfLay().bx;
  const fzfLw = (pn) => Math.max(1.1, 3 / pn.z);   // an ink line, in world units
  const fzfAX = () => FIN.wx + FIN.dir * (LY.port ? 78 : 84), fzfAS = () => (LY.port ? 0.85 : 1);   // the bag in the aftermath, its scale
  const fzfStatue = (t) => { const Y = fzfLay(); return [FIN.wx + FIN.dir * Y.sx, Y.sy - 6 * easeOut(fe(MT.SPLASH, FZ.HIT, t))]; };   // the statue's feet: the top of its flight
  const fzfLandT = (f) => FZ.LAND0 + (f.ord / (fzfFries.length - 1)) * (FZ.LAND1 - FZ.LAND0);
  const fzfShake = (t, a) => Math.sin(t * 0.11) * a;
  // the fries: a slot in the bag (x, how far it sticks out, its lean), where it sits in the statue (u, v: statue units from his feet), the spray (sx, sy), the spin
  function fzfBuild() {
    const r = rnd(2718), n = 22;
    fzfFries = [];
    for (let i = 0; i < n; i++) {
      const x = -16 + (32 * ((i * 9) % n)) / (n - 1);   // (9 and 22 share no factor: the slots fill in a scattered order)
      fzfFries.push({ x, len: 17 + r() * 6, out: 4 + r() * 9, a: (x / 16) * 0.3 + (r() - 0.5) * 0.16, u: (r() - 0.5) * 44, v: -8 - r() * 80,
        sx: (r() - 0.62) * 150, sy: -30 - r() * 45, spin: (r() < 0.5 ? -1 : 1) * (4 + r() * 6), ord: i, fr: r() });   // (sx: towards the loser's side; most fly back over the bag)
    }
    let best = -1;   // the waving fry: a middle one, made to stand tall
    fzfFries.forEach((f, i) => { if (Math.abs(f.x) < 7 && f.out > best) { best = f.out; fzfWave = i; } });
    fzfFries[fzfWave].out = 17; fzfFries[fzfWave].a = 0.05;
  }
  // a frosted fry centred on (x, y), turned by a (0 = pointing up), in the current units (sc: drawn that much bigger)
  function fzfFry(c, x, y, a, len, lw, fr, sc) {
    const w = 4.4, h = len / 2;
    c.save(); c.translate(x, y); c.rotate(a);
    if (sc) { c.scale(sc, sc); lw /= sc; }
    c.fillStyle = FZF_GOLD; c.beginPath(); c.roundRect(-w / 2, -h, w, len, 0.9); c.fill();
    c.fillStyle = FZF_GOLD_D; c.fillRect(w * 0.12, -h + 0.6, w * 0.36, len - 1.2);
    c.fillStyle = FZF_FROST;   // the frost cap, a ragged lower edge
    c.beginPath(); c.moveTo(-w / 2, -h + 0.5); c.lineTo(w / 2, -h + 0.5); c.lineTo(w / 2, -h + len * (0.22 + 0.1 * fr)); c.lineTo(w * 0.1, -h + len * 0.15); c.lineTo(-w * 0.18, -h + len * (0.27 + 0.08 * fr)); c.lineTo(-w / 2, -h + len * 0.18); c.closePath(); c.fill();
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(-w * 0.12, h * 0.25 * (fr - 0.5) + 1, 0.55, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = lw; c.beginPath(); c.roundRect(-w / 2, -h, w, len, 0.9); c.stroke();
    c.restore();
  }
  // where a fry sits in the bag (bag units): its middle and lean, with the wave for the waving one
  function fzfSlot(f, wave) {
    const a = f.a + (wave || 0), cy = -46 - f.out + f.len / 2;
    if (!wave) return [f.x, cy, a];
    const bx = f.x - (f.len / 2) * Math.sin(f.a), by = cy + (f.len / 2) * Math.cos(f.a);   // turned about its foot
    return [bx + (f.len / 2) * Math.sin(a), by - (f.len / 2) * Math.cos(a), a];
  }
  // the back wall's cut top (higher than the front: the bag is seen a little from above) and its inside in shade
  function fzfBagBack(c, lw) {
    c.fillStyle = FZF_BAG_IN; c.strokeStyle = ink; c.lineWidth = lw; c.lineJoin = "round";
    c.beginPath(); c.moveTo(-21, -44); c.lineTo(-21, -50); for (let i = 1; i <= 14; i++) c.lineTo(-21 + 3 * i, i % 2 ? -52.5 : -50); c.lineTo(21, -44); c.closePath(); c.fill(); c.stroke();
  }
  // the loser's face as a logo: a badge, his colour on a potato head, wide eyes, chattering teeth, cold cheeks; k: the stamp (0..1), blink, chat (the teeth go)
  function fzfLogo(c, lw, t, k, o) {
    c.fillStyle = FZF_CREAM; c.strokeStyle = ink; c.lineWidth = lw;
    c.beginPath(); c.arc(0, -25, 10.5, 0, 7); c.fill(); c.stroke();
    if (k <= 0) return;
    const sc = 1 + 0.7 * (1 - easeOut(k)), j = o.chat ? Math.sin(t * 0.09) * 0.45 : 0;
    c.save(); c.translate(0, -25); c.scale(sc, sc); c.globalAlpha = Math.min(1, k * 3);
    c.fillStyle = col(L_().pal); c.beginPath(); c.ellipse(0, 0.4, 8, 8.4, 0, 0, 7); c.fill(); c.lineWidth = lw * 0.9; c.stroke();
    c.lineWidth = lw * 0.75;
    for (const sd of [-1, 1]) {
      const ex = sd * 3.2, ey = -1.6;
      if (o.blink) { c.beginPath(); c.moveTo(ex - 2, ey); c.lineTo(ex + 2, ey); c.stroke(); }
      else {
        c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, 2.3, 2.8, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = ink; c.beginPath(); c.arc(ex - sd * 0.3 + j * 0.4, ey - 0.6, 0.95, 0, 7); c.fill();
      }
      c.beginPath(); c.moveTo(sd * 1.2, -6.2); c.lineTo(sd * 5, -5); c.stroke();   // worried brows, the inner ends up
      c.fillStyle = COL; c.beginPath(); c.ellipse(sd * 5.4, 1.9, 1.6, 1, 0, 0, 7); c.fill();
    }
    c.fillStyle = "#ffffff"; c.beginPath(); c.rect(-3.6, 2.6 + j, 7.2, 2.8); c.fill(); c.stroke();   // the chattering teeth
    c.beginPath(); c.moveTo(-3.6, 4 + j); c.lineTo(3.6, 4 + j); for (const x of [-1.8, 0, 1.8]) { c.moveTo(x, 2.6 + j); c.lineTo(x, 5.4 + j); } c.lineWidth = lw * 0.5; c.stroke();
    c.restore();
  }
  // the front: kraft paper with a cut rim, the gusset's crease and tone on the far side, the logo, the frost from the ground up, icicles under the rim.
  // o: { logo, frost, chat, blink, px (bag units -> screen css px, for the tone; null: no tone) }
  function fzfBagFront(c, lw, t, o) {
    const D = FIN.dir;
    c.lineJoin = "round"; c.strokeStyle = ink; c.lineWidth = lw;
    const front = () => { c.beginPath(); c.moveTo(-19, 0); c.lineTo(-21, -44); for (let i = 1; i <= 14; i++) c.lineTo(-21 + 3 * i, i % 2 ? -46.5 : -44); c.lineTo(19, 0); c.closePath(); };
    c.fillStyle = FZF_BAG; front(); c.fill();
    if (o.px) { c.save(); front(); c.clip(); mgToneFill(c, [o.px(D * 12, -48), o.px(D * 23, -48), o.px(D * 21, 2), o.px(D * 11, 2)], 6, 0.38); c.restore(); }
    c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(D * 12, -44.5); c.lineTo(D * 11, -0.5); c.moveTo(-18.6, -4.5); c.lineTo(18.6, -4.5); c.stroke();   // the crease, the folded bottom
    const f = o.frost;
    if (f > 0) {   // the paper goes cold; a crust of ice climbs from the ground with a jagged crystal edge, the cut rim frosts over
      c.save(); front(); c.clip();
      c.fillStyle = rgba(COL, 0.3 * f); c.fillRect(-24, -50, 48, 52);
      c.fillStyle = FZF_FROST; c.strokeStyle = COL; c.lineWidth = lw * 1.3;
      c.beginPath(); c.moveTo(-24, 2); for (let i = 0; i <= 12; i++) c.lineTo(-24 + 4 * i, -12 * f - (i % 2 ? 5 : i % 3) * f); c.lineTo(24, 2); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-24, -50); c.lineTo(24, -50); for (let i = 12; i >= 0; i--) c.lineTo(-24 + 4 * i, -43.5 + (i % 2 ? 3.6 : 0.8) * f); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.lineWidth = lw; c.strokeStyle = ink; front(); c.stroke();
    fzfLogo(c, lw, t, o.logo, o);
    if (f > 0) {
      star4(c, -12, -8, 2.6 * f, "#ffffff"); star4(c, 11 * D, -6, 2 * f, "#ffffff"); star4(c, -14 * D, -36, 1.8 * f, "#ffffff");
      c.strokeStyle = ink; c.lineWidth = lw * 0.8; c.fillStyle = "#ffffff";
      for (const [x, L] of FZF_ICE) { c.beginPath(); c.moveTo(x - 1.7, -44.6); c.lineTo(x, -44.6 + L * f); c.lineTo(x + 1.7, -44.6); c.closePath(); c.fill(); c.stroke(); }
    }
  }
  // the whole bag at bag-units scale s with its bottom at (bx, 0) in the world (pn.world set): the back, the fries in it, the front.
  // o.fry(f) -> [x, y, lean] in bag units, or null (not in the bag yet); without it every fry sits in its slot (the waving one turned by o.wave)
  function fzfBag(c, pn, bx, s, t, o) {
    const lw = fzfLw(pn) / s;
    c.save(); c.translate(bx, 0); c.scale(s, s);
    fzfBagBack(c, lw);
    for (let i = 0; i <= fzfFries.length; i++) {
      const j = i === fzfFries.length ? fzfWave : i;   // the waving one last, in front of the others
      if (j === fzfWave && i !== fzfFries.length) continue;
      const f = fzfFries[j], q = o.fry ? o.fry(f) : fzfSlot(f, j === fzfWave ? o.wave : 0);
      if (q) fzfFry(c, q[0], q[1], q[2], f.len, lw, f.fr);
    }
    fzfBagFront(c, lw, t, Object.assign({ px: (u, v) => pn.sp(bx + u * s, v * s) }, o));
    c.restore();
  }
  // a fry in the air (world units, the splash): from its place in the statue, out along its spray, down into its slot of the bag; k 0..1
  function fzfFlight(f, k) {
    const Y = fzfLay(), P0 = fzfStatue(FZ.SHAT), p0x = P0[0] + f.u * Y.sc, p0y = P0[1] + f.v * Y.sc, p1x = p0x + FIN.dir * f.sx * Y.spr, p1y = p0y + f.sy, q = fzfSlot(f), p2x = fzfBX() + q[0] * Y.bs, p2y = q[1] * Y.bs, m = 1 - k;
    return [m * m * p0x + 2 * m * k * p1x + k * k * p2x, m * m * p0y + 2 * m * k * p1y + k * k * p2y, f.a + (1 - ease(k)) * f.spin];
  }
  // shiver marks either side of a bag (world units, pn.world set)
  function fzfShiverMarks(c, bx, s, lw, t, a) {
    if (a <= 0.01) return;
    c.save(); c.strokeStyle = ink; c.lineWidth = lw * 0.9; c.globalAlpha = a; c.lineCap = "round";
    for (const sd of [-1, 1]) for (let j = 0; j < 2; j++) { const xx = bx + sd * (27 + j * 5) * s, w2 = Math.sin(t * 0.06 + j) * 1.5 * s; c.beginPath(); c.moveTo(xx + w2, -34 * s); c.quadraticCurveTo(xx + sd * 3 * s - w2, -26 * s, xx + w2, -18 * s); c.stroke(); }
    c.restore();
  }
  // the splash's ravens: in from above the far corners, along a dip, onto the rim (bag units), facing in; null before they come
  function fzfRavenAt(i, t) {
    const sd = i ? 1 : -1, t0 = FZ.RAV + i * 80, t1 = FZ.PERCH + i * 70, X0 = fzfBX(), bs = fzfLay().bs;
    if (t < t0) return null;
    const to = [X0 + sd * 17 * bs, -57 * bs], from = [X0 + sd * 130, -260], cp = [X0 + sd * 75, -40], k = ease(fe(t0, t1, t)), m = 1 - k;
    return { x: m * m * from[0] + 2 * m * k * cp[0] + k * k * to[0], y: m * m * from[1] + 2 * m * k * cp[1] + k * k * to[1], perched: t >= t1, face: -sd };
  }
  function fzfStatueDraw(c, pn, t) {
    const Lp = L_(), Y = fzfLay(), [fx, fy] = fzfStatue(t), z = pn.z * Y.sc, hit = t >= FZ.HIT;
    const ox = Lp.x, oy = Lp.y, os = Lp.state;
    Lp.x = fx; Lp.y = fy; Lp.state = "fin"; Lp.flash = 0;
    try {
      mgPuppet(c, pn, Lp, FROZE, { sc: Y.sc, light: dirAng(-0.5), tint: 0.18, flash: hit && t < FZ.HIT + 40, post: (lc) => { lc.fillStyle = rgba(COL, 0.22); lc.fillRect(0, 0, MG.cw, MG.ch); } });
    } finally { Lp.x = ox; Lp.y = oy; Lp.state = os; }
    pn.screen(c);
    const feet = pn.p(fx, fy);
    crystal(c, (u, v) => [feet[0] + u * z, feet[1] + v * z], t, z);
    if (hit) { const q = pn.p(fx - FIN.dir * 30 * Y.sc, fy - 52 * Y.sc); crackLines(c, q[0], q[1], z * 1.3, easeOut(fe(FZ.HIT, FZ.SHAT - 10, t)), FIN.dir); }
  }
  // Gungnir's blade at the edge on the winner's side and the ice beam from its tip to the statue (screen px of the panel)
  function fzfBeam(c, pn, t, S) {
    const D = FIN.dir, z = pn.z, a = 1 - fe(FZ.SHAT + 20, FZ.SHAT + 160, t);
    if (a <= 0) return;
    const O = [(D > 0 ? pn.x0 : pn.x1) + D * 30 * z, S[1] - 0.1 * pn.h], ang = Math.atan2(S[1] - O[1], S[0] - O[0]), u = [Math.cos(ang), Math.sin(ang)], g = [O[0] - u[0] * (SP_TIP + 9) * z, O[1] - u[1] * (SP_TIP + 9) * z];
    const ins = easeOut(fe(MT.SPLASH + 60, FZ.BEAM, t));   // the blade slides in, then holds
    spear(c, g[0] - u[0] * 26 * z * (1 - ins), g[1] - u[1] * 26 * z * (1 - ins), ang, z, Math.min(1, a * 1.5));
    const k = easeOut(fe(FZ.BEAM, FZ.HIT, t));
    if (k <= 0) return;
    const len = Math.hypot(S[0] - O[0], S[1] - O[1]) * k, hw = 0.05 * Math.min(pn.w, pn.h) * (0.35 + 0.65 * a), n = Math.max(4, Math.round(len / (hw * 1.1)));
    c.save(); c.translate(O[0], O[1]); c.rotate(ang); c.globalAlpha = Math.min(1, a * 1.4); c.lineJoin = "miter";
    const spike = (i) => hw * (0.75 + 0.35 * (i / n) + (i % 2 ? 0.45 : 0));   // the ink edge with ice spikes along both sides
    c.fillStyle = ink; c.beginPath(); c.moveTo(0, -hw * 0.5);
    for (let i = 0; i <= n; i++) c.lineTo((len * i) / n, -spike(i));
    c.lineTo(len + hw * 0.9, 0);
    for (let i = n; i >= 0; i--) c.lineTo((len * i) / n, spike(i));
    c.closePath(); c.fill();
    c.fillStyle = COL; c.beginPath(); c.moveTo(0, -hw * 0.6); c.lineTo(len, -hw * 0.95); c.lineTo(len + hw * 0.5, 0); c.lineTo(len, hw * 0.95); c.lineTo(0, hw * 0.6); c.closePath(); c.fill();
    c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(0, -hw * 0.22); c.lineTo(len, -hw * 0.38); c.lineTo(len + hw * 0.2, 0); c.lineTo(len, hw * 0.38); c.lineTo(0, hw * 0.22); c.closePath(); c.fill();
    for (let i = 0; i < 4; i++) { const q = ((t * 0.003 + i / 4) % 1) * len; star4(c, q, (i % 2 ? 1 : -1) * hw * 0.55, hw * 0.45, "#ffffff"); }
    c.restore();
    const kh = fe(FZ.HIT, FZ.HIT + 120, t);   // the hit: a white burst on the statue
    if (kh > 0 && kh < 1) mgStarburst(c, S[0], S[1], 0.16 * Math.min(pn.w, pn.h) * easeOut(kh) * (1 - 0.5 * kh), 0.3);
  }
  // the shatter: a white burst and ice chips (the rest of the statue are fries)
  function fzfBurst(c, pn, t, S) {
    const u = t - FZ.SHAT, m = Math.min(pn.w, pn.h);
    if (u < 0 || u > 500) return;
    const R = 0.26 * m * easeOut(Math.min(1, u / 90)) * (1 - fe(130, 240, u));
    if (R > 2) mgStarburst(c, S[0], S[1], R, 0.2);
    const a = 1 - fe(250, 500, u), tau = u / 1000, z = pn.z * 0.6;
    c.save(); c.lineJoin = "miter"; c.lineWidth = 1.6; c.strokeStyle = ink; c.globalAlpha = a;
    for (let i = 0; i < 14; i++) {
      const s = shards[i], x = S[0] + (s.sx * 0.5 + FIN.dir * s.vx * tau) * z, y = S[1] + (s.sy * 0.4 + 30 + s.vy * tau + 280 * tau * tau) * z;
      c.fillStyle = s.w; shardTri(c, x, y, s.sz * z * 0.55, s.rot + s.vr * tau, s); c.fill(); c.stroke();
    }
    c.restore();
  }
  function fzfDrawSplash(c, pn, t) {
    const D = FIN.dir, z = pn.z, lw = fzfLw(pn), X0 = fzfBX(), Y = fzfLay(), bs = Y.bs;
    const tone = (poly, size, cover, drift) => mgToneFill(c, poly.map(([x, y]) => [x + pn.ox, y + pn.oy]), size, cover, drift);
    pn.screen(c);
    for (let i = 0; i < 3; i++) { const h = pn.h * (0.09 + 0.07 * i); tone([[pn.x0 - 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 + h], [pn.x0 - 4, pn.y0 + h]], 8, 0.42 - 0.13 * i, [t * 0.0006, 0]); }
    const [fx, fy] = fzfStatue(Math.min(t, FZ.SHAT)), S = pn.p(fx, fy - 52 * Y.sc), B = pn.p(X0, -40), R = Math.hypot(pn.w, pn.h), sw = ease(fe(FZ.SHAT, FZ.LAND1, t));
    if (sw < 1) mgFocus(c, S[0], S[1], R, t * 0.0004, 0.3 * (1 - sw));   // the focus lines move from the statue to the bag
    if (sw > 0) mgFocus(c, B[0], B[1], R, -t * 0.0003, 0.3 * sw);
    ground(c, pn);
    tone([pn.p(X0 - 27 * bs, 0.5), pn.p(X0 + 27 * bs, 0.5), pn.p(X0 + 23 * bs, 5.5), pn.p(X0 - 23 * bs, 5.5)], 6, 0.45);   // the bag's shadow on the snow
    fzfBeam(c, pn, t, S);
    if (t < FZ.SHAT) fzfStatueDraw(c, pn, t);
    // the bag, the fries in it (and the ones about to drop in), the fries in the air in front
    const shk = fzfShake(t, 0.9 * fe(FZ.BRRR, FZ.BRRR + 60, t)), bx = X0 + shk, brr = t >= FZ.BRRR;
    pn.world(c);
    const fry = (f) => {   // a fry about to drop in or landed (with a little bounce) is drawn by the bag, behind its front
      const tl = fzfLandT(f), k = fe(FZ.SHAT, tl, t);
      if (t < FZ.SHAT || k <= 0.84) return null;
      if (k < 1) { const p = fzfFlight(f, k); return [(p[0] - bx) / bs, p[1] / bs, p[2]]; }
      const q = fzfSlot(f); q[1] -= 3 * Math.sin(Math.PI * fe(tl, tl + 110, t)); return q;
    };
    fzfBag(c, pn, bx, bs, t, { fry, logo: fe(FZ.LOGO, FZ.LOGO + 140, t), frost: easeOut(fe(FZ.BRRR, FZ.BRRR + 320, t)), chat: brr });
    pn.world(c);
    if (t >= FZ.SHAT) for (const f of fzfFries) {
      const k = fe(FZ.SHAT, fzfLandT(f), t);
      if (k <= 0.84) { const p = fzfFlight(f, k); fzfFry(c, p[0], p[1], p[2], f.len, lw, f.fr, bs); }
    }
    for (let i = 0; i < 2; i++) {
      const r = fzfRavenAt(i, t);
      if (!r) continue;
      const fl = r.perched ? 0 : Math.sin(t * 0.03 + i * 2), sh = brr && r.perched ? Math.sin(t * 0.13 + i) * 0.5 : 0;
      raven(c, r.x + shk + sh, r.y, 7 * bs * (brr ? 1 + 0.07 * Math.abs(Math.sin(t * 0.05 + i)) : 1), fl, r.face, r.perched);
    }
    fzfShiverMarks(c, bx, bs, lw, t, fe(FZ.BRRR, FZ.BRRR + 120, t));
    pn.screen(c);
    fzfBurst(c, pn, t, S);
  }
  // the aftermath: Judgement's panel 4 (him, the spear on his shoulder) with the frosty bag beside him and the ravens on its rim; popped: the bag tipped over, empty
  function fzfDrawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir, x = FIN.wx + D * 4, ax = fzfAX(), s = fzfAS(), lw = fzfLw(pn), popped = mgPopped(t), WAVE = MT.AFTER + 150;
    const tone = (poly, size, cover, drift) => mgToneFill(c, poly.map(([px, py]) => [px + pn.ox, py + pn.oy]), size, cover, drift);
    pn.screen(c);
    tone([[pn.x0, pn.y0], [pn.x1, pn.y0], [pn.x1, pn.y0 + pn.h * 0.3], [pn.x0, pn.y0 + pn.h * 0.3]], 8, 0.38, [t * 0.0006, 0]);
    const q = pn.p(ax, -30);
    mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.4);
    peaks(c, pn, pn.p(0, 0)[1], pn.h * 0.18, 5);
    ground(c, pn);
    tone([pn.p(ax - 27 * s, 0.5), pn.p(ax + 27 * s, 0.5), pn.p(ax + 23 * s, 5.5), pn.p(ax - 23 * s, 5.5)], 6, 0.45);
    const ox = W.x; W.x = x; mgPuppet(c, pn, W, t, { light: dirAng(-0.5) }); W.x = ox;
    pn.screen(c);
    const sp = spearAt(t, x);   // the spear over his shoulder, in front of him; the fist is drawn again over it
    if (sp) {
      const g = pn.p(sp.gx, sp.gy); spear(c, g[0], g[1], sp.a, pn.z, 1);
      c.fillStyle = FIST; c.strokeStyle = ink; c.lineWidth = Math.max(2.4, 1.1 * pn.z); c.beginPath(); c.arc(g[0], g[1], 5 * pn.z, 0, 7); c.fill(); c.stroke();
    }
    pn.world(c);
    if (!popped) {
      const bx = ax + fzfShake(t, 0.5);
      if (!MG.slow) {   // a cold mist curling up off the fries
        c.save(); c.strokeStyle = COL; c.lineWidth = lw * 1.2; c.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          const sx = bx + (i - 1) * 10 * s, ph = ((t - MT.AFTER) * 0.018 + i * 7) % 24;
          c.globalAlpha = 0.75 * (1 - ph / 24);
          c.beginPath(); for (let j = 0; j <= 8; j++) { const yy = (-58 - ph - j * 2) * s, xx = sx + Math.sin(j * 0.8 + t * 0.006 + i) * 2.4 * s; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
        }
        c.restore();
      }
      const wave = 0.55 * Math.sin((t - WAVE) * 0.019) * fe(WAVE, WAVE + 120, t);
      fzfBag(c, pn, bx, s, t, { logo: 1, frost: 1, chat: true, blink: Math.abs(t - 5020) < 60, wave });
      pn.world(c);
      fzfShiverMarks(c, bx, s, lw, t, 0.8);
    } else {   // the empty bag on its side, the mouth towards where he landed, two fries spilled; the face has left the logo with him
      const lwb = lw / s;
      c.save(); c.translate(ax - D * 22 * s, -20.6 * s); c.rotate(D * Math.PI / 2); c.scale(s, s);
      fzfBagBack(c, lwb); fzfBagFront(c, lwb, t, { logo: 0, frost: 0, px: null });
      c.restore();
      fzfFry(c, ax + D * 33 * s, -2.4, D * 1.42, 19, lw, 0.3);
      fzfFry(c, ax + D * 44 * s, -2.4, -D * 1.5, 17, lw, 0.7);
    }
    for (let i = 0; i < 2; i++) {   // the ravens on the rim, looking at him; at the pop they flap up and away to both sides
      const sd = i ? D : -D, up = popped ? easeOut(fe(MT.POP, MT.POP + 260, t)) : 0, fl = popped ? Math.sin(t * 0.035 + i * 2) : 0;
      const rx = ax + sd * (17 + (i ? 42 : 24) * up) * s + (popped ? 0 : fzfShake(t, 0.5)), ry = (-57 - (popped ? (i ? 48 : 30) * up + 2 * Math.sin(t * 0.02 + i) : 0)) * s;
      raven(c, rx, ry, 7 * s * (1 + 0.05 * Math.abs(Math.sin(t * 0.05 + i))), fl, -D, !popped);
    }
    pn.screen(c);
  }

  S_.alt = Object.assign({}, S_, {
    name: "Frozen Fries",
    start(g) { S_.start(g); pota = true; FIN.cue.back = FIN.cue.cawC = true; },   // (Judgement's ravens flying back to the spear belong to its own panel 4)
    end() { pota = false; },
    build(lay) { S_.build(lay); fzfBuild(); },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = fzfDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 130 : 112) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + FIN.dir * (lay.port ? 48 : 44), wy: -0.46 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: FZF_PAPER, slide: MG.reduced ? 1 : 180,
        cam: (t) => { const Y = fzfLay(), k = MG.reduced ? 0 : ease(fe(FZ.LAND0, FZ.LOGO, t)), v = lerp(Y.vh, Y.vh2, k); return { wx: FIN.wx + FIN.dir * lerp(Y.cx, Y.cx2, k), wy: -0.42 * v, vh: v * (1 - 0.03 * fe(MT.SPLASH, MT.AFTER, t)) }; },
        draw: fzfDrawSplash }));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, m = lay.port ? 0.4 : 1, kr = ws.find((w) => w.text === "KRASSHH"), Y = fzfLay();
      if (kr) kr.t1 = MT.SPLASH + 150;   // gone as the splash comes up
      const at = (id, tt, wx, wy) => () => { const pn = MG.byId[id]; mgPlace(pn, tt); const q = pn.sp(wx(), wy); return [q[0], q[1]]; };
      ws.push(
        { text: "KRISSH", t0: FZ.HIT + 10, t1: 4080, size: 0.2, mul: lay.port ? 0.42 : 1, arc: 8, jit: 0.12, rot: -0.1 * D,
          at: lay.port ? at("splash", 3700, () => fzfStatue(FZ.SHAT)[0], Y.sy - 86) : at("splash", 3700, () => fzfStatue(FZ.SHAT)[0] + D * 14, -16) },
        { text: "brrr", t0: FZ.BRRR, t1: MT.AFTER + 60, size: 0.14, mul: lay.port ? 0.5 : 1, jit: 0.22, jag: 0.12, rot: 0.08 * D,
          at: lay.port ? at("splash", 4400, () => fzfBX(), -100) : at("splash", 4400, () => fzfBX() + D * 62, -48) },
        { text: "brr...", t0: MT.AFTER + 220, t1: MT.POP, size: 0.055, mul: lay.port ? 0.7 : 1, jit: 0.2, rot: 0.06 * D,
          at: at("after", MT.AFTER + 300, () => fzfAX() + D * 30, -66) },
      );
      return ws;
    },
    food() { const x = fzfAX(), s = fzfAS(); return { x, y: 0, r: 22 * s, y0: -40 * s, lx: x + FIN.dir * (LY.port ? 24 : 38) }; },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("fzfBlade", MT.SPLASH + 60, () => Cin.go(() => Cin.chime(1760)));
      cueOnce("fzfBeam", FZ.BEAM, () => Cin.go(() => { Cin.whoosh(0.22, -0.7 * D, 0.6 * D, 0.45); Cin.shimmer(1320, 0.4); }));
      cueOnce("fzfHit", FZ.HIT, () => Cin.go(() => { Cin.tick(4200); Cin.impact(0.4); }));
      cueOnce("fzfShatter", FZ.SHAT, () => Cin.go(() => { Cin.glass(); Cin.boom(0.35); }));
      for (let i = 0; i < 6; i++) { const tl = FZ.LAND0 + (i / 5) * (FZ.LAND1 - FZ.LAND0); cueOnce("fzfLand" + i, tl, () => Cin.go(() => { Cin._noise(0.05, 0.12, 1800, 3800, "bandpass", 1.5); Cin._osc("triangle", 1200 + i * 140, 900 + i * 100, 0.06, 0.04, 0.002); })); }
      cueOnce("fzfLogo", FZ.LOGO, () => Cin.go(() => Cin.stamp(0.6)));
      cueOnce("fzfCaw", FZ.PERCH, () => odnCaw(0.6, 700));
      cueOnce("fzfCaw2", FZ.PERCH + 90, () => odnCaw(0.45, 620));
      cueOnce("fzfBrrr", FZ.BRRR, () => Cin.go(() => { for (let i = 0; i < 8; i++) Cin._osc("triangle", 700 + (i % 2) * 60, 680, 0.05, 0.03, 0.002, i * 0.06); }));
      cueOnce("fzfChat", MT.AFTER + 220, () => Cin.go(() => { for (let i = 0; i < 5; i++) Cin.tick(3000 + (i % 2) * 400); }));
      cueOnce("fzfFlap", MT.POP + 30, () => odnCaw(0.7, 760));
    },
  });
  /* ===================== the second Potatality, "Smash Landing" (MANGA.odin.alt2; design: Project files step8/fable-design-2.md §1.5) =====================
     Judgement to the shatter (the statue flies, the flock chases it). 3250 the splash (panel 5) slides up on pale sky: high up, big and near, the Raven carries the
     loser by the top of his head; far below, small, Odin holds a tin plate up. 3330 it lets go (caw): the loser falls with three after-images, shrinking into the
     distance, onto the plate; 3500 SPLAT: the camera cuts close, he is a flat smashed potato on the plate, his skin split all round the edge, his eyes wide apart; a
     salt flake (3650) and a rosemary sprig (3750) land on him. 3790 the Raven swoops back onto the plate's rim and pecks him three times (peck), he winces each
     time; 4220 Odin shoos it with two fingers and it hops onto his shoulder (caw), the potato sighs. 4700 in panel 4's place, in colour: Odin, the spear on his
     shoulder and the Raven beside his head, a tin plate on a stump with the smashed potato blinking; the engine's POP bursts it at 5250 (food()): a greasy ring,
     three peck marks and the sprig are left on the plate.
     The splash's world: Odin's feet at (FIN.wx, 0), the plate held up in front of him at (SML_PX, SML_PY). A plate and the potato on it are drawn in their own units,
     scaled (smlPlate / smlSmash: the plate's middle at 0, 40 each side; the potato 35). Every helper here is prefixed sml. */
  const SML = { DROP: 3330, LAND: 3500, SALT0: 3575, SALT: 3650, SPRIG0: 3610, SPRIG: 3750, RAV0: 3790, RAV1: 3900, PECK: [3960, 4060, 4160], HAND: 4220, SHOO: 4290, HOP1: 4430, CAW: 4440 };
  const SML_PX = 46, SML_PY = -74, SML_TAU = Math.PI * 2, SML_SKY = "#edf3f6", SML_PLATE = "#c9ced6", SML_PLATE_D = "#959ca7", SML_PLATE_IN = "#e2e6eb";
  const SML_FLESH = "#fbe7b4", SML_FLESH_D = "#e2bd78", SML_LEAF = "#5d8a4a", SML_STEM = "#6f5a33", SML_BARK = "#8a6238", SML_WOOD = "#e8cf9c", SML_GREASE = "rgba(196,140,58,";
  let smlFlecks = [];
  // the splash's camera: wide (vw: its height in world units, cxw: its middle from FIN.wx) until the landing, then close (vc, cxc, wyc); the near Raven's size (rs)
  // and how big the loser hangs under it (lsc: he is near the camera, and shrinks to his own size as he falls away onto the plate)
  const smlLay = () => (LY.port ? { vw: 640, cxw: 24, vc: 290, cxc: 22, wyc: -100, rs: 27, lsc: 1.35 } : { vw: 380, cxw: 24, vc: 126, cxc: 24, wyc: -62, rs: 30, lsc: 1.35 });
  const smlAX = () => FIN.wx + FIN.dir * (LY.port ? 78 : 84), smlAS = () => (LY.port ? 0.85 : 1);   // the stump in the aftermath, its scale
  const smlDip = (t) => { const k = fe(SML.LAND, SML.LAND + 240, t); return 7 * Math.sin(Math.PI * k) * (1 - 0.5 * k); };   // the plate gives under the landing
  const smlPlateAt = (t) => [FIN.wx + FIN.dir * SML_PX, SML_PY + smlDip(t)];
  function smlCam(t) {
    const Y = smlLay(), D = FIN.dir;
    if (t < SML.LAND) { const v = Y.vw * (1 - 0.04 * fe(MT.SPLASH, SML.LAND, t)); return { wx: FIN.wx + D * Y.cxw, wy: -0.4 * v, vh: v }; }
    const k = MG.reduced ? 1 : easeOut(fe(SML.LAND, SML.LAND + 260, t)), v = Y.vc * (0.88 + 0.12 * k) * (1 - 0.03 * fe(SML.LAND, MT.AFTER, t));   // the cut lands a hair too close and settles
    return { wx: FIN.wx + D * Y.cxc, wy: Y.wyc, vh: v };
  }
  function smlBuild() {
    const r = rnd(5150);
    smlFlecks = Array.from({ length: 12 }, (_, i) => { const sd = i % 2 ? 1 : -1, a = -Math.PI / 2 + sd * (0.5 + r() * 1.15); return { a, v: 70 + r() * 90, r: 1.4 + r() * 1.8, skin: r() < 0.35, x0: sd * (18 + r() * 14) }; });
  }
  // the near Raven (wide shot): hovering high above the plate, then (from DROP) up and away out of the top of the page
  function smlRavenNear(t) {
    const Y = smlLay(), D = FIN.dir, k = easeIn(fe(SML.DROP, SML.DROP + 260, t));
    return { x: FIN.wx + D * SML_PX - D * 0.35 * Y.vw * k, y: -0.73 * Y.vw + Math.sin(t * 0.012) * 4 - 0.45 * Y.vw * k, s: Y.rs };
  }
  // the loser's feet (world) and size while he hangs under the near Raven, then as he falls onto the plate (k: 0..1 of the fall)
  function smlLoserAt(t) {
    const Y = smlLay(), R = smlRavenNear(Math.min(t, SML.DROP)), h = (L_().s.h || 64) - 2, yA = R.y + 0.95 * R.s + h * Y.lsc, P = smlPlateAt(SML.LAND), k = fe(SML.DROP, SML.LAND, t), kk = k * k;
    return { x: R.x + (P[0] - R.x) * kk, y: yA + (P[1] - 4 - yA) * kk, sc: Y.lsc + (1 - Y.lsc) * kk, k };
  }
  // Odin under the plate: both hands up under its rim in the wide shot; once it has landed one hand holds it up from below, the other rests, then comes up to shoo
  function smlPoseW(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor, py = SML_PY + 5 + smlDip(t);
    P.mouth = 0; P.exK = 1; P.expr = t >= SML.HOP1 + 60 ? "calm" : undefined;
    if (t < SML.LAND) { P.lean = -0.05; return { hF: [SML_PX + 2, py], hB: [SML_PX - 24, py + 4] }; }
    P.lean = -0.02;
    const rest = [-w * 0.62, -leg - tor * 0.42], up = [SML_PX - 66, SML_PY + 2], k = ease(fe(SML.HAND, SML.SHOO, t)) * (1 - ease(fe(SML.HOP1 + 20, SML.HOP1 + 180, t)));
    const fl = Math.sin(Math.PI * fe(SML.SHOO, SML.SHOO + 90, t)) * 4;   // the flick
    return { hF: [SML_PX + 1, py], hB: [rest[0] + (up[0] - rest[0]) * k + fl, rest[1] + (up[1] - rest[1]) * k - fl * 0.5] };
  }
  // the loser: hanging by his head (limp arms, dangling feet, a slow swing), then falling (arms flailing up)
  function smlPoseL(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor;
    P.expr = "terror"; P.exK = 1; P.mouth = 1;
    if (t < SML.DROP) {
      const s = Math.sin(t * 0.03);
      P.lean = 0.1 * Math.sin(t * 0.011);
      return { hF: [w * 0.72, -leg - tor * 0.3 + 3 * s], hB: [-w * 0.66, -leg - tor * 0.26 - 3 * s], fF: [w * 0.16, 7 + 2 * s], fB: [-w * 0.14, 9 - 2 * s] };
    }
    const s = Math.sin(t * 0.07);
    P.lean = 0;
    return { hF: [w * 0.7, -leg - tor * 1.2 + 5 * s], hB: [-w * 0.62, -leg - tor * 1.15 - 5 * s], fF: [w * 0.3, -5], fB: [-w * 0.24, -1] };
  }
  // where the Raven sits on Odin's back shoulder (its middle, world) with Odin standing at x
  function smlShoulder(t, x, s) {
    const W = W_(); MG.pt = t;
    const P = pose(W, mgTk(t)), u = -P.w * 0.38, q = Math.max(0, 1 - (u / P.rx) * (u / P.rx));
    return [x + W.facing * u, P.cy - P.ry * Math.sqrt(q) - 0.62 * s + 1];
  }
  // the Raven in the close shot (world): in from above behind him onto the plate's back rim (facing the potato), the pecks, the hop onto his shoulder; null before
  function smlRavenClose(t) {
    if (t < SML.RAV0) return null;
    const D = FIN.dir, s = 7.5, Pl = smlPlateAt(t), rim = [Pl[0] - D * 41, Pl[1] - 0.62 * s];
    if (t < SML.RAV1) {
      const k = ease(fe(SML.RAV0, SML.RAV1, t)), m = 1 - k, a = [rim[0] - D * 120, rim[1] - 110], cp = [rim[0] - D * 55, rim[1] - 24];
      return { x: m * m * a[0] + 2 * m * k * cp[0] + k * k * rim[0], y: m * m * a[1] + 2 * m * k * cp[1] + k * k * rim[1], s, fl: Math.sin(t * 0.04) * (1 - 0.7 * k), perched: false };
    }
    if (t < SML.SHOO + 20) { let pk = 0; for (const p of SML.PECK) pk = Math.max(pk, Math.sin(Math.PI * fe(p, p + 100, t))); return { x: rim[0], y: rim[1], s, fl: 0, perched: true, peck: pk }; }
    const sh = smlShoulder(t, FIN.wx, s), k = fe(SML.SHOO + 20, SML.HOP1, t);
    if (k < 1) return { x: lerp(rim[0], sh[0], k), y: lerp(rim[1], sh[1], k) - Math.sin(Math.PI * k) * 20, s, fl: Math.sin(t * 0.06), perched: false };
    return { x: sh[0], y: sh[1] - Math.sin(Math.PI * fe(SML.HOP1, SML.HOP1 + 120, t)) * 2, s, fl: 0, perched: true, caw: fe(SML.CAW, SML.CAW + 80, t) * (1 - fe(SML.CAW + 160, SML.CAW + 260, t)) };
  }
  // a Raven of smlRavenClose, tipped about its feet: forward to peck, back to caw
  function smlRaven(c, r) {
    const D = FIN.dir, fy = r.y + 0.6 * r.s, a = (r.peck || 0) * 0.75 - (r.caw || 0) * 0.35;
    c.save(); c.translate(r.x, fy); c.rotate(a * D); c.translate(-r.x, -fy);
    raven(c, r.x, r.y, r.s, r.fl, D, r.perched);
    c.restore();
  }
  // a ragged ellipse (the flesh, the split skin): j how deep the notches are
  function smlRag(c, rx, ry, cy, j, ph) {
    c.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * SML_TAU, r = 1 + (i % 2 ? j : -j * 0.5) * (0.7 + 0.3 * Math.sin(i * 2.3 + ph)), px = Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  // the tin plate, its middle at (x, y) (world, pn.world set), s its scale: the underside, the rim, the well, a shine
  function smlPlate(c, x, y, s, lw) {
    c.save(); c.translate(x, y); c.scale(s, s); lw /= s;
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = ink; c.lineWidth = lw;
    c.fillStyle = SML_PLATE_D; c.beginPath(); c.ellipse(0, 2.6, 40, 8, 0, 0, SML_TAU); c.fill(); c.stroke();
    c.fillStyle = SML_PLATE; c.beginPath(); c.ellipse(0, 0, 40, 8, 0, 0, SML_TAU); c.fill(); c.stroke();
    c.fillStyle = SML_PLATE_IN; c.lineWidth = lw * 0.7; c.beginPath(); c.ellipse(0, 0.6, 31, 5.6, 0, 0, SML_TAU); c.fill(); c.stroke();
    c.strokeStyle = "#ffffff"; c.lineWidth = lw * 1.2; c.beginPath(); c.ellipse(0, 0, 36, 6.4, 0, Math.PI * 1.1, Math.PI * 1.42); c.stroke();
    c.restore();
  }
  // a salt flake: a little white cube standing on (x, y) (its lowest corner), a its size
  function smlSalt(c, x, y, a, lw) {
    const h = a * 0.87;
    c.lineJoin = "round"; c.strokeStyle = ink; c.lineWidth = lw;
    for (const [f, pts] of [["#ffffff", [[x, y - 2 * a], [x + h, y - 1.5 * a], [x, y - a], [x - h, y - 1.5 * a]]], ["#dfe5ec", [[x - h, y - 1.5 * a], [x, y - a], [x, y], [x - h, y - 0.5 * a]]], ["#b9c2cd", [[x, y - a], [x + h, y - 1.5 * a], [x + h, y - 0.5 * a], [x, y]]]]) {
      c.fillStyle = f; mgPoly(c, pts); c.fill(); c.stroke();
    }
  }
  // a rosemary sprig centred on (x, y), turned by a: a stem and eight needles
  function smlSprig(c, x, y, a, lw) {
    c.save(); c.translate(x, y); c.rotate(a); c.lineCap = "round";
    c.strokeStyle = ink; c.lineWidth = 1.3 + lw * 2; c.beginPath(); c.moveTo(-11, 0); c.lineTo(11, 0); c.stroke();
    c.strokeStyle = SML_STEM; c.lineWidth = 1.3; c.stroke();
    c.fillStyle = SML_LEAF; c.strokeStyle = ink; c.lineWidth = lw * 0.6;
    for (let i = 0; i < 8; i++) { c.save(); c.translate(-8.5 + i * 2.6, 0); c.rotate((i % 2 ? 1 : -1) * 0.8 - 0.35); c.beginPath(); c.ellipse(2.7, 0, 3, 1, 0, 0, SML_TAU); c.fill(); c.stroke(); c.restore(); }
    c.restore();
  }
  // the loser as a smashed potato sitting on (x, y) (the plate's middle, world), s its scale: the flesh squashed out flat all round, his skin a low dome split along
  // its foot, his face on its front, the eyes far apart. o: { wince, blink, relief, look [dx, dy], salt (k 0..1.6: falling, landed, settled; null none), sprig (k; null none) }
  function smlSmash(c, pn, x, y, s, lw, t, o) {
    const D = FIN.dir, sp = (u, v) => pn.sp(x + u * s, y + v * s);
    c.save(); c.translate(x, y); c.scale(s, s); lw /= s;
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = ink; c.lineWidth = lw;
    c.fillStyle = SML_FLESH; smlRag(c, 37, 5.2, -2.2, 0.08, 1); c.fill(); c.stroke();   // the flesh, squashed out under him
    if (!MG.slow) { c.save(); c.clip(); mgToneFill(c, [sp(D * 14, -9), sp(D * 42, -9), sp(D * 42, 5), sp(D * 14, 5)], 6, 0.38); c.restore(); }
    const dome = () => {
      c.beginPath(); c.moveTo(-31, -3);
      c.bezierCurveTo(-29, -13, -13, -16.5, 0, -16.5); c.bezierCurveTo(13, -16.5, 29, -13, 31, -3);
      for (let i = 1; i < 16; i++) c.lineTo(31 - (62 * i) / 16, -3 + (i % 2 ? -2.4 : 0.8) + 0.8 * Math.sin(i * 1.7));   // the split foot of the skin
      c.closePath();
    };
    c.fillStyle = col(L_().pal); dome(); c.fill();
    if (!MG.slow) { c.save(); dome(); c.clip(); mgToneFill(c, [sp(D * 19, -22), sp(D * 34, -22), sp(D * 34, 0), sp(D * 19, 0)], 6, 0.4); c.restore(); }
    dome(); c.stroke();
    c.lineWidth = lw * 0.75; c.beginPath();   // cracks running up from the split
    for (const u of [-24, -7, 6, 24]) { c.moveTo(u, -4.2); c.lineTo(u + 1.6, -7.2); c.lineTo(u - 0.8, -9.6); }
    c.stroke();
    // the face: open (looking about), blinking, squeezed shut (> <), or shut in relief
    const ey = -9.6, lk = o.look || [0, 0], wince = o.wince > 0;
    for (const sd of [-1, 1]) {
      const ex = sd * 15.5;
      c.lineWidth = lw * 1.15;
      if (wince) { c.beginPath(); c.moveTo(ex - sd * 4, ey - 2.8); c.lineTo(ex + sd * 2.2, ey); c.lineTo(ex - sd * 4, ey + 2.8); c.stroke(); }
      else if (o.relief) { c.beginPath(); c.arc(ex, ey + 2, 3.8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
      else {
        c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, 5.4, o.blink ? 0.7 : 4.4, 0, 0, SML_TAU); c.fill(); c.stroke();
        if (!o.blink) { c.fillStyle = ink; c.beginPath(); c.arc(ex + lk[0] * 2.6, ey + lk[1] * 2, 2.1, 0, SML_TAU); c.fill(); }
      }
    }
    c.lineWidth = lw; c.beginPath();
    if (wince) { c.moveTo(-3.6, -5.4); for (let i = 1; i <= 4; i++) c.lineTo(-3.6 + i * 1.8, -5.4 + (i % 2 ? -1.3 : 0)); }
    else if (o.relief) { c.moveTo(-3, -6); c.quadraticCurveTo(0, -3.9, 3, -6); }
    else { c.moveTo(-3.2, -5.4); c.quadraticCurveTo(-1.6, -6.8, 0, -5.4); c.quadraticCurveTo(1.6, -4, 3.2, -5.4); }
    c.stroke();
    if (wince) {   // a sweat drop flies off
      const dx = D * 27, dy = -22;
      c.fillStyle = COL; c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(dx, dy - 4); c.quadraticCurveTo(dx + 2.8, dy, dx, dy + 1.9); c.quadraticCurveTo(dx - 2.8, dy, dx, dy - 4); c.fill(); c.stroke();
    }
    if (o.sprig !== null && o.sprig !== undefined) { const k = Math.min(1, o.sprig), m = 1 - k; smlSprig(c, -7 * D + 8 * Math.sin(k * 9) * m, -17 - 120 * m, 0.16 * D + 0.8 * Math.sin(k * 7) * m, lw); }
    if (o.salt !== null && o.salt !== undefined) { const k = Math.min(1, o.salt); smlSalt(c, 9 * D, -15.6 - 120 * (1 - k * k) - 4 * Math.sin(Math.PI * fe(1, 1.6, o.salt)), 3.4, lw); }
    c.restore();
  }
  // the fist with two fingers out along ang (world units, pn.world set)
  function smlFingers(c, h, ang, lw, fl) {
    c.save(); c.translate(h[0], h[1]); c.rotate(ang); c.lineJoin = "round"; c.strokeStyle = ink; c.lineWidth = lw; c.fillStyle = FIST;
    for (const oy of [-1.45, 1.45]) { c.beginPath(); c.roundRect(2, oy - 1.4, 8.5, 2.8, 1.4); c.fill(); c.stroke(); }
    c.beginPath(); c.arc(0, 0, 4.6, 0, SML_TAU); c.fill(); c.stroke();
    if (fl > 0.05) {   // the flick's marks, on the side it flicks to (up)
      const a0 = FIN.dir > 0 ? -0.9 : 0.2, a1 = FIN.dir > 0 ? -0.2 : 0.9;
      c.lineWidth = lw * 0.8; c.globalAlpha = Math.min(1, fl * 2); c.beginPath(); c.arc(0, 0, 14, a0, a1); c.moveTo(16.5 * Math.cos(a0 + 0.15), 16.5 * Math.sin(a0 + 0.15)); c.arc(0, 0, 16.5, a0 + 0.15, a1 - 0.1); c.stroke();
    }
    c.restore();
  }
  // the splash's ground: a field of snow (Judgement's slab is too heavy under a tall close shot), a little tone further down
  function smlGround(c, pn) {
    pn.world(c);
    const x0 = FIN.wx - 420, x1 = FIN.wx + 420;
    c.beginPath(); c.moveTo(x0, 6);
    for (let x = x0; x < x1; x += 11) { const h = 3 + ((Math.round(x) * 7919) % 5) * 1.1, q = (Math.round(x) * 31 % 7) / 7; c.quadraticCurveTo(x + 5.5, -h - 3 - q * 2, x + 11, 2 + q); }
    c.lineTo(x1, 6); c.lineTo(x1, 400); c.lineTo(x0, 400); c.closePath(); c.fillStyle = SNOW; c.fill(); c.lineWidth = 2.4 / pn.z; c.strokeStyle = ink; c.stroke();
    pn.screen(c);
    const g = pn.p(0, 14)[1];
    if (g < pn.y1) mgToneFill(c, [[pn.x0 - 4 + pn.ox, g + pn.oy], [pn.x1 + 4 + pn.ox, g + pn.oy], [pn.x1 + 4 + pn.ox, pn.y1 + 4 + pn.oy], [pn.x0 - 4 + pn.ox, pn.y1 + 4 + pn.oy]], 7, 0.22, [0, 0]);
  }
  // the splash: the wide shot (Raven, loser, Odin far below with the plate) to the landing, then the close shot of the plate over his head
  function smlDrawSplash(c, pn, t) {
    const D = FIN.dir, W = W_(), Lp = L_(), lw = fzfLw(pn), OX = FIN.wx, close = t >= SML.LAND, Pl = smlPlateAt(t);
    const tone = (poly, size, cover, drift) => mgToneFill(c, poly.map(([x, y]) => [x + pn.ox, y + pn.oy]), size, cover, drift);
    pn.screen(c);
    for (let i = 0; i < 3; i++) { const h = pn.h * (0.09 + 0.07 * i); tone([[pn.x0 - 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 + h], [pn.x0 - 4, pn.y0 + h]], 8, 0.42 - 0.13 * i, [t * 0.0006, 0]); }
    const Q = pn.p(Pl[0], Pl[1] - 6), R = Math.hypot(pn.w, pn.h);
    mgFocus(c, Q[0], Q[1], R, t * 0.0004, close ? 0.32 : 0.22);
    smlGround(c, pn);
    tone([pn.p(OX - 30, 0.5), pn.p(OX + 30, 0.5), pn.p(OX + 26, 6), pn.p(OX - 26, 6)], 6, 0.45);   // his shadow
    const fallK = fe(SML.DROP, SML.LAND, t), Lq = !close ? smlLoserAt(t) : null;
    if (Lq && fallK > 0) {   // speed lines up the fall
      const a = pn.p(Lq.x, Lq.y - 40 * Lq.sc), b = pn.p(Lq.x, smlRavenNear(SML.DROP).y);
      mgSpeed(c, a[0], (a[1] + b[1]) / 2 - 20, Math.abs(a[1] - b[1]) + 60, 80 * pn.z, Math.PI / 2, -t * 1.4, 0.45 * fe(SML.DROP, SML.DROP + 60, t), false, 1);
    }
    if (close) {   // the landing: a white burst behind the plate
      const kb = fe(SML.LAND, SML.LAND + 110, t);
      if (kb < 1 && !MG.reduced) mgStarburst(c, Q[0], Q[1], 0.36 * Math.min(pn.w, pn.h) * easeOut(Math.min(1, kb * 2.2)) * (1 - 0.4 * kb), 0.25);
    }
    const ox = W.x; W.x = OX; mgPuppet(c, pn, W, t, { light: dirAng(-0.5) }); W.x = ox;
    pn.world(c);
    smlPlate(c, Pl[0], Pl[1], 1, lw);
    if (!close) {
      // the loser: hanging, then falling with three after-images (copies of the same picture, where he was 24, 48, 72 ms ago)
      const q = Lq, ghosts = [];
      if (q.k > 0 && !MG.slow) for (const [dt, al] of [[24, 0.42], [48, 0.27], [72, 0.15]]) { if (t - dt < SML.DROP) break; const g = smlLoserAt(t - dt); ghosts.push([(g.x - q.x) * pn.z, (g.y - q.y) * pn.z, al]); }
      const lx = Lp.x, ly = Lp.y, ls = Lp.state, lf = Lp.facing;
      Lp.x = q.x; Lp.y = q.y; Lp.state = "fin"; Lp.flash = 0; Lp.facing = -D;
      try { mgPuppet(c, pn, Lp, t, { sc: q.sc, light: dirAng(-0.5), ghosts }); } finally { Lp.x = lx; Lp.y = ly; Lp.state = ls; Lp.facing = lf; }
      pn.world(c);
      const Rn = smlRavenNear(t), s = Rn.s, open = fe(SML.DROP, SML.DROP + 60, t);
      if (open < 1) {   // the talons on the top of his head, opening as it lets go
        c.strokeStyle = ink; c.lineWidth = Math.max(lw * 1.2, 0.08 * s); c.lineCap = "round";
        for (const sd of [-1, 1]) {
          const bx = Rn.x + sd * 0.14 * s, tx = Rn.x + sd * (0.1 + 0.25 * open) * s, ty = Rn.y + (0.93 - 0.15 * open) * s;
          c.beginPath(); c.moveTo(bx, Rn.y + 0.4 * s); c.lineTo(tx, ty); c.quadraticCurveTo(tx + sd * 0.12 * s, ty + 0.1 * s, tx - sd * 0.04 * s, ty + 0.12 * s); c.stroke();
        }
      }
      raven(c, Rn.x, Rn.y, s, Math.sin(t * 0.045), D, false);
      pn.screen(c);
      return;
    }
    // the close shot: the smashed potato, the garnish, the flecks of the landing, the crumbs of the pecks, the Raven, the shooing fingers
    let wince = t < SML.LAND + 110 ? 1 : 0;
    for (const p of SML.PECK) if (t >= p + 20 && t < p + 150) wince = 1;
    const look = t < SML.SALT0 + 20 ? [0, 0] : t < SML.SALT + 40 ? [0.2 * D, -1] : t < SML.RAV0 ? [0, 0] : t < SML.CAW ? [-D, -0.6] : [-0.6 * D, 0.2];
    smlSmash(c, pn, Pl[0], Pl[1] - 0.5, 1, lw, t, { wince, look, blink: Math.abs(t - 3735) < 45, relief: t >= SML.CAW + 80,
      salt: t >= SML.SALT0 ? fe(SML.SALT0, SML.SALT, t) + 0.6 * fe(SML.SALT, SML.SALT + 100, t) : null, sprig: t >= SML.SPRIG0 ? fe(SML.SPRIG0, SML.SPRIG, t) : null });
    pn.world(c);
    const u = (t - SML.LAND) / 1000;
    if (u < 0.42) {   // the landing: impact ticks round the plate, chunks of potato flying out and falling
      const ka = 1 - fe(SML.LAND + 60, SML.LAND + 180, t);
      if (ka > 0) {
        c.strokeStyle = ink; c.lineWidth = lw * 1.3; c.lineCap = "round"; c.beginPath();
        for (let i = 0; i < 10; i++) { const a = Math.PI + (i / 9) * Math.PI, r0 = 1 + 0.12 * ka; c.moveTo(Pl[0] + Math.cos(a) * 44 * r0, Pl[1] - 6 + Math.sin(a) * 18 * r0); c.lineTo(Pl[0] + Math.cos(a) * (52 + 10 * ka), Pl[1] - 6 + Math.sin(a) * (24 + 8 * ka)); }
        c.stroke();
      }
      c.lineWidth = lw * 0.8; c.globalAlpha = 1 - fe(0.28, 0.42, u);
      for (const f of smlFlecks) {
        const x = Pl[0] + f.x0 + Math.cos(f.a) * f.v * u, y = Pl[1] - 8 + Math.sin(f.a) * f.v * u + 300 * u * u;
        c.fillStyle = f.skin ? col(Lp.pal) : SML_FLESH; c.beginPath(); c.ellipse(x, y, f.r * 1.4, f.r * 0.9, f.a + u * 9, 0, SML_TAU); c.fill(); c.stroke();
      }
      c.globalAlpha = 1;
    }
    for (const p of SML.PECK) {   // two crumbs off each peck
      const v = (t - p - 40) / 1000;
      if (v < 0 || v > 0.32) continue;
      c.fillStyle = SML_FLESH; c.lineWidth = lw * 0.7;
      for (let j = 0; j < 2; j++) { const x = Pl[0] - D * (29 - (14 + 10 * j) * v * 3), y = Pl[1] - 9 - (50 + 24 * j) * v + 300 * v * v; c.beginPath(); c.arc(x, y, 1.3, 0, SML_TAU); c.fill(); c.stroke(); }
    }
    const r = smlRavenClose(t);
    if (r) smlRaven(c, r);
    const kh = fe(SML.HAND, SML.SHOO, t) * (1 - fe(SML.HOP1 + 20, SML.HOP1 + 140, t));
    if (kh > 0.3) {   // two fingers poke its tail feathers: the flick
      const h = handPt(W, t, "hB", OX), to = r ? [r.x - D * 1.6 * r.s, r.y] : [h[0] + D * 10, h[1] - 6];
      pn.world(c);
      const fk = Math.sin(Math.PI * fe(SML.SHOO, SML.SHOO + 110, t));
      smlFingers(c, h, Math.atan2(to[1] - h[1], to[0] - h[0]) - D * 0.6 * fk, lw, fk);
    }
    pn.screen(c);
  }
  // the stump in the aftermath: its foot on the ground at x, s its scale (its top at -20 s)
  function smlStump(c, x, s, lw) {
    c.save(); c.translate(x, 0); c.scale(s, s); lw /= s;
    c.strokeStyle = ink; c.lineWidth = lw; c.lineJoin = "round"; c.lineCap = "round";
    c.fillStyle = SML_BARK; c.beginPath(); c.moveTo(-15, -20); c.lineTo(-16, -3); c.quadraticCurveTo(-18, 0.5, -21, 1.5); c.lineTo(21, 1.5); c.quadraticCurveTo(18, 0.5, 16, -3); c.lineTo(15, -20); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = lw * 0.7; c.beginPath(); for (const bx of [-10, -3, 5, 11]) { c.moveTo(bx, -16); c.lineTo(bx + 0.8, -3); } c.stroke();
    c.fillStyle = SML_WOOD; c.lineWidth = lw; c.beginPath(); c.ellipse(0, -20, 15, 3.6, 0, 0, SML_TAU); c.fill(); c.stroke();
    c.restore();
  }
  // what the pop leaves on the plate: a greasy ring, three peck marks, the sprig (plate units like smlSmash)
  function smlLeft(c, x, y, s, lw) {
    const D = FIN.dir;
    c.save(); c.translate(x, y); c.scale(s, s); lw /= s; c.lineCap = "round";
    c.strokeStyle = SML_GREASE + "0.3)"; c.lineWidth = 7; c.beginPath(); c.ellipse(0, -0.4, 23, 4.4, 0, 0, SML_TAU); c.stroke();
    c.strokeStyle = SML_GREASE + "0.6)"; c.lineWidth = 2.6; c.stroke();
    c.strokeStyle = ink; c.lineWidth = lw * 0.9; c.beginPath();
    for (const [u, v] of [[-14, -1.6], [-8.5, 1.2], [-18, 1.6]]) { c.moveTo((u - 2) * D, v - 1.4); c.lineTo(u * D, v); c.lineTo((u + 2) * D, v - 1.4); }
    c.stroke();
    smlSprig(c, 7 * D, -1.2, 0.18 * D, lw);
    c.restore();
  }
  // the aftermath: Judgement's panel 4 (him, the spear on his shoulder) with the Raven beside his head and the plate on a stump beside him; popped: what is left
  function smlDrawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir, x = FIN.wx + D * 4, ax = smlAX(), s = smlAS(), lw = fzfLw(pn), popped = mgPopped(t), ps = 0.7 * s, py = -20 * s;
    const tone = (poly, size, cover, drift) => mgToneFill(c, poly.map(([px, qy]) => [px + pn.ox, qy + pn.oy]), size, cover, drift);
    pn.screen(c);
    tone([[pn.x0, pn.y0], [pn.x1, pn.y0], [pn.x1, pn.y0 + pn.h * 0.3], [pn.x0, pn.y0 + pn.h * 0.3]], 8, 0.38, [t * 0.0006, 0]);
    const q = pn.p(ax, -30);
    mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.4);
    peaks(c, pn, pn.p(0, 0)[1], pn.h * 0.18, 5);
    ground(c, pn);
    tone([pn.p(ax - 24 * s, 0.5), pn.p(ax + 24 * s, 0.5), pn.p(ax + 20 * s, 5.5), pn.p(ax - 20 * s, 5.5)], 6, 0.45);
    const ox = W.x; W.x = x; mgPuppet(c, pn, W, t, { light: dirAng(-0.5) }); W.x = ox;
    pn.screen(c);
    const sp = spearAt(t, x);   // the spear over his shoulder, in front of him; the fist is drawn again over it
    if (sp) {
      const g = pn.p(sp.gx, sp.gy); spear(c, g[0], g[1], sp.a, pn.z, 1);
      c.fillStyle = FIST; c.strokeStyle = ink; c.lineWidth = Math.max(2.4, 1.1 * pn.z); c.beginPath(); c.arc(g[0], g[1], 5 * pn.z, 0, 7); c.fill(); c.stroke();
    }
    pn.world(c);
    smlStump(c, ax, s, lw);
    smlPlate(c, ax, py, ps, lw);
    if (!popped) smlSmash(c, pn, ax, py - 0.5 * ps, ps, lw, t, { look: [-D * 0.8, -0.7], blink: Math.abs(t - 4990) < 55 || Math.abs(t - 5170) < 55, salt: 1.6, sprig: 1 });
    else smlLeft(c, ax, py, ps, lw);
    // the Raven on his back shoulder: a bob, a look at the plate now and then; the pop makes it flap up
    const rs = 7 * s, sh = smlShoulder(t, x, rs), up = popped ? Math.sin(Math.PI * fe(MT.POP, MT.POP + 380, t)) : 0, look = Math.sin(Math.PI * fe(MT.AFTER + 300, MT.AFTER + 520, t));
    smlRaven(c, { x: sh[0], y: sh[1] - 1.2 * Math.abs(Math.sin(t * 0.006)) - 9 * up, s: rs, fl: up > 0.02 ? Math.sin(t * 0.05) : 0, perched: up < 0.02, peck: 0.35 * look });
    pn.screen(c);
  }

  S_.alt2 = Object.assign({}, S_, {
    name: "Smash Landing",
    start(g) { S_.start(g); pota = true; pota2 = true; FIN.cue.back = FIN.cue.cawC = true; },   // (pota: the strike's flock and shards leave under the splash, as on Frozen Fries)
    end() { pota = false; pota2 = false; },
    build(lay) { S_.build(lay); smlBuild(); },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = smlDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 130 : 112) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + FIN.dir * (lay.port ? 48 : 44), wy: -0.46 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: SML_SKY, slide: MG.reduced ? 1 : 180, cam: smlCam, draw: smlDrawSplash,
        shake: (t) => { const a = t >= SML.LAND ? 4 * (1 - fe(SML.LAND, SML.LAND + 160, t)) : 0; return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; } }));
      return ps;
    },
    pose(P, sk, t, role, p) {
      if (pota2 && t >= MT.SPLASH && (role === "w" ? t < MT.AFTER : t < SML.LAND)) return role === "w" ? smlPoseW(P, sk, t) : smlPoseL(P, sk, t);
      return S_.pose(P, sk, t, role, p);
    },
    // the snow and the leaving flock stay only on what the splash has not covered yet (no snow on the plate)
    over(o, t) {
      if (t < MT.SPLASH) { odnOver(o, t); return; }
      const sp = MG.byId.splash;
      if (!sp || t >= sp.t0 + sp.slide) return;
      mgPlace(sp, t);
      o.save(); o.beginPath(); o.rect(0, 0, L.gw, Math.max(0, sp.y0 + sp.oy)); o.clip(); odnOver(o, t); o.restore();
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, kr = ws.find((w) => w.text === "KRASSHH");
      if (kr) kr.t1 = MT.SPLASH + 150;   // gone as the splash comes up
      const at = (tt, wx, wy) => () => { const pn = MG.byId.splash; mgPlace(pn, tt); const q = pn.sp(wx(), wy); return [q[0], q[1]]; };
      ws.push(
        { text: "SPLAT", t0: SML.LAND, t1: SML.RAV0 + 60, size: 0.15, mul: lay.port ? 0.55 : 1, arc: 7, jit: 0.16, jag: 0.08, rot: -0.08 * D,
          at: lay.port ? at(SML.LAND + 300, () => FIN.wx + D * (SML_PX - 6), -228) : at(SML.LAND + 300, () => FIN.wx + D * (SML_PX + 96), -86) },
        { text: "peck", t0: SML.PECK[0], t1: SML.HAND, size: 0.07, mul: lay.port ? 0.6 : 1, jit: 0.2, rot: 0.1 * D,
          at: at(4000, () => FIN.wx + D * (SML_PX - 44), -104) },
        { text: "caw", t0: SML.CAW, t1: MT.AFTER + 40, size: 0.07, mul: lay.port ? 0.6 : 1, jit: 0.2, rot: -0.1 * D,
          at: at(4500, () => FIN.wx - D * 46, -76) },
      );
      return ws;
    },
    food() { const x = smlAX(), s = smlAS(); return { x, y: 0, r: 24 * s, y0: -20 * s, lx: x + FIN.dir * (LY.port ? 24 : 38) }; },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("smlFlap", MT.SPLASH + 40, () => Cin.go(() => Cin.whoosh(0.3, -0.3 * D, 0.3 * D, 0.25)));
      cueOnce("smlDrop", SML.DROP, () => odnCaw(0.9, 720));
      cueOnce("smlFall", SML.DROP + 30, () => Cin.go(() => Cin._osc("sine", 1500, 420, 0.17, 0.05, 0.01)));
      cueOnce("smlSplat", SML.LAND, () => Cin.go(() => { Cin._noise(0.22, 0.55, 1400, 160, "lowpass", 0.9); Cin.sub(110, 40, 0.3, 0.6); Cin.clack(); }));
      cueOnce("smlSalt", SML.SALT, () => Cin.go(() => Cin.tick(5200)));
      cueOnce("smlSprig", SML.SPRIG, () => Cin.go(() => Cin._noise(0.08, 0.1, 2400, 5200, "bandpass", 1.6)));
      cueOnce("smlRav", SML.RAV0, () => Cin.go(() => Cin.whoosh(0.25, -0.6 * D, 0.1 * D, 0.3)));
      SML.PECK.forEach((p, i) => cueOnce("smlPeck" + i, p, () => Cin.go(() => { Cin.tick(2600 + i * 200); Cin._osc("triangle", 900, 1400, 0.09, 0.03, 0.004, 0.03); })));
      cueOnce("smlShoo", SML.SHOO, () => Cin.go(() => Cin.whoosh(0.14, 0, 0, 0.22)));
      cueOnce("smlCaw", SML.CAW, () => odnCaw(0.7, 620));
      cueOnce("smlPhew", SML.CAW + 160, () => Cin.go(() => Cin._noise(0.3, 0.05, 900, 500, "bandpass", 1.2)));
    },
  });
  return S_;
})();
