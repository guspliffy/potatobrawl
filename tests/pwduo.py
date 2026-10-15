# Team Brawl 2v2 in the browser: the Practice picker, the four-card HUD, Focus, the team rims and the results (UI only; the rules are tests/duo.js).
# Part 1, "flow" (844x390 touch): Practice > VS lists "Team Brawl 2v2" first and the VS chip names it; the Partner chip appears (Random + the eight
#   fighters) and only for it; the map list keeps to the random pool (and is whole again for a 1v1); the level list stays the CPU levels. Fight
#   starts a 2v2: four fighters (teams 0, 0, 1, 1), the partner you picked, a pool map. The HUD has four cards: yours full size, the partner's mini
#   card under it, the two foes' mini cards on the right, team-colour edges, tags You / Partner / CPU. A tap on a foe card focuses that foe (ember
#   ring on that card), a tap on the other moves it, the pause icon still works. Only a FOE crossing the finish percent shows the Finish banner (in
#   your colour) and lights the Special button; the ulti bar on a mini card is a thin line. Then the end is forced as in the smoke check (one foe gone,
#   the other at 400% with one heart): the KO page, the results say "Team Brawl 2v2", and a 1v1 afterwards has the old two cards back.
# Part 2, one run per size (667x320, 844x390, 1280x760, upright 390x844): the select header fits with the Partner chip (nothing overlaps, nothing
#   runs off the screen, the VS list fits the screen), the fight's HUD fits (four cards, the clock and the pause icon: inside the screen, none over
#   another; the foe cards take taps, the others do not; upright phones show hearts + percent only), the team rims are drawn (ice blue and ember red
#   pixels on the canvas), pictures of the select screen, the fight, the HUD with Focus + finish + ulti, a Catch and the results.
#   python3 pwduo.py [outdir [tag ...]]   tags: flow s667 p844 d1280 up390; no tag runs everything. Prints "no errors" when all passed.
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'duo'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = "potatobrawl.profile.v1"
G = "window.__blastline.game"
ICE, EMBER = (127, 212, 255), (255, 106, 74)   # ui/duo.js TEAM_COL

async def new_page(b, tag, vp, up, errs):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, locale='en-US')
    p = {'tut': True, 'last': 'samurai', 'duoTip': 3}   # duoTip 3: the first-matches tip banner has been shown (it would cover the pictures)
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

# the Team Brawl 2v2 entry of the VS list (the last button in the list, so the older tests that pick a fighter by position keep working; it sits first on screen)
DUO_CLICK = "[...document.querySelectorAll('#oppPop button')].find((b) => b.textContent.endsWith('Team Brawl 2v2')).click()"
# Practice > VS > Team Brawl 2v2
async def pick_duo(pg, clk):
    await clk('#bPractice'); await pg.wait_for_timeout(500)
    await clk('#oppPick'); await pg.wait_for_timeout(250)
    await pg.evaluate(DUO_CLICK); await pg.wait_for_timeout(250)

# the select header with the four chips: every chip, the title block, the back button and the chips coin are on screen and none is over another
SELFIT = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight, R = (s) => document.querySelector(s).getBoundingClientRect();
  const parts = [['VS chip', '#oppPick'], ['CPU chip', '#lvlPick'], ['Map chip', '#mapPick'], ['Partner chip', '#matePick'], ['back', '#selBack'], ['chips', '.sl-coin'], ['title', '.sl-ttl']];
  const rs = parts.map(([n, s]) => [n, R(s)]);
  for (const [n, r] of rs) {
    if (r.width < 8 || r.height < 8) bad.push(n + ' has no size');
    if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) bad.push(n + ' runs off the screen ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
  }
  // the chips are skewed 8 degrees: their boxes reach about 3 px past the drawn shape on each side, so 4 px of slack when comparing
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i][1], b = rs[j][1];
    if (a.left < b.right - 4 && b.left < a.right - 4 && a.top < b.bottom - 4 && b.top < a.bottom - 4) bad.push(rs[i][0] + ' overlaps ' + rs[j][0]);
  }
  for (const id of ['lvlPick']) { const s = document.querySelector('#' + id + ' span'); if (s.scrollWidth > s.clientWidth + 1) bad.push('the CPU level is cut off'); }
  return bad;
})()"""
# the open VS list: on screen
POPFIT = """(() => { const r = document.querySelector('#oppPop').getBoundingClientRect(), bad = [];
  if (r.bottom > innerHeight + 0.5 || r.top < 0) bad.push('the VS list runs off the bottom of the screen: ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' of ' + innerHeight);
  if (r.right > innerWidth + 0.5 || r.left < -0.5) bad.push('the VS list runs off the side: ' + Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + innerWidth);
  return bad; })()"""

# the fight's HUD: four cards, the clock and the pause icon on screen and clear of each other; taps reach only the two foe cards
HUDFIT = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight, app = document.querySelector('#app'), up = app.classList.contains('narrow');
  const E = (s) => document.querySelector(s), R = (s) => E(s).getBoundingClientRect();
  if (!app.classList.contains('duo')) bad.push('#app has no duo class');
  const ids = ['#pc0', '#pc1', '#pc2', '#pc3', '#clock', '#pauseBtn'], rs = ids.map((s) => [s, E(s) ? R(s) : null]);
  for (const [s, r] of rs) {
    if (!r || r.width < 8 || r.height < 8) { bad.push(s + ' is not on screen'); continue; }
    if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) bad.push(s + ' runs off the screen ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
  }
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i][1], b = rs[j][1]; if (!a || !b) continue;
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) bad.push(rs[i][0] + ' overlaps ' + rs[j][0]);
  }
  const p0 = R('#pc0'), p1 = R('#pc1'), p2 = R('#pc2'), p3 = R('#pc3'), clk = R('#clock'), pb = R('#pauseBtn');
  if (!(p1.top >= p0.bottom - 1 && p1.left < p0.right)) bad.push('the partner card is not under yours');
  if (!(p2.left > vw / 2 && p3.left > vw / 2 && p3.top >= p2.bottom - 1)) bad.push('the foe cards are not stacked on the right');
  if (!(pb.top >= p3.bottom - 1)) bad.push('the pause icon is not under the foe cards');
  if (Math.abs(clk.left + clk.width / 2 - vw / 2) > 3) bad.push('the clock is not in the middle (' + Math.round(clk.left + clk.width / 2) + ' of ' + vw + ')');
  const us = E('#pc0 .pc-ult').getBoundingClientRect();
  if (us.bottom > p1.top + 1) bad.push('the full card ulti bar reaches the partner card');
  for (const s of ['#pc1', '#pc2', '#pc3']) {
    const u = E(s + ' .pc-ult'), q = u.getBoundingClientRect(), c = R(s);
    if (q.height > 4.5) bad.push(s + ': the mini ulti bar is ' + q.height + ' px high (a thin line)');
    if (q.bottom > c.bottom + 1 || q.top < c.bottom - 8) bad.push(s + ': the mini ulti bar is not along the bottom edge');
    if (!(E(s + ' .pc-pct').getClientRects().length && E(s + ' .pc-stocks').getClientRects().length)) bad.push(s + ': no hearts or percent');
  }
  const hit = (s) => { const r = R(s), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.closest(s) ? s : (e ? e.id || e.className : 'nothing'); };
  if (hit('#pc2') !== '#pc2' || hit('#pc3') !== '#pc3') bad.push('a foe card does not take taps: ' + hit('#pc2') + ' / ' + hit('#pc3'));
  if (hit('#pauseBtn') !== '#pauseBtn') bad.push('the pause icon does not take taps: ' + hit('#pauseBtn'));
  for (const s of ['#pc0', '#pc1']) if (getComputedStyle(E(s)).pointerEvents !== 'none') bad.push(s + ' takes pointer events');
  const top = (s) => getComputedStyle(E(s + ' .pc-top')).display;
  if (up) { for (const s of ['#pc1', '#pc2', '#pc3']) if (top(s) !== 'none') bad.push(s + ' shows its name on the upright phone'); }
  else for (const s of ['#pc1', '#pc2', '#pc3']) if (top(s) === 'none') bad.push(s + ' has no name line');
  if (!up && app.classList.contains('tiny') && p2.height > p0.height * 0.7) bad.push('a mini card is ' + Math.round(100 * p2.height / p0.height) + '% of the full card on the 320 px phone');
  const rgb = (s, k) => getComputedStyle(E(s))[k];
  for (const s of ['#pc0', '#pc1']) if (rgb(s, 'borderLeftColor') !== 'rgb(127, 212, 255)') bad.push(s + ' edge is ' + rgb(s, 'borderLeftColor') + ', want ice blue');
  for (const s of ['#pc2', '#pc3']) if (rgb(s, 'borderRightColor') !== 'rgb(255, 106, 74)') bad.push(s + ' edge is ' + rgb(s, 'borderRightColor') + ', want ember red');
  return bad;
})()"""

# rim pixels: how many canvas pixels are (nearly) the two team colours
RIMPX = """(() => { const cv = document.querySelector('#cv'), x = cv.getContext('2d'), d = x.getImageData(0, 0, cv.width, cv.height).data, near = (i, c) => Math.abs(d[i] - c[0]) < 14 && Math.abs(d[i + 1] - c[1]) < 14 && Math.abs(d[i + 2] - c[2]) < 14;
  let a = 0, b = 0; for (let i = 0; i < d.length; i += 4) { if (near(i, [127, 212, 255])) a++; else if (near(i, [255, 106, 74])) b++; } return [a, b]; })()"""

async def foes_gone(pg):   # both foes out: one is gone, the other on his last heart is put past the blast line, so the sim's own KO ends the match
    await pg.evaluate(f"(() => {{ const g = {G}; const a = g.fighters[3], b = g.fighters[2]; a.stocks = 0; a.state = 'gone'; b.stocks = 1; if (b.state === 'dead' || b.state === 'respawn') {{ b.state = 'idle'; b.dead = 0; }} b.y = BL.STAGE.blast.bottom + 120; }})()")

async def flow(b, errs):
    tag = 'flow'
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, errs)
    clk = pg.tap if mob else pg.click
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    # ----- the 1v1 Practice screen first: no Partner chip, the whole map list
    await clk('#bPractice'); await pg.wait_for_timeout(500)
    need(not await shown(pg, '#matePick'), 'the Partner chip shows for a 1v1')
    n1 = await pg.evaluate("(() => { document.querySelector('#mapPick').click(); const n = document.querySelectorAll('#mapPop button').length; document.querySelector('#mapPick').click(); return [n, BL.MAPS.length + 1]; })()")
    need(n1[0] == n1[1], f'a 1v1 map list has {n1[0]} entries, want {n1[1]}')
    # ----- the VS list: Team Brawl 2v2 on top
    await clk('#oppPick'); await pg.wait_for_timeout(250)
    first = await pg.evaluate("(() => { const bs = [...document.querySelectorAll('#oppPop button')].map((b) => [b.textContent.trim(), b.getBoundingClientRect()]); bs.sort((a, b) => a[1].top - b[1].top || a[1].left - b[1].left); return bs.slice(0, 2).map((b) => b[0]); })()")
    need(first[0].endswith('Team Brawl 2v2') and first[1] == 'Random', f'the VS list starts {first} on screen, want Team Brawl 2v2 then Random')
    await pg.evaluate(DUO_CLICK); await pg.wait_for_timeout(250)
    need('Team Brawl 2v2' in await txt(pg, '#oppPick'), f"the VS chip reads {await txt(pg, '#oppPick')!r}")
    need(await shown(pg, '#matePick') and 'Partner' in await txt(pg, '#matePick'), f"the Partner chip reads {await txt(pg, '#matePick')!r}")
    need(await txt(pg, '#lvlPick small') == 'CPU' and await txt(pg, '#lvlPick span') == 'Normal', f"the level chip reads {await txt(pg, '#lvlPick')!r}")
    await clk('#lvlPick'); await pg.wait_for_timeout(200)
    lv = await pg.evaluate("[...document.querySelectorAll('#lvlPop button')].map((b) => b.textContent)")
    need(lv == ['Dummy', 'Easy', 'Normal', 'Hard'], f'CPU levels {lv}')
    await pg.evaluate("[...document.querySelectorAll('#lvlPop button')].find((b) => b.textContent === 'Hard').click()"); await pg.wait_for_timeout(200)
    # the map list: Random + the pool maps only
    await clk('#mapPick'); await pg.wait_for_timeout(200)
    mp = await pg.evaluate("(() => ({ n: document.querySelectorAll('#mapPop button').length, pool: BL.MAPS.filter((m) => m.pool !== false).length, first: BL.MAPS.slice(0, BL.POOL).every((m) => m.pool !== false), rest: BL.MAPS.slice(BL.POOL).every((m) => m.pool === false) }))()")
    need(mp['n'] == mp['pool'] + 1, f'the 2v2 map list has {mp["n"]} entries, want Random + {mp["pool"]} pool maps')
    need(mp['first'] and mp['rest'], f'BL.POOL is not the pool: {mp}')
    await clk('#mapPick'); await pg.wait_for_timeout(100)
    # the partner list: Random + the eight fighters; pick the Reaper
    await clk('#matePick'); await pg.wait_for_timeout(200)
    ml = await pg.evaluate("[...document.querySelectorAll('#matePop button')].map((b) => b.textContent.trim())")
    need(len(ml) == 9 and ml[0] == 'Random' and 'Reaper' in ml and all(x in ml for x in ['Phoenix', 'Alchemist', 'Odin', 'Wizard', 'Samurai', 'Dragon', 'Gunslinger']), f'the partner list is {ml}')
    await pg.evaluate("[...document.querySelectorAll('#matePop button')].find((b) => b.textContent.trim() === 'Reaper').click()"); await pg.wait_for_timeout(250)
    need('Reaper' in await txt(pg, '#matePick'), f"the Partner chip reads {await txt(pg, '#matePick')!r} after picking the Reaper")
    for bad in await pg.evaluate(SELFIT): errs.append(f'{tag} select: {bad}')
    await pg.screenshot(path=f'{OUT}/flow_select.png')
    # a different VS pick takes the Partner chip away and gives the whole map list back; Team Brawl again
    await clk('#oppPick'); await pg.wait_for_timeout(200)
    await pg.evaluate("[...document.querySelectorAll('#oppPop button')].find((b) => b.textContent.trim() === 'Random').click()"); await pg.wait_for_timeout(200)
    need(not await shown(pg, '#matePick'), 'the Partner chip stays after picking Random')
    await pg.evaluate("document.querySelector('#mapPick').click()")
    need(await pg.evaluate("document.querySelectorAll('#mapPop button').length") == n1[1], 'the map list is not whole again')
    await pg.evaluate("document.querySelector('#mapPick').click()")
    await clk('#oppPick'); await pg.wait_for_timeout(200)
    await pg.evaluate(DUO_CLICK); await pg.wait_for_timeout(200)
    need(await shown(pg, '#matePick') and 'Reaper' in await txt(pg, '#matePick'), 'the partner pick is lost when going back to Team Brawl')
    await clk('#selGo')
    # ----- the fight: four fighters, your partner, a pool map
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    st = await pg.evaluate(f"(() => {{ const g = {G}; return {{ n: g.fighters.length, teams: g.fighters.map((f) => f.team), ids: g.fighters.map((f) => f.spec.id), pool: BL.MAPS[g.map].pool !== false }}; }})()")
    need(st['n'] == 4 and st['teams'] == [0, 0, 1, 1], f'fight setup {st}')
    need(st['ids'][0] == 'samurai' and st['ids'][1] == 'reaper', f"you and your partner: {st['ids'][:2]}, want samurai and reaper")
    need(st['pool'], 'the map is not a pool map')
    await in_play(pg)
    await pg.wait_for_timeout(800)
    for bad in await pg.evaluate(HUDFIT): errs.append(f'{tag} HUD: {bad}')
    tags = [await txt(pg, f'#pc{i} .pc-tag') for i in range(4)]
    need(tags == ['You', 'Partner', 'CPU', 'CPU'], f'card tags {tags}')
    nm = await pg.evaluate("[0, 1, 2, 3].map((i) => document.querySelector('#pc' + i + ' .pc-name').textContent)")
    need(nm == await pg.evaluate(f"{G}.fighters.map((f) => f.spec.name)"), f'card names {nm}')
    subs = await pg.evaluate("[1, 2, 3].map((i) => document.querySelector('#pc' + i + ' .pc-sub .nm').textContent)")
    need(all(subs) and len(set(subs)) == 3, f"the CPUs' names under the cards: {subs}")
    need(await pg.evaluate("document.querySelectorAll('.pcard').length") == 4, 'not four .pcard cards on the HUD')
    await pg.screenshot(path=f'{OUT}/flow_fight.png')
    # ----- Focus: a tap on a foe card
    need(await pg.evaluate("window.__blastline.duoFocus") == -1, 'the partner is focused on a foe before any tap')
    await clk('#pc2'); await pg.wait_for_timeout(300)
    need(await pg.evaluate("window.__blastline.duoFocus") == 2, f"a tap on the first foe card focuses {await pg.evaluate('window.__blastline.duoFocus')}, want 2")
    need(await pg.evaluate("document.querySelector('#pc2').classList.contains('focus') && !document.querySelector('#pc3').classList.contains('focus')"), 'no ember ring on the focused foe card only')
    ring = await pg.evaluate("getComputedStyle(document.querySelector('#pc2')).boxShadow")
    need('255, 106, 74' in ring, f'the focus ring is not ember: {ring}')
    await pg.screenshot(path=f'{OUT}/flow_focus.png')
    await clk('#pc3'); await pg.wait_for_timeout(300)
    need(await pg.evaluate("window.__blastline.duoFocus") == 3 and await pg.evaluate("document.querySelector('#pc3').classList.contains('focus') && !document.querySelector('#pc2').classList.contains('focus')"), 'a tap on the second foe card does not move the Focus')
    # the pause icon still takes its tap
    await clk('#pauseBtn'); await pg.wait_for_timeout(300)
    need(await shown(pg, '#scrPause'), 'the pause icon does nothing in a 2v2')
    await clk('#pResume'); await pg.wait_for_timeout(300)
    # ----- finish percent: only a FOE shows the banner and lights Special
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].percent = 200; }})()")
    await pg.wait_for_timeout(700)
    need(await pg.evaluate("document.querySelector('#pc1').classList.contains('finr')"), 'the partner card does not pulse at the finish percent')
    need(await txt(pg, '#banner .b-main') != 'Finish!', 'a Finish banner for your own partner')
    need(not await pg.evaluate("document.querySelector('.pb[data-k=special]').classList.contains('fin')"), 'the Special glows for your own partner at the finish percent')
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[2].percent = 200; }})()")
    try: await pg.wait_for_function("document.querySelector('#banner .b-main').textContent === 'Finish!'", timeout=5000)
    except Exception: errs.append(f'{tag}: no Finish banner for a foe at the finish percent')
    mine = await pg.evaluate("(() => { const p = document.createElement('i'); p.style.color = document.querySelector('#pc0').style.getPropertyValue('--fc'); document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return [c, getComputedStyle(document.querySelector('#banner .b-main')).color]; })()")
    need(mine[0] == mine[1], f'the Finish banner is {mine[1]}, want your colour {mine[0]}')
    need(await pg.evaluate("document.querySelector('.pb[data-k=special]').classList.contains('fin')"), 'the Special does not glow while a foe is finish-ready')
    need(await pg.evaluate("document.querySelector('#pc2').classList.contains('finr')"), 'the foe card does not pulse at the finish percent')
    await pg.screenshot(path=f'{OUT}/flow_finish.png')
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].percent = 0; g.fighters[2].percent = 0; }})()")
    await pg.wait_for_timeout(700)
    need(not await pg.evaluate("document.querySelector('.pb[data-k=special]').classList.contains('fin')"), 'the Special keeps glowing after the foe is back under the finish percent')
    # ----- the ulti bar on a mini card: a full one is gold, half one is half
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[2].ult = BL.ultNeed(g.fighters[2]); g.fighters[3].ult = BL.ultNeed(g.fighters[3]) / 2; }})()")
    await pg.wait_for_timeout(700)
    u = await pg.evaluate("[2, 3].map((i) => { const e = document.querySelector('#pc' + i + ' .pc-ult'); return [e.classList.contains('full'), +e.style.getPropertyValue('--u')]; })")
    need(u[0][0] and abs(u[1][1] - 0.5) < 0.06, f'ulti bars on the foe cards: {u}')
    await pg.screenshot(path=f'{OUT}/flow_ulti.png')
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[2].ult = 0; g.fighters[3].ult = 0; }})()")
    # ----- the end, as in the smoke check: one foe gone, the other at 400% on his last heart
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[3].stocks = 0; g.fighters[3].state = 'gone'; g.fighters[2].stocks = 1; g.fighters[2].percent = 400; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=170000)
    await pg.wait_for_timeout(1200)
    need(await txt(pg, '#rMode') == 'Team Brawl 2v2 · Hard', f"results mode {await txt(pg, '#rMode')!r}")
    need(await txt(pg, '#rTitle') == 'Victory', f"results title {await txt(pg, '#rTitle')!r}")
    sub = await txt(pg, '#rSub')
    need(sub.startswith('You and ') and ' beat ' in sub, f'results line {sub!r}')
    await pg.screenshot(path=f'{OUT}/flow_results.png')
    # ----- a 1v1 afterwards: the two cards as they were, nothing of the 2v2 left on the HUD
    await clk('#rMenu'); await pg.wait_for_timeout(500)
    await clk('#bPractice'); await pg.wait_for_timeout(500)
    await clk('#oppPick'); await pg.wait_for_timeout(200)
    await pg.evaluate("[...document.querySelectorAll('#oppPop button')].find((b) => b.textContent.trim() === 'Random').click()"); await pg.wait_for_timeout(200)
    await clk('#selGo')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    one = await pg.evaluate("""(() => ({ duo: document.querySelector('#app').classList.contains('duo'), cards: document.querySelectorAll('.pcard').length, p2: !!document.querySelector('#pc2'),
      p1right: document.querySelector('#pc1').classList.contains('right'), p1mini: document.querySelector('#pc1').classList.contains('pmini'), p1in: document.querySelector('#pc1').parentNode.className, n: window.__blastline.game.fighters.length,
      tc: document.querySelector('#pc1').style.getPropertyValue('--tc') }))()""")
    need(not one['duo'] and one['cards'] == 2 and not one['p2'] and one['p1right'] and not one['p1mini'] and one['p1in'] == 'hud-r' and one['n'] == 2 and one['tc'] == '', f'the 1v1 HUD after a 2v2: {one}')
    await ctx.close()

async def size(b, tag, errs):
    vp = SIZES[tag]
    ctx, pg, mob = await new_page(b, tag, vp[:2], vp[2], errs)
    clk = pg.tap if mob else pg.click
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    # ----- the select header with four chips, and the VS list
    await pick_duo(pg, clk)
    for bad in await pg.evaluate(SELFIT): errs.append(f'{tag} select: {bad}')
    await pg.screenshot(path=f'{OUT}/{tag}_select.png')
    await clk('#oppPick'); await pg.wait_for_timeout(900)
    for bad in await pg.evaluate(POPFIT): errs.append(f'{tag} VS list: {bad}')
    await pg.screenshot(path=f'{OUT}/{tag}_select_vs.png')
    await clk('#oppPick'); await pg.wait_for_timeout(200)
    await clk('#matePick'); await pg.wait_for_timeout(700)
    await pg.screenshot(path=f'{OUT}/{tag}_select_partner.png')
    await clk('#matePick'); await pg.wait_for_timeout(200)
    # ----- the fight
    await clk('#selGo')
    await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000)
    await pg.screenshot(path=f'{OUT}/{tag}_countdown.png')
    await in_play(pg)
    await pg.wait_for_timeout(1500)
    for bad in await pg.evaluate(HUDFIT): errs.append(f'{tag} HUD: {bad}')
    # the team rims and the rings at the feet: ice blue and ember red pixels on the canvas
    px = await pg.evaluate(RIMPX)
    need(px[0] > 40 and px[1] > 40, f'team rims: {px[0]} ice blue and {px[1]} ember red pixels on the canvas, want more than 40 of each')
    await pg.screenshot(path=f'{OUT}/{tag}_fight.png')
    # a tap (a click on the computer) on a foe card, and Tab
    await clk('#pc2'); await pg.wait_for_timeout(300)
    need(await pg.evaluate("window.__blastline.duoFocus") == 2, f"the tap on a foe card focuses {await pg.evaluate('window.__blastline.duoFocus')}, want 2")
    if not mob:
        await pg.keyboard.press('Tab'); await pg.wait_for_timeout(300)
        need(await pg.evaluate("window.__blastline.duoFocus") == 3, f"Tab after Focus on 2 gives {await pg.evaluate('window.__blastline.duoFocus')}, want 3")
        await pg.keyboard.press('Tab'); await pg.wait_for_timeout(300)
        need(await pg.evaluate("window.__blastline.duoFocus") == 2, 'a second Tab does not come back to the first foe')
    # the HUD with everything on: a Focus ring, a foe at the finish percent, ulti bars, a heart gone
    await pg.evaluate(f"""(() => {{ const g = {G}; g.fighters[3].percent = 140; g.fighters[2].percent = 190; g.fighters[2].ult = BL.ultNeed(g.fighters[2]); g.fighters[3].ult = BL.ultNeed(g.fighters[3]) * 0.4;
      g.fighters[0].percent = 63; g.fighters[1].percent = 88; g.fighters[1].ult = BL.ultNeed(g.fighters[1]) * 0.7; g.fighters[0].ult = BL.ultNeed(g.fighters[0]) * 0.3; g.fighters[3].stocks = 2; }})()""")
    await pg.wait_for_timeout(1300)
    for bad in await pg.evaluate(HUDFIT): errs.append(f'{tag} HUD (percents, ulti, focus): {bad}')
    await pg.screenshot(path=f'{OUT}/{tag}_hud.png')
    # a Catch: you tumbling from a launch with your partner on top of you
    await pg.evaluate(f"""(() => {{ const g = {G}, a = g.fighters[0], p = g.fighters[1]; for (const f of [a, p]) {{ f.x = -40; f.y = -90; f.grounded = false; f.plat = -1; f.vx = 0; f.vy = 0; }}
      a.state = 'hitstun'; a.hitstun = 80; a.st = 20; a.tumble = true; a.move = null; a.mid = null; a.kbx = 9; a.kby = -3; a.facing = 1; p.state = 'air'; p.move = null; p.mid = null; p.catchCd = 0; p.invuln = 0; }})()""")
    try:
        await pg.wait_for_function(f"{G}.fighters[1].catchCd > 0", timeout=8000)
        await pg.screenshot(path=f'{OUT}/{tag}_catch.png')
    except Exception: errs.append(f'{tag}: no Catch when your partner touches you tumbling')
    # the end: both foes out
    await pg.wait_for_timeout(500)
    await foes_gone(pg)
    try: await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
    except Exception:
        errs.append(f"{tag}: no results after both foes were put out: " + await pg.evaluate(f"(() => {{ const g = {G}; return JSON.stringify({{ mode: window.__blastline.mode, phase: g.phase, t: g.t, f: g.fighters.map((f) => [f.state, f.stocks, Math.round(f.x), Math.round(f.y)]) }}); }})()"))
        await pg.screenshot(path=f'{OUT}/{tag}_noresult.png'); await ctx.close(); return
    await pg.wait_for_timeout(1300)
    need(await txt(pg, '#rMode') in ('Team Brawl 2v2 · Normal',), f"results mode {await txt(pg, '#rMode')!r}")
    await pg.screenshot(path=f'{OUT}/{tag}_results.png')
    await ctx.close()

async def main():
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        if not ONLY or 'flow' in ONLY: await flow(b, errs)
        for tag in SIZES:
            if not ONLY or tag in ONLY: await size(b, tag, errs)
        await b.close()
    for e in errs: print('ERROR', e)
    if not errs: print('no errors')
asyncio.run(main())
