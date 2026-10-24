"""Replays (ui/replay.js, ui/rpview.js) against a real `node server.js` with a temporary ACCOUNTS_DIR (port PWREPLAY_PORT, default 8104).
The boss has a tenth of his HP (BW_T hp 0.1, as in tests/pwbw.py), so a try is short. One phone (844x390, touch), a bot's hands on the page's
own input (window.__blInput), as a person:
  1. A won Boss Week try; the server's verdict (a new best). The results offer WATCH ▶ (five sizes, nothing cut).
  2. WATCH ▶ plays the try again from this phone's log: the scan finds the server's time, frame for frame; played to the end at 2x the
     clock pill stops on the same time; seeking back and on lands on the same state as playing there (the checksum), ⏭ KO lands 2.5 s
     before the final launch and plays to the same time; nothing counts (chips, the profile, your Boss Week record, no match counted).
  3. The run on the server (GET /api/run/<id>, the sheet's WATCH): the same time, place #1; the board's rows carry its id.
  4. A share link in a fresh phone (no account): #watch=<id> shows the title card, the hash is gone from the address, WATCH plays it
     under the runner's name; a run that isn't there says so.
  5. A Ranked vs CPU match (Quick match, VS CPU), played to its end: WATCH ▶ plays it again to the same winner and stocks.
Prints one line per problem, then "no errors".
Usage:  python3 tests/pwreplay.py [outdir]        (needs `python3 game/build.py` first)"""
import asyncio, sys, os, json, subprocess, tempfile, shutil, time, pathlib, urllib.request
from playwright.async_api import async_playwright
import pwwin   # leave the game's fullscreen before each resize (tests/pwwin.py)
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWREPLAY_PORT', 8104))
URL = f'http://localhost:{PORT}/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'replay')
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

def start_server(d):
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0', ACCOUNTS_DIR=d, BW_T=json.dumps({'gap': 0, 'minSpeed': 0, 'hp': 0.1}))
    env.pop('STATS_DIR', None); env.pop('BW_NOW', None)
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

async def text(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return e ? e.innerText : null }", sel)
async def shown(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 }", sel)
async def tap(pg, sel):
    await pg.locator(sel).first.click()
    await pg.wait_for_timeout(150)
async def shot(pg, name): await pg.screenshot(path=str(OUT / f'{name}.png'))
async def wait(pg, js, what, secs=20):
    try: await pg.wait_for_function(js, timeout=secs * 1000); return True
    except Exception:
        st = await pg.evaluate("(() => { const b = window.__blastline, r = window.__blRp && window.__blRp.st; return b ? [b.mode, r && r.on, r && r.loading, r && r.seeking, r && r.ended, r && r.i, r && r.mk && r.mk.n] : null; })()")
        errs.append(f'timed out: {what} (mode, replay on, loading, seeking, ended, tick, ticks: {st})'); return False

# the bot's hands: the page reads them as yours (readPlayer), on the bot's own random numbers so the game's stay the game's
HANDS = """(lv) => { window.__tb = { bot: BL.makeBot(lv, BL.BOT_STYLES[%s]), rng: BL.rngOf(4242) };
  window.__blInput = (G) => { const foe = G.fighters[2] && G.fighters[2].spec.boss ? G.fighters[2] : G.fighters.length === 2 ? G.fighters[1] : null;
    if (!foe) return {}; const R = G.rng; G.rng = window.__tb.rng;
    try { return BL.botInput(G, G.fighters[0], foe, window.__tb.bot); } finally { G.rng = R; } }; }""" % json.dumps(PROF['last'])
NO_HANDS = "window.__blInput = null"
# what a replay must not change: chips, the profile's counted parts, your Boss Week record, the play counts' match keys
STATE = """(() => { const p = JSON.parse(localStorage.getItem('potatobrawl.profile.v1') || '{}'), b = window.__blBw, q = window.__blCount ? window.__blCount.queue : [];
  const cut = (o) => { const x = Object.assign({}, o); for (const k of ['seen', 'lastOpen', 'at', 'ui', 'tip', 'tips', 'bd', 'bwSeen']) delete x[k]; return x; };
  return { prof: JSON.stringify(cut(p)), me: JSON.stringify(b.me), res: b.res && b.res.id, n: q.filter((k) => /^(ms|me|fn|first|again|rw|bs|bw|fp|ml):/.test(Array.isArray(k) ? k[0] : k)).length }; })()"""
SUM = "(() => { const g = window.__blastline.game; return g ? BL.checksum(g) : null; })()"

async def results_fit(pg, tag):
    """WATCH ▶ on the results at five sizes: nothing cut or off the screen, the buttons don't overlap"""
    for w, h in SIZES:
        await pg.set_viewport_size({'width': w, 'height': h}); await pg.wait_for_timeout(350)
        bad = await pg.evaluate("""((up) => { const out = [], bs = [];
          for (const e of document.querySelectorAll('#scrResult .res-actions button, #rWatch')) { if (e.closest('[hidden]') || !e.getClientRects().length) continue;
            const r = e.getBoundingClientRect(); bs.push([e.id, r]);
            if (e.scrollWidth > e.clientWidth + 1 || (!up && (r.right > innerWidth + 1 || r.left < -1))) out.push(e.id + ' cut ' + JSON.stringify(e.innerText)); }   // the results scroll: past the fold is fine (upright: the turned page scrolls sideways)
          for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], b = bs[j][1];
            if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(bs[i][0] + ' over ' + bs[j][0]); }
          return out; })""", h > w)
        expect(not bad, f'{tag} results at {w}x{h}: {bad}')
        await shot(pg, f'{tag}-res-{w}x{h}')
    await pg.set_viewport_size({'width': 844, 'height': 390}); await pg.wait_for_timeout(300)

async def scanned(pg, tag):
    if not await wait(pg, "window.__blRp.st.on && window.__blRp.st.mk && window.__blastline.mode === 'match'", f'{tag}: the replay starts', 30): return None
    return await pg.evaluate("window.__blRp.st.mk")

async def to_end(pg, tag, secs=150):
    await pg.evaluate("window.__blRp.speed(2)")
    if not await wait(pg, "window.__blRp.st.ended", f'{tag}: the replay plays to its end', secs): return None
    return await pg.evaluate("window.__blRp.now()")

async def main():
    d = tempfile.mkdtemp(prefix='pwreplay-')
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
            await wait(pg, "window.__blBw && window.__blBw.wk", 'the menu hears the week', 15)

            # ---- 1. a won try and its verdict; WATCH ▶ on the results
            won = None
            for k in range(3):
                await pg.evaluate(HANDS, 0.95)
                await pg.evaluate("window.__blBwFight()")
                if not await wait(pg, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.fighters.length === 3", f'try {k + 1} starts', 20): break
                if not await wait(pg, "window.__blastline.mode === 'result'", f'try {k + 1} ends', 240): break
                await pg.wait_for_timeout(300)
                r = await pg.evaluate("(() => { const R = window.__blBw.shown; return R ? { won: R.bw.won, t: R.bw.t, id: R.bw.tk.id } : null; })()")
                if r and r['won']: won = r; break
                await pg.evaluate("window.__blastline.mode === 'result' && document.getElementById('rMenu').click()")
                await pg.wait_for_timeout(300)
            await pg.evaluate(NO_HANDS)
            expect(won is not None, 'no won try in three')
            if won:
                await wait(pg, "window.__blBw.res && window.__blBw.res.id === window.__blBw.shown.bw.tk.id && !window.__blBw.pend", "the server's verdict", 30)
                v = await pg.evaluate("window.__blBw.res")
                expect(v.get('ok') and v.get('why') == 'best' and v.get('time') == won['t'], f'the server takes the try as a new best at the page\'s time {won["t"]}, got {v}')
                T = v.get('time') or won['t']
                expect(await shown(pg, '#rWatch'), 'the results offer WATCH ▶')
                await results_fit(pg, 'bw')
                me = await pg.evaluate("window.__blBw.me")
                expect(me and me.get('r') == won['id'], f'your best run\'s id on the page is the ticket\'s, got {me}')

                # ---- 2. this phone's run, played again
                before = await pg.evaluate(STATE)
                if await shown(pg, '#rWatch'): await tap(pg, '#rWatch')
                else: await pg.evaluate("window.__blRp.local()")
                mk = await scanned(pg, 'local')
                if mk:
                    expect(mk['won'] and mk['t'] == T, f'the scan finds the server\'s time {T}, got {mk}')
                    expect(await pg.evaluate("document.getElementById('app').classList.contains('replay') && document.getElementById('ctl').hidden"), 'the replay hides the touch controls')
                    await pg.wait_for_timeout(1500)
                    await shot(pg, 'local-playing')
                    # seeking: back and on lands where playing would (the checksum at the same tick, two ways)
                    to = min(mk['n'] - 10, max(200, mk['go'] + 240))
                    await pg.evaluate("window.__blRp.toggle()")   # paused
                    await pg.evaluate(f"window.__blRp.seek({to})")
                    await wait(pg, f"!window.__blRp.st.seeking && window.__blRp.st.i === {to}", 'seek on', 20)
                    a = await pg.evaluate(SUM)
                    await pg.evaluate("window.__blRp.seek(60)")
                    await wait(pg, "!window.__blRp.st.seeking && window.__blRp.st.i === 60", 'seek back', 20)
                    await pg.evaluate(f"window.__blRp.seek({to})")
                    await wait(pg, f"!window.__blRp.st.seeking && window.__blRp.st.i === {to}", 'seek on again', 20)
                    b2 = await pg.evaluate(SUM)
                    expect(a is not None and a == b2, f'seeking back and on lands on the same state at tick {to}: {a} / {b2}')
                    await pg.evaluate("window.__blRp.toggle()")   # playing again
                    end = await to_end(pg, 'local')
                    expect(end == T, f'played to the end, the clock stops at the server\'s time {T}, got {end}')
                    await pg.wait_for_timeout(500)
                    await shot(pg, 'local-end')
                    # ⏭ KO: 2.5 s before the final launch, then the same time again
                    await pg.evaluate("window.__blRp.speed(1); window.__blRp.toKo()")
                    await wait(pg, f"!window.__blRp.st.seeking && !window.__blRp.st.ended && window.__blRp.st.i >= {mk['ko'] - 150}", '⏭ KO', 20)
                    i = await pg.evaluate("window.__blRp.st.i")
                    expect(mk['ko'] - 150 <= i <= mk['ko'] - 100, f'⏭ KO lands 2.5 s before the final launch (tick {mk["ko"] - 150}), got {i}')
                    end = await to_end(pg, '⏭ KO')
                    expect(end == T, f'after ⏭ KO the clock stops at {T} again, got {end}')
                    await pg.evaluate("window.__blRp.close('')")
                    await wait(pg, "window.__blastline.mode === 'menu' && !window.__blRp.st.on", 'the replay closes to the menu', 10)
                    expect(not await pg.evaluate("document.getElementById('app').classList.contains('replay')"), 'the replay class goes with it')
                    after = await pg.evaluate(STATE)
                    expect(after == before, f'a replay changes nothing: before {before}, after {after}')

                # ---- 3. the server's run: the sheet's WATCH (your best), the board's rows
                rows = await pg.evaluate("window.__blBw.bd = null, window.__blBwBoard()")
                top = (rows or {}).get('top') or []
                expect(top and top[0].get('r') == won['id'] and top[0].get('v') > 0 and rows.get('fin') is False, f'the board\'s first row carries the run\'s id and version, got {top[:1]}')
                await pg.evaluate(f"window.__blRp.watch({json.dumps(won['id'])}, 'sheet', true)")
                mk2 = await scanned(pg, 'server run')
                if mk2:
                    m = await pg.evaluate("window.__blRp.st.meta")
                    expect(mk2['t'] == T and m['place'] == 1 and m['n'] == 1 and m['own'] and m['id'] == won['id'], f'the server\'s run: the same time {T}, #1 of 1, yours, got {mk2["t"]} / {m}')
                    expect(await pg.evaluate("window.__blRp.shareId()") == won['id'], 'a server run can be shared')
                    await pg.evaluate("window.__blRp.close()")
                    await wait(pg, "!window.__blRp.st.on", 'the server run closes', 10)
                    expect(await pg.evaluate("!document.getElementById('scrBw') || !document.getElementById('scrBw').hidden"), '✕ goes back to the sheet it came from')
                    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)

                # ---- 4. a share link in a fresh phone
                ctx2 = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
                pg2 = await ctx2.new_page()
                pg2.on('pageerror', lambda e: errs.append(f'link page error: {e}'))
                await pg2.goto(URL + '#watch=' + won['id'])
                await wait(pg2, "window.__blRp && window.__blRp.st.land && window.__blRp.st.land.st === 'ok'", 'the link\'s run arrives', 20)
                expect(await pg2.evaluate("location.hash") == '', 'the #watch= hash is gone from the address')
                await pg2.wait_for_timeout(400)
                await shot(pg2, 'link-title')
                await pg2.evaluate("window.__blRp.landGo()")
                mk3 = await scanned(pg2, 'link')
                if mk3:
                    m = await pg2.evaluate("window.__blRp.st.meta")
                    expect(mk3['t'] == T and not m['own'] and m['nm'] == PROF['name'], f'the link plays the run under the runner\'s name, got {mk3["t"]} / {m}')
                    await pg2.wait_for_timeout(1200); await shot(pg2, 'link-playing')
                    end = await to_end(pg2, 'link')
                    expect(end == T, f'the link\'s run stops at {T}, got {end}')
                    await pg2.wait_for_timeout(600); await shot(pg2, 'link-end')
                    await pg2.evaluate("window.__blRp.close('')")
                    await wait(pg2, "window.__blastline.mode === 'menu'", 'the link\'s replay closes', 10)
                await pg2.goto(URL + '?r=1#watch=000000000000')
                await wait(pg2, "window.__blRp && window.__blRp.st.land && window.__blRp.st.land.st === 'gone'", 'a run that isn\'t there says so', 20)
                await ctx2.close()

            # ---- 5. a Ranked vs CPU match, played to its end, then again
            await pg.evaluate(HANDS, 0.95)
            await pg.evaluate("document.getElementById('bRanked') && document.getElementById('bRanked').click()")
            if await wait(pg, "window.__blastline.mode === 'quick'", 'Quick match opens', 10):
                await pg.wait_for_timeout(500)
                if await shown(pg, '#scrSeason .ss-sheet'): await tap(pg, '#ssGo')   # the Season 1 sheet, once after the first finished match
                await tap(pg, '#qmV'); await pg.wait_for_timeout(300)
                await tap(pg, '#qmFind')
                if await wait(pg, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.fighters.length === 2 && !window.__blRp.st.on", 'the CPU match starts', 30):
                    if await wait(pg, "window.__blastline.mode === 'result'", 'the CPU match ends', 300):
                        await pg.evaluate(NO_HANDS)
                        await pg.wait_for_timeout(500)
                        fin = await pg.evaluate("(() => { const g = window.__blastline.game; return { w: g.winner, s: g.fighters.map((f) => f.stocks) }; })()")
                        expect(await shown(pg, '#rWatch'), 'the CPU results offer WATCH ▶')
                        await results_fit(pg, 'vc')
                        if await shown(pg, '#rWatch'): await tap(pg, '#rWatch')
                        else: await pg.evaluate("window.__blRp.local()")
                        mk4 = await scanned(pg, 'CPU match')
                        if mk4:
                            expect(mk4['won'] == (fin['w'] == 0), f'the scan finds the same winner, got {mk4} / {fin}')
                            await pg.evaluate("window.__blRp.speed(2)")
                            await wait(pg, "window.__blRp.st.ended", 'the CPU replay plays to its end', 300)
                            fin2 = await pg.evaluate("(() => { const g = window.__blastline.game; return { w: g.winner, s: g.fighters.map((f) => f.stocks) }; })()")
                            expect(fin2 == fin, f'the CPU match plays again to the same end: {fin} / {fin2}')
                            await shot(pg, 'vc-end')
                            await pg.evaluate("window.__blRp.close('')")
            await pg.evaluate(NO_HANDS)
            await b.close()
    except Exception as e:
        errs.append(f'stopped: {type(e).__name__}: {str(e).splitlines()[0]}')
        try: await pg.screenshot(path=str(OUT / 'stopped.png'))
        except Exception: pass
    finally:
        log = stop_server(srv)
        shutil.rmtree(d, ignore_errors=True)
    if os.environ.get('PWREPLAY_LOG'): print(log)
    print('\n'.join(errs) or 'no errors')

asyncio.run(main())
