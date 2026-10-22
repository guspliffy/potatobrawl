/* ===================== Potatalities and Pommes on this device: the KO page you pick per fighter, WATCH, the CPU's teaser, the ad claim (UI only) =====================
   Pommes are the game's premium currency. They live on the server only (pommes.js: the account file's `pm` part, which no phone save can change):
   this file keeps a copy of what the server last said (KO_KEY: whose account, the balance, the items owned, and your pick per fighter), asks
   again when the Shop opens or you sign in, and sends a buy (`pmb`, an item: "ko:<f>" / "ko2:<f>" a Potatality, "sk1:<f>" / "sk2:<f>" a skin)
   or an ad claim (`pma` -> pm-ad with the new balance, or pm-no why: "ads" | "max" | "wait" (+ in, seconds) | "acct" | "fail"; KO.adN of KO.adMax
   today) that the server checks and pays. Nothing here can add Pommes, and chips are never sold for Pommes.
   Every fighter has two Potatalities, MANGA[id].alt and .alt2 (ui/manga.js plays them, game/manga/<id>.js draws them). The pick (KO.pick, this
   device only): 0 Classic, 1 or 2 that page, "s" Shuffle (one of your owned pages each KO, never Classic); a page you just bought becomes the pick.
   koList(id) is the pages in play, and koSeedPick chooses among them from the match state (g.br and the frame), so every phone plays the same page.
   Which page a KO plays is koAltFor(winner, loser) (finisher.js FIN.alt: 0 Classic, 1 or 2):
   - your own fighter: your pick;
   - a friend's online 1v1 or boss partner: his presence, ko: {fighterId: [page numbers]} beside the Glaze's gz (an older page's [fighter ids] = page 1);
   - a CPU that beats you in an offline 1v1: one match in four, by the match's seed (the teaser), one of its pages; the results offer it (match.koTease, koTeaseN);
   - never against a boss or as one, never in a replay, the tutorial, the first fight's hints or a Combo trial, never for anybody else's seat in a 2v2.
   A missing or broken page plays Classic. WATCH (koDemo): the match screen with no match in it: your fighter and a dummy on the stage, the
   simulation stopped, page n plays at once; no counts, no chips, no mastery (finisher.js skips masteryPage for match.demo); its end goes back to
   the caller (by default the Shop on that fighter's card). */
const KO_KEY = "potatobrawl.pm.v1";
const KO_PRICE = 300, KO_EUR = "€2.99";   // one page; the server has its own price table (pommes.js) and is the one that counts
// the first Potatality per fighter (Fable's design, Project files step8/fable-design.md): its name and the sound word on its Shop card
const KO_PAGES = {
  dragon: { name: "Jacket Potato", word: "FWOOM" },
  phoenix: { name: "Well Done", word: "DING" },
  wizard: { name: "Crisp-tal Ball", word: "KRISSH" },
  alchemist: { name: "Mashed", word: "GLUG" },
  odin: { name: "Frozen Fries", word: "BRRR" },
  samurai: { name: "Hasselback", word: "SHING" },
  gunslinger: { name: "Tater Tots", word: "BLAM" },
  reaper: { name: "Rest in Peel", word: "SHHHK" },
};
// the second one (MANGA[id].alt2; Fable's design, Project files step8/fable-design-2.md section 1); an empty name falls back to the page's own (koPage)
const KO_PAGES2 = {
  dragon: { name: "Air Fryer", word: "WHIRRR" },
  phoenix: { name: "New Potatoes", word: "FWOOSH" },
  wizard: { name: "Hocus Croquettes", word: "ALAKAZAM" },
  alchemist: { name: "Philosopher's Spud", word: "BZZZT" },
  odin: { name: "Smash Landing", word: "SPLAT" },
  samurai: { name: "Snake Eyes", word: "SHA SHA" },
  gunslinger: { name: "Loaded", word: "CH-CHK" },
  reaper: { name: "Gravy Digger", word: "THUD" },
};
// code: the account the copy belongs to (another account on this device sees none of it); items: every item owned; own: the fighter ids of the "ko:" ones;
// pick: { fighterId: 0 | 1 | 2 | "s" } on this device (off: the old on/off switch, kept in step with pick 0 for ui/shop.js); ads, adN, adMax, adIn (s, at adT): today's ads
const KO = { code: "", bal: 0, items: [], own: [], pick: {}, off: {}, buy: false, ads: false, adN: 0, adMax: 0, adIn: 0, adT: 0, t: 0, askT: 0, busy: "", why: "", demo: "", demoN: 1, back: null, backFn: null };
const KO_LIS = [];
const KO_ITEM_RE = /^(ko|ko2|sk1|sk2):([a-z]+)$/;
const koKnown = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(KO_PAGES, id);
// page n (1 or 2) exists in this copy of the game
const koHas = (id, n = 1) => koKnown(id) && !!MANGA[id] && !!(n === 2 ? MANGA[id].alt2 : n === 1 ? MANGA[id].alt : null);
const koPage = (id, n = 1) => {
  if (!koKnown(id)) return { name: "", word: "" };
  if (n !== 2) return KO_PAGES[id];
  const p = KO_PAGES2[id], a = MANGA[id] && MANGA[id].alt2;
  return { name: p.name || (a && a.name) || "", word: p.word };
};
const koMine = () => !!KO.code && KO.code === ACCT.code;
const koItem = (it) => koMine() && typeof it === "string" && (KO.items.includes(it) || (it.slice(0, 3) === "ko:" && KO.own.includes(it.slice(3))));
const koOwn = (id, n = 1) => koItem((n === 2 ? "ko2:" : "ko:") + id);
const koUsable = (id) => [1, 2].filter((n) => koOwn(id, n) && koHas(id, n));
// the effective pick: an unowned or missing page is Classic; Shuffle needs two pages; nothing chosen yet: page 1 if owned, else page 2
function koPick(id) {
  const u = koUsable(id), p = koKnown(id) ? KO.pick[id] : 0;
  if (p === undefined) return u[0] || 0;
  if (p === "s") return u.length > 1 ? "s" : u[0] || 0;
  return (p === 1 || p === 2) && u.includes(p) ? p : 0;
}
const koOn = (id) => { const p = koPick(id); return p === 1 || p === 2; };
const koBal = () => (koMine() ? KO.bal : 0);
// the pages in play for your fighter (the tests' __blKoAlt: true page 1, 2 page 2, "s" both, wherever this copy has them, without owning them)
function koList(id) {
  const t = window.__blKoAlt;
  if (t === true || t === 2 || t === "s") return [1, 2].filter((n) => (t === "s" || n === (t === 2 ? 2 : 1)) && koHas(id, n));
  const p = koPick(id);
  return p === "s" ? [1, 2] : p ? [p] : [];
}
const koPickOk = (v) => v === 0 || v === 1 || v === 2 || v === "s";

(function koLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(KO_KEY) || "null");
    if (s && typeof s === "object") {
      KO.code = typeof s.code === "string" ? s.code : "";
      KO.bal = Number.isSafeInteger(s.bal) ? s.bal : 0;
      KO.own = koClean(s.own);
      KO.items = Array.isArray(s.items) ? koItems(s.items) : KO.own.map((id) => "ko:" + id);
      if (s.pick && typeof s.pick === "object") for (const id in KO_PAGES) if (koPickOk(s.pick[id])) KO.pick[id] = s.pick[id];
      if (s.off && typeof s.off === "object") for (const id in KO_PAGES) if (s.off[id] && KO.pick[id] === undefined) KO.pick[id] = 0;   // the old switch: off is Classic
      for (const id in KO_PAGES) if (KO.pick[id] === 0) KO.off[id] = 1;
      KO.t = +s.t || 0;
    }
  } catch (e) { /* storage unavailable: the server's answer lasts until the page closes */ }
})();
function koSave() {
  try { localStorage.setItem(KO_KEY, JSON.stringify({ code: KO.code, bal: KO.bal, items: KO.items, own: KO.own, pick: KO.pick, t: KO.t })); } catch (e) { /* full or blocked */ }
}
function koPickSet(id, v) { KO.pick[id] = v; if (v === 0) KO.off[id] = 1; else delete KO.off[id]; }
// choose what a fighter's KO plays: 0 Classic, 1 or 2 a page you own, "s" Shuffle (two pages owned); anything else is ignored
function koSetPick(id, v) {
  if (!koKnown(id) || !koPickOk(v)) return false;
  const u = koUsable(id);
  if (v === "s" ? u.length < 2 : v !== 0 && !u.includes(v)) return false;
  koPickSet(id, v); koSave(); koRefresh();
  return true;
}
// the old Shop's USE: on is page 1, off Classic
function koUse(id, on) { if (koOwn(id)) koSetPick(id, on ? 1 : 0); }
// the Shop, the Pommes pill and anything else showing Pommes follow every change: koListen(fn); ui/shop.js draws the KO PAGES section
function koListen(fn) { if (typeof fn === "function" && !KO_LIS.includes(fn)) KO_LIS.push(fn); }
function koRefresh() {
  if (typeof shopKoRender === "function") shopKoRender();
  for (const fn of KO_LIS) try { fn(); } catch (e) { if (typeof console !== "undefined") console.warn("koListen", e); }
}

/* ----- the server (the Quick match connection, signed in with the sync code; net-ws.js passes pm-* to its listeners) ----- */
function koBoot() {   // qmBoot (ui/quick.js), once
  if (!qmOn()) return;
  window.__blQuick.on(koMsg);
}
// ask for the balance and the items (the Shop opening, signing in); at most every 5 s unless forced
function koAsk(force) {
  if (!qmOn() || !QM.conn || !ACCT.code) return;
  if (!QM.authed) { qmAuth(); return; }   // koMsg asks once signed in
  const now = Date.now();
  if (!force && now - KO.askT < 5000) return;
  KO.askT = now;
  window.__blQuick.send({ t: "pm" });
}
function koClean(l) { return Array.isArray(l) ? [...new Set(l.filter(koKnown))] : []; }
function koItems(l) { return [...new Set(l.filter((it) => { const m = typeof it === "string" && KO_ITEM_RE.exec(it); return !!m && koKnown(m[2]); }))]; }
const koCan = () => koMine() && qmOn() && !!QM.conn && !!QM.authed;
function koGot(m) {
  if (!ACCT.code || !QM.authed) return;
  if (KO.code !== ACCT.code) { KO.pick = {}; KO.off = {}; }   // another account's picks don't carry over
  KO.code = ACCT.code; KO.bal = Number.isSafeInteger(m.bal) ? m.bal : 0; KO.t = Date.now();
  if (Array.isArray(m.items)) { KO.items = koItems(m.items); KO.own = KO.items.filter((it) => it.slice(0, 3) === "ko:").map((it) => it.slice(3)); }
  else { KO.own = koClean(m.own); KO.items = KO.items.filter((it) => it.slice(0, 3) !== "ko:").concat(KO.own.map((id) => "ko:" + id)); }   // an older server: own only
  if ("buy" in m) KO.buy = !!m.buy;
  if ("ads" in m) KO.ads = !!m.ads;
  if (Number.isSafeInteger(m.adN)) KO.adN = m.adN;
  if (Number.isSafeInteger(m.adMax)) KO.adMax = m.adMax;
  koSave(); koSkins();
}
// the Pommes skins you own join the skins owned (P.owned), so wearing them works like any skin: on another device too, once signed in
const koSkinIdx = (id, n) => (FIG[id] ? FIG[id].palettes.findIndex((p) => p.pommes === n) : -1);
function koSkins(wear) {
  let ch = false;
  for (const it of KO.items) {
    const x = KO_ITEM_RE.exec(it), n = x && (x[1] === "sk1" ? 1 : x[1] === "sk2" ? 2 : 0), i = n ? koSkinIdx(x[2], n) : -1;
    if (i < 0) continue;
    const l = P.owned[x[2]] || [0];
    if (!l.includes(i)) { P.owned[x[2]] = [...l, i]; ch = true; }
    if (wear === it) { P.pal[x[2]] = i; ch = true; }   // a skin you just bought is worn
  }
  if (ch) saveProfile();
}
function koMsg(m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "me") { if (!m.err) koAsk(true); }
  else if (m.t === "pm-st") { koGot(m); koRefresh(); }
  else if (m.t === "pm-ok" || m.t === "pm-ad") {
    const mine = koMine(), had = KO.items.slice();
    koGot(m);
    if (mine) for (const it of KO.items) if (!had.includes(it)) {   // a page you just bought is your pick
      const x = KO_ITEM_RE.exec(it);
      if (x && (x[1] === "ko" || x[1] === "ko2")) koPickSet(x[2], x[1] === "ko" ? 1 : 2);
      else if (x) koSkins(it);
    }
    if (m.t === "pm-ad") { KO.adIn = 0; KO.adT = 0; }
    koSave();
    KO.busy = ""; KO.why = ""; koRefresh();
  }
  else if (m.t === "pm-no") {
    KO.busy = ""; KO.why = ["short", "own", "acct", "ads", "max", "wait"].includes(m.why) ? m.why : "fail";
    if (m.why === "wait") { KO.adIn = Math.max(0, +m.in || 0); KO.adT = Date.now(); }
    if (m.why === "ads") KO.ads = false;
    if (m.why === "acct") { QM.authed = false; qmAuth(); }   // signed out (the server restarted): sign in again; the Shop says to try again
    if (Number.isSafeInteger(m.bal) && koMine()) { KO.bal = m.bal; koSave(); }
    koRefresh();
  }
}
// spend Pommes on an item ("ko2:samurai", "sk1:odin"; a bare fighter id is its first page): the server checks the price, the balance and that
// you don't own it yet. KO.busy is the item until it answers. false when it can't even be asked.
function koBuy(item) {
  if (typeof item === "string" && koKnown(item)) item = "ko:" + item;
  const x = typeof item === "string" && KO_ITEM_RE.exec(item);
  if (!x || !koKnown(x[2])) return false;
  const n = x[1] === "ko" ? 1 : x[1] === "ko2" ? 2 : 0;
  if ((n && !koHas(x[2], n)) || koItem(item) || KO.busy || !koCan()) return false;
  if (KO.bal < KO_PRICE) { KO.why = "short"; koRefresh(); return false; }   // every item costs KO_PRICE (the server checks it again)
  KO.busy = item; KO.why = "";
  window.__blQuick.send({ t: "pmb", item });
  koRefresh();
  return true;
}
// ads you can still watch today (0 when the server has no ads); koAdClaim asks the server to pay one (KO.busy "ad" until it answers)
const koAdLeft = () => (koMine() && KO.ads ? Math.max(0, KO.adMax - KO.adN) : 0);
function koAdClaim() {
  if (KO.busy || !koCan() || koAdLeft() <= 0) return false;
  KO.busy = "ad"; KO.why = "";
  window.__blQuick.send({ t: "pma" });
  koRefresh();
  return true;
}

/* ----- which page a KO plays (finisher.js finStart) ----- */
// online: your pages in play, for a friend's phone (ko: {fighterId: [page numbers]}); a friend's from his presence (match.koOpp)
function koPres() {
  const o = {};
  for (const id in KO_PAGES) { const l = koList(id); if (l.length) o[id] = l; }
  return o;
}
function koFrom(pr) {
  const k = pr && pr.ko, o = {};
  if (Array.isArray(k)) { for (const id of koClean(k)) if (koHas(id, 1)) o[id] = [1]; }   // an older page: the fighters with their page on
  else if (k && typeof k === "object") for (const id in KO_PAGES) {
    const l = Array.isArray(k[id]) ? [1, 2].filter((n) => k[id].includes(n) && koHas(id, n)) : [];
    if (l.length) o[id] = l;
  }
  return o;
}
// one of the pages, from the match state both phones share (the boss seed and the frame; salted apart from koTease): the same KO always picks the same
function koSeedPick(list, g) {
  if (!Array.isArray(list) || !list.length) return 0;
  let h = ((((g && g.br) | 0) ^ 0x27d4eb2f) + Math.imul(((g && g.t) | 0) ^ 0x165667b1, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return list[(h >>> 0) % list.length];
}
// the teaser: one offline match in four, from the match's seed (the same match always says the same)
function koTease(g) { const h = Math.imul(((g && g.br) >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0; return (h >>> 9) % 4 === 0; }
function koAltFor(W, Lf) {
  if (!match || !W || !Lf || W.spec.boss || Lf.spec.boss) return 0;
  const id = W.spec.id;
  if (match.demo) return KO.demo === id && KO.demoN && koHas(id, KO.demoN) ? KO.demoN : 0;
  if (match.rp || match.tutorial || match.trial || match.first) return 0;
  if (W.slot === meSlot) return koSeedPick(koList(id), G);
  if (match.online) return match.tb || !match.koOpp || Array.isArray(match.koOpp) ? 0 : koSeedPick(koKnown(id) ? match.koOpp[id] : null, G);   // a 2v2 shows only your own
  if (G && G.fighters.length === 2 && Lf.slot === meSlot && koTease(G)) {   // a CPU beat you: one of its pages, and the results say where it is
    const n = koSeedPick([1, 2].filter((k) => koHas(id, k)), G);
    if (n) { match.koTease = id; match.koTeaseN = n; }
    return n;
  }
  return 0;
}

/* ----- WATCH: page n on a dummy (0: the Classic page), then back ----- */
function koDemoOk(id, n = 1) { return (n ? koHas(id, n) : koKnown(id) && !!FIG[id]) && mode === "menu" && !FIN.on && !(qmOn() && qmSearching()) && NET.phase === "idle"; }
// back: runs after the page instead of the Shop on that fighter's card
function koDemo(id, n = 1, back) {
  if (!koDemoOk(id, n)) return false;
  Sfx.init();
  const me = FIG[id], i = FIGHTERS.indexOf(me), opp = FIGHTERS[(i + 3) % FIGHTERS.length], pal = me.palettes[palIdx(id)] || me.palettes[0];
  modal("account", false);
  G = newGame({ seed: 7, players: [{ spec: me, pal }, { spec: opp, pal: opp.palettes[0] }], stocks: 1, time: 0, countdown: 0, map: 0 });
  G.phase = "over"; G.winner = 0; G.endReason = "stocks";   // the simulation stands still under the page (core.js step returns at once); finStart reads the winner
  const a = G.fighters[0], b = G.fighters[1];
  a.x = -60; a.facing = 1; b.x = 70; b.facing = -1;
  match = { demo: true, ranked: false, d: -1, level: "", bot: makeBot(-1) }; meSlot = 0;
  KO.demo = id; KO.demoN = n; KO.back = id; KO.backFn = typeof back === "function" ? back : null;
  mode = "match"; paused = false; lastCount = 0;
  show(null); hideBanner(); $("hud").hidden = true; $("ctl").hidden = true; releaseTouch();
  fx.length = 0; sfx.length = 0; clearTrails(); combos.fill(null);
  resize(); camStep(G, true);
  FIN.pend = { type: "lethal", final: true, slot: 1, by: 0, mv: "heavy", fin: false, dirx: 0.8, diry: -0.6, x: b.x, y: b.y };
  finStart(G);
  if (!FIN.on) { koDemoEnd(); return false; }
  FIN.finish = koDemoEnd;   // finEnd calls it when the page ends or is skipped
  return true;
}
function koDemoEnd() {
  finStop();
  const id = KO.back, fn = KO.backFn;
  KO.demo = ""; KO.demoN = 1; KO.back = null; KO.backFn = null;
  mode = "menu"; paused = false; G = null; match = null; meSlot = 0;
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  clearTrails(); fx.length = 0; sfx.length = 0;
  renderMenu(); show("menu"); resize();
  if (fn) { fn(); return; }
  openAccount("h");
  if (id && typeof shopKoFocus === "function") shopKoFocus(id);   // ui/shop.js: back on that fighter's card
}
// tests (a test page has no server: it sets st and window.__blAcct.st.code itself); opp: the friend's pages this match (match.koOpp)
window.__blKo = { st: KO, refresh: koRefresh, demo: koDemo, tease: koTease, on: koOn, pick: koPick, setPick: koSetPick, list: koList, seedPick: koSeedPick, claim: koAdClaim, pres: koPres, get opp() { return match ? match.koOpp || null : null; } };
