// Cups on the server (tourney.js through server.js): the Daily Cup's day, lobby, roll call and seeding, a cup of 4 with a CPU, a match
// between two players refereed by Quick match, a match against a CPU checked from its log, walkovers, forfeits, places and prizes paid
// once (also after a restart), Friends Cups (host, join by code, start), a restart in the middle of a cup, the update's drain, a stuck cup.
// Fake phones talk to a real server.js over WebSocket; the server's clock is moved to just before 20:00 Berlin (TC_NOW).
// Run: node tests/tourney.js   (prints "tourney ok" at the end when every check passed)
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
const TC = require("../tourney.js");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.TC_PORT || 8092;   // check.sh runs this alone, on Quick match's port
const PROTO = +/const PROTO = (\d+);/.exec(fs.readFileSync(path.join(ROOT, "game/ui/online.js"), "utf8"))[1];
const QFAST = { tick: 100, range: [[0.6, 200], [1.2, 400]], fallback: 1.2, noStart: 1500, quiet: 1500, keep: 3000, waitMsg: 400, offer: 1500, rematch: 8000 };
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
  const proc = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), KEEPALIVE_MINUTES: "0", QM_T: JSON.stringify(QFAST) }, env), stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => { log += d; }); proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 60; i++) { const r = await call("GET", "/health"); if (r.status === 200) return { proc, log: () => log }; await sleep(100); }
  proc.kill(); throw new Error("server did not start:\n" + log);
}
async function stopServer(s) { if (!s) return; s.proc.kill(); await new Promise((r) => s.proc.once("exit", r)); }
const hashOf = (code) => crypto.createHash("sha256").update(code.replace(/-/g, "")).digest("hex");
async function newAccount(name) { const r = await call("POST", "/api/acct/new", { prof: { name, tokens: 5 } }, { "x-forwarded-for": "192.0.2." + (1 + Math.floor(Math.random() * 200)) }); return r.json.code; }
const fileOf = (dir, code) => path.join(dir, hashOf(code) + ".json");
const readRec = (dir, code) => JSON.parse(fs.readFileSync(fileOf(dir, code), "utf8"));
function setR(dir, code, r) { const rec = readRec(dir, code); rec.on.r = r; rec.on.pk = Math.max(rec.on.pk, r); fs.writeFileSync(fileOf(dir, code), JSON.stringify(rec)); }

/* ----- a fake phone (a waited-for message is taken out; the others stay queued) ----- */
function phone(name, opts) {
  const o = opts || {};
  const P = { name, peer: "p" + rid(20), by: o.by || "u_" + rid(20), k: rid(24), msgs: [], waiters: [] };
  P.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  P.ws.on("message", (b) => {
    let m; try { m = JSON.parse(b); } catch (e) { return; }
    const w = P.waiters.find((x) => x.pred(m));
    if (w) { P.waiters.splice(P.waiters.indexOf(w), 1); w.res(m); } else P.msgs.push(m);
  });
  P.send = (m) => { if (P.ws.readyState === 1) P.ws.send(JSON.stringify(m)); };
  P.next = (pred, ms) => new Promise((res) => {
    const i = P.msgs.findIndex(pred);
    if (i >= 0) { const m = P.msgs[i]; P.msgs.splice(i, 1); return res(m); }
    const w = { pred, res };
    P.waiters.push(w);
    setTimeout(() => { const k = P.waiters.indexOf(w); if (k >= 0) { P.waiters.splice(k, 1); res(null); } }, ms || 4000);
  });
  // the newest tc that matches (older ones are dropped)
  P.tc = async (pred, ms) => {
    const end = Date.now() + (ms || 4000);
    for (;;) {
      const i = P.msgs.map((m) => m.t === "tc" && pred(m)).lastIndexOf(true);
      if (i >= 0) { const m = P.msgs[i]; P.msgs = P.msgs.filter((x, k) => !(x.t === "tc" && k <= i)); return m; }
      const left = end - Date.now();
      if (left <= 0) return null;
      const m = await P.next((x) => x.t === "tc" && pred(x), left);
      if (m) return m;
    }
  };
  P.open = () => new Promise((res) => {
    const go = () => { P.send({ t: "hello", peer: P.peer, by: P.by, name: P.name, k: P.k }); P.next((m) => m.t === "welcome", 3000).then(res); };
    if (P.ws.readyState === 1) go(); else P.ws.once("open", go);
  });
  P.close = () => { try { P.ws.close(); } catch (e) { /* gone */ } };
  return P;
}
async function authed(name, code, opts) {
  const p = phone(name, opts);
  await p.open();
  if (code) { p.code = code; p.send({ t: "auth", code }); p.me = await p.next((m) => m.t === "me", 3000); }
  p.send({ t: "tc?" });
  p.first = await p.next((m) => m.t === "tc", 3000);
  return p;
}

/* ----- the page's input coding; a CPU match and a match between two phones, played by bots ----- */
const ULTI_BASE = 2592, NEUTRAL = 1280, B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function encIn(i) {
  const qx = clamp(Math.round(i.x * 4), -4, 4), qy = clamp(Math.round(i.y * 4), -4, 4), q = (qx + 4) * 9 + (qy + 4);
  if (i.sprint && (qx === 4 || qx === -4)) return ULTI_BASE + 81 * 18 + (qx > 0 ? 9 : 0) + qy + 4;
  const b4 = (i.jump ? 1 : 0) + (i.light ? 2 : 0) + (i.heavy ? 4 : 0) + (i.special ? 8 : 0);
  return i.ulti ? ULTI_BASE + q * 16 + b4 : q * 32 + b4 + (i.dodge ? 16 : 0);
}
const pack2 = (arr, from, to) => { let s = ""; for (let f = from; f < to; f++) s += B64[arr[f] >> 6] + B64[arr[f] & 63]; return s; };
const FIG = Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f]));
// you against the ticket's CPU, a bot on its own random numbers (as cpurank's test)
function playCpu(tk, lv) {
  const players = tk.f.map((id, k) => ({ spec: FIG[id], pal: FIG[id].palettes[tk.p[k]] }));
  const g = BL.newGame({ players, stocks: 3, time: 240, countdown: 150, seed: tk.seed, map: tk.map });
  const me = BL.makeBot(lv, BL.BOT_STYLES[tk.f[0]]), cpu = BL.makeBot(tk.d, BL.BOT_STYLES[tk.f[1]]), mine = BL.rngOf(tk.seed ^ 77);
  const codes = [];
  while (g.phase !== "over" && g.phase !== "end" && codes.length < 17400) {
    const R = g.rng; g.rng = mine;
    const v = encIn(BL.botInput(g, g.fighters[0], g.fighters[1], me)); g.rng = R;
    codes.push(v);
    BL.step(g, [Q.decIn(v), BL.botInput(g, g.fighters[1], g.fighters[0], cpu)]); g.events.length = 0;
  }
  return { codes, winner: g.winner };
}
function sendLog(P, id, codes, ff) {
  const s = C.pack(codes), n = Math.max(1, Math.ceil(s.length / 6000));
  for (let k = 0; k < n; k++) P.send({ t: "tcr", id, k, n, s: s.slice(k * 6000, (k + 1) * 6000), ff: ff ? 1 : 0 });
}
// both phones got qm-found {tm}: into the room, the host starts the assigned match, two bots play it (inputs in the presence, as the page)
async function playRoom(a, b) {
  const fa = await a.next((m) => m.t === "qm-found", 5000), fb = await b.next((m) => m.t === "qm-found", 5000);
  if (!fa || !fb) return null;
  const [H, G] = fa.role === "host" ? [a, b] : [b, a];
  H.found = fa.role === "host" ? fa : fb; G.found = fa.role === "host" ? fb : fa;
  for (const p of [H, G]) { p.send({ t: "join", room: p.found.room }); await p.next((m) => m.t === "peers" && m.room === p.found.room, 2000); }
  G.send({ t: "presence", room: G.found.room, p: { role: "guest" } });
  const st = { id: 1, seed: H.found.seed, d: 4, f: H.found.f, p: H.found.p, rtt: 40, r: H.found.r, set: { n: 1, w: [0, 0] } };
  H.send({ t: "presence", room: H.found.room, p: { role: "host", start: st } });
  const players = st.f.map((id, i) => ({ spec: FIG[id], pal: FIG[id].palettes[st.p[i]] }));
  const g = BL.newGame({ players, stocks: st.r.l, time: st.r.t * 60, countdown: 150, seed: st.seed, map: st.seed % BL.POOL });
  const bots = [BL.makeBot(0.9, BL.BOT_STYLES[st.f[0]]), BL.makeBot(0.4, BL.BOT_STYLES[st.f[1]])];
  const logs = [new Array(st.d).fill(NEUTRAL), new Array(st.d).fill(NEUTRAL)], sent = [0, 0], phones = [H, G];
  let frame = 0;
  await sleep(30);
  const flush = async (all) => {
    for (let i = 0; i < 2; i++) {
      const to = logs[i].length;
      if (!all && to - sent[i] < 60) continue;
      const from = Math.max(0, sent[i] - 2);
      phones[i].send({ t: "presence", room: phones[i].found.room, p: { m: 1, s: from, i: pack2(logs[i], from, to), fr: frame } });
      sent[i] = to;
    }
    await sleep(14);
  };
  while (g.phase !== "over" && frame < 60 * 60 * 5) {
    for (let i = 0; i < 2; i++) logs[i].push(encIn(BL.botInput(g, g.fighters[i], g.fighters[1 - i], bots[i])));
    BL.step(g, [Q.decIn(logs[0][frame]), Q.decIn(logs[1][frame])]);
    g.events.length = 0;
    frame++;
    if (logs[0].length % 60 === 0) await flush(false);
  }
  await flush(true);
  return { g, H, G };
}

(async () => {
  // ---- the pure parts ----
  check(TC.startOf("2026-07-15", { h: 20, m: 0 }) === Date.UTC(2026, 6, 15, 18, 0) && TC.startOf("2026-12-02", { h: 20, m: 0 }) === Date.UTC(2026, 11, 2, 19, 0),
    "20:00 Berlin: 18:00 UTC in summer, 19:00 UTC in winter");
  check(TC.startOf("2026-03-29", { h: 20, m: 0 }) === Date.UTC(2026, 2, 29, 18, 0) && TC.startOf("2026-10-25", { h: 20, m: 0 }) === Date.UTC(2026, 9, 25, 19, 0),
    "...also on the days the clocks change");
  check(TC.berlin(Date.UTC(2026, 6, 15, 22, 30)).day === "2026-07-16" && TC.berlin(Date.UTC(2026, 11, 31, 22, 59)).day === "2026-12-31", "the Berlin day starts at midnight Berlin");
  const tc0 = TC.cleanTc({ w: -1, fw: 2, pd: ["d20260715", "x", 5, "fABCDI", "f22222"], lc: 5 });
  check(tc0.w === 0 && tc0.fw === 2 && tc0.pd.join() === "d20260715,f22222" && tc0.lc === null, "the account's cup record is cleaned");
  check(TC.PRIZE[8].join() === "120,60,30,10" && TC.PRIZE[4].join() === "60,30,10" && TC.ORDER[8].join() === "1,8,4,5,2,7,3,6", "prizes and seeding order");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbtc-"));
  const AT = TC.startOf("2026-07-15", { h: 20, m: 0 });
  const T1 = { tick: 100, roll: 1500, call: 2500, cpu: 60000, minSpeed: 0, host: 0, keep: 120000 };
  const env1 = { ACCOUNTS_DIR: dir, TC_T: JSON.stringify(T1) };
  // the accounts first (the cup's clock starts with the server)
  let srv = await startServer(Object.assign({ TC_NOW: String(AT - 60000) }, env1));
  const codes = {};
  for (const n of ["Ann", "Bob", "Cid", "Dee", "Eve", "Hal", "Jo", "Kim"]) codes[n] = await newAccount(n);
  {
    const ps = [];
    for (const n of ["Ann", "Bob", "Cid", "Dee"]) ps.push(await authed(n, codes[n]));   // the online records (auth makes them)
    for (const p of ps) p.close();
  }
  setR(dir, codes.Ann, 1400); setR(dir, codes.Bob, 1200); setR(dir, codes.Cid, 1000); setR(dir, codes.Dee, 900);
  await stopServer(srv);
  srv = await startServer(Object.assign({ TC_NOW: String(AT - 9000) }, env1));
  try {
    check(/Cups: on/.test(srv.log()), "the server starts the cups");
    // ---- the day: the lobby is open 30 min before 20:00; I'm in tonight counts ----
    const A = await authed("Ann", codes.Ann), B = await authed("Bob", codes.Bob), Cc = await authed("Cid", codes.Cid), D = await authed("Dee", codes.Dee);
    check(A.first && A.first.day.at === AT && A.first.day.st === "open" && A.first.day.day === "2026-07-15" && A.first.cup === null, "tc: today's Daily Cup at 20:00 Berlin, its lobby open, no cup yet");
    const anon = await authed("Nobody", null);
    check(anon.first && anon.first.day.at === AT && anon.first.cup === null, "a page without an account sees the day too");
    anon.send({ t: "tcj", v: PROTO, k: "d", f: "samurai", pi: 0 });
    check(!!(await anon.next((m) => m.t === "tc-no" && m.why === "acct")), "joining needs an account");
    anon.close();
    A.send({ t: "tci", on: 1 });
    let v = await B.tc((m) => m.day.n === 1);
    check(!!v && v.day.me === 0, "I'm in tonight: every watching page sees the count");
    v = await A.tc((m) => m.day.n === 1);
    check(!!v && v.day.me === 1, "...and your own page shows you're in");
    A.send({ t: "tcj", v: PROTO - 1, k: "d", f: "samurai", pi: 0 });
    check(!!(await A.next((m) => m.t === "tc-no" && m.why === "old")), "an older page can't join (old: reload)");
    A.send({ t: "tcj", v: PROTO, k: "d", f: "nobody", pi: 0 });
    check(!!(await A.next((m) => m.t === "tc-no" && m.why === "bad")), "an unknown fighter is refused");
    A.send({ t: "tcj", v: PROTO, k: "d", f: "samurai", pi: 0 });
    B.send({ t: "tcj", v: PROTO, k: "d", f: "wizard", pi: 1 });
    Cc.send({ t: "tcj", v: PROTO, k: "d", f: "odin", pi: 0 });
    D.send({ t: "tcj", v: PROTO, k: "d", f: "reaper", pi: 0 });
    v = await A.tc((m) => m.cup && m.cup.ent && m.cup.ent.length === 4);
    check(!!v && v.cup.st === "open" && v.cup.ent.filter((e) => e.me).length === 1 && v.day.in === 1 && v.day.ent === 4, "the lobby lists the four who joined");
    const E2 = await authed("Eve", codes.Eve, { by: A.by });   // another account on Ann's browser
    E2.send({ t: "tcj", v: PROTO, k: "d", f: "samurai", pi: 0 });
    check(!!(await E2.next((m) => m.t === "tc-no" && m.why === "busy")), "one seat per browser");
    E2.close();
    D.send({ t: "bye" }); D.close();   // Dee's page is gone before 20:00
    // ---- 20:00: the roll call, then the seeding: a cup of 4 for three players, a CPU in the bottom seed ----
    v = await A.tc((m) => m.cup && m.cup.st === "run", 15000);
    check(!!v && v.cup.size === 4 && v.cup.slots.length === 4 && v.day.st === "run", "the roll call seeds whoever is there: a cup of 4");
    const sl = v ? v.cup.slots : [];
    check(sl.length === 4 && sl[0].n === "Ann" && sl[0].sd === 1 && sl[1].c === 1 && sl[1].sd === 4 && sl[2].n === "Bob" && sl[3].n === "Cid" && !sl.some((s) => s.n === "Dee"),
      "seeds by online rating (Ann 1, Bob 2, Cid 3), the CPU takes seed 4, Dee (gone) is dropped");
    check(sl[1] && sl[1].d >= 0.5 && sl[1].d <= 0.9 && sl[1].r >= 1250 && sl[1].r <= 1650 && Number.isInteger(sl[1].ni), "the CPU plays between Normal and Hard, at the cup's rating, with a name");
    check(v && v.cup.mi === 0 && sl[0].me === 1 && v.cup.p.length === 3 && v.cup.p[0].join() === "0,1,2,3", "the bracket: your seat, the rounds");
    const cupId = v ? v.cup.id : "";
    check(cupId === "d20260715", "the Daily Cup's id is its day");
    // ---- the call-ups: Ann against the CPU, Bob against Cid ----
    const ca = await A.next((m) => m.t === "tc-call", 3000), cb = await B.next((m) => m.t === "tc-call", 3000), cc = await Cc.next((m) => m.t === "tc-call", 3000);
    check(ca && ca.cpu === 1 && ca.opp.c === 1 && ca.key === "0:0" && ca.ms === 2500, "Ann is called to her semi-final against the CPU");
    check(cb && cc && cb.cpu === 0 && cb.opp.n === "Cid" && cc.opp.n === "Bob" && cb.key === "0:1", "Bob and Cid are called to theirs");
    // Ann: FIGHT -> the ticket; the match is played on the phone and checked from its log
    A.send({ t: "tcgo" });
    const tk = await A.next((m) => m.t === "tc-tk", 3000);
    check(tk && tk.key === "0:0" && tk.tk.f[0] === "samurai" && tk.tk.f[1] === sl[1].f && tk.tk.d === sl[1].d && /^[0-9a-f]{12}$/.test(tk.tk.id), "FIGHT against a CPU: the ticket (you are f[0], the CPU at its strength)");
    // Bob and Cid: FIGHT -> a Quick match room for the two of them
    B.send({ t: "tcgo" }); Cc.send({ t: "tcgo" });
    const pc = await playRoom(B, Cc);
    check(!!pc && pc.H.found.tm && pc.H.found.tm.id === cupId && pc.H.found.tm.key === "0:1" && pc.H.found.ranked === false && pc.H.found.room.slice(0, 2) === "qm", "FIGHT for two players: qm-found with the cup match (tm), a Quick match room");
    const resB = await B.next((m) => m.t === "tc-res" && m.key === "0:1", 6000), resC = await Cc.next((m) => m.t === "tc-res" && m.key === "0:1", 6000);
    const gw = pc ? pc.g.winner : -9, bobHost = pc && pc.H === B;
    const bobWins = gw < 0 ? true : (gw === 0) === bobHost;   // a draw: the higher seed (Bob) goes on
    check(resB && resC && resB.res === (bobWins ? 1 : 0) && resC.res === (bobWins ? 0 : 1) && resB.why === (gw < 0 ? "draw" : "game"), `the referee's verdict decides the semi-final (winner ${gw}, Bob ${bobWins ? "on" : "out"})`);
    check(readRec(dir, codes.Bob).on.r === 1200 && readRec(dir, codes.Cid).on.r === 1000, "a cup match doesn't move the online rating");
    check(gw < 0 || (readRec(dir, codes.Bob).on.rv.length === 1 && resB.rv && resB.rv.id === Cc.me.id), "...it counts in the rival record");
    // Ann's CPU match: her log, the server's replay, the same result
    const pa = playCpu(tk.tk, 0.95);
    sendLog(A, tk.tk.id, pa.codes);
    const resA = await A.next((m) => m.t === "tc-res" && m.key === "0:0", 6000);
    const annWins = pa.winner !== 1;   // (a draw: Ann is the higher seed)
    check(resA && resA.res === (annWins ? 1 : 0) && resA.why === (pa.winner < 0 ? "draw" : "game"), `the CPU match is checked from Ann's log (winner ${pa.winner}, ${pa.codes.length} frames)`);
    // ---- the final ----
    const fin = [annWins ? A : null, bobWins ? B : Cc].filter(Boolean);
    const calls = [];
    for (const p of fin) calls.push(await p.next((m) => m.t === "tc-call" && m.key === "1:0", 4000));
    check(calls.every((x) => x && x.r === 1), `the final is called (${fin.map((p) => p.name).join(" vs ") + (fin.length < 2 ? " vs the CPU" : "")})`);
    let champ = null;
    if (fin.length === 2) {
      for (const p of fin) p.send({ t: "tcgo" });
      const pf = await playRoom(fin[0], fin[1]);
      const w = pf.g.winner;
      champ = w < 0 ? A : (w === 0) === (pf.H === fin[0]) ? fin[0] : fin[1];   // (a draw: Ann, seed 1)
    } else {
      const P = fin[0];
      P.send({ t: "tcgo" });
      const t2 = await P.next((m) => m.t === "tc-tk", 3000);
      const pl = playCpu(t2.tk, 0.95);
      sendLog(P, t2.tk.id, pl.codes);
      champ = pl.winner === 0 || (pl.winner < 0 && P === A) ? P : null;
    }
    const ends = {};
    for (const p of [A, B, Cc]) ends[p.name] = await p.next((m) => m.t === "tc-end", 8000);
    check(Object.values(ends).every((e) => e && e.id === cupId && e.of === 3 && e.k === "d"), "the cup is over: every player hears it");
    const runner = fin.length === 2 ? fin.find((p) => p !== champ) : champ ? null : fin[0];
    const semiOut = [A, B, Cc].filter((p) => !fin.includes(p));
    const want = (p) => (p === champ ? [1, 60] : p === runner ? [2, 30] : semiOut.includes(p) ? [3, 10] : [0, 0]);
    check([A, B, Cc].every((p) => ends[p.name].pl === want(p)[0] && ends[p.name].c === want(p)[1]),
      `places and prizes: champion 60, final 30, semi-final 10 (${[A, B, Cc].map((p) => `${p.name} #${ends[p.name] && ends[p.name].pl} +${ends[p.name] && ends[p.name].c}`).join(", ")})`);
    check([A, B, Cc].every((p) => readRec(dir, p.code).prof.tokens === 5 + want(p)[1]), "the chips are in the account files");
    check([A, B, Cc].every((p) => { const t = readRec(dir, p.code).tc; return t && t.pd[0] === cupId && t.lc.pl === want(p)[0] && t.w === (p === champ ? 1 : 0); }), "each account file marks the cup paid, its place and the cups won");
    check(champ ? ends.Ann.ch === champ.name : ends.Ann.ch === "" && ends.Ann.chc >= 0, `the champion's name goes to everyone (${champ ? champ.name : "the CPU"})`);
    v = await A.tc((m) => m.cup && m.cup.st === "done");
    check(!!v && v.cup.ch >= 0 && v.cup.pl && v.cup.pl.pl === want(A)[0] && (champ ? v.day.ch && v.day.ch.n === champ.name : true), "the bracket shows the end; the day shows the champion");
    // a phone's save keeps the cup record; a restart pays nothing twice
    let ld = await call("POST", "/api/acct/load", { code: codes.Bob });
    await call("POST", "/api/acct/save", { code: codes.Bob, rev: ld.json.rev, prof: Object.assign({}, ld.json.prof, { name: "Bob" }) });
    check(readRec(dir, codes.Bob).tc && readRec(dir, codes.Bob).tc.pd[0] === cupId, "a phone's save keeps the cup record");
    for (const p of [A, B, Cc]) p.close();
    await stopServer(srv);
    srv = await startServer(Object.assign({ TC_NOW: String(AT + 60000) }, env1));
    await sleep(400);
    check([A, B, Cc].every((p) => readRec(dir, p.code).prof.tokens === 5 + want(p)[1]), "after a restart the cup is not paid again");
    const A2 = await authed("Ann", codes.Ann);
    check(A2.first && A2.first.cup && A2.first.cup.id === cupId && A2.first.cup.st === "done", "after a restart the finished cup is still on its players' screens");
    A2.close();

    // ---- a Friends Cup: host, join by code, start; a walkover, a forfeit, CPUs play the final ----
    const H = await authed("Hal", codes.Hal), J = await authed("Jo", codes.Jo), K = await authed("Kim", codes.Kim);
    H.send({ t: "tcn", v: PROTO, f: "phoenix", pi: 0 });
    v = await H.tc((m) => m.cup && m.cup.k === "f");
    const code = v ? v.cup.code : "";
    check(!!v && /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/.test(code) && v.cup.host === 1 && v.cup.st === "open" && v.cup.ent.length === 1, "host a Friends Cup: its code, you are the host");
    J.send({ t: "tcj", v: PROTO, k: "ZZZZZ", f: "samurai", pi: 0 });
    check(!!(await J.next((m) => m.t === "tc-no" && m.why === "nocup")), "an unknown code is refused");
    J.send({ t: "tcj", v: PROTO, k: code, f: "samurai", pi: 0 });
    K.send({ t: "tcj", v: PROTO, k: code, f: "dragon", pi: 0 });
    v = await H.tc((m) => m.cup && m.cup.ent && m.cup.ent.length === 3);
    check(!!v, "two friends join by the code");
    K.send({ t: "tcl" });
    v = await H.tc((m) => m.cup && m.cup.ent && m.cup.ent.length === 2);
    check(!!v && !v.cup.ent.some((e) => e.n === "Kim"), "a friend leaves the lobby");
    J.send({ t: "tcs" });
    check(!!(await J.next((m) => m.t === "tc-no" && m.why === "host")), "only the host starts the cup");
    K.send({ t: "tcn", v: PROTO, f: "dragon", pi: 0 });
    v = await K.tc((m) => m.cup && m.cup.k === "f" && m.cup.host === 1);
    K.send({ t: "tcs" });
    check(!!(await K.next((m) => m.t === "tc-no" && m.why === "few")), "a cup needs two players");
    K.send({ t: "tcl" });
    v = await K.tc((m) => m.cup && m.cup.st === "off" && m.cup.why === "host");
    check(!!v, "the host's leave closes the Friends Cup");
    H.send({ t: "tcs" });
    v = await J.tc((m) => m.cup && m.cup.st === "run");
    check(!!v && v.cup.size === 4 && v.cup.slots.filter((s) => s.c).length === 2, "the host starts it: a cup of 4 with two CPUs");
    const hc = await H.next((m) => m.t === "tc-call", 3000), jc = await J.next((m) => m.t === "tc-call", 3000);
    check(hc && jc && hc.cpu === 1 && jc.cpu === 1, "both are called against a CPU");
    // Hal never taps FIGHT: the CPU walks over; Jo taps, then forfeits
    J.send({ t: "tcgo" });
    const jt = await J.next((m) => m.t === "tc-tk", 3000);
    sendLog(J, jt.tk.id, [], true);
    const rj = await J.next((m) => m.t === "tc-res", 3000);
    check(rj && rj.res === 0 && rj.why === "ff", "a forfeit against the CPU: out");
    const rh = await H.next((m) => m.t === "tc-res", 5000);
    check(rh && rh.res === 0 && rh.why === "wo", "no FIGHT within the call: the CPU walks over");
    const eh = await H.next((m) => m.t === "tc-end", 4000), ej = await J.next((m) => m.t === "tc-end", 4000);
    check(eh && ej && eh.k === "f" && eh.c === 0 && ej.c === 0 && eh.ch === "" && eh.chc >= 0, "CPUs play the final at once; a Friends Cup pays no chips");
    check(readRec(dir, codes.Hal).prof.tokens === 5 && readRec(dir, codes.Hal).tc.fw === 0 && readRec(dir, codes.Hal).tc.pd[0] === "f" + code, "...its record is kept (no cup won)");
    for (const p of [H, J, K]) p.close();
  } finally { await stopServer(srv); }

  // ---- a restart in the middle of a cup, the update's drain, a stuck cup; a Daily Cup with one player ----
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "pbtc-"));
  const AT2 = TC.startOf("2026-12-02", { h: 20, m: 0 });
  const env2 = { ACCOUNTS_DIR: dir2, TC_T: JSON.stringify({ tick: 100, roll: 1500, call: 30000, cpu: 60000, minSpeed: 0, host: 0, stuck: 15000, keep: 120000 }) };
  srv = await startServer(Object.assign({ TC_NOW: String(AT2 - 6000) }, env2));
  try {
    const cs = {};
    for (const n of ["Hu", "Ju", "Lu", "Mo"]) cs[n] = await newAccount(n);
    let H = await authed("Hu", cs.Hu), J = await authed("Ju", cs.Ju), L = await authed("Lu", cs.Lu), M = await authed("Mo", cs.Mo);
    setR(dir2, cs.Hu, 1300); setR(dir2, cs.Ju, 1200); setR(dir2, cs.Lu, 1100);
    // the Daily Cup tonight: only Mo comes
    M.send({ t: "tcj", v: PROTO, k: "d", f: "samurai", pi: 0 });
    let v = await M.tc((m) => m.day.st === "off", 12000);
    check(!!v && v.day.why === "few" && v.cup === null, "only one player at 20:00: no cup tonight (few)");
    M.send({ t: "tcj", v: PROTO, k: "d", f: "samurai", pi: 0 });
    check(!!(await M.next((m) => m.t === "tc-no" && m.why === "closed")), "...and its lobby is closed");
    // a Friends Cup of three: Hu against the CPU, Ju against Lu
    H.send({ t: "tcn", v: PROTO, f: "odin", pi: 0 });
    v = await H.tc((m) => m.cup && m.cup.code);
    const code = v.cup.code;
    J.send({ t: "tcj", v: PROTO, k: code, f: "samurai", pi: 0 }); L.send({ t: "tcj", v: PROTO, k: code, f: "wizard", pi: 0 });
    await H.tc((m) => m.cup && m.cup.ent && m.cup.ent.length === 3);
    J.send({ t: "tcp", f: "gunslinger", pi: 1 });
    v = await H.tc((m) => m.cup && m.cup.ent && m.cup.ent.some((e) => e.f === "gunslinger"));
    check(!!v, "a fighter change in the lobby");
    H.send({ t: "tcs" });
    v = await H.tc((m) => m.cup && m.cup.st === "run");
    check(!!v && v.cup.slots[0].n === "Hu" && v.cup.slots[1].c === 1 && v.cup.slots[2].n === "Ju" && v.cup.slots[2].f === "gunslinger", "seeded: Hu against the CPU, Ju (in the fighter she picked) against Lu");
    await H.next((m) => m.t === "tc-call", 3000); await J.next((m) => m.t === "tc-call", 3000); await L.next((m) => m.t === "tc-call", 3000);
    L.send({ t: "tcp", f: "dragon", pi: 0 });
    H.send({ t: "tcgo" });
    const tk = await H.next((m) => m.t === "tc-tk", 3000);
    J.send({ t: "tcgo" });
    v = await J.tc((m) => m.cup && m.cup.m && m.cup.m["0:1"] && m.cup.m["0:1"][3][0] === 1);
    check(!!v && v.cup.slots[3].f === "wizard", "FIGHT shows as ready; the ⇄ is locked once the match is called");
    // the server restarts: Ju against Lu is called again, Hu's ticket stays good
    for (const p of [H, J, L, M]) p.close();
    await stopServer(srv);
    srv = await startServer(Object.assign({ TC_NOW: String(AT2 + 6000) }, env2));   // (about where the clock stopped)
    H = await authed("Hu", cs.Hu); J = await authed("Ju", cs.Ju); L = await authed("Lu", cs.Lu);
    v = H.first;
    check(!!v && v.cup && v.cup.st === "run" && v.cup.m["0:0"][0] === "l" && v.cup.m["0:0"][4] === 1, "after a restart the cup goes on: the CPU match's ticket is still open");
    check(!!v && v.cup && v.cup.mytk === tk.tk.id && !(J.first && J.first.cup && J.first.cup.mytk), "...its player's view names the open ticket (a page that lost it forfeits it), nobody else's");
    const calledAgain = (m) => !!m && !!m.cup && !!m.cup.m && m.cup.m["0:1"][0] === "c" && m.cup.m["0:1"][3][0] === 0;
    v = calledAgain(J.first) ? J.first : await J.tc(calledAgain);
    check(!!v, "...the match between two players is called again (FIGHT again)");
    const p0 = playCpu(tk.tk, 0.95);
    sendLog(H, tk.tk.id, p0.codes);
    const rh = await H.next((m) => m.t === "tc-res" && m.key === "0:0", 6000);
    check(rh && rh.res === (p0.winner !== 1 ? 1 : 0), "a log for a ticket dealt before the restart is checked and counts");
    // the update drains: no new cup match starts
    srv.proc.kill("SIGUSR2");
    await sleep(200);
    J.send({ t: "tcgo" }); L.send({ t: "tcgo" });
    check(!(await J.next((m) => m.t === "qm-found", 1200)), "while the server drains for an update, no cup match starts");
    // the cup runs too long: it ends, the places so far
    const ej = await J.next((m) => m.t === "tc-end", 20000), eh = await H.next((m) => m.t === "tc-end", 3000);
    check(ej && ej.pl === 3 && ej.c === 0 && ej.ch === null, "a cup that runs too long ends: still in the semi-final = 3rd, no champion");
    check(eh && eh.pl === (rh && rh.res === 1 ? 2 : 3), "...through to the final = 2nd");
    check(/ran too long/.test(srv.log()), "the server logs the stuck cup");
    for (const p of [H, J, L]) p.close();
  } finally { await stopServer(srv); }

  console.log(`${passes} passed, ${fails} failed`);
  if (!fails) console.log("tourney ok");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
