"use strict";
/*
 * PotatoBrawl relay server.
 * Serves the game page and relays live match data between players over WebSocket.
 * The server never runs the game: both players' browsers simulate it in lockstep and
 * only exchange inputs, so this process stays tiny (a few KB/s per match).
 *
 *   PORT               port to listen on (default 8080; Render sets this itself)
 *   HOST               address to listen on (default: all; the beta server uses 127.0.0.1)
 *   LAG_MS             artificial one-way delay for testing (default 0)
 *   KEEPALIVE_MINUTES  how often the server pings its own public URL so a free host
 *                      doesn't put it to sleep (default 4; 0 turns it off)
 *   KEEPALIVE_URL      the public URL to ping; on Render, RENDER_EXTERNAL_URL is used
 *   ACCOUNTS_DIR       folder for sync-code accounts (see accounts.js). Accounts are off unless it exists and is writable.
 *   STATS_DIR          folder for the anonymous play counts and the private /stats page (see stats.js). Off unless it exists and is writable.
 *
 * Quick match (quick.js): the queue for Ranked and Casual 1v1 against real players, and the referee that plays every Ranked match
 * itself from the inputs passing through here. Ranked needs the accounts; Casual works without them.
 * Ranked vs CPU (cpurank.js): the server deals each ranked CPU match and plays it again from the player's inputs before the CPU rank
 * moves; it also keeps the Boards (the CPU rank and the online rank) in memory.
 * Cups (tourney.js): the Daily Cup at 20:00 Berlin and Friends Cups; a match between two players is a Quick match room the cup assigns,
 * a match against a CPU is checked like Ranked vs CPU. Needs the sign-in and the accounts; each cup is saved in <accounts>/cups/.
 * Pommes (pommes.js): the premium currency's wallet in the account files, what it buys (an alternate KO page per fighter) and the
 * requests of tools/pommes.js (grant, move); needs the sign-in and the accounts. Money can't buy Pommes yet (the payment step comes later).
 * SIGUSR2 = drain before an update: no new Quick matches (or cup matches) are made, the running ones play on; /health counts them.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || undefined;
const LAG = Number(process.env.LAG_MS) || 0;
const GRACE_MS = 8000;           // keep a dropped player's seat this long so a brief reconnect continues the match
const MAX_ROOMS_PER_CLIENT = 6;
const MAX_PER_ROOM = 64;
const MAX_CLIENTS = 500;
const ROOM_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

// Static files are read once at start-up and kept gzipped in memory.
function asset(file, type, cache) {
  const raw = fs.readFileSync(path.join(__dirname, "public", file));
  return { raw, gz: zlib.gzipSync(raw, { level: 9 }), type, cache };
}
const FILES = {
  "/": asset("index.html", "text/html; charset=utf-8", "no-cache"),
};
FILES["/index.html"] = FILES["/"];
// Home-screen app files (manifest and icons, from web/). Optional: the game still runs without them.
for (const [file, type, cache] of [
  ["manifest.webmanifest", "application/manifest+json; charset=utf-8", "no-cache"],
  ["icon-192.png", "image/png", "public, max-age=604800"],
  ["icon-512.png", "image/png", "public, max-age=604800"],
  ["apple-touch-icon.png", "image/png", "public, max-age=604800"],
]) {
  try { FILES["/" + file] = asset(file, type, cache); } catch (e) { console.warn(`public/${file} missing: not served`); }
}

// Accounts (sync codes) live in accounts.js and are off unless ACCOUNTS_DIR is set. A problem there never stops the game server.
let accounts = null;
try {
  accounts = require("./accounts.js").init(process.env.ACCOUNTS_DIR);
  console.log(accounts ? `Accounts: on (${accounts.count()} saved in ${accounts.dir})` : process.env.ACCOUNTS_DIR ? "Accounts: off (ACCOUNTS_DIR is not a folder this server can write to)" : "Accounts: off");
} catch (e) { console.warn("Accounts: off,", e.message); }
// Play counts (stats.js): off unless STATS_DIR is set. clients is declared further down; it is only read once the server runs.
let stats = null;
try {
  stats = require("./stats.js").init(process.env.STATS_DIR, { online: () => clients.size, board: () => cpurank, bw: () => bossweek, accounts: () => accounts });   // cpurank is set further down
  console.log(stats ? `Play counts: on (${stats.dir})` : process.env.STATS_DIR ? "Play counts: off (STATS_DIR is not a folder this server can write to)" : "Play counts: off");
} catch (e) { console.warn("Play counts: off,", e.message); }

// Quick match (quick.js). Declared before the server: clients and out() are only used once it runs.
let quick = null;
try {
  quick = require("./quick.js").init({
    accounts,
    send: (peer, msg) => { const c = clients.get(peer); if (c) out(c.ws, msg); },
    nameOf: (peer) => { const c = clients.get(peer); return c ? c.name : ""; },
    byOf: (peer) => { const c = clients.get(peer); return c ? c.by : ""; },
    online: () => clients.size,
    onCup: (tm, res, why, rv) => { if (tourney) tourney.matchEnd(tm, res, why, rv); },   // a cup match the referee decided
    T: process.env.QM_T ? JSON.parse(process.env.QM_T) : undefined,   // tests only: shorter waits
  });
  console.log(`Quick match: on (game version ${quick.proto}, Ranked ${accounts ? "on" : "off: needs accounts"})`);
} catch (e) { console.warn("Quick match: off,", e.message); }
// Ranked vs CPU and the Boards (cpurank.js): needs Quick match's sign-in; the CPU rank needs the accounts too.
let cpurank = null;
try {
  if (quick) {
    cpurank = require("./cpurank.js").init({
      accounts, proto: quick.proto, seatOf: quick.seatOf,
      send: (peer, msg) => { const c = clients.get(peer); if (c) out(c.ws, msg); },
      T: process.env.CPU_T ? JSON.parse(process.env.CPU_T) : undefined,   // tests only: shorter waits
    });
    console.log(`Ranked vs CPU: ${accounts ? "on" : "off: needs accounts"}`);
  }
} catch (e) { console.warn("Ranked vs CPU: off,", e.message); }
// Boss Week (bossweek.js): the weekly boss board, its tickets and the server's replay of each new best; needs the sign-in and the accounts.
let bossweek = null;
try {
  if (quick && accounts) {
    bossweek = require("./bossweek.js").init({
      accounts, proto: quick.proto, seatOf: quick.seatOf,
      send: (peer, msg) => { const c = clients.get(peer); if (c) out(c.ws, msg); },
      T: process.env.BW_T ? JSON.parse(process.env.BW_T) : undefined,   // tests only: shorter waits
      now: process.env.BW_NOW ? (() => { const d = +process.env.BW_NOW - Date.now(); return () => Date.now() + d; })() : undefined,   // tests only: another week
    });
    console.log("Boss Week: on");
  } else if (quick) console.log("Boss Week: off: needs accounts");
} catch (e) { console.warn("Boss Week: off,", e.message); }
// Pommes (pommes.js): the wallet, the KO pages it buys, tools/pommes.js's requests; needs the sign-in and the accounts.
let pommes = null;
try {
  if (quick && accounts) {
    pommes = require("./pommes.js").init({
      accounts, seatOf: quick.seatOf,
      send: (peer, msg) => { const c = clients.get(peer); if (c) out(c.ws, msg); },
      spoolMs: process.env.PM_SPOOL_MS ? +process.env.PM_SPOOL_MS : undefined,   // tests only: read the requests folder more often
    });
    console.log("Pommes: on (buying with money: off)");
  } else if (quick) console.log("Pommes: off: needs accounts");
} catch (e) { console.warn("Pommes: off,", e.message); }
// Cups (tourney.js): the Daily Cup and Friends Cups; needs Quick match (its rooms, referee and sign-in) and the accounts.
let tourney = null;
try {
  if (quick && accounts) {
    tourney = require("./tourney.js").init({
      accounts, quick, proto: quick.proto, seatOf: quick.seatOf,
      send: (peer, msg) => { const c = clients.get(peer); if (c) out(c.ws, msg); },
      byOf: (peer) => { const c = clients.get(peer); return c ? c.by : ""; },
      T: process.env.TC_T ? JSON.parse(process.env.TC_T) : undefined,   // tests only: shorter waits, another start time
      now: process.env.TC_NOW ? (() => { const d = +process.env.TC_NOW - Date.now(); return () => Date.now() + d; })() : undefined,   // tests only: another day
    });
    console.log("Cups: on");
  } else if (quick) console.log("Cups: off: needs accounts");
} catch (e) { console.warn("Cups: off,", e.message); }
process.on("SIGUSR2", () => { if (quick) { quick.drain(); console.log(`Quick match: draining for an update, ${quick.running()} ranked matches still running`); } });

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (accounts && accounts.handle(req, res, url)) return;
  if (stats && stats.handle(req, res, url)) return;
  if (bossweek && bossweek.http(req, res, url)) return;   // GET /api/run/<id>: a Boss Week run to watch
  // accounts off here: 202 tells the page there are none (acctPing: anything but 200 or a failed call means off; a 404 would show as an error in the browser console)
  if (!accounts && url === "/api/acct/ping") { res.writeHead(202, { "cache-control": "no-store" }); res.end(); return; }
  // counts off here: 202 tells the page to stop sending for the visit (a 404 would show as an error in the browser console)
  if (!stats && url === "/api/stats/hit") { res.writeHead(202, { "cache-control": "no-store" }); res.end(); return; }
  const file = (req.method === "GET" || req.method === "HEAD") && FILES[url];
  if (file) {
    const gzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
    const body = gzip ? file.gz : file.raw;
    res.writeHead(200, {
      "content-type": file.type,
      "content-length": body.length,
      "cache-control": file.cache,
      "vary": "accept-encoding",
      ...(gzip ? { "content-encoding": "gzip" } : {}),
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
    return res.end(req.method === "HEAD" ? undefined : body);
  }
  if (url === "/health") {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    // "ranked matches running" is what deploy/update.txt waits for before a restart
    const qm = quick ? `ranked matches running: ${quick.running()}\nsearching: ${quick.searching()}\n${quick.draining() ? "draining: yes\n" : ""}` : "";
    return res.end(`ok\nplayers online: ${clients.size}\n${qm}last keep-alive: ${lastPing}\n`);
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 8 * 1024 });
const rooms = new Map();    // room name -> Map(peer -> { presence })
const clients = new Map();  // peer -> { ws, by, name, rooms: Set, goneTimer }

const clean = (s) => String(s || "").replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").trim().slice(0, 20);

function out(ws, msg) {
  if (!ws || ws.readyState !== 1) return;
  const s = JSON.stringify(msg);
  if (LAG) setTimeout(() => { if (ws.readyState === 1) ws.send(s); }, LAG);
  else ws.send(s);
}
function toRoom(name, msg, exceptPeer) {
  const r = rooms.get(name);
  if (!r) return;
  for (const peer of r.keys()) if (peer !== exceptPeer) { const c = clients.get(peer); if (c) out(c.ws, msg); }
}
function info(peer, name) {
  const c = clients.get(peer);
  const m = rooms.get(name).get(peer);
  return { peer, by: c ? c.by : null, name: c ? c.name : "", presence: m.presence };
}
function leaveRoom(peer, name) {
  const r = rooms.get(name);
  if (!r || !r.has(peer)) return;
  r.delete(peer);
  if (!r.size) rooms.delete(name);
  const c = clients.get(peer);
  if (c) c.rooms.delete(name);
  toRoom(name, { t: "left", room: name, peer });
  if (quick) quick.left(peer, name);   // leaving a running Ranked match is a loss
}
function drop(peer) {
  const c = clients.get(peer);
  if (!c) return;
  clearTimeout(c.goneTimer);
  for (const name of [...c.rooms]) leaveRoom(peer, name);
  clients.delete(peer);
  if (quick) quick.gone(peer);
  if (cpurank) cpurank.gone(peer);
  if (bossweek) bossweek.gone(peer);
  if (tourney) tourney.gone(peer);
  if (pommes) pommes.gone(peer);
}

wss.on("connection", (ws) => {
  let peer = null;
  let budget = 120, last = Date.now();
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (buf) => {
    const now = Date.now();
    budget = Math.min(240, budget + (now - last) * 0.12);   // about 120 messages per second, burst 240
    last = now;
    if (--budget < 0) return;
    let m;
    try { m = JSON.parse(buf); } catch (e) { return; }
    if (!m || typeof m !== "object") return;

    if (m.t === "hello") {
      if (peer || !ID_RE.test(m.peer || "") || !ID_RE.test(m.by || "")) return ws.close(1008, "bad hello");
      // k: a secret the page made when it opened. Peer ids are seen by everyone in a room, so a reconnect that takes over a peer
      // must carry the same secret (a page from before the secret has none and keeps the old rule)
      const k = typeof m.k === "string" && KEY_RE.test(m.k) ? m.k : "";
      const old = clients.get(m.peer);
      if (old && old.k !== k) return ws.close(1008, "taken");
      if (!old && clients.size >= MAX_CLIENTS) return ws.close(1013, "server full");
      peer = m.peer;
      if (old) {
        clearTimeout(old.goneTimer); old.goneTimer = null;
        if (old.ws && old.ws !== ws) { try { old.ws.close(); } catch (e) { /* already gone */ } }
        old.ws = ws; old.name = clean(m.name);
      } else {
        clients.set(peer, { ws, by: m.by, k, name: clean(m.name), rooms: new Set(), goneTimer: null });
      }
      return out(ws, { t: "welcome", peer });
    }
    if (!peer) return;
    const c = clients.get(peer);
    if (!c || c.ws !== ws) return;

    if (quick && quick.handle(peer, m)) return;   // auth, qm, qmx
    if (bossweek && bossweek.handle(peer, m)) return;   // bwme, bwt, bwr, bd {k: "w"}
    if (cpurank && cpurank.handle(peer, m)) return;   // cme, ct, cr, bd
    if (tourney && tourney.handle(peer, m)) return;   // tc?, tci, tcj, tcn, tcs, tcl, tcp, tcgo, tcr
    if (pommes && pommes.handle(peer, m)) return;   // pm, pmb
    if (m.t === "join") {
      const name = m.room;
      if (typeof name !== "string" || !ROOM_RE.test(name)) return;
      if (quick && !quick.canJoin(peer, name)) return;   // a Quick match room is its two players' only
      if (!c.rooms.has(name) && c.rooms.size >= MAX_ROOMS_PER_CLIENT) return;
      let r = rooms.get(name);
      if (!r) { r = new Map(); rooms.set(name, r); }
      if (!r.has(peer)) {
        if (r.size >= MAX_PER_ROOM) return;
        r.set(peer, { presence: {} });
        c.rooms.add(name);
        toRoom(name, Object.assign({ t: "joined", room: name }, info(peer, name)), peer);
      }
      out(ws, { t: "peers", room: name, peers: [...r.keys()].map((p) => info(p, name)) });
    } else if (m.t === "leave") {
      if (typeof m.room === "string") leaveRoom(peer, m.room);
    } else if (m.t === "presence") {
      const r = typeof m.room === "string" ? rooms.get(m.room) : null;
      if (!r || !r.has(peer) || !m.p || typeof m.p !== "object" || Array.isArray(m.p)) return;
      r.get(peer).presence = m.p;
      toRoom(m.room, { t: "presence", room: m.room, peer, p: m.p }, peer);
      if (quick) quick.presence(m.room, peer, m.p);   // the referee reads the inputs it just passed on
    } else if (m.t === "name") {
      c.name = clean(m.name);
      for (const name of c.rooms) toRoom(name, { t: "name", by: c.by, name: c.name }, peer);
    } else if (m.t === "bye") {
      drop(peer);
      peer = null;
    }
  });

  ws.on("close", () => {
    if (!peer) return;
    const c = clients.get(peer);
    if (!c || c.ws !== ws) return;
    c.ws = null;
    c.goneTimer = setTimeout(() => drop(peer), GRACE_MS);
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

// Keep-alive: free hosts such as Render stop a service after 15 minutes without incoming
// traffic. Requesting our own public URL goes out through the host's front door and back
// in, which counts as incoming traffic, so the server stays awake with no outside service.
const KEEPALIVE_MIN = Number(process.env.KEEPALIVE_MINUTES ?? 4);
const SELF_URL = (process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
let lastPing = "never";
if (SELF_URL && KEEPALIVE_MIN > 0 && typeof fetch === "function") {
  const ping = () => fetch(SELF_URL + "/health", { headers: { "user-agent": "potatobrawl-keepalive" } })
    .then((r) => { lastPing = `${new Date().toISOString()} ${r.status}`; })
    .catch((e) => { lastPing = `${new Date().toISOString()} failed: ${e.message}`; console.warn("keep-alive ping failed:", e.message); });
  setInterval(ping, KEEPALIVE_MIN * 60 * 1000);
  setTimeout(ping, 30 * 1000);
  console.log(`Keep-alive: pinging ${SELF_URL}/health every ${KEEPALIVE_MIN} min`);
}

server.listen(PORT, HOST, () => console.log(`PotatoBrawl running on http://${HOST || "localhost"}:${PORT}`));
