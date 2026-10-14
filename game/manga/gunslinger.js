/* ===================== Manga page: Gunslinger, "High Noon" =====================
   Script for the engine in ui/manga.js (idea: overnight/fable-ideas.md section 5, in the grammar of finisher-films/fable-manga.md). Times are ms after the final hit.
   Accent: sunset red. Words: the hit's (BLAM / WHAK), DONG, BANG, fuu.
   300 the freeze (panel 1, engine); from 900 dust blows across the paper . 1250 panel 2 "the look": the town clock behind his hat, the minute hand ticks
   (1480) and hits twelve (1750, DONG): his eyes narrow in the shade of the brim, a glint; a tumbleweed rolls across the whole page (1350-2760)
   2000 inset: the loser's face seen down the barrel (the rifling turns, the opening closes, the pupils shrink) . 2350 panel 3 "the draw": a wide street,
   a huge sunset behind them, hands over the holsters, the tumbleweed rolls between them; 2780 the silence; 2900 the draw in one frame: impact frames,
   BANG, one smoking line through the loser, the loser's hat (or, bare-headed, its sprout) is shot off and floats down over the page while the loser
   flies out along the real launch direction . 3500 panel 4: he lifts the barrel to his mouth and blows the smoke off it (fuu), the hat lands on the page.
   Script fields: col, name, flight, panels(lay), words(lay), start(g), build(lay), step(t, k), pose(P, sk, t, role, p), over(o, t), cues(t),
   drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt(). Every helper of this page is prefixed gns.

   The Ultimate KO (MANGA.gunslinger.ulti, played when the lethal hit is the Dead Eye ulti: MG.ulti, the second MT table, see the end of the file): "Wanted".
   The same page to 2780, then six shots. 2900-3300 five fanned shots (the barrel steps -0.22 .. +0.22, a muzzle star and a smoking line each, a hole punched
   in the paper beside the loser, a flinch, a 2 px shake, BAM); 3280-3400 the drop (the hammer back, the barrel levels); 3400 the sixth, golden shot (three impact
   frames, BLAMM in gold); 3550 the loser is launched and the hat shot off; 3750 panel 5, a full-page splash from the top: the WANTED poster (aged paper, the
   loser's mono portrait, DEAD OR FRIED, REWARD: 1,000,000 FRIES, two nails, a torn bottom under a 70% screen); five bullet holes in the poster (3950-4350, the fan
   order) and a sixth gold-rimmed one through the portrait's forehead at 4450 (his eyes turn to X); 4700 panel 4 as on the normal page (MT.AFTER + offsets). */
MANGA.gunslinger = (function () {
  const COL = "#ff4636", HOT = "#fff3d6", INK = MG_INK, PAPER = MG_PAPER, TAU = Math.PI * 2, GOLD = MG_GOLD, GOLD_D = MG_GOLD_D;
  const TICK = 1480, DONG = 1750;
  // times that depend on the page in use (gnsMode): the lethal shot HIT, the end of its impact frames PH, the aftermath's beats (MT.AFTER is 3500 on the normal page, 4700 on the Ultimate's)
  let ULT = false, HIT = 2900, PH = 3000, RAISE = 3540, BLOW = 3800, LOWER = 4230, LAND = 4250;
  const SPLASH0 = 3750, FAN_A = [-0.22, -0.11, 0, 0.11, 0.22];   // the poster slides in at 3750; the barrel angle (+ = down) of the five fanned shots
  const fanT = (i) => MT.HIT + i * 100;   // the fan: 2900 3000 3100 3200 3300 (the sixth is HIT = 3400)
  function gnsMode(ult) {
    ULT = ult; HIT = ult ? 3400 : MT.HIT; PH = HIT + (ult ? 150 : 100);
    RAISE = MT.AFTER + 40; BLOW = MT.AFTER + 300; LOWER = MT.AFTER + 730; LAND = MT.AFTER + (ult ? 110 : 750);
  }
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  let dust = [], weed = null, hat = null, hatKind = "sprout", shotX0 = 0, shotY = -42;
  let fan = [], poster = null, posterStage = 0, gnsPort = 0, loserCopy = null;   // the Ultimate: the five shots' muzzles and holes, the poster (layout, lettering, portraits), the portrait pose switch

  /* ---- where things are (world units), from the puppets' own poses ---- */
  function gnsPt(p, t, key, dx, dy) {   // a point of the body (turned with the lean about the hip)
    MG.pt = t;
    const P = pose(p, mgTk(t)), q = rot([P[key][0] + (dx || 0), P[key][1] + (dy || 0)], P.hip, P.lean);
    return [p.x + p.facing * q[0], p.y + q[1]];
  }
  function gnsMuzzle(t) {   // the front pistol's muzzle (hands are not turned by the lean)
    MG.pt = t;
    const W = W_(), P = pose(W, mgTk(t)), m = gunMuzzle(P, P.hF, P.holdAng == null ? -0.3 : P.holdAng, false);
    return [W.x + W.facing * m[0], W.y + m[1]];
  }
  // the kick of the shot: the barrel is level on the shot frame, then jumps up and settles
  const gnsKick = (t) => easeOut(fe(HIT + 20, HIT + 70, t)) * (1 - ease(fe(HIT + 120, HIT + 520, t)));
  // the Ultimate's fan, t before HIT: [barrel angle, recoil 0..1, index of the latest shot, ms since it]. The barrel steps to the next angle just before each shot
  // (the last one levels in the silence of the drop, 3340-3395); a shot flips it up a little, back down before the next
  function gnsFanAim(t) {
    const i = clamp(Math.floor((t - MT.HIT) / 100), 0, 4), dt = t - fanT(i);
    const k = easeOut(fe(8, 34, dt)) * (1 - ease(fe(44, 96, dt))), ap = i < 4 ? ease(fe(50, 100, dt)) : ease(fe(40, 95, dt));
    return [lerp(FAN_A[i], i < 4 ? FAN_A[i + 1] : 0, ap) - 0.5 * k, k, i, dt];
  }
  // the front pistol after the draw: [barrel angle, recoil 0..1 (the arm jumps), frames since the shot while its flash shows (-1 = none)]
  function gnsAim(t) {
    if (ULT && t < HIT) { const [a, k, , dt] = gnsFanAim(t); return [a, k * 0.4, dt >= 0 && dt < 50 ? Math.floor(dt / FMS) : -1]; }
    const k = gnsKick(t);
    return [-k * 0.6, k, t < HIT + 50 ? Math.floor((t - HIT) / FMS) : -1];
  }
  const gnsFlinch = (t) => { if (!ULT) return 0; let f = 0; for (let i = 0; i < 5; i++) f = Math.max(f, Math.sin(Math.PI * fe(fanT(i), fanT(i) + 80, t))); return f; };   // the loser's 80 ms flinch at each fanned shot
  // the clock's minute hand: 11:58 at the look, 11:59 at TICK, twelve at DONG (each tick overshoots a little and springs back)
  const gnsJump = (t, t0) => (t < t0 ? 0 : easeOut(fe(t0, t0 + 60, t)) + 0.16 * Math.sin(Math.PI * fe(t0 + 60, t0 + 230, t)));
  const gnsMin = (t) => 58 + gnsJump(t, TICK) + gnsJump(t, DONG);
  // tone in panel coordinates (mgToneFill wants the css px of the screen)
  const gnsTone = (c, pn, poly, size, cover, drift) => mgToneFill(c, poly.map(([x, y]) => [x + pn.ox, y + pn.oy]), size, cover, drift);
  const gnsRng = (seed) => { const r = mgRng(Math.imul(seed + 1, 2654435761) >>> 0); r(); r(); return r; };
  const gnsDisc = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);

  /* ---- panels ---- */
  function panels(lay) {
    const port = lay.port, D = FIN.dir;
    gnsMode(ULT);
    return [
      { id: "look", t0: MT.LOOK, from: "w", freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0], [1, 0], [1, 0.39], [0, 0.42]] : [[0, 0], [0.45, 0], [0.41, 1], [0, 1]],
        // a taller page (1280x760) would crop the clock: widen the view to about 100 units and keep its top edge where it was
        cam: (t, pn) => { const v0 = port ? 103 : Math.max(103, 100 * pn.h / pn.w), vh = v0 * (1 - 0.07 * fe(MT.LOOK, MT.STRIKE, t)), z = pn.h / vh; return { wx: FIN.wx + D * (port ? 0.2 : 0.12) * pn.w / z, wy: port ? -57 : -53 - (v0 - 103) * 0.5 + (v0 - 103) * 0.35, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "l", slide: 140, freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0.47, 0.29], [0.98, 0.27], [0.98, 0.5], [0.45, 0.52]] : [[0.635, 0.05], [0.975, 0.02], [0.96, 0.47], [0.615, 0.5]],
        cam: (t) => { const h = gnsPt(L_(), Math.min(t, MT.STRIKE), "head"), tr = Math.sin(t * 0.026) * 0.12 * fe(MT.INSET, MT.INSET + 200, t); return { wx: h[0] + tr, wy: h[1] + 1, vh: 27 - 3 * fe(MT.INSET, MT.STRIKE, t) }; },
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.AFTER, cover: MT.AFTER,
        poly: port ? [[0, 0.38], [1, 0.41], [1, 0.74], [0, 0.72]] : [[0, 0.31], [1, 0.37], [1, 1], [0, 1]],
        cam: (t) => { const k = ease(fe(MT.STRIKE, HIT, t)), vh = (port ? 182 : 126) * (1 - 0.08 * k); return { wx: FIN.wx + D * 65, wy: -(port ? 0.34 : 0.3) * vh, vh }; },
        shake: (t) => {
          let a = 5 * fe(PH, PH + 30, t) * (1 - fe(PH + 30, PH + 320, t));
          if (ULT) for (let i = 0; i < 5; i++) a += 2 * fe(fanT(i), fanT(i) + 8, t) * (1 - fe(fanT(i) + 8, fanT(i) + 70, t));   // 2 px at each fanned shot
          return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a * 0.6] : [0, 0];
        },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b", live: true,
        poly: port ? [[0, 0.69], [1, 0.67], [1, 1], [0, 1]] : [[0, 0.43], [0.63, 0.4], [0.59, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 92 : 82) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + D * (port ? 12 : 26), wy: -47, vh }; },
        draw: drawAfter },
    ];
  }

  /* ---- panel 2: the look. The town clock behind his hat, the shade of the brim over his eyes ---- */
  function drawLook(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    // the sky: a light screen over the top, cut hard
    gnsTone(c, pn, [[pn.x0 - 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 - 4], [pn.x1 + 4, pn.y0 + pn.h * 0.44], [pn.x0 - 4, pn.y0 + pn.h * 0.5]], 8, 0.16, [t * 0.001, 0]);
    // the focus lines snap in when the clock strikes twelve
    const hd = pn.p(...gnsPt(W, t, "head")), fk = fe(DONG, DONG + 140, t);
    if (fk > 0) mgFocus(c, hd[0], hd[1], Math.hypot(pn.w, pn.h), t * 0.00035, 0.6 * fk);
    gnsClock(c, pn, t);
    mgPuppet(c, pn, W, t, { light: dirAng(-0.55), post: gnsBrim(W, t, 1) });
    pn.screen(c);
    // the glint in his eye at twelve
    const g = Math.sin(Math.PI * fe(DONG + 20, DONG + 340, t));
    if (g > 0.02) { MG.pt = t; const P = pose(W, mgTk(t)), e = pn.p(...gnsPt(W, t, "head", P.w * 0.13 + P.w * 0.04, -P.w * 0.03)); gnsStar(c, e[0], e[1], (5 + 9 * g) * pn.z / 3.6, "#ffffff"); }
    // the fingers twitch over the holster: three small marks by the hand, twice
    gnsTwitch(c, pn, W, t, 1950, 2300);
  }
  // the town clock: an ink rim, a paper face with hard shade, hour bars, XII, the hands; it shakes when it strikes, and rings
  function gnsClock(c, pn, t) {
    const D = FIN.dir, [cx, cy] = pn.p(FIN.wx + D * 36, -77), r = 21.5 * pn.z;
    const sh = t >= DONG && t < DONG + 200 ? Math.sin((t - DONG) * 0.11) * 1.8 * (1 - fe(DONG, DONG + 200, t)) : 0, x = cx + sh, y = cy;
    c.save();
    c.fillStyle = INK; c.beginPath(); c.arc(x, y, r * 1.15, 0, TAU); c.fill();
    c.fillStyle = PAPER; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();   // the shade: a 40% screen on the lower side, a 70% one at the rim
    gnsTone(c, pn, [[x - r * 1.3, y + r * 0.2 + D * r * 0.35], [x + r * 1.3, y + r * 0.2 - D * r * 0.35], [x + r * 1.3, y + r * 1.3], [x - r * 1.3, y + r * 1.3]], 8, 0.4);
    gnsTone(c, pn, [[x - r * 1.3, y + r * 0.66 + D * r * 0.3], [x + r * 1.3, y + r * 0.66 - D * r * 0.3], [x + r * 1.3, y + r * 1.3], [x - r * 1.3, y + r * 1.3]], 8, 0.7);
    c.restore();
    c.strokeStyle = INK; c.lineCap = "butt";
    c.lineWidth = Math.max(1.5, r * 0.045); c.beginPath(); c.arc(x, y, r * 0.84, 0, TAU); c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, big = i % 3 === 0;
      c.lineWidth = big ? r * 0.09 : r * 0.045; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86); c.lineTo(x + Math.cos(a) * r * (big ? 0.99 : 0.96), y + Math.sin(a) * r * (big ? 0.99 : 0.96)); c.stroke();
    }
    gnsXII(c, x, y - r * 0.6, r * 0.19);
    const m = gnsMin(t), am = -Math.PI / 2 + ((m - 60) / 60) * TAU, ah = -Math.PI / 2 + ((m - 60) / 720) * TAU;
    gnsHand(c, x, y, ah, r * 0.5, r * 0.12); gnsHand(c, x, y, am, r * 0.8, r * 0.075);
    c.fillStyle = INK; c.beginPath(); c.arc(x, y, r * 0.1, 0, TAU); c.fill(); c.fillStyle = PAPER; c.beginPath(); c.arc(x, y, r * 0.04, 0, TAU); c.fill();
    // it rings: arcs on either side, growing out and fading
    const k = fe(DONG, DONG + 520, t);
    if (k > 0 && k < 1) {
      c.lineCap = "round"; c.globalAlpha = 1 - k;
      for (const side of [0, Math.PI]) for (let j = 0; j < 3; j++) { const rr = r * (1.32 + 0.2 * j + 0.3 * easeOut(k)); c.lineWidth = Math.max(2, r * (0.07 - 0.015 * j)); c.beginPath(); c.arc(x, y, rr, side - 0.32 + j * 0.04, side + 0.32 - j * 0.04); c.stroke(); }
      c.globalAlpha = 1;
    }
    c.restore();
  }
  function gnsXII(c, x, y, s) {   // the numeral, drawn in strokes: X I I with a serif bar top and bottom
    c.save(); c.translate(x, y); c.strokeStyle = INK; c.lineCap = "butt"; c.lineWidth = s * 0.26;
    c.beginPath(); c.moveTo(-s * 1.05, -s * 0.6); c.lineTo(-s * 0.25, s * 0.6); c.moveTo(-s * 0.25, -s * 0.6); c.lineTo(-s * 1.05, s * 0.6);
    for (const ix of [0.25, 0.75]) { c.moveTo(s * ix, -s * 0.6); c.lineTo(s * ix, s * 0.6); }
    c.stroke();
    c.lineWidth = s * 0.14; c.beginPath(); c.moveTo(-s * 1.2, -s * 0.66); c.lineTo(s * 0.95, -s * 0.66); c.moveTo(-s * 1.2, s * 0.66); c.lineTo(s * 0.95, s * 0.66); c.stroke();
    c.restore();
  }
  function gnsHand(c, x, y, a, len, wd) {   // a clock hand: an ink spade, tapered to the tip
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    c.fillStyle = INK; c.beginPath();
    c.moveTo(x - ca * len * 0.16 + nx * wd * 0.5, y - sa * len * 0.16 + ny * wd * 0.5);
    c.lineTo(x + ca * len * 0.72 + nx * wd * 0.7, y + sa * len * 0.72 + ny * wd * 0.7); c.lineTo(x + ca * len, y + sa * len);
    c.lineTo(x + ca * len * 0.72 - nx * wd * 0.7, y + sa * len * 0.72 - ny * wd * 0.7);
    c.lineTo(x - ca * len * 0.16 - nx * wd * 0.5, y - sa * len * 0.16 - ny * wd * 0.5); c.closePath(); c.fill();
  }
  function gnsStar(c, x, y, s, fill) {   // a four-point glint with an ink edge
    c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.2, y - s * 0.2); c.lineTo(x + s, y); c.lineTo(x + s * 0.2, y + s * 0.2); c.lineTo(x, y + s); c.lineTo(x - s * 0.2, y + s * 0.2); c.lineTo(x - s, y); c.lineTo(x - s * 0.2, y - s * 0.2); c.closePath();
    c.fillStyle = fill; c.fill(); c.lineWidth = Math.max(1.4, s * 0.12); c.strokeStyle = INK; c.lineJoin = "miter"; c.stroke();
  }
  // the shade of the hat brim over the upper face: a 70% band under the brim, a 40% band over the upper half of the eyes (post hook, source-atop)
  function gnsBrim(p, t, a) {
    MG.pt = t;
    const P = pose(p, mgTk(t));
    return (lc, X) => {
      const band = (y0, y1) => [[-P.rx * 1.7, y0], [P.rx * 1.7, y0], [P.rx * 1.7, y1], [-P.rx * 1.7, y1]].map((q) => { const r = rot(q, P.hip, P.lean); return [X.sx + p.facing * r[0] * X.z, X.sy + r[1] * X.z]; });
      const tile = X.ze >= 2.2 ? 12 : 8;
      lc.globalAlpha = a;
      for (const [y0, y1, cover] of [[P.top + P.ry * 0.28, P.top + P.ry * 0.5, 0.7], [P.top + P.ry * 0.5, P.top + P.ry * 0.7, 0.4]]) { lc.fillStyle = mgTile(tile, cover); mgPoly(lc, band(y0, y1)); lc.fill(); }
      lc.globalAlpha = 1;
    };
  }
  // three short ink marks by the front hand: the fingers twitch (two pulses between t0 and t1)
  function gnsTwitch(c, pn, p, t, t0, t1) {
    if (t < t0 || t > t1) return;
    const u = fe(t0, t1, t), on = Math.max(Math.sin(Math.PI * fe(0, 0.45, u)), Math.sin(Math.PI * fe(0.55, 1, u)));
    if (on < 0.05) return;
    MG.pt = t;
    const P = pose(p, mgTk(t)), h = pn.p(p.x + p.facing * P.hF[0], p.y + P.hF[1]), z = pn.z, D = p.facing > 0 ? 1 : -1;
    c.save(); c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = Math.max(1.6, 0.55 * z);
    for (const a of [-0.75, -0.1, 0.55]) { const ca = Math.cos(a) * D, sa = Math.sin(a), r0 = 7 * z, r1 = r0 + 5.5 * z * on; c.beginPath(); c.moveTo(h[0] + ca * r0, h[1] + sa * r0); c.lineTo(h[0] + ca * r1, h[1] + sa * r1); c.stroke(); }
    c.restore();
  }

  /* ---- the inset: the loser's face seen down the barrel ---- */
  function drawInset(c, pn, t) {
    const Lp = L_(), u = fe(MT.INSET, MT.STRIKE, t), tt = Math.min(t, MT.STRIKE);
    pn.screen(c);
    const [hx, hy] = pn.p(...gnsPt(Lp, tt, "head"));
    mgFocus(c, hx, hy, Math.hypot(pn.w, pn.h) * 0.8, t * 0.0005, 0.5);
    mgPuppet(c, pn, Lp, tt, { light: Math.PI - dirAng(-0.6), tint: 0.5 });
    pn.screen(c);
    // the barrel: ink all round a round opening that closes a little; six grooves of rifling turn slowly in the ink
    const rh = Math.min(pn.w, pn.h) * 0.47 * (1.08 - 0.15 * ease(u)), R = Math.hypot(pn.w, pn.h);
    c.fillStyle = INK; c.beginPath(); c.rect(pn.x0 - 6, pn.y0 - 6, pn.w + 12, pn.h + 12); c.arc(hx, hy, rh, 0, TAU); c.fill("evenodd");
    c.save(); c.strokeStyle = "rgba(241,236,226,0.24)"; c.lineCap = "butt"; c.lineWidth = rh * 0.1;
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + t * 0.0005;
      c.beginPath();
      for (let s = 0; s <= 10; s++) { const rr = rh * 1.1 + (R * 0.6) * (s / 10), a = a0 + s * 0.16; s ? c.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr) : c.moveTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr); }
      c.stroke();
    }
    c.restore();
    c.lineWidth = 3.2; c.strokeStyle = PAPER; c.beginPath(); c.arc(hx, hy, rh + 2.2, 0, TAU); c.stroke();
    c.lineWidth = 1.6; c.strokeStyle = INK; c.beginPath(); c.arc(hx, hy, rh, 0, TAU); c.stroke();
  }

  /* ---- the street under the sunset (panels 3 and 4): sky tone, the sun cut by paper stripes, mesas, the ground ---- */
  function gnsStreet(c, pn, t, sunX, sunR, sink) {
    const D = FIN.dir, hz = pn.p(FIN.wx, -14)[1], gy = pn.p(FIN.wx, 0)[1];
    if (!MG.slow) gnsTone(c, pn, [[pn.x0 - 6, pn.y0 - 6], [pn.x1 + 6, pn.y0 - 6], [pn.x1 + 6, pn.y0 + pn.h * 0.13], [pn.x0 - 6, pn.y0 + pn.h * 0.17]], 7, 0.42, [t * 0.0008, 0]);
    if (!MG.slow) gnsTone(c, pn, [[pn.x0 - 6, pn.y0 + pn.h * 0.17], [pn.x1 + 6, pn.y0 + pn.h * 0.13], [pn.x1 + 6, pn.y0 + pn.h * 0.27], [pn.x0 - 6, pn.y0 + pn.h * 0.31]], 7, 0.18, [t * 0.0008, 0]);
    // the sun: a flat disc of the accent with an ink edge, sinking, cut by paper stripes that widen towards the horizon
    const [sx] = pn.p(sunX, 0), R = sunR * pn.z, sy = hz + R * (0.16 + sink);
    c.save(); c.beginPath(); c.rect(pn.x0 - 6, pn.y0 - 6, pn.w + 12, hz - pn.y0 + 6); c.clip();
    c.fillStyle = COL; c.beginPath(); c.arc(sx, sy, R, 0, TAU); c.fill();
    c.lineWidth = Math.max(2, R * 0.025); c.strokeStyle = INK; c.stroke();
    c.save(); c.beginPath(); c.arc(sx, sy, R + 3, 0, TAU); c.clip(); c.fillStyle = PAPER;
    for (let i = 0; i < 4; i++) { const yy = sy - R * 0.5 + i * R * 0.17, th = R * (0.022 + 0.022 * i); c.fillRect(sx - R - 4, yy, 2 * R + 8, th); }
    c.restore();
    c.restore();
    // mesas on the horizon: flat-topped shapes of tone with an ink edge
    for (const [a, b, h] of [[-250, -150, 24], [-128, -96, 11], [120, 175, 16], [190, 300, 30]]) {
      const x0 = sunX + D * a, x1 = sunX + D * b, top = -14 - h, pts = [[x0, -14], [x0 + D * h * 0.5, top + 3], [x0 + D * h * 0.62, top], [x1 - D * h * 0.5, top], [x1 - D * h * 0.3, top + 4], [x1, -14]].map(([x, y]) => pn.p(x, y));
      gnsTone(c, pn, pts, 6, 0.45);
      c.lineWidth = 2; c.strokeStyle = INK; c.lineJoin = "round"; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
    // the ground: paper under an ink horizon, dry-brush streaks of dust, a few pebbles
    c.fillStyle = PAPER; c.fillRect(pn.x0 - 6, hz, pn.w + 12, pn.y1 - hz + 6);
    c.fillStyle = INK; c.fillRect(pn.x0 - 6, hz - 1, pn.w + 12, 2.2);
    pn.world(c);
    c.lineCap = "round"; c.strokeStyle = INK;
    const rs = gnsRng(610);
    for (let i = 0; i < 16; i++) { const x = FIN.wx + D * (-260 + rs() * 620), y = -10 + rs() * 22, len = 14 + rs() * 50; c.lineWidth = 0.6 + rs() * 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + D * len, y + (rs() - 0.5) * 0.8); c.stroke(); }
    c.fillStyle = INK;
    for (let i = 0; i < 10; i++) { const x = FIN.wx + D * (-220 + rs() * 560), y = 2 + rs() * 14, r = rs; c.beginPath(); c.ellipse(x, y, 1 + r() * 1.4, 0.7 + r() * 0.6, 0, 0, TAU); c.fill(); }
    // short noon shadows under their feet
    for (const p of [W_(), L_()]) if (p.state !== "gone" && Math.abs(p.y) < 1) { c.beginPath(); c.ellipse(p.x, 1.2, p.s.w * 0.5, 2.6, 0, 0, TAU); c.fill(); }
    pn.screen(c);
    return gy;
  }

  /* ---- panel 3: the draw ---- */
  const loserAt = (tt) => { if (tt < FIN.launch) return [FIN.lx - (tt >= HIT ? FIN.dir * 5 : 0), 0]; const tr = finTrav((tt - FIN.launch) / FMS); return [FIN.lx + FIN.ldx * tr, FIN.ldy * tr]; };
  function drawStrike(c, pn, t) {
    const W = W_(), D = FIN.dir;
    if (ULT && !MG.reduced && t >= HIT && t < PH) return;   // the three impact frames cover the whole page: nothing of the panel shows, so nothing is drawn
    pn.screen(c);
    gnsStreet(c, pn, t, FIN.wx + D * 65, 70, 0.1 * fe(MT.STRIKE, MT.AFTER, t));
    if (ULT) gnsFanHoles(c, pn, t);
    gnsDrawArc(c, pn, t);
    mgPuppet(c, pn, W, t, { light: dirAng(-0.45), post: gnsBrim(W, t, 0.8) });
    gnsTwitch(c, pn, W, t, 2480, 2760);
    if (ULT) gnsFanLines(c, pn, t);
    gnsShotLine(c, pn, t);
    if (!MG.broke) drawLoserFn(c, pn, t);
    pn.screen(c);
    // where the bullet hit: a white burst with an ink edge, after the impact frames
    const hb = fe(PH, PH + 180, t);
    if (hb > 0 && hb < 1) { const q = pn.p(FIN.lx - D * 6, shotY); mgStarburst(c, q[0], q[1], (34 - 26 * hb) * pn.z / 1.7, 0.3); }
    gnsMuzzleFx(c, pn, t);
  }
  // the draw happened between two frames: a tapered ink stroke along the path of the gun, from the hip up to the aim, left behind for a moment
  // (the Ultimate: at the first of the five shots, up to the first aim)
  function gnsDrawArc(c, pn, t) {
    const t0 = ULT ? MT.HIT + 20 : PH, k = fe(t0, t0 + 230, t);
    if (t < t0 || k >= 1) return;
    const W = W_(), D = FIN.dir, sk = { w: W.s.w, leg: W.s.h * W.spec.look.leg, tor: W.s.h * W.spec.look.torso };
    const a = [W.x + D * (sk.w * 0.9 + 6), -sk.leg + 8], b = gnsMuzzle(ULT ? fanT(0) : HIT), m = [W.x + D * sk.w * 1.5, (a[1] + b[1]) * 0.5 + 6];
    const pts = qpts(a, m, b, 14);
    pn.world(c); c.save(); c.globalAlpha = 1 - k;
    c.fillStyle = INK; brush(c, pts, 7.5, 14);
    c.fillStyle = PAPER; brush(c, pts.map(([x, y]) => [x - D * 0.6, y + 0.4]), 2.6, 14);
    c.restore();
  }
  // one smoking line: from the muzzle through the loser to the edge, ink with a hot core; it fades from the muzzle outward while smoke curls off it
  function gnsShotLine(c, pn, t) {
    if (t < PH || t > PH + 500) return;
    const D = FIN.dir, len = 720, gone = ease(fe(PH + 150, PH + 480, t)), xs = shotX0 + D * len * gone, xe = shotX0 + D * len, y = shotY;
    pn.world(c);
    c.lineCap = "butt";
    c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath(); c.moveTo(xs, y); c.lineTo(xe, y); c.stroke();
    c.strokeStyle = COL; c.lineWidth = 1.5; c.stroke();
    pn.screen(c);
    for (let i = 0; i < 10; i++) {   // the smoke: small puffs of tone rising off the line, born a little after one another
      const r = gnsRng(80 + i), x = shotX0 + D * (14 + i * 30 + r() * 12), age = t - (PH + 10 + i * 22);
      if (age <= 0 || (x - xs) * D < -40) continue;
      const k = clamp(age / 520, 0, 1), a = 1 - fe(0.55, 1, k);
      if (a <= 0) continue;
      const q = pn.p(x + Math.sin(age * 0.006 + i) * 3, y - 3 - age * 0.022 * (0.7 + r() * 0.6));
      gnsPuff(c, pn, q[0], q[1], (2.5 + 5.5 * easeOut(k)) * pn.z, a, 80 + i);
    }
  }
  // the muzzle after the shot: a flash in the accent, then smoke rising off the barrel until the panel freezes
  function gnsMuzzleFx(c, pn, t) {
    if (ULT) gnsFanMuzzleFx(c, pn, t);
    if (t < PH) return;
    const m = pn.p(...gnsMuzzle(t)), z = pn.z, D = FIN.dir;
    const f = 1 - fe(PH, PH + 100, t);
    if (f > 0) { c.save(); c.translate(m[0] + D * 5 * z, m[1]); c.scale(D, 1); gnsFlash(c, (10 + 8 * f) * z, f); c.restore(); }
    for (let i = 0; i < 6; i++) {
      const born = PH + 10 + i * 75, age = t - born;
      if (age <= 0) continue;
      const k = clamp(age / 650, 0, 1), a = 1 - fe(0.5, 1, k), b = pn.p(...gnsMuzzle(born));
      if (a <= 0) continue;
      gnsPuff(c, pn, b[0] + Math.sin(age * 0.005 + i * 2) * 4 * z + D * 2 * z, b[1] - age * 0.03 * z, (2.4 + 5 * easeOut(k)) * z, a, 40 + i);
    }
  }
  function gnsFlash(c, s, a) {   // an eight-point star: ink edge, accent body, hot core (local x along the barrel)
    c.globalAlpha = Math.min(1, a * 1.6);
    const star = (r0, r1) => { c.beginPath(); for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU, rr = i % 2 ? r1 : i % 4 === 0 ? r0 : r0 * 0.62; i ? c.lineTo(Math.cos(an) * rr * (Math.cos(an) > 0 ? 1.5 : 0.8), Math.sin(an) * rr) : c.moveTo(rr * 1.5, 0); } c.closePath(); };
    star(s, s * 0.3); c.fillStyle = INK; c.fill();
    star(s * 0.8, s * 0.22); c.fillStyle = COL; c.fill();
    star(s * 0.45, s * 0.14); c.fillStyle = HOT; c.fill();
    c.globalAlpha = 1;
  }
  /* ---- the Ultimate: five fanned shots, a hole punched in the paper by each ---- */
  // a hole through the paper at (x, y) in the units of the current transform (r its radius), `age` ms old: the paper torn up in a ragged white chip with an ink edge, the dark
  // opening, flecks flying out for 170 ms; o.cracks: three cracks run out of it (the poster); o.gold: the sixth hole, a gold chip with a dark-gold ring
  function gnsHole(c, x, y, r, age, o) {
    if (age < 0) return;
    o = o || {};
    const pop = easeOut(fe(0, 70, age)), s = r * (0.5 + 0.5 * pop), lw = Math.max(0.5, r * 0.16), rn = gnsRng(o.seed || 5);
    c.save(); c.translate(x, y); c.lineJoin = "miter"; c.lineCap = "round";
    c.beginPath();
    for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU + rn() * 0.3, rr = (i % 2 ? 1.2 : 1.8 + rn() * 0.7) * s; i ? c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : c.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    c.closePath(); c.fillStyle = o.gold ? GOLD : o.chip || "#ffffff"; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, 0, s, 0, TAU); c.fillStyle = INK; c.fill();
    if (o.gold) { c.lineWidth = lw * 1.7; c.strokeStyle = GOLD_D; c.beginPath(); c.arc(0, 0, s * 1.14, 0, TAU); c.stroke(); }
    c.beginPath(); c.arc(-s * 0.2, -s * 0.2, s * 0.52, Math.PI * 0.95, Math.PI * 1.65); c.lineWidth = lw * 0.85; c.strokeStyle = o.chip || PAPER; c.stroke();   // a sliver of light through it
    const fk = fe(0, 170, age);
    if (fk < 1) for (let i = 0; i < 6; i++) {
      const an = rn() * TAU, d = r * (1.7 + 3 * easeOut(fk)) * (0.75 + rn() * 0.5), q = r * (0.2 + rn() * 0.16);
      c.save(); c.translate(Math.cos(an) * d, Math.sin(an) * d); c.rotate(an * 3); c.globalAlpha = 1 - fk;
      c.fillStyle = i % 2 ? INK : o.chip || "#ffffff"; c.lineWidth = lw * 0.5; c.strokeStyle = INK; c.fillRect(-q, -q * 0.6, q * 2, q * 1.2); c.strokeRect(-q, -q * 0.6, q * 2, q * 1.2);
      c.restore();
    }
    if (o.cracks) {   // three cracks, each with a kink, growing out in 90 ms
      const ck = easeOut(fe(10, 100, age));
      c.strokeStyle = INK; c.lineWidth = lw * 0.8; c.beginPath();
      for (let i = 0; i < 3; i++) {
        const an = (i / 3) * TAU + 0.5 + rn() * 0.9, l0 = r * (2.2 + rn() * 0.8) * ck, l1 = r * (3.4 + rn() * 1.4) * ck, kn = (rn() - 0.5) * 1.1;
        c.moveTo(Math.cos(an) * s * 1.2, Math.sin(an) * s * 1.2); c.lineTo(Math.cos(an) * l0, Math.sin(an) * l0); c.lineTo(Math.cos(an + kn) * l1, Math.sin(an + kn) * l1);
      }
      c.stroke();
    }
    c.restore();
  }
  // where each fanned shot starts (the muzzle at its moment) and where it ends: past the loser, on the paper beside him, the bullet's own line out to that column
  function gnsFanBuild() {
    const D = FIN.dir, Lp = L_();
    fan = FAN_A.map((a, i) => {
      const m = gnsMuzzle(fanT(i)), xh = FIN.lx + D * (Lp.s.w * 0.5 + 14 + [3, -1, 5, -2, 2][i]);
      return { m, hole: [xh, m[1] + D * (xh - m[0]) * Math.tan(a)] };
    });
  }
  function gnsFanHoles(c, pn, t) {
    let on = false;
    for (let i = 0; i < 5; i++) if (t >= fanT(i) + 40) { if (!on) { pn.world(c); on = true; } gnsHole(c, fan[i].hole[0], fan[i].hole[1], 6, t - fanT(i) - 40, { seed: 20 + i }); }
    if (on) pn.screen(c);
  }
  // each shot's smoking line, muzzle to hole: it flies there in 40 ms, then rubs out from the muzzle end; two small puffs of smoke at the barrel
  function gnsFanLines(c, pn, t) {
    const D = FIN.dir, z = pn.z;
    for (let i = 0; i < 5; i++) {
      const dt = t - fanT(i);
      if (dt < 0 || dt > 520) continue;
      const f = fan[i];
      if (dt < 360) {
        const e = lerp2(f.m, f.hole, easeOut(fe(0, 40, dt))), s = lerp2(f.m, f.hole, ease(fe(110, 360, dt)));
        pn.world(c); c.lineCap = "butt";
        c.strokeStyle = INK; c.lineWidth = 2.8; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(e[0], e[1]); c.stroke();
        c.strokeStyle = COL; c.lineWidth = 1.2; c.stroke();
      }
      pn.screen(c);
      for (let j = 0; j < (MG.slow ? 1 : 2); j++) {
        const age = dt - 15 - j * 35, k = clamp(age / 480, 0, 1), a = 1 - fe(0.5, 1, k);
        if (age <= 0 || a <= 0) continue;
        const q = pn.p(f.m[0] + D * (3 + 5 * j), f.m[1]);
        gnsPuff(c, pn, q[0] + Math.sin(age * 0.006 + i + j) * 2.5 * z, q[1] - age * 0.032 * z, (2 + 4 * easeOut(k)) * z, a, 140 + i * 2 + j);
      }
    }
  }
  // the star at the muzzle on each shot, turned with the barrel
  function gnsFanMuzzleFx(c, pn, t) {
    if (t < MT.HIT || t >= HIT) return;
    const dt = t - fanT(clamp(Math.floor((t - MT.HIT) / 100), 0, 4)), f = 1 - fe(12, 80, dt);
    if (f <= 0) return;
    const m = pn.p(...gnsMuzzle(t)), z = pn.z, D = FIN.dir;
    c.save(); c.translate(m[0] + D * 5 * z, m[1]); c.scale(D, 1); c.rotate(gnsAim(t)[0]); gnsFlash(c, (8 + 7 * f) * z, f); c.restore();
  }
  // a puff of smoke: a little cloud of three or four discs, one ink outline round all of them, paper and dot tone inside (panel coordinates).
  // It thins out by shrinking, so the overlapping discs never show their seams.
  function gnsPuff(c, pn, x, y, r, a, seed) {
    r *= Math.min(1, a * 1.5);
    if (r < 1.2) return;
    const rn = gnsRng(seed || 7), lobes = [[0, 0, 1]];
    for (let i = 0; i < 3; i++) { const an = rn() * TAU; lobes.push([Math.cos(an) * r * 0.62, Math.sin(an) * r * 0.5 - r * 0.15, 0.55 + rn() * 0.25]); }
    const lw = Math.max(1.3, r * 0.13);
    c.fillStyle = INK; for (const [dx, dy, k] of lobes) { c.beginPath(); c.arc(x + dx, y + dy, r * k + lw, 0, TAU); c.fill(); }
    c.fillStyle = PAPER; for (const [dx, dy, k] of lobes) { c.beginPath(); c.arc(x + dx, y + dy, r * k, 0, TAU); c.fill(); }
    gnsTone(c, pn, gnsDisc(x + r * 0.2, y + r * 0.25, r * 0.85, 12), 6, 0.4);
  }

  /* ---- the loser: terror, the white freeze of the hit, then out along the real launch direction with three ghosts ---- */
  function drawLoserFn(c, pn, t) {
    const Lp = L_();
    if (FIN.out || Lp.state === "gone") return;
    const fl = t >= FIN.launch;
    let ghosts = null;
    if (fl && !MG.slow) { const b = pn.p(...loserAt(t)); ghosts = [70, 46, 23].map((dt) => { const a = pn.p(...loserAt(t - dt)); return [a[0] - b[0], a[1] - b[1], 0.26 - dt * 0.0026]; }); }
    mgPuppet(c, pn, Lp, t, { light: Math.PI - dirAng(-0.45), free: MG.broke, halo: fl ? 3 : 0, ghosts, flash: Lp.flash > 0 });
  }

  /* ---- panel 4: he blows the smoke off the barrel ---- */
  function drawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    gnsStreet(c, pn, t, FIN.wx + D * 52, 50, 0.2 + 0.12 * fe(MT.AFTER, MT.END, t));
    mgPuppet(c, pn, W, t, { light: dirAng(-0.45), post: gnsBrim(W, t, 0.8) });
    pn.screen(c);
    gnsWisp(c, pn, t);
  }
  // the smoke off the barrel: a thin curl of tone with an ink edge; when he blows it bends away from his mouth and tears into puffs
  function gnsWisp(c, pn, t) {
    const z = pn.z, D = FIN.dir, m = pn.p(...gnsMuzzle(t)), mo = pn.p(...gnsPt(W_(), t, "mouthPt"));
    let bx = m[0] - mo[0], by = m[1] - mo[1]; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    const blow = ease(fe(BLOW, BLOW + 240, t)), grow = 0.45 + 0.55 * easeOut(fe(MT.AFTER, RAISE + 260, t)), fade = 1 - fe(BLOW + 200, BLOW + 700, t);
    if (fade <= 0) return;
    const n = 12, pts = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n, sw = Math.sin(s * 5.2 - t * 0.004) * 3.2 * s * z;
      pts.push([m[0] + sw + bx * blow * 30 * s * z, m[1] - s * 46 * grow * z * (1 - 0.55 * blow) + by * blow * 30 * s * z]);
    }
    const keep = Math.max(1, Math.round(n * (1 - 0.8 * blow)));
    const L = [], R = [];
    for (let i = 0; i <= keep; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(keep, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const wd = (1.4 + 4.6 * (i / n)) * z * 0.5;
      L.push([pts[i][0] - dy * wd, pts[i][1] + dx * wd]); R.push([pts[i][0] + dy * wd, pts[i][1] - dx * wd]);
    }
    const poly = L.concat(R.reverse());
    c.save(); c.globalAlpha = fade;
    gnsTone(c, pn, poly, 6, 0.5);
    c.lineWidth = Math.max(1.4, 0.5 * z); c.strokeStyle = INK; c.lineJoin = "round"; mgPoly(c, poly); c.stroke();
    c.restore();
    // the torn-off part: puffs drifting on along the breath
    if (blow > 0) for (let i = 0; i < 4; i++) {
      const s = 0.35 + i * 0.2, p = pts[Math.min(n, Math.round(s * n))], dr = (t - BLOW) * 0.045 * z * (0.6 + 0.2 * i);
      gnsPuff(c, pn, p[0] + bx * dr, p[1] + by * dr - (t - BLOW) * 0.008 * z, (2.5 + 1.2 * i + 3 * blow) * z * 0.7, fade * (1 - fe(BLOW + 300 + i * 60, BLOW + 700, t)), 120 + i);
    }
  }

  /* ---- over the whole page: blowing dust, the tumbleweed, the loser's speed lines, the hat floating down ---- */
  const gnsClockT = (t) => t - Math.min(MT.HIT - MT.DROP, Math.max(0, t - MT.DROP));   // the dust holds in the silence before the shot
  function gnsDust(o, t) {
    if (t < 900 || t > (ULT ? SPLASH0 + 60 : MT.FADE + 100)) return;   // (the Ultimate: gone as the poster comes in)
    const D = FIN.dir, u = (gnsClockT(t) - 900) / 1000, a = fe(900, 1200, t) * (ULT ? 1 - fe(SPLASH0 - 200, SPLASH0 + 60, t) : 1), gw = L.gw + 40;
    o.save(); o.globalAlpha = 0.6 * a; o.fillStyle = INK; o.strokeStyle = INK; o.lineCap = "round";
    for (const d of dust) {
      const x = (((d.x + D * d.v * u) % gw) + gw) % gw - 20, y = d.y + Math.sin(u * 2 + d.ph) * 6;
      if (d.dash) { o.lineWidth = d.s; o.beginPath(); o.moveTo(x, y); o.lineTo(x - D * d.dash, y + 0.5); o.stroke(); }
      else { o.beginPath(); o.arc(x, y, d.s, 0, TAU); o.fill(); }
    }
    o.restore();
  }
  // the tumbleweed: a ball of scribbled ink arcs over paper, drawn once; it rolls along the bottom edge of the page, and from panel 3 on along its street,
  // slowly at first, then a gust takes it between the two and out before the silence
  function gnsWeedSprite() {
    const R = 28, S = Math.ceil((R * 2 + 10) * DPR), cv_ = mgCanvas(S, S), x = cv_.getContext("2d"), r = mgRng(1881);
    x.scale(DPR, DPR); x.translate(R + 5, R + 5); x.strokeStyle = INK; x.lineCap = "round";
    x.fillStyle = PAPER; x.beginPath(); x.arc(0, 0, R * 0.86, 0, TAU); x.fill();
    for (let i = 0; i < 26; i++) {
      const rr = R * (0.35 + r() * 0.62), ox = (r() - 0.5) * R * 0.5, oy = (r() - 0.5) * R * 0.5, a0 = r() * TAU;
      x.lineWidth = 1 + r() * 1.5; x.beginPath(); x.ellipse(ox, oy, rr, rr * (0.55 + r() * 0.4), r() * Math.PI, a0, a0 + 1.4 + r() * 2.2); x.stroke();
    }
    x.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { const a = r() * TAU, r0 = R * (0.75 + r() * 0.15); x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a + 0.25) * R * 1.08, Math.sin(a + 0.25) * R * 1.08); x.stroke(); }
    return { cv: cv_, R, S: S / DPR };
  }
  const gnsWeedX = (t) => Math.pow(fe(1450, 2860, t), 1.35);   // share of the way across: a steady roll that picks up a little in the gust
  function gnsWeed(o, t) {
    if (t < 1450 || t > 2860 || !MG.byId.strike) return;
    if (!weed) weed = gnsWeedSprite();
    const pn = MG.byId.strike, D = FIN.dir, z = Math.max(1.3, pn.z), rr = 15 * z, span = L.gw + rr * 4, d = span * gnsWeedX(t);
    const xs = D > 0 ? -rr * 2 + d : L.gw + rr * 2 - d;
    const street = pn.p(FIN.wx, 0)[1] + pn.oy, edge = L.gh - MG.m - 2, gy = edge + (street - edge) * ease(fe(MT.STRIKE, MT.STRIKE + 160, t));
    const hop = Math.abs(Math.sin(d / (rr * 4.2))) * rr * (0.5 + 0.6 * fe(2300, 2500, t));
    o.save(); o.translate(xs, gy - rr - hop); o.rotate(D * d / rr); const s = rr / weed.R;
    o.drawImage(weed.cv, -weed.S / 2 * s, -weed.S / 2 * s, weed.S * s, weed.S * s);
    o.restore();
  }
  // the loser's hat (its sprout when it has no hat): shot off at the launch, it pops up with a flip, then rocks down like a leaf onto the bottom of the page
  function gnsHatAt(t) {
    if (!hat) return null;
    const D = FIN.dir, u = t - hat.t0, pop = easeOut(fe(0, 300, u)), f = fe(300, LAND - hat.t0, u), ph = Math.max(0, u - 300) * (TAU / 980);
    const env = Math.sin(Math.PI * Math.min(1, f * 1.15)) * (1 - fe(0.85, 1, f)), yTop = hat.y - 70;
    const yEnd = L.gh - MG.m - hat.foot * hat.s * 1.3;
    let x = hat.x + D * 26 * pop - D * 34 * f + Math.sin(ph) * 46 * env, y = u < 300 ? hat.y - 70 * pop : yTop + (yEnd - yTop) * f + Math.cos(ph * 2) * 4 * env;
    // the Ultimate: it lands on the poster, in the strip of paper beside the portrait
    if (ULT) x = hat.x + D * 26 * pop + (hat.xl - hat.x - D * 26) * ease(fe(0, 0.55, f)) + Math.sin(ph) * 22 * env;
    let a = -D * TAU * easeOut(fe(0, 420, u)) + 0.42 * Math.cos(ph) * env, s = hat.s * (ULT ? 0.66 + 0.07 * f : 1 + 0.3 * f), sq = 1;   // (the Ultimate's is smaller: it has to fit the strip of paper beside the portrait)
    if (t >= LAND) { y = yEnd; a = D * 0.07; const b = fe(LAND, LAND + 220, t); sq = 1 - 0.12 * Math.sin(Math.PI * b); }
    return { x, y, a, s, sq };
  }
  function gnsHat(o, t) {
    const h = gnsHatAt(t);
    if (!h) return;
    const Lp = L_();
    MG.pt = hat.t0 - 1;
    const P = pose(Lp, mgTk(hat.t0 - 1));
    o.save(); o.translate(h.x, h.y); o.rotate(h.a); o.scale(h.s * (Lp.facing < 0 ? -1 : 1), h.s * h.sq);
    MG.tintK = 0.5; mgInkOn(o, clamp(10 / (2.5 * h.s), 1, 2.2));
    try {
      if (hatKind === "cowboy") { o.translate(-P.rx * 0.08, -(P.top + P.ry * 0.3)); cowboyHat(o, P, Lp.pal); }
      else if (hatKind === "wizard") { o.translate(0, -(P.top + P.ry * 0.22)); wizardHat(o, P, Lp.pal, mgTk(hat.t0)); }
      else { o.scale(1.3, 1.3); sprout(o, 0, -2, 1); }
    } finally { mgInkOff(o); }
    o.restore();
    // it lands: a little puff of dust either side
    const k = fe(LAND, LAND + 380, t);
    if (k > 0 && k < 1) {
      o.save(); o.globalAlpha = 1 - k; o.strokeStyle = INK; o.lineCap = "round"; o.lineWidth = 2;
      for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { const r0 = h.s * (18 + 10 * easeOut(k)) + j * 3, a = Math.PI + (sd > 0 ? 0.25 + j * 0.3 : -0.25 - j * 0.3); o.beginPath(); o.moveTo(h.x + sd * r0, h.y); o.lineTo(h.x + sd * (r0 + 6 + 4 * k), h.y - 3 - j * 3); o.stroke(); }
      o.restore();
    }
  }
  function gnsHatStart(t) {   // where the hat sits on the loser's head the moment it is shot off (css px of panel 3), and how big
    const Lp = L_(), pn = MG.byId.strike, tt = FIN.launch - 1;
    MG.pt = tt;
    const P = pose(Lp, mgTk(tt)), lx = FIN.lx - FIN.dir * 5;
    const q = rot([P.rx * 0.08, hatKind === "sprout" ? P.top + 1 : P.top + P.ry * (hatKind === "wizard" ? 0.22 : 0.3)], P.hip, P.lean), s = pn.sp(lx + Lp.facing * q[0], q[1]);
    hat = { t0: FIN.launch, x: s[0], y: s[1], s: pn.z * (pn.z < 1.6 ? 1.15 : 1), foot: hatKind === "sprout" ? 2.6 : P.ry * 0.22, xl: L.gw * (FIN.dir > 0 ? (L.portrait ? 0.9 : 0.93) : (L.portrait ? 0.1 : 0.07)) };
  }

  /* ---- the Ultimate's panel 5: the WANTED poster (a full-page splash, slides in from the top at 3750) ---- */
  const HOLE_T = [3950, 4050, 4150, 4250, 4350], GOLD_T = 4450;   // the five bullet holes in the fan order, then the gold-rimmed one through the forehead
  const gnsPosterShake = (t) => {
    let a = 0;
    for (const h of HOLE_T) a += 2 * fe(h, h + 8, t) * (1 - fe(h + 8, h + 70, t));
    a += 3 * fe(GOLD_T, GOLD_T + 8, t) * (1 - fe(GOLD_T + 8, GOLD_T + 90, t));
    return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a * 0.6] : [0, 0];
  };
  function panelsU(lay) {
    const ps = panels(lay);   // look, inset, strike, after (gnsMode has already put the Ultimate's times in)
    // the engine's splash hook: a full-page panel, opaque (once it is in, the panels below it are no longer drawn), frozen at MT.AFTER; the poster comes in at 3750, not at MT.SPLASH
    ps.splice(ps.findIndex((p) => p.id === "after"), 0, mgSplashPanel({ id: "wanted", t0: SPLASH0, from: "t", paper: "#e9d9a8", shake: gnsPosterShake, draw: drawWanted }));
    return ps;
  }
  // the poster is built in three small steps while the first panels play (layout and lettering, then the two portraits), never on the frame it slides in
  function gnsPosterStep(t) {
    if (posterStage === 0 && t > 1400) { poster = gnsPosterLayout(); posterStage = 1; }
    else if (posterStage === 1 && t > 1500) { poster.p1 = gnsPortrait(poster, 1); posterStage = 2; }
    else if (posterStage === 2 && t > 1600) { poster.p2 = gnsPortrait(poster, 2); posterStage = 3; }
  }
  function gnsPosterCatchUp() { while (posterStage < 3) gnsPosterStep(1e9); }
  // solid poster letters: ink, a hair of ink edge, an offset ghost (the misprint) in o.ghost; set on a slight arc, each letter nudged, like the page's words (mgWord)
  function gnsLetters(text, o) {
    const D = DPR, size = o.size, font = `900 italic ${size}px "Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    const m = mgCanvas(4, 4).getContext("2d"); m.font = font;
    const chars = [...text], sp = size * (o.space === undefined ? 0.05 : o.space), adv = chars.map((ch) => m.measureText(ch).width + sp), tw = adv.reduce((a, b) => a + b, 0), R = tw * (o.arc || 20);
    const cw = tw + size * 0.7, ch = size * 1.5, cvs = mgCanvas(cw * D, ch * D), x = cvs.getContext("2d"), rnd = mgRng(o.seed || 3);
    x.scale(D, D); x.translate(cw / 2, ch / 2); x.font = font; x.textAlign = "center"; x.textBaseline = "alphabetic"; x.lineJoin = "round";
    let s = -tw / 2;
    chars.forEach((chr, i) => {
      const mid = s + adv[i] / 2, th = mid / R; s += adv[i];
      x.save(); x.translate(R * Math.sin(th), R * (1 - Math.cos(th)) + (rnd() - 0.5) * 0.08 * size + size * 0.28); x.rotate(th + (rnd() - 0.5) * (o.jit || 0.08));
      if (o.ghost) { x.fillStyle = o.ghost; x.fillText(chr, size * 0.045, size * 0.045); }
      x.lineWidth = size * (o.edge || 0.03); x.strokeStyle = INK; x.strokeText(chr, 0, 0);
      x.fillStyle = INK; x.fillText(chr, 0, 0);
      x.restore();
    });
    return { cv: cvs, w: cw, h: ch, vw: cw - size * 0.6, vis: size * 0.78 };
  }
  function gnsPosterLayout() {
    const pg = MG.page, D = FIN.dir, port = L.portrait, gw = L.gw, gh = L.gh, base = Math.min(gw, gh), mulW = port ? 0.5 : 1, rn = gnsRng(4711);
    const sx = (u) => pg.x + (D > 0 ? u : 1 - u) * pg.w;   // x at a share of the page width counted from the winner's side
    const sz = (v) => Math.round(v * gh * mulW);
    // the column the text and the portrait sit in: on the wide page clear of panel 4 (the lower left) and with a strip of paper beside it for the hat; upright: the whole width
    const cx = port ? pg.x + pg.w / 2 : sx(0.74), colW = port ? pg.w * 0.96 : pg.w * 0.34;
    // the lettering: panel 1's words (ink stroke, offset print) for the gold line; solid black letters for the title and the small type (an ink fill inside the words' ink stroke would be a black blob);
    // a line wider than the column is set again, smaller
    const word = (make, txt, v, o) => {
      o = Object.assign({ jit: 0.08 }, o);
      let w = make(txt, Object.assign({ size: sz(v) }, o));
      if (w.vw > colW) w = make(txt, Object.assign({}, o, { size: Math.round(sz(v) * colW / w.vw) }));
      return w;
    };
    const mw = (txt, o) => { const w = mgWord(txt, o); w.vw = w.w - o.size * 0.9; w.vis = w.h / 1.9 * 0.86; return w; };
    const title = word(gnsLetters, "WANTED", 0.17, { seed: 29, arc: 20, ghost: GOLD_D, edge: 0.03 }), dead = word(mw, "DEAD OR FRIED", 0.09, { seed: 31, arc: 24, fill: GOLD });
    const rew = word(gnsLetters, "REWARD: 1,000,000 FRIES", 0.06, { seed: 37, arc: 30, space: 0.03, edge: 0.012 });
    const hv = (w) => w.vis;   // the visible height of a line of lettering
    const bandH = pg.h * (port ? 0.045 : 0.075), gap = base * 0.013, top = pg.y + Math.max(5, base * 0.016);
    const bottomLim = port ? pg.y + pg.h * 0.635 : pg.y + pg.h - bandH - base * 0.012;
    let fw = port ? Math.min(gw * 0.8, gh * 0.36) : Math.min(gw * 0.46, gh * 0.5);
    const room = bottomLim - top - hv(title) - hv(dead) - hv(rew) - gap * 4.5;
    let fh = Math.min(fw * (port ? 1.3 : 1.15), room);
    fw = Math.min(fw, fh * 1.3);
    const used = hv(title) + fh + hv(dead) + hv(rew) + gap * 4.5, lift = Math.max(0, (bottomLim - top - used) * 0.4);   // spare room: a share of it above, the rest between the lines
    const tY = top + lift + hv(title) / 2, fy0 = top + lift + hv(title) + gap, dY = fy0 + fh + gap * 1.5 + hv(dead) / 2, rY = dY + hv(dead) / 2 + gap + hv(rew) / 2;
    const fx0 = cx - fw / 2, hr = Math.max(6, base * 0.02), Y = { cx, fw, fh, fx0, fy0, tY, dY, rY, title, dead, rew, hr, vh: 40, port };
    // the holes beside the head (fan order from the top), mirrored with the winner's side; the gold one goes through the forehead (set when the portrait is made)
    const hxs = [0.8, 0.87, 0.9, 0.87, 0.8], side = D > 0 ? 1 : -1;
    Y.holes = hxs.map((u, i) => [fx0 + fw * (side > 0 ? u : 1 - u), fy0 + fh * (0.13 + i * 0.185)]);
    // the torn bottom: a ragged edge under a 70% screen, with an ink line along it
    const by = pg.y + pg.h - bandH, edge = [];
    for (let x = pg.x - 6; x < pg.x + pg.w + 16; x += 14 + rn() * 8) edge.push([Math.min(x, pg.x + pg.w + 6), by + (rn() - 0.5) * bandH * 0.55 + (edge.length % 2 ? 3 : -3)]);
    Y.edge = edge; Y.band = edge.concat([[pg.x + pg.w + 30, pg.y + pg.h + 30], [pg.x - 30, pg.y + pg.h + 30]]);   // (a margin the push cannot pull into view)
    // fine print: rows of short grey bars (the small type of the poster) where there is room, and on the wide page a printed sheriff's badge on the left
    const prints = [], rows = (x0, x1, y0, y1) => { for (let y = y0; y + 3 < y1; y += 9.5) { let x = x0; while (x < x1 - 14) { const w = Math.min(x1 - x, 14 + rn() * 34); prints.push([x, y, w]); x += w + 5 + rn() * 4; if (rn() < 0.12) x += 24; } } };
    if (port) rows(pg.x + pg.w * 0.07, pg.x + pg.w * 0.93, rY + hv(rew) / 2 + gap * 2, bottomLim);
    else { rows(sx(0.05), sx(0.54), pg.y + pg.h * 0.6, by - gap * 2); Y.badge = [sx(0.28), pg.y + pg.h * 0.26, pg.h * 0.2]; }
    Y.print = prints;
    Y.nails = [[pg.x + base * 0.05, pg.y + base * 0.05], [pg.x + pg.w - base * 0.05, pg.y + base * 0.05]];
    return Y;
  }
  // the loser's portrait for the poster, drawn once: mono (every colour grey), the pose frozen at 2300 (kind 1: terror, kind 2: the X eyes), the head filling the frame
  function gnsPortrait(Y, kind) {
    if (!loserCopy) loserCopy = Object.assign({}, L_(), { x: 0, y: 0, vx: 0, vy: 0, state: "fin", flash: 0 });
    const cp = loserCopy, tt = 2300, fw = Y.fw, fh = Y.fh;
    mgNeedLayer();
    const cvs = mgCanvas(fw * DPR, fh * DPR), x = cvs.getContext("2d");
    gnsPort = kind;
    try {
      MG.pt = tt;
      const P = pose(cp, mgTk(tt)), vh = P.w * 1.25 * fh / fw, z = fh / vh;   // the frame shows a little more than one body width
      const hd = gnsPt(cp, tt, "head"), pn = { z, ox: 0, oy: 0, x0: 0, y0: 0, x1: fw, y1: fh, p: (wx, wy) => [fw / 2 + (wx - hd[0]) * z, fh * 0.55 + (wy - hd[1]) * z] };
      if (kind === 1) { const q = pn.p(...gnsPt(cp, tt, "head", 0, -P.ry * 0.5)); Y.fore = [Y.fx0 + q[0], Y.fy0 + q[1]]; }   // the forehead, where the sixth hole goes
      mgPuppet(x, pn, cp, tt, { mono: true, free: false, tint: 0.5, light: Math.PI - dirAng(-0.6), wash: ["#8a6a30", 0.16] });
    } finally { gnsPort = 0; MG.mono = false; }
    return cvs;
  }
  function gnsBadge(c, tone, x, y, R) {   // a sheriff's star in thin ink with a tone fill, ball tips and a ring, printed faintly on the paper
    const pts = [];
    for (let i = 0; i < 12; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 6, r = i % 2 ? R * 0.5 : R; pts.push([x + Math.cos(an) * r, y + Math.sin(an) * r]); }
    c.save(); c.globalAlpha = 0.5;
    tone(pts, 6, 0.2);
    c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 2; c.lineJoin = "miter"; mgPoly(c, pts); c.stroke();
    for (let i = 0; i < 12; i += 2) { c.beginPath(); c.arc(pts[i][0], pts[i][1], R * 0.075, 0, TAU); c.fill(); }
    c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, R * 1.12, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, R * 0.3, 0, TAU); c.stroke();
    c.restore();
  }
  function gnsNail(c, x, y, r, k) {   // a nail head: an ink disc with a paper glint and a short shadow; it is hammered in (squashed from big) at k 0..1
    const s = 1 + 0.9 * (1 - easeOut(k));
    c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = Math.min(1, k * 6);
    c.fillStyle = INK; const a0 = c.globalAlpha; c.globalAlpha = a0 * 0.3; c.beginPath(); c.arc(r * 0.4, r * 0.55, r * 1.1, 0, TAU); c.fill(); c.globalAlpha = a0;   // the shadow
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.fillStyle = PAPER; c.beginPath(); c.arc(-r * 0.32, -r * 0.34, r * 0.3, 0, TAU); c.fill();
    c.restore();
  }
  function drawWanted(c, pn, t) {
    if (posterStage < 3) gnsPosterCatchUp();
    const Y = poster, img = (w, x, y) => c.drawImage(w.cv, x - w.w / 2, y - w.h / 2, w.w, w.h);
    // the camera: a 4% push on the whole poster about the middle of the page, 3750-4700 (the tone fills are placed by hand, the pattern fill ignores the transform)
    const pg = MG.page, s = 1 + 0.04 * ease(fe(SPLASH0, MT.AFTER, t)), pcx = pg.x + pg.w / 2, pcy = pg.y + pg.h / 2;
    const tone = (poly, size, cover) => gnsTone(c, pn, poly.map(([x, y]) => [pcx + (x - pcx) * s, pcy + (y - pcy) * s]), size, cover);
    pn.screen(c);
    c.save(); c.translate(pcx, pcy); c.scale(s, s); c.translate(-pcx, -pcy);
    if (Y.badge) gnsBadge(c, tone, ...Y.badge);
    c.fillStyle = INK; c.globalAlpha = 0.32; c.beginPath(); for (const [x, y, w] of Y.print) c.rect(x, y, w, 2.4); c.fill(); c.globalAlpha = 1;
    // the torn bottom
    tone(Y.band, 6, 0.7);
    c.strokeStyle = INK; c.lineWidth = 2; c.lineJoin = "round"; c.beginPath(); Y.edge.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    // the lettering and the portrait in its frame
    img(Y.title, Y.cx, Y.tY); img(Y.dead, Y.cx, Y.dY); img(Y.rew, Y.cx, Y.rY);
    const { fx0, fy0, fw, fh } = Y, ko = t >= GOLD_T;
    c.fillStyle = "#f6edcf"; c.fillRect(fx0, fy0, fw, fh);
    tone([[fx0, fy0 + fh * 0.58], [fx0 + fw, fy0 + fh * 0.44], [fx0 + fw, fy0 + fh], [fx0, fy0 + fh]], 7, 0.16);
    c.drawImage(ko ? Y.p2 : Y.p1, fx0, fy0, fw, fh);
    c.strokeStyle = INK; c.lineJoin = "miter"; c.lineWidth = 3.4; c.strokeRect(fx0, fy0, fw, fh);
    c.lineWidth = 1; c.strokeRect(fx0 + 5, fy0 + 5, fw - 10, fh - 10);
    // the nails go in one after the other
    Y.nails.forEach(([x, y], i) => { const k = fe(SPLASH0 + 40 + i * 40, SPLASH0 + 120 + i * 40, t); if (k > 0) gnsNail(c, x, y, Y.hr * 0.75, k); });
    // the bullet holes: five beside the head, the sixth through the forehead (his eyes are X by then)
    Y.holes.forEach(([x, y], i) => gnsHole(c, x, y, Y.hr, t - HOLE_T[i], { seed: 40 + i, cracks: true, chip: "#fff6dc" }));
    if (Y.fore) gnsHole(c, Y.fore[0], Y.fore[1], Y.hr * 1.8, t - GOLD_T, { seed: 60, cracks: true, gold: true, chip: "#fff6dc" });
    c.restore();
  }

  /* ---- the script ---- */
  // the gunshot: a crack, a body, (two echoes off the mesas, a ricochet when it is the full shot); v is the volume
  function gnsBang(v, full) {
    Cin._noise(0.05, 0.7 * v, 9000, 3500, "highpass", 0.7); Cin._noise(0.3, 0.8 * v, 5200, 500, "lowpass", 0.7); Cin.sub(120, 40, full ? 0.35 : 0.2, 0.7 * v);
    if (!full) return;
    Cin._noise(0.3, 0.22, 1600, 400, "lowpass", 0.7, 0.32); Cin._noise(0.32, 0.11, 1300, 350, "lowpass", 0.7, 0.68);
    Cin._osc("sine", 3600, 1500, 0.42, 0.045, 0.006, 0.12);
  }
  const S_ = {
    col: COL, name: "High Noon", flight: "strike",
    panels,
    words(lay) {
      gnsMode(ULT);
      const ev = FIN.ev, mv = ev ? ev.mv || "" : "", shot = !ev || ev.fin || mv === "spec" || mv === "ulti" || /^h/.test(mv), D = FIN.dir;
      const hitWord = { text: shot ? "BLAM" : "WHAK", t0: 600, t1: 1330, size: 0.24, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] };
      // the clock strikes: beside the clock, across the border of panel 2
      const dong = { text: "DONG", t0: DONG, t1: 2330, size: 0.13, arc: 7, rot: 0.12 * D, jit: 0.14,
        at: () => { if (lay.port) return [MG.page.x + MG.page.w * (D > 0 ? 0.24 : 0.76), MG.page.y + L.gh * 0.055];   // upright: the clock is at the edge, so in the open sky over his hat
          const p = MG.byId.look, q = p.sp(FIN.wx + D * 36, -77); return [q[0] + D * p.z * 21.5 * 1.45, q[1] - p.z * 21.5 * 0.55]; } };
      // the shot: above the line, ahead of his gun, stretched along it (the Ultimate's is gold: BLAMM)
      const bang = { text: ULT ? "BLAMM" : "BANG", t0: PH, t1: ULT ? SPLASH0 + 130 : PH + 560, size: 0.24, arc: 10, rot: -0.07 * D, fill: ULT ? GOLD : COL, stretch: { ang: D > 0 ? 0 : Math.PI, k: 0.35 },
        at: () => { const p = MG.byId.strike, q = p.sp(FIN.wx + D * 80, -104); return [q[0], q[1]]; } };
      // he blows the smoke off the barrel
      const fuu = { text: "fuu", t0: BLOW + 20, t1: MT.AFTER + 880, size: 0.085, jit: 0.12, rot: -0.14 * D, space: 0.1, fill: "#ffffff",   // (white as on the normal page: the engine makes the unfilled words after the hit gold)
        at: (t) => { const p = MG.byId.after, m = p.sp(...gnsMuzzle(Math.min(t, BLOW + 60))); return [m[0] + D * p.z * 30, m[1] - p.z * 4]; } };
      if (!ULT) return [hitWord, dong, bang, fuu];
      // five BAMs fanned round the muzzle, one per shot, each in the direction of its shot (the angle opened up a little so the five do not overlap)
      const bams = FAN_A.map((a, i) => ({ text: "BAM", t0: fanT(i), t1: fanT(i) + 400, size: 0.09, arc: 8, rot: a * 1.2 * D, jit: 0.12,
        at: () => { const p = MG.byId.strike, m = fan[i].m, an = a * 3.4, r = 30; const q = p.sp(m[0] + D * (r * Math.cos(an) + 6), m[1] + r * Math.sin(an) * 1.6 - 4); return [q[0], q[1]]; } }));
      return [hitWord, dong].concat(bams, [bang, fuu]);
    },
    start(g) { gnsMode(false); dust = []; weed = null; hat = null; hatKind = "sprout"; fan = []; poster = null; posterStage = 0; gnsPort = 0; loserCopy = null; },
    build(lay) {
      gnsMode(ULT);
      const r = mgRng(1873);
      dust = Array.from({ length: MG.slow ? 22 : 40 }, () => ({ x: r() * (L.gw + 40), y: r() * L.gh, v: 70 + r() * 120, s: 0.8 + r() * 1.3, ph: r() * 6.28, dash: r() < 0.35 ? 6 + r() * 14 : 0 }));
      const cos = L_().spec.look.costume;
      hatKind = cos === "gunslinger" ? "cowboy" : cos === "wizard" ? "wizard" : "sprout";
      const m = gnsMuzzle(HIT); shotX0 = m[0]; shotY = m[1];
      if (ULT) gnsFanBuild();
    },
    step(t, k) {
      const W = W_();
      W.x = FIN.wx - FIN.dir * 3 * gnsKick(t) - (ULT && t < HIT ? FIN.dir * 1.2 * gnsFanAim(t)[1] : 0);   // the recoil (a fanned shot kicks less)
      if (t > 2800 && weed) weed = null;
      if (ULT) gnsPosterStep(t);
      MG.pt = t;
    },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor;
      if (role === "w") {
        const low = [w * 0.9, -leg], aim = [w * 1.02, -leg - tor * 0.64], lowB = [-w * 0.72, -leg - tor * 0.06];
        P.gunB = Math.PI - 1.15; P.exK = 1;
        if (t < MT.HIT) {   // the stand-off: hands over the holsters
          const k = ease(fe(MT.LOOK, MT.LOOK + 400, t)), lift = Math.sin(Math.PI * fe(2050, 2600, t)) * 1.2;
          P.crouch = 0.22 * k; P.lean = 0.06 * k; P.holdAng = 0.95;
          P.expr = t >= DONG ? "grin" : undefined;
          return { hF: [low[0], low[1] - lift], hB: lowB };
        }
        if (t < MT.AFTER) {   // the draw, in one frame: the arm out, the barrel level; then the kick (the Ultimate: the draw is the first of five fanned shots, the barrel steps with each)
          const [ang, kick, sf] = gnsAim(t);
          P.crouch = 0.12; P.lean = -0.04 - 0.12 * kick; P.holdAng = ang; P.expr = "grin";
          if (sf >= 0) P.shotF = sf;
          return { hF: [aim[0] - kick * 2, aim[1] - kick * 6], hB: lowB };
        }
        // the aftermath: the barrel up to his mouth, he blows, grins, and lowers it back to the holster
        const q = ease(fe(RAISE, BLOW - 30, t)), d = ease(fe(LOWER, LOWER + 340, t)), up = [w * 0.7, -leg - tor * 0.35];
        P.crouch = 0.12 * (1 - q); P.lean = -0.04 * (1 - q) - 0.03 * q;
        let hF = lerp2(aim, up, q), ang = lerp(0, -1.42, q);
        if (d > 0) { hF = lerp2(up, low, d); ang = lerp(-1.42, 0.95, d); }
        P.holdAng = ang;
        const blowing = t >= BLOW - 20 && t < BLOW + 320;
        P.expr = blowing ? undefined : "grin"; P.mouth = blowing ? 0.75 : 0;
        return { hF, hB: lowB };
      }
      // the Ultimate's poster portrait: the mugshot, terror (gnsPort 1) or the X eyes (2), frozen, upright
      if (gnsPort) { P.expr = gnsPort === 2 ? "ko" : "terror"; P.exK = 1; P.mouth = gnsPort === 2 ? 1 : 0.35; return { hF: [w * 0.75, -leg - tor * 0.42], hB: [-w * 0.7, -leg - tor * 0.42] }; }
      // the loser: terror (the pupils shrink in the inset), then flung, spinning
      const fly = t >= FIN.launch;
      P.expr = fly ? "ko" : "terror"; P.exK = fe(MT.INSET, MT.STRIKE, t);
      if (!fly) {
        P.lean = Math.sin(t * 0.025) * 0.03 * fe(2000, 2400, t) - 0.12 * gnsFlinch(t); P.mouth = 0.3;
        return { hF: [w * 0.75, -leg - tor * 0.42], hB: [-w * 0.7, -leg - tor * 0.42] };
      }
      P.lean = -0.5; P.mouth = 1; P.spin = ((t - FIN.launch) / FMS) * 0.3;
      return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
    },
    over(o, t) {
      gnsDust(o, t);
      gnsWeed(o, t);
      if (t > FIN.launch && t < FIN.launch + 420) {   // the speed lines of the flight, along the real launch direction
        const Lp = L_(), pn = MG.byId.strike, a = 1 - fe(FIN.launch + 200, FIN.launch + 420, t);
        const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.3, ang, -(t - FIN.launch) * 1.3, 0.7 * a, false, 0.85);
        o.restore();
      }
      if (t >= FIN.launch) { if (!hat) gnsHatStart(t); gnsHat(o, t); }
    },
    drawLoser: drawLoserFn,
    hitPt() { return [FIN.lx, shotY]; },
    impact(o, pn, sil, t) {
      mgPuppet(o, pn, W_(), HIT + 10, { sil, free: true });
      mgPuppet(o, pn, L_(), HIT + 10, { sil, free: true });
      // the shot as one flat line, the flash as a flat star
      const D = FIN.dir, m = gnsMuzzle(HIT);
      o.save(); pn.world(o); o.strokeStyle = sil; o.lineCap = "butt"; o.lineWidth = 5; o.beginPath(); o.moveTo(m[0], m[1]); o.lineTo(m[0] + D * 720, m[1]); o.stroke();
      o.translate(m[0] + D * 4, m[1]); o.scale(D, 1); o.fillStyle = sil; o.beginPath();
      for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU, rr = i % 2 ? 6 : 22; o.lineTo(Math.cos(an) * rr * (Math.cos(an) > 0 ? 1.5 : 0.8), Math.sin(an) * rr); }
      o.closePath(); o.fill(); o.restore();
    },
    cues(t) {
      cueOnce("wind", 900, () => Cin.go(() => Cin._noise(1.8, 0.07, 380, 820, "bandpass", 0.8)));
      cueOnce("whistle", 1300, () => Cin.go(() => {   // a far whistle across the plain: up, hold, fall
        Cin._osc("triangle", 660, 990, 0.26, 0.05, 0.08); Cin._osc("triangle", 990, 988, 0.3, 0.05, 0.02, 0.26); Cin._osc("triangle", 988, 700, 0.45, 0.045, 0.02, 0.56);
      }));
      cueOnce("tick0", 1300, () => Cin.go(() => Cin.tick(1500)));
      cueOnce("tick1", TICK, () => Cin.go(() => Cin.tick(1100)));
      cueOnce("weed", 1500, () => Cin.go(() => Cin._noise(1.2, 0.05, 900, 1500, "bandpass", 1.4)));
      cueOnce("dong", DONG, () => Cin.go(() => {   // the bell: inharmonic partials, a long tail
        for (const [f, v, d] of [[196, 0.16, 2.2], [392, 0.08, 1.6], [470, 0.06, 1.3], [588, 0.05, 1.1], [806, 0.03, 0.8]]) Cin._osc("sine", f, f * 0.998, d, v, 0.004);
        Cin._noise(0.05, 0.2, 2400, 900, "bandpass", 1.2);
      }));
      cueOnce("pluck", 2000, () => Cin.go(() => Cin.pluck(1320)));
      cueOnce("spurs", 2120, () => Cin.go(() => { Cin._osc("triangle", 5200, 4300, 0.06, 0.05, 0.002); Cin._osc("triangle", 4700, 3900, 0.06, 0.04, 0.002, 0.09); }));
      cueOnce("beat1", 2420, () => Cin.go(() => { Cin.sub(62, 40, 0.16, 0.45); Cin.sub(60, 38, 0.16, 0.35); }));
      cueOnce("beat2", 2620, () => Cin.go(() => { Cin.sub(62, 40, 0.16, 0.5); }));
      cueOnce("cock", 2700, () => Cin.go(() => { Cin.clack(); Cin.tick(2200); }));
      cueOnce("shot", HIT, () => Cin.go(() => gnsBang(1, true)));   // the gunshot: a crack, a body, two echoes off the mesas, a ricochet
      cueOnce("fly", FIN.launch, () => Cin.go(() => Cin.whoosh(0.35, -0.6, 0.9, 0.42)));
      cueOnce("blow", BLOW, () => Cin.go(() => Cin._noise(0.5, 0.14, 1300, 700, "bandpass", 0.8)));
      cueOnce("land", LAND, () => Cin.go(() => Cin._noise(0.08, 0.12, 900, 400, "lowpass", 0.8)));
      cueOnce("holster", LOWER + 340, () => Cin.go(() => { Cin.clack(); }));
      cueOnce("ching", LOWER + 420, () => Cin.go(() => Cin.chime(2093)));
    },
  };
  /* ---- the Ultimate page, "Wanted": the same script with its own panels, cues and times (the engine plays MANGA.gunslinger.ulti when the KO is the Dead Eye ulti) ---- */
  S_.ulti = Object.assign({}, S_, {
    name: "Wanted", hit: 3400, pop: 3550,   // the sixth shot is the lethal one; the loser is launched when its gold impact frame is over (the three frames are 3400-3550)
    panels: panelsU,
    start(g) { S_.start(g); gnsMode(true); },
    end() { poster = null; loserCopy = null; fan = []; },   // the poster's lettering and portrait canvases
    cues(t) {
      S_.cues(t);
      for (let i = 0; i < 5; i++) cueOnce("fan" + i, fanT(i), () => Cin.go(() => gnsBang(0.6, false)));   // the five fanned shots
      cueOnce("hammer", 3330, () => Cin.go(() => { Cin.clack(); Cin.tick(2200); }));   // the drop: the hammer back
      cueOnce("flap", SPLASH0, () => Cin.go(() => Cin._noise(0.3, 0.12, 300, 900, "bandpass", 0.9)));   // the poster flaps down
      cueOnce("nail0", SPLASH0 + 40, () => Cin.go(() => Cin.clack())); cueOnce("nail1", SPLASH0 + 80, () => Cin.go(() => Cin.clack()));   // nailed
      HOLE_T.forEach((h, i) => cueOnce("hole" + i, h, () => Cin.go(() => { Cin.clack(); Cin.tick(900); })));
      cueOnce("gold", GOLD_T, () => Cin.go(() => { gnsBang(0.5, false); Cin.chime(1568); Cin.tick(2600); }));
    },
  });
  return S_;
})();
