# The guided first round: seven steps against a real Easy CPU (it stands still while a hit has to land, then fights back).
#   python3 pwtut.py [outdir]   desktop with the keyboard through to the results screen, then touch runs (667x320, 844x390, upright 390x844) up to the
#                               "Charge it up" step, holding the Heavy button so its ring shows
import asyncio, sys
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'ux2'
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
N = 7
G = "window.__blastline.game"
async def run(b, tag, vp, touch, up, errs, full):
    mob = vp['width'] < 1000
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=touch)
    prof = "{gfx: '2d'%s}" % (", screen: 'up'" if up else "")
    await ctx.add_init_script("if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s)); }" % prof)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    await pg.goto(TEST_URL); await pg.wait_for_timeout(500)
    await (pg.tap('#bHelp') if touch else pg.click('#bHelp')); await pg.wait_for_timeout(200)
    await (pg.tap('#hTry') if touch else pg.click('#hTry'))
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    step = lambda: pg.evaluate("document.getElementById('tutN').textContent + ' | ' + document.getElementById('tutT').textContent")
    async def wait_step(n):
        await pg.wait_for_function(f"document.getElementById('tutN').textContent.includes('{n} of {N}') && !document.getElementById('tut').classList.contains('done')", timeout=60000)
        print(tag, await step())
    async def near():
        await pg.evaluate(f"(() => {{ const g = {G}, me = g.fighters[0], op = g.fighters[1]; if (me.state !== 'idle' && me.state !== 'run' && me.state !== 'walk') return; me.x = op.x - 40; me.y = op.y; me.facing = 1; me.vx = 0; }})()")
    async def press(k, ms=60):   # one tap: key on the keyboard, the matching button on a touch screen
        if touch:
            await pg.tap(f'.pb[data-k={k}]')
        else:
            code = {'jump': 'Space', 'light': 'KeyJ', 'heavy': 'KeyK', 'special': 'KeyL'}[k]
            await pg.keyboard.press(code)
    async def cpu_is_dummy(): return await pg.evaluate("document.querySelector('#pc1 .pc-tag').textContent")
    tagtxt = await cpu_is_dummy()
    if tagtxt != 'CPU': errs.append(f'{tag}: opponent tag is {tagtxt!r}, want CPU')
    await wait_step(1)
    if touch:
        await pg.evaluate(f"{G}.fighters[0].x += 160")    # moving needs the stick; the step is about the x distance
    else:
        await pg.keyboard.down('KeyD'); await pg.wait_for_timeout(1200); await pg.keyboard.up('KeyD')
    await wait_step(2)
    await press('jump'); await pg.wait_for_timeout(300); await press('jump')
    await wait_step(3)
    for i in range(40):
        if f'3 of {N}' not in await step() or 'Nice' in await step(): break
        await near(); await press('light'); await pg.wait_for_timeout(300)
    await wait_step(4)
    for i in range(10):
        if f'4 of {N}' not in await step() or 'Nice' in await step(): break
        await near(); await press('heavy'); await pg.wait_for_timeout(600)
    await wait_step(5)
    # the Skip chip (it exits the tutorial) must not sit on any touch button, the Special's boosted size included
    if touch:
        hit = await pg.evaluate("""(() => { const c = document.getElementById('tutSkip').getBoundingClientRect(), bad = [];
          for (const b of document.querySelectorAll('.pb')) { const r = b.getBoundingClientRect(), k = b.dataset.k === 'special' ? 1.15 : 1,
            cx = r.left + r.width / 2, cy = r.top + r.height / 2, rr = r.width / 2 * k,
            nx = Math.max(c.left, Math.min(cx, c.right)), ny = Math.max(c.top, Math.min(cy, c.bottom));
            if (Math.hypot(nx - cx, ny - cy) < rr) bad.push(b.dataset.k); }
          return bad; })()""")
        if hit: errs.append(f'{tag}: the Skip chip overlaps the {hit} button(s)')
        under = await pg.evaluate("""(() => { const t = document.getElementById('tut').getBoundingClientRect(), bad = [];
          for (const b of document.querySelectorAll('.pb')) { const r = b.getBoundingClientRect(), k = b.dataset.k === 'special' ? 1.15 : 1,
            cx = r.left + r.width / 2, cy = r.top + r.height / 2, rr = r.width / 2 * k,
            nx = Math.max(t.left, Math.min(cx, t.right)), ny = Math.max(t.top, Math.min(cy, t.bottom));
            if (Math.hypot(nx - cx, ny - cy) < rr) bad.push(b.dataset.k); }
          return bad; })()""")
        if under: errs.append(f'{tag}: the tutorial prompt sits on the {under} button(s)')
    # the charge step: a tap does not count, a held heavy that connects does
    heavy = '.pb[data-k=heavy]'
    shot_done = False
    for i in range(12):
        if f'5 of {N}' not in await step() or 'Nice' in await step(): break
        await near()
        if touch:
            await pg.dispatch_event(heavy, 'pointerdown', {'pointerId': 7, 'isPrimary': True, 'pointerType': 'touch'})
        else:
            await pg.keyboard.down('KeyK')
        await pg.wait_for_timeout(600)
        if not shot_done:
            await pg.screenshot(path=f'{OUT}/tut_{tag}_charge.png'); shot_done = True
            if touch:
                ring = await pg.evaluate(f"document.querySelector('{heavy}').classList.contains('chg')")
                if not ring: errs.append(f'{tag}: no charge ring on the Heavy button while it is held')
        if touch:
            await pg.dispatch_event(heavy, 'pointerup', {'pointerId': 7, 'isPrimary': True, 'pointerType': 'touch'})
        else:
            await pg.keyboard.up('KeyK')
        await pg.wait_for_timeout(900)
    await wait_step(6)
    if not full:
        await ctx.close(); return
    await press('special')
    await wait_step(7)
    print('cpu percent', await pg.evaluate(f"{G}.fighters[1].percent"), 'stocks', await pg.evaluate(f"{G}.fighters[1].stocks"), '| player stocks', await pg.evaluate(f"{G}.fighters[0].stocks"))
    await pg.screenshot(path=f'{OUT}/tut_{tag}_step7.png')
    for i in range(60):
        if await pg.evaluate("window.__blastline.mode") != 'match': break
        await near(); await press('heavy'); await pg.wait_for_timeout(700)
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{OUT}/tut_{tag}_done.png')
    print('title:', await pg.evaluate("document.getElementById('rTitle').textContent"), '| tut flag:', await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.profile.v1')).tut"))
    await (pg.tap('#rAgain') if touch else pg.click('#rAgain')); await pg.wait_for_timeout(400); print('after Ranked button:', await pg.evaluate("window.__blastline.mode"), await pg.evaluate("document.getElementById('selMode').textContent"))
    await pg.reload(); await pg.wait_for_timeout(1500); print('after reload mode:', await pg.evaluate("window.__blastline.mode"))
    await ctx.close()
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        await run(b, 'desk', {'width': 1280, 'height': 760}, False, False, errs, True)
        await run(b, 'se', {'width': 667, 'height': 320}, True, False, errs, False)
        await run(b, 'phone', {'width': 844, 'height': 390}, True, False, errs, False)
        await run(b, 'up', {'width': 390, 'height': 844}, True, True, errs, False)
        await b.close()
    print(errs or 'no errors')
asyncio.run(main())
