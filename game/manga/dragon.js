/* ===================== Manga page: Dragon, "Inferno" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Dragon, Inferno"). Times are ms after the final hit.
   300 the freeze (panel 1, engine) . 1250 panel 2 "the look": he grows, wings, tail whip, the inhale (embers into his mouth, the chest lights)
   2000 inset on the loser's eyes . 2350 panel 3 "the strike": mouth wide, the drop at 2780, 2900 the roar (impact frames, the flame cone),
   3080 the loser pops out like a cork (the Dragon bends the 2900 beat by hit 2900 / pop 3080) . 3500 panel 4: he shrinks back, the smirk, a smoke ring.
   Script fields: col, name, hit, pop, flight (id of the panel the loser flies out of), panels(lay), words(lay), build(lay), step(t, k), pose(P, sk, t, role, p),
   after(t), over(o, t), cues(t), drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt(). */
MANGA.dragon = (function () {
  const COL = "#ff8a3d", CORE = "#fff4d6", FLAME_DARK = "#d93a24";
  let ash = [], embers = [], smoke = [], rnd = Math.random;
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  // the Dragon's size: a potato (1) who grows to 1.6 over 600 ms in panel 2, and shrinks back over 400 ms in panel 4
  const grow = (t) => 1 + 0.6 * ease(fe(1250, 1850, t)) - 0.6 * ease(fe(3500, 3900, t));
  // where things are on a puppet (world units), from its own pose
  function bodyPt(p, t, sc, key) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot(P[key], P.hip, P.lean);
    return [p.x + p.facing * q[0] * sc, p.y + q[1] * sc];
  }
  const mouthW = (t) => bodyPt(W_(), t, grow(t), "mouthPt");
  const headL = (t) => bodyPt(L_(), t, 1, "head");
  // the tail's tip in fighter space over time (one lash across the slab, 1450-1950)
  function tailTip(t, w, leg, tor) {
    const rest = [-w * 1.3, -leg * 0.4];
    if (t < 1450 || t > 1950) return null;
    if (t < 1620) { const k = ease(fe(1450, 1620, t)); return [rest[0] + (-w * 0.9 - rest[0]) * k, rest[1] + (-tor * 1.5 - rest[1]) * k]; }
    if (t < 1800) { const k = easeOut(fe(1620, 1800, t)); return [-w * 0.9 + (w * 1.5 + w * 0.9) * k, -tor * 1.5 + (-8 + tor * 1.5) * k]; }
    const k = ease(fe(1800, 1950, t)); return [w * 1.5 + (rest[0] - w * 1.5) * k, -8 + (rest[1] + 8) * k];
  }
  // a point of the page (shares of its area, drawn for a winner on the left; mirrored when he is on the right), in css px
  const pg = (fx, fy) => [MG.page.x + (FIN.dir > 0 ? fx : 1 - fx) * MG.page.w, MG.page.y + fy * MG.page.h];
  // his wings, grown: the game's own bat wing drawn bigger behind him, through the same ink (the bones stay the wing's own)
  function wingsUnder(p, t) {
    const spread = ease(fe(MT.LOOK, 1700, t)) * (1 - ease(fe(3500, 3900, t)));
    if (spread < 0.05) return null;
    return (lc) => {
      const P = pose(p, mgTk(t)), len = P.w * 0.95 * (1 + 0.85 * spread);
      const a1 = rot([-P.w * 0.3, P.cy + P.ry * 0.1], P.hip, P.lean), a2 = rot([P.w * 0.2, P.cy + P.ry * 0.05], P.hip, P.lean), fl = P.flap - P.wingUp * 0.9;
      batWing(lc, a1[0], a1[1], Math.PI + 0.18 - fl + P.lean, len, p.pal, true, true);
      batWing(lc, a2[0], a2[1], -0.25 + fl * 0.7 + P.lean, len * 0.9, p.pal, false, false);
    };
  }
  const lbs = (t) => (t >= MANGA.dragon.pop ? finTrav((t - MANGA.dragon.pop) / FMS) : 0);   // the loser's flight, world units after the pop

  /* ---- panels ---- */
  function panels(lay) {
    const port = lay.port;
    const D = FIN.dir;
    return [
      { id: "look", t0: MT.LOOK, from: "w", freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0], [1, 0], [1, 0.40], [0, 0.43]] : [[0, 0], [0.47, 0], [0.43, 1], [0, 1]],
        cam: (t) => { const vh = 105 * grow(t) * (1 - 0.07 * fe(MT.LOOK, MT.STRIKE, t)); return { wx: FIN.wx + D * 6, wy: -0.36 * vh, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "l", slide: 140, live: true,
        poly: port ? [[0.5, 0.3], [0.98, 0.28], [0.98, 0.5], [0.5, 0.52]] : [[0.37, 0.05], [0.64, 0.02], [0.61, 0.4], [0.34, 0.43]],
        cam: (t) => { const h = headL(Math.min(t, 2350)); return { wx: h[0], wy: h[1], vh: 24 - 3 * fe(MT.INSET, MT.STRIKE, t) }; },
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.AFTER, cover: MT.AFTER,
        poly: port ? [[0, 0.38], [1, 0.36], [1, 0.72], [0, 0.74]] : [[0, 0.37], [1, 0.29], [1, 1], [0, 1]],
        cam: (t) => { const k = fe(MT.STRIKE, MT.AFTER, t), vh = (port ? 205 : 150) * (1 - 0.05 * k); return { wx: FIN.wx + D * (port ? 74 : 98 + 12 * k), wy: -(port ? 0.36 : 0.34) * vh, vh }; },
        shake: (t) => { const a = 4 * fe(MT.HIT, MT.HIT + 40, t) * (1 - fe(3300, 3500, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b", live: true,
        poly: port ? [[0, 0.68], [1, 0.66], [1, 1], [0, 1]] : [[0, 0.44], [0.66, 0.41], [0.62, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 112 : 96) * (1 - 0.07 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + D * 8, wy: -0.45 * vh, vh }; },
        draw: drawAfter },
    ];
  }

  /* ---- the world under a panel: the slab as one flat ink shape, tufts of grass ---- */
  function ground(c, pn, t, burn) {
    pn.world(c);
    const x0 = FIN.wx - 400, x1 = FIN.wx + 400;
    c.fillStyle = MG_INK; c.fillRect(x0, 0, x1 - x0, 90);
    // grass tufts along the top edge (the cone sets them alight)
    c.beginPath();
    for (let x = x0; x < x1; x += 13) { const h = 3 + ((x * 7919) % 5), ok = !burn || !burn(x); if (ok) { c.moveTo(x, 0.5); c.lineTo(x + 2.5, -h); c.lineTo(x + 5.5, 0.5); } }
    c.fillStyle = MG_INK; c.fill();
  }

  /* ---- panel 2: the look ---- */
  function drawLook(c, pn, t) {
    const W = W_(), s = grow(t), u = fe(MT.LOOK, MT.STRIKE, t), inhale = fe(1700, 2350, t), power = fe(1250, 2300, t);
    pn.screen(c);
    // behind him: a screen of dots in a disc that grows with the power, then the focus lines
    const [fx, fy] = pn.p(...bodyPt(W, t, s, "head"));
    const R = Math.hypot(pn.w, pn.h);
    mgToneFill(c, discPoly(fx, fy, pn.h * (0.62 + 0.18 * power), 40), 10, 0.22 + 0.2 * power, [t * 0.001, -t * 0.001]);
    c.beginPath(); c.arc(fx, fy, pn.h * (0.4 + 0.1 * power), 0, Math.PI * 2); c.fillStyle = MG_PAPER; c.fill();
    mgFocus(c, fx, fy, R * 0.95, t * 0.00035, 0.55 + 0.4 * power);
    ground(c, pn, t);
    // the tail's ash sweep across the slab
    pn.world(c);
    const MP = 1;
    if (t > 1620 && t < 2250) {
      const pts = [];
      for (let q = 0; q < 9; q++) { const tt = Math.min(1950, t - q * 22), tip = tailTip(tt, W.s.w, W.s.h * W.spec.look.leg, W.s.h * W.spec.look.torso); if (tip) pts.push([W.x + W.facing * tip[0] * s, W.y + tip[1] * s]); }
      if (pts.length > 2) { c.fillStyle = `rgba(40,34,48,${(0.38 * (1 - fe(1950, 2250, t))).toFixed(3)})`; brush(c, pts, 16 * s, pts.length - 1); }
    }
    // him
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s), under: wingsUnder(W, t) });
    pn.screen(c);
    // the squint: nothing drawn, it is in the face (pose). The edge of the page darkens as the power gathers: a 70% screen creeping in from the corners
    if (power > 0.3) {
      const q = (power - 0.3) / 0.7, d = 0.18 * q * pn.w;
      mgToneFill(c, [[pn.x0, pn.y0], [pn.x0 + d * 1.6, pn.y0], [pn.x0, pn.y0 + d * 1.6]], 7, 0.5);
      mgToneFill(c, [[pn.x1, pn.y1], [pn.x1 - d * 1.6, pn.y1], [pn.x1, pn.y1 - d * 1.6]], 7, 0.5);
    }
  }
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const discPoly = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 6.2832) * r, cy + Math.sin((i / n) * 6.2832) * r]);
  // the belly lights up: hard concentric rings of the accent (no gradients), source-atop on the body
  function chestGlow(p, t, s) {
    const k = fe(1700, 2300, t) * (1 - fe(3600, 3900, t));
    if (k <= 0.02) return null;
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot([P.rx * 0.18, P.cy + P.ry * 0.55], P.hip, P.lean);
    return (lc, X) => {
      const cx = X.sx + p.facing * q[0] * X.z, cy = X.sy + q[1] * X.z, ry = P.ry * X.z;
      for (const [r, a, col] of [[0.95, 0.30, COL], [0.68, 0.5, COL], [0.44, 0.78, COL], [0.2, 0.95, CORE]]) {
        lc.fillStyle = rgba(col, a * k); lc.beginPath(); lc.ellipse(cx, cy, ry * r * 1.15, ry * r * 0.9, 0, 0, Math.PI * 2); lc.fill();
      }
    };
  }

  /* ---- the inset: the loser's eyes ---- */
  function drawInset(c, pn, t) {
    const Lp = L_(), u = fe(MT.INSET, MT.STRIKE, t), lit = u;
    pn.screen(c);
    const [fx, fy] = pn.p(...headL(Math.min(t, 2350)));
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0005, 0.8);
    // the light of the coming fire: a screen of dots and the accent, growing from the winner's side until the whole inset is lit
    const edge = pn.x0 + (FIN.dir > 0 ? 0 : pn.w) + (FIN.dir > 0 ? 1 : -1) * pn.w * (0.15 + 0.95 * lit);
    const lp = FIN.dir > 0 ? [[pn.x0 - 10, pn.y0 - 10], [edge, pn.y0 - 10], [edge - pn.h * 0.2, pn.y1 + 10], [pn.x0 - 10, pn.y1 + 10]] : [[pn.x1 + 10, pn.y0 - 10], [edge, pn.y0 - 10], [edge + pn.h * 0.2, pn.y1 + 10], [pn.x1 + 10, pn.y1 + 10]];
    c.save(); c.globalAlpha = 0.55 * lit; c.fillStyle = COL; mgPoly(c, lp); c.fill(); c.restore();
    mgPuppet(c, pn, Lp, Math.min(t, 2350) + 0, { sc: 1, light: dirAng(-0.6), tint: 0.5, post: (lc, X) => { lc.fillStyle = rgba(COL, 0.5 * lit); lc.fillRect(0, 0, MG.cw, MG.ch); } });
  }

  /* ---- panel 3: the strike ---- */
  const coneLen = (t) => 400 * easeOut(fe(FIN.hit, FIN.hit + 140, t)) * (1 - easeIn(fe(3300, 3500, t)));
  function drawStrike(c, pn, t) {
    const W = W_(), s = grow(t), H0 = FIN.hit, pop = S_.pop;
    const m = mouthW(t), len = coneLen(t), tgt = [FIN.lx, -30], ang = Math.atan2(tgt[1] - m[1], tgt[0] - m[0]);
    pn.screen(c);
    // behind: the dark creeps in from the top (cut tone), then rays at the roar
    const k1 = fe(MT.STRIKE, H0, t);
    for (let i = 0; i < 3; i++) { const h = pn.h * (0.1 + 0.07 * i) * (0.3 + 0.7 * k1); mgToneFill(c, [[pn.x0, pn.y0], [pn.x1, pn.y0], [pn.x1, pn.y0 + h], [pn.x0, pn.y0 + h]], 6, 0.18 + 0.2 * i, [t * 0.001, 0]); }
    const mp = pn.p(m[0], m[1]);
    if (t >= H0) mgFocus(c, mp[0], mp[1], Math.hypot(pn.w, pn.h), t * 0.0006, 0.75 * (1 - 0.5 * fe(H0, 3300, t)));
    mgSpeed(c, pn.cx, pn.cy, pn.w, pn.h * 0.5, 0, -t * 0.4 * FIN.dir, 0.35 * fe(2500, 2800, t) * (1 - fe(H0, H0 + 60, t)), false, 1);
    const burnX = (x) => len > 20 && Math.abs(x - FIN.wx) < len * 0.9 + 20 && (x - FIN.wx) * FIN.dir > 60;
    ground(c, pn, t, burnX);
    pn.world(c);
    if (len > 4) drawCone(c, m, ang, len, t, false, 0);
    // the smear of the lunge (the one place with ghosts of the Dragon)
    if (t > 2840 && t < 3040 && !MG.slow) { mgPuppet(c, pn, W, t - 60, { sc: s, a: 0.18, light: dirAng(-0.6), tone: false }); mgPuppet(c, pn, W, t - 30, { sc: s, a: 0.35, light: dirAng(-0.6), tone: false }); }
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s), under: wingsUnder(W, t) });
    // the loser stands in the fire as a black shape, then pops out of the far end
    if (!MG.broke) drawLoserFn(c, pn, t);
    pn.world(c);
    if (len > 4) {   // the white-hot core runs from his mouth up to the victim, and on past it once he is gone
      const dl = Math.hypot(FIN.lx - m[0], -30 - m[1]);
      drawCone(c, m, ang, len, t, true, t < pop + 40 ? Math.min(len, dl - 26) : len);
    }
    // first flames lick between his teeth
    if (t > 2400 && t < H0) {
      const q = fe(2400, 2780, t);
      for (let i = 0; i < 3; i++) { const f = 0.6 + 0.4 * Math.sin(t * 0.03 + i * 2); tongue(c, m[0] + FIN.dir * (3 + i * 3.2), m[1] - 1, (5 + 11 * q) * f, 2.2, FIN.dir * 1.5, COL, CORE); }
    }
    // the victim burns: tongues licking up his body, one small flame on the sprout
    if (t >= H0 && t < pop + 120 && !MG.broke) {
      const lp = loserAt(t), hh = L_().s.h, fade = 1 - fe(pop, pop + 120, t);
      for (let i = 0; i < 6; i++) {
        const fx_ = lp[0] + (i - 2.5) * 8 * FIN.dir, h = (16 + 12 * Math.sin(t * 0.03 + i * 1.7)) * fade * (1 - 0.35 * (i % 3) * 0.5), y = lp[1] - 4 - (i % 3) * hh * 0.2;
        tongue(c, fx_, y, h * 1.15, 6.4, Math.sin(t * 0.02 + i) * 2, MG_INK, null); tongue(c, fx_, y, h, 4.6, Math.sin(t * 0.02 + i) * 2.5, COL, CORE);
      }
      const hd = headL(Math.min(t, pop)), top = hd[1] - hh * 0.34, f2 = 0.8 + 0.2 * Math.sin(t * 0.04);
      tongue(c, hd[0], top, 15 * f2 * fade, 7.4, 0, MG_INK, null); tongue(c, hd[0], top, 12 * f2 * fade, 5.2, 0, COL, CORE);
    }
    // the grass takes fire along the cone and goes on burning, lower, after the cone is gone; smoke rises from it
    const reach = 400 * easeOut(fe(H0, H0 + 140, t)) * 0.9 + 70, calm = 1 - 0.55 * fe(3300, 3500, t);
    if (reach > 80) for (let x = FIN.wx + FIN.dir * 80; Math.abs(x - FIN.wx) < reach; x += FIN.dir * 17) {
      const k = clamp((reach - Math.abs(x - FIN.wx)) / 60, 0, 1), h = (13 + ((x * 31) % 11)) * k * calm * (0.75 + 0.25 * Math.sin(t * 0.03 + x));
      c.save(); c.translate(x, 0); tongue(c, 0, 1, h * 1.12, 6.4, 0, MG_INK, null); tongue(c, 0, 0, h, 4.6, Math.sin(t * 0.02 + x) * 2.5, COL, CORE); c.restore();
    }
    if (t > 3250) {
      pn.screen(c);
      for (let i = 0; i < 3; i++) {
        const k = clamp((t - 3250 - i * 90) / 400, 0, 1), q = pn.p(FIN.wx + FIN.dir * (150 + i * 105), -4);
        smokeRing(c, q[0] + Math.sin(i * 2.3) * 8, q[1] - 30 - 90 * k, (11 + 18 * k) * pn.z * 0.5, 0.3 * (i - 1), 0.9 * (1 - 0.3 * k));
      }
    }
  }
  // the flame cone: an ink-edged wedge from the mouth, white core, accent body, tongues along the edges
  function drawCone(c, m, ang, len, t, front, coreLen) {
    const N = 16, ca = Math.cos(ang), sa = Math.sin(ang), hw = (s) => 7 + 52 * (s / 400);
    const edge = (sgn, grow_, L_) => { const o = []; for (let i = 0; i <= N; i++) { const s = (L_ * i) / N, tf = 1 + 0.16 * Math.sin(t * 0.024 + i * 2.1 + sgn), w = hw(s) * tf * grow_ * (i % 2 ? 1.22 : 0.9); o.push([m[0] + ca * s - sa * w * sgn, m[1] + sa * s + ca * w * sgn]); } return o; };
    const poly = (g, L_) => edge(1, g, L_).concat(edge(-1, g, L_).reverse());
    if (!front) {
      c.lineJoin = "miter"; c.lineWidth = 3.4; c.strokeStyle = MG_INK; c.fillStyle = COL; mgPoly(c, poly(1, len)); c.fill(); c.stroke();
      c.fillStyle = "#ffc27a"; mgPoly(c, poly(0.62, len)); c.fill();
    } else if (coreLen > 12) {
      c.fillStyle = "rgba(255,244,214,0.95)"; mgPoly(c, poly(0.34, coreLen)); c.fill();
    }
  }

  /* ---- the loser: stands, is engulfed and chars, pops out, flies as a black comet with an accent tail ---- */
  function loserAt(tt) {   // position of the loser (world) at page time tt
    if (tt < FIN.launch) return [FIN.lx - (tt >= FIN.hit ? FIN.dir * 5 : 0), 0];
    const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr];
  }
  // as he flies he swells toward the reader
  const loserSc = (t) => 1 + 0.5 * easeOut(fe(S_.pop, S_.pop + 300, t));
  function drawLoserFn(c, pn, t) {
    const Lp = L_();
    if (FIN.out || Lp.state === "gone") { drawTrail(c, pn, t); return; }
    const fl = t >= FIN.launch, char = fe(FIN.hit, FIN.launch, t), sc = loserSc(t);
    // the comet's tail first, behind it
    if (fl) drawTrail(c, pn, t);
    const post = fl || char > 0 ? (lc, X) => {
      if (char > 0.2) {   // accent cracks in the char
        lc.strokeStyle = rgba(COL, 0.95); lc.lineWidth = Math.max(1.5, 1.4 * X.z); lc.lineCap = "round"; lc.beginPath();
        const r = mgRng(55);
        for (let i = 0; i < 7; i++) { let x = X.sx + (r() - 0.5) * 30 * X.z, y = X.sy - (10 + r() * 50) * X.z; lc.moveTo(x, y); for (let j = 0; j < 3; j++) { x += (r() - 0.5) * 12 * X.z; y += (r() - 0.3) * 10 * X.z; lc.lineTo(x, y); } }
        lc.stroke();
      }
    } : null;
    const base = { sc, light: dirAng(-0.6), free: MG.broke, halo: fl ? 3 : 0 };
    if (fl && !MG.slow) for (const dt of [70, 46, 23]) {   // three ghosts
      const [gx, gy] = loserAt(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
      mgPuppet(c, pn, Lp, t - dt, Object.assign({}, base, { sc: loserSc(t - dt), a: 0.3 - dt * 0.003, wash: [MG_INK, 0.85], tone: false, halo: 0 }));
      Lp.x = ox; Lp.y = oy;
    }
    mgPuppet(c, pn, Lp, t, Object.assign({}, base, { wash: [MG_INK, 0.95 * Math.max(char, fl ? 1 : 0)], post, flash: Lp.flash > 0 }));
  }
  // the comet's tail: widest at the loser, tapering to a point (ink edge, accent body, white core), and a screen of dots for the smoke behind it
  function cometStroke(c, pts, w) {
    const n = pts.length - 1, Lp = [], Rp = [];
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const wd = Math.max(0.3, w * 0.5 * Math.pow(i / n, 0.85));
      Lp.push([pts[i][0] - dy * wd, pts[i][1] + dx * wd]); Rp.push([pts[i][0] + dy * wd, pts[i][1] - dx * wd]);
    }
    c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i <= n; i++) c.lineTo(Lp[i][0], Lp[i][1]);
    for (let i = n; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]);
    c.closePath(); c.fill();
  }
  function drawTrail(c, pn, t) {
    const tr = FIN.trail;
    if (tr.length < 3) return;
    const w = L_().s.w * loserSc(t);
    if (!MG.slow) {   // the smoke: a wider band of dots that spreads toward the tail
      const n = tr.length - 1, Lq = [], Rq = [];
      for (let i = 0; i <= n; i++) {
        const q = pn.sp(tr[i][0], tr[i][1]), a = pn.sp(tr[Math.max(0, i - 1)][0], tr[Math.max(0, i - 1)][1]), b = pn.sp(tr[Math.min(n, i + 1)][0], tr[Math.min(n, i + 1)][1]);
        let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const wd = w * pn.z * (0.25 + 0.75 * Math.pow(1 - i / n, 0.7)) * Math.pow(Math.max(i / n, 0.04), 0.4);
        Lq.push([q[0] - dy * wd, q[1] + dx * wd]); Rq.push([q[0] + dy * wd, q[1] - dx * wd]);
      }
      mgToneFill(c, Lq.concat(Rq.reverse()), 6, 0.42);
    }
    c.save(); pn.world(c);
    const pts = tr.map((q) => [q[0], q[1]]);
    c.fillStyle = MG_INK; cometStroke(c, pts, w * 0.82);
    c.fillStyle = COL; cometStroke(c, pts, w * 0.56);
    c.fillStyle = CORE; cometStroke(c, pts, w * 0.2);
    c.restore();
  }

  /* ---- panel 4: the aftermath ---- */
  // a ring of smoke: an ellipse of dot tone with an ink edge (the hole shows the paper)
  function smokeRing(c, cx, cy, r, rot, a) {
    c.save(); c.globalAlpha = a; c.translate(cx, cy); c.rotate(rot);
    c.beginPath(); c.ellipse(0, 0, r * 1.25, r * 0.78, 0, 0, Math.PI * 2); c.ellipse(0, 0, r * 0.66, r * 0.36, 0, 0, Math.PI * 2, true);
    c.save(); c.clip("evenodd"); c.rotate(-rot); c.translate(-cx, -cy); mgToneFill(c, [[0, 0], [L.gw, 0], [L.gw, L.gh], [0, L.gh]], 6, 0.38); c.restore();
    c.lineWidth = 2.6; c.strokeStyle = MG_INK; c.lineJoin = "round"; c.stroke();
    c.restore();
  }
  function drawAfter(c, pn, t) {
    const W = W_(), s = grow(t), u = fe(MT.AFTER, MT.END, t);
    pn.screen(c);
    const hd = bodyPt(W, t, s, "head"), [fx, fy] = pn.p(hd[0], hd[1]);
    // behind him: the same dots-and-paper disc as in his first panel, now calm, with the focus lines turning slowly
    mgToneFill(c, discPoly(fx, fy, pn.h * 0.74, 40), 10, 0.2, [t * 0.001, -t * 0.001]);
    c.beginPath(); c.arc(fx, fy, pn.h * 0.5, 0, Math.PI * 2); c.fillStyle = MG_PAPER; c.fill();
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.5);
    ground(c, pn, t);
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s), under: wingsUnder(W, t) });
    pn.screen(c);
    // the smoke ring: an ellipse of tone, growing and fading toward the reader
    const k = fe(3700, 4500, t);
    if (k > 0 && k < 1) {
      const z = pn.z * s, mx = hd[0] + FIN.dir * 5 * s, my = hd[1] + 11 * s, m = pn.p(mx, my), r = (5 + 40 * easeOut(k)) * pn.z * 0.9;
      smokeRing(c, m[0] + FIN.dir * (16 + 95 * easeOut(k)) * pn.z * 0.5, m[1] - 8 * k * pn.z - 4, r, -0.3 * FIN.dir, 1 - fe(0.6, 1, k));
    }
  }

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "Inferno", hit: 2900, pop: 3080, flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "FWOOSH" : heavy ? "DOOM" : "KRAK", D = FIN.dir;
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike;
      const at3 = (fx, fy) => (() => { const q = pg(fx, fy); return [q[0], q[1]]; });
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.24, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        { text: "GRRRR", t0: 1330, t1: 2250, size: 0.1, jag: 0.22, rot: -0.1 * D, at: () => { const p = P2(); return [p.x0 + p.w * 0.3, p.y0 + p.h * 0.1]; } },
        { text: "hhhhhh", t0: 1760, t1: 2350, size: 0.075, jit: 0.1, rot: 0.08 * D, at: (t) => { const p = P2(), m = p.sp(...mouthW(t)); return [m[0] + D * p.w * 0.12, m[1] + p.h * 0.08]; } },
        { text: "BWOOOM", t0: FIN.hit, t1: 3420, size: 0.2, arc: 9, rot: -0.06 * D, at: at3(0.3, 0.33) },
        { text: "FWOOOSH", t0: 3080, t1: 3640, size: 0.17, arc: 8, rot: clamp(Math.atan(FIN.ldy / (Math.abs(FIN.ldx) < 0.02 ? 0.02 : FIN.ldx)), -1.25, 1.25) * 0.85, stretch: { ang: Math.atan2(FIN.ldy, FIN.ldx), k: 0.9 },
          // beside the comet's path, on the side away from him, so the loser flies clear of it
          at: () => {
            const p = P3(), nx = (FIN.ldy < 0 ? -FIN.ldy : FIN.ldy) * 0 + (FIN.ldx * 0 + -FIN.ldy), ny = FIN.ldx, sg = nx * D >= 0 ? 1 : -1;
            const q = p.sp(FIN.lx + FIN.ldx * 120 + sg * nx * 46, FIN.ldy * 120 - 30 + sg * ny * 46);
            return [clamp(q[0], L.gw * 0.2, L.gw * 0.8), clamp(q[1], L.gh * 0.16, L.gh * 0.86)];
          } },
      ];
    },
    build(lay) {
      const r = mgRng(2026), g = L.gw, h = L.gh;
      ash = Array.from({ length: 46 }, () => ({ x: r() * g, y: r() * h, v: 12 + r() * 26, s: 1.2 + r() * 2.4, ph: r() * 6.28 }));
      embers = []; rnd = mgRng(99);
      MG.dEmbers = 0;
    },
    step(t, k) {
      const W = W_(), L = L_();
      W.mk.scale = grow(t);
      // embers: from 1700, from all over the page into his mouth
      if (t > 1700 && t < 2330) {
        const want = Math.floor((t - 1700) / 12) * (MG.slow ? 1 : 2);
        while (MG.dEmbers < want) { MG.dEmbers++; embers.push({ t0: t, life: Math.min(520 + rnd() * 380, 2345 - t), a: rnd() * 6.283, r0: 120 + rnd() * 320, s: 0.6 + rnd() * 0.9, hot: rnd() < 0.3 }); }
      }
      // the loser after the pop: white flash at the pop, none before it
      MG.pt = t;
    },
    after(t) {
      const Lp = L_();
      Lp.flash = t >= this.pop && t < this.pop + 90 ? 2 : 0;
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, H0 = MANGA.dragon.hit;
      if (role === "w") {
        const open = ease(fe(MT.LOOK, 1700, t)) * (1 - ease(fe(3500, 3900, t)));
        P.wingUp = open; P.flap = 0.14 + Math.sin(t * 0.005) * 0.07;
        const tip = tailTip(t, w, leg, tor); if (tip) P.tailTo = tip;
        let lean = -0.32 * ease(fe(1700, 2050, t));
        if (t >= H0 - 60) lean = lean + (0.54) * easeOut(fe(H0 - 60, H0 + 60, t)) - 0.22 * ease(fe(3250, 3600, t));
        if (t >= 3500) lean = 0.05 * (1 - ease(fe(3500, 3900, t)));
        P.lean = lean;
        let mouth = 0.1;
        if (t >= 1700) mouth = 0.15 + 0.5 * fe(1700, 2350, t);
        if (t >= 2350) mouth = 0.65 + 0.2 * fe(2350, 2780, t);
        if (t >= 2780) mouth = 1;
        if (t >= 3500) mouth = 0;
        P.mouth = mouth;
        P.expr = t >= 3500 ? "grin" : t >= 1700 ? "rage" : undefined; P.exK = 1;
        if (t >= 3500) P.crouch = 0;
        if (t >= 3500) { const r = ease(fe(3500, 3900, t)); return { hF: [w * (0.8 - 0.05 * r), -leg - tor * (0.78 - 0.26 * r) + 4 * r], hB: [w * (-0.8 + 0.27 * r), -leg - tor * (0.78 - 0.36 * r) + 4 * r] }; }   // the game's own idle arms, hanging outside the round body
        return { hF: [w * 0.8, -leg - tor * 0.78], hB: [-w * 0.8, -leg - tor * 0.78] };
      }
      // the loser
      const fly = t >= MANGA.dragon.pop;
      P.expr = fly ? "ko" : "terror"; P.exK = fe(MT.INSET, MT.STRIKE, t);
      if (!fly) {
        P.lean = Math.sin(t * 0.03) * 0.04 * fe(2000, 2400, t); P.mouth = t >= H0 ? 1 : 0.4 * fe(2000, 2350, t) + 0.2;
        return { hF: [w * 0.75, -leg - tor * 0.45], hB: [-w * 0.7, -leg - tor * 0.45] };
      }
      P.lean = -0.5; P.mouth = 1; P.spin = ((t - MANGA.dragon.pop) / FMS) * 0.3;
      return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
    },
    // ash (grey dots) drifting up over the whole page; the comet's speed lines
    over(o, t) {
      // embers pulled into his mouth from all over the page
      if (t > 1700 && t < 2350 && MG.byId.look) {
        const m = MG.byId.look.sp(...mouthW(Math.min(t, 2330)));
        for (const e of embers) {
          const k = (t - e.t0) / e.life; if (k < 0 || k > 1) continue;
          const r = e.r0 * Math.pow(1 - ease(k), 1.6), x = m[0] + Math.cos(e.a + k * 1.2) * r, y = m[1] + Math.sin(e.a + k * 1.2) * r * 0.8, sz = 2 + 2.2 * e.s * (1 - k * 0.5);
          o.fillStyle = MG_INK; o.beginPath(); o.arc(x, y, sz + 1.3, 0, 7); o.fill();
          o.fillStyle = e.hot ? CORE : COL; o.beginPath(); o.arc(x, y, sz, 0, 7); o.fill();
        }
      }
      if (t > 800 && t < MT.FADE) {
        const a = fe(800, 1100, t) * (1 - fe(3600, 4200, t)), u = (t - 800) / 1000;
        o.fillStyle = "rgba(40,36,50,0.5)"; o.globalAlpha = a;
        for (const d of ash) { const y = ((d.y - d.v * u) % L.gh + L.gh) % L.gh, x = d.x + Math.sin(u * 1.3 + d.ph) * 10; o.beginPath(); o.arc(x, y, d.s, 0, 7); o.fill(); }
        o.globalAlpha = 1;
      }
      if (t > this.pop && t < this.pop + 420) {
        const Lp = L_(), pn = MG.byId.strike, a = 1 - fe(this.pop + 200, this.pop + 420, t);
        const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        const sx_ = q[0] - Math.cos(ang) * len * 0.45, sy_ = q[1] - Math.sin(ang) * len * 0.45, hh_ = Math.min(L.gw, L.gh) * 0.34;
        mgSpeed(o, sx_, sy_, len, hh_, ang, -(t - this.pop) * 1.4, 0.8 * a, false, 1);
        mgSpeed(o, sx_, sy_, len, hh_, ang, -(t - this.pop) * 1.1 + 90, 0.55 * a, true, 1);   // white ones too: they show on the dark panels
        o.restore();
      }
    },
    drawLoser: drawLoserFn,
    hitPt() { return mouthW(FIN.hit); },
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_();
      const m = mouthW(FIN.hit);
      mgPuppet(o, pn, W, FIN.hit + 10, { sc: grow(FIN.hit), sil, free: true });
      mgPuppet(o, pn, Lp, FIN.hit + 10, { sc: 1, sil, free: true });
      // the cone as a flat wedge
      const len = coneLen(Math.max(t, FIN.hit + 40)) * 0.6, ang = Math.atan2(-30 - m[1], FIN.lx - m[0]);
      o.save(); pn.world(o); o.fillStyle = sil;
      o.beginPath(); o.moveTo(m[0], m[1]); o.lineTo(m[0] + Math.cos(ang) * len - Math.sin(ang) * 36, m[1] + Math.sin(ang) * len + Math.cos(ang) * 36); o.lineTo(m[0] + Math.cos(ang) * len + Math.sin(ang) * 36, m[1] + Math.sin(ang) * len - Math.cos(ang) * 36); o.closePath(); o.fill();
      o.restore();
    },
    cues(t) {
      cueOnce("grow", 1300, () => Cin.go(() => { Cin.growl(1.2); }));
      cueOnce("wings", 1400, () => Cin.go(() => Cin.whoosh(0.35, -0.6, 0.7, 0.4)));
      cueOnce("whip", 1620, () => Cin.go(() => Cin.whoosh(0.25, 0.8, -0.8, 0.45)));
      cueOnce("inhale", 1700, () => Cin.go(() => { Cin.inhale(0.65); Cin.riser(0.65, 0.14); }));
      cueOnce("pluck", 2000, () => Cin.go(() => Cin.pluck(1480)));
      cueOnce("flute", 2050, () => Cin.go(() => Cin.flute(0.7)));
      cueOnce("roar", this.hit, () => Cin.go(() => { Cin.roar(1.1); Cin.rumble(0.9); }));
      cueOnce("pop", this.pop, () => Cin.go(() => { Cin.whoosh(0.35, -0.9, 0.9, 0.5); Cin.sub(66, 30, 0.3, 0.5); }));
      cueOnce("smoke", 3950, () => Cin.go(() => Cin._noise(0.5, 0.1, 1400, 500, "bandpass", 1.1)));
      cueOnce("chime", 4000, () => Cin.go(() => Cin.chime(660)));
    },
  };
  return S_;
})();
