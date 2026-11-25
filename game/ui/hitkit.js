/* ===================== Carved Ink attacks: the hit kits (Fable's redesign, concept redesign/concept.md section D; UI only) =====================
   Every top-level name in this file and in ui/hk-<fighter>.js starts with hk / HK_ (all ui parts share one scope). Nothing here reads more
   of a game than positions and states, and nothing writes to a fighter or a game.

   A KIT per fighter, HK_KIT[spec.id]: three colours cols = [core, body, edge] and a shape family. The kit's colours are the fighter's own,
   never the skin's: a chip, won or Pommes skin never recolours an attack, so an opponent always reads the same attack (concept C and D.4).
   A boss or an unknown fighter gets a kit made from its colour (hkKit). Shapes:
     feather  six-point flame star, feather shards          (Phoenix)       bubble    a cluster of round beads, bead shards   (Alchemist)
     rune     four-point star in a dashed rune ring, arrows (Odin)          facet     a cut four-point star, diamond shards   (Wizard)
     cut      one straight cut, hair-thin shards            (Samurai)       lobe      a blunt lobed burst, lobe shards        (Dragon)
     chip     an angular eight-point star, square chips     (Gunslinger)    crescent  a split crescent, crescent shards       (Reaper)
     star     the generic eight-point star (bosses)

   DRAWING, world space; flat fills (no gradients, no shadowBlur); the ink edge is one stroke of CV_INK or a fill under the shape:
     hkSpark(c, x, y, R, kit, tier, dir, seed, q)   the hit spark. tier 1 light, 2 heavy, 3 launcher (adds the ink flare and a dashed white
                                                    ring). R is the radius of its outer (edge) layer: the body layer is 0.72 R, the core 0.42 R.
                                                    dir the launch angle (radians, screen y down), seed any integer (the jagged edge), q its
                                                    age 0..1 (the caller scales R and sets globalAlpha; q is for a shape that changes as it ages).
                                                    part (optional): "back" only the flare, halo and rings, "front" only the three layers
                                                    (a hit's spark: the back under the fighters in hkUnder, the front over them)
     hkShard(c, x, y, s, rot, kit, i)               one shard of the kit's shape, s its size, rot its angle, i picks core or body colour
     hkSmear(c, cx, cy, r, a0, a1, w, kit, o)       a swing smear: a crescent on the arc of radius r about (cx, cy) from angle a0 to a1,
                                                    w thick at its widest, thickest towards the leading end a1, three tones (edge with an ink
                                                    line, body, core). o: { ry (an elliptic arc: y radius = r * ry), a (alpha), noInk }
     hkStreak(c, a, b, w, kit, o)                   a straight lens from point a to point b, w its half width, widest at o.head (0..1, 0.8)
     hkMark(c, x, y, w, kit, a)                     the floor mark (the residue), centred on (x, y) on the floor, w its half width, a alpha
     hkGlint(c, x, y, s, kit)                       the anticipation glint: a flat four-point star, s its half length (drawGlint)
     hkTrail(c, pts, w, kit)                        the launch trail: a ribbon through pts (oldest first), widest (w, half width) at the last
   A fighter's own file (hk-<fighter>.js) may replace one of these for its kit: HK_KIT.<id>.spark / .shard / .mark, same arguments.

   PARTICLES in the shared fx list (effects.js), drawn by drawFx through hkDrawFx; under the fighters by hkUnder:
     { k: "hks", kit, tier, x, y, R, dir, seed, t, life }                 a spark: pops in to 1.1 R, settles, fades in its last 40 %; its
                                                                          flare, halo and rings behind the fighters (hkUnder)
     { k: "hkg", kit, x, y, vx, vy, s, rot, vr, i, t, life, damp, g }     a flying shard (updateFx moves it: vx, vy, damp, g, vr)
     { k: "hkm", kit, x, y, w, t, life, fade }                            a floor mark, drawn under the fighters (hkUnder): it holds, then
                                                                          fades over its last `fade` ticks (8 when left out)
   THE HIT GRAMMAR (below the particles: tiers, the contact edge, impact frames, hit-stop look, residue; its own comment there) is what
   effects.js calls for every fighter hit: hkHit(g, e, live) on the "hit" event (returns its spark), hkLethal on "lethal", hkTick every sim
   tick, hkFrame / hkDim from render2D, hkJit from pose(). HK_LAUNCH_KB / HK_MID_KB are the tier thresholds.
   HOOKS render2D calls (effects.js): hkUnder(c, g, tk) after the stage, under the shadows and the fighters (floor marks, the sparks' back layers); uvBack(c, g, tk)
   after the projectiles, under the fighters: UV_BACK[spec.id](c, g, f, tk) for every fighter of the game (an Ultimate's payoff image that
   must stay behind the fighter being hit; the entry decides from f's state and its own fx whether there is anything to draw). */
const HK_INK = "#1a1326";
const HK_KIT = {
  phoenix:    { cols: ["#fff3b0", "#ff9a1f", "#ff4a26"], shape: "feather" },
  alchemist:  { cols: ["#f0ffd0", "#8dff3a", "#7a3fd0"], shape: "bubble" },
  odin:       { cols: ["#fffbe8", "#f2c040", "#4f8fe0"], shape: "rune" },
  wizard:     { cols: ["#fffbe0", "#ffd95a", "#8a5cf0"], shape: "facet" },
  samurai:    { cols: ["#ffffff", "#2fe0a4", "#e3453b"], shape: "cut" },
  dragon:     { cols: ["#fff0b0", "#ff8a1f", "#d92c1f"], shape: "lobe" },
  gunslinger: { cols: ["#fffbe8", "#f6c040", "#2fa8a0"], shape: "chip" },
  reaper:     { cols: ["#f0fff8", "#7dffcc", "#6a52c0"], shape: "crescent" },
};
for (const id in HK_KIT) HK_KIT[id].id = id;
// "Reduce flashes" (Settings; P.rf 1 on, 0 off, unset: on when the system asks for reduced motion): no impact frames, no screen flashes
// (a whole-screen flash or ink screen becomes the dimmed backdrop). Every effect that lights or blacks out the whole screen asks this first
const hkCalm = () => P.rf === 1 || (P.rf !== 0 && reducedMotion());
const UV_BACK = {};   // Ultimate payoffs drawn behind the fighters (hk-<fighter>.js fills it)
const HK_GEN = new Map();
// the kit of a fighter (or of a spec id); a boss or an unknown fighter: one made from its colour, cached
function hkKit(f) {
  const id = typeof f === "string" ? f : f && f.spec ? f.spec.id : "";
  if (HK_KIT[id]) return HK_KIT[id];
  let colr = f && f.pal ? col(f.pal) : "#ffffff";
  if (!/^#[0-9a-f]{6}$/i.test(colr)) colr = "#ffd23f";
  let K = HK_GEN.get(colr);
  if (!K) { K = { id: "", cols: ["#ffffff", colr, cvMix(colr, HK_INK, 0.35)], shape: "star" }; HK_GEN.set(colr, K); }
  return K;
}

/* ---------- paths (added to the current path; the caller fills) ---------- */
// a star of n points about (x, y): outer radius R (each point a little shorter by seed), inner R * inner. round: blunt lobes
function hkBurst(c, x, y, R, n, inner, rot, seed, round) {
  const N = n * 2, px = [], py = [];
  for (let i = 0; i < N; i++) { const a = rot + (i / N) * CV_TAU, r = i % 2 ? R * inner : R * (0.72 + 0.28 * nz(seed + i)); px.push(x + Math.cos(a) * r); py.push(y + Math.sin(a) * r); }
  if (!round) { c.moveTo(px[0], py[0]); for (let i = 1; i < N; i++) c.lineTo(px[i], py[i]); c.closePath(); return; }
  c.moveTo(px[1], py[1]);   // lobes: the inner points sharp, each outer point the control of a curve
  for (let k = 1; k <= n; k++) { const o = (2 * k) % N, e = (2 * k + 1) % N; c.quadraticCurveTo(x + (px[o] - x) * 1.3, y + (py[o] - y) * 1.3, px[e], py[e]); }
  c.closePath();
}
// a closed polygon through points, sharp corners
function hkPoly(c, pts) { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
// a crescent of radius r about (cx, cy) facing d, its inner edge an arc of a circle moved back (the Reaper's spark and shards)
function hkCres(c, cx, cy, r, d, span) {
  span = span || 1.35;
  c.moveTo(cx + Math.cos(d - span) * r, cy + Math.sin(d - span) * r);
  c.arc(cx, cy, r, d - span, d + span);
  c.arc(cx - Math.cos(d) * r * 0.5, cy - Math.sin(d) * r * 0.5, r * 1.02, d + span * 0.67, d - span * 0.67, true);
  c.closePath();
}

/* ---------- the spark ---------- */
// one layer of the spark in the kit's shape, radius r
function hkLayer(c, x, y, r, sh, rot, dir, seed) {
  c.beginPath();
  if (sh === "bubble") {
    for (let i = 0; i < 7; i++) { const a = rot + (i / 7) * CV_TAU, bx = x + Math.cos(a) * r * 0.55, by = y + Math.sin(a) * r * 0.55; c.moveTo(bx + r * 0.5, by); c.arc(bx, by, r * 0.5, 0, CV_TAU); }
    c.moveTo(x + r * 0.6, y); c.arc(x, y, r * 0.6, 0, CV_TAU);
  } else if (sh === "cut") {   // one long thin lens across the launch line
    const a = dir - 0.5, b = dir + 1.07, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    hkPoly(c, [[x - ca * r * 2.3, y - sa * r * 2.3], [x + cb * r * 0.3, y + sb * r * 0.3], [x + ca * r * 2.3, y + sa * r * 2.3], [x - cb * r * 0.3, y - sb * r * 0.3]]);
  } else if (sh === "crescent") {
    hkCres(c, x + Math.cos(dir) * r * 0.1, y + Math.sin(dir) * r * 0.1, r * 1.15, dir);
    hkCres(c, x - Math.cos(dir) * r * 0.1, y - Math.sin(dir) * r * 0.1, r * 0.7, dir + Math.PI);
  } else if (sh === "facet" || sh === "rune") hkBurst(c, x, y, r * 1.25, 4, sh === "rune" ? 0.42 : 0.3, rot, 999);
  else if (sh === "feather") hkBurst(c, x, y, r * 1.2, 6, 0.4, rot, seed);
  else if (sh === "lobe") hkBurst(c, x, y, r * 1.1, 7, 0.62, rot, seed, true);
  else hkBurst(c, x, y, r * 1.1, 8, 0.45, rot, seed);
}
function hkSpark(c, x, y, R, K, tier, dir, seed, q, part) {
  if (K.spark) return K.spark(c, x, y, R, K, tier, dir, seed, q, part);
  if (R <= 0.5) return;
  const C = K.cols, sh = K.shape, ga = c.globalAlpha, rot2 = sh === "facet" || sh === "rune" ? 0.2 : 0.55;
  c.lineJoin = "round";
  if (part !== "front") {   // the back layers (a hit's spark draws them under the fighters: hkUnder)
    if (tier >= 3) { c.beginPath(); hkBurst(c, x, y, R * 1.5, 12, 0.3, dir, seed + 3); c.fillStyle = HK_INK; c.fill(); }   // the ink flare
    if (tier >= 2) {   // a soft halo: two flat discs, no gradient
      c.fillStyle = C[1]; c.globalAlpha = ga * 0.14;
      c.beginPath(); c.arc(x, y, R * 1.9, 0, CV_TAU); c.fill(); c.beginPath(); c.arc(x, y, R * 1.45, 0, CV_TAU); c.fill();
      c.globalAlpha = ga;
    }
    if (sh === "rune" && tier >= 2) { c.lineWidth = 1.8; c.strokeStyle = C[1]; c.setLineDash([R * 0.42, R * 0.28]); c.beginPath(); c.arc(x, y, R * 1.35, 0, CV_TAU); c.stroke(); c.setLineDash([]); }   // Odin's gold rune ring
    if (tier >= 3) { c.lineWidth = 2.2; c.strokeStyle = "#ffffff"; c.setLineDash([R * 0.9, R * 0.5]); c.beginPath(); c.arc(x, y, R * 1.75, dir + 0.4, dir + 0.4 + CV_TAU); c.stroke(); c.setLineDash([]); }
    if (part === "back") return;
  }
  hkLayer(c, x, y, R, sh, dir + 0.2, dir, seed); c.fillStyle = C[2]; c.fill(); c.lineWidth = 2.2; c.strokeStyle = HK_INK; c.stroke();
  hkLayer(c, x, y, R * 0.72, sh, dir + rot2, dir, seed); c.fillStyle = C[1]; c.fill();
  hkLayer(c, x, y, R * 0.42, sh, dir + 0.2, dir, seed); c.fillStyle = C[0]; c.fill();
}

/* ---------- a shard ---------- */
function hkShard(c, x, y, s, rot, K, i) {
  if (K.shard) return K.shard(c, x, y, s, rot, K, i);
  const sh = K.shape, cs = Math.cos(rot), sn = Math.sin(rot);
  const P = (u, v) => [x + u * cs - v * sn, y + u * sn + v * cs];
  c.beginPath();
  if (sh === "bubble") c.arc(x, y, s * 0.62, 0, CV_TAU);
  else if (sh === "crescent") hkCres(c, x, y, s, rot, 1.2);
  else if (sh === "feather") { const a = P(-s, 0), b = P(0, -s * 0.36), d = P(s * 1.4, 0), e = P(0, s * 0.36); c.moveTo(a[0], a[1]); c.quadraticCurveTo(b[0], b[1], d[0], d[1]); c.quadraticCurveTo(e[0], e[1], a[0], a[1]); c.closePath(); }
  else if (sh === "lobe") { const a = P(-s, 0), b = P(-s * 0.1, -s * 0.75), d = P(s * 0.9, 0), e = P(-s * 0.1, s * 0.75); c.moveTo(a[0], a[1]); c.quadraticCurveTo(b[0], b[1], d[0], d[1]); c.quadraticCurveTo(e[0], e[1], a[0], a[1]); c.closePath(); }
  else if (sh === "rune") hkPoly(c, [P(-s, -s * 0.22), P(s * 0.2, -s * 0.22), P(s * 0.2, -s * 0.7), P(s, 0), P(s * 0.2, s * 0.7), P(s * 0.2, s * 0.22), P(-s, s * 0.22)]);
  else if (sh === "facet") hkPoly(c, [P(-s, 0), P(0, -s * 0.5), P(s, 0), P(0, s * 0.5)]);
  else if (sh === "cut") hkPoly(c, [P(-s * 1.4, 0), P(0, -s * 0.13), P(s * 1.4, 0), P(0, s * 0.13)]);
  else if (sh === "chip") hkPoly(c, [P(-s * 0.8, -s * 0.3), P(s * 0.8, -s * 0.42), P(s * 0.6, s * 0.34), P(-s * 0.7, s * 0.3)]);
  else hkPoly(c, [P(-s, 0), P(0, -s * 0.3), P(s, 0), P(0, s * 0.3)]);
  c.fillStyle = K.cols[(i || 0) % 3 === 0 ? 0 : 1]; c.fill();
  c.lineWidth = Math.min(1.6, 0.18 * s + 0.3); c.strokeStyle = HK_INK; c.lineJoin = "round"; c.stroke();   // (a thin ink on a small shard)
  if (sh === "bubble" && s > 2) { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(x - s * 0.2, y - s * 0.22, s * 0.16, 0, CV_TAU); c.fill(); }
}

/* ---------- smears ---------- */
// the crescent's outline: the outer arc from a0 to a1, back along an inner arc pulled in by up to ww (widest near the leading end)
function hkArcPath(c, cx, cy, r, a0, a1, ww, back, ry) {
  const n = 22;
  c.beginPath();
  for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + (a1 - a0) * (back + (1 - back) * t); if (i) c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * ry); else c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * ry); }
  for (let i = n; i >= 0; i--) { const t = i / n, a = a0 + (a1 - a0) * (back + (1 - back) * t), rr = r - Math.sin(Math.PI * Math.pow(t, 1.7)) * ww; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * ry); }
  c.closePath();
}
function hkSmear(c, cx, cy, r, a0, a1, w, K, o) {
  o = o || {};
  const C = K.cols, ry = o.ry || 1, ga = c.globalAlpha;
  if (o.a !== undefined) c.globalAlpha = ga * o.a;
  hkArcPath(c, cx, cy, r, a0, a1, w, 0, ry); c.fillStyle = C[2]; c.fill();
  if (!o.noInk) { c.lineWidth = 2.2; c.strokeStyle = HK_INK; c.lineJoin = "round"; c.stroke(); }
  hkArcPath(c, cx, cy, r, a0, a1, w * 0.62, 0.25, ry); c.fillStyle = C[1]; c.fill();
  hkArcPath(c, cx, cy, r, a0, a1, w * 0.3, 0.5, ry); c.fillStyle = C[0]; c.fill();
  c.globalAlpha = ga;
}
function hkStreak(c, a, b, w, K, o) {
  o = o || {};
  const C = K.cols, th = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(th), ny = Math.cos(th), k = o.head === undefined ? 0.8 : o.head, ga = c.globalAlpha;
  const mx = a[0] + (b[0] - a[0]) * k, my = a[1] + (b[1] - a[1]) * k;
  const lens = (ww, s) => { c.beginPath(); hkPoly(c, [[a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s], [mx + nx * ww, my + ny * ww], [b[0], b[1]], [mx - nx * ww, my - ny * ww]]); };
  if (o.a !== undefined) c.globalAlpha = ga * o.a;
  lens(w, 0); c.fillStyle = C[2]; c.fill();
  if (!o.noInk) { c.lineWidth = 2; c.strokeStyle = HK_INK; c.lineJoin = "round"; c.stroke(); }
  lens(w * 0.6, 0.3); c.fillStyle = C[1]; c.fill();
  lens(w * 0.28, 0.55); c.fillStyle = C[0]; c.fill();
  c.globalAlpha = ga;
}

/* ---------- the floor mark ---------- */
function hkMark(c, x, y, w, K, a) {
  if (K.mark) return K.mark(c, x, y, w, K, a);
  const C = K.cols, sh = K.shape, ga = c.globalAlpha;
  c.globalAlpha = ga * (a === undefined ? 1 : a);
  if (sh === "cut") { hkStreak(c, [x - w, y + 1.5], [x + w, y - 2.5], 2.4, K, { head: 0.5 }); c.globalAlpha = ga; return; }
  c.save(); c.translate(x, y); c.scale(1, 0.26);
  c.setLineDash(sh === "bubble" ? [10, 7] : sh === "rune" ? [16, 6] : [22, 9]);
  c.beginPath(); c.arc(0, 0, w, 0, CV_TAU); c.lineWidth = 5; c.strokeStyle = HK_INK; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = C[1]; c.stroke();
  c.setLineDash([]); c.restore();
  for (let i = 0; i < 4; i++) hkShard(c, x - w * 0.8 + i * w * 0.53, y - 3 - (i % 2) * 5, 4.5, -1.2 + i * 0.5, K, i);
  c.globalAlpha = ga;
}

/* ---------- the particles ---------- */
// drawFx (effects.js) hands every fx entry here first; true when it was one of ours
// a spark particle as it ages: pops in to 1.1 R, settles, fades in its last 40 % (part: "front" / "back", see hkSpark)
function hkSparkFx(c, e, part) {
  const q = e.t / e.life, s = q < 0.2 ? 0.55 + (q / 0.2) * 0.55 : 1.1 - ((q - 0.2) / 0.8) * 0.4;
  c.globalAlpha = q < 0.6 ? 1 : Math.max(0, 1 - (q - 0.6) / 0.4);
  hkSpark(c, e.x, e.y, e.R * s, e.kit, e.tier, e.dir, e.seed, q, part);
  c.globalAlpha = 1;
}
function hkDrawFx(c, e, a) {
  const k = e.k;
  if (k === "hkm") return true;   // floor marks: hkUnder, under the fighters
  if (k === "hks") { hkSparkFx(c, e, "front"); return true; }   // its back layers: hkUnder
  if (k === "hkg") {
    c.globalAlpha = Math.min(1, a * 1.6);
    hkShard(c, e.x, e.y, e.s * (0.55 + 0.45 * a), e.rot || 0, e.kit, e.i);
    c.globalAlpha = 1;
    return true;
  }
  return false;
}
// the floor marks, after the stage and under the shadows and the fighters (render2D). A mark holds, then fades over its last e.fade ticks
// (8 when left out)
function hkUnder(c, g, tk) {
  for (const e of fx) {
    if (e.k === "hks" && e.tier >= 2) { hkSparkFx(c, e, "back"); continue; }   // a hit spark's flare, halo and ring go behind the fighter it hit
    if (e.k !== "hkm" || e.t < 0) continue;
    hkMark(c, e.x, e.y, e.w, e.kit, Math.min(1, (e.life - e.t) / (e.fade || 8)));
  }
  c.globalAlpha = 1;
}
// the Ultimates' payoffs that go behind the fighters (render2D, after the projectiles)
function uvBack(c, g, tk) {
  for (const f of g.fighters) { const fn = UV_BACK[f.spec.id]; if (fn) fn(c, g, f, tk); }
  c.globalAlpha = 1;
}

/* ---------- the swing smear's timing, the anticipation glint and the launch trail ---------- */
// a swing smear's alpha (drawSwoosh, draw-fighters.js; S its P.swoosh, m the move): 1 on the first active frame (the first two on the
// biggest arcs), then down to 0.25 at the end of the hit window
function hkSmearA(S, m) {
  const full = S.hv || S.body || S.r >= 18 ? 2 : 1, act = m ? m.active : 3, age = S.age || 0;
  return age < full ? 1 : Math.max(0.25, 1 - (0.75 * (age - full + 1)) / Math.max(1, act - full));
}
// a flat four-point glint, s its half length: the kit's core colour with an ink edge (drawGlint, draw-fighters.js)
function hkGlint(c, x, y, s, K) {
  const q = s * 0.2;
  c.beginPath(); hkPoly(c, [[x, y - s], [x + q, y - q], [x + s, y], [x + q, y + q], [x, y + s], [x - q, y + q], [x - s, y], [x - q, y - q]]);
  c.fillStyle = K.cols[0]; c.fill(); c.lineWidth = 1.6; c.strokeStyle = HK_INK; c.lineJoin = "round"; c.stroke();
}
// the launch trail: a ribbon through pts (oldest first), tapered from nothing at the tail to w (half width) at the newest point (the victim),
// the kit's edge colour with an ink edge, the body colour inside. Reuses two arrays (drawn every frame a launch is on)
const HK_RIB = [[], []];
function hkRibbon(c, pts, w) {
  const n = pts.length, A = HK_RIB[0], B = HK_RIB[1];
  A.length = B.length = 0;
  for (let k = 0; k < n; k++) {
    const p = pts[k], a = pts[k ? k - 1 : 0], b = pts[k < n - 1 ? k + 1 : k];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const ww = w * Math.pow(k / (n - 1), 1.25);
    A.push(p[0] - dy * ww, p[1] + dx * ww); B.push(p[0] + dy * ww, p[1] - dx * ww);
  }
  c.beginPath(); c.moveTo(A[0], A[1]);
  for (let i = 2; i < A.length; i += 2) c.lineTo(A[i], A[i + 1]);
  for (let i = B.length - 2; i >= 0; i -= 2) c.lineTo(B[i], B[i + 1]);
  c.closePath();
}
// the last stretch of a trail, at most len long (oldest first; the cut point interpolated); the trail itself when it is shorter
function hkCap(pts, len) {
  let n = pts.length - 1, d = 0;
  for (; n > 0; n--) {
    const s = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]);
    if (d + s > len) { const u = (len - d) / s, a = pts[n], b = pts[n - 1]; return [[a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], ...pts.slice(n)]; }
    d += s;
  }
  return pts;
}
function hkTrail(c, pts, w, K) {
  if (pts.length < 2) return;
  const ga = c.globalAlpha;
  c.lineJoin = "round";
  hkRibbon(c, pts, w); c.fillStyle = K.cols[2]; c.globalAlpha = ga * 0.9; c.fill(); c.lineWidth = 2.2; c.strokeStyle = HK_INK; c.stroke();
  hkRibbon(c, pts, w * 0.5); c.fillStyle = K.cols[1]; c.fill();
  c.globalAlpha = ga;
}

/* ===================== the hit grammar (concept D.1; effects.js calls these from handleEvent, updateFx and render2D) =====================
   Every fighter hit is one spark in the ATTACKER's kit (hkKit) on the contact edge, plus shards flying along the launch, by tier:
     tier 1  light       3 shards, the spark lives 4 ticks
     tier 2  heavy       6 shards, 6 ticks, a floor mark, the hit-stop look        heavies, specials, charged hits, or kb >= HK_MID_KB
     tier 3  launcher   10 shards, 8 ticks, the ink flare and the ring, a floor mark, the hit-stop look and the impact frames:
                        every finishing special (e.fin), every hit the engine calls lethal (the "lethal" event upgrades its spark), and
                        kb >= HK_LAUNCH_KB (the top 10 % of knockback). An Ultimate's launching hit is one of these; its small hits are not
   Armor hits and the 2v2 Catch are tier 1. PERF.q >= 1 halves the shards.
   SIZE RULE: the spark never hides the fighter being hit. Its edge layer, as drawn (the shape's reach, the pop-in to 1.1), is at most 0.225 x
   the victim's height (0.45 body heights wide; the ink flare and the ring reach 1.75 R, the halo is flat and faint), and its centre sits just
   outside the victim's outline (the hurtbox, plus 0.1 body heights), on the side the hit came from; its flare, halo and rings are drawn
   behind the fighters. Effects that belong to the attacker (smears, heavy looks, claw marks)
   pass behind the victim: render2D draws a fighter in "attack" under the others.
   IMPACT FRAMES (tier 3, live matches only: mode "match", not the menu's demo, not during the finisher, at most once per 30 ticks, never
   under Reduce flashes): sim tick 1 after the hit is frame A (paper screen, every fighter in ink), tick 2 frame B (ink screen, every fighter
   white, the spark in colour, speed lines from the contact point). The fighters are drawn once into one reused canvas (at most DPR 2) and
   filled in one colour. On a KO hit the finisher's own white frame (finisher.js fxHit) waits for the two frames.
   HIT-STOP LOOK (tier 2 and 3, live matches, while the engine's hitstop of that hit runs): the victim shakes 2 px on alternate ticks
   (pose(), P.jit), the backdrop dims 28 % (after the stage, before the fighters) and the camera punches in 4 % (camPunch). Under Reduce
   flashes this dim is what a launcher shows in place of the impact frames.
   RESIDUE: the floor mark (tier 2 and 3, and the ground pound) sits on the floor under the contact (the one the victim or the attacker
   stands on; none in mid-air), holds through the freeze and about 20 ticks after it, and fades over its last 8. */
// The launcher threshold, the top 10 % of knockback: the kb of every fighter hit (the engine's "hit" events, no armor, no boss) over 40 bot
// matches in node (each fighter in turn against another, CPU levels 0.7 / 0.9 against 0.9, every map; 3,967 hits; the first 20 matches
// alone: 1,927 hits, p90 23.8): p50 9.4, p75 14.1, p90 22.8, p95 32.7. Lights p90 16, heavies p50 30, specials p50 7. HK_MID_KB is the p75.
const HK_LAUNCH_KB = 23, HK_MID_KB = 14;
const HK_TIERS = [null,
  { n: 3, life: 4, R: 8, s: 3.4, sp: 4.2, mark: 0 },
  { n: 6, life: 6, R: 11, s: 4.2, sp: 5.4, mark: 19 },
  { n: 10, life: 8, R: 14, s: 5, sp: 6.6, mark: 26 }];
// how far each shape reaches past its nominal radius (hkLayer); the size rule divides by it. The cut is a thin line, so its length counts less
const HK_REACH = { feather: 1.2, bubble: 1.05, rune: 1.25, facet: 1.25, cut: 1.5, lobe: 1.25, chip: 1.1, crescent: 1.25, star: 1.1 };
const HK_PAPER = "#fff0c0";
// HKI: the impact frames running (t: sim ticks since the hit, 1 = frame A, 2 = frame B), HKS: the hit-stop look, HKL: this tick's last spark
const HKI = { g: null, t: 99, last: -999, x: 0, y: 0, seed: 0, flash: false };
const HKS = { g: null, def: -1, t0: 0, n: 0 };
const HKL = { tick: -1, g: null, def: -1, sp: null, e: null };
const HK_SIL = { cv: null, c: null };

function hkTier(e) {
  if (e.armor || e.broken) return 1;
  if (e.fin || e.kb >= HK_LAUNCH_KB) return 3;
  if (isHeavyKey(e.mv) || e.mv === "spec" || e.chg > 0 || e.kb >= HK_MID_KB) return 2;
  return 1;
}
// the contact edge: from the victim's middle out through the hit point to its outline (the hurtbox); a hit point already outside stays
function hkEdge(d, ex, ey, att) {
  const cx = d.x, cy = d.y - d.s.h * 0.5, hw = d.s.w * 0.5, hh = d.s.h * 0.5;
  let ux = ex - cx, uy = ey - cy, l = Math.hypot(ux, uy);
  if (l < 2) { ux = att ? att.x - cx : -d.facing; uy = att ? att.y - att.s.h * 0.5 - cy : 0; l = Math.hypot(ux, uy) || 1; }
  ux /= l; uy /= l;
  const t = Math.min(Math.abs(ux) > 1e-3 ? hw / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-3 ? hh / Math.abs(uy) : 1e9);
  if (Math.hypot(ex - cx, ey - cy) >= t) return [ex, ey];
  const o = t + d.s.h * 0.1;   // a little outside the hurtbox: the drawn figure (robe, hat, cape) reaches past it
  return [cx + ux * o, cy + uy * o];
}
// the floor a fighter stands on (its feet within 6 px of it): { y, x1, x2 }, or null in mid-air
function hkFloorOf(f) {
  if (!f || f.state === "dead" || f.state === "gone") return null;
  const S = STAGE.main;
  if (f.x >= S.x1 && f.x <= S.x2 && Math.abs(f.y - S.top) <= 6) return { y: S.top, x1: S.x1, x2: S.x2 };
  for (const p of STAGE.plats) if (f.x >= p.x1 && f.x <= p.x2 && Math.abs(f.y - p.y) <= 6) return { y: p.y, x1: p.x1, x2: p.x2 };
  return null;
}
const hkLive = (g) => mode === "match" && g === G;
// the spark, its shards and its mark at (x, y) in kit K; h the victim's height (the size rule)
function hkBurstAt(x, y, K, tier, dir, h) {
  const T = HK_TIERS[tier], R = Math.min(T.R, (0.225 * h) / (1.1 * (HK_REACH[K.shape] || 1.25)));
  const sp = { k: "hks", kit: K, tier, x, y, R, dir, seed: (Math.random() * 997) | 0, t: 0, life: T.life };
  addFx(sp);
  hkShards(x, y, K, tier, dir, R, T.n);
  return sp;
}
function hkShards(x, y, K, tier, dir, R, n) {
  const T = HK_TIERS[tier];
  if (PERF.q >= 1) n = Math.max(1, n >> 1);
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - 0.5) * 1.5, v = T.sp * (0.6 + Math.random() * 0.6), ca = Math.cos(a), sa = Math.sin(a);
    addFx({ k: "hkg", kit: K, x: x + ca * R * 0.4, y: y + sa * R * 0.4, vx: ca * v, vy: sa * v, s: T.s * (0.75 + Math.random() * 0.45), rot: a, vr: (Math.random() - 0.5) * 0.3, i, t: 0, life: 9 + tier * 2 + Math.random() * 4, damp: 0.86, g: 0.14 });
  }
}
// a fighter's hit (the "hit" event): the spark by tier, the mark, the hit-stop look and the impact frames
function hkHit(g, e, live) {
  const att = g.fighters[e.slot], def = e.def !== undefined ? g.fighters[e.def] : null, K = hkKit(att || ""), tier = hkTier(e);
  const [x, y] = def ? hkEdge(def, e.x, e.y, att) : [e.x, e.y];
  const dir = Math.atan2(e.diry || 0, e.dirx || (att ? att.facing : 1));
  const sp = hkBurstAt(x, y, K, tier, dir, def ? def.s.h * uvScale(def) : 64);
  Object.assign(HKL, { tick, g, def: def ? def.slot : -1, sp, e });
  if (tier >= 2) hkResidue(g, sp, def, att, tier);
  return sp;
}
// the mark under the contact and the hit-stop look; tier 3 also the impact frames
function hkResidue(g, sp, def, att, tier) {
  const fl = hkFloorOf(def) || hkFloorOf(att);
  if (fl && !sp.marked) { sp.marked = true; addFx({ k: "hkm", kit: sp.kit, x: clamp(sp.x, fl.x1 + 10, fl.x2 - 10), y: fl.y, w: HK_TIERS[tier].mark, t: 0, life: 20 + g.hitstop, fade: 8 }); }
  if (!def || !hkLive(g)) return;
  if (g.hitstop > 0) {
    Object.assign(HKS, { g, def: def.slot, t0: tick, n: g.hitstop });
    if (cam.pt >= cam.pn) camPunch(sp.x, sp.y, 0.09, g.hitstop + 8, 0.15, g.hitstop / (g.hitstop + 8));   // a 4 % punch-in (cam.z x (1 + 0.45 k))
  }
  if (tier >= 3 && !FIN.on && !hkCalm() && tick - HKI.last >= 30) Object.assign(HKI, { g, t: 0, last: tick, x: sp.x, y: sp.y, seed: sp.seed, flash: false });
}
// the "lethal" event: this tick's hit on that fighter cannot be survived, so it is a launcher
function hkLethal(g, e) {
  const sp = HKL.sp;
  if (HKL.tick !== tick || HKL.g !== g || HKL.def !== e.slot || !sp || sp.tier >= 3) return;
  const def = g.fighters[e.slot], h = def.s.h * uvScale(def);
  sp.tier = 3; sp.life = HK_TIERS[3].life;
  sp.R = Math.min(HK_TIERS[3].R, (0.225 * h) / (1.1 * (HK_REACH[sp.kit.shape] || 1.25)));
  hkShards(sp.x, sp.y, sp.kit, 3, sp.dir, sp.R, HK_TIERS[3].n - HK_TIERS[2].n);
  hkResidue(g, sp, def, g.fighters[e.by], 3);
}
// after finHit / finLethal (finisher.js): the white frame they start waits for the impact frames; under Reduce flashes it is only the dim
function hkFinFlash(g) {
  if (hkCalm()) { fxHitEl.style.setProperty("--hw", "0"); fxHitEl.classList.remove("big"); return; }
  if (HKI.g === g && HKI.t === 0 && fxHitEl.classList.contains("go")) { fxHitEl.classList.remove("go"); HKI.flash = true; }
}
// the 2v2 Catch: a small spark in the catcher's kit
function hkCatch(g, e) {
  const f = g.fighters[e.by];
  if (f) hkBurstAt(e.x, e.y, hkKit(f), 1, -Math.PI / 2, 64);
}
// once per sim tick (updateFx, frozen or not)
function hkTick(g) {
  if (HKI.g !== g || HKI.t > 3) return;
  HKI.t++;
  if (HKI.t === 3 && HKI.flash) { HKI.flash = false; fxRestart(fxHitEl, "go"); }
}
// the hit-stop look is on (the engine still holds the hit that started it)
const hkStopOn = (g) => HKS.g === g && g.hitstop > 0 && tick - HKS.t0 <= HKS.n + 1 && hkLive(g);
// pose(): the victim's shake
function hkJit(f, P, tk) { if (RG && HKS.def === f.slot && RG.fighters[f.slot] === f && hkStopOn(RG)) P.jit = [tk & 1 ? 2 : -2, P.jit[1]]; }
// render2D, after the stage: the dimmed backdrop (screen space)
function hkDim(c, g) {
  if (!hkStopOn(g)) return;
  c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = `rgba(14,10,30,${0.28 * Math.min(1, g.hitstop / 2)})`; c.fillRect(0, 0, L.gw, L.gh);
  c.restore();
}
// every fighter of g drawn into the reused canvas (screen resolution, at most DPR 2) and filled in one colour
function hkSil(g, tk, colr, ox, oy) {
  const s = Math.min(DPR, 2), w = Math.ceil(L.gw * s), h = Math.ceil(L.gh * s);
  if (!HK_SIL.cv) { HK_SIL.cv = document.createElement("canvas"); HK_SIL.c = HK_SIL.cv.getContext("2d"); }
  const cv = HK_SIL.cv, x = HK_SIL.c;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, w, h);
  x.setTransform(s * cam.z, 0, 0, s * cam.z, s * ox, s * oy);
  for (const f of g.fighters) if (f.state !== "dead" && f.state !== "gone") drawFighter(x, f, tk);
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
  x.globalCompositeOperation = "source-in"; x.fillStyle = colr; x.fillRect(0, 0, w, h); x.globalCompositeOperation = "source-over";
  x.drawImage(cv, 0, 0); x.drawImage(cv, 0, 0);   // a see-through figure (a fighter blinking while doomed or intangible) made solid: alpha 0.55 -> 0.96
  return cv;
}
// render2D: an impact frame in place of the picture (true when one was drawn)
function hkFrame(c, g, tk) {
  const k = HKI.g === g ? HKI.t : 0;
  if (k !== 1 && k !== 2) return false;
  const A = k === 1, ox = L.gw / 2 - cam.x * cam.z + cam.sx, oy = L.gh / 2 - cam.y * cam.z + cam.sy;
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.globalAlpha = 1;
  c.fillStyle = A ? HK_PAPER : HK_INK; c.fillRect(0, 0, L.gw, L.gh);
  if (!A) {   // frame B: speed lines out of the contact point, then the white figures, then the spark in colour
    const [sx, sy] = toScreen(HKI.x, HKI.y), R = Math.hypot(L.gw, L.gh);
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * CV_TAU + (nz(HKI.seed + i * 7) - 0.5) * 0.35, r0 = 46 + 70 * nz(HKI.seed + i * 3), wd = 0.012 + 0.016 * nz(i * 5 + HKI.seed);
      c.fillStyle = i % 3 ? "#f3ead2" : "#ffffff"; c.globalAlpha = 0.55 + 0.4 * nz(i * 11 + HKI.seed);
      c.beginPath(); c.moveTo(sx + Math.cos(an) * r0, sy + Math.sin(an) * r0);
      c.lineTo(sx + Math.cos(an - wd) * R, sy + Math.sin(an - wd) * R); c.lineTo(sx + Math.cos(an + wd) * R, sy + Math.sin(an + wd) * R); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
  }
  c.drawImage(hkSil(g, tk, A ? HK_INK : "#ffffff", ox, oy), 0, 0, L.gw, L.gh);
  if (!A) {
    c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * ox, DPR * oy);
    for (const e of fx) if (e.k === "hks" || e.k === "hkg") hkDrawFx(c, e, 1 - e.t / e.life);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  c.globalAlpha = 1;
  return true;
}

// tests (tests/pwhit.py): the kit's drawing from outside the page's scope, the hit grammar's state, and a frame drawn with or without the
// effects (fx, sfx) or one fighter alone (the coverage check)
window.__hkTest = { kits: HK_KIT, kit: hkKit, spark: hkSpark, shard: hkShard, smear: hkSmear, streak: hkStreak, mark: hkMark, glint: hkGlint, trail: hkTrail,
  LAUNCH: HK_LAUNCH_KB, MID: HK_MID_KB, tiers: HK_TIERS, reach: HK_REACH, tier: hkTier, imp: HKI, stop: HKS, get fx() { return fx; }, get tick() { return tick; },
  set rf(v) { P.rf = v; }, get calm() { return hkCalm(); },
  // the picture of the game now: { noFx: the fx and sfx lists left out, only: [fx kinds]: only those } ; drawn on the game's canvas
  frame(o) {
    const g = window.__blastline.game, kf = fx.splice(0), ks = sfx.splice(0);
    try { if (o && o.only) fx.push(...kf.filter((e) => o.only.includes(e.k))); else if (!(o && o.noFx)) { fx.push(...kf); sfx.push(...ks); } render2D(g, tick); }
    finally { fx.length = 0; sfx.length = 0; fx.push(...kf); sfx.push(...ks); }
  },
  // fighter `slot` alone on a clear canvas the size of the game's, with the world transform of the frame
  alone(slot) {
    const g = window.__blastline.game, f = g.fighters[slot], cv = document.createElement("canvas"); cv.width = ctx.canvas.width; cv.height = ctx.canvas.height;
    const x = cv.getContext("2d"), ox = L.gw / 2 - cam.x * cam.z + cam.sx, oy = L.gh / 2 - cam.y * cam.z + cam.sy;
    x.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * ox, DPR * oy); RG = g; drawFighter(x, f, tick);
    return cv;
  } };
