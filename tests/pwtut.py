# The guided first round: nine steps against a real Easy CPU (it stands still while a hit has to land, then fights back):
#   Move, Jump, Light, Heavy, Charge, Special, Dodge (the CPU attacks; a dodge while it swings, or two dodges), Ultimate (the player's
#   bar is filled, the ULTI button / U pulses, the step ends on the ulti) and Knock them off.
#   python3 pwtut.py [outdir [tag ...]]   (tags: desk desktouch se phone up; default all)
#                               desktop with the keyboard through to the results screen, then touch runs (1280x760, 667x320, 844x390, upright 390x844) up to
#                               the Ultimate step and the ulti itself, holding the Heavy button in the charge step so its ring shows;
#                               the right button pulses in each step (Dodge, ULTI) and the ULTI button stays hidden before its step
import asyncio, sys
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'ux2'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
N = 9
import os
DEBUG = bool(os.environ.get('DEBUG'))
G = "window.__blastline.game"
async def run(b, tag, vp, touch, up, errs, full):
    mob = vp['width'] < 1000
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=touch)
    prof = "{gfx: '2d'%s}" % (", screen: 'up'" if up else "")
    await ctx.add_init_script("if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s)); }" % prof)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    await pg.goto(TEST_URL); await pg.wait_for_timeout(500)
    await (pg.tap('#bHelp') if touch else pg.click('#bHelp')); await pg.wait_for_timeout(200)
    await (pg.tap('#hTry') if touch else pg.click('#hTry'))
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    step = lambda: pg.evaluate("document.getElementById('tutN').textContent + ' | ' + document.getElementById('tutT').textContent")
    async def wait_step(n):
        await pg.wait_for_function(f"document.getElementById('tutN').textContent.includes('{n} of {N}') && !document.getElementById('tut').classList.contains('done')", timeout=60000)
        print(tag, await step())
    async def ready():   # the player is on the ground and free to act (a scripted player has to wait out its own swing)
        try: await pg.wait_for_function(f"['idle', 'run', 'walk'].includes({G}.fighters[0].state)", timeout=5000)
        except Exception: pass
    async def near():
        await ready()
        await pg.evaluate(f"(() => {{ const g = {G}, me = g.fighters[0], op = g.fighters[1]; if (me.state !== 'idle' && me.state !== 'run' && me.state !== 'walk') return; me.x = op.x - 40; me.y = op.y; me.facing = 1; me.vx = 0; }})()")
    async def press(k, ms=60):   # one tap: key on the keyboard, the matching button on a touch screen
        if touch:
            await pg.tap(f'.pb[data-k={k}]')
        else:
            code = {'jump': 'Space', 'light': 'KeyJ', 'heavy': 'KeyK', 'special': 'KeyL', 'dodge': 'ShiftLeft', 'ulti': 'KeyU'}[k]
            await pg.keyboard.press(code)
    async def cpu_is_dummy(): return await pg.evaluate("document.querySelector('#pc1 .pc-tag').textContent")
    tagtxt = await cpu_is_dummy()
    if tagtxt != 'CPU': errs.append(f'{tag}: opponent tag is {tagtxt!r}, want CPU')
    await wait_step(1)
    if touch:
        await pg.evaluate(f"{G}.fighters[0].x += 160")    # moving needs the stick; the step is about the x distance
    else:
        await pg.keyboard.down('KeyD')   # hold until the step is done (the sim can run slower than real time on a busy machine)
        await pg.wait_for_function(f"!document.getElementById('tutN').textContent.includes('1 of {N}')", timeout=60000)
        await pg.keyboard.up('KeyD')
    await wait_step(2)
    await press('jump')
    await pg.wait_for_function(f"{G}.fighters[0].state === 'air'", timeout=30000)   # the second jump has to happen in the air
    await press('jump')
    await wait_step(3)
    for i in range(40):
        if f'3 of {N}' not in await step() or 'Nice' in await step(): break
        await near(); await press('light'); await pg.wait_for_timeout(300)
        if DEBUG: print(tag, 'light try', i, await pg.evaluate(f"(() => {{ const g = {G}, o = g.fighters[1], m = g.fighters[0]; return [m.state, m.mid, Math.round(m.x - o.x), o.state, o.percent, g.t, g.phase, g.hitstop, window.__blastline.mode]; }})()"))
    await wait_step(4)
    for i in range(10):
        if f'4 of {N}' not in await step() or 'Nice' in await step(): break
        await near(); await press('heavy'); await pg.wait_for_timeout(600)
    await wait_step(5)
    # the Skip chip (it exits the tutorial) and the prompt must not sit on any visible touch button, the Special's boosted size included
    async def clear_of_buttons(label):
        if not touch: return
        for what, el in [('the Skip chip', 'tutSkip'), ('the tutorial prompt', 'tut')]:
            hit = await pg.evaluate("""(id) => { const c = document.getElementById(id).getBoundingClientRect(), bad = [];
              for (const b of document.querySelectorAll('.pb')) { if (!b.offsetParent) continue; const r = b.getBoundingClientRect(), k = b.dataset.k === 'special' ? 1.15 : 1,
                cx = r.left + r.width / 2, cy = r.top + r.height / 2, rr = r.width / 2 * k,
                nx = Math.max(c.left, Math.min(cx, c.right)), ny = Math.max(c.top, Math.min(cy, c.bottom));
                if (Math.hypot(nx - cx, ny - cy) < rr) bad.push(b.dataset.k); }
              return bad; }""", el)
            if hit: errs.append(f'{tag}: {what} overlaps the {hit} button(s) ({label})')
    await clear_of_buttons('step 5')
    ulti_shown = lambda: pg.evaluate("!!document.querySelector('.pb[data-k=ulti]').offsetParent")
    pulsing = lambda: pg.evaluate("[...document.querySelectorAll('.pb.tutpulse')].map((b) => b.dataset.k)")
    # the charge step: a tap does not count, a held heavy that connects does
    heavy = '.pb[data-k=heavy]'
    shot_done = False
    for i in range(12):
        if f'5 of {N}' not in await step() or 'Nice' in await step(): break
        await near()
        if touch:
            await pg.dispatch_event(heavy, 'pointerdown', {'pointerId': 7, 'isPrimary': True, 'pointerType': 'touch'})
        else:
            await pg.keyboard.down('KeyK')
        try: await pg.wait_for_function(f"{G}.fighters[0].state === 'attack'", timeout=5000)   # the heavy has started
        except Exception: pass
        try: await pg.wait_for_function(f"{G}.fighters[0].chg >= 12 || {G}.fighters[0].state !== 'attack'", timeout=20000)   # hold in sim time, not wall time
        except Exception: pass
        # while the heavy is charging (chg > 0 on the held wind-up) the ring must show on the Heavy button; if the CPU
        # knocked the player out of it first there is nothing to check, the loop tries again
        ch = await pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; return {{ on: f.state === 'attack' && !!f.mid && f.mid[0] === 'h' && f.chg > 0, ring: document.querySelector('{heavy}').classList.contains('chg') }}; }})()")
        if ch['on'] and not shot_done:
            await pg.screenshot(path=f'{OUT}/tut_{tag}_charge.png'); shot_done = True
            if touch and not ch['ring']:   # the ring follows the sim by up to a frame
                try: await pg.wait_for_function(f"document.querySelector('{heavy}').classList.contains('chg')", timeout=1500)
                except Exception: errs.append(f'{tag}: no charge ring on the Heavy button while it is held')
        if DEBUG: print(tag, 'charge try', i, await pg.evaluate(f"(() => {{ const g = {G}, o = g.fighters[1], m = g.fighters[0]; return [m.state, m.mid, m.chg, Math.round(m.x - o.x), o.state, o.percent, g.t]; }})()"))
        if touch:
            await pg.dispatch_event(heavy, 'pointerup', {'pointerId': 7, 'isPrimary': True, 'pointerType': 'touch'})
        else:
            await pg.keyboard.up('KeyK')
        try: await pg.wait_for_function(f"!document.getElementById('tutN').textContent.includes('5 of {N}') || document.getElementById('tut').classList.contains('done') || {G}.fighters[0].state === 'idle'", timeout=15000)
        except Exception: pass
        await pg.wait_for_timeout(300)
    if not shot_done: errs.append(f'{tag}: never saw the heavy charging')
    await wait_step(6)
    if await ulti_shown(): errs.append(f'{tag}: the ULTI button is out before its step')
    await ready(); await press('special')
    # Dodge: the CPU attacks. A dodge while it swings close by finishes the step; failing that, two dodges do
    await wait_step(7)
    if await pulsing() != ['dodge'] and touch: errs.append(f'{tag}: step 7 pulses {await pulsing()}, want [dodge]')
    if await ulti_shown(): errs.append(f'{tag}: the ULTI button is out in the Dodge step')
    if await pg.evaluate(f"{G}.fighters[0].ult") > 71: errs.append(f'{tag}: the bar is {await pg.evaluate(G + ".fighters[0].ult")} before the Ultimate step (should stay under full)')
    await pg.screenshot(path=f'{OUT}/tut_{tag}_dodge.png')
    if not touch:
        # the real thing, one dodge only: a scripted player (window.__blInput) dodges once, the tick the CPU is swinging at it; that alone must finish the step
        await pg.evaluate("""(() => { window.__dodged = 0; window.__blInput = (g) => { const me = g.fighters[0], op = g.fighters[1];
            const atk = op.state === 'attack' && Math.abs(me.x - op.x) < 200 && Math.abs(me.y - op.y) < 100;
            const go = atk && !window.__dodged && ['idle', 'run', 'walk'].includes(me.state); if (go) window.__dodged = 1;
            return { x: 0, y: 0, dodge: go }; }; })()""")
        for i in range(60):
            t = await step()
            if f'7 of {N}' not in t or 'Nice' in t: break
            await near(); await pg.wait_for_timeout(400)
        await pg.evaluate("delete window.__blInput")
        if not await pg.evaluate("window.__dodged") or 'Nice' not in await step() and f'7 of {N}' in await step(): errs.append(f'{tag}: one dodge while the CPU swings did not finish the Dodge step ({await step()}, dodged {await pg.evaluate("window.__dodged")})')
        else: print(tag, 'dodge step done by one dodge during a CPU attack')
    else:
        # touch: real taps; a dodge while the CPU swings, or the second dodge, finishes it
        presses = 0
        for i in range(12):
            t = await step()
            if f'7 of {N}' not in t or 'Nice' in t: break
            await near()
            try: await pg.wait_for_function(f"{G}.fighters[1].state === 'attack'", timeout=2500)   # the CPU swings
            except Exception: pass
            await press('dodge'); presses += 1
            await pg.wait_for_timeout(500)
        print(tag, 'dodge step done with', presses, 'tap(s) on Dodge')
    # Ultimate: the bar is full, the ULTI button pops out and pulses, the step ends on the ulti itself
    await wait_step(8)
    st8 = await pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; return {{ ult: f.ult, need: BL.ultNeed(f), n: f.ultN, ready: BL.ultReady({G}, f) }}; }})()")
    if st8['ult'] < st8['need'] or st8['need'] == 0 or not st8['ready']: errs.append(f'{tag}: the Ultimate step should hand over a full bar, got {st8}')
    if touch:
        try: await pg.wait_for_function("!!document.querySelector('.pb[data-k=ulti]').offsetParent", timeout=5000)
        except Exception: errs.append(f'{tag}: the ULTI button never showed in the Ultimate step')
        if await pulsing() != ['ulti']: errs.append(f'{tag}: step 8 pulses {await pulsing()}, want [ulti]')
        await pg.evaluate("Promise.all(document.querySelector('.pb[data-k=ulti]').getAnimations().filter((a) => a.animationName === 'ultiPop').map((a) => a.finished))")
        await clear_of_buttons('step 8, ULTI shown')
    prompt = await pg.evaluate("document.getElementById('tutT').textContent + ' | ' + document.getElementById('tutH').textContent")
    print(tag, 'ulti step:', prompt)
    await pg.screenshot(path=f'{OUT}/tut_{tag}_ulti.png')
    await ready(); await press('ulti')
    await pg.wait_for_function(f"{G}.fighters[0].ultN === 1", timeout=20000)
    await wait_step(9)
    if touch and await ulti_shown(): errs.append(f'{tag}: the ULTI button is still out after the ulti')
    if not full:
        await ctx.close(); return
    print('cpu percent', await pg.evaluate(f"{G}.fighters[1].percent"), 'stocks', await pg.evaluate(f"{G}.fighters[1].stocks"), '| player stocks', await pg.evaluate(f"{G}.fighters[0].stocks"))
    await pg.screenshot(path=f'{OUT}/tut_{tag}_step9.png')
    for i in range(60):
        if await pg.evaluate("window.__blastline.mode") != 'match': break
        await near(); await press('heavy'); await pg.wait_for_timeout(700)
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{OUT}/tut_{tag}_done.png')
    print('title:', await pg.evaluate("document.getElementById('rTitle').textContent"), '| tut flag:', await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.profile.v1')).tut"))
    await (pg.tap('#rAgain') if touch else pg.click('#rAgain')); await pg.wait_for_timeout(400); print('after Ranked button:', await pg.evaluate("window.__blastline.mode"), await pg.evaluate("document.getElementById('selMode').textContent"))
    await pg.reload(); await pg.wait_for_timeout(1500); print('after reload mode:', await pg.evaluate("window.__blastline.mode"))
    await ctx.close()
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for tag, vp, touch, up, full in [('desk', {'width': 1280, 'height': 760}, False, False, True),
                                         ('desktouch', {'width': 1280, 'height': 760}, True, False, False),   # a big screen with touch controls (tablet, touch laptop)
                                         ('se', {'width': 667, 'height': 320}, True, False, False),
                                         ('phone', {'width': 844, 'height': 390}, True, False, False),
                                         ('up', {'width': 390, 'height': 844}, True, True, False)]:
            if not ONLY or tag in ONLY: await run(b, tag, vp, touch, up, errs, full)
        await b.close()
    print(errs or 'no errors')
asyncio.run(main())
