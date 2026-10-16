/* ===================== online Team Brawl: 2v2 for up to four phones =====================
   Play friends > 2 VS 2. The host's board has two seats a side: Ice (team 0, slots 0 and 1) and Ember (team 1, slots 2 and 3), the same
   colours on every phone. Friends fill Ice first, then Ember, and may switch to a free seat across; a seat without a person is a CPU. Only
   the host starts (never by itself). In the match every phone runs the 1v1's lockstep (ui/online.js) with one input log per person, and
   runs every CPU itself, frame for frame, from the same random numbers (G.rng = BL.rngOf(seed)): a CPU whose moves crossed the network
   would act on stale frames and lose almost every fight. The CPUs' memory and that counter ride in the repair copy.
   The "lead" is the lowest seat whose phone is still heard: it compares everyone's checksums, sends the repair copy, and hands a friend
   who drops to a CPU from a frame it names (with their last inputs, so every phone has them). A phone that hears nobody at all plays on
   alone with CPUs. Design: /mnt/project-files/online-2v2/fable-online2v2.md (Fable). */
const TB_RULES = { l: 3, t: 4, b: 1 };      // Team Brawl's rules: three hearts, 4:00, one match, a map from the random pool
const TB_LV = [1, 2, 3];                   // the CPUs row (Easy, Normal, Hard) as LEVELS indices
const TB_SEATS = [0, 1, 2, 3];
const TB_SILENT = 15000;   // nothing at all from a friend this long (their presence changes every second, ping stamps included): dropped
const TB_PING = 3000;      // a Focus ping with a person as partner: shown 3 s, one every 3 s
const TB_PART = 1600;      // repair copy pieces: smaller than a 1v1's, so a piece fits next to the claims and the start message
const TB_RELAY = 60;       // frames of a dropped friend's last inputs passed on with the claim
const tbTeam = (s) => (s < 2 ? 0 : 1), tbMate = (s) => s ^ 1, tbFoes = (s) => (s < 2 ? [2, 3] : [0, 1]);
const tbLvName = (lv) => LEVELS[TB_LV[lv]].name;
// The lobby's third mode. P.onTeam = { on, lv (0-2) }: this device's last pick (not synced), Normal at first
function onTeam() {
  const o = P.onTeam && typeof P.onTeam === "object" ? P.onTeam : {};
  return { on: !!o.on, lv: [0, 1, 2].includes(o.lv) ? o.lv : 1 };
}
const tbMe = () => NET.myPeer || ((NET.mr && NET.mr.peers().find((p) => p.sameTab)) || {}).peer || null;
const tbValidBd = (bd) => Array.isArray(bd) && bd.length === 4 && bd.every((p) => p === null || (typeof p === "string" && p.length <= 64));
const tbFree = (bd) => bd.filter((p) => !p).length;

/* ----- the board: the host keeps the seats (bd[seat] = a peer id or null for a CPU); friends ask through their presence ----- */
const tbPres = () => ({ lv: NET.tb.lv, bd: NET.tb.bd.slice(), open: NET.phase === "hosting" });
function tbHostOpen() { NET.tb = { lv: onTeam().lv, bd: [tbMe(), null, null, null], sw: {}, sig: "", full: false }; }
// the host: friends who left lose their seat, new friends sit (Ice first, then Ember), Switch side requests move them across
function tbSeat(peers) {
  const T = NET.tb, me = tbMe(), bd = T.bd.slice();
  if (me && !bd.includes(me)) bd[bd.indexOf(null)] = me;
  const here = new Set(peers.filter((p) => !p.sameTab && p.kind === "viewer").map((p) => p.peer));
  bd.forEach((p, i) => { if (p && p !== me && !here.has(p)) bd[i] = null; });
  for (const p of peers) {
    if (p.sameTab || p.kind !== "viewer" || !p.presence || p.presence.role !== "guest") continue;
    const pr = p.presence;
    if (!bd.includes(p.peer)) {
      if (NET.phase !== "hosting") continue;
      const i = bd.indexOf(null);
      if (i >= 0) { bd[i] = p.peer; T.sw[p.peer] = pr.sw | 0; }
      continue;
    }
    if (Number.isInteger(pr.sw) && pr.sw > (T.sw[p.peer] | 0)) { T.sw[p.peer] = pr.sw; tbSwitch(bd, p.peer); }
  }
  if (bd.join() !== T.bd.join()) { T.bd = bd; namedPresence({ tb: tbPres() }); lobbyPresence(); }
}
function tbSwitch(bd, peer) {
  const s = bd.indexOf(peer), to = s < 0 ? -1 : tbFoes(s).find((k) => !bd[k]);
  if (to === undefined || to < 0) return false;
  bd[s] = null; bd[to] = peer; return true;
}
// Switch side: the host moves itself; a friend asks the host
function tbSwitchMe() {
  if (!NET.tb || !NET.mr) return;
  if (NET.role === "host") {
    const bd = NET.tb.bd.slice();
    if (tbSwitch(bd, tbMe())) { NET.tb.bd = bd; namedPresence({ tb: tbPres() }); }
  } else namedPresence({ sw: (NET.myPres.sw | 0) + 1 });
  renderOnline();
}
// the host taps START: everyone seated measures the ping to everyone else (tbHandshake), then the host sends the start
function tbGo() {
  if (NET.role !== "host" || NET.phase !== "hosting" || !NET.mr) return;
  const me = tbMe(), bd = NET.tb.bd.slice();
  if (!bd.some((p) => p && p !== me)) return;
  NET.phase = "handshake";
  tbHsBegin({ id: NET.matchId + 1, bd });
  namedPresence({ go: { id: NET.matchId + 1, bd }, tb: tbPres() });
  lobbyPresence(); renderOnline();
}
function tbHsBegin(go) {
  NET.hs = { id: go.id, bd: go.bd.slice(), t0: performance.now(), sent: new Map(), seen: new Set(), rtt: [[], [], [], []] };
  NET.pingT = 0;
  namedPresence({ rt: null, rm: null });
}
const tbMed = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null);
function tbHandshake(now) {
  const H = NET.hs, me = H.bd.indexOf(tbMe()), peers = NET.mr ? NET.mr.peers() : [];
  if (me < 0) { NET.phase = NET.role === "host" ? "hosting" : "board"; NET.hs = null; renderOnline(); return; }
  const echo = [null, null, null, null], pres = [];
  for (const p of peers) {
    const s = H.bd.indexOf(p.peer);
    if (s < 0 || s === me || !p.presence) continue;
    const pr = p.presence; pres[s] = pr;
    if (typeof pr.pg === "number") echo[s] = pr.pg;
    const po = Array.isArray(pr.po) ? pr.po[me] : null;
    if (typeof po === "number" && H.sent.has(po) && !H.seen.has(s + ":" + po)) { H.seen.add(s + ":" + po); H.rtt[s].push(now - H.sent.get(po)); }
  }
  if (now - NET.pingT > 110) {
    NET.pingT = now;
    const t = Math.round(now) % 1000000000;
    H.sent.set(t, now);
    if (H.sent.size > 60) H.sent.delete(H.sent.keys().next().value);
    namedPresence({ pg: t, po: echo });
  } else if (JSON.stringify(echo) !== JSON.stringify(NET.myPres.po)) namedPresence({ po: echo });
  // my slowest pair: the median ping to each friend still here (260 ms for one never measured)
  const others = TB_SEATS.filter((s) => s !== me && H.bd[s] && pres[s]);
  const ready = others.every((s) => H.rtt[s].length >= 5) || now - H.t0 > 3000;
  if (ready && typeof NET.myPres.rt !== "number") namedPresence({ rt: Math.round(Math.max(0, ...others.map((s) => tbMed(H.rtt[s]) ?? 260))) });
  if (NET.role === "host") {
    const rts = others.map((s) => pres[s].rt);
    if (!((ready && rts.every((v) => typeof v === "number")) || now - H.t0 > 6000)) return;
    if (!others.length) { NET.phase = "hosting"; NET.hs = null; namedPresence({ go: null }); renderOnline(); return; }   // everyone left meanwhile
    const rtt = Math.max(NET.myPres.rt || 0, ...rts.map((v) => (typeof v === "number" ? v : 260)));
    const pad = typeof window.__blDpad === "number" ? window.__blDpad : 4;
    const st = tbMakeStart(H.id, H.bd.map((p, s) => (s === me || pres[s] ? p : null)), clamp(Math.ceil((rtt / 2 + pad) / 16.67) + 1, 3, 15), Math.round(rtt));
    namedPresence({ start: st, go: null });
    tbStartMatch(st);
    return;
  }
  const host = NET.tb && peers.find((p) => p.peer === NET.tb.host), st = host && host.presence && host.presence.start;
  if (tbValidStart(st) && st.id > NET.startSeen) tbStartMatch(st);
  else if (now - H.t0 > 15000) { NET.phase = "board"; NET.hs = null; renderOnline(); }   // no start came: back to the board
}
// the start message: seats (h: a peer or null), fighters and skins (no fighter in the same skin twice), the CPUs' potato names
function tbMakeStart(id, h, d, rtt) {
  const me = tbMe(), peers = NET.mr ? NET.mr.peers() : [], f = [], p = [], nm = [null, null, null, null];
  h.forEach((peer, s) => {
    if (!peer) return;
    const pr = peer === me ? { f: sel.fighter, pi: palIdx(sel.fighter) } : (peers.find((q) => q.peer === peer) || {}).presence || {};
    f[s] = FIG[pr.f] ? pr.f : FIGHTERS[0].id;
    p[s] = Number.isInteger(pr.pi) && pr.pi >= 0 && pr.pi < FIG[f[s]].palettes.length ? pr.pi : 0;
  });
  tbFillCpus(h, f, p, nm);
  return { id, seed: (Math.random() * 1e9) | 0, d, t: 1, lv: NET.tb.lv, h, f, p, nm, rtt };
}
// CPU seats: a fighter nobody on the board has (when there is one), the first skin not taken, a potato name
function tbFillCpus(h, f, p, nm) {
  for (const s of TB_SEATS) {
    if (h[s] || (f[s] && nm[s])) continue;
    const pool = FIGHTERS.filter((x) => !f.includes(x.id));
    f[s] = (pool.length ? pool : FIGHTERS)[(Math.random() * (pool.length || FIGHTERS.length)) | 0].id;
    nm[s] = cpuNameNot(nm);
  }
  const used = [];
  for (const s of TB_SEATS) {
    const n = FIG[f[s]].palettes.length;
    let k = p[s] | 0, tries = 0;
    while (used.includes(f[s] + ":" + k) && tries++ < n) k = (k + 1) % n;
    p[s] = k; used.push(f[s] + ":" + k);
  }
}
function tbValidStart(st) {
  return !!st && typeof st === "object" && st.t === 1 && Number.isInteger(st.id) && Number.isInteger(st.seed) && Number.isInteger(st.d) && st.d >= 1 && st.d <= 20 &&
    [0, 1, 2].includes(st.lv) && tbValidBd(st.h) && st.h.some((p) => p) && Array.isArray(st.f) && st.f.length === 4 && st.f.every((id) => FIG[id]) &&
    Array.isArray(st.p) && st.p.length === 4 && st.p.every((v, i) => Number.isInteger(v) && v >= 0 && v < FIG[st.f[i]].palettes.length) &&
    Array.isArray(st.nm) && st.nm.length === 4 && st.nm.every((n, i) => (st.h[i] ? n === null : typeof n === "string" && n.length <= 24));
}

/* ----- the lobby, every frame on the board (and during the start) ----- */
function tbLobbyTick(now) {
  if (!NET.mr) return;
  if (NET.phase === "handshake") { tbHandshake(now); return; }
  const peers = NET.mr.peers();
  if (NET.role === "host") { tbSeat(peers); tbBoardSig(peers); return; }
  tbGuest(peers);
}
// a friend: the host's board (drawn from the host's presence); a START that includes me starts the ping
function tbGuest(peers) {
  const host = peers.find((p) => !p.sameTab && p.presence && p.presence.role === "host");
  const tb = host && host.presence.tb, me = tbMe();
  if (!host || !tb || !tbValidBd(tb.bd)) {
    if (NET.phase === "joining") return;   // the host's board has not come in yet (handshakeTick gives up after 8 s)
    NET.note = NET.phase === "board" ? "The host closed the brawl." : "The host left."; netCancel(); return;
  }
  NET.tb = Object.assign(NET.tb || {}, { host: host.peer, lv: [0, 1, 2].includes(tb.lv) ? tb.lv : 1, bd: tb.bd.slice(), open: !!tb.open });
  const seated = tb.bd.includes(me);
  if (NET.phase === "joining") {
    if (seated) { NET.phase = "board"; NET.oppPeer = null; lobbyPresence(); renderOnline(); return; }
    if (!tb.open) { NET.note = "That brawl has already started."; netCancel(); return; }
    if (!tbFree(tb.bd)) { NET.note = "That match just filled up."; netCancel(); return; }
    return;
  }
  const go = host.presence.go;
  if (go && Number.isInteger(go.id) && go.id > NET.startSeen && tbValidBd(go.bd) && go.bd.includes(me) && NET.phase === "board") {
    NET.phase = "handshake"; tbHsBegin(go); renderOnline(); return;
  }
  tbBoardSig(peers);
}
// re-draw the board only when something on it changed (a seat, a fighter, a skin), not on every ping
function tbBoardSig(peers) {
  const bd = NET.tb.bd, sig = JSON.stringify([bd, NET.tb.lv, NET.phase, bd.map((p) => { const q = p && peers.find((x) => x.peer === p); return q && q.presence ? [q.presence.f, q.presence.pi, q.by] : 0; })]);
  if (sig === NET.tb.sig) return;
  NET.tb.sig = sig;
  const full = bd.every((p) => p);   // all four seats hold people: START glows, with a chime for the host
  if (full && !NET.tb.full && NET.role === "host" && mode === "online") { Sfx.tone(660, 990, 0.12, "triangle", 0.06); Sfx.tone(990, 1480, 0.16, "triangle", 0.05); }
  NET.tb.full = full;
  renderOnline();
}

/* ----- the board on screen (renderOnline in ui/online.js calls this with the names of the people in the room) ----- */
function tbRender(names) {
  const T = NET.tb, on = !!T && (NET.phase === "hosting" || NET.phase === "board" || NET.phase === "handshake");
  $("onTb").hidden = !on;
  if (!on) return;
  const me = tbMe(), host = NET.role === "host", mr = NET.mr ? NET.mr.peers() : [], hostPeer = host ? me : T.host;
  const seat = (s) => {
    const el = $("onSeat" + s), peer = T.bd[s];
    el.className = "on-seat" + (peer ? "" : " cpu") + (peer && peer === me ? " me" : "");
    el.replaceChildren();
    const av = document.createElement("i"), tx = document.createElement("span"), nm = document.createElement("b"), sb = document.createElement("small");
    av.className = "av"; tx.className = "t";
    if (peer) {
      const pr = peer === me ? { f: sel.fighter } : ((mr.find((q) => q.peer === peer) || {}).presence || {});
      const spec = FIG[pr.f];
      if (spec && PORTRAITS[spec.id]) { const im = document.createElement("img"); im.src = PORTRAITS[spec.id]; im.alt = ""; av.appendChild(im); }
      nm.textContent = peer === me ? NET.myName || "You" : names[peer] || "Friend";
      const tag = peer === hostPeer ? "Host" : peer === me ? "You" : "";
      if (tag) { const t = document.createElement("em"); t.textContent = tag; nm.appendChild(t); }
      sb.textContent = spec ? spec.name : "Picking";
    } else {
      av.textContent = "C";
      nm.textContent = `CPU · ${tbLvName(T.lv)}`;
      sb.textContent = "Free for a friend";
    }
    tx.append(nm, sb); el.append(av, tx);
  };
  TB_SEATS.forEach(seat);
  const s = T.bd.indexOf(me), across = s < 0 ? [] : tbFoes(s), canSw = across.some((k) => !T.bd[k]) && NET.phase !== "handshake";
  $("onSwitch").disabled = !canSw;
  $("onTbNote").textContent = s >= 0 && !canSw && NET.phase !== "handshake" ? `${s < 2 ? "Ember" : "Ice"} is full.` : "Empty seats play as CPUs.";
  $("onClose").hidden = !host;
  $("onClose").disabled = NET.phase === "handshake";
  const rl = $("onTbR");
  rl.hidden = host;
  rl.textContent = `${tbLvName(T.lv)} CPUs in empty seats · 3 hearts · 4:00`;
  $("onKick").textContent = host ? "Your team brawl" : `${names[T.host] || "Your friend"}'s team brawl`;
}
// the host button and the note while a team brawl is open (renderOnline)
function tbHostBtn(btn, note, names) {
  const T = NET.tb, me = tbMe(), friends = T.bd.filter((p) => p && p !== me);
  if (NET.role === "host") {
    btn.querySelector("span").textContent = "Start";
    btn.classList.add("primary");
    btn.disabled = !NET.connected || !friends.length || NET.phase === "handshake";
    btn.classList.toggle("full", T.bd.every((p) => p) && NET.phase === "hosting");
    const who = friends.map((p) => names[p] || "Friend");
    note.textContent = NET.phase === "handshake" ? "Starting…" : !who.length ? (NET.standalone ? "Waiting for friends. Send them the link: up to three can join." : "Waiting for friends. Your brawl is listed for everyone here.")
      : T.bd.every((p) => p) ? "Everyone's in. Start when you're ready." : `${who.length === 1 ? who[0] + " is" : who.slice(0, -1).join(", ") + " and " + who[who.length - 1] + " are"} in. Start when you're ready.`;
  } else {
    btn.querySelector("span").textContent = "Leave";
    btn.classList.remove("primary", "full");
    btn.disabled = NET.phase === "handshake";
    note.textContent = NET.phase === "handshake" ? "Starting…" : `${names[T.host] || "The host"} starts the brawl. Change your fighter while you wait.`;
  }
}

/* ----- the match ----- */
function tbStartMatch(st) {
  const me = st.h.indexOf(tbMe());
  NET.startSeen = st.id;
  if (me < 0) { NET.phase = NET.role === "host" ? "hosting" : "board"; NET.hs = null; NET.note = "The brawl started without you."; renderOnline(); return; }
  Object.assign(NET, { matchId: st.id, D: st.d, frame: 0, myLog: [], stall: 0, ckMine: new Map(), ckSend: null, syncSent: null, syncTx: null, syncRx: null, lastSync: 0,
    rm: 0, lastOpp: null, oppLeft: false, rtt: st.rtt || 0, rules: TB_RULES, set: null, setRes: null, nextF: null, rttLive: 0, rttS: [], myPg: null, echo: null, pgT: 0,
    boss: null, cpuMate: null, dropLive: false, emN: 0, emSeen: 0, emT: 0, oppPeer: null, hs: null });
  for (let i = 0; i < NET.D; i++) NET.myLog.push(NEUTRAL);
  const now = performance.now(), d = LEVELS[TB_LV[st.lv]].d;
  TM = { st, d, hum: st.h.slice(), logs: [[], [], [], []], frs: [0, 0, 0, 0], heard: [now, now, now, now], last: [], bots: [], cpuFrom: [], gone: [], cl: [],
    lastSync: [0, 0, 0, 0], rx: [], tx: null, acks: [], syncSent: null, okAfter: [], focusQ: -1, focusF: 0, echo: [null, null, null, null], rttS: [[], [], [], []],
    pgSeen: new Set(), wait: -1, solo: false, lost: false, fp: 0, fpSeen: 0, ping: null, pingT: -1e9, hits: [], tagT: [], finBy: -1, bk: 0 };
  for (const s of TB_SEATS) if (st.h[s] && s !== me) for (let i = 0; i < NET.D; i++) TM.logs[s].push(NEUTRAL);
  meSlot = me;
  const players = st.f.map((id, i) => ({ spec: FIG[id], pal: FIG[id].palettes[st.p[i]], team: tbTeam(i) }));
  G = newGame({ players, stocks: TB_RULES.l, time: TB_RULES.t * 60, countdown: 150, seed: st.seed, map: st.seed % BL.POOL });
  G.rng = BL.rngOf(st.seed);   // the CPUs' random numbers, with their counter in .s for the repair copy
  for (const s of TB_SEATS) if (!st.h[s]) TM.bots[s] = makeBot(d, BL.BOT_STYLES[st.f[s]]);
  const names = st.h.map((p, s) => (s === me ? NET.myName || "You" : p ? "Friend" : st.nm[s]));
  match = { online: true, duo: true, tb: true, ranked: false, level: tbLvName(st.lv), lv: st.lv, d, names, caught: 0 };
  NET.phase = "match"; NICE.length = 0;
  namedPresence({ m: st.id, s: 0, i: "", fr: 0, ck: null, sync: null, sa: null, rm: null, pg: null, po: null, rt: null, cl: null, fp: null, bk: null, go: null, em: 0 });
  lobbyPresence();
  enterMatchUI();
  tbNames();
}
// the people's names (the room's profiles); until they come in, "Friend"
async function tbNames() {
  if (!NET.mr || !TM) return;
  const T = TM, peers = NET.mr.peers().filter((p) => T.hum.includes(p.peer)), n = await namesFor(peers);
  if (TM !== T || !match || !match.tb) return;
  T.hum.forEach((p, s) => { if (p && s !== meSlot && n[p]) match.names[s] = n[p]; });
  tbTags();
}
// a person still plays this seat on frame fr (a CPU took over from TM.cpuFrom[s])
const tbHuman = (s, fr) => !!TM.hum[s] && !(TM.cpuFrom[s] <= fr);
const tbPerson = (s) => !!TM.hum[s] && TM.cpuFrom[s] === undefined;
const tbBot = (s) => TM.bots[s] || (TM.bots[s] = makeBot(TM.d, BL.BOT_STYLES[G.fighters[s].spec.id]));
// the four inputs for frame fr: the people's from their logs (null while one is missing), then Focus taps, then the CPUs' moves
function tbInputs(fr) {
  const ins = [];
  for (const s of TB_SEATS) {
    if (!tbHuman(s, fr)) continue;
    const v = s === meSlot ? NET.myLog[fr] : TM.logs[s][fr];
    if (v === undefined) { TM.wait = s; return null; }
    ins[s] = decIn(v);
  }
  // a Focus tap rides on its frame's input: the tapper's CPU partner goes after that foe, on every phone at the same frame
  for (const s of TB_SEATS) {
    const i = ins[s], m = tbMate(s);
    if (!i || i.focus === undefined || tbHuman(m, fr)) continue;
    const foe = tbFoes(s)[i.focus], b = tbBot(m);
    if (G.fighters[foe].state !== "gone") { b.focus = foe; b.focusT = G.t + DUO_FOCUS; }
  }
  for (const s of TB_SEATS) if (!ins[s]) ins[s] = BL.teamBotInput(G, G.fighters[s], tbBot(s));
  return ins;
}
// my input for the next frame; a Focus tap waits for a frame with no button down (at most half a second)
function tbMine() {
  const i = readPlayer();
  if (TM.focusQ >= 0) {
    const idle = !i.jump && !i.light && !i.heavy && !i.special && !i.dodge && !i.ulti;
    if (idle || NET.frame - TM.focusF > 30) { i.focus = TM.focusQ; TM.focusQ = -1; }
  }
  return encIn(i);
}
const tbHash = () => (checksum(G) ^ (G.rng.s >>> 0)) >>> 0;   // the CPUs' counter too: a CPU that rolled differently shows up at once
function tbTick() {
  const now = performance.now();
  if (NET.mr && !TM.solo) tbReadAll(now);
  if (NET.phase !== "match" || !G || !TM) return;
  const others = tbLive().filter((s) => s !== meSlot);
  const ahead = others.length ? Math.max(...others.map((s) => TM.frs[s])) : NET.frame;
  const maxSteps = ahead - NET.frame > 3 ? 2 : 1;
  let steps = 0;
  TM.wait = -1;
  while (steps < maxSteps) {
    if (NET.myLog.length <= NET.frame + NET.D) NET.myLog.push(tbMine());
    const ins = tbInputs(NET.frame);
    if (!ins) break;
    step(G, ins);
    NET.frame++;
    if (window.__blTestAt && window.__blTestAt.f === NET.frame) window.__blTestAt.fn(G);   // tests: change the games at the same frame
    if (NET.frame % 60 === 0) {
      const h = tbHash();
      NET.ckMine.set(NET.frame, h); NET.ckSend = [NET.frame, h];
      if (NET.ckMine.size > 40) NET.ckMine.delete(NET.ckMine.keys().next().value);
    }
    steps++;
    if (G.phase === "over") break;
  }
  NET.stall = steps ? 0 : NET.stall + 1;
  NET.ticks = (NET.ticks || 0) + 1; if (!steps) NET.stallTotal = (NET.stallTotal || 0) + 1;
  if (NET.mr && !TM.solo) { tbSend(now, others); tbLead(now); }
  const badge = $("netBadge");
  if (NET.stall > 20 && TM.wait >= 0 && !TM.solo && G.phase !== "over") { badge.hidden = false; badge.className = "warn"; badge.textContent = `Waiting for ${match.names[TM.wait] || "a friend"}`; }
  else if (!badge.hidden) badge.hidden = true;
}
// my inputs go out from the oldest frame a friend may still miss, at most 72 frames
function tbSend(now, others) {
  const len = NET.myLog.length, low = others.length ? Math.min(...others.map((s) => TM.frs[s])) : len;
  const from = Math.max(0, len - 72, Math.min(low, len) - 2);
  let str = "";
  for (let fr = from; fr < len; fr++) str += packIn(NET.myLog[fr]);
  if (now - NET.pgT > 1000) {
    NET.pgT = now; NET.myPg = Math.round(now) % 1000000000;
    NET.pingSent.set(NET.myPg, now);
    if (NET.pingSent.size > 60) NET.pingSent.delete(NET.pingSent.keys().next().value);
  }
  namedPresence({ m: NET.matchId, s: from, i: str, fr: NET.frame, ck: NET.ckSend, pg: NET.myPg, po: TM.echo.slice() });
}
function tbReadAll(now) {
  const peers = NET.mr.peers();
  for (const s of TB_SEATS) {
    const peer = TM.hum[s];
    if (!peer || s === meSlot || TM.cpuFrom[s] !== undefined) continue;
    const p = peers.find((q) => q.peer === peer);
    if (!p) { TM.gone[s] = true; continue; }
    if (p.presence !== TM.last[s]) { TM.last[s] = p.presence; TM.heard[s] = now; tbRead(s, p.presence || {}, now); }
    if (!TM || NET.phase !== "match") return;
  }
  // claims and repair copies can also come from a friend already handed to a CPU here (they may still be in the room)
  for (const s of TB_SEATS) {
    const peer = TM.hum[s];
    if (!peer || s === meSlot || TM.cpuFrom[s] === undefined) continue;
    const p = peers.find((q) => q.peer === peer);
    if (p && p.presence !== TM.last[s]) { TM.last[s] = p.presence; tbReadLate(s, p.presence || {}); }
  }
}
function tbRead(s, pr, now) {
  if (pr.m !== NET.matchId) return;
  // the live ping: echo their stamp, time ours
  if (typeof pr.pg === "number") TM.echo[s] = pr.pg;
  const po = Array.isArray(pr.po) ? pr.po[meSlot] : null;
  if (typeof po === "number" && NET.pingSent.has(po) && !TM.pgSeen.has(s + ":" + po)) {
    TM.pgSeen.add(s + ":" + po); if (TM.pgSeen.size > 400) TM.pgSeen.clear();
    TM.rttS[s].push(now - NET.pingSent.get(po)); if (TM.rttS[s].length > 5) TM.rttS[s].shift();
    NET.rttLive = Math.max(...tbLive(now).map((k) => tbMed(TM.rttS[k]) || 0));   // the slowest friend still playing
  }
  if (Number.isInteger(pr.s) && typeof pr.i === "string") {
    const log = TM.logs[s];
    for (let k = 0; k * 2 + 1 < pr.i.length; k++) {
      const fr = pr.s + k;
      if (log[fr] !== undefined) continue;
      const a = B64I[pr.i[k * 2]], b = B64I[pr.i[k * 2 + 1]];
      if (a === undefined || b === undefined) break;
      const v = a * 64 + b;
      if (v >= IN_END) break;
      log[fr] = v;
    }
  }
  if (Number.isInteger(pr.fr)) TM.frs[s] = pr.fr;
  tbReadLate(s, pr);
  if (!TM || NET.phase !== "match") return;
  // the lead compares checksums; a match after the repair copy's frame means that friend has it
  if (Array.isArray(pr.ck) && pr.ck.length === 2 && tbLeadSlot(now) === meSlot) {
    const mine = NET.ckMine.get(pr.ck[0]);
    if (mine !== undefined && mine !== pr.ck[1]) tbDesync(pr.ck[0]);
    else if (mine !== undefined && TM.syncSent && pr.ck[0] > TM.syncSent.f) { TM.okAfter[s] = true; tbSyncDone(); }
  }
  const tx = TM.tx;
  if (tx && Array.isArray(pr.sa) && pr.sa[0] === tx.n && Number.isInteger(pr.sa[1])) { TM.acks[s] = Math.max(TM.acks[s] ?? -1, pr.sa[1]); tbSyncNext(); }
  // a Focus ping from my partner (a person): the ring and their name over that foe, on this phone too
  if (s === tbMate(meSlot) && Array.isArray(pr.fp) && Number.isInteger(pr.fp[0]) && pr.fp[0] > TM.fpSeen) {
    TM.fpSeen = pr.fp[0];
    if (tbFoes(meSlot).includes(pr.fp[1])) tbPingShow(pr.fp[1], s);
  }
}
// what any friend's presence may carry about the match itself: claims (someone dropped) and repair copy pieces
function tbReadLate(s, pr) {
  if (pr.m !== NET.matchId) return;
  if (Array.isArray(pr.cl)) for (const c of pr.cl) { tbClaim(c); if (!TM || NET.phase !== "match") return; }
  if (pr.sync && typeof pr.sync === "object" && s < meSlot) tbSyncPiece(s, pr.sync);
}
// the people still in the match as this phone sees them: in the room, not handed to a CPU, heard within TB_SILENT
function tbLive(now) {
  now = now || performance.now();
  return TB_SEATS.filter((s) => tbPerson(s) && (s === meSlot || (!TM.gone[s] && now - TM.heard[s] <= TB_SILENT)));
}
const tbLeadSlot = (now) => tbLive(now)[0];
/* Drops. A friend who left the room, or was not heard for TB_SILENT: the lead hands their fighter to a CPU from the first frame it has no
   input of theirs for, and passes on their last TB_RELAY inputs so a phone that missed some can still play up to that frame. When two or
   more friends go quiet at once and nobody is heard any more, this phone is the one cut off: it plays on alone (Connection lost). */
function tbLead(now) {
  const others = TB_SEATS.filter((s) => s !== meSlot && tbPerson(s));
  const out = others.filter((s) => TM.gone[s] || now - TM.heard[s] > TB_SILENT);
  if (!out.length) return;
  if (out.length === others.length && out.filter((s) => !TM.gone[s]).length >= 2) { tbSolo(); return; }
  if (tbLeadSlot(now) !== meSlot) return;
  for (const s of out) {
    const log = TM.logs[s];
    let F = NET.frame;
    while (log[F] !== undefined) F++;
    const from = Math.max(0, F - TB_RELAY);
    let str = "";
    for (let k = from; k < F; k++) str += packIn(log[k] === undefined ? NEUTRAL : log[k]);
    TM.cl.push([s, F, from, str]);
    tbCpuFrom(s, F);
  }
  namedPresence({ cl: TM.cl.slice() });
}
function tbClaim(c) {
  if (!Array.isArray(c) || !TB_SEATS.includes(c[0]) || !Number.isInteger(c[1]) || c[1] < 0 || !TM.hum[c[0]]) return;
  const [s, F, from, str] = c;
  if (s === meSlot) { tbSolo(); return; }   // the others no longer hear me: I play on alone
  if (TM.cpuFrom[s] !== undefined && TM.cpuFrom[s] <= F) return;
  if (Number.isInteger(from) && from >= 0 && typeof str === "string") {
    for (let k = 0; k * 2 + 1 < str.length && from + k < F; k++) {
      const a = B64I[str[k * 2]], b = B64I[str[k * 2 + 1]];
      if (a === undefined || b === undefined || a * 64 + b >= IN_END) break;
      if (TM.logs[s][from + k] === undefined) TM.logs[s][from + k] = a * 64 + b;
    }
  }
  tbCpuFrom(s, F);
}
function tbCpuFrom(s, F) {
  const first = TM.cpuFrom[s] === undefined;
  TM.cpuFrom[s] = first ? F : Math.min(TM.cpuFrom[s], F);
  if (first) tbDropShow(s);
}
// a friend dropped: the banner, their card's tag reads CPU, the markers come back for 3 s
function tbDropShow(s) {
  tbTags();
  if (!G || (G.phase !== "countdown" && G.phase !== "play") || mode !== "match") return;
  showBanner(`${match.names[s] || "A friend"} dropped`, `CPU has ${G.fighters[s].spec.name} now`, "fin", 2200, TEAM_COL[tbTeam(s)]);
  tagShow();
}
// this phone hears nobody: every other person's fighter goes to a CPU here, from the frames they are missing, and the match goes on
function tbSolo() {
  if (!TM || TM.solo) return;
  TM.solo = true; TM.lost = true;
  for (const s of TB_SEATS) {
    if (s === meSlot || !tbPerson(s)) continue;
    let F = NET.frame;
    while (TM.logs[s][F] !== undefined) F++;
    TM.cpuFrom[s] = F;
  }
  if (TM.tx) { TM.tx = null; TM.syncSent = null; }
  leaveMatchRoom();
  NET.rtt = NET.rttLive = 0;
  $("netBadge").hidden = true;
  tbTags();
  if (mode === "match" && G && (G.phase === "countdown" || G.phase === "play")) {
    showBanner("Connection lost", "CPUs play your friends' seats", "fin", 2400, "#f3d9a4");
    tagShow();
  }
}

/* ----- the repair copy: { g: the game, b: the CPUs' memory by seat, r: their random counter, c: the CPU takeovers }, in pieces ----- */
function tbCopy() {
  const b = {};
  for (const s of TB_SEATS) if (TM.bots[s]) b[s] = BL.botSave(G, TM.bots[s]);
  return { g: serialize(G), b, r: G.rng.s | 0, c: TB_SEATS.filter((s) => TM.cpuFrom[s] !== undefined).map((s) => [s, TM.cpuFrom[s]]) };
}
function tbDesync(F) {
  if (TM.syncSent && TM.syncSent.f >= F) return;
  if (TM.tx && !TM.tx.done && performance.now() - TM.tx.t < 5000) return;
  NET.desyncs++; NET.syncN++;
  TM.syncSent = { n: NET.syncN, f: NET.frame }; TM.okAfter = [];
  const txt = JSON.stringify(tbCopy()), parts = [], size = window.__blSyncPart || TB_PART;   // __blSyncPart: tests only
  for (let i = 0; i < txt.length; i += size) parts.push(txt.slice(i, i + size));
  TM.tx = { n: NET.syncN, f: NET.frame, parts, k: 0, t: performance.now(), done: false };
  TM.acks = [];
  NET.syncLast = parts.length; NET.syncF = NET.frame;   // read by tests/pwon2v2.py
  tbSyncPart(0);
}
function tbSyncPart(k) {
  const tx = TM.tx;
  tx.k = k; tx.t = performance.now();
  namedPresence({ sync: { n: tx.n, f: tx.f, k, of: tx.parts.length, d: tx.parts[k] } });
}
// the next piece once every friend still here has the one up now
function tbSyncNext() {
  const tx = TM.tx;
  if (!tx || tx.done) return;
  if (!tbLive().every((s) => s === meSlot || (TM.acks[s] ?? -1) >= tx.k)) return;
  if (tx.k + 1 < tx.parts.length) tbSyncPart(tx.k + 1); else tx.done = true;
}
function tbSyncDone() {
  if (!TM.syncSent || !tbLive().every((s) => s === meSlot || TM.okAfter[s])) return;
  TM.syncSent = null; TM.tx = null; namedPresence({ sync: null });
}
function tbSyncPiece(from, sy) {
  if (!Number.isInteger(sy.n) || sy.n <= TM.lastSync[from] || !Number.isInteger(sy.f) || !Number.isInteger(sy.k) || !Number.isInteger(sy.of) ||
    sy.of < 1 || sy.of > 16 || sy.k < 0 || sy.k >= sy.of || typeof sy.d !== "string") return;
  if (!TM.rx[from] || TM.rx[from].n !== sy.n) TM.rx[from] = { n: sy.n, f: sy.f, of: sy.of, parts: [] };
  const rx = TM.rx[from];
  if (rx.parts[sy.k] === undefined) { rx.parts[sy.k] = sy.d; namedPresence({ sa: [sy.n, sy.k] }); }
  for (let i = 0; i < rx.of; i++) if (rx.parts[i] === undefined) return;
  TM.rx[from] = null; TM.lastSync[from] = rx.n;
  let c = null;
  try { c = JSON.parse(rx.parts.join("")); } catch (e) { console.warn("resync copy unreadable", e); }
  if (c && c.g && Number.isInteger(rx.f)) tbApplySync(c, rx.f);
}
function tbApplySync(c, f) {
  try {
    const cur = NET.frame;
    restore(G, c.g);
    G.rng.s = c.r | 0;
    for (const s of TB_SEATS) {
      const o = c.b && c.b[s];
      if (!o) { TM.bots[s] = undefined; continue; }   // a CPU that takes over later than the copy starts fresh then, as on the lead's phone
      const bot = TM.bots[s] || makeBot(TM.d, BL.BOT_STYLES[G.fighters[s].spec.id]);
      BL.botLoad(G, bot, o); TM.bots[s] = bot;
    }
    if (Array.isArray(c.c)) for (const x of c.c) if (Array.isArray(x) && x[0] !== meSlot && TB_SEATS.includes(x[0]) && TM.hum[x[0]] && Number.isInteger(x[1])) tbCpuFrom(x[0], x[1]);
    for (const k of [...NET.ckMine.keys()]) if (k > f) NET.ckMine.delete(k);
    if (NET.ckSend && NET.ckSend[0] > f) NET.ckSend = null;
    NET.frame = f;
    if (cur > f) {   // replay the logged inputs (and the CPUs) back up to where this phone was
      for (let fr = f; fr < cur; fr++) {
        const ins = tbInputs(fr);
        if (!ins) break;
        step(G, ins); G.events.length = 0;
        NET.frame = fr + 1;
        if ((fr + 1) % 60 === 0) { const h = tbHash(); NET.ckMine.set(fr + 1, h); NET.ckSend = [fr + 1, h]; }
      }
    } else while (NET.myLog.length < NET.frame + NET.D) NET.myLog.push(NEUTRAL);
    NET.desyncs++;
  } catch (e) { console.warn("resync failed", e); }
}

/* ----- Focus: a CPU partner goes after the foe you tap (on every phone, through your inputs); a person as partner sees a ping ----- */
function tbFocus(slot) {
  if (!TM || !G || !tbFoes(meSlot).includes(slot) || G.fighters[slot].state === "gone" || G.phase === "over") return;
  if (!tbHuman(tbMate(meSlot), NET.frame)) {
    TM.focusQ = tbFoes(meSlot).indexOf(slot); TM.focusF = NET.frame;
    Sfx.ui(); return;
  }
  const now = performance.now();
  if (now - TM.pingT < TB_PING || TM.solo) return;
  TM.pingT = now; TM.fp++;
  namedPresence({ fp: [TM.fp, slot] });
  tbPingShow(slot, meSlot);
}
function tbFocusNext() {
  if (!TM || !G) return;
  const cur = tbFocused(), foes = tbFoes(meSlot).filter((i) => G.fighters[i].state !== "gone");
  if (foes.length) tbFocus(foes[(foes.indexOf(cur) + 1) % foes.length]);
}
// the foe with the ring on its card: a live ping, a tap on its way, or the CPU partner's Focus (-1: none)
function tbFocused() {
  if (!TM || !G) return -1;
  if (TM.ping && performance.now() - TM.ping.t0 < TB_PING) return TM.ping.slot;
  if (TM.focusQ >= 0) return tbFoes(meSlot)[TM.focusQ];
  const m = tbMate(meSlot), b = TM.bots[m];
  return b && !tbHuman(m, NET.frame) && b.focusT > G.t ? b.focus : -1;
}
function tbPingShow(slot, by) {
  TM.ping = { slot, by, t0: performance.now() };
  Sfx.tone(880, 1320, 0.08, "triangle", 0.05);
}
// the ping's marker over the foe: "JONNY ▼" in the pinger's team colour (drawn like NICE!, effects.js), 3 s
function drawTbPing(c, g) {
  const P_ = TM && TM.ping;
  if (!P_) return;
  const t = (performance.now() - P_.t0) / TB_PING, f = g.fighters[P_.slot];
  if (t >= 1 || !f) { if (t >= 1) TM.ping = null; return; }
  if (f.state === "dead" || f.state === "gone") return;
  const k = 1 / cam.z, who = P_.by === meSlot ? "YOU" : (match.names[P_.by] || "FRIEND").toUpperCase(), label = (who.length > 10 ? who.slice(0, 10) : who) + " ▼";
  const pop = t < 0.08 ? 0.5 + (t / 0.08) * 0.6 : t < 0.15 ? 1.1 - ((t - 0.08) / 0.07) * 0.1 : 1;
  c.save();
  c.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
  c.translate(f.x, f.y - f.s.h - 50 * k - Math.sin(t * Math.PI * 6) * 3 * k);
  c.scale(k * pop, k * pop);
  c.font = '900 15px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
  c.lineWidth = 5; c.strokeStyle = "rgba(14,16,34,.9)"; c.strokeText(label, 0, 0);
  c.fillStyle = TEAM_COL[tbTeam(P_.by)]; c.fillText(label, 0, 0);
  c.restore();
}

/* ----- names on the cards and the markers; TAG TEAM! ----- */
// a card's tag: the friend's name, or CPU (a CPU seat, or a friend who dropped)
const tbTag = (s) => (s === meSlot ? "You" : tbPerson(s) ? match.names[s] || "Friend" : "CPU");
// the line under a card's tag: a CPU's potato name, or the name of the friend a CPU took over from
const tbSub = (s) => (s === meSlot || tbPerson(s) ? "" : match.names[s] || "");
// the marker over a fighter (draw-world.js duoTags)
const tbMark = (s) => (s === meSlot ? "YOU" : tbPerson(s) ? (match.names[s] || "Friend").toUpperCase().slice(0, 10) : "CPU");
function tbTags() {
  if (mode !== "match" || !match || !match.tb || !G) return;
  for (const s of TB_SEATS) {
    const el = $("pc" + cardSlot.indexOf(s));
    if (!el) continue;
    el.querySelector(".pc-tag").textContent = tbTag(s);
    const sub = el.querySelector(".pc-sub");
    if (sub) { const t = tbSub(s), tr = sub.querySelector(".tr"); sub.hidden = !t; sub.querySelector(".nm").textContent = t; if (tr) tr.textContent = ""; }
  }
}
// a name for the lines (countdown, results): You, the friend's name, CPU and the potato name (a friend who dropped: their name, CPU)
const tbWho = (s) => (s === meSlot ? "You" : !TM.hum[s] ? `CPU ${match.names[s]}` : tbPerson(s) ? match.names[s] || "Friend" : `${match.names[s] || "Friend"} (CPU)`);
function tbVs() {
  const m = tbMate(meSlot), [a, b] = tbFoes(meSlot);
  return `You & ${tbWho(m)} vs ${tbWho(a)} & ${tbWho(b)}`;
}
// both teammates hit the same foe within half a second: TAG TEAM! over that foe in your team's colour (your team's tags only; UI only)
function tbEvent(g, e, live) {
  if (!live || !TM) return;
  if (e.type === "lethal" && e.final) { TM.finBy = e.by; return; }
  if (e.type !== "hit" || !Number.isInteger(e.def) || e.boss) return;
  const a = g.fighters[e.slot], d = g.fighters[e.def];
  if (!a || !d || a.team === d.team || a.team !== g.fighters[meSlot].team) return;
  const prev = TM.hits[e.def];
  if (prev && prev.by !== e.slot && g.t - prev.t <= 30 && g.t - (TM.tagT[e.def] ?? -999) > 60) {
    TM.tagT[e.def] = g.t;
    chgPops.push({ x: e.x, y: e.y - 34, t: 0, pop: 1, col: TEAM_COL[a.team], txt: "TAG TEAM!" });
    Sfx.tone(700, 1050, 0.12, "triangle", 0.05);
  }
  TM.hits[e.def] = { by: e.slot, t: g.t };
}

/* ----- the end: results, chips, rematch and back to the board ----- */
function tbFinish() {
  const me = G.fighters[meSlot], m = tbMate(meSlot), foes = tbFoes(meSlot), lv = match.lv;
  const res = G.winner === me.team ? 1 : Number.isInteger(G.winner) && G.winner >= 0 ? 0 : 0.5;
  const people = foes.filter((s) => tbPerson(s)).length;   // people still among the foes at the end: friend-match pay
  const op = G.fighters[foes[1]].kos > G.fighters[foes[0]].kos ? G.fighters[foes[1]] : G.fighters[foes[0]];
  const R = { res, online: true, otb: true, me, op,   // otb: an online team brawl (R.ta / R.tb are a ranked match's tiers)
    lines: [], total: 0, conn: TM.lost, mateFin: TM.finBy === m && res === 1,
    duo: { mate: G.fighters[m], foes: foes.map((s) => G.fighters[s]), names: match.names, lv: match.level, caught: match.caught } };
  if (people) {
    if (res === 1) R.lines.push([people === 2 ? "Win against friends" : "Win against a friend", 15]);
    else if (res === 0.5) R.lines.push(["Draw", 8]);
    else R.lines.push(["Match played", 5]);
    if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 2]);
    P.friendW = (P.friendW || 0) + (res === 1 ? 1 : 0); P.friendL = (P.friendL || 0) + (res === 0 ? 1 : 0);
  } else if (res === 1 && lv === 2) R.lines.push(["Win vs Hard CPUs", DUO_CHIPS]);
  R.total = R.lines.reduce((a, l) => a + l[1], 0);
  P.tokens += R.total;
  if (res === 1) P.duoW = (P.duoW | 0) + 1;
  if (match.caught) P.duoC = (P.duoC | 0) + match.caught;
  if (res === 1 && P.duoW === DUO_TITLE) R.title = "Dynamic Duo";
  saveProfile();
  R.whyNo = `Against two CPUs only a win on Hard pays chips (${DUO_CHIPS}).`;
  if (match.finBy && R.mateFin) match.finBy += ` · by ${tbWho(m)}`;
  TM.again = 0;
  if (TM.solo) { leaveMatchRoom(); NET.phase = "idle"; } else NET.phase = "result";
  $("netBadge").hidden = true;
  showResults(R);
  lobbyPresence();
  tbAgainLabel();
}
// the results' kicker and story line
function tbResMode(R) {
  if (R.conn) return "Team brawl · connection lost";
  const m = tbMate(meSlot);
  if (TM.hum[m]) return `Team brawl · with ${tbWho(m)}`;
  const ppl = tbFoes(meSlot).filter((s) => TM.hum[s]).map((s) => match.names[s] || "Friend");
  return ppl.length ? `Team brawl · vs ${ppl.join(" and ")}` : `Team brawl · ${match.level} CPUs`;
}
function tbResLine(R) {
  const m = tbMate(meSlot), [a, b] = tbFoes(meSlot), how = G.sudden && G.endReason === "stocks" ? " in sudden death" : G.endReason === "time" ? " on time" : "";
  const us = ["You and ", { b: tbWho(m) }], them = [{ b: tbWho(a) }, " and ", { b: tbWho(b) }];
  let line;
  if (R.res === 1) {
    line = [...us, " beat ", ...them, `${how}.`];
    if (TM.finBy === meSlot) line.push(" You landed the final launch.");
    else if (TM.finBy === m) line.push(" ", { b: tbWho(m) }, " landed the final launch.");
  } else if (R.res === 0) line = [...them, " beat you and ", { b: tbWho(m) }, `${how}.`];
  else line = ["Nobody scored a KO in sudden death either."];
  if (R.conn) line.push(" Your connection dropped, so CPUs played your friends' seats.");
  return line;
}
// who is still here for a rematch: the people of this match in the room (not handed to a CPU)
function tbHere() {
  const peers = NET.mr ? NET.mr.peers() : [];
  return TB_SEATS.filter((s) => tbPerson(s) && (s === meSlot || peers.some((p) => p.peer === TM.hum[s])));
}
const tbPresOf = (s) => (s === meSlot ? NET.myPres : (((NET.mr ? NET.mr.peers() : []).find((p) => p.peer === TM.hum[s]) || {}).presence || {}));
function tbResultTick() {
  if (!NET.mr || !TM) return;
  const next = NET.matchId + 1, here = tbHere(), peers = NET.mr.peers();
  const sig = JSON.stringify(here.map((s) => [s, tbPresOf(s).rm, tbPresOf(s).bk]));
  if (sig !== TM.again) { TM.again = sig; tbAgainLabel(); }
  // a start that includes me: a rematch I asked for, or the host's START from the board
  for (const p of peers) {
    const st = p.presence && p.presence.start;
    if (NET.rm === next && tbValidStart(st) && st.id === next && st.h.includes(tbMe())) { tbStartMatch(st); return; }
  }
  const host = NET.tb && NET.role !== "host" && peers.find((p) => p.peer === NET.tb.host), go = host && host.presence && host.presence.go;
  if (go && Number.isInteger(go.id) && go.id > NET.startSeen && tbValidBd(go.bd) && go.bd.includes(tbMe())) { NET.phase = "handshake"; tbHsBegin(go); return; }
  // every person still here asked for a rematch and nobody went back to the board: the lowest seat starts it
  if (NET.rm !== next || here[0] !== meSlot || here.some((s) => tbPresOf(s).rm !== next || tbPresOf(s).bk === NET.matchId)) return;
  const prev = TM.st, h = prev.h.map((p, s) => (here.includes(s) ? p : null)), nm = prev.nm.slice();
  h.forEach((p, s) => { if (!p && !nm[s]) nm[s] = cpuNameNot(nm); });
  const st = Object.assign({}, prev, { id: next, seed: (Math.random() * 1e9) | 0, h, nm });
  namedPresence({ start: st });
  tbStartMatch(st);
}
function tbAgain() {
  if (TM.solo || !NET.mr) {   // the connection dropped: Retry vs CPU (an offline Team Brawl with the same partner and level)
    const mate = G.fighters[tbMate(meSlot)].spec.id, lv = TB_LV[match.lv];
    resetNet(); NET.phase = "idle"; lobbyPresence();
    startDuo({ partner: mate, level: lv });
    return;
  }
  NET.rm = NET.matchId + 1;
  namedPresence({ rm: NET.rm });
  $("rAgain").disabled = true;
  tbAgainLabel();
}
// the Rematch line: who is ready and who we wait for; someone back at the board ends the rematch
function tbAgainLabel() {
  if (mode !== "result" || !match || !match.tb || !TM) return;
  const btn = $("rAgain"), sub = $("rAgainSub");
  if (TM.solo || !NET.mr) { btn.querySelector("span").textContent = "Retry vs CPU"; btn.disabled = false; sub.textContent = ""; return; }
  btn.querySelector("span").textContent = "Rematch";
  const here = tbHere().filter((s) => s !== meSlot), next = NET.matchId + 1;
  const left = TB_SEATS.filter((s) => s !== meSlot && TM.hum[s] && !here.includes(s)).map((s) => match.names[s] || "A friend");
  const board = here.filter((s) => tbPresOf(s).bk === NET.matchId).map((s) => match.names[s] || "A friend");
  if (board.length) { btn.disabled = true; sub.textContent = `${board.join(" and ")} went back to the board`; return; }
  const ready = here.filter((s) => tbPresOf(s).rm === next).map((s) => match.names[s] || "Friend");
  const wait = here.filter((s) => tbPresOf(s).rm !== next).map((s) => match.names[s] || "Friend");
  btn.disabled = NET.rm === next;
  const parts = [];
  if (left.length) parts.push(`${left.join(" and ")} left · ${left.length > 1 ? "CPUs take the seats" : "CPU takes the seat"}`);
  if (ready.length) parts.push(`${ready.join(" and ")} ready`);
  if (NET.rm === next && wait.length) parts.push(`waiting for ${wait.join(" and ")}`);
  sub.textContent = parts.join(" · ");
}
// Board: back to the seats in the same room (the host's brawl is listed again with its free seats)
function tbBoard() {
  if (!TM || TM.solo || !NET.mr) { leaveMatchRoom(); resetNet(); NET.phase = "idle"; openOnline(); return; }
  const here = tbHere(), hum = TM.hum;
  NET.rm = 0; TM = null;
  if (NET.role === "host") {
    NET.tb.bd = hum.map((p, s) => (here.includes(s) ? p : null));
    NET.phase = "hosting"; NET.tb.sig = "";
    namedPresence({ rm: null, bk: NET.matchId, start: null, tb: tbPres() });
    tbSeat(NET.mr.peers());
  } else {
    NET.phase = "board"; NET.tb.sig = "";
    namedPresence({ rm: null, bk: NET.matchId });
  }
  lobbyPresence();
  openOnline();
}
// the room went away during the results: no rematch any more, the board is gone too
function tbRoomLost() {
  if (NET.phase === "match") { tbSolo(); return; }
  if (NET.phase === "result" && TM) { TM.solo = true; leaveMatchRoom(); tbAgainLabel(); return; }
  leaveMatchRoom(); resetNet(); NET.phase = "idle"; NET.note = "The match connection dropped.";
  if (mode === "online") renderOnline();
}
