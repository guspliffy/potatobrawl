// Pommes on the server (pommes.js through server.js) and its support tool (tools/pommes.js): the state, a buy and every refusal, the
// ledger, a phone's save keeping the wallet, grant / take back / move through the requests folder, a request made while the game is
// down (applied when it starts), the rate limit, accounts off; the second Potatalities and the Pommes skins; watched ads (off, paid, wait,
// max, a new day; the clock's part runs pommes.js in this process with a fake clock). Fake phones talk to a real server.js over WebSocket.
// Run: node tests/pommes.js   (prints "pommes ok" at the end when every check passed)
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.PM_PORT || 8093;   // check.sh runs this alone, on Quick match's port
let fails = 0, passes = 0;
function check(ok, what) { if (ok) { passes++; console.log("PASS " + what); } else { fails++; console.log("FAIL " + what); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = (n) => crypto.randomBytes(n).toString("hex").slice(0, n);

function call(method, p, body, headers) {
  return new Promise((resolve) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const h = Object.assign(data !== null ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}, headers);
    const rq = http.request({ host: "127.0.0.1", port: PORT, method, path: p, headers: h, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { const text = Buffer.concat(chunks).toString("utf8"); let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ } resolve({ status: res.statusCode, text, json }); });
    });
    rq.on("error", (e) => resolve({ status: 0, text: String(e), json: null }));
    if (data !== null) rq.write(data);
    rq.end();
  });
}
async function startServer(env) {
  const proc = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), KEEPALIVE_MINUTES: "0", PM_SPOOL_MS: "150" }, env), stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => { log += d; }); proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 60; i++) { const r = await call("GET", "/health"); if (r.status === 200) { await sleep(150); return { proc, log: () => log }; } await sleep(100); }
  proc.kill(); throw new Error("server did not start:\n" + log);
}
async function stopServer(s) { if (!s) return; s.proc.kill(); await new Promise((r) => s.proc.once("exit", r)); }
const hashOf = (code) => crypto.createHash("sha256").update(code.replace(/-/g, "")).digest("hex");
async function newAccount(name) { const r = await call("POST", "/api/acct/new", { prof: { name, tokens: 5 } }, { "x-forwarded-for": "192.0.2." + (1 + Math.floor(Math.random() * 200)) }); return r.json && r.json.code; }
const readRec = (dir, code) => JSON.parse(fs.readFileSync(path.join(dir, hashOf(code) + ".json"), "utf8"));
const fileOf = (code) => hashOf(code) + ".json";
const editPm = (dir, code, fn) => { const f = path.join(dir, fileOf(code)), rec = JSON.parse(fs.readFileSync(f, "utf8")); fn(rec.pm = rec.pm || { bal: 0, own: [], log: [] }); fs.writeFileSync(f, JSON.stringify(rec)); };
const utcDay = (t) => new Date(t).toISOString().slice(0, 10);
const tool = (dir, args, env) => spawnSync(process.execPath, [path.join(ROOT, "tools/pommes.js"), ...args], { env: Object.assign({}, process.env, { ACCOUNTS_DIR: dir }, env), encoding: "utf8" });

function phone(name) {
  const P = { name, peer: "p" + rid(20), by: "u_" + rid(20), k: rid(24), msgs: [], waiters: [] };
  P.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  P.ws.on("message", (b) => {
    let m; try { m = JSON.parse(b); } catch (e) { return; }
    const w = P.waiters.find((x) => x.pred(m));
    if (w) { P.waiters.splice(P.waiters.indexOf(w), 1); w.res(m); } else P.msgs.push(m);
  });
  P.send = (m) => { if (P.ws.readyState === 1) P.ws.send(JSON.stringify(m)); };
  P.next = (pred, ms) => new Promise((res) => {
    const i = P.msgs.findIndex(pred);
    if (i >= 0) { const m = P.msgs[i]; P.msgs.splice(0, i + 1); return res(m); }
    const w = { pred, res };
    P.waiters.push(w);
    setTimeout(() => { const k = P.waiters.indexOf(w); if (k >= 0) { P.waiters.splice(k, 1); res(null); } }, ms || 3000);
  });
  P.open = () => new Promise((res) => {
    const go = () => { P.send({ t: "hello", peer: P.peer, by: P.by, name: P.name, k: P.k }); P.next((m) => m.t === "welcome", 3000).then(res); };
    if (P.ws.readyState === 1) go(); else P.ws.once("open", go);
  });
  P.ask = (m, ms) => { P.send(m); return P.next((x) => typeof x.t === "string" && x.t.slice(0, 3) === "pm-", ms); };
  P.close = () => { try { P.ws.close(); } catch (e) { /* gone */ } };
  return P;
}
async function authed(name, code) {
  const p = phone(name);
  await p.open();
  if (code) { p.send({ t: "auth", code }); p.me = await p.next((m) => m.t === "me", 3000); }
  return p;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-pommes-"));
  let srv = null;
  try {
    srv = await startServer({ ACCOUNTS_DIR: dir });
    check(/Pommes: on/.test(srv.log()) && /ads: off/.test(srv.log()), "the server says Pommes are on (with accounts), ads off");
    const codeA = await newAccount("Ann"), codeB = await newAccount("Ben");
    check(!!codeA && !!codeB, "two accounts");

    // signed out
    const nobody = await authed("Nobody", null);
    const n0 = await nobody.ask({ t: "pm" });
    check(n0 && n0.t === "pm-no" && n0.why === "acct", "not signed in: pm-no acct");
    const n1 = await nobody.ask({ t: "pmb", item: "ko:reaper" });
    check(n1 && n1.t === "pm-no" && n1.why === "acct", "not signed in: a buy is refused (acct)");
    nobody.close();

    // the state, and a buy with nothing
    const A = await authed("Ann", codeA);
    check(A.me && !A.me.err, "Ann signs in with her code");
    const s0 = await A.ask({ t: "pm" });
    check(s0 && s0.t === "pm-st" && s0.bal === 0 && Array.isArray(s0.own) && s0.own.length === 0 && s0.buy === false && s0.price === 300, "pm-st: 0 Pommes, nothing owned, buy off, price 300");
    check(s0 && Array.isArray(s0.items) && s0.items.length === 0 && s0.ads === false && s0.adN === 0 && s0.adMax === 5, "pm-st: items [], ads off, adN 0, adMax 5");
    const a0 = await A.ask({ t: "pma" });
    check(a0 && a0.t === "pm-no" && a0.why === "ads" && a0.bal === 0, "PM_ADS unset: an ad is refused (ads)");
    const b0 = await A.ask({ t: "pmb", item: "ko:reaper" });
    check(b0 && b0.t === "pm-no" && b0.why === "short" && b0.bal === 0, "a buy with 0 Pommes: short");

    // grant through the tool
    let r = tool(dir, ["grant", codeA, "300", "Jonny's", "test"]);
    check(r.status === 0 && /Pommes now: 300/.test(r.stdout), "tools/pommes.js grant 300 is applied by the server (" + (r.stdout + r.stderr).trim().slice(0, 80) + ")");
    const s1 = await A.ask({ t: "pm" });
    check(s1 && s1.bal === 300, "pm-st after the grant: 300");

    // refusals that name a bad item
    const BAD = ["ko:nobody", "__proto__", "constructor", "toString", 5, null, "ko:", "ko:hasOwnProperty", "ko2:nobody", "sk3:dragon", "sk1:"];
    for (let i = 0; i < BAD.length; i++) {
      const item = BAD[i];
      if (i % 5 === 0) await sleep(2100);   // the rate limit's window (6 per 2 s)
      const x = await A.ask({ t: "pmb", item });
      check(x && x.t === "pm-no" && x.why === "bad", `item ${JSON.stringify(item)}: bad`);
    }
    await sleep(2100);   // the rate limit's window

    // the buy
    const b1 = await A.ask({ t: "pmb", item: "ko:reaper" });
    check(b1 && b1.t === "pm-ok" && b1.bal === 0 && b1.own.length === 1 && b1.own[0] === "reaper" && b1.item === "ko:reaper", "a buy: pm-ok, 0 left, owns the Reaper's page");
    let rec = readRec(dir, codeA);
    check(rec.pm && rec.pm.bal === 0 && rec.pm.own.join() === "ko:reaper" && rec.pm.log.length === 2, "the account file: pm {bal 0, own [ko:reaper], 2 changes}");
    check(rec.prof.tokens === 5, "the chips are untouched");
    const b2 = await A.ask({ t: "pmb", item: "ko:reaper" });
    check(b2 && b2.why === "own", "buying it again: own");
    const led = fs.readFileSync(path.join(dir, "pommes.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    check(led.length === 2 && led[0].d === 300 && led[1].d === -300 && led[1].it === "ko:reaper" && led[1].f === hashOf(codeA) && !JSON.stringify(led).includes(codeA.replace(/-/g, "")), "the ledger: +300 grant, -300 buy, named by the file's hash, never the code");

    // a phone's save keeps the wallet (and a prof can't carry one); an ad count written into the file (ads are off here)
    editPm(dir, codeA, (pm) => { pm.ad = { d: "2026-01-02", n: 3 }; });
    const ld = await call("POST", "/api/acct/load", { code: codeA });
    check(ld.status === 200 && ld.json && !("pm" in ld.json), "load doesn't send the wallet to the phone");
    const sv = await call("POST", "/api/acct/save", { code: codeA, rev: ld.json.rev, prof: Object.assign({}, ld.json.prof, { tokens: 9, pm: { bal: 99999, own: ["ko:dragon"] } }) });
    check(sv.status === 200, "a phone saves");
    rec = readRec(dir, codeA);
    check(rec.pm && rec.pm.bal === 0 && rec.pm.own.join() === "ko:reaper" && rec.prof.tokens === 9, "after the save: the wallet is the server's (0, ko:reaper), the profile the phone's");
    check(rec.pm.ad && rec.pm.ad.d === "2026-01-02" && rec.pm.ad.n === 3, "after the save: the ad count too");
    const s2 = await A.ask({ t: "pm" });
    check(s2 && s2.bal === 0 && s2.own.join() === "reaper", "pm-st after the save: still 0 and the Reaper's page (a prof's pm means nothing)");

    // take back (a refund) below 0: buys nothing
    r = tool(dir, ["grant", codeA, "-100", "refund"]);
    check(r.status === 0 && /Pommes now: -100/.test(r.stdout), "grant -100 takes Pommes back, the balance may go below 0");
    const b3 = await A.ask({ t: "pmb", item: "ko:dragon" });
    check(b3 && b3.why === "short" && b3.bal === -100, "below 0: short");
    const b4 = await A.ask({ t: "pmb", item: "ko2:dragon" });
    check(b4 && b4.why === "short" && b4.bal === -100, "a second Potatality below 0: short");
    rec = readRec(dir, codeA);
    check(rec.pm.ad && rec.pm.ad.d === "2026-01-02" && rec.pm.ad.n === 3, "a grant keeps the ad count");

    // move everything to a new code
    r = tool(dir, ["grant", codeA, "400"]);
    check(r.status === 0 && /Pommes now: 300/.test(r.stdout), "grant 400: 300");
    editPm(dir, codeB, (pm) => { pm.ad = { d: "2026-01-03", n: 2 }; });
    r = tool(dir, ["move", codeA, hashOf(codeB), "lost", "code"]);
    check(r.status === 0 && /Pommes now: 300/.test(r.stdout) && /ko:reaper/.test(r.stdout), "move by the old code to the new account's name: 300 and the page");
    const ra = readRec(dir, codeA), rb = readRec(dir, codeB);
    check(ra.pm.bal === 0 && ra.pm.own.length === 0 && rb.pm.bal === 300 && rb.pm.own.join() === "ko:reaper", "the old account is empty, the new one has it all");
    check(rb.pm.ad && rb.pm.ad.d === "2026-01-03" && rb.pm.ad.n === 2 && ra.pm.ad && ra.pm.ad.n === 3, "a move leaves both accounts' own ad counts");
    const Bn = await authed("Ben", codeB);
    const sb = await Bn.ask({ t: "pm" });
    check(sb && sb.bal === 300 && sb.own.join() === "reaper", "Ben's phone sees 300 and the Reaper's page");
    r = tool(dir, ["show", codeB]);
    check(r.status === 0 && /Pommes: 300/.test(r.stdout) && /move: lost code \(in\)/.test(r.stdout), "show prints the wallet and the ledger");

    // the tool's own refusals
    r = tool(dir, ["grant", codeA, "0"]);
    check(r.status === 1, "grant 0 is refused");
    r = tool(dir, ["grant", "AAAA-AAAA-AAAA-AAAA", "5"]);
    check(r.status === 1 && /no account/.test(r.stderr), "an unknown code is refused before anything is asked");
    r = tool(dir, ["move", codeB, codeB]);
    check(r.status === 1 && /two different accounts/.test(r.stderr), "a move to the same account is refused");

    // the second Potatality and the two Pommes skin lines
    await sleep(2100);   // the rate limit's window
    r = tool(dir, ["grant", codeB, "900"]);
    check(r.status === 0 && /Pommes now: 1200/.test(r.stdout), "grant 900: 1200");
    const k2 = await Bn.ask({ t: "pmb", item: "ko2:dragon" });
    check(k2 && k2.t === "pm-ok" && k2.item === "ko2:dragon" && k2.bal === 900 && k2.own.join() === "reaper" && k2.items.join() === "ko:reaper,ko2:dragon", "buying ko2:dragon: 900 left, own still only the ko: pages, items lists both");
    const k3 = await Bn.ask({ t: "pmb", item: "sk1:dragon" });
    check(k3 && k3.t === "pm-ok" && k3.bal === 600, "buying the line 1 skin sk1:dragon: 600 left");
    const k4 = await Bn.ask({ t: "pmb", item: "sk2:odin" });
    check(k4 && k4.t === "pm-ok" && k4.bal === 300 && k4.items.join() === "ko:reaper,ko2:dragon,sk1:dragon,sk2:odin" && k4.adMax === 5, "buying the line 2 skin sk2:odin: 300 left, items in buying order");
    const k5 = await Bn.ask({ t: "pmb", item: "sk1:dragon" });
    check(k5 && k5.why === "own", "buying sk1:dragon again: own");
    const sk = await Bn.ask({ t: "pm" });
    check(sk && sk.bal === 300 && sk.own.join() === "reaper" && sk.items.length === 4 && sk.ads === false && sk.adN === 0, "pm-st lists the 4 items, own only the reaper");
    check(readRec(dir, codeB).pm.ad.n === 2, "a buy keeps the ad count");

    // the rate limit: 6 answers per 2 seconds per connection
    await sleep(2100);
    for (let i = 0; i < 12; i++) Bn.send({ t: "pm" });
    await sleep(600);
    const got = Bn.msgs.filter((m) => m.t === "pm-st").length;
    check(got === 6, `12 asks at once: ${got} answers (6 wanted)`);
    A.close(); Bn.close();

    // a request made while the game is down waits and is applied when it starts
    await stopServer(srv); srv = null;
    r = tool(dir, ["grant", codeB, "5", "while down"], { PM_WAIT_MS: "400" });
    check(r.status === 2 && /hasn't picked the request up/.test(r.stdout), "the game is down: the tool says the request waits");
    srv = await startServer({ ACCOUNTS_DIR: dir, PM_ADS: "1" });
    await sleep(400);
    check(readRec(dir, codeB).pm.bal === 305, "the waiting request is applied once the game runs (305)");
    const left = fs.readdirSync(path.join(dir, "pommes-in"));
    check(left.length === 1 && /\.done$/.test(left[0]), "its answer is left as a .done file (nobody waited for it)");

    // watched ads (PM_ADS=1)
    check(/ads: on/.test(srv.log()), "PM_ADS=1: the server says ads on");
    const B2 = await authed("Ben", codeB);
    const sa = await B2.ask({ t: "pm" });
    check(sa && sa.ads === true && sa.adN === 0 && sa.adMax === 5, "pm-st: ads on, adN 0 (the stored count is of another day), adMax 5");
    const ad1 = await B2.ask({ t: "pma" });
    check(ad1 && ad1.t === "pm-ad" && ad1.bal === 315 && ad1.adN === 1 && ad1.adMax === 5 && ad1.own.join() === "reaper" && ad1.items.length === 4, "an ad pays 10: pm-ad, 315, adN 1");
    const led2 = fs.readFileSync(path.join(dir, "pommes.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l)), last = led2[led2.length - 1];
    check(last.w === "ad" && last.d === 10 && last.b === 315 && last.f === hashOf(codeB), "the ledger: +10, w ad");
    rec = readRec(dir, codeB);
    check(rec.pm.ad && rec.pm.ad.d === utcDay(Date.now()) && rec.pm.ad.n === 1 && rec.pm.bal === 315, "the account file: ad {today (UTC), 1}");
    const ad2 = await B2.ask({ t: "pma" });
    check(ad2 && ad2.t === "pm-no" && ad2.why === "wait" && ad2.in >= 29 && ad2.in <= 30 && ad2.bal === 315, `a second ad right away: wait, in ${ad2 && ad2.in} s`);
    const sa2 = await B2.ask({ t: "pm" });
    check(sa2 && sa2.adN === 1, "pm-st: adN 1");
    editPm(dir, codeB, (pm) => { pm.ad = { d: utcDay(Date.now()), n: 5 }; });
    const ad3 = await B2.ask({ t: "pma" });
    check(ad3 && ad3.why === "max", "5 ads paid today: max");
    editPm(dir, codeB, (pm) => { pm.ad = { d: utcDay(Date.now() - 86400000), n: 5 }; });
    await sleep(2100);   // the rate limit's window
    const sa3 = await B2.ask({ t: "pm" });
    check(sa3 && sa3.adN === 0, "5 ads yesterday: adN 0 today");
    B2.msgs.length = 0;
    await sleep(2100);   // the rate limit's window
    for (let i = 0; i < 12; i++) B2.send({ t: "pma" });
    await sleep(600);
    const gotA = B2.msgs.filter((m) => m.t === "pm-no").length;
    check(gotA === 6 && B2.msgs.every((m) => m.t !== "pm-no" || m.why === "wait"), `12 ads at once: ${gotA} answers, all wait (the rate limit counts pma)`);
    B2.close();
    await stopServer(srv); srv = null;

    // the ads' clock, in this process: a fake clock, a new peer per ask (so the rate limit stays out of it)
    {
      let clock = Date.UTC(2026, 9, 22, 12), np = 0;
      const got = [];
      const acc = require("../accounts.js").init(dir);
      const pmA = require("../pommes.js").init({ accounts: acc, seatOf: () => ({ file: fileOf(codeA), id: "ann" }), send: (peer, m) => got.push(m),
        log: { log() {}, warn() {} }, ads: true, now: () => clock, spoolMs: 60000 });
      const ask = (m) => { got.length = 0; pmA.handle("x" + (np++), m); return got[0]; };
      const bal0 = ask({ t: "pm" }).bal;
      const p1 = ask({ t: "pma" });
      clock += 10000;
      const pw = ask({ t: "pma" });
      check(p1 && p1.t === "pm-ad" && p1.adN === 1 && p1.bal === bal0 + 10 && pw && pw.why === "wait" && pw.in === 20, `fake clock: paid, then 10 s later wait in 20 (${pw && pw.in})`);
      clock += 20000;
      const ns = [];
      for (let i = 0; i < 4; i++) { const x = ask({ t: "pma" }); ns.push(x && x.t === "pm-ad" ? x.adN : x && x.why); clock += 30000; }
      check(ns.join() === "2,3,4,5", "ads exactly AD_GAP apart all pay: adN " + ns.join());
      const p6 = ask({ t: "pma" });
      check(p6 && p6.why === "max" && p6.bal === bal0 + 50, "the 6th ad of the day: max (50 paid)");
      clock += 86400000;
      const sNew = ask({ t: "pm" });
      const p7 = ask({ t: "pma" });
      check(sNew.adN === 0 && p7 && p7.t === "pm-ad" && p7.adN === 1 && p7.bal === bal0 + 60, "a new UTC day: adN 0, and an ad pays again");
      check(readRec(dir, codeA).pm.ad.d === utcDay(clock) && readRec(dir, codeA).pm.ad.n === 1, "the account file: the new day, 1");
      const cp = require("../pommes.js").cleanPm;
      check(!cp({ ad: { d: "2026-10-22", n: 6 } }).ad && !cp({ ad: { d: "22.10.2026", n: 1 } }).ad && !cp({ ad: 3 }).ad && cp({ ad: { d: "2026-10-22", n: 5 } }).ad.n === 5, "cleanPm drops a broken ad count");
    }

    // accounts off: no wallet
    srv = await startServer({ ACCOUNTS_DIR: "" });
    check(/Pommes: off: needs accounts/.test(srv.log()), "without accounts Pommes are off");
    const C = await authed("Cid", null);
    const c0 = await C.ask({ t: "pm" }, 800);
    check(c0 === null, "without accounts pm gets no answer");
    C.close();
  } catch (e) {
    fails++; console.log("FAIL the test threw: " + (e && e.stack));
  } finally {
    await stopServer(srv);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`${passes} passed, ${fails} failed`);
  if (!fails) console.log("pommes ok");
  process.exit(fails ? 1 : 0);
})();
