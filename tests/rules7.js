const { BL } = require("../game/core.js");
const { FIGHTERS, newGame, step } = BL;
const F = (id) => FIGHTERS.find((f) => f.id === id);
function setup(a = "odin", b = "phoenix") {
  const g = newGame({ players: [{ spec: F(a), pal: F(a).palettes[0] }, { spec: F(b), pal: F(b).palettes[0] }], countdown: 0 });
  step(g, [{}, {}]); g.events.length = 0; return g;
}
// 1) breakfall: defender launched at mid-stage, presses dodge just before landing
for (const press of [false, true]) {
  const g = setup(), A = g.fighters[0], D = g.fighters[1];
  A.x = 0; D.x = 30; A.facing = 1; D.percent = 60;
  let states = new Set(), pressed = false, t = 0, inp = [{ heavy: true, y: -1 }, {}];
  for (t = 0; t < 240; t++) {
    const id = {};
    if (press && !pressed && D.state === "hitstun" && D.vy + D.kby > 1 && D.y > -40) { id.dodge = true; pressed = true; }
    step(g, [t === 0 ? inp[0] : {}, id]); states.add(D.state);
    const ev = g.events.map((e) => e.type); g.events.length = 0;
    if (ev.includes("tech")) { console.log("breakfall: tech event at frame", t, "state", D.state, "invuln", D.invuln); break; }
  }
  console.log(`press=${press}: states seen`, [...states].join(","));
}
// 2) steering: same hit with stick held up vs away vs none -> launch direction
for (const stick of [{}, { y: -1 }, { x: 1 }, { x: -1, y: -1 }]) {
  const g = setup("odin", "wizard"), A = g.fighters[0], D = g.fighters[1];
  A.x = 0; D.x = 40; A.facing = 1; D.percent = 80;
  let ang = null;
  for (let t = 0; t < 60 && ang === null; t++) {
    step(g, [t === 0 ? { heavy: true, x: 1 } : {}, stick]);
    for (const e of g.events) if (e.type === "hit") ang = Math.round(Math.atan2(-e.diry, e.dirx) * 180 / Math.PI);
    g.events.length = 0;
  }
  console.log("stick", JSON.stringify(stick), "-> launch angle", ang);
}
// 3) sudden death on equal stocks at time-out
{
  const g = newGame({ players: [{ spec: F("samurai"), pal: F("samurai").palettes[0] }, { spec: F("wizard"), pal: F("wizard").palettes[0] }], countdown: 0, time: 2 });
  g.fighters[0].percent = 40;
  let ev = [];
  for (let t = 0; t < 200; t++) { step(g, [{}, {}]); ev.push(...g.events.map((e) => e.type)); g.events.length = 0; }
  console.log("time-out with equal stocks:", ev.includes("sudden") ? "sudden death" : "no sudden", "| percents", g.fighters.map((f) => f.percent), "| stocks", g.fighters.map((f) => f.stocks), "| timer", g.timer, "| phase", g.phase);
  const g2 = newGame({ players: [{ spec: F("samurai"), pal: F("samurai").palettes[0] }, { spec: F("wizard"), pal: F("wizard").palettes[0] }], countdown: 0, time: 0 });
  for (let t = 0; t < 600; t++) step(g2, [{}, {}]);
  console.log("no time limit after 10 s:", g2.phase, "timed", g2.timed);
}
