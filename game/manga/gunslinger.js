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
   order) and a sixth gold-rimmed one through the portrait's forehead at 4450 (his eyes turn to X); 4700 panel 4 as on the normal page (MT.AFTER + offsets).
   POTATALITY: "Tater Tots" = MANGA.gunslinger.alt (S_.alt, at the end; its helpers are prefixed tts), played on a normal KO when it is on (ui/kopages.js).
   POTATALITY 2: "Loaded" = MANGA.gunslinger.alt2 (S_.alt2, after it; its helpers are prefixed lod; `pota2` says it is playing), played when it is the one picked. */
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
    if (pota) { RAISE = MT.AFTER; BLOW = MT.AFTER + 160; }   // Tater Tots: he blows the smoke off before the engine's POP (5250), not under it
  }
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  let dust = [], weed = null, hat = null, hatKind = "sprout", shotX0 = 0, shotY = -42;
  let fan = [], poster = null, posterStage = 0, gnsPort = 0, loserCopy = null;   // the Ultimate: the five shots' muzzles and holes, the poster (layout, lettering, portraits), the portrait pose switch
  let pota = false;   // pota: this play is the Potatality, Tater Tots (set by its start, cleared by S_.start and its end)
  let pota2 = false;  // pota2: this play is the second Potatality, Loaded (set by its start, cleared by S_.start and its end)

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
    start(g) { pota = false; pota2 = false; gnsMode(false); dust = []; weed = null; hat = null; hatKind = "sprout"; fan = []; poster = null; posterStage = 0; gnsPort = 0; loserCopy = null; },
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

  /* ===================== the Potatality, "Tater Tots" (MANGA.gunslinger.alt; design: Project files step8/fable-design.md) =====================
     High Noon up to the shot (the loser's hat and the speed lines stop at the splash: he is the food now). 3250 panel 5, the splash, drops in from the top:
     one fence rail right across the page in front of the sunset; 3270 a puff in the sky and the loser comes down as six tater tots (his potato, a neckerchief
     in his costume's colour, his own face) that plink onto the rail in a row like tin cans (3390-3540); his revolver comes up into the near corner (3560) and
     3600 they see it: terror, sweat. He fans the hammer: 3860-4260 five shots, BLAM BLAM BLAM, a ping star on each tot as it is knocked off and tumbles away
     behind the rail (the ones still standing squeeze their eyes shut at every shot); 4360 the sixth fan only clicks (the first of the six rounds was the lethal
     shot); 4440 the last tot opens his eyes, 4540 phew. 4700 in panel 4's place: he blows the smoke off his barrel at once (4860, fuu: gnsMode), and on a barrel
     beside him the last tot sits in a paper cone with a drop of ketchup on his head, sweating; the engine's POP bursts the cone at 5250 (food()) and leaves it
     empty, ketchup and all.
     The splash's world: the rail's top at y = 0, the tots stand on it 31 apart (28 upright), tot 0 nearest the gun. Every helper here is prefixed tts. */
  const TTS_N = 6, TTS_W = 21, TTS_H = 28, TTS_HZ = 18, TTS_GR = 50;   // the tots' size (world units); the horizon; where a knocked-off tot comes to rest
  const TTS_PUFF = 3270, TTS_GUN = 3560, TTS_LOOK = 3600, TTS_COCK = 3720, TTS_CLICK = 4360, TTS_OPEN = 4440, TTS_PHEW = 4540;
  const ttsLand = (i) => 3390 + i * 30;     // tot i lands on the rail (3390 .. 3540)
  const ttsShot = (i) => 3860 + i * 100;    // the five fanned shots (3860 .. 4260)
  const ttsHit = (i) => ttsShot(i) + 25;    // ... each hits its tot 25 ms later
  const ttsPort = () => !!(MG.lay && MG.lay.port);
  const ttsX = (i) => FIN.dir * (i - 2.5) * (ttsPort() ? 28 : 31);   // where tot i stands on the rail (the last one clear of the K.O. seal)
  const ttsBY = () => (ttsPort() ? -150 : -64);                       // the puff in the sky they come down from
  const TTS_V = 150, TTS_G = 1100, TTS_UL = (TTS_V + Math.sqrt(TTS_V * TTS_V + 2 * TTS_G * TTS_GR)) / TTS_G;   // knocked off: up at 150 units/s, falling at 1100/s², at rest after TTS_UL s
  const TTS_SPECK = [[-6, -7, 0.4], [4, -4, -0.6], [-3, 2, 1.2], [6, 4, 0.2], [-7, 8, -0.3], [2, 11, 0.9], [7, -10, 1.4], [-1, -11, 0.1]];   // the crust's grated bits (tot units)
  const ttsConeX = () => FIN.wx + FIN.dir * 58, TTS_CS = 1.2;   // the barrel with the cone in panel 4, drawn TTS_CS times its size about its foot
  let ttsC = null;   // the loser's colours on his tots (made in build)
  const ttsS = { x: 0, y: 0, k: 1, rot: 0, sq: 1, ex: "", exK: 1, hurt: false, back: false, sweat: 0 };   // one tot's state (reused: nothing allocated per tot per frame)
  const ttsF = { state: "fin", pal: null }, ttsP = { w: 44, head: [0, 0], expr: "", exK: 1, mouth: 0 };   // stand-ins for potatoFace (it reads only these fields)
  function ttsPrep() {
    const pal = L_().pal, body = pal.body || "#e9c070";
    ttsC = { body, crust: mix(body, "#6b3410", 0.45), top: mix(body, "#fff3d6", 0.45), kerch: pal.accent || col(pal) };   // the neckerchief in his costume's colour
    return ttsC;
  }
  // the path just built (under any transform) filled with a dot screen; the dots stay in screen space like all the page's tone
  function ttsToneHere(c, size, cover) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(size, cover); c.fill(); c.restore(); }
  // a sweat drop: round at the bottom, pointed at the top, pale blue with an ink edge
  function ttsDrop(c, x, y, s, lw) {
    c.beginPath(); c.moveTo(x, y - s * 1.9); c.bezierCurveTo(x + s * 0.4, y - s * 1.2, x + s, y - s * 0.5, x + s, y); c.arc(x, y, s, 0, Math.PI);
    c.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.4, y - s * 1.2, x, y - s * 1.9); c.closePath();
    c.fillStyle = "#d6eeff"; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  }
  // the loser's own face (potatoFace, in his style: the Wizard's rims, Odin's patch...), its eye line at (x, y), s units across, looking toward dx (+1 / -1)
  function ttsFace(c, x, y, s, dx, ex, exK, hurt) {
    const Lp = L_(), w = Lp.s.w;
    ttsF.pal = Lp.pal; ttsF.state = hurt ? "hitstun" : "fin"; ttsP.w = w; ttsP.expr = ex; ttsP.exK = exK; ttsP.mouth = 0;
    c.save(); c.translate(x, y); c.scale(dx * s / w, s / w);
    potatoFace(c, ttsF, ttsP, Lp.spec.look);
    c.restore();
  }
  // one tot, its feet at (x, y) (world units, under pn.world): k its scale, rot its turn about its middle, sq the landing squash; his face looks toward dx;
  // ex / exK / hurt: the face (hurt: eyes squeezed shut); sweat 0..1: a drop running down beside his face
  function ttsTot(c, x, y, k, rot, sq, dx, ex, exK, hurt, sweat, lw) {
    const w = TTS_W, h = TTS_H, C = ttsC || ttsPrep();
    c.save(); c.translate(x, y); c.scale(k, k); c.translate(0, -h / 2 * sq); c.rotate(rot); c.scale(1 + (1 - sq) * 0.7, sq);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = INK;
    c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 7); c.fillStyle = C.body; c.fill();
    c.save(); c.clip();
    c.fillStyle = C.crust;
    for (const [sx, sy, a] of TTS_SPECK) { c.beginPath(); c.ellipse(sx, sy, 1.6, 0.75, a, 0, TAU); c.fill(); }
    if (!MG.slow) { c.beginPath(); c.rect(dx > 0 ? -w : w * 0.18, -h, w * 0.82, 2 * h); ttsToneHere(c, 6, 0.4); }   // the shade, on the side away from the gun
    // his neckerchief: a band round him in his colour
    c.beginPath(); c.moveTo(-w, h * 0.16); c.quadraticCurveTo(0, h * 0.3, w, h * 0.16); c.lineTo(w, h * 0.3); c.quadraticCurveTo(0, h * 0.44, -w, h * 0.3); c.closePath();
    c.fillStyle = C.kerch; c.fill(); c.lineWidth = lw * 0.7; c.stroke();
    c.restore();
    c.beginPath(); c.moveTo(-w * 0.2, h * 0.29); c.lineTo(w * 0.18, h * 0.3); c.lineTo(-w * 0.03, h * 0.48); c.closePath();   // ... and its point hanging in front
    c.fillStyle = C.kerch; c.fill(); c.lineWidth = lw * 0.7; c.stroke();
    c.beginPath(); c.ellipse(0, -h / 2 + 3, w / 2 - 1.8, 2.2, 0, 0, TAU); c.fillStyle = C.top; c.fill(); c.lineWidth = lw * 0.6; c.stroke();   // the cut top
    c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 7); c.lineWidth = lw; c.stroke();
    ttsFace(c, 0, -h * 0.1, 27, dx, ex, exK, hurt);
    if (sweat > 0) ttsDrop(c, -dx * w * 0.62, -h * 0.26 + sweat * 6, 2.3, lw * 0.6);
    c.restore();
  }
  // where tot i is and how he looks at t (fills ttsS); false while he is still inside the puff
  function ttsAt(i, t) {
    const S = ttsS, D = FIN.dir, x0 = ttsX(i), L0 = ttsLand(i), f0 = TTS_PUFF + 20 + i * 10, last = i === TTS_N - 1;
    S.x = x0; S.y = 0; S.k = 1; S.rot = 0; S.sq = 1; S.ex = ""; S.exK = 1; S.hurt = false; S.back = false; S.sweat = 0;
    if (t < f0) return false;
    if (t < L0) {   // out of the puff and down onto the rail in an arc, turning over, spiral-eyed
      const u = fe(f0, L0, t);
      S.x = lerp(D * (i - 2.5) * 5, x0, u); S.y = lerp(ttsBY(), 0, u) - 88 * u * (1 - u);
      S.k = 0.45 + 0.55 * easeOut(Math.min(1, u * 2.5)); S.rot = D * (1 - u) * (2.6 + i * 0.5); S.ex = "dazed";
      return true;
    }
    if (!last && t >= ttsHit(i)) {   // knocked off: up, away and back (smaller), tumbling, X eyes; at rest on the ground behind the fence, on his side
      const u = (t - ttsHit(i)) / 1000, ul = Math.min(u, TTS_UL), spin = 12 + i;
      S.back = true; S.ex = "ko"; S.k = 1 - 0.38 * Math.min(1, u / 0.3);
      S.x = x0 + D * (9 + 5 * (i % 2)) * ul; S.y = -TTS_V * ul + 0.5 * TTS_G * ul * ul;
      if (u < TTS_UL) S.rot = D * u * spin;
      else {
        const r0 = D * TTS_UL * spin, q = Math.round(r0 / (Math.PI / 2)), r1 = (q % 2 ? q : q + D) * (Math.PI / 2);
        S.rot = lerp(r0, r1, easeOut(fe(TTS_UL, TTS_UL + 0.1, u))); S.y = TTS_GR + 3.5 * S.k - 4 * Math.sin(Math.PI * fe(TTS_UL, TTS_UL + 0.14, u));
      }
      return true;
    }
    // on the rail: the landing squash, then nerves (a shiver, terror; every other one sweats)
    S.sq = 1 - 0.24 * Math.sin(Math.PI * fe(L0, L0 + 120, t));
    const nerv = fe(TTS_LOOK, TTS_LOOK + 160, t), calm = last ? fe(TTS_PHEW, TTS_PHEW + 60, t) : 0;
    S.x += Math.sin(t * 0.12 + i * 1.7) * 0.5 * nerv * (1 - calm);
    if (nerv > 0) { S.ex = "terror"; S.exK = nerv; S.sweat = i % 2 ? fe(TTS_LOOK + 80, TTS_LOOK + 900, t) : 0; }
    // every shot: the ones still standing duck a little and squeeze their eyes shut
    let fl = 0;
    for (let j = 0; j < Math.min(i, 5); j++) fl = Math.max(fl, Math.sin(Math.PI * fe(ttsHit(j) - 10, ttsHit(j) + 110, t)));
    S.sq -= 0.1 * fl;
    if (fl > 0.25) S.hurt = true;
    if (last) {
      if (t >= ttsHit(4) - 10 && t < TTS_OPEN) S.hurt = true;                       // the fifth shot: eyes shut, waiting for his... click
      else if (t >= TTS_OPEN && t < TTS_PHEW) { S.ex = "terror"; S.exK = 0.25; }    // one look: nothing came
      else if (t >= TTS_PHEW) { S.ex = "calm"; S.sweat = 0; }                       // phew
    }
    return true;
  }
  const ttsTotS = (c, lw) => { const S = ttsS; ttsTot(c, S.x, S.y, S.k, S.rot, S.sq, -FIN.dir, S.ex, S.exK, S.hurt, S.sweat, lw); };
  function ttsCam(t, pn) {
    const port = ttsPort(), vh = (port ? pn.h * 178 / pn.w : 135) * (1 - 0.04 * fe(MT.SPLASH, MT.AFTER, t));   // upright: as wide as the row of tots needs
    return { wx: 0, wy: -vh * (port ? 0.1 : 0.09), vh };
  }
  const ttsShake = (t) => {
    let a = 0;
    for (let i = 0; i < 5; i++) a += 2.2 * fe(ttsShot(i), ttsShot(i) + 8, t) * (1 - fe(ttsShot(i) + 8, ttsShot(i) + 70, t));
    return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a * 0.6] : [0, 0];
  };
  // the sunset behind the fence: sky tone, the sun cut by paper stripes, mesas, the ground (as the street of panels 3 and 4)
  function ttsBack(c, pn, t) {
    const D = FIN.dir, hz = pn.p(0, TTS_HZ)[1], X0 = pn.x0 - 6, X1 = pn.x1 + 6;
    if (!MG.slow) {
      gnsTone(c, pn, [[X0, pn.y0 - 6], [X1, pn.y0 - 6], [X1, pn.y0 + pn.h * 0.12], [X0, pn.y0 + pn.h * 0.16]], 7, 0.42, [t * 0.0008, 0]);
      gnsTone(c, pn, [[X0, pn.y0 + pn.h * 0.16], [X1, pn.y0 + pn.h * 0.12], [X1, pn.y0 + pn.h * 0.25], [X0, pn.y0 + pn.h * 0.29]], 7, 0.18, [t * 0.0008, 0]);
    }
    const [sx] = pn.p(-D * 18, 0), R = (ttsPort() ? 84 : 76) * pn.z, sy = hz + R * (0.1 + 0.08 * fe(MT.SPLASH, MT.AFTER, t));
    c.save(); c.beginPath(); c.rect(X0, pn.y0 - 6, X1 - X0, hz - pn.y0 + 6); c.clip();
    c.fillStyle = COL; c.beginPath(); c.arc(sx, sy, R, 0, TAU); c.fill();
    c.lineWidth = Math.max(2, R * 0.025); c.strokeStyle = INK; c.stroke();
    c.save(); c.beginPath(); c.arc(sx, sy, R + 3, 0, TAU); c.clip(); c.fillStyle = PAPER;
    for (let i = 0; i < 4; i++) { const yy = sy - R * 0.5 + i * R * 0.17, th = R * (0.022 + 0.022 * i); c.fillRect(sx - R - 4, yy, 2 * R + 8, th); }
    c.restore();
    c.restore();
    for (const [a, b, h] of [[-250, -150, 24], [-128, -96, 11], [120, 175, 16], [190, 300, 30]]) {
      const x0 = -D * 18 + D * a, x1 = -D * 18 + D * b, top = TTS_HZ - h, pts = [[x0, TTS_HZ], [x0 + D * h * 0.5, top + 3], [x0 + D * h * 0.62, top], [x1 - D * h * 0.5, top], [x1 - D * h * 0.3, top + 4], [x1, TTS_HZ]].map(([x, y]) => pn.p(x, y));
      gnsTone(c, pn, pts, 6, 0.45);
      c.lineWidth = 2; c.strokeStyle = INK; c.lineJoin = "round"; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
    c.fillStyle = PAPER; c.fillRect(X0, hz, X1 - X0, pn.y1 - hz + 6);
    c.fillStyle = INK; c.fillRect(X0, hz - 1, X1 - X0, 2.2);
    pn.world(c);
    c.lineCap = "round"; c.strokeStyle = INK;
    const rs = gnsRng(615);
    for (let i = 0; i < 12; i++) { const x = D * (-200 + rs() * 400), y = TTS_HZ + 4 + rs() * 50, len = 12 + rs() * 40; c.lineWidth = (0.6 + rs() * 0.6) / pn.z; c.beginPath(); c.moveTo(x, y); c.lineTo(x + D * len, y + (rs() - 0.5) * 0.8); c.stroke(); }
    pn.screen(c);
  }
  // the fence: posts every 96 units (their tops hidden behind the top rail), two rails right across the page; wood in flat tan with tone and grain
  function ttsFenceX(pn) { return [pn.wx + (pn.x0 - 8 - pn.cx - pn.px) / pn.z, pn.wx + (pn.x1 + 8 - pn.cx - pn.px) / pn.z]; }
  function ttsPosts(c, pn, lw) {
    const [xa, xb] = ttsFenceX(pn);
    c.lineJoin = "round"; c.strokeStyle = INK; c.lineWidth = lw;
    for (let k = Math.ceil((xa - 8) / 96); k * 96 < xb + 8; k++) {
      const x = k * 96;
      c.beginPath(); c.rect(x - 5.5, 2, 11, 66); c.fillStyle = "#d1b07f"; c.fill();
      c.beginPath(); c.rect(x + FIN.dir * 1.5, 2, FIN.dir * 4, 66); ttsToneHere(c, 6, 0.6);
      c.beginPath(); c.rect(x - 5.5, 2, 11, 66); c.stroke();
    }
  }
  function ttsRails(c, pn, lw) {
    const [xa, xb] = ttsFenceX(pn);
    for (const [y0, hh] of [[0, 9], [31, 8]]) {
      c.beginPath(); c.rect(xa, y0, xb - xa, hh); c.fillStyle = "#e0c597"; c.fill();
      c.beginPath(); c.rect(xa, y0 + hh * 0.55, xb - xa, hh * 0.45); ttsToneHere(c, 6, 0.4);
      c.strokeStyle = INK; c.lineWidth = lw * 0.45; c.beginPath();   // the grain
      for (let k = Math.floor(xa / 40); k * 40 < xb; k++) { const gx = k * 40 + (k % 3) * 7; c.moveTo(gx, y0 + hh * 0.35); c.quadraticCurveTo(gx + 9, y0 + hh * 0.2, gx + 22, y0 + hh * 0.38); }
      c.stroke();
      c.lineWidth = lw; c.beginPath(); c.rect(xa, y0, xb - xa, hh); c.stroke();
      c.fillStyle = INK;   // the nails into the posts
      for (let k = Math.ceil((xa - 8) / 96); k * 96 < xb + 8; k++) for (const s of [-2.6, 2.6]) { c.beginPath(); c.arc(k * 96 + s, y0 + hh * 0.5, 0.9, 0, TAU); c.fill(); }
    }
  }
  // the puff in the sky the tots come out of: a white burst, then three puffs of smoke spreading and fading
  function ttsPuff(c, pn, t) {
    const u = t - TTS_PUFF;
    if (u < 0 || u > 760) return;
    const q = pn.p(0, ttsBY()), z = pn.z, b = easeOut(fe(0, 80, u)) * (1 - fe(130, 250, u));
    if (u < 240) mgFocus(c, q[0], q[1], Math.hypot(pn.w, pn.h) * 0.7, t * 0.0004, 0.35 * (1 - fe(120, 240, u)));
    if (b > 0.02) mgStarburst(c, q[0], q[1], (14 + 22 * b) * z, 0.2);
    const k = easeOut(fe(60, 560, u)), a = 1 - fe(300, 760, u);
    for (let i = 0; i < 3; i++) gnsPuff(c, pn, q[0] + (i - 1) * 10 * z * (0.6 + k), q[1] - k * 7 * z - (i === 1 ? 3 * z : 0), (5 + 4 * k) * z, a, 170 + i);
  }
  // the revolver in the near corner, in px of the panel: [x, y of the hand on the grip, px per gun unit]; it comes up from below the corner at TTS_GUN
  function ttsGunAt(pn, t) {
    const port = ttsPort(), D = FIN.dir, gs = Math.min(pn.w, pn.h) * (port ? 0.0105 : 0.0098), up = 1 - easeOut(fe(TTS_GUN, TTS_GUN + 170, t));
    const ux = port ? 0.13 : 0.07, uy = port ? 0.9 : 0.93;
    return [pn.x0 + (D > 0 ? ux : 1 - ux) * pn.w - D * up * 26 * gs, pn.y0 + uy * pn.h + up * 46 * gs, gs];
  }
  // its aim (in its own frame, mirrored for a winner on the right): [barrel angle, recoil 0..1, ms since the latest shot (-1: none yet)]. The barrel's line
  // (9.75 units over the hand) goes through the tot it aims at; after each shot it steps on to the next tot
  function ttsAim(pn, t, gx, gy, gs) {
    const D = FIN.dir, at = (k) => { const q = pn.p(ttsX(k), -TTS_H * 0.5), dx = (q[0] - gx) * D, dy = q[1] - gy; return Math.atan2(dy, dx) + Math.asin(clamp(9.75 * gs / Math.hypot(dx, dy), -1, 1)); };
    let j = -1;
    for (let i = 0; i < 5; i++) if (t >= ttsShot(i)) j = i;
    if (j < 0) return [at(0), 0, -1];
    const dt = t - ttsShot(j);
    return [lerp(at(j), at(j + 1), ease(fe(45, 95, dt))), easeOut(fe(4, 22, dt)) * (1 - ease(fe(34, 90, dt))), dt];
  }
  function ttsMuzzle(pn, t) {
    const D = FIN.dir, [gx, gy, gs] = ttsGunAt(pn, t), [ang, kick] = ttsAim(pn, t, gx, gy, gs), a = ang - kick * 0.32;
    return [gx + D * gs * (Math.cos(a) * 41 + Math.sin(a) * 9.75), gy + gs * (Math.sin(a) * 41 - Math.cos(a) * 9.75)];
  }
  // the fanning hand: before each shot (and the sixth, the click) its palm sweeps back over the hammer, then swings forward again (0 forward .. 1 on the hammer)
  function ttsFan(t) {
    let s = 0;
    for (let i = 0; i < 6; i++) {
      const dt = t - (i < 5 ? ttsShot(i) : TTS_CLICK);
      if (dt > -50 && dt < 0) s = Math.max(s, (dt + 50) / 50); else if (dt >= 0 && dt < 70) s = Math.max(s, 1 - dt / 70);
    }
    return ease(s);
  }
  function ttsGun(c, pn, t) {
    if (t < TTS_GUN) return;
    const D = FIN.dir, [gx, gy, gs] = ttsGunAt(pn, t), [ang, kick, dt] = ttsAim(pn, t, gx, gy, gs), lw = 2.6 / gs, fan = ttsFan(t), a = ang - kick * 0.32;
    const fx = lerp(12, -9, fan), fy = -24 + 4 * Math.sin(Math.PI * fan);   // the fanning palm (gun units)
    // the two arms run off the page toward the near corner whatever the aim (so they are drawn in px of the panel): the fanning one behind the gun
    const ca = Math.cos(a), sa = Math.sin(a), sp = (x, y) => [gx + D * gs * (x * ca - y * sa), gy + gs * (x * sa + y * ca)];
    const hand = sp(-6, 3), palm = sp(fx, fy), off = [gx - D * gs * 34, gy + gs * 64];
    c.lineCap = "round"; c.strokeStyle = INK;
    c.lineWidth = 10 * gs; c.beginPath(); c.moveTo(palm[0], palm[1]); c.quadraticCurveTo(palm[0] - D * gs * 22, palm[1] + gs * 6, off[0] - D * gs * 14, off[1] - gs * 10); c.stroke();
    c.lineWidth = 11 * gs; c.beginPath(); c.moveTo(hand[0], hand[1]); c.lineTo(off[0], off[1]); c.stroke();
    c.save(); c.translate(gx, gy); c.scale(D * gs, gs); c.rotate(a);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = INK;
    c.lineWidth = lw;
    c.beginPath(); c.moveTo(-7, -3); c.lineTo(-1, -2); c.lineTo(-2.5, 11); c.lineTo(-6, 14); c.lineTo(-12, 12); c.lineTo(-11, 6); c.closePath();   // the grip
    c.fillStyle = "#b07c52"; c.fill(); c.stroke();
    c.beginPath(); c.roundRect(9, -12.5, 32, 5.5, 1.5); c.fillStyle = "#c6cad1"; c.fill(); c.stroke();   // the barrel
    c.beginPath(); c.roundRect(9, -7.5, 21, 3, 1); c.fill(); c.stroke();                                  // the ejector rod under it
    c.beginPath(); c.moveTo(37.5, -12.5); c.lineTo(39.5, -12.5); c.lineTo(39, -15); c.closePath(); c.fillStyle = INK; c.fill();   // the front sight
    c.beginPath(); c.moveTo(-6, -13); c.lineTo(-12, -18.5); c.lineTo(-13.4, -16.8); c.lineTo(-8, -11); c.closePath(); c.fillStyle = "#5c616b"; c.fill(); c.stroke();   // the hammer
    c.beginPath(); c.roundRect(-7, -14.5, 17, 13, 2); c.fillStyle = "#8f959f"; c.fill(); c.stroke();     // the frame
    c.beginPath(); c.arc(3, -1.5, 4, 0, Math.PI); c.stroke();                                              // the trigger guard
    c.beginPath(); c.roundRect(-2, -14, 11, 11, 2.5); c.fillStyle = "#c6cad1"; c.fill();                  // the cylinder: flutes, tone below
    c.save(); c.clip(); c.beginPath(); c.rect(-3, -8, 13, 6); ttsToneHere(c, 6, 0.45); c.restore();
    c.stroke();
    c.lineWidth = lw * 0.6; c.beginPath(); for (const y of [-11, -8, -5.5]) { c.moveTo(-0.5, y); c.lineTo(7.5, y); } c.stroke();
    c.strokeStyle = "#ffffff"; c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(11, -11); c.lineTo(38, -11); c.stroke(); c.strokeStyle = INK;   // a glint along the barrel
    c.fillStyle = INK; c.beginPath(); c.arc(-6, 3, 7, 0, TAU); c.fill();                                   // the hand on the grip
    c.strokeStyle = "#ffffff"; c.lineWidth = lw * 0.8; c.beginPath(); c.arc(-6, 3, 4.6, -2.4, -1.3); c.stroke();
    if (dt >= 0 && dt < 70) { const f = 1 - dt / 70; c.save(); c.translate(41.5, -9.75); gnsFlash(c, 8 + 6 * f, f); c.restore(); }   // the muzzle flash
    if (fan > 0.08 && fan < 0.92) {   // the palm's swing: three arcs behind it
      c.strokeStyle = INK; c.lineWidth = lw * 0.7;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(fx + 6 + i * 3.5, fy + 14, 15 + i * 3, -2.1, -1.2); c.stroke(); }
    }
    c.fillStyle = INK; c.beginPath(); c.arc(fx, fy, 6.5, 0, TAU); c.fill();                               // the fanning palm
    c.strokeStyle = "#ffffff"; c.lineWidth = lw * 0.8; c.beginPath(); c.arc(fx, fy, 4.2, -2.4, -1.3); c.stroke();
    c.restore();
    // smoke off the muzzle after each shot
    for (let j = 0; j < 5; j++) {
      const age0 = t - ttsShot(j);
      if (age0 <= 0 || age0 > 560) continue;
      const m = ttsMuzzle(pn, ttsShot(j) + 20);
      for (let i = 0; i < (MG.slow ? 1 : 2); i++) {
        const age = age0 - 15 - i * 40, k = clamp(age / 520, 0, 1), a = 1 - fe(0.5, 1, k);
        if (age > 0 && a > 0) gnsPuff(c, pn, m[0] + Math.sin(age * 0.006 + j + i) * 2.5 * gs + D * (3 + 5 * i) * gs * 0.6, m[1] - age * 0.03 * gs, (1.8 + 3.6 * easeOut(k)) * gs, a, 190 + j * 2 + i);
      }
    }
  }
  // each shot: a smoking line from the muzzle to the tot (there in 25 ms, rubbed out from the muzzle end); a ping star where it hits him
  function ttsShots(c, pn, t) {
    const D = FIN.dir;
    for (let j = 0; j < 5; j++) {
      const dt = t - ttsShot(j);
      if (dt < 0 || dt > 280) continue;
      const m = ttsMuzzle(pn, ttsShot(j)), q = pn.p(ttsX(j), -TTS_H * 0.5);
      if (dt < 260) {
        const e = lerp2(m, q, easeOut(fe(0, 25, dt))), s = lerp2(m, q, ease(fe(60, 260, dt)));
        c.lineCap = "butt"; c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(e[0], e[1]); c.stroke();
        c.strokeStyle = COL; c.lineWidth = 1.5; c.stroke();
      }
      const u = dt - 25;
      if (u < 0 || u > 240) continue;
      const p = pn.p(ttsX(j) - D * TTS_W * 0.18, -TTS_H * 0.55), s = pn.z * 9 * easeOut(fe(0, 45, u)) * (1 - fe(120, 240, u));
      if (s > 0.5) {
        gnsStar(c, p[0], p[1], s, "#ffffff");
        c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = Math.max(1.4, pn.z * 0.6); c.beginPath();
        for (const a of [-2.4, -1.2, 0.4, 1.9]) { const r0 = s * 1.15, r1 = s * (1.15 + 0.7 * easeOut(fe(0, 90, u))); c.moveTo(p[0] + Math.cos(a) * r0, p[1] + Math.sin(a) * r0); c.lineTo(p[0] + Math.cos(a) * r1, p[1] + Math.sin(a) * r1); }
        c.stroke();
      }
    }
  }
  // phew: the last tot's sweat drop flies off his head
  function ttsPhew(c, pn, t, lw) {
    const u = fe(TTS_PHEW, TTS_PHEW + 380, t);
    if (u <= 0 || u >= 1) return;
    const D = FIN.dir, x = ttsX(TTS_N - 1) + D * (8 + 24 * u), y = -TTS_H * 0.8 - 20 * Math.sin(Math.PI * Math.min(1, u * 1.2)) + 26 * u * u;
    pn.world(c); c.globalAlpha = 1 - fe(0.7, 1, u); ttsDrop(c, x, y, 2.8, lw * 0.7); c.globalAlpha = 1; pn.screen(c);
  }
  function ttsDrawSplash(c, pn, t) {
    const lw = Math.max(1.1, 3 / pn.z);
    pn.screen(c);
    ttsBack(c, pn, t);
    ttsPuff(c, pn, t);
    pn.world(c);
    for (let i = 0; i < TTS_N; i++) if (ttsAt(i, t) && ttsS.back) ttsTotS(c, lw);   // the knocked-off ones, behind the fence
    ttsPosts(c, pn, lw);
    for (let i = 0; i < TTS_N; i++) if (ttsAt(i, t) && !ttsS.back) ttsTotS(c, lw);
    ttsRails(c, pn, lw);
    pn.screen(c);
    ttsShots(c, pn, t);
    ttsPhew(c, pn, t, lw);
    ttsGun(c, pn, t);
  }
  /* ---- panel 4: the barrel, the paper cone, the last tot in it with the ketchup drop (the cone empty once the engine has popped it) ---- */
  function ttsCone(c, pn, t) {
    const D = FIN.dir, xb = ttsConeX(), x0 = 0, lw = Math.max(1.1, 3 / pn.z) / TTS_CS, popped = mgPopped(t), mx = x0 + D * 1.2, my = -40, rx = 10, ry = 2.6;
    pn.world(c); c.translate(xb, 0); c.scale(TTS_CS, TTS_CS);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = INK;
    // the barrel: bulging staves, two hoops, the lid; tone on the side away from the light
    const body = () => { c.beginPath(); c.moveTo(x0 - 8.5, -21); c.quadraticCurveTo(x0 - 11, -10.5, x0 - 8.5, 0); c.lineTo(x0 + 8.5, 0); c.quadraticCurveTo(x0 + 11, -10.5, x0 + 8.5, -21); c.closePath(); };
    body(); c.fillStyle = "#c99a68"; c.fill();
    c.save(); c.clip();
    c.beginPath(); c.rect(D > 0 ? x0 + 3 : x0 - 15, -30, 12, 40); ttsToneHere(c, 6, 0.45);
    c.lineWidth = lw * 0.6; c.beginPath(); for (const s of [-4.5, 0, 4.5]) { c.moveTo(x0 + s, -21); c.quadraticCurveTo(x0 + s * 1.25, -10.5, x0 + s, 0); } c.stroke();
    c.fillStyle = "#4b4f57"; for (const y of [-16.5, -4.5]) c.fillRect(x0 - 12, y - 1.3, 24, 2.6);
    c.restore();
    body(); c.lineWidth = lw; c.stroke();
    c.beginPath(); c.ellipse(x0, -21, 8.5, 2.3, 0, 0, TAU); c.fillStyle = "#dcb784"; c.fill(); c.stroke();
    // the cone, stuck in the lid: the inside at the back, the tot, the front with two stripes of the accent
    c.save(); c.beginPath(); c.rect(x0 - 40, -90, 80, 69); c.clip();
    c.beginPath(); c.ellipse(mx, my, rx, ry, 0, 0, TAU); c.fillStyle = "#b9ad98"; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
    if (popped) {   // empty: a smear of ketchup left inside
      c.beginPath(); c.ellipse(mx - D * 2.5, my - 0.6, 4.2, 1.2, 0, 0, TAU); c.fillStyle = "#d4261b"; c.fill();
    } else {
      const blink = Math.abs(t - 5120) < 50, sw = fe(MT.AFTER + 150, MT.AFTER + 1100, t);
      ttsTot(c, mx - D * 0.5, -32, 0.8, D * 0.06, 1, -D, blink ? "calm" : "terror", 0.7, false, sw, lw);
      // the ketchup drop on his head, a drip running down his side
      const kx = mx - D * 1.5, ky = -55.5, dr = 2 + 4 * easeOut(fe(MT.AFTER + 150, MT.AFTER + 700, t));
      c.fillStyle = "#d4261b"; c.lineWidth = lw * 0.7;
      c.beginPath(); c.ellipse(kx, ky, 5.2, 2.4, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(kx + D * 3.4, ky + 1); c.lineTo(kx + D * 3.8, ky + 1 + dr); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke(); c.lineWidth = 1.2; c.strokeStyle = "#d4261b"; c.stroke();
      c.beginPath(); c.arc(kx + D * 3.8, ky + 1.6 + dr, 1.3, 0, TAU); c.fill(); c.lineWidth = lw * 0.5; c.strokeStyle = INK; c.stroke();
      c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(kx - D * 1.6, ky - 0.7, 1.4, 0.6, 0, 0, TAU); c.fill();
      // steam: two curls off the hot tot
      c.save(); c.globalAlpha = 0.75; c.lineWidth = lw * 0.7;
      for (let i = 0; i < 2; i++) {
        const sx = mx + (i ? 5 : -6), ph = ((t - MT.AFTER) * 0.018 + i * 9) % 18;
        c.beginPath(); for (let j = 0; j <= 8; j++) { const yy = -60 - ph - j * 1.9, xx = sx + Math.sin(j * 0.8 + t * 0.006 + i * 2) * 2; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
      }
      c.restore();
    }
    const front = () => { c.beginPath(); c.moveTo(mx - rx, my); c.lineTo(x0, -15); c.lineTo(mx + rx, my); c.ellipse(mx, my, rx, ry, 0, 0, Math.PI); c.closePath(); };
    front(); c.fillStyle = "#f3e9d2"; c.fill();
    c.save(); c.clip();
    c.fillStyle = COL; for (const o of [-5, 6]) { c.beginPath(); c.moveTo(mx + o - 4, my - 4); c.lineTo(mx + o + 1, my - 4); c.lineTo(mx + o - 7, -14); c.lineTo(mx + o - 12, -14); c.closePath(); c.fill(); }
    c.beginPath(); c.rect(D > 0 ? mx + 2 : mx - 14, -60, 12, 50); ttsToneHere(c, 6, 0.4);
    c.restore();
    c.strokeStyle = INK; c.lineWidth = lw; front(); c.stroke();
    if (popped) {   // a drop of ketchup on the rim, running down the cone
      c.fillStyle = "#d4261b"; c.lineWidth = lw * 0.6;
      c.beginPath(); c.moveTo(mx + D * 2, my + 2.2); c.quadraticCurveTo(mx + D * 6.5, my + 1.4, mx + D * 6, my + 3.5); c.lineTo(mx + D * 5.6, my + 8); c.arc(mx + D * 5.1, my + 8.3, 1.4, 0, Math.PI); c.lineTo(mx + D * 3.6, my + 3.4); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
    c.beginPath(); c.ellipse(x0, -21, 2.6, 0.9, 0, 0, TAU); c.fillStyle = INK; c.fill();   // where the tip goes into the lid
    pn.screen(c);
  }
  function ttsDrawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    gnsStreet(c, pn, t, FIN.wx + D * 52, 50, 0.2 + 0.12 * fe(MT.AFTER, MT.END, t));
    ttsCone(c, pn, t);
    mgPuppet(c, pn, W, t, { light: dirAng(-0.45), post: gnsBrim(W, t, 0.8) });
    pn.screen(c);
    gnsWisp(c, pn, t);
  }

  S_.alt = Object.assign({}, S_, {
    name: "Tater Tots",
    start(g) { S_.start(g); pota = true; ttsC = null; FIN.cue.land = true; },   // (High Noon's hat lands in its own panel 4: here it is gone at the splash, with the loser)
    build(lay) { S_.build(lay); ttsPrep(); },
    end() { pota = false; ttsC = null; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = ttsDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 124 : 80) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + FIN.dir * (lay.port ? 46 : 42), wy: lay.port ? -0.48 * vh : -44, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "t", paper: PAPER, slide: MG.reduced ? 1 : 180, cam: ttsCam, draw: ttsDrawSplash, shake: ttsShake }));
      return ps;
    },
    ownWords: true,   // the upright sizes are set in words(): the BLAMs larger than the engine's width rule would make them
    words(lay) {
      const ws = S_.words(lay), D = FIN.dir, pg = MG.page, fx = (u) => pg.x + (D > 0 ? u : 1 - u) * pg.w, k = lay.port ? Math.min(1, L.gw * 0.9 / L.gh) : 1, kb = lay.port ? 0.6 : 1;
      for (const w of ws) w.mul = (w.mul || 1) * k;   // High Noon's words, as the engine would scale them upright
      Object.assign(ws.find((w) => w.text === "BANG"), { t1: MT.SPLASH + 150 });   // gone as the splash comes in
      Object.assign(ws.find((w) => w.text === "fuu"), { t1: MT.POP + 20,           // (he blows earlier here, gnsMode): gone as the cone pops; up in the smoke, clear of the cone
        at: (t) => { const p = MG.byId.after, m = p.sp(...gnsMuzzle(Math.min(t, BLOW + 60))); return [m[0] + D * p.z * 4, m[1] - p.z * 26]; } });
      // BLAM BLAM BLAM: one stack, a word with every other shot, stepping down toward the far end of the rail
      const at = lay.port ? [[0.31, 0.27], [0.5, 0.34], [0.69, 0.41]] : [[0.3, 0.12], [0.47, 0.2], [0.64, 0.28]];
      at.forEach(([u, v], j) => ws.push({ text: "BLAM", t0: ttsShot(2 * j), t1: 4520, size: 0.12, mul: kb, arc: 9, rot: (-0.14 + 0.07 * j) * D, jit: 0.12, seed: 300 + j, at: () => [fx(u), pg.y + v * pg.h] }));
      ws.push({ text: "click", t0: TTS_CLICK, t1: MT.AFTER, size: 0.06, mul: kb, jit: 0.14, rot: -0.1 * D,
        at: () => { const pn = MG.byId.splash; mgPlace(pn, TTS_CLICK); const [gx, gy, gs] = ttsGunAt(pn, TTS_CLICK); return [gx + pn.ox + D * gs * 6, gy + pn.oy - gs * 34]; } });
      return ws;
    },
    over(o, t) { if (t < MT.SPLASH) S_.over(o, t); else gnsDust(o, t); },   // from the splash on: no hat, no speed lines (the loser is the food); the dust blows on
    food() { const x = ttsConeX(); return { x, y: 0, r: 13 * TTS_CS, y0: -42 * TTS_CS, lx: x + FIN.dir * 46 }; },   // (he lands clear of the empty cone)
    cues(t) {
      S_.cues(t);
      cueOnce("ttsPuff", TTS_PUFF, () => Cin.go(() => { Cin._noise(0.2, 0.3, 900, 3000, "bandpass", 1); Cin._osc("sine", 300, 700, 0.12, 0.08, 0.004); }));
      for (let i = 0; i < TTS_N; i++) cueOnce("ttsPlink" + i, ttsLand(i), () => Cin.go(() => Cin._osc("triangle", 1500 + i * 120, 1300 + i * 100, 0.07, 0.05, 0.002)));
      cueOnce("ttsCock", TTS_COCK, () => Cin.go(() => { Cin.clack(); Cin.tick(2200); }));
      for (let i = 0; i < 5; i++) {
        cueOnce("ttsShot" + i, ttsShot(i), () => Cin.go(() => gnsBang(0.55, false)));
        cueOnce("ttsPing" + i, ttsHit(i), () => Cin.go(() => Cin._osc("sine", 2900 - i * 90, 2000, 0.3, 0.05, 0.002)));
      }
      cueOnce("ttsClick", TTS_CLICK, () => Cin.go(() => Cin.tick(1800)));
      cueOnce("ttsPhew", TTS_PHEW, () => Cin.go(() => { Cin._noise(0.4, 0.05, 1200, 500, "bandpass", 1); Cin._osc("triangle", 640, 400, 0.35, 0.03, 0.03); }));
      cueOnce("ttsDrip", MT.AFTER + 260, () => Cin.go(() => Cin._osc("sine", 1100, 500, 0.09, 0.05, 0.003)));
    },
  });
  /* ===================== the second Potatality, "Loaded" (MANGA.gunslinger.alt2; design: Project files step8/fable-design-2.md §1.7) =====================
     High Noon up to the shot (as in Tater Tots, the loser's hat and the speed lines stop at the splash). 3250 panel 5, the splash, drops in from the top:
     his revolver's cylinder swung open, end-on, over a red disc: five chambers hold the toppings (cheese, bacon, chives, sour cream, butter), the sixth, at
     the top, holds the loser, squeezed in (CH-CHK); 3300-3680 it spins two turns and stops with him on top again; 3700 it snaps shut (click), flying into
     the gun: the street, the Gunslinger aiming down at a tin plate on the ground; 3800 the hammer back; 3850 one shot (BANG): the loser comes down the line
     and lands in the plate as a potato-skin boat, split open (3890); 3970-4290 the toppings rain into it, one every 80 ms, the sour cream last, on his head;
     4300 he raises the barrel, 4390 blows the smoke off it (fuu), 4520 tips his hat with it; the loser blinks under the dollop. 4700 in panel 4's place:
     a barrel beside him as a table, the plate on it with the loaded boat; he twirls the revolver (4780-5080) and drops it in the holster (5170);
     the engine's POP bursts the boat at 5250 (food()) and leaves it split in two on the plate, a chive and the dollop beside it.
     The splash's world is the street's (he stands at FIN.wx, the ground is y = 0, the plate lies in front of him, nearer to us: lodGeo()); the cylinder is drawn in px of the panel.
     Every helper here is prefixed lod. */
  const LOD = { SPIN0: 3300, SPIN1: 3680, SHUT: 3700, COCK: 3800, SHOT: 3850, LAND: 3890, RAISE: 4300, BLOW: 4390, TIP0: 4520, TIP1: 4610, TWIRL0: 4780, TWIRL1: 5080, HOLSTER: 5170 };
  const LOD_TOPS = ["cheese", "bacon", "chive", "cream", "butter"];   // the chambers after his, clockwise
  const LOD_RAIN = ["cheese", "bacon", "chive", "butter", "cream"];   // the order they rain in (the sour cream last: it lands on his head)
  const lodRainT = (k) => 3970 + k * 80;                               // when the k-th lands (3970 .. 4290), after a fall of LOD_FALL ms
  const LOD_FALL = 170, LOD_BL = 24, LOD_BH = 13, LOD_BT = 27;          // the boat's half length and depth (world units); the barrel table's height
  const LOD_SPECK = [[-17, 4, 0.3], [-9, 8, -0.5], [-2, 3, 1.1], [6, 9, 0.2], [13, 4, -0.4], [18, 1, 0.8], [-13, 1, 1.4], [9, 2, -1]];   // the skin's specks (boat units)
  const LOD_BLINK = [4430, 4600, 5010, 5190];                           // the loser blinks under the dollop
  const lodPort = () => !!(MG.lay && MG.lay.port);
  // the plate in the splash: its middle, its foot (y below the street's line: it lies nearer to us) and its scale (drawn big, in front)
  const lodGeo = () => (lodPort() ? [FIN.wx + FIN.dir * 50, 104, 2] : [FIN.wx + FIN.dir * 125, 24, 1.6]);
  const lodTX = () => FIN.wx + FIN.dir * 76;                            // the barrel table in panel 4
  let lodC = null, lodMz = null;   // the loser's colours on the boat (made in build); the muzzle (world units) at the shot and as the smoke is born
  function lodPrep() {
    const body = L_().pal.body || "#e9c070";
    lodC = { skin: body, crust: mix(body, "#5a2c0c", 0.5), flesh: mix(body, "#fff6dc", 0.62) };
    return lodC;
  }
  // the smoke's puffs are born at these moments, off the muzzle as it is then (cached: the pose is not cheap)
  const LOD_PUFF = [3860, 3940, 4020, 4100, 4180, 4320, 4350, 4380];
  function lodMuzzles() { if (!lodMz) lodMz = { shot: gnsMuzzle(LOD.SHOT), puff: LOD_PUFF.map((b) => gnsMuzzle(b)) }; return lodMz; }
  function lodHand(t) { MG.pt = t; const W = W_(), P = pose(W, mgTk(t)); return [W.x + W.facing * P.hF[0], W.y + P.hF[1], P.holdAng || 0]; }

  /* ---- the cylinder, end-on: (cx, cy) its middle and R its radius (px of the panel), turned by a; spin 0..1: how fast it turns (the blur) ---- */
  function lodCyl(c, cx, cy, R, a, spin, t) {
    const lw = Math.max(2, R * 0.022), rr = R * 0.56, cr = R * 0.25, D = FIN.dir;
    const dF = R * 1.07, rF = R * 0.15, th = Math.acos((R * R + dF * dF - rF * rF) / (2 * R * dF));
    const outline = (ox, oy) => {   // the rim, with the six flutes cut into it between the chambers
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const f0 = a + (i + 0.5) * TAU / 6 - Math.PI / 2, f1 = f0 + TAU / 6, fx = ox + Math.cos(f1) * dF, fy = oy + Math.sin(f1) * dF;
        c.arc(ox, oy, R, f0 + th, f1 - th);
        const ax = ox + Math.cos(f1 - th) * R - fx, ay = oy + Math.sin(f1 - th) * R - fy, bx = ox + Math.cos(f1 + th) * R - fx, by = oy + Math.sin(f1 + th) * R - fy;
        c.arc(fx, fy, rF, Math.atan2(ay, ax), Math.atan2(by, bx), true);
      }
      c.closePath();
    };
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = INK;
    // its side, seen past the face (the same outline, down and away, in dark steel), then the face
    outline(cx - D * R * 0.05, cy + R * 0.075); c.fillStyle = "#6f7580"; c.fill(); c.lineWidth = lw; c.stroke();
    outline(cx, cy); c.fillStyle = "#c3c8d0"; c.fill();
    if (!MG.slow) { c.save(); c.clip(); c.beginPath(); c.moveTo(cx - R * 1.2, cy + R * 0.3); c.lineTo(cx + R * 1.2, cy - R * 0.25); c.lineTo(cx + R * 1.2, cy + R * 1.2); c.lineTo(cx - R * 1.2, cy + R * 1.2); c.closePath(); ttsToneHere(c, 7, 0.32); c.restore(); }
    outline(cx, cy); c.lineWidth = lw; c.stroke();
    c.strokeStyle = "#ffffff"; c.lineWidth = lw * 1.5; c.beginPath(); c.arc(cx, cy, R * 0.9, -2.75, -2.0); c.stroke(); c.strokeStyle = INK;   // a glint on the rim
    // the ratchet in the middle: a six-point star round the pin hole
    c.beginPath();
    for (let i = 0; i < 12; i++) { const an = a + (i / 12) * TAU - Math.PI / 2, r = i % 2 ? R * 0.1 : R * 0.18; i ? c.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r) : c.moveTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); }
    c.closePath(); c.fillStyle = "#9aa0aa"; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, R * 0.055, 0, TAU); c.fill();
    // the chambers: a bevelled mouth, what is loaded in it, an ink ring
    for (let i = 0; i < 6; i++) {
      const an = a + i * TAU / 6 - Math.PI / 2, x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr;
      c.beginPath(); c.arc(x, y, cr * 1.15, 0, TAU); c.fillStyle = "#9aa0aa"; c.fill(); c.lineWidth = lw * 0.7; c.stroke();
      c.save(); c.beginPath(); c.arc(x, y, cr, 0, TAU); c.clip();
      if (i === 0) lodChamberL(c, x, y, cr, t, lw); else lodChamberTop(c, LOD_TOPS[i - 1], x, y, cr, lw);
      c.restore();
      c.beginPath(); c.arc(x, y, cr, 0, TAU); c.lineWidth = lw * 1.1; c.strokeStyle = INK; c.stroke();
      if (spin > 0.12) {   // turning: ink arcs trail behind each chamber
        c.save(); c.globalAlpha = Math.min(1, spin * 1.4); c.lineWidth = lw * 0.8;
        for (const o of [-0.62, 0, 0.62]) { c.beginPath(); c.arc(cx, cy, rr + o * cr, an - 0.34 - 0.95 * spin, an - 0.34); c.stroke(); }
        c.restore();
      }
    }
  }
  // the loser, squeezed into his chamber: he fills it to the brim, eyes wide, sweating
  function lodChamberL(c, x, y, r, t, lw) {
    const C = lodC || lodPrep();
    c.fillStyle = C.skin; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    c.fillStyle = C.crust;
    for (let i = 0; i < 4; i++) { const an = i * 1.7 + 0.4; c.beginPath(); c.ellipse(x + Math.cos(an) * r * 0.72, y + Math.sin(an) * r * 0.72, r * 0.07, r * 0.035, an, 0, TAU); c.fill(); }
    ttsFace(c, x, y - r * 0.08, r * 1.9, 1, "terror", 1, false);
    // pressed in: short ink marks round the rim
    c.strokeStyle = INK; c.lineWidth = lw * 0.7;
    for (const an of [0.3, 1.2, 2.2, 3.1, 4.3, 5.4]) { c.beginPath(); c.moveTo(x + Math.cos(an) * r * 0.86, y + Math.sin(an) * r * 0.86); c.lineTo(x + Math.cos(an + 0.22) * r * 0.86, y + Math.sin(an + 0.22) * r * 0.86); c.stroke(); }
    ttsDrop(c, x + r * 0.58, y - r * 0.3 + (t % 600) * r * 0.0004, r * 0.09, lw * 0.6);
  }
  // a chamber's topping, filling it (x, y, r: px of the panel)
  function lodChamberTop(c, kind, x, y, r, lw) {
    c.lineCap = "round"; c.lineJoin = "round";
    if (kind === "cheese") {
      c.fillStyle = "#ffc22e"; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.strokeStyle = "#d9840e"; c.lineWidth = r * 0.11;
      for (let j = 0; j < 8; j++) { const an = j * 2.3, px = x + Math.cos(an) * r * (0.2 + 0.09 * (j % 4)) * 2, py = y + Math.sin(an * 1.3) * r * 0.55; c.beginPath(); c.moveTo(px - r * 0.22, py); c.quadraticCurveTo(px, py - r * 0.18 * (j % 2 ? 1 : -1), px + r * 0.22, py); c.stroke(); }
    } else if (kind === "bacon") {
      c.fillStyle = "#c9473b"; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.strokeStyle = "#f6c2b4"; c.lineWidth = r * 0.17;
      for (const o of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(x - r, y + o * r); c.bezierCurveTo(x - r * 0.4, y + (o - 0.25) * r, x + r * 0.2, y + (o + 0.25) * r, x + r, y + o * r - r * 0.1); c.stroke(); }
    } else if (kind === "chive") {
      c.fillStyle = "#e4f2d6"; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      for (const [u, v] of [[-0.45, -0.4], [0.15, -0.55], [0.5, -0.1], [-0.1, 0.05], [-0.55, 0.25], [0.3, 0.45], [-0.15, 0.6]]) {
        c.beginPath(); c.arc(x + u * r, y + v * r, r * 0.16, 0, TAU); c.strokeStyle = INK; c.lineWidth = r * 0.15; c.stroke(); c.strokeStyle = "#4f9d3c"; c.lineWidth = r * 0.09; c.stroke();
      }
    } else if (kind === "cream") {
      c.fillStyle = "#ffffff"; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.strokeStyle = INK; c.lineWidth = lw * 0.7; c.beginPath();
      for (let s = 0; s <= 24; s++) { const an = s * 0.42, rr = r * 0.08 + s * r * 0.028; s ? c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr) : c.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      c.stroke();
    } else {   // butter: a pat of it
      c.fillStyle = "#fff0b3"; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.save(); c.translate(x, y); c.rotate(0.3);
      c.beginPath(); c.rect(-r * 0.5, -r * 0.42, r, r * 0.84); c.fillStyle = "#ffd84a"; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
      c.strokeStyle = "#ffffff"; c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(-r * 0.36, -r * 0.28); c.lineTo(r * 0.2, -r * 0.28); c.stroke();
      c.restore();
    }
  }

  /* ---- the boat: the loser as half a potato skin, hollowed, lying in the plate (world units) ---- */
  // one topping where it sits on the boat (its frame: the cut at y = 0); spread 0 (a clump, falling) .. 1 (landed: the cheese melts over the rim, the butter runs)
  function lodTopping(c, kind, spread, lw, faceX) {
    c.lineCap = "round"; c.lineJoin = "round";
    if (kind === "cheese") {
      for (let j = 0; j < 7; j++) {
        const x = (-16 + j * 5.4 + (j % 2) * 1.2) * (0.35 + 0.65 * spread), y = -1.4 - (j % 3) * 1.1, a = (j % 2 ? 0.5 : -0.4);
        c.beginPath(); c.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3); c.quadraticCurveTo(x, y - 1.6, x + Math.cos(a) * 3, y + Math.sin(a) * 3);
        c.strokeStyle = INK; c.lineWidth = 2.8 + lw; c.stroke(); c.strokeStyle = "#ffc22e"; c.lineWidth = 2.8; c.stroke();
      }
      const sg = (faceX || 0) > 0 ? -1 : 1;
      if (spread >= 1) for (const [o, len] of [[-15, 4.5], [10.5, 6.5], [19.5, 3.8]]) {   // melting down the skin (clear of his face)
        const x = (faceX || 0) + sg * o;
        c.beginPath(); c.moveTo(x, -0.5); c.lineTo(x + 0.3, len);
        c.strokeStyle = INK; c.lineWidth = 2.6 + lw; c.stroke(); c.strokeStyle = "#ffc22e"; c.lineWidth = 2.6; c.stroke();
      }
    } else if (kind === "bacon") {
      for (const [x, y, a] of [[-12, -2.6, 0.3], [-4.5, -3.6, -0.5], [5.5, -3, 0.8], [13.5, -2.2, -0.2], [0.5, -1.4, 1.2]]) {
        c.save(); c.translate(x * (0.4 + 0.6 * spread), y); c.rotate(a);
        c.beginPath(); c.rect(-2.6, -1.3, 5.2, 2.6); c.fillStyle = "#c9473b"; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
        c.strokeStyle = "#f6c2b4"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-2, 0.1); c.lineTo(2, -0.2); c.stroke();
        c.restore();
      }
    } else if (kind === "chive") {
      for (const [x, y] of [[-15, -2.2], [-8, -4.4], [-1, -2.6], [4, -5], [9.5, -3], [16, -1.8], [-4, -5.6]]) {
        c.beginPath(); c.arc(x * (0.4 + 0.6 * spread), y, 1.15, 0, TAU); c.strokeStyle = INK; c.lineWidth = 1.5 + lw * 0.6; c.stroke(); c.strokeStyle = "#5fae4a"; c.lineWidth = 1.1; c.stroke();
      }
    } else if (kind === "butter") {
      if (spread >= 1) { c.beginPath(); c.ellipse(10.5, -1.2, 6.5, 1.6, 0, 0, TAU); c.fillStyle = "#ffe98a"; c.fill(); }   // running
      c.save(); c.translate(10.5, -3.6); c.rotate(0.14);
      c.beginPath(); c.rect(-3.4, -2.4, 6.8, 4.8); c.fillStyle = "#ffd84a"; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(-3.4, -2.4); c.lineTo(-1.8, -3.6); c.lineTo(5, -3.6); c.lineTo(3.4, -2.4); c.closePath(); c.fillStyle = "#fff0b3"; c.fill(); c.stroke();
      c.restore();
    } else {   // the sour cream: a dollop, three lobes and a curl, over his face ("on his head")
      const x = faceX || 0;
      c.fillStyle = "#ffffff"; c.strokeStyle = INK; c.lineWidth = lw * 0.9;
      for (const [dy, rx, ry] of [[-2.4, 7.2, 3.3], [-5.6, 5.2, 2.8], [-8.4, 3.2, 2.2]]) { c.beginPath(); c.ellipse(x, dy, rx, ry, 0, 0, TAU); c.fill(); c.stroke(); }
      c.beginPath(); c.moveTo(x - 1.6, -10); c.quadraticCurveTo(x + 0.6, -14.4, x + 2.8, -12.2); c.lineWidth = 2.2 + lw; c.stroke(); c.strokeStyle = "#ffffff"; c.lineWidth = 2.2; c.stroke();
      c.beginPath(); c.ellipse(x + 2.4, -6, 1.4, 0.8, 0.3, 0, TAU); c.fillStyle = "#e4e6ea"; c.fill();
    }
  }
  // the boat at (x, y) (the middle of its bottom), s its scale, sq the landing squash; n toppings in (in LOD_RAIN order); his face: ex / exK / hurt, looking toward dx
  function lodBoat(c, x, y, s, sq, n, ex, exK, hurt, lw, dx) {
    const C = lodC || lodPrep(), bl = LOD_BL, bh = LOD_BH, fx = dx * 3;
    c.save(); c.translate(x, y); c.scale(s * (1 + (1 - sq) * 0.6), s * sq);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = INK;
    const shell = () => { c.beginPath(); c.moveTo(-bl, -bh); c.ellipse(0, -bh, bl, bh, 0, Math.PI, 0, true); c.closePath(); };
    shell(); c.fillStyle = C.skin; c.fill();
    c.save(); c.clip();
    c.fillStyle = C.crust;
    for (const [sx, sy, a] of LOD_SPECK) { c.beginPath(); c.ellipse(sx, sy - bh, 1.7, 0.8, a, 0, TAU); c.fill(); }
    if (!MG.slow) { c.beginPath(); c.ellipse(0, -bh * 0.35, bl * 1.1, bh * 0.9, 0, 0.15, Math.PI - 0.15); c.lineTo(-bl * 1.2, bh); c.lineTo(bl * 1.2, bh); c.closePath(); ttsToneHere(c, 6, 0.35); }   // the shade under the belly
    c.restore();
    shell(); c.lineWidth = lw * 1.1; c.stroke();
    // the cut: the hollowed flesh inside, its far wall in shade
    c.beginPath(); c.ellipse(0, -bh, bl - 1, 3.6, 0, 0, TAU); c.fillStyle = C.flesh; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
    if (!MG.slow) { c.beginPath(); c.ellipse(0, -bh + 0.4, bl - 4.5, 2.2, 0, Math.PI, TAU); c.closePath(); ttsToneHere(c, 6, 0.45); }
    ttsFace(c, fx, -bh * 0.5, 19, dx, ex, exK, hurt);
    c.translate(0, -bh);
    for (let k = 0; k < n; k++) lodTopping(c, LOD_RAIN[k], 1, lw, fx);
    c.restore();
  }
  // after the pop: the skin split in two, rocked apart, a chive and the dollop beside it
  function lodEmpty(c, x, y, lw, D) {
    const C = lodC || lodPrep(), bl = LOD_BL, bh = LOD_BH;
    c.lineJoin = "round"; c.lineCap = "round";
    for (const sd of [-1, 1]) {
      c.save(); c.translate(x + sd * 6, y); c.rotate(sd * 0.2);
      c.beginPath(); c.moveTo(0, -bh); for (let i = 1; i <= 4; i++) c.lineTo(sd * (i % 2 ? 1.6 : -0.6), -bh + i * bh / 4); c.lineTo(sd * bl * 1.3, bh); c.lineTo(sd * bl * 1.3, -bh * 2.5); c.closePath(); c.clip();
      c.translate(-sd * 1.5, 0);
      c.beginPath(); c.moveTo(-bl, -bh); c.ellipse(0, -bh, bl, bh, 0, Math.PI, 0, true); c.closePath(); c.fillStyle = C.skin; c.fill();
      c.fillStyle = C.crust; for (const [sx, sy, a] of LOD_SPECK) { c.beginPath(); c.ellipse(sx, sy - bh, 1.7, 0.8, a, 0, TAU); c.fill(); }
      c.lineWidth = lw * 1.1; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.ellipse(0, -bh, bl - 1, 3.6, 0, 0, TAU); c.fillStyle = C.flesh; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
      c.translate(0, -bh); lodTopping(c, "cheese", 1, lw);
      c.restore();
      // the split edge, inked
      c.save(); c.translate(x + sd * 6, y); c.rotate(sd * 0.2); c.translate(-sd * 1.5, 0);
      c.beginPath(); c.moveTo(0, -bh); for (let i = 1; i <= 4; i++) c.lineTo(sd * (i % 2 ? 1.6 : -0.6), -bh + i * bh / 4); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
      c.restore();
    }
    c.save(); c.translate(x + D * 30, y - 2); lodTopping(c, "cream", 1, lw, 0); c.restore();       // the dollop, beside it
    c.save(); c.translate(x - D * 27, y - 0.5); c.beginPath(); c.arc(0, -1.3, 1.3, 0, TAU); c.strokeStyle = INK; c.lineWidth = 1.7 + lw * 0.6; c.stroke(); c.strokeStyle = "#5fae4a"; c.lineWidth = 1.2; c.stroke(); c.restore();   // a chive
  }
  // a tin plate seen from low down, (x, y) the middle of its foot, rx its radius; front: only its front lip (drawn over what lies in it)
  function lodPlate(c, x, y, rx, lw, front) {
    const ry = rx * 0.2, cy = y - ry * 0.8;
    c.lineJoin = "round"; c.strokeStyle = INK;
    if (!front) {
      c.beginPath(); c.ellipse(x, cy, rx, ry, 0, 0, TAU); c.fillStyle = "#c6cad1"; c.fill(); c.lineWidth = lw; c.stroke();
      c.beginPath(); c.ellipse(x, cy + ry * 0.12, rx * 0.74, ry * 0.6, 0, 0, TAU); c.fillStyle = "#a9afb8"; c.fill(); c.lineWidth = lw * 0.6; c.stroke();
      c.strokeStyle = "#ffffff"; c.lineWidth = lw; c.beginPath(); c.ellipse(x, cy, rx * 0.87, ry * 0.68, 0, 3.5, 4.3); c.stroke();
      return;
    }
    c.beginPath(); c.ellipse(x, cy, rx, ry, 0, 0, Math.PI); c.ellipse(x, cy + ry * 0.12, rx * 0.74, ry * 0.6, 0, Math.PI, 0, true); c.closePath();
    c.fillStyle = "#c6cad1"; c.fill(); c.lineWidth = lw; c.stroke();
    if (!MG.slow) { c.beginPath(); c.ellipse(x, cy, rx, ry, 0, 0.2, 1.3); c.ellipse(x, cy + ry * 0.12, rx * 0.74, ry * 0.6, 0, 1.3, 0.2, true); c.closePath(); ttsToneHere(c, 6, 0.4); }
  }
  // his face in the boat at t: [expr, exK, hurt]: spiral-eyed as he lands, eyes squeezed shut at each topping, then wide under the dollop, blinking
  function lodFace(t) {
    if (t < LOD.LAND + 100) return ["dazed", 1, false];
    for (let k = 0; k < 5; k++) { const lt = lodRainT(k); if (t >= lt - 15 && t < lt + 70) return ["", 1, true]; }
    for (const b of LOD_BLINK) if (Math.abs(t - b) < 45) return ["calm", 1, false];
    return ["terror", t < lodRainT(4) ? 0.7 : 0.35, false];
  }
  const lodRainN = (t) => { let n = 0; for (let k = 0; k < 5; k++) if (t >= lodRainT(k)) n = k + 1; return n; };
  // the boat's squash: landing in the plate, and a little at each topping
  const lodSquash = (t) => { let s = 0.3 * Math.sin(Math.PI * fe(LOD.LAND, LOD.LAND + 150, t)); for (let k = 0; k < 5; k++) s = Math.max(s, (k === 4 ? 0.14 : 0.07) * Math.sin(Math.PI * fe(lodRainT(k), lodRainT(k) + 110, t))); return 1 - s; };

  /* ---- the splash ---- */
  function lodCam(t, pn) {
    const D = FIN.dir, k = fe(LOD.SHUT, MT.AFTER, t);
    if (lodPort()) { const vh = (pn.h * 162 / pn.w) * (1 - 0.04 * k); return { wx: FIN.wx + D * 43, wy: 4, vh }; }
    const vh = 142 * (1 - 0.05 * k); return { wx: FIN.wx + D * 62, wy: -26, vh };
  }
  const lodShake = (t) => {
    const a = 2.5 * fe(LOD.SHOT, LOD.SHOT + 8, t) * (1 - fe(LOD.SHOT + 8, LOD.SHOT + 90, t)) + 3 * fe(LOD.LAND, LOD.LAND + 8, t) * (1 - fe(LOD.LAND + 8, LOD.LAND + 150, t));
    return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a * 0.6] : [0, 0];
  };
  // the cylinder's middle and radius on the splash (px of the panel), and how far it has turned
  function lodCylAt(pn) { const m = Math.min(pn.w, pn.h); return [pn.x0 + pn.w * 0.5, pn.y0 + pn.h * (lodPort() ? 0.47 : 0.53), m * 0.35]; }
  const lodTurn = (t) => TAU * 2 * easeOut(fe(LOD.SPIN0, LOD.SPIN1, t)) + 0.07 * Math.sin(Math.PI * fe(LOD.SPIN1, LOD.SPIN1 + 70, t));
  // 3250-3700: the cylinder swung open over a red disc cut by paper stripes, focus lines all round
  function lodOpen(c, pn, t) {
    const [cx, cy, R] = lodCylAt(pn), u = fe(LOD.SPIN0, LOD.SPIN1, t);
    if (!MG.slow) gnsTone(c, pn, [[pn.x0 - 6, pn.y0 - 6], [pn.x1 + 6, pn.y0 - 6], [pn.x1 + 6, pn.y1 + 6], [pn.x0 - 6, pn.y1 + 6]], 8, 0.14, [t * 0.0006, 0]);
    mgFocus(c, cx, cy, Math.hypot(pn.w, pn.h) * 0.62, t * 0.0004, 0.75);
    const RD = R * 1.32;
    c.fillStyle = COL; c.beginPath(); c.arc(cx, cy, RD, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, RD, 0, TAU); c.clip(); c.fillStyle = PAPER;
    for (let i = 0; i < 4; i++) c.fillRect(cx - RD - 4, cy + RD * (0.32 + i * 0.17), 2 * RD + 8, RD * (0.025 + 0.025 * i));
    c.restore();
    c.lineWidth = Math.max(2, R * 0.02); c.strokeStyle = INK; c.beginPath(); c.arc(cx, cy, RD, 0, TAU); c.stroke();
    lodCyl(c, cx, cy, R, lodTurn(t), u > 0 && u < 1 ? 1 - u : 0, t);
  }
  // 3700: it snaps shut, flying into the gun in his hand (over the street), speed lines behind it
  function lodSnap(c, pn, t) {
    const u = easeIn(fe(LOD.SHUT, LOD.SHUT + 90, t));
    if (t < LOD.SHUT || u >= 1) return;
    const [cx, cy, R] = lodCylAt(pn), h = lodHand(LOD.SHUT + 90), q = pn.p(h[0] + FIN.dir * 4, h[1] - 6), x = lerp(cx, q[0], u), y = lerp(cy, q[1], u), r = lerp(R, 3 * pn.z, u);
    const ang = Math.atan2(q[1] - cy, q[0] - cx), len = Math.hypot(q[0] - cx, q[1] - cy);
    c.save(); c.beginPath(); c.rect(pn.x0, pn.y0, pn.w, pn.h); c.clip();
    mgSpeed(c, x - Math.cos(ang) * len * 0.5, y - Math.sin(ang) * len * 0.5, len, r * 2.2, ang, -t * 1.5, 0.8 * (1 - u), false, 0.8);
    c.restore();
    lodCyl(c, x, y, r, lodTurn(t) + u * 1.2, 0.6, t);
  }
  // the hammer back: three short marks over his hand
  function lodCock(c, pn, t) {
    const k = Math.sin(Math.PI * fe(LOD.COCK, LOD.COCK + 160, t));
    if (k < 0.05) return;
    const h = lodHand(t), p = pn.p(h[0] - FIN.dir * 2, h[1] - 6), z = pn.z, D = FIN.dir;
    c.save(); c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = Math.max(1.6, 0.55 * z);
    for (const a of [-2.3, -1.6, -0.9]) { const ca = Math.cos(a) * D, sa = Math.sin(a), r0 = 5 * z, r1 = r0 + 5 * z * k; c.beginPath(); c.moveTo(p[0] + ca * r0, p[1] + sa * r0); c.lineTo(p[0] + ca * r1, p[1] + sa * r1); c.stroke(); }
    c.restore();
  }
  // the shot: a smoking line from the muzzle to the plate, the loser down it (a potato, spiral-eyed, squashed along the line), the white hit on the plate
  function lodShot(c, pn, t, lw) {
    const dt = t - LOD.SHOT;
    if (dt < 0 || dt > 420) return;
    const z = pn.z, [gx, gy, gs] = lodGeo(), m = pn.p(...lodMuzzles().shot), q = pn.p(gx, gy - (lodPlateY() + LOD_BH * 0.6) * gs), ang = Math.atan2(q[1] - m[1], q[0] - m[0]);
    if (dt < 320) {
      const s = lerp2(m, q, ease(fe(80, 320, dt))), e = lerp2(m, q, easeOut(fe(0, 40, dt)));
      c.lineCap = "butt"; c.strokeStyle = INK; c.lineWidth = Math.max(2.6, 1.2 * z); c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(e[0], e[1]); c.stroke();
      c.strokeStyle = COL; c.lineWidth = Math.max(1.2, 0.5 * z); c.stroke();
    }
    if (t < LOD.LAND) {
      const C = lodC || lodPrep(), p = lerp2(m, q, easeIn(fe(LOD.SHOT, LOD.LAND, t)));
      c.save(); c.translate(p[0], p[1]); c.rotate(ang); c.scale(z, z);
      c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = 1.2;
      for (const o of [-4, 0, 4]) { c.beginPath(); c.moveTo(-12, o); c.lineTo(-30 - Math.abs(o) * 1.5, o); c.stroke(); }
      c.beginPath(); c.ellipse(0, 0, 11, 7, 0, 0, TAU); c.fillStyle = C.skin; c.fill(); c.lineWidth = Math.max(1, lw); c.stroke();
      c.rotate(-ang); ttsFace(c, 0, -1, 13, FIN.dir, "dazed", 1, false);
      c.restore();
    }
    const hb = fe(LOD.LAND, LOD.LAND + 170, t);
    if (hb > 0 && hb < 1) {
      mgStarburst(c, q[0], q[1] - 2 * z, (26 - 14 * hb) * z * gs * 0.7, 0.3);
      c.save(); c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = Math.max(1.4, 0.5 * z); c.globalAlpha = 1 - hb;   // the plate rings
      const g = pn.p(gx, gy - 3 * gs), zs = z * gs;
      for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { const x = g[0] + sd * (34 + 6 * j + 8 * hb) * zs, y = g[1] - (2 + j * 5) * zs; c.beginPath(); c.moveTo(x, y); c.lineTo(x + sd * 5 * zs, y - 2 * zs); c.stroke(); }
      c.restore();
    }
  }
  // the toppings in the air: each falls from over the top of the page into the boat, turning a little, with two streaks over it
  function lodRain(c, pn, t, lw) {
    const [x, y, s] = lodGeo(), top = (pn.wy - pn.h / (2 * pn.z) - 24 - y) / s, land = -lodPlateY() - LOD_BH, ls = lw / s * 1.1;
    for (let k = 0; k < 5; k++) {
      const t1 = lodRainT(k), t0 = t1 - LOD_FALL;
      if (t < t0 || t >= t1) continue;
      const u = fe(t0, t1, t), D = FIN.dir;
      pn.world(c);
      c.save(); c.translate(x, y); c.scale(s, s); c.translate(0, lerp(top, land, u * u)); c.rotate(D * (1 - u) * 0.5);
      c.strokeStyle = INK; c.lineWidth = lw * 0.7; c.lineCap = "round";
      c.lineWidth = ls * 0.7; for (const o of [-6, 5]) { c.beginPath(); c.moveTo(o, -10); c.lineTo(o, -26); c.stroke(); }
      lodTopping(c, LOD_RAIN[k], 0.25, ls, -D * 3);
      c.restore();
    }
    pn.screen(c);
  }
  const lodPlateY = () => 1.6;   // how far the boat's bottom sits above the ground, in the plate's well
  // the smoke off the muzzle: puffs born at the shot and as he raises the barrel; at the blow they are torn off along his breath
  function lodSmoke(c, pn, t) {
    if (t < LOD.SHOT) return;
    const z = pn.z, M = lodMuzzles(), mo = pn.p(...gnsPt(W_(), LOD.BLOW, "mouthPt")), bl = t - LOD.BLOW;
    for (let i = 0; i < LOD_PUFF.length; i++) {
      const age = t - LOD_PUFF[i];
      if (age <= 0) continue;
      const b = pn.p(...M.puff[i]), k = clamp(age / 700, 0, 1);
      let x = b[0] + Math.sin(age * 0.005 + i * 2) * 3 * z, y = b[1] - age * 0.024 * z, a = 1 - fe(0.55, 1, k);
      if (bl > 0) {
        let ux = x - mo[0], uy = y - mo[1]; const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
        x += ux * bl * 0.1 * z; y += uy * bl * 0.1 * z - bl * 0.015 * z; a *= 1 - fe(60, 300, bl);
      }
      if (a > 0.03) gnsPuff(c, pn, x, y, (2 + 4 * easeOut(k)) * z * 0.8, a, 150 + i);
    }
  }
  function lodDrawSplash(c, pn, t) {
    pn.screen(c);
    if (t < LOD.SHUT) { lodOpen(c, pn, t); return; }
    const D = FIN.dir, lw = Math.max(1.1, 3 / pn.z), [x, y, s] = lodGeo(), f = lodFace(t), W = W_(), ls = lw / s * 1.1;
    gnsStreet(c, pn, t, x + D * 10, 76, 0.12 + 0.1 * fe(LOD.SHUT, MT.AFTER, t));
    mgPuppet(c, pn, W, t, { light: dirAng(-0.45), post: gnsBrim(W, t, 0.8) });
    pn.world(c);   // the plate lies in front of him, nearer to us: drawn big, over the street
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = INK; c.beginPath(); c.ellipse(0, 0.6, 30, 2.6, 0, 0, TAU); c.fill();   // its shadow
    lodPlate(c, 0, 0, 32, ls, false);
    if (t >= LOD.LAND) lodBoat(c, 0, -lodPlateY(), 1, lodSquash(t), lodRainN(t), f[0], f[1], f[2], ls, -D);
    lodPlate(c, 0, 0, 32, ls, true);
    c.restore();
    pn.screen(c);
    lodCock(c, pn, t);
    lodSmoke(c, pn, t);
    lodShot(c, pn, t, lw);
    lodRain(c, pn, t, lw);
    lodSnap(c, pn, t);
  }

  /* ---- panel 4: the barrel as a table, the plate on it with the loaded boat (split once the engine has popped it); the twirl ---- */
  function lodTable(c, pn, t) {
    const D = FIN.dir, x = lodTX(), lw = Math.max(1.1, 3 / pn.z), bt = LOD_BT;
    pn.world(c);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = INK;
    const body = () => { c.beginPath(); c.moveTo(x - 12, -bt); c.quadraticCurveTo(x - 15.5, -bt / 2, x - 12, 0); c.lineTo(x + 12, 0); c.quadraticCurveTo(x + 15.5, -bt / 2, x + 12, -bt); c.closePath(); };
    body(); c.fillStyle = "#c99a68"; c.fill();
    c.save(); c.clip();
    if (!MG.slow) { c.beginPath(); c.rect(D > 0 ? x + 4 : x - 20, -bt - 4, 16, bt + 8); ttsToneHere(c, 6, 0.45); }
    c.lineWidth = lw * 0.6; c.beginPath(); for (const s of [-6, 0, 6]) { c.moveTo(x + s, -bt); c.quadraticCurveTo(x + s * 1.25, -bt / 2, x + s, 0); } c.stroke();
    c.fillStyle = "#4b4f57"; for (const y of [-bt * 0.78, -bt * 0.22]) c.fillRect(x - 17, y - 1.5, 34, 3);
    c.restore();
    body(); c.lineWidth = lw; c.stroke();
    c.beginPath(); c.ellipse(x, -bt, 12, 2.8, 0, 0, TAU); c.fillStyle = "#dcb784"; c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.ellipse(x, 0.8, 15, 2, 0, 0, TAU); c.fill();   // its shadow
    lodPlate(c, x, -bt, 30, lw, false);
    if (!mgPopped(t)) {
      const f = lodFace(t);
      lodBoat(c, x, -bt - lodPlateY(), 1, 1 - 0.03 * Math.sin(t * 0.012), 5, f[0], f[1], f[2], lw, -D);
      // steam: two curls off the hot potato
      c.save(); c.globalAlpha = 0.75 * fe(MT.AFTER, MT.AFTER + 200, t); c.lineWidth = lw * 0.7;
      for (let i = 0; i < 2; i++) {
        const sx = x + (i ? 13 : -14), ph = ((t - MT.AFTER) * 0.018 + i * 9) % 18;
        c.beginPath(); for (let j = 0; j <= 8; j++) { const yy = -bt - 24 - ph - j * 1.9, xx = sx + Math.sin(j * 0.8 + t * 0.006 + i * 2) * 2; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
      }
      c.restore();
    } else lodEmpty(c, x, -bt - lodPlateY(), lw, D);
    lodPlate(c, x, -bt, 30, lw, true);
    pn.screen(c);
  }
  // the twirl: ink arcs round his hand while the revolver spins on his finger
  function lodTwirl(c, pn, t) {
    const u = fe(LOD.TWIRL0, LOD.TWIRL1, t);
    if (u <= 0 || u >= 1) return;
    const h = lodHand(t), p = pn.p(h[0], h[1]), z = pn.z, a = h[2], sp = 1 - u;
    c.save(); c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = Math.max(2, 0.8 * z); c.globalAlpha = 0.5 + 0.5 * sp;
    for (const r of [14, 18, 22]) { c.beginPath(); c.arc(p[0], p[1], r * z, a + (FIN.dir > 0 ? 0.6 : Math.PI + 0.6), a + (FIN.dir > 0 ? 0.6 : Math.PI + 0.6) + 2.2 * sp + 0.4); c.stroke(); }
    c.restore();
  }
  function lodDrawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir;
    pn.screen(c);
    gnsStreet(c, pn, t, FIN.wx + D * 52, 50, 0.2 + 0.12 * fe(MT.AFTER, MT.END, t));
    lodTable(c, pn, t);
    mgPuppet(c, pn, W, t, { light: dirAng(-0.45), post: gnsBrim(W, t, 0.8) });
    pn.screen(c);
    lodTwirl(c, pn, t);
  }
  /* ---- his poses from the splash on: aiming down at the plate, the hammer, the shot's kick; the barrel to his mouth, then to his brim;
     in panel 4 the barrel comes down, the revolver twirls on his finger and goes in the holster ---- */
  function lodPoseW(P, sk, t, p) {
    const w = sk.w, leg = sk.leg, tor = sk.tor;
    const aim = [w * 1.0, -leg - tor * 0.55], up = [w * 0.7, -leg - tor * 0.35], brim = [w * 0.98, -leg - tor * 0.6], lowB = [-w * 0.72, -leg - tor * 0.06];
    P.gunB = Math.PI - 1.15; P.exK = 1; P.expr = "grin";
    if (t < MT.AFTER) {
      const [gx, gy, gs] = lodGeo(), dx = Math.abs(gx - p.x) - aim[0], dy = gy - (lodPlateY() + LOD_BH * 0.6) * gs - aim[1], A = Math.atan2(dy, dx) + Math.asin(clamp(2.7 / Math.hypot(dx, dy), -1, 1));
      const ck = Math.sin(Math.PI * fe(LOD.COCK, LOD.COCK + 90, t));
      const k = easeOut(fe(LOD.SHOT + 10, LOD.SHOT + 60, t)) * (1 - ease(fe(LOD.SHOT + 110, LOD.SHOT + 420, t)));
      if (t >= LOD.SHOT && t < LOD.SHOT + 50) P.shotF = Math.floor((t - LOD.SHOT) / FMS);
      const r = ease(fe(LOD.RAISE, LOD.RAISE + 80, t)), tp = ease(fe(LOD.TIP0, LOD.TIP1, t));
      let hF = [aim[0] - k * 2, aim[1] - k * 6], ang = A - 0.1 * ck - 0.6 * k;
      if (r > 0) { hF = lerp2(hF, up, r); ang = lerp(ang, -1.42, r); }
      if (tp > 0) { hF = lerp2(hF, brim, tp); ang = lerp(ang, -1.7, tp); }
      P.crouch = 0.12 * (1 - r); P.lean = -0.04 * (1 - r) - 0.12 * k + 0.08 * Math.sin(Math.PI * fe(LOD.TIP0 + 40, LOD.TIP1 + 80, t));   // (the nod of the hat tip)
      if (t >= LOD.BLOW - 20 && t < LOD.BLOW + 220) { P.expr = undefined; P.mouth = 0.75; }
      P.holdAng = ang;
      return { hF, hB: lowB };
    }
    const mid = [w * 0.85, -leg - tor * 0.32], low = [w * 0.9, -leg];
    const dn = ease(fe(MT.AFTER, MT.AFTER + 70, t)), tw = fe(LOD.TWIRL0, LOD.TWIRL1, t), hs = ease(fe(LOD.TWIRL1, LOD.HOLSTER, t));
    let hF = lerp2(brim, mid, dn), ang = lerp(-1.7, 0, dn);
    if (tw > 0 && tw < 1) ang = -TAU * 2 * easeOut(tw);
    if (hs > 0) { hF = lerp2(mid, low, hs); ang = lerp(0, 0.95, hs); }
    P.holdAng = ang; P.lean = -0.03;
    return { hF, hB: [-w * 0.55, -leg - tor * 0.08] };
  }

  S_.alt2 = Object.assign({}, S_, {
    name: "Loaded",
    start(g) {
      S_.start(g); pota2 = true; lodC = null; lodMz = null;
      FIN.cue.blow = FIN.cue.land = FIN.cue.holster = FIN.cue.ching = true;   // (High Noon's panel 4: here he blows in the splash and holsters to his own cues; the hat is gone with the loser)
    },
    build(lay) { S_.build(lay); lodPrep(); lodMz = null; },
    end() { pota2 = false; lodC = null; lodMz = null; },
    panels(lay) {
      const ps = panels(lay), by = (id) => ps.find((q) => q.id === id), strike = by("strike"), after = by("after");
      strike.freeze = strike.cover = MT.SPLASH;
      after.draw = lodDrawAfter;
      after.cam = (t) => { const vh = (lay.port ? 124 : 84) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + FIN.dir * (lay.port ? 52 : 50), wy: lay.port ? -0.48 * vh : -46, vh }; };
      ps.splice(ps.indexOf(after), 0, mgSplashPanel({ from: "t", paper: PAPER, slide: MG.reduced ? 1 : 120, cam: lodCam, draw: lodDrawSplash, shake: lodShake }));
      return ps;
    },
    pose(P, sk, t, role, p) {
      if (pota2 && role === "w" && t > MT.SPLASH) return lodPoseW(P, sk, t, p);   // (strictly after: the strike panel is frozen at the splash with High Noon's pose)
      return S_.pose(P, sk, t, role, p);
    },
    ownWords: true,   // the upright sizes are set here
    words(lay) {
      const ws = S_.words(lay).filter((w) => w.text !== "fuu"), D = FIN.dir, pg = MG.page, port = lay.port, k = port ? Math.min(1, L.gw * 0.9 / L.gh) : 1, kb = port ? 0.6 : 1;
      for (const w of ws) w.mul = (w.mul || 1) * k;   // High Noon's words, as the engine would scale them upright
      Object.assign(ws.find((w) => w.text === "BANG"), { t1: MT.SPLASH + 150 });   // gone as the splash comes in
      const at = (tt, f) => () => { const pn = MG.byId.splash; mgPlace(pn, tt); const q = pn.sp(...f()); return [q[0], q[1]]; };
      ws.push(
        { text: "CH-CHK", t0: MT.SPLASH + 30, t1: LOD.SHUT, size: 0.15, mul: k, arc: 8, jit: 0.12, rot: -0.1 * D, seed: 610,
          at: () => (port ? [pg.x + pg.w * 0.5, pg.y + pg.h * 0.12] : [pg.x + pg.w * (D > 0 ? 0.17 : 0.83), pg.y + pg.h * 0.27]) },
        { text: "click", t0: LOD.SHUT, t1: LOD.SHOT - 10, size: 0.07, mul: kb, jit: 0.14, rot: -0.1 * D, seed: 620,
          at: at(LOD.SHUT + 100, () => { const h = lodHand(LOD.SHUT + 100); return [h[0] - D * 8, h[1] - 22]; }) },
        { text: "BANG", t0: LOD.SHOT, t1: LOD.SHOT + 520, size: 0.1, mul: kb, arc: 8, jit: 0.12, rot: -0.08 * D, fill: COL, seed: 630,
          at: at(LOD.SHOT, () => { const m = lodMuzzles().shot; return [m[0] + D * 30, m[1] - 26]; }) },
        { text: "fuu", t0: LOD.BLOW + 20, t1: MT.AFTER, size: 0.065, mul: kb, jit: 0.12, rot: -0.14 * D, space: 0.1, fill: "#ffffff", seed: 640,
          at: at(LOD.BLOW, () => { const m = gnsPt(W_(), LOD.BLOW, "mouthPt"); return [m[0] + D * 50, m[1] - 12]; }) },
      );
      return ws;
    },
    over(o, t) { if (t < MT.SPLASH) S_.over(o, t); else gnsDust(o, t); },   // from the splash on: no hat, no speed lines (the loser is the food); the dust blows on
    food() { const x = lodTX(); return { x, y: 0, r: 22, y0: -34, lx: x + FIN.dir * 40 }; },   // the plate on the barrel
    cues(t) {
      S_.cues(t);
      cueOnce("lodChk", MT.SPLASH + 20, () => Cin.go(() => { Cin.clack(); Cin._osc("square", 260, 80, 0.07, 0.1, 0.002, 0.11); Cin._noise(0.05, 0.4, 5200, 1400, "highpass", 0.7, 0.11); }));
      cueOnce("lodSpin", LOD.SPIN0, () => Cin.go(() => {   // the ratchet: a tick at every chamber that passes, slowing down
        for (let j = 1; j <= 12; j++) Cin._osc("triangle", 3000 - j * 60, 1500, 0.03, 0.05, 0.002, (LOD.SPIN1 - LOD.SPIN0) * 0.001 * (1 - Math.sqrt(1 - j / 12)));
      }));
      cueOnce("lodShut", LOD.SHUT, () => Cin.go(() => { Cin.clack(); Cin.tick(1800); }));
      cueOnce("lodCock", LOD.COCK, () => Cin.go(() => { Cin.clack(); Cin.tick(2200); }));
      cueOnce("lodShot", LOD.SHOT, () => Cin.go(() => gnsBang(0.8, false)));
      cueOnce("lodLand", LOD.LAND, () => Cin.go(() => { Cin._osc("sine", 1400, 1380, 0.6, 0.06, 0.002); Cin._osc("sine", 2210, 2200, 0.4, 0.03, 0.002); Cin._noise(0.06, 0.2, 3000, 1200, "bandpass", 1); }));
      for (let k = 0; k < 5; k++) cueOnce("lodTop" + k, lodRainT(k), () => Cin.go(() => (k === 4 ? Cin._noise(0.12, 0.12, 900, 300, "lowpass", 0.8) : Cin._osc("sine", 640 - k * 50, 320, 0.08, 0.05, 0.003))));
      cueOnce("lodBlow", LOD.BLOW, () => Cin.go(() => Cin._noise(0.5, 0.14, 1300, 700, "bandpass", 0.8)));
      cueOnce("lodTip", LOD.TIP0 + 60, () => Cin.go(() => Cin.tick(3200)));
      cueOnce("lodTwirl", LOD.TWIRL0, () => Cin.go(() => Cin._noise(0.3, 0.06, 1500, 2600, "bandpass", 2)));
      cueOnce("lodHolster", LOD.HOLSTER, () => Cin.go(() => Cin.clack()));
      cueOnce("lodChing", LOD.HOLSTER + 80, () => Cin.go(() => Cin.chime(2093)));
    },
  });
  return S_;
})();
