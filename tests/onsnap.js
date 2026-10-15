// The repair copy of an online boss fight (ui/online.js onDesync / syncPiece): for every boss, the largest copy seen in bot fights is
// cut into the pieces the host sends (SYNC_PART characters, read from ui/online.js), each piece must fit a whole match presence under the
// 4 KB a presence may hold (the other fields at their largest), and the pieces joined and restored into a fresh game must play on frame
// for frame like the original. Prints "onsnap ok" when all of that holds (check.sh step 5c).
//   node onsnap.js [fights per boss]
const fs = require("fs");
const BL = require("../game/core.js").BL;
const src = fs.readFileSync(__dirname + "/../game/ui/online.js", "utf8");
const PART = +(/const SYNC_PART = (\d+);/.exec(src) || [])[1];
const N = +process.argv[2] || 10, F = BL.FIGHTERS, LIMIT = 4096;
let bad = 0;
const fail = (m) => { bad++; console.log("FAIL", m); };
if (!PART) fail("SYNC_PART not found in ui/online.js");
const mapOf = (b) => Math.max(0, BL.MAPS.findIndex((m) => m.id === b.map));
const game = (boss, s) => {
  const a = F[s % F.length], b = F[(s * 3 + 1) % F.length];
  return BL.newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }, { spec: boss, pal: boss.palettes[0] }], stocks: 3, time: 0, countdown: 30, seed: s * 7919 + 13, map: mapOf(boss), level: s % 3 });
};
const ins = (g, bots) => [BL.botInput(g, g.fighters[0], g.fighters[2], bots[0]), BL.botInput(g, g.fighters[1], g.fighters[2], bots[1])];
// a guest's match presence with every other field at its largest (72 frames of input, the start message, a peer id, the ping stamps)
const other = { role: "guest", f: "alchemist", pi: 3, m: 99999, s: 999999, i: "Az".repeat(72), fr: 999999, ck: [999999, 4294967295], pg: 999999999, po: 999999999,
  sa: [99999, 15], rm: 100000, nf: "alchemist", np: 3, em: 99999, opp: "0123456789abcdef0123456789abcdef0123",
  start: { id: 99999, seed: 999999999, d: 15, f: ["alchemist", "gunslinger"], p: [3, 3], rtt: 9999, r: { l: 3, t: 0, b: 1 }, set: { n: 1, w: [0, 0] }, bo: { b: "kraken", lv: 2 } } };
for (const boss of BL.BOSSES) {
  let big = null, bigN = 0, bigAt = null;
  for (let s = 1; s <= N; s++) {
    const g = game(boss, s), bots = [BL.makeBot(0.6), BL.makeBot(0.6)];
    while (g.phase !== "over" && g.t < 60 * 240) {
      BL.step(g, ins(g, bots)); g.events.length = 0;
      if (g.t % 5 === 0) { const txt = JSON.stringify(BL.serialize(g)); if (txt.length > bigN) { bigN = txt.length; big = txt; bigAt = { s, t: g.t }; } }
    }
  }
  // the pieces, each inside a whole presence
  const parts = [];
  for (let i = 0; i < big.length; i += PART) parts.push(big.slice(i, i + PART));
  let worst = 0;
  parts.forEach((d, k) => { const n = JSON.stringify(Object.assign({}, other, { sync: { n: 99999, f: 999999, k, of: parts.length, d } })).length; worst = Math.max(worst, n); });
  if (worst > LIMIT) fail(`${boss.id}: a piece makes the presence ${worst} characters (limit ${LIMIT})`);
  // joined and restored into a fresh game at the same moment: plays on frame for frame
  const g1 = game(boss, bigAt.s), g2 = game(boss, bigAt.s), b1 = [BL.makeBot(0.6), BL.makeBot(0.6)];
  while (g1.t < bigAt.t) { BL.step(g1, ins(g1, b1)); g1.events.length = 0; }
  BL.restore(g2, JSON.parse(parts.join("")));
  if (BL.checksum(g1) !== BL.checksum(g2)) fail(`${boss.id}: the restored copy has another checksum`);
  let diverged = -1;
  for (let t = 0; t < 900 && g1.phase !== "over"; t++) {
    const i1 = ins(g1, b1); BL.step(g1, i1); BL.step(g2, i1); g1.events.length = 0; g2.events.length = 0;
    if (BL.checksum(g1) !== BL.checksum(g2)) { diverged = t; break; }
  }
  if (diverged >= 0) fail(`${boss.id}: the restored game drifted ${diverged} frames after the copy`);
  console.log(`${boss.id}: largest copy ${bigN} characters, ${parts.length} pieces of ${PART}, largest presence ${worst}, restored game plays on: ${diverged < 0 ? "yes" : "no"}`);
}
console.log(bad ? `onsnap FAILED (${bad})` : "onsnap ok");
