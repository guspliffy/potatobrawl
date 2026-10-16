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

  // ----- the accounts hub: per-fighter stats, flawless cups, picture, title
  const F0 = ids[0], F1 = ids[1];
  const fb = prof({ fstats: { [F0]: { w: 3, l: 1, d: 0 } }, fsince: 1000, flawless: 1, avatar: F0 + ":0", title: "cup" });
  const fA = prof(Object.assign({}, fb, { fstats: { [F0]: { w: 5, l: 1, d: 0 }, [F1]: { w: 1, l: 0, d: 0 } } }));            // device A: +2 wins with F0, a new fighter
  const fB = prof(Object.assign({}, fb, { fstats: { [F0]: { w: 3, l: 4, d: 1 } }, flawless: 2, fsince: 900 }));            // device B: +3 losses, +1 draw, one more flawless cup
  const fm = SYNC.mergeProf(fB, fb, fA, true);
  check(eq(fm.fstats[F0], { w: 5, l: 4, d: 1 }) && eq(fm.fstats[F1], { w: 1, l: 0, d: 0 }), "fstats: two devices add what each changed per fighter (3+2 wins, 1+3 losses, 0+1 draws; a fighter only one side played is kept)");
  check(fm.flawless === 2 && fm.fsince === 900, "fstats: the flawless counter adds, 'since' keeps the earlier date");
  const dm = SYNC.mergeProf(prof(Object.assign({}, fb, { duo: 3 })), prof(Object.assign({}, fb, { duo: 1 })), prof(Object.assign({}, fb, { duo: 2 })), true);
  check(dm.duo === 4, "duo: online boss wins (Double Trouble) add from both devices (1, +2 here, +1 there = 4)");
  const dk = SYNC.mergeProf(prof(Object.assign({}, fb, { duo: 2 })), prof(fb), SYNC.sanitize(fb, FIGHTERS), false);
  check(dk.duo === 2, "duo: a server copy from a page without it keeps this device's count");
  // an older page: it syncs a prof WITHOUT the new fields. Missing = unchanged, never zero.
  const oldPage = (p) => { const o = Object.assign({}, p); for (const k of ["fstats", "fsince", "flawless", "avatar", "title", "daily"]) delete o[k]; return o; };
  const o1 = SYNC.sanitize(oldPage(fb), FIGHTERS);
  check(!("fstats" in o1) && !("flawless" in o1) && !("avatar" in o1) && !("title" in o1) && !("fsince" in o1), "old page: sanitize does not invent the new fields (a missing one stays missing)");
  const keep1 = SYNC.mergeProf(fA, fb, o1, true);
  check(eq(keep1.fstats, fA.fstats) && keep1.flawless === fA.flawless && keep1.fsince === fA.fsince && keep1.avatar === fA.avatar && keep1.title === fA.title, "old page: the server copy lost the fields -> this device keeps its stats, flawless count, picture and title");
  const keep2 = SYNC.mergeProf(fA, fb, o1, false);
  check(eq(keep2.fstats, fA.fstats) && keep2.avatar === fb.avatar && keep2.title === "cup", "old page: same when the server copy is the newer one");
  const oldLocal = SYNC.mergeProf(oldPage(fb), oldPage(fb), fA, true);
  check(eq(oldLocal.fstats, fA.fstats) && oldLocal.flawless === fA.flawless && oldLocal.title === fA.title, "old page: this side lacks the fields -> the server's stats are kept");
  const wiped = SYNC.mergeProf(prof({ fstats: {}, flawless: 0 }), prof({ fstats: {}, flawless: 0 }), fA, false);
  check(eq(wiped.fstats, fA.fstats) && wiped.flawless === fA.flawless, "merge: a device with empty stats just takes the server's");
  // applyTo from an old-page prof leaves the device's new fields alone
  const dev = { tokens: 1, owned: {}, pal: {}, fstats: { [F0]: { w: 2, l: 0, d: 0 } }, fsince: 5, flawless: 3, avatar: F1 + ":0", title: "flawless" };
  SYNC.applyTo(dev, o1);
  check(eq(dev.fstats, { [F0]: { w: 2, l: 0, d: 0 } }) && dev.flawless === 3 && dev.avatar === F1 + ":0" && dev.title === "flawless" && dev.fsince === 5, "apply: a prof without the new fields leaves this device's stats, picture and title as they are");
  SYNC.applyTo(dev, fA);
  check(eq(dev.fstats, fA.fstats) && dev.flawless === fA.flawless && dev.title === fA.title, "apply: a prof with them replaces them");
  // sanitize of bad values
  const bad = SYNC.sanitize({ fstats: { [F0]: { w: -4, l: 1e12, d: "x" }, "Bad Id": { w: 1 }, "__proto__": { w: 9 }, zero: { w: 0, l: 0, d: 0 }, mystery: { w: 2 }, junk: 5 }, fsince: -3, flawless: "many", avatar: "../x", title: "Not A Title!" }, FIGHTERS);
  check(eq(bad.fstats, { [F0]: { w: 0, l: 1e9, d: 0 }, mystery: { w: 2, l: 0, d: 0 } }), "sanitize: fstats numbers are clamped, odd ids and all-zero rows dropped, an unknown fighter id kept");
  check(!("fsince" in bad) && !("flawless" in bad) && bad.avatar === "" && bad.title === "", "sanitize: bad fsince/flawless are left out, a bad picture or title becomes the default (empty)");
  check(!Object.prototype.hasOwnProperty.call(bad.fstats, "__proto__") && Object.getPrototypeOf(bad.fstats) === Object.prototype, "sanitize: fstats has no __proto__ key");
  const many = SYNC.sanitize({ fstats: Object.fromEntries(Array.from({ length: 80 }, (_, i) => ["f" + String(i).padStart(2, "0"), { w: 1 }])) }, FIGHTERS);
  check(Object.keys(many.fstats).length === 24, "sanitize: at most 24 fighters in fstats");
  check(SYNC.sanitize({ fstats: [1], avatar: 5, title: null }, FIGHTERS).fstats === undefined && SYNC.sanitize({ avatar: 5 }, FIGHTERS).avatar === undefined, "sanitize: fstats that is not an object, or an avatar that is not text, counts as missing");
  const good = SYNC.sanitize({ avatar: F1 + ":2", title: "flawless", fsince: 123456.7, flawless: 4 }, FIGHTERS);
  check(good.avatar === F1 + ":2" && good.title === "flawless" && good.fsince === 123457 && good.flawless === 4 && eq(SYNC.sanitize(good, FIGHTERS), good), "sanitize: good picture, title, since and flawless pass, cleaning twice changes nothing");
  // picture and title follow the newer side when both changed, and only the changing side when one did
  const pa = SYNC.mergeProf(prof({ avatar: F1 + ":0", title: "cup" }), prof({ avatar: "", title: "" }), prof({ avatar: F0 + ":1", title: "" }), true);
  check(pa.avatar === F1 + ":0" && pa.title === "cup", "picture/title: both changed -> the newer side");
  const pb = SYNC.mergeProf(prof({ avatar: "", title: "" }), prof({ avatar: "", title: "" }), prof({ avatar: F0 + ":1", title: "centurion" }), false);
  check(pb.avatar === F0 + ":1" && pb.title === "centurion", "picture/title: only the other device changed them -> theirs");
  const pc = SYNC.mergeProf(prof({ avatar: "", title: "" }), prof({ avatar: F0 + ":1", title: "cup" }), prof({ avatar: F0 + ":1", title: "cup" }), true);
  check(pc.avatar === "" && pc.title === "", "picture/title: cleared on this device -> stays cleared");
  // ----- Daily Potato: { d last day tried, r result (-1 = started, not finished), s streak, w last day that kept it, b best }
  const dy = (d, r, s, w, b) => ({ d, r, s, w, b });
  const dok = SYNC.sanitize({ daily: dy("2026-10-14", 1, 3, "2026-10-14", 5) }, FIGHTERS);
  check(eq(dok.daily, dy("2026-10-14", 1, 3, "2026-10-14", 5)) && eq(SYNC.sanitize(dok, FIGHTERS), dok), "daily: a good record passes, cleaning twice changes nothing");
  const dbad = SYNC.sanitize({ daily: { d: "2026-13-01", r: 1, s: -2, w: "yesterday", b: 1e9 } }, FIGHTERS).daily;
  check(eq(dbad, dy("", 0, 0, "", 1e6)), "daily: a bad date is dropped (no day = nothing tried), numbers are clamped");
  const dodd = SYNC.sanitize({ daily: { d: "2026-10-14", r: 7, s: 4.6, w: "2026-10-13", b: 2 } }, FIGHTERS).daily;
  check(eq(dodd, dy("2026-10-14", -1, 5, "2026-10-13", 5)), "daily: an unknown result counts as started (-1), the best is never below the streak");
  check(!("daily" in SYNC.sanitize({ daily: 5 }, FIGHTERS)) && !("daily" in SYNC.sanitize({ daily: [1] }, FIGHTERS)) && !("daily" in o1), "daily: not an object, or not there (an older page), counts as missing");
  const dB = prof({ daily: dy("2026-10-13", 1, 2, "2026-10-13", 4) });
  const dL = prof({ daily: dy("2026-10-14", 1, 3, "2026-10-14", 4) }), dS = prof({ daily: dy("2026-10-15", 0, 0, "2026-10-14", 4) });
  check(eq(SYNC.mergeProf(dL, dB, oldPage(dB), false).daily, dL.daily) && eq(SYNC.mergeProf(dL, dB, SYNC.sanitize(oldPage(dB), FIGHTERS), true).daily, dL.daily), "daily: the server copy has none (older page) -> this device's stays");
  check(eq(SYNC.mergeProf(SYNC.sanitize(oldPage(dB), FIGHTERS), oldPage(dB), dS, true).daily, dS.daily), "daily: this device has none -> the server's is kept");
  check(eq(SYNC.mergeProf(dB, dB, dS, true).daily, dS.daily) && eq(SYNC.mergeProf(dL, dB, dB, false).daily, dL.daily), "daily: only one side changed it -> that side");
  check(eq(SYNC.mergeProf(dL, dB, dS, true).daily, dS.daily) && eq(SYNC.mergeProf(dS, dB, dL, true).daily, dS.daily), "daily: both changed -> the later day wins, whichever side is newer");
  const run = prof({ daily: dy("2026-10-14", -1, 0, "2026-10-13", 4) }), fin = prof({ daily: dy("2026-10-14", 1, 3, "2026-10-14", 3) });
  check(eq(SYNC.mergeProf(run, dB, fin, true).daily, dy("2026-10-14", 1, 3, "2026-10-14", 4)) && eq(SYNC.mergeProf(fin, dB, run, false).daily, dy("2026-10-14", 1, 3, "2026-10-14", 4)), "daily: same day -> a finished try beats one still running (-1); the best keeps the higher (4)");
  const lost = prof({ daily: dy("2026-10-14", 0, 0, "2026-10-13", 6) });
  check(eq(SYNC.mergeProf(lost, dB, fin, true).daily, dy("2026-10-14", 0, 0, "2026-10-13", 6)) && eq(SYNC.mergeProf(lost, dB, fin, false).daily, dy("2026-10-14", 1, 3, "2026-10-14", 6)), "daily: same day, both finished -> the newer side, best = max");
  check(eq(SYNC.mergeProf(prof({ daily: dy("2026-10-14", 1, 1, "2026-10-14", 1) }), null, prof({ daily: dy("2026-10-12", 1, 9, "2026-10-12", 9) }), false).daily, dy("2026-10-14", 1, 1, "2026-10-14", 9)), "daily: no base copy -> both count as changed");
  const dev2 = { tokens: 1, owned: {}, pal: {}, daily: dy("2026-10-14", 1, 2, "2026-10-14", 2) };
  SYNC.applyTo(dev2, o1);
  check(eq(dev2.daily, dy("2026-10-14", 1, 2, "2026-10-14", 2)), "daily apply: a prof without it leaves this device's record");
  SYNC.applyTo(dev2, dS);
  check(eq(dev2.daily, dS.daily) && dev2.daily !== dS.daily, "daily apply: a prof with it replaces it (a copy)");
  // Another go (ui/daily.js): p = the streak before today's first try (kept while the go is open), x = 1 once it was taken. Both are left out while not set.
  const dpx = SYNC.sanitize({ daily: { d: "2026-10-14", r: 0, s: 0, w: "2026-10-13", b: 5, p: 4, x: 1 } }, FIGHTERS).daily;
  check(eq(dpx, { d: "2026-10-14", r: 0, s: 0, w: "2026-10-13", b: 5, p: 4, x: 1 }) && eq(SYNC.sanitize({ daily: dpx }, FIGHTERS).daily, dpx), "another go: p and x pass, cleaning twice changes nothing");
  check(eq(dok.daily, dy("2026-10-14", 1, 3, "2026-10-14", 5)) && !("p" in dok.daily) && !("x" in dok.daily), "another go: a record without them stays as it is (no p, no x invented)");
  const dpj = SYNC.sanitize({ daily: { d: "2026-10-14", r: 0, s: 0, w: "", b: 0, p: "3", x: 2 } }, FIGHTERS).daily;
  check(eq(dpj, dy("2026-10-14", 0, 0, "", 0)), "another go: a p that is not a number and an x that is not 1 are dropped");
  const dpc = SYNC.sanitize({ daily: { d: "2026-10-14", r: 0.5, s: 2, w: "2026-10-14", b: 2, p: -7.4, x: true } }, FIGHTERS).daily, dpb = SYNC.sanitize({ daily: { d: "2026-10-14", r: 0, s: 0, w: "", b: 0, p: 1e12 } }, FIGHTERS).daily;
  check(dpc.p === 0 && dpc.x === 1 && dpb.p === 1e6, "another go: p is clamped to 0 - 1,000,000, x = true counts as 1");
  check(!("p" in SYNC.sanitize({ daily: { d: "bad", r: 0, s: 0, p: 3, x: 1 } }, FIGHTERS).daily) && !("x" in SYNC.sanitize({ daily: { d: "bad", x: 1 } }, FIGHTERS).daily), "another go: a record with no valid day carries no p or x");
  const gB = prof({ daily: { d: "2026-10-14", r: 0, s: 0, w: "2026-10-13", b: 4, p: 3 } });                       // lost the first try; Another go open
  const gL = prof({ daily: { d: "2026-10-14", r: 1, s: 4, w: "2026-10-14", b: 4, x: 1 } });                       // this device took it and won
  const gS = prof({ daily: { d: "2026-10-14", r: 0, s: 0, w: "2026-10-13", b: 4, x: 1 } });                       // the server's copy: taken on another device, lost again
  check(eq(SYNC.mergeProf(gL, gB, gB, true).daily, gL.daily) && eq(SYNC.mergeProf(gB, gB, gL, false).daily, gL.daily), "another go: only one side took it -> that side's record (x and the streak it made)");
  check(eq(SYNC.mergeProf(gL, gB, gS, true).daily, gL.daily) && eq(SYNC.mergeProf(gL, gB, gS, false).daily, gS.daily), "another go: both took it (a race of two devices) -> the newer side, never a mix of the two");
  const gRun = prof({ daily: { d: "2026-10-14", r: -1, s: 0, w: "2026-10-13", b: 4, x: 1 } });                     // taken here, still playing
  const gFin = prof({ daily: { d: "2026-10-14", r: 0, s: 0, w: "2026-10-13", b: 4, p: 3 } });                      // the other device only finished the first try
  check(eq(SYNC.mergeProf(gRun, dB, gFin, true).daily, gRun.daily) && eq(SYNC.mergeProf(gFin, dB, gRun, false).daily, gRun.daily) && eq(SYNC.mergeProf(gRun, dB, gFin, false).daily, gRun.daily) && eq(SYNC.mergeProf(gFin, dB, gRun, true).daily, gRun.daily), "another go: same day, one side took it (still running) and the other only has the first result -> the one that took it, so it cannot be taken twice");
  const gOld = SYNC.sanitize(oldPage(gB), FIGHTERS);
  check(eq(SYNC.mergeProf(gL, gB, gOld, true).daily, gL.daily) && eq(SYNC.mergeProf(gOld, gB, gL, false).daily, gL.daily), "another go: an older page's prof has no daily at all -> the other side's record, x included");
  const dev5 = { tokens: 1, owned: {}, pal: {}, daily: { d: "2026-10-14", r: 0, s: 0, w: "2026-10-13", b: 4, p: 3 } };
  SYNC.applyTo(dev5, gL);
  check(eq(dev5.daily, gL.daily) && dev5.daily.x === 1 && !("p" in dev5.daily), "another go apply: a record with x replaces one with p (a copy; p is gone with it)");
  // combo routes (ui/combos.js): a set of route ids, merged as a union; the 30 chips for all of them stay paid once paid anywhere
  const rc = SYNC.sanitize({ routes: ["sig", "three", "sig", "Bad!", 7, "lift"], comboPaid: true }, FIGHTERS);
  check(eq(rc.routes, ["lift", "sig", "three"]) && rc.comboPaid === true && eq(SYNC.sanitize(rc, FIGHTERS), rc), "routes: cleaned to a sorted set of ids, cleaning twice changes nothing");
  check(!("routes" in o1) && !("comboPaid" in o1) && !("routes" in SYNC.sanitize({ routes: "sig" }, FIGHTERS)), "routes: not a list, or not there (an older page), counts as missing");
  const rB = prof({ routes: ["three"], comboPaid: false }), rL = prof({ routes: ["three", "sig"], comboPaid: false }), rS = prof({ routes: ["lift", "three"], comboPaid: true });
  const rm = SYNC.mergeProf(rL, rB, rS, false);
  check(eq(rm.routes, ["lift", "sig", "three"]) && rm.comboPaid === true, "routes: two devices -> every route either cleared; paid on one = paid");
  check(eq(SYNC.mergeProf(rL, rB, o1, true).routes, rL.routes) && eq(SYNC.mergeProf(SYNC.sanitize(oldPage(fb), FIGHTERS), fb, rS, true).routes, rS.routes), "routes: one side has none (an older page) -> the other side's stay");
  const dev3 = { tokens: 1, owned: {}, pal: {}, routes: ["sig"], comboPaid: false };
  SYNC.applyTo(dev3, o1);
  check(eq(dev3.routes, ["sig"]) && dev3.comboPaid === false, "routes apply: a prof without them leaves this device's");
  SYNC.applyTo(dev3, rm);
  check(eq(dev3.routes, rm.routes) && dev3.routes !== rm.routes && dev3.comboPaid === true, "routes apply: a prof with them replaces them (a copy)");
  // fighter mastery (ui/mastery.js): XP played adds up across devices, the head start and the paid level take the higher value, pages are a union
  const mc = SYNC.sanitize({ mxp: { [F0]: 120, [F1]: 0, "Bad Id": 5, x: -3, odin: 40.4 }, mseed: { [F0]: 9999, odin: 30, zero: 0 }, mpaid: { [F0]: 12, odin: 3 }, pages: { ko: [F1, F0, F1, "Bad!", 7], ult: "x" } }, FIGHTERS);
  check(eq(mc.mxp, { [F0]: 120, odin: 40 }) && eq(mc.mseed, { [F0]: 650, odin: 30 }) && eq(mc.mpaid, { [F0]: 10, odin: 3 }), "mastery: sanitize drops bad ids, zero and negative rows, caps the head start (650) and the level (10)");
  check(eq(mc.pages, { ko: [F0, F1].sort(), ult: [] }) && eq(SYNC.sanitize(mc, FIGHTERS), mc), "mastery: pages are cleaned to sorted unique ids; a bad list is empty; cleaning twice changes nothing");
  check(!("mxp" in o1) && !("mseed" in o1) && !("mpaid" in o1) && !("pages" in o1) && !("mxp" in SYNC.sanitize({ mxp: 5 }, FIGHTERS)) && eq(SYNC.sanitize({ mseed: {} }, FIGHTERS).mseed, {}), "mastery: not there (an older page) counts as missing; an empty head start is kept (given, nothing to count)");
  const xB = prof({ mxp: { [F0]: 100 }, mseed: { [F0]: 200 }, mpaid: { [F0]: 2 }, pages: { ko: [F0], ult: [] } });
  const xL = prof({ mxp: { [F0]: 160, [F1]: 30 }, mseed: { [F0]: 200 }, mpaid: { [F0]: 3 }, pages: { ko: [F0, F1], ult: [F0] } });         // this device: +60 XP with F0, 30 with F1, paid level 3
  const xS = prof({ mxp: { [F0]: 140 }, mseed: { [F0]: 200, [F1]: 90 }, mpaid: { [F0]: 4 }, pages: { ko: [F0], ult: [F1] } });             // the server: the other device played +40 with F0, paid level 4
  const xm = SYNC.mergeProf(xL, xB, xS, true);
  check(eq(xm.mxp, { [F0]: 200, [F1]: 30 }), "mastery merge: XP played adds what each device played since the last sync (100 +60 +40)");
  check(eq(xm.mseed, { [F0]: 200, [F1]: 90 }), "mastery merge: the head start takes the higher value per fighter (two devices that seeded from one record do not add)");
  check(eq(xm.mpaid, { [F0]: 4 }) && eq(xm.pages, { ko: [F0, F1].sort(), ult: [F0, F1].sort() }), "mastery merge: the paid level is the higher one; KO pages and Ultimate KO pages are a union");
  const xm2 = SYNC.mergeProf(xL, null, xS, false);
  check(xm2.mxp[F0] === 300 && xm2.mxp[F1] === 30, "mastery merge: no base copy counts the base as zero");
  const noMx = (p) => { const o = Object.assign({}, p); for (const k of ["mxp", "mseed", "mpaid", "pages"]) delete o[k]; return o; };
  const xOld = SYNC.sanitize(noMx(xL), FIGHTERS);
  const xk = SYNC.mergeProf(xL, xB, xOld, true), xk2 = SYNC.mergeProf(xOld, xB, xS, false);
  check(eq(xk.mxp, xL.mxp) && eq(xk.mseed, xL.mseed) && eq(xk.mpaid, xL.mpaid) && eq(xk.pages, xL.pages), "mastery merge: the server copy has none of it (an older page) -> this device's values stay");
  check(eq(xk2.mxp, xS.mxp) && eq(xk2.mseed, xS.mseed) && eq(xk2.mpaid, xS.mpaid) && eq(xk2.pages, xS.pages), "mastery merge: this side has none of it (an older page) -> the server's values are taken");
  const xDev = { tokens: 1, owned: {}, pal: {}, mxp: { [F0]: 5 }, mseed: { [F0]: 6 }, mpaid: { [F0]: 2 }, pages: { ko: [F0], ult: [] } };
  SYNC.applyTo(xDev, o1);
  check(eq(xDev.mxp, { [F0]: 5 }) && eq(xDev.mseed, { [F0]: 6 }) && eq(xDev.mpaid, { [F0]: 2 }) && eq(xDev.pages, { ko: [F0], ult: [] }), "mastery apply: a prof without the fields leaves this device's");
  SYNC.applyTo(xDev, xm);
  check(eq(xDev.mxp, xm.mxp) && xDev.mxp !== xm.mxp && eq(xDev.mseed, xm.mseed) && eq(xDev.mpaid, xm.mpaid) && eq(xDev.pages, xm.pages) && xDev.pages !== xm.pages && xDev.pages.ko !== xm.pages.ko, "mastery apply: a prof with them replaces them (copies)");
  // the Road (ui/road.js): stars per stop and boss levels as bits, merged as a union; the first boss win's reward stays paid
  const rd = SYNC.sanitize({ road: { s: [7, 3.2, 9, -1, 0, 0], b: 12, paid: "yes" } }, FIGHTERS).road;
  check(eq(rd, { s: [7, 3, 7], b: 7, paid: false }) && eq(SYNC.sanitize({ road: rd }, FIGHTERS).road, rd), "road: bits clamped to 0-7, trailing empty stops dropped, paid only when true; cleaning twice changes nothing");
  check(!("road" in o1) && !("road" in SYNC.sanitize({ road: [1, 2] }, FIGHTERS)), "road: not an object, or not there (an older page), counts as missing");
  const qB = prof({ road: { s: [1], b: 0, paid: false } }), qL = prof({ road: { s: [3, 1], b: 0, paid: false } }), qS = prof({ road: { s: [5, 0, 1], b: 1, paid: true } });
  check(eq(SYNC.mergeProf(qL, qB, qS, false).road, { s: [7, 1, 1], b: 1, paid: true }), "road: two devices -> every star either won, boss levels either won, paid on one = paid");
  check(eq(SYNC.mergeProf(qL, qB, o1, true).road, qL.road) && eq(SYNC.mergeProf(SYNC.sanitize(oldPage(fb), FIGHTERS), fb, qS, true).road, qS.road), "road: one side has none (an older page) -> the other side's stays");
  const dev4 = { tokens: 1, owned: {}, pal: {}, road: { s: [1], b: 0, paid: false } };
  SYNC.applyTo(dev4, o1);
  check(eq(dev4.road, { s: [1], b: 0, paid: false }), "road apply: a prof without it leaves this device's");
  SYNC.applyTo(dev4, qS);
  check(eq(dev4.road, qS.road) && dev4.road.s !== qS.road.s, "road apply: a prof with it replaces it (a copy)");
  check(SYNC.hasProgress({ road: { s: [0, 1] } }) && !SYNC.hasProgress({ road: { s: [0] } }), "road: a star counts as progress worth asking about");
  // regions 2 and 3 (Zorp, Kraken Spud): their boss bits and first-win flags b2/p2, b3/p3, only there when set (an older page has none)
  const r2 = SYNC.sanitize({ road: { s: [7], b: 1, paid: true, b2: 9, p2: 1, b3: 0, p3: false } }, FIGHTERS).road;
  check(eq(r2, { s: [7], b: 1, paid: true, b2: 7 }), "road regions: b2/b3 clamped to 0-7 and dropped at 0, p2/p3 only when true");
  const qR = prof({ road: { s: [1], b: 1, paid: true, b2: 2, p2: true } }), qT = prof({ road: { s: [1], b: 1, paid: true, b2: 1, b3: 4, p3: true } });
  check(eq(SYNC.mergeProf(qR, prof({ road: { s: [1], b: 1, paid: true } }), qT, false).road, { s: [1], b: 1, paid: true, b2: 3, p2: true, b3: 4, p3: true }), "road regions: two devices -> each region's boss levels and paid flags merge as a union");
  check(eq(SYNC.mergeProf(qR, qR, prof({ road: { s: [1], b: 1, paid: true } }), false).road, qR.road), "road regions: an older page without b2 keeps this device's b2");
  check(SYNC.hasProgress({ mxp: { odin: 30 } }) && !SYNC.hasProgress({ mxp: { odin: 0 } }), "mastery: XP from Practice counts as progress worth asking about");
  // the Shop (ui/shop.js): skins glazed per fighter, nameplates owned, the plate worn. Added later: a missing field means "not known", never empty.
  const FG = FIGHTERS.find((f) => f.id === "phoenix"), nFG = FG.palettes.length;
  const gz = SYNC.sanitize({ glazed: { phoenix: [3, 1, 3, 9, -1, 1.5, "a", nFG], odin: [], samurai: [0], "Bad Id": [1], "__proto__": [1], mystery: [2, 15, 16] }, plates: ["sunset", "mint", "sunset", "Bad!", 7, "x".repeat(20), "gold_leaf"], plate: "mint" }, FIGHTERS);
  check(eq(gz.glazed, { mystery: [2, 15], phoenix: [1, 3], samurai: [0] }), "glazed: whole skin numbers in range (this copy's skin count; 16 for a fighter it does not know), sorted, unique; an empty fighter and odd ids are left out");
  check(!Object.prototype.hasOwnProperty.call(gz.glazed, "__proto__") && Object.getPrototypeOf(gz.glazed) === Object.prototype, "glazed: no __proto__ key");
  check(eq(gz.plates, ["gold_leaf", "mint", "sunset"]) && gz.plate === "mint", "plates: a sorted set of well formed ids; the plate worn is kept");
  check(eq(SYNC.sanitize(gz, FIGHTERS), gz), "glazed / plates / plate: cleaning twice changes nothing");
  const gj = SYNC.sanitize({ glazed: { phoenix: "x" }, plates: ["Bad!"], plate: "Not A Plate!" }, FIGHTERS);
  check(eq(gj.glazed, {}) && eq(gj.plates, []) && gj.plate === "", "shop junk: a bad glaze list is empty, bad plate ids are dropped, a bad worn plate becomes Ink (empty)");
  const gn = SYNC.sanitize({ glazed: [1], plates: "sunset", plate: 5 }, FIGHTERS);
  check(!("glazed" in gn) && !("plates" in gn) && !("plate" in gn), "shop: not an object / not a list / not text counts as missing");
  const noShop = (x) => { const o = Object.assign({}, x); for (const k of ["glazed", "plates", "plate"]) delete o[k]; return o; };
  const sOld = SYNC.sanitize(noShop(gz), FIGHTERS);
  check(!("glazed" in sOld) && !("plates" in sOld) && !("plate" in sOld) && !("glazed" in prof({})) && !("plates" in prof({})), "shop: a prof from an older page has none of them (sanitize invents nothing)");
  const sB = prof({ glazed: { phoenix: [1] }, plates: ["sunset"], plate: "sunset" });
  const sL = prof({ glazed: { phoenix: [1, 3], odin: [2] }, plates: ["mint", "sunset"], plate: "mint" });         // this device: glazed two more, bought Mint and wore it
  const sS = prof({ glazed: { phoenix: [1, 2], dragon: [1] }, plates: ["goldleaf", "sunset"], plate: "goldleaf" }); // the other device: another glaze, Gold Leaf worn
  const sm = SYNC.mergeProf(sL, sB, sS, true);
  check(eq(sm.glazed, { dragon: [1], odin: [2], phoenix: [1, 2, 3] }) && eq(sm.plates, ["goldleaf", "mint", "sunset"]), "shop merge: glazed skins and plates owned are a union of both devices");
  check(sm.plate === "mint" && SYNC.mergeProf(sL, sB, sS, false).plate === "goldleaf", "shop merge: both changed the plate worn -> the newer side");
  const sm2 = SYNC.mergeProf(sB, sB, sS, true);
  check(sm2.plate === "goldleaf" && eq(sm2.plates, sS.plates) && SYNC.mergeProf(sL, sB, sB, false).plate === "mint", "shop merge: only one side changed the plate -> that side");
  check(SYNC.mergeProf(prof({ plate: "" }), sB, prof({ plate: "sunset", plates: ["sunset"] }), false).plate === "", "shop merge: back to Ink on this device -> stays Ink");
  const sk1 = SYNC.mergeProf(sL, sB, sOld, true), sk2 = SYNC.mergeProf(sOld, sB, sS, false), sk3 = SYNC.mergeProf(sL, sB, sOld, false);
  check(eq(sk1.glazed, sL.glazed) && eq(sk1.plates, sL.plates) && sk1.plate === "mint" && sk3.plate === "mint", "shop merge: the server copy has none (an older page) -> this device's glazes, plates and worn plate stay");
  check(eq(sk2.glazed, sS.glazed) && eq(sk2.plates, sS.plates) && sk2.plate === "goldleaf", "shop merge: this side has none (an older page) -> the server's are kept");
  const sNone = SYNC.mergeProf(sOld, sOld, sOld, true);
  check(!("glazed" in sNone) && !("plates" in sNone) && !("plate" in sNone), "shop merge: neither side has them -> the result has none");
  check(eq(SYNC.mergeProf(sm, sm, sm, true), sm), "shop merge: nothing changed anywhere -> the same copy");
  const sDev = { tokens: 1, owned: {}, pal: {}, glazed: { phoenix: [0] }, plates: ["sunset"], plate: "sunset" };
  SYNC.applyTo(sDev, sOld);
  check(eq(sDev.glazed, { phoenix: [0] }) && eq(sDev.plates, ["sunset"]) && sDev.plate === "sunset", "shop apply: a prof without the fields leaves this device's");
  SYNC.applyTo(sDev, sm);
  check(eq(sDev.glazed, sm.glazed) && sDev.glazed !== sm.glazed && sDev.glazed.phoenix !== sm.glazed.phoenix && eq(sDev.plates, sm.plates) && sDev.plates !== sm.plates && sDev.plate === "mint", "shop apply: a prof with them replaces them (copies)");
  check(SYNC.hasProgress({ plates: ["sunset"] }) && SYNC.hasProgress({ glazed: { odin: [1] } }) && !SYNC.hasProgress({ plates: [], glazed: { odin: [] }, plate: "" }), "shop: a plate bought or a skin glazed counts as progress worth asking about");
  const hist = Array.from({ length: 60 }, (_, i) => ({ r: 1, d: i, me: F0, op: F1, opr: 1000, t: i + 1 }));
  check(SYNC.sanitize({ history: hist }, FIGHTERS).history.length === 50, "sanitize: the match history keeps 50");
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
