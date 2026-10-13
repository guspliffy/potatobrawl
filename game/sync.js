/* Account sync, the pure part: no page, no network, no storage. It is spliced into the page by build.py (at the SYNC
   marker in ui/acct.js) and is also a node module, so tests/acct.js can test the merge. A "prof" is the part of the profile that follows the
   player to another device. Sound, screen, fullscreen and match rules stay on each device. */
const SYNC = (function () {
  // Numbers that only go up by playing or down by spending: two devices add their changes together.
  const COUNTERS = ["tokens", "wins", "losses", "draws", "matches", "friendW", "friendL", "cups"];
  const MAXN = 1e9;
  const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
  const ID_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
  const CTRL_RE = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const num = (v, lo, hi, d) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

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
    out.history = (Array.isArray(p.history) ? p.history : []).filter(isObj).slice(0, 20).map((h) => ({
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
    return P;
  }
  // does this profile hold anything worth a "replace it?" question
  function hasProgress(P) {
    if (!P) return false;
    const extra = isObj(P.owned) ? Object.values(P.owned).some((l) => Array.isArray(l) && l.some((i) => i > 0)) : false;
    return !!((P.matches | 0) > 0 || (P.tokens | 0) > 0 || (P.wins | 0) > 0 || (P.losses | 0) > 0 || (P.draws | 0) > 0 ||
      (P.friendW | 0) > 0 || (P.friendL | 0) > 0 || (P.cups | 0) > 0 || extra);
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
    return out;
  }

  return { COUNTERS, ALPHA, normCode, fmtCode, typing, canon, same, cleanName, sanitize, snapshot, applyTo, hasProgress, mergeProf };
})();
if (typeof module !== "undefined") module.exports = SYNC;
