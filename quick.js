"use strict";
/*
 * PotatoBrawl Quick match: one queue for Ranked and Casual 1v1 against real players, and the referee that decides every
 * Ranked match. Used by server.js and nothing else. Node's own modules and the game's own core.js only, no dependency.
 *
 * The two phones play a Quick match exactly like a friend match (lockstep, inputs in their presence), in a room the server
 * reserves for the two of them. The server already passes every presence message on, so it reads the inputs out of them,
 * plays the same game with core.js as both inputs of a frame arrive (about 4 microseconds a frame) and decides a Ranked
 * match from its own copy: a phone can never change the result or the rating. The rank lives in the account file's `on`
 * part (accounts.js), which only this module writes.
 *
 * WebSocket messages (server.js passes them here):
 *   phone -> server   auth {code}                      the account's sync code, once per connection
 *                     qm {v, mode "r"|"c", f, pi, w}   search (w: seconds already waited, kept across a hidden page; max 60)
 *                     qmx                              stop searching
 *   server -> phone   me {id, r, pk, w, l, d, n, h} | me {err}           your online record (err: "off" | "unknown")
 *                     qm-wait {n, on, rng, hold}       searching: players searching, online, your range (-1 = anyone), hold = updating
 *                     qm-no {why}                      can't search: "old" (reload), "acct" (Ranked needs an account), "bad"
 *                     qm-x {why}                       your search ended: "elsewhere" (this account searches on another page)
 *                     qm-found {id, room, role, seed, f, p, r, ranked, fb, opp}
 *                     qm-off {id, why}                 the match never started ("nostart", "left"): no result
 *                     qm-res {id, res, why, r0, r1, dr, n, pk, w, l, d}   a Ranked verdict (res 1 / 0.5 / 0 for you; why: game,
 *                                                      left, quiet, start); qm-res {id, res: null, why: "void"} = no result
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { BL } = require("./game/core.js");

const RULES = { l: 3, t: 4, b: 1 };           // every Quick match: 3 lives, 4 minutes, one game
const SEASON = 1;
const PLACING = 5;                            // the first ranked matches show "Placing n of 5" instead of a tier
const PLACE_FLOOR = 900;                      // ...and can't drop you below Bronze (the game's TIERS)
const HIST = 20;                              // online results kept per account
const TIMES = {
  tick: 1000,                                 // the pairing and timeout check
  range: [[10, 200], [20, 400]],              // rating range by seconds waited; anyone after the last
  fallback: 20,                               // seconds a Ranked player waits for another Ranked player before taking Casual
  noStart: 25000,                             // found but no valid start message: no result
  quiet: 15000,                               // a player who sends nothing this long in a running Ranked match loses
  keep: 120000,                               // a decided match's room stays reserved this long (results, rematch handshake)
  waitMsg: 2000,                              // qm-wait every
};
const ROOM_PREFIX = "qm";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64I = Object.fromEntries([...B64].map((ch, i) => [ch, i]));
const ULTI_BASE = 2592, CODES = ULTI_BASE + 81 * 16, NEUTRAL = 1280;
const FIG = Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f]));
const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// the game version the phones must have: the same PROTO as the page this server serves (game/ui/online.js)
function readProto() {
  try { const m = /const PROTO = (\d+);/.exec(fs.readFileSync(path.join(__dirname, "game", "ui", "online.js"), "utf8")); return m ? +m[1] : 0; }
  catch (e) { return 0; }
}
// the same decoding as the page's decIn (game/ui/online.js)
function decIn(v) {
  const u = v >= ULTI_BASE, b = u ? (v - ULTI_BASE) & 15 : v & 31, q = u ? (v - ULTI_BASE) >> 4 : v >> 5;
  return { x: (Math.floor(q / 9) - 4) / 4, y: ((q % 9) - 4) / 4, jump: !!(b & 1), light: !!(b & 2), heavy: !!(b & 4), special: !!(b & 8), dodge: !!(b & 16), ulti: u };
}
const pubId = () => { const b = crypto.randomBytes(10); let s = ""; for (let i = 0; i < 10; i++) s += ALPHA[b[i] & 31]; return s; };
const isInt = Number.isInteger;
// Elo: K 48 for the first 10 ranked matches, then 32 (the game's old Ranked numbers)
function elo(ra, rb, res, n) { const K = n < 10 ? 48 : 32, E = 1 / (1 + Math.pow(10, (rb - ra) / 400)); return Math.round(K * (res - E)); }
function freshOn() { return { id: pubId(), s: SEASON, r: 1000, pk: 1000, w: 0, l: 0, d: 0, n: 0, last: "", h: [] }; }
// a stored `on` part, cleaned (a missing or broken one = a fresh record with the same id if it had one)
function cleanOn(o) {
  const on = freshOn();
  if (!o || typeof o !== "object") return on;
  if (typeof o.id === "string" && /^[0-9A-Z]{10}$/.test(o.id)) on.id = o.id;
  for (const k of ["r", "pk", "w", "l", "d", "n"]) if (isInt(o[k]) && o[k] >= 0 && o[k] < 1e9) on[k] = o[k];
  on.pk = Math.max(on.pk, on.r);
  if (typeof o.last === "string" && o.last.length <= 10) on.last = o.last;
  if (Array.isArray(o.h)) on.h = o.h.filter((x) => x && typeof x === "object").slice(0, HIST);
  return on;
}
const meMsg = (on) => ({ t: "me", id: on.id, r: on.r, pk: on.pk, w: on.w, l: on.l, d: on.d, n: on.n, h: on.h });

/*
 * opts: { accounts (accounts.js instance or null), send(peer, msg), nameOf(peer), byOf(peer), online() (players connected), log }
 */
function init(opts) {
  const o = Object.assign({ log: console }, opts);
  const T = Object.assign({}, TIMES, o.T);   // tests shorten the times (server.js: QM_T)
  const PROTO = o.proto || readProto();
  const acct = o.accounts || null;
  const Q = new Map();        // peer -> a search { peer, file, id, last, name, by, mode, f, pi, r, n, since, sent }
  const M = new Map();        // room -> a match
  const ofPeer = new Map();   // peer -> room of the match it is in
  const authN = new Map();    // peer -> wrong codes tried (8 at most)
  const seats = new Map();    // peer -> { file, id } bound by auth
  const S = { found: 0, ranked: 0, casual: 0, verdicts: 0, voids: 0, drift: 0 };
  let draining = false;

  const now = () => Date.now();
  const send = (peer, msg) => { try { o.send(peer, msg); } catch (e) { /* the peer is gone */ } };
  const waited = (q, t) => (t - q.since) / 1000;
  const range = (q, t) => { const w = waited(q, t); for (const [s, r] of T.range) if (w < s) return r; return Infinity; };

  /* ----- accounts ----- */
  function onOf(file) {
    const rec = acct && acct.readFile(file);
    return rec ? cleanOn(rec.on) : null;
  }
  function auth(peer, code) {
    if ((authN.get(peer) || 0) >= 8) return;   // 8 wrong codes per connection (a page signs in again after every reconnect)
    if (!acct) return send(peer, { t: "me", err: "off" });
    const file = acct.fileOfCode(code);
    const rec = file && acct.readFile(file);
    if (!rec) { authN.set(peer, (authN.get(peer) || 0) + 1); setTimeout(() => send(peer, { t: "me", err: "unknown" }), 350); return; }   // as slow as the HTTP side
    const on = cleanOn(rec.on);   // the first time: a fresh record (Season 1 at 1000) with its public id
    if (!rec.on || rec.on.id !== on.id) { try { acct.writeOn(file, on); } catch (e) { o.log.warn("quick: can't write", e.message); } }
    seats.set(peer, { file, id: on.id });
    send(peer, meMsg(on));
  }

  /* ----- the queue ----- */
  function search(peer, m) {
    if (m.v !== PROTO) return send(peer, { t: "qm-no", why: "old" });
    if ((m.mode !== "r" && m.mode !== "c") || !FIG[m.f] || !isInt(m.pi) || m.pi < 0 || m.pi >= FIG[m.f].palettes.length) return send(peer, { t: "qm-no", why: "bad" });
    const cur = ofPeer.get(peer);
    if (cur) {   // a page that searches again has left its last match; one still running can't be left this way
      const mm = M.get(cur);
      if (mm && !mm.done) return send(peer, { t: "qm-no", why: "busy" });
      ofPeer.delete(peer);
    }
    const seat = seats.get(peer) || null;
    if (m.mode === "r" && !seat) return send(peer, { t: "qm-no", why: "acct" });
    const on = seat ? onOf(seat.file) : null;
    if (m.mode === "r" && !on) return send(peer, { t: "qm-no", why: "acct" });
    // one search per account: a second page's search replaces the first
    if (seat) for (const q of Q.values()) if (q.peer !== peer && q.file === seat.file) { Q.delete(q.peer); send(q.peer, { t: "qm-x", why: "elsewhere" }); }
    const old = Q.get(peer), t = now(), w = Math.min(60, Math.max(0, +m.w || 0));
    Q.set(peer, { peer, file: seat ? seat.file : null, id: seat ? seat.id : "", last: on ? on.last : "", name: o.nameOf(peer) || "Potato", by: o.byOf(peer) || peer,
      mode: m.mode, f: m.f, pi: m.pi, r: on ? on.r : 1000, n: on ? on.n : 0, since: old ? old.since : t - w * 1000, sent: 0 });
    waitMsg(Q.get(peer), t);
  }
  function stop(peer) { Q.delete(peer); }
  function waitMsg(q, t) { q.sent = t; send(q.peer, { t: "qm-wait", n: Q.size, on: o.online(), rng: range(q, t) === Infinity ? -1 : range(q, t), hold: draining ? 1 : 0 }); }

  // Ranked when both picked Ranked and they did not just play each other; else Casual, which a Ranked player takes after T.fallback s
  function pairKind(a, b, t) {
    if (a.by === b.by || (a.file && a.file === b.file)) return null;
    const diff = Math.abs(a.r - b.r);
    if (diff > Math.max(range(a, t), range(b, t))) return null;
    const rematch = !!(a.id && b.id && (a.last === b.id || b.last === a.id));
    if (a.mode === "r" && b.mode === "r" && !rematch) return "r";
    const ok = (q) => q.mode === "c" || waited(q, t) >= T.fallback;
    return ok(a) && ok(b) ? "c" : null;
  }
  function pairAll() {
    if (draining) return;
    const t = now(), list = [...Q.values()].sort((x, y) => x.since - y.since), used = new Set();
    for (const a of list) {
      if (used.has(a.peer)) continue;
      let best = null;
      for (const b of list) {
        if (b === a || used.has(b.peer)) continue;
        const k = pairKind(a, b, t);
        if (!k) continue;
        const score = (k === "r" ? 0 : 1e6) + Math.abs(a.r - b.r);   // a Ranked pair first, then the closest rating
        if (!best || score < best.score) best = { b, k, score };
      }
      if (best) { used.add(a.peer); used.add(best.b.peer); found(a, best.b, best.k === "r", t); }
    }
  }
  function found(a, b, ranked, t) {
    Q.delete(a.peer); Q.delete(b.peer);
    const room = ROOM_PREFIX + crypto.randomBytes(8).toString("hex").slice(0, 12);
    const seed = crypto.randomInt(1, 1e9), f = [a.f, b.f], p = [a.pi, b.pi];
    if (f[0] === f[1] && p[0] === p[1]) p[1] = (p[1] + 1) % FIG[f[1]].palettes.length;   // the page's own mirror rule
    const fb = !ranked && (a.mode === "r" || b.mode === "r");
    const m = { id: room, room, ranked, fb, peers: [a.peer, b.peer], q: [a, b], seed, f, p, t0: t, st: null, g: null, logs: [[], []], prog: [t, t],
      fr: 0, sums: new Map(), cks: [], drift: [false, false], done: false, doneT: 0, left: new Set() };
    M.set(room, m); ofPeer.set(a.peer, room); ofPeer.set(b.peer, room);
    S.found++; S[ranked ? "ranked" : "casual"]++;
    const opp = (q) => ({ name: q.name, f: q.f, r: q.r, pl: q.file && q.n < PLACING ? q.n : -1, id: q.id });
    for (let i = 0; i < 2; i++) {
      const me = m.q[i], them = m.q[1 - i];
      send(me.peer, { t: "qm-found", id: room, room, role: i === 0 ? "host" : "guest", seed, f, p, r: RULES, ranked, fb: fb && me.mode === "r", opp: opp(them) });
    }
  }

  /* ----- the match rooms ----- */
  // a qm room can only be joined by its two players; a name that was never handed out can't be taken
  function canJoin(peer, room) {
    if (room.slice(0, ROOM_PREFIX.length) !== ROOM_PREFIX) return true;
    const m = M.get(room);
    return !!m && m.peers.includes(peer);
  }
  function startOk(m, st) {
    return !!st && typeof st === "object" && st.seed === m.seed && Array.isArray(st.f) && Array.isArray(st.p) &&
      st.f[0] === m.f[0] && st.f[1] === m.f[1] && st.p[0] === m.p[0] && st.p[1] === m.p[1] &&
      !!st.r && st.r.l === RULES.l && st.r.t === RULES.t && st.r.b === RULES.b && isInt(st.d) && st.d >= 1 && st.d <= 20 &&
      !!st.set && st.set.n === 1 && st.bo == null;
  }
  function presence(room, peer, p) {
    const m = M.get(room);
    if (!m || !p || typeof p !== "object") return;
    const i = m.peers.indexOf(peer);
    if (i < 0) return;
    if (!m.st && i === 0 && p.start && typeof p.start === "object" && p.start.id === 1) {
      if (!startOk(m, p.start)) { if (m.ranked) verdict(m, 0, "start"); else void_(m, "start"); return; }   // the host built a different match: the host's loss
      m.st = p.start;
      if (m.ranked) {
        const players = m.f.map((id, k) => ({ spec: FIG[id], pal: FIG[id].palettes[m.p[k]] }));
        m.g = BL.newGame({ players, stocks: RULES.l, time: RULES.t * 60, countdown: 150, seed: m.seed, map: m.seed % BL.POOL });
        m.prog = [now(), now()];
        // the first d frames are neutral on both phones (the input delay): a phone that starts behind the other sends its inputs
        // from the other's frame - 2, which can be past 0, so they are filled in here and never leave a hole
        m.logs = [new Array(p.start.d).fill(NEUTRAL), new Array(p.start.d).fill(NEUTRAL)];
      }
    }
    if (!m.ranked || !m.g || m.done) return;
    // the inputs: the first value a frame gets is the one both phones play (the page's readOpp does the same)
    if (p.m === 1 && isInt(p.s) && p.s >= 0 && typeof p.i === "string" && p.i.length <= 400) {
      const L = m.logs[i];
      let grew = false;
      for (let k = 0; k * 2 + 1 < p.i.length; k++) {
        const fr = p.s + k;
        if (fr > 60 * 60 * 30) break;
        if (L[fr] !== undefined) continue;
        const a = B64I[p.i[k * 2]], b = B64I[p.i[k * 2 + 1]];
        if (a === undefined || b === undefined) break;
        const v = a * 64 + b;
        if (v >= CODES) break;
        if (fr > L.length) break;   // never a hole: frames arrive in order
        L[fr] = v; grew = true;
      }
      if (grew) m.prog[i] = now();
      if (Array.isArray(p.ck) && p.ck.length === 2 && isInt(p.ck[0])) { m.cks.push([i, p.ck[0], p.ck[1]]); if (m.cks.length > 200) m.cks.shift(); }
      advance(m);
    }
  }
  function advance(m) {
    const g = m.g, H = m.logs[0], G2 = m.logs[1], D = m.st.d;
    while (!m.done && H[m.fr] !== undefined && G2[m.fr] !== undefined) {
      const a = m.fr < D ? NEUTRAL : H[m.fr], b = m.fr < D ? NEUTRAL : G2[m.fr];
      BL.step(g, [decIn(a), decIn(b)]);
      g.events.length = 0;
      m.fr++;
      if (m.fr % 60 === 0) { m.sums.set(m.fr, BL.checksum(g)); if (m.sums.size > 60) m.sums.delete(m.sums.keys().next().value); }
      if (g.phase === "end" || g.phase === "over") return verdict(m, g.winner === 0 ? 0 : g.winner === 1 ? 1 : -1, "game");
    }
    // each phone's game against ours, every second (a drift is logged; our copy decides either way)
    m.cks = m.cks.filter(([i, F, h]) => {
      if (!m.sums.has(F)) return F > m.fr;   // not played that far yet: keep it
      if (m.sums.get(F) !== h && !m.drift[i]) { m.drift[i] = true; S.drift++; o.log.warn(`quick: ${m.room} ${i ? "guest" : "host"} drifted from the referee at frame ${F}`); }
      return false;
    });
  }

  // the winner's slot (0 host, 1 guest, -1 draw), or the loser's slot for a forfeit ("left", "quiet", "start")
  function verdict(m, k, why) {
    if (m.done) return;
    m.done = true; m.doneT = now();
    if (!m.ranked) return end(m);
    const res = why === "game" ? (k < 0 ? [0.5, 0.5] : k === 0 ? [1, 0] : [0, 1]) : k === 0 ? [0, 1] : [1, 0];
    const files = m.q.map((q) => q.file), ons = files.map((f) => onOf(f));
    if (!ons[0] || !ons[1]) { void_(m, "acct"); return; }
    // both from the ratings before; a placement match never drops you below Bronze (Tin is for players who have placed)
    const out = [0, 1].map((i) => {
      const r0 = ons[i].r, r1 = Math.max(ons[i].n < PLACING ? PLACE_FLOOR : 0, r0 + elo(r0, ons[1 - i].r, res[i], ons[i].n));
      return { r0, dr: r1 - r0, or: ons[1 - i].r };
    });
    for (let i = 0; i < 2; i++) {
      const me = ons[i], them = ons[1 - i], dr = out[i].dr;
      me.r = me.r + dr; me.pk = Math.max(me.pk, me.r); me.n++;
      if (res[i] === 1) me.w++; else if (res[i] === 0) me.l++; else me.d++;
      me.last = them.id;
      me.h.unshift({ t: now(), o: m.q[1 - i].name, of: m.f[1 - i], f: m.f[i], or: out[i].or, res: res[i], dr, why });
      me.h = me.h.slice(0, HIST);
    }
    for (let i = 0; i < 2; i++) {
      try { acct.writeOn(files[i], ons[i]); } catch (e) { o.log.warn("quick: can't write a result", e.message); }
      const on = ons[i];
      send(m.peers[i], { t: "qm-res", id: m.id, res: res[i], why, r0: out[i].r0, r1: on.r, dr: out[i].dr, n: on.n, pk: on.pk, w: on.w, l: on.l, d: on.d });
    }
    S.verdicts++;
    o.log.log(`quick: ${m.room} ${why} ${m.q[0].id} ${res[0]} - ${res[1]} ${m.q[1].id} (${out[0].dr >= 0 ? "+" : ""}${out[0].dr} / ${out[1].dr >= 0 ? "+" : ""}${out[1].dr})`);
  }
  // no result: a match that never started, both players silent, or a server problem
  function void_(m, why) {
    m.done = true; m.doneT = now();
    if (m.ranked && m.st) { S.voids++; for (const peer of m.peers) send(peer, { t: "qm-res", id: m.id, res: null, why: "void" }); }
    else for (const peer of m.peers) if (!m.left.has(peer)) send(peer, { t: "qm-off", id: m.id, why });
  }
  function end(m) { m.done = true; m.doneT = m.doneT || now(); }
  function release(m) {
    M.delete(m.room);
    for (const peer of m.peers) if (ofPeer.get(peer) === m.room) ofPeer.delete(peer);
  }
  // a player left the match room (or their connection is gone for good)
  function left(peer, room) {
    const m = M.get(room);
    if (!m) return;
    const i = m.peers.indexOf(peer);
    if (i < 0) return;
    m.left.add(peer);
    if (ofPeer.get(peer) === room) ofPeer.delete(peer);
    if (!m.done) {
      if (m.ranked && m.g) verdict(m, i, "left");   // leaving a running Ranked match is a loss
      else if (m.st) end(m);                         // a Casual match that ran: the room's own "left" tells the other phone
      else void_(m, "left");                         // before the start: no result, the other phone searches again
    }
    if (m.left.size >= 2) release(m);
  }
  function gone(peer) {
    Q.delete(peer); seats.delete(peer); authN.delete(peer);
    const room = ofPeer.get(peer);
    if (room) left(peer, room);
  }

  function tick() {
    const t = now();
    for (const m of [...M.values()]) {
      if (m.done) { if (t - m.doneT > T.keep) release(m); continue; }
      if (!m.st) { if (t - m.t0 > T.noStart) void_(m, "nostart"); continue; }
      if (!m.ranked || !m.g) continue;
      // who keeps the game waiting: the phone whose input for the next frame is missing
      const miss = [0, 1].filter((i) => m.logs[i][m.fr] === undefined);
      const quiet = miss.filter((i) => t - m.prog[i] > T.quiet);
      if (miss.length === 1 && quiet.length === 1) verdict(m, quiet[0], "quiet");
      else if (miss.length === 2 && quiet.length === 2) void_(m, "quiet");
    }
    pairAll();
    for (const q of Q.values()) if (t - q.sent >= T.waitMsg) waitMsg(q, t);
  }
  const timer = setInterval(tick, T.tick);
  if (timer.unref) timer.unref();

  function handle(peer, m) {
    if (m.t === "auth") { if (typeof m.code === "string" && m.code.length <= 64) auth(peer, m.code); return true; }
    if (m.t === "qm") { search(peer, m); return true; }
    if (m.t === "qmx") { stop(peer); return true; }
    return false;
  }
  const running = () => [...M.values()].filter((m) => m.ranked && !m.done && m.st).length;
  return {
    handle, canJoin, presence, left, gone, tick,
    seatOf: (peer) => seats.get(peer) || null,   // cpurank.js: the account a connection signed in with
    drain() { draining = true; for (const q of Q.values()) waitMsg(q, now()); },
    draining: () => draining,
    running, searching: () => Q.size, stats: () => Object.assign({ running: running(), searching: Q.size }, S),
    proto: PROTO, T, _M: M, _Q: Q,
  };
}

module.exports = { init, elo, cleanOn, decIn, RULES, PLACING, TIMES };
