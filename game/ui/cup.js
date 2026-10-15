/* ===================== tournament: an offline 8-player cup =====================
   UI only: the simulation, the bot and the online code are not touched. You and 7 CPUs play a quarter-final, a semi-final and a
   final (2 lives / 2 min, 2 lives / 2 min, 3 lives / 3 min). The cup in progress is P.cup (saved with the profile), so a reload
   returns to the bracket. Pause or quit inside a cup match counts as a loss. Chips: 15 / 25 / 60 per round won, +30 for a cup won
   without losing a life. No rating change. P.cups counts the cups won.
   P.cup = { v, seed, mi (your seat 0-7), fid, pal, slots: [{n, f, pal, r}], p: [8, 4, 2, 1 seats per round, -1 = not decided],
             round (the one you play next), out (round you lost in, -1), by (who beat you), fold (you left), earned (chips), flawless } */
const CUP = { names: ["Quarter-final", "Semi-final", "Final"], lives: [2, 2, 3], secs: [120, 120, 180], chips: [15, 25, 60], flawless: 30 };
const CU = { hide: new Set(), pop: "", cheer: false, confirm: false, note: "", timers: [] };

/* ----- the draw ----- */
function cupRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function cupShuffle(arr, R) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function cupOk(c) {
  return !!c && c.v === 1 && !!FIG[c.fid] && Array.isArray(c.slots) && c.slots.length === 8 && c.slots.every((s) => s && FIG[s.f]) &&
    Array.isArray(c.p) && c.p.length === 4 && c.p.every((r, i) => Array.isArray(r) && r.length === 8 >> i) && c.mi >= 0 && c.mi < 8;
}
const cupOver = (c) => c.out >= 0 || c.p[3][0] >= 0;
// Seats 0-7 are the bracket from top to bottom: seats 2i and 2i+1 meet in quarter-final i. Ratings climb with every round on your path:
// your quarter-final opponent is a little below you, the semi-final opponent comes from the other quarter in your half (about +40),
// the final opponent from the other half (about +150).
function cupNew(fid) {
  const seed = (Math.random() * 2147483647) | 0, R = cupRng(seed), base = P.rating;
  const jit = (n) => clamp(Math.round(base + n + (R() * 2 - 1) * 10), 600, 2100);
  const mi = (R() * 8) | 0, pair = mi >> 1, half = mi >> 2, rate = new Array(8);
  rate[mi] = base;
  rate[mi ^ 1] = jit(-30);
  const near = cupShuffle([jit(10), jit(55)], R);
  rate[(pair ^ 1) * 2] = near[0]; rate[(pair ^ 1) * 2 + 1] = near[1];
  const far = cupShuffle([jit(95), jit(125), jit(155), jit(185)], R);
  for (let k = 0; k < 4; k++) rate[(half ^ 1) * 4 + k] = far[k];
  const names = cupShuffle(CPU_NAMES, R), ids = cupShuffle(FIGHTERS.map((f) => f.id), R), pal = P.pal[fid] || 0;
  const used = new Set([fid + ":" + pal]), slots = [];
  let k = 0;
  for (let i = 0; i < 8; i++) {
    if (i === mi) { slots.push({ n: "You", f: fid, pal, r: base }); continue; }
    const f = ids[k % ids.length], np = FIG[f].palettes.length;
    let pl = (R() * np) | 0;
    for (let t = 0; t < np && used.has(f + ":" + pl); t++) pl = (pl + 1) % np;
    used.add(f + ":" + pl);
    slots.push({ n: names[k], f, pal: pl, r: rate[i] });
    k++;
  }
  return { v: 1, seed, mi, fid, pal, slots, p: [[0, 1, 2, 3, 4, 5, 6, 7], [-1, -1, -1, -1], [-1, -1], [-1]], round: 0, out: -1, by: -1, fold: 0, earned: 0, flawless: true };
}
// the other matches of a round are decided by rating (Elo odds) and the cup's seed: the same cup always plays out the same way
function cupDecide(c, r) {
  const cur = c.p[r], nxt = c.p[r + 1];
  for (let i = 0; i < cur.length / 2; i++) {
    const a = cur[2 * i], b = cur[2 * i + 1];
    if (nxt[i] >= 0 || a < 0 || b < 0 || a === c.mi || b === c.mi) continue;   // your own match is decided by playing it
    const pa = 1 / (1 + Math.pow(10, (c.slots[b].r - c.slots[a].r) / 400));
    nxt[i] = cupRng(c.seed + 7919 * (r + 1) + 104729 * (i + 1))() < pa ? a : b;
  }
}
// you won or lost your match of the current round: record it, decide the other matches (all the rest of the cup after a loss)
function cupAdvance(c, won) {
  const r = c.round, idx = c.p[r].indexOf(c.mi), opp = c.p[r][idx ^ 1];
  c.p[r + 1][idx >> 1] = won ? c.mi : opp;
  cupDecide(c, r);
  if (won) { if (r < 2) c.round = r + 1; return; }
  c.out = r; c.by = opp;
  for (let k = r + 1; k < 3; k++) cupDecide(c, k);
}
// the pairs whose result is revealed one by one on the bracket screen (all but your own match)
function cupKeys(c, r) {
  const mine = c.p[r].indexOf(c.mi) >> 1, keys = [];
  for (let k = r; k < 3; k++) for (let i = 0; i < c.p[k].length / 2; i++) if (!(k === r && i === mine) && c.p[k + 1][i] >= 0) keys.push(k + ":" + i);
  return keys;
}
const cupOppOf = (c) => { const r = c.round, idx = c.p[r].indexOf(c.mi); return c.p[r][idx ^ 1]; };

/* ----- entry, start, leave ----- */
function cupOpen() { if (cupOk(P.cup)) cupShow({ quick: true }); else openSelect("cup"); }
function cupBegin(fid) {
  fid = fid || sel.fighter;
  P.last = fid; P.cup = cupNew(fid); saveProfile();
  cupShow({});
}
function cupLeave() { P.cup = null; saveProfile(); goMenu(); }

/* ----- one cup match ----- */
function cupFight() {
  const c = P.cup, r = c.round, os = c.slots[cupOppOf(c)];
  const me = FIG[c.fid], opp = FIG[os.f], myPal = me.palettes[c.pal] || me.palettes[0], oppPal = opp.palettes[os.pal] || opp.palettes[0];
  Sfx.init();
  const d = clamp((os.r - 750) / 1000, 0.08, 0.98);
  const map = (((c.seed % BL.POOL) + BL.POOL) % BL.POOL + r) % BL.POOL;   // quarter, semi and final on different maps
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: oppPal }], stocks: CUP.lives[r], time: CUP.secs[r], countdown: 150, map });
  match = { ranked: false, cup: true, round: r, d, oppRating: os.r, bot: makeBot(d, BL.BOT_STYLES[opp.id]), level: null, cpu: os.n };
  meSlot = 0;
  enterMatchUI();
}
// finishMatch calls this for a cup match: a win moves you on, a loss (also a forfeit) ends the cup, a draw is fought again
function cupMatchEnd(forfeit) {
  const c = P.cup, r = c.round, g = G, me = g.fighters[0];
  if (!forfeit && g.winner < 0) { cupShow({ note: "That one was a draw. Fight it again." }); return; }
  const won = !forfeit && g.winner === 0;
  if (won) {
    if (me.stocks < g.stocks) c.flawless = false;
    const chips = CUP.chips[r] + (r === 2 && c.flawless ? CUP.flawless : 0);
    P.tokens += chips; c.earned += chips;
    if (r === 2) { P.cups = (P.cups | 0) + 1; if (c.flawless) P.flawless = (P.flawless | 0) + 1; }
  } else c.fold = forfeit ? 1 : 0;
  const pos = c.p[r].indexOf(c.mi) >> 1;
  cupAdvance(c, won);
  saveProfile();
  cupShow({ reveal: cupKeys(c, r), pop: won && r < 2 ? (r + 1) + ":" + pos : "", cheer: won && r === 2 });
}

/* ----- the bracket screen ----- */
const cupEsc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
let cupSvgN = 0;   // each trophy drawing gets its own gradient id (a hidden copy must not own the gradient the visible one uses)
const TROPHY = `<svg class="trophy %C" viewBox="0 0 64 76" aria-hidden="true"><defs><linearGradient id="%G" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#e0983a"/></linearGradient></defs>
  <path d="M17 12H6c0 13 5 20 13 22" fill="none" stroke="#e0983a" stroke-width="4.5" stroke-linecap="round"/><path d="M47 12h11c0 13-5 20-13 22" fill="none" stroke="#e0983a" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M15 4h34v18c0 14-8 24-17 24S15 36 15 22z" fill="url(#%G)" stroke="#1f1d26" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M22 10v12c0 8 3 14 7 17" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"/>
  <path d="M28 45h8v10h-8z" fill="url(#%G)" stroke="#1f1d26" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M19 56h26l4 16H15z" fill="url(#%G)" stroke="#1f1d26" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M32 15l3 6.4 7 .9-5.1 4.8 1.3 6.9-6.2-3.4-6.2 3.4 1.3-6.9-5.1-4.8 7-.9z" fill="#fff6d0" stroke="#1f1d26" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

function cupSlot(c, r, pos) {
  const key = r + ":" + pos, hid = r > 0 && CU.hide.has((r - 1) + ":" + pos), s = hid ? -1 : c.p[r][pos];   // slot (r, pos) is the winner of pair pos in the round before
  if (s < 0) return `<div class="cs tbd" data-k="${key}"><span class="cs-ph q">?</span><span class="cs-t"><span class="cs-n">Winner</span><span class="cs-r">to be decided</span></span></div>`;
  const sl = c.slots[s], spec = FIG[sl.f], pal = spec.palettes[sl.pal] || spec.palettes[0], ti = tierInfo(sl.r), me = s === c.mi;
  const dec = c.p[r + 1][pos >> 1], shown = !CU.hide.has(r + ":" + (pos >> 1)), done = dec >= 0 && shown;
  const out = done && dec !== s, champ = done && r === 2 && dec === s;
  const cls = ["cs", me ? "me" : "", me && !out ? "path" : "", out && !(me && c.out === r) ? "out" : "", me && out ? "fell" : "", champ ? "champ" : "", CU.pop === key ? "pop" : ""].filter(Boolean).join(" ");
  return `<div class="${cls}" data-k="${key}" style="--fc:${me ? "var(--me)" : col(pal)}"><span class="cs-ph">${PORTRAITS[sl.f] ? `<img src="${PORTRAITS[sl.f]}" alt="">` : ""}</span>` +
    `<span class="cs-t"><span class="cs-n">${cupEsc(sl.n)}</span><span class="cs-r">${tierBadge(ti.i, "cs-b")}<span class="cs-tn">${ti.t.name}</span><span class="cs-rn">${sl.r}</span></span></span></div>`;
}
function cupTrophy(c) {
  const champ = c.p[3][0] >= 0 && !CU.hide.has("2:0");
  let h = TROPHY.replace("%C", champ && c.p[3][0] === c.mi ? "won" : champ ? "" : "live").replace(/%G/g, "trG" + ++cupSvgN);
  if (CU.cheer) {
    h += '<div class="spark">';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.2, rr = 50 + (i % 3) * 22; h += `<i style="--x:${Math.round(Math.cos(a) * rr)}px;--y:${Math.round(Math.sin(a) * rr * 0.8)}px;--d:${(i % 4) * 90}"></i>`; }
    h += "</div>";
  }
  return h;
}
function cupGridHTML(c) {
  const colm = (cls, r, from, n) => `<div class="cc ${cls}">${Array.from({ length: n }, (_, k) => cupSlot(c, r, from + k)).join("")}</div>`;
  const lab = (t, now) => `<div class="cc-l${now ? " now" : ""}">${t}</div>`, r = cupOver(c) ? -1 : c.round;
  return lab("Quarter-final", r === 0) + lab("Semi-final", r === 1) + lab("Final", r === 2) + lab("Semi-final", r === 1) + lab("Quarter-final", r === 0) +
    colm("q", 0, 0, 4) + colm("s", 1, 0, 2) + `<div class="cc fin">${cupSlot(c, 2, 0)}${cupTrophy(c)}${cupSlot(c, 2, 1)}</div>` + colm("s rt", 1, 2, 2) + colm("q rt", 0, 4, 4) +
    '<svg class="cup-lines"></svg>';
}
function cupListHTML(c) {
  const sec = (r, label) => {
    let h = `<div class="kicker cl-h">${label}</div>`;
    for (let i = 0; i < 4 >> r; i++) h += `<div class="cl-m">${cupSlot(c, r, 2 * i)}${cupSlot(c, r, 2 * i + 1)}</div>`;
    return h;
  };
  return sec(0, "Quarter-finals") + sec(1, "Semi-finals") + sec(2, "Final") + `<div class="cl-cup">${cupTrophy(c)}</div>`;
}
// bracket lines: each pair joins into the slot its winner goes to; your own path is lit in your palette colour
function cupLines(c) {
  const grid = $("cupGrid"), svg = grid.querySelector(".cup-lines"), W = grid.offsetWidth, H = grid.offsetHeight;
  if (!svg || !W) return;
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const at = (r, pos) => {
    const el = grid.querySelector(`[data-k="${r}:${pos}"]`);
    if (!el) return null;
    let x = 0, y = 0, e = el;   // offset*, not getBoundingClientRect, so a turned (sideways) screen measures right too
    while (e && e !== grid) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { l: x, r: x + el.offsetWidth, y: y + el.offsetHeight / 2 };
  };
  const dim = [], lit = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4 >> r; i++) {
    const left = i < 2 >> r, dst = at(r + 1, i);
    for (const pos of [2 * i, 2 * i + 1]) {
      const src = at(r, pos);
      if (!src || !dst) continue;
      const x0 = left ? src.r : src.l, x1 = left ? dst.l : dst.r, xm = Math.round((x0 + x1) / 2);
      (c.p[r][pos] === c.mi && c.p[r + 1][i] === c.mi && !CU.hide.has(r + ":" + i) ? lit : dim).push(`M${x0} ${src.y}H${xm}V${dst.y}H${x1}`);
    }
  }
  svg.innerHTML = [...dim.map((d) => `<path d="${d}"/>`), ...lit.map((d) => `<path class="lit" d="${d}"/>`)].join("");
}
function cupHead(c) {
  if (c.out >= 0) return ["Tournament · over", "Cup over"];
  if (c.p[3][0] >= 0) return ["Tournament · over", "Champion"];
  return [`Tournament · round ${c.round + 1} of 3`, CUP.names[c.round]];
}
function cupRender() {
  const c = P.cup;
  if (!cupOk(c)) return;
  const [kick, title] = cupHead(c);
  $("cupKick").textContent = kick; $("cupTitle").textContent = title; $("cupTokens").textContent = P.tokens;
  $("cupGrid").innerHTML = cupGridHTML(c);
  $("cupList").innerHTML = cupListHTML(c);
  cupLines(c);
}

/* the strip under the bracket: next opponent (slides in), the end of the cup, or the leave question */
function cupFootRender() {
  const c = P.cup, card = $("cupCard");
  const btn = (id, label, cls) => `<button class="btn${cls ? " " + cls : ""}" id="${id}"><span>${label}</span></button>`;   // cls: "primary" (gold) or "ember"
  card.className = "cf";
  if (CU.confirm) {
    card.innerHTML = `<div class="cf-t"><b>Leave the cup?</b><small>It ends here. Chips you already won stay.</small></div><div class="cf-acts">${btn("cfKeep", "Keep playing")}${btn("cfLeave", "Leave", "ember")}</div>`;
    $("cfKeep").addEventListener("click", () => { Sfx.ui(); CU.confirm = false; cupFootRender(); cupFootIn(); });
    $("cfLeave").addEventListener("click", () => { Sfx.uiBack(); cupLeave(); });
    return;
  }
  if (cupOver(c)) {
    const won = c.p[3][0] === c.mi, champ = c.slots[c.p[3][0]];
    if (won) {
      card.classList.add("win");
      card.innerHTML = `<div class="cf-t"><b>Champion!</b><small><span class="cf-chips"><span class="tokglyph"></span>+<span id="cupChipsN">0</span></span> chips from this cup${c.flawless ? " · flawless, no life lost" : ""}</small></div>` +
        `<div class="cf-acts">${btn("cfAgain", "Run it back", "primary")}${btn("cfMenu", "Menu")}</div>`;
    } else {
      const by = c.slots[c.by];
      card.classList.add("lose");
      card.innerHTML = `<div class="cf-t"><b>Out in the ${CUP.names[c.out].toLowerCase()}</b><small>${c.fold ? `You left the match. ${cupEsc(by.n)} goes through.` : `${cupEsc(by.n)} (${FIG[by.f].name}) beat you.`} ${cupEsc(champ.n)} won the cup. ${c.earned ? `+${c.earned} chips from this cup.` : "No chips this time."}</small></div>` +
        `<div class="cf-acts">${btn("cfAgain", "Run it back", "primary")}${btn("cfMenu", "Menu")}</div>`;
    }
    $("cfAgain").addEventListener("click", () => { Sfx.init(); Sfx.uiGo(); goFull(); cupBegin(c.fid); });
    $("cfMenu").addEventListener("click", () => { Sfx.init(); Sfx.uiBack(); cupLeave(); });
    return;
  }
  const oi = cupOppOf(c), os = c.slots[oi], spec = FIG[os.f], pal = spec.palettes[os.pal] || spec.palettes[0], ti = tierInfo(os.r);
  card.innerHTML = `<span class="cs-ph" style="--fc:${col(pal)}">${PORTRAITS[os.f] ? `<img src="${PORTRAITS[os.f]}" alt="">` : ""}</span>` +
    `<div class="cf-t"><span class="kicker">${CUP.names[c.round]} · ${CUP.lives[c.round]} lives</span><b>${spec.name} “${cupEsc(os.n)}”</b><small>${CU.note ? cupEsc(CU.note) : `${ti.t.name} ${os.r}`}</small></div>` +
    `<div class="cf-acts">${btn("cupGo", "Fight", "primary")}</div>`;
  $("cupGo").addEventListener("click", () => { Sfx.init(); Sfx.uiGo(); goFull(); cupFight(); });
}
function cupFootIn() { const f = $("cupFoot"); f.classList.remove("in"); void f.offsetWidth; f.classList.add("in"); }

// Show the bracket. o.reveal = pair keys ("round:pair") whose results tick in one by one; o.pop = the slot that pops in; o.cheer = the cup moment.
function cupShow(o) {
  o = o || {};
  const c = P.cup;
  if (!cupOk(c)) { P.cup = null; saveProfile(); goMenu(); return; }
  finStop(); hideBanner(); modal("pause", false); modal("help", false); modal("settings", false);
  mode = "cup"; paused = false; G = null; match = null; meSlot = 0;
  $("hud").hidden = true; $("ctl").hidden = true; releaseTouch();
  CU.timers.forEach(clearTimeout); CU.timers = [];
  Object.assign(CU, { hide: new Set(o.reveal || []), pop: o.pop || "", cheer: false, confirm: false, note: o.note || "" });
  const pal = FIG[c.fid].palettes[c.pal] || FIG[c.fid].palettes[0];
  $("scrCup").style.setProperty("--me", col(pal)); $("scrCup").style.setProperty("--meg", rgba(col(pal), 0.4));
  show("cup"); resize();
  $("cupFoot").classList.remove("in");
  cupFootRender(); cupRender();   // the strip first: its height decides how tall the bracket is
  const later = (ms, fn) => CU.timers.push(setTimeout(() => { if (mode === "cup") fn(); }, ms));
  const keys = [...CU.hide], gap = keys.length ? clamp(Math.round(1000 / keys.length), 150, 420) : 0;
  if (o.pop) Sfx.later(0, () => Sfx.tone(660, 990, 0.12, "triangle", 0.07));
  keys.forEach((k, n) => later(450 + n * gap, () => {
    CU.hide.delete(k); CU.pop = "";
    cupRender();
    Sfx.later(0, () => Sfx.tone(520 + n * 40, 520 + n * 40, 0.05, "triangle", 0.05));
  }));
  const ready = o.quick ? 0 : 450 + keys.length * gap + (keys.length ? 250 : 100);
  later(ready, () => {
    if (o.cheer) {
      CU.cheer = true; cupRender(); cupJingle();
      const total = c.earned, t0 = performance.now();
      const count = () => { const n = $("cupChipsN"); if (!n || mode !== "cup") return; const k = Math.min(1, (performance.now() - t0) / 1200); n.textContent = Math.round(total * k); if (k < 1) requestAnimationFrame(count); else if (total > 0) Sfx.uiCoin(); };
      count();
    } else if (cupOver(c) && c.out >= 0) Sfx.later(0, () => Sfx.tone(300, 110, 0.4, "sawtooth", 0.07));
    cupFootIn();
  });
}
function cupJingle() {
  Sfx.later(0, () => Sfx.tone(523, 523, 0.14, "triangle", 0.09));
  Sfx.later(130, () => Sfx.tone(659, 659, 0.14, "triangle", 0.09));
  Sfx.later(260, () => { Sfx.tone(784, 784, 0.34, "triangle", 0.1); Sfx.noise(0.3, 0.12, 5000); });
}

$("cupBack").addEventListener("click", () => {
  Sfx.init(); Sfx.uiBack();
  const c = P.cup;
  if (!cupOk(c) || cupOver(c)) { cupLeave(); return; }
  CU.confirm = !CU.confirm; cupFootRender(); cupFootIn();   // "Menu" in the middle of a cup asks first: leaving ends the cup
});
// the lines follow the slots whenever the bracket area changes size (turning the phone, the strip under it changing height)
if (window.ResizeObserver) new ResizeObserver(() => { if (mode === "cup" && cupOk(P.cup)) cupLines(P.cup); }).observe($("cupGrid"));
else window.addEventListener("resize", () => { if (mode === "cup" && cupOk(P.cup)) cupLines(P.cup); });
// a reload during a cup comes back to its bracket (menus and the tutorial have run by then; an invite link or a first-time tutorial win)
setTimeout(() => { if (mode === "menu" && cupOk(P.cup)) cupShow({ quick: true }); }, 0);
