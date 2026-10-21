/* ===================== The Boards: the CPU board and the online board (ui/vscpu.js fetches them, cpurank.js keeps them) =====================
   UI only, never in the simulation. Fable's design: quick-match/vs-cpu/fable-vs-cpu.md section 2, styles in css/97-boards.css.
   - The Boards sheet (#scrBoards): ink band BOARDS, a tab row (VS CPU, ONLINE, BOSS WEEK; BD_TABS is the list, more can follow), one kicker (the rank,
     the season, the players, how old the list is), up to 100 rows (place, tier emblem, name on its nameplate, fighter, record, rating) and
     YOUR row as a sticky bar under the list: your place, a dotted gap and `#143 of 187` when you are below the top 100, `PLACING 2 OF 5` while
     you place, a line telling what gets you a place when you have no account. Opens over the menu, Quick match, the results and the Account
     sheet (z-index 6): bdOpen(k) with k "c" (VS CPU), "o" (ONLINE) or "w" (BOSS WEEK: bwBoard(), times not ratings, ui/bwsheet.js), default the last tab used (localStorage potatobrawl.boards.v1).
   - The data comes from vcBoard(k) (ui/vscpu.js): a Promise of null (no server: the offline state) or { k, n, at, top: [{ id, nm, f, r, w, l, pl }],
     me: null | { i, row } | { i: 0, pn } }. It is fetched every time the sheet opens, the tab changes or the active tab is tapped again.
   - bdPreview() fills the CPU BOARD card on the Quick match screen (#qmBoard, shown by the VS CPU mode); bdPlates(box) draws the ONLINE RANK and
     CPU RANK plates of Account > Profile (data: vcRanks()); bdPill() shows the menu's BOARDS pill where there is a server (qmOn()).
   Every top-level name here starts with bd / BD (all ui parts share one scope). window.__blBoardMock = { c, o } stands in for the server in tests. */
screens.boards = $("scrBoards");
const BD_KEY = "potatobrawl.boards.v1";
const BD_PLACING = 5;             // matches that place a player on a board
const BD_SEASON = "Season 1";
// the tabs: k = the board vcBoard() is asked for, kick = the kicker's first words, gone / hint = the empty board, fight = its button, none = your row without an account
const BD_TABS = [
  { k: "c", name: "VS CPU", kick: "CPU rank", gone: "Nobody on the board yet.", hint: `${BD_PLACING} Ranked CPU matches get you on.`, fight: true, none: "Play a Ranked CPU match to get a place" },
  { k: "o", name: "Online", kick: "Online rank", gone: "Nobody has placed yet.", hint: `${BD_PLACING} Ranked matches get you on.`, fight: false, none: "Play a Ranked match to get a place" },
  { k: "w", name: "Boss Week", kick: "Boss Week", gone: "", hint: "", fight: false, none: "Finish the boss once to get a place" },   // ui/bwsheet.js draws its rows, kicker and empty state
];
const BD = { k: "c", req: 0, st: "idle", data: null, got: 0, tm: 0, lt: 0 };   // st: idle | load | ok | empty | off
const BDP = { at: 0, data: undefined, p: null };   // the preview's cache: undefined = nothing yet, null = offline

/* ----- small helpers ----- */
const bdMk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const bdInt = (v, d) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : d || 0);
const bdStr = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const bdCur = () => BD_TABS.find((t) => t.k === BD.k) || BD_TABS[0];
const bdTap = (el, fn) => el.addEventListener("click", (e) => { Sfx.init(); Sfx.cue(el); fn(e); });
const bdCalm = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function bdLast() { try { const s = JSON.parse(localStorage.getItem(BD_KEY) || "null"); if (s && BD_TABS.some((t) => t.k === s.k)) return s.k; } catch (e) { /* storage blocked */ } return "c"; }
function bdSave() { try { localStorage.setItem(BD_KEY, JSON.stringify({ k: BD.k })); } catch (e) { /* ignore */ } }
BD.k = bdLast();

// what the server sent, made safe to draw: numbers are whole numbers, text is cut to size, an unknown fighter shows nothing
function bdRow(o) {
  if (!o || typeof o !== "object") return null;
  return { id: bdStr(o.id, 12), nm: bdStr(o.nm, 24).trim() || "Player", f: FIG[o.f] ? o.f : "", r: bdInt(o.r, 1000), w: bdInt(o.w), l: bdInt(o.l), pl: bdStr(o.pl, 24) };
}
function bdClean(d, k) {
  if (k === "w") return bwBdPrep(d);   // ui/bwsheet.js: times, hearts lost and crowns instead of ratings
  if (!d || typeof d !== "object") return null;
  const top = (Array.isArray(d.top) ? d.top : []).slice(0, 100).map(bdRow).filter(Boolean);
  let me = null;
  if (d.me && typeof d.me === "object") {
    const i = bdInt(d.me.i), row = bdRow(d.me.row);
    if (i > 0 && row) me = { i, row };
    else if (i === 0) me = { i: 0, pn: Math.min(BD_PLACING, bdInt(d.me.pn)) };
  }
  return { k, n: Math.max(bdInt(d.n), top.length), at: bdInt(d.at), top, me };
}
// the board for k: vcBoard()'s answer, or null (no server, an error, or no answer in 10 s)
function bdFetch(k) {
  return new Promise((done) => {
    let p, over = setTimeout(() => done(null), 10000);
    try { p = k === "w" ? bwBoard() : typeof vcBoard === "function" ? vcBoard(k) : null; } catch (e) { p = null; }
    Promise.resolve(p).then((d) => d, () => null).then((d) => { clearTimeout(over); done(bdClean(d, k)); });
  });
}
const bdPlaceN = (n) => `${n} ${n === 1 ? "match" : "matches"}`;

/* ----- one row: place (a disc for 1-3), tier emblem, name on its plate, fighter, record, rating -----
   o.me: this is your row in the list; o.sticky: it is the bar under the list; o.of: "#143 of 187" for a bar below the top 100 */
function bdRowEl(row, i, o) {
  o = o || {};
  if (BD.k === "w") return bwBdRow(row, i, o);   // ui/bwsheet.js
  const el = bdMk("div", "bd-r" + (i === 1 ? " first" : "") + (o.me ? " me" : "") + (o.sticky ? " you" : ""));
  const p = bdMk("span", "bd-p");
  if (i >= 1 && i <= 3) p.appendChild(bdMk("i", "bd-d " + "gsb"[i - 1], String(i))); else p.textContent = String(i);
  const ti = tierIdx(row.r), em = bdMk("i", "badge bd-em");
  em.style.setProperty("--tc", TIERS[ti].col); em.innerHTML = tierEmblem(ti); em.title = TIERS[ti].name;
  const n = bdMk("span", "bd-n"), t = bdMk("span", "bd-t");   // the title line (YOU · name) and under or beside it the fighter
  if (o.me || o.sticky) t.appendChild(bdMk("em", "bd-yt", "You"));
  const nm = bdMk("b", "bd-nm", row.nm); plateSet(nm, row.pl); nm.title = row.nm;
  t.appendChild(nm); n.appendChild(t);
  const fig = row.f ? FIG[row.f].name : "", rec = `${row.w}W\u00a0${row.l}L`;
  const f1 = [fig, o.of].filter(Boolean).join(" · "), f2 = [fig, o.of ? "" : rec, o.of].filter(Boolean).join(" · ");   // wide: the record has its column; upright: it joins this line
  const f = bdMk("small", "bd-f");
  if (f1) f.appendChild(bdMk("span", "bd-f1", f1));
  f.appendChild(bdMk("span", "bd-f2", f2));
  n.appendChild(f);
  el.append(p, em, n, bdMk("small", "bd-w", rec), bdMk("b", "bd-v", String(row.r)));
  el.setAttribute("aria-label", `${i}. ${row.nm}${fig ? `, ${fig}` : ""}, ${row.w} wins ${row.l} losses, rating ${row.r}`);
  return el;
}
const bdPips = (n) => { const e = bdMk("span", "bd-pips"); e.setAttribute("aria-hidden", "true"); for (let k = 0; k < BD_PLACING; k++) e.appendChild(bdMk("i", k < n ? "on" : "")); return e; };

/* ----- the sheet ----- */
function bdTabs() {
  const box = $("bdTabs"); box.textContent = "";
  for (const t of BD_TABS) {
    const on = t.k === BD.k, b = bdMk("button", "bd-tab" + (on ? " on" : ""), t.name);
    b.type = "button"; b.dataset.k = t.k; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1;
    b.addEventListener("click", () => { Sfx.init(); Sfx.uiFlip(); bdPick(t.k); });
    box.appendChild(b);
  }
}
function bdPick(k) {   // a tab was tapped: the other one opens; the active one again loads its board afresh
  if (k !== BD.k) { BD.k = k; bdSave(); bdTabs(); }
  bdLoad();
}
function bdOpen(k) {
  BD.k = BD_TABS.some((t) => t.k === k) ? k : bdLast();
  bdSave();
  modal("boards", true);
  bdTabs();
  bdLoad();
  clearInterval(BD.tm); BD.tm = setInterval(bdAge, 15000);
  const on = $("bdTabs").querySelector(".bd-tab.on"); if (on && on.focus) try { on.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
function bdClose() {
  BD.req++; clearInterval(BD.tm); BD.tm = 0;
  modal("boards", false);
  if (BDP.data !== undefined && !$("qmBoard").hidden) bdPvDraw(BDP.data);   // the card behind may have a newer list now
}
function bdFight() { bdClose(); if (typeof vcFight === "function") vcFight(); }   // bdClose = modal("boards", false) and the timer off
function bdLoad() {
  const k = BD.k, req = ++BD.req;
  BD.st = "load"; BD.data = null;
  bdDraw();
  bdFetch(k).then((d) => {
    if (req !== BD.req || screens.boards.hidden) return;
    BD.data = d; BD.got = Date.now();
    if (k === "c") { BDP.data = d; BDP.at = Date.now(); }
    BD.st = !d ? "off" : d.top.length ? "ok" : "empty";
    bdDraw();
  });
}
// how old the list is, as the kicker says it (the page's own clock from the moment it arrived)
function bdAgo() {
  const s = Math.max(0, (Date.now() - BD.got) / 1000);
  return s < 30 ? "just now" : s < 3600 ? `${Math.max(1, Math.floor(s / 60))} min ago` : `${Math.floor(s / 3600)} h ago`;
}
function bdAge() { const e = $("bdKick").querySelector(".bd-up"); if (e && BD.st === "ok") e.textContent = ` · Updated ${bdAgo()}`; }
function bdKickDraw() {
  const k = $("bdKick"), t = bdCur(), d = BD.data;
  k.textContent = "";
  if (t.k === "w") { k.appendChild(document.createTextNode(bwBdKick(BD.st, d))); if (BD.st === "ok") k.appendChild(bdMk("span", "bd-up", ` · Updated ${bdAgo()}`)); return; }
  const tail = BD.st === "load" ? ["Loading"] : BD.st === "off" ? [] : [`${d.n} ${d.n === 1 ? "player" : "players"}`];
  k.appendChild(document.createTextNode([t.kick, BD_SEASON].concat(tail).join(" · ")));
  if (BD.st === "ok") k.appendChild(bdMk("span", "bd-up", ` · Updated ${bdAgo()}`));
}
// the three-bar podium of the empty states
const bdPod = () => { const e = bdMk("div", "bd-pod"); e.setAttribute("aria-hidden", "true"); e.append(bdMk("i"), bdMk("i"), bdMk("i")); return e; };
function bdStateDraw() {
  const box = $("bdState"), t = bdCur();
  box.textContent = "";
  if (BD.st === "off") {
    box.className = "bd-state off";
    box.append(bdMk("div", "bd-off", "Offline"), bdMk("b", "bd-big", "Boards need the server."), bdMk("p", "bd-sub", "Check the connection, then try again."));
    const b = bdMk("button", "mini bd-again", "Try again"); b.type = "button"; bdTap(b, bdLoad); box.appendChild(b);
  } else {
    box.className = "bd-state";
    if (t.k === "w") { bwBdEmpty(box); return; }   // ui/bwsheet.js: Nobody has a time yet + FIGHT <boss>
    box.append(bdPod(), bdMk("b", "bd-big", t.gone), bdMk("p", "bd-sub", t.hint));
    if (t.fight) { const b = bdMk("button", "btn primary bd-fight"); b.type = "button"; b.appendChild(bdMk("span", "", "Fight a CPU")); bdTap(b, bdFight); box.appendChild(b); }
  }
}
// ghost rows while the list is on its way
function bdGhosts() {
  const list = $("bdList"); list.textContent = "";
  [58, 74, 46, 66, 52, 70, 44].forEach((w) => {
    const r = bdMk("div", "bd-r sk");
    r.appendChild(bdMk("i", "bd-gp")); r.appendChild(bdMk("i", "bd-ge"));
    const n = bdMk("i", "bd-gn"); n.style.setProperty("--w", w + "%"); r.appendChild(n);
    r.appendChild(bdMk("i", "bd-gv"));
    list.appendChild(r);
  });
}
function bdYouDraw(d) {
  const box = $("bdYou"), gap = $("bdGap"), t = bdCur(), m = d && d.me;
  box.textContent = ""; gap.hidden = true;
  if (!d || (BD.st === "empty" && (!m || t.k === "w"))) { box.hidden = true; return; }
  box.hidden = false;
  if (t.k === "w" && m && !m.i) {   // an account with no time yet
    const e = bdMk("div", "bd-r you none");
    e.append(bdMk("em", "bd-yt", "You"), bdMk("span", "bd-none", `No time yet. Finish ${bwBossSpec(bwSpec().boss).name} once to get a place`));
    box.appendChild(e); return;
  }
  if (!m) {   // no account yet
    const e = bdMk("div", "bd-r you none");
    e.append(bdMk("em", "bd-yt", "You"), bdMk("span", "bd-none", t.none));
    box.appendChild(e);
  } else if (!m.i) {   // placing
    const left = Math.max(0, BD_PLACING - m.pn), e = bdMk("div", "bd-r you placing"), txt = bdMk("span", "bd-pk");
    txt.append(bdMk("b", "", `Placing ${m.pn} of ${BD_PLACING}`), bdMk("small", "", left ? `${bdPlaceN(left)} to get on` : "Almost there"));
    e.append(bdMk("em", "bd-yt", "You"), txt, bdPips(m.pn));
    box.appendChild(e);
  } else {
    const inTop = m.i <= d.top.length, e = bdRowEl(m.row, m.i, { sticky: true, of: inTop ? "" : `#${m.i} of ${d.n}` });
    if (inTop) {
      e.setAttribute("role", "button"); e.tabIndex = 0; e.title = "Show my place in the list";
      e.addEventListener("click", () => { Sfx.init(); Sfx.ui(); bdToMe(); });
      e.addEventListener("keydown", (ev) => { if (ev.code === "Enter" || ev.code === "Space") { ev.preventDefault(); bdToMe(); } });
    } else gap.hidden = false;
    box.appendChild(e);
  }
}
function bdToMe() {   // scroll the list to your row and flash it
  const list = $("bdList"), el = list.querySelector(".bd-r.me");
  if (!el) return;
  const to = Math.max(0, el.offsetTop - (list.clientHeight - el.offsetHeight) / 2);
  if (list.scrollTo) list.scrollTo({ top: to, behavior: bdCalm() ? "auto" : "smooth" }); else list.scrollTop = to;
  el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
}
// everything under the tabs for the state BD.st
function bdDraw() {
  const d = BD.data, list = $("bdList"), st = BD.st;
  bdKickDraw();
  screens.boards.classList.toggle("bw-tab", BD.k === "w");   // css/97-bossweek.css: the time column is wider
  $("bdHd").querySelector(".bd-hr").textContent = BD.k === "w" ? "Time" : "Rating";
  $("bdHd").hidden = !(st === "ok" || st === "load");
  list.hidden = !(st === "ok" || st === "load");
  $("bdState").hidden = !(st === "off" || st === "empty");
  $("bdMain").classList.toggle("load", st === "load");
  if (st === "load") { bdGhosts(); bdYouDraw(null); return; }
  list.textContent = "";
  if (st === "ok") {
    const frag = document.createDocumentFragment(), me = d.me && d.me.i > 0 && d.me.i <= d.top.length ? d.me : null;
    d.top.forEach((row, k) => frag.appendChild(bdRowEl(row, k + 1, { me: !!me && (me.row.id ? me.row.id === row.id : me.i === k + 1) })));
    list.appendChild(frag);
    list.scrollTop = 0;
  } else bdStateDraw();
  bdYouDraw(d);
}

/* ----- the CPU BOARD card on the Quick match screen: top 3, a dotted gap, you (name and rating only) ----- */
function bdPvRow(row, i, o) {
  o = o || {};
  const el = bdMk("div", "qb-r" + (i === 1 ? " first" : "") + (o.you ? " you" : ""));
  const p = bdMk("span", "bd-p");
  if (i >= 1 && i <= 3) p.appendChild(bdMk("i", "bd-d " + "gsb"[i - 1], String(i))); else p.textContent = String(i);
  const ti = tierIdx(row.r), em = bdMk("i", "badge bd-em");
  em.style.setProperty("--tc", TIERS[ti].col); em.innerHTML = tierEmblem(ti);
  const n = bdMk("span", "bd-n");
  if (o.you) n.appendChild(bdMk("em", "bd-yt", "You"));
  const nm = bdMk("b", "bd-nm", row.nm); plateSet(nm, row.pl);
  n.appendChild(nm);
  el.append(p, em, n, bdMk("b", "bd-v", String(row.r)));
  return el;
}
function bdPvDraw(d) {   // d: undefined (on its way), null (no server) or a cleaned board
  const box = $("qbList"); if (!box) return;
  box.textContent = "";
  if (d === undefined) { for (let k = 0; k < 3; k++) { const r = bdMk("div", "qb-r sk"); r.append(bdMk("i", "bd-gp"), bdMk("i", "bd-ge"), bdMk("i", "bd-gn"), bdMk("i", "bd-gv")); box.appendChild(r); } return; }
  if (!d) { box.appendChild(bdMk("p", "qb-note", "The board needs the server.")); return; }
  if (!d.top.length) { box.appendChild(bdMk("p", "qb-note", `Nobody on the board yet. ${BD_PLACING} Ranked CPU matches get you on.`)); return; }
  d.top.slice(0, 3).forEach((row, k) => box.appendChild(bdPvRow(row, k + 1, { you: !!d.me && d.me.i === k + 1 })));
  const m = d.me;
  if (m && m.i > 3 && m.row) {
    if (m.i > 4) box.appendChild(bdMk("div", "qb-gap", "···"));
    box.appendChild(bdPvRow(m.row, m.i, { you: true }));
  } else if (m && !m.i) {   // placing: no place and no rating yet, the five pips say how far
    const e = bdMk("div", "qb-r you placing"), n = bdMk("span", "bd-n");
    n.append(bdMk("em", "bd-yt", "You"), bdMk("b", "bd-nm", `Placing ${m.pn} of ${BD_PLACING}`));
    e.append(bdMk("span", "bd-p", "–"), n, bdPips(m.pn));
    box.appendChild(e);
  } else if (!m) box.appendChild(bdMk("p", "qb-note", BD_TABS[0].none));
}
function bdPreview() {
  const card = $("qmBoard"); if (!card) return;
  if (BDP.data !== undefined && Date.now() - BDP.at < 10000) { bdPvDraw(BDP.data); return; }   // fresh enough: no new fetch
  if (BDP.p) return;
  if (BDP.data === undefined) bdPvDraw(undefined);
  BDP.p = bdFetch("c").then((d) => { BDP.p = null; BDP.data = d; BDP.at = Date.now(); bdPvDraw(d); });
}

/* ----- Account > Profile: the two rank plates, each opens its board (vcRanks() from ui/vscpu.js: { on: {r, n, pl}, cpu: {r, n, pl} }) ----- */
function bdPlates(box) {
  if (!box) return;
  box.classList.add("bd-plates"); box.textContent = "";
  const rk = typeof vcRanks === "function" ? vcRanks() : null;
  if (!rk || typeof rk !== "object" || (!rk.on && !rk.cpu)) { box.hidden = true; return; }
  box.hidden = false;
  for (const [k, o, name] of [["o", rk.on, ["Online", "Online rank"]], ["c", rk.cpu, ["CPU", "CPU rank"]]]) {
    if (!o || typeof o !== "object") continue;
    const r = bdInt(o.r, 1000), n = bdInt(o.n), pl = bdInt(o.pl), placing = n < BD_PLACING, ti = tierIdx(r);
    const b = bdMk("button", "bd-pl" + (placing ? " placing" : "") + (k === "c" ? " cpu" : ""));
    b.type = "button"; b.dataset.k = k; b.style.setProperty("--tc", TIERS[ti].col);
    const em = bdMk("i", "badge"); paintBadge(em, ti);
    if (k === "c") em.appendChild(bdMk("span", "tag ember bd-st", "CPU"));
    const t = bdMk("span", "bd-pt");
    const q = bdMk("span", "bd-pq"); q.append(name[0], bdMk("span", "bd-rk", " rank"), pl > 0 ? ` · #${pl}` : "");   // upright: ONLINE · #14 (the plate is narrow)
    t.append(q, bdMk("b", "", placing ? "Placing" : TIERS[ti].name),
      bdMk("small", "", placing ? `${n} of ${BD_PLACING}` : String(r)));
    b.append(em, t, bdMk("i", "bd-go"));
    b.setAttribute("aria-label", `${name[1]}${pl > 0 ? `, place ${pl}` : ""}: ${placing ? `placing, ${n} of ${BD_PLACING} matches played` : `${TIERS[ti].name} ${r}`}. Open the board`);
    bdTap(b, () => bdOpen(k));
    box.appendChild(b);
  }
}

/* ----- the menu's BOARDS pill: only where there is a server (Quick match's page) or a test board ----- */
function bdPill() {
  const b = $("bBoards"); if (!b) return;
  const on = (typeof qmOn === "function" && qmOn()) || !!window.__blBoardMock;
  b.hidden = !on;
  if (b.parentNode) b.parentNode.classList.toggle("bd4", on);
}

/* ----- wiring ----- */
tap("bBoards", () => bdOpen());
tap("bdClose", bdClose);
screens.boards.addEventListener("click", (e) => { if (e.target === screens.boards) bdClose(); });
window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !screens.boards.hidden) { e.preventDefault(); bdClose(); } });
$("bdTabs").addEventListener("keydown", (e) => {
  if (e.code !== "ArrowLeft" && e.code !== "ArrowRight") return;
  e.preventDefault();
  const i = BD_TABS.findIndex((t) => t.k === BD.k), j = (i + (e.code === "ArrowRight" ? 1 : BD_TABS.length - 1)) % BD_TABS.length;
  bdPick(BD_TABS[j].k);
  const on = $("bdTabs").querySelector(".bd-tab.on"); if (on) on.focus();
});
$("qmBoard").addEventListener("click", () => { Sfx.init(); Sfx.uiFlip(); bdOpen("c"); });
$("qmBoard").addEventListener("keydown", (e) => { if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); Sfx.init(); Sfx.uiFlip(); bdOpen("c"); } });
window.__blBoards = { open: bdOpen, close: bdClose, preview: bdPreview, plates: bdPlates, pill: bdPill, get state() { return { k: BD.k, st: BD.st }; } };   // tests
bdPill();

