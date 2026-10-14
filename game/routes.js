/* Combo routes, the pure part: no page, no sim. Spliced into the page by build.py (at the ROUTES marker in ui/effects.js)
   and also a node module, so tests/combos.js can play every route through the real sim. A route is the list of moves
   (the hit events' `mv`) that land in one combo; "jump" is a step shown on the card that lands no hit, and a trailing "!"
   means a charged heavy (the hit's chg > 0). */
const ROUTES = (function () {
  // pct: the damage the Combo trial's CPU starts at (where the route works for every fighter; tests/combos.js checks it)
  const SHARED = [
    { id: "three", name: "Three-piece", keys: ["jab", "jab", "side"], pct: 0 },
    { id: "lift", name: "Lift & Smash", keys: ["side", "up", "hUp"], pct: 0 },
    { id: "trip", name: "Trip & Spike", keys: ["down", "side", "hDown"], pct: 0 },
    { id: "rising", name: "Rising", keys: ["side", "up", "jump", "nair"], pct: 30 },
    { id: "sig", name: "Signature", keys: ["side", "side", "spec"], pct: 0 },
  ];
  const OWN = {
    phoenix: { id: "skyburn", name: "Skyburn", keys: ["up", "up", "jump", "hAir"], pct: 70 },
    alchemist: { id: "lab", name: "Lab Accident", keys: ["down", "up", "hUp"], pct: 0 },
    odin: { id: "hammer", name: "Hammer Fall", keys: ["jab", "jab", "hSide!"], pct: 0 },
    wizard: { id: "staff", name: "Staff Dance", keys: ["side", "side", "hSide"], pct: 0 },
    samurai: { id: "blink", name: "Blink Cut", keys: ["side", "up", "spec"], pct: 0 },
    dragon: { id: "tail", name: "Tail & Flame", keys: ["down", "side", "spec"], pct: 0 },
    gunslinger: { id: "whip", name: "Pistol Whip", keys: ["jab", "jab", "spec"], pct: 0 },
    reaper: { id: "reap", name: "Reap", keys: ["down", "down", "spec"], pct: 0 },
  };
  const ALL = [...SHARED, ...Object.keys(OWN).map((f) => Object.assign({ fighter: f }, OWN[f]))];
  const hits = (r) => r.keys.filter((k) => k !== "jump");
  // the fighter's own route first, then the shared ones
  function forFighter(id) { return [OWN[id], ...SHARED].filter(Boolean).map((r) => ALL.find((a) => a.id === r.id)); }
  const byId = (id) => ALL.find((r) => r.id === id) || null;
  /* Follows one fighter's combo on one defender. `t` is a tracker ({} to start); feed it every hit event of that attacker on that
     defender (e.combo is the defender's hit count in the combo). Returns the route the combo's moves now end with, or null. */
  function track(t, e, fid) {
    if (e.combo === 1 || !t.list) { t.list = []; t.mi = null; }
    const k = e.mv + (e.chg > 0 ? "!" : "");
    // one move that hits several times (a multi-hit swing, a spray of bullets) is one step of the route
    const same = t.list.length && (e.mi >= 0 ? t.mi === e.mi : t.mi === -1 && t.list[t.list.length - 1].replace("!", "") === e.mv);
    if (same) { if (e.chg > 0) t.list[t.list.length - 1] = k; }
    else { t.list.push(k); t.mi = e.mi; }
    const cands = forFighter(fid).slice().sort((a, b) => hits(b).length - hits(a).length);
    for (const r of cands) {
      const want = hits(r);
      if (want.length > t.list.length) continue;
      const tail = t.list.slice(t.list.length - want.length);
      if (want.every((w, i) => (w.endsWith("!") ? tail[i] === w : tail[i].replace("!", "") === w))) return r;
    }
    return null;
  }
  return { SHARED, OWN, ALL, forFighter, byId, hits, track };
})();
if (typeof module !== "undefined") module.exports = ROUTES;
