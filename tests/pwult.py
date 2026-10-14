# Ultimates on the HUD and the controls (UI only): the bar under each name card, the ULTI button, the U key, the gamepad Y button.
#   python3 pwult.py [outdir [tag ...]]   tags: se phone desk up kbd pad   (default all; screenshots go to outdir, default the current directory)
# Touch sizes (se 667x320, phone 844x390, desk 1280x760 with touch controls, up = upright 390x844):
#   bar      empty / half / full under both cards: the fill follows ult / ultNeed in the fighter's colour, gold and flashing when full,
#            two pips (uses left), the strip hangs under the card and clears the pause icon; pictures of each
#   button   ULTI is hidden until the own bar is full, then pops out gold (animation), inside the screen and clear of every other
#            button, the pause icon, both cards and their bars; pictures
#   press    a real press (se, desk: the U key; phone, up: a tap on the button) starts the ulti (ultN 1, move "ulti"), the button
#            hides, one pip goes grey; the second use needs 120 and works the same way (the other kind of press); after that both
#            pips are grey, the bar is dimmed and the button never comes back
# kbd (1280x760, keyboard only): no touch buttons, a U key by the own bar when full, U starts the ulti; pad (same, a fake gamepad):
#   Y (button 3) is the ulti and does nothing with an empty bar, button 2 is still jump and no longer ulti.
# phone also: reduced motion shows the button without animation. Prints "no errors" when every check passed and no page errors happened.
import asyncio, sys, os
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
ONLY = sys.argv[2:]
G = 'window.__blastline.game'
PROFILE = "localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5, tut: true%s}))"
PAD_STUB = """(() => { window.__padB = {}; const mk = () => Array.from({length: 17}, (_, i) => ({ pressed: !!window.__padB[i], touched: false, value: window.__padB[i] ? 1 : 0 }));
  navigator.getGamepads = () => [{ connected: true, id: 'stub', index: 0, axes: [0, 0, 0, 0], buttons: mk(), mapping: 'standard' }]; })()"""
GOLD = [243, 200, 74]

async def frames(pg, n):
    t0 = await pg.evaluate(f"{G}.t")
    await pg.wait_for_function(f"{G}.t >= {t0 + n}", timeout=60000)

async def start(b, tag, vp, up, errs, touch=True, reduced=False, pad=False):
    mob = vp['width'] < 1000
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob and touch, has_touch=touch, reduced_motion='reduce' if reduced else 'no-preference')
    await ctx.add_init_script(PROFILE % (", screen: 'up'" if up else ""))
    if pad: await ctx.add_init_script("window.addEventListener('DOMContentLoaded', () => {" + PAD_STUB + "});")
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(900)
    click = pg.tap if touch else pg.click
    await click('#bPractice'); await pg.wait_for_timeout(500)
    await click('#lvlPick'); await pg.wait_for_timeout(200)
    await pg.evaluate("(n) => [...document.querySelectorAll('#lvlPop button')].find((x) => x.textContent === n).click()", 'Dummy'); await pg.wait_for_timeout(200)
    await click('#selGo'); await pg.wait_for_timeout(700)
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    await pg.evaluate(f"{G}.fighters[1].stocks = 9")   # the ulti must not end the match
    await frames(pg, 20)
    return ctx, pg

def rgb(s): return [int(float(x)) for x in __import__('re').findall(r'[\d.]+', s)[:3]]

# the state of one card's strip, read from the page
STRIP = """(i) => { const c = document.getElementById('pc' + i), s = c.querySelector('.pc-ult'), f = s.querySelector('.uf'), cs = getComputedStyle(f);
  return { u: parseFloat(s.style.getPropertyValue('--u') || '0'), full: s.classList.contains('full'), none: s.classList.contains('none'), flash: s.classList.contains('flash'),
    pips: [...s.querySelectorAll('.up i')].filter((p) => !p.classList.contains('sp')).length, fill: cs.backgroundColor, fc: getComputedStyle(c).getPropertyValue('--fc').trim(), w: f.getBoundingClientRect().width,
    track: s.querySelector('.ub').getBoundingClientRect().width, hidden: s.hidden, key: !s.querySelector('.uk').hidden, shown: !!s.offsetParent }; }"""
BTN = """(() => { const b = document.querySelector('.pb[data-k=ulti]'), cs = getComputedStyle(b); return { shown: !!b.offsetParent, rdy: b.classList.contains('rdy'), anim: cs.animationName, display: cs.display, on: b.classList.contains('on') }; })()"""

# geometry of the ULTI button against everything else on the HUD (circles for round buttons, boxes for the rest)
GEOM = """(() => {
  const bad = [], r = (e) => e.getBoundingClientRect(), u = document.querySelector('.pb[data-k=ulti]');
  if (!u.offsetParent) return ['the ULTI button is not shown'];
  const ur = r(u), cx = ur.left + ur.width / 2, cy = ur.top + ur.height / 2, rr = ur.width / 2;
  if (ur.left < 0 || ur.top < 0 || ur.right > innerWidth || ur.bottom > innerHeight) bad.push('the ULTI button is off screen');
  for (const b of document.querySelectorAll('.pb')) {
    if (b === u || !b.offsetParent) continue;
    // the Special grows 15% in the air: its box already includes that when it is boosted, so work from the resting size
    const q = r(b), k = b.dataset.k === 'special' ? (b.classList.contains('jb') ? 1 : 1.15) : 1, bx = q.left + q.width / 2, by = q.top + q.height / 2, br = q.width / 2 * k;
    if (Math.hypot(bx - cx, by - cy) < br + rr + 1) bad.push('ULTI overlaps the ' + b.dataset.k + ' button (gap ' + (Math.hypot(bx - cx, by - cy) - br - rr).toFixed(1) + ')');
  }
  const box = (name, e) => { const q = r(e), nx = Math.max(q.left, Math.min(cx, q.right)), ny = Math.max(q.top, Math.min(cy, q.bottom));
    if (Math.hypot(nx - cx, ny - cy) < rr) bad.push('ULTI overlaps ' + name + ' [' + [q.left, q.top, q.right, q.bottom].map((v) => Math.round(v)) + '] ULTI [' + [ur.left, ur.top, ur.right, ur.bottom].map((v) => Math.round(v)) + ']'); };
  box('the pause icon', document.getElementById('pauseBtn'));
  box('the timer', document.getElementById('clock'));
  for (const id of ['pc0', 'pc1']) box('the ' + (id === 'pc0' ? 'own' : 'opponent') + ' ultimate bar', document.querySelector('#' + id + ' .pc-ult'));
  // the cards are skewed: their bounding boxes include empty corners, so test the card's visible corner points instead
  for (const id of ['pc0', 'pc1']) { const c = document.getElementById(id), q = r(c), sk = Math.tan(9 * Math.PI / 180) * q.height / 2;
    const pts = [[q.left + sk * 2, q.top], [q.right, q.top], [q.right - sk * 2, q.bottom], [q.left, q.bottom]];
    // polygon-circle: inside the polygon, or an edge within the radius
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > cy) !== (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside; }
    let near = inside ? 0 : 1e9;
    for (let i = 0, j = 3; i < 4; j = i++) { const [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy))); near = Math.min(near, Math.hypot(ax + t * dx - cx, ay + t * dy - cy)); }
    if (near < rr) bad.push('ULTI overlaps the ' + (id === 'pc0' ? 'own' : 'opponent') + ' card'); }
  return bad;
})()"""
# the strips hang under their cards and the pause icon stays clear of them
STRIPS = """(() => { const bad = [], r = (e) => e.getBoundingClientRect(), pb = r(document.getElementById('pauseBtn'));
  for (const id of ['pc0', 'pc1']) {
    const c = document.getElementById(id), s = c.querySelector('.pc-ult'), cq = r(c), sq = r(s);
    if (sq.top < cq.bottom - 6) bad.push(id + ': the strip is not under the card');
    if (sq.right > innerWidth + 1 || sq.left < -6) bad.push(id + ': the strip is off screen');
    if (sq.height < 4 || sq.height > 10) bad.push(id + ': the strip is ' + sq.height + 'px high');
    if (sq.left < pb.right && pb.left < sq.right && sq.top < pb.bottom && pb.top < sq.bottom) bad.push(id + ': the strip touches the pause icon');
  }
  return bad; })()"""

async def check_strips(pg, tag, errs):
    for bad in await pg.evaluate(STRIPS): errs.append(f'{tag} bars: {bad}')

async def pop_done(pg):   # the button's pop-out has finished (its rectangle is the resting one); the glow goes on for ever
    await pg.evaluate("Promise.all(document.querySelector('.pb[data-k=ulti]').getAnimations().filter((a) => a.animationName === 'ultiPop').map((a) => a.finished))")

async def wait_can_act(pg):
    await pg.wait_for_function(f"['idle', 'run', 'walk', 'air'].includes({G}.fighters[0].state)", timeout=30000)
    await frames(pg, 10)

async def press(pg, how):
    if how == 'tap': await pg.tap('.pb[data-k=ulti]')
    else: await pg.keyboard.press('KeyU')

async def sizes_run(b, tag, vp, up, how1, how2, errs):
    ctx, pg = await start(b, tag, vp, up, errs)
    shot = lambda n: pg.screenshot(path=f'{OUT}/ult_{tag}_{n}.png')
    # ---- empty ----
    s0, s1, bt = await pg.evaluate(STRIP, 0), await pg.evaluate(STRIP, 1), await pg.evaluate(BTN)
    if s0['u'] != 0 or s0['full'] or s0['pips'] != 2 or s0['none'] or not s0['shown']: errs.append(f'{tag} empty bar: {s0}')
    if s1['u'] != 0 or s1['pips'] != 2: errs.append(f'{tag} empty bar (opponent): {s1}')
    if bt['shown'] or bt['rdy']: errs.append(f'{tag} button: shown with an empty bar {bt}')
    if rgb(s0['fill']) == GOLD: errs.append(f'{tag} empty bar: the fill is gold')
    await check_strips(pg, tag, errs)
    await shot('1_empty')
    # ---- half (own 50 of 100, opponent 30) ----
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[0].ult = 50; g.fighters[1].ult = 30; }})()")
    await frames(pg, 30)
    s0, s1, bt = await pg.evaluate(STRIP, 0), await pg.evaluate(STRIP, 1), await pg.evaluate(BTN)
    if abs(s0['u'] - 0.5) > 0.02 or s0['full']: errs.append(f'{tag} half bar: {s0}')
    if abs(s1['u'] - 0.3) > 0.02: errs.append(f'{tag} half bar (opponent): {s1}')
    if not (0.4 * s0['track'] <= s0['w'] <= 0.6 * s0['track']): errs.append(f'{tag} half bar: the fill is {s0["w"]:.0f} of {s0["track"]:.0f}px, want about half')
    if rgb(s0['fill']) == GOLD: errs.append(f'{tag} half bar: the fill is gold before it is full')
    if bt['shown']: errs.append(f'{tag} button: shown at half {bt}')
    await shot('2_half')
    # ---- full: gold, a flash, the button pops out ----
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[0].ult = 100; g.fighters[1].ult = 100; }})()")
    try: await pg.wait_for_function("document.querySelector('#pc0 .pc-ult').classList.contains('flash')", timeout=3000)
    except Exception: errs.append(f'{tag} full bar: no flash when it filled')
    try: await pg.wait_for_function("(() => { const b = document.querySelector('.pb[data-k=ulti]'); return b.offsetParent && getComputedStyle(b).animationName.includes('ultiPop'); })()", timeout=3000)
    except Exception: errs.append(f'{tag} button: no pop animation when it appeared {await pg.evaluate(BTN)}')
    await pop_done(pg)
    s0, s1, bt = await pg.evaluate(STRIP, 0), await pg.evaluate(STRIP, 1), await pg.evaluate(BTN)
    if not s0['full'] or abs(s0['u'] - 1) > 0.01 or rgb(s0['fill']) != GOLD: errs.append(f'{tag} full bar: {s0}')
    if not s1['full']: errs.append(f'{tag} full bar (opponent): {s1}')
    if s0['key']: errs.append(f'{tag} full bar: the U key hint shows on a touch screen')
    if not bt['shown'] or not bt['rdy']: errs.append(f'{tag} button: not shown with a full bar {bt}')
    if 'ultiGlow' not in bt['anim']: errs.append(f'{tag} button: no gold glow animation {bt["anim"]}')
    for bad in await pg.evaluate(GEOM): errs.append(f'{tag} button: {bad}')
    await check_strips(pg, tag, errs)
    await shot('3_full')
    # ---- the first press ----
    await press(pg, how1)
    try: await pg.wait_for_function(f"{G}.fighters[0].ultN === 1", timeout=8000)
    except Exception: errs.append(f'{tag} press ({how1}): no ulti started, ultN {await pg.evaluate(G + ".fighters[0].ultN")} state {await pg.evaluate(G + ".fighters[0].state")}')
    f = await pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; return {{ n: f.ultN, ult: f.ult, state: f.state, mid: f.mid }}; }})()")
    if f['n'] == 1 and (f['state'] != 'attack' or f['mid'] != 'ulti' or f['ult'] != 0): errs.append(f'{tag} press ({how1}): fighter is {f}')
    await pg.wait_for_timeout(300)
    bt, s0 = await pg.evaluate(BTN), await pg.evaluate(STRIP, 0)
    if bt['shown'] or bt['rdy']: errs.append(f'{tag} button: still shown after the ulti started {bt}')
    if s0['full'] or s0['u'] > 0.5 or s0['pips'] != 1: errs.append(f'{tag} after use 1: bar {s0}, want empty, not full and one pip')
    await wait_can_act(pg)
    # ---- the second use needs 120 ----
    await pg.evaluate(f"{G}.fighters[0].ult = 100")
    await frames(pg, 20)
    s0, bt = await pg.evaluate(STRIP, 0), await pg.evaluate(BTN)
    if s0['full'] or bt['shown'] or abs(s0['u'] - 100 / 120) > 0.02: errs.append(f'{tag} second ulti: 100 must not be full ({s0}, button {bt})')
    await pg.evaluate(f"{G}.fighters[0].ult = 120")
    await pg.wait_for_function("!!document.querySelector('.pb[data-k=ulti]').offsetParent", timeout=5000)
    await pop_done(pg)
    for bad in await pg.evaluate(GEOM): errs.append(f'{tag} button (second use): {bad}')
    await press(pg, how2)
    try: await pg.wait_for_function(f"{G}.fighters[0].ultN === 2", timeout=8000)
    except Exception: errs.append(f'{tag} press ({how2}): the second ulti did not start')
    await pg.wait_for_timeout(300)
    bt, s0 = await pg.evaluate(BTN), await pg.evaluate(STRIP, 0)
    if bt['shown']: errs.append(f'{tag} button: shown after the second ulti {bt}')
    if s0['pips'] != 0 or not s0['none'] or s0['full']: errs.append(f'{tag} both used: bar {s0}, want no pips and dimmed')
    await shot('4_spent')
    # nothing brings it back
    await wait_can_act(pg)
    await pg.evaluate(f"{G}.fighters[0].ult = 500")
    await frames(pg, 30)
    bt, s0 = await pg.evaluate(BTN), await pg.evaluate(STRIP, 0)
    if bt['shown'] or s0['full']: errs.append(f'{tag} button: back with both ultis spent {bt} {s0}')
    await ctx.close()

async def reduced_run(b, errs):
    tag, vp = 'phone_reduced', {'width': 844, 'height': 390}
    ctx, pg = await start(b, tag, vp, False, errs, reduced=True)
    await pg.evaluate(f"{G}.fighters[0].ult = 100")
    await pg.wait_for_function("!!document.querySelector('.pb[data-k=ulti]').offsetParent", timeout=5000)
    bt = await pg.evaluate(BTN)
    if bt['anim'] != 'none': errs.append(f'{tag}: the button animates with reduced motion ({bt["anim"]})')
    shadow = await pg.evaluate("getComputedStyle(document.querySelector('.pb[data-k=ulti]')).boxShadow")
    if 'rgb' not in shadow or shadow == 'none': errs.append(f'{tag}: no steady glow with reduced motion ({shadow})')
    await ctx.close()

async def kbd_run(b, errs):
    tag, vp = 'kbd', {'width': 1280, 'height': 760}
    ctx, pg = await start(b, tag, vp, False, errs, touch=False)
    shot = lambda n: pg.screenshot(path=f'{OUT}/ult_{tag}_{n}.png')
    if await pg.evaluate("!!document.querySelector('#ctl').offsetParent"): errs.append(f'{tag}: touch controls are showing on a computer')
    await pg.keyboard.press('KeyU'); await frames(pg, 10)
    if await pg.evaluate(f"{G}.fighters[0].ultN") != 0: errs.append(f'{tag}: U with an empty bar started an ulti')
    await shot('1_empty')
    await pg.evaluate(f"{G}.fighters[0].ult = 100")
    await frames(pg, 30)
    s0, s1 = await pg.evaluate(STRIP, 0), await pg.evaluate(STRIP, 1)
    if not s0['full'] or not s0['key']: errs.append(f'{tag}: a full bar should show the U key by the own bar {s0}')
    if s1['key']: errs.append(f'{tag}: the U key hint shows on the opponent bar')
    await shot('3_full')
    await pg.keyboard.press('KeyU')
    try: await pg.wait_for_function(f"{G}.fighters[0].ultN === 1", timeout=8000)
    except Exception: errs.append(f'{tag}: U with a full bar did not start the ulti')
    await frames(pg, 20)
    s0 = await pg.evaluate(STRIP, 0)
    if s0['key'] or s0['full'] or s0['pips'] != 1: errs.append(f'{tag}: after the ulti {s0}')
    await ctx.close()

async def pad_run(b, errs):
    tag, vp = 'pad', {'width': 1280, 'height': 760}
    ctx, pg = await start(b, tag, vp, False, errs, touch=False, pad=True)
    async def hold(i, n=8):
        await pg.evaluate(f"window.__padB[{i}] = true"); await frames(pg, n); await pg.evaluate(f"window.__padB[{i}] = false"); await frames(pg, 4)
    await wait_can_act(pg)
    st = lambda: pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; return {{ state: f.state, n: f.ultN, grounded: f.grounded }}; }})()")
    await hold(3)   # Y with an empty bar: nothing (it used to be a second jump)
    s = await st()
    if s['n'] != 0 or s['state'] not in ('idle', 'run', 'walk'): errs.append(f'{tag}: button 3 with an empty bar should do nothing, got {s}')
    await hold(2, 3)   # button 2 is still jump
    await pg.wait_for_function(f"{G}.fighters[0].state === 'air' || {G}.fighters[0].state === 'jumpsquat'", timeout=5000)
    await wait_can_act(pg)
    try: await pg.wait_for_function(f"{G}.fighters[0].grounded", timeout=8000)
    except Exception: pass
    await pg.evaluate(f"{G}.fighters[0].ult = 100")
    await frames(pg, 10)
    await hold(2, 3)   # button 2 with a full bar must still only jump
    if await pg.evaluate(f"{G}.fighters[0].ultN") != 0: errs.append(f'{tag}: button 2 started the ulti')
    await wait_can_act(pg)
    try: await pg.wait_for_function(f"{G}.fighters[0].grounded", timeout=8000)
    except Exception: pass
    await hold(3)
    try: await pg.wait_for_function(f"{G}.fighters[0].ultN === 1", timeout=8000)
    except Exception: errs.append(f'{tag}: button 3 (Y) with a full bar did not start the ulti')
    await ctx.close()

async def main():
    errs = []
    sizes = [('se', {'width': 667, 'height': 320}, False, 'key', 'tap'), ('phone', {'width': 844, 'height': 390}, False, 'tap', 'key'),
             ('desk', {'width': 1280, 'height': 760}, False, 'tap', 'key'), ('up', {'width': 390, 'height': 844}, True, 'tap', 'key')]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for tag, vp, up, h1, h2 in sizes:
            if not ONLY or tag in ONLY:
                await sizes_run(b, tag, vp, up, h1, h2, errs); print(tag, 'done', flush=True)
        if not ONLY or 'phone' in ONLY: await reduced_run(b, errs); print('reduced motion done', flush=True)
        if not ONLY or 'kbd' in ONLY: await kbd_run(b, errs); print('kbd done', flush=True)
        if not ONLY or 'pad' in ONLY: await pad_run(b, errs); print('pad done', flush=True)
        await b.close()
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
