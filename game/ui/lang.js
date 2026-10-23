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
// Russian: the Cyrillic letters of "Barlow Condensed" come from web/rc-cyr-*.woff2 (the @font-face rules in shell.html). The canvas
// does not wait for a font, so both faces are fetched now, long before the first word is drawn.
if (LANG === "ru" && document.fonts && document.fonts.load) { for (const f of ['italic 900 20px "Barlow Condensed"', '700 20px "Barlow Condensed"']) document.fonts.load(f, "Жж").catch(() => {}); }
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
