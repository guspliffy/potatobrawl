/* ===================== the Skin Rack (UI only; Fable's design, /mnt/project-files/skins-lobby/fable-design.md) =====================
   The fighter select shows one Skins bar under the stage (#dSkins: the worn skin, its effect and SKINS n/7). A tap opens #scrSkins over
   the select: the looked-at skin in big (the model drawn live in it, its name, its effect and one action), then the four chip skins and
   the three Road skins as cards, each with the model drawn once in that skin and a line saying where it stands. An owned skin is worn
   with one tap on its card; a chip skin is bought with two taps on the big button (Buy, then Sure? for 3 s); a locked skin can always be
   looked at. Wearing or buying keeps the sheet open, and the select behind it follows. Styles: css/90-skins.css. */
const SK = { id: null, i: 0, arm: false, armT: 0, art: null, cards: [], yoursT: 0, coin: 0 };
const SK_CHIPS_FROM = "Chips come from ranked wins, the Daily Potato, tournaments and Road stars.";
screens.skins = $("scrSkins");
const skOwns = (id, i) => (P.owned[id] || [0]).includes(i);
const skCount = (spec) => spec.palettes.reduce((n, p, i) => n + (skOwns(spec.id, i) ? 1 : 0), 0);
// the effect line: the chip skins' FXTEXT, a Road skin's ROADFX (skinfx.js)
const skFx = (spec, i) => `${(spec.palettes[i].road ? ROADFX[spec.palettes[i].road] : FXTEXT[spec.id] && FXTEXT[spec.id][i]) || "Base look"}.`;
const skRegOf = (p) => ROAD_REG.findIndex((g) => g.boss === p.road);
// worn, own (tap to wear), buy (enough chips), short (not enough), road (its boss's region is open), shut (it isn't yet)
function skState(spec, i) {
  const p = spec.palettes[i];
  if (skOwns(spec.id, i)) return palIdx(spec.id) === i ? "worn" : "own";
  if (p.road) return roadRegOpen(roadGet(), skRegOf(p)) ? "road" : "shut";
  return P.tokens >= p.price ? "buy" : "short";
}
// a Road skin: who gives it and what stands between you and him (the card's short line, the preview's two lines)
function skRoad(spec, i) {
  const p = spec.palettes[i], k = skRegOf(p), reg = ROAD_REG[k], boss = BL.BOSSES.find((b) => b.id === p.road), r = roadGet();
  if (!reg || !boss) return { foot: "Road", how: "Won on the Road.", why: "" };
  const how = `Beat ${boss.name} on the Road with ${spec.name}.`;
  if (!roadRegOpen(r, k)) return { foot: `${reg.name} · locked`, how, why: k > 0 ? `${reg.name} opens once ${roadBossSpec(k - 1).name} is beaten.` : `${reg.name} isn't open yet.` };
  let why;
  if (roadBossBits(r, k)) {   // beaten already: by whom (the fighter that has his skin), and every fighter wins his own
    const o = FIGHTERS.find((f) => f.id !== spec.id && skOwns(f.id, roadSkinOf(f, p.road)));
    why = o ? `You beat him with ${o.name} · every fighter wins his own.` : `Every fighter wins his own: beat him with ${spec.name}.`;
  } else why = roadGateOpen(r, k) ? `${reg.name} · his fence is open.` : `${reg.name} · his fence opens at ${ROAD_GATE} stars · you have ${roadRegStars(r, k)}.`;
  return { foot: `Beat ${boss.name}`, how, why };
}

/* ----- the Skins bar on the fighter select (buildDetail calls it) ----- */
function skinsBar(spec, pi) {
  const p = spec.palettes[pi] || spec.palettes[0], n = skCount(spec), bar = $("dSkins");
  bar.style.setProperty("--c", col(p));
  $("dSkName").textContent = p.name;
  $("dSkRoad").hidden = !p.road;
  $("dSkFx").textContent = skFx(spec, pi);
  $("dSkN").textContent = `${n}/${spec.palettes.length}`;
  bar.setAttribute("aria-label", `Skins. ${spec.name} wears ${p.name}. ${n} of ${spec.palettes.length} owned`);
}
$("dSkins").addEventListener("click", () => { Sfx.init(); Sfx.uiFlip(); openSkins(sel.fighter); });

/* ----- the sheet ----- */
function openSkins(id) {
  if (!FIG[id]) return;
  Object.assign(SK, { id, i: palIdx(id), art: null, cards: [] });
  skDisarm();
  modal("skins", true);
  skRender(true);
}
function closeSkins() {
  skDisarm(); clearTimeout(SK.yoursT); cancelAnimationFrame(SK.coin);
  modal("skins", false); SK.id = null; SK.art = null; SK.cards = [];
}
function skDisarm() { clearTimeout(SK.armT); SK.arm = false; }
// the cards are built when the sheet opens (their models drawn once); every change after that only restyles them
function skCard(spec, i) {
  const p = spec.palettes[i], b = document.createElement("button");
  b.className = "sk"; b.dataset.i = i; b.style.setProperty("--c", col(p)); b.style.setProperty("--cg", rgba(col(p), 0.42));
  b.innerHTML = `<span class="sk-a"><canvas aria-hidden="true"></canvas>${p.road ? `<em class="sk-rt">Road</em>` : ""}<i class="sk-lk" aria-hidden="true"></i></span><span class="sk-f"><b></b><small></small></span>`;
  b.querySelector(".sk-f b").textContent = p.name;
  b.addEventListener("click", () => skTap(i));
  const f = BL.newGame({ players: [{ spec, pal: p }, { spec, pal: p }], countdown: 1 }).fighters[0];
  f.x = 0; f.y = 0; f.facing = -1;
  SK.cards.push({ cv: b.querySelector("canvas"), f, fit: 0.84, bottom: 0.94 });
  return b;
}
function skDrawCards() { for (const a of SK.cards) paintModel(a, 0); }
function skRender(full) {
  const spec = FIG[SK.id];
  if (!spec) return;
  const n = spec.palettes.length, own = skCount(spec);
  if (full) {
    $("skFig").textContent = spec.name;
    $("skRoadSub").textContent = `won from the bosses, with ${spec.name}`;
    const chip = $("skChip"), road = $("skRoad");
    chip.innerHTML = ""; road.innerHTML = ""; SK.cards = [];
    spec.palettes.forEach((p, i) => (p.road ? road : chip).appendChild(skCard(spec, i)));
    skDrawCards();
  }
  $("skOwned").textContent = `${own} / ${n} owned`;
  if (!SK.coin) $("skTokens").textContent = P.tokens;
  for (const b of $("skSheet").querySelectorAll(".sk")) {
    const i = +b.dataset.i, p = spec.palettes[i], st = skState(spec, i), small = b.querySelector(".sk-f small");
    b.className = `sk ${st}${i === SK.i ? " sel" : ""}`;
    if (st === "worn") small.textContent = "Worn";
    else if (st === "own") small.textContent = "Tap to wear";
    else if (st === "buy" || st === "short") small.innerHTML = `<span class="tokglyph"></span>${p.price}`;
    else small.textContent = skRoad(spec, i).foot;
    b.setAttribute("aria-pressed", String(i === SK.i));
    b.setAttribute("aria-label", `${p.name}: ${st === "worn" ? "worn" : st === "own" ? "owned, tap to wear" : st === "buy" || st === "short" ? `${p.price} chips` : skRoad(spec, i).how}`);
  }
  skPreview(spec);
}
function skPreview(spec) {
  const i = SK.i, p = spec.palettes[i], st = skState(spec, i);
  $("skPrev").style.setProperty("--c", col(p)); $("skPrev").style.setProperty("--cg", rgba(col(p), 0.42));
  $("skPrev").className = `sk-prev ${st}`;
  $("skName").textContent = p.name;
  $("skRoadTag").hidden = !p.road;
  $("skFx").textContent = skFx(spec, i);
  const act = $("skAct");
  if (st === "worn") act.innerHTML = `<span class="sk-pill"><i aria-hidden="true">✓</i>Worn</span>`;
  else if (st === "own") act.innerHTML = `<button class="btn primary sk-go" id="skGo"><span>Wear</span></button>`;
  else if (st === "buy") act.innerHTML = `<button class="btn ${SK.arm ? "ember" : "primary"} sk-go" id="skGo"><span>${SK.arm ? "Sure?" : "Buy"} <span class="tokglyph"></span>${p.price}</span></button><p class="sk-l2">You have ${P.tokens} · ${P.tokens - p.price} left after</p>`;
  else if (st === "short") act.innerHTML = `<span class="sk-pill dim"><span class="tokglyph"></span>${p.price}</span><p class="sk-l1">${p.price - P.tokens} more chips needed.</p><p class="sk-l2">${SK_CHIPS_FROM}</p>`;
  else { const rd = skRoad(spec, i); act.innerHTML = `<p class="sk-l1 sk-lock">${rd.how}</p><p class="sk-l2">${rd.why}</p>`; }
  const go = $("skGo");
  if (go) go.addEventListener("click", skGo);
  if (!SK.art || SK.art.f.spec !== spec || SK.art.i !== i) {
    const f = BL.newGame({ players: [{ spec, pal: p }, { spec, pal: p }], countdown: 1 }).fighters[0];
    f.x = 0; f.y = 0; f.facing = -1;
    SK.art = { cv: $("skArt"), f, i, fit: 0.8, bottom: 0.94 };
  }
}
// the loop draws the preview while the sheet is open (loop.js)
function skinsDraw(tk) { if (SK.id && SK.art) paintModel(SK.art, tk); }
function skTap(i) {
  Sfx.init();
  const spec = FIG[SK.id], st = skState(spec, i);
  skDisarm();
  SK.i = i;
  if (st === "own") { equipSkin(spec.id, i); Sfx.uiFlip(); skChanged(); return; }   // owned: worn at once
  if (st === "short" || st === "road" || st === "shut") Sfx.uiNo(); else Sfx.ui();   // looking is free; the thud says it is locked
  skRender();
}
function skGo() {
  Sfx.init();
  const spec = FIG[SK.id], i = SK.i, p = spec.palettes[i], st = skState(spec, i);
  if (st === "own") { equipSkin(spec.id, i); Sfx.uiFlip(); skChanged(); return; }
  if (st !== "buy") return;
  if (!SK.arm) {   // the first tap arms the button (ember, "Sure?") for 3 s
    SK.arm = true; Sfx.ui();
    SK.armT = setTimeout(() => { SK.arm = false; if (SK.id) skRender(); }, 3000);
    skRender(); return;
  }
  skDisarm();
  if (P.tokens < p.price || skOwns(spec.id, i)) { skRender(); return; }
  const was = P.tokens;
  P.tokens -= p.price; P.owned[spec.id] = [...(P.owned[spec.id] || [0]), i]; P.pal[spec.id] = i; saveProfile();
  cnt("skin:" + spec.id);   // ui/counter.js
  Sfx.uiCoin();
  skCoin(was, P.tokens);
  skChanged();
  // YOURS! on the preview for 1.2 s
  const y = $("skYours"); y.hidden = false; slReplay(y, "sk-pop");
  clearTimeout(SK.yoursT); SK.yoursT = setTimeout(() => { y.hidden = true; }, 1200);
}
// the band's coin counts down to the new total (400 ms; at once with reduced motion)
function skCoin(from, to) {
  const el = $("skTokens"), t0 = performance.now();
  cancelAnimationFrame(SK.coin); SK.coin = 0;
  if (resCalm()) { el.textContent = to; return; }
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 400);
    el.textContent = Math.round(from + (to - from) * k);
    SK.coin = k < 1 ? requestAnimationFrame(step) : 0;
  };
  SK.coin = requestAnimationFrame(step);
}
// after a wear or a buy: the sheet restyles and the select behind it (its tile colour, the stage model, the Skins bar) follows
function skChanged() { skRender(); if (mode === "select") { buildTiles(); buildDetail(); } }
$("skClose").addEventListener("click", () => { Sfx.init(); Sfx.uiBack(); closeSkins(); });
// a tap on the dimmed backdrop closes; a tap anywhere but the armed button puts Buy back
screens.skins.addEventListener("click", (e) => { if (e.target === screens.skins) { Sfx.init(); Sfx.uiBack(); closeSkins(); } });
$("skSheet").addEventListener("click", (e) => { if (SK.arm && !e.target.closest("#skGo")) { skDisarm(); skRender(); } }, true);
window.addEventListener("keydown", (e) => { if (e.code === "Escape" && SK.id && !screens.skins.hidden) { e.preventDefault(); closeSkins(); } });
// the cards' models are redrawn when the sheet changes size (a phone turned)
if (window.ResizeObserver) new ResizeObserver(() => { if (SK.id) skDrawCards(); }).observe($("skSheet"));
