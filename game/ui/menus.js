/* ----- wiring ----- */
// every wired control sounds its cue (Sfx.cue: a gold primary "goes", a back arrow or close X "goes back", the rest taps)
const tap = (id, fn) => { const el = $(id); el.addEventListener("click", (e) => { Sfx.init(); Sfx.cue(el); fn(e); }); };
// a tap on a disabled control gets a dull thud (disabled buttons get no click, but pointerdown still reaches them)
app.addEventListener("pointerdown", (e) => { const d = e.target.closest && e.target.closest("button:disabled, [aria-disabled='true']"); if (d && !d.closest("#ctl")) { Sfx.init(); Sfx.uiNo(); } }, true);
tap("bRanked", quickOpen);   // ui/quick.js: Quick match on our own server, else Ranked vs a CPU
tap("bPractice", () => openSelect("practice"));
tap("bCup", cupOpen);
tap("bDaily", dailyOpen);
tap("bRoad", openRoad);
tap("bHelp", openHelp);
tap("hClose", () => modal("help", false));
// from the Play friends lobby, Back and Use <fighter> both go back to it (the pick is saved on the tile tap)
tap("selBack", () => { if (sel.mode === "road") openRoad(); else if (sel.mode === "quick") { quickOpen(); qmCardIn(); } else if (sel.mode === "online") { openOnline(); fightCardIn(); } else goMenu(); });
tap("selGo", () => { goFull(); if (sel.mode === "online") { P.last = sel.fighter; saveProfile(); openOnline(); fightCardIn(); } else if (sel.mode === "quick") { P.last = sel.fighter; saveProfile(); quickOpen(); qmCardIn(); } else if (sel.mode === "cup") cupBegin(); else if (sel.mode === "road") { if (RD.sel >= ROAD.length) { openRoad(); roadSheet(RD.sel); } else roadFight(RD.sel); } else startMatch(); });
tap("pauseBtn", () => togglePause(true));
tap("pResume", () => togglePause(false));
tap("pHelp", openHelp);
tap("pQuit", () => {
  if (match && match.warm) { qmWarmQuit(); return; }   // ui/quick.js: the warm-up's Back to search
  if (match && match.qm) {   // ui/quick.js: a Ranked forfeit counts as a loss, a Casual match is just left
    if (!quitArmed) { quitArmed = true; $("pQuit").querySelector("span").textContent = match.qm.ranked || match.qm.sk ? "Tap again to forfeit" : "Tap again to leave"; return; }
    qmForfeit(); return;
  }
  if (match && match.online) {
    if (!quitArmed) { quitArmed = true; $("pQuit").querySelector("span").textContent = "Tap again to leave"; return; }
    leaveMatchRoom(); resetNet(); NET.phase = "idle"; NET.note = "You left the match."; openOnline(); return;
  }
  if (match.road) { openRoad(); return; }   // a Road stop or its boss: back to the map, nothing lost
  if (!match.ranked && !match.cup && !match.daily) { goMenu(); return; }
  if (!quitArmed) { quitArmed = true; $("pQuit").querySelector("span").textContent = "Tap again to forfeit"; return; }
  finishMatch(true);
});
tap("rAgain", () => {
  cntAgain();   // ui/counter.js
  stkLeave();   // ui/stakes.js: a challenge still out is withdrawn
  if (match && match.daily) { goMenu(); return; }   // one try a day: this button reads "Menu"
  goFull();
  if (match && match.tutorial) { quickOpen(); return; }
  if (match && match.online && match.tb) { tbAgain(); return; }   // a team brawl: Rematch (everyone still here taps), or Retry vs CPU after a lost connection
  if (match && (match.qm || match.warm) && qmAgain()) return;   // ui/quick.js: Next match, Another CPU fight
  if (match && match.online && match.boss && NET.cpuMate) {   // the partner dropped: Retry vs CPU (a Practice boss fight, same boss, level and partner)
    const lv = G.lv, boss = bossOf(G).spec.id, partner = G.fighters[1 - meSlot].spec.id;
    resetNet(); NET.phase = "idle"; lobbyPresence();
    startBoss({ level: lv, boss, partner });
    return;
  }
  if (match && match.online) {
    NET.rm = NET.matchId + 1;
    const nf = FIG[NET.nextF] ? NET.nextF : null;
    namedPresence({ rm: NET.rm, nf, np: nf ? palIdx(nf) : null });
    $("rAgain").disabled = true; updateRematchLabel();
    if (!$("rPick").hidden) buildNextPick();
    return;
  }
  if (match && match.ranked) { sel.mode = "ranked"; }
  if (match && match.road) { roadAgain(); return; }   // ui/road.js: Next stop after a win, Retry after a loss
  startMatch();
});
tap("rChange", () => {
  stkLeave();   // ui/stakes.js
  if (match && (match.qm || match.warm)) { qmChange(); return; }   // ui/quick.js
  if (match && match.tutorial) { openSelect("practice"); return; }
  if (match && match.online && match.tb) { tbBoard(); return; }   // a team brawl: Board, back to the seats in the same room
  if (match && match.online) { leaveMatchRoom(); resetNet(); NET.phase = "idle"; openOnline(); return; }
  if (match && match.road) { openRoad(); return; }
  openSelect(match && !match.ranked ? "practice" : "ranked");
});
tap("rMenu", () => { stkLeave(); goMenu(); });   // ui/stakes.js: a challenge still out is withdrawn
tap("bOnline", openOnline);
tap("onBack", goMenu);
tap("onChange", () => openSelect("online"));
tap("onHost", () => {
  if (NET.tb && NET.phase === "hosting") { goFull(); tbGo(); return; }   // a team brawl's START (ui/online-team.js)
  if (NET.tb && NET.phase === "board") { NET.note = ""; netCancel(); return; }   // a friend on the board: Leave
  if (NET.phase === "hosting") netCancel(); else { goFull(); netHost(); }
});
tap("onSwitch", tbSwitchMe);   // Switch side
tap("onClose", () => { if (NET.tb && NET.phase === "hosting") netCancel(); });   // the host closes the brawl
{
  const nameIn = $("onName");
  const commit = () => { if (window.__blSetName) { NET.myName = window.__blSetName(nameIn.value); nameIn.value = NET.myName; acctOnlineName(NET.myName); renderOnline(); } };
  nameIn.addEventListener("change", commit);
  nameIn.addEventListener("blur", commit);
  nameIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") nameIn.blur(); });
  nameIn.addEventListener("keyup", (e) => e.stopPropagation());
}
tap("onCopy", () => {
  const link = inviteLink(), btn = $("onCopy");
  const done = (ok) => { btn.textContent = ok ? "Copied" : "Select and copy"; setTimeout(() => { btn.textContent = "Copy link"; }, 1800); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents($("onLink")); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); done(false); };
  try { navigator.clipboard.writeText(link).then(() => done(true), fallback); } catch (e) { fallback(); }
});
tap("onShare", () => { try { navigator.share({ title: "PotatoBrawl", text: "Fight me in PotatoBrawl", url: inviteLink() }).catch(() => {}); } catch (e) { /* not available */ } });
/* ----- settings: sound, fullscreen, screen turning (Reset progress is in the Account sheet, ui/acct.js) ----- */
function chipRow(id, items, cur, pick, disabled) {
  const row = $(id); row.innerHTML = "";
  for (const [v, label] of items) {
    const b = document.createElement("button");
    b.className = "chip" + (v === cur ? " on" : ""); b.textContent = label; b.disabled = !!(disabled && disabled(v));
    b.addEventListener("click", () => { Sfx.init(); pick(v); Sfx.ui(); renderSettings(); });
    row.appendChild(b);
  }
}
function renderSettings() {
  chipRow("setSound", [[true, "On"], [false, "Off"]], !!P.sound, (v) => { P.sound = v; saveProfile(); });
  $("setFullRow").hidden = !FS.can;
  chipRow("setFull", [[true, "On"], [false, "Off"]], fsWanted(), (v) => { P.fs = v; saveProfile(); if (v) goFull(); else leaveFull(); });
  $("setScreenRow").hidden = !L.canRotate;
  chipRow("setScreen", [["cw", "Sideways"], ["ccw", "Flipped"], ["up", "Upright"]], P.screen || "cw", (v) => { P.screen = v; saveProfile(); releaseTouch(); resize(); });
  cntSettings();   // ui/counter.js: Play counts On / Off
  stkSettings();   // ui/stakes.js: Chip stakes On / Off
}
function openSettings() { renderSettings(); modal("settings", true); }
tap("bSettings", openSettings);
tap("pSettings", openSettings);
tap("setClose", () => { modal("settings", false); if (mode === "menu") renderMenu(); });
tap("a2hsOk", () => { P.a2hs = true; saveProfile(); renderMenu(); });

/* In sideways mode the browser's own touch scrolling would run along the wrong axis,
   so scrollable panels are dragged by hand, with a little momentum. */
let drag = null, suppressClick = false, glide = 0;
app.addEventListener("pointerdown", (e) => {
  if (!rotMode) return;
  const sc = e.target.closest(".scroll");
  if (!sc) return;
  cancelAnimationFrame(glide);
  const p = toApp(e.clientX, e.clientY);
  drag = { sc, id: e.pointerId, y0: p[1], top: sc.scrollTop, moved: false, ly: p[1], lt: performance.now(), v: 0 };
}, true);
app.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const p = toApp(e.clientX, e.clientY), now = performance.now();
  const dy = p[1] - drag.y0;
  if (!drag.moved && Math.abs(dy) > 8) drag.moved = true;
  if (drag.moved) {
    drag.sc.scrollTop = drag.top - dy;
    const dt = Math.max(1, now - drag.lt);
    drag.v = 0.7 * drag.v + 0.3 * ((p[1] - drag.ly) / dt);
    drag.ly = p[1]; drag.lt = now;
    e.preventDefault();
  }
}, true);
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.moved) {
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    const sc = drag.sc; let v = drag.v * 16;
    const run = () => { if (Math.abs(v) < 0.4) return; sc.scrollTop -= v; v *= 0.94; glide = requestAnimationFrame(run); };
    glide = requestAnimationFrame(run);
  }
  drag = null;
}
app.addEventListener("pointerup", endDrag, true);
app.addEventListener("pointercancel", endDrag, true);
app.addEventListener("click", (e) => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);

document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "match" && !paused && !(match && match.online)) togglePause(true); });
window.addEventListener("pointerdown", () => Sfx.init(), { passive: true });

/* ----- how to play: a picture of the controls, one line per control ----- */
const CTRL = [
  { k: "stick", name: "Stick", col: "#f3d9a4", key: "A D W S", text: "Move, and aim attacks up, down or sideways." },
  { k: "light", name: "Light", col: "#f3d9a4", key: "J", text: "Quick hits. The third in a row launches." },
  { k: "heavy", name: "Heavy", col: "#ef7a52", key: "K", text: "Strong hit. Up + Heavy in the air flies you back." },
  { k: "special", name: "Special", col: "#8fb6ff", key: "L", text: "Signature move, then a short recharge." },
  { k: "jump", name: "Jump", col: "#eef0fa", key: "Space", text: "Works again in the air." },
  { k: "dodge", name: "Dodge", col: "#a4a9c8", key: "Shift", text: "Slip through attacks. Softens a hard landing." },
  { k: "ulti", name: "Ulti", col: "#f3c84a", key: "U", text: "Only with a full gold bar. Freezes the game, then one huge move." },
];
function phoneFig() {
  // positions follow the real touch layout; the empty middle of the screen is left out
  const PAD = [["light", 708, 332, 40], ["heavy", 623, 323, 33], ["jump", 791, 255, 35], ["special", 705, 245, 29], ["dodge", 791, 337, 27], ["ulti", 693, 178, 27]], sh = 280;
  const C = Object.fromEntries(CTRL.map((c) => [c.k, c]));
  const btn = ([k, x, y, r]) => { const c = C[k], fs = k === "special" ? 11.5 : k === "dodge" ? 12 : k === "ulti" ? 12.5 : 16;
    return `<circle cx="${x - sh}" cy="${y}" r="${r}" fill="${k === "ulti" ? "rgba(243,200,74,.3)" : "rgba(14,16,34,.55)"}" stroke="${c.col}" stroke-width="3"/><text x="${x - sh}" y="${y + fs * 0.36}" font-size="${fs}" fill="${c.col}" text-anchor="middle">${c.name}</text>`; };
  return `<svg class="help-fig" viewBox="0 120 564 270" role="img" aria-label="Touch controls: stick on the left, six buttons on the right; the gold Ulti button only shows when the bar is full">
    <rect x="2" y="122" width="560" height="266" rx="26" fill="#14172e" stroke="rgba(206,210,255,.18)" stroke-width="2"/>
    <circle cx="120" cy="290" r="58" fill="rgba(14,16,34,.4)" stroke="rgba(243,217,164,.45)" stroke-width="3"/>
    <circle cx="142" cy="280" r="25" fill="#f3d9a4"/>
    <text x="120" y="210" font-size="16" fill="#f3d9a4" text-anchor="middle">Stick</text>
    ${PAD.map(btn).join("")}</svg>`;
}
function keysFig() {
  const key = (x, y, w, label, sub, c) => `<rect x="${x}" y="${y}" width="${w}" height="52" rx="8" fill="#232746" stroke="${c}" stroke-width="2.5"/><rect x="${x + 3}" y="${y + 46}" width="${w - 6}" height="4" rx="2" fill="rgba(0,0,0,.3)"/>
    <text x="${x + w / 2}" y="${y + 27}" font-size="20" fill="#eef0fa" text-anchor="middle">${label}</text><text x="${x + w / 2}" y="${y + 43}" font-size="11" fill="${c}" text-anchor="middle">${sub}</text>`;
  const S = "#f3d9a4";
  return `<svg class="help-fig" viewBox="0 0 490 186" role="img" aria-label="Keyboard controls">
    ${key(64, 6, 52, "W", "up", S)}${key(6, 64, 52, "A", "left", S)}${key(64, 64, 52, "S", "down", S)}${key(122, 64, 52, "D", "right", S)}
    ${key(256, 6, 52, "J", "light", "#f3d9a4")}${key(314, 6, 52, "K", "heavy", "#ef7a52")}${key(372, 6, 52, "L", "special", "#8fb6ff")}${key(430, 6, 52, "U", "ulti", "#f3c84a")}
    ${key(6, 128, 110, "Shift", "dodge", "#a4a9c8")}${key(126, 128, 240, "Space", "jump", "#eef0fa")}${key(376, 128, 88, "Esc", "pause", "#a4a9c8")}</svg>`;
}
// the Ultimates part: the bar, the button, the freeze, and how to escape each fighter's ulti (the "text" of spec.ultimate says it)
function renderHelpUlt() {
  $("helpUlt").innerHTML = `<h4>Ultimates</h4>
    <p>The bar under your name fills when you hit, get hit and lose a heart. When it is full, ${touchUI ? "tap the gold <b>ULTI</b> button" : "press <b>U</b> (<b>Y</b> on a gamepad)"}: the game freezes for a moment, then your fighter does one huge move, up to twice a match. <b>Every ulti can be escaped</b>:</p>
    <div class="ul-grid">${FIGHTERS.map((f) => `<div class="ul" style="--fc:${col(f.palettes[0])}"><div class="ul-n"><b>${f.name}</b>${f.ultimate.name}</div><span>${f.ultimate.text}</span></div>`).join("")}</div>`;
}
function openHelp() {
  renderHelpUlt();
  $("helpFig").innerHTML = touchUI ? phoneFig() : keysFig();
  $("helpKeys").innerHTML = CTRL.map((c) => `<dt style="--kc:${c.col}">${c.name}${touchUI ? "" : `<kbd>${c.key}</kbd>`}</dt><dd>${c.text}</dd>`).join("");
  $("helpGo").hidden = mode === "match";
  $("helpPadK").hidden = $("helpPad").hidden = touchUI;
  renderHelpCombos();   // ui/combos.js
  modal("help", true);
}

