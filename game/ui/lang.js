/* ===================== languages: English, French, German, Spanish, Russian (UI only) =====================
   Every string a player can see goes through _t("English text", { vars }). The English text is the key, and it is also the fallback when a
   table has no line for it, so a missing line shows English, never a blank. The tables are game/lang/<fr|de|es|ru>.json ("English": "theirs"),
   put in below by build.py; tools/i18n.js (check.sh "lang") checks that every key is in every table with the same {vars} and tags.
   - {name} in the text is filled from vars. The translation may move it; values are put in as they are (escape a name before it goes into innerHTML,
     exactly as before).
   - Plurals: "{n} chip|{n} chips" (one|other); vars.n (a number) picks the form by the language's rules. Russian lines have three forms
     (one|few|many), the others two.
   - "Free@@price": the part after @@ is a note for the translators (two meanings of one English word); English shows "Free".
   - _tv(text) is _t for text that comes from core.js data (roles, blurbs, move and skin names): tools/i18n.js reads those keys from core.js;
     and for a base.js table whose texts are marked with _tk (below).
   - The page markup (shell.html) is translated once, here at start, by _tDom: each text and label (aria-label, title, placeholder, alt) is
     looked up by its English text. translate="no" keeps an element and everything in it as it is (names, the wordmark).
   - The language: ?lang=xx in the address (tests), else the one picked in Settings or on the welcome sheet (this device only), else the first of
     the five the browser lists, else English. A change saves and reloads the page, so a screen is never half in one language.
   - ?lang=xx is the pseudo-language: every string in ⟦ ⟧ with accented letters and a third longer, to find strings not wrapped yet and boxes
     too tight for German or Russian (tests/pwlang.py). It is never offered in the picker. */
const LANGS = ["en", "fr", "de", "es", "ru"];
const LANG_NAMES = { en: "English", fr: "Français", de: "Deutsch", es: "Español", ru: "Русский" };
const LANG_KEY = "potatobrawl.lang";
const LANG_T = /*LANGS*/{};
const LANG = (() => {
  const ok = (l) => (LANGS.includes(l) ? l : null);
  try { const m = /[?&]lang=([a-z]{2})(?:&|$)/.exec(location.search); if (m && (ok(m[1]) || m[1] === "xx")) return m[1]; } catch (e) { /* no address */ }
  try { const s = ok(localStorage.getItem(LANG_KEY)); if (s) return s; } catch (e) { /* storage unavailable */ }
  try { for (const l of navigator.languages || [navigator.language]) { const k = ok(String(l || "").slice(0, 2).toLowerCase()); if (k) return k; } } catch (e) { /* no navigator */ }
  return "en";
})();
// numbers and dates follow the language (1,350 / 1 350 / 1.350); the pseudo-language keeps English formats
const LOC = { en: "en-US", fr: "fr-FR", de: "de-DE", es: "es-ES", ru: "ru-RU" }[LANG] || "en-US";
const LANG_PL = LANG === "ru" ? ["one", "few", "many"] : ["one", "other"];   // the order of a plural line's forms
const langRules = (() => { try { return new Intl.PluralRules(LANG === "xx" ? "en" : LANG); } catch (e) { return null; } })();
function tPlural(s, n) {
  const f = s.split("|");
  if (f.length < 2) return s;
  const c = typeof n === "number" && langRules ? langRules.select(Math.abs(n)) : "other", i = LANG_PL.indexOf(c);
  return f[i >= 0 && i < f.length ? i : f.length - 1];
}
function tPseudo(s) {
  const acc = { a: "á", e: "é", i: "í", o: "ó", u: "ú", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", c: "ç", n: "ñ" };
  let len = 0;
  const out = s.replace(/(<[^>]*>|\{\w+\}|&#?\w+;)|([^<{&]+)/g, (m, keep, txt) => (keep ? keep : (len += txt.length, txt.replace(/[aeiouAEIOUcn]/g, (ch) => acc[ch]))));
  return "⟦" + out + " ~~~".repeat(Math.ceil(len * 0.35 / 4)) + "⟧";   // the extra third in short words, so a paragraph can still wrap
}
function _t(s, v) {
  const tb = LANG_T[LANG];
  let r = tb && Object.prototype.hasOwnProperty.call(tb, s) ? tb[s] : null;
  if (r === null) { const at = s.indexOf("@@"); r = at < 0 ? s : s.slice(0, at); }
  if (r.indexOf("|") >= 0) r = tPlural(r, v && v.n);
  if (LANG === "xx") r = tPseudo(r);
  return v ? r.replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? m : v[k])) : r;
}
const _tv = (s, v) => (s ? _t(String(s), v) : s);
// _tk("Bronze") marks a text as a key and returns it as it is, for a table in base.js, which runs before this part (a hoisted function,
// so it works there); show it later with _tv(t.name). Anywhere after base.js, use _t at the definition instead.
function _tk(s) { return s; }
// the page markup, once at start: text and labels by their English text (whitespace runs count as one space)
const tKey = (s) => { const k = String(s).replace(/\s+/g, " ").trim(); return /[A-Za-z]{2}/.test(k) ? k : null; };
function _tDom(root) {
  if (LANG === "en") return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeType === 1 && (n.tagName === "SCRIPT" || n.tagName === "STYLE" || n.getAttribute("translate") === "no") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const all = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) all.push(n);
  for (const n of all) {
    if (n.nodeType === 3) {
      const k = tKey(n.nodeValue);
      if (k) n.nodeValue = /^\s*/.exec(n.nodeValue)[0] + _t(k) + /\s*$/.exec(n.nodeValue)[0];
      continue;
    }
    for (const a of ["aria-label", "title", "placeholder", "alt"]) { const k = n.hasAttribute(a) && tKey(n.getAttribute(a)); if (k) n.setAttribute(a, _t(k)); }
  }
}
document.documentElement.lang = LANG === "xx" ? "en" : LANG;
_tDom(document.body);
// the words written in the style sheets (content: var(--tw-<id>, "English"))
if (LANG !== "en") {
  for (const [id, s] of [["finish", _t("· finish")], ["locked", _t("(locked)")], ["vs", _t("vs")], ["you", _t("YOU")], ["worn", _t("Worn")], ["cpu", _t("CPU")], ["live", _t("LIVE")], ["drag", _t("DRAG")]]) {
    document.documentElement.style.setProperty("--tw-" + id, JSON.stringify(s));
  }
}
/* Russian: Barlow has no Cyrillic letters, so Barlow Condensed's come from Roboto Condensed (game/fonts/rc-cyr-n|i.woff2, SIL OFL, one
   variable file per style, inlined by build.py), added under Barlow Condensed's own name with the same six weights as its Google faces (a
   face with a weight range would win the match and drop the Latin letters), limited to the Cyrillic letters: every font list in the page
   and the canvas gets them, in every language (the Settings row says Русский). In the page, so a downloaded copy has them too. */
const T_CYR = /*RCCYR*/null;
if (T_CYR && typeof FontFace === "function" && document.fonts) {
  try {
    const buf = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer, n = buf(T_CYR.n), i = buf(T_CYR.i);
    for (const [style, weight, b] of [["normal", "600", n], ["normal", "700", n], ["normal", "800", n], ["italic", "700", i], ["italic", "800", i], ["italic", "900", i]]) {
      const f = new FontFace("Barlow Condensed", b, { style, weight, display: "swap", unicodeRange: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" });
      document.fonts.add(f);
    }
  } catch (e) { /* an old browser: Russian shows in the system font */ }
}
/* Tight labels (a tile's title, a card's name, a role under a portrait) that a longer language can run out of: the font steps down, at
   most to 70% of the style sheet's size, until the text stays inside its box (the nearest box that clips, its button, chip, tag or pill,
   the screen). It runs again when such a text changes or its box is resized or shown, one frame later (never inside the observer). */
// lines of a few words in a box of fixed height: these step down to 82% at most
const T_FIT_P = "#dSig span, #dUlt span, #dBlurb, #skFx, .sk-k span, .hv-wait";
const T_FIT = ["#bDaily b", "#bBw b", "#bRanked .mm-ttl", ".mm-mt", "#bPractice small", "#mBwR .bw-p", "#mRankKick", "#mRec", "#mDaily", "#mDailyR",
  "#dSkFx", "#oppPick small", "#mapPick small", "#qmFRole", "#onFRole", "#qmR b", "#qmC b", "#qmC small", "#qmV b", "#qmVSub", "#qmToV b", "#qmRating",
  "#skRoad b", "#skRoad small", "#skPm b", "#skPm small", "#skChip small", ".ps-nm", ".ps-c .s", ".ps-c .l", ".ps-btn", "#acPanH b", "#acPanH small",
  "#acBds b", "#acBds small", "#acBds .bd-rk", ".bw-tw", "#welGo span", T_FIT_P].join(", ");
const T_BOX = "button, .btn, .chip, .tag, .coin, [class*='pill'], [class*='badge']";
// a text that must also keep clear of a tag drawn over its box's corner
const T_AVOID = { "#bBw b": "#mBwTag" };
function tOver(el) {
  const rg = document.createRange(); rg.selectNodeContents(el);
  const rs = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  if (!rs.length) return false;
  const out = (b, m) => { const r = b.getBoundingClientRect(); return rs.some((q) => q.left < r.left - m || q.right > r.right + m || q.top < r.top - m || q.bottom > r.bottom + m); };
  for (let a = el; a && a !== document.body; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) break;   // a strip that scrolls is fine
    if (out(a, 1)) return true;
    break;
  }
  const box = el.closest(T_BOX);
  if ((box && out(box, 1.5)) || rs.some((q) => q.left < 0 || q.right > innerWidth)) return true;
  for (const k in T_AVOID) if (el.matches(k)) { const o = document.querySelector(T_AVOID[k]); if (o && !o.hidden && o.offsetWidth) { const r = o.getBoundingClientRect(); if (rs.some((q) => q.right > r.left + 1 && q.left < r.right - 1 && q.bottom > r.top + 1 && q.top < r.bottom - 1)) return true; } }
  return false;
}
function tFit(el) {
  el.style.fontSize = "";
  if (!el.isConnected || !tOver(el)) return;
  const base = parseFloat(getComputedStyle(el).fontSize);
  for (let fs = base * 0.93, min = base * (el.matches(T_FIT_P) ? 0.82 : 0.7); fs >= min; fs *= 0.93) { el.style.fontSize = fs.toFixed(1) + "px"; if (!tOver(el)) return; }
}
const tFitQ = new Set();
let tFitRaf = 0;
const tFitLater = (el) => { tFitQ.add(el); if (!tFitRaf) tFitRaf = requestAnimationFrame(() => { tFitRaf = 0; const q = [...tFitQ]; tFitQ.clear(); for (const e of q) tFit(e); }); };
const tFitSeen = new WeakSet();
const tFitRo = typeof ResizeObserver === "function" ? new ResizeObserver((es) => { for (const e of es) for (const t of e.target.__tfit || []) tFitLater(t); }) : null;
function tFitWatch(el) {
  if (tFitSeen.has(el)) return;
  tFitSeen.add(el);
  const box = el.closest(T_BOX) || el.parentElement || el;   // an inline text has no size of its own to observe
  (box.__tfit || (box.__tfit = [])).push(el);
  if (tFitRo) tFitRo.observe(box);
  tFitLater(el);
}
for (const el of document.querySelectorAll(T_FIT)) tFitWatch(el);
new MutationObserver((ms) => {
  if (mode === "match") return;   // the fight's HUD changes every frame and has none of these
  for (const m of ms) {
    const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
    const hit = t && t.closest(T_FIT);
    if (hit) { tFitWatch(hit); tFitLater(hit); }
    if (t) for (const k in T_AVOID) if (t.closest(T_AVOID[k])) { const e = document.querySelector(k); if (e) tFitLater(e); }   // the tag got a word
    for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches(T_FIT)) tFitWatch(n); for (const e of n.querySelectorAll(T_FIT)) tFitWatch(e); }
  }
}).observe(document.body, { childList: true, characterData: true, subtree: true });
addEventListener("resize", () => { for (const el of document.querySelectorAll(T_FIT)) tFitLater(el); });
// a change saves the choice and loads the page again (a ?lang= in the address would win over it, so it goes)
function langSet(l) {
  if (!LANGS.includes(l) || l === LANG) return;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* storage unavailable: the browser's language stays */ }
  try { const u = new URL(location.href); u.searchParams.delete("lang"); if (u.href !== location.href) { location.replace(u.href); return; } } catch (e) { /* old browser */ }
  location.reload();
}
// Settings: the Language row, each language named in itself. Only on the start page: the change reloads, so never in a match or a lobby.
function langRow() {
  const row = $("setLangRow");
  row.hidden = mode !== "menu";
  if (!row.hidden) chipRow("setLang", LANGS.map((l) => [l, LANG_NAMES[l]]), LANG, langSet);
}
// the welcome sheet (first open): the five as short buttons, the one in use lit
function langWel() {
  const box = $("welLang");
  box.innerHTML = "";
  for (const l of LANGS) {
    const b = document.createElement("button");
    b.className = "wl-l" + (l === LANG ? " on" : ""); b.textContent = l.toUpperCase(); b.title = LANG_NAMES[l]; b.setAttribute("aria-label", LANG_NAMES[l]);
    b.addEventListener("click", () => { Sfx.init(); Sfx.ui(); langSet(l); });
    box.appendChild(b);
  }
}
// tests/pwlang.py: opens each screen by its own open function, for the sweep of every language at every size (nothing else uses it)
window.__blTour = (id) => {
  const T = { menu: () => goMenu(), select: () => openSelect("practice"), skins: () => openSkins(P.last), pshop: () => pshopOpen(P.last), help: () => openHelp(),
    settings: () => openSettings(), account: () => openAccount(), shop: () => openAccount("h"), daily: () => dailyOpen(), road: () => openRoad(),
    stop: () => { openRoad(); roadSheet(0); }, quick: () => quickOpen(), online: () => openOnline(), boards: () => bdOpen(), bw: () => bwSheetOpen(),
    tc: () => tcOpen(), cup: () => cupOpen(), welcome: () => welcomeOpen(), match: () => { openSelect("practice"); startMatch(); },
    pause: () => togglePause(true), result: () => { togglePause(false); finishMatch(true); } };
  T[id]();
  return mode;
};
