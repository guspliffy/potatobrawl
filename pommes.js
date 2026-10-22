"use strict";
/*
 * PotatoBrawl Pommes: the wallet of the premium currency (step 8). Used by server.js and tools/pommes.js. Node's own fs/path/crypto only.
 *
 * Pommes live only on the server: the account file's `pm` part { bal, own: [item ids], log: [the last 20 changes], ad: {d, n} }, written by nothing
 * but this file (accounts.js writePm; a phone's save keeps it as it is). Every change is also one JSON line in <accounts>/pommes.log
 * (time, account file, change, balance after, item, why), the ledger for support: a player who lost the code is found by the payment
 * and `node tools/pommes.js move` puts the Pommes on the new code. What Pommes buy is the price table ITEMS, per fighter: the Potatalities
 * "ko:<fighter id>" and "ko2:<fighter id>" (alternate KO pages 1 and 2) and the Pommes skins "sk1:<fighter id>" and "sk2:<fighter id>"
 * (lines 1 and 2). Chips are never sold for Pommes, and Pommes are never paid out, traded or staked.
 * Ads: a watched ad pays AD_PAY Pommes, at most AD_MAX a (UTC) day and one per AD_GAP per account; `ad` {d: "YYYY-MM-DD", n: ads paid
 * that day}. The server can't see the ad, so the cap is the guard. Off unless init's `ads` (server.js: PM_ADS=1).
 *
 * Messages, on the Quick match connection, signed in with the sync code (quick.js `auth`; net-ws.js passes pm-* to the page's listeners):
 *   {t: "pm"}                         -> {t: "pm-st", bal, own, items, ads, adN, adMax, buy, price}
 *   {t: "pmb", item: "<an ITEMS id>"} -> {t: "pm-ok", bal, own, items, ads, adN, adMax, item}
 *                                        or {t: "pm-no", why: "acct" | "bad" | "own" | "short" | "fail", bal?}
 *   {t: "pma"} (the page's ad said "viewed") -> {t: "pm-ad", bal, items, own, adN, adMax}
 *                                        or {t: "pm-no", why: "acct" | "ads" (off) | "max" (AD_MAX today) | "wait" (+ in: seconds) | "fail", bal?}
 * own: the fighter ids of the "ko:" pages owned (as older pages read it); items: every item id owned, in buying order; ads: the ad switch;
 * adN: ads paid today (UTC). The last paid ad's time (for AD_GAP) is kept in memory only: a restart forgets it.
 * buy: Pommes can be bought with money here. False until the payment step exists (PR 2: the provider's keys in the server's settings);
 * until then Pommes only come from tools/pommes.js (Jonny's own tests, support).
 *
 * tools/pommes.js runs as a separate process while the server runs, so it never writes an account file itself (the server's next write
 * would undo it): it drops a request into <accounts>/pommes-in/ and the server applies it within a couple of seconds, answering in a
 * .done file next to it. Requests: {op: "grant", file, n, why} (n may be negative: a refund takes Pommes back, the balance can go below 0
 * and then buys nothing) and {op: "move", from, to, why} (everything from one account to another, the old one emptied).
 */
const fs = require("fs");
const path = require("path");

const FIGHTER_IDS = ["dragon", "phoenix", "wizard", "alchemist", "odin", "samurai", "gunslinger", "reaper"];
const KO_PRICE = 300;
const ITEMS = Object.fromEntries(FIGHTER_IDS.flatMap((id) => ["ko:", "ko2:", "sk1:", "sk2:"].map((k) => [k + id, KO_PRICE])));
const AD_PAY = 10, AD_MAX = 5, AD_GAP = 30000;   // Pommes per watched ad, ads paid per UTC day, ms between two paid ads of an account
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOG_KEEP = 20;          // changes kept in the account file (all of them are in the ledger)
const MAX_GRANT = 100000;     // one request moves at most this many Pommes either way
const FILE_RE = /^[0-9a-f]{64}\.json$/;
const REQ_RE = /^[0-9a-z_-]{6,64}\.json$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const idOf = (file) => file.slice(0, 64);   // an account in the ledger: its file's hash (never a code)

// a stored part as it may be trusted: unknown items and broken entries dropped
function cleanPm(pm) {
  const p = isObj(pm) ? pm : {};
  return Object.assign({
    bal: Number.isSafeInteger(p.bal) ? p.bal : 0,
    own: Array.isArray(p.own) ? [...new Set(p.own.filter((it) => typeof it === "string" && Object.prototype.hasOwnProperty.call(ITEMS, it)))] : [],
    log: Array.isArray(p.log) ? p.log.filter(isObj).slice(-LOG_KEEP) : [],
  }, isObj(p.ad) && typeof p.ad.d === "string" && DAY_RE.test(p.ad.d) && Number.isInteger(p.ad.n) && p.ad.n >= 0 && p.ad.n <= AD_MAX
    ? { ad: { d: p.ad.d, n: p.ad.n } } : {});
}
const koOwn = (pm) => pm.own.filter((it) => it.slice(0, 3) === "ko:").map((it) => it.slice(3));

/*
 * opts: { accounts (accounts.js instance), seatOf(peer) -> {file, id} | null (quick.js auth), send(peer, msg), log,
 *         buy (PR 2: money can buy Pommes), ads (watched ads pay), now() (the clock for the ads' day and gap; tests: another),
 *         spoolMs (how often the requests folder is read; tests: shorter) }
 */
function init(opts) {
  const o = Object.assign({ log: console, buy: false, ads: false, now: Date.now, spoolMs: 2000 }, opts);
  const acct = o.accounts;
  if (!acct) return null;
  const LEDGER = path.join(acct.dir, "pommes.log"), SPOOL = path.join(acct.dir, "pommes-in");
  const S = { asks: 0, buys: 0, refused: 0, granted: 0, moved: 0, ads: 0 };
  const lastAsk = new Map();   // peer -> { t, n }
  const lastAd = new Map();    // account file -> o.now() of its last paid ad (memory only)
  const today = () => new Date(o.now()).toISOString().slice(0, 10);
  const adN = (pm) => (pm.ad && pm.ad.d === today() ? pm.ad.n : 0);
  const send = (peer, msg) => { try { o.send(peer, msg); } catch (e) { /* the peer is gone */ } };

  // one change: the account's part and the ledger. false when the account is gone or the disk refused (nothing changed then).
  // edit(pm): more to change in the same write (an ad's count)
  function change(file, d, item, why, edit) {
    const rec = acct.readFile(file);
    if (!rec) return null;
    const pm = cleanPm(rec.pm), t = Date.now();
    pm.bal += d;
    if (item && !pm.own.includes(item)) pm.own.push(item);
    if (edit) edit(pm);
    pm.log.push(Object.assign({ t, d, b: pm.bal, w: why }, item ? { it: item } : {}));
    pm.log = pm.log.slice(-LOG_KEEP);
    try { if (!acct.writePm(file, pm)) return null; }
    catch (e) { o.log.warn("pommes: can't write", e.message); return null; }
    ledger(Object.assign({ t, f: idOf(file), d, b: pm.bal, w: why }, item ? { it: item } : {}));
    return pm;
  }
  function ledger(row) {
    try { fs.appendFileSync(LEDGER, JSON.stringify(row) + "\n", { mode: 0o600 }); }
    catch (e) { o.log.warn("pommes: can't write the ledger,", e.message, JSON.stringify(row)); }
  }
  const state = (pm) => ({ bal: pm.bal, own: koOwn(pm), items: pm.own.slice(), ads: !!o.ads, adN: adN(pm), adMax: AD_MAX });

  function handle(peer, m) {
    if (m.t !== "pm" && m.t !== "pmb" && m.t !== "pma") return false;
    const now = Date.now(), w = lastAsk.get(peer);   // 6 per 2 seconds per connection
    if (!w || now - w.t > 2000) lastAsk.set(peer, { t: now, n: 1 });
    else if (++w.n > 6) return true;
    const seat = o.seatOf(peer), rec = seat && acct.readFile(seat.file);
    if (!rec) { send(peer, { t: "pm-no", why: "acct" }); return true; }
    const pm = cleanPm(rec.pm);
    if (m.t === "pm") { S.asks++; send(peer, Object.assign({ t: "pm-st", buy: !!o.buy, price: KO_PRICE }, state(pm))); return true; }
    const no = (why, more) => { S.refused++; send(peer, Object.assign({ t: "pm-no", why, bal: pm.bal }, more)); return true; };
    if (m.t === "pma") return ad(peer, seat, rec, pm, no);
    const item = typeof m.item === "string" ? m.item : "", price = Object.prototype.hasOwnProperty.call(ITEMS, item) ? ITEMS[item] : 0;
    if (!price) return no("bad");
    if (pm.own.includes(item)) return no("own");
    if (pm.bal < price) return no("short");
    const after = change(seat.file, -price, item, "buy");
    if (!after) return no("fail");
    S.buys++;
    o.log.log(`pommes: ${(rec.on && rec.on.id) || seat.file.slice(0, 8)} bought ${item} for ${price}, ${after.bal} left`);
    send(peer, Object.assign({ t: "pm-ok", item }, state(after)));
    return true;
  }
  // a watched ad: AD_PAY Pommes, at most AD_MAX a day, AD_GAP apart
  function ad(peer, seat, rec, pm, no) {
    if (!o.ads) return no("ads");
    const day = today(), n = adN(pm), now = o.now(), last = lastAd.get(seat.file);
    if (n >= AD_MAX) return no("max");
    if (last !== undefined && now - last < AD_GAP) return no("wait", { in: Math.ceil((AD_GAP - (now - last)) / 1000) });
    const after = change(seat.file, AD_PAY, "", "ad", (p) => { p.ad = { d: day, n: n + 1 }; });
    if (!after) return no("fail");
    lastAd.set(seat.file, now);
    S.ads++;
    o.log.log(`pommes: ${(rec.on && rec.on.id) || seat.file.slice(0, 8)} watched an ad (${n + 1} today), ${after.bal} now`);
    const st = state(after);
    send(peer, { t: "pm-ad", bal: st.bal, items: st.items, own: st.own, adN: st.adN, adMax: st.adMax });
    return true;
  }

  /* ----- tools/pommes.js: requests in the spool folder ----- */
  function apply(q) {
    if (!isObj(q)) return { ok: false, why: "not a request" };
    const why = typeof q.why === "string" ? q.why.slice(0, 80) : "";
    if (q.op === "grant") {
      if (!FILE_RE.test(q.file || "")) return { ok: false, why: "no such account" };
      if (!Number.isSafeInteger(q.n) || q.n === 0 || Math.abs(q.n) > MAX_GRANT) return { ok: false, why: `n must be a whole number from -${MAX_GRANT} to ${MAX_GRANT}, not 0` };
      const pm = change(q.file, q.n, "", "grant" + (why ? ": " + why : ""));
      if (!pm) return { ok: false, why: "no such account (or the disk refused)" };
      S.granted++;
      o.log.log(`pommes: ${q.n > 0 ? "+" : ""}${q.n} to ${q.file.slice(0, 8)} (${why || "no reason given"}), now ${pm.bal}`);
      return { ok: true, bal: pm.bal, own: pm.own };
    }
    if (q.op === "move") {
      if (!FILE_RE.test(q.from || "") || !FILE_RE.test(q.to || "") || q.from === q.to) return { ok: false, why: "two different accounts needed" };
      const a = acct.readFile(q.from), b = acct.readFile(q.to);
      if (!a || !b) return { ok: false, why: !a ? "the old account doesn't exist" : "the new account doesn't exist" };
      const pa = cleanPm(a.pm), pb = cleanPm(b.pm), t = Date.now(), w = "move" + (why ? ": " + why : "");
      pb.bal += pa.bal; pb.own = [...new Set([...pb.own, ...pa.own])];
      pb.log.push({ t, d: pa.bal, b: pb.bal, w: w + " (in)", it: pa.own.join(",") }); pb.log = pb.log.slice(-LOG_KEEP);
      try { if (!acct.writePm(q.to, pb)) return { ok: false, why: "the new account is gone" }; }
      catch (e) { return { ok: false, why: "the disk refused: " + e.message }; }
      ledger({ t, f: idOf(q.to), d: pa.bal, b: pb.bal, w: w + " (in)", it: pa.own.join(","), from: idOf(q.from) });
      const empty = Object.assign({ bal: 0, own: [], log: pa.log.concat([{ t, d: -pa.bal, b: 0, w: w + " (out)", it: pa.own.join(",") }]).slice(-LOG_KEEP) }, pa.ad ? { ad: pa.ad } : {});
      try { acct.writePm(q.from, empty); } catch (e) { o.log.warn("pommes: moved but couldn't empty the old account,", e.message); }
      ledger({ t, f: idOf(q.from), d: -pa.bal, b: 0, w: w + " (out)", it: pa.own.join(","), to: idOf(q.to) });
      S.moved++;
      o.log.log(`pommes: moved ${pa.bal} and ${pa.own.length} items from ${q.from.slice(0, 8)} to ${q.to.slice(0, 8)}`);
      return { ok: true, bal: pb.bal, own: pb.own };
    }
    return { ok: false, why: "unknown op" };
  }
  function spool() {
    let names;
    try { names = fs.readdirSync(SPOOL); } catch (e) { return; }   // no requests folder: nothing asked yet
    for (const n of names) {
      if (!REQ_RE.test(n)) continue;
      const full = path.join(SPOOL, n);
      let q = null, res;
      try { q = JSON.parse(fs.readFileSync(full, "utf8")); } catch (e) { /* half written: next time */ continue; }
      try { fs.unlinkSync(full); } catch (e) { continue; }   // whoever removes it applies it, once
      try { res = apply(q); } catch (e) { res = { ok: false, why: e.message }; }
      try { fs.writeFileSync(full.replace(/\.json$/, ".done"), JSON.stringify(res), { mode: 0o600 }); } catch (e) { /* the tool waits, then says so */ }
    }
  }
  spool();
  const ticker = setInterval(spool, o.spoolMs);
  if (ticker.unref) ticker.unref();

  function gone(peer) { lastAsk.delete(peer); }
  return { handle, gone, stats: () => Object.assign({}, S), spool, apply, ledger: LEDGER, dir: SPOOL };
}

module.exports = { init, cleanPm, ITEMS, KO_PRICE, FIGHTER_IDS, AD_PAY, AD_MAX, AD_GAP };
