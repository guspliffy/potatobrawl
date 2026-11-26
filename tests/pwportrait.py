# Rig portraits (game/ui/portrait.js): the contact sheet, the timing and the screens that show them.
# Usage: python3 tests/pwportrait.py [OUT]   (OUT defaults to ./portrait; build first: python3 game/build.py)
# Writes OUT/portraits.png: one row per fighter: the portrait full size (640 x 308) and a half-size copy with the centre circle r 140 and
# the eye line marked, then as the game crops it: the 26 px round avatar (the practice VS list; also 4x bigger), the desaturated select tile
# and the menu hero. And OUT/menu.png, select.png, result.png, pshop.png at 844 x 390.
# Prints the time of each portrait the page drew itself (the first draws: the figure's carving, the PNG and its blob URL), then of
# each drawn again (the picture, the PNG) and of all eight in one go; fails on a page error, a portrait that does not load as a
# 640 x 308 image or a boss with a portrait.
import sys, io, json, base64, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'portrait'); OUT.mkdir(parents=True, exist_ok=True)
IDS = ['phoenix', 'alchemist', 'odin', 'wizard', 'samurai', 'dragon', 'gunslinger', 'reaper']
EYE = {'phoenix': 111, 'alchemist': 117, 'odin': 111, 'wizard': 142, 'samurai': 111, 'dragon': 117, 'gunslinger': 129, 'reaper': 123}
errs, bad = [], []
def need(ok, what):
    if not ok: bad.append(what)
def png(b): return Image.open(io.BytesIO(b)).convert('RGB')

with sync_playwright() as p:
    b = p.chromium.launch(args=['--disable-gpu'])
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1, has_touch=True, is_mobile=True)
    ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({'tut': True, 'last': 'phoenix', 'fs': False, 'tokens': 85, 'matches': 3, 'wins': 2, 'losses': 1}))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'console: {m.text}') if m.type == 'error' else None)
    pg.goto((ROOT / 'build' / 'test.html').as_uri()); pg.evaluate("window.__blastline.perf.lockQ = true")
    pg.wait_for_timeout(3000)   # the warm-up draws the rest in idle time
    first = pg.evaluate("() => window.__ptTest.ms")
    print('first draws (ms, in the order drawn):', ', '.join(f'{k} {v:.1f}' for k, v in first.items()))
    need(sorted(first) == sorted(IDS), f'the warm-up did not draw them all: {sorted(first)}')
    full, ms = {}, {}
    for id in IDS:
        r = pg.evaluate("(id) => window.__ptTest.draw(id)", id)
        full[id] = png(base64.b64decode(r['url'].split(',', 1)[1])); ms[id] = (r['draw'], r['png'])
    print('drawn again (picture + PNG, ms):', ', '.join(f'{k} {a:.1f}+{c:.1f}' for k, (a, c) in ms.items()))
    eight = pg.evaluate("() => { const t0 = performance.now(); for (const id of window.__ptTest.ids()) window.__ptTest.draw(id); return performance.now() - t0; }")
    print(f'all eight in one go: {eight:.1f} ms')

    # the menu hero, the select tiles, the round avatars: as the game's own CSS crops them
    hero, tile, av = {}, {}, {}
    pg.screenshot(path=str(OUT / 'menu.png'))
    pg.evaluate("document.getElementById('bRanked').click()"); pg.wait_for_timeout(600)
    for i, id in enumerate(IDS):
        pg.evaluate("(i) => document.querySelectorAll('#tiles .tile')[i].click()", (i + 1) % 8); pg.wait_for_timeout(250)
        tile[id] = png(pg.locator('#tiles .tile').nth(i).screenshot())
    for id in IDS:
        pg.evaluate("(id) => document.querySelector(`#tiles .tile[data-id='${id}']`).click()", id); pg.wait_for_timeout(250)
        if id == 'gunslinger': pg.wait_for_timeout(300); pg.screenshot(path=str(OUT / 'select.png'))
        pg.evaluate("document.getElementById('selBack').click()"); pg.wait_for_timeout(350)
        hero[id] = png(pg.locator('#bRanked .mm-art').screenshot())
        pg.evaluate("document.getElementById('bRanked').click()"); pg.wait_for_timeout(350)
    loaded = pg.evaluate("() => [...document.querySelectorAll('#tiles .tile img, #dPor img')].map((im) => im.complete && im.naturalWidth === 640 && im.naturalHeight === 308)")
    need(len(loaded) == 16 and all(loaded), f'a portrait did not load as a 640 x 308 image: {loaded}')
    pg.evaluate("document.getElementById('selBack').click()"); pg.wait_for_timeout(350)
    pg.evaluate("document.getElementById('bPractice').click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('oppPick').click()"); pg.wait_for_timeout(300)
    for i, id in enumerate(IDS): av[id] = png(pg.locator('#oppPop button').nth(1 + i).locator('img').screenshot())
    need(pg.evaluate("() => document.querySelectorAll('#oppPop img').length") == 8, 'a boss shows a portrait in the VS list')
    pg.evaluate("document.getElementById('oppPick').click()"); pg.wait_for_timeout(200)

    # the results screen (the CPU put out of the arena) and the Pommes Shop page
    pg.evaluate("document.querySelectorAll('#oppPop button')[1].click()")
    pg.evaluate("document.getElementById('selGo').click()")
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=30000)
    pg.evaluate("(() => { const g = window.__blastline.game; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; })()")
    pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000); pg.wait_for_timeout(1200)
    pg.screenshot(path=str(OUT / 'result.png'))
    pg.evaluate("window.__blPshop.open('wizard')"); pg.wait_for_timeout(900)
    pg.screenshot(path=str(OUT / 'pshop.png'))
    b.close()

# the sheet: a row per fighter
AVK = 4
rowW = 640 + 12 + 320 + 24 + 26 + 12 + 26 * AVK + 24 + max(im.width for im in tile.values()) + 24 + max(im.width for im in hero.values())
rowH = max(308, max(im.height for im in hero.values()), max(im.height for im in tile.values()))
sheet = Image.new('RGB', (rowW + 24, rowH * len(IDS) + 12 * (len(IDS) + 1)), (24, 22, 30))
for r, id in enumerate(IDS):
    y = 12 + r * (rowH + 12); x = 12
    im = full[id].copy(); d = ImageDraw.Draw(im)
    d.ellipse([180, 10, 460, 290], outline=(255, 0, 255), width=2); d.line([(0, EYE[id]), (640, EYE[id])], fill=(0, 255, 255), width=1)
    sheet.paste(full[id], (x, y)); x += 640 + 12
    sheet.paste(im.resize((320, 154), Image.LANCZOS), (x, y)); x += 320 + 24
    sheet.paste(av[id], (x, y)); x += av[id].width + 12
    sheet.paste(av[id].resize((av[id].width * AVK, av[id].height * AVK), Image.NEAREST), (x, y)); x += 26 * AVK + 24
    sheet.paste(tile[id], (x, y)); x += max(im.width for im in tile.values()) + 24
    sheet.paste(hero[id], (x, y))
sheet.save(OUT / 'portraits.png')
for e in errs: print('page error:', e)
for m in bad: print('FAIL:', m)
print('no errors' if not errs and not bad else 'FAILED')
sys.exit(1 if errs or bad else 0)
