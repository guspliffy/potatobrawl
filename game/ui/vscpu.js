/* ===================== Ranked vs CPU: a CPU match that counts for its own rank (the server side is cpurank.js) =====================
   The third choice on the Quick match screen (VS CPU, next to Ranked and Casual). The server deals the match (a ticket: the CPU, its
   rating and strength, the map and the seed), this phone plays it with no lag and logs your inputs in the online encoding (encIn), and
   the server plays the same match again from them before the CPU rank or the CPU board moves. So the CPU rank lives on the server (the
   account file's `cpu` part); this page keeps a copy for the menu, and a finished match's log until the server has counted it (a
   connection lost at the end sends it later). Chips are paid on this phone as in the old Ranked vs a CPU.
   The CPU follows your rating (yours ±70; 1000 plays a bit above Easy, 1250 Normal, 1650 Hard) up to full strength at 1730, where its
   rating stops: above that every point needs a cleaner win record. The first 5 matches are against a Hard CPU counted as 1650.
   Fable's design: quick-match/vs-cpu/fable-vs-cpu.md. Styles: css/96-vscpu.css. The Boards sheet is ui/boards.js. */
const VC_KEY = "potatobrawl.vc.v1";
const VC_FRESH = Object.freeze({ r: 1000, pk: 1000, w: 0, l: 0, d: 0, n: 0, h: Object.freeze([]) });   // Season 1 starts everyone here
const VC_CAP = 1730, VC_SPREAD = 70, VC_PLACE_R = 1650;   // the server's (cpurank.js)
const VC = {
  me: null, code: "",        // the server's CPU record { r, pk, w, l, d, n, h } and the sync code it belongs to
  pl: 0, opl: 0, of: 0,      // your place on the CPU board and on the online board (0: not on it), players on the CPU board
  pend: null,                // a finished match's result until the server counts it: { id, code, s (the packed log), ff, res, r0, n0, pl0, f, of, ni, cr }
  asking: false, askT: 0, note: "", acct: "",
  vsT: 0, tk: null, res: null, shown: null, applied: [], streak: 0,
  bd: { c: null, o: null }, bdWait: { c: [], o: [] },
};
(function vcLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(VC_KEY) || "null");
    if (!s || typeof s !== "object") return;
    if (s.me && typeof s.code === "string") { VC.me = vcClean(s.me); VC.code = s.code; }
    VC.pl = Math.max(0, s.pl | 0); VC.opl = Math.max(0, s.opl | 0); VC.of = Math.max(0, s.of | 0); VC.streak = Math.max(0, s.k | 0);
    if (s.pend && typeof s.pend.id === "string" && typeof s.pend.s === "string") VC.pend = s.pend;
  } catch (e) { /* storage blocked: nothing remembered */ }
})();
function vcSave() { try { localStorage.setItem(VC_KEY, JSON.stringify({ me: VC.me, code: VC.code, pl: VC.pl, opl: VC.opl, of: VC.of, pend: VC.pend, k: VC.streak })); } catch (e) { /* ignore */ } }
function vcClean(o) {
  const n = (v, d) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : d);
  const me = { r: n(o.r, 1000), pk: n(o.pk, 1000), w: n(o.w, 0), l: n(o.l, 0), d: n(o.d, 0), n: n(o.n, 0), h: [] };
  me.pk = Math.max(me.pk, me.r);
  if (Array.isArray(o.h)) me.h = o.h.filter((x) => x && typeof x === "object").slice(0, 20).map((x) => ({
    t: Number.isFinite(x.t) ? x.t : 0, of: FIG[x.of] ? x.of : "", f: FIG[x.f] ? x.f : "", or: n(x.or, 0), ni: n(x.ni, 0),
    res: [1, 0.5, 0].includes(x.res) ? x.res : 0, dr: Number.isInteger(x.dr) && Math.abs(x.dr) < 1000 ? x.dr : 0, why: typeof x.why === "string" ? x.why.slice(0, 8) : "" }));
  return me;
}
const vcMine = () => (VC.me && VC.code && VC.code === ACCT.code ? VC.me : null);   // the record of the account this device is linked to
const vcMode = () => qmOn() && QM.mode === "v" && !qmAcctOff();
const vcCpuName = (ni) => CPU_NAMES[(ni | 0) % CPU_NAMES.length];
// acct.js titles (#1 CPU board, Top 10 CPU): read before this part has run, so it can't touch VC yet
function vcPlace() { try { return VC.pl | 0; } catch (e) { return 0; } }
// ui/boards.js, Account > Profile's two plates
function vcRanks() { const on = qmMe() || QM_FRESH, c = vcMine() || VC_FRESH; return { on: { r: on.r, n: on.n, pl: VC.opl }, cpu: { r: c.r, n: c.n, pl: VC.pl } }; }
// the next CPU in words: "about Hard · Gold 1150–1300" (placement: "a Hard CPU")
function vcNext() {
  const me = vcMine() || VC_FRESH;
  if (me.n < QM_PLACING) return { pm: true, word: "Hard", lo: VC_PLACE_R, hi: VC_PLACE_R };
  const lo = clamp(me.r - VC_SPREAD, 600, VC_CAP), hi = clamp(me.r + VC_SPREAD, 600, VC_CAP);
  return { pm: false, word: vcWord((lo + hi) / 2), lo, hi };
}
function vcWord(r) { const d = clamp((r - 750) / 1000, 0.08, 0.98); return d >= 0.98 ? "Max" : d >= 0.85 ? "Hard" : d >= 0.45 ? "Normal" : "Easy+"; }

/* ----- the server's messages (net-ws.js passes cme / ct-ok / ct-no / cres / bd to every Quick match listener) ----- */
function vcBoot() {   // qmBoot (ui/quick.js), once
  if (!qmOn()) return;
  window.__blQuick.on(vcMsg);
  window.__blVc = VC;   // tests read it
  bwBoot();   // ui/bossweek.js: Boss Week's messages
}
function vcMsg(m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "me") { if (!m.err) vcAuthed(); else if (VC.asking) vcFail(m.err === "off" ? "Ranked vs CPU opens soon." : "This phone's account isn't on the server. Check Account."); }
  else if (m.t === "cme") vcGotMe(m);
  else if (m.t === "ct-ok") vcTicket(m);
  else if (m.t === "ct-no") vcRefused(m.why);
  else if (m.t === "cres") vcRes(m);
  else if (m.t === "bd") vcBdDone(m.k, vcBdClean(m));
}
// signed in (ui/quick.js qmGotMe ran first): the last match's result goes first, then your record; a waiting FIGHT A CPU goes on
function vcAuthed() {
  if (VC.pend && VC.pend.code !== ACCT.code) { VC.pend = null; vcSave(); }   // another account's match: the server counts it on its own
  vcFlush();
  window.__blQuick.send({ t: "cme" });
  if (VC.asking) vcGo();
}
function vcGotMe(m) {
  if (m.err) { VC.acct = m.err; return; }
  VC.acct = ""; VC.me = vcClean(m); VC.code = ACCT.code;
  VC.pl = Math.max(0, m.pl | 0); VC.opl = Math.max(0, m.opl | 0); VC.of = Math.max(0, m.of | 0);
  // the server no longer holds the ticket of the match on its way: it was counted (or voided) without its answer reaching us
  if (VC.pend && m.tk !== VC.pend.id && VC.pend.sentT) VC.pend = null;
  vcSave(); qmRefresh();
}

/* ----- FIGHT A CPU: the account, the last result, then a ticket ----- */
function vcFight() {
  if (!qmOn()) return;
  if (QM.no === "old") { location.reload(); return; }
  if (VC.asking) return;
  VC.note = "";
  if (!QM.conn) { VC.note = "Connecting to the server…"; qmRender(); return; }
  if (qmAcctOff()) { VC.note = "Ranked vs CPU opens once accounts are on."; qmRender(); return; }
  Sfx.init(); goFull();   // fullscreen needs the tap itself
  VC.asking = true; VC.askT = Date.now();
  qmRender();
  vcGo();
}
async function vcGo() {
  if (!ACCT.code) {
    const ok = await qmMakeAcct();
    if (!VC.asking) return;
    if (!ok) { vcFail(qmAcctOff() ? "Ranked vs CPU opens soon." : "Couldn't reach the server. Try again."); return; }
  }
  if (!QM.authed) { qmAuth(); return; }   // vcAuthed goes on once signed in
  if (VC.pend) { vcFlush(); return; }      // vcRes goes on once the last match is counted
  window.__blQuick.send({ t: "ct", v: PROTO, f: sel.fighter, pi: palIdx(sel.fighter) });
}
function vcFail(note) { VC.asking = false; VC.note = note || ""; qmRender(); if (mode === "result" && VC.shown) $("rPromo").textContent = note || ""; }
function vcRefused(why) {
  if (why === "acct") { QM.authed = false; qmAuth(); return; }   // signed out (the server restarted): sign in, then ask again
  if (why === "slow") { setTimeout(() => { if (VC.asking) vcGo(); }, 1500); return; }
  if (why === "old") { QM.no = "old"; vcFail(""); return; }
  vcFail("Couldn't start a ranked CPU match. Try again.");
}
function vcTicketOk(m) {
  return typeof m.id === "string" && /^[0-9a-f]{12}$/.test(m.id) && Number.isInteger(m.seed) && Number.isInteger(m.map) && m.map >= 0 && m.map < BL.POOL &&
    Array.isArray(m.f) && m.f.length === 2 && m.f.every((id) => FIG[id]) && Array.isArray(m.p) && m.p.every((v, i) => Number.isInteger(v) && v >= 0 && v < FIG[m.f[i]].palettes.length) &&
    Number.isInteger(m.cr) && typeof m.d === "number" && m.d > 0 && m.d <= 1;
}
// the ticket: the VS screen over Quick match, then the fight (vcTick)
function vcTicket(m) {
  if (!VC.asking || !vcTicketOk(m)) return;
  VC.asking = false; VC.tk = m;
  qmEndWarm();   // ui/quick.js: from the results (ANOTHER CPU FIGHT) or Quick match, the Quick match screen under the VS screen
  vcVs(m);
}
function vcVs(tk) {
  const el = $("qmVs"), me = vcMine() || VC_FRESH;
  const fs = newGame({ seed: 1, players: tk.f.map((id, k) => ({ spec: FIG[id], pal: FIG[id].palettes[tk.p[k]] || FIG[id].palettes[0] })), countdown: 1 }).fighters;
  qmVsArt.length = 0;
  glazeMark(fs[0], glazeHas(tk.f[0], tk.p[0]));   // ui/glaze.js: your own glaze
  for (const [k, f] of [["L", fs[0]], ["R", fs[1]]]) { f.x = 0; f.y = 0; f.facing = k === "L" ? 1 : -1; qmVsArt.push({ cv: $("vsArt" + k), f, fit: 0.6, bottom: 0.9 }); }
  const side = (k, name, fid, pi, r, words) => {
    const spec = FIG[fid], pal = spec.palettes[pi] || spec.palettes[0];
    el.style.setProperty(k === "L" ? "--cl" : "--cr", rgba(col(pal), 0.42));
    $("vsName" + k).textContent = name;
    $("vsF" + k).textContent = spec.name;
    const t = $("vsT" + k); t.innerHTML = tierEmblem(tierIdx(r)); t.classList.toggle("un", false);
    const w = document.createElement("span"); w.textContent = words; t.append(w);
  };
  side("L", NET.myName || acctName(), tk.f[0], tk.p[0], me.r, qmTierWords(me.r, me.n < QM_PLACING ? { n: me.n } : null, false));
  side("R", vcCpuName(tk.ni), tk.f[1], tk.p[1], tk.cr, `${tierInfo(tk.cr).t.name} ${tk.cr} · ${tk.pm ? "Hard" : vcWord(tk.cr)} CPU`);
  let st = $("vsCpu");
  if (!st) { st = document.createElement("i"); st.id = "vsCpu"; st.className = "tag ember st vc-cpu"; st.textContent = "CPU"; $("vsNameR").parentNode.appendChild(st); }
  st.hidden = false;
  for (const id of ["vsRiv", "vsWL", "vsWR", "vsTagR"]) { const e = $(id); if (e) e.hidden = true; }   // the rival record's (ui/rivals.js): not for a CPU
  $("vsMode").textContent = "Ranked · CPU";
  $("vsStamp").className = "vs-st rk";
  $("vsFb").hidden = true; $("vsWhy").hidden = true;
  $("vsPing").textContent = tk.pm ? `Placement ${me.n + 1} of ${QM_PLACING} · ${mapName(tk.map)}` : mapName(tk.map);
  el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
  QM.vsT = VC.vsT = performance.now(); QM.vsN++;
  Sfx.tone(120, 40, 0.35, "sine", 0.5); Sfx.noise(0.2, 0.3, 900);
}
// the fight: the server's match exactly (its seed, map, fighters and skins, the CPU's strength), your inputs logged (vcIn)
function vcStart(tk) {
  $("qmVs").hidden = true; QM.vsT = VC.vsT = 0;
  const st = $("vsCpu"); if (st) st.hidden = true;
  const me = FIG[tk.f[0]], op = FIG[tk.f[1]];
  G = newGame({ players: [{ spec: me, pal: me.palettes[tk.p[0]] || me.palettes[0] }, { spec: op, pal: op.palettes[tk.p[1]] || op.palettes[0] }], stocks: 3, time: 240, countdown: 150, map: tk.map, seed: tk.seed });
  match = { vc: tk, ranked: false, d: tk.d, oppRating: tk.cr, bot: makeBot(tk.d, BL.BOT_STYLES[op.id]), level: null, cpu: vcCpuName(tk.ni), log: [] };
  meSlot = 0;
  enterMatchUI();
}
// simTick (loop.js): your input this frame, in the online encoding (what the server will replay), logged until the match ends
function vcIn(pi) {
  const m = match;
  if (!m || !(m.vc || m.bw) || !G || G.phase === "end" || G.phase === "over") return pi;   // m.bw: a Boss Week try (ui/bossweek.js)
  const v = encIn(pi);   // ui/online.js
  m.log.push(v);
  return decIn(v);
}
// runs of one code, three characters each (cpurank.js unpack)
function vcPack(codes) {
  let s = "";
  for (let i = 0; i < codes.length;) {
    let n = 1;
    while (n < 64 && codes[i + n] === codes[i]) n++;
    s += B64[codes[i] >> 6] + B64[codes[i] & 63] + B64[n - 1];
    i += n;
  }
  return s;
}

/* ----- the end: chips on this phone, the log to the server, the rank card waits for its verdict ----- */
function vcMatchEnd(forfeit) {   // screens.js finishMatch
  const tk = match.vc, me = G.fighters[0], op = G.fighters[1], rec = vcMine() || VC_FRESH;
  const res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5;
  const R = { res, forfeit, vc: tk, me, op, lines: [], total: 0 };
  const kos = (each) => { if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * each]); };
  if (!forfeit) {   // the old Ranked's chips: win 20, draw 10, a match played 6, KOs, a win streak
    if (res === 1) {
      R.lines.push(["Win", 20]); kos(5);
      const k = VC.streak + 1, sb = Math.min(20, (k - 1) * 5);
      if (sb > 0) R.lines.push([`${k} win streak`, sb]);
    } else if (res === 0.5) { R.lines.push(["Draw", 10]); kos(3); }
    else { R.lines.push(["Match played", 6]); kos(2); }
  }
  R.total = R.lines.reduce((a, l) => a + l[1], 0);
  if (R.total) { P.tokens += R.total; saveProfile(); }
  VC.streak = res === 1 ? VC.streak + 1 : res === 0 ? 0 : VC.streak;
  VC.pend = { id: tk.id, code: ACCT.code, s: vcPack(match.log), ff: forfeit ? 1 : 0, res, r0: rec.r, n0: rec.n, pl0: VC.pl, f: tk.f[0], of: tk.f[1], ni: tk.ni, cr: tk.cr, sentT: 0 };
  vcSave(); vcFlush();
  showResults(R);
}
// the log to the server, in parts the WebSocket takes (6,000 characters each)
function vcFlush() {
  const p = VC.pend;
  if (!p || !qmOn() || !QM.conn || !QM.authed || p.code !== ACCT.code) return;
  const n = Math.max(1, Math.ceil(p.s.length / 6000));
  for (let k = 0; k < n; k++) window.__blQuick.send({ t: "cr", id: p.id, k, n, s: p.s.slice(k * 6000, (k + 1) * 6000), ff: p.ff });
  p.sentT = Date.now(); vcSave();
}
function vcRes(m) {
  if (!m || typeof m.id !== "string" || VC.applied.includes(m.id)) return;
  VC.applied.push(m.id); if (VC.applied.length > 8) VC.applied.shift();
  const p = VC.pend && VC.pend.id === m.id ? VC.pend : null;
  if (m.res !== null && Number.isInteger(m.r1) && Number.isInteger(m.n)) {
    const me = Object.assign({}, vcMine() || VC_FRESH);
    Object.assign(me, { r: m.r1, pk: Math.max(m.pk | 0, m.r1), n: m.n, w: m.w | 0, l: m.l | 0, d: m.d | 0 });
    me.h = [{ t: Date.now(), of: p ? p.of : "", f: p ? p.f : "", or: p ? p.cr : 0, ni: p ? p.ni : 0, res: m.res, dr: m.dr | 0, why: m.why }, ...me.h].slice(0, 20);
    VC.me = me; VC.code = ACCT.code;
    VC.pl = Math.max(0, m.pl1 | 0); VC.of = Math.max(0, m.of | 0);
    if (p && FIG[p.f]) {   // the per-fighter record (Account > Stats) counts ranked matches, CPU ones too
      const fs = P.fstats[p.f] || (P.fstats[p.f] = { w: 0, l: 0, d: 0 });
      fs[m.res === 1 ? "w" : m.res === 0 ? "l" : "d"]++;
      if (!P.fsince) P.fsince = Date.now();
      saveProfile();
    }
  }
  if (p) VC.pend = null;
  if (m.why === "late") window.__blQuick.send({ t: "cme" });
  VC.res = m; VC.bd.c = null;
  vcSave(); qmRefresh();
  if (mode === "result" && VC.shown && VC.shown.vc.id === m.id) vcVerdictView(true);
  if (VC.asking) vcGo();   // ANOTHER CPU FIGHT waited for this one to count
}

/* ----- the results ----- */
function vcResults(R) {   // ui/quick.js qmResults
  VC.shown = R;
  const tk = R.vc, k = $("rMode"); k.textContent = "";
  const t = document.createElement("span"); t.className = "tag ember st qm-cpu"; t.textContent = "CPU";
  k.append(t, `Ranked vs CPU · ${tierInfo(tk.cr).t.name} ${tk.cr} · ${tk.pm ? "placement" : vcWord(tk.cr)}`);
  $("rAgain").querySelector("span").textContent = "Another CPU fight"; $("rAgain").disabled = false;
  $("rChange").querySelector("span").textContent = "Quick match";
  $("rMenuSub").textContent = "";
  if (!R.lines.length) $("rWhy").textContent = masteryWhy("No chips for a match you left.");
  vcRankCard();
  if (VC.res && VC.res.id === tk.id) vcVerdictView(false);
}
function vcLine() {   // the board line under the rank card's bar (made once; a tap opens the CPU board)
  let b = $("rBoardL");
  if (!b) {
    b = document.createElement("button"); b.id = "rBoardL"; b.className = "rk-bd";
    $("rRank").querySelector(".rk-body").appendChild(b);
    b.addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); if (typeof bdOpen === "function") bdOpen("c"); });
  }
  return b;
}
// the rank card while the server confirms: the rating before, a … sticker (css/96-quick.css qm-wait)
function vcRankCard() {
  const p = VC.pend && VC.shown && VC.pend.id === VC.shown.vc.id ? VC.pend : null, me = vcMine() || VC_FRESH;
  const r0 = p ? p.r0 : me.r, n0 = p ? p.n0 : me.n, ti = tierInfo(r0), card = $("rRank");
  card.hidden = false; card.classList.add("qm-wait", "vc"); card.classList.remove("qm-zero"); card.style.setProperty("--tc", ti.t.col);
  paintBadge($("rBadge"), ti.i);
  $("rTier").textContent = n0 < QM_PLACING ? "Placing" : ti.t.name;
  $("rPromo").textContent = ""; $("rPromo").classList.remove("down");
  const rt = $("rRating"), b = document.createElement("b"); b.textContent = `${r0} → …`; rt.textContent = ""; rt.append(b);
  $("rBar").style.setProperty("--p", ti.p);
  const g = $("rGain"); g.style.setProperty("--g0", ti.p); g.style.setProperty("--g1", ti.p);
  $("rStick").className = "delta wait"; $("rDelta").textContent = "…"; $("rStick").querySelector("small").textContent = "Confirming";
  const ln = vcLine(); ln.hidden = false; ln.className = "rk-bd mute"; ln.textContent = "… on the CPU board";
  QM.cfT = performance.now();
}
// the server's verdict on the results on screen
function vcVerdictView(late) {
  const v = VC.res, R = VC.shown;
  if (!v || !R || R.vc.id !== v.id || mode !== "result") return;
  const card = $("rRank"), st = $("rStick"), sheet = $("resSheet"), ln = vcLine();
  card.classList.remove("qm-wait"); QM.cfT = 0;
  const look = (k) => { sheet.classList.remove("win", "loss", "draw"); sheet.classList.add(k); };
  if (v.res === null) {
    const me = vcMine() || VC_FRESH, rt = $("rRating"), b = document.createElement("b"); b.textContent = String(me.r);
    card.classList.add("qm-zero"); st.className = "delta zero"; $("rDelta").textContent = "±0"; st.querySelector("small").textContent = "No result";
    rt.textContent = ""; rt.append(b, " · unchanged"); $("rPromo").textContent = "";
    resTitle("No result"); look("draw");
    resLine($("rSub"), [v.why === "late" ? "The server had already counted this match." : "The game was updated during this match. Your CPU rank doesn't change."]);
    ln.hidden = true;
    return;
  }
  if (late) { st.style.animation = "none"; void st.offsetWidth; st.style.animation = ""; }   // the sticker pops again (40-results.css)
  resRank({ before: v.r0, after: v.r1, delta: v.dr, tb: tierIdx(v.r0), ta: tierIdx(v.r1) });
  st.querySelector("small").textContent = "Rating";   // was "Confirming"
  if (v.n < QM_PLACING) { $("rTier").textContent = `Placing ${v.n} of ${QM_PLACING}`; $("rPromo").textContent = ""; }
  else if (v.n === QM_PLACING) { $("rPromo").textContent = "Placed!"; $("rPromo").classList.remove("down"); }
  // the board line: "#14 → #11 on the CPU board ▲3", "#11 on the CPU board", "Not on the CPU board yet · 3 more matches"
  const a = v.pl0 | 0, b = v.pl1 | 0;
  ln.hidden = false;
  if (!b) { ln.className = "rk-bd mute"; ln.textContent = v.n < QM_PLACING ? `CPU board after ${QM_PLACING - v.n} more` : "Not on the CPU board"; }
  else if (!a) { ln.className = "rk-bd up"; ln.textContent = `#${b} on the CPU board · Boards ›`; }
  else if (b < a) { ln.className = "rk-bd up"; ln.textContent = `#${a} → #${b} on the CPU board ▲${a - b}`; }
  else if (b > a) { ln.className = "rk-bd down"; ln.textContent = `#${a} → #${b} on the CPU board ▼${b - a}`; }
  else { ln.className = "rk-bd"; ln.textContent = `#${b} on the CPU board · Boards ›`; }
  if (v.why === "game" && v.res !== R.res) {   // the server's copy decides
    resTitle(v.res === 1 ? "Victory" : v.res === 0 ? "Defeat" : "Draw"); look(v.res === 1 ? "win" : v.res === 0 ? "loss" : "draw");
    resLine($("rSub"), ["The server's result: ", v.res === 1 ? "you won." : v.res === 0 ? "you lost." : "a draw."]);
  } else if (v.why !== "game" && v.why !== "ff") {
    st.querySelector("small").textContent = "Rating · not confirmed";
    resTitle("Not confirmed"); look("loss");
    resLine($("rSub"), [v.why === "gone" ? "That match had no result in time. It counts as a loss." : "The server couldn't confirm this match. It counts as a loss."]);
  } else if (v.why === "ff") st.querySelector("small").textContent = "Rating · forfeit";
}
// Pause: what leaving costs (ui/quick.js qmPauseText)
function vcPauseText() {
  const tk = match.vc, me = vcMine() || VC_FRESH, dr = qmElo(me.r, tk.pm ? VC_PLACE_R : tk.cr, 0, me.n);
  $("pQuit").querySelector("span").textContent = "Forfeit";
  $("pNote").textContent = `Leaving counts as a loss · ${dr === 0 ? "−0" : String(dr).replace("-", "−")}`;
}

/* ----- the Quick match screen in VS CPU mode (ui/quick.js qmRender calls this last) ----- */
function vcRender(lb) {
  const on = vcMode(), off = qmAcctOff(), scr = $("scrQuick").querySelector(".qm2");
  scr.classList.toggle("vc", on);
  const v = $("qmV");
  v.disabled = qmSearching() || off || !QM.conn;
  $("qmVSub").textContent = off ? "opens soon" : !QM.conn ? "needs the server" : "CPU rank";
  // the warm-up's way to a match that counts, when nobody is here
  $("qmToV").hidden = on || off || !QM.conn || qmSearching() || lb.q > 0;
  const bd = $("qmBoard");
  if (bd) { bd.hidden = !on; if (on && typeof bdPreview === "function") bdPreview(); }
  if (!on) return;
  $("qmCpu").hidden = true;
  const find = $("qmFind");
  find.querySelector("span").textContent = QM.no === "old" ? "Reload" : VC.asking ? "Starting…" : "Fight a CPU";
  find.disabled = QM.no !== "old" && (!QM.conn || off || VC.asking || QM.making);
  const nx = vcNext(), me = vcMine() || VC_FRESH, truth = $("qmTruth");
  truth.className = "qm-truth" + (VC.note || QM.no ? " note" : lb.q ? " live" : "");
  truth.textContent = QM.no === "old" ? "A new version of the game is out. Reload to play." : VC.note ||
    (!QM.conn ? "Connecting to the server…" : VC.pend ? "Sending your last match to the server…"
      : lb.q ? `● ${lb.q} searching · switch to Ranked to meet ${lb.q === 1 ? "them" : "one"}`
      : nx.pm ? `Placement ${me.n + 1} of ${QM_PLACING}: a Hard CPU · win to start high`
      : `Next CPU: about ${nx.word} · ${tierInfo(nx.lo).t.name} ${nx.lo}–${nx.hi}`);
  $("qmHelp").textContent = "Ranked vs CPU: the server checks every match. The CPU gets stronger as your CPU rank rises, up to its best at 1730.";
}
// the rank plate in VS CPU mode: your CPU rank, the ember CPU sticker on the emblem, the board line under the bar
function vcPlate() {
  const me = vcMine() || VC_FRESH, ti = tierInfo(me.r), placing = me.n < QM_PLACING, card = $("qmRank");
  card.style.setProperty("--tc", ti.t.col);
  card.classList.toggle("placing", placing); card.classList.add("vc"); card.classList.remove("wanted");
  const bd = $("qmBadge"); if (bd._i !== ti.i) { bd._i = ti.i; paintBadge(bd, ti.i); }
  $("qmTier").textContent = placing ? "Placing" : ti.t.name;
  $("qmRating")._t = placing ? [`${me.n} of ${QM_PLACING} played · ${me.r}`] : ti.next ? [`${me.r} · ${ti.need} to ${ti.next.name}`, `${me.r} · ${ti.need} to go`] : [`${me.r} · top tier`];   // qmThin picks
  $("qmBar").style.setProperty("--p", placing ? me.n / QM_PLACING : ti.p);
  $("qmRec").textContent = `${me.w}W · ${me.l}L\nCPU rank`;
  const pp = $("qmPips"); pp.setAttribute("aria-label", `${me.n} of ${QM_PLACING} placing matches played`);
  [...pp.children].forEach((e, k) => e.classList.toggle("on", k < me.n));
  $("qmKRec").textContent = $("qmRec").textContent.replace("\n", " · ");
  let ln = $("qmBdl");
  if (!ln) {
    ln = document.createElement("button"); ln.id = "qmBdl"; ln.className = "qm-bdl";
    card.appendChild(ln);
    ln.addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); if (typeof bdOpen === "function") bdOpen("c"); });
  }
  ln.hidden = false;
  ln.classList.toggle("mute", !VC.pl);
  ln.textContent = VC.pl ? `#${VC.pl} on the CPU board · Boards ›` : placing ? `CPU board after ${QM_PLACING - me.n} more ${QM_PLACING - me.n === 1 ? "match" : "matches"}` : "The CPU board · Boards ›";
  const w = $("qmWant"); if (w) w.hidden = true;   // the online streak's WANTED tag (ui/rivals.js): not for the CPU rank
  qmThin();   // ui/quick.js: the narrow plate below 820 px
}
function vcPlateOff() {   // back to the online rank
  $("qmRank").classList.remove("vc");
  const ln = $("qmBdl"); if (ln) ln.hidden = true;
}
// LAST FIVE in VS CPU mode: your last ranked CPU results
function vcLast() {
  return (vcMine() || VC_FRESH).h.slice(0, 5).map((x) => ({ res: x.res, o: vcCpuName(x.ni), of: x.of, dr: x.dr }));
}
// the menu's gold hero in VS CPU mode: [kicker after the online count, the line under it]
function vcHero() {
  const me = vcMine() || VC_FRESH, ti = tierInfo(me.r), placing = me.n < QM_PLACING;
  return [`VS CPU · ${placing ? "Placing" : `${ti.t.name} ${me.r}`}`, placing ? `Placing · ${me.n} of ${QM_PLACING}` : VC.pl ? `#${VC.pl} on the CPU board` : `${me.w}W · ${me.l}L`];
}

/* ----- the boards (ui/boards.js shows them) ----- */
// k "c" (vs CPU) or "o" (online): { k, n, at, top: [{ id, nm, f, r, w, l, pl }], me: null | { i, row } | { i: 0, pn } }, or null without the server.
// window.__blBoardMock = { c: {...}, o: {...} } stands in for the server (tests).
function vcBoard(k) {
  if (window.__blBoardMock) return Promise.resolve(window.__blBoardMock[k] || null);
  if (!qmOn() || !QM.conn || (k !== "c" && k !== "o")) return Promise.resolve(null);
  const c = VC.bd[k];
  if (c && performance.now() - c.t < 3000) return Promise.resolve(c.d);
  return new Promise((res) => {
    VC.bdWait[k].push(res);
    if (VC.bdWait[k].length > 1) return;
    window.__blQuick.send({ t: "bd", k });
    setTimeout(() => { if (VC.bdWait[k].length) vcBdDone(k, null); }, 5000);
  });
}
function vcBdClean(m) {
  if (!m || (m.k !== "c" && m.k !== "o") || !Array.isArray(m.top)) return null;
  const n = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0);
  const row = (x) => (x && typeof x === "object" && typeof x.id === "string" ? { id: x.id.slice(0, 10), nm: SYNC.cleanName(typeof x.nm === "string" ? x.nm : "") || "Potato",
    f: FIG[x.f] ? x.f : "", r: n(x.r), w: n(x.w), l: n(x.l), pl: typeof x.pl === "string" && /^[a-z][a-z0-9_]{0,15}$/.test(x.pl) ? x.pl : "" } : null);
  const d = { k: m.k, n: n(m.n), at: Number.isFinite(m.at) ? m.at : Date.now(), top: m.top.slice(0, 100).map(row).filter(Boolean), me: null };
  if (m.me && typeof m.me === "object") d.me = m.me.row ? { i: n(m.me.i), row: row(m.me.row) } : { i: 0, pn: Math.min(QM_PLACING - 1, n(m.me.pn)) };
  return d;
}
function vcBdDone(k, d) {
  if (k !== "c" && k !== "o") return;
  if (d) {
    VC.bd[k] = { t: performance.now(), d };
    if (d.me && ACCT.code) { const was = k === "c" ? VC.pl : VC.opl, now = d.me.row ? d.me.i : 0; if (now !== was) { if (k === "c") VC.pl = now; else VC.opl = now; vcSave(); renderPill(); } }
  }
  const w = VC.bdWait[k].splice(0);
  for (const res of w) res(d || (VC.bd[k] ? VC.bd[k].d : null));
}

/* ----- every frame (loop.js) ----- */
function vcStripText() {   // the HUD strip: this match counts, and for which rank
  const me = vcMine() || VC_FRESH;
  return me.n < QM_PLACING ? `Ranked vs CPU · placement ${me.n + 1} of ${QM_PLACING}` : `Ranked vs CPU · ${tierInfo(me.r).t.name} ${me.r}`;
}
function vcTick() {
  bwTick();   // ui/bossweek.js: a Boss Week result still on its way, the Monday card
  if (!qmOn()) return;
  if (VC.vsT && performance.now() - VC.vsT > 3000 && VC.tk) { const tk = VC.tk; VC.tk = null; vcStart(tk); }
  if (VC.asking && Date.now() - VC.askT > 10000) vcFail("Couldn't reach the server. Try again.");
  // a result sent with no answer: ask for the record (it shows whether the server still waits for it, and sends it again)
  const p = VC.pend;
  if (p && p.sentT && Date.now() - p.sentT > 15000 && QM.authed) { p.sentT = Date.now(); vcFlush(); window.__blQuick.send({ t: "cme" }); }
  const strip = $("vcStrip"), show = mode === "match" && !!match && !!match.vc;
  if (strip.hidden === show) { strip.hidden = !show; if (show) $("vcStripT").textContent = vcStripText(); }
}

/* ----- wiring ----- */
tap("qmV", () => { QM.mode = "v"; VC.note = ""; qmSave(); qmRender(); });
tap("qmToV", () => { QM.mode = "v"; VC.note = ""; qmSave(); qmRender(); });
