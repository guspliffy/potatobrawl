/* ----- guided practice: short prompts the first time someone plays ----- */
const LIGHTK = new Set(["jab", "side", "up", "down", "nair", "sair", "uair", "dair"]);
const TUT = { on: false, i: 0, x0: 0, lights: 0, hold: 0 };
function tutSteps() {
  const t = touchUI, spec = G.fighters[0].spec;
  return [
    { t: "Move", h: t ? "Drag on the left side of the screen." : "A and D, or the arrow keys.", b: null },
    { t: "Jump, then jump again", h: t ? "Tap Jump twice. The second jump happens in the air." : "Space twice. The second jump happens in the air.", b: "jump" },
    { t: "Three light hits", h: `${t ? "Tap Light" : "Press J"} three times next to the dummy. The third hit launches.`, b: "light" },
    { t: "Heavy attack", h: `${t ? "Tap Heavy" : "Press K"}. Slower, but it hits hard. Hold up or down to aim it.`, b: "heavy" },
    { t: spec.signature.name, h: `${t ? "Tap Special" : "Press L"} for your signature move. It recharges after each use.`, b: "special" },
    { t: "Knock them off", h: "Their damage is high now, so they fly far. Hit them off the screen.", b: null },
  ];
}
function startTutorial() {
  Sfx.init(); hideOnline(); modal("help", false); modal("settings", false);
  P.tut = true; saveProfile();
  const me = FIG[sel.fighter] || FIGHTERS[0], opp = me.id === "odin" ? FIG.wizard : FIG.odin;
  const myPal = me.palettes[P.pal[me.id]] || me.palettes[0];
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: opp.palettes[0] }], stocks: 9, time: 0, countdown: 120 });
  match = { ranked: false, tutorial: true, d: -1, bot: makeBot(-1), level: "Tutorial" };
  meSlot = 0;
  Object.assign(TUT, { on: true, i: 0, x0: G.fighters[0].x, lights: 0, hold: 0 });
  enterMatchUI();
  tutShow();
}
function tutShow() {
  const st = tutSteps(), s = st[TUT.i], el = $("tut");
  el.classList.remove("done");
  $("tutN").textContent = `Tutorial · ${TUT.i + 1} of ${st.length}`;
  $("tutT").textContent = s.t; $("tutH").textContent = s.h;
  for (const b of padBtns) b.classList.toggle("tutpulse", b.dataset.k === s.b);
}
function tutEnd() {
  TUT.on = false; $("tut").hidden = true; app.classList.remove("tut");
  for (const b of padBtns) b.classList.remove("tutpulse");
}
function tutTick(evs) {
  if (!TUT.on || !match || !match.tutorial || !G || G.phase !== "play") return;
  const me = G.fighters[0], op = G.fighters[1];
  me.stocks = Math.max(me.stocks, 5); // nobody runs out of lives while learning
  if (TUT.hold > 0) {
    if (--TUT.hold === 0) {
      TUT.i++;
      if (TUT.i === 5) { op.percent = Math.max(op.percent, 120); op.stocks = 1; }
      tutShow();
    }
    return;
  }
  let done = false;
  switch (TUT.i) {
    case 0: done = Math.abs(me.x - TUT.x0) > 110; break;
    case 1: done = evs.some((e) => e.type === "jump" && e.slot === 0 && !e.ground); break;
    case 2: for (const e of evs) if (e.type === "hit" && e.slot === 0 && LIGHTK.has(me.mid)) TUT.lights++; done = TUT.lights >= 3; break;
    case 3: done = me.state === "attack" && !!me.mid && !LIGHTK.has(me.mid) && me.mid !== "spec"; break;
    case 4: done = me.mid === "spec"; break;
  }
  if (done) {
    TUT.hold = 50; $("tut").classList.add("done"); $("tutT").textContent = "Nice!";
    for (const b of padBtns) b.classList.remove("tutpulse");
    Sfx.ui();
  }
}
function tutDone() {
  tutEnd();
  mode = "result"; paused = false;
  modal("pause", false); modal("help", false); hideBanner();
  $("ctl").hidden = true; $("hud").hidden = true; releaseTouch();
  const sheet = $("resSheet"); sheet.classList.add("win", "solo"); sheet.classList.remove("loss");
  $("rMode").textContent = "Tutorial";
  $("rTitle").textContent = "Ready!";
  $("rSub").textContent = "That's the basics. Ranked matches earn potato chips, and chips unlock new skins.";
  $("rRank").hidden = true; $("rPick").hidden = true;
  $("rStats").textContent = ""; $("rChips").textContent = "";
  $("rAgain").disabled = false;
  $("rAgain").querySelector("span").textContent = "Ranked match";
  $("rChange").querySelector("span").textContent = "Practice";
  show("result");
}
tap("tutSkip", () => { tutEnd(); goMenu(); });
tap("hTry", startTutorial);

