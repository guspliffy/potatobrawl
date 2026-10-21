"""Boss Week in the browser (ui/bossweek.js) against a real `node server.js` with a temporary ACCOUNTS_DIR (port PWBW_PORT, default 8103).
The boss has a tenth of his HP here (BW_T hp 0.1, a test-only knob the ticket and the server's replay share), so a try is short.
One phone (844x390, touch), a bot's hands on the page's own input (window.__blInput, on its own random numbers, as a person):
  1. The menu hears the week from the server without an account; the start tile shows the boss; FIGHT on the sheet makes the account,
     the server deals a ticket (the week's boss on Hard, the week's partner), the fight starts on it, the clock pill runs from GO.
  2. A win: FINISHED!, the card says CHECKING… until the server has played the same fight again from the log, then NEW BEST, #1 of 1;
     the server's time is the page's own, frame for frame, and the account file holds the run. Board opens the Boss Week tab.
  3. Retry starts a new try; leaving it from the pause menu costs nothing (no result sent, the best stays).
  4. A slower win isn't sent at all: the card says BEST and the server is never asked.
  5. Monday: the server restarts in the next week, pays the week (300 chips for #1, into the account file), the menu shows the
     Monday card once, and the chips arrive on the phone with the sync.
Screenshots (the HUD pill, the results while checking and after the verdict at five sizes, the Monday card) go to the folder in argv[1].
Prints one line per problem, then "no errors" (and "bw ok" when every check passed).
Usage:  python3 tests/pwbw.py [outdir]        (needs `python3 game/build.py` first)"""
import asyncio, sys, os, json, subprocess, tempfile, shutil, time, hashlib, pathlib, re, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWBW_PORT', 8103))
URL = f'http://localhost:{PORT}/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'bw')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--disable-gpu']
SIZES = [(667, 320), (740, 360), (844, 390), (1280, 760), (390, 844)]
PROF = {'tokens': 40, 'last': 'samurai', 'gfx': '2d', 'name': 'Tuber Tom'}
errs = []
def expect(ok, msg):
    if not ok: errs.append(msg)
def has(hay, *subs):
    h = (hay or '').lower().replace('\xa0', ' ')
    return all(x.lower() in h for x in subs)

def start_server(d, now=None):
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0', ACCOUNTS_DIR=d, BW_T=json.dumps({'gap': 0, 'minSpeed': 0, 'hp': 0.1}))
    env.pop('STATS_DIR', None); env.pop('BW_NOW', None)
    if now: env['BW_NOW'] = str(now)
    p = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(60):
        try:
            if urllib.request.urlopen(URL + 'health', timeout=1).status == 200: return p
        except Exception: time.sleep(0.2)
    p.kill(); raise RuntimeError('server did not start')
def stop_server(p):
    p.terminate()
    try: return p.communicate(timeout=5)[0].decode('utf8', 'replace')
    except Exception: p.kill(); return ''
def norm(code): return re.sub(r'[^0-9A-Z]', '', code.upper())
def rec_of(d, code):
    try: return json.loads((pathlib.Path(d) / (hashlib.sha256(norm(code).encode()).hexdigest() + '.json')).read_text())
    except Exception: return None

async def text(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return e ? e.innerText : null }", sel)
async def shown(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 }", sel)
async def mode(pg): return await pg.evaluate("window.__blastline.mode")
async def code(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.acct.v1') || '{}').code || ''")
async def tokens(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.profile.v1') || '{}').tokens | 0")
async def tap(pg, sel):
    await pg.locator(sel).first.click()
    await pg.wait_for_timeout(150)
async def shot(pg, name): await pg.screenshot(path=str(OUT / f'{name}.png'))
async def wait(pg, js, what, secs=20):
    try: await pg.wait_for_function(js, timeout=secs * 1000); return True
    except Exception:
        st = await pg.evaluate("(() => { const b = window.__blastline, w = window.__blBw; return b ? [b.mode, w && w.asking, w && w.note, w && !!w.pend, b.qm.conn, b.qm.authed] : null; })()")
        errs.append(f'timed out: {what} (mode, asking, note, pending, connected, signed in: {st})'); return False

# the bot's hands: the page reads them as yours (readPlayer), on the bot's own random numbers so the game's stay the game's
HANDS = """(lv) => { window.__tb = { bot: BL.makeBot(lv, BL.BOT_STYLES[%s]), rng: BL.rngOf(4242) };
  window.__blInput = (G) => { if (!G.fighters[2] || !G.fighters[2].spec.boss) return {}; const R = G.rng; G.rng = window.__tb.rng;
    try { return BL.botInput(G, G.fighters[0], G.fighters[2], window.__tb.bot); } finally { G.rng = R; } }; }""" % json.dumps(PROF['last'])
async def play(pg, start, tag, lv=0.95):
    """one try to its results: start() begins it; returns the results' Boss Week data (won, t, sent) or None"""
    await pg.evaluate(HANDS, lv)
    await start()
    if not await wait(pg, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.fighters.length === 3", f'{tag}: the try starts', 15): return None
    return await finish(pg, tag)
async def finish(pg, tag):
    if not await wait(pg, "window.__blastline.mode === 'result'", f'{tag}: the try ends', 240): return None
    await pg.wait_for_timeout(300)
    return await pg.evaluate("(() => { const R = window.__blBw.shown; return R ? { won: R.bw.won, t: R.bw.t, sent: R.bw.sent, id: R.bw.tk.id, b0: R.bw.b0 } : null; })()")

async def main():
    d = tempfile.mkdtemp(prefix='pwbw-')
    srv = start_server(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script("if (!localStorage.getItem('potatobrawl.profile.v1')) localStorage.setItem('potatobrawl.profile.v1', %s)" % json.dumps(json.dumps(PROF)))
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(f'page error: {e}'))
            pg.on('console', lambda m: errs.append(f'console: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await pg.goto(URL)

            # ---- 1. the week without an account, the tile, the sheet's FIGHT, the ticket
            await wait(pg, "window.__blBw && window.__blBw.wk", 'the menu hears the week from the server', 15)
            wk = await pg.evaluate("window.__blBw.wk")
            boss = await pg.evaluate("(id) => BL.BOSSES.find((b) => b.id === id).name", wk['boss'])
            expect(wk['lv'] == 1 and wk['n'] == 0, f'the week: Hard, nobody has a time yet, got {wk}')
            if await shown(pg, '#bBw'):
                expect(has(await text(pg, '#bBw'), 'Boss Week', boss), f'the start tile names the boss, got {await text(pg, "#bBw")!r}')
            else: errs.append('the start tile #bBw is not on the menu')
            async def from_sheet():
                if not await shown(pg, '#bBw'): await pg.evaluate("window.__blBwFight()"); return
                await tap(pg, '#bBw')
                await wait(pg, "!document.getElementById('scrBw') || !document.getElementById('scrBw').hidden", 'the sheet opens')
                go = pg.locator('#scrBw button.primary, #scrBw .bw-go').first
                if await go.count(): await go.click()
                else: await pg.evaluate("window.__blBwFight()")
            r1 = await play(pg, from_sheet, 'try 1')
            tk = await pg.evaluate("window.__blBw.shown && window.__blBw.shown.bw.tk")
            expect(bool(await code(pg)), 'FIGHT made the account')
            if tk:
                expect(tk['boss'] == wk['boss'] and tk['pf'] == wk['pf'] and tk['lv'] == 1 and tk['f'] == PROF['last'], f'the ticket: the week\'s boss and partner on Hard, your fighter, got {tk}')
            # a win on the second try at the latest (the bot is strong, the boss has a tenth of his HP)
            if r1 and not r1['won']:
                r1 = await play(pg, lambda: tap(pg, '#rAgain'), 'try 1b')
            expect(bool(r1 and r1['won'] and r1['sent']), f'a won first try is sent to the server, got {r1}')

            # ---- 2. the verdict: CHECKING… first, then NEW BEST #1 of 1, the server's time = the page's
            if r1 and r1['won']:
                if await pg.evaluate("!!window.__blBw.pend"):
                    expect(has(await text(pg, '#rBwS'), 'checking'), f'the card waits for the server, got {await text(pg, "#rBwS")!r}')
                    await shot(pg, 'res-checking-844x390')
                expect(has(await text(pg, '#rTitle'), 'finished'), f'the title: FINISHED!, got {await text(pg, "#rTitle")!r}')
                expect(has(await text(pg, '#rMode'), 'Boss Week', boss, 'Hard'), f'the kicker, got {await text(pg, "#rMode")!r}')
                await wait(pg, "window.__blBw.res && window.__blBw.res.id === window.__blBw.shown.bw.tk.id && !window.__blBw.pend", 'the server\'s verdict', 30)
                v = await pg.evaluate("window.__blBw.res")
                expect(v.get('ok') and v.get('why') == 'best' and v.get('time') == r1['t'] and v.get('pl1') == 1 and v.get('n') == 1, f'the server played the same fight: the same time, a new best, #1 of 1; page {r1["t"]}, server {v}')
                expect(has(await text(pg, '#rBwS'), 'new best') and has(await text(pg, '#rBwL'), '#1 of 1'), f'the card: NEW BEST, #1 of 1, got {await text(pg, "#rBwS")!r} / {await text(pg, "#rBwL")!r}')
                rec = rec_of(d, await code(pg))
                expect(bool(rec and rec.get('bw') and rec['bw'].get('b') and rec['bw']['b']['t'] == r1['t']), 'the account file holds the run')
                for w, h in SIZES:
                    await pg.set_viewport_size({'width': w, 'height': h}); await pg.wait_for_timeout(350)
                    bad = await pg.evaluate("""(() => { const out = [];
                      for (const id of ['rBwK', 'rBwT', 'rBwL', 'rBwN', 'rBwS', 'rTitle', 'rMode']) { const e = document.getElementById(id); if (!e || e.closest('[hidden]')) continue;
                        const r = e.getBoundingClientRect(); if (e.scrollWidth > e.clientWidth + 1 || r.right > innerWidth + 1 || r.left < -1) out.push(id + ' ' + JSON.stringify(e.innerText)); }
                      return out; })()""")
                    expect(not bad, f'results at {w}x{h}: cut or off the screen: {bad}')
                    await shot(pg, f'res-best-{w}x{h}')
                await pg.set_viewport_size({'width': 844, 'height': 390}); await pg.wait_for_timeout(300)
                expect(await pg.evaluate("window.__blBw.me && window.__blBw.me.t") == r1['t'], 'the menu\'s record has the new best')
                # Board: the Boards sheet on the Boss Week tab, your row
                await tap(pg, '#rChange')
                ok = await wait(pg, "!document.getElementById('scrBoards').hidden", 'Board opens the Boards sheet', 8)
                if ok:
                    await pg.wait_for_timeout(800)
                    expect(has(await text(pg, '#scrBoards'), 'Tuber Tom'), 'the Boss Week tab lists you')
                    await shot(pg, 'board-844x390')
                    await pg.evaluate("bd => { const x = document.querySelector('#scrBoards .round.x, #bdClose'); if (x) x.click(); }", None)
                    await pg.wait_for_timeout(300)

            # ---- 3. Retry, then leave from the pause menu: no result, the best stays
            n_res = await pg.evaluate("window.__blBw.applied.length")
            await pg.evaluate(HANDS, 0.95)
            await tap(pg, '#rAgain')
            if await wait(pg, "window.__blastline.mode === 'match' && window.__blastline.game.phase === 'play'", 'Retry starts a new try', 15):
                await pg.wait_for_timeout(1500)
                expect(await shown(pg, '#bwPill'), 'the clock pill runs from GO')
                pill = await text(pg, '#bwPill')
                expect(bool(re.search(r'\d:\d\d\.\d', pill or '')) and has(pill, 'best'), f'the pill: the running time and your best, got {pill!r}')
                await shot(pg, 'hud-pill-844x390')
                await pg.evaluate("window.__blInput = () => ({})")
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
                if not await shown(pg, '#pQuit'): await pg.evaluate("document.getElementById('bPause') && document.getElementById('bPause').click()"); await pg.wait_for_timeout(300)
                expect(has(await text(pg, '#pNote'), 'costs nothing'), f'the pause sheet says leaving costs nothing, got {await text(pg, "#pNote")!r}')
                await tap(pg, '#pQuit')
                await wait(pg, "window.__blastline.mode === 'menu'", 'Quit goes to the menu', 5)
                await pg.wait_for_timeout(1500)
                expect(await pg.evaluate("window.__blBw.applied.length") == n_res and not await pg.evaluate("!!window.__blBw.pend"), 'a try left halfway sends nothing')

            # ---- 4. a slower win isn't sent (the best is made very fast by hand in the file and on the page)
            if r1 and r1['won']:
                c = await code(pg)
                f = pathlib.Path(d) / (hashlib.sha256(norm(c).encode()).hexdigest() + '.json')
                rec = json.loads(f.read_text()); rec['bw']['b']['t'] = 60; f.write_text(json.dumps(rec))
                await pg.evaluate("window.__blBw.me.t = 60")
                n_res = await pg.evaluate("window.__blBw.applied.length")
                r2 = await play(pg, lambda: pg.evaluate("window.__blBwFight()"), 'try 3')
                if r2 and r2['won']:
                    expect(not r2['sent'] and has(await text(pg, '#rBwS'), 'best'), f'a slower win stays on the phone: BEST on the card, got {await text(pg, "#rBwS")!r}')
                    await pg.wait_for_timeout(1200)
                    expect(await pg.evaluate("window.__blBw.applied.length") == n_res, 'the server was not asked about a slower win')
                    await shot(pg, 'res-slower-844x390')
                # the 4:00 cap: the game's clock moved on by hand to 3:58 after GO; the try ends as OUT OF TIME, nothing sent
                await pg.evaluate("window.__blInput = () => ({})")
                await tap(pg, '#rAgain')
                if await wait(pg, "window.__blastline.mode === 'match' && window.__blBw.run && window.__blBw.run.go >= 0", 'a try for the cap', 15):
                    await pg.evaluate("window.__blastline.game.t = window.__blBw.run.go + 240 * 60 - 90")
                    await pg.wait_for_timeout(300)
                    expect(has(await text(pg, '#bwPill'), 'left'), f'the last seconds: the pill counts down, got {await text(pg, "#bwPill")!r}')
                    await shot(pg, 'hud-left-844x390')
                    await wait(pg, "window.__blastline.mode === 'result'", 'the cap ends the try', 10)
                    await pg.wait_for_timeout(300)
                    expect(has(await text(pg, '#rTitle'), 'out of time') and not await pg.evaluate("!!window.__blBw.pend"), f'OUT OF TIME, nothing sent, got {await text(pg, "#rTitle")!r}')
                rec = json.loads(f.read_text()); rec['bw']['b']['t'] = r1['t']; f.write_text(json.dumps(rec))
                await pg.evaluate("(t) => { window.__blBw.me.t = t; }", r1['t'])
                await tap(pg, '#rMenu'); await pg.wait_for_timeout(400)

            # ---- 5. Monday: paid once, the card, the chips by sync
            if r1 and r1['won']:
                c = await code(pg); before = (rec_of(d, c) or {}).get('prof', {}).get('tokens', 0); t0 = await tokens(pg)
                stop_server(srv)
                nxt = await pg.evaluate("window.__blBw.wk.ends") + 3600_000
                srv = start_server(d, nxt)
                await wait(pg, "window.__blBw.wk && window.__blBw.wk.wk === %d" % (wk['wk'] + 1), 'the phone hears the new week after the restart', 40)
                rec = rec_of(d, c)
                expect(rec and rec['prof'].get('tokens') == before + 300 and rec['bw'].get('pw') == wk['wk'] and rec['bw'].get('cr') == 1, f'the week is paid into the account: +300 for #1, the crown; got {rec and rec["prof"].get("tokens")} (was {before}), bw {rec and rec.get("bw", {}).get("lr")}')
                await wait(pg, "!!document.querySelector('#scrBwWeek:not([hidden]), .bw-week:not([hidden])') || (window.__blBw.lrSeen === %d)" % wk['wk'], 'the Monday card', 15)
                await pg.wait_for_timeout(600)
                await shot(pg, 'monday-844x390')
                expect(await pg.evaluate("window.__blBw.lrSeen") == wk['wk'], 'the Monday card is shown once for that week')
                await wait(pg, "JSON.parse(localStorage.getItem('potatobrawl.profile.v1') || '{}').tokens >= %d" % (t0 + 300), 'the 300 chips arrive on the phone with the sync', 25)
            await b.close()
    except Exception as e:
        errs.append(f'the test stopped: {type(e).__name__}: {str(e).splitlines()[0]}')
    finally:
        log = stop_server(srv)
        shutil.rmtree(d, ignore_errors=True)
    for e in errs: print(e)
    if not errs: print('bw ok')
    print('no errors' if not errs else f'{len(errs)} problems')
    if errs: print(log[-1500:])

asyncio.run(main())
