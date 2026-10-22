/* ===================== Potatalities and Pommes on this device: the alternate KO pages you own and use, WATCH, the CPU's teaser (UI only) =====================
   Pommes are the game's premium currency. They live on the server only (pommes.js: the account file's `pm` part, which no phone save can change):
   this file keeps a copy of what the server last said (KO_KEY: whose account, the balance, the pages owned, and which of them you switched off),
   asks again when the Shop opens or you sign in, and sends a buy (`pmb`) that the server checks and pays. Nothing here can add Pommes, and
   chips are never sold for Pommes. Until payments exist (PR 2) the server says buy: false and the Shop shows the packs as Coming soon.
   A Potatality is MANGA[id].alt (ui/manga.js plays it, game/manga/<id>.js draws it). Which page a KO plays is koAltFor(winner, loser) (finisher.js):
   - your own fighter: you own its page and haven't switched it off (a page is on once bought);
   - a friend's online 1v1 or boss partner: his presence says so (ko: [fighter ids], beside the Glaze's gz; an older page sends none);
   - a CPU that beats you in an offline 1v1: one match in four, by the match's seed (the teaser), and the results offer its page (match.koTease);
   - never against a boss or as one, never in a replay, the tutorial, the first fight's hints or a Combo trial, never for anybody else's seat in a 2v2.
   WATCH (koDemo): the match screen with no match in it: your fighter and a dummy on the stage, the simulation stopped, the page plays at once; no counts,
   no chips, no mastery (finisher.js skips masteryPage for match.demo), and its end goes back to the Shop on that fighter's card. */
const KO_KEY = "potatobrawl.pm.v1";
const KO_PRICE = 300, KO_EUR = "€2.99";   // one page; the server has its own price table (pommes.js) and is the one that counts
// one Potatality per fighter (Fable's design, Project files step8/fable-design.md): its name and the sound word on its Shop card
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
// code: the account the copy belongs to (another account on this device sees none of it); off: { fighterId: 1 } pages switched off on this device
const KO = { code: "", bal: 0, own: [], off: {}, buy: false, t: 0, askT: 0, busy: "", why: "", demo: "", back: null };
// a page exists in this copy of the game
const koHas = (id) => !!(KO_PAGES[id] && MANGA[id] && MANGA[id].alt);
const koMine = () => !!KO.code && KO.code === ACCT.code;
const koOwn = (id) => koMine() && KO.own.includes(id);
const koOn = (id) => koOwn(id) && koHas(id) && !KO.off[id];
const koBal = () => (koMine() ? KO.bal : 0);

(function koLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(KO_KEY) || "null");
    if (s && typeof s === "object") {
      KO.code = typeof s.code === "string" ? s.code : "";
      KO.bal = Number.isSafeInteger(s.bal) ? s.bal : 0;
      KO.own = Array.isArray(s.own) ? s.own.filter((id) => KO_PAGES[id]) : [];
      if (s.off && typeof s.off === "object") for (const id in s.off) if (KO_PAGES[id] && s.off[id]) KO.off[id] = 1;
      KO.t = +s.t || 0;
    }
  } catch (e) { /* storage unavailable: the server's answer lasts until the page closes */ }
})();
function koSave() {
  try { localStorage.setItem(KO_KEY, JSON.stringify({ code: KO.code, bal: KO.bal, own: KO.own, off: KO.off, t: KO.t })); } catch (e) { /* full or blocked */ }
}
// switch a page you own on or off for its fighter (the Shop's USE)
function koUse(id, on) {
  if (!koOwn(id)) return;
  if (on) delete KO.off[id]; else KO.off[id] = 1;
  koSave(); koRefresh();
}
// the Shop and anything else showing Pommes follow every change (ui/shop.js draws the KO PAGES section)
function koRefresh() { if (typeof shopKoRender === "function") shopKoRender(); }

/* ----- the server (the Quick match connection, signed in with the sync code; net-ws.js passes pm-* to its listeners) ----- */
function koBoot() {   // qmBoot (ui/quick.js), once
  if (!qmOn()) return;
  window.__blQuick.on(koMsg);
}
// ask for the balance and the pages (the Shop opening, signing in); at most every 5 s unless forced
function koAsk(force) {
  if (!qmOn() || !QM.conn || !ACCT.code) return;
  if (!QM.authed) { qmAuth(); return; }   // koMsg asks once signed in
  const now = Date.now();
  if (!force && now - KO.askT < 5000) return;
  KO.askT = now;
  window.__blQuick.send({ t: "pm" });
}
const koClean = (l) => (Array.isArray(l) ? [...new Set(l.filter((id) => typeof id === "string" && KO_PAGES[id]))] : []);
function koGot(m) {
  if (!ACCT.code || !QM.authed) return;
  if (KO.code !== ACCT.code) KO.off = {};   // another account's switches don't carry over
  KO.code = ACCT.code; KO.bal = Number.isSafeInteger(m.bal) ? m.bal : 0; KO.own = koClean(m.own); KO.buy = !!m.buy; KO.t = Date.now();
  koSave();
}
function koMsg(m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "me") { if (!m.err) koAsk(true); }
  else if (m.t === "pm-st") { koGot(m); koRefresh(); }
  else if (m.t === "pm-ok") {
    const had = koMine() ? KO.own.slice() : [];
    koGot(m);
    for (const id of KO.own) if (!had.includes(id)) delete KO.off[id];   // a page you just bought is on
    koSave();
    KO.busy = ""; KO.why = ""; koRefresh();
  }
  else if (m.t === "pm-no") {
    KO.busy = ""; KO.why = m.why === "short" ? "short" : m.why === "own" ? "own" : m.why === "acct" ? "acct" : "fail";
    if (m.why === "acct") { QM.authed = false; qmAuth(); }   // signed out (the server restarted): sign in again; the Shop says to try again
    if (Number.isSafeInteger(m.bal) && koMine()) { KO.bal = m.bal; koSave(); }
    koRefresh();
  }
}
// spend Pommes on a fighter's page: the server checks the price, the balance and that you don't own it yet. false when it can't even be asked.
function koBuy(id) {
  if (!koHas(id) || koOwn(id) || KO.busy || !koMine() || !qmOn() || !QM.conn || !QM.authed) return false;
  if (KO.bal < KO_PRICE) { KO.why = "short"; koRefresh(); return false; }
  KO.busy = id; KO.why = "";
  window.__blQuick.send({ t: "pmb", item: "ko:" + id });
  koRefresh();
  return true;
}

/* ----- which page a KO plays (finisher.js finStart) ----- */
// online: the pages you have on, for a friend's phone (ko: [fighter ids]); a friend's list from his presence
function koPres() {
  if (window.__blKoAlt === true) return Object.keys(KO_PAGES).filter(koHas);   // the tests (pwon.py): every page this copy has, without owning them
  return koMine() ? KO.own.filter((id) => koOn(id)) : [];
}
function koFrom(pr) { return koClean(pr && pr.ko).filter((id) => koHas(id)); }
// the teaser: one offline match in four, from the match's seed (the same match always says the same)
function koTease(g) { const h = Math.imul(((g && g.br) >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0; return (h >>> 9) % 4 === 0; }
function koAltFor(W, Lf) {
  if (!match || !W || !Lf || W.spec.boss || Lf.spec.boss || !koHas(W.spec.id)) return false;
  if (match.demo) return KO.demo === W.spec.id;
  if (match.rp || match.tutorial || match.trial || match.first) return false;
  if (W.slot === meSlot) return koOn(W.spec.id) || window.__blKoAlt === true;   // __blKoAlt: the tests (pwmanga.py --alt) play your page without owning it
  if (match.online) return !match.tb && Array.isArray(match.koOpp) && match.koOpp.includes(W.spec.id);   // a 2v2 shows only your own
  if (G && G.fighters.length === 2 && Lf.slot === meSlot && koTease(G)) { match.koTease = W.spec.id; return true; }   // a CPU beat you: its page, and the results say where it is
  return false;
}

/* ----- WATCH: the page on a dummy, then back to the Shop ----- */
function koDemoOk(id) { return koHas(id) && mode === "menu" && !FIN.on && !(qmOn() && qmSearching()) && NET.phase === "idle"; }
function koDemo(id) {
  if (!koDemoOk(id)) return false;
  Sfx.init();
  const me = FIG[id], i = FIGHTERS.indexOf(me), opp = FIGHTERS[(i + 3) % FIGHTERS.length], pal = me.palettes[palIdx(id)] || me.palettes[0];
  modal("account", false);
  G = newGame({ seed: 7, players: [{ spec: me, pal }, { spec: opp, pal: opp.palettes[0] }], stocks: 1, time: 0, countdown: 0, map: 0 });
  G.phase = "over"; G.winner = 0; G.endReason = "stocks";   // the simulation stands still under the page (core.js step returns at once); finStart reads the winner
  const a = G.fighters[0], b = G.fighters[1];
  a.x = -60; a.facing = 1; b.x = 70; b.facing = -1;
  match = { demo: true, ranked: false, d: -1, level: "", bot: makeBot(-1) }; meSlot = 0;
  KO.demo = id; KO.back = id;
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
  const id = KO.back;
  KO.demo = ""; KO.back = null;
  mode = "menu"; paused = false; G = null; match = null; meSlot = 0;
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  clearTrails(); fx.length = 0; sfx.length = 0;
  renderMenu(); show("menu"); resize();
  openAccount("h");
  if (id && typeof shopKoFocus === "function") shopKoFocus(id);   // ui/shop.js: back on that fighter's card
}
window.__blKo = { st: KO, refresh: koRefresh, demo: koDemo, tease: koTease, on: koOn };   // tests (a test page has no server: it sets st and window.__blAcct.st.code itself)
