"""Accounts in the browser: the profile pill, the Account sheet and the sync code, against a real `node server.js` on port 8093.
Starts its own server (with a temporary ACCOUNTS_DIR, then once more with accounts off) and drives several browser contexts as
separate devices. Prints one line per problem, then "no errors". Screenshots (4 sizes x every sync state) go to the folder in argv[1].
Usage:  python3 tests/pwacct.py [outdir]        (needs `python3 game/build.py` first)"""
import asyncio, sys, os, json, subprocess, tempfile, shutil, time, hashlib, pathlib, re, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PWACCT_PORT', 8093))
URL = f'http://localhost:{PORT}/'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'build' / 'shots' / 'acct')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
SIZES = [('se', {'width': 667, 'height': 320}, True), ('phone', {'width': 844, 'height': 390}, True),
         ('desk', {'width': 1280, 'height': 760}, False), ('up', {'width': 390, 'height': 844}, True),
         ('rot', {'width': 390, 'height': 844}, True)]   # up = the Upright screen setting; rot = an upright phone with the game turned sideways (the default)
PA = {'tokens': 85, 'rating': 1080, 'peak': 1180, 'wins': 3, 'losses': 2, 'matches': 5, 'last': 'phoenix', 'friendW': 2, 'friendL': 1,
      'owned': {'phoenix': [0, 1]}, 'pal': {'phoenix': 1},
      'history': [{'r': 1, 'd': 14, 'me': 'phoenix', 'op': 'odin', 'opr': 1000, 't': 3}, {'r': 0, 'd': -12, 'me': 'phoenix', 'op': 'wizard', 'opr': 1040, 't': 2}, {'r': 1, 'd': 10, 'me': 'phoenix', 'op': 'dragon', 'opr': 990, 't': 1}]}
PC = {'tokens': 12, 'rating': 1010, 'peak': 1010, 'wins': 1, 'losses': 0, 'matches': 1, 'last': 'samurai'}
errs = []
def expect(ok, msg):
    if not ok: errs.append(msg)
def has(hay, *subs):   # innerText follows text-transform (buttons and headings come back in capitals), so compare without case
    h = (hay or '').lower()
    return all(x.lower() in h for x in subs)

# ---------- the server
def start_server(accounts_dir):
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0')
    env.pop('ACCOUNTS_DIR', None)
    if accounts_dir: env['ACCOUNTS_DIR'] = accounts_dir
    p = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(60):
        try:
            if urllib.request.urlopen(URL + 'health', timeout=1).status == 200: return p
        except Exception: time.sleep(0.2)
    p.kill(); raise RuntimeError('server did not start')
def stop_server(p):
    p.terminate()
    try: p.wait(5)
    except Exception: p.kill()
def norm(code): return re.sub(r'[^0-9A-Z]', '', code.upper())
def rec(d, code):
    f = pathlib.Path(d) / (hashlib.sha256(norm(code).encode()).hexdigest() + '.json')
    try: return json.loads(f.read_text())
    except Exception: return None
async def wait_rec(d, code, pred, what, secs=10):
    for _ in range(int(secs / 0.25)):
        r = rec(d, code)
        if r and pred(r): return r
        await asyncio.sleep(0.25)
    errs.append(f'server never showed: {what} (last: {json.dumps(rec(d, code))[:200]})')
    return rec(d, code)

# ---------- the pages
async def device(b, vp, mob, profile=None, perms=False, name=''):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob,
                              permissions=['clipboard-read', 'clipboard-write'] if perms else [])
    await ctx.add_init_script("window.__blNoQuick = true")   # these pages check the offline rank pill and Ranked; tests/pwquick.py covers Quick match
    if profile is not None:
        await ctx.add_init_script("if (!localStorage.getItem('potatobrawl.profile.v1')) localStorage.setItem('potatobrawl.profile.v1', %s)" % json.dumps(json.dumps(profile)))
    return ctx
def watch(pg, tag):
    pg.on('pageerror', lambda e: errs.append(f'{tag}: page error: {e}'))
    def con(m):
        if m.type == 'error' and 'Failed to load resource' not in m.text: errs.append(f'{tag}: console: {m.text}')
    pg.on('console', con)
async def prof(pg): return await pg.evaluate('JSON.parse(JSON.stringify(window.__blAcct.P))')
async def acst(pg): return await pg.evaluate('JSON.parse(JSON.stringify(window.__blAcct.st))')
async def text(pg, sel): return await pg.evaluate("(s) => { const e = document.querySelector(s); return e ? e.innerText : null }", sel)
async def open_sheet(pg):
    if await pg.evaluate("document.getElementById('scrAccount').hidden"):
        await pg.click('#mRank .plate'); await pg.wait_for_function("!document.getElementById('scrAccount').hidden", timeout=5000)   # the plate: a tap on the chip coin opens the Shop (at 667x320 the button's centre is on the coin)
        await pg.wait_for_timeout(250)
async def close_sheet(pg): await pg.click('#acClose'); await pg.wait_for_timeout(150)
async def btn(pg, label, force=False):   # a button or link inside the sync section, by its text
    # force: skip Playwright's stability wait, for the second tap of a tap-twice button (it disarms itself after 6 s, and a loaded machine can take longer than that to settle)
    await pg.locator('#acSync button', has_text=re.compile('^' + re.escape(label) + '$')).first.click(force=force)
async def wait_pull(pg):    # the page only pulls if the last sync was a few seconds ago
    await pg.wait_for_function('Date.now() - window.__blAcct.st.t > 4300', timeout=15000)
    await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
async def shot(pg, tag): await pg.screenshot(path=str(OUT / f'{tag}.png'))
async def goto(pg, url=URL):
    await pg.goto(url); await pg.wait_for_function('window.__blAcct && window.__blastline', timeout=30000); await pg.wait_for_timeout(500)

async def functional(b, d):
    # ----- device A: a phone with progress saves it to a new account
    ca = await device(b, {'width': 844, 'height': 390}, True, PA, perms=True)
    A = await ca.new_page(); watch(A, 'A')
    await goto(A)
    expect(await A.is_visible('#mRank') and '1080' in (await text(A, '#mRank')) and '85' in (await text(A, '#mRank')), 'A: the pill shows the rating and the chips')
    expect(await A.is_visible('#mName'), 'A: the pill shows the name at 844 wide')
    expect(not await A.evaluate("!!document.getElementById('setReset')"), 'Settings no longer has Reset progress')
    await open_sheet(A)
    sy = await text(A, '#acSync')
    expect(has(sy, 'Save my progress', 'I have a code'), f'A: unlinked sheet offers Save my progress and I have a code ({sy!r})')
    nf = await A.evaluate("window.BL.FIGHTERS.length")   # one base skin per fighter, plus the one bought
    expect(await A.input_value('#acName') != '' and (await text(A, '#acSkins')).startswith(str(nf + 1)), f'A: the sheet shows a name and the {nf + 1} skins ({nf} base + 1)')
    await btn(A, 'Save my progress'); await A.wait_for_selector('.ac-code', timeout=10000)
    st = await acst(A); code = st['code']
    expect(re.fullmatch(r'[0-9A-HJKMNP-TV-Z]{16}', code or '') is not None, f'A: a code was created ({code})')
    r = await wait_rec(d, code, lambda r: r['rev'] == 1, 'the new account')
    expect(r and r['prof']['tokens'] == 85 and r['prof']['owned']['phoenix'] == [0, 1] and r['prof']['rating'] == 1080, 'server: the new account holds A\'s chips, skins and rating')
    shown = await text(A, '.ac-code span')
    expect(shown == '-'.join([norm(code)[i:i + 4] for i in range(0, 16, 4)]), f'A: the new code is shown in full at first ({shown})')
    expect('Write this code down' in await text(A, '#acSync'), 'A: the new account says to write the code down')
    await shot(A, 'A_linked_fresh')
    await btn(A, 'Hide'); expect((await text(A, '.ac-code span')).startswith('•'), 'A: Hide masks the code')
    await btn(A, 'Show'); expect(norm(await text(A, '.ac-code span')) == norm(code), 'A: Show reveals it')
    await btn(A, 'Copy link')
    clip = await A.evaluate('navigator.clipboard.readText()')
    expect(clip == URL + '#sync=' + norm(code), f'A: Copy link puts the link on the clipboard ({clip})')
    await btn(A, 'Copy code'); clip = await A.evaluate('navigator.clipboard.readText()')
    expect(clip == '-'.join([norm(code)[i:i + 4] for i in range(0, 16, 4)]), f'A: Copy code puts the dashed code on the clipboard ({clip})')
    await close_sheet(A)
    expect(await A.evaluate("!!localStorage.getItem('potatobrawl.acct.v1')"), 'A: the link is remembered on the device')
    await A.reload(); await goto(A)
    expect((await acst(A))['code'] == code, 'A: still linked after a reload')
    await open_sheet(A)
    expect('Saved' in await text(A, '#acStat') and (await text(A, '.ac-code span')).startswith('•'), 'A: linked sheet shows "Saved ..." and a masked code')
    await shot(A, 'A_linked'); await close_sheet(A)

    # ----- device B: a fresh desktop opens the link
    cb = await device(b, {'width': 1280, 'height': 760}, False)
    B = await cb.new_page(); watch(B, 'B')
    await B.goto(URL + '#sync=' + norm(code).lower()); await B.wait_for_function('window.__blAcct && window.__blastline', timeout=30000)
    await B.wait_for_function('window.__blAcct.st.code', timeout=15000); await B.wait_for_timeout(400)
    pb = await prof(B); pa = await prof(A)
    expect(pb['tokens'] == 85 and pb['owned']['phoenix'] == [0, 1] and pb['pal']['phoenix'] == 1 and pb['rating'] == 1080, f'B: the link brought A\'s chips, skins and rating ({pb["tokens"]}, {pb["owned"]["phoenix"]})')
    expect(pb.get('name') == pa.get('name') and pb.get('name'), 'B: the name came along')
    expect(await B.evaluate('window.__blastline.mode') == 'menu', 'B: a new device opened with a link starts on the menu, not the tutorial')
    expect(await B.evaluate("location.hash") == '', 'B: the #sync= fragment is gone from the address bar')
    expect(not await B.evaluate("document.getElementById('scrAccount').hidden"), 'B: the sheet is open after linking')
    expect('Linked' in await text(B, '#acSync'), 'B: the sheet says it linked')
    await shot(B, 'B_linked_from_link')
    await close_sheet(B)
    expect('85' in await text(B, '#mRank'), 'B: the pill shows the account\'s chips')

    # ----- B wins chips and a skin; A catches up when it comes back to the page
    await B.evaluate("(() => { const P = window.__blAcct.P; P.tokens += 30; P.wins += 1; P.matches += 1; P.owned.odin.push(2); window.__blAcct.save(); })()")
    r = await wait_rec(d, code, lambda r: r['prof']['tokens'] == 115, 'B\'s 30 chips', 12)
    expect(r and r['rev'] == 2 and r['prof']['owned']['odin'] == [0, 2], 'server: B\'s chips and skin arrived (revision 2)')
    await wait_pull(A)
    await A.wait_for_function('window.__blAcct.P.tokens === 115', timeout=12000)
    pa = await prof(A)
    expect(pa['owned']['odin'] == [0, 2] and pa['wins'] == 4, 'A: pulled B\'s chips, skin and win when the page came back')
    expect('115' in await text(A, '#mRank'), 'A: the pill updated')

    # ----- both change things while B has no network: nothing is lost
    await cb.set_offline(True)
    await B.evaluate("(() => { const P = window.__blAcct.P; P.tokens += 10; P.owned.dragon.push(3); window.__blAcct.save(); })()")
    await B.wait_for_function("window.__blAcct.ui.err.includes('reach')", timeout=15000)
    await open_sheet(B)
    expect('reach' in (await text(B, '#acStat')), 'B: offline, the sheet shows one quiet line')
    await shot(B, 'B_linked_offline'); await close_sheet(B)
    await A.evaluate("(() => { const P = window.__blAcct.P; P.tokens += 5; P.owned.wizard.push(1); window.__blAcct.save(); })()")
    await wait_rec(d, code, lambda r: r['prof']['tokens'] == 120, 'A\'s 5 chips', 12)
    await cb.set_offline(False)
    await B.evaluate('window.__blAcct.sync()')
    r = await wait_rec(d, code, lambda r: r['prof']['tokens'] == 130, 'the merge (120 + B\'s 10)', 12)
    pb = await prof(B)
    expect(r and r['prof']['owned']['odin'] == [0, 2] and r['prof']['owned']['dragon'] == [0, 3] and r['prof']['owned']['wizard'] == [0, 1], f'server: all three skins kept after the conflict ({r and r["prof"]["owned"]})')
    expect(pb['tokens'] == 130 and pb['owned']['wizard'] == [0, 1], 'B: merged copy (chips 130, A\'s skin) is on the device')
    await wait_pull(A); await A.wait_for_function('window.__blAcct.P.tokens === 130', timeout=12000)
    expect((await prof(A))['owned']['dragon'] == [0, 3], 'A: pulled the merged copy with B\'s skin')

    # ----- a ranked match result saves by itself
    await A.click('#bRanked'); await A.wait_for_timeout(700)
    await A.click('#selGo'); await A.wait_for_timeout(700)
    await A.wait_for_function("window.__blastline.game && window.__blastline.game.phase !== 'countdown'", timeout=90000)
    before = (await prof(A))['tokens']
    await A.evaluate("(() => { const g = window.__blastline.game; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; })()")
    await A.wait_for_function("window.__blastline.mode === 'result'", timeout=90000)
    after = (await prof(A))['tokens']
    expect(after > before, f'A: the match paid chips ({before} -> {after})')
    r = await wait_rec(d, code, lambda r: r['prof']['tokens'] == after, 'the match result', 14)
    expect(r and r['prof']['matches'] == (await prof(A))['matches'], 'server: the match result was saved by itself')
    await A.click('#rMenu'); await A.wait_for_timeout(400)

    # ----- a new name is saved and follows to B
    await open_sheet(A)
    await A.fill('#acName', 'Spud Lord'); await A.press('#acName', 'Tab'); await A.wait_for_timeout(200)
    expect((await prof(A))['name'] == 'Spud Lord' and 'SPUD' in (await text(A, '#mName')).upper(), 'A: the name changed, also in the pill')
    await wait_rec(d, code, lambda r: r['prof'].get('name') == 'Spud Lord', 'the new name')
    await A.fill('#acName', 'x' * 40); await A.press('#acName', 'Tab'); await A.wait_for_timeout(200)
    expect(len((await prof(A))['name']) <= 16, 'A: a long name is cut to 16 characters')
    await A.fill('#acName', 'Spud Lord'); await A.press('#acName', 'Tab'); await A.wait_for_timeout(200)
    await wait_rec(d, code, lambda r: r['prof'].get('name') == 'Spud Lord', 'the name again')
    await wait_pull(B); await B.wait_for_function("window.__blAcct.P.name === 'Spud Lord'", timeout=12000)

    # ----- Reset progress on A wipes the account too, and B follows (its sound setting stays)
    await B.evaluate("(() => { window.__blAcct.P.sound = false; window.__blAcct.save(); })()")
    await B.wait_for_timeout(300)
    await btn_reset(A)
    r = await wait_rec(d, code, lambda r: r['prof']['tokens'] == 0 and r['prof']['owned']['odin'] == [0], 'the reset', 12)
    expect(r and r['prof'].get('name') == 'Spud Lord', 'server: a reset keeps the name')
    await wait_pull(B); await B.wait_for_function('window.__blAcct.P.tokens === 0', timeout=12000)
    pb = await prof(B)
    expect(pb['owned']['odin'] == [0] and pb['rating'] == 1000 and pb['sound'] is False, 'B: followed the reset, kept its own sound setting')

    # ----- B unlinks: its progress stays, the code is forgotten
    await open_sheet(B)
    await btn(B, 'Unlink this device'); await btn(B, 'Tap again to unlink', force=True); await B.wait_for_timeout(300)
    expect((await acst(B))['code'] == '' and not await B.evaluate("!!localStorage.getItem('potatobrawl.acct.v1')"), 'B: unlinked, the link is forgotten')
    expect(has(await text(B, '#acSync'), 'Save my progress'), 'B: the sheet offers to save again')
    await close_sheet(B); await cb.close()

    # ----- device C already has progress: linking asks first
    cc = await device(b, {'width': 844, 'height': 390}, True, PC)
    C = await cc.new_page(); watch(C, 'C')
    await C.goto(URL + '#sync=' + code); await C.wait_for_function('window.__blAcct && window.__blastline', timeout=30000)
    await C.wait_for_function("window.__blAcct.ui.view === 'replace'", timeout=15000); await C.wait_for_timeout(300)
    sy = await text(C, '#acSync')
    expect(has(sy, 'already has progress', "Use the account's", 'This device'), f'C: linking over existing progress asks first ({sy!r})')
    expect((await prof(C))['tokens'] == 12 and (await acst(C))['code'] == '', 'C: nothing changed while the question is open')
    await shot(C, 'C_replace')
    await btn(C, 'Cancel'); await C.wait_for_timeout(300)
    expect((await prof(C))['tokens'] == 12 and (await acst(C))['code'] == '' and await C.evaluate("location.hash") == '', 'C: Cancel keeps the device as it was and clears the address bar')
    await btn(C, 'I have a code')
    await C.fill('#acCode', 'abc'); await btn(C, 'Link this device'); await C.wait_for_timeout(200)
    expect("doesn't look right" in await text(C, '#acSync'), 'C: a short code is refused')
    await C.fill('#acCode', 'aaaaaaaaaaaaaaaa'); expect(await C.input_value('#acCode') == 'AAAA-AAAA-AAAA-AAAA', 'C: the code field adds dashes and capitals')
    await btn(C, 'Link this device'); await C.wait_for_function("document.getElementById('acSync').innerText.includes('No account')", timeout=8000)
    await shot(C, 'C_unknown_code')
    await C.fill('#acCode', 'zzzz'); await C.fill('#acCode', norm(code).lower())
    await btn(C, 'Link this device'); await C.wait_for_function("window.__blAcct.ui.view === 'replace'", timeout=8000)
    await btn(C, "Use the account's"); await C.wait_for_function('window.__blAcct.st.code', timeout=8000); await C.wait_for_timeout(300)
    pc = await prof(C)
    expect(pc['tokens'] == 0 and pc['last'] == 'phoenix' and pc['name'] == 'Spud Lord', f'C: the account\'s progress replaced the device\'s ({pc["tokens"]}, {pc["last"]})')
    await cc.close(); await ca.close()

async def btn_reset(pg):
    await open_sheet(pg)
    await pg.click('#acReset')
    expect(has(await text(pg, '#acReset'), 'everywhere'), 'a linked device warns that Reset erases the account too')
    await pg.click('#acReset', force=True); await pg.wait_for_timeout(300)
    expect((await prof(pg))['tokens'] == 0, 'reset: chips are gone')
    await close_sheet(pg)

# ---------- screenshots: every state at every size
async def shots(b, d, code):
    for tag, vp, mob in SIZES:
        ctx = await device(b, vp, mob, dict(PA, screen='up') if tag == 'up' else PA)
        pg = await ctx.new_page(); watch(pg, 'shots ' + tag)
        await goto(pg)
        await shot(pg, f'{tag}_1_start')
        # the profile plate + coins (#mRank) must not run into the logo, the menu cards or the gear
        bad = await pg.evaluate("""(() => {
          const q = (s) => document.querySelector(s).getBoundingClientRect(), R = q('#mRank'), G = q('#bSettings'), W = innerWidth, H = innerHeight;   // screen boxes (the sideways game is rotated); sizes below use layout px
          const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          const bad = [];
          if (hit(R, G)) bad.push('gear');
          if (R.left < 0 || R.right > W || R.top < 0 || R.bottom > H) bad.push('off screen');
          const pe = document.getElementById('mRank'), ge = document.getElementById('bSettings');
          if (Math.abs(pe.offsetHeight - ge.offsetHeight) > 1) bad.push('height ' + pe.offsetHeight + ' vs gear ' + ge.offsetHeight);
          const r = document.createRange(); r.selectNodeContents(document.querySelector('#scrMenu h1')); if (hit(R, r.getBoundingClientRect())) bad.push('logo');
          for (const e of document.querySelectorAll('#scrMenu .mm-col button')) if (hit(R, e.getBoundingClientRect())) bad.push(e.textContent.trim().slice(0, 10));
          // the compact plate (667x320, or a full bar) is the picture and the emblem only, by design: the rating is checked where it shows
          const compact = document.getElementById('app').classList.contains('tiny') || pe.classList.contains('fit2');
          for (const id of ['mAvatar', 'mBadge', 'mRating', 'mTokens', 'mCups']) { const e = document.getElementById(id); if (e && !e.hidden && !(compact && id === 'mRating')) { const x = e.getBoundingClientRect(), rot = R.height > R.width;   // the sideways game is rotated: its across is the screen's up-down
            if ((rot ? x.height : x.width) < 4 || (rot ? x.bottom > R.bottom + 1 || x.top < R.top - 1 : x.right > R.right + 1 || x.left < R.left - 1)) bad.push('clipped ' + id); } }
          return bad; })()""")
        for x in bad: errs.append(f'{tag}: pill: {x}')
        nm = await pg.is_visible('#mName')
        expect(nm == (tag in ('phone', 'desk', 'rot', 'up')), f'{tag}: the name is {"shown" if nm else "hidden"} on the plate')   # 667x320: the picture + emblem only
        await open_sheet(pg)
        await shot(pg, f'{tag}_2_sheet_unlinked')
        await btn(pg, 'I have a code'); await pg.fill('#acCode', code); await pg.wait_for_timeout(150)
        await shot(pg, f'{tag}_3_sheet_enter')
        await btn(pg, 'Link this device'); await pg.wait_for_function("window.__blAcct.ui.view === 'replace'", timeout=10000); await pg.wait_for_timeout(200)
        await shot(pg, f'{tag}_4_sheet_replace')
        await btn(pg, "Use the account's"); await pg.wait_for_function('window.__blAcct.st.code', timeout=8000); await pg.wait_for_timeout(300)
        await shot(pg, f'{tag}_5_sheet_linked')
        await btn(pg, 'Show'); await pg.wait_for_timeout(150)
        await shot(pg, f'{tag}_6_sheet_linked_code')
        await btn(pg, 'Unlink this device'); await btn(pg, 'Tap again to unlink', force=True); await pg.wait_for_timeout(300)
        await btn(pg, 'Save my progress'); await pg.wait_for_selector('.ac-code', timeout=10000); await pg.wait_for_timeout(200)
        await shot(pg, f'{tag}_7_sheet_new_code')
        # nothing may be cut off or overlap inside the sheet: every control is inside the sheet and all of it can be reached
        bad = await pg.evaluate("""(() => {
          const sh = document.querySelector('.acct-sheet'), S = sh.getBoundingClientRect(), bad = [];
          for (const e of sh.querySelectorAll('button, input, .ac-code')) { const r = e.getBoundingClientRect(); if (r.width && (r.left < S.left - 1 || r.right > S.right + 1)) bad.push('sideways: ' + (e.id || e.textContent.trim().slice(0, 14))); }
          if (sh.scrollWidth > sh.clientWidth + 1) bad.push('sheet scrolls sideways');
          return bad.concat(sh.scrollHeight > sh.clientHeight + 1 ? ['scrolls by ' + (sh.scrollHeight - sh.clientHeight) + 'px'] : []); })()""")
        for x in bad:
            if x.startswith('scrolls'): print(f'note {tag}: linked sheet {x}')
            elif tag == 'rot': pass   # the sideways game is rotated: what reads as 'sideways' there is the sheet scrolling vertically
            else: errs.append(f'{tag}: sheet: {x}')
        await ctx.close()

async def shots_off(b):
    for tag, vp, mob in SIZES:
        ctx = await device(b, vp, mob, dict(PA, screen='up') if tag == 'up' else PA)
        pg = await ctx.new_page(); watch(pg, 'off ' + tag)
        await goto(pg)
        await open_sheet(pg)
        t = await text(pg, '#acSync')
        expect(has(t, "isn't available yet") and not has(t, 'Save my progress') and not has(t, 'I have a code'), f'{tag}: accounts off says "not available yet" ({t!r})')
        await shot(pg, f'{tag}_8_sheet_off')
        await pg.reload(); await goto(pg)
        await ctx.close()

async def shots_down(b, d):
    # unreachable server while not linked, and an unreachable server while linked
    ctx = await device(b, {'width': 844, 'height': 390}, True, PA)
    await ctx.route('**/api/acct/**', lambda route: route.abort())
    pg = await ctx.new_page(); watch(pg, 'down'); await goto(pg)
    await open_sheet(pg); await pg.wait_for_function('window.__blAcct.st.pingFailed', timeout=10000); await pg.wait_for_timeout(300)
    t = await text(pg, '#acSync')
    expect(has(t, "Couldn't reach the server", 'Try again'), f'down: unlinked sheet says the server cannot be reached ({t!r})')
    await shot(pg, 'phone_9_sheet_unreachable')
    await ctx.close()

# ---------- the hub: Profile / Stats / Locker tabs at every size (screenshots also go to HUB_OUT when given as argv[2])
HUB_OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
async def hub_profile(pg):   # a played-in profile built from the page's own fighter list (nothing hard-coded)
    return await pg.evaluate("""() => {
      const P = JSON.parse(JSON.stringify(window.__blAcct.P)), ids = Object.keys(P.owned), now = Date.now();
      P.name = 'Spud Lord'; P.tokens = 240; P.rating = 1262; P.peak = 1310; P.wins = 41; P.losses = 27; P.draws = 2; P.matches = 70; P.cups = 2; P.flawless = 1; P.last = ids[1];
      P.fsince = now - 9 * 864e5; P.fstats = {}; P.history = [];
      ids.slice(0, 7).forEach((id, i) => { P.fstats[id] = { w: 9 - i, l: 4 + (i % 3), d: i % 2 }; });
      ids.forEach((id) => { P.owned[id] = [0, 1]; P.pal[id] = 0; });
      P.owned[ids[1]] = [0, 1, 2, 3]; P.pal[ids[1]] = 2;
      P.avatar = ids[1] + ':2'; P.title = 'cup';
      for (let i = 0; i < 50; i++) P.history.push({ r: i % 3 === 0 ? 0 : i % 7 === 0 ? 0.5 : 1, d: i % 3 === 0 ? -11 : i % 7 === 0 ? 0 : 13, me: ids[i % ids.length], op: ids[(i * 3 + 1) % ids.length], opr: 1000 + i, t: now - i * 3.6e6 });
      return P; }""")
async def hub_shot(pg, tag, name):
    await pg.wait_for_timeout(250)
    await shot(pg, f'{tag}_hub_{name}')
    if HUB_OUT is not None:
        HUB_OUT.mkdir(parents=True, exist_ok=True); await pg.screenshot(path=str(HUB_OUT / f'{tag}_{name}.png'))
async def hub_fit(pg, tag, what):   # nothing sideways, no control outside the sheet
    bad = await pg.evaluate("""(() => {
      const sh = document.querySelector('.acct-sheet'), S = sh.getBoundingClientRect(), bad = [];
      for (const e of sh.querySelectorAll('button, input, td, .hx, .lk-tile, .ac-t, #lkRack .sk')) { if (!e.offsetParent) continue; const r = e.getBoundingClientRect(); if (r.width && (r.left < S.left - 1 || r.right > S.right + 1)) bad.push('sideways: ' + (e.id || e.className || e.tagName) + ' ' + (e.textContent || '').trim().slice(0, 14)); }
      if (sh.scrollWidth > sh.clientWidth + 1) bad.push('sheet scrolls sideways');
      return bad; })()""")
    for x in bad: errs.append(f'{tag}: hub {what}: {x}')

# ---------- the Locker tab (Account): the strip of eight, the picked fighter's seven cards, and the Chips box on the Profile tab
LK_INK = """() => { const ink = (c) => { if (!c.width || !c.height) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 200) n++; return n; };
  return { tiles: [...document.querySelectorAll('#lkStrip canvas')].map(ink), cards: [...document.querySelectorAll('#lkRack canvas')].map(ink) }; }"""
LK_STATE = """() => ({ on: (document.querySelector('.lk-tile.on') || { dataset: {} }).dataset.f, active: (document.activeElement.dataset || {}).f,
  states: [...document.querySelectorAll('#lkRack .sk')].map((b) => b.className.replace(/^sk /, '')), names: [...document.querySelectorAll('#lkRack .sk .sk-f b')].map((b) => b.textContent),
  small: Object.fromEntries([...document.querySelectorAll('.lk-tile')].map((t) => [t.dataset.f, t.querySelector('small').textContent])),
  tokens: document.getElementById('lkTokens').textContent, own: document.getElementById('lkOwn').textContent, pill: document.getElementById('mTokens').textContent }) """
LK_RACK = """() => { const sk = document.getElementById('scrSkins'), ac = document.getElementById('scrAccount'), r = document.getElementById('skSheet').getBoundingClientRect(),
  top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { rack: !sk.hidden, acct: !ac.hidden, panel: !document.getElementById('acPanL').hidden, above: !!top && sk.contains(top), name: document.getElementById('skName').textContent, fig: document.getElementById('skFig').textContent }; }"""
def money(x): return f'{x:,}'
async def lk_pick(pg, fid):
    await pg.evaluate("(id) => document.querySelector('.lk-tile[data-f=' + id + ']').click()", fid)
async def lk_card(pg, i):
    await pg.evaluate("(i) => document.querySelector('#lkRack .sk[data-i=\"' + i + '\"]').click()", i)
async def locker(pg, tag, ids):
    await pg.click('#acTabL'); await pg.wait_for_timeout(250)
    sheet = "(() => { const s = document.querySelector('.acct-sheet'); return s.scrollHeight - s.clientHeight; })()"
    st = await pg.evaluate(LK_STATE)
    tiles = await pg.evaluate("document.querySelectorAll('.lk-tile').length"); cards = len(st['states'])
    expect(tiles == len(ids) and cards == 7 and st['on'] == ids[1], f"{tag}: the locker shows {len(ids)} fighters and 7 skins, opened on the fighter played last ({tiles}, {cards}, {st['on']})")
    expect(await pg.evaluate("document.querySelector('#acPanL .lk-top .mx-line') !== null && document.getElementById('mxColKo') !== null") and 'skins' in st['own'].lower() and st['tokens'] == '240',
           f"{tag}: the top line has the Collection, the skins owned and the chips ({st['own']!r}, {st['tokens']!r})")
    expect(await pg.evaluate("[...document.querySelectorAll('.lk-tile')].every((t) => t.getAttribute('role') === 'radio' && /wearing/.test(t.getAttribute('aria-label')) && t.hasAttribute('aria-checked')) && [...document.querySelectorAll('#lkRack .sk')].every((b) => /:/.test(b.getAttribute('aria-label')))"),
           f'{tag}: the tiles and cards have aria labels')
    await hub_fit(pg, tag, 'locker'); await hub_shot(pg, tag, '6_locker')
    over = await pg.evaluate(sheet)
    expect(over <= 1, f'{tag}: the Locker tab scrolls by {over}px (the strip and the seven cards should fit)')
    # every fighter: his eight tiles and seven cards are drawn (the models have pixels)
    for fid in ids:
        await lk_pick(pg, fid)
        ink = await pg.evaluate(LK_INK)
        expect(len(ink['tiles']) == len(ids) and all(v > 0 for v in ink['tiles']) and len(ink['cards']) == 7 and all(v > 0 for v in ink['cards']), f'{tag}: {fid}: a tile or card has no model drawn ({ink})')
    # arrow keys move along the strip and pick
    await lk_pick(pg, ids[0]); await pg.focus('.lk-tile.on'); await pg.keyboard.press('ArrowRight')
    st = await pg.evaluate(LK_STATE)
    expect(st['on'] == ids[1] and st['active'] == ids[1], f"{tag}: Right moves to the next tile ({st['on']}, focus {st['active']})")
    await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); st = await pg.evaluate(LK_STATE)
    expect(st['on'] == ids[-1] and st['active'] == ids[-1], f"{tag}: Left from the first tile wraps to the last ({st['on']})")
    await pg.keyboard.press('Home'); st = await pg.evaluate(LK_STATE); expect(st['on'] == ids[0], f"{tag}: Home picks the first ({st['on']})")
    # an owned skin is worn with one tap (the strip tile and the pill follow)
    await lk_pick(pg, ids[1])
    st = await pg.evaluate(LK_STATE); i = st['states'].index('own'); was = st['states'].index('worn')
    tile0 = await pg.evaluate("document.querySelector('.lk-tile[data-f=' + %s + '] canvas').toDataURL()" % json.dumps(ids[1]))
    await lk_card(pg, i); await pg.wait_for_timeout(150)
    st = await pg.evaluate(LK_STATE); tile1 = await pg.evaluate("document.querySelector('.lk-tile[data-f=' + %s + '] canvas').toDataURL()" % json.dumps(ids[1]))
    expect((await prof(pg))['pal'][ids[1]] == i and st['states'][i] == 'worn' and st['states'][was] == 'own', f"{tag}: a tap on an owned skin wears it ({st['states']})")
    expect(tile0 != tile1, f'{tag}: the strip tile is drawn again in the new skin')
    # a tap on a skin you can buy opens the Rack on it, above the Account sheet; Escape, the backdrop and the X each close it back to the Locker
    await lk_pick(pg, ids[0])
    st = await pg.evaluate(LK_STATE); buy = st['states'].index('buy') if 'buy' in st['states'] else st['states'].index('short')
    for how in ('Escape', 'backdrop', 'X'):
        await lk_card(pg, buy); await pg.wait_for_timeout(200)
        r = await pg.evaluate(LK_RACK)
        expect(r['rack'] and r['acct'] and r['above'] and r['name'] == st['names'][buy], f'{tag}: a locked card opens the Rack on that skin, above the Account sheet ({r}, wanted {st["names"][buy]!r})')
        if how == 'Escape': await shot(pg, f'{tag}_hub_6b_locker_rack')
        if how == 'Escape': await pg.keyboard.press('Escape')
        elif how == 'backdrop': await pg.evaluate("document.getElementById('scrSkins').click()")
        else: await pg.evaluate("document.getElementById('skClose').click()")
        await pg.wait_for_timeout(150)
        r = await pg.evaluate(LK_RACK); now = await pg.evaluate(LK_STATE)
        expect(not r['rack'] and r['acct'] and r['panel'] and now['on'] == ids[0], f'{tag}: {how} closes the Rack back to the Locker ({r}, on {now["on"]})')
    # a Road skin that is not yours opens the Rack too (it explains what to beat)
    road = await pg.evaluate("[...document.querySelectorAll('#lkRack .sk')].findIndex((b) => /road|shut/.test(b.className))")
    await lk_card(pg, road); await pg.wait_for_timeout(200)
    r = await pg.evaluate(LK_RACK)
    expect(r['rack'] and r['above'] and 'beat' in (await text(pg, '#skAct')).lower(), f'{tag}: a locked Road skin opens the Rack with what to beat ({r})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
    # buying in that Rack: the Locker, the chip counts (Locker coin, pill, Profile box) follow once it closes
    price = await pg.evaluate("(a) => window.BL.FIGHTERS.find((f) => f.id === a[0]).palettes[a[1]].price", [ids[0], buy])
    p0 = await prof(pg)
    if st['states'][buy] == 'buy':
        await lk_card(pg, buy); await pg.wait_for_timeout(150)
        await pg.evaluate("document.getElementById('skGo').click()"); await pg.wait_for_timeout(100)
        await pg.evaluate("document.getElementById('skGo').click()"); await pg.wait_for_timeout(600)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        p1 = await prof(pg); now = await pg.evaluate(LK_STATE); left = p0['tokens'] - price
        expect(p1['tokens'] == left and buy in p1['owned'][ids[0]] and p1['pal'][ids[0]] == buy, f"{tag}: buying in the Rack paid {price} and wore the skin ({p1['tokens']}, {p1['owned'][ids[0]]})")
        expect(now['states'][buy] == 'worn' and now['small'][ids[0]].startswith(str(len(p1['owned'][ids[0]]))), f"{tag}: the Locker shows the bought skin worn ({now['states']}, {now['small'][ids[0]]})")
        expect(now['tokens'] == money(left) and now['pill'] == money(left), f"{tag}: the Locker coin and the pill show {money(left)} ({now['tokens']}, {now['pill']})")
        await hub_shot(pg, tag, '6c_locker_bought')
        await pg.evaluate("document.getElementById('acTabP').click()"); await pg.wait_for_timeout(100)
        expect(await pg.evaluate("document.getElementById('acChips').textContent") == money(left), f"{tag}: the Profile Chips box shows {money(left)}")
        await pg.evaluate("document.getElementById('acTabL').click()"); await pg.wait_for_timeout(100)
    else:
        errs.append(f'{tag}: the test profile cannot buy a skin of {ids[0]} (no card in the buy state)')
    # a glazed skin gets a star after its name (the Shop sells glaze later; the card only reads P.glazed)
    await pg.evaluate("(id) => { window.__blAcct.P.glazed = { [id]: [0] }; }", ids[0])
    await pg.evaluate("document.getElementById('acTabP').click()"); await pg.evaluate("document.getElementById('acTabL').click()"); await pg.wait_for_timeout(100)
    gz = await pg.evaluate("[document.querySelectorAll('#lkRack .sk-f b.gz > i').length, document.querySelector('#lkRack .sk[data-i=\"0\"]').getAttribute('aria-label')]")
    expect(gz[0] == 1 and 'glazed' in gz[1], f'{tag}: a glazed skin shows a star and says so ({gz})')
    await hub_shot(pg, tag, '6d_locker_glazed')
    await pg.evaluate("delete window.__blAcct.P.glazed")
    await pg.evaluate("document.getElementById('acTabP').click()"); await pg.evaluate("document.getElementById('acTabL').click()"); await pg.wait_for_timeout(100)
    # the Locker with locked skins on show
    await lk_pick(pg, ids[0]); await pg.wait_for_timeout(100); await hub_shot(pg, tag, '6e_locker_locked'); await hub_fit(pg, tag, 'locker (locked skins)')
    await lk_pick(pg, ids[1])
async def chipbox(pg, tag):   # the Profile tab's Chips box: the coin by the label, the value alone, 999,999 fits at every size
    for tokens in (1350, 123456, 999999):
        await pg.evaluate("(t) => { window.__blAcct.P.tokens = t; window.__blAcct.save(); }", tokens)
        await pg.evaluate("document.getElementById('acTabS').click()"); await pg.evaluate("document.getElementById('acTabP').click()"); await pg.wait_for_timeout(120)
        r = await pg.evaluate("""() => ({ chips: document.getElementById('acChips').textContent, wide: document.getElementById('acChips').classList.contains('wide'), coin: !!document.querySelector('.ac-stats dt .tokglyph'),
          fit: [...document.querySelectorAll('.ac-stats dd')].map((d) => [d.id || d.previousSibling.textContent, d.scrollWidth, d.clientWidth]), cols: new Set([...document.querySelectorAll('.ac-stats > div')].map((d) => Math.round(d.getBoundingClientRect().top))).size })""")
        expect(r['chips'] == money(tokens) and r['wide'] == (tokens >= 10000) and r['coin'], f"{tag}: the Chips box shows {money(tokens)} with the coin by the label ({r['chips']!r}, wide {r['wide']})")
        expect(all(sw <= cw for _, sw, cw in r['fit']), f"{tag}: the Chips box does not fit {money(tokens)}: {r['fit']}")
        expect(r['cols'] == 1, f'{tag}: the four numbers are not in one row at {money(tokens)}')
        await hub_fit(pg, tag, f'profile {money(tokens)}')
        await hub_shot(pg, tag, f'1b_profile_chips_{tokens}')
    await pg.evaluate("(t) => { window.__blAcct.P.tokens = t; window.__blAcct.save(); }", 240)
    await pg.evaluate("document.getElementById('acTabS').click()"); await pg.evaluate("document.getElementById('acTabP').click()"); await pg.wait_for_timeout(100)
async def hub(b):
    for tag, vp, mob in SIZES:
        if tag == 'rot': continue
        ctx = await device(b, vp, mob, {'screen': 'up'} if tag == 'up' else None)
        pg = await ctx.new_page(); watch(pg, 'hub ' + tag)
        await goto(pg)
        ids = await pg.evaluate('Object.keys(window.__blAcct.P.owned)')
        n = len(ids)
        P = await hub_profile(pg)
        await pg.evaluate("(P) => { localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(P)); }", P)
        await pg.reload(); await goto(pg)
        t = await text(pg, '#mTitle')
        expect(has(t, 'cup winner'), f'{tag}: the pill shows the chosen title ({t!r})')
        if tag in ('phone', 'desk'): expect(await pg.is_visible('#mTitle'), f'{tag}: the title fits in the pill')
        await shot(pg, f'{tag}_hub_0_pill')
        await open_sheet(pg)
        expect(await pg.is_visible('#acTabP') and await pg.is_visible('#acTabS') and await pg.is_visible('#acTabL'), f'{tag}: three tabs show')
        expect(has(await text(pg, '#acTitleLine'), 'cup winner'), f'{tag}: the title shows under the name')
        await hub_fit(pg, tag, 'profile'); await hub_shot(pg, tag, '1_profile')
        # the picture picker: every owned skin of every fighter, tap one
        await pg.click('#acPicBtn'); await pg.wait_for_timeout(150)
        nav = await pg.evaluate("document.querySelectorAll('#acPick .ac-pk').length")
        owned = await pg.evaluate("Object.values(window.__blAcct.P.owned).reduce((a, l) => a + l.length, 0)")
        expect(nav == owned, f'{tag}: the picture picker lists the {owned} owned skins ({nav})')
        await hub_fit(pg, tag, 'pictures'); await hub_shot(pg, tag, '2_profile_picture')
        await pg.evaluate("document.querySelectorAll('#acPick .ac-pk')[0].click()"); await pg.wait_for_timeout(150)
        expect((await prof(pg))['avatar'] == f'{ids[0]}:0', f'{tag}: picking a picture is stored in the profile')
        # the title picker
        await pg.click('#acTitBtn'); await pg.wait_for_timeout(150)
        expect(await pg.evaluate("document.querySelectorAll('#acPick .ac-t').length") == 14, f'{tag}: the title list has Automatic + twelve titles (Dynamic Duo the newest) + Jack of Spuds (mastery)')
        expect(await pg.evaluate("document.querySelectorAll('#acPick .ac-t.lock').length") >= 1, f'{tag}: locked titles are marked')
        await hub_fit(pg, tag, 'titles'); await hub_shot(pg, tag, '3_profile_title')
        await pg.evaluate("[...document.querySelectorAll('#acPick .ac-t')].find((e) => /flawless/i.test(e.textContent)).click()"); await pg.wait_for_timeout(150)
        expect((await prof(pg))['title'] == 'flawless' and has(await text(pg, '#mTitle'), 'flawless'), f'{tag}: picking a title changes the pill')
        await pg.click('#acTitBtn'); await pg.wait_for_timeout(100)
        # stats
        await pg.click('#acTabS'); await pg.wait_for_timeout(150)
        rows = await pg.evaluate("document.querySelectorAll('.fs-tab tbody tr').length")
        expect(rows == n, f'{tag}: the stats table has a row for each of the {n} fighters ({rows})')
        expect(await pg.evaluate("document.querySelectorAll('.hx').length") == 50, f'{tag}: the last 50 matches are listed')
        expect(has(await text(pg, '#acPanS'), 'since') and has(await text(pg, '#acPanS'), 'favourite fighter'), f'{tag}: stats show the since date and the favourite fighter')
        await hub_fit(pg, tag, 'stats'); await hub_shot(pg, tag, '4_stats')
        await pg.evaluate("document.querySelector('.acct-sheet').scrollTop = 99999"); await hub_shot(pg, tag, '5_stats_matches')
        await locker(pg, tag, ids)
        # back to profile still works, the Chips box fits any balance, and closing returns to the menu
        await pg.click('#acTabP'); await pg.wait_for_timeout(100)
        await chipbox(pg, tag)
        expect(await pg.is_visible('#acReset') and await pg.is_visible('#acSync'), f'{tag}: the Profile tab still has the sync section and Reset')
        await close_sheet(pg)
        await ctx.close()

async def main():
    d = tempfile.mkdtemp(prefix='pbacct-pw-')
    srv = start_server(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            await functional(b, d)
            # an account for the screenshots to link to
            code = None
            c0 = await device(b, {'width': 844, 'height': 390}, True, PC)
            pg0 = await c0.new_page(); watch(pg0, 'seed'); await goto(pg0)
            await open_sheet(pg0); await btn(pg0, 'Save my progress'); await pg0.wait_for_selector('.ac-code', timeout=10000)
            code = norm((await acst(pg0))['code']); await c0.close()
            # the screenshot devices link to an account that is not theirs: give it A's numbers
            f = pathlib.Path(d) / (hashlib.sha256(code.encode()).hexdigest() + '.json')
            r = json.loads(f.read_text()); r['prof'].update(tokens=140, rating=1215, peak=1230, wins=9, losses=4, matches=13, name='Spud Lord', last='odin', cups=1, owned={'odin': [0, 1, 2], 'phoenix': [0, 1]}); f.write_text(json.dumps(r))
            await shots(b, d, code)
            await shots_down(b, d)
            await hub(b)
            await b.close()
    finally: stop_server(srv)
    shutil.rmtree(d, ignore_errors=True)
    # the same pages with accounts off (no ACCOUNTS_DIR): nothing breaks, and the sheet says so
    srv = start_server(None)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            await shots_off(b)
            ctx = await device(b, {'width': 844, 'height': 390}, True, PA)
            pg = await ctx.new_page(); watch(pg, 'off link')
            await pg.goto(URL + '#sync=7K3F-9QXM-2PMA-W8RT'); await pg.wait_for_function('window.__blAcct && window.__blastline', timeout=30000)
            await pg.wait_for_function("document.getElementById('acSync').innerText.includes('available yet')", timeout=10000)
            expect(await pg.evaluate('location.hash') == '' and (await prof(pg))['tokens'] == 85, 'off: a #sync= link changes nothing and clears the address bar')
            await ctx.close()
            # a copy that is not served by our server (the test page from a file) has no accounts either
            ctx = await device(b, {'width': 844, 'height': 390}, True, PA)
            pg = await ctx.new_page(); watch(pg, 'file')
            await pg.goto((ROOT / 'build' / 'test.html').as_uri()); await pg.wait_for_function('window.__blastline', timeout=30000); await pg.wait_for_timeout(500)
            await pg.click('#mRank'); await pg.wait_for_timeout(300)
            expect("isn't available yet" in await text(pg, '#acSync'), 'file: the test page says accounts are not available')
            await ctx.close()
            await b.close()
    finally: stop_server(srv)
    print('\n'.join(errs) or 'no errors')

async def guarded():
    try: await main()
    except BaseException as e:   # a crashed run still lists what was found before it
        import traceback; traceback.print_exc()
        errs.append(f'the run stopped early: {type(e).__name__}: {str(e)[:300]}')
        print('\n'.join(errs))
asyncio.run(guarded())
