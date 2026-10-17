// Quick match on the server (quick.js through server.js): the queue, the referee and the online rank.
// Two (or more) fake phones talk to a real server.js over WebSocket. A whole bot match is played the way the page plays it
// (inputs in the presence, D neutral frames first, a checksum every 60 frames) and the server's verdict must match the game.
// Run: node tests/quick.js   (prints "quick ok" at the end when every check passed)
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");
const { BL } = require("../game/core.js");
const Q = require("../quick.js");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.QUICK_PORT || 8092;   // check.sh gives every server its own port
const PROTO = +/const PROTO = (\d+);/.exec(fs.readFileSync(path.join(ROOT, "game/ui/online.js"), "utf8"))[1];
const FAST = { tick: 100, range: [[0.6, 200], [1.2, 400]], fallback: 1.2, noStart: 1500, quiet: 1500, keep: 3000, waitMsg: 400, offer: 1500, rematch: 8000 };
let fails = 0, passes = 0;
function check(ok, what) { if (ok) { passes++; console.log("PASS " + what); } else { fails++; console.log("FAIL " + what); if (process.env.QM_DEBUG && global.__log) console.log(global.__log().split("\n").filter((l) => /rror|at /.test(l)).slice(0, 12).join("\n")); } }
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
  const proc = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), KEEPALIVE_MINUTES: "0", QM_T: JSON.stringify(FAST) }, env), stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => { log += d; }); proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 60; i++) { const r = await call("GET", "/health"); if (r.status === 200) return { proc, log: () => log }; await sleep(100); }
  proc.kill(); throw new Error("server did not start:\n" + log);
}
async function stopServer(s) { if (!s) return; s.proc.kill(); await new Promise((r) => s.proc.once("exit", r)); }
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pbqm-"));
const hashOf = (code) => crypto.createHash("sha256").update(code.replace(/-/g, "")).digest("hex");
async function newAccount(name) { const r = await call("POST", "/api/acct/new", { prof: { name, tokens: 5 } }, { "x-forwarded-for": "192.0.2." + (1 + Math.floor(Math.random() * 200)) }); return r.json.code; }
const readAcct = (dir, code) => JSON.parse(fs.readFileSync(path.join(dir, hashOf(code) + ".json"), "utf8"));
function setProf(dir, code, patch) {   // the test's hand on an account's progress (chips, the stakes switch)
  const f = path.join(dir, hashOf(code) + ".json"), rec = JSON.parse(fs.readFileSync(f, "utf8"));
  Object.assign(rec.prof, patch); fs.writeFileSync(f, JSON.stringify(rec));
}
const berlinDay = () => { const p = {}; for (const x of new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())) p[x.type] = x.value; return `${p.year}-${p.month}-${p.day}`; };
const won = (g, slot) => (g.winner === slot ? 1 : g.winner === 1 - slot ? 0 : 0.5);
function setOn(dir, code, patch) {   // the test's own hand on an account's online record (the server reads the file each time)
  const f = path.join(dir, hashOf(code) + ".json"), rec = JSON.parse(fs.readFileSync(f, "utf8"));
  rec.on = Object.assign(rec.on || {}, patch); fs.writeFileSync(f, JSON.stringify(rec));
}
const readOn = (dir, code) => JSON.parse(fs.readFileSync(path.join(dir, hashOf(code) + ".json"), "utf8")).on;

/* ----- a fake phone ----- */
function phone(name, opts) {
  const o = opts || {};
  const P = { name, peer: o.peer || "p" + rid(20), by: "u_" + rid(20), k: o.k === undefined ? rid(24) : o.k, msgs: [], waiters: [], closed: null };
  P.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  P.ws.on("message", (b) => {
    let m; try { m = JSON.parse(b); } catch (e) { return; }
    const w = P.waiters.find((x) => x.pred(m));
    if (w) { P.waiters.splice(P.waiters.indexOf(w), 1); w.res(m); } else P.msgs.push(m);   // a waited-for message is used up
  });
  P.ws.on("close", (code) => { P.closed = code; });
  P.send = (m) => { if (P.ws.readyState === 1) P.ws.send(JSON.stringify(m)); };
  // the first message (already received or still to come) that matches
  P.next = (pred, ms, from) => new Promise((res) => {
    const i = P.msgs.findIndex((m, k) => k >= (from || 0) && pred(m));
    if (i >= 0) { const m = P.msgs[i]; P.msgs.splice(0, i + 1); return res(m); }
    const w = { pred, res };
    P.waiters.push(w);
    setTimeout(() => { const k = P.waiters.indexOf(w); if (k >= 0) { P.waiters.splice(k, 1); res(null); } }, ms || 4000);
  });
  P.open = () => new Promise((res) => {
    const go = () => { P.send({ t: "hello", peer: P.peer, by: P.by, name: P.name, k: P.k || undefined }); P.next((m) => m.t === "welcome", 3000).then(res); };
    if (P.ws.readyState === 1) go(); else { P.ws.once("open", go); P.ws.once("close", () => res(null)); }
  });
  P.close = () => { try { P.ws.close(); } catch (e) { /* gone */ } };
  return P;
}
async function authed(name, code) {
  const p = phone(name);
  await p.open();
  if (code) { p.send({ t: "auth", code }); p.me = await p.next((m) => m.t === "me", 3000); }
  return p;
}

/* ----- the page's input coding and lockstep, played by two bots ----- */
const ULTI_BASE = 2592, NEUTRAL = 1280, B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function encIn(i) {
  const qx = clamp(Math.round(i.x * 4), -4, 4), qy = clamp(Math.round(i.y * 4), -4, 4), q = (qx + 4) * 9 + (qy + 4);
  if (i.sprint && (qx === 4 || qx === -4)) return ULTI_BASE + 81 * 18 + (qx > 0 ? 9 : 0) + qy + 4;   // a sprint press (SPRINT_BASE)
  const b4 = (i.jump ? 1 : 0) + (i.light ? 2 : 0) + (i.heavy ? 4 : 0) + (i.special ? 8 : 0);
  return i.ulti ? ULTI_BASE + q * 16 + b4 : q * 32 + b4 + (i.dodge ? 16 : 0);
}
const pack = (arr, from, to) => { let s = ""; for (let f = from; f < to; f++) s += B64[arr[f] >> 6] + B64[arr[f] & 63]; return s; };
const FIG = Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, f]));
function startMsg(found, over) {
  return Object.assign({ id: 1, seed: found.seed, d: 4, f: found.f, p: found.p, rtt: 40, r: found.r, set: { n: 1, w: [0, 0] } }, over);
}
// joins both phones to the found room and sets their roles; returns [host, guest]
async function enter(a, b) {
  const fa = await a.next((m) => m.t === "qm-found", 5000), fb = await b.next((m) => m.t === "qm-found", 5000);
  if (!fa || !fb) return null;
  const [H, G] = fa.role === "host" ? [a, b] : [b, a];
  H.found = fa.role === "host" ? fa : fb; G.found = fa.role === "host" ? fb : fa;
  for (const p of [H, G]) { p.send({ t: "join", room: p.found.room }); await p.next((m) => m.t === "peers" && m.room === p.found.room, 2000); }
  H.send({ t: "presence", room: H.found.room, p: { role: "host", f: H.found.f[0] } });
  G.send({ t: "presence", room: G.found.room, p: { role: "guest", f: G.found.f[1] } });
  return [H, G];
}
/* Plays the match both phones agreed on (the same game the referee builds) with two bots, sending each phone's inputs the way the
   page does, 60 frames to a message. stopAt: { slot, frame } = that phone goes silent from that frame on; until: both stop there
   (the match keeps running). ckLie: slot whose checksums are wrong. late: slot that starts behind the other, so its first message
   starts at the other's frame - 2 (d - 2, past 0), as the page's does. Returns the local game. */
async function play(H, G, opts) {
  const o = opts || {}, st = H.st;
  const players = st.f.map((id, i) => ({ spec: FIG[id], pal: FIG[id].palettes[st.p[i]] }));
  const g = BL.newGame({ players, stocks: st.r.l, time: st.r.t * 60, countdown: 150, seed: st.seed, map: st.seed % BL.POOL });
  const bots = [BL.makeBot(o.lv0 || 0.95, BL.BOT_STYLES[st.f[0]]), BL.makeBot(o.lv1 || 0.2, BL.BOT_STYLES[st.f[1]])];
  const logs = [[], []], sent = [0, 0], phones = [H, G];
  for (let f = 0; f < st.d; f++) { logs[0].push(NEUTRAL); logs[1].push(NEUTRAL); }
  let ck = null, frame = 0;
  const flush = async (all) => {
    for (let i = 0; i < 2; i++) {
      if (o.stopAt && o.stopAt.slot === i && sent[i] >= o.stopAt.frame) continue;
      const to = logs[i].length;
      if (!all && to - sent[i] < 60) continue;
      const from = o.late === i && !sent[i] ? st.d - 2 : Math.max(0, sent[i] - 2);
      const c = o.ckLie === i && ck ? [ck[0], ck[1] ^ 1] : ck;
      phones[i].send({ t: "presence", room: phones[i].found.room, p: { m: st.id, s: from, i: pack(logs[i], from, to), fr: frame, ck: c } });
      sent[i] = to;
    }
    await sleep(14);   // the server allows about 120 messages a second per phone
  };
  while (g.phase !== "over" && frame < 60 * 60 * 5) {
    for (let i = 0; i < 2; i++) logs[i].push(encIn(BL.botInput(g, g.fighters[i], g.fighters[1 - i], bots[i])));   // the input for frame + D
    BL.step(g, [Q.decIn(logs[0][frame]), Q.decIn(logs[1][frame])]);
    g.events.length = 0;
    frame++;
    if (frame % 60 === 0) ck = [frame, BL.checksum(g)];
    if (o.stopAt && frame >= o.stopAt.frame + 200) break;   // the other phone waits from here on
    if (o.until && frame >= o.until) break;
    if (logs[0].length % 60 === 0) await flush(false);
  }
  await flush(true);
  return g;
}

(async () => {
  const dir = tmpDir();
  let srv = await startServer({ ACCOUNTS_DIR: dir }); global.__log = srv.log;
  try {
    check(/Quick match: on \(game version \d+, Ranked on\)/.test(srv.log()), "the server starts Quick match with Ranked on");
    let r = await call("GET", "/health");
    check(/ranked matches running: 0/.test(r.text) && /searching: 0/.test(r.text), "/health counts ranked matches and searches");

    // ---- accounts: auth gives the online record; Season 1 at 1000 ----
    const ca = await newAccount("Ann"), cb = await newAccount("Bob"), cc = await newAccount("Cid");
    let A = await authed("Ann", ca), B = await authed("Bob", cb);
    check(A.me && A.me.r === 1000 && A.me.n === 0 && /^[0-9A-Z]{10}$/.test(A.me.id), "auth: a fresh online record, rank 1000, a public id");
    check(readOn(dir, ca) && readOn(dir, ca).id === A.me.id, "auth: the record is saved in the account file");
    const bad = await authed("Eve", "ZZZZ-ZZZZ-ZZZZ-ZZZZ");
    check(bad.me && bad.me.err === "unknown", "auth: an unknown code is refused");
    // a phone's save keeps the online record; a load returns it
    r = await call("POST", "/api/acct/load", { code: ca });
    check(r.json && r.json.on && r.json.on.id === A.me.id, "load returns the online record");
    r = await call("POST", "/api/acct/save", { code: ca, rev: r.json.rev, prof: { name: "Ann", rating: 2400, tokens: 9 } });
    check(r.status === 200 && readOn(dir, ca).r === 1000, "a save from a phone can't change the online rank");

    // ---- refusals ----
    bad.send({ t: "qm", v: PROTO, mode: "r", f: "samurai", pi: 0 });
    check(!!(await bad.next((m) => m.t === "qm-no" && m.why === "acct")), "Ranked without an account: refused (acct)");
    bad.send({ t: "acct?" });
    check(!!(await bad.next((m) => m.t === "acct" && m.on === true)), "acct? (Play friends, before the silent account): accounts are on");
    A.send({ t: "qm", v: PROTO - 1, mode: "r", f: "samurai", pi: 0 });
    check(!!(await A.next((m) => m.t === "qm-no" && m.why === "old")), "an older page can't search (old: reload)");
    A.send({ t: "qm", v: PROTO, mode: "r", f: "nobody", pi: 0 });
    check(!!(await A.next((m) => m.t === "qm-no" && m.why === "bad")), "an unknown fighter is refused");
    bad.close();

    // ---- a whole Ranked match, decided by the referee ----
    A.send({ t: "qm", v: PROTO, mode: "r", f: "samurai", pi: 0 });
    const w = await A.next((m) => m.t === "qm-wait");
    check(w && w.n >= 1 && w.rng === 200, "searching: qm-wait with the count and the range (200)");
    B.send({ t: "qm", v: PROTO, mode: "r", f: "samurai", pi: 0 });
    let pair = await enter(A, B);
    check(!!pair && pair[0].found.ranked === true && pair[0].found.room.slice(0, 2) === "qm", "two Ranked players are paired into a Ranked match");
    let [H, G] = pair;
    check(H.found.p[1] === 1 && H.found.f[0] === "samurai" && H.found.opp.name === G.name && H.found.opp.r === 1000 && H.found.opp.pl === 0, "found: mirror skin moved, the opponent's name, rank and placement");
    // a third phone can't get into the match room
    const X = await authed("Xan", cc);
    X.send({ t: "join", room: H.found.room });
    check(!(await X.next((m) => m.t === "peers", 800)), "a Quick match room refuses anyone else");
    H.st = startMsg(H.found);
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await sleep(150);
    r = await call("GET", "/health");
    check(/ranked matches running: 1/.test(r.text), "/health: one ranked match running");
    const g = await play(H, G, { late: 1 });   // the guest starts behind the host, as on real phones
    const resH = await H.next((m) => m.t === "qm-res", 5000), resG = await G.next((m) => m.t === "qm-res", 5000);
    const want = g.winner === 0 ? [1, 0] : g.winner === 1 ? [0, 1] : [0.5, 0.5];
    check(resH && resG && resH.res === want[0] && resG.res === want[1] && resH.why === "game", `the referee's verdict is the game's (winner ${g.winner}, ${g.t} frames)`);
    const dH = Q.elo(1000, 1000, want[0], 0), dG = Q.elo(1000, 1000, want[1], 0);
    check(resH && resH.dr === dH && resH.r1 === 1000 + dH && resG.dr === dG && resG.n === 1, `rating: K 48 while placing (${dH >= 0 ? "+" : ""}${dH} / ${dG})`);
    const oh = readOn(dir, H === A ? ca : cb);
    check(oh.n === 1 && oh.r === 1000 + dH && oh.h.length === 1 && oh.h[0].why === "game" && oh.last === (H === A ? B : A).me.id, "the account file holds the new rank, the result and the last opponent");
    check(!/drifted/.test(srv.log()), "both phones' checksums agreed with the referee");
    {
      const wH = want[0] === 1 ? "W" : want[0] === 0 ? "L" : "D", og = readOn(dir, H === A ? cb : ca);
      check(resH.rv && resH.rv.id === G.me.id && resH.rv.k === wH && resH.rv.w + resH.rv.l + resH.rv.d === 1 && resH.rv.nm === G.name && resH.rv.f === H.found.f[1],
        "the verdict carries the record against them (first entry, their name and fighter)");
      check(resH.ws === (want[0] === 1 ? 1 : 0) && resG.ws === (want[1] === 1 ? 1 : 0) && !resH.bh && !resH.bl, "the verdict carries the Ranked win streak, no bounty yet");
      check(oh.rv.length === 1 && oh.rv[0].id === G.me.id && og.rv[0].id === H.me.id && oh.g === 1 && og.g === 1, "both account files keep the rival record and the refereed count");
      check(!H.found.opp.riv && H.found.opp.riv === null && H.found.opp.bty === 0 && H.found.you && H.found.you.bty === 0, "found: a first meeting (riv null), no bounty on either side");
    }

    // ---- never the same opponent twice in a row in Ranked: they meet again as Casual ----
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });
    await sleep(100);
    A.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "r", f: "wizard", pi: 0 });
    check(!(await A.next((m) => m.t === "qm-found", 900)), "the same two Ranked players are not paired again at once");
    pair = await enter(A, B);
    check(!!pair && pair[0].found.ranked === false && pair[0].found.fb === true, "after the fallback time they meet as Casual (fb: doesn't count)");
    [H, G] = pair;
    H.st = startMsg(H.found);
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await sleep(100);
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });
    await sleep(100);
    check(!(await H.next((m) => m.t === "qm-res" || m.t === "qm-off" || m.t === "qm-cs", 500)), "a Casual match left before its end leaves no verdict and no record");

    // ---- Casual with two accounts: the referee plays every game for the rival record, a rematch too; no rank, no streak ----
    await sleep(100);
    const rA0 = readOn(dir, ca), rB0 = readOn(dir, cb);
    A.send({ t: "qm", v: PROTO, mode: "c", f: "samurai", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 });
    pair = await enter(A, B);
    [H, G] = pair;
    const prior = H.found.opp.riv;
    check(!!prior && prior.w + prior.l + prior.d === 1 && !("bty" in H.found.opp) && !H.found.you, "found (Casual): the record so far, no bounty shown");
    H.st = startMsg(H.found);
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    let cg = await play(H, G);
    let csH = await H.next((m) => m.t === "qm-cs", 4000), csG = await G.next((m) => m.t === "qm-cs", 4000);
    const cw = cg.winner === 0 ? [1, 0] : cg.winner === 1 ? [0, 1] : [0.5, 0.5];
    check(csH && csG && csH.g === 1 && csH.res === cw[0] && csG.res === cw[1] && csH.rv.w + csH.rv.l + csH.rv.d === 2, `a Casual game: qm-cs with the game's result to both (winner ${cg.winner})`);
    // the rematch: the friend match's own start (id 2, a new seed), refereed on its own
    H.st = startMsg(H.found, { id: 2, seed: 777123 });
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    cg = await play(H, G);
    csH = await H.next((m) => m.t === "qm-cs" && m.g === 2, 4000); csG = await G.next((m) => m.t === "qm-cs" && m.g === 2, 4000);
    const cw2 = cg.winner === 0 ? [1, 0] : cg.winner === 1 ? [0, 1] : [0.5, 0.5];
    check(csH && csG && csH.res === cw2[0] && csG.res === cw2[1] && csH.rv.w + csH.rv.l + csH.rv.d === 3 && csH.rv.k.length === 3, "a Casual rematch is its own refereed game (g 2)");
    const rA1 = readOn(dir, ca), rB1 = readOn(dir, cb);
    check(rA1.r === rA0.r && rA1.n === rA0.n && rA1.ws === rA0.ws && rB1.r === rB0.r && rA1.g === rA0.g + 2 && rA1.rv[0].id === rB1.id, "Casual: rank, Ranked count and streak unchanged; the record and refereed count grow");
    // a rematch the host changed (another fighter) isn't refereed
    H.st = startMsg(H.found, { id: 3, seed: 5, f: ["reaper", H.found.f[1]] });
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G, { until: 600 });
    check(!(await H.next((m) => m.t === "qm-cs", 500)) && readOn(dir, ca).g === rA1.g, "a rematch with other fighters isn't refereed");
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });

    // ---- the streak bounty: 3 Ranked wins in a row put 30 on you; whoever ends the streak takes it, once per pair a day ----
    await sleep(100);
    const cd = await newAccount("Dan");
    const Dn = await authed("Dan", cd);
    setOn(dir, cd, { ws: 3 });
    Dn.send({ t: "auth", code: cd }); Dn.me = await Dn.next((m) => m.t === "me");
    check(Dn.me.ws === 3 && Dn.me.bty === 30, "me: the streak and the bounty on it (3 wins: 30)");
    const tok0 = readAcct(dir, cb).prof.tokens, rev0 = readAcct(dir, cb).rev;
    Dn.send({ t: "qm", v: PROTO, mode: "r", f: "samurai", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 });
    pair = await enter(Dn, B);
    [H, G] = pair;
    const hunter = H === B ? H : G, streaker = H === B ? G : H;
    check(hunter.found.opp.ws === 3 && hunter.found.opp.bty === 30 && streaker.found.you.bty === 30 && streaker.found.opp.bty === 0, "found (Ranked): the hunter sees the bounty on them, the streaker their own");
    H.st = startMsg(H.found);
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G, { until: 400 });
    streaker.send({ t: "leave", room: streaker.found.room });   // a forfeit ends a streak like any loss
    let bH = await hunter.next((m) => m.t === "qm-res", 3000), bS = await streaker.next((m) => m.t === "qm-res", 3000);
    check(bH && bH.res === 1 && bH.bh && bH.bh.n === 30 && bH.bh.k === 3 && bS && bS.bl && bS.bl.n === 30 && bS.ws === 0, "ending a 3-win streak: the hunter takes 30, the streaker's streak is 0");
    let accB = readAcct(dir, cb);
    check(accB.prof.tokens === tok0 + 30 && accB.rev === rev0 + 1 && readOn(dir, cb).bc.length === 1, "the bounty is paid into the hunter's account file as a new rev");
    r = await call("POST", "/api/acct/save", { code: cb, rev: rev0, prof: { name: "Bob", tokens: tok0 + 20 } });
    check(r.status === 409 && r.json.prof.tokens === tok0 + 30, "a phone saving its older copy gets 409 with the paid chips (it merges, nothing lost)");
    check(/bounty 30/.test(srv.log()), "the log line names the bounty");
    hunter.send({ t: "leave", room: hunter.found.room });
    // the same pair the same day: the streak still ends, no second bounty
    await sleep(100);
    setOn(dir, cd, { ws: 5, last: "" }); setOn(dir, cb, { last: "" });
    Dn.send({ t: "auth", code: cd }); await Dn.next((m) => m.t === "me");
    B.send({ t: "auth", code: cb }); await B.next((m) => m.t === "me");
    Dn.send({ t: "qm", v: PROTO, mode: "r", f: "samurai", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 });
    pair = await enter(Dn, B);
    [H, G] = pair;
    const hunter2 = H === B ? H : G, streaker2 = H === B ? G : H;
    check(hunter2.found.opp.bty === 50, "a 5-win streak carries 50");
    H.st = startMsg(H.found);
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G, { until: 400 });
    streaker2.send({ t: "leave", room: streaker2.found.room });
    bH = await hunter2.next((m) => m.t === "qm-res", 3000); bS = await streaker2.next((m) => m.t === "qm-res", 3000);
    check(bH && bH.bh && bH.bh.n === 0 && bH.bh.k === 5 && bS.bl && bS.bl.n === 0 && readAcct(dir, cb).prof.tokens === tok0 + 30, "the same hunter and streaker the same day: the streak ends, no second bounty");
    hunter2.send({ t: "leave", room: hunter2.found.room });
    setOn(dir, cb, { last: "" });   // the tests below pair Bob again
    B.send({ t: "auth", code: cb }); await B.next((m) => m.t === "me");

    // ---- chip stakes: a rematch for 10 / 25 / 50 after a refereed result; the server referees it and moves the chips ----
    await sleep(100);
    // too new: under 10 refereed matches
    Dn.send({ t: "qm", v: PROTO, mode: "c", f: "samurai", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 });
    pair = await enter(Dn, B); [H, G] = pair;
    H.st = startMsg(H.found); H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G);
    let sk1 = await Dn.next((m) => m.t === "qm-cs", 4000);
    await B.next((m) => m.t === "qm-cs", 4000);   // Bob's copy too, or the next game's check reads this one
    check(sk1 && sk1.sk && sk1.sk.why === "new" && sk1.sk.k === 10 - readOn(dir, cd).g && sk1.sk.ok.length === 0, `stakes: locked under 10 refereed matches (${sk1 && JSON.stringify(sk1.sk)})`);
    Dn.send({ t: "stk", s: 10 });
    check(!!(await Dn.next((m) => m.t === "stk-no" && m.why === "new", 1500)), "stakes: a challenge from a new account is refused (new)");
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });
    // both experienced, chips enough: a Casual game, then the challenge
    setOn(dir, cd, { g: 12, sk: { d: "", n: 0, w: 0, l: 0, net: 0 } }); setOn(dir, cb, { g: 12 });
    setProf(dir, cd, { tokens: 200 }); setProf(dir, cb, { tokens: 40 });
    await sleep(100);
    Dn.send({ t: "qm", v: PROTO, mode: "c", f: "samurai", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 });
    pair = await enter(Dn, B); [H, G] = pair;
    H.st = startMsg(H.found); H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G);
    sk1 = await Dn.next((m) => m.t === "qm-cs", 4000); let sk2 = await B.next((m) => m.t === "qm-cs", 4000);
    check(sk1 && sk1.sk.why === "" && sk1.sk.ok.join() === "10,25" && sk2 && sk2.sk.ok.join() === "10,25", `stakes: open, only what both can afford (Bob has 40: ${sk1 && sk1.sk.ok} / ${sk2 && sk2.sk.ok})`);
    Dn.send({ t: "stk", s: 50 });
    check(!!(await Dn.next((m) => m.t === "stk-no" && m.why === "chips", 1500)), "stakes: more than the other can afford is refused (chips)");
    // declined
    Dn.send({ t: "stk", s: 25 });
    let out = await Dn.next((m) => m.t === "stk-out", 1500), inn = await B.next((m) => m.t === "stk-in", 1500);
    check(out && out.s === 25 && inn && inn.s === 25 && inn.name === "Dan" && inn.ms === 1500, "stakes: the challenge goes out (stk-out) and arrives (stk-in, with the name)");
    B.send({ t: "stkx" });
    check(!!(await Dn.next((m) => m.t === "stk-off" && m.why === "no", 1500)), "stakes: declined reads as no answer (stk-off no)");
    // no answer
    Dn.send({ t: "stk", s: 10 }); await B.next((m) => m.t === "stk-in", 1500);
    const ta = await Dn.next((m) => m.t === "stk-off", 3000), tb = await B.next((m) => m.t === "stk-off", 3000);
    check(ta && ta.why === "no" && tb, "stakes: a challenge nobody answers goes off on both phones");
    // accepted: a server-assigned match, the same fighters and skins, refereed; the winner takes the other's stake
    const rdn = readAcct(dir, cd), rbb = readAcct(dir, cb);
    Dn.send({ t: "stk", s: 25 }); await B.next((m) => m.t === "stk-in", 1500);
    B.send({ t: "stk-ok" });
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });
    pair = await enter(Dn, B);
    check(!!pair && pair[0].found.sk === 25 && pair[0].found.ranked === false && pair[0].found.f.join() === H.found.f.join() && pair[0].found.p.join() === H.found.p.join(),
      "stakes: accepted, both get a staked match (qm-found sk 25) with the fighters and skins of the last one");
    check(readOn(dir, cd).sk.n === 1 && readOn(dir, cb).sk.n === 1 && readOn(dir, cd).sk.d === berlinDay(), "stakes: today's count goes up for both at the accept");
    [H, G] = pair;
    H.st = startMsg(H.found); H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await sleep(150);
    r = await call("GET", "/health");
    check(/ranked matches running: 1/.test(r.text), "/health counts a staked match as running (the update waits for it)");
    const sg = await play(H, G);
    let vH = await H.next((m) => m.t === "qm-sk", 4000), vG = await G.next((m) => m.t === "qm-sk", 4000);
    const exp = [won(sg, 0), won(sg, 1)].map((x) => (x === 1 ? 25 : x === 0 ? -25 : 0));
    check(vH && vG && vH.res === won(sg, 0) && vH.d === exp[0] && vG.d === exp[1] && vH.s === 25 && vH.day === 1, `stakes: the referee's verdict moves 25 (${exp.join(" / ")})`);
    const dn1 = readAcct(dir, cd), bb1 = readAcct(dir, cb), dnD = H === Dn ? exp[0] : exp[1], bbD = H === Dn ? exp[1] : exp[0];
    check(dn1.prof.tokens === rdn.prof.tokens + dnD && bb1.prof.tokens === rbb.prof.tokens + bbD && dn1.rev === rdn.rev + (dnD ? 1 : 0), "stakes: the chips move in both account files (a new rev each)");
    check(readOn(dir, cd).sk.net === dnD && readOn(dir, cd).ws === rdn.on.ws && readOn(dir, cd).r === rdn.on.r, "stakes: the stake record keeps the net; rank and streak don't move");
    check(vH.rv && vH.rv.w + vH.rv.l + vH.rv.d >= 3 && vH.sk && Array.isArray(vH.sk.ok), "stakes: the verdict carries the record and the next stake check");
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });
    // leaving in the first 30 s of the fight: no result, nothing moves; later: a loss
    setProf(dir, cd, { tokens: 200 }); setProf(dir, cb, { tokens: 200 });
    Dn.send({ t: "stk", s: 10 }); await B.next((m) => m.t === "stk-in", 1500); B.send({ t: "stk-ok" });
    pair = await enter(Dn, B); [H, G] = pair;
    H.st = startMsg(H.found); H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G, { until: 600 });
    G.send({ t: "leave", room: G.found.room });
    vH = await H.next((m) => m.t === "qm-sk", 3000);
    check(vH && vH.res === null && vH.why === "early" && readAcct(dir, cd).prof.tokens === 200 && readAcct(dir, cb).prof.tokens === 200, "stakes: a forfeit in the first 30 s of the fight is no result");
    H.send({ t: "leave", room: H.found.room });
    await sleep(100);
    Dn.send({ t: "stk", s: 10 }); await B.next((m) => m.t === "stk-in", 1500); B.send({ t: "stk-ok" });
    check(!(await Dn.next((m) => m.t === "qm-found", 800)), "stakes: no rematch for chips without a result just before (the early one wasn't)");
    // the daily limit, the rank gap (Quick match only), the switch
    setOn(dir, cd, { sk: { d: berlinDay(), n: 5, w: 0, l: 0, net: 0 } });
    Dn.send({ t: "qm", v: PROTO, mode: "c", f: "samurai", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 });
    pair = await enter(Dn, B); [H, G] = pair;
    H.st = startMsg(H.found); H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G);
    sk1 = await Dn.next((m) => m.t === "qm-cs", 4000); sk2 = await B.next((m) => m.t === "qm-cs", 4000);
    check(sk1 && sk1.sk.why === "day" && sk2 && sk2.sk.why === "them", "stakes: 5 a day (day); the other phone reads them");
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });
    check(Q.stakeCheck({ g: 20, r: 1000, sk: { d: "", n: 0 } }, { tokens: 99 }, { g: 20, r: 1300, sk: { d: "", n: 0 } }, { tokens: 99 }, false, Date.now()).why === "gap" &&
      Q.stakeCheck({ g: 20, r: 1000, sk: { d: "", n: 0 } }, { tokens: 99 }, { g: 20, r: 1300, sk: { d: "", n: 0 } }, { tokens: 99 }, true, Date.now()).ok.join() === "10,25,50",
      "stakes: ranks 300 apart can't in Quick match (gap), can in Play friends");
    check(Q.stakeCheck({ g: 20, r: 1000, sk: { d: "", n: 0 } }, { tokens: 99, so: 1 }, { g: 20, r: 1000, sk: { d: "", n: 0 } }, { tokens: 99 }, false, Date.now()).why === "off" &&
      Q.stakeCheck({ g: 20, r: 1000, sk: { d: "", n: 0 } }, { tokens: 99 }, { g: 20, r: 1000, sk: { d: "", n: 0 } }, { tokens: 99, so: 1 }, false, Date.now()).why === "them", "stakes: the switch off hides them (off / them)");
    setOn(dir, cd, { sk: { d: "", n: 0, w: 0, l: 0, net: 0 } });

    // ---- Play friends: a 1v1 game between two signed-in players is refereed too; a stake can follow it ----
    await sleep(100);
    const room = "bl" + rid(7);
    for (const p of [Dn, B]) { p.send({ t: "join", room }); await p.next((m) => m.t === "peers" && m.room === room, 2000); }
    const fst = { id: 1, seed: 4242, d: 4, f: ["wizard", "dragon"], p: [1, 0], rtt: 40, r: { l: 1, t: 2, b: 3 }, set: { n: 1, w: [0, 0] } };
    Dn.found = { room }; B.found = { room }; Dn.st = fst;
    Dn.send({ t: "presence", room, p: { role: "host", opp: B.peer, f: "wizard", r: fst.r, start: fst } });
    B.send({ t: "presence", room, p: { role: "guest", f: "dragon" } });
    const fg = await play(Dn, B);
    sk1 = await Dn.next((m) => m.t === "qm-cs" && m.pf === 1, 4000); sk2 = await B.next((m) => m.t === "qm-cs" && m.pf === 1, 4000);
    check(sk1 && sk2 && sk1.id === room && sk1.g === 1 && sk1.res === won(fg, 0) && sk2.res === won(fg, 1) && sk1.rv && sk1.rv.id === B.me.id, "Play friends: a 1v1 game is refereed (qm-cs pf, the rival record)");
    // a boss fight isn't
    Dn.st = Object.assign({}, fst, { id: 2, bo: { b: "scratch", lv: 0 } });
    Dn.send({ t: "presence", room, p: { role: "host", opp: B.peer, start: Dn.st } });
    await play(Dn, B, { until: 400 });
    check(!(await Dn.next((m) => m.t === "qm-cs", 600)), "Play friends: a boss fight isn't refereed");
    Dn.send({ t: "stk", s: 10 });
    check(!!(await B.next((m) => m.t === "stk-in", 1500)), "Play friends: a chip challenge can follow a friend game");
    B.send({ t: "stk-ok" });
    for (const p of [Dn, B]) p.send({ t: "leave", room });
    pair = await enter(Dn, B);
    check(!!pair && pair[0].found.sk === 10 && pair[0].found.f.join() === "wizard,dragon" && pair[0].found.room !== room, "Play friends: the staked match is a server-assigned room with the friend game's fighters");
    for (const p of pair) p.send({ t: "leave", room: p.found.room });
    Dn.close();

    // ---- leaving a running Ranked match is a loss; a drifting phone is logged, the referee still decides ----
    const C = X;
    A.send({ t: "qm", v: PROTO, mode: "r", f: "reaper", pi: 0 }); C.send({ t: "qm", v: PROTO, mode: "r", f: "phoenix", pi: 0 });
    pair = await enter(A, C);
    [H, G] = pair;
    H.st = startMsg(H.found);
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G, { until: 900, ckLie: 0 });
    check(/drifted from the referee/.test(srv.log()), "a phone whose checksums differ from the referee's is logged");
    const before = readOn(dir, G === A ? ca : cc).r;
    G.send({ t: "leave", room: G.found.room });
    const lv = await G.next((m) => m.t === "qm-res", 2000), lw = await H.next((m) => m.t === "qm-res", 2000);
    check(lv && lv.res === 0 && lv.why === "left" && lw && lw.res === 1, "leaving a running Ranked match: the leaver loses, the other wins");
    check(readOn(dir, G === A ? ca : cc).r < before, "the leaver's rank goes down");
    H.send({ t: "leave", room: H.found.room });

    // ---- going quiet: the phone the game waits for loses ----
    await sleep(100);
    B.send({ t: "qm", v: PROTO, mode: "r", f: "dragon", pi: 0 }); C.send({ t: "qm", v: PROTO, mode: "r", f: "alchemist", pi: 0 });
    pair = await enter(B, C);
    [H, G] = pair;
    H.st = startMsg(H.found);
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: H.st } });
    await play(H, G, { stopAt: { slot: 0, frame: 300 } });
    const qv = await H.next((m) => m.t === "qm-res", 4000), qw = await G.next((m) => m.t === "qm-res", 4000);
    check(qv && qv.why === "quiet" && qv.res === 0 && qw && qw.res === 1, "a phone that sends nothing while the other waits loses (quiet)");
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });

    // ---- a host that changes the match loses ----
    await sleep(100);
    A.send({ t: "qm", v: PROTO, mode: "r", f: "gunslinger", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "r", f: "samurai", pi: 2 });
    pair = await enter(A, B);
    [H, G] = pair;
    H.send({ t: "presence", room: H.found.room, p: { role: "host", start: startMsg(H.found, { seed: H.found.seed + 1 }) } });
    const sv = await H.next((m) => m.t === "qm-res", 2000);
    check(sv && sv.why === "start" && sv.res === 0, "a host whose start differs from the server's assignment loses (start)");
    for (const p of [H, G]) p.send({ t: "leave", room: p.found.room });

    // ---- found but never started: no result, nobody's rank changes ----
    await sleep(100);
    const ra = readOn(dir, ca).r, rc = readOn(dir, cc).r;
    A.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 }); C.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 });
    pair = await enter(A, C);
    const off = await pair[0].next((m) => m.t === "qm-off", 3000), off2 = await pair[1].next((m) => m.t === "qm-off", 1000);
    check(off && off.why === "nostart" && off2 && readOn(dir, ca).r === ra && readOn(dir, cc).r === rc, "a match that never starts: qm-off nostart to both, no rank change");
    for (const p of pair) p.send({ t: "leave", room: p.found.room });

    // ---- the rating range: far apart only after waiting ----
    await sleep(100);
    setOn(dir, cc, { r: 1700, pk: 1700 });
    C.send({ t: "auth", code: cc }); await C.next((m) => m.t === "me");
    const t0 = Date.now();
    A.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 }); C.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 });
    pair = await enter(A, C);
    check(!!pair && Date.now() - t0 >= 1100, `players 700 apart meet only once the range is open (${Date.now() - t0} ms)`);
    for (const p of pair) p.send({ t: "leave", room: p.found.room });

    // ---- one search per account ----
    await sleep(100);
    const A2 = await authed("Ann2", ca);
    A.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 });
    await A.next((m) => m.t === "qm-wait");
    A2.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 });
    check(!!(await A.next((m) => m.t === "qm-x" && m.why === "elsewhere")), "a second page of the same account takes over the search");
    A2.send({ t: "qmx" }); A2.close();

    // ---- taking over another phone's connection needs its secret ----
    const thief = phone("Thief", { peer: B.peer, k: rid(24) });
    await thief.open();
    await sleep(200);
    check(thief.closed === 1008 && B.ws.readyState === 1, "a hello with someone else's peer id and another secret is refused");
    const thief2 = phone("Thief2", { peer: B.peer, k: "" });
    await thief2.open();
    await sleep(200);
    check(thief2.closed === 1008, "a hello with someone else's peer id and no secret is refused");

    // ---- drain before an update ----
    const D1 = await authed("Dee", await newAccount("Dee"));
    D1.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 });
    await D1.next((m) => m.t === "qm-wait");
    srv.proc.kill("SIGUSR2");
    await sleep(300);
    r = await call("GET", "/health");
    check(/draining: yes/.test(r.text) && !!(await D1.next((m) => m.t === "qm-wait" && m.hold === 1, 1500)), "SIGUSR2: draining, searches are told to hold");
    B.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 });
    check(!(await D1.next((m) => m.t === "qm-found", 1500)), "draining: no new matches are made");
    for (const p of [A, B, C, D1, X, thief, thief2]) p.close();
  } finally { await stopServer(srv); }

  // ---- accounts off: Casual still works, Ranked is refused ----
  srv = await startServer({ ACCOUNTS_DIR: "" });
  try {
    check(/Quick match: on \(game version \d+, Ranked off: needs accounts\)/.test(srv.log()), "accounts off: Quick match runs Casual only");
    const A = await authed("Ann", "0000-0000-0000-0000"), B = await authed("Bob", null);
    check(A.me && A.me.err === "off", "accounts off: auth answers off");
    B.send({ t: "acct?" });
    check(!!(await B.next((m) => m.t === "acct" && m.on === false)), "accounts off: acct? answers off (no HTTP 404 on the page)");
    B.send({ t: "qm", v: PROTO, mode: "r", f: "odin", pi: 0 });
    check(!!(await B.next((m) => m.t === "qm-no" && m.why === "acct")), "accounts off: Ranked is refused");
    A.send({ t: "qm", v: PROTO, mode: "c", f: "odin", pi: 0 }); B.send({ t: "qm", v: PROTO, mode: "c", f: "samurai", pi: 0 });
    const pair = await enter(A, B);
    check(!!pair && pair[0].found.ranked === false && pair[0].found.opp.pl === -1, "accounts off: two Casual players are paired");
    A.close(); B.close();
  } finally { await stopServer(srv); }

  // ---- the pure parts ----
  check(Q.elo(1000, 1000, 1, 0) === 24 && Q.elo(1000, 1000, 1, 10) === 16 && Q.elo(1200, 1000, 0, 20) === -24, "elo: K 48 for the first 10, then 32");
  check(Q.cleanOn({ r: -5, w: 3, id: "bad" }).r === 1000 && Q.cleanOn({ r: 1300, pk: 900 }).pk === 1300, "a broken online record is cleaned");
  {
    const c = Q.cleanOn({ rv: [{ id: "AAAAAAAAAA", w: 2, k: "WWx<>" }, { id: "AAAAAAAAAA", w: 9 }, { id: "bad" }, null], ws: -1, bc: ["X:2026-10-16", 5] });
    check(c.rv.length === 1 && c.rv[0].w === 2 && c.rv[0].k === "WW" && c.ws === 0 && c.bc.length === 1, "a broken rival record is cleaned (one entry per id, no junk)");
  }
  check([0, 2, 3, 4, 5, 9, 10, 40].map(Q.bounty).join() === "0,0,30,40,50,90,100,100", "bounty: 30 / 40 / 50 at 3 / 4 / 5 wins, +10 a win, 100 at most");
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${passes} passed, ${fails} failed`);
  if (!fails) console.log("quick ok");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
