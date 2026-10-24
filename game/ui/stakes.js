/* ===================== Chip stakes: a rematch for 10, 25 or 50 chips (the server side is quick.js) =====================
   After every result the server referees (Ranked, a Casual game between two accounts, a Play friends 1v1) both players hear which
   stakes the two of them can play (`sk` on qm-res, qm-cs and qm-sk). The results offer it: Casual and Play friends keep the gold
   Rematch and gain an end segment FOR CHIPS; Ranked and a staked match get REMATCH FOR CHIPS in the second row. The stake sheet picks
   10 / 25 / 50 and sends the challenge (stk); the other player gets the challenge card on whatever screen they are on (results,
   Quick match, the menu, Play friends) with 30 s to answer. An accepted challenge is a match the server assigns like a Ranked one
   (qm-found {sk}): the VS screen says REMATCH · FOR CHIPS with the pot, the results show the pot card in the rank card's place, and
   the server writes the chips into both account files. This page never adds the pot to P.tokens: the next sync brings it (adding
   it here too would pay it twice), as with the bounty. Chips are never bought, traded or cashed out; a stake is only ever a rematch,
   5 a day, after 10 refereed matches, ranks within 250 (Play friends: any). Settings > Chip stakes Off hides all of it on this
   phone and the server refuses challenges to it (prof.so, synced with the account). Fable's design: rival-stakes/fable-design.md.
   Styles: css/98-stakes.css. */
const STK_S = [10, 25, 50];
const STK_EARLY = 150 + 30 * 60;   // quick.js EARLY: leaving before this frame (the countdown + 30 s of fight) is no result
const STK = {
  el: null,       // { ok, why, k, id, g } the stakes both can play after the last refereed result, and the game it followed
  out: null,      // { s, t0, ms, name } my challenge, waiting for an answer
  inc: null,      // { s, t0, ms, name } a challenge for me
  busy: 0,        // the stake being sent (> 0) or accepted (< 0) while the account syncs first
  acc: 0,         // the stake I accepted, until its match is found
  pick: 25, note: "", noteT: 0,
  pend: null,     // { id, s, name, t0 } the staked match: its id, the stake, the opponent, the chips before it
  res: null,      // { id, res, why, s, d } the verdict of the last staked match (qm-sk)
  applied: [], fr: null,
};
const stkOn = () => qmOn() && P.so !== 1;
const stkSend = (m) => !!(window.__blQuick && window.__blQuick.send(m));
// the server's sk: the stakes both can play now, or why not (and how many refereed matches to go)
function stkClean(o) {
  if (!o || typeof o !== "object") return null;
  return { ok: Array.isArray(o.ok) ? STK_S.filter((s) => o.ok.includes(s)) : [], why: typeof o.why === "string" ? o.why.slice(0, 8) : "", k: Number.isInteger(o.k) && o.k > 0 && o.k <= 10 ? o.k : 0 };
}
// me.sk: today's staked matches, the record and the net chips (qmClean keeps it)
function stkRec(o) {
  const n = (v, lo) => (Number.isInteger(v) && v >= lo && v < 1e7 ? v : 0);
  o = o && typeof o === "object" ? o : {};
  return { n: n(o.n, 0), w: n(o.w, 0), l: n(o.l, 0), net: n(o.net, -1e7), day: Number.isInteger(o.day) && o.day > 0 && o.day < 100 ? o.day : 5 };
}
function stkWhy(why, k, name) {
  return why === "new" ? _t("Stakes unlock after 10 online matches · {n} to go", { n: k || 10 }) : why === "day" ? _t("Daily limit reached · back tomorrow")
    : why === "gap" ? _t("Rank gap too big") : why === "chips" ? _t("Not enough chips") : why === "them" ? _t("{name} can't stake right now", { name })
    : why === "hold" ? _t("The server is updating · try again in a minute") : why === "late" ? _t("Too late for this rematch") : why === "off" ? _t("Chip stakes are off in Settings") : "";
}
function stkNote(t) { STK.note = t; STK.noteT = performance.now(); }
const stkMs = (ms) => (Number.isInteger(ms) && ms >= 3000 && ms <= 60000 ? ms : 30000);
// the refereed game the results on screen are about: Quick match (Ranked and staked: game 1) or a Play friends 1v1
function stkShown() {
  if (mode !== "result" || !match || !match.online || match.boss || match.tb) return null;
  if (match.qm) { const hard = !!(match.qm.ranked || match.qm.sk); return { id: match.qm.id, g: hard ? 1 : NET.matchId, hard, name: match.qm.opp.name }; }
  return NET.mrCode ? { id: NET.mrCode, g: NET.matchId, hard: false, pf: true, name: NET.oppName || _t("Your friend") } : null;
}
const stkElFor = (k) => (k && STK.el && STK.el.id === k.id && STK.el.g === k.g ? STK.el : null);

/* ----- the server's words ----- */
// qm-res (game 1), qm-cs (its game), qm-sk (game 1): who can stake now
function stkGot(m, g) {
  const el = stkClean(m.sk);
  if (!el) return;
  STK.el = Object.assign(el, { id: m.id, g });
  stkRender();
}
function stkMsg(m) {
  if (m.t === "stk-out") {
    if (!STK_S.includes(m.s)) return;
    if (STK.busy !== m.s) { stkSend({ t: "stkx" }); return; }   // cancelled while it was on its way
    const k = stkShown();
    STK.busy = 0; STK.note = ""; STK.out = { s: m.s, t0: performance.now(), ms: stkMs(m.ms), name: k ? k.name : NET.oppName || _t("your opponent") };
  } else if (m.t === "stk-in") {
    if (!STK_S.includes(m.s)) return;
    if (!stkOn()) { stkSend({ t: "stkx" }); return; }
    STK.inc = { s: m.s, t0: performance.now(), ms: stkMs(m.ms), name: SYNC.cleanName(typeof m.name === "string" ? m.name : "") || "Potato" };
    Sfx.init(); Sfx.tone(988, 988, 0.1, "triangle", 0.06); Sfx.at(0.11, 1319, 1319, 0.2, "triangle", 0.06);   // a soft chime, no ticking (Fable)
    try { if (navigator.vibrate) navigator.vibrate(70); } catch (e) { /* no vibration */ }
  } else if (m.t === "stk-off") {
    const out = STK.out, mine = STK.acc || STK.busy < 0;
    STK.out = null; STK.inc = null; STK.acc = 0; STK.busy = 0;
    // the challenger hears the same words for a decline, a timeout or the other one leaving; the one who passed hears nothing
    if (out) stkNote(m.why === "no" || m.why === "x" ? _t("No answer from {name} · the stake is off", { name: out.name }) : _t("The stake is off · {why}", { why: stkWhy(m.why, 0, out.name) || _t("try again") }));
    else if (mine) stkNote(m.why === "no" || m.why === "x" ? _t("Too late · the stake is off") : _t("The stake is off · {why}", { why: stkWhy(m.why, 0, _t("They")) || _t("try again") }));
  } else if (m.t === "stk-no") {
    const k = stkShown(), el = stkElFor(k);
    STK.busy = 0;
    stkNote(stkWhy(m.why, el ? el.k : 0, k ? k.name : _t("They")) || _t("Couldn't send the challenge"));
  }
  stkRender();
}
// qm-found {sk}: only the stake this phone challenged for or accepted
const stkFoundOk = (m) => Number.isInteger(m.sk) && STK_S.includes(m.sk) && ((!!STK.out && STK.out.s === m.sk) || STK.acc === m.sk);
function stkFound(m) {
  STK.out = null; STK.inc = null; STK.acc = 0; STK.busy = 0; STK.note = ""; STK.res = null;
  STK.pend = { id: m.id, s: m.sk, name: m.opp.name, t0: P.tokens };
  modal("stake", false);
  stkRender();
}
// qm-sk: a staked match decided (the server wrote the chips into both accounts)
function stkRes(m) {
  if (!m || typeof m.id !== "string" || STK.applied.includes(m.id) || ![1, 0.5, 0, null].includes(m.res) || !STK_S.includes(m.s)) return;
  STK.applied.push(m.id); if (STK.applied.length > 8) STK.applied.shift();
  const d = Number.isInteger(m.d) && Math.abs(m.d) <= m.s ? m.d : 0, p = STK.pend && STK.pend.id === m.id ? STK.pend : null;
  STK.res = { id: m.id, res: m.res, why: typeof m.why === "string" ? m.why.slice(0, 8) : "", s: m.s, d };
  if (m.rv) rvGot(m.rv, m.id, 1);   // ui/rivals.js
  const me = qmMe();
  if (me) {
    if (Number.isInteger(m.gn)) me.g = m.gn;
    if (Number.isInteger(m.day)) me.sk.n = m.day;
    if (d > 0) me.sk.w++; else if (d < 0) me.sk.l++;
    me.sk.net += d;
    qmSave();
  }
  if (d) acctSoon(800);   // acct.js: the pot is in the account file now
  stkGot(m, 1);
  if (mode === "result" && QM.shown && QM.shown.qm && QM.shown.qm.id === m.id) stkPotView(true);
  else if (p && QM.st === "found" && !(match && match.qm && match.qm.id === m.id)) {
    // decided before the fight began on this phone: the host's game wasn't the assigned one, or nobody played
    $("qmVs").hidden = true; $("qmFound").hidden = true; QM.vsT = 0; QM.fdT = 0;
    if (NET.mr) leaveMatchRoom();
    resetNet(); NET.phase = "idle"; QM.st = "idle"; QM.found = null; STK.pend = null;
    QM.note = m.res === null ? _t("That match was called off. No chips moved.") : d > 0 ? _t("{name}'s game didn't match the server's. You take the pot (+{d}).", { name: p.name, d }) : _t("Your game didn't match the server's. Reload the page.");
    quickOpen();
  }
}
// qmOff: a staked match that never started: no search to go back to
function stkOff(m) {
  if (!STK.pend || STK.pend.id !== m.id) return false;
  QM.note = _t("{name} didn't connect. The stake is off.", { name: STK.pend.name });
  STK.pend = null;
  return true;
}

/* ----- challenge and answer ----- */
// the server checks the chips in the account file: this phone's newest first (2.5 s at most)
const stkSynced = () => Promise.race([Promise.resolve().then(() => acctSync()).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
async function stkChallenge() {
  const el = stkElFor(stkShown()), s = STK.pick;
  if (!el || !el.ok.includes(s) || STK.busy || STK.out || STK.inc) return;
  modal("stake", false);
  STK.busy = s; STK.note = ""; stkRender();
  await stkSynced();
  if (STK.busy !== s) return;   // cancelled meanwhile
  if (!stkSend({ t: "stk", s })) { STK.busy = 0; stkNote(_t("Couldn't reach the server")); }
  stkRender();
}
function stkCancel() {
  if (STK.out) stkSend({ t: "stkx" });
  STK.out = null; if (STK.busy > 0) STK.busy = 0;
  stkRender();
}
async function stkAccept() {
  const x = STK.inc;
  if (!x || STK.busy) return;
  STK.busy = -x.s; stkRender();
  await stkSynced();
  if (STK.inc !== x) { STK.busy = 0; stkRender(); return; }   // off meanwhile
  STK.inc = null; STK.busy = 0; STK.acc = x.s;
  if (!stkSend({ t: "stk-ok" })) STK.acc = 0;
  stkRender();
}
function stkDecline() { if (!STK.inc) return; STK.inc = null; if (STK.busy < 0) STK.busy = 0; stkSend({ t: "stkx" }); stkRender(); }
// leaving the results (menus.js): a challenge still out is withdrawn
function stkLeave() { if (STK.out || STK.busy > 0) stkCancel(); STK.note = ""; }

/* ----- the results: FOR CHIPS, the reason it can't, the pending challenge ----- */
function stkRender() { stkButtons(); stkCard(); if (!screens.stake.hidden) stkSheetFill(); }
function stkButtons() {
  const b = $("rStake"), why = $("rStakeWhy"), acts = why.parentNode;
  if (mode !== "result") return;
  const k = stkShown(), el = stkElFor(k), midSet = k && k.pf && NET.setRes && !NET.setRes.over;   // a best of 3 plays out first
  // after Ranked (or a staked match) REMATCH FOR CHIPS takes the Quick match button's place, so it shows only while it can be used:
  // a dimmed one there would hide Quick match from every new player for their first 10 matches
  const going = !!STK.out || STK.busy > 0;
  const show = !!el && stkOn() && el.why !== "off" && el.why !== "acct" && !midSet && (!k.hard || el.ok.length > 0 || going), wait = show && going;
  acts.classList.toggle("stk-seg", show && !k.hard); acts.classList.toggle("stk-row", show && k.hard); acts.classList.toggle("stk-wait", wait);
  b.hidden = !show;
  const note = STK.note && performance.now() - STK.noteT < 9000 ? STK.note : "", can = show && el.ok.length > 0;
  why.textContent = !show || wait ? "" : note || (can ? "" : stkWhy(el.why, el.k, k.name));
  why.hidden = !why.textContent;
  if (!show) return;
  b.disabled = !can && !wait; b.classList.toggle("dim", !can && !wait);
  const key = wait ? (STK.out ? `o${STK.out.s}` : "s") : k.hard ? "row" : "seg";
  if (b.dataset.k !== key) {
    b.dataset.k = key; b.textContent = "";
    if (key === "row") { b.append(acMk("span", "", _t("Rematch"))); const sm = acMk("small", "sk-for"); sm.append(rvCg(), _t("for chips")); b.append(sm); }
    else { const l = acMk("span", "sk-l"); l.append(rvCg(), key === "seg" ? _t("For chips") : key === "s" ? _t("Sending…") : _t("{n} sent · waiting for {name}", { n: STK.out.s, name: STK.out.name })); b.append(l, acMk("small", "sk-t", "")); }
  }
  b.setAttribute("aria-label", wait ? _t("Challenge sent. Tap to cancel") : _t("Rematch for chips"));
  stkClock();
}
// the pending challenge's clock under its button, the challenge card's clock and bar
function stkClock() {
  const now = performance.now();
  if (STK.out && !$("rStake").hidden) { const t = $("rStake").querySelector(".sk-t"); if (t) t.textContent = _t("{t} · tap to cancel", { t: qmClock(Math.max(0, (STK.out.ms - (now - STK.out.t0)) / 1000)) }); }
  if (STK.inc && !$("stkCard").hidden) {
    const left = Math.max(0, STK.inc.ms - (now - STK.inc.t0));
    $("skcTime").textContent = _t("{t} to decide", { t: qmClock(left / 1000) });
    $("skcBar").style.transform = `scaleX(${(left / STK.inc.ms).toFixed(3)})`;
  }
}
function stkClear() {
  const acts = $("rStakeWhy").parentNode;
  acts.classList.remove("stk-seg", "stk-row", "stk-wait");
  $("rStake").hidden = true; $("rStake").dataset.k = ""; $("rStakeWhy").hidden = true; $("rPot").hidden = true;
  STK.fr = null; STK.note = "";
}
// screens.js showResults: a Play friends 1v1 (the referee's record and stakes, once it has counted the game)
function stkFriend(R) { STK.fr = R; rvFriendRes(R); stkButtons(); }
tap("rStake", () => {
  if (STK.out) { stkCancel(); return; }
  if (STK.busy) return;
  if (STK.inc) { const c = $("stkCard"); c.classList.remove("nudge"); void c.offsetWidth; c.classList.add("nudge"); return; }   // answer theirs first
  stkSheet();
});

/* ----- the stake sheet ----- */
function stkSheet() {
  const k = stkShown(), el = stkElFor(k);
  if (!el || !el.ok.length) return;
  if (!el.ok.includes(STK.pick)) STK.pick = el.ok.includes(25) ? 25 : el.ok[el.ok.length - 1];
  stkSheetFill();
  modal("stake", true);
}
function stkSheetFill() {
  const k = stkShown(), el = stkElFor(k);
  if (!el || !el.ok.length || STK.out || STK.inc) { modal("stake", false); return; }
  $("skWho").textContent = _t("vs {name}", { name: k.name });
  const row = $("skTiles"); row.textContent = "";
  for (const s of STK_S) {
    const on = el.ok.includes(s), b = acMk("button", "sk-tile" + (s === STK.pick ? " on" : ""));
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(s === STK.pick)); b.disabled = !on;
    const n = acMk("b"); n.append(rvCg(), String(s));
    b.append(n, acMk("small", "", on ? _t("pot {n}", { n: s * 2 }) : _t("not enough chips")));
    b.addEventListener("click", () => { Sfx.init(); Sfx.ui(); STK.pick = s; stkSheetFill(); });
    row.appendChild(b);
  }
  const me = qmMe(), sk = me ? me.sk : stkRec(null);
  $("skHave").textContent = _t("You have {chips} · {n} of {day} today", { chips: fmtChips(P.tokens), n: sk.n, day: sk.day });
  $("skSend").querySelector("span").textContent = _t("Challenge for {n}", { n: STK.pick });
}
tap("skSend", stkChallenge);
tap("skNo", () => modal("stake", false));
tap("stkClose", () => modal("stake", false));

/* ----- the challenge card: over the results' right column (sideways), else at the bottom of any screen but a fight ----- */
function stkCard() {
  const c = $("stkCard"), x = STK.inc, show = !!x && stkOn() && mode !== "match" && $("qmVs").hidden && $("qmFound").hidden;
  if (c.hidden === show) { c.hidden = !show; if (show) { c.classList.remove("in", "nudge"); void c.offsetWidth; c.classList.add("in"); } }
  if (!show) return;
  const side = mode === "result" && !L.portrait ? document.querySelector("#resSheet .res-side") : null, host = side || $("app");
  if (c.parentNode !== host) host.appendChild(c);
  c.classList.toggle("side", !!side);
  const key = `${x.s}:${x.name}:${STK.busy}`;
  if (c.dataset.k !== key) {
    c.dataset.k = key;
    const h = $("skcT"); h.textContent = ""; const amt = acMk("span", "sk-nw"); amt.append(rvCg(), String(x.s)); const wt = _t("{name} wants a rematch for {amt}", { name: x.name, amt: "\u0001" }).split("\u0001"); h.append(wt[0], amt, wt[1] || "");   // the coin stays with its number
    $("skcL").textContent = _t("Winner takes {n} · same fighters · 3 lives · 4:00 · not Ranked. Nothing happens if you pass.", { n: x.s * 2 });
    const ok = $("skcOk"); ok.textContent = ""; ok.disabled = STK.busy < 0;
    const sp = acMk("span"); sp.append(STK.busy < 0 ? _t("Starting…") : `${_t("Accept")} `, ...(STK.busy < 0 ? [] : [rvCg(), String(x.s)])); ok.append(sp);
  }
  stkClock();
}
tap("skcOk", stkAccept);
tap("skcNo", stkDecline);

// qmTick: the clocks, a challenge the server never answered (gone quiet), the note fading out
function stkTick() {
  const now = performance.now();
  if (STK.out && now - STK.out.t0 > STK.out.ms + 4000) { stkNote(_t("No answer from {name} · the stake is off", { name: STK.out.name })); STK.out = null; stkRender(); }
  if (STK.inc && now - STK.inc.t0 > STK.inc.ms + 1000) { STK.inc = null; if (STK.busy < 0) STK.busy = 0; stkRender(); }
  if (STK.note && now - STK.noteT > 9000) { STK.note = ""; stkButtons(); }
  stkCard(); stkClock();
}

/* ----- a staked match: the VS screen's pot, the results' pot card ----- */
function stkVs(m) {
  const p = $("vsPot");
  p.hidden = !m.sk;
  if (!m.sk) return;
  p.textContent = ""; p.append(rvCg(), acMk("b", "", _t("{n} pot", { n: m.sk * 2 })), acMk("span", "", ` · ${_t("{n} each", { n: m.sk })}`));
}
// qmResults: the pot card while the referee confirms, then its verdict
function stkResults(R) {
  const q = R.qm, card = $("rPot"), st = $("rPotD");
  if (STK.pend && STK.pend.id === q.id) STK.pend.tr = P.tokens;   // every chip this match gave on the phone, before the pot's sync
  $("rRank").hidden = true; card.hidden = false; card.className = "card res-pot wait";
  stkPotHead(_t("{n} pot", { n: q.sk * 2 }));
  $("rPotS").textContent = _t("Checking with the referee…");
  st.className = "delta wait"; $("rPotN").textContent = "…"; st.querySelector("small").textContent = _t("Confirming");
  if (STK.res && STK.res.id === q.id) stkPotView(false);
}
function stkPotHead(t) { const h = $("rPotH"); h.textContent = ""; h.append(rvCg(), t); }
function stkPotView(late) {
  const v = STK.res, R = QM.shown;
  if (!v || !R || !R.qm || R.qm.id !== v.id || mode !== "result") return;
  const card = $("rPot"), st = $("rPotD"), sub = $("rPotS"), name = R.qm.opp ? R.qm.opp.name : _t("They"), s = v.s, pot = s * 2;
  const p = STK.pend && STK.pend.id === v.id ? STK.pend : null;
  if (v.b == null) v.b = p ? (p.tr != null ? p.tr : p.t0 + (R.total || 0)) : P.tokens;   // kept: a later redraw comes after the sync
  const before = v.b, after = Math.max(0, before + v.d);
  const look = (k) => { const sh = $("resSheet"); sh.classList.remove("win", "loss", "draw"); sh.classList.add(k); };
  card.hidden = false; card.className = "card res-pot " + (v.d > 0 ? "up" : v.d < 0 ? "down" : "zero");
  if (late) { st.style.animation = "none"; void st.offsetWidth; st.style.animation = ""; }
  const sticker = (cls, n, small) => { st.className = "delta " + cls; $("rPotN").textContent = n; st.querySelector("small").textContent = small; };
  const moved = (txt) => { const w = txt.split("\u0001"); sub.textContent = ""; sub.append(w[0], acMk("b", "", name), `${w[1] || ""} · ${fmtChips(before)} → ${fmtChips(after)}`); };   // txt: "10 from \u0001" (the name's place marked)
  if (v.res === null) {
    stkPotHead(_t("Nothing moves")); sticker("zero", "±0", _t("No result"));
    sub.textContent = v.why === "early" ? _t("It ended in the first 30 seconds: no result.") : _t("No result: both keep their stake.");
    resTitle(_t("No result")); look("draw");
    resLine($("rSub"), [v.why === "early" ? _t("The match ended in its first 30 seconds.") : _t("The server couldn't decide this match."), " ", _t("Nobody's chips move.")]);
  } else if (v.d > 0) { stkPotHead(_t("You take the {n} pot", { n: pot })); moved(_t("{s} from {name}", { s, name: "\u0001" })); sticker("up", `+${s}`, v.why === "game" ? _t("Chips") : _t("Forfeit")); }
  else if (v.d < 0) { stkPotHead(_t("{name} takes the {n} pot", { name, n: pot })); moved(_t("{s} to {name}", { s, name: "\u0001" })); sticker("down", `−${s}`, _t("Chips")); }
  else { stkPotHead(_t("Nothing moves")); sub.textContent = _t("A draw: both keep their {n}.", { n: s }); sticker("zero", "±0", _t("Draw")); }
  if (v.res !== null && v.why !== "game") {
    if (v.res === 1) {
      resTitle(_t("Opponent left")); look("win");
      const wv = { who: cupEsc(name) };   // the name goes into the markup escaped, as the text node it was
      $("rSub").innerHTML = v.why === "quiet" ? _t("<b>{who}</b> stopped playing. The pot is yours.", wv) : v.why === "start" ? _t("<b>{who}</b>'s game didn't match the server's. The pot is yours.", wv) : _t("<b>{who}</b> left. The pot is yours.", wv);
    } else { resTitle(R.forfeit ? _t("Forfeit") : _t("Disconnected")); look("loss"); resLine($("rSub"), [R.forfeit ? _t("You left the match.") : _t("Your connection dropped."), " ", _t("That costs the stake.")]); }
  } else if (v.res !== null && v.res !== R.res) {   // the server's copy decides (this phone lost the connection near the end)
    resTitle(v.res === 1 ? _t("Victory") : v.res === 0 ? _t("Defeat") : _t("Draw")); look(v.res === 1 ? "win" : v.res === 0 ? "loss" : "draw");
    resLine($("rSub"), [v.res === 1 ? _t("The server's result: you won.") : v.res === 0 ? _t("The server's result: you lost.") : _t("The server's result: a draw.")]);
  }
  rvStrip(R);   // ui/rivals.js: the record as the server has it (resLine wiped the story's second sentence)
  if (v.d > 0) setTimeout(() => { if (mode === "result") { Sfx.uiCoin(); setTimeout(() => Sfx.uiCoin(), 110); setTimeout(() => Sfx.uiCoin(), 220); } }, late ? 300 : 1300);
  if (p) STK.pend = null;
}

/* ----- Settings > Chip stakes, Account > Stats ----- */
function stkSettings() {
  $("setStakeRow").hidden = !qmOn(); $("setStakeNote").hidden = !qmOn();
  if (!qmOn()) return;
  chipRow("setStake", [[0, _t("On")], [1, _t("Off")]], P.so === 1 ? 1 : 0, (v) => { P.so = v; saveProfile(); if (v) { stkDecline(); stkCancel(); } stkRender(); });
}
function stkStats(pan) {
  const me = qmMe(), k = me && me.sk;
  if (!k || !(k.w + k.l + k.n)) return;
  const net = k.net > 0 ? `+${fmtChips(k.net)}` : k.net < 0 ? `−${fmtChips(-k.net)}` : "±0";
  pan.appendChild(acMk("p", "ac-line sk-stat", _t("Chip stakes: {w}–{l} · net {net} chips · {n} of {day} today", { w: k.w, l: k.l, net, n: k.n, day: k.day })));
}
