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
      const bi = botInput(G, G.fighters[1], G.fighters[0], match.bot);
      step(G, [pi, bi]);
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
  render(g, tick);
  if (mode === "match" && G) updateHud();
  if (mode === "select") drawCards(tick);
  if (mode === "online") drawOnlineArt(tick);
}

window.__blastline = { get game() { return G; }, get mode() { return mode; }, get net() { return NET; }, r3: R3, fin: FIN, cine: CINE, films: FILMS };
newAttract();
goMenu();
if (NET.invite) openOnline();
else if (firstRun) startTutorial(); // a brand-new player starts with the guided round
camStep(attract.g, true);
requestAnimationFrame(frame);
})();
