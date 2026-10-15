# The offline tournament (ui/cup.js): start a cup, win the quarter-final, check the bracket moves on and the chips are paid, lose the
# semi-final, check "Run it back" and the profile (no rating change), leave a cup, reload into a cup, forfeit from the pause menu.
# A second part wins a whole cup and loses a quarter-final at each size and takes screenshots of the bracket at every stage.
#   python3 pwcup.py [outdir [tag ...]]   tags: flow (844x390, the checks above; default with the shots) s667 p844 d1280 up390
#                                         with no tag everything runs; "flow" alone is the quick check
# The CPU is put out of the arena through window.__blastline.game (test only), the same trick tests/pwux2.py uses for the results screen.
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'cup'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = "potatobrawl.profile.v1"
G = "window.__blastline.game"
START = {'tokens': 85, 'rating': 1210, 'peak': 1210, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True}
OVERLAP = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight;
  const vis = (e) => e.offsetParent !== null || e.getClientRects().length;
  const grid = document.querySelector('#cupGrid'), list = document.querySelector('#cupList');
  const box = getComputedStyle(grid).display !== 'none' ? grid : list;
  const foot = document.querySelector('#cupFoot').getBoundingClientRect(), main = document.querySelector('.cup-main').getBoundingClientRect();
  const slots = [...box.querySelectorAll('.cs')].map((e) => ({ r: e.getBoundingClientRect(), k: e.dataset.k })).filter((s) => s.r.width > 0);
  for (const s of slots) {
    if (s.r.left < -0.5 || s.r.right > vw + 0.5 || s.r.top < -0.5 || s.r.bottom > vh + 0.5) bad.push('slot ' + s.k + ' off screen');
    if (box === grid && (s.r.top < main.top - 1 || s.r.bottom > main.bottom + 1)) bad.push('slot ' + s.k + ' outside the bracket area');
  }
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const a = slots[i].r, b = slots[j].r;
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push('slots ' + slots[i].k + ' and ' + slots[j].k + ' overlap');
  }
  if (box === grid && foot.top < main.bottom - 1) bad.push('footer overlaps the bracket');
  for (const e of document.querySelectorAll('#scrCup .cf button, #scrCup .back')) { const r = e.getBoundingClientRect(); if (r.width && (r.left < 0 || r.right > vw || r.top < 0 || r.bottom > vh + 0.5)) bad.push('button ' + (e.id || e.className) + ' off screen'); }
  return bad;
})()"""

async def new_page(b, tag, vp, up, errs, prof=None):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    p = dict(prof or START)
    if up: p['screen'] = 'up'
    # a fresh page gets the starting profile; once the game has saved one (also after a reload) it is kept
    await ctx.add_init_script("if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, json.dumps(json.dumps(p))))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    return ctx, pg, mob

def prof(pg): return pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)

async def in_match(pg):
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000)
    await pg.wait_for_timeout(300)

async def end_match(pg, win):
    """Put one fighter out of the arena: the CPU when you win, you when you lose."""
    await in_match(pg)
    i = 1 if win else 0
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[{i}].stocks = 1; g.fighters[{i}].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'cup'", timeout=90000)

async def settle(pg):
    """Wait until the bracket has ticked in its results and the bottom strip has slid in."""
    await pg.wait_for_function("document.querySelector('#cupFoot').classList.contains('in')", timeout=20000)
    await pg.wait_for_timeout(700)

async def shot(pg, tag, name, errs, check=True):
    await pg.screenshot(path=f'{OUT}/{tag}_{name}.png')
    if check:
        bad = await pg.evaluate(OVERLAP)
        if bad: errs.append(f'{tag} {name}: ' + '; '.join(bad[:4]))

async def flow(b, errs):
    """The functional checks, at 844x390 with touch."""
    tag, vp = 'flow', (844, 390)
    ctx, pg, mob = await new_page(b, tag, vp, False, errs)
    clk = pg.tap
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
    # the start page has the button; the select screen is in cup mode
    need(await pg.evaluate("!!document.getElementById('bCup') && document.getElementById('bCup').textContent.includes('Tournament')"), 'no Tournament button')
    await clk('#bCup'); await pg.wait_for_timeout(600)
    need(await pg.evaluate("window.__blastline.mode") == 'select', 'Tournament does not open the select screen')
    need((await pg.text_content('#selMode')).startswith('Tournament'), 'select header is not the tournament one')
    need((await pg.text_content('#selGo')).strip().lower() == 'start cup', 'Go button is not Start cup')
    await pg.evaluate("document.querySelectorAll('.tile')[2].click()"); await pg.wait_for_timeout(200)   # Odin
    await clk('#selGo'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'cup', 'Start cup does not open the bracket')
    await settle(pg)
    p0 = await prof(pg); c = p0['cup']
    need(c and len(c['slots']) == 8 and c['round'] == 0 and c['fid'] == 'odin', 'cup not saved in the profile as expected')
    names = [s['n'] for s in c['slots']]
    need(len(set(names)) == 8 and names[c['mi']] == 'You', 'the 7 CPUs do not have 7 different names')
    rat = c['slots']; mi = c['mi']
    need(abs(rat[mi ^ 1]['r'] - (1210 - 30)) <= 12, 'the quarter-final opponent is not a little below you')
    need(all(rat[i]['r'] >= 1210 + 80 for i in range(8) if (i >> 2) != (mi >> 2)), 'the other half is not well above you')
    need(await pg.evaluate("document.querySelectorAll('#cupGrid .cc.q .cs').length") == 8, 'quarter column does not show 8 slots')
    need(await pg.evaluate("document.querySelectorAll('#cupGrid .cs.me.path').length") == 1, 'your slot is not lit')
    need(await pg.evaluate("document.querySelectorAll('#cupGrid .cs img').length") >= 8, 'the slots have no portraits')
    need(await pg.evaluate("document.querySelectorAll('#cupGrid .cs-b').length") >= 8, 'the slots have no tier badges')
    card = await pg.text_content('#cupCard'); opp = c['slots'][mi ^ 1]
    need('Quarter-final' in card and opp['n'] in card, f'next opponent card: {card!r}')
    await shot(pg, tag, '1_start', errs)
    # quarter-final: win it
    t0 = p0['tokens']
    await clk('#cupGo'); await pg.wait_for_timeout(400)
    need(await pg.evaluate("document.querySelector('#pc1 .pc-tag').textContent") == 'CPU', 'cup CPU tag is not CPU')
    need(opp['n'] in await pg.text_content('#pc1 .pc-sub'), 'the CPU name is not on its card')
    need(await pg.evaluate(f"{G}.stocks") == 2, 'quarter-final is not 2 lives')
    await end_match(pg, True); await settle(pg)
    p1 = await prof(pg); c1 = p1['cup']
    need(p1['tokens'] == t0 + 15, f"chips after the quarter-final: {p1['tokens']} (want {t0 + 15})")
    need(c1['round'] == 1 and mi in c1['p'][1], 'the bracket did not advance')
    need(all(x >= 0 for x in c1['p'][1]), 'the other quarter-finals were not decided')
    need(p1['rating'] == p0['rating'] and p1['wins'] == p0['wins'] and p1['losses'] == p0['losses'], 'a cup match changed the ranked record')
    need(await pg.evaluate("document.querySelectorAll('#cupGrid .cc.s .cs.tbd').length") == 0, 'semi-final slots still undecided after the results ticked in')
    need(await pg.evaluate("document.querySelectorAll('#cupGrid .cs.me.path').length") == 2, 'your path is not lit into the semi-final')
    need('Semi-final' in await pg.text_content('#cupCard'), 'next card is not the semi-final')
    await shot(pg, tag, '2_after_quarter', errs)
    # semi-final: lose it
    await clk('#cupGo'); await pg.wait_for_timeout(400)
    need(await pg.evaluate(f"{G}.stocks") == 2, 'semi-final is not 2 lives')
    await end_match(pg, False); await settle(pg)
    p2 = await prof(pg); c2 = p2['cup']
    need(c2['out'] == 1 and p2['tokens'] == t0 + 15, 'losing the semi-final should end the cup and pay nothing')
    need(p2['rating'] == p0['rating'] and p2['wins'] == p0['wins'] and p2['losses'] == p0['losses'] and len(p2.get('history', [])) == len(p0.get('history', [])), 'a lost cup match changed the ranked record')
    need(c2['p'][3][0] >= 0, 'the cup was not played out to a champion')
    foot = await pg.text_content('#cupCard')
    need('semi-final' in foot.lower() and 'Run it back' in foot and 'Menu' in foot, f'loss strip: {foot!r}')
    need(await pg.evaluate("document.querySelectorAll('#cupGrid .cs.fell').length") == 1, 'your slot is not marked where you fell')
    await shot(pg, tag, '3_lost', errs)
    # run it back: a new cup with the same fighter
    await clk('#cfAgain'); await pg.wait_for_timeout(500); await settle(pg)
    p3 = await prof(pg); c3 = p3['cup']
    need(c3['seed'] != c['seed'] and c3['round'] == 0 and c3['out'] == -1 and c3['fid'] == 'odin', 'Run it back did not start a new cup with the same fighter')
    # menu in the middle of a cup asks first
    await clk('#cupBack'); await pg.wait_for_timeout(500)
    need('Leave the cup' in await pg.text_content('#cupCard'), 'no question when leaving a cup')
    await shot(pg, tag, '4_leave_question', errs)
    await clk('#cfKeep'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'cup', 'Keep playing left the cup')
    # a reload comes back to the bracket
    await pg.reload(); await pg.wait_for_timeout(1200)
    try: await pg.wait_for_function("window.__blastline && window.__blastline.mode === 'cup'", timeout=15000)   # a busy machine loads slowly
    except Exception: pass
    need(await pg.evaluate("window.__blastline.mode") == 'cup', 'a reload did not return to the bracket')
    need((await prof(pg))['cup']['seed'] == c3['seed'], 'the cup changed over a reload')
    await settle(pg)
    # pause > forfeit counts as a loss
    await clk('#cupGo'); await in_match(pg)
    await clk('#pauseBtn'); await pg.wait_for_timeout(300)
    need((await pg.text_content('#pQuit')).strip() == 'Forfeit' and 'cup' in (await pg.text_content('#pNote')).lower(), 'pause menu does not offer Forfeit in a cup')
    await clk('#pQuit'); await pg.wait_for_timeout(200)
    need('again' in (await pg.text_content('#pQuit')).lower(), 'forfeit is not confirmed with a second tap')
    await clk('#pQuit'); await pg.wait_for_function("window.__blastline.mode === 'cup'", timeout=20000); await settle(pg)
    c4 = (await prof(pg))['cup']
    need(c4['out'] == 0 and c4['fold'] == 1, 'a forfeit is not a loss')
    need('left the match' in (await pg.text_content('#cupCard')), 'forfeit text missing')
    # leaving a finished cup does not ask; the cup is gone from the profile
    await clk('#cfMenu'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'menu' and not (await prof(pg)).get('cup'), 'Menu after a lost cup did not clear it')
    need('8 players' in await pg.text_content('#bCup'), 'menu button label')
    # leaving a cup in progress after confirming
    await clk('#bCup'); await pg.wait_for_timeout(400); await clk('#selGo'); await pg.wait_for_timeout(400); await settle(pg)
    await clk('#cupBack'); await pg.wait_for_timeout(300); await clk('#cfLeave'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'menu' and not (await prof(pg)).get('cup'), 'Leave did not end the cup')
    await ctx.close()

async def sizes(b, tag, errs):
    """Win a whole cup (screenshots at every stage), then lose a quarter-final: at one size."""
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    ctx, pg, mob = await new_page(b, tag, vp, up, errs)
    clk = pg.tap if mob else pg.click
    await shot(pg, tag, '0_menu', errs, check=False)
    mb = await pg.evaluate("(() => { const b = document.querySelectorAll('#scrMenu .mm-col button'), r = b[b.length - 1].getBoundingClientRect(); return [r.bottom, innerHeight, b.length]; })()")
    if mb[0] > mb[1]: errs.append(f'{tag}: the menu buttons run off the bottom ({mb})')
    await clk('#bCup'); await pg.wait_for_timeout(700)
    await shot(pg, tag, '0_select', errs, check=False)
    await clk('#selGo'); await pg.wait_for_timeout(500); await settle(pg)
    await shot(pg, tag, '1_start', errs)
    t0 = (await prof(pg))['tokens']
    for r, name in enumerate(['2_after_quarter', '3_after_semi', '4_won']):
        await clk('#cupGo'); await pg.wait_for_timeout(400)
        await end_match(pg, True)
        await pg.wait_for_timeout(500); await shot(pg, tag, name + '_ticking', errs, check=False)   # mid-reveal
        await settle(pg)
        await shot(pg, tag, name, errs)
    p = await prof(pg)
    if p['tokens'] != t0 + 15 + 25 + 60 + 30: errs.append(f"{tag}: cup chips {p['tokens'] - t0}, want 130 for a flawless cup")
    if p.get('cups') != 1: errs.append(f"{tag}: cups won is {p.get('cups')}, want 1")
    n = await pg.text_content('#cupChipsN')
    if n != '130': errs.append(f'{tag}: the chip count-up ended at {n}, want 130')
    # lose a quarter-final
    await clk('#cfAgain'); await pg.wait_for_timeout(500); await settle(pg)
    await clk('#cupGo'); await pg.wait_for_timeout(400)
    await end_match(pg, False); await settle(pg)
    await shot(pg, tag, '5_lost', errs)
    p = await prof(pg)
    if p['tokens'] != t0 + 130: errs.append(f"{tag}: a lost quarter-final changed the chips ({p['tokens']})")
    await ctx.close()

async def main():
    errs = []
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    tags = ONLY or ['flow', 's667', 'p844', 'd1280', 'up390']
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for t in tags:
            print('running', t, flush=True)
            try:
                if t == 'flow': await flow(b, errs)
                else: await sizes(b, t, errs)
            except Exception as e:
                errs.append(f'{t}: {type(e).__name__}: {str(e)[:300]}')
        await b.close()
    for e in errs: print('PROBLEM', e)
    print('no errors' if not errs else f'{len(errs)} problems')
asyncio.run(main())
