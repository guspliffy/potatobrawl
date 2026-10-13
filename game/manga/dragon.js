/* ===================== Manga page: Dragon, "Inferno" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Dragon, Inferno"). Times are ms after the final hit.
   300 the freeze (panel 1, engine) . 1250 panel 2 "the look": he grows, wings, tail whip, the inhale (embers into his mouth, the chest lights)
   2000 inset on the loser's eyes . 2350 panel 3 "the strike": mouth wide, the drop at 2780, 2900 the roar (impact frames, the flame cone),
   3080 the loser pops out like a cork (the Dragon bends the 2900 beat by hit 2900 / pop 3080) . 3500 panel 4: he shrinks back, the smirk, a smoke ring.
   Script fields: col, name, hit, pop, flight (id of the panel the loser flies out of), panels(lay), words(lay), build(lay), step(t, k), pose(P, sk, t, role, p),
   after(t), over(o, t), cues(t), drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt(). */
MANGA.dragon = (function () {
  const COL = "#ff8a3d", CORE = "#fff4d6", FLAME_DARK = "#d93a24";
  let ash = [], embers = [], smoke = [];
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
        cam: (t) => { const vh = (port ? 130 : 118) * (1 - 0.08 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + D * 4, wy: -0.38 * vh, vh }; },
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
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s) });
    pn.screen(c);
    // embers pulled into his mouth
    const m = pn.p(...mouthW(t));
    for (const e of embers) {
      const k = (t - e.t0) / e.life; if (k < 0 || k > 1) continue;
      const r = e.r0 * Math.pow(1 - ease(k), 1.6), x = m[0] + Math.cos(e.a) * r, y = m[1] + Math.sin(e.a) * r * 0.8;
      const sz = 2 + 2.2 * e.s * (1 - k * 0.5);
      c.fillStyle = MG_INK; c.beginPath(); c.arc(x, y, sz + 1.3, 0, 7); c.fill();
      c.fillStyle = e.hot ? CORE : COL; c.beginPath(); c.arc(x, y, sz, 0, 7); c.fill();
    }
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
    const W = W_(), Lp = L_(), s = grow(t), H0 = FIN.hit;
    const m = mouthW(t), len = coneLen(t), tgt = [FIN.lx, -30], ang = Math.atan2(tgt[1] - m[1], tgt[0] - m[0]);
    pn.screen(c);
    // behind: the dark creeps in from the top (cut tone), then rays at the roar
    const k1 = fe(MT.STRIKE, H0, t);
    for (let i = 0; i < 3; i++) { const h = pn.h * (0.1 + 0.07 * i) * (0.3 + 0.7 * k1); mgToneFill(c, [[pn.x0, pn.y0], [pn.x1, pn.y0], [pn.x1, pn.y0 + h], [pn.x0, pn.y0 + h]], 6, 0.18 + 0.2 * i, [t * 0.001, 0]); }
    const mp = pn.p(m[0], m[1]);
    if (t >= H0) mgFocus(c, mp[0], mp[1], Math.hypot(pn.w, pn.h), t * 0.0006, 0.75 * (1 - 0.5 * fe(H0, 3300, t)));
    mgSpeed(c, pn.cx, pn.cy, pn.w, pn.h * 0.5, 0, -t * 0.4 * FIN.dir, 0.35 * fe(2500, 2800, t) * (1 - fe(H0, H0 + 60, t)), false, 1);
    const burnX = (x) => len > 20 && Math.abs(x - FIN.wx) / 1 < len * 0.9 + 20 && (x - FIN.wx) * FIN.dir > 60;
    ground(c, pn, t, burnX);
    pn.world(c);
    if (len > 4) drawCone(c, m, ang, len, t, false);
    // the smear of the lunge (the one place with ghosts of the Dragon)
    if (t > 2840 && t < 3040 && !MG.slow) { mgPuppet(c, pn, W, t - 60, { sc: s, a: 0.18, light: dirAng(-0.6) }); mgPuppet(c, pn, W, t - 30, { sc: s, a: 0.35, light: dirAng(-0.6) }); }
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s) });
    if (!MG.broke) S_.drawLoser(c, pn, t);
    pn.world(c);
    if (len > 4) drawCone(c, m, ang, len, t, true);
    // first flames lick between his teeth
    if (t > 2400 && t < H0) {
      const q = fe(2400, 2780, t);
      for (let i = 0; i < 3; i++) { const f = 0.6 + 0.4 * Math.sin(t * 0.03 + i * 2); tongue(c, m[0] + FIN.dir * (3 + i * 3.2), m[1] - 1, (5 + 11 * q) * f, 2.2, FIN.dir * 1.5, COL, CORE); }
    }
    // the grass takes fire along the cone
    if (len > 20) for (let x = FIN.wx + FIN.dir * 80; Math.abs(x - FIN.wx) < len * 0.9 + 70; x += FIN.dir * 17) {
      const k = clamp((len * 0.9 + 70 - Math.abs(x - FIN.wx)) / 60, 0, 1), h = (13 + ((x * 31) % 11)) * k * (0.75 + 0.25 * Math.sin(t * 0.03 + x));
      c.save(); c.translate(x, 0); tongue(c, 0, 1, h * 1.12, 6.4, 0, MG_INK, null); tongue(c, 0, 0, h, 4.6, Math.sin(t * 0.02 + x) * 2.5, COL, CORE); c.restore();
    }
  }
  // the flame cone: an ink-edged wedge from the mouth, white core, accent body, tongues along the edges
  function drawCone(c, m, ang, len, t, front) {
    const N = 16, ca = Math.cos(ang), sa = Math.sin(ang), hw = (s) => 7 + 52 * (s / 400);
    const edge = (sgn, grow_) => { const o = []; for (let i = 0; i <= N; i++) { const s = (len * i) / N, tf = 1 + 0.16 * Math.sin(t * 0.024 + i * 2.1 + sgn), w = hw(s) * tf * grow_ * (i % 2 ? 1.22 : 0.9); o.push([m[0] + ca * s - sa * w * sgn, m[1] + sa * s + ca * w * sgn]); } return o; };
    const poly = (g) => { const a = edge(1, g), b = edge(-1, g).reverse(); return a.concat(b); };
    if (!front) {
      const P = poly(1);
      c.lineJoin = "miter"; c.lineWidth = 3.4; c.strokeStyle = MG_INK; c.fillStyle = COL; mgPoly(c, P); c.fill(); c.stroke();
      const Q = poly(0.62); c.fillStyle = "#ffc27a"; mgPoly(c, Q); c.fill();
    } else {
      const R_ = (() => { const a = edge(1, 0.34), b = edge(-1, 0.34).reverse(); return a.slice(0, 13).concat(b.slice(b.length - 13)); })();
      c.fillStyle = "rgba(255,244,214,0.92)"; mgPoly(c, R_); c.fill();
    }
  }

  /* ---- the loser: stands, is engulfed and chars, pops out, flies as a black comet with an accent tail ---- */
  function loserAt(tt) {   // position of the loser (world) at page time tt
    if (tt < FIN.launch) return [FIN.lx - (tt >= FIN.hit ? FIN.dir * 5 : 0), 0];
    const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr];
  }
  function drawLoserFn(c, pn, t) {
    const Lp = L_();
    if (FIN.out || Lp.state === "gone") { drawTrail(c, pn, t); return; }
    const fl = t >= FIN.launch, char = fe(FIN.hit, FIN.launch, t);
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
    const base = { sc: 1, light: dirAng(-0.6) };
    if (fl && !MG.slow) for (const dt of [70, 46, 23]) {   // three ghosts
      const [gx, gy] = loserAt(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
      mgPuppet(c, pn, Lp, t - dt, Object.assign({}, base, { a: 0.3 - dt * 0.003, wash: [MG_INK, 0.85], tone: false }));
      Lp.x = ox; Lp.y = oy;
    }
    mgPuppet(c, pn, Lp, t, Object.assign({}, base, { wash: [MG_INK, 0.85 * Math.max(char, fl ? 1 : 0)], post, flash: Lp.flash > 0 }));
  }
  function drawTrail(c, pn, t) {
    const tr = FIN.trail;
    if (tr.length < 2) return;
    c.save(); pn.world(c);
    const pts = tr.map((q) => [q[0], q[1]]), w = L_().s.w;
    c.fillStyle = MG_INK; brush(c, pts, w * 1.15, pts.length - 1);
    c.fillStyle = COL; brush(c, pts, w * 0.8, pts.length - 1);
    c.fillStyle = CORE; brush(c, pts, w * 0.32, pts.length - 1);
    c.restore();
  }

  /* ---- panel 4: the aftermath ---- */
  function drawAfter(c, pn, t) {
    const W = W_(), s = grow(t), u = fe(MT.AFTER, MT.END, t);
    pn.screen(c);
    const [fx, fy] = pn.p(...bodyPt(W, t, s, "head"));
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.5);
    ground(c, pn, t);
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s) });
    // the smoke ring: an ellipse of tone, growing and fading toward the reader
    const k = fe(3900 - 200, 4500, t);
    if (k > 0 && k < 1) {
      const m = pn.p(...mouthW(t)), r = (6 + 62 * easeOut(k)) * pn.z * 0.5, a = 1 - fe(0.55, 1, k), cx = m[0] + FIN.dir * (14 + 60 * k) * pn.z * 0.5, cy = m[1] - 20 * k * pn.z * 0.5;
      c.save(); c.globalAlpha = a; c.translate(cx, cy); c.rotate(-0.25 * FIN.dir);
      c.beginPath(); c.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2); c.ellipse(0, 0, r * 0.62, r * 0.38, 0, 0, Math.PI * 2, true);
      c.fillStyle = "#f1ece2"; c.fill("evenodd"); c.lineWidth = 2.4; c.strokeStyle = MG_INK; c.stroke(); c.restore();
    }
  }

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "Inferno", hit: 2900, pop: 3080, flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "FWOOSH" : heavy ? "DOOM" : "KRAK", D = FIN.dir;
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike;
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.24, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        { text: "GRRRR", t0: 1330, t1: 2250, size: 0.1, jag: 0.22, rot: -0.1 * D, at: () => { const p = P2(); return [p.x0 + p.w * 0.3, p.y0 + p.h * 0.1]; } },
        { text: "hhhhhh", t0: 1760, t1: 2350, size: 0.075, jit: 0.1, rot: 0.08 * D, at: (t) => { const p = P2(), m = p.sp(...mouthW(t)); return [m[0] + D * p.w * 0.12, m[1] + p.h * 0.08]; } },
        { text: "BWOOOM", t0: FIN.hit, t1: 3560, size: 0.22, arc: 9, rot: -0.07 * D, at: () => { const p = P3(); return [p.cx + D * p.w * 0.04, p.y0 + p.h * 0.16 + p.oy]; } },
        { text: "FWOOOSH", t0: 3080, t1: 3640, size: 0.19, arc: 8, rot: Math.atan2(FIN.ldy, FIN.ldx) * 0.5, stretch: { ang: Math.atan2(FIN.ldy, FIN.ldx), k: 0.9 },
          at: () => { const p = P3(), q = p.sp(FIN.lx + FIN.ldx * 70, FIN.ldy * 70 - 40); return [q[0] - FIN.ldx * 20, q[1] - FIN.ldy * 20]; } },
      ];
    },
    build(lay) {
      const r = mgRng(2026), g = L.gw, h = L.gh;
      ash = Array.from({ length: 46 }, () => ({ x: r() * g, y: r() * h, v: 12 + r() * 26, s: 1.2 + r() * 2.4, ph: r() * 6.28 }));
      embers = [];
      MG.dEmbers = 0;
    },
    step(t, k) {
      const W = W_(), L = L_();
      W.mk.scale = grow(t);
      // embers: from 1700, from all over the page into his mouth
      if (t > 1700 && t < 2330) {
        const want = Math.floor((t - 1700) / 12) * (MG.slow ? 1 : 2);
        while (MG.dEmbers < want) { MG.dEmbers++; embers.push({ t0: t, life: 520 + Math.random() * 380, a: Math.random() * 6.283, r0: 90 + Math.random() * 260, s: 0.6 + Math.random() * 0.9, hot: Math.random() < 0.3 }); }
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
        if (t >= 3500) lean = 0.2 * (1 - ease(fe(3500, 3900, t)));
        P.lean = lean;
        let mouth = 0.1;
        if (t >= 1700) mouth = 0.15 + 0.5 * fe(1700, 2350, t);
        if (t >= 2350) mouth = 0.65 + 0.2 * fe(2350, 2780, t);
        if (t >= 2780) mouth = 1;
        if (t >= 3500) mouth = 0;
        P.mouth = mouth;
        P.expr = t >= 3500 ? "grin" : t >= 1700 ? "rage" : undefined; P.exK = 1;
        if (t >= 3500) P.crouch = 0;
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
        mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - this.pop) * 1.4, 0.8 * a, false, 1);
        o.restore();
      }
    },
    drawLoser: drawLoserFn,
    hitPt() { return mouthW(FIN.hit); },
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_();
      const m = mouthW(FIN.hit);
      mgPuppet(o, pn, W, FIN.hit + 10, { sc: grow(FIN.hit), sil });
      mgPuppet(o, pn, Lp, FIN.hit + 10, { sc: 1, sil });
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
