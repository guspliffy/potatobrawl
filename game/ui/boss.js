/* ===================== Boss fights (2v1): you and a CPU partner against a boss on his own map =====================
   The simulation is core.js (BOSSES, teams, bossAct). Here: starting the fight, the partner's bot, the boss bar in the HUD (HP, poise,
   FINISH when he is broken), the results. Slots: 0 = you, 1 = your partner, 2 = the boss (team 1). The drawing is draw-boss.js. */
const BOSS_LV = ["Normal", "Hard", "Nightmare"];
const BOSS_MAP = Math.max(0, BL.MAPS.findIndex((m) => m.id === "field"));
const BOSS_SOLO = 0.75;   // with a CPU partner the boss has 3/4 of his HP (a friend on a second phone will get all of it)
const BOSS_PARTNER = [0.55, 0.65, 0.75];   // the partner's strength per difficulty
const BOSS_IDS = new Set(BL.BOSSES.map((b) => b.id));
const BOSS_LINE = { scratch: "Fresh spuds! A thousand years roasting out here and nobody ever brought the salt." };
const bossOf = (g) => (g ? g.fighters.find((f) => f.spec.boss) : null);
// o: { level 0-2, partner: fighter id (default: a random other fighter), boss: boss id }; your fighter is the one picked on the select screen
function startBoss(o) {
  Sfx.init();
  const me = FIG[sel.fighter] || FIGHTERS[0], myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  const mate = FIG[o.partner] || cpuFoe(me), matePal = mate.palettes[mate.id === me.id ? ((P.pal[me.id] || 0) + 1) % mate.palettes.length : 0];
  const boss = BL.BOSSES.find((b) => b.id === o.boss) || BL.BOSSES[0], lv = clamp(o.level | 0, 0, 2);
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: mate, pal: matePal }, { spec: boss, pal: boss.palettes[0] }],
    stocks: 3, time: 0, countdown: 150, map: BOSS_MAP, level: lv, hpMul: BOSS_SOLO });
  match = { boss: true, level: lv, d: BOSS_PARTNER[lv], bot: makeBot(BOSS_PARTNER[lv], BL.BOT_STYLES[mate.id]), cpu: cpuName(), road: o.road || null };
  meSlot = 0;
  enterMatchUI();
}
// the two inputs of a boss fight: yours and the partner's bot (the boss's brain is in the simulation)
function bossInputs(pi) { return [pi, botInput(G, G.fighters[1], G.fighters[2], match.bot)]; }

/* ----- the boss bar: in the timer's place. HP (a pale lag bar trails each hit), poise under it (gold; while he is staggered
   it drains with the stagger), rage turns the bar ember, broken empties and cracks it and FINISH pulses. ----- */
const BB = { g: null, hp: "", po: "", cls: "", quote: false };
function bossHudReset() {
  const b = bossOf(G), el = $("bossBar");
  BB.g = G; BB.hp = BB.po = BB.cls = ""; BB.quote = false;
  $("app").classList.toggle("bossfight", !!b);
  el.hidden = !b;
  if (!b) return;
  el.style.setProperty("--bc", col(b.pal));
  el.querySelector(".bb-name").textContent = b.spec.name;
  el.querySelector(".bb-lv").textContent = BOSS_LV[G.lv] || "";
  el.querySelector(".bb-q").textContent = BOSS_LINE[b.spec.id] || "";
}
function bossHud() {
  if (BB.g !== G) bossHudReset();
  const b = bossOf(G);
  if (!b) return;
  const B = b.spec.boss, el = $("bossBar"), down = b.state === "broken" || b.doomed, stag = b.state === "stagger";
  const rage = !down && b.hp * 100 <= b.hpMax * B.rageAt[G.lv];
  const hp = (b.hpMax ? b.hp / b.hpMax : 0).toFixed(3);
  if (BB.hp !== hp) { BB.hp = hp; el.style.setProperty("--hp", hp); }
  const sMax = B.stagger[G.lv] * (rage ? B.rageStag : 1);
  const po = (down ? 0 : stag ? clamp(b.stag / sMax, 0, 1) : b.poise / B.poise).toFixed(3);
  if (BB.po !== po) { BB.po = po; el.style.setProperty("--po", po); }
  const cls = down ? "down" : stag ? "stag" : rage ? "rage" : "";
  if (BB.cls !== cls) {
    if (cls === "down" && BB.cls !== "down" && G.phase === "play") showBanner("Finish!", "A heavy, special or ulti ends him", "fin", 1600, "#ffd23f");
    el.classList.remove("down", "stag", "rage"); if (cls) el.classList.add(cls); BB.cls = cls;
  }
  const quote = G.phase === "countdown";   // his line while the countdown runs
  if (BB.quote !== quote) { BB.quote = quote; el.classList.toggle("talk", quote); }
}

/* ----- the end of a boss fight: the results (the Road adds its stars in road.js) ----- */
function bossMatchEnd(forfeit) {
  const me = G.fighters[0], mate = G.fighters[1], b = bossOf(G);
  const res = forfeit ? 0 : G.winner === me.team ? 1 : 0;
  const R = { res, forfeit, ranked: false, me, op: b, lines: [], total: 0,
    boss: { lv: G.lv, mate, hp: b.hpMax ? b.hp / b.hpMax : 0, secs: Math.round(G.t / 60), name: b.spec.name } };
  if (match.road) roadBossEnd(R);   // ui/road.js: the level's star, the first win's title and chips
  showResults(R);
}
function bossVs() {
  const b = bossOf(G);
  return `${G.fighters[0].spec.name} and ${match.cpu || "CPU"} (${G.fighters[1].spec.name}) vs ${b ? b.spec.name : "the boss"} · ${BOSS_LV[G.lv]}`;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// the results' story line for a boss fight
function bossResLine(R) {
  const B = R.boss, mate = [{ b: match.cpu || "your partner" }, ` (${B.mate.spec.name})`];
  if (R.forfeit) return ["You left the fight."];
  if (R.res === 1) return ["You and ", ...mate, " beat ", { b: B.name }, ` on ${BOSS_LV[B.lv]} in ${mmss(B.secs)}.`];
  return [{ b: B.name }, ` won with ${Math.max(1, Math.round(B.hp * 100))}% of his HP left. ${BOSS_LV[B.lv]}, ${mmss(B.secs)}.`];
}
window.__blBoss = (o) => { startBoss(o || {}); return G; };   // test hook: start a boss fight from a script
