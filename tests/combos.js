// Combo routes (the link): every fighter plays each of its routes (its own + the five shared ones) against a standing CPU
// and against one that escapes (jumps away, or air dodges, the first frame it can act), at several damage percents.
//   node combos.js           the table + "combos ok" when every route lands on the standing CPU at 0%, up up jump nair (the pop-up) lands, the link makes
//                            light, light, heavy/special a true combo at low percent, the jump routes land at human reaction speed and nothing loops
//   node combos.js <fighter> <route> <pct> [escape]   one run, frame by frame
const { BL } = require(process.env.CORE || "../game/core.js");
const ROUTES = require("../game/routes.js");
const { FIGHTERS, newGame, step } = BL;
const FIG = Object.fromEntries(FIGHTERS.map((f) => [f.id, f]));
const LIGHT = new Set(["jab", "side", "up", "down", "nair", "sair", "uair", "dair"]);

const pcts = [0, 30, 50, 70, 90, 120];
// what to press for one route step: [button, stick y, stick x toward the defender?]
function press(k) {
  const key = k.replace("!", "");
  if (key === "jump") return ["jump", 0, false];
  if (key === "spec") return ["special", 0, false];
  const b = key[0] === "h" ? "heavy" : "light", base = key[0] === "h" ? key[1].toLowerCase() + key.slice(2) : key;
  const dir = base === "side" || base === "sair" ? "side" : base === "up" || base === "uair" ? "up" : base === "down" || base === "dair" ? "down" : "n";
  return [b, dir === "up" ? -1 : dir === "down" ? 1 : 0, dir === "side"];
}
const moveKey = (k, air) => {
  k = k.replace("!", "");
  if (k === "spec") return "spec";
  if (k === "hUp" && air) return "rec";
  if (k === "air") return "nair";
  return k;
};
const isMove = (k, mid, air) => (k === "air" ? ROUTES.stepOk("air", mid || "") : mid === moveKey(k, air));

// how close (feet to feet) the move's hitboxes reach a defender
function reach(A, D, k, grounded) {
  const m = A.moves[moveKey(k, !grounded)];
  if (!m || !m.boxes || !m.boxes.length) return 160;   // projectiles and dashes: from anywhere near
  return Math.max(...m.boxes.map((b) => Math.max(b.x + b.r, b.x2 + b.r))) + D.stats.w / 2 - 6;
}
// plays one route; escape: 0 none (stands), 1 jumps away the first frame it can act, 2 dodges away the first frame it can act
// a player spaces the opener: the route counts as landing if it lands from any of a few starting gaps and walk-in margins
const SPACINGS = [[42, 0], [42, 14], [26, 0], [60, 8], [60, 24]];
function tryRun(fid, route, pct, escape) { return SPACINGS.some(([g, m]) => run(fid, "odin", route, pct, escape, false, true, g, m)); }
function land(fid, route, pct, escape) { return SPACINGS.some(([g, m]) => run(fid, "odin", route, pct, escape, false, false, g, m)); }
function run(fid, oppId, route, pct, escape, trace, anyRoute, gap = 42, margin = 0, stopAt = 0) {
  const A = FIG[fid], D = FIG[oppId];
  const g = newGame({ players: [{ spec: A, pal: A.palettes[0] }, { spec: D, pal: D.palettes[0] }], countdown: 0, seed: 7 });
  const a = g.fighters[0], d = g.fighters[1];
  step(g, [BL.blankInput(), BL.blankInput()]);   // countdown 0 still takes one frame to turn into play
  a.x = -gap / 2; d.x = gap / 2; a.facing = 1; d.facing = -1; d.percent = pct;
  const keys = route.keys, tr = {};
  let nHits = 0, pressT = -99, i = 0, pend = false, started = false, held = 0, pressedLast = false, got = null, firstHit = false, hitsOk = 0, wasStun = false, maxCombo = 0;
  const startT = new Set();
  for (let t = 0; t < 400 && i <= keys.length; t++) {
    const ia = BL.blankInput(), id = BL.blankInput();
    if (i < keys.length) {
      const k = keys[i], [btn, y, side] = press(k);
      const toward = Math.sign(d.x - a.x) || 1;
      // walk in until close enough for the opener
      const far = Math.abs(d.x - a.x) - Math.abs(a.vx) * 5 + margin > reach(A, D, k, a.grounded);
      if (!started && far && a.grounded && k !== "jump" && !(i > 0 && a.link > 0)) { if (BL.canAct(a)) ia.x = toward; }
      else if (k === "jump") { if (!pressedLast) ia.jump = true; if (nHits >= 3) ia.x = toward; }
      else {
        const charged = k.endsWith("!");
        if (started && charged && btn === "heavy") { ia.heavy = held < 14; held++; }
        else if (!pend || t - pressT > 6) { ia[btn] = true; pend = true; pressT = t; }
        ia.y = y; if (side) ia.x = toward;
        else if (!a.grounded && nHits >= 3 && Math.abs(d.x - a.x) > 12) ia.x = toward * (y ? 0.9 : 1);   // chase a launch in the air
      }
      if (k === "jump" && !a.grounded) { i++; started = false; }
    }
    // defender escape: the first frame it can act after a hit (outside hitstop)
    if (escape && nHits >= 2 && wasStun && BL.canAct(d) && g.hitstop === 0) {
      const away = Math.sign(d.x - a.x) || 1;
      if (escape === 1) { id.jump = true; id.x = away; } else { id.dodge = true; id.x = away; }
    }
    if (d.state === "hitstun" && nHits >= 2) wasStun = true;
    pressedLast = ia.light || ia.heavy || ia.special || ia.jump;
    const mt0 = a.moveT;
    step(g, [ia, id]);
    if (i < keys.length && keys[i] !== "jump" && a.moveT !== mt0 && isMove(keys[i], a.mid, !a.grounded)) { started = true; pend = false; startT.add(a.moveT); }
    for (const e of g.events) {
      if (e.type !== "hit" || e.slot !== 0) continue;
      const r = ROUTES.track(tr, e, fid);
      maxCombo = Math.max(maxCombo, e.combo);
      if (trace) console.log(t, e.mv, "combo", e.combo, "dmg", e.dmg, "kb", e.kb.toFixed(1), "link", e.link, "lk", e.lk, "chg", e.chg, r ? r.name : "");
      if (r && r.id === route.id) got = { combo: e.combo, t };
      if (anyRoute && nHits + 1 === route.keys.filter((k) => k !== "jump").length && e.mi === a.moveT && started && e.combo === nHits + 1) got = { combo: e.combo, t };
      if (i < keys.length && e.mi === a.moveT && started) { nHits++; i++; started = false; held = 0; while (keys[i] === "jump" && false) i++; }
    }
    g.events.length = 0;
    if (stopAt && nHits >= stopAt) return g;
    if (trace && t % 1 === 0) console.log(" ", t, "A", a.state, a.mid, a.mt, "link", a.link, "| D", d.state, d.hitstun, d.x.toFixed(0), d.y.toFixed(0), "hs", g.hitstop);
    if (got) break;
    if (d.stocks < 3) break;
  }
  return got;
}

if (process.argv[2] === "try") {   // node combos.js try up,up,jump,nair [fighters]: a candidate route on every (or the listed) fighter
  const r = { id: "try", name: "try", keys: process.argv[3].split(",") };
  const real = ROUTES.track; ROUTES.track = (t, e, fid) => { const x = real(t, e, fid); t.n = (t.n || 0); return null; };
  for (const f of FIGHTERS.filter((f) => !process.argv[4] || process.argv[4].split(",").includes(f.id))) {
    const cells = pcts.map((p) => { const s = tryRun(f.id, r, p, 0), j = tryRun(f.id, r, p, 1), dd = tryRun(f.id, r, p, 2); return (s ? "S" : "-") + (j ? "J" : "-") + (dd ? "D" : "-"); });
    console.log(f.id.padEnd(12) + cells.map((c) => c.padStart(6)).join(""));
  }
  process.exit(0);
}
if (process.argv[2]) {
  const [fid, rid, pct, esc] = process.argv.slice(2);
  const r = ROUTES.byId(rid);
  console.log(run(fid, "odin", r, +pct || 0, +esc || 0, true));
  process.exit(0);
}

let bad = [];
console.log("route lands against a standing CPU (S) / a CPU that jumps away (J) / dodges away (D) when it can act, from the 2nd hit on; columns = damage %");
console.log("fighter     route          trial " + pcts.map((p) => String(p).padStart(6)).join(""));
for (const f of FIGHTERS) {
  for (const r of ROUTES.forFighter(f.id)) {
    const cells = pcts.map((p) => (land(f.id, r, p, 0) ? "S" : "-") + (land(f.id, r, p, 1) ? "J" : "-") + (land(f.id, r, p, 2) ? "D" : "-"));
    const trial = land(f.id, r, r.pct, 0);
    console.log(f.id.padEnd(12) + r.name.padEnd(15) + (trial ? " ok  " : " NO  ") + String(r.pct).padStart(3) + cells.map((c) => c.padStart(6)).join(""));
    if (!trial) bad.push(`${f.id} ${r.name} does not land on the trial's standing CPU at ${r.pct}%`);
  }
  // the link: light, light, special is a true combo at low damage (no escape between the 2nd light and the special)
  const sig = ROUTES.byId("sig");
  for (const p of [0, 30]) for (const e of [1, 2]) if (!land(f.id, sig, p, e)) bad.push(`${f.id}: Signature is escapable at ${p}% (${e === 1 ? "jump" : "dodge"})`);
  // the pop-up (TUNE.linkPop): up light, up light, jump, neutral air is a true combo at 0% (Odin's up light is too slow to chain
  // into itself at 0%, so his starts at 30%)
  const pop = { id: "pop", name: "pop-up", keys: ["up", "up", "jump", "nair"] };
  for (const p of f.id === "odin" ? [30, 50] : [0, 30, 50]) for (const e of [0, 1, 2]) if (!tryRun(f.id, pop, p, e)) bad.push(`${f.id}: up, up, jump, nair misses at ${p}% (escape ${e})`);
}
// the jump routes at human speed: from the route's 2nd hit, a player who sees it land presses Jump 9-15 frames later (a normal tap,
// held 5 frames: a full hop; the link turns it into a short hop) and the air attack 4-12 frames after that. Rising takes any light
// air attack (stick toward them here), Skyburn the Heavy air with the stick let go. Most of that box must land as a true combo.
function humanBox(fid, route) {
  const lead = route.keys.slice(0, 2), heavy = route.keys[3] === "hAir";
  let g0 = null;
  for (const [gp, m] of SPACINGS) if ((g0 = run(fid, "odin", { id: "x", keys: lead }, route.pct, 0, false, false, gp, m, 2))) break;
  if (!g0) return 0;
  const s = BL.serialize(g0);
  let ok = 0, n = 0;
  for (let j = 9; j <= 15; j++) for (let at = 4; at <= 12; at++) {
    const g = newGame({ players: [{ spec: FIG[fid], pal: FIG[fid].palettes[0] }, { spec: FIG.odin, pal: FIG.odin.palettes[0] }], countdown: 0, seed: 7 });
    BL.restore(g, s); n++;
    const a = g.fighters[0], d = g.fighters[1], toward = Math.sign(d.x - a.x) || 1;
    for (let t = 1, done = false; t <= 70 && !done; t++) {
      const ia = BL.blankInput();
      if (t >= j && t < j + 5) ia.jump = true;
      if (t >= j + at && t < j + at + 4) ia[heavy ? "heavy" : "light"] = true;
      if (!heavy && t >= j + at) ia.x = toward;
      step(g, [ia, BL.blankInput()]);
      for (const e of g.events) if (e.type === "hit" && e.slot === 0 && e.combo >= 3 && ROUTES.stepOk(route.keys[3], e.mv)) { ok++; done = true; break; }
      g.events.length = 0;
    }
  }
  return ok / n;
}
for (const [fid, rid] of [...FIGHTERS.map((f) => [f.id, "rising"]), ["phoenix", "skyburn"]]) {
  const r = ROUTES.byId(rid), share = humanBox(fid, r);
  console.log(`${r.name} by ${fid} at human speed (jump 9-15 frames after the hit): ${Math.round(share * 100)}% of tries land`);
  if (share < 0.75) bad.push(`${fid}: ${r.name} lands only ${Math.round(share * 100)}% of the time at human speed`);
}
// combo damage: hits from the 4th of a combo deal 85%, from the 6th 70%
{
  const g = newGame({ players: [{ spec: FIG.samurai, pal: FIG.samurai.palettes[0] }, { spec: FIG.odin, pal: FIG.odin.palettes[0] }], countdown: 0 });
  step(g, [BL.blankInput(), BL.blankInput()]);
  const a = g.fighters[0], d = g.fighters[1], got = [];
  a.x = -20; d.x = 22;
  for (let n = 1; n <= 7; n++) {
    a.state = "attack"; a.move = FIG.samurai.moves.hSide; a.mid = "hSide"; a.mt = a.move.startup; a.moveT = n; a.hitLog = {}; a.chg = 0;
    d.state = "hitstun"; d.freeT = 0; d.x = 22; d.y = 0; d.grounded = true; d.invuln = 0;
    const p0 = d.percent; g.hitstop = 0;
    step(g, [BL.blankInput(), BL.blankInput()]); g.events.length = 0;
    got.push(d.percent - p0);
  }
  const base = FIG.samurai.moves.hSide.dmg, want = [1, 1, 1, 0.85, 0.85, 0.7, 0.7].map((k) => Math.round(base * k));
  console.log("combo damage per hit:", got.join(" "), "(want", want.join(" ") + ")");
  if (got.join() !== want.join()) bad.push("combo damage scaling is off");
}
if (bad.length) { console.log(bad.join("\n")); console.log("combos FAIL"); }
else console.log("combos ok");
