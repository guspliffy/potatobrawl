// worst-case hits/launches over all attacker/defender/pct for a given core and R; also count defender SDs separately
const { BL } = require(process.env.CORE || require("path").join(__dirname, "../../game/core.js"));
const { FIGHTERS, newGame, step } = BL;
function run(attId, defId, R, pct) {
  const A = FIGHTERS.find((f) => f.id === attId), D = FIGHTERS.find((f) => f.id === defId);
  const g = newGame({ players: [{ spec: A, pal: A.palettes[0] }, { spec: D, pal: D.palettes[0] }], countdown: 0 });
  const a = g.fighters[0], d = g.fighters[1];
  a.x = -40; d.x = 10; a.facing = 1; d.facing = -1; d.percent = pct;
  let hits = 0, lastHit = -1, free = 0, acted = false, first = -1, launches = 0, maxGapless = 0, run_ = 0;
  for (let t = 0; t < 60 * 20; t++) {
    const ia = {}, id = {};
    const dx = d.x - a.x, away = Math.sign(dx) || 1;
    const inRange = Math.abs(dx) < 52 && Math.abs(d.y - a.y) < 40;
    if (inRange) ia.light = t % 2 === 0; else ia.x = away;
    if (first >= 0) {
      if (BL.canAct(d) && g.hitstop === 0) free++; else if (d.state === "hitstun") { free = 0; acted = false; }
      if (free >= 1) id.x = away;
      if (free >= R && !acted) { acted = true; id.jump = true; id.x = away; }
    }
    const before = d.percent, st0 = d.stocks, fr = free;
    step(g, [ia, id]);
    let hitNow = false;
    for (const e of g.events) if (e.type === "hit" && e.slot === 0) { hitNow = true; if (e.finisher) launches++; }
    g.events.length = 0;
    if (hitNow) { if (hits > 0 && fr < R + 3) run_++; else run_ = 1; maxGapless = Math.max(maxGapless, run_); }
    if (d.percent > before) { hits++; lastHit = t; if (first < 0) first = t; }
    if (d.stocks < st0) return { hits, launches, maxGapless };
    if (first >= 0 && t - lastHit >= 90) return { hits, launches, maxGapless };
  }
  return { hits, launches, maxGapless };
}
const ids = FIGHTERS.map((f) => f.id);
for (const R of [8, 14, 20, 26]) {
  let worst = 0, worstGapless = 0, tag = "";
  for (const att of ids) for (const def of ids) for (const pct of [0, 15, 30, 45, 60, 80]) {
    const r = run(att, def, R, pct);
    if (r.maxGapless > worstGapless) { worstGapless = r.maxGapless; tag = `${att}>${def}@${pct}%`; }
    worst = Math.max(worst, r.hits);
  }
  console.log(`R=${R}: longest run of hits with <R+3 free frames between them: ${worstGapless} (${tag}); max total hits ${worst}`);
}
