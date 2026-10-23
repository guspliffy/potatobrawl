/* ===================== Boss fights (2v1): you and a CPU partner against a boss on his own map =====================
   The simulation is core.js (BOSSES, teams, bossAct). Here: starting the fight, the partner's bot, the boss bar in the HUD (HP, poise,
   FINISH when he is broken), the results. Slots: 0 = you, 1 = your partner, 2 = the boss (team 1). The drawing is draw-boss.js. */
const BOSS_LV = [_t("Normal"), _t("Hard"), _t("Nightmare")];
const bossMap = (b) => Math.max(0, BL.MAPS.findIndex((m) => m.id === b.map));   // each boss fights on his own map (spec.map)
const BOSS_SOLO = 0.75;   // with a CPU partner the boss has 3/4 of his HP (the Road: its own, ui/road.js; with a friend online: more, ui/online.js duoHp)
const BOSS_PARTNER = [0.55, 0.65, 0.75];   // the partner's strength per difficulty
const BOSS_IDS = new Set(BL.BOSSES.map((b) => b.id));
const BOSS_LINE = { scratch: _t("Fresh spuds! A thousand years roasting out here and nobody ever brought the salt."),
  zorp: _t("Take me to your ladle. ...No? Then I'll take you instead."),
  kraken: _t("Ahoy, side dishes. The fish sent me. They have questions about the chips.") };
// how to beat him, in one line (the Road's sheet for him)
const BOSS_RULE = { scratch: _t("Break him (0 HP), then land a heavy, special or ulti."),
  zorp: _t("Hit the saucer from the counters until it crashes, break him (0 HP), then land a heavy, special or ulti."),
  kraken: _t("Hit his tentacles while they lie on the pier and his head when it comes up, break him (0 HP), then land a heavy, special or ulti.") };
const bossOf = (g) => (g ? g.fighters.find((f) => f.spec.boss) : null);
// o: { level 0-2, partner: fighter id (default: a random other fighter), boss: boss id, hpMul / mate: his HP and the partner's strength
// (default BOSS_SOLO / BOSS_PARTNER; the Road's are its own, ui/road.js) }; your fighter is the one picked on the select screen
function startBoss(o) {
  Sfx.init();
  const me = FIG[sel.fighter] || FIGHTERS[0], myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  const mate = FIG[o.partner] || cpuFoe(me), matePal = mate.palettes[mate.id === me.id ? ((P.pal[me.id] || 0) + 1) % chipN(mate) : 0];
  const boss = BL.BOSSES.find((b) => b.id === o.boss) || BL.BOSSES[0], lv = clamp(o.level | 0, 0, 2);
  G = newGame({ seed: newSeed(), players: [{ spec: me, pal: myPal }, { spec: mate, pal: matePal }, { spec: boss, pal: boss.palettes[0] }],
    stocks: 3, time: 0, countdown: 150, map: bossMap(boss), level: lv, hpMul: o.hpMul ?? BOSS_SOLO });
  const md = o.mate ?? BOSS_PARTNER[lv];
  match = { boss: true, level: lv, d: md, bot: makeBot(md, BL.BOT_STYLES[mate.id]), cpu: cpuName(), road: o.road || null };
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
    if (cls === "down" && BB.cls !== "down" && G.phase === "play") showBanner(_t("Finish!"), _t("A heavy, special or ulti ends him"), "fin", 1600, "#ffd23f");
    el.classList.remove("down", "stag", "rage"); if (cls) el.classList.add(cls); BB.cls = cls;
  }
  const quote = G.phase === "countdown";   // his line while the countdown runs
  if (BB.quote !== quote) { BB.quote = quote; el.classList.toggle("talk", quote); }
  bwHud();   // ui/bossweek.js: a Boss Week try's clock under the bar
}

/* ----- the end of a boss fight: the results (the Road adds its stars in road.js) ----- */
function bossMatchEnd(forfeit) {
  const me = G.fighters[0], mate = G.fighters[1], b = bossOf(G);
  const res = forfeit ? 0 : G.winner === me.team ? 1 : 0;
  const R = { res, forfeit, ranked: false, me, op: b, lines: [], total: 0,
    boss: { lv: G.lv, mate, hp: b.hpMax ? b.hp / b.hpMax : 0, secs: Math.round(G.t / 60), name: b.spec.name } };
  if (match.road) roadBossEnd(R);   // ui/road.js: the level's star, the first win's title and chips
  if (match.bw) bwEnd(R);   // ui/bossweek.js: a Boss Week try's time to the server
  showResults(R);
}
function bossVs() {
  const b = bossOf(G), boss = b ? b.spec.name : _t("the boss"), level = BOSS_LV[G.lv];
  if (match.online) return _t("{me} and {mate} ({mf}) vs {boss} · {level}", { me: G.fighters[meSlot].spec.name, mate: NET.oppName || _t("your friend"), mf: G.fighters[1 - meSlot].spec.name, boss, level });   // ui/online.js: a friend on a second phone
  return _t("{me} and {mate} ({mf}) vs {boss} · {level}", { me: G.fighters[0].spec.name, mate: match.cpu || _t("CPU"), mf: G.fighters[1].spec.name, boss, level });
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// A sentence for resLine (screens.js), which takes parts, a name in bold as { b }: the sentence is ONE _t text with the names as {vars} marked by
// tlBold, and tlParts cuts the translated text into the parts again (so a translation may put a bold name anywhere).
const tlBold = (s) => `\u0001${s}\u0001`;
const tlParts = (s) => s.split("\u0001").map((x, i) => (i % 2 ? { b: x } : x));
// the results' story line for a boss fight
function bossResLine(R) {
  const friend = R.online ? NET.oppName || _t("your friend") : "";   // online: the friend on the second phone (ui/online.js)
  const B = R.boss, mate = friend || match.cpu || _t("your partner");
  if (R.forfeit) return [_t("You left the fight.")];
  if (R.res === 1) {
    const line = tlParts(_t("You and {mate} ({mf}) beat {boss} on {level} in {time}.", { mate: tlBold(mate), mf: B.mate.spec.name, boss: tlBold(B.name), level: BOSS_LV[B.lv], time: mmss(B.secs) }));
    // online: who landed the final launch; after a drop the CPU may have finished it
    if (R.online) line.push(R.mateFin ? ` ${R.dropped ? _t("CPU finished what {friend} started.", { friend }) : _t("{friend} landed the final launch.", { friend })}` : B.by === R.me.slot ? ` ${_t("You landed the final launch.")}` : "");
    return line;
  }
  return tlParts(_t("{boss} won with {pct}% of his HP left. {level}, {time}.", { boss: tlBold(B.name), pct: Math.max(1, Math.round(B.hp * 100)), level: BOSS_LV[B.lv], time: mmss(B.secs) }));
}
window.__blBoss = (o) => { startBoss(o || {}); return G; };   // test hook: start a boss fight from a script
