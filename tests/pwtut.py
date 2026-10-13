import asyncio
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1280, 'height': 760})
        await ctx.add_init_script("if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({gfx: '2d'})); }")
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(TEST_URL); await pg.wait_for_timeout(500)
        await pg.click('#bHelp'); await pg.wait_for_timeout(200); await pg.click('#hTry')
        await pg.wait_for_function("window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=60000)
        step = lambda: pg.evaluate("document.getElementById('tutN').textContent + ' | ' + document.getElementById('tutT').textContent")
        async def wait_step(n):
            await pg.wait_for_function(f"document.getElementById('tutN').textContent.includes('{n} of 6') && !document.getElementById('tut').classList.contains('done')", timeout=30000)
            print(await step())
        async def near():
            await pg.evaluate("(() => { const g = window.__blastline.game, me = g.fighters[0], op = g.fighters[1]; if (me.state !== 'idle' && me.state !== 'run' && me.state !== 'walk') return; me.x = op.x - 40; me.y = op.y; me.facing = 1; me.vx = 0; })()")
        await wait_step(1)
        await pg.keyboard.down('KeyD'); await pg.wait_for_timeout(1200); await pg.keyboard.up('KeyD')
        await wait_step(2)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(300); await pg.keyboard.press('Space')
        await wait_step(3)
        for i in range(30):
            if '3 of 6' not in await step() or 'Nice' in await step(): break
            await near(); await pg.keyboard.press('KeyJ'); await pg.wait_for_timeout(300)
        await wait_step(4)
        for i in range(10):
            if '4 of 6' not in await step() or 'Nice' in await step(): break
            await near(); await pg.keyboard.press('KeyK'); await pg.wait_for_timeout(600)
        await wait_step(5)
        await pg.keyboard.press('KeyL')
        await wait_step(6)
        print('dummy percent', await pg.evaluate("window.__blastline.game.fighters[1].percent"), 'stocks', await pg.evaluate("window.__blastline.game.fighters[1].stocks"))
        await pg.screenshot(path='ux2/tut_desk_step6.png')
        for i in range(30):
            if await pg.evaluate("window.__blastline.mode") != 'match': break
            await near(); await pg.keyboard.press('KeyK'); await pg.wait_for_timeout(700)
        await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=30000); await pg.wait_for_timeout(500)
        await pg.screenshot(path='ux2/tut_desk_done.png')
        print('title:', await pg.evaluate("document.getElementById('rTitle').textContent"), '| tut flag:', await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.profile.v1')).tut"))
        await pg.click('#rAgain'); await pg.wait_for_timeout(400); print('after Ranked button:', await pg.evaluate("window.__blastline.mode"), await pg.evaluate("document.getElementById('selMode').textContent"))
        await pg.reload(); await pg.wait_for_timeout(1500); print('after reload mode:', await pg.evaluate("window.__blastline.mode"))
        print(errs or 'no errors')
        await b.close()
asyncio.run(main())
