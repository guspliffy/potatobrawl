import asyncio, sys
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for tag, vp, mob in [('se', {'width': 667, 'height': 320}, True), ('phone', {'width': 844, 'height': 390}, True), ('desk', {'width': 1280, 'height': 760}, False), ('upright', {'width': 390, 'height': 844}, True)]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
            await ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5, screen: 'up'}))")
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(700)
            if tag == 'upright': await pg.screenshot(path=f'ux2/{tag}_menu.png')
            await pg.evaluate("document.getElementById('bRanked').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelectorAll('#tiles .tile')[5].click()"); await pg.wait_for_timeout(200)
            await pg.evaluate("document.getElementById('dSkins').click()"); await pg.wait_for_timeout(400)
            await pg.evaluate("document.querySelectorAll('#skChip .sk')[2].click()"); await pg.wait_for_timeout(600)
            await pg.screenshot(path=f'ux2/{tag}_sel_skins.png')
            print(tag, errs or 'ok')
            await ctx.close()
        await b.close()
asyncio.run(main())
