// The sprint (TUNE.sprint): its trigger, burst, cancels, cooldown, no i-frames, ground only, held buttons on a sprint frame,
// the sprint light's knockback, and the online input codes for it (game/ui/online.js encIn / decIn, and quick.js's decIn).
//   node sprint.js     prints each check and "sprint ok" when all pass
const fs = require("fs"), path = require("path"), vm = require("vm");
const { BL } = require(process.env.CORE || "../game/core.js");
const Q = require("../quick.js");
const { FIGHTERS, newGame, step, blankInput, intangible, TUNE } = BL;
const S = TUNE.sprint;
let bad = 0;
const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
const FIG = Object.fromEntries(FIGHTERS.map((f) => [f.id, f]));

// a game on the first map: A on the left facing right, B far away on the right; past the countdown
function game(a = "samurai", b = "odin", bx = 300) {
  const g = newGame({ players: [{ spec: FIG[a], pal: FIG[a].palettes[0] }, { spec: FIG[b], pal: FIG[b].palettes[0] }], seed: 7, countdown: 0, map: 0, time: 0 });
  step(g, [blankInput(), blankInput()]);
  const [A, B] = g.fighters;
  A.x = -260; A.facing = 1; B.x = bx; B.facing = -1;
  for (let i = 0; i < 4; i++) step(g, [blankInput(), blankInput()]);
  return g;
}
const inp = (o) => Object.assign(blankInput(), o);
const run = (g, a, b) => { step(g, [a || blankInput(), b || blankInput()]); g.events.length = 0; return g.fighters[0]; };

// 1. the trigger: a sprint press at a full side push starts it; a plain full push (or a sprint press with the stick in the middle) doesn't
{
  const g = game(), A = g.fighters[0];
  let any = false;
  for (let t = 0; t < 40; t++) { run(g, inp({ x: 1 })); any = any || A.spr > 0; }
  check(!any && Math.abs(A.vx) <= A.s.run + 1e-9, "a plain full push runs without a sprint (vx " + A.vx.toFixed(2) + ")");
  const g2 = game(), A2 = g2.fighters[0];
  run(g2, inp({ x: 0.2, sprint: true }));
  check(A2.spr === 0, "a sprint press with the stick in the middle does nothing");
  const g3 = game(), A3 = g3.fighters[0];
  run(g3, inp({ x: 1, sprint: true }));
  check(A3.spr === 1 && A3.state === "run" && Math.abs(A3.vx - A3.s.run * S.mul) < 1e-9, "a sprint press at a full push starts the burst at " + S.mul + "x run");
  const g4 = game(), A4 = g4.fighters[0];
  run(g4, inp({ x: -1, sprint: true }));
  check(A4.spr === 1 && A4.facing === -1 && A4.vx < 0, "it turns to the side pushed");
}
// 2. the burst: burst frames at mul x run while held, then a normal run; letting go ends it
{
  for (const fig of FIGHTERS.filter((f) => !f.boss)) {
    const g = game(fig.id), A = g.fighters[0];
    let fast = 0, t = 0;
    run(g, inp({ x: 1, sprint: true }));
    if (Math.abs(A.vx - A.s.run * S.mul) < 1e-9) fast++;
    for (t = 0; t < 40; t++) { run(g, inp({ x: 1 })); if (Math.abs(A.vx - A.s.run * S.mul) < 1e-9 && A.spr) fast++; }
    if (fast !== S.burst || A.spr !== 0 || Math.abs(A.vx - A.s.run) > 1e-9) { check(false, `${fig.id}: burst ${fast} frames (want ${S.burst}), then a run at ${A.vx.toFixed(2)}`); continue; }
  }
  check(true, "every fighter: " + S.burst + " burst frames at " + S.mul + "x run, then its run speed");
  const g = game(), A = g.fighters[0];
  run(g, inp({ x: 1, sprint: true })); run(g, inp({ x: 1 })); run(g, inp({ x: 0 }));
  check(A.spr === 0 && A.vx < A.s.run * S.mul && A.sprCd === S.cd, "letting go of the stick ends it (the cooldown starts)");
}
// 3. the cancels: each from its frame and not before (a press made earlier comes out on that frame); dodge on any frame
{
  const want = { jump: ["jumpsquat", S.jump], light: ["attack", S.light], heavy: ["attack", S.heavy], dodge: ["dodge", 2] };
  for (const k in want) {
    const [state, from] = want[k];
    let ok = true;
    for (let at = 2; at <= S.burst; at++) {
      const g = game(), A = g.fighters[0];
      run(g, inp({ x: 1, sprint: true }));
      let came = -1;
      for (let n = 2; n <= S.burst + 4 && came < 0; n++) {
        const was = A.spr;
        run(g, inp({ x: 1, [k]: n >= at && n <= at + 1 }));
        if (A.state === state) came = was + 1;
      }
      const exp = Math.max(at, from);
      if (came !== exp) { ok = false; console.log(`  ${k} pressed on burst frame ${at}: came out on ${came}, want ${exp}`); }
      if (k === "light" && A.mid !== "side") { ok = false; console.log(`  light out of a sprint is ${A.mid}, want side`); }
    }
    check(ok, `${k} cancels the burst from frame ${from}${k === "dodge" ? " (any frame)" : ""}, an earlier press waits for it`);
  }
}
// 4. never special or ulti during the burst
{
  for (const k of ["special", "ulti"]) {
    const g = game(), A = g.fighters[0];
    if (k === "ulti") A.ult = BL.ultNeed(A);
    run(g, inp({ x: 1, sprint: true }));
    let started = false;
    for (let n = 2; n <= S.burst; n++) { run(g, inp({ x: 1, [k]: n % 2 === 0 })); if (A.state === "attack") started = true; }
    check(!started && A.spr === S.burst, `${k} is blocked for the whole burst`);
  }
}
// 5. the cooldown: the next sprint starts cd frames after the burst ends, not sooner
{
  const g = game("odin", "samurai"), A = g.fighters[0];
  A.x = -320;
  run(g, inp({ x: 1, sprint: true }));
  let end = -1, again = -1;
  for (let t = 1; t < 120 && again < 0; t++) {
    run(g, inp({ x: t % 30 < 15 ? 1 : -1, sprint: t % 2 === 0 }));
    if (end < 0 && A.spr === 0) end = t;
    else if (end >= 0 && A.spr === 1) again = t;
    if (A.x > 200) A.x = -320;
  }
  check(again - end === S.cd, `the cooldown is ${again - end} frames (want ${S.cd})`);
}
// 6. no invincibility: never intangible in the burst, and a hit lands on a sprinting potato (and ends the sprint)
{
  const g = game("samurai", "odin", -110), [A, B] = g.fighters;
  let inv = false, hit = false;
  run(g, inp({ x: 1, sprint: true }));
  for (let n = 2; n <= S.burst; n++) {
    const was = A.spr;
    run(g, inp({ x: 1 }), inp({ x: 0, light: n % 4 === 0 }));
    if (intangible(A) && A.spr) inv = true;
    if (A.state === "hitstun" && was) hit = true;
  }
  run(g);
  check(!inv && hit && A.spr === 0, "no invincibility: a heavy lands on the sprinting potato and the sprint ends");
}
// 7. ground only: a sprint press in the air does nothing; running off the edge ends the burst
{
  const g = game(), A = g.fighters[0];
  run(g, inp({ jump: true })); for (let i = 0; i < 6; i++) run(g, inp({ jump: true }));
  let air = false;
  for (let i = 0; i < 12 && !A.grounded; i++) { run(g, inp({ x: 1, sprint: i % 2 === 0 })); if (A.spr && !A.grounded) air = true; }
  check(!air, "a sprint press in the air never starts one");
  const g2 = game(), A2 = g2.fighters[0];
  A2.x = 200;
  run(g2, inp({ x: 1, sprint: true }));
  let off = false;
  for (let i = 0, air = 0; i < 18; i++) { run(g2, inp({ x: 1 })); air = A2.grounded ? 0 : air + 1; if (air > 1 && A2.spr) off = true; }   // (cleared on the next frame)
  check(!off && !A2.grounded, "running off the edge ends it");
}
// 8. a sprint frame keeps the held buttons: a charging heavy keeps charging through one
{
  const g = game(), A = g.fighters[0];
  for (let i = 0; i < 20; i++) run(g, inp({ heavy: true }));
  const c0 = A.chg;
  run(g, inp({ x: 1, sprint: true }));
  run(g, inp({ heavy: true }));
  check(c0 > 0 && A.chg === c0 + 2 && A.state === "attack", "a sprint frame keeps the held buttons (a heavy charging through it: " + c0 + " -> " + A.chg + ")");
}
// 9. the light out of a sprint has +lightKb base knockback
{
  const kbOf = (spr) => {
    const g = game("samurai", "odin", -90), [A, B] = g.fighters;
    B.percent = 60;
    if (spr) { A.x = -260; run(g, inp({ x: 1, sprint: true })); }
    else A.x = B.x - 70;
    for (let t = 0; t < 40; t++) {
      const near = Math.abs(B.x - A.x) < 70;
      run(g, inp({ x: 1, light: near && t % 2 === 0 }));
      if (B.state === "hitstun") return Math.hypot(B.kbx, B.kby);
    }
    return 0;
  };
  const a = kbOf(false), b = kbOf(true);
  check(a > 0 && b > a, `the sprint light launches harder (${a.toFixed(2)} -> ${b.toFixed(2)})`);
}
// 10. the online codes: every sprint code goes both ways, the 1v1 receiver and quick.js accept them, quick.js decodes like the page
{
  const src = fs.readFileSync(path.join(__dirname, "../game/ui/online.js"), "utf8");
  const take = (re) => { const m = re.exec(src); if (!m) throw new Error("not found: " + re); return m[0]; };
  const box = { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), Math };
  vm.createContext(box);
  vm.runInContext([take(/const ULTI_BASE = [^\n]*\n/), take(/function encIn\(i\) \{[\s\S]*?\n\}\n/), take(/function decIn\(v\) \{[\s\S]*?\n\}\n/),
    "this.encIn = encIn; this.decIn = decIn; this.C = { ULTI_BASE, FOCUS_BASE, SPRINT_BASE, IN_END };"].join("\n"), box);
  const { encIn, decIn, C } = box;
  let ok = C.IN_END <= 4096 && C.SPRINT_BASE + 18 === C.IN_END;
  for (const side of [-1, 1]) for (let qy = -4; qy <= 4; qy++) {
    const i = { x: side, y: qy / 4, sprint: true, jump: true, light: true }, v = encIn(i), d = decIn(v);
    if (v < C.SPRINT_BASE || v >= C.IN_END || d.x !== side || d.y !== qy / 4 || !d.sprint || d.jump || d.light || encIn(d) !== v) { ok = false; console.log("  code", v, JSON.stringify(d)); }
  }
  for (let v = 0; v < C.IN_END; v++) { const d = decIn(v); if (encIn(d) !== v) { ok = false; console.log("  code", v, "comes back as", encIn(d)); break; } }
  check(ok, "the 18 sprint codes go both ways (" + C.SPRINT_BASE + "-" + (C.IN_END - 1) + "), and every code still does");
  const v = encIn({ x: 0.6, y: 0, sprint: true });
  check(!decIn(v).sprint, "a sprint press short of a full push is sent as a plain frame");
  let same = true;
  for (let v = 0; v < C.IN_END; v++) {
    if (!Q.codeOk(v)) continue;
    const a = decIn(v), b = Q.decIn(v);
    for (const k of ["x", "y", "jump", "light", "heavy", "special", "dodge", "ulti", "sprint"]) if (!!a[k] !== !!b[k] && a[k] !== b[k]) { same = false; console.log("  quick.js decodes", v, "differently:", k); break; }
  }
  const okCodes = [...Array(C.IN_END).keys()].filter(Q.codeOk);
  check(same && Q.codeOk(C.SPRINT_BASE) && Q.codeOk(C.IN_END - 1) && !Q.codeOk(C.FOCUS_BASE) && !Q.codeOk(C.IN_END) && okCodes.length === C.FOCUS_BASE + 18,
    "the Ranked referee (quick.js) takes the sprint codes and decodes them like the page");
}
console.log(bad ? `sprint FAILED (${bad})` : "sprint ok");
process.exit(bad ? 1 : 0);
