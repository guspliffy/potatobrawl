/* ===================== the one-time skins upgrade card (UI only; Fable's design, redesign/pr3-design.md section 7) =====================
   Carved Ink redrew every skin. A player who owns a skin beyond the eight free ones (palette 0) sees this card once, on the start menu:
   up to six of their own skins drawn live with the rig (Pommes first, then won, then the 300, 150 and 60 chips; within a tier the fighter
   played last first; with more than six the sixth tile is a "+N" numeral), "See my skins" (opens the Skin Rack on the first skin shown)
   and "Nice!". The flag P.skup = 1 (this device only) is set when the card shows or is dismissed, and silently for a profile that owns
   only free skins or is on its first run, so a first skin bought later never meets an "upgrade". It waits for a quiet menu: no sheet, no
   welcome / first-open screen, no Monday card, no cup call-up. Markup: shell.html #scrSkUp; styles: css/96-skinup.css. Names stay English.
   Every top-level name here starts with su / SU_. */
const SU_MAX = 6;
const SU = { on: false, t0: 0, list: [], art: [], raf: 0, n: 0 };
screens.skup = $("scrSkUp");
// the skins a player owns beyond the free ones, in the card's order
function suOwned() {
  const out = [], rank = (id) => (id === P.last ? -1 : FIGHTERS.findIndex((f) => f.id === id));
  for (const spec of FIGHTERS) {
    const l = P.owned && P.owned[spec.id];
    if (!Array.isArray(l)) continue;
    for (const i of l) {
      const p = spec.palettes[i];
      if (i > 0 && p) out.push({ id: spec.id, i, tier: p.pommes ? 0 : p.road ? 1 : p.price >= 300 ? 2 : p.price >= 150 ? 3 : p.price >= 60 ? 4 : 5, r: rank(spec.id) });
    }
  }
  return out.sort((a, b) => a.tier - b.tier || a.r - b.r || a.i - b.i);
}
function suTile(s, k) {
  const spec = FIG[s.id], p = spec.palettes[s.i], t = document.createElement("div");
  t.className = "su-t"; t.style.setProperty("--k", k);
  t.innerHTML = '<span class="su-a"><canvas aria-hidden="true"></canvas></span><b></b>';
  t.querySelector("b").textContent = _tv(p.name);
  t.setAttribute("role", "img"); t.setAttribute("aria-label", `${spec.name}: ${_tv(p.name)}`);
  const f = glazeMark(BL.newGame({ seed: 1, players: [{ spec, pal: p }, { spec, pal: p }], countdown: 1 }).fighters[0], glazeHas(spec.id, s.i));
  f.x = 0; f.y = 0; f.facing = -1;
  SU.art.push({ cv: t.querySelector("canvas"), f, fit: 0.84, bottom: 0.94 });
  return t;
}
function suPaint() {
  if (!SU.on) return;
  SU.n++;
  if (SU.n % 2 === 0) for (const a of SU.art) paintModel(a, tick);   // about 30 fps: six small canvases
  SU.raf = requestAnimationFrame(suPaint);
}
function suOpen(list) {
  SU.list = list; SU.art = []; SU.on = true; SU.n = 0;
  const row = $("suRow"); row.innerHTML = "";
  const more = list.length > SU_MAX, shown = more ? list.slice(0, SU_MAX - 1) : list;
  shown.forEach((s, k) => row.appendChild(suTile(s, k)));
  if (more) {
    const t = document.createElement("div");
    t.className = "su-t su-n"; t.style.setProperty("--k", shown.length);
    t.innerHTML = '<span class="su-a"></span><b></b>'; t.firstChild.textContent = "+" + (list.length - shown.length);
    t.setAttribute("aria-hidden", "true");
    row.appendChild(t);
  }
  P.skup = 1; saveProfile();
  modal("skup", true);
  for (const a of SU.art) paintModel(a, tick);
  cancelAnimationFrame(SU.raf); SU.raf = requestAnimationFrame(suPaint);
}
function suClose() {
  if (!SU.on) return;
  SU.on = false; cancelAnimationFrame(SU.raf); SU.art = [];
  modal("skup", false);
}
function suSee() {
  const s = SU.list[0];
  suClose();
  if (s) openSkins(s.id, s.i);
}
// every sheet, screen and banner that must not sit under this card (the menu itself is the only screen showing)
function suQuiet() {
  if (mode !== "menu" || screens.menu.hidden) return false;
  for (const el of document.querySelectorAll(".screen:not([hidden])")) if (el !== screens.menu) return false;
  const call = $("tcCall");
  if (call && !call.hidden) return false;
  if (typeof BW !== "undefined" && BW.lrNew) return false;   // the Monday card goes first (ui/bossweek.js bwTick)
  if (typeof WEL !== "undefined" && WEL.on) return false;
  return true;
}
function suTick() {
  if (P.skup || SU.on) return;
  if (firstRun) { P.skup = 1; return; }   // a first run: never an "upgrade". Set in memory only: saving now would end the first-open flow (ui/mastery.js); the first real save keeps it
  if (!P.tut && !playedOnce()) return;                   // the first-open flow is not over yet (a profile from before the tutorial has played: no P.tut)
  const list = suOwned();
  if (!list.length) {
    // only free skins: set silently, but once the server's Pommes skins have had their say (they can arrive a moment after load)
    if (!ACCT.code || KO.t > 0) { P.skup = 1; saveProfile(); }
    return;
  }
  if (!suQuiet()) { SU.t0 = 0; return; }
  if (!SU.t0) { SU.t0 = Date.now(); return; }
  if (Date.now() - SU.t0 < 1800) return;   // the menu has settled
  suOpen(list);
}
$("suClose").addEventListener("click", () => { Sfx.init(); Sfx.cue($("suClose")); suClose(); });
$("suOk").addEventListener("click", () => { Sfx.init(); Sfx.cue($("suOk")); suClose(); });
$("suSee").addEventListener("click", () => { Sfx.init(); Sfx.cue($("suSee")); suSee(); });
screens.skup.addEventListener("click", (e) => { if (e.target === screens.skup) suClose(); });
window.addEventListener("keydown", (e) => { if (e.code === "Escape" && SU.on) { e.preventDefault(); suClose(); } });
setInterval(suTick, 500);
window.__blSkinUp = { open: suOpen, owned: suOwned, tick: suTick };   // tests
