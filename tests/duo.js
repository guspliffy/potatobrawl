// 2v2 (Team Brawl, ui/duo.js): four fighters in two teams, no boss. The rules are core.js's teamGame parts, the CPUs BL.teamBotInput.
//   node duo.js                  the check (check.sh step 3g): prints "duo ok" when all of these hold
//     - replay determinism and save/restore with four fighters
//     - each team starts and respawns on its own side; no friendly fire
//     - a time-out goes to the team with more hearts left; a tie is sudden death for everyone still in; a second time-out is a draw
//     - the Catch: a free teammate touching a tumbling one ends the launch; never on the final launch, never by a foe, never in 1v1 or a
//       boss fight, and the catcher waits its cooldown
//     - mirrored CPU teams (every pick plays twice, sides swapped): each side wins 44-56%, every fighter's 2v2 win rate is 38-64%,
//       matches last 50-200 s on average
//   node duo.js <pairs> [levels]  the balance numbers only (levels: CPU strengths, comma-separated; default 0.5,0.8)
const BL = require("../game/core.js").BL;
const F = BL.FIGHTERS, T = BL.TUNE;
const fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };
const quad = (pick, team = [0, 0, 1, 1]) => pick.map((s, i) => ({ spec: s, pal: s.palettes[i % 2], team: team[i] }));
const game = (pick, seed, map, o) => BL.newGame(Object.assign({ players: quad(pick), seed, stocks: 3, time: 240, countdown: 30, map }, o || {}));
const blank = (g) => g.fighters.map(() => BL.blankInput());
// a game already in play (countdown 0 still takes one step to start)
const live = (pick, seed, map, o) => { const g = game(pick, seed, map, Object.assign({ countdown: 0 }, o || {})); BL.step(g, blank(g)); g.events.length = 0; return g; };
const run = (g, bots, frames, cb) => {
  for (let t = 0; t < frames && g.phase !== "over"; t++) {
    BL.step(g, g.fighters.map((f, i) => BL.teamBotInput(g, f, bots[i])));
    if (cb) cb(g);
    g.events.length = 0;
  }
};
const botsFor = (g, d) => g.fighters.map((f) => BL.makeBot(d, BL.BOT_STYLES[f.spec.id]));

/* ----- determinism: the same seed plays the same match; a saved match restored into a fresh game plays on the same ----- */
{
  let bad = 0, n = 0;
  for (let s = 1; s <= 4; s++) {
    const pick = [F[s % 8], F[(s * 3 + 1) % 8], F[(s * 5 + 2) % 8], F[(s * 7 + 3) % 8]];
    const sums = [[], []];
    for (const k of [0, 1]) { const g = game(pick, s, s % 4); run(g, botsFor(g, 0.7), 60 * 60 * 6, (h) => { if (h.t % 97 === 0) sums[k].push(BL.checksum(h)); }); }
    if (sums[0].join() !== sums[1].join()) { bad++; console.log("replay differs, seed", s); }
    const g1 = game(pick, s, s % 4), bots = botsFor(g1, 0.7);
    run(g1, bots, 1500);
    const g2 = game(pick, 999, s % 4, { countdown: 0 });
    BL.restore(g2, JSON.parse(JSON.stringify(BL.serialize(g1))));
    for (let t = 0; t < 1500 && g1.phase !== "over"; t++) {
      const ins = g1.fighters.map((f, i) => BL.teamBotInput(g1, f, bots[i]));
      BL.step(g1, ins); BL.step(g2, ins); g1.events.length = 0; g2.events.length = 0; n++;
      if (BL.checksum(g1) !== BL.checksum(g2)) { bad++; console.log("save/restore differs, seed", s, "frame", t); break; }
    }
  }
  console.log(`determinism: ${bad} mismatches (4 replays, ${n} restored frames)`);
  check(bad === 0, "determinism");
}

/* ----- sides: spawns, respawns, no friendly fire ----- */
{
  const pick = [F[0], F[1], F[2], F[3]];
  for (let m = 0; m < BL.POOL; m++) {
    const g = game(pick, 5, m, { countdown: 0 });
    const xs = g.fighters.map((f) => f.x);
    check(xs[0] < 0 && xs[1] < 0 && xs[2] > 0 && xs[3] > 0 && xs[0] !== xs[1] && xs[2] !== xs[3], `spawns on map ${m}: ${xs}`);
    check(g.fighters.every((f) => f.x > BL.STAGE.main.x1 + 20 && f.x < BL.STAGE.main.x2 - 20 && f.facing === (f.team ? -1 : 1)), `spawns on map ${m} inside the floor, facing in`);
  }
  // knock your partner and a foe off: each respawns over its own team's side
  const g = game(pick, 5, 0, { countdown: 0 });
  g.fighters[1].x = -2000; g.fighters[3].x = 2000;
  const seen = {};
  for (let t = 0; t < 200; t++) { BL.step(g, blank(g)); for (const f of g.fighters) if (f.state === "respawn" && !(f.slot in seen)) seen[f.slot] = f.x; g.events.length = 0; }
  check(seen[1] < 0 && seen[3] > 0, `respawn sides: partner ${seen[1]}, foe ${seen[3]}`);
  // no friendly fire: a heavy into your partner does nothing; into a foe it hits
  for (const [who, hurt] of [[1, false], [2, true]]) {
    const h = game(pick, 6, 0, { countdown: 0 });
    for (const f of h.fighters) { f.x = 400 + f.slot * 1000; }
    h.fighters[0].x = 0; h.fighters[0].facing = 1; h.fighters[who].x = 34;
    for (let t = 0; t < 60; t++) { const ins = blank(h); ins[0].heavy = t < 3; ins[0].x = t < 3 ? 1 : 0; BL.step(h, ins); h.events.length = 0; }
    check((h.fighters[who].percent > 0) === hurt, `friendly fire: a heavy into slot ${who} ${hurt ? "must" : "must not"} hurt (${h.fighters[who].percent}%)`);
  }
}

/* ----- time-out ----- */
{
  const pick = [F[4], F[5], F[6], F[7]];
  const timeout = (stocks) => {
    const g = live(pick, 7, 1, { time: 10 });
    stocks.forEach((s, i) => { g.fighters[i].stocks = s; if (!s) g.fighters[i].state = "gone"; });
    g.timer = 1; BL.step(g, blank(g));
    return g;
  };
  const a = timeout([3, 1, 2, 1]);
  check(a.phase === "end" && a.winner === 0 && a.endReason === "time", "time-out: 4 hearts beat 3");
  const b = timeout([0, 2, 1, 2]);
  check(b.phase === "end" && b.winner === 1, "time-out: 2 hearts lose to 3");
  const c = timeout([0, 2, 1, 1]);
  check(c.phase === "play" && c.sudden && c.fighters[0].state === "gone" && c.fighters.slice(1).every((f) => f.stocks === 1 && f.percent === 150 && f.state === "idle"),
    "time-out tie: sudden death for the three still in at 150%, the one already out stays out");
  check(c.fighters[1].x < 0 && c.fighters[2].x > 0 && c.fighters[3].x > 0 && c.fighters[2].x !== c.fighters[3].x, "sudden death: everyone on their own side");
  c.timer = 1; BL.step(c, blank(c));
  check(c.phase === "end" && c.winner === -1, "sudden death runs out: a draw");
}

/* ----- the Catch ----- */
{
  const pick = [F[2], F[0], F[1], F[3]];
  // slot `t` tumbling past slot `c` in the air (both at y -120, overlapping)
  const setup = (g, c, t, o) => {
    const S = BL.STAGE.main;
    for (const f of g.fighters) { f.x = 300; f.y = 0; }
    g.fighters.forEach((f, i) => { if (i !== c && i !== t) f.x = (i % 2 ? -1 : 1) * (S.x2 - 30); });
    const C = g.fighters[c], U = g.fighters[t];
    Object.assign(C, { x: 0, y: -120, grounded: false, plat: -1, state: "air", st: 5, vx: 0, vy: 0 });
    Object.assign(U, { x: 12, y: -120, grounded: false, plat: -1, state: "hitstun", st: T.catchAfter + 2, hitstun: 40, tumble: true, kbx: 9, kby: -3, vx: 0, vy: 0 }, o || {});
  };
  const one = (g) => { BL.step(g, blank(g)); const ev = g.events.filter((e) => e.type === "catch"); g.events.length = 0; return ev; };
  let g = live(pick, 9, 0);
  setup(g, 0, 1);
  let ev = one(g);
  const U = g.fighters[1];
  check(ev.length === 1 && ev[0].slot === 1 && ev[0].by === 0, "Catch: a free partner touching a tumbling one catches it");
  check(U.state === "air" && U.hitstun === 0 && !U.tumble && Math.abs(U.kbx) < 9 * 0.6 && U.invuln === 0, `Catch: the launch ends, speed halves, no free invincibility (${U.state} kbx ${U.kbx.toFixed(2)} inv ${U.invuln})`);
  check(g.fighters[0].catchCd === T.catchCd && g.fighters[0].ult > 0 && U.ult > 0, "Catch: the catcher waits its cooldown; both get ulti");
  setup(g, 0, 1); ev = one(g);
  check(ev.length === 0, "Catch: not again during the cooldown");
  g = live(pick, 9, 0); setup(g, 0, 1, { doomed: true }); ev = one(g);
  check(ev.length === 0, "Catch: never on the final launch");
  g = live(pick, 9, 0); setup(g, 0, 1, { st: 2 }); ev = one(g);
  check(ev.length === 0, "Catch: not in the first frames of a launch");
  g = live(pick, 9, 0); setup(g, 2, 1); ev = one(g);
  check(ev.length === 0 && g.fighters[1].state === "hitstun", "Catch: a foe never catches you");
  // 1v1 and a boss fight: no Catch (the partner in a boss fight included)
  const g1 = BL.newGame({ players: [{ spec: F[0], pal: F[0].palettes[0] }, { spec: F[1], pal: F[1].palettes[1] }], seed: 9, countdown: 0 });
  check(!BL.teamGame(g1), "1v1 is not a team game");
  const B = BL.BOSSES[0], gb = BL.newGame({ players: [{ spec: F[0], pal: F[0].palettes[0] }, { spec: F[1], pal: F[1].palettes[1] }, { spec: B, pal: B.palettes[0] }], seed: 9, countdown: 0, time: 0, map: BL.MAPS.findIndex((m) => m.id === B.map) });
  BL.step(gb, blank(gb)); gb.events.length = 0;
  Object.assign(gb.fighters[2], { x: 300 });
  Object.assign(gb.fighters[0], { x: 0, y: -120, grounded: false, plat: -1, state: "air", st: 5 });
  Object.assign(gb.fighters[1], { x: 12, y: -120, grounded: false, plat: -1, state: "hitstun", st: T.catchAfter + 2, hitstun: 40, tumble: true, kbx: 9, kby: -3 });
  ev = one(gb);
  check(!BL.teamGame(gb) && ev.length === 0, "boss fight: no Catch");
}

/* ----- mirrored CPU teams: sides, fighters, lengths ----- */
function balance(N, D) {
  let r = 11;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const side = [0, 0, 0], fw = {}, fn = {};
  let secs = 0, games = 0, caught = 0, kos = 0;
  for (let n = 0; n < N; n++) {
    const pick = [0, 1, 2, 3].map(() => F[Math.floor(rnd() * F.length)]), d = D[n % D.length];
    for (const sw of [0, 1]) {
      const p = sw ? [pick[2], pick[3], pick[0], pick[1]] : pick;
      const g = game(p, n * 2 + sw + 1, n % BL.POOL);
      run(g, botsFor(g, d), 60 * 60 * 8, (h) => { for (const e of h.events) { if (e.type === "catch") caught++; if (e.type === "ko") kos++; } });
      side[g.winner === 0 ? 0 : g.winner === 1 ? 1 : 2]++;
      p.forEach((s, i) => { fn[s.id] = (fn[s.id] || 0) + 1; if (g.winner === (i < 2 ? 0 : 1)) fw[s.id] = (fw[s.id] || 0) + 1; });
      secs += g.t / 60; games++;
    }
  }
  const rates = F.map((f) => [f.id, (100 * (fw[f.id] || 0)) / (fn[f.id] || 1)]);
  console.log(`${games} games at ${D.join(",")}: left side wins ${((100 * side[0]) / games).toFixed(1)}%, draws ${side[2]}, ${(secs / games).toFixed(0)} s a match, ` +
    `${(caught / games).toFixed(1)} Catches and ${(kos / games).toFixed(1)} KOs a match`);
  console.log(rates.map(([id, v]) => `${id} ${v.toFixed(1)}%`).join("  "));
  return { left: (100 * side[0]) / games, rates, secs: secs / games, caught: caught / games };
}
if (process.argv[2]) { balance(+process.argv[2], (process.argv[3] || "0.5,0.8").split(",").map(Number)); process.exit(0); }
{
  const b = balance(200, [0.5, 0.8]);   // 200 pairs: at 100 the Reaper sat on the band's edge (38.0%, and 37.0% with the sprint) while 1000 pairs put him at 46-48%
  check(b.left >= 44 && b.left <= 56, `sides: the left team wins ${b.left.toFixed(1)}% (want 44-56%)`);
  for (const [id, v] of b.rates) check(v >= 38 && v <= 64, `${id} wins ${v.toFixed(1)}% of 2v2s (want 38-64%)`);
  check(b.secs >= 50 && b.secs <= 200, `matches last ${b.secs.toFixed(0)} s (want 50-200)`);
  check(b.caught >= 1 && b.caught <= 12, `${b.caught.toFixed(1)} Catches a match (want 1-12)`);
}
if (fails.length) { console.log("duo FAIL:\n  " + fails.join("\n  ")); process.exit(1); }
console.log("duo ok");
