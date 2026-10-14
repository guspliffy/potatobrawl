import asyncio, sys
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PAIRS = [('samurai', 'dragon'), ('odin', 'wizard'), ('phoenix', 'alchemist'), ('reaper', 'gunslinger')]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for gfx in ('2d',):
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script(f"localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({{matches: 5, gfx: '{gfx}'}}))")
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(600)
            for a, o in PAIRS:
                await pg.evaluate(f"(() => {{ document.getElementById('bPractice').click(); }})()"); await pg.wait_for_timeout(200)
                idx = ['phoenix','alchemist','odin','wizard','samurai','dragon','gunslinger','reaper'].index(a)
                await pg.evaluate(f"document.querySelectorAll('.tile')[{idx}].click()")
                await pg.evaluate(f"(() => {{ document.getElementById('oppPick').click(); }})()"); await pg.wait_for_timeout(100)
                oi = ['random','phoenix','alchemist','odin','wizard','samurai','dragon','gunslinger','reaper'].index(o)
                await pg.evaluate(f"document.querySelectorAll('#oppPop button')[{oi}].click()")
                await pg.evaluate("document.getElementById('selGo').click()")
                await pg.wait_for_function("window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=60000)
                await pg.evaluate("(() => { const g = window.__blastline.game; g.fighters[0].x = -45; g.fighters[1].x = 45; })()")
                await pg.wait_for_timeout(900)
                await pg.screenshot(path=f'shots/m_{gfx}_{a}_{o}.png')
                await pg.evaluate("document.getElementById('pauseBtn').click()"); await pg.wait_for_timeout(100)
                await pg.evaluate("document.getElementById('pQuit').click()"); await pg.wait_for_timeout(300)
            print(gfx, errs or 'ok')
            await ctx.close()
        await b.close()
asyncio.run(main())
