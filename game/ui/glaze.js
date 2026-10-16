/* ===================== Glaze: a pearl sheen over a skin you own, bought in the Shop (UI only, never in the simulation) =====================
   P.glazed = { fighterId: [skin index, ...] }, synced like the skins owned. A fighter object drawn with glaze is marked here (a WeakSet, so
   nothing is added to the simulated fighter and checksums never see it); drawPotato calls glazeDraw over the body of a marked one.
   The look: a soft pink-mint-lilac wash, a pearl band drifting across the body every few seconds, a pearl inner rim and a small glint
   when the fighter lands. Always under 0.35 alpha and never white, blue or gold: those colours are the game's hit, shield and armour
   signals, and the skin's own colours stay readable through it. Reduced motion: the band stands still and there is no glint. */
const GLAZE_PRICE = 400;
const GLAZED = new WeakSet();
const glazeHas = (id, i) => !!(P.glazed && Array.isArray(P.glazed[id]) && P.glazed[id].includes(i));
function glazeMark(f, on) { if (on) GLAZED.add(f); else GLAZED.delete(f); return f; }
const glazeOn = (f) => GLAZED.has(f);
// the skin index a fighter object wears (a palette is shared by reference; a copy from a snapshot is matched by its name)
const glazeIdx = (f) => { const ps = f.spec.palettes, i = ps.indexOf(f.pal); return i >= 0 ? i : ps.findIndex((p) => p.name === (f.pal && f.pal.name)); };
// a match starts (enterMatchUI): your own fighter shines when you glazed the skin he wears; CPUs never do (a friend's comes from his setup, ui/online.js)
function glazeMatch() {
  if (!G) return;
  for (const f of G.fighters) GLAZED.delete(f);
  const me = G.fighters[meSlot];
  if (me && !me.spec.boss) glazeMark(me, glazeHas(me.spec.id, glazeIdx(me)));
}
const GLZ_LAND = new WeakMap();   // fighter -> { g: grounded last frame, t: the frame he landed, k: the frame last drawn }
const GLZ_C = ["rgba(255,170,215,", "rgba(150,236,200,", "rgba(206,172,255,"];   // pink, mint, lilac (+ alpha)
// called by drawPotato in body space (translated to the feet, flipped to the facing, turned with the lean), after the body and its costume
// layers and before the face: the sheen sits on the potato and the eyes stay crisp. P here is the pose.
function glazeDraw(c, f, P, tk) {
  const { rx, ry, cy } = P, calm = resCalm();
  c.save();
  potatoPath(c, P); c.clip();
  // the wash: pink at the top, mint across the middle, lilac at the bottom
  const w = c.createLinearGradient(-rx * 0.6, cy - ry, rx * 0.6, cy + ry);
  w.addColorStop(0, GLZ_C[0] + "0.18)"); w.addColorStop(0.5, GLZ_C[1] + "0.10)"); w.addColorStop(1, GLZ_C[2] + "0.18)");
  c.fillStyle = w; c.fillRect(-rx * 1.5, cy - ry * 1.5, rx * 3, ry * 3);
  // the gloss: a curved pearl highlight on the top of the potato, like the shine on a glazed pot
  c.save(); c.translate(-rx * 0.18, cy - ry * 0.5); c.rotate(-0.42);
  const gl = c.createRadialGradient(0, -ry * 0.08, 0, 0, 0, rx * 0.62);
  gl.addColorStop(0, GLZ_C[0] + "0.34)"); gl.addColorStop(0.45, GLZ_C[1] + "0.28)"); gl.addColorStop(1, GLZ_C[2] + "0)");
  c.fillStyle = gl; c.beginPath(); c.ellipse(0, 0, rx * 0.62, ry * 0.2, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  // the band: a slanted stripe that drifts from the back of the potato to the front, then rests off the body a moment
  const u = calm ? 0.62 : ((tk * 0.006 + 0.62) % 1.45);
  if (u < 1.2) {
    c.save(); c.translate(0, cy); c.rotate(0.62);
    const x = -rx * 1.7 + u * rx * 2.9, hw = rx * 0.5, b = c.createLinearGradient(x - hw, 0, x + hw, 0);
    b.addColorStop(0, GLZ_C[0] + "0)"); b.addColorStop(0.3, GLZ_C[0] + "0.30)"); b.addColorStop(0.5, GLZ_C[1] + "0.34)"); b.addColorStop(0.7, GLZ_C[2] + "0.30)"); b.addColorStop(1, GLZ_C[2] + "0)");
    c.fillStyle = b; c.fillRect(x - hw, -ry * 2.2, hw * 2, ry * 4.4);
    c.restore();
  }
  // the pearl rim just inside the ink line, its colours running round the body
  const r = c.createLinearGradient(-rx, cy - ry, rx, cy + ry);
  r.addColorStop(0, GLZ_C[1] + "0.34)"); r.addColorStop(0.5, GLZ_C[0] + "0.34)"); r.addColorStop(1, GLZ_C[2] + "0.34)");
  c.lineWidth = 8; c.strokeStyle = r; potatoPath(c, P); c.stroke();
  c.restore();
  potatoPath(c, P); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();   // the ink line again over the rim's inner edge
  // the glint: a small pearl star on the shoulder of the potato for a quarter of a second after landing
  let s = GLZ_LAND.get(f);
  if (!s) { s = { g: !!f.grounded, t: -99, k: tk }; GLZ_LAND.set(f, s); }
  if (tk !== s.k) { if (f.grounded && !s.g) s.t = tk; s.g = !!f.grounded; s.k = tk; }
  const age = tk - s.t;
  if (!calm && age >= 0 && age < 16) {
    const q = age < 4 ? age / 4 : 1 - (age - 4) / 12, L = 3 + 6 * q, x = -rx * 0.42, y = cy - ry * 0.52;
    c.save(); c.globalAlpha *= 0.85 * q; c.fillStyle = "#ffc9e8"; c.beginPath();
    c.moveTo(x, y - L); c.quadraticCurveTo(x, y, x + L * 0.7, y); c.quadraticCurveTo(x, y, x, y + L); c.quadraticCurveTo(x, y, x - L * 0.7, y); c.quadraticCurveTo(x, y, x, y - L);
    c.fill(); c.restore();
  }
}
