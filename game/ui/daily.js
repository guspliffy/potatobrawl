/* ===================== Daily Potato: one fixed matchup a day =====================
   UI only: the simulation, the bot and the online code are not touched. The day is the player's local date "YYYY-MM-DD"; a hash of it
   picks your fighter, the CPU's fighter, its potato name and the match seed, so everyone gets the same matchup that day. The CPU gets
   stronger through the week (Monday 0.45 ... Sunday 0.87; Normal Mon-Wed, Hard Thu-Sat, Brutal on Sunday). 3 lives, 3 minutes.
   One try: starting the match writes the day down as tried (r = -1), so quitting, a forfeit or a reload counts as a loss.
   Chips: a win 40 (streak +1), a draw 15 (streak kept), a finished loss 5, a forfeit or an unfinished match nothing; any loss ends the
   streak. No rating, record, history or per-fighter stats change.
   Another go (a way to spend chips, see ui/shop.js): after a finished loss or draw (not a forfeit, a quit or a win) the sheet offers the same
   match again for 50 chips, once a day, two taps. Its result replaces today's: a win pays 40 and continues the streak as if the first try had
   been won (that is what `p` is for), a draw 15, a loss 5. Starting it writes the day down as tried again (r = -1, x = 1), so quitting or a
   reload counts as a loss.
   P.daily = { d (last day tried), r (1 / 0.5 / 0, -1 = started, not finished), s (streak), w (the last day that kept the streak going:
             a win, or a draw while a streak runs), b (best streak), p (the streak that showed before today's first try; only on a finished
             loss or draw, which is the go being open), x (1 once Another go was taken today) }, synced (sync.js). The streak shows while w is today or yesterday. */
const DAILY = {
  lives: 3, secs: 180, win: 40, draw: 15, loss: 5, again: 50,
  d: [0.45, 0.52, 0.59, 0.66, 0.73, 0.8, 0.87],                          // CPU strength, Monday to Sunday in equal steps
  words: ["Normal", "Normal", "Normal", "Hard", "Hard", "Hard", "Brutal"],
};
const DAY_N = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON_N = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DLY = { key: "", arm: false, armT: 0 };   // the day the sheet shows; whether Another go waits for its second tap

/* ----- the day and its matchup ----- */
const dPad = (n) => String(n).padStart(2, "0");
function dailyKey(t) { t = t || new Date(); return `${t.getFullYear()}-${dPad(t.getMonth() + 1)}-${dPad(t.getDate())}`; }
function dailyDate(key) { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); }   // local midnight
function dailyShift(key, n) { const t = dailyDate(key); t.setDate(t.getDate() + n); return dailyKey(t); }
function dailyLabel(key) { const t = dailyDate(key); return `${DAY_N[t.getDay()]} ${t.getDate()} ${MON_N[t.getMonth()]}`; }
function dailyHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }   // FNV-1a
// the same date gives the same matchup on every device (cupRng: cup.js)
function dailyPick(key) {
  const R = cupRng(dailyHash("daily " + key)), n = FIGHTERS.length;
  const me = FIGHTERS[(R() * n) | 0].id, opp = FIGHTERS[(R() * n) | 0].id, cpu = CPU_NAMES[(R() * CPU_NAMES.length) | 0], seed = (R() * 2147483647) | 0;
  const wd = (dailyDate(key).getDay() + 6) % 7;   // Monday 0 ... Sunday 6
  return { key, me, opp, cpu, seed, wd, d: DAILY.d[wd], word: DAILY.words[wd] };
}
// your equipped skin; the CPU's first skin, or the next one after yours in a mirror match (as startMatch does)
function dailyPals(pk) { const mi = P.pal[pk.me] || 0; return [mi, pk.opp === pk.me ? (mi + 1) % chipN(FIG[pk.opp]) : 0]; }
function dailyNextIn() {   // until the next local midnight
  const ms = dailyDate(dailyShift(dailyKey(), 1)) - Date.now();
  return ms < 3600000 ? `${Math.max(1, Math.ceil(ms / 60000))} min` : `${Math.round(ms / 3600000)} h`;
}

/* ----- the record ----- */
function dailyGet() { return SYNC.cleanDaily(P.daily) || { d: "", r: 0, s: 0, w: "", b: 0 }; }   // tidy (sync.js); an old profile has none
const dailyStreak = (st, key) => (st.w && st.w >= dailyShift(key, -1) ? st.s : 0);   // a streak lasts while its last day is today or yesterday
const dailyStreakNow = () => dailyStreak(dailyGet(), dailyKey());
// what a finished match does to the record: res 1 / 0.5 / 0, prev = the streak that showed when it started
function dailyAfter(st, key, prev, res, forfeit) {
  const won = res === 1, draw = res === 0.5, s = won ? prev + 1 : draw ? prev : 0;
  return { st: { d: key, r: res, s, w: won || (draw && s > 0) ? key : st.w, b: Math.max(st.b, s) }, chips: won ? DAILY.win : draw ? DAILY.draw : forfeit ? 0 : DAILY.loss };
}
const dailyRes = (r) => (r === 1 ? "Won" : r === 0.5 ? "Draw" : "Lost");   // -1 (left unfinished) is a loss
// Another go is open: today's try ended in a loss or a draw (r 0 / 0.5 with p; a forfeit or a quit has none), and it was not taken yet
const dailyAgainOk = (st, key) => st.d === key && (st.r === 0 || st.r === 0.5) && typeof st.p === "number" && !st.x;
// the record as it stood before today's first try: the day that kept the streak was yesterday when a streak showed (a draw moved it to today); the best never moved
const dailyBefore = (st, key) => ({ w: st.p > 0 ? dailyShift(key, -1) : st.w, b: st.b });

/* ----- the menu button and the sheet ----- */
function dailyMenu() {
  const key = dailyKey(), st = dailyGet(), done = st.d === key, s = dailyStreak(st, key);
  const pk = done ? null : dailyPick(key);
  $("mDaily").textContent = pk ? `${FIG[pk.me].name} vs ${FIG[pk.opp].name} · ${pk.word}` : `${dailyRes(st.r)}${s > 0 && st.r > 0 ? ` · ${s}-day streak` : ""} · next in ${dailyNextIn()}`;
  $("bDaily").classList.toggle("won", done && st.r === 1);
}
function dailyCard(el, id, pi, who) {
  const spec = FIG[id], pal = spec.palettes[pi] || spec.palettes[0];
  el.style.setProperty("--fc", col(pal));
  el.innerHTML = `<span class="dly-ph">${PORTRAITS[id] ? `<img src="${PORTRAITS[id]}" alt="">` : ""}</span><span class="dly-t"><b>${spec.name}</b><small>${cupEsc(who)}</small></span>`;
}
function dailyOpen() {
  const key = dailyKey(), st = dailyGet(), pk = dailyPick(key), [mi, oi] = dailyPals(pk), done = st.d === key, s = dailyStreak(st, key), again = dailyAgainOk(st, key);
  DLY.key = key; dailyDisarm();
  $("dlyDate").textContent = dailyLabel(key);
  dailyCard($("dlyMe"), pk.me, mi, "You"); dailyCard($("dlyOp"), pk.opp, oi, pk.cpu);
  const best = st.b > 0 ? ` Best streak: ${st.b} ${st.b === 1 ? "day" : "days"}.` : "";
  $("dlyRule").innerHTML = done ? `<b>${dailyRes(st.r)} today.</b>${again ? ` One more go for ${DAILY.again} chips.` : s > 0 ? ` ${s}-day streak.` : ""}` : `<b>One try.</b> Win: ${DAILY.win} chips${s > 0 ? ` and a ${s + 1}-day streak` : ""}.`;
  $("dlyLine").textContent = again ? `The same match again. Its result replaces today's: a win pays ${DAILY.win} chips${st.p > 0 ? ` and makes it a ${st.p + 1}-day streak` : ""}, a draw ${DAILY.draw}, a loss ${DAILY.loss}.`
    : done ? `The next Daily Potato opens in ${dailyNextIn()}.${best}` : `CPU: ${pk.word} · ${DAILY.lives} lives · ${DAILY.secs / 60} min · the same matchup for everyone today.`;
  $("dlyGo").hidden = done;
  $("dlyAgain").hidden = !again;
  dailyAgainLabel();
  modal("daily", true);
}
// the Another go button: its price, "Sure?" for 3 s after the first tap, dimmed (and answering with the missing chips) while short
function dailyAgainLabel() {
  const b = $("dlyAgain"), short = P.tokens < DAILY.again;
  b.classList.toggle("ember", DLY.arm); b.classList.toggle("primary", !DLY.arm && !short); b.classList.toggle("dim", short);
  b.querySelector("span").innerHTML = `${DLY.arm ? "Sure?" : "Another go"} <span class="tokglyph"></span>${DAILY.again}`;
  b.setAttribute("aria-label", DLY.arm ? `Sure? Another go for ${DAILY.again} chips` : short ? `Another go costs ${DAILY.again} chips, you have ${fmtChips(P.tokens)}` : `Another go for ${DAILY.again} chips`);
}
function dailyDisarm() { clearTimeout(DLY.armT); DLY.arm = false; }
function dailyFight() {
  const key = dailyKey(), st = dailyGet();
  if (key !== DLY.key || st.d === key) { dailyOpen(); return; }   // midnight passed while the sheet was open, or today's try went elsewhere (a sync)
  const pk = dailyPick(key), prev = dailyStreak(st, key);
  P.daily = { d: key, r: -1, s: 0, w: st.w, b: st.b };   // tried from the first frame: a quit, a forfeit or a reload counts as a loss
  saveProfile();
  dailyStart(pk, { key, prev });
}
// Another go: the second tap pays and starts the same match again; the record says tried again (x), so it never comes twice
function dailyAgain() {
  const key = dailyKey(), st = dailyGet();
  if (key !== DLY.key || !dailyAgainOk(st, key)) { dailyOpen(); return; }   // midnight, or the go went elsewhere (a sync)
  if (P.tokens < DAILY.again) {
    dailyDisarm(); Sfx.uiNo(); dailyAgainLabel();
    $("dlyLine").textContent = `Another go costs ${DAILY.again} chips and you have ${fmtChips(P.tokens)}: ${DAILY.again - P.tokens} more needed. Chips come from ranked wins, the Daily Potato, tournaments and Road stars.`;
    return;
  }
  if (!DLY.arm) {   // the first tap arms the button (ember, "Sure?") for 3 s
    DLY.arm = true; Sfx.ui(); dailyAgainLabel();
    DLY.armT = setTimeout(() => { DLY.arm = false; if (!screens.daily.hidden) dailyAgainLabel(); }, 3000);
    return;
  }
  dailyDisarm();
  const was = dailyBefore(st, key);
  P.tokens -= DAILY.again;
  P.daily = { d: key, r: -1, s: 0, w: was.w, b: st.b, x: 1 };   // tried again from the first frame, like the first try
  saveProfile(); Sfx.uiCoin();
  dailyStart(dailyPick(key), { key, prev: st.p, again: true, w: was.w });
}
function dailyStart(pk, dm) {
  const [mi, oi] = dailyPals(pk), me = FIG[pk.me], opp = FIG[pk.opp];
  Sfx.init(); modal("daily", false);
  G = newGame({ players: [{ spec: me, pal: me.palettes[mi] || me.palettes[0] }, { spec: opp, pal: opp.palettes[oi] || opp.palettes[0] }], stocks: DAILY.lives, time: DAILY.secs, countdown: 150, seed: pk.seed, map: ((pk.seed % BL.POOL) + BL.POOL) % BL.POOL });
  match = { ranked: false, daily: dm, d: pk.d, oppRating: 0, bot: makeBot(pk.d, BL.BOT_STYLES[opp.id]), level: pk.word, cpu: pk.cpu };
  meSlot = 0;
  enterMatchUI();
}
// finishMatch calls this for the Daily Potato (a forfeit too)
function dailyMatchEnd(forfeit) {
  const dm = match.daily, me = G.fighters[0], op = G.fighters[1];
  const res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5;
  // Another go replaces today's result: it starts from the record as it was before the first try (dm.w), so a win goes on from the old streak
  const { st, chips } = dailyAfter(dm.again ? { w: dm.w, b: dailyGet().b } : dailyGet(), dm.key, dm.prev, res, forfeit);
  if (dm.again) st.x = 1;
  else if (!forfeit && res !== 1) st.p = dm.prev;   // a finished loss or draw keeps Another go open (a win or a forfeit does not)
  P.daily = st; P.tokens += chips;
  saveProfile();
  const sk = ` · ${st.s}-day streak`, reset = dm.prev > 0 ? " · streak reset" : "", ag = dm.again ? " · another go" : "";
  const why = res === 1 ? `Daily win +${chips}${sk}${ag}` : res === 0.5 ? `Daily draw +${chips}${st.s > 0 ? sk : ""}${ag}` : forfeit ? `No chips for a forfeit${reset}${ag}` : `Daily played +${chips}${reset}${ag}`;
  showResults({ res, forfeit, ranked: false, daily: dm, me, op, lines: [], total: chips, why });
}

screens.daily = $("scrDaily");
$("dlyGo").addEventListener("click", () => { Sfx.init(); Sfx.uiGo(); goFull(); dailyFight(); });
$("dlyAgain").addEventListener("click", () => { Sfx.init(); goFull(); dailyAgain(); });
for (const id of ["dlyBack", "dlyClose"]) $(id).addEventListener("click", () => { Sfx.init(); Sfx.uiBack(); dailyDisarm(); modal("daily", false); });
// a tap anywhere but the armed button puts "Another go" back
$("scrDaily").addEventListener("click", (e) => { if (DLY.arm && !e.target.closest("#dlyAgain")) { dailyDisarm(); dailyAgainLabel(); } }, true);
// the button line counts down to midnight and turns over to the next matchup while the menu stays open
setInterval(() => { if (mode === "menu") { dailyMenu(); renderPill(); } }, 30000);
window.__blDaily = { pick: dailyPick, key: dailyKey, shift: dailyShift, after: dailyAfter, again: dailyAgainOk, price: DAILY.again, get st() { return dailyGet(); }, get match() { return match && match.daily ? match : null; } };
