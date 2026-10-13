// CPU fighting styles: each fighter's styled bot against the neutral bot (same fighter on both sides, sides swapped every
// game). A style should change how the CPU plays, not how strong it is, so the styled win rate should stay near 50%
// (the aim is 35-65%). Also prints what the style does, for the styled bot and for the neutral one it fought: how long it
// walks toward / away from the opponent, time in the air, specials, heavies and charged heavies per minute, and hits
// landed on an opponent who is off the stage (the edge guard).
//   node botstyle.js [games per fighter and level, default 100] [levels, default 0.5,0.8]
const { BL } = require("../game/core.js");
const { FIGHTERS, BOT_STYLES, newGame, step, makeBot, botInput } = BL;
const N = +(process.argv[2] || 100), LV = (process.argv[3] || "0.5,0.8").split(",").map(Number);
const LO = 35, HI = 65;
// STYLE='{"wizard":{"gap":2}}' tries other numbers; ONLY=wizard runs one fighter
if (process.env.STYLE) for (const [id, v] of Object.entries(JSON.parse(process.env.STYLE))) BOT_STYLES[id] = v;

function play(spec, d, seed, styledSlot) {
  const g = newGame({ players: [{ spec, pal: spec.palettes[0] }, { spec, pal: spec.palettes[1] }], seed, countdown: 10, time: 240 });
  const bots = [0, 1].map((s) => makeBot(d, s === styledSlot ? BOT_STYLES[spec.id] : undefined));
  const m = [0, 1].map(() => ({ fwd: 0, back: 0, air: 0, edge: 0, frames: 0, spec: 0, heavy: 0, chg: 0, pchg: 0, mid: null }));
  let fr = 0;
  while (g.phase !== "over" && fr < 60 * 330) {
    step(g, [botInput(g, g.fighters[0], g.fighters[1], bots[0]), botInput(g, g.fighters[1], g.fighters[0], bots[1])]);
    for (const e of g.events) if (e.type === "hit" && !e.armor && (Math.abs(e.x) > BL.STAGE.main.x2 || e.y > BL.STAGE.main.top + 40)) m[e.slot].edge++;
    g.events.length = 0; fr++;
    if (g.phase !== "play") continue;
    g.fighters.forEach((f, i) => {
      if (f.state === "dead" || f.state === "gone" || f.state === "respawn") return;
      const o = g.fighters[1 - i], q = m[i];
      q.frames++; if (!f.grounded) q.air++;
      const toward = Math.sign(o.x - f.x) * f.vx; if (toward > 0.5) q.fwd++; else if (toward < -0.5) q.back++;
      if (f.mid && f.mid !== q.mid) { if (f.mid === "spec") q.spec++; else if (f.mid[0] === "h" && f.mid !== "hAir") q.heavy++; }
      if (f.chg > 0 && q.pchg === 0) q.chg++;
      q.pchg = f.chg; q.mid = f.mid;
    });
  }
  return { winner: g.winner, m };
}

let bad = 0;
console.log(`styled vs neutral, ${N} games per fighter and level (aim ${LO}-${HI}% for the styled CPU)`);
console.log("fighter    level  styled wins   fwd%  back%  air%  edge hits/min  spec/min  heavy/min  charged/min   |  neutral twin: fwd%  back%  air%  edge hits/min  spec/min  heavy/min  charged/min");
for (const spec of FIGHTERS) {
  if (process.env.ONLY && process.env.ONLY !== spec.id) continue;
  if (!BOT_STYLES[spec.id]) { console.log(spec.id.padEnd(10), "no style"); continue; }
  for (const d of LV) {
    let w = 0, draws = 0;
    const sum = [0, 1].map(() => ({ fwd: 0, back: 0, air: 0, edge: 0, frames: 0, spec: 0, heavy: 0, chg: 0 }));
    for (let k = 0; k < N; k++) {
      const slot = k % 2, r = play(spec, d, 1000 + k, slot);
      if (r.winner === slot) w++; else if (r.winner < 0) draws++;
      for (const [role, idx] of [[0, slot], [1, 1 - slot]]) for (const key of Object.keys(sum[role])) sum[role][key] += r.m[idx][key];
    }
    const pct = (100 * (w + draws / 2)) / N;
    const pc = (v, s) => (100 * v / s.frames).toFixed(1).padStart(4);
    const row = (s) => `${pc(s.fwd, s)}  ${pc(s.back, s)}  ${pc(s.air, s)}  ${(s.edge * 3600 / s.frames).toFixed(2).padStart(9)}  ${(s.spec * 3600 / s.frames).toFixed(1).padStart(6)}  ${(s.heavy * 3600 / s.frames).toFixed(1).padStart(8)}  ${(s.chg * 3600 / s.frames).toFixed(1).padStart(10)}`;
    const flag = pct < LO || pct > HI ? "  <-- outside the aim" : "";
    if (flag) bad++;
    console.log(spec.id.padEnd(10), String(d).padEnd(5), (pct.toFixed(1) + "%").padStart(10), "  ", row(sum[0]), "   |  ", row(sum[1]), flag);
  }
}
console.log(bad ? `botstyle: ${bad} outside the aim` : "botstyle ok");
