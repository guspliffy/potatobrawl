/* ===================== Manga page: Alchemist, "The Experiment" =====================
   Script for the engine in ui/manga.js (design: finisher-films/fable-manga.md, "Alchemist, The Experiment"). Times are ms after the final hit.
   300 the freeze (panel 1, engine; the rain starts at 900) . 1250 panel 2 "the look": a flask far too big, the liquid rises, three lightning bolts
   (each one a one-frame inversion of that panel) . 2000 inset on the loser (dazed, green drips; at 2200 the face snaps to terror)
   2350 panel 3 "the strike": the throw (2480), the smash on the head (2650), the loser inflates, the drop (2780), 2900 POP, the loser
   flies out along the real launch direction trailing bubbles . 3500 panel 4: the smoke clears, a tiny spoon, a taste, "mmm".
   Script fields: col, name, hit, flight, panels(lay), words(lay), build(lay), step(t, k), pose(P, sk, t, role, p), after(t), over(o, t), cues(t),
   drawLoser(c, pn, t), impact(o, pn, sil, t), hitPt(). Everything here is private to this file. */
MANGA.alchemist = (function () {
  const COL = "#7dff62", COL_D = "#2f9a2a", PAPER = MG_PAPER, INK = MG_INK, GLASS = "#fffdf4", TAU = Math.PI * 2;
  const T_WIND = 2350, T_COCK = 2440, T_REL = 2480, T_SMASH = 2650, T_INF = 2850, T_DROP = 2780;   // the throw: wind-up, cocked, released, the smash, the balloon is full, the drop
  const W_ = () => FIN.P[FIN.w], L_ = () => FIN.P[FIN.l];
  const dirAng = (a) => (FIN.dir > 0 ? a : Math.PI - a);
  let rainT = null, bolts = [], shards = [], drips = [], blots = [], bub = [];

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
  // the loser swells from the smash to the pop: 1 -> 1.5 with a wobble, back to 1 at the pop
  const inflate = (t) => (t < T_SMASH || t >= FIN.hit ? 1 : 1 + 0.65 * ease(fe(T_SMASH, T_INF, t)) + 0.04 * Math.sin(t * 0.05) * fe(T_SMASH, T_INF, t));

  /* ---------- small shapes ---------- */
  // a dot screen (hard dots, upright whatever the transform) poured into the shape pathFn traces under the caller's transform
  function dots(c, pn, pathFn, size, cover, colr) {
    c.save(); c.beginPath(); pathFn(); c.clip();
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = mgTile(size, cover, colr);
    c.fillRect((pn.x0 + pn.ox - 6) * DPR, (pn.y0 + pn.oy - 6) * DPR, (pn.w + 12) * DPR, (pn.h + 12) * DPR);
    c.restore();
  }
  // a sweat drop: tip up, white, inked; (x, y) is the middle of the round part
  function sweatDrop(c, x, y, r, ang, lw) {
    c.save(); c.translate(x, y); c.rotate(ang || 0);
    c.beginPath(); c.moveTo(0, -r * 2.3); c.quadraticCurveTo(r * 0.9, -r * 0.9, r, 0); c.arc(0, 0, r, 0, Math.PI, false); c.quadraticCurveTo(-r * 0.9, -r * 0.9, 0, -r * 2.3); c.closePath();
    c.fillStyle = "#fff"; c.fill(); c.lineWidth = lw; c.lineJoin = "round"; c.strokeStyle = INK; c.stroke(); c.restore();
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
  // o: { x, y (the middle of the belly, world), s, rot, level 0..1, t, ink (px), slosh }
  function flask(c, pn, o) {
    const s = o.s, lw = o.ink / (pn.z * s), t = o.t, yl = 9 - o.level * 22, amp = 0.35 + (o.slosh || 0);
    c.save(); pn.world(c); c.translate(o.x, o.y); c.rotate(o.rot); c.scale(s, s);
    c.lineJoin = "round"; c.lineCap = "round";
    flaskPath(c); c.fillStyle = GLASS; c.fill();
    c.save(); flaskPath(c); c.clip();
    c.beginPath(); c.moveTo(-12, 12); for (let x = -12; x <= 12.01; x += 2) c.lineTo(x, yl + Math.sin(x * 0.7 + t * 0.012) * amp); c.lineTo(12, 12); c.closePath();
    c.fillStyle = COL; c.fill();
    dots(c, pn, () => { c.arc(0, 0, 10.5, 0, TAU); c.arc(-3.6, -3.6, 8.2, 0, TAU, true); }, 6, 0.34, INK);   // the shaded crescent
    for (const b of bub) {   // bubbles rise from the bottom to the surface
      const f = (t * 0.00042 * b.sp + b.ph) % 1, y = lerp(8, yl + 1, f), x = b.x + Math.sin(t * 0.004 + b.ph * 9) * 0.9, r = b.r * (0.55 + 0.7 * f);
      if (y < yl + 0.4) continue;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = "#f4ffee"; c.fill(); c.lineWidth = lw * 0.5; c.strokeStyle = INK; c.stroke();
    }
    c.beginPath(); for (let x = -12; x <= 12.01; x += 2) { const y = yl + Math.sin(x * 0.7 + t * 0.012) * amp; x === -12 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
    c.restore();
    flaskPath(c); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, 0, 6.6, 2.5, 3.5); c.lineWidth = lw * 0.9; c.strokeStyle = "#ffffff"; c.stroke();
    c.beginPath(); c.arc(0, 0, 6.6, 3.72, 3.9); c.stroke();
    c.fillStyle = GLASS; c.lineWidth = lw * 0.9; c.beginPath(); c.rect(-3.8, -15.6, 7.6, 1.7); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.moveTo(-3.1, -15.6); c.lineTo(3.1, -15.6); c.lineTo(2.6, -20.4); c.lineTo(-2.6, -20.4); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-1.4, -19.2); c.lineTo(-1.1, -16.6); c.lineWidth = lw * 0.7; c.strokeStyle = "#ffffff"; c.stroke();
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
  const HOLD = [8, -8], FS = 3.2, FS3 = 2.6;   // the flask in panel 2 (close) and in the throw (wide)
  function inHand(t) {
    const D = FIN.dir, h = handW(t), a = D * (seg(t, [[0, 0.03], [T_WIND, 0.03], [T_COCK, -0.9], [T_REL, 0.2]])) + (t < T_WIND ? D * 0.04 * Math.sin(t * 0.004) : 0);
    const ox = D * HOLD[0], oy = HOLD[1], cs = Math.cos(a), sn = Math.sin(a);
    return { x: h[0] + ox * cs - oy * sn, y: h[1] + ox * sn + oy * cs, rot: a };
  }
  const level = (t) => 0.2 + 0.6 * ease(fe(1250, 2300, t));
  function flaskAt(t) {
    if (t >= T_SMASH) return null;
    if (t < T_REL) { const o = inHand(t); o.level = level(t); o.slosh = 0.5 * fe(T_WIND, T_REL, t) + 0.25 * fe(1250, 1500, t) * (1 - fe(1500, 1900, t)); return o; }
    const c0 = inHand(T_REL), u = fe(T_REL, T_SMASH, t), D = FIN.dir;
    return { x: lerp(c0.x, FIN.lx, u), y: lerp(c0.y, -64, u) - 20 * 4 * u * (1 - u), rot: c0.rot + D * u * TAU, level: level(2300), slosh: 1.1 };
  }

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

  /* ---------- panels ---------- */
  // an oval as page fractions (for the round inset)
  const oval = (cx, cy, rx, ry, rt, n) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU + 0.2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rt) - y * Math.sin(rt), cy + x * Math.sin(rt) + y * Math.cos(rt)]; });
  function panels(lay) {
    const port = lay.port, D = FIN.dir;
    return [
      { id: "look", t0: MT.LOOK, from: "w", freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? [[0, 0], [1, 0], [1, 0.40], [0, 0.43]] : [[0, 0], [0.45, 0], [0.48, 1], [0, 1]],
        cam: (t) => { const vh = (port ? 138 : 130) * (1 - 0.08 * fe(MT.LOOK, MT.STRIKE, t)); return { wx: FIN.wx + D * (port ? 18 : 16), wy: -0.5 * vh, vh }; },
        draw: drawLook },
      { id: "inset", t0: MT.INSET, from: "t", slide: 150, freeze: MT.STRIKE, cover: MT.STRIKE,
        poly: port ? oval(0.72, 0.43, 0.22, 0.082, -0.05, 28) : oval(0.545, 0.31, 0.10, 0.27, 0.06, 28),
        cam: (t) => { const h = headL(Math.min(t, 2350)); return { wx: h[0], wy: h[1] - 1, vh: 50 - 4 * fe(MT.INSET, MT.STRIKE, t) }; },
        draw: drawInset },
      { id: "strike", t0: MT.STRIKE, from: "l", freeze: MT.AFTER, cover: MT.AFTER,
        poly: port ? [[0, 0.38], [1, 0.36], [1, 0.72], [0, 0.74]] : [[0, 0.36], [1, 0.32], [1, 1], [0, 1]],
        cam: (t) => { const k = fe(MT.STRIKE, MT.AFTER, t), pan = fe(T_REL, T_SMASH, t) * 14 - 8 * fe(T_SMASH, MT.AFTER, t), vh = (port ? 172 : 126) * (1 - 0.04 * k); return { wx: FIN.wx + D * ((port ? 70 : 64) + pan), wy: -0.45 * vh, vh }; },
        shake: (t) => { const a = 4 * fe(FIN.hit, FIN.hit + 40, t) * (1 - fe(3250, 3500, t)); return a > 0.05 ? [Math.sin(t * 0.9) * a, Math.cos(t * 1.31) * a] : [0, 0]; },
        draw: drawStrike },
      { id: "after", t0: MT.AFTER, from: "b",
        poly: port ? [[0, 0.68], [1, 0.66], [1, 1], [0, 1]] : [[0.40, 0.50], [1, 0.47], [1, 1], [0.36, 1]],
        cam: (t) => { const vh = (port ? 110 : 84) * (1 - 0.06 * fe(MT.AFTER, MT.END, t)); return { wx: FIN.wx + D * (port ? 50 : 42), wy: -0.42 * vh, vh }; },
        draw: drawAfter },
    ];
  }

  // the slab: one flat ink shape with a screened band under its edge
  function ground(c, pn) {
    pn.world(c);
    const x0 = FIN.wx - 420, x1 = FIN.wx + 420;
    c.fillStyle = INK; c.fillRect(x0, 0, x1 - x0, 90);
    c.strokeStyle = "#f1ece2"; c.lineWidth = 1.5 / pn.z; c.beginPath(); c.moveTo(x0, 3.2); c.lineTo(x1, 3.2); c.stroke();
  }

  /* ---------- panel 2: the look ---------- */
  function drawLook(c, pn, t) {
    const W = W_(), power = fe(1250, 2300, t), F = flaskAt(t);
    pn.screen(c);
    clouds(c, pn, t, pn.h * (0.16 + 0.08 * power), 41, 0.62);
    const fp = pn.p(F.x, F.y), R = Math.hypot(pn.w, pn.h);
    // the glow of the brew: a flat accent disc and a ring of dots round it, growing with the power
    const gr = pn.h * (0.34 + 0.1 * power);
    c.save(); c.globalAlpha = 0.28 + 0.14 * power; c.fillStyle = COL; c.beginPath(); c.arc(fp[0], fp[1], gr, 0, TAU); c.fill(); c.restore();
    dots(c, pn, () => { c.arc(fp[0], fp[1], gr * 1.42, 0, TAU); c.arc(fp[0], fp[1], gr, 0, TAU, true); }, 7, 0.3, COL_D);
    mgFocus(c, fp[0], fp[1], R * 0.95, t * 0.00035, 0.5 + 0.35 * power);
    for (const b of bolts) bolt(c, pn, b, t);
    ground(c, pn);
    pn.world(c);
    mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-0.6) });
    flask(c, pn, { x: F.x, y: F.y, s: FS, rot: F.rot, level: F.level, t, ink: 4.6, slosh: F.slosh });
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

  /* ---------- the inset: the loser, dazed and dripping, then terror ---------- */
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
    pn.screen(c);
    // three dizzy stars circle the head while it is dazed; sweat drops fly off at the moment of terror
    const dz = 1 - fe(2180, 2230, tt);
    if (dz > 0.02) for (let i = 0; i < 3; i++) { const a = tt * 0.006 + (i / 3) * TAU; star(c, pn.cx + Math.cos(a) * pn.w * 0.34, pn.y0 + pn.h * 0.17 + Math.sin(a) * pn.h * 0.05, pn.h * 0.045 * dz); }
    if (tt > 2230) {
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
    const Lp = L_(), fl = t >= FIN.launch, H0 = FIN.hit;
    trail(c, pn, t);
    if (FIN.out || Lp.state === "gone") return;
    const k = fe(T_SMASH, T_INF, t), sc = inflate(t), base = { light: dirAng(-0.6) };
    if (fl && !MG.slow) for (const dt of [70, 46, 23]) {   // three ghosts
      const [gx, gy] = loserAt(t - dt), ox = Lp.x, oy = Lp.y; Lp.x = gx; Lp.y = gy;
      mgPuppet(c, pn, Lp, t - dt, Object.assign({}, base, { sc: 1, a: 0.3 - dt * 0.003, wash: [INK, 0.85], tone: false }));
      Lp.x = ox; Lp.y = oy;
    }
    const wash = t < H0 ? [COL, 0.4 * k] : fl ? [COL, 0.4] : null;
    mgPuppet(c, pn, Lp, t, Object.assign({}, base, { sc, wash, flash: Lp.flash > 0, post: t >= T_SMASH && t < H0 ? balloonPost(k, Lp.s.h) : null }));
    // the skin is stretched tight: a heavy ink ring round the swollen body; the eyes bulge, far bigger than the face has room for
    if (t >= T_SMASH && t < H0) {
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
      for (const dx of [-0.14, 0.13]) {
        const q = rot([P.head[0] + P.w * dx, P.head[1]], P.hip, P.lean), ex = Lp.x + Lp.facing * q[0] * sc, ey = Lp.y + q[1] * sc;
        c.beginPath(); c.ellipse(ex, ey, er * bg, er * bg * 1.1, 0, 0, TAU); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 2.2 / pn.z * 1.4; c.strokeStyle = INK; c.stroke();
        c.beginPath(); c.arc(ex + Lp.facing * er * 0.15, ey + er * 0.1, er * 0.32, 0, TAU); c.fillStyle = INK; c.fill();
      }
      c.restore();
    }
  }

  /* ---------- panel 4: the aftermath ---------- */
  function puddle(c, pn, t) {
    const px = FIN.wx + FIN.dir * 58, k = ease(fe(3500, 3650, t)), rx = 30 * k, hh = 7 * k, lw = 2.6 / pn.z;
    if (k <= 0.01) return;
    pn.world(c);
    c.beginPath(); c.moveTo(px - rx, 0.4); c.quadraticCurveTo(px - rx * 0.7, -hh * 1.5, px - rx * 0.1, -hh * 1.15); c.quadraticCurveTo(px + rx * 0.5, -hh * 1.7, px + rx, 0.4); c.closePath();
    c.fillStyle = COL; c.fill(); c.lineJoin = "round"; c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.ellipse(px - rx * 0.35, -hh * 0.75, rx * 0.2, hh * 0.18, -0.15, 0, TAU); c.fillStyle = "#fff"; c.fill();
    // bubbles swell on it and pop
    for (let i = 0; i < 4; i++) {
      const f = ((t * 0.0006 + i * 0.27) % 1), r = (1.1 + 0.9 * ((i * 7) % 3) / 2) * Math.sin(f * Math.PI) * k, x = px + (i - 1.5) * rx * 0.42, y = -hh * 0.9 - r * 0.4 - f * 3;
      if (r > 0.25) bubble(c, x, y, r, lw * 0.6);
    }
    // the dip: a ring on the surface
    const dip = fe(3820, 3900, t) * (1 - fe(3900, 4080, t));
    if (dip > 0.02) { c.beginPath(); c.ellipse(px + FIN.dir * 4, -1, 4 + 9 * (1 - dip), 1.2 + 2 * (1 - dip), 0, 0, TAU); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke(); }
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
  const spoonAng = (t) => seg(t, [[0, -0.95], [3500, -0.95], [3650, -0.95], [3900, 1.0], [4060, 0.5], [4150, Math.PI - 0.12], [4400, Math.PI - 0.12], [4520, -0.9]]);
  function drawAfter(c, pn, t) {
    const W = W_(), D = FIN.dir, u = fe(MT.AFTER, MT.END, t);
    pn.screen(c);
    const [fx, fy] = pn.p(...bodyPt(W, t, 1, "head"));
    mgFocus(c, fx, fy, Math.hypot(pn.w, pn.h) * 0.9, t * 0.0003, 0.5);
    // the smoke clears: dot-screen puffs that drift up and step lighter, then go
    const r = mgRng(909);
    for (let i = 0; i < 5; i++) {
      const x = pn.x0 + (0.12 + 0.2 * i + r() * 0.1) * pn.w, y0 = pn.y0 + pn.h * (0.5 + r() * 0.4), rad = pn.h * (0.2 + r() * 0.16), k = fe(3500 + i * 60, 3950 + i * 60, t);
      if (k >= 1) continue;
      const cov = k < 0.3 ? 0.6 : k < 0.55 ? 0.42 : k < 0.8 ? 0.26 : 0.12, y = y0 - k * pn.h * 0.3;
      dots(c, pn, () => { c.arc(x, y, rad, 0, TAU); c.arc(x + rad * 0.6, y + rad * 0.2, rad * 0.7, 0, TAU); c.arc(x - rad * 0.6, y + rad * 0.3, rad * 0.65, 0, TAU); }, 7, cov, INK);
    }
    ground(c, pn);
    puddle(c, pn, t);
    pn.world(c);
    mgPuppet(c, pn, W, t, { sc: 1, light: dirAng(-0.6) });
    spoon(c, pn, t, spoonAng(t), t > 3950);
    // the taste is good: sparkles round the face
    const sp = fe(4130, 4200, t) * (1 - fe(4380, 4520, t));
    if (sp > 0.02) { pn.screen(c); for (let i = 0; i < 3; i++) star(c, fx + (i - 1) * pn.h * 0.15 * (i === 1 ? 0.5 : 1.3), fy - pn.h * (0.12 + 0.07 * ((i + 1) % 2)), pn.h * (0.03 + 0.012 * i) * sp * (0.9 + 0.1 * Math.sin(t * 0.02 + i))); }
  }

  /* ---------- the script ---------- */
  const S_ = {
    col: COL, name: "The Experiment", flight: "strike",
    panels,
    words(lay) {
      const ev = FIN.ev, heavy = ev && /^h/.test(ev.mv || ""), txt = ev && ev.fin ? "SPLOSH" : heavy ? "DOOM" : "KRAK", D = FIN.dir, mu = lay.port ? 0.5 : 1;   // the page is tall on a phone held upright: words scale with its width
      const P2 = () => MG.byId.look, P3 = () => MG.byId.strike, P4 = () => MG.byId.after;
      return [
        { text: txt, t0: 600, t1: 1330, size: 0.24, mul: mu, rot: -0.12 * D, at: () => [clamp(MG.ix + D * L.gw * 0.04, L.gw * 0.22, L.gw * 0.78), clamp(MG.iy - L.gh * 0.24, L.gh * 0.2, L.gh * 0.5)] },
        { text: "GLUG GLUG", t0: 1330, t1: 2330, size: 0.075, mul: mu, jag: 0.14, rot: 0.1 * D, at: () => { const p = P2(); return [(D > 0 ? p.x1 : p.x0) + D * p.w * 0.06, p.y0 + p.h * 0.64]; } },
        { text: "KRAKOOM", t0: 1500, t1: 2420, size: 0.09, mul: mu, jag: 0.2, rot: -0.1 * D, at: () => { const p = P2(); return [(D > 0 ? p.x0 + p.w * 0.3 : p.x1 - p.w * 0.3), p.y0 + p.h * 0.2]; } },
        { text: "KLINK", t0: T_SMASH, t1: 2900, size: 0.11, mul: mu, jag: 0.22, rot: 0.12 * D, at: () => { const p = P3(), q = p.sp(FIN.lx + D * 92, -78); return [q[0], q[1]]; } },
        { text: "SPLORT", t0: FIN.hit, t1: 3560, size: 0.3, mul: lay.port ? 0.33 : 1, arc: 7, rot: -0.06 * D, at: () => { const p = P3(); return [p.cx + D * p.w * 0.02, p.y0 + p.h * 0.34 + p.oy]; } },
        { text: "blup blup", t0: FIN.launch, t1: 3620, size: 0.075, mul: mu, jit: 0.1, rot: Math.atan(FIN.ldy / (Math.abs(FIN.ldx) > 0.05 ? FIN.ldx : 0.05)) * 0.5, stretch: { ang: Math.atan2(FIN.ldy, FIN.ldx), k: 0.7 },
          at: () => { const p = P3(), up = Math.abs(FIN.ldx) < 0.35, q = up ? p.sp(FIN.lx + D * 104, -50) : p.sp(FIN.lx + FIN.ldx * 105 + D * 34, FIN.ldy * 105 + 14); return [q[0], q[1]]; } },
        { text: "mmm", t0: 4130, t1: 4560, size: 0.1, mul: mu, jit: 0.1, rot: -0.1 * D, at: (t) => { const p = P4(), m = p.sp(...bodyPt(W_(), 4200, 1, "mouthPt")); return [m[0] + D * p.h * 0.28, m[1] - p.h * 0.28]; } },
      ];
    },
    build(lay) {
      const r = mgRng(1313), g = L.gw, h = L.gh;
      rainT = [rainTile(260, 64, 9, 22, 1.1, 5), rainTile(380, 44, 24, 56, 2, 9)];
      // three bolts: where they stand across panel 2 and when they strike
      bolts = [[0.14, 1480], [0.8, 1780], [0.47, 2060]].map(([x0, t0], bi) => {
        const pts = [[x0, 0.04]], n = 8; let x = x0;
        for (let i = 1; i <= n; i++) { x += (i % 2 ? 1 : -1) * (0.04 + r() * 0.06); pts.push([x, 0.04 + (0.84 * i) / n]); }
        const m = pts[4], fork = [m, [m[0] + (bi === 1 ? -0.1 : 0.1), m[1] + 0.07], [m[0] + (bi === 1 ? -0.07 : 0.07), m[1] + 0.17], [m[0] + (bi === 1 ? -0.16 : 0.15), m[1] + 0.25]];
        return { t0, pts, fork };
      });
      bub = Array.from({ length: 16 }, () => ({ x: (r() - 0.5) * 11, ph: r(), sp: 0.7 + r() * 0.9, r: 0.45 + r() * 0.8 }));
      shards = Array.from({ length: 16 }, (_, i) => ({ a: -Math.PI * 0.95 + (i / 16) * Math.PI * 1.35 + (r() - 0.5) * 0.2, v: 0.12 + r() * 0.2, vr: (r() - 0.5) * 0.02, r0: r() * 6, r: 3 + r() * 4, liq: i % 3 === 0 }));
      drips = [[-17, -58], [-13, -50], [-9.5, -61], [11, -60], [15, -52], [18.5, -59], [3, -62]].map(([x, y0], i) => ({ x, y0, t0: 2000 + i * 55 + r() * 40, w: 0.8 + r() * 0.5 }));
      blots = Array.from({ length: 6 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (13 + r() * 6), y: -56 + r() * 20, r: 0.7 + r() * 1.3, t0: 2000 + i * 50 }));
    },
    start() { FIN.P[FIN.w].specCd = 99; },   // the puppet is a copy: no toxic orb in the hand, the flask is the prop
    step(t, k) { MG.pt = t; },
    pose(P, sk, t, role, p) {
      const w = sk.w, leg = sk.leg, tor = sk.tor, H0 = FIN.hit;
      if (role === "w") {
        const hold = [w * 0.98, -leg - tor * 1.02], cock = [-w * 0.5, -leg - tor * 1.3], rel = [w * 1.25, -leg - tor * 1.15], fol = [w * 1.05, -leg - tor * 0.85], rest = [w * 0.85, -leg - tor * 0.6];
        const dip = [w * 1.12, -leg - tor * 0.28], mouth = [w * 0.16 + 14.5, (-leg - p.s.h + 7) / 2 - ((p.s.h - leg + 3) / 2) * 0.28 + w * 0.23 - 1.5];
        const hF = seg(t, [[0, hold], [T_WIND, hold], [T_COCK, cock], [T_REL, rel], [2600, fol], [3300, fol], [3500, rest], [3650, rest], [3900, dip], [4060, rest], [4150, mouth], [4400, mouth], [4520, rest]]);
        const jolt = bolts.reduce((a, b) => a + (t >= b.t0 && t < b.t0 + 160 ? 0.07 * (1 - (t - b.t0) / 160) : 0), 0);
        P.lean = seg(t, [[0, 0], [T_WIND, 0], [T_COCK, -0.3], [T_REL, 0.25], [2650, 0.18], [3500, 0.08], [3650, 0.06], [3900, 0.14], [4150, -0.02], [4500, 0.04]]) + (t < T_WIND ? jolt : 0);
        P.expr = t < 1480 ? "calm" : t >= 3950 && t < 4350 ? "calm" : "grin"; P.exK = 1;
        return { hF, hB: [-w * 0.7, -leg - tor * 0.45] };
      }
      // the loser
      if (t >= FIN.launch) {
        P.expr = "ko"; P.exK = 1; P.lean = -0.5; P.mouth = 1; P.spin = ((t - FIN.launch) / FMS) * 0.3;
        return { hF: [w * 0.6, -leg - tor * 1.2], hB: [-w * 0.6, -leg - tor * 1.2], fF: [w * 0.45, -leg * 0.35] };
      }
      P.expr = t < 2200 ? "dazed" : "terror"; P.exK = t < 2200 ? 1 : t >= T_SMASH ? 1 : fe(2200, 2330, t);
      if (t < 2200) { P.lean = Math.sin(t * 0.005) * 0.1; P.mouth = 0.2; return { hF: [w * 0.75, -leg - tor * 0.45], hB: [-w * 0.7, -leg - tor * 0.45] }; }
      if (t < T_SMASH) { P.lean = Math.sin(t * 0.05) * 0.03; P.mouth = 0.8; return { hF: [w * 0.6, -leg - tor * 1.1], hB: [-w * 0.5, -leg - tor * 1.15] }; }
      const k = fe(T_SMASH, T_INF, t);
      P.lean = Math.sin(t * 0.07) * 0.05 * k; P.mouth = 1;
      return { hF: [w * (0.75 + 0.3 * k), -leg - tor * (1.1 - 0.4 * k)], hB: [-w * (0.65 + 0.3 * k), -leg - tor * (1.1 - 0.4 * k)] };
    },
    // the balloon lifts a little off the slab and shivers; popped, it is back on it
    after(t) {
      const Lp = L_();
      if (t >= T_SMASH && t < FIN.hit) { const k = ease(fe(T_SMASH, T_INF, t)); Lp.y = -9 * k; Lp.x += Math.sin(t * 0.09) * 1.1 * k; }
    },
    over(o, t) {
      rainDraw(o, t);
      // the page-wide shock ring of the pop: a thick ink ring and a ring of dots behind it
      const H0 = FIN.hit, k = fe(H0, H0 + 480, t), pn = MG.byId.strike;
      if (t > H0 && k < 1 && pn) {
        const q = pn.sp(FIN.lx, -34), R = Math.hypot(L.gw, L.gh) * 0.75 * easeOut(k);
        o.save(); o.lineCap = "round";
        o.setLineDash([0.1, 15]); o.strokeStyle = INK; o.lineWidth = 8 * (1 - k) + 1.5; o.beginPath(); o.arc(q[0], q[1], R * 0.78, 0, TAU); o.stroke();
        o.setLineDash([]); o.lineWidth = 3 + 15 * (1 - k); o.beginPath(); o.arc(q[0], q[1], R, 0, TAU); o.stroke();
        o.strokeStyle = "#ffffff"; o.lineWidth = Math.max(0.5, 5 * (1 - k)); o.beginPath(); o.arc(q[0], q[1], Math.max(0, R - 4 - 8 * (1 - k)), 0, TAU); o.stroke();
        o.restore();
      }
      // speed lines along the launch while the loser is on its way
      if (t > FIN.launch && t < FIN.launch + 420 && pn) {
        const Lp = L_(), a = 1 - fe(FIN.launch + 200, FIN.launch + 420, t);
        const q = pn.sp(Lp.x, Lp.y - Lp.s.h * 0.5), ang = Math.atan2(FIN.ldy, FIN.ldx), len = Math.hypot(L.gw, L.gh) * 0.7;
        o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
        mgSpeed(o, q[0] - Math.cos(ang) * len * 0.45, q[1] - Math.sin(ang) * len * 0.45, len, Math.min(L.gw, L.gh) * 0.34, ang, -(t - FIN.launch) * 1.4, 0.8 * a, false, 1);
        o.restore();
      }
    },
    drawLoser: drawLoserFn,
    hitPt() { return [FIN.lx, -34]; },
    impact(o, pn, sil, t) {
      const W = W_(), Lp = L_();
      mgPuppet(o, pn, W, FIN.hit + 10, { sc: 1, sil });
      mgPuppet(o, pn, Lp, FIN.hit + 10, { sc: 1.65, sil });   // the instant before it goes: the full balloon
      // the burst: a spiked star round the balloon
      o.save(); pn.world(o); o.fillStyle = sil;
      const R = 72, cx = FIN.lx, cy = -40 - 7;
      o.beginPath(); for (let i = 0; i < 22; i++) { const r = (i % 2 ? 0.55 : 1) * R * (1 + 0.18 * Math.sin(i * 2.3)), an = (i / 22) * TAU; i ? o.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r) : o.moveTo(cx + r, cy); }
      o.closePath(); o.fill(); o.restore();
    },
    cues(t) {
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
      cueOnce("blup1", FIN.launch + 10, () => Cin.go(() => { Cin.whoosh(0.3, -0.8, 0.8, 0.4); Cin._osc("sine", 320, 760, 0.08, 0.12, 0.01); }));
      cueOnce("blup2", FIN.launch + 90, () => Cin.go(() => Cin._osc("sine", 400, 880, 0.07, 0.1, 0.01)));
      cueOnce("blup3", FIN.launch + 170, () => Cin.go(() => Cin._osc("sine", 520, 1000, 0.07, 0.08, 0.01)));
      cueOnce("dip", 3880, () => Cin.go(() => { Cin._osc("sine", 700, 420, 0.07, 0.1, 0.004); Cin._noise(0.1, 0.06, 1200, 500, "bandpass", 3); }));
      cueOnce("mm1", 4140, () => Cin.go(() => Cin._osc("sine", 262, 262, 0.32, 0.09, 0.06)));
      cueOnce("mm2", 4300, () => Cin.go(() => Cin._osc("sine", 349, 349, 0.4, 0.09, 0.06)));
      cueOnce("chime", 4400, () => Cin.go(() => Cin.chime(988)));
    },
  };
  return S_;
})();
