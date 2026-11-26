# The one-time skins upgrade card (ui/skinup.js, css/96-skinup.css, shell.html #scrSkUp). UI only. Checks:
#  - a profile owning skins of every kind sees the card once on the menu (and not again after a reload): up to six tiles in the order
#    Pommes, won, chip 300, 150, 60 (the fighter played last first within a tier), the sixth a "+N" tile when more than six are owned;
#  - "See my skins" opens the Skin Rack on the first skin shown, "Nice!" closes, the flag P.skup is saved;
#  - a fresh profile (first run) and a profile owning only the free skins never see it, and the flag is then set;
#  - the card never sits over another sheet: it waits for a quiet menu (a sheet that is open holds it back);
#  - at 844x390, 667x320, 390x844 and 1280x760 the card stays on the screen and nothing in it scrolls or runs out of it;
#  - Russian at 667x320 (the longest texts) fits too.
# Prints "skinup ok" and "no errors". Shots in <outdir> (default skinup); the build has to be fresh (python3 game/build.py).
#   python3 tests/pwskinup.py [outdir]
import asyncio, sys, json, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
T = (ROOT / 'build' / 'test.html').as_uri()
ARGS = ['--disable-gpu']
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'skinup'); OUT.mkdir(parents=True, exist_ok=True)
KEY = 'potatobrawl.profile.v1'
SIZES = [('p844', 844, 390), ('se667', 667, 320), ('up390', 390, 844), ('d1280', 1280, 760)]
BASE = {'tokens': 40, 'rating': 1080, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': 1, 'last': 'samurai'}
# 7 skins beyond the free ones: Steel 60, Violet 300, Devil's Roast, Ink Noir (samurai, played last); Gold 150, Starfall (odin); Azure 60 (phoenix)
RICH = dict(BASE, owned={'samurai': [0, 1, 3, 4, 8], 'odin': [0, 2, 9], 'phoenix': [0, 1]}, pal={'samurai': 8})
FEW = dict(BASE, owned={'samurai': [0, 3], 'dragon': [0, 7]}, pal={'samurai': 3})   # Violet 300 and Harvest Gold: two tiles
FREE = dict(BASE, owned={'samurai': [0]})
errs = []

def need(ok, msg):
    if not ok: errs.append(msg)
    return ok

async def page(b, w, h, prof, tag, lang=''):
    mob = w < 1000
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    seed = "" if prof is None else "if (!localStorage.getItem('%s')) localStorage.setItem('%s', %s);" % (KEY, KEY, json.dumps(json.dumps(dict(prof, screen='up') if h > w else prof)))
    await ctx.add_init_script("window.__blNoQuick = true;" + seed)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(T + (f'?lang={lang}' if lang else '')); await pg.wait_for_timeout(500)
    return ctx, pg

async def shown(pg, ms=6000):
    try:
        await pg.wait_for_function("!document.getElementById('scrSkUp').hidden", timeout=ms); return True
    except Exception: return False

async def prof(pg): return await pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}') || 'null')")

# nothing in the card runs out of the sheet or the screen, and the sheet itself does not scroll
FIT = """(() => { const S = document.querySelector('.su-sheet').getBoundingClientRect(), bad = [];
  if (S.left < -0.5 || S.top < -0.5 || S.right > innerWidth + 0.5 || S.bottom > innerHeight + 0.5) bad.push('card off the screen ' + [S.left, S.top, S.right, S.bottom].map(Math.round));
  const sh = document.querySelector('.su-sheet'); if (sh.scrollHeight > sh.clientHeight + 1 || sh.scrollWidth > sh.clientWidth + 1) bad.push('card scrolls ' + [sh.scrollWidth, sh.clientWidth, sh.scrollHeight, sh.clientHeight]);
  for (const e of document.querySelectorAll('.su-sheet *')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.left < S.left - 1 || r.right > S.right + 1 || r.top < S.top - 1 || r.bottom > S.bottom + 1) bad.push((e.id || e.className || e.tagName) + ' runs out of the card'); }
  for (const e of document.querySelectorAll('.su-sheet b, .su-sheet p, .su-sheet button span, .su-sheet h3')) if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible') bad.push(e.textContent.slice(0, 20) + ' is cut off');
  return bad; })()"""

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS)
        # 1. the rich profile: the card once, in order; See my skins opens the Rack on the first skin shown
        ctx, pg = await page(b, 844, 390, RICH, 'rich')
        need(await shown(pg), 'rich: the card never showed')
        await pg.wait_for_timeout(900)
        order = await pg.evaluate("__blSkinUp.owned().map((s) => s.id + ':' + s.i)")
        need(order == ['samurai:8', 'odin:9', 'samurai:4', 'samurai:3', 'odin:2', 'samurai:1', 'phoenix:1'], f'rich: order {order}')
        tiles = await pg.evaluate("[...document.querySelectorAll('#suRow .su-t')].map((t) => t.classList.contains('su-n') ? t.querySelector('.su-a').textContent : t.querySelector('b').textContent)")
        need(tiles == ['Ink Noir', 'Starfall', "Devil's Roast", 'Violet', 'Gold', '+2'] or tiles[:5] == ['Ink Noir', 'Starfall', "Devil's Roast", 'Violet', 'Gold'] and tiles[5] == '+2', f'rich: tiles {tiles}')
        need(len(tiles) == 6, f'rich: {len(tiles)} tiles')
        need(await pg.evaluate("document.querySelectorAll('#suRow canvas').length") == 5, 'rich: five model canvases and one numeral tile')
        need((await prof(pg) or {}).get('skup') == 1, 'rich: P.skup saved when shown')
        need(await pg.evaluate("[...document.querySelectorAll('#suRow canvas')].every((c) => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < x.length; i += 4) if (x[i]) return true; return false; })"), 'rich: a model canvas is empty')
        await pg.screenshot(path=str(OUT / 'rich_p844.png'))
        need(not (bad := await pg.evaluate(FIT)), f'rich 844: {bad}')
        await pg.click('#suSee'); await pg.wait_for_timeout(500)
        need(await pg.evaluate("document.getElementById('scrSkUp').hidden"), 'See my skins: the card stays open')
        need(await pg.evaluate("!document.getElementById('scrSkins').hidden"), 'See my skins: the Skin Rack did not open')
        need(await txt(pg, '#skFig') == 'Samurai', f"See my skins: the Rack is on {await txt(pg, '#skFig')}")
        need(await pg.evaluate("document.querySelector('#skSheet .sk.sel').dataset.i") == '8', 'See my skins: the Rack is not on the first skin shown (Ink Noir)')
        await pg.reload(); await pg.wait_for_timeout(5500)
        need(await pg.evaluate("document.getElementById('scrSkUp').hidden"), 'rich: the card came again after a reload')
        await ctx.close()
        # 2. Nice! closes; a sheet that is open holds the card back
        ctx, pg = await page(b, 844, 390, dict(FEW), 'few')
        await pg.evaluate("document.getElementById('scrSettings').hidden = false")
        need(not await shown(pg, 4500), 'few: the card showed over an open sheet')
        need(not (await prof(pg) or {}).get('skup'), 'few: the flag was set while the card was held back')
        await pg.evaluate("document.getElementById('scrSettings').hidden = true")
        need(await shown(pg), 'few: the card never showed once the sheet closed')
        need(await pg.evaluate("document.querySelectorAll('#suRow .su-t').length") == 2, 'few: two tiles')
        await pg.wait_for_timeout(900); await pg.screenshot(path=str(OUT / 'few_p844.png'))
        await pg.click('#suOk'); await pg.wait_for_timeout(200)
        need(await pg.evaluate("document.getElementById('scrSkUp').hidden"), 'Nice!: the card stays open')
        need((await prof(pg) or {}).get('skup') == 1, 'Nice!: P.skup not saved')
        await ctx.close()
        # 3. fresh and free-only profiles never see it
        ctx, pg = await page(b, 844, 390, None, 'fresh')
        need(not await shown(pg, 5000), 'fresh profile saw the card')
        await ctx.close()
        ctx, pg = await page(b, 844, 390, FREE, 'free')
        need(not await shown(pg, 5000), 'free-only profile saw the card')
        need((await prof(pg) or {}).get('skup') == 1, 'free-only: the flag is set silently')
        await ctx.close()
        # 4. the sizes, and Russian
        for name, w, h in SIZES:
            ctx, pg = await page(b, w, h, RICH, 'sz ' + name)
            need(await shown(pg), f'{name}: the card never showed')
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=str(OUT / f'en_{name}.png'))
            need(not (bad := await pg.evaluate(FIT)), f'{name}: {bad}')
            await ctx.close()
        ctx, pg = await page(b, 667, 320, RICH, 'ru', 'ru')
        need(await shown(pg), 'ru: the card never showed')
        await pg.wait_for_timeout(900)
        await pg.screenshot(path=str(OUT / 'ru_se667.png'))
        need(not (bad := await pg.evaluate(FIT)), f'ru 667: {bad}')
        need(await txt(pg, '#suT') == 'Твои скины обновились', f"ru: title {await txt(pg, '#suT')}")
        await ctx.close()
        await b.close()
    print('skinup ok')
    print('no errors' if not errs else 'ERRORS:\n  ' + '\n  '.join(errs))

async def txt(pg, sel): return ' '.join(((await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{}}).textContent || ''")) or '').split())

asyncio.run(main())
sys.exit(1 if errs else 0)
