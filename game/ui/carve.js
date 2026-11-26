/* ===================== Carved Ink: the fighters' drawing kit (Fable's redesign, concept redesign/concept.md; UI only) =====================
   Every top-level name in this file and in ui/fig-<fighter>.js starts with cv / CV_ (all ui parts share one scope).
   A fighter with an entry CV_FIG[costume] is drawn by this kit (drawPotato hands over to cvFigure); a fighter without one keeps the old
   drawing. window.__cvOff = true draws everyone the old way (tests/pwcarve.py times both). The simulation is never read for more than
   positions and states, and nothing here writes to a fighter or a game.

   THE LOOK. One ink CV_INK; outer lines 2.6 units, inner 1.2-1.8. Three flat tones per part: the base, one hard shadow on the lower back
   (cvSh: the base pushed 34 % towards violet), a highlight plane on metal and hats (cvLt). A cream rim CV_RIM on the back edge of the body
   and the big costume shapes. No gradients, no shadowBlur, no strokes and no clips at draw time: every tone is one filled polygon.

   SPACE. "Standing frame": world units, origin at the feet, y up is negative, facing right; the fighter as he stands at rest, the same space
   as the mockups (redesign/mockups/src/fighters.js) and as pose() with no crouch, bob or lean. The kit maps it onto the rig every frame:
   standing (x, y) -> rig (x, y + P.cvDrop) [crouch and bob] -> turned by P.lean about P.hip -> squashed by the motion layer about the feet.
   Arms and legs are drawn in the rig's own (unsquashed) frame from shoulder / hip points that follow the body to P.hF / P.hB / P.fF / P.fB,
   so a punch or a kick always ends where the rig (and the hitbox) puts it.

   ONE FIGURE = CV_FIG[costume] = {
     pal: { key: "#rrggbb", ... }      every colour the figure uses, default skin (palette 0). Leaf greens, irises, metals too: every skin
                                       transform (Ink Noir, dim, hit flash) then reaches all of them.
     chip: [{}, {...}, {...}, {...}]   overrides for the chip skins 1-3 (palette index 1..3; 0 is pal itself)
     won: { scratch, zorp, kraken, harvest }   overrides for the won skins (pal.road); include `skin` (the body)
     pm: { 1: {...}, 2: {...} }        overrides for the Pommes skins (pal.pommes 1 Ink Noir, 2 Starfall). Ink Noir first turns every pal colour
                                       into one of two inks (light CV_NOIR_L / dark CV_NOIR_D by luminance), then applies pm[1]
     prim: "key" | ["key", ...]        the costume's main colour(s): an unknown palette (a copy that is not in the list) sets it from pal.accent
     derive(C)                         optional: sets the tones that follow a skin's colours (C.greave = cvSh(C.steel, 0.35)), before the mode
     body: { x, y, rx, ry, o }         the potato in the standing frame (cvBlob(x, y, rx, ry, o)): the silhouette potatoPath() replays (glaze,
                                       Road and Pommes passes, the 2v2 team rim) and P.rx / P.ry / P.cy / P.top
     face: { x, y, s, ... }            the live face (cvFace below); x, y the middle between the eyes, also P.head
     mouthPt: [x, y]                   P.mouthPt (where flames and the manga's "mmm" come from)
     arm: { shF, shB, len, lenB, bendB, r0, r1, col, colB, colU, cuff, hand, handB }   shoulders (standing frame), arm lengths (front,
                                       back; the rig's), the back elbow's side ("down" default, "back", "fwd", "up"), radii at the shoulder
                                       and the wrist (taper it: an arm reads by its shoulder and its hand), colour keys (front, back; colU
                                       the front upper arm's own, a sleeve). cuff: { len, r0, r1, col } a band on the forearm behind the hand
                                       (a gauntlet's cuff; the front arm). hand / handB: a mitten { r, col, thumb (default true), k (the size of
                                       its shadow: 1 a mitten, ~1.5 a gauntlet), more(c, K, x, y, front, ang) } (more: live details over it,
                                       ang the forearm's angle); its outline goes with the arm's in one fill
     leg: { hipF, hipB, len, bones, r0, r1, col, colB, boot: { s, col, colB }, draw }   hips (standing frame), bone length (bones: 1 a
                                       single bone, for short legs), radii, colours; the boots are carved for you from boot (parts "boot",
                                       "bootB", S.boot); draw(c, K, hip, foot, front) instead for a figure with its own legs (a hakama)
     carve: { name(S) }                the static parts, carved once per figure (the first time it is drawn) into filled polygons with colour
                                       KEYS, not colours: one carving serves every skin and mode (S below)
     draw(K)                           the figure, back to front, every frame: calls the kit (K below) and its own live parts
   }
   cvFigReg(id, fig) registers one (fills in fig.id and the silhouette). The face's options are listed above cvFace.

   SHAPES are arrays of points [x, y] (dense polygons; nothing is stroked): cvBlob(cx, cy, rx, ry, o) the potato, cvSm(pts, open) a smooth
   path through points ([x, y, 1] a sharp corner), cvCirc(x, y, r, ry, rot), cvCapsule(a, b, r0, r1), cvRect(x, y, w, h).
   COLOUR KEYS: a key of the skin's colour set ("cape"), "key/sh" its shadow tone, "key/sh.3" a lighter one, "key/lt" its highlight, "ink",
   "rim", "eye" (the eye white), or a literal "#rrggbb" (kept on every skin: avoid it but for mouths). A skin's set may name a tone itself
   ("skin/sh": "#b8761a", "rim": "#ff6ad5" in chip / won / pm): that exact key then wins over the computed one.
   THE CARVER, S (in carve.name(S); the standing frame, or what S.with sets):
     S.cel(shape, key, o)   the carved part: the ink outline (o.lw, default 2.6; 0 none; half outside the shape, half over it), the base,
                            the hard shadow (what the shape moved by o.sh = [dx, dy] towards the light leaves uncovered; default [4, -3];
                            0 none; o.shade its key, default key + "/sh"), a highlight (o.hi = [dx, dy] the same way, o.hiCol), the rim on
                            the back edge (o.rim: 1), then o.in(S): details clipped to the part (to its convex hull)
     S.fill(shape, key)     a flat fill;  S.rect(x, y, w, h, key);  S.specks([[x, y, r], ...], key)
     S.line(pts, w, key[, w1])   a brush line along a smooth curve through pts (w to w1 wide), ink by default
     S.leaf(x, y, len, ang, key[, vein]), S.boot(x, y, s, key), S.star(x, y, r, key[, ink])   the mockup's helpers
     S.with(x, y, ang, k, fn)    fn(S) in a frame moved to (x, y), turned by ang and scaled by k (line widths and shadow shifts scale too)

   THE KIT, K (one per figure per frame; read-only on f and g):
     K.c, K.f, K.P, K.tk, K.C (this frame's colours: cvCol(K.C, key)), K.fig, K.flash, K.at, K.rest (standing about, no move)
     K.hF, K.hB      the hands to draw (P.hF / P.hB; a figure may move them at rest, e.g. onto a hilt, before it draws the arms)
     K.sx, K.sy      the motion layer's squash (1 = none)
     K.stack(list[, fn, fk])   THE way to draw the carved parts on the body: list, back to front, of part names and tokens. A run of names
                     is drawn as ONE sprite, baked upright (per skin and mode, run and zoom level, never per lean or sway) and drawn
                     through the frame's lean and fn, turned (a pose that recurs is held: COST). Tokens: "face" the
                     face (baked with the run at rest, a shout's mouth laid over it; live with an expression, hitstun or a blink), "skin"
                     the won / Pommes skin body pass and Glaze (put it right after the body), "top" the skin's top pass (after the hats),
                     a function g(K) a live part in between, null nothing (handy: cond ? "hilt" : null). Tokens break the run.
                     fn(c) a transform in the standing frame (a sway, a flutter); fk, a string naming its step, lets a pose of it be held:
                     quantize what goes into fn coarsely (0.02-0.05 steps) so a few steps recur. Without fk the run always draws turned.
                     On a manga page (its context is wrapped: cvMgInk) every part is drawn as paths instead, so the page can ink it
     K.sprite(list)  parts as one sprite in the current transform (for a big part that moves on its own)
     K.draw(name)    a carved part drawn as paths in the current transform (cheaper for a small part that moves on its own: the raven,
                     the boots)
     K.part(name[, fn])   a carved part drawn as paths on the body (fn as for K.stack); costs one fill per tone and shape, use K.stack
     K.body(fn)      fn(c) in the standing frame (squash, crouch, lean): a live part that rides on the body
     K.pt(x, y)      a standing-frame point in the rig frame (where arms and legs start)
     K.arm(front[, held])   the arm to K.hF / K.hB with its hand; held(c, K) is drawn between the arm and the hand (a sword hilt in the fist)
     K.leg(front)    the leg to P.fF / P.fB with its boot
     K.face()        the live face (P.expr, hitstun eyes, P.mouth, blinks); K.stack's "face" token calls it when it must
     K.rim()         the 2v2 team rim is the rim pass (TEAM RIM below); K.rim() draws the old cheap body rim only where that pass is off
                     (PERF.q >= 2: a phone the frame-time watchdog finds slow)
     K.skinBody(), K.skinTop()   the skin passes ("skin" / "top" in K.stack call them; "skin" breaks the run only for a skin with
                     something live on the potato: K.skinMid); K.skinBack() / K.skinFront() round the whole figure (cvFigure)
     K.fit(name, carve)   a skin's fitting (skinfx.js: horns, tail, dome, net, laurel, disc): carved once, one sprite (K.sprite)
     A skin's flat paint over the body-level parts (skinfx.js skcAtop) is laid by K.paintRun: baked into the sprites (source-atop) or, where
     the kit draws paths, clipped to the parts' outline (skinfx.js skcClip)
     K.spring(name, target, k)   a lagging value for secondary motion (capes, tails): per fighter, eased once per tick
   The back arm and back leg are one tone (their shadow): they read as further away. Live parts use cvLimb / cvMitt / cvCapAdd / cvSegAdd /
   cvArcAdd: build a path, fill it; ink under, the shadow, the lit part inset towards the light (CV_LDX, CV_LDY).

   TEAM RIM (a 2v2 match: TEAM_RIM, draw-world.js; never a stand-in drawn `at`, a manga page, the select screen or a sheet). Each fighter
   wears a band CV_RIM_PX screen pixels wide in its team's colour (TEAM_COL, ui/duo.js) round its whole silhouette, outside it only.
   cvFigure runs the figure's draw(K) twice: first the rim pass (cvRimPass; K.rimPass set: { tc, R, L, p }, R the band in units, L the
   zoom level, p the rim path), then the figure. The rim pass gathers every ink outline (and the opaque bits of a carved part that reach
   past its ink, a stem: op.out) grown by R into one path in device pixels, each point's y on a whole pixel (CV_RimPath: the raster's fast
   case), and fills it once in the team colour before any part of the figure: the figure then covers all of it but the band. Carved
   parts (K.stack's runs, K.sprite, K.draw's parts, a cvPath shape) give their outline, the union of their polygons traced once
   (cvRimUnion) and grown once per zoom level (cvRimGrow): no sprite, nothing per frame but placing it; arms, legs and mittens give their
   ink grown (cvLimb, cvMitt); the figure's own live parts draw through CV_RimCtx, a context that records an ink fill's path (CV_INK or
   OUT) and grows it (cvRimGrowLive), strokes an ink stroke 2R wider at once, and drops every other fill, stroke, image and text. The
   face, the skin passes and the sprites are skipped (a figure's sprites and pose counts are the figure's pass alone). A figure that is
   see-through (a dodge, the intangible blink) draws the pass at its own alpha squared. Cost (tests/pwcarve.py --rim): about 0.2 ms a
   figure on the test machine's software raster, mostly the one fill.

   MOTION (cvMotion, from pose()): P.sq > 0 squashes (the coil before a hit: <= 8 % in the last 2 startup frames of a light, the last 5 of a
   heavy, held while a heavy is charged; landing), P.sq < 0 stretches (<= 12 % on the first active frame, a jump's take-off). The figure is
   scaled about the feet: K.sx = 1 + 0.6 * sq, K.sy = 1 - sq. Personality (an idle breath, a cape that settles late) is the figure's
   own: K.spring and tk in draw(K).

   COST (software canvas on a phone: every fill costs per shape and per edge, a stroke three times a fill, a sprite per pixel; budget
   0.35 ms per figure per frame, tests/pwcarve.py times it; and a match must not keep baking sprites: tests/pwcarve.py ME OPP --live).
   A smoothed sprite costs about 4 ns per device pixel it covers (transparent ones too; twice that turned), a fill a few microseconds
   plus its area: big static parts go through K.stack (a figure is two or three sprites: what hangs behind, the body run), limbs, hands,
   boots and small moving parts are a few fills each. THE SPRITE RULE (cvBaked, K.stack): a sprite's key is the skin, the run of parts
   and the zoom level, never a value that changes from frame to frame: a lean or a sway turns the upright sprite. A pose (lean step and
   fk) gets a sprite of its own only once it is held: drawn 20 times, at most ten per stack and fighter (a stance, a run's lean, a cape at
   rest). So pass fk only for a transform whose steps recur, quantized coarsely. A figure bakes at most one sprite a frame (the rest draw
   as paths that frame); a new zoom level waits until it has been needed 20 frames in a row, drawing a cached level scaled meanwhile; a
   sprite over 0.5 M px (a big draw: the fighter select, a sheet's portrait), the hit flash, the dimmed helpless figure and a manga page
   are drawn as paths. Sprites live in CV_BAKE (6 M px, least recently used out). The live test's limits: at most 10 new sprites in the
   last 600 of 1800 frames and 150 in all, at most 3 M px held with two figures. Anything else that changes every frame: a few plain
   fills. */
const CV_INK = "#1a1326", CV_RIM = "#fff0c0", CV_EYE = "#fffdf4", CV_TAU = Math.PI * 2;
const CV_NOIR_L = "#d8cfb8", CV_NOIR_D = "#3a3842";
const CV_FIG = {};
let cvKatC = null;   // the colour set katana() (draw-fighters.js) paints with while a figure holds it (ui/fig-samurai.js)

/* ---------- colours (hex in, hex out, cached) ---------- */
const cvHexC = new Map(), cvMixC = new Map();
function cvHex(h) {
  let v = cvHexC.get(h);
  if (!v) { v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; cvHexC.set(h, v); }
  return v;
}
function cvMix(a, b, t) {
  const k = a + b + t;
  let v = cvMixC.get(k);
  if (v === undefined) {
    const A = cvHex(a), B = cvHex(b);
    v = "#" + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, "0")).join("");
    cvMixC.set(k, v);
  }
  return v;
}
const cvSh = (col, k) => cvMix(col, "#2a1450", k === undefined ? 0.34 : k);   // the one shadow tone: pushed towards violet
const cvLt = (col, k) => cvMix(col, "#fff6d8", k === undefined ? 0.4 : k);
const cvLum = (h) => { const [r, g, b] = cvHex(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };

/* ---------- shapes: dense polygons, made once ---------- */
const CV_STEP = 1.2;   // units between the points of a curve
const cvMid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function cvQuadTo(out, p0, q, p1) {
  const n = Math.max(2, Math.min(18, Math.ceil((Math.hypot(q[0] - p0[0], q[1] - p0[1]) + Math.hypot(p1[0] - q[0], p1[1] - q[1])) / CV_STEP)));
  for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * q[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * q[1] + t * t * p1[1]]); }
}
// a potato: a superellipse (sq < 1 squarer), pear (wider at the bottom), lean (the top forward), with two small bumps
function cvBlob(cx, cy, rx, ry, o) {
  o = o || {}; const pear = o.pear || 0, sq = o.sq || 1, lean = o.lean || 0, n = Math.max(24, Math.min(80, Math.ceil((rx + ry) * 3.1 / CV_STEP))), out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * CV_TAU, cs = Math.cos(a), sn = Math.sin(a);
    const ex = Math.sign(cs) * Math.pow(Math.abs(cs), sq), ey = Math.sign(sn) * Math.pow(Math.abs(sn), sq);
    const bump = 1 + 0.02 * Math.sin(a * 3 + 1) + 0.012 * Math.sin(a * 5 + 2.3);
    const y = ey * ry * bump, x = ex * rx * (1 + pear * ey) * bump - y * lean;
    out.push([cx + x, cy + y]);
  }
  return out;
}
// a smooth closed shape through points; a point [x, y, 1] is a sharp corner, the others round it off (open: a curve through them)
function cvSm(pts, open) {
  const n = pts.length, out = [];
  if (open) {
    let cur = [pts[0][0], pts[0][1]]; out.push(cur);
    if (n === 2) { out.push([pts[1][0], pts[1][1]]); return out; }
    for (let i = 1; i < n - 1; i++) { const e = i === n - 2 ? pts[n - 1] : cvMid(pts[i], pts[i + 1]); cvQuadTo(out, cur, pts[i], e); cur = e; }
    return out;
  }
  let cur = cvMid(pts[n - 1], pts[0]); out.push(cur);
  for (let i = 0; i < n; i++) {
    const q = pts[i], x = cvMid(q, pts[(i + 1) % n]);
    if (q[2]) { out.push([q[0], q[1]]); out.push(x); } else cvQuadTo(out, cur, q, x);
    cur = x;
  }
  out.pop();   // back at the start
  return out;
}
function cvCirc(x, y, r, ry, rot) {
  ry = ry || r; const n = Math.max(10, Math.min(64, Math.ceil(Math.PI * (r + ry) / CV_STEP))), cs = Math.cos(rot || 0), sn = Math.sin(rot || 0), out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * CV_TAU, u = Math.cos(a) * r, v = Math.sin(a) * ry; out.push([x + u * cs - v * sn, y + u * sn + v * cs]); }
  return out;
}
function cvCapsule(a, b, r0, r1) {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]), out = [], arc = (c, r, a0) => { const n = Math.max(5, Math.ceil(Math.PI * r / CV_STEP)); for (let i = 0; i <= n; i++) { const t = a0 + (i / n) * Math.PI; out.push([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]); } };
  arc(a, r0, th + Math.PI / 2); arc(b, r1, th - Math.PI / 2);
  return out;
}
const cvRect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function cvArea(P) { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return s / 2; }
const cvPos = (P) => (cvArea(P) < 0 ? P.slice().reverse() : P);   // one winding for every polygon: a fill of many is their union
const cvShift = (P, dx, dy) => P.map((p) => [p[0] + dx, p[1] + dy]);
function cvInside(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
// where segment p-q crosses segment r-s: [x, y, t along p-q, u along r-s] (each in [0, 1)), or null
function cvHit(p, q, r, s) {
  const dx = q[0] - p[0], dy = q[1] - p[1], ex = s[0] - r[0], ey = s[1] - r[1], den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-12) return null;
  const fx = r[0] - p[0], fy = r[1] - p[1], t = (fx * ey - fy * ex) / den, u = (fx * dy - fy * dx) / den;
  return t >= 0 && t < 1 && u >= 0 && u < 1 ? [p[0] + dx * t, p[1] + dy * t, t, u] : null;
}
// cuts out the small loops an offset makes at a tight corner
function cvUnloop(P) {
  for (let i = 0; i < P.length && P.length > 5; i++) {
    const n = P.length;
    for (let k = 2; k < Math.min(16, n - 1); k++) {
      const j = (i + k) % n, h = cvHit(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n]);
      if (!h) continue;
      const x = [h[0], h[1]];
      P = i + k < n ? P.slice(0, i + 1).concat([x], P.slice(j + 1)) : P.slice(j + 1, i + 1).concat([x]);
      i = -1; break;
    }
  }
  return P;
}
// the shape grown by d (shrunk for d < 0); corners that open up are rounded (the round join of a stroke)
function cvOffset(P, d) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], p = P[i], b = P[(i + 1) % n];
    const l0 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l1 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const n0x = (p[1] - a[1]) / l0, n0y = -(p[0] - a[0]) / l0, n1x = (b[1] - p[1]) / l1, n1y = -(b[0] - p[0]) / l1;
    const cr = n0x * n1y - n0y * n1x, dt = n0x * n1x + n0y * n1y;
    if (cr * d > 0 && dt < 0.92) {
      const a0 = Math.atan2(n0y, n0x), da = Math.atan2(cr, dt), k = Math.max(1, Math.ceil(Math.abs(da) / 0.35));
      for (let j = 0; j <= k; j++) { const t = a0 + (da * j) / k; out.push([p[0] + Math.cos(t) * d, p[1] + Math.sin(t) * d]); }
    } else {
      let mx = n0x + n1x, my = n0y + n1y; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const m = Math.min(4, 1 / Math.max(0.25, mx * n0x + my * n0y));
      out.push([p[0] + mx * d * m, p[1] + my * d * m]);
    }
  }
  return cvUnloop(out);
}
// A minus B (both one winding): the pieces of A outside B, each closed along B's edge (the shadow a shape leaves when moved)
function cvMinus(A, B) {
  const n = A.length, m = B.length, X = [];
  for (let i = 0; i < n; i++) {
    const p = A[i], q = A[(i + 1) % n];
    for (let j = 0; j < m; j++) {
      const r = B[j], s = B[(j + 1) % m], h = cvHit(p, q, r, s);
      if (h) X.push({ x: h[0], y: h[1], a: i + h[2], b: j + h[3], out: (s[0] - r[0]) * (q[1] - p[1]) - (s[1] - r[1]) * (q[0] - p[0]) < 0 });
    }
  }
  if (!X.length) return cvInside(B, A[0][0], A[0][1]) ? [] : [A];
  if (X.length % 2) return [];   // a touch we cannot read: no shadow rather than a wrong one
  const byA = X.slice().sort((p, q) => p.a - q.a), byB = X.slice().sort((p, q) => p.b - q.b), res = [], used = new Set();
  byA.forEach((x, i) => (x.ia = i)); byB.forEach((x, i) => (x.ib = i));
  for (const s of X) {
    if (!s.out || used.has(s)) continue;
    const poly = []; let cur = s, guard = 0;
    do {
      used.add(cur);
      const nx = byA[(cur.ia + 1) % byA.length], da = (nx.a - cur.a + n) % n;   // along A, outside B, to where A goes into B
      poly.push([cur.x, cur.y]);
      for (let k = Math.floor(cur.a) + 1; k <= cur.a + da; k++) poly.push(A[k % n]);
      poly.push([nx.x, nx.y]); used.add(nx);
      const pv = byB[(nx.ib - 1 + byB.length) % byB.length], db = (nx.b - pv.b + m) % m;   // back along B, inside A
      for (let k = Math.floor(nx.b); k > nx.b - db; k--) poly.push(B[((k % m) + m) % m]);
      cur = pv;
    } while (cur !== s && ++guard < 64);
    if (cur === s && poly.length > 2) res.push(poly);
  }
  return res;
}
function cvHull(P) {
  const s = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const p of s) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return cvPos(lo.slice(0, -1).concat(hi.slice(0, -1)));
}
// P cut to the convex H (one winding)
function cvClip(P, H) {
  let out = P;
  for (let i = 0; i < H.length && out.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length], ex = b[0] - a[0], ey = b[1] - a[1], inp = out, side = (p) => ex * (p[1] - a[1]) - ey * (p[0] - a[0]);
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return out;
}
// a brush line along an open polyline, w0 to w1 wide, round ends
function cvBrush(pts, w0, w1) {
  if (w1 === undefined) w1 = w0;
  const n = pts.length, L = [], R = [], cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = cum[n - 1] || 1, dir = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
    const w = (w0 + ((w1 - w0) * cum[i]) / tot) / 2, p = pts[i];
    L.push([p[0] + dy * w, p[1] - dx * w]); R.push([p[0] - dy * w, p[1] + dx * w]); dir.push([dx, dy, w]);
  }
  const cap = (p, d, from) => { const out = [], a0 = Math.atan2(-d[0], d[1]) + from; for (let k = 1; k < 6; k++) { const t = a0 + (k / 6) * Math.PI; out.push([p[0] + Math.cos(t) * d[2], p[1] + Math.sin(t) * d[2]]); } return out; };
  return cvUnloop(L.concat(cap(pts[n - 1], dir[n - 1], 0), R.reverse(), cap(pts[0], dir[0], Math.PI)));
}
// a closed polygon with the points it does not need left out (none moves the outline more than tol units): a fill costs by its edges
function cvSimplify(P, tol) {
  const n = P.length;
  if (n < 8) return P;
  let far = 0, fd = -1;   // split the ring at its two most distant points
  for (let i = 1; i < n; i++) { const d = (P[i][0] - P[0][0]) ** 2 + (P[i][1] - P[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n), t2 = tol * tol;
  keep[0] = keep[far] = 1;
  const dp = (i0, i1) => {   // Ramer-Douglas-Peucker on the run i0 .. i1 (i1 may wrap)
    const st = [[i0, i1]];
    while (st.length) {
      const [a, b] = st.pop(), A = P[a % n], B = P[b % n], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy || 1e-9;
      let m = -1, md = t2;
      for (let i = a + 1; i < b; i++) {
        const Q = P[i % n], t = Math.max(0, Math.min(1, ((Q[0] - A[0]) * dx + (Q[1] - A[1]) * dy) / l2)), ex = A[0] + dx * t - Q[0], ey = A[1] + dy * t - Q[1], d = ex * ex + ey * ey;
        if (d > md) { md = d; m = i; }
      }
      if (m > 0) { keep[m % n] = 1; st.push([a, m], [m, b]); }
    }
  };
  dp(0, far); dp(far, n);
  return P.filter((_, i) => keep[i]);
}
// polygons to one Path2D (for a figure's own cached live shapes; it keeps them, cvP, for the 2v2 team rim)
function cvPath(polys) {
  const p = new Path2D();
  p.cvP = polys.map((Q) => cvSimplify(Q, 0.12));
  for (const P of p.cvP) { p.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) p.lineTo(P[i][0], P[i][1]); p.closePath(); }
  return p;
}
function cvBootPts(x, y, s) { return cvSm([[x - 5 * s, y, 1], [x - 5.5 * s, y - 8 * s], [x + 2 * s, y - 9 * s], [x + 4 * s, y - 5 * s], [x + 10 * s, y - 5 * s], [x + 11 * s, y, 1]]); }

/* ---------- the carver: a figure's static parts as fills by colour key, once ---------- */
function CV_Carve() { this.ops = []; this.m = [1, 0, 0, 1, 0, 0]; this.clipH = null; }
CV_Carve.prototype = {
  with(x, y, ang, k, fn) {
    const m0 = this.m, [a, b, c, d, e, f] = m0, cs = Math.cos(ang || 0) * (k || 1), sn = Math.sin(ang || 0) * (k || 1);
    this.m = [a * cs + c * sn, b * cs + d * sn, -a * sn + c * cs, -b * sn + d * cs, a * x + c * y + e, b * x + d * y + f];
    try { fn(this); } finally { this.m = m0; }
  },
  _xf(P) { const [a, b, c, d, e, f] = this.m; return P.map((p) => [a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f]); },
  // polygons (in the current frame) as fills of one key; t: a shading tone (left out on a hit flash), al: its alpha
  add(polys, k, t, al) {
    let ps = polys.filter((P) => P.length > 2).map((P) => this._xf(P));
    if (this.clipH) ps = ps.map((P) => cvClip(P, this.clipH));
    ps = ps.filter((P) => P.length > 2).map(cvPos);
    if (!ps.length) return;
    t = t ? 1 : 0; al = al || 1;
    const last = this.ops[this.ops.length - 1];
    if (last && last.k === k && last.t === t && last.a === al) last.ps.push(...ps);
    else this.ops.push({ k, t, a: al, ps });
  },
  fill(P, k) { this.add([P], k); },
  rect(x, y, w, h, k) { this.add([cvRect(x, y, w, h)], k); },
  specks(list, k) { this.add(list.map(([x, y, r]) => cvCirc(x, y, r, r * 0.7, 0.4)), k); },
  line(pts, w, k, w1) { this.add([cvBrush(cvSm(pts, true), w, w1)], k || "ink"); },
  cel(P, k, o) {
    o = o || {}; P = cvPos(P);
    const lw = o.lw === undefined ? 2.6 : o.lw, In = lw ? cvOffset(P, -lw / 2) : P, sh = o.sh === undefined ? [4, -3] : o.sh;
    if (lw) this.add([cvOffset(P, lw / 2)], o.ink || "ink");
    this.add([In], k);
    if (sh && o.shade !== 0) this.add(cvMinus(In, cvShift(P, sh[0], sh[1])), o.shade || k + "/sh", 1);
    if (o.hi) this.add(cvMinus(In, cvShift(P, o.hi[0], o.hi[1])), o.hiCol || k + "/lt", 1);
    if (o.rim) this.add(cvMinus(In, cvShift(P, 2.2, -0.4)), "rim", 1, 0.85);
    if (o.in) {
      const h0 = this.clipH, H = cvHull(this._xf(In));
      this.clipH = h0 ? cvPos(cvClip(H, h0)) : H;
      try { o.in(this); } finally { this.clipH = h0; }
    }
  },
  leaf(x, y, len, ang, k, vein) {
    this.with(x, y, ang, 1, () => {
      this.cel(cvSm([[0, 0, 1], [len * 0.35, -len * 0.3], [len, 0, 1], [len * 0.35, len * 0.3]]), k, { sh: [0.6, -1.6], lw: 1.8, shade: k + "/sh.3" });
      this.line([[len * 0.15, 0], [len * 0.75, 0]], 1, vein || k + "/sh.5");
    });
  },
  boot(x, y, s, k) { this.cel(cvBootPts(x, y, s), k, { sh: [2, -2], lw: 2.2 }); this.rect(x - 5 * s, y - 1.6 * s, 16 * s, 1.6 * s, "ink"); },
  star(x, y, r, k, ink) {
    const P = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * CV_TAU - Math.PI / 2, rr = i % 2 ? r * 0.36 : r; P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    if (ink) this.cel(P, k, { lw: ink, sh: 0 }); else this.fill(P, k);
  },
  done() {
    // out: an opaque fill (not a shading tone) with a point outside every ink polygon of the part, a stem drawn as a plain line; rp: the
    // polygons the 2v2 team rim traces (cvRimShape), the opaque ink's and these
    const ink = [];
    for (const o of this.ops) if (o.k === "ink") ink.push(...o.ps);
    return this.ops.map((o) => {
      const bb = [1e9, 1e9, -1e9, -1e9];
      for (const P of o.ps) for (const q of P) { bb[0] = Math.min(bb[0], q[0]); bb[1] = Math.min(bb[1], q[1]); bb[2] = Math.max(bb[2], q[0]); bb[3] = Math.max(bb[3], q[1]); }
      const out = o.k !== "ink" && o.a === 1 && !o.t && o.ps.some((P) => P.some((q) => !ink.some((I) => cvInside(I, q[0], q[1]))));
      return { p: cvPath(o.ps), k: o.k, t: o.t, a: o.a, bb, out, rp: o.a === 1 && (o.k === "ink" || out) ? o.ps : null };
    });
  },
};
// the parts of a figure, carved the first time it is drawn
function cvOpsOf(fig) {
  if (!fig.ops) { const ops = {}; for (const k in fig.carve) { const S = new CV_Carve(); fig.carve[k](S); ops[k] = S.done(); } fig.ops = ops; }
  return fig.ops;
}
// one carved part, in the current transform
function cvOps(c, ops, C) {
  if (c.cvRim) { cvRimDraw(c.c, cvRimOfOps(ops), c.cvRim); return; }   // the rim pass (CV_RimCtx): the part's rim
  const ga = c.globalAlpha;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.t && C.flat) continue;
    c.fillStyle = cvCol(C, o.k);
    if (o.a !== 1) { c.globalAlpha = ga * o.a; c.fill(o.p); c.globalAlpha = ga; } else c.fill(o.p);
    if (cvMg && o.k === "ink") cvMgInk(c, o.p);
  }
}
// a manga page (ui/manga.js) draws a fighter through a context whose fillStyle is wrapped: it tints every colour, its strokes in OUT come out
// k times wider, and its halo pass turns everything white with wider lines still. The kit then draws paths, not sprites (K.stack, K.sprite),
// and gives the ink outlines a stroke the page can widen (cvMgInk)
let cvMg = false;
function cvMgInk(c, p) { if (!cvMg) return; c.lineWidth = 1.3; c.strokeStyle = OUT; c.lineJoin = "round"; if (p) c.stroke(p); else c.stroke(); }

// a part's fills; "face" is the face at rest (cvFaceCarve), carved like the rest
function cvPartOps(fig, name) {
  if (name !== "face") return cvOpsOf(fig)[name];
  if (!fig.faceOps) { const S = new CV_Carve(); cvFaceCarve(S, fig.face); fig.faceOps = S.done(); }
  return fig.faceOps;
}

/* ---------- sprites: a run of carved parts drawn once per skin and zoom level, upright ---------- */
// A sprite is baked in the standing frame with nothing turned, at a zoom level q (device pixels per unit, a quarter octave), and drawn
// through the figure's transform of the frame (lean, sway, squash): so its key is only the skin, the run of parts and q (a held pose
// adds its own, K.stack), and a match bakes a few dozen sprites in its first seconds and then few. The zoom level: the cached one that is
// no more than 3 % smaller than the transform and no more than two thirds bigger (a camera that eases in and out reuses what it has),
// else the next quarter octave up.
const CV_BAKE = new Map(), CV_BAKE_MAX = 6e6, CV_SPRITE_MAX = 5e5;   // pixels held in all (least recently used out); the biggest sprite
let cvBakePx = 0, cvBakeMade = 0, cvBakeBig = 0;
// the box of a run of parts in the standing frame, kept on the figure
function cvRunBox(fig, list, lk) {
  let b = fig.boxes.get(lk);
  if (b) return b;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const n of list) for (const o of cvPartOps(fig, n)) { x0 = Math.min(x0, o.bb[0]); y0 = Math.min(y0, o.bb[1]); x1 = Math.max(x1, o.bb[2]); y1 = Math.max(y1, o.bb[3]); }
  b = [Math.floor(x0 - 1), Math.floor(y0 - 1), Math.ceil(x1 + 1), Math.ceil(y1 + 1)];
  fig.boxes.set(lk, b);
  return b;
}
// the sprite of a run for the kit K, or null: the caller then draws the parts as paths. Null when it would be bigger than CV_SPRITE_MAX
// pixels (a big draw: the fighter select, a sheet's portrait) or when it is not baked yet and K has baked one this frame already.
// pose: null upright, or a held pose { k, ls, fn } baked into the sprite: the lean ls (steps of 0.02 rad, about the hip) and the stack's
// transform fn, named by k
function cvBaked(K, list, pose) {
  const fig = K.fig, C = K.C, z = K.z, lk = list.join(","), pre = C.key + "|" + lk + "|", suf = pose ? "@" + pose.k : "";
  const L = Math.ceil(Math.log2(z) * 4 - 0.05);
  let s;
  for (const k of [L - 1, L, L + 1, L + 2, L + 3]) {   // a cached level that fits
    const q = Math.pow(2, k / 4);
    if (q * 1.03 < z || q * 0.6 > z) continue;
    s = CV_BAKE.get(pre + k + suf);
    if (s) { CV_BAKE.delete(pre + k + suf); CV_BAKE.set(pre + k + suf, s); return s; }   // most recently used last
  }
  // nothing cached fits. A new level waits until the figure has needed it for 20 frames in a row (a camera punch is over by then): until
  // then a held pose turns the upright sprite (the caller) and an upright run uses another level that is cached, drawn up to 1.7 times
  // bigger or up to 2.4 times smaller (only a run met for the first time is baked at once)
  let fb = null;
  for (const k of [L - 1, L - 2, L - 3, L + 3, L + 4, L + 5]) { fb = CV_BAKE.get(pre + k + suf); if (fb) break; }
  if ((pose || fb) && cvNeed(K, pre + L + suf) < 20) return pose ? null : fb;
  let b = cvRunBox(fig, list, lk), m = null;
  const q = Math.pow(2, L / 4);
  if (pose) {   // the pose as a matrix, and the box through it
    const px = K.P.hip[0], py = K.P.hip[1] - K.P.cvDrop;
    m = new DOMMatrix().translateSelf(px, py).rotateSelf((pose.ls / 50) * (180 / Math.PI)).translateSelf(-px, -py);
    if (pose.fn) pose.fn({ translate: (x, y) => m.translateSelf(x, y), rotate: (a) => m.rotateSelf((a * 180) / Math.PI), scale: (x, y) => m.scaleSelf(x, y),
      transform: (a, b_, c, d, e, f) => m.multiplySelf(new DOMMatrix([a, b_, c, d, e, f])) });
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      const t = m.transformPoint({ x, y }); x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y);
    }
    b = [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)];
  }
  const w = Math.max(1, Math.ceil((b[2] - b[0]) * q)), h = Math.max(1, Math.ceil((b[3] - b[1]) * q));
  if (w * h > CV_SPRITE_MAX || K.baked) return null;
  K.baked = true;
  const cv2 = document.createElement("canvas"); cv2.width = w; cv2.height = h;
  const x = cv2.getContext("2d");
  x.setTransform(q, 0, 0, q, -b[0] * q, -b[1] * q);
  if (m) x.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  K.paintRun(x, list, true);   // (with the skin's atop paint)
  s = { cv: cv2, x0: b[0], y0: b[1], w: w / q, h: h / q, px: w * h };
  const key = pre + L + suf;
  CV_BAKE.set(key, s); cvBakePx += s.px; cvBakeMade++; cvBakeBig = Math.max(cvBakeBig, s.px);
  for (const [k, v] of CV_BAKE) { if (cvBakePx <= CV_BAKE_MAX || k === key) break; CV_BAKE.delete(k); cvBakePx -= v.px; }
  return s;
}
// how many frames in a row this fighter has asked for the sprite key (one count per game tick)
const CV_NEED = new WeakMap();
function cvNeed(K, key) {
  let m = CV_NEED.get(K.f);
  if (!m) CV_NEED.set(K.f, (m = new Map()));
  let v = m.get(key);
  if (!v || K.tk - v[1] > 1 || K.tk < v[1]) m.set(key, (v = [0, K.tk - 1]));
  if (K.tk !== v[1]) { v[0]++; v[1] = K.tk; }
  if (m.size > 64) for (const [k, w] of m) if (K.tk - w[1] > 1) m.delete(k);
  return v[0];
}
// device pixels per unit of the current transform
function cvZoomOf(c) { const m = c.getTransform(); return Math.max(0.05, Math.sqrt(Math.max(m.a * m.a + m.b * m.b, m.c * m.c + m.d * m.d))); }

/* ---------- live drawing: build a path, fill it ---------- */
// a tapered capsule a -> b (radii r0, r1), added to the current path
function cvCapAdd(c, ax, ay, bx, by, r0, r1) {
  const th = Math.atan2(by - ay, bx - ax), h = Math.PI / 2;
  c.moveTo(ax + Math.cos(th + h) * r0, ay + Math.sin(th + h) * r0);
  c.arc(ax, ay, r0, th + h, th + 3 * h); c.arc(bx, by, r1, th - h, th + h); c.closePath();
}
// a circle, added to the current path (anticlockwise on the screen, like a limb's contour: a fill of both is their union)
const cvCircAdd = (c, x, y, r) => { c.moveTo(x + r, y); c.arc(x, y, r, CV_TAU, 0, true); };
// a straight stroke x0, y0 -> x1, y1, w wide (square ends), added to the current path
function cvSegAdd(c, x0, y0, x1, y1, w) {
  const l = Math.hypot(x1 - x0, y1 - y0) || 1, ux = ((x1 - x0) / l) * (w / 2), uy = ((y1 - y0) / l) * (w / 2);
  c.moveTo(x0 - ux + uy, y0 - uy - ux); c.lineTo(x1 + ux + uy, y1 + uy - ux); c.lineTo(x1 + ux - uy, y1 + uy + ux); c.lineTo(x0 - ux - uy, y0 - uy + ux); c.closePath();
}
// a band along an arc (centre x, y, radius r, w wide), added to the current path
function cvArcAdd(c, x, y, r, a0, a1, w) { c.moveTo(x + Math.cos(a0) * (r + w / 2), y + Math.sin(a0) * (r + w / 2)); c.arc(x, y, r + w / 2, a0, a1); c.arc(x, y, Math.max(0.1, r - w / 2), a1, a0, true); c.closePath(); }
// the light comes from the upper front: a round part's lit side is the part moved that way, cut to itself (the mockup's cel(sx 2, sy -1.5))
const CV_LDX = 2, CV_LDY = -1.5, CV_LD = Math.hypot(CV_LDX, CV_LDY);
// an elbow or a knee for a limb of bone length len from a to b: bend "down" (elbows), "fwd" (knees), "back", "up"
function cvJoint(a, b, len, bend) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  let mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  if (d < len) {
    const off = Math.sqrt(Math.max(0, (len / 2) * (len / 2) - (d / 2) * (d / 2)));
    let nx = -dy / d, ny = dx / d;
    if (bend === "fwd" ? nx < 0 : bend === "back" ? nx > 0 : bend === "up" ? ny > 0 : ny < 0) { nx = -nx; ny = -ny; }
    mx += nx * off; my += ny * off;
  }
  return [mx, my];
}
// the outline of a limb a -> e -> b (two bones; e null: one bone a -> b) with radii r0, rm, r1, moved by ox, oy, as one contour added to the
// current path: a round elbow outside, a mitred one inside; round ends where capA / capB, else cut straight (an end hidden under the body,
// a boot or a fist costs nothing)
function cvLimbAdd(c, a, e, b, r0, rm, r1, ox, oy, capA, capB) {
  if (!e) { e = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; rm = (r0 + r1) / 2; }
  let d1x = e[0] - a[0], d1y = e[1] - a[1], d2x = b[0] - e[0], d2y = b[1] - e[1];
  let l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
  if (l1 < 1e-3 && l2 < 1e-3) { cvCircAdd(c, a[0] + ox, a[1] + oy, Math.max(r0, r1)); return; }
  if (l1 < 1e-3) { d1x = d2x; d1y = d2y; l1 = l2; } else if (l2 < 1e-3) { d2x = d1x; d2y = d1y; l2 = l1; }
  d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
  const t1 = Math.atan2(d1x, -d1y), t2 = Math.atan2(d2x, -d2y);   // the angles of the left normals (-dy, dx)
  const cr = d1x * d2y - d1y * d2x, phi = Math.atan2(cr, d1x * d2x + d1y * d2y), ex = e[0] + ox, ey = e[1] + oy;
  let first = true;
  const pt = (x, y) => { if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); };
  const arc = (x, y, r, a0, da, n) => { for (let i = 0; i <= n; i++) { const t = a0 + (da * i) / n; pt(x + Math.cos(t) * r, y + Math.sin(t) * r); } };
  const joint = (sg) => {   // the elbow on side sg (+1 the left side, going out; -1 the right side, coming back)
    if (Math.abs(phi) < 0.06) pt(ex + Math.cos(sg > 0 ? t1 : t2 + Math.PI) * rm, ey + Math.sin(sg > 0 ? t1 : t2 + Math.PI) * rm);
    else if (cr * sg > 0) {   // inside the bend: where the two edges meet
      let mx = Math.cos(t1) + Math.cos(t2), my = Math.sin(t1) + Math.sin(t2); const ml = Math.hypot(mx, my) || 1;
      const k = (sg * rm) / Math.max(0.35, Math.cos(phi / 2)); pt(ex + (mx / ml) * k, ey + (my / ml) * k);
    } else if (sg > 0) arc(ex, ey, rm, t1, phi, Math.max(1, Math.ceil(Math.abs(phi) / 0.6)));
    else arc(ex, ey, rm, t2 + Math.PI, -phi, Math.max(1, Math.ceil(Math.abs(phi) / 0.6)));
  };
  pt(a[0] + ox + Math.cos(t1) * r0, a[1] + oy + Math.sin(t1) * r0);
  joint(1);
  if (capB) arc(b[0] + ox, b[1] + oy, r1, t2, -Math.PI, 5);
  else { pt(b[0] + ox + Math.cos(t2) * r1, b[1] + oy + Math.sin(t2) * r1); pt(b[0] + ox - Math.cos(t2) * r1, b[1] + oy - Math.sin(t2) * r1); }
  joint(-1);
  if (capA) arc(a[0] + ox, a[1] + oy, r0, t1 + Math.PI, -Math.PI, 5);
  else pt(a[0] + ox - Math.cos(t1) * r0, a[1] + oy - Math.sin(t1) * r0);
  c.closePath();
}
// a limb a -> e -> b (e null: one bone) tapered r0 -> r1 in three fills: the ink (with whatever inkMore adds to it, a mitten's outline), the
// shadow tone, the lit part (the limb moved towards the light, cut to itself); noInk: the last two only (a colour laid over a limb)
function cvLimb(c, a, e, b, r0, r1, col, shade, lw, inkMore, capA, capB, noInk) {
  const rm = (r0 + r1) / 2, w = (lw || 2.2) / 2;
  if (c.cvRim) {   // the rim pass (CV_RimCtx): the ink grown by the band, one fill (a colour laid over a limb has no ink: nothing)
    if (noInk) return;
    const p = c.cvRim.p.at(c.c), R = c.cvRim.R;
    cvLimbAdd(p, a, e, b, r0 + w + R, rm + w + R, r1 + w + R, 0, 0, capA, capB);
    if (inkMore) inkMore(p);
    return;
  }
  if (!noInk) {
    c.beginPath(); cvLimbAdd(c, a, e, b, r0 + w, rm + w, r1 + w, 0, 0, capA, capB);
    if (inkMore) inkMore(c);
    c.fillStyle = CV_INK; c.fill(); cvMgInk(c);
  }
  c.beginPath(); cvLimbAdd(c, a, e, b, r0 - w, rm - w, r1 - w, 0, 0, capA, capB); c.fillStyle = shade; c.fill();
  if (shade === col) return;
  const g = (CV_LD + w) / 2, k = (CV_LD - w) / 2 / CV_LD;
  c.beginPath(); cvLimbAdd(c, a, e, b, Math.max(0.4, r0 - g), Math.max(0.4, rm - g), Math.max(0.4, r1 - g), CV_LDX * k, CV_LDY * k, capA, capB); c.fillStyle = col; c.fill();
}
// a mitten (its ink went with the arm's unless ink): round, the shadow low at the back (k scales it: 1 a mitten, 2 a big gauntlet), a thumb
function cvMitt(c, x, y, r, col, shade, thumb, k, ink) {
  k = k || 1;
  const w = 1.1, s = CV_LD * k;
  if (c.cvRim) {   // the rim pass: its ink grown by the band (an ink that went with the arm's went with the arm's rim)
    if (ink) cvCircAdd(c.cvRim.p.at(c.c), x, y, r + w + c.cvRim.R);
    return;
  }
  if (ink) { c.beginPath(); cvCircAdd(c, x, y, r + w); c.fillStyle = CV_INK; c.fill(); cvMgInk(c); }
  c.beginPath(); cvCircAdd(c, x, y, r - w); c.fillStyle = shade; c.fill();
  if (shade !== col) { const d = (s - w) / 2 / CV_LD; c.beginPath(); cvCircAdd(c, x + CV_LDX * d, y + CV_LDY * d, Math.max(0.5, r - (s + w) / 2)); c.fillStyle = col; c.fill(); }
  if (thumb !== false) { c.beginPath(); cvArcAdd(c, x + r * 0.15, y - r * 0.1, r * 0.55, -0.3, 1.5, 1.3); c.fillStyle = CV_INK; c.fill(); }
}

/* ---------- the 2v2 team rim (TEAM RIM in the header) ---------- */
const CV_RIM_PX = 2;   // the band past the ink, in screen pixels (as the old body rim: teamRimBody, draw-world.js)
let cvRimOff = false;   // tests/pwcarve.py: a 2v2 drawn without it (the cost of the rim)
// A fill costs by its edges and by every pixel of every piece that overlaps another, so a carved part's rim is its outline: the union of its
// polygons, drawn on a scratch canvas CV_RIM_UPX pixels to the unit and traced (marching squares, each point placed by the coverage),
// simplified. The outer contours wind as cvPos, the holes the other way (so cvOffset grows the one and shrinks the other)
const CV_RIM_UPX = 3;
let cvRimCv = null;
function cvRimUnion(polys) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const P of polys) for (const q of P) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  if (!(x1 > x0 && y1 > y0)) return [];
  const s = CV_RIM_UPX, W = Math.ceil((x1 - x0) * s) + 4, H = Math.ceil((y1 - y0) * s) + 4, ox = 2 - x0 * s, oy = 2 - y0 * s;
  const cv = cvRimCv || (cvRimCv = document.createElement("canvas"));
  if (cv.width < W || cv.height < H) { cv.width = Math.max(cv.width, W); cv.height = Math.max(cv.height, H); }
  const x = cv.getContext("2d", { willReadFrequently: true });
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.setTransform(s, 0, 0, s, ox, oy); x.beginPath();
  for (const P0 of polys) { const P = cvPos(P0); x.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) x.lineTo(P[i][0], P[i][1]); x.closePath(); }
  x.fillStyle = "#000"; x.fill();
  const d = x.getImageData(0, 0, W, H).data, v = (i, j) => d[(j * W + i) * 4 + 3] / 255;
  // a crossing on the edge from sample (i, j) along x (k 0) or y (k 1): id 2 (j W + i) + k, its point in units
  const pos = new Map(), nxt = new Map();
  const pt = (id) => {
    let q = pos.get(id);
    if (!q) {
      const k = id & 1, ij = id >> 1, i = ij % W, j = (ij - i) / W, a = v(i, j), b = k ? v(i, j + 1) : v(i + 1, j), t = (0.5 - a) / (b - a);
      pos.set(id, (q = [(i + 0.5 + (k ? 0 : t) - ox) / s, (j + 0.5 + (k ? t : 0) - oy) / s]));
    }
    return q;
  };
  const F = [false, false, false, false], E = [0, 0, 0, 0];
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), e = v(i, j + 1);
    F[0] = a >= 0.5; F[1] = b >= 0.5; F[2] = c >= 0.5; F[3] = e >= 0.5;   // the corners clockwise: top left, top right, bottom right, bottom left
    if (F[0] === F[1] && F[1] === F[2] && F[2] === F[3]) continue;
    E[0] = 2 * (j * W + i); E[1] = 2 * (j * W + i + 1) + 1; E[2] = 2 * ((j + 1) * W + i); E[3] = 2 * (j * W + i) + 1;   // edge k: corner k to k + 1
    // a run of inside corners k .. m is cut off from edge k - 1 to edge m (so every contour keeps the inside on one side)
    if (F[0] !== F[1] && F[1] !== F[2] && F[2] !== F[3]) {   // a saddle: the middle decides which corners are joined
      const mid = (a + b + c + e) / 4 >= 0.5;
      for (let k = 0; k < 4; k++) if (F[k] !== mid) { if (F[k]) nxt.set(E[(k + 3) % 4], E[k]); else nxt.set(E[k], E[(k + 3) % 4]); }
      continue;
    }
    let k = 0;
    while (!(F[k] && !F[(k + 3) % 4])) k++;
    let m = k;
    while (F[(m + 1) % 4]) m = (m + 1) % 4;
    nxt.set(E[(k + 3) % 4], E[m]);
  }
  const out = [];
  for (const id0 of nxt.keys()) {
    if (nxt.get(id0) < 0) continue;
    const P = [];
    let id = id0;
    for (;;) { const n = nxt.get(id); if (n === undefined || n < 0) break; P.push(pt(id)); nxt.set(id, -1); id = n; }
    if (P.length > 2 && Math.abs(cvArea(P)) > 0.3) out.push(cvSimplify(P, 0.12));
  }
  let big = null;
  for (const P of out) if (!big || Math.abs(cvArea(P)) > Math.abs(cvArea(big))) big = P;
  return big && cvArea(big) < 0 ? out.map((P) => P.reverse()) : out;
}
// the outline grown by R (round outside corners; a hole the band closes left out): its contours as flat lists x, y, x, y ...
function cvRimGrow(cont, R) {
  const out = [];
  for (const P of cont) {
    const hole = cvArea(P) < 0, Q = cvSimplify(cvOffset(P, R), Math.max(0.3, R * 0.2));   // (R / 5: a fifth of the band, half a screen pixel)
    if (Q.length < 3 || (hole && !(cvArea(Q) < -R * R))) continue;
    const F = new Float64Array(Q.length * 2);
    for (let i = 0; i < Q.length; i++) { F[2 * i] = Q[i][0]; F[2 * i + 1] = Q[i][1]; }
    out.push(F);
  }
  return out;
}
// a live ink path grown by R into the rim path p (CV_RimPath), cheaply as it is made every frame: a point a corner (two at a sharp outside
// one), no loop cut out
function cvRimGrowLive(p, polys, R) {
  for (const P0 of polys) {
    const D = P0.filter((q, i) => { const r = P0[(i + 1) % P0.length]; return Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 0.05; });   // (no repeated point)
    const n = D.length;
    if (n < 3) continue;
    const P = cvPos(D);
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n], q = P[i], b = P[(i + 1) % n];
      const l0 = Math.hypot(q[0] - a[0], q[1] - a[1]), l1 = Math.hypot(b[0] - q[0], b[1] - q[1]);
      const n0x = (q[1] - a[1]) / l0, n0y = -(q[0] - a[0]) / l0, n1x = (b[1] - q[1]) / l1, n1y = -(b[0] - q[0]) / l1;
      if (n0x * n1y - n0y * n1x > 0 && n0x * n1x + n0y * n1y < 0.5) {   // a sharp outside corner: cut off
        if (i) p.lineTo(q[0] + n0x * R, q[1] + n0y * R); else p.moveTo(q[0] + n0x * R, q[1] + n0y * R);
        p.lineTo(q[0] + n1x * R, q[1] + n1y * R);
        continue;
      }
      let mx = n0x + n1x, my = n0y + n1y;
      const ml = Math.hypot(mx, my) || 1, m = (R * Math.min(4, 1 / Math.max(0.25, (mx * n0x + my * n0y) / ml))) / ml;
      if (i) p.lineTo(q[0] + mx * m, q[1] + my * m); else p.moveTo(q[0] + mx * m, q[1] + my * m);
    }
    p.closePath();
  }
}
// the rim of carved parts (a list of their ops): the outline of their ink and of the fills that reach past it (op.rp); its grown paths are
// made per zoom level (g), lazily
function cvRimShape(opsList) {
  const all = [];
  for (const ops of opsList) for (const o of ops) if (o.rp) for (const P of o.rp) if (P.length > 2) all.push(P);
  return { cont: cvRimUnion(all), g: new Map() };
}
const cvRimOfOps = (ops) => ops.rimS || (ops.rimS = cvRimShape([ops]));
function cvRimOfRun(fig, list) {
  const m = fig.rimRuns || (fig.rimRuns = new Map()), lk = list.join(",");
  let S = m.get(lk);
  if (!S) m.set(lk, (S = cvRimShape(list.map((n) => cvPartOps(fig, n)))));
  return S;
}
// The rim pass gathers the whole rim in one path in device pixels (rim.p), filled once at its end: one blend (a see-through figure shows no
// darker overlaps), one raster job. Each piece is placed through the transform it is drawn in, and every point's y is rounded to a whole
// pixel: the raster fills a path whose edges start and end on pixel rows at about half the cost (x keeps its fraction, the band its shape)
function CV_RimPath() { this.p = new Path2D(); this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
CV_RimPath.prototype = {
  at(c) { const m = c.getTransform(); this.a = m.a; this.b = m.b; this.c = m.c; this.d = m.d; this.e = m.e; this.f = m.f; return this; },
  moveTo(x, y) { this.p.moveTo(this.a * x + this.c * y + this.e, Math.round(this.b * x + this.d * y + this.f)); },
  lineTo(x, y) { this.p.lineTo(this.a * x + this.c * y + this.e, Math.round(this.b * x + this.d * y + this.f)); },
  closePath() { this.p.closePath(); },
  arc(x, y, r, a0, a1, ccw) {   // as points (a mitten, a limb's round end): 12 to the turn
    let d = a1 - a0;
    if (!ccw && d >= CV_TAU) d = CV_TAU; else if (ccw && -d >= CV_TAU) d = -CV_TAU;
    else { d %= CV_TAU; if (!ccw && d < 0) d += CV_TAU; if (ccw && d > 0) d -= CV_TAU; }
    const n = Math.max(2, Math.ceil((Math.abs(d) * 12) / CV_TAU));
    for (let i = 0; i <= n; i++) { const t = a0 + (d * i) / n; this.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); }
  },
  // grown contours (cvRimGrow)
  add(G) { for (const F of G) { this.moveTo(F[0], F[1]); for (let i = 2; i < F.length; i += 2) this.lineTo(F[i], F[i + 1]); this.closePath(); } },
};
// a rim shape, grown for the zoom level rim.L (a quarter octave; one either side will do, so a camera that eases in and out makes few), added
// in the current transform of c
function cvRimDraw(c, S, rim) {
  const L = rim.L;
  let G = S.g.get(L) || S.g.get(L - 1) || S.g.get(L + 1);
  if (!G) {
    G = cvRimGrow(S.cont, (CV_RIM_PX * DPR) / Math.pow(2, L / 4));
    if (S.g.size > 5) S.g.delete(S.g.keys().next().value);
    S.g.set(L, G);
  }
  rim.p.at(c).add(G);
}
const cvIsInk = (s) => s === CV_INK || s === OUT;
// The rim pass's context: the figure's own live parts draw through it unchanged. An ink fill becomes the rim: the path, which it records as
// it is built (lines; arcs, ellipses and curves as points), grown by R and filled in the team colour (a cvPath shape: its outline, as a carved
// part's; a path it could not follow, another Path2D or one built across a change of transform, is filled and stroked 2R wide); an ink stroke is a team-colour stroke 2R wider; every
// other fill and stroke, an image or a text is dropped. The colours and the line width it is given are kept here (with save / restore), the
// rest goes to the canvas
function CV_RimCtx(c, rim) {
  this.c = c; this.cvRim = rim; this._fs = c.fillStyle; this._ss = c.strokeStyle; this._lw = c.lineWidth; this._st = [];
  this._sp = []; this._cur = null; this._ok = true;
}
const CV_ARC_STEP = 0.35;   // radians between the points of a recorded arc
CV_RimCtx.prototype = {
  get fillStyle() { return this._fs; }, set fillStyle(v) { this._fs = v; },
  get strokeStyle() { return this._ss; }, set strokeStyle(v) { this._ss = v; },
  get lineWidth() { return this._lw; }, set lineWidth(v) { if (v > 0 && v < Infinity) this._lw = v; },
  save() { this._st.push(this._fs, this._ss, this._lw); this.c.save(); },
  restore() { if (this._st.length) { this._lw = this._st.pop(); this._ss = this._st.pop(); this._fs = this._st.pop(); } this._moved(); this.c.restore(); },
  // the path, recorded
  _pt(x, y) { if (!this._cur) this._sp.push((this._cur = [])); this._cur.push([x, y]); },
  _moved() { if (this._sp.length) this._ok = false; },   // a change of transform under a path being built: it cannot be grown
  beginPath() { this._sp = []; this._cur = null; this._ok = true; this.c.beginPath(); },
  moveTo(x, y) { this._cur = null; this._pt(x, y); this.c.moveTo(x, y); },
  lineTo(x, y) { this._pt(x, y); this.c.lineTo(x, y); },
  closePath() { this._cur = null; this.c.closePath(); },
  rect(x, y, w, h) { this._cur = null; this._pt(x, y); this._pt(x + w, y); this._pt(x + w, y + h); this._pt(x, y + h); this._cur = null; this.c.rect(x, y, w, h); },
  _arc(x, y, rx, ry, rot, a0, a1, ccw) {
    let d = a1 - a0;
    if (!ccw && d >= CV_TAU) d = CV_TAU; else if (ccw && -d >= CV_TAU) d = -CV_TAU;
    else { d %= CV_TAU; if (!ccw && d < 0) d += CV_TAU; if (ccw && d > 0) d -= CV_TAU; }
    const n = Math.max(2, Math.ceil(Math.abs(d) / CV_ARC_STEP)), cs = Math.cos(rot), sn = Math.sin(rot);
    for (let i = 0; i <= n; i++) { const t = a0 + (d * i) / n, u = Math.cos(t) * rx, v = Math.sin(t) * ry; this._pt(x + u * cs - v * sn, y + u * sn + v * cs); }
  },
  arc(x, y, r, a0, a1, ccw) { this._arc(x, y, r, r, 0, a0, a1, !!ccw); this.c.arc(x, y, r, a0, a1, !!ccw); },
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) { this._arc(x, y, rx, ry, rot, a0, a1, !!ccw); this.c.ellipse(x, y, rx, ry, rot, a0, a1, !!ccw); },
  quadraticCurveTo(qx, qy, x, y) {
    const p = this._cur && this._cur[this._cur.length - 1];
    if (p) for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t; this._pt(u * u * p[0] + 2 * u * t * qx + t * t * x, u * u * p[1] + 2 * u * t * qy + t * t * y); }
    else this._pt(x, y);
    this.c.quadraticCurveTo(qx, qy, x, y);
  },
  bezierCurveTo(ax, ay, bx, by, x, y) {
    const p = this._cur && this._cur[this._cur.length - 1];
    if (p) for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; this._pt(u * u * u * p[0] + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x, u * u * u * p[1] + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y); }
    else this._pt(x, y);
    this.c.bezierCurveTo(ax, ay, bx, by, x, y);
  },
  arcTo() { this._ok = false; this.c.arcTo.apply(this.c, arguments); },
  roundRect() { this._ok = false; this.c.roundRect.apply(this.c, arguments); },
  translate(x, y) { this._moved(); this.c.translate(x, y); },
  rotate(a) { this._moved(); this.c.rotate(a); },
  scale(x, y) { this._moved(); this.c.scale(x, y); },
  transform(a, b, c, d, e, f) { this._moved(); this.c.transform(a, b, c, d, e, f); },
  setTransform() { this._moved(); this.c.setTransform.apply(this.c, arguments); },
  resetTransform() { this._moved(); this.c.resetTransform(); },
  // the drawing
  fill(p) {
    if (!cvIsInk(this._fs)) return;
    const c = this.c, rim = this.cvRim;
    if (!(p instanceof Path2D) && this._ok) { cvRimGrowLive(rim.p.at(c), this._sp, rim.R); return; }
    if (p && p.cvP) { cvRimDraw(c, p.rimS || (p.rimS = { cont: cvRimUnion(p.cvP), g: new Map() }), rim); return; }   // a cvPath shape: its outline
    c.fillStyle = rim.tc; c.strokeStyle = rim.tc; c.lineWidth = 2 * rim.R; c.lineJoin = "round";
    if (p instanceof Path2D) { c.fill(p); c.stroke(p); } else { c.fill(); c.stroke(); }
  },
  stroke(p) {
    if (!cvIsInk(this._ss)) return;
    const c = this.c; c.strokeStyle = this.cvRim.tc; c.lineWidth = this._lw + 2 * this.cvRim.R;
    if (p instanceof Path2D) c.stroke(p); else c.stroke();
  },
  drawImage() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {}, clearRect() {}, putImageData() {},
};
(() => {   // everything else goes straight to the canvas
  const B = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype, R = CV_RimCtx.prototype;
  if (!B) return;
  for (const k of Object.getOwnPropertyNames(B)) {
    if (k === "constructor" || Object.prototype.hasOwnProperty.call(R, k)) continue;
    const d = Object.getOwnPropertyDescriptor(B, k);
    if (typeof d.value === "function") { const fn = d.value; R[k] = function () { return fn.apply(this.c, arguments); }; }
    else if (d.get) Object.defineProperty(R, k, { get() { return this.c[k]; }, set: d.set ? function (v) { this.c[k] = v; } : undefined });
  }
})();
// the rim pass of a figure (cvFigure): its draw(K) through a CV_RimCtx, before the figure
function cvRimPass(c, f, P, tk, at, flash, tc) {
  const z = cvZoomOf(c), ga = c.globalAlpha, rim = { tc, R: (CV_RIM_PX * DPR) / z, L: Math.round(Math.log2(z) * 4), p: new CV_RimPath() };
  const K = new CV_Kit(new CV_RimCtx(c, rim), f, P, tk, at, flash);
  K.rimPass = rim; K.rc = c; K.vec = true;   // (no sprites: the rim is fills)
  c.save();
  if (ga < 1) c.globalAlpha = ga * ga;   // a see-through figure: a fainter rim
  try {
    P.fig.draw(K);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = tc; c.fill(rim.p.p);
  } finally { c.restore(); }
}

/* ---------- the skin's colours ---------- */
// the palette index of the skin a fighter wears (a palette copy from a snapshot is found by its name)
function cvPalIdx(f) { const ps = f.spec.palettes, i = ps.indexOf(f.pal); return i >= 0 ? i : ps.findIndex((p) => p.name === (f.pal && f.pal.name)); }
// the colour set of one skin in one mode ("n" normal, "f" hit flash: all white, "d" helpless: dimmed), cached on the figure
function cvCols(fig, f, mode) {
  const pal = f.pal || {}, i = cvPalIdx(f), key = (i >= 0 ? i : "x" + pal.body + pal.accent) + mode;
  let C = fig.cols.get(key);
  if (C) return C;
  let base = Object.assign({}, fig.pal);
  if (pal.pommes === 1) {
    for (const k in base) base[k] = cvLum(base[k]) > 0.55 ? CV_NOIR_L : CV_NOIR_D;
    Object.assign(base, fig.pm[1]);
  } else if (pal.pommes) Object.assign(base, fig.pm[pal.pommes]);
  else if (pal.road) Object.assign(base, fig.won[pal.road]);
  else if (i >= 0 && i < 4) Object.assign(base, fig.chip[i]);
  else if (i < 0 && /^#[0-9a-f]{6}$/i.test(pal.accent || "")) { for (const k of [].concat(fig.prim)) base[k] = pal.accent; if (/^#[0-9a-f]{6}$/i.test(pal.body || "")) base.skin = pal.body; }
  if (fig.derive) fig.derive(base);   // tones that follow a skin's colour (a shadow steel, a beard's shade)
  if (mode === "f") for (const k in base) base[k] = "#ffffff";
  else if (mode === "d") for (const k in base) base[k] = cvMix(base[k], "#6a6a7a", 0.45);
  C = Object.assign(base, { key: fig.id + ":" + key, flat: mode === "f", res: {} });
  fig.cols.set(key, C);
  return C;
}
// a colour key in this colour set (see COLOUR KEYS above), cached
function cvCol(C, k) {
  let v = C.res[k];
  if (v) return v;
  if (k === "ink") v = CV_INK;
  else if (typeof C[k] === "string" && (k === "rim" || k === "eye" || k.indexOf("/") > 0)) v = C[k];   // a tone a skin sets itself (won.harvest "skin/sh", Starfall's "rim"; flat / dimmed with the rest)
  else if (k === "rim") v = C.flat ? "#ffffff" : CV_RIM;
  else if (k === "eye") v = C.flat ? "#ffffff" : CV_EYE;
  else {
    const i = k.indexOf("/"), base = C[i < 0 ? k : k.slice(0, i)];
    if (base === undefined || typeof base !== "string") v = k;
    else if (i < 0 || C.flat) v = base;
    else { const md = k.slice(i + 1), amt = md.length > 2 ? parseFloat("0" + md.slice(2)) : undefined; v = md.slice(0, 2) === "lt" ? cvLt(base, amt) : cvSh(base, amt); }
  }
  C.res[k] = v;
  return v;
}
const cvShC = (C, k) => cvCol(C, k + "/sh");   // a live part's shadow tone (flat on a hit flash)

/* ---------- the face ---------- */
// F: x, y (the middle between the eyes), s (size), iris, brow (radians, + = the inner end down: fierce), browUp, browW, browCol (a colour
// key, default ink), lid (0..0.6 of the eye covered from the top), lidCol (a key), look ([x, y] of the pupils), one ("near" | "far": only
// that eye; the other is the figure's own business, e.g. Odin's patch), mouth: { k: "line" | "smile" | "smirk" | "grin" | "frown" | "none",
// x, y, s, under (the mouth sits under a moustache: no teeth row) }, blink (default true), extra(S): carved details drawn last (a scar)
// P.expr (ui/manga.js and the manga pages: terror | grin | rage | calm | dazed | ko, P.exK 0..1) and hitstun (> < eyes) take over.
// Each tone of both eyes is one fill.
function cvFace(c, K, F) {
  const P = K.P, f = K.f, C = K.C, s = F.s || 1, ex = P.expr || "", xk = P.exK === undefined ? 1 : P.exK;
  const hurt = !ex && f.state === "hitstun";
  const bl = F.blink !== false && !ex && !hurt && ((K.tk + f.slot * 53) % 211) < 4;   // a blink every 3.5 s
  const E = [], B = [], st = [];
  for (let i = 0; i < 2; i++) {
    if ((F.one === "near" && i === 1) || (F.one === "far" && i === 0)) continue;
    const ex0 = i ? F.x + 5.6 * s : F.x - 5.4 * s, ey = i ? F.y - 0.3 * s : F.y, rx = (i ? 3.9 : 4.5) * s, ry = (i ? 5.3 : 5.6) * s, side = i ? -1 : 1;
    if (hurt) { const d = i ? -1 : 1; st.push([2.2 * s, ex0 - d * rx * 0.75, ey - ry * 0.55, ex0 + d * rx * 0.6, ey, ex0 - d * rx * 0.75, ey + ry * 0.55]); continue; }   // > <
    if (ex === "ko") { const r = rx * 0.8; st.push([2.4 * s, ex0 - r, ey - r, ex0 + r, ey + r], [2.4 * s, ex0 + r, ey - r, ex0 - r, ey + r]); continue; }
    const k = ex === "terror" ? 1 + 0.45 * xk : 1, pk = ex === "terror" ? 1 - 0.6 * xk : 1;
    const erx = rx * k, ery = ry * k * (ex === "rage" || ex === "grin" ? 0.9 : 1);
    if (F.brow !== undefined && !F.noBrow) {   // the brow
      let b = F.brow, up = F.browUp === undefined ? 1.6 : F.browUp;
      if (ex === "terror") { b = -0.35 - 0.15 * xk; up += 2 * xk; } else if (ex === "rage") { b = 0.55; up -= 0.6; } else if (ex === "grin") { b = side > 0 ? 0.25 : -0.2; up += side > 0 ? 0 : 1.2; } else if (ex === "dazed") { b = -0.3; up += 1; }
      b *= side;
      const by = ey - ery - up * s, L = 5.2 * s, cs = Math.cos(b) * L, sn = Math.sin(b) * L;
      B.push([ex0 - cs, by - sn, ex0 + cs, by + sn]);
    }
    if (ex === "calm" || bl) { st.push([2.2 * s, ex0, ey - ry * 0.35, rx * 1.05]); continue; }   // closed: a soft lid line
    const lk = F.look || [1.1, 0.3], lid = ex === "terror" ? 0 : ex === "rage" ? 0.4 : ex === "grin" ? 0.3 : F.lid || 0;
    E.push({ x: ex0, y: ey, rx: erx, ry: ery, ix: ex0 + lk[0] * s * k, iy: ey + lk[1] * s * k, ir: 3.1 * s * k * pk, pr: 1.7 * s * k * pk,
      lid, ly: ey - ery + ery * 2 * lid, lt: Math.tan((ex === "rage" ? 0.5 : F.brow || 0) * side) });
  }
  const lay = (col, add) => { c.beginPath(); for (const e of E) add(e); c.fillStyle = col; c.fill(); };
  if (E.length) {
    lay(CV_INK, (e) => c.ellipse(e.x, e.y, e.rx + 0.85 * s, e.ry + 0.85 * s, 0, 0, CV_TAU)); cvMgInk(c);
    c.beginPath(); for (const e of E) { c.moveTo(e.x + e.rx, e.y); c.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, CV_TAU); } c.fillStyle = C.flat ? "#ffffff" : CV_EYE; c.fill();
    if (ex === "dazed") {   // spiral eyes
      c.strokeStyle = CV_INK; c.lineWidth = 1.4 * s; c.lineCap = "round"; c.beginPath();
      E.forEach((e, i) => { for (let a = 0; a <= Math.PI * 5; a += 0.3) { const r = e.rx * (0.1 + (0.8 * a) / (Math.PI * 5)), x = e.x + Math.cos(a + i * 2) * r, y = e.y + Math.sin(a + i * 2) * r; if (a) c.lineTo(x, y); else c.moveTo(x, y); } });
      c.stroke();
    } else {
      lay(C[F.iris] || C.iris, (e) => cvCircAdd(c, e.ix, e.iy, e.ir));
      lay(CV_INK, (e) => cvCircAdd(c, e.ix, e.iy, e.pr));
      lay("#ffffff", (e) => cvCircAdd(c, e.ix - 1.2 * s, e.iy - 1.5 * s, 1.05 * s));
      if (E.some((e) => e.lid > 0)) {   // the lid, tilted with the brow, its edge inked
        lay(CV_INK, (e) => e.lid > 0 && cvLidAdd(c, e, 0.75 * s));
        lay(C[F.lidCol] || C.skin, (e) => e.lid > 0 && cvLidAdd(c, e, -0.75 * s));
      }
    }
  }
  if (B.length) { const w = ((F.browW || 2.6) * s) / 2; c.beginPath(); for (const b of B) cvCapAdd(c, b[0], b[1], b[2], b[3], w, w); c.fillStyle = F.browCol ? cvCol(C, F.browCol) : CV_INK; c.fill(); }
  if (st.length) {   // hitstun, KO and closed eyes: a few strokes (not every frame)
    c.strokeStyle = CV_INK; c.lineCap = "round"; c.lineJoin = "round";
    for (const q of st) {
      c.lineWidth = q[0]; c.beginPath();
      if (q.length === 4) c.arc(q[1], q[2], q[3], 0.45, Math.PI - 0.45);
      else { c.moveTo(q[1], q[2]); c.lineTo(q[3], q[4]); if (q.length > 5) c.lineTo(q[5], q[6]); }
      c.stroke();
    }
  }
  if (F.extra) { const fig = K.fig; if (!fig.extraOps) { const S = new CV_Carve(); F.extra(S); fig.extraOps = S.done(); } cvOps(c, fig.extraOps, C); }
  cvMouthFor(c, K, F, hurt, ex, xk);
}
// the face at rest (no expression, eyes open, the figure's own mouth), carved once: it goes into the head's sprite (K.stack, "face")
function cvFaceCarve(S, F) {
  const s = F.s || 1, E = [], lk = F.look || [1.1, 0.3];
  for (let i = 0; i < 2; i++) {
    if ((F.one === "near" && i === 1) || (F.one === "far" && i === 0)) continue;
    const x = i ? F.x + 5.6 * s : F.x - 5.4 * s, y = i ? F.y - 0.3 * s : F.y, rx = (i ? 3.9 : 4.5) * s, ry = (i ? 5.3 : 5.6) * s, side = i ? -1 : 1;
    E.push({ x, y, rx, ry, side, ix: x + lk[0] * s, iy: y + lk[1] * s, ly: y - ry + ry * 2 * (F.lid || 0), lt: Math.tan((F.brow || 0) * side) });
  }
  for (const e of E) S.fill(cvCirc(e.x, e.y, e.rx + 0.85 * s, e.ry + 0.85 * s), "ink");
  for (const e of E) S.fill(cvCirc(e.x, e.y, e.rx, e.ry), "eye");
  for (const e of E) S.fill(cvCirc(e.ix, e.iy, 3.1 * s), F.iris || "iris");
  for (const e of E) S.fill(cvCirc(e.ix, e.iy, 1.7 * s), "ink");
  for (const e of E) S.fill(cvCirc(e.ix - 1.2 * s, e.iy - 1.5 * s, 1.05 * s), "#ffffff");
  if (F.lid > 0) {   // the lid over the top of the eye, its edge inked
    const lid = (e, dy) => { const yl = (x) => e.ly + dy + (x - e.x) * e.lt, L = 30; return cvClip(cvCirc(e.x, e.y, e.rx, e.ry), cvPos([[e.x - L, yl(e.x - L)], [e.x + L, yl(e.x + L)], [e.x + L, e.y - 60], [e.x - L, e.y - 60]])); };
    for (const e of E) S.fill(lid(e, 0.75 * s), "ink");
    for (const e of E) S.fill(lid(e, -0.75 * s), F.lidCol || "skin");
  }
  if (F.brow !== undefined && !F.noBrow) {
    const up = F.browUp === undefined ? 1.6 : F.browUp, w = ((F.browW || 2.6) * s) / 2;
    for (const e of E) { const b = F.brow * e.side, by = e.y - e.ry - up * s, L = 5.2 * s, cs = Math.cos(b) * L, sn = Math.sin(b) * L; S.fill(cvCapsule([e.x - cs, by - sn], [e.x + cs, by + sn], w, w), F.browCol || "ink"); }
  }
  if (F.extra) F.extra(S);
  const M = F.mouth || { k: "line" };
  if (M.k !== "none") cvMouth(S, M.x, M.y, M.k, M.s || 1, M.under);
}
// the part of eye e above its lid line (moved down by dy), added to the current path
function cvLidAdd(c, e, dy) {
  const n = 20, yl = (x) => e.ly + dy + (x - e.x) * e.lt;
  let first = true, prev = null;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * CV_TAU, x = e.x + Math.cos(a) * e.rx, y = e.y + Math.sin(a) * e.ry, up = y < yl(x);
    if (prev && up !== prev[2]) {   // the lid line crosses this edge
      const d0 = prev[1] - yl(prev[0]), d1 = y - yl(x), t = d0 / (d0 - d1), px = prev[0] + (x - prev[0]) * t, py = prev[1] + (y - prev[1]) * t;
      if (first) { c.moveTo(px, py); first = false; } else c.lineTo(px, py);
    }
    if (up) { if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); }
    prev = [x, y, up];
  }
  if (!first) c.closePath();
}
// the mouth for the moment: a shout (P.mouth), hitstun, the expression, or the figure's own
function cvMouthFor(c, K, F, hurt, ex, xk) {
  const M = F.mouth || { k: "line" }, P = K.P, s = M.s || 1;
  if (M.k === "none" && !ex && !hurt && P.mouth <= 0.5) return;
  let k = M.k;
  if (ex === "terror" || ex === "ko" || hurt || P.mouth > 0.5) k = "open";
  else if (ex === "rage") k = P.mouth > 0.2 ? "open" : "teeth";
  else if (ex === "grin") k = "smirk"; else if (ex === "calm") k = "smile"; else if (ex === "dazed") k = "wave";
  if (k === "none") return;
  const ss = Math.round(s * (k === "open" && ex === "terror" ? 1 + 0.3 * xk : 1) * 20) / 20, key = k + ss + (M.under ? "u" : "");
  let ops = K.fig.mouths.get(key);
  if (!ops) { const S = new CV_Carve(); cvMouth(S, M.x, M.y, k, ss, M.under); ops = S.done(); K.fig.mouths.set(key, ops); }
  cvOps(c, ops, K.C);
}
// a mouth carved once per kind and size
function cvMouth(S, x, y, kind, s, under) {
  if (kind === "open" || kind === "grin" || kind === "teeth") {
    const P = kind === "teeth" ? cvRect(x - 5 * s, y - 1.5 * s, 10 * s, 3.5 * s)
      : cvSm([[x - 6 * s, y - 1.5 * s, 1], [x, y + (kind === "open" ? 7 : 5.5) * s], [x + 6 * s, y - 2 * s, 1], [x, y - 0.5 * s]]);
    S.cel(P, kind === "open" ? "#7a1f2b" : "eye", { lw: 1.7 * s, sh: 0, in: () => {
      if (kind === "open") { S.fill(cvCirc(x, y + 5 * s, 4 * s, 2.6 * s), "#ff7a6b"); if (!under) S.rect(x - 6 * s, y - 3 * s, 12 * s, 2.6 * s, "eye"); }
      else for (const dx of [-2.6, 0, 2.6]) S.rect(x + (dx - 0.45) * s, y - 1.5 * s, 0.9 * s, 4.5 * s, "ink");
    } });
  } else if (kind === "smile") S.line([[x - 4.5 * s, y - 0.5 * s], [x, y + 3 * s], [x + 4.5 * s, y - 1 * s]], 1.9 * s);
  else if (kind === "smirk") S.line([[x - 4.5 * s, y + 0.8 * s], [x + 1 * s, y + 1.8 * s], [x + 5.5 * s, y - 2.2 * s]], 1.9 * s);
  else if (kind === "frown") S.line([[x - 4 * s, y + 1.5 * s], [x, y - 1 * s], [x + 4 * s, y + 1.2 * s]], 2 * s);
  else if (kind === "wave") S.line([[x - 4.5 * s, y], [x - 2.2 * s, y - 1.4 * s], [x, y + 0.6 * s], [x + 2.2 * s, y - 1.4 * s], [x + 4.5 * s, y]], 1.8 * s);
  else S.line([[x - 3.5 * s, y + 0.4 * s], [x, y - 0.2 * s], [x + 3.5 * s, y + 0.6 * s]], 2 * s);
}

/* ---------- registration, the rig hook, the motion layer ---------- */
function cvFigReg(id, fig) {
  const b = fig.body, pts = cvBlob(b.x, b.y, b.rx, b.ry, b.o);
  fig.id = id; fig.cols = new Map(); fig.mouths = new Map(); fig.boxes = new Map(); fig.ops = null;
  fig.sil = new Float64Array(pts.length * 2); pts.forEach((q, i) => { fig.sil[i * 2] = q[0]; fig.sil[i * 2 + 1] = q[1]; });
  fig.pal = fig.pal || {}; fig.chip = fig.chip || [{}, {}, {}, {}]; fig.won = fig.won || {}; fig.pm = fig.pm || {};
  fig.carve = fig.carve || {};
  const B = fig.leg && fig.leg.boot;
  if (B) {   // the boots: carved standing on their sole at (0, 0), drawn at the foot (K.leg)
    fig.carve.boot = (S) => S.boot(0, 0, B.s, B.col);
    fig.carve.bootB = (S) => S.boot(0, 0, B.s, B.colB || B.col);
  }
  CV_FIG[id] = fig;
}
const cvFigOf = (cos) => (window.__cvOff ? null : CV_FIG[cos] || null);
// called at the end of pose() for a fighter with a figure: tags P and moves the body's numbers onto the new body (in the rig frame)
function cvPose(f, P, fig) {
  const drop = P.hip[1] + P.leg, b = fig.body;
  P.fig = fig; P.cvDrop = drop;
  P.rx = b.rx; P.ry = b.ry; P.cy = b.y + drop; P.top = b.y - b.ry + drop;
  P.head = [fig.face.x, fig.face.y + drop];
  P.mouthPt = [fig.mouthPt[0], fig.mouthPt[1] + drop];
  cvMotion(f, P);
}
// the motion layer: anticipation coil, the stretch of the first active frame, landing and take-off (P.sq, read by the kit only)
function cvMotion(f, P) {
  let q = 0;
  const st = f.state;
  if (st === "attack" && f.move) {
    const m = f.move, a0 = m.startup + 1, n = HEAVY_KEYS[f.mid] === 1 ? 5 : 2;
    if (P.hold) q = 0.08;
    else if (f.mt < a0 && f.mt > m.startup - n) q = (0.08 * (f.mt - (m.startup - n))) / n;
    else if (f.mt === a0) q = -0.12;
    else if (f.mt === a0 + 1) q = -0.05;
  } else if (st === "land") q = 0.1 * Math.max(0, 1 - (f.st || 0) / 5);
  else if (st === "jumpsquat") q = 0.07;
  else if (st === "air" && f.vy < -7) q = -Math.min(0.06, (-f.vy - 7) * 0.012);
  P.sq = q;
}

/* ---------- the kit, one per figure per frame ---------- */
const CV_SPR = new WeakMap();   // fighter -> { name: [value, velocity, tick] }: secondary motion, eased once per tick
const CV_POSES = new WeakMap();   // fighter -> Map(stack -> { n: draws per pose, held: poses with sprites }) (K.stack)
function CV_Kit(c, f, P, tk, at, flash) {
  const fig = P.fig;
  this.c = c; this.f = f; this.P = P; this.tk = tk; this.at = at; this.fig = fig; this.flash = flash;
  this.rimPass = null; this.rc = c;   // the rim pass: { tc, R } and the canvas under its CV_RimCtx (cvRimPass)
  this.C = cvCols(fig, f, flash ? "f" : P.dim ? "d" : "n");
  this.ops = cvOpsOf(fig);
  this.z = cvZoomOf(c); this.baked = false;   // (cvBaked: one new sprite per figure per frame at most)
  this.ls = Math.round(P.lean * 50);   // the lean in steps of 0.02 rad (K.stack)
  this.vec = !!flash || !!P.dim;   // the hit flash and the dimmed helpless figure are drawn as paths (they come and go: no sprites for them)
  const pal = f.pal || {}, F = fig.face;
  this.skinPass = !!(pal.road || pal.pommes || (!flash && !P.dim && glazeOn(f)));   // a won / Pommes skin or Glaze draws between the parts
  // the "skin" token breaks the body's run only for a pass with something live on the potato (Glaze, Devil's Roast's crack pulse, Ink
  // Noir's boiling line: skinfx.js skcBodyLive); the rest of a skin's body paint is baked into the sprites (paintRun)
  this.skinMid = this.skinPass && ((!flash && !P.dim && glazeOn(f)) || skcBodyLive(f));
  this.faceRest = !P.expr && f.state !== "hitstun" && !(F.blink !== false && ((tk + f.slot * 53) % 211) < 4);   // (a shout keeps it: K.stack)
  const sq = P.sq || 0;
  this.sx = 1 + 0.6 * sq; this.sy = 1 - sq;
  this.cs = Math.cos(P.lean); this.sn = Math.sin(P.lean);
  this.hF = P.hF; this.hB = P.hB;
  this.rest = !P.hv && f.state !== "attack" && f.state !== "hitstun" && f.state !== "ledge" && !f.finPose;
}
CV_Kit.prototype = {
  // the squash about the feet, then crouch / bob and lean (the body's own frame is the standing frame)
  _sq(c) { if (this.sx !== 1 || this.sy !== 1) c.scale(this.sx, this.sy); },
  _lean(c) { const h = this.P.hip; if (this.P.lean) { c.translate(h[0], h[1]); c.rotate(this.P.lean); c.translate(-h[0], -h[1]); } },
  body(fn) { const c = this.c; c.save(); this._sq(c); this._lean(c); c.translate(0, this.P.cvDrop); fn(c); c.restore(); },
  pt(x, y) {
    const h = this.P.hip, dx = x - h[0], dy = y + this.P.cvDrop - h[1];
    return [(h[0] + dx * this.cs - dy * this.sn) * this.sx, (h[1] + dx * this.sn + dy * this.cs) * this.sy];
  },
  part(name, fn) {
    const c = this.c;
    c.save(); this._sq(c); this._lean(c); c.translate(0, this.P.cvDrop);
    if (fn) fn(c);
    cvOps(c, this.ops[name], this.C);
    c.restore();
  },
  draw(name) { cvOps(this.c, this.ops[name], this.C); },
  // carved parts back to front as sprites: a run of parts is one sprite. "face" is the face (carved at rest, live otherwise), "skin" and
  // "top" the skin passes (only when the skin has one), a function f(K) a live part between them (it breaks the run)
  stack(list, fn, fk) {
    if (this.rimPass) { this.rimStack(list, fn); return; }
    let run = [], shout = false;
    const P = this.P, c = this.c, fig = this.fig, ls = this.ls;
    // the pose of this stack: its lean step and, with fn, the step fk of its transform. The first ten poses this fighter has been drawn in
    // 20 times (a stance, a run's lean, a cape at rest; not the frames between) are held: they get sprites of their own, drawn upright.
    // Any other pose turns the upright sprite (twice the cost); no lean and no fn, none
    let pose = null;
    if ((ls || fn) && !this.vec && (!fn || fk !== undefined)) {
      const pk = ls + "/" + (fn ? fk : "");
      let all = CV_POSES.get(this.f);
      if (!all) CV_POSES.set(this.f, (all = new Map()));
      let S = all.get(list[0]);
      if (!S) all.set(list[0], (S = { n: new Map(), held: new Set() }));
      if (S.held.has(pk)) pose = { k: pk, ls, fn };
      else if (S.held.size < 10) {
        const n = (S.n.get(pk) || 0) + 1;
        if (S.n.size > 500) S.n.clear();   // (a long match of ever new poses)
        S.n.set(pk, n);
        if (n >= 20) { S.held.add(pk); pose = { k: pk, ls, fn }; if (S.held.size === 10) S.n.clear(); }
      }
    }
    const out = () => {
      if (!run.length) return;
      let sp = null, posed = false;
      if (!this.vec) {
        if (pose) { sp = cvBaked(this, run, pose); posed = !!sp; }
        if (!sp) sp = cvBaked(this, run, null);
      }
      c.save(); this._sq(c);
      if (posed) c.translate(0, P.cvDrop);
      else { if (!sp || ls) this._lean(c); c.translate(0, P.cvDrop); if (fn) fn(c); }
      if (sp) c.drawImage(sp.cv, sp.x0, sp.y0, sp.w, sp.h); else this.paintRun(c, run, false);
      if (shout) {   // a shout: the open mouth over the run that holds the resting face (turned like a held pose's sprite)
        if (posed) { const px = P.hip[0], py = P.hip[1] - P.cvDrop; c.translate(px, py); c.rotate(ls / 50); c.translate(-px, -py); if (fn) fn(c); }
        cvMouthFor(c, this, fig.face, false, null, 0);
      }
      c.restore(); run = []; shout = false;
    };
    for (const it of list) {
      if (!it) continue;
      if (typeof it === "function") { out(); it(this); }
      else if (it === "skin") { if (this.skinMid) { out(); this.skinBody(); } }
      else if (it === "top") { if (this.skinPass) { out(); this.skinTop(); } }
      else if (it === "face" && !this.faceRest) { out(); this.face(); }
      else { run.push(it); if (it === "face" && P.mouth > 0.5) shout = true; }
    }
    out();
  },
  // the rim pass's stack: its live parts drawn (through the CV_RimCtx), its carved parts one grown outline added to the rim path (the face
  // and the skin passes lie inside the figure: left out)
  rimStack(list, fn) {
    const run = [], c = this.rc;
    for (const it of list) {
      if (typeof it === "function") it(this);
      else if (it && it !== "face" && it !== "skin" && it !== "top") run.push(it);
    }
    if (!run.length) return;
    c.save(); this._sq(c); this._lean(c); c.translate(0, this.P.cvDrop); if (fn) fn(c);
    cvRimDraw(c, cvRimOfRun(this.fig, run), this.rimPass);
    c.restore();
  },
  // carved parts as one sprite in the current transform
  sprite(list) {
    if (this.rimPass) { cvRimDraw(this.rc, cvRimOfRun(this.fig, list), this.rimPass); return; }
    const sp = this.vec ? null : cvBaked(this, list);
    if (sp) this.c.drawImage(sp.cv, sp.x0, sp.y0, sp.w, sp.h); else this.paintRun(this.c, list, false);
  },
  // a run of carved parts as fills into c: a sprite being baked (bake) or the canvas. A skin's atop paint (layer 2 of a skin: skinfx.js
  // skcAtop, flat shapes in the standing frame) goes over each stretch of the run's parts that take it (skcAtopParts: the body-level parts),
  // never over the others (a face, lenses, a raven): in a sprite source-atop over what the stretch drew when it is the first thing in the
  // sprite, else (and always on the canvas, where source-atop would paint the backdrop) clipped to the stretch's outline (skcClip). Not on
  // the hit flash, not in the rim pass
  paintRun(c, run, bake) {
    const fig = this.fig, C = this.C, A = C.flat || this.rimPass ? null : skcAtopParts(this);
    for (let i = 0; i < run.length;) {
      if (!A || !A.has(run[i])) { cvOps(c, cvPartOps(fig, run[i]), C); i++; continue; }
      const i0 = i;
      while (i < run.length && A.has(run[i])) cvOps(c, cvPartOps(fig, run[i++]), C);
      c.save();
      if (bake && !i0) c.globalCompositeOperation = "source-atop"; else c.clip(skcClip(fig, run.slice(i0, i)));
      skcAtop(c, this, run[i0]);
      c.restore();
    }
  },
  // a skin's fitting (layer 3: horns, a tail, the dome, the disc; skinfx.js): parts carved once per figure under name by carve(S), in fixed
  // colours, drawn in the current transform as one sprite (per skin and zoom level, K.sprite), as paths where the kit draws paths
  fit(name, carve) {
    const ops = cvOpsOf(this.fig);
    if (!ops[name]) { const S = new CV_Carve(); carve(S); ops[name] = S.done(); }
    this.sprite([name]);
  },
  arm(front, held) {
    const A = this.fig.arm, c = this.c, C = this.C, sh = front ? A.shF : A.shB, h = front ? this.hF : this.hB;
    const a = this.pt(sh[0], sh[1]), col = front ? A.col : A.colB || A.col, H = front ? A.hand : A.handB || A.hand;
    const e = cvJoint(a, h, front ? A.len : A.lenB || A.len, front ? "down" : A.bendB || "down");
    // the hand's outline goes with the arm's (one fill) unless something is held between them; the wrist end hides under the hand
    // the back arm is one tone, its shadow (it reads as further away, and costs a fill less)
    const sc = cvShC(C, col), hs = cvShC(C, H.col), flat = !front;
    const hr = H.r + 1.1 + (this.rimPass ? this.rimPass.R : 0);   // (the rim pass grows the hand's ink with the arm's)
    cvLimb(c, a, e, h, A.r0, A.r1, flat ? sc : C[col], sc, 2.2, held ? null : (cc) => cvCircAdd(cc, h[0], h[1], hr), true, false);
    if (front && A.colU)   // the upper arm in a colour of its own (a scaled sleeve) inside the arm's ink, round over the forearm at the elbow
      cvLimb(c, a, null, e, A.r0, (A.r0 + A.r1) / 2, C[A.colU], cvShC(C, A.colU), 2.2, null, true, true, true);
    const U = front && A.cuff, fl = Math.hypot(h[0] - e[0], h[1] - e[1]);
    if (U && fl > H.r) {   // a cuff on the forearm, its end under the hand (one tone: two fills)
      const ux = (h[0] - e[0]) / fl, uy = (h[1] - e[1]) / fl, d1 = Math.min(fl, H.r * 0.55 + U.len);
      cvLimb(c, [h[0] - ux * d1, h[1] - uy * d1], null, [h[0] - ux * H.r * 0.55, h[1] - uy * H.r * 0.55], U.r0, U.r1, C[U.col], C[U.col], 2.2, null, true, true);
    }
    if (held) held(c, this);
    if (front && this.f.mid === "ulti" && this.f.state === "attack") uvHeldProp(c, this.f, this.P, this.tk);   // an Ultimate's prop in the fist (Gungnir)
    cvMitt(c, h[0], h[1], H.r, flat ? hs : C[H.col], hs, H.thumb, H.k, !!held || !!(U && fl > H.r));
    if (H.more) H.more(c, this, h[0], h[1], front, Math.atan2(h[1] - e[1], h[0] - e[0]));
  },
  leg(front) {
    const G = this.fig.leg, P = this.P, hp = front ? G.hipF : G.hipB, a = this.pt(hp[0], hp[1]);
    let ft = front ? P.fF : P.fB;
    // at rest a stride never stretches the short leg more than 25 % (a kick goes all the way to its target)
    if (this.f.state !== "attack") { const dx = ft[0] - a[0], dy = ft[1] - a[1], d = Math.hypot(dx, dy), m = G.len * 1.25; if (d > m) ft = [a[0] + (dx / d) * m, a[1] + (dy / d) * m]; }
    if (typeof G.draw === "function") return G.draw(this.c, this, a, ft, front);
    const c = this.c, C = this.C, col = front ? G.col : G.colB || G.col, B = G.boot;
    // the shin ends on the boot's ankle; the boot turns with the shin when the foot is off the floor; both ends hide (body, boot)
    const flat = this.f.grounded && ft[1] > -2 && this.f.state !== "attack";
    const k = cvJoint(a, ft, G.len, "fwd"), ang = flat ? 0 : clamp(-Math.atan2(ft[0] - k[0], ft[1] - k[1]) * 0.8, -1.4, 1.4);
    const cs = Math.cos(ang), sn = Math.sin(ang), ax = ft[0] + (B.s * cs + 5 * B.s * sn), ay = ft[1] + (B.s * sn - 5 * B.s * cs);
    const sc = cvShC(C, col);   // the back leg one tone, like the back arm
    cvLimb(c, a, G.bones === 1 ? null : cvJoint(a, [ax, ay], G.len, "fwd"), [ax, ay], G.r0, G.r1, front ? C[col] : sc, sc, 2.2, null, false, false);
    c.save(); c.translate(ft[0], ft[1]); if (ang) c.rotate(ang); this.draw(front ? "boot" : "bootB"); c.restore();   // (paths: a small part that turns)
  },
  face() { if (!this.rimPass) this.body((c) => cvFace(c, this, this.fig.face)); },   // (inside the head: no rim)
  rim() { if (TEAM_RIM && !this.at && !this.rimPass && PERF.q >= 2) { const c = this.c; c.save(); this._sq(c); teamRimBody(c, this.f, this.P); c.restore(); } },   // the team rim is the rim pass (cvRimPass); on a slow phone (PERF.q >= 2) the old body rim
  skinBody() {
    const c = this.c, f = this.f, P = this.P;
    if (this.rimPass || !f.pal || (!f.pal.road && !f.pal.pommes && (this.flash || P.dim || !glazeOn(f)))) return;
    c.save(); this._sq(c); this._lean(c);
    roadSkinBody(c, f, P, this.tk, this.flash, this);
    if (!this.flash && !P.dim && glazeOn(f)) glazeDraw(c, f, P, this.tk);   // ui/glaze.js
    c.restore();
  },
  skinTop() { const f = this.f; if (this.rimPass || !f.pal || (!f.pal.road && !f.pal.pommes)) return; const c = this.c; c.save(); this._sq(c); this._lean(c); roadSkinTop(c, f, this.P, this.tk, this.flash, this); c.restore(); },
  // the skin's fittings and extras behind the whole figure and over it (PR 3: a won skin's tail, Ink Noir's disc, Starfall's orbit, the chip
  // skins' motes and glints): skinfx.js skinBack / skinFront, in the standing frame (squash, crouch, lean: K.body), not in the rim pass, for
  // every skin but the free one (palette 0). They get K (read-only) for K.fig, K.C and K.pt
  skinBack() { if (!this.rimPass && this.f.pal && cvPalIdx(this.f) !== 0) this.body((c) => skinBack(c, this.f, this.P, this.tk, this.flash, this)); },
  skinFront() { if (!this.rimPass && this.f.pal && cvPalIdx(this.f) !== 0) this.body((c) => skinFront(c, this.f, this.P, this.tk, this.flash, this)); },
  spring(name, target, k) {
    let S = CV_SPR.get(this.f);
    if (!S) { S = {}; CV_SPR.set(this.f, S); }
    let v = S[name];
    if (!v) v = S[name] = [target, 0, this.tk];
    const n = this.tk - v[2];
    if (n < 0 || n > 7) { v[0] = target; v[1] = 0; }   // a jump in time (a replay seek, a new page): settle at once
    else for (let i = 0; i < n; i++) { v[1] = v[1] * 0.72 + (target - v[0]) * (k || 0.25); v[0] += v[1]; }
    v[2] = this.tk;
    return v[0];
  },
};
// drawPotato's hand-over: the figure, in the fighter's own frame (feet at 0, facing right), after the sprint lines and before the effects
// (in a 2v2 match the rim pass first: TEAM RIM in the header)
function cvFigure(c, f, P, tk, at, flash) {
  cvMg = Object.prototype.hasOwnProperty.call(c, "fillStyle");   // a manga page's context (see cvMgInk): paths
  try {
    const tc = TEAM_RIM && !at && !cvMg && !cvRimOff && PERF.q < 2 && TEAM_COL[f.team];   // (a phone the watchdog finds slow: K.rim's cheap body rim)
    if (tc) cvRimPass(c, f, P, tk, at, flash, tc);
    const K = new CV_Kit(c, f, P, tk, at, flash);
    if (cvMg) K.vec = true;
    K.skinBack(); P.fig.draw(K); K.skinFront();
    return K;
  } finally { cvMg = false; }
}
// potatoPath for a figure: the body's silhouette in the rig frame (the caller has turned the context with the lean)
function cvSilPath(c, P) {
  const s = P.fig.sil, d = P.cvDrop;
  c.beginPath(); c.moveTo(s[0], s[1] + d);
  for (let i = 2; i < s.length; i += 2) c.lineTo(s[i], s[i + 1] + d);
  c.closePath();
}
// tests/pwcarve.py: the drawing and the camera, from outside the page's scope
window.__cvTest = { draw: (c, f, tk) => drawFighter(c, f, tk), toScreen: (x, y) => toScreen(x, y), get cam() { return cam; }, get dpr() { return DPR; }, get L() { return L; }, get ctx() { return ctx; },
  figs: () => Object.keys(CV_FIG), glaze: (f, on) => glazeMark(f, on), set rim(v) { TEAM_RIM = !!v; }, set rimOff(v) { cvRimOff = !!v; },
  bakes: () => ({ n: CV_BAKE.size, px: cvBakePx, made: cvBakeMade, big: cvBakeBig }) };
