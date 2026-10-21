"""The private stats page (web/stats.html, served at /stats) against a real `node server.js` on port 8096.
Writes sample day files with tests/stats-sample.js, starts the server with STATS_DIR pointing at them, then checks the page at three
sizes (390x844, 844x390, 1280x800; 360 wide for the no-sideways-scroll check) and for each range (Today / Week / Month): no sideways
scroll, the main numbers match the day files (worked out here from the raw JSON), no page errors, no Content-Security-Policy violations,
text from the data is shown as text. Then the empty data folder, a wrong key, no key, an unreachable server, and dark mode.
Prints one line per problem, then "no errors". Screenshots go to the folder in argv[1] (default build/shots/stats).
Usage:  python3 game/build.py && python3 tests/pwstatspage.py [outdir]"""
import asyncio, sys, os, re, json, subprocess, tempfile, shutil, time, pathlib, datetime, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWSTATSPAGE_PORT', 8096))
BASE = f'http://127.0.0.1:{PORT}'
KEY = '0123456789abcdef0123456789abcdef'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'stats')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
SIZES = [('phone', {'width': 390, 'height': 844}, True), ('land', {'width': 844, 'height': 390}, True), ('desk', {'width': 1280, 'height': 800}, False)]
RANGES = ['today', 'week', 'month']
SECTIONS = ['Pulse', 'New players', 'Coming back', 'What they play', 'Hooks', 'Online', 'Health']
FONT_RE = re.compile(r'fonts\.(googleapis|gstatic)\.com')
errs = []
def expect(ok, msg):
    if not ok: errs.append(msg)

# ---------- the server
def gen(d, *extra):
    r = subprocess.run(['node', 'tests/stats-sample.js', d, *extra], cwd=ROOT, capture_output=True, text=True)
    if r.returncode: raise RuntimeError('stats-sample.js failed: ' + r.stderr[-300:])
def start_server(stats_dir):
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0', STATS_DIR=stats_dir)
    env.pop('ACCOUNTS_DIR', None)
    p = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(60):
        try:
            if urllib.request.urlopen(BASE + '/health', timeout=1).status == 200: return p
        except Exception: time.sleep(0.2)
    p.kill(); raise RuntimeError('server did not start')
def stop_server(p):
    if not p: return
    p.terminate()
    try: p.wait(5)
    except Exception: p.kill()
def api(key=KEY):
    req = urllib.request.Request(BASE + '/api/stats/data', data=json.dumps({'key': key}).encode(), headers={'content-type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=10).read())

# ---------- what the numbers should be, worked out from the raw day files
def expected(data):
    days, today = data['days'], datetime.date.fromisoformat(data['today'])
    mon = today - datetime.timedelta(days=today.weekday())
    first = {'today': today, 'week': mon, 'month': today.replace(day=1)}
    out = {}
    for r in RANGES:
        ds = [(first[r] + datetime.timedelta(days=i)).isoformat() for i in range((today - first[r]).days + 1)]
        g = lambda k: sum(days.get(d, {}).get(k, 0) for d in ds)
        out[r] = {'players': g({'today': 'day', 'week': 'wk', 'month': 'mo'}[r]), 'new': g('day:new'),
                  'started': sum(v for d in ds for k, v in days.get(d, {}).items() if k.startswith('ms:'))}
    out['monday'] = f'{mon.day} {mon.strftime("%b")}'
    return out

# ---------- the pages
def watch(pg, tag, allow=()):
    pg.on('pageerror', lambda e: errs.append(f'{tag}: page error: {e}'))
    def con(m):
        if m.type != 'error': return
        url = (m.location or {}).get('url', '') or ''
        if FONT_RE.search(url) or FONT_RE.search(m.text) or any(a in url for a in allow): return
        errs.append(f'{tag}: console: {m.text} {url}')
    pg.on('console', con)
    def failed(r):
        if FONT_RE.search(r.url) or any(a in r.url for a in allow): return
        errs.append(f'{tag}: request failed: {r.url} {r.failure}')
    pg.on('requestfailed', failed)
CSP_JS = "window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));"
async def device(b, vp, mob, scheme='light'):
    ctx = await b.new_context(viewport=vp, device_scale_factor=1, is_mobile=mob, has_touch=mob, color_scheme=scheme)
    await ctx.add_init_script(CSP_JS)
    return ctx
async def state(pg, want, secs=15):   # polls by hand: the page's Content-Security-Policy refuses the eval that wait_for_function uses
    for _ in range(int(secs / 0.1)):
        if await pg.evaluate("document.getElementById('main').dataset.state") == want: break
        await pg.wait_for_timeout(100)
    else: raise RuntimeError(f"the page never reached the state {want!r}")
    await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(250)
async def shot(pg, tag): await pg.screenshot(path=str(OUT / f'{tag}.png'), full_page=True)
async def text(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return e ? e.textContent : null }", sel)
async def csp(pg, tag):
    for v in await pg.evaluate('window.__csp || []'): errs.append(f'{tag}: CSP violation: {v}')
async def fit(pg, tag):   # nothing sideways: not the page, and no element reaching past the right edge
    r = await pg.evaluate("""() => {
      const W = innerWidth, bad = [];
      for (const e of document.querySelectorAll('main *')) { const b = e.getBoundingClientRect(); if (b.width && b.right > W + 1) bad.push((e.className || e.tagName) + ' ' + Math.round(b.right)); }
      return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 4) }; }""")
    expect(r['sw'] <= r['W'], f'{tag}: sideways scroll (page {r["sw"]} px wide, window {r["W"]})')
    expect(not r['bad'], f'{tag}: sticks out on the right: {r["bad"]}')
async def sane(pg, tag):   # no leftovers of a bug in the text
    t = await pg.evaluate("(() => { const c = document.getElementById('main').cloneNode(true); c.querySelectorAll('.err').forEach((e) => e.remove()); return c.textContent; })()")   # (error messages are data and may say "undefined")
    for bad in ('NaN', 'undefined', '[object', 'Infinity', 'null'):
        expect(bad not in t, f'{tag}: the page shows "{bad}"')

async def populated(b, data):
    exp = expected(data)
    for name, vp, mob in SIZES:
        ctx = await device(b, vp, mob)
        pg = await ctx.new_page(); watch(pg, name)
        reqs = []
        pg.on('request', lambda r: reqs.append(r.url) if r.url.endswith('/api/stats/data') else None)
        await pg.goto(f'{BASE}/stats#{KEY}'); await state(pg, 'ok')
        expect('online now' in await text(pg, '#meta') and 'updated' in await text(pg, '#meta'), f'{name}: the "updated ... online now" line is missing')
        expect(await text(pg, 'h1') == 'PotatoBrawl · Stats', f'{name}: title is {await text(pg, "h1")!r}')
        expect(await pg.evaluate("document.querySelector('.pill[aria-pressed=true]').dataset.range") == 'week', f'{name}: Week is not the default range')
        heads = await pg.evaluate("[...document.querySelectorAll('main h2')].map((e) => e.textContent)")
        expect(heads == SECTIONS, f'{name}: sections are {heads}')
        for r in RANGES:
            tag = f'{name}_{r}'
            await pg.click(f'.pill[data-range={r}]'); await pg.wait_for_timeout(200)
            expect(await pg.evaluate(f"document.querySelector('.pill[data-range={r}]').getAttribute('aria-pressed')") == 'true', f'{tag}: pill not pressed')
            e = exp[r]
            got = (await text(pg, '.tiles .tile:first-child .v') or '').strip()
            expect(got == str(e['players']), f'{tag}: Players tile shows {got}, the day files say {e["players"]}')
            nv = (await text(pg, '.fn:first-of-type .num') or '').strip()
            expect(nv == f'{e["new"]:,}', f'{tag}: New players bar shows {nv}, the day files say {e["new"]}')
            base = await text(pg, 'main section:nth-of-type(2) .base')
            expect(base is not None and base.replace(',', '').startswith(f'{e["new"]} new player'), f'{tag}: New players base line is {base!r}')
            came = (await text(pg, '.tiles .tile:nth-child(2)') or '')
            expect(re.search(r'\d+ of \d+|\d+%|–', came) is not None, f'{tag}: Came back tile is {came!r}')
            expect(await pg.evaluate("document.querySelectorAll('.spark').length") == 1, f'{tag}: no sparkline')
            rows = await pg.evaluate("document.querySelectorAll('.cw').length")
            expect(1 <= rows <= 8, f'{tag}: {rows} cohort rows')
            expect(f'Week of {exp["monday"]}' in (await text(pg, '.cw:first-of-type .cw-t') or '') or f'Week of {exp["monday"]}' in (await text(pg, '.cw-t') or ''), f'{tag}: newest cohort row is not the week of {exp["monday"]}')
            if r != 'today' or e['started']:
                expect(await pg.evaluate("document.querySelectorAll('.mrow').length") >= 1, f'{tag}: no match modes shown')
            errl = await pg.evaluate("[...document.querySelectorAll('.err code')].map((e) => e.textContent)")
            expect(any('<u id=xss>' in x for x in errl), f'{tag}: the error message with markup is not shown as text ({errl[:2]})')
            expect(await pg.evaluate("!document.getElementById('xss')"), f'{tag}: markup from an error message was turned into an element')
            if r == 'month':
                chl = await pg.evaluate("[...document.querySelectorAll('.kv > div')].map((e) => e.textContent).find((t) => t.startsWith('Challenge links made')) || ''")
                expect(re.search(r'opened · \d+ new players? · \d+ match', chl) is not None, f'{tag}: the Challenge links row reads {chl!r}')
            await sane(pg, tag); await fit(pg, tag)
            await shot(pg, tag)
        if name == 'phone':
            # the range pills stay under the top of the screen while scrolling
            await pg.evaluate('window.scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(150)
            top = await pg.evaluate("Math.round(document.getElementById('pillbar').getBoundingClientRect().top)")
            expect(top == 0, f'{name}: range pills are not sticky (top {top})')
            await pg.evaluate('window.scrollTo(0, 0)')
            # Refresh and coming back to the page fetch again
            n0 = len(reqs)
            await pg.click('#refresh'); await pg.wait_for_timeout(700)
            expect(len(reqs) == n0 + 1, f'{name}: Refresh fetched {len(reqs) - n0} times')
            await pg.wait_for_timeout(3200)
            await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(600)
            expect(len(reqs) == n0 + 2, f'{name}: coming back to the page fetched {len(reqs) - n0 - 1} times')
            expect(await pg.evaluate("document.getElementById('main').dataset.state") == 'ok', f'{name}: the page is not ok after a refresh')
            await pg.click('.pill[data-range=today]')
            await pg.reload(); await state(pg, 'ok')   # the chosen range is remembered for the visit
            expect(await pg.evaluate("document.querySelector('.pill[aria-pressed=true]').dataset.range") == 'today', f'{name}: the range is not remembered')
        await csp(pg, name)
        await ctx.close()
    # the narrowest phone: nothing sideways in any range
    ctx = await device(b, {'width': 360, 'height': 740}, True)
    pg = await ctx.new_page(); watch(pg, 'narrow')
    await pg.goto(f'{BASE}/stats#{KEY}'); await state(pg, 'ok')
    for r in RANGES:
        await pg.click(f'.pill[data-range={r}]'); await pg.wait_for_timeout(200)
        await fit(pg, f'narrow_{r}')
    await pg.click('.pill[data-range=week]'); await pg.wait_for_timeout(200)
    await shot(pg, 'narrow_week')
    await csp(pg, 'narrow'); await ctx.close()
    # dark
    ctx = await device(b, {'width': 390, 'height': 844}, True, 'dark')
    pg = await ctx.new_page(); watch(pg, 'dark')
    await pg.goto(f'{BASE}/stats#{KEY}'); await state(pg, 'ok')
    bg = await pg.evaluate("getComputedStyle(document.body).backgroundColor")
    expect(bg == 'rgb(23, 26, 51)', f'dark: background is {bg}')
    await pg.click('.pill[data-range=week]'); await pg.wait_for_timeout(200)
    await fit(pg, 'dark'); await shot(pg, 'phone_dark_week')
    await csp(pg, 'dark'); await ctx.close()
    # light stays cream
    ctx = await device(b, {'width': 390, 'height': 844}, True)
    pg = await ctx.new_page(); watch(pg, 'light')
    await pg.goto(f'{BASE}/stats#{KEY}'); await state(pg, 'ok')
    bg = await pg.evaluate("getComputedStyle(document.body).backgroundColor")
    expect(bg == 'rgb(255, 246, 228)', f'light: background is {bg}')
    await ctx.close()

async def messages(b, empty):
    ctx = await device(b, {'width': 390, 'height': 844}, True)
    # an empty data folder: calm empty lines, nothing broken
    pg = await ctx.new_page(); watch(pg, 'empty')
    await pg.goto(f'{BASE}/stats#{KEY}'); await state(pg, 'ok')
    for r in RANGES:
        await pg.click(f'.pill[data-range={r}]'); await pg.wait_for_timeout(150)
        t = await pg.evaluate("document.getElementById('main').innerText")
        expect('No plays counted yet' in t, f'empty_{r}: no "No plays counted yet" line')
        expect(await pg.evaluate("document.querySelectorAll('main section').length") == 7, f'empty_{r}: sections missing')
        await sane(pg, f'empty_{r}'); await fit(pg, f'empty_{r}')
    await pg.click('.pill[data-range=week]'); await pg.wait_for_timeout(150)
    expect(await text(pg, '.warn') is None, 'empty: an accounts warning without accounts')
    await shot(pg, 'phone_empty'); await csp(pg, 'empty')
    # a wrong key: one calm line (the server answers 404 after a pause)
    pg2 = await ctx.new_page(); watch(pg2, 'wrong key', allow=['/api/stats/data'])
    await pg2.goto(f'{BASE}/stats#ffffffffffffffffffffffffffffffff'); await state(pg2, 'bad')
    expect("isn't right" in await text(pg2, '#main'), f'wrong key: message is {await text(pg2, "#main")!r}')
    expect(await pg2.evaluate("document.getElementById('pillbar').hidden"), 'wrong key: range pills are shown')
    await fit(pg2, 'wrong key'); await shot(pg2, 'phone_badkey'); await csp(pg2, 'wrong key')
    # no key at all
    pg3 = await ctx.new_page(); watch(pg3, 'no key')
    await pg3.goto(f'{BASE}/stats'); await state(pg3, 'nokey')
    expect('needs your private link' in await text(pg3, '#main'), f'no key: message is {await text(pg3, "#main")!r}')
    await fit(pg3, 'no key'); await shot(pg3, 'phone_nokey'); await csp(pg3, 'no key')
    # the server cannot be reached
    pg4 = await ctx.new_page(); watch(pg4, 'offline', allow=['/api/stats/data'])
    await pg4.route('**/api/stats/data', lambda route: route.abort())
    await pg4.goto(f'{BASE}/stats#{KEY}'); await state(pg4, 'net')
    expect("Couldn't reach the server" in await text(pg4, '#main'), f'offline: message is {await text(pg4, "#main")!r}')
    await fit(pg4, 'offline'); await shot(pg4, 'phone_offline'); await csp(pg4, 'offline')
    # the accounts folder past 80% of a cap (the server's acct, accounts.js fill): one warning line above the sections
    pg5 = await ctx.new_page(); watch(pg5, 'accounts full')
    async def nearly_full(route):
        resp = await route.fetch(); j = await resp.json()
        j['acct'] = {'files': 16412, 'maxFiles': 20000, 'bytes': 43000000, 'maxBytes': 209715200, 'warn': True}
        await route.fulfill(response=resp, json=j)
    await pg5.route('**/api/stats/data', nearly_full)
    await pg5.goto(f'{BASE}/stats#{KEY}'); await state(pg5, 'ok')
    w = await text(pg5, '.warn')
    expect(w is not None and 'Accounts nearly full' in w and '16,412 of 20,000 accounts (82%)' in w and '41.0 MB of 200.0 MB (21%)' in w, f'accounts nearly full: the warning is {w!r}')
    await fit(pg5, 'accounts full'); await shot(pg5, 'phone_acctfull'); await csp(pg5, 'accounts full')
    await ctx.close()

async def main():
    tmp = tempfile.mkdtemp(prefix='pbstats-pw-')
    srv = None
    try:
        if not (ROOT / 'public' / 'stats.html').exists(): raise RuntimeError('public/stats.html is missing: run python3 game/build.py first')
        full, empty = os.path.join(tmp, 'full'), os.path.join(tmp, 'empty')
        gen(full); gen(empty, '--empty')
        srv = start_server(full)
        data = api()
        expect(len(data['days']) > 30 and data['today'] in data['days'], 'the sample data has no days')
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            await populated(b, data)
            await b.close()
        stop_server(srv)
        srv = start_server(empty)
        expect(api()['days'] == {}, 'the empty folder is not empty')
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            await messages(b, empty)
            await b.close()
    finally:
        stop_server(srv)
        shutil.rmtree(tmp, ignore_errors=True)
    print('\n'.join(errs) or 'no errors')

async def guarded():
    try: await main()
    except BaseException as e:   # a crashed run still lists what was found before it
        import traceback; traceback.print_exc()
        errs.append(f'the run stopped early: {type(e).__name__}: {str(e)[:300]}')
        print('\n'.join(errs))
asyncio.run(guarded())
