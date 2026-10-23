// The Road gets harder stop by stop (check.sh step 4c). Two player bots, a regular one (0.7) and a skilled one (0.9), play every stop
// with each of the eight fighters under the stop's rules from game/ui/road.js (hearts each side, start percents, the percent every life
// starts at, the time, the map, the CPU's strength); the curve is the mean of their win rates. Prints "roadcurve ok" when:
//   the CPU's strength never drops from one stop to the next, from 0.3 or less to 1.00 at the last stop;
//   the first stop is won 85%+ and the last one 20% or less (the skilled bot 30% or less);
//   no stop is more than 10 points easier than the stop before it, and each region is 15+ points harder than the one before;
//   on the Road each boss has more HP and a weaker partner than the one before, and more HP than in Practice.
//   node roadcurve.js [fights per fighter per bot, default 10]
const fs = require("fs"), path = require("path");
const N = +(process.argv[2] || 10), PS = [0.7, 0.9];
const BL = require("../game/core.js").BL, F = BL.FIGHTERS, FIG = Object.fromEntries(F.map((f) => [f.id, f]));
const src = fs.readFileSync(path.join(__dirname, "../game/ui/road.js"), "utf8");
const a = src.indexOf("const ROAD = ["), b = src.indexOf("ROAD.push(...ROAD_KITCHEN, ...ROAD_DEEP);");
const ROAD = new Function("const _t = (s) => s, _tk = (s) => s, _tv = (s) => s;\n" + src.slice(a, b) + "\nreturn ROAD.concat(ROAD_KITCHEN, ROAD_DEEP);")();
const REG = new Function("const _t = (s) => s, _tk = (s) => s, _tv = (s) => s;\n" + src.slice(src.indexOf("const ROAD_REG = ["), src.indexOf("];", src.indexOf("const ROAD_REG = [")) + 2) + "\nreturn ROAD_REG;")();
const SOLO = +(fs.readFileSync(path.join(__dirname, "../game/ui/boss.js"), "utf8").match(/const BOSS_SOLO = ([0-9.]+)/) || [])[1];
// one stop, as roadFight (ui/road.js) sets it up
function play(st, me, P, seed) {
  const op = FIG[st.f], la = st.lives || 3, lb = st.cpuLives || st.lives || 3, map = Math.max(0, BL.MAPS.findIndex((m) => m.id === st.map));
  const g = BL.newGame({ players: [{ spec: me, pal: me.palettes[0], stocks: la, pct: st.myPct || 0, lifePct: st.myLifePct || 0 },
    { spec: op, pal: op.palettes[op.id === me.id ? 1 : 0], stocks: lb, pct: st.cpuPct || 0 }], seed, stocks: la, time: st.secs || 180, countdown: 30, map });
  const b0 = BL.makeBot(P, BL.BOT_STYLES[me.id]), b1 = BL.makeBot(st.d, BL.BOT_STYLES[op.id]);
  while (g.phase !== "over" && g.t < 60 * 60 * 8) {
    BL.step(g, [BL.botInput(g, g.fighters[0], g.fighters[1], b0), BL.botInput(g, g.fighters[1], g.fighters[0], b1)]);
    g.events.length = 0;
  }
  return g.winner === 0;
}
const bad = [], rows = [];
ROAD.forEach((st, i) => {
  const w = PS.map((P) => { let n = 0, won = 0; for (const me of F) for (let s = 1; s <= N; s++) { won += play(st, me, P, i * 1000 + s * 37 + F.indexOf(me)); n++; } return (100 * won) / n; });
  rows.push({ st, w, m: (w[0] + w[1]) / 2 });
  console.log(`${String(i + 1).padStart(2)} ${st.cpu.padEnd(19)} CPU ${st.d.toFixed(2)}  regular ${w[0].toFixed(0).padStart(3)}%  skilled ${w[1].toFixed(0).padStart(3)}%  curve ${((w[0] + w[1]) / 2).toFixed(1).padStart(5)}`);
});
ROAD.forEach((st, i) => { if (i && st.d < ROAD[i - 1].d) bad.push(`stop ${i + 1}: CPU ${st.d} is weaker than stop ${i}'s ${ROAD[i - 1].d}`); });
if (ROAD[0].d > 0.3 || ROAD[ROAD.length - 1].d !== 1) bad.push(`CPU strength runs ${ROAD[0].d} to ${ROAD[ROAD.length - 1].d}, want 0.3 or less to 1`);
const last = rows[rows.length - 1];
if (rows[0].m < 85) bad.push(`the first stop is won ${rows[0].m.toFixed(1)}%, want 85%+`);
if (last.m > 20 || last.w[1] > 30) bad.push(`the last stop is won ${last.m.toFixed(1)}% (skilled ${last.w[1].toFixed(0)}%), want 20% or less (30%)`);
rows.forEach((r, i) => { if (i && r.m > rows[i - 1].m + 10) bad.push(`stop ${i + 1} (${r.st.cpu}) is ${(r.m - rows[i - 1].m).toFixed(1)} points easier than stop ${i}`); });
const avg = REG.map((_, k) => rows.slice(k * 8, k * 8 + 8).reduce((s, r) => s + r.m, 0) / 8);
avg.forEach((v, k) => { if (k && v > avg[k - 1] - 15) bad.push(`${REG[k].name} (${v.toFixed(1)}) is not 15 points harder than ${REG[k - 1].name} (${avg[k - 1].toFixed(1)})`); });
REG.forEach((g, k) => {
  if (!(g.hp > SOLO)) bad.push(`${g.boss} on the Road has HP x${g.hp}, not more than Practice's x${SOLO}`);
  if (k && !(g.hp > REG[k - 1].hp && g.mate < REG[k - 1].mate)) bad.push(`${g.boss} on the Road is not tougher than ${REG[k - 1].boss} (HP x${g.hp}, partner ${g.mate})`);
});
console.log(`regions: ${REG.map((g, k) => `${g.name} ${avg[k].toFixed(1)}`).join(", ")}; bosses: ${REG.map((g) => `${g.boss} HP x${g.hp} partner ${g.mate}`).join(", ")}`);
for (const m of bad) console.log("BAD " + m);
console.log(bad.length ? `roadcurve: ${bad.length} problems` : `roadcurve ok (first stop ${rows[0].m.toFixed(0)}%, last ${last.m.toFixed(0)}%, regions ${avg.map((v) => v.toFixed(0)).join(" / ")})`);
