const { BL } = require("../game/core.js");
const { FIGHTERS, newGame, step, makeBot, botInput, serialize, restore, checksum } = BL;
const mapOf = (seed) => (process.env.MAP === "all" ? seed % BL.MAPS.length : +(process.env.MAP || 0));   // MAP=<index> or MAP=all (the seed picks)
let maxErr = 0; for (let d = -90; d <= 90; d++) { const [c, s] = [Math.cos(d*Math.PI/180), Math.sin(d*Math.PI/180)]; const g = newGame({players:[{spec:FIGHTERS[0],pal:FIGHTERS[0].palettes[0]},{spec:FIGHTERS[1],pal:FIGHTERS[1].palettes[0]}]}); }
let worst = 0, maxSize = 0, fails = 0;
for (let seed = 1; seed <= 30; seed++) {
  const a = FIGHTERS[seed % FIGHTERS.length], b = FIGHTERS[(seed * 3) % FIGHTERS.length];
  const mk = () => newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[1] }], seed, countdown: 10, map: mapOf(seed) });
  const g = mk(); const b0 = makeBot(0.8), b1 = makeBot(0.8);
  const log = [];
  let snap = null, snapAt = 0;
  for (let t = 0; t < 4000 && g.phase !== "over"; t++) {
    if (t === 1500) { snap = JSON.parse(JSON.stringify(serialize(g))); snapAt = t; maxSize = Math.max(maxSize, JSON.stringify(snap).length); }
    const ins = [botInput(g, g.fighters[0], g.fighters[1], b0), botInput(g, g.fighters[1], g.fighters[0], b1)];
    log.push(ins); step(g, ins); g.events.length = 0;
    if (t % 97 === 0) maxSize = Math.max(maxSize, JSON.stringify(serialize(g)).length);
  }
  if (!snap) continue;
  const h1 = checksum(g);
  const g2 = mk(); restore(g2, snap);
  for (let t = snapAt; t < log.length; t++) { step(g2, log[t]); g2.events.length = 0; }
  const h2 = checksum(g2);
  if (h1 !== h2) fails++;
}
console.log("snapshot replay mismatches:", fails, "/ 30; max snapshot JSON bytes:", maxSize);
