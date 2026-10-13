// How high can each fighter get by itself, starting on the top platform?
const { BL } = require(process.env.CORE || "../game/core.js");
const { FIGHTERS, newGame, step } = BL;
for (const spec of FIGHTERS) {
  for (const useRec of [false, true]) {
    const g = newGame({ players: [{ spec, pal: spec.palettes[0] }, { spec: FIGHTERS[0], pal: FIGHTERS[0].palettes[0] }], seed: 1, countdown: 0 });
    const f = g.fighters[0], o = g.fighters[1];
    // warm up past any countdown
    for (let i = 0; i < 200 && g.phase !== "play"; i++) { step(g, [{}, {}]); g.events.length = 0; }
    Object.assign(f, { x: 0, y: -245, grounded: true, plat: 2, vx: 0, vy: 0 });
    o.x = 300; o.y = 0;
    let minHead = 1e9, koed = false, phase = 0, wait = 0, prevVy = 0;
    for (let t = 0; t < 400; t++) {
      const inp = {};
      if (wait > 0) wait--;
      else if (phase === 0) { inp.jump = true; phase = 1; wait = 2; }
      else if (phase === 1 && !f.grounded && f.vy >= -0.5 && prevVy < -0.5) {
        if (f.airJumps > 0) { inp.jump = true; wait = 2; }
        else if (useRec && !f.recUsed) { inp.heavy = true; inp.y = -1; phase = 2; }
      }
      if (phase === 2) inp.y = -1;
      prevVy = f.vy;
      const st0 = f.stocks;
      step(g, [inp, {}]); g.events.length = 0;
      if (f.stocks < st0) { koed = true; break; }
      if (f.state !== "dead") minHead = Math.min(minHead, f.y - f.s.h);
    }
    console.log(spec.id.padEnd(10), useRec ? "jumps+upB" : "jumps    ", "highest head y:", Math.round(minHead), koed ? "  -> LOST A LIFE (top line is " + BL.STAGE?.blast?.top + ")" : "");
  }
}
