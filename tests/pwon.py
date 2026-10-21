import asyncio, sys, os, re
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
OUT = 'ux2'
URL = os.environ.get('PWON_URL', 'http://localhost:8091/')
INIT = "localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5, gfx: '2d'%s}))"
# A has glazed the base skin of every fighter and wears the Sunset nameplate: B must see both (the lobby row, the fight); B has neither
GLAZE_ALL = ", glazed: {phoenix: [0], alchemist: [0], odin: [0], wizard: [0], samurai: [0], dragon: [0], gunslinger: [0], reaper: [0]}, plates: ['sunset'], plate: 'sunset'"
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ca = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
        cb = await b.new_context(viewport={'width': 1280, 'height': 760})
        await ca.add_init_script(INIT % GLAZE_ALL); await cb.add_init_script(INIT % '')
        A = await ca.new_page(); B = await cb.new_page()
        for t, pg in (('A', A), ('B', B)):
            pg.on('pageerror', lambda e, t=t: errs.append(f'{t}: {e}'))
        await A.goto(URL); await B.goto(URL); await A.wait_for_timeout(800)
        await A.tap('#bOnline'); await A.wait_for_timeout(1200); await A.screenshot(path=f'{OUT}/on_A_lobby.png')
        await A.tap('#onHost'); await A.wait_for_timeout(1200); await A.screenshot(path=f'{OUT}/on_A_hosting.png')
        await B.click('#bOnline'); await B.wait_for_timeout(1500); await B.screenshot(path=f'{OUT}/on_B_list.png')
        if not await B.evaluate("!!document.querySelector('#onList li .who b.np-sunset')"): errs.append("B: the host's name in the list is not on his Sunset plate")
        if not await A.evaluate("document.querySelector('#onMyName').parentNode.classList.contains('np-sunset')"): errs.append("A: the Fight Card's name plate is not Sunset")
        await B.click('#onList li .chip'); 
        await A.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        await B.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        await A.wait_for_timeout(4000); await A.screenshot(path=f'{OUT}/on_A_match.png')
        gz = [await A.evaluate("[window.__blastline.glazed(0), window.__blastline.glazed(1)]"), await B.evaluate("[window.__blastline.glazed(0), window.__blastline.glazed(1)]")]
        if gz != [[True, False], [True, False]]: errs.append(f"glaze: the host's fighter should shine on both phones and the guest's on neither, got A {gz[0]} B {gz[1]}")
        else: print('glaze ok')
        print('desyncs before hook', await A.evaluate("window.__blastline.net.desyncs"), await B.evaluate("window.__blastline.net.desyncs"))
        fr = max(await A.evaluate("window.__blastline.net.frame"), await B.evaluate("window.__blastline.net.frame")) + 90
        hook = f"window.__blTestAt = {{ f: {fr}, fn: (g) => {{ g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }} }}"
        await A.evaluate(hook); await B.evaluate(hook)
        await A.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
        await A.wait_for_timeout(1200); await A.screenshot(path=f'{OUT}/on_A_result.png')
        await B.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
        await B.screenshot(path=f'{OUT}/on_B_result.png')
        print('desyncs', await A.evaluate("window.__blastline.net.desyncs"), await B.evaluate("window.__blastline.net.desyncs"))
        # both ask for a rematch (the KO finisher must hand over to the results screen cleanly on both sides)
        await A.tap('#rAgain'); await B.click('#rAgain')
        await A.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        await B.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        print('rematch ok')
        await ca.close(); await cb.close()
        # Challenge a friend (ui/challenge.js): C, a phone, wins a practice match vs a CPU and taps Challenge a friend: the share sheet gets
        # the line and the link in that tap, and C hosts that room. D, a brand-new phone held upright, opens the link: the turn screen,
        # then the lobby (no welcome sheet) with C's match on top; Join, the fight, and Play friends results without the button
        cc = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
        cd = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await cc.add_init_script(INIT % '' + "; window.__shared = []; navigator.share = (d) => { window.__shared.push(d); return Promise.resolve(); }")
        C = await cc.new_page(); D = await cd.new_page()
        for t, pg in (('C', C), ('D', D)):
            pg.on('pageerror', lambda e, t=t: errs.append(f'{t}: {e}'))
        await C.goto(URL); await C.wait_for_timeout(800)
        await C.tap('#bPractice'); await C.wait_for_timeout(500); await C.tap('#selGo')
        await C.wait_for_function("window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=60000)
        await C.evaluate("(() => { const g = window.__blastline.game; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; })()")
        await C.wait_for_function("window.__blastline.mode === 'result'", timeout=60000); await C.wait_for_timeout(1200)
        await C.screenshot(path=f'{OUT}/on_C_result_challenge.png')
        if not await C.evaluate("!document.getElementById('rChl').hidden"): errs.append('C: no Challenge a friend after a practice win')
        await C.tap('#rChl')
        await C.wait_for_function("window.__blastline.mode === 'online' && window.__blastline.net.phase === 'hosting'", timeout=30000)
        sh = await C.evaluate("window.__shared")
        code = await C.evaluate("window.__blastline.net.hostCode")
        fname = await C.evaluate("document.getElementById('onFName').textContent")
        if not (len(sh) == 1 and sh[0].get('text') == f'Think you can beat my {fname}?' and sh[0].get('url') == f'{URL}#join-{code}' and re.match(r'^ch[a-z0-9]{7}$', code or '')):
            errs.append(f'C: the share sheet got {sh}, the room is {code!r}, the fighter {fname!r}')
        await C.wait_for_timeout(600)
        if await C.evaluate("document.getElementById('onInvT').textContent") != 'Your challenge is open': errs.append(f"C: link card title {await C.evaluate('document.getElementById(`onInvT`).textContent')!r}")
        await C.screenshot(path=f'{OUT}/on_C_challenge_hosting.png')
        await D.goto(f'{URL}#join-{code}'); await D.wait_for_timeout(900)
        if await D.evaluate("document.getElementById('turn').hidden"): errs.append('D: no turn-sideways screen for an upright phone opening the link')
        await D.tap('#turnGo')
        await D.wait_for_function("window.__blastline.mode === 'online' && !!document.querySelector('#onList li.invited .chip')", timeout=30000)
        if not await D.evaluate("document.getElementById('scrWelcome').hidden"): errs.append('D: the welcome sheet came up over the lobby')
        inv = await D.evaluate("document.querySelector('#onList li.invited').textContent")
        if 'Invited you' not in inv: errs.append(f'D: the invited row reads {inv!r}')
        await D.screenshot(path=f'{OUT}/on_D_invited.png')
        # C is still in the app they shared from (a hidden page draws no frames, so it doesn't hear the room): D's Join waits for them
        # instead of giving up after 8 s, then they fight
        await C.evaluate("(() => { const raf = window.requestAnimationFrame.bind(window), q = []; window.__rafHold = { raf, q }; window.requestAnimationFrame = (f) => { q.push(f); return 0; }; })()")
        await D.tap('#onList li.invited .chip'); await D.wait_for_timeout(11000)
        wt = await D.evaluate("[window.__blastline.net.phase, document.getElementById('onNote').textContent]")
        if wt != ['joining', 'Waiting for your friend to come back to the game…']: errs.append(f'D: while C is away: {wt}')
        await D.screenshot(path=f'{OUT}/on_D_waiting.png')
        await C.evaluate("(() => { const h = window.__rafHold; window.requestAnimationFrame = h.raf; for (const f of h.q.splice(0)) h.raf(f); })()")
        await C.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        await D.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        fr = max(await C.evaluate("window.__blastline.net.frame"), await D.evaluate("window.__blastline.net.frame")) + 90
        hook = f"window.__blTestAt = {{ f: {fr}, fn: (g) => {{ g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }} }}"
        await C.evaluate(hook); await D.evaluate(hook)
        await C.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
        await D.wait_for_function("window.__blastline.mode === 'result'", timeout=60000); await D.wait_for_timeout(1200)
        await D.screenshot(path=f'{OUT}/on_D_result.png')
        dz = [await C.evaluate("window.__blastline.net.desyncs"), await D.evaluate("window.__blastline.net.desyncs")]
        hid = [await C.evaluate("document.getElementById('rChl').hidden"), await D.evaluate("document.getElementById('rChl').hidden")]
        if dz != [0, 0] or hid != [True, True]: errs.append(f'challenge match: desyncs {dz}, Challenge a friend hidden after Play friends {hid}')
        else: print('challenge ok')
        await b.close()
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
