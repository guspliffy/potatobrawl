// Frames between the defender leaving hitstun and the next light hit, defender holding still.
// <= 0: true combo (no window). 1-2: window shorter than any escape (jump needs 3, dodge is intangible from frame 3).
const { BL } = require("../game/core.js");
const { FIGHTERS, newGame, step } = BL;
function gaps(attId, defId, startPct) {
  const A = FIGHTERS.find((f) => f.id === attId), D = FIGHTERS.find((f) => f.id === defId);
  const g = newGame({ players: [{ spec: A, pal: A.palettes[0] }, { spec: D, pal: D.palettes[0] }], countdown: 0 });
  const a = g.fighters[0], d = g.fighters[1];
  a.x = -15; d.x = 15; a.facing = 1; d.facing = -1; d.percent = startPct;
  const out = []; let free = null, live = 0;
  for (let t = 0; t < 400 && out.length < 8; t++) {
    const ia = {};
    const dx = d.x - a.x;
    if (Math.abs(dx) < 52) ia.light = t % 2 === 0; else ia.x = Math.sign(dx);
    const before = d.percent, hs = g.hitstop;
    step(g, [ia, {}]);
    if (!hs) live++;
    if (d.percent > before) { if (free !== null) out.push(live - free); free = null; }
    if (free === null && d.state !== "hitstun" && g.hitstop === 0 && d.percent > startPct) free = live;
  }
  return out;
}
for (const att of FIGHTERS.map((f) => f.id)) {
  const m = FIGHTERS.find((f) => f.id === att).moves.jab;
  console.log(`${att.padEnd(9)} jab ${m.startup}/${m.active}/${m.endlag}:`, [0, 20, 40, 60, 80].map((p) => `${p}%[${gaps(att, "odin", p).slice(0, 5).join(" ")}]`).join("  "));
}
