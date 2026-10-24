/* ===================== the replay viewer: controls strip, livetag, end card, title card, toast, WATCH on the results (ui/replay.js is the engine) =====================
   UI only, never in the simulation: it reads RP, G and match and calls the engine's controls (rpToggle, rpSeek, rpSpeedNext, rpRestart, rpToKo, rpClean, rpShare, rpClose,
   rpLandGo, rpLandClose). Fable's design: /mnt/project-files/step6/fable-step6.md (Viewer E / G, Share landing). Every hook below is called by replay.js (each optional there):
   - rpvOpen / rpvFrame / rpvEnd / rpvClose: the strip (#rpv) in the bottom 48 px, ▶/❚❚ · seek bar (☠ the break, ⚑ the final launch, a spinner while it re-simulates) · time · speed ·
     ⟲ · ⏭ KO · ◉ clean view · ⤴ share · ✕; upright the bar has its own row above the buttons. Under it the livetag in the HUD's left column ("REPLAY · TUBER TOM · #1 · 1:21.44").
     Both fade out after 3 s of playing with no pointer or key (a tap brings them back, and in clean view a tap leaves it); paused, seeking and ended they stay.
     The end card (rpvEnd) sits over the frozen last frame, the buttons by who is watching (your turn, your retry, a CPU match).
   - rpvTitle / rpvTitleClose: the share link's title card (RP.land: load, ok, old, gone, net, off), over the menu and every sheet.
   - rpvToast, rpvLoad: a short message and a "Loading the run…" pill, over everything.
   - rpvResults: WATCH ▶ on the results of a Boss Week try and a Ranked vs CPU match (#rWatch, in shell.html).
   Styles: css/97-replay.css. Test hook: window.__blRpv. */
const RPV = { ready: false, act: 0, drag: -1, c: {}, toastT: 0 };   // act: the last pointer or key (ms); drag: the tick the knob is held at (-1: not held); c: what is drawn now (the DOM is written only when a value changes)
const RPV_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
const RPV_IC = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6l11-6.8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>',
  again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.6 9.2A7.6 7.6 0 1 1 4.6 13.2" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/><path d="M4.4 4v5.6h5.6" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ko: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5v13l9-6.5z" fill="currentColor"/><path d="M18.5 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  clean: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.3" fill="none" stroke="currentColor" stroke-width="2.7"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4.2M7.6 8.4L12 4l4.4 4.4M5 12.5V19h14v-6.5" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  skull: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.4c-3.3 0-5.6 2.2-5.6 5.3 0 1.9.9 3.1 2 3.8v2.7h7.2v-2.7c1.1-.7 2-1.9 2-3.8C13.6 3.6 11.3 1.4 8 1.4z" fill="#eef0fa" stroke="#0e1022" stroke-width="1.3" stroke-linejoin="round"/><circle cx="5.7" cy="7" r="1.6" fill="#0e1022"/><circle cx="10.3" cy="7" r="1.6" fill="#0e1022"/><path d="M6.7 11.6v1.8M9.3 11.6v1.8" stroke="#0e1022" stroke-width="1.1"/></svg>',
  flag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.6v13" stroke="#eef0fa" stroke-width="1.8" stroke-linecap="round"/><path d="M4.8 2.4h8.2l-2.3 3.2L13 8.8H4.8z" fill="#e8453c" stroke="#0e1022" stroke-width="1.2" stroke-linejoin="round"/></svg>',
};
const rpvMk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const rpvTx = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; return e; };
const rpvBtn = (cls, label, html) => { const b = rpvMk("button", cls, html); b.type = "button"; if (label) b.setAttribute("aria-label", label); return b; };
// a tap: the sound, the action, no focus left on the button (Space would press it again, the engine's own Space plays and pauses)
function rpvTap(el, fn, sfx) {
  if (sfx) el.dataset.sfx = sfx;
  el.addEventListener("click", (e) => { Sfx.init(); Sfx.cue(el); rpvPoke(); fn(e); if (e.detail && el.blur) el.blur(); });
}
const rpvBoss = (id) => bwBossSpec(id).name;   // ui/bossweek.js
const rpvWeekBoss = () => bwBossSpec(bwSpec().boss).name;   // the boss FIGHT starts a try against: this week's
const rpvTime = (fr) => bwClock(fr, 2);
const rpvPlace = (M) => (M.place > 0 ? (M.n > 0 ? _t("#{b} of {n}", { b: M.place, n: M.n }) : `#${M.place}`) : "");
function rpvRange() { return RP.mk ? Math.max(1, RP.mk.end > 0 ? RP.mk.end : RP.mk.n) : 1; }   // ticks the bar spans: to the final launch (the engine's seek stops there)
function rpvPoke() { RPV.act = performance.now(); if (RPV.c.idle) { RPV.c.idle = false; app.classList.remove("rpidle"); } }

/* ----- the pieces, made once ----- */
function rpvMake() {
  if (RPV.ready) return;
  RPV.ready = true;
  // the strip
  const bar = RPV.bar = rpvMk("div", "rpv"); bar.id = "rpv"; bar.hidden = true; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", _t("Replay controls"));
  RPV.play = rpvBtn("round rpv-play", _t("Pause"), RPV_IC.pause);
  const seek = RPV.seek = rpvMk("div", "rpv-seek", '<div class="rpv-rail"><i class="rpv-tr"><i class="rpv-fill"></i></i><span class="rpv-mk brk" hidden></span><span class="rpv-mk ko" hidden></span><b class="rpv-knob"></b></div>');
  seek.setAttribute("role", "slider"); seek.setAttribute("aria-label", _t("Seek")); seek.setAttribute("aria-valuemin", "0"); seek.setAttribute("aria-valuemax", "100"); seek.setAttribute("aria-valuenow", "0");
  RPV.rail = seek.firstChild; RPV.fill = seek.querySelector(".rpv-fill"); RPV.knob = seek.querySelector(".rpv-knob");
  RPV.mBrk = seek.querySelector(".rpv-mk.brk"); RPV.mKo = seek.querySelector(".rpv-mk.ko");
  RPV.mBrk.innerHTML = RPV_IC.skull; RPV.mKo.innerHTML = RPV_IC.flag;
  RPV.time = rpvMk("span", "rpv-time", '<b class="rpv-now">0:00.0</b><span> / <span class="rpv-te">0:00.00</span></span>');
  RPV.now = RPV.time.querySelector(".rpv-now"); RPV.endT = RPV.time.querySelector(".rpv-te");
  RPV.sp = rpvBtn("rpv-sp", _t("Speed"), "1×");
  RPV.re = rpvBtn("round", _t("Watch from the start"), RPV_IC.again);
  RPV.ko = rpvBtn("round rpv-kob", _t("Jump to the knockout"), RPV_IC.ko + "<span>KO</span>");
  RPV.cl = rpvBtn("round", _t("Clean view"), RPV_IC.clean);
  RPV.sh = rpvBtn("round", _t("Share this run"), RPV_IC.share);
  RPV.x = rpvBtn("round rpv-x", _t("Close the replay"), RPV_X);
  bar.append(RPV.play, seek, RPV.time, rpvMk("i", "rpv-br"), RPV.sp, RPV.re, RPV.ko, RPV.cl, RPV.sh, RPV.x);
  rpvTap(RPV.play, () => rpToggle(), "flip");
  rpvTap(RPV.sp, () => { rpSpeedNext(); rpvFrame(); }, "flip");
  rpvTap(RPV.re, () => rpRestart(), "flip");
  rpvTap(RPV.ko, () => rpToKo(), "flip");
  rpvTap(RPV.cl, () => { rpClean(true); }, "flip");
  rpvTap(RPV.sh, () => rpShare(), "go");
  rpvTap(RPV.x, () => rpClose(), "back");
  // the bar: a tap or a drag; the run seeks to the tick under the pointer when it is let go (it plays again from the start to get there, so not while dragging)
  seek.addEventListener("pointerdown", (e) => {
    if (!RP.on || !RP.mk || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try { seek.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move events stay on the bar */ }
    RPV.drag = rpvAt(e); rpvPoke(); rpvFrame();
  });
  seek.addEventListener("pointermove", (e) => { if (RPV.drag >= 0) { RPV.drag = rpvAt(e); rpvFrame(); } });
  const up = (go) => (e) => {
    if (RPV.drag < 0) return;
    const to = go ? rpvAt(e) : -1;
    RPV.drag = -1; rpvPoke();
    if (go) { Sfx.init(); Sfx.uiFlip(); rpSeek(to); }
    rpvFrame();
  };
  seek.addEventListener("pointerup", up(true)); seek.addEventListener("pointercancel", up(false));
  // the livetag: in the HUD's left column, under your card (and its Ultimate bar)
  const tag = RPV.tag = rpvMk("span", "livetag rpv-tag"); tag.hidden = true;
  (document.querySelector(".hud-l") || app).appendChild(tag);
  // the end card
  const end = RPV.endEl = rpvMk("div", "rpv-end"); end.hidden = true;
  RPV.ec = rpvMk("div", "card rpv-ec"); RPV.ec.setAttribute("role", "dialog"); RPV.ec.setAttribute("aria-label", _t("Replay over"));
  end.appendChild(RPV.ec);
  // the title card of a share link
  const ti = RPV.title = rpvMk("section", "rpv-ti"); ti.hidden = true;
  // the toast and the loading pill
  const to = RPV.toast = rpvMk("div", "rpv-toast"); to.hidden = true; to.setAttribute("role", "status");
  const ld = RPV.load = rpvMk("div", "rpv-toast rpv-load", `<i aria-hidden="true"></i>${_t("Loading the run…")}`); ld.hidden = true; ld.setAttribute("role", "status");
  app.append(bar, end, ti, to, ld);
  // any tap, move or key brings the controls back; in clean view a tap or a key leaves it
  const wake = (e) => {
    if (!RP.on || mode !== "match") return;
    if (RP.clean && e.type !== "pointermove") rpClean(false);
    rpvPoke();
  };
  app.addEventListener("pointerdown", wake, true);
  app.addEventListener("pointermove", wake, true);
  window.addEventListener("keydown", wake, true);
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !RPV.title.hidden) { e.preventDefault(); rpLandClose(); } });
  window.addEventListener("resize", () => { if (RP.on) requestAnimationFrame(rpvTagPlace); });   // after view.js has laid the HUD out again
}
// the tick under the pointer on the bar (the app may be turned sideways: toApp, ui/view.js)
function rpvAt(e) {
  const r = RPV.rail.getBoundingClientRect(), a = toApp(r.left, r.top), b = toApp(r.right, r.bottom), p = toApp(e.clientX, e.clientY);
  const x0 = Math.min(a[0], b[0]), w = Math.max(1, Math.abs(b[0] - a[0]));
  return Math.round(clamp((p[0] - x0) / w, 0, 1) * rpvRange());
}
// the livetag hangs under your card (and its Ultimate bar) without widening the HUD's left column: placed from #pc0, whose offsets
// tutorial.js and others read against #hud (so the column itself stays unpositioned)
function rpvTagPlace() {
  const a = $("pc0"), s = RPV.tag.style, w = Math.max(120, RPV.tag.parentNode.offsetWidth - 6);
  s.setProperty("--rpT", a.offsetTop + a.offsetHeight + "px"); s.setProperty("--rpL", a.offsetLeft + 6 + "px"); s.setProperty("--rpW", w + "px");
}
// about where a tick is on the clock (the bar while it is dragged or re-simulating): the run's time spread over the ticks from GO to the final launch
function rpvTimeAt(t) {
  const mk = RP.mk;
  if (!mk || mk.go < 0) return 0;
  const to = mk.ko > mk.go ? mk.ko : mk.end > mk.go ? mk.end : mk.n, span = Math.max(1, to - mk.go);
  return (clamp(t - mk.go, 0, span) * rpTimeEnd()) / span;
}
// the livetag's parts: [text, class]; REPLAY · TUBER TOM · #1 · 1:21.44 (REPLAY · YOU VS HARD CPU)
const rpvTagParts = () => {
  const M = RP.meta;
  return M.kind === "vc" ? [[_t("You vs {cpu}", { cpu: M.cpu || _t("CPU") }), "rpv-tn"]] : [[M.own ? _t("You") : M.nm, "rpv-tn"], [M.place > 0 ? `#${M.place}` : "", ""], [rpTimeEnd() > 0 ? rpvTime(rpTimeEnd()) : "", "rpv-pt"]].filter((x) => x[0]);
};

/* ----- the hooks of ui/replay.js ----- */
// the replay took the match screen (again when it starts over after its end)
function rpvOpen() {
  rpvMake();
  const M = RP.meta, mk = RP.mk;
  RPV.c = {}; RPV.drag = -1;
  RPV.bar.hidden = false; RPV.tag.hidden = false; RPV.endEl.hidden = true;
  app.classList.remove("rpidle", "rpend");
  const parts = rpvTagParts(), tag = RPV.tag;
  tag.textContent = ""; tag.setAttribute("aria-label", [_t("Replay")].concat(parts.map((x) => x[0])).join(", "));
  tag.append(rpvMk("i"), rpvTx("span", "", _t("Replay")));
  parts.forEach(([t, c], k) => tag.appendChild(rpvTx(k === 0 ? "b" : "span", `rpv-p ${c}`.trim(), t)));
  // the marks: the break (Boss Week) and the final launch
  const D = rpvRange(), at = (n) => `${Math.round(clamp(n / D, 0, 1) * 1000) / 10}%`;
  RPV.mBrk.hidden = !(RP.cfg.kind === "bw" && mk.brk > 0); if (!RPV.mBrk.hidden) RPV.mBrk.style.left = at(mk.brk);
  RPV.mKo.hidden = !(mk.ko > 0); if (!RPV.mKo.hidden) RPV.mKo.style.left = at(mk.ko);
  RPV.ko.hidden = !(mk.ko > 0);
  RPV.endT.textContent = rpvTime(rpTimeEnd());
  RPV.act = performance.now();
  rpvTagPlace();
  rpvFrame();
}
// every drawn frame of a replay (and after a pause or a seek)
function rpvFrame() {
  if (!RPV.ready || !RP.on || !RP.mk) return;
  if ((RPV.n = (RPV.n | 0) + 1) % 30 === 0) rpvTagPlace();   // the left column's width follows your card (the percent's digits)
  const c = RPV.c, live = !RP.pause && !RP.seeking && !RP.ended && RPV.drag < 0, idle = live && performance.now() - RPV.act > 3000;
  if (c.idle !== idle) { c.idle = idle; app.classList.toggle("rpidle", idle); }
  const paused = RP.pause || RP.ended;
  if (c.paused !== paused) { c.paused = paused; RPV.play.innerHTML = paused ? RPV_IC.play : RPV_IC.pause; RPV.play.setAttribute("aria-label", RP.ended ? _t("Watch again") : paused ? _t("Play@@the replay's play button, next to Pause") : _t("Pause")); }
  const tk = RPV.drag >= 0 ? RPV.drag : RP.seeking ? RP.to : RP.i, pct = Math.round(Math.min(1, tk / rpvRange()) * 1000) / 10;
  if (c.pct !== pct) { c.pct = pct; RPV.fill.style.width = `${pct}%`; RPV.knob.style.left = `${pct}%`; RPV.seek.setAttribute("aria-valuenow", String(Math.round(pct))); }
  if (c.seeking !== RP.seeking) { c.seeking = RP.seeking; RPV.seek.classList.toggle("sk", RP.seeking); }
  const t = bwClock(RPV.drag >= 0 || RP.seeking ? rpvTimeAt(tk) : rpTimeNow(), 1);
  if (c.now !== t) { c.now = t; RPV.now.textContent = t; }
  if (c.sp !== RP.sp) { c.sp = RP.sp; RPV.sp.textContent = `${RP.sp}×`; }
  const sh = !!rpShareId();   // your own try becomes shareable when the server's verdict says it is your best
  if (c.sh !== sh) { c.sh = sh; RPV.sh.hidden = !sh; }
}
// the run is over and its KO page has played: the end card
function rpvEnd() {
  rpvMake();
  const M = RP.meta, mk = RP.mk, bw = RP.cfg.kind === "bw", mine = bw && M.own && RP.from !== "link", won = bw ? mk.won : G && G.winner === 0, ec = RPV.ec;
  ec.textContent = "";
  // what happened: the time (and the place), or what stopped it
  const kick = bw ? [M.no ? _t("Boss Week {no}", { no: M.no }) : _t("Boss Week"), rpvBoss(M.boss), BOSS_LV[RP.cfg.lv] || BOSS_LV[1]] : [_t("Ranked vs CPU"), _t("Replay")];
  const big = bw ? (won ? rpvTime(rpTimeEnd()) : mk.t >= BW_CAP ? _t("Out of time") : _t("He's still up")) : G && G.winner === 0 ? _t("Victory") : G && G.winner === 1 ? _t("Defeat") : _t("Draw");
  ec.append(rpvTx("span", "kick rpv-ek", kick.join(" · ")), rpvTx("b", "rpv-et" + (bw && won ? " time" : ""), big));
  const sub = bw && won ? [rpvPlace(M), Number.isInteger(M.fl) ? _t("{n} ♥ lost", { n: M.fl }) : ""].filter(Boolean) : [];
  if (sub.length) ec.appendChild(rpvTx("span", "rpv-ep", sub.join(" · ")));
  // the buttons
  const mkb = (cls, text, fn) => { const b = rpvBtn("btn " + cls, "", ""); b.appendChild(rpvTx("span", "", text)); rpvTap(b, fn, cls.includes("primary") ? "go" : "flip"); return b; };
  const row = rpvMk("div", "rpv-ea"), sec = rpvMk("div", "rpv-ea2");
  if (bw) {
    row.appendChild(mkb("primary", mine ? _t("Retry") : _t("Your turn: Fight {boss}", { boss: rpvWeekBoss() }), () => rpClose("fight")));
    sec.append(mkb("sm", _t("Watch again"), () => rpClose("again")), mkb("sm", _t("Board ›"), () => rpClose("board")), mkb("sm", _t("Menu"), () => rpClose("")));
    if (rpShareId()) sec.appendChild(mkb("sm rpv-esh", `${_t("Share")} ⤴︎`, () => rpShare()));
  } else {
    row.appendChild(mkb("primary", _t("Watch again"), () => rpClose("again")));
    sec.appendChild(mkb("sm", _t("Menu"), () => rpClose("")));
  }
  ec.append(row, sec);
  RPV.endEl.hidden = false; RPV.bar.hidden = false; RPV.tag.hidden = false;
  app.classList.add("rpend"); app.classList.remove("rpidle");
  RPV.c.idle = false; RPV.act = performance.now();
  rpvFrame();
}
// the replay left the match screen
function rpvClose() {
  if (!RPV.ready) return;
  RPV.bar.hidden = true; RPV.tag.hidden = true; RPV.endEl.hidden = true; RPV.drag = -1; RPV.c = {};
  app.classList.remove("rpidle", "rpend");
}
// a run on its way (a fetch or the scan)
function rpvLoad(on) { rpvMake(); RPV.load.hidden = !on; }
function rpvToast(msg, ms) {
  rpvMake();
  const t = RPV.toast;
  t.textContent = msg; t.hidden = false;
  t.classList.remove("in"); void t.offsetWidth; t.classList.add("in");
  clearTimeout(RPV.toastT); RPV.toastT = setTimeout(() => { t.hidden = true; }, ms || 2600);
}

/* ----- the share link's title card: TUBER TOM VS ZORP · BOSS WEEK 42 · 1:21.44 · #1, then ▶ WATCH ----- */
function rpvTitle() {
  rpvMake();
  const LD = RP.land, el = RPV.title;
  if (!LD) { rpvTitleClose(); return; }
  const M = LD.meta, st = LD.st, here = rpvWeekBoss();
  el.textContent = ""; el.hidden = false;
  const card = rpvMk("div", "card rpv-tc " + st);
  card.setAttribute("role", "dialog"); card.setAttribute("aria-label", _t("A run to watch"));
  const x = rpvBtn("round x rpv-tx", _t("Close"), RPV_X); rpvTap(x, () => rpLandClose(), "back");
  card.appendChild(x);
  const mkb = (cls, text, fn, sfx) => { const b = rpvBtn("btn " + cls, ""); b.appendChild(rpvTx("span", "", text)); rpvTap(b, fn, sfx); return b; };
  const acts = rpvMk("div", "rpv-ta");
  let focus = null;
  if ((st === "ok" || st === "old") && M) {
    const spec = rpBossSpec(M.boss) || BL.BOSSES[0], lv = LD.cfg && BOSS_LV[LD.cfg.lv] || BOSS_LV[1];
    card.appendChild(rpvTx("span", "kick rpv-tk", [M.no ? _t("Boss Week {no}", { no: M.no }) : _t("Boss Week"), lv].join(" · ")));
    const who = rpvMk("div", "rpv-tw"), bd = rpvMk("span", `rpv-bd rd-bossph rd-${spec.id}`), im = document.createElement("img"); im.alt = "";
    bd.style.setProperty("--bc", bwsCol(spec)); bwsImg(im, bwArt(spec.id), bd); bd.appendChild(im);
    const nm = rpvMk("span", "rpv-tn2"); nm.append(rpvTx("b", "", M.nm), rpvTx("span", "", _t("vs {boss}", { boss: spec.name })));
    who.append(bwPortrait(M.f), nm, bd);
    card.appendChild(who);
    const res = rpvMk("div", "rpv-tr2"), pl = rpvPlace(M);
    res.appendChild(rpvTx("b", "rpv-tt" + (st === "old" ? " old" : ""), M.t > 0 ? rpvTime(M.t) : "--:--.--"));
    if (pl) res.appendChild(rpvTx("span", "tag gold st", pl));
    if (M.t > 0) res.appendChild(rpvTx("span", "rpv-th", _t("{n} ♥ lost", { n: M.fl })));
    card.appendChild(res);
    if (st === "old") card.appendChild(rpvTx("p", "rpv-tm", _t("This run is from an older version of the game")));
    else { focus = mkb("primary lg rpv-go", `▶︎ ${_t("Watch")}`, () => rpLandGo(), "go"); acts.appendChild(focus); }
    acts.appendChild(mkb(st === "old" ? "primary" : "sm", _t("Fight {boss}", { boss: here }), () => rpLandClose("sheet"), "go"));
  } else if (st === "load") {
    card.append(rpvMk("i", "rpv-spin"), rpvTx("p", "rpv-tm big", _t("Loading the run…")));
  } else {
    const msg = st === "gone" ? [_t("This run isn't on the board any more"), _t("The board keeps this week's top 10 and yours.")] : st === "net" ? [_t("Couldn't reach the server"), _t("Check the connection and try again.")] : [_t("Replays need the server"), _t("Open the game at potatobrawl.cloud to watch runs.")];
    card.append(rpvTx("span", "kick rpv-tk", _t("Boss Week")), rpvTx("b", "rpv-tb", msg[0]), rpvTx("p", "rpv-tm", msg[1]));
    if (st === "net") { focus = mkb("primary", _t("Try again"), () => { location.hash = "#watch=" + LD.id; }, "flip"); acts.appendChild(focus); acts.appendChild(mkb("sm", _t("Close"), () => rpLandClose(), "back")); }
    else { focus = mkb("primary", st === "gone" ? _t("Fight {boss}", { boss: here }) : _t("OK"), () => rpLandClose(st === "gone" ? "sheet" : undefined), "go"); acts.appendChild(focus); }
  }
  if (acts.childNodes.length) card.appendChild(acts);
  el.appendChild(card);
  if (focus && focus.focus) try { focus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
function rpvTitleClose() { if (RPV.ready) RPV.title.hidden = true; }

/* ----- WATCH ▶ on the results of a Boss Week try and a Ranked vs CPU match (showResults, last) ----- */
function rpvResults(R) {
  const b = $("rWatch");
  if (b) b.hidden = !(rpLocalOk() && (R.bw || R.vc));
}
$("rWatch").addEventListener("click", () => { Sfx.init(); Sfx.cue($("rWatch")); rpWatchLocal(); });
window.__blRpv = { title: rpvTitle, titleClose: rpvTitleClose, toast: rpvToast, load: rpvLoad, end: rpvEnd, results: rpvResults, proto: PROTO };   // tests
