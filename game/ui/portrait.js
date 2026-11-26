/* ===================== Rig portraits (Carved Ink PR 3; UI only) =====================
   PORTRAITS[id] (ui/view.js) is a fighter's portrait as an image URL, for every place that shows one: the menu hero, the select tiles and
   stage, avatars, results, lobby seats, Boss Week, cups, the Daily, the Harvest picker, the Pommes Shop, the manga 2v2 sticker (mgPic).
   Each is drawn from the match rig (the Carved Ink figure, palette 0) the first time it is read, into a PT_W x PT_H canvas, and kept as a
   PNG behind a short blob: URL (the pages put it into innerHTML). Once the page has started the rest are drawn in idle time, one per slot,
   so the select screen's eight tiles never draw at once. A boss has none: PORTRAITS[boss id] stays undefined. Drawn at 1x: at 2x and
   scaled down the picture is the same and costs three times as much. Every top-level name starts pt / PT_.
   Design: redesign/pr3-design.md section 6. tests/pwportrait.py: the contact sheet and the timing (window.__ptTest).

   FRAMING. The point between the eyes (the figure's face x, y, where the pose puts it) goes to canvas (316, eye), s canvas px per world
   unit, the figure turned by tilt degrees about that point (+ tips him forward: he looks right). The centre circle r 140 at (320, 150) is
   all the round avatars show. The kit's own expressions would hide what must show (its grin is a smirk, its calm shuts the eyes, its rage
   bares a row of teeth over the Dragon's fang): ex is set only where nothing is lost (the Samurai's rage); the others wear their resting
   face (the beak-smile, the toothy grin, Odin's eye, the soul slits, the smirk). hF / hB move the hands from the rest pose (the Dragon's fist
   off his jaw, the Gunslinger's hands down), hold / gunB his pistols' angles (pointing down, out of the way), vx a run's speed (the
   Samurai's headband tails stream back). The figure is drawn by its kit as paths (K.vec), never as sprites: a one-off big draw would
   only fill the sprite cache.
   BACKDROP, back to front: the field, the shadow band, the sun disc, halftone (disc dots in the lower-left corner, field dots on the disc's
   lower-right third), three speed lines, the figure's hard shadow (+12, +10, on the disc only), the figure. */
const PT_W = 640, PT_H = 308, PT_TK = 90;   // the size; the tick the idle pose is taken at (eyes open, the crystal face on)
const PT_SPEC = {
  phoenix: { s: 5.4, eye: 111, tilt: 6, wingUp: 0.5, field: "#b8361a", shade: "#7a1c1c", disc: "#ffd27a" },
  alchemist: { s: 5.0, eye: 117, tilt: -3, field: "#3a2270", shade: "#24144a", disc: "#8dff3a" },
  odin: { s: 5.0, eye: 111, tilt: -3, field: "#7a1a22", shade: "#4a1020", disc: "#ecb53a" },
  wizard: { s: 4.8, eye: 142, tilt: -3, field: "#26244f", shade: "#17163a", disc: "#f6c64f" },
  samurai: { s: 5.4, eye: 111, tilt: -2, ex: "rage", xk: 0.5, vx: 6, field: "#14604a", shade: "#0c3f3a", disc: "#f3ead2" },
  dragon: { s: 4.8, eye: 117, tilt: 4, hF: [4, 12], field: "#b8741a", shade: "#7a4414", disc: "#ffe6b3" },
  gunslinger: { s: 4.4, eye: 129, tilt: -3, hF: [2, 8], hB: [0, 8], hold: 1.2, gunB: 2.1, field: "#2f4a80", shade: "#1c2f58", disc: "#f6dfae" },
  reaper: { s: 4.6, eye: 123, tilt: -2, field: "#2a2630", shade: "#17131f", disc: "#8dffd0" },
};
const PT = { url: {}, ms: {}, fg: null, sh: null };   // the image URLs, each one's draw time (ms), two scratch canvases (the figure, its shadow)
const ptCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

// the backdrop
function ptBack(c, D) {
  c.fillStyle = D.field; c.fillRect(0, 0, PT_W, PT_H);
  c.fillStyle = D.shade; c.beginPath(); c.moveTo(430, 0); c.lineTo(640, 0); c.lineTo(640, 308); c.lineTo(330, 308); c.closePath(); c.fill();
  c.fillStyle = D.disc; c.beginPath(); c.arc(306, 150, 132, 0, Math.PI * 2); c.fill();
  // halftone: disc-tone dots in the lower-left corner, r 5 at the corner to 1 at 180 px (a staggered grid, pitch 14)
  c.beginPath();
  for (let y = PT_H, row = 0; y > PT_H - 190; y -= 14 * 0.866, row++) {
    for (let x = (row % 2) * 7; x < 190; x += 14) {
      const d = Math.hypot(x, PT_H - y), r = 5 - (4 * d) / 180;
      if (d <= 180) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
    }
  }
  c.fill();
  // field-tone dots on the disc's lower-right third, r 1 to 4 towards the rim (pitch 12)
  c.save(); c.beginPath(); c.arc(306, 150, 132, 0, Math.PI * 2); c.clip();
  c.fillStyle = D.field; c.beginPath();
  for (let y = 150, row = 0; y < 290; y += 12 * 0.866, row++) {
    for (let x = 306 + (row % 2) * 6; x < 446; x += 12) {
      const p = ((x - 306 + y - 150) * Math.SQRT1_2) / 132;   // along the lower-right diagonal: 0 the centre, 1 the rim
      if (p >= 1 / 3) { const r = 1 + 4.5 * (p - 1 / 3); c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
    }
  }
  c.fill(); c.restore();
  // three speed lines, top left, at -8 degrees
  const a = (-8 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  c.strokeStyle = D.shade; c.lineWidth = 6; c.lineCap = "round"; c.beginPath();
  for (const [x, y, l] of [[18, 40, 150], [44, 62, 110], [26, 84, 90]]) { c.moveTo(x, y); c.lineTo(x + ca * l, y + sa * l); }
  c.stroke();
}
// the figure: the fighter standing at rest, looking right, framed as above
function ptFigure(c, id, D) {
  const spec = FIG[id], pal = spec.palettes[0];
  const f = BL.newGame({ seed: 1, players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
  f.x = 0; f.y = 0; f.facing = 1; f.state = "idle"; f.grounded = true; f.vx = D.vx || 0; f.vy = 0;
  const P = pose(f, PT_TK);
  if (!P.fig) return;
  if (D.ex) { P.expr = D.ex; P.exK = D.xk; }
  if (D.wingUp) P.wingUp = D.wingUp;
  if (D.hF) P.hF = [P.hF[0] + D.hF[0], P.hF[1] + D.hF[1]];
  if (D.hB) P.hB = [P.hB[0] + D.hB[0], P.hB[1] + D.hB[1]];
  if (D.hold !== undefined) P.holdAng = D.hold;
  if (D.gunB !== undefined) P.gunB = D.gunB;
  const F = P.fig.face, e = rot([F.x, F.y + P.cvDrop], P.hip, P.lean);   // between the eyes, in the fighter's frame
  c.save();
  c.translate(316, D.eye); c.rotate((D.tilt * Math.PI) / 180); c.scale(D.s, D.s); c.translate(-e[0], -e[1]);
  c.lineCap = "round"; c.lineJoin = "round";
  const K = new CV_Kit(c, f, P, PT_TK, [0, 0], false);   // (at: a stand-in, never a 2v2 rim)
  K.vec = true;
  K.skinBack(); P.fig.draw(K); K.skinFront();
  c.restore();
}
// one portrait, on a canvas of its own
function ptDraw(id, opt) {
  const D = Object.assign({}, PT_SPEC[id], opt), out = ptCanvas(PT_W, PT_H), c = out.getContext("2d");
  if (!PT.fg) { PT.fg = ptCanvas(PT_W, PT_H); PT.sh = ptCanvas(PT_W, PT_H); }
  const g = PT.fg.getContext("2d"), s = PT.sh.getContext("2d");
  ptBack(c, D);
  g.clearRect(0, 0, PT_W, PT_H); ptFigure(g, id, D);
  // his hard shadow: the figure's silhouette in the shadow tone, offset, on the disc only
  s.globalCompositeOperation = "source-over"; s.clearRect(0, 0, PT_W, PT_H); s.drawImage(PT.fg, 0, 0);
  s.globalCompositeOperation = "source-in"; s.fillStyle = D.shade; s.fillRect(0, 0, PT_W, PT_H);
  c.save(); c.beginPath(); c.arc(306, 150, 132, 0, Math.PI * 2); c.clip(); c.drawImage(PT.sh, 12, 10); c.restore();
  c.drawImage(PT.fg, 0, 0);
  return out;
}
// a canvas as a PNG behind a blob: URL (made at once: a caller needs the URL now)
function ptUrl(cv) {
  const d = cv.toDataURL("image/png"), b = atob(d.slice(d.indexOf(",") + 1)), a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return URL.createObjectURL(new Blob([a], { type: "image/png" }));
}
// the URL of one portrait, drawn now if it is not there yet ("" if the drawing failed)
function ptGet(id) {
  let u = PT.url[id];
  if (u !== undefined) return u;
  const t0 = performance.now();
  try { u = ptUrl(ptDraw(id)); } catch (e) { console.error("portrait " + id, e); u = ""; }
  PT.ms[id] = performance.now() - t0;
  PT.url[id] = u;
  if (!ptNext() && PT.fg) { PT.fg.width = PT.fg.height = PT.sh.width = PT.sh.height = 0; PT.fg = PT.sh = null; }   // all there: the scratch canvases go
  return u;
}
const ptNext = () => Object.keys(PT_SPEC).find((id) => PT.url[id] === undefined);
for (const id in PT_SPEC) Object.defineProperty(PORTRAITS, id, { enumerable: true, get: () => ptGet(id) });
// the warm-up: from shortly after the start, one portrait per idle slot (no requestIdleCallback, as on Safari: a short timeout)
function ptWarm() { const id = ptNext(); if (id) { ptGet(id); ptIdle(); } }
function ptIdle() { if (window.requestIdleCallback) requestIdleCallback(ptWarm, { timeout: 1500 }); else setTimeout(ptWarm, 120); }
setTimeout(ptIdle, 300);
// tests/pwportrait.py: a portrait drawn afresh (opt overrides its PT_SPEC row), the times of the ones the page drew
window.__ptTest = { ids: () => Object.keys(PT_SPEC), get ms() { return Object.assign({}, PT.ms); },
  draw(id, opt) { const t0 = performance.now(), cv = ptDraw(id, opt), t1 = performance.now(), url = cv.toDataURL("image/png"); return { draw: t1 - t0, png: performance.now() - t1, url }; } };
