/* ----- guided practice: short prompts the first time someone plays ----- */
const LIGHTK = new Set(["jab", "side", "up", "down", "nair", "sair", "uair", "dair"]);
const TUT = { on: false, i: 0, id: "move", x0: 0, lights: 0, hold: 0, calm: 0, dodges: 0 };
const TUT_CALM = 240;   // sim ticks the CPU waits (4 s) once the player is next to it, in the steps that need a hit to land
function tutSteps() {
  const t = touchUI, spec = G.fighters[0].spec;
  return [
    { id: "move", t: "Move", h: t ? "Drag on the left side of the screen." : "A and D, or the arrow keys.", b: null },
    { id: "jump", t: "Jump, then jump again", h: t ? "Tap Jump twice. The second jump happens in the air." : "Space twice. The second jump happens in the air.", b: "jump" },
    { id: "light", t: "Three light hits", h: `${t ? "Tap Light" : "Press J"} three times next to the CPU. The third hit launches.`, b: "light" },
    { id: "heavy", t: "Heavy attack", h: `${t ? "Tap Heavy" : "Press K"}. Slower, but it hits hard. Hold up or down to aim it.`, b: "heavy" },
    { id: "charge", t: "Hold to charge", h: t ? "Hold Heavy until its ring fills, then let go. Land one on the CPU." : "Hold K to power up, then let go. Land one on the CPU.", b: "heavy" },
    { id: "special", t: spec.signature.name, h: `${t ? "Tap Special" : "Press L"} for your signature move. It recharges after each use.`, b: "special" },
    { id: "dodge", t: "Dodge", h: `${t ? "Tap Dodge" : "Press Shift or V"} as the CPU attacks to slip through the hit. Hold a direction to roll.`, b: "dodge" },
    { id: "ult", t: "Ultimate", h: `Your bar is full. ${t ? "Tap ULTI" : "Press U"} for ${spec.ultimate.name}. The game freezes for a moment first.`, b: "ulti" },
    { id: "off", t: "Knock them off", h: "Their damage is high now, so they fly far. Hit them off the screen.", b: null },
  ];
}
function startTutorial() {
  Sfx.init(); hideOnline(); modal("help", false); modal("settings", false);
  P.tut = true; saveProfile();
  const me = FIG[sel.fighter] || FIGHTERS[0], opp = me.id === "odin" ? FIG.wizard : FIG.odin;
  const myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: opp.palettes[0] }], stocks: 9, time: 0, countdown: 120 });
  const easy = LEVELS.find((l) => l.name === "Easy").d;   // the same CPU as Practice > Easy
  match = { ranked: false, tutorial: true, d: easy, bot: makeBot(easy), level: "Tutorial" };
  meSlot = 0;
  Object.assign(TUT, { on: true, i: 0, x0: G.fighters[0].x, lights: 0, hold: 0, calm: TUT_CALM, dodges: 0 });
  enterMatchUI();
  app.classList.toggle("tutpad", touchUI);
  tutShow();
}
function tutShow() {
  const st = tutSteps(), s = st[TUT.i], el = $("tut");
  el.classList.remove("done");
  TUT.calm = TUT_CALM; TUT.id = s.id; TUT.dodges = 0;
  if (s.id === "ult") {   // offline and UI-side only: the player's bar is filled for this step (an ulti used by accident earlier is given back)
    const me = G.fighters[0];
    me.ultN = Math.min(me.ultN, BL.TUNE.ultMax - 1); me.ult = BL.ultNeed(me);
  }
  cntOnce("tut:" + s.id);   // ui/counter.js: the furthest step new players reach
  $("tutN").textContent = `Tutorial · ${TUT.i + 1} of ${st.length}`;
  $("tutT").textContent = s.t; $("tutH").textContent = s.h;
  for (const b of padBtns) b.classList.toggle("tutpulse", b.dataset.k === s.b);
}
function tutEnd() {
  TUT.on = false; $("tut").hidden = true; app.classList.remove("tut", "tutpad");
  $("tutNext").hidden = true; $("tutSkip").textContent = "Skip";   // the Combo trial's buttons (ui/combos.js)
  for (const b of padBtns) b.classList.remove("tutpulse");
}
function tutTick(evs) {
  if (match && match.trial) { for (const f of G.fighters) f.ult = 0; trialTick(evs); return; }   // the Combo trial runs on this engine (ui/combos.js); it has no ultimates
  if (!TUT.on || !match || !match.tutorial || !G || G.phase !== "play") return;
  const me = G.fighters[0], op = G.fighters[1], id = TUT.id;
  // nobody runs out of lives or gets launched far while learning
  me.stocks = Math.max(me.stocks, 5); me.percent = Math.min(me.percent, 60);
  // The CPU is a real Easy CPU, but it stands still while there is nothing it should punish: in the first two steps,
  // and for TUT_CALM ticks after the player walks up to it (again after every hit) in the steps that need a hit to land.
  const near = Math.abs(me.x - op.x) < 170 && Math.abs(me.y - op.y) < 90;
  const hitStep = id === "light" || id === "charge";
  if (hitStep && evs.some((e) => e.type === "hit" && e.def !== undefined)) TUT.calm = TUT_CALM;   // every hit, either way, gives the player another quiet spell
  if (hitStep && near && TUT.calm > 0) TUT.calm--;
  // the bar stays below full until the Ultimate step hands the player a full one (the ULTI button would pop out untaught)
  if (id !== "ult" && id !== "off") me.ult = Math.min(me.ult, BL.ultNeed(me) * 0.7);
  // the CPU attacks in the Dodge step, and stands still while the ulti is read
  const calm = id === "move" || id === "jump" || id === "ult" || (hitStep && TUT.calm > 0);
  match.bot.d = calm ? -1 : match.d;
  if (TUT.hold > 0) {
    if (--TUT.hold === 0) {
      TUT.i++; tutShow();
      if (TUT.id === "off") { op.percent = Math.max(op.percent, 120); op.stocks = 1; }
    }
    return;
  }
  let done = false;
  switch (id) {
    case "move": done = Math.abs(me.x - TUT.x0) > 110; break;
    case "jump": done = evs.some((e) => e.type === "jump" && e.slot === 0 && !e.ground); break;
    case "light": for (const e of evs) if (e.type === "hit" && e.slot === 0 && LIGHTK.has(me.mid)) TUT.lights++; done = TUT.lights >= 3; break;
    case "heavy": done = me.state === "attack" && !!me.mid && !LIGHTK.has(me.mid) && me.mid !== "spec"; break;
    case "charge": done = evs.some((e) => e.type === "hit" && e.slot === 0 && e.chg > 0); break;   // "hit" carries chg > 0 for a charged heavy
    case "special": done = me.mid === "spec"; break;
    case "dodge": {   // a dodge while the CPU is attacking close by (the dodge is what saves the player), or simply two dodges
      TUT.dodges += evs.filter((e) => e.type === "dodge" && e.slot === 0).length;
      const atk = op.state === "attack" && Math.abs(me.x - op.x) < 260 && Math.abs(me.y - op.y) < 160;
      done = (me.state === "dodge" && atk) || TUT.dodges >= 2;
      break;
    }
    case "ult": done = evs.some((e) => e.type === "ulti" && e.slot === 0); break;
  }
  if (done) {
    TUT.hold = id === "ult" ? 170 : 50;   // the ulti plays out (freeze 30 + up to 100 frames) before the last step starts
    $("tut").classList.add("done"); $("tutT").textContent = "Nice!";
    for (const b of padBtns) b.classList.remove("tutpulse");
    Sfx.ui();
  }
}
function tutDone() {
  tutEnd();
  mode = "result"; paused = false;
  modal("pause", false); modal("help", false); hideBanner();
  $("ctl").hidden = true; $("hud").hidden = true; releaseTouch();
  // the results screen (screens.js resOpen): your fighter on the panel, READY!, and on the right your rank as it stands (what the
  // Ranked match button plays for) instead of the match's stats and chips
  const me = G.fighters[0].spec;
  resOpen("win", me, true);
  if (match) match.finBy = "";
  $("rMode").textContent = "Tutorial"; $("rWho").textContent = me.name;
  resTitle("Ready!");
  $("rSub").textContent = "That's the basics. Ranked matches earn potato chips, and chips unlock new skins.";
  resRank(null);
  $("rStats").hidden = true;
  $("rAgain").querySelector("span").textContent = "Ranked match";
  $("rChange").querySelector("span").textContent = "Practice";
  show("result");
}
tap("tutSkip", () => { if (match && match.trial && TR.back !== null) { openRoad({ to: TR.back }); return; } tutEnd(); goMenu(); });   // a trial from a Road stop: Back to its sheet (openRoad ends the trial)
tap("hTry", startTutorial);

