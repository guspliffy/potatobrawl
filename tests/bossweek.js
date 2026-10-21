// Boss Week on the server (bossweek.js through server.js): the week, tickets, the replay check of a new best, the board, the payout.
// Fake phones talk to a real server.js over WebSocket. Whole boss fights are played the way the page plays them (your inputs in the
// online encoding, the CPU partner's brain and the boss on the game's own random numbers) and the server's time must match the game's.
// Run: node tests/bossweek.js   (prints "bossweek ok" at the end when every check passed)
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
const W = require("../bossweek.js");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.BW_PORT || 8092;   // check.sh runs this alone, on Quick match's port
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
  const proc = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), KEEPALIVE_MINUTES: "0", BW_T: JSON.stringify({ gap: 0, minSpeed: 0 }) }, env), stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => { log += d; }); proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 60; i++) { const r = await call("GET", "/health"); if (r.status === 200) { await sleep(150); return { proc, log: () => log }; } await sleep(100); }
  proc.kill(); throw new Error("server did not start:\n" + log);
}
async function stopServer(s) { if (!s) return; s.proc.kill(); await new Promise((r) => s.proc.once("exit", r)); }
const hashOf = (code) => crypto.createHash("sha256").update(code.replace(/-/g, "")).digest("hex");
async function newAccount(name, prof) { const r = await call("POST", "/api/acct/new", { prof: Object.assign({ name, tokens: 5 }, prof) }, { "x-forwarded-for": "192.0.2." + (1 + Math.floor(Math.random() * 200)) }); return r.json && r.json.code; }
const fileOf = (dir, code) => path.join(dir, hashOf(code) + ".json");
const readRec = (dir, code) => JSON.parse(fs.readFileSync(fileOf(dir, code), "utf8"));

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
  P.ask = (m, t, ms) => { P.send(m); return P.next((x) => x.t === t || (t === "bw-tk" && x.t === "bw-no"), ms); };
  P.close = () => { try { P.ws.close(); } catch (e) { /* gone */ } };
  return P;
}
async function authed(name, code) {
  const p = phone(name);
  await p.open();
  if (code) { p.send({ t: "auth", code }); p.me = await p.next((m) => m.t === "me", 3000); }
  return p;
}

/* ----- a try played the way the page plays it: your inputs quantized and logged, the partner and the boss on the game's own numbers ----- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ULTI_BASE = 2592, SPRINT_BASE = ULTI_BASE + 81 * 18;
function encIn(i) {
  const qx = clamp(Math.round(i.x * 4), -4, 4), qy = clamp(Math.round(i.y * 4), -4, 4), q = (qx + 4) * 9 + (qy + 4);
  if (i.sprint && (qx === 4 || qx === -4)) return SPRINT_BASE + (qx > 0 ? 9 : 0) + qy + 4;
  const b4 = (i.jump ? 1 : 0) + (i.light ? 2 : 0) + (i.heavy ? 4 : 0) + (i.special ? 8 : 0);
  return i.ulti ? ULTI_BASE + q * 16 + b4 : q * 32 + b4 + (i.dodge ? 16 : 0);
}
const FIG = Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f]));
const BOSS = Object.fromEntries(BL.BOSSES.map((b) => [b.id, b]));
// you are a bot too, on its own random numbers (a person never touches the game's), at strength lv; stop: frames to play at most
function playTry(tk, lv, stop) {
  const me = FIG[tk.f], pf = FIG[tk.pf], boss = BOSS[tk.boss];
  const g = BL.newGame({ players: [{ spec: me, pal: me.palettes[tk.p] }, { spec: pf, pal: pf.palettes[tk.pp] }, { spec: boss, pal: boss.palettes[0] }],
    stocks: 3, time: 0, countdown: 150, map: tk.map, level: tk.lv, hpMul: tk.hp, seed: tk.seed });
  const pb = BL.makeBot(lv, BL.BOT_STYLES[tk.f]), mb = BL.makeBot(tk.d, BL.BOT_STYLES[tk.pf]), mine = BL.rngOf(tk.seed ^ 77), codes = [];
  let go = -1, ko = -1;
  while (g.phase !== "over" && g.phase !== "end" && codes.length < (stop || 18000)) {
    const R = g.rng; g.rng = mine; const v = encIn(BL.botInput(g, g.fighters[0], g.fighters[2], pb)); g.rng = R;
    codes.push(v);
    BL.step(g, [Q.decIn(v), BL.botInput(g, g.fighters[1], g.fighters[2], mb)]);
    for (const e of g.events) { if (e.type === "go") go = g.t; if (e.type === "lethal" && e.slot === 2 && ko < 0) ko = g.t; }
    g.events.length = 0;
  }
  return { codes, won: g.winner === g.fighters[0].team && ko >= 0, t: go >= 0 && ko >= 0 ? ko - go : -1, fl: g.fighters[0].falls };
}
// a won try for this ticket: the strong bot on a few of its own seeds until one wins
function winTry(tk) {
  for (let s = 0; s < 12; s++) { const r = playTry(Object.assign({}, tk, { seed: tk.seed }), 0.95 - s * 0.01); if (r.won) return r; }
  return null;
}
function sendLog(P, id, codes, fr, n) {
  const s = C.pack(codes), k = Math.max(1, n || 1), step = Math.ceil(s.length / 3 / k) * 3;
  for (let i = 0; i < k; i++) P.send({ t: "bwr", id, k: i, n: k, s: s.slice(i * step, (i + 1) * step), fr });
}
const res = (P) => P.next((m) => m.t === "bw-res", 8000);

(async () => {
  // ---- the pure parts ----
  const t0 = Date.UTC(2026, 9, 21, 10, 0);   // Wednesday 21 October 2026, 12:00 in Berlin
  const wk = W.weekOf(t0), sp = W.weekSpec(wk);
  check(W.weekOf(Date.UTC(2026, 0, 4, 22, 59)) === -1 && W.weekOf(Date.UTC(2026, 0, 4, 23, 0)) === 0, "week 0 starts on Monday 5 January 2026, 00:00 in Berlin (23:00 UTC the day before)");
  check(W.weekStart(wk) === Date.UTC(2026, 9, 18, 22, 0) && sp.ends === Date.UTC(2026, 9, 25, 23, 0), "this week: Monday 19 Oct 00:00 Berlin (summer time) to Monday 26 Oct 00:00 Berlin (winter time)");
  check(sp.no === 43 && W.isoWeek(0) === 2, "the week numbers on the calendar (19 Oct 2026 is week 43)");
  check(W.weekSpec(0).boss === "scratch" && W.weekSpec(1).boss === "zorp" && W.weekSpec(2).boss === "kraken" && W.weekSpec(3).boss === "scratch", "the boss turns Old Scratch, Zorp, Kraken Spud");
  check(sp.lv === 1 && FIG[sp.pf] && BOSS[sp.boss] && BL.MAPS[sp.map].id === BOSS[sp.boss].map, "Hard, a real partner fighter, the boss's own map");
  // the Road's numbers, read from the page (game/ui/road.js ROAD_REG)
  const road = fs.readFileSync(path.join(ROOT, "game/ui/road.js"), "utf8");
  const same = Object.entries(W.ROAD).every(([b, v]) => new RegExp(`boss: "${b}"[^}]*hp: ${v.hp}, mate: ${v.mate}\\b`).test(road));
  check(same, "the boss's HP and the partner's strength are the Road's (game/ui/road.js ROAD_REG)");
  check(W.prize(1) === 300 && W.prize(2) === 150 && W.prize(3) === 150 && W.prize(4) === 80 && W.prize(10) === 80 && W.prize(11) === 25, "prizes: 300, 150, 150, 80 to #10, then 25");
  // the replay plays the same fight as the phone
  const tk0 = { id: "aaaaaaaaaaaa", wk, seed: 4242, f: "samurai", p: 0, pp: 0, v: PROTO, t: 0 };
  const run0 = playTry(Object.assign({}, sp, tk0), 0.95);
  const rep0 = await new Promise((r) => W.replay(tk0, sp, run0.codes, r, console));
  check(rep0.over && rep0.won === run0.won && rep0.t === run0.t && rep0.fl === run0.fl, `the server's replay of a bot's try: same result and time (${run0.won ? (run0.t / 60).toFixed(2) + " s" : "lost"})`);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbbw-"));
  const NOW = String(t0);
  let srv = await startServer({ ACCOUNTS_DIR: dir, BW_NOW: NOW });
  let codeA, codeB;
  try {
    check(/Boss Week: on/.test(srv.log()), "the server says Boss Week is on");
    codeA = await newAccount("Ann"); codeB = await newAccount("Ben");
    const nobody = await authed("Nobody", null);
    check((await nobody.ask({ t: "bwt", v: PROTO, f: "odin", pi: 0 }, "bw-tk")).why === "acct", "no account: no ticket");
    let me = await nobody.ask({ t: "bwme" }, "bw-me");
    check(me && me.wk === wk && me.boss === sp.boss && me.pf === sp.pf && me.ends === sp.ends && me.n === 0 && me.me === null, "no account: this week's boss, partner and end, no record");
    const bd0 = await nobody.ask({ t: "bd", k: "w" }, "bd");
    check(bd0 && bd0.k === "w" && bd0.n === 0 && bd0.me === null && bd0.boss === sp.boss, "the Boss Week board without an account: empty, no row of yours");
    nobody.close();

    const A = await authed("Ann", codeA), Bn = await authed("Ben", codeB);
    me = await A.ask({ t: "bwme" }, "bw-me");
    check(me && me.me && me.me.t === 0 && me.me.tries === 0 && me.lr === null, "a fresh record: no time, no tries");
    check((await A.ask({ t: "bwt", v: PROTO - 1, f: "odin", pi: 0 }, "bw-tk")).why === "old", "an old page gets no ticket (reload)");
    check((await A.ask({ t: "bwt", v: PROTO, f: "nobody", pi: 0 }, "bw-tk")).why === "bad", "an unknown fighter gets no ticket");

    // a win: checked by the server, a new best, #1
    let tk = await A.ask({ t: "bwt", v: PROTO, f: "samurai", pi: 0 }, "bw-tk");
    check(tk && tk.t === "bw-tk" && tk.boss === sp.boss && tk.pf === sp.pf && tk.hp === sp.hp && tk.d === sp.d && tk.lv === 1, "a ticket: this week's boss on Hard, the Road's HP, the week's partner");
    const runA = winTry(tk);
    check(!!runA, "the bot wins a try (to send)");
    sendLog(A, tk.id, runA.codes, runA.t, 3);
    let v = await res(A);
    check(v && v.ok && v.why === "best" && v.time === runA.t && v.fl === runA.fl && v.pl1 === 1 && v.n === 1, `the server's copy: a new best, #1 of 1 (${v && (v.time / 60).toFixed(2)} s)`);
    let rec = readRec(dir, codeA);
    check(rec.bw && rec.bw.w === wk && rec.bw.b && rec.bw.b.t === runA.t && rec.bw.b.lg === C.pack(runA.codes) && rec.bw.tk.length === 0, "the best run and its log are in the account file; the ticket is used up");
    sendLog(A, tk.id, runA.codes, runA.t);
    check((await res(A)).why === "late", "the same ticket twice: late");

    // a claimed time that doesn't beat the best: not replayed
    tk = await A.ask({ t: "bwt", v: PROTO, f: "samurai", pi: 0 }, "bw-tk");
    const slow = playTry(tk, 0.5, 300);
    sendLog(A, tk.id, slow.codes, runA.t + 60);
    v = await res(A);
    check(v && !v.ok && v.why === "claim" && v.b0 === runA.t, "a time that doesn't beat your best isn't played again (claim)");
    // a log that isn't a win: not counted, even when the phone says it beat the best
    tk = await A.ask({ t: "bwt", v: PROTO, f: "samurai", pi: 0 }, "bw-tk");
    sendLog(A, tk.id, playTry(tk, 0.5, 600).codes, 60);
    v = await res(A);
    check(v && !v.ok && v.why === "nowin", "a log that stops before the KO: not counted (nowin)");
    rec = readRec(dir, codeA);
    check(rec.bw.b.t === runA.t, "the best stays");

    // Ben: second, then the board
    tk = await Bn.ask({ t: "bwt", v: PROTO, f: "odin", pi: 1 }, "bw-tk");
    check(tk.f === "odin" && tk.p === 1 && (tk.pf !== "odin" || tk.pp !== 1), "the partner never wears your skin");
    const runB = winTry(tk);
    sendLog(Bn, tk.id, runB.codes, runB.t, 2);
    v = await res(Bn);
    check(v && v.ok && v.why === "best" && v.n === 2, "Ben's win counts too");
    const bd = await A.ask({ t: "bd", k: "w" }, "bd");
    const order = [runA, runB].map((r, i) => ({ t: r.t, fl: r.fl, i })).sort((a, b) => a.t - b.t || a.fl - b.fl || a.i - b.i);
    check(bd && bd.n === 2 && bd.top.length === 2 && bd.top[0].t === order[0].t && bd.top[1].t === order[1].t && bd.top.every((r) => r.nm && FIG[r.f] && r.t > 0), "the board: two times, the faster first, names and fighters");
    check(bd.me && bd.me.i === (order[0].i === 0 ? 1 : 2) && bd.me.row.nm === "Ann", "your own row on the board");
    // replays: every top row and yours carry the run's id and version, and GET /api/run/<id> gives the run to watch
    const runIdA = readRec(dir, codeA).bw.b.id;
    check(bd.top.every((r) => /^[0-9a-f]{12}$/.test(r.r) && r.v === PROTO) && bd.me.row.r === runIdA && bd.fin === false, "the board's rows carry their runs (id and game version)");
    me = await A.ask({ t: "bwme" }, "bw-me");
    check(me.me && me.me.r === runIdA && me.me.v === PROTO, "your record carries your best run's id");
    let g = await call("GET", "/api/run/" + runIdA);
    const J = g.json;
    check(g.status === 200 && J && J.id === runIdA && J.t === runA.t && J.fl === runA.fl && J.boss === sp.boss && J.pf === sp.pf && J.wk === wk && J.nm === "Ann" && J.place >= 1 && J.n === 2 && J.fin === false && J.lg === C.pack(runA.codes), "GET /api/run/<id>: the run, its week, the name and place, the log");
    let rp = null; W.replay(J, Object.assign(W.weekSpec(J.wk), { hp: J.hp, d: J.d, lv: J.lv, map: J.map, pf: J.pf, boss: J.boss }), C.unpack(J.lg, W.MAX_FRAMES), (o) => { rp = o; }, console);
    for (let i = 0; i < 100 && !rp; i++) await sleep(20);
    check(rp && rp.won && rp.t === J.t, "the run from GET /api/run plays the same fight again (what the page's viewer does)");
    check((await call("GET", "/api/run/" + "0".repeat(12))).status === 404 && (await call("GET", "/api/run/nothex")).status === 404 && (await call("POST", "/api/run/" + runIdA, {})).status === 405, "an unknown run: 404; GET only");
    let lim = 0;
    for (let i = 0; i < 62; i++) lim = (await call("GET", "/api/run/" + runIdA, undefined, { "x-forwarded-for": "198.51.100.7" })).status;
    check(lim === 429 && (await call("GET", "/api/run/" + runIdA, undefined, { "x-forwarded-for": "198.51.100.8" })).status === 200, "60 runs a minute per address (429 past that), another address still gets one");
    // a phone's save keeps the server's part
    const loadA = await call("POST", "/api/acct/load", { code: codeA });
    const save = await call("POST", "/api/acct/save", { code: codeA, rev: loadA.json.rev, prof: Object.assign({}, loadA.json.prof, { tokens: 7 }) });
    check(save.status === 200 && readRec(dir, codeA).bw.b.t === runA.t, "a phone's save keeps the Boss Week record");
    await sleep(300);   // the save reaches the board (accounts.js watch)
    me = await A.ask({ t: "bwme" }, "bw-me");
    const bd2 = await A.ask({ t: "bd", k: "w" }, "bd");
    check(me.me && me.me.t === runA.t && me.me.pl === bd.me.i && bd2.me && bd2.me.i === bd.me.i && bd2.me.row && bd2.me.row.t === runA.t, "after a save that changes nothing on the board, your place and your row stay");
    A.close(); Bn.close();
    await stopServer(srv);

    // ---- next week: paid once, on start ----
    const t1 = String(W.weekStart(wk + 1) + 3600e3);
    srv = await startServer({ ACCOUNTS_DIR: dir, BW_NOW: t1 });
    await sleep(400);
    const ra = readRec(dir, codeA), rb = readRec(dir, codeB);
    const [first, second] = order[0].i === 0 ? [ra, rb] : [rb, ra];
    check(first.prof.tokens === (first === ra ? 7 : 5) + 300 && second.prof.tokens === (second === ra ? 7 : 5) + 150, "the finished week is paid: #1 300 chips, #2 150");
    check(first.bw.pw === wk && first.bw.cr === 1 && first.bw.lr.pl === 1 && first.bw.lr.of === 2 && second.bw.lr.pl === 2 && second.bw.cr === 0, "paid mark, crown and the result card in the account file");
    const wf = path.join(dir, "weeks", wk + ".json");
    const x = fs.existsSync(wf) ? JSON.parse(fs.readFileSync(wf, "utf8")) : null;
    check(x && x.n === 2 && x.top.length === 2 && x.top[0].run && typeof x.top[0].run.lg === "string" && x.boss === sp.boss, "the week file: its ranking and the top runs with their logs");
    const A2 = await authed("Ann", codeA);
    // last week's board (its week file) and its runs, still watchable
    const lw = await A2.ask({ t: "bd", k: "w", wk }, "bd");
    check(lw && lw.wk === wk && lw.fin === true && lw.n === 2 && lw.top.length === 2 && lw.top[0].t === order[0].t && lw.top.every((r) => /^[0-9a-f]{12}$/.test(r.r)) && lw.me && lw.me.i === (order[0].i === 0 ? 1 : 2) && lw.me.row.nm === "Ann", "last week's board: final, its top runs and your place");
    const tw = await A2.ask({ t: "bd", k: "w" }, "bd");
    check(tw && tw.wk === wk + 1 && tw.n === 0 && tw.fin === false, "this week's board is a new one");
    g = await call("GET", "/api/run/" + runIdA);
    check(g.status === 200 && g.json.fin === true && g.json.wk === wk && g.json.t === runA.t && g.json.place === (order[0].i === 0 ? 1 : 2) && g.json.lg === C.pack(runA.codes), "last week's run is served from the week file (fin)");
    const old = await A2.ask({ t: "bd", k: "w", wk: wk - 9 }, "bd");
    check(old && old.wk === wk - 9 && old.fin === true && old.n === 0 && old.top.length === 0, "a week older than the kept four: an empty finished board");
    me = await A2.ask({ t: "bwme" }, "bw-me");
    check(me && me.wk === wk + 1 && me.boss === W.weekSpec(wk + 1).boss && me.n === 0 && me.lr && me.lr.wk === wk && me.lr.c === (first === ra ? 300 : 150), "a new week: the next boss, an empty board, last week's prize card");
    tk = await A2.ask({ t: "bwt", v: PROTO, f: "samurai", pi: 0 }, "bw-tk");
    check(tk && tk.t === "bw-tk" && tk.wk === wk + 1, "a ticket for the new week");
    A2.close();
    await stopServer(srv);
    srv = await startServer({ ACCOUNTS_DIR: dir, BW_NOW: t1 });
    await sleep(400);
    check(readRec(dir, codeA).prof.tokens === ra.prof.tokens && readRec(dir, codeB).prof.tokens === rb.prof.tokens, "a restart never pays the week twice");
  } catch (e) { check(false, "the test ran: " + e.stack); }
  await stopServer(srv);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${passes} passed, ${fails} failed`);
  if (!fails) console.log("bossweek ok");
  process.exit(fails ? 1 : 0);
})();
