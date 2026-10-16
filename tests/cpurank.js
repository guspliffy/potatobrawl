// Ranked vs CPU on the server (cpurank.js through server.js): tickets, the replay check, the CPU rank, the Boards.
// Fake phones talk to a real server.js over WebSocket. A whole CPU match is played the way the page plays it (your inputs in the online
// encoding, the CPU's brain from the game's own random numbers) and the server's verdict must match the game.
// Run: node tests/cpurank.js   (prints "cpurank ok" at the end when every check passed)
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");
const { BL } = require("../game/core.js");
const Q = require("../quick.js");
const C = require("../cpurank.js");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.CPU_PORT || 8092;   // check.sh runs this alone, on Quick match's port
const PROTO = +/const PROTO = (\d+);/.exec(fs.readFileSync(path.join(ROOT, "game/ui/online.js"), "utf8"))[1];
let fails = 0, passes = 0;
function check(ok, what) { if (ok) { passes++; console.log("PASS " + what); } else { fails++; console.log("FAIL " + what); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = (n) => crypto.randomBytes(n).toString("hex").slice(0, n);

/* ----- the server ----- */
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
  const proc = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), KEEPALIVE_MINUTES: "0", CPU_T: JSON.stringify({ gap: 0 }) }, env), stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => { log += d; }); proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 60; i++) { const r = await call("GET", "/health"); if (r.status === 200) { await sleep(150); return { proc, log: () => log }; } await sleep(100); }
  proc.kill(); throw new Error("server did not start:\n" + log);
}
async function stopServer(s) { if (!s) return; s.proc.kill(); await new Promise((r) => s.proc.once("exit", r)); }
const hashOf = (code) => crypto.createHash("sha256").update(code.replace(/-/g, "")).digest("hex");
async function newAccount(name, prof) { const r = await call("POST", "/api/acct/new", { prof: Object.assign({ name, tokens: 5 }, prof) }, { "x-forwarded-for": "192.0.2." + (1 + Math.floor(Math.random() * 200)) }); return r.json.code; }
const fileOf = (dir, code) => path.join(dir, hashOf(code) + ".json");
const readRec = (dir, code) => JSON.parse(fs.readFileSync(fileOf(dir, code), "utf8"));
function edit(dir, code, fn) { const rec = readRec(dir, code); fn(rec); fs.writeFileSync(fileOf(dir, code), JSON.stringify(rec)); }

/* ----- a fake phone ----- */
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
    setTimeout(() => { const k = P.waiters.indexOf(w); if (k >= 0) { P.waiters.splice(k, 1); res(null); } }, ms || 4000);
  });
  P.open = () => new Promise((res) => {
    const go = () => { P.send({ t: "hello", peer: P.peer, by: P.by, name: P.name, k: P.k }); P.next((m) => m.t === "welcome", 3000).then(res); };
    if (P.ws.readyState === 1) go(); else P.ws.once("open", go);
  });
  P.ask = (m, t, ms) => { P.send(m); return P.next((x) => x.t === t || (t === "ct-ok" && x.t === "ct-no"), ms); };
  P.close = () => { try { P.ws.close(); } catch (e) { /* gone */ } };
  return P;
}
async function authed(name, code) {
  const p = phone(name);
  await p.open();
  if (code) { p.send({ t: "auth", code }); p.me = await p.next((m) => m.t === "me", 3000); }
  return p;
}

/* ----- a CPU match played the way the page plays it: your inputs quantized and logged, the CPU on the game's own random numbers ----- */
const ULTI_BASE = 2592;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function encIn(i) {
  const qx = clamp(Math.round(i.x * 4), -4, 4), qy = clamp(Math.round(i.y * 4), -4, 4), q = (qx + 4) * 9 + (qy + 4);
  const b4 = (i.jump ? 1 : 0) + (i.light ? 2 : 0) + (i.heavy ? 4 : 0) + (i.special ? 8 : 0);
  return i.ulti ? ULTI_BASE + q * 16 + b4 : q * 32 + b4 + (i.dodge ? 16 : 0);
}
const FIG = Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f]));
// you are a bot too, on its own random numbers (a person never touches the game's), at strength lv
function playCpu(tk, lv) {
  const players = tk.f.map((id, k) => ({ spec: FIG[id], pal: FIG[id].palettes[tk.p[k]] }));
  const g = BL.newGame({ players, stocks: 3, time: 240, countdown: 150, seed: tk.seed, map: tk.map });
  const me = BL.makeBot(lv, BL.BOT_STYLES[tk.f[0]]), cpu = BL.makeBot(tk.d, BL.BOT_STYLES[tk.f[1]]), mine = BL.rngOf(tk.seed ^ 77);
  const codes = [];
  while (g.phase !== "over" && g.phase !== "end" && codes.length < 15000) {
    const R = g.rng; g.rng = mine;
    const v = encIn(BL.botInput(g, g.fighters[0], g.fighters[1], me)); g.rng = R;
    codes.push(v);
    const ci = BL.botInput(g, g.fighters[1], g.fighters[0], cpu);
    BL.step(g, [Q.decIn(v), ci]); g.events.length = 0;
  }
  return { codes, winner: g.winner, res: g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5 };
}
// the packed log in n parts, as the page sends it
function sendLog(P, id, codes, n, ff) {
  const s = C.pack(codes), k = Math.max(1, n || 1), step = Math.ceil(s.length / 3 / k) * 3;
  for (let i = 0; i < k; i++) P.send({ t: "cr", id, k: i, n: k, s: s.slice(i * step, (i + 1) * step), ff: ff ? 1 : 0 });
}
const backdate = (dir, code) => edit(dir, code, (rec) => { rec.cpu.tk.t -= 10 * 60 * 1000; });   // as if the match had taken its time

(async () => {
  // ---- the pure parts ----
  const codes0 = [1280, 1280, 1280, 5, 5, 2600, ...new Array(130).fill(1280)];
  check(JSON.stringify(C.unpack(C.pack(codes0))) === JSON.stringify(codes0) && C.pack(codes0).length === 6 * 3, "the packed log: runs of three characters, back to the same codes");
  check(C.unpack("AA") === null && C.unpack("@@A") === null && C.unpack("____") === null, "a broken log doesn't unpack");
  check(C.strength(1000) === 0.25 && C.strength(1250) === 0.5 && Math.abs(C.strength(1650) - 0.9) < 1e-9 && C.strength(1730) === 0.98 && C.strength(2500) === 0.98 && C.strength(500) === 0.08, "the CPU's strength: Easy+ at 1000, Normal 1250, Hard 1650, full from 1730");
  check(C.boardName({ name: "Tuber Tom" }, 0) === "Tuber Tom" && C.boardName({ name: "sh1t lord" }, 0) === "Potato" && C.boardName({ name: "Tuber" }, 1) === "Potato" && C.boardName({}, 0) === "Potato", "board names: the account name, a word filter, a blanked name");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbcpu-"));
  let srv = await startServer({ ACCOUNTS_DIR: dir });
  let codeA, codeB, codeC;
  try {
    check(/Ranked vs CPU: on/.test(srv.log()), "the server says Ranked vs CPU is on");
    codeA = await newAccount("Ann");
    const nobody = await authed("Nobody", null);
    check((await nobody.ask({ t: "ct", v: PROTO, f: "odin", pi: 0 }, "ct-ok")).why === "acct", "no account: no ticket");
    check((await nobody.ask({ t: "cme" }, "cme")).err === "acct", "no account: cme says so");
    const bd0 = await nobody.ask({ t: "bd", k: "c" }, "bd");
    check(!!bd0 && bd0.n === 0 && bd0.me === null && Array.isArray(bd0.top), "the CPU board without an account: empty, no row of yours");
    nobody.close();

    const A = await authed("Ann", codeA);
    let me = await A.ask({ t: "cme" }, "cme");
    check(me && me.r === 1000 && me.n === 0 && me.pl === 0 && me.tk === "", "a fresh CPU record: Season 1 at 1000, not on the board");
    check((await A.ask({ t: "ct", v: PROTO - 1, f: "odin", pi: 0 }, "ct-ok")).why === "old", "an old page gets no ticket (reload)");
    check((await A.ask({ t: "ct", v: PROTO, f: "nope", pi: 0 }, "ct-ok")).why === "bad", "a fighter that doesn't exist: refused");

    // placement match 1: a Hard CPU counted as 1650, played to the end, the server's replay decides
    let tk = await A.ask({ t: "ct", v: PROTO, f: "samurai", pi: 1 }, "ct-ok");
    check(tk && tk.t === "ct-ok" && tk.pm === true && tk.cr === 1650 && tk.d === 0.9 && tk.f[0] === "samurai" && FIG[tk.f[1]] && tk.p[0] === 1, "placement: the ticket is a Hard CPU rated 1650");
    check(readRec(dir, codeA).cpu.tk.id === tk.id, "the ticket is kept in the account file");
    let m = playCpu(tk, 0.98);
    backdate(dir, codeA);
    sendLog(A, tk.id, m.codes, 3);
    let v = await A.next((x) => x.t === "cres", 8000);
    const exp1 = Math.max(900, 1000 + Q.elo(1000, 1650, m.res, 0)) - 1000;
    check(v && v.id === tk.id && v.res === m.res && v.why === "game" && v.dr === exp1 && v.r1 === 1000 + exp1 && v.n === 1, `a played match: the server's replay gives the game's result (${m.res}, ${exp1 >= 0 ? "+" : ""}${exp1}), sent in 3 parts`);
    check(!readRec(dir, codeA).cpu.tk, "the ticket is used up");

    // a log that is not the match: the server plays its own ticket with it and it never ends -> left
    tk = await A.ask({ t: "ct", v: PROTO, f: "odin", pi: 0 }, "ct-ok");
    backdate(dir, codeA);
    sendLog(A, tk.id, new Array(900).fill(1280), 1);
    v = await A.next((x) => x.t === "cres", 5000);
    check(v && v.res === 0 && v.why === "left", "a log that stops before the match ends counts as a loss");
    // a log of a won match, sent before it could have been played
    tk = await A.ask({ t: "ct", v: PROTO, f: "odin", pi: 0 }, "ct-ok");
    m = playCpu(tk, 0.98);
    sendLog(A, tk.id, m.codes, 1);
    v = await A.next((x) => x.t === "cres", 8000);
    check(v && v.res === 0 && v.why === "fast" && /faster than it can be played/.test(srv.log()), "a log that arrives faster than it can be played: a loss, logged");
    // a forfeit
    tk = await A.ask({ t: "ct", v: PROTO, f: "odin", pi: 0 }, "ct-ok");
    sendLog(A, tk.id, [1280, 1280], 1, true);
    v = await A.next((x) => x.t === "cres", 5000);
    check(v && v.res === 0 && v.why === "ff", "Pause > Forfeit: a loss");
    // a ticket with no result, then a new ticket: the old one counts as a loss
    const open = await A.ask({ t: "ct", v: PROTO, f: "odin", pi: 0 }, "ct-ok");
    tk = await A.ask({ t: "ct", v: PROTO, f: "wizard", pi: 0 }, "ct-ok");
    let cpu = readRec(dir, codeA).cpu;
    check(cpu.n === 5 && cpu.h[0].why === "gone" && cpu.tk.id === tk.id && tk.pm === false, "a match with no result counts as a loss when the next one is dealt");
    sendLog(A, open.id, [1280], 1);
    v = await A.next((x) => x.t === "cres" && x.id === open.id, 3000);
    check(v && v.res === null && v.why === "late", "a result for a ticket already counted: no result (late)");
    // placed: the 6th match is against a CPU rated around yours
    check(tk.cr >= cpu.r - 70 && tk.cr <= cpu.r + 70 && Math.abs(tk.d - C.strength(tk.cr)) < 1e-9, `after placement the CPU is rated yours ±70 (${cpu.r} -> CPU ${tk.cr})`);
    me = await A.ask({ t: "cme" }, "cme");
    check(me && me.n === 5 && me.pl === 1 && me.of === 1 && me.tk === tk.id, "placed after 5: #1 of 1 on the CPU board");
    // the game updated meanwhile: a ticket from another version gives no result
    edit(dir, codeA, (rec) => { rec.cpu.tk.v = PROTO - 1; rec.cpu.tk.t -= 600000; });
    sendLog(A, tk.id, playCpu(tk, 0.98).codes, 2);
    v = await A.next((x) => x.t === "cres", 8000);
    check(v && v.res === null && v.why === "void" && readRec(dir, codeA).cpu.n === 5, "a ticket from an older game version: no result, the rank unchanged");
    // the ceiling: above 1730 the CPU's rating stops following yours
    edit(dir, codeA, (rec) => { rec.cpu.r = 2050; rec.cpu.pk = 2050; });
    tk = await A.ask({ t: "ct", v: PROTO, f: "odin", pi: 0 }, "ct-ok");
    check(tk.cr === 1730 && tk.d === 0.98, "at 2050 the CPU is rated 1730 at full strength");
    const r0 = readRec(dir, codeA).cpu.r;
    sendLog(A, tk.id, [1280], 1, true);
    v = await A.next((x) => x.t === "cres", 5000);
    check(v && v.dr === Q.elo(r0, 1730, 0, 5), `a loss at 2050 against the 1730 CPU costs ${-v.dr}`);

    // a phone's save keeps the CPU record
    const rec = readRec(dir, codeA);
    const sv = await call("POST", "/api/acct/save", { code: codeA, rev: rec.rev, prof: Object.assign({}, rec.prof, { name: "Ann B" }) });
    check(sv.status === 200 && readRec(dir, codeA).cpu && readRec(dir, codeA).cpu.n === rec.cpu.n && readRec(dir, codeA).prof.name === "Ann B", "a phone's save replaces prof and keeps the CPU record");
    const bdA = await A.ask({ t: "bd", k: "c" }, "bd");
    check(bdA && bdA.top[0] && bdA.top[0].nm === "Ann B" && bdA.me && bdA.me.i === 1 && bdA.me.row.r === readRec(dir, codeA).cpu.r, "the board follows the account's writes (the new name, your place)");

    // more players, written straight into their files: the boards are built from the files when the server starts
    codeB = await newAccount("Bea"); codeC = await newAccount("fuck you");
    const Bp = await authed("Bea", codeB), Cp = await authed("Cid", codeC);
    Bp.close(); Cp.close(); A.close();
    await sleep(100);
    edit(dir, codeB, (r) => { r.prof.plate = "gold"; r.cpu = { s: 1, r: 1800, pk: 1800, w: 9, l: 1, d: 0, n: 10, h: [], fc: { phoenix: 7, odin: 3 }, rt: 5, tk: null }; r.on = Object.assign(r.on, { r: 1100, n: 6, w: 4, l: 2, h: [{ t: 1, f: "dragon" }] }); });
    edit(dir, codeC, (r) => { r.cpu = { s: 1, r: 1800, pk: 1800, w: 8, l: 2, d: 0, n: 10, h: [], fc: { wizard: 2 }, rt: 9, tk: { id: "abcdef123456", v: PROTO, seed: 5, map: 0, f: ["odin", "samurai"], p: [0, 0], cr: 1700, d: 0.95, pm: false, ni: 1, t: Date.now() - 25 * 3600e3 } }; });
  } finally { await stopServer(srv); }

  const sdir = fs.mkdtempSync(path.join(os.tmpdir(), "cpurank-stats-"));
  srv = await startServer({ ACCOUNTS_DIR: dir, STATS_DIR: sdir });
  try {
    await sleep(300);
    const cpuC = readRec(dir, codeC).cpu;
    check(!cpuC.tk && cpuC.n === 11 && cpuC.h[0].why === "gone" && cpuC.r < 1800, "a ticket older than a day counts as a loss when the server starts");
    const B = await authed("Bea", codeB);
    const bc = await B.ask({ t: "bd", k: "c" }, "bd");
    const rA = readRec(dir, codeA).cpu.r;
    check(bc && bc.n === 3 && bc.top[0].r === rA && bc.top[1].id === readRec(dir, codeB).on.id && bc.top[1].f === "phoenix" && bc.top[1].pl === "gold" && bc.top[1].w === 9, "the CPU board, built from the files: best first, most played fighter, the nameplate");
    check(bc.top[2].nm === "Potato" && bc.top[2].id === readRec(dir, codeC).on.id && bc.me.i === 2, "a name with a bad word shows as Potato; your own place");
    const bo = await B.ask({ t: "bd", k: "o" }, "bd");
    check(bo && bo.n === 1 && bo.top[0].r === 1100 && bo.top[0].f === "dragon" && bo.me.i === 1, "the online board: placed Quick match players");
    const A = await authed("Ann", codeA);
    const ao = await A.ask({ t: "bd", k: "o" }, "bd");
    check(ao && ao.me && ao.me.i === 0 && ao.me.pn === 0, "not placed online: your row says placing 0 of 5");
    // Jonny's stats page: the names on both boards, and hiding one (it shows as Potato, the page still shows what was written)
    const key = fs.readFileSync(path.join(sdir, "key"), "utf8").trim(), idB = readRec(dir, codeB).on.id;
    const sd = await call("POST", "/api/stats/data", { key });
    const nB = sd.json && Array.isArray(sd.json.board) && sd.json.board.find((x) => x.id === idB);
    check(sd.json.board.length === 3 && nB && nB.nm === "Bea" && nB.c === 2 && nB.o === 1 && !nB.nb, "stats page: the names on the boards with their places");
    const bad = await call("POST", "/api/stats/blank", { key: "0".repeat(32), id: idB });
    const hid = await call("POST", "/api/stats/blank", { key, id: idB, on: true });
    await sleep(100);
    const bc2 = await B.ask({ t: "bd", k: "c" }, "bd");
    const hB = hid.json && hid.json.board.find((x) => x.id === idB);
    check(bad.status === 404 && hid.status === 200 && hB && hB.nb === 1 && hB.nm === "Bea" && bc2.top[1].nm === "Potato" && readRec(dir, codeB).cpu.nb === 1, "stats page: Hide shows a name as Potato on the boards (a wrong key can't)");
    await call("POST", "/api/stats/blank", { key, id: idB, on: false });
    await sleep(100);
    check((await B.ask({ t: "bd", k: "c" }, "bd")).top[1].nm === "Bea", "stats page: Show puts the name back");
    A.close(); B.close();
  } finally { await stopServer(srv); fs.rmSync(sdir, { recursive: true, force: true }); }

  // ---- accounts off: no CPU rank ----
  srv = await startServer({ ACCOUNTS_DIR: "" });
  try {
    check(/Ranked vs CPU: off: needs accounts/.test(srv.log()), "accounts off: Ranked vs CPU is off");
    const A = await authed("Ann", null);
    check((await A.ask({ t: "cme" }, "cme")).err === "off" && (await A.ask({ t: "ct", v: PROTO, f: "odin", pi: 0 }, "ct-ok")).why === "acct", "accounts off: no record, no ticket");
    A.close();
  } finally { await stopServer(srv); }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${passes} passed, ${fails} failed`);
  if (!fails) console.log("cpurank ok");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
