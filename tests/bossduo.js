// A Road boss with a friend online is tougher for two (check.sh step 4d). For each boss and level: a player bot and the Road's CPU partner
// against him with his Road HP (ui/road.js ROAD_REG hp, partner mate + 0.1 a level), then two player bots against him with that HP times
// DUO_HP[boss][level] (ui/online.js), the same fighters and seeds. Both a regular (0.7) and a skilled (0.9) player bot, as in roadcurve.js;
// the rate is the mean of the two. Prints the K used and both win rates per boss and level, and "bossduo ok" when:
//   every K is 1 or more (with a friend he never has less HP than on the Road);
//   the two win rates are within TOL points of each other in every boss and level (tuned to within 4 over 384 fights per side, on these
//   seeds and another set; 192 a side here, so TOL 8 leaves room for the noise).
//   node bossduo.js [fights per player bot strength per boss and level, default 96]
//   DUO='{"kraken":[1.5,1.5,1.5]}' node bossduo.js    try other numbers (merged over the game's); ONLY=zorp: one boss
const fs = require("fs"), path = require("path");
const N = +(process.argv[2] || 96), PS = [0.7, 0.9], TOL = 8;
const BL = require("../game/core.js").BL, F = BL.FIGHTERS;
const road = fs.readFileSync(path.join(__dirname, "../game/ui/road.js"), "utf8"), online = fs.readFileSync(path.join(__dirname, "../game/ui/online.js"), "utf8");
const REG = new Function(road.slice(road.indexOf("const ROAD_REG = ["), road.indexOf("];", road.indexOf("const ROAD_REG = [")) + 2) + "\nreturn ROAD_REG;")();
const m = /const DUO_HP = (\{[^\n]*\});/.exec(online);
const DUO = Object.assign(new Function(`return ${m[1]};`)(), process.env.DUO ? JSON.parse(process.env.DUO) : {});
function fight(boss, lv, a, b, da, db, hpMul, seed) {
  const map = Math.max(0, BL.MAPS.findIndex((x) => x.id === boss.map));
  const g = BL.newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }, { spec: boss, pal: boss.palettes[0] }], seed, stocks: 3, time: 0, countdown: 30, map, level: lv, hpMul });
  const b0 = BL.makeBot(da, BL.BOT_STYLES[a.id]), b1 = BL.makeBot(db, BL.BOT_STYLES[b.id]);
  while (g.phase !== "over" && g.t < 60 * 60 * 6) {
    BL.step(g, [BL.botInput(g, g.fighters[0], g.fighters[2], b0), BL.botInput(g, g.fighters[1], g.fighters[2], b1)]);
    g.events.length = 0;
  }
  return { win: g.winner === 0, t: g.t };
}
// the win rate (%) and fight length (s): duo = two player bots and his HP x K, else a player bot and the Road's partner
function rate(k, lv, duo) {
  const rg = REG[k], boss = BL.BOSSES.find((b) => b.id === rg.boss), K = duo ? DUO[rg.boss][lv] : 1;
  let w = 0, t = 0, n = 0;
  for (const P of PS) for (let i = 0; i < N; i++) {
    const a = F[i % F.length], b = F[(i * 5 + 3) % F.length];
    const r = fight(boss, lv, a, b, P, duo ? P : rg.mate + 0.1 * lv, rg.hp * K, 1 + i * 31 + lv * 7 + k * 211);
    w += r.win; t += r.t; n++;
  }
  return { w: (100 * w) / n, s: t / n / 60 };
}
const bad = [], gaps = [];
REG.forEach((rg, k) => {
  if (process.env.ONLY && rg.boss !== process.env.ONLY) return;
  for (let lv = 0; lv < 3; lv++) {
    const K = DUO[rg.boss][lv], solo = rate(k, lv, false), duo = rate(k, lv, true), gap = duo.w - solo.w;
    gaps.push(Math.abs(gap));
    console.log(`${rg.boss.padEnd(8)} ${["Normal", "Hard", "Nightmare"][lv].padEnd(9)} HP x${rg.hp} x K ${K.toFixed(3)}   you + CPU partner ${solo.w.toFixed(1).padStart(5)}% (${solo.s.toFixed(0)} s)   two players ${duo.w.toFixed(1).padStart(5)}% (${duo.s.toFixed(0)} s)   gap ${(gap >= 0 ? "+" : "") + gap.toFixed(1)}`);
    if (!(K >= 1)) bad.push(`${rg.boss} ${lv}: K ${K} is below 1 (less HP than on the Road)`);
    if (Math.abs(gap) > TOL) bad.push(`${rg.boss} ${lv}: two players win ${duo.w.toFixed(1)}%, you + the CPU partner ${solo.w.toFixed(1)}% (${gap.toFixed(1)} points apart, want ${TOL} or less)`);
  }
});
for (const b of bad) console.log("BAD " + b);
console.log(bad.length ? `bossduo: ${bad.length} problems` : `bossduo ok (K ${REG.map((g) => `${g.boss} ${DUO[g.boss].join("/")}`).join(", ")}; largest gap ${Math.max(...gaps).toFixed(1)} points)`);
