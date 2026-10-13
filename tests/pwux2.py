import asyncio, sys
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
OUT = sys.argv[1] if len(sys.argv) > 1 else 'ux2'
async def frames(pg, n):
    t0 = await pg.evaluate("window.__blastline.game.t")
    await pg.wait_for_function(f"window.__blastline.game.t >= {t0 + n}", timeout=60000)
async def shoot(b, tag, vp, mob, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    await ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5}))")
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(900)
    clk = (lambda sel: pg.tap(sel)) if mob else (lambda sel: pg.click(sel))
    await pg.screenshot(path=f'{OUT}/{tag}_1_menu.png')
    await clk('#bSettings'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/{tag}_1b_settings.png'); await clk('#setClose'); await pg.wait_for_timeout(200)
    await clk('#bHelp'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/{tag}_2_help.png'); await clk('#hClose'); await pg.wait_for_timeout(200)
    await clk('#bRanked'); await pg.wait_for_timeout(700); await pg.screenshot(path=f'{OUT}/{tag}_3_select.png')
    await pg.evaluate("document.querySelectorAll('.tile')[5].click()"); await pg.wait_for_timeout(200)
    await pg.evaluate("document.querySelectorAll('.sw')[2].click()"); await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/{tag}_4_select_skin.png')
    await pg.evaluate("document.querySelectorAll('.tile')[0].click()"); await pg.wait_for_timeout(200)
    await clk('#selGo'); await pg.wait_for_timeout(700)
    await pg.wait_for_function("window.__blastline.game && window.__blastline.game.phase !== 'countdown'", timeout=60000)
    await frames(pg, 60)
    await clk('#pauseBtn'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/{tag}_7_pause.png'); await clk('#pResume'); await pg.wait_for_timeout(200)
    await pg.evaluate("(() => { const g = window.__blastline.game; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; })()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000); await pg.wait_for_timeout(900)
    await pg.screenshot(path=f'{OUT}/{tag}_8_result.png')
    await clk('#rMenu'); await pg.wait_for_timeout(300); await clk('#bPractice'); await pg.wait_for_timeout(500)
    await clk('#oppPick'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{OUT}/{tag}_5_practice.png')
    await ctx.close()
async def fresh(b, tag, vp, mob, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true")
    await pg.wait_for_function("window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=60000)
    await frames(pg, 20); await pg.screenshot(path=f'{OUT}/{tag}_t1.png')
    await ctx.close()
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        await shoot(b, 'phone', {'width': 844, 'height': 390}, True, errs)
        await shoot(b, 'se', {'width': 667, 'height': 320}, True, errs)
        await shoot(b, 'desk', {'width': 1280, 'height': 760}, False, errs)
        await fresh(b, 'phone', {'width': 844, 'height': 390}, True, errs)
        await fresh(b, 'desk', {'width': 1280, 'height': 760}, False, errs)
        await b.close()
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
