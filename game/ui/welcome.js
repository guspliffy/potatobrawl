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
