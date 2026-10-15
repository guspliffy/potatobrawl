/* ===================== Manga page: Dragon, "Inferno" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Dragon, Inferno"). Times are ms after the final hit.
   300 the freeze (panel 1, engine) . 1250 panel 2 "the look": he grows, wings, tail whip, the inhale (embers into his mouth, the chest lights)
   2000 inset on the loser's eyes . 2350 panel 3 "the strike": mouth wide, the drop at 2780, 2900 the roar (impact frames, the flame cone),
   3080 the loser pops out like a cork (the Dragon bends the 2900 beat by hit 2900 / pop 3080) . 3500 panel 4: he shrinks back, the smirk, a smoke ring.
   The Ultimate KO (Hellfire), "Dragon's Age": MANGA.dragon.ulti extends this script (design: Project files ultimates/manga/dragon/fable-dragon-ultimate.md; `ult` says
   which one plays). Inferno to the roar (the gold impact frame adds Hellfire's blast ring), the pop at 3050; 3250 panel 5: the Dragon at his true age fills the page
   (his potato head with the sprout, horns, gold eye, wings, neck, tail) and the loser is a dot at the far end of the slab; the inhale, the drop, one stream of fire,
   the dot pops off the page, DRAGON'S AGE, the jaw shuts; 4700 panel 4 as on Inferno (its moments are MT.AFTER + offset).
   Script fields: col, name, hit, pop, flight (id of the panel the loser flies out of), panels(lay), words(lay), build(lay), step(t, k), pose(P, sk, t, role, p),
   after(t), over(o, t), cues(t), drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt(). */
MANGA.dragon = (function () {
  const WBOX = [-84, -130, 82, 12];   // what the Dragon with his wings can cover (measured over the whole page), a little tighter than the engine's default box
  const COL = "#ff8a3d", CORE = "#fff4d6", FLAME_DARK = "#d93a24";
  let ash = [], embers = [], smoke = [], rnd = Math.random;
  let ult = false;   // this play is the Ultimate page, "Dragon's Age" (set by start())
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  // the Dragon's size: a potato (1) who grows to 1.6 over 600 ms in panel 2, and shrinks back over 400 ms in panel 4
  const grow = (t) => 1 + 0.6 * ease(fe(1250, 1850, t)) - 0.6 * ease(fe(MT.AFTER, MT.AFTER + 400, t));
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
    const spread = ease(fe(MT.LOOK, 1700, t)) * (1 - ease(fe(MT.AFTER, MT.AFTER + 400, t)));
    if (spread < 0.05) return null;
    return (lc) => {
      const P = pose(p, mgTk(t)), len = P.w * 0.95 * (1 + 0.85 * spread);
      const a1 = rot([-P.w * 0.3, P.cy + P.ry * 0.1], P.hip, P.lean), a2 = rot([P.w * 0.2, P.cy + P.ry * 0.05], P.hip, P.lean), fl = P.flap - P.wingUp * 0.9;
      batWing(lc, a1[0], a1[1], Math.PI + 0.18 - fl + P.lean, len, p.pal, true, true);
      batWing(lc, a2[0], a2[1], -0.25 + fl * 0.7 + P.lean, len * 0.9, p.pal, false, false);
    };
  }

  /* ---- panels ---- */
  function panels(lay) {
    const port = lay.port;
    const D = FIN.dir;
    return [
      { id: "look", t0: MT.LOOK, from: "w", freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0], [1, 0], [1, 0.40], [0, 0.43]] : [[0, 0], [0.47, 0], [0.43, 1], [0, 1]],
        cam: (t) => { const vh = 105 * grow(t) * (1 - 0.07 * fe(MT.LOOK, MT.STRIKE, t)); return { wx: FIN.wx + D * 6, wy: -0.36 * vh, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "l", slide: 140, freeze: MT.STRIKE, cover: MT.STRIKE,
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
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s), under: wingsUnder(W, t), box: WBOX });
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
    const k = fe(1700, 2300, t) * (1 - fe(MT.AFTER + 100, MT.AFTER + 400, t));
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
    const W = W_(), s = grow(t), H0 = FIN.hit, pop = FIN.launch;
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
    let smear = null;
    if (t > 2840 && t < 3040 && !MG.slow) { const h0 = pn.p(...bodyPt(W, t, s, "head")), gh = (dt, a) => { const q = pn.p(...bodyPt(W, t - dt, grow(t - dt), "head")); return [q[0] - h0[0], q[1] - h0[1], a]; }; smear = [gh(60, 0.18), gh(30, 0.35)]; }
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s), under: wingsUnder(W, t), box: WBOX, ghosts: smear });
    // the Ultimate: Hellfire's blast round the loser, a white disc with an ink ring growing out of the fire (2900-3060)
    if (ult && t >= H0 && t < 3060) {
      const k = easeOut(fe(H0, 3060, t)), R = 20 + 26 * k, a = 1 - fe(3000, 3060, t);
      pn.world(c); c.globalAlpha = a; c.beginPath(); c.arc(FIN.lx, -L_().s.h * 0.5, R, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill();
      c.lineWidth = 3.4; c.strokeStyle = MG_INK; c.stroke(); c.globalAlpha = 1;
    }
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
  const loserSc = (t) => 1 + 0.5 * easeOut(fe(FIN.launch, FIN.launch + 300, t));
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
    let ghosts = null;
    if (fl && !MG.slow) {   // three ghosts: the same picture at where he was 70, 46 and 23 ms ago
      const b = pn.p(...loserAt(t));
      ghosts = [70, 46, 23].map((dt) => { const a = pn.p(...loserAt(t - dt)); return [a[0] - b[0], a[1] - b[1], 0.26 - dt * 0.0026]; });
    }
    const base = { sc, light: dirAng(-0.6), free: MG.broke, halo: fl ? 3 : 0, ghosts };
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
    mgPuppet(c, pn, W, t, { sc: s, light: dirAng(-0.6), post: chestGlow(W, t, s), under: wingsUnder(W, t), box: WBOX });
    pn.screen(c);
    // the smoke ring: an ellipse of tone, growing and fading toward the reader
    const k = fe(MT.AFTER + 200, MT.AFTER + 1000, t);
    if (k > 0 && k < 1) {
      const z = pn.z * s, mx = hd[0] + FIN.dir * 5 * s, my = hd[1] + 11 * s, m = pn.p(mx, my), r = (5 + 40 * easeOut(k)) * pn.z * 0.9;
      smokeRing(c, m[0] + FIN.dir * (16 + 95 * easeOut(k)) * pn.z * 0.5, m[1] - 8 * k * pn.z - 4, r, -0.3 * FIN.dir, 1 - fe(0.6, 1, k));
    }
  }

  /* ---- the script ---- */
  const S_ = {
    col: COL, name: "Inferno", hit: 2900, pop: 3080, flight: "strike",
    panels,
    start() { ult = false; },
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "FWOOSH" : heavy ? "DOOM" : "KRAK", D = FIN.dir;
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike;
      const at3 = (fx, fy) => (() => { const q = pg(fx, fy); return [q[0], q[1]]; });
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.24, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        { text: "GRRRR", t0: 1330, t1: 2250, size: 0.1, jag: 0.22, rot: -0.1 * D, at: () => { const p = P2(); return [p.x0 + p.w * 0.3, p.y0 + p.h * 0.1]; } },
        { text: "hhhhhh", t0: 1760, t1: 2350, size: 0.075, jit: 0.1, rot: 0.08 * D, at: (t) => { const p = P2(), m = p.sp(...mouthW(t)); return [m[0] + D * p.w * 0.12, m[1] + p.h * 0.08]; } },
        { text: "BWOOOM", t0: FIN.hit, t1: 3420, size: 0.2, arc: 9, rot: -0.06 * D, at: at3(0.3, 0.33) },
        { text: "FWOOOSH", t0: FIN.launch, t1: 3640, size: 0.17, arc: 8, rot: clamp(Math.atan(FIN.ldy / (Math.abs(FIN.ldx) < 0.02 ? 0.02 : FIN.ldx)), -1.25, 1.25) * 0.85, stretch: { ang: Math.atan2(FIN.ldy, FIN.ldx), k: 0.6 },
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
      Lp.flash = t >= FIN.launch && t < FIN.launch + 90 ? 2 : 0;
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, H0 = MANGA.dragon.hit;
      if (role === "w") {
        const open = ease(fe(MT.LOOK, 1700, t)) * (1 - ease(fe(MT.AFTER, MT.AFTER + 400, t)));
        P.wingUp = open; P.flap = 0.14 + Math.sin(t * 0.005) * 0.07;
        const tip = tailTip(t, w, leg, tor); if (tip) P.tailTo = tip;
        let lean = -0.32 * ease(fe(1700, 2050, t));
        if (t >= H0 - 60) lean = lean + (0.54) * easeOut(fe(H0 - 60, H0 + 60, t)) - 0.22 * ease(fe(3250, 3600, t));
        if (t >= MT.AFTER) lean = 0.05 * (1 - ease(fe(MT.AFTER, MT.AFTER + 400, t)));
        P.lean = lean;
        let mouth = 0.1;
        if (t >= 1700) mouth = 0.15 + 0.5 * fe(1700, 2350, t);
        if (t >= 2350) mouth = 0.65 + 0.2 * fe(2350, 2780, t);
        if (t >= 2780) mouth = 1;
        if (t >= MT.AFTER) mouth = 0;
        P.mouth = mouth;
        P.expr = t >= MT.AFTER ? "grin" : t >= 1700 ? "rage" : undefined; P.exK = 1;
        if (t >= MT.AFTER) P.crouch = 0;
        if (t >= MT.AFTER) { const r = ease(fe(MT.AFTER, MT.AFTER + 400, t)); return { hF: [w * (0.8 - 0.05 * r), -leg - tor * (0.78 - 0.26 * r) + 4 * r], hB: [w * (-0.8 + 0.27 * r), -leg - tor * (0.78 - 0.36 * r) + 4 * r] }; }   // the game's own idle arms, hanging outside the round body
        return { hF: [w * 0.8, -leg - tor * 0.78], hB: [-w * 0.8, -leg - tor * 0.78] };
      }
      // the loser
      const fly = t >= FIN.launch;
      P.expr = fly ? "ko" : "terror"; P.exK = fe(MT.INSET, MT.STRIKE, t);
      if (!fly) {
        P.lean = Math.sin(t * 0.03) * 0.04 * fe(2000, 2400, t); P.mouth = t >= H0 ? 1 : 0.4 * fe(2000, 2350, t) + 0.2;
        return { hF: [w * 0.75, -leg - tor * 0.45], hB: [-w * 0.7, -leg - tor * 0.45] };
      }
      P.lean = -0.5; P.mouth = 1; P.spin = ((t - FIN.launch) / FMS) * 0.3;
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
        const a = fe(800, 1100, t) * (1 - fe(MT.AFTER + 100, MT.AFTER + 700, t)) * (ult ? 1 - fe(MT.SPLASH - 150, MT.SPLASH, t) : 1), u = (t - 800) / 1000;
        o.fillStyle = "rgba(40,36,50,0.5)"; o.globalAlpha = a;
        for (const d of ash) { const y = ((d.y - d.v * u) % L.gh + L.gh) % L.gh, x = d.x + Math.sin(u * 1.3 + d.ph) * 10; o.beginPath(); o.arc(x, y, d.s, 0, 7); o.fill(); }
        o.globalAlpha = 1;
      }
      if (t > FIN.launch && t < FIN.launch + 420) {
        const Lp = L_(), pn = MG.byId.strike, a = (1 - fe(FIN.launch + 200, FIN.launch + 420, t)) * (ult ? 1 - fe(MT.SPLASH - 100, MT.SPLASH, t) : 1);
        const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        const sx_ = q[0] - Math.cos(ang) * len * 0.45, sy_ = q[1] - Math.sin(ang) * len * 0.45, hh_ = Math.min(L.gw, L.gh) * 0.34;
        mgSpeed(o, sx_, sy_, len, hh_, ang, -(t - FIN.launch) * 1.4, 0.8 * a, false, 1);
        mgSpeed(o, sx_, sy_, len, hh_, ang, -(t - FIN.launch) * 1.1 + 90, 0.55 * a, true, 1);   // white ones too: they show on the dark panels
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
      if (ult && sil === MG_INK) { o.lineWidth = 7; o.strokeStyle = sil; o.beginPath(); o.arc(FIN.lx, -Lp.s.h * 0.5, 46, 0, Math.PI * 2); o.stroke(); }   // the gold frame: Hellfire's blast ring round the loser
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
      cueOnce("pop", FIN.launch, () => Cin.go(() => { Cin.whoosh(0.35, -0.9, 0.9, 0.5); Cin.sub(66, 30, 0.3, 0.5); }));
      cueOnce("smoke", MT.AFTER + 450, () => Cin.go(() => Cin._noise(0.5, 0.1, 1400, 500, "bandpass", 1.1)));
      cueOnce("chime", MT.AFTER + 500, () => Cin.go(() => Cin.chime(660)));
    },
  };

  /* ---- the Ultimate page, "Dragon's Age" (Hellfire; design: Project files ultimates/manga/dragon/fable-dragon-ultimate.md). MT is the Ultimate table while it plays
     (SPLASH 3250, AFTER 4700). Inferno to the roar (the gold impact frame adds Hellfire's blast ring, a white blast round the loser), the pop at 3050; then 3250
     panel 5, what the loser saw: the Dragon at his true age fills the page and the loser is a dot at the far end of the slab. 3250 the inhale (embers from the whole
     page into the mouth), 3420 the drop, 3520 one stream of fire, 3640 it reaches the dot and the dot pops off the page, 3760 DRAGON'S AGE, the hold (smoke rings, the
     pupil narrows, the jaw shuts); 4700 panel 4 as on Inferno. The giant is drawn in dragon units (u = the page's height / 100, origin the page's top left), laid out
     for a winner on the left and mirrored for one on the right. His still parts are two bitmaps made once (dgBits); the jaw, eye, glow, stream and dot are drawn
     per frame. Everything for this page is prefixed dg. ---- */
  const UT = { IN: 3250, DROP: 3420, FIRE: 3520, HIT: 3640, NAME: 3760, BACK: 4050, SHUT: 4150, SLIT: 4300 };
  const IW = 1.1;   // the giant's ink, dragon units
  let dgG = null, dgB = null, dgEmb = [];
  // the layout for a winner on the left: head H and its radius r, the mouth M the camera pushes in on, the neck (a cubic) and its half-widths at both ends,
  // body and chest ellipses [x, y, rx, ry], the wings [anchor x, y, angle, length], the tail, where the slab starts, the dot, the right edge of the back bitmap
  function dgGeo() {
    if (dgG) return dgG;
    const pn = MG.byId.splash, u = pn.h / 100, W = pn.w / u;
    dgG = !MG.lay.port
      ? { u, W, H: [46, 42], r: 22, M: [72, 50], neck: [[18, 106], [8, 84], [20, 64], [38, 58]], nw: [14, 10], body: [0, 118, 40, 34], chest: [32, 90, 12, 12],
          near: [26, 80, -0.62, 135], far: [14, 82, Math.PI + 0.75, 110], tail: [[-6, 100], [18, 103], [42, 96], [66, 99], [88, 95], [104, 88]], tw: [15, 0], slab: Math.max(W * 0.5, 110), dot: [W - 24, 94], bx: Math.max(112, W * 0.5) }
      : { u, W, H: [19, 32], r: 15, M: [35, 40], neck: [[6, 92], [0, 72], [4, 56], [14, 50]], nw: [10, 8], body: [0, 104, 26, 24], chest: [16, 88, 8, 9],
          near: [12, 72, -0.75, 75], far: [4, 74, Math.PI + 0.7, 62], tail: [[-2, 99], [10, 101], [20, 98], [28, 94]], tw: [8, 0], slab: 29, dot: [W - 9, 94], bx: W };
    return dgG;
  }
  const dgHex = (v) => (v[0] === "#" ? v : "#" + v.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join(""));
  const mixH = (a, b, k) => dgHex(mix(dgHex(a), dgHex(b), k));   // (the game's mix reads hex only, and returns rgb())
  const dgX = (G, p) => [FIN.dir > 0 ? p[0] : G.W - p[0], p[1]];   // a point of the layout on the page (mirrored for a winner on the right)
  const bez = (P, s) => { const a = 1 - s; return [0, 1].map((k) => a * a * a * P[0][k] + 3 * a * a * s * P[1][k] + 3 * a * s * s * P[2][k] + s * s * s * P[3][k]); };
  const bezD = (P, s) => { const a = 1 - s; return [0, 1].map((k) => 3 * a * a * (P[1][k] - P[0][k]) + 6 * a * s * (P[2][k] - P[1][k]) + 3 * s * s * (P[3][k] - P[2][k])); };
  const dgMouth = (t) => (0.55 + 0.45 * ease(fe(UT.IN, UT.FIRE, t))) * (1 - ease(fe(UT.SHUT, UT.SHUT + 170, t)));
  const dgMouthPt = (G, mouth) => [G.H[0] + 1.12 * G.r, G.H[1] + (0.2 + 0.15 * mouth) * G.r];
  const dgHeat = (t) => ease(fe(UT.IN, UT.FIRE, t)) * (1 - fe(4200, 4600, t));   // the chest glow and the fire in the mouth
  // the game's bat wing, at this size, with the ink and bones set in dragon units
  function dgWing(x, ax, ay, ang, len, fill, mirror) {
    x.save(); x.translate(ax, ay); x.rotate(ang); x.scale(len, len * (mirror ? -1 : 1));
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(0.42, -0.44, 1, -0.42);
    x.quadraticCurveTo(0.86, -0.22, 0.72, -0.08); x.quadraticCurveTo(0.57, -0.13, 0.46, 0.02);
    x.quadraticCurveTo(0.31, -0.03, 0.2, 0.1); x.quadraticCurveTo(0.09, 0.02, 0, 0);
    x.fillStyle = fill; x.fill(); x.lineWidth = IW * 1.3 / len; x.strokeStyle = MG_INK; x.stroke();
    x.lineWidth = IW * 0.75 / len; x.beginPath();
    for (const [bx, by] of [[0.72, -0.08], [0.46, 0.02], [0.2, 0.1]]) { x.moveTo(0.5, -0.36); x.lineTo(bx, by); }
    x.moveTo(0, 0); x.lineTo(0.5, -0.36); x.stroke();
    x.restore();
  }
  function dgSprout(x, sx, sy, r) {
    x.lineWidth = 0.13 * r + IW * 1.2; x.strokeStyle = MG_INK; x.beginPath(); x.moveTo(sx, sy + 0.1 * r); x.quadraticCurveTo(sx - 0.08 * r, sy - 0.25 * r, sx + 0.05 * r, sy - 0.5 * r); x.stroke();
    x.lineWidth = 0.13 * r; x.strokeStyle = mix("#3f7d3a", MG_PAPER, 0.15); x.stroke();
    for (const [lx, ly, a] of [[-0.3, -0.58, -0.5], [0.38, -0.66, 0.5]]) {
      x.save(); x.translate(sx + lx * r, sy + ly * r); x.rotate(a);
      x.beginPath(); x.ellipse(0, 0, 0.32 * r, 0.15 * r, 0, 0, Math.PI * 2); x.fillStyle = mix("#7cc85a", MG_PAPER, 0.15); x.fill(); x.lineWidth = IW * 0.8; x.strokeStyle = MG_INK; x.stroke();
      x.lineWidth = IW * 0.4; x.strokeStyle = mix("#4f9a3c", MG_PAPER, 0.1); x.beginPath(); x.moveTo(-0.22 * r, 0); x.lineTo(0.22 * r, 0); x.stroke();
      x.restore();
    }
  }
  // the still parts, made once (after the freeze frame, in step()): back = wings, tail, body, neck, chest, horns; front = the skull with the snout, teeth and sprout
  function dgBits() {
    if (dgB) return dgB;
    const G = dgGeo(), r = G.r, [hx, hy] = G.H, pal = W_().pal, bw = Math.min(G.W, G.bx), zs = Math.min(DPR * G.u * 1.07, Math.sqrt(4e6 / (bw * 100)));   // (a little over the push's 6%; at most 4 M pixels for the back)
    const tint = (col, k) => mixH(col, MG_PAPER, k === undefined ? 0.38 : k);
    const hide = tint(pal.body), belly = tint(mixH(pal.body, "#fff0c6", 0.45), 0.25), horn = tint("#efe6cf", 0.1), line = tint(mixH(pal.body, "#7a4a22", 0.4), 0.2);
    const tone = (cv, poly, o, cover) => { cv.save(); cv.setTransform(1, 0, 0, 1, 0, 0); cv.fillStyle = mgTile(12, cover); mgPoly(cv, poly.map((q) => [(q[0] - o[0]) * zs, (q[1] - o[1]) * zs])); cv.fill(); cv.restore(); };   // a dot screen over a shape (the tile keeps its own size whatever the canvas scale)
    const back = mgCanvas(bw * zs, 100 * zs), x = back.getContext("2d");
    x.scale(zs, zs); x.lineJoin = "round"; x.lineCap = "round";
    dgWing(x, G.far[0], G.far[1], G.far[2], G.far[3], tint(mixH(pal.accent, "#000000", 0.25), 0.3), true);
    dgWing(x, G.near[0], G.near[1], G.near[2], G.near[3], tint(pal.accent, 0.3), false);
    // the tail along the bottom: a smooth band tapering to a point (the game's tail, grown), cream spikes along its top
    const tp = G.tail, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tq = [tp[0]];
    for (let i = 1; i < tp.length - 1; i++) {
      const a = i === 1 ? tp[0] : mid(tp[i - 1], tp[i]), b = tp[i], e = i === tp.length - 2 ? tp[i + 1] : mid(tp[i], tp[i + 1]);
      for (let j = 1; j <= 5; j++) { const k = j / 5, m = 1 - k; tq.push([m * m * a[0] + 2 * m * k * b[0] + k * k * e[0], m * m * a[1] + 2 * m * k * b[1] + k * k * e[1]]); }
    }
    const tn = tq.length - 1, Tt = [], Tb = [], tsp = [];
    for (let i = 0; i <= tn; i++) {
      const a = tq[Math.max(0, i - 1)], b = tq[Math.min(tn, i + 1)], dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / dl, ny = -(b[0] - a[0]) / dl, hw = G.tw[0] * 0.5 * Math.pow(1 - i / tn, 0.8);
      Tt.push([tq[i][0] + nx * hw, tq[i][1] + ny * hw]); Tb.push([tq[i][0] - nx * hw, tq[i][1] - ny * hw]); tsp.push([nx, ny, hw, (b[0] - a[0]) / dl, (b[1] - a[1]) / dl]);
    }
    for (const q of [0.3, 0.45, 0.6, 0.74]) {
      const i = Math.round(q * tn), [nx, ny, hw, tx, ty] = tsp[i], e = Tt[i], b = hw * 0.7;
      mgPoly(x, [[e[0] - tx * b - nx * 0.5, e[1] - ty * b - ny * 0.5], [e[0] + nx * hw * 0.9 - tx * b * 0.4, e[1] + ny * hw * 0.9 - ty * b * 0.4], [e[0] + tx * b - nx * 0.5, e[1] + ty * b - ny * 0.5]]);
      x.fillStyle = horn; x.fill(); x.lineWidth = IW * 0.8; x.strokeStyle = MG_INK; x.stroke();
    }
    mgPoly(x, Tt.concat(Tb.slice().reverse())); x.fillStyle = tint(pal.accent, 0.3); x.fill(); x.lineWidth = IW; x.strokeStyle = MG_INK; x.stroke();
    // the body, mostly below the page
    x.beginPath(); x.ellipse(G.body[0], G.body[1], G.body[2], G.body[3], 0, 0, Math.PI * 2); x.fillStyle = hide; x.fill(); x.lineWidth = IW; x.strokeStyle = MG_INK; x.stroke();
    // the neck: a band about the cubic, cream spikes on its back edge (behind it), his belly plate running up its front edge
    const N = 14, Lq = [], Rq = [], In = [], at = (s) => { const p = bez(G.neck, s), d = bezD(G.neck, s), l = Math.hypot(d[0], d[1]) || 1; return { p, nx: d[1] / l, ny: -d[0] / l, tx: d[0] / l, ty: d[1] / l, hw: G.nw[0] + (G.nw[1] - G.nw[0]) * s }; };
    for (let j = 0; j < 7; j++) {
      const q = at(0.12 + j * 0.115), e = [q.p[0] + q.nx * q.hw * 0.9, q.p[1] + q.ny * q.hw * 0.9], b = q.hw * 0.32;
      mgPoly(x, [[e[0] - q.tx * b, e[1] - q.ty * b], [e[0] + q.nx * q.hw * 0.42 - q.tx * b * 0.5, e[1] + q.ny * q.hw * 0.42 - q.ty * b * 0.5], [e[0] + q.tx * b, e[1] + q.ty * b]]);
      x.fillStyle = horn; x.fill(); x.lineWidth = IW * 0.8; x.stroke();
    }
    const Bk = [];
    for (let i = 0; i <= N; i++) { const q = at(i / N); Lq.push([q.p[0] + q.nx * q.hw, q.p[1] + q.ny * q.hw]); Rq.push([q.p[0] - q.nx * q.hw, q.p[1] - q.ny * q.hw]); In.push([q.p[0] - q.nx * q.hw * 0.3, q.p[1] - q.ny * q.hw * 0.3]); Bk.push([q.p[0] + q.nx * q.hw * 0.3, q.p[1] + q.ny * q.hw * 0.3]); }
    mgPoly(x, Lq.concat(Rq.slice().reverse())); x.fillStyle = hide; x.fill();
    tone(x, Lq.concat(Bk.slice().reverse()), [0, 0], 0.4);   // the back of the neck, away from the fire, in a 40% screen
    mgPoly(x, Lq.concat(Rq.slice().reverse())); x.lineWidth = IW; x.strokeStyle = MG_INK; x.stroke();
    mgPoly(x, Rq.concat(In.slice().reverse())); x.fillStyle = belly; x.fill(); x.lineWidth = IW * 0.6; x.stroke();
    x.strokeStyle = line; x.lineWidth = IW * 0.6; x.beginPath();
    for (let i = 1; i < N - 1; i++) { x.moveTo(Rq[i][0], Rq[i][1]); x.lineTo(In[i][0], In[i][1]); }
    x.stroke();
    // the chest plate with the costume's three lines
    const [cx, cy, crx, cry] = G.chest;
    x.beginPath(); x.ellipse(cx, cy, crx, cry, 0, 0, Math.PI * 2); x.fillStyle = belly; x.fill(); x.lineWidth = IW; x.strokeStyle = MG_INK; x.stroke();
    x.strokeStyle = line; x.lineWidth = IW * 0.7;
    for (const k of [-0.3, 0, 0.3]) { const yy = cy + cry * k * 1.2, hw2 = crx * 0.85 * Math.sqrt(Math.max(0, 1 - k * k * 1.44)); x.beginPath(); x.moveTo(cx - hw2, yy); x.lineTo(cx + hw2, yy); x.stroke(); }
    // the horns (the game's dragon head), swept back from the skull
    x.fillStyle = horn; x.strokeStyle = MG_INK; x.lineWidth = IW;
    x.beginPath(); x.moveTo(hx - r * 0.2, hy - r * 0.75); x.quadraticCurveTo(hx - r * 1.1, hy - r * 1.3, hx - r * 1.7, hy - r * 1.55); x.lineTo(hx - r * 0.75, hy - r * 0.35); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(hx + r * 0.2, hy - r * 0.85); x.quadraticCurveTo(hx - r * 0.4, hy - r * 1.6, hx - r * 0.9, hy - r * 2.0); x.lineTo(hx - r * 0.25, hy - r * 0.6); x.closePath(); x.fill(); x.stroke();
    // cut tone on the side away from the fire (the light comes from the lower right, where the stream runs)
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-atop"; mgToneBands(x, hx * zs, hy * zs, 2.2 * r * zs, 0.46, 12); x.globalCompositeOperation = "source-over";
    // the front: his round potato head, the game's dragon snout, five teeth, specks, the sprout on his crown
    const f0 = [hx - 1.15 * r, hy - 1.8 * r], fw = 2.95 * r, fh = 2.85 * r, front = mgCanvas(fw * zs, fh * zs), y = front.getContext("2d");
    y.scale(zs, zs); y.translate(-f0[0], -f0[1]); y.lineJoin = "round"; y.lineCap = "round";
    y.beginPath(); y.arc(hx, hy, r, 0, Math.PI * 2); y.fillStyle = hide; y.fill(); y.lineWidth = IW; y.strokeStyle = MG_INK; y.stroke();
    y.beginPath(); y.roundRect(hx + 0.15 * r, hy - 0.5 * r, 1.5 * r, 0.62 * r, 0.28 * r); y.fill(); y.stroke();
    y.fillStyle = tint(mixH(pal.body, "#5a3410", 0.45), 0.25);
    for (const [sx, sy, sr] of [[-0.55, 0.32, 0.09], [-0.28, 0.62, 0.07], [-0.72, -0.12, 0.06], [0.08, 0.58, 0.06], [1.0, -0.22, 0.05]]) { y.beginPath(); y.ellipse(hx + sx * r, hy + sy * r, sr * r, sr * r * 0.7, 0.5, 0, Math.PI * 2); y.fill(); }
    y.fillStyle = MG_INK; y.beginPath(); y.arc(hx + 1.45 * r, hy - 0.3 * r, 0.09 * r, 0, Math.PI * 2); y.fill();
    y.fillStyle = "#ffffff"; y.lineWidth = IW * 0.55;
    for (let i = 0; i < 5; i++) { const tx = hx + (0.62 + i * 0.22) * r, ty = hy + 0.1 * r; y.beginPath(); y.moveTo(tx - 0.07 * r, ty); y.lineTo(tx + 0.07 * r, ty); y.lineTo(tx + 0.01 * r, ty + 0.15 * r); y.closePath(); y.fill(); y.stroke(); }
    y.save(); y.setTransform(1, 0, 0, 1, 0, 0); y.globalCompositeOperation = "source-atop"; mgToneBands(y, (hx - f0[0]) * zs, (hy - f0[1]) * zs, 2.2 * r * zs, 0.46, 12); y.restore();
    dgSprout(y, hx - 0.12 * r, hy - 0.97 * r, r);   // (after the tone: the leaves stay clean)
    dgB = { back, bw, front, f0, fw, fh, hide, dark: tint(mixH(pal.body, "#0b0c18", 0.25), 0.25), line };
    return dgB;
  }
  // the jaw, per frame (between the two bitmaps): the inside of the mouth, the fire in it, the stream, the lower jaw swung open about its hinge, its fangs
  function dgJaw(c, G, B, mouth, t) {
    const r = G.r, [hx, hy] = G.H, a = mouth * 0.55, jx = hx + 0.25 * r, jy = hy + 0.1 * r, heat = dgHeat(t);
    const tip = [jx + Math.cos(a) * 1.3 * r - Math.sin(a) * 0.25 * r, jy + Math.sin(a) * 1.3 * r + Math.cos(a) * 0.25 * r];
    c.fillStyle = "#5a1a14"; mgPoly(c, [[jx, jy], [hx + 1.6 * r, hy + 0.08 * r], tip]); c.fill();
    if (heat > 0.02) {
      const m = dgMouthPt(G, mouth), R = 0.36 * r * mouth * (0.4 + 0.6 * heat) * (1 + 0.08 * Math.sin(t * 0.05));
      c.fillStyle = COL; c.beginPath(); c.arc(m[0], m[1], R, 0, Math.PI * 2); c.fill();
      c.fillStyle = CORE; c.beginPath(); c.arc(m[0], m[1], R * 0.55, 0, Math.PI * 2); c.fill();
    }
    dgStream(c, G, t, dgMouthPt(G, mouth));   // the fire leaves from inside the mouth: the jaw and the snout cover its root
    c.save(); c.translate(jx, jy); c.rotate(a);
    c.fillStyle = "#ffffff"; c.strokeStyle = MG_INK; c.lineWidth = IW * 0.55;
    for (const fx of [0.62, 0.9, 1.12]) { c.beginPath(); c.moveTo(fx * r - 0.07 * r, -0.03 * r); c.lineTo(fx * r + 0.07 * r, -0.03 * r); c.lineTo(fx * r, -0.03 * r - (fx > 1 ? 0.24 : 0.16) * r); c.closePath(); c.fill(); c.stroke(); }
    c.beginPath(); c.roundRect(0, -0.05 * r, 1.3 * r, 0.45 * r, 0.2 * r); c.fillStyle = B.dark; c.fill(); c.lineWidth = IW; c.stroke();
    c.restore();
  }
  // his eye, per frame: the gold iris and slit pupil of his face (narrowing to a line at 4300), a heavy lid and the rage brow
  function dgEye(c, G, B, t) {
    const r = G.r, ex = G.H[0] - 0.2 * r, ey = G.H[1] - 0.1 * r, er = 0.42 * r, slit = (0.06 - 0.035 * ease(fe(UT.SLIT, UT.SLIT + 150, t))) * r;
    c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill();
    c.save(); c.clip();
    c.fillStyle = "#e6a52a"; c.beginPath(); c.arc(ex + 0.1 * r, ey + 0.02 * r, 0.3 * r, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#120a08"; c.beginPath(); c.ellipse(ex + 0.1 * r, ey + 0.02 * r, slit, 0.26 * r, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(ex + 0.24 * r, ey - 0.12 * r, 0.07 * r, 0, Math.PI * 2); c.fill();
    c.fillStyle = B.hide; mgPoly(c, [[ex - er * 1.3, ey - er * 1.4], [ex + er * 1.3, ey - er * 1.4], [ex + er * 1.3, ey - er * 0.18], [ex - er * 1.3, ey - er * 0.72]]); c.fill();
    c.restore();
    c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.lineWidth = IW * 0.85; c.strokeStyle = MG_INK; c.stroke();
    c.lineWidth = 0.13 * r; c.beginPath(); c.moveTo(ex - er * 1.15, ey - er * 1.2); c.lineTo(ex + er * 1.2, ey - er * 0.35); c.stroke();
  }
  // the belly lights up as he breathes in: hard rings of the accent, clipped to the chest plate
  function dgGlow(c, G, t) {
    const k = dgHeat(t);
    if (k <= 0.02) return;
    const [cx, cy, crx, cry] = G.chest;
    c.save(); c.beginPath(); c.ellipse(cx, cy, crx, cry, 0, 0, Math.PI * 2); c.clip();
    for (const [q, a, col] of [[0.95, 0.22, COL], [0.68, 0.4, COL], [0.44, 0.62, COL], [0.2, 0.85, CORE]]) { c.fillStyle = rgba(col, a * k); c.beginPath(); c.ellipse(cx + crx * 0.1, cy + cry * 0.2, crx * q * 1.1, cry * q * 0.95, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
    c.strokeStyle = dgB.line; c.lineWidth = IW * 0.7; c.beginPath();
    for (const q of [-0.3, 0, 0.3]) { const yy = cy + cry * q * 1.2, hw2 = crx * 0.85 * Math.sqrt(Math.max(0, 1 - q * q * 1.44)); c.moveTo(cx - hw2, yy); c.lineTo(cx + hw2, yy); }
    c.stroke();
  }
  // the slab far away: a strip of ink with tufts; fire where the dot stood once the stream has reached it
  function dgSlab(c, G, t) {
    const burnt = t >= UT.HIT, dx = G.dot[0];
    c.fillStyle = MG_INK; c.fillRect(G.slab, 94, G.W - G.slab + 4, 8);
    c.beginPath();
    for (let x = G.slab + 1; x < G.W + 2; x += 3.5) { if (burnt && Math.abs(x - dx) < 5) continue; const h = 0.9 + ((x * 7.3) % 1.3); c.moveTo(x, 94.2); c.lineTo(x + 0.7, 94 - h); c.lineTo(x + 1.6, 94.2); }
    c.fill();
    if (!burnt) return;
    const n = MG.slow ? 3 : 5, f = fe(UT.HIT, UT.HIT + 80, t) * (1 - 0.45 * fe(UT.SLIT, MT.AFTER, t));
    for (let i = 0; i < n; i++) {
      const x = dx + (i - (n - 1) / 2) * 1.5, h = (3.2 + 2.2 * Math.sin(t * 0.03 + i * 1.9)) * f * (i % 2 ? 0.8 : 1.1), lean = Math.sin(t * 0.02 + i) * 0.5;
      tongue(c, x, 94.3, h * 1.15, 1.2, lean, MG_INK, null); tongue(c, x, 94, h, 0.85, lean, COL, CORE);
    }
  }
  // the stream: from the mouth to the dot in 120 ms, sagging a little, three bands of the comet's tail drawn the other way round, tongues off its upper edge;
  // it burns while the page holds, then shortens back into the mouth (4050-4150)
  function dgStream(c, G, t, S) {
    let f = MG.reduced ? 1 : easeOut(fe(UT.FIRE, UT.HIT, t));   // (reduced motion: the whole stream fades in instead of shooting)
    f *= 1 - ease(fe(UT.BACK, UT.SHUT, t));
    if (t < UT.FIRE || f < 0.01) return;
    c.globalAlpha = MG.reduced ? fe(UT.FIRE, UT.HIT, t) : 1;
    const E = [G.dot[0], G.dot[1] - 1.6], dx = E[0] - S[0], dy = E[1] - S[1], l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l; if (ny < 0) { nx = -nx; ny = -ny; }   // the normal that points down: the stream sags 4 units
    const C = [(S[0] + E[0]) / 2 + nx * 8, (S[1] + E[1]) / 2 + ny * 8], q = (s) => { const a = 1 - s; return [a * a * S[0] + 2 * a * s * C[0] + s * s * E[0], a * a * S[1] + 2 * a * s * C[1] + s * s * E[1]]; };
    const nt = MG.slow ? 3 : 6;
    for (let j = 0; j < nt; j++) {
      const s = f * (j + 0.4) / nt, p = q(s), w = 1 - s / f, hw = G.r * 0.31 * Math.pow(Math.max(w, 0.05), 0.85) * 0.75, fl = 0.6 + 0.4 * Math.sin(t * 0.04 + j * 2.1);
      const x = p[0] - nx * hw, y = p[1] - ny * hw, z = G.r / 13, h = (2.2 + 3.4 * fl) * (0.45 + 0.55 * w) * z, lean = -dx / l * 1.6 * z;
      tongue(c, x, y + 0.4, h * 1.18, 1.7 * (0.6 + 0.4 * w) * z, lean, MG_INK, null); tongue(c, x, y, h, 1.2 * (0.6 + 0.4 * w) * z, lean, COL, CORE);
    }
    const N = 18, pts = [];
    for (let i = 0; i <= N; i++) { const s = f * (1 - i / N), p = q(s), wb = Math.sin(t * 0.03 + i * 1.7) * 0.45 * (1 - i / N); pts.push([p[0] + nx * wb, p[1] + ny * wb]); }
    const sw = G.r * 0.62;   // the stream at the mouth (wide: 14 units)
    c.fillStyle = MG_INK; cometStroke(c, pts, sw);
    c.fillStyle = COL; cometStroke(c, pts, sw * 0.72);
    c.fillStyle = CORE; cometStroke(c, pts, sw * 0.32);
    c.globalAlpha = 1;
  }
  // the loser as a dot: an ink disc with a paper edge, two pinpoint eyes, a sweat drop, trembling; when the stream reaches it, a speck-sized comet along the
  // real launch direction (reduced motion: it fades where it stands)
  function dgDot(c, G, t) {
    const E = G.dot, R0 = 1.6;
    if (t < UT.HIT || MG.reduced) {
      const a = t < UT.HIT ? 1 : 1 - fe(UT.HIT, UT.HIT + 160, t);
      if (a <= 0.01) return;
      const sh = t < UT.HIT && !MG.reduced ? 0.3 * fe(3300, 3330, t) * (t > UT.IN && t < UT.FIRE ? 1.8 : 1) : 0, x = E[0] + Math.sin(t * 0.11) * sh, y = E[1] - R0 + Math.cos(t * 0.17) * sh * 0.5;
      c.globalAlpha = a;
      c.beginPath(); c.arc(x, y, R0, 0, Math.PI * 2); c.fillStyle = MG_INK; c.fill(); c.lineWidth = 0.45; c.strokeStyle = MG_PAPER; c.stroke();
      c.fillStyle = "#ffffff"; for (const [ox, oy] of [[-0.5, -0.35], [0.45, -0.3]]) { c.beginPath(); c.arc(x + ox, y + oy, 0.28, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.moveTo(x + 1.8, y - 2.2); c.quadraticCurveTo(x + 2.5, y - 1.2, x + 1.8, y - 0.9); c.quadraticCurveTo(x + 1.1, y - 1.2, x + 1.8, y - 2.2);
      c.fillStyle = "#dff0ff"; c.fill(); c.lineWidth = 0.3; c.strokeStyle = MG_INK; c.stroke();
      c.globalAlpha = 1;
      return;
    }
    if (t > UT.HIT + 700) return;
    const dl = Math.hypot(FIN.ldx, FIN.ldy) || 1, ux = FIN.ldx * FIN.dir / dl, uy = FIN.ldy / dl;
    const at = (dt) => { const s = Math.max(0, t - UT.HIT - dt) * 0.3; return [E[0] + ux * s, E[1] - R0 + uy * s]; };
    const pts = [at(120), at(80), at(40), at(0)];
    c.fillStyle = MG_INK; cometStroke(c, pts, 3.4); c.fillStyle = COL; cometStroke(c, pts, 2.3); c.fillStyle = CORE; cometStroke(c, pts, 0.8);
    const h = pts[3]; c.beginPath(); c.arc(h[0], h[1], 1.05, 0, Math.PI * 2); c.fillStyle = MG_INK; c.fill(); c.lineWidth = 0.35; c.strokeStyle = MG_PAPER; c.stroke();
  }
  function drawSplash(c, pn, t) {
    const G = dgGeo(), B = dgBits(), mouth = dgMouth(t), mp = dgMouthPt(G, mouth);
    pn.screen(c);
    if (!MG.slow) { const m = pn.p(...dgX(G, mp)), a = t < UT.FIRE ? 0.3 : 0.5 - 0.25 * fe(UT.FIRE + 120, UT.SLIT, t); mgFocus(c, m[0], m[1], Math.hypot(pn.w, pn.h) * 1.1, t * 0.0003, a); }
    pn.world(c);
    if (FIN.dir < 0) { c.translate(G.W, 0); c.scale(-1, 1); }
    c.lineJoin = "round"; c.lineCap = "round";
    c.drawImage(B.back, 0, 0, B.bw, 100);
    dgJaw(c, G, B, mouth, t);
    c.drawImage(B.front, B.f0[0], B.f0[1], B.fw, B.fh);
    dgEye(c, G, B, t);
    dgGlow(c, G, t);
    dgSlab(c, G, t);
    dgDot(c, G, t);
    // in screen px: the star where the stream meets the dot, three smoke rings rising from the burnt spot
    pn.screen(c);
    const e = pn.p(...dgX(G, [G.dot[0], G.dot[1] - 1.6])), u = pn.z;
    if (t >= UT.HIT && t < UT.HIT + 150) mgStarburst(c, e[0], e[1], 1 + 7 * u * easeOut(fe(UT.HIT, UT.HIT + 50, t)) * (1 - fe(UT.HIT + 100, UT.HIT + 150, t)), 0.3);
    for (let i = 0; i < (MG.slow ? 1 : 3); i++) {
      const k = fe(3900 + i * 200, 4500 + i * 200, t);
      if (k > 0 && k < 1) smokeRing(c, e[0] + Math.sin(i * 2.3) * u * 1.5, e[1] - u * (3 + 14 * k), u * (2 + 4 * easeOut(k)), 0.3 * (i - 1), 0.85 * (1 - k));
    }
  }
  // embers from the whole page streaming into the giant's mouth while he breathes in (over the page, like Inferno's own)
  function dgEmbers(o, t) {
    const pn = MG.byId.splash;
    if (t < UT.IN || t > UT.FIRE || !pn) return;
    const G = dgGeo(), m = pn.sp(...dgX(G, dgMouthPt(G, dgMouth(t))));
    for (const e of dgEmb) {
      const k = (t - e.t0) / e.life; if (k < 0 || k > 1) continue;
      const rr = e.r0 * Math.pow(1 - ease(k), 1.6), x = m[0] + Math.cos(e.a + k * 1.2) * rr, y = m[1] + Math.sin(e.a + k * 1.2) * rr * 0.8, sz = 2 + 2.2 * e.s * (1 - k * 0.5);
      o.fillStyle = MG_INK; o.beginPath(); o.arc(x, y, sz + 1.3, 0, 7); o.fill();
      o.fillStyle = e.hot ? CORE : COL; o.beginPath(); o.arc(x, y, sz, 0, 7); o.fill();
    }
  }
  // panel 5 comes down from the top on pale gold paper; the camera pushes in 6% about the mouth (not with reduced motion); the page shakes as the fire leaves
  const dgSplashPanel = () => mgSplashPanel({ from: "t", paper: MG_GOLD_PALE,
    cam: (t) => { const G = dgGeo(), M = dgX(G, G.M), s = 1 + (MG.reduced ? 0 : 0.06 * fe(MT.SPLASH, MT.AFTER, t)); return { wx: G.W / 2 + (M[0] - G.W / 2) * (1 - 1 / s), wy: 50 + (M[1] - 50) * (1 - 1 / s), vh: 100 / s }; },
    shake: (t) => { const a = 3 * fe(UT.FIRE, UT.FIRE + 20, t) * (1 - fe(UT.HIT, UT.NAME, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
    draw: drawSplash });
  S_.ulti = Object.assign({}, S_, {
    name: "Dragon's Age", pop: 3050,   // the launch waits for the gold impact frame
    start(g) { S_.start(g); ult = true; dgG = null; dgB = null; dgEmb = []; },
    end() { dgG = null; dgB = null; dgEmb = []; },
    panels(lay) {
      const ps = panels(lay), strike = ps.find((q) => q.id === "strike"), inset = ps.find((q) => q.id === "inset");
      strike.freeze = strike.cover = MT.SPLASH;   // panel 5 covers the whole page from here: the strike is drawn once more, then a bitmap
      inset.freeze = MT.STRIKE + 130;
      ps.splice(ps.findIndex((q) => q.id === "after"), 0, dgSplashPanel());
      return ps;
    },
    build(lay) {
      S_.build(lay);
      const r = mgRng(1717), n = MG.slow ? 22 : 45, R = Math.hypot(L.gw, L.gh) * 0.5;
      dgEmb = Array.from({ length: n }, () => { const t0 = UT.IN + r() * 140; return { t0, life: Math.min(150 + r() * 150, UT.FIRE - t0), a: r() * 6.283, r0: R * (0.3 + 0.7 * r()), s: 0.6 + r() * 0.9, hot: r() < 0.3 }; });
    },
    step(t, k) { S_.step(t, k); if (!dgB && t >= 1100) dgBits(); },   // the giant's bitmaps are made while panel 1 holds, not in the freeze frame
    // once panel 5 is in, the KO beam where the loser left the screen is cut short and its flying bits are gone; the real loser is no longer drawn
    after(t) { S_.after(t); if (t >= MT.SPLASH && t < MT.AFTER) { if (FIN.beam && FIN.beam.t0 > -1e5) FIN.beam.t0 = -1e6; FIN.parts.length = 0; } },
    drawLoser(c, pn, t) { if (t < MT.SPLASH) drawLoserFn(c, pn, t); },
    over(o, t) { S_.over(o, t); dgEmbers(o, t); },
    words(lay) {
      const D = FIN.dir, k0 = lay.port ? Math.min(1, L.gw * 0.9 / L.gh) : 1, mul = lay.port ? 0.5 : 1;
      // the engine's own upright scaling of Inferno's words, done here because the new words set their own
      const ws = S_.words(lay).map((w) => Object.assign({}, w, { mul: (w.mul || 1) * k0 }));
      ws[3].t1 = ws[4].t1 = MT.SPLASH + 150;   // BWOOOM and FWOOOSH are gone once the page turns
      const dotAt = () => { const G = dgGeo(), p = MG.byId.splash; return p.sp(...dgX(G, [G.dot[0], G.dot[1] - 1.6])); };
      const lr = clamp(Math.atan(FIN.ldy / (Math.abs(FIN.ldx) < 0.02 ? 0.02 : FIN.ldx)), -1.25, 1.25) * 0.85, dl = Math.hypot(FIN.ldx, FIN.ldy) || 1;
      const ms = lay.port ? Math.min(0.5, 0.86 * L.gw / (11 * 0.15 * L.gh * 0.62)) : 1;   // (a twelve-character name has to fit the upright page)
      ws.push(
        { text: "!", t0: 3330, t1: 3620, size: 0.06, mul, fill: "#ffffff", rot: 0, jit: 0, at: () => { const q = dotAt(); return [q[0], q[1] - L.gh * 0.06 * mul - MG.byId.splash.z * 2.4]; } },
        { text: "fwip", t0: 3650, t1: 3950, size: 0.045, mul, fill: "#ffffff", rot: lr, stretch: { ang: Math.atan2(FIN.ldy, FIN.ldx), k: 0.6 },
          at: () => { const q = dotAt(), z = MG.byId.splash.z; return [q[0] + FIN.ldx / dl * z * 10 - FIN.ldy / dl * z * 5 * D, q[1] + FIN.ldy / dl * z * 10 + Math.abs(FIN.ldx / dl) * z * 5]; } },
        { text: "DRAGON'S AGE", t0: UT.NAME, t1: MT.CARD + 120, size: 0.15, mul: ms, arc: 10, fill: MG_GOLD, rot: -0.06 * D,
          at: () => { const pg = MG.page, p = MG.byId.splash; return lay.port ? [L.gw / 2, pg.y + 0.56 * pg.h + p.oy] : [pg.x + (D > 0 ? 0.66 : 0.34) * pg.w, pg.y + 0.22 * pg.h + p.oy]; } },
      );
      return ws;
    },
    cues(t) {
      S_.cues(t);
      cueOnce("uPage", UT.IN, () => Cin.go(() => { Cin.sub(44, 30, 1.4, 0.5); Cin.growl(1.6); }));
      cueOnce("uInhale", UT.IN + 10, () => Cin.go(() => { Cin.inhale(0.9); Cin.riser(0.5, 0.12); }));
      cueOnce("uBang", 3330, () => Cin.go(() => Cin.pluck(1480)));
      cueOnce("uDrop", UT.DROP, () => Cin.go(() => Cin.drop(0.04)));   // (dips in 60 ms, so the silence ends just as the fire leaves)
      cueOnce("uRoar", UT.FIRE, () => Cin.go(() => { Cin.roar(1.4); Cin.rumble(1.2); }));
      cueOnce("uFwip", UT.HIT, () => Cin.go(() => { Cin.tick(2600); Cin.whoosh(0.12, FIN.dir * 0.8, FIN.dir * 0.9, 0.25); }));
      cueOnce("uName", UT.NAME, () => Cin.go(() => { Cin.taiko(0.8); Cin.chime(1568); }));
      cueOnce("uBurn", 4000, () => Cin.go(() => Cin._noise(0.6, 0.1, 1400, 500, "bandpass")));
      cueOnce("uSlit", UT.SLIT, () => Cin.go(() => Cin.pluck(1760)));
      cueOnce("uShut", UT.SHUT + 170, () => Cin.go(() => Cin.clack()));
    },
  });
  return S_;
})();
