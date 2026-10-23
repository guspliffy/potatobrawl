#!/usr/bin/env python3
"""The language sweep (check.sh "lang-ui"): every screen in every language at every size, against a local server (with
accounts, so Quick match, Boss Week and the cups show). English goes first at each size; what is already so in English is not reported again.
For each screen:
  cut       a text clipped by a box that hides overflow (an ellipsis too), sideways, or downwards where the box doesn't scroll
  spill     a text running out of its button, chip, tag or pill, or off the screen
  overlap   two texts on top of each other (a longer title running under a button or a tag)
  english   (the pseudo-language xx only) a visible text with letters that _t never touched (no ⟦ ⟧), names and numbers aside
  errors    page errors and console errors
It saves one screenshot per language, size and screen (<out>/<lang>_<size>_<screen>.png), one contact sheet per language
(<out>/<lang>_sheet.png) and the findings in <out>/report.json, and ends with "no errors" when nothing was found.
   python3 pwlang.py [outdir] [langs=en,de,ru,fr,es,xx] [sizes=s667,p844,d1280,up390] [screens=menu,select,...] [one=fr,es]
   (one=: these languages at 844x390 only)
Port: PWLANG_PORT (default 8107); accounts in a temporary folder, so Quick match, Boss Week and the cups are on."""
import re, asyncio, json, os, pathlib, shutil, subprocess, sys, tempfile, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARGV = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
OUT = next((a for a in sys.argv[1:] if '=' not in a), 'lang')
pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get('PWLANG_PORT', 8107))
URL = f'http://localhost:{PORT}/'
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
LANGS = ARGV.get('langs', 'de,ru,xx').split(',')
ONE = [l for l in ARGV.get('one', 'fr,es').split(',') if l]
SIZE_LIST = ARGV.get('sizes', 's667,p844,d1280,up390').split(',')
SCREENS = ARGV.get('screens', 'menu,select,skins,pshop,help,settings,account,shop,daily,road,stop,quick,online,boards,bw,tc,match,pause,result,welcome').split(',')
P0 = {'tokens': 1500, 'rating': 1080, 'peak': 1080, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True, 'fin1': True, 'last': 'phoenix', 'name': 'Potato 74',
      'owned': {'phoenix': [0, 1, 2]}, 'pal': {'phoenix': 2}}
# what stays English in every language (game/ui/lang.js): names, the brand words, the KO pages' names
KEEP = ['Phoenix', 'Alchemist', 'Odin', 'Wizard', 'Samurai', 'Dragon', 'Gunslinger', 'Reaper', 'Old Scratch', 'Zorp', 'Kraken Spud', 'Kraken', 'Scratch',
        'PotatoBrawl', 'Potato Brawl', 'Potato', 'Brawl', 'Pommes', 'Potatality', 'Potatalities', 'K.O.', 'KO', 'Potato 74',
        'Jacket Potato', 'Air Fryer', 'Well Done', 'New Potatoes', 'Crisp-tal Ball', 'Hocus Croquettes', 'Mashed', "Philosopher's Spud", 'Frozen Fries',
        'Smash Landing', 'Hasselback', 'Snake Eyes', 'Tater Tots', 'Loaded', 'Rest in Peel', 'Gravy Digger', 'EUR', 'SOON']
# names read from the game: the CPU potato names (ui/screens.js CPU_NAMES), the Road's CPU names (ui/road.js cpu: "..."), the KO pages' sound
# words (ui/kopages.js word: "...")
_src = lambda p: open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'game', 'ui', p), encoding='utf-8').read()
_cpu = re.search(r'const CPU_NAMES = \[(.*?)\];', _src('screens.js'), re.S)
KEEP += re.findall(r'"([^"]+)"', _cpu.group(1)) if _cpu else []
KEEP += re.findall(r'\bcpu: "([^"]+)"', _src('road.js')) + re.findall(r'\bword: "([^"]+)"', _src('kopages.js'))
KEEP = sorted(set(KEEP), key=len, reverse=True)   # longest first, so "Kraken Spud" goes before "Kraken"
errs, report = [], {}

CHECK = r"""(xx) => {
  const out = [], seen = new Set(), KEEP = %s;
  const vis = (el) => { if (!el || el.closest('[hidden]')) return false; for (let a = el; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const nm = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); const p = el.parentElement && el.parentElement.closest('[id]'); return (p ? '#' + p.id + ' ' : '') + s; };
  const BOX = 'button, .btn, .chip, .tag, .coin, [class*="pill"], [class*="badge"]';
  const add = (kind, el, t) => { const k = kind + ' ' + nm(el); if (seen.has(k)) return; seen.add(k); out.push({ kind, at: nm(el), text: t.slice(0, 60) }); };
  const texts = [];   // [el, text, rects] for the overlap test below
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t || !/\p{L}/u.test(t)) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,svg') || !vis(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (!rs.length) continue;
    texts.push([el, t, rs]);
    // the nearest box that hides overflow
    let clip = null;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a), ox = cs.overflowX, oy = cs.overflowY;
      if (ox === 'visible' && oy === 'visible') continue;
      const ar = a.getBoundingClientRect(), scrollY = oy === 'auto' || oy === 'scroll', scrollX = ox === 'auto' || ox === 'scroll';
      const side = !scrollX && rs.some((r) => r.left < ar.left - 1.5 || r.right > ar.right + 1.5);
      const down = !scrollY && oy !== 'visible' && rs.some((r) => r.bottom > ar.bottom + 1.5 || r.top < ar.top - 1.5);
      if (side || down) add('cut', el, t);
      clip = ar;
      break;
    }
    // out of its own button / chip / tag
    const box = el.closest(BOX);
    if (box) { const br = box.getBoundingClientRect(); if (rs.some((r) => r.left < br.left - 2 || r.right > br.right + 2 || r.top < br.top - 3 || r.bottom > br.bottom + 3)) add('spill', el, t); }
    // off the screen (a sideways strip that scrolls is fine)
    const onScr = (r) => r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
    if (!(clip && onScr(clip)) && rs.some((r) => !onScr(r))) {
      let sc = false; for (let a = el; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) { sc = true; break; } }
      if (!sc) add('spill', el, t + ' (off the screen)');
    }
    // the pseudo-language: text _t never touched
    if (xx && !/[⟦⟧áéíóúñç]/.test(t) && !el.closest('[translate=no]')) {
      let rest = t.replace(/\d{1,2}:\d{2}\s?(AM|PM)/g, ' '); for (const k of KEEP) rest = rest.split(k).join(' ');
      if (/\p{L}{2}/u.test(rest.replace(/\b(vs|x)\b/g, ''))) add('english', el, t);
    }
  }
  // two texts on top of each other (a longer title running under a button or a tag): texts of different elements, neither inside the other
  const layer = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.position === 'fixed' || cs.position === 'sticky' || /auto|scroll/.test(cs.overflowX + cs.overflowY)) return a; } return null; };
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3;
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const [ea, ta, ra] = texts[i], [eb, tb, rb] = texts[j];
    if (ea === eb || ea.contains(eb) || eb.contains(ea) || ea.closest('.screen') !== eb.closest('.screen')) continue;   // a sheet over the start page is another layer
    if (layer(ea) !== layer(eb)) continue;   // a button fixed over a list that scrolls under it
    if (ra.some((a) => rb.some((b) => hit(a, b)))) add('overlap', ea, ta.slice(0, 28) + ' / ' + tb.slice(0, 28));
  }
  return out;
}""" % json.dumps(KEEP)

RESET = """() => { for (const s of document.querySelectorAll('.screen.modal')) s.hidden = true; if (window.__blastline.mode !== 'menu') window.__blTour('menu'); }"""

def serve():
    d = tempfile.mkdtemp(prefix='pwlang-acct-')
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0', ACCOUNTS_DIR=d)
    p = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            import urllib.request; urllib.request.urlopen(URL, timeout=1).read(); break
        except Exception: time.sleep(0.2)
    return p, d

async def sweep(b, lang, size):
    vw, vh, up = SIZES[size]
    mob = vw < 1000
    ctx = await b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1, is_mobile=mob, has_touch=mob, timezone_id='Europe/Berlin', locale='en-US')
    p = dict(P0)
    if up: p['screen'] = 'up'
    await ctx.add_init_script("if (localStorage.getItem('potatobrawl.profile.v1') === null) localStorage.setItem('potatobrawl.profile.v1', %s); window.__blNoTurn = true;" % json.dumps(json.dumps(p)))
    pg = await ctx.new_page()
    tag = f'{lang} {size}'
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    await pg.goto(URL + '?lang=' + lang)
    await pg.evaluate("window.__blastline.perf.lockQ = true")
    await pg.wait_for_timeout(1200)
    if lang == 'ru': await pg.evaluate("document.fonts.ready.then(() => 1)")
    for s in SCREENS:
        if s not in ('pause', 'result'): await pg.evaluate(RESET)
        try:
            await pg.evaluate(f"window.__blTour({json.dumps(s)})")
        except Exception as e:
            errs.append(f'{tag} {s}: could not open: {str(e)[:120]}'); continue
        await pg.wait_for_timeout(1500 if s in ('quick', 'bw', 'tc', 'boards', 'match') else 500)
        found = await pg.evaluate(CHECK, lang == 'xx')
        report.setdefault(lang, {}).setdefault(size, {})[s] = found
        await pg.screenshot(path=f'{OUT}/{lang}_{size}_{s}.png')
    await ctx.close()

def contact(lang):
    try:
        from PIL import Image, ImageDraw
    except Exception: return
    shots = [(sz, s, pathlib.Path(f'{OUT}/{lang}_{sz}_{s}.png')) for sz in SIZE_LIST for s in SCREENS]
    shots = [x for x in shots if x[2].exists()]
    if not shots: return
    W, cols = 300, 6
    tiles = []
    for sz, s, f in shots:
        im = Image.open(f).convert('RGB'); h = int(im.height * W / im.width)
        if h > 360: im = im.resize((int(im.width * 360 / im.height), 360)); t = Image.new('RGB', (W, 360), (14, 16, 34)); t.paste(im, ((W - im.width) // 2, 0)); im = t
        else: im = im.resize((W, h))
        d = ImageDraw.Draw(im); d.rectangle([0, 0, 120, 14], fill=(0, 0, 0)); d.text((3, 2), f'{sz} {s}', fill=(255, 220, 120)); tiles.append(im)
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    H = sum(max(t.height for t in r) + 4 for r in rows)
    sheet = Image.new('RGB', (cols * (W + 4), H), (40, 40, 40)); y = 0
    for r in rows:
        for i, t in enumerate(r): sheet.paste(t, (i * (W + 4), y))
        y += max(t.height for t in r) + 4
    sheet.save(f'{OUT}/{lang}_sheet.png')

async def main():
    from playwright.async_api import async_playwright
    srv, acct = serve()
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--disable-gpu'])
            for size in SIZE_LIST:
                await sweep(b, 'en', size)
                for lang in LANGS:
                    if lang != 'en': await sweep(b, lang, size)
                if size == 'p844':
                    for lang in ONE:
                        if lang not in LANGS and lang != 'en': await sweep(b, lang, size)
            await b.close()
    finally:
        srv.terminate(); shutil.rmtree(acct, ignore_errors=True)
    # what is already so in English (same size and screen) is not a finding
    # a text seen on several screens (the start page under a sheet) is listed once, at the first screen
    # the pseudo-language pads every text by a third and more (a 2-letter word grows to 8), so its cut and spill lines are only a hint
    # (info, not counted); it counts for English left in the page. The real languages count for everything.
    found, info, once = [], [], set()
    for lang, by in report.items():
        if lang == 'en': continue
        for size, scr in by.items():
            for s, items in scr.items():
                base = {(i['kind'], i['at']) for i in report.get('en', {}).get(size, {}).get(s, [])}
                for i in items:
                    k = (lang, size, i['kind'], i['at'])
                    if (i['kind'], i['at']) not in base and k not in once:
                        once.add(k); (info if lang == 'xx' and i['kind'] != 'english' else found).append(f"{lang} {size} {s}: {i['kind']} {i['at']}: {i['text']!r}")
    json.dump(report, open(f'{OUT}/report.json', 'w'), ensure_ascii=False, indent=1)
    for lang in ['en'] + LANGS + ONE: contact(lang)
    print(f'screens looked at: {sum(len(scr) for by in report.values() for scr in by.values())}; findings in English (not counted): {sum(len(x) for scr in report.get("en", {}).values() for x in scr.values())}')
    for f in info[:80]: print('info', f)
    for f in found[:150]: print(f)
    if len(found) > 150: print(f'... and {len(found) - 150} more (report.json)')
    for e in errs[:30]: print('ERROR', e)
    if found or errs: print(f'{len(found)} findings, {len(errs)} errors'); sys.exit(1)
    print('no errors')

asyncio.run(main())
