"""Quick match in the browser (ui/quick.js) against a real `node server.js` with a temporary ACCOUNTS_DIR on port 8099.
Three players (A on a phone, B on a desktop, C on a phone) as separate devices:
  1. A: the menu's gold hero is Quick match, the Season 1 sheet once, Find match (Ranked) makes the account, nobody else searches,
     so the CPU warm-up is offered and taken; the searching strip runs on its HUD.
  2. B searches Ranked: PLAYER FOUND! over A's warm-up (no result for it), the VS screen on both, the fight; B walks off the stage
     three times, the server decides: both results show the server's rating, which the account files hold too.
  3. A and B again: they just played each other, so no Ranked rematch: after 20 s they meet as Casual (no rank change), B leaves.
  4. C and A in Ranked: A forfeits from the pause menu (a loss on the server, C's win "Opponent left"). A carries a 3-win streak
     (written into its account file), so C's VS screen shows A's wanted plate and C takes the 30-chip bounty, paid into C's account.
  5. The rival record all along: the results' story line and rival strip, the VS pill, Account > Stats's Rivals list (A at 844,
     C upright), and C's Quick match rank plate on a streak (WANTED).
  6. The rank plate and the menu's profile plate fit at 16 sizes from 667 to 1920 wide (nothing overlaps or is cut): fresh (A, phone
     sizes), on a streak (C, upright), Diamond with a long rating line (A again) and placing 1 of 5 (B, desktop sizes). Below 820 px
     wide in landscape the plate is the narrow one: the record and season in the YOUR MATCH kicker, five pips under PLACING.
  7. C picks VS CPU (Ranked vs CPU): the server's ticket, the VS screen with the CPU sticker, the HUD strip, a forfeit counted on the
     CPU rank (the account file's `cpu` part), back to Quick match with the match counted, the Boards sheet from the board line.
Screenshots (the Quick match screen idle and searching at 667x320, 844x390, 1280x760 and 390x844, idle at 740x360, the narrow plate as
Diamond at 740x360 and placing at 800x700, the warm-up, PLAYER FOUND!, the VS
screen, the results) go to the folder in argv[1]. Prints one line per problem, then "no errors".
Usage:  python3 tests/pwquick.py [outdir]        (needs `python3 game/build.py` first)"""
import asyncio, sys, os, json, subprocess, tempfile, shutil, time, hashlib, pathlib, re, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWQUICK_PORT', 8099))
URL = f'http://localhost:{PORT}/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'quick')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
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
def acct_file(d, code): return pathlib.Path(d) / (hashlib.sha256(norm(code).encode()).hexdigest() + '.json')
def on_rec(d, code):   # the server-only online record in the account file
    try: return json.loads(acct_file(d, code).read_text()).get('on')
    except Exception: return None
def set_on(d, code, patch):   # the test's own hand on an online record (the server reads the file each time)
    f = acct_file(d, code); rec = json.loads(f.read_text()); rec['on'].update(patch); f.write_text(json.dumps(rec))
def prof_rec(d, code):
    try: return json.loads(acct_file(d, code).read_text())
    except Exception: return None
async def reauth(pg, code):   # the page signs in again, so its copy of the record is the file's
    await pg.evaluate("(c) => window.__blQuick.send({ t: 'auth', code: c })", code)

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

PH_SIZES = [(740, 360), (800, 360), (667, 320), (844, 390), (851, 393), (915, 412), (932, 430)]
DK_SIZES = [(800, 700), (1024, 768), (1280, 760), (1366, 657), (1536, 730), (1920, 969)]
UP_SIZES = [(360, 780), (390, 844), (412, 915)]
PLATE = """(() => {
  const ids = ['qmBadge', 'qmTier', 'qmRating', 'qmRec', 'qmKRec', 'qmPips', 'qmRSub', 'mRankKick', 'mName', 'mTier', 'mRating', 'mBadge', 'mTokens', 'mStreak'];
  const r = {}, out = [];
  for (const id of ids) { const e = document.getElementById(id); if (e && e.getClientRects().length && !e.closest('[hidden]')) { const b = e.getBoundingClientRect(); r[id] = [b.left, b.top, b.right, b.bottom, e.scrollWidth > e.clientWidth + 1]; } }
  const k = Object.keys(r);
  for (let i = 0; i < k.length; i++) { if (r[k[i]][4]) out.push(k[i] + ' cut'); for (let j = i + 1; j < k.length; j++) { const a = r[k[i]], b = r[k[j]]; if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) out.push(k[i] + ' over ' + k[j]); } }
  const kr = document.getElementById('qmKRec');
  if (r.qmKRec && kr.offsetTop - kr.previousElementSibling.offsetTop > 5) out.push('the kicker record wraps');
  const pp = document.getElementById('qmPips');
  return { bad: out, thin: document.getElementById('qmIdle').classList.contains('thin'), pips: r.qmPips ? pp.querySelectorAll('.on').length : -1, krec: kr.textContent };
})()"""
async def plates(pg, tag, sizes, back, quick=True, check=None):   # the plate at each size (6.), then back to the test's own size
    for w, h in sizes:
        await pg.set_viewport_size({'width': w, 'height': h}); await pg.wait_for_timeout(300)
        r = await pg.evaluate(PLATE)
        expect(not r['bad'], f'{tag} {w}x{h}: rank plate: {", ".join(r["bad"])}')
        if quick:
            want = h < w < 820 and not (w < 760 and h >= 360)   # below 760 wide the side columns shrink (css/96-vscpu.css .slim) and the full plate fits again, except on the shortest phones
            expect(r['thin'] == want, f'{tag} {w}x{h}: the narrow plate should be {"on" if want else "off"}')
            await overflow(pg, f'{tag} {w}x{h}')
            if check: check(w, h, r)
    await pg.set_viewport_size(back); await pg.wait_for_timeout(300)

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
            def fresh(w, h, r):
                if r['thin']: expect(r['pips'] == 0 and r['krec'] == '0W · 0L · Season 1', f'A {w}x{h}: five empty pips and "0W · 0L · Season 1" in the kicker, got {r["pips"]} on, {r["krec"]!r}')
            await plates(A, 'A fresh', PH_SIZES, PHONE, check=fresh)
            await A.set_viewport_size({'width': 740, 'height': 360}); await A.wait_for_timeout(300); await shot(A, 'quick-idle-740')
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
            # the rival record: the story line's second sentence and the strip (A leads 1–0; on B's side Peel Appeal does)
            expect(await shown(A, '#rRiv') and has(await text(A, '#rRiv'), 'Mash Master', 'You lead 1–0'), f"A: the rival strip should say You lead 1–0, got {await text(A, '#rRiv')!r}")
            expect(has(await text(A, '#rSub'), 'You lead 1–0 now'), f"A: the story line should end with the record, got {await text(A, '#rSub')!r}")
            expect(has(await text(B, '#rRiv'), 'Leads 1–0') and has(await text(B, '#rSub'), 'Peel Appeal leads 1–0 now'), f"B: Peel Appeal leads 1–0, got {await text(B, '#rRiv')!r}")
            expect(ra and ra.get('rv') and ra['rv'][0]['w'] == 1, f'server: A\'s rival record should hold the win, got {ra and ra.get("rv")}')

            # ---- 3. no Ranked rematch: A and B meet again as Casual after the 20 s fallback; B leaves the match
            await tap(A, '#rAgain')
            await wait(A, "window.__blastline.mode === 'quick' && window.__blastline.qm.st === 'search'", 'A: Next match searches again')
            await tap(B, '#rChange')
            await wait(B, "window.__blastline.mode === 'quick'", 'B: back on the Quick match screen')
            await tap(B, '#qmFind')
            if await wait(A, "window.__blastline.qm.vsN >= 2", 'A: found again (Casual, after the fallback)', 40):
                st = await text(A, '#vsStamp')
                expect(has(st, 'Casual', 'no Ranked player found'), f'A: the rematch should be Casual with the fallback line, got {st!r}')
                riv = await text(A, '#vsRiv')
                expect(await shown(A, '#vsRiv') and has(riv, 'You lead 1–0'), f'A: the VS pill should say You lead 1–0, got {riv!r}')
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

            # ---- 4. C and A in Ranked; A forfeits from the pause menu. A carries a 3-win streak: C takes its bounty
            set_on(d, ac, {'ws': 3})
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
                w = await text(C, '#vsWR')
                expect(not await C.evaluate("document.getElementById('vsWR').hidden") and has(w, 'Wanted', '3 win streak', '30'), f"C: A's wanted plate should show on the VS screen, got {w!r}")
                if await shown(C, '#qmVs'):
                    await C.wait_for_timeout(500); await shot(C, 'vs-390')
                expect(has(await text(C, '#vsTagR'), 'Wanted'), 'C: the WANTED tag on A\'s nameplate')
                expect(has(await text(C, '#vsRiv'), 'First meeting'), f"C: a first meeting, got {await text(C, '#vsRiv')!r}")
            chips0 = (prof_rec(d, await code(C)) or {}).get('prof', {}).get('tokens')
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
            await A.set_viewport_size(TINY); await A.wait_for_timeout(450); await shot(A, 'result-forfeit-667'); await A.set_viewport_size(PHONE)
            # the bounty: C's chips tile wears it, the server paid it into C's account (the page never adds it), A's streak is gone
            expect(await shown(C, '#rChipT .rv-bty') and has(await text(C, '#rWhy'), 'Bounty +30'), f"C: the BOUNTY +30 sticker and line, got {await text(C, '#rWhy')!r}")
            expect(has(await text(C, '#rSub'), 'ended their 3-win streak'), f"C: the story line names the streak, got {await text(C, '#rSub')!r}")
            expect(has(await text(A, '#rSub'), '3-win streak ends', 'took the 30 bounty'), f"A: the streak lost, got {await text(A, '#rSub')!r}")
            pc = prof_rec(d, await code(C))
            expect(pc and chips0 is not None and pc['prof']['tokens'] >= chips0 + 30, f"server: C's account should hold the 30 bounty (before {chips0}, now {pc and pc['prof'].get('tokens')})")
            expect(rc and rc.get('ws') == 1 and ra2 and ra2.get('ws') == 0, f'server: the streaks should be C 1, A 0, got {rc and rc.get("ws")}, {ra2 and ra2.get("ws")}')
            await wait(C, "window.__blastline.qm.me && JSON.parse(localStorage.getItem('potatobrawl.profile.v1') || '{}').tokens >= %d" % ((chips0 or 0) + 30), 'C: the bounty arrives on the phone with the sync', 20)
            # the menu: the hero shows the online rank and record, the plate the online rating
            await tap(A, '#rMenu')
            await wait(A, "window.__blastline.mode === 'menu'", 'A: the menu')
            await A.wait_for_timeout(500)
            hero = await text(A, '#bRanked')
            expect(has(hero, 'Quick match', 'Placing', '2 of 5') and not await shown(A, '#bRanked .qm-s1'), f'A: the hero shows the placement and no sticker now, got {hero!r}')
            expect(ra2 and (await text(A, '#mRating')).strip() == str(ra2['r']), 'A: the profile plate shows the online rating')
            await shot(A, 'menu-844')

            # ---- 5. the Rivals list (A: Mash Master and Tuber Tom) and a streaker's rank plate (C on a 4-win streak)
            await tap(A, '#mRank'); await tap(A, '#acTabS'); await A.wait_for_timeout(500)
            rl = await text(A, '#acPanS')
            expect(has(rl, 'Rivals', 'Mash Master', 'Tuber Tom'), f'A: the Rivals list should name both opponents, got {(rl or "")[:200]!r}')
            await shot(A, 'rivals-844')
            await A.set_viewport_size(DESK); await A.wait_for_timeout(450); await shot(A, 'rivals-1280')
            await A.set_viewport_size(TINY); await A.wait_for_timeout(450); await shot(A, 'rivals-667')
            await A.set_viewport_size(PHONE)
            await tap(C, '#rMenu'); await wait(C, "window.__blastline.mode === 'menu'", 'C: the menu')
            set_on(d, await code(C), {'ws': 4}); await reauth(C, await code(C))
            await wait(C, "window.__blastline.qm.me && window.__blastline.qm.me.ws === 4", 'C: the 4-win streak arrives with a new sign-in', 10)
            await C.wait_for_timeout(300)
            expect(has(await text(C, '#bRanked'), '4 win streak', '40 bounty on you'), f"C: the hero should say the bounty is on you, got {await text(C, '#bRanked')!r}")
            await tap(C, '#bRanked'); await wait(C, "window.__blastline.mode === 'quick'", 'C: Quick match opens'); await C.wait_for_timeout(500)
            expect(await shown(C, '#qmWant') and has(await text(C, '#qmRec'), '4 win streak', 'Bounty 40'), f"C: the rank plate should wear WANTED, got {await text(C, '#qmRec')!r}")
            await shot(C, 'quick-wanted-390'); await overflow(C, 'C wanted 390')
            await plates(C, 'C wanted', UP_SIZES, UP)
            await tap(C, '#qmBack'); await wait(C, "window.__blastline.mode === 'menu'", 'C: back to the menu')
            await tap(C, '#mRank'); await tap(C, '#acTabS'); await C.wait_for_timeout(500)
            expect(has(await text(C, '#acPanS'), 'Rivals', 'Peel Appeal'), 'C: the Rivals list upright names Peel Appeal')
            await shot(C, 'rivals-390'); await overflow(C, 'C rivals 390')

            # ---- 6. the plates at every size: A as Diamond 1561 (the long "89 to Blastmaster" line), B placing 1 of 5 on the desktop
            set_on(d, ac, {'n': 40, 'r': 1561, 'w': 104, 'l': 98})
            for t, pg, sizes, vp in (('A', A, PH_SIZES, PHONE), ('B', B, DK_SIZES, DESK)):
                await pg.goto(URL)
                await wait(pg, "window.__blastline && window.__blastline.mode === 'menu' && window.__blastline.qm.conn && window.__blastline.qm.me", f'{t}: the menu signed in')
                await pg.wait_for_timeout(400)
                await plates(pg, f'{t} menu', sizes, vp, quick=False)
                await tap(pg, '#bRanked'); await wait(pg, "window.__blastline.mode === 'quick'", f'{t}: Quick match opens'); await pg.wait_for_timeout(500)
                def placed(w, h, r, t=t):
                    if t == 'B' and r['thin']: expect(r['pips'] == 1, f'B {w}x{h}: one pip of five should be lit, got {r["pips"]}')
                await plates(pg, f'{t} plate', sizes, vp, check=placed)
            expect(has(await text(A, '#qmTier'), 'Diamond'), f"A: the plate should show Diamond, got {await text(A, '#qmTier')!r}")
            await A.set_viewport_size({'width': 740, 'height': 360}); await A.wait_for_timeout(300); await shot(A, 'quick-diamond-740')
            await B.set_viewport_size({'width': 800, 'height': 700}); await B.wait_for_timeout(300); await shot(B, 'quick-placing-800x700')

            # ---- 7. C: VS CPU (Ranked vs CPU): the server deals the match, the VS screen wears the CPU sticker, a forfeit counts on the CPU rank
            await tap(C, '#acClose'); await C.wait_for_timeout(300)   # the Account sheet from step 5
            await wait(C, "window.__blastline.mode === 'menu'", 'C: the menu')
            await tap(C, '#bRanked')
            await wait(C, "window.__blastline.mode === 'quick'", 'C: Quick match again')
            await tap(C, '#qmV')
            await C.wait_for_timeout(400)
            expect(await C.evaluate("window.__blastline.qm.mode") == 'v' and has(await text(C, '#qmFind'), 'Fight a CPU'), f"C: VS CPU picked, the button says Fight a CPU, got {await text(C, '#qmFind')!r}")
            expect(has(await text(C, '#qmRank'), 'Placing', '0 of 5', 'CPU rank', 'CPU board after 5 more'), f"C: the plate shows the CPU rank, got {await text(C, '#qmRank')!r}")
            expect(has(await text(C, '#qmTruth'), 'Placement 1 of 5', 'Hard CPU'), f"C: the line under the button names the next CPU, got {await text(C, '#qmTruth')!r}")
            await shot(C, 'quick-vscpu-390'); await overflow(C, 'C VS CPU 390')
            await tap(C, '#qmFind')
            if await wait(C, "!document.getElementById('qmVs').hidden", 'C: the VS screen for the CPU match', 15):
                await C.wait_for_timeout(500)
                expect(await shown(C, '#vsCpu') and has(await text(C, '#vsMode'), 'Ranked', 'CPU') and has(await text(C, '#qmVs'), '1650', 'Hard CPU'), f"C: the VS screen shows the CPU sticker and its rating, got {await text(C, '#qmVs')!r}")
                await shot(C, 'vs-cpu-390')
            await wait(C, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", 'C: the CPU match starts', 15)
            expect(await shown(C, '#vcStrip') and has(await text(C, '#vcStrip'), 'Ranked vs CPU', 'placement 1 of 5'), f"C: the HUD says the match counts, got {await text(C, '#vcStrip')!r}")
            await C.wait_for_timeout(400)
            await C.keyboard.press('Escape'); await C.wait_for_timeout(300)
            expect(has(await text(C, '#pQuit'), 'Forfeit') and has(await text(C, '#pNote'), 'counts as a loss'), f"C: VS CPU pause says Forfeit, got {await text(C, '#pNote')!r}")
            await tap(C, '#pQuit'); await tap(C, '#pQuit')
            await wait(C, "window.__blastline.mode === 'result'", 'C: the VS CPU results')
            await wait(C, "window.__blVc.res && window.__blVc.res.why === 'ff' && !window.__blVc.pend", 'C: the server counts the CPU forfeit', 15)
            await C.wait_for_timeout(1200)
            expect(has(await text(C, '#rTitle'), 'Forfeit') and has(await text(C, '#rStick'), 'forfeit') and has(await text(C, '#rBoardL'), 'CPU board after 4 more'), f"C: Forfeit, the sticker and the board line, got {await text(C, '#rRank')!r}")
            expect(has(await text(C, '#rAgain'), 'Another CPU fight'), 'C: the results offer Another CPU fight')
            await shot(C, 'result-vscpu-390')
            rc = None
            for f in pathlib.Path(d).glob('*.json'):
                j = json.loads(f.read_text())
                if j.get('cpu'): rc = j['cpu']
            expect(rc and rc['n'] == 1 and rc['l'] == 1 and rc['h'][0]['why'] == 'ff' and not rc['tk'], f'server: C should have one CPU loss by forfeit, got {rc}')
            await tap(C, '#rChange')
            await wait(C, "window.__blastline.mode === 'quick'", 'C: back to Quick match from the CPU results')
            expect(has(await text(C, '#qmRank'), '1 of 5', 'CPU rank'), f"C: the plate counts the match, got {await text(C, '#qmRank')!r}")
            await tap(C, '#qmBdl')   # the board line opens the Boards sheet on the CPU board: nobody placed yet, your row says placing
            await C.wait_for_timeout(900)
            bd = await text(C, '#scrBoards')
            expect(await shown(C, '#scrBoards') and has(bd, 'VS CPU', 'Online', 'Nobody on the board yet', 'Placing 1 of 5'), f"C: the Boards sheet on the CPU board, got {bd!r}")
            await shot(C, 'boards-cpu-390')
            await C.keyboard.press('Escape'); await C.wait_for_timeout(300)
            expect(not await shown(C, '#scrBoards'), 'C: Esc closes the Boards sheet')
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
