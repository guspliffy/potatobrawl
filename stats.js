"use strict";
/*
 * PotatoBrawl play counts: anonymous totals per day, and Jonny's private stats page. Used by server.js and nothing else.
 * Node's own http/fs/crypto only, no dependency.
 *
 * Off unless STATS_DIR names a folder that exists and can be written. While off, nothing here runs and every address below
 * answers 404 like any other unknown page (the game then stops sending for the visit).
 *
 *   POST /api/stats/hit   {e: ["key", ...]}   -> 204          the game adds 1 to each key (sendBeacon posts it as text/plain)
 *   POST /api/stats/data  {key, from?}        -> {today, tz, online, days: {"YYYY-MM-DD": {key: n}}, board?}   or 404 after a pause
 *                                                (board: [{id, nm, nb, c, o}], the names on both boards and their places, cpurank.js)
 *   POST /api/stats/blank {key, id, on}       -> {board}       a name on the Ranked vs CPU boards shown as "Potato" (on false: back)
 *   GET  /stats                               -> the stats page (public/stats.html); it reads the key after the # of its link
 *
 * Nothing about a player is stored: no ID, no IP address, no cookie. A day file holds only totals ({key: count}), one file per
 * day (Europe/Berlin) named YYYY-MM-DD.json, written every 30 s while something changed (temp file + rename) and on shutdown.
 * IP addresses live only in memory, for the rate limit, and are forgotten within minutes.
 * The page key is made the first time the counter starts and kept in STATS_DIR/key (hex, mode 600); delete it and restart to
 * get a new link.
 *
 * The keys the game sends (game/ui/counter.js; the stats page reads them):
 *   day day:new day:back wk mo           a device's first open that day / its first ever / returning; first open that week, month
 *   dev:<phone|tablet|desktop> app:<app|web> lang:<xx|other> ver:<PROTO>        with each device's first open of the day
 *   ret:<YYYY-MM-DD>:<1|3|7|14|30>       a device first seen on that date came back within that many days (once per device)
 *   tut:<step|done|skip>  fn:<s1|d1|s2|d5|d10|d25>  first:<mode>                once per device: tutorial step reached, its end,
 *                                        matches started (s) and finished (d), the mode of the first match
 *   fx:<where> fl:<0|1|3|10|30> fm:<0|1|2|3>     the first time a new device left the page: where, minutes in, matches done
 *   ms:<mode> me:<mode>:<win|loss|draw|quit|drop> ml:<0|1|2|3|5> mslow fp:<fighter> again:<mode>
 *   rw:<stop> bs:<boss>:<0-2> bw:<boss>:<0-2> route skin:<fighter> acct scr:<screen> inv err:<message>
 *   chl:<make|open|new|play>              Challenge a friend: a link made, opened (new: on a brand-new device), a match started from one
 *   peak                                  (written here) the most players online at once that day: a maximum, not a sum
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULTS = {
  tz: "Europe/Berlin",
  maxBody: 4096,          // bytes of request body
  maxEvents: 40,          // keys in one hit
  hitsPerMin: 30,         // hits per IP per minute (the game sends one about every 20 s)
  dataPerMin: 20,         // page loads per IP per minute
  maxKeys: 3000,          // different keys in one day
  maxErrs: 30,            // different error messages in one day (then err:other)
  flushMs: 30000,         // how often a changed day is written
  sampleMs: 10000,        // how often the players online are counted for "peak"
  badKeyDelayMs: 400,     // a wrong page key is answered after this pause
  bodyMs: 10000,          // a request body must arrive within this time
  maxDays: 800,           // the most days one page load can ask for
  now: null,              // tests: a clock function instead of Date.now
};
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILE_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;
const W = "[a-z][a-z0-9-]{0,15}";   // a mode, fighter, boss or screen id
const KEY_RES = [
  /^(day|day:new|day:back|wk|mo|inv|acct|route|mslow)$/,
  /^dev:(phone|tablet|desktop)$/, /^app:(app|web)$/, /^lang:([a-z]{2}|other)$/, /^ver:\d{1,4}$/,
  /^ret:\d{4}-\d{2}-\d{2}:(1|3|7|14|30)$/,
  new RegExp(`^tut:${W}$`), /^fn:(s1|d1|s2|d5|d10|d25)$/, new RegExp(`^first:${W}$`),
  new RegExp(`^fx:${W}(:${W})?$`), /^fl:(0|1|3|10|30)$/, /^fm:[0-3]$/,
  new RegExp(`^ms:${W}$`), new RegExp(`^me:${W}:(win|loss|draw|quit|drop)$`), /^ml:(0|1|2|3|5)$/,
  new RegExp(`^fp:${W}$`), new RegExp(`^again:${W}$`), /^rw:\d{1,2}$/, new RegExp(`^b[sw]:${W}:[0-2]$`),
  new RegExp(`^skin:${W}$`), new RegExp(`^scr:${W}$`), /^chl:(make|open|new|play)$/,
];
// an error message: printable ASCII without quotes or backslashes, 1-80 characters (the game trims and cleans it before sending)
const ERR_RE = /^err:[\x20-\x21\x23-\x26\x28-\x5b\x5d-\x7e]{1,80}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// the calendar day in a time zone, as YYYY-MM-DD
function dayIn(tz, t) {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(t))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;   // days since 1970 (NaN if not a date)
const dayOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const realDay = (d) => DAY_RE.test(d) && dayOf(dayNum(d)) === d;

function clientIp(req) {
  const peer = String(req.socket.remoteAddress || "");
  if (peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1") {
    // behind our own reverse proxy: it adds the real address last, so take the last one
    // (that is safe because the server sits behind our own Caddy on localhost; if the port were ever exposed directly, a client could spoof this header)
    const last = String(req.headers["x-forwarded-for"] || "").split(",").pop().trim();
    if (last) return last.slice(0, 64);
  }
  return peer;
}

// dir: STATS_DIR. o.online: () => players connected now (server.js); o.board: () => cpurank.js or null (the board names);
// o.page: the stats page file. Returns null while off.
function init(dir, opts) {
  if (!dir) return null;
  const o = Object.assign({}, DEFAULTS, opts || {});
  dir = path.resolve(String(dir));
  let key;
  try {
    if (!fs.statSync(dir).isDirectory()) return null;
    const probe = path.join(dir, ".probe-" + process.pid);
    fs.writeFileSync(probe, "ok"); fs.unlinkSync(probe);
    for (const f of fs.readdirSync(dir)) if (/\.tmp$/.test(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* leftover of a crash */ } }
    const kf = path.join(dir, "key");
    try { key = fs.readFileSync(kf, "utf8").trim(); } catch (e) { key = ""; }
    if (!/^[0-9a-f]{32}$/.test(key)) { key = crypto.randomBytes(16).toString("hex"); fs.writeFileSync(kf, key + "\n", { mode: 0o600 }); }
  } catch (e) { return null; }
  const keyHash = crypto.createHash("sha256").update(key).digest();
  let page = null;
  try { page = fs.readFileSync(o.page || path.join(__dirname, "public", "stats.html")); } catch (e) { console.warn("stats: public/stats.html missing: /stats not served"); }

  const now = () => (o.now ? o.now() : Date.now());
  const today = () => dayIn(o.tz, now());
  function readDay(d) {
    try { const c = JSON.parse(fs.readFileSync(path.join(dir, d + ".json"), "utf8")); if (isObj(c)) return c; } catch (e) { /* none yet */ }
    return {};
  }
  // the day being counted: picks up a file written before a restart
  let cur = { d: today(), c: null, n: 0, errs: 0, dirty: false };
  function load(d) {
    const c = readDay(d);
    cur = { d, c, n: Object.keys(c).length, errs: Object.keys(c).filter((k) => k.startsWith("err:")).length, dirty: false };
  }
  load(cur.d);
  function write() {
    if (!cur.dirty) return;
    const full = path.join(dir, cur.d + ".json"), tmp = full + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    try { fs.writeFileSync(tmp, JSON.stringify(cur.c), { mode: 0o600 }); fs.renameSync(tmp, full); cur.dirty = false; }
    catch (e) { try { fs.unlinkSync(tmp); } catch (e2) { /* ignore */ } console.warn("stats: could not write", cur.d, e.message); }
  }
  function roll() { const d = today(); if (d !== cur.d) { write(); load(d); } }
  function add(k) {
    if (k.startsWith("ret:") && !(realDay(k.slice(4, 14)) && dayNum(k.slice(4, 14)) <= dayNum(cur.d) + 1 && k.slice(4, 14) >= "2026-01-01")) return;
    if (!(k in cur.c)) {
      if (cur.n >= o.maxKeys) return;
      if (k.startsWith("err:") && cur.errs >= o.maxErrs) k = "err:other";
      if (!(k in cur.c)) { cur.n++; if (k.startsWith("err:")) cur.errs++; cur.c[k] = 0; }
    }
    cur.c[k]++; cur.dirty = true;
  }
  const validKey = (k) => typeof k === "string" && k.length <= 90 && (ERR_RE.test(k) || KEY_RES.some((re) => re.test(k)));

  const timers = [setInterval(() => { roll(); write(); }, o.flushMs)];
  if (typeof o.online === "function") {
    timers.push(setInterval(() => {
      roll();
      const n = o.online() | 0;
      if (n > (cur.c.peak | 0)) { if (!("peak" in cur.c)) cur.n++; cur.c.peak = n; cur.dirty = true; }
    }, o.sampleMs));
  }
  for (const t of timers) t.unref();
  // a restart or shutdown writes the day first (systemd sends SIGTERM)
  const bye = (sig) => { write(); process.exit(sig === "SIGINT" ? 130 : 0); };
  process.once("SIGTERM", bye); process.once("SIGINT", bye);
  process.once("beforeExit", write);

  const buckets = new Map();   // ip -> {t, hits, data}: one-minute windows, in memory only
  function take(ip, what, max) {
    const t = Date.now();
    let b = buckets.get(ip);
    if (!b || t - b.t >= 60000) { if (!b && buckets.size >= 20000) buckets.clear(); b = { t, hit: 0, data: 0 }; buckets.set(ip, b); }
    return ++b[what] <= max;
  }
  timers.push(setInterval(() => { const t = Date.now(); for (const [ip, b] of buckets) if (t - b.t >= 60000) buckets.delete(ip); }, 120000));
  timers[timers.length - 1].unref();

  const SEC = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow" };
  function send(res, status, obj, extra) {
    if (res.headersSent || res.writableEnded || res.destroyed) return;
    const body = obj === null ? "" : typeof obj === "string" ? obj : JSON.stringify(obj);
    res.writeHead(status, Object.assign({ "content-type": typeof obj === "string" ? "text/plain" : "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) }, SEC, extra));
    res.end(body);
  }
  function readBody(req, res, cb) {
    let n = 0, done = false, drained = 0;
    const chunks = [];
    const stop = (status) => { done = true; clearTimeout(timer); send(res, status, { error: status === 413 ? "big" : "slow" }); };
    const timer = setTimeout(() => { if (!done) { stop(408); req.destroy(); } }, o.bodyMs);
    if (Number(req.headers["content-length"]) > o.maxBody) stop(413);
    req.on("data", (c) => {
      if (done) { drained += c.length; if (drained > 1 << 16) req.destroy(); return; }
      n += c.length;
      if (n > o.maxBody) stop(413); else chunks.push(c);
    });
    req.on("end", () => { if (done) return; done = true; clearTimeout(timer); let m = null; try { m = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { /* bad */ } cb(isObj(m) ? m : null); });
    req.on("error", () => { done = true; clearTimeout(timer); });
  }
  const jsonish = (req) => /^(application\/json|text\/plain)\b/i.test(req.headers["content-type"] || "");

  function hit(req, res) {
    if (!take(clientIp(req), "hit", o.hitsPerMin)) return send(res, 429, { error: "slow" }, { "retry-after": "60" });
    readBody(req, res, (m) => {
      if (!m || !Array.isArray(m.e) || m.e.length > o.maxEvents) return send(res, 400, { error: "bad" });
      roll();
      for (const k of m.e) if (validKey(k)) add(k);
      send(res, 204, null);
    });
  }
  function data(req, res) {
    if (!take(clientIp(req), "data", o.dataPerMin)) return send(res, 429, { error: "slow" }, { "retry-after": "60" });
    readBody(req, res, (m) => {
      const k = m && typeof m.key === "string" ? crypto.createHash("sha256").update(m.key.trim()).digest() : null;
      if (!k || !crypto.timingSafeEqual(k, keyHash)) return setTimeout(() => send(res, 404, { error: "unknown" }), o.badKeyDelayMs);
      roll();
      const t = cur.d, last = dayNum(t);
      let first = last - 120;
      if (m.from && realDay(m.from)) first = Math.max(last - o.maxDays, Math.min(last, dayNum(m.from)));
      const days = {};
      for (const f of fs.readdirSync(dir)) {
        const fm = FILE_RE.exec(f);
        if (!fm || fm[1] === t) continue;
        const n = dayNum(fm[1]);
        if (n >= first && n <= last) days[fm[1]] = readDay(fm[1]);
      }
      if (cur.n) days[t] = Object.assign({}, cur.c);
      const out = { today: t, tz: o.tz, online: typeof o.online === "function" ? o.online() | 0 : 0, days };
      if (o.board && o.board()) out.board = o.board().names();   // the names on the Ranked vs CPU boards (cpurank.js)
      send(res, 200, out);
    });
  }
  // a name on the boards shown as "Potato" (on: true) or as the player wrote it again; the page key is needed as for data
  function blank(req, res) {
    if (!take(clientIp(req), "data", o.dataPerMin)) return send(res, 429, { error: "slow" }, { "retry-after": "60" });
    readBody(req, res, (m) => {
      const k = m && typeof m.key === "string" ? crypto.createHash("sha256").update(m.key.trim()).digest() : null;
      if (!k || !crypto.timingSafeEqual(k, keyHash)) return setTimeout(() => send(res, 404, { error: "unknown" }), o.badKeyDelayMs);
      const b = o.board && o.board();
      if (!b || typeof m.id !== "string" || !/^[0-9A-Z]{10}$/.test(m.id)) return send(res, 400, { error: "bad" });
      if (!b.blank(m.id, m.on !== false)) return send(res, 404, { error: "gone" });
      send(res, 200, { board: b.names() });
    });
  }

  // true when the request was ours; never throws
  function handle(req, res, url) {
    if (url !== "/stats" && url.slice(0, 11) !== "/api/stats/") return false;
    try {
      if (url === "/stats") {
        if (!page || (req.method !== "GET" && req.method !== "HEAD")) { send(res, 404, "Not found"); return true; }
        res.writeHead(200, Object.assign({ "content-type": "text/html; charset=utf-8", "content-length": page.length }, SEC, {
          "cache-control": "no-cache",
          "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        }));
        res.end(req.method === "HEAD" ? undefined : page);
        return true;
      }
      const sub = url.slice(11);
      if (sub !== "hit" && sub !== "data" && sub !== "blank") { send(res, 404, "Not found"); return true; }
      if (req.method !== "POST") { send(res, 405, { error: "post" }, { allow: "POST" }); return true; }
      if (!jsonish(req)) { send(res, 415, { error: "json" }); return true; }
      if (sub === "hit") hit(req, res); else if (sub === "blank") blank(req, res); else data(req, res);
    } catch (e) { console.warn("stats:", e && e.message); send(res, 500, { error: "server" }); }
    return true;
  }
  return { handle, dir, key: () => key, flush: write, today, stop: () => { for (const t of timers) clearInterval(t); write(); } };
}

module.exports = { init, dayIn, KEY_RES, ERR_RE };
