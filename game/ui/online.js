/* ===================== online play =====================
   Built on the page's `room` capability: everyone with this page open shares a lobby;
   each match is a named room. Both phones run the same deterministic simulation in
   lockstep and exchange only inputs, carried in each player's presence object
   (presence is coalesced, so it always carries a short history of recent frames).
   A small input delay, sized from the measured ping, hides the network round trip.
   Checksums every second catch any divergence; the host then sends a full snapshot. */
/* Bumped whenever a change could make two copies of the game simulate differently,
   so a friend with an older copy open is told to reload instead of joining and drifting apart. */
const PROTO = 5;
const NET = {
  room: null, user: null, tried: false, ok: false, connected: false, dead: null,
  myPeer: null, myName: "", oppName: "", lobbyPeers: [], note: "",
  mr: null, mrCode: null, unsubs: [], myPres: {}, role: null, hostCode: null,
  phase: "idle", oppPeer: null, oppBy: null, lastOpp: null, joinT: 0,
  matchId: 0, startSeen: 0, pingSent: new Map(), pingSeen: new Set(), pings: [], pingT: 0, hsT: 0, lastStart: null,
  D: 6, frame: 0, myLog: [], opLog: [], oppFrame: 0, stall: 0, ckMine: new Map(), ckSend: null,
  syncN: 0, syncSent: null, lastSync: 0, desyncs: 0, rm: 0, oppLeft: false,
  standalone: !!window.__blStandalone, invite: null, inviteT: 0,
};
{
  const jm = /^#join-([a-z0-9][a-z0-9_.-]{2,47})$/.exec(location.hash || "");
  if (jm) { NET.invite = jm[1]; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* sandboxed */ } }
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64I = Object.fromEntries([...B64].map((ch, i) => [ch, i]));
const NEUTRAL = 1280;
function encIn(i) {
  const qx = clamp(Math.round(i.x * 4), -4, 4), qy = clamp(Math.round(i.y * 4), -4, 4);
  return ((qx + 4) * 9 + (qy + 4)) * 32 + (i.jump ? 1 : 0) + (i.light ? 2 : 0) + (i.heavy ? 4 : 0) + (i.special ? 8 : 0) + (i.dodge ? 16 : 0);
}
function decIn(v) {
  const b = v & 31, q = v >> 5;
  return { x: (Math.floor(q / 9) - 4) / 4, y: ((q % 9) - 4) / 4, jump: !!(b & 1), light: !!(b & 2), heavy: !!(b & 4), special: !!(b & 8), dodge: !!(b & 16) };
}
const packIn = (v) => B64[v >> 6] + B64[v & 63];
function palIdx(id) { const i = P.pal[id] || 0; return P.owned[id] && P.owned[id].includes(i) ? i : 0; }

async function netInit() {
  if (NET.tried) return;
  NET.tried = true;
  try {
    const c = window.claude && typeof window.claude.use === "function" ? window.claude : null;
    if (c) [NET.room, NET.user] = await Promise.all([c.use("room"), c.use("user")]);
  } catch (e) { NET.room = null; }
  NET.ok = !!NET.room;
  if (!NET.ok) { renderOnline(); return; }
  NET.room.onConnection((on) => { NET.connected = on; renderOnline(); }, (err) => { NET.ok = false; NET.dead = err.code; renderOnline(); });
  NET.room.onPeers((ch) => {
    NET.lobbyPeers = ch.peers;
    const me = ch.peers.find((p) => p.sameTab);
    if (me) NET.myPeer = me.peer;
    renderOnline();
  });
  if (NET.user) { try { NET.myName = (await NET.user.me()).name || ""; } catch (e) { /* no name */ } }
  lobbyPresence();
  renderOnline();
}
function lobbyPresence() {
  if (!NET.room || !NET.ok) return;
  const busy = NET.phase === "match" || NET.phase === "handshake" || NET.phase === "result";
  const hosting = NET.phase === "hosting";
  NET.room.presence({ v: PROTO, f: sel.fighter, host: hosting ? NET.hostCode : null, r: hosting ? P.rules : null, busy }).catch(() => {});
}
function buildRules() {
  const edit = NET.phase === "idle" || NET.phase === "hosting";
  // rebuild only on change, so a tap is never lost to a re-render
  const sig = JSON.stringify(P.rules) + edit + NET.phase, box = $("onRules");
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  for (const [k, id, label] of [["l", "ruleL", (v) => String(v)], ["t", "ruleT", (v) => (v ? v + " min" : "No limit")], ["b", "ruleB", (v) => (v === 3 ? "Best of 3" : "Single")]]) {
    const row = $(id); row.innerHTML = "";
    for (const v of RULES[k]) {
      const b = document.createElement("button");
      b.className = "chip" + (P.rules[k] === v ? " on" : ""); b.textContent = label(v); b.disabled = !edit;
      b.addEventListener("click", () => {
        Sfx.init(); Sfx.ui(); P.rules = Object.assign({}, P.rules, { [k]: v }); saveProfile(); buildRules();
        if (NET.phase === "hosting") { namedPresence({ r: P.rules }); lobbyPresence(); }
      });
      row.appendChild(b);
    }
  }
}
function namedPresence(patch) {
  if (!NET.mr) return;
  for (const k in patch) { if (patch[k] === null) delete NET.myPres[k]; else NET.myPres[k] = patch[k]; }
  NET.mr.presence(patch).catch((e) => { if (e && e.code === "invalid_argument") console.warn("presence:", e.message); });
}
async function namesFor(peers) {
  const ids = [...new Set(peers.map((p) => p.by).filter(Boolean))];
  let ps = {};
  if (NET.user && ids.length) { try { ps = await NET.user.profiles(ids); } catch (e) { ps = {}; } }
  const out = {};
  for (const p of peers) out[p.peer] = (p.by && ps[p.by] && ps[p.by].name) || (p.sameTab ? NET.myName || "You" : "Friend");
  return out;
}
async function resolveOppName() {
  const peers = NET.mr ? NET.mr.peers().filter((p) => p.peer === NET.oppPeer) : [];
  if (!peers.length) return;
  const n = await namesFor(peers);
  NET.oppName = n[NET.oppPeer] || "Friend";
  if (mode === "match" && match && match.online) $("pc" + (1 - meSlot)).querySelector(".pc-tag").textContent = NET.oppName;
}

function openOnline() {
  mode = "online"; G = null; match = null; meSlot = 0;
  if (NET.invite && !NET.inviteT) NET.inviteT = performance.now();
  show("online");
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  modal("pause", false); modal("help", false);
  resize();
  netInit().then(() => { lobbyPresence(); renderOnline(); });
  renderOnline();
}
function hideOnline() { screens.online.hidden = true; }
let onSeq = 0;
async function renderOnline() {
  if (mode !== "online") return;
  const seq = ++onSeq;
  const st = $("onStatus"), hostBtn = $("onHost"), note = $("onNote"), list = $("onList");
  $("onTokens").textContent = P.tokens;
  buildRules();
  const spec = FIG[sel.fighter];
  $("onMyFighter").textContent = `${spec.name} · ${spec.role}`;
  if (NET.tried && !NET.ok) {
    st.textContent = NET.dead ? "Disconnected from online play" : "Online play isn't available here";
    st.className = "kicker on-status bad";
    hostBtn.disabled = true;
    $("onMyName").textContent = "You";
    list.innerHTML = ""; list.dataset.sig = "";
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = NET.standalone ? "Online play needs the game's web link. A downloaded copy can't reach other players." : "Online play works when this page is open in Claude and you're signed in. It doesn't work from a public link or a downloaded copy.";
    list.appendChild(li);
    $("onHere").textContent = "";
    note.textContent = ""; note.className = "on-note";
    return;
  }
  const peers = NET.lobbyPeers.filter((p) => p.kind === "viewer");
  const others = peers.filter((p) => !p.sameTab);
  st.textContent = !NET.tried ? "Connecting" : NET.connected ? `Online · ${peers.length || 1} here` : "Connecting";
  st.className = "kicker on-status" + (NET.connected ? " ok" : "");
  const names = await namesFor(peers);
  if (seq !== onSeq || mode !== "online") return;
  $("onMyName").textContent = NET.myName || "You";
  const nameIn = $("onName");
  $("onMyName").hidden = NET.standalone; nameIn.hidden = !NET.standalone;
  if (NET.standalone && document.activeElement !== nameIn) nameIn.value = NET.myName;
  // build off-DOM and swap in only when something changed, so a tap on "Join" is never lost to a re-render
  const frag = document.createDocumentFragment();
  let hosts = others.filter((p) => p.presence && typeof p.presence.host === "string" && !p.presence.busy);
  if (NET.invite) {
    const inv = hosts.find((h) => h.presence.host === NET.invite);
    if (inv) hosts = [inv, ...hosts.filter((h) => h !== inv)];
    else {
      const li = document.createElement("li"); li.className = "empty";
      li.textContent = performance.now() - NET.inviteT < 6000 ? "Looking for your friend's match…" : "That invite's match isn't open anymore. Ask your friend for a new link.";
      frag.appendChild(li);
    }
  }
  if (!hosts.length && !NET.invite) {
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = NET.phase === "hosting" ? "No other open matches." : NET.standalone ? "No open matches yet. Host one and send your friend the link." : "No open matches yet. Host one, or ask a friend to.";
    frag.appendChild(li);
  }
  for (const h of hosts) {
    const li = document.createElement("li");
    if (NET.invite && h.presence.host === NET.invite) li.className = "invited";
    const who = document.createElement("div"); who.className = "who";
    const b = document.createElement("b"); b.textContent = names[h.peer] || "Friend";
    const sp = document.createElement("span"); const hf = FIG[h.presence.f];
    const old = h.presence.v !== PROTO;
    if (old) li.classList.add("old");
    sp.textContent = old ? "Different game version. Both of you reload the page." :
      (NET.invite && h.presence.host === NET.invite ? "Invited you · " : "") + (hf ? hf.name : "Fighter") + (validRules(h.presence.r) ? ` · ${ruleText(h.presence.r)}` : "");
    who.append(b, sp);
    const btn = document.createElement("button"); btn.className = "chip";
    const joining = NET.phase === "joining" && NET.mrCode === h.presence.host;
    btn.textContent = joining ? "Joining" : "Join";
    btn.disabled = old || joining || NET.phase === "handshake" || !NET.connected;
    btn.addEventListener("click", () => { Sfx.init(); Sfx.ui(); goFull(); netJoin(h.presence.host); });
    li.dataset.h = h.presence.host; li.append(who, btn); frag.appendChild(li);
  }
  const sig = [...frag.childNodes].map((li) => `${li.className}:${li.dataset.h || ""}:${li.textContent}:${li.querySelector("button") ? li.querySelector("button").disabled : ""}`).join("|");
  if (list.dataset.sig !== sig) { list.replaceChildren(frag); list.dataset.sig = sig; }
  $("onHere").textContent = others.length
    ? others.map((p) => `${names[p.peer] || "Friend"}${p.presence && p.presence.busy ? " (in a match)" : ""}`).join(", ")
    : "Just you. Friends show up here when they open this page.";
  hostBtn.disabled = !NET.connected || NET.phase === "joining" || NET.phase === "handshake";
  hostBtn.querySelector("span").textContent = NET.phase === "hosting" ? "Cancel" : "Host a match";
  note.className = "on-note" + (NET.phase !== "idle" ? " live" : "");
  note.textContent =
    NET.phase === "hosting" ? "Waiting for a challenger. Your match is listed for everyone here." :
    NET.phase === "joining" ? "Joining…" :
    NET.phase === "handshake" ? `Connecting to ${NET.oppName || "your friend"}…` :
    NET.note || (NET.standalone ? "Pick the rules, host, then send your friend the link." : "Pick the rules and host. Your friends see the match in their list.");
  const inv = $("onInvite");
  inv.hidden = !(NET.standalone && NET.phase === "hosting" && NET.hostCode);
  if (!inv.hidden) {
    $("onLink").textContent = inviteLink();
    $("onShare").hidden = !navigator.share;
  }
  $("onHelp").textContent = NET.standalone
    ? "No account needed. Matches connect while both of you have the page open."
    : "Friends need a Claude account and access to this page. Share it from the page's Share menu, then you both open it and pick Play friends. A public link won't connect.";
}
function inviteLink() { return location.origin + location.pathname + "#join-" + NET.hostCode; }
function onlineArtFighter() {
  const spec = FIG[sel.fighter], o = onlineArtFighter;
  if (!o.f || o.f.spec !== spec || o.pi !== palIdx(spec.id)) {
    o.pi = palIdx(spec.id);
    o.f = newGame({ players: [{ spec, pal: spec.palettes[o.pi] }, { spec, pal: spec.palettes[0] }], countdown: 1 }).fighters[0];
    o.f.x = 0; o.f.y = 0;
  }
  return o.f;
}
function drawOnlineArt(tk) {
  if (R3.on) return;
  const cvA = $("onArt"); if (!cvA || !cvA.clientWidth) return;
  onlineArtFighter();
  const w = Math.round(cvA.clientWidth * DPR), h = Math.round(cvA.clientHeight * DPR);
  if (cvA.width !== w || cvA.height !== h) { cvA.width = w; cvA.height = h; }
  const c = cvA.getContext("2d"); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
  const f = onlineArtFighter.f, sc = (h * 0.8) / f.s.h;
  c.setTransform(sc, 0, 0, sc, w * 0.5, h * 0.92);
  drawFighter(c, f, tk);
}

async function openMatchRoom(code) {
  const mr = await NET.room.join(code);
  NET.mr = mr; NET.mrCode = code; NET.myPres = {};
  NET.unsubs = [mr.onPeers(onMatchPeers, () => { if (NET.mr === mr) matchRoomLost(); })];
}
function leaveMatchRoom() {
  const mr = NET.mr;
  NET.unsubs.forEach((u) => { try { u(); } catch (e) { /* gone */ } });
  NET.unsubs = []; NET.mr = null; NET.mrCode = null; NET.myPres = {};
  if (mr) mr.leave().catch(() => {});
}
function resetNet() {
  Object.assign(NET, { role: null, hostCode: null, oppPeer: null, oppBy: null, oppName: "", lastOpp: null, matchId: 0, startSeen: 0,
    pings: [], pingT: 0, hsT: 0, rm: 0, lastSync: 0, syncSent: null, oppLeft: false, lastStart: null });
  NET.pingSent = new Map(); NET.pingSeen = new Set();
}
function netCancel() { leaveMatchRoom(); resetNet(); NET.phase = "idle"; lobbyPresence(); renderOnline(); }
async function netHost() {
  if (!NET.ok || NET.phase !== "idle") return;
  const code = "bl" + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, "0");
  resetNet();
  NET.phase = "hosting"; NET.role = "host"; NET.hostCode = code; NET.note = "";
  renderOnline();
  try { await openMatchRoom(code); }
  catch (e) { NET.phase = "idle"; NET.role = null; NET.hostCode = null; NET.note = "Couldn't open a match. Try again."; renderOnline(); return; }
  namedPresence({ role: "host", f: sel.fighter, pi: palIdx(sel.fighter), r: P.rules });
  lobbyPresence(); renderOnline();
}
async function netJoin(code) {
  if (typeof code !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(code)) return;
  if (NET.phase === "hosting") netCancel();
  if (NET.phase !== "idle") return;
  resetNet();
  NET.phase = "joining"; NET.role = "guest"; NET.note = ""; NET.joinT = performance.now();
  NET.mrCode = code;
  renderOnline();
  try { await openMatchRoom(code); }
  catch (e) { NET.phase = "idle"; NET.role = null; NET.mrCode = null; NET.note = "Couldn't join that match."; renderOnline(); return; }
  namedPresence({ role: "guest", f: sel.fighter, pi: palIdx(sel.fighter) });
  if (NET.invite === code) NET.invite = null;
  lobbyPresence(); renderOnline();
}
function matchRoomLost() {
  if (NET.phase === "match") { finishOnline(false, true); return; }
  leaveMatchRoom(); resetNet(); NET.phase = "idle"; NET.note = "The match connection dropped.";
  if (mode === "online") renderOnline();
}
function onMatchPeers(ch) {
  const peers = ch.peers;
  if (NET.role === "host") {
    if (NET.oppPeer && !peers.some((p) => p.peer === NET.oppPeer)) return opponentLeft();
    if (!NET.oppPeer && NET.phase === "hosting") {
      const g = peers.find((p) => !p.sameTab && p.kind === "viewer" && p.presence && p.presence.role === "guest");
      if (g) {
        NET.oppPeer = g.peer; NET.oppBy = g.by; NET.phase = "handshake"; NET.hsT = 0;
        namedPresence({ opp: g.peer }); lobbyPresence(); resolveOppName().then(renderOnline); renderOnline();
      }
    }
  } else if (NET.role === "guest") {
    const host = peers.find((p) => !p.sameTab && p.presence && p.presence.role === "host");
    if (!host) { if (NET.oppPeer) opponentLeft(); return; }
    const opp = host.presence.opp;
    if (NET.phase === "joining" && typeof opp === "string" && opp !== NET.myPeer) { NET.note = "That match just filled up."; netCancel(); return; }
    if (NET.phase === "joining" && opp === NET.myPeer) {
      NET.oppPeer = host.peer; NET.oppBy = host.by; NET.phase = "handshake";
      lobbyPresence(); resolveOppName().then(renderOnline); renderOnline();
    }
  }
}
function opponentLeft() {
  if (NET.phase === "match") { NET.oppLeft = true; finishOnline(true); return; }
  if (NET.phase === "result") { NET.oppLeft = true; $("rAgain").disabled = true; $("rAgain").querySelector("span").textContent = `${NET.oppName || "Your friend"} left`; return; }
  if (NET.role === "host") {
    NET.oppPeer = null; NET.oppBy = null; NET.oppName = ""; NET.phase = "hosting";
    namedPresence({ opp: null, start: null }); lobbyPresence(); renderOnline(); return;
  }
  NET.note = "The host left."; netCancel();
}

function handshakeTick(now) {
  const opp = NET.oppPeer && NET.mr ? NET.mr.peers().find((p) => p.peer === NET.oppPeer) : null;
  if (NET.role === "guest" && NET.phase === "joining" && now - NET.joinT > 8000) { NET.note = "No answer from the host."; netCancel(); return; }
  if (!opp) return;
  const pr = opp.presence || {};
  const echo = typeof pr.pg === "number" ? pr.pg : null;
  if (now - NET.pingT > 110) {
    NET.pingT = now;
    const t = Math.round(now) % 1000000000;
    NET.pingSent.set(t, now);
    if (NET.pingSent.size > 60) NET.pingSent.delete(NET.pingSent.keys().next().value);
    namedPresence({ pg: t, po: echo });
  } else if (echo !== null && NET.myPres.po !== echo) namedPresence({ po: echo });
  if (NET.role === "host") {
    if (!NET.hsT) NET.hsT = now;
    if (typeof pr.po === "number" && NET.pingSent.has(pr.po) && !NET.pingSeen.has(pr.po)) {
      NET.pingSeen.add(pr.po); NET.pings.push(now - NET.pingSent.get(pr.po));
    }
    const waited = now - NET.hsT;
    if (NET.pings.length >= 6 || (waited > 3000 && NET.pings.length) || waited > 7000) {
      const sorted = [...NET.pings].sort((a, b) => a - b);
      const rtt = sorted.length ? sorted[sorted.length >> 1] : 260;
      const pad = typeof window.__blDpad === "number" ? window.__blDpad : 4;
      const D = clamp(Math.ceil((rtt / 2 + pad) / 16.67) + 1, 3, 15);
      const gf = FIG[pr.f] ? pr.f : FIGHTERS[0].id;
      const gpi = Number.isInteger(pr.pi) && pr.pi >= 0 && pr.pi < FIG[gf].palettes.length ? pr.pi : 0;
      const hf = sel.fighter, hpi = palIdx(hf);
      const st = { id: NET.matchId + 1, seed: (Math.random() * 1e9) | 0, d: D, f: [hf, gf], p: [hpi, gf === hf && gpi === hpi ? (gpi + 1) % FIG[gf].palettes.length : gpi], rtt: Math.round(rtt),
        r: Object.assign({}, P.rules), set: { n: 1, w: [0, 0] } };
      NET.lastStart = st;
      namedPresence({ start: st });
      startOnlineMatch(st);
    }
  } else {
    const st = pr.start;
    if (validStart(st) && st.id > NET.startSeen) startOnlineMatch(st);
  }
}
function validStart(st) {
  return st && typeof st === "object" && Number.isInteger(st.id) && Number.isInteger(st.seed) && Number.isInteger(st.d) && st.d >= 1 && st.d <= 20 &&
    Array.isArray(st.f) && st.f.length === 2 && st.f.every((id) => FIG[id]) && Array.isArray(st.p) && st.p.length === 2 &&
    st.p.every((v, i) => Number.isInteger(v) && v >= 0 && v < FIG[st.f[i]].palettes.length) &&
    validRules(st.r) && st.set && Number.isInteger(st.set.n) && st.set.n >= 1 && st.set.n <= 3 && Array.isArray(st.set.w) && st.set.w.length === 2 && st.set.w.every((v) => Number.isInteger(v) && v >= 0 && v <= 2);
}
function startOnlineMatch(st) {
  Object.assign(NET, { matchId: st.id, startSeen: st.id, D: st.d, frame: 0, myLog: [], opLog: [], oppFrame: 0, stall: 0,
    ckMine: new Map(), ckSend: null, syncSent: null, lastSync: 0, rm: 0, lastOpp: null, oppLeft: false, rtt: st.rtt || 0,
    rules: st.r, set: st.set, setRes: null, nextF: null, rttLive: 0, rttS: [], myPg: null, echo: null, pgT: 0 });
  for (let i = 0; i < NET.D; i++) { NET.myLog.push(NEUTRAL); NET.opLog.push(NEUTRAL); }
  const specs = st.f.map((id) => FIG[id]);
  meSlot = NET.role === "host" ? 0 : 1;
  G = newGame({ players: specs.map((spec, i) => ({ spec, pal: spec.palettes[st.p[i]] })), stocks: st.r.l, time: st.r.t * 60, countdown: 150, seed: st.seed });
  match = { online: true, ranked: false, level: null };
  NET.phase = "match";
  namedPresence({ m: st.id, s: 0, i: "", fr: 0, ck: null, sync: null, rm: null, pg: null, po: null, nf: null, np: null });
  lobbyPresence();
  enterMatchUI();
  resolveOppName();
}
function readOpp(pr) {
  if (pr.m !== NET.matchId) return;
  // live ping: echo their stamp back, and time how long ours took to come back
  if (typeof pr.pg === "number") NET.echo = pr.pg;
  if (typeof pr.po === "number" && NET.pingSent.has(pr.po) && !NET.pingSeen.has(pr.po)) {
    NET.pingSeen.add(pr.po);
    NET.rttS.push(performance.now() - NET.pingSent.get(pr.po)); if (NET.rttS.length > 5) NET.rttS.shift();
    NET.rttLive = [...NET.rttS].sort((a, b) => a - b)[NET.rttS.length >> 1];
    if (NET.pingSeen.size > 300) NET.pingSeen.clear();
  }
  if (Number.isInteger(pr.s) && typeof pr.i === "string") {
    for (let k = 0; k * 2 + 1 < pr.i.length; k++) {
      const fr = pr.s + k;
      if (NET.opLog[fr] !== undefined) continue;
      const a = B64I[pr.i[k * 2]], b = B64I[pr.i[k * 2 + 1]];
      if (a === undefined || b === undefined) break;
      const v = a * 64 + b;
      if (v > 2591) break;
      NET.opLog[fr] = v;
    }
  }
  if (Number.isInteger(pr.fr)) NET.oppFrame = pr.fr;
  if (Array.isArray(pr.ck) && pr.ck.length === 2) {
    const mine = NET.ckMine.get(pr.ck[0]);
    if (mine !== undefined && mine !== pr.ck[1]) onDesync(pr.ck[0]);
    else if (mine !== undefined && NET.syncSent && pr.ck[0] > NET.syncSent.f) { NET.syncSent = null; namedPresence({ sync: null }); }
  }
  if (NET.role === "guest" && pr.sync && typeof pr.sync === "object" && Number.isInteger(pr.sync.n) && pr.sync.n > NET.lastSync) applySync(pr.sync);
}
function onDesync(F) {
  if (NET.role !== "host") return;
  if (NET.syncSent && NET.syncSent.f >= F) return;
  NET.desyncs++; NET.syncN++;
  NET.syncSent = { n: NET.syncN, f: NET.frame };
  namedPresence({ sync: { n: NET.syncN, f: NET.frame, st: serialize(G) } });
}
function applySync(sy) {
  NET.lastSync = sy.n;
  if (!Number.isInteger(sy.f) || !sy.st) return;
  try {
    const cur = NET.frame;
    restore(G, sy.st);
    for (const k of [...NET.ckMine.keys()]) if (k > sy.f) NET.ckMine.delete(k);
    if (cur > sy.f) {
      for (let fr = sy.f; fr < cur; fr++) {
        if (NET.myLog[fr] === undefined || NET.opLog[fr] === undefined) break;
        const ins = []; ins[meSlot] = decIn(NET.myLog[fr]); ins[1 - meSlot] = decIn(NET.opLog[fr]);
        step(G, ins); G.events.length = 0;
        if ((fr + 1) % 60 === 0) NET.ckMine.set(fr + 1, checksum(G));
      }
    } else {
      NET.frame = sy.f;
      while (NET.myLog.length < NET.frame + NET.D) NET.myLog.push(NEUTRAL);
    }
    NET.desyncs++;
  } catch (e) { console.warn("resync failed", e); }
}
function netTick() {
  const now = performance.now();
  if (mode === "online" && NET.invite && NET.phase === "idle" && now - (NET.inviteR || 0) > 1000) { NET.inviteR = now; renderOnline(); }
  if (NET.phase === "joining" || NET.phase === "handshake") { handshakeTick(now); return; }
  if (!NET.mr) return;
  const opp = NET.oppPeer ? NET.mr.peers().find((p) => p.peer === NET.oppPeer) : null;
  if (NET.phase === "result") { resultTick(opp); return; }
  if (NET.phase !== "match" || !G) return;
  if (opp && opp.presence !== NET.lastOpp) { NET.lastOpp = opp.presence; readOpp(opp.presence); }
  const maxSteps = NET.oppFrame - NET.frame > 3 ? 2 : 1;
  let steps = 0;
  while (steps < maxSteps) {
    if (NET.myLog.length <= NET.frame + NET.D) NET.myLog.push(encIn(readPlayer()));
    const ov = NET.opLog[NET.frame];
    if (ov === undefined) break;
    const ins = []; ins[meSlot] = decIn(NET.myLog[NET.frame]); ins[1 - meSlot] = decIn(ov);
    step(G, ins);
    NET.frame++;
    // test hook: lets an automated test change both players' games at the same frame
    if (window.__blTestAt && window.__blTestAt.f === NET.frame) window.__blTestAt.fn(G);
    if (NET.frame % 60 === 0) {
      const h = checksum(G);
      NET.ckMine.set(NET.frame, h); NET.ckSend = [NET.frame, h];
      if (NET.ckMine.size > 40) NET.ckMine.delete(NET.ckMine.keys().next().value);
    }
    steps++;
    if (G.phase === "over") break;
  }
  NET.stall = steps ? 0 : NET.stall + 1;
  NET.ticks = (NET.ticks || 0) + 1; if (!steps) NET.stallTotal = (NET.stallTotal || 0) + 1;
  const from = Math.max(0, NET.myLog.length - 72, Math.min(NET.oppFrame, NET.myLog.length) - 2);
  let str = "";
  for (let fr = from; fr < NET.myLog.length; fr++) str += packIn(NET.myLog[fr]);
  if (now - NET.pgT > 1000) {
    NET.pgT = now; NET.myPg = Math.round(now) % 1000000000;
    NET.pingSent.set(NET.myPg, now);
    if (NET.pingSent.size > 60) NET.pingSent.delete(NET.pingSent.keys().next().value);
  }
  namedPresence({ m: NET.matchId, s: from, i: str, fr: NET.frame, ck: NET.ckSend, pg: NET.myPg, po: NET.echo });
  const badge = $("netBadge");
  if (NET.stall > 20) { badge.hidden = false; badge.className = "warn"; badge.textContent = `Waiting for ${NET.oppName || "your friend"}`; }
  else if (!badge.hidden) badge.hidden = true;
  if (NET.stall > 60 * 15) finishOnline(false, true);
}
function resultTick(opp) {
  if (!opp) return;
  const pr = opp.presence || {};
  if (pr !== NET.lastOpp) { NET.lastOpp = pr; updateRematchLabel(); }
  const next = NET.matchId + 1;
  if (NET.rm !== next) return;
  if (NET.role === "host" && pr.rm === next && NET.lastStart) {
    const prev = NET.lastStart, res = NET.setRes, f = [...prev.f], p = [...prev.p];
    let set = { n: 1, w: [0, 0] };
    if (prev.r.b === 3 && res && !res.over) {
      // next game of the set: the loser (or both, after a draw) may have picked a new fighter
      set = { n: prev.set.n + 1, w: res.w };
      if (G.winner !== 0 && FIG[NET.nextF]) { f[0] = NET.nextF; p[0] = palIdx(NET.nextF); }
      if (G.winner !== 1 && FIG[pr.nf]) { f[1] = pr.nf; p[1] = Number.isInteger(pr.np) && pr.np >= 0 && pr.np < FIG[pr.nf].palettes.length ? pr.np : 0; }
      if (f[0] === f[1] && p[0] === p[1]) p[1] = (p[1] + 1) % FIG[f[1]].palettes.length;
    }
    const st = Object.assign({}, prev, { id: next, seed: (Math.random() * 1e9) | 0, f, p, set });
    NET.lastStart = st;
    namedPresence({ start: st });
    startOnlineMatch(st);
  } else if (NET.role === "guest" && validStart(pr.start) && pr.start.id === next) startOnlineMatch(pr.start);
}
function updateRematchLabel() {
  if (mode !== "result" || !match || !match.online || NET.oppLeft) return;
  const opp = NET.mr && NET.mr.peers().find((p) => p.peer === NET.oppPeer);
  const theyWant = opp && opp.presence && opp.presence.rm === NET.matchId + 1;
  const iWant = NET.rm === NET.matchId + 1;
  const who = NET.oppName || "Your friend", inSet = NET.setRes && !NET.setRes.over;
  $("rAgain").querySelector("span").textContent = iWant ? `Waiting for ${who}` : theyWant ? `${who} ${inSet ? "is ready" : "wants a rematch"}` : inSet ? "Next game" : "Rematch";
}
function finishOnline(left, lost) {
  if (mode !== "match" || !match || !match.online) return;
  const me = G.fighters[meSlot], op = G.fighters[1 - meSlot];
  const res = left ? 1 : lost ? 0.5 : G.winner === meSlot ? 1 : G.winner === 1 - meSlot ? 0 : 0.5;
  const R = { res, online: true, left: !!left, lost: !!lost, me, op, lines: [], total: 0 };
  if (!left && !lost && NET.rules && NET.rules.b === 3 && NET.set) {
    const w = [...NET.set.w];
    if (G.winner === 0 || G.winner === 1) w[G.winner]++;
    NET.setRes = { n: NET.set.n, w, over: w[0] >= 2 || w[1] >= 2 || NET.set.n >= 3 };
    R.set = { n: NET.set.n, mine: w[meSlot], theirs: w[1 - meSlot], over: NET.setRes.over };
  }
  if (!left && !lost) {
    if (res === 1) R.lines.push(["Win against a friend", 15]);
    else if (res === 0.5) R.lines.push(["Draw", 8]);
    else R.lines.push(["Match played", 5]);
    if (me.kos) R.lines.push([`${me.kos} KO${me.kos > 1 ? "s" : ""}`, me.kos * 2]);
    R.total = R.lines.reduce((a, l) => a + l[1], 0);
    P.tokens += R.total;
    P.friendW = (P.friendW || 0) + (res === 1 ? 1 : 0); P.friendL = (P.friendL || 0) + (res === 0 ? 1 : 0);
    saveProfile();
  }
  if (lost || left) { leaveMatchRoom(); NET.phase = "idle"; }
  else NET.phase = "result";
  $("netBadge").hidden = true;
  showResults(R);
  lobbyPresence();
}

