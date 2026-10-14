"use strict";
/*
 * PotatoBrawl accounts: a sync code instead of a password, so a player can carry their progress to another device.
 * Used by server.js and nothing else. Node's own http/fs/crypto only, no dependency.
 *
 * Off unless ACCOUNTS_DIR names a folder that exists and can be written. While off, nothing here runs and every
 * /api/acct/* address answers 404 like any other unknown page.
 *
 *   GET  /api/acct/ping   200 when accounts are on
 *   POST /api/acct/new    {prof}             -> {code, rev}           a new account, rev 1
 *   POST /api/acct/load   {code}             -> {prof, rev, t}        or 404 {error:"unknown"}
 *   POST /api/acct/save   {code, rev, prof}  -> {rev}                 or 409 {prof, rev, t} when rev is not the stored one
 *
 * Everything is a JSON POST body, so codes never appear in URLs or logs. One account = one small file named
 * sha256(code).json, holding {rev, t, prof}; the folder never contains a code. Files are written to a temp name and
 * renamed, and the check-and-write of a save happens in one synchronous step, so two saves can never both win.
 * Codes: 16 characters of Crockford base32 (no I, L, O, U), 80 bits from crypto.randomBytes, shown as XXXX-XXXX-XXXX-XXXX.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
const FILE_RE = /^[0-9a-f]{64}\.json$/;
const DEFAULTS = {
  maxBody: 16 * 1024,            // bytes of request body
  perMin: 60,                    // requests per IP per minute
  newPerHour: 10,                // new accounts per IP per hour
  maxFiles: 20000,               // accounts in total
  maxBytes: 200 * 1024 * 1024,   // size of the whole folder
  unknownDelayMs: 350,           // an unknown code is answered after this pause, so codes cannot be guessed fast
  bodyMs: 10000,                 // a request body must arrive within this time
};

function newCode() {
  const b = crypto.randomBytes(11);
  let s = "";
  for (let i = 0; i < 16; i++) {
    const bit = i * 5, byte = bit >> 3, off = bit & 7;
    s += ALPHA[(((b[byte] << 8) | b[byte + 1]) >> (11 - off)) & 31];
  }
  return s;
}
// What a player may type: any case, dashes or spaces optional, O read as 0, I and L read as 1. "" when it cannot be a code.
function normCode(s) {
  if (typeof s !== "string" || s.length > 64) return "";
  const c = s.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  return CODE_RE.test(c) ? c : "";
}
const fmtCode = (c) => c.replace(/(.{4})(?=.)/g, "$1-");
const hashOf = (code) => crypto.createHash("sha256").update(code).digest("hex");
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// a plain, shallow JSON value (the body limit already bounds its size)
function shapeOk(v, d) {
  if (d > 6) return false;
  if (Array.isArray(v)) return v.length <= 500 && v.every((x) => shapeOk(x, d + 1));
  if (isObj(v)) { const k = Object.keys(v); return k.length <= 200 && k.every((key) => shapeOk(v[key], d + 1)); }
  return true;
}
function clientIp(req) {
  const peer = String(req.socket.remoteAddress || "");
  if (peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1") {
    // behind our own reverse proxy: it adds the real address last, so take the last one
    const xff = String(req.headers["x-forwarded-for"] || "");
    const last = xff.split(",").pop().trim();
    if (last) return last.slice(0, 64);
  }
  return peer;
}

function init(dir, opts) {
  if (!dir) return null;
  const o = Object.assign({}, DEFAULTS, opts || {});
  dir = path.resolve(String(dir));
  const sizes = new Map();   // file name -> bytes
  let total = 0;
  try {
    if (!fs.statSync(dir).isDirectory()) return null;
    const probe = path.join(dir, ".probe-" + process.pid);
    fs.writeFileSync(probe, "ok"); fs.unlinkSync(probe);
    for (const f of fs.readdirSync(dir)) {
      if (FILE_RE.test(f)) { const n = fs.statSync(path.join(dir, f)).size; sizes.set(f, n); total += n; }
      else if (/\.tmp$/.test(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* leftover of a crash: harmless */ } }
    }
  } catch (e) { return null; }

  const buckets = new Map();   // ip -> {m, mn, h, hn}: request window and new-account window
  function take(ip, isNew) {
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b) { if (buckets.size >= 20000) buckets.clear(); b = { m: now, mn: 0, h: now, hn: 0 }; buckets.set(ip, b); }
    if (now - b.m >= 60000) { b.m = now; b.mn = 0; }
    if (now - b.h >= 3600000) { b.h = now; b.hn = 0; }
    if (isNew) { if (b.hn >= o.newPerHour) return false; b.hn++; return true; }
    if (b.mn >= o.perMin) return false;
    b.mn++; return true;
  }
  setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets) if (now - b.m >= 60000 && now - b.h >= 3600000) buckets.delete(ip);
  }, 300000).unref();

  function send(res, status, obj, extra) {
    if (res.headersSent || res.writableEnded || res.destroyed) return;
    const body = obj === null ? "Not found" : JSON.stringify(obj);
    res.writeHead(status, Object.assign({
      "content-type": obj === null ? "text/plain" : "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    }, extra));
    res.end(body);
  }
  const unknown = (res) => setTimeout(() => send(res, 404, { error: "unknown" }), o.unknownDelayMs);

  const fileOf = (code) => hashOf(code) + ".json";
  function read(code) {
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, fileOf(code)), "utf8"));
      if (isObj(rec) && Number.isSafeInteger(rec.rev) && rec.rev >= 1 && isObj(rec.prof)) return rec;
    } catch (e) { /* no such account */ }
    return null;
  }
  // temp file + rename, so a crash never leaves half an account. Throws on a disk problem.
  function write(file, rec) {
    const data = JSON.stringify(rec), full = path.join(dir, file), tmp = full + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    let fd = -1;
    try {
      fd = fs.openSync(tmp, "wx", 0o600);
      fs.writeSync(fd, data); fs.fsyncSync(fd); fs.closeSync(fd); fd = -1;
      fs.renameSync(tmp, full);
    } catch (e) {
      if (fd >= 0) { try { fs.closeSync(fd); } catch (e2) { /* ignore */ } }
      try { fs.unlinkSync(tmp); } catch (e2) { /* ignore */ }
      throw e;
    }
    const n = Buffer.byteLength(data);
    total += n - (sizes.get(file) || 0); sizes.set(file, n);
  }

  function readBody(req, res, cb) {
    let n = 0, done = false, drained = 0;
    const chunks = [];
    const stop = (status, msg) => { done = true; clearTimeout(timer); send(res, status, { error: msg }); };
    const timer = setTimeout(() => { if (!done) { stop(408, "slow"); req.destroy(); } }, o.bodyMs);
    if (Number(req.headers["content-length"]) > o.maxBody) stop(413, "big");
    // after an early answer the rest of the body is read and thrown away (up to a limit), so the client gets the answer cleanly
    req.on("data", (c) => {
      if (done) { drained += c.length; if (drained > 1 << 20) req.destroy(); return; }
      n += c.length;
      if (n > o.maxBody) stop(413, "big"); else chunks.push(c);
    });
    req.on("end", () => { if (done) return; done = true; clearTimeout(timer); try { cb(Buffer.concat(chunks).toString("utf8")); } catch (e) { fail(res, e); } });
    req.on("error", () => { done = true; clearTimeout(timer); });
  }
  function fail(res, e) { console.warn("accounts:", e && e.message); send(res, 500, { error: "server" }); }

  function route(req, res, sub, ip) {
    if (sub === "ping") return send(res, req.method === "GET" || req.method === "HEAD" ? 200 : 405, { ok: true });
    if (req.method !== "POST") return send(res, 405, { error: "post" }, { allow: "POST" });
    if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) return send(res, 415, { error: "json" });
    readBody(req, res, (text) => {
      let m;
      try { m = JSON.parse(text); } catch (e) { return send(res, 400, { error: "json" }); }
      if (!isObj(m)) return send(res, 400, { error: "json" });
      if (sub === "new") {
        if (!isObj(m.prof) || !shapeOk(m.prof, 0)) return send(res, 400, { error: "prof" });
        if (!take(ip, true)) return send(res, 429, { error: "slow" }, { "retry-after": "3600" });
        const rec = { rev: 1, t: Date.now(), prof: m.prof }, len = Buffer.byteLength(JSON.stringify(rec));
        if (sizes.size >= o.maxFiles || total + len > o.maxBytes) return send(res, 503, { error: "full" });
        for (let i = 0; i < 5; i++) {
          const code = newCode();
          if (sizes.has(fileOf(code))) continue;   // a collision is practically impossible; try again anyway
          write(fileOf(code), rec);
          return send(res, 200, { code: fmtCode(code), rev: 1 });
        }
        return send(res, 500, { error: "server" });
      }
      const code = normCode(m.code);
      if (!code) return send(res, 400, { error: "code" });
      if (sub === "load") {
        const rec = read(code);
        return rec ? send(res, 200, { prof: rec.prof, rev: rec.rev, t: rec.t }) : unknown(res);
      }
      if (sub === "save") {
        if (!Number.isSafeInteger(m.rev) || m.rev < 1 || !isObj(m.prof) || !shapeOk(m.prof, 0)) return send(res, 400, { error: "prof" });
        const rec = read(code);
        if (!rec) return unknown(res);
        if (rec.rev !== m.rev) return send(res, 409, { prof: rec.prof, rev: rec.rev, t: rec.t });
        const next = { rev: rec.rev + 1, t: Date.now(), prof: m.prof }, file = fileOf(code);
        if (total - (sizes.get(file) || 0) + Buffer.byteLength(JSON.stringify(next)) > o.maxBytes) return send(res, 503, { error: "full" });
        write(file, next);
        return send(res, 200, { rev: next.rev, t: next.t });
      }
      send(res, 404, null);
    });
  }

  // true when the request was ours (any /api/acct/ address); never throws
  function handle(req, res, url) {
    if (url.slice(0, 10) !== "/api/acct/") return false;
    try {
      const sub = url.slice(10);
      if (sub !== "ping" && sub !== "new" && sub !== "load" && sub !== "save") { send(res, 404, null); return true; }
      if (!take(clientIp(req), false)) { send(res, 429, { error: "slow" }, { "retry-after": "60" }); return true; }
      route(req, res, sub, clientIp(req));
    } catch (e) { fail(res, e); }
    return true;
  }
  return { handle, count: () => sizes.size, bytes: () => total, dir };
}

module.exports = { init, normCode, fmtCode, newCode, hashOf };
