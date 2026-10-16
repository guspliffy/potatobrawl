// Play counts: the server side (stats.js), in this process with small limits and a test clock, then through server.js on port
// 8097 with a temporary STATS_DIR (on, off, a folder it can't use, the shutdown write, a restart). Node only, about 10 seconds.
// Prints PASS/FAIL lines and "stats ok" at the end. Needs `python3 game/build.py` to have run (server.js serves public/).
// Usage: node tests/stats.js
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const STATS = require(path.join(ROOT, "stats.js"));
const PORT = +process.env.STATS_PORT || 8097;   // check.sh gives every server its own port
let bad = 0;
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pbstats-"));
const rmDir = (d) => fs.rmSync(d, { recursive: true, force: true });

function call(port, method, p, body, headers) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const data = body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body);
    const h = Object.assign(data !== null ? { "content-length": Buffer.byteLength(data), "content-type": "application/json" } : {}, headers);
    const rq = http.request({ host: "127.0.0.1", port, method, path: p, headers: h, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
        resolve({ status: res.statusCode, json, text, ms: Date.now() - t0, headers: res.headers });
      });
    });
    rq.on("error", (e) => resolve({ status: 0, json: null, text: String(e.message), ms: Date.now() - t0, headers: {} }));
    if (data !== null) rq.write(data);
    rq.end();
  });
}

// ---------------------------------------------------------------- in this process: the module with small limits and a test clock
async function inProcess() {
  const dir = tmpDir();
  let clock = Date.parse("2026-10-15T10:00:00Z"), online = 0;
  const S = STATS.init(dir, { now: () => clock, online: () => online, hitsPerMin: 6, dataPerMin: 50, maxErrs: 3, flushMs: 60, sampleMs: 40, badKeyDelayMs: 300 });
  check(!!S, "on with a writable folder");
  const key = fs.readFileSync(path.join(dir, "key"), "utf8").trim();
  check(/^[0-9a-f]{32}$/.test(key) && (fs.statSync(path.join(dir, "key")).mode & 0o777) === 0o600, "a 32-hex page key, mode 600");
  const srv = http.createServer((req, res) => { if (!S.handle(req, res, req.url.split("?")[0])) { res.writeHead(404); res.end(); } });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  const hit = (body, h) => call(port, "POST", "/api/stats/hit", body, h);
  const data = (body) => call(port, "POST", "/api/stats/data", body);

  let r = await hit({ e: ["day", "day:new", "wk", "mo", "dev:phone", "app:web", "lang:de", "ver:12", "ms:practice", "me:practice:win", "fp:reaper",
    "ret:2026-10-14:1", "ret:2026-10-17:1", "ret:2026-02-30:3", "ret:2026-10-14:2", "tut:move", "fx:tut:charge", "fx:match:online-boss",
    "bs:scratch:2", "rw:23", "scr:road", "bogus", "day:", "ms:Ranked", "me:x:won", 5, null, { a: 1 }, "x".repeat(200)] }, { "content-type": "text/plain;charset=UTF-8" });
  check(r.status === 204, `a hit sent as text/plain (sendBeacon) answers 204 (got ${r.status})`);
  r = await data({ key });
  const c = r.json && r.json.days && r.json.days["2026-10-15"];
  check(r.status === 200 && r.json.today === "2026-10-15" && r.json.tz === "Europe/Berlin", "the page data names today in Europe/Berlin");
  check(!!c && c.day === 1 && c["ret:2026-10-14:1"] === 1 && c["fx:tut:charge"] === 1 && c["fx:match:online-boss"] === 1 && c["bs:scratch:2"] === 1 && c["rw:23"] === 1, "known keys are counted");
  check(!!c && !("bogus" in c) && !("ms:Ranked" in c) && !("me:x:won" in c) && !("ret:2026-10-17:1" in c) && !("ret:2026-02-30:3" in c) && !("ret:2026-10-14:2" in c) && Object.keys(c).length === 18,
    `unknown keys, bad dates, dates after tomorrow and non-strings are ignored (${c ? Object.keys(c).length : 0} keys)`);
  r = await hit({ e: ["err:TypeError: a is undefined @12", "err:one", "err:two", "err:three", "err:four", "err:<b>\"x\"</b>", "err:" + "y".repeat(81)] });
  r = await data({ key });
  const e = Object.keys(r.json.days["2026-10-15"]).filter((k) => k.startsWith("err:")).sort();
  check(e.join("|") === "err:TypeError: a is undefined @12|err:one|err:other|err:two", `errors: three messages a day, then err:other; quotes and 81+ characters refused (${e.join("|")})`);
  r = await hit({ e: Array(41).fill("day") });
  check(r.status === 400, "41 keys in one hit: 400");
  r = await hit("{\"e\": [\"day\", " + "\"day\", ".repeat(800) + "\"day\"]}");
  check(r.status === 413, "a body over 4 KB: 413");
  r = await hit({ e: ["day"] }, { "content-type": "application/x-www-form-urlencoded" });
  check(r.status === 415, "a form post: 415");
  r = await hit("not json");
  check(r.status === 400, "not JSON: 400");
  r = await call(port, "GET", "/api/stats/hit");
  check(r.status === 405, "GET on the hit address: 405");
  // the rate limit: 6 hits a minute per IP in this test; the hits above used 5 (the form post was refused before counting)
  const r6 = await hit({ e: ["bogus"] }), r7 = await hit({ e: ["bogus"] });
  check(r6.status === 204 && r7.status === 429 && r7.headers["retry-after"] === "60", `the 7th hit in a minute: 429 (got ${r6.status}, ${r7.status})`);
  // the page key
  r = await data({ key: "0".repeat(32) });
  check(r.status === 404 && r.ms >= 280, `a wrong key: 404 after a pause (${r.ms} ms)`);
  r = await data({});
  check(r.status === 404, "no key: 404");
  // peak: the most players online, a maximum
  online = 3; await sleep(120); online = 1; await sleep(120);
  r = await data({ key });
  check(r.json.days["2026-10-15"].peak === 3 && r.json.online === 1, `peak keeps the most players online at once (${r.json.days["2026-10-15"].peak}), online is now`);
  // written to its day file within the flush time
  await sleep(150);
  const f15 = JSON.parse(fs.readFileSync(path.join(dir, "2026-10-15.json"), "utf8"));
  check(f15.day === 1 && f15.peak === 3 && (fs.statSync(path.join(dir, "2026-10-15.json")).mode & 0o777) === 0o600, "the day file is written (mode 600)");
  // the next day starts a new file; the old one stays in the page data
  clock = Date.parse("2026-10-15T22:30:00Z");   // 00:30 on the 16th in Berlin
  await sleep(120);
  online = 2; await sleep(100);
  r = await data({ key });
  check(r.json.today === "2026-10-16" && r.json.days["2026-10-15"].day === 1 && r.json.days["2026-10-16"].peak === 2 && !("day" in r.json.days["2026-10-16"]),
    "midnight in Berlin starts the next day's file");
  // from: only days in range
  fs.writeFileSync(path.join(dir, "2026-06-01.json"), JSON.stringify({ day: 9 }));
  r = await data({ key });
  check(!("2026-06-01" in r.json.days), "by default the page gets the last 120 days");
  r = await data({ key, from: "2026-05-01" });
  check(r.json.days["2026-06-01"] && r.json.days["2026-06-01"].day === 9, "from: older days on request");
  S.stop();
  srv.close();
  rmDir(dir);
  check(STATS.init(path.join(os.tmpdir(), "pbstats-missing-" + process.pid)) === null && STATS.init("") === null, "off without a folder");
  const ro = tmpDir(); fs.chmodSync(ro, 0o500);
  const roOff = process.getuid && process.getuid() === 0 ? true : STATS.init(ro) === null;   // root can write anyway
  check(roOff, "off when the folder can't be written");
  fs.chmodSync(ro, 0o700); rmDir(ro);
}

// ---------------------------------------------------------------- through server.js
function startServer(env) {
  const e = Object.assign({}, process.env, { PORT: String(PORT), KEEPALIVE_MINUTES: "0" }, env);
  if (!env.STATS_DIR) delete e.STATS_DIR;
  const proc = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: e, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => { log += d; }); proc.stderr.on("data", (d) => { log += d; });
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < 50; i++) {
      const r = await call(PORT, "GET", "/health");
      if (r.status === 200) return resolve({ proc, log: () => log });
      if (proc.exitCode !== null) return reject(new Error("server.js exited: " + log));
      await sleep(100);
    }
    reject(new Error("server.js did not start: " + log));
  });
}
const stopServer = (s, sig) => new Promise((resolve) => { if (s.proc.exitCode !== null) return resolve(s.proc.exitCode); s.proc.once("exit", (code) => resolve(code)); s.proc.kill(sig || "SIGTERM"); });

async function viaServer() {
  let s = await startServer({});
  let r = await call(PORT, "POST", "/api/stats/hit", { e: ["day"] });
  check(r.status === 202 && /Play counts: off/.test(s.log()), "without STATS_DIR the counter is off and /api/stats/hit is 202 (the game stops sending, no console error)");
  r = await call(PORT, "GET", "/stats");
  check(r.status === 404, "without STATS_DIR /stats is 404");
  await stopServer(s);

  const dir = tmpDir();
  s = await startServer({ STATS_DIR: dir });
  check(/Play counts: on/.test(s.log()), "STATS_DIR turns it on");
  const key = fs.readFileSync(path.join(dir, "key"), "utf8").trim();
  r = await call(PORT, "GET", "/stats");
  const pageThere = fs.existsSync(path.join(ROOT, "public", "stats.html"));
  check(pageThere ? r.status === 200 && /text\/html/.test(r.headers["content-type"]) && /default-src 'none'/.test(r.headers["content-security-policy"] || "") && /noindex/.test(r.headers["x-robots-tag"] || "") && r.headers["referrer-policy"] === "no-referrer"
    : r.status === 404, `/stats serves the page with a strict content policy, noindex, no referrer (${r.status})`);
  r = await call(PORT, "POST", "/api/stats/hit", { e: ["day", "day:new", "ms:ranked"] });
  check(r.status === 204, "a hit through server.js");
  const code = await stopServer(s, "SIGTERM");
  const today = STATS.dayIn("Europe/Berlin", Date.now()), file = path.join(dir, today + ".json");
  check(code === 0 && fs.existsSync(file) && JSON.parse(fs.readFileSync(file, "utf8")).day === 1, `a restart (SIGTERM) writes the day before it stops (exit ${code})`);
  s = await startServer({ STATS_DIR: dir });
  await call(PORT, "POST", "/api/stats/hit", { e: ["day"] });
  r = await call(PORT, "POST", "/api/stats/data", { key });
  check(r.status === 200 && r.json.days[today].day === 2 && r.json.days[today]["ms:ranked"] === 1, "after the restart the day goes on counting (2)");
  check(fs.readFileSync(path.join(dir, "key"), "utf8").trim() === key, "the key stays the same across restarts");
  r = await call(PORT, "GET", "/");
  check(r.status === 200 && /PotatoBrawl/.test(r.text), "the game page is still served");
  await stopServer(s);
  rmDir(dir);
}

(async () => {
  try { await inProcess(); await viaServer(); }
  catch (e) { check(false, "crashed: " + (e && e.stack || e)); }
  console.log(bad ? `stats FAILED (${bad})` : "stats ok");
  process.exit(bad ? 1 : 0);
})();
