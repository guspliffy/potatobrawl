/* ===================== screens & flow ===================== */
let mode = "menu", paused = false, G = null, match = null, attract = null, tick = 0, lastCount = 0, meSlot = 0;
const screens = { menu: $("scrMenu"), select: $("scrSelect"), result: $("scrResult"), pause: $("scrPause"), help: $("scrHelp"), settings: $("scrSettings"), online: $("scrOnline") };
function show(name) { for (const k of ["menu", "select", "result", "online"]) screens[k].hidden = k !== name; }
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
  const g = newGame({ players: [{ spec: a, pal: a.palettes[(Math.random() * 4) | 0] }, { spec: b, pal: b.palettes[a === b ? 1 : 0] }], countdown: 30, stocks: 2 });
  attract = { g, b0: makeBot(0.75), b1: makeBot(0.75) };
  trails[0].length = trails[1].length = 0;
}

function renderMenu() {
  const ti = tierInfo(P.rating);
  const rank = $("mRank"); rank.style.setProperty("--tc", ti.t.col);
  paintBadge($("mBadge"), ti.i);
  $("mTier").textContent = ti.t.name;
  $("mSub").textContent = ti.next ? `${P.rating} rating · ${ti.need} to ${ti.next.name}` : `${P.rating} rating · top tier`;
  $("mBar").style.setProperty("--p", ti.p);
  $("mTokens").innerHTML = `<span class="tokglyph"></span>${P.tokens}`;
  $("mRec").textContent = `${P.wins}W · ${P.losses}L${P.streak > 1 ? ` · ${P.streak} streak` : ""}`;
  const onOk = onlineAvailable();
  $("bOnline").disabled = !onOk;
  $("mOnline").textContent = onOk ? "online" : "needs the game's web link";
  $("a2hsHint").hidden = !(FS.web && FS.ios && !FS.app && !P.a2hs);
}
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
  renderMenu(); show("menu"); resize();
  trails[0].length = trails[1].length = 0; fx.length = 0; sfx.length = 0;
  if (!attract) newAttract();
}

/* ----- fighter select: one row of fighter tiles, one detail panel for the picked fighter ----- */
const LEVELS = [{ name: "Dummy", d: -1 }, { name: "Easy", d: 0.15 }, { name: "Normal", d: 0.5 }, { name: "Hard", d: 0.9 }];
const sel = { mode: "ranked", fighter: P.last, opp: "random", level: 2, pending: null };
const cardArt = [];
function statBars(spec) {
  const s = spec.stats, mv = spec.moves;
  const heavy = [mv.hSide, mv.hUp, mv.hDown].reduce((a, m) => a + m.dmg, 0) / 3;
  const airH = (s.jump * s.jump + s.airJumps * s.airJump * s.airJump) / (2 * s.gravity);
  const q = (v, a, b) => clamp(Math.round(1 + ((v - a) / (b - a)) * 4), 1, 5);
  return [["Power", q(heavy, 11, 18)], ["Speed", q(s.run, 4.6, 7.4)], ["Weight", q(s.weight, 82, 120)], ["Air", q(airH, 260, 560)]];
}
function selPalIdx(spec) { return sel.pending && sel.pending.id === spec.id ? sel.pending.i : P.pal[spec.id] || 0; }
function buildTiles() {
  const wrap = $("tiles"); wrap.innerHTML = "";
  for (const spec of FIGHTERS) {
    const b = document.createElement("button");
    const on = sel.fighter === spec.id;
    b.className = "tile" + (on ? " on" : "");
    b.style.setProperty("--fc", col(spec.palettes[P.pal[spec.id] || 0]));
    b.setAttribute("aria-pressed", String(on));
    b.innerHTML = `${PORTRAITS[spec.id] ? `<img src="${PORTRAITS[spec.id]}" alt="">` : ""}<span>${spec.name}</span>`;
    b.addEventListener("click", () => {
      Sfx.init(); Sfx.ui();
      if (sel.fighter === spec.id) return;
      sel.fighter = spec.id; sel.pending = null; P.last = spec.id; saveProfile();
      buildTiles(); buildDetail();
    });
    wrap.appendChild(b);
  }
}
function buildDetail() {
  const spec = FIG[sel.fighter], pi = selPalIdx(spec), pal = spec.palettes[pi] || spec.palettes[0];
  const d = $("detail");
  d.style.setProperty("--fc", col(pal));
  d.style.setProperty("--fcglow", rgba(col(pal), 0.34));
  $("dName").textContent = spec.name;
  $("dRole").textContent = spec.role;
  $("dBlurb").textContent = spec.blurb;
  $("dStats").innerHTML = statBars(spec).map(([n, v]) => `<span>${n}</span><span class="seg" aria-label="${n} ${v} of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? "on" : ""}"></i>`).join("")}</span>`).join("");
  $("dSig").innerHTML = `<b>${spec.signature.name}</b><span>${spec.signature.text}</span>`;
  const pals = $("dPals"); pals.innerHTML = "";
  spec.palettes.forEach((p, i) => {
    const own = P.owned[spec.id].includes(i), cur = (P.pal[spec.id] || 0) === i, pend = !!sel.pending && sel.pending.id === spec.id && sel.pending.i === i;
    const b = document.createElement("button");
    b.className = `sw${cur ? " cur" : ""}${own ? "" : " lock"}${pend ? " pending" : ""}`;
    b.style.setProperty("--c", col(p));
    b.setAttribute("aria-label", `${p.name}${own ? "" : `, locked, ${p.price} chips`}`);
    b.innerHTML = `<i>${i ? `<em>${"✦".repeat(i)}</em>` : ""}</i>${own ? p.name : `<span><span class="tokglyph"></span>${p.price}</span>`}`;
    b.addEventListener("click", () => {
      Sfx.init(); Sfx.ui();
      if (own) { P.pal[spec.id] = i; sel.pending = null; saveProfile(); }
      else sel.pending = { id: spec.id, i }; // locked: preview it on the model; the Upgrade button buys it
      buildTiles(); buildDetail();
    });
    pals.appendChild(b);
  });
  $("dNote").textContent = skinNote(spec, pi);
  // the big model shows the skin being looked at, locked or not
  const f = BL.newGame({ players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
  f.x = 0; f.y = 0; f.facing = 1;
  cardArt.length = 0;
  cardArt.push({ cv: $("dArt"), f, fit: 0.74, bottom: 0.93 });
  $("selTokens").textContent = P.tokens;
  updateUpgrade();
}
function buildCards() { buildTiles(); buildDetail(); }
function skinNote(spec, i) {
  const p = spec.palettes[i], fx = FXTEXT[spec.id] && FXTEXT[spec.id][i];
  return `${p.name}: ${fx || "base look"}.`;
}
function updateUpgrade() {
  const btn = $("selUp"), pd = sel.pending;
  btn.hidden = !pd;
  if (!pd) return;
  const spec = FIG[pd.id], p = spec.palettes[pd.i], short = p.price - P.tokens;
  btn.disabled = short > 0;
  btn.querySelector("span").textContent = "Upgrade";
  if (short > 0) $("dNote").textContent = `${skinNote(spec, pd.i)} ${short} more chips needed.`;
  btn.setAttribute("aria-label", short > 0 ? `${p.name} costs ${p.price} chips, you need ${short} more` : `Upgrade ${spec.name} to ${p.name} for ${p.price} chips`);
}
function buyPending() {
  const pd = sel.pending;
  if (!pd) return;
  const spec = FIG[pd.id], p = spec.palettes[pd.i];
  if (P.tokens < p.price || P.owned[spec.id].includes(pd.i)) { updateUpgrade(); return; }
  P.tokens -= p.price; P.owned[spec.id].push(pd.i); P.pal[spec.id] = pd.i; sel.pending = null; saveProfile();
  Sfx.ui();
  buildTiles(); buildDetail();
  $("dNote").textContent = `Upgraded to ${p.name}. ${FXTEXT[spec.id][pd.i] || ""}`.trim();
}
// a tall, narrow stage (desktop) shows the model smaller so wings and tails stay in view
function artFit(a) { const w = a.cv.clientWidth, h = a.cv.clientHeight || 1; return Math.min(a.fit || 0.7, Math.max(0.42, (a.fit || 0.7) * 1.1 * w / h)); }
function drawCards(tk) {
  if (R3.on) return;
  for (const a of cardArt) {
    const r = { width: a.cv.clientWidth, height: a.cv.clientHeight };
    if (!r.width) continue;
    const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR);
    if (a.cv.width !== w || a.cv.height !== h) { a.cv.width = w; a.cv.height = h; }
    const c = a.cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    const sc = (h * artFit(a)) / a.f.s.h;
    c.setTransform(sc, 0, 0, sc, w * 0.5, h * (a.bottom || 0.95));
    drawFighter(c, a.f, tk);
  }
}
/* practice: opponent and CPU level are small pickers in the header */
function closePops() { $("oppPop").hidden = true; $("lvlPop").hidden = true; }
function buildPractice() {
  $("oppPick").innerHTML = `<small>vs</small>${sel.opp === "random" ? "Random" : FIG[sel.opp].name}`;
  $("lvlPick").innerHTML = `<small>CPU</small>${LEVELS[sel.level].name}`;
  const fill = (pop, items, isOn, pick) => {
    pop.innerHTML = "";
    items.forEach((it) => {
      const b = document.createElement("button");
      b.textContent = it.label; if (isOn(it)) b.className = "on";
      b.addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); Sfx.ui(); pick(it); closePops(); buildPractice(); });
      pop.appendChild(b);
    });
  };
  fill($("oppPop"), [{ id: "random", label: "Random" }, ...FIGHTERS.map((f) => ({ id: f.id, label: f.name }))], (it) => it.id === sel.opp, (it) => { sel.opp = it.id; });
  fill($("lvlPop"), LEVELS.map((l, i) => ({ i, label: l.name })), (it) => it.i === sel.level, (it) => { sel.level = it.i; });
}
for (const [btn, pop] of [["oppPick", "oppPop"], ["lvlPick", "lvlPop"]]) {
  $(btn).addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); Sfx.ui(); const open = $(pop).hidden; closePops(); $(pop).hidden = !open; });
}
app.addEventListener("click", (e) => { if (!e.target.closest(".pickwrap")) closePops(); });
function openSelect(m) {
  sel.mode = m; sel.pending = null;
  mode = "select";
  const ti = tierInfo(P.rating);
  $("selMode").textContent = m === "ranked" ? `Ranked match · ${ti.t.name} ${P.rating}` : m === "online" ? "Play friends" : "Practice · no rating, no chips";
  $("pracOpts").hidden = m !== "practice"; closePops();
  $("selGo").querySelector("span").textContent = m === "online" ? "Done" : "Fight";
  buildCards(); if (m === "practice") buildPractice();
  show("select"); $("hud").hidden = true; $("ctl").hidden = true; resize();
}

/* ----- match ----- */
function startMatch() {
  Sfx.init();
  const ranked = sel.mode === "ranked";
  const me = FIG[sel.fighter], myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  let opp, d, oppRating = 0;
  if (ranked) {
    opp = FIGHTERS[(Math.random() * FIGHTERS.length) | 0];
    oppRating = clamp(Math.round(P.rating + (Math.random() - 0.5) * 140), 600, 2100);
    d = clamp((oppRating - 750) / 1000, 0.08, 0.98);
  } else {
    opp = sel.opp === "random" ? FIGHTERS[(Math.random() * FIGHTERS.length) | 0] : FIG[sel.opp];
    d = LEVELS[sel.level].d;
  }
  let oppPal = opp.palettes[0];
  if (opp.id === me.id) oppPal = opp.palettes[(P.pal[me.id] + 1) % opp.palettes.length];
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: oppPal }], stocks: 3, time: 240, countdown: 150 });
  match = { ranked, d, oppRating, bot: makeBot(d), level: ranked ? null : LEVELS[sel.level].name };
  meSlot = 0;
  enterMatchUI();
}
function enterMatchUI() {
  finStop();
  mode = "match"; paused = false; lastCount = 0;
  show(null); hideOnline(); modal("pause", false); modal("help", false); modal("settings", false);
  $("hud").hidden = false; $("ctl").hidden = !touchUI; $("netBadge").hidden = true; $("pingBadge").hidden = true; $("pingBadge").textContent = "";
  [0, 1].forEach((i) => {
    const f = G.fighters[i], el = $("pc" + i);
    el.style.setProperty("--fc", col(f.pal));
    el.querySelector(".pc-name").textContent = f.spec.name;
    el.querySelector(".pc-tag").textContent = i === meSlot ? "You" : match.online ? NET.oppName || "Friend" : "CPU";
    hudCache[i] = { pct: -1, stocks: -1, out: null };
  });
  btnSpec.style.setProperty("--fc", col(G.fighters[meSlot].pal));
  hudX.spFin = null; hudX.ch = -1; hudX.jb = false; btnSpec.classList.remove("fin", "jb"); btnSpec.querySelector("span").textContent = "Special";
  btnHeavy.classList.remove("chg", "chgfull"); btnHeavy.style.setProperty("--ch", "0");
  for (const e of document.querySelectorAll(".pcard")) e.classList.remove("finr");
  fx.length = 0; sfx.length = 0; trails[0].length = trails[1].length = 0; combos[0] = combos[1] = null;
  if (!match.tutorial) tutEnd(); else { $("tut").hidden = false; app.classList.add("tut"); }
  releaseTouch(); resize(); camStep(G, true);
}
const hudCache = [{}, {}], hudX = { spFin: null, ch: -1, jb: false };
const btnSpec = document.querySelector('.pb[data-k="special"]'), btnHeavy = document.querySelector('.pb[data-k="heavy"]');
// A fighter at finish percent just crossed it: tell both players once, in the colour of the fighter who can finish.
function finReady(i) {
  if (!G || G.phase !== "play" || (match && match.tutorial)) return;
  const att = G.fighters[1 - i];
  showBanner("Finish!", `${att.spec.signature.name} KOs now`, "fin", 1100, col(att.pal));
  Sfx.tone(330, 740, 0.22, "sawtooth", 0.06); Sfx.noise(0.16, 0.22, 3200);
}
function vsLine() {
  const me = G.fighters[meSlot].spec.name, op = G.fighters[1 - meSlot].spec.name;
  if (match.online) return `${me} vs ${op} · ${NET.oppName || "Friend"}, online`;
  if (match.ranked) { const ti = tierInfo(match.oppRating); return `${me} vs ${op} · CPU ${ti.t.name} ${match.oppRating}`; }
  return `${me} vs ${op} · ${match.level}`;
}
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
  for (let i = 0; i < 2; i++) {
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
  const sf = !!hudCache[1 - meSlot].fin;
  if (hudX.spFin !== sf) { hudX.spFin = sf; btnSpec.classList.toggle("fin", sf); btnSpec.querySelector("span").textContent = sf ? me.spec.signature.name : "Special"; }
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
}
function togglePause(force) {
  if (mode !== "match" || (G && G.phase === "over") || FIN.on) return;
  const open = force !== undefined ? force : screens.pause.hidden;
  paused = match && match.online ? false : open;
  modal("pause", open); modal("help", false);
  quitArmed = false;
  $("pResume").querySelector("span").textContent = match && match.online ? "Back to match" : "Resume";
  $("pQuit").querySelector("span").textContent = match && match.online ? "Leave match" : match && match.ranked ? "Forfeit" : "Quit to menu";
  $("pNote").textContent = match && match.online ? "Online matches keep running while this is open." : match && match.ranked ? "Forfeiting counts as a loss." : "";
  releaseTouch();
}
let quitArmed = false;
function finishMatch(forfeit) {
  if (mode !== "match") return;
  if (match && match.tutorial) { tutDone(); return; }
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
    P.history = P.history.slice(0, 20);
    Object.assign(R, { before, after: P.rating, delta, tb: tierIdx(before), ta: tierIdx(P.rating) });
    saveProfile();
  }
  showResults(R);
}
function showResults(R) {
  finStop();
  mode = "result"; paused = false;
  modal("pause", false); modal("help", false); hideBanner();
  $("ctl").hidden = true; $("hud").hidden = true; releaseTouch();
  const sheet = $("resSheet");
  sheet.classList.remove("solo");
  sheet.classList.toggle("win", R.res === 1); sheet.classList.toggle("loss", R.res === 0);
  $("rMode").textContent = R.online ? (R.set ? `Friendly match · best of 3 · game ${R.set.n}` : "Friendly match · online") : R.ranked ? "Ranked match" : `Practice · ${match.level}`;
  $("rTitle").textContent = R.lost ? "Disconnected" : R.left ? "Opponent left" : R.forfeit ? "Forfeit" : R.res === 1 ? "Victory" : R.res === 0 ? "Defeat" : "Draw";
  const mn = R.me.spec.name, on = R.op.spec.name;
  const who = R.online ? NET.oppName || "Your friend" : on;
  const how = G.sudden && G.endReason === "stocks" ? " in sudden death" : G.endReason === "time" ? " on time" : "";
  $("rSub").textContent = R.lost ? `The connection to ${who} dropped.` : R.left ? `${who} left the match.` :
    R.online && R.res === 1 ? `You beat ${who}${how || ` with ${R.me.stocks} ${R.me.stocks === 1 ? "life" : "lives"} left`}.` :
    R.online && R.res === 0 ? `${who} beat you${how}.` :
    R.forfeit ? "You left the match. It counts as a loss." :
    R.res === 1 ? `${mn} beat ${on}${how || ` with ${R.me.stocks} ${R.me.stocks === 1 ? "life" : "lives"} left`}.` :
    R.res === 0 ? `${on} beat ${mn}${how}.` : "Nobody scored a KO in sudden death either.";
  if (R.set) {
    const hi = Math.max(R.set.mine, R.set.theirs), lo = Math.min(R.set.mine, R.set.theirs);
    $("rSub").textContent += !R.set.over ? ` Set ${R.set.mine}–${R.set.theirs}.` : R.set.mine > R.set.theirs ? ` You win the set ${hi}–${lo}.` : R.set.mine < R.set.theirs ? ` ${who} wins the set ${hi}–${lo}.` : ` The set ends ${hi}–${lo}.`;
  }
  const pick = $("rPick");
  pick.hidden = !(R.set && !R.set.over && R.res !== 1 && !R.left && !R.lost);
  if (!pick.hidden) buildNextPick();
  $("rRank").hidden = !R.ranked;
  if (R.ranked) {
    const ti = tierInfo(R.after);
    $("rRank").style.setProperty("--tc", ti.t.col);
    paintBadge($("rBadge"), ti.i);
    $("rTier").textContent = ti.t.name;
    $("rRating").textContent = `${R.before} → ${R.after}${ti.next ? ` · ${ti.need} to ${ti.next.name}` : ""}`;
    const bar = $("rBar"); bar.style.setProperty("--p", tierInfo(R.before).i === ti.i ? tierInfo(R.before).p : 0);
    requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty("--p", ti.p)));
    const d = $("rDelta"); d.textContent = (R.delta >= 0 ? "+" : "") + R.delta; d.className = "delta " + (R.delta >= 0 ? "up" : "down");
    $("rPromo").textContent = R.ta > R.tb ? `Promoted to ${TIERS[R.ta].name}` : R.ta < R.tb ? `Dropped to ${TIERS[R.ta].name}` : "";
  }
  const k = R.me.kos, fl = R.me.falls;
  $("rStats").innerHTML = `<b>${k}</b> KO${k === 1 ? "" : "s"} · <b>${Math.round(R.me.dmgDealt)}%</b> damage dealt · <b>${fl}</b> fall${fl === 1 ? "" : "s"}`;
  const why = R.lines.length > 1 ? R.lines.map(([n, v]) => `${n} +${v}`).join(" · ") : R.lines.length ? R.lines[0][0] : "";
  $("rChips").innerHTML = R.ranked || (R.online && R.lines.length)
    ? `<b><span class="tokglyph"></span>+${R.total} chips</b>${why}`
    : R.online ? "No chips for an unfinished match. Friendly matches don't change your rating."
    : "Practice doesn't change your rating or earn chips.";
  $("rAgain").querySelector("span").textContent = R.ranked ? "Next match" : R.set && !R.set.over ? "Next game" : "Rematch";
  $("rAgain").disabled = !!(R.online && (R.left || R.lost));
  $("rChange").querySelector("span").textContent = R.online ? "Lobby" : "Fighters";
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

