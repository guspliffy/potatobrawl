// The repair copy of an online boss fight (ui/online.js onDesync / syncPiece): for every boss, the largest copy seen in bot fights is
// cut into the pieces the host sends (SYNC_PART characters, read from ui/online.js), each piece must fit a whole match presence under the
// 4 KB a presence may hold (the other fields at their largest), and the pieces joined and restored into a fresh game must play on frame
// for frame like the original. The fights are the online ones: his Road HP x the two-player K (ui/online.js duoHp). Then the same for an online Team Brawl's copy with three CPUs (below). Prints "onsnap ok" when all of
// that holds (check.sh step 5c).
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
// his HP online: ui/road.js ROAD_REG hp x ui/online.js DUO_HP[boss][level], as duoHp builds it
const road = fs.readFileSync(__dirname + "/../game/ui/road.js", "utf8");
const REG = new Function("const _t = (s) => s, _tk = (s) => s, _tv = (s) => s;\n" + road.slice(road.indexOf("const ROAD_REG = ["), road.indexOf("];", road.indexOf("const ROAD_REG = [")) + 2) + "\nreturn ROAD_REG;")();
const DUO = new Function(`return ${(/const DUO_HP = (\{[^\n]*\});/.exec(src) || [, "{}"])[1]};`)();
const duoHp = (boss, lv) => (REG.find((g) => g.boss === boss.id) || { hp: 1 }).hp * DUO[boss.id][lv];
const game = (boss, s) => {
  const a = F[s % F.length], b = F[(s * 3 + 1) % F.length];
  return BL.newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }, { spec: boss, pal: boss.palettes[0] }], stocks: 3, time: 0, countdown: 30, seed: s * 7919 + 13, map: mapOf(boss), level: s % 3, hpMul: duoHp(boss, s % 3) });
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

// ----- an online Team Brawl (ui/online-team.js): the copy is { g: the game, b: the CPUs' memory by seat, r: their random counter, c: the
// takeovers }, cut into TB_PART pieces. Three CPUs (one person), the largest copy seen; each piece inside a whole presence with every other
// field at its largest (the board, the start message, three claims with their relayed inputs and three holds of a dropped friend's
// inputs, more than can be up at once); joined, it restores into a fresh game and fresh CPUs that play on frame for frame (checksums and
// the random counter).
const tsrc = fs.readFileSync(__dirname + "/../game/ui/online-team.js", "utf8");
const TPART = +(/const TB_PART = (\d+);/.exec(tsrc) || [])[1], RELAY = +(/const TB_RELAY = (\d+);/.exec(tsrc) || [])[1];
if (!TPART || !RELAY) fail("TB_PART or TB_RELAY not found in ui/online-team.js");
const TF = F.filter((f) => !f.boss), peer = "0123456789abcdef0123456789abcdef0123abcd";
const tgame = (s) => {
  const pick = [0, 1, 2, 3].map((k) => TF[(s * (k + 3) + k * 5) % TF.length]);
  const g = BL.newGame({ players: pick.map((sp, i) => ({ spec: sp, pal: sp.palettes[i % sp.palettes.length], team: i < 2 ? 0 : 1 })), stocks: 3, time: 240, countdown: 30, seed: s * 7919 + 13, map: s % BL.POOL });
  g.rng = BL.rngOf(s * 7919 + 13);
  return { g, bots: pick.map((sp) => BL.makeBot([0.15, 0.5, 0.9][s % 3], BL.BOT_STYLES[sp.id])), d: [0.15, 0.5, 0.9][s % 3], pick };
};
const tins = (g, bots) => g.fighters.map((f, i) => BL.teamBotInput(g, f, bots[i]));   // seat 0 plays as a CPU here too (any inputs will do)
const tcopy = (g, bots) => ({ g: BL.serialize(g), b: { 1: BL.botSave(g, bots[1]), 2: BL.botSave(g, bots[2]), 3: BL.botSave(g, bots[3]) }, r: g.rng.s | 0, c: [[1, 999999]] });
const tother = { role: "host", f: "alchemist", pi: 3, tb: { lv: 2, bd: [peer, peer, peer, peer], open: false }, m: 99999, s: 999999, i: "Az".repeat(72), fr: 999999, ck: [999999, 4294967295],
  pg: 999999999, po: [999999999, 999999999, 999999999, 999999999], sa: [99999, 15], rm: 100000, bk: 99999, fp: [99999, 3], sw: 99999, em: 99999, rt: 9999,
  cl: [1, 2, 3].map((k) => [k, 999999, 999999, "Az".repeat(RELAY)]), ho: [1, 2, 3].map((k) => [k, 999999, "Az".repeat(RELAY)]),
  start: { id: 99999, seed: 999999999, d: 15, t: 1, lv: 2, h: [peer, null, null, null], f: ["alchemist", "gunslinger", "alchemist", "gunslinger"], p: [3, 3, 3, 3], nm: [null, "Yukon Yolanda", "Yukon Yolanda", "Yukon Yolanda"], rtt: 9999 } };
{
  let big = null, bigN = 0, bigAt = null;
  for (let s = 1; s <= N * 2; s++) {
    const { g, bots } = tgame(s);
    while (g.phase !== "over" && g.t < 60 * 240) {
      BL.step(g, tins(g, bots)); g.events.length = 0;
      if (g.t % 5 === 0) { const txt = JSON.stringify(tcopy(g, bots)); if (txt.length > bigN) { bigN = txt.length; big = txt; bigAt = { s, t: g.t }; } }
    }
  }
  const parts = [];
  for (let i = 0; i < big.length; i += TPART) parts.push(big.slice(i, i + TPART));
  let worst = 0;
  parts.forEach((d, k) => { const n = JSON.stringify(Object.assign({}, tother, { sync: { n: 99999, f: 999999, k, of: parts.length, d } })).length; worst = Math.max(worst, n); });
  if (worst > LIMIT) fail(`team brawl: a piece makes the presence ${worst} characters (limit ${LIMIT})`);
  if (parts.length > 16) fail(`team brawl: the copy needs ${parts.length} pieces (16 at most)`);
  // the copy at that moment, restored into a fresh game with fresh CPUs (as tbApplySync does), plays on like the original
  const A = tgame(bigAt.s), B = tgame(bigAt.s);
  while (A.g.t < bigAt.t) { BL.step(A.g, tins(A.g, A.bots)); A.g.events.length = 0; }
  const c = JSON.parse(parts.join(""));
  BL.restore(B.g, c.g); B.g.rng.s = c.r | 0;
  for (const k of [1, 2, 3]) BL.botLoad(B.g, B.bots[k], c.b[k]);
  const sameNow = BL.checksum(A.g) === BL.checksum(B.g) && A.g.rng.s === B.g.rng.s;
  if (!sameNow) fail("team brawl: the restored copy has another checksum or random counter");
  let diverged = -1;
  for (let t = 0; t < 1800 && A.g.phase !== "over"; t++) {
    const me = A.g.fighters[0], foe = A.g.fighters[2], i0 = Object.assign(BL.blankInput(), { x: Math.sign(foe.x - me.x), light: t % 16 < 2, jump: t % 90 === 0 });   // seat 0: a person (no CPU random numbers)
    const ia = [i0, ...[1, 2, 3].map((k) => BL.teamBotInput(A.g, A.g.fighters[k], A.bots[k]))];
    const ib = [i0, ...[1, 2, 3].map((k) => BL.teamBotInput(B.g, B.g.fighters[k], B.bots[k]))];
    BL.step(A.g, ia); BL.step(B.g, ib); A.g.events.length = 0; B.g.events.length = 0;
    if (BL.checksum(A.g) !== BL.checksum(B.g) || A.g.rng.s !== B.g.rng.s) { diverged = t; break; }
  }
  if (diverged >= 0) fail(`team brawl: the restored game drifted ${diverged} frames after the copy`);
  console.log(`team brawl: largest copy ${bigN} characters (3 CPUs), ${parts.length} pieces of ${TPART}, largest presence ${worst}, restored game plays on: ${diverged < 0 ? "yes" : "no"}`);
}
console.log(bad ? `onsnap FAILED (${bad})` : "onsnap ok");
