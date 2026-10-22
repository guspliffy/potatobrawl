#!/usr/bin/env node
"use strict";
/*
 * Pommes support tool, for Jonny on the server (pommes.js keeps the wallets). Run as the game's user, so the files stay the game's:
 *
 *   sudo -u potatobrawl node /opt/potatobrawl/tools/pommes.js show  <code or account>
 *   sudo -u potatobrawl node /opt/potatobrawl/tools/pommes.js grant <code or account> <n> [why ...]     n < 0 takes Pommes back (a refund)
 *   sudo -u potatobrawl node /opt/potatobrawl/tools/pommes.js move  <old code or account> <new code or account> [why ...]
 *
 * <code>: a sync code (XXXX-XXXX-XXXX-XXXX); <account>: an account file's 64-letter name (the ledger and a payment name it, never the code).
 * show reads the files directly. grant and move are applied by the running game (they go into <accounts>/pommes-in/ and the server
 * answers within a couple of seconds), so they never race a phone's save; if the game isn't running they wait there until it starts.
 * ACCOUNTS_DIR: the accounts folder (default /var/lib/potatobrawl/accounts, the live server's).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { normCode, hashOf } = require("../accounts.js");

const DIR = process.env.ACCOUNTS_DIR || "/var/lib/potatobrawl/accounts";
const SPOOL = path.join(DIR, "pommes-in");
const WAIT_MS = +process.env.PM_WAIT_MS || 10000;
const [cmd, ...rest] = process.argv.slice(2);
const die = (msg) => { console.error(msg); process.exit(1); };
const usage = () => die("usage: pommes.js show <code|account> | grant <code|account> <n> [why] | move <old code|account> <new code|account> [why]");

// a code or a file name -> the account file ("<hash>.json"), which must exist
function fileOf(s) {
  if (typeof s !== "string") usage();
  const h = /^[0-9a-f]{64}(\.json)?$/i.test(s) ? s.slice(0, 64).toLowerCase() : normCode(s) ? hashOf(normCode(s)) : "";
  if (!h) die(`"${s}" is neither a sync code nor an account's 64-letter name`);
  if (!fs.existsSync(path.join(DIR, h + ".json"))) die(`no account ${h.slice(0, 8)}… in ${DIR}`);
  return h + ".json";
}
const readPm = (file) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")).pm || null; } catch (e) { return die(`can't read ${file}: ${e.message}`); } };

function show(file) {
  const pm = readPm(file) || { bal: 0, own: [], log: [] };
  console.log(`account ${file.slice(0, 64)}`);
  console.log(`Pommes: ${pm.bal | 0}   owns: ${(pm.own || []).join(", ") || "nothing"}`);
  let rows = [];
  try { rows = fs.readFileSync(path.join(DIR, "pommes.log"), "utf8").split("\n").filter((l) => l.includes(file.slice(0, 64))); } catch (e) { /* no ledger yet */ }
  console.log(rows.length ? `ledger (${rows.length} lines, last 20):` : "ledger: no lines for this account");
  for (const l of rows.slice(-20)) { try { const r = JSON.parse(l); console.log(`  ${new Date(r.t).toISOString()}  ${r.d > 0 ? "+" : ""}${r.d}  -> ${r.b}  ${r.w}${r.it ? "  " + r.it : ""}`); } catch (e) { /* a broken line */ } }
}

// hand a request to the running game and wait for its answer
function ask(q) {
  try { fs.mkdirSync(SPOOL, { recursive: true, mode: 0o700 }); } catch (e) { die(`can't make ${SPOOL}: ${e.message}`); }
  const name = Date.now().toString(36) + "-" + crypto.randomBytes(6).toString("hex"), tmp = path.join(SPOOL, name + ".tmp"), req = path.join(SPOOL, name + ".json"), done = path.join(SPOOL, name + ".done");
  fs.writeFileSync(tmp, JSON.stringify(q), { mode: 0o600 });
  fs.renameSync(tmp, req);   // whole or not at all
  const t0 = Date.now();
  (function wait() {
    if (fs.existsSync(done)) {
      let r = null;
      try { r = JSON.parse(fs.readFileSync(done, "utf8")); } catch (e) { return setTimeout(wait, 100); }
      try { fs.unlinkSync(done); } catch (e) { /* fine */ }
      if (!r.ok) die(`not done: ${r.why}`);
      console.log(`done. Pommes now: ${r.bal}   owns: ${(r.own || []).join(", ") || "nothing"}`);
      return;
    }
    if (Date.now() - t0 > WAIT_MS) {
      console.log(`The game hasn't picked the request up within ${WAIT_MS / 1000} s. Is it running (systemctl status potatobrawl)? ` +
        `It stays in ${SPOOL} and is applied once the game runs; check with "show" later.`);
      process.exit(2);
    }
    setTimeout(wait, 100);
  })();
}

if (cmd === "show" && rest.length === 1) show(fileOf(rest[0]));
else if (cmd === "grant" && rest.length >= 2) {
  const n = Number(rest[1]);
  if (!Number.isSafeInteger(n) || n === 0) die("n must be a whole number other than 0 (negative takes Pommes back)");
  ask({ op: "grant", file: fileOf(rest[0]), n, why: rest.slice(2).join(" ") });
} else if (cmd === "move" && rest.length >= 2) ask({ op: "move", from: fileOf(rest[0]), to: fileOf(rest[1]), why: rest.slice(2).join(" ") });
else usage();
