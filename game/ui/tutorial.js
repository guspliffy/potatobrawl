/* ----- the first minute: a 4-step tutorial (about 55 s), then the first fight with hints (Fable's first-minute pass, 2026-10-21) -----
   All UI: the tutorial and the first fight are offline, and like before the UI sets fields on G (percent, stocks, ulti bar, the players' spots) and
   scripts the CPU's input in step 3 (tutBot). Nothing here is read by the simulation otherwise. The welcome sheet and the turn-sideways screen are in welcome.js. */
const TUT = { on: false, i: 0, id: "move", x0: 0, hits: 0, hold: 0, calm: 0, dodges: 0, moved: false, ph: "", t: 0, tries: 0, falls: 0, scr: null };
const TUT_CALM = 240;   // sim ticks the CPU waits (4 s) once the player is next to it, in the step that needs hits to land
// Step 3's launch: the player's percent, how far inside the right ledge it stands, how far the dummy stands behind it, and the fall speed cap while it
// recovers. Tuned in node against all eight fighters (tests/pwtut.py checks it live): the heavy sends the player 10 to 120 px past the ledge, and
// with the cap even a late first jump plus a push toward the stage gets back.
const TUT_LAUNCH = { pct: 0, inside: 60, gap: 60, fall: 4.5 };
function tutSteps() {
  return [
    { id: "move", t: "Move & jump", b: null },
    { id: "hits", t: "Land 3 hits", b: "light" },
    { id: "dodge", t: "Dodge, then recover", b: "dodge" },
    { id: "ko", t: "Knock them out", b: "heavy" },
  ];
}
// the card's second line (touch / keyboard copy)
function tutHint() {
  const t = touchUI;
  switch (TUT.id) {
    case "move": return TUT.moved ? (t ? "Tap JUMP twice" : "SPACE, twice") : (t ? "Drag left to move" : "A or D to move");
    case "hits": return `${t ? "LIGHT is fast, HEAVY hurts" : "J light, K heavy"} · ${TUT.hits}/3`;
    case "dodge":
      if (TUT.ph === "dodge") return t ? "Tap DODGE as they swing" : "SHIFT as they swing";
      if (TUT.falls > 1 || TUT.tries > 2) return "No worries, a real fight teaches it";   // the "On we go!" after two falls (or a launch that never came)
      if (TUT.ph !== "recover") return "Here comes a big hit…";
      if (TUT.falls) return `${t ? "Jump" : "SPACE"} twice, then push toward the stage`;
      return `Off you go! ${t ? "JUMP" : "SPACE"} twice, back to the stage`;
    default: return t ? "They're at 120%. HEAVY sends them flying" : "They're at 120%. K sends them flying";
  }
}
function tutPulse() {   // the button the step is about glows (not while the "Nice!" shows)
  const id = TUT.id, k = id === "move" ? (TUT.moved ? "jump" : null) : id === "hits" ? "light" : id === "dodge" ? (TUT.ph === "dodge" ? "dodge" : TUT.ph === "recover" ? "jump" : null) : "heavy";
  for (const b of padBtns) b.classList.toggle("tutpulse", b.dataset.k === k && !TUT.hold);
}
function tutRefresh() {
  const h = $("tutH");
  h.textContent = tutHint(); h.style.fontSize = "";
  for (let s = 13; h.scrollWidth > h.clientWidth + 1 && s > 11;) h.style.fontSize = --s + "px";   // one line: a narrow card sets it smaller
  tutPulse();
}
// The top band between the two name cards (app pixels): the tutorial card and the first fight's hint strip sit in it, y = 8 and just under the timer.
// Measured, because the cards' widths follow the names and the percent. Upright (portrait) both sit above the control panel instead (css/99-first.css).
function topPlace() {
  if ($("hud").hidden) return;
  const a = $("pc0"), b = $("pc1"), el = $("tut"), fh = $("fhint");
  const l = a.offsetLeft + a.offsetWidth + 12, r = b.offsetLeft - 12, w = Math.max(160, Math.min(H >= 520 ? 480 : 400, r - l)), mid = Math.round((l + r) / 2);
  el.style.setProperty("--tl", Math.round(mid - w / 2) + "px"); el.style.setProperty("--tw", w + "px");
  const c = $("clock"), m = c.offsetParent, fw = Math.max(160, r - l);
  fh.style.setProperty("--fy", (m ? m.offsetTop + c.offsetTop + c.offsetHeight + 4 : 40) + "px");
  fh.style.setProperty("--fl", Math.round(mid - fw / 2) + "px"); fh.style.setProperty("--fw", fw + "px");
}
// The card and the first fight's hint strip fade to a ghost while your YOU marker would sit under them (on the top platform of a small screen). App pixels.
function tutPeek() {
  const f = G && G.fighters[meSlot], tag = f && f.state !== "dead" && f.state !== "gone" && tagAlpha() > 0.02, [hx, hy] = tag ? toScreen(f.x, f.y - f.s.h) : [0, 0];
  for (const el of [$("tut"), $("fhint")]) {
    const sp = el.id === "fhint" ? el.firstElementChild : null, x = el.offsetLeft + (sp ? sp.offsetLeft : 0), w = sp ? sp.offsetWidth : el.offsetWidth;
    el.classList.toggle("peek", !!tag && !el.hidden && hx + 18 > x && hx - 18 < x + w && hy - 36 < el.offsetTop + el.offsetHeight && hy - 12 > el.offsetTop);
  }
}
function startTutorial() {
  Sfx.init(); hideOnline(); modal("help", false); modal("settings", false);
  P.tut = true; saveProfile();
  const me = FIG[sel.fighter] || FIGHTERS[0], opp = me.id === "odin" ? FIG.wizard : FIG.odin;
  const myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  G = newGame({ seed: newSeed(), players: [{ spec: me, pal: myPal }, { spec: opp, pal: opp.palettes[0] }], stocks: 9, time: 0, countdown: 120 });
  const easy = LEVELS.find((l) => l.name === "Easy").d;   // the same CPU as Practice > Easy
  match = { ranked: false, tutorial: true, d: easy, bot: makeBot(easy), level: "Tutorial" };
  meSlot = 0;
  Object.assign(TUT, { on: true, i: 0, x0: G.fighters[0].x, hold: 0, scr: null });
  enterMatchUI();
  $("tut").classList.add("t4");   // the compact two-line card (the Combo trial keeps the old one)
  tutShow();
}
function tutShow() {
  const st = tutSteps(), s = st[TUT.i], el = $("tut");
  el.classList.remove("done");
  Object.assign(TUT, { id: s.id, calm: TUT_CALM, dodges: 0, hits: 0, moved: false, ph: s.id === "dodge" ? "dodge" : "", t: 0, tries: 0, falls: 0, scr: null });
  cntOnce("tut:" + s.id);   // ui/counter.js: the furthest step new players reach
  $("tutN").textContent = `Tutorial ${TUT.i + 1}/${st.length}`;
  $("tutT").textContent = s.t;
  $("pc1").querySelector(".pc-tag").textContent = s.id === "ko" ? "CPU" : "Dummy";   // it only fights back in the last step
  if (s.id === "ko") { const op = G.fighters[1]; op.percent = Math.max(op.percent, 120); op.stocks = 1; }   // one hit away from flying
  topPlace(); tutRefresh();
}
function tutEnd() {
  TUT.on = false; TUT.scr = null; $("tut").hidden = true; $("tut").classList.remove("t4", "done", "peek"); app.classList.remove("tut", "tutpad");
  $("tutNext").hidden = true; $("tutSkip").textContent = "Skip";   // the Combo trial's buttons (ui/combos.js)
  for (const b of padBtns) b.classList.remove("tutpulse");
}
// The tutorial's CPU is told what to do now and then (step 3's launch): loop.js asks here before it asks the CPU's own brain.
function tutBot() {
  if (!TUT.on || !TUT.scr || !match || !match.tutorial || match.trial) return null;
  const s = TUT.scr, i = BL.blankInput();
  if (s.n++ < s.heavy) { i.heavy = true; i.x = 1; }   // a side heavy toward the player (on its right)
  return i;
}
function tutDoneStep(title) {
  TUT.hold = 50;
  $("tut").classList.add("done"); $("tutT").textContent = title;
  tutRefresh();
  Sfx.ui();
}
// the "Nice!" is over: the launch after the dodge, or the next step
function tutAfter() {
  if (TUT.id === "dodge" && TUT.ph === "dodge") {
    $("tut").classList.remove("done"); $("tutT").textContent = tutSteps()[TUT.i].t;
    Object.assign(TUT, { ph: "set", t: 0, scr: { n: 0, heavy: 0 } }); tutRefresh();   // the dummy stands still until the launch
  } else { TUT.i++; tutShow(); }
}
// Step 3, after the dodge: the dummy launches the player off the right ledge (a scripted side heavy), then JUMP twice and back. UI only: both fighters are
// placed, the dummy's input is scripted, and the player falls a little slower while it recovers. A fall (it respawns) repeats it once; a second fall,
// or a heavy that keeps missing, counts as done: no dead end. Returns the card's title when the step is done.
function tutLaunch(me, op) {
  const S = STAGE.main, K = TUT_LAUNCH, ph = TUT.ph;
  const off = !me.grounded && (me.x > S.x2 + 6 || me.x < S.x1 - 6) && me.state !== "dead" && me.state !== "respawn";
  TUT.t++;
  if (ph === "set") {   // wait (7 s at the most) until the player stands free, then put both in place
    const free = me.grounded && me.plat < 0 && (me.state === "idle" || me.state === "run" || me.state === "walk");
    if (!free && TUT.t < 420) return "";
    for (const [f, x, face] of [[me, S.x2 - K.inside, -1], [op, S.x2 - K.inside - K.gap, 1]]) {
      Object.assign(f, { x, y: S.top, vx: 0, vy: 0, kbx: 0, kby: 0, facing: face, grounded: true, plat: -1, hitstun: 0, tumble: false, invuln: 0, doomed: false, freeT: 99, airJumps: f.s.airJumps, ledge: 0, ledgeCd: 0, chg: 0 });
      f.state = "idle"; f.st = 0; f.move = null; f.mid = null;
    }
    me.percent = K.pct;
    Object.assign(TUT, { ph: "wait", t: 0, scr: { n: 0, heavy: 0 } }); tutRefresh();
  } else if (ph === "wait") {
    if (TUT.t >= 45) Object.assign(TUT, { ph: "swing", t: 0, scr: { n: 0, heavy: 3 } });
  } else if (ph === "swing") {   // the heavy lands about 30 ticks in; the player is off the stage a few ticks later
    if (off) { Object.assign(TUT, { ph: "recover", t: 0 }); tutRefresh(); }
    else if (TUT.t > 150) {   // it never got them off (a dodge, a step away): once more, and after the third time on
      if (++TUT.tries >= 3) return "On we go!";
      Object.assign(TUT, { ph: "set", t: 0 });
    }
  } else if (ph === "recover") {
    if (me.state === "air" && me.vy > K.fall) me.vy = K.fall;
    if (me.state === "dead" || me.state === "respawn") {
      if (++TUT.falls >= 2) return "On we go!";
      Object.assign(TUT, { ph: "set", t: 0 }); tutRefresh();
    } else if (me.grounded && me.x >= S.x1 && me.x <= S.x2 && me.state !== "hitstun" && TUT.t > 10) return "Nice!";
  }
  return "";
}
function tutTick(evs) {
  if (match && match.trial) { for (const f of G.fighters) f.ult = 0; trialTick(evs); return; }   // the Combo trial runs on this engine (ui/combos.js); it has no ultimates
  if (!TUT.on || !match || !match.tutorial || !G || G.phase !== "play") return;
  const me = G.fighters[0], op = G.fighters[1], id = TUT.id;
  if ((G.t & 15) === 0) topPlace();   // the cards grow with the percent
  if ((G.t & 3) === 0) tutPeek();
  // nobody runs out of lives or gets launched far while learning
  me.stocks = Math.max(me.stocks, 5); me.percent = Math.min(me.percent, 60);
  // The CPU is a real Easy CPU, but it stands still while there is nothing it should punish: in the first step, and for TUT_CALM ticks after the
  // player walks up to it (again after every hit) in the step that needs hits to land.
  const near = Math.abs(me.x - op.x) < 170 && Math.abs(me.y - op.y) < 90;
  const hitStep = id === "hits";
  if (hitStep && evs.some((e) => e.type === "hit" && e.def !== undefined)) TUT.calm = TUT_CALM;   // every hit, either way, gives the player another quiet spell
  if (hitStep && near && TUT.calm > 0) TUT.calm--;
  // the ulti bar stays below full: the ULTI button is taught by the first fight's hint, not here
  me.ult = Math.min(me.ult, BL.ultNeed(me) * 0.7);
  match.bot.d = id === "move" || (hitStep && TUT.calm > 0) ? -1 : match.d;
  if (TUT.hold > 0) { if (--TUT.hold === 0) tutAfter(); return; }
  let done = "";
  switch (id) {
    case "move":   // far enough along the floor, then a jump in the air
      if (!TUT.moved && Math.abs(me.x - TUT.x0) > 110) { TUT.moved = true; tutRefresh(); }
      if (TUT.moved && evs.some((e) => e.type === "jump" && e.slot === 0 && !e.ground)) done = "Nice!";
      break;
    case "hits": {   // any hit of yours counts
      const n = evs.filter((e) => e.type === "hit" && e.slot === 0 && e.def !== undefined).length;
      if (n) { TUT.hits = Math.min(3, TUT.hits + n); if (TUT.hits < 3) tutRefresh(); else done = "Nice!"; }
      break;
    }
    case "dodge":
      if (TUT.ph !== "dodge") { done = tutLaunch(me, op); break; }
      // a dodge while the CPU is attacking close by (the dodge is what saves the player), or simply two dodges
      TUT.dodges += evs.filter((e) => e.type === "dodge" && e.slot === 0).length;
      if ((me.state === "dodge" && op.state === "attack" && Math.abs(me.x - op.x) < 260 && Math.abs(me.y - op.y) < 160) || TUT.dodges >= 2) done = "Nice!";
      break;
  }
  if (done) tutDoneStep(done);   // the last step ends with the KO (finishMatch -> tutDone)
}
// the end: your fighter on the results screen, one card and one button
function tutDone() {
  tutEnd();
  mode = "result"; paused = false;
  modal("pause", false); modal("help", false); hideBanner();
  $("ctl").hidden = true; $("hud").hidden = true; releaseTouch();
  const me = G.fighters[0].spec;
  resOpen("win", me, true);   // solo: css/99-first.css keeps only FIGHT and Menu
  if (match) match.finBy = "";
  $("rMode").textContent = "Tutorial"; $("rWho").textContent = me.name;
  resTitle("You're ready");
  $("rSub").textContent = "Now a real fight: the Easy CPU, three lives.";
  $("rStats").hidden = true;
  $("rAgain").querySelector("span").textContent = "Fight";
  show("result");
}
tap("tutSkip", () => {
  if (match && match.trial && TR.back !== null) { openRoad({ to: TR.back }); return; }   // a trial from a Road stop: Back to its sheet (openRoad ends the trial)
  if (match && match.tutorial && !match.trial && !playedOnce()) { tutEnd(); cntDrop(true); startFirstFight(); return; }   // a new player goes on to the first fight (cntDrop counts the skip)
  tutEnd(); goMenu();
});
tap("hTry", startTutorial);

/* ----- the first fight: a Practice 1v1 against the Easy CPU, 3 lives, 4:00 (Skip on the welcome, FIGHT after the tutorial, Skip on the card of a new player) -----
   match.first = true counts as Practice in the stats (cntMode). The hints below only run in this match, each once. */
function startFirstFight() {
  Sfx.init(); hideOnline(); modal("help", false); modal("settings", false);
  const me = FIG[sel.fighter] || FIGHTERS[0], myPal = me.palettes[P.pal[me.id]] || me.palettes[0], opp = cpuFoe(me);
  const oppPal = opp.id === me.id ? opp.palettes[(P.pal[me.id] + 1) % opp.palettes.length] : opp.palettes[0];
  const li = LEVELS.findIndex((l) => l.name === "Easy"), easy = LEVELS[li].d;
  Object.assign(sel, { mode: "practice", opp: "random", level: li });   // Rematch plays another Practice fight, not a Ranked one
  G = newGame({ seed: newSeed(), players: [{ spec: me, pal: myPal }, { spec: opp, pal: oppPal }], stocks: 3, time: 240, countdown: 150, map: randMap() });
  // Fable: the first fight's CPU does not edge-guard (the Dragon's style would follow the player out past the ledge)
  match = { ranked: false, d: easy, bot: makeBot(easy, Object.assign({}, BL.BOT_STYLES[opp.id], { edge: 0 })), level: LEVELS[li].name, cpu: cpuName(), first: true };
  meSlot = 0;
  enterMatchUI();
  fhStart();
}
const FH = { on: false, t: 0, cur: "", end: 0, gap: 0, seen: new Set(), q: [] };
function fhLines() {
  const t = touchUI;
  return {
    go: t ? "Drag left to move · tap JUMP twice" : "A D move · SPACE jump, twice",
    mix: t ? "LIGHT and HEAVY hit · DODGE through attacks" : "J light · K heavy · SHIFT dodge",
    edge: t ? "Off the edge? JUMP twice to get back" : "Off the edge? SPACE twice to get back",
    pct: t ? "They're over 100%. HEAVY launches them" : "They're over 100%. K launches them",
    ult: t ? "ULTI is ready. Tap it" : "ULTI ready — press U",
  };
}
function fhStart() {
  Object.assign(FH, { on: true, t: 0, cur: "", end: 0, gap: 0, seen: new Set(), q: [] });
  $("fhint").classList.remove("on");
  stickKnob.classList.toggle("drag", touchUI);   // DRAG pulses in the stick (css/99-first.css: a still label under reduced motion)
  topPlace();
}
function fhStop() {
  FH.on = false; $("fhint").classList.remove("on", "peek"); stickKnob.classList.remove("drag");
}
function fhOut() { $("fhint").classList.remove("on"); FH.cur = ""; FH.gap = FH.t + 18; }   // 300 ms to fade, then the next line may come
function fhTick() {
  if (!FH.on || !match || !match.first) return;
  if (G.phase === "over" || FIN.on) { if (FH.cur) fhOut(); return; }
  if (G.phase !== "play") return;
  const me = G.fighters[meSlot], op = G.fighters[1 - meSlot], S = STAGE.main, k = FH;
  k.t++;
  if ((k.t & 15) === 0) topPlace();
  if ((k.t & 3) === 0) tutPeek();
  if (k.t === 240) stickKnob.classList.remove("drag");   // DRAG: the first 4 s
  const off = !me.grounded && me.state !== "dead" && me.state !== "respawn" && (me.x > S.x2 + 10 || me.x < S.x1 - 10);
  // 0 s and 7 s are on the clock; the others come when it happens and go first (they only help right then)
  for (const [id, on] of [["go", true], ["mix", k.t >= 420], ["edge", off], ["pct", op.percent >= 100], ["ult", HU.rdy]]) {
    if (!on || k.seen.has(id)) continue;
    k.seen.add(id);
    if (id === "go" || id === "mix") k.q.push(id); else k.q.unshift(id);
  }
  const clock = k.cur === "go" || k.cur === "mix";
  if (k.cur && (k.t >= k.end || (clock && k.q.length && k.q[0] !== "go" && k.q[0] !== "mix"))) fhOut();
  if (!k.cur && k.q.length && k.t >= k.gap) {
    const id = k.q.shift(), sp = $("fhint").firstElementChild;
    k.cur = id; k.end = k.t + 300;   // 5 s
    sp.textContent = fhLines()[id]; sp.style.fontSize = "";
    for (let s = 16; sp.scrollWidth > sp.clientWidth + 1 && s > 11;) sp.style.fontSize = --s + "px";   // one line: a narrow band sets it smaller
    $("fhint").classList.add("on");
  }
}
// the stick was touched: DRAG has done its job
stickZone.addEventListener("pointerdown", () => stickKnob.classList.remove("drag"));
