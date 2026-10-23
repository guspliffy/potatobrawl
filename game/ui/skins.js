/* ===================== the Skin Rack (UI only; Fable's design, /mnt/project-files/skins-lobby/fable-design.md) =====================
   The fighter select shows one Skins bar under the stage (#dSkins: the worn skin, its effect and SKINS n/7). A tap opens #scrSkins over
   the select: the looked-at skin in big (the model drawn live in it, its name, its effect and one action), then the four chip skins and
   the won skins (the three Road skins and the Harvest's, ui/harvest.js) as cards, each with the model drawn once in that skin and a line saying where it stands. An owned skin is worn
   with one tap on its card; a chip skin is bought with two taps on the big button (Buy, then Sure? for 3 s); a locked skin can always be
   looked at. Wearing or buying keeps the sheet open, and the select behind it follows. Styles: css/90-skins.css.
   The Account sheet's Locker (ui/acct.js) draws its skin cards with the same builder (skMakeCard, skStyle) and opens this sheet on a locked
   skin with openSkins(id, i): the sheet then shows above the Account sheet, and closing it re-renders the Locker (css/92-locker.css).
   The Pommes skins (spec.palettes[i].pommes: 1 Ink Noir, 2 Starfall; core.js, their effects PMFX in skinfx.js) are a third row, "Special skins · bought with
   Pommes" (built here; shell.html has the other two): a red-and-white candy-stripe POMMES tag, a red border, the model drawn live every frame, and for one you
   do not own the price in Pommes (the fries cone, "300 · €2.99", never the chip's coin). They are never bought here: state "pm" (not owned) sends a tap on
   the card, or on the big button, to the Pommes Shop on that fighter (pshopOpen). An owned one (in P.owned, put there by ui/kopages.js koSkins) is worn like any skin. */
const SK = { id: null, i: 0, arm: false, armT: 0, art: null, cards: [], yoursT: 0, coin: 0, live: 0 };
const SK_CHIPS_FROM = _t("Chips come from ranked wins, the Daily Potato, tournaments and Road stars.");
screens.skins = $("scrSkins");
const skOwns = (id, i) => (P.owned[id] || [0]).includes(i);
const skCount = (spec) => spec.palettes.reduce((n, p, i) => n + (skOwns(spec.id, i) ? 1 : 0), 0);
// the effect line: the chip skins' FXTEXT, a Road skin's ROADFX, a Pommes skin's PMFX (skinfx.js)
const skFx = (spec, i) => { const p = spec.palettes[i]; return `${(p.pommes ? PMFX[p.pommes] : p.road ? ROADFX[p.road] : FXTEXT[spec.id] && FXTEXT[spec.id][i]) || _t("Base look")}.`; };
const skRegOf = (p) => ROAD_REG.findIndex((g) => g.boss === p.road);
const skHv = (p) => p.road === "harvest";   // the Harvest skin: day 30 of the daily gifts, never bought
const skTagged = (p) => !!(p.road || p.pommes);   // a skin with a sticker: won (ROAD, HARVEST) or bought with Pommes (POMMES)
const skWonTag = (p) => (p.pommes ? "Pommes" : skHv(p) ? _t("Harvest") : _t("Road"));
const skPmPrice = () => `<i class="pmglyph" aria-hidden="true"></i><span>${KO_PRICE} · ${KO_EUR}</span>`;   // the fries cone and "300 · €2.99" (ui/kopages.js)
// a sticker on an element (the bar, the preview): shown for a won or Pommes skin, the Pommes one in candy stripes
function skTagSet(el, p) { el.hidden = !skTagged(p); el.textContent = skWonTag(p); el.classList.toggle("pm", !!p.pommes); }
// worn, own (tap to wear), pm (a Pommes skin you do not own: the Pommes Shop), buy (enough chips), short (not enough), road (its boss's region is open), shut (it isn't yet)
function skState(spec, i) {
  const p = spec.palettes[i];
  if (skOwns(spec.id, i)) return palIdx(spec.id) === i ? "worn" : "own";
  if (p.pommes) return "pm";   // never "buy" or "short": a Pommes skin is not sold for chips (its price here is 0)
  if (skHv(p)) return "shut";
  if (p.road) return roadRegOpen(roadGet(), skRegOf(p)) ? "road" : "shut";
  return P.tokens >= p.price ? "buy" : "short";
}
// a Road skin: who gives it and what stands between you and him (the card's short line, the preview's two lines)
function skRoad(spec, i, tight) {   // tight: the Locker's small cards drop the region name's "The "
  if (skHv(spec.palettes[i])) {
    const h = hvGet(), v = hvView(h, dailyKey());
    return { foot: _t("Harvest day 30"), how: _t("Day 30 of the Harvest gives this skin to the fighter you pick."), why: _t("One gift a day behind the flame on the start page · you are on day {n} of 30.", { n: Math.min(30, v.open ? v.n + 1 : v.n) }) };
  }
  const p = spec.palettes[i], k = skRegOf(p), reg = ROAD_REG[k], boss = BL.BOSSES.find((b) => b.id === p.road), r = roadGet();
  if (!reg || !boss) return { foot: _t("Road"), how: _t("Won on the Road."), why: "" };
  const how = _t("Beat {boss} on the Road with {name}.", { boss: boss.name, name: spec.name });
  if (!roadRegOpen(r, k)) return { foot: _t("{reg} · locked", { reg: tight ? reg.name.replace(/^The /, "") : reg.name }), how, why: k > 0 ? _t("{reg} opens once {boss} is beaten.", { reg: reg.name, boss: roadBossSpec(k - 1).name }) : _t("{reg} isn't open yet.", { reg: reg.name }) };
  let why;
  if (roadBossBits(r, k)) {   // beaten already: by whom (the fighter that has his skin), and every fighter wins his own
    const o = FIGHTERS.find((f) => f.id !== spec.id && skOwns(f.id, roadSkinOf(f, p.road)));
    why = o ? _t("You beat him with {name} · every fighter wins his own.", { name: o.name }) : _t("Every fighter wins his own: beat him with {name}.", { name: spec.name });
  } else why = roadGateOpen(r, k) ? _t("{reg} · his fence is open.", { reg: reg.name }) : _t("{reg} · his fence opens at {n} stars · you have {s}.", { reg: reg.name, n: ROAD_GATE, s: roadRegStars(r, k) });
  return { foot: _t("Beat {boss}", { boss: boss.name }), how, why };
}

/* ----- the Skins bar on the fighter select (buildDetail calls it) ----- */
function skinsBar(spec, pi) {
  const p = spec.palettes[pi] || spec.palettes[0], n = skCount(spec), bar = $("dSkins");
  bar.style.setProperty("--c", col(p));
  $("dSkName").textContent = _tv(p.name);
  skTagSet($("dSkRoad"), p);
  $("dSkFx").textContent = skFx(spec, pi);
  $("dSkN").textContent = `${n}/${spec.palettes.length}`;
  bar.setAttribute("aria-label", _t("Skins. {name} wears {skin}. {n} of {t} owned", { name: spec.name, skin: _tv(p.name), n, t: spec.palettes.length }));
}
$("dSkins").addEventListener("click", () => { Sfx.init(); Sfx.uiFlip(); openSkins(sel.fighter); });

/* ----- the sheet ----- */
// the third row, the Pommes skins, with its kicker: built once here (shell.html has the chip and the won rows); skRender fills it
{
  const k = document.createElement("div"), row = document.createElement("div");
  k.className = "sk-k"; k.innerHTML = `<b>${_t("Special skins")}</b><span>${_t("bought with Pommes")}</span>`;
  row.className = "sk-row"; row.id = "skPm"; row.setAttribute("role", "group"); row.setAttribute("aria-label", _t("Special skins"));
  $("skSheet").querySelector(".sk-rack").append(k, row);
}
function openSkins(id, i) {   // i (optional): the skin to look at first; else the one worn
  if (!FIG[id]) return;
  Object.assign(SK, { id, i: Number.isInteger(i) && FIG[id].palettes[i] ? i : palIdx(id), art: null, cards: [] });
  skDisarm();
  modal("skins", true);
  skRender(true);
  cancelAnimationFrame(SK.live); SK.live = mode === "select" ? 0 : requestAnimationFrame(skLive);
}
function closeSkins() {
  skDisarm(); clearTimeout(SK.yoursT); cancelAnimationFrame(SK.coin); cancelAnimationFrame(SK.live); SK.live = 0;
  modal("skins", false); SK.id = null; SK.art = null; SK.cards = [];
  if (!screens.account.hidden) { renderPill(); if (mode === "menu") renderMenu(); renderAccount(); }   // opened from the Locker: what was bought or worn shows there
}
function skDisarm() { clearTimeout(SK.armT); SK.arm = false; }
// a skin card, as the Rack and the Locker show it: the model drawn once on its canvas (its art record goes into `list`), a tap calls tap(i).
// The Rack builds its cards when the sheet opens; every change after that only restyles them (skStyle).
function skMakeCard(spec, i, list, tap) {
  const p = spec.palettes[i], b = document.createElement("button");
  b.className = "sk"; b.dataset.i = i; b.style.setProperty("--c", col(p)); b.style.setProperty("--cg", rgba(col(p), 0.42));
  b.innerHTML = `<span class="sk-a"><canvas aria-hidden="true"></canvas>${skTagged(p) ? `<em class="sk-rt${p.pommes ? " pm" : ""}">${skWonTag(p)}</em>` : ""}<i class="sk-lk" aria-hidden="true"></i></span><span class="sk-f"><b></b><small></small></span>`;
  b.querySelector(".sk-f b").textContent = _tv(p.name);
  b.addEventListener("click", () => tap(i));
  const f = glazeMark(BL.newGame({ seed: 1, players: [{ spec, pal: p }, { spec, pal: p }], countdown: 1 }).fighters[0], glazeHas(spec.id, i));   // ui/glaze.js
  f.x = 0; f.y = 0; f.facing = -1;
  list.push({ cv: b.querySelector("canvas"), f, i, fit: 0.84, bottom: 0.94, pm: !!p.pommes });   // pm: drawn every frame (skPmDraw), its overlay moves
  return b;
}
const skCard = (spec, i) => skMakeCard(spec, i, SK.cards, skTap);
// a card's state: its class (worn / own / buy / short / road / shut, and sel for the Rack's looked-at ring), its foot line, its label; a glazed skin gets a star after its name.
// tight (the Locker's small cards): a shut Road skin's foot says "Kitchen · locked", not "The Kitchen · locked", so it fits
function skStyle(b, spec, i, sel, tight) {
  const p = spec.palettes[i], st = skState(spec, i), small = b.querySelector(".sk-f small"), nm = b.querySelector(".sk-f b"), gz = glazeHas(spec.id, i), pn = _tv(p.name);
  b.className = `sk ${st}${p.pommes ? " pms" : ""}${sel ? " sel" : ""}`;
  if (nm._gz !== gz) {
    nm._gz = gz; nm.className = gz ? "gz" : "";
    if (gz) { nm.innerHTML = '<span></span><i aria-hidden="true">\u2726</i>'; nm.firstChild.textContent = pn; } else nm.textContent = pn;
  }
  if (st === "worn") small.textContent = _t("Worn");
  else if (st === "own") small.textContent = _t("Tap to wear");
  else if (st === "pm") small.innerHTML = skPmPrice();
  else if (st === "buy" || st === "short") small.innerHTML = `<span class="tokglyph"></span>${fmtChips(p.price)}`;
  else small.textContent = skRoad(spec, i, tight && st === "shut").foot;
  const say = st === "worn" ? _t("worn") : st === "own" ? _t("owned, tap to wear") : st === "pm" ? _t("bought with Pommes, {p} Pommes, {e}: in the Pommes Shop", { p: KO_PRICE, e: KO_EUR }) : st === "buy" || st === "short" ? _t("{c} chips", { c: fmtChips(p.price) }) : skRoad(spec, i).how;
  b.setAttribute("aria-label", gz ? _t("{name}, glazed: {say}", { name: pn, say }) : _t("{name}: {say}", { name: pn, say }));
  return st;
}
function skDrawCards() { for (const a of SK.cards) paintModel(a, 0); }
function skRender(full) {
  const spec = FIG[SK.id];
  if (!spec) return;
  const n = spec.palettes.length, own = skCount(spec);
  if (full) {
    $("skFig").textContent = spec.name;
    $("skRoadSub").textContent = _t("from the bosses and the Harvest, with {name}", { name: spec.name });
    const chip = $("skChip"), road = $("skRoad");
    const pm = $("skPm");
    chip.innerHTML = ""; road.innerHTML = ""; pm.innerHTML = ""; SK.cards = [];
    spec.palettes.forEach((p, i) => (p.pommes ? pm : p.road ? road : chip).appendChild(skCard(spec, i)));
    skDrawCards();
  }
  $("skOwned").textContent = _t("{n} / {t} owned", { n: own, t: n });
  if (!SK.coin) $("skTokens").textContent = fmtChips(P.tokens);
  for (const b of $("skSheet").querySelectorAll(".sk")) {
    const i = +b.dataset.i;
    skStyle(b, spec, i, i === SK.i);
    b.setAttribute("aria-pressed", String(i === SK.i));
  }
  skPreview(spec);
}
function skPreview(spec) {
  const i = SK.i, p = spec.palettes[i], st = skState(spec, i);
  $("skPrev").style.setProperty("--c", col(p)); $("skPrev").style.setProperty("--cg", rgba(col(p), 0.42));
  $("skPrev").className = `sk-prev ${st}`;
  $("skName").textContent = _tv(p.name);
  skTagSet($("skRoadTag"), p);
  $("skFx").textContent = skFx(spec, i);
  const act = $("skAct");
  if (st === "worn") act.innerHTML = `<span class="sk-pill"><i aria-hidden="true">✓</i>${_t("Worn")}</span>`;
  else if (st === "own") act.innerHTML = `<button class="btn primary sk-go" id="skGo"><span>${_t("Wear")}</span></button>`;
  else if (st === "buy") act.innerHTML = `<button class="btn ${SK.arm ? "ember" : "primary"} sk-go" id="skGo"><span>${SK.arm ? _t("Sure?") : _t("Buy")} <span class="tokglyph"></span>${fmtChips(p.price)}</span></button><p class="sk-l2">${_t("You have {c} · {l} left after", { c: fmtChips(P.tokens), l: fmtChips(P.tokens - p.price) })}</p>`;
  else if (st === "pm") act.innerHTML = `<button class="btn sk-go sk-pmgo" id="skGo" aria-label="${_t("In the Pommes Shop, {p} Pommes, {e}", { p: KO_PRICE, e: KO_EUR })}"><span><b>${_t("In the Pommes Shop")}</b> <small>${skPmPrice()}</small></span></button>`;
  else if (st === "short") act.innerHTML = `<span class="sk-pill dim"><span class="tokglyph"></span>${fmtChips(p.price)}</span><p class="sk-l1">${_t("{c} more chips needed.", { c: fmtChips(p.price - P.tokens) })}</p><p class="sk-l2">${SK_CHIPS_FROM}</p>`;
  else { const rd = skRoad(spec, i); act.innerHTML = `<p class="sk-l1 sk-lock">${rd.how}</p><p class="sk-l2">${rd.why}</p>`; }
  const go = $("skGo");
  if (go) go.addEventListener("click", skGo);
  if (!SK.art || SK.art.f.spec !== spec || SK.art.i !== i) {
    const f = BL.newGame({ seed: 1, players: [{ spec, pal: p }, { spec, pal: p }], countdown: 1 }).fighters[0];
    f.x = 0; f.y = 0; f.facing = -1;
    SK.art = { cv: $("skArt"), f, i, fit: 0.8, bottom: 0.94 };
  }
  glazeMark(SK.art.f, glazeHas(spec.id, i));   // ui/glaze.js: the preview shines when the skin is glazed
}
// the loop draws the preview while the sheet is open (loop.js)
function skinsDraw(tk) { if (SK.id && SK.art) paintModel(SK.art, tk); skPmDraw(tk); }
// the Pommes cards are live too: the overlay moves (a nebula breathes, stars twinkle, ink boils), so they are drawn with the tick, not once
function skPmDraw(tk) { for (const a of SK.cards) if (a.pm) paintModel(a, tk); }
// opened from the Account sheet (the menu, not the select) the loop is not drawing the preview: this does, while the sheet is open
function skLive() { if (!SK.id) return; if (SK.art) paintModel(SK.art, tick); skPmDraw(tick); SK.live = requestAnimationFrame(skLive); }
// a Pommes skin you do not own is never bought here: the Rack closes and the Pommes Shop opens on that fighter (ui/pshop.js)
function skPommes(id) { Sfx.ui(); closeSkins(); pshopOpen(id); }
function skTap(i) {
  Sfx.init();
  const spec = FIG[SK.id], st = skState(spec, i);
  skDisarm();
  if (st === "pm") { skPommes(spec.id); return; }
  SK.i = i;
  if (st === "own") { equipSkin(spec.id, i); Sfx.uiFlip(); skChanged(); return; }   // owned: worn at once
  if (st === "short" || st === "road" || st === "shut") Sfx.uiNo(); else Sfx.ui();   // looking is free; the thud says it is locked
  skRender();
}
function skGo() {
  Sfx.init();
  const spec = FIG[SK.id], i = SK.i, p = spec.palettes[i], st = skState(spec, i);
  if (st === "own") { equipSkin(spec.id, i); Sfx.uiFlip(); skChanged(); return; }
  if (st === "pm") { skPommes(spec.id); return; }
  if (st !== "buy" || p.pommes) return;   // (a Pommes skin never gets here: no chip purchase of one is possible)
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
  if (resCalm()) { el.textContent = fmtChips(to); return; }
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 400);
    el.textContent = fmtChips(from + (to - from) * k);
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
