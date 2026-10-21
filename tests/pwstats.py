"""Play counts in the browser (ui/counter.js) against a real `node server.js` with a temporary STATS_DIR on port 8098: what a new
player's first visit sends (welcome sheet, tutorial skipped into the first fight, that won, Rematch, a quit, where they left), a second visit on the same
day, Settings > Play counts Off and On, a browser with Global Privacy Control, a player from before the counter (and their Team Brawl 2v2 win), a player coming back
three days later (came back within 3/7/14/30 days, not 1), an error on the page, and a server with the counter off (one try, then
silence). Prints one line per problem, then "no errors".
Usage:  python3 tests/pwstats.py        (needs `python3 game/build.py` first)"""
import asyncio, os, re, json, subprocess, tempfile, shutil, time, pathlib, urllib.request, datetime
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWSTATS_PORT', 8098))
URL = f'http://127.0.0.1:{PORT}/'
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
TZ = 'Europe/Berlin'
PROF = 'potatobrawl.profile.v1'
NOTE = 'potatobrawl.count.v1'
G = 'window.__blastline.game'
PROTO = re.search(r'const PROTO = (\d+)', (ROOT / 'game' / 'ui' / 'online.js').read_text()).group(1)
errs = []
def expect(ok, msg):
    if not ok: errs.append(msg)

def start_server(stats_dir):
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0')
    env.pop('STATS_DIR', None); env.pop('ACCOUNTS_DIR', None)
    if stats_dir: env['STATS_DIR'] = stats_dir
    p = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            if urllib.request.urlopen(URL + 'health', timeout=1).status == 200: return p
        except Exception: time.sleep(0.2)
    p.kill(); raise RuntimeError('server did not start')
def stop_server(p):
    p.terminate()
    try: p.wait(5)
    except Exception: p.kill()

def counts(stats_dir):
    key = (pathlib.Path(stats_dir) / 'key').read_text().strip()
    rq = urllib.request.Request(URL + 'api/stats/data', data=json.dumps({'key': key}).encode(), headers={'content-type': 'application/json'})
    d = json.loads(urllib.request.urlopen(rq, timeout=5).read())
    return d['days'].get(d['today'], {})

async def page(b, tag, init=None, vp=(1280, 760)):
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, timezone_id=TZ, locale='en-US')
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page()
    pg.hits = []
    pg.on('request', lambda r: pg.hits.append(r.post_data or '') if '/api/stats/hit' in r.url else None)
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}') if 'pwstats boom' not in str(e) else None)
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)   # also none when the counts are off
    await pg.goto(URL)
    await pg.wait_for_function("window.__blastline && window.__blCount", timeout=20000)
    await pg.evaluate("window.__blastline.perf.lockQ = true")
    return ctx, pg

async def flush(pg, wait=500):
    await pg.evaluate("window.__blCount.flush()")
    await pg.wait_for_timeout(wait)

async def mode_is(pg, m, timeout=30000):
    await pg.wait_for_function(f"window.__blastline.mode === '{m}'", timeout=timeout)

async def win_match(pg):
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000)
    await pg.wait_for_timeout(300)
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }})()")
    await mode_is(pg, 'result', 90000)
    await pg.wait_for_timeout(1100)

async def welcome_go(pg):
    # a brand-new device: the welcome sheet (ui/welcome.js) over the menu; "Play the tutorial" starts the tutorial
    await mode_is(pg, 'menu')
    await pg.wait_for_function("!document.getElementById('scrWelcome').hidden", timeout=10000)
    await pg.click('#welGo'); await mode_is(pg, 'match')

def day_str(days_ago=0):
    return (datetime.datetime.now(ZoneInfo(TZ)) - datetime.timedelta(days=days_ago)).strftime('%Y-%m-%d')

async def counted(b, sd):
    # --- a brand-new player: the welcome sheet; take the tutorial, skip it (a new player goes on to the first fight), win that, Rematch, quit it, leave the page
    ctx, pg = await page(b, 'new')
    await welcome_go(pg)
    expect(await pg.evaluate("window.__blCount.on"), 'new: counting is not on')
    note = await pg.evaluate("window.__blCount.note")
    expect(note and note.get('f') == day_str() and note.get('x') == 0, f'new: the note does not mark a new device today: {note}')
    await pg.click('#tutSkip')
    await pg.wait_for_function("window.__blastline.fh.on", timeout=30000)   # the first fight (a Practice match with the hints)
    await win_match(pg)
    await pg.click('#rAgain')
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000)
    await pg.click('#pauseBtn'); await pg.wait_for_timeout(200)
    await pg.click('#pQuit'); await mode_is(pg, 'menu')
    await flush(pg)
    fighter = await pg.evaluate("JSON.parse(localStorage.getItem('%s')).last" % PROF)
    await pg.goto('about:blank'); await pg.wait_for_timeout(800)   # pagehide: the first-visit beacon
    c = counts(sd)
    want = {'day': 1, 'day:new': 1, 'wk': 1, 'mo': 1, 'dev:desktop': 1, 'app:web': 1, 'lang:en': 1, f'ver:{PROTO}': 1,
            'ms:tutorial': 1, 'tut:go': 1, 'tut:move': 1, 'me:tutorial:quit': 1, 'tut:skip': 1,
            'ms:practice': 2, f'fp:{fighter}': 2, 'me:practice:win': 1, 'me:practice:quit': 1, 'ml:0': 1, 'again:practice': 1,
            'fn:s1': 1, 'first:practice': 1, 'fn:d1': 1, 'fn:s2': 1, 'fx:menu': 1, 'fl:0': 1, 'fm:1': 1}
    for k, v in want.items(): expect(c.get(k) == v, f'new: {k} = {c.get(k)}, want {v}')
    for k in ('day:back', 'tut:done', 'tut:fight', 'mslow', 'me:practice:loss', 'inv'): expect(k not in c, f'new: {k} should not be counted ({c.get(k)})')
    expect(not any(k.startswith('err:') for k in c), f'new: errors were counted: {[k for k in c if k.startswith("err:")]}')

    # --- the same device again today: no second hello, no new-player steps; Settings > Play counts Off stops it, On starts again
    pg = await ctx.new_page()
    pg.hits = []
    pg.on('request', lambda r: pg.hits.append(r.post_data or '') if '/api/stats/hit' in r.url else None)
    pg.on('pageerror', lambda e: errs.append(f'again: {e}'))
    await pg.goto(URL); await mode_is(pg, 'menu'); await pg.evaluate("window.__blastline.perf.lockQ = true")
    await flush(pg)
    c2 = counts(sd)
    expect(c2.get('day') == 1 and c2.get('ms:tutorial') == 1, f'again: a second visit the same day counted a new hello or tutorial ({c2.get("day")}, {c2.get("ms:tutorial")})')
    await pg.click('#bSettings'); await pg.wait_for_timeout(300)
    expect(await pg.is_visible('#setCountRow') and await pg.is_visible('#setCountNote'), 'settings: the Play counts row is not shown')
    await flush(pg)
    await pg.click('#setCount .chip:nth-child(2)')   # Off
    expect(not await pg.evaluate("window.__blCount.on") and await pg.evaluate("JSON.parse(localStorage.getItem('%s')).off === true" % NOTE), 'settings: Off did not stop counting')
    await pg.click('#setClose'); await pg.click('#bPractice'); await mode_is(pg, 'select'); await pg.click('#selGo')
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000)
    n = len(pg.hits); await flush(pg)
    expect(len(pg.hits) == n and counts(sd).get('ms:practice') == 2, 'settings: a match was counted while Play counts was Off')
    await pg.click('#pauseBtn'); await pg.wait_for_timeout(200); await pg.click('#pQuit'); await mode_is(pg, 'menu')
    await pg.reload(); await mode_is(pg, 'menu'); await pg.wait_for_timeout(300)
    expect(not await pg.evaluate("window.__blCount.on"), 'settings: Off did not last over a reload')
    await pg.click('#bSettings'); await pg.wait_for_timeout(300)
    await pg.click('#setCount .chip:nth-child(1)')   # On
    await flush(pg)
    c3 = counts(sd)
    note = await pg.evaluate("window.__blCount.note")
    expect(await pg.evaluate("window.__blCount.on") and c3.get('day:back') == 1 and c3.get('day') == 2 and note.get('f') == '' and c3.get('fn:s1') == 1,
           f'settings: On again should count a returning device, not a new one ({c3.get("day")}, {c3.get("day:back")}, {note})')
    expect(c3.get('scr:settings') == 1, f'settings: scr:settings = {c3.get("scr:settings")}')
    await ctx.close()

    # --- Global Privacy Control: nothing is sent; Settings shows Off and can't turn it on
    ctx, pg = await page(b, 'gpc', "Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });")
    await pg.wait_for_timeout(500)
    await flush(pg)
    expect(not await pg.evaluate("window.__blCount.on") and not pg.hits, f'gpc: something was sent ({len(pg.hits)})')
    await pg.goto('about:blank'); await pg.wait_for_timeout(300)
    expect(counts(sd).get('day') == 2, 'gpc: a hello was counted')
    await ctx.close()

    # --- a player from before the counter (a saved profile, no note): a returning player, never a new one
    old = json.dumps(json.dumps({'tokens': 50, 'rating': 1040, 'matches': 5, 'wins': 3, 'losses': 2, 'tut': True, 'last': 'odin'}))
    ctx, pg = await page(b, 'old', "if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, old))
    await mode_is(pg, 'menu'); await flush(pg)
    note = await pg.evaluate("window.__blCount.note")
    c4 = counts(sd)
    expect(note.get('f') == '' and note.get('x') == 1 and c4.get('day:back') == 2 and c4.get('day:new') == 1, f'old: not counted as a returning player ({note}, {c4.get("day:back")})')
    # Team Brawl 2v2 (ui/duo.js) is its own mode, "team"
    await pg.click('#bPractice'); await mode_is(pg, 'select')
    await pg.click('#oppPick'); await pg.wait_for_timeout(250)
    await pg.evaluate("[...document.querySelectorAll('#oppPop button')].find((b) => b.textContent.endsWith('Team Brawl 2v2')).click()"); await pg.wait_for_timeout(250)
    await pg.click('#selGo')
    await pg.wait_for_function(f"{G} && {G}.phase === 'play' && {G}.fighters.length === 4", timeout=90000)
    await pg.wait_for_timeout(300)
    await pg.evaluate(f"(() => {{ const g = {G}; for (const i of [2, 3]) {{ g.fighters[i].stocks = 1; g.fighters[i].x = 5000; }} }})()")
    await mode_is(pg, 'result', 90000)
    await flush(pg)
    c4 = counts(sd)
    expect(c4.get('ms:team') == 1 and c4.get('me:team:win') == 1 and c4.get('fp:odin') == 1, f'old: a 2v2 win is not counted as team ({c4.get("ms:team")}, {c4.get("me:team:win")}, {c4.get("fp:odin")})')
    await ctx.close()

    # --- back three days after the first visit: came back within 3, 7, 14 and 30 days (not 1); an error on the page is counted once
    f = day_str(3)
    back = json.dumps(json.dumps({'f': f, 'l': f, 'w': '', 'm': '', 'r': 0, 's': 1, 'd': 1, 'k': {'fn:s1': 1, 'fn:d1': 1}, 'x': 1}))
    ctx, pg = await page(b, 'back', ("if (localStorage.getItem('%s') === null) { localStorage.setItem('%s', %s); localStorage.setItem('%s', %s); }"
                                     % (NOTE, NOTE, back, PROF, old)))
    await mode_is(pg, 'menu')
    await pg.evaluate("setTimeout(() => { throw new Error('pwstats boom') }, 0); setTimeout(() => { throw new Error('pwstats boom') }, 0)")
    await pg.wait_for_timeout(300)
    await flush(pg)
    c5 = counts(sd)
    for T in (3, 7, 14, 30): expect(c5.get(f'ret:{f}:{T}') == 1, f'back: ret:{f}:{T} = {c5.get(f"ret:{f}:{T}")}')
    expect(f'ret:{f}:1' not in c5, 'back: counted as back within 1 day')
    expect(c5.get('day:back') == 3, f'back: day:back = {c5.get("day:back")}')
    boom = [k for k in c5 if k.startswith('err:Error: pwstats boom')]
    expect(len(boom) == 1 and c5[boom[0]] == 1, f'back: the error was not counted once: {boom}')
    await ctx.close()

async def off(b):
    # --- a server with the counter off: one try at the start, then nothing more for the visit, and no page errors
    ctx, pg = await page(b, 'off')
    await welcome_go(pg)
    await pg.wait_for_timeout(600)
    await pg.click('#tutSkip')
    await pg.wait_for_function("window.__blastline.fh.on", timeout=30000)
    await pg.click('#pauseBtn'); await pg.wait_for_timeout(200)
    await pg.click('#pQuit'); await mode_is(pg, 'menu'); await flush(pg)
    expect(len(pg.hits) == 1 and await pg.evaluate("window.__blCount.dead"), f'off: {len(pg.hits)} hits sent, want 1 and then silence')
    await pg.click('#bSettings'); await pg.wait_for_timeout(300)
    expect(await pg.is_visible('#setCountRow'), 'off: the Settings row should still show on our own server')
    await ctx.close()

async def main():
    sd = tempfile.mkdtemp(prefix='pwstats-')
    srv = start_server(sd)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            try: await counted(b, sd)
            except Exception as e: errs.append(f'counted: {e}')
            stop_server(srv); srv = start_server(None)
            try: await off(b)
            except Exception as e: errs.append(f'off: {e}')
            await b.close()
    finally:
        stop_server(srv); shutil.rmtree(sd, ignore_errors=True)
    for e in errs: print(e)
    if not errs: print('no errors')

asyncio.run(main())
