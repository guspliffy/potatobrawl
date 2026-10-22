/* ===================== the Harvest: a gift for every day you come by (UI only; Fable's design, /mnt/project-files/pre-step6/fable-ideas.md) =====================
   Thirty gifts in a row on top of the Daily sheet (ui/daily.js, styles css/94-harvest.css), one claimed per day with one tap. It counts the days
   claimed, not a streak: a missed day costs only that day, the calendar waits (the Daily Potato keeps the game's one streak). A day is the phone's
   date (dailyKey), and a gift opens only when today is later than the last day claimed, so a day can't be claimed twice and a clock set back
   claims nothing. After day 30 the next claim starts round 2 at day 1: the nameplate and title days pay 100 chips instead, and day 30 gives the
   Harvest skin (palette "Harvest Gold", pal.road = "harvest", core.js) to another fighter; once all eight have it, a Glaze token instead.
   P.harvest = { n: days claimed this round, c: rounds finished, d: the last day claimed, sk: fighters given the skin }; free Another go tries
   (day 21) are P.ago, Glaze tokens P.gzt; all synced (sync.js). Chips land in P.tokens like the Daily Potato's.
   The ×2 button (watch an ad, ui/ads.js) waits with a SOON sticker while ads are off (ADS_CLIENT). With ads on, opening the sheet asks for an ad once; when
   one is ready the button plays it, and a watched ad claims today's gift doubled (the claim, then the same chips again) and marks the day on this device
   (adsMark). Never a gift without chips (a skin day), never twice a day, never when the claim failed. A skipped ad changes nothing and can be tried again. */
const HV = { pick: "", raf: 0, art: null, popT: 0, adNew: false };
const HV_N = 30;
// what day n (1-30) of round c (0 = the first) gives; `sk` = it gives the Harvest skin (to a fighter picked when claiming), `gz` = a Glaze token
function hvGift(n, c) {
  const later = c > 0;
  if (n === 7) return later ? { chips: 100 } : { chips: 60, plate: "sprout" };
  if (n === 14) return later ? { chips: 100 } : { chips: 100, title: true };
  if (n === 21) return { chips: 150, ago: 2 };
  if (n === 28) return { chips: 200 };
  if (n === HV_N) return hvSkinLeft().length ? { chips: 0, sk: true } : { chips: 0, gz: 1 };
  return { chips: n < 7 ? 15 : n < 14 ? 20 : n < 21 ? 25 : 30 };
}
const hvSkinIdx = (spec) => spec.palettes.findIndex((p) => p.road === "harvest");
const hvHasSkin = (id) => (P.owned[id] || []).includes(hvSkinIdx(FIG[id]));
const hvSkinLeft = () => FIGHTERS.filter((f) => !hvHasSkin(f.id)).map((f) => f.id);
function hvGet() { return SYNC.cleanHarvest(P.harvest) || { n: 0, c: 0, d: "", sk: [] }; }   // tidy (sync.js); an older profile has none
// today's gift is waiting: today is later than the last day claimed
const hvOpen = (h, key) => !h.d || key > h.d;
const hvWaiting = () => hvOpen(hvGet(), dailyKey());
// the round as the sheet shows it: a finished round turns over to the next once today's gift waits
function hvView(h, key) {
  const open = hvOpen(h, key), turn = open && h.n >= HV_N;
  return { open, n: turn ? 0 : h.n, c: turn ? h.c + 1 : h.c };
}
// the fighter played most (mastery XP), among those still without the skin: the day-30 tile's silhouette and the picker's first choice
function hvFav() {
  const left = hvSkinLeft(), xp = P.mxp && typeof P.mxp === "object" ? P.mxp : {};
  if (!left.length) return P.last;
  return left.reduce((a, id) => ((xp[id] | 0) > (xp[a] | 0) ? id : a), left.includes(P.last) ? P.last : left[0]);
}
const hvTitleOk = () => { const h = hvGet(); return h.c > 0 || h.n >= 14; };   // the title Couch Potato (acct.js ACT): day 14 reached once

/* ----- claiming ----- */
// claim today's gift; pick = the fighter for the Harvest skin on day 30. Returns what was given, or null (not open, or no fighter picked)
function hvClaim(pick) {
  const key = dailyKey(), h = hvGet(), v = hvView(h, key);
  if (!v.open) return null;
  const n = v.n + 1, g = hvGift(n, v.c), sk = h.sk.slice();
  if (g.sk && !(FIG[pick] && !hvHasSkin(pick))) return null;
  if (g.chips) P.tokens += g.chips;
  if (g.plate) P.plates = [...new Set([...(Array.isArray(P.plates) ? P.plates : []), g.plate])];
  if (g.ago) P.ago = (P.ago | 0) + g.ago;
  if (g.gz) P.gzt = (P.gzt | 0) + g.gz;
  if (g.sk) { P.owned[pick] = [...new Set([...(P.owned[pick] || [0]), hvSkinIdx(FIG[pick])])].sort((a, b) => a - b); if (!sk.includes(pick)) sk.push(pick); }
  P.harvest = { n, c: v.c, d: key, sk: sk.sort() };
  saveProfile();
  return Object.assign({ n, c: v.c, pick: g.sk ? pick : "" }, g);
}

/* ----- the track and today's gift on the Daily sheet ----- */
const hvEsc = (s) => cupEsc(String(s));
const hvChip = (n) => `<span class="tokglyph"></span>${n}`;
function hvTile(i, v, h, key) {   // day i (1-30)
  const g = hvGift(i, v.c), got = i <= v.n, now = v.open && i === v.n + 1, today = !v.open && i === v.n && h.d === key, big = i % 7 === 0;
  const el = document.createElement("div");
  el.className = `hv-d${got ? " got" : ""}${now ? " now" : ""}${big ? " big" : ""}${i === HV_N ? " last" : ""}`;
  el.setAttribute("role", "listitem");
  let body, say;
  if (i === HV_N) {   // the fighter who got the skin this round, or (still to come) the one played most as a silhouette
    const id = got ? h.sk[h.sk.length - 1] || "" : g.sk ? hvFav() : "";
    body = !id ? `<i class="hv-gzi" aria-hidden="true">✦</i>` : `<canvas class="hv-sil${got ? " on" : ""}" data-f="${id}" aria-hidden="true"></canvas>${got ? "" : "<b>?</b>"}`;
    say = !id ? "a Glaze token" : got ? `the Harvest skin for ${FIG[id] ? FIG[id].name : "a fighter"}` : "the Harvest skin for a fighter you choose";
  } else if (g.plate) { body = `<span class="hv-pl np-sprout" aria-hidden="true"></span>`; say = `${g.chips} chips and the Sprout nameplate`; }
  else if (g.title) { body = `<span class="hv-tt">Title</span>`; say = `${g.chips} chips and the title Couch Potato`; }
  else { body = `<span class="hv-amt">${big ? hvChip(g.chips) : g.chips}</span>${g.ago ? `<em class="hv-plus">+2 go</em>` : ""}`; say = `${g.chips} chips${g.ago ? " and 2 free Another go tries" : ""}`; }
  el.innerHTML = `<small>${now || today ? "Today" : i}</small>${body}`;
  el.setAttribute("aria-label", `Day ${i}: ${say}${got ? ", claimed" : now ? ", today's gift" : ""}`);
  return el;
}
function hvLegend(c) {
  const sk = hvSkinLeft().length ? `the Harvest skin for ${c > 0 ? "another fighter" : "a fighter you choose"}` : "a Glaze token";
  return c > 0 ? `<b>Day 7</b> and <b>14</b> 100 chips · <b>21</b> 150 chips + 2 Another go · <b>28</b> 200 chips · <b>30</b> ${sk}`
    : `<b>Day 7</b> Sprout nameplate · <b>14</b> title Couch Potato · <b>21</b> 150 chips + 2 Another go · <b>28</b> 200 chips · <b>30</b> ${sk}`;
}
// the gift's lines: chips, then what comes with them
function hvWhat(g) {
  const more = g.plate ? `<span class="hv-wl">+ the <span class="hv-wp np-sprout">Sprout</span> nameplate</span>` : g.title ? `<span class="hv-wl">+ the title <b>Couch Potato</b></span>`
    : g.ago ? `<span class="hv-wl">+ 2 free Daily <b>Another go</b> tries</span>` : g.gz ? `<span class="hv-wl">A <b>Glaze token</b>: glaze any skin for free in the Shop</span>` : "";
  return `${g.chips ? `<span class="hv-wc">${hvChip("+" + g.chips)} <em>chips</em></span>` : ""}${more}`;
}
// the Daily sheet was opened (ui/daily.js): draw it; the ×2 ad is asked for once per opening
function hvRender() { HV.adNew = true; hvPaint(); }
function hvPaint() {
  const key = dailyKey(), h = hvGet(), v = hvView(h, key), grid = $("hvGrid");
  cancelAnimationFrame(HV.raf); HV.raf = 0; HV.art = null;
  $("hvHead").innerHTML = `The Harvest${v.c > 0 ? ` ${v.c + 1}` : ""} · <b>day ${Math.max(1, v.open ? v.n + 1 : v.n)} of ${HV_N}</b>`;
  grid.innerHTML = "";
  for (let i = 1; i <= HV_N; i++) grid.appendChild(hvTile(i, v, h, key));
  $("hvLeg").innerHTML = hvLegend(v.c);
  const sil = grid.querySelector("canvas.hv-sil");
  if (sil) hvSil(sil, sil.dataset.f, sil.classList.contains("on"));
  const box = $("hvGift");
  if (!v.open) {   // claimed today (or the clock was set back): tomorrow's gift, and when it opens
    const back = h.d > key, nn = h.n >= HV_N ? 1 : h.n + 1, nc = h.n >= HV_N ? h.c + 1 : h.c, g = hvGift(nn, nc);
    box.className = "hv-gift done";
    const dc = adsOn() && !back && h.d === key && adsDay().hv ? hvGift(h.n, h.c).chips : 0;   // claimed doubled today: the button stays, "Doubled"
    box.innerHTML = `<div class="hv-dn"><b>Day ${h.n}</b><small>claimed</small><i class="hv-ok" aria-hidden="true">✓</i></div>
      ${dc ? `<button class="btn hv-ad" id="hvAd" data-chips="${dc}" disabled></button>` : ""}<p class="hv-k2">Next · day ${nn}</p><div class="hv-what">${g.sk ? `<span class="hv-wl">the Harvest skin for a fighter you choose</span>` : hvWhat(g)}</div>
      <p class="hv-note">${back ? `Your next gift opens the day after ${dailyLabel(h.d)}.` : `It opens in ${dailyNextIn()}. A missed day waits for you.`}</p>`;
    if (dc) hvAdSync();
    return;
  }
  const n = v.n + 1, g = hvGift(n, v.c);
  box.className = `hv-gift${g.sk ? " sk" : ""}`;
  if (g.sk) {   // day 30: pick the fighter, see him in Harvest Gold, claim
    if (!FIG[HV.pick] || hvHasSkin(HV.pick)) HV.pick = hvFav();
    const left = hvSkinLeft();
    box.innerHTML = `<div class="hv-dn"><b>Day ${n}</b><small>Harvest skin</small></div>
      <div class="hv-art"><canvas id="hvArt" aria-hidden="true"></canvas></div>
      <div class="hv-pick" role="radiogroup" aria-label="The fighter who gets the Harvest skin">${FIGHTERS.map((f) => `<button class="hv-pf${f.id === HV.pick ? " on" : ""}" data-f="${f.id}" role="radio" aria-checked="${f.id === HV.pick}" aria-label="${hvEsc(f.name)}${left.includes(f.id) ? "" : ", has it already"}"${left.includes(f.id) ? "" : " disabled"} style="background-image:url('${PORTRAITS[f.id] || ""}')"></button>`).join("")}</div>
      <button class="btn primary lg hv-claim" id="hvClaim"><span>Claim for ${hvEsc(FIG[HV.pick].name)}</span></button>`;
    for (const b of box.querySelectorAll(".hv-pf:not([disabled])")) b.addEventListener("click", () => { Sfx.init(); Sfx.uiFlip(); HV.pick = b.dataset.f; hvPaint(); });
    const spec = FIG[HV.pick], f = BL.newGame({ seed: 1, players: [{ spec, pal: spec.palettes[hvSkinIdx(spec)] }, { spec, pal: spec.palettes[0] }], countdown: 1 }).fighters[0];
    f.x = 0; f.y = 0; f.facing = -1;
    HV.art = { cv: $("hvArt"), f, fit: 0.86, bottom: 0.95 };
    const step = () => { HV.raf = 0; if (!HV.art || screens.daily.hidden) return; paintModel(HV.art, tick); HV.raf = requestAnimationFrame(step); };
    HV.raf = requestAnimationFrame(step);
  } else {
    box.innerHTML = `<div class="hv-dn"><b>Day ${n}</b><small>today's gift</small></div><div class="hv-what">${hvWhat(g)}</div>
      <button class="btn primary lg hv-claim" id="hvClaim"><span>Claim</span></button>
      ${g.chips ? `<button class="btn hv-ad" id="hvAd" data-chips="${g.chips}" disabled></button>
      <p class="hv-note">${adsOn() ? "Ads are never needed." : "Ads come later and are never needed."} Today's gift is yours as it is.</p>` : ""}`;
    if (g.chips) { $("hvAd").addEventListener("click", hvTapAd); hvAdSync(); hvAdAsk(); }
  }
  $("hvClaim").addEventListener("click", hvTapClaim);
}
/* ----- the ×2 button (ui/ads.js) ----- */
// the button as things stand: off = the SOON button; with ads: waiting, ready (tappable), no ad right now, showing, or Doubled (used today)
function hvAdSync() {
  const b = $("hvAd");
  if (!b) return;
  const c = +b.dataset.chips || 0, on = adsOn(), used = on && adsDay().hv === 1, st = on ? adsState("harvest") : "off", can = on && !used && st === "ready";
  const word = used ? "Doubled" : st === "none" ? "No ad right now" : st === "busy" ? "Watching…" : "×2 · watch an ad";
  b.disabled = !can; b.setAttribute("aria-disabled", String(!can));
  b.classList.toggle("on", can); b.classList.toggle("used", used);
  b.innerHTML = `<span>${word}</span><small>${c} → ${c * 2}</small>${on ? "" : `<i class="hv-soon" aria-hidden="true">Soon</i>`}`;
  b.setAttribute("aria-label", !on ? "Double it by watching an ad: coming soon" : used ? `Doubled today: ${c} chips twice` : st === "none" ? "No ad right now. Today's gift is yours as it is."
    : st === "busy" ? "Watching an ad" : `Double it by watching an ad: ${c} to ${c * 2} chips${can ? "" : ", getting an ad ready"}`);
  const k = $("hvClaim");
  if (k) k.disabled = st === "busy";   // not claimed from under an ad that is showing
}
// the sheet was just opened with today's gift waiting: ask for the ad (once per opening, not on every redraw)
function hvAdAsk() {
  if (!HV.adNew || !adsOn()) return;
  HV.adNew = false;
  const st = adsState("harvest");
  if (!adsDay().hv && (st === "off" || st === "none")) adsPrime("harvest", hvAdSync);
}
// a tap on ×2 with an ad ready: the ad plays; watched to the end, today's gift is claimed and the same chips come again
function hvTapAd() {
  Sfx.init();
  if (adsDay().hv || adsState("harvest") !== "ready") { hvAdSync(); return; }
  let got = null;
  const ok = adsShow("harvest", () => {
    const v = hvView(hvGet(), dailyKey());
    if (!v.open || !hvGift(v.n + 1, v.c).chips) return;   // claimed elsewhere meanwhile, or midnight brought a skin day: nothing is doubled
    const r = hvClaim(HV.pick);
    if (!r || !r.chips) return;
    P.tokens += r.chips; saveProfile();
    adsMark("harvest"); got = r;
  }, (watched) => {
    if (got) { hvAfterClaim(got); return; }
    if (screens.daily.hidden) return;
    if (watched) { hvPaint(); return; }   // watched, but the claim didn't go through: show what stands now
    adsPrime("harvest", hvAdSync); hvAdSync();   // skipped: nothing changed, ask for another one
  });
  if (!ok) adsPrime("harvest", hvAdSync);
  hvAdSync();
}
// the day-30 tile: the fighter drawn small, as a dark silhouette while the skin is still to come, in Harvest Gold once it is his
function hvSil(cv, id, lit) {
  const spec = FIG[id];
  if (!spec) return;
  const f = BL.newGame({ seed: 1, players: [{ spec, pal: spec.palettes[lit ? hvSkinIdx(spec) : 0] }, { spec, pal: spec.palettes[0] }], countdown: 1 }).fighters[0];
  f.x = 0; f.y = 0; f.facing = -1;
  paintModel({ cv, f, fit: 0.86, bottom: 0.97 }, 0);
  if (lit) return;
  const c = cv.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-atop"; c.fillStyle = "#0e1022"; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = "source-over";
}
function hvTapClaim() {
  Sfx.init();
  const r = hvClaim(HV.pick);
  if (!r) { hvPaint(); return; }   // midnight passed or a sync claimed it on another device: show what stands now
  hvAfterClaim(r);
}
// what follows a claim (Claim, or a watched ad): the coin tick, the pill and menu, the sheet as it stands, the tile pop
function hvAfterClaim(r) {
  Sfx.uiCoin(); renderPill(); if (mode === "menu") renderMenu();
  hvPaint(); dailyAgainLabel();   // day 21's free tries show on Another go at once
  const t = $("hvGrid").children[r.n - 1];
  if (t && !resCalm()) slReplay(t, "hv-pop");
  if (r.sk) { const k = $("hvGift").querySelector(".hv-dn small"); if (k) k.textContent = `Harvest Gold · ${FIG[r.pick].name}`; }
}
window.__blHarvest = { gift: hvGift, claim: hvClaim, get st() { return hvGet(); }, view: hvView, open: hvOpen };
