
/* ===================== Rival record and streak bounty (the server side is quick.js) =====================
   The server plays every Ranked match, every Casual game and every Play friends 1v1 between two accounts and keeps your last 30 opponents with your record
   against each (`on`.rv, sent in `me`, qm-res and qm-cs), and your Ranked win streak (`on`.ws). Three Ranked wins in a row put a bounty
   on you: 30 chips, +10 a win, 100 at most; whoever ends the streak takes it, once per pair a day. The server pays it into the
   hunter's account file, so this page never adds it to P.tokens (the next sync brings it; adding it here would pay it twice).
   Shown on PLAYER FOUND!, the VS screen (the record under VS, a RIVAL / NEMESIS / WANTED tag, the wanted plate), the results (the
   story line, the rival strip, the BOUNTY sticker on the chips), the Quick match rank plate and Account > Stats (the Rivals list).
   A boss beaten with a friend in Play friends (co-op, refereed the same way) is one more on their entry's b, bosses beaten together
   (qm-bo), never their W/L: on the boss win's results and on their row in the Rivals list.
   Fable's design: rival-stakes/fable-design.md. Styles: css/97-rivals.css. */
const RV_TAGS = { rival: ["gold", _t("Rival")], nemesis: ["red", _t("Nemesis")], wanted: ["ember", _t("Wanted")] };
const RV = { id: "", opp: "", rec: null, g: 0, shownT: 0, pf: null, fr: null, bo: null, bf: null };   // this Quick match, the opponent's id, your record against them (null: not kept) and the game it counts up to; pf: a Play friends game's record (qm-cs pf), fr: its results; bo / bf: the same for a boss beaten together (qm-bo)
const rvN = (e) => e.w + e.l + e.d;
function rvBounty(ws) { return ws < 3 ? 0 : Math.min(100, 30 + (ws - 3) * 10); }   // quick.js bounty(); a declaration: qmLoad (ui/quick.js) runs before this part
// one opponent from the server, cleaned (qmClean keeps the list)
function rvClean(x) {
  if (!x || typeof x !== "object" || typeof x.id !== "string" || !/^[0-9A-Z]{10}$/.test(x.id)) return null;
  const n = (v) => (Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0);
  return { id: x.id, nm: SYNC.cleanName(typeof x.nm === "string" ? x.nm.slice(0, 40) : "") || "Potato", f: FIG[x.f] ? x.f : "", r: n(x.r), w: n(x.w), l: n(x.l), d: n(x.d), b: n(x.b),
    t: Number.isFinite(x.t) ? x.t : 0, k: typeof x.k === "string" ? x.k.replace(/[^WLD]/g, "").slice(0, 5) : "" };
}
const rvList = () => { const me = qmMe(); return me && Array.isArray(me.rv) ? me.rv : []; };
const rvBos = (n) => _t("{n} boss|{n} bosses", { n });
// "You lead 3–1", "Mash Master leads 3–1", "Tied 2–2" (draws after a dot), and its colour
function rvWords(e, name) {
  if (!e || !rvN(e)) return { t: _t("First meeting"), c: "" };
  const d = e.d ? ` · ${_t("{n} draw|{n} draws", { n: e.d })}` : "";
  return e.w > e.l ? { t: `${_t("You lead {score}", { score: `${e.w}–${e.l}` })}${d}`, c: "up" } : e.w < e.l ? { t: `${_t("{name} leads {score}", { name, score: `${e.l}–${e.w}` })}${d}`, c: "down" } : { t: `${_t("Tied {score}", { score: `${e.w}–${e.l}` })}${d}`, c: "" };
}
// one tag a rival can wear: NEMESIS (leads you by 3 or more after 4+ games), else RIVAL (your most played, 5+ games)
function rvTag(e, list) {
  if (!e) return "";
  if (rvN(e) >= 4 && e.l - e.w >= 3) return "nemesis";
  if (rvN(e) < 5) return "";
  let top = e;
  for (const x of list) if (rvN(x) > rvN(top)) top = x;
  return top === e || top.id === e.id ? "rival" : "";
}
function rvTagEl(tag) { const [c, t] = RV_TAGS[tag]; return acMk("i", `tag st ${c}`, t); }
// the last five, oldest first (k holds them newest first)
function rvDots(k) { const s = acMk("span", "dots"); s.setAttribute("aria-hidden", "true"); for (const ch of [...k].reverse()) s.appendChild(acMk("i", ch === "L" ? "l" : ch === "D" ? "d" : "")); return s; }
function rvCg() { const i = acMk("i", "rv-cg"); i.setAttribute("aria-hidden", "true"); return i; }

/* ----- a player found ----- */
function rvFound(m) {
  const o = m.opp, mine = m.role === "host" ? 0 : 1, r = o.riv && typeof o.riv === "object" ? rvClean(Object.assign({ id: o.id }, o.riv)) : null;
  RV.id = m.id; RV.opp = typeof o.id === "string" ? o.id : ""; RV.g = 0;
  RV.rec = "riv" in o && RV.opp ? Object.assign({ id: RV.opp, nm: o.name, f: m.f[1 - mine], r: Number.isInteger(o.r) ? o.r : 0, w: 0, l: 0, d: 0, t: 0, k: "" }, r ? { w: r.w, l: r.l, d: r.d, k: r.k } : {}) : null;
}
const rvOppBty = (m) => (m.ranked && Number.isInteger(m.opp.bty) && m.opp.bty > 0 ? m.opp.bty : 0);
// PLAYER FOUND!'s line: "· WANTED 40" when they carry a bounty
function rvFoundLine(vs, m) {
  const b = rvOppBty(m);
  if (!b) return;
  const w = acMk("span", "qf-want"); w.append(`${_t("Wanted")} `, rvCg(), String(b)); vs.append(w);
}
// the VS screen: the record under the VS sticker, the tag on their nameplate, a wanted plate under each streaker's tier
function rvVs(m) {
  const o = m.opp, pill = $("vsRiv"), tg = $("vsTagR"), bty = rvOppBty(m), mine = m.ranked && m.you && Number.isInteger(m.you.bty) && m.you.bty > 0 ? m.you.bty : 0;
  pill.hidden = !RV.rec;
  if (RV.rec) { const w = rvWords(RV.rec, o.name); pill.textContent = (m.sk ? `${_t("Rematch")} · ` : "") + w.t; pill.className = "vs-riv " + w.c; }   // m.sk: a rematch for chips (ui/stakes.js)
  const tag = bty ? "wanted" : RV.rec ? rvTag(rvList().find((x) => x.id === RV.opp) || RV.rec, rvList()) : "";
  tg.hidden = !tag;
  if (tag) { tg.className = `tag st ${RV_TAGS[tag][0]}`; tg.textContent = RV_TAGS[tag][1]; }
  rvWant($("vsWR"), bty, o.ws); rvWant($("vsWL"), mine, m.you && m.you.ws);
  if (bty || mine) setTimeout(() => { if (QM.vsT) Sfx.tone(110, 40, 0.3, "sine", 0.4); }, 560);   // a thud as the plate stamps in
}
function rvWant(el, n, ws) {
  el.hidden = !n; el.textContent = "";
  if (!n) return;
  const b = acMk("span", "bty"); b.append(rvCg(), String(n));
  el.append(acMk("i", "tag ember st", _t("Wanted")), acMk("b", "", _t("{n} win streak", { n: ws | 0 })), b);
}

/* ----- the server's results: the record (qm-res, qm-cs), the streak, the bounty ----- */
// the server's entry for an opponent replaces this device's copy (front of the list, as on the server)
function rvGot(e, mid, g) {
  const x = rvClean(e), me = qmMe();
  if (!x) return;
  if (me) { me.rv = [x, ...(me.rv || []).filter((y) => y.id !== x.id)].slice(0, 30); qmSave(); }
  if (mid === RV.id && x.id === RV.opp) { RV.rec = x; RV.g = Math.max(RV.g, g); }
}
// qm-cs: a Casual game the server played to its end
function rvCasual(m) {
  if (!m || typeof m.id !== "string" || !Number.isInteger(m.g)) return;
  rvGot(m.rv, m.id, m.g);
  const me = qmMe(); if (me && Number.isInteger(m.gn)) { me.g = m.gn; qmSave(); }
  if (m.pf) { RV.pf = { id: m.id, g: m.g, e: rvClean(m.rv) }; rvFriend(); return; }   // a Play friends game
  if (mode === "result" && QM.shown && QM.shown.qm && QM.shown.qm.id === m.id && NET.matchId === m.g) rvStrip(QM.shown);
}
// qm-bo: a boss fight with a friend the server played to their win: one more boss beaten together on their entry
function rvBoss(m) {
  if (!m || typeof m.id !== "string" || !Number.isInteger(m.g)) return;
  rvGot(m.rv, m.id, m.g);
  RV.bo = { id: m.id, g: m.g, e: rvClean(m.rv) };
  rvBossShow();
}
// qm-res, before qmRes applies it: the record, the streak, the bounty (the chips come with the next sync)
function rvRanked(m) {
  if (m.rv) rvGot(m.rv, m.id, 1);
  const me = qmMe();
  if (me && Number.isInteger(m.ws) && m.ws >= 0) { me.ws = m.ws; me.bty = rvBounty(m.ws); }
  if (me && Number.isInteger(m.gn)) me.g = m.gn;
  if (m.bh && Number.isInteger(m.bh.n) && m.bh.n > 0) acctSoon(800);   // acct.js: the server paid it into the account
}
const rvBh = (v) => (v && v.bh && Number.isInteger(v.bh.n) && Number.isInteger(v.bh.k) ? v.bh : null);
const rvBl = (v) => (v && v.bl && Number.isInteger(v.bl.n) && Number.isInteger(v.bl.k) ? v.bl : null);

/* ----- the results ----- */
// qmFinish: a verdict already here pays its bounty line on the chips tile (shown only: the chips themselves come with the sync)
function rvFinishLines(R, q) {
  const v = QM.res && QM.res.id === q.id ? QM.res : null, bh = rvBh(v);
  if (bh && bh.n > 0) { R.lines.push([_t("Bounty"), bh.n]); R.total += bh.n; R.bty = bh.n; }
}
// qmResults: the story line's second sentence and the rival strip
function rvResults(R) {
  RV.shownT = performance.now();
  rvStrip(R);   // a verdict already here follows in qmVerdictView -> rvVerdict
}
// the record as this game leaves it: the server's when it has counted this game, else this phone's own result added
function rvNow(R) {
  if (!RV.rec || R.qm.id !== RV.id) return null;
  const e = Object.assign({}, RV.rec), g = NET.matchId || 1;
  if (RV.g >= g || R.left || R.lost || R.forfeit) return RV.g >= g ? e : null;
  if (R.res === 1) e.w++; else if (R.res === 0) e.l++; else e.d++;
  e.k = ((R.res === 1 ? "W" : R.res === 0 ? "L" : "D") + e.k).slice(0, 5);
  return e;
}
function rvStrip(R) { rvShow(rvNow(R), R.qm.opp ? R.qm.opp.name : NET.oppName || "Potato", R.op.spec.id); }
// Play friends (ui/stakes.js stkFriend): the server's record once it has counted the game on screen
function rvFriendRes(R) { RV.fr = R; rvFriend(); }
function rvFriend() {
  const p = RV.pf, R = RV.fr;
  if (mode === "result" && R && p && p.e && p.id === NET.mrCode && p.g === NET.matchId) rvShow(p.e, NET.oppName || _t("Your friend"), R.op.spec.id);
}
// a boss beaten together (ui/online.js finishBossOnline): the server's count once it has counted the fight on screen
function rvBossRes(R) { RV.bf = R; rvBossShow(); }
function rvBossShow() {
  const p = RV.bo, R = RV.bf;
  if (mode === "result" && R && p && p.e && p.e.b && p.id === NET.mrCode && p.g === NET.matchId) rvShow(p.e, NET.oppName || _t("Your friend"), R.boss.mate.spec.id, true);
}
// bo: a boss beaten together, where the count of them stands in for the record
function rvShow(e, name, fid, bo) {
  const el = $("rRiv"), sub = $("rSub");
  const old = sub.querySelector(".rv-now"); if (old) old.remove();
  el.hidden = !e;
  if (!e) return;
  const w = bo ? { t: _t("{b} beaten together", { b: rvBos(e.b) }), c: "bo" } : rvWords(e, name);
  // "<score> now.": the score (the count of bosses) in the span that never breaks at its dash; the name in the line goes in escaped
  const ln = acMk("span", "rv-now"), mark = bo ? _t('<span class="rv-nw">{b}</span> beaten together', { b: rvBos(e.b) }) : cupEsc(w.t).replace(/(\d+–\d+)/, '<span class="rv-nw">$1</span>');
  ln.innerHTML = ` ${_t("{rec} now.", { rec: mark })}`;
  sub.appendChild(ln);
  el.textContent = "";
  const av = acMk("span", "av"); acSetAvatar(av, fid, 0);
  const rec = bo ? _t("{b} together", { b: rvBos(e.b) }) : e.w > e.l ? _t("You lead {score}", { score: `${e.w}–${e.l}` }) : e.w < e.l ? _t("Leads {score}", { score: `${e.l}–${e.w}` }) : _t("Tied {score}", { score: `${e.w}–${e.l}` });   // next to their name and face
  el.append(av, acMk("span", "nm", name), acMk("i", "sep"), acMk("span", "rec " + w.c, rec));
  if (!bo) el.appendChild(rvDots(e.k));
  el.setAttribute("aria-label", _t("{name}: {rec}. Open your rivals", { name, rec: w.t }));
  rvPlace();
}
// the strip sits under the story line; upright, over the side column's cards (Fable's g)
function rvPlace() {
  const el = $("rRiv");
  if (!el || el.hidden) return;
  const side = document.querySelector("#resSheet .res-side"), txt = document.querySelector("#resSheet .res-txt");
  if (L.portrait) { if (el.parentNode !== side) side.insertBefore(el, side.firstChild); }
  else if (el.parentNode !== txt) txt.insertBefore(el, $("rFin"));
  // too narrow for the name (the story line has it): the portrait, the record and the dots
  el.classList.remove("tight");
  const nm = el.querySelector(".nm");
  if (nm && nm.scrollWidth > nm.clientWidth + 1) el.classList.add("tight");
}
// the verdict on the results on screen: the hunter's bounty on the chips, the streaker's lost streak, the record as the server has it
function rvVerdict(late) {
  const v = QM.res, R = QM.shown;
  if (!v || !R || !R.qm || R.qm.id !== v.id || mode !== "result") return;
  rvStrip(R);
  const bh = rvBh(v), bl = rvBl(v), who = R.qm.opp ? R.qm.opp.name : _t("They"), sub = $("rSub");
  for (const x of sub.querySelectorAll(".rv-bt")) x.remove();
  if (bh) sub.appendChild(acMk("span", "rv-bt", ` ${bh.n > 0 ? _t("You ended their {k}-win streak.", { k: bh.k }) : _t("You ended their {k}-win streak (its bounty was taken today).", { k: bh.k })}`));
  if (bl) sub.appendChild(acMk("span", "rv-bt", ` ${bl.n > 0 ? _t("Your {k}-win streak ends; {name} took the {n} bounty.", { k: bl.k, name: who, n: bl.n }) : _t("Your {k}-win streak ends.", { k: bl.k })}`));
  if (!bh || bh.n <= 0) return;
  const t = $("rChipT");
  if (!t.querySelector(".rv-bty")) t.appendChild(acMk("i", "tag ember st rv-bty", _t("Bounty +{n}", { n: bh.n })));
  if (R.bty) return;   // already on the tile (qmFinish had the verdict)
  R.bty = bh.n;
  const from = R.total; R.total += bh.n; R.lines.push([_t("Bounty"), bh.n]);
  $("rStats").classList.remove("nochips"); t.hidden = false;
  const wait = late ? Math.max(0, RV.shownT + 900 - performance.now()) : 0;   // after the tile's own count
  resCount($("rChipN"), from, R.total, "", { delay: wait, dur: 500, end: () => { Sfx.uiCoin(); setTimeout(() => Sfx.uiCoin(), 110); setTimeout(() => Sfx.uiCoin(), 220); } });
  $("rWhy").textContent = R.lines.map(([n, x]) => `${n} +${x}`).join(" · ");
}
// resOpen (screens.js): every results screen starts without them
function rvClear() {
  const el = $("rRiv"); if (el) el.hidden = true;
  RV.fr = null; RV.bf = null;
  const b = document.querySelector("#rChipT .rv-bty"); if (b) b.remove();
}
tap("rRiv", () => { openAccount(); acSetTab("s"); });

/* ----- the Quick match rank plate on a streak ----- */
function rvPlate() {
  const me = qmMe(), b = me ? me.bty | 0 : 0;
  $("qmWant").hidden = !b; $("qmRank").classList.toggle("wanted", !!b);
  if (b) $("qmRec").textContent = `${_t("{n} win streak", { n: me.ws })}\n${_t("Bounty {n}", { n: b })}`;
  return b;
}

/* ----- Account > Stats: the Rivals list, your last 30 opponents, most games first ----- */
function rvStats(pan) {
  if (!qmOn()) return;
  const list = rvList().slice().sort((a, b) => rvN(b) - rvN(a) || b.t - a.t), me = qmMe();
  const head = acMk("div", "rv-head"); head.appendChild(acMk("span", "kicker", _t("Rivals · last 30 opponents")));
  if (list.length) {
    const lead = list.filter((e) => e.w > e.l).length, n = me && Number.isInteger(me.g) ? me.g : list.reduce((a, e) => a + rvN(e), 0);
    head.appendChild(acMk("span", "", `${_t("{n} rival|{n} rivals", { n: list.length })} · ${_t("you lead {n}", { n: lead })} · ${_t("{n} online match|{n} online matches", { n })}`));
  }
  pan.appendChild(head);
  stkStats(pan);   // ui/stakes.js: the chip stakes line
  if (!list.length) { pan.appendChild(acMk("p", "ac-line", _t("Play Quick match or Play friends: everyone you meet online shows here with your record against them."))); return; }
  const ul = acMk("ul", "rv-list");
  for (const e of list) {
    const li = acMk("li", "rv-row"), av = acMk("span", "av"), who = acMk("div", "who"), nb = acMk("b"), tag = rvTag(e, list), ti = tierInfo(e.r || 1000);
    acSetAvatar(av, e.f || "samurai", 0);
    nb.appendChild(acMk("span", "nm", e.nm));
    if (tag) nb.appendChild(rvTagEl(tag));
    const sub = acMk("span"); sub.append(`${FIG[e.f] ? FIG[e.f].name : "Potato"} · `, acMk("i", "", _t("{tier} {r}", { tier: qmTier(ti.t.name), r: e.r || 1000 })));
    li.style.setProperty("--tc", ti.t.col);
    // a friend you only beat bosses with: Co-op where the games would be, no record
    const n = rvN(e), games = n ? _t("{n} game|{n} games", { n }) : _t("Co-op");
    const s2 = acMk("span", "sub2"); s2.append(...(n ? [rvDots(e.k)] : []), games);
    who.append(nb, sub, s2);
    if (e.b) who.appendChild(acMk("span", "rv-bo", _t("{b} beaten together", { b: rvBos(e.b) })));
    const last = acMk("span", "last", games); last.appendChild(acMk("small", "", e.t ? acAgo(e.t) : ""));
    li.append(av, who, rvDots(e.k), acMk("span", "rec " + (e.w > e.l ? "up" : e.w < e.l ? "down" : ""), n ? `${e.w}–${e.l}` : ""), last);
    ul.appendChild(li);
  }
  pan.appendChild(ul);
}
