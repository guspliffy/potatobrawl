const { BL } = require(process.env.CORE || "../game/core.js");
const { FIGHTERS, newGame, step, makeBot, botInput } = BL;
let top = 0, all = 0, topSD = 0, wins = [0, 0];
for (let seed = 1; seed <= 60; seed++) {
  const a = FIGHTERS[seed % 6], b = FIGHTERS[(seed * 5 + 1) % 6];
  const g = newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[0] }], seed, countdown: 10 });
  const b0 = makeBot(0.8), b1 = makeBot(0.8);
  for (let t = 0; t < 12000 && g.phase !== "over"; t++) {
    step(g, [botInput(g, g.fighters[0], g.fighters[1], b0), botInput(g, g.fighters[1], g.fighters[0], b1)]);
    for (const e of g.events) if (e.type === "ko") { all++; if (e.y < -500) { top++; if (e.sd) topSD++; } }
    g.events.length = 0;
  }
}
console.log("KOs:", all, "through the top:", top, "of which self-inflicted:", topSD);
