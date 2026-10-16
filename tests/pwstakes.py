"""Chip stakes in the browser (ui/stakes.js) against a real `node server.js` with a temporary ACCOUNTS_DIR (port PWSTAKES_PORT, 8102 by default).
Two players: A on a phone sideways (844x390), B on a phone upright (390x844), both in Casual Quick match.
  1. Their first game: A has 12 refereed matches (written into its account file), B has 1. Both results show FOR CHIPS dimmed with its
     reason: A "Mash Master can't stake right now", B "Stakes unlock after 10 online matches · 9 to go". The rival strip says 1–0.
  2. B gets 12 too; both tap Rematch (the Casual rematch in the same room, refereed as its own game). Now FOR CHIPS is live: A opens
     the stake sheet (10 / 25 / 50, "You have …"), challenges for 25; A's button waits with a clock, B's challenge card comes up
     (upright: at the bottom). B taps Not now: A reads "No answer from Mash Master". A challenges again, B accepts.
  3. The staked match: the VS screen says REMATCH · FOR CHIPS with the 50 pot; B walks off; the referee decides: A's pot card
     "You take the 50 pot" +25, B's −25; both account files hold the stake record, both phones get the chips with the sync (the page
     never adds the pot itself). The results offer REMATCH FOR CHIPS in the second row.
  4. B challenges A while A is on the results (the card over the right column), A passes; A goes to the menu, B challenges again (the
     card at the bottom of the menu), A passes. Account > Stats shows the stake line.
  5. Play friends: A hosts, B joins; the referee plays their 1v1 too: the rival strip and FOR CHIPS on the friend results.
     Then B turns Settings > Chip stakes Off, which reaches B's account file (the server reads it before any challenge).
Screenshots go to the folder in argv[1]. Prints one line per problem, then "no errors".
Usage:  python3 tests/pwstakes.py [outdir]        (needs `python3 game/build.py` first)"""
import asyncio, sys, os, json, subprocess, tempfile, shutil, time, hashlib, pathlib, re, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWSTAKES_PORT', 8102))
URL = f'http://localhost:{PORT}/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'stakes')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PHONE, DESK, TINY, UP = {'width': 844, 'height': 390}, {'width': 1280, 'height': 760}, {'width': 667, 'height': 320}, {'width': 390, 'height': 844}
PA = {'tokens': 1350, 'last': 'phoenix', 'gfx': '2d', 'name': 'Peel Appeal'}
PB = {'tokens': 300, 'last': 'samurai', 'gfx': '2d', 'name': 'Mash Master', 'screen': 'up'}
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
def rec(d, code):
    try: return json.loads(acct_file(d, code).read_text())
    except Exception: return None
def set_on(d, code, patch):   # the test's own hand on an online record (the server reads the file each time)
    f = acct_file(d, code); r = json.loads(f.read_text()); r['on'].update(patch); f.write_text(json.dumps(r))

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
async def code(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.acct.v1') || '{}').code || ''")
async def tokens(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('potatobrawl.profile.v1') || '{}').tokens")
async def tap(pg, sel):
    await pg.locator(sel).first.click()
    await pg.wait_for_timeout(150)
async def shot(pg, name): await pg.screenshot(path=str(OUT / f'{name}.png'))
async def wait(pg, js, what, secs=20):
    try: await pg.wait_for_function(js, timeout=secs * 1000); return True
    except Exception:
        st = await pg.evaluate("(() => { const b = window.__blastline, q = b && b.qm, s = b && b.stk; return b ? [b.mode, q.st, q.note, b.net.phase, s && s.el, s && s.note] : null; })()")
        errs.append(f'timed out: {what} (mode, search, note, net, stakes, note: {json.dumps(st)})'); return False
async def overflow(pg, tag, root):   # nothing spills out of the screen sideways
    bad = await pg.evaluate("""(root) => {
      const out = [], W = innerWidth;
      for (const e of document.querySelectorAll(root + ', ' + root + ' *')) {
        if (e.closest('[hidden]') || !e.getClientRects().length) continue;
        const r = e.getBoundingClientRect();
        if (r.width && (r.right > W + 1 || r.left < -1)) out.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
      }
      return out.slice(0, 5);
    }""", root)
    expect(not bad, f'{tag}: off the screen sideways: {bad}')
async def clipped(pg, tag, sel):   # a text that doesn't fit its box (Jonny: no numbers overflowing fields)
    bad = await pg.evaluate("""(s) => [...document.querySelectorAll(s)].filter((e) => !e.closest('[hidden]') && e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.className)""", sel)
    expect(not bad, f'{tag}: text cut off in {bad}')

async def open_casual(pg, tag):
    await pg.goto(URL)
    await wait(pg, "window.__blastline && window.__blastline.mode === 'menu' && window.__blastline.qm.conn", f'{tag}: connected on the menu')
    await pg.wait_for_timeout(300)
    await tap(pg, '#bRanked')
    await wait(pg, "window.__blastline.mode === 'quick'", f'{tag}: Quick match opens')
    await pg.wait_for_timeout(400)
    if await shown(pg, '#scrSeason .ss-sheet'): await tap(pg, '#ssGo')
    await tap(pg, '#qmC')
    await tap(pg, '#qmFind')
    await wait(pg, "window.__blastline.qm.st !== 'idle' && window.__blastline.qm.authed", f'{tag}: searching Casual with a new account', 15)

async def walk_off(B, A, what):
    """B walks off the stage until the match is over; both reach the results"""
    await wait(B, "window.__blastline.mode === 'match' && window.__blastline.game && window.__blastline.game.phase !== 'countdown'", f'B: {what} starts', 60)   # a loaded machine (check.sh runs two browser steps and the simulations) is slow
    await B.bring_to_front()
    await B.keyboard.down('ArrowLeft')
    await wait(B, "window.__blastline.mode === 'result'", f'B: {what} ends (walked off three times)', 180)
    await B.keyboard.up('ArrowLeft')
    await wait(A, "window.__blastline.mode === 'result'", f'A: the results of {what}', 45)

async def main():
    d = tempfile.mkdtemp(prefix='pwstakes-')
    srv = start_server(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            ca, cb = await device(b, PHONE, True, PA), await device(b, UP, True, PB)
            A, B = await ca.new_page(), await cb.new_page()
            for t, pg in (('A', A), ('B', B)): watch(pg, t)

            # ---- 1. the first Casual game: A is a regular (12 refereed matches), B is new: FOR CHIPS dimmed with the reason on both
            await open_casual(A, 'A')
            await open_casual(B, 'B')
            ac, bc = await code(A), await code(B)
            expect(bool(ac) and bool(bc), 'both: Casual Find match makes the silent account')
            await wait(A, "window.__blastline.qm.vsN >= 1", 'A: found B (Casual)', 20)
            set_on(d, ac, {'g': 12})
            await walk_off(B, A, 'the first Casual game')
            await wait(A, "window.__blastline.stk.el && window.__blastline.stk.el.why === 'them'", "A: the server says B can't stake yet", 15)
            await wait(B, "window.__blastline.stk.el && window.__blastline.stk.el.why === 'new'", 'B: the server says B is new', 15)
            await A.wait_for_timeout(1200)
            expect(await shown(A, '#rStake') and await A.evaluate("document.getElementById('rStake').disabled"), 'A: FOR CHIPS shows, dimmed')
            expect(has(await text(A, '#rStakeWhy'), "Mash Master can't stake right now"), f"A: the reason, got {await text(A, '#rStakeWhy')!r}")
            expect(has(await text(B, '#rStakeWhy'), 'Stakes unlock after 10 online matches', '9 to go'), f"B: the reason, got {await text(B, '#rStakeWhy')!r}")
            expect(has(await text(A, '#rRiv'), 'You lead 1–0'), f"A: the rival strip, got {await text(A, '#rRiv')!r}")
            await shot(A, 'result-dim-844'); await shot(B, 'result-dim-390')
            await clipped(A, 'A dim 844', '#resSheet .res-actions .btn, #rStakeWhy'); await clipped(B, 'B dim 390', '#resSheet .res-actions .btn, #rStakeWhy')

            # ---- 2. B a regular too; the Casual rematch (both tap) is its own refereed game; now the stake is on
            set_on(d, bc, {'g': 12})
            await tap(A, '#rAgain'); await tap(B, '#rAgain')
            await walk_off(B, A, 'the Casual rematch')
            await wait(A, "window.__blastline.stk.el && window.__blastline.stk.el.g === 2 && window.__blastline.stk.el.ok.length === 3", 'A: all three stakes open after game 2', 15)
            await wait(B, "window.__blastline.stk.el && window.__blastline.stk.el.ok.includes(25)", 'B: the stakes open', 15)
            await A.wait_for_timeout(1400)
            expect(await A.evaluate("document.querySelector('#resSheet .res-actions').classList.contains('stk-seg') && !document.getElementById('rStake').disabled"), 'A: FOR CHIPS joins the Rematch button, live')
            expect(has(await text(A, '#rStake'), 'For chips') and has(await text(A, '#rAgain'), 'Rematch'), f"A: REMATCH | FOR CHIPS, got {await text(A, '#rAgain')!r} {await text(A, '#rStake')!r}")
            expect(has(await text(A, '#rRiv'), 'You lead 2–0'), f"A: the record after the rematch, got {await text(A, '#rRiv')!r}")
            await shot(A, 'result-forchips-844'); await shot(B, 'result-forchips-390')
            await clipped(A, 'A seg 844', '#resSheet .res-actions .btn, #rStake .sk-l')
            await clipped(B, 'B seg 390', '#resSheet .res-actions .btn, #rStake .sk-l')
            for name, vp in (('667', TINY), ('1280', DESK)):
                await A.set_viewport_size(vp); await A.wait_for_timeout(450); await shot(A, f'result-forchips-{name}'); await clipped(A, f'A seg {name}', '#resSheet .res-actions .btn, #rStake .sk-l')
            await A.set_viewport_size(PHONE); await A.wait_for_timeout(300)
            # the stake sheet
            await tap(A, '#rStake')
            expect(await shown(A, '#scrStake .sk-sheet'), 'A: the stake sheet opens')
            have = await text(A, '#skHave')
            expect(has(have, 'You have', '0 of 5 today'), f'A: the sheet says the chips and today\'s count, got {have!r}')
            expect(await A.evaluate("[...document.querySelectorAll('#skTiles .sk-tile')].map((b) => b.disabled).join() === 'false,false,false'"), 'A: 10, 25 and 50 all open')
            expect(await A.evaluate("document.querySelector('#skTiles .sk-tile.on').innerText.includes('25')"), 'A: 25 picked first')
            await shot(A, 'sheet-844')
            await tap(A, '#skTiles .sk-tile:nth-child(3)')
            expect(has(await text(A, '#skSend'), 'Challenge for 50'), f"A: picking 50 changes the button, got {await text(A, '#skSend')!r}")
            await tap(A, '#skTiles .sk-tile:nth-child(2)')
            await tap(A, '#skSend')
            await wait(A, "window.__blastline.stk.out && window.__blastline.stk.out.s === 25", 'A: the challenge is out', 10)
            await wait(B, "!document.getElementById('stkCard').hidden", "B: the challenge card", 10)
            await A.wait_for_timeout(500)
            expect(has(await text(A, '#rStake'), '25 sent', 'waiting for Mash Master', 'tap to cancel'), f"A: the pending button, got {await text(A, '#rStake')!r}")
            card = await text(B, '#stkCard')
            expect(has(card, 'Challenge', 'Peel Appeal wants a rematch for', '25', 'Winner takes 50', 'to decide', 'Accept'), f'B: the card, got {card!r}')
            await shot(A, 'result-waiting-844'); await shot(B, 'card-390')
            await overflow(B, 'B card 390', '#stkCard')
            await tap(B, '#skcNo')
            await wait(A, "window.__blastline.stk.out === null", 'A: the stake is off after Not now', 10)
            await A.wait_for_timeout(300)
            expect(has(await text(A, '#rStakeWhy'), 'No answer from Mash Master', 'the stake is off'), f"A: the same words for a decline, got {await text(A, '#rStakeWhy')!r}")
            expect(not await shown(B, '#stkCard'), 'B: the card goes after Not now')
            # again, and B accepts
            await tap(A, '#rStake'); await tap(A, '#skSend')
            await wait(B, "!document.getElementById('stkCard').hidden", 'B: the second challenge', 20)
            ta0, tb0 = await tokens(A), await tokens(B)
            vs0 = await A.evaluate("window.__blastline.qm.vsN")
            await tap(B, '#skcOk')

            # ---- 3. the staked match: VS with the pot, the referee, the pot card, the chips in both accounts
            if await wait(A, f"window.__blastline.qm.vsN > {vs0} && !document.getElementById('qmVs').hidden", 'A: the VS screen of the rematch for chips', 15):
                await shot(A, 'vs-forchips-844')   # first: the rematch's VS is short (both phones are already in the room)
                st = await text(A, '#vsStamp')
                expect(has(st, 'Rematch', 'for chips', '50 pot', '25 each', "doesn't count for rank"), f'A: the VS stamp, got {st!r}')
                expect(has(await text(A, '#vsRiv'), 'Rematch', 'You lead 2–0'), f"A: the VS pill, got {await text(A, '#vsRiv')!r}")
            if await shown(B, '#qmVs'): await shot(B, 'vs-forchips-390')
            await walk_off(B, A, 'the staked match')
            await wait(A, "window.__blastline.stk.res && window.__blastline.stk.res.d === 25", 'A: the referee: +25', 15)
            await wait(B, "window.__blastline.stk.res && window.__blastline.stk.res.d === -25", 'B: the referee: −25', 15)
            await A.wait_for_timeout(1800)
            pa = await text(A, '#rPot')
            expect(await shown(A, '#rPot') and not await shown(A, '#rRank') and has(pa, 'You take the 50 pot', '25 from', 'Mash Master', '+25'), f'A: the pot card, got {pa!r}')
            pb = await text(B, '#rPot')
            expect(has(pb, 'Peel Appeal takes the 50 pot', '−25'), f'B: the pot card, got {pb!r}')
            expect(not has(await text(A, '#rWhy'), 'pot'), 'A: the pot stays out of the chips line (only in its card)')
            expect(has(await text(A, '#rMode'), 'Rematch for chips', '25 each'), f"A: the kicker, got {await text(A, '#rMode')!r}")
            ra, rb = rec(d, ac), rec(d, bc)
            expect(ra and ra['on']['sk']['w'] == 1 and ra['on']['sk']['net'] == 25 and ra['on']['sk']['n'] == 1, f"server: A's stake record, got {ra and ra['on'].get('sk')}")
            expect(rb and rb['on']['sk']['l'] == 1 and rb['on']['sk']['net'] == -25, f"server: B's stake record, got {rb and rb['on'].get('sk')}")
            # the chips arrive with the sync: the match's own chips (on this phone) plus the pot (from the server)
            # (the pot card's "before" is the phone's chips once the match paid its own: the match line plus any mastery reward)
            for pg, ck, t0, d0, tag in ((A, ac, ta0, 25, 'A'), (B, bc, tb0, -25, 'B')):
                m, b0 = await pg.evaluate("window.__blastline.qm.shown.total"), await pg.evaluate("window.__blastline.stk.res.b")
                expect(isinstance(b0, int) and b0 >= t0 + m, f'{tag}: the pot card starts from the chips after the match ({t0} + {m} and rewards), got {b0}')
                expect(has(await text(pg, '#rPotS'), f'{b0:,} → {b0 + d0:,}'), f"{tag}: the pot card's before → after, got {await text(pg, '#rPotS')!r}")
                if not await wait(pg, f"JSON.parse(localStorage.getItem('potatobrawl.profile.v1')).tokens === {(b0 or 0) + d0}", f'{tag}: chips {b0} {d0:+} after the sync', 20):
                    r = rec(d, ck)
                    errs.append(f"  {tag}: phone {await tokens(pg)}, account file {r and r['prof'].get('tokens')} (rev {r and r.get('rev')})")
            expect(await A.evaluate("document.querySelector('#resSheet .res-actions').classList.contains('stk-row')") and has(await text(A, '#rStake'), 'Rematch', 'for chips'), 'A: REMATCH FOR CHIPS in the second row')
            await shot(A, 'result-pot-844'); await shot(B, 'result-pot-390')
            await clipped(A, 'A pot 844', '#rPot .pt-head, #rPot .pt-sub, #resSheet .res-actions .btn')
            await clipped(B, 'B pot 390', '#rPot .pt-head, #rPot .pt-sub, #resSheet .res-actions .btn')
            for name, vp in (('667', TINY), ('1280', DESK)):
                await A.set_viewport_size(vp); await A.wait_for_timeout(450); await shot(A, f'result-pot-{name}'); await clipped(A, f'A pot {name}', '#rPot .pt-head, #rPot .pt-sub, #resSheet .res-actions .btn')
            await A.set_viewport_size(PHONE); await A.wait_for_timeout(300)

            # ---- 4. B challenges A on the results (the card over the right column), then on the menu (at the bottom)
            await tap(B, '#rStake'); await tap(B, '#skSend')
            if await wait(A, "!document.getElementById('stkCard').hidden", "A: B's challenge on the results", 10):
                await A.wait_for_timeout(500)
                expect(await A.evaluate("document.getElementById('stkCard').classList.contains('side')"), 'A: sideways, the card sits over the right column')
                expect(has(await text(A, '#stkCard'), 'Mash Master wants a rematch for'), f"A: the card, got {await text(A, '#stkCard')!r}")
                await shot(A, 'result-card-844')
                await A.set_viewport_size(DESK); await A.wait_for_timeout(450); await shot(A, 'result-card-1280'); await A.set_viewport_size(PHONE)
                await tap(A, '#skcNo')
            await wait(B, "window.__blastline.stk.out === null && window.__blastline.stk.busy === 0", "B: A passed", 10)
            await tap(A, '#rMenu')
            await wait(A, "window.__blastline.mode === 'menu'", 'A: the menu')
            await tap(B, '#rStake'); await tap(B, '#skSend')
            if await wait(A, "!document.getElementById('stkCard').hidden", "A: B's challenge on the menu", 10):
                await A.wait_for_timeout(500)
                expect(not await A.evaluate("document.getElementById('stkCard').classList.contains('side')"), 'A: on the menu the card sits at the bottom')
                await shot(A, 'menu-card-844'); await overflow(A, 'A menu card 844', '#stkCard')
                await A.set_viewport_size(TINY); await A.wait_for_timeout(450); await shot(A, 'menu-card-667'); await overflow(A, 'A menu card 667', '#stkCard'); await A.set_viewport_size(PHONE)
                await tap(A, '#skcNo')
            await wait(B, "window.__blastline.stk.out === null", 'B: the second challenge is off', 10)
            # Account > Stats: the stake line
            await tap(A, '#mRank'); await tap(A, '#acTabS'); await A.wait_for_timeout(500)
            expect(has(await text(A, '#acPanS'), 'Chip stakes', '1–0', 'net +25', '1 of 5 today'), f"A: the Stats line, got {(await text(A, '#acPanS') or '')[:300]!r}")
            await shot(A, 'stats-844')
            # ---- 5. Play friends: A hosts, B joins from the lobby list; the referee plays their 1v1 too (the record, FOR CHIPS)
            await tap(A, '#acClose'); await A.wait_for_timeout(200)
            await tap(A, '#bOnline'); await A.wait_for_timeout(900); await tap(A, '#onHost')
            await tap(B, '#rMenu'); await wait(B, "window.__blastline.mode === 'menu'", 'B: the menu')
            await tap(B, '#bOnline'); await B.wait_for_timeout(1500)
            await tap(B, '#onList li .chip')
            await walk_off(B, A, 'the Play friends game')
            if await wait(A, "(() => { const e = window.__blastline.stk.el; return !!e && /^bl/.test(e.id) && e.ok.length > 0; })()", 'A: the referee counted the friend game, stakes open', 15):
                await A.wait_for_timeout(1200)
                expect(has(await text(A, '#rRiv'), 'Mash Master', 'You lead 4–0') and has(await text(A, '#rSub'), 'You lead 4–0 now'), f"A: the friend game's rival strip, got {await text(A, '#rRiv')!r}")
                expect(await shown(A, '#rStake') and has(await text(A, '#rStake'), 'For chips'), 'A: FOR CHIPS after a Play friends game')
                await shot(A, 'result-friends-844')
            rf = rec(d, ac)
            expect(rf and rf['on']['g'] == 16, f"server: A's refereed matches: 12 + two Casual games + the staked one + the friend game = 16, got {rf and rf['on'].get('g')}")
            await tap(B, '#rMenu')

            # Settings > Chip stakes: Off is stored on the account, where the server reads it before any challenge
            await wait(B, "window.__blastline.mode === 'menu'", 'B: the menu')
            await tap(B, '#bSettings'); await B.wait_for_timeout(300)
            expect(await shown(B, '#setStakeRow') and has(await text(B, '#setStakeRow'), 'Chip stakes', 'On', 'Off'), 'B: Settings has Chip stakes On / Off')
            await tap(B, '#setStake .chip:nth-child(2)')
            expect(await B.evaluate("JSON.parse(localStorage.getItem('potatobrawl.profile.v1')).so === 1"), 'B: Off is saved on the phone')
            await shot(B, 'settings-390'); await overflow(B, 'B settings 390', '#scrSettings .sheet')
            for _ in range(60):
                r = rec(d, bc)
                if r and r['prof'].get('so') == 1: break
                await asyncio.sleep(0.25)
            expect(r and r['prof'].get('so') == 1, f"server: B's account holds Chip stakes Off, got {r and r['prof'].get('so')}")
            await b.close()
    except Exception as e:
        errs.append(f'stopped: {type(e).__name__}: {str(e).splitlines()[0]}')
    finally:
        log = stop_server(srv)
        shutil.rmtree(d, ignore_errors=True)
    for ln in log.splitlines():
        if os.environ.get('PWSTAKES_LOG') and 'quick' in ln.lower(): print('server:', ln)
        if 'quick:' in ln and 'drifted' in ln: errs.append('server: ' + ln.strip())
    print('\n'.join(errs) or 'no errors')

asyncio.run(main())
