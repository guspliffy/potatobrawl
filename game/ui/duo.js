/* ===================== 2v2 (Team Brawl): you and a CPU partner against two CPUs, offline =====================
   The rules are in core.js (teamGame: spawn and respawn sides, time-out by team hearts, sudden death for four, the Catch) and the
   CPUs are BL.teamBotInput. Here: starting the match, the inputs, the Focus command, the results and the rewards.
   Slots: 0 = you, 1 = your partner (team 0), 2 and 3 = the foes (team 1). Design: /mnt/project-files/2v2/fable-2v2.md (Fable). */
const DUO_TEAMS = ["Salt & Vinegar", "Mash & Gravy", "Chip & Dip", "Fish & Chips", "Cheese & Onion", "Bangers & Mash", "Crisp & Crunch",
  "Hash & Brown", "Peel & Eat", "Twice & Baked"];
const DUO_FOCUS = 480;   // ticks the partner stays on a foe you point at (8 s)
const DUO_TITLE = 10;    // 2v2 wins for the title Dynamic Duo (acct.js)
const DUO_CHIPS = 20;    // chips for a win on Hard
let lastDuoTeam = "";
const duoTeamName = () => { let n; do n = DUO_TEAMS[(Math.random() * DUO_TEAMS.length) | 0]; while (n === lastDuoTeam); return (lastDuoTeam = n); };
// o: { partner: fighter id ("random" or missing: a random one), level: LEVELS index, map: a map index or "random" (arena maps stay out) };
// your fighter is the one picked on the select screen
function startDuo(o) {
  Sfx.init();
  const me = FIG[sel.fighter] || FIGHTERS[0], mine = P.pal[me.id] | 0;
  const mate = FIG[o.partner] || cpuFoe(me), a = cpuFoe(me);
  let b = cpuFoe(me);
  while (b.id === a.id) b = cpuFoe(me);   // two different foes
  // nobody wears the skin of another fighter of the same kind on the stage (your own skin is yours)
  const used = [[me.id, mine]];
  const skin = (spec) => {
    let i = 0;
    while (i < chipN(spec) - 1 && used.some(([id, k]) => id === spec.id && k === i)) i++;
    used.push([spec.id, i]); return spec.palettes[i];
  };
  const lv = clamp(o.level | 0, 0, LEVELS.length - 1), d = LEVELS[lv].d;
  const pick = o.map === undefined || o.map === "random" ? -1 : o.map | 0;
  const map = BL.MAPS[pick] && BL.MAPS[pick].pool !== false ? pick : randMap();
  const players = [{ spec: me, pal: me.palettes[mine] || me.palettes[0] }, { spec: mate, pal: skin(mate) }, { spec: a, pal: skin(a) }, { spec: b, pal: skin(b) }];
  G = newGame({ players: players.map((p, i) => Object.assign(p, { team: i < 2 ? 0 : 1 })), stocks: 3, time: 240, countdown: 150, map });
  const names = ["You", cpuName(), cpuName(), cpuName()];
  match = { duo: true, level: LEVELS[lv].name, lv, d, cpu: names[1], names, team: duoTeamName(), caught: 0,
    bots: [null, ...[mate, a, b].map((s) => makeBot(d, BL.BOT_STYLES[s.id]))] };
  meSlot = 0;
  enterMatchUI();
}
// the four inputs: yours and the three CPUs'
function duoInputs(pi) { return [pi, ...[1, 2, 3].map((i) => BL.teamBotInput(G, G.fighters[i], match.bots[i]))]; }
// Focus: your partner goes after this foe for DUO_FOCUS ticks (tap a foe's card; Tab on a keyboard picks the next foe)
function duoFocus(slot) {
  const f = G && match && match.duo && G.fighters[slot], b = match && match.bots && match.bots[1];
  if (!f || f.team === 0 || f.state === "gone" || !b) return;
  b.focus = slot; b.focusT = G.t + DUO_FOCUS;
  Sfx.ui();
}
function duoFocusNext() {
  if (!(G && match && match.duo)) return;
  const b = match.bots[1], cur = b.focusT > G.t ? b.focus : -1;
  const foes = [2, 3].filter((i) => G.fighters[i].state !== "gone");
  if (foes.length) duoFocus(foes[(foes.indexOf(cur) + 1) % foes.length]);
}
// the foe the partner is on because you pointed at it (-1 = none): the ember ring on that foe's card
const duoFocused = () => (G && match && match.duo && match.bots[1].focusT > G.t ? match.bots[1].focus : -1);
// a Catch: the pop over the two (in the catcher's team colour), and your own Catches counted for Account > Stats
function duoEvent(g, e, live) {
  if (e.type !== "catch") return;
  chgPops.push({ x: e.x, y: e.y + 46, t: 0, pop: 1, col: g.fighters[e.by].team === g.fighters[meSlot].team ? TEAM_COL[0] : TEAM_COL[1], txt: "CAUGHT!" });
  Sfx.tone(520, 880, 0.14, "triangle", 0.05);
  if (live && match && match.duo && e.by === meSlot) match.caught++;
}
// team colours (Fable): ice blue for your team, ember red for the foes (rims, card edges, the Catch pop)
const TEAM_COL = ["#7fd4ff", "#ff6a4a"];

/* ----- the end of a 2v2: results, chips on Hard, the win and Catch counts (synced) and the title ----- */
function duoMatchEnd(forfeit) {
  const me = G.fighters[0], mate = G.fighters[1], foes = [G.fighters[2], G.fighters[3]];
  const res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5;
  const op = foes[1].kos > foes[0].kos ? foes[1] : foes[0];   // the results' portrait on a loss: the foe with the most KOs
  const R = { res, forfeit, ranked: false, me, op, lines: [], total: 0,
    duo: { mate, foes, team: match.team, names: match.names, lv: match.level, caught: match.caught } };
  if (!forfeit && match.d >= 0) {
    if (res === 1) P.duoW = (P.duoW | 0) + 1;
    if (match.caught) P.duoC = (P.duoC | 0) + match.caught;
    if (res === 1 && match.level === "Hard") { R.lines.push(["Win on Hard", DUO_CHIPS]); R.total = DUO_CHIPS; P.tokens += DUO_CHIPS; }
    if (res === 1 && P.duoW === DUO_TITLE) R.title = "Dynamic Duo";
    saveProfile();
  }
  showResults(R);
}
function duoVs() { return `You & ${match.cpu} vs ${match.team}`; }
// the results' story line for a 2v2
function duoResLine(R) {
  const D = R.duo, us = ["You and ", { b: D.names[1] }, ` (${D.mate.spec.name})`], them = [{ b: D.team }, ` (${D.foes[0].spec.name} and ${D.foes[1].spec.name})`];
  const how = G.sudden && G.endReason === "stocks" ? " in sudden death" : G.endReason === "time" ? " on time" : "";
  if (R.forfeit) return ["You left the match."];
  if (R.res === 1) return [...us, " beat ", ...them, `${how}.`];
  if (R.res === 0) return [...them, " beat you and ", { b: D.names[1] }, `${how}.`];
  return ["Nobody scored a KO in sudden death either."];
}
window.__blDuo = (o) => { startDuo(o || {}); return G; };   // test hook: start a 2v2 from a script
