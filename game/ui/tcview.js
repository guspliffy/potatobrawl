/* ===================== Cups online: the views (the page logic is ui/tourney.js; styles css/97-tourney.css; markup game/shell.html) =====================
   UI only: nothing here touches the simulation, the bot or the lockstep. ui/tourney.js keeps all state in TC and calls these functions at any
   time, in any mode, so each one checks what it needs and does nothing when it is not there.
   - the menu's Tournament mini (tcvPill): its small line by state, a pulsing "Called!" when a match of yours is ready.
   - the Tournament sheet #scrTc (tcvSheetOpen / tcvSheetClose / tcvSheet): your fighter, then home (Daily Cup, Friends Cup, Practice cup) or the
     lobby you are in (the countdown, the "in" row with CPU seats, share, start, warm up, leave).
   - the online bracket on #scrCup in mode "tcup" (tcvBracket, tcvBracketRender, tcvLines): generalized copies of cup.js's cupSlot / cupGridHTML /
     cupListHTML / cupLines / cupTrophy / cupFootRender for a cup of 4 (2 rounds) or 8 (3 rounds), the same classes so cup.js's styles apply;
     the states of a pair (live, called, walkover, out, on seed), the foot card (call-up with its 60 s ring, waiting, next, out, the end).
   - the call-up banner #tcCall over every other screen (tcvCall) and the results card #rTc (tcvResult).
   - tcvTick (every 250 ms): the clocks, the pill's rotation, the screen wake lock.
   Every top-level name here starts tcv / TCV (all ui parts share one function scope). */
screens.tc = $("scrTc");
const TCV = {
  seed: new Set(),   // bracket positions of round 0 not yet drawn (the seeding reveal)
  pop: "", cheer: false, start: false, timers: [],
  foot: "", sig: "", grid: "", list: "", head: "",   // what the bracket shows now (a redraw with the same markup is skipped)
  un: {},            // pair key -> when its call-up runs out (Date.now() ms), estimated from the server's msLeft
  chips: null,       // the champion's chip count-up { total, t0 }
  me: "", pill: "", call: "", wl: { s: null, req: false, fail: 0 },
};
const TCV_CALL_MS = 60000;
const TCV_GONE = ["quit", "left", "gone", "ff", "quiet", "start", "nostart", "fast"];   // a pair decided because one side left
const TCV_PRIZE = { 8: [[_t("1st"), 120], [_t("2nd"), 60], [_t("3rd"), 30], [_t("5th"), 10]], 4: [[_t("1st"), 60], [_t("2nd"), 30], [_t("3rd"), 10]] };
const TCV_ORD = { 1: _t("1st"), 2: _t("2nd"), 3: _t("3rd"), 5: _t("5th") };

/* ----- small helpers ----- */
const tcvR = (c) => (c && c.size === 8 ? 3 : 2);
const tcvTime = (ms) => new Date(ms).toLocaleTimeString(LOC, { hour: "numeric", minute: "2-digit" });
const tcvMs = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const tcvHms = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const tcvSpec = (id) => FIG[id] || FIGHTERS[0];
const tcvPalOf = (sl) => { const sp = tcvSpec(sl.f); return sp.palettes[sl.pal | 0] || sp.palettes[0]; };
const tcvNm = (sl) => (!sl ? "" : sl.c ? vcCpuName(sl.ni) : String(sl.n || _t("Player")));
const tcvImg = (id) => (PORTRAITS[id] ? `<img src="${PORTRAITS[id]}" alt="">` : "");
const tcvPh = (sl, cls) => `<span class="cs-ph${cls ? " " + cls : ""}" style="--fc:${col(tcvPalOf(sl))}">${tcvImg(sl.f)}</span>`;
const tcvLevel = (sl) => (sl.c ? _t("CPU · {level}", { level: vcWord(sl.r | 0) }) : _t("{tier} {r}", { tier: qmTier(tierInfo(sl.r | 0).t.name), r: sl.r | 0 }));
const tcvSet = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };   // a clock's text: written only when it changed
const tcvDay = (ms) => new Date(ms).toLocaleDateString(LOC, { day: "numeric", month: "short" });
// the next Daily Cup is at the same time tomorrow (shown in this device's time zone)
const tcvTomorrow = () => { const d = TC.day; return d && Number.isFinite(d.at) ? tcvTime(d.at + 864e5) : ""; };
const tcvChName = (ch) => (ch ? (ch.c ? vcCpuName(ch.ni) : String(ch.n || _t("Player"))) : "");
// the sentence under a verdict: res 1 you went through, res 0 you are out (why: the server's word for it)
function tcvSubOf(res, why, nm) {
  if (why === "cpu") why = "game";
  if (res === 1) return { game: _t("You beat {name}.", { name: nm }), wo: _t("{name} didn't tap FIGHT in time.", { name: nm }), draw: _t("A draw: the higher seed goes through."), seed: _t("No result twice: the higher seed goes through.") }[why] || (TCV_GONE.includes(why) ? _t("{name} left the cup.", { name: nm }) : "");
  return { game: _t("{name} beat you.", { name: nm }), draw: _t("A draw: {name} is the higher seed.", { name: nm }), seed: _t("No result twice: {name} is the higher seed.", { name: nm }), ff: _t("You left the match."), wo: _t("You didn't tap FIGHT in time."), gone: _t("Your match had no result in time."),
    fast: _t("The server couldn't check your match."), left: _t("The server couldn't check your match."), quiet: _t("You stopped playing."), start: _t("Your match didn't start in time."), nostart: _t("Your match didn't start in time.") }[why] || "";
}
// your place in a finished cup (the server's number when it came, else worked out from the round you went out in)
function tcvPlace(c) {
  const R = tcvR(c), e = TC.end;
  if (e && e.pl > 0) return e.pl;
  if (c.pl && c.pl.pl > 0) return c.pl.pl;
  if (c.mi >= 0 && c.p[R] && c.p[R][0] === c.mi) return 1;
  if (c.mi >= 0 && c.out >= 0) return (c.size === 8 ? [5, 3, 2] : [3, 2])[c.out] || 0;
  return 0;
}
const tcvChips = (c) => (TC.end && TC.end.c > 0 ? TC.end.c : c.pl && c.pl.c > 0 ? c.pl.c : 0);
// the champion's slot, -1 when there is none
const tcvChamp = (c) => { const R = tcvR(c); return c.p[R] && c.p[R][0] >= 0 ? c.p[R][0] : c.ch >= 0 ? c.ch : -1; };
const tcvOver = (c) => c.st === "done" || !!TC.end;

/* ======================= the menu's Tournament mini ======================= */
// the small line by state, as candidates from the full words to the shortest (the mini is narrow on a phone: the first one that fits is shown)
function tcvPillState() {
  const d = TC.day, k = TC.call;
  if (k && !k.ready) return { t: [_t("Called! Tap to fight"), _t("Called! Fight"), _t("Called!")], call: 1 };
  if (tcPlaying()) { const me = tcMine(), r = me ? tcRoundName(TC.cup.size, me.r) : _t("live"); return { t: [_t("Your cup · {round}", { round: r }), r], live: 1 }; }
  if (!d) return null;
  const at = Number.isFinite(d.at) ? tcvTime(d.at) : "", cn = d.ch ? tcvChName(d.ch) : "", ch = cn ? [_t("Champion: {name}", { name: cn }), cn] : null;
  if (d.st === "open") return { t: d.in ? [_t("You're in · {at}", { at }), _t("You're in")] : [_t("Join now")], live: 1 };
  if (d.st === "run") return { t: [_t("Live now")], live: 1 };
  if (d.st === "pre") {
    const t = d.n > 0 ? [_t("Tonight {at} · {n} in", { at, n: d.n }), _t("{at} · {n} in", { at, n: d.n }), _t("Tonight {at}", { at }), at] : [_t("Tonight {at}", { at }), at];
    return { t: ch && Math.floor(Date.now() / 4000) % 2 ? ch : t };
  }
  if (d.st === "done" && ch) return { t: ch };
  return { t: [_t("Tomorrow {at}", { at: tcvTomorrow() }), tcvTomorrow()] };
}
function tcvPill() {
  const t = $("mTc"), old = $("mCupT"), b = $("bCup"), tt = $("mTcT");
  if (!t || !old || !b) return;
  const s = tcOn() ? tcvPillState() : null;
  if (!s) { old.hidden = false; t.hidden = true; b.classList.remove("tcv-called"); TCV.pill = ""; return; }   // not our server / nothing known yet: the mini as it was
  old.hidden = true; t.hidden = false;
  const key = s.t.join("|");
  if (key !== TCV.pill) { TCV.pill = key; TCV.pillI = 0; }
  tcvSet(tt, s.t[TCV.pillI | 0]);
  while (tt.scrollWidth > tt.clientWidth + 1 && (TCV.pillI | 0) < s.t.length - 1) { TCV.pillI = (TCV.pillI | 0) + 1; tt.textContent = s.t[TCV.pillI]; }   // too wide: the next shorter words
  tt.title = s.t[0];
  t.querySelector(".dot").hidden = !s.live;
  b.classList.toggle("tcv-called", !!s.call);
}
window.addEventListener("resize", () => { TCV.pill = ""; });

/* ======================= the Tournament sheet ======================= */
function tcvSheetOpen() { modal("tc", true); tcvSheet(); }
function tcvSheetClose() { modal("tc", false); }
function tcvHeadKick(d, c, lobby) {
  if (lobby) return c.k === "f" ? _t("Friends Cup · lobby") : _t("Daily Cup · lobby");
  if (!d) return "";
  const at = Number.isFinite(d.at) ? tcvTime(d.at) : "";
  return d.st === "pre" ? _t("Tonight {at}", { at }) : d.st === "open" ? _t("Lobby open") : d.st === "run" ? _t("Live now") : _t("Tomorrow {at}", { at: tcvTomorrow() });
}
function tcvSheet() {
  if (!TC.sheet) return;
  const c = TC.cup, d = TC.day, lobby = tcInLobby(), bracket = !!(c && c.slots && c.mi >= 0), busy = !!TC.busy;
  $("tcvHk").textContent = tcvHeadKick(d, c, lobby);
  // your fighter: your seat's, else the one you would join with
  const src = lobby ? c.ent.find((e) => e.me) : bracket ? c.slots[c.mi] : null;
  const id = src && FIG[src.f] ? src.f : tcFighter(), pi = src && Number.isInteger(src.pal) && FIG[id].palettes[src.pal] ? src.pal : palIdx(id), sig = id + ":" + pi;
  const meB = $("tcvMe"), locked = !!TC.call && !TC.call.ready;
  if (TCV.me !== sig) {
    TCV.me = sig;
    dailyCard(meB, id, pi, pi ? _tv(FIG[id].palettes[pi].name) : _t("You"));
    meB.insertAdjacentHTML("beforeend", '<span class="rd-chg" aria-hidden="true">⇄</span>');
    meB.setAttribute("aria-label", _t("Change fighter. You play {name}", { name: FIG[id].name }));
  }
  meB.disabled = locked;
  tcvSet($("tcvNote"), TC.note || "");
  // your cup, once it has a bracket
  $("tcvYc").hidden = !bracket;
  if (bracket) {
    const over = tcvOver(c), pl = over ? tcvPlace(c) : 0, me = tcMine();
    $("tcvYb").textContent = `${tcKind(c)} · ${c.st === "off" ? _t("closed") : over ? (pl === 1 ? _t("champion") : pl ? _t("finished {place}", { place: TCV_ORD[pl] || pl }) : _t("over")) : c.out >= 0 ? _t("you're out") : me ? tcRoundName(c.size, me.r) : _t("live")}`;
  }
  $("tcvHome").hidden = lobby; $("tcvLobby").hidden = !lobby;
  if (lobby) tcvLobby(c, busy); else tcvHome(d, busy);
  tcvSheetClock();
}
// the home: the Daily Cup card by the day's state, the Friends Cup card, the Practice cup
function tcvHome(d, busy) {
  const md = $("tcvMedal");
  if (!md.firstChild) md.innerHTML = TROPHY.replace("%C", "won").replace(/%G/g, "tcvGm");
  const go = $("tcvDGo"), dl = $("tcvDl"), dn = $("tcvDn"), cd = $("tcvCd"), at = d && Number.isFinite(d.at) ? tcvTime(d.at) : "", tom = tcvTomorrow();
  const set = (kick, line, note, btn, cls) => {
    $("tcvDk").textContent = kick; dl.textContent = line; dn.textContent = note;
    go.hidden = !btn; go.className = "btn tcv-ink" + (cls ? " " + cls : "");
    if (btn) $("tcvDGoT").textContent = btn;
  };
  cd.classList.remove("txt", "live");
  const miss = d && d.miss ? _t("You weren't here at {at}.", { at }) : "";
  if (!d) {
    cd.textContent = "--:--:--"; set(_t("Daily Cup"), _t("Checking tonight's cup…"), "", "", "");
  } else if (d.st === "pre") {
    const n = d.n | 0, ch = d.ch ? ` · ${_t("Champion: {name}", { name: tcvChName(d.ch) })}` : "";
    set(_t("Daily Cup · {at}", { at }), `${n > 1 || (n === 1 && !d.me) ? _t("{n} in tonight", { n }) : n === 1 ? _t("You're in tonight") : _t("Be the first in tonight")}${ch}`,
      _t("Lobby opens {at}", { at: Number.isFinite(d.at) ? tcvTime(d.at - 30 * 60000) : "" }), d.me ? _t("You're in ✓") : _t("I'm in"), d.me ? "on" : "primary");
  } else if (d.st === "open") {
    const n = d.ent | 0;
    set(_t("Daily Cup · {at}", { at }), n > 0 ? _t("{n} in the lobby · the bracket is drawn at {at}", { n, at }) : _t("The lobby is open · the bracket is drawn at {at}", { at }), d.in ? _t("You're in. Join the lobby to stay.") : _t("Join now: a roll call at {at}, then the bracket.", { at }), _t("Join"), "primary");
  } else if (d.st === "run") {
    cd.classList.add("live"); cd.textContent = _t("LIVE");
    set(_t("Daily Cup · live"), _t("{n} playing now", { n: d.ent | 0 }), d.in ? "" : _t("Next cup tomorrow {at}", { at: tom }), d.in ? _t("Bracket") : "", "primary");
  } else if (d.st === "done") {
    cd.classList.add("txt"); cd.textContent = d.ch ? tcvChName(d.ch) : _t("Done");
    set(_t("Daily Cup · champion"), _t("Next cup tomorrow {at}", { at: tom }), "", "", "");
  } else {
    cd.classList.add("txt"); cd.textContent = _t("No cup");
    set(_t("Daily Cup · not tonight"), _t("Not enough players tonight · tomorrow {at}", { at: tom }), "", "", "");
  }
  if (d && (d.st === "run" || d.st === "done" || d.st === "off") && miss) dn.textContent = miss;
  go.disabled = busy;
  $("tcvHost").disabled = busy; $("tcvJoinC").disabled = busy;
  $("tcvPGoT").textContent = cupOk(P.cup) ? _t("Resume") : _t("Play");
  $("tcvPrz").innerHTML = tcvPrizes(d);
  $("tcvPrz").hidden = !d || d.st === "done" || d.st === "off";
}
function tcvPrizes(d) {
  const row = (n) => TCV_PRIZE[n].map(([p, v]) => `<span class="bw-st cg tcv-pz">${p} ${v}</span>`).join("");
  return `<span class="tcv-pt8">${row(8)}</span><small class="tcv-p4">${_t("a cup of 4 pays {prizes}", { prizes: TCV_PRIZE[4].map((x) => x[1]).join(" · ") })}</small>`;
}
// the lobby you are in
function tcvLobby(c, busy) {
  const daily = c.k !== "f", ent = c.ent || [], n = ent.length, host = !!c.host, at = Number.isFinite(c.at) ? c.at : TC.day ? TC.day.at : NaN, hhmm = Number.isFinite(at) ? tcvTime(at) : "";
  $("tcvLk").textContent = daily ? _t("Daily Cup · {at}", { at: hhmm }) : _t("Friends Cup");
  const cd = $("tcvLCd"), ll = $("tcvLl"), ln = $("tcvLn");
  cd.classList.toggle("code", !daily);
  if (!daily) { cd.textContent = c.code || ""; cd.setAttribute("aria-label", _t("Code {code}", { code: c.code || "" })); } else cd.removeAttribute("aria-label");
  ll.textContent = daily ? _t("Keep this screen on. A roll call at {at}, then the bracket is drawn.", { at: hhmm })
    : host ? _t("Share the link or the code. Start when everyone is in.") : _t("Waiting for the host to start the cup.");
  ln.textContent = daily ? _t("CPUs fill the empty seats.") : host && n < 2 ? _t("A cup needs 2 players.") : host ? _t("CPUs fill the empty seats.") : "";
  $("tcvLPrz").innerHTML = daily ? tcvPrizes() : ""; $("tcvLPrz").hidden = !daily;
  $("tcvShare").hidden = daily;
  const st = $("tcvStart"); st.hidden = daily || !host; st.disabled = busy || n < 2;
  // the "in" row: framed faces, CPU seats as "?" up to 4 or 8, "+N" when more than 8 are in
  const seats = n <= 4 ? 4 : 8, show = n > 8 ? 7 : n;
  let h = "";
  for (let i = 0; i < show; i++) {
    const e = ent[i], sl = { f: e.f, pal: e.pal };
    h += `<span class="tcv-seat${e.me ? " me" : ""}${e.h ? " host" : ""}" style="--fc:${col(tcvPalOf(sl))}" title="${cupEsc(e.n || "")}"><span class="tcv-sp">${tcvImg(FIG[e.f] ? e.f : tcvSpec(e.f).id)}</span><b>${cupEsc(e.me ? _t("You") : e.n || _t("Player"))}</b>${e.h ? `<i class="tcv-hs">${_t("Host")}</i>` : ""}</span>`;
  }
  if (n > 8) h += `<span class="tcv-seat more"><span class="tcv-sp q">+${n - 7}</span><b>${_t("more")}</b></span>`;
  else for (let i = n; i < seats; i++) h += `<span class="tcv-seat cpu"><span class="tcv-sp q">?</span><b>${_t("CPU")}</b></span>`;
  $("tcvSeats").innerHTML = h;
  $("tcvSeats").classList.toggle("s4", seats === 4 && n <= 4);
  const cpus = n <= 8 ? seats - n : 0;
  $("tcvLInN").textContent = `${_t("{n} player|{n} players", { n })}${cpus ? ` · ${_t("{n} CPU", { n: cpus })}` : ""}`;
  $("tcvWarm").disabled = busy; $("tcvLeave").disabled = busy;
}
// the countdowns on the sheet (called by tcvSheet and every tick)
function tcvSheetClock() {
  if (!TC.sheet) return;
  const c = TC.cup, d = TC.day, now = tcNow();
  if (tcInLobby()) {
    if (c.k !== "f") { const at = Number.isFinite(c.at) ? c.at : d ? d.at : NaN; const cd = $("tcvLCd"); cd.classList.toggle("txt", !(at > now)); tcvSet(cd, at > now ? tcvHms(at - now) : _t("Starting…")); }
  } else if (d && (d.st === "pre" || d.st === "open") && Number.isFinite(d.at)) {
    const cd = $("tcvCd"); cd.classList.toggle("txt", !(d.at > now)); tcvSet(cd, d.at > now ? tcvHms(d.at - now) : _t("Starting…"));
  }
}

/* ======================= the online bracket ======================= */
// one slot of the bracket: (r, pos) is the winner of pair pos of the round before, like cup.js's cupSlot, with the online states of its pair
function tcvSlot(c, r, pos) {
  const key = r + ":" + pos, R = tcvR(c), draw = TCV.seed.size > 0 && (r > 0 || TCV.seed.has(pos)), s = draw ? -1 : c.p[r][pos];
  const tbd = (n, t) => `<div class="cs tbd" data-k="${key}"><span class="cs-ph q">?</span><span class="cs-t"><span class="cs-n">${n}</span><span class="cs-r">${t}</span></span></div>`;
  if (s === -2) return `<div class="cs none" data-k="${key}"><span class="cs-ph q">&mdash;</span><span class="cs-t"><span class="cs-n">${_t("No one")}</span><span class="cs-r">${_t("nobody came through")}</span></span></div>`;
  const sl = s >= 0 ? c.slots[s] : null;
  if (!sl) return r === 0 && draw ? tbd(_t("Seeding"), "&hellip;") : tbd(_t("Winner"), _t("to be decided"));
  const me = s === c.mi, cpu = !!sl.c, pk = r + ":" + (pos >> 1), m = c.m && c.m[pk], st = m ? m[0] : "w", why = m ? m[1] : "";
  const nx = c.p[r + 1], dec = nx ? nx[pos >> 1] : -1, out = dec >= 0 && dec !== s, champ = dec === s && r === R - 1;
  const w = (t, extra) => `<span class="cs-tn tcv-w${extra || ""}">${t}</span>`;
  const ti = tierInfo(sl.r | 0);
  let sub = cpu ? `<span class="cs-tn">${_t("CPU · {level}", { level: vcWord(sl.r | 0) })}</span>` : `${tierBadge(ti.i, "cs-b")}<span class="cs-tn">${qmTier(ti.t.name)}</span><span class="cs-rn">${sl.r | 0}</span>`;
  const cls = ["cs", me ? "me" : "", cpu ? "cpu" : "", me && !out && dec !== -2 ? "path" : "", champ ? "champ" : "", TCV.pop === key ? "pop" : ""];
  const run = c.st === "run";   // a cup that is over or closed shows no pair as live or called
  if (run && dec === -1 && st === "l") cls.push("live");
  else if (run && dec === -1 && st === "c") {
    cls.push("wait");
    if (m[3] && m[3][pos & 1]) sub = w(_t("ready"), " rd");
    else {
      const est = Date.now() + (m[2] | 0), prev = TCV.un[pk], u = prev !== undefined && Math.abs(prev - est) < 2500 ? prev : est;
      TCV.un[pk] = u;
      const cl = _t("called · {t}", { t: "\u0001" }).split("\u0001");   // the text around the clock, which tcvClocks puts between data-p and data-s
      sub = `<span class="cs-tn tcv-w" data-u="${u}" data-p="${cupEsc(cl[0])}" data-s="${cupEsc(cl[1] || "")}"></span>`;
    }
  } else if (dec === -2) { cls.push("gone"); sub = w(_t("out")); }
  else if (out) {
    if (me) cls.push("fell"); else if (why !== "wo" && !TCV_GONE.includes(why)) cls.push("out");
    if (why === "wo") { cls.push("wo"); sub = w(_t("walkover")); }
    else if (TCV_GONE.includes(why)) { cls.push("gone"); sub = w(_t("out")); }
    else if (why === "draw" || why === "seed") sub = w(_t("on seed"));
  }
  const tag = me ? `<i class="tcv-tg">${_t("You")}</i>` : cpu ? `<i class="tcv-tg">${_t("CPU")}</i>` : "";
  return `<div class="${cls.filter(Boolean).join(" ")}" data-k="${key}" style="--fc:${me ? "var(--me)" : col(tcvPalOf(sl))}"><span class="cs-ph">${tcvImg(sl.f)}</span>` +
    `<span class="cs-t"><span class="cs-n">${cupEsc(tcvNm(sl))}</span><span class="cs-r">${sub}</span></span>${tag}</div>`;
}
function tcvTrophy(c, gid) {
  const ch = tcvChamp(c), champ = ch >= 0 && TCV.seed.size === 0;
  let h = TROPHY.replace("%C", champ && ch === c.mi ? "won" : champ ? "" : "live").replace(/%G/g, gid);
  if (TCV.cheer) {
    h += '<div class="spark">';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.2, rr = 50 + (i % 3) * 22; h += `<i style="--x:${Math.round(Math.cos(a) * rr)}px;--y:${Math.round(Math.sin(a) * rr * 0.8)}px;--d:${(i % 4) * 90}"></i>`; }
    h += "</div>";
  }
  return h;
}
// the round you are in now (-1 when the cup is over for you)
function tcvNow(c) { const me = tcMine(); return c.st === "run" && c.out < 0 && me ? me.r : -1; }
function tcvGridHTML(c) {
  const R = tcvR(c), n = c.size, now = tcvNow(c);
  const colm = (cls, r, from, cnt) => `<div class="cc ${cls}">${Array.from({ length: cnt }, (_, k) => tcvSlot(c, r, from + k)).join("")}</div>`;
  const lab = (r) => `<div class="cc-l${now === r ? " now" : ""}">${tcRoundName(n, r)}</div>`;
  const fin = `<div class="cc fin">${tcvSlot(c, R - 1, 0)}${tcvTrophy(c, "tcvGg")}${tcvSlot(c, R - 1, 1)}</div>`;
  if (R === 3) return lab(0) + lab(1) + lab(2) + lab(1) + lab(0) + colm("q", 0, 0, 4) + colm("s", 1, 0, 2) + fin + colm("s rt", 1, 2, 2) + colm("q rt", 0, 4, 4) + '<svg class="cup-lines"></svg>';
  return lab(0) + lab(1) + lab(0) + colm("s", 0, 0, 2) + fin + colm("s rt", 0, 2, 2) + '<i class="tcv-g4" hidden></i><svg class="cup-lines"></svg>';
}
function tcvListHTML(c) {
  const R = tcvR(c), n = c.size;
  let h = "";
  for (let r = 0; r < R; r++) {
    h += `<div class="kicker cl-h">${r < R - 1 ? (n === 8 && r === 0 ? _t("Quarter-finals") : _t("Semi-finals")) : tcRoundName(n, r)}</div>`;
    for (let i = 0; i < n >> (r + 1); i++) {
      const m = c.m && c.m[r + ":" + i], live = c.st === "run" && m && m[0] === "l" && !(c.p[r + 1] && c.p[r + 1][i] !== -1);
      h += `<div class="cl-m${live ? " live" : ""}">${tcvSlot(c, r, 2 * i)}${tcvSlot(c, r, 2 * i + 1)}</div>`;
    }
  }
  return h + `<div class="cl-cup">${tcvTrophy(c, "tcvGl")}</div>`;
}
// bracket lines: each pair joins into the slot its winner goes to; your own path is lit; a live pair has a LIVE dot where it joins
function tcvLines() {
  const c = TC.cup, grid = $("cupGrid");
  if (!c || !c.slots || mode !== "tcup" || !grid) return;
  const svg = grid.querySelector(".cup-lines"), W = grid.offsetWidth, H = grid.offsetHeight;
  if (!svg || !W) return;
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const at = (r, pos) => {
    const el = grid.querySelector(`[data-k="${r}:${pos}"]`);
    if (!el) return null;
    let x = 0, y = 0, e = el;   // offset*, not getBoundingClientRect, so a turned (sideways) screen measures right too
    while (e && e !== grid) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { l: x, r: x + el.offsetWidth, y: y + el.offsetHeight / 2 };
  };
  const R = tcvR(c), n = c.size, dim = [], lit = [], dots = [], drawn = TCV.seed.size > 0;
  for (let r = 0; r < R - 1; r++) for (let i = 0; i < n >> (r + 1); i++) {
    const left = i < (n >> (r + 2)), dst = at(r + 1, i);
    for (const pos of [2 * i, 2 * i + 1]) {
      const src = at(r, pos);
      if (!src || !dst) continue;
      const x0 = left ? src.r : src.l, x1 = left ? dst.l : dst.r, xm = Math.round((x0 + x1) / 2);
      (!drawn && c.p[r][pos] === c.mi && c.p[r + 1][i] === c.mi ? lit : dim).push(`M${x0} ${src.y}H${xm}V${dst.y}H${x1}`);
      if (pos === 2 * i) { const m = c.m && c.m[r + ":" + i]; if (m && m[0] === "l" && c.st === "run" && !drawn && c.p[r + 1][i] === -1) dots.push(`<circle class="tcv-ld" cx="${xm}" cy="${Math.round(dst.y)}" r="5.5"/>`); }
    }
  }
  svg.innerHTML = [...dim.map((d) => `<path d="${d}"/>`), ...lit.map((d) => `<path class="lit" d="${d}"/>`), ...dots].join("");
}
function tcvHeadRender(c) {
  const R = tcvR(c), ch = tcvChamp(c);
  const kick = c.k === "f" ? _t("Friends Cup · {code}", { code: c.code || "" }) : _t("Daily Cup · {date}", { date: tcvDay(Number.isFinite(c.at) ? c.at : TC.day && Number.isFinite(TC.day.at) ? TC.day.at : Date.now()) });
  let title;
  if (c.st === "off") title = _t("Cup closed");
  else if (tcvOver(c)) title = ch >= 0 && ch === c.mi ? _t("Champion") : _t("Cup over");
  else if (c.out >= 0) title = _t("Cup over");
  else { const me = tcMine(); title = me ? tcRoundName(c.size, me.r) : _t("Live"); }
  tcvSet($("cupKick"), kick); tcvSet($("cupTitle"), title); tcvSet($("cupTokens"), fmtChips(P.tokens));
}
function tcvGridRender(c) {
  const g = tcvGridHTML(c), l = tcvListHTML(c), grid = $("cupGrid"), list = $("cupList");
  let moved = false;
  if (g !== TCV.grid || !grid.querySelector(".cup-lines")) { TCV.grid = g; grid.innerHTML = g; moved = true; }
  if (l !== TCV.list) { TCV.list = l; list.innerHTML = l; }
  if (moved) tcvLines();
}

/* the strip under the bracket: your call-up (the 60 s ring), the wait, what is next, you are out, the end of the cup, a cup that was closed */
function tcvFoot(c) {
  const btn = (id, label, cls) => `<button class="btn${cls ? " " + cls : ""}" id="${id}"><span>${label}</span></button>`;
  const kind = tcKind(c), R = tcvR(c), me = tcMine(), k = TC.call && TC.call.id === c.id ? TC.call : null, tom = tcvTomorrow();
  const t = (kick, big, small, extra) => `<div class="cf-t">${kick ? `<span class="kicker">${kick}</span>` : ""}<b>${big}</b>${small ? `<small${extra || ""}>${small}</small>` : ""}</div>`;
  const menu = btn("tcvFMenu", _t("Menu"));
  const res = (cls, sig, html) => ({ cls: "cf" + (cls ? " " + cls : ""), sig, html });
  const over = tcvOver(c);
  if (c.st === "off" && !TC.end) {
    const why = c.why, few = why === "few" || why === "none" || why === "late";
    const words = why === "host" ? _t("The host closed this cup.") : why === "idle" ? _t("Nobody started this cup.") : few ? `${_t("Not enough players came.")}${c.k !== "f" && tom ? ` ${_t("Tomorrow {at}.", { at: tom })}` : ""}` : _t("This cup was closed.");
    return res("lose", "off:" + why, `${t("", _t("Cup closed"), cupEsc(words))}<div class="cf-acts tcv-a">${menu}</div>`);
  }
  if (over && c.mi >= 0) {
    const pl = tcvPlace(c), ch = tcvChamp(c), chips = tcvChips(c), daily = c.k !== "f", e = TC.end;
    const name = e && e.ch === null ? "" : ch >= 0 ? tcvNm(c.slots[ch]) : e && e.ch ? e.ch : e && e.ch === "" ? vcCpuName(e.chc | 0) : "";
    const won = pl === 1 || (ch >= 0 && ch === c.mi);
    if (won) {
      const now = TCV.chips ? Math.round(TCV.chips.total * clamp((performance.now() - TCV.chips.t0) / 1200, 0, 1)) : chips;
      const small = daily ? _t("{chips} chips from this cup", { chips: `<span class="cf-chips"><span class="tokglyph"></span>+<span id="tcvChipsN">${Math.min(now, chips)}</span></span>` }) : e && e.fw > 0 ? _t("{n} Friends Cup won|{n} Friends Cups won", { n: e.fw }) : _t("A Friends Cup won");
      const acts = daily ? `<button class="btn tcv-mute" disabled><span>${_t("Tomorrow {at}", { at: cupEsc(tom) })}</span></button>${menu}` : `${btn("tcvFHost", _t("Host another"), "primary")}${menu}`;
      return res("win", "won:" + pl, `${t("", _t("Champion!"), small)}<div class="cf-acts tcv-a">${acts}</div>`);
    }
    const word = pl ? _t("You finished {place}", { place: TCV_ORD[pl] || _t("{n}th", { n: pl }) }) : _t("The cup is over");
    const small = e && e.ch === null ? _t("No champion: the cup timed out.") : `${daily && chips > 0 ? `${_t("+{n} chips", { n: chips })} · ` : ""}${name ? _t("{name} won the cup.", { name: cupEsc(name) }) : ""}`;
    return res("", "end:" + pl, `${t("", word, small)}<div class="cf-acts tcv-a">${menu}</div>`);
  }
  if (c.out >= 0 && c.mi >= 0) {   // out, the cup goes on without you
    const at = c.p[c.out].indexOf(c.mi), key = c.out + ":" + (at >> 1), m = c.m && c.m[key], rs = Object.values(TC.res || {}).find((x) => x && x.r === c.out && x.res === 0);
    const opp = c.slots[c.p[c.out][at ^ 1]], words = tcvSubOf(0, rs ? rs.why : m ? m[1] : "game", opp ? tcvNm(opp) : _t("They"));
    return res("lose", "out:" + c.out, `${t("", tcOutIn(c.size, c.out), cupEsc(`${words} ${_t("The cup goes on.")}`.trim()))}<div class="cf-acts tcv-a">${menu}</div>`);
  }
  const rn = me ? tcRoundName(c.size, me.r) : "";
  const o = k && (k.opp || (me && me.opp >= 0 ? c.slots[me.opp] : null));
  if (k && me && !k.ready) {   // called: FIGHT in its ring
    return res("tcv-called", "call:" + k.key, `${o ? tcvPh(o) : ""}${t(`${rn} · ${kind}`, o ? _t("vs {name}", { name: cupEsc(tcvNm(o)) }) : _t("Your match"), o ? cupEsc(tcvLevel(o)) : "")}` +
      `<div class="cf-acts tcv-a"><span class="tcv-ring" id="tcvFRing"><button class="btn primary" id="tcGo"><span>${_t("Fight")}<small id="tcGoT"></small></span></button></span></div>`);
  }
  if (k && me && k.ready) {   // you tapped FIGHT: waiting for them
    const cpu = o && o.c, name = o ? tcvNm(o) : _t("your opponent"), cl = _t("Waiting for {name} to tap FIGHT · {t}", { name, t: "\u0001" }).split("\u0001");   // the text around the clock (tcvClocks)
    return res("tcv-called", "rdy:" + k.key, `${o ? tcvPh(o) : ""}${t(`${rn} · ${kind}`, _t("You're ready"), cpu ? _t("Starting…") : "…", cpu ? "" : ` id="tcvWt" data-u="${k.until}" data-p="${cupEsc(cl[0])}" data-s="${cupEsc(cl[1] || "")}"`)}`);
  }
  if (me && me.s === "l") return res("", "live:" + me.key, t(`${rn} · ${kind}`, _t("Your match is on"), _t("Waiting for the result…")));
  if (me) {   // your next match, not called yet
    const opp = me.opp >= 0 ? c.slots[me.opp] : null;
    let small;
    if (opp) small = `${_t("vs {name}", { name: cupEsc(tcvNm(opp)) })} · ${cupEsc(tcvLevel(opp))}`;
    else {
      const at = c.p[me.r].indexOf(c.mi) ^ 1, a = me.r > 0 ? c.slots[c.p[me.r - 1][2 * at]] : null, b = me.r > 0 ? c.slots[c.p[me.r - 1][2 * at + 1]] : null;
      small = a && b ? _t("vs the winner of {a} / {b}", { a: cupEsc(tcvNm(a)), b: cupEsc(tcvNm(b)) }) : _t("vs the winner of the other match");
    }
    return res("", "next:" + me.key + ":" + me.opp, `${opp ? tcvPh(opp) : '<span class="cs-ph q">?</span>'}${t(kind, _t("Next: {round}", { round: rn }), small)}` +
      `<div class="cf-acts tcv-a"><button class="btn tcv-sw" id="tcvFPick" aria-label="${_t("Change fighter")}"><span aria-hidden="true">⇄</span></button>${btn("tcvFWarm", _t("Warm up vs CPU"))}</div>`);
  }
  return res("", "wait", t(kind, _t("Waiting"), _t("The next round starts soon.")));
}
function tcvFootIn() { const f = $("cupFoot"); f.classList.remove("in"); void f.offsetWidth; f.classList.add("in"); }
function tcvFootRender() {
  const c = TC.cup, card = $("cupCard");
  if (!c || !c.slots) return;
  const f = tcvFoot(c);
  if (f.html !== TCV.foot) { TCV.foot = f.html; card.className = f.cls; card.innerHTML = f.html; tcvClocks(); }
  if (f.sig !== TCV.sig) { TCV.sig = f.sig; if (!TCV.start) tcvFootIn(); }   // a new state slides in (the call-up too)
}
function tcvBracketRender() {
  const c = TC.cup;
  if (mode !== "tcup" || !c || !c.slots) return;
  tcvHeadRender(c); tcvGridRender(c); tcvFootRender();
}
// Show the bracket (mode "tcup" and show("cup") are done). o.start: the seeding reveal; o.after: key of the match you just played; o.cheer: the champion moment
function tcvBracket(o) {
  o = o || {};
  const c = TC.cup;
  if (!c || !c.slots) return;
  TCV.timers.forEach(clearTimeout); TCV.timers = [];
  const later = (ms, fn) => TCV.timers.push(setTimeout(() => { if (mode === "tcup") fn(); }, ms));
  const mine = c.mi >= 0 ? c.slots[c.mi] : null, pal = mine ? tcvPalOf(mine) : null;
  $("scrCup").style.setProperty("--me", pal ? col(pal) : "var(--sand)"); $("scrCup").style.setProperty("--meg", pal ? rgba(col(pal), 0.4) : "rgba(243,217,164,0.4)");
  TCV.un = {}; TCV.chips = null; TCV.cheer = false; TCV.pop = ""; TCV.seed = new Set(); TCV.start = !!o.start; TCV.foot = ""; TCV.sig = ""; TCV.grid = ""; TCV.list = "";
  $("cupFoot").classList.remove("in");
  if (o.after && /^\d+:\d+$/.test(o.after)) {   // you won it: your new slot pops in
    const [r, i] = o.after.split(":").map(Number);
    if (c.p[r + 1] && c.p[r + 1][i] === c.mi) { TCV.pop = (r + 1) + ":" + i; Sfx.later(0, () => Sfx.tone(660, 990, 0.12, "triangle", 0.07)); later(900, () => { TCV.pop = ""; const e = document.querySelector(".cs.pop"); if (e) e.classList.remove("pop"); }); }
  }
  let ready = 0;
  if (o.cheer) TCV.chips = { total: tcvChips(c), t0: performance.now() + 1e6 };   // the foot card shows 0 until the count-up starts
  if (o.start) {   // the draw: every slot of round 0 ticks in, in seed order
    const order = Array.from({ length: c.size }, (_, p) => p).sort((a, b) => ((c.slots[c.p[0][a]] || {}).sd || a + 1) - ((c.slots[c.p[0][b]] || {}).sd || b + 1));
    TCV.seed = new Set(order);
    const gap = clamp(Math.round(1100 / c.size), 90, 260);
    order.forEach((pos, n) => later(350 + n * gap, () => { TCV.seed.delete(pos); tcvBracketRender(); Sfx.later(0, () => Sfx.tone(520 + n * 40, 520 + n * 40, 0.05, "triangle", 0.05)); }));
    ready = 350 + order.length * gap + 250;
  }
  tcvBracketRender();
  later(ready, () => { TCV.start = false; TCV.sig = ""; tcvFootRender(); if (!$("cupFoot").classList.contains("in")) tcvFootIn(); });
  if (o.cheer) {   // the champion: trophy, sparks, the jingle, the chips count up
    later(ready + 300, () => {
      TCV.cheer = true; tcvBracketRender(); cupJingle();
      const total = tcvChips(TC.cup || c), t0 = performance.now();
      TCV.chips = { total, t0 };
      tcvFootRender();
      const count = () => {
        const n = $("tcvChipsN");
        if (!n || mode !== "tcup" || !TCV.chips) return;
        const k = Math.min(1, (performance.now() - t0) / 1200);
        n.textContent = Math.round(total * k);
        if (k < 1) requestAnimationFrame(count); else { TCV.chips = null; if (total > 0) Sfx.uiCoin(); }
      };
      count();
    });
  } else if (c.st === "done" && mine && c.out >= 0) later(ready + 300, () => Sfx.later(0, () => Sfx.tone(300, 110, 0.4, "sawtooth", 0.07)));
}

/* ======================= the call-up banner ======================= */
function tcvCall() {
  const el = $("tcCall"), k = TC.call, c = TC.cup;
  const show = tcOn() && !!k && !k.ready && !!c && c.id === k.id && mode !== "tcup" && !(QM.vsT > 0) && !(VC.vsT > 0);
  if (!show) { if (!el.hidden) { el.hidden = true; el.classList.remove("in"); } TCV.call = ""; return; }
  const sig = k.id + ":" + k.key + ":" + (c.size || 0);   // (a call-up can come before the bracket's first view: the round's name follows it)
  const o = k.opp || (c.slots && c.slots[tcMine() ? tcMine().opp : -1]) || null;
  if (TCV.call !== sig) {
    TCV.call = sig;
    const ph = $("tccPh"); ph.style.setProperty("--fc", o ? col(tcvPalOf(o)) : "var(--mute)"); ph.innerHTML = o ? tcvImg(o.f) : "";
    $("tccK").textContent = `${tcKind(c)} · ${tcRoundName(c.size || 8, k.r)}`;
    $("tccN").textContent = o ? _t("vs {name}", { name: tcvNm(o) }) : _t("Your match is ready");
    $("tccS").textContent = o ? tcvLevel(o) : "";
  }
  const busy = tcBusy();
  tcvSet($("tccBusy"), busy); $("tccBusy").hidden = !busy;
  if (el.hidden) { el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); }
  tcvClocks();
}

/* ======================= the results card ======================= */
function tcvResult(R, res) {
  const card = $("rTc"), tm = R && (R.tc || (R.qm && R.qm.tm));
  if (!card || !tm) return;
  card.hidden = false;
  const c = TC.cup, size = c ? c.size : tm.size || 8, Rn = size === 8 ? 3 : 2, r = tm.r | 0, cpu = !!R.tc;
  const nm = cpu ? vcCpuName(R.tk ? R.tk.ni : 0) : (R.qm.opp && R.qm.opp.name) || NET.oppName || _t("Your opponent");
  const head = $("rTcH"), sub = $("rTcS"), st = $("rTcD"), sheet = $("resSheet");
  const look = (k) => { sheet.classList.remove("win", "loss", "draw"); sheet.classList.add(k); };
  const sticker = (cls, n, small) => { st.className = "delta " + cls; $("rTcN").textContent = n; $("rTcL").textContent = small; };
  card.style.setProperty("--k", Rn);
  if (!res) {
    card.className = "card res-tc wait"; card.style.setProperty("--p", r / Rn);
    head.textContent = cpu ? _t("Checking your match…") : _t("Waiting for the result…");
    sub.textContent = `${tcKind(c)} · ${tcRoundName(size, r)}`;
    sticker("wait", "…", _t("Confirming"));
    return;
  }
  const won = res.res === 1, last = r >= Rn - 1;
  card.className = "card res-tc " + (won ? "up" : "down"); card.style.setProperty("--p", (r + (won ? 1 : 0)) / Rn);
  head.textContent = won ? (last ? _t("Champion!") : tcThrough(size, r)) : tcOutIn(size, r);
  sub.textContent = tcvSubOf(won ? 1 : 0, res.why, nm);
  sticker(won ? "" : "down", won ? (last ? "★︎" : "✓︎") : "✕︎", won ? (last ? _t("Champion") : _t("Through")) : _t("Out"));
  // the server's result differs from this phone's, or it was decided by a walkover or a draw: the big word follows it
  const why = res.why === "cpu" ? "game" : res.why;
  if (res.res !== R.res || why !== "game") {
    if (why === "game") { resTitle(won ? _t("Victory") : _t("Defeat")); look(won ? "win" : "loss"); resLine($("rSub"), [won ? _t("The server's result: you won.") : _t("The server's result: you lost.")]); }
    else if (why === "draw" || why === "seed") { resTitle(won ? _t("Through") : _t("Out")); look(won ? "win" : "loss"); resLine($("rSub"), [tcvSubOf(won ? 1 : 0, why, nm)]); }
    else if (won) { resTitle(_t("Opponent left")); look("win"); $("rSub").innerHTML = why === "wo" ? _t("<b>{who}</b> didn't tap FIGHT in time.", { who: cupEsc(nm) }) : _t("<b>{who}</b> left the cup. It counts as your win.", { who: cupEsc(nm) }); }   // the name goes in escaped, as the text node it was
    else { resTitle(why === "ff" ? _t("Forfeit") : _t("Out")); look("loss"); resLine($("rSub"), [tcvSubOf(0, why, nm)]); }
  }
}

/* ======================= the clocks (every 250 ms) ======================= */
// the call-up rings and the countdowns on the bracket
function tcvClocks() {
  const now = Date.now(), k = TC.call;
  if (mode === "tcup") {
    for (const el of document.querySelectorAll("#scrCup [data-u]")) tcvSet(el, (el.dataset.p || "") + tcvMs(+el.dataset.u - now) + (el.dataset.s || ""));
  }
  if (k && !k.ready) {
    const left = k.until - now, p = Math.max(0, Math.min(1, left / TCV_CALL_MS));
    const ring = (id, tid) => { const r = $(id), t = $(tid); if (r) { r.style.setProperty("--p", p.toFixed(3)); r.classList.toggle("low", left < 15000); } tcvSet(t, tcvMs(left)); };
    if (!$("tcCall").hidden) ring("tccRing", "tccT");
    if (mode === "tcup") ring("tcvFRing", "tcGoT");
  }
}
function tcvTick() {
  tcvClocks();
  if (TC.sheet) tcvSheetClock();
  if (mode === "menu") tcvPill();
  if (mode === "tcup") tcvSet($("cupTokens"), fmtChips(P.tokens));   // the prize arrives with the next sync
  tcvWake();
}

/* ----- the screen stays on in the lobby, on the bracket and while you are called (a locked phone drops the connection) ----- */
const tcvWant = () => tcOn() && (mode === "tcup" || (TC.sheet && tcInLobby()) || !!TC.call);
function tcvWake() {
  const W = TCV.wl, want = tcvWant();
  if (!("wakeLock" in navigator)) return;
  if (!want) { if (W.s) { const s = W.s; W.s = null; try { s.release().catch(() => {}); } catch (e) { /* already released */ } } return; }
  if (W.s || W.req || document.visibilityState !== "visible" || Date.now() - W.fail < 15000) return;
  W.req = true;
  let p;
  try { p = navigator.wakeLock.request("screen"); } catch (e) { W.req = false; W.fail = Date.now(); return; }
  p.then((s) => {
    W.req = false;
    if (!tcvWant()) { try { s.release().catch(() => {}); } catch (e) { /* ignore */ } return; }
    W.s = s;
    s.addEventListener("release", () => { if (W.s === s) W.s = null; });
  }, () => { W.req = false; W.fail = Date.now(); });
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { TCV.wl.fail = 0; tcvWake(); } });

/* ======================= wiring ======================= */
tap("tcClose", () => tcClose());
tap("tcvMe", () => tcPick());
tap("tcvYGo", () => tcBracket());
tap("tcvDGo", () => {
  const d = TC.day;
  if (!d) return;
  if (d.st === "pre") tcIn(!d.me); else if (d.st === "open") tcJoin(); else if (d.st === "run" && d.in) tcBracket();
});
tap("tcvHost", () => tcHost());
tap("tcvPGo", () => { tcClose(); cupOpen(); });
tap("tcvShare", () => tcShare());
tap("tcvStart", () => tcStart());
tap("tcvWarm", () => tcWarm());
tap("tcvLeave", () => tcLeave());
$("tcvCf").addEventListener("submit", (e) => { e.preventDefault(); Sfx.init(); Sfx.ui(); tcJoinCode($("tcvCode").value); });
$("tcvCode").addEventListener("input", (e) => { const v = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""); if (v !== e.target.value) e.target.value = v; });
screens.tc.addEventListener("click", (e) => { if (e.target === screens.tc) tcClose(); });
window.addEventListener("keydown", (e) => { if (e.code === "Escape" && TC.sheet) { e.preventDefault(); tcClose(); } });
// the foot card's buttons are redrawn with it: one listener on the strip
$("cupCard").addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("button");
  if (!b || b.disabled || mode !== "tcup") return;
  const id = b.id, f = { tcGo: tcFight, tcvFPick: tcPick, tcvFWarm: tcWarm, tcvFMenu: tcBack, tcvFHost: tcHost }[id];
  if (!f) return;
  Sfx.init(); Sfx.cue(b); f();
});
// the call-up banner's FIGHT
tap("tccGo", () => tcFight());
window.__blTcV = { result: tcvResult, pill: tcvPill, call: tcvCall, tick: tcvTick, sheet: tcvSheet, foot: tcvFootRender, bracket: tcvBracketRender, lines: tcvLines };   // tests
