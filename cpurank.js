"use strict";
/*
 * PotatoBrawl Ranked vs CPU and the Boards. Used by server.js and nothing else. Node's own modules and the game's own core.js only.
 *
 * A Ranked CPU match is dealt here: a ticket names the CPU fighter and skin, its rating and strength, the map and the seed. The phone
 * plays it with no lag and logs its own inputs in the online encoding (game/ui/online.js encIn), then sends the log. This module plays
 * the same match again with core.js (the CPU's brain lives there and draws only from the game's seeded random numbers, so the same
 * inputs give the same match) and its copy decides: the CPU rank lives in the account file's `cpu` part, which only this module writes.
 * A ticket that never gets a result counts as a loss when the next one is dealt, or after a day.
 *
 * The Boards (the CPU rank, and the online rank of Quick match) are kept in memory: built from the account files when the server
 * starts and kept up to date by every account write (accounts.js watch), so they need no file of their own.
 *
 * WebSocket messages (server.js passes them here; the account is the one Quick match's auth bound to the connection):
 *   phone -> server   cme                          your CPU record and board places
 *                     ct {v, f, pi}                a ticket for a Ranked CPU match (v: the game version, f / pi: your fighter and skin)
 *                     cr {id, k, n, s, ff}         the result: part k (0..n-1) of the packed input log; ff 1 = forfeited
 *                     bd {k}                       a board: "c" vs CPU or "o" online
 *   server -> phone   cme {r, pk, w, l, d, n, h, pl, opl, of, tk} | cme {err: "acct" | "off"}
 *                     ct-ok {id, seed, map, f, p, cr, d, pm, ni}    the match to play (pm: a placement match, ni: the CPU's name)
 *                     ct-no {why}                  "old" (reload), "acct", "bad", "slow"
 *                     cres {id, res, why, r0, r1, dr, n, pk, w, l, d, pl0, pl1, of}   res 1 / 0.5 / 0; why: game, ff, left, fast, gone
 *                     cres {id, res: null, why}    no result: "void" (the game was updated meanwhile), "late" (already counted)
 *                     bd {k, n, at, top: [{id, nm, f, r, w, l, pl}], me: null | {i, row} | {i: 0, pn}}
 */
const crypto = require("crypto");
const { BL } = require("./game/core.js");
const { elo, decIn, codeOk, PLACING } = require("./quick.js");

const SEASON = 1;
const HIST = 20;                 // results kept per account
const CAP = 1730;                // the CPU is at full strength from this rating, and its rating stops here
const PLACE_R = 1650;            // placement matches: a Hard CPU, counted as this rating
const PLACE_FLOOR = 900;         // ...and they can't drop you below Bronze (Quick match's rule)
const SPREAD = 70;               // the CPU's rating is yours ± this
const TOP = 100;                 // rows a board sends
const OPEN_MS = 24 * 3600e3;     // a ticket with no result counts as a loss after this
const GAP_MS = 2000;             // one ticket per account this often at most
// the result's size: 14 messages of 6,000 characters. The log has one input per step, and a hit's freeze frames are steps too (the clock
// stands still), so a match logs about 1.1-1.25 inputs per clock frame: 4:00 and a whole sudden death is up to about 22,000
const MAX_PARTS = 14, PART = 6000, MAX_FRAMES = 24000;
const CHUNK = 2000;              // frames replayed between two looks at the network (about 10 ms)
const RULES = { stocks: 3, time: 240, countdown: 150 };   // the old Ranked vs a CPU: 3 lives, 4 minutes
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64I = Object.fromEntries([...B64].map((ch, i) => [ch, i]));
const FIG = Object.assign(Object.create(null), Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f])));   // no prototype: "constructor" is no fighter
const PLATE_RE = /^[a-z][a-z0-9_]{0,15}$/;
const isInt = Number.isInteger;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the CPU's strength from its rating: the page's old Ranked formula (1000 a bit above Easy, 1250 Normal, 1650 Hard, 1730 full)
const strength = (r) => clamp((r - 750) / 1000, 0.08, 0.98);
// the packed log: runs of one input code, each three characters (the code in two, then the run's length 1-64 in one)
function unpack(s, max = MAX_FRAMES) {   // max: bossweek.js allows longer runs
  if (typeof s !== "string" || s.length % 3) return null;
  const out = [];
  for (let i = 0; i < s.length; i += 3) {
    const a = B64I[s[i]], b = B64I[s[i + 1]], c = B64I[s[i + 2]];
    if (a === undefined || b === undefined || c === undefined) return null;
    const v = a * 64 + b;
    if (!codeOk(v) || out.length + c + 1 > max) return null;
    for (let k = 0; k <= c; k++) out.push(v);
  }
  return out;
}
function pack(codes) {   // tests use it (the page's own copy is in ui/vscpu.js)
  let s = "";
  for (let i = 0; i < codes.length;) {
    let n = 1;
    while (n < 64 && codes[i + n] === codes[i]) n++;
    s += B64[codes[i] >> 6] + B64[codes[i] & 63] + B64[n - 1];
    i += n;
  }
  return s;
}

/* ----- the account file's `cpu` part ----- */
function freshCpu() { return { s: SEASON, r: 1000, pk: 1000, w: 0, l: 0, d: 0, n: 0, h: [], fc: {}, rt: 0, tk: null, nb: 0 }; }
function cleanTk(t) {
  if (!t || typeof t !== "object" || typeof t.id !== "string" || !/^[0-9a-f]{12}$/.test(t.id)) return null;
  if (!isInt(t.seed) || !Array.isArray(t.f) || !Array.isArray(t.p) || !FIG[t.f[0]] || !FIG[t.f[1]] || !isInt(t.cr) || !Number.isFinite(t.t)) return null;
  return { id: t.id, v: t.v | 0, seed: t.seed, map: t.map | 0, f: t.f.slice(0, 2), p: t.p.slice(0, 2), cr: t.cr, d: +t.d || 0, pm: !!t.pm, ni: t.ni | 0, t: t.t };
}
function cleanCpu(o) {
  const c = freshCpu();
  if (!o || typeof o !== "object") return c;
  for (const k of ["r", "pk", "w", "l", "d", "n", "rt"]) if (isInt(o[k]) && o[k] >= 0 && o[k] < 1e15) c[k] = o[k];
  c.pk = Math.max(c.pk, c.r);
  if (Array.isArray(o.h)) c.h = o.h.filter((x) => x && typeof x === "object").slice(0, HIST);
  if (o.fc && typeof o.fc === "object") for (const k of Object.keys(o.fc)) if (FIG[k] && isInt(o.fc[k]) && o.fc[k] > 0) c.fc[k] = o.fc[k];
  c.tk = cleanTk(o.tk);
  c.nb = o.nb ? 1 : 0;
  return c;
}
const mostOf = (counts) => { let best = "", n = 0; for (const k of Object.keys(counts)) if (counts[k] > n) { best = k; n = counts[k]; } return best; };

// the same match as the phone's: the same players, seed and map, your logged inputs, and the CPU's brain on the game's own random numbers
// (tourney.js plays a cup's CPU matches with it too: the same rules)
function replayCpu(tk, codes, done, log) {
  const players = tk.f.map((id, k) => ({ spec: FIG[id], pal: FIG[id].palettes[tk.p[k]] || FIG[id].palettes[0] }));
  const g = BL.newGame({ players, stocks: RULES.stocks, time: RULES.time, countdown: RULES.countdown, seed: tk.seed, map: tk.map });
  const bot = BL.makeBot(tk.d, BL.BOT_STYLES[tk.f[1]]);
  let fr = 0;
  const run = () => {
    try {
      for (const end = Math.min(codes.length, fr + CHUNK); fr < end; fr++) {
        const ci = BL.botInput(g, g.fighters[1], g.fighters[0], bot);
        BL.step(g, [decIn(codes[fr]), ci]);
        g.events.length = 0;
        if (g.phase === "end" || g.phase === "over") { fr++; return done(g, fr); }
      }
      if (fr < codes.length) setImmediate(run); else done(g, fr);
    } catch (e) { (log || console).warn("cpurank: replay failed", e.message); done(g, fr); }
  };
  run();
}

/* ----- names on a board: the account name, cleaned, with a small word filter (Jonny's stats page can blank any name) ----- */
const BAD = ["fuck", "shit", "cunt", "nigg", "fag", "whore", "bitch", "slut", "nazi", "hitler", "retard", "porn", "penis", "vagina",
  "hure", "fotze", "schlampe", "wichser", "arschloch", "spast", "kanake", "neger", "schwuchtel", "missgeburt"];
function boardName(prof, nb) {
  const raw = prof && typeof prof.name === "string" ? prof.name : "";
  const nm = raw.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").trim().slice(0, 20);
  if (!nm || nb) return "Potato";
  const flat = nm.toLowerCase().replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/[^a-zäöüß]/g, "");
  return BAD.some((w) => flat.includes(w)) ? "Potato" : nm;
}

/*
 * opts: { accounts (accounts.js instance or null), seatOf(peer) -> {file, id} | null (quick.js auth), send(peer, msg), proto, log, T }
 */
function init(opts) {
  const o = Object.assign({ log: console }, opts);
  const acct = o.accounts || null;
  const PROTO = o.proto | 0;
  const T = Object.assign({ open: OPEN_MS, gap: GAP_MS, minSpeed: 0.9 }, o.T);   // tests shorten the times (server.js: CPU_T)
  const S = { tickets: 0, results: 0, refused: 0, forfeits: 0, settled: 0, voids: 0, built: false };
  const parts = new Map();   // peer -> { id, n, got: [] } a result arriving in parts
  const busy = new Set();    // account files being replayed
  const lastT = new Map();   // file -> time of the last ticket
  const lastBd = new Map();  // peer -> { t, n } boards asked for since t
  const now = () => Date.now();
  const send = (peer, msg) => { try { o.send(peer, msg); } catch (e) { /* the peer is gone */ } };

  /* ----- the boards ----- */
  const B = new Map();       // account file -> { file, id, nm, pl, c: row | null, o: row | null, cpn, opn }
  const sorted = { c: null, o: null };   // placed entries, best first (null: to sort again)
  const openTk = new Set();  // account files with a ticket and no result yet
  const rank = (k) => (a, b) => b[k].r - a[k].r || b[k].w - a[k].w || a[k].rt - b[k].rt || (a.id < b.id ? -1 : 1);
  function list(k) {
    if (!sorted[k]) sorted[k] = [...B.values()].filter((e) => e[k]).sort(rank(k));
    return sorted[k];
  }
  const placeOf = (k, file) => { const e = B.get(file); if (!e || !e[k]) return 0; return list(k).indexOf(e) + 1; };
  // one account file's entry, from the record just written or read (an account plays on the boards once it has a public id)
  function touch(file, rec) {
    const old = B.get(file);
    if (!rec || !rec.on || typeof rec.on.id !== "string") { if (old) { B.delete(file); sorted.c = sorted.o = null; } return; }
    const on = rec.on, cpu = cleanCpu(rec.cpu);
    const ofs = {};
    if (Array.isArray(on.h)) for (const x of on.h) if (x && FIG[x.f]) ofs[x.f] = (ofs[x.f] || 0) + 1;
    const lastOn = Array.isArray(on.h) && on.h[0] && Number.isFinite(on.h[0].t) ? on.h[0].t : 0;
    const e = {
      file, id: on.id, nm: boardName(rec.prof, cpu.nb), pl: rec.prof && PLATE_RE.test(rec.prof.plate || "") ? rec.prof.plate : "", nb: cpu.nb,
      c: cpu.n >= PLACING ? { r: cpu.r, w: cpu.w, l: cpu.l, f: mostOf(cpu.fc), rt: cpu.rt } : null, cpn: cpu.n,
      o: isInt(on.n) && on.n >= PLACING ? { r: on.r | 0, w: on.w | 0, l: on.l | 0, f: mostOf(ofs), rt: lastOn } : null, opn: on.n | 0,
    };
    if (cpu.tk) openTk.add(file); else openTk.delete(file);
    // a resort only when something a board shows changed (a phone's save usually changes nothing here); then the entry keeps its object,
    // since the sorted lists hold it (a new object would be missing from them: no place on the pill or the board until the next resort)
    const same = old && old.id === e.id && old.nm === e.nm && old.pl === e.pl && JSON.stringify([old.c, old.o]) === JSON.stringify([e.c, e.o]);
    if (same) Object.assign(old, e);
    else { B.set(file, e); sorted.c = sorted.o = null; }
  }
  const rowOf = (e, k) => ({ id: e.id, nm: e.nm, f: e[k].f, r: e[k].r, w: e[k].w, l: e[k].l, pl: e.pl });
  function board(k, file) {
    const L = list(k), e = file ? B.get(file) : null;
    let me = null;
    if (e && e[k]) me = { i: L.indexOf(e) + 1, row: rowOf(e, k) };
    else if (file) me = { i: 0, pn: Math.min(PLACING - 1, k === "c" ? (e ? e.cpn : 0) : (e ? e.opn : 0)) };
    return { t: "bd", k, n: L.length, at: now(), top: L.slice(0, TOP).map((x) => rowOf(x, k)), me };
  }
  // at start: every account file, a few hundred at a time so the server answers meanwhile; tickets older than a day are settled
  function build() {
    if (!acct) { S.built = true; return; }
    const files = acct.files();
    let i = 0;
    const step = () => {
      for (const end = Math.min(files.length, i + 200); i < end; i++) touch(files[i], acct.readFile(files[i]));
      if (i < files.length) setImmediate(step);
      else { S.built = true; sweep(); }
    };
    step();
  }
  function sweep() {
    const t = now();
    for (const file of [...openTk]) {
      const rec = acct && acct.readFile(file), cpu = rec ? cleanCpu(rec.cpu) : null;
      if (!cpu || !cpu.tk) { openTk.delete(file); continue; }
      if (t - cpu.tk.t > T.open && !busy.has(file)) settle(file, rec, cpu, 0, "gone", null);
    }
  }
  const sweeper = setInterval(sweep, 3600e3);
  if (sweeper.unref) sweeper.unref();
  if (acct && acct.watch) acct.watch(touch);

  /* ----- the record ----- */
  function recOf(peer) {
    const seat = o.seatOf(peer);
    const rec = seat && acct && acct.readFile(seat.file);
    return rec ? { seat, rec, cpu: cleanCpu(rec.cpu) } : null;
  }
  function meMsg(file, cpu) {
    return { t: "cme", r: cpu.r, pk: cpu.pk, w: cpu.w, l: cpu.l, d: cpu.d, n: cpu.n, h: cpu.h, pl: placeOf("c", file), opl: placeOf("o", file), of: list("c").length, tk: cpu.tk ? cpu.tk.id : "" };
  }
  function write(file, cpu) {
    try { if (!acct.writeCpu(file, cpu)) o.log.warn("cpurank: account gone", file.slice(0, 8)); }
    catch (e) { o.log.warn("cpurank: can't write", e.message); }
  }
  // a result: the CPU rank moves (Elo against the CPU's rating; a placement match counts it as 1650), the ticket is used up
  function settle(file, rec, cpu, res, why, peer) {
    const tk = cpu.tk, pl0 = placeOf("c", file);
    if (tk.v !== PROTO) {   // dealt by another game version: no result
      cpu.tk = null; write(file, cpu); S.voids++;
      if (peer) send(peer, { t: "cres", id: tk.id, res: null, why: "void" });
      return;
    }
    const r0 = cpu.r, or = tk.pm ? PLACE_R : tk.cr;
    const dr = Math.max(cpu.n < PLACING ? PLACE_FLOOR : 0, r0 + elo(r0, or, res, cpu.n)) - r0;
    cpu.r = r0 + dr; cpu.pk = Math.max(cpu.pk, cpu.r); cpu.n++;
    if (res === 1) cpu.w++; else if (res === 0) cpu.l++; else cpu.d++;
    if (dr) cpu.rt = now();
    cpu.fc[tk.f[0]] = (cpu.fc[tk.f[0]] || 0) + 1;
    cpu.h.unshift({ t: now(), of: tk.f[1], f: tk.f[0], or: tk.cr, res, dr, why, ni: tk.ni });
    cpu.h = cpu.h.slice(0, HIST);
    cpu.tk = null;
    write(file, cpu);   // the watch updates the board
    S.settled++;
    if (why === "ff") S.forfeits++;
    o.log.log(`cpurank: ${tk.id} ${(rec.on && rec.on.id) || "?"} ${res} vs ${tk.f[1]} ${tk.cr}${tk.pm ? " (placement)" : ""} ${why} ${dr >= 0 ? "+" : ""}${dr} -> ${cpu.r}`);
    if (peer) send(peer, { t: "cres", id: tk.id, res, why, r0, r1: cpu.r, dr, n: cpu.n, pk: cpu.pk, w: cpu.w, l: cpu.l, d: cpu.d, pl0, pl1: placeOf("c", file), of: list("c").length });
  }

  /* ----- a ticket ----- */
  function ticket(peer, m) {
    if (m.v !== PROTO) return send(peer, { t: "ct-no", why: "old" });
    if (!FIG[m.f] || !isInt(m.pi) || m.pi < 0 || m.pi >= FIG[m.f].palettes.length) return send(peer, { t: "ct-no", why: "bad" });
    const R = recOf(peer);
    if (!R) return send(peer, { t: "ct-no", why: "acct" });
    const { seat, rec, cpu } = R, t = now();
    if (busy.has(seat.file) || t - (lastT.get(seat.file) || 0) < T.gap) return send(peer, { t: "ct-no", why: "slow" });
    // the last ticket never got its result: it counts as a loss now (a page can't deal itself a new CPU to dodge one)
    if (cpu.tk) settle(seat.file, rec, cpu, 0, "gone", null);   // (settle updates cpu in place)
    lastT.set(seat.file, t);
    const pm = cpu.n < PLACING;
    const cr = pm ? PLACE_R : clamp(Math.round(cpu.r + (crypto.randomInt(0, 2 * SPREAD + 1) - SPREAD)), 600, CAP);
    // the CPU's fighter: any, your own one a quarter as often (the page's old cpuFoe)
    const ws = BL.FIGHTERS.map((f) => (f.id === m.f ? 1 : 4)), sum = ws.reduce((a, b) => a + b, 0);
    let x = crypto.randomInt(0, sum), k = 0;
    while (x >= ws[k]) { x -= ws[k]; k++; }
    const foe = BL.FIGHTERS[k].id, seed = crypto.randomInt(1, 1e9);
    const tk = { id: crypto.randomBytes(6).toString("hex"), v: PROTO, seed, map: seed % BL.POOL, f: [m.f, foe],
      p: [m.pi, foe === m.f ? (m.pi + 1) % FIG[foe].palettes.length : 0], cr, d: pm ? 0.9 : strength(cr), pm, ni: crypto.randomInt(0, 65536), t };
    cpu.tk = tk;
    write(seat.file, cpu);
    S.tickets++;
    send(peer, { t: "ct-ok", id: tk.id, seed, map: tk.map, f: tk.f, p: tk.p, cr, d: tk.d, pm, ni: tk.ni });
  }

  /* ----- a result: the log arrives in parts, then the match is played again here ----- */
  function result(peer, m) {
    if (typeof m.id !== "string" || !isInt(m.k) || !isInt(m.n) || m.n < 1 || m.n > MAX_PARTS || m.k < 0 || m.k >= m.n || typeof m.s !== "string" || m.s.length > PART) return;
    let p = parts.get(peer);
    if (!p || p.id !== m.id || p.n !== m.n) { p = { id: m.id, n: m.n, got: new Array(m.n).fill(null), ff: false }; parts.set(peer, p); }
    p.got[m.k] = m.s;
    if (m.ff) p.ff = true;
    if (p.got.some((s) => s === null)) return;
    parts.delete(peer);
    const R = recOf(peer);
    if (!R) return send(peer, { t: "cres", id: m.id, res: null, why: "acct" });
    const { seat, rec, cpu } = R;
    if (!cpu.tk || cpu.tk.id !== p.id) { send(peer, { t: "cres", id: p.id, res: null, why: "late" }); send(peer, meMsg(seat.file, cpu)); return; }
    if (busy.has(seat.file)) return;
    if (cpu.tk.v !== PROTO) return settle(seat.file, rec, cpu, 0, "void", peer);
    if (p.ff) return settle(seat.file, rec, cpu, 0, "ff", peer);
    const codes = unpack(p.got.join(""));
    if (!codes) { S.refused++; o.log.warn(`cpurank: ${cpu.tk.id} a log that doesn't unpack`); return settle(seat.file, rec, cpu, 0, "left", peer); }
    busy.add(seat.file);
    replay(cpu.tk, codes, (g, fr) => {
      busy.delete(seat.file);
      const rec2 = acct.readFile(seat.file), cpu2 = rec2 ? cleanCpu(rec2.cpu) : null;
      if (!cpu2 || !cpu2.tk || cpu2.tk.id !== p.id) return;   // settled meanwhile (a sweep)
      S.results++;
      const over = g.phase === "end" || g.phase === "over";
      // no game can be played faster than the clock: a log that arrives sooner than its frames take was not played
      if (now() - cpu2.tk.t < (fr / 60) * 1000 * T.minSpeed) { S.refused++; o.log.warn(`cpurank: ${p.id} arrived faster than it can be played (${fr} frames)`); return settle(seat.file, rec2, cpu2, 0, "fast", peer); }
      if (!over) return settle(seat.file, rec2, cpu2, 0, "left", peer);   // the log stops before the match ends: left
      settle(seat.file, rec2, cpu2, g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5, "game", peer);
    });
  }
  const replay = (tk, codes, done) => replayCpu(tk, codes, done, o.log);

  function handle(peer, m) {
    if (m.t === "cme") {
      if (!acct) { send(peer, { t: "cme", err: "off" }); return true; }
      const R = recOf(peer);
      send(peer, R ? meMsg(R.seat.file, R.cpu) : { t: "cme", err: "acct" });
      return true;
    }
    if (m.t === "ct") { if (acct) ticket(peer, m); else send(peer, { t: "ct-no", why: "acct" }); return true; }
    if (m.t === "cr") { if (acct) result(peer, m); return true; }
    if (m.t === "bd") {
      if (m.k !== "c" && m.k !== "o") return true;
      const t = now(), w = lastBd.get(peer);   // 5 boards per 2 seconds per connection (tab taps come in bursts)
      if (!w || t - w.t > 2000) lastBd.set(peer, { t, n: 1 });
      else if (++w.n > 5) return true;
      const seat = o.seatOf(peer);
      send(peer, board(m.k, seat ? seat.file : null));
      return true;
    }
    return false;
  }
  function gone(peer) { parts.delete(peer); lastBd.delete(peer); }

  /* ----- Jonny's stats page: the names on both boards, and blanking one ----- */
  function names() {
    const seen = new Map();
    for (const k of ["c", "o"]) list(k).slice(0, TOP).forEach((e, i) => {
      const x = seen.get(e.id) || { id: e.id, nm: e.nb ? boardName((acct.readFile(e.file) || {}).prof, 0) : e.nm, nb: e.nb, c: 0, o: 0 };
      x[k] = i + 1; seen.set(e.id, x);
    });
    return [...seen.values()];
  }
  function blank(id, on) {
    for (const e of B.values()) if (e.id === id) {
      const rec = acct.readFile(e.file);
      if (!rec) return false;
      const cpu = cleanCpu(rec.cpu); cpu.nb = on ? 1 : 0;
      write(e.file, cpu);
      return true;
    }
    return false;
  }

  build();
  return { handle, gone, names, blank, stats: () => Object.assign({ boardC: list("c").length, boardO: list("o").length, open: openTk.size }, S), sweep, _B: B, T };
}

module.exports = { init, pack, unpack, replayCpu, cleanCpu, strength, boardName, CAP, PLACE_R, SPREAD, RULES };
