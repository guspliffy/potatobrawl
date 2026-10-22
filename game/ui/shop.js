/* ===================== the Shop: the fourth Account tab, where chips are spent on what the game draws itself (UI only, never in the simulation) =====================
   Reached by the Shop tab, or by a tap on the chip coin on the start page (acct.js openAccount("h")). Top: the balance and where chips come from.
   Nameplates: the plate behind your name on the start page, in the Profile and on the results (css/93-shop.css has the eight looks). Ink is free and
   the default; the others are bought once and then worn with one tap. P.plates = ids owned, P.plate = the one worn ("" = Ink), both synced (sync.js).
   Glaze: one card per fighter with his worn skin on a canvas (paintModel, as the Skin Rack's cards); Glaze buys the pearl sheen for that skin for
   GLAZE_PRICE (ui/glaze.js: P.glazed = { fighterId: [skin indices] }). A glazed card is marked for the sheen's drawing (glazeMark), so it shows on it.
   Buying anything takes two taps: the first arms the card ("Sure?", ember, for 3 s, as the Skin Rack's Buy), the second pays, plays the coin, saves and
   redraws the pill. A card you cannot pay does not buy: the line at the top says how many chips are missing for a few seconds.
   plateCls(id) gives the CSS class of a plate id ("" for Ink or an id this copy does not know), plateSet(el, id) puts it on an element.
   The Harvest (ui/harvest.js) adds to it: the Sprout plate is never sold (day 7 gives it, `harvest`), a Glaze token (P.gzt, day 30 once every
   fighter has the Harvest skin) glazes one skin instead of the chips, and the first row offers chips for a short ad, waiting with a SOON sticker
   until ads exist (never required; chips are never bought).
   KO pages (ui/kopages.js has the state, KO): the last section, one card per fighter for his Potatality, the second KO page, paid with Pommes (never
   chips; the Pommes live on the server only). The pill beside the chips shows the Pommes, the pack row above the cards says what a pack is and waits
   with a SOON sticker until payments exist (KO.buy), a card is bought like a plate (two taps) and then switched on or off with one tap, WATCH plays
   the page (koDemo) and brings you back here on that card (shopKoFocus). Every price shows its euro value beside the Pommes. kopages.js calls
   shopKoRender() on every change of what the server said. The results' "Potatality · in the Shop" band (#rKo) is shopResKo. */
const PLATES = [
  { id: "", name: "Ink", price: 0 },
  { id: "sunset", name: "Sunset", price: 150 },
  { id: "mint", name: "Mint", price: 150 },
  { id: "nightsky", name: "Night Sky", price: 200 },
  { id: "roaddust", name: "Road Dust", price: 200 },
  { id: "kraken", name: "Kraken Ink", price: 200 },
  { id: "halftone", name: "Halftone", price: 300 },
  { id: "goldleaf", name: "Gold Leaf", price: 300 },
  { id: "sprout", name: "Sprout", price: 0, harvest: true },   // day 7 of the Harvest only
];
const SH_AD = 25;   // the ad row's chips (3 a day), once ads exist
const SH = { arm: "", armT: 0, msgT: 0, msg: "", raf: 0, pl: [], gz: [], top: null, ko: [], pk: null, pmN: null, hiT: 0, why: "", koId: "", koWait: false };
const SH_FROM = "Chips come from ranked wins, the Daily Potato, tournaments and Road stars.";
const plateInfo = (id) => PLATES.find((p) => p.id === id);
const plateCls = (id) => (id && plateInfo(id) ? "np-" + id : "");
// put a plate class on an element and take the earlier one off (el._np remembers it)
function plateSet(el, id) {
  const c = plateCls(id);
  if (el._np === c) return;
  if (el._np) el.classList.remove(el._np);
  if (c) el.classList.add(c);
  el._np = c;
}
const shopOwns = (id) => !id || (Array.isArray(P.plates) && P.plates.includes(id));
// the plate worn: a plate this copy does not know, or one that is not owned, shows as Ink
const shopWorn = () => { const id = typeof P.plate === "string" ? P.plate : ""; return id && plateInfo(id) && shopOwns(id) ? id : ""; };

/* ----- the cards ----- */
const shMk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const shCoin = (n) => `<span class="tokglyph"></span>${n}`;
function shopPlateCard(p) {
  const b = shMk("button", "sh-c sh-pl"), a = shMk("span", "sh-pa"), np = shMk("span", "sh-np"), nm = shMk("span", "sh-nm"), f = shMk("span", "sh-f");
  b.type = "button"; b.dataset.id = p.id;
  if (p.id) np.classList.add(plateCls(p.id));
  np.appendChild(nm); a.appendChild(np);
  f.appendChild(shMk("b", "", p.name)); f.appendChild(shMk("small"));
  b.append(a, f);
  b.addEventListener("click", () => shopPlateTap(p.id));
  return { id: p.id, el: b, nm, small: f.lastChild };
}
function shopGlazeCard(spec) {
  const b = shMk("button", "sh-c sh-gz"), a = shMk("span", "sh-a"), cv = shMk("canvas"), f = shMk("span", "sh-f");
  const i = palIdx(spec.id), pal = spec.palettes[i] || spec.palettes[0];
  b.type = "button"; b.dataset.id = spec.id;
  b.style.setProperty("--c", col(pal)); b.style.setProperty("--cg", rgba(col(pal), 0.42));
  cv.setAttribute("aria-hidden", "true"); a.appendChild(cv);
  f.appendChild(shMk("b", "", spec.name)); f.appendChild(shMk("small"));
  b.append(a, f);
  const fig = BL.newGame({ seed: 1, players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
  fig.x = 0; fig.y = 0; fig.facing = -1;
  b.addEventListener("click", () => shopGlazeTap(spec.id));
  return { id: spec.id, i, el: b, small: f.lastChild, art: { cv, f: fig, fit: 0.84, bottom: 0.94 } };
}
// a KO page's card: a div (it holds two buttons: the card itself and WATCH): the art (halftone, the sound word faint behind the portrait, the page's name in
// manga lettering), the fighter and the state line under it, the ON tag, the SOON sticker (a price that cannot be paid yet)
const KO_NOTE = "Plays on a normal KO; an Ultimate keeps its own page.";
const shKoPrice = `<span class="pmglyph"></span>${KO_PRICE} · ${KO_EUR}`;
function shopKoCard(spec) {
  const id = spec.id, pg = KO_PAGES[id] || { name: spec.name, word: "" };
  const el = shMk("div", "sh-c sh-ko"), main = shMk("button", "ko-main"), art = shMk("span", "ko-art"), pic = shMk("i", "ko-pic"), word = shMk("i", "ko-word", pg.word),
    nm = shMk("span", "ko-nm", pg.name), f = shMk("span", "sh-f"), go = shMk("button", "ko-go"), on = shMk("i", "ko-on", "ON"), soon = shMk("i", "sh-soon", "Soon");
  el.dataset.id = id; main.type = "button"; go.type = "button";
  const src = PORTRAITS[id];
  if (src) pic.style.backgroundImage = `url("${src}")`;
  pic.setAttribute("aria-hidden", "true"); word.setAttribute("aria-hidden", "true"); on.setAttribute("aria-hidden", "true"); soon.setAttribute("aria-hidden", "true");
  word.style.setProperty("--wn", String(Math.max(3, pg.word.length)));
  art.append(word, pic, nm);
  f.append(shMk("b", "", spec.name), shMk("small"));
  main.append(art, f);
  go.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.2v15.6L20.5 12z" fill="currentColor"/></svg><span aria-hidden="true">Watch</span>`;
  el.append(main, go, on, soon);
  main.addEventListener("click", () => shopKoTap(id));
  go.addEventListener("click", () => shopKoWatch(id));
  return { id, el, main, go, small: f.lastChild, soon };
}
// the pack row above the cards: the one thing Pommes are sold as (300 for €2.99); not a button until payments exist (the server says buy: true)
function shopKoPack() {
  const el = shMk("div", "sh-ad sh-pk"), soon = shMk("i", "sh-soon", "Soon");
  el.innerHTML = `<span class="sh-pmi" aria-hidden="true"><i class="pmglyph"></i></span><span class="sh-adt"><b>${KO_PRICE} Pommes</b> <span>One KO page. Pommes stay on your account.</span></span><span class="sh-adv">${KO_EUR}</span>`;
  el.append(soon);
  const go = () => { if (!KO.buy) return; Sfx.init(); Sfx.ui(); shopSay("Buying Pommes opens soon."); };   // PR 2 wires the payment here
  el.addEventListener("click", go);
  el.addEventListener("keydown", (e) => { if (KO.buy && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go(); } });
  return { el, soon };
}
const koState = (id) => (koOwn(id) ? (koOn(id) ? "on" : "own") : koBal() >= KO_PRICE ? "buy" : "short");
function plState(id) { const p = plateInfo(id); return shopWorn() === id ? "worn" : shopOwns(id) ? "own" : p.harvest ? "gift" : P.tokens >= p.price ? "buy" : "short"; }
function gzState(c) { return glazeHas(c.id, c.i) ? "glazed" : (P.gzt | 0) > 0 ? "token" : P.tokens >= GLAZE_PRICE ? "buy" : "short"; }

/* ----- the tab ----- */
function renderShop() {
  const pan = $("acPanH");
  shopDisarm();
  pan.innerHTML = "";
  SH.pl = PLATES.map(shopPlateCard); SH.gz = FIGHTERS.map(shopGlazeCard); SH.ko = FIGHTERS.map(shopKoCard); SH.pk = shopKoPack(); SH.pmN = null;
  SH.why = KO.why;   // an old no from the server is not said again
  const top = shMk("div", "sh-top"), bal = shMk("span", "coin chips sh-bal"), pm = shMk("span", "sh-pm"), from = shMk("p", "sh-from"), sk = shMk("span", "sh-skins");
  bal.id = "shBal"; pm.id = "shPm"; from.id = "shFrom"; from.setAttribute("aria-live", "polite");
  sk.innerHTML = `Skins <b>${acSkinCount(P)} / ${acSkinTotal()}</b> · in the Locker`;
  top.append(bal, pm, from, sk);
  SH.top = { bal, pm, from };
  const ad = shMk("div", "sh-ad");   // not a button until ads exist
  ad.setAttribute("aria-disabled", "true");
  ad.innerHTML = `<i class="sh-adi" aria-hidden="true"></i><span class="sh-adt"><b>Free chips</b><span>A short ad, +${SH_AD} chips, 3 a day. Never required.</span></span><span class="sh-adv">${shCoin("+" + SH_AD)}</span><i class="sh-soon">Soon</i>`;
  ad.setAttribute("aria-label", `Free chips: a short ad, ${SH_AD} chips, 3 a day, never required. Coming soon.`);
  const kick = (title, text, more) => {   // more: a second sentence, shown here on a landscape sheet (under the cards the rest of the time, .sh-note)
    const k = shMk("div", "sh-k"), s = shMk("span", "", text);
    if (more) s.appendChild(shMk("em", "sh-k2", more));
    k.appendChild(shMk("b", "", title)); k.appendChild(s); return k;
  };
  const NOTE = "The worn skin of each fighter is glazed here.";
  const g1 = shMk("div", "sh-grid sh-plates"), g2 = shMk("div", "sh-grid sh-glaze"), g3 = shMk("div", "sh-grid sh-kogrid");
  g1.setAttribute("role", "group"); g1.setAttribute("aria-label", "Nameplates"); g2.setAttribute("role", "group"); g2.setAttribute("aria-label", "Glaze"); g3.setAttribute("role", "group"); g3.setAttribute("aria-label", "KO pages");
  for (const c of SH.pl) g1.appendChild(c.el);
  for (const c of SH.gz) g2.appendChild(c.el);
  for (const c of SH.ko) g3.appendChild(c.el);
  pan.append(top, ad, kick("Nameplates", "the plate behind your name", ", on the menu, in your profile and on the results"), g1,
    kick("Glaze", "a pearl sheen on a skin you own", `, ${GLAZE_PRICE} chips each. ${NOTE}`), g2,
    shMk("p", "sh-note", NOTE),
    kick("KO pages", "a second KO page per fighter, the Potatality", `. ${KO_NOTE}`), SH.pk.el, g3,
    shMk("p", "sh-note", KO_NOTE));
  koAsk();   // ui/kopages.js: the balance and the pages again from the server (not more than every 5 s)
  shopRefresh();
  shopPaint(true);
  shopLoop();
}
// the balance, the line at the top and every card's state (nothing is rebuilt, so a card keeps its focus)
function shopRefresh() {
  if (!SH.top) return;
  const name = acctName(), worn = shopWorn();
  SH.top.bal.innerHTML = fmtChips(P.tokens);
  SH.top.bal.setAttribute("aria-label", `${fmtChips(P.tokens)} chips`);
  SH.top.from.textContent = SH.msg || SH_FROM; SH.top.from.classList.toggle("say", !!SH.msg);
  for (const c of SH.pl) {
    const p = plateInfo(c.id), st = plState(c.id), arm = SH.arm === "p:" + c.id;
    c.nm.textContent = name;
    c.el.className = `sh-c sh-pl ${st}${arm ? " arm" : ""}`;
    c.small.innerHTML = arm ? `<span>Sure?</span>${shCoin(p.price)}` : st === "worn" ? "Worn" : st === "own" ? "Tap to wear" : st === "gift" ? "Harvest gift" : shCoin(p.price);
    c.el.setAttribute("aria-pressed", String(st === "worn"));
    c.el.setAttribute("aria-label", `${p.name} nameplate: ${st === "worn" ? "worn" : st === "own" ? "owned, tap to wear" : st === "gift" ? "a gift on day 7 of the Harvest" : arm ? `tap again to buy for ${p.price} chips` : `${p.price} chips`}`);
  }
  for (const c of SH.gz) {
    const st = gzState(c), arm = SH.arm === "g:" + c.id, spec = FIG[c.id], pal = spec.palettes[c.i] || spec.palettes[0];
    const tk = st === "token" || (arm && (P.gzt | 0) > 0), price = tk ? "token" : shCoin(GLAZE_PRICE), say = tk ? "a Glaze token" : `${GLAZE_PRICE} chips`;
    c.el.className = `sh-c sh-gz ${st === "token" ? "buy tk" : st}${arm ? " arm" : ""}`;
    c.small.innerHTML = arm ? `<span>Sure?</span>${tk ? " token" : price}` : st === "glazed" ? "Glazed ✦" : `<span>Glaze</span>${tk ? " · token" : price}`;
    c.el.setAttribute("aria-label", `${spec.name}, ${pal.name}: ${st === "glazed" ? "glazed" : arm ? `tap again to glaze for ${say}` : `glaze for ${say}`}`);
    if (glazeOn(c.art.f) !== (st === "glazed")) { glazeMark(c.art.f, st === "glazed"); shopPaint(false); }
  }
  shopKoUpdate();
}
// the Pommes pill, the pack row and every KO card's state (in place, nothing is rebuilt)
function shopKoUpdate() {
  const n = koBal(), pm = SH.top.pm, buy = !!KO.buy, pk = SH.pk, eu = `${KO_PRICE} Pommes, ${KO_EUR}`;
  if (SH.pmN !== n) {
    pm.innerHTML = `<i class="pmglyph" aria-hidden="true"></i><b>${fmtChips(n)}</b> <span>Pommes</span>`;
    pm.setAttribute("aria-label", `${fmtChips(n)} Pommes`);
    if (SH.pmN !== null && !resCalm()) slReplay(pm, "sh-pop");
    SH.pmN = n;
  }
  pk.el.classList.toggle("go", buy); pk.soon.hidden = buy;
  if (buy) { pk.el.setAttribute("role", "button"); pk.el.tabIndex = 0; pk.el.removeAttribute("aria-disabled"); }
  else { pk.el.removeAttribute("role"); pk.el.removeAttribute("tabindex"); pk.el.setAttribute("aria-disabled", "true"); }
  pk.el.setAttribute("aria-label", `${eu}: one KO page. Pommes stay on your account.${buy ? "" : " Coming soon."}`);
  for (const c of SH.ko) {
    const pg = KO_PAGES[c.id] || { name: FIG[c.id].name }, st = koState(c.id), arm = SH.arm === "k:" + c.id && st === "buy", busy = KO.busy === c.id, has = koHas(c.id);
    for (const k of ["on", "own", "buy", "short"]) c.el.classList.toggle(k, st === k);
    c.el.classList.toggle("arm", arm); c.el.classList.toggle("busy", busy);
    c.small.innerHTML = busy ? "…" : st === "on" ? "In use" : st === "own" ? "Tap to use" : arm ? `<span>Sure?</span>${shKoPrice}` : shKoPrice;
    c.main.setAttribute("aria-label", `${pg.name}, ${FIG[c.id].name}'s Potatality: ${busy ? "buying" : st === "on" ? "in use, tap to switch it off" : st === "own" ? "tap to use it" : arm ? `tap again to buy for ${eu}` : st === "buy" ? eu : `${eu}, you have ${fmtChips(n)} Pommes${buy ? "" : ", Pommes come soon"}`}`);
    if (st === "on" || st === "own") c.main.setAttribute("aria-pressed", String(st === "on")); else c.main.removeAttribute("aria-pressed");
    c.main.setAttribute("aria-busy", String(busy));
    c.soon.hidden = !(st === "short" && !buy);
    c.go.disabled = !has;
    c.go.setAttribute("aria-label", has ? `Watch ${pg.name}` : `Watch ${pg.name}: not available yet, this page is still being drawn`);
  }
}
function shopSay(text) {
  SH.msg = text; clearTimeout(SH.msgT);
  SH.msgT = setTimeout(() => { SH.msg = ""; shopRefresh(); }, 4200);
  shopRefresh();
}
function shopDisarm() { clearTimeout(SH.armT); SH.arm = ""; }
function shopArm(key) {
  SH.arm = key; Sfx.ui(); clearTimeout(SH.armT);
  SH.armT = setTimeout(() => { SH.arm = ""; shopRefresh(); }, 3000);
  shopRefresh();
}
// leaving the tab or the sheet: nothing stays armed, the redraw loop stops
function shopLeave() { shopDisarm(); clearTimeout(SH.msgT); SH.msg = ""; clearTimeout(SH.hiT); cancelAnimationFrame(SH.raf); SH.raf = 0; }
function shopPaid(price) { P.tokens -= price; saveProfile(); Sfx.uiCoin(); renderPill(); if (SH.top && !resCalm()) slReplay(SH.top.bal, "sh-pop"); }

function shopPlateTap(id) {
  Sfx.init();
  const p = plateInfo(id), st = plState(id);
  if (st === "worn") { shopDisarm(); shopRefresh(); return; }
  if (st === "own") {   // owned: worn at once
    shopDisarm(); P.plate = id; saveProfile(); Sfx.uiFlip(); renderPill(); shopRefresh(); return;
  }
  if (st === "gift") { shopDisarm(); Sfx.uiNo(); shopSay(`${p.name} isn't sold: it is the gift on day 7 of the Harvest, behind the flame on the start page.`); return; }
  if (st === "short") { shopDisarm(); Sfx.uiNo(); shopSay(`${p.name} costs ${p.price} chips and you have ${fmtChips(P.tokens)}: ${p.price - P.tokens} more needed.`); return; }
  if (SH.arm !== "p:" + id) { shopArm("p:" + id); return; }
  shopDisarm();
  if (P.tokens < p.price || shopOwns(id)) { shopRefresh(); return; }
  P.plates = [...new Set([...(Array.isArray(P.plates) ? P.plates : []), id])]; P.plate = id;
  shopPaid(p.price); shopRefresh();
}
function shopGlazeTap(id) {
  Sfx.init();
  const c = SH.gz.find((x) => x.id === id), st = gzState(c);
  if (st === "glazed") { shopDisarm(); shopRefresh(); return; }
  if (st === "short") { shopDisarm(); Sfx.uiNo(); shopSay(`Glaze costs ${GLAZE_PRICE} chips and you have ${fmtChips(P.tokens)}: ${GLAZE_PRICE - P.tokens} more needed.`); return; }
  if (SH.arm !== "g:" + id) { shopArm("g:" + id); return; }
  shopDisarm();
  const tk = (P.gzt | 0) > 0;   // a Glaze token from the Harvest goes first
  if ((!tk && P.tokens < GLAZE_PRICE) || glazeHas(id, c.i)) { shopRefresh(); return; }
  if (!P.glazed || typeof P.glazed !== "object" || Array.isArray(P.glazed)) P.glazed = {};
  P.glazed[id] = [...new Set([...(Array.isArray(P.glazed[id]) ? P.glazed[id] : []), c.i])].sort((a, b) => a - b);
  if (tk) P.gzt = (P.gzt | 0) - 1;
  shopPaid(tk ? 0 : GLAZE_PRICE); shopRefresh();
}
/* ----- KO pages: a tap on a card, WATCH, what the server said, back from WATCH, the results' band ----- */
function shopKoTap(id) {
  Sfx.init();
  const st = koState(id), name = KO_PAGES[id].name;
  if (st === "on" || st === "own") { shopDisarm(); Sfx.uiFlip(); koUse(id, st === "own"); shopRefresh(); return; }   // owned: on or off with one tap
  if (KO.busy) return;   // the server is still answering a buy
  if (st === "short") {
    shopDisarm(); Sfx.uiNo();
    shopSay(KO.buy ? `${name} costs ${KO_PRICE} Pommes and you have ${fmtChips(koBal())}.` : "Pommes come soon: the page is in the Shop the day they do.");
    return;
  }
  if (SH.arm !== "k:" + id) { shopArm("k:" + id); return; }
  shopDisarm(); SH.koId = id;
  if (koBuy(id)) { SH.koWait = true; shopRefresh(); return; }   // asked: "…" until the server answers (pm-ok, pm-no: shopKoRender)
  shopKoSay(KO.why === "short" ? "short" : "fail");   // it could not even be asked (no connection, signed out)
}
function shopKoSay(why) {
  const name = (KO_PAGES[SH.koId] || { name: "A page" }).name;
  Sfx.uiNo();
  shopSay(why === "short" ? `${name} costs ${KO_PRICE} Pommes and you have ${fmtChips(koBal())}.` : why === "own" ? "You own it already." : why === "acct" ? "Signed out for a moment: try again." : "That didn't go through: try again.");
}
function shopKoWatch(id) {
  Sfx.init();
  if (!koHas(id)) return;
  if (!koDemoOk(id)) { shopDisarm(); Sfx.uiNo(); shopSay("Watch works from the menu."); return; }
  shopLeave();   // the sheet closes under the page; renderShop starts everything again when it comes back
  try { koDemo(id); } catch (e) {   // a page that fails to start must not leave the game on an empty match screen: back to the Shop
    try { koDemoEnd(); } catch (e2) { /* nothing left to tidy */ }
    if (typeof console !== "undefined") console.warn("WATCH failed", e);
    shopSay("That page didn't play: try again.");
  }
}
// ui/kopages.js calls this on every change of the server's copy (a no-op unless the Shop is on the screen)
function shopKoRender() {
  if (!SH.top || screens.account.hidden || acUI.tab !== "h") return;
  if (KO.why) SH.koWait = false;
  else if (SH.koWait && koOwn(SH.koId)) { SH.koWait = false; Sfx.uiCoin(); }   // the server paid: the page is yours
  if (KO.why !== SH.why) { SH.why = KO.why; if (KO.why) shopKoSay(KO.why); }   // a no from the server, said once
  shopRefresh();
}
// back from WATCH, or from the results' band: the Shop on that fighter's card, scrolled into view, a short pulse
function shopKoFocus(id) {
  if (screens.account.hidden || acUI.tab !== "h") openAccount("h");
  const c = SH.ko.find((x) => x.id === id);
  if (!c || !c.el.isConnected) return;
  const calm = !!window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  clearTimeout(SH.hiT);
  for (const x of SH.ko) x.el.classList.remove("hi");
  void c.el.offsetWidth;
  c.el.classList.add("hi");
  c.el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
  SH.hiT = setTimeout(() => c.el.classList.remove("hi"), 1700);
}
// the results' band, "Potatality · in the Shop", after a CPU played its page on you (match.koTease: that fighter's id); a tap opens the Shop on that card
function shopResKo(id) {
  const el = $("rKo"), ok = typeof id === "string" && !!KO_PAGES[id];
  el.hidden = !ok; el.dataset.id = ok ? id : "";
  if (ok) el.setAttribute("aria-label", `${KO_PAGES[id].name}, ${FIG[id].name}'s Potatality: see it in the Shop`);
}
$("rKo").addEventListener("click", () => {
  const id = $("rKo").dataset.id;
  if (!id) return;
  Sfx.init(); Sfx.ui(); openAccount("h"); shopKoFocus(id);
});
// a tap anywhere in the tab but on the armed card puts it back
$("acPanH").addEventListener("click", (e) => { if (SH.arm && !e.target.closest(".sh-c.arm")) { shopDisarm(); shopRefresh(); } }, true);

/* ----- the models: drawn once the cards stand on the page, again when the sheet changes size, and over and over while a glazed one is there (the sheen moves) ----- */
function shopPaint(all) { for (const c of SH.gz) if (all || glazeOn(c.art.f)) paintModel(c.art, tick); }
function shopLoop() {
  cancelAnimationFrame(SH.raf); SH.raf = 0;
  if (!SH.gz.some((c) => glazeHas(c.id, c.i))) return;
  const step = () => {
    SH.raf = 0;
    if (screens.account.hidden || acUI.tab !== "h") return;
    shopPaint(false);
    SH.raf = requestAnimationFrame(step);
  };
  SH.raf = requestAnimationFrame(step);
}
if (window.ResizeObserver) new ResizeObserver(() => { if (!screens.account.hidden && acUI.tab === "h") shopPaint(true); }).observe($("acPanH"));
// a purchase made while the tab is open may add the first glazed card: start the loop then
$("acPanH").addEventListener("click", () => { if (!SH.raf && acUI.tab === "h") shopLoop(); });
// the results: your name on the plate you wear next to the fighter's name; nothing for Ink (the results look as they always did)
function shopResPlate() {
  const el = $("rPlate"), id = shopWorn();
  el.hidden = !id;
  if (id) { el.textContent = acctName(); plateSet(el, id); }
}
// the lobby and the other screens ask for the worn plate's class through this (ui/online.js, later)
window.__blShop = { plates: PLATES, cls: plateCls, worn: shopWorn, resKo: shopResKo };   // resKo: the tests set the results' band without a lost match
