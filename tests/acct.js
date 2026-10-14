// Accounts: the server side (accounts.js, through server.js on port 8094 with a temporary ACCOUNTS_DIR) and the merge
// (game/sync.js). Node only, about 10 seconds. Prints PASS/FAIL lines and "acct ok" at the end.
// Needs `python3 game/build.py` to have run (server.js serves public/).
// Usage: node tests/acct.js
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const SYNC = require(path.join(ROOT, "game/sync.js"));
const { FIGHTERS } = require(path.join(ROOT, "game/core.js")).BL;
const ACC = require(path.join(ROOT, "accounts.js"));
const PORT = 8094;
let bad = 0;
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) bad++; };
const eq = (a, b) => SYNC.canon(a) === SYNC.canon(b);

// one request; resolves {status, json, ms, headers}
function call(method, p, body, headers, raw) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const data = raw !== undefined ? raw : body === undefined ? null : JSON.stringify(body);
    const h = Object.assign(data !== null && !(headers && headers["transfer-encoding"]) ? { "content-length": Buffer.byteLength(data) } : {}, data !== null ? { "content-type": "application/json" } : {}, headers);
    const rq = http.request({ host: "127.0.0.1", port: PORT, method, path: p, headers: h, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        let json = null; try { json = JSON.parse(text); } catch (e) { /* plain text */ }
        resolve({ status: res.statusCode, json, text, ms: Date.now() - t0, headers: res.headers });
      });
    });
    rq.on("error", (e) => resolve({ status: 0, json: null, text: String(e.message), ms: Date.now() - t0, headers: {} }));
    if (data !== null) rq.write(data);
    rq.end();
  });
}
const post = (sub, body, headers) => call("POST", "/api/acct/" + sub, body, headers);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(env) {
  const proc = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), KEEPALIVE_MINUTES: "0" }, env), stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => { log += d; }); proc.stderr.on("data", (d) => { log += d; });
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < 50; i++) {
      const r = await call("GET", "/health");
      if (r.status === 200) return resolve({ proc, log: () => log });
      if (proc.exitCode !== null) return reject(new Error("server.js exited: " + log));
      await sleep(100);
    }
    reject(new Error("server.js did not start: " + log));
  });
}
const stopServer = (s) => new Promise((resolve) => { if (s.proc.exitCode !== null) return resolve(); s.proc.once("exit", resolve); s.proc.kill(); });
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pbacct-"));
const rmDir = (d) => fs.rmSync(d, { recursive: true, force: true });

// ---------------------------------------------------------------- the merge and the helpers (pure)
function pureTests() {
  const prof = (o) => SYNC.sanitize(Object.assign({ tokens: 0, rating: 1000, owned: {}, pal: {}, last: FIGHTERS[0].id }, o), FIGHTERS);
  const ids = FIGHTERS.map((f) => f.id);
  // codes
  check(SYNC.normCode("7k3f-9qxm-2pma-w8rt") === "7K3F9QXM2PMAW8RT", "code: any case, dashes optional");
  check(SYNC.normCode("OOOO-IIII-LLLL-0000") === "0000111111110000", "code: O reads as 0, I and L as 1");
  check(SYNC.normCode("7K3F-9QXM-2PMA") === "" && SYNC.normCode("UUUU-UUUU-UUUU-UUUU") === "" && SYNC.normCode(null) === "" && SYNC.normCode("7K3F-9QXM-2PMA-W8R!") === "", "code: wrong length or letters are refused");
  check(SYNC.normCode("https://potatobrawl.cloud/#sync=7K3F-9QXM-2PMA-W8RT") === "7K3F9QXM2PMAW8RT", "code: a pasted link works");
  check(SYNC.typing("7k3f9qxm2") === "7K3F-9QXM-2" && SYNC.fmtCode("7K3F9QXM2PMAW8RT") === "7K3F-9QXM-2PMA-W8RT", "code: typing adds the dashes");
  check(ACC.normCode("7k3f-9qxm-2pma-w8rt") === SYNC.normCode("7k3f-9qxm-2pma-w8rt") && ACC.normCode("OIL0-0000-0000-0000") === SYNC.normCode("OIL0-0000-0000-0000"), "code: server and page read codes the same way");
  const seen = new Set();
  for (let i = 0; i < 2000; i++) { const c = ACC.newCode(); if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(c)) seen.add("bad"); seen.add(c); }
  check(seen.size === 2000, "code: 2000 new codes, all well formed and different");

  // sanitize
  const dirty = SYNC.sanitize({ tokens: -5, wins: 1e12, rating: "x", name: "  A\u0000B\u202e C  ".padEnd(40, "z"), last: "nobody", owned: { phoenix: [2, 2, 9, -1, "a"], gunslinger: [0, 1, 3], "__proto__": [1], "Bad Id": [1] }, pal: { phoenix: 99, gunslinger: 2 },
    history: [{ r: 1, d: 12, me: "phoenix", op: "odin", opr: 1000, t: 5 }, "junk", { r: 7, d: 1e9 }], extra: 1 }, FIGHTERS);
  check(dirty.tokens === 0 && dirty.wins === 1e9 && dirty.rating === 1000 && dirty.peak === 1000, "sanitize: numbers are clamped, junk gets the default");
  check(dirty.name.length <= 16 && !/[\u0000\u202e]/.test(dirty.name), "sanitize: the name is plain text of at most 16 characters");
  check(dirty.last === FIGHTERS[0].id, "sanitize: an unknown last fighter becomes the first fighter");
  check(eq(dirty.owned.phoenix, [0, 2]) && dirty.pal.phoenix === FIGHTERS.find((f) => f.id === "phoenix").palettes.length - 1, "sanitize: skins are whole numbers in range, the base skin is always owned");
  check(eq(dirty.owned.gunslinger, [0, 1, 3]) && dirty.pal.gunslinger === 2, "sanitize: a fighter this copy does not know is kept (an older copy must not wipe skins)");
  check(!Object.prototype.hasOwnProperty.call(dirty.owned, "__proto__") && !("Bad Id" in dirty.owned) && Object.getPrototypeOf(dirty.owned) === Object.prototype, "sanitize: odd fighter keys are dropped");
  check(dirty.history.length === 2 && dirty.history[1].r === 0 && dirty.history[1].d === 500, "sanitize: history keeps only well formed entries, in range");
  check(SYNC.sanitize([], FIGHTERS) === null && SYNC.sanitize("x", FIGHTERS) === null && SYNC.sanitize(null, FIGHTERS) === null, "sanitize: not an object -> null");
  const again = SYNC.sanitize(dirty, FIGHTERS);
  check(eq(again, dirty), "sanitize: cleaning twice changes nothing");

  // apply: device settings stay
  const P = { sound: false, screen: "up", rules: { l: 5, t: 2, b: 3 }, fs: true, a2hs: true, tokens: 1, owned: {}, pal: {} };
  SYNC.applyTo(P, prof({ tokens: 40, name: "Spud", rating: 1111, owned: { phoenix: [0, 1] } }));
  check(P.tokens === 40 && P.rating === 1111 && P.name === "Spud" && eq(P.owned.phoenix, [0, 1]) && P.sound === false && P.screen === "up" && P.rules.l === 5 && P.fs === true && P.a2hs === true, "apply: progress arrives, sound/screen/rules/fullscreen stay on the device");
  check(eq(SYNC.snapshot(P, FIGHTERS), prof({ tokens: 40, name: "Spud", rating: 1111, owned: { phoenix: [0, 1] } })), "apply: the profile reads back as the same prof");

  // hasProgress
  check(!SYNC.hasProgress({}) && !SYNC.hasProgress({ tokens: 0, matches: 0, owned: { phoenix: [0] } }), "progress: a fresh profile has none");
  check(SYNC.hasProgress({ matches: 1 }) && SYNC.hasProgress({ tokens: 5 }) && SYNC.hasProgress({ owned: { odin: [0, 2] } }) && SYNC.hasProgress({ cups: 1 }), "progress: a match, chips, a skin or a cup counts");

  // merge
  const base = prof({ tokens: 100, wins: 4, losses: 2, matches: 6, rating: 1050, peak: 1100, name: "Old", owned: { phoenix: [0, 1] }, pal: { phoenix: 1 }, history: [{ r: 1, d: 10, me: "phoenix", op: "odin", opr: 1000, t: 1 }] });
  const A = prof(Object.assign({}, base, { tokens: 130, wins: 5, matches: 7, rating: 1062, peak: 1100, history: [{ r: 1, d: 12, me: "phoenix", op: "odin", opr: 1000, t: 2 }, base.history[0]] }));
  const B = prof(Object.assign({}, base, { tokens: 90, losses: 3, matches: 7, rating: 1040, owned: { phoenix: [0, 1, 3] }, pal: { phoenix: 3 }, history: [{ r: 0, d: -10, me: "phoenix", op: "odin", opr: 1000, t: 3 }, base.history[0]] }));
  // A saved first. B (local, based on `base`) meets A's copy (server).
  const m1 = SYNC.mergeProf(B, base, A, true);
  check(m1.tokens === 120 && m1.wins === 5 && m1.losses === 3 && m1.matches === 8, "merge: counters add what each side changed (chips 100 -> +30 on A, -10 on B = 120)");
  check(eq(m1.owned.phoenix, [0, 1, 3]) && m1.pal.phoenix === 3, "merge: skins are a union, a pick only one side changed is kept");
  check(m1.rating === 1040 && eq(m1.history, B.history) && m1.peak === 1100, "merge: both changed the rating -> the newer side (this device)");
  const m2 = SYNC.mergeProf(B, base, A, false);
  check(m2.rating === 1062 && eq(m2.history, A.history) && m2.tokens === 120, "merge: ...or the server's copy when that is newer; counters are the same either way");
  check(SYNC.mergeProf(base, base, A, true).tokens === A.tokens && eq(SYNC.mergeProf(base, base, A, true), A), "merge: a device with no changes just takes the server's copy");
  check(eq(SYNC.mergeProf(B, base, base, false), B), "merge: the server unchanged -> this device's copy");
  check(eq(SYNC.mergeProf(m1, m1, m1, true), m1), "merge: nothing changed anywhere -> the same copy");
  // a third device saves while we are still trying: the next merge is based on the copy we just merged with, so nothing counts twice
  const C3 = prof(Object.assign({}, A, { tokens: A.tokens + 7 }));                  // another device on top of A's copy
  const m3 = SYNC.mergeProf(m1, A, C3, true);
  check(m3.tokens === m1.tokens + 7 && m3.wins === m1.wins, "merge: a second conflict on the same save counts each change once (chips " + m1.tokens + " + 7 = " + m3.tokens + ")");
  const spent = SYNC.mergeProf(prof({ tokens: 0 }), prof({ tokens: 100 }), prof({ tokens: 30 }), true);
  check(spent.tokens === 0, "merge: chips never go below zero");
  const pk = SYNC.mergeProf(prof({ rating: 900, peak: 1300 }), prof({ rating: 1000, peak: 1100 }), prof({ rating: 1200, peak: 1200 }), false);
  check(pk.peak === 1300 && pk.rating === 1200, "merge: the peak keeps the higher value if both raised it");
  const nm = SYNC.mergeProf(prof({ name: "Mine" }), prof({ name: "Old" }), prof({ name: "Theirs" }), true);
  check(nm.name === "Mine", "merge: the name follows the newer side");
  const none = SYNC.mergeProf(prof({}), null, prof({ tokens: 5 }), false);
  check(none.tokens === 5, "merge: no base copy works");
  const gone = SYNC.mergeProf(prof({ owned: { phoenix: [0, 2] } }), prof({}), prof({ owned: { odin: [0, 1], gunslinger: [0, 1] } }), false);
  check(eq(gone.owned.odin, [0, 1]) && eq(gone.owned.gunslinger, [0, 1]) && eq(gone.owned.phoenix, [0, 2]), "merge: skins of a fighter this copy does not know survive");
  // two devices, a chain of syncs, nothing lost
  let server = prof({ tokens: 10 }), devA = { base: server, cur: prof({ tokens: 10 }) }, devB = { base: server, cur: prof({ tokens: 10 }) };
  devA.cur = prof({ tokens: 50, owned: { odin: [0, 1] } });                       // A wins chips and buys a skin
  devB.cur = prof({ tokens: 25, owned: { dragon: [0, 2] } });                     // B (not synced yet) wins chips and buys another skin
  server = devA.cur; devA.base = devA.cur;                                        // A saves
  const merged = SYNC.mergeProf(devB.cur, devB.base, server, false);              // B is told to merge, then saves
  server = merged; devB.base = merged; devB.cur = merged;
  const back = SYNC.mergeProf(devA.cur, devA.base, server, false);                // A pulls
  check(back.tokens === 65 && eq(back.owned.odin, [0, 1]) && eq(back.owned.dragon, [0, 2]), "merge: two devices, in turn and in conflict: chips 10 +40 +15 = 65, both skins kept");
}

// ---------------------------------------------------------------- the server through server.js
async function serverTests() {
  const dir = tmpDir();
  let srv = await startServer({ ACCOUNTS_DIR: dir });
  try {
    check(/Accounts: on/.test(srv.log()), "server: accounts switched on by ACCOUNTS_DIR");
    let r = await call("GET", "/api/acct/ping");
    check(r.status === 200 && r.json && r.json.ok === true, "ping answers 200 when accounts are on");
    const prof1 = SYNC.sanitize({ tokens: 40, rating: 1111, name: "Spud", owned: { phoenix: [0, 1] } }, FIGHTERS);
    r = await post("new", { prof: prof1 });
    const code = r.json && r.json.code;
    check(r.status === 200 && /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/.test(code || "") && r.json.rev === 1, "new: a code like 7K3F-9QXM-2PMA-W8RT and revision 1");
    const files = fs.readdirSync(dir);
    const plain = SYNC.normCode(code);
    check(files.length === 1 && files[0] === crypto.createHash("sha256").update(plain).digest("hex") + ".json", "new: the file is named sha256(code).json");
    const mode = fs.statSync(path.join(dir, files[0])).mode & 0o777;
    check(mode === 0o600, "new: the file is private to the server user (mode 600)");
    check(!files.some((f) => fs.readFileSync(path.join(dir, f), "utf8").includes(plain)) && !files.some((f) => f.includes(plain)), "new: the folder never holds the code itself");
    r = await post("load", { code });
    check(r.status === 200 && r.json.rev === 1 && eq(r.json.prof, prof1), "load: gives the saved prof and revision");
    r = await post("load", { code: code.toLowerCase().replace(/-/g, "").replace(/0/g, "o") });
    check(r.status === 200, "load: lower case, no dashes and O for 0 still find it");
    const prof2 = SYNC.sanitize(Object.assign({}, prof1, { tokens: 70 }), FIGHTERS);
    r = await post("save", { code, rev: 1, prof: prof2 });
    check(r.status === 200 && r.json.rev === 2, "save: revision 1 -> 2");
    r = await post("load", { code });
    check(r.json.rev === 2 && r.json.prof.tokens === 70, "save: the new copy is stored");
    const stale = SYNC.sanitize(Object.assign({}, prof1, { tokens: 55 }), FIGHTERS);
    r = await post("save", { code, rev: 1, prof: stale });
    check(r.status === 409 && r.json.rev === 2 && r.json.prof.tokens === 70, "save: a stale revision gets 409 with the newer copy");
    const mergedProf = SYNC.mergeProf(stale, prof1, r.json.prof, false);
    r = await post("save", { code, rev: 2, prof: mergedProf });
    check(r.status === 200 && r.json.rev === 3 && mergedProf.tokens === 85, "save: merge (40 base, +30 elsewhere, +15 here = 85) and save again -> revision 3");
    r = await post("load", { code });
    check(r.json.prof.tokens === 85 && r.json.rev === 3, "load: shows the merged copy");
    r = await post("save", { code, rev: 99, prof: prof1 });
    check(r.status === 409, "save: a revision that is not the stored one is refused");
    // two saves at once on the same revision: exactly one wins
    const race = await Promise.all(Array.from({ length: 12 }, (_, i) => post("save", { code, rev: 3, prof: SYNC.sanitize({ tokens: 100 + i }, FIGHTERS) })));
    check(race.filter((x) => x.status === 200).length === 1 && race.filter((x) => x.status === 409).length === 11, "save: 12 saves at once on one revision -> one 200, eleven 409");
    check(!fs.readdirSync(dir).some((f) => /\.tmp$/.test(f)) && fs.readdirSync(dir).length === 1, "save: no temp files left behind");

    // wrong input
    r = await post("load", { code: "7K3F-9QXM" });
    check(r.status === 400, "bad code (wrong length) -> 400");
    r = await post("load", { code: 12345 });
    check(r.status === 400, "bad code (not a string) -> 400");
    r = await post("load", { code: "7K3F-9QXM-2PMA-W8RT" });
    check(r.status === 404 && r.json && r.json.error === "unknown" && r.ms >= 300, `unknown code -> 404 after a pause (${r.ms} ms)`);
    r = await post("save", { code: "7K3F-9QXM-2PMA-W8RT", rev: 1, prof: prof1 });
    check(r.status === 404, "save to an unknown code -> 404");
    const big = JSON.stringify({ prof: { pad: "x".repeat(20000) } });
    r = await call("POST", "/api/acct/new", undefined, undefined, big);
    check(r.status === 413, "body over 16 KB -> 413");
    r = await call("POST", "/api/acct/new", undefined, { "transfer-encoding": "chunked" }, big);
    check(r.status === 413, "body over 16 KB sent in chunks -> 413");
    r = await call("POST", "/api/acct/new", undefined, undefined, JSON.stringify({ prof: { pad: "x".repeat(15000) } }));
    check(r.status === 200, "a body just under the limit is fine");
    r = await post("new", { prof: [1, 2] });
    check(r.status === 400, "prof that is an array -> 400");
    r = await post("new", { prof: "text" });
    check(r.status === 400, "prof that is text -> 400");
    r = await post("new", { nothing: 1 });
    check(r.status === 400, "no prof -> 400");
    r = await post("save", { code, rev: "3", prof: prof1 });
    check(r.status === 400, "save with a revision that is not a number -> 400");
    r = await call("POST", "/api/acct/new", undefined, undefined, "{not json");
    check(r.status === 400, "invalid JSON -> 400");
    r = await call("POST", "/api/acct/new", undefined, undefined, "[1]");
    check(r.status === 400, "JSON that is not an object -> 400");
    r = await call("POST", "/api/acct/new", undefined, { "content-type": "text/plain" }, JSON.stringify({ prof: prof1 }));
    check(r.status === 415, "a body that is not declared JSON -> 415 (a web page of another site cannot post it)");
    r = await call("GET", "/api/acct/load");
    check(r.status === 405, "GET on a POST address -> 405");
    r = await call("GET", "/api/acct/nothing");
    check(r.status === 404, "an unknown address -> 404");
    let deep = {}; let cur = deep; for (let i = 0; i < 12; i++) { cur.a = {}; cur = cur.a; }
    r = await post("new", { prof: deep });
    check(r.status === 400, "a prof nested deeper than 6 levels -> 400");
    r = await call("GET", "/health");
    check(r.status === 200 && /ok/.test(r.text), "the game's own /health still answers");
  } finally { await stopServer(srv); }

  // the files survive a restart, and the count is picked up
  srv = await startServer({ ACCOUNTS_DIR: dir });
  try {
    check(/Accounts: on \(2 saved/.test(srv.log()), "restart: the saved accounts are found again");
  } finally { await stopServer(srv); }
  rmDir(dir);

  // limits through server.js: 10 new accounts an hour, 60 requests a minute, per address
  const dir2 = tmpDir();
  srv = await startServer({ ACCOUNTS_DIR: dir2 });
  try {
    let ok = 0, blocked = null;
    for (let i = 0; i < 12; i++) { const r = await post("new", { prof: { tokens: i } }); if (r.status === 200) ok++; else if (!blocked) blocked = r; }
    check(ok === 10 && blocked && blocked.status === 429 && !!blocked.headers["retry-after"], "limit: the 11th new account in an hour -> 429 with Retry-After");
    check(fs.readdirSync(dir2).length === 10, "limit: nothing was created by the refused requests");
    // 12 requests made so far (10 new + 2 refused); all count towards the 60 a minute
    let last = null, n = 0;
    for (let i = 0; i < 60; i++) { const r = await call("GET", "/api/acct/ping"); n++; if (r.status === 429) { last = r; break; } }
    check(last && n >= 45 && n <= 50, `limit: 60 requests a minute -> 429 after ${n} more pings`);
    r = await call("GET", "/api/acct/ping", undefined, { "x-forwarded-for": "203.0.113.7" });
    check(r.status === 200, "limit: behind the local proxy, another real address (X-Forwarded-For) has its own allowance");
    r = await call("GET", "/health");
    check(r.status === 200, "limit: the game itself is not limited");
  } finally { await stopServer(srv); }
  rmDir(dir2);

  // accounts off: no ACCOUNTS_DIR, a missing folder, a folder that is a file
  for (const [label, env] of [["no ACCOUNTS_DIR", {}], ["a folder that does not exist", { ACCOUNTS_DIR: path.join(os.tmpdir(), "pbacct-missing-" + process.pid) }], ["a path that is a file", { ACCOUNTS_DIR: __filename }]]) {
    srv = await startServer(env);
    try {
      let r = await call("GET", "/api/acct/ping");
      const a = r.status;
      r = await post("new", { prof: {} }); const b = r.status;
      r = await post("load", { code: "7K3F-9QXM-2PMA-W8RT" }); const c = r.status;
      r = await post("save", { code: "7K3F-9QXM-2PMA-W8RT", rev: 1, prof: {} }); const d = r.status;
      const h = await call("GET", "/health");
      check(a === 404 && b === 404 && c === 404 && d === 404 && h.status === 200 && /Accounts: off/.test(srv.log()), `off (${label}): every /api/acct/* answers 404, the game still runs`);
    } finally { await stopServer(srv); }
  }
}

// ---------------------------------------------------------------- the limits of accounts.js with small numbers, in this process
async function limitTests() {
  const dir = tmpDir();
  const acc = ACC.init(dir, { maxFiles: 3, maxBytes: 3000, perMin: 14, newPerHour: 50, unknownDelayMs: 10, bodyMs: 400 });
  const srv = http.createServer((rq, rs) => { if (!acc.handle(rq, rs, (rq.url || "").split("?")[0])) { rs.writeHead(404); rs.end(); } });
  await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));
  try {
    let r = await post("new", { prof: { n: 1 } });
    const code = r.json && r.json.code;
    check(r.status === 200, "caps: first account");
    await post("new", { prof: { n: 2 } });
    r = await post("new", { prof: { n: 3 } });
    check(r.status === 200 && acc.count() === 3, "caps: third account (the cap)");
    r = await post("new", { prof: { n: 4 } });
    check(r.status === 503 && acc.count() === 3, "caps: one more than the file cap -> 503");
    r = await post("save", { code, rev: 1, prof: { pad: "y".repeat(2900) } });
    check(r.status === 503 && acc.bytes() < 3000, "caps: a save that would pass the folder size cap -> 503");
    r = await post("save", { code, rev: 1, prof: { pad: "y".repeat(500) } });
    check(r.status === 200, "caps: a smaller save still works");
    // a body that never arrives
    const slow = await new Promise((resolve) => {
      const t0 = Date.now();
      const rq = http.request({ host: "127.0.0.1", port: PORT, method: "POST", path: "/api/acct/new", headers: { "content-type": "application/json", "content-length": "50" }, agent: false }, (res) => { res.resume(); resolve({ status: res.statusCode, ms: Date.now() - t0 }); });
      rq.on("error", () => resolve({ status: 0, ms: Date.now() - t0 }));
      rq.write('{"prof"');
    });
    check(slow.status === 408 && slow.ms < 3000, "caps: a body that stops arriving -> 408");
    // a damaged file reads as an unknown code, and never crashes the server
    fs.writeFileSync(path.join(dir, fs.readdirSync(dir).filter((f) => f.endsWith(".json"))[0]), "{broken");
    const lot = [];
    for (let i = 0; i < 6; i++) lot.push(await post("load", { code }));
    check(lot.some((x) => x.status === 404) || lot.some((x) => x.status === 200), "caps: a damaged file does not crash the server");
    // per-minute limit with 14 requests (some already used above)
    let got429 = false;
    for (let i = 0; i < 20 && !got429; i++) { const q = await call("GET", "/api/acct/ping"); if (q.status === 429) got429 = true; }
    check(got429, "caps: the per-minute limit applies");
  } finally { await new Promise((r) => srv.close(r)); }
  rmDir(dir);
}

(async () => {
  if (!fs.existsSync(path.join(ROOT, "public/index.html"))) { console.log("FAIL public/index.html is missing: run python3 game/build.py first"); process.exit(1); }
  pureTests();
  await serverTests();
  await limitTests();
  console.log(bad ? `acct FAILED: ${bad} check(s)` : "acct ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("FAIL " + (e && e.stack || e)); process.exit(1); });
