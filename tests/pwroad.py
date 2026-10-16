# The Road (ui/road.js): the menu card names your stop and stars; the map opens; a locked stop says what opens it; a stop's sheet
# shows the matchup, the twist, the CPU's line and the stars; Fight plays the stop with its rules (lives each side, the time, the map,
# the start percents, the percent every life starts at); a quick win pays the three stars (+10 chips each) once, saves them, and the
# results show them; after a win Next stop walks your fighter on to the next stop and opens its sheet, after a loss Retry replays the
# stop; The Road goes back to the map; quitting from the pause menu goes to the map; the fence opens at 12 stars and the boss sheet
# starts Old Scratch on a level; his first win pays the Devil Masher title, 150 chips and the Devil's Roast skin for your fighter,
# and goes on To The Kitchen (in at its gate, walking to stop 1), a later win offers Next: Hard; The Kitchen's last stop goes on
# To Zorp.
# A second part shows the menu, the map and a sheet at each size and checks the stops sit on the screen and the card fits.
#   python3 pwroad.py [outdir [tag ...]]   tags: flow retry (844x390) s667 p740 p844 d1280 up390; no tag runs everything
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'road'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
SIZES = {'s667': (667, 320, False), 'p740': (740, 360, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = "potatobrawl.profile.v1"
G = "window.__blastline.game"
ROAD_NAMES = ['The Farm Gate', 'The Sprout Patch']

async def new_page(b, tag, vp, up, errs, prof):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, locale='en-US')
    p = dict(prof)
    if up: p['screen'] = 'up'
    await ctx.add_init_script("if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, json.dumps(json.dumps(p))))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(900)
    return ctx, pg, mob

async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }})()")
def prof_of(pg): return pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)
async def in_play(pg):
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    await pg.wait_for_timeout(300)
async def win_now(pg):
    """The CPU (slot 1) goes out on its last life."""
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000)
    await pg.wait_for_timeout(1400)
async def fresh(pg):   # the stop buttons are laid over the map on its next frame, built from the progress at that time
    await pg.wait_for_function("(() => { const r = window.__blRoad.get(); return (document.getElementById('roadHits').dataset.key || '').split(':')[2] === r.s.join('.'); })()", timeout=10000)
async def hit(pg, i):   # a tap on a stop: your fighter walks there first (if it stands elsewhere), then the sheet opens
    await fresh(pg)
    await pg.evaluate(f"document.querySelector('.rd-hit[data-i=\"{i}\"]').click()")
    await pg.wait_for_function("!window.__blRoad.walking", timeout=10000); await pg.wait_for_timeout(400)

async def flow(b, errs):
    tag = 'flow'
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, errs, {'tut': True, 'last': 'samurai', 'tokens': 5, 'mpaid': {'samurai': 10}})   # (mpaid: fighter mastery's level chips are pwmastery's to check; none here)
    clk = pg.tap if mob else pg.click
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    R = 'window.__blRoad'
    BOSS = await pg.evaluate(f"{R}.stops.length")   # the stop buttons' index for region k's boss is BOSS + k
    # ----- the menu card and the map
    need(await txt(pg, '#mRoad') == 'Stop 1 of 8 · 0 ★', f"menu card reads {await txt(pg, '#mRoad')!r}")
    await clk('#bRoad'); await pg.wait_for_timeout(500); await fresh(pg)
    need(await pg.evaluate("window.__blastline.mode") == 'road' and await shown(pg, '#scrRoad'), 'the Road card does not open the map')
    need(await txt(pg, '#roadSum') == 'Stop 1 of 8 · 0 ★', f"map summary {await txt(pg, '#roadSum')!r}")
    n = await pg.evaluate("document.querySelectorAll('.rd-hit').length")
    locked = await pg.evaluate("[...document.querySelectorAll('.rd-hit')].map((b) => b.classList.contains('lock'))")
    need(n == 9 and locked == [False] + [True] * 8, f'{n} stops, locked {locked}')
    await hit(pg, 2)
    need(await shown(pg, '#roadNote') and 'Win stop 2 first' in await txt(pg, '#roadNote'), f"locked stop note {await txt(pg, '#roadNote')!r}")
    need(not await shown(pg, '#scrRoadStop'), 'a locked stop opened its sheet')
    await hit(pg, BOSS)
    need('12 stars' in await txt(pg, '#roadNote'), f"locked fence note {await txt(pg, '#roadNote')!r}")
    # ----- stop 1's sheet and fight
    await hit(pg, 0)
    need(await shown(pg, '#scrRoadStop'), 'stop 1 has no sheet')
    need(await txt(pg, '#rsName') == 'The Farm Gate' and 'Small Fry' in await txt(pg, '#rsOp') and 'Samurai' in await txt(pg, '#rsMe'), f"sheet reads {await txt(pg, '#roadStopSheet')!r}")
    need(await txt(pg, '#rsRule') == '2 lives each · 2:00 · The Field', f"rule line {await txt(pg, '#rsRule')!r}")
    need(await pg.evaluate("[...document.querySelectorAll('#rsStars .rd-st')].map((s) => s.textContent)") == ['★Win', '★No heart lost', '★Win in under 60 s'], 'stop 1 star labels')
    # your card is the fighter picker (no Fighter button): it opens the fighter page; Back returns to the map
    need(await pg.evaluate("[...document.querySelectorAll('.rd-acts button')].filter((b) => !b.hidden).length") == 2 and await txt(pg, '#rsGo') == 'Fight', f"stop buttons {await txt(pg, '.rd-acts')!r}")   # Team up: a boss's, online only
    await clk('#rsMe'); await pg.wait_for_timeout(600)
    need(await pg.evaluate("window.__blastline.mode") == 'select' and not await shown(pg, '#scrRoadStop'), 'tapping your card does not open the fighter page')
    await clk('#selBack'); await pg.wait_for_timeout(600)
    need(await pg.evaluate("window.__blastline.mode") == 'road', 'Back on the fighter page does not return to the map')
    await hit(pg, 0)
    await clk('#rsGo')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    st = await pg.evaluate(f"(() => {{ const g = {G}; return {{ map: BL.MAPS[g.map].id, time: g.timer / 60, st: g.fighters.map((f) => f.stocks), op: g.fighters[1].spec.id, me: g.fighters[0].spec.id }}; }})()")
    need(st == {'map': 'field', 'time': 120, 'st': [2, 2], 'op': 'phoenix', 'me': 'samurai'}, f'stop 1 setup {st}')
    need('Small Fry' in await txt(pg, '#pc1'), 'the CPU card does not name Small Fry')
    await in_play(pg)
    await win_now(pg)
    need(await txt(pg, '#rTitle') == 'Victory' and await txt(pg, '#rMode') == 'The Road · The Field · stop 1 · The Farm Gate', f"results {await txt(pg, '#rTitle')!r} {await txt(pg, '#rMode')!r}")
    stars = await pg.evaluate("[...document.querySelectorAll('#rStars .rd-st')].map((s) => s.className)")
    need(stars == ['rd-st on new'] * 3, f'result stars {stars}')
    need(await txt(pg, '#rChipN') == '30' and '3 new stars +30' in await txt(pg, '#rWhy'), f"chips {await txt(pg, '#rChipN')} / {await txt(pg, '#rWhy')!r}")
    p = await prof_of(pg)
    need(p.get('road', {}).get('s') == [7] and p.get('tokens') == 35, f"saved road {p.get('road')} tokens {p.get('tokens')}")
    need(await txt(pg, '#rAgain') == 'Next stop' and await txt(pg, '#rChange') == 'The Road', f"buttons after a win {await txt(pg, '#rAgain')!r} {await txt(pg, '#rChange')!r}")
    await pg.screenshot(path=f'{OUT}/flow_win.png')
    # Next stop: the map, your fighter walks from stop 1 to stop 2, then stop 2's sheet opens
    await clk('#rAgain')
    await pg.wait_for_function("window.__blastline.mode === 'road'", timeout=10000)
    walked = await pg.evaluate("new Promise((ok) => { const seen = []; const t = setInterval(() => { seen.push(window.__blRoad.pos); if (!window.__blRoad.walking) { clearInterval(t); ok(seen); } }, 50); })")
    need(len(walked) > 1 and min(walked) < 1 and walked[-1] == 1, f'no walk from stop 1 to stop 2: {walked}')
    await pg.wait_for_timeout(400)
    need(await shown(pg, '#scrRoadStop') and await txt(pg, '#rsName') == ROAD_NAMES[1], f"Next stop opened {await txt(pg, '#rsName')!r}")
    await pg.screenshot(path=f'{OUT}/flow_next.png')
    await clk('#rsBack'); await pg.wait_for_timeout(300)
    # a tap on stop 1: the fighter walks back there before its sheet opens
    await hit(pg, 0)
    need(await pg.evaluate("window.__blRoad.pos") == 0 and await txt(pg, '#rsName') == ROAD_NAMES[0], f"tap on stop 1: pos {await pg.evaluate('window.__blRoad.pos')}, sheet {await txt(pg, '#rsName')!r}")
    await clk('#rsBack'); await pg.wait_for_timeout(300)
    # a loss keeps Retry: the same stop again; winning it again pays nothing new and offers the next stop
    await pg.evaluate(f"{R}.fight(0)"); await in_play(pg)
    await pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; f.stocks = 1; f.x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000); await pg.wait_for_timeout(1400)
    need(await txt(pg, '#rTitle') == 'Defeat' and await txt(pg, '#rAgain') == 'Retry', f"after a loss {await txt(pg, '#rTitle')!r} {await txt(pg, '#rAgain')!r}")
    await clk('#rAgain')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    need(await pg.evaluate(f"{G}.fighters[1].spec.id") == 'phoenix', 'Retry is not the same stop')
    await in_play(pg); await win_now(pg)
    need(await txt(pg, '#rChipN') == '0' or not await shown(pg, '#rChipT'), 'a second win paid chips again')
    need('Three stars again' in await txt(pg, '#rWhy') and await txt(pg, '#rAgain') == 'Next stop', f"why {await txt(pg, '#rWhy')!r} / {await txt(pg, '#rAgain')!r}")
    await clk('#rChange'); await pg.wait_for_timeout(700)
    need(await pg.evaluate("window.__blastline.mode") == 'road' and await txt(pg, '#roadSum') == 'Stop 2 of 8 · 3 ★', f"back on the map: {await txt(pg, '#roadSum')!r}")
    # ----- the twists: stop 2 (Mash at 40%), stop 3 (you start at 20%, the next life at 0%), stop 7 (you start at 20% on Potato Moon),
    #       The Deep's stop 2 (you start every life at 10%); a pause-menu quit goes to the map
    await pg.evaluate(f"{R}.fight(1)"); await in_play(pg)
    s2 = await pg.evaluate(f"[{G}.fighters[0].percent, {G}.fighters[1].percent, Math.ceil({G}.timer / 60), BL.MAPS[{G}.map].id]")
    need(s2 == [0, 40, 120, 'field'], f'stop 2: Mash does not start at 40%: {s2}')
    await clk('#pauseBtn'); await pg.wait_for_timeout(300)
    await clk('#pQuit'); await pg.wait_for_timeout(600)
    need(await pg.evaluate("window.__blastline.mode") == 'road', 'quitting a stop does not go back to the map')
    # open stops 3 and 7 for the test (stars set as a synced profile would bring them)
    await pg.evaluate(f"{R}.set([7, 1, 1, 1, 1, 1, 0, 0])")
    await pg.evaluate(f"{R}.fight(2)"); await in_play(pg)
    need(await pg.evaluate(f"[{G}.fighters[0].percent, {G}.fighters[0].lifePct, {G}.fighters[1].spec.id]") == [20, 0, 'reaper'], 'stop 3: you do not start at 20%')
    await pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; f.x = 5000; }})()")
    await pg.wait_for_function(f"{G}.fighters[0].state === 'respawn' || ({G}.fighters[0].stocks === 2 && {G}.fighters[0].state !== 'dead')", timeout=30000)
    await pg.wait_for_timeout(300)
    need(await pg.evaluate(f"{G}.fighters[0].percent") == 0, f"stop 3: the second life starts at {await pg.evaluate(f'{G}.fighters[0].percent')}%")
    await pg.evaluate(f"{R}.fight(6)"); await in_play(pg)
    need(await pg.evaluate(f"[{G}.fighters.map((f) => f.stocks), {G}.fighters[0].percent, BL.MAPS[{G}.map].id]") == [[3, 3], 20, 'moon'], 'stop 7: not 3 lives each at 20% on Potato Moon')
    await clk('#pauseBtn'); await pg.wait_for_timeout(300); await clk('#pQuit'); await pg.wait_for_timeout(600)
    # The Deep's stop 2 (opened as a synced profile would: Old Scratch and Zorp beaten, its stop 1 won): every life starts at 10%
    await pg.evaluate(f"{R}.set({[7] * 16 + [1]}, {{ b: 1, paid: true, b2: 1, p2: true }})")
    await pg.evaluate(f"{R}.fight(17)"); await in_play(pg)
    need(await pg.evaluate(f"[{G}.fighters[0].percent, {G}.fighters[0].lifePct, {G}.fighters[1].spec.id, BL.MAPS[{G}.map].id]") == [10, 10, 'gunslinger', 'bay'], 'The Deep stop 2: you do not start every life at 10%')
    await pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; f.x = 5000; }})()")
    await pg.wait_for_function(f"{G}.fighters[0].state === 'respawn' || ({G}.fighters[0].stocks === 2 && {G}.fighters[0].state !== 'dead')", timeout=30000)
    await pg.wait_for_timeout(300)
    need(await pg.evaluate(f"{G}.fighters[0].percent") == 10, f"The Deep stop 2: the second life starts at {await pg.evaluate(f'{G}.fighters[0].percent')}%")
    await clk('#pauseBtn'); await pg.wait_for_timeout(300); await clk('#pQuit'); await pg.wait_for_timeout(600)
    await pg.evaluate(f"{R}.set([], {{ b: 0, paid: false, b2: 0, p2: false }})")   # back to a Road with no boss beaten
    # stop 8 won with the fence still shut: no Next stop, the results say how many stars are missing
    await pg.evaluate(f"{R}.set([1, 1, 1, 1, 1, 1, 1, 0])")
    await pg.evaluate(f"{R}.fight(7)"); await in_play(pg); await win_now(pg)
    need(await txt(pg, '#rAgain') == 'Retry' and 'open the fence' in await txt(pg, '#rWhy'), f"after stop 8 below 12 stars: {await txt(pg, '#rAgain')!r} / {await txt(pg, '#rWhy')!r}")
    await clk('#rChange'); await pg.wait_for_timeout(600)
    # ----- the fence: 12 stars open it; the boss sheet; the first win pays the title and 150 chips
    await pg.evaluate(f"{R}.set([7, 7, 7, 7, 0, 0, 0, 0])")
    await pg.evaluate(f"{R}.open()"); await fresh(pg)
    need(not await pg.evaluate(f"document.querySelector('.rd-hit[data-i=\"{BOSS}\"]').classList.contains('lock')"), 'the fence stays locked at 12 stars')
    await hit(pg, BOSS)
    # the level stars pick the level (the first one not won yet), Fight plays it; both fit on a phone without scrolling
    need(await pg.evaluate("[...document.querySelectorAll('#rsStars .rd-lvb')].map((b) => b.textContent)") == ['★Normal', '★Hard', '★Nightmare'], 'boss level stars')
    need(await txt(pg, '#rsGo') == 'Fight · Normal' and await pg.evaluate("document.querySelector('#rsStars .rd-lvb.sel').dataset.q") == '0', f"boss Fight button {await txt(pg, '#rsGo')!r}")
    need(await pg.evaluate(ONSCREEN % '#rsGo') and await pg.evaluate(ONSCREEN % '#rsStars .rd-lvb[data-q=\"2\"]'), 'the boss Fight button or a level is off the screen')
    await clk('#rsStars .rd-lvb[data-q="1"]'); await pg.wait_for_timeout(200)
    need(await txt(pg, '#rsGo') == 'Fight · Hard' and await pg.evaluate("document.querySelector('#rsStars .rd-lvb[data-q=\"1\"]').getAttribute('aria-pressed')") == 'true', f"picking Hard: {await txt(pg, '#rsGo')!r}")
    await clk('#rsStars .rd-lvb[data-q="0"]'); await pg.wait_for_timeout(200)
    need('Devil Masher' in await txt(pg, '#rsReward'), f"boss reward line {await txt(pg, '#rsReward')!r}")
    await pg.screenshot(path=f'{OUT}/flow_boss_sheet.png')
    tok0 = (await prof_of(pg)).get('tokens')
    await clk('#rsGo')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    need(await pg.evaluate(f"{G}.fighters.length === 3 && {G}.lv === 0"), 'the boss fight did not start on Normal')
    # on the Road he is tougher than in Practice: x0.9 HP (Practice x0.75)
    need(await pg.evaluate(f"{G}.fighters[2].hpMax === Math.round(BL.BOSSES[0].boss.hp * BL.BOSSES[0].boss.lvHp[0] * 0.9)"), f"Road Old Scratch HP {await pg.evaluate(f'{G}.fighters[2].hpMax')}")
    await in_play(pg)
    await pg.evaluate(f"(() => {{ const b = {G}.fighters[2]; b.hp = 1; b.poise = 0; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=180000)
    await pg.wait_for_timeout(1400)
    need(await txt(pg, '#rMode') == 'The Road · Old Scratch · Normal', f"boss results mode {await txt(pg, '#rMode')!r}")
    need('Devil Masher title + 150' in await txt(pg, '#rWhy') and await txt(pg, '#rChipN') == '160', f"boss reward {await txt(pg, '#rWhy')!r} {await txt(pg, '#rChipN')}")
    p = await prof_of(pg)
    need(p['road']['b'] == 1 and p['road']['paid'] is True and p['tokens'] == tok0 + 160, f"saved boss win {p['road']} tokens {p['tokens']} (was {tok0})")
    # the win gives the fighter you played his Road skin (Devil's Roast), owned and saved
    me, rs = await pg.evaluate(f"(() => {{ const s = {G}.fighters[0].spec; return [s.id, s.palettes.findIndex((q) => q.road === 'scratch')]; }})()")
    need(rs > 0 and rs in (p.get('owned') or {}).get(me, []) and "Devil's Roast skin for" in await txt(pg, '#rWhy'), f"Road skin {me} #{rs}: owned {(p.get('owned') or {}).get(me)} / {await txt(pg, '#rWhy')!r}")
    need(await txt(pg, '#rAgain') == 'To The Kitchen', f"after his first win the button reads {await txt(pg, '#rAgain')!r}")
    await pg.screenshot(path=f'{OUT}/flow_boss_win.png')
    # To The Kitchen: the map shows region 2, your fighter comes in at its gate and walks to stop 1, whose sheet opens
    await clk('#rAgain')
    await pg.wait_for_function("window.__blastline.mode === 'road'", timeout=10000)
    walked = await pg.evaluate("new Promise((ok) => { const seen = []; const t = setInterval(() => { seen.push(window.__blRoad.pos); if (!window.__blRoad.walking) { clearInterval(t); ok(seen); } }, 50); })")
    need(len(walked) > 1 and min(walked) < 0 and walked[-1] == 0, f'no walk in from the Kitchen gate: {walked}')
    await pg.wait_for_timeout(400)
    need(await txt(pg, '#roadReg') == 'The Kitchen' and await shown(pg, '#scrRoadStop') and await txt(pg, '#rsName') == 'The Back Door', f"To The Kitchen opened {await txt(pg, '#roadReg')!r} / {await txt(pg, '#rsName')!r}")
    await pg.screenshot(path=f'{OUT}/flow_kitchen.png')
    await clk('#rsBack'); await pg.wait_for_timeout(300)
    await clk('#roadPrev'); await pg.wait_for_timeout(400)
    need(await txt(pg, '#roadSum') == 'Stop 5 of 8 · 13 ★', f"map summary after the boss {await txt(pg, '#roadSum')!r}")
    # a later Normal win offers the next level
    await pg.evaluate(f"{R}.boss(0, 0)"); await in_play(pg)
    await pg.evaluate(f"(() => {{ const b = {G}.fighters[2]; b.hp = 1; b.poise = 0; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=180000); await pg.wait_for_timeout(1400)
    need(await txt(pg, '#rAgain') == 'Next: Hard', f"after a second Normal win the button reads {await txt(pg, '#rAgain')!r}")
    # The Kitchen's last stop won with its fence open: To Zorp walks to the boss and opens his sheet
    await pg.evaluate(f"{R}.set({[7] * 15 + [0]})")
    await pg.evaluate(f"{R}.fight(15)"); await in_play(pg); await win_now(pg)
    need(await txt(pg, '#rMode') == 'The Road · The Kitchen · stop 8 · The Window' and await txt(pg, '#rAgain') == 'To Zorp', f"after the Kitchen's stop 8: {await txt(pg, '#rMode')!r} / {await txt(pg, '#rAgain')!r}")
    await clk('#rAgain')
    await pg.wait_for_function("window.__blastline.mode === 'road' && !window.__blRoad.walking", timeout=10000); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blRoad.pos") == 8 and await txt(pg, '#rsName') == 'Zorp' and await txt(pg, '#rsGo') == 'Fight · Normal', f"To Zorp: pos {await pg.evaluate('window.__blRoad.pos')}, sheet {await txt(pg, '#rsName')!r}")
    await pg.screenshot(path=f'{OUT}/flow_zorp_sheet.png')
    await ctx.close()

# Retry beside Next stop, and the combo stars' combo: a win with a star missing shows Retry (its second line names the first star
# missing) and Retry plays the same stop; three stars hide it; a boss win shows it beside Next: Hard; a combo stop's sheet names the
# combo and its buttons, your fighter's own combo follows the fighter, a tap opens the Combo trial on that combo and its Back (and the
# pause menu) return to the stop's sheet; the results show the chips on a missed combo star.
async def retry(b, errs):
    tag = 'retry'
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, errs, {'tut': True, 'last': 'samurai', 'tokens': 5, 'mpaid': {'samurai': 10}})
    clk = pg.tap if mob else pg.click
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    R = 'window.__blRoad'
    T = 'window.__blastline.trial'
    # stop 1 with three stars: Next stop takes the whole row, no Retry
    await pg.evaluate(f"{R}.fight(0)"); await in_play(pg); await win_now(pg)
    need(await txt(pg, '#rAgain') == 'Next stop' and not await shown(pg, '#rRetry'), f"three stars: {await txt(pg, '.res-actions')!r}")
    one = await pg.evaluate("(() => { const a = document.getElementById('rAgain').getBoundingClientRect(), r = document.querySelector('.res-actions').getBoundingClientRect(); return a.width > r.width * 0.9; })()")
    need(one, 'with three stars Next stop does not span the row')
    # stop 2 (the Three-piece combo) won with a heart lost: Retry beside Next stop names it; the missed combo star shows its chips
    await pg.evaluate(f"{R}.fight(1)"); await in_play(pg)
    await pg.evaluate(f"{G}.fighters[0].falls = 1")
    await win_now(pg)
    need(await txt(pg, '#rAgain') == 'Next stop' and await shown(pg, '#rRetry') and await txt(pg, '#rRetrySub') == '★ No heart lost', f"a star missing: {await txt(pg, '.res-actions')!r}")
    lay = await pg.evaluate("""(() => { const q = (id) => document.getElementById(id).getBoundingClientRect(), a = q('rAgain'), r = q('rRetry'), c = q('rChange'), m = q('rMenu');
      return { row: Math.abs(a.top - r.top) < 2 && r.left > a.right - 1, ratio: Math.round(a.width / r.width * 10) / 10, cols: Math.abs(c.left - a.left) < 2 && Math.abs(m.left - r.left) < 2 && c.top > a.bottom - 1 }; })()""")
    need(lay['row'] and lay['cols'] and 1.4 <= lay['ratio'] <= 1.8, f'Retry layout {lay}')
    miss = await pg.evaluate("(() => { const s = document.querySelector('#rStars .rd-stk'); return s ? [s.querySelector('small').textContent, s.querySelectorAll('.rk').length] : null; })()")
    need(miss == ['Three-piece', 3], f'missed combo star on the results: {miss}')
    await pg.screenshot(path=f'{OUT}/retry_win.png')
    await clk('#rRetry')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    need(await pg.evaluate(f"window.__blastline.game.fighters[1].spec.id") == 'odin' and 'Mash' in await txt(pg, '#pc1'), 'Retry does not replay stop 2')
    await in_play(pg); await win_now(pg)
    # the combo line on the stop's sheet: name and buttons; a tap opens the Combo trial on it, Back returns to the sheet
    await clk('#rChange'); await pg.wait_for_timeout(700)
    await hit(pg, 1)
    need(await shown(pg, '#rsCombo') and await txt(pg, '#rsCombo .rd-cn') == 'Three-piece' and await pg.evaluate("document.querySelectorAll('#rsCombo .rk').length") == 3, f"combo line {await txt(pg, '#rsCombo')!r}")
    need(await pg.evaluate(ONSCREEN % '#rsComboGo'), 'the combo line is off the screen or under Fight')
    await pg.screenshot(path=f'{OUT}/retry_sheet_combo.png')
    await clk('#rsComboGo')
    await pg.wait_for_function(f"window.__blastline.mode === 'match' && !!{T}", timeout=20000)
    tr = await pg.evaluate(f"{T}.id")
    need(tr == 'three' and await txt(pg, '#tutSkip') == 'Back' and await pg.evaluate(f"{G}.fighters[0].spec.id") == 'samurai', f"the trial opened on {tr!r}, its button reads {await txt(pg, '#tutSkip')!r}")
    await clk('#tutSkip')
    await pg.wait_for_function("window.__blastline.mode === 'road' && !window.__blRoad.walking", timeout=10000); await pg.wait_for_timeout(400)
    need(await shown(pg, '#scrRoadStop') and await txt(pg, '#rsName') == ROAD_NAMES[1] and not await shown(pg, '#tut'), f"Back from the trial: sheet {await txt(pg, '#rsName')!r}")
    # the pause menu's quit goes back to the stop too
    await clk('#rsComboGo'); await pg.wait_for_function(f"window.__blastline.mode === 'match' && !!{T}", timeout=20000); await pg.wait_for_timeout(300)
    await clk('#pauseBtn'); await pg.wait_for_timeout(300)
    need(await txt(pg, '#pQuit') == 'Back to the Road', f"the trial's pause quit reads {await txt(pg, '#pQuit')!r}")
    await clk('#pQuit')
    await pg.wait_for_function("window.__blastline.mode === 'road' && !window.__blRoad.walking", timeout=10000); await pg.wait_for_timeout(400)
    need(await shown(pg, '#scrRoadStop') and await txt(pg, '#rsName') == ROAD_NAMES[1], 'the pause menu does not return to the stop')
    await clk('#rsBack'); await pg.wait_for_timeout(300)
    # a stop without a combo star has no combo line
    await hit(pg, 2)
    need(not await shown(pg, '#rsCombo'), 'a finisher stop shows a combo line')
    await clk('#rsBack'); await pg.wait_for_timeout(300)
    # your fighter's own combo (The Kitchen's stop 7): Samurai's Blink Cut; after a change of fighter, Odin's Hammer Fall
    own = await pg.evaluate(f"{R}.stops.findIndex((s) => s.bonus.r === 'own')")
    await pg.evaluate(f"{R}.set({[7] * 14}, {{ b: 1, paid: true }})"); await pg.evaluate(f"{R}.region(1)"); await fresh(pg)
    await hit(pg, own)
    need(await txt(pg, '#rsCombo .rd-cn') == 'Blink Cut', f"own combo for Samurai {await txt(pg, '#rsCombo')!r}")
    await clk('#rsMe'); await pg.wait_for_timeout(600)
    await clk('#tiles .tile[data-id="odin"]'); await pg.wait_for_timeout(300)
    await clk('#selBack'); await pg.wait_for_timeout(600); await fresh(pg)
    await hit(pg, own)
    need(await txt(pg, '#rsCombo .rd-cn') == 'Hammer Fall' and 'hold' in await txt(pg, '#rsCombo'), f"own combo after the change to Odin {await txt(pg, '#rsCombo')!r}")
    await clk('#rsBack'); await pg.wait_for_timeout(300)
    # a boss win: Retry beside Next: Hard replays the level just won
    await pg.evaluate(f"{R}.set([7, 7, 7, 7, 0, 0, 0, 0], {{ b: 0, paid: false }})")
    await pg.evaluate(f"{R}.boss(0, 0)"); await in_play(pg)
    await pg.evaluate(f"(() => {{ const b = {G}.fighters[2]; b.hp = 1; b.poise = 0; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=180000); await pg.wait_for_timeout(1400)
    await pg.evaluate(f"{R}.boss(0, 0)"); await in_play(pg)   # the second win: the button reads Next: Hard (the first goes To The Kitchen)
    await pg.evaluate(f"(() => {{ const b = {G}.fighters[2]; b.hp = 1; b.poise = 0; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=180000); await pg.wait_for_timeout(1400)
    need(await txt(pg, '#rAgain') == 'Next: Hard' and await txt(pg, '#rRetry span') == 'Retry' and await txt(pg, '#rRetrySub') == 'Normal', f"boss win buttons {await txt(pg, '.res-actions')!r}")
    await pg.screenshot(path=f'{OUT}/retry_boss.png')
    await clk('#rRetry')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    need(await pg.evaluate(f"{G}.fighters.length === 3 && {G}.lv === 0"), 'Retry after a boss win is not the same level')
    await ctx.close()

# on the screen and not covered (by the sticky button row, say): the element's centre hits the element itself
ONSCREEN = "(() => { const e = document.querySelector('%s'), r = e.getBoundingClientRect(), h = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && !!h && e.contains(h); })()"
FIT = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight;
  const m = document.querySelector('.rd-map').getBoundingClientRect();
  for (const b of document.querySelectorAll('.rd-hit')) { const r = b.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
    if (x < m.left || x > m.right || y < m.top || y > m.bottom) bad.push('stop ' + b.dataset.i + ' is off the map'); }
  return bad;
})()"""
CARD = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight, r = document.querySelector('#bRoad').getBoundingClientRect();
  if (r.left < -0.5 || r.right > vw + 0.5 || r.top < -0.5 || r.bottom > vh + 0.5) bad.push('the Road card runs off the screen');
  if (r.width < 120 || r.height < 60) bad.push('the Road card is tiny: ' + Math.round(r.width) + 'x' + Math.round(r.height));
  for (const s of ['#scrMenu .mm-col', '#scrMenu .mm-bar .mm-topr', '#scrMenu .mm-live']) {
    const e = document.querySelector(s); if (!e || !e.getClientRects().length) continue; const q = e.getBoundingClientRect();
    if (r.left < q.right - 1 && r.right > q.left + 1 && r.top < q.bottom - 1 && r.bottom > q.top + 1) bad.push('the Road card overlaps ' + s);
  }
  const t = document.querySelector('#mRoad'); if (t.scrollWidth > t.clientWidth + 1) bad.push('the stop line is cut off');
  return bad;
})()"""

async def size(b, tag, errs):
    vp = SIZES[tag]
    ctx, pg, mob = await new_page(b, tag, vp[:2], vp[2], errs, {'tut': True, 'last': 'reaper', 'road': {'s': [7, 3, 1, 5], 'b': 0, 'paid': False}})
    bad = await pg.evaluate(CARD)
    if bad: errs.append(f'{tag} menu: ' + '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/{tag}_menu.png')
    await pg.evaluate("document.querySelector('#bRoad').click()"); await pg.wait_for_timeout(600); await fresh(pg)
    bad = await pg.evaluate(FIT)
    if bad: errs.append(f'{tag} map: ' + '; '.join(bad))
    await pg.screenshot(path=f'{OUT}/{tag}_map.png')
    await hit(pg, 4)
    sh = await pg.evaluate("(() => { const r = document.querySelector('#roadStopSheet').getBoundingClientRect(); return r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5; })()")
    if not sh:
        sc = await pg.evaluate("(() => { const s = document.querySelector('#roadStopSheet'); return s.scrollHeight > s.clientHeight; })()")
        if not sc: errs.append(f'{tag}: the stop sheet does not fit and does not scroll')
    if not await pg.evaluate(ONSCREEN % '#rsGo'): errs.append(f'{tag}: the stop sheet\'s Fight button is off the screen')
    await pg.screenshot(path=f'{OUT}/{tag}_sheet.png')
    # a combo stop (stop 4, Lift & Smash): the combo line sits above Fight, not under it, and fits the sheet
    await pg.evaluate("document.getElementById('rsBack').click()"); await pg.wait_for_timeout(300)
    await hit(pg, 3)
    if not await pg.evaluate(ONSCREEN % '#rsComboGo'): errs.append(f'{tag}: the combo line is off the screen or under Fight')
    if await pg.evaluate("(() => { const c = document.getElementById('rsComboGo').getBoundingClientRect(), s = document.querySelector('#roadStopSheet .sh-body').getBoundingClientRect(); return c.left < s.left - 0.5 || c.right > s.right + 0.5; })()"):
        errs.append(f'{tag}: the combo line is wider than the sheet')
    await pg.screenshot(path=f'{OUT}/{tag}_sheet_combo.png')
    # the boss's sheet: the level stars and Fight are on the screen without scrolling
    await pg.evaluate("document.getElementById('rsBack').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("window.__blRoad.set([7, 7, 7, 7, 0, 0, 0, 0])"); await pg.evaluate("window.__blRoad.open()"); await fresh(pg)
    await hit(pg, await pg.evaluate("window.__blRoad.stops.length"))   # region 1's boss
    for sel in ('#rsGo', '#rsStars .rd-lvb[data-q="0"]', '#rsStars .rd-lvb[data-q="2"]'):
        if not await pg.evaluate(ONSCREEN % sel): errs.append(f'{tag}: {sel} is off the screen on the boss sheet')
    await pg.screenshot(path=f'{OUT}/{tag}_boss_sheet.png')
    await ctx.close()

async def main():
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        if not ONLY or 'flow' in ONLY: await flow(b, errs)
        if not ONLY or 'retry' in ONLY: await retry(b, errs)
        for tag in SIZES:
            if not ONLY or tag in ONLY: await size(b, tag, errs)
        await b.close()
    for e in errs: print('ERROR', e)
    if not errs: print('no errors')
if __name__ == "__main__": asyncio.run(main())
