/* ===================== the Pommes Shop (UI only; Fable's design: Project files step8/fable-design-2.md section 3) =====================
   Pommes have their own sheet, #scrPshop (css/93-pshop.css), opened by the Pommes pill on the start page (#mPommes in the plate button, acct.js
   routes the tap), and by pshopOpen(id) from the Account Shop, the Skin Rack and the results band. It never scrolls: one row of the eight fighters, the
   chosen one ringed in red with his name under it; under it that fighter's goods, six cards in one row (upright: the three finishers, the Shuffle as a bar
   and two skin cards): Classic, Potatality 1, Potatality 2, SHUFFLE, and his two Pommes skins (Ink Noir, Starfall); and Get Pommes (an ad for +10, the
   euro pack). Everything is state from ui/kopages.js (koMine, koBal, koOwn, koPick, koSetPick, koBuy, KO.ads ...); nothing here pays or adds Pommes:
   the server does (kopages.js, pommes.js) and this sheet draws what it said.
   - A finisher card: the page's portrait on halftone with its sound word behind, the name, the price row (the fries cone and "300 · €2.99", never a
     coin; "Free" for Classic, "Owned"), one button. Locked: BUY, a tap arms it (SURE? for 3 s), the second tap asks the server; short of Pommes the card
     shakes, a toast says how many more and the ad tile pulses once. Owned: USE, or PLAYS ✓ on the one that plays, with the gold PLAYS badge; with Shuffle on the
     owned pages read IN MIX. Exactly one of Classic, Potatality 1, Potatality 2 and SHUFFLE plays per fighter (koPick). WATCH (the round button on the
     thumb) plays the page on a dummy (koDemo) and comes back to this sheet on that fighter; it works in every state, nothing counts.
   - A skin card: the figure drawn live in the skin (paintModel, moving with the game's tick). Owned: WEAR / WORN ✓ (P.pal); buying wears it (kopages.js).
   - Without a sync code the Pommes cannot live anywhere: Get Pommes is one tile, MAKE A CODE (Account > Profile), BUY is dim; WATCH, USE and WEAR work.
   - The ad tile: ads off on the page (adsOn) or on the server (KO.ads) -> SOON; else it asks ui/ads.js for an ad when the sheet opens (adsPrime "pommes"), a
     tap plays it, the reward asks the server (koAdClaim): "3 of 5 today", then "back tomorrow"; KO.why "wait" counts down. The pack tile reads SOON until the
     server says KO.buy. Every top-level name here starts with ps / PS (all ui parts share one scope). Tests: window.__blPshop. */
screens.pshop = $("scrPshop");
const PS = { id: "", on: false, arm: "", armT: 0, wait: "", why: "", claim: false, msgT: 0, raf: 0, tmr: 0, made: false, fin: [], sk: [], strip: [], ad: null, pk: null, mk: null, adN: -1, hiT: 0, pulseT: 0, ret: null };
const PS_WORD_CLASSIC = "KO";
const PS_SOON_AD = "Ads come soon: they pay Pommes without paying anything.";
const psMk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const psCalm = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const psCone = (cls) => `<i class="ps-cone${cls ? " " + cls : ""}" aria-hidden="true"></i>`;
const psPrice = () => `${psCone()}<span>${KO_PRICE} · ${KO_EUR}</span>`;
const psSpec = () => FIG[PS.id];
const psPageItem = (n) => (n === 2 ? "ko2:" : "ko:") + PS.id;
const psSkinItem = (n) => "sk" + n + ":" + PS.id;

/* ----- the start page's pill (acct.js renderPill calls psPill; every answer of the server too) ----- */
// the pill is small: from 100,000 on it says 123k, from a million 1.2M (the sheet and the label say the whole number)
const psShort = (n) => (n >= 1e6 ? `${(Math.floor(n / 1e5) / 10).toFixed(1)}M` : n >= 1e5 ? `${Math.floor(n / 1000)}k` : fmtChips(n));
function psPill() {
  const el = $("mPommes");
  if (!el) return;
  const n = koBal();
  el.textContent = psShort(n);
  el.classList.toggle("zero", !(n > 0));
}
koListen(() => { renderPill(); psKoRender(); });   // renderPill (acct.js) sets the pill, its label and the bar's fit

/* ----- building the sheet once: the strip, the six cards, the Get Pommes tiles ----- */
const PS_DICE = `<svg viewBox="0 0 64 44" aria-hidden="true"><g stroke="#0e1022" stroke-width="2.6" stroke-linejoin="round"><g transform="rotate(-14 22 24)"><rect x="5" y="9" width="30" height="30" rx="7" fill="#fff6e4"/><g fill="#0e1022" stroke="none"><circle cx="13" cy="17" r="2.6"/><circle cx="27" cy="17" r="2.6"/><circle cx="20" cy="24" r="2.6"/><circle cx="13" cy="31" r="2.6"/><circle cx="27" cy="31" r="2.6"/></g></g><g transform="rotate(12 44 22)"><rect x="31" y="3" width="28" height="28" rx="7" fill="#ff6a5f"/><g fill="#fff6e4" stroke="none"><circle cx="39" cy="11" r="2.6"/><circle cx="51" cy="11" r="2.6"/><circle cx="39" cy="23" r="2.6"/><circle cx="51" cy="23" r="2.6"/></g></g></g></svg>`;
const PS_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.2v15.6L20.5 12z" fill="currentColor"/></svg>`;
// a card: a div with the card itself (.ps-main, one button) and WATCH (.ps-go); the badge and the shake belong to the div
function psFinCard(k) {
  const sh = k === "s", el = psMk("div", "ps-c ps-fc" + (sh ? " ps-shuf" : "")), main = psMk("button", "ps-main"), art = psMk("span", "ps-art"), word = psMk("i", "ps-word"), pic = psMk("i", "ps-pic");
  const info = psMk("span", "ps-info"), nm = psMk("b", "ps-nm"), ln = psMk("span", "ps-ln"), pr = psMk("span", "ps-pr"), btn = psMk("span", "ps-btn"), badge = psMk("i", "ps-badge");
  main.type = "button";
  badge.setAttribute("aria-hidden", "true"); word.setAttribute("aria-hidden", "true"); pic.setAttribute("aria-hidden", "true"); btn.setAttribute("aria-hidden", "true");
  if (sh) { art.innerHTML = PS_DICE; art.classList.add("ps-dice"); nm.textContent = "Shuffle"; }
  else art.append(word, pic);
  info.append(nm, ln, pr, btn);
  main.append(art, info);
  el.append(main, badge);
  const c = { kind: "fin", k, key: sh ? "sh" : "p" + k, el, main, art, word, pic, nm, ln, pr, btn, badge, go: null };
  if (!sh) {
    const go = psMk("button", "ps-go");
    go.type = "button"; go.innerHTML = PS_PLAY + `<span aria-hidden="true">Watch</span>`;
    go.addEventListener("click", () => psWatch(k));
    el.appendChild(go); c.go = go;
  }
  main.addEventListener("click", () => psTap(c));
  return c;
}
function psSkinCard(n) {
  const el = psMk("div", "ps-c ps-kc"), main = psMk("button", "ps-main"), art = psMk("span", "ps-art ps-fig"), cv = psMk("canvas"), tag = psMk("i", "ps-tag", "Pommes");
  const info = psMk("span", "ps-info"), nm = psMk("b", "ps-nm"), ln = psMk("span", "ps-ln"), pr = psMk("span", "ps-pr"), btn = psMk("span", "ps-btn"), badge = psMk("i", "ps-badge");
  main.type = "button";
  cv.setAttribute("aria-hidden", "true"); tag.setAttribute("aria-hidden", "true"); badge.setAttribute("aria-hidden", "true"); btn.setAttribute("aria-hidden", "true");
  art.append(cv, tag);
  info.append(nm, ln, pr, btn);
  main.append(art, info);
  el.append(main, badge);
  const c = { kind: "sk", n, key: "k" + n, el, main, art, cv, nm, ln, pr, btn, badge, af: null };
  main.addEventListener("click", () => psTap(c));
  return c;
}
function psBuild() {
  if (PS.made) return;
  PS.made = true;
  const strip = $("psStrip"), fin = $("psFin"), sk = $("psSk");
  for (const spec of FIGHTERS) {
    const b = psMk("button", "ps-f"), a = psMk("span", "ps-fa"), nm = psMk("i", "ps-fn", spec.name);
    b.type = "button"; b.dataset.id = spec.id;
    if (PORTRAITS[spec.id]) a.style.backgroundImage = `url("${PORTRAITS[spec.id]}")`;
    a.setAttribute("aria-hidden", "true"); nm.setAttribute("aria-hidden", "true");
    b.setAttribute("aria-label", spec.name);
    b.append(a, nm);
    b.addEventListener("click", () => { Sfx.init(); if (PS.id !== spec.id) { Sfx.uiFlip(); psChoose(spec.id); } });
    strip.appendChild(b);
    PS.strip.push({ id: spec.id, el: b });
  }
  for (const k of [0, 1, 2, "s"]) { const c = psFinCard(k); PS.fin.push(c); fin.appendChild(c.el); }
  for (const n of [1, 2]) { const c = psSkinCard(n); PS.sk.push(c); sk.appendChild(c.el); }
  strip.addEventListener("keydown", (e) => {   // the arrow keys walk the strip
    if (e.code !== "ArrowLeft" && e.code !== "ArrowRight") return;
    const i = FIGHTERS.findIndex((f) => f.id === PS.id), j = (i + (e.code === "ArrowRight" ? 1 : FIGHTERS.length - 1)) % FIGHTERS.length;
    e.preventDefault(); Sfx.uiFlip(); psChoose(FIGHTERS[j].id);
    const b = PS.strip[j] && PS.strip[j].el; if (b) b.focus();
  });
  // Get Pommes: the ad tile and the pack tile (one of them, or the make-a-code tile, is drawn by psGet)
  const get = $("psGet");
  const ad = psMk("button", "ps-tile ps-ad"), pk = psMk("div", "ps-tile ps-pk"), mk = psMk("div", "ps-tile ps-mk");
  ad.type = "button";
  ad.innerHTML = `<span class="ps-ti">${PS_PLAY}</span><span class="ps-tx"><b>Watch an ad</b><small></small></span><span class="ps-tv"><span class="ps-tn">+10</span><span class="ps-tu">${psCone()}Pommes</span></span><i class="ps-soon" aria-hidden="true">Soon</i>`;
  pk.innerHTML = `<span class="ps-ti">${psCone("big")}</span><span class="ps-tx"><b>${KO_PRICE} Pommes</b><small>one page or skin</small></span><span class="ps-tv"><span class="ps-tn">${KO_EUR}</span></span><i class="ps-soon" aria-hidden="true">Soon</i>`;
  mk.innerHTML = `<span class="ps-ti">${psCone("big")}</span><span class="ps-tx"><b>Pommes live on your account</b><small>make a sync code to buy, earn and keep them</small></span><button type="button" class="ps-mkb"><span>Make a code</span></button>`;
  ad.addEventListener("click", psAdTap);
  pk.addEventListener("click", () => { if (KO.buy) { Sfx.init(); Sfx.ui(); psSay("Buying Pommes opens soon."); } });
  pk.addEventListener("keydown", (e) => { if (KO.buy && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pk.click(); } });
  mk.querySelector(".ps-mkb").addEventListener("click", () => { Sfx.init(); Sfx.ui(); pshopClose(); openAccount("p"); });
  PS.ad = ad; PS.pk = pk; PS.mk = mk;
  get.append(ad, pk, mk);
}

/* ----- opening, closing, choosing a fighter ----- */
function psDefault() { return FIG[sel.fighter] ? sel.fighter : FIGHTERS[0].id; }
// id (optional): the fighter chosen first; default your current fighter
function pshopOpen(id) {
  if (!screens.pshop) return;
  psBuild();
  PS.id = typeof id === "string" && FIG[id] ? id : psDefault();
  psDisarm(); PS.wait = ""; PS.why = KO.why; PS.claim = false; PS.adN = KO.adN;
  clearTimeout(PS.msgT); $("psToast").hidden = true;
  PS.on = true;
  modal("pshop", true);
  psFill(); psStyle();
  koAsk(true);   // the balance and what you own, again from the server
  psPrimeAd();
  clearInterval(PS.tmr); PS.tmr = setInterval(() => { if (PS.on && psAdState() === "wait") psStyle(); }, 1000);
  psLoop();
  const b = $("psClose"); if (b && typeof b.focus === "function") try { b.focus({ preventScroll: true }); } catch (e) { /* kept */ }
}
// the sheet goes without the page behind knowing (WATCH, close): timers off, nothing armed
function psLeave() {
  PS.on = false;
  psDisarm(); clearTimeout(PS.msgT); clearInterval(PS.tmr); PS.tmr = 0; clearTimeout(PS.hiT); clearTimeout(PS.pulseT);
  cancelAnimationFrame(PS.raf); PS.raf = 0;
  $("psToast").hidden = true;
  modal("pshop", false);
}
function pshopClose() {
  if (!PS.on && screens.pshop.hidden) return;
  psLeave();
  if (typeof renderPill === "function") renderPill();   // the pill on the start page and the plate follow what was bought
}
// the sheet on that fighter (open already: the fighter changes and his cards pulse once; closed: it opens on him)
function pshopFocus(id) {
  if (!PS.on) { pshopOpen(id); return; }
  if (FIG[id]) { PS.id = id; psDisarm(); psFill(); psStyle(); }
  const row = $("psGoods");
  clearTimeout(PS.hiT); row.classList.remove("hi"); void row.offsetWidth;
  if (!psCalm()) { row.classList.add("hi"); PS.hiT = setTimeout(() => row.classList.remove("hi"), 1500); }
}
function psChoose(id) {
  if (!FIG[id]) return;
  PS.id = id; psDisarm(); PS.wait = ""; psFill(); psStyle();
}
$("psClose").addEventListener("click", () => { Sfx.init(); Sfx.uiBack ? Sfx.uiBack() : Sfx.ui(); pshopClose(); });
screens.pshop.addEventListener("click", (e) => { if (e.target === screens.pshop) pshopClose(); });
window.addEventListener("keydown", (e) => {   // before the other sheets' own Escape: only this one closes
  if (e.code === "Escape" && PS.on && !screens.pshop.hidden) { e.preventDefault(); e.stopImmediatePropagation(); pshopClose(); }
}, true);

/* ----- what belongs to the chosen fighter: portraits, words, names, the skins' figures ----- */
function psFill() {
  const id = PS.id, spec = psSpec();
  if (!spec) return;
  const src = PORTRAITS[id] ? `url("${PORTRAITS[id]}")` : "";
  for (const c of PS.fin) {
    if (c.k === "s") continue;
    const pg = c.k === 0 ? { name: "Classic", word: PS_WORD_CLASSIC } : koPage(id, c.k);
    c.pic.style.backgroundImage = src;
    c.word.textContent = pg.word; c.word.style.setProperty("--wn", String(Math.max(3, pg.word.length)));
    c.nm.textContent = pg.name; c.nm.style.setProperty("--nl", String(Math.max(6, pg.name.length)));
    c.ln.innerHTML = c.k === 0 ? `<span class="f">${spec.name}'s </span>normal KO` : `<span class="f">${spec.name} · </span>Potatality ${c.k}`;   // the fighter's name goes first when the card is narrow
  }
  for (const c of PS.sk) {
    const i = koSkinIdx(id, c.n), pal = i >= 0 ? spec.palettes[i] : null;
    c.pal = i;
    c.nm.textContent = pal ? pal.name : c.n === 1 ? "Ink Noir" : "Starfall"; c.nm.style.setProperty("--nl", String(Math.max(6, c.nm.textContent.length)));
    c.ln.innerHTML = `<span class="f">${spec.name} · </span>${c.n === 1 ? "manga ink" : "night sky"}`;
    c.el.style.setProperty("--c", pal ? col(pal) : "#ff4f4f");
    if (pal) {
      const f = BL.newGame({ seed: 1, players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
      f.x = 0; f.y = 0; f.facing = -1;
      c.af = { cv: c.cv, f, fit: 0.74, bottom: 0.93 };   // a little smaller than the Rack's, so a dragon's tail and wings stay in the card
    } else c.af = null;
  }
  for (const s of PS.strip) { const on = s.id === id; s.el.classList.toggle("on", on); s.el.setAttribute("aria-pressed", String(on)); }
}
// the skins live: drawn with the game's tick, so the halftone boils and the stars twinkle
function psPaint(all) { for (const c of PS.sk) if (c.af) paintModel(c.af, tick); }
function psLoop() {
  cancelAnimationFrame(PS.raf);
  let last = -99;
  const step = (t) => {
    PS.raf = 0;
    if (!PS.on) return;
    if (t - last >= 33) { last = t; psPaint(); }
    PS.raf = requestAnimationFrame(step);
  };
  psPaint();
  PS.raf = requestAnimationFrame(step);
}
if (window.ResizeObserver) new ResizeObserver(() => { if (PS.on) psPaint(); }).observe($("psSheet"));

/* ----- the cards' states ----- */
const psUsable = () => [1, 2].filter((n) => koOwn(PS.id, n) && koHas(PS.id, n));
// a finisher card's state: own | buy | short | soon (the page isn't drawn yet), and whether it plays (on) or is in the mix
function psFinState(c) {
  if (c.k === "s") return psUsable().length > 1 ? "own" : "off";
  if (c.k === 0) return "own";
  if (!koHas(PS.id, c.k)) return "soon";
  if (koOwn(PS.id, c.k)) return "own";
  return koBal() >= KO_PRICE && koMine() ? "buy" : "short";
}
function psSkinState(c) {
  if (c.pal < 0) return "soon";
  if (koItem(psSkinItem(c.n)) || (P.owned[PS.id] || [0]).includes(c.pal)) return palIdx(PS.id) === c.pal ? "worn" : "own";
  return koBal() >= KO_PRICE && koMine() ? "buy" : "short";
}
const PS_STATES = ["own", "buy", "short", "soon", "off", "worn", "on", "mix", "arm", "busy", "nocode"];
function psSet(c, st, on, mix, arm, busy, label, price, btn) {
  for (const s of PS_STATES) c.el.classList.toggle(s, s === st || (s === "on" && on) || (s === "mix" && mix) || (s === "arm" && arm) || (s === "busy" && busy) || (s === "nocode" && !ACCT.code && (st === "buy" || st === "short")));
  c.pr.innerHTML = price; c.btn.textContent = btn;
  c.main.setAttribute("aria-label", label);
  c.main.disabled = st === "soon";
  c.btn.title = "";
}
function psStyle() {
  if (!PS.on) return;
  const id = PS.id, spec = psSpec(), pick = koPick(id), bal = koBal(), mix = pick === "s";
  $("psBal").innerHTML = `${psCone()}<b>${fmtChips(bal)}</b> <span>Pommes</span>`;
  $("psBal").classList.toggle("zero", !(bal > 0));
  $("psBal").setAttribute("aria-label", `${fmtChips(bal)} Pommes`);
  for (const c of PS.fin) {
    const st = psFinState(c), name = c.nm.textContent;
    if (c.k === "s") {
      const u = psUsable().length, on = pick === "s";
      c.nm.textContent = "Shuffle"; c.nm.style.setProperty("--nl", "7");
      c.ln.innerHTML = `<span class="l">a random owned one each KO</span><span class="s">random owned</span>`;
      const hint = u === 0 ? `<span class="l">buy a Potatality</span><span class="s">buy a page</span>` : `<span class="l">buy one more page</span><span class="s">buy 1 more</span>`;
      psSet(c, st, on, false, false, false, st === "off" ? `Shuffle: ${u === 0 ? "buy a Potatality first" : "needs two Potatalities"}` : `Shuffle: a random owned page each KO${on ? ", plays" : ", tap to use"}`, "", on ? "Plays ✓" : "Use");
      c.pr.innerHTML = st === "off" ? hint : "";
      c.main.setAttribute("aria-pressed", String(on));
      c.badge.textContent = on ? "Plays" : "";
      continue;
    }
    const n = c.k, item = n ? psPageItem(n) : "", on = pick === n, inMix = mix && n > 0 && st === "own", arm = PS.arm === item && st === "buy", busy = !!item && KO.busy === item;
    const btn = st === "soon" ? "Soon" : busy ? "…" : arm ? "Sure?" : st === "own" ? (on ? "Plays ✓" : inMix ? "In the mix" : "Use") : "Buy";
    const price = n === 0 ? "Free" : st === "own" ? "Owned" : st === "soon" ? "Soon" : psPrice();
    const label = st === "soon" ? `${name}: not drawn yet, coming soon` : st === "own" ? `${name}, ${spec.name}'s ${n ? "Potatality " + n : "classic KO"}: ${on ? "plays on your KO" : inMix ? "in the mix" : "tap to use"}`
      : `${name}, ${spec.name}'s Potatality ${n}: ${busy ? "buying" : arm ? "tap again to buy" : `${KO_PRICE} Pommes, ${KO_EUR}`}`;
    psSet(c, st, on, inMix, arm, busy, label, price, btn);
    c.badge.textContent = on ? "Plays" : inMix ? "In mix" : "";
    c.main.setAttribute("aria-pressed", st === "own" ? String(on) : "false");
    if (c.go) {
      const can = n === 0 || koHas(id, n);
      c.go.disabled = !can;
      c.go.setAttribute("aria-label", can ? `Watch ${name}` : `Watch ${name}: not drawn yet`);
    }
  }
  for (const c of PS.sk) {
    const st = psSkinState(c), item = psSkinItem(c.n), arm = PS.arm === item && st === "buy", busy = KO.busy === item, worn = st === "worn", name = c.nm.textContent;
    const btn = st === "soon" ? "Soon" : busy ? "…" : arm ? "Sure?" : worn ? "Worn ✓" : st === "own" ? "Wear" : "Buy";
    const price = st === "own" || st === "worn" ? "Owned" : st === "soon" ? "Soon" : psPrice();
    psSet(c, st, false, false, arm, busy, `${name} skin for ${spec.name}: ${worn ? "worn" : st === "own" ? "owned, tap to wear" : busy ? "buying" : arm ? "tap again to buy" : `${KO_PRICE} Pommes, ${KO_EUR}`}`, price, btn);
    c.badge.textContent = worn ? "Worn" : "";
    c.main.setAttribute("aria-pressed", st === "own" || worn ? String(worn) : "false");
  }
  psGet();
}
// the fourth row: no sync code is one tile; else the ad tile and the pack tile
function psAdWait() { return KO.why === "wait" ? Math.max(0, Math.ceil(KO.adIn - (Date.now() - KO.adT) / 1000)) : 0; }
// soon | gone | wait | busy | load | ready | none | idle
function psAdState() {
  if (!adsOn() || !KO.ads) return "soon";
  if (koAdLeft() <= 0) return "gone";
  if (KO.busy === "ad" || adsState("pommes") === "busy") return "busy";
  if (psAdWait() > 0) return "wait";
  const s = adsState("pommes");
  return s === "wait" ? "load" : s === "ready" ? "ready" : s === "none" ? "none" : "idle";
}
function psGet() {
  const has = !!ACCT.code, ad = PS.ad, pk = PS.pk, mk = PS.mk;
  ad.hidden = pk.hidden = !has; mk.hidden = has;
  $("psGet").classList.toggle("nocode", !has);
  if (!has) return;
  const st = psAdState(), left = koAdLeft(), sub = ad.querySelector("small");
  const words = { soon: "ads come soon", gone: "back tomorrow", wait: `in ${psAdWait()}s`, busy: "…", load: "looking for one…", none: "no ad now, tap to retry", idle: "tap to look for one", ready: `${KO.adN} of ${KO.adMax} today` };
  sub.textContent = words[st];
  for (const s of ["soon", "gone", "wait", "busy", "load", "ready", "none", "idle"]) ad.classList.toggle(s, s === st);
  ad.setAttribute("aria-disabled", String(st === "soon" || st === "gone" || st === "busy" || st === "load" || st === "wait"));
  ad.setAttribute("aria-label", `Watch an ad for 10 Pommes: ${words[st]}${st === "soon" ? "" : `, ${left} left today`}`);
  const buy = !!KO.buy;
  pk.classList.toggle("go", buy);
  pk.querySelector(".ps-soon").hidden = buy;
  if (buy) { pk.setAttribute("role", "button"); pk.tabIndex = 0; pk.removeAttribute("aria-disabled"); } else { pk.removeAttribute("role"); pk.removeAttribute("tabindex"); pk.setAttribute("aria-disabled", "true"); }
  pk.setAttribute("aria-label", `${KO_PRICE} Pommes for ${KO_EUR}: one page or skin${buy ? "" : ". Coming soon."}`);
}

/* ----- taps ----- */
function psDisarm() { clearTimeout(PS.armT); PS.arm = ""; }
function psArm(item) {
  PS.arm = item; Sfx.ui(); clearTimeout(PS.armT);
  PS.armT = setTimeout(() => { PS.arm = ""; psStyle(); }, 3000);
  psStyle();
}
// a card says no: it shakes (3 x 2 px in 240 ms) and a toast tells why
function psNo(c, text) {
  Sfx.uiNo();
  if (c && c.el && !psCalm()) { c.el.classList.remove("shake"); void c.el.offsetWidth; c.el.classList.add("shake"); setTimeout(() => c.el.classList.remove("shake"), 300); }
  psSay(text);
}
function psSay(text) {
  const t = $("psToast");
  t.textContent = text; t.hidden = false;
  t.classList.remove("in"); void t.offsetWidth; t.classList.add("in");
  clearTimeout(PS.msgT); PS.msgT = setTimeout(() => { t.hidden = true; }, 2600);
}
function psPulse(which) {
  const el = which === "mk" ? PS.mk : PS.ad;
  if (!el || psCalm()) return;
  clearTimeout(PS.pulseT); el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
  PS.pulseT = setTimeout(() => el.classList.remove("pulse"), 900);
}
function psTap(c) {
  Sfx.init();
  const id = PS.id;
  if (c.kind === "fin" && c.k === "s") {
    if (psUsable().length < 2) { psNo(c, psUsable().length ? "Shuffle needs two Potatalities." : "Buy a Potatality to shuffle."); return; }
    if (koPick(id) !== "s") { Sfx.uiFlip(); koSetPick(id, "s"); }
    return;
  }
  const st = c.kind === "fin" ? psFinState(c) : psSkinState(c);
  if (st === "soon") return;
  if (c.kind === "fin" && st === "own") { if (koPick(id) !== c.k) { Sfx.uiFlip(); if (!koSetPick(id, c.k)) psNo(c, "That one isn't yours yet."); } return; }
  if (c.kind === "sk" && (st === "own" || st === "worn")) {
    if (st === "own") { Sfx.uiFlip(); koSkins(); P.pal[id] = c.pal; saveProfile(); koRefresh(); }   // koSkins: the owned Pommes skins join P.owned, then WEAR; koRefresh: the Rack and the Locker follow
    return;
  }
  psBuyTap(c, c.kind === "fin" ? psPageItem(c.k) : psSkinItem(c.n));
}
function psBuyTap(c, item) {
  if (KO.busy) return;
  const bal = koBal();
  if (!ACCT.code) { psDisarm(); psNo(c, "Pommes live on your account: make a sync code."); psPulse("mk"); return; }
  if (!koMine()) { psDisarm(); psNo(c, "Can't reach your Pommes: try again."); koAsk(true); return; }
  if (bal < KO_PRICE) { psDisarm(); psNo(c, `${fmtChips(KO_PRICE - bal)} more Pommes`); psPulse("ad"); return; }
  if (PS.arm !== item) { psArm(item); return; }
  psDisarm();
  PS.wait = item;
  if (koBuy(item)) { psStyle(); return; }   // asked: "…" until the server answers (pm-ok, pm-no: psKoRender)
  PS.wait = "";
  psNo(c, KO.why === "short" ? `${fmtChips(KO_PRICE - koBal())} more Pommes` : "That didn't go through: try again.");
  psStyle();
}
// WATCH: the page on a dummy, then back here on this fighter
function psWatch(n) {
  Sfx.init();
  const id = PS.id;
  if (n && !koHas(id, n)) return;
  if (!koDemoOk(id, n)) { Sfx.uiNo(); psSay("Watch works from the menu."); return; }
  const back = () => pshopOpen(id);
  psLeave();
  try { koDemo(id, n, back); } catch (e) {   // a page that fails to start must not leave the game on an empty match screen: back to the sheet
    try { koDemoEnd(); } catch (e2) { /* nothing left to tidy */ }
    if (typeof console !== "undefined") console.warn("WATCH failed", e);
  }
}

/* ----- the ad tile ----- */
function psPrimeAd(retry) {
  if (!PS.on || !adsOn() || !ACCT.code || !KO.ads || koAdLeft() <= 0) return;
  const s = adsState("pommes");
  if (s === "wait" || s === "ready" || s === "busy" || (s === "none" && !retry)) return;
  adsPrime("pommes", () => { if (PS.on) psStyle(); });   // never primes again from here: a replaced prime answers false too
  psStyle();
}
function psAdTap() {
  Sfx.init();
  const st = psAdState();
  if (st === "ready") {
    Sfx.ui(); PS.claim = true;
    adsShow("pommes", () => { koAdClaim(); }, () => { if (PS.on) { psStyle(); psPrimeAd(); } });
    psStyle();
  } else if (st === "none" || st === "idle") { Sfx.ui(); psPrimeAd(true); }
  else if (st === "soon") { Sfx.uiNo(); psSay(PS_SOON_AD); }
  else if (st === "gone") { Sfx.uiNo(); psSay("That's all the ads for today: back tomorrow."); }
  else if (st === "wait") { Sfx.uiNo(); psSay(`The next ad is in ${psAdWait()} s.`); }
}

/* ----- what the server said (kopages.js calls koListen's functions after every answer) ----- */
const PS_WHY = { acct: "Signed out for a moment: try again.", own: "You own it already.", ads: "No ads right now.", max: "That's all the ads for today: back tomorrow.", fail: "That didn't go through: try again." };
function psBurst(c) {
  if (!c || !c.art || psCalm()) return;
  const box = psMk("span", "ps-burst");
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, d = 34 + (i % 3) * 14, f = psMk("i", "ps-fry");
    f.style.setProperty("--dx", `${Math.round(Math.cos(a) * d)}px`); f.style.setProperty("--dy", `${Math.round(Math.sin(a) * d * 0.8 - 8)}px`); f.style.setProperty("--r", `${(i * 67) % 120 - 50}deg`);
    box.appendChild(f);
  }
  c.art.appendChild(box);
  setTimeout(() => box.remove(), 800);
}
function psKoRender() {
  if (!PS.on) return;
  if (PS.wait && koItem(PS.wait)) {   // the server paid: the card is yours (a Potatality is the pick, a skin is worn: kopages.js)
    const w = PS.wait, c = [...PS.fin, ...PS.sk].find((x) => (x.kind === "fin" ? (x.k === 1 || x.k === 2) && psPageItem(x.k) === w : psSkinItem(x.n) === w));
    PS.wait = ""; Sfx.uiCoin(); psBurst(c);
  } else if (PS.wait && KO.why) PS.wait = "";
  if (KO.why !== PS.why) {
    PS.why = KO.why;
    if (KO.why === "short") psSay(`${fmtChips(Math.max(0, KO_PRICE - koBal()))} more Pommes`);
    else if (PS_WHY[KO.why]) { Sfx.uiNo(); psSay(PS_WHY[KO.why]); }
  }
  if (KO.adN !== PS.adN) { PS.adN = KO.adN; if (PS.claim) { PS.claim = false; Sfx.uiCoin(); } }
  if (adsState("pommes") === "off") psPrimeAd();   // the server's answer made an ad possible (or the last one was used)
  psStyle();
}

window.__blPshop = { open: pshopOpen, close: pshopClose, focus: pshopFocus, st: PS, get fighter() { return PS.id; }, has: (id, n) => koHas(id, n), skin: (id, n) => koSkinIdx(id, n) };
