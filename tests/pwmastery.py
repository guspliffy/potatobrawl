# Fighter mastery (ui/mastery.js), in the browser: XP per finished match (Practice by CPU level, ranked, forfeit, Dummy), levels, the chips of a level
# paid once, MASTERED at Lv 10 (and the fanfare only on a win), the one-time head start from the old record, the level shield on the roster tile and the
# MASTERY row in the detail panel, titles (earned ones in the picker, Automatic picks the best), Account > Stats and the Locker's Collection, a KO page
# you land recorded in P.pages, the tournament's XP sticker. Then screenshots at four sizes: select, results with LEVEL UP / several levels / MASTERED, Locker.
#   python3 pwmastery.py [outdir [tag ...]]   tags: flow (844x390: all the checks; ko and cup run just those two parts of it) s667 p844 d1280 up390 (screenshots + layout checks); no tag runs everything
# Every check prints PASS or FAIL; the last line is "no errors" only when all passed and no page error happened.
# A match is ended by putting one fighter out of the arena through window.__blastline.game (test only), as pwdaily.py does; the KO page check uses the
# frozen page clock of pwfin.py so the real lethal hit lands at an exact moment.
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'mastery'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = 'potatobrawl.profile.v1'
G = 'window.__blastline.game'
FIGS = ['phoenix', 'alchemist', 'odin', 'wizard', 'samurai', 'dragon', 'gunslinger', 'reaper']
BASE = {'tokens': 85, 'rating': 1210, 'peak': 1210, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True, 'sound': False, 'fs': False, 'last': 'phoenix', 'mseed': {}}
bad, errs = [], []

def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg, flush=True)
    if not ok: bad.append(msg)
    return ok

async def new_ctx(b, vp, up=False, prof=None, **kw):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, **kw)
    if prof is not None:
        p = dict(prof)
        if up: p['screen'] = 'up'
        # a fresh context gets the starting profile; once the game has saved one (also a second page of the same context) it is kept
        await ctx.add_init_script("if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, json.dumps(json.dumps(p))))
    return ctx, mob

async def open_page(ctx, tag='page'):
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    return pg

async def prof(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)
async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; }})()")

async def start(pg, mode, level=None):
    """From the menu into a match: ranked, or practice at a CPU level (Dummy / Easy / Normal / Hard)."""
    await pg.evaluate(f"document.getElementById('{'bRanked' if mode == 'ranked' else 'bPractice'}').click()"); await pg.wait_for_timeout(350)
    if mode != 'ranked':
        await pg.evaluate("document.getElementById('lvlPick').click()")
        await pg.evaluate(f"[...document.querySelectorAll('#lvlPop button')].find((x) => x.textContent === '{level}').click()")
    await pg.evaluate("document.getElementById('selGo').click()")
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000); await pg.wait_for_timeout(300)

async def finish(pg, win):
    """Put one fighter out of the arena: the CPU when you win, you when you lose. Waits for the results and for the mastery row to settle."""
    i = 1 if win else 0
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[{i}].stocks = 1; g.fighters[{i}].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000)
    await pg.wait_for_function("document.getElementById('rMxLine').classList.contains('on')", timeout=30000)
    await pg.wait_for_timeout(900)   # the XP count-up ends

async def row(pg):
    return await pg.evaluate("""(() => { const g = (id) => document.getElementById(id), r = g('rMx');
      return { shown: !r.hidden, name: g('rMxNm').textContent, lv: g('rMxLv').textContent, tag: g('rMxTag').textContent, line: g('rMxLine').textContent, xp: g('rMxXpN').textContent,
               cls: r.className.replace('card res-mx', '').trim(), bar: +getComputedStyle(g('rMxBar')).getPropertyValue('--p'), title: g('rTitle').textContent }; })()""")

# ---------------------------------------------------------------- the checks at 844x390
async def flow(b):
    vp = (844, 390)
    # ----- the XP rules, as numbers
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE)); pg = await open_page(ctx, 'rules')
    gain = lambda r, page=False, ult=False: pg.evaluate("([r, p, u]) => window.__blMastery.gain(r, p, u)", [r, page, ult])
    xp = lambda r, page=False, ult=False: gain(r, page, ult)
    check((await xp({'res': 1, 'me': {'kos': 0}}))['xp'] == 40, 'XP: a win with no KO is 20 + 20 = 40')
    check((await xp({'res': 0, 'me': {'kos': 0}}))['xp'] == 20 and (await xp({'res': 0.5, 'me': {'kos': 0}}))['xp'] == 20, 'XP: a finished loss or draw is 20')
    check((await xp({'res': 1, 'me': {'kos': 2}}))['xp'] == 50 and (await xp({'res': 0, 'me': {'kos': 3}}))['xp'] == 35, 'XP: +5 for every KO you scored')
    check((await xp({'res': 1, 'me': {'kos': 2}}, True))['xp'] == 60 and (await xp({'res': 1, 'me': {'kos': 2}}, True, True))['xp'] == 65, 'XP: your KO page on the last heart +10, an Ultimate KO +15 instead (a win with 2 KOs: 50, 60, 65)')
    r = await xp({'res': 1, 'forfeit': True, 'me': {'kos': 4}})
    check(r['xp'] == 0 and 'forfeit' in r['why'], 'XP: a forfeit gives 0')
    check(await pg.evaluate("window.__blMastery.curve.slice(2).join()") == '100,250,450,700,1000,1350,1750,2200,2700' and await pg.evaluate("[99, 100, 2699, 2700, 5000].map(window.__blMastery.level).join()") == '1,2,9,10,10', 'the level curve: 100 250 450 700 1000 1350 1750 2200 2700, the top level is 10')
    # the page bonus applies to a win only
    check((await xp({'res': 0, 'me': {'kos': 0}}, True))['xp'] == 20, 'XP: a KO page bonus needs a win')
    await ctx.close()

    # ----- Practice by CPU level: Dummy 0, Easy 0.5, Normal 0.75, Hard 1 (a win is 40 before the multiplier)
    for level, want, why in [('Normal', 30, ''), ('Hard', 40, ''), ('Easy', 20, ''), ('Dummy', 0, 'No XP against the Dummy')]:
        ctx, _ = await new_ctx(b, vp, prof=dict(BASE, mxp={'phoenix': 10})); pg = await open_page(ctx, 'practice ' + level)
        await start(pg, 'practice', level)
        if level == 'Normal': check(await pg.evaluate("window.__blMastery.gain({ res: 0, me: { kos: 1 } }).xp") == 19 and await pg.evaluate("window.__blMastery.mult()") == 0.75, 'Practice Normal: x0.75, rounded after the multiplying (a loss with 1 KO: 25 -> 19)')
        await finish(pg, True)
        r, p = await row(pg), await prof(pg)
        check(r['shown'] and r['name'] == 'Phoenix' and r['xp'] == (f'+{want}' if want else '0') and p['mxp']['phoenix'] == 10 + want,
              f"Practice {level}: a win gives {want} XP (row {r['xp']!r}, saved {p['mxp'].get('phoenix')})")
        if why: check(why in r['line'] and r['cls'].find('zero') >= 0, f"Practice {level}: the row says why ({r['line']!r})")
        else: check(r['line'].startswith('Next:') and r['tag'] == '', f"Practice {level}: no level up, the row says what comes next ({r['line']!r})")
        check(p['tokens'] == BASE['tokens'], f"Practice {level}: no chips from the match ({p['tokens']})")
        await ctx.close()

    # ----- ranked: full XP, a level up pays its chips once, the level-up row plays in order and a tap finishes it
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, mxp={'phoenix': 70}, mpaid={'phoenix': 1})); pg = await open_page(ctx, 'ranked')
    await pg.evaluate("""(() => { window.__ev = []; let t0 = 0; const log = (w) => window.__ev.push([Math.round(performance.now() - t0), w]);
      const row = document.getElementById('rMx');
      new MutationObserver((ms) => { for (const m of ms) { if (m.attributeName === 'hidden' && !row.hidden) { t0 = performance.now(); log('start'); } else if (m.attributeName === 'class') log('class=' + row.className.replace('card res-mx', '').trim()); } }).observe(row, { attributes: true });
      new MutationObserver(() => log('lv=' + document.getElementById('rMxLv').textContent)).observe(document.getElementById('rMxLv'), { childList: true });
      new MutationObserver(() => log('tag=' + document.getElementById('rMxTag').textContent)).observe(document.getElementById('rMxTag'), { childList: true });
      new MutationObserver(() => log('line=' + document.getElementById('rMxLine').textContent)).observe(document.getElementById('rMxLine'), { childList: true });
      new MutationObserver(() => log('bar=' + (document.getElementById('rMxBar').style.getPropertyValue('--p')))).observe(document.getElementById('rMxBar'), { attributes: true }); })()""")
    await start(pg, 'ranked'); await finish(pg, True)
    r, p = await row(pg), await prof(pg)
    check(p['mxp']['phoenix'] == 110 and r['xp'] == '+40', f"ranked win: full XP, 70 + 40 = 110 (saved {p['mxp'].get('phoenix')}, row {r['xp']!r})")
    check(r['lv'] == '2' and r['tag'] == 'Level up' and r['line'] == '+20 chips' and 'up' in r['cls'].split(), f"level up to 2: LEVEL UP tag and the reward line ({r['tag']!r}, {r['line']!r})")
    check(p['mpaid']['phoenix'] == 2 and p['tokens'] == BASE['tokens'] + 20 + 20, f"Lv 2 pays 20 chips on top of the match's 20, mpaid 2 (chips {p['tokens']}, mpaid {p['mpaid']})")
    ev = await pg.evaluate("window.__ev")
    names = [e[1] for e in ev]
    def at(prefix, after=0):
        for i, n in enumerate(names):
            if i >= after and n.startswith(prefix): return i
        return -1
    i_fill = at('bar=1'); i_flash = at('class=flash'); i_lv = at('lv=2', max(i_flash, 0)); i_tag = at('tag=Level up'); i_line = at('line=+20 chips')
    check(0 <= i_fill < i_flash < i_lv < i_tag < i_line, f'the level-up plays in order: the bar fills, flash and spin, the number changes, the tag stamps in, the reward line ({names})')
    check(ev[i_tag][0] >= 1200 if i_tag >= 0 else False, f"the sequence starts after the rating (tag at {ev[i_tag][0] if i_tag >= 0 else None} ms)")
    # the second match: the same level is not paid again
    await pg.evaluate("document.getElementById('rAgain').click()")
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000); await pg.wait_for_timeout(300)
    await finish(pg, True)
    r2, p2 = await row(pg), await prof(pg)
    won_chips = int(await txt(pg, '#rChipN'))   # what the match itself paid (a win streak adds to the 20)
    check(p2['mxp']['phoenix'] == 150 and p2['mpaid']['phoenix'] == 2 and p2['tokens'] == p['tokens'] + won_chips and won_chips >= 20 and r2['tag'] == '', f"the next win only pays the match's chips, Lv 2 is not paid again (match {won_chips}, chips {p['tokens']} -> {p2['tokens']}, mpaid {p2['mpaid']}, tag {r2['tag']!r})")
    await ctx.close()

    # a tap on the results screen jumps the sequence to its end at once
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, mxp={'phoenix': 70}, mpaid={'phoenix': 1})); pg = await open_page(ctx, 'tap')
    await start(pg, 'ranked')
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000); await pg.wait_for_timeout(250)
    before = await row(pg)
    await pg.evaluate("document.getElementById('scrResult').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))"); await pg.wait_for_timeout(120)
    after = await row(pg)
    check(before['tag'] == '' and after['tag'] == 'Level up' and after['lv'] == '2' and after['line'] == '+20 chips' and after['xp'] == '+40', f"a tap finishes the count and the level up at once (before {before['tag']!r}, after {after['tag']!r}, {after['lv']}, {after['line']!r}, {after['xp']!r})")
    await ctx.close()

    # reduced motion: no sequence, the end state at once
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, mxp={'phoenix': 70}, mpaid={'phoenix': 1}), reduced_motion='reduce'); pg = await open_page(ctx, 'reduced')
    await start(pg, 'ranked')
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000); await pg.wait_for_timeout(250)
    r = await row(pg)
    check(r['tag'] == 'Level up' and r['lv'] == '2' and r['xp'] == '+40' and abs(r['bar'] - 10 / 150) < 0.01, f'reduced motion: the end state at once ({r})')
    await ctx.close()

    # ----- a forfeit gives 0
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, mxp={'phoenix': 30})); pg = await open_page(ctx, 'forfeit')
    await start(pg, 'ranked')
    await pg.evaluate("document.getElementById('pauseBtn').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('pQuit').click()"); await pg.wait_for_timeout(200)
    await pg.evaluate("document.getElementById('pQuit').click()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=30000)
    await pg.wait_for_function("document.getElementById('rMxLine').classList.contains('on')", timeout=30000); await pg.wait_for_timeout(300)
    r, p = await row(pg), await prof(pg)
    check(r['title'] == 'Forfeit' and r['xp'] == '0' and 'forfeit' in r['line'] and p['mxp']['phoenix'] == 30, f"a forfeit gives 0 XP, the row says so ({r['line']!r}, saved {p['mxp'].get('phoenix')})")
    await ctx.close()

    # ----- a finished loss still moves the bar; Lv 10 on a loss: MASTERED, no fanfare. On a win: the fanfare, once
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, last='reaper', mxp={'reaper': 2680}, mpaid={'reaper': 9})); pg = await open_page(ctx, 'lv10 loss')
    await start(pg, 'ranked'); await finish(pg, False)
    r, p = await row(pg), await prof(pg)
    check(r['title'] == 'Defeat' and r['xp'] == '+20' and r['tag'] == 'Mastered' and r['lv'] == '10' and p['mxp']['reaper'] == 2700, f"a finished loss gives 20 XP, and reaching Lv 10 on a loss shows MASTERED ({r['tag']!r}, Lv {r['lv']})")
    fan = await pg.evaluate("window.__blMastery.fanfares")
    check(fan == 0 and p['mpaid']['reaper'] == 10 and p['tokens'] == BASE['tokens'] + 6, f"a loss reaching Lv 10: no fanfare, Lv 10 recorded as paid (it has no chips; the match's 6 only) (fanfares {fan}, mpaid {p['mpaid']}, chips {p['tokens']})")
    await ctx.close()
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, last='reaper', mxp={'reaper': 2680}, mpaid={'reaper': 9})); pg = await open_page(ctx, 'lv10 win')
    await start(pg, 'ranked'); await finish(pg, True)
    r, p = await row(pg), await prof(pg)
    check(r['tag'] == 'Mastered' and 'max' in r['cls'].split() and r['lv'] == '10' and r['line'].startswith('Title: Ferryman') and await pg.evaluate("window.__blMastery.fanfares") == 1, f"reaching Lv 10 on a win: MASTERED, the title, one fanfare ({r['tag']!r}, {r['line']!r})")
    await pg.evaluate("document.getElementById('rAgain').click()")
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000); await pg.wait_for_timeout(300)
    await finish(pg, True)
    r = await row(pg)
    check(r['tag'] == 'Mastered' and r['xp'] == '+40' and await pg.evaluate("window.__blMastery.fanfares") == 1, f"already Lv 10: it still earns XP and shows MASTERED quietly, no second fanfare ({r['tag']!r}, {r['xp']!r})")
    await ctx.close()

    # ----- the head start: once, from the old record, capped at 650 per fighter
    fst = {'phoenix': {'w': 8, 'l': 4, 'd': 2}, 'odin': {'w': 30, 'l': 30, 'd': 30}, 'reaper': {'w': 1, 'l': 0, 'd': 0}}
    p0 = dict(BASE, fstats=fst); del p0['mseed']
    ctx, _ = await new_ctx(b, vp, prof=p0); pg = await open_page(ctx, 'seed')
    p = await prof(pg)
    check(p.get('mseed') == {'phoenix': 8 * 45 + 4 * 28 + 2 * 35, 'odin': 650, 'reaper': 45}, f"the head start: w*45 + l*28 + d*35, capped at 650, saved on load ({p.get('mseed')})")
    await pg.evaluate("document.getElementById('bRanked').click()"); await pg.wait_for_timeout(500)
    lv = await pg.evaluate("Object.fromEntries([...document.querySelectorAll('#tiles .tile')].map((t) => [t.dataset.id, t.querySelector('.mx-sh').hidden ? 1 : +t.querySelector('.mx-sh em').textContent]))")
    check(lv['phoenix'] == 4 and lv['odin'] == 4 and lv['reaper'] == 1 and lv['wizard'] == 1, f'the head start shows as levels on the roster ({lv})')
    # a second page of the same profile: a bigger record does not seed again
    await pg.evaluate("(() => { const p = JSON.parse(localStorage.getItem('%s')); p.fstats.phoenix.w = 100; localStorage.setItem('%s', JSON.stringify(p)); })()" % (PROF, PROF))
    pg2 = await open_page(ctx, 'seed 2')
    check((await prof(pg2))['mseed']['phoenix'] == 542, 'the head start is never given again on that device')
    await ctx.close()
    ctx, _ = await new_ctx(b, vp); pg = await open_page(ctx, 'fresh')
    mode, mem, saved = await pg.evaluate("window.__blastline.mode"), await pg.evaluate("window.__blAcct.P.mseed"), (await prof(pg)).get('mseed')
    check(mode == 'match' and mem == {} and saved == {}, f'a brand new profile: the tutorial still starts (the first-run flag is not spent by mastery) and it has no head start ({mode}, {mem}, {saved})')
    await ctx.close()

    # ----- the tile shield, the detail row and what comes next
    mix = dict(BASE, mxp={'alchemist': 120, 'odin': 300, 'wizard': 500, 'samurai': 800, 'dragon': 1100, 'gunslinger': 2300, 'reaper': 2800})
    ctx, _ = await new_ctx(b, vp, prof=mix); pg = await open_page(ctx, 'select')
    await pg.evaluate("document.getElementById('bRanked').click()"); await pg.wait_for_timeout(600)
    tiles = await pg.evaluate("[...document.querySelectorAll('#tiles .tile')].map((t) => { const s = t.querySelector('.mx-sh'); return [t.dataset.id, s.hidden ? '' : s.querySelector('em').textContent, s.dataset.k, !t.querySelector('.mx-lr').hidden]; })")
    want = [['phoenix', '', '', False], ['alchemist', '2', 'ink', False], ['odin', '3', 'bronze', False], ['wizard', '4', 'bronze', False], ['samurai', '5', 'bronze', False], ['dragon', '6', 'silver', False], ['gunslinger', '9', 'gold', False], ['reaper', '10', 'laurel', True]]
    check(tiles == want, f'level shields on the roster: none at Lv 1, ink 2, bronze 3-5, silver 6-8, gold 9, laurels on 10 ({tiles})')
    async def pick(fid): await pg.evaluate(f"document.querySelector('#tiles .tile[data-id={fid}]').click()"); await pg.wait_for_timeout(450)
    async def detail(): return await pg.evaluate("({ lv: document.querySelector('.mx-lv').textContent, next: document.querySelector('.mx-next').textContent, segs: [...document.querySelectorAll('.mx-seg i')].map((i) => i.className || '-').join(), name10: document.getElementById('dName').classList.contains('mx10') })")
    await pick('odin'); d = await detail()
    check(d['lv'] == 'Lv 3' and d['next'] == 'Next: 40 chips at Lv 4' and d['segs'].startswith('on,on,on,part,-') and not d['name10'], f"detail: odin at 300 XP is Lv 3, 3 segments, the fourth part full, 'Next: 40 chips at Lv 4' ({d})")
    await pick('wizard'); d = await detail()
    check(d['lv'] == 'Lv 4' and d['next'] == 'Next: Star Pupil at Lv 5', f"detail: the next reward at Lv 5 is the title ({d['next']!r})")
    await pick('reaper'); d = await detail()
    check(d['lv'] == 'Lv 10' and d['next'] == 'Mastered' and d['segs'] == ','.join(['on'] * 10) and d['name10'], f"detail: Lv 10 is MASTERED, all ten segments, a gold stage name ({d})")
    await pick('phoenix'); d = await detail()
    check(d['lv'] == 'Lv 1' and d['next'] == 'Next: 20 chips at Lv 2' and d['segs'].startswith('on,-,-'), f"detail: Lv 1 starts at the 20 chips of Lv 2 ({d['next']!r})")
    await ctx.close()

    # ----- titles
    async def pill(prof_extra, tag):
        ctx, _ = await new_ctx(b, vp, prof=dict(BASE, **prof_extra)); pg = await open_page(ctx, tag)
        t = await txt(pg, '#mTitle') if await shown(pg, '#mTitle') else ''
        return ctx, pg, t
    five = {f: 700 for f in FIGS}
    for extra, want_t, why in [
        ({'mxp': {'samurai': 800}}, 'Steady Hand', 'a Lv 5 title shows with Automatic'),
        ({'mxp': {'samurai': 800, 'dragon': 900}}, 'Hatchling', 'of two Lv 5 titles Automatic shows the fighter with the most XP'),
        ({'mxp': {'samurai': 800, 'dragon': 900, 'reaper': 2700}}, 'Ferryman', 'a Lv 10 title beats a Lv 5 one'),
        ({'mxp': {'samurai': 800, 'reaper': 2700}, 'cups': 1}, 'Ferryman', 'a Lv 10 title beats Cup winner'),
        ({'mxp': {'samurai': 800}, 'cups': 1}, 'Cup winner', 'Cup winner beats a Lv 5 title'),
        ({'mxp': five}, 'Jack of Spuds', 'all eight at Lv 5 earn Jack of Spuds, which beats the Lv 5 titles'),
        ({'mxp': five, 'cups': 1}, 'Cup winner', 'Cup winner beats Jack of Spuds'),
        ({'mxp': {'samurai': 800, 'dragon': 900}, 'title': 'm5_samurai'}, 'Steady Hand', 'a title picked by hand wins over Automatic'),
        ({'mxp': {'samurai': 800}, 'title': 'm10_reaper'}, 'Steady Hand', 'a title not earned (picked on an older device) is ignored'),
    ]:
        ctx, pg, t = await pill(extra, 'title')
        check(t == want_t, f'titles: {why} (pill shows {t!r}, want {want_t!r})')
        await ctx.close()
    ctx, pg, t = await pill({'mxp': {'samurai': 800, 'dragon': 900}}, 'picker')
    await pg.evaluate("document.getElementById('mRank').click()"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.getElementById('acTitBtn').click()"); await pg.wait_for_timeout(300)
    items = await pg.evaluate("[...document.querySelectorAll('#acPick .ac-t')].map((b) => [b.querySelector('b').textContent, b.querySelector('small').textContent, b.classList.contains('lock')])")
    byname = {i[0]: i for i in items}
    check('Steady Hand' in byname and not byname['Steady Hand'][2] and 'Samurai Lv 5' in byname['Steady Hand'][1] and 'Hatchling' in byname, f"the picker lists the fighter titles you earned ({[i[0] for i in items]})")
    check('Hot Potato' not in byname and 'Reborn' not in byname, 'the picker does not list fighter titles you have not earned')
    check('Jack of Spuds' in byname and byname['Jack of Spuds'][2] and 'Lv 5 with every fighter' in byname['Jack of Spuds'][1], f"Jack of Spuds is always listed, locked with its how-text ({byname.get('Jack of Spuds')})")
    await pg.evaluate("[...document.querySelectorAll('#acPick .ac-t')].find((b) => b.querySelector('b').textContent === 'Steady Hand').click()"); await pg.wait_for_timeout(300)
    check((await prof(pg))['title'] == 'm5_samurai' and await txt(pg, '#mTitle') == 'Steady Hand', 'picking a fighter title sets it (and the pill shows it)')
    await ctx.close()

    # ----- Account > Stats and Locker
    pre = dict(BASE, mxp={'odin': 300, 'reaper': 2800}, pages={'ko': ['phoenix', 'odin'], 'ult': ['odin']}, routes=['a1', 'a2', 'a3', 'a4'], fstats={'odin': {'w': 3, 'l': 1, 'd': 0}})
    ctx, _ = await new_ctx(b, vp, prof=pre); pg = await open_page(ctx, 'account')
    await pg.evaluate("document.getElementById('mRank').click()"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('.ac-tabs .chip[data-t=s]').click()"); await pg.wait_for_timeout(300)
    heads = await pg.evaluate("[...document.querySelectorAll('.fs-tab th')].map((t) => t.textContent)")
    cells = await pg.evaluate("Object.fromEntries([...document.querySelectorAll('.fs-tab tbody tr')].map((r) => { const c = r.querySelector('td.mx-c'), s = c.querySelector('.mx-sh'); return [r.querySelector('.fn span:last-child').textContent, c.querySelector('span:last-child').textContent + (s.hidden ? '' : ' ' + s.dataset.k)]; }))")
    check(heads[-1] == 'Mastery' and cells.get('Odin') == 'Lv 3 bronze' and cells.get('Reaper') == 'Lv 10 laurel' and cells.get('Phoenix') == 'Lv 1', f'Account > Stats: a Mastery column with the shield and the level ({heads}, {cells})')
    await pg.evaluate("document.querySelector('.ac-tabs .chip[data-t=l]').click()"); await pg.wait_for_timeout(300)
    col = await pg.evaluate("""(() => { const q = (id) => document.getElementById(id), n = (id) => q(id).querySelector('b').textContent.replace(/\\s/g, ''), on = (id) => (q(id).dataset.on || '').split(' ').filter(Boolean), line = document.querySelector('#acPanL .lk-top .mx-line');
      return { ko: n('mxColKo'), ult: n('mxColUlt'), rt: n('mxColRt'), koOn: on('mxColKo'), ultOn: on('mxColUlt'), oneLine: !!line && line.getBoundingClientRect().height < 30, label: q('mxColKo').getAttribute('aria-label') }; })()""")
    check(col == {'ko': '2/8', 'ult': '1/8', 'rt': '4/13', 'koOn': ['phoenix', 'odin'], 'ultOn': ['odin'], 'oneLine': True, 'label': '2 of 8 KO pages: Phoenix, Odin'},
          f'Account > Locker: the Collection is one slim line on top: KO pages 2/8, Ultimate KOs 1/8, combo routes 4/13, who is in (the labels) ({col})')
    await ctx.close()

    # ----- a KO page you land is recorded (a real lethal hit, the clock under the test's control)
    await ko_page(b)

    await cup_xp(b)
    await modes_x1(b)

async def modes_x1(b):
    # a boss fight and a Road stop count x1, whatever names their levels carry (Practice's Normal would be 0.75)
    vp = (844, 390)
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE)); pg = await open_page(ctx, 'boss x1')
    await pg.evaluate("window.__blBoss({ level: 0 })"); await pg.wait_for_function("window.__blastline.mode === 'match'", timeout=20000); await pg.wait_for_timeout(400)
    check(await pg.evaluate("window.__blMastery.mult()") == 1 and await pg.evaluate("window.__blMastery.gain({ res: 1, me: { kos: 0 } }).xp") == 40, 'a boss fight counts x1 (a win is 40)')
    await ctx.close()
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, last='samurai', mxp={'samurai': 10})); pg = await open_page(ctx, 'road x1')
    await road_win(pg)
    r, p = await row(pg), await prof(pg)
    check(r['xp'] == '+40' and p['mxp']['samurai'] == 50 and p['road']['s'] == [7], f"a Road stop counts x1 (a win is 40; row {r['xp']!r}, saved {p['mxp'].get('samurai')}, stars {p['road'].get('s')})")
    await ctx.close()

async def cup_xp(b):
    vp = (844, 390)
    # ----- the tournament: an XP sticker on the bracket, a forfeit gives none
    ctx, _ = await new_ctx(b, vp, prof=dict(BASE, mxp={'phoenix': 70}, mpaid={'phoenix': 1})); pg = await open_page(ctx, 'cup')
    await pg.evaluate("document.getElementById('bCup').click()"); await pg.wait_for_timeout(600)
    await pg.evaluate("document.querySelector('#tiles .tile[data-id=phoenix]').click()"); await pg.wait_for_timeout(200)
    await pg.evaluate("document.getElementById('selGo').click()"); await pg.wait_for_function("window.__blastline.mode === 'cup'", timeout=20000); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.getElementById('cupGo').click()")
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000); await pg.wait_for_timeout(300)
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'cup'", timeout=90000)
    await pg.wait_for_function("!document.getElementById('cupXp').hidden", timeout=20000)
    s = await pg.evaluate("({ b: document.querySelector('#cupXp b').textContent, small: document.querySelector('#cupXp small').textContent })")
    p = await prof(pg)
    check(s['b'] == '+40 XP' and 'Phoenix Lv 2' in s['small'] and '+20 chips' in s['small'] and p['mxp']['phoenix'] == 110 and p['mpaid']['phoenix'] == 2, f"a cup win shows +40 XP and the level up on the bracket ({s}, saved {p['mxp'].get('phoenix')})")
    check(p['tokens'] == BASE['tokens'] + 15 + 20, f"the cup's own chips and the level's chips both paid (chips {p['tokens']})")
    await pg.evaluate("document.getElementById('cupGo').click()")
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000); await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('pauseBtn').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('pQuit').click()"); await pg.wait_for_timeout(200); await pg.evaluate("document.getElementById('pQuit').click()")
    await pg.wait_for_function("window.__blastline.mode === 'cup'", timeout=30000); await pg.wait_for_timeout(1500)
    p2 = await prof(pg)
    check(p2['mxp']['phoenix'] == 110 and not await shown(pg, '#cupXp'), f"a forfeited cup match gives no XP and no sticker (saved {p2['mxp'].get('phoenix')})")
    await ctx.close()

# ---------------------------------------------------------------- a real KO page
CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; } };
})();"""
async def ko_page(b):
    ctx = await b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=1)
    await ctx.add_init_script("localStorage.setItem('%s', %s);" % (PROF, json.dumps(json.dumps(dict(BASE, last='dragon')))))
    await ctx.add_init_script(CLOCK)
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'ko page: {e}'))
    await pg.goto(TEST_URL); await pg.wait_for_timeout(1200)
    async def ff(ms):
        for _ in range(100):
            if await pg.evaluate("(ms) => window.__clock.step(ms)", ms): return
            await pg.wait_for_timeout(20)
    await pg.evaluate("document.getElementById('bPractice').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('lvlPick').click()"); await pg.evaluate("[...document.querySelectorAll('#lvlPop button')].find((x) => x.textContent === 'Dummy').click()")
    await pg.evaluate("document.getElementById('selGo').click()")
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=20000); await pg.wait_for_timeout(300)
    await pg.evaluate("window.__clock.freeze()"); await ff(100)
    before = await pg.evaluate('JSON.parse(JSON.stringify(window.__blAcct.P.pages))')
    ok = False
    for attempt in range(6):
        await pg.evaluate("""() => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1]; d.stocks = 1; d.percent = 400; a.vx = a.vy = d.vx = d.vy = 0; a.x = -10; a.facing = 1; d.x = 40; d.facing = -1; }""")
        await ff(32); await pg.wait_for_timeout(1300)
        await pg.keyboard.down('KeyK'); await ff(48); await pg.keyboard.up('KeyK')
        for _ in range(94):
            if await pg.evaluate(f"{G}.phase !== 'play'"): ok = True; break
            await ff(16)
        if ok: break
    check(ok and await pg.evaluate("window.__blastline.fin.on"), 'the forced heavy ended the match with a finisher')
    pages = await pg.evaluate('JSON.parse(JSON.stringify(window.__blAcct.P.pages))')
    check(before == {'ko': [], 'ult': []} and pages['ko'] == ['dragon'] and pages['ult'] == [], f"landing your KO page records it in P.pages.ko (not .ult) ({pages})")
    # an Ultimate KO page (the finisher flags it) goes into both lists; asking again changes nothing
    await pg.evaluate("window.__blMastery.page('dragon', true); window.__blMastery.page('odin', true); window.__blMastery.page('odin', false)")
    pages = await pg.evaluate('JSON.parse(JSON.stringify(window.__blAcct.P.pages))')
    check(pages == {'ko': ['dragon', 'odin'], 'ult': ['dragon', 'odin']}, f'an Ultimate KO page is recorded in both lists, once ({pages})')
    await ctx.close()

# ---------------------------------------------------------------- screenshots and layout at one size
SELECT_FIT = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight, go = document.getElementById('selGo').getBoundingClientRect();
  if (go.bottom > vh + 0.5 || go.top < 0 || go.right > vw + 0.5) bad.push('the Fight button is off screen');
  for (const t of document.querySelectorAll('#tiles .tile')) {
    const s = t.querySelector('.mx-sh'); if (s.hidden) continue;
    const sr = s.getBoundingClientRect(), tr = t.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(t.querySelector('span b')); const pl = rg.getBoundingClientRect();   // the name's letters (the plate's slanted end may sit under the shield)
    if (!(sr.right <= pl.left + 0.5 || sr.left >= pl.right - 0.5 || sr.bottom <= pl.top + 0.5 || sr.top >= pl.bottom - 0.5)) bad.push('the shield of ' + t.dataset.id + ' covers its name');
    if (sr.right > tr.right + 0.5 || sr.bottom > tr.bottom + 0.5) bad.push('the shield of ' + t.dataset.id + ' leaves the tile');
  }
  const st = document.getElementById('dStats').getBoundingClientRect(), row = document.querySelector('#dStats .mx-row').getBoundingClientRect();
  if (row.bottom > st.bottom + 0.5 || row.right > st.right + 0.5) bad.push('the MASTERY row leaves the stats card');
  for (const e of document.querySelectorAll('#dStats .mx-row > *')) if (e.scrollWidth > e.clientWidth + 1 && e.className === 'mx-next') bad.push('the Next line is cut off');
  return bad;
})()"""
RES_FIT = """(() => {
  const bad = [], vh = innerHeight, r = document.getElementById('rMx').getBoundingClientRect(), a = document.getElementById('rAgain');
  a.scrollIntoView({ block: 'nearest' });
  const ar = a.getBoundingClientRect();
  if (ar.bottom > vh + 0.5 || ar.top < 0) bad.push('Next match is not reachable');
  const x = document.querySelector('#rMx .mx-xp').getBoundingClientRect(), nm = document.getElementById('rMxNm');
  if (x.right > r.right + 0.5) bad.push('the XP sticker leaves the row');
  const sa = document.getElementById('rStats').getBoundingClientRect(), rk = document.getElementById('rRank').getBoundingClientRect();
  if (r.bottom > sa.top + 0.5 && r.top < sa.bottom) bad.push('the row overlaps the stat tiles');
  if (!document.getElementById('rRank').hidden && r.top < rk.bottom - 0.5) bad.push('the row overlaps the rank card');
  const stars = document.getElementById('rStars');
  if (!stars.hidden && stars.getClientRects().length) { const q = stars.getBoundingClientRect(); if (r.left < q.right - 0.5 && r.right > q.left + 0.5 && r.top < q.bottom - 0.5 && r.bottom > q.top + 0.5) bad.push('the row overlaps the Road stars'); }
  for (const id of ['rMxLine']) { const e = document.getElementById(id); if (e.scrollHeight > e.clientHeight + 1 && e.textContent.length < 20) bad.push(id + ' is cut'); }
  return bad;
})()"""

async def road_win(pg):
    """From the menu: the Road, stop 1, and win it."""
    await pg.evaluate("document.querySelector('#bRoad').click()"); await pg.wait_for_timeout(600)
    await pg.wait_for_function("(() => { const r = window.__blRoad.get(); return (document.getElementById('roadHits').dataset.key || '').endsWith(`:${r.s.join('.')}:${r.b}`); })()", timeout=10000)
    # on a first visit your fighter walks in from the gate first; the stop's sheet opens when the walk ends
    await pg.evaluate("document.querySelector('.rd-hit[data-i=\"0\"]').click()")
    await pg.wait_for_function("(() => { const e = document.getElementById('scrRoadStop'); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; })()", timeout=10000)
    await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('rsGo').click()")
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000); await pg.wait_for_timeout(300)
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].stocks = 1; g.fighters[1].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000)
    await pg.wait_for_function("document.getElementById('rMxLine').classList.contains('on')", timeout=30000)
    await pg.wait_for_timeout(900)

async def sizes(b, tag):
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    mix = dict(BASE, mxp={'alchemist': 120, 'odin': 300, 'wizard': 500, 'samurai': 800, 'dragon': 1100, 'gunslinger': 2300, 'reaper': 2800}, mpaid={'alchemist': 2, 'odin': 3, 'wizard': 4, 'samurai': 5, 'dragon': 6, 'gunslinger': 9, 'reaper': 10},
               pages={'ko': ['phoenix', 'odin', 'reaper'], 'ult': ['odin']}, routes=['a1', 'a2', 'a3', 'a4'], fstats={'odin': {'w': 3, 'l': 1, 'd': 0}, 'reaper': {'w': 5, 'l': 2, 'd': 1}})
    ctx, mob = await new_ctx(b, vp, up, mix); pg = await open_page(ctx, tag)
    clk = pg.tap if mob else pg.click
    async def shot(name, fit=None):
        await pg.screenshot(path=f'{OUT}/{tag}_{name}.png')
        if fit:
            bd = await pg.evaluate(fit)
            check(not bd, f'{tag} {name}: layout ({"; ".join(bd[:3]) or "fits"})')
    await clk('#bRanked'); await pg.wait_for_timeout(700)
    for fid in ['odin', 'reaper']:
        await pg.evaluate(f"document.querySelector('#tiles .tile[data-id={fid}]').click()"); await pg.wait_for_timeout(1100)
        await shot(f'select_{fid}', SELECT_FIT)
    # the Account sheet: Stats and the Locker's Collection
    await pg.evaluate("document.getElementById('selBack').click()"); await pg.wait_for_timeout(400)
    await clk('#mRank'); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('.ac-tabs .chip[data-t=s]').click()"); await pg.wait_for_timeout(400)
    await shot('stats')
    ov = await pg.evaluate("(() => { const t = document.querySelector('.fs-tab'), p = document.getElementById('acPanS'); return t.scrollWidth > p.clientWidth + 1; })()")
    check(not ov, f'{tag} stats: the table with its Mastery column fits the sheet')
    await pg.evaluate("document.querySelector('.ac-tabs .chip[data-t=l]').click()"); await pg.wait_for_timeout(400)
    await shot('locker')
    await ctx.close()
    # the results: a level up (ranked, the rating above it), several levels at once (practice, no rating), MASTERED
    CASES = {'s667': None, 'p844': {'levelup', 'severallevels', 'mastered'}, 'd1280': {'levelup', 'mastered'}, 'up390': {'levelup', 'severallevels'}}   # (every match costs about half a minute: the tightest screen gets all of them)
    for name, mode, extra, win, level in [('results_levelup', 'ranked', dict(last='phoenix', mxp={'phoenix': 80}, mpaid={'phoenix': 1}), True, None),
                                          ('results_noup', 'ranked', dict(last='wizard', mxp={'wizard': 330}, mpaid={'wizard': 3}), True, None),
                                          ('results_severallevels', 'practice', dict(last='dragon', mxp={'dragon': 1690}, mpaid={'dragon': 1}), True, 'Hard'),
                                          ('results_mastered', 'ranked', dict(last='reaper', mxp={'reaper': 2680}, mpaid={'reaper': 9}), True, None),
                                          ('results_loss', 'ranked', dict(last='samurai', mxp={'samurai': 680}, mpaid={'samurai': 4}), False, None)]:
        if CASES[tag] is not None and name[len('results_'):] not in CASES[tag]: continue
        ctx, mob = await new_ctx(b, vp, up, dict(BASE, **extra)); pg = await open_page(ctx, tag + ' ' + name)
        await start(pg, mode, level); await finish(pg, win)
        await pg.screenshot(path=f'{OUT}/{tag}_{name}.png')
        bd = await pg.evaluate(RES_FIT)
        check(not bd, f'{tag} {name}: layout ({"; ".join(bd[:3]) or "fits"})')
        await ctx.close()
    # a Road stop: the stars and the mastery row side by side (the Road counts x1; Lv 2 on this win)
    ctx, mob = await new_ctx(b, vp, up, dict(BASE, last='samurai', mxp={'samurai': 80}, mpaid={'samurai': 1})); pg = await open_page(ctx, tag + ' road')
    await road_win(pg)
    r = await row(pg)
    await pg.screenshot(path=f'{OUT}/{tag}_results_road.png')
    bd = await pg.evaluate(RES_FIT)
    check(not bd, f'{tag} results_road: layout with the stars ({"; ".join(bd[:3]) or "fits"})')
    check(r['xp'] == '+40' and r['tag'] == 'Level up' and r['name'] == 'Samurai', f"{tag} results_road: the Road gives full XP ({r['xp']!r}, {r['tag']!r})")
    await ctx.close()

async def main():
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    tags = ONLY or ['flow', 's667', 'p844', 'd1280', 'up390']
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for t in tags:
            print('running', t, flush=True)
            try:
                if t == 'flow': await flow(b)
                elif t == 'ko': await ko_page(b)     # (the parts of flow, for working on one of them)
                elif t == 'cup': await cup_xp(b)
                elif t == 'x1': await modes_x1(b)
                else: await sizes(b, t)
            except Exception as e:
                check(False, f'{t}: {type(e).__name__}: {str(e)[:300]}')
        await b.close()
    for e in errs: check(False, f'page error: {e}')
    print('no errors' if not bad else f'{len(bad)} problems')
asyncio.run(main())
