/* ===================== loop ===================== */
function simTick() {
  if (mode === "result") { if (match && match.online) netTick(); return; }
  if (mode === "online" || mode === "select") netTick();
  const live = mode === "match" && G;
  const g = live ? G : attract.g;
  if (live) {
    if (paused) return;
    if (match.online) netTick();
    else {
      const pi = readPlayer();
      if (match.boss) step(G, bossInputs(pi));   // ui/boss.js: you and the CPU partner (the boss moves himself)
      else if (match.duo) step(G, duoInputs(pi));   // ui/duo.js: you, your CPU partner and the two CPU foes
      else step(G, [pi, botInput(G, G.fighters[1], G.fighters[0], match.bot)]);
    }
    if (G.phase === "countdown") {
      const n = Math.ceil(G.cd / 50);
      if (n !== lastCount && n > 0) { lastCount = n; showBanner(String(n), vsLine(), "count", 0); Sfx.count(false); }
    }
  } else {
    latch.clear();
    step(g, [botInput(g, g.fighters[0], g.fighters[1], attract.b0), botInput(g, g.fighters[1], g.fighters[0], attract.b1)]);
  }
  const evs = g.events.splice(0);
  if (live && match && match.tutorial) tutTick(evs);
  for (const e of evs) handleEvent(g, e, live);
  if (mode === "match" && G !== g) return;
  updateFx(g);
  camStep(g, false);
  tick++;
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = now - last; last = now;
  if (dt > 120) dt = 120;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) { acc -= STEP; n++; simTick(); }
  if (n === 5) acc = 0;
  const g = (mode === "match" || mode === "result") && G ? G : attract.g;
  if (mode !== "road") render(g, tick);   // the Road's map covers the whole screen: no fight drawn behind it
  if (mode === "match" && G) { updateHud(); hudDanger(); } else hudIdle();   // hud.js: danger edge glow
  if (mode === "select") { drawCards(tick); skinsDraw(tick); }   // skinsDraw: the Skin Rack's preview (ui/skins.js)
  if (mode === "online") drawOnlineArt(tick);
  if (mode === "road") roadDraw(tick);   // ui/road.js: the map
}

window.__blastline = { get game() { return G; }, get mode() { return mode; }, get net() { return NET; }, r3: PERF, perf: PERF, fin: FIN, get trial() { return match && match.trial ? { i: TR.i, id: TR.list[TR.i].id, keys: TR.list[TR.i].keys.slice(), k: TR.k, miss: TR.miss, hold: TR.hold } : null; }, get duoFocus() { return duoFocused(); }, get hud() { return { tag: tagAlpha(), glow: HX.k.slice(), reach: G && G.fighters[meSlot] ? launchReach(G.fighters[meSlot]) : null, tick }; } };
newAttract();
goMenu();
if (NET.invite) openOnline();
else if (firstRun && !ACCT.hash) startTutorial(); // a brand-new player starts with the guided round
camStep(attract.g, true);
requestAnimationFrame(frame);
})();
