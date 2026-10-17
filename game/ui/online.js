/* ===================== online play =====================
   Built on the page's `room` capability: everyone with this page open shares a lobby;
   each match is a named room. Both phones run the same deterministic simulation in
   lockstep and exchange only inputs, carried in each player's presence object
   (presence is coalesced, so it always carries a short history of recent frames).
   A small input delay, sized from the measured ping, hides the network round trip.
   Checksums every second catch any divergence; the host then sends a full snapshot, in pieces (one presence holds 4 KB).
   A boss fight (2v1) is the same lockstep with two inputs: host = slot 0, guest = slot 1, the boss (slot 2) moves himself in the
   simulation from the shared seed. If the partner drops, a CPU takes over their fighter on this phone and the fight goes on.
   A Team Brawl (2v2, up to four phones and CPUs in the empty seats) is ui/online-team.js: the same lockstep with an input log per person. */
/* Bumped whenever a change could make two copies of the game simulate differently,
   so a friend with an older copy open is told to reload instead of joining and drifting apart.
   18: the Harvest skin is a new palette (index 7) an older copy can't draw or accept in a match start. */
const PROTO = 18;
const NET = {
  room: null, user: null, tried: false, ok: false, connected: false, dead: null,
  myPeer: null, myName: "", oppName: "", lobbyPeers: [], note: "",
  mr: null, mrCode: null, unsubs: [], myPres: {}, role: null, hostCode: null,
  phase: "idle", oppPeer: null, oppBy: null, lastOpp: null, joinT: 0,
  matchId: 0, startSeen: 0, pingSent: new Map(), pingSeen: new Set(), pings: [], pingT: 0, hsT: 0, lastStart: null,
  D: 6, frame: 0, myLog: [], opLog: [], oppFrame: 0, stall: 0, ckMine: new Map(), ckSend: null,
  syncN: 0, syncSent: null, syncTx: null, syncRx: null, lastSync: 0, desyncs: 0, rm: 0, oppLeft: false,
  cpuMate: null, dropLive: false, emN: 0, emSeen: 0, emT: 0, qm: null,   // qm: the Quick match being joined or played (ui/quick.js)
  standalone: !!window.__blStandalone, invite: null, inviteT: 0, autoHost: false,   // autoHost: Team up on the Road hosts once connected
  tb: null, hs: null,   // a Team Brawl's board and its start (ui/online-team.js)
};
let TM = null;   // the online Team Brawl being played (ui/online-team.js)
{
  const jm = /^#join-([a-z0-9][a-z0-9_.-]{2,47})$/.exec(location.hash || "");
  if (jm) { NET.invite = jm[1]; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* sandboxed */ } }
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64I = Object.fromEntries([...B64].map((ch, i) => [ch, i]));
const NEUTRAL = 1280;
// One frame of input in two base64 characters (0-4095). 0-2591: the stick (81 spots) x 32 button sets. ULTI held uses the
// spare codes ULTI_BASE + stick x 16 (jump, light, heavy, special; dodge is dropped on those frames: the ulti wins anyway).
// A Team Brawl's Focus tap uses FOCUS_BASE + stick x 2 + the foe (0 or 1, in seat order), no buttons on that frame; IN_END ends the codes.
const ULTI_BASE = 2592, FOCUS_BASE = ULTI_BASE + 81 * 16, IN_END = FOCUS_BASE + 81 * 2;
function encIn(i) {
  const qx = clamp(Math.round(i.x * 4), -4, 4), qy = clamp(Math.round(i.y * 4), -4, 4), q = (qx + 4) * 9 + (qy + 4);
  if (i.focus === 0 || i.focus === 1) return FOCUS_BASE + q * 2 + i.focus;
  const b4 = (i.jump ? 1 : 0) + (i.light ? 2 : 0) + (i.heavy ? 4 : 0) + (i.special ? 8 : 0);
  return i.ulti ? ULTI_BASE + q * 16 + b4 : q * 32 + b4 + (i.dodge ? 16 : 0);
}
function decIn(v) {
  if (v >= FOCUS_BASE) { const q = (v - FOCUS_BASE) >> 1; return { x: (Math.floor(q / 9) - 4) / 4, y: ((q % 9) - 4) / 4, jump: false, light: false, heavy: false, special: false, dodge: false, ulti: false, focus: (v - FOCUS_BASE) & 1 }; }
  const u = v >= ULTI_BASE, b = u ? (v - ULTI_BASE) & 15 : v & 31, q = u ? (v - ULTI_BASE) >> 4 : v >> 5;
  return { x: (Math.floor(q / 9) - 4) / 4, y: ((q % 9) - 4) / 4, jump: !!(b & 1), light: !!(b & 2), heavy: !!(b & 4), special: !!(b & 8), dodge: !!(b & 16), ulti: u };
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
  NET.room.onConnection((on) => { NET.connected = on; autoHost(); renderOnline(); }, (err) => { NET.ok = false; NET.dead = err.code; renderOnline(); });
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
  const hosting = NET.phase === "hosting" && !NET.qm, q = qmPresence();   // ui/quick.js: searching (qs) or in a Quick match
  const tb = hosting && NET.tb ? { n: tbFree(NET.tb.bd), lv: NET.tb.lv } : null;   // a team brawl: its free seats and CPU level
  NET.room.presence({ v: PROTO, f: sel.fighter, host: hosting ? NET.hostCode : null, r: hosting && !tb ? P.rules : null, bo: hosting && !tb ? hostBo() : null, tm: tb, busy: busy || q.busy, qs: q.qs, np: shopWorn() || null }).catch(() => {});   // np: your nameplate (ui/shop.js)
}
// The lobby's second mode, a boss fight with a friend. P.onBoss = { on, b (boss id), lv (0-2) }: this device's last pick (not synced).
function onBoss() {
  const o = P.onBoss && typeof P.onBoss === "object" ? P.onBoss : {};
  return { on: !!o.on, b: BOSS_IDS.has(o.b) ? o.b : BL.BOSSES[0].id, lv: [0, 1, 2].includes(o.lv) ? o.lv : 0 };
}
const hostBo = () => { const o = onBoss(); return o.on ? { b: o.b, lv: o.lv } : null; };
const validBo = (bo) => !!bo && typeof bo === "object" && BOSS_IDS.has(bo.b) && [0, 1, 2].includes(bo.lv);
const boSpec = (bo) => BL.BOSSES.find((b) => b.id === bo.b) || BL.BOSSES[0];
const BOSS_SHORT = { scratch: "Scratch", zorp: "Zorp", kraken: "Kraken" };   // the Boss chips on the smallest phones
const BOSS_RULES = { l: 3, t: 0, b: 1 };   // a boss fight: three hearts each, no time limit, one fight
// his HP with a friend: his Road HP (ui/road.js ROAD_REG hp) x DUO_HP[boss][level], from the boss and level in the start message, so
// both phones build the same fight. Tuned with bots (tests/bossduo.js): two players win about as often as one and the Road's CPU partner
// (within 4 points in every boss and level over 384 fights each; one K per boss fit as well as one per level).
const DUO_HP = { scratch: [1.05, 1.05, 1.05], zorp: [1.15, 1.15, 1.15], kraken: [1.55, 1.55, 1.55] };
const duoHp = (bo) => (ROAD_REG.find((g) => g.boss === bo.b) || { hp: 1 }).hp * DUO_HP[bo.b][bo.lv];
function buildRules() {
  const edit = NET.phase === "idle" || NET.phase === "hosting", ob = onBoss(), ot = onTeam(), md = ob.on ? "boss" : ot.on ? "team" : "1v1";
  // rebuild only on change, so a tap is never lost to a re-render
  const sig = JSON.stringify(P.rules) + JSON.stringify(ob) + JSON.stringify(ot) + edit + NET.phase + !!NET.tb, box = $("onRules");
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  // while hosting, a team brawl can't turn into a 1v1 or a boss fight (or back): Cancel or Close first
  const off = (it) => NET.phase === "hosting" && it.md && (it.md === "team") !== !!NET.tb;
  const pick = (id, items, isOn, set) => {
    const row = $(id); row.innerHTML = "";
    for (const it of items) {
      const b = document.createElement("button");
      b.className = "chip" + (isOn(it) ? " on" : ""); b.disabled = !edit || off(it);
      if (it.short) {   // a long name has a short form for the smallest phones (css/30-select.css)
        const l = document.createElement("span"), sh = document.createElement("span");
        l.className = "l"; l.textContent = it.label; sh.className = "s"; sh.textContent = it.short;
        b.append(l, sh); b.setAttribute("aria-label", it.label);
      } else b.textContent = it.label;
      b.addEventListener("click", () => {
        Sfx.init(); Sfx.ui(); set(it); saveProfile(); buildRules();
        if (NET.phase === "hosting" && NET.tb) { NET.tb.lv = onTeam().lv; namedPresence({ tb: tbPres() }); lobbyPresence(); }
        else if (NET.phase === "hosting") { namedPresence({ r: P.rules, bo: hostBo() }); lobbyPresence(); }
        renderOnline();   // the host button and the note follow the mode
      });
      row.appendChild(b);
    }
  };
  const setBoss = (patch) => { P.onBoss = Object.assign(onBoss(), patch); }, setTeam = (patch) => { P.onTeam = Object.assign(onTeam(), patch); };
  pick("ruleM", [{ md: "1v1", label: "1 vs 1" }, { md: "team", label: "2 vs 2" }, { md: "boss", label: "Vs boss" }], (it) => it.md === md,
    (it) => { setBoss({ on: it.md === "boss" }); setTeam({ on: it.md === "team" }); });
  for (const [k, id, label] of [["l", "ruleL", (v) => String(v)], ["t", "ruleT", (v) => (v ? v + " min" : "No limit")], ["b", "ruleB", (v) => (v === 3 ? "Best of 3" : "Single")]])
    pick(id, RULES[k].map((v) => ({ v, label: label(v) })), (it) => P.rules[k] === it.v, (it) => { P.rules = Object.assign({}, P.rules, { [k]: it.v }); });
  pick("ruleBo", BL.BOSSES.map((b) => ({ v: b.id, label: b.name, short: BOSS_SHORT[b.id] })), (it) => it.v === ob.b, (it) => setBoss({ b: it.v }));
  pick("ruleLv", BOSS_LV.map((name, i) => ({ v: i, label: name })), (it) => it.v === ob.lv, (it) => setBoss({ lv: it.v }));
  pick("ruleCpu", TB_LV.map((k, i) => ({ v: i, label: LEVELS[k].name })), (it) => it.v === ot.lv, (it) => setTeam({ lv: it.v }));
  // a boss fight swaps lives, time and format for the boss (his map comes with him) and his level; a team brawl for the CPUs' level
  for (const id of ["rowL", "rowT", "rowB"]) $(id).hidden = md !== "1v1";
  for (const id of ["rowBo", "rowLv"]) $(id).hidden = md !== "boss";
  $("rowCpu").hidden = md !== "team";
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
  mode = "online"; G = null; match = null; meSlot = 0; NET.autoHost = false;
  if (NET.invite && !NET.inviteT) NET.inviteT = performance.now();
  show("online");
  $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  modal("pause", false); modal("help", false);
  resize();
  if (NET.tb && NET.mr) namedPresence({ f: sel.fighter, pi: palIdx(sel.fighter) });   // on a team brawl's board: my seat shows the fighter just picked
  netInit().then(() => { lobbyPresence(); autoHost(); renderOnline(); });
  renderOnline();
}
// Team up on a Road boss's sheet (ui/road.js): the lobby in Vs boss mode with that boss and level, hosting it as soon as it is connected
// (the invite link comes up on the public site); a friend can also join from the list as ever
const onlineHere = () => !!(window.claude && typeof window.claude.use === "function") && !(NET.tried && !NET.ok);   // online play can work on this page
function teamUp(b, lv) {
  P.onBoss = { on: true, b, lv }; P.onTeam = Object.assign({}, P.onTeam, { on: false });
  saveProfile();
  openOnline();
  NET.autoHost = NET.phase === "idle";
  autoHost();
}
function autoHost() {
  if (!NET.autoHost || mode !== "online" || NET.phase !== "idle" || !NET.ok || !NET.connected) return;   // not connected yet: its callback calls again
  NET.autoHost = false;
  netHost();
}
function hideOnline() { screens.online.hidden = true; }
let onSeq = 0;
async function renderOnline() {
  if (mode !== "online") return;
  const seq = ++onSeq;
  const st = $("onStatus"), hostBtn = $("onHost"), note = $("onNote"), list = $("onList");
  $("onTokens").textContent = fmtChips(P.tokens);
  buildRules();
  fightCard();
  if (NET.tried && !NET.ok) {
    st.textContent = NET.dead ? "Disconnected from online play" : "Online play isn't available here";
    st.className = "kicker on-status bad";
    hostBtn.disabled = true;
    $("onMyName").textContent = "You";
    list.innerHTML = ""; list.dataset.sig = "";
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = NET.standalone ? "Online play needs the game's web link. A downloaded copy can't reach other players." : "Online play works when this page is open in Claude and you're signed in. It doesn't work from a public link or a downloaded copy.";
    list.appendChild(li);
    hereNow(null);
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
  plateSet($("onMyName").parentNode, shopWorn());   // your nameplate on the Fight Card (ui/shop.js)
  const nameIn = $("onName");
  $("onMyName").hidden = NET.standalone; nameIn.hidden = !NET.standalone;
  if (NET.standalone && document.activeElement !== nameIn) nameIn.value = NET.myName;
  // build off-DOM and swap in only when something changed, so a tap on "Join" is never lost to a re-render
  const frag = document.createDocumentFragment();
  // open matches; not the team brawl this phone sits at (its board is in the host card)
  let hosts = others.filter((p) => p.presence && typeof p.presence.host === "string" && !p.presence.busy && !(NET.tb && p.presence.host === NET.mrCode));
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
    plateSet(b, h.presence.np);   // the host's nameplate (ui/shop.js; unknown or none = plain)
    const sp = document.createElement("span"); const hf = FIG[h.presence.f];
    const old = h.presence.v !== PROTO;
    if (old) li.classList.add("old");
    const bo = validBo(h.presence.bo) ? h.presence.bo : null;   // a boss fight: the row reads as an invitation to team up
    const tm = h.presence.tm && Number.isInteger(h.presence.tm.n) && [0, 1, 2].includes(h.presence.tm.lv) ? h.presence.tm : null;   // a team brawl: its free seats
    if (old) sp.textContent = "Different game version. Both of you reload the page.";
    else if (tm) sp.textContent = (NET.invite && h.presence.host === NET.invite ? "Invited you · " : "") +
      (tm.n > 0 ? `Team brawl · ${tm.n} seat${tm.n > 1 ? "s" : ""} open · ${tbLvName(tm.lv)} CPUs` : "Team brawl · full");
    else {
      sp.textContent = (NET.invite && h.presence.host === NET.invite ? "Invited you · " : "") + (hf ? hf.name : "Fighter");
      if (bo) { const em = document.createElement("em"); em.textContent = `vs ${boSpec(bo).name}`; sp.append(" · ", em, ` · ${BOSS_LV[bo.lv]}`); }
      else if (validRules(h.presence.r)) sp.append(` · ${ruleText(h.presence.r)}`);
    }
    who.append(b, sp);
    const por = document.createElement("i"); por.className = "on-por";   // the host's fighter
    if (hf && PORTRAITS[hf.id]) { const im = document.createElement("img"); im.src = PORTRAITS[hf.id]; im.alt = ""; por.appendChild(im); }
    li.appendChild(por);
    const btn = document.createElement("button"); btn.className = "chip";
    const joining = NET.phase === "joining" && NET.mrCode === h.presence.host;
    btn.textContent = joining ? "Joining" : bo ? "Team up" : "Join";
    btn.disabled = old || joining || NET.phase === "handshake" || !NET.connected || (!!tm && tm.n <= 0);
    btn.addEventListener("click", () => { Sfx.init(); Sfx.ui(); goFull(); netJoin(h.presence.host); });
    li.dataset.h = h.presence.host; li.append(who, btn); frag.appendChild(li);
  }
  const sig = [...frag.childNodes].map((li) => `${li.className}:${li.dataset.h || ""}:${li.textContent}:${li.querySelector("button") ? li.querySelector("button").disabled : ""}`).join("|");
  if (list.dataset.sig !== sig) { list.replaceChildren(frag); list.dataset.sig = sig; }
  hereNow(others.map((p) => ({ n: names[p.peer] || "Friend", busy: !!(p.presence && p.presence.busy), np: plateCls(p.presence && p.presence.np) })));
  // a team brawl's board (ui/online-team.js): the seats with the names of the people in the match's room
  const tbOn = !!NET.tb && (NET.phase === "hosting" || NET.phase === "board" || NET.phase === "handshake");
  const roomNames = tbOn && NET.mr ? Object.assign({}, names, await namesFor(NET.mr.peers())) : names;
  if (seq !== onSeq || mode !== "online") return;
  tbRender(roomNames);
  $("onRules").hidden = tbOn && NET.role !== "host";
  $("rowM").hidden = tbOn;   // the board is up: the mode is set until the brawl closes
  if (!tbOn) $("onKick").textContent = onTeam().on && !onBoss().on ? "Your team brawl" : "Your match";
  hostBtn.classList.remove("full");
  const ob = onBoss().on, ot = !ob && onTeam().on;
  if (tbOn) tbHostBtn(hostBtn, note, roomNames);   // Start (the host) or Leave (a friend)
  else {
    hostBtn.disabled = !NET.connected || NET.phase === "joining" || NET.phase === "handshake";
    hostBtn.querySelector("span").textContent = NET.phase === "hosting" ? "Cancel" : ob ? "Host a boss fight" : ot ? "Host a team brawl" : "Host a match";
    hostBtn.classList.toggle("primary", NET.phase !== "hosting");   // Cancel is the ink button
  }
  note.className = "on-note" + (NET.phase !== "idle" ? " live" : "");
  if (!tbOn) note.textContent =
    NET.phase === "hosting" ? (ob ? "Waiting for a partner. Your fight is listed for everyone here." : "Waiting for a challenger. Your match is listed for everyone here.") :
    NET.phase === "joining" ? "Joining…" :
    NET.phase === "handshake" ? `Connecting to ${NET.oppName || "your friend"}…` :
    NET.note || (ob ? (NET.standalone ? "Pick the boss, host, then send your friend the link." : "Pick the boss and host. Your friends see the fight in their list.")
      : ot ? (NET.standalone ? "Pick the CPU level, host, then send up to three friends the link." : "Pick the CPU level and host. Your friends see the brawl in their list.")
      : NET.standalone ? "Pick the rules, host, then send your friend the link." : "Pick the rules and host. Your friends see the match in their list.");
  const inv = $("onInvite"), invWas = inv.hidden;
  // a team brawl's link sits in the room card, under the open matches (its board fills the host card)
  if (NET.tb && inv.parentNode !== $("onList").parentNode) $("onList").after(inv);
  else if (!NET.tb && inv.parentNode !== note.parentNode) note.before(inv);
  inv.hidden = !(NET.standalone && NET.phase === "hosting" && NET.hostCode);
  if (!inv.hidden) {
    $("onInvT").textContent = NET.tb ? "Your team brawl is open" : ob ? "Your boss fight is open" : "Your match is open";
    $("onLink").textContent = inviteLink();
    $("onShare").hidden = !navigator.share;
    if (invWas) inv.scrollIntoView({ block: "nearest" });   // on a small phone the host card scrolls: the link comes into view
  }
  $("onHelp").textContent = NET.standalone
    ? "No account needed. Matches connect while both of you have the page open."
    : "Friends need a Claude account and access to this page. Share it from the page's Share menu, then you both open it and pick Play friends. A public link won't connect.";
}
// "Here now": a pill per player (a mint dot; grey "· in a match" when busy); rebuilt only when it changes. null = nothing (offline)
function hereNow(ps) {
  const box = $("onHere"), sig = JSON.stringify(ps);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig; box.replaceChildren();
  box.classList.toggle("empty", !!ps && !ps.length);
  if (!ps) return;
  if (!ps.length) { box.textContent = "Just you. Friends show up here when they open this page."; return; }
  for (const p of ps) {
    const el = document.createElement("span"); el.className = "on-pl" + (p.busy ? " busy" : "") + (p.np ? " " + p.np : "");
    el.textContent = p.busy ? `${p.n} · in a match` : p.n;
    box.appendChild(el);
  }
}
// the Fight Card: your fighter in the worn skin, its name, the skin and the role; the whole card opens the fighter select
function fightCard() {
  const spec = FIG[sel.fighter], pi = palIdx(spec.id), p = spec.palettes[pi] || spec.palettes[0], fc = $("onFc");
  fc.style.setProperty("--c", col(p)); fc.style.setProperty("--cg", rgba(col(p), 0.42));
  $("onFName").textContent = spec.name;
  $("onFSkin").textContent = p.name;
  $("onFRole").textContent = spec.role;
  $("onChange").setAttribute("aria-label", `Your fighter: ${spec.name}, ${p.name}. Change fighter`);
}
// back from the fighter select: the card pops and the model comes in (css/95-lobby.css)
function fightCardIn() { const fc = $("onFc"); fc.classList.remove("fc-in"); void fc.offsetWidth; fc.classList.add("fc-in"); }
function inviteLink() { return location.origin + location.pathname + "#join-" + NET.hostCode; }
function onlineArtFighter() {
  const spec = FIG[sel.fighter], o = onlineArtFighter;
  if (!o.f || o.f.spec !== spec || o.pi !== palIdx(spec.id)) {
    o.pi = palIdx(spec.id);
    o.f = newGame({ players: [{ spec, pal: spec.palettes[o.pi] }, { spec, pal: spec.palettes[0] }], countdown: 1 }).fighters[0];
    o.f.x = 0; o.f.y = 0;
  }
  return glazeMark(o.f, glazeHas(spec.id, o.pi));   // ui/glaze.js
}
// the Fight Card's model, live in the worn skin (the select's paintModel: 88 % of the art area, the Reaper's scythe fitted)
const onArt = { cv: null, f: null, fit: 0.88, bottom: 0.93 };
function drawOnlineArt(tk) {
  onArt.cv = onArt.cv || $("onArt");
  onArt.f = onlineArtFighter();
  onArt.fit = onArt.cv.clientWidth > onArt.cv.clientHeight ? 0.76 : 0.88;   // the upright card's art is wide and short: room for the hats
  paintModel(onArt, tk);
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
    pings: [], pingT: 0, hsT: 0, rm: 0, lastSync: 0, syncSent: null, syncTx: null, syncRx: null, oppLeft: false, lastStart: null, boss: null, cpuMate: null, dropLive: false, qm: null,
    tb: null, hs: null });
  NET.pingSent = new Map(); NET.pingSeen = new Set();
  TM = null;
}
function netCancel() { leaveMatchRoom(); resetNet(); NET.phase = "idle"; lobbyPresence(); renderOnline(); }
async function netHost() {
  if (!NET.ok || NET.phase !== "idle") return;
  const code = "bl" + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, "0");
  resetNet();
  NET.phase = "hosting"; NET.role = "host"; NET.hostCode = code; NET.note = "";
  const team = !onBoss().on && onTeam().on;
  if (!team) qmSilent();   // ui/quick.js: the referee keeps a 1v1's rival record (both players need an account)
  if (team) tbHostOpen();   // a team brawl: the board, you in the first Ice seat (ui/online-team.js)
  renderOnline();
  try { await openMatchRoom(code); }
  catch (e) { NET.phase = "idle"; NET.role = null; NET.hostCode = null; NET.tb = null; NET.note = "Couldn't open a match. Try again."; renderOnline(); return; }
  if (team) { tbSeat(NET.mr.peers()); namedPresence({ role: "host", f: sel.fighter, pi: palIdx(sel.fighter), tb: tbPres(), gz: glazePres() }); }
  else namedPresence({ role: "host", f: sel.fighter, pi: palIdx(sel.fighter), r: P.rules, bo: hostBo(), gz: glazePres() });   // gz: your glazed skins (ui/glaze.js)
  lobbyPresence(); renderOnline();
}
async function netJoin(code) {
  if (typeof code !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(code)) return;
  if (NET.phase === "hosting") netCancel();
  if (NET.phase !== "idle") return;
  resetNet();
  NET.phase = "joining"; NET.role = "guest"; NET.note = ""; NET.joinT = performance.now();
  NET.mrCode = code;
  qmSilent();   // ui/quick.js: the silent account, for the referee
  renderOnline();
  try { await openMatchRoom(code); }
  catch (e) { NET.phase = "idle"; NET.role = null; NET.mrCode = null; NET.note = "Couldn't join that match."; renderOnline(); return; }
  namedPresence({ role: "guest", f: sel.fighter, pi: palIdx(sel.fighter), gz: glazePres() });
  if (NET.invite === code) NET.invite = null;
  lobbyPresence(); renderOnline();
}
function matchRoomLost() {
  if (NET.tb) { tbRoomLost(); return; }   // ui/online-team.js
  if (NET.phase === "match" && match && match.boss) { cpuTakeover(); return; }
  if (NET.phase === "match") { finishOnline(false, true); return; }
  leaveMatchRoom(); resetNet(); NET.phase = "idle"; NET.note = "The match connection dropped.";
  if (mode === "online") renderOnline();
}
function onMatchPeers(ch) {
  const peers = ch.peers;
  // a team brawl (ui/online-team.js): the host's board; in the match and the results its tick reads the room itself
  if (NET.tb || (NET.role === "guest" && NET.phase === "joining" && peers.some((p) => !p.sameTab && p.presence && p.presence.role === "host" && p.presence.tb))) {
    if (NET.phase !== "match" && NET.phase !== "result") tbLobbyTick(performance.now());
    return;
  }
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
  if (NET.phase === "match" && match && match.boss) { cpuTakeover(); return; }
  if (NET.phase === "match") { NET.oppLeft = true; finishOnline(true); return; }
  if (NET.phase === "result" && match && match.qm && (match.qm.ranked || match.qm.sk)) { NET.oppLeft = true; return; }   // Next match never waits for them
  if (NET.phase === "result") { NET.oppLeft = true; $("rAgain").disabled = true; $("rAgainSub").textContent = `${NET.oppName || "Your friend"} left`; return; }
  if (NET.role === "host") {
    NET.oppPeer = null; NET.oppBy = null; NET.oppName = ""; NET.phase = "hosting";
    namedPresence({ opp: null, start: null }); lobbyPresence(); renderOnline(); return;
  }
  NET.note = "The host left."; netCancel();
}

function handshakeTick(now) {
  const opp = NET.oppPeer && NET.mr ? NET.mr.peers().find((p) => p.peer === NET.oppPeer) : null;
  if (NET.role === "guest" && NET.phase === "joining" && now - NET.joinT > 8000 && !NET.qm) { NET.note = "No answer from the host."; netCancel(); return; }   // a Quick match: the server calls it off
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
    if ((NET.pings.length >= 6 || (waited > 3000 && NET.pings.length) || waited > 7000) && (!NET.qm || qmReady(pr))) {   // a Quick match: once both VS screens showed
      const sorted = [...NET.pings].sort((a, b) => a - b);
      const rtt = sorted.length ? sorted[sorted.length >> 1] : 260;
      const pad = typeof window.__blDpad === "number" ? window.__blDpad : 4;
      const D = clamp(Math.ceil((rtt / 2 + pad) / 16.67) + 1, 3, 15);
      const gf = FIG[pr.f] ? pr.f : FIGHTERS[0].id;
      const gpi = Number.isInteger(pr.pi) && pr.pi >= 0 && pr.pi < FIG[gf].palettes.length ? pr.pi : 0;
      const hf = sel.fighter, hpi = palIdx(hf);
      const bo = hostBo();
      const st = NET.qm ? qmStartMsg(D, rtt) : { id: NET.matchId + 1, seed: (Math.random() * 1e9) | 0, d: D, f: [hf, gf], p: [hpi, gf === hf && gpi === hpi ? (gpi + 1) % FIG[gf].palettes.length : gpi], rtt: Math.round(rtt),
        r: Object.assign({}, bo ? BOSS_RULES : P.rules), set: { n: 1, w: [0, 0] } };   // a Quick match: the one the server assigned
      if (bo && !NET.qm) st.bo = bo;   // a boss fight: which boss (his map comes with him) and his level
      NET.lastStart = st;
      namedPresence({ start: st });
      startOnlineMatch(st);
    }
  } else {
    const st = pr.start;
    if (validStart(st) && st.id > NET.startSeen && (!NET.qm || qmStartOk(st))) startOnlineMatch(st);   // a Quick match: only the assigned one (else the server decides)
  }
}
function validStart(st) {
  return st && typeof st === "object" && Number.isInteger(st.id) && Number.isInteger(st.seed) && Number.isInteger(st.d) && st.d >= 1 && st.d <= 20 &&
    Array.isArray(st.f) && st.f.length === 2 && st.f.every((id) => FIG[id]) && Array.isArray(st.p) && st.p.length === 2 &&
    st.p.every((v, i) => Number.isInteger(v) && v >= 0 && v < FIG[st.f[i]].palettes.length) &&
    validRules(st.r) && st.set && Number.isInteger(st.set.n) && st.set.n >= 1 && st.set.n <= 3 && Array.isArray(st.set.w) && st.set.w.length === 2 && st.set.w.every((v) => Number.isInteger(v) && v >= 0 && v <= 2) &&
    (st.bo == null || validBo(st.bo));
}
function startOnlineMatch(st) {
  Object.assign(NET, { matchId: st.id, startSeen: st.id, D: st.d, frame: 0, myLog: [], opLog: [], oppFrame: 0, stall: 0,
    ckMine: new Map(), ckSend: null, syncSent: null, syncTx: null, syncRx: null, lastSync: 0, rm: 0, lastOpp: null, oppLeft: false, rtt: st.rtt || 0,
    rules: st.r, set: st.set, setRes: null, nextF: null, rttLive: 0, rttS: [], myPg: null, echo: null, pgT: 0,
    boss: st.bo || null, cpuMate: null, dropLive: false, emN: 0, emSeen: 0, emT: 0 });
  for (let i = 0; i < NET.D; i++) { NET.myLog.push(NEUTRAL); NET.opLog.push(NEUTRAL); }
  const specs = st.f.map((id) => FIG[id]), players = specs.map((spec, i) => ({ spec, pal: spec.palettes[st.p[i]] }));
  meSlot = NET.role === "host" ? 0 : 1;
  if (st.bo) {
    // a boss fight: the two of you (team 0) and the boss (slot 2, team 1) on his own map, tougher than on the Road (duoHp)
    const boss = boSpec(st.bo);
    G = newGame({ players: [...players, { spec: boss, pal: boss.palettes[0] }], stocks: BOSS_RULES.l, time: 0, countdown: 150, seed: st.seed, map: bossMap(boss), level: st.bo.lv, hpMul: duoHp(st.bo) });
    match = { online: true, ranked: false, boss: true, level: st.bo.lv };
  } else {
    // the map comes from the match seed, so both phones play the same one with no new field in the start message
    G = newGame({ players, stocks: st.r.l, time: st.r.t * 60, countdown: 150, seed: st.seed, map: st.seed % BL.POOL });
    match = { online: true, ranked: false, level: null };
    if (NET.qm) { match.qm = NET.qm; qmMatchStarts(); }   // ui/quick.js
  }
  NET.phase = "match"; NICE.length = 0;
  namedPresence({ m: st.id, s: 0, i: "", fr: 0, ck: null, sync: null, sa: null, rm: null, pg: null, po: null, nf: null, np: null, em: 0 });
  lobbyPresence();
  enterMatchUI();
  { // your friend's glaze, read from his presence (ui/glaze.js); yours comes from enterMatchUI
    const o = NET.oppPeer && NET.mr ? NET.mr.peers().find((p) => p.peer === NET.oppPeer) : null, f = G.fighters[1 - meSlot];
    if (f) glazeMark(f, glazeFrom(o && o.presence, f));
  }
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
      if (v >= ULTI_BASE + 81 * 16) break;
      NET.opLog[fr] = v;
    }
  }
  if (Number.isInteger(pr.fr)) NET.oppFrame = pr.fr;
  if (Array.isArray(pr.ck) && pr.ck.length === 2) {
    const mine = NET.ckMine.get(pr.ck[0]);
    if (mine !== undefined && mine !== pr.ck[1]) onDesync(pr.ck[0]);
    else if (mine !== undefined && NET.syncSent && pr.ck[0] > NET.syncSent.f) { NET.syncSent = null; NET.syncTx = null; namedPresence({ sync: null }); }
  }
  // the repair copy, a piece at a time: the guest confirms each piece (sa: [n, k]), the host then puts up the next one
  const tx = NET.syncTx;
  if (NET.role === "host" && tx && Array.isArray(pr.sa) && pr.sa[0] === tx.n && pr.sa[1] === tx.k) { if (tx.k + 1 < tx.parts.length) syncPart(tx.k + 1); else tx.done = true; }
  if (NET.role === "guest" && pr.sync && typeof pr.sync === "object") syncPiece(pr.sync);
  if (Number.isInteger(pr.em) && pr.em > NET.emSeen) { NET.emSeen = pr.em; niceShow(1 - meSlot); }   // the partner's NICE!
}
/* The repair copy: the whole game (serialize) as JSON, sent in pieces of SYNC_PART characters, because one presence holds 4 KB in all
   and a boss fight's copy is 3.4-3.9 KB on its own. sync = { n (repair number), f (its frame), k (piece), of (pieces), d (the text) }. */
const SYNC_PART = 2000;
function onDesync(F) {
  if (NET.role !== "host") return;
  if (NET.syncSent && NET.syncSent.f >= F) return;
  // a copy still on its way (until the guest confirms its last piece, which it does as it restores it): their checks were made before it
  if (NET.syncTx && !NET.syncTx.done && performance.now() - NET.syncTx.t < 5000) return;
  NET.desyncs++; NET.syncN++;
  NET.syncSent = { n: NET.syncN, f: NET.frame };
  const txt = JSON.stringify(serialize(G)), parts = [], size = window.__blSyncPart || SYNC_PART;   // __blSyncPart: tests only (more, smaller pieces)
  for (let i = 0; i < txt.length; i += size) parts.push(txt.slice(i, i + size));
  NET.syncTx = { n: NET.syncN, f: NET.frame, parts, k: 0, t: performance.now(), done: false };
  NET.syncLast = parts.length; NET.syncF = NET.frame;   // read by tests/pwonboss.py
  syncPart(0);
}
function syncPart(k) {
  const tx = NET.syncTx;
  tx.k = k; tx.t = performance.now();
  namedPresence({ sync: { n: tx.n, f: tx.f, k, of: tx.parts.length, d: tx.parts[k] } });
}
function syncPiece(sy) {
  if (!Number.isInteger(sy.n) || sy.n <= NET.lastSync || !Number.isInteger(sy.f) || !Number.isInteger(sy.k) || !Number.isInteger(sy.of) ||
    sy.of < 1 || sy.of > 16 || sy.k < 0 || sy.k >= sy.of || typeof sy.d !== "string") return;
  if (!NET.syncRx || NET.syncRx.n !== sy.n) NET.syncRx = { n: sy.n, f: sy.f, of: sy.of, parts: [] };
  const rx = NET.syncRx;
  if (rx.parts[sy.k] === undefined) { rx.parts[sy.k] = sy.d; namedPresence({ sa: [sy.n, sy.k] }); }
  for (let i = 0; i < rx.of; i++) if (rx.parts[i] === undefined) return;
  NET.syncRx = null;
  let st = null;
  try { st = JSON.parse(rx.parts.join("")); } catch (e) { console.warn("resync copy unreadable", e); }
  applySync({ n: rx.n, f: rx.f, st });
}
function applySync(sy) {
  NET.lastSync = sy.n;
  if (!Number.isInteger(sy.f) || !sy.st) return;
  try {
    const cur = NET.frame;
    restore(G, sy.st);
    for (const k of [...NET.ckMine.keys()]) if (k > sy.f) NET.ckMine.delete(k);
    if (NET.ckSend && NET.ckSend[0] > sy.f) NET.ckSend = null;   // made before the repair: never send it again
    if (cur > sy.f) {
      NET.frame = sy.f;   // the game is at the copy's frame now; replaying the logged inputs brings it back up to where it was
      for (let fr = sy.f; fr < cur; fr++) {
        if (NET.myLog[fr] === undefined || NET.opLog[fr] === undefined) break;
        const ins = []; ins[meSlot] = decIn(NET.myLog[fr]); ins[1 - meSlot] = decIn(NET.opLog[fr]);
        step(G, ins); G.events.length = 0;
        NET.frame = fr + 1;
        if ((fr + 1) % 60 === 0) { const h = checksum(G); NET.ckMine.set(fr + 1, h); NET.ckSend = [fr + 1, h]; }
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
  if (NET.tb && TM && NET.phase === "match") { tbTick(); return; }   // a team brawl: ui/online-team.js
  if (NET.tb && TM && NET.phase === "result") { tbResultTick(); return; }
  if (NET.tb && (NET.phase === "hosting" || NET.phase === "board" || NET.phase === "handshake")) { tbLobbyTick(now); return; }
  if (NET.phase === "joining" || NET.phase === "handshake") { handshakeTick(now); return; }
  if (NET.phase === "match" && NET.cpuMate && G) { soloTick(); return; }
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
  if (NET.stall > 20) { badge.hidden = false; badge.className = "warn"; badge.textContent = `Waiting for ${NET.oppName || "your friend"}${match.qm && (match.qm.ranked || match.qm.sk) ? ` · ${Math.max(0, 15 - Math.floor(NET.stall / 60))}` : ""}`; }
  else if (!badge.hidden) badge.hidden = true;
  if (NET.stall > 60 * 15) { if (match.boss) cpuTakeover(); else finishOnline(false, true); }
}
/* A boss fight goes on when the partner drops (they leave, their connection or ours goes, or nothing comes from them for 15 s): a CPU
   takes over their fighter on this phone at the partner strength of the level, and this phone plays on alone, sending nothing. */
function cpuTakeover() {
  if (NET.cpuMate || !G || !match || !match.boss) return;
  const mate = G.fighters[1 - meSlot], live = G.phase === "countdown" || G.phase === "play";
  NET.cpuMate = makeBot(BOSS_PARTNER[G.lv], BL.BOT_STYLES[mate.spec.id]);
  NET.dropLive = live;   // it dropped during the fight (not after the boss was already down): the results say so
  NET.oppLeft = true; NET.rtt = NET.rttLive = 0;
  leaveMatchRoom();
  $("pc" + meSlot).classList.remove("nice");
  $("netBadge").hidden = true;
  if (!live) return;
  showBanner(`${NET.oppName || "Your partner"} dropped`, `CPU has ${mate.spec.name} now`, "fin", 2200, "#f3d9a4");
  $("pc" + (1 - meSlot)).querySelector(".pc-tag").textContent = "CPU";
  tagShow();   // hud.js: the markers come back for 3 s, the partner's now reads CPU
}
function soloTick() {
  const ins = [];
  ins[meSlot] = readPlayer();
  ins[1 - meSlot] = botInput(G, G.fighters[1 - meSlot], bossOf(G), NET.cpuMate);
  step(G, ins);
  NET.frame++;
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
    if (prev.bo) st.bo = { b: prev.bo.b, lv: G.winner === 0 && prev.bo.lv < 2 ? prev.bo.lv + 1 : prev.bo.lv };   // a boss beaten: the next level (Nightmare: again)
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
  const who = NET.oppName || "Your friend", inSet = NET.setRes && !NET.setRes.over, boss = match.boss;
  // the button keeps its word; the ready state is its small line (the results screen, css/40-results.css)
  $("rAgain").querySelector("span").textContent = boss ? NET.again : inSet ? "Next game" : "Rematch";
  $("rAgainSub").textContent = iWant ? `Waiting for ${who}` : theyWant ? `${who} ${inSet || boss ? "is ready" : "wants a rematch"}` : "";
}
function finishOnline(left, lost) {
  if (mode !== "match" || !match || !match.online) return;
  if (match.tb) { tbFinish(); return; }   // ui/online-team.js
  if (match.boss) { finishBossOnline(); return; }
  if (match.qm) { qmFinish(left, lost); return; }   // ui/quick.js: the server decides a Ranked one
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

/* ----- the end of an online boss fight ----- */
const DUO_WIN = [20, 30, 45];   // chips for a win, by level (both phones pay their own player)
function finishBossOnline() {
  const me = G.fighters[meSlot], mate = G.fighters[1 - meSlot], b = bossOf(G), lv = G.lv;
  const won = G.winner === me.team, hp = b.hpMax ? b.hp / b.hpMax : 0, by = won && b.lastHitBy ? b.lastHitBy.slot : -1;
  const R = { res: won ? 1 : 0, online: true, me, op: b, lines: [], total: 0, dropped: !!NET.cpuMate && NET.dropLive, mateFin: won && by === mate.slot,
    boss: { lv, mate, hp, secs: Math.round(G.t / 60), name: b.spec.name, by } };
  if (won) {
    R.lines.push([`Win on ${BOSS_LV[lv]}`, DUO_WIN[lv]]);
    if (by === me.slot) R.lines.push(["Final launch", 5]);   // a flourish, not a prize: the KO page is the reward
  } else {
    R.lines.push(["Fight played", 5]);
    const t = Math.min(10, Math.floor((1 - hp) * 10 + 1e-9));   // +1 per 10% of his HP taken
    if (t > 0) R.lines.push([`Took ${t * 10}% of his HP`, t]);
  }
  R.total = R.lines.reduce((a, l) => a + l[1], 0);
  P.tokens += R.total;
  let title = false;
  if (won && lv >= 1) { title = !(P.duo | 0); P.duo = (P.duo | 0) + 1; }   // Double Trouble (ui/acct.js): an online boss win on Hard or Nightmare
  saveProfile();
  // the Road: a win counts on this phone's own Road where his fence is open, as on the Road (ui/road.js roadBossWin: the level's star, the
  // first win's title and chips, his Road skin for the fighter played, each paid once); a closed fence says how to earn it
  const k = ROAD_REG.findIndex((g) => g.boss === b.spec.id), r = roadGet(), open = k >= 0 && roadRegOpen(r, k) && roadGateOpen(r, k);
  const w = won && open ? roadBossWin(k, lv, me.spec) : null;
  if (w) { R.total += w.total; if (w.skin) R.skin = w.skin; R.road = { boss: true, k, lv, got: 1 << lv, had: w.had & ~(1 << lv), labels: BOSS_LV }; }
  const road = !won ? [] : !w ? ["Open the fence on your Road to earn this star"] : w.lines.length ? w.lines : [`${BOSS_LV[lv]} already won on your Road`];
  R.why = [...R.lines.map(([n, v]) => `${n} +${v}`), ...road, ...(title ? ["New title: Double Trouble"] : [])].join(" · ");
  if (match.finBy && R.mateFin) match.finBy += ` · by ${NET.cpuMate ? "CPU" : NET.oppName || "your partner"}`;
  if (NET.cpuMate) { leaveMatchRoom(); NET.phase = "idle"; } else NET.phase = "result";
  NET.again = NET.cpuMate ? "Retry vs CPU" : won ? (lv < 2 ? `Next: ${BOSS_LV[lv + 1]}` : "Again") : "Retry";
  $("netBadge").hidden = true;
  showResults(R);
  lobbyPresence();
}

/* ----- NICE!: in a boss fight, a tap on your own card (or N) pops a comic NICE! over your fighter on both phones. It rides in the
   presence next to the inputs (em: how many you have sent), never in the simulation. ----- */
const NICE = [], NICE_CD = 1500, NICE_MS = 1300;   // NICE: { slot, t0 } showing now
const niceOk = () => mode === "match" && !!match && !!match.online && !!match.boss && !NET.cpuMate && !!G && G.phase !== "over" && !FIN.on;
function niceSend() {
  const now = performance.now();
  if (!niceOk() || now - NET.emT < NICE_CD) return;
  NET.emT = now; NET.emN++;
  namedPresence({ em: NET.emN });
  niceShow(meSlot);
}
function niceShow(slot) {
  for (let i = NICE.length - 1; i >= 0; i--) if (NICE[i].slot === slot) NICE.splice(i, 1);
  NICE.push({ slot, t0: performance.now() });
  Sfx.tone(660, 990, 0.1, "triangle", 0.06); Sfx.tone(990, 1320, 0.12, "triangle", 0.04);
}
// over the fighter, in world space like the YOU marker (draw-world.js drawTag): pops in big, settles, rises and fades
function drawNice(c, g) {
  const now = performance.now(), k = 1 / cam.z;
  for (let i = NICE.length - 1; i >= 0; i--) {
    const n = NICE[i], t = (now - n.t0) / NICE_MS, f = g.fighters[n.slot];
    if (t >= 1 || !f) { NICE.splice(i, 1); continue; }
    if (f.state === "dead" || f.state === "gone") continue;
    const pop = t < 0.12 ? 0.4 + easeOut(t / 0.12) * 0.85 : t < 0.22 ? 1.25 - ((t - 0.12) / 0.1) * 0.25 : 1;
    c.save();
    c.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
    c.translate(f.x, f.y - f.s.h - (82 + t * 22) * k);   // above the name marker
    c.scale(k * pop, k * pop); c.rotate(-0.1);
    c.beginPath();   // a burst behind the word
    for (let j = 0; j < 20; j++) { const a = (j / 20) * Math.PI * 2, r = j % 2 ? 26 : 38; c.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.85); }
    c.closePath(); c.fillStyle = "#fff7e0"; c.fill(); c.lineWidth = 3; c.strokeStyle = "rgba(14,16,34,.9)"; c.lineJoin = "round"; c.stroke();
    c.font = 'italic 900 28px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle";
    c.lineWidth = 6; c.strokeText("NICE!", 0, 1); c.fillStyle = "#ffb627"; c.fillText("NICE!", 0, 1);
    c.restore();
  }
}
for (const i of [0, 1]) $("pc" + i).addEventListener("pointerdown", (e) => { if (cardSlot[i] === meSlot && niceOk()) { e.preventDefault(); Sfx.init(); niceSend(); } });
window.addEventListener("keydown", (e) => { if (e.code === "KeyN" && !e.repeat && niceOk()) niceSend(); });
