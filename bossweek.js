"use strict";
/*
 * PotatoBrawl Boss Week: one boss a week, and the fastest KO is #1. Used by server.js and nothing else. Node's own modules and the
 * game's own core.js only.
 *
 * A week runs from Monday 00:00 to Monday 00:00 Berlin time. The boss turns Old Scratch -> Zorp -> Kraken Spud, always on Hard, with the
 * Road's HP and partner strength (game/ui/road.js ROAD_REG; tests/bossweek.js checks that they match) and one CPU partner fighter for
 * everyone that week. Each try is dealt here as a ticket with its own seed. The phone plays it with no lag, logs its own inputs in the
 * online encoding (game/ui/online.js encIn) and sends the log of a win together with the time it saw. A win whose time beats your best
 * is played again here with core.js (the partner's brain and the boss's draw only from the game's seeded random numbers, so the same
 * inputs give the same fight); this copy's time counts: the frames from GO to the final launch on the boss. A try that doesn't beat
 * your best costs the server nothing, a loss isn't even sent.
 *
 * Your best run this week, with its log, is the account file's `bw` part, which only this module writes. When a week is over it is
 * paid once (chips into the account, the paid mark in the same write) and its ranking and top 10 runs are kept in
 * <accounts>/weeks/<week>.json (the last KEEP_WEEKS weeks). The board is kept in memory: built from the account files at start and kept
 * up to date by every account write (accounts.js watch), like cpurank.js's boards.
 *
 * WebSocket messages (server.js passes them here; the account is the one Quick match's auth bound to the connection):
 *   phone -> server   bwme                       this week (anyone), your best and place, last week's prize (signed in)
 *                     bwt {v, f, pi}             a ticket for a try (v: the game version, f / pi: your fighter and skin)
 *                     bwr {id, k, n, s, fr}      a won try: part k (0..n-1) of the packed input log; fr: the time the phone saw, in frames
 *                     bd {k: "w", wk?}           the Boss Week board (wk: a finished week of the last KEEP_WEEKS)
 *   server -> phone   bw-me {wk, no, ends, boss, lv, pf, n, me: null | {t, fl, f, pl, cr, tries, r, v}, lr: null | {wk, no, boss, pl, of, c}}
 *                     bw-tk {id, wk, no, seed, boss, lv, hp, d, map, f, p, pf, pp}   the try to play
 *                     bw-no {why}                "old" (reload), "acct", "bad", "slow"
 *                     bw-res {id, ok, why, time, fl, b0, b1, pl0, pl1, n}   the verdict (time: the server's, in frames). ok true: why "best" (a new best) or "slower" (checked,
 *                                                not better than b0). ok false: "claim" (not checked: the phone's time doesn't beat your best),
 *                                                "nowin" (the server's copy isn't a win in time), "fast", "late" (no such ticket), "void"
 *                                                (another game version), "week" (dealt last week)
 *                     bd {k: "w", wk, no, boss, n, at, fin, top: [{id, nm, f, t, fl, cr, pl, r?, v?}], me: null | {i, row} | {i: 0}}
 *                                                (r, v: the run's id and game version, on the top KEEP_TOP rows and yours: a run to watch;
 *                                                fin: a finished week, from its week file)
 *
 * HTTP: GET /api/run/<id>   one run to watch (a share link #watch=<id>, the board's ▶): this week's top 100 or a kept week's top 10
 *   -> {id, wk, no, boss, lv, hp, d, pf, map, f, p, pp, seed, v, t, fl, nm, pl, place, n, cr, fin, lg}   or 404; RUN_PER_MIN per address
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { BL } = require("./game/core.js");
const { decIn } = require("./quick.js");
const { unpack, boardName } = require("./cpurank.js");

const TZ = "Europe/Berlin";
const D0 = Date.UTC(2026, 0, 5) / 864e5;   // Monday 5 January 2026 is week 0 (only the order matters)
const ROT = ["scratch", "zorp", "kraken"];  // the boss of week wk is ROT[wk % 3]
const LV = 1;                               // Hard
// the Road's numbers for each boss (game/ui/road.js ROAD_REG): his HP x hp, the CPU partner's strength mate + 0.1 a level
const ROAD = { scratch: { hp: 0.9, mate: 0.5 }, zorp: { hp: 1.2, mate: 0.4 }, kraken: { hp: 1.3, mate: 0.35 } };
const CAP = 240 * 60;                       // frames from GO: a run past 4:00 has no time (the phone ends it there)
const RULES = { stocks: 3, time: 0, countdown: 150 };   // a boss fight: 3 lives each, no clock (the Road's)
const PART = 6000, MAX_PARTS = 14, MAX_FRAMES = 24000;   // the log: 14 messages of 6,000 characters, 4:00 + the KO's tail (a hit's freeze frames log inputs too)
const CHUNK = 2000;                         // frames replayed between two looks at the network (about 10 ms)
const OPEN = 3;                             // open tickets kept per account (the last try can still arrive while the next one starts)
const GAP_MS = 2000;                        // one ticket per account this often at most
const TOP = 100, KEEP_TOP = 10, KEEP_WEEKS = 4;
const RUN_PER_MIN = 60;                     // GET /api/run/<id> per address and minute
const prize = (pl) => (pl === 1 ? 300 : pl <= 3 ? 150 : pl <= 10 ? 80 : 25);   // chips for a place (one prize per player)
const dict = (o) => Object.assign(Object.create(null), o);   // no prototype: "constructor" is no fighter or boss
const FIG = dict(Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f])));
const BOSS = dict(Object.fromEntries(BL.BOSSES.map((b) => [b.id, b])));
const PLATE_RE = /^[a-z][a-z0-9_]{0,15}$/;
const isInt = Number.isInteger;
const hex12 = (s) => typeof s === "string" && /^[0-9a-f]{12}$/.test(s);
// the caller's address (behind our own Caddy on localhost the real one is the last x-forwarded-for entry; stats.js does the same)
function clientIp(req) {
  const peer = String(req.socket.remoteAddress || "");
  if (peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1") {
    const last = String(req.headers["x-forwarded-for"] || "").split(",").pop().trim();
    if (last) return last.slice(0, 64);
  }
  return peer;
}

/* ----- the week, in Berlin time ----- */
const BFMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
function berlin(t) {
  const p = {};
  for (const x of BFMT.formatToParts(new Date(t))) p[x.type] = x.value;
  return { day: Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5, h: +p.hour };
}
const weekOf = (t) => Math.floor((berlin(t).day - D0) / 7);
function weekStart(wk) {   // Monday 00:00 in Berlin, as a time
  const day = D0 + wk * 7;
  for (const off of [1, 2]) { const t = day * 864e5 - off * 3600e3, b = berlin(t); if (b.day === day && b.h === 0) return t; }
  return day * 864e5 - 3600e3;
}
function isoWeek(wk) {   // the week's number on the calendar (its Thursday's ISO week)
  const th = (D0 + wk * 7 + 3) * 864e5, y = new Date(th).getUTCFullYear();
  return 1 + Math.floor((th - Date.UTC(y, 0, 1)) / (7 * 864e5));
}
const mapOf = (boss) => Math.max(0, BL.MAPS.findIndex((m) => m.id === BOSS[boss].map));
// week wk: the boss, his level and HP, the partner fighter and his strength, the map, when it ends
function weekSpec(wk) {
  const n = BL.FIGHTERS.length, boss = ROT[((wk % 3) + 3) % 3], R = ROAD[boss];
  return { wk, no: isoWeek(wk), boss, lv: LV, hp: R.hp, d: Math.round((R.mate + 0.1 * LV) * 100) / 100,
    pf: BL.FIGHTERS[(((wk * 5 + 2) % n) + n) % n].id, map: mapOf(boss), ends: weekStart(wk + 1) };
}

/* ----- the account file's `bw` part ----- */
function freshBw() { return { w: -1, b: null, tk: [], nw: -1, n: 0, pw: -1, cr: 0, lr: null }; }
const okFig = (f, p) => !!FIG[f] && isInt(p) && p >= 0 && p < FIG[f].palettes.length;
function cleanTk(t) {
  if (!t || typeof t !== "object" || !hex12(t.id) || !isInt(t.wk) || !isInt(t.seed) || !okFig(t.f, t.p) || !isInt(t.pp) || !Number.isFinite(t.t)) return null;
  return { id: t.id, wk: t.wk, v: t.v | 0, seed: t.seed, f: t.f, p: t.p, pp: t.pp, t: t.t };
}
function cleanRun(r) {
  if (!r || typeof r !== "object" || !hex12(r.id) || !isInt(r.t) || r.t <= 0 || !isInt(r.fl) || !okFig(r.f, r.p) || !isInt(r.seed) || typeof r.lg !== "string") return null;
  return { id: r.id, t: r.t, fl: r.fl, f: r.f, p: r.p, pp: r.pp | 0, seed: r.seed, v: r.v | 0, at: Number.isFinite(r.at) ? r.at : 0, lg: r.lg };
}
function cleanBw(o) {
  const c = freshBw();
  if (!o || typeof o !== "object") return c;
  for (const k of ["w", "nw", "pw"]) if (isInt(o[k])) c[k] = o[k];
  for (const k of ["n", "cr"]) if (isInt(o[k]) && o[k] >= 0) c[k] = o[k];
  c.b = cleanRun(o.b);
  if (!c.b) c.w = -1;
  if (Array.isArray(o.tk)) c.tk = o.tk.map(cleanTk).filter(Boolean).slice(0, OPEN);
  if (o.lr && typeof o.lr === "object" && isInt(o.lr.wk) && isInt(o.lr.pl)) {
    const l = o.lr;
    c.lr = { wk: l.wk, no: l.no | 0, boss: BOSS[l.boss] ? l.boss : "", pl: l.pl, of: l.of | 0, c: l.c | 0 };
  }
  return c;
}
// the order on a board: the faster time, then fewer of your hearts lost, then who set it first
const order = (a, b) => a.t - b.t || a.fl - b.fl || a.at - b.at || (a.id < b.id ? -1 : 1);

/* ----- the replay: the same fight as the phone's, from its inputs ----- */
// tk: a ticket, spec: its week. done({ over, won, t, fl, fr }) where t is the frames from GO to the final launch (-1: none)
function replay(tk, spec, codes, done, log) {
  const me = FIG[tk.f], pf = FIG[spec.pf], boss = BOSS[spec.boss];
  const g = BL.newGame({ players: [{ spec: me, pal: me.palettes[tk.p] || me.palettes[0] }, { spec: pf, pal: pf.palettes[tk.pp] || pf.palettes[0] },
    { spec: boss, pal: boss.palettes[0] }], stocks: RULES.stocks, time: RULES.time, countdown: RULES.countdown, map: spec.map, level: spec.lv, hpMul: spec.hp, seed: tk.seed });
  const bot = BL.makeBot(spec.d, BL.BOT_STYLES[spec.pf]);
  let fr = 0, go = -1, ko = -1;
  const out = () => ({ over: g.phase === "end" || g.phase === "over", won: g.winner === g.fighters[0].team, t: go >= 0 && ko >= 0 ? ko - go : -1, fl: g.fighters[0].falls | 0, fr });
  const run = () => {
    try {
      for (const end = Math.min(codes.length, fr + CHUNK); fr < end; fr++) {
        BL.step(g, [decIn(codes[fr]), BL.botInput(g, g.fighters[1], g.fighters[2], bot)]);
        for (const e of g.events) {
          if (e.type === "go") go = g.t;
          else if (e.type === "lethal" && e.slot === 2 && ko < 0) ko = g.t;
        }
        g.events.length = 0;
        if (g.phase === "end" || g.phase === "over") { fr++; return done(out()); }
      }
      if (fr < codes.length) setImmediate(run); else done(out());
    } catch (e) { log.warn("bossweek: replay failed", e.message); done(Object.assign(out(), { over: false })); }
  };
  run();
}

/*
 * opts: { accounts (accounts.js instance or null), seatOf(peer) -> {file, id} | null (quick.js auth), send(peer, msg), proto, log,
 *         now() (tests: a stand-in clock), T: { gap, minSpeed, hp } (tests: the ticket gap, the real-time check, his HP) }
 */
function init(opts) {
  const o = Object.assign({ log: console }, opts);
  const acct = o.accounts || null;
  const PROTO = o.proto | 0;
  const T = Object.assign({ gap: GAP_MS, minSpeed: 0.9 }, o.T);
  const now = o.now || (() => Date.now());
  const specOf = (wk) => Object.assign(weekSpec(wk), T.hp ? { hp: T.hp } : {});   // T.hp: tests only, a weaker boss for a short fight
  const S = { tickets: 0, results: 0, replays: 0, best: 0, refused: 0, paid: 0, built: false, cur: weekOf(now()) };
  const WDIR = acct ? path.join(acct.dir, "weeks") : "";
  const parts = new Map();   // peer -> { id, n, got: [], fr } a log arriving in parts
  const busy = new Set();    // account files being replayed
  const lastT = new Map();   // file -> time of the last ticket
  const lastBd = new Map();  // peer -> { t, n }
  const send = (peer, msg) => { try { o.send(peer, msg); } catch (e) { /* the peer is gone */ } };

  /* ----- the board ----- */
  const B = new Map();       // account file -> { file, id, nm, pl, w, t, fl, f, at, cr, pw }
  let sorted = null;         // this week's entries with a time, best first (null: to sort again)
  function list() {
    if (!sorted) sorted = [...B.values()].filter((e) => e.w === S.cur && e.t > 0).sort(order);
    return sorted;
  }
  const placeOf = (file) => { const e = B.get(file); return e && e.w === S.cur && e.t > 0 ? list().indexOf(e) + 1 : 0; };
  function touch(file, rec) {
    if (!rec || !rec.on || typeof rec.on.id !== "string") { if (B.delete(file)) sorted = null; return; }
    const bw = cleanBw(rec.bw), b = bw.b, old = B.get(file);
    const e = { file, id: rec.on.id, nm: boardName(rec.prof, rec.cpu && rec.cpu.nb), pl: rec.prof && PLATE_RE.test(rec.prof.plate || "") ? rec.prof.plate : "",
      w: b ? bw.w : -1, t: b ? b.t : 0, fl: b ? b.fl : 0, f: b ? b.f : "", at: b ? b.at : 0, cr: bw.cr, pw: bw.pw, rid: b ? b.id : "", rv: b ? b.v : 0 };
    if (old && JSON.stringify(old) === JSON.stringify(e)) return;   // the same entry object stays: the sorted list finds it by identity
    B.set(file, e); sorted = null;
  }
  const rowOf = (e) => ({ id: e.id, nm: e.nm, f: e.f, t: e.t, fl: e.fl, cr: e.cr, pl: e.pl });
  const rowRun = (e) => Object.assign(rowOf(e), { r: e.rid, v: e.rv });   // a row whose run can be watched
  // this week's board, or a finished week's (wk: one of the last KEEP_WEEKS, from its week file)
  function board(file, wk) {
    week();
    if (isInt(wk) && wk < S.cur) {
      const x = wk >= S.cur - KEEP_WEEKS ? readWeekC(wk) : null, spec = specOf(wk);
      const top = x ? x.top.map((r) => Object.assign({ id: r.id, nm: r.nm, f: r.f, t: r.t, fl: r.fl, cr: r.cr, pl: r.pl }, r.run ? { r: r.run.id, v: r.run.v } : {})) : [];
      const pl = x && file ? (x.rank.find((q) => q[0] === file) || [0, 0])[1] : 0, e = file ? B.get(file) : null;
      const row = pl ? top[pl - 1] || (e && e.w === wk && e.t > 0 ? rowOf(e) : null) : null;
      return { t: "bd", k: "w", wk, no: spec.no, boss: spec.boss, n: x ? x.n : 0, at: now(), fin: true, top, me: !file ? null : row ? { i: pl, row } : { i: 0 } };
    }
    const L = list(), e = file ? B.get(file) : null, spec = specOf(S.cur);
    const i = e ? L.indexOf(e) + 1 : 0;
    return { t: "bd", k: "w", wk: S.cur, no: spec.no, boss: spec.boss, n: L.length, at: now(), fin: false, top: L.slice(0, TOP).map((x, j) => (j < KEEP_TOP ? rowRun(x) : rowOf(x))),
      me: !file ? null : i ? { i, row: rowRun(e) } : { i: 0 } };
  }
  function build() {
    if (!acct) { S.built = true; return; }
    const files = acct.files();
    let i = 0;
    const step = () => {
      for (const end = Math.min(files.length, i + 200); i < end; i++) touch(files[i], acct.readFile(files[i]));
      if (i < files.length) setImmediate(step);
      else { S.built = true; week(); }
    };
    step();
  }
  if (acct && acct.watch) acct.watch(touch);

  /* ----- the end of a week: its ranking and top 10 into weeks/<wk>.json, then each player's prize, once ----- */
  const wfile = (wk) => path.join(WDIR, wk + ".json");
  function readWeek(wk) { try { const x = JSON.parse(fs.readFileSync(wfile(wk), "utf8")); return x && x.wk === wk && Array.isArray(x.rank) && Array.isArray(x.top) ? x : null; } catch (e) { return null; } }
  const WC = new Map();   // the kept weeks' files, read once (a week file never changes after it is written)
  function readWeekC(wk) { if (!acct) return null; let x = WC.get(wk); if (!x) { x = readWeek(wk); if (x) WC.set(wk, x); } return x || null; }
  function writeWeek(x) {
    fs.mkdirSync(WDIR, { recursive: true, mode: 0o700 });
    const full = wfile(x.wk), tmp = full + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(x), { mode: 0o600 }); fs.renameSync(tmp, full);
    WC.set(x.wk, x);
    // the last KEEP_WEEKS weeks are kept
    const old = fs.readdirSync(WDIR).map((f) => /^(-?\d+)\.json$/.exec(f)).filter(Boolean).map((m) => +m[1]).sort((a, b) => b - a).slice(KEEP_WEEKS);
    for (const w of old) { WC.delete(w); try { fs.unlinkSync(wfile(w)); } catch (e) { /* gone */ } }
  }
  // called before anything that reads or writes this week: a new week starts the board again and pays the weeks before it
  function week() {
    const cur = weekOf(now());
    if (cur !== S.cur) { S.cur = cur; sorted = null; }
    if (!acct || !S.built) return;
    const due = new Set();
    for (const e of B.values()) if (e.w >= 0 && e.w < cur && e.t > 0 && e.pw < e.w) due.add(e.w);
    for (const wk of [...due].sort((a, b) => a - b)) settle(wk);
  }
  function settle(wk) {
    let x = readWeek(wk);
    if (!x) {   // the first look at this finished week: its ranking, its top 10 with their runs
      const L = [...B.values()].filter((e) => e.w === wk && e.t > 0).sort(order), spec = specOf(wk);
      const top = [];
      for (const e of L.slice(0, KEEP_TOP)) {
        const b = cleanBw((acct.readFile(e.file) || {}).bw).b;
        if (b) top.push(Object.assign(rowOf(e), { run: b }));
      }
      x = { wk, no: spec.no, boss: spec.boss, lv: spec.lv, pf: spec.pf, n: L.length, top, rank: L.map((e, i) => [e.file, i + 1]) };
      try { writeWeek(x); } catch (e) { o.log.warn("bossweek: can't write the week", e.message); return; }
    }
    for (const [file, pl] of x.rank) {
      const e = B.get(file);
      if (!e || e.pw >= wk) continue;
      const c = prize(pl);
      try {
        acct.addChips(file, c, (rec) => {   // the prize and the paid mark in one write
          const bw = cleanBw(rec.bw);
          bw.pw = wk; bw.lr = { wk, no: x.no, boss: x.boss, pl, of: x.n, c };
          if (pl === 1) bw.cr++;
          rec.bw = bw;
        });
        S.paid++;
        o.log.log(`bossweek: week ${wk} #${pl} of ${x.n} ${e.id} +${c}`);
      } catch (err) { o.log.warn("bossweek: can't pay", err.message); }
    }
  }
  const ticker = setInterval(week, 60e3);   // Monday 00:00 is paid within a minute
  if (ticker.unref) ticker.unref();

  /* ----- the record ----- */
  function recOf(peer) {
    const seat = o.seatOf(peer);
    const rec = seat && acct && acct.readFile(seat.file);
    return rec ? { seat, rec, bw: cleanBw(rec.bw) } : null;
  }
  function write(file, bw) {
    try { if (!acct.writeBw(file, bw)) o.log.warn("bossweek: account gone", file.slice(0, 8)); }
    catch (e) { o.log.warn("bossweek: can't write", e.message); }
  }
  function meMsg(file, bw) {
    week();
    const spec = specOf(S.cur), e = file ? B.get(file) : null, pl = file ? placeOf(file) : 0;
    const me = !bw ? null : Object.assign({ cr: bw.cr, tries: bw.nw === S.cur ? bw.n : 0 }, pl && e ? { t: e.t, fl: e.fl, f: e.f, pl, r: e.rid, v: e.rv } : { t: 0 });
    return { t: "bw-me", wk: S.cur, no: spec.no, ends: spec.ends, boss: spec.boss, lv: spec.lv, pf: spec.pf, n: list().length, me,
      lr: bw && bw.lr && bw.lr.wk === S.cur - 1 ? bw.lr : null };
  }

  /* ----- a ticket ----- */
  function ticket(peer, m) {
    const no = (why) => send(peer, { t: "bw-no", why });
    if (m.v !== PROTO) return no("old");
    if (!okFig(m.f, m.pi)) return no("bad");
    const R = recOf(peer);
    if (!R) return no("acct");
    if (!S.built) return no("slow");
    week();
    const { seat } = R, t = now();
    if (busy.has(seat.file) || t - (lastT.get(seat.file) || 0) < T.gap) return no("slow");
    lastT.set(seat.file, t);
    const bw = cleanBw((acct.readFile(seat.file) || {}).bw), spec = specOf(S.cur);   // read again: week() may have paid into it
    const pp = spec.pf === m.f ? (m.pi + 1) % FIG[spec.pf].palettes.length : 0;
    const tk = { id: crypto.randomBytes(6).toString("hex"), wk: spec.wk, v: PROTO, seed: crypto.randomInt(1, 1e9), f: m.f, p: m.pi, pp, t };
    bw.tk = [tk, ...bw.tk.filter((x) => x.wk === spec.wk)].slice(0, OPEN);
    bw.n = bw.nw === spec.wk ? bw.n + 1 : 1; bw.nw = spec.wk;
    write(seat.file, bw);
    S.tickets++;
    send(peer, { t: "bw-tk", id: tk.id, wk: spec.wk, no: spec.no, seed: tk.seed, boss: spec.boss, lv: spec.lv, hp: spec.hp, d: spec.d, map: spec.map, f: tk.f, p: tk.p, pf: spec.pf, pp });
  }

  /* ----- a won try: the log arrives in parts, then the fight is played again here if it can beat your best ----- */
  function result(peer, m) {
    if (!hex12(m.id) || !isInt(m.k) || !isInt(m.n) || m.n < 1 || m.n > MAX_PARTS || m.k < 0 || m.k >= m.n || typeof m.s !== "string" || m.s.length > PART) return;
    let p = parts.get(peer);
    if (!p || p.id !== m.id || p.n !== m.n) { p = { id: m.id, n: m.n, got: new Array(m.n).fill(null), fr: 0 }; parts.set(peer, p); }
    p.got[m.k] = m.s;
    if (isInt(m.fr) && m.fr > 0) p.fr = m.fr;
    if (p.got.some((s) => s === null)) return;
    parts.delete(peer);
    judge(peer, p);
  }
  function judge(peer, p) {
    const res = (x) => send(peer, Object.assign({ t: "bw-res", id: p.id, ok: false }, x));
    const R = recOf(peer);
    if (!R) return res({ why: "acct" });
    if (!S.built) { setTimeout(() => judge(peer, p), 1000); return; }
    week();
    const file = R.seat.file, bw = cleanBw((acct.readFile(file) || {}).bw), tk = bw.tk.find((x) => x.id === p.id);
    if (!tk) return res({ why: "late" });
    if (busy.has(file)) { setTimeout(() => judge(peer, p), 300); return; }
    const drop = (b) => { b.tk = b.tk.filter((x) => x.id !== tk.id); write(file, b); };
    if (tk.v !== PROTO) { drop(bw); return res({ why: "void" }); }
    if (tk.wk !== S.cur) { drop(bw); return res({ why: "week" }); }
    const best = bw.w === S.cur ? bw.b : null;
    if (best && !(p.fr > 0 && p.fr <= best.t)) { drop(bw); return res({ why: "claim", b0: best.t, pl0: placeOf(file), n: list().length }); }
    const lg = p.got.join(""), codes = unpack(lg, MAX_FRAMES);
    if (!codes) { S.refused++; drop(bw); o.log.warn(`bossweek: ${tk.id} a log that doesn't unpack`); return res({ why: "nowin" }); }
    busy.add(file); S.replays++;
    const spec = specOf(tk.wk);
    replay(tk, spec, codes, (out) => {
      busy.delete(file);
      week();
      const bw2 = cleanBw((acct.readFile(file) || {}).bw);
      if (!bw2.tk.some((x) => x.id === tk.id)) return res({ why: "late" });
      S.results++;
      if (now() - tk.t < (out.fr / 60) * 1000 * T.minSpeed) { S.refused++; o.log.warn(`bossweek: ${tk.id} arrived faster than it can be played (${out.fr} frames)`); drop(bw2); return res({ why: "fast" }); }
      if (!out.over || !out.won || out.t < 0 || out.t > CAP) { drop(bw2); return res({ why: "nowin" }); }
      if (tk.wk !== S.cur) { drop(bw2); return res({ why: "week" }); }   // the week ended during the replay
      const b0 = bw2.w === S.cur ? bw2.b : null, pl0 = placeOf(file);
      const better = !b0 || out.t < b0.t || (out.t === b0.t && out.fl < b0.fl);
      if (p.fr !== out.t) o.log.warn(`bossweek: ${tk.id} the phone saw ${p.fr} frames, the server ${out.t}`);
      bw2.tk = bw2.tk.filter((x) => x.id !== tk.id);
      if (better) {
        bw2.w = S.cur;
        bw2.b = { id: tk.id, t: out.t, fl: out.fl, f: tk.f, p: tk.p, pp: tk.pp, seed: tk.seed, v: tk.v, at: now(), lg };
        S.best++;
      }
      write(file, bw2);   // the watch updates the board
      const pl1 = placeOf(file);
      o.log.log(`bossweek: ${tk.id} ${(R.rec.on && R.rec.on.id) || "?"} ${spec.boss} ${(out.t / 60).toFixed(2)} s, ${out.fl} hearts${better ? " (best)" : ""} #${pl1}`);
      res({ ok: true, why: better ? "best" : "slower", time: out.t, fl: out.fl, b0: b0 ? b0.t : 0, b1: better ? out.t : b0.t, pl0, pl1, n: list().length });
    }, o.log);
  }

  function handle(peer, m) {
    if (m.t === "bwme") {
      const R = acct ? recOf(peer) : null;
      send(peer, meMsg(R ? R.seat.file : null, R ? cleanBw((acct.readFile(R.seat.file) || {}).bw) : null));
      return true;
    }
    if (m.t === "bwt") { if (acct) ticket(peer, m); else send(peer, { t: "bw-no", why: "acct" }); return true; }
    if (m.t === "bwr") { if (acct) result(peer, m); return true; }
    if (m.t === "bd" && m.k === "w") {
      const t = now(), w = lastBd.get(peer);   // 5 boards per 2 seconds per connection
      if (!w || t - w.t > 2000) lastBd.set(peer, { t, n: 1 });
      else if (++w.n > 5) return true;
      const seat = o.seatOf(peer);
      send(peer, board(seat ? seat.file : null, m.wk));
      return true;
    }
    return false;
  }
  function gone(peer) { parts.delete(peer); lastBd.delete(peer); }

  /* ----- Jonny's stats page: this week's runs, and removing one ----- */
  function runs() { week(); return list().slice(0, TOP).map((e, i) => ({ id: e.id, nm: e.nm, t: e.t, f: e.f, pl: i + 1 })); }
  function remove(id) {
    for (const e of B.values()) if (e.id === id && e.w === S.cur && e.t > 0) {
      const rec = acct.readFile(e.file);
      if (!rec) return false;
      const bw = cleanBw(rec.bw); bw.b = null; bw.w = -1;
      write(e.file, bw);
      o.log.log(`bossweek: run of ${id} removed on the stats page`);
      return true;
    }
    return false;
  }

  /* ----- one run to watch: GET /api/run/<id> (this week's top 100 and anyone's own row, a kept week's top 10) ----- */
  function findRun(id) {
    week();
    for (const e of B.values()) {
      if (e.rid !== id || e.w !== S.cur || e.t <= 0) continue;
      const b = cleanBw((acct.readFile(e.file) || {}).bw).b;
      return b && b.id === id ? { run: b, wk: S.cur, nm: e.nm, pl: e.pl, place: placeOf(e.file), n: list().length, cr: e.cr } : null;
    }
    for (let wk = S.cur - 1; wk >= S.cur - KEEP_WEEKS; wk--) {
      const x = readWeekC(wk), i = x ? x.top.findIndex((r) => r.run && r.run.id === id) : -1;
      if (i >= 0) { const r = x.top[i]; return { run: cleanRun(r.run), wk, nm: r.nm, pl: r.pl, place: i + 1, n: x.n, cr: r.cr | 0 }; }
    }
    return null;
  }
  const hits = new Map();   // address -> { t, n } this minute
  function http(req, res, url) {
    if (!url.startsWith("/api/run/")) return false;
    const end = (code, body) => {
      res.writeHead(code, { "content-type": code === 200 ? "application/json" : "text/plain", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(body);
    };
    if (req.method !== "GET") { end(405, "GET only"); return true; }
    const ip = clientIp(req), t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (t - v.t > 60e3) hits.delete(k);
    const h = hits.get(ip);
    if (!h || t - h.t > 60e3) hits.set(ip, { t, n: 1 });
    else if (++h.n > RUN_PER_MIN) { end(429, "Too many"); return true; }
    const id = url.slice(9), f = acct && hex12(id) ? findRun(id) : null;
    if (!f || !f.run) { end(404, "No such run"); return true; }
    const r = f.run, spec = specOf(f.wk);
    end(200, JSON.stringify({ id: r.id, wk: f.wk, no: spec.no, boss: spec.boss, lv: spec.lv, hp: spec.hp, d: spec.d, pf: spec.pf, map: spec.map,
      f: r.f, p: r.p, pp: r.pp, seed: r.seed, v: r.v, t: r.t, fl: r.fl, nm: f.nm, pl: f.pl, place: f.place, n: f.n, cr: f.cr, fin: f.wk < S.cur, lg: r.lg }));
    return true;
  }

  build();
  return { handle, gone, http, runs, remove, week, stats: () => Object.assign({ board: list().length }, S), _B: B, T };
}

module.exports = { init, weekOf, weekStart, weekSpec, isoWeek, cleanBw, replay, prize, ROAD, ROT, LV, CAP, MAX_FRAMES, RULES };
