# Online boss fights (2v1 on two phones, ui/online.js) through a local server: the host's lobby turns Lives / Time / Format into Boss and
# Level, hosts a boss fight; the friend's list row reads "vs Old Scratch · Normal" with Team up. Both play three fighters on his map with
# all of his HP. NICE! goes both ways (N key, a tap on your own card). A desync forced on the friend's phone is repaired by the host's
# copy in pieces and both phones agree again. The boss goes down: KO page, Victory on both, the chips, Next: Hard on both, then Hard
# starts on both. The friend's page closes mid-fight: a CPU takes over on the host's phone, the fight goes on, the results say so and
# offer Retry vs CPU (a Practice boss fight). Last, the lobby in boss mode at four sizes. Prints "onboss ok" and "no errors".
#   python3 pwonboss.py [outdir]     (a server must listen on ONBOSS_URL, default http://localhost:8095/)
import asyncio, sys, os, json
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
OUT = sys.argv[1] if len(sys.argv) > 1 else 'onboss'
URL = os.environ.get('ONBOSS_URL', 'http://localhost:8095/')
PROF = "potatobrawl.profile.v1"
G = "window.__blastline.game"
N = "window.__blastline.net"
# a scripted player that never touches the game's random numbers (both phones must stay in step): walk to the boss, jab, heavy when he is broken
BOT = """window.__blInput = (g) => { const me = g.fighters[window.__blastline.net.role === 'host' ? 0 : 1], b = g.fighters[2], dx = b.x - me.x;
  const down = b.state === 'broken'; return { x: Math.abs(dx) > 34 ? Math.sign(dx) : 0, light: !down && g.t % 16 < 2, heavy: down && g.t % 24 < 2, special: !down && g.t % 120 === 60 }; }; 0"""
errs = []

def need(ok, msg):
    if not ok: errs.append(msg)
    return ok

async def page(b, vp, prof, tag):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, locale='en-US')
    await ctx.add_init_script("try { localStorage.setItem('%s', %s); } catch (e) { /* about:blank */ }" % (PROF, json.dumps(json.dumps(prof))))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    return ctx, pg

async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
async def chip(pg, row, label, mob):
    await pg.evaluate(f"[...document.querySelectorAll('#{row} .chip')].find((b) => (b.getAttribute('aria-label') || b.textContent) === {json.dumps(label)}).click()")

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ca, A = await page(b, (844, 390), {'tut': True, 'last': 'samurai', 'tokens': 100, 'onName': 'Jonny'}, 'A')
        cb, B = await page(b, (1280, 760), {'tut': True, 'last': 'odin', 'tokens': 100}, 'B')
        # ----- the host's lobby: Mode, then Boss and Level instead of Lives / Time / Format
        await A.tap('#bOnline'); await A.wait_for_timeout(1200)
        need(await A.evaluate("[...document.querySelectorAll('#ruleM .chip')].map((b) => b.textContent).join('|')") == '1 vs 1|Vs boss', 'no Mode row with 1 vs 1 and Vs boss')
        await chip(A, 'ruleM', 'Vs boss', True); await A.wait_for_timeout(200)
        need(await A.evaluate("document.querySelector('#rowL').hidden && document.querySelector('#rowT').hidden && document.querySelector('#rowB').hidden && !document.querySelector('#rowBo').hidden && !document.querySelector('#rowLv').hidden"),
             'Vs boss does not swap Lives / Time / Format for Boss / Level')
        bosses = await A.evaluate("[...document.querySelectorAll('#ruleBo .chip')].map((b) => b.getAttribute('aria-label') || b.textContent)")
        need(bosses == ['Old Scratch', 'Zorp', 'Kraken Spud'], f'boss chips {bosses}')
        await chip(A, 'ruleBo', 'Old Scratch', True); await chip(A, 'ruleLv', 'Normal', True)
        need(await txt(A, '#onHost') == 'Host a boss fight', f"host button {await txt(A, '#onHost')!r}")
        await A.screenshot(path=f'{OUT}/lobby_A.png')
        await A.tap('#onHost'); await A.wait_for_timeout(1200)
        need('Waiting for a partner' in await txt(A, '#onNote'), f"hosting note {await txt(A, '#onNote')!r}")
        need(await txt(A, '#onInvT') == 'Your boss fight is open', f"invite title {await txt(A, '#onInvT')!r}")
        await A.screenshot(path=f'{OUT}/hosting_A.png')
        # ----- the friend's list: an invitation to team up
        await B.click('#bOnline')
        try: await B.wait_for_function("[...document.querySelectorAll('#onList li')].some((li) => li.textContent.includes('vs Old Scratch · Normal'))", timeout=15000)
        except Exception: errs.append('the boss fight is not in the friend\'s list')
        row = await B.evaluate("(() => { const li = [...document.querySelectorAll('#onList li')].find((li) => li.textContent.includes('Old Scratch')); return li ? li.textContent : ''; })()")
        need(row.endswith('Team up'), f'list row {row!r}')
        await B.screenshot(path=f'{OUT}/list_B.png')
        await B.evaluate("[...document.querySelectorAll('#onList li .chip')].find((b) => b.textContent === 'Team up').click()")
        for pg in (A, B): await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        st = [await pg.evaluate(f"(() => {{ const g = {G}, b = g.fighters[2]; return {{ n: g.fighters.length, map: BL.MAPS[g.map].id, boss: b.spec.id, lv: g.lv, hp: b.hp, hpMax: b.hpMax, full: Math.round(b.spec.boss.hp * b.spec.boss.lvHp[0]), me: {N}.role, f: g.fighters.map((f) => f.spec.id) }}; }})()") for pg in (A, B)]
        for s, t in zip(st, 'AB'):
            need(s['n'] == 3 and s['map'] == 'field' and s['boss'] == 'scratch' and s['lv'] == 0, f'{t}: not Old Scratch on The Field, Normal: {s}')
            need(s['hp'] == s['hpMax'] == s['full'], f'{t}: boss HP {s["hp"]}/{s["hpMax"]}, want all of it ({s["full"]})')
        need(st[0]['f'] == st[1]['f'] and st[0]['f'][:2] == ['samurai', 'odin'], f'fighters {st[0]["f"]} / {st[1]["f"]}')
        await A.wait_for_function(f"{G}.phase === 'play'", timeout=30000)
        await A.wait_for_timeout(600); await A.screenshot(path=f'{OUT}/fight_A.png')
        # ----- NICE! both ways: the N key on the desktop, a tap on your own card on the phone
        await B.keyboard.press('n')
        try: await A.wait_for_function(f"{N}.emSeen === 1", timeout=8000)
        except Exception: errs.append("the friend's NICE! did not reach the host")
        await A.wait_for_timeout(150); await A.screenshot(path=f'{OUT}/nice_A.png')
        await A.tap('#pc0')
        try: await B.wait_for_function(f"{N}.emSeen === 1", timeout=8000)
        except Exception: errs.append("the host's NICE! (tap on the card) did not reach the friend")
        # ----- a desync on the friend's phone only: the host's copy in pieces repairs it
        await A.evaluate("window.__blSyncPart = 500")   # test only: smaller pieces, so the copy goes in several and every piece is confirmed
        fr = max(await A.evaluate(f"{N}.frame"), await B.evaluate(f"{N}.frame")) + 40
        await B.evaluate(f"window.__blTestAt = {{ f: {fr}, fn: (g) => {{ g.fighters[2].hp -= 150; g.fighters[0].percent += 33; g.fighters[1].x += 60; }} }}")
        try:
            await A.wait_for_function(f"{N}.desyncs >= 1", timeout=30000)
            await B.wait_for_function(f"{N}.desyncs >= 1", timeout=30000)
        except Exception: errs.append('the forced desync was not repaired')
        need((await A.evaluate(f"{N}.syncLast || 0")) >= 4, f"the copy went in {await A.evaluate(f'{N}.syncLast || 0')} piece(s), want 4 or more at 500 characters")
        sf = await A.evaluate(f"{N}.syncF || 0")
        common, same, om = [], {}, {}
        for _ in range(40):   # wait until both phones hold two or more checks made after the repair
            await A.wait_for_timeout(500)
            same = dict(await A.evaluate(f"[...{N}.ckMine]")); om = dict(await B.evaluate(f"[...{N}.ckMine]"))
            common = [k for k in same if k in om and k > sf]
            if len(common) >= 2: break
        need(len(common) >= 2 and all(same[k] == om[k] for k in common), f'after the repair the checksums differ (frames {common}, repair at {sf})')
        await A.evaluate("delete window.__blSyncPart")
        print('desyncs', await A.evaluate(f"{N}.desyncs"), await B.evaluate(f"{N}.desyncs"), 'pieces', await A.evaluate(f"{N}.syncLast"))
        # ----- the boss goes down: both play the KO page, Victory, the chips, Next: Hard
        for pg in (A, B): await pg.evaluate(BOT)
        fr = max(await A.evaluate(f"{N}.frame"), await B.evaluate(f"{N}.frame")) + 40
        hook = f"window.__blTestAt = {{ f: {fr}, fn: (g) => {{ const b = g.fighters[2]; b.hp = 1; b.poise = 0; }} }}"
        for pg in (A, B): await pg.evaluate(hook)
        try: await A.wait_for_function("window.__blastline.fin.on || window.__blastline.mode === 'result'", timeout=150000)
        except Exception: errs.append('the boss never went down')
        need(await A.evaluate("window.__blastline.fin.on"), 'no KO page on the host')
        await A.wait_for_timeout(1500); await A.screenshot(path=f'{OUT}/kopage_A.png'); await B.screenshot(path=f'{OUT}/kopage_B.png')
        for pg in (A, B): await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
        for pg in (A, B): await pg.evaluate("delete window.__blTestAt; delete window.__blInput")   # the next fight counts its frames from 0 again
        await A.wait_for_timeout(1200)
        for pg, t in ((A, 'A'), (B, 'B')):
            need(await txt(pg, '#rTitle') == 'Victory', f"{t}: results title {await txt(pg, '#rTitle')!r}")
            need((await txt(pg, '#rMode')).startswith('Boss fight · with '), f"{t}: results mode {await txt(pg, '#rMode')!r}")
            sub = await txt(pg, '#rSub')
            need(sub.startswith('You and ') and 'beat Old Scratch on Normal' in sub and 'final launch' in sub, f'{t}: results line {sub!r}')
            why = await txt(pg, '#rWhy')
            need(why.startswith('Win on Normal +20'), f'{t}: chips line {why!r}')
            need(await txt(pg, '#rAgain') == 'Next: Hard', f"{t}: big button {await txt(pg, '#rAgain')!r}")
        print('win lines:', await txt(A, '#rSub'), '|', await txt(B, '#rSub'))
        await A.screenshot(path=f'{OUT}/win_A.png'); await B.screenshot(path=f'{OUT}/win_B.png')
        need(await A.evaluate(f"{N}.desyncs") <= 1 and await B.evaluate(f"{N}.desyncs") <= 1, 'more desyncs than the forced one')
        # ----- Next: Hard on both starts Hard on both
        await A.tap('#rAgain'); await A.wait_for_timeout(300)
        need('Waiting for' in await txt(A, '#rAgainSub'), f"host's ready line {await txt(A, '#rAgainSub')!r}")
        await B.click('#rAgain')
        for pg in (A, B): await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=30000)
        lv = [await pg.evaluate(f"{G}.lv") for pg in (A, B)]
        need(lv == [1, 1], f'the next fight is not Hard on both: {lv}')
        # ----- the friend's page closes mid-fight: a CPU takes over on the host's phone and the fight goes on
        await A.wait_for_function(f"{G}.phase === 'play'", timeout=30000)
        need(await A.evaluate(f"{G}.fighters[2].hp === {G}.fighters[2].hpMax"), 'the Hard fight does not start with all of his HP')
        await B.goto('about:blank'); await cb.close()   # the friend's page goes away (it says goodbye to the server as it does)
        try: await A.wait_for_function(f"!!{N}.cpuMate", timeout=30000)
        except Exception: errs.append('no CPU took over after the friend left')
        await A.wait_for_timeout(500)
        ban = await txt(A, '#banner')
        need('dropped' in ban.lower(), f'drop banner {ban!r}')
        await A.screenshot(path=f'{OUT}/dropped_A.png')
        t0 = await A.evaluate(f"{G}.t")
        try: await A.wait_for_function(f"{G}.t > {t0 + 30}", timeout=20000)   # the test browser runs at a few frames a second
        except Exception: errs.append(f'the fight stopped after the drop ({t0} -> {await A.evaluate(f"{G}.t")})')
        await A.evaluate(f"(() => {{ const g = {G}; g.fighters[2].hp = Math.round(g.fighters[2].hpMax * 0.62); for (const i of [0, 1]) {{ g.fighters[i].stocks = 1; g.fighters[i].x = i ? -5000 : 5000; }} }})()")
        await A.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
        await A.wait_for_timeout(1100)
        need(await txt(A, '#rTitle') == 'Defeat', f"drop loss title {await txt(A, '#rTitle')!r}")
        need((await txt(A, '#rMode')).endswith('dropped'), f"drop results mode {await txt(A, '#rMode')!r}")
        why = await txt(A, '#rWhy')
        need(why.startswith('Fight played +5 · Took 30% of his HP +3'), f'drop chips line {why!r}')
        need(await txt(A, '#rAgain') == 'Retry vs CPU', f"drop big button {await txt(A, '#rAgain')!r}")
        await A.screenshot(path=f'{OUT}/dropped_result_A.png')
        await A.tap('#rAgain')
        await A.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
        need(await A.evaluate(f"{G}.fighters.length === 3 && {G}.lv === 1 && {G}.fighters[1].spec.id === 'odin'"), 'Retry vs CPU is not the same boss fight with a CPU partner')
        await ca.close()
        # ----- the lobby in boss mode at four sizes: the host card fits, nothing runs off the screen
        for (w, h, up) in ((667, 320, False), (844, 390, False), (1280, 760, False), (390, 844, True)):
            prof = {'tut': True, 'last': 'reaper', 'onBoss': {'on': True, 'b': 'kraken', 'lv': 2}}
            if up: prof['screen'] = 'up'
            c, pg = await page(b, (w, h), prof, f'lobby{w}')
            await (pg.tap if w < 1000 else pg.click)('#bOnline'); await pg.wait_for_timeout(1200)
            bad = await pg.evaluate("""(() => { const vw = innerWidth, bad = []; for (const e of document.querySelectorAll('#scrOnline .chip, #onHost')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) bad.push(e.textContent); } return bad; })()""")
            need(not bad, f'lobby {w}x{h}: runs off the screen: {bad}')
            for mode in ('Vs boss', '1 vs 1'):
                await chip(pg, 'ruleM', mode, True); await pg.wait_for_timeout(150)
                hb = await pg.evaluate("(() => { const r = document.querySelector('#onHost').getBoundingClientRect(), rows = [...document.querySelectorAll('#onRules .rule-row:not([hidden])')]; return { b: r.bottom, vh: innerHeight, wrap: rows.filter((e) => e.getBoundingClientRect().height > 44).map((e) => e.firstChild.textContent) }; })()")
                need(hb['b'] <= hb['vh'] + 0.5, f"lobby {w}x{h} {mode}: the Host button ends at {hb['b']:.0f}, below the screen ({hb['vh']})")
                need(not hb['wrap'], f"lobby {w}x{h} {mode}: rows wrap: {hb['wrap']}")
                if mode == 'Vs boss': await pg.screenshot(path=f'{OUT}/lobby_{w}x{h}.png')
            await chip(pg, 'ruleM', 'Vs boss', True)
            need(await pg.evaluate("[...document.querySelectorAll('#ruleLv .chip.on')].map((b) => b.textContent).join()") == 'Nightmare', f'lobby {w}x{h}: the saved level is not picked')
            await c.close()
        await b.close()
    print('onboss ok' if not errs else 'onboss FAILED')
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
