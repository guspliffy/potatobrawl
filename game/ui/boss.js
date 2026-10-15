/* ===================== Boss fights (2v1): you and a CPU partner against a boss on his own map =====================
   The simulation is core.js (BOSSES, teams, bossAct). Here: starting the fight, the partner's bot, the boss's HP/poise bar,
   the results. Slots: 0 = you, 1 = your partner, 2 = the boss (team 1). */
const BOSS_LV = ["Normal", "Hard", "Nightmare"];
const BOSS_MAP = Math.max(0, BL.MAPS.findIndex((m) => m.id === "field"));
const BOSS_SOLO = 0.75;   // a CPU partner: the boss has 3/4 of his HP
const BOSS_PARTNER = [0.55, 0.65, 0.75];   // the partner's strength per difficulty
// o: { level 0-2, partner: fighter id (default: a random other fighter) }; your fighter is the one picked on the select screen
function startBoss(o) {
  Sfx.init();
  const me = FIG[sel.fighter] || FIGHTERS[0], myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  const mate = FIG[o.partner] || cpuFoe(me), matePal = mate.palettes[mate.id === me.id ? (P.pal[me.id] + 1) % mate.palettes.length : 0];
  const boss = BL.BOSSES[0], lv = clamp(o.level | 0, 0, 2);
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: mate, pal: matePal }, { spec: boss, pal: boss.palettes[0] }],
    stocks: 3, time: 0, countdown: 150, map: BOSS_MAP, level: lv, hpMul: BOSS_SOLO });
  match = { boss: true, level: lv, d: BOSS_PARTNER[lv], bot: makeBot(BOSS_PARTNER[lv], BL.BOT_STYLES[mate.id]), cpu: cpuName() };
  meSlot = 0;
  enterMatchUI();
}
// the two inputs of a boss fight: yours and the partner's bot (the boss's brain is in the simulation)
function bossInputs(pi) { return [pi, botInput(G, G.fighters[1], G.fighters[2], match.bot)]; }
window.__blBoss = (o) => { startBoss(o || {}); return G; };   // test hook: start a boss fight from a script
