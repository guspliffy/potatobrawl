/* Standalone network layer. Inside Claude the page uses the platform's `room` and `user`
   capabilities. On its own website it gets the same two interfaces from here, carried over
   a WebSocket to server.js, so the game code is identical in both places. */
(function () {
  if (window.claude && typeof window.claude.use === "function") return;
  window.__blStandalone = true;
  if (!/^https?:$/.test(location.protocol)) { window.claude = { use: async () => null }; return; }

  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; };
  const rid = () => Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  const PEER = "p" + rid() + rid();
  // a secret made when the page opens: only this page can take its peer back after a dropped connection (peer ids are public in a room)
  const KEY = (() => { try { const b = new Uint8Array(18); crypto.getRandomValues(b); return Array.from(b, (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join(""); } catch (e) { return rid() + rid() + rid(); } })();
  let BY = store("potatobrawl.uid") || store("blastline.uid");
  if (!BY || !/^[A-Za-z0-9_-]{4,40}$/.test(BY)) BY = "u_" + rid() + rid();
  store("potatobrawl.uid", BY);
  const cleanName = (s) => String(s || "").replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").trim().slice(0, 20);
  let NAME = cleanName(store("potatobrawl.name") || store("blastline.name"));
  if (!NAME) NAME = "Potato " + (10 + Math.floor(Math.random() * 90));
  store("potatobrawl.name", NAME);
  const names = new Map([[BY, NAME]]);

  let ws = null, welcomed = false, backoff = 400;
  const connL = new Set();
  const qmL = new Set();   // Quick match (ui/quick.js): the server's me / acct / qm-* / stk-* messages (stk-*: ui/stakes.js)
  const rooms = new Map();

  function setConn(v) { if (v === welcomed) return; welcomed = v; for (const fn of [...connL]) fn(v); }
  function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
  function connect() {
    try { ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"); }
    catch (e) { setTimeout(connect, backoff); return; }
    window.__blws = ws;
    ws.onopen = () => { backoff = 400; send({ t: "hello", peer: PEER, by: BY, name: NAME, k: KEY }); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } onMsg(m); };
    ws.onclose = () => { setConn(false); setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 6000); };
    ws.onerror = () => {};
  }
  function onMsg(m) {
    if (m.t === "welcome") {
      setConn(true);
      for (const R of rooms.values()) { send({ t: "join", room: R.name }); R.dirty = true; }
      return;
    }
    if (m.t === "name") { if (typeof m.by === "string") names.set(m.by, cleanName(m.name)); for (const R of rooms.values()) R.touch(); return; }
    if (m.t === "me" || m.t === "acct" || (typeof m.t === "string" && (m.t.slice(0, 3) === "qm-" || m.t.slice(0, 4) === "stk-"))) { for (const fn of [...qmL]) fn(m); return; }
    const R = rooms.get(m.room);
    if (!R) return;
    if (m.t === "peers" && Array.isArray(m.peers)) {
      R.others.clear();
      for (const p of m.peers) {
        if (typeof p.by === "string") names.set(p.by, cleanName(p.name));
        if (p.peer !== PEER) R.others.set(p.peer, { by: p.by, presence: Object.freeze(p.presence || {}), updatedAt: Date.now(), obj: null });
      }
      R.dirty = true; R.schedule();
    } else if (m.t === "joined") {
      if (typeof m.by === "string") names.set(m.by, cleanName(m.name));
      if (m.peer !== PEER) { R.others.set(m.peer, { by: m.by, presence: Object.freeze(m.presence || {}), updatedAt: Date.now(), obj: null }); R.schedule(); }
    } else if (m.t === "left") {
      R.others.delete(m.peer); R.schedule();
    } else if (m.t === "presence") {
      if (m.peer === PEER || !m.p || typeof m.p !== "object") return;
      const o = R.others.get(m.peer);
      if (o) { o.presence = Object.freeze(m.p); o.updatedAt = Date.now(); o.obj = null; }
      else R.others.set(m.peer, { by: null, presence: Object.freeze(m.p), updatedAt: Date.now(), obj: null });
      R.schedule();
    }
  }

  function makeRoom(name) {
    const R = { name, others: new Map(), myPres: Object.freeze({}), myObj: null, peerL: new Set(), snap: Object.freeze([]), prev: new Map(), pending: false, dirty: false };
    R.build = () => {
      if (!R.myObj || R.myObj.presence !== R.myPres) R.myObj = Object.freeze({ peer: PEER, by: BY, isMe: true, sameTab: true, kind: "viewer", guest: false, presence: R.myPres, updatedAt: Date.now() });
      const list = [R.myObj];
      for (const [k, o] of R.others) {
        if (!o.obj) o.obj = Object.freeze({ peer: k, by: o.by, isMe: false, sameTab: false, kind: "viewer", guest: false, presence: o.presence, updatedAt: o.updatedAt });
        list.push(o.obj);
      }
      const now = new Map(list.map((p) => [p.peer, p]));
      const joined = [], left = [], updated = [];
      for (const p of list) { if (!R.prev.has(p.peer)) joined.push(p); else if (R.prev.get(p.peer) !== p) updated.push(p); }
      for (const [k, p] of R.prev) if (!now.has(k)) left.push(p);
      R.prev = now; R.snap = Object.freeze(list);
      return { peers: R.snap, joined, left, updated };
    };
    R.schedule = () => {
      if (R.pending) return;
      R.pending = true;
      requestAnimationFrame(() => {
        R.pending = false;
        if (!rooms.has(R.name)) return;
        const ch = R.build();
        if (ch.joined.length || ch.left.length || ch.updated.length) for (const fn of [...R.peerL]) fn(ch);
      });
    };
    R.touch = () => { for (const o of R.others.values()) o.obj = null; R.myObj = null; R.schedule(); };
    R.api = Object.freeze({
      name,
      emit: async () => {},
      on: () => () => {},
      presence(patch) {
        const nx = Object.assign({}, R.myPres);
        for (const k in patch) { if (patch[k] === null) delete nx[k]; else nx[k] = patch[k]; }
        if (JSON.stringify(nx).length > 4096) return Promise.reject({ code: "invalid_argument", message: "presence over 4 KiB" });
        R.myPres = Object.freeze(nx); R.dirty = true; R.schedule();
        return Promise.resolve();
      },
      peers: () => R.snap,
      onPeers(fn) {
        R.peerL.add(fn);
        queueMicrotask(() => { const ch = R.build(); fn({ peers: ch.peers, joined: ch.peers, left: [], updated: [] }); });
        return () => R.peerL.delete(fn);
      },
      connected: () => welcomed,
      onConnection(fn) { connL.add(fn); queueMicrotask(() => fn(welcomed)); return () => connL.delete(fn); },
      async leave() { if (!rooms.has(name)) return; rooms.delete(name); send({ t: "leave", room: name }); },
    });
    rooms.set(name, R);
    if (welcomed) send({ t: "join", room: name });
    R.schedule();
    return R;
  }
  // Presence goes out whole, coalesced to about 30 sends a second per room.
  setInterval(() => {
    if (!welcomed) return;
    for (const R of rooms.values()) if (R.dirty) { R.dirty = false; send({ t: "presence", room: R.name, p: R.myPres }); }
  }, 33);
  addEventListener("pagehide", () => send({ t: "bye" }));

  const lobby = makeRoom("lobby");
  const room = Object.assign({}, lobby.api, {
    async join(n) {
      if (typeof n !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(n) || n === "lobby") throw { code: "invalid_argument", message: "bad room name" };
      return (rooms.get(n) || makeRoom(n)).api;
    },
  });
  const user = {
    me: async () => ({ id: BY, name: NAME, avatarUrl: "", color: "#888", email: null, isOwner: false, canEdit: false }),
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: names.get(id) || "", avatarUrl: "", color: "#888", email: null, isMe: id === BY, guest: false }])),
    id: async () => BY, name: async () => NAME, isOwner: async () => false, canEdit: async () => false, can: async () => null,
  };
  window.__blSetName = (n) => {
    const v = cleanName(n);
    if (!v) return NAME;
    NAME = v; store("potatobrawl.name", NAME); names.set(BY, NAME);
    send({ t: "name", name: NAME });
    for (const R of rooms.values()) R.touch();
    return NAME;
  };
  window.claude = { use: async (n) => (n === "room" ? room : n === "user" ? user : null) };
  // Quick match talks to the server directly (server.js -> quick.js): send a message, hear the answers, know the connection
  window.__blQuick = Object.freeze({
    send(m) { if (!welcomed) return false; send(m); return true; },
    on(fn) { qmL.add(fn); return () => qmL.delete(fn); },
    connected: () => welcomed,
    onConnection(fn) { connL.add(fn); return () => connL.delete(fn); },
  });
  connect();
})();
