(function () {
"use strict";
const { STAGE, FIGHTERS, newGame, step, makeBot, botInput, intangible, clamp, lerp, sign, serialize, restore, checksum } = BL;
const FIG = Object.fromEntries(FIGHTERS.map((f) => [f.id, f]));
// the skins bought with chips (the first ones); the Road skins after them are won from the bosses (pal.road), the Pommes skins after those bought with Pommes (pal.pommes)
const chipN = (spec) => spec.palettes.filter((p) => !p.road && !p.pommes).length;
// a chip balance as shown everywhere: exact, grouped the language's way (1,350 / 1.350 / 1 350, LOC in ui/lang.js), never shortened
const fmtChips = (n) => Math.max(0, Math.round(+n || 0)).toLocaleString(LOC);
const $ = (id) => document.getElementById(id);
const app = $("app"), cv = $("cv"), ctx = cv.getContext("2d");
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === "number" ? r : 0, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}
const STEP = 1000 / 60;
// a fresh seed for an offline match: the UI picks it, the simulation never does (core.js newGame throws without one)
const newSeed = () => (Math.random() * 1e9) | 0;

/* ===================== profile (per device) ===================== */
const SAVE_KEY = "potatobrawl.profile.v1", OLD_SAVE_KEY = "blastline.profile.v1";
function defProfile() {
  return {
    rating: 1000, peak: 1000, wins: 0, losses: 0, draws: 0, matches: 0, tokens: 0, streak: 0,
    owned: Object.fromEntries(FIGHTERS.map((f) => [f.id, [0]])), pal: Object.fromEntries(FIGHTERS.map((f) => [f.id, 0])),
    last: FIGHTERS[0].id, sound: true, history: [], fstats: {}, fsince: 0, flawless: 0, duo: 0, avatar: "", title: "", screen: "cw", rules: { l: 3, t: 4, b: 1 },
    daily: { d: "", r: 0, s: 0, w: "", b: 0 },   // Daily Potato (ui/daily.js)
    routes: [], comboPaid: false,                // combo routes cleared in the Combo trial (ui/combos.js)
    mxp: {}, mpaid: {}, pages: { ko: [], ult: [] },   // fighter mastery (ui/mastery.js): XP per fighter, highest level paid, KO pages landed. mseed (the one-time head start) is left out on purpose: undefined = not given yet
  };
}
let firstRun = false;
function loadProfile() {
  const p = defProfile();
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY);
    firstRun = !raw;
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(p, s);
      p.owned = Object.assign(defProfile().owned, s.owned || {});
      p.pal = Object.assign(defProfile().pal, s.pal || {});
      p.rules = validRules(s.rules) ? s.rules : defProfile().rules;
      if (!FIG[p.last]) p.last = FIGHTERS[0].id;
      if (!p.fstats || typeof p.fstats !== "object" || Array.isArray(p.fstats)) p.fstats = {};
    }
  } catch (e) { /* storage unavailable: play without saving */ }
  return p;
}
/* Friend match rules: lives, minutes (0 = no limit), single match or best of 3. */
const RULES = { l: [1, 3, 5], t: [2, 4, 0], b: [1, 3] };
function validRules(r) { return !!r && typeof r === "object" && RULES.l.includes(r.l) && RULES.t.includes(r.t) && RULES.b.includes(r.b); }
function ruleText(r) { return `${_t("{n} life|{n} lives", { n: r.l })} · ${r.t ? _t("{n} min", { n: r.t }) : _t("no time limit")} · ${r.b === 3 ? _t("best of 3") : _t("single match")}`; }
function saveProfile() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* ignore */ }
  try { acctDirty(); } catch (e) { /* accounts (ui/acct.js) not set up yet */ }   // a linked account saves itself shortly after
}
let P = loadProfile();
// True once the player finished a match that is not the tutorial or the Combo trial (P.fin1, set by markPlayed). A profile from before the flag
// counts too: any ranked, friend, Team Brawl or cup record or mastery XP (all kept by the sync), so it never depends on the flag riding along.
function playedOnce() {
  return !!(P.fin1 || (P.matches | 0) > 0 || (P.friendW | 0) + (P.friendL | 0) > 0 || (P.duoW | 0) > 0 || (P.cups | 0) > 0 ||
    (P.mxp && typeof P.mxp === "object" && Object.values(P.mxp).some((v) => v > 0)));
}
function markPlayed() { if (!P.fin1) { P.fin1 = true; saveProfile(); } }

const TIERS = [
  { name: _tk("Tin"), min: 0, col: "#9097ad" },
  { name: _tk("Bronze"), min: 900, col: "#cd8f5b" },
  { name: _tk("Silver"), min: 1050, col: "#c9d0e4" },
  { name: _tk("Gold"), min: 1200, col: "#f0c35a" },
  { name: _tk("Platinum"), min: 1350, col: "#7fd6c8" },
  { name: _tk("Diamond"), min: 1500, col: "#8fb6ff" },
  { name: _tk("Blastmaster"), min: 1650, col: "#ef7a52" },
];
function tierIdx(r) { let i = 0; for (let k = 0; k < TIERS.length; k++) if (r >= TIERS[k].min) i = k; return i; }
function tierInfo(r) {
  const i = tierIdx(r), t = TIERS[i];
  if (i === TIERS.length - 1) return { i, t, p: 1, next: null, need: 0 };
  const lo = i === 0 ? 750 : t.min, hi = TIERS[i + 1].min;
  return { i, t, p: clamp((r - lo) / (hi - lo), 0, 1), next: TIERS[i + 1], need: hi - r };
}
/* Rank emblems (Fable's design): one flat cartoon icon per tier, an inline SVG on a 60x60 viewBox. The ladder: a tin lid, a medal,
   a medal + laurel, a crown, a trophy (sheen), a gem (twinkle), the bomb-tater (turning burst). Outline #1f2238 2.5, one shade, one
   highlight top-left, everything inside r 27 of the centre so it sits inside the profile pill's progress ring. Platinum and up move
   a little (.em-* in shell.html, still under prefers-reduced-motion). Each emblem is built once; %U is the per-copy clip-path id. */
const EM_O = "#1f2238";
const emN = (v) => Math.round(v * 10) / 10;
const emP = (x, y) => emN(x) + " " + emN(y);
// a lumpy potato outline (the Potato Moon's), centre (x, y), size r, turned by a radians
function emPot(x, y, r, a, sx = 1.2, sy = 0.88) {
  let d = "";
  for (let i = 0; i < 30; i++) {
    const t = (i / 30) * Math.PI * 2, k = 1 + 0.05 * Math.sin(t * 3 + 0.6) + 0.035 * Math.sin(t * 5 + 1.9);
    const px = Math.cos(t) * r * sx * k, py = Math.sin(t) * r * sy * k;
    d += (i ? "L" : "M") + emP(x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a));
  }
  return d + "Z";
}
// a crescent along the inside of circle (x, y, r) from angle a0 to a1 (degrees, 0 = right, 90 = down), w thick in the middle
function emCres(x, y, r, a0, a1, w) {
  const pt = (a, rr) => [x + Math.cos(a * Math.PI / 180) * rr, y + Math.sin(a * Math.PI / 180) * rr];
  const p0 = pt(a0, r), p1 = pt(a1, r), m = pt((a0 + a1) / 2, r - w);
  return `M${emP(...p0)}A${r} ${r} 0 0 1 ${emP(...p1)}Q${emP(2 * m[0] - (p0[0] + p1[0]) / 2, 2 * m[1] - (p0[1] + p1[1]) / 2)} ${emP(...p0)}Z`;
}
// an n-point star (r1 tips, r2 notches), first tip straight up
function emStar(x, y, n, r1, r2) {
  let d = "";
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? r2 : r1; d += (i ? "L" : "M") + emP(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  return d + "Z";
}
// a disc with a dent pushed into its rim at the top right
function emDent(x, y, r) {
  let d = "";
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, g = Math.atan2(Math.sin(a + 0.86), Math.cos(a + 0.86)), rr = r - 3 * Math.exp(-((g / 0.24) ** 2));
    d += (i ? "L" : "M") + emP(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  return d + "Z";
}
const emDot = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const emLine = (d, s, w) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// a round medal at (x, y), radius r: shade under a slightly smaller face shifted up-left, a highlight crescent, an inner ring
// (its outline, emRim, goes on last, over whatever sits on the face)
const emMedal = (x, y, r, col, sh, hi, ring) =>
  emDot(x, y, r, sh) + emDot(emN(x - 1.1), emN(y - 1.1), emN(r - 2.4), col) + `<path d="${emCres(x, y, r - 3.2, 195, 283, 3)}" fill="${hi}"/>` +
  `<circle cx="${x}" cy="${y}" r="${ring}" fill="none" stroke="${sh}" stroke-width="2"/>`;
const emRim = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${EM_O}" stroke-width="2.5"/>`;
const EMB = [
  // Tin: a pressed tin lid with a dent in its rim, an embossed potato in the middle
  () => `<path d="${emDent(30, 30, 23)}" fill="#6c7390"/><path d="${emDent(28.9, 28.9, 20.6)}" fill="#9097ad"/>` +
    `<path d="${emCres(30, 30, 19.8, 160, 268, 3)}" fill="#c3c8d8"/><circle cx="30" cy="30" r="16" fill="none" stroke="#6c7390" stroke-width="2"/>` +
    `<path d="${emPot(31, 31, 7.6, -0.35)}" fill="#c3c8d8"/><path d="${emPot(30, 30, 7.6, -0.35)}" fill="#7d849c"/>` +
    emDot(26.6, 29.4, 1.3, "#6c7390") + emDot(32.8, 28, 1.2, "#6c7390") +
    emLine("M40.2 17.6q-1.8 1.4-2.4 3.4", "#6c7390", 2) +
    `<path d="${emDent(30, 30, 23)}" fill="none" stroke="${EM_O}" stroke-width="2.5" stroke-linejoin="round"/>`,
  // Bronze: a medal on a ribbon, a potato on its face
  () => `<g stroke="${EM_O}" stroke-width="2.5" stroke-linejoin="round"><path d="M33 7h10l-7 18h-10z" fill="#a3472e"/><path d="M17 7h10l7 18h-10z" fill="#c25a3a"/></g>` +
    `<path d="M21.8 9.5h3.4l5.3 13" fill="none" stroke="#e07a56" stroke-width="2" stroke-linecap="round"/>` +
    emMedal(30, 37, 16.5, "#cd8f5b", "#a86a3b", "#ecb98a", 11.6) +
    `<path d="${emPot(30, 37, 5.6, -0.3)}" fill="#a86a3b"/>` + emDot(27.6, 35.6, 1.1, "#cd8f5b") + emDot(32.4, 37.6, 1.1, "#cd8f5b") + emRim(30, 37, 16.5),
  // Silver: a medal with a star, a laurel around it and a sprout on top
  () => {
    const lv = [];   // two laurel branches of 4 leaves, from the bottom up both sides, each leaf along the branch tipped outwards
    const pt = (a) => emP(30 + Math.cos(a * Math.PI / 180) * 20.5, 33 + Math.sin(a * Math.PI / 180) * 20.5);
    const stem = `M${pt(118)}A20.5 20.5 0 0 1 ${pt(208)}M${pt(62)}A20.5 20.5 0 0 0 ${pt(-28)}`;
    for (const s of [1, -1]) for (let k = 0; k < 4; k++) {
      const a = 90 + s * (30 + k * 31), x = 30 + Math.cos(a * Math.PI / 180) * 20.5, y = 33 + Math.sin(a * Math.PI / 180) * 20.5;
      lv.push(`<path d="M0 0Q4.6-4.4 10 0Q4.6 4.4 0 0Z" transform="translate(${emN(x)} ${emN(y)}) rotate(${emN(a + s * 90 - s * 34)}) translate(-2.4 0)"/>`);
    }
    return `<path d="${stem}" fill="none" stroke="${EM_O}" stroke-width="6.4" stroke-linecap="round"/><g fill="${EM_O}" stroke="${EM_O}" stroke-width="4.4" stroke-linejoin="round">${lv.join("")}</g>` +
      `<path d="${stem}" fill="none" stroke="#a9b2cc" stroke-width="2" stroke-linecap="round"/><g fill="#a9b2cc">${lv.join("")}</g>` +
      `<g stroke="${EM_O}" stroke-width="2.2" stroke-linejoin="round"><path d="M30 16c-1-4-4-7-9-8 0 5 3 8 9 8z" fill="#7fbf72"/><path d="M30 16c1-5 4-8 9-9 0 6-3 9-9 9z" fill="#7fbf72"/></g>` +
      emMedal(30, 33, 17.5, "#c9d0e4", "#8f9ab8", "#f4f6fb", 12.8) +
      `<path d="${emStar(30, 33.6, 5, 9, 3.9)}" fill="#f4f6fb" stroke="#8f9ab8" stroke-width="2" stroke-linejoin="round"/>` + emRim(30, 33, 17.5);
  },
  // Gold: a three-point crown, red gems on the outer tips, a potato for the centre jewel
  () => `<path d="M12 41L15 18L23.5 30.5L30 12L36.5 30.5L45 18L48 41Z" fill="#f0c35a" stroke="${EM_O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M16.6 24.5L17.4 38.5H15L15.9 25Z" fill="#fff1b3"/><path d="M29.6 19L27.4 30.5L28.6 38.5H26.2L25.4 31Z" fill="#fff1b3"/>` +
    `<path d="M45 18L48 41H42.8Z" fill="#c9931c"/><path d="M36.5 30.5L38.3 41H34.6Z" fill="#c9931c"/>` +
    `<rect x="10.5" y="39" width="39" height="11" rx="2.5" fill="#f0c35a" stroke="${EM_O}" stroke-width="2.5"/><path d="M11.8 45.2H48.2V47.5Q48.2 48.7 47 48.7H13Q11.8 48.7 11.8 47.5Z" fill="#c9931c"/>` +
    `<path d="M13 41.3H25" stroke="#fff1b3" stroke-width="2" stroke-linecap="round"/>` +
    `<g stroke="${EM_O}" stroke-width="2.2">${emDot(15, 16.5, 3.4, "#c24747")}${emDot(45, 16.5, 3.4, "#c24747")}${emDot(30, 10.5, 3.6, "#f0c35a")}<path d="${emPot(30, 44.5, 4.6, -0.2)}" fill="#a86a3b"/></g>` +
    emDot(13.9, 15.4, 1.1, "#ff9d8f") + emDot(28.9, 9.4, 1.2, "#fff1b3") + emDot(28.4, 43.8, 0.9, "#5e3618") + emDot(31.8, 44.6, 0.9, "#5e3618"),
  // Platinum: a trophy, a potato engraved on the bowl, a sheen sweeping across it
  (u) => `<defs><clipPath id="emc${u}"><path d="M14 11H46C46 27 39 37 30 39C21 37 14 27 14 11Z"/></clipPath></defs>` +
    `<path d="M15 14C5 13 5 28 18.5 29M45 14C55 13 55 28 41.5 29" fill="none" stroke="${EM_O}" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M15 14C5 13 5 28 18.5 29M45 14C55 13 55 28 41.5 29" fill="none" stroke="#7fd6c8" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M26 38h8l2 9h-12z" fill="#7fd6c8" stroke="${EM_O}" stroke-width="2.5" stroke-linejoin="round"/><path d="M31.5 38.5h2.3l1.6 8h-2.6z" fill="#3f9d90"/>` +
    `<rect x="17.5" y="46" width="25" height="8" rx="2" fill="#7fd6c8" stroke="${EM_O}" stroke-width="2.5"/><path d="M34 47.3h6.9v5.4H34z" fill="#3f9d90"/>` +
    `<g clip-path="url(#emc${u})"><path d="M14 11H46V40H14Z" fill="#7fd6c8"/><path d="M36.5 10H48V40H36.5Q41 27 36.5 10Z" fill="#3f9d90"/>` +
    `<path d="${emPot(29.5, 22.5, 5.4, -0.3)}" fill="#3f9d90"/>${emDot(27, 21, 1, "#7fd6c8")}${emDot(31.6, 23.4, 1, "#7fd6c8")}` +
    `<path d="M18.8 14.5C18.8 22 21 28.5 25 32.5" fill="none" stroke="#d9fbf5" stroke-width="3" stroke-linecap="round"/>` +
    `<g class="em-sheen"><path d="M2 9H11L4 41H-5Z" fill="#fff" opacity="0.38"/></g></g>` +
    `<path d="M14 11H46C46 27 39 37 30 39C21 37 14 27 14 11Z" fill="none" stroke="${EM_O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<rect x="12" y="8.5" width="36" height="5" rx="2" fill="#7fd6c8" stroke="${EM_O}" stroke-width="2.5"/><path d="M14 10.2H21" stroke="#d9fbf5" stroke-width="2" stroke-linecap="round"/>`,
  // Diamond: a cut gem set on a potato, two sparkles twinkling
  () => `<path d="${emPot(30, 49.6, 6, 0.05, 1.25, 0.8)}" fill="#a86a3b" stroke="${EM_O}" stroke-width="2.4"/>` + emDot(25, 51, 1.1, "#5e3618") + emDot(35.2, 50.6, 1.1, "#5e3618") +
    `<path d="M24.6 46.8q-1.6 1.2-1.4 2.6" fill="none" stroke="#d39a63" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M20 13H40L48 23L30 48L12 23Z" fill="${EM_O}" stroke="${EM_O}" stroke-width="5" stroke-linejoin="round"/>` +
    `<path d="M12 23L20 13L24 23Z" fill="#8fb6ff"/><path d="M40 13L48 23H36Z" fill="#5a86e0"/><path d="M20 13H40L36 23H24Z" fill="#c4dbff"/>` +
    `<path d="M12 23H24L30 48Z" fill="#8fb6ff"/><path d="M36 23H48L30 48Z" fill="#5a86e0"/><path d="M24 23H36L30 48Z" fill="#e4efff"/>` +
    `<path d="M12 23H48M20 13L24 23L30 48L36 23L40 13" fill="none" stroke="#2a4a9a" stroke-width="1.6" stroke-linejoin="round" opacity="0.75"/>` +
    `<path d="M22.6 15.2H28.4L26.6 20.5H21.3Z" fill="#fff"/>` +
    `<path class="em-tw" d="${emStar(46, 9.5, 4, 4.6, 1.3)}" fill="#fff"/><path class="em-tw b" d="${emStar(12.5, 12.5, 4, 3.6, 1.1)}" fill="#fff"/>`,
  // Blastmaster: the bomb-tater, a lit fuse, a turning burst behind it
  (u) => `<path class="em-burst" d="${emStar(30, 30, 12, 27, 19.5)}" fill="#ffb347" opacity="0.9"/>` +
    `<path d="${emStar(30, 30, 12, 23.5, 17)}" fill="#ffe08a" opacity="0.55"/>` +
    `<defs><clipPath id="emc${u}"><path d="${emPot(29.5, 35, 15, -0.2, 1.14, 0.9)}"/></clipPath></defs>` +
    `<path d="M37 23C38.5 16.5 43 18 43.5 14" fill="none" stroke="#3b2b2b" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M32.6 20.6l5.8 0.9-0.8 4.8-5.8-0.9z" fill="#5a4a52" stroke="${EM_O}" stroke-width="2" stroke-linejoin="round"/>` +
    `<g clip-path="url(#emc${u})"><path d="M0 0H60V60H0Z" fill="#b8432a"/><path d="${emPot(27.8, 33.2, 13.6, -0.2, 1.14, 0.9)}" fill="#ef7a52"/>` +
    `<path d="${emCres(27.4, 33.6, 12, 190, 258, 2.8)}" fill="#ffb08a"/></g>` +
    `<path d="M33.5 41.5q2.2 1.6 4.5 0.4M38.5 31.5q1.8 1.4 3.6 0.2M19 39q1.8 1.3 3.8 0.4" fill="none" stroke="#b8432a" stroke-width="2" stroke-linecap="round"/>` +
    emLine("M23.5 24L26 29L22.5 32.5L27.5 36.5L26 41", "#fff1d6", 2.2) +
    `<path d="${emPot(29.5, 35, 15, -0.2, 1.14, 0.9)}" fill="none" stroke="${EM_O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<g class="em-spark"><path d="${emStar(43.5, 13, 4, 6, 1.8)}" fill="#ffe08a" stroke="#ef7a52" stroke-width="1"/>${emDot(43.5, 13, 1.6, "#fff")}</g>`,
];
let emSvg = null, emSeq = 0;
// the emblem of tier i as SVG markup (cls: extra classes on the <svg>)
function tierEmblem(i, cls) {
  if (!emSvg) emSvg = EMB.map((f) => f("%U"));
  return `<svg class="em em${i}${cls ? " " + cls : ""}" viewBox="0 0 60 60" aria-hidden="true" focusable="false">${emSvg[i].replace(/%U/g, String(++emSeq))}</svg>`;
}
// the emblem as a small labelled badge in markup (the cup bracket)
const tierBadge = (i, cls) => `<i class="${cls}" role="img" aria-label="${_t("{name} tier", { name: _tv(TIERS[i].name) })}" title="${_tv(TIERS[i].name)}">${tierEmblem(i)}</i>`;
// paint tier i's emblem into el (the pill, the Account sheet, the results). from < i: a promotion, the old emblem spins out first.
function paintBadge(el, i, from) {
  const t = TIERS[i], up = from != null && from >= 0 && from < i;
  el.style.setProperty("--tc", t.col);
  el.setAttribute("role", "img"); el.setAttribute("aria-label", _t("{name} tier", { name: _tv(t.name) })); el.title = _tv(t.name);
  el.innerHTML = tierEmblem(i) + (up ? tierEmblem(from, "was") : "");
  el.classList.remove("promo");
  if (up) { void el.offsetWidth; el.classList.add("promo"); }
}

/* ===================== sound (WebAudio, synthesized) ===================== */
const Sfx = {
  ctx: null, out: null, noiseBuf: null, humO: null, humG: null, humT: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain(); this.out.gain.value = 0.55; this.out.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  ok() { return P.sound && this.ctx && this.ctx.state === "running"; },
  env(g, t, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  tone(f0, f1, dur, type, vol) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, vol, dur); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol, freq) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = "lowpass"; f.frequency.value = freq;
    this.env(g, t, vol, dur); s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },
  hit(kb) { const k = Math.min(1, kb / 30); this.noise(0.05 + k * 0.14, 0.3 + k * 0.45, 2600 - k * 1700); this.tone(190 - k * 100, 45, 0.08 + k * 0.16, "sine", 0.45 + k * 0.4); },
  armor() { this.tone(520, 380, 0.12, "square", 0.08); this.noise(0.05, 0.2, 3000); },
  ko() { this.noise(0.7, 0.75, 700); this.tone(110, 28, 0.8, "sawtooth", 0.3); this.tone(900, 180, 0.45, "square", 0.06); },
  jump() { this.tone(280, 520, 0.08, "triangle", 0.1); },
  dash() { this.noise(0.1, 0.07, 1500); },   // the sprint's push-off
  swing(h) { this.noise(h ? 0.13 : 0.06, h ? 0.12 : 0.06, h ? 1000 : 2200); },
  count(go) { this.tone(go ? 880 : 440, go ? 880 : 440, go ? 0.32 : 0.12, "square", 0.08); },
  ui() { this.tone(620, 840, 0.05, "triangle", 0.07); },
  /* ---- menu cues ("sunset ink" redesign; each one is over within 120 ms). ui() above is the plain wooden tap. ---- */
  // primary (Play, Fight, Next, Resume): the tap, then a rising two-note chip "ding"
  uiGo() { this.tone(620, 840, 0.045, "triangle", 0.07); this.at(0.035, 1319, 1319, 0.04, "sine", 0.05); this.at(0.065, 1976, 1976, 0.05, "sine", 0.045); },
  // back / close: a lower, shorter tap
  uiBack() { this.tone(430, 300, 0.05, "triangle", 0.08); this.noise(0.02, 0.04, 1800); },
  // roster pick / tab: a soft paper flip (two quick brushes of filtered noise)
  uiFlip() { this.noiseF(0.045, 0.16, "bandpass", 1600, 4200, 0.8); this.noiseF(0.05, 0.11, "bandpass", 2600, 5200, 0.9, 0.04); },
  // sticker / chips: a coin tick
  uiCoin() { this.at(0, 1976, 1976, 0.03, "square", 0.025); this.at(0.03, 2637, 2637, 0.07, "sine", 0.05); },
  // a disabled control: a dull thud
  uiNo() { this.tone(150, 80, 0.09, "sine", 0.11); this.noise(0.04, 0.05, 500); },
  // the cue for a control (the shared tap helper in menus.js): data-sfx="go|back|flip|coin|no|tap" wins; otherwise a gold primary
  // button (.primary / .pri) says "go", a back arrow (.back) or a close X (.x) says "back", anything else is the plain tap
  cue(el) {
    const k = (el && el.dataset && el.dataset.sfx) || (el && el.classList ? (el.classList.contains("primary") || el.classList.contains("pri") ? "go" : el.classList.contains("back") || el.classList.contains("x") ? "back" : "tap") : "tap");
    if (k === "go") this.uiGo(); else if (k === "back") this.uiBack(); else if (k === "flip") this.uiFlip(); else if (k === "coin") this.uiCoin(); else if (k === "no") this.uiNo(); else this.ui();
  },
  // a tone that starts dt seconds from now (audio-clock timing, for cues shorter than a setTimeout can place)
  at(dt, f0, f1, dur, type, vol) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + dt, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, vol, dur); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.03);
  },
  route() { this.tone(660, 990, 0.09, "triangle", 0.08); this.tone(990, 1320, 0.16, "triangle", 0.06); },
  fire() { this.noise(0.35, 0.3, 900); this.tone(170, 80, 0.3, "sawtooth", 0.06); },
  bolt(low) { this.tone(low ? 420 : 900, low ? 260 : 1500, 0.12, "triangle", 0.07); },
  burst() { this.noise(0.25, 0.35, 1400); this.tone(220, 90, 0.2, "sine", 0.25); },
  caw() { this.tone(700, 420, 0.09, "sawtooth", 0.05); setTimeout(() => this.tone(650, 380, 0.08, "sawtooth", 0.045), 110); },
  fry() { this.tone(980, 520, 0.06, "square", 0.045); this.noise(0.04, 0.08, 4000); },
  // Gunslinger: a crisp crack with a low thump; the golden High Noon shot is heavier and leaves a whine
  shot(gold) {
    this.noiseF(0.07, 0.5, "highpass", 2400, 900, 0.7); this.noise(0.09, 0.3, 2600); this.tone(260, 55, 0.1, "sine", 0.3);
    if (gold) { this.noise(0.35, 0.4, 1200); this.tone(150, 38, 0.35, "sine", 0.45); this.later(90, () => this.tone(2600, 1300, 0.3, "sine", 0.04)); }
  },
  // the Gunslinger's light attacks are point-blank shots: a short dry pop, quieter than Twin Shot
  pop() { this.noiseF(0.05, 0.26, "highpass", 2600, 1200, 0.7); this.noise(0.05, 0.14, 2800); this.tone(300, 80, 0.06, "sine", 0.14); },
  // Reaper: Harvest is a low whoosh with two passing swishes as the scythe comes round; Grave rise a soft dark rush
  harvest() {
    this.noiseF(0.55, 0.26, "bandpass", 260, 820, 0.9); this.tone(92, 58, 0.45, "sine", 0.2);
    for (let i = 1; i <= 2; i++) this.later(i * 120, () => this.noiseF(0.12, 0.16, "highpass", 1400, 3800, 1.1));
  },
  graveRise() { this.noiseF(0.5, 0.22, "lowpass", 700, 180, 0.8); this.tone(70, 110, 0.4, "sine", 0.16); },
  /* ---- Ultimates (ui/effects.js, ui/draw-*.js) ---- */
  // the super freeze: a deep boom, a chord that climbs an octave while a whoosh sweeps up, a bright chime as the freeze lets go (0.5 s)
  ulti() {
    if (!this.ok()) return;
    this.tone(150, 36, 0.6, "sine", 0.6); this.noise(0.3, 0.3, 900);
    this.noiseF(0.55, 0.32, "bandpass", 260, 3400, 0.9);
    [[262, 523], [330, 659], [392, 784], [523, 1047]].forEach(([a, b], i) => this.later(i * 40, () => { this.tone(a, b, 0.62, "sawtooth", 0.045); this.tone(a, b, 0.62, "triangle", 0.07); }));
    this.later(440, () => { this.tone(1568, 1568, 0.6, "sine", 0.07); this.tone(2093, 2093, 0.5, "sine", 0.045); this.noiseF(0.3, 0.12, "highpass", 5000, 8000, 1.2); });
  },
  // a bar fills (called by the HUD): a bright clink
  ultFull() {
    this.tone(1568, 1568, 0.38, "sine", 0.09); this.tone(3136, 3136, 0.2, "triangle", 0.035); this.noise(0.03, 0.18, 6500);
    this.later(70, () => { this.tone(2093, 2093, 0.45, "sine", 0.08); this.tone(4186, 4186, 0.15, "sine", 0.02); });
  },
  ultHit() { this.tone(1568, 1568, 0.3, "sine", 0.05); this.later(60, () => this.tone(2349, 2349, 0.3, "sine", 0.04)); },
  ultMark() { this.tone(1320, 1320, 0.1, "square", 0.035); this.later(110, () => this.tone(1760, 1760, 0.14, "square", 0.035)); },
  // Phoenix lands: a deep boom, a crackle of fire
  ultLand() { this.tone(110, 28, 0.7, "sine", 0.7); this.noise(0.6, 0.6, 600); this.noiseF(0.5, 0.3, "highpass", 3000, 7000, 1.2); this.later(40, () => this.tone(60, 30, 0.5, "sawtooth", 0.15)); },
  // Alchemist: the flask bursts into a cloud; every pulse is a wet thump (the last one, which launches, a big one)
  cloud() { this.noiseF(0.5, 0.22, "highpass", 3200, 1400, 0.8); for (let i = 0; i < 4; i++) this.later(i * 70, () => this.tone(190 + i * 40, 360 + i * 60, 0.07, "sine", 0.1)); },
  cloudPulse(last) {
    this.tone(last ? 200 : 170, 60, last ? 0.4 : 0.2, "sine", last ? 0.55 : 0.3); this.noise(last ? 0.35 : 0.14, last ? 0.4 : 0.22, last ? 900 : 1300);
    for (let i = 0; i < 3; i++) this.later(i * 45, () => this.tone(260 + i * 90, 520 + i * 120, 0.06, "sine", 0.07));
  },
  // Odin: a heavy whoosh and a metal ring as the spear leaves his hand
  spear() { this.noiseF(0.4, 0.34, "bandpass", 500, 2600, 0.9); this.tone(95, 45, 0.35, "sine", 0.4); this.tone(1400, 900, 0.3, "triangle", 0.05); this.later(60, () => this.tone(2100, 1500, 0.25, "sine", 0.03)); },
  // Wizard: a rising chime for every star called, a whistle down, a thump and sparkle on the floor
  starCall() { this.tone(1047, 1568, 0.25, "triangle", 0.05); this.tone(2093, 2637, 0.18, "sine", 0.025); },
  starHit(big) { this.tone(big ? 130 : 170, 45, big ? 0.3 : 0.16, "sine", big ? 0.55 : 0.32); this.noise(big ? 0.28 : 0.12, big ? 0.4 : 0.22, 1600); this.tone(big ? 1319 : 1568, big ? 1319 : 1568, 0.35, "sine", 0.05); this.later(50, () => this.tone(2093, 2093, 0.3, "sine", 0.035)); },
  // Samurai: the dash is a long high shing; the sheath click (the cut lands) a hard click, a thump and a shimmer
  cutPass() { this.noiseF(0.3, 0.26, "highpass", 2800, 7000, 2); this.tone(2300, 3800, 0.28, "sine", 0.06); },
  cutClick() {
    this.tone(1500, 900, 0.06, "square", 0.12); this.noise(0.04, 0.3, 5200); this.tone(110, 40, 0.3, "sine", 0.5);
    this.noiseF(0.25, 0.3, "highpass", 3200, 7500, 1.8); this.later(40, () => { this.tone(2637, 2637, 0.5, "sine", 0.05); this.tone(3951, 3951, 0.35, "sine", 0.025); });
  },
  // Dragon: a long roar while the stream burns, a boom for the blast at its end
  hellfire() {
    this.noiseF(1.0, 0.36, "lowpass", 1500, 380, 0.7); this.tone(95, 55, 0.9, "sawtooth", 0.12); this.tone(104, 62, 0.85, "sawtooth", 0.09);
    this.noiseF(0.5, 0.2, "bandpass", 900, 2200, 1.1);
  },
  hellBlast() { this.tone(72, 26, 0.6, "sine", 0.6); this.noise(0.45, 0.5, 800); this.noiseF(0.35, 0.28, "highpass", 2400, 6000, 1.2); },
  // Gunslinger: a heartbeat and a thin whine as the dead eye opens
  deadEye() { this.tone(72, 44, 0.14, "sine", 0.5); this.later(150, () => this.tone(66, 40, 0.16, "sine", 0.45)); this.tone(1800, 2600, 0.5, "sine", 0.025); this.noiseF(0.4, 0.1, "bandpass", 1200, 3000, 1.5); },
  // Reaper: the tug is a low, hollow pull with whispers; the sweep a hard white swish with a ring
  reapPull() { this.noiseF(0.7, 0.24, "bandpass", 700, 200, 1.1); this.tone(90, 52, 0.7, "sine", 0.22); this.tone(660, 330, 0.5, "triangle", 0.03); this.later(160, () => this.tone(520, 260, 0.45, "triangle", 0.025)); },
  reapSweep() { this.noiseF(0.28, 0.42, "highpass", 1400, 6200, 1.3); this.later(40, () => this.tone(3100, 2400, 0.22, "sine", 0.06)); this.tone(120, 50, 0.3, "sine", 0.4); },
  // filtered noise with a sweep: type "bandpass" | "highpass" | "lowpass"; dt (optional) starts it that many seconds from now
  noiseF(dur, vol, type, f0, f1, q, dt) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + (dt || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    this.env(g, t, vol, dur); s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },
  later(ms, fn) { setTimeout(() => { if (this.ok()) fn(); }, ms); },
  // Charge hum: ONE oscillator rising 140 -> 420 Hz across the charge. humStep() (effects.js) calls hum(frames) every rendered frame while a
  // heavy is held; hum(0) stops it. A dead-man timer stops it by itself when the frames stop coming (hidden tab), so it can never keep droning.
  hum(chg) {
    if (!(chg > 0) || !this.ok()) { this.humOff(); return; }
    const c = this.ctx, t = c.currentTime, k = Math.min(1, chg / 60), fr = 140 + 280 * k, v = 0.04 + 0.03 * k;
    if (!this.humO) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(fr, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.06);
      o.connect(g); g.connect(this.out); o.start(t);
      this.humO = o; this.humG = g;
    } else { this.humO.frequency.setTargetAtTime(fr, t, 0.03); this.humG.gain.setTargetAtTime(v, t, 0.04); }
    clearTimeout(this.humT); this.humT = setTimeout(() => this.humOff(), 260);
  },
  humOff() {
    clearTimeout(this.humT); this.humT = 0;
    const o = this.humO, g = this.humG;
    if (!o) return;
    this.humO = this.humG = null;
    try { const t = this.ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.02); o.stop(t + 0.1); } catch (e) { /* already stopped */ }
    setTimeout(() => { try { o.disconnect(); g.disconnect(); } catch (e) { /* gone */ } }, 300);
  },
  // Heavy attacks: a low "whoomp" under every heavy, then a signature per fighter and move (id = fighter, key = hSide / hUp / hDown / hAir)
  heavy(id, key) {
    if (!this.ok()) return;
    const up = key === "hUp", dn = key === "hDown", air = key === "hAir";
    this.tone(180, 50, 0.3, "sine", 0.42); this.noise(0.22, 0.2, 500);
    switch (id) {
      case "dragon": // a rip and a short growl; fwap for the horn toss, low whoosh and thud for the tail
        this.noiseF(0.22, 0.3, "bandpass", 1800, 1800, 1.1);
        this.tone(105, 62, 0.32, "sawtooth", 0.12); this.tone(112, 70, 0.28, "sawtooth", 0.09);
        if (up) this.noiseF(0.16, 0.35, "bandpass", 500, 1700, 1.4);
        if (dn) { this.noiseF(0.3, 0.3, "lowpass", 900, 200, 0.8); this.later(110, () => this.tone(95, 38, 0.2, "sine", 0.4)); }
        break;
      case "samurai": // shing
        this.noiseF(0.28, 0.22, "highpass", 2600, 6500, 2.2); this.tone(2300, 3600, 0.26, "sine", 0.07); this.tone(3400, 5200, 0.2, "triangle", 0.035);
        if (key === "hSide") this.later(330, () => { this.tone(1500, 900, 0.05, "square", 0.09); this.noise(0.03, 0.2, 5000); });   // the click as the blade is sheathed
        break;
      case "odin": // deep thud with ice crackle, a caw for the raven, a boom for the stomp
        this.tone(95, 38, 0.42, "sine", 0.55);
        this.noiseF(0.18, 0.18, "highpass", 5200, 3600, 2);
        if (up) this.later(60, () => this.caw());
        if (dn) { this.tone(70, 28, 0.6, "sine", 0.55); this.noise(0.4, 0.3, 380); }
        if (!up && !dn) this.later(80, () => { this.noiseF(0.1, 0.12, "highpass", 6200, 5200, 3); this.noiseF(0.08, 0.1, "highpass", 4600, 6200, 3); });
        break;
      case "wizard": // a chime over the whoomp; boom plus chime for the slam
        this.tone(880, 880, 0.5, "sine", 0.07); this.later(70, () => this.tone(1318, 1318, 0.5, "sine", 0.06));
        if (dn) { this.tone(80, 30, 0.5, "sine", 0.55); this.noise(0.3, 0.25, 420); this.later(120, () => { this.tone(1760, 1760, 0.6, "sine", 0.05); this.tone(2093, 2093, 0.5, "sine", 0.035); }); }
        break;
      case "phoenix": // a fire roar; fwap plus fire for the wing flare; thud and sizzle for the stomp
        this.noiseF(0.4, 0.3, "lowpass", 1300, 500, 0.7); this.tone(210, 90, 0.34, "sawtooth", 0.06);
        if (up) this.noiseF(0.14, 0.3, "bandpass", 600, 1800, 1.4);
        if (dn) { this.tone(90, 34, 0.3, "sine", 0.45); this.later(80, () => this.noiseF(0.35, 0.16, "highpass", 3800, 7000, 1.3)); }
        break;
      case "gunslinger": // three fanned cracks for the side blast, two cracks for the sky and floor shots, a dull thud of dust for the floor
        for (let i = 0; i < (up || dn ? 2 : 3); i++) this.later(i * (up || dn ? 30 : 55), () => { this.noiseF(0.06, 0.45, "highpass", 2600, 1000, 0.7); this.tone(240, 60, 0.08, "sine", 0.22); });
        if (dn) this.later(40, () => this.noise(0.25, 0.2, 500));
        if (!up && !dn && !air) this.later(170, () => this.tone(1800, 1500, 0.06, "triangle", 0.03));   // a spent shell rings on the floor
        break;
      case "reaper": // "shhk": a fast hiss rising through the swing, a thin metal ring off the blade; a second swish for the full turns, earth for the grave sweep
        this.noiseF(0.16, 0.34, "highpass", 1600, 5600, 1.3); this.later(70, () => this.tone(3100, 2500, 0.12, "sine", 0.045));
        if (!up) this.later(110, () => this.noiseF(0.14, 0.24, "highpass", 2200, 5200, 1.3));
        if (dn) this.later(60, () => this.noise(0.28, 0.2, 480));
        break;
      case "alchemist": // zap crackle; glass and a burst for the flask
        if (dn) {
          this.noiseF(0.2, 0.2, "highpass", 3200, 6800, 1.5); this.tone(2600, 1700, 0.18, "triangle", 0.06); this.tone(3600, 2400, 0.14, "triangle", 0.04);
          this.later(60, () => this.burst());
        } else { for (let i = 0; i < 4; i++) this.later(i * 38, () => this.tone(900 + Math.random() * 1500, 300 + Math.random() * 400, 0.05, "square", 0.05)); this.noiseF(0.18, 0.12, "highpass", 4000, 6000, 1); }
        break;
    }
  },
};

