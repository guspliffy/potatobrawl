"use strict";
/*
 * PotatoBrawl online cups: the Daily Cup (every day at 20:00 Berlin) and Friends Cups (hosted with a link, any time). Used by server.js
 * and nothing else. Node's own modules and the game's own core.js only, no dependency.
 *
 * A cup is a single-elimination bracket of 4 seats (2-4 players) or 8 (5-8), one game a round with Quick match's rules (3 lives, 4:00,
 * sudden death); empty seats are CPUs. A match between two players is a Quick match room the server assigns (quick.js assign), played
 * in lockstep and decided by Quick match's referee. A match against a CPU plays on the phone with no lag from a ticket dealt here; the
 * phone logs its inputs and this module plays the same match again (cpurank.js replayCpu, as Ranked vs CPU) before it counts. CPU
 * against CPU is decided at once by a coin weighted by rating (the offline cup's rule). A draw after sudden death sends the higher seed
 * through. A match is called as soon as both its players are known: each player taps FIGHT within 60 s, one who doesn't loses by
 * walkover, and when neither does both are out (their next opponent walks over).
 * The Daily Cup: "I'm in tonight" counts all day; its lobby opens 30 min before the start; whoever is connected during the 45 s after
 * 20:00 is seeded (a page that slept wakes, reconnects and counts). 9 or more players make several cups of even size, split by rating.
 * Seeds go by the online rating; CPUs take the bottom seeds. A Friends Cup starts when its host taps START (2+ players).
 * The game pays the prizes (free entry: chips never come from players): a Daily Cup pays by place into the account file, the cup marked
 * paid in the account's `tc` part in the same write; a Friends Cup pays nothing (two accounts could farm it), it counts the cup won.
 * Every cup is saved in <accounts>/cups/<id>.json after each change, so a restart resumes it: a match without a result is called again
 * (a CPU match's ticket stays good: its log can still arrive). A running cup ends after 40 min; the places decided so far are paid.
 *
 * WebSocket messages (server.js passes them here; the account is the one Quick match's auth bound to the connection):
 *   phone -> server  tc?                       the Daily Cup today and your cup, and from now on every change of them
 *                    tci {on}                  I'm in tonight (1) or not (0), until the Daily Cup starts
 *                    tcj {v, k, f, pi}         join a lobby: k "d" the Daily Cup (from 30 min before its start), or a Friends Cup's code
 *                    tcn {v, f, pi}            host a Friends Cup (its code comes in tc)
 *                    tcs                       the host starts the Friends Cup
 *                    tcl                       leave: a lobby (the host's leave closes a Friends Cup), or a running cup (you are out)
 *                    tcp {f, pi}               your fighter for your next match, until it is called
 *                    tcgo                      FIGHT: ready for the match you were called to
 *                    tcr {id, k, n, s, ff}     a CPU match's result: part k of n of the packed input log (ff 1: forfeited)
 *   server -> phone  tc {day, cup}             the state (dayView, view); on tc? and on every change while the page watches
 *                    tc-no {why}               refused: old, acct, bad, closed, full, busy, nocup, few, host, slow
 *                    tc-call {id, key, r, ms, cpu, opp}   your match is ready: tap FIGHT within ms
 *                    tc-tk {id, key, tk: {id, seed, map, f, p, d, ni, cr}}   the CPU match to play now (you are f[0])
 *                    qm-found {..., tm: {id, key, r}}     a match against a player (quick.js): the Quick match path from there
 *                    tc-res {id, key, r, res, why, rv}    your match's result: res 1 you go through, 0 you are out; why: game, wo (walkover),
 *                                                         x (neither came), bye, quit (left the cup), left, quiet, start, nostart, ff, fast,
 *                                                         gone (no log in time), draw / seed (the higher seed went on)
 *                    tc-end {id, k, pl, of, c, w, fw, ch}  the cup is over: your place, the chips paid, your cups won, the champion's name
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { BL } = require("./game/core.js");
const { replayCpu, unpack, strength, boardName } = require("./cpurank.js");

const TZ = "Europe/Berlin";
const DAILY = { h: 20, m: 0 };                // the Daily Cup's start, Berlin time
const ORDER = { 4: [1, 4, 2, 3], 8: [1, 8, 4, 5, 2, 7, 3, 6] };   // the seed at each place of the first round (2i meets 2i+1)
const PRIZE = { 4: [60, 30, 10], 8: [120, 60, 30, 10] };          // a Daily Cup by place: champion, final, semi-final, quarter-final
const PLACE = [1, 2, 3, 5];                   // ...the places those are
const CPU_R = [1250, 1650];                   // CPUs play at the cup's average rating, between Normal and Hard
const NAMES = 36;                             // the page's CPU_NAMES (ui/screens.js): a CPU's name is CPU_NAMES[ni % its length]
const MAX_FRAMES = 24000;                     // a CPU match's log: the countdown, 4:00 and a whole sudden death (17,250 clock frames, and a hit's freeze frames log inputs too)
const MAX_PARTS = 14, PART = 6000;
const KEEP_DAYS = 7;                          // cup files kept
const TIMES = {
  tick: 1000,
  open: 30 * 60e3,                            // the Daily Cup's lobby opens this long before the start
  roll: 45e3,                                 // ...and seeds whoever is there during this long after it
  call: 60e3,                                 // a called player taps FIGHT within this
  cpu: 6 * 60e3,                              // a CPU match's log arrives within this after its ticket
  stuck: 40 * 60e3,                           // a running cup ends after this
  idle: 30 * 60e3,                            // a Friends Cup lobby nobody touched for this long closes
  keep: 30 * 60e3,                            // a finished cup stays on its players' screens this long
  host: 5000,                                 // one new Friends Cup per account this often
  minSpeed: 0.9,                              // a log can't arrive sooner than 90% of the time its frames take
};
const ALPHA = "23456789ABCDEFGHJKMNPQRSTVWXYZ";   // a Friends Cup's code: 5 of these (no 0/O, 1/I/L, U)
const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/;
const ID_RE = /^(d\d{8}[a-h]?|f[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5})$/;
const FIG = Object.assign(Object.create(null), Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f])));   // no prototype: "constructor" is no fighter
const isInt = Number.isInteger;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const okFig = (f, pi) => !!FIG[f] && isInt(pi) && pi >= 0 && pi < FIG[f].palettes.length;
const rounds = (size) => (size === 8 ? 3 : 2);

/* ----- Berlin time ----- */
const BFMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function berlin(t) {
  const p = {};
  for (const x of BFMT.formatToParts(new Date(t))) p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, h: +p.hour, mi: +p.minute };
}
// the Daily Cup's start on a Berlin day, as a time (20:00 is never in a clock change)
function startOf(day, at) {
  const [y, mo, d] = day.split("-").map(Number), h = at.h, mi = at.m;
  for (const off of [1, 2]) { const t = Date.UTC(y, mo - 1, d, h - off, mi); const b = berlin(t); if (b.day === day && b.h === h && b.mi === mi) return t; }
  return Date.UTC(y, mo - 1, d, h - 1, mi);
}
// the account file's cup record
function cleanTc(o) {
  const c = { w: 0, fw: 0, pd: [], lc: null };
  if (!o || typeof o !== "object") return c;
  for (const k of ["w", "fw"]) if (isInt(o[k]) && o[k] >= 0 && o[k] < 1e9) c[k] = o[k];
  if (Array.isArray(o.pd)) c.pd = o.pd.filter((x) => typeof x === "string" && ID_RE.test(x)).slice(0, 12);
  if (o.lc && typeof o.lc === "object" && typeof o.lc.id === "string") c.lc = o.lc;
  return c;
}

/*
 * opts: { accounts, quick (quick.js: assign, draining), seatOf(peer) -> {file, id} | null, send(peer, msg), byOf(peer), proto, log, T, now }
 */
function init(opts) {
  const o = Object.assign({ log: console }, opts);
  const acct = o.accounts || null;
  const PROTO = o.proto | 0;
  const T = Object.assign({}, TIMES, o.T);       // tests shorten the times (server.js: TC_T)
  const AT = T.at || DAILY;                      // tests: another start time
  const now = o.now || (() => Date.now());
  const DIR = acct ? path.join(acct.dir, "cups") : "";
  const S = { cups: 0, daily: 0, friends: 0, off: 0, matches: 0, cpu: 0, walkovers: 0, paid: 0, refused: 0 };
  const C = new Map();       // cup id -> cup
  const W = new Map();       // peer -> account file ("" not signed in): pages that asked tc? and get every change
  const byFile = new Map();  // account file -> its newest watching page
  const inCup = new Map();   // account file -> the id of the cup it is in (a lobby, a running cup, or one it just finished)
  const parts = new Map();   // peer -> { id, n, got } a CPU match's log arriving in parts
  const lastHost = new Map();
  const bootT = now();
  const send = (peer, msg) => { try { o.send(peer, msg); } catch (e) { /* the peer is gone */ } };
  const draining = () => !!(o.quick && o.quick.draining && o.quick.draining());

  /* ----- files ----- */
  const cfile = (id) => path.join(DIR, id + ".json");
  function save(c) {
    if (!acct) return;
    try {
      fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
      const full = cfile(c.id), tmp = full + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(c), { mode: 0o600 }); fs.renameSync(tmp, full);
    } catch (e) { o.log.warn("tourney: can't save a cup", e.message); }
  }
  function load() {
    if (!acct) return;
    let names = [];
    try { names = fs.readdirSync(DIR); } catch (e) { return; }
    const t = now();
    for (const f of names) {
      const full = path.join(DIR, f);
      if (/\.tmp$/.test(f)) { try { fs.unlinkSync(full); } catch (e) { /* gone */ } continue; }
      const mm = /^(.+)\.json$/.exec(f);
      if (!mm || !ID_RE.test(mm[1])) continue;
      let c = null;
      try { c = JSON.parse(fs.readFileSync(full, "utf8")); } catch (e) { continue; }
      if (!c || c.v !== 1 || c.id !== mm[1]) continue;
      if (t - (c.t0 || 0) > KEEP_DAYS * 864e5) { try { fs.unlinkSync(full); } catch (e) { /* gone */ } continue; }
      if (t - (c.t0 || 0) > 2 * 864e5) continue;   // only today's and yesterday's are kept in memory
      C.set(c.id, c);
      if (c.st === "run") {
        // the restart cut the running matches: a match against a player is called again; a CPU match's ticket stays good
        for (const m of Object.values(c.m)) if ((m.s === "c" || m.s === "l") && !m.tk) { m.s = "w"; m.rdy = [0, 0]; m.room = null; }
        for (const s of c.slots) if (s.h) inCup.set(s.file, c.id);
      } else if (c.st === "pre" || c.st === "open") {
        for (const e of c.ent) { e.here = 0; inCup.set(e.file, c.id); }
      } else if (c.st === "done") {
        if (!c.paid) pay(c);
        if (t - (c.te || 0) < T.keep) for (const s of c.slots) if (s.h) inCup.set(s.file, c.id);
      }
    }
  }

  /* ----- the Daily Cup ----- */
  const dailyId = (day) => "d" + day.replace(/-/g, "");
  function daily() {
    const t = now(), day = berlin(t).day, id = dailyId(day);
    let c = C.get(id);
    if (!c) {
      c = fresh(id, "d");
      c.day = day; c.at = startOf(day, AT);
      if (t >= c.at + T.roll + 60e3) { c.st = "off"; c.why = "late"; }   // (a server that started after tonight's cup)
      else if (t >= c.at - T.open) c.st = "open";
      C.set(id, c);
    }
    return c;
  }
  function fresh(id, k) { return { v: 1, id, k, st: k === "d" ? "pre" : "open", why: "", t0: now(), tu: now(), pre: [], ent: [], host: "", code: "", day: "", at: 0, paid: false }; }
  // the newest Daily Cup that has a champion: today's once played, else yesterday's
  function champ() {
    let best = null;
    for (const c of C.values()) if (c.k === "d" && c.st === "done" && c.ch >= 0 && /^d\d{8}$/.test(c.id) && (!best || c.id > best.id)) best = c;
    if (!best) return null;
    const s = best.slots[best.ch];
    return s.h ? { n: s.nm, f: s.f, pal: s.pi, day: best.day } : { n: "", c: 1, ni: s.ni, f: s.f, pal: s.pi, day: best.day };   // a CPU champion: its name on the page (CPU_NAMES[ni])
  }

  /* ----- what a page sees ----- */
  function dayView(file) {
    const d = daily(), ch = champ(), mine = file ? inCup.get(file) : "";
    return { day: d.day, at: d.at, st: d.st, why: d.why, n: d.pre.length, me: file && d.pre.includes(file) ? 1 : 0, ent: d.st === "run" || d.st === "done" ? d.hum || 0 : d.ent.length,
      in: mine && mine.slice(0, 9) === d.id ? 1 : 0, miss: file && d.miss && d.miss.includes(file) ? 1 : 0, ch, t: now() };
  }
  function view(c, file) {
    if (!c) return null;
    const mi = c.slots ? c.slots.findIndex((s) => s.h && s.file === file) : -1, t = now();
    const v = { id: c.id, k: c.k, st: c.st, why: c.why, at: c.at, host: c.host && c.host === file ? 1 : 0, code: c.k === "f" ? c.code : "", t };
    if (c.st === "pre" || c.st === "open") {
      v.ent = c.ent.map((e) => ({ n: e.nm, f: e.f, pal: e.pi, r: e.r, me: e.file === file ? 1 : 0, h: c.host === e.file ? 1 : 0 }));
      return v;
    }
    if (!c.slots) return v;
    v.size = c.size; v.mi = mi;
    v.slots = c.slots.map((s, k) => (s.h ? { n: s.nm, f: s.f, pal: s.pi, r: s.r, sd: s.sd, me: k === mi ? 1 : 0, id: s.id } : { c: 1, ni: s.ni, f: s.f, pal: s.pi, r: s.r, d: s.d, sd: s.sd }));
    v.p = c.p;
    v.m = {};
    for (const [key, m] of Object.entries(c.m)) v.m[key] = [m.s, m.why || "", m.s === "c" ? Math.max(0, m.u - t) : 0, m.rdy ? m.rdy.slice() : [0, 0], m.tk ? 1 : 0];
    v.out = mi >= 0 && c.out[mi] !== undefined ? c.out[mi] : -1;
    // your CPU match on its way (a page that comes back without it forfeits it at once instead of waiting for "gone")
    if (mi >= 0) for (const [key, m] of Object.entries(c.m)) if (m.s === "l" && m.tk) { const [r, i] = key.split(":").map(Number); if (c.p[r][2 * i + m.tk.hs] === mi) v.mytk = m.tk.id; }
    if (c.st === "done") { v.ch = c.ch; v.pl = mi >= 0 && c.res ? c.res[mi] || null : null; }
    return v;
  }
  const dirty = { day: false, cups: new Set(), queued: false };
  function changed(c, dayToo) {
    if (c) { c.tu = now(); dirty.cups.add(c.id); save(c); }
    if (dayToo || (c && c.k === "d")) dirty.day = true;
    if (!dirty.queued) { dirty.queued = true; setImmediate(flush); }
  }
  function flush() {
    dirty.queued = false;
    const day = dirty.day, cups = dirty.cups;
    dirty.day = false; dirty.cups = new Set();
    for (const [peer, file] of W) {
      const id = file ? inCup.get(file) : "";
      if (day || (id && cups.has(id))) send(peer, { t: "tc", day: dayView(file), cup: view(id ? C.get(id) : null, file) });
    }
  }
  const live = (peer) => !!peer && W.has(peer);
  const peerOf = (file) => { const p = byFile.get(file); return live(p) ? p : null; };
  function tell(file, msg) { const p = peerOf(file); if (p) send(p, msg); }

  /* ----- lobbies ----- */
  function entry(peer, seat, m) {
    const rec = acct.readFile(seat.file);
    if (!rec) return null;
    const r = rec.on && isInt(rec.on.r) ? rec.on.r : 1000;
    return { file: seat.file, id: seat.id, nm: boardName(rec.prof, rec.cpu && rec.cpu.nb), by: (o.byOf && o.byOf(peer)) || peer, f: m.f, pi: m.pi, r, t: now(), here: 1 };
  }
  // the cup an account is in and still plays (a lobby, or a running cup it isn't out of)
  function busyIn(file) {
    const c = C.get(inCup.get(file) || "");
    if (!c) return null;
    if (c.st === "pre" || c.st === "open") return c.ent.some((e) => e.file === file) ? c : null;
    if (c.st !== "run") return null;
    const k = c.slots.findIndex((s) => s.h && s.file === file);
    return k >= 0 && c.out[k] === undefined ? c : null;
  }
  function join(peer, m) {
    const no = (why) => send(peer, { t: "tc-no", why });
    if (m.v !== PROTO) return no("old");
    if (!okFig(m.f, m.pi)) return no("bad");
    const seat = o.seatOf(peer);
    if (!seat || !acct) return no("acct");
    const c = m.k === "d" ? daily() : typeof m.k === "string" && CODE_RE.test(m.k) ? C.get("f" + m.k) : null;
    if (!c) return no("nocup");
    if (c.st !== "open" || (c.k === "d" && now() < c.at - T.open)) return no("closed");
    const was = busyIn(seat.file);
    if (was && was !== c) return no("busy");
    const by = (o.byOf && o.byOf(peer)) || peer;
    const e = c.ent.find((x) => x.file === seat.file);
    if (e) { e.f = m.f; e.pi = m.pi; e.here = 1; }
    else {
      if (c.k === "f" && c.ent.length >= 8) return no("full");
      if (c.ent.some((x) => x.by === by)) return no("busy");   // one seat per browser
      const ne = entry(peer, seat, m);
      if (!ne) return no("acct");
      c.ent.push(ne);
    }
    inCup.set(seat.file, c.id);
    changed(c, c.k === "d");
  }
  function host(peer, m) {
    const no = (why) => send(peer, { t: "tc-no", why });
    if (m.v !== PROTO) return no("old");
    if (!okFig(m.f, m.pi)) return no("bad");
    const seat = o.seatOf(peer);
    if (!seat || !acct) return no("acct");
    if (busyIn(seat.file)) return no("busy");
    const t = now();
    if (t - (lastHost.get(seat.file) || 0) < T.host) return no("slow");
    lastHost.set(seat.file, t);
    let code = "";
    for (let k = 0; k < 20 && (!code || C.has("f" + code)); k++) { code = ""; for (let i = 0; i < 5; i++) code += ALPHA[crypto.randomInt(ALPHA.length)]; }
    const c = fresh("f" + code, "f");
    c.code = code; c.host = seat.file;
    const e = entry(peer, seat, m);
    if (!e) return no("acct");
    c.ent.push(e);
    C.set(c.id, c); inCup.set(seat.file, c.id);
    S.friends++;
    changed(c);
  }
  function leave(peer) {
    const seat = o.seatOf(peer);
    if (!seat) return;
    const c = C.get(inCup.get(seat.file) || "");
    if (!c) return;
    if (c.st === "pre" || c.st === "open") {
      if (c.k === "f" && c.host === seat.file) return close(c, "host");   // (every page in the lobby, the host's too, hears it)
      c.ent = c.ent.filter((e) => e.file !== seat.file);
      inCup.delete(seat.file);
      changed(c, c.k === "d");
    } else if (c.st === "run") {
      const k = c.slots.findIndex((s) => s.h && s.file === seat.file);
      if (k >= 0 && c.out[k] === undefined) {
        // you are out: a match you were called to (or are playing against a CPU) is lost; a match against a player is the referee's (left)
        c.quit = c.quit || [];
        if (!c.quit.includes(k)) c.quit.push(k);
        const at = myMatch(c, k);
        if (at && at.m.s === "c") decide(c, at.r, at.i, at.side ^ 1, "quit");
        else if (at && at.m.s === "l" && at.m.tk) decide(c, at.r, at.i, at.side ^ 1, "ff");
        pump(c);   // (a match not called yet is lost when its other player is known)
        changed(c);
      }
      inCup.delete(seat.file);
      send(peer, { t: "tc", day: dayView(seat.file), cup: null });
    } else { inCup.delete(seat.file); send(peer, { t: "tc", day: dayView(seat.file), cup: null }); }
  }
  function close(c, why) {
    c.st = "off"; c.why = why;
    changed(c);
    for (const e of c.ent) { const p = peerOf(e.file); if (p) send(p, { t: "tc", day: dayView(e.file), cup: view(c, e.file) }); inCup.delete(e.file); }
    S.off++;
  }
  // the match a seat plays next (or now): its round, pair, side
  function myMatch(c, k) {
    for (let r = 0; r < rounds(c.size); r++) {
      const at = c.p[r].indexOf(k);
      if (at < 0) continue;
      const i = at >> 1, m = c.m[r + ":" + i];
      if (m.s !== "d") return { r, i, side: at & 1, m };
    }
    return null;
  }

  /* ----- the start ----- */
  // list: the cup's players; best seeds first (rating, then who joined first)
  function seat(c, list) {
    list = list.slice().sort((a, b) => b.r - a.r || a.t - b.t);
    const size = list.length <= 4 ? 4 : 8, R = rounds(size);
    const base = clamp(Math.round(list.reduce((a, e) => a + e.r, 0) / list.length), CPU_R[0], CPU_R[1]);
    const names = [...Array(NAMES).keys()];
    for (let i = names.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [names[i], names[j]] = [names[j], names[i]]; }
    c.slots = ORDER[size].map((sd) => {
      if (sd <= list.length) { const e = list[sd - 1]; return { h: 1, file: e.file, id: e.id, nm: e.nm, by: e.by, f: e.f, pi: e.pi, r: e.r, sd }; }
      const f = BL.FIGHTERS[crypto.randomInt(BL.FIGHTERS.length)].id, r = clamp(base + crypto.randomInt(-40, 41), CPU_R[0], CPU_R[1]);
      return { h: 0, ni: names.pop(), f, pi: crypto.randomInt(FIG[f].palettes.length), r, d: strength(r), sd };
    });
    c.size = size; c.hum = list.length;
    c.p = [c.slots.map((s, k) => k)];
    for (let r = 1; r <= R; r++) c.p.push(new Array(size >> r).fill(-1));
    c.m = {};
    for (let r = 0; r < R; r++) for (let i = 0; i < size >> (r + 1); i++) c.m[r + ":" + i] = { s: "w", rdy: [0, 0], tries: 0 };
    c.out = {}; c.noshow = []; c.pld = []; c.st = "run"; c.ts = now(); c.ent = [];
    for (const s of c.slots) if (s.h) inCup.set(s.file, c.id);
    S.cups++;
    o.log.log(`tourney: ${c.id} starts, ${list.length} players in a cup of ${size}`);
  }
  // the Daily Cup's roll call is over: whoever was there is seeded (in cups of even size when more than 8 came)
  function seedDaily(c) {
    const here = c.ent.filter((e) => e.here), gone = c.ent.filter((e) => !e.here);
    c.miss = gone.map((e) => e.file);
    for (const e of gone) inCup.delete(e.file);
    if (here.length < 2) {
      c.st = "off"; c.why = here.length ? "few" : "none"; c.hum = here.length; c.ent = here;
      S.off++;
      for (const e of here) inCup.delete(e.file);
      changed(c, true);
      if (here.length) o.log.log(`tourney: ${c.id} off, only one player`);
      return;
    }
    here.sort((a, b) => b.r - a.r || a.t - b.t);
    const k = Math.ceil(here.length / 8), n = here.length;
    let at = 0;
    for (let g = 0; g < k; g++) {
      const take = Math.floor(n / k) + (g < n % k ? 1 : 0), list = here.slice(at, at + take);
      at += take;
      let cc = c;
      if (g > 0) {
        cc = fresh(c.id + "abcdefgh"[g], "d");
        cc.day = c.day; cc.at = c.at; cc.st = "open";
        C.set(cc.id, cc);
      }
      seat(cc, list);
      S.daily++;
      pump(cc);
      changed(cc);
    }
    changed(c, true);
  }
  function start(peer) {
    const seatP = o.seatOf(peer);
    if (!seatP) return;
    const c = C.get(inCup.get(seatP.file) || "");
    if (!c || c.k !== "f" || c.st !== "open") return send(peer, { t: "tc-no", why: "closed" });
    if (c.host !== seatP.file) return send(peer, { t: "tc-no", why: "host" });
    if (draining()) return send(peer, { t: "tc-no", why: "slow" });
    const here = c.ent.filter((e) => peerOf(e.file));
    if (here.length < 2) return send(peer, { t: "tc-no", why: "few" });
    for (const e of c.ent) if (!here.includes(e)) inCup.delete(e.file);
    seat(c, here);
    pump(c);
    changed(c);
  }

  /* ----- the bracket ----- */
  function coin(ra, rb) { return crypto.randomInt(1e6) / 1e6 < 1 / (1 + Math.pow(10, (rb - ra) / 400)); }
  // match (r, i) is decided: side w (0 the upper seat, 1 the lower, -1 neither) goes on
  function decide(c, r, i, w, why) {
    const key = r + ":" + i, m = c.m[key];
    if (!m || m.s === "d") return;
    const a = c.p[r][2 * i], b = c.p[r][2 * i + 1], R = rounds(c.size);
    m.s = "d"; m.why = why; m.w = w; m.room = null; m.tk = null; m.te = now();
    c.p[r + 1][i] = w === 0 ? a : w === 1 ? b : -2;
    const noShow = why === "wo" || why === "x" || why === "quit";   // not played: a player who never played a match gets no prize
    if (!c.pld) c.pld = [];   // the players with a match played (a cup from before the list: its matches so far count as not played)
    for (const [side, k] of [[0, a], [1, b]]) {
      if (k < 0) continue;
      if (!noShow && c.slots[k].h && !c.pld.includes(k)) c.pld.push(k);
      if (side === w) continue;
      c.out[k] = r;
      if (noShow && c.slots[k].h) c.noshow.push(k);
    }
    if (why === "wo" || why === "x") S.walkovers++;
    for (const [side, k] of [[0, a], [1, b]]) if (k >= 0 && c.slots[k].h) tell(c.slots[k].file, { t: "tc-res", id: c.id, key, r, res: side === w ? 1 : 0, why, rv: m.rv ? m.rv[side] : null });
    if (r + 1 === R) finish(c);
  }
  // every match whose players are known moves on: byes and CPU matches at once, the rest are called; a call that ran out is a walkover
  function pump(c) {
    if (!c || c.st !== "run") return;
    const t = now(), R = rounds(c.size);
    let again = true, guard = 0;
    while (again && c.st === "run" && guard++ < 50) {
      again = false;
      for (let r = 0; r < R && c.st === "run"; r++) for (let i = 0; i < c.size >> (r + 1); i++) {
        const key = r + ":" + i, m = c.m[key];
        if (m.s === "d") continue;
        const a = c.p[r][2 * i], b = c.p[r][2 * i + 1];
        if (a === -1 || b === -1) continue;
        if (a === -2 || b === -2) { decide(c, r, i, a === -2 && b === -2 ? -1 : a === -2 ? 1 : 0, "bye"); again = true; continue; }
        const A = c.slots[a], B = c.slots[b];
        if (!A.h && !B.h) { decide(c, r, i, coin(A.r, B.r) ? 0 : 1, "cpu"); again = true; continue; }
        // a player who left the cup loses at once
        const qa = c.quit && c.quit.includes(a), qb = c.quit && c.quit.includes(b);
        if ((qa || qb) && m.s !== "l") { decide(c, r, i, qa && qb ? -1 : qa ? 1 : 0, qa && qb ? "x" : "quit"); again = true; continue; }
        if (m.s === "w") {
          if (draining()) continue;
          m.s = "c"; m.u = t + T.call; m.rdy = [A.h ? 0 : 1, B.h ? 0 : 1]; m.tries = m.tries || 0;
          for (const [s, os] of [[A, B], [B, A]]) {
            if (s.h) tell(s.file, { t: "tc-call", id: c.id, key, r, ms: T.call, cpu: os.h ? 0 : 1, opp: os.h ? { n: os.nm, f: os.f, pal: os.pi, r: os.r } : { c: 1, ni: os.ni, f: os.f, pal: os.pi, r: os.r, d: os.d } });
          }
          changed(c);
          continue;
        }
        if (m.s === "c") {
          if (m.rdy[0] && m.rdy[1]) {
            if (draining()) { m.u = t + T.call; continue; }
            go(c, r, i);
            changed(c);
          } else if (t > m.u) {
            decide(c, r, i, m.rdy[0] ? 0 : m.rdy[1] ? 1 : -1, m.rdy[0] || m.rdy[1] ? "wo" : "x");
            again = true;
          }
          continue;
        }
        if (m.s === "l" && m.tk && t > m.tk.t + T.cpu) {   // the CPU match's log never came
          decide(c, r, i, m.tk.hs ^ 1, "gone");
          again = true;
        }
      }
    }
  }
  // both sides are ready: a Quick match room for two players, a ticket for a player against a CPU
  function go(c, r, i) {
    const key = r + ":" + i, m = c.m[key], a = c.p[r][2 * i], b = c.p[r][2 * i + 1], A = c.slots[a], B = c.slots[b];
    if (A.h && B.h) {
      const pa = peerOf(A.file), pb = peerOf(B.file);
      if (!pa || !pb) { if (!pa) m.rdy[0] = 0; if (!pb) m.rdy[1] = 0; return; }   // a page that went away taps FIGHT again when it is back
      const tm = { id: c.id, key, r };
      const room = o.quick && o.quick.assign({ peer: pa, name: A.nm, f: A.f, pi: A.pi }, { peer: pb, name: B.nm, f: B.f, pi: B.pi }, tm);
      if (!room) { m.rdy = [0, 0]; return; }
      m.s = "l"; m.room = room; m.ts = now();
      S.matches++;
      return;
    }
    const hs = A.h ? 0 : 1, H = hs ? B : A, X = hs ? A : B, peer = peerOf(H.file);
    if (!peer) { m.rdy[hs] = 0; return; }
    const seed = crypto.randomInt(1, 1e9), xp = X.f === H.f && X.pi === H.pi ? (X.pi + 1) % FIG[X.f].palettes.length : X.pi;
    m.tk = { id: crypto.randomBytes(6).toString("hex"), v: PROTO, seed, map: seed % BL.POOL, f: [H.f, X.f], p: [H.pi, xp], d: X.d, ni: X.ni, cr: X.r, t: now(), hs };
    m.s = "l"; m.ts = now();
    S.cpu++;
    send(peer, { t: "tc-tk", id: c.id, key, tk: { id: m.tk.id, seed, map: m.tk.map, f: m.tk.f, p: m.tk.p, d: m.tk.d, ni: m.tk.ni, cr: m.tk.cr } });
  }
  // quick.js: a cup match between two players ended (res [upper, lower] 1 / 0 / 0.5, or null: no result)
  function matchEnd(tm, res, why, rv) {
    const c = tm && C.get(tm.id), m = c && c.m[tm.key];
    if (!m || m.s !== "l" || m.room !== tm.room || c.st !== "run") return;
    const [r, i] = tm.key.split(":").map(Number);
    if (!res) {   // no result: called again, once; then the higher seed goes on
      m.tries = (m.tries || 0) + 1;
      if (m.tries < 2) { m.s = "w"; m.room = null; m.rdy = [0, 0]; }
      else decide(c, r, i, seedSide(c, r, i), "seed");
    } else {
      m.rv = rv;
      if (res[0] === res[1]) decide(c, r, i, seedSide(c, r, i), "draw");
      else decide(c, r, i, res[0] > res[1] ? 0 : 1, why);
    }
    pump(c);
    changed(c);
  }
  const seedSide = (c, r, i) => (c.slots[c.p[r][2 * i]].sd < c.slots[c.p[r][2 * i + 1]].sd ? 0 : 1);
  function ready(peer) {
    const seatP = o.seatOf(peer);
    if (!seatP) return;
    const c = C.get(inCup.get(seatP.file) || "");
    if (!c || c.st !== "run") return;
    const k = c.slots.findIndex((s) => s.h && s.file === seatP.file), at = k >= 0 ? myMatch(c, k) : null;
    if (!at || at.m.s !== "c") return;
    byFile.set(seatP.file, peer);
    at.m.rdy[at.side] = 1;
    pump(c);
    changed(c);
  }
  function pick(peer, m) {
    const seatP = o.seatOf(peer);
    if (!seatP || !okFig(m.f, m.pi)) return;
    const c = C.get(inCup.get(seatP.file) || "");
    if (!c) return;
    if (c.st === "pre" || c.st === "open") {
      const e = c.ent.find((x) => x.file === seatP.file);
      if (e) { e.f = m.f; e.pi = m.pi; changed(c); }
      return;
    }
    if (c.st !== "run") return;
    const k = c.slots.findIndex((s) => s.h && s.file === seatP.file), at = k >= 0 ? myMatch(c, k) : null;
    if (k < 0 || c.out[k] !== undefined || (at && at.m.s !== "w")) return;   // the ⇄ is locked once your match is called
    c.slots[k].f = m.f; c.slots[k].pi = m.pi;
    changed(c);
  }

  /* ----- a CPU match's result: the log arrives in parts, then the match is played again here ----- */
  function result(peer, m) {
    if (typeof m.id !== "string" || !/^[0-9a-f]{12}$/.test(m.id) || !isInt(m.k) || !isInt(m.n) || m.n < 1 || m.n > MAX_PARTS || m.k < 0 || m.k >= m.n ||
      typeof m.s !== "string" || m.s.length > PART) return;
    let p = parts.get(peer);
    if (!p || p.id !== m.id || p.n !== m.n) { p = { id: m.id, n: m.n, got: new Array(m.n).fill(null), ff: false }; parts.set(peer, p); }
    p.got[m.k] = m.s;
    if (m.ff) p.ff = true;
    if (p.got.some((s) => s === null)) return;
    parts.delete(peer);
    const seatP = o.seatOf(peer), c = seatP && C.get(inCup.get(seatP.file) || "");
    if (!c || c.st !== "run") return;
    let at = null;
    for (const [key, mm] of Object.entries(c.m)) if (mm.s === "l" && mm.tk && mm.tk.id === p.id) at = { key, m: mm };
    if (!at) return;
    const [r, i] = at.key.split(":").map(Number), tk = at.m.tk, H = c.slots[c.p[r][2 * i + tk.hs]];
    if (!H || !H.h || H.file !== seatP.file || at.m.busy) return;
    if (p.ff) { decide(c, r, i, tk.hs ^ 1, "ff"); pump(c); changed(c); return; }
    const codes = unpack(p.got.join(""), MAX_FRAMES);
    if (!codes || tk.v !== PROTO) {   // a log that doesn't unpack is the player's loss; a ticket of another game version can't be checked: called again
      if (!codes) { S.refused++; o.log.warn(`tourney: ${tk.id} a log that doesn't unpack`); decide(c, r, i, tk.hs ^ 1, "left"); }
      else { at.m.s = "w"; at.m.tk = null; at.m.rdy = [0, 0]; }
      pump(c); changed(c);
      return;
    }
    at.m.busy = true;
    replayCpu(tk, codes, (g, fr) => {
      at.m.busy = false;
      if (c.st !== "run" || at.m.s !== "l" || !at.m.tk || at.m.tk.id !== tk.id) return;   // decided meanwhile
      const over = g.phase === "end" || g.phase === "over";
      if (now() - tk.t < (fr / 60) * 1000 * T.minSpeed) { S.refused++; o.log.warn(`tourney: ${tk.id} arrived faster than it can be played (${fr} frames)`); decide(c, r, i, tk.hs ^ 1, "fast"); }
      else if (!over) decide(c, r, i, tk.hs ^ 1, "left");
      else if (g.winner < 0) decide(c, r, i, seedSide(c, r, i), "draw");
      else decide(c, r, i, g.winner === 0 ? tk.hs : tk.hs ^ 1, "game");
      pump(c);
      changed(c);
    }, o.log);
  }

  /* ----- the end: places and prizes ----- */
  function finish(c) {
    if (c.st !== "run") return;
    const R = rounds(c.size), w = c.p[R][0];
    c.st = "done"; c.te = now(); c.ch = w >= 0 ? w : -1;
    // a place for every player: the champion, then by the round lost in (still playing when a stuck cup ended: lost in that round)
    c.res = {};
    for (let k = 0; k < c.size; k++) {
      if (!c.slots[k].h) continue;
      let idx;
      if (k === c.ch) idx = 0;
      else {
        let lr = c.out[k];
        if (lr === undefined) { lr = 0; for (let r = 0; r < R; r++) if (c.p[r].includes(k)) lr = r; }
        idx = R - lr;
      }
      const never = c.noshow.includes(k) && !(c.pld || []).includes(k);   // a semi-finalist who misses the final's call still gets the final's prize
      c.res[k] = { pl: PLACE[idx], c: c.k === "d" && !never ? (PRIZE[c.size][idx] || 0) : 0 };
    }
    o.log.log(`tourney: ${c.id} done, champion ${c.ch >= 0 ? (c.slots[c.ch].h ? c.slots[c.ch].id : "a CPU") : "nobody"}`);
    pay(c);
  }
  function pay(c) {
    if (!acct || c.paid) return;
    const ch = c.ch >= 0 ? c.slots[c.ch] : null;
    for (const [ks, rs] of Object.entries(c.res || {})) {
      const k = +ks, s = c.slots[k], rec = acct.readFile(s.file);
      if (!rec) continue;
      const tc = cleanTc(rec.tc);
      if (tc.pd.includes(c.id)) continue;   // paid before a restart
      tc.pd = [c.id, ...tc.pd].slice(0, 12);
      if (k === c.ch) { if (c.k === "d") tc.w++; else tc.fw++; }
      tc.lc = { id: c.id, k: c.k, day: c.day || berlin(c.ts || now()).day, pl: rs.pl, of: c.hum, c: rs.c, size: c.size };
      try {
        if (rs.c > 0) acct.addChips(s.file, rs.c, (r2) => { r2.tc = tc; });   // the prize and the paid mark in one write
        else acct.writeTc(s.file, tc);
        if (rs.c > 0) S.paid++;
      } catch (e) { o.log.warn("tourney: can't pay", e.message); continue; }
      tell(s.file, { t: "tc-end", id: c.id, k: c.k, pl: rs.pl, of: c.hum, c: rs.c, w: tc.w, fw: tc.fw, ch: ch ? (ch.h ? ch.nm : "") : null, chc: ch && !ch.h ? ch.ni : -1 });
    }
    c.paid = true;
    changed(c, c.k === "d");
  }

  /* ----- the clock ----- */
  function tick() {
    const t = now();
    const d = daily();
    if (d.st === "pre" && t >= d.at - T.open) { d.st = "open"; changed(d, true); }
    if (d.st === "open") {
      if (t >= d.at) for (const e of d.ent) if (!e.here && peerOf(e.file)) e.here = 1;
      if (t >= Math.max(d.at, bootT) + T.roll) seedDaily(d);
      else if (t < d.at) for (const e of d.ent) e.here = 0;   // only the roll call after the start counts
    }
    for (const c of [...C.values()]) {
      if (c.st === "run") {
        pump(c);
        if (t - c.ts > T.stuck) { o.log.warn(`tourney: ${c.id} ran too long, ended`); finish(c); }
      } else if (c.k === "f" && c.st === "open" && t - c.tu > T.idle) close(c, "idle");
      else if ((c.st === "done" || c.st === "off") && t - (c.te || c.tu) > T.keep) {
        for (const [file, id] of inCup) if (id === c.id) inCup.delete(file);
        if (t - c.t0 > 2 * 864e5) C.delete(c.id);
      }
    }
  }
  // the roll call before the start: a page that answers tc? or joins now is here (marked again at the start)
  function hereNow(file) {
    const d = daily();
    if (d.st === "open" && now() >= d.at) { const e = d.ent.find((x) => x.file === file); if (e && !e.here) e.here = 1; }
  }

  load();
  const timer = setInterval(tick, T.tick);
  if (timer.unref) timer.unref();

  function handle(peer, m) {
    if (typeof m.t !== "string" || m.t.slice(0, 2) !== "tc") return false;
    const seat = o.seatOf(peer), file = seat ? seat.file : "";
    if (file && W.has(peer)) byFile.set(file, peer);
    switch (m.t) {
      case "tc?":
        W.set(peer, file);
        if (file) { byFile.set(file, peer); hereNow(file); }
        send(peer, { t: "tc", day: dayView(file), cup: view(C.get(file ? inCup.get(file) || "" : ""), file) });
        return true;
      case "tci": {
        const d = daily();
        if (!file || !acct) { send(peer, { t: "tc-no", why: "acct" }); return true; }
        if (d.st !== "pre" && d.st !== "open") return true;
        const has = d.pre.includes(file);
        if (m.on && !has) d.pre.push(file); else if (!m.on && has) d.pre = d.pre.filter((x) => x !== file);
        changed(d, true);
        return true;
      }
      case "tcj": W.set(peer, file); join(peer, m); return true;
      case "tcn": W.set(peer, file); host(peer, m); return true;
      case "tcs": start(peer); return true;
      case "tcl": leave(peer); return true;
      case "tcp": pick(peer, m); return true;
      case "tcgo": ready(peer); return true;
      case "tcr": result(peer, m); return true;
    }
    return false;
  }
  function gone(peer) {
    W.delete(peer); parts.delete(peer);
    for (const [file, p] of byFile) if (p === peer) byFile.delete(file);
  }
  return {
    handle, gone, tick, matchEnd,
    stats: () => Object.assign({ running: [...C.values()].filter((c) => c.st === "run").length }, S),
    T, _C: C, _inCup: inCup,
  };
}

module.exports = { init, startOf, berlin, cleanTc, PRIZE, ORDER, TIMES };
