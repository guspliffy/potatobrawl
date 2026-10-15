/* ===================== Manga page: Alchemist, "The Experiment" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Alchemist, The Experiment"). Times are ms after the final hit.
   300 the freeze (panel 1, engine; the rain starts at 900) . 1250 panel 2 "the look": a flask far too big, the liquid rises, three lightning bolts
   (each one a one-frame inversion of that panel) . 2000 inset on the loser (dazed, green drips; at 2200 the face snaps to terror)
   2350 panel 3 "the strike": the throw (2480), the smash on the head (2650), the loser inflates, the drop (2780), 2900 POP, the loser
   flies out along the real launch direction trailing bubbles . 3500 panel 4: the smoke clears, a tiny spoon, a taste, "mmm".
   ULTIMATE: "Mutation" = MANGA.alchemist.ulti (S_.ulti, at the end; design: ultimates/manga/alchemist/fable-design.md), played when the KO is the Mutagen Cloud's
   last pulse, on the long timeline MT_U. The page retells the loser's 2.5 s in the cloud at the cloud's own beat (pulses 1400, 1900, 2400, the hit 2900): the freeze
   with the burst's afterglow . 1250 the look: he turns the empty flask over, a last drop falls, the cloud swells behind him . 2000 the inset: dazed, and a third eye
   opens on the loser's forehead and looks at the reader . 2350 the strike: the loser in the cloud; 2410-2745 seven more eyes pop open all over the body, each on its
   own blink, while the cloud charges pale gold and the loser swells . 2780 the drop: every eye turns to the reader, 2800 they all blink once together . 2900 the
   fifth pulse (three impact frames, the eyes gold in the gold one), KABWUMP, 3050 the loser flies out with the eyes still open . 3250 the SPLASH: one huge cloud
   with 24 eyes opening across it, out of step, finding the reader (3900), then their maker (4300), who stands in colour in front of it with the empty flask raised;
   MUTATION at 3600 . 4700 the spoon aftermath (its moments are MT.AFTER + offset, so it serves both pages), the puddle has an eye . then the results get splattered:
   one canvas over #app for 6 s (the results screen's markup and CSS are not touched). Both pages share their code: `ult` (set by start) says which one plays.
   Script fields: col, name, hit, flight, panels(lay), words(lay), build(lay), step(t, k), pose(P, sk, t, role, p), after(t), over(o, t), cues(t),
   drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt(), end(). Everything here is private to this file. */
MANGA.alchemist = (function () {
  const COL = "#7dff62", COL_D = "#2f9a2a", PAPER = MG_PAPER, INK = MG_INK, GLASS = "#fffdf4", TAU = Math.PI * 2, PALE_G = "#eaffdc";
  const T_WIND = 2350, T_COCK = 2440, T_REL = 2480, T_SMASH = 2650, T_INF = 2850, T_DROP = 2780;   // the throw: wind-up, cocked, released, the smash, the balloon is full, the drop
  // Mutation: the cloud's beat retold (the fifth pulse is the hit), the swell, the moment every eye turns to the reader and their one blink together, the splash's looks
  const U_PULSE = [1400, 1900, 2400], U_SW0 = 2500, U_SW1 = 2850, U_LOOK = 2780, U_BLINK = 2800, U_READER = 3900, U_MAKER = 4300, U_TIP = 2.9, FSU = 2.2, DROP0 = 1500, DROP1 = 1700;
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  const mxu = (x) => (FIN.dir > 0 ? x : 1 - x);   // a share of the page measured from the winner's side
  const A = () => MT.AFTER;   // the aftermath: 3500 on The Experiment, 4700 on Mutation
  let ult = false;   // this play is the Ultimate page (set by start)
  let rainT = null, bolts = [], shards = [], drips = [], blots = [], bub = [];
  let lobes = [], cbub = [], eyesB = [], eyesS = [], outB = [];

  // eased blend through [[ms, value], ...]; a value is a number or an [x, y]
  const seg = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i], k = ease(fe(a[0], b[0], t));
        return Array.isArray(a[1]) ? [lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k)] : lerp(a[1], b[1], k);
      }
    }
    return keys[keys.length - 1][1];
  };
  // where things are on a puppet (world units), from its own pose; the body points turn with the lean, the hands do not
  function bodyPt(p, t, sc, key) {
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot(P[key], P.hip, P.lean);
    return [p.x + p.facing * q[0] * sc, p.y + q[1] * sc];
  }
  function handW(t) { MG.pt = t; const p = W_(), P = pose(p, mgTk(t)); return [p.x + p.facing * P.hF[0], p.y + P.hF[1]]; }
  const headL = (t) => bodyPt(L_(), t, inflate(t), "head");
  // the loser swells from the smash to the pop: 1 -> 1.5 with a wobble, back to 1 at the pop (Mutation: 1 -> 1.22 in the cloud's charge)
  const inflate = (t) => {
    if (ult) { if (t < U_SW0 || t >= FIN.hit) return 1; const k = fe(U_SW0, U_SW1, t); return 1 + 0.22 * ease(k) + 0.03 * Math.sin(t * 0.05) * k; }
    return t < T_SMASH || t >= FIN.hit ? 1 : 1 + 0.65 * ease(fe(T_SMASH, T_INF, t)) + 0.04 * Math.sin(t * 0.05) * fe(T_SMASH, T_INF, t);
  };
  // a pulse of the cloud at any of the times in `at`: up in 60 ms, back in 200
  const pulseAt = (t, at) => at.reduce((m, p) => Math.max(m, t < p || t > p + 260 ? 0 : t < p + 60 ? fe(p, p + 60, t) : 1 - fe(p + 60, p + 260, t)), 0);

  /* ---------- small shapes ---------- */
  // a dot screen (hard dots, upright whatever the transform) poured into the shape pathFn traces under the caller's transform (pn null: the whole canvas)
  function dots(c, pn, pathFn, size, cover, colr) {
    c.save(); c.beginPath(); pathFn(); c.clip();
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(size, cover, colr);
    if (pn) c.fillRect((pn.x0 + pn.ox - 6) * DPR, (pn.y0 + pn.oy - 6) * DPR, (pn.w + 12) * DPR, (pn.h + 12) * DPR);
    else c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.restore();
  }
  // a sweat drop: tip up, white (or `fill`), inked; (x, y) is the middle of the round part
  function sweatDrop(c, x, y, r, ang, lw, fill) {
    c.save(); c.translate(x, y); c.rotate(ang || 0);
    c.beginPath(); c.moveTo(0, -r * 2.3); c.quadraticCurveTo(r * 0.9, -r * 0.9, r, 0); c.arc(0, 0, r, 0, Math.PI, false); c.quadraticCurveTo(-r * 0.9, -r * 0.9, 0, -r * 2.3); c.closePath();
    c.fillStyle = fill || "#fff"; c.fill(); c.lineWidth = lw; c.lineJoin = "round"; c.strokeStyle = INK; c.stroke(); c.restore();
  }
  // a bubble of the toxin: accent, inked, one glint
  function bubble(c, x, y, r, lw, fill) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill || COL; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.5, Math.PI * 1.08, Math.PI * 1.62); c.lineWidth = Math.max(lw * 0.55, r * 0.16); c.lineCap = "round"; c.strokeStyle = "#fff"; c.stroke();
  }
  const star = (c, x, y, s) => { star4(c, x, y, s * 1.4, INK); star4(c, x, y, s, "#ffffff"); };

  /* ---------- storm clouds along the top edge of a panel (scalloped, outlined, a hard dot screen) ---------- */
  function clouds(c, pn, t, hh, seed, cover) {
    const r = mgRng(seed), n = Math.max(5, Math.round(pn.w / (hh * 0.7))), sway = Math.sin(t * 0.0005 + seed) * 5, cs = [];
    for (let i = 0; i <= n; i++) cs.push([pn.x0 + (i / n) * pn.w + (r() - 0.5) * hh * 0.25 + sway, pn.y0 + hh * (0.05 + r() * 0.25), hh * (0.42 + r() * 0.3)]);
    const path = () => { for (const [x, y, rr] of cs) { c.moveTo(x + rr, y); c.arc(x, y, rr, 0, TAU); } };
    c.beginPath(); path(); c.lineWidth = Math.max(6, hh * 0.1); c.lineJoin = "round"; c.strokeStyle = INK; c.stroke();
    c.fillStyle = PAPER; c.fill();
    dots(c, pn, path, 7, cover, INK);
  }
  // a lightning bolt across a panel: ink-edged, white core, a fork and a white burst where it lands (age 0..150 ms, a flicker in the middle)
  function bolt(c, pn, b, t) {
    const a = t - b.t0;
    if (a < 0 || a > 150 || (a > 62 && a < 90)) return;
    const P = b.pts.map(([fx, fy]) => [pn.x0 + fx * pn.w, pn.y0 + fy * pn.h]), F = b.fork.map(([fx, fy]) => [pn.x0 + fx * pn.w, pn.y0 + fy * pn.h]);
    c.lineJoin = "miter"; c.miterLimit = 3; c.lineCap = "butt";
    for (const [colr, wd] of [[INK, pn.h * 0.034], ["#ffffff", pn.h * 0.014]]) {
      c.strokeStyle = colr; c.lineWidth = wd;
      c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.lineWidth = wd * 0.7; c.beginPath(); F.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
    const e = P[P.length - 1]; mgStarburst(c, e[0], e[1], pn.h * 0.075 * (1 - a / 260), 0.3);
  }

  /* ---------- the flask: far too big, ink outline, liquid in the accent with dot-screen shading and bubbles rising ---------- */
  function flaskPath(c) { c.beginPath(); c.moveTo(-2.8, -14); c.lineTo(-2.8, -8.55); c.arc(0, 0, 9, 4.3947, -1.2531, true); c.lineTo(2.8, -14); c.closePath(); }
  // o: { x, y (the middle of the belly, world), s, rot, level 0..1, t, ink (px), slosh, empty (no liquid, no bubbles: Mutation's flask) }
  function flask(c, pn, o) {
    const s = o.s, lw = o.ink / (pn.z * s), t = o.t, yl = 9 - o.level * 22, amp = 0.35 + (o.slosh || 0);
    c.save(); pn.world(c); c.translate(o.x, o.y); c.rotate(o.rot); c.scale(s, s);
    c.lineJoin = "round"; c.lineCap = "round";
    flaskPath(c); c.fillStyle = GLASS; c.fill();
    c.save(); flaskPath(c); c.clip();
    if (!o.empty) {
      c.beginPath(); c.moveTo(-12, 12); for (let x = -12; x <= 12.01; x += 2) c.lineTo(x, yl + Math.sin(x * 0.7 + t * 0.012) * amp); c.lineTo(12, 12); c.closePath();
      c.fillStyle = COL; c.fill();
    }
    dots(c, pn, () => { c.arc(0, 0, 10.5, 0, TAU); c.arc(-3.6, -3.6, 8.2, 0, TAU, true); }, 6, 0.34, INK);   // the shaded crescent
    if (!o.empty) {
      for (const b of bub) {   // bubbles rise from the bottom to the surface
        const f = (t * 0.00042 * b.sp + b.ph) % 1, y = lerp(8, yl + 1, f), x = b.x + Math.sin(t * 0.004 + b.ph * 9) * 0.9, r = b.r * (0.55 + 0.7 * f);
        if (y < yl + 0.4) continue;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = "#f4ffee"; c.fill(); c.lineWidth = lw * 0.5; c.strokeStyle = INK; c.stroke();
      }
      c.beginPath(); for (let x = -12; x <= 12.01; x += 2) { const y = yl + Math.sin(x * 0.7 + t * 0.012) * amp; x === -12 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
    }
    c.restore();
    flaskPath(c); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, 0, 6.6, 2.5, 3.5); c.lineWidth = lw * 0.9; c.strokeStyle = "#ffffff"; c.stroke();
    c.beginPath(); c.arc(0, 0, 6.6, 3.72, 3.9); c.stroke();
    c.fillStyle = GLASS; c.lineWidth = lw * 0.9; c.beginPath(); c.rect(-3.8, -15.6, 7.6, 1.7); c.fill(); c.stroke();
    if (!o.empty) {   // the cork (an empty flask has none: Mutation turns it over)
      c.fillStyle = INK; c.beginPath(); c.moveTo(-3.1, -15.6); c.lineTo(3.1, -15.6); c.lineTo(2.6, -20.4); c.lineTo(-2.6, -20.4); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-1.4, -19.2); c.lineTo(-1.1, -16.6); c.lineWidth = lw * 0.7; c.strokeStyle = "#ffffff"; c.stroke();
    }
    // a skull-and-bones label on the belly
    if (!o.noLabel) {
      c.save(); c.translate(0.6, 3.2); c.beginPath(); c.roundRect(-4.2, -3.2, 8.4, 6.6, 1.3); c.fillStyle = GLASS; c.fill(); c.lineWidth = lw * 0.75; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(0, -0.7, 1.7, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(-2.6, 1.6); c.lineTo(2.6, 3); c.moveTo(2.6, 1.6); c.lineTo(-2.6, 3); c.lineWidth = lw * 1.1; c.stroke();
      c.restore();
    }
    c.restore();
  }
  // the flask from the hold, through the throw, to the smash: { x, y, rot, level, slosh } in world units, null once it has burst
  // (Mutation: no throw; the empty flask is turned mouth-down 1250-1500 over the cloud and held there)
  const HOLD = [8, -8], FS = 3.2, FS3 = 2.6;   // the flask in panel 2 (close) and in the throw (wide)
  function inHand(t) {
    const D = FIN.dir, h = handW(t), a = D * (ult ? seg(t, [[0, 0.03], [1250, 0.03], [DROP0, U_TIP]]) : seg(t, [[0, 0.03], [T_WIND, 0.03], [T_COCK, -0.9], [T_REL, 0.2]])) + (t < T_WIND ? D * 0.04 * Math.sin(t * 0.004) : 0);
    const ox = D * HOLD[0], oy = HOLD[1], cs = Math.cos(a), sn = Math.sin(a);
    return { x: h[0] + ox * cs - oy * sn, y: h[1] + ox * sn + oy * cs, rot: a };
  }
  const level = (t) => 0.2 + 0.6 * ease(fe(1250, 2300, t));
  function flaskAt(t) {
    if (ult) { const o = inHand(t); o.level = 0; o.slosh = 0; o.empty = true; return o; }
    if (t >= T_SMASH) return null;
    if (t < T_REL) { const o = inHand(t); o.level = level(t); o.slosh = 0.5 * fe(T_WIND, T_REL, t) + 0.25 * fe(1250, 1500, t) * (1 - fe(1500, 1900, t)); return o; }
    const c0 = inHand(T_REL), u = fe(T_REL, T_SMASH, t), D = FIN.dir;
    return { x: lerp(c0.x, FIN.lx, u), y: lerp(c0.y, -64, u) - 20 * 4 * u * (1 - u), rot: c0.rot + D * u * TAU, level: level(2300), slosh: 1.1 };
  }
  // the mouth of the uncorked flask (world), from its place and turn
  function flaskTip(F, s) { const ny = -15.8 * s; return [F.x - ny * Math.sin(F.rot), F.y + ny * Math.cos(F.rot)]; }

  /* ---------- rain: straight parallel ink lines, two layers, scrolling down over the whole page ---------- */
  function rainTile(size, n, l0, l1, th, seed) {
    const T = Math.round(size * DPR), cvs = mgCanvas(T, T), x = cvs.getContext("2d"), ang = (75 * Math.PI) / 180, dx = FIN.dir * Math.cos(ang), dy = Math.sin(ang);
    x.scale(DPR, DPR); x.lineCap = "round";
    for (const [colr, wd] of [["rgba(255,255,255,0.6)", th + 1.7], [INK, th]]) {
      const r = mgRng(seed);
      x.strokeStyle = colr; x.lineWidth = wd; x.beginPath();
      for (let i = 0; i < n; i++) {
        const px = r() * size, py = r() * size, len = l0 + r() * (l1 - l0);
        for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { x.moveTo(px + ox, py + oy); x.lineTo(px + ox + dx * len, py + oy + dy * len); }
      }
      x.stroke();
    }
    return { cvs, size, dx, dy };
  }
  function rainDraw(o, t) {
    if (!rainT) return;
    const a = fe(900, 1150, t) * (1 - fe(T_DROP, FIN.hit, t));
    if (a <= 0.01) return;
    const tt = Math.min(t, T_DROP);   // at the drop the rain hangs in the air
    o.save();
    for (const [lyr, v, al] of [[rainT[0], 0.5, 0.6], [rainT[1], 0.92, 0.85]]) {
      const off = (tt - 900) * v, sz = lyr.size, ox = (((lyr.dx * off) % sz) + sz) % sz, oy = (((lyr.dy * off) % sz) + sz) % sz;
      o.globalAlpha = a * al;
      for (let x = ox - sz; x < L.gw; x += sz) for (let y = oy - sz; y < L.gh; y += sz) o.drawImage(lyr.cvs, x, y, sz, sz);
    }
    o.restore();
  }

  /* ---------- Mutation: the Mutagen Cloud in ink, and eyes ---------- */
  // one path: a core disc and 14 lobes (nonzero fill: their union; the rim is stroked first at double width and the fill covers its inner half, so the lobes'
  // own circles never show inside), acid green under a hard dot screen, the pale flash of a pulse, the gold charge and its ring of gold dots, bubbles rising
  // inside (placed from t, no state), billow arcs, the burst. In the caller's units (world or screen); o.lw is the rim in those units.
  // o: { x, y, R, t, pulse 0..1, k (the charge 0..1), shake (units), burst 0..1, fade, cover, tile, lw, nb (bubbles) }
  function mutaCloud(c, pn, o) {
    const R = o.R * (1 + 0.13 * (o.pulse || 0)) * (1 + 0.6 * (o.burst || 0)), x = o.x + (o.shake || 0), y = o.y, k = o.k || 0, t = o.t, lw = o.lw;
    const path = () => { c.moveTo(x + R * 0.62, y); c.arc(x, y, R * 0.62, 0, TAU); for (const b of lobes) { const bx = x + Math.cos(b.a) * b.d * R, by = y + Math.sin(b.a) * b.d * R; c.moveTo(bx + b.r * R, by); c.arc(bx, by, b.r * R, 0, TAU); } };
    c.save(); c.globalAlpha *= o.fade === undefined ? 1 : o.fade;
    const a0 = c.globalAlpha;
    if (k > 0.01) dots(c, pn, () => { c.arc(x, y, R * (1.02 + 0.2 * k), 0, TAU); c.arc(x, y, R * 1.02, 0, TAU, true); }, 7, 0.35, MG_GOLD);   // the gold ring of the charge
    c.lineJoin = "round"; c.beginPath(); path(); c.lineWidth = lw * 2; c.strokeStyle = INK; c.stroke();
    c.fillStyle = COL; c.fill();
    dots(c, pn, path, o.tile || 7, o.cover === undefined ? 0.3 : o.cover, INK);
    c.save(); c.beginPath(); path(); c.clip();
    if (o.pulse > 0.01) { c.globalAlpha = a0 * 0.55 * o.pulse; c.fillStyle = PALE_G; c.beginPath(); c.arc(x, y, R * 0.7, 0, TAU); c.fill(); }
    if (k > 0.01) { c.globalAlpha = a0 * 0.5 * k; c.fillStyle = MG_GOLD_PALE; c.beginPath(); c.arc(x, y, R * 0.8, 0, TAU); c.fill(); }
    c.globalAlpha = a0;
    const tw = t + 250 * k * k, nb = o.nb === undefined ? cbub.length : o.nb;   // the charge doubles their pace
    for (let i = 0; i < nb; i++) {
      const b = cbub[i], f = (tw / b.per + b.ph) % 1;
      if (f > 0.93) continue;
      bubble(c, x + b.x * R + Math.sin(t * 0.003 + b.ph * 7) * R * 0.03, y + R * 0.55 - f * R * 1.15, b.r * R * (0.6 + 0.6 * f), lw * 0.45, "#c6f5ae");
    }
    c.restore();
    c.lineCap = "round"; c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.beginPath();   // billows in the upper lobes
    for (const b of lobes) if (b.bil) { const bx = x + Math.cos(b.a) * b.d * R, by = y + Math.sin(b.a) * b.d * R, rr = b.r * R * 0.62; c.moveTo(bx + Math.cos(Math.PI * 1.1) * rr, by + Math.sin(Math.PI * 1.1) * rr); c.arc(bx, by, rr, Math.PI * 1.1, Math.PI * 1.7); }
    c.stroke();
    c.restore();
  }
  // an eye: white, inked, an iris and a pupil looking along (px, py) (-1..1 of its reach), a glint. open 0..1 shuts it (below 0.15 only the lid line shows), sx
  // squeezes it sideways (the slit while it opens), pk sizes the pupil; o.socket: a lid ring of that colour behind it (an eye that grew out of something);
  // o.disc: the impact frame's plain disc in that colour (o.gold: with a gold pupil)
  function eye(c, x, y, r, o) {
    if (o.disc) {
      c.fillStyle = o.disc; c.beginPath(); c.arc(x, y, r * 1.1, 0, TAU); c.fill();
      if (o.gold) { c.fillStyle = MG_GOLD; c.beginPath(); c.arc(x, y, r * 0.45, 0, TAU); c.fill(); }
      return;
    }
    const lw = o.lw, sx = o.sx === undefined ? 1 : o.sx, op = o.open;
    if (o.socket) { c.beginPath(); c.ellipse(x, y, r * 1.28 * Math.max(sx, 0.6), r * 1.32, 0, 0, TAU); c.fillStyle = o.socket; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
    c.lineCap = "round";
    if (op < 0.15) { c.beginPath(); c.moveTo(x - r * sx, y); c.quadraticCurveTo(x, y + r * 0.45, x + r * sx, y); c.lineWidth = lw * 1.25; c.strokeStyle = INK; c.stroke(); return; }
    const ry = r * 1.1 * op, pk = o.pk || 1, ix = x + (o.px || 0) * 0.35 * r, iy = y + (o.py || 0) * 0.35 * r;
    c.save(); c.beginPath(); c.ellipse(x, y, r * sx, ry, 0, 0, TAU); c.fillStyle = "#ffffff"; c.fill(); c.clip();
    c.beginPath(); c.arc(ix, iy, r * 0.5 * pk, 0, TAU); c.fillStyle = "#4a1f14"; c.fill();
    c.beginPath(); c.arc(ix, iy, r * 0.3 * pk, 0, TAU); c.fillStyle = "#120a08"; c.fill();
    c.beginPath(); c.arc(ix - r * 0.2, iy - r * 0.22, r * 0.15, 0, TAU); c.fillStyle = "#ffffff"; c.fill();
    c.restore();
    c.beginPath(); c.ellipse(x, y, r * sx, ry, 0, 0, TAU); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  }
  // an eye's moment: { open, sx, px, py, pk } or null before it opens. It opens as a slit (40 ms), the lids part over 90 ms; then it blinks on its own period
  // (e.per; shut e.cl ms with 30 ms ramps; e.ph < 0.75, so the first blink waits); the pupil wanders on its own slow circle
  function eyeAt(e, t) {
    if (t < e.t0) return null;
    const u = t - e.t0, s = { open: 1, sx: 1, px: Math.cos(t * e.om + e.wp) * 0.85, py: Math.sin(t * e.om + e.wp) * 0.85, pk: 1 };
    if (u < 40) { s.open = 0; s.sx = 0.4 + 0.6 * (u / 40); return s; }
    if (u < 130) { s.open = ease((u - 40) / 90); return s; }
    const b = (u - 130 + e.ph * e.per) % e.per;
    s.open = b < 30 ? 1 - b / 30 : b < 30 + e.cl ? 0 : b < 60 + e.cl ? (b - 30 - e.cl) / 30 : 1;
    return s;
  }
  const towards = (s, px, py, pk, k) => { s.px = lerp(s.px, px, k); s.py = lerp(s.py, py, k); s.pk = lerp(s.pk, pk, k); };
  const uniBlink = (t) => { const b = t - U_BLINK; return b < 0 || b > 130 ? 1 : b < 30 ? 1 - b / 30 : b < 100 ? 0 : (b - 100) / 30; };   // all of them at once, once
  // the third eye on the forehead (opens in the inset) and the seven on the body (open at the third pulse); u, v are shares of the body ellipse's rx, ry about its
  // middle (u forward), r a share of the fighter's width
  const EYE_F = { u: 0.28, v: -0.72, r: 0.125, t0: 2200, per: 1700, ph: 0.55, om: 0.002, wp: 0, cl: 70 };
  // the eyes on the loser's body: turned with the lean and, in flight, with the tumble (P.spin about half its height, as drawFighter turns it), scaled about the
  // feet like the puppet; drawn after the puppet, so they bulge past its outline. o: { disc, gold } for the impact frames
  function loserEyes(c, pn, Lp, t, sc, o) {
    MG.pt = t;
    const P = pose(Lp, mgTk(t)), sp = P.spin || 0, cs = Math.cos(sp), sn = Math.sin(sp), pv = -P.h * 0.5, jx = P.jit ? P.jit[0] : 0, jy = (P.jit ? P.jit[1] : 0) - (P.hop || 0);
    const H0 = FIN.hit, lk = ease(fe(U_LOOK, U_LOOK + (MG.reduced ? 400 : 120), t)), lw = 2.4 / pn.z;
    c.save(); pn.world(c); c.lineJoin = "round";
    for (const e of [EYE_F].concat(eyesB)) {
      const s = eyeAt(e, t);
      if (!s) continue;
      let q = rot([e.u * P.rx, P.cy + e.v * P.ry], P.hip, P.lean);
      if (sp) { const dx = q[0], dy = q[1] - pv; q = [dx * cs - dy * sn, pv + dx * sn + dy * cs]; }
      const x = Lp.x + (jx + Lp.facing * q[0]) * sc, y = Lp.y + (jy + q[1]) * sc, r = e.r * P.w * sc;
      if (o) { eye(c, x, y, r, { disc: o.disc, gold: o.gold }); continue; }
      if (e === EYE_F) {   // one quick loop of the pupil, then it settles on the reader and stays there
        const lp = fe(2290, 2330, t);
        if (lp < 1) { s.px = Math.cos(lp * TAU) * 0.9; s.py = Math.sin(lp * TAU) * 0.9; } else { s.px = 0; s.py = 0; s.pk = 1.15; }
      }
      if (t >= H0) { s.open = 1; s.px = 0; s.py = 0; s.pk = 1; }   // flying out: wide open, pupils in the middle
      else if (t >= U_LOOK) { s.open = Math.max(s.open, lk) * uniBlink(t); towards(s, 0, 0, 0.6, lk); }   // the drop: every eye on the reader, pinpoints, one blink together
      eye(c, x, y, r, Object.assign(s, { lw, socket: COL }));
    }
    c.restore();
  }

  /* ---------- panels ---------- */
  // an oval as page fractions (for the round inset)
  const oval = (cx, cy, rx, ry, rt, n) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU + 0.2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rt) - y * Math.sin(rt), cy + x * Math.sin(rt) + y * Math.cos(rt)]; });
  function panels(lay) {
    const port = lay.port, D = FIN.dir;
    const ps = [
      { id: "look", t0: MT.LOOK, from: "w", freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0], [1, 0], [1, 0.40], [0, 0.43]] : [[0, 0], [0.45, 0], [0.48, 1], [0, 1]],
        cam: (t) => {
          if (ult) { const vh = (port ? 190 : 168) * (1 - 0.06 * fe(MT.LOOK, MT.STRIKE, t)); return { wx: FIN.wx + D * (port ? 52 : 50), wy: -0.45 * vh, vh }; }   // (Mutation: wider, the cloud beside him)
          const vh = (port ? 138 : 130) * (1 - 0.08 * fe(MT.LOOK, MT.STRIKE, t)); return { wx: FIN.wx + D * (port ? 18 : 16), wy: -0.5 * vh, vh };
        },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "t", slide: 150, freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? oval(0.72, 0.43, 0.22, 0.082, -0.05, 28) : oval(0.545, 0.31, 0.10, 0.27, 0.06, 28),
        cam: (t) => { const h = headL(Math.min(t, 2350)); return { wx: h[0], wy: h[1] - 1, vh: 50 - 4 * fe(MT.INSET, MT.STRIKE, t) }; },
        draw: drawInset },
      ult ? { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.SPLASH, cover: MT.SPLASH,
        poly: port ? [[0, 0.38], [1, 0.36], [1, 0.72], [0, 0.74]] : [[0, 0.36], [1, 0.32], [1, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 200 : 132) * (1 - 0.05 * fe(MT.STRIKE, FIN.hit, t)); return { wx: FIN.wx + D * (port ? 84 : 66), wy: -0.45 * vh, vh }; },
        shake: (t) => { const a = 4 * fe(FIN.hit, FIN.hit + 40, t) * (1 - fe(MT.SPLASH, MT.SPLASH + 250, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
        draw: drawStrikeU }
      : { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.AFTER, cover: MT.AFTER,
        poly: port ? [[0, 0.38], [1, 0.36], [1, 0.72], [0, 0.74]] : [[0, 0.36], [1, 0.32], [1, 1], [0, 1]],
        cam: (t) => { const k = fe(MT.STRIKE, MT.AFTER, t), pan = fe(T_REL, T_SMASH, t) * 14 - 8 * fe(T_SMASH, MT.AFTER, t), vh = (port ? 172 : 126) * (1 - 0.04 * k); return { wx: FIN.wx + D * ((port ? 70 : 64) + pan), wy: -0.45 * vh, vh }; },
        shake: (t) => { const a = 4 * fe(FIN.hit, FIN.hit + 40, t) * (1 - fe(3250, 3500, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b",
        poly: port ? [[0, 0.68], [1, 0.66], [1, 1], [0, 1]] : [[0.40, 0.50], [1, 0.47], [1, 1], [0.36, 1]],
        cam: (t) => { const vh = (port ? 110 : 84) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + D * (port ? 50 : 42), wy: -0.42 * vh, vh }; },
        draw: drawAfter },
    ];
    if (ult) ps.splice(3, 0, mgSplashPanel({ from: "b", paper: MG_GOLD_PALE, dim: "60,80,20", cam: splashCam, before: splashEyes, draw: drawSplash }));
    return ps;
  }

  // the slab: one flat ink shape with a screened band under its edge
  function ground(c, pn) {
    pn.world(c);
    const x0 = FIN.wx - 420, x1 = FIN.wx + 420;
    c.fillStyle = INK; c.fillRect(x0, 0, x1 - x0, 90);
    c.strokeStyle = "#f1ece2"; c.lineWidth = 1.5 / pn.z; c.beginPath(); c.moveTo(x0, 3.2); c.lineTo(x1, 3.2); c.stroke();
  }

  /* ---------- panel 2: the look ---------- */
  const lookCloud = () => [FIN.wx + FIN.dir * 104, -42], LOOK_R = 56;   // Mutation: where the cloud sits behind him in panel 2 (world)
  function drawLook(c, pn, t) {
    const W = W_(), power = fe(1250, 2300, t), F = flaskAt(t);
    pn.screen(c);
    clouds(c, pn, t, pn.h * (0.16 + 0.08 * power), 41, 0.62);
    const R = Math.hypot(pn.w, pn.h);
    if (ult) {   // the cloud swells on the pulses behind him; the focus lines and the dark green dots gather on it
      const [cx, cy] = lookCloud(), cp = pn.p(cx, cy), cr = LOOK_R * pn.z;
      dots(c, pn, () => { c.arc(cp[0], cp[1], cr * 1.38, 0, TAU); c.arc(cp[0], cp[1], cr * 1.05, 0, TAU, true); }, 7, 0.3, COL_D);
      mgFocus(c, cp[0], cp[1], R * 0.95, t * 0.00035, 0.5 + 0.35 * power);
      for (const b of bolts) bolt(c, pn, b, t);
      pn.world(c);
      mutaCloud(c, pn, { x: cx, y: cy, R: LOOK_R, t, pulse: pulseAt(t, U_PULSE), lw: 4.6 / pn.z, nb: MG.slow ? 5 : cbub.length });
    } else {
      const fp = pn.p(F.x, F.y);
      // the glow of the brew: a flat accent disc and a ring of dots round it, growing with the power
      const gr = pn.h * (0.34 + 0.1 * power);
      c.save(); c.globalAlpha = 0.28 + 0.14 * power; c.fillStyle = COL; c.beginPath(); c.arc(fp[0], fp[1], gr, 0, TAU); c.fill(); c.restore();
      dots(c, pn, () => { c.arc(fp[0], fp[1], gr * 1.42, 0, TAU); c.arc(fp[0], fp[1], gr, 0, TAU, true); }, 7, 0.3, COL_D);
      mgFocus(c, fp[0], fp[1], R * 0.95, t * 0.00035, 0.5 + 0.35 * power);
      for (const b of bolts) bolt(c, pn, b, t);
    }
    ground(c, pn);
    pn.world(c);
    mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-0.6) });
    flask(c, pn, { x: F.x, y: F.y, s: ult ? FSU : FS, rot: F.rot, level: F.level, t, ink: 4.6, slosh: F.slosh, empty: F.empty });
    if (ult) lastDrop(c, pn, t);
    pn.screen(c);
    // the corners darken as the power gathers: 70% screens creeping in from the bottom
    if (power > 0.25) {
      const q = (power - 0.25) / 0.75, d = 0.2 * q * pn.w;
      dots(c, pn, () => { c.moveTo(pn.x0, pn.y1); c.lineTo(pn.x0 + d * 1.5, pn.y1); c.lineTo(pn.x0, pn.y1 - d * 1.5); c.closePath(); }, 7, 0.55, INK);
      dots(c, pn, () => { c.moveTo(pn.x1, pn.y1); c.lineTo(pn.x1 - d * 1.5, pn.y1); c.lineTo(pn.x1, pn.y1 - d * 1.5); c.closePath(); }, 7, 0.55, INK);
    }
    // one-frame page inversion of this panel at every bolt (not the impact frames: the panel only)
    for (const b of bolts) if (t >= b.t0 && t < b.t0 + 34) {
      c.globalCompositeOperation = "difference"; c.fillStyle = "#ffffff"; c.fillRect(pn.x0 - 2, pn.y0 - 2, pn.w + 4, pn.h + 4); c.globalCompositeOperation = "source-over";
      break;
    }
  }
  // Mutation: the last green drop swells on the mouth of the upturned flask, lets go at 1700 and lands on the slab as a small blot
  function dropFall(t) {   // [x, y of the drop's round part, r, landed]
    const m = flaskTip(flaskAt(Math.min(t, DROP1)), FSU), r = lerp(2.2, 4.2, ease(fe(DROP0, DROP1, t))), y0 = m[1] + r * 1.5, a = Math.max(0, t - DROP1), g = 0.0045;
    const y = y0 + g * a * a;
    return y >= -r ? [m[0], 0, r, Math.sqrt((-r - y0) / g) + DROP1] : [m[0], y, r, 0];
  }
  function lastDrop(c, pn, t) {
    if (t < DROP0) return;
    const [x, y, r, land] = dropFall(t), lw = 2.4 / pn.z;
    pn.world(c);
    if (!land) { sweatDrop(c, x, y, r, 0, lw, COL); return; }
    const k = easeOut(fe(land, land + 90, t));
    c.beginPath(); c.ellipse(x, -0.6, r * (1 + 1.6 * k), r * (0.9 - 0.45 * k), 0, 0, TAU); c.fillStyle = COL; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  }

  /* ---------- the inset: the loser, dazed and dripping, then terror (Mutation: dazed, and a third eye opens) ---------- */
  // green drips run down the head and the hood: a thin neck, a fat drop at the end, ink round both (source-atop, so they stay on the body)
  const dripPost = (tt) => (lc, X) => {
    lc.lineJoin = "round";
    for (const d of drips) {
      const a = tt - d.t0; if (a < 0) continue;
      const y1 = d.y0 + 0.05 * a + 0.00022 * a * a, x = X.sx + d.x * X.z, ya = X.sy + d.y0 * X.z, yb = X.sy + y1 * X.z, w = d.w * X.z, r = w * 1.35;
      lc.beginPath(); lc.moveTo(x - w * 0.3, ya); lc.lineTo(x + w * 0.3, ya); lc.lineTo(x + w * 0.55, yb - r); lc.lineTo(x - w * 0.55, yb - r); lc.closePath();
      lc.moveTo(x + r, yb - r); lc.arc(x, yb - r, r, 0, TAU);
      lc.lineWidth = w * 0.95; lc.strokeStyle = INK; lc.stroke(); lc.fillStyle = COL; lc.fill();
      lc.beginPath(); lc.arc(x - r * 0.3, yb - r * 1.2, r * 0.3, 0, TAU); lc.fillStyle = "#ffffff"; lc.fill();
    }
    for (const b of blots) {   // splashes that landed
      if (tt < b.t0) continue;
      const k = fe(b.t0, b.t0 + 60, tt), x = X.sx + b.x * X.z, y = X.sy + b.y * X.z, r = b.r * X.z * k;
      lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.lineWidth = Math.max(2, r * 0.3); lc.strokeStyle = INK; lc.stroke(); lc.fillStyle = COL; lc.fill();
    }
  };
  function drawInset(c, pn, t) {
    const Lp = L_(), tt = Math.min(t, 2350), u = fe(MT.INSET, MT.STRIKE, tt);
    pn.screen(c);
    const [fx, fy] = pn.p(...headL(tt));
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0005, 0.8);
    mgPuppet(c, pn, Lp, tt, { sc: 1, light: dirAng(-0.6), tint: 0.3, tone: false, post: dripPost(tt) });
    if (ult) loserEyes(c, pn, Lp, tt, 1);
    pn.screen(c);
    // three dizzy stars circle the head while it is dazed; sweat drops fly off at the moment of terror
    const dz = 1 - fe(2180, 2230, tt);
    if (dz > 0.02) for (let i = 0; i < 3; i++) { const a = tt * 0.006 + (i / 3) * TAU; star(c, pn.cx + Math.cos(a) * pn.w * 0.34, pn.y0 + pn.h * 0.17 + Math.sin(a) * pn.h * 0.05, pn.h * 0.045 * dz); }
    if (tt > 2230 && !ult) {
      const k = fe(2230, 2350, tt);
      for (let i = 0; i < 3; i++) { const sgn = i === 1 ? 1 : -1, x = pn.cx + sgn * pn.w * (0.3 + 0.05 * i) + (i - 1) * 6, y = pn.y0 + pn.h * (0.28 + 0.1 * i) + k * pn.h * 0.1; sweatDrop(c, x, y, pn.h * 0.034, sgn * 0.5, 3); }
    }
  }

  /* ---------- panel 3: the strike ---------- */
  function shardsDraw(c, pn, t) {
    const dt = t - T_SMASH;
    if (dt < 0 || dt > 700) return;
    const ox = FIN.lx, oy = -62, lw = 2.6 / pn.z, a = 1 - fe(450, 700, dt);
    pn.world(c); c.lineJoin = "round"; c.globalAlpha = a;
    // ink shatter marks on the head and the splat of the brew
    const k = fe(0, 90, dt) * (1 - fe(160, 320, dt));
    if (k > 0.02) {
      c.beginPath(); for (let i = 0; i < 16; i++) { const r = (i % 2 ? 9 : 25) * k * (1 + 0.2 * Math.sin(i * 3.1)), an = (i / 16) * TAU; i ? c.lineTo(ox + Math.cos(an) * r, oy + Math.sin(an) * r) : c.moveTo(ox + r, oy); }
      c.closePath(); c.fillStyle = COL; c.fill(); c.lineWidth = lw * 1.2; c.strokeStyle = INK; c.stroke();
    }
    for (const s of shards) {
      const x = ox + Math.cos(s.a) * s.v * dt, y = oy + Math.sin(s.a) * s.v * dt + 0.0002 * dt * dt, r = s.r;
      c.save(); c.translate(x, y); c.rotate(s.r0 + s.vr * dt);
      c.beginPath(); c.moveTo(r, 0); c.lineTo(-r * 0.55, r * 0.42); c.lineTo(-r * 0.35, -r * 0.5); c.closePath();
      c.fillStyle = s.liq ? COL : GLASS; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); c.restore();
    }
    c.globalAlpha = 1;
  }
  // the toxic mushroom: an accent cap with a hard dot screen, rising from where the loser stood; the screen steps lighter as it clears
  function mushroom(c, pn, t) {
    const H = FIN.hit;
    if (t < H) return;
    const k = fe(H, 3500, t), e = easeOut(fe(H, H + 560, t)), bx = FIN.lx, capR = 12 + 24 * e, rx = capR * 1.5, ry = capR * 0.7, capY = -40 - 52 * e, sw = 4.2 + 2.6 * e;
    const cov = k < 0.28 ? 0.62 : k < 0.5 ? 0.46 : k < 0.72 ? 0.3 : 0.16;
    pn.world(c);
    const path = () => {   // a narrow wavy stem, a wide billowing cap with a bumpy rim, and the rolled skirt under it
      const sy = capY + ry * 0.6, wv = Math.sin(t * 0.004) * 1.2;
      c.moveTo(bx - sw * 2.4, 0); c.bezierCurveTo(bx - sw * 0.5 + wv, -8, bx - sw * 1.1 - wv, sy * 0.6, bx - sw * 0.6, sy); c.lineTo(bx + sw * 0.6, sy); c.bezierCurveTo(bx + sw * 1.1 + wv, sy * 0.6, bx + sw * 0.5 - wv, -8, bx + sw * 2.4, 0); c.closePath();
      c.moveTo(bx + rx, capY); c.ellipse(bx, capY, rx, ry, 0, 0, TAU);
      for (let i = 0; i < 8; i++) { const an = Math.PI + (i / 7) * Math.PI, r = capR * (0.4 + 0.1 * Math.sin(i * 2.9)), x = bx + Math.cos(an) * rx * 0.9, y = capY + Math.sin(an) * ry * 0.85; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
      c.moveTo(bx + rx * 0.95, capY + ry * 0.62); c.ellipse(bx, capY + ry * 0.62, rx * 0.95, ry * 0.42, 0, 0, TAU);
    };
    c.beginPath(); path(); c.lineWidth = 6 / pn.z; c.lineJoin = "round"; c.strokeStyle = INK; c.stroke();
    c.fillStyle = COL; c.fill();
    dots(c, pn, path, 7, cov, INK);
    // billow lines in the cap
    c.strokeStyle = INK; c.lineWidth = 3 / pn.z; c.lineCap = "round"; c.beginPath();
    c.arc(bx - rx * 0.35, capY - ry * 0.15, capR * 0.55, Math.PI * 1.05, Math.PI * 1.7); c.moveTo(bx + rx * 0.7, capY - ry * 0.1); c.arc(bx + rx * 0.42, capY - ry * 0.12, capR * 0.4, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
  }
  const loserAt = (tt) => {   // where the loser is (world) at page time tt
    if (tt < FIN.launch) return [FIN.lx - (tt >= FIN.hit ? FIN.dir * 5 : 0), 0];
    const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr];
  };
  function drawStrike(c, pn, t) {
    const W = W_(), D = FIN.dir, H0 = FIN.hit, k1 = fe(MT.STRIKE, H0, t);
    pn.screen(c);
    clouds(c, pn, t, pn.h * (0.1 + 0.07 * k1) * (1 - 0.35 * fe(H0 + 200, 3400, t)), 77, t < H0 ? 0.62 : 0.62 - 0.3 * fe(H0, 3400, t));
    if (t >= H0) { const hp = pn.p(FIN.lx, -34); mgFocus(c, hp[0], hp[1], Math.hypot(pn.w, pn.h), t * 0.0006, 0.75 * (1 - 0.5 * fe(H0, 3300, t))); }
    mgSpeed(c, pn.cx, pn.cy, pn.w, pn.h * 0.55, 0, -t * 0.5 * D, 0.32 * fe(T_COCK, T_REL, t) * (1 - fe(T_SMASH - 30, T_SMASH + 30, t)), false, 1);
    ground(c, pn);
    mushroom(c, pn, t);
    pn.world(c);
    // the arc of the throw: a dotted line behind the flask that stays on the page for a while
    const u = fe(T_REL, T_SMASH, t), fade = 1 - fe(H0, 3300, t);
    if (t > T_REL && fade > 0.02) {
      c.globalAlpha = fade; c.fillStyle = INK;
      const c0 = inHand(T_REL), top = Math.min(u, 1) * 1;
      for (let i = 0; i <= 14; i++) { const q = (i / 14) * top; if (q > 0.97) continue; const x = lerp(c0.x, FIN.lx, q), y = lerp(c0.y, -64, q) - 20 * 4 * q * (1 - q); c.beginPath(); c.arc(x, y, 2.3 / pn.z * 1.6 + 0.4, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    }
    // the swing leaves ghosts of the Alchemist
    if (t > T_COCK && t < T_REL + 100 && !MG.slow) { mgPuppet(c, pn, W, t - 60, { sc: 1, a: 0.18, light: dirAng(-0.6) }); mgPuppet(c, pn, W, t - 30, { sc: 1, a: 0.35, light: dirAng(-0.6) }); }
    mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-0.6) });
    if (!MG.broke) S_.drawLoser(c, pn, t);
    const F = flaskAt(t);
    if (F) {
      if (t > T_REL && !MG.slow) for (const dt of [60, 30]) { const G = flaskAt(t - dt); if (G && t - dt > T_REL) { c.globalAlpha = dt === 60 ? 0.16 : 0.32; flask(c, pn, { x: G.x, y: G.y, s: FS3, rot: G.rot, level: G.level, t, ink: 4.6, slosh: G.slosh, noLabel: true }); } }
      c.globalAlpha = 1;
      flask(c, pn, { x: F.x, y: F.y, s: FS3, rot: F.rot, level: F.level, t, ink: 4.6, slosh: F.slosh });
    }
    shardsDraw(c, pn, t);
    // the loser sweats before the flask lands
    if (t > 2400 && t < T_SMASH + 120) {
      const k = fe(2400, 2650, t), hd = headL(t);
      for (let i = 0; i < 3; i++) { const sg = i - 1, q = (k * 1.4 + i * 0.3) % 1; sweatDrop(c, hd[0] + sg * (14 + 10 * q) , hd[1] - 12 - 8 * (1 - q), 2.1, sg * 0.7, 1.4 / pn.z); }
    }
  }
  // Mutation's strike: no throw; the loser stands in the cloud on the slab, the cloud pulses (2400), charges pale gold (2400-2900), the loser swells and sprouts
  // eyes, and at the hit (the fifth pulse) the cloud bursts into the mushroom
  function drawStrikeU(c, pn, t) {
    const W = W_(), H0 = FIN.hit, k1 = fe(MT.STRIKE, H0, t), ch = t < H0 ? fe(2400, H0, t) : 0;
    pn.screen(c);
    clouds(c, pn, t, pn.h * (0.1 + 0.07 * k1) * (1 - 0.35 * fe(H0 + 200, 3400, t)), 77, t < H0 ? 0.62 : 0.62 - 0.3 * fe(H0, 3400, t));
    if (t >= H0) { const hp = pn.p(FIN.lx, -34); mgFocus(c, hp[0], hp[1], Math.hypot(pn.w, pn.h), t * 0.0006, 0.75 * (1 - 0.5 * fe(H0, 3300, t))); }
    ground(c, pn);
    pn.world(c);
    const shake = t < U_LOOK && !MG.reduced ? Math.sin(t * 1.9) * 2.6 * ch / pn.z : 0;
    mutaCloud(c, pn, { x: FIN.lx, y: -36, R: 70, t, pulse: pulseAt(t, [2400]), k: t < H0 ? ch : 0, shake, burst: t >= H0 ? easeOut(fe(H0, H0 + 120, t)) : 0, fade: 1 - fe(H0, H0 + 400, t),
      lw: 4.6 / pn.z, nb: MG.slow ? 5 : cbub.length });
    mushroom(c, pn, t);
    pn.world(c);
    mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-0.6) });
    if (!MG.broke) S_.drawLoser(c, pn, t);
  }

  /* ---------- the loser: terror, then swollen with the brew, then back to size and out along the launch, trailing bubbles ---------- */
  // bubbles of the brew left along the flight: positions come from the flight curve itself (not from frames), they drift up and shrink away
  function trail(c, pn, t) {
    if (t < FIN.launch + 12) return;
    const h = L_().s.h;
    c.save(); pn.world(c);
    for (let i = 0; i < 13; i++) {
      const age = 16 + i * 26, tt = t - age;
      if (tt < FIN.launch) break;
      const life = fe(230, 470, age + (i % 3) * 25); if (life >= 1) continue;
      const q = loserAt(tt), sz = (7 + 7 * Math.pow(Math.sin(i * 5.3 + 1), 2)) * (1 - 0.7 * life), x = q[0] + Math.sin(i * 2.7) * 10, y = q[1] - h * 0.5 - age * 0.03 + Math.cos(i * 3.1) * 9;
      bubble(c, x, y, sz, 3 / pn.z);
      bubble(c, x - Math.sin(i * 1.9) * 16, y + Math.cos(i * 2.3) * 15, sz * 0.45, 2.4 / pn.z);
    }
    c.restore();
  }
  const balloonPost = (k, h) => (lc, X) => {   // a balloon's shine and a few strain marks, inside the silhouette
    const z = X.z, cx = X.sx, cy = X.sy - h * 0.5 * z;
    lc.lineCap = "round"; lc.strokeStyle = "rgba(255,255,255,0.96)"; lc.lineWidth = Math.max(2, h * 0.07 * z);
    lc.beginPath(); lc.ellipse(cx, cy, h * 0.3 * z, h * 0.36 * z, 0, 3.5, 4.4); lc.stroke();
    lc.lineWidth = Math.max(1.5, h * 0.04 * z); lc.beginPath(); lc.ellipse(cx, cy, h * 0.3 * z, h * 0.36 * z, 0, 4.7, 4.85); lc.stroke();
  };
  function drawLoserFn(c, pn, t) {
    const Lp = L_(), fl = t >= FIN.launch, H0 = FIN.hit, s0 = ult ? U_SW0 : T_SMASH, s1 = ult ? U_SW1 : T_INF;
    trail(c, pn, t);
    if (FIN.out || Lp.state === "gone") return;
    const k = fe(s0, s1, t), sc = inflate(t), base = { light: dirAng(-0.6) };
    if (fl && !MG.slow) for (const dt of [70, 46, 23]) {   // three ghosts
      const [gx, gy] = loserAt(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
      mgPuppet(c, pn, Lp, t - dt, Object.assign({}, base, { sc: 1, a: 0.3 - dt * 0.003, wash: [INK, 0.85], tone: false }));
      Lp.x = ox; Lp.y = oy;
    }
    const wash = t < H0 ? [COL, 0.4 * k] : fl ? [COL, 0.4] : null;
    mgPuppet(c, pn, Lp, t, Object.assign({}, base, { sc, wash, flash: Lp.flash > 0, post: !ult && t >= T_SMASH && t < H0 ? balloonPost(k, Lp.s.h) : null }));
    // the skin is stretched tight: a heavy ink ring round the swollen body; the eyes bulge, far bigger than the face has room for (Mutation: the new eyes instead)
    if (t >= s0 && t < H0) {
      MG.pt = t;
      const P = pose(Lp, mgTk(t)), er = P.w * 0.1 * sc, bg = 1.2 + 0.9 * k;
      c.save(); pn.world(c); c.lineJoin = "round";
      const bx = Lp.x, by = Lp.y + P.cy * sc, brx = P.rx * sc * 1.03, bry = P.ry * sc * 1.03;
      c.beginPath(); c.ellipse(bx, by, brx, bry, 0, 0, TAU); c.lineWidth = 5 / pn.z; c.strokeStyle = INK; c.stroke();
      if (k > 0.35) {   // tension ticks outside the ring: groups of three short lines at uneven angles
        c.lineCap = "round"; c.lineWidth = 2.6 / pn.z; c.beginPath();
        for (const [an, n] of [[-2.5, 3], [-0.7, 3], [0.55, 2], [2.1, 3], [3.3, 2]]) for (let j = 0; j < n; j++) { const a2 = an + (j - 1) * 0.13, r0 = 1.1 + 0.03 * j, r1 = 1.28 - 0.04 * (j % 2); c.moveTo(bx + Math.cos(a2) * brx * r0, by + Math.sin(a2) * bry * r0); c.lineTo(bx + Math.cos(a2) * brx * r1, by + Math.sin(a2) * bry * r1); }
        c.stroke();
      }
      if (!ult) for (const dx of [-0.14, 0.13]) {
        const q = rot([P.head[0] + P.w * dx, P.head[1]], P.hip, P.lean), ex = Lp.x + Lp.facing * q[0] * sc, ey = Lp.y + q[1] * sc;
        c.beginPath(); c.ellipse(ex, ey, er * bg, er * bg * 1.1, 0, 0, TAU); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 2.2 / pn.z * 1.4; c.strokeStyle = INK; c.stroke();
        c.beginPath(); c.arc(ex + Lp.facing * er * 0.15, ey + er * 0.1, er * 0.32, 0, TAU); c.fillStyle = INK; c.fill();
      }
      c.restore();
    }
    if (ult) loserEyes(c, pn, Lp, t, sc);
  }

  /* ---------- panel 5 (Mutation only): the cloud that looks back ---------- */
  // the splash's geometry in page px: the cloud's middle and size, where his feet stand, how much world the panel shows
  function splGeo() {
    const gw = L.gw, gh = L.gh;
    return L.portrait ? { cx: 0.5 * gw, cy: 0.40 * gh, R: 0.52 * gw, mx: mxu(0.42) * gw, fy: 0.90 * gh, vh: 240 }
      : { cx: mxu(0.58) * gw, cy: 0.44 * gh, R: 0.36 * gw, mx: mxu(0.22) * gw, fy: 0.92 * gh, vh: 160 };
  }
  // the camera puts his feet on (mx, fy) whatever the zoom (a 6% push over the splash)
  function splashCam(t, pn) {
    const G = splGeo(), vh = G.vh * (1 - (MG.reduced ? 0 : 0.06) * fe(MT.SPLASH, MT.AFTER, t)), z = pn.h / vh;
    return { wx: FIN.wx - (G.mx - pn.cx) / z, wy: -(G.fy - pn.cy) / z, vh };
  }
  const splFlask = (t) => { const h = handW(t), D = FIN.dir; return { x: h[0] + D * 4, y: h[1] - 12, rot: -0.35 * D }; };
  // the splash's `before` hook (its first frame, when the words are ready): 24 eyes laid out over the cloud (16 upright, 12 on the cheap tier), none on him,
  // on his flask or under MUTATION, none overlapping, all on the page; each opens at its own moment between 3300 and 3750
  function splashEyes(c, t, pn) {
    const G = splGeo(), U = Math.min(L.gw, L.gh), r = mgRng(6061), n = MG.slow ? 12 : L.portrait ? 16 : 24, out = [];
    mgPlace(pn, MT.AFTER);   // (at the end of the push, so the keep-out boxes are their biggest)
    const W = W_(), z = pn.z, ft = pn.p(FIN.wx, 0), hw = W.s.w * 0.75 * z, F = splFlask(3600), fp = pn.p(F.x, F.y), hd = pn.p(...bodyPt(W, 3600, 1, "head"));
    const hands = [pn.p(...handW(3600))], ws = MG.words.find((w) => w.text === "MUTATION");
    MG.pt = 3600; { const P = pose(W, mgTk(3600)); hands.push(pn.p(W.x + W.facing * P.hB[0], W.y + P.hB[1])); }
    let wr = null;
    if (ws) { mgWordPrep(ws); const [wx, wy] = ws.at(3600); wr = [wx - ws.img.w * 0.45, wy - ws.img.h * 0.38, wx + ws.img.w * 0.45, wy + ws.img.h * 0.38]; }
    const clear = (x, y, rr) => {
      if (x - rr < 4 || x + rr > L.gw - 4 || y - rr < 4 || y + rr > G.fy - 6) return false;
      if (x > ft[0] - hw - rr && x < ft[0] + hw + rr && y > hd[1] - W.s.h * 0.35 * z - rr) return false;   // his body
      if (Math.hypot(x - fp[0], y - fp[1]) < 30 * z + rr) return false;   // the flask
      for (const h of hands) if (Math.hypot(x - h[0], y - h[1]) < 12 * z + rr) return false;
      for (const h of hands) { const mx = (h[0] + ft[0]) / 2, my = (h[1] + hd[1]) / 2; if (Math.hypot(x - mx, y - my) < 10 * z + rr) return false; }   // his arms
      if (wr && x > wr[0] - rr && x < wr[2] + rr && y > wr[1] - rr && y < wr[3] + rr) return false;
      for (const e of out) if (Math.hypot(x - e.x, y - e.y) < 1.3 * (rr + e.r)) return false;
      return true;
    };
    for (let i = 0; i < 900 && out.length < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.86 * G.R, u = r(), rr = (0.04 + 0.07 * u * u) * U * (MG.slow ? 1.1 : 1), x = G.cx + Math.cos(a) * d, y = G.cy + Math.sin(a) * d;
      if (clear(x, y, rr * 1.32)) out.push({ x, y, r: rr, t0: 0, per: 1100 + 1200 * r(), ph: 0.7 * r(), om: (0.0012 + 0.0016 * r()) * (r() < 0.5 ? -1 : 1), wp: r() * TAU, cl: 80, lazy: false });
    }
    const order = out.map((e, i) => [r(), i]).sort((a, b) => a[0] - b[0]);
    order.forEach(([u], j) => { out[j].t0 = MT.SPLASH + 50 + 450 * (j / Math.max(1, out.length - 1)) * (0.85 + 0.15 * u); });
    if (out.length > 6) out[6].lazy = true;   // the lazy eye: it never tracks, wanders on and blinks slowest
    if (out.length > 6) out[6].per = 2600;
    eyesS = out;
  }
  function drawSplash(c, pn, t) {
    const G = splGeo(), W = W_(), U = Math.min(L.gw, L.gh), gh = L.gh, still = MG.slow || MG.reduced;
    pn.screen(c);
    mgFocus(c, G.cx, G.cy, Math.hypot(L.gw, L.gh), t * 0.0003, 0.45, MG_GOLD);   // gold wedges
    dots(c, pn, () => { c.arc(G.cx, G.cy, G.R * 1.22, 0, TAU); c.arc(G.cx, G.cy, G.R, 0, TAU, true); }, 7, 0.35, MG_GOLD);   // the gold annulus
    const R = G.R * (still ? 1 : 1 + 0.015 * Math.sin(t * 0.0057));
    mutaCloud(c, pn, { x: G.cx, y: G.cy, R, t, lw: Math.max(3, 0.006 * gh), tile: 9, cover: 0.22, nb: MG.slow ? 4 : 9 });
    // the pulse ring: the fifth pulse still ringing out (gold, an ink hairline inside)
    const pk = easeOut(fe(MT.SPLASH, 3800, t)), pr = G.R * lerp(0.55, 1.08, pk), plw = 0.018 * gh;
    c.save(); c.globalAlpha = lerp(0.9, 0.5, pk);
    c.lineWidth = plw; c.strokeStyle = MG_GOLD; c.beginPath(); c.arc(G.cx, G.cy, pr, 0, TAU); c.stroke();
    c.lineWidth = Math.max(1, plw * 0.12); c.strokeStyle = INK; c.beginPath(); c.arc(G.cx, G.cy, pr - plw * 0.5, 0, TAU); c.stroke();
    c.restore();
    // bubbles drifting up out of the rim, popping
    if (!MG.slow) for (const b of outB) {
      const f = ((t - MT.SPLASH) / b.per + b.ph) % 1, a = b.a, x0 = G.cx + Math.cos(a) * R * 0.97, y0 = G.cy + Math.sin(a) * R * 0.97;
      if (x0 < 0 || x0 > L.gw || y0 < 0 || y0 > gh) continue;
      const x = x0 + Math.sin(t * 0.002 + b.ph * 9) * 0.01 * gh, y = y0 - f * 0.12 * gh, rr = b.r * gh;
      if (f < 0.9) bubble(c, x, y, rr * (0.5 + 0.5 * f), Math.max(1.5, rr * 0.14));
      else star(c, x, y, rr * 0.9);
    }
    // the slab he stands on
    c.fillStyle = INK; c.fillRect(pn.x0 - 4, G.fy, pn.w + 8, pn.y1 - G.fy + 4);
    // the eyes: opening out of step, wandering; at 3900 they find the reader, at 4300 their maker (all but the lazy one)
    const head = pn.p(...bodyPt(W, t, 1, "head")), kr = ease(fe(U_READER, U_READER + (MG.reduced ? 400 : 120), t)), km = ease(fe(U_MAKER, U_MAKER + (MG.reduced ? 400 : 150), t));
    pn.screen(c); c.lineJoin = "round";
    for (const e of eyesS) {
      const s = eyeAt(e, t);
      if (!s) continue;
      if (!e.lazy) {
        towards(s, 0, 0, 1.15, kr);
        if (km > 0) { const dx = head[0] - e.x, dy = head[1] - e.y, dl = Math.hypot(dx, dy) || 1; towards(s, dx / dl, dy / dl, 1, km); }
      }
      eye(c, e.x, e.y, e.r, Object.assign(s, { lw: Math.max(1.5, e.r * 0.11), socket: COL_D }));
    }
    // him, in colour, arms up, the empty flask raised
    pn.world(c);
    if (MG.slow) { const q = pn.p(FIN.wx, -W.s.h * 0.55); c.save(); pn.screen(c); c.fillStyle = MG_GOLD_PALE; c.beginPath(); c.arc(q[0], q[1], W.s.h * 0.75 * pn.z, 0, TAU); c.fill(); c.restore(); pn.world(c); }
    mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-0.6), tint: 0.32, halo: MG.slow ? 0 : 3 });
    const F = splFlask(t);
    flask(c, pn, { x: F.x, y: F.y, s: 2.0, rot: F.rot, level: 0, t, ink: 4.6, empty: true });
  }

  /* ---------- panel 4: the aftermath (its moments are A() + offset: the same panel on both pages) ---------- */
  function puddle(c, pn, t) {
    const a = A(), px = FIN.wx + FIN.dir * 58, k = ease(fe(a, a + 150, t)), rx = 30 * k, hh = 7 * k, lw = 2.6 / pn.z;
    if (k <= 0.01) return;
    pn.world(c);
    c.beginPath(); c.moveTo(px - rx, 0.4); c.quadraticCurveTo(px - rx * 0.7, -hh * 1.5, px - rx * 0.1, -hh * 1.15); c.quadraticCurveTo(px + rx * 0.5, -hh * 1.7, px + rx, 0.4); c.closePath();
    c.fillStyle = COL; c.fill(); c.lineJoin = "round"; c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.ellipse(px - rx * 0.35, -hh * 0.75, rx * 0.2, hh * 0.18, -0.15, 0, TAU); c.fillStyle = "#fff"; c.fill();
    // bubbles swell on it and pop
    for (let i = 0; i < 4; i++) {
      const f = ((t * 0.0006 + i * 0.27) % 1), r = (1.1 + 0.9 * ((i * 7) % 3) / 2) * Math.sin(f * Math.PI) * k, x = px + (i - 1.5) * rx * 0.42, y = -hh * 0.9 - r * 0.4 - f * 3;
      if (ult && i === 1) continue;   // (Mutation: the eye sits there)
      if (r > 0.25) bubble(c, x, y, r, lw * 0.6);
    }
    // the dip: a ring on the surface
    const dip = fe(a + 320, a + 400, t) * (1 - fe(a + 400, a + 580, t));
    if (dip > 0.02) { c.beginPath(); c.ellipse(px + FIN.dir * 4, -1, 4 + 9 * (1 - dip), 1.2 + 2 * (1 - dip), 0, 0, TAU); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke(); }
    // Mutation: the puddle has grown an eye. It follows the spoon as it comes, squeezes shut while the spoon is in, looks at the reader as he tastes, one slow blink on the chime
    if (ult && t >= a + 200) {
      const ex = px - 0.3 * rx, ey = -0.6 * hh - 1.2, s = { open: ease(fe(a + 200, a + 290, t)), sx: 1, px: 0, py: 0, pk: 1 }, bw = spoonBowl(t), dl = Math.hypot(bw[0] - ex, bw[1] - ey) || 1;
      if (t < a + 400) { s.px = (bw[0] - ex) / dl; s.py = (bw[1] - ey) / dl; }
      else if (t < a + 560) s.open = 1 - fe(a + 400, a + 430, t) * (1 - fe(a + 530, a + 560, t));
      else if (t < a + 700) { s.px = (bw[0] - ex) / dl; s.py = (bw[1] - ey) / dl; }
      else s.pk = 1.15;
      const bl = t - (a + 900); if (bl >= 0 && bl < 150) s.open *= bl < 50 ? 1 - bl / 50 : bl < 100 ? 0 : (bl - 100) / 50;
      eye(c, ex, ey, 3.2, Object.assign(s, { lw: lw * 0.8, socket: COL_D }));
    }
  }
  // the tiny spoon: a short ink handle with a bowl; (hx, hy) is the hand, `ang` the way it points (local to the winner's facing), the bowl brims with brew after the dip
  function spoon(c, pn, t, ang, full) {
    const D = FIN.dir, h = handW(t), len = 14, a = D > 0 ? ang : Math.PI - ang, tx = h[0] + Math.cos(a) * len, ty = h[1] + Math.sin(a) * len, lw = 3.2 / pn.z;
    c.save(); pn.world(c); c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = INK; c.lineWidth = lw * 1.5; c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(tx, ty); c.stroke();
    c.strokeStyle = "#ffffff"; c.lineWidth = lw * 0.55; c.stroke();
    c.beginPath(); c.ellipse(tx + Math.cos(a) * 1.8, ty + Math.sin(a) * 1.8, 3.6, 2.6, a, 0, TAU); c.fillStyle = full ? COL : "#ffffff"; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
    c.restore();
  }
  const spoonAng = (t) => { const a = A(); return seg(t, [[0, -0.95], [a, -0.95], [a + 150, -0.95], [a + 400, 1.0], [a + 560, 0.5], [a + 650, Math.PI - 0.12], [a + 900, Math.PI - 0.12], [a + 1020, -0.9]]); };
  function spoonBowl(t) { const D = FIN.dir, h = handW(t), ang = spoonAng(t), a = D > 0 ? ang : Math.PI - ang; return [h[0] + Math.cos(a) * 15.8, h[1] + Math.sin(a) * 15.8]; }
  function drawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir, a = A(), u = fe(MT.AFTER, MT.END, t);
    pn.screen(c);
    const [fx, fy] = pn.p(...bodyPt(W, t, 1, "head"));
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.5);
    // the smoke clears: dot-screen puffs that drift up and step lighter, then go
    const r = mgRng(909);
    for (let i = 0; i < 5; i++) {
      const x = pn.x0 + (0.12 + 0.2 * i + r() * 0.1) * pn.w, y0 = pn.y0 + pn.h * (0.5 + r() * 0.4), rad = pn.h * (0.2 + r() * 0.16), k = fe(a + i * 60, a + 450 + i * 60, t);
      if (k >= 1) continue;
      const cov = k < 0.3 ? 0.6 : k < 0.55 ? 0.42 : k < 0.8 ? 0.26 : 0.12, y = y0 - k * pn.h * 0.3;
      dots(c, pn, () => { c.arc(x, y, rad, 0, TAU); c.arc(x + rad * 0.6, y + rad * 0.2, rad * 0.7, 0, TAU); c.arc(x - rad * 0.6, y + rad * 0.3, rad * 0.65, 0, TAU); }, 7, cov, INK);
    }
    ground(c, pn);
    puddle(c, pn, t);
    pn.world(c);
    mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-0.6) });
    spoon(c, pn, t, spoonAng(t), t > a + 450);
    // the taste is good: sparkles round the face
    const sp = fe(a + 630, a + 700, t) * (1 - fe(a + 880, a + 1020, t));
    if (sp > 0.02) { pn.screen(c); for (let i = 0; i < 3; i++) star(c, fx + (i - 1) * pn.h * 0.15 * (i === 1 ? 0.5 : 1.3), fy - pn.h * (0.12 + 0.07 * ((i + 1) % 2)), pn.h * (0.03 + 0.012 * i) * sp * (0.9 + 0.1 * Math.sin(t * 0.02 + i))); }
  }

  /* ---------- Mutation: the pop's splatter on the results. One canvas laid over #app (pointer-events none, above the screens), nothing in the results screen's own
     markup or CSS; corners and edge bands only, a little see-through, and never over the results' words, cards or buttons (it is cut round them, so it seems to lie
     under them); it dries and fades by 6 s and goes the moment the results are left ---------- */
  let stain = null;
  function stainStop() { if (!stain) return; try { cancelAnimationFrame(stain.raf); stain.cv.remove(); } catch (e) { /* gone */ } stain = null; }
  const hexMix = (a, b, k) => { const A_ = rgb(a), B = rgb(b); return "#" + A_.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join(""); };   // (view.js mix() returns rgb(), which rgb() cannot read back)
  function stainTile(x, cover) {
    const s = 8, tc = mgCanvas(s * DPR, s * DPR), q = tc.getContext("2d"), r = Math.sqrt(cover * s * s / (2 * Math.PI)) * DPR;
    q.fillStyle = INK;
    for (const [dx, dy] of [[0, 0], [s / 2, s / 2]]) for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { q.beginPath(); q.arc((dx + ox) * DPR, (dy + oy) * DPR, r, 0, TAU); q.fill(); }
    const p = x.createPattern(tc, "repeat");
    try { p.setTransform(new DOMMatrix([1 / DPR, 0, 0, 1 / DPR, 0, 0])); } catch (e) { /* no pattern transforms: the dots are DPR times bigger */ }
    return p;
  }
  // the places the splatter keeps off: every button, heading, line of text and card on the results (css px of #app, padded; toApp turns the screen's corners
  // into the app's, also when the app is turned sideways), measured again 4 times a second
  function stainHoles(res) {
    const out = [];
    for (const el of res.querySelectorAll("button, h2, p, .card, .kick")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const a = toApp(r.left, r.top), b = toApp(r.right, r.bottom);
      out.push([Math.min(a[0], b[0]) - 5, Math.min(a[1], b[1]) - 5, Math.abs(b[0] - a[0]) + 10, Math.abs(b[1] - a[1]) + 10]);
    }
    return out;
  }
  function stainStart() {
    stainStop();
    const res = $("scrResult"), app = $("app");
    if (!res || res.hidden || !app) return;   // the results did not come up (a cup's bracket, a bail to the 2D finisher): no stain
    const cv = document.createElement("canvas"), x = cv.getContext("2d"), r = mgRng(4711), D = FIN.dir, win = (f) => (D > 0 ? f : 1 - f);
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;z-index:6;pointer-events:none;opacity:0.6";
    app.appendChild(cv);
    // splats: [x, y as shares of the screen, R as a share of its height, lobes, lands at (s)]; the biggest in the top corner on the loser's side
    const mk = (fx, fy, R, n, t0) => ({ fx: win(fx), fy, R, t0, core: 0.55 + 0.1 * r(), lobes: Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + (r() - 0.5) * 0.5, d: 0.5 + 0.28 * r(), r: 0.2 + 0.14 * r() })),
      spikes: Array.from({ length: 5 }, () => ({ a: r() * TAU, d: 0.95 + 0.3 * r(), r: 0.05 + 0.04 * r() })) });
    const sp = [mk(0.975, 0.02, 0.3, 8, 0.25), mk(0.015, 0.04, 0.24, 7, 0.38), mk(0.26, 1.0, 0.2, 6, 0.5),
      mk(0.52, 0.015, 0.03, 3, 0.3), mk(0.99, 0.6, 0.035, 3, 0.42), mk(0.01, 0.66, 0.04, 3, 0.55), mk(0.74, 0.99, 0.02, 3, 0.6)];
    const S0 = sp[0], drips = [];
    for (const s of sp.slice(0, 2)) for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) drips.push({ s, dx: (r() - 0.5) * 0.9, len: 0.08 + 0.14 * r(), t0: 0.6 + 0.4 * r() });
    stain = { cv, x, t0: performance.now(), raf: 0, last: -1e9, mt: -1e9, holes: [], app, res, red: MG.reduced, sp, drips, S0, D, pats: [stainTile(x, 0.3), stainTile(x, 0.5)], w: 0, h: 0,
      bub: [[-0.5, 0.3, 0.9], [0.0, 0.62, 1.6], [-0.75, 0.12, 2.4]], eye: { fx: 0.935, fy: 0.1 } };
    stain.raf = requestAnimationFrame(stainFrame);
  }
  function stainFrame() {
    const st = stain;
    if (!st) return;
    const res = $("scrResult"), now = performance.now(), s = (now - st.t0) / 1000;
    if (!res || res.hidden || s > 6) { stainStop(); return; }
    st.raf = requestAnimationFrame(stainFrame);
    if (now - st.last < 30) return;   // 30 frames a second is plenty
    st.last = now;
    const gw = st.app.clientWidth || L.gw, gh = st.app.clientHeight || L.gh, U = Math.min(gw, gh), x = st.x, red = st.red;   // (sizes go by the short side)
    if (st.w !== gw || st.h !== gh) { st.w = gw; st.h = gh; st.cv.width = Math.round(gw * DPR); st.cv.height = Math.round(gh * DPR); }
    if (now - st.mt > 250) { st.mt = now; st.holes = stainHoles(st.res); }
    st.cv.style.opacity = (0.5 * (1 - fe(5, 6, s))).toFixed(3);
    x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, gw, gh);
    x.save(); x.beginPath(); x.rect(0, 0, gw, gh); x.rect(gw * 0.12, gh * 0.12, gw * 0.76, gh * 0.76); x.clip("evenodd");   // corners and edge bands only
    for (const [hx, hy, hw, hh] of st.holes) { x.beginPath(); x.rect(0, 0, gw, gh); x.roundRect(hx, hy, hw, hh, 10); x.clip("evenodd"); }
    const dry = fe(3.5, 5, s), col = hexMix(COL, COL_D, dry), lw = 2.5;
    x.lineJoin = "round"; x.lineCap = "round";
    for (const p of st.sp) {
      const k = red ? 1 : fe(p.t0, p.t0 + 0.09, s);
      if (k <= 0) continue;
      const cx = p.fx * gw, cy = p.fy * gh, R = p.R * U * (1 + 0.4 * (1 - k) * (1 - k));
      const path = () => {
        x.moveTo(cx + R * p.core, cy); x.arc(cx, cy, R * p.core, 0, TAU);
        for (const l of p.lobes) { const lx = cx + Math.cos(l.a) * l.d * R, ly = cy + Math.sin(l.a) * l.d * R; x.moveTo(lx + l.r * R, ly); x.arc(lx, ly, l.r * R, 0, TAU); }
        for (const l of p.spikes) { const lx = cx + Math.cos(l.a) * l.d * R, ly = cy + Math.sin(l.a) * l.d * R; x.moveTo(lx + l.r * R, ly); x.arc(lx, ly, l.r * R, 0, TAU); }
      };
      x.beginPath(); path(); x.lineWidth = lw * 2; x.strokeStyle = INK; x.stroke(); x.fillStyle = col; x.fill();
      x.fillStyle = st.pats[dry > 0.5 ? 1 : 0]; x.fill();
    }
    // drips running down from the two top splats, a fat drop at the end of each
    if (!red) for (const d of st.drips) {
      const k = easeOut(fe(d.t0, d.t0 + 1.8, s));
      if (k <= 0 || s < d.s.t0) continue;
      const R = d.s.R * U, x0 = d.s.fx * gw + d.dx * R, y0 = d.s.fy * gh + R * 0.5, y1 = y0 + d.len * gh * k, w = 0.012 * U, rr = 0.016 * U;
      x.beginPath(); x.moveTo(x0 - w / 2, y0); x.lineTo(x0 + w / 2, y0); x.lineTo(x0 + w * 0.6, y1 - rr); x.lineTo(x0 - w * 0.6, y1 - rr); x.closePath(); x.moveTo(x0 + rr, y1 - rr); x.arc(x0, y1 - rr, rr, 0, TAU);
      x.lineWidth = lw * 2; x.strokeStyle = INK; x.stroke(); x.fillStyle = col; x.fill();
      x.beginPath(); x.arc(x0 - rr * 0.3, y1 - rr * 1.25, rr * 0.3, 0, TAU); x.fillStyle = "#ffffff"; x.fill();
    }
    const S0 = st.S0, c0x = S0.fx * gw, c0y = S0.fy * gh, R0 = S0.R * U, dx = st.D > 0 ? 1 : -1;
    // three bubbles on the biggest splat swell and pop
    if (!red) for (const [bx, by, tp] of st.bub) {
      const px = c0x + bx * R0 * dx, py = c0y + by * R0, u = fe(tp - 0.4, tp, s);
      if (u <= 0 || s > tp + 0.07) continue;
      if (s < tp) bubble(x, px, py, 0.02 * U * u, 1.6, col); else star(x, px, py, 0.016 * U);
    }
    // the eye in the biggest splat: opens at 0.6 s, looks at the middle of the screen (the score), blinks twice, closes slowly as the stain dries
    const ex = (dx > 0 ? st.eye.fx : 1 - st.eye.fx) * gw, ey = st.eye.fy * gh, er = 0.05 * U, mx = gw / 2 - ex, my = gh / 2 - ey, ml = Math.hypot(mx, my) || 1;
    if (red || s >= 0.6) {
      let op = red ? 1 : ease(fe(0.6, 0.72, s)) * (1 - ease(fe(3.6, 4.0, s)));
      for (const b of [1.5, 2.6]) { const q = s - b; if (!red && q >= 0 && q < 0.15) op *= q < 0.05 ? 1 - q / 0.05 : q < 0.1 ? 0 : (q - 0.1) / 0.05; }
      eye(x, ex, ey, er, { open: op, px: mx / ml, py: my / ml, pk: 1, lw: 1.8, socket: col });
    }
    x.restore();
  }

  /* ---------- the script ---------- */
  const S_ = {
    col: COL, name: "The Experiment", flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "SPLOSH" : heavy ? "DOOM" : "KRAK", D = FIN.dir, mu = lay.port ? 0.5 : 1;   // the page is tall on a phone held upright: words scale with its width
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike, P4 = () => MG.byId.after, a = A();
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.24, mul: mu, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        { text: "GLUG GLUG", t0: 1330, t1: 2330, size: 0.075, mul: mu, jag: 0.14, rot: 0.1 * D, at: () => { const p = P2(); return [(D > 0 ? p.x1 : p.x0) + D * p.w * 0.06, p.y0 + p.h * 0.64]; } },
        { text: "KRAKOOM", t0: 1500, t1: 2420, size: 0.09, mul: mu, jag: 0.2, rot: -0.1 * D, at: () => { const p = P2(); return [(D > 0 ? p.x0 + p.w * 0.3 : p.x1 - p.w * 0.3), p.y0 + p.h * 0.2]; } },
        { text: "KLINK", t0: T_SMASH, t1: 2900, size: 0.11, mul: mu, jag: 0.22, rot: 0.12 * D, at: () => { const p = P3(), q = p.sp(FIN.lx + D * 92, -78); return [q[0], q[1]]; } },
        { text: "SPLORT", t0: FIN.hit, t1: 3560, size: 0.3, mul: lay.port ? 0.33 : 1, arc: 7, rot: -0.06 * D, at: () => { const p = P3(); return [p.cx + D * p.w * 0.02, p.y0 + p.h * 0.34 + p.oy]; } },
        { text: "blup blup", t0: FIN.launch, t1: 3620, size: 0.075, mul: mu, jit: 0.1, rot: Math.atan(FIN.ldy / (Math.abs(FIN.ldx) > 0.05 ? FIN.ldx : 0.05)) * 0.5, stretch: { ang: Math.atan2(FIN.ldy, FIN.ldx), k: 0.7 },
          at: () => { const p = P3(), up = Math.abs(FIN.ldx) < 0.35, q = up ? p.sp(FIN.lx + D * 104, -50) : p.sp(FIN.lx + FIN.ldx * 105 + D * 34, FIN.ldy * 105 + 14); return [q[0], q[1]]; } },
        { text: "mmm", t0: a + 630, t1: a + 1060, size: 0.1, mul: mu, jit: 0.1, rot: -0.1 * D, at: (t) => { const p = P4(), m = p.sp(...bodyPt(W_(), a + 700, 1, "mouthPt")); return [m[0] + D * p.h * 0.28, m[1] - p.h * 0.28]; } },
      ];
    },
    build(lay) {
      const r = mgRng(1313), g = L.gw, h = L.gh;
      rainT = [rainTile(260, 64, 9, 22, 1.1, 5), rainTile(380, 44, 24, 56, 2, 9)];
      // the bolts: where they stand across panel 2 and when they strike (Mutation: two, between the pulses)
      bolts = (ult ? [[0.14, 1650], [0.78, 2150]] : [[0.14, 1480], [0.8, 1780], [0.47, 2060]]).map(([x0, t0], bi) => {
        const pts = [[x0, 0.04]], n = 8; let x = x0;
        for (let i = 1; i <= n; i++) { x += (i % 2 ? 1 : -1) * (0.04 + r() * 0.06); pts.push([x, 0.04 + (0.84 * i) / n]); }
        const m = pts[4], fork = [m, [m[0] + (bi === 1 ? -0.1 : 0.1), m[1] + 0.07], [m[0] + (bi === 1 ? -0.07 : 0.07), m[1] + 0.17], [m[0] + (bi === 1 ? -0.16 : 0.15), m[1] + 0.25]];
        return { t0, pts, fork };
      });
      bub = Array.from({ length: 16 }, () => ({ x: (r() - 0.5) * 11, ph: r(), sp: 0.7 + r() * 0.9, r: 0.45 + r() * 0.8 }));
      shards = Array.from({ length: 16 }, (_, i) => ({ a: -Math.PI * 0.95 + (i / 16) * Math.PI * 1.35 + (r() - 0.5) * 0.2, v: 0.12 + r() * 0.2, vr: (r() - 0.5) * 0.02, r0: r() * 6, r: 3 + r() * 4, liq: i % 3 === 0 }));
      drips = [[-17, -58], [-13, -50], [-9.5, -61], [11, -60], [15, -52], [18.5, -59], [3, -62]].map(([x, y0], i) => ({ x, y0, t0: 2000 + i * 55 + r() * 40, w: 0.8 + r() * 0.5 }));
      blots = Array.from({ length: 6 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (13 + r() * 6), y: -56 + r() * 20, r: 0.7 + r() * 1.3, t0: 2000 + i * 50 }));
      if (!ult) return;
      // Mutation: the cloud's lobes and bubbles, the seven eyes on the loser's body (five on the cheap tier), the bubbles that leave the splash's cloud
      const q = mgRng(2027);
      lobes = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * TAU + (q() - 0.5) * 0.2, d: 0.55 + 0.13 * q(), r: 0.26 + 0.08 * q(), bil: false }));
      lobes.filter((b) => Math.sin(b.a) < -0.3).slice(0, 4).forEach((b) => { b.bil = true; });
      cbub = Array.from({ length: 9 }, () => ({ x: (q() - 0.5) * 1.1, ph: q(), per: 1200 + 700 * q(), r: 0.04 + 0.035 * q() }));
      const TB = [2410, 2455, 2505, 2560, 2620, 2685, 2745];
      eyesB = [[-0.55, -0.40], [0.62, -0.30], [-0.25, 0.42], [0.55, 0.30], [-0.72, 0.05], [0.10, 0.62], [-0.45, -0.75]].map(([u, v], i) => ({ u, v, r: 0.07 + 0.04 * q(), t0: TB[i], per: 900 + 1000 * q(), ph: 0.7 * q(), om: (0.0016 + 0.0014 * q()) * (q() < 0.5 ? -1 : 1), wp: q() * TAU, cl: 70 }))
        .filter((e, i) => !MG.slow || (i !== 2 && i !== 4));
      outB = Array.from({ length: 6 }, () => ({ a: -Math.PI * (0.1 + 0.8 * q()), ph: q(), per: 1100 + 600 * q(), r: 0.012 + 0.018 * q() }));
      eyesS = [];
    },
    start() { ult = false; stainStop(); FIN.P[FIN.w].specCd = 99; },   // the puppet is a copy: no toxic orb in the hand, the flask is the prop
    step(t, k) { MG.pt = t; },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, H0 = FIN.hit, a = A();
      if (role === "w") {
        const hold = [w * 0.98, -leg - tor * 1.02], cock = [-w * 0.5, -leg - tor * 1.3], rel = [w * 1.25, -leg - tor * 1.15], fol = [w * 1.05, -leg - tor * 0.85], rest = [w * 0.85, -leg - tor * 0.6];
        const dip = [w * 1.12, -leg - tor * 0.28], mouth = [w * 0.16 + 14.5, (-leg - p.s.h + 7) / 2 - ((p.s.h - leg + 3) / 2) * 0.28 + w * 0.23 - 1.5];
        const after = [[a, rest], [a + 150, rest], [a + 400, dip], [a + 560, rest], [a + 650, mouth], [a + 900, mouth], [a + 1020, rest]];
        const leanA = [[a + 150, 0.06], [a + 400, 0.14], [a + 650, -0.02], [a + 1000, 0.04]];
        P.expr = t < (ult ? U_PULSE[0] : 1480) ? "calm" : t >= a + 450 && t < a + 850 ? "calm" : "grin"; P.exK = 1;
        if (ult) {   // Mutation: the flask turned over the cloud, hands on hips in the strike, the point at the drop, the recoil, arms up in the splash
          const pour = [w * 1.15, -leg - tor * 1.62], hipF = [w * 0.55, -leg - tor * 0.35], hipB = [-w * 0.5, -leg - tor * 0.35], point = [w * 1.3, -leg - tor * 0.8], face = [w * 0.1, -leg - tor * 0.95];
          const upF = [w * 1.05, -leg - tor * 1.35], upB = [-w * 0.95, -leg - tor * 1.3], hB0 = [-w * 0.7, -leg - tor * 0.45];
          const hF = seg(t, [[0, hold], [1250, hold], [DROP0, pour], [2350, pour], [2400, hipF], [U_LOOK, hipF], [2840, point], [H0, point], [2980, hipF], [MT.SPLASH, hipF], [MT.SPLASH + 120, upF], [a, upF], [a + 1, rest]].concat(after.slice(1)));
          const hB = seg(t, [[0, hB0], [2350, hB0], [2400, hipB], [H0, hipB], [2960, face], [MT.SPLASH, face], [MT.SPLASH + 120, upB], [a, upB], [a + 1, hB0]]);
          const jolt = U_PULSE.slice(0, 2).reduce((s, b) => s + (t >= b && t < b + 160 ? 0.12 * (1 - (t - b) / 160) : 0), 0);
          P.lean = seg(t, [[0, 0], [1250, 0], [DROP0, 0.06], [2350, 0.06], [2400, 0.05], [U_LOOK, 0.05], [2840, 0.2], [H0, 0.2], [2960, -0.25], [MT.SPLASH, -0.25], [MT.SPLASH + 120, -0.1], [U_MAKER, -0.1], [U_MAKER + 150, -0.15], [a, -0.15], [a + 1, 0.08]].concat(leanA)) + (t < 2350 ? jolt : 0);
          return { hF, hB };
        }
        const hF = seg(t, [[0, hold], [T_WIND, hold], [T_COCK, cock], [T_REL, rel], [2600, fol], [3300, fol]].concat(after));
        const jolt = bolts.reduce((s, b) => s + (t >= b.t0 && t < b.t0 + 160 ? 0.07 * (1 - (t - b.t0) / 160) : 0), 0);
        P.lean = seg(t, [[0, 0], [T_WIND, 0], [T_COCK, -0.3], [T_REL, 0.25], [2650, 0.18], [a, 0.08]].concat(leanA)) + (t < T_WIND ? jolt : 0);
        return { hF, hB: [-w * 0.7, -leg - tor * 0.45] };
      }
      // the loser
      if (t >= FIN.launch) {
        P.expr = "ko"; P.exK = 1; P.lean = -0.5; P.mouth = 1; P.spin = ((t - FIN.launch) / FMS) * 0.3;
        return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
      }
      const tz = ult ? U_PULSE[2] : 2200;   // dazed until here (Mutation: until the third pulse), then terror
      P.expr = t < tz ? "dazed" : "terror"; P.exK = t < tz ? 1 : ult ? fe(tz, tz + 120, t) : t >= T_SMASH ? 1 : fe(2200, 2330, t);
      if (t < tz) { P.lean = Math.sin(t * 0.005) * 0.1; P.mouth = 0.2; return { hF: [w * 0.75, -leg - tor * 0.45], hB: [-w * 0.7, -leg - tor * 0.45] }; }
      const s0 = ult ? U_SW0 : T_SMASH;
      if (t < s0) { P.lean = Math.sin(t * 0.05) * 0.03; P.mouth = 0.8; return { hF: [w * 0.6, -leg - tor * 1.1], hB: [-w * 0.5, -leg - tor * 1.15] }; }
      const k = fe(s0, ult ? U_SW1 : T_INF, t);
      P.lean = Math.sin(t * 0.07) * 0.05 * k; P.mouth = 1;
      return { hF: [w * (0.75 + 0.3 * k), -leg - tor * (1.1 - 0.4 * k)], hB: [-w * (0.65 + 0.3 * k), -leg - tor * (1.1 - 0.4 * k)] };
    },
    // the balloon lifts a little off the slab and shivers; popped, it is back on it (Mutation: it only shivers in the cloud)
    after(t) {
      const Lp = L_();
      if (ult) { if (t >= U_SW0 && t < FIN.hit) Lp.x += Math.sin(t * 0.09) * 1.1 * fe(U_SW0, U_SW1, t); return; }
      if (t >= T_SMASH && t < FIN.hit) { const k = ease(fe(T_SMASH, T_INF, t)); Lp.y = -9 * k; Lp.x += Math.sin(t * 0.09) * 1.1 * k; }
    },
    over(o, t) {
      if (ult) afterglow(o, t);
      rainDraw(o, t);
      // the page-wide shock ring of the pop: a thick ink ring and a ring of dots behind it
      const H0 = FIN.hit, k = fe(H0, H0 + 480, t), pn = MG.byId.strike, cut = ult ? 1 - fe(MT.SPLASH - 100, MT.SPLASH, t) : 1;
      if (cut <= 0) return;
      if (t > H0 && k < 1 && pn) {
        const q = pn.sp(FIN.lx, -34), R = Math.hypot(L.gw, L.gh) * 0.75 * easeOut(k);
        o.save(); o.lineCap = "round"; o.globalAlpha = cut;
        o.setLineDash([0.1, 15]); o.strokeStyle = INK; o.lineWidth = 8 * (1 - k) + 1.5; o.beginPath(); o.arc(q[0], q[1], R * 0.78, 0, TAU); o.stroke();
        o.setLineDash([]); o.lineWidth = 3 + 15 * (1 - k); o.beginPath(); o.arc(q[0], q[1], R, 0, TAU); o.stroke();
        o.strokeStyle = "#ffffff"; o.lineWidth = Math.max(0.5, 5 * (1 - k)); o.beginPath(); o.arc(q[0], q[1], Math.max(0, R - 4 - 8 * (1 - k)), 0, TAU); o.stroke();
        o.restore();
      }
      // speed lines along the launch while the loser is on its way
      if (t > FIN.launch && t < FIN.launch + 420 && pn) {
        const Lp = L_(), a = (1 - fe(FIN.launch + 200, FIN.launch + 420, t)) * cut;
        const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - FIN.launch) * 1.4, 0.8 * a, false, 1);
        o.restore();
      }
    },
    drawLoser: drawLoserFn,
    hitPt() { return [FIN.lx, -34]; },
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_(), sc = ult ? 1.22 : 1.65;
      mgPuppet(o, pn, W, FIN.hit + 10, { sc: 1, sil });
      mgPuppet(o, pn, Lp, FIN.hit + 10, { sc, sil });   // the instant before it goes: the full balloon
      // the burst: a spiked star round the balloon
      o.save(); pn.world(o); o.fillStyle = sil;
      const R = ult ? 80 : 72, cx = FIN.lx, cy = -40 - 7;
      o.beginPath(); for (let i = 0; i < 22; i++) { const r = (i % 2 ? 0.55 : 1) * R * (1 + 0.18 * Math.sin(i * 2.3)), an = (i / 22) * TAU; i ? o.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r) : o.moveTo(cx + r, cy); }
      o.closePath(); o.fill(); o.restore();
      // Mutation: the eyes as discs in the other colour (the gold frame: white discs with gold pupils)
      if (ult) loserEyes(o, pn, Lp, U_LOOK + 100, sc, { disc: sil === "#ffffff" ? "#000000" : "#ffffff", gold: sil !== "#ffffff" && sil !== "#000000" });
    },
    cues(t) {
      const a = A();
      cueOnce("glug1", 1340, () => Cin.go(() => { Cin._osc("sine", 230, 120, 0.12, 0.2, 0.01); Cin._noise(0.12, 0.1, 500, 900, "bandpass", 3); }));
      cueOnce("glug2", 1500, () => Cin.go(() => { Cin._osc("sine", 260, 130, 0.12, 0.2, 0.01); Cin._noise(0.12, 0.1, 600, 1000, "bandpass", 3); }));
      cueOnce("bolt1", 1480, () => Cin.go(() => { Cin._noise(0.14, 0.45, 7000, 1500, "highpass"); Cin.rumble(0.35); }));
      cueOnce("glug3", 1700, () => Cin.go(() => { Cin._osc("sine", 200, 110, 0.14, 0.2, 0.01); Cin._noise(0.14, 0.1, 450, 800, "bandpass", 3); }));
      cueOnce("bolt2", 1780, () => Cin.go(() => { Cin._noise(0.14, 0.45, 7000, 1500, "highpass"); Cin.rumble(0.35); }));
      cueOnce("glug4", 1920, () => Cin.go(() => { Cin._osc("sine", 280, 140, 0.12, 0.2, 0.01); Cin._noise(0.1, 0.1, 700, 1200, "bandpass", 3); }));
      cueOnce("bolt3", 2060, () => Cin.go(() => { Cin._noise(0.16, 0.5, 7000, 1400, "highpass"); Cin.rumble(0.55); Cin.impact(0.3); }));
      cueOnce("drip1", 2080, () => Cin.go(() => Cin.tick(1900)));
      cueOnce("drip2", 2160, () => Cin.go(() => Cin.tick(1500)));
      cueOnce("pluck", 2200, () => Cin.go(() => Cin.pluck(1480)));
      cueOnce("drip3", 2290, () => Cin.go(() => Cin.tick(2100)));
      cueOnce("throw", T_REL - 20, () => Cin.go(() => Cin.whoosh(0.2, -0.7, 0.7, 0.4)));
      cueOnce("glass", T_SMASH, () => Cin.go(() => { Cin.glass(); Cin._noise(0.2, 0.3, 900, 300, "lowpass", 1.2); }));
      cueOnce("swell", T_SMASH + 30, () => Cin.go(() => { Cin._osc("triangle", 170, 560, 0.2, 0.13, 0.02); Cin._osc("triangle", 215, 690, 0.2, 0.08, 0.02, 0.03); }));
      cueOnce("swell2", T_SMASH + 100, () => Cin.go(() => { Cin._osc("triangle", 230, 720, 0.12, 0.1, 0.02); Cin._noise(0.1, 0.08, 1500, 3500, "bandpass", 3); }));
      cueOnce("splort", FIN.hit, () => Cin.go(() => { Cin._noise(0.45, 0.6, 900, 70, "lowpass", 1.8); Cin._osc("sine", 150, 38, 0.3, 0.55, 0.004); Cin._noise(0.3, 0.18, 400, 1500, "bandpass", 4, 0.05); }));
      blups();
      afterCues(a);
    },
  };
  function blups() {
    cueOnce("blup1", FIN.launch + 10, () => Cin.go(() => { Cin.whoosh(0.3, -0.8, 0.8, 0.4); Cin._osc("sine", 320, 760, 0.08, 0.12, 0.01); }));
    cueOnce("blup2", FIN.launch + 90, () => Cin.go(() => Cin._osc("sine", 400, 880, 0.07, 0.1, 0.01)));
    cueOnce("blup3", FIN.launch + 170, () => Cin.go(() => Cin._osc("sine", 520, 1000, 0.07, 0.08, 0.01)));
  }
  function afterCues(a) {
    cueOnce("dip", a + 380, () => Cin.go(() => { Cin._osc("sine", 700, 420, 0.07, 0.1, 0.004); Cin._noise(0.1, 0.06, 1200, 500, "bandpass", 3); }));
    cueOnce("mm1", a + 640, () => Cin.go(() => Cin._osc("sine", 262, 262, 0.32, 0.09, 0.06)));
    cueOnce("mm2", a + 800, () => Cin.go(() => Cin._osc("sine", 349, 349, 0.4, 0.09, 0.06)));
    cueOnce("chime", a + 900, () => Cin.go(() => Cin.chime(988)));
  }
  // Mutation, panel 1: the burst's afterglow at the hit (the cloud itself is gone by the freeze): a faint green disc, a ring of gold dots, three bubbles that pop
  function afterglow(o, t) {
    if (t < MT.INKED || t > MT.LOOK) return;
    const a = fe(MT.INKED, MT.INKED + 120, t) * (1 - fe(900, MT.LOOK, t)), x = MG.ix, y = MG.iy, gh = L.gh;
    if (a <= 0.01) return;
    o.save(); o.globalAlpha = 0.18 * a; o.fillStyle = COL; o.beginPath(); o.arc(x, y, 0.16 * gh, 0, TAU); o.fill();
    o.globalAlpha = a; dots(o, null, () => { o.arc(x, y, 0.22 * gh, 0, TAU); o.arc(x, y, 0.16 * gh, 0, TAU, true); }, 7, 0.3, MG_GOLD);
    [[-0.08, 0.04, 700], [0.06, -0.02, 950], [-0.02, 0.07, 1150]].forEach(([dx, dy, tp]) => {
      const bx = x + dx * gh, by = y + dy * gh - (t - MT.INKED) * 0.02;
      if (t < tp) bubble(o, bx, by, 0.012 * gh + 0.008 * gh * fe(MT.INKED, tp, t), 2);
      else if (t < tp + 67) star(o, bx, by, 0.014 * gh);
    });
    o.restore();
  }
  // the words of Mutation: the beat (BWUMP) on every pulse, the drop that falls, the blink, the eyes popping open, KABWUMP, MUTATION
  function wordsU(lay) {
    const D = FIN.dir, mu = lay.port ? 0.5 : 1, P2 = () => MG.byId.look, P3 = () => MG.byId.strike, P4 = () => MG.byId.after, a = A();
    const rim = () => { const p = P2(), [cx, cy] = lookCloud(), q = p.sp(cx + D * 4, cy - LOOK_R - 8); return [q[0], q[1]]; };   // over the top of the cloud
    return [
      { text: "BWUMP", t0: 600, t1: 1330, size: 0.24, mul: mu, jit: 0.08, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
      { text: "BWUMP", t0: 1400, t1: 1850, size: 0.085, mul: mu, jag: 0.14, rot: 0.1 * D, at: rim },
      { text: "KRAKOOM", t0: 1650, t1: 2420, size: 0.09, mul: mu, jag: 0.2, rot: -0.1 * D, at: () => { const p = P2(); return [(D > 0 ? p.x0 + p.w * 0.3 : p.x1 - p.w * 0.3), p.y0 + p.h * 0.2]; } },
      { text: "drip", t0: DROP1, t1: 2150, size: 0.055, mul: mu, jit: 0.1, rot: 0.08 * D, at: () => { const p = P2(), m = flaskTip(flaskAt(DROP1), FSU), q = p.sp(m[0] + D * 18, m[1] + 12); return [q[0], q[1]]; } },
      { text: "BWUMP", t0: 1900, t1: 2340, size: 0.085, mul: mu, jag: 0.18, rot: -0.06 * D, at: rim },
      { text: "blink", t0: 2230, t1: 2600, size: 0.055, mul: mu, jit: 0.1, rot: 0.1 * D, at: () => { const p = MG.byId.inset; return [D > 0 ? p.x1 + p.w * 0.12 : p.x0 - p.w * 0.12, p.y0 + p.h * (lay.port ? 0.85 : 0.3)]; } },
      { text: "BWUMP", t0: U_PULSE[2], t1: 2800, size: 0.09, mul: mu, jag: 0.2, rot: -0.08 * D, at: () => { const q = P3().sp(FIN.lx, -118); return [q[0], q[1]]; } },
      { text: "pop pop pop", t0: 2430, t1: 2820, size: 0.065, mul: mu, jit: 0.18, arc: 4, rot: 0.06 * D, at: () => { const q = P3().sp(FIN.lx - D * 58, -86); return [q[0], q[1]]; } },
      { text: "KABWUMP", t0: FIN.hit, t1: MT.SPLASH + 150, size: 0.3, mul: lay.port ? 0.3 : 1, arc: 7, rot: -0.06 * D, at: () => { const p = P3(); return [p.cx + D * p.w * 0.02, p.y0 + p.h * 0.34 + p.oy]; } },
      { text: "blup blup", t0: FIN.launch, t1: MT.SPLASH + 150, size: 0.075, mul: mu, jit: 0.1, rot: Math.atan(FIN.ldy / (Math.abs(FIN.ldx) > 0.05 ? FIN.ldx : 0.05)) * 0.5, stretch: { ang: Math.atan2(FIN.ldy, FIN.ldx), k: 0.7 },
        at: () => { const p = P3(), up = Math.abs(FIN.ldx) < 0.35, q = up ? p.sp(FIN.lx + D * 104, -50) : p.sp(FIN.lx + FIN.ldx * 105 + D * 34, FIN.ldy * 105 + 14); return [q[0], q[1]]; } },
      { text: "MUTATION", t0: 3600, t1: MT.CARD + 120, size: 0.2, mul: lay.port ? Math.min(0.5, 0.86 * L.gw / (8 * 0.2 * L.gh * 0.72)) : 1, fill: MG_GOLD, arc: 9, jag: 0.06, rot: -0.05 * D,
        at: () => { const G = splGeo(), p = MG.byId.splash; return [G.cx + D * 0.02 * L.gw, G.cy - (lay.port ? 0.34 : 0.30) * L.gh + (p ? p.oy : 0)]; } },
      { text: "mmm", t0: a + 630, t1: a + 1060, size: 0.1, mul: mu, jit: 0.1, rot: -0.1 * D, at: (t) => { const p = P4(), m = p.sp(...bodyPt(W_(), a + 700, 1, "mouthPt")); return [m[0] + D * p.h * 0.28, m[1] - p.h * 0.28]; } },
    ];
  }
  function cuesU(t) {
    const thump = () => { Cin._noise(0.25, 0.35, 900, 120, "lowpass", 1.4); Cin._osc("sine", 150, 60, 0.2, 0.3, 0.004); };   // the cloud's wet beat
    U_PULSE.forEach((p, i) => cueOnce("pulse" + i, p, () => Cin.go(thump)));
    bolts.forEach((b, i) => cueOnce("bolt" + i, b.t0, () => Cin.go(() => { Cin._noise(0.14, 0.45, 7000, 1500, "highpass"); Cin.rumble(0.35); })));
    cueOnce("lastDrop", DROP1 + 90, () => Cin.go(() => Cin.tick(1900)));
    cueOnce("drip1", 2080, () => Cin.go(() => Cin.tick(1900)));
    cueOnce("drip2", 2160, () => Cin.go(() => Cin.tick(1500)));
    cueOnce("pluck", 2200, () => Cin.go(() => Cin.pluck(1480)));
    cueOnce("drip3", 2290, () => Cin.go(() => Cin.tick(2100)));
    eyesB.forEach((e, i) => cueOnce("plip" + i, e.t0, () => Cin.go(() => Cin._osc("sine", 760, 1180, 0.045, 0.07, 0.004))));
    cueOnce("charge", U_PULSE[2], () => Cin.go(() => Cin.riser(0.5, 0.2)));
    cueOnce("shim", 2700, () => Cin.go(() => Cin.shimmer(1568, 0.6)));
    cueOnce("kabwump", FIN.hit, () => Cin.go(() => { Cin._noise(0.5, 0.7, 700, 60, "lowpass", 1.8); Cin.sub(140, 30, 0.35, 0.6); Cin._noise(0.3, 0.18, 400, 1500, "bandpass", 4, 0.05); }));
    blups();
    cueOnce("glorp", MT.SPLASH + 40, () => Cin.go(() => { Cin._osc("sine", 90, 260, 0.35, 0.3, 0.02); Cin._noise(0.4, 0.25, 300, 1400, "bandpass", 1.2); Cin.shimmer(1568, 1.6); Cin.sub(50, 36, 1.2, 0.3); }));
    eyesS.forEach((e, i) => { if (i === 0) cueOnce("seye0", e.t0, () => Cin.go(() => Cin.pluck(1760))); else if (i % 3 === 0) cueOnce("seye" + i, e.t0, () => Cin.go(() => Cin._osc("sine", 760, 1180, 0.045, 0.06, 0.004))); });
    cueOnce("name", 3600, () => Cin.go(() => Cin.taiko(0.8)));
    cueOnce("reader", U_READER, () => Cin.go(() => Cin.pluck(1480)));
    cueOnce("maker", U_MAKER, () => Cin.go(() => Cin._osc("sine", 330, 330, 0.25, 0.07, 0.04)));
    afterCues(A());
  }
  /* ---------- the Ultimate page, "Mutation": the same script with its own panels, words, cues and hooks (they read `ult`, set by start) ---------- */
  S_.ulti = Object.assign({}, S_, {
    name: "Mutation", pop: 3050,   // the launch waits for the gold impact frame
    words: wordsU, cues: cuesU,
    start(g) { S_.start(g); ult = true; },
    // once the splash is in, the KO beam where the loser left the screen is cut short and its flying bits are gone; the real loser is no longer drawn
    after(t) { S_.after(t); if (t >= MT.SPLASH && t < MT.AFTER) { if (FIN.beam && FIN.beam.t0 > -1e5) FIN.beam.t0 = -1e6; FIN.parts.length = 0; } },
    drawLoser(c, pn, t) { if (t < MT.SPLASH) drawLoserFn(c, pn, t); },
    // the splatter goes onto the results only when the page got as far as the pop (a skip before it leaves them clean); on the next frame the results are up
    end() { const go = FIN.t >= FIN.hit; eyesS = []; if (go) requestAnimationFrame(stainStart); },
  });
  return S_;
})();
