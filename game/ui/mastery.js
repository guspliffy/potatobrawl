/* ===================== fighter mastery (UI only; the simulation never reads any of this) =====================
   Every fighter has its own XP and a level from 1 to 10. XP comes from finished matches (masteryResults for the results screen,
   masteryCup for the tournament, which has no results screen). Rewards per level: chips at 2/4/6/8, badges, titles at 5 and 10, a gold
   sheen on the winner's name on the KO page at 7 (masteryGlint, called from manga.js), laurels and a fanfare at 10.
   Saved in the profile: P.mxp (XP played), P.mseed (the one-time head start from the old win/loss record), P.mpaid (highest level whose
   chips were paid), P.pages ({ko, ult}: the fighters whose KO page / Ultimate KO page YOU landed). The level is always derived from the XP.
   The merge rules for two devices are in sync.js. Hooks elsewhere: screens.js (tiles, detail, results), cup.js, finisher.js, manga.js, acct.js. */
const MX_CURVE = [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];   // total XP to reach level n (index n)
const MX_MAX = 10;
const MX_CHIPS = { 2: 20, 4: 40, 6: 60, 8: 80 };                              // 200 per fighter
const MX_TITLES = {                                                          // [Lv 5, Lv 10]
  phoenix: ["Hot Potato", "Reborn"], alchemist: ["Lab Rat", "Philosopher"], odin: ["Raven Keeper", "Spearbearer"], wizard: ["Star Pupil", "Starcaller"],
  samurai: ["Steady Hand", "One Cut"], dragon: ["Hatchling", "Elder Wyrm"], gunslinger: ["Deputy", "Most Wanted"], reaper: ["Gravedigger", "Ferryman"],
};
const mxFighters = () => FIGHTERS.filter((f) => MX_TITLES[f.id]);
const mxObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/* ----- the numbers ----- */
const mxXp = (id) => ((P.mseed && P.mseed[id]) | 0) + ((P.mxp && P.mxp[id]) | 0);
function mxLevel(xp) { let l = 1; for (let n = 2; n <= MX_MAX; n++) if (xp >= MX_CURVE[n]) l = n; return l; }
function mxInfo(id) {
  const xp = mxXp(id), lv = mxLevel(xp), max = lv >= MX_MAX, lo = MX_CURVE[lv], hi = max ? lo : MX_CURVE[lv + 1];
  return { id, xp, lv, max, p: max ? 1 : clamp((xp - lo) / (hi - lo), 0, 1), lo, hi };
}
const mxFrac = (xp) => { const lv = mxLevel(xp); return lv >= MX_MAX ? 1 : clamp((xp - MX_CURVE[lv]) / (MX_CURVE[lv + 1] - MX_CURVE[lv]), 0, 1); };
// the badge look by level: none at 1, ink 2, bronze 3-5, silver 6-8, gold 9, gold with laurels 10 (the colours are the tier colours)
function mxBadge(lv) { return lv < 2 ? { k: "", col: "" } : lv < 3 ? { k: "ink", col: "#3a4170" } : lv < 6 ? { k: "bronze", col: "#cd8f5b" } : lv < 9 ? { k: "silver", col: "#c9d0e4" } : { k: lv >= 10 ? "laurel" : "gold", col: "#f0c35a" }; }
// what a level gives. next: the words for "Next: ..." (no plus sign, a title by its name); else the words for the results line
function mxRewards(id, lv, next) {
  const out = [], t = MX_TITLES[id] || ["", ""], chips = MX_CHIPS[lv];
  if (chips) out.push(next ? `${chips} chips` : `+${chips} chips`);
  if (lv === 3) out.push("Bronze badge");
  if (lv === 5) out.push(next ? t[0] : `Title: ${t[0]}`);
  if (lv === 6) out.unshift("Silver badge");
  if (lv === 7) out.push("Name glint");
  if (lv === 9) out.push("Gold badge");
  if (lv === 10) out.push(next ? `${t[1]} and laurels` : `Title: ${t[1]}`, ...(next ? [] : ["Laurels"]));
  return out;
}
// the reward line is one short line: after the first two a long list (the catch-up after the head start) ends with "+N more"
let mxPaid = false;   // this match paid mastery chips
const mxRewardText = (r) => (r.length > 3 ? [...r.slice(0, 2), `+${r.length - 2} more`] : r).join(" · ");
// Practice's line under the stat tiles says it earns no chips: when a level up did pay some, it says so
function masteryWhy(s) { return mxPaid ? s.replace(/ or earn chips\.$/, ". Mastery chips still count.") : s; }
function mxNextLine(id, lv) { return lv >= MX_MAX ? "Mastered" : `Next: ${mxRewards(id, lv + 1, true).join(" and ")} at Lv ${lv + 1}`; }

/* ----- the profile: tidy fields, and the one-time head start from the old record (w*45 + l*28 + d*35, at most 650 per fighter) ----- */
(function mxLoad() {
  if (!mxObj(P.mxp)) P.mxp = {};
  if (!mxObj(P.mpaid)) P.mpaid = {};
  if (!mxObj(P.pages)) P.pages = { ko: [], ult: [] };
  for (const k of ["ko", "ult"]) if (!Array.isArray(P.pages[k])) P.pages[k] = [];
  if (P.mseed === undefined) {
    const s = {};
    for (const f of FIGHTERS) {
      const e = mxObj(P.fstats) ? P.fstats[f.id] : null;
      const v = e ? Math.min(650, (e.w | 0) * 45 + (e.l | 0) * 28 + (e.d | 0) * 35) : 0;
      if (v > 0) s[f.id] = v;
    }
    P.mseed = s;
    if (!firstRun) saveProfile();   // a brand new profile is saved with its first real change (the tutorial still starts after a reload)
  } else if (!mxObj(P.mseed)) P.mseed = {};
})();

/* ----- XP for a finished match ----- */
// The Practice multiplier. Practice is the plain CPU match of finishMatch: not ranked, online, Daily or cup, and match.level is one of the
// CPU levels. Every other mode (and any mode added later) counts x1.
function mxMult() {
  const m = match, lv = m && !m.ranked && !m.online && !m.daily && !m.cup ? LEVELS.find((l) => l.name === m.level) : null;
  return lv ? { Dummy: 0, Easy: 0.5, Normal: 0.75, Hard: 1 }[lv.name] : 1;
}
// R: { res (1 win, 0.5 draw, 0 loss), forfeit, me (the fighter, for its KOs) }; page: your KO page played on the last heart; ult: it was an Ultimate KO
function mxGain(R, page, ult) {
  if (R.forfeit) return { xp: 0, why: "No XP for a forfeit" };
  const m = mxMult();
  if (m <= 0) return { xp: 0, why: "No XP against the Dummy" };
  const won = R.res === 1, raw = 20 + (won ? 20 : 0) + ((R.me && R.me.kos) | 0) * 5 + (won && page ? (ult ? 15 : 10) : 0);
  return { xp: Math.round(raw * m) };
}
// Add XP to a fighter and pay the chips of every level above the highest one paid (this also pays levels the head start or a sync brought).
// Returns what the results screen shows: the level and the bar before (from) and after, and the rewards of the levels passed.
function mxAward(id, add) {
  const x0 = mxXp(id), l0 = mxLevel(x0), paid = P.mpaid[id] | 0;
  const lo = Math.max(1, paid), a = { id, add, x0, x1: x0 + add, l0, from: l0, chips: 0, rewards: [], p0: mxFrac(x0) };
  if (add > 0) {
    P.mxp[id] = Math.min(1e9, (P.mxp[id] | 0) + add);
    a.x1 = mxXp(id);
    const l1 = mxLevel(a.x1);
    for (let n = lo + 1; n <= l1; n++) { a.chips += MX_CHIPS[n] | 0; a.rewards.push(...mxRewards(id, n, false).filter((r) => !/chips$/.test(r))); }
    if (l1 > paid) P.mpaid[id] = l1;
    if (a.chips) P.tokens += a.chips;
    if (lo < l0) { a.from = lo; a.p0 = 0; }   // levels reached before but never paid (the head start, a sync): they pop now, from the last paid one
    saveProfile();
  }
  a.l1 = mxLevel(a.x1); a.p1 = mxFrac(a.x1);
  a.up = a.l1 > a.from;
  if (a.chips) a.rewards.unshift(`+${a.chips} chips`);
  return a;
}
// a KO page you landed (finisher.js, when you won the KO): the Collection counts them
function masteryPage(id, ult) {
  if (!FIG[id]) return;
  let ch = false;
  for (const k of ult ? ["ko", "ult"] : ["ko"]) if (!P.pages[k].includes(id)) { P.pages[k].push(id); P.pages[k].sort(); ch = true; }
  if (ch) saveProfile();
}

/* ----- sound: the two-note fanfare of reaching Lv 10 (the only new sound) ----- */
let mxFan = 0;   // how many times it played (read by the test)
Sfx.fanfare = function () { mxFan++; this.tone(784, 784, 0.16, "triangle", 0.1); this.at(0.15, 1175, 1175, 0.5, "triangle", 0.11); this.at(0.15, 2349, 2349, 0.3, "sine", 0.025); };

/* ----- the results row ----- */
const mxRow = document.createElement("div");
mxRow.className = "card res-mx"; mxRow.id = "rMx"; mxRow.hidden = true;
mxRow.innerHTML = '<span class="av" id="rMxAv"></span><div class="mx-body"><div class="mx-head"><b class="mx-nm" id="rMxNm"></b><span class="mx-lvw" id="rMxLvw">Lv <i id="rMxLv">1</i></span><span class="mx-tag" id="rMxTag"></span></div>' +
  '<div class="mx-bar"><i id="rMxBar"></i></div><div class="mx-line" id="rMxLine"></div></div><div class="mx-xp" id="rMxXp"><b id="rMxXpN">+0</b><small>XP</small></div>';
$("rRank").after(mxRow);
let mxRun = null;   // the level-up sequence in progress: { t: [timers], fin }
function mxStop() { if (mxRun) { mxRun.t.forEach(clearTimeout); mxRun = null; } }
function masteryHide() { mxStop(); mxRow.hidden = true; }
const mxLv = (n) => { $("rMxLv").textContent = n; $("rMxLvw").style.setProperty("--mc", n < 3 ? "#a4a9c8" : mxBadge(n).col); };   // the ink badge of Lv 2 would vanish on the dark card
function mxBar(p, ms) { const b = $("rMxBar"); b.style.transition = ms ? `width ${ms}ms cubic-bezier(0.25, 0.8, 0.25, 1)` : "none"; b.style.setProperty("--p", p); }
function mxTag(text, cls) { const t = $("rMxTag"); t.textContent = text; t.className = "mx-tag" + (text ? " on " + cls : ""); }
// Awards the XP and fills the row. page: your KO page played this match; ult: it was an Ultimate KO.
function masteryResults(R, page, ult) {
  const id = R.me.spec.id, g = mxGain(R, page, ult), a = mxAward(id, g.xp);
  mxStop();
  const spec = FIG[id], won = R.res === 1, calm = resCalm(), T0 = R.ranked ? 1450 : 450, row = mxRow;
  row.hidden = false; row.classList.remove("up", "flash", "spin", "max", "zero", "loss", "calm");
  row.classList.toggle("loss", R.res === 0); row.classList.toggle("zero", g.xp <= 0);
  row.style.setProperty("--fc", col(spec.palettes[P.pal[id] || 0])); row.style.setProperty("--d", T0 + "ms");
  acSetAvatar($("rMxAv"), id, P.pal[id] || 0);
  $("rMxNm").textContent = spec.name;
  const line = $("rMxLine"), xpN = $("rMxXpN");
  const label = `${spec.name} mastery, level ${a.l1}. ${g.xp > 0 ? `${g.xp} XP.` : g.why}${a.up ? ` Level up. ${a.rewards.join(", ")}.` : ""}`;
  row.setAttribute("role", "group"); row.setAttribute("aria-label", label);
  const rewardText = mxRewardText(a.rewards);
  mxPaid = a.chips > 0;
  const lineEnd = g.xp <= 0 ? g.why : a.up ? rewardText : mxNextLine(id, a.l1);
  const mastered = a.l1 >= MX_MAX;
  const fin = () => {   // the end state: also what a tap on the screen and reduced motion jump to
    mxStop();
    mxLv(a.l1); mxBar(a.p1, 0);
    mxTag(a.up && mastered ? "Mastered" : a.up ? "Level up" : mastered ? "Mastered" : "", mastered ? "gold" : "ember");
    line.textContent = lineEnd; line.classList.add("on");
    row.classList.remove("flash", "spin"); row.classList.toggle("up", a.up); row.classList.toggle("max", mastered);
    xpN.textContent = g.xp > 0 ? `+${g.xp}` : "0";
    if (a.up && mastered && !fin.sound) { fin.sound = true; if (won) Sfx.fanfare(); }
    if (a.up && a.chips && !fin.coin) { fin.coin = true; Sfx.uiCoin(); }
  };
  fin.sound = fin.coin = false;
  // the start state
  mxLv(a.from); mxBar(a.p0, 0); mxTag("", ""); line.classList.remove("on"); line.textContent = "";
  xpN.textContent = "+0";
  if (calm) { fin(); return; }
  const run = mxRun = { t: [], fin };
  const at = (ms, f) => run.t.push(setTimeout(() => { if (mxRun !== run) return; if (mode !== "result") { mxStop(); return; } f(); }, ms));   // leaving the screen ends it quietly
  if (g.xp > 0) resCount(xpN, 0, g.xp, "+", { delay: T0, dur: a.up ? 1100 : 800 });   // a tap finishes this count too
  if (!a.up) {
    at(T0, () => mxBar(a.p1, 800));
    at(T0 + 850, fin);
    return;
  }
  // a level up: the bar fills, flashes, the number spins to the new level, the bar empties and fills to where it is now, the tag stamps in, then the rewards
  at(T0, () => mxBar(1, 520));
  at(T0 + 560, () => { row.classList.add("flash", "spin"); });
  at(T0 + 560 + 260, () => mxLv(a.l1));
  at(T0 + 940, () => {
    mxBar(0, 0); void $("rMxBar").offsetWidth; mxBar(a.p1, 460);
    mxTag(mastered ? "Mastered" : "Level up", mastered ? "gold" : "ember");
    if (won) { if (mastered) { fin.sound = true; Sfx.fanfare(); } else Sfx.uiGo(); }
  });
  at(T0 + 1450, () => { line.textContent = lineEnd; line.classList.add("on"); if (a.chips) { fin.coin = true; Sfx.uiCoin(); } });
  at(T0 + 1500, fin);
}
// a tap on the results screen: the level-up sequence jumps to its end (the counts are finished by screens.js)
screens.result.addEventListener("pointerdown", () => { if (mxRun) mxRun.fin(); }, true);

/* ----- the tournament has no results screen: the XP shows as a sticker on the bracket ----- */
const mxCup = document.createElement("div");
mxCup.className = "mx-cupxp"; mxCup.id = "cupXp"; mxCup.hidden = true;
mxCup.innerHTML = "<b></b><small></small>";
document.querySelector("#scrCup .sel-head .coin").before(mxCup);
let mxCupT = 0;
function masteryCup(forfeit) {
  clearTimeout(mxCupT); mxCup.hidden = true;
  if (forfeit || !G || !match) return;
  const me = G.fighters[0], res = G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5, g = mxGain({ res, forfeit: false, me }, false, false);
  if (g.xp <= 0) return;
  const a = mxAward(me.spec.id, g.xp), name = FIG[me.spec.id].name;
  mxCup.querySelector("b").textContent = `+${g.xp} XP`;
  mxCup.querySelector("small").textContent = a.up ? `${name} Lv ${a.l1}${a.rewards.length ? " · " + mxRewardText(a.rewards) : ""}` : `${name} Lv ${a.l1}`;
  mxCup.classList.toggle("up", a.up);
  mxCup.setAttribute("aria-label", `${name} gains ${g.xp} XP${a.up ? `, level ${a.l1}` : ""}`);
  mxCupT = setTimeout(() => {
    if (mode !== "cup") return;
    mxCup.hidden = false; mxCup.classList.remove("pop"); void mxCup.offsetWidth; mxCup.classList.add("pop");
    if (a.up) Sfx.uiCoin();
    mxCupT = setTimeout(() => { mxCup.hidden = true; }, 7000);
  }, 700);
}

/* ----- the roster tile, the detail panel ----- */
function mxShield(el, lv) {   // fills the shield (an <i class="mx-sh"><em>) for a level
  const b = mxBadge(lv);
  el.hidden = lv < 2; el.dataset.k = b.k; el.firstChild.textContent = lv;
}
function masteryTile(b, spec) {
  const lv = mxInfo(spec.id).lv;
  if (!b._mx) {
    b._mx = document.createElement("i"); b._mx.className = "mx-sh"; b._mx.innerHTML = "<em></em>"; b._mx.setAttribute("aria-hidden", "true");
    b._lr = document.createElement("i"); b._lr.className = "mx-lr"; b._lr.setAttribute("aria-hidden", "true");
    b.append(b._mx, b._lr);
  }
  mxShield(b._mx, lv); b._lr.hidden = lv < MX_MAX;
  b.classList.toggle("mx10", lv >= MX_MAX);
  b.setAttribute("aria-label", `${spec.name}${lv > 1 ? `, mastery level ${lv}` : ""}`);
}
// the MASTERY row of the stats card: ten segments (the next one fills to the XP fraction), the LV sticker, and what comes next
function masteryDetail(spec) {
  const m = mxInfo(spec.id), b = mxBadge(m.lv);
  let seg = "";
  for (let n = 1; n <= MX_MAX; n++) seg += n <= m.lv ? '<i class="on"></i>' : n === m.lv + 1 && m.p > 0 ? `<i class="part" style="--f:${m.p.toFixed(3)}"></i>` : "<i></i>";
  $("dStats").insertAdjacentHTML("beforeend", `<div class="mx-row" data-k="${b.k}"><span>Mastery</span><span class="mx-seg" role="img" aria-label="Mastery level ${m.lv} of ${MX_MAX}">${seg}</span>` +
    `<b class="mx-lv" style="--mc:${b.col || "#a4a9c8"}">Lv ${m.lv}</b><small class="mx-next">${mxNextLine(spec.id, m.lv)}</small></div>`);
  $("dName").classList.toggle("mx10", m.lv >= MX_MAX);
}

/* ----- titles (acct.js lists them in ACT) and the Collection (Account > Locker, the level in Account > Stats) ----- */
function mxActs(n) {   // the Lv 5 or Lv 10 title of every fighter
  return mxFighters().map((f) => ({ id: `m${n}_${f.id}`, grp: `m${n}`, fighter: true, name: () => MX_TITLES[f.id][n === 5 ? 0 : 1], ok: () => mxInfo(f.id).lv >= n,
    how: `Reach Lv ${n} with ${f.name}.`, note: () => `${f.name} Lv ${n}`, xp: () => mxXp(f.id) }));
}
const mxJack = { id: "jack", name: () => "Jack of Spuds", ok: () => mxFighters().every((f) => mxInfo(f.id).lv >= 5), how: "Reach Lv 5 with every fighter." };
function mxShieldHTML(lv, cls) { const b = mxBadge(lv); return `<i class="mx-sh sm ${cls || ""}" data-k="${b.k}"${lv < 2 ? " hidden" : ""}><em>${lv}</em></i>`; }
const mxDots = (list) => mxFighters().map((f) => { const on = (list || []).includes(f.id); return `<span class="av${on ? " on" : ""}" data-f="${f.id}" title="${f.name}${on ? "" : ": not yet"}"></span>`; }).join("");
function masteryCollection(pan) {
  const ko = P.pages.ko.filter((id) => FIG[id]), ult = P.pages.ult.filter((id) => FIG[id]), n = mxFighters().length, rd = routesDone().length;
  const box = document.createElement("div");
  box.className = "mx-col";
  box.innerHTML = '<div class="kicker">Collection</div><div class="mx-cells">' +
    `<div class="mx-cell" id="mxColKo"><b>${ko.length}<small>/${n}</small></b><span>KO pages</span><div class="mx-dots">${mxDots(ko)}</div></div>` +
    `<div class="mx-cell" id="mxColUlt"><b>${ult.length}<small>/${n}</small></b><span>Ultimate KOs</span><div class="mx-dots">${mxDots(ult)}</div></div>` +
    `<div class="mx-cell" id="mxColRt"><b>${rd}<small>/${ROUTE_TOTAL}</small></b><span>Combo routes</span><div class="mx-rbar"><i style="width:${Math.round(100 * rd / ROUTE_TOTAL)}%"></i></div></div></div>` +
    '<p class="ac-line">A page counts when you land it. Your own fighters get their pages when you win with a KO on the last heart.</p>';
  for (const d of box.querySelectorAll(".av")) acSetAvatar(d, d.dataset.f, P.pal[d.dataset.f] || 0);
  pan.appendChild(box);
}

/* ----- the winner's name on the KO page: a gold sheen sweeps across it once (Lv 7 and up; a still gold edge with reduced motion) ----- */
// nm: the name word of the title block ({ cv, w, h }), drawn at (x, y); called by manga.js mgCard inside its slide transform
function masteryGlint(o, nm, x, y, t) {
  if (FIN.w !== meSlot || !FIN.P[FIN.w] || mxInfo(FIN.P[FIN.w].spec.id).lv < 7) return;
  if (!nm.gold) {   // the same lettering with its white fill turned gold (multiply), and only where the letters are
    const c = document.createElement("canvas"); c.width = nm.cv.width; c.height = nm.cv.height;
    const g = c.getContext("2d");
    g.drawImage(nm.cv, 0, 0);
    g.globalCompositeOperation = "multiply";
    const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0.3, "#ffe08a"); gr.addColorStop(0.55, "#f4c95d"); gr.addColorStop(1, "#d68a2a");
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in"; g.drawImage(nm.cv, 0, 0);
    nm.gold = c;
  }
  const reduced = MG.reduced, k = reduced ? 0.4 : fe(MT.CARD + 380, MT.CARD + 1000, t);
  if (!reduced && (k <= 0 || k >= 1)) return;
  const w = nm.w, h = nm.h, bw = w * 0.16, cx = x + (reduced ? w * 0.4 : -bw + (w + bw * 2) * easeOut(k)), sk = h * 0.3;
  o.save();
  o.beginPath(); o.moveTo(cx - bw / 2 + sk, y); o.lineTo(cx + bw / 2 + sk, y); o.lineTo(cx + bw / 2 - sk, y + h); o.lineTo(cx - bw / 2 - sk, y + h); o.closePath(); o.clip();
  o.drawImage(nm.gold, x, y, w, h);
  o.restore();
}

/* ----- a hook for the tests ----- */
window.__blMastery = { info: mxInfo, level: mxLevel, curve: MX_CURVE, titles: MX_TITLES, gain: mxGain, mult: mxMult, page: masteryPage, get fanfares() { return mxFan; } };
