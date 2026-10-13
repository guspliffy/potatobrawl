// serialize/restore round trip + checksum equality on the patched core, with bots fighting (strings happen)
const { BL } = require(process.env.CORE || "../game/core.js");
const { FIGHTERS, newGame, step, makeBot, botInput, serialize, restore, checksum } = BL;
let mismatches = 0, launches = 0, safeFrames = 0, checks = 0;
for (let seed = 1; seed <= 40; seed++) {
  const A = FIGHTERS[seed % 6], B = FIGHTERS[(seed * 7 + 1) % 6];
  const mk = () => newGame({ players: [{ spec: A, pal: A.palettes[0] }, { spec: B, pal: B.palettes[1] }], seed, countdown: 10, time: 240 });
  const g1 = mk(), g2 = mk();
  const ba = makeBot(0.9), bb = makeBot(0.9);
  const inputs = [];
  for (let t = 0; t < 60 * 60 && g1.phase !== "over"; t++) {
    const ia = botInput(g1, g1.fighters[0], g1.fighters[1], ba), ib = botInput(g1, g1.fighters[1], g1.fighters[0], bb);
    inputs.push([JSON.parse(JSON.stringify(ia)), JSON.parse(JSON.stringify(ib))]);
    step(g1, [ia, ib]);
    for (const e of g1.events) if (e.type === "hit" && e.finisher) launches++;
    g1.events.length = 0;
    if (g1.fighters.some((f) => f.strLaunched)) safeFrames++;
    // every 97 frames: snapshot g1 into g2 (fresh restore) and compare checksums after replaying 30 more frames on both
    if (t % 97 === 50) {
      restore(g2, JSON.parse(JSON.stringify(serialize(g1))));
      if (checksum(g1) !== checksum(g2)) mismatches++;
      checks++;
    }
    if (t % 97 > 50 && t % 97 <= 80) { step(g2, inputs[inputs.length - 1]); g2.events.length = 0; if (checksum(g1) !== checksum(g2)) mismatches++; checks++; }
  }
}
console.log({ checks, mismatches, launches, framesWithStrLaunched: safeFrames });
