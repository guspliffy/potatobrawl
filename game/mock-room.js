/* Test-only stand-in for the platform's room + user capabilities: two pages in one browser
   talk over BroadcastChannel with configurable latency, jitter (which reorders), and loss. */
(function () {
  const q = new URLSearchParams(location.search);
  const LAT = +(q.get("lat") || 60), JIT = +(q.get("jit") || 40), DROP = +(q.get("drop") || 0);
  const NAME = q.get("name") || "Tester";
  const ME = Math.random().toString(36).slice(2, 10);
  const BY = "u_" + NAME;
  function makeRoom(chan) {
    const bc = new BroadcastChannel("mock-" + chan);
    let myPres = {}, seq = 0, closed = false, pending = false;
    const others = new Map();
    const peerL = new Set();
    let snap = Object.freeze([]), prev = new Map(), myObj = null;
    function build() {
      const list = [];
      if (!myObj || myObj.presence !== myPres) myObj = Object.freeze({ peer: ME, by: BY, isMe: true, sameTab: true, kind: "viewer", guest: false, presence: myPres, updatedAt: Date.now() });
      list.push(myObj);
      for (const [k, o] of others) { if (!o.obj || o.obj.presence !== o.presence) o.obj = Object.freeze({ peer: k, by: o.by, isMe: false, sameTab: false, kind: "viewer", guest: false, presence: o.presence, updatedAt: o.updatedAt }); list.push(o.obj); }
      const now = new Map(list.map((p) => [p.peer, p]));
      const joined = [], left = [], updated = [];
      for (const p of list) { if (!prev.has(p.peer)) joined.push(p); else if (prev.get(p.peer) !== p) updated.push(p); }
      for (const [k, p] of prev) if (!now.has(k)) left.push(p);
      prev = now; snap = Object.freeze(list);
      return { peers: snap, joined, left, updated };
    }
    function schedule() {
      if (pending || closed) return; pending = true;
      requestAnimationFrame(() => { pending = false; const ch = build(); if (ch.joined.length || ch.left.length || ch.updated.length) for (const fn of peerL) fn(ch); });
    }
    function send(m) { if (!closed) bc.postMessage(m); }
    bc.onmessage = (e) => { if (Math.random() < DROP) return; const m = e.data; setTimeout(() => recv(m), LAT + Math.random() * JIT); };
    function recv(m) {
      if (closed || m.from === ME) return;
      if (m.t === "p") {
        const o = others.get(m.from);
        if (!o || m.seq > o.seq) { others.set(m.from, { presence: Object.freeze(m.p), seq: m.seq, by: m.by, updatedAt: Date.now(), seen: Date.now(), obj: o && o.presence === m.p ? o.obj : null }); schedule(); }
        else o.seen = Date.now();
      } else if (m.t === "bye") { others.delete(m.from); schedule(); }
    }
    const timer = setInterval(() => {
      if (closed) return;
      send({ t: "p", from: ME, by: BY, seq: ++seq, p: JSON.parse(JSON.stringify(myPres)) });
      const now = Date.now();
      for (const [k, o] of others) if (now - o.seen > 3000) { others.delete(k); schedule(); }
    }, 33);
    const api = {
      name: chan,
      emit: async () => {},
      on: () => () => {},
      presence(patch) {
        const size = JSON.stringify(Object.assign({}, myPres, patch)).length;
        if (size > 4096) return Promise.reject({ code: "invalid_argument", message: "presence over 4 KiB: " + size });
        const nx = Object.assign({}, myPres);
        for (const k in patch) { if (patch[k] === null) delete nx[k]; else nx[k] = patch[k]; }
        myPres = Object.freeze(nx); window.__maxPresence = Math.max(window.__maxPresence || 0, size); schedule();
        return Promise.resolve();
      },
      peers: () => snap,
      onPeers(fn) { peerL.add(fn); queueMicrotask(() => { const ch = build(); fn({ peers: ch.peers, joined: ch.peers, left: [], updated: [] }); }); return () => peerL.delete(fn); },
      connected: () => !closed,
      onConnection(fn) { queueMicrotask(() => fn(true)); return () => {}; },
      async leave() { if (closed) return; send({ t: "bye", from: ME }); closed = true; clearInterval(timer); setTimeout(() => bc.close(), 50); },
    };
    addEventListener("pagehide", () => { send({ t: "bye", from: ME }); });
    schedule();
    return api;
  }
  const lobby = makeRoom("lobby");
  const room = Object.assign({}, lobby, { join: async (name) => makeRoom("n-" + name) });
  const user = {
    me: async () => ({ id: BY, name: NAME, avatarUrl: "", color: "#888", email: null, isOwner: false, canEdit: false }),
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: String(id).replace(/^u_/, ""), avatarUrl: "", color: "#888", email: null, isMe: id === BY, guest: false }])),
    id: async () => BY, isOwner: async () => false, canEdit: async () => false, can: async () => null,
  };
  window.claude = { use: async (n) => (n === "room" ? room : n === "user" ? user : null) };
})();
