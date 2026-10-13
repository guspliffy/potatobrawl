import asyncio, sys
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
OUT = 'ux2'
URL = 'http://localhost:8091/'
INIT = "localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5, gfx: '2d'}))"
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ca = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
        cb = await b.new_context(viewport={'width': 1280, 'height': 760})
        for c in (ca, cb): await c.add_init_script(INIT)
        A = await ca.new_page(); B = await cb.new_page()
        for t, pg in (('A', A), ('B', B)):
            pg.on('pageerror', lambda e, t=t: errs.append(f'{t}: {e}'))
        await A.goto(URL); await B.goto(URL); await A.wait_for_timeout(800)
        await A.tap('#bOnline'); await A.wait_for_timeout(1200); await A.screenshot(path=f'{OUT}/on_A_lobby.png')
        await A.tap('#onHost'); await A.wait_for_timeout(1200); await A.screenshot(path=f'{OUT}/on_A_hosting.png')
        await B.click('#bOnline'); await B.wait_for_timeout(1500); await B.screenshot(path=f'{OUT}/on_B_list.png')
        await B.click('#onList li .chip'); 
        await A.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        await B.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        await A.wait_for_timeout(4000); await A.screenshot(path=f'{OUT}/on_A_match.png')
        print('desyncs before hook', await A.evaluate("window.__blastline.net.desyncs"), await B.evaluate("window.__blastline.net.desyncs"))
        fr = max(await A.evaluate("window.__blastline.net.frame"), await B.evaluate("window.__blastline.net.frame")) + 90
        hook = f"window.__blTestAt = {{ f: {fr}, fn: (g) => {{ g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }} }}"
        await A.evaluate(hook); await B.evaluate(hook)
        await A.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
        await A.wait_for_timeout(1200); await A.screenshot(path=f'{OUT}/on_A_result.png')
        await B.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
        await B.screenshot(path=f'{OUT}/on_B_result.png')
        print('desyncs', await A.evaluate("window.__blastline.net.desyncs"), await B.evaluate("window.__blastline.net.desyncs"))
        # both ask for a rematch (the KO finisher must hand over to the results screen cleanly on both sides)
        await A.tap('#rAgain'); await B.click('#rAgain')
        await A.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        await B.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        print('rematch ok')
        await b.close()
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
