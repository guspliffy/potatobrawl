// Per-fighter win rate over many bot-vs-bot games (both sides, several difficulty levels).
const { BL } = require(process.env.CORE || "../game/core.js");
const { FIGHTERS, newGame, step, makeBot, botInput } = BL;
const mapOf = (seed) => (process.env.MAP === "all" ? seed % BL.MAPS.length : +(process.env.MAP || 0));   // MAP=<index> or MAP=all (the seed picks)
const N = +(process.argv[2] || 60), LV = (process.argv[3] || "0.7").split(",").map(Number);
function run(a, b, d, seed) {
  const g = newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }], seed, countdown: 10, time: 240, map: mapOf(seed) });
  const ba = makeBot(d), bb = makeBot(d);
  let fr = 0;
  while (g.phase !== "over" && fr < 60 * 330) { step(g, [botInput(g, g.fighters[0], g.fighters[1], ba), botInput(g, g.fighters[1], g.fighters[0], bb)]); g.events.length = 0; fr++; }
  return { w: g.winner, sudden: g.sudden, why: g.endReason };
}
if (process.env.DI === "0") BL.TUNE.diMax = 0;
if (process.env.NOHIT) BL.TUNE.xNoHit = true;
if (process.env.NOHOLD) BL.TUNE.xNoHold = true;
if (process.env.STR === "0") BL.TUNE.strGap = -1000;
if (process.env.TECH === "0") BL.TUNE.techWindow = 0;
// PATCH='{"odin":{"stats.weight":108,"moves.hSide.kbg":20}}' applies trial values to the specs
if (process.env.PATCH) for (const [id, kv] of Object.entries(JSON.parse(process.env.PATCH))) {
  const f = FIGHTERS.find((x) => x.id === id);
  for (const [path, v] of Object.entries(kv)) { const ks = path.split("."); let o = f; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; }
}
const ids = FIGHTERS.map((f) => f.id), W = {}, G = {}, cell = {};
let seed = 1, sudden = 0, draws = 0, games = 0;
for (const id of ids) { W[id] = 0; G[id] = 0; }
for (const d of LV) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const A = FIGHTERS[i], B = FIGHTERS[j];
  for (let k = 0; k < N; k++) {
    const flip = k % 2 === 1, r = flip ? run(B, A, d, seed++) : run(A, B, d, seed++);
    const winId = r.w < 0 ? null : (flip ? [B, A] : [A, B])[r.w].id;
    games++; if (r.sudden) sudden++; if (!winId) draws++;
    G[A.id]++; G[B.id]++; if (winId) W[winId]++;
    const key = A.id + ">" + B.id; cell[key] = (cell[key] || 0) + (winId === A.id ? 1 : winId ? 0 : 0.5);
  }
}
console.log(`levels ${LV.join("/")}, ${N} games per pair: sudden death ${sudden}/${games}, draws ${draws}`);
for (const id of ids) console.log(id.padEnd(10), (100 * W[id] / G[id]).toFixed(1) + "%");
console.log(Object.entries(cell).map(([k, v]) => `${k} ${(100 * v / (N * LV.length)).toFixed(0)}%`).join("  "));
