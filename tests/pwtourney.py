"""Cups in the browser (ui/tourney.js, ui/tcview.js) against a real `node server.js` with a temporary ACCOUNTS_DIR (port PWTC_PORT,
default 8105) and short cup timers (TC_T: a 20 s call-up). Three players as separate devices: A on a phone (844x390), B on a desktop
(1280x760), C on an upright phone (390x844). All three are fresh (online rating 1000), so the seeds follow the joining order: A 1, B 2,
C 3 and a CPU 4, and a cup of 4 pairs A with the CPU and B with C.
  1. The menu's Tournament mini says tonight's Daily Cup; the sheet; HOST makes A's account silently and opens a Friends Cup lobby
     with its code. B and C open the cup's link (#cup=CODE): the sheet joins it. B warms up against a CPU in the lobby.
  2. A starts it: every page goes to the bracket (B's warm-up keeps running), a cup of 4 with one CPU, seeded 1-4.
  3. The call-ups at once: B's comes over the warm-up (paused) and B taps the banner's FIGHT; C goes to the menu and the banner finds
     C there; A reloads and the page comes back to the bracket with the call-up still on, then taps the foot card's FIGHT.
  4. A plays the CPU match (the server's ticket: VS screen, the HUD strip) and walks off the stage three times: the server plays the
     log again and A is out (the results card says so). B and C play a match the server referees (C walks off): B goes through.
  5. The final, B against the CPU: the call-up shows over B's results; B lets it run out: a walkover, the CPU is the champion, every
     page hears the end (places 2, 3, 3), a Friends Cup pays no chips, the bracket shows it.
Screenshots (the sheet, the lobby, the bracket while seeding and at the end, the call-up banner, the results card; the sheet, the
bracket and the results card at four sizes) go to the folder in argv[1]. Prints one line per problem, then "no errors".
Usage:  python3 tests/pwtourney.py [outdir]        (needs `python3 game/build.py` first)"""
import asyncio, sys, os, json, subprocess, tempfile, shutil, time, hashlib, pathlib, re, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWTC_PORT', 8105))
URL = f'http://localhost:{PORT}/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'tc')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer (the game has no WebGL)
PHONE, DESK, UP = {'width': 844, 'height': 390}, {'width': 1280, 'height': 760}, {'width': 390, 'height': 844}
SIZES = [(667, 320), (844, 390), (1280, 760), (390, 844)]
PA = {'tokens': 50, 'last': 'phoenix', 'gfx': '2d', 'name': 'Peel Appeal', 'fin1': True}
PB = {'tokens': 50, 'last': 'samurai', 'gfx': '2d', 'name': 'Mash Master', 'fin1': True}
PC = {'tokens': 50, 'last': 'odin', 'gfx': '2d', 'name': 'Tuber Tom', 'screen': 'up', 'fin1': True}
# 15:00 in Berlin on a summer day: tonight's Daily Cup is hours away ("pre")
NOW = 1784120400000   # 2026-07-15 13:00 UTC
SEL = {   # the views' buttons (ui/tcview.js, game/shell.html)
  'sheet': '#scrTc', 'host': '#tcHost', 'start': '#tcStart', 'warm': '#tcWarm', 'code': '#tcLobCode',
  'call': '#tcCall', 'callGo': '#tcCallGo', 'go': '#tcGo', 'card': '#rTc', 'pill': '#mTc',
}
errs = []
def expect(ok, msg):
    if not ok: errs.append(msg)
def has(hay, *subs):   # innerText follows text-transform, so compare without case (and no-break spaces as spaces)
    h = (hay or '').lower().replace('\xa0', ' ')
    return all(x.lower() in h for x in subs)

def start_server(d):
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0', ACCOUNTS_DIR=d, TC_NOW=str(NOW),
               TC_T=json.dumps({'tick': 200, 'roll': 1500, 'call': 20000, 'cpu': 180000, 'host': 0, 'keep': 600000}))
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
def rec(d, code):
    try: return json.loads(acct_file(d, code).read_text())
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
async def mode(pg): return await pg.evaluate("window.__blastline.mode")
async def code(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.acct.v1') || '{}').code || ''")
async def tc(pg, js): return await pg.evaluate(f"(() => {{ const T = window.__blTc; return {js}; }})()")
async def tap(pg, sel):
    await pg.locator(sel).first.click()
    await pg.wait_for_timeout(150)
async def shot(pg, name): await pg.screenshot(path=str(OUT / f'{name}.png'))
async def wait(pg, js, what, secs=20):
    try: await pg.wait_for_function(js, timeout=secs * 1000); return True
    except Exception:
        st = await pg.evaluate("(() => { const b = window.__blastline, T = window.__blTc; return b ? [b.mode, T && T.note, T && T.cup && T.cup.st, T && !!T.call, b.qm.conn, b.qm.authed] : null; })()")
        errs.append(f'timed out: {what} (mode, note, cup, called, connected, signed in: {st})'); return False
async def fits(pg, tag, root):   # nothing inside `root` spills out of the screen or out of its own box
    bad = await pg.evaluate("""(root) => {
      const out = [], W = innerWidth, H = innerHeight;
      for (const e of document.querySelectorAll(root + ' *')) {
        if (e.closest('[hidden]') || !e.getClientRects().length || e.closest('.scroll, svg')) continue;
        const r = e.getBoundingClientRect();
        if (r.width && (r.right > W + 1 || r.left < -1)) out.push((e.id || e.className || e.tagName) + ' sideways ' + Math.round(r.left) + '..' + Math.round(r.right));
        if ((e.children.length === 0) && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && e.textContent.trim()) out.push((e.id || e.className || e.tagName) + ' cut');
      }
      return out.slice(0, 5);
    }""", root)
    expect(not bad, f'{tag}: {bad}')
async def sizes(pg, name, root, back):   # four sizes, then back to the device's own
    for w, h in SIZES:
        await pg.set_viewport_size({'width': w, 'height': h}); await pg.wait_for_timeout(450)
        await fits(pg, f'{name} {w}x{h}', root)
        await shot(pg, f'{name}-{w}x{h}')
    await pg.set_viewport_size(back); await pg.wait_for_timeout(300)
async def walk_off(pg, tag, until, secs=120):   # hold left until the match is over (the server plays the same inputs)
    await pg.bring_to_front()
    await pg.keyboard.down('ArrowLeft')
    ok = await wait(pg, until, f'{tag}: the match ends (walked off three times)', secs)
    await pg.keyboard.up('ArrowLeft')
    return ok

async def main():
    d = tempfile.mkdtemp(prefix='pwtc-')
    srv = start_server(d)
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=ARGS)
            ca, cb, cc = await device(b, PHONE, True, PA), await device(b, DESK, False, PB), await device(b, UP, True, PC)
            A, B, C = await ca.new_page(), await cb.new_page(), await cc.new_page()
            for pg, tag in ((A, 'A'), (B, 'B'), (C, 'C')): watch(pg, tag)

            # 1. the menu, the sheet, HOST
            await A.goto(URL)
            await wait(A, "window.__blastline && window.__blastline.mode === 'menu' && window.__blTc.day", 'A: the menu hears the day')
            pill = await text(A, SEL['pill'])
            expect(has(pill, 'tonight'), f"A: the Tournament mini should say tonight's cup, got {pill!r}")
            expect(await code(A) == '', 'A: no account before a cup needs one')
            await tap(A, '#bCup')
            await wait(A, "window.__blTc.sheet", 'A: the Tournament sheet opens')
            await A.wait_for_timeout(400)
            expect(await shown(A, SEL['sheet']), 'A: the sheet shows')
            await sizes(A, 'sheet', SEL['sheet'], PHONE)
            await tap(A, SEL['host'])
            await wait(A, "window.__blTc.cup && window.__blTc.cup.code && window.__blTc.cup.ent", "A: HOST opens a Friends Cup lobby", 15)
            cup_code = await tc(A, "T.cup && T.cup.code") or ''
            expect(re.fullmatch(r'[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}', cup_code) is not None, f'A: a 5-character cup code, got {cup_code!r}')
            ca_code = await code(A)
            expect(bool(ca_code) and rec(d, ca_code) is not None, "A: HOST made the account (the server's file is there)")
            expect(has(await text(A, SEL['sheet']), cup_code), 'A: the lobby shows the code')

            # B and C open the link
            for pg, tag in ((B, 'B'), (C, 'C')):
                await pg.goto(URL + '#cup=' + cup_code)
                await wait(pg, "window.__blTc.cup && window.__blTc.cup.ent && window.__blTc.cup.ent.some((e) => e.me)", f'{tag}: the link joins the cup', 20)
            await wait(A, "window.__blTc.cup.ent.length === 3", "A: three in the lobby")
            await shot(A, 'lobby-host')
            await shot(C, 'lobby-upright')
            expect(not await shown(B, SEL['start']), 'B: only the host has START')
            await tap(B, SEL['warm'])
            await wait(B, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", 'B: the lobby warm-up starts', 15)

            # 2. START
            await tap(A, SEL['start'])
            for pg, tag in ((A, 'A'), (C, 'C')):
                await wait(pg, "window.__blastline.mode === 'tcup' && window.__blTc.cup && window.__blTc.cup.st === 'run'", f'{tag}: the bracket after START', 15)
            await wait(B, "window.__blTc.cup && window.__blTc.cup.st === 'run'", 'B: the cup starts (in the warm-up)', 15)
            c = await tc(A, "T.cup")
            hum = [s for s in c['slots'] if not s.get('c')] if c else []
            expect(c and c['size'] == 4 and len(hum) == 3, f'A: a cup of 4 with three players and a CPU, got {c and c["size"]} / {len(hum)}')
            names = [s.get('n') for s in c['slots']] if c else []
            expect(c and names[0] == PA['name'] and c['slots'][1].get('c') and names[2] == PB['name'] and names[3] == PC['name'],
                   f'A: seeded by joining order, A vs the CPU and B vs C, got {names}')
            await A.wait_for_timeout(300); await shot(A, 'bracket-start')

            # 3. the call-ups: B over the warm-up, C on the menu, A after a reload
            await wait(B, "!!window.__blTc.call", 'B: called', 10)
            await B.wait_for_timeout(500)
            expect(await B.evaluate("window.__blastline.mode === 'match' && window.__blastline.game && document.getElementById('scrPause') && !document.getElementById('scrPause').hidden"),
                   "B: the warm-up pauses under the call-up")
            expect(await shown(B, SEL['call']), 'B: the call-up banner over the warm-up')
            expect(has(await text(B, SEL['call']), 'warm-up'), "B: the banner says FIGHT ends the warm-up")
            await shot(B, 'call-warmup')
            await tap(B, SEL['callGo'])
            await wait(B, "window.__blastline.mode === 'tcup' && window.__blTc.call && window.__blTc.call.ready", "B: FIGHT: the bracket, waiting for C")
            await tap(C, '#cupBack')
            await wait(C, "window.__blastline.mode === 'menu'", 'C: the menu')
            await wait(C, "!!window.__blTc.call", 'C: still called on the menu', 5)
            await C.wait_for_timeout(400)
            expect(await shown(C, SEL['call']), 'C: the call-up banner over the menu')
            await shot(C, 'call-menu')
            pill = await text(C, SEL['pill'])
            expect(has(pill, 'called'), f'C: the mini says you are called, got {pill!r}')
            await A.reload()
            await wait(A, "window.__blastline.mode === 'tcup' && window.__blTc.call && !window.__blTc.call.ready", "A: a reload comes back to the bracket, still called", 20)
            await A.wait_for_timeout(400)
            expect(await shown(A, SEL['go']), "A: the foot card's FIGHT")
            await shot(A, 'bracket-called')
            await tap(A, SEL['go'])
            await tap(C, SEL['callGo'])

            # 4. A vs the CPU (a ticket), B vs C (refereed)
            await wait(A, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", 'A: the CPU match starts', 25)
            expect(has(await text(A, '#vcStrip'), 'Friends Cup'), 'A: the HUD strip names the cup')
            await wait(B, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", 'B: the match vs C starts', 30)
            await wait(C, "window.__blastline.mode === 'match' && window.__blastline.game", 'C: the match vs B starts', 10)
            await asyncio.gather(
                walk_off(A, 'A', "window.__blastline.mode === 'result'"),
                walk_off(C, 'C', "window.__blastline.mode === 'result'"))
            await wait(A, "Object.values(window.__blTc.res).some((r) => r.res === 0 && r.why === 'game')", "A: the server plays the log again: A lost to the CPU", 30)
            await A.wait_for_timeout(500)
            expect(await shown(A, SEL['card']), 'A: the results card')
            expect(has(await text(A, SEL['card']), 'out'), f"A: the card says A is out, got {await text(A, SEL['card'])!r}")
            await sizes(A, 'result-out', '#scrResult' if await A.evaluate("!!document.getElementById('scrResult')") else 'body', PHONE)
            await wait(B, "window.__blastline.mode === 'result'", 'B: the results', 30)
            await wait(B, "Object.values(window.__blTc.res).some((r) => r.res === 1 && r.why === 'game')", "B: the referee's verdict: B goes through", 20)
            await wait(C, "Object.values(window.__blTc.res).some((r) => r.res === 0 && r.why === 'game')", "C: the referee's verdict: C is out", 20)
            expect(has(await text(B, SEL['card']), 'final'), f"B: through to the Final, got {await text(B, SEL['card'])!r}")
            expect(not await shown(B, '#rChl'), 'B: no Challenge button after a cup match')

            # 5. the final: B lets the call-up run out
            await wait(B, "!!window.__blTc.call", 'B: called for the final', 15)
            await B.wait_for_timeout(400)
            expect(await shown(B, SEL['call']), "B: the call-up banner over the results")
            await wait(B, "window.__blTc.end", 'B: the cup ends (a walkover)', 40)
            for pg, tag in ((A, 'A'), (C, 'C')): await wait(pg, "window.__blTc.end", f'{tag}: hears the end', 10)
            ends = {tag: await tc(pg, "T.end") for pg, tag in ((A, 'A'), (B, 'B'), (C, 'C'))}
            expect(ends['B'] and ends['B']['pl'] == 2 and ends['A'] and ends['A']['pl'] == 3 and ends['C'] and ends['C']['pl'] == 3,
                   f"places: B 2nd, A and C 3rd, got {[(k, v and v['pl']) for k, v in ends.items()]}")
            expect(all(v and v['ch'] == '' and v['c'] == 0 for v in ends.values()), f'the CPU is the champion and a Friends Cup pays no chips, got {ends}')
            fr = await tc(B, "Object.values(T.res).find((r) => r.r === 1)")
            expect(fr and fr['why'] == 'wo' and fr['res'] == 0, f'B: the final was a walkover, got {fr}')
            await tap(B, '#rAgain')
            await wait(B, "window.__blastline.mode === 'tcup'", 'B: Bracket')
            await B.wait_for_timeout(1500)
            await sizes(B, 'bracket-end', '#scrCup', DESK)
            await tap(A, '#rAgain')
            await wait(A, "window.__blastline.mode === 'tcup'", 'A: Bracket')
            await A.wait_for_timeout(1200)
            await shot(A, 'bracket-end-phone')
            await C.bring_to_front(); await tap(C, '#rAgain')
            await wait(C, "window.__blastline.mode === 'tcup'", 'C: Bracket (upright: the list)')
            await C.wait_for_timeout(1200)
            await shot(C, 'bracket-end-upright')
            await fits(C, 'C upright bracket', '#scrCup')
            await b.close()
    finally:
        log = stop_server(srv)
        shutil.rmtree(d, ignore_errors=True)
    for e in errs: print(e)
    if errs:
        print('--- server log (last lines) ---'); print('\n'.join(log.splitlines()[-25:]))
    else: print('no errors')

asyncio.run(main())
