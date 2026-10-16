"""Quick match in the browser (ui/quick.js) against a real `node server.js` with a temporary ACCOUNTS_DIR on port 8099.
Three players (A on a phone, B on a desktop, C on a phone) as separate devices:
  1. A: the menu's gold hero is Quick match, the Season 1 sheet once, Find match (Ranked) makes the account, nobody else searches,
     so the CPU warm-up is offered and taken; the searching strip runs on its HUD.
  2. B searches Ranked: PLAYER FOUND! over A's warm-up (no result for it), the VS screen on both, the fight; B walks off the stage
     three times, the server decides: both results show the server's rating, which the account files hold too.
  3. A and B again: they just played each other, so no Ranked rematch: after 20 s they meet as Casual (no rank change), B leaves.
  4. C and A in Ranked: A forfeits from the pause menu (a loss on the server, C's win "Opponent left").
Screenshots (the Quick match screen idle and searching at 667x320, 844x390, 1280x760 and 390x844, the warm-up, PLAYER FOUND!, the VS
screen, the results) go to the folder in argv[1]. Prints one line per problem, then "no errors".
Usage:  python3 tests/pwquick.py [outdir]        (needs `python3 game/build.py` first)"""
import asyncio, sys, os, json, subprocess, tempfile, shutil, time, hashlib, pathlib, re, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWQUICK_PORT', 8099))
URL = f'http://localhost:{PORT}/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'quick')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PHONE, DESK, TINY, UP = {'width': 844, 'height': 390}, {'width': 1280, 'height': 760}, {'width': 667, 'height': 320}, {'width': 390, 'height': 844}
PA = {'tokens': 85, 'rating': 1180, 'peak': 1180, 'wins': 6, 'losses': 2, 'matches': 8, 'last': 'phoenix', 'gfx': '2d', 'name': 'Peel Appeal'}
PB = {'tokens': 10, 'last': 'samurai', 'gfx': '2d', 'name': 'Mash Master'}
PC = {'tokens': 10, 'last': 'odin', 'gfx': '2d', 'name': 'Tuber Tom', 'screen': 'up'}
errs = []
def expect(ok, msg):
    if not ok: errs.append(msg)
def has(hay, *subs):   # innerText follows text-transform, so compare without case (and no-break spaces as spaces)
    h = (hay or '').lower().replace('\xa0', ' ')
    return all(x.lower() in h for x in subs)

def start_server(d):
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0', ACCOUNTS_DIR=d)
    env.pop('STATS_DIR', None)
    p = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(60):
        try:
            if urllib.request.urlopen(URL + 'health', timeout=1).status == 200: return p
        except Exception: time.sleep(0.2)
    p.kill(); raise RuntimeError('server did not start')
def stop_server(p):
    p.terminate()
    try: out = p.communicate(timeout=5)[0].decode('utf8', 'replace')
    except Exception: p.kill(); out = ''
    return out
def norm(code): return re.sub(r'[^0-9A-Z]', '', code.upper())
def on_rec(d, code):   # the server-only online record in the account file
    f = pathlib.Path(d) / (hashlib.sha256(norm(code).encode()).hexdigest() + '.json')
    try: return json.loads(f.read_text()).get('on')
    except Exception: return None

async def device(b, vp, mob, profile):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    await ctx.add_init_script("if (!localStorage.getItem('potatobrawl.profile.v1')) localStorage.setItem('potatobrawl.profile.v1', %s)" % json.dumps(json.dumps(profile)))
    return ctx
def watch(pg, tag):
    pg.on('pageerror', lambda e: errs.append(f'{tag}: page error: {e}'))
    def con(m):
        if m.type == 'error' and 'Failed to load resource' not in m.text: errs.append(f'{tag}: console: {m.text}')
    pg.on('console', con)
async def text(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return e ? e.innerText : null }", sel)
async def shown(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 }", sel)
async def qm(pg): return await pg.evaluate("(() => { const q = window.__blastline.qm; return { st: q.st, mode: q.mode, me: q.me, code: q.code, authed: q.authed, conn: q.conn, res: q.res, pend: q.pend, s1: q.s1, applied: q.applied, found: q.found && q.found.id, role: q.found && q.found.role }; })()")
async def mode(pg): return await pg.evaluate("window.__blastline.mode")
async def code(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.acct.v1') || '{}').code || ''")
async def tap(pg, sel):
    await pg.locator(sel).first.click()
    await pg.wait_for_timeout(120)
async def shot(pg, name): await pg.screenshot(path=str(OUT / f'{name}.png'))
async def wait(pg, js, what, secs=20):
    try: await pg.wait_for_function(js, timeout=secs * 1000); return True
    except Exception:
        st = await pg.evaluate("(() => { const b = window.__blastline, q = b && b.qm; return b ? [b.mode, q.st, q.note, b.net.phase, q.conn, q.authed] : null; })()")
        errs.append(f'timed out: {what} (mode, search, note, net, connected, signed in: {st})'); return False
async def overflow(pg, tag):   # nothing on the Quick match screen spills out of its frame or sideways
    bad = await pg.evaluate("""(() => {
      const out = [], W = innerWidth;
      for (const e of document.querySelectorAll('#scrQuick *')) {
        if (e.closest('[hidden]') || !e.getClientRects().length) continue;
        const r = e.getBoundingClientRect();
        if (r.width && (r.right > W + 1 || r.left < -1) && !e.closest('.on-fa')) out.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
      }
      return out.slice(0, 5);
    })()""")
    expect(not bad, f'{tag}: off the screen sideways: {bad}')

async def open_quick(pg, tag, season):
    await pg.goto(URL)
    await wait(pg, "window.__blastline && window.__blastline.mode === 'menu' && window.__blastline.qm.conn", f'{tag}: connected on the menu')
    await pg.wait_for_timeout(400)
    hero = await text(pg, '#bRanked')
    expect(has(hero, 'Quick match'), f'{tag}: the gold hero should be Quick match, got {hero!r}')
    expect(await shown(pg, '#bRanked .qm-s1'), f'{tag}: the hero should wear the Season 1 sticker before the sheet was seen')
    await tap(pg, '#bRanked')
    await wait(pg, "window.__blastline.mode === 'quick'", f'{tag}: Quick match opens')
    await pg.wait_for_timeout(500)
    expect(await shown(pg, '#scrSeason .ss-sheet'), f'{tag}: the Season 1 sheet should open the first time')
    if season: await season()
    await tap(pg, '#ssGo')
    expect(not await shown(pg, '#scrSeason .ss-sheet'), f'{tag}: Let\'s go closes the Season 1 sheet')

async def main():
    d = tempfile.mkdtemp(prefix='pwquick-')
    srv = start_server(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            ca, cb, cc = await device(b, PHONE, True, PA), await device(b, DESK, False, PB), await device(b, UP, True, PC)
            A, B, C = await ca.new_page(), await cb.new_page(), await cc.new_page()
            for t, pg in (('A', A), ('B', B), ('C', C)): watch(pg, t)

            # ---- 1. A alone: the Season sheet (the old CPU rank shown, kept), the idle screen, the search, the CPU warm-up
            async def season_a():
                old = await text(A, '#ssOld')
                expect(has(old, 'CPU rank', '1180', 'Account'), f'A: the Season sheet should show the old CPU rank, got {old!r}')
                expect(has(await text(A, '#ssOn'), 'online rank', 'Bronze', '1000'), 'A: the Season sheet should show the online rank Bronze 1000')
                await shot(A, 'season-844')
            await open_quick(A, 'A', season_a)
            await wait(A, "window.__blastline.net.ok", 'A: the lobby')
            await A.wait_for_timeout(600)
            truth = await text(A, '#qmTruth')
            expect(has(truth, 'Nobody searching'), f'A: alone, the truth line should say nobody is searching, got {truth!r}')
            expect(await shown(A, '#qmCpu'), 'A: alone, the CPU warm-up card should show before Find match')
            expect(has(await text(A, '#qmRank'), 'Placing', '0 of 5', '1000'), f"A: the rank plate should show Placing 0 of 5 at 1000, got {await text(A, '#qmRank')!r}")
            for name, vp in (('844', PHONE), ('667', TINY), ('1280', DESK)):
                await A.set_viewport_size(vp); await A.wait_for_timeout(450); await shot(A, f'quick-idle-{name}'); await overflow(A, f'A idle {name}')
            await A.set_viewport_size(PHONE); await A.wait_for_timeout(300)
            await tap(A, '#qmFind')
            await wait(A, "window.__blastline.qm.st === 'search' && window.__blastline.qm.authed", 'A: searching Ranked with a new account', 15)
            ac = await code(A)
            expect(bool(ac), 'A: Find match (Ranked) should make the sync-code account')
            await wait(A, "!document.getElementById('qmCpu').hidden && /\\d:\\d\\d/.test(document.getElementById('qmTime').textContent)", 'A: the CPU offer while searching', 10)
            await A.wait_for_timeout(5600)
            rng = await text(A, '#qmRange')
            expect(has(rng, 'searching'), f'A: the range line should come from the server, got {rng!r}')
            for name, vp in (('844', PHONE), ('667', TINY), ('1280', DESK)):
                await A.set_viewport_size(vp); await A.wait_for_timeout(450); await shot(A, f'quick-search-{name}'); await overflow(A, f'A searching {name}')
            await A.set_viewport_size(PHONE); await A.wait_for_timeout(300)
            await tap(A, '#qmWarm')
            await wait(A, "window.__blastline.mode === 'match' && window.__blastline.qm.st === 'search'", 'A: the warm-up starts and the search goes on')
            await A.wait_for_timeout(3200)
            expect(await shown(A, '#qmStrip'), 'A: the searching strip should show on the warm-up\'s HUD')
            await shot(A, 'warmup-844')

            # ---- 2. B searches Ranked: found, A's warm-up ends with no result, VS, the fight, the server's verdict
            await open_quick(B, 'B', None)
            await tap(B, '#qmFind')
            # A's found banner and B's VS screen come at once: both watched together (a screenshot of one page is slow here)
            async def a_found():
                if await wait(A, "!document.getElementById('qmFound').hidden", 'A: PLAYER FOUND! over the warm-up', 20):
                    vs = await text(A, '#qfVs')
                    expect(has(vs, 'Mash Master', 'Ranked'), f'A: the found banner should name B and Ranked, got {vs!r}')
                    await shot(A, 'found-844')
            async def b_vs():
                if await wait(B, "!document.getElementById('qmVs').hidden", 'B: the VS screen', 20):
                    await B.wait_for_timeout(450); await shot(B, 'vs-1280')
            await asyncio.gather(a_found(), b_vs())
            bc = await code(B)
            expect(bool(bc), 'B: Find match (Ranked) should make the sync-code account')
            # a slow machine (three pages drawn in software) may be past A's VS screen by now: its count says it showed
            await wait(A, "window.__blastline.qm.vsN >= 1", 'A: the VS screen after the 3·2·1', 10)
            expect(has(await text(A, '#vsStamp'), 'Ranked'), 'A: the VS stamp should say Ranked')
            if await shown(A, '#qmVs'): await shot(A, 'vs-844')
            await wait(A, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", 'A: the Ranked match starts', 25)
            await wait(B, "window.__blastline.mode === 'match' && window.__blastline.game", 'B: the Ranked match starts', 10)
            expect(await A.evaluate("!!(window.__blastline.game && window.__blastline.game.fighters.length === 2)"), 'A: a 1v1 game')
            # B walks off the stage until the match is over (the server plays the same inputs)
            await B.bring_to_front()
            await B.keyboard.down('ArrowLeft')
            await wait(B, "window.__blastline.mode === 'result'", 'B: the match ends (walked off three times)', 90)
            await B.keyboard.up('ArrowLeft')
            await wait(A, "window.__blastline.mode === 'result'", 'A: the results', 30)
            await wait(A, "window.__blastline.qm.res && window.__blastline.qm.res.res === 1", "A: the server's verdict (a win)", 15)
            await wait(B, "window.__blastline.qm.res && window.__blastline.qm.res.res === 0", "B: the server's verdict (a loss)", 15)
            await A.wait_for_timeout(2600); await B.wait_for_timeout(300)
            qa, qb = await qm(A), await qm(B)
            if os.environ.get('PWQUICK_LOG'): print('A', json.dumps(qa)[:600]); print('B', json.dumps(qb)[:600])
            ra, rb = on_rec(d, ac), on_rec(d, bc)
            expect(ra and ra['r'] > 1000 and ra['w'] == 1 and ra['n'] == 1, f'server: A should have won one placement match, got {ra}')
            expect(rb and rb['r'] < 1000 and rb['l'] == 1 and rb['n'] == 1, f'server: B should have lost one placement match, got {rb}')
            if ra and qa['me']: expect(qa['me']['r'] == ra['r'] and qa['me']['n'] == 1, f'A: the page shows {qa["me"]["r"]}, the server holds {ra["r"]}')
            if rb and qb['me']: expect(qb['me']['r'] == rb['r'], f'B: the page shows {qb["me"]["r"]}, the server holds {rb["r"]}')
            sa = await text(A, '#rRank')
            expect(ra and has(sa, f'{ra["r"]}', 'Placing 1 of 5'), f'A: the rank card should show the server rating and placing, got {sa!r}')
            expect(has(await text(A, '#rMode'), 'Quick match', 'Ranked'), 'A: the results kicker should say Quick match · Ranked')
            expect(has(await text(A, '#rAgain'), 'Next match'), 'A: Ranked results offer Next match')
            await shot(A, 'result-win-844'); await shot(B, 'result-loss-1280')

            # ---- 3. no Ranked rematch: A and B meet again as Casual after the 20 s fallback; B leaves the match
            await tap(A, '#rAgain')
            await wait(A, "window.__blastline.mode === 'quick' && window.__blastline.qm.st === 'search'", 'A: Next match searches again')
            await tap(B, '#rChange')
            await wait(B, "window.__blastline.mode === 'quick'", 'B: back on the Quick match screen')
            await tap(B, '#qmFind')
            if await wait(A, "window.__blastline.qm.vsN >= 2", 'A: found again (Casual, after the fallback)', 40):
                st = await text(A, '#vsStamp')
                expect(has(st, 'Casual', 'no Ranked player found'), f'A: the rematch should be Casual with the fallback line, got {st!r}')
                if await shown(A, '#qmVs'): await shot(A, 'vs-casual-844')
            await wait(B, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", 'B: the Casual match starts', 25)
            await B.keyboard.press('Escape'); await B.wait_for_timeout(300)
            expect(has(await text(B, '#pQuit'), 'Leave match'), 'B: a Casual match is left, not forfeited')
            await tap(B, '#pQuit'); await tap(B, '#pQuit')
            await wait(B, "window.__blastline.mode === 'quick'", 'B: leaving a Casual match goes back to Quick match')
            await wait(A, "window.__blastline.mode === 'result'", 'A: Opponent left', 20)
            await A.wait_for_timeout(800)
            expect(has(await text(A, '#rTitle'), 'Opponent left'), 'A: the Casual results should say Opponent left')
            expect(on_rec(d, ac)['n'] == 1, 'server: a Casual match must not count')
            await shot(A, 'result-casual-left-844')

            # ---- 4. C and A in Ranked; A forfeits from the pause menu
            await open_quick(C, 'C', None)
            await shot(C, 'quick-idle-390')
            await overflow(C, 'C idle 390')
            await tap(C, '#qmFind')
            await wait(C, "window.__blastline.qm.st === 'search' && window.__blastline.qm.authed", 'C: searching Ranked', 15)
            await C.wait_for_timeout(5600); await shot(C, 'quick-search-390'); await overflow(C, 'C searching 390')
            expect(has(await text(A, '#rChange'), 'Next match'), 'A: Casual results offer Next match')
            await tap(A, '#rChange')   # Casual's Next match: straight back into the search (C is already searching, so it can be found at once)
            await wait(A, "window.__blastline.qm.st === 'search' || window.__blastline.qm.st === 'found'", 'A: Next match searches again')
            if await wait(C, "window.__blastline.qm.vsN >= 1", 'C: the VS screen (upright)', 20):
                if await shown(C, '#qmVs'): await shot(C, 'vs-390')
            await wait(A, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", 'A: the Ranked match vs C starts', 25)
            await A.wait_for_timeout(600)
            await A.keyboard.press('Escape'); await A.wait_for_timeout(300)
            pz = await text(A, '#pNote')
            expect(has(await text(A, '#pQuit'), 'Forfeit') and has(pz, 'counts as a loss'), f'A: Ranked pause says Forfeit and what it costs, got {pz!r}')
            await shot(A, 'pause-forfeit-844')
            await tap(A, '#pQuit'); await tap(A, '#pQuit')
            await wait(A, "window.__blastline.mode === 'result'", 'A: the forfeit results')
            await wait(A, "window.__blastline.qm.res && window.__blastline.qm.res.why === 'left' && window.__blastline.qm.res.res === 0", "A: the server counts the forfeit as a loss", 15)
            await wait(C, "window.__blastline.qm.res && window.__blastline.qm.res.why === 'left' && window.__blastline.qm.res.res === 1", "C: the server counts it as C's win", 15)
            await wait(C, "window.__blastline.mode === 'result'", 'C: Opponent left')
            await C.wait_for_timeout(2600); await A.wait_for_timeout(300)
            expect(has(await text(A, '#rTitle'), 'Forfeit'), 'A: the forfeit results say Forfeit')
            expect(has(await text(C, '#rTitle'), 'Opponent left') and has(await text(C, '#rStick'), 'forfeit'), 'C: Opponent left, the sticker says forfeit')
            ra2, rc = on_rec(d, ac), on_rec(d, await code(C))
            expect(ra2 and ra2['l'] == 1 and ra2['n'] == 2, f'server: A should have a loss now, got {ra2}')
            expect(rc and rc['w'] == 1 and rc['h'][0]['why'] == 'left', f'server: C should have a win by forfeit, got {rc}')
            await shot(A, 'result-forfeit-844'); await shot(C, 'result-left-390')
            # the menu: the hero shows the online rank and record, the plate the online rating
            await tap(A, '#rMenu')
            await wait(A, "window.__blastline.mode === 'menu'", 'A: the menu')
            await A.wait_for_timeout(500)
            hero = await text(A, '#bRanked')
            expect(has(hero, 'Quick match', 'Placing', '2 of 5') and not await shown(A, '#bRanked .qm-s1'), f'A: the hero shows the placement and no sticker now, got {hero!r}')
            expect(ra2 and (await text(A, '#mRating')).strip() == str(ra2['r']), 'A: the profile plate shows the online rating')
            await shot(A, 'menu-844')
            await b.close()
    except Exception as e:
        errs.append(f'stopped: {type(e).__name__}: {str(e).splitlines()[0]}')
    finally:
        log = stop_server(srv)
        shutil.rmtree(d, ignore_errors=True)
    for ln in log.splitlines():
        if os.environ.get('PWQUICK_LOG') and 'quick' in ln.lower(): print('server:', ln)
        if 'quick:' in ln and 'drifted' in ln: errs.append('server: ' + ln.strip())
    print('\n'.join(errs) or 'no errors')

asyncio.run(main())
