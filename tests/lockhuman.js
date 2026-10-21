// How long a light-attack spammer keeps a human defender pinned.
// Attacker: presses Light whenever the defender is in range (mashing), otherwise walks in.
// Defender: reacts R frames after it becomes free (reaction time + online input delay),
// then performs one escape: jump away, roll away (dodge + away), or jab back. Holds away meanwhile.
// "Escaped" = 90 frames with no hit landed. Reports hits landed and seconds pinned.
const { BL } = require(process.env.CORE || "../game/core.js");
const { FIGHTERS, newGame, step } = BL;
function run(attId, defId, esc, R, pct, move) {
  const A = FIGHTERS.find((f) => f.id === attId), D = FIGHTERS.find((f) => f.id === defId);
  const g = newGame({ seed: 1, players: [{ spec: A, pal: A.palettes[0] }, { spec: D, pal: D.palettes[0] }], countdown: 0 });
  const a = g.fighters[0], d = g.fighters[1];
  a.x = -40; d.x = 10; a.facing = 1; d.facing = -1; d.percent = pct;
  let hits = 0, lastHit = -1, free = 0, acted = false, first = -1, launches = 0;
  for (let t = 0; t < 60 * 20; t++) {
    const ia = {}, id = {};
    const dx = d.x - a.x, away = Math.sign(dx) || 1;
    const inRange = Math.abs(dx) < 52 && Math.abs(d.y - a.y) < 40;
    if (inRange) { ia.light = t % 2 === 0; if (move === "side") ia.x = away; if (move === "down") ia.y = 1; }
    else ia.x = away;
    if (first >= 0) {
      if (BL.canAct(d) && g.hitstop === 0) free++; else if (d.state === "hitstun") { free = 0; acted = false; }
      if (free >= 1) id.x = away;
      if (free >= R && !acted) {
        acted = true;
        if (esc === "jump") { id.jump = true; id.x = away; }
        else if (esc === "roll") { id.dodge = true; id.x = away; }
        else if (esc === "jab") { id.light = true; id.x = 0; }
      }
    }
    const before = d.percent, st0 = d.stocks;
    step(g, [ia, id]);
    for (const e of g.events) if (e.type === "hit" && e.slot === 0 && e.finisher) launches++;
    g.events.length = 0;
    if (d.percent > before) { hits++; lastHit = t; if (first < 0) first = t; }
    if (d.stocks < st0) return { hits, secs: (t - first) / 60, ko: true, launches };
    if (first >= 0 && t - lastHit >= 90) return { hits, secs: (lastHit - first) / 60, ko: false, launches };
  }
  return { hits, secs: 20, ko: false, launches, stuck: true };
}
const R = +(process.argv[2] || 14), move = process.argv[3] || "jab";
const atts = FIGHTERS.map((f) => f.id);
console.log(`reaction+delay ${R} frames, attacker spams ${move}. cells: hits before escape (seconds pinned), worst over defenders and 0/30/60%`);
for (const esc of ["jump", "roll", "jab"]) {
  console.log(`\ndefender escape: ${esc}`);
  for (const att of atts) {
    const row = [];
    for (const pct of [0, 30, 60]) {
      let worst = null;
      for (const def of atts) { const r = run(att, def, esc, R, pct, move); if (!worst || r.hits > worst.hits) worst = Object.assign({ def }, r); }
      row.push(`${pct}%: ${String(worst.hits).padStart(2)} (${worst.secs.toFixed(1)}s${worst.ko ? ", KO" : ""}${worst.stuck ? ", 20s+" : ""}) vs ${worst.def}`);
    }
    console.log(att.padEnd(10), row.join(" | "));
  }
}
