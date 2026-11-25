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
                                                    age 0..1 (the caller scales R and sets globalAlpha; q is for a shape that changes as it ages)
     hkShard(c, x, y, s, rot, kit, i)               one shard of the kit's shape, s its size, rot its angle, i picks core or body colour
     hkSmear(c, cx, cy, r, a0, a1, w, kit, o)       a swing smear: a crescent on the arc of radius r about (cx, cy) from angle a0 to a1,
                                                    w thick at its widest, thickest towards the leading end a1, three tones (edge with an ink
                                                    line, body, core). o: { ry (an elliptic arc: y radius = r * ry), a (alpha), noInk }
     hkStreak(c, a, b, w, kit, o)                   a straight lens from point a to point b, w its half width, widest at o.head (0..1, 0.8)
     hkMark(c, x, y, w, kit, a)                     the floor mark (the residue), centred on (x, y) on the floor, w its half width, a alpha
   A fighter's own file (hk-<fighter>.js) may replace one of these for its kit: HK_KIT.<id>.spark / .shard / .mark, same arguments.

   PARTICLES in the shared fx list (effects.js), drawn by drawFx through hkDrawFx; under the fighters by hkUnder:
     { k: "hks", kit, tier, x, y, R, dir, seed, t, life }                 a spark: pops in to 1.1 R, settles, fades in its last 40 %
     { k: "hkg", kit, x, y, vx, vy, s, rot, vr, i, t, life, damp, g }     a flying shard (updateFx moves it: vx, vy, damp, g, vr)
     { k: "hkm", kit, x, y, w, t, life }                                  a floor mark, drawn under the fighters (hkUnder)
   HOOKS render2D calls (effects.js): hkUnder(c, g, tk) after the stage, under the shadows and the fighters (floor marks); uvBack(c, g, tk)
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
function hkSpark(c, x, y, R, K, tier, dir, seed, q) {
  if (K.spark) return K.spark(c, x, y, R, K, tier, dir, seed, q);
  if (R <= 0.5) return;
  const C = K.cols, sh = K.shape, ga = c.globalAlpha, rot2 = sh === "facet" || sh === "rune" ? 0.2 : 0.55;
  c.lineJoin = "round";
  if (tier >= 3) { c.beginPath(); hkBurst(c, x, y, R * 1.5, 12, 0.3, dir, seed + 3); c.fillStyle = HK_INK; c.fill(); }   // the ink flare
  if (tier >= 2) {   // a soft halo: two flat discs, no gradient
    c.fillStyle = C[1]; c.globalAlpha = ga * 0.14;
    c.beginPath(); c.arc(x, y, R * 1.9, 0, CV_TAU); c.fill(); c.beginPath(); c.arc(x, y, R * 1.45, 0, CV_TAU); c.fill();
    c.globalAlpha = ga;
  }
  hkLayer(c, x, y, R, sh, dir + 0.2, dir, seed); c.fillStyle = C[2]; c.fill(); c.lineWidth = 2.2; c.strokeStyle = HK_INK; c.stroke();
  hkLayer(c, x, y, R * 0.72, sh, dir + rot2, dir, seed); c.fillStyle = C[1]; c.fill();
  hkLayer(c, x, y, R * 0.42, sh, dir + 0.2, dir, seed); c.fillStyle = C[0]; c.fill();
  if (sh === "rune") { c.lineWidth = 1.8; c.strokeStyle = C[0]; c.setLineDash([R * 0.42, R * 0.28]); c.beginPath(); c.arc(x, y, R * 1.35, 0, CV_TAU); c.stroke(); c.setLineDash([]); }
  if (tier >= 3) { c.lineWidth = 2.2; c.strokeStyle = "#ffffff"; c.setLineDash([R * 0.9, R * 0.5]); c.beginPath(); c.arc(x, y, R * 1.75, dir + 0.4, dir + 0.4 + CV_TAU); c.stroke(); c.setLineDash([]); }
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
function hkDrawFx(c, e, a) {
  const k = e.k;
  if (k === "hkm") return true;   // floor marks: hkUnder, under the fighters
  if (k === "hks") {
    const q = e.t / e.life, s = q < 0.2 ? 0.55 + (q / 0.2) * 0.55 : 1.1 - ((q - 0.2) / 0.8) * 0.4;
    c.globalAlpha = q < 0.6 ? 1 : Math.max(0, 1 - (q - 0.6) / 0.4);
    hkSpark(c, e.x, e.y, e.R * s, e.kit, e.tier, e.dir, e.seed, q);
    c.globalAlpha = 1;
    return true;
  }
  if (k === "hkg") {
    c.globalAlpha = Math.min(1, a * 1.6);
    hkShard(c, e.x, e.y, e.s * (0.55 + 0.45 * a), e.rot || 0, e.kit, e.i);
    c.globalAlpha = 1;
    return true;
  }
  return false;
}
// the floor marks, after the stage and under the shadows and the fighters (render2D)
function hkUnder(c, g, tk) {
  for (const e of fx) {
    if (e.k !== "hkm" || e.t < 0) continue;
    hkMark(c, e.x, e.y, e.w, e.kit, 1 - e.t / e.life);
  }
  c.globalAlpha = 1;
}
// the Ultimates' payoffs that go behind the fighters (render2D, after the projectiles)
function uvBack(c, g, tk) {
  for (const f of g.fighters) { const fn = UV_BACK[f.spec.id]; if (fn) fn(c, g, f, tk); }
  c.globalAlpha = 1;
}
// tests (tests/pwhit.py): the kit's drawing from outside the page's scope
window.__hkTest = { kits: HK_KIT, kit: hkKit, spark: hkSpark, shard: hkShard, smear: hkSmear, streak: hkStreak, mark: hkMark };
