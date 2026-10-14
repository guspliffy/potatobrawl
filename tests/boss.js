// Boss fights (2v1): two bot players against a boss on The Field, at each difficulty.
//   node boss.js [games per level] [bot level]      win rate, length, staggers, KOs per side, how the boss went down
//   node boss.js det                                 determinism: the same fight twice, and save/restore mid-fight, give the same checksums
// Prints "boss ok" when every check passes (check.sh step 3f).
const BL = require("../game/core.js").BL;
const FIELD = BL.MAPS.findIndex((m) => m.id === "field");
const BOSS = BL.BOSSES[0];
const arg = process.argv[2];
function fight(seed, lv, a, b, d, hpMul, cb) {
  const g = BL.newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }, { spec: BOSS, pal: BOSS.palettes[0] }], seed, stocks: 3, time: 0, countdown: 30, map: FIELD, level: lv, hpMul });
  const bots = [BL.makeBot(d, BL.BOT_STYLES[a.id]), BL.makeBot(d, BL.BOT_STYLES[b.id])];
  const st = { stag: 0, broken: -1, moves: {}, downBy: "", lethal: 0 };
  while (g.phase !== "over" && g.t < 60 * 60 * 8) {
    const boss = g.fighters[2];
    BL.step(g, [BL.botInput(g, g.fighters[0], boss, bots[0]), BL.botInput(g, g.fighters[1], boss, bots[1])]);
    for (const e of g.events) {
      if (e.type === "bossStagger") st.stag++;
      if (e.type === "bossBroken") st.broken = g.t;
      if (e.type === "bossMove") st.moves[e.mv] = (st.moves[e.mv] || 0) + 1;
      if (e.type === "lethal" && e.boss) st.downBy = e.mv;
      if (e.type === "lethal" && !e.boss) st.lethal++;
    }
    g.events.length = 0;
    if (cb) cb(g);
  }
  return { g, st };
}
if (arg === "det") {
  let bad = 0, n = 0;
  for (let s = 1; s <= 6; s++) {
    const F = BL.FIGHTERS, a = F[s % F.length], b = F[(s * 3 + 1) % F.length];
    const sums = [];
    fight(s, s % 3, a, b, 0.7, 1, (g) => { if (g.t % 97 === 0) sums.push(BL.checksum(g)); });
    const again = [];
    fight(s, s % 3, a, b, 0.7, 1, (g) => { if (g.t % 97 === 0) again.push(BL.checksum(g)); });
    if (sums.join() !== again.join()) { bad++; console.log("replay differs, seed", s); }
    // save at frame 1500, run on; restore into a fresh game and run on with the same bot inputs: same states
    const P = [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }, { spec: BOSS, pal: BOSS.palettes[0] }];
    const g1 = BL.newGame({ players: P, seed: s, stocks: 3, time: 0, countdown: 30, map: FIELD, level: s % 3 });
    const bots = [BL.makeBot(0.7), BL.makeBot(0.7)];
    const ins = [];
    for (let t = 0; t < 1500; t++) { const i = [BL.botInput(g1, g1.fighters[0], g1.fighters[2], bots[0]), BL.botInput(g1, g1.fighters[1], g1.fighters[2], bots[1])]; BL.step(g1, i); g1.events.length = 0; }
    const snap = JSON.parse(JSON.stringify(BL.serialize(g1)));
    const g2 = BL.newGame({ players: P, seed: 999, stocks: 3, time: 0, countdown: 0, map: FIELD, level: s % 3 });
    BL.restore(g2, snap);
    for (let t = 0; t < 1500; t++) {
      const i = [BL.botInput(g1, g1.fighters[0], g1.fighters[2], bots[0]), BL.botInput(g1, g1.fighters[1], g1.fighters[2], bots[1])];
      BL.step(g1, i); BL.step(g2, i); g1.events.length = 0; g2.events.length = 0; n++;
      if (BL.checksum(g1) !== BL.checksum(g2)) { bad++; console.log("save/restore differs, seed", s, "frame", t); break; }
    }
  }
  console.log(`determinism: ${bad} mismatches (${n} restored frames)`);
  if (!bad) console.log("boss ok");
  process.exit(0);
}
const N = +arg || 24, D = +(process.argv[3] || 0.6), F = BL.FIGHTERS;
for (let lv = 0; lv < 3; lv++) {
  let wins = 0, len = 0, stag = 0, pk = 0, bk = 0, hp = 0, downs = {}, moves = {};
  for (let i = 0; i < N; i++) {
    const a = F[i % F.length], b = F[(i * 5 + 3) % F.length];
    const { g, st } = fight(1000 + i * 7 + lv, lv, a, b, D, 1);
    if (g.winner === 0) wins++;
    len += g.t; stag += st.stag; hp += g.fighters[2].hp / g.fighters[2].hpMax;
    pk += g.fighters[0].falls + g.fighters[1].falls; bk += g.fighters[2].falls;
    if (st.downBy) downs[st.downBy] = (downs[st.downBy] || 0) + 1;
    for (const k in st.moves) moves[k] = (moves[k] || 0) + st.moves[k];
  }
  console.log(`${["Normal", "Hard", "Nightmare"][lv]}: players win ${(100 * wins / N).toFixed(0)}% of ${N}, ${(len / N / 60).toFixed(0)} s a fight, ${(stag / N).toFixed(1)} staggers, ${(pk / N).toFixed(1)} hearts lost, boss HP left ${(100 * hp / N).toFixed(0)}%`);
  console.log("   down by", JSON.stringify(downs), " moves", JSON.stringify(moves));
}
