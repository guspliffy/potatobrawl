// For each attacker (jab spam) vs defender at pct, defender holds away and jumps after R free frames.
// Reports: hits, launches, gaps (free frames before each hit), whether loop is mode A (launch loop) or B (never chains).
const { BL } = require(process.env.CORE || require("path").join(__dirname, "../../game/core.js"));
const { FIGHTERS, newGame, step } = BL;
function run(attId, defId, R, pct) {
  const A = FIGHTERS.find((f) => f.id === attId), D = FIGHTERS.find((f) => f.id === defId);
  const g = newGame({ players: [{ spec: A, pal: A.palettes[0] }, { spec: D, pal: D.palettes[0] }], countdown: 0 });
  const a = g.fighters[0], d = g.fighters[1];
  a.x = -40; d.x = 10; a.facing = 1; d.facing = -1; d.percent = pct;
  let hits = 0, lastHit = -1, free = 0, acted = false, first = -1, launches = 0, gaps = [], maxStr = 0;
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
    for (const e of g.events) if (e.type === "hit" && e.slot === 0) { if (e.finisher) launches++; maxStr = Math.max(maxStr, d.strN); if (hits > 0) gaps.push(fr); }
    g.events.length = 0;
    if (d.percent > before) { hits++; lastHit = t; if (first < 0) first = t; }
    if (d.stocks < st0) return { hits, launches, gaps, ko: true, maxStr };
    if (first >= 0 && t - lastHit >= 90) return { hits, launches, gaps, ko: false, maxStr };
  }
  return { hits, launches, gaps, stuck: true, maxStr };
}
const R = +(process.argv[2] || 14);
const ids = FIGHTERS.map((f) => f.id);
for (const att of ids) {
  for (const pct of [0, 30, 60]) {
    const cells = [];
    for (const def of ids) {
      const r = run(att, def, R, pct);
      cells.push(`${def.slice(0,3)}:${String(r.hits).padStart(2)}h/${r.launches}L${r.ko ? "K" : " "}`);
    }
    const r = run(att, "odin", R, pct);
    console.log(`${att.padEnd(9)} ${String(pct).padStart(2)}% ${cells.join(" ")}  gaps(vs odin): ${r.gaps.join(",")}`);
  }
}
