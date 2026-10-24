/* ===================== first open: the turn-sideways screen and the welcome sheet (UI only) =====================
   1. Turn it sideways: a touch phone held upright (rotMode, view.js) gets a full-screen note before anything else, on every page load, because rotation
      lock is permanent and costs one tap. It sits outside #app (a sibling in body) so it stays upright while #app is rotated; READY is drawn in the game's
      turn, so it reads right once the phone is turned. READY closes it, "Play upright instead" sets Settings > Screen to Upright, and a browser that turns
      the page by itself closes it with no tap (view.js resize). Shown once per page load; never on a computer or with Screen set to Upright.
   2. Welcome: a brand-new player (no saved profile, no account, no invite link) picks the 1-minute tutorial or goes straight to the first fight (tutorial.js).
      The menu is hidden and the attract fight shows through a 50% dim, with one fighter at 110% so a launch happens soon. */
function turnOpen(next) {
  if (!rotMode || TURN.shown || window.__blNoTurn) { next(); return; }   // __blNoTurn: browser tests that are about something else
  TURN.on = TURN.shown = true; TURN.next = next;
  const el = $("turn");
  el.style.setProperty("--tr", rotMode === 1 ? "-90deg" : "90deg");   // the phone is turned the other way round from the game's own turn
  el.style.setProperty("--ga", rotMode === 1 ? "90deg" : "-90deg");   // READY wears the game's turn (the same as #app)
  el.classList.toggle("ccw", rotMode === 1);
  el.classList.remove("out"); el.hidden = false;
  releaseTouch();
}
function turnClose() {
  if (!TURN.on) return;
  TURN.on = false;
  const el = $("turn"), n = TURN.next;
  TURN.next = null;
  el.classList.add("out");   // 200 ms fade, still in the way of touches until it is gone
  setTimeout(() => { el.hidden = true; el.classList.remove("out"); if (n) n(); }, 200);
}
$("turnGo").addEventListener("click", () => { Sfx.init(); Sfx.ui(); turnClose(); });
$("turnUp").addEventListener("click", () => { Sfx.init(); P.screen = "up"; saveProfile(); releaseTouch(); resize(); turnClose(); });   // resize() first: rotMode 0 also closes it, once
// nothing under the screen hears a touch that lands on it
$("turn").addEventListener("pointerdown", (e) => e.stopPropagation());

// The few sentences in shell.html that an inline tag cuts in two (a bold word inside) are marked translate="no" there, because _tDom would translate the
// pieces one by one. Here each is ONE _t text over the whole sentence, tags included, and goes into the same place (in English it is the page's own markup).
function wlSentences() {
  const put = (el, html) => { if (el) el.innerHTML = html; };
  put($("a2hsHint").firstElementChild, _t("Play without the browser bars: tap Share, then <b>Add to Home Screen</b>. The app keeps its own progress."));
  const steps = document.querySelectorAll("#scrA2hs .a2hs-steps li > span:last-child");   // the Fullscreen sheet's two steps
  put(steps[0], _t("Tap <b>Share</b> in the browser's bar"));
  put(steps[1], _t("Then <b>Add to Home Screen</b>"));
  put($("qmToV"), _t("Want it to count? · <b>VS CPU</b> ›"));   // Quick match (vscpu.js shows it)
  put(document.querySelector("#scrSeason .ss-ls p"), _t("<b>Ranked is online now:</b> real players, and the server keeps the score."));   // the Season 1 sheet
}
wlSentences();

const WEL = { on: false, g: null, tm: 0 };
screens.welcome = $("scrWelcome");
function welcomeSeed() {   // the attract fight is new now and then: its first fighter always starts at 110%
  if (attract && WEL.g !== attract.g) { WEL.g = attract.g; attract.g.fighters[0].percent = 110; }
}
function welcomeOpen() {
  langWel();   // ui/lang.js: the five languages under the buttons
  WEL.on = true;
  show(null); modal("welcome", true);   // show(null) hides the menu
  welcomeSeed();
  clearInterval(WEL.tm);
  WEL.tm = setInterval(() => { if (WEL.on) { welcomeSeed(); screens.menu.hidden = true; } }, 400);
  try { $("welGo").focus({ preventScroll: true }); } catch (e) { /* no focus for a touch screen: fine */ }
}
function welcomeClose() {
  WEL.on = false; clearInterval(WEL.tm);
  modal("welcome", false);
}
tap("welGo", () => { welcomeClose(); cntOnce("tut:go"); goFull(); startTutorial(); });   // ui/counter.js cntOnce: the funnel's "picked" row
tap("welSkip", () => { welcomeClose(); cntOnce("tut:fight"); P.tut = true; saveProfile(); goFull(); startFirstFight(); });

/* ----- the game open twice on one device (two tabs or windows share its saved progress) -----
   Each page keeps the progress in memory and saves all of it, so the page that saved last wrote its older copy over the other's chips,
   skins and gifts (and both pages would send the same changes to the account). Only one page plays now: a page that opens says so (hi),
   and an older page goes to sleep behind a card, saving nothing; one in a match keeps playing and the new page sleeps instead (busy).
   Play here wakes a sleeping page: it reloads (with the progress as the other page saved it) and takes over, a match there or not. */
const TAB = { id: Math.random().toString(36).slice(2, 10), at: Date.now(), ch: null };
screens.twice = $("scrTwice");
function tabSleep() {
  if (tabAsleep) return;
  tabAsleep = true;
  clearTimeout(acctTimer);   // ui/acct.js: a sync that was coming
  modal("twice", true);
}
try {
  TAB.ch = new BroadcastChannel("potatobrawl.tabs");
  TAB.ch.onmessage = (e) => {
    const m = e.data && typeof e.data === "object" ? e.data : {};
    if (m.id === TAB.id || tabAsleep) return;
    if (m.t === "hi") {
      const newer = m.take || m.at > TAB.at || (m.at === TAB.at && m.id > TAB.id);   // two pages opened at once (a restored session): the newer plays
      if (!newer) return;
      if (!m.take && mode === "match") TAB.ch.postMessage({ t: "busy", id: TAB.id, to: m.id });
      else tabSleep();
    } else if (m.t === "busy" && m.to === TAB.id) tabSleep();
  };
  let take = false;
  try { take = sessionStorage.getItem("potatobrawl.take") === "1"; sessionStorage.removeItem("potatobrawl.take"); } catch (e) { /* no session storage */ }
  TAB.ch.postMessage({ t: "hi", id: TAB.id, at: TAB.at, take });
} catch (e) { /* no BroadcastChannel (an old browser): every page plays, as before */ }
tap("twiceHere", () => { try { sessionStorage.setItem("potatobrawl.take", "1"); } catch (e) { /* the reload still wakes it */ } location.reload(); });
