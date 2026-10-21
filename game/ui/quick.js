/* ===================== Quick match: Ranked and Casual 1v1 against real players (the server side is quick.js) =====================
   One queue on our server for everyone with the same game version. The server pairs two players and names the room, the seed, both
   fighters and who hosts; the two phones then play exactly like a friend match (online.js: lockstep, the inputs in their presence).
   In Ranked the server plays the same match from those inputs and decides it, so the rank lives on the server (the account file's
   `on` part) and this page only shows it (a copy is kept on this device for the menu). While searching you can fight a CPU (a
   warm-up: chips, no rank); a found player ends it. Fable's design: quick-match/fable-quick.md.
   Screens: #scrQuick (you · your match · the queue), PLAYER FOUND! (#qmFound), the VS screen (#qmVs), the Season 1 sheet
   (#scrSeason), the searching strip on the warm-up's HUD (#qmStrip) and its results (#rQm); styles in css/96-quick.css.
   It needs net-ws.js's __blQuick (a page served by our own server). Elsewhere the gold hero stays the old Ranked vs a CPU. */
const QM_KEY = "potatobrawl.qm.v1";
const QM_PLACING = 5, QM_FLOOR = 900;   // the server's: the first 5 ranked matches place you and can't drop you below Bronze
const QM_FB = 20;                       // seconds a Ranked search waits for another Ranked player before it takes a Casual one
const QM_FRESH = Object.freeze({ id: "", r: 1000, pk: 1000, w: 0, l: 0, d: 0, n: 0, h: Object.freeze([]) });   // Season 1 starts everyone here
const QM = {
  st: "idle",          // idle | search | found (the found moment, the VS screen and the match itself)
  mode: "r",           // "r" Ranked or "c" Casual, remembered
  s1: false,           // the Season 1 sheet was seen
  me: null, code: "",  // the server's online record { id, r, pk, w, l, d, n, h } and the sync code it belongs to
  conn: false, authed: false, authing: false, authCode: "", acct: "", making: false, lastCode: null,   // acct: "" | "off" | "unknown" (the server's answer)
  t0: 0, hidden: false, wait: null, sentF: "", no: "", note: "",
  found: null, res: null, pend: null, applied: [], streak: 0,
  vsT: 0, vsN: 0, fdT: 0, cfT: 0, uiT: 0, seq: 0, shown: null,   // vsN: VS screens shown (the tests read it)
};
const qmOn = () => !!window.__blQuick && !window.__blNoQuick;   // __blNoQuick: tests of the older screens on our server
(function qmLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(QM_KEY) || "null");
    if (!s || typeof s !== "object") return;
    QM.mode = s.mode === "c" || s.mode === "v" ? s.mode : "r"; QM.s1 = !!s.s1; QM.streak = Math.max(0, s.k | 0);   // v: Ranked vs CPU (ui/vscpu.js)
    if (s.me && typeof s.code === "string") { QM.me = qmClean(s.me); QM.code = s.code; }
  } catch (e) { /* storage blocked: nothing remembered */ }
})();
function qmSave() { try { localStorage.setItem(QM_KEY, JSON.stringify({ mode: QM.mode, s1: QM.s1, me: QM.me, code: QM.code, k: QM.streak })); } catch (e) { /* ignore */ } }
// a record from the server (or this device's copy), cleaned
function qmClean(o) {
  const n = (v, d) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : d), s = (v, k) => (typeof v === "string" ? v.slice(0, k) : "");
  const me = { id: s(o.id, 10), r: n(o.r, 1000), pk: n(o.pk, 1000), w: n(o.w, 0), l: n(o.l, 0), d: n(o.d, 0), n: n(o.n, 0), h: [] };
  me.pk = Math.max(me.pk, me.r);
  if (Array.isArray(o.h)) me.h = o.h.filter((x) => x && typeof x === "object").slice(0, 20).map((x) => ({
    t: Number.isFinite(x.t) ? x.t : 0, o: SYNC.cleanName(s(x.o, 40)), of: FIG[x.of] ? x.of : "", f: FIG[x.f] ? x.f : "",
    or: n(x.or, 0), res: [1, 0.5, 0].includes(x.res) ? x.res : 0, dr: Number.isInteger(x.dr) && Math.abs(x.dr) < 1000 ? x.dr : 0, why: s(x.why, 8) }));
  // ui/rivals.js: the last 30 opponents, the Ranked win streak and its bounty, the refereed count
  me.rv = Array.isArray(o.rv) ? o.rv.map(rvClean).filter(Boolean).slice(0, 30) : [];
  me.ws = n(o.ws, 0); me.bty = rvBounty(me.ws); me.g = n(o.g, 0);
  me.sk = stkRec(o.sk);   // ui/stakes.js: today's staked matches, the record, the net chips
  return me;
}
const qmMe = () => (QM.me && QM.code && QM.code === ACCT.code ? QM.me : null);   // the record of the account this device is linked to
// the rank the page shows (the profile plate, the menu, the Account sheet): the online one on our own server, else the CPU one
function rankView() {
  if (!qmOn()) return { online: false, r: P.rating | 0, pk: Math.max(P.peak | 0, P.rating | 0), w: P.wins | 0, l: P.losses | 0, d: P.draws | 0, n: P.matches | 0,
    h: (P.history || []).map((x) => ({ res: x.r, dr: x.d })) };
  const m = qmMe() || QM_FRESH, c = m.n ? null : vcMine();   // no online match yet: the CPU rank of Ranked vs CPU (ui/vscpu.js), when there is one
  if (c && c.n) return { online: true, cpu: true, r: c.r, pk: Math.max(c.pk, c.r), w: c.w, l: c.l, d: c.d, n: c.n, h: c.h.map((x) => ({ res: x.res, dr: x.dr })) };
  return { online: true, r: m.r, pk: Math.max(m.pk, m.r), w: m.w, l: m.l, d: m.d, n: m.n, h: m.h };
}
const qmAcctOff = () => QM.acct === "off" || (!ACCT.code && ACCT.avail === false);   // the server keeps no accounts: Casual only
const qmMode = () => (qmAcctOff() ? "c" : QM.mode);
const qmSearching = () => QM.st === "search";
// online.js lobbyPresence: searching (the queue's gold dot) or busy in a found match, for everyone's queue list
function qmPresence() { return qmOn() ? { qs: qmSearching() && !QM.hidden ? 1 : 0, busy: QM.st === "found" } : { qs: 0, busy: false }; }
// acct.js Centurion: online Ranked wins count too
function qmWins() { const m = qmOn() && qmMe(); return m ? m.w : 0; }
const qmClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const qmWaited = () => Math.max(0, (Date.now() - QM.t0) / 1000);
// the server's Elo, for the Forfeit line (K 48 for the first 10, then 32; placement can't drop you below Bronze)
function qmElo(r, or, res, n) { const K = n < 10 ? 48 : 32, d = Math.round(K * (res - 1 / (1 + Math.pow(10, (or - r) / 400)))); return Math.max(n < QM_PLACING ? QM_FLOOR : 0, r + d) - r; }
// a tier plate's words: "Silver 1138", "Placing 2/5", or "Unranked" for a Casual player without an account
function qmTierWords(r, placing, unranked) { return unranked ? "Unranked" : placing ? `Placing ${placing.n}/${QM_PLACING}` : `${tierInfo(r).t.name} ${r}`; }

/* ----- the connection: sign in with the sync code, the server's messages ----- */
function qmBoot() {   // loop.js, before the first menu
  if (!qmOn()) return;
  const api = window.__blQuick;
  api.on(qmMsg);
  if (window.__blSetName) NET.myName = window.__blSetName(acctName());   // the name players see in Quick match is the Account one
  api.onConnection((on) => {
    QM.conn = on; QM.authing = false;
    if (on) {
      QM.authed = false; QM.acct = "";
      // a Ranked match left while the connection was down: say so now, so the server decides it at once
      if (QM.pend && !NET.mr) api.send({ t: "leave", room: QM.pend.room });
      qmAuth();
      if (qmSearching()) qmSend();
      // found but not started yet: the connection that was paired is gone, so is that match (the server tells the other phone)
      else if (QM.st === "found" && QM.found && NET.phase !== "match" && NET.phase !== "result") qmOff({ id: QM.found.id });
    }
    qmRefresh();
  });
  QM.conn = api.connected();
  netInit().then(() => { if (NET.room) NET.room.onPeers(qmPeers); qmRefresh(); });   // whether accounts are on is asked when Quick match opens (quickOpen)
  document.addEventListener("visibilitychange", qmVis);
  vcBoot();   // ui/vscpu.js: Ranked vs CPU's messages
}
function qmAuth() {
  if (!qmOn() || !ACCT.code || !QM.conn || QM.authing || QM.authed || QM.acct === "off" || QM.acct === "unknown") return;
  QM.authing = window.__blQuick.send({ t: "auth", code: ACCT.code });
  if (QM.authing) QM.authCode = ACCT.code;
}
function qmMsg(m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "me") qmGotMe(m);
  else if (m.t === "qm-wait") { if (qmSearching()) { QM.wait = m; qmUi(); } }
  else if (m.t === "qm-no") qmRefused(m.why);
  else if (m.t === "qm-x") { if (qmSearching()) qmCancel("You're searching on another page or phone."); }
  else if (m.t === "qm-found") qmFound(m);
  else if (m.t === "qm-off") qmOff(m);
  else if (m.t === "qm-res") { qmRes(m); stkGot(m, 1); }   // ui/stakes.js: who can play a rematch for chips now
  else if (m.t === "qm-cs") { rvCasual(m); stkGot(m, m.g); }   // ui/rivals.js: a Casual game (or a Play friends one) the server played to its end
  else if (m.t === "qm-sk") stkRes(m);   // ui/stakes.js: a staked match decided
  else if (m.t === "acct") qmAcctAnswer(m);
  else if (m.t === "stk-out" || m.t === "stk-in" || m.t === "stk-off" || m.t === "stk-no") stkMsg(m);
}
function qmGotMe(m) {
  QM.authing = false;
  if (m.err) {
    QM.authed = false; QM.acct = m.err === "off" ? "off" : "unknown";
    if (qmSearching()) qmSend();   // Casual goes on; Ranked can't
  } else {
    QM.authed = true; QM.acct = ""; QM.code = ACCT.code; QM.me = qmClean(m);
    let k = 0; while (k < QM.me.h.length && QM.me.h[k].res === 1) k++;
    QM.streak = Number.isInteger(m.ws) ? QM.me.ws : k;   // the server's streak (a draw keeps it)
    qmSave(); qmPendMe();
    if (qmSearching()) qmSend();
  }
  qmRefresh();
}
function qmRefused(why) {
  if (why === "acct") { QM.authed = false; qmAuth(); return; }   // signed out (the server restarted): sign in, then search again
  if (why === "busy") {   // the server still has us in the last match: leave it, then search again
    if (QM.found) window.__blQuick.send({ t: "leave", room: QM.found.room });
    setTimeout(qmSend, 400); return;
  }
  if (why === "old") QM.no = "old";
  if (qmSearching()) qmCancel(why === "old" ? "" : "Couldn't search. Try again.");
  qmRefresh();
}
// the menu, the plate and this screen follow every change
function qmRefresh() { if (!qmOn()) return; renderPill(); if (mode === "menu") qmHero(); qmRender(); }
function qmPeers() { if (mode === "quick") qmRender(); else if (mode === "menu") qmHero(); }
// everyone with the page open (the lobby room), and who of them searches (their lobby presence, online.js lobbyPresence)
function qmLobby() {
  const ps = (NET.lobbyPeers || []).filter((p) => p.kind === "viewer");
  return { ps, n: Math.max(ps.length, QM.conn ? 1 : 0), q: ps.filter((p) => !p.sameTab && p.presence && p.presence.qs).length };
}

/* ----- searching ----- */
async function qmMakeAcct() {   // the silent account: the existing sync-code account, made on the first Ranked search
  if (ACCT.code) return true;
  if (QM.making) return false;
  QM.making = true;
  const prof = acctSnap(), r = await acctCall("new", { prof });
  QM.making = false;
  const code = r.s === 200 && r.j ? SYNC.normCode(r.j.code) : "";
  if (code && Number.isSafeInteger(r.j.rev)) {
    ACCT.avail = true; ACCT.code = code; ACCT.rev = r.j.rev; ACCT.base = prof; ACCT.t = Date.now(); ACCT.lt = 0; ACCT.force = false; ACCT.lastC = SYNC.canon(prof);
    acctStore(); cnt("acct");   // cnt: ui/counter.js
    return true;
  }
  if (r.s === 404) ACCT.avail = false;
  return false;
}
async function qmFind() {
  if (!qmOn() || QM.st !== "idle") return;
  if (QM.no === "old") { location.reload(); return; }
  if (!QM.conn || !NET.room) { QM.note = "Connecting to the server…"; qmRender(); return; }
  QM.st = "search"; QM.t0 = Date.now(); QM.wait = null; QM.note = ""; QM.sentF = "";
  lobbyPresence(); qmRender();
  // the silent account, for Casual too (the referee keeps your rival record); Casual searches on without one
  if (!ACCT.code && (qmMode() === "r" || !qmAcctOff())) {
    const ok = await qmMakeAcct();
    if (!qmSearching()) return;   // cancelled meanwhile
    if (!ok && qmMode() === "r") { qmCancel(qmAcctOff() ? "Ranked opens soon. Casual works now." : "Couldn't reach the server. Try again."); return; }
  }
  qmSend();
}
// Play friends (online.js netHost / netJoin): the silent account too, so the referee keeps the rival record and stakes can follow.
// Unknown whether this server keeps accounts: it says so over the socket first (an HTTP try would leave a 404 where they're off).
function qmSilent() {
  if (!qmOn() || ACCT.code || qmAcctOff() || QM.making) return;
  if (ACCT.avail) { qmMakeAcct(); return; }
  if (QM.conn) QM.asked = window.__blQuick.send({ t: "acct?" });
}
function qmAcctAnswer(m) {
  ACCT.avail = !!m.on;
  if (m.on && QM.asked) { QM.asked = false; qmMakeAcct(); }
}
function qmSend() {
  if (!qmSearching() || QM.hidden || !QM.conn) return;
  if (ACCT.code && !QM.authed && !QM.acct) { qmAuth(); return; }   // signed in first: the server pairs by your rank (it searches on `me`)
  if (qmMode() === "r" && !QM.authed) { qmCancel(QM.acct === "unknown" ? "This phone's account isn't on the server. Check Account." : "Ranked opens soon. Casual works now."); return; }
  const w = Math.min(60, Math.round(qmWaited()));
  QM.sentF = sel.fighter;
  window.__blQuick.send({ t: "qm", v: PROTO, mode: qmMode(), f: sel.fighter, pi: palIdx(sel.fighter), w });
}
function qmCancel(note) {
  if (qmSearching() && qmOn()) window.__blQuick.send({ t: "qmx" });
  QM.st = "idle"; QM.wait = null; QM.note = note || ""; QM.hidden = false;
  qmStripShow(false); $("rQm").hidden = true;
  lobbyPresence(); qmRender();
}
// a hidden page leaves the queue (the server never pairs a phone in a pocket) and comes back with the time it had waited
function qmVis() {
  if (!qmOn()) return;
  if (document.hidden) { if (qmSearching() && !QM.hidden) { QM.hidden = true; window.__blQuick.send({ t: "qmx" }); } }
  else if (QM.hidden) { QM.hidden = false; qmSend(); }
}
// goMenu: the menu stops the search (the warm-up's results say so on their Menu button)
function qmStop() {
  if (!qmOn()) return;
  if (qmSearching()) window.__blQuick.send({ t: "qmx" });
  QM.st = "idle"; QM.wait = null; QM.fdT = 0; QM.vsT = 0; QM.note = ""; QM.hidden = false;
  $("qmFound").hidden = true; $("qmVs").hidden = true; qmStripShow(false);
  NET.qm = null;
  lobbyPresence();
}

/* ----- a player found: join the room, PLAYER FOUND! over a warm-up, the VS screen, then the host starts the fight ----- */
function qmFoundOk(m) {
  return typeof m.room === "string" && /^qm[0-9a-f]{12}$/.test(m.room) && m.id === m.room && (m.role === "host" || m.role === "guest") && Number.isInteger(m.seed) &&
    Array.isArray(m.f) && m.f.length === 2 && m.f.every((id) => FIG[id]) && Array.isArray(m.p) && m.p.length === 2 &&
    m.p.every((v, i) => Number.isInteger(v) && v >= 0 && v < FIG[m.f[i]].palettes.length) && validRules(m.r) && !!m.opp && typeof m.opp === "object";
}
function qmFound(m) {
  const sk = stkFoundOk(m);   // ui/stakes.js: the rematch for chips this phone challenged for or accepted
  if (!(qmSearching() || sk) || !qmFoundOk(m)) return;   // a late one after a cancel: the server lets its room time out
  const opp = m.opp;
  opp.name = SYNC.cleanName(opp.name) || "Potato";
  QM.st = "found"; QM.found = m; QM.res = null; QM.wait = null; QM.note = "";
  rvFound(m);   // ui/rivals.js
  if (sk) stkFound(m); else m.sk = 0;
  const me = qmMe() || QM_FRESH;
  QM.pend = m.ranked ? { id: m.id, room: m.room, n0: me.n, r0: me.r, w0: me.w, l0: me.l, d0: me.d, k0: QM.streak, dead: 0 } : null;
  Sfx.init(); qmChime();
  try { if (navigator.vibrate) navigator.vibrate([60, 90, 60]); } catch (e) { /* no vibration */ }
  qmJoin(m);
  if (mode === "match" && match && match.warm && G && G.phase !== "over") qmFoundBanner(m);
  else { qmEndWarm(); qmVs(m); }
  lobbyPresence();
}
async function qmJoin(m) {
  if (NET.mr) leaveMatchRoom();
  resetNet();
  const me = m.role === "host" ? 0 : 1;
  NET.qm = { id: m.id, room: m.room, ranked: !!m.ranked, sk: m.sk | 0, fb: !!m.fb, seed: m.seed, f: m.f.slice(), p: m.p.slice(), r: Object.assign({}, m.r), opp: m.opp, rd: false };
  NET.role = m.role; NET.phase = m.role === "host" ? "hosting" : "joining"; NET.joinT = performance.now(); NET.note = "";
  NET.oppName = m.opp.name; NET.mrCode = m.room;
  try { await openMatchRoom(m.room); }
  catch (e) { return; }   // the server calls the match off (qm-off) and the search goes on
  if (NET.mrCode !== m.room) return;
  namedPresence({ role: m.role, f: m.f[me], pi: m.p[me], rd: 0, gz: glazePres() });   // gz: your glazed skins, drawn on the other phone (ui/glaze.js)
}
function qmChime() { Sfx.tone(784, 784, 0.12, "triangle", 0.08); Sfx.at(0.13, 1175, 1175, 0.22, "triangle", 0.08); Sfx.at(0.06, 110, 40, 0.4, "sine", 0.45); }
// over a running CPU warm-up: the fight freezes under PLAYER FOUND! and a 3·2·1 (qmTick), then ends with no result
function qmFoundBanner(m) {
  paused = true; releaseTouch(); hideBanner();
  modal("pause", false); modal("help", false); modal("settings", false);
  const o = m.opp, el = $("qmFound"), vs = $("qfVs");
  vs.textContent = "";
  vs.append(`vs ${o.name} `);
  const em = document.createElement("i"); em.className = "qf-em"; em.innerHTML = tierEmblem(tierIdx(o.r)); vs.append(em);
  const t = document.createElement("span"); t.textContent = qmTierWords(o.r, o.pl >= 0 ? { n: o.pl } : null, !o.id); vs.append(t);
  const st = document.createElement("span"); st.className = "tag st " + (m.ranked ? "gold" : "sky"); st.textContent = m.ranked ? "Ranked" : "Casual"; vs.append(st);
  rvFoundLine(vs, m);   // ui/rivals.js: · WANTED 40
  $("qfN").textContent = "3";
  el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
  QM.fdT = performance.now();
}
// the warm-up (running or on its results) gives way to the found match: the Quick match screen goes under the VS screen
function qmEndWarm() {
  if (mode === "match" && match && match.warm) cntEnd(true);   // ui/counter.js: it ended without a result
  if (mode === "match" || mode === "result") {
    finStop(); paused = false;
    $("hud").hidden = true; $("ctl").hidden = true; hideBanner(); releaseTouch();
    modal("pause", false); modal("help", false); modal("settings", false);
    G = null; match = null; meSlot = 0;
  }
  if (mode !== "quick") { mode = "quick"; show("quick"); resize(); }
  modal("season", false);
  qmStripShow(false);
  qmRender();
}
// the VS screen's two models, drawn live in the skins of this match (as the Fight Card), facing each other
const qmVsArt = [];
function qmVs(m) {
  const mine = m.role === "host" ? 0 : 1, o = m.opp, me = qmMe(), el = $("qmVs");
  const fs = newGame({ seed: 1, players: m.f.map((id, k) => ({ spec: FIG[id], pal: FIG[id].palettes[m.p[k]] || FIG[id].palettes[0] })), countdown: 1 }).fighters;
  qmVsArt.length = 0;
  glazeMark(fs[mine], glazeHas(m.f[mine], m.p[mine]));   // ui/glaze.js: your own glaze on the VS screen
  for (const [k, f] of [["L", fs[mine]], ["R", fs[1 - mine]]]) { f.x = 0; f.y = 0; f.facing = k === "L" ? 1 : -1; qmVsArt.push({ cv: $("vsArt" + k), f, fit: 0.6, bottom: 0.9 }); }
  const side = (k, name, fid, pi, r, pl, unranked) => {
    const spec = FIG[fid], pal = spec.palettes[pi] || spec.palettes[0];
    el.style.setProperty(k === "L" ? "--cl" : "--cr", rgba(col(pal), 0.42));
    $("vsName" + k).textContent = name;
    $("vsF" + k).textContent = spec.name;
    const t = $("vsT" + k); t.innerHTML = tierEmblem(tierIdx(r)); t.classList.toggle("un", !!unranked || !!pl);
    const w = document.createElement("span"); w.textContent = qmTierWords(r, pl, unranked); t.append(w);
  };
  const my = me || QM_FRESH;
  side("L", NET.myName || acctName(), m.f[mine], m.p[mine], my.r, me && my.n < QM_PLACING ? { n: my.n } : null, !me);
  side("R", o.name, m.f[1 - mine], m.p[1 - mine], Number.isInteger(o.r) ? o.r : 1000, o.pl >= 0 ? { n: o.pl } : null, !o.id);
  $("vsMode").textContent = m.sk ? "Rematch · for chips" : m.ranked ? "Ranked" : "Casual";
  $("vsStamp").className = "vs-st " + (m.sk ? "sk" : m.ranked ? "rk" : "cs");
  $("vsFb").hidden = !m.fb; $("vsWhy").hidden = m.ranked;
  stkVs(m);   // ui/stakes.js: the pot
  $("vsPing").textContent = `measuring… · ${mapName(m.seed % BL.POOL)}`;
  rvVs(m);   // ui/rivals.js: the record, the tags, the wanted plates
  el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
  QM.vsT = performance.now(); QM.vsN++;
  Sfx.tone(120, 40, 0.35, "sine", 0.5); Sfx.noise(0.2, 0.3, 900);
}
// online.js startOnlineMatch: the fight's own countdown takes over from the VS screen
function qmMatchStarts() {
  $("qmVs").hidden = true; $("qmFound").hidden = true; QM.vsT = 0; QM.fdT = 0;
  QM.st = "found"; modal("season", false);
}
// online.js handshakeTick: the host starts exactly the match the server assigned, once both VS screens have shown (rd)
const qmReady = (pr) => !!NET.qm && NET.qm.rd && pr.rd === 1;
function qmStartMsg(D, rtt) {
  const q = NET.qm;
  return { id: NET.matchId + 1, seed: q.seed, d: D, f: q.f.slice(), p: q.p.slice(), rtt: Math.round(rtt), r: Object.assign({}, q.r), set: { n: 1, w: [0, 0] } };
}
// ...and the guest plays only that match (a Casual rematch is the friend-match one; Ranked and staked matches have none)
function qmStartOk(st) {
  const q = NET.qm;
  if (st.id !== 1) return !q.ranked && !q.sk;
  return st.seed === q.seed && st.f[0] === q.f[0] && st.f[1] === q.f[1] && st.p[0] === q.p[0] && st.p[1] === q.p[1] &&
    st.r.l === q.r.l && st.r.t === q.r.t && st.r.b === q.r.b && st.set.n === 1 && st.bo == null;
}
// the match was called off before it started (the other phone never connected or left): back to the search, the time kept
function qmOff(m) {
  if (!QM.found || m.id !== QM.found.id || NET.phase === "match" || NET.phase === "result") return;
  const banner = !!QM.fdT;
  $("qmVs").hidden = true; $("qmFound").hidden = true; QM.vsT = 0; QM.fdT = 0;
  if (NET.mr) leaveMatchRoom();
  resetNet(); NET.phase = "idle";
  if (stkOff(m)) { QM.found = null; QM.st = "idle"; quickOpen(); lobbyPresence(); return; }   // ui/stakes.js: a staked match never searched
  QM.found = null; QM.pend = null; QM.st = "search"; QM.wait = null;
  if (banner && mode === "match" && match && match.warm) { paused = false; QM.note = ""; }   // the CPU fight goes on
  else { if (mode !== "quick") quickOpen(); QM.note = "The other player didn't connect. Searching again."; }
  qmSend(); lobbyPresence(); qmRender();
}

/* ----- the end of a Quick match ----- */
// online.js finishOnline: chips on this phone as before (Ranked as the old Ranked, Casual as a friend match); the rank from the server
function qmFinish(left, lost) {
  const q = match.qm, me = G.fighters[meSlot], op = G.fighters[1 - meSlot], over = !left && !lost;
  const res = left ? 1 : lost ? 0.5 : G.winner === meSlot ? 1 : G.winner === 1 - meSlot ? 0 : 0.5;
  const R = { res, online: true, qm: q, left: !!left, lost: !!lost, me, op, lines: [], total: 0 };
  const kos = (each) => { if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * each]); };
  if (q.ranked && (over || left)) {
    if (res === 1) {
      R.lines.push([left ? "Win · they left" : "Win", 20]); kos(5);
      const k = (QM.pend && QM.pend.id === q.id ? QM.pend.k0 : QM.streak) + 1, sb = over ? Math.min(20, (k - 1) * 5) : 0;
      if (sb > 0) R.lines.push([`${k} win streak`, sb]);
    } else if (res === 0.5) { R.lines.push(["Draw", 10]); kos(3); }
    else { R.lines.push(["Match played", 6]); kos(2); }
  } else if (!q.ranked && over) {   // Casual, and a staked match too: its pot shows only in the pot card (ui/stakes.js)
    R.lines.push(res === 1 ? ["Win", 15] : res === 0.5 ? ["Draw", 8] : ["Match played", 5]); kos(2);
  }
  R.total = R.lines.reduce((a, l) => a + l[1], 0);
  if (R.total) { P.tokens += R.total; saveProfile(); }
  if (q.ranked) rvFinishLines(R, q);   // ui/rivals.js: a bounty the verdict already brought, shown only (the server pays it)
  if (lost || left || q.ranked || q.sk) { leaveMatchRoom(); NET.phase = "idle"; } else NET.phase = "result";   // Ranked and staked matches have no rematch in the room: it goes
  if (QM.pend && QM.pend.id === q.id) QM.pend.over = true;
  QM.st = "idle";
  $("netBadge").hidden = true;
  showResults(R);
  lobbyPresence();
}
// Pause > Forfeit: Ranked counts it as a loss (the server too, when the room is left); Casual just leaves
function qmForfeit() {
  const q = match.qm;
  leaveMatchRoom(); NET.phase = "idle"; QM.st = "idle";
  if (!q.ranked && !q.sk) { resetNet(); QM.note = "You left the match."; quickOpen(); lobbyPresence(); return; }
  if (QM.pend && QM.pend.id === q.id) QM.pend.over = true;
  showResults({ res: 0, online: true, qm: q, forfeit: true, me: G.fighters[meSlot], op: G.fighters[1 - meSlot], lines: [], total: 0 });
  lobbyPresence();
}
// screens.js showResults, at its end: what a Quick match's results (and a warm-up's) say and do
function qmResults(R) {
  QM.shown = R;
  if (R.vc) { vcResults(R); return; }   // ui/vscpu.js: Ranked vs CPU
  { const ln = $("rBoardL"); if (ln) ln.hidden = true; $("rRank").classList.remove("vc"); }
  const mn = $("rMenuSub");
  if (R.warm) {
    const k = $("rMode"); k.textContent = "";
    const t = document.createElement("span"); t.className = "tag ember st qm-cpu"; t.textContent = "CPU";
    k.append(t, "Warm-up");
    $("rAgain").querySelector("span").textContent = "Another CPU fight";
    $("rChange").querySelector("span").textContent = qmSearching() ? "Back to search" : "Quick match";
    mn.textContent = qmSearching() ? "stops searching" : "";
    qmResCard();
    return;
  }
  const q = R.qm;
  $("rMode").textContent = q.sk ? `Rematch for chips · ${q.sk} each` : `Quick match · ${q.ranked ? "Ranked" : "Casual"}${q.fb ? " · no Ranked player found" : ""}`;
  rvResults(R);   // ui/rivals.js: the record now, the rival strip
  if (q.ranked || q.sk) {
    $("rAgain").querySelector("span").textContent = "Next match"; $("rAgain").disabled = false;
    $("rChange").querySelector("span").textContent = "Quick match";
    if (R.lost) { resTitle("Connection lost"); resLine($("rSub"), [`The connection dropped. The server decides this ${q.sk ? "pot" : "match"}.`]); }
    if (!R.lines.length) $("rWhy").textContent = masteryWhy(R.forfeit ? "No chips for a match you left." : "No chips for an unfinished match.");
    if (q.sk) stkResults(R);   // ui/stakes.js: the pot card in the rank card's place
    else { qmRankCard(); if (QM.res && QM.res.id === q.id) qmVerdictView(false); }
  } else {
    $("rChange").querySelector("span").textContent = "Next match";
    if (!R.lines.length) $("rWhy").textContent = masteryWhy("No chips for an unfinished match. Casual doesn't change your rank.");
  }
  stkButtons();   // ui/stakes.js: FOR CHIPS
}
// the rank card while the server confirms: the rating before, a mute … sticker, a shimmer on the bar (css/96-quick.css)
function qmRankCard() {
  const p = QM.pend && QM.shown && QM.shown.qm && QM.pend.id === QM.shown.qm.id ? QM.pend : null, me = qmMe() || QM_FRESH;
  const r0 = p ? p.r0 : me.r, n0 = p ? p.n0 : me.n, ti = tierInfo(r0), card = $("rRank");
  card.hidden = false; card.classList.add("qm-wait"); card.classList.remove("qm-zero"); card.style.setProperty("--tc", ti.t.col);
  paintBadge($("rBadge"), ti.i);
  $("rTier").textContent = n0 < QM_PLACING ? "Placing" : ti.t.name;
  $("rPromo").textContent = ""; $("rPromo").classList.remove("down");
  const rt = $("rRating"), b = document.createElement("b"); b.textContent = `${r0} → …`; rt.textContent = ""; rt.append(b);
  $("rBar").style.setProperty("--p", ti.p);
  const g = $("rGain"); g.style.setProperty("--g0", ti.p); g.style.setProperty("--g1", ti.p);
  $("rStick").className = "delta wait"; $("rDelta").textContent = "…"; $("rStick").querySelector("small").textContent = "Confirming";
  QM.cfT = performance.now();
}
// the server's verdict on the results on screen: the normal rank sequence, or the forfeit / no-result words
function qmVerdictView(late) {
  const v = QM.res, R = QM.shown;
  if (!v || !R || !R.qm || R.qm.id !== v.id || mode !== "result") return;
  const card = $("rRank"), st = $("rStick"), sheet = $("resSheet"), who = R.qm.opp ? R.qm.opp.name : NET.oppName || "Your opponent";
  card.classList.remove("qm-wait"); QM.cfT = 0;
  const look = (k) => { sheet.classList.remove("win", "loss", "draw"); sheet.classList.add(k); };
  if (v.res === null) {
    card.classList.add("qm-zero"); st.className = "delta zero"; $("rDelta").textContent = "±0"; st.querySelector("small").textContent = "No result";
    const me = qmMe() || QM_FRESH, rt = $("rRating"), b = document.createElement("b"); b.textContent = String(me.r); rt.textContent = ""; rt.append(b, " · unchanged");
    $("rPromo").textContent = ""; resTitle("No result"); look("draw");
    resLine($("rSub"), ["The server lost this match. Nobody's rank changes."]);
    rvVerdict(late);
    return;
  }
  if (late) { st.style.animation = "none"; void st.offsetWidth; st.style.animation = ""; }   // the sticker pops again (40-results.css)
  resRank({ before: v.r0, after: v.r1, delta: v.dr, tb: tierIdx(v.r0), ta: tierIdx(v.r1) });
  st.querySelector("small").textContent = "Rating";   // was "Confirming"
  if (v.n < QM_PLACING) { $("rTier").textContent = `Placing ${v.n} of ${QM_PLACING}`; $("rPromo").textContent = ""; }
  else if (v.n === QM_PLACING) { $("rPromo").textContent = "Placed!"; $("rPromo").classList.remove("down"); }
  if (v.why !== "game") {
    st.querySelector("small").textContent = "Rating · forfeit";
    if (v.res === 1) {
      resTitle("Opponent left"); look("win");
      resLine($("rSub"), v.why === "start" ? [{ b: who }, "'s game didn't match the server's. It counts as your win."] : [{ b: who }, v.why === "quiet" ? " stopped playing. It counts as your win." : " left. It counts as your win."]);
    } else {
      resTitle(R.forfeit ? "Forfeit" : "Disconnected"); look("loss");
      resLine($("rSub"), [R.forfeit ? "You left the match. " : "Your connection dropped. ", "In Ranked that counts as a loss."]);
    }
  } else if (v.res !== R.res) {   // the server's copy decides (this phone lost the connection near the end)
    resTitle(v.res === 1 ? "Victory" : v.res === 0 ? "Defeat" : "Draw"); look(v.res === 1 ? "win" : v.res === 0 ? "loss" : "draw");
    resLine($("rSub"), ["The server's result: ", v.res === 1 ? "you won." : v.res === 0 ? "you lost." : "a draw."]);
  }
  rvVerdict(late);   // ui/rivals.js, after the story line: the record as the server has it, a bounty taken or lost
}
// a verdict: the online record moves (the copy on this device too), the results on screen show it
function qmRes(m) {
  if (!m || typeof m.id !== "string" || QM.applied.includes(m.id)) return;
  QM.applied.push(m.id); if (QM.applied.length > 8) QM.applied.shift();
  rvRanked(m);   // ui/rivals.js: the record, the streak, a bounty paid into the account
  const f = QM.found && QM.found.id === m.id ? QM.found : null;
  if (m.res !== null && Number.isInteger(m.r1) && Number.isInteger(m.n)) {
    const me = Object.assign({}, qmMe() || QM_FRESH);
    Object.assign(me, { r: m.r1, pk: Math.max(m.pk | 0, m.r1), n: m.n, w: m.w | 0, l: m.l | 0, d: m.d | 0 });
    const mine = f && f.role === "guest" ? 1 : 0;
    me.h = [{ t: Date.now(), o: f ? f.opp.name : "", of: f ? f.f[1 - mine] : "", f: f ? f.f[mine] : "", or: f && Number.isInteger(f.opp.r) ? f.opp.r : 0, res: m.res, dr: m.dr | 0, why: m.why }, ...me.h].slice(0, 20);
    QM.me = me; QM.code = ACCT.code;
    if (Number.isInteger(m.ws)) QM.streak = m.ws; else if (m.res === 1) QM.streak++; else if (m.res === 0) QM.streak = 0;
    qmSave();
    if (f) {   // the per-fighter record (Account > Stats) counts Ranked matches, online ones too
      const fs = P.fstats[f.f[mine]] || (P.fstats[f.f[mine]] = { w: 0, l: 0, d: 0 });
      fs[m.res === 1 ? "w" : m.res === 0 ? "l" : "d"]++;
      if (!P.fsince) P.fsince = Date.now();
      saveProfile();
    }
  }
  if (QM.pend && QM.pend.id === m.id) QM.pend = null;
  QM.res = m;
  qmRefresh();
  if (mode === "result" && QM.shown && QM.shown.qm && QM.shown.qm.id === m.id) qmVerdictView(true);
  else if (QM.st === "found" && f && !(match && match.qm && match.qm.id === m.id)) {
    // decided before the fight began on this phone: the host's start didn't match what the server assigned (or nobody played)
    $("qmVs").hidden = true; $("qmFound").hidden = true; QM.vsT = 0; QM.fdT = 0;
    if (NET.mr) leaveMatchRoom();
    resetNet(); NET.phase = "idle"; QM.st = "idle";
    QM.note = m.res === 1 ? `${f.opp.name}'s game didn't match the server's. It counts as your win (+${m.dr}).` : m.res === null ? "That match was called off. Nobody's rank changed." : "Your game didn't match the server's. Reload the page.";
    quickOpen();
  }
}
// a verdict that never came: `me` after a reconnect shows whether the match counted (the server wrote it) or was lost with a restart
function qmPendMe() {
  const p = QM.pend, me = QM.me;
  if (!p || !me) return;
  if (me.n > p.n0) {
    const res = me.w > p.w0 ? 1 : me.l > p.l0 ? 0 : 0.5;
    qmRes({ id: p.id, res, why: "game", r0: p.r0, r1: me.r, dr: me.r - p.r0, n: me.n, pk: me.pk, w: me.w, l: me.l, d: me.d });
  } else if (p.over) p.dead = p.dead || Date.now();   // over on this page and not counted on the server (yet)
}

/* ----- the CPU warm-up: a CPU fight while the search goes on ----- */
function qmWarmStart() {
  if (QM.st === "idle") qmFind();
  if (!qmSearching()) return;
  Sfx.init(); goFull();
  const me = FIG[sel.fighter], myPal = me.palettes[palIdx(me.id)] || me.palettes[0], opp = cpuFoe(me);
  const oppPal = opp.id === me.id ? opp.palettes[(palIdx(me.id) + 1) % opp.palettes.length] : opp.palettes[0];
  const d = Math.max(LEVELS[2].d, clamp((rankView().r - 750) / 1000, 0.08, 0.98));   // never below Normal (Fable's review)
  G = newGame({ seed: newSeed(), players: [{ spec: me, pal: myPal }, { spec: opp, pal: oppPal }], stocks: 3, time: 240, countdown: 150, map: randMap() });
  match = { warm: true, ranked: false, d, bot: makeBot(d, BL.BOT_STYLES[opp.id]), level: "Warm-up", cpu: cpuName() };
  meSlot = 0;
  enterMatchUI();
  qmStripShow(true);
}
// screens.js finishMatch: a warm-up pays like a friend match (15 / 8 / 5 + 2 per KO) and never touches the rank
function qmWarmEnd(forfeit) {
  const me = G.fighters[0], op = G.fighters[1], res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5;
  const R = { res, forfeit, warm: true, me, op, lines: [], total: 0 };
  if (!forfeit) {
    R.lines.push(res === 1 ? ["Win", 15] : res === 0.5 ? ["Draw", 8] : ["Match played", 5]);
    if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 2]);
    R.total = R.lines.reduce((a, l) => a + l[1], 0);
    P.tokens += R.total; saveProfile();
  }
  R.why = R.lines.length ? R.lines.map(([n, v]) => `${n} +${v}`).join(" · ") + " · a warm-up never changes your rank" : "No chips for a fight you left.";
  qmStripShow(false);
  showResults(R);
}
function qmWarmQuit() { quickOpen(); }   // Pause > Back to search
// menus.js, the results' buttons: true when Quick match took the tap
function qmAgain() {
  if (match.vc) { vcFight(); return true; }   // ui/vscpu.js: Another CPU fight
  if (match.warm) { qmWarmStart(); return true; }
  if (match.qm && (match.qm.ranked || match.qm.sk || NET.phase !== "result")) { qmNext(); return true; }
  return false;   // Casual: the friend match's Rematch (both tap)
}
function qmChange() {
  if (match.warm || match.vc) { quickOpen(); return; }
  if (match.qm.ranked || match.qm.sk) { qmLeave(); quickOpen(); return; }
  qmNext();   // Casual: Next match
}
function qmLeave() { if (NET.mr) leaveMatchRoom(); resetNet(); NET.phase = "idle"; if (QM.st === "found") QM.st = "idle"; lobbyPresence(); }
function qmNext() { qmLeave(); quickOpen(); qmFind(); }
// screens.js togglePause: what leaving costs
function qmPauseText() {
  const quit = $("pQuit").querySelector("span"), note = $("pNote");
  if (match.vc) { vcPauseText(); return; }   // ui/vscpu.js
  if (match.warm) { quit.textContent = "Back to search"; note.textContent = qmSearching() ? "The search goes on." : ""; return; }
  if (match.qm && match.qm.sk) {   // a staked match: no result in its first 30 s, then leaving costs the stake
    quit.textContent = "Forfeit";
    note.textContent = NET.frame < STK_EARLY ? "Leaving in the first 30 seconds is no result: nobody's chips move." : `Online matches keep running while this is open. Leaving counts as a loss · −${match.qm.sk} chips`;
    return;
  }
  if (!match.qm || !match.qm.ranked) return;
  const me = qmMe() || QM_FRESH, o = match.qm.opp, dr = qmElo(me.r, o && Number.isInteger(o.r) ? o.r : 1000, 0, me.n);
  quit.textContent = "Forfeit";
  note.textContent = `Online matches keep running while this is open. Leaving counts as a loss · ${dr === 0 ? "−0" : String(dr).replace("-", "−")}`;
}

/* ----- the Quick match screen ----- */
function quickOpen() {
  if (!qmOn()) { openSelect("ranked"); return; }
  finStop();
  mode = "quick"; G = null; match = null; meSlot = 0; paused = false;
  show("quick");
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  modal("pause", false); modal("help", false); modal("settings", false);
  qmStripShow(false); $("rQm").hidden = true;
  resize();
  if (qmSearching() && sel.fighter !== QM.sentF) qmSend();   // a new fighter rides into the next match found
  qmRender();
  if (!QM.s1 && playedOnce()) qmSeason();   // the Season 1 sheet waits for the first finished match (base.js)
  if (!ACCT.code && ACCT.avail == null) acctPing().then(qmRefresh);
}
function qmCardIn() { const fc = $("qmFc"); fc.classList.remove("fc-in"); void fc.offsetWidth; fc.classList.add("fc-in"); }
const qmArt = { cv: null, f: null, fit: 0.88, bottom: 0.93 };
function drawQmArt(tk) {   // loop.js: the Fight Card's model, live in the worn skin (as Play friends)
  qmArt.cv = qmArt.cv || $("qmArt");
  qmArt.f = onlineArtFighter();
  qmArt.fit = qmArt.cv.clientWidth > qmArt.cv.clientHeight ? 0.76 : 0.88;
  paintModel(qmArt, tk);
  if (QM.vsT) for (const a of qmVsArt) paintModel(a, tk);
}
function qmRender() {
  if (mode !== "quick" || !qmOn()) return;
  const seq = ++QM.seq, lb = qmLobby(), md = qmMode(), searching = qmSearching(), off = qmAcctOff();
  const stt = $("qmStatus");
  stt.textContent = QM.conn ? `Online · ${lb.n} here` : "Connecting";
  stt.className = "kicker qm-status" + (QM.conn ? " ok" : "");
  $("qmTokens").textContent = fmtChips(P.tokens);
  // the Fight Card
  const spec = FIG[sel.fighter], pi = palIdx(spec.id), pal = spec.palettes[pi] || spec.palettes[0], fc = $("qmFc");
  fc.style.setProperty("--c", col(pal)); fc.style.setProperty("--cg", rgba(col(pal), 0.42));
  $("qmFName").textContent = spec.name; $("qmFSkin").textContent = pal.name; $("qmFRole").textContent = spec.role;
  $("qmChange").setAttribute("aria-label", `Your fighter: ${spec.name}, ${pal.name}. Change fighter`);
  $("qmMyName").textContent = NET.myName || acctName();
  plateSet($("qmMyName").parentNode, shopWorn());   // your nameplate (ui/shop.js)
  // the mode: two big segments (Ranked waits for accounts on the server)
  for (const [id, v] of [["qmR", "r"], ["qmC", "c"], ["qmV", "v"]]) { const b = $(id), on = md === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); b.disabled = searching || (v === "r" && off); }
  $("qmRSub").textContent = off ? "opens soon" : "online rank";
  qmPlate();
  $("qmIdle").hidden = searching; $("qmSearch").hidden = !searching;
  const find = $("qmFind");
  find.querySelector("span").textContent = QM.no === "old" ? "Reload" : "Find match";
  find.disabled = QM.no !== "old" && (!QM.conn || QM.making || QM.st !== "idle");
  const truth = $("qmTruth");
  truth.className = "qm-truth" + (QM.note || QM.no ? " note" : "");
  truth.textContent = QM.no === "old" ? "A new version of the game is out. Reload to play Quick match." : QM.note ||
    (!QM.conn ? "Connecting to the server…" : lb.q ? `${lb.q} searching · ${lb.n} online` : "Nobody searching · you'll warm up vs a CPU");
  $("qmCpu").hidden = QM.no === "old" || !QM.conn || (searching ? qmWaited() < 5 : lb.q > 0);
  $("qmHelp").hidden = searching;
  $("qmHelp").textContent = off ? "Ranked opens once accounts are switched on. Casual works now." : "Nobody searching? Find match anyway: you warm up vs a CPU while the queue fills.";
  qmLast();
  qmUi();
  vcRender(lb);   // ui/vscpu.js: VS CPU mode (the rank, FIGHT A CPU, the CPU board in the warm-up's place)
  // the queue: a pill per player (gold pulsing dot: searching, mint: here, grey: in a match), names come from the lobby
  const others = lb.ps.filter((p) => !p.sameTab);
  namesFor(others).then((names) => {
    if (seq !== QM.seq || mode !== "quick") return;
    const list = others.map((p) => ({ n: names[p.peer] || "Potato", q: !!(p.presence && p.presence.qs), busy: !!(p.presence && p.presence.busy) }))
      .sort((a, b) => (b.q - a.q) || (a.busy - b.busy));
    const box = $("qmHere"), sig = JSON.stringify([searching, list]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig; box.replaceChildren();
    const pill = (txt, cls) => { const e = document.createElement("span"); e.className = "on-pl" + (cls ? " " + cls : ""); e.textContent = txt; box.appendChild(e); };
    if (searching) pill("You", "me q");
    for (const p of list.slice(0, 8)) pill(p.busy ? `${p.n} · in a match` : p.n, p.q ? "q" : p.busy ? "busy" : "");
    if (list.length > 8) pill(`+${list.length - 8} more`, "busy more");
    box.classList.toggle("empty", !list.length && !searching);
    if (!list.length && !searching) box.textContent = "Just you right now. Players show up here when they open the game.";
  });
}
// the rank plate: emblem, tier word in its colour, rating and what is left to the next tier, the bar, the record and the season
function qmPlate() {
  if (vcMode()) { vcPlate(); return; }   // ui/vscpu.js: the CPU rank
  vcPlateOff();
  const me = qmMe(), rk = me || QM_FRESH, ti = tierInfo(rk.r), placing = rk.n < QM_PLACING;
  $("qmRank").style.setProperty("--tc", ti.t.col);
  $("qmRank").classList.toggle("placing", placing);
  const bd = $("qmBadge"); if (bd._i !== ti.i) { bd._i = ti.i; paintBadge(bd, ti.i); }
  $("qmTier").textContent = placing ? "Placing" : ti.t.name;
  $("qmRating")._t = placing ? [`${rk.n} of ${QM_PLACING} played · ${rk.r}`] : ti.next ? [`${rk.r} · ${ti.need} to ${ti.next.name}`, `${rk.r} · ${ti.need} to go`] : [`${rk.r} · top tier`];   // qmThin picks
  $("qmBar").style.setProperty("--p", placing ? rk.n / QM_PLACING : ti.p);
  $("qmRec").textContent = `${rk.w}W · ${rk.l}L\nSeason 1`;
  const pp = $("qmPips"); pp.setAttribute("aria-label", `${rk.n} of ${QM_PLACING} placing matches played`);
  [...pp.children].forEach((e, k) => e.classList.toggle("on", k < rk.n));
  rvPlate();   // ui/rivals.js: on a streak, WANTED and the bounty
  $("qmKRec").textContent = $("qmRec").textContent.replace("\n", " · ");
  qmThin();
}
/* A narrow YOUR MATCH column (740-800 px phones, small desktop windows) takes .thin (96-quick.css): the record moves up into the
   kicker and five pips stand for "n of 5 played". The tier word and "counts for rank" shrink until they fit, at any width. */
function qmThin() {
  const idle = $("qmIdle"), w = idle.clientWidth, app = $("app"), rt = $("qmRating"), tx = rt._t || [""];
  rt.textContent = tx[0];   // the rating line: "1360 · 140 to Diamond", or "1360 · 140 to go" where that doesn't fit
  if (!w) return;
  idle.classList.toggle("thin", w < (app.classList.contains("short") || app.classList.contains("portrait") ? 270 : 340));
  if (tx[1] && rt.scrollWidth > rt.clientWidth + 1) rt.textContent = tx[1];
  for (const t of [$("qmTier"), $("qmRSub")]) {
    t.style.fontSize = "";
    for (let f = parseFloat(getComputedStyle(t).fontSize); t.scrollWidth > t.clientWidth + 1 && f > 9; ) t.style.fontSize = `${--f}px`;
  }
  const kr = $("qmKRec"), k0 = kr.previousElementSibling;   // the kicker's record stays on the kicker's line (a streak's is long)
  kr.style.fontSize = "";
  for (let f = parseFloat(getComputedStyle(kr).fontSize); kr.offsetTop - k0.offsetTop > 5 && f > 8; ) kr.style.fontSize = `${--f}px`;
}
if (window.ResizeObserver) new ResizeObserver(() => qmThin()).observe($("qmIdle"));
// LAST FIVE: your last Ranked results (W / L / D, who, their fighter, the rating change)
function qmLast() {
  const ul = $("qmLast"), h = vcMode() ? vcLast() : (qmMe() || QM_FRESH).h.slice(0, 5), sig = JSON.stringify(h);   // vcLast: your ranked CPU results
  if (ul.dataset.sig === sig) return;
  ul.dataset.sig = sig; ul.replaceChildren();
  if (!h.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = vcMode() ? "Your ranked CPU results show here." : "Your Ranked results show here."; ul.appendChild(li); return; }
  for (const x of h) {
    const li = document.createElement("li"), r = document.createElement("i"), nm = document.createElement("span"), d = document.createElement("b");
    r.className = "tag st " + (x.res === 1 ? "mint" : x.res === 0 ? "red" : "grey"); r.textContent = x.res === 1 ? "W" : x.res === 0 ? "L" : "D";
    nm.textContent = x.o || "Potato";
    if (FIG[x.of]) { const sm = document.createElement("small"); sm.textContent = ` · ${FIG[x.of].name}`; nm.appendChild(sm); }
    d.className = x.dr > 0 ? "up" : x.dr < 0 ? "down" : ""; d.textContent = x.dr > 0 ? `+${x.dr}` : x.dr < 0 ? `−${-x.dr}` : "±0";
    li.append(r, nm, d); ul.appendChild(li);
  }
}
// the parts that tick: the search timer and its range, the warm-up strip and results card, the VS ping, "still confirming"
function qmUi() {
  if (!qmOn()) return;
  const searching = qmSearching(), w = qmWaited(), md = qmMode(), wt = QM.wait;
  const rng = !wt ? "" : wt.hold ? "The server is about to update. Matches start again in a moment." :
    `${md === "r" ? (qmMe() || QM_FRESH).n < QM_PLACING ? "Placing" : tierInfo((qmMe() || QM_FRESH).r).t.name : "Casual"} ${wt.rng < 0 ? "· anyone" : `±${wt.rng}`} · ${wt.n} searching`;
  const fb = searching && md === "r" && w >= QM_FB ? "No Ranked player yet · taking Casual too · that match won't count" : "";
  if (mode === "quick" && searching) {
    $("qmTime").textContent = qmClock(w);
    $("qmSKick").textContent = `Searching · ${md === "r" ? "Ranked" : "Casual"}`;
    $("qmRange").textContent = rng || "Looking for a player…";
    const f = $("qmFb"); f.textContent = fb; f.hidden = !fb;
    if ($("qmCpu").hidden && w >= 5) $("qmCpu").hidden = false;
  }
  const strip = $("qmStrip");
  if (!strip.hidden) $("qmStripT").textContent = `Searching ${qmClock(w)}`;
  if (mode === "result" && match && match.warm) qmResCard(rng, fb);
  if (QM.vsT && NET.qm) {
    const ms = NET.pings.length ? [...NET.pings].sort((a, b) => a - b)[NET.pings.length >> 1] : 0;
    $("vsPing").textContent = `${ms ? `${Math.round(ms)} ms` : NET.phase === "handshake" ? "connected" : "measuring…"} · ${mapName(NET.qm.seed % BL.POOL)}`;
  }
  if (QM.cfT && performance.now() - QM.cfT > 5000 && mode === "result") { QM.cfT = 0; $("rPromo").textContent = "Still confirming · your rank updates when it arrives"; }
}
function qmResCard(rng, fb) {   // the warm-up's results: the search goes on in the rank card's place
  const card = $("rQm"), on = qmSearching();
  card.hidden = !on;
  if (!on) return;
  $("rQmT").textContent = `Still searching ${qmClock(qmWaited())}`;
  $("rQmL").textContent = [qmMode() === "r" ? "Ranked" : "Casual", rng || "", fb ? "taking Casual too, that match won't count" : ""].filter(Boolean).join(" · ");
}
function qmStripShow(on) { $("qmStrip").hidden = !on || !qmSearching(); if (on) qmUi(); }
// the menu's gold hero is Quick match: the live count, the remembered mode, the rank, the season sticker until the sheet was seen
function qmHero() {
  if (!qmOn()) return;
  const hero = $("bRanked"), rk = rankView(), ti = tierInfo(rk.r), md = qmMode(), lb = qmLobby(), placing = rk.n < QM_PLACING;
  hero.classList.add("qm");
  hero.querySelector(".mm-ttl").textContent = "Quick match";
  const vh = QM.mode === "v" ? vcHero() : null;   // ui/vscpu.js: VS CPU and your CPU rank
  $("mRankKick").innerHTML = `<i class="qm-dot${QM.conn ? "" : " off"}" aria-hidden="true"></i>${QM.conn ? `${lb.n} online` : "Offline"} · ${vh ? vh[0] : md === "r" ? `Ranked · ${placing ? "Placing" : `${ti.t.name} ${rk.r}`}` : "Casual"}`;
  $("mRec").textContent = vh ? vh[1].replace(/ /g, " ") : (md === "c" ? (qmAcctOff() ? ["Ranked opens soon"] : ["Casual", "no rank change"])
    : (qmMe() || QM_FRESH).bty ? [`${qmMe().ws} win streak`, `${qmMe().bty} bounty on you`]
    : placing ? [`Placing`, `${rk.n} of ${QM_PLACING}`] : [`${rk.w}W`, `${rk.l}L`, ti.next ? `${ti.need} to ${ti.next.name}` : "top tier"]).map((t) => t.replace(/ /g, " ")).join(" · ");
  let s1 = hero.querySelector(".qm-s1");
  if (!s1) { s1 = document.createElement("span"); s1.className = "tag ember qm-s1"; s1.textContent = "Season 1"; hero.appendChild(s1); }
  s1.hidden = QM.s1;
  hero.setAttribute("aria-label", `Quick match. ${md === "r" ? "Ranked" : "Casual"}. ${QM.conn ? `${lb.n} online` : "Offline"}`);
}
// the Season 1 sheet, once: your new online rank and the CPU rank that stays in Account > Stats
function qmSeason() {
  const on = rankView(), ti = tierInfo(on.r), cpu = tierInfo(P.rating | 0);
  paintBadge($("ssBadgeN"), ti.i); $("ssOn").style.setProperty("--tc", ti.t.col);
  $("ssTierN").textContent = ti.t.name; $("ssRateN").textContent = on.n ? `${on.r} · ${on.w}W ${on.l}L` : `${on.r} · everyone starts here`;
  paintBadge($("ssBadgeO"), cpu.i);
  $("ssTierO").textContent = cpu.t.name; $("ssRateO").textContent = `${P.rating | 0} · kept in Account › Stats`;
  $("ssOld").hidden = !((P.matches | 0) > 0);
  modal("season", true);
}
function qmSeasonDone() { QM.s1 = true; qmSave(); modal("season", false); qmRender(); }

// simTick (loop.js), every frame: the handshake under any screen, the ready flag, the 3·2·1, a lost verdict, the ticking parts
function qmTick() {
  if (!qmOn()) return;
  const now = performance.now();
  if (NET.qm && (NET.phase === "hosting" || NET.phase === "joining" || NET.phase === "handshake") && mode !== "online" && mode !== "select") netTick();
  if (NET.qm && !NET.qm.rd && QM.vsT && now - QM.vsT > 2500 && NET.mr) { NET.qm.rd = true; namedPresence({ rd: 1 }); }
  if (QM.fdT) {
    const k = 3 - Math.floor((now - QM.fdT) / 1000);
    if (k <= 0) { QM.fdT = 0; $("qmFound").hidden = true; qmEndWarm(); if (QM.found) qmVs(QM.found); }
    else if ($("qfN").textContent !== String(k)) { $("qfN").textContent = String(k); Sfx.count(false); }
  }
  // no verdict 20 s after a reconnect showed the match uncounted: ask once more (the server may have been slow to see the old
  // connection go), then it is lost: no result
  const pd = QM.pend;
  if (pd && pd.dead && Date.now() - pd.dead > 20000) {
    if (!pd.again) { pd.again = true; pd.dead = Date.now() - 15000; QM.authed = false; QM.authing = false; qmAuth(); }
    else qmRes({ id: pd.id, res: null, why: "void" });
  }
  // the account changed (made, linked or unlinked): sign in with it, unless that was just sent
  if (ACCT.code !== QM.lastCode) {
    QM.lastCode = ACCT.code;
    if (QM.authCode !== ACCT.code || !ACCT.code) { QM.authed = false; QM.authing = false; QM.acct = ""; qmAuth(); }
    qmRefresh();
  }
  if (now - QM.uiT > 250) { QM.uiT = now; qmUi(); stkTick(); }   // ui/stakes.js: the challenge clocks
}

/* ----- wiring ----- */
tap("qmBack", goMenu);
tap("qmChange", () => openSelect("quick"));
tap("qmR", () => { QM.mode = "r"; qmSave(); qmRender(); });
tap("qmC", () => { QM.mode = "c"; qmSave(); qmRender(); });
tap("qmFind", () => (vcMode() ? vcFight() : qmFind()));   // ui/vscpu.js: FIGHT A CPU
tap("qmCancel", () => qmCancel());
tap("qmWarm", qmWarmStart);
tap("rQmX", () => { qmCancel(); $("rChange").querySelector("span").textContent = "Quick match"; $("rMenuSub").textContent = ""; });
tap("ssGo", qmSeasonDone);
tap("ssClose", qmSeasonDone);
