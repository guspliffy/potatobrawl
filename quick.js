"use strict";
/*
 * PotatoBrawl Quick match: one queue for Ranked and Casual 1v1 against real players, and the referee that decides every
 * Ranked match. Used by server.js and nothing else. Node's own modules and the game's own core.js only, no dependency.
 *
 * The two phones play a Quick match exactly like a friend match (lockstep, inputs in their presence), in a room the server
 * reserves for the two of them. The server already passes every presence message on, so it reads the inputs out of them,
 * plays the same game with core.js as both inputs of a frame arrive (about 4 microseconds a frame) and decides a Ranked
 * match from its own copy: a phone can never change the result or the rating. The rank lives in the account file's `on`
 * part (accounts.js), which only this module writes. It referees Casual games too when both players have an account (each
 * rematch in the room is its own game), for the rival record: the last 30 opponents with the record against each. Three Ranked
 * wins in a row put a bounty on a player (30 chips, +10 a win to 100); whoever ends the streak gets it, once per pair a day.
 * The bounty is the one thing here that writes chips: accounts.js addChips puts them into the hunter's account file, and the
 * phone picks them up with its next sync (the page never adds them itself, or a merge would pay twice).
 *
 * WebSocket messages (server.js passes them here):
 *   phone -> server   auth {code}                      the account's sync code, once per connection
 *                     acct?                            are accounts on? (-> acct {on}; Play friends asks before it makes an account)
 *                     qm {v, mode "r"|"c", f, pi, w}   search (w: seconds already waited, kept across a hidden page; max 60)
 *                     qmx                              stop searching
 *   server -> phone   me {id, r, pk, w, l, d, n, h} | me {err}           your online record (err: "off" | "unknown")
 *                     qm-wait {n, on, rng, hold}       searching: players searching, online, your range (-1 = anyone), hold = updating
 *                     qm-no {why}                      can't search: "old" (reload), "acct" (Ranked needs an account), "bad"
 *                     qm-x {why}                       your search ended: "elsewhere" (this account searches on another page)
 *                     qm-found {id, room, role, seed, f, p, r, ranked, fb, opp}
 *                     qm-off {id, why}                 the match never started ("nostart", "left"): no result
 *                     qm-res {id, res, why, r0, r1, dr, n, pk, w, l, d, rv, ws, bh, bl}   a Ranked verdict (res 1 / 0.5 / 0 for
 *                                                      you; why: game, left, quiet, start); qm-res {id, res: null, why: "void"} = no result
 *                                                      rv: your record against them now, ws: your Ranked win streak, bh {n, k}: the
 *                                                      bounty you took for ending their k-win streak (n 0: taken today already),
 *                                                      bl {n, k}: your k-win streak ended and they took n, gn: your refereed matches
 *                     qm-cs {id, g, res, rv, gn}       a Casual game the referee played to its end (g: the game's start id)
 *   qm-found's opp also carries riv (your record against them, null = first meeting; absent = not kept: no account), ws and bty
 *   (their streak and bounty, Ranked only), and you {ws, bty} is your own. me also carries rv, ws, bty, g (refereed matches) and sk.
 *
 * Play friends: a 1v1 game between two signed-in players is refereed too (the host's presence names its start and its opponent);
 * each start is its own game, the result goes to both as qm-cs {pf: 1}. Boss fights, team brawls and anything odd are not refereed.
 *
 * Chip stakes: right after a refereed result the two players may play a rematch for 10, 25 or 50 chips each. Every verdict carries
 * sk {ok: [stakes both can play], why, k} (why: "off" your stakes are off, "new" k refereed matches to go, "day" the daily limit,
 * "gap" ranks too far apart (Quick match only), "chips", "them": the other player can't, "acct").
 *   phone -> server   stk {s}          challenge your last opponent      stk-ok   accept the challenge you got      stkx   cancel / decline
 *   server -> phone   stk-out {s, ms}  your challenge is out             stk-in {s, name, ms}   a challenge for you
 *                     stk-off {why}    the challenge is off ("no": no answer, declined or gone; "x": withdrawn; or a reason above)
 *                     stk-no {why}     can't challenge (a reason above, "late", "hold": the server is about to update)
 *   An accepted challenge is a server-assigned match like Ranked: qm-found {sk: s}, same fighters and skins, 3 lives, 4:00, refereed.
 *   qm-sk {id, res, why, s, d, day, rv, gn, sk}: its verdict (d: the chips you won or lost; res null = no result: a forfeit in the
 *   first 30 s of the fight, a host who built another match, or both silent). The server writes the chips into both account files.
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
const RIVALS = 30;                            // opponents kept in the rival record (the last 30 met)
const TZ = "Europe/Berlin";                   // the day a bounty can be claimed once per pair (the play counts' day too)
const STAKES = [10, 25, 50];                  // chips each player puts up in a rematch for chips
const STK = { day: 5, gap: 250, min: 10 };    // staked matches a day, the rating gap in Quick match (Play friends: any), refereed matches first
const EARLY = 150 + 30 * 60;                  // a staked match left or gone quiet before this frame (the countdown + 30 s of fight): no result
const TIMES = {
  tick: 1000,                                 // the pairing and timeout check
  range: [[10, 200], [20, 400]],              // rating range by seconds waited; anyone after the last
  fallback: 20,                               // seconds a Ranked player waits for another Ranked player before taking Casual
  noStart: 25000,                             // found but no valid start message: no result
  quiet: 15000,                               // a player who sends nothing this long in a running Ranked match loses
  keep: 120000,                               // a decided match's room stays reserved this long (results, rematch handshake)
  waitMsg: 2000,                              // qm-wait every
  offer: 30000,                               // a chip challenge waits this long for an answer
  rematch: 120000,                            // a chip challenge can follow a result this long
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
function freshOn() { return { id: pubId(), s: SEASON, r: 1000, pk: 1000, w: 0, l: 0, d: 0, n: 0, last: "", h: [], rv: [], ws: 0, g: 0, bc: [], sk: { d: "", n: 0, w: 0, l: 0, net: 0 } }; }
// the bounty on a Ranked win streak: 30 chips at 3 wins, +10 a win, 100 at most
const bounty = (ws) => (ws < 3 ? 0 : Math.min(100, 30 + (ws - 3) * 10));
function dayIn(tz, t) {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(t))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
const ID_RE = /^[0-9A-Z]{10}$/;
// one opponent in the rival record: their id, name, fighter and rating when last met, your record against them, when, the last five (W/L/D, newest first)
function cleanRiv(x) {
  if (!x || typeof x !== "object" || typeof x.id !== "string" || !ID_RE.test(x.id)) return null;
  const n = (v) => (isInt(v) && v >= 0 && v < 1e6 ? v : 0);
  return { id: x.id, nm: typeof x.nm === "string" ? x.nm.slice(0, 24) : "", f: FIG[x.f] ? x.f : "", r: n(x.r), w: n(x.w), l: n(x.l), d: n(x.d),
    t: Number.isFinite(x.t) ? x.t : 0, k: typeof x.k === "string" ? x.k.replace(/[^WLD]/g, "").slice(0, 5) : "" };
}
// a stored `on` part, cleaned (a missing or broken one = a fresh record with the same id if it had one)
function cleanOn(o) {
  const on = freshOn();
  if (!o || typeof o !== "object") return on;
  if (typeof o.id === "string" && /^[0-9A-Z]{10}$/.test(o.id)) on.id = o.id;
  for (const k of ["r", "pk", "w", "l", "d", "n"]) if (isInt(o[k]) && o[k] >= 0 && o[k] < 1e9) on[k] = o[k];
  on.pk = Math.max(on.pk, on.r);
  if (typeof o.last === "string" && o.last.length <= 10) on.last = o.last;
  if (Array.isArray(o.h)) on.h = o.h.filter((x) => x && typeof x === "object").slice(0, HIST);
  if (Array.isArray(o.rv)) { const seen = new Set(); on.rv = o.rv.map(cleanRiv).filter((x) => x && !seen.has(x.id) && seen.add(x.id)).slice(0, RIVALS); }
  for (const k of ["ws", "g"]) if (isInt(o[k]) && o[k] >= 0 && o[k] < 1e9) on[k] = o[k];
  if (Array.isArray(o.bc)) on.bc = o.bc.filter((x) => typeof x === "string" && x.length <= 24).slice(-20);
  if (o.sk && typeof o.sk === "object") {   // chip stakes: today's count (by Berlin day) and the all-time record
    if (typeof o.sk.d === "string" && /^\d{4}-\d\d-\d\d$/.test(o.sk.d)) on.sk.d = o.sk.d;
    for (const k of ["n", "w", "l"]) if (isInt(o.sk[k]) && o.sk[k] >= 0 && o.sk[k] < 1e9) on.sk[k] = o.sk[k];
    if (isInt(o.sk.net) && Math.abs(o.sk.net) < 1e9) on.sk.net = o.sk.net;
  }
  return on;
}
// staked matches today (the count starts again each Berlin day)
const skToday = (on, t) => (on.sk.d === dayIn(TZ, t) ? on.sk.n : 0);
const meMsg = (on) => ({ t: "me", id: on.id, r: on.r, pk: on.pk, w: on.w, l: on.l, d: on.d, n: on.n, h: on.h, rv: on.rv, ws: on.ws, bty: bounty(on.ws), g: on.g,
  sk: { n: skToday(on, Date.now()), w: on.sk.w, l: on.sk.l, net: on.sk.net, day: STK.day } });
// can these two play a rematch for chips? (Fable's reasons, the first that applies; `ok` = the stakes both can afford)
function stakeCheck(on, prof, oon, oprof, pf, t) {
  if (!on || !oon || !prof || !oprof) return { ok: [], why: "acct" };
  const chips = (pr) => (Number.isSafeInteger(pr.tokens) && pr.tokens > 0 ? pr.tokens : 0);
  const why = (a, pr) => (pr.so === 1 ? "off" : a.g < STK.min ? "new" : skToday(a, t) >= STK.day ? "day" : chips(pr) < STAKES[0] ? "chips" : "");
  const mine = why(on, prof), theirs = why(oon, oprof);
  const out = mine ? { ok: [], why: mine } : theirs ? { ok: [], why: "them" } : !pf && Math.abs(on.r - oon.r) > STK.gap ? { ok: [], why: "gap" }
    : { ok: STAKES.filter((s) => s <= chips(prof) && s <= chips(oprof)), why: "" };
  if (out.why === "new") out.k = STK.min - on.g;
  return out;
}
// your record against them, as qm-found shows it (null: you never met)
const rivView = (e) => (e ? { w: e.w, l: e.l, d: e.d, k: e.k } : null);
// a result against an opponent goes into the record: their entry moves to the front, the oldest beyond 30 drops out
function rivAdd(on, opp, res, t) {
  let e = on.rv.find((x) => x.id === opp.id);
  if (e) on.rv.splice(on.rv.indexOf(e), 1);
  else e = { id: opp.id, nm: "", f: "", r: 0, w: 0, l: 0, d: 0, t: 0, k: "" };
  Object.assign(e, { nm: String(opp.name || "").slice(0, 24), f: opp.f, r: opp.r, t });
  if (res === 1) e.w++; else if (res === 0) e.l++; else e.d++;
  e.k = ((res === 1 ? "W" : res === 0 ? "L" : "D") + e.k).slice(0, 5);
  on.rv.unshift(e);
  on.rv = on.rv.slice(0, RIVALS);
  return e;
}

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
  const last = new Map();     // peer -> its last refereed result { mid, i (its slot), peers, files, names, f, p, pf, t }: who a chip challenge goes to
  const offers = new Map();   // challenger peer -> a chip challenge { to, s, t, mid }
  const S = { found: 0, ranked: 0, casual: 0, verdicts: 0, voids: 0, drift: 0, casualGames: 0, unfinished: 0, bounties: 0, friendGames: 0, staked: 0, stakeVerdicts: 0 };
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
  // sk: a rematch for chips (each puts up sk): the fighters and skins of the match before, never Ranked
  function found(a, b, ranked, t, sk) {
    Q.delete(a.peer); Q.delete(b.peer);
    dropOffers(a.peer); dropOffers(b.peer);
    const room = ROOM_PREFIX + crypto.randomBytes(8).toString("hex").slice(0, 12);
    const seed = crypto.randomInt(1, 1e9), f = [a.f, b.f], p = [a.pi, b.pi];
    if (f[0] === f[1] && p[0] === p[1]) p[1] = (p[1] + 1) % FIG[f[1]].palettes.length;   // the page's own mirror rule
    const fb = !ranked && (a.mode === "r" || b.mode === "r");
    // the referee plays every Ranked match, and a Casual one when both players have an account (the rival record)
    const ref = ranked || !!(a.file && b.file && a.id && b.id && a.id !== b.id);
    const m = { id: room, room, ranked, fb, ref, sk: sk || 0, peers: [a.peer, b.peer], q: [a, b], seed, f, p, rules: RULES, t0: t, st: null, gid: 0, g: null, logs: [[], []], prog: [t, t],
      fr: 0, sums: new Map(), cks: [], drift: [false, false], done: false, doneT: 0, left: new Set() };
    M.set(room, m); ofPeer.set(a.peer, room); ofPeer.set(b.peer, room);
    S.found++; S[sk ? "staked" : ranked ? "ranked" : "casual"]++;
    const ons = ref ? [onOf(a.file), onOf(b.file)] : [null, null];
    const opp = (q) => ({ name: q.name, f: q.f, r: q.r, pl: q.file && q.n < PLACING ? q.n : -1, id: q.id });
    for (let i = 0; i < 2; i++) {
      const me = m.q[i], them = m.q[1 - i], o2 = opp(them), mine = ons[i], theirs = ons[1 - i], msg = { t: "qm-found", id: room, room, role: i === 0 ? "host" : "guest", seed, f, p, r: RULES, ranked, fb: fb && me.mode === "r", opp: o2 };
      if (mine && theirs) o2.riv = rivView(mine.rv.find((x) => x.id === them.id));
      if (ranked && mine && theirs) { o2.ws = theirs.ws; o2.bty = bounty(theirs.ws); msg.you = { ws: mine.ws, bty: bounty(mine.ws) }; }
      if (sk) msg.sk = sk;
      send(me.peer, msg);
    }
  }

  /* ----- the match rooms ----- */
  // a qm room can only be joined by its two players; a name that was never handed out can't be taken
  function canJoin(peer, room) {
    if (room.slice(0, ROOM_PREFIX.length) !== ROOM_PREFIX) return true;
    const m = M.get(room);
    return !!m && m.peers.includes(peer);
  }
  // Play friends: the room's record once its host starts a 1v1 game against a named opponent, both signed in (a new one for a new pair)
  function friendRoom(room, peer, p) {
    const m0 = M.get(room), live = m0 && !m0.done ? m0 : null;
    const hostStart = p.role === "host" && typeof p.opp === "string" && !p.tb && friendStartOk(p.start);
    if (live && (!hostStart || (live.peers[0] === peer && live.peers[1] === p.opp))) return live.peers.includes(peer) ? live : null;
    if (!hostStart) return null;
    const a = seats.get(peer), b = seats.get(p.opp);
    if (m0) release(m0);   // the pair changed (a new guest), or the last one's record is done
    if (!a || !b || a.file === b.file || a.id === b.id) return null;
    const qa = qOf(peer, a), qb = qOf(p.opp, b);
    if (!qa || !qb) return null;
    const t = now();
    const m = { pf: true, id: room, room, ranked: false, fb: false, ref: true, sk: 0, peers: [peer, p.opp], q: [qa, qb], seed: 0, f: [], p: [], rules: RULES, t0: t, st: null, gid: 0, g: null,
      logs: [[], []], prog: [t, t], fr: 0, sums: new Map(), cks: [], drift: [false, false], done: false, doneT: 0, left: new Set() };
    M.set(room, m);
    return m;
  }
  function qOf(peer, seat) {
    const on = onOf(seat.file);
    return on ? { peer, file: seat.file, id: seat.id, name: o.nameOf(peer) || "Potato", by: o.byOf(peer) || peer, r: on.r, n: on.n } : null;
  }
  // a friend match's 1v1 start (the page's validStart, without a boss): any of the lobby's rules
  function friendStartOk(st) {
    return !!st && typeof st === "object" && isInt(st.id) && st.id >= 1 && isInt(st.seed) && st.seed >= 0 && isInt(st.d) && st.d >= 1 && st.d <= 20 &&
      Array.isArray(st.f) && st.f.length === 2 && st.f.every((id) => FIG[id]) && Array.isArray(st.p) && st.p.length === 2 &&
      st.p.every((v, k) => isInt(v) && v >= 0 && v < FIG[st.f[k]].palettes.length) && !!st.r && typeof st.r === "object" &&
      [1, 3, 5].includes(st.r.l) && [2, 4, 0].includes(st.r.t) && [1, 3].includes(st.r.b) && st.bo == null && st.tb == null;
  }
  // the assigned match (or, for a Casual rematch, the same one with any seed)
  function startOk(m, st, first) {
    return !!st && typeof st === "object" && (first ? st.seed === m.seed : isInt(st.seed) && st.seed >= 0) && Array.isArray(st.f) && Array.isArray(st.p) &&
      st.f[0] === m.f[0] && st.f[1] === m.f[1] && st.p[0] === m.p[0] && st.p[1] === m.p[1] &&
      !!st.r && st.r.l === RULES.l && st.r.t === RULES.t && st.r.b === RULES.b && isInt(st.d) && st.d >= 1 && st.d <= 20 &&
      !!st.set && st.set.n === 1 && st.bo == null;
  }
  function presence(room, peer, p) {
    if (!p || typeof p !== "object") return;
    const m = room.slice(0, ROOM_PREFIX.length) === ROOM_PREFIX ? M.get(room) : friendRoom(room, peer, p);
    if (!m) return;
    const i = m.peers.indexOf(peer);
    if (i < 0) return;
    const st = p.start;
    if (m.pf) {
      // Play friends: each valid 1v1 start of the host is its own game, with its own fighters and rules
      if (i === 0 && st && typeof st === "object" && isInt(st.id) && st.id > m.gid) {
        if (m.g) S.unfinished++;
        const ok = friendStartOk(st);
        if (ok) { m.st = m.st || st; m.f = st.f.slice(); m.p = st.p.slice(); m.rules = { l: st.r.l, t: st.r.t, b: st.r.b }; }
        begin(m, ok ? st : null);
        if (!ok) m.gid = st.id;
      }
    } else if (i === 0 && !m.done && st && typeof st === "object" && isInt(st.id) && st.id > m.gid) {
      if (!m.st) {
        if (st.id !== 1) return;
        if (!startOk(m, st, true)) { if (m.ranked) verdict(m, 0, "start"); else void_(m, "start"); return; }   // the host built a different match: the host's loss
        m.st = st;
        begin(m, st);
      } else if (!m.ranked && !m.sk && st.id === m.gid + 1) {
        // a Casual rematch (the friend match's own: same fighters and skins, a new seed): its own game; an odd one isn't refereed
        if (m.g) S.unfinished++;   // the last game never reached its end on the server: no result
        begin(m, startOk(m, st, false) ? st : null);
      }
    }
    if (!m.g || m.done) return;
    // the inputs: the first value a frame gets is the one both phones play (the page's readOpp does the same)
    if (p.m === m.gid && isInt(p.s) && p.s >= 0 && typeof p.i === "string" && p.i.length <= 400) {
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
  // a game starts: the referee's own copy (null: not refereed)
  function begin(m, st) {
    m.gid = st ? st.id : m.gid + 1; m.g = null; m.fr = 0; m.sums = new Map(); m.cks = []; m.drift = [false, false];
    if (!st || !m.ref) return;
    const players = m.f.map((id, k) => ({ spec: FIG[id], pal: FIG[id].palettes[m.p[k]] }));
    m.g = BL.newGame({ players, stocks: m.rules.l, time: m.rules.t * 60, countdown: 150, seed: st.seed, map: st.seed % BL.POOL });
    m.prog = [now(), now()];
    // the first d frames are neutral on both phones (the input delay): a phone that starts behind the other sends its inputs
    // from the other's frame - 2, which can be past 0, so they are filled in here and never leave a hole
    m.logs = [new Array(st.d).fill(NEUTRAL), new Array(st.d).fill(NEUTRAL)];
    m.d = st.d;
  }
  function advance(m) {
    const g = m.g, H = m.logs[0], G2 = m.logs[1], D = m.d;
    while (!m.done && m.g === g && H[m.fr] !== undefined && G2[m.fr] !== undefined) {
      const a = m.fr < D ? NEUTRAL : H[m.fr], b = m.fr < D ? NEUTRAL : G2[m.fr];
      BL.step(g, [decIn(a), decIn(b)]);
      g.events.length = 0;
      m.fr++;
      if (m.fr % 60 === 0) { m.sums.set(m.fr, BL.checksum(g)); if (m.sums.size > 60) m.sums.delete(m.sums.keys().next().value); }
      if (g.phase === "end" || g.phase === "over") {
        const k = g.winner === 0 ? 0 : g.winner === 1 ? 1 : -1;
        return m.ranked ? verdict(m, k, "game") : m.sk ? stakeEnd(m, k, "game") : casualEnd(m, k);
      }
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
    const t = now(), ws0 = ons.map((on) => on.ws), rv = [null, null];
    for (let i = 0; i < 2; i++) {
      const me = ons[i], them = ons[1 - i], dr = out[i].dr;
      me.r = me.r + dr; me.pk = Math.max(me.pk, me.r); me.n++; me.g++;
      if (res[i] === 1) me.w++; else if (res[i] === 0) me.l++; else me.d++;
      me.last = them.id;
      me.h.unshift({ t, o: m.q[1 - i].name, of: m.f[1 - i], f: m.f[i], or: out[i].or, res: res[i], dr, why });
      me.h = me.h.slice(0, HIST);
      me.ws = res[i] === 1 ? me.ws + 1 : res[i] === 0 ? 0 : me.ws;   // a draw keeps a streak
      if (them.id !== me.id) rv[i] = rivAdd(me, { id: them.id, name: m.q[1 - i].name, f: m.f[1 - i], r: out[i].or }, res[i], t);
    }
    // a streak of 3 or more ended by a loss (a forfeit too): its bounty goes to the winner, once per pair a day
    const bh = [null, null], bl = [null, null], pay = [0, 0];
    for (let i = 0; i < 2; i++) {
      const n0 = bounty(ws0[i]), w = 1 - i;
      if (!n0 || res[i] !== 0) continue;
      const key = `${ons[i].id}:${dayIn(TZ, t)}`, hunter = ons[w];
      hunter.bc = hunter.bc.filter((x) => x.slice(-10) === key.slice(-10));   // only today's claims matter
      const n = hunter.bc.includes(key) ? 0 : n0;
      if (n) { hunter.bc.push(key); pay[w] = n; }
      bh[w] = { n, k: ws0[i] }; bl[i] = { n, k: ws0[i] };
    }
    for (let i = 0; i < 2; i++) {
      try { acct.writeOn(files[i], ons[i]); } catch (e) { o.log.warn("quick: can't write a result", e.message); }
      if (pay[i]) {
        try { acct.addChips(files[i], pay[i]); S.bounties++; } catch (e) { o.log.warn("quick: can't pay a bounty", e.message); bh[i].n = 0; if (bl[1 - i]) bl[1 - i].n = 0; }
      }
    }
    const el = afterResult(m, t);
    for (let i = 0; i < 2; i++) {
      const on = ons[i], msg = { t: "qm-res", id: m.id, res: res[i], why, r0: out[i].r0, r1: on.r, dr: out[i].dr, n: on.n, pk: on.pk, w: on.w, l: on.l, d: on.d, ws: on.ws, gn: on.g, sk: el[i] };
      if (rv[i]) msg.rv = rv[i];
      if (bh[i]) msg.bh = bh[i];
      if (bl[i]) msg.bl = bl[i];
      send(m.peers[i], msg);
    }
    S.verdicts++;
    const bt = pay[0] || pay[1] ? ` bounty ${pay[0] || pay[1]}` : "";
    o.log.log(`quick: ${m.room} ${why} ${m.q[0].id} ${res[0]} - ${res[1]} ${m.q[1].id} (${out[0].dr >= 0 ? "+" : ""}${out[0].dr} / ${out[1].dr >= 0 ? "+" : ""}${out[1].dr})${bt}`);
  }
  // a Casual game the referee played to its end: the rival record only (no rank, no streak); the room stays for a rematch
  function casualEnd(m, k) {
    m.g = null;
    const res = k < 0 ? [0.5, 0.5] : k === 0 ? [1, 0] : [0, 1], files = m.q.map((q) => q.file), ons = files.map((f) => onOf(f));
    if (!ons[0] || !ons[1] || ons[0].id === ons[1].id) return;
    const t = now(), rv = [0, 1].map((i) => rivAdd(ons[i], { id: ons[1 - i].id, name: m.q[1 - i].name, f: m.f[1 - i], r: ons[1 - i].r }, res[i], t));
    for (let i = 0; i < 2; i++) {
      ons[i].g++;
      try { acct.writeOn(files[i], ons[i]); } catch (e) { o.log.warn("quick: can't write a result", e.message); }
    }
    const el = afterResult(m, t);
    for (let i = 0; i < 2; i++) {
      const msg = { t: "qm-cs", id: m.id, g: m.gid, res: res[i], rv: rv[i], gn: ons[i].g, sk: el[i] };
      if (m.pf) msg.pf = 1;
      if (!m.left.has(m.peers[i])) send(m.peers[i], msg);
    }
    S[m.pf ? "friendGames" : "casualGames"]++;
  }
  // after any refereed result: who each player can challenge for chips now, and whether they can (sent with the verdict)
  function afterResult(m, t) {
    const pair = { mid: m.id, peers: m.peers.slice(), files: m.q.map((q) => q.file), names: m.q.map((q) => q.name), ids: m.q.map((q) => q.id), f: m.f.slice(), p: m.p.slice(), pf: !!m.pf, t };
    for (let i = 0; i < 2; i++) last.set(m.peers[i], Object.assign({ i }, pair));
    return [0, 1].map((i) => stakeFor(pair, i, t));
  }
  function stakeFor(pair, i, t) {
    const a = acct && acct.readFile(pair.files[i]), b = acct && acct.readFile(pair.files[1 - i]);
    return stakeCheck(a && cleanOn(a.on), a && a.prof, b && cleanOn(b.on), b && b.prof, pair.pf, t);
  }

  /* ----- chip stakes: a rematch for chips, offered right after a refereed result ----- */
  function offer(peer, s) {
    const L = last.get(peer), t = now();
    if (!L || t - L.t > T.rematch) return send(peer, { t: "stk-no", why: "late" });
    if (!STAKES.includes(s)) return send(peer, { t: "stk-no", why: "bad" });
    if (draining) return send(peer, { t: "stk-no", why: "hold" });
    const to = L.peers[1 - L.i], LO = last.get(to);
    if (!LO || LO.mid !== L.mid || busy(to) || busy(peer)) return send(peer, { t: "stk-no", why: "them" });
    for (const x of offers.values()) if (x.to === peer && x.from === to) return send(peer, { t: "stk-no", why: "them" });   // they challenged you first: answer that one
    const el = stakeFor(L, L.i, t);
    if (!el.ok.includes(s)) return send(peer, { t: "stk-no", why: el.why || "chips" });
    dropOffers(peer);
    offers.set(peer, { from: peer, to, s, t, mid: L.mid });
    send(peer, { t: "stk-out", s, ms: T.offer });
    send(to, { t: "stk-in", s, name: L.names[L.i], ms: T.offer });
  }
  // in a game the referee is playing now (a Quick match or a friend match): no challenge in or out
  const busy = (peer) => { for (const m of M.values()) if (!m.done && m.g && m.peers.includes(peer)) return true; return false; };
  function accept(peer) {
    const x = [...offers.values()].find((y) => y.to === peer);
    if (!x) return send(peer, { t: "stk-off", why: "no" });
    offers.delete(x.from);
    const t = now(), L = last.get(x.from);
    const off = (why) => { send(x.from, { t: "stk-off", why }); send(peer, { t: "stk-off", why }); };
    if (!L || L.mid !== x.mid || t - x.t > T.offer + 2000) return off("no");
    if (draining) return off("hold");
    if (busy(x.from) || busy(peer)) return off("no");
    const el = [stakeFor(L, L.i, t), stakeFor(L, 1 - L.i, t)];
    if (!el[0].ok.includes(x.s) || !el[1].ok.includes(x.s)) return off(el[0].why || (el[1].why ? "them" : "chips"));
    // the match: the fighters, skins and sides of the one before; today's count goes up for both now (a match left early still counts)
    const day = dayIn(TZ, t), side = [0, 1].map((k) => {
      const file = L.files[k], rec = acct.readFile(file), on = cleanOn(rec && rec.on);
      if (on.sk.d !== day) on.sk = { d: day, n: 0, w: on.sk.w, l: on.sk.l, net: on.sk.net };
      on.sk.n++;
      try { acct.writeOn(file, on); } catch (e) { o.log.warn("quick: can't write a stake", e.message); }
      return { peer: L.peers[k], file, id: on.id, last: on.last, name: L.names[k], by: o.byOf(L.peers[k]) || L.peers[k], mode: "s", f: L.f[k], pi: L.p[k], r: on.r, n: on.n, since: t, sent: 0 };
    });
    for (const k of side) { Q.delete(k.peer); last.delete(k.peer); }
    found(side[0], side[1], false, t, x.s);
    o.log.log(`quick: stake ${x.s} accepted (${side[0].id} vs ${side[1].id})`);
  }
  // withdrawn by the challenger, declined by the other, or one of them gone: both hear it's off
  function cancelOffer(peer) {
    const mine = offers.get(peer);
    if (mine) { offers.delete(peer); send(mine.to, { t: "stk-off", why: "x" }); }
    for (const x of [...offers.values()]) if (x.to === peer) { offers.delete(x.from); send(x.from, { t: "stk-off", why: "no" }); }
  }
  function dropOffers(peer) {
    for (const x of [...offers.values()]) if (x.from === peer || x.to === peer) { offers.delete(x.from); send(x.from === peer ? x.to : x.from, { t: "stk-off", why: x.from === peer ? "x" : "no" }); }
  }
  // the verdict of a staked match: the winner takes the other's stake (both account files), a draw moves nothing.
  // A forfeit in the first 30 s of the fight is no result (a Wi-Fi hiccup at 0:05 shouldn't cost 50 chips).
  function stakeEnd(m, k, why) {
    if (m.done) return;
    if (why !== "game" && m.fr < EARLY) { void_(m, "early"); return; }
    m.done = true; m.doneT = now();
    const res = why === "game" ? (k < 0 ? [0.5, 0.5] : k === 0 ? [1, 0] : [0, 1]) : k === 0 ? [0, 1] : [1, 0];
    const files = m.q.map((q) => q.file), ons = files.map((f) => onOf(f));
    if (!ons[0] || !ons[1]) { void_(m, "acct"); return; }
    const t = now(), s = m.sk, d = res.map((r) => (r === 1 ? s : r === 0 ? -s : 0)), rv = [null, null];
    for (let i = 0; i < 2; i++) {
      const me = ons[i];
      me.g++;
      if (d[i] > 0) me.sk.w++; else if (d[i] < 0) me.sk.l++;
      me.sk.net += d[i];
      rv[i] = rivAdd(me, { id: ons[1 - i].id, name: m.q[1 - i].name, f: m.f[1 - i], r: ons[1 - i].r }, res[i], t);
      try { acct.writeOn(files[i], me); } catch (e) { o.log.warn("quick: can't write a stake result", e.message); }
    }
    for (let i = 0; i < 2; i++) if (d[i]) { try { acct.addChips(files[i], d[i]); } catch (e) { o.log.warn("quick: can't pay a stake", e.message); } }
    const el = afterResult(m, t);
    for (let i = 0; i < 2; i++) send(m.peers[i], { t: "qm-sk", id: m.id, res: res[i], why, s, d: d[i], day: skToday(ons[i], t), rv: rv[i], gn: ons[i].g, sk: el[i] });
    S.stakeVerdicts++;
    o.log.log(`quick: ${m.room} stake ${s} ${why} ${m.q[0].id} ${res[0]} - ${res[1]} ${m.q[1].id}`);
  }
  // no result: a match that never started, both players silent, or a server problem
  function void_(m, why) {
    m.done = true; m.doneT = now();
    if (m.ranked && m.st) { S.voids++; for (const peer of m.peers) send(peer, { t: "qm-res", id: m.id, res: null, why: "void" }); }
    else if (m.sk && m.st) { S.voids++; for (const peer of m.peers) send(peer, { t: "qm-sk", id: m.id, res: null, why, s: m.sk, d: 0 }); }
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
      else if (m.sk && m.g) stakeEnd(m, i, "left");  // ...a staked one too (no result in its first 30 s)
      else if (m.st) { m.g = null; end(m); }         // a Casual match that ran: no result for a game cut short; the room's own "left" tells the other phone
      else void_(m, "left");                         // before the start: no result, the other phone searches again
    }
    if (m.left.size >= 2) release(m);
  }
  function gone(peer) {
    Q.delete(peer); seats.delete(peer); authN.delete(peer);
    dropOffers(peer); last.delete(peer);
    const room = ofPeer.get(peer);
    if (room) left(peer, room);
  }

  function tick() {
    const t = now();
    for (const m of [...M.values()]) {
      if (m.done) { if (t - m.doneT > T.keep) release(m); continue; }
      if (!m.st) { if (t - m.t0 > T.noStart) void_(m, "nostart"); continue; }
      if (!(m.ranked || m.sk) || !m.g) continue;   // a Casual game that stalls is the phones' business (no result unless it ends)
      // who keeps the game waiting: the phone whose input for the next frame is missing
      const miss = [0, 1].filter((i) => m.logs[i][m.fr] === undefined);
      const quiet = miss.filter((i) => t - m.prog[i] > T.quiet);
      if (miss.length === 1 && quiet.length === 1) (m.ranked ? verdict : stakeEnd)(m, quiet[0], "quiet");
      else if (miss.length === 2 && quiet.length === 2) void_(m, "quiet");
    }
    for (const x of [...offers.values()]) if (t - x.t > T.offer) { offers.delete(x.from); send(x.from, { t: "stk-off", why: "no" }); send(x.to, { t: "stk-off", why: "no" }); }
    for (const [peer, L] of last) if (t - L.t > T.rematch + T.offer) last.delete(peer);
    pairAll();
    for (const q of Q.values()) if (t - q.sent >= T.waitMsg) waitMsg(q, t);
  }
  const timer = setInterval(tick, T.tick);
  if (timer.unref) timer.unref();

  function handle(peer, m) {
    if (m.t === "auth") { if (typeof m.code === "string" && m.code.length <= 64) auth(peer, m.code); return true; }
    if (m.t === "qm") { search(peer, m); return true; }
    if (m.t === "qmx") { stop(peer); return true; }
    if (m.t === "stk") { if (seats.has(peer)) offer(peer, m.s); else send(peer, { t: "stk-no", why: "acct" }); return true; }
    if (m.t === "stk-ok") { accept(peer); return true; }
    if (m.t === "stkx") { cancelOffer(peer); return true; }
    if (m.t === "acct?") { send(peer, { t: "acct", on: !!acct }); return true; }   // Play friends asks before it makes the silent account
    return false;
  }
  const running = () => [...M.values()].filter((m) => (m.ranked || m.sk) && !m.done && m.st).length;   // the update waits for these
  return {
    handle, canJoin, presence, left, gone, tick,
    seatOf: (peer) => seats.get(peer) || null,   // cpurank.js: the account a connection signed in with
    drain() { draining = true; for (const q of Q.values()) waitMsg(q, now()); },
    draining: () => draining,
    running, searching: () => Q.size, stats: () => Object.assign({ running: running(), searching: Q.size }, S),
    proto: PROTO, T, _M: M, _Q: Q, _offers: offers,
  };
}

module.exports = { init, elo, cleanOn, bounty, stakeCheck, decIn, RULES, PLACING, TIMES, STK, STAKES };
