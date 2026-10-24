"""Play counts in the browser (ui/counter.js) against a real `node server.js` with a temporary STATS_DIR on port 8098: an automated
browser (sends nothing), what a new player's first visit sends (only "open" before the first tap; welcome sheet, tutorial skipped into the first fight,
that won, Rematch, a quit, where they left), a second visit on the same day, Settings > Play counts Off and On, play time (pt and its day marks), a browser
with Global Privacy Control, a player from before the counter (and their Team Brawl 2v2 win), a player coming back three days later (came back within
3/7/14/30 days, not 1), an error on the page, a device that only looked on an earlier day (new on the day it first taps), and a server with the counter
off (one try, then silence). The pages pass as a person's browser (HUMAN_UA, navigator.webdriver false); the automated one keeps Playwright's. Prints one line per problem, then "no errors".
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
HUMAN_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
HUMAN = "Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });"   # Playwright's browser says it is automated
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

async def page(b, tag, init=None, vp=(1280, 760), path='', human=True):
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, timezone_id=TZ, locale='en-US', **({'user_agent': HUMAN_UA} if human else {}))
    if human: await ctx.add_init_script(HUMAN)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page()
    pg.hits = []
    pg.on('request', lambda r: pg.hits.append(r.post_data or '') if '/api/stats/hit' in r.url else None)
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}') if 'pwstats boom' not in str(e) else None)
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)   # also none when the counts are off
    await pg.goto(URL + path)
    await pg.wait_for_function("window.__blastline && window.__blCount", timeout=20000)
    await pg.evaluate("window.__blastline.perf.lockQ = true")
    return ctx, pg

async def tap(pg):   # a real key press: the visit's first input makes the device a player (ui/counter.js cntGo)
    await pg.keyboard.press('Shift'); await pg.wait_for_timeout(50)

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

def played(c): return {k: v for k, v in c.items() if k != 'peak'}   # peak is the server's own sample

async def counted(b, sd):
    # --- an automated browser (Playwright's own: navigator.webdriver, HeadlessChrome): nothing at all, even after a tap
    ctx, pg = await page(b, 'bot', human=False)
    await mode_is(pg, 'menu'); await tap(pg); await flush(pg)
    expect(not await pg.evaluate("window.__blCount.on") and not pg.hits, f'bot: counted ({len(pg.hits)} hits)')
    await pg.goto('about:blank'); await pg.wait_for_timeout(300)
    expect(not played(counts(sd)), f'bot: the day has counts {played(counts(sd))}')
    await ctx.close()

    # --- a brand-new player: only "open" until the first tap; the welcome sheet; take the tutorial, skip it (a new player goes on to the first fight), win that, Rematch, quit it, leave the page
    ctx, pg = await page(b, 'new')
    await mode_is(pg, 'menu'); await pg.wait_for_timeout(300); await flush(pg)
    expect(not await pg.evaluate("window.__blCount.go") and played(counts(sd)) == {'open': 1}, f'new: before a tap the day should hold only open: {played(counts(sd))}')
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
    want = {'open': 1, 'day': 1, 'day:new': 1, 'wk': 1, 'mo': 1, 'dev:desktop': 1, 'app:web': 1, 'lang:en': 1, f'ver:{PROTO}': 1,
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
    expect(c2.get('day') == 1 and c2.get('open') == 1 and c2.get('ms:tutorial') == 1, f'again: a second visit the same day counted a new hello or tutorial ({c2.get("open")}, {c2.get("day")}, {c2.get("ms:tutorial")})')
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
    # play time: one pt a minute; the day's 5 and 15 minute marks once (the minutes of the first visit go on after Off / On)
    tm0 = (await pg.evaluate("window.__blCount.note")).get('tm', 0)
    await pg.evaluate("window.__blCount.minutes(16)"); await flush(pg)
    c3 = counts(sd); tm = (await pg.evaluate("window.__blCount.note")).get('tm')
    expect(tm0 < 5 and tm == tm0 + 16 and c3.get('pt') == tm and c3.get('pt:5') == 1 and c3.get('pt:15') == 1 and 'pt:30' not in c3,
           f'time: {tm0} + 16 minutes: note {tm}, pt {c3.get("pt")}, marks {c3.get("pt:5")} {c3.get("pt:15")} {c3.get("pt:30")}')
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
    await mode_is(pg, 'menu'); await tap(pg); await flush(pg)
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
    await tap(pg); await flush(pg)
    c5 = counts(sd)
    for T in (3, 7, 14, 30): expect(c5.get(f'ret:{f}:{T}') == 1, f'back: ret:{f}:{T} = {c5.get(f"ret:{f}:{T}")}')
    expect(f'ret:{f}:1' not in c5, 'back: counted as back within 1 day')
    expect(c5.get('day:back') == 3, f'back: day:back = {c5.get("day:back")}')
    boom = [k for k in c5 if k.startswith('err:Error: pwstats boom')]
    expect(len(boom) == 1 and c5[boom[0]] == 1, f'back: the error was not counted once: {boom}')
    # Challenge a friend (ui/challenge.js) on a computer: after a practice win the tap copies the line and the link, hosts that room, and
    # the lobby's link card says Link copied; a link made is counted
    await pg.evaluate("window.__copied = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } })")
    await pg.click('#bPractice'); await mode_is(pg, 'select'); await pg.click('#selGo')
    await win_match(pg)
    expect(await pg.is_visible('#rChl'), 'challenge: no Challenge a friend after a practice win')
    await pg.click('#rChl')
    await pg.wait_for_function("window.__blastline.net.phase === 'hosting'", timeout=20000)
    code = await pg.evaluate("window.__blastline.net.hostCode")
    cp = await pg.evaluate("window.__copied")
    expect(re.fullmatch(r'ch[a-z0-9]{7}', code or '') is not None and cp == f'Think you can beat my Odin? {URL}#join-{code}', f'challenge: copied {cp!r} for the room {code!r}')
    await pg.wait_for_timeout(300)
    expect(await pg.evaluate("document.getElementById('onCopy').textContent") == 'Link copied', 'challenge: the link card does not say Link copied')
    await flush(pg)
    expect(counts(sd).get('chl:make') == 1, f'challenge: chl:make = {counts(sd).get("chl:make")}')
    await ctx.close()
    # a brand-new device opens a challenge link whose match is closed: counted as opened (and by a new player), the lobby says it isn't open right now
    ctx, pg = await page(b, 'link', path='#join-chabc1234')
    await mode_is(pg, 'online'); await tap(pg); await flush(pg)
    c6 = counts(sd)
    expect(c6.get('chl:open') == 1 and c6.get('chl:new') == 1 and c6.get('inv') == 1, f'link: chl:open {c6.get("chl:open")}, chl:new {c6.get("chl:new")}, inv {c6.get("inv")}')
    await pg.wait_for_function("document.querySelector('#onList li.empty') && document.querySelector('#onList li.empty').textContent.includes('right now')", timeout=15000)
    await ctx.close()
    # --- a device that only looked two days ago (opened, no tap): today's first tap makes it a new player from today
    f = day_str(2)
    look = json.dumps(json.dumps({'f': f, 'l': '', 'w': '', 'm': '', 'r': 0, 's': 0, 'd': 0, 'k': {}, 'x': 0, 'p': 1, 'o': f}))
    c7 = counts(sd)
    ctx, pg = await page(b, 'look', "if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (NOTE, NOTE, look))
    await mode_is(pg, 'menu'); await flush(pg)
    c8 = counts(sd)
    expect(c8.get('open') == c7.get('open', 0) + 1 and c8.get('day') == c7.get('day'), f'look: before the tap open {c7.get("open")} -> {c8.get("open")}, day {c7.get("day")} -> {c8.get("day")}')
    await tap(pg); await flush(pg)
    c8 = counts(sd); note = await pg.evaluate("window.__blCount.note")
    expect(c8.get('day:new') == c7.get('day:new', 0) + 1 and note.get('f') == day_str() and 'p' not in note, f'look: not new today after the tap ({c7.get("day:new")} -> {c8.get("day:new")}, {note})')
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
