"use strict";
/*
 * Sample play counts for the stats page (web/stats.html) and its browser test (tests/pwstatspage.py).
 *
 *   node tests/stats-sample.js <dir> [days=70]      writes <dir>/YYYY-MM-DD.json for the last N days ending today (Europe/Berlin)
 *   node tests/stats-sample.js <dir> --empty        writes only <dir>/key
 *
 * <dir>/key holds 0123456789abcdef0123456789abcdef. Run the server with STATS_DIR=<dir> and open /stats#<key>.
 * The numbers come from simulating every new player over the days after they arrive, so they agree with each other (the funnel
 * shrinks step by step, ret:<date>:<T> keys sit on the day a device first came back, started matches >= ended ones, ...).
 * Seeded PRNG: the same N gives the same numbers every run (only the calendar dates move with today).
 * The last NEW_DAYS days also carry what the counter of 2026-10-24 sends: open (opened that day, tap or not: a third more than the
 * players, the bots and quick looks) and play time (pt minutes, the pt:<5|15|30|60> day marks), both worked out without new random draws.
 */
const fs = require("fs");
const path = require("path");
const { dayIn } = require("../stats.js");

const KEY = "0123456789abcdef0123456789abcdef";
const args = process.argv.slice(2);
const empty = args.includes("--empty");
const pos = args.filter((a) => !a.startsWith("--"));
if (!pos[0]) { console.error("usage: node tests/stats-sample.js <dir> [days=70] [--empty]"); process.exit(2); }
const dir = path.resolve(pos[0]);
const N = Math.max(1, Math.min(400, parseInt(pos[1], 10) || 70));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "key"), KEY + "\n", { mode: 0o600 });
if (empty) { console.log("wrote " + path.join(dir, "key") + " only"); process.exit(0); }

// ---------- seeded random numbers (mulberry32)
let seed = 20261015;
function rand() {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p) => rand() < p;
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
function pick(w) {   // {key: weight} -> key
  let sum = 0; for (const k in w) sum += w[k];
  let r = rand() * sum;
  for (const k in w) { r -= w[k]; if (r < 0) return k; }
  return Object.keys(w)[0];
}
const geo = (mean) => Math.floor(-Math.log(1 - rand()) * mean);   // 0, 1, 2 ... with this mean

// ---------- calendar
const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
const dayOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const todayN = dayNum(dayIn("Europe/Berlin", Date.now()));
const t0 = todayN - (N - 1);
const dateOf = (i) => dayOf(t0 + i);
const weekOf = (i) => Math.floor((t0 + i + 3) / 7);      // Monday-start weeks
const monthOf = (i) => { const d = dateOf(i); return +d.slice(0, 4) * 12 + +d.slice(5, 7); };
const isWeekend = (i) => ((t0 + i + 3) % 7) >= 5;
const F = Array.from({ length: N }, () => ({}));
const NEW_DAYS = 20;
const newEra = (i) => i >= N - NEW_DAYS;
const add = (i, k, v) => { F[i][k] = (F[i][k] || 0) + (v === undefined ? 1 : v); };

// ---------- the game's vocabulary
const STEPS = ["move", "hits", "dodge", "ko"];
const FIGHTERS = { dragon: 20, samurai: 16, wizard: 14, phoenix: 14, odin: 12, alchemist: 9, gunslinger: 9, reaper: 6 };
const MODE_W = { ranked: 34, practice: 14, daily: 9, cup: 7, road: 14, boss: 5, "road-boss": 3, online: 8, "online-boss": 1.5, "online-team": 1.5, trial: 4 };
const LANGS = { en: 52, de: 15, es: 8, fr: 6, pt: 5, ru: 4, tr: 3, other: 7 };
const SCREENS = { help: 4, settings: 7, account: 2.5, stats: 3, locker: 5 };
const ERRORS = [
  ["TypeError: Cannot read properties of undefined (reading x)", 5],
  ["Script error.", 4],
  ["NotAllowedError: play() failed because the user did not interact first", 3],
  ["QuotaExceededError: Failed to execute setItem on Storage", 2],
  ["ReferenceError: webkitAudioContext is not defined", 2],
  ["RangeError: Invalid array length", 1],
];
const XSS_ERR = "Script error <u id=xss>x</u> at line 1";   // markup in a message must show as text, never as markup
const PROTO = 12;

// ---------- players
function newPlayer(i) {
  return {
    d0: i, dev: pick({ phone: 66, desktop: 27, tablet: 7 }), app: chance(0.18), lang: pick(LANGS),
    type: pick({ bounce: 45, casual: 30, regular: 25 }), fav: pick(FIGHTERS),
    tutLeft: -1, wk: -1, mo: -1, started: 0, finished: 0, road: 0, ret: false, route: false, acct: false,
  };
}
const verFor = (i) => (i < N * 0.55 ? (chance(0.8) ? PROTO - 1 : PROTO - 2) : (chance(0.85) ? PROTO : PROTO - 1));

function bucket(min, edges) { let b = edges[0]; for (const e of edges) if (min >= e) b = e; return b; }

// one match; returns "finished" | "quit" | "closed" | "drop"
function playMatch(p, i, mode, st) {
  add(i, "ms:" + mode);
  add(i, "fp:" + (chance(0.72) ? p.fav : pick(FIGHTERS)));
  const counts = mode !== "tutorial" && mode !== "trial";
  if (counts) {
    p.started++;
    if (p.started === 1) { add(i, "fn:s1"); add(i, "first:" + mode); }
    if (p.started === 2) add(i, "fn:s2");
  }
  const online = mode === "online" || mode === "online-boss" || mode === "online-team";
  const bossy = mode === "boss" || mode === "road-boss" || mode === "online-boss";
  let boss = null, lv = 0;
  if (bossy) { boss = pick({ scratch: 5, zorp: 3, kraken: 2 }); lv = pick({ 0: 6, 1: 3, 2: 1.2 }); add(i, `bs:${boss}:${lv}`); }
  const r = rand();
  const bail = mode === "tutorial" ? 0.02 : 0.07;
  if (r < bail) return "closed";                                    // page closed in the middle of the match
  if (r < bail + (mode === "tutorial" ? 0 : 0.11)) { add(i, `me:${mode}:quit`); st.min += 0.7; return "quit"; }
  if (online && chance(0.05)) { add(i, `me:${mode}:drop`); st.min += 1.2; return "drop"; }
  const winP = mode === "tutorial" ? 1 : mode === "practice" ? 0.7 : online ? 0.46 : bossy ? Math.max(0.12, 0.55 - lv * 0.2) : 0.52;
  const res = chance(winP) ? "win" : chance(0.9) ? "loss" : "draw";
  add(i, `me:${mode}:${res}`);
  const len = mode === "tutorial" ? 0 : +pick(online || mode === "ranked" ? { 1: 18, 2: 32, 3: 34, 5: 16 } : { 0: 14, 1: 38, 2: 28, 3: 16, 5: 4 });
  add(i, "ml:" + len);
  st.min += len === 0 ? 0.7 : len + 0.5;
  if (chance(0.07)) add(i, "mslow");
  if (res === "win") {
    if (mode === "road" && p.road < 24) { add(i, "rw:" + p.road); p.road += chance(0.85) ? 1 : 0; }
    if (bossy && boss && chance(1)) add(i, `bw:${boss}:${lv}`);
  }
  if (counts) {
    p.finished++;
    if (p.finished === 1) add(i, "fn:d1");
    if (p.finished === 5) add(i, "fn:d5");
    if (p.finished === 10) add(i, "fn:d10");
    if (p.finished === 25) add(i, "fn:d25");
  }
  st.fin++;
  return "finished";
}

// one visit: the first one of a new device (tutorial included) or a return
function visit(p, i, first) {
  const st = { min: 0, fin: 0, where: "menu" };
  const seen = new Set();
  const screen = (s) => { if (!seen.has(s)) { seen.add(s); add(i, "scr:" + s); } };
  let left = null;       // where the visit ended, when it ended early
  let planned;           // matches this visit
  let forced = null;
  if (first && chance(0.04)) add(i, "inv");
  if (!first && chance(0.02)) add(i, "chl:make");   // Challenge a friend: a link made after a match; opened, often on a new device, and played
  if (first && chance(0.03)) { add(i, "inv"); add(i, "chl:open"); add(i, "chl:new"); if (chance(0.6)) add(i, "chl:play"); }
  if (first || p.tutLeft >= 0) {
    // the tutorial: a new device walks it step by step; one that left in the middle may pick it up again or skip it on its next visit
    let from = first ? 0 : p.tutLeft, skipped = false;
    if (first && chance(0.2)) { add(i, "tut:fight"); st.min += 0.1; skipped = true; from = STEPS.length; }   // the welcome sheet's "Skip, just fight"
    else if (first && (add(i, "tut:go"), chance(0.05))) { add(i, "tut:skip"); st.min += 0.2; skipped = true; from = STEPS.length; }
    else if (!first && chance(0.45)) { add(i, "tut:skip"); skipped = true; from = STEPS.length; }
    p.tutLeft = -1;
    for (let k = from; k < STEPS.length && !skipped; k++) {
      add(i, "tut:" + STEPS[k]); st.min += 0.35;
      const r = rand();
      if (r < 0.02) { add(i, "tut:skip"); skipped = true; break; }
      if (r < 0.09) { left = "tut:" + STEPS[k]; p.tutLeft = k + 1; break; }
    }
    if (!left && !skipped) {
      add(i, "tut:done");
      if (chance(0.88)) {
        playMatch(p, i, "tutorial", st);
        if (chance(0.66)) { add(i, "again:tutorial"); forced = "ranked"; }
      }
    }
    if (left) { if (first) endFirst(p, i, st, left); return st; }
  }
  if (first) planned = forced ? 1 + geo(1.0) : (chance(0.3) ? 0 : 1 + geo(0.9));
  else {
    planned = chance(0.1) ? 0 : p.type === "regular" ? 1 + geo(2.4) : 1 + geo(0.9);
    if (chance(0.015)) add(i, "inv");
  }
  let mode = forced;
  for (let m = 0; m < planned; m++) {
    if (!mode) {                                              // a new pick from the menu
      const w = Object.assign({}, MODE_W);
      if (p.finished < 2) { delete w.online; delete w["online-boss"]; delete w["online-team"]; delete w["road-boss"]; delete w.boss; }
      if (p.finished < 1) delete w.trial;
      mode = pick(w);
    }
    screen("select");
    if (mode === "road" || mode === "road-boss") screen("road");
    if (mode === "online" || mode === "online-boss" || mode === "online-team") screen("online");
    if (mode === "cup") screen("cup");
    if (mode === "trial" && !p.route && chance(0.12)) { p.route = true; add(i, "route"); }
    const out = playMatch(p, i, mode, st);
    if (out === "closed") { if (first) endFirst(p, i, st, "match:" + mode); else extras(p, i, screen); return st; }
    st.where = out === "finished" ? "result" : out === "drop" ? "online" : "select";
    if (out === "finished" && m < planned - 1) {
      if (chance(0.55)) add(i, "again:" + mode); else mode = null;   // Rematch / Next, or back to the menu
    } else if (out !== "finished") mode = null;
  }
  extras(p, i, screen);
  if (first) {
    if (planned === 0) st.where = pick({ menu: 5, select: 3, road: 1, online: 1, cup: 0.5 });
    else if (st.where === "result" && chance(0.35)) st.where = "menu";
    endFirst(p, i, st, st.where);
  }
  return st;
}
function extras(p, i, screen) {
  for (const s in SCREENS) if (chance(SCREENS[s] / 100)) screen(s);
  if (p.finished >= 4 && chance(0.04)) add(i, "skin:" + p.fav);
  if (!p.acct && p.finished >= 3 && chance(0.03)) { p.acct = true; add(i, "acct"); }
  if (chance(0.012)) { const w = {}; ERRORS.forEach((x, k) => { w[k] = x[1]; }); add(i, "err:" + ERRORS[pick(w)][0]); }
}
function endFirst(p, i, st, where) {
  const m = st.min;
  add(i, "fx:" + where);
  add(i, "fl:" + bucket(m, [0, 1, 3, 10, 30]));
  add(i, "fm:" + Math.min(3, st.fin));
}

// ---------- run the days
const players = [];
for (let i = 0; i < N; i++) {
  const partial = i === N - 1 ? 0.6 : 1;                     // today is not over yet
  const t = N > 1 ? i / (N - 1) : 1;
  let target = 3 + 37 * Math.pow(t, 1.3);                     // players a day: from about 3 to about 40
  if (isWeekend(i)) target *= 1.2;
  let fresh = Math.round(target * 0.3 * (0.75 + rand() * 0.5));
  if (i < 6) fresh = [1, 0, 2, 1, 0, 1][i];                  // the first days: 0 to 2 players
  if (i === 6) fresh = 2;
  fresh = Math.round(fresh * partial);
  // new players arrive on day i; people from earlier days may come back on it (decided per player below)
  players.push.apply(players, Array.from({ length: fresh }, () => newPlayer(i)));
  for (const p of players) {
    const first = p.d0 === i;
    let on = first;
    if (!first) {
      const gap = i - p.d0;
      const pr = p.type === "bounce" ? 0 : p.type === "casual" ? 0.12 * Math.exp(-gap / 20) : 0.38 * Math.exp(-gap / 28);
      on = chance(pr * (isWeekend(i) ? 1.15 : 1) * partial);
    }
    if (!on) continue;
    add(i, "day");
    add(i, first ? "day:new" : "day:back");
    add(i, "dev:" + p.dev); if (p.app) add(i, "app:app"); else add(i, "app:web");
    add(i, "lang:" + p.lang); add(i, "gl:" + (["en", "fr", "de", "es", "ru"].includes(p.lang) ? p.lang : "en")); add(i, "ver:" + verFor(i));
    if (p.wk !== weekOf(i)) { p.wk = weekOf(i); add(i, "wk"); }
    if (p.mo !== monthOf(i)) { p.mo = monthOf(i); add(i, "mo"); }
    if (!first && !p.ret) {                                   // the first time a device comes back: every window it fits in
      p.ret = true;
      for (const T of [1, 3, 7, 14, 30]) if (i - p.d0 <= T) add(i, `ret:${dateOf(p.d0)}:${T}`);
    }
    const st = visit(p, i, first);
    if (newEra(i)) {   // the day's minutes: its matches and tutorial plus a minute and a half of menus
      const m = Math.max(1, Math.round(st.min + 1.5));
      add(i, "open"); add(i, "pt", m);
      for (const T of [5, 15, 30, 60]) if (m >= T) add(i, "pt:" + T);
    }
  }
  if (newEra(i)) add(i, "open", Math.round((F[i].day || 0) * 0.35));   // opened without a tap
  // the most players online at once: a fraction of the day's players, never more than they were
  const n = F[i].day || 0;
  const peak = n ? Math.max(1, Math.round(n * (0.1 + rand() * 0.14))) : 0;
  if (peak) F[i].peak = Math.min(n, peak);
}
// markup in an error message, to see that the page shows it as text
for (let i = Math.max(0, N - 6); i < N; i++) add(i, "err:" + XSS_ERR, 1 + (i % 3));

// ---------- write (a day without any count has no file)
let files = 0;
for (let i = 0; i < N; i++) {
  if (!Object.keys(F[i]).length) continue;
  fs.writeFileSync(path.join(dir, dateOf(i) + ".json"), JSON.stringify(F[i]));
  files++;
}
const last = F[N - 1];
console.log(`wrote ${files} day files to ${dir} (${dateOf(0)} .. ${dateOf(N - 1)}); today: ${last.day || 0} players, ${last["day:new"] || 0} new`);
