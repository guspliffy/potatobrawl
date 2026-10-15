# Boss fights in the browser (ui/boss.js): Practice > VS > Old Scratch turns the level picker into Normal / Hard / Nightmare and locks the
# map to his; Fight starts you + a CPU partner against him: three fighters, the boss bar in the timer's place (his line during the
# countdown), the bar follows his HP, poise and stagger; at 0 HP he breaks (FINISH, the banner), the partner ends him and the KO page
# plays before the results (Victory, "Boss fight · Hard"); a rematch, then a loss (both of you out): no KO page, Defeat, his HP left.
# A second part starts a fight at each size and checks the bar fits between the cards (screenshots: fight, staggered, broken).
# A third part fights Zorp: his map and line, the hover, the crash into his floor phase, the finish (screenshots zorp_*); a fourth
# fights Kraken Spud: The Deep, out at sea where he can't be hit, a slammed tentacle he can be hit through, the finish (kraken_*).
#   python3 pwboss.py [outdir [tag ...]]   tags: flow (844x390) zorp kraken s667 p844 d1280 up390; no tag runs everything
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'boss'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = "potatobrawl.profile.v1"
G = "window.__blastline.game"
BOSS = f"{G}.fighters[2]"

async def new_page(b, tag, vp, up, errs):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, locale='en-US')
    p = {'tut': True, 'last': 'samurai'}
    if up: p['screen'] = 'up'
    await ctx.add_init_script("if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, json.dumps(json.dumps(p))))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    return ctx, pg, mob

async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }})()")
async def in_play(pg):
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    await pg.wait_for_timeout(300)

# the boss bar sits inside the screen and clear of both cards
FIT = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight, r = (s) => document.querySelector(s).getBoundingClientRect();
  const bb = r('#bossBar'), a = r('#pc0'), b = r('#pc1');
  if (bb.left < -0.5 || bb.right > vw + 0.5 || bb.top < -0.5) bad.push('the boss bar runs off the screen');
  for (const [n, c] of [['your card', a], ["the partner's card", b]]) if (bb.left < c.right - 1 && bb.right > c.left + 1 && bb.top < c.bottom - 1 && bb.bottom > c.top + 1) bad.push('the boss bar overlaps ' + n);
  for (const e of document.querySelectorAll('#bossBar .bb-top > *')) if (getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().right > bb.right + 2) bad.push('"' + e.textContent + '" runs out of the bar');
  return bad;
})()"""

async def flow(b, errs):
    tag = 'flow'
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, errs)
    clk = pg.tap if mob else pg.click
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    # ----- Practice: the boss in the VS list, his difficulty, his map
    await clk('#bPractice'); await pg.wait_for_timeout(500)
    await clk('#oppPick'); await pg.wait_for_timeout(200)
    need(await pg.evaluate("[...document.querySelectorAll('#oppPop button')].some((b) => b.textContent.includes('Old Scratch'))"), 'Old Scratch is not in the VS list')
    await pg.evaluate("[...document.querySelectorAll('#oppPop button')].find((b) => b.textContent.includes('Old Scratch')).click()")
    await pg.wait_for_timeout(200)
    need('Old Scratch' in await txt(pg, '#oppPick'), f"VS picker reads {await txt(pg, '#oppPick')!r}")
    need(await txt(pg, '#lvlPick span') == 'Normal', f"level picker reads {await txt(pg, '#lvlPick')!r}, want Boss / Normal")
    need(await pg.evaluate("document.querySelector('#mapPick').disabled"), 'the map picker is not locked for a boss')
    field = await pg.evaluate("(() => { const m = BL.MAPS.find((m) => m.id === 'field'); return m ? m.id : null; })()")
    need(field == 'field', 'no field map')
    await clk('#lvlPick'); await pg.wait_for_timeout(200)
    lv = await pg.evaluate("[...document.querySelectorAll('#lvlPop button')].map((b) => b.textContent)")
    need(lv == ['Normal', 'Hard', 'Nightmare'], f'boss levels {lv}')
    await pg.evaluate("[...document.querySelectorAll('#lvlPop button')].find((b) => b.textContent === 'Hard').click()")
    await pg.wait_for_timeout(200)
    need(await txt(pg, '#lvlPick span') == 'Hard', f"level picker reads {await txt(pg, '#lvlPick')!r} after picking Hard")
    await clk('#selGo')
    # ----- the fight: three fighters, the bar, his line during the countdown
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    st = await pg.evaluate(f"(() => {{ const g = {G}; return {{ n: g.fighters.length, lv: g.lv, map: BL.MAPS[g.map].id, boss: g.fighters[2].spec.id, teams: g.fighters.map((f) => f.team), me: g.fighters[0].spec.id, hp: g.fighters[2].hp, hpMax: g.fighters[2].hpMax }}; }})()")
    need(st['n'] == 3 and st['boss'] == 'scratch' and st['teams'] == [0, 0, 1], f'fight setup {st}')
    need(st['lv'] == 1 and st['map'] == 'field', f"level {st['lv']} map {st['map']}, want Hard on the field")
    need(st['me'] == 'samurai', f"you play {st['me']}, want the last fighter (samurai)")
    need(st['hp'] == st['hpMax'] == round(1150 * 1.15 * 0.75), f"boss HP {st['hp']}/{st['hpMax']}")
    need(await shown(pg, '#bossBar') and not await shown(pg, '#clock'), 'the boss bar does not replace the timer')
    need(await txt(pg, '#bossBar .bb-name') == 'Old Scratch' and await txt(pg, '#bossBar .bb-lv') == 'Hard', f"bar reads {await txt(pg, '#bossBar .bb-top')!r}")
    try: await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('talk')", timeout=3000)
    except Exception: pass
    need(await shown(pg, '#bossBar .bb-q') and 'salt' in await txt(pg, '#bossBar .bb-q'), 'no boss line during the countdown')
    need(await txt(pg, '#pc1 .pc-sub .tr') == 'partner', f"the partner card's sub-line reads {await txt(pg, '#pc1 .pc-sub .tr')!r}")
    await pg.screenshot(path=f'{OUT}/flow_countdown.png')
    await in_play(pg)
    need(not await shown(pg, '#bossBar .bb-q'), 'the boss line stays after the countdown')
    # the bar follows his HP (test only: set HP), poise and stagger
    await pg.evaluate(f"{BOSS}.hp = Math.round({BOSS}.hpMax * 0.4)")
    await pg.wait_for_timeout(200)
    hpv = await pg.evaluate("+getComputedStyle(document.querySelector('#bossBar')).getPropertyValue('--hp')")
    need(abs(hpv - 0.4) < 0.02, f'bar --hp {hpv}, want 0.4')
    # ----- down to 1 HP: the next hit breaks him (FINISH), the partner ends him, the KO page, the results
    await pg.evaluate(f"(() => {{ const b = {BOSS}; b.hp = 1; b.poise = 0; }})()")
    await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('down')", timeout=90000)
    need(await shown(pg, '#bossBar .bb-fin'), 'FINISH does not show under the broken bar')
    need(await pg.evaluate(f"{BOSS}.state") in ('broken', 'hitstun'), 'he is not broken at 0 HP')
    await pg.screenshot(path=f'{OUT}/flow_broken.png')
    await pg.wait_for_function("window.__blastline.fin.on || window.__blastline.mode === 'result'", timeout=120000)
    fin = await pg.evaluate("window.__blastline.fin.on")
    need(fin, 'no KO page after the final hit on the boss')
    if fin:
        await pg.wait_for_timeout(1800)
        await pg.screenshot(path=f'{OUT}/flow_kopage.png')
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
    await pg.wait_for_timeout(1100)
    need(await txt(pg, '#rTitle') == 'Victory', f"results title {await txt(pg, '#rTitle')!r}")
    need(await txt(pg, '#rMode') == 'Boss fight · Hard', f"results mode {await txt(pg, '#rMode')!r}")
    sub = await txt(pg, '#rSub')
    need(sub.startswith('You and ') and 'beat Old Scratch on Hard' in sub, f'results line {sub!r}')
    need(await shown(pg, '#rFin'), 'no finisher plate on the win')
    need('Boss fights in Practice' in await txt(pg, '#rWhy'), f"chips line {await txt(pg, '#rWhy')!r}")
    await pg.screenshot(path=f'{OUT}/flow_win.png')
    # ----- rematch, then a loss: both of you out, no KO page for him
    await clk('#rAgain')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    need(await pg.evaluate(f"{G}.fighters.length === 3 && {G}.lv === 1"), 'the rematch is not the same boss fight')
    await in_play(pg)
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[2].hp = Math.round(g.fighters[2].hpMax * 0.62); for (const i of [0, 1]) {{ g.fighters[i].stocks = 1; g.fighters[i].x = i ? -5000 : 5000; }} }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
    await pg.wait_for_timeout(900)
    need(await txt(pg, '#rTitle') == 'Defeat', f"loss title {await txt(pg, '#rTitle')!r}")
    sub = await txt(pg, '#rSub')
    need(sub.startswith('Old Scratch won with 62% of his HP left'), f'loss line {sub!r}')
    await pg.screenshot(path=f'{OUT}/flow_loss.png')
    await ctx.close()

async def size(b, tag, errs):
    vp = SIZES[tag]
    ctx, pg, mob = await new_page(b, tag, vp[:2], vp[2], errs)
    await pg.evaluate("window.__blBoss({ level: 2, partner: 'reaper' })")
    await in_play(pg)
    await pg.wait_for_timeout(1500)
    bad = await pg.evaluate(FIT)
    if bad: errs.append(f'{tag} fight: ' + '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/{tag}_fight.png')
    # test only: the bar while he is staggered, then broken
    await pg.evaluate(f"(() => {{ const b = {BOSS}; b.hp = Math.round(b.hpMax * 0.15); b.move = null; b.mid = null; b.state = 'stagger'; b.stag = 120; }})()")
    try: await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('stag')", timeout=3000)
    except Exception: errs.append(f'{tag}: no "Staggered" on the bar')
    bad = await pg.evaluate(FIT)
    if bad: errs.append(f'{tag} staggered: ' + '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/{tag}_stagger.png')
    await pg.evaluate(f"(() => {{ const b = {BOSS}; b.hp = 0; b.state = 'broken'; b.stag = 0; b.poise = 0; }})()")
    try: await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('down')", timeout=3000)
    except Exception: errs.append(f'{tag}: the bar does not show him broken')
    await pg.wait_for_timeout(200)
    bad = await pg.evaluate(FIT)
    if bad: errs.append(f'{tag} broken: ' + '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/{tag}_broken.png')
    await ctx.close()

# ----- Zorp (the second boss): The Kitchen, his line, the hover, the crash into his floor phase, the finish and the results
async def zorp(b, errs):
    tag = 'zorp'
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, errs)
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    await pg.evaluate("window.__blBoss({ boss: 'zorp', level: 0, partner: 'odin' })")
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    st = await pg.evaluate(f"(() => {{ const g = {G}; return {{ boss: g.fighters[2].spec.id, map: BL.MAPS[g.map].id, y: g.fighters[2].y, hp: g.fighters[2].hpMax }}; }})()")
    need(st['boss'] == 'zorp' and st['map'] == 'kitchen', f'Zorp fight setup {st}')
    need(st['y'] == -130 and st['hp'] == round(1050 * 0.75), f"he does not start hovering with his HP: {st}")
    need(await txt(pg, '#bossBar .bb-name') == 'Zorp', f"bar reads {await txt(pg, '#bossBar .bb-top')!r}")
    try: await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('talk')", timeout=3000)
    except Exception: pass
    need('ladle' in await txt(pg, '#bossBar .bb-q'), f"his line {await txt(pg, '#bossBar .bb-q')!r}")
    await pg.screenshot(path=f'{OUT}/zorp_countdown.png')
    await in_play(pg)
    await pg.wait_for_timeout(2500)
    need(await pg.evaluate(f"{BOSS}.ph === 0 && {BOSS}.y < -100"), 'he is not hovering')
    await pg.screenshot(path=f'{OUT}/zorp_hover.png')
    # just over the crash line: the partner's next hit brings the saucer down (phase 2 from the landing)
    await pg.evaluate(f"(() => {{ const b = {BOSS}; b.hp = Math.round(b.hpMax * 0.56); }})()")
    await pg.wait_for_function(f"{BOSS}.mid === 'crash' || {BOSS}.ph === 1", timeout=90000)
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{OUT}/zorp_crash.png')
    await pg.wait_for_function(f"{BOSS}.ph === 1 && {BOSS}.grounded", timeout=10000)
    await pg.wait_for_timeout(1200)
    await pg.screenshot(path=f'{OUT}/zorp_floor.png')
    await pg.evaluate(f"(() => {{ const b = {BOSS}; b.hp = 1; b.poise = 0; }})()")
    await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('down')", timeout=90000)
    await pg.screenshot(path=f'{OUT}/zorp_broken.png')
    await pg.wait_for_function("window.__blastline.fin.on || window.__blastline.mode === 'result'", timeout=120000)
    if need(await pg.evaluate("window.__blastline.fin.on"), 'no KO page after the final hit on Zorp'):
        await pg.wait_for_timeout(1800)
        await pg.screenshot(path=f'{OUT}/zorp_kopage.png')
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
    await pg.wait_for_timeout(1100)
    need(await txt(pg, '#rTitle') == 'Victory' and 'beat Zorp on Normal' in await txt(pg, '#rSub'), f"results {await txt(pg, '#rTitle')!r} {await txt(pg, '#rSub')!r}")
    await pg.screenshot(path=f'{OUT}/zorp_win.png')
    await ctx.close()
    # the bar fits at the phone size against him too
    ctx, pg, mob = await new_page(b, 'zorp s667', SIZES['s667'][:2], False, errs)
    await pg.evaluate("window.__blBoss({ boss: 'zorp', level: 2, partner: 'wizard' })")
    await in_play(pg)
    await pg.wait_for_timeout(2000)
    bad = await pg.evaluate(FIT)
    if bad: errs.append('zorp s667: ' + '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/zorp_s667.png')
    await ctx.close()

# ----- Kraken Spud (the third boss): The Deep, his line, out at sea (he can't be hit there), a slammed tentacle on the deck, the finish
async def kraken(b, errs):
    tag = 'kraken'
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, errs)
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    await pg.evaluate("window.__blBoss({ boss: 'kraken', level: 0, partner: 'odin' })")
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    st = await pg.evaluate(f"(() => {{ const g = {G}; const f = g.fighters[2]; return {{ boss: f.spec.id, map: BL.MAPS[g.map].id, x: f.x, y: f.y, hp: f.hpMax }}; }})()")
    need(st['boss'] == 'kraken' and st['map'] == 'deep', f'Kraken fight setup {st}')
    need(st['x'] == 470 and st['y'] == -20 and st['hp'] == round(600 * 0.75), f"he does not wait at sea with his HP: {st}")
    need(await txt(pg, '#bossBar .bb-name') == 'Kraken Spud', f"bar reads {await txt(pg, '#bossBar .bb-top')!r}")
    try: await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('talk')", timeout=3000)
    except Exception: pass
    need('side dishes' in await txt(pg, '#bossBar .bb-q'), f"his line {await txt(pg, '#bossBar .bb-q')!r}")
    await pg.screenshot(path=f'{OUT}/kraken_countdown.png')
    await in_play(pg)
    await pg.wait_for_timeout(1500)
    need(await pg.evaluate(f"(() => {{ const f = {BOSS}; return f.x > 400 && f.ph !== 1 && f.state !== 'stagger'; }})()"), 'he left the sea in the first seconds')
    await pg.screenshot(path=f'{OUT}/kraken_sea.png')
    # a slammed tentacle stays on the deck: the part he can be hit through
    await pg.wait_for_function(f"{G}.projs.some((p) => p.part && p.t > 8)", timeout=60000)
    need(await pg.evaluate(f"{G}.projs.some((p) => p.part && p.style === 'tent' && Math.abs(p.y) < 1)"), 'no tentacle lying on the deck after a slam')
    await pg.screenshot(path=f'{OUT}/kraken_slam.png')
    await pg.evaluate(f"(() => {{ const b = {BOSS}; b.hp = 1; b.poise = 0; }})()")
    await pg.wait_for_function("document.querySelector('#bossBar').classList.contains('down')", timeout=120000)
    await pg.wait_for_timeout(600)
    await pg.screenshot(path=f'{OUT}/kraken_broken.png')
    await pg.wait_for_function("window.__blastline.fin.on || window.__blastline.mode === 'result'", timeout=120000)
    if need(await pg.evaluate("window.__blastline.fin.on"), 'no KO page after the final hit on Kraken Spud'):
        await pg.wait_for_timeout(1800)
        await pg.screenshot(path=f'{OUT}/kraken_kopage.png')
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
    await pg.wait_for_timeout(1100)
    need(await txt(pg, '#rTitle') == 'Victory' and 'beat Kraken Spud on Normal' in await txt(pg, '#rSub'), f"results {await txt(pg, '#rTitle')!r} {await txt(pg, '#rSub')!r}")
    await pg.screenshot(path=f'{OUT}/kraken_win.png')
    await ctx.close()
    # the bar fits at the phone size against him too
    ctx, pg, mob = await new_page(b, 'kraken s667', SIZES['s667'][:2], False, errs)
    await pg.evaluate("window.__blBoss({ boss: 'kraken', level: 2, partner: 'wizard' })")
    await in_play(pg)
    await pg.wait_for_timeout(2000)
    bad = await pg.evaluate(FIT)
    if bad: errs.append('kraken s667: ' + '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/kraken_s667.png')
    await ctx.close()

async def main():
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        if not ONLY or 'flow' in ONLY: await flow(b, errs)
        if not ONLY or 'zorp' in ONLY: await zorp(b, errs)
        if not ONLY or 'kraken' in ONLY: await kraken(b, errs)
        for tag in SIZES:
            if not ONLY or tag in ONLY: await size(b, tag, errs)
        await b.close()
    for e in errs: print('ERROR', e)
    if not errs: print('no errors')
asyncio.run(main())
