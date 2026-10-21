const { BL } = require("../game/core.js");
const { FIGHTERS, newGame, step } = BL;
const F = (id) => FIGHTERS.find((f) => f.id === id);
for (const [press, stick] of [[false, 0], [true, 0], [true, 1]]) {
  const g = newGame({ seed: 1, players: [{ spec: F("odin"), pal: F("odin").palettes[0] }, { spec: F("phoenix"), pal: F("phoenix").palettes[0] }], countdown: 0 });
  step(g, [{}, {}]);
  const D = g.fighters[1];
  // knocked downward toward the stage while in hitstun
  D.x = 0; D.y = -40; D.grounded = false; D.state = "hitstun"; D.st = 0; D.hitstun = 40; D.kbx = 2; D.kby = 7; D.tumble = true;
  const seen = [];
  for (let t = 0; t < 60; t++) {
    const inp = {};
    if (press && t === 2) inp.dodge = true;
    if (stick) inp.x = stick;
    step(g, [{}, inp]);
    for (const e of g.events) if (["tech", "bounce", "land"].includes(e.type)) seen.push(`${e.type}@${t}`);
    g.events.length = 0;
    if (seen.length && t > 30) break;
  }
  console.log(`dodge=${press} stick=${stick}:`, seen.join(" "), "| final state", D.state, "x", Math.round(D.x));
}
