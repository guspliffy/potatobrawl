/* ===================== play counts: anonymous totals for the stats page (the server side is stats.js) =====================
   Nothing here touches the fight: it only reads the match after the fact. No player ID and no cookie: the server only adds 1 to a
   key per day. This device keeps one note in localStorage (CNT_KEY): its first day, the last day / week / month it said hello, which
   "came back within N days" it already sent, its match counts and the once-only milestones it already sent.
   Counting runs only in the copy our own server serves (net-ws.js sets __blStandalone) and stops for the visit when the server
   answers 202 (its counter is off; 404 from a server without one). Never when the browser sends Global Privacy Control, after
   Settings > Play counts > Off, or in a browser that says it is automated (search engines, site scanners: CNT_BOT).
   A device counts as a player only from its first real tap, click, key or gamepad press of the visit (cntGo): before that only
   "open" is sent, and everything else waits in CNT.held. Play time: one "pt" per minute of real play (cntTime).
   This part sits right after base.js, so the hooks the other parts call (cntStart, cntEnd, cntScreen, ...) find CNT ready; cntBoot
   runs from loop.js once every part is loaded (it reads NET and PROTO). */
const CNT_KEY = "potatobrawl.count.v1";
const CNT = { can: false, gpc: false, bot: false, on: false, booted: false, dead: false, busy: false, note: null, q: [], pre: [], seen: new Set(), errs: 0,
  live: null, first: false, vis: 0, t0: Date.now(), n: 0, ticking: false, go: false, held: [], inAt: 0, sec: 0 };
const CNT_RET = [1, 3, 7, 14, 30];   // "came back within N days"
const CNT_PT = [5, 15, 30, 60];      // minutes played in one day: each mark is sent once per device per day
// a browser that names itself a robot (crawlers, page checkers, headless or driven browsers); navigator.webdriver is checked too
const CNT_BOT = /\bbot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|phantomjs|puppeteer|playwright|selenium/i;
const cntPad = (v) => String(v).padStart(2, "0");
const cntDayStr = (d) => `${d.getFullYear()}-${cntPad(d.getMonth() + 1)}-${cntPad(d.getDate())}`;   // the local calendar day
const cntDayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
function cntWeekStr(d) { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return cntDayStr(m); }   // that week's Monday
function cntSave() {
  try { localStorage.setItem(CNT_KEY, JSON.stringify(CNT.note)); return true; } catch (e) { return false; }
}
function cnt(k) {
  if (!CNT.on || CNT.dead) return;
  const q = CNT.go ? CNT.q : CNT.held;   // before the first tap of the visit nothing leaves the page (cntGo sends it)
  q.push(k);
  if (q.length > 300) q.splice(0, q.length - 300);
}
// once per device ever, and only for a device that started after the counter did (its first steps are what these follow)
function cntOnce(k) {
  const N = CNT.note;
  if (!CNT.on || !N || !N.f || N.k[k]) return;
  N.k[k] = 1; cntSave(); cnt(k);
}
// the mode names the stats page knows (a new mode can be added here and to MODES in web/stats.html; until then it counts as practice)
function cntMode(m) {
  if (!m) return "none";
  if (m.trial) return "trial";
  if (m.tutorial) return "tutorial";
  if (m.vc) return m.vc.tc ? "online-cup" : "ranked";   // m.vc.tc: a cup match against a CPU (ui/tourney.js)   // Ranked vs CPU (ui/vscpu.js): the old Ranked vs a CPU, now with the server's check
  if (m.qm) return m.qm.tm ? "online-cup" : m.qm.ranked ? "quick-r" : "quick-c";   // Quick match (ui/quick.js) and its CPU warm-up
  if (m.warm) return "warmup";
  if (m.online) return m.boss ? "online-boss" : m.tb ? "online-team" : "online";   // online-team: a Team Brawl with friends (ui/online-team.js)
  if (m.bw) return "boss-week";   // a Boss Week try (ui/bossweek.js)
  if (m.boss) return m.road ? "road-boss" : "boss";
  if (m.duo) return "team";   // Team Brawl 2v2 (ui/duo.js; match.team is the CPU team's name)
  return m.road ? "road" : m.daily ? "daily" : m.cup ? "cup" : m.ranked ? "ranked" : "practice";
}
function cntDev() {
  const coarse = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches), s = Math.min(screen.width || 0, screen.height || 0);
  return !coarse ? "desktop" : s >= 600 ? "tablet" : "phone";
}
function cntApp() {
  const mm = (q) => !!(window.matchMedia && matchMedia(q).matches);
  return navigator.standalone === true || mm("(display-mode: fullscreen)") || mm("(display-mode: standalone)") ? "app" : "web";
}

/* ----- the first open of each day (and week, month): who plays, on what, and who came back ----- */
function cntDaily() {
  const N = CNT.note, now = new Date(), d = cntDayStr(now);
  if (!CNT.on || !CNT.go || N.l === d) return;
  N.l = d;
  cnt("day"); cnt(N.f === d ? "day:new" : "day:back");
  const wk = cntWeekStr(now), mo = d.slice(0, 7);
  if (N.w !== wk) { N.w = wk; cnt("wk"); }
  if (N.m !== mo) { N.m = mo; cnt("mo"); }
  const lang = String(navigator.language || "").slice(0, 2).toLowerCase();
  cnt("dev:" + cntDev()); cnt("app:" + cntApp()); cnt("lang:" + (/^[a-z]{2}$/.test(lang) ? lang : "other")); cnt("gl:" + (LANG === "xx" ? "en" : LANG)); cnt("ver:" + PROTO);
  if (N.f) {
    const n = cntDayNum(d) - cntDayNum(N.f);
    if (n >= 1) CNT_RET.forEach((T, i) => { if (n <= T && !(N.r & (1 << i))) { N.r |= 1 << i; cnt(`ret:${N.f}:${T}`); } });
  }
  cntSave();
}

/* ----- matches: started, ended (how), quit ----- */
function cntStart() {   // screens.js enterMatchUI, before the mode changes
  if (!CNT.on || (match && match.rp)) return;   // a replay is no match (ui/replay.js counts rp:watch)
  cntDrop();
  const md = cntMode(match), real = md !== "tutorial" && md !== "trial";
  CNT.live = { md, real };
  cnt("ms:" + md);
  if (md === "online" && NET.role === "guest" && chlRoom(NET.mrCode)) cnt("chl:play");   // the friend's phone, in a Challenge a friend room
  const me = G && G.fighters[meSlot];
  if (real && me && !me.spec.boss) cnt("fp:" + me.spec.id);
  const b = match && match.boss ? bossOf(G) : null;
  if (b) cnt(`bs:${b.spec.id}:${G.lv | 0}`);
  if (real) {
    const s = ++CNT.note.s; cntSave();
    if (s === 1) { cntOnce("fn:s1"); cntOnce("first:" + md); }
    if (s === 2) cntOnce("fn:s2");
  }
}
// forfeit: the player gave the match up. R: the results of an online match (screens.js showResults); offline matches read G.
function cntEnd(forfeit, R) {   // screens.js finishMatch and showResults (online)
  const L = CNT.live;
  CNT.live = null;
  if (!CNT.on || !L) return;
  let res;
  if (R) res = R.lost || R.left ? "drop" : R.res === 1 ? "win" : R.res === 0 ? "loss" : "draw";   // drop: the connection went or the other player left
  else if (forfeit) res = "quit";
  else if (L.md === "tutorial") res = "win";
  else {
    const me = G && G.fighters[meSlot], w = G ? G.winner : null;
    res = me && w === me.team ? "win" : Number.isInteger(w) && w >= 0 ? "loss" : "draw";
  }
  cnt(`me:${L.md}:${res}`);
  if (res === "quit" || res === "drop") { if (L.md === "tutorial") cntOnce("tut:skip"); return; }
  if (L.md === "tutorial") cntOnce("tut:done");
  if (!L.real) return;
  const mins = (G ? G.t : 0) / 3600;
  cnt("ml:" + (mins < 1 ? 0 : mins < 2 ? 1 : mins < 3 ? 2 : mins < 5 ? 3 : 5));
  if (PERF.q >= 1) cnt("mslow");   // effects.js: this device could not hold ~45 fps in a match
  if (res === "win" && match && match.road && !match.boss) cnt("rw:" + match.road.i);
  const b = res === "win" && match && match.boss ? bossOf(G) : null;
  if (b) cnt(`bw:${b.spec.id}:${G.lv | 0}`);
  CNT.vis++;
  const d = ++CNT.note.d; cntSave();
  if (d === 1) cntOnce("fn:d1");
  if (d === 5 || d === 10 || d === 25) cntOnce("fn:d" + d);
}
// a match left without an end (the pause menu's Quit, the tutorial's Skip, Back to the Road): counted as quit
function cntDrop(force) {   // force: the tutorial's Skip goes straight into the first fight, so the mode is still "match" (ui/tutorial.js)
  if (!CNT.live || (mode === "match" && !force)) return;
  const md = CNT.live.md;
  CNT.live = null;
  cnt(`me:${md}:quit`);
  if (md === "tutorial") cntOnce("tut:skip");
}
function cntAgain() { if (match) cnt("again:" + cntMode(match)); }   // menus.js: the results' Rematch / Next match / Next game
function cntScreen(name) {   // screens.js show() and modal(), acct.js tabs: once per visit
  const id = String(name || "").toLowerCase();
  if (!CNT.on || !/^[a-z][a-z0-9-]{1,15}$/.test(id) || id === "menu" || id === "result" || id === "pause") return;
  if (CNT.seen.has("scr:" + id)) return;
  CNT.seen.add("scr:" + id); cnt("scr:" + id);
}

/* ----- the first time a brand-new device leaves the page: where it was, how long, how many matches ----- */
function cntFirstExit() {
  const N = CNT.note;
  if (!CNT.on || !CNT.go || !CNT.first || !N || N.x) return;
  N.x = 1; cntSave();
  const where = mode === "match" && match ? (match.tutorial && !match.trial ? "tut:" + TUT.id : "match:" + cntMode(match)) : mode;
  const mins = (Date.now() - CNT.t0) / 60000;
  cnt("fx:" + where); cnt("fl:" + (mins < 1 ? 0 : mins < 3 ? 1 : mins < 10 ? 3 : mins < 30 ? 10 : 30)); cnt("fm:" + Math.min(3, CNT.vis));
}

/* ----- errors on real devices: the message (and the line in index.html), once per visit, five at most ----- */
function cntErr(msg, line) {
  let m = String(msg || "error").replace(/^Uncaught /, "").replace(/[^\x20-\x21\x23-\x26\x28-\x5b\x5d-\x7e]/g, "").replace(/\s+/g, " ").trim();
  const at = line ? ` @${line}` : "";
  m = "err:" + (m.slice(0, 80 - at.length) + at).trim();
  if (m === "err:" || CNT.seen.has(m) || CNT.errs >= 5) return;
  CNT.seen.add(m); CNT.errs++;
  if (CNT.booted) cnt(m); else CNT.pre.push(m);
}
window.addEventListener("error", (e) => { if (e && e.message) cntErr(e.message, e.lineno); });
window.addEventListener("unhandledrejection", (e) => { const r = e && e.reason; cntErr(r && r.message ? r.message : String(r)); });

/* ----- sending: about every 20 s, and when the page is hidden (sendBeacon survives the page closing) ----- */
function cntFlush(beacon) {
  if (!CNT.on || CNT.dead || CNT.busy || !CNT.q.length) return;
  const batch = CNT.q.splice(0, 40), body = JSON.stringify({ e: batch });
  if (beacon && navigator.sendBeacon) {
    try { if (navigator.sendBeacon("/api/stats/hit", body)) { cntFlush(true); return; } } catch (e) { /* fall back to fetch */ }
  }
  CNT.busy = true;
  const again = () => { CNT.q.unshift(...batch); if (CNT.q.length > 300) CNT.q.length = 300; };
  fetch("/api/stats/hit", { method: "POST", headers: { "content-type": "text/plain" }, body, keepalive: true, credentials: "omit" })
    .then((r) => {
      CNT.busy = false;
      if (r.status === 202 || r.status === 404 || r.status === 405 || r.status === 415) { CNT.dead = true; CNT.q.length = 0; }   // this server counts nothing (202: its counts are off)
      else if (r.status === 429 || r.status >= 500) again();
    })
    .catch(() => { CNT.busy = false; again(); });   // offline for a moment: the next round sends it
}
function cntTick() {
  cntDrop();
  if (CNT.on && document.visibilityState === "visible" && cntPadDown()) cntInput();
  cntTime();
  if (++CNT.n % 20 === 0) { cntDaily(); cntFlush(false); }
}
function cntHide() {
  if (!CNT.on) return;
  cntDrop(); cntFirstExit();
  if (CNT.sec >= 30) cntMinute();   // the minute this visit was in the middle of: rounded
  CNT.sec = 0;
  cntFlush(true);
}

/* ----- the first real tap, click, key or gamepad press of the visit: from here on this device counts as a player ----- */
function cntInput(e) {
  if (e && e.isTrusted === false) return;   // events made by a page script are no player
  CNT.inAt = Date.now();
  if (!CNT.go) cntGo();
}
function cntGo() {
  if (!CNT.on || CNT.go) return;
  CNT.go = true;
  const N = CNT.note;
  // a device that only looked before (opened without a tap): its first day is the day it first plays
  if (N.p) { delete N.p; if (N.f) N.f = cntDayStr(new Date()); cntSave(); }
  CNT.q.push(...CNT.held); CNT.held.length = 0;
  if (CNT.q.length > 300) CNT.q.splice(0, CNT.q.length - 300);
  cntDaily(); cntFlush(false);
}
function cntPadDown() {   // a gamepad button held or a stick pushed (polled once a second, like the tick)
  let pads = [];
  try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return false; }
  for (const p of pads || []) if (p && ((p.buttons || []).some((b) => b && b.pressed) || (p.axes || []).some((a) => Math.abs(a) > 0.5))) return true;
  return false;
}

/* ----- play time: a second counts while the page shows and the player is in a running match or touched it within the last minute ----- */
function cntTime() {
  if (!CNT.on || !CNT.go || document.visibilityState !== "visible") return;
  if (!(mode === "match" && !paused) && Date.now() - CNT.inAt > 60000) return;   // idle in the menus for a minute: the clock stops
  if (++CNT.sec >= 60) cntMinute();
}
function cntMinute() {   // pt: one minute played; pt:<5|15|30|60>: this device's day just passed that many minutes
  CNT.sec = 0;
  const N = CNT.note, d = cntDayStr(new Date());
  if (N.td !== d) { N.td = d; N.tm = 0; }
  N.tm = (N.tm | 0) + 1; cntSave();
  cnt("pt");
  if (CNT_PT.includes(N.tm)) cnt("pt:" + N.tm);
}

function cntBoot() {   // loop.js, before the first menu
  CNT.booted = true;
  CNT.can = !!window.__blStandalone && /^https?:$/.test(location.protocol);
  CNT.gpc = navigator.globalPrivacyControl === true;
  CNT.bot = navigator.webdriver === true || CNT_BOT.test(String(navigator.userAgent || ""));
  let N = null;
  try { N = JSON.parse(localStorage.getItem(CNT_KEY) || "null"); } catch (e) { /* storage blocked */ }
  if (N && typeof N === "object" && N.off) { CNT.note = N; return; }   // Settings > Play counts > Off on this device
  if (!CNT.can || CNT.gpc || CNT.bot) { CNT.pre.length = 0; return; }
  const today = cntDayStr(new Date()), fresh = !N || typeof N !== "object";
  // a device with progress from before the counter (or one arriving through a sync link) is a returning player, not a new one
  const isNew = fresh && firstRun && !ACCT.hash;
  // p: no tap yet on this device; o: the last day it was opened; td / tm: the day and the minutes played on it (cntMinute)
  if (fresh) N = { f: isNew ? today : "", l: "", w: "", m: "", r: 0, s: 0, d: 0, k: {}, x: isNew ? 0 : 1, p: 1 };
  N.f = /^\d{4}-\d{2}-\d{2}$/.test(N.f) ? N.f : ""; N.r |= 0; N.s |= 0; N.d |= 0; N.tm |= 0;
  if (!N.k || typeof N.k !== "object" || Array.isArray(N.k)) N.k = {};
  CNT.note = N;
  if (!cntSave()) return;   // no storage: every visit would look like a new player, so count nothing
  CNT.on = true; CNT.first = !!(N.p && N.f);   // a new device until its first visit with a tap has ended
  for (const k of CNT.pre) cnt(k);
  CNT.pre.length = 0;
  if (NET.invite) cnt("inv");
  if (chlRoom(NET.invite)) { cnt("chl:open"); if (CNT.first) cnt("chl:new"); }   // a Challenge a friend link (ui/challenge.js), and on a brand-new device
  if (N.o !== today) { N.o = today; cntSave(); CNT.q.push("open"); }   // opened today, tap or not: the one key sent before the first tap
  cntFlush(false); cntListen();
}
function cntListen() {
  if (CNT.ticking) return;
  CNT.ticking = true;
  setInterval(cntTick, 1000);
  for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, cntInput, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") cntHide(); });
  window.addEventListener("pagehide", cntHide);
}
// Settings > Play counts (menus.js renderSettings): shown only where counts can be sent at all
function cntSettings() {
  $("setCountRow").hidden = !CNT.can;
  $("setCountNote").hidden = !CNT.can;
  if (!CNT.can) return;
  chipRow("setCount", [[true, _t("On")], [false, _t("Off")]], CNT.on, cntSwitch, (v) => v && (CNT.gpc || CNT.bot));
  $("setCountNote").textContent = CNT.gpc ? _t("Your browser asks sites not to count visits, so this device sends nothing.")
    : _t("Play counts are anonymous totals (no name, no ID, no cookies) that show which modes people enjoy.");
}
function cntSwitch(v) {
  if (!v) {
    CNT.on = false; CNT.q.length = 0; CNT.held.length = 0; CNT.live = null;
    CNT.note = Object.assign(CNT.note || {}, { off: true }); cntSave();
    return;
  }
  if (CNT.gpc || CNT.bot || CNT.on) return;
  // counting again: this device isn't followed as a new player (its first steps weren't counted)
  const N = CNT.note && typeof CNT.note === "object" ? CNT.note : {};
  CNT.note = { f: "", l: "", w: "", m: "", r: 0, s: N.s | 0, d: N.d | 0, k: {}, x: 1, o: cntDayStr(new Date()), td: N.td || "", tm: N.tm | 0 };   // today's minutes go on
  if (!cntSave()) return;
  CNT.on = true; CNT.first = false; CNT.go = true; CNT.inAt = Date.now();   // the tap on On is this visit's first tap
  cntDaily(); cntFlush(false); cntListen();
}
// for the tests (tests/pwstats.py): send now instead of within 20 s, and look at the state
window.__blCount = { flush() { cntDrop(); cntFlush(false); }, get on() { return CNT.on; }, get dead() { return CNT.dead; }, get go() { return CNT.go; }, get queue() { return CNT.q.concat(CNT.held); }, get note() { return CNT.note; },
  minutes(n) { if (CNT.on && CNT.go) for (let i = 0; i < n; i++) cntMinute(); } };   // minutes: n minutes of play at once (pt, pt:<mark>)
