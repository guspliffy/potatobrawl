/* Account sync, the pure part: no page, no network, no storage. It is spliced into the page by build.py (at the SYNC
   marker in ui/acct.js) and is also a node module, so tests/acct.js can test the merge. A "prof" is the part of the profile that follows the
   player to another device. Sound, screen, fullscreen and match rules stay on each device. */
const SYNC = (function () {
  // Numbers that only go up by playing or down by spending: two devices add their changes together.
  const COUNTERS = ["tokens", "wins", "losses", "draws", "matches", "friendW", "friendL", "cups"];
  // Added later (an older page does not know them and syncs a prof without them): a MISSING one is "not known", never zero or empty.
  const OPT_COUNTERS = ["flawless"];
  const FS_KEYS = ["w", "l", "d"];
  const MAXN = 1e9;
  const HIST = 50;
  const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
  const ID_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
  const DAY_RE = /^2\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;   // a local date, "YYYY-MM-DD"
  const CTRL_RE = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const num = (v, lo, hi, d) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  // fighter mastery (ui/mastery.js): {fighterId: number} maps and lists of fighter ids. Zero rows are left out, so a prof has one spelling.
  const cleanMap = (m, hi) => { const r = {}; for (const id of Object.keys(m).filter((k) => ID_RE.test(k)).sort().slice(0, 24)) { const v = num(m[id], 0, hi, 0); if (v > 0) r[id] = v; } return r; };
  const cleanIds = (l) => (Array.isArray(l) ? [...new Set(l.filter((x) => typeof x === "string" && ID_RE.test(x)))].sort().slice(0, 24) : []);
  const MSEED_MAX = 650, MLV_MAX = 10;   // the head start's cap (XP) and the top level

  /* ----- the sync code: 16 characters of Crockford base32, shown as 7K3F-9QXM-2PLA-W8RT ----- */
  // What a player may type: any case, dashes and spaces optional, O read as 0, I and L as 1. "" when it cannot be a code.
  // A whole link (https://.../#sync=CODE) pasted in is fine too.
  function normCode(s) {
    if (typeof s !== "string" || s.length > 300) return "";
    const m = /sync=([0-9A-Za-z-]+)/.exec(s);
    const c = (m ? m[1] : s).toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
    return CODE_RE.test(c) ? c : "";
  }
  const fmtCode = (c) => String(c).replace(/(.{4})(?=.)/g, "$1-");
  // While typing: keep only what could be part of a code, upper case, a dash after every four characters.
  function typing(s) {
    s = String(s || "").slice(0, 300);
    const m = /sync=([0-9A-Za-z-]+)/.exec(s);
    const c = (m ? m[1] : s).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").slice(0, 16);
    return fmtCode(c);
  }

  /* ----- a clean prof ----- */
  const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : isObj(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
  const canon = (v) => String(JSON.stringify(sortKeys(v)));
  const same = (a, b) => canon(a) === canon(b);
  // Daily Potato (ui/daily.js): { d: last day tried, r: 1 / 0.5 / 0 (-1 = started, not finished), s: streak, w: the last day that kept
  // the streak going, b: best streak }. Not an object -> null (missing).
  function cleanDaily(q) {
    if (!isObj(q)) return null;
    const day = (v) => (typeof v === "string" && DAY_RE.test(v) ? v : ""), d = day(q.d), s = num(q.s, 0, 1e6, 0);
    return { d, r: !d ? 0 : [1, 0.5, 0, -1].includes(q.r) ? q.r : -1, s, w: day(q.w), b: Math.max(num(q.b, 0, 1e6, 0), s) };
  }
  // The Road (ui/road.js): { s: per stop, the stars won as bits (1 win, 2 no heart lost, 4 the bonus), b: the boss levels won as bits
  // (1 Normal, 2 Hard, 4 Nightmare), paid: the first boss win's reward was paid }. Trailing empty stops are dropped (one spelling).
  function cleanRoad(q) {
    if (!isObj(q)) return null;
    const s = (Array.isArray(q.s) ? q.s : []).slice(0, 24).map((v) => num(v, 0, 7, 0));
    while (s.length && !s[s.length - 1]) s.pop();
    return { s, b: num(q.b, 0, 7, 0), paid: q.paid === true };
  }
  function cleanName(s) {
    return Array.from(String(s == null ? "" : s).replace(CTRL_RE, "").replace(/\s+/g, " ").trim()).slice(0, 16).join("").trim();
  }
  /* Anything (the page's profile, or what the server sent) -> a prof with every field present and in range, or null.
     `figs` is the page's fighter list: it fixes how many skins each fighter has. A fighter this copy of the game does not
     know (an account used on a newer copy) is kept as it is, so an older copy never wipes its skins. */
  function sanitize(p, figs) {
    if (!isObj(p)) return null;
    const out = {};
    for (const k of COUNTERS) out[k] = num(p[k], 0, MAXN, 0);
    out.rating = num(p.rating, 0, 10000, 1000);
    out.peak = Math.max(num(p.peak, 0, 10000, 1000), out.rating);
    out.streak = num(p.streak, 0, 1e6, 0);
    const name = cleanName(p.name); if (name) out.name = name;
    const known = new Map((figs || []).map((f) => [f.id, f.palettes.length]));
    out.last = typeof p.last === "string" && known.has(p.last) ? p.last : figs && figs.length ? figs[0].id : "";
    if (p.tut) out.tut = true;
    const owned = {}, pal = {};
    const po = isObj(p.owned) ? p.owned : {}, pp = isObj(p.pal) ? p.pal : {};
    const ids = new Set([...known.keys(), ...Object.keys(po).filter((k) => ID_RE.test(k)).slice(0, 24), ...Object.keys(pp).filter((k) => ID_RE.test(k)).slice(0, 24)]);
    for (const id of [...ids].sort()) {
      const n = known.has(id) ? known.get(id) : 16;
      const list = Array.isArray(po[id]) ? po[id] : [];
      owned[id] = [...new Set([0, ...list.filter((i) => Number.isInteger(i) && i >= 0 && i < n)])].sort((a, b) => a - b);
      pal[id] = num(pp[id], 0, n - 1, 0);
    }
    out.owned = owned; out.pal = pal;
    for (const k of OPT_COUNTERS) if (typeof p[k] === "number") out[k] = num(p[k], 0, MAXN, 0);
    if (isObj(p.fstats)) {   // per fighter: wins, losses, draws (all-zero rows are left out, so a prof has one spelling)
      const fs = {};
      for (const id of Object.keys(p.fstats).filter((k) => ID_RE.test(k)).sort().slice(0, 24)) {
        const e = isObj(p.fstats[id]) ? p.fstats[id] : {}, r = {};
        for (const k of FS_KEYS) r[k] = num(e[k], 0, MAXN, 0);
        if (r.w + r.l + r.d > 0) fs[id] = r;
      }
      out.fstats = fs;
    }
    if (typeof p.fsince === "number" && p.fsince > 0) out.fsince = num(p.fsince, 0, 9e15, 0);
    if (typeof p.avatar === "string") out.avatar = /^[a-z0-9][a-z0-9_-]{0,23}:\d{1,2}$/.test(p.avatar) ? p.avatar : "";   // "fighter:skin", "" = the fighter last played
    if (typeof p.title === "string") out.title = /^[a-z][a-z0-9_]{0,15}$/.test(p.title) ? p.title : "";                   // a title id, "" = the best earned
    { const dl = cleanDaily(p.daily); if (dl) out.daily = dl; }
    // fighter mastery: XP played per fighter (a counter), the one-time head start XP (max), the highest level whose reward was paid (max), the KO pages / Ultimate KO pages landed (union)
    if (isObj(p.mxp)) out.mxp = cleanMap(p.mxp, MAXN);
    if (isObj(p.mseed)) out.mseed = cleanMap(p.mseed, MSEED_MAX);
    if (isObj(p.mpaid)) out.mpaid = cleanMap(p.mpaid, MLV_MAX);
    if (isObj(p.pages)) out.pages = { ko: cleanIds(p.pages.ko), ult: cleanIds(p.pages.ult) };
    { const rd = cleanRoad(p.road); if (rd) out.road = rd; }
    // combo routes cleared in the Combo trial (ui/combos.js), as a sorted set of route ids, and whether their 30 chips were paid
    if (Array.isArray(p.routes)) out.routes = [...new Set(p.routes.filter((r) => typeof r === "string" && /^[a-z][a-z0-9_]{0,15}$/.test(r)))].slice(0, 64).sort();
    if (typeof p.comboPaid === "boolean") out.comboPaid = p.comboPaid;
    out.history = (Array.isArray(p.history) ? p.history : []).filter(isObj).slice(0, HIST).map((h) => ({
      r: h.r === 1 ? 1 : h.r === 0.5 ? 0.5 : 0, d: num(h.d, -500, 500, 0),
      me: typeof h.me === "string" && ID_RE.test(h.me) ? h.me : "", op: typeof h.op === "string" && ID_RE.test(h.op) ? h.op : "",
      opr: num(h.opr, 0, 10000, 0), t: num(h.t, 0, 9e15, 0),
    }));
    return out;
  }
  // the page's profile -> a clean prof (the device-only settings are left out here)
  function snapshot(P, figs) { return sanitize(P, figs); }
  // copy a clean prof into the page's profile (device-only settings stay as they are)
  function applyTo(P, S) {
    for (const k of COUNTERS) P[k] = S[k];
    P.rating = S.rating; P.peak = S.peak; P.streak = S.streak;
    if (S.name) P.name = S.name; else delete P.name;
    P.last = S.last;
    if (S.tut) P.tut = true;
    P.owned = Object.assign({}, P.owned, Object.fromEntries(Object.entries(S.owned).map(([k, v]) => [k, v.slice()])));
    P.pal = Object.assign({}, P.pal, S.pal);
    P.history = S.history.map((h) => Object.assign({}, h));
    // fields an older page never sent stay as this device has them
    for (const k of OPT_COUNTERS) if (S[k] !== undefined) P[k] = S[k];
    if (S.fstats !== undefined) P.fstats = Object.fromEntries(Object.entries(S.fstats).map(([k, v]) => [k, Object.assign({}, v)]));
    if (S.fsince !== undefined) P.fsince = S.fsince; else if (S.fstats !== undefined) delete P.fsince;
    if (S.avatar !== undefined) P.avatar = S.avatar;
    if (S.title !== undefined) P.title = S.title;
    if (S.daily !== undefined) P.daily = Object.assign({}, S.daily);
    if (S.road !== undefined) P.road = { s: S.road.s.slice(), b: S.road.b, paid: S.road.paid };
    if (S.routes !== undefined) P.routes = S.routes.slice();
    if (S.comboPaid !== undefined) P.comboPaid = S.comboPaid;
    for (const k of ["mxp", "mseed", "mpaid"]) if (S[k] !== undefined) P[k] = Object.assign({}, S[k]);
    if (S.pages !== undefined) P.pages = { ko: S.pages.ko.slice(), ult: S.pages.ult.slice() };
    return P;
  }
  // does this profile hold anything worth a "replace it?" question
  function hasProgress(P) {
    if (!P) return false;
    const extra = isObj(P.owned) ? Object.values(P.owned).some((l) => Array.isArray(l) && l.some((i) => i > 0)) : false;
    return !!((P.matches | 0) > 0 || (P.tokens | 0) > 0 || (P.wins | 0) > 0 || (P.losses | 0) > 0 || (P.draws | 0) > 0 ||
      (P.friendW | 0) > 0 || (P.friendL | 0) > 0 || (P.cups | 0) > 0 || extra || !!(isObj(P.road) && Array.isArray(P.road.s) && P.road.s.some((v) => v > 0)));
  }

  /* ----- the merge -----
     local = this device now, base = the copy the server had when this device last synced, server = the server's newer copy.
     Counters: the server's value plus what this device changed since base (so chips won on two devices both count).
     Skins owned: everything either side has. Everything else (rating, streak, name, skin picked, last fighter, history; peak keeps the higher one):
     if only one side changed it, that side; if both did, the newer side (localNewer says whether this device changed last). */
  function mergeProf(local, base, server, localNewer) {
    const L = local, S = server, B = base || {};
    const out = {};
    for (const k of COUNTERS) out[k] = Math.min(MAXN, Math.max(0, (S[k] || 0) + (L[k] || 0) - (B[k] || 0)));
    const pick = (l, b, s) => (same(l, b) ? s : same(s, b) ? l : localNewer ? l : s);
    out.rating = pick(L.rating, B.rating, S.rating);
    // the best rating ever is a high-water mark: if both sides raised it, the higher one stays
    out.peak = Math.max(same(L.peak, B.peak) ? S.peak : same(S.peak, B.peak) ? L.peak : Math.max(L.peak, S.peak), out.rating);
    out.streak = pick(L.streak, B.streak, S.streak);
    const name = pick(L.name, B.name, S.name); if (name) out.name = name;
    out.last = pick(L.last, B.last, S.last);
    if (L.tut || S.tut) out.tut = true;
    const ids = [...new Set([...Object.keys(L.owned || {}), ...Object.keys(S.owned || {}), ...Object.keys(L.pal || {}), ...Object.keys(S.pal || {})])].sort();
    out.owned = {}; out.pal = {};
    for (const id of ids) {
      out.owned[id] = [...new Set([0, ...((L.owned || {})[id] || []), ...((S.owned || {})[id] || [])])].sort((a, b) => a - b);
      out.pal[id] = pick((L.pal || {})[id], (B.pal || {})[id], (S.pal || {})[id]) | 0;
    }
    out.history = pick(L.history, B.history, S.history) || [];
    // Newer fields. A side that does not have the field at all (a prof from an older page) is "unchanged", so the other side's value stays.
    const have = (v) => v !== undefined;
    const pickOpt = (k) => (!have(S[k]) ? L[k] : !have(L[k]) ? S[k] : !have(B[k]) ? (localNewer ? L[k] : S[k]) : pick(L[k], B[k], S[k]));
    for (const k of OPT_COUNTERS) { const v = !have(S[k]) ? L[k] : !have(L[k]) ? S[k] : Math.min(MAXN, Math.max(0, S[k] + L[k] - (B[k] || 0))); if (have(v)) out[k] = v; }
    if (have(S.fstats) || have(L.fstats)) {
      const fs = {}, bf = B.fstats || {};
      const ids = [...new Set([...Object.keys(L.fstats || {}), ...Object.keys(S.fstats || {})])].sort();
      for (const id of ids) {
        const r = {};
        for (const k of FS_KEYS) {
          const l = have(L.fstats) ? ((L.fstats[id] || {})[k] || 0) : null, s = have(S.fstats) ? ((S.fstats[id] || {})[k] || 0) : null;
          r[k] = l === null ? s : s === null ? l : Math.min(MAXN, Math.max(0, s + l - (((bf[id] || {})[k]) || 0)));
        }
        if (r.w + r.l + r.d > 0) fs[id] = r;
      }
      out.fstats = fs;
    }
    { const f = [L.fsince, S.fsince].filter((v) => v > 0); if (f.length) out.fsince = Math.min(...f); }   // counting began on the earlier device
    { const v = pickOpt("avatar"); if (have(v)) out.avatar = v; }
    { const v = pickOpt("title"); if (have(v)) out.title = v; }
    // Daily Potato: the side that changed it; if both did, the later day, then (same day) a finished try over one still running (-1),
    // then the newer side. The best streak keeps the higher one.
    if (have(S.daily) || have(L.daily)) {
      const l = L.daily, s = S.daily, b = B.daily;
      let v = !have(s) ? l : !have(l) ? s : have(b) && same(l, b) ? s : have(b) && same(s, b) ? l : null;
      if (!v) {
        const w = l.d !== s.d ? (l.d > s.d ? l : s) : (l.r === -1) !== (s.r === -1) ? (l.r === -1 ? s : l) : localNewer ? l : s;
        v = Object.assign({}, w, { b: Math.max(l.b, s.b) });
      }
      out.daily = Object.assign({}, v);
    }
    // combo routes: everything either side cleared; the chips for all of them, paid once on any device, stay paid
    if (have(S.routes) || have(L.routes)) out.routes = [...new Set([...(L.routes || []), ...(S.routes || [])])].sort();
    if (have(S.comboPaid) || have(L.comboPaid)) out.comboPaid = !!(L.comboPaid || S.comboPaid);
    // fighter mastery. XP played is a counter per fighter (server + local - base); the head start and the paid level take the higher
    // value per fighter (two devices that seeded from the same record must not add); the pages are a union. A side without the field is "unchanged".
    if (have(S.mxp) || have(L.mxp)) {
      const r = {}, bm = B.mxp || {}, at = (o, id) => (o && o[id]) || 0;
      for (const id of [...new Set([...Object.keys(L.mxp || {}), ...Object.keys(S.mxp || {})])].sort()) {
        const l = have(L.mxp) ? at(L.mxp, id) : null, s = have(S.mxp) ? at(S.mxp, id) : null;
        const v = l === null ? s : s === null ? l : Math.min(MAXN, Math.max(0, s + l - at(bm, id)));
        if (v > 0) r[id] = v;
      }
      out.mxp = r;
    }
    for (const k of ["mseed", "mpaid"]) {
      if (!have(S[k]) && !have(L[k])) continue;
      const r = {}, a = L[k] || {}, b = S[k] || {};
      for (const id of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) { const v = Math.max(a[id] || 0, b[id] || 0); if (v > 0) r[id] = v; }
      out[k] = r;
    }
    if (have(S.pages) || have(L.pages)) {
      const u = (k) => [...new Set([...((L.pages || {})[k] || []), ...((S.pages || {})[k] || [])])].sort();
      out.pages = { ko: u("ko"), ult: u("ult") };
    }
    // the Road: every star and boss level either side won stays won; the first-win reward, paid on any device, stays paid
    if (have(S.road) || have(L.road)) {
      const l = L.road || { s: [], b: 0, paid: false }, s = S.road || { s: [], b: 0, paid: false };
      const st = Array.from({ length: Math.max(l.s.length, s.s.length) }, (_, i) => (l.s[i] | 0) | (s.s[i] | 0));
      out.road = { s: st, b: l.b | s.b, paid: !!(l.paid || s.paid) };
    }
    return out;
  }

  return { COUNTERS, OPT_COUNTERS, HIST, ALPHA, normCode, fmtCode, typing, canon, same, cleanName, cleanDaily, cleanRoad, sanitize, snapshot, applyTo, hasProgress, mergeProf };
})();
if (typeof module !== "undefined") module.exports = SYNC;
