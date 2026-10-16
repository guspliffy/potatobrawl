/* ===================== accounts: profile pill, Account sheet, sync code =====================
   The pill (top right of the start page) shows who you are; tapping it opens the Account sheet with your numbers and the sync
   section. The code format, the clean-up of a profile and the merge live in sync.js (pure, tested in node). Nothing here ever
   blocks the menu on the network: calls have a short timeout and a failure shows one quiet line. */
/*SYNC*/
const ACCT_KEY = "potatobrawl.acct.v1";
// Saved on this device (ACCT_KEY): the code, the server's revision we last synced, the copy the server had then (base),
// when we last synced (t), when this device last changed its progress (lt), and a pending reset (force).
const ACCT = { code: "", rev: 0, base: null, t: 0, lt: 0, force: false, avail: null, pingFailed: false, hash: "", lastC: "", op: "" };
// What the sheet is showing right now (not saved).
const acUI = { tab: "p", pick: "", view: "main", pend: null, code: "", showCode: false, fresh: false, msg: "", cls: "", err: "", busy: false, manual: "", resetArmed: false, unlinkArmed: false };
const acctOk = !!window.__blStandalone && /^https?:$/.test(location.protocol);   // a copy served by our own server can ask it for accounts
let acctBusy = false, acctAgain = false, acctApplying = false, acctTimer = 0, acctRetryMs = 0, acctPinging = false, acShowT = 0, acResetT = 0, acUnlinkT = 0;

(function acctLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(ACCT_KEY) || "null");
    const code = s ? SYNC.normCode(s.code) : "";
    if (code && Number.isSafeInteger(s.rev) && s.rev >= 1 && s.base && typeof s.base === "object") {
      ACCT.code = code; ACCT.rev = s.rev; ACCT.base = SYNC.sanitize(s.base, FIGHTERS);
      ACCT.t = +s.t || 0; ACCT.lt = +s.lt || 0; ACCT.force = !!s.force;
    }
  } catch (e) { /* storage unavailable: linking lasts until the page closes */ }
  // a link like https://potatobrawl.cloud/#sync=CODE
  const m = /^#sync=(.{1,80})$/.exec(location.hash || "");
  if (m) { let v = m[1]; try { v = decodeURIComponent(v); } catch (e) { /* use as is */ } ACCT.hash = SYNC.normCode(v) || "bad"; }
})();
function acctStore() {
  try {
    if (!ACCT.code) localStorage.removeItem(ACCT_KEY);
    else localStorage.setItem(ACCT_KEY, JSON.stringify({ code: ACCT.code, rev: ACCT.rev, base: ACCT.base, t: ACCT.t, lt: ACCT.lt, force: ACCT.force }));
  } catch (e) { /* ignore */ }
}
function acctStripHash() { if (/^#sync=/.test(location.hash || "")) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* sandboxed */ } } }

/* ----- name ----- */
function acctDefaultName() {
  let n = "";
  try { n = SYNC.cleanName(localStorage.getItem("potatobrawl.name") || localStorage.getItem("blastline.name")); } catch (e) { /* none */ }
  return n || "Potato " + (10 + Math.floor(Math.random() * 90));
}
function acctName() { if (!P.name) P.name = acctDefaultName(); return P.name; }
function acctSetName(v) {
  const n = SYNC.cleanName(v) || acctDefaultName();
  if (n === P.name) return;
  P.name = n;
  if (window.__blSetName) NET.myName = window.__blSetName(n);   // the name friends see online follows
  saveProfile(); renderPill(); renderAccount();
}
function acctOnlineName(n) { const v = SYNC.cleanName(n); if (v && v !== P.name) { P.name = v; saveProfile(); renderPill(); } }   // the name field on the online screen

/* ----- avatar and titles ----- */
// The picture is a fighter plus one of the skins the player owns (P.avatar = "fighter:skin"); "" = the fighter played last.
function acAvatar() {
  const m = /^([a-z0-9_-]+):(\d+)$/.exec(P.avatar || "");
  if (m && FIG[m[1]] && (P.owned[m[1]] || []).includes(+m[2]) && FIG[m[1]].palettes[+m[2]]) return { f: m[1], p: +m[2], own: true };
  return { f: P.last, p: P.pal[P.last] || 0, own: false };
}
function acSetAvatar(node, id, pal) {   // pal (optional): the ring takes the skin's colour
  const src = PORTRAITS[id] || "";
  if (node._src !== src) { node._src = src; node.style.backgroundImage = src ? `url("${src}")` : ""; node.dataset.f = id; }
  const c = FIG[id] && FIG[id].palettes[pal] ? rgba(col(FIG[id].palettes[pal]), 0.95) : "";
  if (node._ab !== c) { node._ab = c; if (c) node.style.setProperty("--ab", c); else node.style.removeProperty("--ab"); }
}
function acSetMe(node) { const a = acAvatar(); acSetAvatar(node, a.f, a.p); }
const acFstats = () => (P.fstats && typeof P.fstats === "object" ? P.fstats : {});
const acPlayed = (e) => (e ? (e.w | 0) + (e.l | 0) + (e.d | 0) : 0);
// Titles, earnable from the start (ten, Jack of Spuds, and a Lv 5 and a Lv 10 title per fighter from ui/mastery.js). `how` is shown while one is locked. Best first (what "automatic" picks).
const ACT = [
  { id: "flawless", name: () => "Flawless", ok: () => (P.flawless | 0) > 0, how: "Win a cup without losing a life." },
  { id: "devil", name: () => "Devil Masher", ok: () => (roadGet().b & 7) > 0, how: "Beat Old Scratch past the last stop of the Road." },
  { id: "dome", name: () => "Dome Cracker", ok: () => ((roadGet().b2 | 0) & 7) > 0, how: "Beat Zorp past the last stop of The Kitchen." },
  { id: "kraken", name: () => "Kraken Fryer", ok: () => ((roadGet().b3 | 0) & 7) > 0, how: "Beat Kraken Spud at the end of the pier in The Deep." },
  { id: "duo", name: () => "Double Trouble", ok: () => (P.duo | 0) > 0, how: "Beat a boss on Hard or Nightmare with a friend online (Play friends, Vs boss)." },
  { id: "dynamic", name: () => "Dynamic Duo", ok: () => (P.duoW | 0) >= DUO_TITLE, how: `Win ${DUO_TITLE} Team Brawl 2v2 matches (Practice).` },
  ...mxActs(10),   // the Lv 10 title of each fighter (ui/mastery.js)
  { id: "cup", name: () => "Cup winner", ok: () => (P.cups | 0) > 0, how: "Win a cup." },
  mxJack,          // Jack of Spuds: Lv 5 with every fighter
  { id: "combo", name: () => "Combo Potato", ok: () => routesDone().length >= ROUTE_TOTAL, how: `Clear all ${ROUTE_TOTAL} combo routes in the Combo trial (How to play).` },
  { id: "collector", name: () => "Collector", ok: () => FIGHTERS.some((f) => (P.owned[f.id] || []).filter((i) => i < chipN(f)).length >= chipN(f)), how: "Own every chip skin of one fighter." },
  { id: "centurion", name: () => "Centurion", ok: () => (P.wins | 0) >= 100, how: "Win 100 ranked matches." },
  ...mxActs(5),    // the Lv 5 title of each fighter
  { id: "wanderer", name: () => "Wanderer", ok: () => Object.values(acFstats()).filter((e) => acPlayed(e) > 0).length >= 7, how: "Play ranked matches with seven different fighters." },
  { id: "tier", name: () => tierInfo(Math.max(P.peak | 0, P.rating | 0)).t.name, ok: () => (P.matches | 0) > 0, how: "Play a ranked match. It shows the best tier you reached." },
];
const ACT_SHOWN = ["tier", "centurion", "cup", "flawless", "devil", "dome", "kraken", "duo", "dynamic", "collector", "wanderer", "combo", "jack"];   // the order of the list (fighter titles follow once earned)
const acShown = () => [...ACT_SHOWN, ...ACT.filter((t) => t.fighter && t.ok()).map((t) => t.id)];
function acTitle() {   // the one that shows: the chosen one if earned, else the best earned (of several fighter titles of one rank, the fighter with the most XP), else none
  const pick = ACT.find((t) => t.id === P.title && t.ok());
  let t = pick || ACT.find((t) => t.ok());
  if (!pick && t && t.grp) t = ACT.filter((x) => x.grp === t.grp && x.ok()).reduce((a, x) => (x.xp() > a.xp() ? x : a));
  return t ? { id: t.id, name: t.name(), auto: !pick } : null;
}

/* ----- the profile plate (top right of the start page) ----- */

function acRing(ringBox, arc, ti) {   // the Account sheet's tier ring
  ringBox.style.setProperty("--tc", ti.t.col);
  arc.style.strokeDashoffset = String(94.25 * (1 - ti.p));
}
// #mRank is one button: the plate (picture with the rank emblem on its corner, name, tier + rating, the chosen title as a sticker)
// and the coins beside it (chips; the Daily Potato streak while there is one; cups once one is won). Styles: game/css/20-menu.css.
function renderPill() {
  const ti = tierInfo(P.rating), name = acctName(), cups = P.cups | 0, me = $("mRank");
  acSetMe($("mAvatar"));
  $("mName").textContent = name;
  me.querySelector(".plate").style.setProperty("--tc", ti.t.col);
  $("mTier").textContent = ti.t.name;
  $("mRating").textContent = P.rating;
  // the title sticker; the automatic tier title is left out while it only repeats the tier shown beside it
  const tt = acTitle(), mt = $("mTitle");
  mt.textContent = tt ? tt.name : ""; mt.hidden = !tt || (tt.auto && tt.id === "tier" && tt.name === ti.t.name);
  const bd = $("mBadge"); if (bd._i !== ti.i) { bd._i = ti.i; paintBadge(bd, ti.i); }
  $("mTokens").textContent = P.tokens;
  const cb = $("mCups"); cb.hidden = !(cups > 0); cb.textContent = cups;
  const ds = dailyStreakNow(), sb = $("mStreak"); sb.hidden = !(ds > 0); sb.textContent = ds;   // Daily Potato streak (ui/daily.js)
  me.setAttribute("aria-label", `Account. ${name}${tt ? `, ${tt.name}` : ""}, ${ti.t.name} ${P.rating}, ${P.tokens} chips${cups > 0 ? `, ${cups} ${cups === 1 ? "cup" : "cups"}` : ""}${ds > 0 ? `, ${ds}-day Daily Potato streak` : ""}`);
  menuFit();   // ui/screens.js: tighter coins or no name when the bar is full
}

/* ----- the sheet: your numbers ----- */
function acMk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function acBtn(label, cls, fn) {
  const b = acMk("button", cls, label);
  if (/\bbtn\b/.test(cls)) { b.textContent = ""; b.appendChild(acMk("span", "", label)); }
  b.addEventListener("click", (e) => { Sfx.init(); Sfx.cue(b); fn(e, b); });
  return b;
}
function acAgo(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
function acSkinCount(p) { return FIGHTERS.reduce((a, f) => a + (p.owned && p.owned[f.id] ? p.owned[f.id].length : 1), 0); }
const acSkinTotal = () => FIGHTERS.reduce((a, f) => a + f.palettes.length, 0);
function acSum(p) {   // one line about a profile, for the "replace it?" question
  const ti = tierInfo(p.rating);
  return `${ti.t.name} ${p.rating} · ${p.tokens} chips · ${acSkinCount(p)} skins`;
}
function renderAccount() {
  if (screens.account.hidden) return;
  for (const b of document.querySelectorAll(".ac-tabs .chip")) { const on = b.dataset.t === acUI.tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
  $("acPanP").hidden = acUI.tab !== "p"; $("acPanS").hidden = acUI.tab !== "s"; $("acPanL").hidden = acUI.tab !== "l";
  if (acUI.tab === "s") { renderStats(); return; }
  if (acUI.tab === "l") { renderLocker(); return; }
  const ti = tierInfo(P.rating), name = acctName();
  acSetMe($("acAvatar"));
  const tt = acTitle(); $("acTitleLine").textContent = tt ? tt.name : "";
  renderPick();
  const inp = $("acName"); if (document.activeElement !== inp) inp.value = name;
  $("acPlays").textContent = FIG[P.last] ? `Plays ${FIG[P.last].name}` : "";
  $("acPicBtn").setAttribute("aria-expanded", String(acUI.pick === "av")); $("acTitBtn").setAttribute("aria-expanded", String(acUI.pick === "ti"));
  $("acPicBtn").classList.toggle("on", acUI.pick === "av"); $("acTitBtn").classList.toggle("on", acUI.pick === "ti");
  paintBadge($("acBadge"), ti.i);
  acRing($("acRank").querySelector(".ring"), $("acRing"), ti);
  $("acRank").style.setProperty("--tc", ti.t.col);
  $("acTier").textContent = ti.t.name;
  $("acRating").textContent = `${P.rating} rating · best ${P.peak}${ti.next ? ` · ${ti.need} to ${ti.next.name}` : ""}`;
  $("acW").textContent = P.wins; $("acL").textContent = P.losses;
  $("acChips").innerHTML = `<span class="tokglyph"></span>${P.tokens}`;
  $("acSkins").innerHTML = `${acSkinCount(P)}<small> / ${acSkinTotal()}</small>`;
  const more = [];
  const fw = P.friendW | 0, fl = P.friendL | 0, cups = P.cups | 0;
  if (fw + fl > 0) more.push(`Friend matches: ${fw} won, ${fl} lost`);
  if (cups > 0) more.push(`Cups won: ${cups}${(P.flawless | 0) > 0 ? ` (${P.flawless} flawless)` : ""}`);
  if ((P.duoW | 0) + (P.duoC | 0) > 0) more.push(`2v2: ${P.duoW | 0} won, ${P.duoC | 0} ${(P.duoC | 0) === 1 ? "Catch" : "Catches"}`);
  $("acMore").textContent = more.join(" · "); $("acMore").hidden = !more.length;
  const form = $("acForm"); form.innerHTML = "";
  const hist = (P.history || []).slice(0, 10);
  if (hist.length) {
    form.appendChild(acMk("span", "ac-line", "Recent ranked"));
    for (const h of hist) { const i = acMk("i", h.r === 1 ? "w" : h.r === 0 ? "l" : "", h.r === 1 ? "W" : h.r === 0 ? "L" : "D"); i.title = `${h.d > 0 ? "+" : ""}${h.d}`; form.appendChild(i); }
  }
  form.hidden = !hist.length;
  $("acReset").textContent = acUI.resetArmed ? (ACCT.code ? "Tap again to erase it everywhere" : "Tap again to erase rating, chips and skins") : "Reset progress";
  renderSync();
}

/* ----- Profile: picture and title pickers ----- */
function renderPick() {
  const box = $("acPick"); box.innerHTML = ""; box.hidden = !acUI.pick;
  if (acUI.pick === "av") {
    const cur = acAvatar();
    const row = acMk("div", "ac-row");
    row.appendChild(acBtn("Fighter I played last", "chip" + (cur.own ? "" : " on"), () => { P.avatar = ""; saveProfile(); renderPill(); renderAccount(); }));
    box.appendChild(row);
    const all = acMk("div", "ac-pk-av");
    for (const f of FIGHTERS) {
      const g = acMk("span", "ac-pk-grp");
      for (const i of P.owned[f.id] || [0]) {
        if (!f.palettes[i]) continue;
        const b = acMk("button", "ac-pk" + (cur.own && cur.f === f.id && cur.p === i ? " on" : ""));
        b.setAttribute("aria-label", `${f.name}, ${f.palettes[i].name}`); b.setAttribute("aria-pressed", String(cur.own && cur.f === f.id && cur.p === i)); b.title = `${f.name}, ${f.palettes[i].name}`;
        const a = acMk("span", "av"); acSetAvatar(a, f.id, i); b.appendChild(a);
        b.addEventListener("click", () => { Sfx.init(); Sfx.ui(); P.avatar = f.id + ":" + i; saveProfile(); renderPill(); renderAccount(); });
        g.appendChild(b);
      }
      all.appendChild(g);
    }
    box.appendChild(all);
  } else if (acUI.pick === "ti") {
    const cur = acTitle();
    const list = acMk("div", "ac-tl");
    const auto = acMk("button", "ac-t" + (!P.title || (cur && cur.auto) ? " on" : ""));
    auto.appendChild(acMk("b", "", "Automatic")); auto.appendChild(acMk("small", "", "Shows the best title you have earned."));
    auto.addEventListener("click", () => { Sfx.init(); Sfx.ui(); P.title = ""; saveProfile(); renderPill(); renderAccount(); });
    list.appendChild(auto);
    for (const id of acShown()) {
      const t = ACT.find((x) => x.id === id), ok = t.ok();
      const b = acMk("button", "ac-t" + (ok ? "" : " lock") + (ok && cur && !cur.auto && cur.id === id ? " on" : ""));
      b.appendChild(acMk("b", "", t.name())); b.appendChild(acMk("small", "", ok ? (t.note ? "Earned: " + t.note() + "." : "Earned.") : t.how));
      if (ok) b.addEventListener("click", () => { Sfx.init(); Sfx.ui(); P.title = id; saveProfile(); renderPill(); renderAccount(); });
      else { b.setAttribute("aria-disabled", "true"); }
      list.appendChild(b);
    }
    box.appendChild(list);
  }
}
tap("acPicBtn", () => { acUI.pick = acUI.pick === "av" ? "" : "av"; renderAccount(); });
tap("acTitBtn", () => { acUI.pick = acUI.pick === "ti" ? "" : "ti"; renderAccount(); });
tap("acAvBtn", () => { acUI.pick = acUI.pick === "av" ? "" : "av"; renderAccount(); });

/* ----- Stats tab ----- */
function acDate(t) { try { return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }
function acFav() {   // the fighter with the most counted matches (ties: the earlier in the roster)
  let best = null, n = 0;
  for (const f of FIGHTERS) { const m = acPlayed(acFstats()[f.id]); if (m > n) { n = m; best = f; } }
  return best ? { f: best, n } : null;
}
function renderStats() {
  const pan = $("acPanS"); pan.innerHTML = "";
  const st = acFstats(), fav = acFav();
  pan.appendChild(acMk("p", "ac-line", P.fsince ? `Per-fighter records count ranked matches since ${acDate(P.fsince)}. Friend and cup matches are not counted.` : "Per-fighter records start with your next ranked match. Friend and cup matches are not counted."));
  if (fav) {
    const d = acMk("div", "fs-fav"); const a = acMk("span", "av"); acSetAvatar(a, fav.f.id, P.pal[fav.f.id] || 0); d.appendChild(a);
    const w = acMk("div"); w.appendChild(acMk("span", "kicker", "Favourite fighter")); w.appendChild(acMk("b", "", fav.f.name)); w.appendChild(acMk("span", "ac-line", `${fav.n} ${fav.n === 1 ? "match" : "matches"}`));
    d.appendChild(w); pan.appendChild(d);
  }
  const t = acMk("table", "fs-tab"), hd = acMk("tr");
  for (const h of ["Fighter", "Wins", "Losses", "Win rate", "Mastery"]) hd.appendChild(acMk("th", "", h));
  t.appendChild(acMk("thead")).appendChild(hd);
  const tb = acMk("tbody");
  for (const f of FIGHTERS) {
    const e = st[f.id] || {}, w = e.w | 0, l = e.l | 0, d = e.d | 0, m = w + l + d;
    const tr = acMk("tr", fav && fav.f.id === f.id ? "fav" : ""), c0 = acMk("td"), fn = acMk("span", "fn"), a = acMk("span", "av");
    acSetAvatar(a, f.id, P.pal[f.id] || 0); fn.appendChild(a); fn.appendChild(acMk("span", "", f.name)); c0.appendChild(fn); tr.appendChild(c0);
    tr.appendChild(acMk("td", m ? "" : "z", m ? String(w) : "0")); tr.appendChild(acMk("td", m ? "" : "z", m ? String(l) : "0"));
    tr.appendChild(acMk("td", m ? "" : "z", m ? Math.round((100 * w) / m) + "%" : "\u2013"));
    { const mt = acMk("td", "mx-c"), lv = mxInfo(f.id).lv; mt.innerHTML = `${mxShieldHTML(lv)}<span>Lv ${lv}</span>`; tr.appendChild(mt); }   // ui/mastery.js
    tb.appendChild(tr);
  }
  t.appendChild(tb); pan.appendChild(t);
  const hist = (P.history || []).slice(0, SYNC.HIST);
  pan.appendChild(acMk("div", "kicker", `Last ${SYNC.HIST} ranked matches`));
  if (!hist.length) { pan.appendChild(acMk("p", "ac-line", "No ranked matches yet.")); return; }
  const ul = acMk("ul", "hx-list");
  for (const h of hist) {
    const me = FIG[h.me], op = FIG[h.op], li = acMk("li", "hx");
    li.appendChild(acMk("i", "r " + (h.r === 1 ? "w" : h.r === 0 ? "l" : ""), h.r === 1 ? "W" : h.r === 0 ? "L" : "D"));
    const a = acMk("span", "av"); acSetAvatar(a, h.me, 0); li.appendChild(a);
    const b2 = acMk("span", "av"); acSetAvatar(b2, h.op, 0); li.appendChild(b2);
    li.appendChild(acMk("span", "vs", `${me ? me.name : h.me} vs ${op ? op.name : h.op}${h.opr ? ` ${h.opr}` : ""}`));
    li.appendChild(acMk("b", h.d > 0 ? "up" : h.d < 0 ? "down" : "", (h.d > 0 ? "+" : "") + h.d));
    li.appendChild(acMk("small", "", h.t ? acAgo(h.t) : ""));
    ul.appendChild(li);
  }
  pan.appendChild(ul);
}

/* ----- Locker tab: every fighter with every skin; tap one you own to wear it ----- */
function renderLocker() {
  const pan = $("acPanL"); pan.innerHTML = "";
  masteryCollection(pan);   // ui/mastery.js: KO pages, Ultimate KOs, combo routes
  pan.appendChild(acMk("p", "ac-line", "Tap a skin you own to wear it. Locked skins are bought with chips on the fighter select screen; Road skins are won from the Road's bosses."));
  const grid = acMk("div", "lk");
  for (const f of FIGHTERS) {
    const own = P.owned[f.id] || [0], cur = P.pal[f.id] || 0, card = acMk("div", "lk-f");
    const h = acMk("div", "lk-h"), a = acMk("span", "av"); acSetAvatar(a, f.id, cur); h.appendChild(a);
    h.appendChild(acMk("span", "", f.name)); h.appendChild(acMk("small", "", `${f.palettes.filter((p, i) => own.includes(i)).length} / ${f.palettes.length}`));
    card.appendChild(h);
    const row = acMk("div", "lk-s");
    f.palettes.forEach((p, i) => {
      // a Road skin (p.road): won by beating that boss with this fighter, never bought
      const has = own.includes(i), b = acMk("button", "sw" + (cur === i && has ? " cur" : "") + (has ? "" : " lock") + (p.road ? " road" : ""));
      b.style.setProperty("--c", col(p));
      b.setAttribute("aria-label", `${f.name}, ${p.name}${has ? (cur === i ? ", worn" : "") : p.road ? `, locked, beat ${roadBossName(p.road)} on the Road` : `, locked, ${p.price} chips`}`);
      b.innerHTML = `<i>${i && !p.road ? `<em>${"\u2726".repeat(i)}</em>` : ""}</i>${has ? "" : p.road ? "<span>Road</span>" : `<span><span class="tokglyph"></span>${p.price}</span>`}`;
      if (has) b.appendChild(document.createTextNode(p.name)); else b.disabled = true;
      if (has) b.addEventListener("click", () => {
        Sfx.init(); Sfx.ui();
        if (equipSkin(f.id, i)) { if (typeof sel === "object" && sel.pending && sel.pending.id === f.id) sel.pending = null; renderPill(); if (mode === "menu") renderMenu(); renderAccount(); }
      });
      row.appendChild(b);
    });
    card.appendChild(row); grid.appendChild(card);
  }
  pan.appendChild(grid);
}
function acSetTab(t) { acUI.tab = t; renderAccount(); cntScreen(t === "s" ? "stats" : t === "l" ? "locker" : ""); if (t !== "p") { const s = document.querySelector("#scrAccount .sheet"); if (s) s.scrollTop = 0; } }
for (const b of document.querySelectorAll(".ac-tabs .chip")) {
  b.addEventListener("click", () => { Sfx.init(); Sfx.uiFlip(); acSetTab(b.dataset.t); });
  b.addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll(".ac-tabs .chip")], i = tabs.indexOf(b), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    e.stopPropagation(); if (!d) return; e.preventDefault();
    const n = tabs[(i + d + tabs.length) % tabs.length]; acSetTab(n.dataset.t); n.focus();
  });
}

/* ----- the sheet: the sync section ----- */
function acMsg(text, cls) { acUI.msg = text || ""; acUI.cls = cls || ""; const m = document.getElementById("acMsg"); if (m) { m.textContent = acUI.msg; m.className = "ac-msg" + (acUI.cls ? " " + acUI.cls : ""); } }
function acStatusText() {
  if (ACCT.op === "saving") return "Saving...";
  if (acUI.err) return acUI.err;
  return ACCT.t ? `Saved ${acAgo(ACCT.t)}` : "Not saved yet";
}
function renderStatus() { const s = document.getElementById("acStat"); if (s && !screens.account.hidden) s.textContent = acStatusText(); }
function acctLink() { return location.origin + location.pathname.replace(/index\.html$/, "") + "#sync=" + ACCT.code; }
function acCopy(text, btn, idle) {
  const done = (ok) => { if (!ok) { acUI.manual = text; renderSync(); return; } btn.textContent = "Copied"; setTimeout(() => { if (btn.isConnected) btn.textContent = idle; }, 1800); };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
}
function acSyncView() {
  const box = $("acSync"); box.innerHTML = "";
  const head = (t) => box.appendChild(acMk("div", "kicker", t));
  const msg = (alt) => { const m = acMk("p", "ac-msg" + (acUI.cls ? " " + acUI.cls : ""), acUI.msg || alt || ""); m.id = "acMsg"; m.setAttribute("aria-live", "polite"); box.appendChild(m); };
  if (ACCT.code) {   // ----- linked
    head("Saved to an account");
    const code = acMk("div", "ac-code");
    const flip = () => {   // tap the code or the button: show it for a while, tap again to hide it
      acUI.showCode = !acUI.showCode; clearTimeout(acShowT);
      if (acUI.showCode) acShowT = setTimeout(() => { acUI.showCode = false; acUI.fresh = false; renderSync(); }, 30000);
      renderSync();
    };
    const cs = acMk("span", "", acUI.showCode ? SYNC.fmtCode(ACCT.code) : "\u2022\u2022\u2022\u2022-\u2022\u2022\u2022\u2022-\u2022\u2022\u2022\u2022-\u2022\u2022\u2022\u2022");
    if (!acUI.showCode) cs.addEventListener("click", () => { Sfx.init(); Sfx.ui(); flip(); });
    code.appendChild(cs);
    code.appendChild(acBtn(acUI.showCode ? "Hide" : "Show", "chip", flip));
    box.appendChild(code);
    box.appendChild(acMk("p", "ac-note" + (acUI.fresh ? " keep" : ""), acUI.fresh ? "Write this code down and keep it private. It is the only way to get your progress back." : "This code gets your progress onto another device. Keep it private."));
    const st = acMk("p", "ac-msg"); const sv = acMk("span", "", acStatusText()); sv.id = "acStat"; st.appendChild(sv);
    st.appendChild(document.createTextNode(" · "));
    st.appendChild(acBtn("Sync now", "link", () => { acctSync(true); }));
    box.appendChild(st);
    const row = acMk("div", "ac-row");
    row.appendChild(acBtn("Copy code", "chip", (e, b) => acCopy(SYNC.fmtCode(ACCT.code), b, "Copy code")));
    row.appendChild(acBtn("Copy link", "chip", (e, b) => acCopy(acctLink(), b, "Copy link")));
    box.appendChild(row);
    if (acUI.manual) { const t = acMk("div", "on-link", acUI.manual); box.appendChild(t); }
    box.appendChild(acBtn(acUI.unlinkArmed ? "Tap again to unlink" : "Unlink this device", "link", () => {
      if (!acUI.unlinkArmed) { acUI.unlinkArmed = true; clearTimeout(acUnlinkT); acUnlinkT = setTimeout(() => { acUI.unlinkArmed = false; renderSync(); }, 6000); renderSync(); return; }
      acUI.unlinkArmed = false; acctUnlink();
    }));
    msg();
    return;
  }
  head("Save your progress");
  if (!acctOk || ACCT.avail === false) {   // ----- no accounts here (local file, test page, or the server has them off)
    box.appendChild(acMk("p", "ac-note keep", "Saving to an account isn't available yet."));
    return;
  }
  if (ACCT.avail === null && !ACCT.pingFailed) {   // ----- asking the server whether it has accounts
    box.appendChild(acMk("p", "ac-note keep", "Checking..."));
    return;
  }
  if (acUI.view === "replace" && acUI.pend) {   // ----- linking would replace what this device has
    const pd = acUI.pend;
    box.appendChild(acMk("p", "", "This device already has progress. Linking replaces it with the account's."));
    const a = acMk("p", "ac-line"); a.appendChild(acMk("b", "", "This device: ")); a.appendChild(document.createTextNode(acSum(P))); box.appendChild(a);
    const b = acMk("p", "ac-line"); b.appendChild(acMk("b", "", "Account: ")); b.appendChild(document.createTextNode(acSum(pd.S))); box.appendChild(b);
    const row = acMk("div", "ac-row");
    row.appendChild(acBtn("Use the account's", "chip on", () => { acUI.view = "main"; acctLinkNow(pd); }));
    row.appendChild(acBtn("Cancel", "chip", () => { acUI.view = "main"; acUI.pend = null; acMsg(""); renderSync(); acctStripHash(); }));
    box.appendChild(row);
    msg();
    return;
  }
  if (acUI.view === "enter") {   // ----- typing a code
    box.appendChild(acMk("p", "", "Type the code from your other device, or paste its link."));
    const inp = acMk("input", "ac-in"); inp.id = "acCode"; inp.placeholder = "XXXX-XXXX-XXXX-XXXX"; inp.maxLength = 300;
    inp.autocomplete = "off"; inp.spellcheck = false; inp.setAttribute("autocapitalize", "characters"); inp.setAttribute("aria-label", "Sync code");
    inp.value = acUI.code;
    inp.addEventListener("input", () => { inp.value = acUI.code = SYNC.typing(inp.value); if (acUI.cls === "bad") acMsg(""); });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") go.click(); });
    inp.addEventListener("keyup", (e) => e.stopPropagation());
    box.appendChild(inp);
    const row = acMk("div", "ac-row");
    const go = acBtn("Link this device", "chip on", () => acctTryLink(inp.value));
    go.disabled = acUI.busy;
    row.appendChild(go);
    row.appendChild(acBtn("Cancel", "chip", () => { acUI.view = "main"; acUI.code = ""; acMsg(""); renderSync(); }));
    box.appendChild(row);
    msg();
    return;
  }
  // ----- not linked
  box.appendChild(acMk("p", "ac-note keep", "Get a code to keep your rating, chips and skins safe, and to play on another device."));
  const make = acBtn("Save my progress", "btn primary", () => acctCreate());
  make.disabled = acUI.busy; box.appendChild(make);
  const row = acMk("div", "ac-row");
  row.appendChild(acBtn("I have a code", "link", () => { acUI.view = "enter"; acMsg(""); renderSync(); const i = document.getElementById("acCode"); if (i) i.focus(); }));
  if (ACCT.pingFailed) row.appendChild(acBtn("Try again", "link", () => acctPing(true)));
  box.appendChild(row);
  msg(ACCT.pingFailed ? "Couldn't reach the server. Try again later." : "");
}
function renderSync() { if (!screens.account.hidden) acSyncView(); }

/* ----- talking to the server ----- */
async function acctCall(path, body, ms) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctl) ctl.abort(); }, ms || 7000);
  try {
    const post = body !== undefined;
    const r = await fetch("/api/acct/" + path, {
      method: post ? "POST" : "GET", headers: post ? { "content-type": "application/json" } : {}, body: post ? JSON.stringify(body) : undefined,
      cache: "no-store", referrerPolicy: "no-referrer", signal: ctl ? ctl.signal : undefined,
    });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    return { s: r.status, j };
  } catch (e) { return { s: 0, j: null }; } finally { clearTimeout(timer); }
}
async function acctPing(again) {
  if (!acctOk) { ACCT.avail = false; return; }
  if (ACCT.code || acctPinging) return;
  acctPinging = true;
  const r = await acctCall("ping", undefined, 4000);
  acctPinging = false;
  if (r.s === 200) { ACCT.avail = true; ACCT.pingFailed = false; }
  else if (r.s === 0) { ACCT.avail = null; ACCT.pingFailed = true; }
  else { ACCT.avail = false; ACCT.pingFailed = false; }
  renderSync();
}
function acctFail(r, what) {   // the words for a call that did not work
  if (r.s === 400) return ["That code doesn't look right.", "bad"];
  if (r.s === 404 && r.j && r.j.error === "unknown") return ["No account has that code.", "bad"];
  if (r.s === 404) { ACCT.avail = false; return ["Saving to an account isn't available yet.", ""]; }
  if (r.s === 429) return ["Too many tries. Please wait a minute.", ""];
  if (r.s === 503) return ["The server is full right now.", ""];
  return [what || "Couldn't reach the server. Try again later.", ""];
}

/* ----- linking ----- */
function acctApplyProf(S) {   // the account's copy (or a merge) becomes this device's progress
  SYNC.applyTo(P, S);
  if (P.name && window.__blSetName) NET.myName = window.__blSetName(P.name);
  if (mode === "menu") sel.fighter = P.last;
  saveProfile();
  if (mode === "menu") renderMenu();
  renderAccount();
}
function acctLinkNow(d) {
  ACCT.code = d.code; ACCT.rev = d.rev; ACCT.base = d.S; ACCT.t = Date.now(); ACCT.lt = 0; ACCT.force = false; ACCT.op = "";
  acUI.err = ""; acUI.pend = null; acUI.view = "main"; acUI.code = ""; acUI.showCode = false; acUI.fresh = false; acUI.manual = "";
  acctApplying = true;
  try { acctApplyProf(d.S); } finally { acctApplying = false; }
  ACCT.lastC = SYNC.canon(acctSnap());
  acctStore(); acctStripHash();
  acMsg("Linked. Your progress is now on this device.", "ok");
  renderMenu(); renderSync();
  if (!SYNC.same(acctSnap(), ACCT.base)) acctSoon(300);   // e.g. the account had no name yet
}
async function acctTryLink(raw) {
  const code = SYNC.normCode(raw);
  if (!code) { acMsg("That code doesn't look right.", "bad"); return; }
  if (acUI.busy) return;
  acUI.busy = true; acMsg("Looking...", ""); renderSync();
  const r = await acctCall("load", { code });
  acUI.busy = false;
  if (r.s === 200 && r.j && r.j.prof && Number.isSafeInteger(r.j.rev)) {
    ACCT.avail = true;
    const S = SYNC.sanitize(r.j.prof, FIGHTERS);
    const d = { code, S, rev: r.j.rev };
    if (SYNC.hasProgress(P) && !SYNC.same(S, acctSnap())) { acMsg(""); acUI.view = "replace"; acUI.pend = d; renderSync(); return; }
    acctLinkNow(d);
    return;
  }
  const [t, c] = acctFail(r);
  acMsg(t, c); renderSync();
}
async function acctCreate() {
  if (acUI.busy) return;
  acUI.busy = true; acMsg("Saving...", ""); renderSync();
  const prof = acctSnap();
  const r = await acctCall("new", { prof });
  acUI.busy = false;
  const code = r.s === 200 && r.j ? SYNC.normCode(r.j.code) : "";
  if (code && Number.isSafeInteger(r.j.rev)) {
    ACCT.avail = true;
    ACCT.code = code; ACCT.rev = r.j.rev; ACCT.base = prof; ACCT.t = Date.now(); ACCT.lt = 0; ACCT.force = false; ACCT.lastC = SYNC.canon(prof);
    acctStore(); cnt("acct");   // cnt: ui/counter.js
    acUI.fresh = true; acUI.showCode = true; acUI.manual = ""; acMsg("");
    clearTimeout(acShowT); acShowT = setTimeout(() => { acUI.showCode = false; acUI.fresh = false; renderSync(); }, 60000);
    renderSync();
    return;
  }
  const [t, c] = acctFail(r, "Couldn't save. Try again later.");
  acMsg(t, c); renderSync();
}
function acctUnlink() {
  clearTimeout(acctTimer); clearTimeout(acShowT); acctRetryMs = 0; acctAgain = false;
  ACCT.code = ""; ACCT.rev = 0; ACCT.base = null; ACCT.t = 0; ACCT.lt = 0; ACCT.force = false; ACCT.op = "";
  acUI.err = ""; acUI.showCode = false; acUI.fresh = false; acUI.manual = ""; acUI.view = "main";
  acctStore(); acMsg("This device is no longer linked. Its progress stays here.", "");
  renderAccount(); acctPing();
}

/* ----- keeping in step ----- */
function acctSnap() { return SYNC.snapshot(P, FIGHTERS); }
function acctSoon(ms) { clearTimeout(acctTimer); acctTimer = setTimeout(acctSync, ms); }
function acctDirty() {   // saveProfile() calls this after every change
  if (!ACCT.code || acctApplying) return;
  const c = SYNC.canon(acctSnap());
  if (c !== ACCT.lastC) { ACCT.lastC = c; ACCT.lt = Date.now(); acctStore(); }
  if (ACCT.force || c !== SYNC.canon(ACCT.base)) acctSoon(1200);
}
// The server has a newer copy: merge it with what this device changed since the last sync.
function acctTake(S, rev, t) {
  const local = acctSnap();
  const merged = SYNC.same(local, ACCT.base) ? S : SYNC.mergeProf(local, ACCT.base, S, ACCT.lt > (+t || 0));
  acctApplying = true;
  try { acctApplyProf(merged); } finally { acctApplying = false; }
  ACCT.base = S; ACCT.rev = rev; ACCT.t = Date.now(); ACCT.lastC = SYNC.canon(acctSnap());
  acctStore();
}
// Save if this device has changes, otherwise look for the server's. Never while a match is on.
async function acctSync(now) {
  if (!ACCT.code || !acctOk) return;
  if (acctBusy) { acctAgain = true; return; }
  if (mode === "match") { acctSoon(4000); return; }
  clearTimeout(acctTimer);
  acctBusy = true; acUI.err = "";
  let retry = 0;
  try {
    for (let i = 0; i < 6 && ACCT.code; i++) {
      const local = acctSnap();
      const forced = ACCT.force, dirty = forced || !SYNC.same(local, ACCT.base);
      ACCT.op = dirty ? "saving" : ""; renderStatus();
      const r = dirty ? await acctCall("save", { code: ACCT.code, rev: ACCT.rev, prof: local }) : await acctCall("load", { code: ACCT.code });
      if (!ACCT.code) break;                           // unlinked while we waited
      if (mode === "match") { retry = 4000; break; }   // a match started while we waited: change nothing now
      if (r.s === 200 && r.j && dirty && Number.isSafeInteger(r.j.rev)) {
        ACCT.rev = r.j.rev; ACCT.base = local; ACCT.t = Date.now(); if (forced) ACCT.force = false; acctStore(); acctRetryMs = 0; ACCT.avail = true;
      } else if (r.s === 200 && r.j && !dirty && r.j.prof && Number.isSafeInteger(r.j.rev)) {
        acctRetryMs = 0; ACCT.avail = true;
        if (r.j.rev !== ACCT.rev) acctTake(SYNC.sanitize(r.j.prof, FIGHTERS), r.j.rev, r.j.t);
        else { ACCT.t = Date.now(); acctStore(); }
      } else if (r.s === 409 && dirty && r.j && r.j.prof && Number.isSafeInteger(r.j.rev)) {
        if (forced) { ACCT.rev = r.j.rev; acctStore(); }                                      // a reset: this device's copy wins
        else acctTake(SYNC.sanitize(r.j.prof, FIGHTERS), r.j.rev, r.j.t);
      } else {   // one quiet line, and another try later
        if (r.s === 404 && r.j && r.j.error === "unknown") { acUI.err = "This account isn't on the server any more."; }
        else if (r.s === 0) { acUI.err = "Couldn't reach the server. Will try again."; retry = acctRetryMs = Math.min(300000, (acctRetryMs || 15000) * 2); }
        else if (r.s === 404) { ACCT.avail = false; acUI.err = "Saving to an account isn't available right now."; retry = 300000; }
        else if (r.s === 429) { acUI.err = "Too many requests. Will try again soon."; retry = 90000; }
        else { acUI.err = "Couldn't save. Will try again."; retry = 60000; }
        break;
      }
      if (!(ACCT.force || !SYNC.same(acctSnap(), ACCT.base))) break;   // nothing left to send
    }
  } catch (e) { acUI.err = "Couldn't save. Will try again."; retry = 60000; }
  ACCT.op = ""; acctBusy = false;
  renderStatus(); renderSync();
  if (acctAgain) { acctAgain = false; acctSoon(300); } else if (retry) acctSoon(retry);
}

/* ----- the sheet: open, close, reset ----- */
function openAccount() {
  acUI.tab = "p"; acUI.pick = "";
  acUI.resetArmed = false; acUI.unlinkArmed = false; acUI.view = "main"; acUI.pend = null; acMsg("");
  modal("account", true); renderAccount();
  if (ACCT.code) { if (Date.now() - ACCT.t > 10000) acctSync(); } else acctPing();
}
function acctDoReset() {
  const old = P, name = P.name;
  P = defProfile(); P.tut = true; if (name) P.name = name;
  for (const k of ["sound", "screen", "fs", "a2hs", "rules"]) if (k in old) P[k] = old[k];   // settings belong to the device, not to the progress
  if (ACCT.code) { ACCT.force = true; acctStore(); }
  saveProfile(); sel.fighter = P.last;
  renderMenu(); renderAccount();
}
tap("mRank", openAccount);
tap("acClose", () => {
  modal("account", false); clearTimeout(acShowT);
  if (acUI.view === "replace") acctStripHash();   // closing the question is a "no"
  acUI.view = "main"; acUI.pend = null; acUI.code = ""; acUI.showCode = false; acUI.fresh = false; acUI.manual = ""; acUI.resetArmed = false; acUI.unlinkArmed = false;
  renderMenu();
});
tap("acReset", () => {
  if (!acUI.resetArmed) { acUI.resetArmed = true; clearTimeout(acResetT); acResetT = setTimeout(() => { acUI.resetArmed = false; renderAccount(); }, 6000); renderAccount(); return; }
  acUI.resetArmed = false; acctDoReset();
});
{
  const inp = $("acName");
  const commit = () => { acctSetName(inp.value); inp.value = P.name; };
  inp.addEventListener("change", commit);
  inp.addEventListener("blur", commit);
  inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") inp.blur(); });
  inp.addEventListener("keyup", (e) => e.stopPropagation());
}
screens.account = $("scrAccount");
setInterval(renderStatus, 15000);
document.addEventListener("visibilitychange", () => {
  if (!ACCT.code) return;
  if (document.hidden) { if (ACCT.force || !SYNC.same(acctSnap(), ACCT.base)) acctSync(); }   // the page may be gone soon: send what we have
  else if (Date.now() - ACCT.t > 4000) acctSync();                                              // back again: look for the other device's changes
});
window.addEventListener("online", () => { if (ACCT.code) acctSync(); });
acctName();
if (ACCT.code) ACCT.lastC = SYNC.canon(acctSnap());
window.__blAcct = { get P() { return P; }, get st() { return ACCT; }, get ui() { return acUI; }, sync: acctSync, save: () => saveProfile(), ok: acctOk };
// once the page is up: catch up with the account, and open a #sync= link
setTimeout(() => {
  if (ACCT.code) acctSync();
  if (!ACCT.hash) return;
  const code = ACCT.hash;
  if (!acctOk) { acctStripHash(); return; }
  if (ACCT.code) {   // already linked
    openAccount(); acMsg(ACCT.code === code ? "This device is already linked to that account." : "This device is linked to another account. Unlink it first to use a different code.", ""); renderSync(); acctStripHash(); return;
  }
  openAccount();
  acctTryLink(code).then(() => { if (acUI.view !== "replace") acctStripHash(); });
}, 0);
