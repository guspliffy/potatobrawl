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
   after(t), over(o, t), cues(t), drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt().
   POTATALITY: "Jacket Potato" = MANGA.dragon.alt (S_.alt, at the end; its helpers are prefixed jp), played on a normal KO when it is on (ui/kopages.js).
   POTATALITY 2: "Air Fryer" = MANGA.dragon.alt2 (S_.alt2, after it; its helpers are prefixed af), played when the second one is chosen (FIN.alt 2). */
MANGA.dragon = (function () {
  const WBOX = [-84, -130, 82, 12];   // what the Dragon with his wings can cover (measured over the whole page), a little tighter than the engine's default box
  const COL = "#ff8a3d", CORE = "#fff4d6", FLAME_DARK = "#d93a24";
  let ash = [], embers = [], smoke = [], rnd = Math.random;
  let ult = false;   // this play is the Ultimate page, "Dragon's Age" (set by start())
  let pota = false;  // this play is the Potatality, "Jacket Potato" (set by its start)
  let pota2 = false; // this play is the second Potatality, "Air Fryer" (set by its start)
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
    start() { ult = false; pota = false; pota2 = false; },
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
        const a = fe(800, 1100, t) * (1 - fe(MT.AFTER + 100, MT.AFTER + 700, t)) * (ult || pota || pota2 ? 1 - fe(MT.SPLASH - 150, MT.SPLASH, t) : 1), u = (t - 800) / 1000;
        o.fillStyle = "rgba(40,36,50,0.5)"; o.globalAlpha = a;
        for (const d of ash) { const y = ((d.y - d.v * u) % L.gh + L.gh) % L.gh, x = d.x + Math.sin(u * 1.3 + d.ph) * 10; o.beginPath(); o.arc(x, y, d.s, 0, 7); o.fill(); }
        o.globalAlpha = 1;
      }
      if (t > FIN.launch && t < FIN.launch + 420) {
        const Lp = L_(), pn = MG.byId.strike, a = (1 - fe(FIN.launch + 200, FIN.launch + 420, t)) * (ult || pota || pota2 ? 1 - fe(MT.SPLASH - 100, MT.SPLASH, t) : 1);
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
  /* ===================== the Potatality, "Jacket Potato" (MANGA.dragon.alt; design: Project files step8/fable-design.md) =====================
     Inferno to the roar and the pop (the comet is gone as the page turns). 3250 panel 5, the splash, slides up: one huge jacket potato in a crumpled foil boat in
     the loser's colour, split on top, a pat of butter melting into the fluff and two tiny panicked eyes in the split; its steam rises and bends over to the Dragon,
     who hovers beside it on beating wings. 3400 he sniffs it in (eyes shut), 3600 his head goes back and his belly lights (ah...), 3720 ACHOO: a fireball from his
     mouth, 3790 it lands in the split: FWOOM, the potato goes up in flames, the skin puffs up crisp and cracks; 4000 the fire dies to smoke, the eyes blink, he
     rubs his nose and grins. 4700 panel 4 as on Inferno (he shrinks back, the smoke ring) with the potato on its foil beside him: steam, the butter sliding off,
     the eyes blinking out of the jacket (sizzle); the engine's POP at 5250 leaves the empty jacket. Splash world: the potato's middle at FIN.wx + dir * dx on the
     ground (y 0), the Dragon at FIN.wx hovering lift above it (jpAsSplash). Every helper here is prefixed jp. */
  const JP = { SNIFF: 3400, BACK: 3600, ACHOO: 3720, HIT: 3790, CALM: 4000 };
  const JP_TAU = Math.PI * 2;
  let jpIn = false, jpGc = null, jpC = null;   // jpIn: the Dragon is being drawn into the splash (his pose there); jpGc / jpC: the layout and the colours, made once per page
  const jpLw = (pn) => Math.max(1.1, 3 / pn.z);   // an ink line, in world units
  // the splash: the potato's half-width R, the Dragon dx behind it (toward his side) hovering lift above the ground at scale sc, the camera's x off the potato;
  // panel 4: the potato ax in front of him, half-width ar, the loser lands land past it
  function jpGeo() {
    if (jpGc) return jpGc;
    const port = !!(MG.lay && MG.lay.port);
    jpGc = port ? { R: 62, dx: 46, sc: 1.25, lift: 138, cx: -12, ax: 44, ar: 25, land: 36 } : { R: 100, dx: 152, sc: 1.25, lift: 76, cx: -40, ax: 62, ar: 27, land: 52 };
    return jpGc;
  }
  function jpCols() {
    if (jpC) return jpC;
    const pal = L_().pal, skin = mixH(pal.body, "#9c5b2a", 0.55), ui = col(pal);
    jpC = { skin: mgTintCss(skin, 0.3), crisp: mgTintCss(mixH(skin, "#3a1f0e", 0.55), 0.15), speck: mixH(skin, "#2a160a", 0.6), blister: mgTintCss(mixH(skin, "#e8b070", 0.45), 0.3),
      foil: mgTintCss(mixH(ui, "#e4e7ee", 0.4), 0.25), fluff: "#fff4d8", fluffDk: "#efd9a6", hollow: "#3b2312", butter: "#ffd84a", butterHi: "#fff4a8" };
    return jpC;
  }
  // the Dragon as he hovers in the splash: a callback runs with him there (lifted, bobbing on his wing beats) and with the splash pose on
  function jpAsSplash(t, fn) {
    const W = W_(), oy = W.y; W.y = -jpGeo().lift + Math.sin(t * 0.018) * 2.5; jpIn = true;
    try { return fn(W); } finally { W.y = oy; jpIn = false; }
  }
  const jpPt = (t, key) => jpAsSplash(t, (W) => bodyPt(W, t, jpGeo().sc, key));
  const jpNose = (t) => { const m = jpPt(t, "mouthPt"), s = jpGeo().sc; return [m[0] + FIN.dir * 5 * s, m[1] - 4 * s]; };
  // his pose in the splash: admiring, the sniff (eyes shut, leaning in), head back (ah...), the sneeze (snapped forward, mouth wide), oops, rubbing his nose
  function jpPose(P, sk, t) {
    const w = sk.w, leg = sk.leg, tor = sk.tor, J = JP;
    const sn = ease(fe(J.SNIFF - 100, J.SNIFF + 60, t)), bk = ease(fe(J.BACK, J.ACHOO - 30, t)), ch = easeOut(fe(J.ACHOO - 30, J.ACHOO + 30, t)), rec = ease(fe(J.HIT + 80, J.CALM + 160, t));
    P.wingUp = 1; P.flap = 0.3 + Math.sin(t * 0.018) * 0.32 + 0.4 * ch * (1 - rec);   // beating to hover
    P.lean = (0.08 + 0.12 * sn - 0.42 * bk + 0.75 * ch) * (1 - rec) + 0.06 * rec;
    const sneeze = t >= J.ACHOO - 30 && t < J.HIT + 180, oops = t >= J.HIT + 180 && t < J.CALM + 160;
    P.mouth = sneeze ? 1 : 0;
    P.expr = sneeze ? "rage" : oops ? "terror" : t >= J.SNIFF - 100 && t < J.ACHOO - 30 ? "calm" : "grin"; P.exK = oops ? 0.7 : 1;
    if (t >= J.CALM + 160) return { hF: [w * 0.5 + Math.sin((t - J.CALM) * 0.03) * 2.5, -leg - tor * 0.55], hB: [-w * 0.8, -leg - tor * 0.72] };
    if (sneeze || oops) return { hF: [w * 0.5, -leg - tor * 1.1], hB: [-w * 0.95, -leg - tor * 0.95] };
    if (t >= J.BACK) return { hF: [w * 0.72, -leg - tor * 0.98], hB: [-w * 0.78, -leg - tor * 0.98] };
    return { hF: [w * 0.86, -leg - tor * 0.12], hB: [-w * 0.86, -leg - tor * 0.14] };
  }
  // the belly lights as the sneeze builds (Inferno's rings, on their own clock)
  function jpGlow(p, t, k) {
    if (k <= 0.02) return null;
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot([P.rx * 0.18, P.cy + P.ry * 0.55], P.hip, P.lean);
    return (lc, X) => {
      const cx = X.sx + p.facing * q[0] * X.z, cy = X.sy + q[1] * X.z, ry = P.ry * X.z;
      for (const [r, a, cl] of [[0.95, 0.3, COL], [0.68, 0.5, COL], [0.44, 0.78, COL], [0.2, 0.95, CORE]]) { lc.fillStyle = rgba(cl, a * k); lc.beginPath(); lc.ellipse(cx, cy, ry * r * 1.15, ry * r * 0.9, 0, 0, JP_TAU); lc.fill(); }
    };
  }
  // the potato's lumpy outline (a smooth closed curve through 20 points, flat where it sits on the ground)
  function jpBody(c, x, rx, ry) {
    c.beginPath();
    const n = 20, at = (i) => { const a = (i / n) * JP_TAU, k = 1 + 0.035 * Math.sin(a * 3 + 1) + 0.02 * Math.sin(a * 5 + 2); return [x + Math.cos(a) * rx * k, Math.min(0, -ry + Math.sin(a) * ry * k)]; };
    let p = at(0), q = at(1);
    c.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    for (let i = 1; i <= n; i++) { p = at(i); q = at(i + 1); c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    c.closePath();
  }
  // dot tone over a world path (fn builds it), the dots in device space like the engine's
  function jpTone(c, pn, size, cover, fn, rule) {
    c.save(); pn.world(c); c.beginPath(); fn(c); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(size, cover); c.fill(rule || "nonzero"); c.restore();
  }
  const JP_SPECK = [[-0.62, 0.55, 0.05], [-0.3, 0.3, 0.035], [0.18, 0.62, 0.04], [0.55, 0.42, 0.035], [0.78, 0.8, 0.03], [-0.05, 0.35, 0.03]];
  const JP_CRACK = [[-0.72, 0.62, 0.4], [-0.42, 0.38, -0.3], [-0.08, 0.7, 0.2], [0.3, 0.45, -0.5], [0.62, 0.68, 0.3], [0.45, 0.95, -0.2], [-0.55, 1.0, 0.1]];
  const JP_BLIST = [[-0.5, 0.82, 0.07], [0.12, 0.5, 0.06], [0.72, 0.55, 0.055], [-0.22, 1.05, 0.05]];
  // the jacket potato, bottom centre (x, 0), half-width rx, half-height ry (world units, c in the panel's world). o: { crisp 0..1, eyes 0..1 (open; 0 = blink),
  // look -1..1 (the pupils, toward the winner = -1), wide 0..1, shake (tremble, world units), melt 0..1, slide null | 0..1 (the butter sliding off), empty }
  function jpSpud(c, pn, x, rx, ry, o, t) {
    const Cc = jpCols(), lw = jpLw(pn), D = FIN.dir, Lx = x - 0.62 * rx, Rx = x + 0.58 * rx, Ly = -1.78 * ry, Ry = -1.8 * ry, cr = o.crisp, nearY = (o.empty ? -1.15 : -1.45) * ry;
    const skinFill = () => { c.fillStyle = Cc.skin; c.fill(); if (cr > 0.01) { c.globalAlpha = cr; c.fillStyle = Cc.crisp; c.fill(); c.globalAlpha = 1; } };
    pn.world(c);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = MG_INK;
    jpBody(c, x, rx, ry); skinFill(); c.lineWidth = lw * 1.4; c.stroke();
    // the far lip of the cut, standing up behind the fluff (peeled right back once he has popped out)
    c.beginPath(); c.moveTo(Lx, Ly); c.quadraticCurveTo(x - D * 0.08 * rx, (o.empty ? -3.1 : -2.5) * ry, Rx, Ry); c.quadraticCurveTo(x, -2.0 * ry, Lx, Ly); c.closePath();
    skinFill(); c.lineWidth = lw * 1.2; c.stroke();
    c.beginPath(); c.moveTo(Lx + rx * 0.06, Ly - ry * 0.05); c.quadraticCurveTo(x, -2.05 * ry, Rx - rx * 0.06, Ry - ry * 0.05); c.lineWidth = lw * 1.6; c.strokeStyle = Cc.fluffDk; c.stroke(); c.strokeStyle = MG_INK;
    if (o.empty) {   // the open jacket: a dark hollow with a floury lining, a few crumbs of fluff on the rim
      c.beginPath(); c.moveTo(Lx, Ly); c.quadraticCurveTo(x, -2.1 * ry, Rx, Ry); c.quadraticCurveTo(x, nearY, Lx, Ly); c.closePath();
      c.fillStyle = Cc.fluffDk; c.fill(); c.lineWidth = lw; c.stroke();
      c.beginPath(); c.moveTo(Lx + rx * 0.1, Ly - ry * 0.02); c.quadraticCurveTo(x, -1.98 * ry, Rx - rx * 0.1, Ry - ry * 0.02); c.quadraticCurveTo(x, nearY - ry * 0.12, Lx + rx * 0.1, Ly - ry * 0.02); c.closePath();
      c.fillStyle = Cc.hollow; c.fill();
      c.fillStyle = Cc.fluff; c.lineWidth = lw * 0.8;
      for (const [fx, fr] of [[-0.42, 0.07], [0.3, 0.06], [0.05, 0.05]]) { c.beginPath(); c.arc(x + fx * rx, -1.84 * ry + Math.abs(fx) * 0.1 * ry, fr * rx, 0, JP_TAU); c.fill(); c.stroke(); }
    } else {   // the fluff: floury puffs bulging out of the split (all the ink first, then all the cream, so it reads as one cloud), dots on its lower side
      const puffs = (g, grow, dy) => { for (let i = 0; i < 5; i++) { const k = i / 4, b = Math.sin(Math.PI * k), px = lerp(Lx + 0.1 * rx, Rx - 0.1 * rx, k) + (i % 2 ? 0.02 : -0.02) * rx, py = lerp(Ly, Ry, k) - 0.12 * ry - 0.36 * ry * b + dy, r = rx * (0.15 + 0.08 * b) * (i === 1 || i === 3 ? 1.05 : 0.95) + grow; g.moveTo(px + r, py); g.arc(px, py, r, 0, JP_TAU); } };
      c.beginPath(); puffs(c, lw * 0.75, 0); c.fillStyle = MG_INK; c.fill();
      c.beginPath(); puffs(c, 0, 0); c.fillStyle = Cc.fluff; c.fill();
      jpTone(c, pn, 6, 0.3, (g) => puffs(g, -rx * 0.06, ry * 0.12));
      pn.world(c);
      c.lineWidth = lw * 0.8; c.beginPath();   // a few floury ticks
      for (const [fx, fy] of [[-0.34, -2.25], [0.04, -2.5], [0.36, -2.22]]) { const px = x + fx * rx, py = fy * ry; c.moveTo(px - rx * 0.04, py); c.quadraticCurveTo(px, py - rx * 0.03, px + rx * 0.04, py); }
      c.stroke();
    }
    // the near face of the skin, over the bottom of the fluff: skin, the crisp, a band of dots away from the light, specks, cracks and blisters
    c.save(); jpBody(c, x, rx, ry); c.clip();
    c.beginPath(); c.moveTo(Lx - rx, Ly + 2); c.lineTo(Lx, Ly); c.quadraticCurveTo(x, nearY, Rx, Ry); c.lineTo(Rx + rx, Ry + 2); c.lineTo(Rx + rx, 4); c.lineTo(Lx - rx, 4); c.closePath();
    skinFill();
    c.beginPath(); c.rect(x - 2 * rx, -3 * ry, 4 * rx, 4 * ry); c.ellipse(x - D * rx * 0.24, -ry * 1.18, rx * 1.02, ry * 1.0, 0, 0, JP_TAU);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(7, 0.42); c.fill("evenodd"); c.restore();
    c.fillStyle = Cc.speck;
    for (const [sx, sy, sr] of JP_SPECK) { c.beginPath(); c.ellipse(x + sx * rx, -sy * ry, sr * rx, sr * rx * 0.6, 0.5, 0, JP_TAU); c.fill(); }
    if (cr > 0.02) {
      c.globalAlpha = cr; c.lineWidth = lw * 0.9; c.beginPath();
      for (const [cx, cy, a] of JP_CRACK) { const L2 = rx * 0.1, ca = Math.cos(a), sa = Math.sin(a); let px = x + cx * rx, py = -cy * ry; c.moveTo(px, py); for (let j = 1; j <= 3; j++) { px += ca * L2 + (j % 2 ? -sa : sa) * L2 * 0.35; py += sa * L2 + (j % 2 ? ca : -ca) * L2 * 0.35; c.lineTo(px, py); } }
      c.stroke();
      c.fillStyle = Cc.blister; c.lineWidth = lw * 0.7;
      for (const [bx, by, br] of JP_BLIST) { const r = br * rx * (0.45 + 0.3 * cr); c.beginPath(); c.arc(x + bx * rx, -by * ry, r, 0, JP_TAU); c.fill(); c.beginPath(); c.arc(x + bx * rx, -by * ry, r, 0.2, Math.PI - 0.2); c.stroke(); }
      c.globalAlpha = 1;
    }
    // a sheen on the shoulder toward the light
    c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = rx * 0.05; c.beginPath(); c.ellipse(x, -ry, rx * 0.84, ry * 0.8, 0, D > 0 ? 3.55 : -1.05, D > 0 ? 4.2 : -0.41); c.stroke();
    c.restore();
    // the near lip: the cut edge of the skin (a pale line just under the ink)
    c.beginPath(); c.moveTo(Lx, Ly); c.quadraticCurveTo(x, nearY, Rx, Ry); c.lineWidth = lw * 1.3; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); c.moveTo(Lx + rx * 0.05, Ly + ry * 0.07); c.quadraticCurveTo(x, nearY + ry * 0.07, Rx - rx * 0.05, Ry + ry * 0.07); c.lineWidth = lw * 1.2; c.strokeStyle = Cc.fluffDk; c.stroke(); c.strokeStyle = MG_INK;
    c.save(); c.beginPath(); c.rect(x - 2 * rx, Math.min(Ly, Ry) + lw, 4 * rx, 3 * ry); c.clip(); jpBody(c, x, rx, ry); c.lineWidth = lw * 1.4; c.stroke(); c.restore();
    // the foil, a crumpled boat round his bottom in his colour
    c.beginPath();
    for (let i = 0; i <= 12; i++) { const k = i / 12, u = 2 * k - 1, px = x + u * rx * 1.07, py = -ry * (0.62 - 0.22 * (1 - u * u) + (i % 2 ? 0.1 : 0)); i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.lineTo(x + rx * 0.93, ry * 0.05); c.lineTo(x - rx * 0.93, ry * 0.05); c.closePath();
    c.fillStyle = Cc.foil; c.fill(); c.lineWidth = lw * 1.2; c.stroke();
    jpTone(c, pn, 6, 0.45, (g) => { g.moveTo(x + D * rx * 0.45, -ry * 0.42); g.lineTo(x + D * rx * 1.05, -ry * 0.55); g.lineTo(x + D * rx * 0.93, ry * 0.05); g.lineTo(x + D * rx * 0.4, ry * 0.05); g.closePath(); });
    pn.world(c);
    c.strokeStyle = MG_INK; c.lineWidth = lw * 0.7; c.beginPath();
    for (const [fx, fy, a] of [[-0.75, 0.3, 0.6], [-0.35, 0.2, -0.4], [0.15, 0.32, 0.5], [0.6, 0.22, -0.6]]) { c.moveTo(x + fx * rx, -fy * ry); c.lineTo(x + fx * rx + Math.cos(a) * rx * 0.1, -fy * ry + Math.sin(a) * rx * 0.08); }
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = lw * 1.1; c.beginPath(); c.moveTo(x - D * rx * 0.7, -ry * 0.36); c.lineTo(x - D * rx * 0.45, -ry * 0.3); c.stroke();
    c.strokeStyle = MG_INK;
    if (o.empty) return;
    // the eyes in the fluff: tiny, white, pinpoint pupils, worried brows; they tremble; a sweat drop while he panics
    const er = rx * (0.06 + 0.025 * (o.wide || 0)), sh = o.shake || 0, ex0 = x - D * rx * 0.06 + Math.sin(t * 0.09) * sh, ey = -2.12 * ry + Math.cos(t * 0.13) * sh * 0.5;
    for (const sd of [-1, 1]) {
      const ex = ex0 + sd * rx * 0.105;
      if (o.eyes < 0.25) { c.lineWidth = lw; c.beginPath(); c.moveTo(ex - er, ey); c.quadraticCurveTo(ex, ey + er * 0.6, ex + er, ey); c.stroke(); continue; }
      c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, er * 0.85, er * 1.15 * o.eyes, 0, 0, JP_TAU); c.fill(); c.lineWidth = lw * 0.9; c.stroke();
      c.fillStyle = MG_INK; c.beginPath(); c.arc(ex + (o.look || 0) * D * er * 0.4, ey + er * 0.1, er * 0.3, 0, JP_TAU); c.fill();
      c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(ex + sd * er * 1.05, ey - er * 1.45); c.lineTo(ex - sd * er * 0.55, ey - er * 2.0); c.stroke();
    }
    if (o.sweat > 0.02) {
      const sx = ex0 - D * rx * 0.24, sy = ey - er * (1.6 + 0.6 * Math.abs(Math.sin(t * 0.012))), s2 = er * 0.9;
      c.globalAlpha = o.sweat; c.beginPath(); c.moveTo(sx, sy - s2 * 1.3); c.quadraticCurveTo(sx + s2, sy + s2 * 0.3, sx, sy + s2 * 0.8); c.quadraticCurveTo(sx - s2, sy + s2 * 0.3, sx, sy - s2 * 1.3);
      c.fillStyle = "#dff0ff"; c.fill(); c.lineWidth = lw * 0.8; c.stroke(); c.globalAlpha = 1;
    }
    // the butter: a thick pat on the fluff's shoulder (front and top face), sagging, pooling and running as it melts; sliding off down his side (slide 0..1) in panel 4
    const m = o.melt || 0, bw = rx * 0.3, bh = rx * 0.11 * (1 - 0.5 * m), bd = rx * 0.07 * (1 - 0.3 * m);
    let bx = x + D * rx * 0.3, by = -2.32 * ry, ba = 0.18 * D;
    if (o.slide) { const s = ease(o.slide); bx = lerp(bx, x + D * rx * 1.12, s); by = lerp(by, -bh * 0.5, s * s); ba = lerp(ba, 0.9 * D, Math.min(1, s * 1.6)) * (1 - fe(0.85, 1, o.slide) * 0.9); }
    else if (m > 0.05) {   // a pool round its foot and drips down the fluff
      c.beginPath(); c.ellipse(bx, by + bh * 0.4, bw * (0.55 + 0.35 * m), bw * (0.14 + 0.08 * m), ba, 0, JP_TAU); c.fillStyle = Cc.butter; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
      c.lineWidth = rx * 0.04 + lw * 1.6; c.beginPath();
      for (const [dx, len] of [[-0.45, 0.5], [0.1, 0.95], [0.55, 0.35]]) { const px = bx + dx * bw; c.moveTo(px, by + bh * 0.5); c.lineTo(px + D * len * rx * 0.03, by + bh * 0.5 + ry * 0.45 * len * m); }
      c.stroke(); c.lineWidth = rx * 0.04; c.strokeStyle = Cc.butter; c.stroke(); c.strokeStyle = MG_INK;
    }
    c.save(); c.translate(bx, by); c.rotate(ba);
    const rr = Math.min(bh * 0.45, rx * 0.012 + m * bh * 0.4);
    c.beginPath(); c.moveTo(-bw / 2, -bh / 2); c.lineTo(-bw / 2 + bd * 0.7, -bh / 2 - bd); c.lineTo(bw / 2 + bd * 0.7, -bh / 2 - bd); c.lineTo(bw / 2, -bh / 2); c.closePath();
    c.fillStyle = Cc.butterHi; c.fill(); c.lineWidth = lw; c.stroke();
    c.beginPath(); c.roundRect(-bw / 2, -bh / 2, bw, bh, [0, 0, rr, rr]); c.fillStyle = Cc.butter; c.fill(); c.stroke();
    c.restore();
  }
  // the steam: a stream of overlapping puffs from the split (one ink outline round all of them, then the white), rising and bending over to his nose, big at
  // the root and small at the nose, flowing along; sniffed in, it flows faster. smoke: the same, rising, in dot tone
  const JP_PUFF = new Float32Array(16 * 3);
  function jpSteam(c, pn, t, S, E, k, a, smoke) {
    if (a <= 0.02) return;
    const lw = jpLw(pn), dx = E[0] - S[0], dy = E[1] - S[1], L = Math.hypot(dx, dy) || 1, C = [S[0] + dx * 0.05, Math.min(S[1], E[1]) - L * 0.32], n = smoke ? 6 : 16;
    const ph = (t * (smoke ? 0.0009 : 0.0016) * (1 + 1.5 * k)) % 1, R0 = L * 0.12 * a;
    for (let i = 0; i < n; i++) {
      const s = Math.min(1, (i + ph) / (n - 0.5)), u = 1 - s, px = u * u * S[0] + 2 * u * s * C[0] + s * s * E[0], py = u * u * S[1] + 2 * u * s * C[1] + s * s * E[1];
      const r = R0 * (smoke ? (0.4 + 0.9 * s) * Math.min(1, (1 - s) * 3, s * 8) : (1 - 0.4 * s) * Math.min(1, (1 - s) * 7)) * (0.85 + 0.15 * Math.sin(i * 2.7 + t * 0.006)), wob = Math.sin(s * 9 - t * 0.008) * L * 0.025 * (1 - k * 0.6);
      JP_PUFF[i * 3] = px + wob; JP_PUFF[i * 3 + 1] = py - wob * 0.4; JP_PUFF[i * 3 + 2] = r;
    }
    pn.world(c);
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (let i = 0; i < n; i++) { const r = JP_PUFF[i * 3 + 2] + (pass ? 0 : lw * 1.1); if (r > lw * 0.5) { c.moveTo(JP_PUFF[i * 3] + r, JP_PUFF[i * 3 + 1]); c.arc(JP_PUFF[i * 3], JP_PUFF[i * 3 + 1], r, 0, JP_TAU); } }
      c.fillStyle = pass ? (smoke ? MG_PAPER : "#ffffff") : MG_INK; c.fill();
      if (pass && smoke) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(5, 0.45); c.fill(); c.restore(); }
    }
  }
  // the fireball: from his snout (at the sneeze) into the split, a little arc, a comet's tail
  function jpFireball(c, pn, t, M, T, R) {
    const k0 = fe(JP.ACHOO, JP.HIT, t);
    if (k0 <= 0 || k0 >= 1) return;
    const at = (k) => { const e = easeIn(k) * 0.6 + k * 0.4; return [lerp(M[0], T[0], e), lerp(M[1], T[1], e) - Math.sin(Math.PI * e) * R * 0.18]; };
    const pts = [at(Math.max(0, k0 - 0.5)), at(Math.max(0, k0 - 0.36)), at(Math.max(0, k0 - 0.22)), at(Math.max(0, k0 - 0.1)), at(k0)], rb = R * 0.12;
    pn.world(c);
    c.fillStyle = MG_INK; cometStroke(c, pts, rb * 2.5); c.fillStyle = COL; cometStroke(c, pts, rb * 1.8); c.fillStyle = CORE; cometStroke(c, pts, rb * 0.8);
    const h = pts[4];
    c.beginPath(); c.arc(h[0], h[1], rb, 0, JP_TAU); c.fillStyle = COL; c.fill(); c.lineWidth = jpLw(pn) * 1.2; c.strokeStyle = MG_INK; c.stroke();
    c.beginPath(); c.arc(h[0], h[1], rb * 0.55, 0, JP_TAU); c.fillStyle = CORE; c.fill();
  }
  // FWOOM: he goes up in flames: one mass of fire behind him, standing on his top edge, its tongues curling up (tallest out of the split; the fluff and the
  // eyes stay in front of it), three nested layers (ink-edged accent, light, core). It roars for 200 ms and dies down by 4260.
  function jpFlames(c, pn, t, x, rx, ry) {
    const f = easeOut(fe(JP.HIT, JP.HIT + 70, t)) * (1 - ease(fe(JP.HIT + 220, JP.CALM + 260, t)));
    if (f <= 0.02) return;
    const lw = jpLw(pn), M = MG.slow ? 5 : 7, a0 = Math.PI + 0.08, da = (Math.PI - 0.16) / M;
    const rim = (a) => [x + Math.cos(a) * rx * 0.98, -ry + Math.sin(a) * ry * 0.98];
    pn.world(c); c.lineJoin = "round";
    for (const [k, fill] of [[1, COL], [0.62, "#ffc27a"], [0.3, CORE]]) {
      c.beginPath();
      let v = rim(a0); c.moveTo(v[0], v[1] + ry * 0.3); c.lineTo(v[0], v[1]);
      for (let i = 0; i < M; i++) {
        const am = a0 + da * (i + 0.5), b = rim(am), mid = Math.sin(Math.PI * (i + 0.5) / M), fl = 0.82 + 0.18 * Math.sin(t * 0.032 + i * 2.1);
        const h = rx * (0.32 + 0.62 * mid * mid) * f * fl * k, lean = Math.cos(am) * 0.35 + Math.sin(t * 0.02 + i * 1.3) * 0.18, P = [b[0] + lean * h, b[1] - h];
        const w = rim(a0 + da * (i + 1)), cw = rx * 0.1 * k;
        c.quadraticCurveTo(v[0] + (P[0] - v[0]) * 0.25 - cw, v[1] + (P[1] - v[1]) * 0.75, P[0], P[1]);
        c.quadraticCurveTo(w[0] + (P[0] - w[0]) * 0.2 + cw, w[1] + (P[1] - w[1]) * 0.55, w[0], w[1]);
        v = w;
      }
      c.lineTo(v[0], v[1] + ry * 0.3); c.closePath();
      if (k === 1) { c.lineWidth = lw * 2.4; c.strokeStyle = MG_INK; c.stroke(); }
      c.fillStyle = fill; c.fill();
    }
  }
  // sniff marks: three little strokes pointing into his nose
  function jpSniffMarks(c, pn, t, N, s) {
    const a = fe(JP.SNIFF - 60, JP.SNIFF + 40, t) * (1 - fe(JP.BACK - 60, JP.BACK + 40, t));
    if (a <= 0.02) return;
    const D = FIN.dir, lw = jpLw(pn), pulse = 1 + 0.25 * Math.sin((t - JP.SNIFF) * 0.035);
    pn.world(c); c.globalAlpha = a; c.lineWidth = lw * 1.1; c.strokeStyle = MG_INK; c.beginPath();
    for (let i = -1; i <= 1; i++) { const ang = (D > 0 ? -0.5 : Math.PI + 0.5) + i * 0.45, r0 = 6 * s * pulse, r1 = 11 * s * pulse; c.moveTo(N[0] + Math.cos(ang) * r0, N[1] + Math.sin(ang) * r0); c.lineTo(N[0] + Math.cos(ang) * r1, N[1] + Math.sin(ang) * r1); }
    c.stroke(); c.globalAlpha = 1;
  }
  function jpDrawSplash(c, pn, t) {
    const G = jpGeo(), D = FIN.dir, J = JP, X = FIN.wx + D * G.dx, R = G.R, hit = fe(J.HIT, J.HIT + 90, t);
    const puff = 1 + 0.12 * Math.sin(Math.PI * fe(J.HIT, J.HIT + 240, t)) + 0.04 * ease(fe(J.HIT, J.HIT + 300, t)), rx = R * puff, ry = R * 0.55 * puff;
    pn.screen(c);
    // behind: the Dragon's dot disc and focus lines round the potato; at FWOOM the lines catch fire
    const q = pn.p(X, -ry * 1.6);
    mgToneFill(c, discPoly(q[0], q[1], Math.min(pn.w, pn.h) * 0.62, 40), 10, 0.22, [t * 0.001, -t * 0.001]);
    c.beginPath(); c.arc(q[0], q[1], Math.min(pn.w, pn.h) * 0.45, 0, JP_TAU); c.fillStyle = MG_PAPER; c.fill();
    const fire = hit * (1 - 0.65 * fe(J.CALM, MT.AFTER, t));
    if (hit < 1) mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.5 * (1 - hit));
    if (fire > 0.02) mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.9, t * 0.0005, 0.85 * fire, COL);
    ground(c, pn, t);
    // the burst where the fireball lands, behind him and the potato
    const sb = easeOut(fe(J.HIT, J.HIT + 60, t)) * (1 - fe(J.HIT + 140, J.HIT + 260, t));
    if (sb > 0.02) { pn.screen(c); const b = pn.p(X, -2.2 * ry); mgStarburst(c, b[0], b[1], R * pn.z * (0.6 + 1.1 * sb), 0.3); }
    // the Dragon hovering beside it, wings beating, the belly lit as the sneeze builds
    const glow = fe(J.BACK - 80, J.ACHOO, t) * (1 - fe(J.ACHOO, J.HIT, t));
    jpAsSplash(t, (W) => mgPuppet(c, pn, W, t, { sc: G.sc, light: dirAng(-0.6), post: jpGlow(W, t, glow), under: wingsUnder(W, t), box: WBOX }));
    // the steam: rises, bends to his nose (3250-3400), is sniffed in faster (3400-3600), thins while his head is back, is blown away by the sneeze
    const N = jpNose(Math.min(t, J.BACK)), S = [X - D * 0.08 * rx, -2.6 * ry], E0 = [S[0] - D * R * 0.25, S[1] - R * 1.35], bend = ease(fe(MT.SPLASH + 60, J.SNIFF, t));
    const E = [lerp(E0[0], N[0], bend), lerp(E0[1], N[1], bend)], sniff = fe(J.SNIFF - 80, J.SNIFF + 80, t) * (1 - fe(J.BACK, J.BACK + 120, t));
    jpSteam(c, pn, t, S, E, sniff, (1 - 0.45 * fe(J.BACK, J.ACHOO, t)) * (1 - fe(J.ACHOO, J.ACHOO + 60, t)));
    jpSniffMarks(c, pn, t, N, G.sc);
    // after the fire, smoke rises from the split
    const sm = fe(J.CALM - 120, J.CALM + 120, t) * (1 - 0.3 * fe(4400, MT.AFTER, t));
    if (sm > 0.02) jpSteam(c, pn, t, [X, -2.2 * ry], [X + D * R * 0.2, -2.2 * ry - R * (0.6 + 0.9 * easeOut(fe(J.CALM - 120, J.CALM + 400, t)))], 0, 1.1 * sm, true);
    jpFlames(c, pn, t, X, rx, ry);
    // the potato: panicked until the hit, then wide-eyed and blinking
    const blink = (t >= 4230 && t < 4300) || (t >= 4470 && t < 4540) ? 0 : 1, look = t < J.HIT ? -1 : t < J.CALM + 200 ? 0 : -0.6;
    jpSpud(c, pn, X, rx, ry, { crisp: ease(fe(J.HIT + 30, J.HIT + 260, t)), eyes: blink, look, wide: fe(J.ACHOO, J.ACHOO + 60, t), shake: t < J.HIT + 300 ? Math.max(1.2, 3 * fe(J.BACK, J.ACHOO, t)) * jpLw(pn) * 0.6 : 0,
      sweat: 1 - fe(J.ACHOO, J.HIT, t), melt: 0.25 + 0.35 * fe(MT.SPLASH, J.HIT, t) + 0.4 * ease(fe(J.HIT, J.HIT + 400, t)), slide: null, empty: false }, t);
    jpFireball(c, pn, t, jpPt(J.ACHOO, "mouthPt"), [X, -2.3 * ry], R);
    // the flash as it lands
    const fl = 0.7 * (1 - fe(J.HIT, J.HIT + 110, t)) * (t >= J.HIT ? 1 : 0);
    if (fl > 0.01) { pn.screen(c); c.fillStyle = `rgba(255,252,244,${fl.toFixed(3)})`; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); }
  }
  const jpCam = (t, pn) => {
    const G = jpGeo(), port = MG.lay.port, push = 1 + (MG.reduced ? 0 : 0.05 * fe(MT.SPLASH, MT.AFTER, t)), vh = (port ? 150 * pn.h / pn.w : 232) / push;
    return { wx: FIN.wx + FIN.dir * (G.dx + G.cx), wy: -vh * (port ? 0.385 : 0.38), vh };
  };
  const jpShake = (t) => { const a = 3 * fe(JP.ACHOO, JP.ACHOO + 20, t) * (1 - fe(JP.ACHOO + 50, JP.HIT, t)) + 6 * fe(JP.HIT, JP.HIT + 20, t) * (1 - fe(JP.HIT + 60, JP.HIT + 320, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; };
  // panel 4: Inferno's aftermath with the potato on its foil beside him: steam, the butter sliding off, the eyes blinking out of the jacket; once popped, the empty jacket
  function jpDrawAfter(c, pn, t) {
    drawAfter(c, pn, t);
    const G = jpGeo(), D = FIN.dir, x = FIN.wx + D * G.ax, rx = G.ar, ry = G.ar * 0.55, popped = mgPopped(t);
    const blink = (t >= 4950 && t < 5020) || (t >= 5130 && t < 5200) ? 0 : 1;
    jpSpud(c, pn, x, rx, ry, { crisp: 1, eyes: blink, look: t < 5050 ? -1 : 0.2, wide: 0.4, shake: 0, melt: 0.5, slide: fe(MT.AFTER + 80, MT.AFTER + 480, t), empty: popped }, t);
    // a curl of steam
    const lw = jpLw(pn), a = fe(MT.AFTER + 60, MT.AFTER + 260, t) * (popped ? 0.6 : 1);
    if (a > 0.02) {
      pn.world(c); c.globalAlpha = a; c.strokeStyle = MG_INK; c.lineWidth = lw * 0.9; c.lineCap = "round";
      for (let i = 0; i < 2; i++) {
        const sx = x + (i ? 0.25 : -0.2) * rx, ph = ((t - MT.AFTER) * 0.02 + i * 9) % 18;
        c.beginPath(); for (let j = 0; j <= 9; j++) { const yy = -2.4 * ry - ph * 0.6 - j * 2.2, xx = sx + Math.sin(j * 0.8 + t * 0.006 + i) * 2.2; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  S_.alt = Object.assign({}, S_, {
    name: "Jacket Potato",
    start(g) { S_.start(g); pota = true; jpGc = null; jpC = null; jpIn = false; },
    end() { pota = false; jpGc = null; jpC = null; jpIn = false; },   // (the Dragon's S_ has no end of its own)
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after"), D = FIN.dir;
      strike.freeze = strike.cover = MT.SPLASH;   // the splash covers the whole page from here: the strike is drawn once more, then a bitmap
      after.draw = jpDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 112 : 96) * (1 - 0.07 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + D * (lay.port ? 30 : 34), wy: -0.45 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: MG_PAPER, slide: MG.reduced ? 1 : 180, cam: jpCam, shake: jpShake, draw: jpDrawSplash }));
      return ps;
    },
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir;
      ws[3].t1 = ws[4].t1 = MT.SPLASH + 150;   // BWOOOM and FWOOOSH are gone as the splash comes up
      const sp = (t, w) => { const pn = MG.byId.splash; mgPlace(pn, t); return pn.sp(w[0], w[1]); };
      const head = (t) => jpPt(Math.min(t, JP.CALM), "head");
      ws.push(
        { text: "ah...", t0: JP.BACK - 40, t1: JP.ACHOO + 150, size: 0.08, jit: 0.12, rot: -0.12 * D,
          at: (t) => { const h = head(JP.BACK + 60), s = jpGeo().sc; return sp(t, [h[0] + D * 16 * s, h[1] - 36 * s]); } },
        { text: "ACHOO!", t0: JP.ACHOO, t1: JP.CALM + 260, size: 0.13, jag: 0.14, rot: -0.16 * D,
          at: (t) => { const h = head(JP.ACHOO), s = jpGeo().sc; return sp(t, [h[0] + D * 30 * s, h[1] - 30 * s]); } },
        { text: "FWOOM", t0: JP.HIT, t1: MT.AFTER + 120, size: 0.22, arc: 8, fill: "#ffd27a", rot: -0.06 * D,
          at: (t) => { const G = jpGeo(), X = FIN.wx + D * G.dx; return lay.port ? sp(t, [X, -0.28 * G.R]) : sp(t, [X + D * G.R * 0.6, -G.R * 1.6]); } },
        { text: "sizzle", t0: MT.AFTER + 140, t1: MT.POP + 20, size: 0.06, jit: 0.12, rot: 0.1 * D,
          at: () => { const pn = MG.byId.after, G = jpGeo(); mgPlace(pn, MT.AFTER + 300); return pn.sp(FIN.wx + D * (G.ax + G.ar * 0.9), -G.ar * 1.9); } },
      );
      return ws;
    },
    step(t, k) { S_.step(t, k); if (t >= 1100 && !MG.discC[COL]) mgNeedDisc(COL); },   // the fire-coloured focus lines of FWOOM, made while panel 1 holds
    pose(P, sk, t, role, p) { return role === "w" && jpIn ? jpPose(P, sk, t) : S_.pose(P, sk, t, role, p); },
    food() { const G = jpGeo(), x = FIN.wx + FIN.dir * G.ax; return { x, y: 0, r: G.ar, y0: -G.ar * 1.1, lx: x + FIN.dir * G.land }; },
    cues(t) {
      S_.cues(t);
      cueOnce("jpUp", MT.SPLASH + 40, () => Cin.go(() => Cin._noise(0.8, 0.05, 2600, 4200, "highpass", 0.8)));
      cueOnce("jpSniff", JP.SNIFF, () => Cin.go(() => { Cin._noise(0.1, 0.16, 1400, 3400, "bandpass", 1.6); Cin._noise(0.12, 0.18, 1400, 3600, "bandpass", 1.6, 0.17); }));
      cueOnce("jpAh", JP.BACK, () => Cin.go(() => { Cin._osc("triangle", 300, 520, 0.12, 0.05, 0.03); Cin._osc("triangle", 340, 620, 0.14, 0.06, 0.03, 0.03); }));
      cueOnce("jpAchoo", JP.ACHOO, () => Cin.go(() => { Cin._noise(0.28, 0.45, 3000, 700, "bandpass", 0.9); Cin._osc("square", 520, 160, 0.16, 0.08, 0.004); }));
      cueOnce("jpFwoom", JP.HIT, () => Cin.go(() => { Cin.roar(0.5); Cin.boom(0.6); }));
      cueOnce("jpCrisp", JP.HIT + 160, () => Cin.go(() => Cin._noise(0.5, 0.08, 4200, 7000, "highpass", 1.2)));
      cueOnce("jpBlink1", 4230, () => Cin.go(() => Cin.tick(2600)));
      cueOnce("jpBlink2", 4470, () => Cin.go(() => Cin.tick(2600)));
      cueOnce("jpSizzle", MT.AFTER + 140, () => Cin.go(() => Cin._noise(0.7, 0.05, 3000, 5200, "highpass", 0.8)));
      cueOnce("jpBlink3", 4950, () => Cin.go(() => Cin.tick(2900)));
    },
  });
  /* ===================== the second Potatality, "Air Fryer" (MANGA.dragon.alt2; design: Project files step8/fable-design-2.md §1.1) =====================
     Inferno to the roar and the pop (the comet is gone as the page turns). 3250 panel 5, the splash, slides up: a round wire air-fryer drum on its stand with
     the loser inside, gripping the mesh; the Dragon hovers behind it, only his head over the rim, his wings either side as the fan's blades (WHIRRR over the drum).
     3300-3900 the wings beat (every 180 ms a gust ring blows into the drum), the drum spins up to 2 turns a second (8 speed arcs), the loser tumbles three turns,
     cheeks puffed; 3900 ding: it stops in a puff of steam; 3945 it tips over its foot toward a red-and-white paper basket and 7 golden wedges tumble in (the top
     one has the loser's eyes and a wisp of steam); 4165 the Dragon swoops over behind the basket, 4320 pokes the top wedge (ow!), it wobbles twice. 4700 panel 4
     as on Inferno with the basket beside him, the top wedge rocking and waving; the engine's POP at 5250 leaves the basket torn open, two wedges on the ground.
     Splash world: the drum's axle at (FIN.wx, -G.ay) (it lurches as it tips), the basket's foot at (G.bx, 0); the camera pushes in on the basket from 4140.
     Shapes are drawn as for a winner on the left and mirrored by FIN.dir. Every helper here is prefixed af. */
  const AF = { WHIRR: 3300, FULL: 3700, COAST: 3880, STOP: 3920, DING: 3900, SWAP: 3945, TIP: 3945, POUR: 3990, FLY: 95, BACK: 4140, SWOOP: 4165, LAND: 4290, POKE: 4320, WOB: 4330, WOB1: 4650 };
  const AF_TAU = Math.PI * 2, AF_OM = (4 * Math.PI) / 1000, AF_TH = 1.6 * Math.PI, AF_BEATS = ["afBeat0", "afBeat1", "afBeat2", "afBeat3"];
  // the 7 wedges: their place in the basket (dx from its middle, foot y, lean, length), the order they are drawn in it (the top one, 6, last), the order they tumble
  // out (6 last, so it lands on top), and where they lie in the drum before it tips (x, y in drum radii from the axle, rotation)
  const AF_SLOT = [[-19, -15, -0.62, 31], [-13, -19, -0.36, 35], [-5, -22, -0.15, 38], [8, -21, 0.2, 37], [15, -19, 0.4, 35], [20, -15, 0.64, 31], [1, -25, 0.03, 46]];
  const AF_DRAW = [0, 5, 1, 4, 2, 3, 6], AF_OUT = [0, 3, 1, 4, 2, 5, 6];
  const AF_PILE = [[-0.45, 0.6, 1.3], [-0.22, 0.7, 1.75], [0.02, 0.74, 1.45], [0.26, 0.68, 1.9], [0.46, 0.54, 1.15], [-0.12, 0.5, 1.6], [0.16, 0.48, 1.5]];
  const AF_PUFF = [[-0.4, 0.3, 0.32], [0.05, 0.45, 0.36], [0.42, 0.2, 0.3], [-0.2, -0.15, 0.34], [0.3, -0.3, 0.3], [-0.45, -0.4, 0.26], [0.02, -0.55, 0.3]];
  let afGc = null, afC = null, afIn = 0;   // afIn: 1 the Dragon, 2 the loser is being drawn into the splash (their poses there); afGc / afC: the layout and the colours, once per page
  // the layout: the drum's radius R and axle height ay, the basket's foot bx, the Dragon's feet as he hovers behind the drum (h) and behind the basket (p),
  // the loser's scale in the drum (a boss is drawn smaller by the engine), the camera before (c) and after (k) the push
  function afGeo() {
    if (afGc) return afGc;
    const port = !!(MG.lay && MG.lay.port), D = FIN.dir, R = 70, x = FIN.wx, W = W_(), Lp = L_(), lb = Lp.spec.boss ? MG_BOSS_SC : 1, sc = 1.1;
    const ay = port ? R + 112 : R + 12, bx = port ? x : x + D * (R + 82), rim = -ay - R, bk = 1.25;
    afGc = { port, R, x, ay, bx, bk, sc, lsc: Math.min(1.2, (R * 1.02) / (Lp.s.h * lb)), lb, vh: (2 * R) / 0.6,
      hx: x - D * R * 0.1, hy: rim + 0.62 * W.s.h * sc - 9, px: bx + D * (port ? 64 : 76), rim,
      cx: port ? x + D * 6 : x + D * 46, kx: port ? x + D * 30 : bx + D * 30, kz: port ? 1.2 : 1.3 };
    return afGc;
  }
  function afCols() {
    if (afC) return afC;
    const body = dgHex(L_().pal.body);
    afC = { skin: mgTintCss(mixH(body, "#b8692c", 0.5), 0.2), skinHi: mixH(mixH(body, "#b8692c", 0.5), "#fff4d6", 0.35), flesh: "#f7c45a", fleshDk: "#dc9532", fleshHi: "#fff2bf",
      red: "#e0412e", paper: "#fff8ee", inside: "#5a1d14", steel: "#cfd4dc", steelDk: "#8d95a2", hot: "#ffcf96", gap: "#2a1712" };
    return afC;
  }
  // the drum's turn (rad, as for a winner on the left) and its speed 0..1: it spins up to 2 turns a second, coasts, stops at the ding
  function afSpin(t) {
    if (t < AF.WHIRR) return [0, 0];
    const up = AF.FULL - AF.WHIRR, th1 = (AF_OM * up) / 2;
    if (t < AF.FULL) { const u = t - AF.WHIRR; return [(AF_OM * u * u) / (2 * up), u / up]; }
    if (t < AF.COAST) return [th1 + AF_OM * (t - AF.FULL), 1];
    const d = AF.STOP - AF.COAST, u = Math.min(t - AF.COAST, d);
    return [th1 + AF_OM * (AF.COAST - AF.FULL) + AF_OM * (u - (u * u) / (2 * d)), 1 - u / d];
  }
  const afTip = (t) => 0.42 * ease(fe(AF.TIP, AF.POUR, t)) * (1 - ease(fe(AF.BACK, AF.BACK + 130, t)));
  // the drum's axle (world) and its tilt: tipping, it rolls over its foot on the basket's side (so the far side lifts)
  function afDrumC(t) {
    const G = afGeo(), R = G.R, ph = afTip(t), qx = R * 0.62, qy = R * 0.8;
    return [G.x + FIN.dir * (qx - qx * Math.cos(ph) + qy * Math.sin(ph)), -G.ay + qy - qx * Math.sin(ph) - qy * Math.cos(ph), ph];
  }
  // where the hatch stops (rad from the axle, for a winner on the left): facing the basket once the drum has tipped
  const afHatch0 = () => (afGeo().port ? Math.PI / 2 - 0.42 : 0.3) - AF_TH;
  // a wedge, its middle at (x, y), leaning ang (clockwise, as for a winner on the left), len long; o: { eyes, look, ow, smile, wave } for the one with the loser's face
  function afWedge(c, x, y, ang, len, lw, o) {
    const C = afCols(), h = len / 2, bw = len * (o ? 0.5 : 0.44);
    c.save(); c.translate(x, y); c.scale(FIN.dir, 1); c.rotate(ang);
    c.lineJoin = "round"; c.lineCap = "round";
    c.beginPath(); c.moveTo(-bw * 0.5, h); c.quadraticCurveTo(-bw * 1.05, 0, -bw * 0.1, -h); c.quadraticCurveTo(bw * 0.25, -h * 1.04, bw * 0.38, -h * 0.86);
    c.quadraticCurveTo(bw * 0.64, 0, bw * 0.5, h); c.quadraticCurveTo(0, h + bw * 0.18, -bw * 0.5, h); c.closePath();
    c.fillStyle = C.flesh; c.fill();
    c.save(); c.clip();
    c.beginPath(); c.moveTo(-bw * 0.6, h + 2); c.quadraticCurveTo(-bw * 1.15, 0, -bw * 0.16, -h - 2); c.quadraticCurveTo(-bw * 0.5, 0, -bw * 0.12, h + 2); c.closePath(); c.fillStyle = C.skin; c.fill();
    c.fillStyle = C.fleshDk; c.beginPath(); c.moveTo(bw * 0.62, h + 2); c.quadraticCurveTo(bw * 0.72, 0, bw * 0.42, -h * 0.9); c.quadraticCurveTo(bw * 0.5, 0, bw * 0.3, h + 2); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = MG_INK; c.lineWidth = lw * 1.1; c.stroke();
    c.strokeStyle = C.fleshHi; c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(bw * 0.05, -h * 0.55); c.quadraticCurveTo(bw * 0.2, -h * 0.1, bw * 0.12, h * 0.35); c.stroke();
    c.fillStyle = C.fleshDk; for (const [fx, fy] of [[0.2, 0.45], [-0.05, 0.62], [0.28, -0.2]]) { c.beginPath(); c.arc(bw * fx, h * fy, lw * 0.55, 0, AF_TAU); c.fill(); }
    if (o) {   // the loser's eyes on the cut face, looking back at the Dragon, worried brows; squeezed shut and a little round mouth while it says ow
      const er = bw * 0.16, ey = -h * 0.3, patch = L_().spec.look.costume === "odin";
      c.strokeStyle = MG_INK;
      for (const sd of [-1, 1]) {
        const ex = -bw * 0.04 + sd * bw * 0.22;
        if (o.ow) { c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(ex - sd * er, ey - er * 0.8); c.lineTo(ex + sd * er * 0.8, ey); c.lineTo(ex - sd * er, ey + er * 0.8); c.stroke(); continue; }
        if (patch && sd < 0) { c.fillStyle = MG_INK; c.beginPath(); c.ellipse(ex, ey, er * 1.05, er, 0, 0, AF_TAU); c.fill(); continue; }
        c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, er * 0.9, er * 1.15, 0, 0, AF_TAU); c.fill(); c.lineWidth = lw * 0.8; c.stroke();
        c.fillStyle = MG_INK; c.beginPath(); c.arc(ex + (o.look || 0) * er * 0.35, ey + er * 0.15, er * 0.42, 0, AF_TAU); c.fill();
        c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(ex + sd * er * 1.1, ey - er * 1.5); c.lineTo(ex - sd * er * 0.5, ey - er * 2.0); c.stroke();
      }
      const my = ey + er * 2.1, mx = -bw * 0.04;
      if (o.ow) { c.fillStyle = "#5a2418"; c.beginPath(); c.ellipse(mx, my, er * 0.5, er * 0.6, 0, 0, AF_TAU); c.fill(); c.lineWidth = lw * 0.7; c.stroke(); }
      else { c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(mx - er * 0.7, my); c.quadraticCurveTo(mx, my + (o.smile ? er * 0.7 : -er * 0.25), mx + er * 0.7, my); c.stroke(); }
      if (o.wave !== undefined) {   // a tiny stick arm, waving
        const ax = -bw * 0.62, ay = -h * 0.05, a = -2.2 + 0.55 * Math.sin(o.wave), hx = ax + Math.cos(a) * len * 0.3, hy = ay + Math.sin(a) * len * 0.3;
        c.lineWidth = lw * 1.2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(hx, hy); c.stroke();
        c.fillStyle = MG_INK; c.beginPath(); c.arc(hx, hy, lw * 1.5, 0, AF_TAU); c.fill();
      }
    }
    c.restore();
  }
  // a wedge's middle and lean in the basket (bottom middle at (x, 0), scaled k)
  function afSlot(i, x, k) {
    const s = AF_SLOT[i], D = FIN.dir, h = (s[3] * k) / 2;
    return [x + D * (s[0] * k + Math.sin(s[2]) * h), s[1] * k - Math.cos(s[2]) * h, s[2], s[3] * k];
  }
  // the red-and-white paper basket, its foot's middle at (x, 0): part 0 the inside (behind the wedges), 1 the front; torn: the front ripped open (after the pop)
  function afBasket(c, x, k, lw, part, torn) {
    const C = afCols(), w0 = 28 * k, w1 = 40 * k, h = 42 * k, e = w1 * 0.2;
    c.save(); c.translate(x, 0); c.scale(FIN.dir, 1);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = MG_INK;
    if (!part) { c.beginPath(); c.ellipse(0, -h, w1, e, 0, 0, AF_TAU); c.fillStyle = C.inside; c.fill(); c.lineWidth = lw * 1.1; c.stroke(); c.restore(); return; }
    const front = () => { c.beginPath(); c.moveTo(-w1, -h); c.ellipse(0, -h, w1, e, 0, Math.PI, 0, true); c.lineTo(w0, 0); c.lineTo(-w0, 0); c.closePath(); };
    front(); c.fillStyle = C.paper; c.fill();
    c.save(); c.clip();
    c.fillStyle = C.red; c.beginPath();
    for (let i = -3; i <= 3; i++) { const a = i * 0.29, b = 0.075; c.moveTo((a - b) * w1, -h - e); c.lineTo((a + b) * w1, -h - e); c.lineTo((a + b) * w0, 1); c.lineTo((a - b) * w0, 1); c.closePath(); }
    c.fill();
    c.restore();
    afTone(c, [[w1 * 0.35, -h + e], [w1 * 1.05, -h], [w0 * 1.05, 0.5], [w0 * 0.4, 0.5]]);
    if (torn) {   // a ripped hole in the front, its paper flap hanging down
      c.beginPath(); c.moveTo(-w1 * 0.55, -h + e * 0.9);
      for (let i = 1; i <= 8; i++) { const u = i / 8, xx = lerp(-w1 * 0.55, w1 * 0.5, u), yy = -h + e * 0.9 + (i % 2 ? h * 0.12 : 0) + Math.sin(u * Math.PI) * e * 0.3; c.lineTo(xx, yy); }
      c.lineTo(w0 * 0.42, -h * 0.28); c.lineTo(w0 * 0.1, -h * 0.4); c.lineTo(-w0 * 0.2, -h * 0.22); c.lineTo(-w0 * 0.5, -h * 0.36); c.closePath();
      c.fillStyle = C.inside; c.fill(); c.lineWidth = lw; c.stroke();
      c.beginPath(); c.moveTo(-w0 * 0.2, -h * 0.22); c.lineTo(w0 * 0.25, -h * 0.3); c.lineTo(w0 * 0.05, h * 0.02 - 1); c.closePath(); c.fillStyle = C.paper; c.fill(); c.stroke();
    }
    front(); c.lineWidth = lw * 1.3; c.stroke();
    c.beginPath(); c.ellipse(0, -h, w1, e, 0, Math.PI, 0, true); c.lineWidth = lw * 3.6; c.stroke(); c.strokeStyle = C.paper; c.lineWidth = lw * 1.8; c.stroke();
    c.restore();
  }
  // dot tone over a polygon given in the current (world) transform
  function afTone(c, poly) { c.save(); c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(6, 0.4); c.fill(); c.restore(); }
  // the wedges in the basket (the ones that have landed), the top one with his face; the basket's inside before them, its front after
  function afBasketFull(c, pn, t, x, k, lw, o) {
    afBasket(c, x, k, lw, 0, false);
    for (const i of AF_DRAW) {
      if (o.land && t < AF.POUR + AF_OUT[i] * 16 + AF.FLY) continue;
      const s = afSlot(i, x, k);
      let a = s[2];
      if (i === 6 && o.rock) a += o.rock;
      afWedge(c, s[0], s[1], a, s[3], lw, i === 6 ? o.face : null);
    }
    afBasket(c, x, k, lw, 1, false);
  }
  // a wisp of steam rising off the top wedge
  function afWisp(c, x, y, len, t, a, lw) {
    if (a <= 0.02) return;
    c.save(); c.globalAlpha = a; c.strokeStyle = MG_INK; c.lineWidth = lw * 0.9; c.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      const ph = ((t * 0.02 + i * 9) % 14) * len * 0.02;
      c.beginPath(); for (let j = 0; j <= 9; j++) { const yy = y - ph - j * len * 0.07, xx = x + i * len * 0.18 + Math.sin(j * 0.8 + t * 0.007 + i) * len * 0.06; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
    }
    c.restore();
  }
  // the Dragon's feet in the splash: hovering behind the drum (bobbing on his wing beats), the swoop up over the rim and down beside the basket
  function afDragonAt(t) {
    const G = afGeo(), bob = Math.sin(t * 0.012) * 2.2;
    if (t < AF.SWOOP) return [G.hx, G.hy + bob];
    if (t >= AF.LAND) return [G.px, 0];   // (landed on the basket's far side, turned back to it)
    const u = ease(fe(AF.SWOOP, AF.LAND, t)), v = 1 - u, cx = (G.hx + G.px) / 2, cy = G.rim - (G.port ? 200 : 120);
    return [v * v * G.hx + 2 * v * u * cx + u * u * G.px, v * v * (G.hy + bob) + 2 * v * u * cy];
  }
  // his grown wings: behind the drum they are the fan's blades, spread out flat either side of it and beating (P.flap); they fold away once he has landed
  function afWings(p, t, spread) {
    if (spread < 0.05) return null;
    return (lc) => {
      const P = pose(p, mgTk(t)), len = P.w * (0.95 + 1.45 * spread), fan = spread * (1 - fe(AF.SWOOP, AF.SWOOP + 60, t)), fl = P.flap - P.wingUp * 0.9;
      const a1 = rot([-P.w * 0.3, P.cy + P.ry * 0.1], P.hip, P.lean), a2 = rot([P.w * 0.2, P.cy + P.ry * 0.05], P.hip, P.lean), b = P.flap - 0.18;
      batWing(lc, a1[0], a1[1], lerp(Math.PI + 0.18 - fl, Math.PI + 0.3 - b, fan) + P.lean, len, p.pal, true, true);
      batWing(lc, a2[0], a2[1], lerp(-0.25 + fl * 0.7, -0.3 + b, fan) + P.lean, len * 0.95, p.pal, false, false);
    };
  }
  function afAsDragon(t, fn) {
    const W = W_(), ox = W.x, oy = W.y, of = W.facing, q = afDragonAt(t); W.x = q[0]; W.y = q[1]; afIn = 1;
    if (t >= (AF.SWOOP + AF.LAND) / 2) W.facing = -FIN.dir;   // he turns round over the basket
    try { return fn(W); } finally { W.x = ox; W.y = oy; W.facing = of; afIn = 0; }
  }
  // the top wedge in the basket: its middle (the Dragon's claw goes there)
  const afTop = () => { const G = afGeo(); return afSlot(6, G.bx, G.bk); };
  // his pose in the splash: fanning behind the drum (the wings beat every 180 ms while it spins), the swoop, then hovering behind the basket: the poke, a snicker
  function afPose(P, sk, t, p) {
    const w = sk.w, leg = sk.leg, tor = sk.tor, G = afGeo(), beat = t >= AF.WHIRR && t < AF.STOP, sw = t >= AF.SWOOP && t < AF.LAND;
    P.wingUp = 1;
    P.flap = sw ? 0.45 + 0.4 * Math.sin(t * 0.05) : beat ? 0.18 + 0.244 * Math.sin(((t - AF.WHIRR) / 180) * AF_TAU) : 0.2 + 0.08 * Math.sin(t * 0.016);
    P.expr = beat ? "rage" : "grin"; P.exK = 1; P.mouth = beat ? 0.2 : t >= AF.WOB && t < AF.WOB1 ? 0.45 : 0;
    if (t < AF.SWOOP) { P.lean = 0.05; return { hF: [w * 0.7, -leg - tor * 0.3], hB: [-w * 0.7, -leg - tor * 0.3] }; }
    if (sw) { P.lean = 0.35; return { hF: [-w * 0.2, -leg - tor * 0.4], hB: [-w * 0.75, -leg - tor * 0.5], fF: [-w * 0.1, -leg * 0.4], fB: [-w * 0.4, -leg * 0.3] }; }
    const T = afTop(), sc = G.sc, f = p.facing || FIN.dir, tx = ((T[0] + FIN.dir * T[3] * 0.24 - p.x) * f) / sc, ty = (T[1] + T[3] * 0.08 - p.y) / sc;
    const k = easeOut(fe(AF.LAND, AF.POKE, t)) * (1 - ease(fe(AF.POKE + 50, AF.POKE + 170, t))), rest = [w * 0.72, -leg - tor * 0.55], mouthH = [w * 0.38, -leg - tor * 0.95];
    const back = ease(fe(AF.POKE + 120, AF.POKE + 260, t));
    P.lean = 0.1 + 0.18 * k;
    return { hF: k > 0.001 ? [lerp(rest[0], tx, k), lerp(rest[1], ty, k)] : [lerp(rest[0], mouthH[0], back), lerp(rest[1], mouthH[1], back)], hB: [-w * 0.7, -leg - tor * 0.5] };
  }
  // the loser in the drum: arms and legs out against the mesh, cheeks puffed, tumbling three turns while it spins
  function afLPose(P, sk, t, p) {
    const w = sk.w, leg = sk.leg, tor = sk.tor;
    P.expr = "terror"; P.exK = 1; P.mouth = 0; P.lean = 0;
    P.spin = FIN.dir * (p.facing || -FIN.dir) * 3 * AF_TAU * ease(fe(AF.WHIRR + 60, AF.STOP - 20, t));   // (turning the same way as the drum, whichever way he faces)
    return { hF: [w * 1.0, -leg - tor * 0.95], hB: [-w * 1.0, -leg - tor * 0.9], fF: [w * 0.5, -leg * 0.05], fB: [-w * 0.5, -leg * 0.05] };
  }
  // his puffed cheeks, on his face wherever the tumble has turned it (the puppet's own frame: feet, facing, spin, lean)
  function afCheeks(c, pn, p, t, s) {
    if (p.spec.look.build !== "potato" || p.spec.boss) return;
    MG.pt = t;
    const P = pose(p, mgTk(t)), w = P.w, er = w * 0.1, hx = P.head[0], hy = P.head[1];
    c.save(); pn.world(c); c.translate(p.x, p.y); c.scale(p.facing * s, s);
    if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
    c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    c.fillStyle = "#ffb3a0"; c.strokeStyle = MG_INK; c.lineWidth = Math.max(0.8, 2.4 / (pn.z * s)); c.lineCap = "round";
    for (const dx of [-0.3, 0.29]) { c.beginPath(); c.arc(hx + dx * w, hy + er * 2.0, er * 1.4, 0, AF_TAU); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(hx - er * 0.55, hy + er * 2.5); c.quadraticCurveTo(hx, hy + er * 2.1, hx + er * 0.55, hy + er * 2.5); c.stroke();
    c.restore();
  }
  function afLoser(c, pn, t, C) {
    const Lp = L_(), G = afGeo(), sv = [Lp.x, Lp.y, Lp.state, Lp.facing, Lp.flash], sp = afSpin(t), a = FIN.dir * (sp[0] + 0.7), ro = G.R * 0.1 * sp[1];
    Lp.x = C[0] + Math.cos(a) * ro; Lp.y = C[1] + Math.sin(a) * ro + Lp.s.h * 0.5 * G.lsc * G.lb; Lp.state = "fin"; Lp.facing = -FIN.dir; Lp.flash = 0; afIn = 2;
    try { mgPuppet(c, pn, Lp, t, { sc: G.lsc, light: dirAng(-1.2), tint: 0.4 }); afCheeks(c, pn, Lp, t, G.lsc * G.lb); }
    finally { Lp.x = sv[0]; Lp.y = sv[1]; Lp.state = sv[2]; Lp.facing = sv[3]; Lp.flash = sv[4]; afIn = 0; }
  }
  // the stand: two steel legs from the axle (where the drum rests) to the ground, a foot bar
  function afStand(c, G, lw) {
    const C = afCols(), y0 = -G.ay, sp = G.R * 0.72;
    c.save(); c.translate(G.x, 0); c.lineJoin = "round"; c.strokeStyle = MG_INK;
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 6, y0); c.lineTo(sd * 13, y0); c.lineTo(sd * (sp + 4), 0); c.lineTo(sd * (sp - 5), 0); c.closePath(); c.fillStyle = C.steelDk; c.fill(); c.lineWidth = lw * 1.1; c.stroke(); }
    if (G.port) { c.beginPath(); c.rect(-sp * 0.62, y0 * 0.45 - 3, sp * 1.24, 6); c.fillStyle = C.steel; c.fill(); c.lineWidth = lw; c.stroke(); }
    c.beginPath(); c.rect(-sp - 10, -5, (sp + 10) * 2, 5); c.fillStyle = C.steel; c.fill(); c.lineWidth = lw * 1.1; c.stroke();
    c.restore();
  }
  // the drum, its axle at C (world), seen end-on: the warm inside, then (front) the mesh, the steam of the ding, the rim with its bolts and the hatch
  function afDrumBack(c, C, R, t) {
    const K = afCols(), heat = fe(AF.WHIRR, AF.FULL, t) * (1 - 0.6 * fe(AF.DING, 4300, t));
    c.save(); c.translate(C[0], C[1]);
    c.beginPath(); c.arc(0, 0, R * 0.92, 0, AF_TAU); c.fillStyle = heat > 0.01 ? mixH(MG_PAPER, K.hot, heat) : MG_PAPER; c.fill();
    c.beginPath(); c.arc(0, 0, R * 0.92, 0, AF_TAU); c.arc(0, 0, R * 0.62, 0, AF_TAU, true);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(7, 0.22 + 0.12 * heat); c.fill("evenodd");
    c.restore();
  }
  function afDrumFront(c, C, R, t, lw) {
    const K = afCols(), D = FIN.dir, ang = afSpin(t)[0] + C[2], open = fe(AF.TIP + 15, AF.POUR, t) * (1 - fe(AF.BACK, AF.BACK + 110, t)), h0 = afHatch0() + ang;
    c.save(); c.translate(C[0], C[1]); c.scale(D, 1); c.lineJoin = "round"; c.lineCap = "round";
    // the mesh: a diamond grid of wire turning with the drum, over what is inside
    c.save(); c.beginPath(); c.arc(0, 0, R * 0.92, 0, AF_TAU); c.clip();
    // the ding's steam: puffs fill the drum and clear (the loser has become wedges under it)
    const sg = easeOut(fe(AF.DING - 5, AF.SWAP - 5, t)), st = 1 - fe(AF.SWAP + 10, AF.POUR + 40, t);
    if (sg > 0.02 && st > 0.02) {
      c.globalAlpha = st;
      for (let pass = 0; pass < 2; pass++) {
        c.beginPath();
        for (const [px, py, pr] of AF_PUFF) { const r = R * pr * (0.55 + 0.45 * sg) * (1 + 0.25 * (1 - st)) + (pass ? 0 : lw * 1.1); c.moveTo(px * R + r, py * R - (1 - st) * R * 0.2); c.arc(px * R, py * R - (1 - st) * R * 0.2, r, 0, AF_TAU); }
        c.fillStyle = pass ? "#ffffff" : MG_INK; c.fill();
      }
      c.globalAlpha = 1;
    }
    c.rotate(ang + Math.PI / 4); c.strokeStyle = MG_INK; c.globalAlpha = 0.6; c.lineWidth = lw * 0.6; c.beginPath();
    for (let i = -4; i <= 4; i++) { const q = i * R * 0.22; c.moveTo(q, -R); c.lineTo(q, R); c.moveTo(-R, q); c.lineTo(R, q); }
    c.stroke(); c.globalAlpha = 1;
    c.restore();
    // the rim: a steel band, its bolts and the hatch turning with it
    c.beginPath(); c.arc(0, 0, R, 0, AF_TAU); c.arc(0, 0, R * 0.9, 0, AF_TAU, true); c.fillStyle = K.steel; c.fill("evenodd");
    c.save(); c.beginPath(); c.arc(0, 0, R, -0.2, 2.6); c.arc(0, 0, R * 0.9, 2.6, -0.2, true); c.closePath(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(5, 0.4); c.fill(); c.restore();
    c.strokeStyle = MG_INK; c.lineWidth = lw * 1.6; c.beginPath(); c.arc(0, 0, R, 0, AF_TAU); c.stroke();
    c.lineWidth = lw; c.beginPath(); c.arc(0, 0, R * 0.9, 0, AF_TAU); c.stroke();
    c.fillStyle = MG_INK; for (let i = 0; i < 8; i++) { const a = ang + (i + 0.5) * (AF_TAU / 8); if (Math.abs(((a - h0) % AF_TAU + AF_TAU + Math.PI) % AF_TAU - Math.PI) < 0.45) continue; c.beginPath(); c.arc(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, R * 0.026, 0, AF_TAU); c.fill(); }
    const ha = 0.3;
    if (open > 0.02) {   // open: a dark gap in the rim, the hatch swung out on its hinge
      c.beginPath(); c.arc(0, 0, R * 1.005, h0 - ha, h0 + ha); c.arc(0, 0, R * 0.88, h0 + ha, h0 - ha, true); c.closePath(); c.fillStyle = K.gap; c.fill(); c.lineWidth = lw; c.stroke();
      c.save(); c.translate(Math.cos(h0 + ha) * R * 0.95, Math.sin(h0 + ha) * R * 0.95); c.rotate(open * 1.3);   // the hatch, on its hinge at the far end of the gap
      c.translate(-Math.cos(h0 + ha) * R * 0.95, -Math.sin(h0 + ha) * R * 0.95);
      c.beginPath(); c.arc(0, 0, R * 1.005, h0 - ha, h0 + ha); c.arc(0, 0, R * 0.88, h0 + ha, h0 - ha, true); c.closePath(); c.fillStyle = K.steelDk; c.fill(); c.lineWidth = lw; c.strokeStyle = MG_INK; c.stroke();
      c.restore();
    } else {   // shut: a darker plate on the rim with a latch
      c.beginPath(); c.arc(0, 0, R * 1.005, h0 - ha, h0 + ha); c.arc(0, 0, R * 0.88, h0 + ha, h0 - ha, true); c.closePath(); c.fillStyle = K.steelDk; c.fill(); c.lineWidth = lw; c.stroke();
      c.save(); c.rotate(h0); c.fillStyle = K.steel; c.beginPath(); c.rect(R * 0.96, -R * 0.06, R * 0.1, R * 0.12); c.fill(); c.stroke(); c.restore();
    }
    // the axle's cap
    c.beginPath(); c.arc(0, 0, R * 0.07, 0, AF_TAU); c.fillStyle = K.steel; c.fill(); c.lineWidth = lw; c.stroke();
    c.restore();
  }
  // 8 speed arcs round the drum while it spins, and the gust rings the wings blow into it (one per beat from each side)
  function afWhoosh(c, C, R, t, lw) {
    const sp = afSpin(t), D = FIN.dir;
    c.save(); c.translate(C[0], C[1]); c.scale(D, 1); c.strokeStyle = MG_INK; c.lineCap = "round";
    if (sp[1] > 0.03 && t < AF.STOP) {
      c.globalAlpha = Math.min(1, sp[1] * 1.3);
      for (let i = 0; i < 8; i++) { const a = sp[0] * 0.8 + (i * AF_TAU) / 8, r = R * (1.1 + 0.06 * (i % 3)); c.lineWidth = lw * (1.7 - 0.5 * (i % 2)); c.beginPath(); c.arc(0, 0, r, a, a + 0.32 + 0.3 * sp[1]); c.stroke(); }
    }
    for (let n = 0; n < 4; n++) {
      const u = (t - (AF.WHIRR + n * 180)) / 320;
      if (u <= 0 || u >= 1) continue;
      for (const sd of [-1, 1]) {
        const k = easeOut(u), x = lerp(sd * R * 1.28, sd * R * 0.62, k), y = lerp(-R * 0.82, -R * 0.3, k), r = R * (0.07 + 0.17 * u), rot = Math.atan2(R * 0.52, -sd * R * 0.66) + Math.PI / 2;
        c.globalAlpha = 1 - u; c.save(); c.translate(x, y); c.rotate(rot);
        c.beginPath(); c.ellipse(0, 0, r, r * 0.36, 0, 0, AF_TAU); c.lineWidth = lw * 1.8; c.strokeStyle = MG_INK; c.stroke(); c.lineWidth = lw * 0.7; c.strokeStyle = "#ffffff"; c.stroke();
        c.restore();
      }
    }
    c.restore();
  }
  // a wedge on its way: from where it lay in the drum (as the drum tips) along a little arc to its place in the basket, turning as it goes
  function afPileAt(i, t, C) {
    const G = afGeo(), R = G.R, s = AF_PILE[i], tip = afTip(t) / 0.42;
    return [C[0] + FIN.dir * (s[0] + 0.22 * tip) * R, C[1] + s[1] * R * 0.9 - 0.06 * tip * R, s[2] + 0.4 * tip];
  }
  function afDrawSplash(c, pn, t) {
    const G = afGeo(), D = FIN.dir, R = G.R, lw = jpLw(pn), C = afDrumC(t);
    pn.screen(c);
    // behind: the Dragon's dot disc and focus lines round the drum
    const q = pn.p(G.x, -G.ay);
    mgToneFill(c, discPoly(q[0], q[1], Math.min(pn.w, pn.h) * 0.64, 40), 10, 0.22, [t * 0.001, -t * 0.001]);
    c.beginPath(); c.arc(q[0], q[1], Math.min(pn.w, pn.h) * 0.47, 0, AF_TAU); c.fillStyle = MG_PAPER; c.fill();
    mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.45);
    ground(c, pn, t);
    pn.world(c);
    afStand(c, G, lw);
    // the Dragon behind the drum (his wings either side are the fan), in front of it once he has swooped up over the rim
    const fd = afDragonAt(t), front = t >= AF.SWOOP && (fd[1] < G.rim || t >= (AF.SWOOP + AF.LAND) / 2);
    const drawW = () => afAsDragon(t, (W) => mgPuppet(c, pn, W, t, { sc: G.sc, light: dirAng(-0.6), under: afWings(W, t, 1 - ease(fe(AF.LAND - 70, AF.LAND + 30, t))), box: WBOX }));
    if (!front) drawW();
    pn.world(c);
    afDrumBack(c, C, R, t);
    // inside: the loser until the steam of the ding hides him, then the wedges that haven't tumbled out yet
    if (t < AF.SWAP) afLoser(c, pn, t, C);
    else {
      pn.world(c); c.save(); c.beginPath(); c.arc(C[0], C[1], R * 0.92, 0, AF_TAU); c.clip();
      for (let i = 0; i < 7; i++) { if (t >= AF.POUR + AF_OUT[i] * 16) continue; const p = afPileAt(i, t, C); afWedge(c, p[0], p[1], p[2], AF_SLOT[i][3], lw, i === 6 ? { look: -1 } : null); }
      c.restore();
    }
    pn.world(c);
    afDrumFront(c, C, R, t, lw);
    afWhoosh(c, C, R, t, lw);
    // steam escaping over the rim at the ding
    const se = easeOut(fe(AF.DING, AF.DING + 70, t)), sa = 1 - fe(AF.DING + 90, AF.POUR + 60, t);
    if (se > 0.02 && sa > 0.02) {
      const u = fe(AF.DING, AF.POUR + 60, t);
      c.globalAlpha = sa;
      for (let pass = 0; pass < 2; pass++) {
        c.beginPath();
        for (let i = 0; i < 6; i++) { const px = C[0] + D * (i - 2.5) * R * 0.2, py = C[1] - R * (0.92 + 0.3 * u + 0.1 * (i % 2)), r = R * (0.13 + 0.05 * (i % 3)) * se * (1 + 0.4 * u) + (pass ? 0 : lw * 1.1); c.moveTo(px + r, py); c.arc(px, py, r, 0, AF_TAU); }
        c.fillStyle = pass ? "#ffffff" : MG_INK; c.fill();
      }
      c.globalAlpha = 1;
    }
    // the basket and the wedges that have landed in it, the top one rocking from the poke; then the ones in the air
    const rock = t >= AF.WOB && t < AF.WOB1 ? 0.052 * Math.sin(((t - AF.WOB) / 160) * AF_TAU) * (1 - 0.4 * fe(AF.WOB, AF.WOB1, t)) : 0;
    const ow = t >= AF.WOB && t < AF.WOB + 240, T6 = afSlot(6, G.bx, G.bk);
    afBasketFull(c, pn, t, G.bx, G.bk, lw, { land: true, rock, face: { look: t < AF.SWOOP ? -0.6 : 1, ow, smile: false } });
    for (let i = 0; i < 7; i++) {
      const t0 = AF.POUR + AF_OUT[i] * 16, u = (t - t0) / AF.FLY;
      if (u < 0 || u >= 1) continue;
      const a = afPileAt(i, t0, afDrumC(t0)), b = afSlot(i, G.bx, G.bk), k = ease(u), hop = (G.port ? 10 : 22) * 4 * u * (1 - u);
      afWedge(c, lerp(a[0], b[0], k), lerp(a[1], b[1], k) - hop, lerp(a[2], b[2], k), AF_SLOT[i][3] * lerp(1, G.bk, k), lw, i === 6 ? { look: 0 } : null);
    }
    if (front) drawW();
    pn.world(c);
    if (t >= AF.POUR + 6 * 16 + AF.FLY) afWisp(c, T6[0] + D * 3, T6[1] - T6[3] * 0.55, 34, t, fe(AF.POUR + 6 * 16 + AF.FLY, 4250, t) * 0.85, lw);
  }
  function afCam(t, pn) {
    const G = afGeo(), push = MG.reduced ? 0 : ease(fe(AF.BACK, AF.LAND + 90, t)), z = 1 + (G.kz - 1) * push, v = (G.port ? (G.vh * 0.84 * pn.h) / pn.w : G.vh) / z;
    return { wx: lerp(G.cx, G.kx, push), wy: (G.port ? 26 : 12) - v / 2, vh: v };
  }
  const afShake = (t) => { const a = 2.5 * fe(AF.COAST, AF.STOP, t) * (1 - fe(AF.STOP + 20, AF.STOP + 160, t)) + 3 * fe(AF.TIP, AF.TIP + 20, t) * (1 - fe(AF.TIP + 40, AF.TIP + 200, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; };
  // panel 4: Inferno's aftermath with the basket beside him: the top wedge rocking (0.5 Hz) and waving; once he has popped out, the basket torn open,
  // two wedges on the ground, a curl of steam
  const afFx = () => FIN.wx + FIN.dir * 60;
  function afDrawAfter(c, pn, t) {
    drawAfter(c, pn, t);
    const D = FIN.dir, x = afFx(), lw = jpLw(pn), k = 0.7, popped = mgPopped(t);
    pn.world(c);
    if (!popped) {
      const u = (t - MT.AFTER) / 1000;
      afBasketFull(c, pn, t, x, k, lw, { land: false, rock: 0.13 * Math.sin(u * Math.PI), face: { look: -0.6, ow: false, smile: true, wave: u * 15 } });
      const T6 = afSlot(6, x, k) ; afWisp(c, T6[0] + D * 2, T6[1] - T6[3] * 0.55, 22, t, 0.75, lw);
      return;
    }
    afBasket(c, x, k, lw, 0, true);
    for (const i of [0, 5]) { const s = afSlot(i, x, k); afWedge(c, s[0], s[1], s[2], s[3], lw, null); }
    afBasket(c, x, k, lw, 1, true);
    afWedge(c, x - D * 30, -3.5, -1.45, 18, lw, null);
    afWedge(c, x + D * 13, -3.5, 1.5, 17, lw, null);
    afWisp(c, x - D * 2, -30, 20, t, 0.6, lw);
  }

  S_.alt2 = Object.assign({}, S_, {
    name: "Air Fryer",
    start(g) { S_.start(g); pota2 = true; afGc = null; afC = null; afIn = 0; },
    end() { pota2 = false; afGc = null; afC = null; afIn = 0; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after"), D = FIN.dir;
      strike.freeze = strike.cover = MT.SPLASH;   // the splash covers the whole page from here: the strike is drawn once more, then a bitmap
      after.draw = afDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 124 : 100) * (1 - 0.05 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + D * (lay.port ? 40 : 44), wy: -0.43 * vh, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "b", paper: MG_PAPER, slide: MG.reduced ? 1 : 180, cam: afCam, shake: afShake, draw: afDrawSplash }));
      return ps;
    },
    words(lay) {
      const D = FIN.dir, k0 = lay.port ? Math.min(1, (L.gw * 0.9) / L.gh) : 1, small = lay.port ? 0.62 : 1;
      // the engine's own upright scaling of Inferno's words, done here because the new words set their own
      const ws = S_.words(lay).map((w) => Object.assign({}, w, { mul: (w.mul || 1) * k0 }));
      ws[3].t1 = ws[4].t1 = MT.SPLASH + 150;   // BWOOOM and FWOOOSH are gone as the splash comes up
      const big = lay.port ? Math.min(0.5, (0.86 * L.gw) / (6 * 0.15 * L.gh * 0.62)) : 1;
      const sp = (t, w) => { const pn = MG.byId.splash; mgPlace(pn, t); return pn.sp(w[0], w[1]); };
      ws.push(
        { text: "WHIRRR", t0: AF.WHIRR, t1: AF.DING + 40, size: 0.15, mul: big, arc: 1.6, jag: 0.06, rot: 0.55 * D,
          at: (t) => { const G = afGeo(); return sp(t, [G.x + D * G.R * 0.92, -G.ay - G.R * 0.8]); } },
        { text: "ding!", t0: AF.DING, t1: AF.TIP + 260, size: 0.07, mul: small, jit: 0.12, rot: 0.12 * D,
          at: (t) => { const G = afGeo(); return sp(t, [G.x + D * G.R * 0.95, -G.ay - G.R * 0.95]); } },
        { text: "ow!", t0: AF.WOB, t1: AF.WOB1 + 40, size: 0.07, mul: small, jag: 0.12, rot: -0.14 * D,
          at: (t) => { const T = afTop(); return sp(t, [T[0] - D * T[3] * 0.75, T[1] - T[3] * 0.55]); } },
      );
      return ws;
    },
    pose(P, sk, t, role, p) {
      if (afIn === 1 && role === "w") return afPose(P, sk, t, p);
      if (afIn === 2 && role === "l") return afLPose(P, sk, t, p);
      return S_.pose(P, sk, t, role, p);
    },
    food() { const x = afFx(); return { x, y: 0, r: 22, y0: -26, lx: x + FIN.dir * 40 }; },
    cues(t) {
      S_.cues(t);
      const D = FIN.dir;
      cueOnce("afUp", MT.SPLASH + 40, () => Cin.go(() => Cin.page()));
      cueOnce("afWhirr", AF.WHIRR, () => Cin.go(() => { Cin._osc("sawtooth", 70, 260, 0.6, 0.05, 0.25); Cin._noise(0.62, 0.12, 500, 2400, "bandpass", 1.4); }));
      for (let i = 0; i < 4; i++) cueOnce(AF_BEATS[i], AF.WHIRR + i * 180, () => Cin.go(() => Cin.whoosh(0.12, -0.5 * D, 0.5 * D, 0.16)));
      cueOnce("afDing", AF.DING, () => Cin.go(() => { Cin.chime(2093); Cin._osc("triangle", 4186, 4186, 0.4, 0.03, 0.002); }));
      cueOnce("afSteam", AF.DING + 20, () => Cin.go(() => Cin._noise(0.4, 0.12, 2600, 5200, "highpass", 0.8)));
      cueOnce("afTip", AF.TIP, () => Cin.go(() => Cin.clack()));
      cueOnce("afPour", AF.POUR + AF.FLY - 10, () => Cin.go(() => { for (let i = 0; i < 7; i++) Cin._osc("triangle", 520 - i * 25, 260, 0.06, 0.07, 0.002, i * 0.016); }));
      cueOnce("afSwoop", AF.SWOOP, () => Cin.go(() => Cin.whoosh(0.22, -0.7 * D, 0.7 * D, 0.4)));
      cueOnce("afPoke", AF.POKE, () => Cin.go(() => Cin.tick(1800)));
      cueOnce("afOw", AF.WOB, () => Cin.go(() => { Cin._osc("triangle", 880, 520, 0.16, 0.06, 0.004); Cin._osc("sine", 300, 420, 0.3, 0.04, 0.01, 0.02); }));
      cueOnce("afSizzle", MT.AFTER + 140, () => Cin.go(() => Cin._noise(0.6, 0.05, 3000, 5200, "highpass", 0.8)));
    },
  });
  return S_;
})();
