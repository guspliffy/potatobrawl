// Finish mode, charged heavies and the KO-at-the-hit check (core.js). Prints PASS/FAIL lines and "finish ok".
// Usage: node finish.js [matches]
const { BL } = require(process.env.CORE || "../game/core.js");
const { FIGHTERS, TUNE, newGame, step, makeBot, botInput, blankInput } = BL;
const byId = (id) => FIGHTERS.find((f) => f.id === id);
let bad = 0;
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) bad++; };

// a defender that steers home, jumps and uses its recovery: the hit only counts if that still dies
function defend(d, t, hit) {
  const i = blankInput();
  if (!hit) return i;
  i.x = d.x > 0 ? -1 : 1;
  if (d.state === "air" && !d.grounded) {
    if (d.airJumps > 0 && d.vy > -2 && (t & 1)) i.jump = true;
    else if (d.airJumps === 0 && !d.recUsed && (t & 1)) { i.heavy = true; i.y = -1; }
  }
  return i;
}
// one move from the attacker at x=-60 against a defender at pct; hold = frames to keep the button down
function trial(att, def, key, pct, hold) {
  const g = newGame({ players: [{ spec: att, pal: att.palettes[0] }, { spec: def, pal: def.palettes[0] }], seed: 1, countdown: 0, stocks: 2 });
  g.phase = "play";
  const [a, d] = g.fighters, m = att.moves[key];
  a.x = -60; a.facing = 1;
  d.x = a.x + (m.kind === "projectile" ? 110 : m.kind === "dash" ? 90 : Math.max(30, m.boxes[0] ? Math.max(m.boxes[0].x, m.boxes[0].x2) : 30));
  d.facing = -1; d.percent = pct;
  const r = { hit: null, ko: false, lethal: false, t: -1 };
  for (let t = 0; t < 420; t++) {
    const i0 = blankInput();
    if (t <= (hold || 0)) { if (key === "spec") i0.special = true; else { i0.heavy = true; if (key === "hUp") i0.y = -1; if (key === "hDown") i0.y = 1; } }
    step(g, [i0, defend(d, t, !!r.hit)]);
    for (const e of g.events) {
      if (e.type === "hit" && e.def === 1 && !r.hit) { r.hit = e; r.t = t; }
      if (e.type === "ko" && e.slot === 1) r.ko = true;
      if (e.type === "lethal" && e.slot === 1) r.lethal = true;
    }
    g.events.length = 0;
    if (r.ko || (t > 120 && !r.hit)) break;
  }
  return r;
}

// 1. Finish mode: every special KOs every weight class from the centre at finishPct, and not just below it.
const P = TUNE.finishPct;
for (const f of FIGHTERS) {
  const lo = FIGHTERS.filter((d) => trial(f, d, "spec", P - 5).ko).map((d) => d.id);
  const at = FIGHTERS.filter((d) => !trial(f, d, "spec", P).ko).map((d) => d.id);
  check(!lo.length && !at.length, `${f.id} special: KOs everyone at ${P}%, nobody at ${P - 5}%` + (lo.length ? ` (KO at ${P - 5}%: ${lo})` : "") + (at.length ? ` (survive ${P}%: ${at})` : ""));
}

// 2. Charge: a tap is unchanged; a full hold waits chgMax frames and hits for round(dmg * (1 + chgDmg)).
for (const f of FIGHTERS) {
  const m = f.moves.hSide, tap = trial(f, byId("wizard"), "hSide", 0, 0), full = trial(f, byId("wizard"), "hSide", 0, 200);
  const want = Math.round(m.dmg * (1 + TUNE.chgDmg));
  check(tap.hit && tap.hit.dmg === m.dmg && tap.t === m.startup + 1 && full.hit && full.hit.dmg === want && full.t === m.startup + 1 + TUNE.chgMax,
    `${f.id} side heavy: tap ${tap.hit && tap.hit.dmg} dmg on frame ${tap.t}, full charge ${full.hit && full.hit.dmg} dmg on frame ${full.t} (want ${m.dmg}@${m.startup + 1}, ${want}@${m.startup + 1 + TUNE.chgMax})`);
}

// 3. KO at the hit, in bot matches: a lethal call on an earlier life must really end in that KO, and a lethal
//    call on the last life must end the match on that frame.
let calls = 0, finals = 0, wrong = 0, endsAtHit = 0, otherEnds = 0;
const N = +(process.argv[2] || 30);
for (let seed = 1; seed <= N; seed++) {
  const n = FIGHTERS.length, a = FIGHTERS[seed % n], b = FIGHTERS[(seed + 1 + (seed * 5) % (n - 1)) % n];   // every pair, never a mirror match
  const g = newGame({ players: [{ spec: a, pal: a.palettes[0] }, { spec: b, pal: b.palettes[0] }], seed, countdown: 10 });
  const bots = [makeBot(0.85), makeBot(0.6)], open = [null, null];
  for (let t = 0; t < 20000 && g.phase !== "over"; t++) {
    step(g, [botInput(g, g.fighters[0], g.fighters[1], bots[0]), botInput(g, g.fighters[1], g.fighters[0], bots[1])]);
    for (const e of g.events) {
      if (e.type === "lethal") { calls++; if (e.final) finals++; else open[e.slot] = true; }
      if (e.type === "ko" && open[e.slot]) open[e.slot] = null;
      if (e.type === "hit" && open[e.def] && !e.armor) { wrong++; open[e.def] = null; } // hit again before the KO: the call was wrong
      if (e.type === "game") { if (e.hit) endsAtHit++; else otherEnds++; }
    }
    for (const s of [0, 1]) { const f = g.fighters[s]; if (open[s] && f.grounded && f.state !== "hitstun") { wrong++; open[s] = null; } }
    g.events.length = 0;
  }
}
console.log(`lethal calls ${calls} (last life ${finals}), wrong ${wrong}; matches ended at the hit ${endsAtHit}, other endings ${otherEnds}`);
check(wrong === 0, "every lethal call ended in that KO");
check(endsAtHit > N / 2, "most matches end at a lethal hit");
if (!bad) console.log("finish ok");
