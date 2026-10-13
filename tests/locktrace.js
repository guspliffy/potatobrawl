const { BL } = require("../game/core.js");
const { FIGHTERS, newGame, step } = BL;
const [attId, defId, R, pct] = [process.argv[2] || "phoenix", process.argv[3] || "odin", +(process.argv[4] || 8), +(process.argv[5] || 0)];
const A = FIGHTERS.find((f) => f.id === attId), D = FIGHTERS.find((f) => f.id === defId);
const g = newGame({ players: [{ spec: A, pal: A.palettes[0] }, { spec: D, pal: D.palettes[0] }], countdown: 0 });
const a = g.fighters[0], d = g.fighters[1];
a.x = -40; d.x = 10; a.facing = 1; d.facing = -1; d.percent = pct;
let free = 0, acted = false, first = -1, line = [], prevSt = "";
for (let t = 0; t < 420; t++) {
  const ia = {}, id = {};
  const dx = d.x - a.x, away = Math.sign(dx) || 1;
  if (Math.abs(dx) < 52 && Math.abs(d.y - a.y) < 40) ia.light = t % 2 === 0; else ia.x = away;
  if (first >= 0) {
    if (BL.canAct(d) && g.hitstop === 0) free++; else if (d.state === "hitstun") { free = 0; acted = false; }
    if (free >= 1) id.x = away;
    if (free >= R && !acted) { acted = true; id.jump = true; id.x = away; }
  }
  const before = d.percent;
  step(g, [ia, id]);
  let tag = "";
  for (const e of g.events) if (e.type === "hit" && e.slot === 0) tag = `HIT(${a.mid}${e.finisher ? ",LAUNCH" : ""} strN=${d.strN})`;
  g.events.length = 0;
  if (d.percent > before && first < 0) first = t;
  const st = `${d.state}`;
  if (tag || st !== prevSt) line.push(`t${t} d:${st}${tag ? " " + tag : ""} x${Math.round(d.x)} y${Math.round(d.y)} dist${Math.round(Math.abs(d.x - a.x))} freeT${d.freeT}`);
  prevSt = st;
}
console.log(line.slice(0, 70).join("\n"));
