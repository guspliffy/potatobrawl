#!/usr/bin/env node
/* The language tables' check (check.sh "lang"; game/ui/lang.js has the rules).
   Collects every key the game can ask for:
     - code: the first argument of each _t("...") in game/ui/*.js, game/manga/*.js and game/skinfx.js (a literal: a computed key can't be
       translated ahead, so _t(x) or _t(`${x}`) is an error; _tv(x) is the one form for core.js data, below)
     - markup: each text and label (aria-label, title, placeholder, alt) in game/shell.html's page, as ui/lang.js _tDom reads it
     - data: from core.js, the fighters' and bosses' role, blurb, move names and texts and skin names (what the page shows with _tv)
   and checks game/lang/<fr|de|es|ru>.json: every key has a line, with the same {vars} and tags, and plural lines ("a|b") have the language's
   number of forms (Russian 3, the others 2). Lines no key asks for any more are listed (not an error; --prune drops them).
     node tools/i18n.js               the check: one summary line per language, exit 1 on any error
     node tools/i18n.js --src         only the code and markup (the _t calls): for the builders while the tables are still empty
     node tools/i18n.js --keys        every key as JSON lines {k, at, src}: at = where it is used, src = that line, for the translators
     node tools/i18n.js --missing de  the same for the keys the German table lacks
     node tools/i18n.js --prune       drop the stale lines from every table */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const G = path.join(ROOT, "game");
const LANGS = ["fr", "de", "es", "ru"];
const FORMS = { fr: 2, de: 2, es: 2, ru: 3 };
const errors = [], keys = new Map();   // key -> { at: [where], src: the first line }
const add = (k, at, src) => { if (!keys.has(k)) keys.set(k, { at: [], src: src || "" }); const e = keys.get(k); if (e.at.length < 6) e.at.push(at); };

/* ---------- code ---------- */
// comments out (kept as blank space, so line numbers stay), strings left alone
function noComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[\s;,(){}])\/\/[^\n]*/g, (m, a) => a + " ".repeat(m.length - a.length));
}
// a JS string literal at s[i] (", ' or `): its value, or null for a template with ${}
function readLit(s, i) {
  const q = s[i];
  let out = "", j = i + 1;
  while (j < s.length && s[j] !== q) {
    if (s[j] === "\\") {
      const c = s[j + 1];
      if (c === "n") out += "\n"; else if (c === "t") out += "\t";
      else if (c === "u") { const m = /^u\{([0-9a-fA-F]+)\}|^u([0-9a-fA-F]{4})/.exec(s.slice(j + 1)); out += String.fromCodePoint(parseInt(m[1] || m[2], 16)); j += m[0].length - 1; }
      else if (c === "x") { out += String.fromCharCode(parseInt(s.substr(j + 2, 2), 16)); j += 2; }
      else out += c;
      j += 2; continue;
    }
    if (q === "`" && s[j] === "$" && s[j + 1] === "{") return { val: null, end: j };
    out += s[j]; j++;
  }
  return { val: out, end: j + 1 };
}
const lineOf = (s, i) => s.slice(0, i).split("\n").length;
function scanCode(file) {
  const raw = fs.readFileSync(file, "utf8"), s = noComments(raw), rel = path.relative(ROOT, file), lines = raw.split("\n");
  const re = /(^|[^\w$.])_tk?\(/g;   // _tk("...") marks a key in a base.js table (shown later with _tv)
  let m;
  while ((m = re.exec(s))) {
    let i = m.index + m[0].length;
    while (/\s/.test(s[i])) i++;
    const ln = lineOf(s, i), at = `${rel}:${ln}`;
    if (/function\s*$/.test(s.slice(Math.max(0, m.index - 12), m.index + m[1].length))) continue;   // its definition
    if (!/["'`]/.test(s[i]) && rel === path.join("game", "ui", "lang.js")) continue;   // the helper itself passes keys along
    if (!/["'`]/.test(s[i])) { errors.push(`${at}: _t needs a literal English text (use _tv only for core.js data)`); continue; }
    const r = readLit(s, i);
    if (r.val === null) { errors.push(`${at}: _t with \${} in its text: use {name} and vars instead`); continue; }
    if (!r.val.trim()) { errors.push(`${at}: _t with an empty text`); continue; }
    let k = i + (r.end - i);
    while (/\s/.test(s[k])) k++;
    if (s[k] === "+") errors.push(`${at}: _t("...") + ...: put the whole sentence in one text with {vars}`);
    add(r.val, at, lines[ln - 1].trim().slice(0, 200));
  }
}
const files = [];
for (const d of ["ui", "manga"]) for (const f of fs.readdirSync(path.join(G, d)).sort()) if (f.endsWith(".js")) files.push(path.join(G, d, f));
files.push(path.join(G, "skinfx.js"));
files.forEach(scanCode);
// the node modules never translate (they also run on the server and in the tests): the page translates what they give it
for (const f of ["core.js", "sync.js", "routes.js"]) if (/(^|[^\w$.])_tv?\(/.test(noComments(fs.readFileSync(path.join(G, f), "utf8")))) errors.push(`game/${f}: no _t in a node module: translate where the page shows it`);

/* ---------- markup (the same reading as ui/lang.js _tDom) ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", ndash: "–", mdash: "—", rsaquo: "›", lsaquo: "‹", hellip: "…", times: "×", rarr: "→", larr: "←", bull: "•", copy: "©", deg: "°", minus: "−", laquo: "«", raquo: "»" };
const decode = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] !== undefined ? ENT[e] : (errors.push(`game/shell.html: unknown entity ${m} (add it to tools/i18n.js ENT)`), m)));
const tKey = (s) => { const k = String(s).replace(/\s+/g, " ").trim(); return /[A-Za-z]{2}/.test(k) ? k : null; };
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
function scanMarkup() {
  const file = path.join(G, "shell.html"), all = fs.readFileSync(file, "utf8");
  const a = all.indexOf('<div id="app">'), b = all.indexOf("<script>", a);
  const s = all.slice(a, b), base = lineOf(all, a) - 1;
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  const stack = [];   // open elements: { tag, skip }
  let skip = 0, m;
  while ((m = re.exec(s))) {
    const at = `game/shell.html:${base + lineOf(s, m.index)}`;
    if (m[0].startsWith("<!--")) continue;
    if (m[5] !== undefined) { if (!skip) { const k = tKey(decode(m[5])); if (k) add(k, at, m[5].trim().slice(0, 200)); } continue; }
    const close = m[1] === "/", tag = m[2].toLowerCase(), attrs = m[3] || "", self = m[4] === "/" || VOID.has(tag);
    if (close) {
      while (stack.length) { const e = stack.pop(); if (e.skip) skip--; if (e.tag === tag) break; }
      continue;
    }
    const no = /\stranslate\s*=\s*["']?no\b/.test(attrs) || tag === "script" || tag === "style";
    if (!skip && !no) {
      const ar = /\s(aria-label|title|placeholder|alt)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let x;
      while ((x = ar.exec(attrs))) { const k = tKey(decode(x[3] !== undefined ? x[3] : x[4])); if (k) add(k, at, `${x[1]}="${k}"`); }
    }
    if (!self) { stack.push({ tag, skip: no }); if (no) skip++; }
  }
}
scanMarkup();

/* ---------- core.js data ---------- */
const { BL } = require(path.join(G, "core.js"));
for (const f of BL.FIGHTERS) {
  const at = `game/core.js FIGHTERS ${f.id}`;
  for (const v of [f.role, f.blurb, f.signature && f.signature.name, f.signature && f.signature.text, f.ultimate && f.ultimate.name, f.ultimate && f.ultimate.text]) if (v) add(v, at, "");
  for (const p of f.palettes) add(p.name, `${at} skin`, "");
}
for (const b of BL.BOSSES || []) { const at = `game/core.js BOSSES ${b.id}`; for (const v of [b.role, b.blurb]) if (v) add(v, at, ""); for (const p of b.palettes || []) add(p.name, `${at} skin`, ""); }

/* ---------- the tables ---------- */
const mode = process.argv[2] || "";
// a plural line repeats its vars and tags in every form (2 forms in English, 3 in Russian): there each one counts once
const uniq = (a, pl) => (pl ? [...new Set(a)] : a).sort().join(" ");
const vars = (s, pl) => uniq(s.match(/\{\w+\}/g) || [], pl);
const tags = (s, pl) => uniq((s.match(/<\/?[a-zA-Z][\w-]*/g) || []).map((t) => t.toLowerCase()), pl);
const eng = (k) => { const i = k.indexOf("@@"); return i < 0 ? k : k.slice(0, i); };
if (mode === "--keys" || mode === "--missing") {
  const lang = process.argv[3];
  const tb = mode === "--missing" ? JSON.parse(fs.readFileSync(path.join(G, "lang", lang + ".json"), "utf8")) : {};
  for (const [k, e] of keys) if (!(k in tb)) console.log(JSON.stringify({ k, at: e.at, src: e.src }));
  process.exit(0);
}
let out = [`keys: ${keys.size} (files: ${files.length + 1})`];
if (mode !== "--src") {
  for (const l of LANGS) {
    const file = path.join(G, "lang", l + ".json");
    let tb;
    try { tb = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errors.push(`game/lang/${l}.json: ${e.message}`); continue; }
    let miss = 0;
    const stale = Object.keys(tb).filter((k) => !keys.has(k));
    for (const k of keys.keys()) {
      if (!(k in tb)) { miss++; continue; }
      const t = tb[k], e = eng(k);
      if (typeof t !== "string" || !t.trim()) { errors.push(`${l}: empty line for ${JSON.stringify(k)}`); continue; }
      const pl = e.indexOf("|") >= 0;
      if (vars(t, pl) !== vars(e, pl)) errors.push(`${l}: {vars} differ for ${JSON.stringify(k)}: ${JSON.stringify(t)}`);
      if (tags(t, pl) !== tags(e, pl)) errors.push(`${l}: tags differ for ${JSON.stringify(k)}: ${JSON.stringify(t)}`);
      const pe = e.split("|").length, pt = t.split("|").length;
      if (pe > 1 && pe !== 2) errors.push(`English plural needs exactly 2 forms (one|other): ${JSON.stringify(k)}`);
      if (pe > 1 && pt !== FORMS[l]) errors.push(`${l}: ${FORMS[l]} plural forms wanted for ${JSON.stringify(k)}: ${JSON.stringify(t)}`);
      if (pe === 1 && pt > 1) errors.push(`${l}: a | in a line that is not a plural: ${JSON.stringify(k)}`);
    }
    if (miss) errors.push(`${l}: ${miss} keys have no line (node tools/i18n.js --missing ${l})`);
    if (mode === "--prune" && stale.length) { for (const k of stale) delete tb[k]; fs.writeFileSync(file, JSON.stringify(tb, null, 1) + "\n"); }
    out.push(`${l}: ${Object.keys(tb).length} lines, ${miss} missing, ${stale.length} stale${mode === "--prune" && stale.length ? " (dropped)" : ""}`);
  }
}
console.log(out.join("; "));
if (errors.length) { console.log(errors.length + " errors:"); for (const e of errors.slice(0, 80)) console.log("  " + e); if (errors.length > 80) console.log(`  ... and ${errors.length - 80} more`); process.exit(1); }
console.log("no errors");
