/* ===================== Replays: a run played again from its inputs (UI only; Boss Week runs, Ranked vs CPU matches) =====================
   A run is its seed, its fighters and your logged inputs (vcIn, ui/vscpu.js). It plays again through the same engine and match screen:
   simTick takes the log's input in place of the pad (rpLive) and the CPU partner or foe thinks again from the same random numbers, so
   the HUD, the camera, the sounds and the KO page come back as they were. Nothing a replay does counts: finishMatch hands it to rpEnd
   before anything else (no chips, XP, Road stars, rating), cntStart skips it, the log isn't logged again (no match.bw / match.vc).
   Where a run comes from:
   - the server, GET /api/run/<id> (bossweek.js): the Boss Week board's top 10 and your row, your best on the sheet, last week's top 10,
     a share link potatobrawl.cloud/#watch=<id> (a title card first, rpLanding);
   - this phone: your last finished run from its results (a Boss Week try, won, lost or out of time; a Ranked vs CPU match), rpKeep.
   A run plays only on the game version it was played on (meta.v === PROTO); an older one keeps its time and shows "older version".
   Before it plays, the whole run is simulated once without drawing (rpScan): its length, GO, the break, the final launch, its time.
   Seeking plays it again from the start without drawing, a slice a frame so the page stays live (RP.seeking: the controls' spinner).
   The controls strip, the title and end cards and the WATCH buttons are ui/rpview.js (rpv*, each optional here); this part is the
   engine and the data. Test hook: window.__blRp. */
const RP_IDLE = encIn(BL.blankInput());   // no stick, no button: what plays once the log has run out (the end's slow motion)
const RP_SP = [0.5, 1, 2];
const RP = {
  on: false,       // a replay owns the match screen
  loading: false, err: "", req: 0,
  cfg: null,       // the fight: { kind: "bw" | "vc", pl: [[id, skin], ...], map, lv, hp, seed, d (the CPU's strength), bs (its style: a fighter id) }
  meta: null,      // what the cards say: { kind, id (a server run to share, or ""), tid, own, nm, f, pf, boss, wk, no, t, fl, place, n, cr, fin, v, plate, cpu, res }
  codes: null,     // the inputs, one a tick
  i: 0,            // ticks played
  mk: null,        // rpScan: { n (ticks to the end), go, goT, brk, brkT, ko, koT, end, t, won }
  sp: 1, pause: false, seeking: false, to: 0, ended: false, clean: false, from: "",
  last: null,      // your last finished run on this phone { cfg, codes, meta } (rpKeep)
  land: null,      // a share link: { id, st: "load" | "ok" | "old" | "gone" | "net" | "off", cfg, codes, meta }
};
// a packed log (vcPack: runs of one code, three characters each) back to its codes; null if it isn't one
function rpUnpack(s, max) {
  if (typeof s !== "string" || s.length % 3) return null;
  const out = [];
  for (let i = 0; i < s.length; i += 3) {
    const a = B64I[s[i]], b = B64I[s[i + 1]], c = B64I[s[i + 2]];
    if (a === undefined || b === undefined || c === undefined || out.length + c + 1 > max) return null;
    for (let k = 0, v = a * 64 + b; k <= c; k++) out.push(v);
  }
  return out;
}
const rpBossSpec = (id) => BL.BOSSES.find((b) => b.id === id) || null;
const rpSpec = (id) => FIG[id] || rpBossSpec(id);
// the fight exactly as it was dealt (ui/bossweek.js bwStart, ui/vscpu.js vcStart)
function rpNewGame(cfg) {
  const players = cfg.pl.map(([id, p]) => { const s = rpSpec(id); return { spec: s, pal: s.palettes[p] || s.palettes[0] }; });
  const g = cfg.kind === "bw" ? newGame({ players, stocks: 3, time: 0, countdown: 150, map: cfg.map, level: cfg.lv, hpMul: cfg.hp, seed: cfg.seed })
    : newGame({ players, stocks: 3, time: 240, countdown: 150, map: cfg.map, seed: cfg.seed });
  return { g, bot: makeBot(cfg.d, BL.BOT_STYLES[cfg.bs]) };
}
// this tick's inputs: the log's for you, the CPU's own (Boss Week: your partner against the boss, boss.js bossInputs; Ranked vs CPU: your foe)
const rpInputs = (g, bot, pi, kind) => [pi, kind === "bw" ? botInput(g, g.fighters[1], g.fighters[2], bot) : botInput(g, g.fighters[1], g.fighters[0], bot)];
function rpCode(i) { const c = RP.codes; return decIn(i < c.length ? c[i] : RP_IDLE); }
function rpCfgOk(cfg) {
  if (!cfg || (cfg.kind !== "bw" && cfg.kind !== "vc") || !Array.isArray(cfg.pl) || cfg.pl.length !== (cfg.kind === "bw" ? 3 : 2)) return false;
  if (!cfg.pl.every((x, i) => Array.isArray(x) && (i === 2 ? !!rpBossSpec(x[0]) : !!FIG[x[0]]) && Number.isInteger(x[1]) && x[1] >= 0)) return false;
  return Number.isInteger(cfg.seed) && Number.isInteger(cfg.map) && cfg.map >= 0 && cfg.map < BL.MAPS.length && typeof cfg.d === "number" && !!FIG[cfg.bs] &&
    (cfg.kind === "vc" || (Number.isInteger(cfg.lv) && typeof cfg.hp === "number" && cfg.hp > 0));
}

/* ----- the scan: the whole run once, not drawn ----- */
// the marks on the seek bar and the run's own time; done(mk) on a later frame (a long run takes a few slices)
function rpScan(cfg, codes, done) {
  const { g, bot } = rpNewGame(cfg), mk = { n: 0, go: -1, goT: 0, brk: -1, brkT: 0, ko: -1, koT: 0, end: -1, t: 0, won: false };
  const max = codes.length + 4000, req = RP.req;
  let i = 0;
  const slice = () => {
    if (req !== RP.req) return;
    const t0 = performance.now();
    while (i < max && performance.now() - t0 < 12) {
      for (let k = 0; k < 200 && i < max; k++) {
        const pi = i < codes.length ? decIn(codes[i]) : decIn(RP_IDLE);
        step(g, rpInputs(g, bot, pi, cfg.kind));
        i++;
        for (const e of g.events) {
          if (e.type === "go" && mk.go < 0) { mk.go = i; mk.goT = g.t; }
          else if (e.type === "lethal" && mk.ko < 0 && (cfg.kind === "bw" ? e.slot === 2 : e.final)) { mk.ko = i; mk.koT = g.t; }
          else if (e.type === "game" && mk.end < 0) mk.end = i;
        }
        g.events.length = 0;
        const b = cfg.kind === "bw" ? g.fighters[2] : null;
        if (b && mk.brk < 0 && (b.state === "broken" || b.doomed)) { mk.brk = i; mk.brkT = g.t; }
        if (cfg.kind === "bw" && mk.go >= 0 && mk.ko < 0 && g.t - mk.goT >= BW_CAP) { mk.end = mk.n = i; i = max; break; }   // the 4:00 cap (bwHud ends the try there)
        if (g.phase === "over") { mk.n = i; i = max; break; }
      }
    }
    BL.useStage(mode === "match" && G ? G : attract ? attract.g : g);   // the stage is one for all games: the one on screen again
    if (i < max) { requestAnimationFrame(slice); return; }
    if (!mk.n) mk.n = max;
    mk.won = cfg.kind === "bw" ? mk.ko >= 0 : g.winner === 0;
    mk.t = mk.ko >= 0 && mk.go >= 0 ? mk.koT - mk.goT : Math.max(0, g.t - mk.goT);
    done(mk);
  };
  slice();
}

/* ----- opening a run ----- */
// a server run (the board's ▶, the sheet's WATCH, a share link): GET /api/run/<id>
function rpFetch(id, own) {
  if (!qmOn()) return Promise.resolve({ st: "off" });
  return fetch("/api/run/" + id, { cache: "no-store" }).then((r) => (r.status === 200 ? r.json().then((j) => rpFromServer(j, own)) : { st: r.status === 404 ? "gone" : "net" }), () => ({ st: "net" }));
}
function rpFromServer(j, own) {
  if (!j || typeof j !== "object" || typeof j.id !== "string") return { st: "gone" };
  const cfg = { kind: "bw", pl: [[j.f, j.p | 0], [j.pf, j.pp | 0], [j.boss, 0]], map: j.map, lv: j.lv, hp: j.hp, seed: j.seed, d: j.d, bs: j.pf };
  const meta = { kind: "bw", id: j.id, tid: j.id, own: !!own, nm: SYNC.cleanName(typeof j.nm === "string" ? j.nm : "") || "Potato",
    f: j.f, pf: j.pf, boss: j.boss, wk: j.wk | 0, no: j.no | 0, t: j.t | 0, fl: j.fl | 0, place: j.place | 0, n: j.n | 0, cr: j.cr | 0, fin: !!j.fin, v: j.v | 0,
    plate: typeof j.pl === "string" ? j.pl : "" };
  if (meta.v !== PROTO) return { st: "old", cfg, meta, codes: null };
  const codes = rpCfgOk(cfg) ? rpUnpack(j.lg, 30000) : null;
  return codes && codes.length ? { st: "ok", cfg, meta, codes } : { st: "gone", meta };
}
// own: your own row or best (the marker says YOU)
function rpWatchRun(id, from, own) {
  if (RP.on || RP.loading) return;
  RP.loading = true; RP.err = "";
  if (typeof rpvLoad === "function") rpvLoad(true);
  rpFetch(id, own).then((x) => {
    RP.loading = false;
    if (typeof rpvLoad === "function") rpvLoad(false);
    if (x.st === "ok") { rpOpen(x.cfg, x.codes, x.meta, from); return; }
    RP.err = x.st === "old" ? _t("This run is from an older version of the game") : x.st === "gone" ? _t("This run isn't on the board any more") : x.st === "off" ? _t("Replays need the server") : _t("Couldn't reach the server. Try again.");
    if (typeof rpvToast === "function") rpvToast(RP.err);
  });
}
// your last run from its results (showResults keeps it: rpKeep)
function rpKeep(R) {
  RP.last = null;
  const log = match && match.log;
  if (!log || !log.length || R.forfeit) return;   // a run you left plays nothing more
  const nm = P.name || "You";
  if (R.bw) {
    const tk = R.bw.tk;
    RP.last = { cfg: { kind: "bw", pl: [[tk.f, tk.p], [tk.pf, tk.pp], [tk.boss, 0]], map: tk.map, lv: tk.lv, hp: tk.hp, seed: tk.seed, d: tk.d, bs: tk.pf }, codes: log.slice(),
      meta: { kind: "bw", id: "", tid: tk.id, own: true, nm, f: tk.f, pf: tk.pf, boss: tk.boss, wk: tk.wk, no: tk.no | 0, t: R.bw.won ? R.bw.t : 0, fl: R.bw.fl, place: 0, n: 0, cr: 0, fin: false, v: PROTO, plate: P.plate || "", cpu: match.cpu || "" } };   // cpu: the partner's nickname, as it was
  } else if (R.vc) {
    const tk = R.vc;
    RP.last = { cfg: { kind: "vc", pl: [[tk.f[0], tk.p[0]], [tk.f[1], tk.p[1]]], map: tk.map, seed: tk.seed, d: tk.d, bs: tk.f[1] }, codes: log.slice(),
      meta: { kind: "vc", id: "", tid: tk.id, own: true, nm, f: tk.f[0], pf: tk.f[1], boss: "", wk: 0, no: 0, t: 0, fl: 0, place: 0, n: 0, cr: 0, fin: false, v: PROTO, plate: P.plate || "", cpu: match.cpu || "", res: R.res } };
  }
  if (RP.last && !rpCfgOk(RP.last.cfg)) RP.last = null;
}
const rpLocalOk = () => !!RP.last;
function rpWatchLocal() { const L = RP.last; if (L && !RP.on) rpOpen(L.cfg, L.codes, Object.assign({}, L.meta), "results"); }
// a run to watch: scanned first, then played from its start
function rpOpen(cfg, codes, meta, from) {
  if (!rpCfgOk(cfg) || !codes || !codes.length) return;
  const req = ++RP.req;
  Object.assign(RP, { cfg, codes, meta, from: from || "", mk: null, loading: true, err: "", sp: 1, pause: false, seeking: false, ended: false, clean: false });
  if (typeof rpvLoad === "function") rpvLoad(true);
  cnt("rp:watch");   // ui/counter.js
  rpScan(cfg, codes, (mk) => {
    if (req !== RP.req) return;
    RP.loading = false; RP.mk = mk;
    if (typeof rpvLoad === "function") rpvLoad(false);
    if (meta.kind === "bw" && !meta.t && mk.won) meta.t = mk.t;
    rpBegin();
  });
}
// the match screen, fed from the log
function rpBegin() {
  const { g, bot } = rpNewGame(RP.cfg), M = RP.meta, k = RP.cfg.kind;
  G = g; meSlot = 0; RP.i = 0; RP.on = true; RP.ended = false;
  match = k === "bw" ? { boss: true, rp: true, bwr: { go: -1, ko: -1, brk: -1, cap: false, spl: 0 }, level: RP.cfg.lv, d: RP.cfg.d, bot, cpu: M.cpu || cpuName(), road: null }
    : { rp: true, ranked: false, d: RP.cfg.d, bot, level: null, cpu: M.cpu || cpuName() };
  match.rpTag = M.own ? _t("YOU") : M.nm.slice(0, 10).toUpperCase();   // the marker over your fighter (draw-world.js drawTag)
  if (typeof bdClose === "function" && screens.boards && !screens.boards.hidden) bdClose();
  if (typeof bwSheetClose === "function") bwSheetClose();
  enterMatchUI();
  if (!M.own) GLAZED.delete(G.fighters[0]);   // your glaze is yours (ui/glaze.js), not on someone else's run
  $("pc0").querySelector(".pc-tag").textContent = M.own ? _t("You") : M.nm;
  $("ctl").hidden = true;
  app.classList.add("replay"); app.classList.remove("rpclean");
  if (typeof rpvOpen === "function") rpvOpen();
}

/* ----- playing (loop.js) ----- */
// simTick: one tick of the replay; false while paused, seeking or ended (the frame holds)
function rpLive() {
  if (RP.pause || RP.seeking || RP.ended) return false;
  step(G, rpInputs(G, match.bot, rpCode(RP.i), RP.cfg.kind));
  RP.i++;
  return true;
}
const rpRate = () => (RP.on && mode === "match" && !RP.pause ? RP.sp : 1);   // frame(): the replay's speed
function rpFrame() { if (RP.on && typeof rpvFrame === "function") rpvFrame(); }   // every drawn frame (loop.js)
// finishMatch: the run is over (the KO page has played): the end card
function rpEnd() {
  RP.ended = true; RP.pause = false;
  if (RP.clean) rpClean(false);
  if (typeof rpvEnd === "function") rpvEnd();
}
// the clock: the run's time now and at its end, in frames from GO (Boss Week: to the final launch, as the board counts)
function rpTimeNow() {
  const mk = RP.mk, r = match && match.bwr;
  if (!mk || !G) return 0;
  if (r) return r.go < 0 ? 0 : Math.max(0, (r.ko >= 0 ? r.ko : G.t) - r.go);
  return mk.go < 0 || RP.i < mk.go ? 0 : Math.max(0, Math.min(G.t, mk.koT || G.t) - mk.goT);
}
const rpTimeEnd = () => (RP.meta && RP.meta.t ? RP.meta.t : RP.mk ? RP.mk.t : 0);

/* ----- the controls (ui/rpview.js calls these) ----- */
function rpToggle() {
  if (!RP.on) return;
  if (RP.ended) { rpRestart(); return; }
  RP.pause = !RP.pause;
  if (typeof rpvFrame === "function") rpvFrame();
}
function rpPauseSet(on) { if (RP.on && !RP.ended && RP.pause !== on) rpToggle(); }
function rpSpeed(s) { if (RP_SP.includes(s)) RP.sp = s; }
function rpSpeedNext() { RP.sp = RP_SP[(RP_SP.indexOf(RP.sp) + 1) % RP_SP.length]; return RP.sp; }
// to tick `to` (the seek bar): forward from here, or from the start again; a slice a frame, the frame holds meanwhile
function rpSeek(to) {
  if (!RP.on || !RP.mk) return;
  RP.to = clamp(Math.round(to), 0, Math.max(0, RP.mk.end > 0 ? RP.mk.end - 1 : RP.mk.n - 1));
  if (RP.ended) { RP.ended = false; if (typeof rpvOpen === "function") rpvOpen(); }
  finStop(); hideBanner();
  if (RP.to < RP.i || G.phase === "over") rpFresh();
  if (!RP.seeking) { RP.seeking = true; rpSeekSlice(); }
}
function rpFresh() {   // the run from its first tick
  const { g, bot } = rpNewGame(RP.cfg);
  G = g; match.bot = bot; RP.i = 0; lastCount = 0;
  if (match.bwr) Object.assign(match.bwr, { go: -1, ko: -1, brk: -1, cap: false, spl: 0 });
  if (!RP.meta.own) GLAZED.delete(G.fighters[0]);
  else glazeMatch();
}
function rpSeekSlice() {
  if (!RP.on || !RP.seeking) return;
  const t0 = performance.now(), r = match.bwr;
  while (RP.i < RP.to && performance.now() - t0 < 10) {
    for (let k = 0; k < 100 && RP.i < RP.to; k++) {
      step(G, rpInputs(G, match.bot, rpCode(RP.i), RP.cfg.kind));
      RP.i++;
      if (r) for (const e of G.events) { if (e.type === "go") r.go = G.t; else if (e.type === "lethal" && e.slot === 2 && r.ko < 0) r.ko = G.t; }
      if (r && r.brk < 0 && G.fighters[2] && (G.fighters[2].state === "broken" || G.fighters[2].doomed)) r.brk = G.t;
      G.events.length = 0;   // looks and sounds of the skipped part are dropped (effects.js handleEvent never sees them)
    }
  }
  if (RP.i < RP.to) { requestAnimationFrame(rpSeekSlice); return; }
  RP.seeking = false;
  // the screen as if it had been playing: no leftover sparks, trails, banners or a KO page, the camera on the fighters
  fx.length = 0; sfx.length = 0; clearTrails(); combos.fill(null);
  for (let k = 0; k < 4; k++) hudCache[k] = { pct: -1, stocks: -1, out: null };
  bossHudReset(); camStep(G, true);
  if (typeof rpvFrame === "function") rpvFrame();
}
function rpRestart() { if (RP.on) { RP.pause = false; rpSeek(0); } }
function rpToKo() { if (RP.on && RP.mk && RP.mk.ko > 0) { RP.pause = false; rpSeek(Math.max(0, RP.mk.ko - 150)); } }   // 2.5 s before the final launch: the blow and the KO page
function rpClean(on) { RP.clean = !!on; app.classList.toggle("rpclean", RP.clean); }   // no HUD and no controls: a clean screen recording
// a link anyone can open (no account): only for a run the server keeps
function rpShareId() {
  const M = RP.meta;
  if (!M || M.kind !== "bw") return "";
  if (M.id) return M.id;
  const v = BW.res;   // your own try, if the server just made it your best
  return M.own && v && v.id === M.tid && v.ok && v.why === "best" ? M.tid : "";
}
function rpLink(id) { return `${location.origin}${location.pathname}#watch=${id}`; }
function rpShareText() {
  const M = RP.meta, b = rpBossSpec(M.boss);
  const v = { boss: b ? b.name : _t("the boss"), time: bwClock(rpTimeEnd(), 2), place: M.place ? ` · #${M.place}` : "", name: M.nm };
  return M.own ? _t("My Boss Week run vs {boss}: {time}{place}. Think you can beat it?", v) : _t("{name}'s Boss Week run vs {boss}: {time}{place}. Think you can beat it?", v);
}
function rpShare() {
  const id = rpShareId();
  if (!id) return false;
  const link = rpLink(id);
  cnt("rp:share");
  if (chlPhone()) { try { navigator.share({ title: "PotatoBrawl", text: rpShareText(), url: link }).catch(() => {}); } catch (e) { /* no share sheet */ } return true; }   // ui/challenge.js chlPhone
  try { navigator.clipboard.writeText(`${rpShareText()} ${link}`).then(() => { if (typeof rpvToast === "function") rpvToast(_t("Link copied")); }, () => {}); } catch (e) { /* no clipboard */ }
  return true;
}
// leave the replay: the menu, then where the end card's button points ("sheet": the Boss Week sheet, "board": the Boards tab,
// "fight": a try of your own, "again": the same run from the start, "": the menu); no next (✕): back to the board or sheet it came from
function rpClose(next) {
  if (!RP.on) return;
  if (next === "again") { RP.ended = false; if (typeof rpvOpen === "function") rpvOpen(); rpRestart(); return; }
  if (next === undefined && (RP.from === "board" || RP.from === "sheet")) next = RP.from;   // ✕: back where you opened it
  const land = RP.from === "link";
  RP.on = false; RP.req++; RP.seeking = false; RP.pause = false; RP.ended = false;
  app.classList.remove("replay", "rpclean");
  if (typeof rpvClose === "function") rpvClose();
  goMenu();
  if (next === "sheet" && typeof bwSheetOpen === "function") bwSheetOpen();
  else if (next === "board" && typeof bdOpen === "function") bdOpen("w");
  else if (next === "fight") bwFight();
  else if (land && firstRun && !ACCT.hash && !playedOnce()) welcomeOpen();   // a brand-new player from a share link: the welcome sheet (ui/welcome.js) once they leave
}
// keys while watching: Space / K play and pause, ← → 5 s back and on (Esc and P pause through togglePause)
window.addEventListener("keydown", (e) => {
  if (!RP.on || mode !== "match" || RP.loading) return;
  if (e.code === "Space" || e.code === "KeyK") { e.preventDefault(); rpToggle(); }
  else if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && RP.mk) { e.preventDefault(); rpSeek(RP.i + (e.code === "ArrowLeft" ? -300 : 300)); }
});

/* ----- a share link: potatobrawl.cloud/#watch=<id> ----- */
function rpHashId() { const m = /^#watch=([0-9a-f]{12})$/.exec(location.hash || ""); return m ? m[1] : ""; }
// loop.js, after the turn-sideways screen: a link's run comes before the welcome sheet
function rpLanding() {
  const id = rpHashId();
  if (!id) return false;
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* the hash stays: harmless */ }
  RP.land = { id, st: "load" };
  cnt("rp:link");
  if (RP.on) rpClose();
  if (typeof rpvTitle === "function") rpvTitle();
  rpFetch(id).then((x) => {
    if (!RP.land || RP.land.id !== id) return;
    Object.assign(RP.land, x);
    if (typeof rpvTitle === "function") rpvTitle();
  });
  return true;
}
// the title card's WATCH (the tap also turns the sound on)
function rpLandGo() {
  const L = RP.land;
  if (!L || L.st !== "ok") return;
  Sfx.init(); goFull();
  if (typeof rpvTitleClose === "function") rpvTitleClose();
  RP.land = null;
  rpOpen(L.cfg, L.codes, L.meta, "link");
}
// the title card without watching: the menu (a brand-new player's welcome sheet), or "sheet" for FIGHT
function rpLandClose(next) {
  RP.land = null;
  if (typeof rpvTitleClose === "function") rpvTitleClose();
  if (next === "sheet" && typeof bwSheetOpen === "function") { bwSheetOpen(); return; }
  if (firstRun && !ACCT.hash && !playedOnce()) welcomeOpen();
}
window.addEventListener("hashchange", () => { if (rpHashId() && mode !== "match") rpLanding(); });   // a link opened in a tab the game is already in

// tests: a run played by a bot in your place, its codes as vcIn would have logged them (to the end of the fight)
function rpBotRun(cfg, lv) {
  if (!rpCfgOk(cfg)) return null;
  const { g, bot } = rpNewGame(cfg), me = makeBot(lv, BL.BOT_STYLES[cfg.pl[0][0]]), R = BL.rngOf(4242), codes = [], foe = cfg.kind === "bw" ? 2 : 1;
  for (let i = 0; i < 30000 && g.phase !== "end" && g.phase !== "over"; i++) {
    const r0 = g.rng; g.rng = R;   // the bot's own random numbers: the game's stay the game's
    let pi; try { pi = botInput(g, g.fighters[0], g.fighters[foe], me); } finally { g.rng = r0; }
    const c = encIn(Object.assign(BL.blankInput(), pi));
    codes.push(c);
    step(g, rpInputs(g, bot, decIn(c), cfg.kind));
    g.events.length = 0;
  }
  BL.useStage(mode === "match" && G ? G : attract ? attract.g : g);
  return codes;
}
window.__blRp = { get st() { return RP; }, botRun: rpBotRun, open: rpOpen, watch: rpWatchRun, local: rpWatchLocal, seek: rpSeek, toggle: rpToggle, speed: rpSpeed, restart: rpRestart, toKo: rpToKo, clean: rpClean, close: rpClose, share: rpShare, shareId: rpShareId, unpack: rpUnpack, landGo: rpLandGo, landClose: rpLandClose, now: rpTimeNow, end: rpTimeEnd };
