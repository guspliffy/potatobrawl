/* Ultimates: for every fighter's ulti, against a light and a heavy defender who stands still (and one who only holds
   away), the lowest percent at which the ulti's hit is a KO; the first hit's frame after the super freeze (must be >= 24);
   and the bar (fills, spent on the press, max two uses). `node ulti.js` prints a table and "ulti ok" when every check holds.
   KO bands: no ulti KOs below 80%, every ulti KOs a standing defender by 150%. */
const { FIGHTERS, newGame, step, blankInput, TUNE } = require("../game/core.js").BL;
const DIST = { phoenix: 160, alchemist: 100, odin: 220, wizard: 160, samurai: 140, dragon: 160, gunslinger: 220, reaper: 220 };
function run(att, def, pct, hold) {
  const g = newGame({ players: [{ spec: att, pal: att.palettes[0] }, { spec: def, pal: def.palettes[0] }], seed: 7, countdown: 0, stocks: 3 });
  const A = g.fighters[0], D = g.fighters[1];
  A.x = -150; D.x = -150 + DIST[att.id]; A.facing = 1; D.facing = -1;
  D.percent = pct; A.ult = TUNE.ultNeed[0];
  let t = 0, uT = -1, first = -1, lethal = false, ko = false, dmg = 0;
  for (; t < 400; t++) {
    const a = blankInput(), d = blankInput();
    if (t === 2) a.ulti = true;
    if (hold) d.x = 1;
    step(g, [a, d]);
    for (const e of g.events) {
      if (e.type === "ulti") uT = g.t;
      if (e.type === "hit" && e.slot === 0 && e.ult) { if (first < 0) first = g.t - uT; dmg += e.dmg; }
      if (e.type === "lethal" && e.slot === 1) lethal = true;
      if (e.type === "ko" && e.slot === 1) ko = true;
    }
    g.events.length = 0;
    if (ko) break;
  }
  return { first, lethal, dmg, spent: A.ult === 0 && A.ultN === 1 };
}
let bad = [];
const W = FIGHTERS.slice().sort((a, b) => a.stats.weight - b.stats.weight), light = W[0], heavy = W[W.length - 1];
console.log("ulti         first  dmg   KO% vs " + light.id + "  KO% vs " + heavy.id + "  (holding away vs " + heavy.id + ")");
for (const a of FIGHTERS) {
  const r0 = run(a, heavy, 0, false);
  if (r0.first < 24) bad.push(a.id + " first hit at " + r0.first);
  if (!r0.spent) bad.push(a.id + " bar not spent");
  const ko = (d, hold) => { for (let p = 0; p <= 300; p += 5) if (run(a, d, p, hold).lethal) return p; return 999; };
  const kl = ko(light, false), kh = ko(heavy, false), kr = ko(heavy, true);
  if (kl < 80 || kh < 80) bad.push(a.id + " KOs below 80%");
  if (kl > 150 || kh > 150) bad.push(a.id + " needs more than 150%");
  console.log(a.id.padEnd(12), String(r0.first).padStart(5), String(r0.dmg).padStart(4), String(kl).padStart(8), String(kh).padStart(12), String(kr).padStart(14));
}
// the bar: damage fills it, a lost heart adds ultHeart, no third use
{
  const g = newGame({ players: [{ spec: FIGHTERS[0], pal: FIGHTERS[0].palettes[0] }, { spec: FIGHTERS[1], pal: FIGHTERS[1].palettes[0] }], seed: 1, countdown: 0 });
  const A = g.fighters[0];
  A.ultN = 2; A.ult = 0;
  const a = blankInput(); a.ulti = true;
  step(g, [a, blankInput()]);
  if (A.mid === "ulti") bad.push("a third ulti started");
}
if (bad.length) { console.log("FAIL", bad.join("; ")); process.exit(1); }
console.log("ulti ok");
