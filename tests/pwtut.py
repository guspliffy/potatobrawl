# The first minute (Fable's first-minute pass): the turn-sideways screen, the welcome sheet, the 4-step tutorial against a real Easy CPU, YOU'RE READY and the first fight.
#   1 MOVE & JUMP   (move 110 px, then a jump in the air)         2 LAND 3 HITS   (the card counts 0/3 ... 3/3; the CPU stands still)
#   3 DODGE, THEN RECOVER   (a dodge while the dummy swings, or two; then its scripted heavy launches the player off the right ledge: the player is really
#     off the stage, JUMP twice and it is really back on it; a fall repeats it once, a second fall counts as done)      4 KNOCK THEM OUT   (CPU at 120%, one life)
#   then the KO, YOU'RE READY with FIGHT (starts the first fight: Easy CPU, 3 lives, 4:00, hints) and Menu.
#   python3 pwtut.py [outdir [tag ...]]   (tags: desk desktouch se mid phone up welcome turn skip peek; default all)
#     desk          1280x760, keyboard, a fresh profile: the welcome, all four steps to the KO, YOU'RE READY, FIGHT, the first hint
#     desktouch     1280x760 with touch controls (a tablet): the same, with real taps (the jump taps in step 3 are real)
#     se mid phone  667x320, 740x360, 844x390 touch: the same ('phone' does not get back after the launch: the repeat, the second fall, "On we go!")
#     up            390x844 touch: the turn screen's "Play upright instead", then the same in the upright layout above the control panel
#     welcome       a fresh profile at 844x390 and 1280x760: both buttons (the tutorial starts at 1/4, Skip starts a first fight with its first hint), the profile is marked
#     turn          390x844 touch, a fresh profile: the turn screen first and upright, READY, the welcome after it; the browser turning by itself; a computer never sees it
#     peek          the card fades to a ghost while the YOU marker is under it (667x320, the top platform) and comes back
#     skip          the card's Skip: a new player goes to the first fight, one who has played goes to the menu
#   Everywhere: the card is clear of the YOU marker, both name cards, the pause icon and the touch buttons, and nothing in it is cut off. Shots go to outdir.
import asyncio, sys, os
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'ux2'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
DEBUG = bool(os.environ.get('DEBUG'))
G = "window.__blastline.game"
CODES = {'jump': 'Space', 'light': 'KeyJ', 'heavy': 'KeyK', 'special': 'KeyL', 'dodge': 'ShiftLeft', 'ulti': 'KeyU'}
PROF = 'potatobrawl.profile.v1'

async def new_page(b, vp, touch, errs, tag, profile=None):
    mob = vp['width'] < 1000
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=touch)
    if profile is not None:
        import json
        await ctx.add_init_script("if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('%s', JSON.stringify(%s)); }" % (PROF, json.dumps(profile)))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    await pg.goto(TEST_URL); await pg.wait_for_timeout(700)
    return ctx, pg

# rects overlap? (client pixels); the page side of the checks every test below shares
CHECK_JS = """(args) => {
  const [id, touch] = args, R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const el = document.getElementById(id), t = R(el), bad = [];
  for (const k of ['pc0', 'pc1', 'pauseBtn']) if (hit(t, R(document.getElementById(k)))) bad.push(k);
  const h = window.__blastline.head, g = window.__blastline.game;
  const peek = el.classList.contains('peek');   // the card fades to a ghost while the marker is under it (ui/tutorial.js tutPeek)
  if (h && g && g.fighters[0].grounded && !peek) { const m = [h[0] - 26, h[1] - 44, h[0] + 26, h[1] - 10]; if (hit(t, m)) bad.push('YOU marker'); }
  for (const b of document.querySelectorAll('.pb')) {
    if (!b.offsetParent) continue;
    const r = b.getBoundingClientRect(), k = b.dataset.k === 'special' ? 1.15 : 1, cx = r.left + r.width / 2, cy = r.top + r.height / 2, rr = r.width / 2 * k;
    const nx = Math.max(t[0], Math.min(cx, t[2])), ny = Math.max(t[1], Math.min(cy, t[3]));
    if (Math.hypot(nx - cx, ny - cy) < rr) bad.push('button ' + b.dataset.k);
  }
  const clip = [...el.querySelectorAll('.tut-t, .tut-h, .tut-l1, #fhint span')].filter((e) => e.scrollWidth > e.clientWidth + 1 && e.offsetParent).map((e) => e.className || e.tagName);
  return { bad, h: t[3] - t[1], w: t[2] - t[0], top: t[1], clip };
}"""

async def run(b, tag, vp, touch, up, errs, mode):
    # mode: 'ok' (the player recovers after the launch), 'fall' (it never does), 'taps' (ok, with real taps on Jump)
    key = not touch
    ctx, pg = await new_page(b, vp, touch, errs, tag)   # no profile: a brand-new player
    shot = lambda name: pg.screenshot(path=f'{OUT}/{tag}_{name}.png')
    if up:   # a phone held upright: the turn screen first; Play upright instead keeps the upright layout (above the control panel)
        await pg.wait_for_function("!document.getElementById('turn').hidden", timeout=5000)
        await pg.evaluate("document.getAnimations().forEach((a) => { if (a.animationName === 'tnTurn') { a.pause(); a.currentTime = 1900; } })"); await pg.wait_for_timeout(100)   # the shot shows the phone turned (the loop is 3 s)
        await shot('turn')
        await pg.tap('#turnUp'); await pg.wait_for_function("document.getElementById('turn').hidden", timeout=3000)
    await pg.wait_for_function("!document.getElementById('scrWelcome').hidden", timeout=10000)
    await pg.wait_for_timeout(2500)   # the attract fight behind it gets going
    await shot('welcome')
    if await pg.evaluate("window.__blastline.mode") != 'menu' or not await pg.evaluate("document.getElementById('scrMenu').hidden"): errs.append(f'{tag}: the menu shows under the welcome sheet')
    await (pg.tap('#welGo') if touch else pg.click('#welGo'))
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    step = lambda: pg.evaluate("['tutN', 'tutT', 'tutH'].map((id) => document.getElementById(id).textContent).join(' | ')")
    tutst = lambda: pg.evaluate("window.__blastline.tut")
    async def wait_step(n):
        await pg.wait_for_function(f"document.getElementById('tutN').textContent.includes('{n}/4') && !document.getElementById('tut').classList.contains('done')", timeout=90000)
        print(tag, await step())
    async def card(label, name=None):   # the card is clear of everything it must not cover, and not cut off
        r = await pg.evaluate(CHECK_JS, ['tut', touch])
        if 'YOU marker' in r['bad']: await pg.wait_for_timeout(300); r = await pg.evaluate(CHECK_JS, ['tut', touch])   # the ghosting follows within 4 ticks
        if r['bad']: errs.append(f'{tag}: the card overlaps {r["bad"]} ({label})')
        if r['clip']: errs.append(f'{tag}: the card is cut off: {r["clip"]} ({label})')
        if not up and not 40 <= r['h'] <= 58: errs.append(f'{tag}: the card is {r["h"]:.0f} px tall ({label}), want about 52')
        if not up and r['top'] > 12: errs.append(f'{tag}: the card is at y={r["top"]:.0f} ({label}), want 8')
        if name: await shot(name)
    async def ready():   # the player is on the ground and free to act
        try: await pg.wait_for_function(f"['idle', 'run', 'walk'].includes({G}.fighters[0].state)", timeout=5000)
        except Exception: pass
    async def near():
        await ready()
        await pg.evaluate(f"(() => {{ const g = {G}, me = g.fighters[0], op = g.fighters[1]; if (me.state !== 'idle' && me.state !== 'run' && me.state !== 'walk') return; me.x = op.x - 40; me.y = op.y; me.facing = 1; me.vx = 0; }})()")
    async def press(k):   # one tap: key on the keyboard, the matching button on a touch screen
        if touch: await pg.tap(f'.pb[data-k={k}]', timeout=4000)
        else: await pg.keyboard.press(CODES[k])
    # ---- 1 MOVE & JUMP
    await wait_step(1)
    tagtxt = await pg.evaluate("document.querySelector('#pc1 .pc-tag').textContent")
    if tagtxt != 'Dummy': errs.append(f'{tag}: the CPU card reads {tagtxt!r} in step 1, want Dummy')
    t1 = await step()
    if ('Drag left to move' if touch else 'A or D to move') not in t1: errs.append(f'{tag}: step 1 says {t1!r}')
    await card('step 1', 's1')
    if touch:   # a real drag on the stick
        sz = await pg.evaluate("(() => { const r = document.getElementById('stickZone').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.6]; })()")
        ev = {'pointerId': 9, 'isPrimary': True, 'pointerType': 'touch'}
        await pg.dispatch_event('#stickZone', 'pointerdown', dict(ev, clientX=sz[0], clientY=sz[1]))
        await pg.dispatch_event('#stickZone', 'pointermove', dict(ev, clientX=sz[0] + 40, clientY=sz[1]))
    else:
        await pg.keyboard.down('KeyD')   # hold until the move part is done (the sim can run slower than real time on a busy machine)
    await pg.wait_for_function("window.__blastline.tut.moved", timeout=60000)
    if touch: await pg.dispatch_event('#stickZone', 'pointerup', dict(ev, clientX=sz[0] + 40, clientY=sz[1]))
    else: await pg.keyboard.up('KeyD')
    t1 = await step()
    if ('Tap JUMP twice' if touch else 'SPACE, twice') not in t1: errs.append(f'{tag}: after the move part step 1 says {t1!r}, want the jump line')
    if touch and await pg.evaluate("[...document.querySelectorAll('.pb.tutpulse')].map((b) => b.dataset.k).join()") != 'jump': errs.append(f'{tag}: the Jump button does not pulse in the jump part of step 1')
    await ready(); await press('jump')
    await pg.wait_for_function(f"{G}.fighters[0].state === 'air'", timeout=30000)   # the second jump has to happen in the air
    await press('jump')
    # ---- 2 LAND 3 HITS
    await wait_step(2)
    seen = set()
    t2 = await step()
    if '· 0/3' not in t2 or ('LIGHT is fast, HEAVY hurts' if touch else 'J light, K heavy') not in t2: errs.append(f'{tag}: step 2 says {t2!r}')
    await card('step 2', 's2')
    for i in range(40):
        t = await step()
        for n in (1, 2):
            if f'· {n}/3' in t: seen.add(n)
        if '2/4' not in t or 'Nice' in t: break
        await near(); await press('light' if i % 3 else 'heavy' if i == 1 else 'light'); await pg.wait_for_timeout(300)
    if not seen: errs.append(f'{tag}: the 0/3 counter never ticked')
    # ---- 3 DODGE, THEN RECOVER
    await wait_step(3)
    pulsing = lambda: pg.evaluate("[...document.querySelectorAll('.pb.tutpulse')].map((b) => b.dataset.k)")
    if touch and await pulsing() != ['dodge']: errs.append(f'{tag}: step 3 pulses {await pulsing()}, want [dodge]')
    t3 = await step()
    if ('Tap DODGE as they swing' if touch else 'SHIFT as they swing') not in t3: errs.append(f'{tag}: step 3 says {t3!r}')
    await card('step 3 (dodge)', 's3')
    if not touch:
        # one dodge only, the tick the dummy is swinging at the player: that alone finishes the part
        await pg.evaluate("""(() => { window.__dodged = 0; window.__blInput = (g) => { const me = g.fighters[0], op = g.fighters[1];
            const atk = op.state === 'attack' && Math.abs(me.x - op.x) < 200 && Math.abs(me.y - op.y) < 100;
            const go = atk && !window.__dodged && ['idle', 'run', 'walk'].includes(me.state); if (go) window.__dodged = 1;
            return { x: 0, y: 0, dodge: go }; }; })()""")
        for i in range(60):
            if await tutst() and (await tutst())['ph'] != 'dodge': break
            await near(); await pg.wait_for_timeout(400)
        await pg.evaluate("delete window.__blInput")
        if not await pg.evaluate("window.__dodged"): errs.append(f'{tag}: the dummy never swung at the player in the dodge part')
    else:
        for i in range(12):
            if (await tutst())['ph'] != 'dodge': break
            await near()
            try: await pg.wait_for_function(f"{G}.fighters[1].state === 'attack'", timeout=2500)   # the dummy swings
            except Exception: pass
            await press('dodge'); await pg.wait_for_timeout(500)
    # the launch: the player is set up at the right ledge facing the dummy, the dummy swings, the player ends up off the stage
    await pg.evaluate("""(() => { window.__offN = 0; window.__offMax = 0; const S = BL.STAGE.main; (function f() { const g = window.__blastline.game; if (g) { const me = g.fighters[0];
        if (!me.grounded && me.x > S.x2 + 6) { window.__offN++; window.__offMax = Math.max(window.__offMax, me.x - S.x2); } } requestAnimationFrame(f); })(); })()""")
    await pg.wait_for_function("window.__blastline.tut.ph === 'recover'", timeout=90000)
    t3 = await step(); await card('step 3 (off the stage)', 's3_off')
    want = 'Off you go! ' + ('JUMP' if touch else 'SPACE') + ' twice, back to the stage'
    if want not in t3: errs.append(f'{tag}: off the stage the card says {t3!r}, want {want!r}')
    if touch and await pulsing() != ['jump']: errs.append(f'{tag}: the recovery pulses {await pulsing()}, want [jump]')
    off = await pg.evaluate("(() => { const me = window.__blastline.game.fighters[0], S = BL.STAGE.main; return { off: !me.grounded && me.x > S.x2 + 6, y: me.y }; })()")
    if not off['off']: errs.append(f'{tag}: the recovery started but the player is not off the stage: {off}')
    if mode == 'fall':
        # never press anything: the player falls, the launch is repeated once with the other line, the second fall counts as done
        await pg.wait_for_function("window.__blastline.tut.falls === 1 && window.__blastline.tut.ph === 'recover'", timeout=90000)
        t3 = await step()
        if ('Jump' if touch else 'SPACE') + ' twice, then push toward the stage' not in t3: errs.append(f'{tag}: after the fall the card says {t3!r}')
        await shot('s3_repeat')
        await pg.wait_for_function("document.getElementById('tutT').textContent === 'On we go!' || document.getElementById('tutN').textContent.includes('4/4')", timeout=90000)
        print(tag, 'two falls: step 3 counted as done:', await step())
        if 'real fight' not in await step(): errs.append(f'{tag}: the On we go! card keeps the old line: {await step()!r}')
    elif mode == 'taps':
        await pg.keyboard.down('KeyA')   # push toward the stage; the jumps are real taps
        await press('jump'); await pg.wait_for_timeout(250); await press('jump')
        await pg.wait_for_function("document.getElementById('tutT').textContent === 'Nice!' || document.getElementById('tutN').textContent.includes('4/4')", timeout=30000)
        await pg.keyboard.up('KeyA')
    else:
        # a scripted player: nothing until it is free again, then jump every 14 ticks and push toward the stage
        await pg.evaluate("""(() => { window.__blInput = (g) => { const me = g.fighters[0]; if (me.state === 'hitstun') return { x: 0, y: 0 };
            return { x: me.x > 0 ? -1 : 1, y: 0, jump: g.t % 14 === 0 }; }; })()""")
        await pg.wait_for_function("document.getElementById('tutT').textContent === 'Nice!' || document.getElementById('tutN').textContent.includes('4/4')", timeout=60000)
        await pg.evaluate("delete window.__blInput")
    r = await pg.evaluate("({ n: window.__offN, max: window.__offMax, falls: window.__blastline.tut.falls })")
    if mode != 'fall':
        if r['n'] < 3 or r['max'] < 10: errs.append(f'{tag}: the launch did not put the player off the stage ({r})')
        if r['falls']: errs.append(f'{tag}: the player fell {r["falls"]} time(s) in step 3 although it recovered at once')
        back = await pg.evaluate("(() => { const me = window.__blastline.game.fighters[0], S = BL.STAGE.main; return me.grounded && me.x >= S.x1 && me.x <= S.x2; })()")
        if not back and 'Nice' in await step(): errs.append(f'{tag}: step 3 is done but the player is not back on the stage')
        print(tag, 'launch: off the stage for', r['n'], 'frames, up to', round(r['max']), 'px past the ledge, back on it')
    # ---- 4 KNOCK THEM OUT
    await wait_step(4)
    t4 = await step()
    if ("HEAVY sends them flying" if touch else "K sends them flying") not in t4 or "They're at 120%" not in t4: errs.append(f'{tag}: step 4 says {t4!r}')
    tagtxt = await pg.evaluate("document.querySelector('#pc1 .pc-tag').textContent")
    if tagtxt != 'CPU': errs.append(f'{tag}: the CPU card reads {tagtxt!r} in step 4, want CPU')
    if touch and await pulsing() != ['heavy']: errs.append(f'{tag}: step 4 pulses {await pulsing()}, want [heavy]')
    op = await pg.evaluate(f"({{ pct: {G}.fighters[1].percent, stocks: {G}.fighters[1].stocks }})")
    if op['pct'] < 120 or op['stocks'] != 1: errs.append(f'{tag}: the CPU should be at 120%+ with one life in step 4: {op}')
    await card('step 4', 's4')
    for i in range(60):
        if await pg.evaluate("window.__blastline.mode") != 'match': break
        await near()
        try: await press('heavy')
        except Exception: break   # the KO landed between the check and the tap: the controls are gone
        await pg.wait_for_timeout(700)
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000); await pg.wait_for_timeout(1200)
    await shot('ready')
    title = await pg.evaluate("document.getElementById('rTitle').textContent")
    again = await pg.evaluate("document.querySelector('#rAgain span').textContent")
    vis = await pg.evaluate("(() => { const v = (id) => !!document.getElementById(id).offsetParent; return { change: v('rChange'), menu: v('rMenu'), rank: v('rRank'), stats: v('rStats') }; })()")
    if title != "You're ready" or again != 'Fight' or vis['change'] or not vis['menu'] or vis['rank'] or vis['stats']: errs.append(f'{tag}: the end screen is {title!r} / {again!r} / {vis}')
    print(tag, 'end screen:', title, '|', again, '|', vis, '| tut flag:', await pg.evaluate("JSON.parse(localStorage.getItem('%s')).tut" % PROF))
    # FIGHT: the first fight, with its hints
    await (pg.tap('#rAgain') if touch else pg.click('#rAgain'))
    await pg.wait_for_function(f"window.__blastline.mode === 'match' && {G}.phase === 'play' && window.__blastline.fh.on", timeout=60000)
    d = await pg.evaluate(f"({{ stocks: {G}.fighters.map((f) => f.stocks), timed: {G}.timed, timer: {G}.timer, tut: window.__blastline.tut.on, hud: !document.getElementById('hud').hidden, tutCard: !document.getElementById('tut').hidden }})")
    if d['stocks'] != [3, 3] or not d['timed'] or d['timer'] < 239 * 60 or d['tut'] or d['tutCard']: errs.append(f'{tag}: the first fight is not 3 lives / 4:00 / no tutorial card: {d}')
    await pg.wait_for_function("document.getElementById('fhint').classList.contains('on')", timeout=10000)
    await pg.wait_for_timeout(400)
    h = await pg.evaluate("document.querySelector('#fhint span').textContent")
    want = 'Drag left to move · tap JUMP twice' if touch else 'A D move · SPACE jump, twice'
    if h != want: errs.append(f'{tag}: the first hint is {h!r}, want {want!r}')
    r = await pg.evaluate(CHECK_JS, ['fhint', touch])
    if r['bad']: errs.append(f'{tag}: the hint strip overlaps {r["bad"]}')
    if r['clip']: errs.append(f'{tag}: the hint strip is cut off: {r["clip"]}')
    if touch:
        dr = await pg.evaluate("document.getElementById('stickKnob').classList.contains('drag')")
        if not dr: errs.append(f'{tag}: no DRAG in the stick at the start of the first fight')
    await shot('fight')
    print(tag, 'first fight hint:', h)
    await ctx.close()

async def welcome(b, errs):
    for tag, vp, touch in [('w844', {'width': 844, 'height': 390}, True), ('w1280', {'width': 1280, 'height': 760}, False)]:
        # the tutorial button: starts at 1/4; the profile is marked; a reload does not show the welcome again
        ctx, pg = await new_page(b, vp, touch, errs, tag)
        await pg.wait_for_function("!document.getElementById('scrWelcome').hidden", timeout=10000)
        txt = await pg.evaluate("document.getElementById('scrWelcome').innerText.replace(/\\s+/g, ' ')")
        for want in ('HOW TO WIN', 'Hits raise their %. The higher it is, the farther they fly — knock them off the screen.', 'PLAY THE TUTORIAL · 1 MIN', 'SKIP, JUST FIGHT'):
            if want.lower() not in txt.lower(): errs.append(f'{tag}: the welcome sheet lacks {want!r}: {txt!r}')
        if await pg.evaluate("!!document.querySelector('#scrWelcome .x, #scrWelcome .round, #scrWelcome [aria-label=Close]')"): errs.append(f'{tag}: the welcome sheet has a close button')
        if await pg.evaluate("!!document.getElementById('turn').offsetParent"): errs.append(f'{tag}: the turn screen shows on a landscape or desktop screen')
        dim = await pg.evaluate("getComputedStyle(document.getElementById('scrWelcome')).backgroundColor")
        if '0.5' not in dim: errs.append(f'{tag}: the dim is {dim}, want 50%')
        w = await pg.evaluate("document.querySelector('#scrWelcome .sheet').getBoundingClientRect().width")
        if abs(w - 360) > 1: errs.append(f'{tag}: the sheet is {w}px wide, want 360')
        await (pg.tap('#welGo') if touch else pg.click('#welGo'))
        await pg.wait_for_function(f"{G} && {G}.phase !== undefined && window.__blastline.mode === 'match' && window.__blastline.tut.on", timeout=30000)
        n = await pg.evaluate("document.getElementById('tutN').textContent")
        if '1/4' not in n: errs.append(f'{tag}: the tutorial starts at {n!r}, want 1/4')
        if not await pg.evaluate("JSON.parse(localStorage.getItem('%s')).tut === true" % PROF): errs.append(f'{tag}: the profile is not marked after the tutorial pick')
        await pg.reload(); await pg.wait_for_timeout(1200)
        if await pg.evaluate("window.__blastline.mode") != 'menu' or not await pg.evaluate("document.getElementById('scrWelcome').hidden"): errs.append(f'{tag}: the welcome sheet came back after a reload')
        await ctx.close()
        # Skip, just fight: a first fight (Practice, Easy, 3 lives) and its first hint
        ctx, pg = await new_page(b, vp, touch, errs, tag)
        await pg.wait_for_function("!document.getElementById('scrWelcome').hidden", timeout=10000)
        await pg.wait_for_timeout(1500)
        await (pg.tap('#welSkip') if touch else pg.click('#welSkip'))
        await pg.wait_for_function(f"window.__blastline.mode === 'match' && {G}.phase === 'play' && window.__blastline.fh.on", timeout=60000)
        d = await pg.evaluate(f"({{ stocks: {G}.fighters.map((f) => f.stocks), tut: window.__blastline.tut.on, card: !document.getElementById('tut').hidden, cpu: document.querySelector('#pc1 .pc-tag').textContent }})")
        if d['stocks'] != [3, 3] or d['tut'] or d['card'] or d['cpu'] != 'CPU': errs.append(f'{tag}: Skip did not start a plain first fight: {d}')
        await pg.wait_for_function("document.getElementById('fhint').classList.contains('on')", timeout=10000)
        h = await pg.evaluate("document.querySelector('#fhint span').textContent")
        want = 'Drag left to move · tap JUMP twice' if touch else 'A D move · SPACE jump, twice'
        if h != want: errs.append(f'{tag}: the first hint after Skip is {h!r}, want {want!r}')
        if not await pg.evaluate("JSON.parse(localStorage.getItem('%s')).tut === true" % PROF): errs.append(f'{tag}: the profile is not marked after Skip')
        # the hints go one at a time, each once: the clock's second line comes at 7 s; then nothing of the first two again
        await pg.wait_for_function(f"{G}.timer < {G}.timer + 1 && window.__blastline.fh.t > 440", timeout=60000)
        await pg.wait_for_timeout(500)
        h2 = await pg.evaluate("document.querySelector('#fhint span').textContent")
        want2 = ['LIGHT and HEAVY hit · DODGE through attacks', 'Off the edge? JUMP twice to get back'] if touch else ['J light · K heavy · SHIFT dodge', 'Off the edge? SPACE twice to get back']
        # the 7 s line, or the off-stage line when the idle player got knocked off first (it jumps the queue): never the first line again
        if h2 not in want2: errs.append(f'{tag}: the second hint is {h2!r}, want one of {want2}')
        # a game that is not the first fight shows none: quit to the menu, start a Practice match
        await pg.click('#pauseBtn') if not touch else await pg.tap('#pauseBtn'); await pg.wait_for_timeout(300)
        await (pg.tap('#pQuit') if touch else pg.click('#pQuit')); await pg.wait_for_timeout(500)
        await ctx.close()
        print(tag, 'welcome: both buttons work, first hint', repr(h))

async def turn(b, errs):
    vp = {'width': 390, 'height': 844}
    ctx, pg = await new_page(b, vp, True, errs, 'turn')
    shot = lambda name: pg.screenshot(path=f'{OUT}/turn_{name}.png')
    await pg.wait_for_function("!document.getElementById('turn').hidden", timeout=5000)
    r = await pg.evaluate("""(() => { const t = document.getElementById('turn'), a = document.getElementById('app'), b = t.getBoundingClientRect(), go = document.querySelector('#turnGo span');
      return { inApp: a.contains(t), sibling: t.parentNode === document.body || t.parentNode === a.parentNode, rect: [b.left, b.top, b.right, b.bottom], appTf: a.style.transform, goTf: getComputedStyle(go).transform,
        welcome: !document.getElementById('scrWelcome').hidden, text: t.innerText.replace(/\\s+/g, ' '), top: document.elementFromPoint(195, 400) && t.contains(document.elementFromPoint(195, 400)), rot: a.classList.contains('rot') }; })()""")
    if r['inApp'] or not r['sibling']: errs.append(f'turn: the turn screen is inside #app: {r}')
    if r['rect'] != [0, 0, 390, 844]: errs.append(f'turn: the turn screen is {r["rect"]}, want the whole screen upright')
    if not r['rot'] or 'rotate(90deg)' not in r['appTf']: errs.append(f'turn: the game is not rotated ({r["appTf"]}), the test has nothing to check')
    if r['goTf'] != 'matrix(0, 1, -1, 0, 0, 0)': errs.append(f'turn: READY is drawn with {r["goTf"]}, want the game\'s rotate(90deg)')
    if r['welcome']: errs.append('turn: the welcome sheet is already open under the turn screen')
    for want in ('TURN IT SIDEWAYS', "It's a wide game. Rotation lock on? Turn anyway, then tap.", 'READY', 'Play upright instead'):
        if want.lower() not in r['text'].lower(): errs.append(f'turn: the turn screen lacks {want!r}: {r["text"]!r}')
    if not r['top']: errs.append('turn: the point under the middle of the screen is not the turn screen')
    go = await pg.evaluate("(() => { const r = document.getElementById('turnGo').getBoundingClientRect(); return [r.width, r.height, 844 - r.bottom]; })()")
    if abs(go[0] - 104) > 1 or abs(go[1] - 104) > 1 or abs(go[2] - 160) > 2: errs.append(f'turn: the READY disc is {go[0]}x{go[1]} and {go[2]} px from the bottom, want 104x104 and 160')
    anim = await pg.evaluate("getComputedStyle(document.querySelector('.tn-phone')).animationName + ' ' + getComputedStyle(document.querySelector('.tn-phone')).animationDuration")
    if 'tnTurn' not in anim or '3s' not in anim: errs.append(f'turn: the phone animation is {anim!r}, want a 3 s loop')
    await pg.evaluate("document.getAnimations().forEach((a) => { if (a.animationName === 'tnTurn') { a.pause(); a.currentTime = 1900; } })"); await pg.wait_for_timeout(100); await shot('screen')   # held turned
    await pg.evaluate("document.getAnimations().forEach((a) => a.play())")
    await pg.tap('.tn-art'); await pg.wait_for_timeout(300)
    if await pg.evaluate("document.getElementById('turn').hidden"): errs.append('turn: a tap beside the READY disc closed the screen')
    await pg.tap('#turnGo'); await pg.wait_for_timeout(450)
    if not await pg.evaluate("document.getElementById('turn').hidden"): errs.append('turn: READY did not close the turn screen')
    if await pg.evaluate("document.getElementById('scrWelcome').hidden"): errs.append('turn: the welcome sheet did not follow READY')
    if await pg.evaluate("window.__blastline.mode") != 'menu': errs.append('turn: a tap on READY reached the game underneath')
    await pg.wait_for_timeout(2000); await shot('welcome')   # the welcome in the game's turn
    # a reload shows it again (the profile is not saved yet: still a brand-new player)
    await pg.reload(); await pg.wait_for_timeout(800)
    if await pg.evaluate("document.getElementById('turn').hidden"): errs.append('turn: no turn screen after a reload')
    # Play upright instead: Settings > Screen is Upright, the game is upright, the welcome follows, and a reload shows no turn screen
    await pg.tap('#turnUp'); await pg.wait_for_timeout(450)
    prof = await pg.evaluate("JSON.parse(localStorage.getItem('%s')).screen" % PROF)
    if prof != 'up': errs.append(f'turn: Play upright instead saved screen={prof!r}')
    if not await pg.evaluate("document.getElementById('turn').hidden") or await pg.evaluate("document.getElementById('scrWelcome').hidden") or await pg.evaluate("document.getElementById('app').classList.contains('rot')"): errs.append('turn: after Play upright instead the screen is not upright with the welcome sheet')
    await pg.reload(); await pg.wait_for_timeout(1000)
    if not await pg.evaluate("document.getElementById('turn').hidden"): errs.append('turn: the turn screen shows although Screen is Upright')
    await ctx.close()
    # the browser turns by itself: the screen leaves with no tap (200 ms), then the welcome
    ctx, pg = await new_page(b, vp, True, errs, 'turn')
    await pg.wait_for_function("!document.getElementById('turn').hidden", timeout=5000)
    await pg.set_viewport_size({'width': 844, 'height': 390}); await pg.wait_for_timeout(80)
    mid = await pg.evaluate("getComputedStyle(document.getElementById('turn')).opacity")
    await pg.wait_for_timeout(500)
    if not await pg.evaluate("document.getElementById('turn').hidden"): errs.append('turn: the turn screen stayed after the browser turned the page')
    if await pg.evaluate("document.getElementById('scrWelcome').hidden"): errs.append('turn: the welcome sheet did not follow the browser turning')
    print('turn: opacity 80 ms into the fade', mid)
    await ctx.close()
    # an invite link's lobby opens after it, not before (and no welcome sheet over it)
    ctx = await b.new_context(viewport=vp, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'turn invite: {e}'))
    await pg.goto(TEST_URL + '#join-pwtut-room'); await pg.wait_for_timeout(800)
    if await pg.evaluate("document.getElementById('turn').hidden") or await pg.evaluate("window.__blastline.mode") == 'online': errs.append('turn: an invite link opened its lobby before the turn screen')
    await pg.tap('#turnGo'); await pg.wait_for_timeout(500)
    if await pg.evaluate("window.__blastline.mode") != 'online' or not await pg.evaluate("document.getElementById('scrWelcome').hidden"): errs.append('turn: the invite lobby did not open after READY (or the welcome sheet came too)')
    await ctx.close()
    # a computer never sees it
    ctx, pg = await new_page(b, {'width': 1280, 'height': 760}, False, errs, 'turn')
    await pg.wait_for_timeout(500)
    if not await pg.evaluate("document.getElementById('turn').hidden"): errs.append('turn: a desktop shows the turn screen')
    await ctx.close()
    print('turn: ok')

async def skip(b, errs):
    # the card's Skip: a new player goes on to the first fight (the skip is counted by the play counts, ui/counter.js); one who has played goes to the menu
    for tag, prof, goes in [('skipnew', {'tut': True}, 'fight'), ('skipold', {'tut': True, 'matches': 4, 'wins': 2, 'losses': 2}, 'menu')]:
        ctx, pg = await new_page(b, {'width': 1280, 'height': 760}, False, errs, tag, prof)
        await pg.click('#bHelp'); await pg.wait_for_timeout(200)
        t = await pg.evaluate("document.querySelector('#hTry span').textContent")
        if t != 'Play the tutorial · 1 min': errs.append(f'{tag}: the How to play button reads {t!r}')
        await pg.click('#hTry')
        await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
        await pg.click('#tutSkip'); await pg.wait_for_timeout(600)
        m = await pg.evaluate("window.__blastline.mode"); fh = await pg.evaluate("window.__blastline.fh.on")
        if goes == 'fight' and not (m == 'match' and fh): errs.append(f'{tag}: Skip on a new player: mode {m}, first fight hints {fh}')
        if goes == 'menu' and m != 'menu': errs.append(f'{tag}: Skip on a player who has played: mode {m}')
        await ctx.close()
    print('skip: ok')

async def peek(b, errs):
    # the card fades to a ghost while the YOU marker would sit under it (the top platform at 667x320), and comes back when the player leaves it
    ctx, pg = await new_page(b, {'width': 667, 'height': 320}, True, errs, 'peek', {'tut': True})
    await pg.tap('#bHelp'); await pg.wait_for_timeout(200); await pg.tap('#hTry')
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    await pg.wait_for_timeout(800)
    op = lambda: pg.evaluate("(() => { const e = document.getElementById('tut'); return [e.classList.contains('peek'), +getComputedStyle(e).opacity]; })()")
    if (await op())[0]: errs.append('peek: the card is a ghost with nobody under it')
    await pg.evaluate(f"(() => {{ const me = {G}.fighters[0], p = BL.STAGE.plats.reduce((a, c) => (c.y < a.y ? c : a)); me.x = (p.x1 + p.x2) / 2; me.y = p.y - 4; me.vx = 0; me.vy = 0; me.grounded = false; me.state = 'air'; }})()")
    await pg.wait_for_timeout(700)
    ghost = await op()
    await pg.screenshot(path=f'{OUT}/peek_ghost.png')
    if not ghost[0] or ghost[1] > 0.4: errs.append(f'peek: the card does not fade with the marker under it: {ghost}')
    await pg.evaluate(f"(() => {{ const me = {G}.fighters[0]; me.x = 0; me.y = BL.STAGE.main.top - 4; me.vx = 0; me.vy = 0; me.grounded = false; me.state = 'air'; }})()")
    await pg.wait_for_timeout(900)
    back = await op()
    if back[0] or back[1] < 0.99: errs.append(f'peek: the card did not come back: {back}')
    await ctx.close()
    if not any(e.startswith('peek') for e in errs): print('peek: ok')

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for tag, vp, touch, up, mode in [('desk', {'width': 1280, 'height': 760}, False, False, 'ok'),
                                         ('desktouch', {'width': 1280, 'height': 760}, True, False, 'taps'),   # a big screen with touch controls (tablet, touch laptop)
                                         ('se', {'width': 667, 'height': 320}, True, False, 'ok'),
                                         ('mid', {'width': 740, 'height': 360}, True, False, 'ok'),
                                         ('phone', {'width': 844, 'height': 390}, True, False, 'fall'),
                                         ('up', {'width': 390, 'height': 844}, True, True, 'ok')]:
            if not ONLY or tag in ONLY:
                try: await run(b, tag, vp, touch, up, errs, mode)
                except Exception as e: errs.append(f'{tag}: {type(e).__name__}: {str(e)[:300]}')
        for name, fn in [('welcome', welcome), ('turn', turn), ('skip', skip), ('peek', peek)]:
            if not ONLY or name in ONLY:
                try: await fn(b, errs)
                except Exception as e: errs.append(f'{name}: {type(e).__name__}: {str(e)[:300]}')
        await b.close()
    print(errs or 'no errors')
asyncio.run(main())
