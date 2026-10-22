/* ===================== Cups online: the Daily Cup at 20:00 Berlin and Friends Cups (the server side is tourney.js) =====================
   The server runs every bracket: it seeds, calls each match, deals the CPU matches and pays the Daily Cup's prizes into the account
   (they come to this phone with the next sync). This page joins, taps FIGHT when called and plays: a match against a player is a
   Quick match the server assigned (qm-found {tm}: ui/quick.js plays it, the referee decides it), a match against a CPU is a ticket
   played here like Ranked vs CPU (ui/vscpu.js vcVs / vcStart / vcIn; the log goes to the server as tcr and the server's replay decides).
   The views (the Tournament sheet, the online bracket on #scrCup in mode "tcup", the call-up banner, the pill, the results card) are
   ui/tcview.js (tcv*). UI only: the sim, the bot and the lockstep are not touched. Only on our own server (window.__blQuick). */
const TC_KEY = "potatobrawl.tc.v1";
const TC = {
  day: null,        // the server's day: { day, at, st (pre | open | run | done | off), why, n (in tonight), me, ent, in, miss, ch, t }
  cup: null,        // your cup as the server sees it (tourney.js view): lobby (ent) or bracket (size, slots, p, m, mi, out, ch, pl)
  off: 0,           // the server's clock minus this one's
  call: null,       // you are called: { id, key, r, cpu, opp, until, ready }
  tk: null,         // the CPU match dealt to you (its VS screen, then the fight)
  pend: null,       // a CPU match's log on its way: { id, key, cup, s, ff, code, sentT }
  res: {},          // the results of your matches in this cup, by key (tc-res)
  end: null,        // the cup is over (tc-end): your place, the chips, the champion
  want: null,       // the message to send once signed in (a join or a host needs the account first); last: the one sent
  last: null, again: false, note: "", busy: false, sheet: false, link: "", seen: "", boot: true, alertT: 0, pickFrom: "", shown: null, mode0: "", vs0: false,
};
(function tcLoad() { try { const s = JSON.parse(localStorage.getItem(TC_KEY) || "null"); if (s && s.pend && typeof s.pend.s === "string") TC.pend = s.pend; } catch (e) { /* storage blocked */ } })();
function tcSave() { try { localStorage.setItem(TC_KEY, JSON.stringify({ pend: TC.pend })); } catch (e) { /* ignore */ } }
const tcOn = () => qmOn();
const tcNow = () => Date.now() + TC.off;
const TC_ROUNDS = { 4: ["Semi-final", "Final"], 8: ["Quarter-final", "Semi-final", "Final"] };
const tcRoundName = (size, r) => (TC_ROUNDS[size] || TC_ROUNDS[8])[r] || "Final";
const tcKind = (c) => (c && c.k === "f" ? "Friends Cup" : "Daily Cup");
// your seat in a running cup and the match you play next (or now): { key, r, i, side, s (w | c | l | d), opp (its slot or -1), rdy }
function tcMine() {
  const c = TC.cup;
  if (!c || !c.slots || c.mi < 0) return null;
  const R = c.size === 8 ? 3 : 2;
  for (let r = 0; r < R; r++) {
    const at = c.p[r].indexOf(c.mi);
    if (at < 0) continue;
    const i = at >> 1, key = r + ":" + i, m = c.m[key];
    if (!m || m[0] === "d") continue;
    return { key, r, i, side: at & 1, s: m[0], opp: c.p[r][at ^ 1], rdy: m[3] ? m[3][at & 1] : 0, ms: m[2] };
  }
  return null;
}
// still playing in a cup (not out, not over): the Quick match search and the call-ups care
const tcPlaying = () => !!(TC.cup && TC.cup.st === "run" && TC.cup.mi >= 0 && TC.cup.out < 0);
const tcInLobby = () => !!(TC.cup && (TC.cup.st === "open" || TC.cup.st === "pre") && TC.cup.ent && TC.cup.ent.some((e) => e.me));
const tcFighter = () => (FIG[P.last] ? P.last : FIG[sel.fighter] ? sel.fighter : FIGHTERS[0].id);

/* ----- the connection ----- */
function tcBoot() {   // vcBoot (ui/vscpu.js), once
  if (!tcOn()) return;
  const api = window.__blQuick;
  api.on(tcMsg);
  api.onConnection((on) => { if (on) { if (!ACCT.code) tcAsk(); if (TC.want) tcGoOn(); } else { TC.busy = false; tcRender(); } });   // with an account: asked after "me"
  if (api.connected() && !ACCT.code) tcAsk();
}
// tests: the state, and a hand on the page's steps (a server without accounts sends no cup messages, so a test's own state stays)
window.__blTc = TC;
window.__blTcT = { open: tcOpen, bracket: tcBracket, render: tcRender, called: tcCalled, res: tcRes, end: tcEnd, mine: tcMine, busy: tcBusy, fight: tcFight };
// the day and your cup; with an account only once signed in (asked unsigned, the server answers without your cup)
function tcAsk(force) { if (tcOn() && QM.conn && (force || !ACCT.code || QM.authed)) window.__blQuick.send({ t: "tc?" }); }
function tcMsg(m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "me") { tcAsk(true); if (!m.err) { tcFlush(); tcDo(); } else if (TC.want) tcFail(m.err === "off" ? "Cups open soon." : "This phone's account isn't on the server. Check Account."); }
  else if (m.t === "tc") tcGot(m);
  else if (m.t === "tc-no") tcNo(m.why);
  else if (m.t === "tc-call") tcCalled(m);
  else if (m.t === "tc-tk") tcTicket(m);
  else if (m.t === "tc-res") tcRes(m);
  else if (m.t === "tc-end") tcEnd(m);
}
function tcGot(m) {
  if (!m.day || typeof m.day !== "object") return;
  TC.day = m.day;
  if (Number.isFinite(m.day.t)) TC.off = m.day.t - Date.now();
  const old = TC.cup, c = m.cup && typeof m.cup === "object" && typeof m.cup.id === "string" ? m.cup : null;
  if (!c || !old || c.id !== old.id) { TC.res = {}; TC.end = null; }
  TC.cup = c;
  TC.busy = false;
  // a CPU match's log the server no longer waits for (decided without it, or another cup): dropped
  const p = TC.pend;
  if (p && QM.authed && p.sentT && (!c || c.id !== p.cup || !c.m || !c.m[p.key] || c.m[p.key][0] !== "l")) { TC.pend = null; tcSave(); }
  if (!c && mode === "tcup") { goMenu(); return; }   // the cup is gone (over and cleared, or closed by its host)
  if (c && !c.slots && mode === "tcup") { goMenu(); tcOpen(); return; }   // a new lobby (HOST ANOTHER on a finished cup's bracket)
  // a call-up the server still holds for you (a page that came back sees it here; tc-call only goes to a page that was there)
  const me = tcMine();
  if (me && me.s === "c") {
    const o = c.slots[me.opp], keep = TC.call && TC.call.key === me.key && TC.call.id === c.id;
    TC.call = { id: c.id, key: me.key, r: me.r, cpu: o && o.c ? 1 : 0, opp: o || null, until: keep ? TC.call.until : Date.now() + (me.ms | 0), ready: !!me.rdy };
  } else if (!me || me.s !== "c") TC.call = null;
  // your CPU match is running on the server and not on this page (a reload in the middle of it): it is lost, say so at once
  if (c && c.mytk && !(TC.tk && TC.tk.id === c.mytk) && !(match && match.vc && match.vc.id === c.mytk) && !(TC.pend && TC.pend.id === c.mytk)) {
    TC.pend = { id: c.mytk, key: me ? me.key : "", cup: c.id, s: "", ff: 1, code: ACCT.code, sentT: 0 };
    tcSave(); tcFlush();
  }
  // the cup starts (or a reload in the middle of it): its bracket, from the menu or the sheet (over an offline cup's bracket too)
  const started = !!c && c.st === "run" && !(old && old.id === c.id && old.st === "run");
  if ((TC.boot || started) && c && c.st === "run" && c.mi >= 0 && c.out < 0 && (mode === "menu" || mode === "cup")) tcBracket({ start: started && !TC.boot });
  if (c && c.st === "run") TC.boot = false;
  if (c && c.st === "done" && TC.seen !== c.id && mode === "tcup") TC.seen = c.id;
  tcRender();
}
function tcRender() {
  if (typeof tcvPill === "function") tcvPill();
  if (TC.sheet && typeof tcvSheet === "function") tcvSheet();
  if (mode === "tcup" && typeof tcvBracketRender === "function") tcvBracketRender();
  if (typeof tcvCall === "function") tcvCall();
}
function tcNo(why) {
  TC.busy = false;
  if (why === "acct") { QM.authed = false; qmAuth(); return; }   // signed out (the server restarted): sign in, then the wanted message goes
  if (why === "old") { QM.no = "old"; tcFail("A new version is out. Reload the page."); return; }
  if (why === "slow" && TC.last && !TC.again) { const w = TC.last; TC.again = true; TC.busy = true; setTimeout(() => { if (!TC.want) tcSend(w); }, 1500); return; }   // once
  tcFail({ closed: "That cup isn't open.", full: "That cup is full.", busy: "You're already in a cup.", nocup: "No cup with that code.", few: "A cup needs 2 players.",
    host: "Only the host can start it.", bad: "Couldn't join. Try again.", slow: "One moment, then try again." }[why] || "Couldn't join. Try again.");
}
function tcFail(note) { TC.want = null; TC.busy = false; TC.note = note || ""; tcRender(); }
// a message that needs the account: made silently first (as Ranked vs CPU), then signed in, then sent (tcMsg "me")
function tcSend(msg) {
  if (!tcOn()) return;
  if (QM.no === "old") { location.reload(); return; }
  TC.want = msg; TC.note = ""; TC.again = false;
  tcGoOn();
}
async function tcGoOn() {
  if (!TC.want) return;
  if (!QM.conn) { TC.busy = false; TC.note = "Connecting to the server…"; tcRender(); return; }   // goes on when connected (tcBoot)
  if (qmAcctOff()) { tcFail("Cups open once accounts are on."); return; }
  if (QM.acct === "unknown") { tcFail("This phone's account isn't on the server. Check Account."); return; }
  TC.busy = true; TC.note = ""; tcRender();
  const w0 = TC.want;
  setTimeout(() => { if (TC.want === w0 && TC.busy) tcFail("Couldn't reach the server. Try again."); }, 10000);
  if (!ACCT.code) {
    const ok = await qmMakeAcct();
    if (!ok) { tcFail(qmAcctOff() ? "Cups open soon." : "Couldn't reach the server. Try again."); return; }
  }
  if (!QM.authed) { qmAuth(); return; }
  tcDo();
}
function tcDo() {
  const w = TC.want;
  if (!w || !QM.authed) return;
  TC.want = null; TC.last = w;
  window.__blQuick.send(Object.assign({ v: PROTO }, w));
  setTimeout(() => { if (TC.busy) { TC.busy = false; tcRender(); } }, 6000);
}

/* ----- what you can do (the views call these) ----- */
function tcIn(on) { cnt("tc:in"); tcSend({ t: "tci", on: on ? 1 : 0 }); }
function tcJoin() { const f = tcFighter(); cnt("tc:join"); tcSend({ t: "tcj", k: "d", f, pi: palIdx(f) }); }
function tcJoinCode(code) {
  code = String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/.test(code)) { tcFail("A cup code has 5 letters and digits."); return; }
  const f = tcFighter(); cnt("tc:join"); tcSend({ t: "tcj", k: code, f, pi: palIdx(f) });
}
function tcHost() { const f = tcFighter(); cnt("tc:host"); tcSend({ t: "tcn", f, pi: palIdx(f) }); }
function tcStart() { if (!TC.cup || !TC.cup.host) return; Sfx.init(); goFull(); cnt("tc:start"); window.__blQuick.send({ t: "tcs" }); TC.busy = true; tcRender(); }
function tcLeave() {
  if (!TC.cup) return;
  window.__blQuick.send({ t: "tcl" });
  TC.call = null;
  if (TC.cup.st !== "run") TC.cup = null;
  tcRender();
}
// your fighter: the select screen, back to where you were; the server takes it for your next match (not once it is called)
function tcPick() {
  const c = TC.cup, me = c && c.slots && c.mi >= 0 ? c.slots[c.mi] : c && c.ent ? c.ent.find((e) => e.me) : null;
  sel.fighter = me && FIG[me.f] ? me.f : tcFighter();
  TC.pickFrom = mode === "tcup" ? "tcup" : "sheet";
  if (TC.sheet) tcClose();
  openSelect("tc");
}
function tcPickBack() { if (TC.pickFrom === "tcup" && tcPlaying()) tcBracket(); else { goMenu(); tcOpen(); } }
function tcPicked() {
  P.last = sel.fighter; saveProfile();
  if (tcOn() && TC.cup && TC.cup.st !== "done" && TC.cup.st !== "off") window.__blQuick.send({ t: "tcp", f: sel.fighter, pi: palIdx(sel.fighter) });
  if (TC.pickFrom === "tcup" && TC.cup && TC.cup.st === "run") tcBracket(); else { goMenu(); tcOpen(); }
}
function tcOpen() {
  if (!tcOn()) { cupOpen(); return; }   // not on our server: the offline cup, as before
  if (tcPlaying() && mode !== "tcup") { tcBracket(); return; }
  TC.sheet = true; TC.note = "";
  tcAsk();
  if (typeof tcvSheetOpen === "function") tcvSheetOpen();
  tcRender();
}
function tcClose() { if (!TC.sheet) return; TC.sheet = false; if (typeof tcvSheetClose === "function") tcvSheetClose(); if (mode === "menu") tcRender(); }
function tcBracket(o) {
  if (TC.sheet) tcClose();
  finStop(); hideBanner(); modal("pause", false); modal("help", false); modal("settings", false);
  mode = "tcup"; paused = false; G = null; match = null; meSlot = 0;
  $("hud").hidden = true; $("ctl").hidden = true; releaseTouch();
  show("cup"); resize();
  if (typeof tcvBracket === "function") tcvBracket(o || {});
  tcRender();
}
function tcBack() { goMenu(); if (!tcPlaying()) { const c = TC.cup; if (c && (c.st === "done" || c.st === "off")) TC.seen = c.id; } }
// the link of your Friends Cup: the share sheet on a phone, else copied
function tcLink() { return TC.cup && TC.cup.code ? `${location.origin}${location.pathname}#cup=${TC.cup.code}` : ""; }
function tcShare() {
  const link = tcLink();
  if (!link) return;
  cnt("tc:share");
  const text = `Join my PotatoBrawl cup! Code ${TC.cup.code}`;
  if (chlPhone()) { try { navigator.share({ title: "PotatoBrawl", text, url: link }).catch(() => {}); return; } catch (e) { /* no share sheet: copy */ } }
  try { navigator.clipboard.writeText(link).then(() => { TC.note = "Link copied."; tcRender(); }, () => {}); } catch (e) { /* no clipboard */ }
}
// loop.js, after the turn-sideways screen: a Friends Cup's link opens the sheet and joins it
function tcHashCode() { const m = /^#cup=([0-9A-Za-z]{5})$/.exec(location.hash || ""); return m ? m[1].toUpperCase() : ""; }
function tcLanding() {
  const code = tcHashCode();
  if (!code || !tcOn()) return false;
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* the hash stays: harmless */ }
  TC.link = code;
  cnt("tc:link");
  tcOpen();
  tcJoinCode(code);
  return true;
}
window.addEventListener("hashchange", () => { if (tcHashCode() && mode !== "match") tcLanding(); });

/* ----- the call-up: tap FIGHT within 60 s ----- */
function tcCalled(m) {
  if (!TC.cup || m.id !== TC.cup.id || typeof m.key !== "string") return;
  TC.call = { id: m.id, key: m.key, r: m.r | 0, cpu: m.cpu ? 1 : 0, opp: m.opp || null, until: Date.now() + (m.ms | 0), ready: false };
  tcAbortFound(m.key);   // (the server called it again: a room that never started is gone)
  if (qmSearching()) qmCancel("");   // a cup match comes first
  Sfx.init(); qmChime();
  try { if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 160]); } catch (e) { /* no vibration */ }
  // a fight on this phone (a warm-up, Practice): it pauses under the call-up (its pause menu stays if the call goes)
  if (mode === "match" && match && !match.online && !match.qm && !match.rp && !paused) togglePause(true);
  tcRender();
}
function tcFight() {
  const k = TC.call;
  if (!k || k.ready || Date.now() > k.until + 1500) return;
  Sfx.init(); goFull();
  tcDrop();
  k.ready = true;
  cnt("tc:play");
  window.__blQuick.send({ t: "tcgo" });
  if (mode !== "tcup") tcBracket(); else tcRender();
}
// the call-up's FIGHT: whatever this phone is in ends without a result (a warm-up, Practice, a friend match; tcBusy says so first)
function tcDrop() {
  if (mode === "match" && match && !match.rp) cntEnd(true);
  if (qmSearching()) qmCancel("");
  if (NET.mr) leaveMatchRoom();
  if (NET.phase !== "idle") { resetNet(); NET.phase = "idle"; }
  if (QM.st === "found" && !(QM.found && QM.found.tm)) { QM.st = "idle"; QM.found = null; }
  if (VC.tk && !VC.tk.tc) VC.tk = null;
  $("qmVs").hidden = true; $("qmFound").hidden = true; QM.vsT = VC.vsT = 0; QM.fdT = 0;
  if (mode === "match" || mode === "result") { finStop(); G = null; match = null; meSlot = 0; }
  lobbyPresence();
}
// what the call-up's FIGHT leaves (the banner's small line), "" when nothing
function tcBusy() {
  if (mode === "match" && match) {
    if (match.tcw || match.warm) return "Your warm-up ends.";
    if (match.qm) return match.qm.ranked || match.qm.sk ? "You leave your Quick match: it counts as a loss." : "You leave your Quick match.";
    if (match.online) return "You leave the friend match.";
    if (match.vc && !match.vc.tc) return "Your Ranked vs CPU match ends without a result.";
    if (match.bw) return "Your Boss Week try ends.";
    return "This fight ends.";
  }
  return qmSearching() ? "Your Quick match search stops." : "";
}
// the match against a player was assigned (ui/quick.js qmFound asks): only the one you were called to and said FIGHT for
function tcFoundOk(m) {
  const tm = m && m.tm;
  return !!tm && !!TC.cup && tm.id === TC.cup.id && typeof tm.key === "string" && ((TC.call && TC.call.key === tm.key) || (tcMine() || {}).key === tm.key);
}
// qmFound (ui/quick.js), after the VS screen is up: its words say which cup and round
function tcVsWords(m) {
  const c = TC.cup;
  TC.call = null;
  $("vsMode").textContent = `${tcKind(c)} · ${tcRoundName(c ? c.size : 8, m.tm.r | 0)}`;
  $("vsStamp").className = "vs-st rk";
  $("vsFb").hidden = true; $("vsWhy").hidden = true;
  tcRender();
}
// the room of a cup match never started (the server called it again or decided it): back to the bracket
function tcAbortFound(key) {
  if (!QM.found || !QM.found.tm || QM.found.tm.key !== key || NET.phase === "match" || NET.phase === "result") return;
  $("qmVs").hidden = true; $("qmFound").hidden = true; QM.vsT = 0; QM.fdT = 0;
  if (NET.mr) leaveMatchRoom();
  resetNet(); NET.phase = "idle"; QM.found = null; QM.st = "idle";
  if (mode === "quick") tcBracket();
}

/* ----- a match against a CPU: its ticket, the VS screen, the fight (ui/vscpu.js), the log to the server ----- */
function tcTicket(m) {
  if (!TC.cup || m.id !== TC.cup.id || !m.tk || !vcTicketOk(m.tk)) return;
  const tk = Object.assign({}, m.tk, { tc: { id: m.id, key: m.key, r: parseInt(m.key, 10) || 0, size: TC.cup.size, k: TC.cup.k } });
  TC.tk = tk; TC.call = null;
  VC.asking = false; VC.tk = tk;   // vcTick starts it after the VS screen
  qmEndWarm();
  vcVs(tk);
  $("vsMode").textContent = `${tcKind(TC.cup)} · ${tcRoundName(tk.tc.size, tk.tc.r)}`;
  const me = TC.cup.mi >= 0 ? TC.cup.slots[TC.cup.mi] : null, t = $("vsTL"), w = t && t.querySelector("span");
  if (w && me) w.textContent = `Seed ${me.sd}`;
  tcRender();
}
// screens.js finishMatch -> vcMatchEnd: the chips of a friend match on this phone, the log to the server, the results
function tcCpuEnd(forfeit) {
  const tk = match.vc, me = G.fighters[0], op = G.fighters[1];
  const res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5;
  const R = { res, forfeit, tc: tk.tc, tk, me, op, lines: [], total: 0 };
  if (!forfeit) {
    R.lines.push(res === 1 ? ["Win", 15] : res === 0.5 ? ["Draw", 8] : ["Match played", 5]);
    if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 2]);
    R.total = R.lines.reduce((a, l) => a + l[1], 0);
    P.tokens += R.total; saveProfile();
  }
  TC.tk = null;
  TC.pend = { id: tk.id, key: tk.tc.key, cup: tk.tc.id, s: vcPack(match.log), ff: forfeit ? 1 : 0, code: ACCT.code, sentT: 0 };
  tcSave(); tcFlush();
  showResults(R);
}
function tcFlush() {
  const p = TC.pend;
  if (!p || !tcOn() || !QM.conn || !QM.authed || p.code !== ACCT.code) return;
  const n = Math.max(1, Math.ceil(p.s.length / 6000));
  for (let k = 0; k < n; k++) window.__blQuick.send({ t: "tcr", id: p.id, k, n, s: p.s.slice(k * 6000, (k + 1) * 6000), ff: p.ff });
  p.sentT = Date.now(); tcSave();
}

/* ----- results ----- */
function tcRes(m) {
  if (!TC.cup || m.id !== TC.cup.id || typeof m.key !== "string") return;
  TC.res[m.key] = m;
  if (TC.pend && TC.pend.cup === m.id && TC.pend.key === m.key) { TC.pend = null; tcSave(); }
  if (TC.call && TC.call.key === m.key) TC.call = null;
  tcAbortFound(m.key);
  if (m.rv && typeof rvCasual === "function" && QM.found && QM.found.tm && QM.found.tm.key === m.key) rvCasual({ t: "qm-cs", id: QM.found.id, g: 1, res: m.res, rv: m.rv });   // ui/rivals.js: the record against them
  if (mode === "result" && TC.shown && TC.shown.key === m.key && typeof tcvResult === "function") tcvResult(TC.shown.R, m);
  if (m.res === 0 && m.why !== "game" && mode === "tcup" && typeof tcvBracketRender === "function") tcvBracketRender();
  tcRender();
}
function tcEnd(m) {
  if (!TC.cup || m.id !== TC.cup.id) return;
  TC.end = m;
  if (m.c > 0) acctSoon(800);   // the prize is in the account: the next sync brings it to this phone
  if (m.pl === 1) cnt("tc:champ");
  if (mode === "tcup" && typeof tcvBracket === "function") tcvBracket({ cheer: m.pl === 1 && m.ch !== null });
  tcRender();
}
// ui/quick.js qmResults: a cup match's results (against a player: R.qm.tm; against a CPU: R.tc)
function tcResults(R) {
  const tm = R.tc || (R.qm && R.qm.tm), c = TC.cup;
  const key = tm.key, size = c ? c.size : tm.size || 8, r = tm.r | 0;
  TC.shown = { key, R };
  $("rMode").textContent = `${tcKind(c)} · ${tcRoundName(size, r)}`;
  $("rAgain").querySelector("span").textContent = "Bracket"; $("rAgain").disabled = false;
  $("rChange").hidden = true; $("rMenuSub").textContent = "";
  { const ln = $("rBoardL"); if (ln) ln.hidden = true; $("rRank").classList.remove("vc"); $("rRank").hidden = true; }
  if (!R.lines.length) $("rWhy").textContent = masteryWhy(R.forfeit ? "You left the match: you're out of the cup." : "No chips for an unfinished match.");
  if (typeof tcvResult === "function") tcvResult(R, TC.res[key] || null);
}
// the results' buttons and Pause (ui/quick.js asks first): a cup match's BRACKET; the lobby warm-up's ANOTHER CPU FIGHT and BACK TO THE LOBBY
const tcCupMatch = () => !!match && ((match.qm && !!match.qm.tm) || (match.vc && !!match.vc.tc));
function tcAgain() {
  if (match && match.tcw) { tcWarm(); return true; }
  if (tcCupMatch()) { tcAfterMatch(); return true; }
  return false;
}
function tcChange() {
  if (match && match.tcw) { goMenu(); tcOpen(); return true; }
  if (tcCupMatch()) { tcAfterMatch(); return true; }
  return false;
}
function tcAfterMatch() {
  const key = TC.shown ? TC.shown.key : "";
  if (match && match.qm) qmLeave();
  QM.st = "idle"; QM.found = null;
  tcBracket({ after: key });
}
function tcWarmResults() {   // ui/quick.js qmResults
  const k = $("rMode"); k.textContent = "";
  const t = document.createElement("span"); t.className = "tag ember st qm-cpu"; t.textContent = "CPU";
  k.append(t, "Warm-up");
  $("rAgain").querySelector("span").textContent = "Another CPU fight";
  $("rChange").querySelector("span").textContent = "Back to the lobby";
  $("rMenuSub").textContent = "";
  { const ln = $("rBoardL"); if (ln) ln.hidden = true; $("rRank").classList.remove("vc"); }
}
function tcPauseText() {
  if (match && match.tcw) { $("pQuit").querySelector("span").textContent = "Back to the lobby"; $("pNote").textContent = "A call-up stops this fight."; return; }
  $("pQuit").querySelector("span").textContent = "Forfeit";
  $("pNote").textContent = match && match.qm ? "Online matches keep running while this is open. Leaving knocks you out of the cup." : "Leaving knocks you out of the cup.";
}
function tcStripText() { const tk = match.vc; return `${tcKind(tk.tc)} · ${tcRoundName(tk.tc.size, tk.tc.r)} · vs CPU`; }   // ui/vscpu.js: the HUD strip

/* ----- a warm-up in the lobby: a CPU fight while you wait (a call-up stops it) ----- */
function tcWarm() {
  Sfx.init(); goFull();
  if (TC.sheet) tcClose();
  const me = FIG[tcFighter()], myPal = me.palettes[palIdx(me.id)] || me.palettes[0], opp = cpuFoe(me);
  const oppPal = opp.id === me.id ? opp.palettes[(palIdx(me.id) + 1) % opp.palettes.length] : opp.palettes[0];
  const d = Math.max(LEVELS[2].d, clamp((rankView().r - 750) / 1000, 0.08, 0.98));
  G = newGame({ seed: newSeed(), players: [{ spec: me, pal: myPal }, { spec: opp, pal: oppPal }], stocks: 3, time: 240, countdown: 150, map: randMap() });
  match = { warm: true, tcw: true, ranked: false, d, bot: makeBot(d, BL.BOT_STYLES[opp.id]), level: "Warm-up", cpu: cpuName() };
  meSlot = 0;
  enterMatchUI();
}

/* ----- every frame (vcTick): the call-up's clock, a log with no answer ----- */
function tcTick() {
  if (!tcOn()) return;
  const k = TC.call;
  if (k && !k.ready && Date.now() > k.until + 1500) { TC.call = null; tcRender(); }
  const p = TC.pend;
  if (p && p.sentT && Date.now() - p.sentT > 15000 && QM.authed) { tcFlush(); tcAsk(); }
  const now = performance.now();
  if (mode !== TC.mode0 || (QM.vsT > 0) !== TC.vs0) { TC.mode0 = mode; TC.vs0 = QM.vsT > 0; if (typeof tcvCall === "function") tcvCall(); }   // the banner follows the screen
  if (now - TC.alertT > 250) { TC.alertT = now; if (typeof tcvTick === "function") tcvTick(); }
}
