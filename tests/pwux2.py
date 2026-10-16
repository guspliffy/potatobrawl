import asyncio, sys, math
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
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
    await clk('#mRank'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/{tag}_1c_account.png'); await clk('#acClose'); await pg.wait_for_timeout(200)
    await clk('#bHelp'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/{tag}_2_help.png'); await clk('#hClose'); await pg.wait_for_timeout(200)
    await clk('#bRanked'); await pg.wait_for_timeout(700); await pg.screenshot(path=f'{OUT}/{tag}_3_select.png')
    await pg.evaluate("document.querySelectorAll('#tiles .tile')[5].click()"); await pg.wait_for_timeout(200)
    await clk('#dSkins'); await pg.wait_for_timeout(500)   # the Skins bar opens the Skin Rack
    await pg.evaluate("document.querySelectorAll('#skChip .sk')[2].click()"); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{OUT}/{tag}_4_select_skin.png')
    await clk('#skClose'); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('#tiles .tile')[0].click()"); await pg.wait_for_timeout(200)
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
# --- start page: the profile plate + coins (#mRank: avatar with the rank emblem, name, tier + rating, chips) in the top bar, left of the
#     gear (upright: the top-left corner, the gear top right); touch controls: Heavy/Special sizes, spacing, jump boost ---
MENU_CHECK = """(() => {
  const q = (s) => document.querySelector(s).getBoundingClientRect();
  const R = q('#mRank'), G = q('#bSettings'), W = innerWidth, H = innerHeight, up = document.getElementById('app').classList.contains('portrait');
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const bad = [];
  if (hit(R, G)) bad.push('settings gear');
  const ink = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };   // the h1 box is wider than its letters
  const T = document.getElementById('mTitle'), TR = T.hidden ? null : T.getBoundingClientRect();   // the title sticker under the plate
  if (hit(R, ink(document.querySelector('#scrMenu h1'))) || (TR && TR.width && hit(TR, ink(document.querySelector('#scrMenu h1'))))) bad.push('logo');
  for (const el of document.querySelectorAll('#scrMenu .mm-col button, #rotHint:not([hidden])')) { const b = el.getBoundingClientRect(); if (hit(R, b) || (TR && TR.width && hit(TR, b))) bad.push(el.id || el.textContent.trim().slice(0, 12)); }
  if (R.left < 0 || R.right > W || R.top < 0) bad.push('off screen');
  if (R.right > G.left) bad.push('not left of the gear');
  if (R.top > 40 || (up ? R.left > 40 : W - R.right > 80 + 20)) bad.push(up ? 'not in the top left corner' : 'not in the top right corner');
  if (Math.abs(R.height - G.height) > 1) bad.push('not the height of the gear');
  // the compact plate (667x320, or a full bar) is the picture and the emblem only, by design: the rating is checked where it shows
  const compact = document.getElementById('app').classList.contains('tiny') || document.getElementById('mRank').classList.contains('fit2');
  const ids = ['mAvatar', 'mBadge', 'mTokens'].concat(compact ? [] : ['mRating']).filter((i) => { const r = q('#' + i); return r.width < 4 || r.right > R.right + 1 || r.left < R.left - 1; });
  if (ids.length) bad.push('clipped: ' + ids.join(','));
  const btns = [...document.querySelectorAll('#scrMenu .mm-col button')].map((b) => b.getBoundingClientRect());
  if (btns[0].top < q('#scrMenu .mm-logo').bottom) bad.push('buttons start inside the logo');
  if (btns[btns.length - 1].bottom > H) bad.push('buttons run off the bottom');
  return bad;
})()"""
# hidden buttons (ULTI until the bar is full; pwult.py checks its place once it shows) are left out
PAD_RECTS = """(() => { const o = {}; for (const b of document.querySelectorAll('.pb')) { const r = b.getBoundingClientRect(); if (!r.width) continue; o[b.dataset.k] = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; } return o; })()"""
SP = "document.querySelector('.pb[data-k=special]')"
def layout(tag, what, rc, vp, top, errs):
    ks = list(rc)
    for i, a in enumerate(ks):
        A = rc[a]
        if A['x'] - A['r'] < 8 or A['x'] + A['r'] > vp['width'] - 8 or A['y'] - A['r'] < top or A['y'] + A['r'] > vp['height'] - 4:
            errs.append(f"{tag} {what}: {a} too near the screen edge or panel top")
        for b in ks[i + 1:]:
            B = rc[b]; gap = math.hypot(A['x'] - B['x'], A['y'] - B['y']) - A['r'] - B['r']
            if gap < 4: errs.append(f"{tag} {what}: {a} and {b} are {gap:.1f}px apart")
async def hud(b, tag, vp, up, errs):
    mob = vp['width'] < 1000
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=True)
    await ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5%s}))" % (", screen: 'up'" if up else ""))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(900)
    for bad in await pg.evaluate(MENU_CHECK): errs.append(f'{tag} menu: {bad}')
    await pg.screenshot(path=f'{OUT}/{tag}_menu.png')
    # practice against the Dummy, so nothing hits the player while the jump is measured
    await pg.tap('#bPractice'); await pg.wait_for_timeout(500)
    await pg.tap('#lvlPick'); await pg.wait_for_timeout(200)
    await pg.evaluate("[...document.querySelectorAll('#lvlPop button')].find((x) => x.textContent === 'Dummy').click()"); await pg.wait_for_timeout(200)
    # on Potato Moon: the jump and fall heights below are measured against its layout (Practice picks a random map otherwise)
    await pg.evaluate("document.querySelectorAll('#mapPop button')[1].click()"); await pg.wait_for_timeout(100)
    await pg.tap('#selGo'); await pg.wait_for_timeout(700)
    await pg.wait_for_function("window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=60000)
    await frames(pg, 30)
    top = await pg.evaluate("innerHeight - parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--panelH'))") if up else 0
    rc = await pg.evaluate(PAD_RECTS)
    layout(tag, 'normal', rc, vp, top, errs)
    h, s = rc['heavy']['r'] * 2, rc['special']['r'] * 2
    k = rc['jump']['r'] * 2 / 70    # the upright panel scales the cluster (0.9)
    if abs(h - 73 * k) > 1 or abs(s - 64 * k) > 1: errs.append(f'{tag}: heavy {h:.1f}px / special {s:.1f}px, want {73 * k:.1f} / {64 * k:.1f}')
    await pg.screenshot(path=f'{OUT}/{tag}_6_hud.png')
    # boosted: layout must still be clean, and the size is +15%
    await pg.evaluate(f"{SP}.style.transform = 'scale(1.15)'")
    await pg.wait_for_function(f"{SP}.getBoundingClientRect().width > {s} * 1.14", timeout=20000); await pg.wait_for_timeout(100)
    rb = await pg.evaluate(PAD_RECTS)
    layout(tag, 'special boosted', rb, vp, top, errs)
    if abs(rb['special']['r'] * 2 / s - 1.15) > 0.01: errs.append(f"{tag}: boosted special is {rb['special']['r'] * 2 / s:.3f}x, want 1.15x")
    await pg.evaluate(f"{SP}.style.transform = ''")
    await pg.wait_for_function(f"{SP}.getBoundingClientRect().width < {s} * 1.01", timeout=20000)
    # the real thing: Jump boosts the Special until landing
    cls = lambda: pg.evaluate(f"{SP}.classList.contains('jb')")
    if await cls(): errs.append(f'{tag}: special boosted before any jump')
    await pg.tap('.pb[data-k=jump]')
    await pg.wait_for_function(f"{SP}.classList.contains('jb')", timeout=15000)
    await pg.wait_for_function(f"{SP}.getBoundingClientRect().width > {s} * 1.14", timeout=15000); await pg.wait_for_timeout(60)
    await pg.screenshot(path=f'{OUT}/{tag}_6b_hud_jump.png')
    await pg.wait_for_function(f"!{SP}.classList.contains('jb')", timeout=15000)   # landed
    # air jump counts too
    await pg.tap('.pb[data-k=jump]'); await pg.wait_for_function(f"{SP}.classList.contains('jb')", timeout=15000)
    await pg.wait_for_function(f"!{SP}.classList.contains('jb')", timeout=15000)
    # falls that are not jumps: walking off a ledge (in the air, no jump event) does not boost
    await pg.evaluate("(() => { const f = window.__blastline.game.fighters[0]; f.grounded = false; f.state = 'air'; f.y -= 170; f.vy = 0; })()")
    await frames(pg, 6)
    if await pg.evaluate("window.__blastline.game.fighters[0].grounded"): errs.append(f'{tag}: test fall ended too early')
    if await cls(): errs.append(f'{tag}: special boosted while falling without a jump')
    await pg.wait_for_function("window.__blastline.game.fighters[0].grounded", timeout=15000); await frames(pg, 4)
    # a hit out of a jump ends the boost, and being knocked up does not start one
    await pg.tap('.pb[data-k=jump]'); await pg.wait_for_function(f"{SP}.classList.contains('jb')", timeout=15000)
    await pg.evaluate("(() => { const f = window.__blastline.game.fighters[0]; f.state = 'hitstun'; f.hitstun = 30; f.tumble = true; f.kby = -6; })()")
    await pg.wait_for_function(f"!{SP}.classList.contains('jb')", timeout=15000)
    await frames(pg, 40)
    if await cls(): errs.append(f'{tag}: special boosted again after being hit out of a jump')
    await ctx.close()
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        await shoot(b, 'phone', {'width': 844, 'height': 390}, True, errs)
        await shoot(b, 'se', {'width': 667, 'height': 320}, True, errs)
        await shoot(b, 'w740', {'width': 740, 'height': 360}, True, errs)   # 740 x 360: many Android phones held sideways (the placing plate's size)
        await shoot(b, 'desk', {'width': 1280, 'height': 760}, False, errs)
        for tag, vp, up in [('se', {'width': 667, 'height': 320}, False), ('w740', {'width': 740, 'height': 360}, False), ('phone', {'width': 844, 'height': 390}, False), ('desk', {'width': 1280, 'height': 760}, False), ('up', {'width': 390, 'height': 844}, True)]:
            await hud(b, tag + 'T', vp, up, errs)
        await fresh(b, 'phone', {'width': 844, 'height': 390}, True, errs)
        await fresh(b, 'desk', {'width': 1280, 'height': 760}, False, errs)
        await b.close()
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
