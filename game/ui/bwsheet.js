/* ===================== Boss Week's sheet, start tile, Boards tab and Monday card (ui/bossweek.js holds the data) =====================
   UI only, never in the simulation. Fable's design: /mnt/project-files/step6/fable-step6.md (start page A, sheet B / F, Boards tab D, week-end card).
   - The start tile #bBw (bwTile, called by renderMenu and bwRefresh): the boss in a disc ringed in his colour, "Kraken Spud · Hard · 3d 4h left",
     your best and place (or "No time yet · 23 have one" / "needs the server"); the tag is #6 (gold) when placed, NEW (ember) until this week's sheet is opened.
   - The sheet #scrBw (bwSheetOpen / bwSheetClose / bwSheetRender): the boss card, your best + your fighter (the picker, with the partner this week) + FIGHT,
     the top 3 and what Monday pays. Your fighter card opens the fighter select in mode "bw" (menus.js selBack / selGo come back here, as the Road's does).
     The board comes from bwBoard() (bossweek.js) each time the sheet opens. FIGHT is bwFight(): a counted try, or Practice without the server.
   - The Boards sheet's third tab "Boss Week" (ui/boards.js calls bwBdPrep, bwBdRow, bwBdKick, bwBdEmpty below).
   - Replays (ui/replay.js, ui/rpview.js): a ▶ at the end of a row (the top 10 and your row) plays that run, an "older version" tag stands in for it
     when the run is from another game version; WATCH ▶ on your best; LAST WEEK › in the Boards tab's kicker row (the finished week's board, bwsPast).
   - The Monday card #scrBwWk (bwWeekCard, called once by bwTick): last week's place and the chips it paid.
   The bosses have no portrait files: bwArt() draws each boss with his own drawing once and keeps it as a data URL (the Road's skull on his colour if that fails).
   Test hooks: window.__blBwMock (bossweek.js; this part also reads its `checking`) and window.__blBwSheet. Styles: css/97-bossweek.css. */
screens.bw = $("scrBw"); screens.bwwk = $("scrBwWk");
const BWS = { open: false, req: 0, board: undefined, resId: null, art: {} };   // board: undefined = on its way, null = none (no server, no answer), else bwBdPrep's
// where each boss's drawing sits around his feet (world units: left, right, top, bottom of the pixels), so each picture is framed on him
const BWS_BOX = { scratch: [-112, 72, -205, 7], zorp: [-82, 81, -123, 23], kraken: [-99, 100, -145, 1] };
const bwsChecking = () => { const M = window.__blBwMock; return M && M.checking !== undefined ? !!M.checking : bwChecking(); };
const bwsCol = (spec) => spec.palettes[0].ui || spec.palettes[0].body;

/* ----- the boss as a picture ----- */
function bwArt(id) {
  if (BWS.art[id] !== undefined) return BWS.art[id];
  let url = "";
  try {
    const spec = bwBossSpec(id), S = 280, B = BWS_BOX[id] || [-spec.stats.w, spec.stats.w, -spec.stats.h, 0];
    const f = BL.newGame({ players: [{ spec, pal: spec.palettes[0] }, { spec: FIGHTERS[0], pal: FIGHTERS[0].palettes[0] }], countdown: 1, seed: 1 }).fighters[0];
    f.x = 0; f.y = 0; f.facing = 1;
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"), sc = Math.min((S * 0.94) / (B[1] - B[0]), (S * 0.94) / (B[3] - B[2]));
    c.setTransform(sc, 0, 0, sc, S / 2 - ((B[0] + B[1]) / 2) * sc, S / 2 - ((B[2] + B[3]) / 2) * sc);
    drawFighter(c, f, 0);
    url = cv.toDataURL("image/png");
  } catch (e) { url = ""; }
  return (BWS.art[id] = url);
}
// a picture into an <img> (and the skull of the Road's boss picture shows only without one: .noart on the box)
function bwsImg(img, src, box) {
  if (img._s !== src) { img._s = src; if (src) img.src = src; else img.removeAttribute("src"); }
  if (box) box.classList.toggle("noart", !src);
}
const bwsPart = (t) => `<span class="bw-p">${cupEsc(t)}</span>`;
const bwsNb = (t) => t.replace(/ /g, " ");
const bwsHave = (n) => `${n} ${n === 1 ? "has" : "have"}`;

/* ----- the start tile ----- */
function bwTile() {
  const b = $("bBw"); if (!b) return;
  const s = bwSpec(), m = bwMine(), sp = bwBossSpec(s.boss), live = bwLive(), has = !!(m && m.t > 0), n = s.n;
  b.style.setProperty("--bc", bwsCol(sp));
  const d = $("mBwD"); d.className = `mm-bwd rd-bossph rd-${s.boss}`; bwsImg($("mBwArt"), bwArt(s.boss), d);
  $("mBw").innerHTML = [bwsPart(sp.name), `<span class="bw-p bw-lv">${cupEsc(BOSS_LV[s.lv])}</span>`, bwsPart(`${bwLeft(s.ends)} left`)].join(" · ");
  const place = has && m.pl > 0 ? `#${m.pl}${n > 0 ? ` of ${n}` : ""}` : "";
  const l2 = has ? [`Best ${bwClock(m.t, 2)}`].concat(place ? [place] : []) : !live ? ["needs the server"] : ["No time yet"].concat(n > 0 ? [`${bwsHave(n)} one`] : []);
  $("mBwR").innerHTML = l2.map((t, i) => `<span class="bw-p${i < l2.length - 1 ? " bw-pb" : ""}${i ? " bw-pn" : ""}">${cupEsc(bwsNb(t))}</span>`).join(" ");
  const tag = $("mBwTag"), fresh = bwNew();
  tag.hidden = !(fresh || place);
  if (!tag.hidden) { tag.textContent = fresh ? "New" : `#${m.pl}`; tag.className = `tag ${fresh ? "ember" : "gold"} mm-bwt`; }
  b.setAttribute("aria-label", `Boss Week: ${sp.name}, ${BOSS_LV[s.lv]}, ${bwLeft(s.ends)} left. ${l2.join(", ")}${fresh ? ". New" : ""}`);
}
setInterval(() => { if (mode === "menu") bwTile(); }, 30000);   // the time left

/* ----- the sheet ----- */
function bwSheetOpen() {
  BWS.open = true; BWS.board = undefined; BWS.resId = BW.res ? BW.res.id : null;
  bwSeen();   // the NEW tag goes, and the server is asked for your record
  bwTile();
  bwSheetRender();
  modal("bw", true);
  bwsLoad();
}
function bwSheetClose() {
  if (!BWS.open) return;
  BWS.open = false; BWS.req++;
  modal("bw", false);
  if (mode === "menu") bwTile();
}
// the fighter card: the fighter select in mode "bw"; its Back and Use <fighter> come back here (menus.js)
function bwSheetPick() { if (FIG[P.last]) sel.fighter = P.last; bwSheetClose(); openSelect("bw"); }
function bwSheetBack() { goMenu(); bwSheetOpen(); }
// FIGHT: the counted try, or Practice without the server (bwPractice plays the fighter of `sel`: the one shown here)
function bwsFight() {
  if (FIG[P.last]) sel.fighter = P.last;
  if (!bwLive()) { bwSheetClose(); if (!screens.boards.hidden) bdClose(); }   // a Practice fight starts at once; a counted try waits for its ticket (bwTicket closes both)
  bwFight();
}
function bwsLoad() {
  const req = ++BWS.req;
  bwBoard().then((d) => {
    if (req !== BWS.req || !BWS.open) return;
    BWS.board = bwBdPrep(d);
    bwsRows();
  });
}
function bwSheetRender() {
  if (!BWS.open) return;
  const s = bwSpec(), sp = bwBossSpec(s.boss), m = bwMine(), live = bwLive(), chk = bwsChecking(), has = !!(m && m.t > 0), name = sp.name, asking = !!BW.asking;
  if (BW.res && BW.res.id !== BWS.resId) { BWS.resId = BW.res.id; bwsLoad(); }   // a verdict came in: the board may have moved
  $("bwWeek").textContent = `Week ${s.no} · ends Mon 00:00 · `; $("bwLeft").textContent = bwLeft(s.ends);
  // the boss
  const bc = $("bwBoss"); bc.dataset.b = s.boss; bc.style.setProperty("--bc", bwsCol(sp));
  bwsImg($("bwArt"), bwArt(s.boss), bc.querySelector(".bw-pic"));
  $("bwBn").textContent = name; $("bwBn").classList.toggle("long", name.length > 7);
  $("bwBs").textContent = `${sp.role} · ${mapName(bossMap(sp))}`;
  $("bwSts").innerHTML = `<span class="bw-st hot">${cupEsc(BOSS_LV[s.lv])}</span><span class="bw-st">Road HP</span><span class="bw-st">${Math.floor(BW_CAP / 3600)}:00 cap</span>`;
  // your best
  const best = $("bwBest"), sub = $("bwSub"), tm = $("bwTime"), pend = BW.pend && BW.pend.fr > 0 ? BW.pend.fr : 0;
  sub.textContent = "";
  best.className = "card bw-best";
  if (!live) {   // no server: nothing counts, the button practises him
    best.classList.add("off");
    $("bwBk").innerHTML = '<i class="dot r"></i>Offline';
    tm.textContent = "Boss Week needs the server"; sub.textContent = "Practise him here. Only the server counts times.";
  } else {
    $("bwBk").textContent = "Your best";
    tm.textContent = has ? bwClock(m.t, 2) : chk && pend ? bwClock(pend, 2) : "--:--.--";
    best.classList.toggle("none", !has);
    const n = s.n, place = has && m.pl > 0 ? `#${m.pl}${n > 0 ? ` of ${n}` : ""}` : "", hl = has ? `${m.fl} ♥ lost` : "";
    if (chk) { sub.append(bdMk("i", "dot q"), "Checking…"); if (place) sub.append(` · ${place}`); }
    else if (has) {
      sub.textContent = [place, hl].filter(Boolean).join(" · ");
      if (m.r && m.v === PROTO) {   // your best run, to watch (ui/replay.js)
        const w = bdMk("button", "rpv-wl", "Watch \u25B6\uFE0E"); w.type = "button"; w.setAttribute("aria-label", "Watch your best run");
        w.addEventListener("click", () => { Sfx.init(); Sfx.ui(); rpWatchRun(m.r, "sheet", true); });
        sub.append(" · ", w);
      }
    }
    else sub.textContent = "Finish him once and you're on the board";
  }
  // your fighter (the picker) and the partner this week
  const me = FIG[P.last] || FIGHTERS[0], mi = palIdx(me.id), pf = FIG[s.pf] || FIGHTERS[1];
  dailyCard($("bwMe"), me.id, mi, mi ? me.palettes[mi].name : "You");
  $("bwMe").insertAdjacentHTML("beforeend", '<span class="rd-chg" aria-hidden="true">⇄</span>');
  $("bwMe").setAttribute("aria-label", `Change fighter. You play ${me.name}`);
  const pp = $("bwPf"); pp.style.setProperty("--fc", col(pf.palettes[0]));
  pp.innerHTML = `<span class="dly-ph">${PORTRAITS[pf.id] ? `<img src="${PORTRAITS[pf.id]}" alt="">` : ""}<i class="cpu">CPU</i></span><span class="dly-t"><b>${cupEsc(pf.name)}</b><small>partner<span class="bw-tw"> this week</span></small></span>`;
  // FIGHT
  const go = $("bwGo");
  $("bwGoT").textContent = asking ? "Starting…" : `${live ? "Fight" : "Practice"} ${name}`;
  $("bwGoS").textContent = asking ? "" : live ? "unlimited tries" : "not counted";
  go.disabled = asking;
  $("bwNote").textContent = BW.note || "";
  bwsPay(m);
  bwsRows();
}
// what Monday pays: the gold sticker is your tier (the top one before you have a place)
function bwsPay(m) {
  const mine = m && m.pl > 0 ? BW_PRIZE.findIndex(([to]) => m.pl <= to) : 0;
  let from = 1;
  $("bwPay").innerHTML = BW_PRIZE.map(([to, c], k) => {
    const l = to === 1 ? "#1" : to < 10 ? `${from}–${to}` : to < 1e9 ? `Top ${to}` : "A time";
    from = to + 1;
    return `<span class="bw-st cg${k === mine ? " g" : ""}">${l} ${c}</span>`;
  }).join("");
}
// a row's run to watch: the top 10 and your row. ▶ when it is from this game version, the tag "older version" under the time when not (bwRunOf: ok / old / "")
const bwRunOf = (row, i, own) => (row.r && (i <= 10 || own) ? (row.v === PROTO ? "ok" : "old") : "");
function bwWatchEl(row, from, own) {
  const b = bdMk("button", "rpv-pl"); b.type = "button"; b.title = "Watch"; b.setAttribute("aria-label", `Watch ${row.nm}'s run`);
  b.addEventListener("click", (e) => { e.stopPropagation(); Sfx.init(); Sfx.ui(); rpWatchRun(row.r, from, own); });
  return b;
}
const bwOldEl = () => bdMk("small", "rpv-old", "older version");
// the top 3 (a verdict or the board arriving redraws only this)
function bwsRows() {
  if (!BWS.open) return;
  const box = $("bwRows"), b = BWS.board;
  box.textContent = "";
  box.classList.remove("ghost");
  if (!b) {   // on its way, no server, no answer: ghost rows
    box.classList.add("ghost");
    for (let k = 0; k < 3; k++) { const r = bdMk("div", "bw-r sk"); r.append(bdMk("i", "bw-gp"), bdMk("i", "bw-ge"), bdMk("i", "bw-gn"), bdMk("i", "bw-gt")); box.appendChild(r); }
    if (b === null) box.appendChild(bdMk("p", "bw-cap", bwLive() ? "The board didn't load." : "Offline"));
    return;
  }
  if (!b.top.length) { box.append(bwBdEmptyEl(false)); return; }
  const me = b.me && b.me.i > 0 ? b.me : null;
  b.top.slice(0, 3).forEach((row, k) => box.appendChild(bwsRow(row, k + 1, { me: !!me && me.i === k + 1 })));
  if (me && me.i > 3) {
    if (me.i > 4) box.appendChild(bdMk("div", "bw-gap", "···"));
    box.appendChild(bwsRow(me.row, me.i, { me: true, you: true }));
  }
}
function bwsRow(row, i, o) {
  const el = bdMk("div", "bw-r" + (i === 1 ? " first" : "") + (o.me ? " me" : "") + (o.you ? " you" : ""));
  const p = bdMk("span", "bw-pl");
  if (i <= 3) p.appendChild(bdMk("i", "bw-d " + "gsb"[i - 1], String(i))); else p.textContent = String(i);
  const nm = bdMk("span", "bw-nm");
  if (o.me) nm.appendChild(bdMk("em", "", "You"));
  nm.appendChild(bdMk("b", "", row.nm));
  if (row.cr > 0) nm.appendChild(bwCrown(row.cr));
  const tm = bdMk("b", "bw-tm", bwClock(row.t, 2)), run = bwRunOf(row, i, !!(o.me || o.you));
  if (run === "old") { tm.classList.add("old"); tm.appendChild(bwOldEl()); }
  el.append(p, bwPortrait(row.f), nm, tm);
  if (run === "ok") el.appendChild(bwWatchEl(row, "sheet", !!(o.me || o.you)));
  el.title = `${row.nm}${row.f ? `, ${FIG[row.f].name}` : ""}, ${row.fl} hearts lost`;
  return el;
}
// a fighter's portrait in a small rounded square (the board's rows); a gap where the fighter is not known
function bwPortrait(f) {
  const e = bdMk("span", "bw-pp");
  if (FIG[f]) { e.style.setProperty("--fc", col(FIG[f].palettes[0])); if (PORTRAITS[f]) { const i = document.createElement("img"); i.alt = ""; i.src = PORTRAITS[f]; e.appendChild(i); } }
  return e;
}
const bwCrown = (n) => { const e = bdMk("span", "bw-crown", String(n)); e.title = `${n} Boss Week ${n === 1 ? "win" : "wins"}`; return e; };

/* ----- the Boards sheet's tab (ui/boards.js): a board made safe to draw, the rows, the kicker, the empty state ----- */
function bwBdPrep(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.top)) return null;
  const row = (x) => (x && typeof x === "object" && Number.isFinite(x.t) ? { id: bdStr(x.id, 12), nm: bdStr(x.nm, 24).trim() || "Potato", f: FIG[x.f] ? x.f : "", t: bdInt(x.t), fl: bdInt(x.fl), cr: bdInt(x.cr), pl: bdStr(x.pl, 24), r: /^[0-9a-f]{12}$/.test(x.r) ? x.r : "", v: bdInt(x.v) } : null);   // r, v: the run to watch and its game version
  const top = d.top.slice(0, 100).map(row).filter((r) => r && r.t > 0);
  let me = null;
  if (d.me && typeof d.me === "object") { const i = bdInt(d.me.i), r = row(d.me.row); me = i > 0 && r ? { i, row: r } : { i: 0 }; }
  return { k: "w", wk: bdInt(d.wk), no: bdInt(d.no), boss: BOSS_IDS.has(d.boss) ? d.boss : bwSpec().boss, n: Math.max(bdInt(d.n), top.length), at: bdInt(d.at), fin: !!d.fin, top, me };
}
// one row: place, portrait, name (+ crowns), fighter, hearts lost, time; o.me / o.sticky / o.of as bdRowEl's
function bwBdRow(row, i, o) {
  const el = bdMk("div", "bd-r bw-bdr" + (i === 1 ? " first" : "") + (o.me ? " me" : "") + (o.sticky ? " you" : ""));
  const p = bdMk("span", "bd-p");
  if (i >= 1 && i <= 3) p.appendChild(bdMk("i", "bd-d " + "gsb"[i - 1], String(i))); else p.textContent = String(i);
  const n = bdMk("span", "bd-n"), t = bdMk("span", "bd-t");
  if (o.me || o.sticky) t.appendChild(bdMk("em", "bd-yt", "You"));
  const nm = bdMk("b", "bd-nm", row.nm); plateSet(nm, row.pl); nm.title = row.nm;
  t.appendChild(nm);
  if (row.cr > 0) t.appendChild(bwCrown(row.cr));
  n.appendChild(t);
  const fig = row.f ? FIG[row.f].name : "", hl = `${row.fl} ♥ lost`;
  const f1 = [fig, o.of].filter(Boolean).join(" · "), f2 = [fig, o.of ? "" : hl, o.of].filter(Boolean).join(" · ");   // wide: the hearts have their column; upright: they join this line
  const f = bdMk("small", "bd-f");
  if (f1) f.appendChild(bdMk("span", "bd-f1", f1));
  f.appendChild(bdMk("span", "bd-f2", f2));
  n.appendChild(f);
  const tm = bdMk("b", "bd-v", bwClock(row.t, 2)), run = bwRunOf(row, i, !!(o.me || o.sticky));
  if (run === "old") { tm.classList.add("old"); tm.appendChild(bwOldEl()); }
  el.append(p, bwPortrait(row.f), n, bdMk("small", "bd-w", hl), tm);
  if (run === "ok") el.appendChild(bwWatchEl(row, "board", !!(o.me || o.sticky)));
  el.setAttribute("aria-label", `${i}. ${row.nm}${fig ? `, ${fig}` : ""}, ${bwClock(row.t, 2)}, ${row.fl} ${row.fl === 1 ? "heart" : "hearts"} lost`);
  return el;
}
// "KRAKEN SPUD · HARD · 23 HAVE A TIME · ENDS 3D 4H" (st: the sheet's state)
function bwBdKick(st, d) {
  const s = bwSpec(), name = bwBossSpec(d && d.boss ? d.boss : s.boss).name, past = !!(d && d.fin), lw = $("bdLast");
  lw.hidden = !((st === "ok" || st === "empty") && d && d.wk > 0);   // LAST WEEK › / ‹ THIS WEEK once the board is in
  lw.textContent = past ? "\u2039 This week" : "Last week \u203A";
  screens.boards.classList.toggle("bw-past", past);
  if (past) return `Last week · ${name} · Final`;
  return [name, BOSS_LV[s.lv]].concat(st === "load" ? ["Loading"] : st === "off" ? [] : [`${d.n} ${d.n === 1 ? "has a time" : "have a time"}`, `Ends ${bwLeft(s.ends)}`]).join(" · ");
}
// "Nobody has a time yet. Finish Zorp once and you're #1." with FIGHT ZORP (the sheet's top 3 gets the short one)
function bwBdEmptyEl(full) {
  const boss = bwBossSpec(bwSpec().boss).name, e = bdMk("div", "bw-empty");
  e.append(bdMk("b", "bd-big", "Nobody has a time yet."), bdMk("p", "bd-sub", full ? `Finish ${boss} once and you're #1.` : "First to finish him is #1."));
  return e;
}
function bwBdEmpty(box) {
  if (BD.data && BD.data.fin) { box.append(bdPod(), bdMk("b", "bd-big", "No times last week.")); return; }   // a finished week nobody finished
  const boss = bwBossSpec(bwSpec().boss).name;
  box.append(bdPod(), bdMk("b", "bd-big", "Nobody has a time yet."), bdMk("p", "bd-sub", `Finish ${boss} once and you're #1.`));
  const b = bdMk("button", "btn primary bd-fight"); b.type = "button"; b.appendChild(bdMk("span", "", `Fight ${boss}`));
  bdTap(b, () => { bdClose(); bwFight(); });
  box.appendChild(b);
}

/* ----- Last week ›: the finished week's board in the same tab (bossweek.js bwBoard(wk); a week with no board shows "No times last week.") ----- */
function bwsPast(on) {
  if (!on) { bdLoad(); return; }
  const req = ++BD.req, wk = bwSpec().wk - 1;
  BD.st = "load"; BD.data = null;
  bdDraw();
  bwBoard(wk).then((raw) => {
    if (req !== BD.req || screens.boards.hidden) return;
    const d = bwBdPrep(raw) || bwBdPrep({ top: [], wk, boss: bwLocal(wk).boss, n: 0 });
    d.fin = true;
    BD.data = d; BD.got = Date.now();
    BD.st = d.top.length ? "ok" : "empty";
    bdDraw();
  });
}

/* ----- the Monday card: last week's place and the chips it paid (bwTick passes lr: { wk, no, boss, pl, of, c }) ----- */
function bwWeekCard(lr) {
  const sp = bwBossSpec(lr.boss), nx = bwBossSpec(bwSpec().boss), champ = lr.pl === 1, d = $("bwwD");
  d.className = `bw-wkd rd-bossph rd-${lr.boss}`; bwsImg($("bwwArt"), bwArt(lr.boss), d);
  d.style.setProperty("--bc", bwsCol(sp));
  $("bwwK").textContent = `${sp.name}${lr.no ? ` · week ${lr.no}` : ""}`;
  $("bwwCrown").hidden = !champ;
  $("bwwH").hidden = !champ; $("bwwH").textContent = "Champion";
  $("bwwF").textContent = lr.pl > 0 ? `You finished #${lr.pl}${lr.of > 0 ? ` of ${lr.of}` : ""}` : "You were on the board";
  $("bwwM").hidden = !(lr.c > 0); $("bwwC").textContent = `+${lr.c} chips`;
  $("bwwGoT").textContent = `This week: ${nx.name} ›`;
  $("bwwBody").classList.toggle("champ", champ);
  modal("bwwk", true);
}
function bwWeekClose() { modal("bwwk", false); }

/* ----- wiring ----- */
tap("bBw", bwSheetOpen);
tap("bwClose", bwSheetClose);
tap("bwMe", bwSheetPick);
tap("bwGo", bwsFight);
tap("bwFull", () => bdOpen("w"));
tap("bwwClose", bwWeekClose);
tap("bdLast", () => bwsPast(!(BD.data && BD.data.fin)));
tap("bwwOk", bwWeekClose);
tap("bwwGo", () => { bwWeekClose(); bwSheetOpen(); });
screens.bw.addEventListener("click", (e) => { if (e.target === screens.bw) bwSheetClose(); });
screens.bwwk.addEventListener("click", (e) => { if (e.target === screens.bwwk) bwWeekClose(); });
window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape") return;
  if (!screens.bwwk.hidden) { e.preventDefault(); bwWeekClose(); } else if (BWS.open && screens.boards.hidden) { e.preventDefault(); bwSheetClose(); }
});
$("bHelp").addEventListener("click", () => modal("settings", false));   // How to play is Settings' first row: the sheet gives way to it
window.__blBwSheet = { open: bwSheetOpen, close: bwSheetClose, render: bwSheetRender, tile: bwTile, card: bwWeekCard, art: bwArt };   // tests
