// Longest chain of light hits a defender cannot escape, by starting percent.
// Attacker: jab when in range, otherwise walk in. Defender: mashes an escape option every frame it can.
const { BL } = require("../game/core.js");
const { FIGHTERS, newGame, step } = BL;
function run(attId, defId, esc, startPct, move) {
  const A = FIGHTERS.find((f) => f.id === attId), D = FIGHTERS.find((f) => f.id === defId);
  const g = newGame({ players: [{ spec: A, pal: A.palettes[0] }, { spec: D, pal: D.palettes[0] }], countdown: 0 });
  const a = g.fighters[0], d = g.fighters[1];
  a.x = -15; d.x = 15; a.facing = 1; d.facing = -1; d.percent = startPct;
  let maxChain = 0, chain = 0, free = true, hits = 0;
  for (let t = 0; t < 600; t++) {
    const ia = {}, id = {};
    const dx = d.x - a.x;
    if (Math.abs(dx) < 50 && Math.abs(d.y - a.y) < 30) { ia.light = t % 2 === 0; if (move === "side") ia.x = Math.sign(dx); if (move === "down") ia.y = 1; }
    else ia.x = Math.sign(dx);
    if (esc === "away") { id.x = Math.sign(d.x - a.x) || 1; id.jump = t % 2 === 1; }
    else id[esc] = t % 2 === 1;
    const before = d.percent;
    step(g, [ia, id]);
    if (d.percent > before) { hits++; chain = free ? 1 : chain + 1; maxChain = Math.max(maxChain, chain); free = false; }
    if (g.hitstop === 0 && BL.canAct(d)) free = true;
    if (d.stocks < 3) break;
  }
  return maxChain;
}
const pcts = [0, 10, 20, 30, 40, 50, 60, 70, 90];
for (const move of ["jab", "side", "down"]) {
  console.log(`\n${move}: longest inescapable chain by defender start % (${pcts.join("/")})`);
  for (const att of FIGHTERS.map((f) => f.id)) {
    const cells = [];
    for (const esc of ["jump", "dodge", "away"]) cells.push(esc + " " + pcts.map((p) => run(att, "odin", esc, p, move)).join(","));
    console.log(att.padEnd(10), "vs odin |", cells.join(" | "));
  }
}
console.log("\nphoenix jab vs each defender, dodge-mash:");
for (const def of FIGHTERS.map((f) => f.id)) console.log(def.padEnd(10), pcts.map((p) => run("phoenix", def, "dodge", p, "jab")).join(","));
