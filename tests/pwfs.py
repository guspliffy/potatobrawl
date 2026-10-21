# Fullscreen (ui/input.js FS, ui/menus.js fsSync): the menu's round button left of the gear follows the real state (fullscreenchange)
# and switches with one tap; the Settings row reads "Fullscreen in fights" with the real state under it ("Now: windowed" / "Now:
# fullscreen"); on iPhone the button (and the row's How) opens the Add to Home Screen sheet; in the home-screen app the button is
# hidden; on a tight top bar it is the first thing to go (menuFit's .nofs).
# The page is the website build (index.html), served from a made-up http origin by Playwright itself (fullscreen needs the website
# build on http(s); the file:// test page has none), so this check needs no server port.
#   python3 pwfs.py [outdir]
import asyncio, sys, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = sys.argv[1] if len(sys.argv) > 1 else 'fs'
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer, as in the other browser checks
ORIGIN = 'http://potatobrawl.test'
PROF = "potatobrawl.profile.v1"
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
PAGE = (ROOT / 'index.html').read_bytes()

async def route(r):
    u = r.request.url
    if u.rstrip('/') == ORIGIN or u.startswith(ORIGIN + '/?') or u.startswith(ORIGIN + '/index.html'):
        await r.fulfill(status=200, content_type='text/html; charset=utf-8', body=PAGE)
    else:
        await r.fulfill(status=404, body='')   # the accounts / play-count / icon requests: nothing here

async def new_page(b, tag, vp, errs, ua=None, app=False, prof=None):
    mob = vp[0] < 1000
    o = dict(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, locale='en-US')
    if ua: o['user_agent'] = ua
    ctx = await b.new_context(**o)
    await ctx.route(ORIGIN + '/**', route)
    await ctx.route('ws://potatobrawl.test/**', lambda r: r.abort())
    p = dict({'tut': True, 'last': 'samurai'}, **(prof or {}))
    await ctx.add_init_script("if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, json.dumps(json.dumps(p))))
    if app: await ctx.add_init_script("Object.defineProperty(navigator, 'standalone', { get: () => true });")   # opened from the home screen
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    # (the made-up origin has no server: its 404s and the refused WebSocket are expected)
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text and 'WebSocket' not in m.text else None)
    await pg.goto(ORIGIN + '/'); await pg.wait_for_timeout(1200)
    return ctx, pg, mob

async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }})()")
async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
FULL = "!!document.fullscreenElement"
# the button sits left of the gear, in the top bar, the gear's size, and nothing in the bar overlaps
BAR = """(() => {
  const bad = [], f = document.getElementById('bFull').getBoundingClientRect(), g = document.getElementById('bSettings').getBoundingClientRect();
  if (!(f.right <= g.left + 0.5 && Math.abs(f.top - g.top) < 2 && Math.abs(f.width - g.width) < 1)) bad.push(`button ${Math.round(f.left)},${Math.round(f.top)} ${Math.round(f.width)}px vs gear ${Math.round(g.left)},${Math.round(g.top)} ${Math.round(g.width)}px`);
  const bar = document.querySelector('#scrMenu .mm-bar'), top = bar.querySelector('.mm-topr');
  if (bar.scrollWidth > bar.clientWidth + 1 || top.scrollWidth > top.clientWidth + 1) bad.push('the top bar overflows');
  if (f.right > innerWidth + 0.5 || f.left < -0.5) bad.push('the button runs off the screen');
  return bad;
})()"""

async def desktop(b, errs):
    tag = 'desktop'
    ctx, pg, mob = await new_page(b, tag, (1280, 760), errs)
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    need(await shown(pg, '#bFull'), 'no fullscreen button on the website')
    bad = await pg.evaluate(BAR)
    need(not bad, '; '.join(bad))
    need(await pg.get_attribute('#bFull', 'aria-label') == 'Fullscreen' and not await pg.evaluate("document.getElementById('bFull').classList.contains('on')"), 'the button does not start windowed')
    # the Settings row: what it does, and the real state under it (a touch device's "On" default no longer reads as fullscreen)
    await pg.click('#bSettings'); await pg.wait_for_timeout(300)
    need(await txt(pg, '#setFullL') == 'Fullscreen in fights' and await txt(pg, '#setFullNow') == 'Now: windowed', f"row {await txt(pg, '#setFullRow')!r}")
    need(await pg.evaluate("[...document.querySelectorAll('#setFull .chip')].map((c) => c.textContent)") == ['On', 'Off'], 'the row has no On / Off')
    await pg.screenshot(path=f'{OUT}/d1280_settings.png')
    await pg.click('#setClose'); await pg.wait_for_timeout(200)
    # one tap: fullscreen, the exit icon; the browser's own exit (Esc) puts the button back
    await pg.click('#bFull'); await pg.wait_for_timeout(600)
    need(await pg.evaluate(FULL), 'a tap on the button does not go fullscreen')
    need(await pg.evaluate("document.getElementById('bFull').classList.contains('on')") and await pg.get_attribute('#bFull', 'aria-label') == 'Leave fullscreen', 'the button does not show the exit icon while fullscreen')
    await pg.screenshot(path=f'{OUT}/d1280_full.png')
    await pg.click('#bSettings'); await pg.wait_for_timeout(300)
    need(await txt(pg, '#setFullNow') == 'Now: fullscreen', f"row while fullscreen {await txt(pg, '#setFullNow')!r}")
    await pg.evaluate("document.exitFullscreen()"); await pg.wait_for_timeout(600)   # Esc, or the browser's own control
    need(not await pg.evaluate(FULL) and await txt(pg, '#setFullNow') == 'Now: windowed', f"the open row did not follow the exit: {await txt(pg, '#setFullNow')!r}")
    await pg.click('#setClose'); await pg.wait_for_timeout(200)
    need(not await pg.evaluate("document.getElementById('bFull').classList.contains('on')") and await pg.get_attribute('#bFull', 'aria-label') == 'Fullscreen', 'the button did not follow the exit')
    # the button toggles both ways
    await pg.click('#bFull'); await pg.wait_for_timeout(600)
    await pg.click('#bFull'); await pg.wait_for_timeout(600)
    need(not await pg.evaluate(FULL), 'a second tap does not leave fullscreen')
    # the setting still only decides the fights: Off, then a Practice fight starts windowed
    p = await pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)
    need(p.get('fs') is None, f"the button changed the fights' setting: fs={p.get('fs')}")
    await ctx.close()

async def phone(b, errs):
    tag = 'p740'
    ctx, pg, mob = await new_page(b, tag, (740, 360), errs)
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    if need(await shown(pg, '#bFull'), 'no fullscreen button at 740x360'):
        bad = await pg.evaluate(BAR)
        need(not bad, '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/p740_menu.png')
    await pg.tap('#bFull'); await pg.wait_for_timeout(600)
    need(await pg.evaluate(FULL), 'a tap on the phone does not go fullscreen')
    await pg.evaluate("document.exitFullscreen()"); await pg.wait_for_timeout(400)
    await ctx.close()

async def tight(b, errs):
    # the top bar at 667x320 with every coin showing (a long name, many chips, a Daily streak, cups): the fullscreen button is the first
    # thing hidden, and nothing overflows (menuFit runs on the resize)
    tag = 's667'
    ctx, pg, mob = await new_page(b, tag, (668, 320), errs)
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    await pg.evaluate("(() => { document.getElementById('mName').textContent = 'Sir Mashalot'; document.getElementById('mTokens').textContent = '128,450'; for (const id of ['mStreakN', 'mCups']) { const e = document.getElementById(id); e.hidden = false; e.textContent = '88'; } document.getElementById('mGift').hidden = false; })()")
    await pg.set_viewport_size({'width': 667, 'height': 320}); await pg.wait_for_timeout(500)
    ST = "(() => { const bar = document.querySelector('#scrMenu .mm-bar'), top = bar.querySelector('.mm-topr'); return { nofs: bar.classList.contains('nofs'), fit: document.getElementById('mRank').className, over: bar.scrollWidth > bar.clientWidth + 1 || top.scrollWidth > top.clientWidth + 1 }; })()"
    st = await pg.evaluate(ST)
    need(not st['over'], f'the top bar overflows at 667x320: {st}')
    need(st['nofs'] or await shown(pg, '#bFull'), f'the button is neither shown nor hidden for room: {st}')
    if 'fit1' in st['fit'] or 'fit2' in st['fit']: need(st['nofs'], f'the plate was squeezed before the fullscreen button went: {st}')
    await pg.screenshot(path=f'{OUT}/s667_menu.png')
    # narrower still (an old 568 x 320 phone): now the button goes, before anything else
    await pg.set_viewport_size({'width': 568, 'height': 320}); await pg.wait_for_timeout(500)
    st = await pg.evaluate(ST)
    need(st['nofs'] and not await shown(pg, '#bFull') and not st['over'], f'at 568x320 the full top bar keeps its fullscreen button or overflows: {st}')
    await pg.screenshot(path=f'{OUT}/s568_menu.png')
    await ctx.close()

# the Add to Home Screen tip never covers the Road card (or its arrow) or a menu button
TIP = """(() => {
  const t = document.getElementById('a2hsHint').getBoundingClientRect(), bad = [];
  for (const s of ['#bRoad', '#bRoad .mm-rdgo', '#bRanked', '#bDaily', '#bBw', '#bCup', '#bOnline', '#bPractice', '#bBoards', '#bHelp', '#mRank', '#bSettings', '#bFull']) {
    const e = document.querySelector(s); if (!e || e.hidden || !e.getClientRects().length) continue;
    const r = e.getBoundingClientRect();
    if (t.left < r.right && r.left < t.right && t.top < r.bottom && r.top < t.bottom) bad.push(s);
  }
  if (t.right > innerWidth + 0.5 || t.bottom > innerHeight + 0.5 || t.left < -0.5) bad.push('off the screen');
  return bad;
})()"""

async def iphone(b, errs):
    tag = 'iphone'
    # the tip waits for the first finished match (ui/base.js playedOnce): a fresh profile gets none
    ctx, pg, mob = await new_page(b, 'iphone fresh', (844, 390), errs, ua=IPHONE)
    if await shown(pg, '#a2hsHint'): errs.append('iphone fresh: the Add to Home Screen tip shows before the first match')
    await ctx.close()
    ctx, pg, mob = await new_page(b, tag, (844, 390), errs, ua=IPHONE, prof={'matches': 1})
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    need(await shown(pg, '#a2hsHint'), 'the tip should show once a match has been played')
    for vp in ((667, 320), (740, 360), (844, 390), (1280, 760)):
        await pg.set_viewport_size({'width': vp[0], 'height': vp[1]}); await pg.wait_for_timeout(400)
        bad = await pg.evaluate(TIP)
        need(not bad, f'the tip covers {bad} at {vp[0]}x{vp[1]}')
    await pg.set_viewport_size({'width': 844, 'height': 390}); await pg.wait_for_timeout(300)
    need(await shown(pg, '#bFull') and await pg.get_attribute('#bFull', 'aria-label') == 'Play without the browser bars', 'no button on iPhone Safari')
    await pg.tap('#bFull'); await pg.wait_for_timeout(400)
    need(not await pg.evaluate(FULL), 'iPhone tried the fullscreen API')
    need(await shown(pg, '#scrA2hs') and 'Add to Home Screen' in await txt(pg, '#scrA2hs') and 'Share' in await txt(pg, '#scrA2hs'), f"the sheet {await txt(pg, '#scrA2hs')!r}")
    need(await pg.evaluate("document.querySelectorAll('#scrA2hs .a2hs-ic svg').length") == 2, 'the sheet does not draw the Share and Add icons')
    fit = await pg.evaluate("(() => { const r = document.querySelector('#scrA2hs .sheet').getBoundingClientRect(), g = document.getElementById('a2hsGot').getBoundingClientRect(); return r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && g.bottom <= innerHeight + 0.5; })()")
    need(fit, 'the sheet or its Got it runs off the screen')
    await pg.screenshot(path=f'{OUT}/iphone_sheet.png')
    await pg.tap('#a2hsGot'); await pg.wait_for_timeout(300)
    need(not await shown(pg, '#scrA2hs') and not await shown(pg, '#a2hsHint'), 'Got it does not close the sheet (and the one-time tip)')
    # the Settings row on iPhone: the way there, and How opens the same sheet
    await pg.tap('#bSettings'); await pg.wait_for_timeout(300)
    need(await shown(pg, '#setFullRow') and await txt(pg, '#setFullNow') == 'Add to Home Screen gives fullscreen', f"iPhone row {await txt(pg, '#setFullRow')!r}")
    await pg.tap('#setFull .chip'); await pg.wait_for_timeout(300)
    need(await shown(pg, '#scrA2hs'), 'How does not open the sheet')
    await pg.screenshot(path=f'{OUT}/iphone_settings_how.png')
    await ctx.close()
    # the tip shows on one page load only: the next load (OK or not) never shows it
    ctx, pg, mob = await new_page(b, 'iphone tip', (844, 390), errs, ua=IPHONE, prof={'matches': 1})
    if not await shown(pg, '#a2hsHint'): errs.append('iphone tip: the tip does not show on the first load')
    if not await pg.evaluate(f"JSON.parse(localStorage.getItem('{PROF}')).a2hsSeen === true"): errs.append('iphone tip: the first showing is not remembered')
    await pg.reload(); await pg.wait_for_timeout(1200)
    if await shown(pg, '#a2hsHint'): errs.append('iphone tip: the tip shows again on the next load')
    await ctx.close()
    # upright
    ctx, pg, mob = await new_page(b, 'iphone upright', (390, 844), errs, ua=IPHONE, prof={'matches': 1, 'screen': 'up'})
    if not await shown(pg, '#a2hsHint'): errs.append('iphone upright: the tip does not show')
    bad = await pg.evaluate(TIP)
    if bad: errs.append(f'iphone upright: the tip covers {bad}')
    await ctx.close()
    # opened from the home screen: already fullscreen, no button, no row
    tag = 'app'
    ctx, pg, mob = await new_page(b, tag, (844, 390), errs, ua=IPHONE, app=True)
    if await shown(pg, '#bFull'): errs.append('app: the button shows inside the home-screen app')
    await pg.tap('#bSettings'); await pg.wait_for_timeout(300)
    if await shown(pg, '#setFullRow'): errs.append('app: the Settings row shows inside the home-screen app')
    await ctx.close()

async def main():
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        await desktop(b, errs)
        await phone(b, errs)
        await tight(b, errs)
        await iphone(b, errs)
        await b.close()
    for e in errs: print('ERROR', e)
    if not errs: print('no errors')
if __name__ == "__main__": asyncio.run(main())
