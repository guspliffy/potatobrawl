import asyncio
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1000, 'height': 560}, device_scale_factor=2)
        await ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({matches: 5, gfx: '2d'}))")
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(TEST_URL); await pg.wait_for_timeout(600)
        await pg.click('#bRanked'); await pg.wait_for_timeout(300)
        for i in range(6):
            await pg.evaluate(f"document.querySelectorAll('#tiles .tile')[{i}].click()"); await pg.wait_for_timeout(500)
            await pg.locator('.d-stage').screenshot(path=f'shots/l2d_{i}.png')
        print(errs or 'ok'); await b.close()
asyncio.run(main())
