# The Skins bar and the Skin Rack on the fighter select (ui/skins.js, css/90-skins.css), and the Play friends lobby's Fight Card
# (ui/online.js, css/95-lobby.css). UI only. At 667x320, 844x390, 1280x760 and 390x844:
#  - the select shows one Skins bar (the worn skin, SKINS 2/7) as a 44+ px tap target at the foot of the stage, no swatch row;
#  - the bar opens the sheet, which fits the screen; seven cards, each with its model drawn, in their states (worn, own, buy, short,
#    Road with its region open, Road with its region shut); nothing in the sheet runs past its edges;
#  - the preview says what each locked skin needs (the Road lines in both cases, "70 more chips needed.", "You have 130 · 10 left after");
#  - Buy is two taps (Sure? for 3 s, a tap elsewhere puts Buy back), the bought skin is worn, chips counted down, YOURS!; an owned skin
#    is worn with one tap; the sheet stays open and the select behind follows; Esc, the backdrop and the X close it;
#  - a Road boss beaten with another fighter: the line says so;
#  - the lobby: the Fight Card with the ⇄ badge on the screen, it opens the select ("Use <fighter>"), the pick comes back on the card
#    by the button and by Back; on the public site the name input sits on the card and typing in it does not open the select.
# Prints "skins ok" and "no errors". Shots in <outdir> (default skins).
#   python3 pwskins.py [outdir]      (starts its own `node server.js` on PWSKINS_PORT, default 8096, for the public-site lobby)
import asyncio, sys, os, json, pathlib, subprocess, time, urllib.request
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
T = (ROOT / 'build' / 'test.html').as_uri()
O = (ROOT / 'build' / 'online-test.html').as_uri()
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
OUT = sys.argv[1] if len(sys.argv) > 1 else 'skins'
KEY = 'potatobrawl.profile.v1'
PORT = int(os.environ.get('PWSKINS_PORT', 8096))
URL = f'http://localhost:{PORT}/'
SIZES = [('se', 667, 320), ('phone', 844, 390), ('desk', 1280, 760), ('upright', 390, 844)]
BASE = {'tokens': 130, 'rating': 1080, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': 1, 'last': 'samurai', 'owned': {'samurai': [0, 1]}, 'pal': {'samurai': 1},
        'road': {'s': [7, 7, 3, 1], 'b': 0, 'paid': False}}
errs = []

def need(ok, msg):
    if not ok: errs.append(msg)
    return ok

async def page(b, w, h, prof, url, tag, init=''):
    mob = w < 1000
    prof = dict(prof)
    if h > w: prof['screen'] = 'up'
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    await ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('%s', %s);%s" % (KEY, json.dumps(json.dumps(prof)), init))   # Quick match off: tests/pwquick.py covers it
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(url); await pg.wait_for_timeout(800)
    return ctx, pg

async def ev(pg, js): return await pg.evaluate(js)
# entry animations (the select slides in, the sheet rises) end before anything is measured; endless ones (sunbursts) don't count
async def settle(pg): await pg.wait_for_function("document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getComputedTiming().endTime === Infinity)", timeout=5000)
async def txt(pg, sel): return ' '.join(((await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{}}).textContent || ''")) or '').split())
async def prof(pg): return await pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))")
STATES = "[...document.querySelectorAll('#skSheet .sk')].map((b) => [...b.classList].filter((c) => c !== 'sk' && c !== 'sel').join(' '))"
def card(row, i): return f"document.querySelectorAll('#{row} .sk')[{i}].click()"
# every box in the sheet (but the sunbursts) stays inside it; the preview's words stay inside the preview
FIT = """(() => { const S = document.getElementById('skSheet').getBoundingClientRect(), P = document.getElementById('skPrev').getBoundingClientRect(), bad = [];
  if (S.left < -0.5 || S.top < -0.5 || S.right > innerWidth + 0.5 || S.bottom > innerHeight + 0.5) bad.push('sheet off the screen ' + [S.left, S.top, S.right, S.bottom].map(Math.round));
  for (const e of document.querySelectorAll('#skSheet *')) { if (e.closest('.rays')) continue; const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.left < S.left - 1 || r.right > S.right + 1 || r.bottom > S.bottom + 1) bad.push((e.id || e.className || e.tagName) + ' runs out of the sheet'); }
  for (const e of document.querySelectorAll('.sk-pt *')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > P.right + 1 || r.top < P.top - 1)) bad.push((e.id || e.className || e.tagName) + ' runs out of the preview'); }
  return bad; })()"""
# each card's canvas has the model drawn (some opaque pixels)
INKED = """[...document.querySelectorAll('#skSheet .sk canvas')].map((c) => { if (!c.width || !c.height) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 200) n++; return n; })"""

async def select_part(b, tag, w, h):
    ctx, pg = await page(b, w, h, BASE, T, tag)
    await ev(pg, "document.getElementById('bRanked').click()"); await pg.wait_for_timeout(700); await settle(pg)
    need(await ev(pg, "!document.getElementById('dPals') && !document.getElementById('selUp')"), f'{tag}: the old swatch row or Upgrade button is still on the select')
    bar = await ev(pg, """(() => { const r = document.getElementById('dSkins').getBoundingClientRect(), s = document.querySelector('#scrSelect .sl-stage').getBoundingClientRect();
      return { h: r.height, inStage: r.left >= s.left - 1 && r.right <= s.right + 1 && r.bottom <= s.bottom + 1, onScreen: r.top >= 0 && r.bottom <= innerHeight + 0.5 }; })()""")
    need(bar['h'] >= 43.5 and bar['inStage'], f'{tag}: the Skins bar {bar}')
    if tag != 'upright': need(bar['onScreen'], f'{tag}: the Skins bar is off the screen {bar}')
    need(await txt(pg, '#dSkN') == '2/7' and await txt(pg, '#dSkName') == 'Steel', f"{tag}: the bar reads {await txt(pg, '#dSkName')!r} {await txt(pg, '#dSkN')!r}")
    await pg.screenshot(path=f'{OUT}/{tag}_1_select.png')
    # the sheet
    await (pg.tap if w < 1000 else pg.click)('#dSkins'); await pg.wait_for_timeout(600); await settle(pg)
    need(await ev(pg, "!document.getElementById('scrSkins').hidden"), f'{tag}: the Skins bar does not open the sheet')
    need(await txt(pg, '#skTitle') == 'Samurai Skins' and await txt(pg, '#skOwned') == '2 / 7 owned' and await txt(pg, '#skTokens') == '130', f"{tag}: the band reads {await txt(pg, '#skTitle')!r} {await txt(pg, '#skOwned')!r} {await txt(pg, '#skTokens')!r}")
    st = await ev(pg, STATES)
    need(st == ['own', 'worn', 'buy', 'short', 'road', 'shut', 'shut'], f'{tag}: card states {st}')
    inked = await ev(pg, INKED)
    need(len(inked) == 7 and all(n > 0 for n in inked), f'{tag}: card models not drawn {inked}')
    fit = await ev(pg, FIT)
    need(not fit, f'{tag}: {fit[:4]}')
    need(await txt(pg, '#skChip .sk:nth-child(3) .sk-f small') == '120' and await txt(pg, '#skRoad .sk:nth-child(1) .sk-f small') == 'Beat Old Scratch'
         and await txt(pg, '#skRoad .sk:nth-child(2) .sk-f small') == 'The Kitchen · locked', f'{tag}: card foot lines')
    await pg.screenshot(path=f'{OUT}/{tag}_2_rack.png')
    # what each locked skin needs
    await ev(pg, card('skRoad', 0)); await pg.wait_for_timeout(200)
    need(await txt(pg, '#skAct .sk-l1') == 'Beat Old Scratch on the Road with Samurai.' and await txt(pg, '#skAct .sk-l2') == 'The Field · his fence opens at 12 stars · you have 9.',
         f"{tag}: Road lines {await txt(pg, '#skAct')!r}")
    need(not await ev(pg, FIT), f'{tag}: the Road preview runs out: {(await ev(pg, FIT))[:3]}')
    await pg.screenshot(path=f'{OUT}/{tag}_3_road.png')
    await ev(pg, card('skRoad', 1)); await pg.wait_for_timeout(200)
    need(await txt(pg, '#skAct .sk-l1') == 'Beat Zorp on the Road with Samurai.' and await txt(pg, '#skAct .sk-l2') == 'The Kitchen opens once Old Scratch is beaten.', f"{tag}: shut Road lines {await txt(pg, '#skAct')!r}")
    await ev(pg, card('skChip', 3)); await pg.wait_for_timeout(200)
    need(await txt(pg, '#skAct .sk-l1') == '70 more chips needed.' and not await ev(pg, "!!document.getElementById('skGo')"), f"{tag}: short lines {await txt(pg, '#skAct')!r}")
    need(not await ev(pg, FIT), f'{tag}: the short preview runs out: {(await ev(pg, FIT))[:3]}')
    await pg.screenshot(path=f'{OUT}/{tag}_4_short.png')
    # Buy is two taps; a tap elsewhere puts Buy back
    await ev(pg, card('skChip', 2)); await pg.wait_for_timeout(200)
    need(await txt(pg, '#skGo') == 'Buy 120' and await txt(pg, '#skAct .sk-l2') == 'You have 130 · 10 left after', f"{tag}: buy lines {await txt(pg, '#skAct')!r}")
    await ev(pg, "document.getElementById('skGo').click()"); await pg.wait_for_timeout(150)
    need(await txt(pg, '#skGo') == 'Sure? 120' and await ev(pg, "document.getElementById('skGo').classList.contains('ember')"), f"{tag}: the first tap does not arm: {await txt(pg, '#skGo')!r}")
    await pg.screenshot(path=f'{OUT}/{tag}_5_sure.png')
    need((await prof(pg))['tokens'] == 130, f'{tag}: one tap bought the skin')
    await ev(pg, "document.getElementById('skFx').click()"); await pg.wait_for_timeout(150)
    need(await txt(pg, '#skGo') == 'Buy 120', f"{tag}: a tap elsewhere leaves {await txt(pg, '#skGo')!r}")
    # wear an owned skin with one tap: the sheet stays, the select behind follows
    await ev(pg, card('skChip', 0)); await pg.wait_for_timeout(250)
    st = await ev(pg, STATES)
    need(st[:2] == ['worn', 'own'] and (await prof(pg))['pal']['samurai'] == 0 and await txt(pg, '#dSkName') == 'Jade', f'{tag}: wearing Jade: {st[:2]}, bar {await txt(pg, "#dSkName")!r}')
    need(await ev(pg, "!document.getElementById('scrSkins').hidden"), f'{tag}: wearing closed the sheet')
    # buy Blood Moon
    await ev(pg, card('skChip', 2)); await pg.wait_for_timeout(150)
    await ev(pg, "document.getElementById('skGo').click()"); await pg.wait_for_timeout(120)
    await ev(pg, "document.getElementById('skGo').click()"); await pg.wait_for_timeout(120)
    p = await prof(pg)
    need(p['tokens'] == 10 and 2 in p['owned']['samurai'] and p['pal']['samurai'] == 2, f"{tag}: after the buy tokens {p['tokens']} owned {p['owned']['samurai']} worn {p['pal']['samurai']}")
    need(await ev(pg, "!document.getElementById('skYours').hidden"), f'{tag}: no YOURS! sticker')
    await pg.screenshot(path=f'{OUT}/{tag}_6_yours.png')
    await pg.wait_for_timeout(600)
    st = await ev(pg, STATES)
    need(st[2] == 'worn' and st[3] == 'short' and await txt(pg, '#skTokens') == '10' and await txt(pg, '#dSkN') == '3/7' and await txt(pg, '#skOwned') == '3 / 7 owned',
         f"{tag}: after the buy {st} coin {await txt(pg, '#skTokens')!r} bar {await txt(pg, '#dSkN')!r}")
    need(await ev(pg, "!!document.querySelector('#skAct .sk-pill')") and await txt(pg, '#skAct') == '✓Worn', f"{tag}: the preview after the buy {await txt(pg, '#skAct')!r}")
    # closing: Esc, the backdrop, the X
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    need(await ev(pg, "document.getElementById('scrSkins').hidden && window.__blastline.mode === 'select'"), f'{tag}: Esc does not close the sheet')
    await ev(pg, "document.getElementById('dSkins').click()"); await pg.wait_for_timeout(300)
    await ev(pg, "document.getElementById('scrSkins').click()"); await pg.wait_for_timeout(200)
    need(await ev(pg, "document.getElementById('scrSkins').hidden"), f'{tag}: the backdrop does not close the sheet')
    await ev(pg, "document.getElementById('dSkins').click()"); await pg.wait_for_timeout(300)
    await (pg.tap if w < 1000 else pg.click)('#skClose'); await pg.wait_for_timeout(200)
    need(await ev(pg, "document.getElementById('scrSkins').hidden && window.__blastline.mode === 'select'"), f'{tag}: the X does not close the sheet')
    await pg.screenshot(path=f'{OUT}/{tag}_7_select_after.png')
    await ctx.close()

async def beaten_part(b):
    # Old Scratch beaten with Phoenix (her Devil's Roast won): Samurai's Devil's Roast says so; The Kitchen is open, its fence closed
    pr = dict(BASE, owned={'samurai': [0, 1], 'phoenix': [0, 4]}, road={'s': [7, 7, 7, 7, 7, 7, 7, 7], 'b': 1, 'paid': False})
    ctx, pg = await page(b, 844, 390, pr, T, 'beaten')
    await ev(pg, "document.getElementById('bRanked').click()"); await pg.wait_for_timeout(500)
    await ev(pg, "document.getElementById('dSkins').click()"); await pg.wait_for_timeout(400)
    st = await ev(pg, STATES)
    need(st[4:] == ['road', 'road', 'shut'], f'beaten: Road card states {st[4:]}')
    await ev(pg, card('skRoad', 0)); await pg.wait_for_timeout(200)
    need(await txt(pg, '#skAct .sk-l2') == 'You beat him with Phoenix · every fighter wins his own.', f"beaten: {await txt(pg, '#skAct .sk-l2')!r}")
    await ev(pg, card('skRoad', 1)); await pg.wait_for_timeout(200)
    need(await txt(pg, '#skAct .sk-l2') == 'The Kitchen · his fence opens at 12 stars · you have 0.', f"beaten, Zorp: {await txt(pg, '#skAct .sk-l2')!r}")
    await pg.screenshot(path=f'{OUT}/beaten_844.png')
    await ctx.close()

LOBBY = """(() => { const c = document.getElementById('onChange').getBoundingClientRect(), g = document.querySelector('#onFc .on-chg').getBoundingClientRect();
  return { h: c.height, w: c.width, cardOn: c.left >= -0.5 && c.right <= innerWidth + 0.5 && c.top >= 0, badge: g.width, badgeOn: g.left >= -0.5 && g.right <= innerWidth + 0.5 && g.top >= 0 && g.bottom <= innerHeight + 0.5 }; })()"""

async def lobby_part(b, tag, w, h):
    ctx, pg = await page(b, w, h, BASE, O + '?name=Tester', f'{tag} lobby')
    await ev(pg, "document.getElementById('bOnline').click()"); await pg.wait_for_timeout(1200); await settle(pg)
    lb = await ev(pg, LOBBY)
    need(lb['h'] >= 100 and lb['cardOn'] and lb['badgeOn'] and 33 <= lb['badge'] <= 41, f'{tag}: the Fight Card {lb}')
    need(await ev(pg, "document.getElementById('onChange').getAttribute('aria-label')") == 'Your fighter: Samurai, Steel. Change fighter' and await txt(pg, '#onFName') == 'Samurai'
         and await txt(pg, '#onFSkin') == 'Steel', f"{tag}: the Fight Card reads {await txt(pg, '#onChange')!r}")
    need(await txt(pg, '#onMyName') == 'Tester', f"{tag}: the name plate reads {await txt(pg, '#onMyName')!r}")
    await pg.screenshot(path=f'{OUT}/{tag}_8_lobby.png')
    await (pg.tap if w < 1000 else pg.click)('#onChange'); await pg.wait_for_timeout(600)
    need(await ev(pg, "window.__blastline.mode") == 'select' and await txt(pg, '#selMode') == 'Play friends · pick your fighter' and await txt(pg, '#selGo') == 'Use Samurai',
         f"{tag}: the card opens {await ev(pg, 'window.__blastline.mode')!r} {await txt(pg, '#selMode')!r} {await txt(pg, '#selGo')!r}")
    await ev(pg, "document.querySelectorAll('#tiles .tile')[7].click()"); await pg.wait_for_timeout(200)
    need(await txt(pg, '#selGo') == 'Use Reaper', f"{tag}: the button reads {await txt(pg, '#selGo')!r}")
    await (pg.tap if w < 1000 else pg.click)('#selGo'); await pg.wait_for_timeout(500)
    need(await ev(pg, "window.__blastline.mode") == 'online' and await txt(pg, '#onFName') == 'Reaper' and (await prof(pg))['last'] == 'reaper',
         f"{tag}: Use Reaper leads to {await ev(pg, 'window.__blastline.mode')!r} with {await txt(pg, '#onFName')!r}")
    need(await ev(pg, "document.getElementById('onFc').classList.contains('fc-in')"), f'{tag}: the card does not pop on the way back')
    await pg.screenshot(path=f'{OUT}/{tag}_9_lobby_reaper.png')
    await ev(pg, "document.getElementById('onChange').click()"); await pg.wait_for_timeout(400)
    await ev(pg, "document.querySelectorAll('#tiles .tile')[0].click()"); await pg.wait_for_timeout(200)
    await ev(pg, "document.getElementById('selBack').click()"); await pg.wait_for_timeout(400)
    need(await ev(pg, "window.__blastline.mode") == 'online' and await txt(pg, '#onFName') == 'Phoenix', f"{tag}: Back leads to {await ev(pg, 'window.__blastline.mode')!r} with {await txt(pg, '#onFName')!r}")
    await ctx.close()
    # the public site (the real server): the name is an input on the card; a tap on it never opens the select
    ctx, pg = await page(b, w, h, dict(BASE, onName='Tester'), URL, f'{tag} public')
    await ev(pg, "document.getElementById('bOnline').click()"); await pg.wait_for_timeout(1200); await settle(pg)
    inp = await ev(pg, """(() => { const i = document.getElementById('onName'), r = i.getBoundingClientRect(), c = document.getElementById('onChange').getBoundingClientRect();
      return { shown: !i.hidden && r.width > 40, inCard: r.left >= c.left - 3 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1, top: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === i }; })()""")
    need(inp['shown'] and inp['inCard'] and inp['top'], f'{tag}: the name input on the card {inp}')
    await (pg.tap if w < 1000 else pg.click)('#onName'); await pg.wait_for_timeout(300)
    need(await ev(pg, "window.__blastline.mode === 'online' && document.activeElement === document.getElementById('onName')"), f'{tag}: a tap on the name input opened the select or did not focus it')
    await pg.screenshot(path=f'{OUT}/{tag}_10_lobby_public.png')
    await ctx.close()

def start_server():
    env = dict(os.environ, PORT=str(PORT), KEEPALIVE_MINUTES='0'); env.pop('ACCOUNTS_DIR', None)
    p = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    for _ in range(60):
        try:
            if urllib.request.urlopen(URL + 'health', timeout=1).status == 200: return p
        except Exception: time.sleep(0.2)
    p.kill(); raise RuntimeError('server did not start')

async def main():
    os.makedirs(OUT, exist_ok=True)
    srv = start_server()
    try: await run()
    finally:
        srv.terminate()
        try: srv.wait(5)
        except Exception: srv.kill()
    print('skins ok' if not errs else 'skins FAILED')
    print('\n'.join(errs) or 'no errors')

async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for tag, w, h in SIZES:
            await select_part(b, tag, w, h)
            await lobby_part(b, tag, w, h)
            print(tag, 'done', len(errs), 'problems so far', flush=True)
        await beaten_part(b)
        await b.close()
asyncio.run(main())
