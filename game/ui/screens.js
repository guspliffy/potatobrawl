/* ===================== screens & flow ===================== */
let mode = "menu", paused = false, G = null, match = null, attract = null, tick = 0, lastCount = 0, meSlot = 0;
const screens = { menu: $("scrMenu"), select: $("scrSelect"), result: $("scrResult"), pause: $("scrPause"), help: $("scrHelp"), settings: $("scrSettings"), online: $("scrOnline"), cup: $("scrCup") };
function show(name) { for (const k of ["menu", "select", "result", "online", "cup", "road"]) if (screens[k]) screens[k].hidden = k !== name; }
function modal(name, on) { screens[name].hidden = !on; }

const bannerEl = $("banner"), bMain = bannerEl.querySelector(".b-main"), bSub = bannerEl.querySelector(".b-sub");
let bannerT = 0;
function showBanner(main, sub, cls, ms, color) {
  bannerEl.className = cls || ""; bMain.textContent = main; bSub.textContent = sub || ""; bannerEl.hidden = false;
  bMain.style.color = color || "";
  void bannerEl.offsetWidth; bannerEl.classList.add("show");
  clearTimeout(bannerT); if (ms) bannerT = setTimeout(() => { bannerEl.hidden = true; }, ms);
}
function hideBanner() { clearTimeout(bannerT); bannerEl.hidden = true; }

function newAttract() {
  const pick = () => FIGHTERS[(Math.random() * FIGHTERS.length) | 0];
  const a = pick(), b = pick();
  const g = newGame({ players: [{ spec: a, pal: a.palettes[(Math.random() * 4) | 0] }, { spec: b, pal: b.palettes[a === b ? 1 : 0] }], countdown: 30, stocks: 2, map: (Math.random() * BL.POOL) | 0 });
  attract = { g, b0: makeBot(0.75), b1: makeBot(0.75) };
  clearTrails();
  $("mLive").textContent = `Live · ${a.name} vs ${b.name}`;   // the menu's LIVE tag names the two fighters behind it
}

/* ----- the main menu (Fable's design; markup in shell.html #scrMenu, styles in game/css/20-menu.css) ----- */
// a portrait <img> on the menu, set only when the fighter changes (the portraits are inlined data URLs)
function menuImg(img, id) {
  const src = PORTRAITS[id] || "";
  if (img._src !== src) { img._src = src; if (src) img.src = src; else img.removeAttribute("src"); }
  img.dataset.f = id;
}
function renderMenu() {
  renderPill();   // the profile plate and the coins, ui/acct.js
  // the Ranked hero: the fighter you play (P.last) in the slanted mask, your tier, your record and the rating to the next tier
  const ti = tierInfo(P.rating), spec = FIG[P.last] || FIGHTERS[0], pal = spec.palettes[P.pal[spec.id] || 0] || spec.palettes[0], hero = $("bRanked");
  hero.style.setProperty("--fc", col(pal)); hero.dataset.f = spec.id;
  menuImg($("mHeroArt"), spec.id);
  $("mRankKick").innerHTML = `Ranked<span class="mm-km"> match</span> · ${ti.t.name} ${+P.rating || 0}`;   // small screens drop "match"
  // the line wraps only after a " · " (no-break spaces inside each part and before each dot)
  const rec = P.matches > 0 ? [`${P.wins}W`, `${P.losses}L`].concat(P.streak > 1 ? [`${P.streak} streak`] : []) : ["First match"];
  rec.push(ti.next ? `${ti.need} to ${ti.next.name}` : "top tier");
  $("mRec").textContent = rec.map((t) => t.replace(/ /g, "\u00a0")).join("\u00a0· ");
  // Tournament: a cup in progress, the cups won, or what a cup pays
  const c = cupOk(P.cup) ? P.cup : null, cups = P.cups | 0;
  $("mCup").innerHTML = c ? `<em>Resume</em>${c.out < 0 ? ` · ${CUP.names[c.round].toLowerCase()}` : ""}`
    : cups ? `<em>${cups} ${cups === 1 ? "cup" : "cups"} won</em>` : `<em>Up to ${CUP.chips.reduce((a, n) => a + n, CUP.flawless)} chips</em>`;
  // Play friends: the mint dot when online play is there, greyed out with the reason when not
  const onOk = onlineAvailable();
  $("bOnline").disabled = !onOk;
  $("mOnline").textContent = onOk ? "" : "needs the web link";
  $("a2hsHint").hidden = !(FS.web && FS.ios && !FS.app && !P.a2hs);
  dailyMenu(); menuDaily(); roadCard();   // roadCard: the Road's map card (ui/road.js)
}
// the Daily Potato tile: today's two portraits, the matchup (dailyMenu in daily.js writes #mDaily), the reward or the day's result
function menuDaily() {
  const key = dailyKey(), st = dailyGet(), done = st.d === key, pk = dailyPick(key), tile = $("bDaily"), tag = $("mDailyTag");
  menuImg($("mDailyA"), pk.me); menuImg($("mDailyB"), pk.opp);
  tile.classList.toggle("done", done);
  $("mDailyR").innerHTML = done ? "" : `<em>+${DAILY.win} chips</em> · one try`;
  const won = done && st.r === 1;
  tag.textContent = done ? (won ? "Won" : "Done") : "Today";
  tag.className = `tag ${won ? "mint" : done ? "done" : "ember"} mm-today`;
}
// The top bar: when the plate and the coins do not fit beside the logo (or across an upright phone), first the coins get
// tighter (.fit1), then the plate drops the name (.fit2). Runs after renderPill and whenever the menu changes size.
function menuFit() {
  const me = $("mRank"), bar = me.closest(".mm-bar"), top = me.parentNode;
  if (screens.menu.hidden) return;
  const crowded = () => bar.scrollWidth > bar.clientWidth + 1 || top.scrollWidth > top.clientWidth + 1;
  me.classList.remove("fit1", "fit2");
  for (const k of ["fit1", "fit2"]) { if (!crowded()) break; me.classList.add(k); }
}
if (window.ResizeObserver) new ResizeObserver(() => menuFit()).observe(screens.menu);
if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => menuFit());   // the web fonts change the widths
// the Daily tile turns over to the next matchup at midnight while the menu stays open (daily.js turns its line over too)
setInterval(() => { if (mode === "menu") menuDaily(); }, 30000);
// a downloaded copy of the page has no way to reach other players
function onlineAvailable() {
  const c = window.claude && typeof window.claude.use === "function";
  return !!c && !(window.__blStandalone && !/^https?:$/.test(location.protocol));
}
function goMenu() {
  if (NET.mr) leaveMatchRoom();
  if (NET.phase !== "idle") { resetNet(); NET.phase = "idle"; lobbyPresence(); }
  tutEnd(); finStop();
  mode = "menu"; paused = false; G = null; match = null; meSlot = 0;
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  modal("pause", false); modal("help", false); modal("settings", false);
  $("rMenu").hidden = false;   // the Daily Potato's results hide it (their again button is "Menu"); the tutorial's results need it back
  renderMenu(); show("menu"); resize();
  clearTrails(); fx.length = 0; sfx.length = 0;
  if (!attract) newAttract();
}

/* ----- fighter select: one row of fighter tiles, one detail panel for the picked fighter ----- */
const LEVELS = [{ name: "Dummy", d: -1 }, { name: "Easy", d: 0.15 }, { name: "Normal", d: 0.5 }, { name: "Hard", d: 0.9 }];
const sel = { mode: "ranked", fighter: P.last, opp: "random", level: 2, map: "random", blv: 0, mate: "random", pending: null };   // blv: the boss difficulty (Practice vs a boss); mate: the 2v2 partner (opp "duo")
const randMap = () => (Math.random() * BL.POOL) | 0;   // The Field (an arena map) only when picked in Practice
/* CPU opponents get a potato name (and a fighting style, see BL.BOT_STYLES). Original names, no real people. */
const CPU_NAMES = [
  "Spud Muffin", "Tater Tot", "Hash Brown", "Mash Master", "Sir Fries-a-Lot", "Lady Latke", "Chip Chomp", "Wedge Wally",
  "Russet Rex", "Couch Potato", "Sweet Pete", "Fingerling Finn", "Gnocchi Gus", "Pommes Pierre", "Rosti Rosa", "Tuber Tom",
  "Sprout Sam", "Starch Stan", "Papa Pomme", "Crispy Cris", "Salty Sal", "Gravy Gail", "Duchess Dot", "Lumpy Lou",
  "Grandpa Spud", "Baron Baked", "Tater Tyrant", "Mr. Mash", "Curly Fry", "Waffle Walt", "Jacket Jim", "Butter Boris",
  "Peel Appeal", "Eyes Ivy", "Smash Brown", "Yukon Yolanda",
];
let lastCpuName = "";
function cpuName() {
  let n;
  do n = CPU_NAMES[(Math.random() * CPU_NAMES.length) | 0]; while (n === lastCpuName);
  return (lastCpuName = n);
}
const cardArt = [];
function statBars(spec) {
  const s = spec.stats, mv = spec.moves;
  const heavy = [mv.hSide, mv.hUp, mv.hDown].reduce((a, m) => a + m.dmg, 0) / 3;
  const airH = (s.jump * s.jump + s.airJumps * s.airJump * s.airJump) / (2 * s.gravity);
  const q = (v, a, b) => clamp(Math.round(1 + ((v - a) / (b - a)) * 4), 1, 5);
  return [["Power", q(heavy, 11, 18)], ["Speed", q(s.run, 4.6, 7.4)], ["Weight", q(s.weight, 82, 120)], ["Air", q(airH, 260, 560)]];
}
// put an owned skin on a fighter (the select screen's swatches and the Account locker both do this)
function equipSkin(id, i) { if (!(P.owned[id] || []).includes(i)) return false; P.pal[id] = i; saveProfile(); return true; }
function selPalIdx(spec) { return sel.pending && sel.pending.id === spec.id ? sel.pending.i : P.pal[spec.id] || 0; }
/* The roster is built once and then only restyled, so the pick can scale up (CSS) instead of being redrawn.
   Tiles keep the class "tile" (the tests click them by it). */
function buildTiles() {
  const wrap = $("tiles");
  if (wrap.children.length !== FIGHTERS.length) {
    wrap.innerHTML = "";
    for (const spec of FIGHTERS) {
      const b = document.createElement("button");
      b.className = "tile"; b.dataset.id = spec.id;
      b.innerHTML = `${PORTRAITS[spec.id] ? `<img src="${PORTRAITS[spec.id]}" alt="">` : ""}<span><b>${spec.name}</b></span>`;
      b.addEventListener("click", () => {
        Sfx.init(); if (sel.fighter === spec.id) { Sfx.ui(); return; }
        Sfx.uiFlip();
        sel.fighter = spec.id; sel.pending = null; P.last = spec.id; saveProfile();
        buildTiles(); buildDetail();
      });
      wrap.appendChild(b);
    }
  }
  for (const b of wrap.children) {
    const spec = FIG[b.dataset.id], on = sel.fighter === spec.id;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
    b.style.setProperty("--fc", col(spec.palettes[P.pal[spec.id] || 0]));
    masteryTile(b, spec);   // ui/mastery.js: the level shield
  }
}
// restart a one-shot CSS animation (the stage name and model when the fighter changes)
function slReplay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function buildDetail() {
  const spec = FIG[sel.fighter], pi = selPalIdx(spec), pal = spec.palettes[pi] || spec.palettes[0], c = col(pal);
  // the whole screen tints to the skin being looked at (registered properties, so the tint eases over in CSS)
  screens.select.style.setProperty("--sfc", c);
  screens.select.style.setProperty("--sfcg", rgba(c, 0.42));
  screens.select.style.setProperty("--sfct", rgba(c, 0.13));
  // the stage art: one portrait per fighter; the new pick fades in over the last one (the art shows the base look, the model the skin)
  const por = $("dPor");
  if (por.children.length !== FIGHTERS.length) por.innerHTML = FIGHTERS.map((f) => `<img data-id="${f.id}" alt=""${PORTRAITS[f.id] ? ` src="${PORTRAITS[f.id]}"` : ""}>`).join("");
  const was = por.querySelector("img.on"), now = por.querySelector(`img[data-id="${spec.id}"]`);
  if (was !== now) {
    for (const im of por.children) im.classList.remove("was");
    if (was) { was.classList.remove("on"); was.classList.add("was"); slReplay($("dNameBox"), "swap"); slReplay($("dArt"), "swap"); }
    if (now) now.classList.add("on");
  }
  $("dName").textContent = spec.name;
  $("dRole").textContent = spec.role;
  $("dBlurb").textContent = spec.blurb;
  $("dStats").innerHTML = statBars(spec).map(([n, v]) => `<span>${n}</span><span class="sl-seg" role="img" aria-label="${n} ${v} of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? "on" : ""}"></i>`).join("")}</span>`).join("");
  masteryDetail(spec);   // ui/mastery.js: the MASTERY row of the stats card
  $("dSig").innerHTML = `<b><em>Special</em>${spec.signature.name}</b><span>${spec.signature.text}</span>`;
  $("dUlt").innerHTML = `<b><em>Ulti</em>${spec.ultimate.name}</b><span>${spec.ultimate.text}</span>`;
  const pals = $("dPals"); pals.innerHTML = "";
  spec.palettes.forEach((p, i) => {
    const own = P.owned[spec.id].includes(i), cur = (P.pal[spec.id] || 0) === i, pend = !!sel.pending && sel.pending.id === spec.id && sel.pending.i === i;
    const b = document.createElement("button");
    b.className = `sw${cur ? " cur" : ""}${own ? "" : " lock"}${pend ? " pending" : ""}`;
    b.style.setProperty("--c", col(p));
    b.title = p.name;
    // a Road skin (p.road: the boss that gives it) is never sold: locked, it says who to beat instead of a price
    if (p.road) b.classList.add("road");
    b.setAttribute("aria-label", `${p.name}${own ? "" : p.road ? `, locked, beat ${roadBossName(p.road)} on the Road` : `, locked, ${p.price} chips`}`);
    b.setAttribute("aria-pressed", String(own ? cur : pend));
    b.innerHTML = `<i></i><small>${own ? p.name : p.road ? "Road" : `<span class="tokglyph"></span>${p.price}`}</small>`;
    b.addEventListener("click", () => {
      Sfx.init(); Sfx.ui();
      if (own) { equipSkin(spec.id, i); sel.pending = null; }
      else sel.pending = { id: spec.id, i }; // locked: preview it on the model; the Upgrade button buys it
      buildTiles(); buildDetail();
    });
    pals.appendChild(b);
  });
  $("dNote").textContent = skinNote(spec, pi);
  // the portrait only has the base look: any other skin (equipped or a locked one being previewed) stands in the stage corner as the
  // model drawn in a match
  screens.select.classList.toggle("sl-skin", pi !== 0);
  cardArt.length = 0;
  if (pi !== 0) {
    const f = BL.newGame({ players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
    f.x = 0; f.y = 0; f.facing = -1;
    cardArt.push({ cv: $("dArt"), f, fit: 0.88, bottom: 0.96 });
  }
  $("selTokens").textContent = P.tokens;
  updateUpgrade();
}
function buildCards() { buildTiles(); buildDetail(); }
function skinNote(spec, i) {
  const p = spec.palettes[i], fx = p.road ? ROADFX[p.road] : FXTEXT[spec.id] && FXTEXT[spec.id][i];
  const how = p.road && !(P.owned[spec.id] || []).includes(i) ? ` Beat ${roadBossName(p.road)} on the Road with ${spec.name} to get it.` : "";
  return `${p.name}: ${fx || "base look"}.${how}`;
}
const roadBossName = (id) => (BL.BOSSES.find((b) => b.id === id) || { name: "the boss" }).name;
function updateUpgrade() {
  const btn = $("selUp"), pd = sel.pending, road = !!pd && !!FIG[pd.id].palettes[pd.i].road;   // a Road skin can't be bought
  btn.hidden = !pd || road;
  screens.select.classList.toggle("sl-pend", !!pd && !road);
  if (!pd || road) return;
  const spec = FIG[pd.id], p = spec.palettes[pd.i], short = p.price - P.tokens;
  btn.disabled = short > 0;
  btn.querySelector("span").innerHTML = `Upgrade<small><span class="tokglyph"></span>${p.price}</small>`;
  if (short > 0) $("dNote").textContent = `${short} more chips needed. ${skinNote(spec, pd.i)}`;   // the shortage first: small phones clamp the note
  btn.setAttribute("aria-label", short > 0 ? `${p.name} costs ${p.price} chips, you need ${short} more` : `Upgrade ${spec.name} to ${p.name} for ${p.price} chips`);
}
function buyPending() {
  const pd = sel.pending;
  if (!pd) return;
  const spec = FIG[pd.id], p = spec.palettes[pd.i];
  if (p.road || P.tokens < p.price || P.owned[spec.id].includes(pd.i)) { updateUpgrade(); return; }
  P.tokens -= p.price; P.owned[spec.id].push(pd.i); P.pal[spec.id] = pd.i; sel.pending = null; saveProfile();
  Sfx.uiCoin();
  buildTiles(); buildDetail();
  $("dNote").textContent = `Upgraded to ${p.name}. ${FXTEXT[spec.id][pd.i] || ""}`.trim();
}
// a tall, narrow stage (desktop) shows the model smaller so wings and tails stay in view
function artFit(a) { const w = a.cv.clientWidth, h = a.cv.clientHeight || 1; return Math.min(a.fit || 0.7, Math.max(0.42, (a.fit || 0.7) * 1.1 * w / h)); }
// models much wider than tall (the Reaper's scythe): how wide the drawing is and how far its middle sits off the feet, in world units; the model shrinks to fit that width
const ART_SPAN = { reaper: { span: 118, dx: 25 } };
function drawCards(tk) {
  for (const a of cardArt) {
    const r = { width: a.cv.clientWidth, height: a.cv.clientHeight };
    if (!r.width) continue;
    const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR);
    if (a.cv.width !== w || a.cv.height !== h) { a.cv.width = w; a.cv.height = h; }
    const c = a.cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    const sp = ART_SPAN[a.f.spec.id], sc = Math.min((h * artFit(a)) / a.f.s.h, sp ? (w * 0.96) / sp.span : Infinity);
    c.setTransform(sc, 0, 0, sc, w * 0.5 - (sp ? sp.dx * sc * (a.f.facing || 1) : 0), h * (a.bottom || 0.95));
    drawFighter(c, a.f, tk);
  }
}
/* practice: opponent, CPU level and map are dropdown chips in the header; each opens its .pop list. With Team Brawl 2v2 as the opponent
   (sel.opp "duo", ui/duo.js) the VS chip names it, the map list keeps to the random pool and a fourth chip picks your partner. */
const SEL_PICKS = [["oppPick", "oppPop"], ["lvlPick", "lvlPop"], ["mapPick", "mapPop"], ["matePick", "matePop"]];
function closePops() { for (const [btn, pop] of SEL_PICKS) { $(pop).hidden = true; $(btn).setAttribute("aria-expanded", "false"); } }
function buildPractice() {
  const boss = BL.BOSSES.find((b) => b.id === sel.opp), duo = sel.opp === "duo", opp = boss || (sel.opp === "random" || duo ? null : FIG[sel.opp]);
  const mate = FIG[sel.mate], portrait = (spec) => (spec && PORTRAITS[spec.id] ? `<img src="${PORTRAITS[spec.id]}" alt="">` : `<i class="sl-q">?</i>`);
  screens.select.classList.toggle("sl-team", duo);
  $("mateWrap").hidden = !duo;
  $("oppPick").innerHTML = `<small>VS</small>${duo ? `<i class="sl-glyph">2v2</i>` : portrait(opp)}<span>${duo ? "Team Brawl 2v2" : opp ? opp.name : "Random"}</span>`;
  $("lvlPick").innerHTML = boss ? `<small>Boss</small><span>${BOSS_LV[sel.blv]}</span>` : `<small>CPU</small><span>${LEVELS[sel.level].name}</span>`;
  // the arena maps (The Field...) are not in the 2v2 draw: a pick made for a 1v1 shows as Random here (and stays picked for the 1v1)
  const mapOk = (i) => i !== "random" && BL.MAPS[i] && !(duo && BL.MAPS[i].pool === false), mapSel = mapOk(sel.map) ? sel.map : "random";
  $("mapPick").innerHTML = `<small>Map</small><span>${boss ? mapName(bossMap(boss)) : mapSel === "random" ? "Random" : mapName(mapSel)}</span>`;
  $("mapPick").disabled = !!boss;   // a boss fights on his own map (you and a CPU partner against him)
  $("matePick").innerHTML = `<small>Partner</small>${portrait(mate)}<span>${mate ? mate.name : "Random"}</span>`;
  const fill = (pop, items, isOn, pick) => {
    pop.innerHTML = "";
    items.forEach((it) => {
      const b = document.createElement("button");
      b.textContent = it.label; if (isOn(it)) b.className = "on";
      if (it.img) b.insertAdjacentHTML("afterbegin", `<img src="${it.img}" alt="">`);
      if (it.glyph) b.insertAdjacentHTML("afterbegin", `<i class="sl-glyph">2v2</i>`);
      if (it.top) b.classList.add("top");
      b.addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); Sfx.ui(); pick(it); closePops(); buildPractice(); });
      pop.appendChild(b);
    });
  };
  // Team Brawl 2v2 sits first on screen (.top, CSS order) but last in the list: the tests that pick a fighter by its position (Random is 0) keep working
  fill($("oppPop"), [{ id: "random", label: "Random" }, ...FIGHTERS.map((f) => ({ id: f.id, label: f.name, img: PORTRAITS[f.id] })),
    ...BL.BOSSES.map((b) => ({ id: b.id, label: `${b.name} · boss, 2 vs 1`, img: PORTRAITS[b.id] })), { id: "duo", label: "Team Brawl 2v2", glyph: true, top: true }], (it) => it.id === sel.opp, (it) => { sel.opp = it.id; });
  if (boss) fill($("lvlPop"), BOSS_LV.map((name, i) => ({ i, label: name })), (it) => it.i === sel.blv, (it) => { sel.blv = it.i; });
  else fill($("lvlPop"), LEVELS.map((l, i) => ({ i, label: l.name })), (it) => it.i === sel.level, (it) => { sel.level = it.i; });
  fill($("mapPop"), [{ i: "random", label: "Random" }, ...BL.MAPS.map((m, i) => ({ i, label: mapName(i) })).filter((it) => mapOk(it.i))], (it) => it.i === mapSel, (it) => { sel.map = it.i; });
  fill($("matePop"), [{ id: "random", label: "Random" }, ...FIGHTERS.map((f) => ({ id: f.id, label: f.name, img: PORTRAITS[f.id] }))], (it) => it.id === sel.mate, (it) => { sel.mate = it.id; });
}
for (const [btn, pop] of SEL_PICKS) {
  $(btn).addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); Sfx.ui(); const open = $(pop).hidden; closePops(); $(pop).hidden = !open; $(btn).setAttribute("aria-expanded", String(open)); });
}
app.addEventListener("click", (e) => { if (!e.target.closest(".pickwrap")) closePops(); });
function openSelect(m) {
  sel.mode = m; sel.pending = null;
  mode = "select";
  const ti = tierInfo(P.rating);
  // the kicker names the mode (ranked: your tier in its colour and the rating)
  $("selMode").innerHTML = m === "ranked" ? `Ranked match · ${tierBadge(ti.i, "sl-em")}<b style="color:${ti.t.col}">${ti.t.name}</b> ${P.rating}` : m === "online" ? "Play friends" : m === "cup" ? "Tournament · you and 7 CPUs" : m === "road" ? `The Road · ${roadSelName(RD.sel)}` : "Practice · vs CPU";
  screens.select.classList.toggle("sl-prac", m === "practice");
  $("pracOpts").hidden = m !== "practice"; closePops();
  $("selGo").querySelector("span").textContent = m === "online" ? "Done" : m === "cup" ? "Start cup" : "Fight";
  buildCards(); if (m === "practice") buildPractice();
  show("select"); $("hud").hidden = true; $("ctl").hidden = true; resize();
}

/* ----- match ----- */
// a random CPU fighter: your own fighter is 4x less likely than each other one (about 3% instead of 1 in 8; Jonny, 2026-10-14)
function cpuFoe(me) {
  const w = FIGHTERS.map((f) => (f.id === me.id ? 0.25 : 1)), sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < FIGHTERS.length; i++) { r -= w[i]; if (r < 0) return FIGHTERS[i]; }
  return FIGHTERS[FIGHTERS.length - 1];
}
function startMatch() {
  Sfx.init();
  if (sel.mode === "practice" && BOSS_IDS.has(sel.opp)) { startBoss({ level: sel.blv, boss: sel.opp }); return; }   // ui/boss.js: you and a CPU partner vs the boss
  if (sel.mode === "practice" && sel.opp === "duo") { startDuo({ partner: sel.mate, level: sel.level, map: sel.map }); return; }   // ui/duo.js: Team Brawl 2v2
  const ranked = sel.mode === "ranked";
  const me = FIG[sel.fighter], myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  let opp, d, oppRating = 0;
  if (ranked) {
    opp = cpuFoe(me);
    oppRating = clamp(Math.round(P.rating + (Math.random() - 0.5) * 140), 600, 2100);
    d = clamp((oppRating - 750) / 1000, 0.08, 0.98);
  } else {
    opp = sel.opp === "random" ? cpuFoe(me) : FIG[sel.opp];
    d = LEVELS[sel.level].d;
  }
  let oppPal = opp.palettes[0];
  if (opp.id === me.id) oppPal = opp.palettes[(P.pal[me.id] + 1) % opp.palettes.length];
  const map = !ranked && sel.map !== "random" ? sel.map : randMap();   // ranked always draws a map; practice can pick one
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: oppPal }], stocks: 3, time: 240, countdown: 150, map });
  match = { ranked, d, oppRating, bot: makeBot(d, BL.BOT_STYLES[opp.id]), level: ranked ? null : LEVELS[sel.level].name, cpu: cpuName() };
  meSlot = 0;
  enterMatchUI();
}
function enterMatchUI() {
  finStop();
  mode = "match"; paused = false; lastCount = 0;
  show(null); hideOnline(); modal("pause", false); modal("help", false); modal("settings", false);
  $("hud").hidden = false; $("ctl").hidden = !touchUI; $("netBadge").hidden = true; $("pingBadge").hidden = true; $("pingBadge").textContent = "";
  hudDuo();   // ui/hud.js: the 2v2's four cards (and the 1v1's two again)
  for (let i = 0; i < hudN(); i++) {
    const f = G.fighters[i], el = $("pc" + i);
    el.style.setProperty("--fc", col(f.pal));
    el.querySelector(".pc-name").textContent = f.spec.name;
    el.querySelector(".pc-tag").textContent = i === meSlot ? "You" : match.online ? NET.oppName || "Friend" : match.duo && f.team === G.fighters[meSlot].team ? "Partner" : "CPU";
    hudCache[i] = { pct: -1, stocks: -1, out: null };
  }
  { // the CPU's potato name (and tier in ranked) under its card's CPU tag; the tutorial CPU has none
    const sub = $("pc1").querySelector(".pc-sub");
    sub.hidden = !(match.cpu && !match.online);
    sub.querySelector(".nm").textContent = match.cpu || "";
    sub.querySelector(".tr").textContent = match.oppRating ? cpuTier() : match.daily ? match.level : match.boss ? "partner" : "";
  }
  bossHudReset();   // ui/boss.js: the boss bar in the timer's place (hidden when there is no boss)
  btnSpec.style.setProperty("--fc", col(G.fighters[meSlot].pal));
  hudX.spFin = null; hudX.ch = -1; hudX.jb = false; btnSpec.classList.remove("fin", "jb"); btnSpec.querySelector("span").textContent = "Special";
  btnHeavy.classList.remove("chg", "chgfull"); btnHeavy.style.setProperty("--ch", "0");
  for (const e of document.querySelectorAll(".pcard")) e.classList.remove("finr");
  fx.length = 0; sfx.length = 0; clearTrails(); combos.fill(null);
  if (!match.tutorial) tutEnd(); else { $("tut").hidden = false; app.classList.add("tut"); }
  releaseTouch(); resize(); camStep(G, true);
}
const hudCache = [{}, {}, {}, {}], hudX = { spFin: null, ch: -1, jb: false };
const hudN = () => (match && match.duo && G ? G.fighters.length : 2);   // name cards on the HUD: both fighters, or the four of a 2v2
const btnSpec = document.querySelector('.pb[data-k="special"]'), btnHeavy = document.querySelector('.pb[data-k="heavy"]');
// A fighter at finish percent just crossed it: tell both players once, in the colour of the fighter who can finish.
function finReady(i) {
  if (!G || G.phase !== "play" || (match && (match.tutorial || match.boss))) return;   // a boss has no finisher (his own FINISH is in the boss bar)
  if (match && match.duo && G.fighters[i].team === G.fighters[meSlot].team) return;   // 2v2: only a FOE crossing the percent is news; the banner is in your colour
  const att = match && match.duo ? G.fighters[meSlot] : G.fighters[1 - i];
  showBanner("Finish!", `${finName(att.spec)} KOs now`, "fin", 1100, col(att.pal));
  Sfx.tone(330, 740, 0.22, "sawtooth", 0.06); Sfx.noise(0.16, 0.22, 3200);
}
function vsLine() {
  if (match.boss) return bossVs();
  if (match.duo) return duoVs();
  if (match.road) return `${ROAD[match.road.i].name} · ${G.fighters[0].spec.name} vs ${G.fighters[1].spec.name} · ${match.cpu}`;
  const me = G.fighters[meSlot].spec.name, op = G.fighters[1 - meSlot].spec.name;
  if (match.online) return `${me} vs ${op} · ${NET.oppName || "Friend"}, online`;
  if (match.cup) return `${CUP.names[match.round]} · ${me} vs ${op} · ${match.cpu}, ${cpuTier()}`;
  if (match.daily) return `Daily Potato · ${me} vs ${op} · ${match.cpu}, ${match.level}`;
  if (match.ranked) return `${me} vs ${op} · ${match.cpu || "CPU"}, ${cpuTier()}`;
  return `${me} vs ${op} · ${match.cpu ? match.cpu + ", " : ""}${match.level}`;
}
function cpuTier() { return `${tierInfo(match.oppRating).t.name} ${match.oppRating}`; }
// Lives as hearts (CSS in shell.html). A lost heart stays in place while its halves fall, then goes; a gained one pops in.
function setHearts(box, n, prev) {
  if (prev < 0) box.innerHTML = "<i></i>".repeat(n);
  const live = [...box.querySelectorAll("i:not(.lost)")];
  for (let k = live.length; k < n; k++) {
    const h = document.createElement("i"); h.className = "pop"; box.appendChild(h); live.push(h);
    setTimeout(() => h.classList.remove("pop"), 340);
  }
  for (const h of live.splice(n)) { h.className = "lost"; setTimeout(() => h.remove(), 480); }
  for (const h of live) {
    h.classList.toggle("last", n === 1);
    if (prev > n) { h.classList.remove("thump"); void h.offsetWidth; h.classList.add("thump"); setTimeout(() => h.classList.remove("thump"), 220); }
  }
}
function updateHud() {
  for (let i = 0; i < hudN(); i++) {
    const f = G.fighters[i], el = $("pc" + i), hc = hudCache[i];
    const pct = Math.floor(f.percent);
    const num = el.querySelector(".num"), wrap = el.querySelector(".pc-pct");
    if (hc.pct !== pct) { num.textContent = pct; wrap.style.color = pctColor(pct); hc.pct = pct; }
    const fin = pct >= BL.TUNE.finishPct && f.state !== "dead" && f.state !== "gone";
    if (hc.fin !== fin) { const first = fin && !hc.fin; hc.fin = fin; el.classList.toggle("finr", fin); if (first) finReady(i); }
    const fl = f.flash;
    wrap.style.transform = fl > 0 ? `scale(${1 + fl * 0.035}) translateX(${(Math.random() - 0.5) * fl * 0.8}px)` : "";
    if (hc.stocks !== f.stocks) { setHearts(el.querySelector(".pc-stocks"), Math.max(0, f.stocks), hc.stocks); hc.stocks = f.stocks; }
    const out = f.state === "dead" || f.state === "gone";
    if (hc.out !== out) { el.classList.toggle("out", out); hc.out = out; }
    if (match.duo && i > 1) { const foc = duoFocused() === i; if (hc.foc !== foc) { hc.foc = foc; el.classList.toggle("focus", foc); } }   // the foe the partner was sent after
  }
  const secs = Math.max(0, Math.ceil(G.timer / 60));
  const clock = $("clock");
  const txt = !G.timed ? "∞" : `${G.sudden ? "SD " : ""}${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (clock.textContent !== txt) { clock.textContent = txt; clock.classList.toggle("warn", G.timed && (secs <= 30 || G.sudden)); }
  const pb = $("pingBadge"), ms = match && match.online ? NET.rttLive || NET.rtt || 0 : 0;
  const ptxt = ms ? `${Math.round(ms)} ms` : "";
  if (pb.textContent !== ptxt) { pb.textContent = ptxt; pb.hidden = !ptxt; pb.className = ms < 90 ? "good" : ms < 170 ? "ok" : "bad"; }
  const me = G.fighters[meSlot], cd = me.spec.moves.spec.cooldown || 1;
  btnSpec.style.setProperty("--cd", (me.specCd / cd).toFixed(3));
  // touch: the special glows and names itself while the opponent is at finish percent
  const bo = match.boss && bossOf(G), sf = bo ? bo.state === "broken" : match.duo ? G.fighters.some((o, i) => o.team !== me.team && hudCache[i].fin) : !!hudCache[1 - meSlot].fin;
  if (hudX.spFin !== sf) { hudX.spFin = sf; btnSpec.classList.toggle("fin", sf); btnSpec.querySelector("span").textContent = sf ? finName(me.spec) : "Special"; }   // finName: finisher.js (High Noon)
  // touch: the Special is 15% bigger while the player is in the air because of a jump. handleEvent sets hudX.jb on the
  // player's own jump (not the recovery moves); anything that is not "in the air after a jump" clears it: landing,
  // being hit (hitstun, tumble), the ledge, a KO or respawn, so a walk-off or a knock-up never boosts it.
  const jumpAir = !me.grounded && !me.tumble && (me.state === "air" || me.state === "attack" || me.state === "dodge");
  if (hudX.jb && !jumpAir) hudX.jb = false;
  if (btnSpec.classList.contains("jb") !== hudX.jb) btnSpec.classList.toggle("jb", hudX.jb);
  // touch: a ring fills on the Heavy button while a ground heavy is held and charging
  const mv = me.move, charging = me.state === "attack" && !!mv && !!mv.charge && me.chg > 0 && me.mt <= mv.startup - BL.TUNE.chgHold;
  const chv = charging ? Math.min(1, me.chg / BL.TUNE.chgMax) : 0;
  if (hudX.ch !== chv) { hudX.ch = chv; btnHeavy.style.setProperty("--ch", chv.toFixed(3)); btnHeavy.classList.toggle("chg", charging); }
  hudUlt();   // hud.js: the ultimate bars under the cards and the ULTI button
  if (match.boss) bossHud();   // ui/boss.js
}
function togglePause(force) {
  if (mode !== "match" || (G && G.phase === "over") || FIN.on) return;
  const open = force !== undefined ? force : screens.pause.hidden;
  paused = match && match.online ? false : open;
  modal("pause", open); modal("help", false);
  quitArmed = false;
  $("pResume").querySelector("span").textContent = match && match.online ? "Back to match" : "Resume";
  $("pQuit").querySelector("span").textContent = match && match.online ? "Leave match" : match && (match.ranked || match.cup || match.daily) ? "Forfeit" : "Quit to menu";
  $("pNote").textContent = match && match.online ? "Online matches keep running while this is open." : match && match.cup ? "Forfeiting ends your cup run." : match && match.daily ? "Forfeiting counts as a loss and uses up today's try." : match && match.ranked ? "Forfeiting counts as a loss." : "";
  releaseTouch();
}
let quitArmed = false;
function finishMatch(forfeit) {
  if (mode !== "match") return;
  if (match && match.tutorial) { tutDone(); return; }
  if (match && match.cup) { cupMatchEnd(forfeit); return; }
  if (match && match.daily) { dailyMatchEnd(forfeit); return; }
  if (match && match.boss) { bossMatchEnd(forfeit); return; }   // ui/boss.js
  if (match && match.duo) { duoMatchEnd(forfeit); return; }     // ui/duo.js
  if (match && match.road) { roadMatchEnd(forfeit); return; }   // ui/road.js
  const me = G.fighters[0], op = G.fighters[1];
  const res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5;
  const R = { res, forfeit, ranked: match.ranked, me, op, lines: [], total: 0 };
  if (match.ranked) {
    const before = P.rating, K = P.matches < 10 ? 48 : 32;
    const E = 1 / (1 + Math.pow(10, (match.oppRating - P.rating) / 400));
    const delta = Math.round(K * (res - E));
    P.rating = Math.max(0, P.rating + delta); P.peak = Math.max(P.peak, P.rating); P.matches++;
    if (res === 1) { P.wins++; P.streak = Math.max(0, P.streak) + 1; }
    else if (res === 0) { P.losses++; P.streak = 0; }
    else P.draws++;
    if (!forfeit) {
      if (res === 1) {
        R.lines.push(["Win", 20]);
        if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 5]);
        const sb = Math.min(20, (P.streak - 1) * 5); if (sb > 0) R.lines.push([`${P.streak} win streak`, sb]);
      } else if (res === 0.5) { R.lines.push(["Draw", 10]); if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 3]); }
      else { R.lines.push(["Match played", 6]); if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 2]); }
    }
    R.total = R.lines.reduce((a, l) => a + l[1], 0);
    P.tokens += R.total;
    P.history.unshift({ r: res, d: delta, me: me.spec.id, op: op.spec.id, opr: match.oppRating, t: Date.now() });
    P.history = P.history.slice(0, 50);
    // per-fighter record (Account > Stats): exactly the matches that count above, so the table adds up to wins / losses / draws
    const fs = P.fstats[me.spec.id] || (P.fstats[me.spec.id] = { w: 0, l: 0, d: 0 });
    fs[res === 1 ? "w" : res === 0 ? "l" : "d"]++;
    if (!P.fsince) P.fsince = Date.now();
    Object.assign(R, { before, after: P.rating, delta, tb: tierIdx(before), ta: tierIdx(P.rating) });
    saveProfile();
  }
  showResults(R);
}
// Counts a number up (or down) to its final value, ease-out: o.delay ms after the call, over o.dur ms (0.8 s if not given). Instant
// with reduced motion; a tap anywhere on the results screen, or the next results, finishes every count (and the motion) at once.
// A timer writes the final value on time even when frames come slowly (a busy phone): the number is never left short.
let resCounts = [], resRaf = 0;
const resCalm = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function resCountEnd() {
  cancelAnimationFrame(resRaf); resRaf = 0;
  for (const c of resCounts) { clearTimeout(c.tm); c.el.textContent = c.pre + c.to; if (c.end) c.end(); }
  resCounts = [];
}
function resCount(el, from, to, pre, o) {
  const still = from === to || resCalm();
  el.textContent = pre + (still ? to : from);
  if (still) return;
  const delay = (o && o.delay) || 0, dur = (o && o.dur) || 800;
  const c = { el, from, to, pre, t0: performance.now() + delay, dur, end: o && o.end };   // end: once, when the count lands or is skipped
  c.tm = setTimeout(() => { c.el.textContent = c.pre + c.to; resCounts = resCounts.filter((x) => x !== c); if (c.end) c.end(); }, delay + dur);
  resCounts.push(c);
  if (!resRaf) resRaf = requestAnimationFrame(resTick);
}
function resTick(now) {
  resCounts = resCounts.filter((c) => {
    const k = clamp((now - c.t0) / c.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    c.el.textContent = c.pre + Math.round(c.from + (c.to - c.from) * e);
    if (k >= 1) { clearTimeout(c.tm); if (c.end) c.end(); }
    return k < 1;
  });
  resRaf = resCounts.length ? requestAnimationFrame(resTick) : 0;
}
// a tap on the screen (even on a button) finishes the counts and jumps the motion (css/40-results.css) to its end
screens.result.addEventListener("pointerdown", () => { resCountEnd(); $("resSheet").classList.add("still"); }, true);
// What every results screen shares (the tutorial's too, tutorial.js): the look ("win" / "loss" / "draw"), the portrait on the panel,
// the motion started again (.in: VICTORY stamps in, the cards slide up, the bar fills, the sticker pops), the optional parts reset.
function resOpen(look, spec, solo) {
  resCountEnd();
  const sheet = $("resSheet");
  sheet.classList.remove("win", "loss", "draw", "solo", "in", "still");
  sheet.classList.add(look); sheet.classList.toggle("solo", !!solo);
  void sheet.offsetWidth; sheet.classList.add("in");
  const art = $("rArt"), src = (spec && PORTRAITS[spec.id]) || "";
  art.hidden = !src; if (src && art.getAttribute("src") !== src) art.src = src;
  $("rFin").hidden = true; $("rPick").hidden = true; $("rRank").hidden = true; $("rStats").hidden = false; masteryHide();
  $("rAgain").disabled = false; $("rAgainSub").textContent = "";
  sheet.scrollTop = 0; sheet.querySelector(".res-side").scrollTop = 0;
}
// the big word; the long ones (Opponent left, Disconnected) are set smaller so they fit the panel
function resTitle(t) { const h = $("rTitle"); h.textContent = t; h.style.setProperty("--n", t.length > 7 ? t.length + 1 : 7); }
// one line of text with bold names: strings, or { b: name } (a name a player typed goes in as text, never as markup)
function resLine(el, parts) {
  el.textContent = "";
  for (const x of parts) {
    if (x && typeof x === "object") { const b = document.createElement("b"); b.textContent = x.b; el.append(b); }
    else if (x) el.append(x);
  }
}
// The rank card: R is a ranked result (before, after, delta, tb, ta), or null for your rank as it stands (the tutorial's results).
// The bar is the tier's fill up to what you kept, then the part this match won (mint, it fills) or lost (ketchup); the sticker
// with the rating change pops after the bar.
function resRank(R) {
  const ti = tierInfo(R ? R.after : P.rating), promo = !!R && R.ta > R.tb, drop = !!R && R.ta < R.tb;
  $("rRank").hidden = false;
  $("rRank").style.setProperty("--tc", ti.t.col);
  paintBadge($("rBadge"), ti.i, promo ? R.tb : -1);   // promoted: the old emblem spins out, the new one pops in
  $("rTier").textContent = ti.t.name;
  const pr = $("rPromo"); pr.textContent = promo ? "Promoted!" : drop ? "Dropped" : ""; pr.classList.toggle("down", drop);
  const rt = $("rRating"), b = document.createElement("b");
  if (R) { const rn = document.createElement("span"); b.append(`${R.before} → `, rn); resCount(rn, R.before, R.after, "", { delay: 450 }); }
  else b.textContent = P.rating;
  rt.textContent = ""; rt.append(b, ti.next ? ` · ${ti.need} to ${ti.next.name}` : "");
  const bi = R ? tierInfo(R.before) : ti, pa = ti.p, pb = bi.i === ti.i ? bi.p : bi.i < ti.i ? 0 : 1;
  $("rBar").style.setProperty("--p", Math.min(pa, pb));
  const g = $("rGain"); g.style.setProperty("--g0", Math.min(pa, pb)); g.style.setProperty("--g1", Math.max(pa, pb));
  g.parentNode.classList.toggle("down", pa < pb);
  if (R) {
    $("rStick").className = "delta " + (R.delta >= 0 ? "up" : "down");
    resCount($("rDelta"), 0, R.delta, R.delta >= 0 ? "+" : "", { delay: 1250, dur: 400 });
  }
}
function showResults(R) {
  const ult = !!FIN.ulti;   // the KO hit was an Ultimate (finisher.js); read before finStop
  finStop();
  mode = "result"; paused = false;
  modal("pause", false); modal("help", false); hideBanner();
  $("ctl").hidden = true; $("hud").hidden = true; releaseTouch();
  const won = R.res === 1, lost = R.res === 0;
  resOpen(won ? "win" : lost ? "loss" : "draw", (lost ? R.op : R.me).spec);   // the winner's portrait; on a loss the opponent's, in grey
  $("rMode").textContent = R.online ? (R.set ? `Friendly match · best of 3 · game ${R.set.n}` : "Friendly match · online") : R.daily ? `Daily Potato · ${dailyLabel(R.daily.key)}` : R.road ? roadResMode(R) : R.boss ? `Boss fight · ${BOSS_LV[R.boss.lv]}` : R.duo ? `Team Brawl 2v2 · ${R.duo.lv}` : R.ranked ? "Ranked match" : `Practice · ${match.level}`;
  $("rWho").textContent = R.me.spec.name;
  resTitle(R.lost ? "Disconnected" : R.left ? "Opponent left" : R.forfeit ? "Forfeit" : won ? "Victory" : lost ? "Defeat" : "Draw");
  // the story in one line: who you played (the CPU's potato name, its fighter and, in ranked, its tier), lives left or how it ended
  const on = R.op.spec.name, who = R.online ? NET.oppName || "Your friend" : on;
  const foe = match.cpu && !R.online ? [{ b: match.cpu }, ` (${on}${R.ranked ? ` · ${cpuTier()}` : ""})`] : [{ b: who }];
  const how = G.sudden && G.endReason === "stocks" ? " in sudden death" : G.endReason === "time" ? " on time" : "";
  const line = R.lost ? ["The connection to ", { b: who }, " dropped."] : R.left ? [{ b: who }, " left the match."] :
    R.forfeit ? ["You left the match. It counts as a loss."] :
    won ? ["Beat ", ...foe, `${how || ` with ${R.me.stocks} ${R.me.stocks === 1 ? "life" : "lives"} left`}.`] :
    lost ? ["Lost to ", ...foe, `${how}.`] : ["Nobody scored a KO in sudden death either."];
  if (R.boss) line.splice(0, line.length, ...bossResLine(R));   // ui/boss.js: you and your partner against him
  if (R.duo) line.splice(0, line.length, ...duoResLine(R));     // ui/duo.js: both teams
  if (R.set) {
    const hi = Math.max(R.set.mine, R.set.theirs), lo = Math.min(R.set.mine, R.set.theirs);
    line.push(!R.set.over ? ` Set ${R.set.mine}–${R.set.theirs}.` : R.set.mine > R.set.theirs ? ` You win the set ${hi}–${lo}.` : R.set.mine < R.set.theirs ? ` ${who} wins the set ${hi}–${lo}.` : ` The set ends ${hi}–${lo}.`);
  }
  resLine($("rSub"), line);
  // the finisher plate, on a win: "ULTI KO | Solar Dive" or "KO | Inferno"
  const fb = match && match.finBy && !R.forfeit && !R.left && !R.lost ? match.finBy : "";
  if (match) match.finBy = "";
  masteryResults(R, !!fb && won, ult);   // ui/mastery.js: the XP, the level and the row under the rank card
  const fin = $("rFin");
  fin.hidden = !(fb && won);
  if (!fin.hidden) { const em = document.createElement("em"), sp = document.createElement("span"); em.textContent = ult ? "Ulti KO" : "KO"; sp.textContent = fb; fin.textContent = ""; fin.append(em, sp); }
  const pick = $("rPick");
  pick.hidden = !(R.set && !R.set.over && R.res !== 1 && !R.left && !R.lost);
  if (!pick.hidden) buildNextPick();
  if (R.ranked) resRank(R);
  roadResStars(R);   // ui/road.js: a Road stop's three stars
  // four tiles: KOs, damage dealt, falls, chips (counting up); the line under them says what the chips were for
  const k = R.me.kos, fl = R.me.falls;
  $("rKOs").textContent = k; $("rKOsL").textContent = k === 1 ? "KO" : "KOs";
  $("rDmg").textContent = Math.round(R.me.dmgDealt);
  $("rFalls").textContent = fl; $("rFallsL").textContent = fl === 1 ? "Fall" : "Falls";
  const why = R.why || [...R.lines.map(([n, v]) => `${n} +${v}`), ...(R.title ? [`New title: ${R.title}`] : [])].join(" · ");   // R.why: the Daily Potato's own line; R.title: a title this match earned (2v2)
  const chipsOn = R.ranked || (R.online && R.lines.length) || ((R.daily || R.road || R.duo) && R.total > 0);
  $("rStats").classList.toggle("nochips", !chipsOn); $("rChipT").hidden = !chipsOn;
  if (chipsOn) resCount($("rChipN"), 0, R.total, "", { delay: 200, dur: 600, end: () => { if (R.total > 0) Sfx.uiCoin(); } }); else $("rChipN").textContent = "0";   // done by 0.8 s, as before (tests read it at 1.1 s)
  $("rWhy").textContent = masteryWhy(chipsOn || R.daily || R.road || R.title ? why
    : R.online ? "No chips for an unfinished match. Friendly matches don't change your rating."
    : R.boss ? "Boss fights in Practice don't change your rating or earn chips."
    : R.duo ? `Team Brawl doesn't change your rating. A win on Hard pays ${DUO_CHIPS} chips.`
    : "Practice doesn't change your rating or earn chips.");
  $("rAgain").querySelector("span").textContent = R.daily ? "Menu" : R.ranked ? "Next match" : R.set && !R.set.over ? "Next game" : R.road ? roadAgainLabel() : "Rematch";
  $("rAgain").disabled = !!(R.online && (R.left || R.lost));
  $("rChange").querySelector("span").textContent = R.online ? "Lobby" : R.road ? "The Road" : "Fighters";
  $("rMenu").hidden = !!R.daily;   // one try a day: no rematch, the again button goes to the menu
  show("result");
}

// In a best-of-3, whoever lost a game may switch fighter before the next one.
function buildNextPick() {
  const row = $("rPickChips"); row.innerHTML = "";
  if (!FIG[NET.nextF]) NET.nextF = G.fighters[meSlot].spec.id;
  for (const spec of FIGHTERS) {
    const b = document.createElement("button");
    b.className = "chip" + (NET.nextF === spec.id ? " on" : ""); b.textContent = spec.name;
    b.disabled = NET.rm === NET.matchId + 1;
    b.addEventListener("click", () => { Sfx.init(); Sfx.ui(); NET.nextF = spec.id; buildNextPick(); });
    row.appendChild(b);
  }
}

