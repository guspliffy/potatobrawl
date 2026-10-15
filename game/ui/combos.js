/*ROUTES*/
/* ===================== combos: routes in the pop-up, route cards in How to play, the Combo trial ===================== */
// The pop-up: follows each fighter's combo and names the route its hits make (the best one so far in this combo).
const comboT = [{}, {}];
function comboRoute(g, e) {
  const t = comboT[e.slot], f = g.fighters[e.slot];
  if (!t || !f) return null;
  if (e.combo === 1) t.best = null;
  const r = ROUTES.track(t, e, f.spec.id);
  const fresh = !!r && t.best !== r;
  if (r) t.best = r;
  return t.best ? { id: t.best.id, name: t.best.name, fresh } : null;
}

/* ----- route cards: each step a small key (arrow + button), in the button's colour ----- */
const RK = {
  jab: ["", "light"], side: ["→", "light"], up: ["↑", "light"], down: ["↓", "light"], nair: ["", "light"], uair: ["↑", "light"],
  hSide: ["→", "heavy"], hUp: ["↑", "heavy"], hDown: ["↓", "heavy"], hAir: ["", "heavy"], spec: ["", "special"], jump: ["", "jump"],
};
const RK_NAME = { light: "Light", heavy: "Heavy", special: "Special", jump: "Jump" };
function routeKeysHTML(r, lit) {   // each key after the first keeps its dash in front of it, so a wrapped line never ends in a dash
  return r.keys.map((k, i) => {
    const [arrow, b] = RK[k.replace("!", "")], hold = k.endsWith("!");
    const key = `<span class="rk rk-${b}${lit && lit[i] ? " on" : ""}">${arrow ? `<i>${arrow}</i>` : ""}<b>${RK_NAME[b]}</b>${hold ? "<em>hold</em>" : ""}</span>`;
    return i ? `<span class="rk-g"><span class="rk-sep"></span>${key}</span>` : key;
  }).join("");
}
const ROUTE_HINT = {
  three: "Light, Light, then push the stick toward them and Light again. The third hit sends them flying.",
  lift: "Side light, up light, then up + Heavy the moment the up light lands.",
  trip: "Down light, side light, then down + Heavy right away. Works at low damage.",
  rising: "Stick toward them + Light, stick up + Light, Jump the moment it lands, then Light in the air with no direction.",
  sig: "Two side lights, then Special the moment the second one lands.",
  skyburn: "Stick up + Light twice, Jump right as the second one hits, then Heavy in the air for the fiery headbutt.",
  lab: "Down light, up light, then up + Heavy right away.",
  hammer: "Two jabs, then side + Heavy and keep holding it a moment before you let go.",
  staff: "Two side lights, then side + Heavy the moment the second one lands.",
  blink: "Side light, up light, then Special the moment the up light lands.",
  tail: "Down light, side light, then Special right away.",
  whip: "Two jabs, then Special the moment the second one lands.",
  reap: "Stick down + Light twice, then Special for Harvest the moment the second one lands. The spin is the finisher.",
};
const routesDone = () => (Array.isArray(P.routes) ? P.routes : []);
const ROUTE_TOTAL = ROUTES.ALL.length;
const COMBO_CHIPS = 30;

/* ----- How to play: the link in one line, the routes of one fighter, the trial button ----- */
let helpFid = null;
function renderHelpCombos() {
  const box = $("helpCombos");
  if (!FIG[helpFid]) helpFid = FIG[P.last] ? P.last : FIGHTERS[0].id;
  const done = new Set(routesDone());
  const figs = FIGHTERS.map((f) => `<button class="chip${f.id === helpFid ? " on" : ""}" data-f="${f.id}">${f.name}${done.has(ROUTES.OWN[f.id].id) ? ' <span class="rk-ok" aria-label="route cleared"></span>' : ""}</button>`).join("");
  const cards = ROUTES.forFighter(helpFid).map((r) => `<div class="rc${done.has(r.id) ? " ok" : ""}"><div class="rc-n">${r.name}${r.fighter ? `<small>${FIG[r.fighter].name} only</small>` : ""}${done.has(r.id) ? '<span class="rk-ok" aria-label="cleared"></span>' : ""}</div><div class="rc-k">${routeKeysHTML(r)}</div></div>`).join("");
  box.innerHTML = `<h4>Combos</h4>
    <p>The second light hit in a row opens <b>the link</b>: a Heavy, Special or Jump pressed the moment it lands comes out faster, and at low damage it can't be escaped. Combos that follow a route show its name.</p>
    <div class="rc-figs" role="group" aria-label="Routes of">${figs}</div>
    <div class="rc-grid">${cards}</div>
    <div class="rc-foot"><span class="rc-count">${done.size} of ${ROUTE_TOTAL} routes cleared${done.size >= ROUTE_TOTAL ? " · Combo Potato" : ` · all ${ROUTE_TOTAL}: the title Combo Potato and ${COMBO_CHIPS} chips`}</span><span id="helpTrialW"><button class="btn" id="hTrial"><span>Combo trial</span></button></span></div>`;
  for (const b of box.querySelectorAll(".rc-figs .chip")) b.addEventListener("click", () => { Sfx.init(); Sfx.ui(); helpFid = b.dataset.f; renderHelpCombos(); });
  $("helpTrialW").hidden = mode === "match";
  $("hTrial").addEventListener("click", () => { Sfx.init(); Sfx.ui(); goFull(); startTrial(helpFid); });
}

/* ----- the Combo trial: the tutorial's engine, a CPU that stands still, one route at a time ----- */
const TR = { fid: null, list: [], i: 0, k: 0, t: {}, miss: 0, hold: 0, next: null, place: 0, air: false };
function startTrial(fid) {
  Sfx.init(); hideOnline(); modal("help", false); modal("settings", false);
  // the dummy is always Odin (the heaviest fighter, the one every route is tested on: tests/combos.js); against Odin himself in another skin
  const me = FIG[fid] || FIGHTERS[0], opp = FIG.odin, mi = P.pal[me.id] || 0;
  const myPal = me.palettes[mi] || me.palettes[0], opPal = opp.palettes[me.id === "odin" ? (mi + 1) % opp.palettes.length : 0];
  G = newGame({ players: [{ spec: me, pal: myPal }, { spec: opp, pal: opPal }], stocks: 9, time: 0, countdown: 90 });
  match = { ranked: false, tutorial: true, trial: true, d: -1, bot: makeBot(-1), level: "Combo trial" };
  meSlot = 0;
  const list = ROUTES.forFighter(me.id), done = new Set(routesDone());
  Object.assign(TR, { fid: me.id, list, i: Math.max(0, list.findIndex((r) => !done.has(r.id))), hold: 0, next: null });
  enterMatchUI();
  app.classList.toggle("tutpad", touchUI);
  $("tutNext").hidden = false; $("tutSkip").textContent = "Exit";
  trialRoute();
}
// a fresh try at the current route: the CPU stands a step in front, at the route's damage
function trialRoute() {
  const r = TR.list[TR.i];
  Object.assign(TR, { k: 0, t: {}, miss: 0, air: false });
  $("tut").classList.remove("done");
  $("tutN").textContent = `Combo trial · ${FIG[TR.fid].name} · ${TR.i + 1} of ${TR.list.length}`;
  $("tutT").textContent = r.name;
  trialKeys();
  TR.place = 1;
}
function trialKeys() {
  const r = TR.list[TR.i], lit = [];
  let h = 0;
  for (const k of r.keys) {
    if (k === "jump") lit.push(TR.k > h || (TR.k === h && h > 0 && TR.air));
    else { lit.push(h < TR.k); h++; }
  }
  const hint = TR.miss >= 3 ? `<span class="tut-hint">${ROUTE_HINT[r.id] || ""}</span>` : "";
  $("tutH").innerHTML = `<span class="rk-row">${routeKeysHTML(r, lit)}</span>${hint}`;
}
// puts the CPU back in front of the player (also after it was knocked out), at the route's damage
function trialPlace() {
  const me = G.fighters[0], op = G.fighters[1], S = STAGE.main, r = TR.list[TR.i];
  if (op.state === "dead") return false;
  const side = me.x > S.x2 - 120 ? -1 : me.x < S.x1 + 120 ? 1 : me.facing;
  Object.assign(op, { x: clamp(me.grounded ? me.x + side * 70 : side * 40, S.x1 + 40, S.x2 - 40), y: S.top, vx: 0, vy: 0, kbx: 0, kby: 0, grounded: true, plat: -1,
    hitstun: 0, tumble: false, invuln: 0, percent: r.pct, facing: -side, combo: 0, strN: 0, freeT: 99, doomed: false });
  op.state = "idle"; op.st = 0; op.move = null; op.mid = null;
  if (me.grounded) me.facing = side;
  me.specCd = 0;   // every try starts with the special ready
  return true;
}
function trialProgress(list, want) {   // the longest start of the route the combo's last moves match
  for (let n = Math.min(want.length, list.length); n > 0; n--) {
    const tail = list.slice(list.length - n);
    if (want.slice(0, n).every((w, i) => (w.endsWith("!") ? tail[i] === w : tail[i].replace("!", "") === w))) return n;
  }
  return 0;
}
function trialTick(evs) {
  if (!G || G.phase !== "play") return;
  const me = G.fighters[0], op = G.fighters[1], r = TR.list[TR.i], want = ROUTES.hits(r);
  me.stocks = Math.max(me.stocks, 5); op.stocks = Math.max(op.stocks, 5); me.percent = Math.min(me.percent, 60);
  if (TR.place && trialPlace()) TR.place = 0;
  if (TR.hold > 0) {
    if (--TR.hold === 0) {
      if (TR.next !== null) { TR.i = TR.next; TR.next = null; }
      trialRoute();
    }
    return;
  }
  let changed = false;
  for (const e of evs) {
    if (e.type !== "hit" || e.slot !== 0 || e.def !== 1) continue;
    ROUTES.track(TR.t, e, TR.fid);
    const k = trialProgress(TR.t.list, want);
    if (TR.k > 0 && k === 0) TR.miss++;
    TR.k = k; changed = true;
    if (k === want.length) return trialClear(r);
  }
  if (r.keys.includes("jump") && TR.k > 0 && !me.grounded && !TR.air) { TR.air = true; changed = true; }
  // the combo is over (the CPU was free long enough) or it is far off: count a miss and set up again
  const over = TR.k > 0 && op.freeT >= BL.TUNE.strGap && op.state !== "hitstun";
  if (over || op.state === "dead" || (op.state === "respawn")) {
    if (over) TR.miss++;
    if (op.state === "respawn") { op.state = "air"; op.st = 0; }
    TR.k = 0; TR.t = {}; TR.air = false; TR.place = 1; changed = true;
  }
  if (changed) trialKeys();
}
function trialClear(r) {
  const before = routesDone(), first = !before.includes(r.id);
  if (first) P.routes = [...before, r.id];
  let note = first ? "Cleared!" : "Cleared again!";
  if (first && P.routes.length >= ROUTE_TOTAL && !P.comboPaid) {
    P.comboPaid = true; P.tokens += COMBO_CHIPS;
    showBanner("Combo Potato", `All ${ROUTE_TOTAL} routes · +${COMBO_CHIPS} chips`, "fin", 2200, "#ffd23f");
  }
  if (first) saveProfile();
  TR.k = want0(r).length; trialKeys();
  $("tut").classList.add("done"); $("tutT").textContent = `${r.name}: ${note}`;
  Sfx.route();
  const done = new Set(routesDone()), nx = TR.list.findIndex((q, j) => j > TR.i && !done.has(q.id));
  TR.next = nx >= 0 ? nx : (TR.i + 1) % TR.list.length;
  TR.hold = 80;
}
const want0 = (r) => ROUTES.hits(r);
function trialNext() { if (!match || !match.trial) return; TR.i = (TR.i + 1) % TR.list.length; TR.hold = 0; TR.next = null; trialRoute(); }
tap("tutNext", trialNext);
