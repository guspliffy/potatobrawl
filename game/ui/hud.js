/* ===================== match HUD extras (UI only) =====================
   Reads the game state, never writes it. Three things live here:
   1. The YOU / CPU markers over the fighters: shown from the countdown, faded out 3 s after the match starts, and back for 3 s
      after every respawn (and at the start of sudden death). The tutorial keeps them on. drawTag (draw-world.js) asks tagAlpha().
   2. The danger edge glow (#dgr): while the player's own fighter is flying out of a hard launch, a thin red glow lights the edge
      the launch is heading for. Calibrated against the simulation's own "lethal" call (see the comment on launchDanger).
   3. The fight buttons go see-through when a fighter is near the right ledge or behind a button (padsStep, css/91-pads.css).
   The ultimate bars and the ULTI button come after them (see below). */
const HX = { g: null, ph: "", sd: false, alive: [true, true, true, true], from: 0, until: Infinity, k: [0, 0, 0, 0], t: 0, on: false, pz: null, pzT: -99 };
const TAG_HOLD = 180, TAG_FADE = 30, TAG_IN = 12;   // sim ticks (60 per second): shown 3 s, fades out in 0.5 s, comes back in 0.2 s
const dgrEls = [...$("dgr").children];               // left, right, top, bottom
const reducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

function tagAlpha() {
  if (match && match.tutorial) return 1;
  return Math.min(clamp((HX.until - tick) / TAG_FADE, 0, 1), clamp((tick - HX.from) / TAG_IN, 0, 1));
}
function tagShow() {
  HX.from = tick - tagAlpha() * TAG_IN;   // coming back from a half-faded marker continues from where it is
  HX.until = tick + TAG_HOLD;
}
// once per sim tick of the live match (updateFx)
function tagStep(g) {
  if (HX.g !== g) { HX.g = g; HX.ph = ""; HX.sd = false; HX.alive = [true, true, true, true]; HX.from = tick; HX.until = Infinity; }
  if (g.phase === "play" && HX.ph !== "play") HX.until = tick + TAG_HOLD;   // the match starts: markers stay 3 s
  HX.ph = g.phase;
  if (g.sudden && !HX.sd) { HX.sd = true; tagShow(); }   // sudden death puts both fighters back on the stage
  g.fighters.forEach((f, i) => {
    const alive = f.state !== "dead" && f.state !== "gone";
    if (alive && !HX.alive[i]) tagShow();   // a respawn
    HX.alive[i] = alive;
  });
}

/* ---------- danger edge glow ----------
   Walks the launch forward with the simulation's own numbers (knockback loses TUNE.kbDecay a tick, gravity is TUNE.hitGrav of
   normal while in hitstun, the stage is ignored) until the push has died out or a blast line is reached, and keeps the farthest
   point towards each blast line.
   0 is the edge of the stage (for the top: a head height of -300), 1 is the blast line. Over 28,000 launches in bot matches (all
   sides): all but 2 of the 2,232 launches the simulation called lethal reach 0.95 or more (the walk stops at 1.0), 99% of the launches
   that were not KOs end at 1.0 or less, and between 0.45 and 0.95 about 1 launch in 25 was a KO. So the glow starts at 0.45 (a launch that ends
   well out past the stage, where DI and a recovery matter) and is full at 0.95 (a KO unless the player does something). */
function launchReach(f) {
  const B = STAGE.blast, s = f.s, gr = s.gravity * BL.TUNE.hitGrav, h = s.h, S = STAGE.main, down = f.kby + f.vy > 2;
  let x = f.x, y = f.y, kx = f.kbx, ky = f.kby, vy = f.vy;
  let minX = x, maxX = x, minHead = y - h, maxY = -9999;
  for (let i = 0; i < 160; i++) {
    if (vy < s.fallSpeed) vy = Math.min(vy + gr, s.fallSpeed); else vy = Math.max(s.fallSpeed, vy - 0.5);
    const mag = Math.hypot(kx, ky), n = mag - BL.TUNE.kbDecay;
    if (n <= 0) { kx = 0; ky = 0; } else { kx *= n / mag; ky *= n / mag; }
    x += f.vx + kx; y += vy + ky;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (ky + vy < 0 && y - h < minHead) minHead = y - h;   // the top line only takes a launch that is still rising
    if ((x < S.x1 || x > S.x2) && y > maxY) maxY = y;      // beside the stage
    if (x < B.left || x > B.right || y > B.bottom || (ky + vy < 0 && y - h < B.top)) break;   // it has reached a blast line
    if (kx === 0 && ky === 0) break;
  }
  // left, right, top; the bottom only counts for a launch that starts out heading down (a meteor), not for the fall after a sideways one
  return [(S.x1 - minX) / (S.x1 - B.left), (maxX - S.x2) / (B.right - S.x2), (-minHead - 300) / (-B.top - 300), down && maxY > -9999 ? (maxY - S.bottom) / (B.bottom - S.bottom) : 0];
}
const dangerK = (v) => clamp((v - 0.45) / 0.5, 0, 1);
const launchDanger = (f) => launchReach(f).map(dangerK);
// every frame while a match is on: set the edge glow from the player's own fighter. It eases in quickly and out slowly (per
// 1/60 s, so a slow device sees the same timing); a pause, the KO finisher and the end of a match switch it off at once.
function hudDanger() {
  let t = [0, 0, 0, 0];
  const f = G && G.fighters[meSlot], now = performance.now(), fr = Math.min(6, (now - (HX.t || now)) / 16.67);
  HX.t = now;
  const snap = FIN.on || !f || mode !== "match" || paused || G.phase !== "play";
  if (!snap && f.state === "hitstun" && f.tumble && !f.doomed) t = launchDanger(f);
  const rm = reducedMotion(), pul = rm ? 0.8 : 0.74 + 0.26 * Math.sin(tick * 0.22), up = 1 - Math.pow(0.55, fr), down = 1 - Math.pow(0.91, fr);
  let any = false;
  for (let i = 0; i < 4; i++) {
    const cur = HX.k[i];
    const v = snap ? 0 : t[i] > cur ? (rm ? t[i] : cur + (t[i] - cur) * up) : cur + (t[i] - cur) * down;
    HX.k[i] = v < 0.01 ? 0 : v;
    const o = (HX.k[i] * pul).toFixed(2);
    if (dgrEls[i].style.opacity !== o) dgrEls[i].style.opacity = o;
    if (HX.k[i]) any = true;
  }
  HX.on = any;
  padsStep();
}
// outside a match (menus, results): make sure no glow is left over
function hudIdle() {
  padsOff();
  if (!HX.on) return;
  for (let i = 0; i < 4; i++) { HX.k[i] = 0; dgrEls[i].style.opacity = "0"; }
  HX.on = false;
}
/* ---------- the fight buttons see through (UI only; the look and the fade are css/91-pads.css) ----------
   On a landscape phone the five round buttons on the right (all but ULTI) cover the right ledge. Two cases, only in a landscape match
   (not under the upright control panel, not in the KO finisher, not on a menu), for every fighter that is not a boss:
   1. all five at once while a fighter is within 60 world px of the right ledge (STAGE.main.x2) or out beyond it, if that ledge is in the
      buttons' corner on screen;
   2. one button alone while a fighter's box, with 24 screen px around it, overlaps that button's disc.
   Each case holds for 0.3 s after it ends, so a fighter stepping to and fro makes no flicker. The class .see goes on the button; a pressed
   button is whole whatever the class says (CSS). Reads the sim, never writes it; the touch areas are not touched. */
const PADS = { b: [...document.querySelectorAll('.pb:not([data-k="ulti"])')], d: [], box: null, key: "", dT: -9999, all: 0, one: [0, 0, 0, 0, 0], on: [false, false, false, false, false] };
const PADS_RIGHT = 60, PADS_PAD = 24, PADS_HOLD = 300;   // world px from the ledge, screen px around a box, ms
// each disc as a circle in the app's own pixels (toApp undoes the sideways turn); the disc is 92% of its touch circle. Re-measured now and then.
function padsMeasure(now) {
  const key = W + "x" + H + "r" + rotMode;
  if (key === PADS.key && now - PADS.dT < 500) return;
  PADS.key = key; PADS.dT = now;
  PADS.d = PADS.b.map((b) => {
    const q = b.getBoundingClientRect();
    if (q.width < 1) return null;
    const [x1, y1] = toApp(q.left, q.top), [x2, y2] = toApp(q.right, q.bottom);
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, r: Math.abs(x2 - x1) * 0.46 };
  });
  const ds = PADS.d.filter(Boolean);   // the corner the five discs take up (left and top edges)
  PADS.box = ds.length ? { x: Math.min(...ds.map((d) => d.x - d.r)), y: Math.min(...ds.map((d) => d.y - d.r)) } : null;
}
function padsOff() {
  PADS.all = 0; PADS.one.fill(0);
  PADS.b.forEach((b, k) => { if (PADS.on[k]) { PADS.on[k] = false; b.classList.remove("see"); } });
}
// every frame of a match (hudDanger)
function padsStep() {
  if (mode === "match" && paused) return;   // a pause keeps things as they are
  if (mode !== "match" || !G || G.phase === "over" || FIN.on || L.panel || $("ctl").hidden) { padsOff(); return; }
  const now = performance.now(), S = STAGE.main, hit = [false, false, false, false, false];
  padsMeasure(now);
  // the ledge rule only while the ledge itself is on screen in the buttons' corner (a big window shows it above them, clear)
  const lg = toScreen(S.x2, S.top), under = !!PADS.box && lg[0] > PADS.box.x - 30 && lg[1] > PADS.box.y - 30;
  for (const f of G.fighters) {
    if (f.state === "dead" || f.state === "gone" || f.spec.boss) continue;
    if (under && f.x > S.x2 - PADS_RIGHT) PADS.all = now + PADS_HOLD;
    const hw = f.s.w / 2, a = toScreen(f.x - hw, f.y - f.s.h), c = toScreen(f.x + hw, f.y);
    const x1 = a[0] - PADS_PAD, y1 = a[1] - PADS_PAD, x2 = c[0] + PADS_PAD, y2 = c[1] + PADS_PAD;
    PADS.d.forEach((d, k) => {
      if (!d) return;
      const dx = Math.max(x1 - d.x, 0, d.x - x2), dy = Math.max(y1 - d.y, 0, d.y - y2);
      if (dx * dx + dy * dy < d.r * d.r) hit[k] = true;
    });
  }
  PADS.b.forEach((b, k) => {
    if (hit[k]) PADS.one[k] = now + PADS_HOLD;
    const want = now < PADS.all || now < PADS.one[k];
    if (want !== PADS.on[k]) { PADS.on[k] = want; b.classList.toggle("see", want); }
  });
}
// The pause icon sits under the opponent's card; the off-screen bubble (effects.js) keeps clear of it. Measured now and then.
function hudPauseZone() {
  const b = $("pauseBtn");
  if (tick - HX.pzT > 30) {
    HX.pzT = tick;
    HX.pz = b.offsetParent ? { x: b.offsetLeft - 6, b: b.offsetTop + b.offsetHeight + 6 } : null;
  }
  return HX.pz;
}

/* ---------- ultimate bar and ULTI button (reads the sim, never writes it) ----------
   On each name card's bottom edge (.pc-ult, shell.html): a bar that fills 0..1 of BL.ultNeed(f) in the fighter's colour, turns gold with a
   short flash when full, two pips for the ultis left (TUNE.ultMax minus f.ultN), all grey once both are spent. Your own full bar burns
   (.me + the card's .burn: an ember glow and the flames of .pc-fl, a burst as it fills) and a small flame rides over your fighter
   (hudUltCue, drawn with the tags), so a full bar is seen without looking at the corner; the opponent's full bar is gold, no flames. The
   player's own button (.pb[data-k="ulti"]) shows only while the own bar is full (BL.ultReady), popping out with a gold glow; a keyboard
   player gets the ULTI [U] tag at the end of the own bar instead. The own bar becoming full plays Sfx.ultFull (absent = silent). Called
   every frame from updateHud (screens.js). */
const HU = { g: null, c: [{}, {}], rdy: false, btn: document.querySelector('.pb[data-k="ulti"]') };
function hudUltReset() {
  HU.g = G; HU.rdy = false;
  HU.c = Array.from({ length: hudN() }, () => ({ u: "", n: -1, full: false, off: null, me: null }));
  HU.btn.classList.remove("rdy", "on");
  for (const el of document.querySelectorAll(".pc-ult")) el.classList.remove("full", "flash", "none", "me", "e");
  for (const card of document.querySelectorAll("#hud .pcard")) {
    card.classList.remove("burn", "bst");
    if (!card.querySelector(".pc-fl")) { const fl = document.createElement("span"); fl.className = "pc-fl"; fl.setAttribute("aria-hidden", "true"); fl.innerHTML = "<i></i>".repeat(7); card.appendChild(fl); }
  }
}
function hudUlt() {
  if (HU.g !== G) hudUltReset();
  const trial = !!(match && match.trial);   // the Combo trial has no ultimates
  for (let k = 0; k < hudN(); k++) {   // k: the card, i: its fighter (screens.js cardSlot)
    const i = cardSlot[k], f = G.fighters[i], c = HU.c[k], el = $("pc" + k).querySelector(".pc-ult");
    if (c.off !== trial) { c.off = trial; el.hidden = trial; }
    if (trial) continue;
    const need = BL.ultNeed(f), full = need > 0 && f.ult >= need, mine = i === meSlot;
    const us = (need ? Math.max(0, Math.min(1, f.ult / need)) : 0).toFixed(3);
    if (c.u !== us) { c.u = us; el.style.setProperty("--u", us); el.classList.toggle("e", us === "0.000"); }
    if (c.me !== mine) { c.me = mine; el.classList.toggle("me", mine); }
    const left = BL.TUNE.ultMax - f.ultN;
    if (c.n !== left) { c.n = left; [...el.querySelectorAll(".up i")].forEach((p, k) => p.classList.toggle("sp", k >= left)); el.classList.toggle("none", left <= 0); }
    if (c.full !== full) {
      const was = c.full; c.full = full;
      el.classList.toggle("full", full);
      const card = $("pc" + k);
      card.classList.toggle("burn", full && mine);
      if (full && !was) {
        el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 650);
        if (mine) { card.classList.add("bst"); setTimeout(() => card.classList.remove("bst"), 450); }
        if (mine && Sfx.ultFull) Sfx.ultFull();
      }
      el.querySelector(".uk").hidden = !(full && mine && !touchUI);
    }
  }
  const me = G.fighters[meSlot], need = BL.ultNeed(me), rdy = !trial && G.phase !== "over" && (BL.ultReady(G, me) || (need > 0 && me.ult >= need));
  if (rdy !== HU.rdy) {
    HU.rdy = rdy; HU.btn.classList.toggle("rdy", rdy);
    // the press has already been read by the sim; a finger still down on a hidden button must not leave the input held
    if (!rdy) { touch.ulti = false; HU.btn.classList.remove("on"); }
  }
}

// your ulti is ready: a small flame over your fighter (above the YOU tag while it shows), drawn in the world with the tags (effects.js)
function hudUltCue(c, g) {
  if (!HU.rdy || g !== G || HU.g !== G) return;
  const f = g.fighters[meSlot];
  if (!f || f.state === "dead" || f.state === "gone") return;
  const k = 1 / cam.z, t = performance.now() / 1000, calm = resCalm();
  const y = f.y - f.s.h - (tagAlpha() > 0.02 ? 44 : 16) * k, fl = calm ? 1 : 1 + 0.1 * Math.sin(t * 11) + 0.06 * Math.sin(t * 23 + 1);
  const tongue = (h, w) => {
    c.beginPath(); c.moveTo(0, -h);
    c.bezierCurveTo(w * 0.45, -h * 0.62, w * 1.15, -h * 0.3, w * 0.9, 0); c.quadraticCurveTo(w * 0.62, h * 0.36, 0, h * 0.36);
    c.quadraticCurveTo(-w * 0.62, h * 0.36, -w * 0.9, 0); c.bezierCurveTo(-w * 1.15, -h * 0.3, -w * 0.45, -h * 0.62, 0, -h); c.closePath();
  };
  c.save(); c.translate(f.x, y); c.scale(k, k); c.rotate(calm ? 0 : 0.06 * Math.sin(t * 7));
  tongue(15 * fl, 6.5); c.lineJoin = "round"; c.lineWidth = 3; c.strokeStyle = "rgba(14,16,34,.85)"; c.stroke();
  const gr = c.createLinearGradient(0, -15, 0, 5); gr.addColorStop(0, "#ff6a3d"); gr.addColorStop(0.5, "#f3a23a"); gr.addColorStop(1, "#f3c84a");
  c.fillStyle = gr; c.fill();
  tongue(8 * fl, 3.4); c.fillStyle = "#ffe08a"; c.fill();
  c.restore();
}

/* ---------- 2v2: four name cards (the CSS is game/css/65-duo.css) ----------
   Called from enterMatchUI for every match. In a 2v2 your partner's card (#pc1) moves under yours and loses its right-hand slant, and the
   foes' two mini cards (#pc2, #pc3, from the #duoCards template) are put in the right-hand column; each card's edge takes its team colour.
   Any other match puts everything back (pc1 first in the right-hand column) and drops the extra cards, so a 1v1 and a boss fight are
   exactly as before. A tap on a foe's card is Focus (ui/duo.js). Online the cards follow cardSlot (screens.js): yours top-left in any seat. */
function hudDuo() {
  const on = !!(match && match.duo), hl = document.querySelector(".hud-l"), hr = document.querySelector(".hud-r"), p1 = $("pc1");
  app.classList.toggle("duo", on);
  if (on) hl.appendChild(p1); else if (p1.parentNode !== hr) hr.insertBefore(p1, hr.firstChild);
  p1.classList.toggle("right", !on); p1.classList.toggle("pmini", on);
  if (!on) { for (const id of ["pc2", "pc3"]) { const el = $(id); if (el) el.remove(); } }
  else if (!$("pc2")) {
    hr.insertBefore($("duoCards").content.cloneNode(true), $("pauseBtn"));
    for (const i of [2, 3]) $("pc" + i).addEventListener("pointerdown", (e) => { e.preventDefault(); if (mode === "match" && !paused) duoFocus(cardSlot[i]); });
  }
  for (let i = 0; i < 4; i++) {
    const el = $("pc" + i);
    if (!el) continue;
    if (on) el.style.setProperty("--tc", TEAM_COL[G.fighters[cardSlot[i]].team]); else el.style.removeProperty("--tc");
    el.classList.remove("focus");
  }
  for (const i of [1, 2, 3]) {   // the CPUs' potato names under the card's tag (online: ui/online-team.js tbTags)
    const el = $("pc" + i), sub = el && el.querySelector(".pc-sub");
    if (on && sub && !match.online) { sub.hidden = false; sub.querySelector(".nm").textContent = match.names[i] || ""; }
  }
}
