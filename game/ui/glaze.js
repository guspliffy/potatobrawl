/* ===================== Glaze: a pearl sheen over a skin you own, bought in the Shop (UI only, never in the simulation) =====================
   P.glazed = { fighterId: [skin index, ...] }, synced like the skins owned. A fighter object drawn with glaze is marked here (a WeakSet, so
   nothing is added to the simulated fighter and checksums never see it); drawFighter draws the sheen over a marked one. */
const GLAZE_PRICE = 400;
const GLAZED = new WeakSet();
const glazeHas = (id, i) => !!(P.glazed && Array.isArray(P.glazed[id]) && P.glazed[id].includes(i));
function glazeMark(f, on) { if (on) GLAZED.add(f); else GLAZED.delete(f); return f; }
const glazeOn = (f) => GLAZED.has(f);
// drawFighter calls this after the figure (the sheen itself comes with the Glaze drawing)
function glazeDraw(c, f, tk) {}
