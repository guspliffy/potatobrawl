// Boss fights (2v1): two bot players against a boss on The Field, at each difficulty.
//   node boss.js                       the check (check.sh step 3f): determinism + save/restore, then 24 fights per level with bots at 0.6;
//                                      prints "boss ok" when the win rates and fight lengths sit in their bands, every move is used, the
//                                      launch that ends him always leaves the arena, and the "lethal" calls on players come true
//   node boss.js <games> [bot level]   the numbers only (win rate, length, staggers, hearts lost, moves, what ended him)
//   BOSS='{"hp":1100}' node boss.js 48 0.6    try other numbers for the boss block
const BL = require("../game/core.js").BL;
const FIELD = BL.MAPS.findIndex((m) => m.id === "field");
const BOSS = BL.BOSSES[0];
if (process.env.BOSS) Object.assign(BOSS.boss, JSON.parse(process.env.BOSS));
const F = BL.FIGHTERS, LV = ["Normal", "Hard", "Nightmare"];
const players = (a, b) => [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }, { spec: BOSS, pal: BOSS.palettes[0] }];
const botIns = (g, bots) => [BL.botInput(g, g.fighters[0], g.fighters[2], bots[0]), BL.botInput(g, g.fighters[1], g.fighters[2], bots[1])];
function fight(seed, lv, a, b, d, cb) {
  const g = BL.newGame({ players: players(a, b), seed, stocks: 3, time: 0, countdown: 30, map: FIELD, level: lv });
  const bots = [BL.makeBot(d, BL.BOT_STYLES[a.id]), BL.makeBot(d, BL.BOT_STYLES[b.id])];
  const st = { stag: 0, moves: {}, downBy: "", downT: -1, goneT: -1, calls: [], wrong: 0, right: 0 };
  while (g.phase !== "over" && g.t < 60 * 60 * 6) {
    BL.step(g, botIns(g, bots));
    for (const e of g.events) {
      if (e.type === "bossStagger") st.stag++;
      if (e.type === "bossMove") st.moves[e.mv] = (st.moves[e.mv] || 0) + 1;
      if (e.type === "lethal" && e.boss) { st.downBy = e.mv; st.downT = g.t; }
      if (e.type === "lethal" && !e.boss) st.calls.push({ slot: e.slot, t: g.t });
      if (e.type === "ko" && e.slot === 2) st.goneT = g.t;
      // a KO makes every call still open on that player come true (a launched player hit again is called again)
      if (e.type === "ko" && e.slot < 2) { const n = st.calls.length; st.calls = st.calls.filter((c) => c.slot !== e.slot); st.right += n - st.calls.length; }
    }
    g.events.length = 0;
    st.calls = st.calls.filter((c) => (g.t - c.t > BL.TUNE.lookFrames + 30 ? (st.wrong++, false) : true));
    if (cb) cb(g);
  }
  return { g, st };
}
function det() {
  let bad = 0, n = 0;
  for (let s = 1; s <= 6; s++) {
    const a = F[s % F.length], b = F[(s * 3 + 1) % F.length], sums = [], again = [];
    fight(s, s % 3, a, b, 0.7, (g) => { if (g.t % 97 === 0) sums.push(BL.checksum(g)); });
    fight(s, s % 3, a, b, 0.7, (g) => { if (g.t % 97 === 0) again.push(BL.checksum(g)); });
    if (sums.join() !== again.join()) { bad++; console.log("replay differs, seed", s); }
    // save at frame 1500 and restore into a fresh game: the next 1500 frames with the same inputs match the original
    const g1 = BL.newGame({ players: players(a, b), seed: s, stocks: 3, time: 0, countdown: 30, map: FIELD, level: s % 3 });
    const bots = [BL.makeBot(0.7), BL.makeBot(0.7)];
    for (let t = 0; t < 1500; t++) { BL.step(g1, botIns(g1, bots)); g1.events.length = 0; }
    const g2 = BL.newGame({ players: players(a, b), seed: 999, stocks: 3, time: 0, countdown: 0, map: FIELD, level: s % 3 });
    BL.restore(g2, JSON.parse(JSON.stringify(BL.serialize(g1))));
    for (let t = 0; t < 1500; t++) {
      const i = botIns(g1, bots);
      BL.step(g1, i); BL.step(g2, i); g1.events.length = 0; g2.events.length = 0; n++;
      if (BL.checksum(g1) !== BL.checksum(g2)) { bad++; console.log("save/restore differs, seed", s, "frame", t); break; }
    }
  }
  console.log(`determinism: ${bad} mismatches (6 replays, ${n} restored frames)`);
  return bad === 0;
}
function levels(N, D) {
  const out = [];
  for (let lv = 0; lv < 3; lv++) {
    const r = { wins: 0, len: 0, stag: 0, lost: 0, hp: 0, downs: {}, moves: {}, flight: 0, stuck: 0, wrong: 0, right: 0 };
    for (let i = 0; i < N; i++) {
      const a = F[i % F.length], b = F[(i * 5 + 3) % F.length];
      const { g, st } = fight(1000 + i * 7 + lv, lv, a, b, D);
      if (g.winner === 0) r.wins++;
      r.len += g.t; r.stag += st.stag; r.hp += g.fighters[2].hp / g.fighters[2].hpMax;
      r.lost += g.fighters[0].falls + g.fighters[1].falls;
      r.wrong += st.wrong; r.right += st.right;
      if (st.downBy) {
        r.downs[st.downBy] = (r.downs[st.downBy] || 0) + 1;
        if (st.goneT < 0) r.stuck++; else r.flight = Math.max(r.flight, st.goneT - st.downT);
      }
      for (const k in st.moves) r.moves[k] = (r.moves[k] || 0) + st.moves[k];
    }
    console.log(`${LV[lv]}: players win ${(100 * r.wins / N).toFixed(0)}% of ${N}, ${(r.len / N / 60).toFixed(0)} s a fight, ${(r.stag / N).toFixed(1)} staggers, ${(r.lost / N).toFixed(1)} hearts lost, boss HP left ${(100 * r.hp / N).toFixed(0)}%`);
    console.log(`   ended by ${JSON.stringify(r.downs)}, longest flight out ${r.flight} frames${r.stuck ? `, ${r.stuck} NEVER LEFT` : ""}; moves ${JSON.stringify(r.moves)}; lethal calls on players ${r.right} right, ${r.wrong} wrong`);
    out.push(r);
  }
  return out;
}
const arg = process.argv[2];
if (arg) { levels(+arg, +(process.argv[3] || 0.6)); process.exit(0); }
const fails = [];
if (!det()) fails.push("determinism");
const N = 24, R = levels(N, 0.6);
const band = (lv, lo, hi) => { const w = (100 * R[lv].wins) / N; if (w < lo || w > hi) fails.push(`${LV[lv]} win rate ${w.toFixed(0)}% outside ${lo}-${hi}%`); };
band(0, 65, 100); band(1, 25, 75); band(2, 0, 25);
R.forEach((r, lv) => {
  const s = r.len / N / 60;
  if (s < 40 || s > 150) fails.push(`${LV[lv]} fights last ${s.toFixed(0)} s (want 40-150)`);
  for (const k of ["stab", "whip", "stomp", "rain", "charge"]) if (!r.moves[k]) fails.push(`${LV[lv]}: ${k} never used`);
  if (r.stuck) fails.push(`${LV[lv]}: the final launch left him in the arena ${r.stuck} times`);
  if (r.flight > 120) fails.push(`${LV[lv]}: the final launch took ${r.flight} frames to leave`);
  if (r.wrong > Math.max(1, r.right * 0.03)) fails.push(`${LV[lv]}: ${r.wrong} wrong lethal calls of ${r.wrong + r.right}`);
});
for (const f of fails) console.log("FAIL", f);
if (!fails.length) console.log("boss ok");
