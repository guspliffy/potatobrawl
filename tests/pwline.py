import asyncio, sys
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
TAG = sys.argv[1] if len(sys.argv) > 1 else 'now'
PAL = int(sys.argv[2]) if len(sys.argv) > 2 else 0
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1000, 'height': 560}, device_scale_factor=2)
        ids = "['phoenix','alchemist','odin','wizard','samurai','dragon','gunslinger','reaper']"
        await ctx.add_init_script(f"localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({{tokens: 85, rating: 1080, matches: 5, owned: Object.fromEntries({ids}.map(k => [k, [0,1,2,3]])), pal: Object.fromEntries({ids}.map(k => [k, {PAL}])) }}))")
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(700)
        await pg.click('#bRanked'); await pg.wait_for_timeout(300)
        for i in range(8):
            await pg.evaluate(f"document.querySelectorAll('#tiles .tile')[{i}].click()"); await pg.wait_for_timeout(900)
            await pg.locator('.d-stage').screenshot(path=f'shots/line_{TAG}_{i}.png')
        print(errs or 'ok')
        await b.close()
asyncio.run(main())
