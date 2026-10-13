/* ----- wiring ----- */
const tap = (id, fn) => $(id).addEventListener("click", (e) => { Sfx.init(); Sfx.ui(); fn(e); });
tap("bRanked", () => openSelect("ranked"));
tap("bPractice", () => openSelect("practice"));
tap("bHelp", openHelp);
tap("hClose", () => modal("help", false));
tap("selBack", goMenu);
tap("selUp", buyPending);
tap("selGo", () => { if (sel.mode === "online") { P.last = sel.fighter; saveProfile(); openOnline(); } else startMatch(); });
tap("pauseBtn", () => togglePause(true));
tap("pResume", () => togglePause(false));
tap("pHelp", openHelp);
tap("pQuit", () => {
  if (match && match.online) {
    if (!quitArmed) { quitArmed = true; $("pQuit").querySelector("span").textContent = "Tap again to leave"; return; }
    leaveMatchRoom(); resetNet(); NET.phase = "idle"; NET.note = "You left the match."; openOnline(); return;
  }
  if (!match.ranked) { goMenu(); return; }
  if (!quitArmed) { quitArmed = true; $("pQuit").querySelector("span").textContent = "Tap again to forfeit"; return; }
  finishMatch(true);
});
tap("rAgain", () => {
  if (match && match.tutorial) { openSelect("ranked"); return; }
  if (match && match.online) {
    NET.rm = NET.matchId + 1;
    const nf = FIG[NET.nextF] ? NET.nextF : null;
    namedPresence({ rm: NET.rm, nf, np: nf ? palIdx(nf) : null });
    $("rAgain").disabled = true; updateRematchLabel();
    if (!$("rPick").hidden) buildNextPick();
    return;
  }
  if (match && match.ranked) { sel.mode = "ranked"; }
  startMatch();
});
tap("rChange", () => {
  if (match && match.tutorial) { openSelect("practice"); return; }
  if (match && match.online) { leaveMatchRoom(); resetNet(); NET.phase = "idle"; openOnline(); return; }
  openSelect(match && !match.ranked ? "practice" : "ranked");
});
tap("rMenu", goMenu);
tap("bOnline", openOnline);
tap("onBack", goMenu);
tap("onChange", () => openSelect("online"));
tap("onHost", () => { if (NET.phase === "hosting") netCancel(); else netHost(); });
{
  const nameIn = $("onName");
  const commit = () => { if (window.__blSetName) { NET.myName = window.__blSetName(nameIn.value); nameIn.value = NET.myName; renderOnline(); } };
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
/* ----- settings: sound, graphics, screen turning, reset ----- */
let resetArmed = false;
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
  chipRow("setGfx", [["3d", "3D"], ["2d", "2D"]], R3.failed ? "2d" : P.gfx === "2d" ? "2d" : "3d", (v) => { P.gfx = v; saveProfile(); }, (v) => R3.failed && v === "3d");
  $("setGfxNote").hidden = !R3.failed; $("setGfxNote").textContent = "3D isn't supported on this device.";
  $("setScreenRow").hidden = !L.canRotate;
  chipRow("setScreen", [["cw", "Sideways"], ["ccw", "Flipped"], ["up", "Upright"]], P.screen || "cw", (v) => { P.screen = v; saveProfile(); releaseTouch(); resize(); });
  const rb = $("setReset");
  rb.textContent = resetArmed ? "Tap again to erase rating, chips and skins" : "Reset progress";
}
function openSettings() { resetArmed = false; renderSettings(); modal("settings", true); }
tap("bSettings", openSettings);
tap("pSettings", openSettings);
tap("setClose", () => { modal("settings", false); if (mode === "menu") renderMenu(); });
tap("setReset", () => {
  if (!resetArmed) { resetArmed = true; renderSettings(); return; }
  resetArmed = false; P = defProfile(); P.tut = true; saveProfile(); sel.fighter = P.last; renderSettings(); renderMenu();
});

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
];
function phoneFig() {
  // positions follow the real touch layout; the empty middle of the screen is left out
  const PAD = [["light", 708, 332, 40], ["heavy", 623, 323, 33], ["jump", 791, 255, 35], ["special", 705, 245, 29], ["dodge", 791, 337, 27]], sh = 280;
  const C = Object.fromEntries(CTRL.map((c) => [c.k, c]));
  const btn = ([k, x, y, r]) => { const c = C[k], fs = k === "special" ? 11.5 : k === "dodge" ? 12 : 16;
    return `<circle cx="${x - sh}" cy="${y}" r="${r}" fill="rgba(14,16,34,.55)" stroke="${c.col}" stroke-width="3"/><text x="${x - sh}" y="${y + fs * 0.36}" font-size="${fs}" fill="${c.col}" text-anchor="middle">${c.name}</text>`; };
  return `<svg class="help-fig" viewBox="0 150 564 240" role="img" aria-label="Touch controls: stick on the left, five buttons on the right">
    <rect x="2" y="152" width="560" height="236" rx="26" fill="#14172e" stroke="rgba(206,210,255,.18)" stroke-width="2"/>
    <circle cx="120" cy="290" r="58" fill="rgba(14,16,34,.4)" stroke="rgba(243,217,164,.45)" stroke-width="3"/>
    <circle cx="142" cy="280" r="25" fill="#f3d9a4"/>
    <text x="120" y="210" font-size="16" fill="#f3d9a4" text-anchor="middle">Stick</text>
    ${PAD.map(btn).join("")}</svg>`;
}
function keysFig() {
  const key = (x, y, w, label, sub, c) => `<rect x="${x}" y="${y}" width="${w}" height="52" rx="8" fill="#232746" stroke="${c}" stroke-width="2.5"/><rect x="${x + 3}" y="${y + 46}" width="${w - 6}" height="4" rx="2" fill="rgba(0,0,0,.3)"/>
    <text x="${x + w / 2}" y="${y + 27}" font-size="20" fill="#eef0fa" text-anchor="middle">${label}</text><text x="${x + w / 2}" y="${y + 43}" font-size="11" fill="${c}" text-anchor="middle">${sub}</text>`;
  const S = "#f3d9a4";
  return `<svg class="help-fig" viewBox="0 0 470 186" role="img" aria-label="Keyboard controls">
    ${key(64, 6, 52, "W", "up", S)}${key(6, 64, 52, "A", "left", S)}${key(64, 64, 52, "S", "down", S)}${key(122, 64, 52, "D", "right", S)}
    ${key(256, 6, 52, "J", "light", "#f3d9a4")}${key(314, 6, 52, "K", "heavy", "#ef7a52")}${key(372, 6, 52, "L", "special", "#8fb6ff")}
    ${key(6, 128, 110, "Shift", "dodge", "#a4a9c8")}${key(126, 128, 240, "Space", "jump", "#eef0fa")}${key(376, 128, 88, "Esc", "pause", "#a4a9c8")}</svg>`;
}
function openHelp() {
  $("helpFig").innerHTML = touchUI ? phoneFig() : keysFig();
  $("helpKeys").innerHTML = CTRL.map((c) => `<dt style="--kc:${c.col}">${c.name}${touchUI ? "" : `<kbd>${c.key}</kbd>`}</dt><dd>${c.text}</dd>`).join("");
  $("helpGo").hidden = mode === "match";
  $("helpPadK").hidden = $("helpPad").hidden = touchUI;
  modal("help", true);
}

