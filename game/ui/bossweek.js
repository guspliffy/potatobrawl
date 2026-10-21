/* ===================== Boss Week: one boss a week on Hard, the fastest KO is #1 (the server side is bossweek.js) =====================
   The week runs Monday to Monday, Berlin time; the boss turns Old Scratch -> Zorp -> Kraken Spud with the Road's HP and partner strength
   (ROAD_REG) and one CPU partner fighter for everyone that week. A try is dealt by the server as a ticket (its own seed); this phone plays
   it with no lag and logs your inputs in the online encoding (vcIn, ui/vscpu.js). A win whose time beats your best goes to the server,
   which plays the same fight again from the log before it counts (a slower win or a loss is never sent). Your time: the frames from
   GO to the final launch on the boss. The server pays the week's places in chips on Monday (into the account file, synced here).
   This part: the week, the record, the tickets, the run (its clock pill under the boss bar, the 4:00 cap), the results card and the
   verdict. The sheet, the start tile, the Boards tab and the Monday card are ui/bwsheet.js (they read BW and the bw* helpers below).
   Fable's design: /mnt/project-files/step6/fable-step6.md. Styles: css/97-bwrun.css (this part), css/97-bossweek.css (the sheet). */
const BW_KEY = "potatobrawl.bw.v1";
const BW_ROT = ["scratch", "zorp", "kraken"], BW_D0 = Date.UTC(2026, 0, 5) / 864e5, BW_LV = 1;   // the server's (bossweek.js)
const BW_CAP = 240 * 60, BW_LAST = 30 * 60;   // a run has 4:00 from GO; the pill turns ember for the last 30 s
const BW_PRIZE = [[1, 300], [3, 150], [10, 80], [1e9, 25]];   // chips for a place, paid on Monday: #1, #2-3, top 10, a time
const BW = {
  wk: null,       // the server's week { wk, no, ends, boss, lv, pf, n } (bw-me), kept for the menu
  me: null, code: "",   // your record this week { t (frames, 0 = no time yet), fl, f, pl, cr, tries } and the sync code it belongs to
  lr: null,       // last week's result { wk, no, boss, pl, of, c } (the Monday card)
  asking: false, askT: 0, note: "", meAt: -1e9,
  pend: null,     // a won try until the server's verdict: { id, code, wk, s (the packed log), fr, fl, brk, f, b0, pl0, sentT }
  res: null, shown: null, applied: [],
  seen: -1, lrSeen: -1, lrNew: null,   // the last week whose sheet was opened (the NEW tag), the last Monday card shown
  bk: -1,         // the break of your best run, frames from GO (the pill's split; this phone's own runs only)
  bd: null, bdWait: [], run: null,
  bdl: null, bdlWait: [],   // a finished week's board (Last week ›), its waiting callers
};
(function bwLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(BW_KEY) || "null");
    if (!s || typeof s !== "object") return;
    if (s.wk && typeof s.wk === "object") BW.wk = bwCleanWk(s.wk);
    if (s.me && typeof s.code === "string") { BW.me = bwCleanMe(s.me); BW.code = s.code; }
    for (const k of ["seen", "lrSeen", "bk"]) if (Number.isInteger(s[k])) BW[k] = s[k];
    if (s.pend && typeof s.pend.id === "string" && typeof s.pend.s === "string") BW.pend = s.pend;
  } catch (e) { /* storage blocked: nothing remembered */ }
})();
function bwSave() { try { localStorage.setItem(BW_KEY, JSON.stringify({ wk: BW.wk, me: BW.me, code: BW.code, seen: BW.seen, lrSeen: BW.lrSeen, bk: BW.bk, pend: BW.pend })); } catch (e) { /* ignore */ } }
const bwN = (v, d) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : d);
function bwCleanWk(o) {
  if (!o || !Number.isInteger(o.wk) || !BOSS_IDS.has(o.boss) || !FIG[o.pf] || !Number.isFinite(o.ends)) return null;
  return { wk: o.wk, no: bwN(o.no, 0), ends: o.ends, boss: o.boss, lv: bwN(o.lv, BW_LV), pf: o.pf, n: bwN(o.n, 0) };
}
function bwCleanMe(o) {
  if (!o || typeof o !== "object") return null;
  return { t: bwN(o.t, 0), fl: bwN(o.fl, 0), f: FIG[o.f] ? o.f : "", pl: bwN(o.pl, 0), cr: bwN(o.cr, 0), tries: bwN(o.tries, 0),
    r: typeof o.r === "string" && /^[0-9a-f]{12}$/.test(o.r) ? o.r : "", v: bwN(o.v, 0) };   // r, v: your best run to watch (ui/replay.js)
}

/* ----- the week, from this phone's clock (the server's answer replaces it when it comes) ----- */
const BW_FMT = (() => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }); } catch (e) { return null; } })();
function bwBerlin(t) {
  if (!BW_FMT) return { day: Math.floor((t + 3600e3) / 864e5), h: new Date(t + 3600e3).getUTCHours() };   // no time zones here: winter time
  const p = {};
  for (const x of BW_FMT.formatToParts(new Date(t))) p[x.type] = x.value;
  return { day: Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5, h: +p.hour };
}
const bwWeekOf = (t) => Math.floor((bwBerlin(t).day - BW_D0) / 7);
function bwWeekStart(wk) {   // Monday 00:00 in Berlin
  const day = BW_D0 + wk * 7;
  for (const off of [1, 2]) { const t = day * 864e5 - off * 3600e3, b = bwBerlin(t); if (b.day === day && b.h === 0) return t; }
  return day * 864e5 - 3600e3;
}
function bwIsoWeek(wk) { const th = (BW_D0 + wk * 7 + 3) * 864e5, y = new Date(th).getUTCFullYear(); return 1 + Math.floor((th - Date.UTC(y, 0, 1)) / (7 * 864e5)); }
function bwRoadOf(boss) { const k = ROAD_REG.findIndex((r) => r.boss === boss); return { k, hp: k >= 0 ? ROAD_REG[k].hp : 1, mate: k >= 0 ? ROAD_REG[k].mate : 0.5 }; }
function bwLocal(wk) {
  const n = FIGHTERS.length, boss = BW_ROT[((wk % 3) + 3) % 3], R = bwRoadOf(boss), b = BL.BOSSES.find((x) => x.id === boss);
  return { wk, no: bwIsoWeek(wk), ends: bwWeekStart(wk + 1), boss, lv: BW_LV, pf: FIGHTERS[(((wk * 5 + 2) % n) + n) % n].id,
    hp: R.hp, d: Math.round((R.mate + 0.1 * BW_LV) * 100) / 100, map: b ? bossMap(b) : 0, n: -1 };
}
// this week as the page shows it: { wk, no, ends, boss, lv, pf, hp, d, map, n (players with a time; -1 not known) }.
// window.__blBwMock = { wk, me, lr, board, live } stands in for the server (the sheet's tests and screenshots).
function bwSpec() {
  const M = window.__blBwMock;
  if (M && M.wk) return Object.assign(bwLocal(M.wk.wk | 0), M.wk);
  const wk = bwWeekOf(Date.now()), s = BW.wk && BW.wk.wk >= wk ? BW.wk : null;   // the server's clock decides at the boundary
  return Object.assign(bwLocal(s ? s.wk : wk), s ? { no: s.no, ends: s.ends, boss: s.boss, lv: s.lv, pf: s.pf, n: s.n } : {});
}
// a counted try can start now: our server, connected, accounts on
function bwLive() { const M = window.__blBwMock; if (M) return !!M.live; return qmOn() && QM.conn && !qmAcctOff(); }
// your record this week: null (not known: no account, or not heard from the server yet) or { t, fl, f, pl, cr, tries } (t 0: no time yet)
function bwMine() {
  const M = window.__blBwMock;
  if (M) return M.me || null;
  return BW.me && BW.code && BW.code === ACCT.code && BW.wk && BW.wk.wk === bwSpec().wk ? BW.me : null;
}
const bwChecking = () => !!(BW.pend && BW.pend.code === ACCT.code);   // a won try on its way to the server
const bwNew = () => bwSpec().wk > BW.seen;   // the start tile's NEW tag: this week's sheet not opened yet
function bwSeen() { const wk = bwSpec().wk; if (BW.seen !== wk) { BW.seen = wk; bwSave(); } bwAskMe(false, 5000); }   // the sheet opened
const bwPrize = (pl) => BW_PRIZE.find(([to]) => pl <= to)[1];
// frames as a time: "1:42.18" (d 2) or "1:42.1" (d 1); always rounded down, as the board is
function bwClock(fr, d) {
  const cs = Math.floor((Math.max(0, fr) * 100) / 60), m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60;
  const frac = d === 1 ? String(Math.floor((cs % 100) / 10)) : String(cs % 100).padStart(2, "0");
  return `${m}:${String(s).padStart(2, "0")}.${frac}`;
}
// a signed difference of two times in seconds: "−4.16", "+2.1"
function bwDiff(fr, d) { const s = (Math.abs(fr) / 60).toFixed(d === 1 ? 1 : 2); return (fr < 0 ? "−" : "+") + s; }
// what is left of the week: "3d 4h", "5h 12m", "12m"
function bwLeft(ends) {
  const m = Math.max(0, Math.floor((ends - Date.now()) / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${Math.max(1, m)}m`;
}
const bwBossSpec = (id) => BL.BOSSES.find((b) => b.id === id) || BL.BOSSES[0];
// the sheet, the tile and the Monday card follow every change (ui/bwsheet.js)
function bwRefresh() {
  if (typeof bwTile === "function" && mode === "menu") bwTile();
  if (typeof bwSheetRender === "function") bwSheetRender();
}

/* ----- the server's messages (net-ws.js passes bw-* and bd to every Quick match listener) ----- */
function bwBoot() {   // vcBoot (ui/vscpu.js), once
  if (!qmOn()) return;
  window.__blQuick.on(bwMsg);
  window.__blBw = BW;   // tests read it
  window.__blBwFight = bwFight;   // tests: a try without the sheet
  window.__blBwBoard = bwBoard;   // tests: the board (a week: a finished one)
}
function bwMsg(m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "me") { if (!m.err) bwAuthed(); else if (BW.asking) bwFail("This phone's account isn't on the server. Check Account."); }
  else if (m.t === "bw-me") bwGotMe(m);
  else if (m.t === "bw-tk") bwTicket(m);
  else if (m.t === "bw-no") bwRefused(m.why);
  else if (m.t === "bw-res") bwRes(m);
  else if (m.t === "bd" && m.k === "w") { if (m.fin) bwBdlDone(bwBdClean(m)); else bwBdDone(bwBdClean(m)); }
}
function bwAskMe(force, ms) {
  if (!qmOn() || !QM.conn) return;
  if (ACCT.code && !QM.authed) { qmAuth(); return; }   // bwAuthed asks once signed in
  if (!force && performance.now() - BW.meAt < (ms || 60000)) return;
  BW.meAt = performance.now();
  window.__blQuick.send({ t: "bwme" });
}
// signed in: a try still on its way goes first, then your record; a waiting FIGHT goes on
function bwAuthed() {
  if (BW.pend && BW.pend.code !== ACCT.code) { BW.pend = null; bwSave(); }   // another account's try: it stays unsent
  bwFlush();
  bwAskMe(true);
  if (BW.asking) bwGo();
}
function bwGotMe(m) {
  const wk = bwCleanWk(m);
  if (!wk) return;
  BW.wk = wk;
  if (m.me && ACCT.code && QM.authed) { BW.me = bwCleanMe(m.me); BW.code = ACCT.code; }
  else if (!m.me && BW.code === ACCT.code) BW.me = null;
  if (m.lr && Number.isInteger(m.lr.wk) && m.lr.wk > BW.lrSeen && Number.isInteger(m.lr.pl) && (!BW.lrNew || BW.lrNew.wk !== m.lr.wk)) {
    BW.lrNew = { wk: m.lr.wk, no: bwN(m.lr.no, 0), boss: BOSS_IDS.has(m.lr.boss) ? m.lr.boss : "scratch", pl: bwN(m.lr.pl, 0), of: bwN(m.lr.of, 0), c: bwN(m.lr.c, 0) };
    if (ACCT.code && typeof acctSoon === "function") acctSoon(300);   // the chips the server paid come with the next sync
  }
  BW.lr = BW.lrNew || BW.lr;
  bwSave(); bwRefresh();
}

/* ----- FIGHT: the account, a try still on its way, then a ticket ----- */
function bwFight() {
  if (!bwLive()) { bwPractice(); return; }
  if (mode === "result") $("rAgainSub").textContent = "Starting…";
  if (QM.no === "old") { location.reload(); return; }
  if (BW.asking) return;
  Sfx.init(); goFull();   // fullscreen needs the tap itself
  BW.note = ""; BW.asking = true; BW.askT = Date.now();
  bwRefresh();
  bwGo();
}
async function bwGo() {
  if (!ACCT.code) {
    const ok = await qmMakeAcct();
    if (!BW.asking) return;
    if (!ok) { bwFail(qmAcctOff() ? "Boss Week opens soon." : "Couldn't reach the server. Try again."); return; }
  }
  if (!QM.authed) { qmAuth(); return; }   // bwAuthed goes on once signed in
  if (bwChecking() && !BW.pend.sentT) { bwFlush(); }   // the last win goes first (its verdict doesn't hold this try up)
  const f = FIG[P.last] ? P.last : FIGHTERS[0].id;   // the fighter you play (the sheet's picture, as the Road's)
  window.__blQuick.send({ t: "bwt", v: PROTO, f, pi: palIdx(f) });
}
function bwFail(note) {
  BW.asking = false; BW.note = note || "";
  bwRefresh();
  if (mode === "result" && BW.shown) $("rBwL").textContent = note || "";
}
function bwRefused(why) {
  if (!BW.asking) return;
  if (why === "acct") { QM.authed = false; qmAuth(); return; }   // signed out (the server restarted): sign in, then ask again
  if (why === "slow") { setTimeout(() => { if (BW.asking) bwGo(); }, 1500); return; }
  if (why === "old") { QM.no = "old"; bwFail("A new version of the game is out. Reload to play."); return; }
  bwFail("Couldn't start a Boss Week try. Try again.");
}
function bwTicketOk(m) {
  const okP = (f, p) => !!FIG[f] && Number.isInteger(p) && p >= 0 && p < FIG[f].palettes.length;
  return typeof m.id === "string" && /^[0-9a-f]{12}$/.test(m.id) && Number.isInteger(m.wk) && Number.isInteger(m.seed) && BOSS_IDS.has(m.boss) &&
    Number.isInteger(m.lv) && m.lv >= 0 && m.lv <= 2 && typeof m.hp === "number" && m.hp > 0 && m.hp < 5 && typeof m.d === "number" && m.d > 0 && m.d <= 1 &&
    Number.isInteger(m.map) && m.map >= 0 && m.map < BL.MAPS.length && okP(m.f, m.p) && okP(m.pf, m.pp);
}
function bwTicket(m) {
  if (!BW.asking || !bwTicketOk(m)) return;
  BW.asking = false; BW.note = "";
  if (typeof bwSheetClose === "function") bwSheetClose();
  if (typeof bdClose === "function" && screens.boards && !screens.boards.hidden) bdClose();
  bwStart(m);
}
// the fight: the server's exactly (its seed, the boss, his HP and level, the partner and his strength), your inputs logged (vcIn)
function bwStart(tk) {
  const me = FIG[tk.f], pf = FIG[tk.pf], boss = bwBossSpec(tk.boss);
  G = newGame({ players: [{ spec: me, pal: me.palettes[tk.p] || me.palettes[0] }, { spec: pf, pal: pf.palettes[tk.pp] || pf.palettes[0] }, { spec: boss, pal: boss.palettes[0] }],
    stocks: 3, time: 0, countdown: 150, map: tk.map, level: tk.lv, hpMul: tk.hp, seed: tk.seed });
  match = { boss: true, bw: tk, bwr: { go: -1, ko: -1, brk: -1, cap: false, spl: 0 }, level: tk.lv, d: tk.d, bot: makeBot(tk.d, BL.BOT_STYLES[pf.id]), cpu: cpuName(), road: null, log: [] };
  BW.run = match.bwr;   // tests read it
  meSlot = 0;
  enterMatchUI();
}
// no server: the week's boss in Practice, the same rules, not counted
function bwPractice() {
  const s = bwSpec(), R = bwRoadOf(s.boss);
  startBoss({ level: BW_LV, boss: s.boss, partner: s.pf, hpMul: R.hp, mate: s.d });
}

/* ----- the run: GO, the break, the final launch (roadEvent passes the live match's events), the clock pill, the cap ----- */
function bwEvent(g, e) {
  const r = match && (match.bw || match.rp) && match.bwr;   // match.rp: a replay of a run (ui/replay.js) keeps the same clock
  if (!r) return;
  if (e.type === "go") r.go = g.t;
  else if (e.type === "lethal" && e.slot === 2 && r.ko < 0) r.ko = g.t;
}
function bwPill() {   // made once, under the boss bar (inside it, so it hides with it)
  let el = $("bwPill");
  if (!el) {
    el = document.createElement("div"); el.id = "bwPill"; el.hidden = true;
    el.innerHTML = '<b class="bp-t"></b><span class="bp-b"></span><i class="bp-s" hidden></i>';
    $("bossBar").appendChild(el);
  }
  return el;
}
const BP = { t: "", b: "", cls: "", s: "" };
// every drawn frame of a Boss Week try (bossHud, ui/boss.js)
function bwHud() {
  const el = bwPill(), r = match && (match.bw || match.rp) && match.bwr, rp = !!(match && match.rp);
  if (!r || r.go < 0) { if (!el.hidden) el.hidden = true; return; }   // from GO (his line has the place under the bar during the countdown)
  if (el.hidden) { el.hidden = false; BP.t = BP.b = BP.cls = BP.s = ""; }
  const b = bossOf(G);
  if (r.brk < 0 && b && (b.state === "broken" || b.doomed)) {   // the break: the split against your best run's break
    r.brk = G.t;
    if (!rp && BW.bk > 0 && bwMine() && bwMine().t) r.spl = { d: r.brk - r.go - BW.bk, at: performance.now() };
  }
  const run = (r.ko >= 0 ? r.ko : G.t) - r.go, mine = rp ? null : bwMine();   // a replay's pill: its clock only
  if (r.go >= 0 && r.ko < 0 && run >= BW_CAP && G.phase === "play" && !r.cap) { r.cap = true; finishMatch(false); return; }   // 4:00: out of time
  const t = r.ko >= 0 ? bwClock(run, 2) : bwClock(run, 1), left = r.ko < 0 && run >= BW_CAP - BW_LAST;
  const bt = left ? `${mmss(Math.ceil((BW_CAP - run) / 60))} left` : mine && mine.t ? `Best ${bwClock(mine.t, 2)}` : "";
  const cls = left ? "ember" : r.ko >= 0 ? (mine && mine.t && run < mine.t ? "best" : "done") : "";
  if (BP.t !== t) { BP.t = t; el.querySelector(".bp-t").textContent = t; }
  if (BP.b !== bt) { BP.b = bt; const s = el.querySelector(".bp-b"); s.textContent = bt; s.hidden = !bt; }
  if (BP.cls !== cls) { BP.cls = cls; el.className = cls; }
  const sp = r.spl && performance.now() - r.spl.at < 2600 ? r.spl : null, st = sp ? bwDiff(sp.d, 1) : "";
  if (BP.s !== st) { BP.s = st; const s = el.querySelector(".bp-s"); s.hidden = !sp; s.textContent = st; s.className = "bp-s " + (sp && sp.d <= 0 ? "up" : "down"); }
}

/* ----- the end: a win that beats your best goes to the server; the Road's Hard star where his fence is open ----- */
function bwEnd(R) {   // bossMatchEnd (ui/boss.js)
  const tk = match.bw, r = match.bwr, mine = bwMine(), fl = R.me.falls | 0;
  const won = !R.forfeit && R.res === 1 && r.go >= 0 && r.ko >= 0 && !r.cap, t = won ? r.ko - r.go : 0;
  const b0 = mine ? mine.t : 0, beat = won && t <= BW_CAP && (!b0 || t < b0 || (t === b0 && fl < mine.fl));
  if (r.cap) { R.res = 0; R.forfeit = false; }
  R.bw = { tk, won, t, fl, cap: r.cap, brk: r.brk >= 0 && r.go >= 0 ? r.brk - r.go : -1, b0, pl0: mine ? mine.pl : 0, n0: bwSpec().n, sent: beat, road: null };
  if (mine) mine.tries++;
  if (won) {   // ui/road.js roadBossWin: his Hard star on your Road (and the first win's title, a Road skin), each paid once
    const k = bwRoadOf(tk.boss).k, rd = roadGet();
    if (k >= 0 && roadRegOpen(rd, k) && roadGateOpen(rd, k)) {
      const w = roadBossWin(k, tk.lv, R.me.spec);
      R.total = w.total; R.bw.road = w;
    }
  }
  if (beat) {
    BW.pend = { id: tk.id, code: ACCT.code, wk: tk.wk, s: vcPack(match.log), fr: t, fl, brk: R.bw.brk, f: tk.f, b0, pl0: R.bw.pl0, sentT: 0 };
    bwSave(); bwFlush();
  }
}
// the log to the server, in parts the WebSocket takes (6,000 characters each)
function bwFlush() {
  const p = BW.pend;
  if (!p || !qmOn() || !QM.conn || !QM.authed || p.code !== ACCT.code) return;
  const n = Math.max(1, Math.ceil(p.s.length / 6000));
  for (let k = 0; k < n; k++) window.__blQuick.send({ t: "bwr", id: p.id, k, n, s: p.s.slice(k * 6000, (k + 1) * 6000), fr: p.fr });
  p.sentT = Date.now(); bwSave();
}
function bwRes(m) {
  if (!m || typeof m.id !== "string" || BW.applied.includes(m.id)) return;
  BW.applied.push(m.id); if (BW.applied.length > 8) BW.applied.shift();
  const p = BW.pend && BW.pend.id === m.id ? BW.pend : null;
  const me = bwMine() || (ACCT.code ? { t: 0, fl: 0, f: "", pl: 0, cr: 0, tries: 0 } : null);
  if (me) {
    if (m.ok && m.why === "best") { Object.assign(me, { t: bwN(m.time, 0), fl: bwN(m.fl, 0), f: p ? p.f : me.f, pl: bwN(m.pl1, 0), r: /^[0-9a-f]{12}$/.test(m.id) ? m.id : "", v: PROTO }); if (p && p.brk > 0) BW.bk = p.brk; }
    else if (m.ok || m.why === "claim") { if (bwN(m.b0, 0)) me.t = m.b0; if (bwN(m.pl1 || m.pl0, 0)) me.pl = m.pl1 || m.pl0; }
    BW.me = me; BW.code = ACCT.code;
    if (BW.wk && Number.isInteger(m.n)) BW.wk.n = m.n;
  }
  if (p) BW.pend = null;
  BW.res = m; BW.bd = null;
  bwSave(); bwRefresh();
  if (mode === "result" && BW.shown && BW.shown.bw.tk.id === m.id) bwVerdictView(true);
}

/* ----- the results: the rank card's slot holds the time, the place, the verdict ----- */
function bwCard() {   // made once, in the rank card's place
  let c = $("rBw");
  if (!c) {
    c = document.createElement("div"); c.className = "card res-bw"; c.id = "rBw"; c.hidden = true;
    c.innerHTML = '<div class="bw-body"><span class="bw-k" id="rBwK"></span><b class="bw-t" id="rBwT"></b><button class="bw-l" id="rBwL"></button></div><div class="delta" id="rBwD"><b id="rBwN"></b><small id="rBwS"></small></div>';
    $("rPot").insertAdjacentElement("afterend", c);
    $("rBwL").addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); if (typeof bdOpen === "function") bdOpen("w"); });
  }
  return c;
}
const bwBossName = (id) => bwBossSpec(id).name;
function bwResults(R) {   // showResults (ui/screens.js), last
  const B = R.bw, tk = B.tk, name = bwBossName(tk.boss);
  BW.shown = R;
  $("rMode").textContent = `Boss Week · ${name} · ${BOSS_LV[tk.lv]}`; $("rWho").textContent = "";
  resTitle(B.won ? "Finished!" : B.cap ? "Out of time" : R.forfeit ? "Left the fight" : "He's still up");
  if (B.cap) resLine($("rSub"), [{ b: name }, " held on for 4:00. A run has 4 minutes from GO."]);
  else if (B.won) resLine($("rSub"), ["You and ", { b: match.cpu || "your partner" }, ` (${G.fighters[1].spec.name}) beat `, { b: name }, ` in ${bwClock(B.t, 2)}.`]);
  // the tiles: hearts lost, the break, damage, the Road's chips (if this win gave some)
  $("rKOs").textContent = B.fl; $("rKOsL").textContent = B.fl === 1 ? "Heart lost" : "Hearts lost";
  $("rFalls").textContent = B.brk >= 0 ? bwClock(B.brk, 1) : "—"; $("rFallsL").textContent = "Broken at";
  const road = B.road, chips = R.total > 0;
  $("rStats").classList.toggle("nochips", !chips); $("rChipT").hidden = !chips;
  if (chips) resCount($("rChipN"), 0, R.total, "", { delay: 200, dur: 600, end: () => Sfx.uiCoin() }); else $("rChipN").textContent = "0";
  $("rWhy").textContent = road && road.lines.length ? `The Road: ${road.lines.join(" · ")}` : "Boss Week pays on Monday: #1 300 · #2–3 150 · top 10 80 · a time 25 chips.";
  $("rAgain").querySelector("span").textContent = "Retry"; $("rAgain").disabled = false; $("rAgainSub").textContent = "";
  $("rChange").querySelector("span").textContent = "Board";
  $("rRank").hidden = true; $("rPot").hidden = true;
  const c = bwCard(); c.hidden = false;
  bwCardView();
  if (BW.res && BW.res.id === tk.id) bwVerdictView(false);
}
// the card before the verdict: the time and its sticker, the line under it
function bwCardView() {
  const R = BW.shown, B = R.bw, c = $("rBw"), D = $("rBwD"), L = $("rBwL"), mine = bwMine(), best = mine && mine.t ? mine.t : B.b0;
  c.className = "card res-bw"; D.className = "delta"; D.style.animation = "";
  $("rBwK").textContent = B.won ? "Your time" : "No time";
  $("rBwT").textContent = B.won ? bwClock(B.t, 2) : "--:--.--";
  const place = mine && mine.pl ? ` · #${mine.pl}` : "";
  if (B.sent && bwChecking()) {   // a new best on its way: the gold dot until the server's copy says so
    c.classList.add("wait"); D.classList.add("wait");
    $("rBwN").textContent = B.b0 ? bwDiff(B.t - B.b0, 2) : "New"; $("rBwS").textContent = "Checking…";
    L.className = "bw-l mute"; L.textContent = QM.conn ? "The server is playing your run again" : "Waiting for the server";
  } else if (B.sent) {   // sent, the answer already in (bwVerdictView shows it)
    $("rBwN").textContent = "…"; $("rBwS").textContent = "Checking…";
  } else if (B.won) {   // a win, not faster than your best: nothing to check
    D.classList.add("zero"); $("rBwN").textContent = bwDiff(B.t - best, 2); $("rBwS").textContent = `Best ${bwClock(best, 2)}`;
    L.className = "bw-l"; L.textContent = `Your best stays ${bwClock(best, 2)}${place} · Board ›`;
  } else {
    D.classList.add("zero"); $("rBwN").textContent = best ? bwClock(best, 2) : "—"; $("rBwS").textContent = best ? "Your best" : "No time yet";
    L.className = "bw-l mute";
    L.textContent = !bwLive() && !mine ? "Boss Week counts with the server on" : best ? `Your best stays ${bwClock(best, 2)}${place} · Board ›` : `Finish ${bwBossName(B.tk.boss)} once and you're on the board`;
  }
}
// the server's verdict on the results on screen
function bwVerdictView(late) {
  const v = BW.res, R = BW.shown;
  if (!v || !R || R.bw.tk.id !== v.id || mode !== "result" || !R.bw.sent) return;
  const c = $("rBw"), D = $("rBwD"), L = $("rBwL"), N = $("rBwN"), S = $("rBwS");
  c.classList.remove("wait"); D.className = "delta";
  if (late) { D.style.animation = "none"; void D.offsetWidth; D.style.animation = ""; }   // the sticker pops again (40-results.css)
  if (v.ok && v.why === "best") {
    const a = v.pl0 | 0, b = v.pl1 | 0, n = v.n | 0;
    $("rBwT").textContent = bwClock(v.time, 2);
    D.classList.add("up"); N.textContent = v.b0 ? bwDiff(v.time - v.b0, 2) : `#${b}`; S.textContent = "New best";
    L.className = "bw-l up";
    L.textContent = !a ? `#${b} of ${n} · Board ›` : b < a ? `#${a} → #${b} of ${n} ▲${a - b}` : `#${b} of ${n} · Board ›`;
    return;
  }
  if (v.ok) {   // the server's copy is a win, not faster than your best after all
    $("rBwT").textContent = bwClock(v.time, 2);
    D.classList.add("zero"); N.textContent = bwDiff(v.time - v.b0, 2); S.textContent = `Best ${bwClock(v.b0, 2)}`;
    L.className = "bw-l"; L.textContent = `Your best stays ${bwClock(v.b0, 2)}${v.pl1 ? ` · #${v.pl1}` : ""} · Board ›`;
    return;
  }
  D.classList.add("down"); N.textContent = "✕"; S.textContent = "Not counted";
  L.className = "bw-l down";
  L.textContent = v.why === "void" ? "Not counted · the game was updated during this run"
    : v.why === "week" ? "Not counted · the week ended during this run"
    : v.why === "late" ? "Already counted"
    : v.why === "claim" ? `Your best stays ${bwClock(v.b0, 2)}`
    : "Not counted · the replay didn't match";
}
// Pause: leaving a try costs nothing
function bwPauseText() { $("pQuit").querySelector("span").textContent = "Quit to menu"; $("pNote").textContent = "Leaving costs nothing. Only a finished run counts."; }

/* ----- the board (the Boards sheet's Boss Week tab, ui/bwsheet.js): { k: "w", wk, no, boss, n, at, fin, top: [{ id, nm, f, t, fl, cr, pl, r, v }],
   me: null | { i, row } | { i: 0 } } or null. r / v: the run's id and game version (the top 10 and your row: ▶ when v is PROTO, ui/replay.js).
   bwBoard(wk): a finished week (fin), one of the last four the server keeps ("Last week ›"). ----- */
function bwBoard(wk) {
  const M = window.__blBwMock;
  if (Number.isInteger(wk)) return bwBoardPast(wk);
  if (M) return Promise.resolve(M.board || null);
  if (!qmOn() || !QM.conn) return Promise.resolve(null);
  const c = BW.bd;
  if (c && performance.now() - c.t < 3000) return Promise.resolve(c.d);
  return new Promise((res) => {
    BW.bdWait.push(res);
    if (BW.bdWait.length > 1) return;
    window.__blQuick.send({ t: "bd", k: "w" });
    setTimeout(() => { if (BW.bdWait.length) bwBdDone(null); }, 5000);
  });
}
function bwBoardPast(wk) {
  const M = window.__blBwMock;
  if (M) return Promise.resolve(M.last || null);
  if (!qmOn() || !QM.conn) return Promise.resolve(null);
  const c = BW.bdl;
  if (c && c.d.wk === wk && performance.now() - c.t < 60000) return Promise.resolve(c.d);   // a finished week doesn't change
  return new Promise((res) => {
    BW.bdlWait.push(res);
    if (BW.bdlWait.length > 1) return;
    window.__blQuick.send({ t: "bd", k: "w", wk });
    setTimeout(() => { if (BW.bdlWait.length) bwBdlDone(null); }, 5000);
  });
}
function bwBdlDone(d) {
  if (d) BW.bdl = { t: performance.now(), d };
  for (const res of BW.bdlWait.splice(0)) res(d);
}
function bwBdClean(m) {
  if (!m || m.k !== "w" || !Array.isArray(m.top) || !Number.isInteger(m.wk)) return null;
  const row = (x) => (x && typeof x === "object" && typeof x.id === "string" ? { id: x.id.slice(0, 10), nm: SYNC.cleanName(typeof x.nm === "string" ? x.nm : "") || "Potato",
    f: FIG[x.f] ? x.f : "", t: bwN(x.t, 0), fl: bwN(x.fl, 0), cr: bwN(x.cr, 0), pl: typeof x.pl === "string" && /^[a-z][a-z0-9_]{0,15}$/.test(x.pl) ? x.pl : "",
    r: typeof x.r === "string" && /^[0-9a-f]{12}$/.test(x.r) ? x.r : "", v: bwN(x.v, 0) } : null);
  const d = { k: "w", wk: m.wk, no: bwN(m.no, 0), boss: BOSS_IDS.has(m.boss) ? m.boss : bwSpec().boss, n: bwN(m.n, 0), at: Number.isFinite(m.at) ? m.at : Date.now(), fin: !!m.fin,
    top: m.top.slice(0, 100).map(row).filter((r) => r && r.t > 0), me: null };
  if (m.me && typeof m.me === "object") d.me = m.me.row ? { i: bwN(m.me.i, 0), row: row(m.me.row) } : { i: 0 };
  return d;
}
function bwBdDone(d) {
  if (d) {
    BW.bd = { t: performance.now(), d };
    const me = bwMine();
    if (me && d.me && d.wk === bwSpec().wk) { const pl = d.me.row ? d.me.i : 0; if (pl !== me.pl) { me.pl = pl; bwSave(); } }
    if (BW.wk && d.wk === BW.wk.wk) BW.wk.n = d.n;
  }
  const w = BW.bdWait.splice(0);
  for (const res of w) res(d || (BW.bd ? BW.bd.d : null));
}

/* ----- every frame (vcTick, ui/vscpu.js) ----- */
function bwTick() {
  if (!qmOn()) return;
  if (BW.asking && Date.now() - BW.askT > 10000) bwFail("Couldn't reach the server. Try again.");
  if (mode === "menu") bwAskMe(false);
  // a won try sent with no answer: send it again (the server answers "late" if it already counted it)
  const p = BW.pend;
  if (p && p.sentT && Date.now() - p.sentT > 15000 && QM.authed) bwFlush();
  // Monday: last week's result, once, over the menu (ui/bwsheet.js)
  if (BW.lrNew && mode === "menu" && typeof bwWeekCard === "function" && screens.settings.hidden && (!screens.boards || screens.boards.hidden)) {
    const lr = BW.lrNew; BW.lrNew = null; BW.lrSeen = lr.wk; bwSave();
    bwWeekCard(lr);
  }
}
