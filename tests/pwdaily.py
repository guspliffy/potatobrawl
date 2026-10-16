# The Daily Potato (ui/daily.js): the day's matchup on the menu, one try, a win pays 40 chips and starts a streak that shows on the
# profile pill, a reload can't give a second try, a forfeit / a finished loss / a reload mid-match end the streak, the next day brings
# the next matchup and keeps a streak won yesterday, a streak with a gap shows 0, the menu line turns over at midnight by itself.
# A second part plays a won Daily at each size and takes screenshots of the menu, the sheet, the results and the menu after.
#   python3 pwdaily.py [outdir [tag ...]]   tags: flow (844x390, the checks above) s667 p844 d1280 up390; no tag runs everything
# The page's clock is moved with a Date stand-in (init script, time zone Europe/Berlin; timers and performance.now are untouched).
# The CPU is put out of the arena through window.__blastline.game (test only), as pwcup.py does.
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'daily'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = "potatobrawl.profile.v1"
G = "window.__blastline.game"
TZ = 'Europe/Berlin'
def at(day, hm='10:00'): return f'2026-10-{day:02d}T{hm}:00+02:00'   # October 2026 in Berlin is CEST; the 12th is a Monday
START = {'tokens': 85, 'rating': 1210, 'peak': 1210, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True,
         'history': [{'r': 1, 'd': 12, 'me': 'odin', 'op': 'wizard', 'opr': 1200, 't': 5}]}
# Date stand-in: localStorage 'pwdaily.at' (an ISO time) is "now" when the page loads, and the clock runs on from there.
# window.__pwNow(iso) moves it while the page is open.
CLOCK = """(() => {
  const RD = Date; let off = 0;
  const set = (iso) => { off = iso ? RD.parse(iso) - RD.now() : 0; };
  try { set(localStorage.getItem('pwdaily.at')); } catch (e) {}
  class D extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
  window.Date = D; window.__pwNow = set;
})();"""

# Playwright's in-memory browser profiles commit localStorage lazily, and a reload can come back to an older store (the
# starting profile, the Daily open again). A real browser keeps what the page wrote, so reload() carries the page's storage
# (the profile and the test clock) over in window.name and KEEP puts it back before the game loads.
KEEP = "try { if (window.name.indexOf('pwkeep:') === 0) { const s = JSON.parse(window.name.slice(7)); window.name = ''; for (const k in s) localStorage.setItem(k, s[k]); } } catch (e) {}\n"
async def reload(pg):
    await pg.evaluate("window.name = 'pwkeep:' + JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))")
    await pg.reload()

async def new_page(b, tag, vp, up, errs, prof, when):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, timezone_id=TZ, locale='en-US')
    p = dict(prof)
    if up: p['screen'] = 'up'
    # a fresh page gets the starting profile and time; once the game has saved one (also after a reload) it is kept
    await ctx.add_init_script(KEEP + "if (localStorage.getItem('%s') === null) { localStorage.setItem('%s', %s); localStorage.setItem('pwdaily.at', %s); }"
                              % (PROF, PROF, json.dumps(json.dumps(p)), json.dumps(when)))
    await ctx.add_init_script(CLOCK)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    return ctx, pg, mob

def prof(pg): return pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)

async def reload_at(pg, when, daily=None):
    """Move the clock (and optionally P.daily) and reload the page."""
    js = "localStorage.setItem('pwdaily.at', %s);" % json.dumps(when)
    if daily is not None: js += "{ const p = JSON.parse(localStorage.getItem('%s')); p.daily = %s; localStorage.setItem('%s', JSON.stringify(p)); }" % (PROF, json.dumps(daily), PROF)
    await pg.evaluate(js)
    await reload(pg); await pg.wait_for_timeout(900)
    await pg.wait_for_function("window.__blastline && window.__blastline.mode === 'menu'", timeout=20000)

async def in_match(pg):
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000)
    await pg.wait_for_timeout(300)

async def end_match(pg, win):
    """Put one fighter out of the arena: the CPU when you win, you when you lose."""
    await in_match(pg)
    i = 1 if win else 0
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[{i}].stocks = 1; g.fighters[{i}].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000)
    await pg.wait_for_timeout(1100)   # the chip count-up ends

async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; }})()")
async def name(pg, fid): return await pg.evaluate(f"BL.FIGHTERS.find((f) => f.id === '{fid}').name")
async def pick(pg, key): return await pg.evaluate(f"window.__blDaily.pick('{key}')")
async def line_for(pg, key):
    pk = await pick(pg, key)
    return pk, f"{await name(pg, pk['me'])} vs {await name(pg, pk['opp'])} · {pk['word']}"

FIT = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight;
  const btns = [...document.querySelectorAll('#scrMenu .mm-col button')];
  for (const b of btns) { const r = b.getBoundingClientRect(); if (r.top < -0.5 || r.bottom > vh + 0.5 || r.left < -0.5 || r.right > vw + 0.5) bad.push('menu button ' + b.id + ' off screen'); }
  // the Daily tile: its lines (the matchup or the day's result, the reward) stay inside it and do not stretch it past the Tournament tile
  const d = document.querySelector('#bDaily'), dr = d.getBoundingClientRect(), t = document.querySelector('#bCup').getBoundingClientRect();
  for (const l of d.querySelectorAll('.mm-tb > *')) { const r = l.getBoundingClientRect(); if (!r.width) continue; if (r.right > dr.right + 1 || r.bottom > dr.bottom + 1 || l.scrollWidth > l.clientWidth + 1) bad.push('the Daily line "' + l.textContent.slice(0, 20) + '" runs out of its tile'); }
  if (dr.height > t.height + 1) bad.push('the Daily tile is taller than the Tournament tile (its lines do not fit)');
  const pill = document.querySelector('#mRank'), pr = pill.getBoundingClientRect(), rg = document.createRange();
  rg.selectNodeContents(document.querySelector('#scrMenu h1'));
  const h1 = rg.getBoundingClientRect();   // the letters, not the block's full width
  if (pill.scrollWidth > pill.clientWidth + 1) bad.push('the pill is cut off');
  if (pr.left < h1.right - 1 && pr.bottom > h1.top + 1 && pr.top < h1.bottom - 1) bad.push('the pill overlaps the title');
  if (pr.left < -0.5) bad.push('the pill runs off the left edge');
  return bad;
})()"""
SHEET = """((sel) => {
  const bad = [], vw = innerWidth, vh = innerHeight, s = document.querySelector(sel).getBoundingClientRect();
  if (s.top < -0.5 || s.bottom > vh + 0.5 || s.left < -0.5 || s.right > vw + 0.5) bad.push(sel + ' does not fit the screen');
  for (const b of document.querySelectorAll(sel + ' .btn')) { if (b.closest('[hidden]')) continue; const r = b.getBoundingClientRect(); if (r.width && (r.bottom > vh + 0.5 || r.right > vw + 0.5)) bad.push('button ' + b.id + ' off screen'); }
  for (const e of document.querySelectorAll(sel + ' .dly-t b')) if (e.scrollWidth > e.clientWidth + 1) bad.push('fighter name cut: ' + e.textContent);
  return bad;
})"""

async def shot(pg, tag, name_, errs, check=None):
    await pg.screenshot(path=f'{OUT}/{tag}_{name_}.png')
    if check:
        bad = await pg.evaluate(check[0] if len(check) == 1 else f"({check[0]})({json.dumps(check[1])})")
        if bad: errs.append(f'{tag} {name_}: ' + '; '.join(bad[:4]))

async def flow(b, errs):
    tag, vp = 'flow', (844, 390)
    p0 = dict(START, pal={f: 1 for f in ['alchemist', 'dragon', 'gunslinger', 'odin', 'phoenix', 'reaper', 'samurai', 'wizard']},
              owned={f: [0, 1] for f in ['alchemist', 'dragon', 'gunslinger', 'odin', 'phoenix', 'reaper', 'samurai', 'wizard']})
    ctx, pg, mob = await new_page(b, tag, vp, False, errs, p0, at(14))
    clk = pg.tap
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
        return ok
    D = 'window.__blDaily'
    # ----- the day and its matchup
    need(await pg.evaluate(f"{D}.key()") == '2026-10-14', 'the day key is not the local date')
    ids = await pg.evaluate("[...document.querySelectorAll('#scrMenu .mm-col button')].map((b) => b.id)")
    need(ids[:2] == ['bRanked', 'bDaily'], f'Daily Potato is not second on the menu: {ids}')
    need('Daily Potato' in await txt(pg, '#bDaily'), 'no Daily Potato button')
    pk, want = await line_for(pg, '2026-10-14')
    need(await txt(pg, '#mDaily') == want, f"menu line {await txt(pg, '#mDaily')!r}, want {want!r}")
    need(await pick(pg, '2026-10-14') == pk, 'the same day picks a different matchup')
    many = await pg.evaluate(f"Array.from({{ length: 28 }}, (_, i) => {D}.pick({D}.shift('2026-10-12', i)))")
    figs = await pg.evaluate("BL.FIGHTERS.map((f) => f.id)")
    need(all(m['me'] in figs and m['opp'] in figs and m['cpu'] and isinstance(m['seed'], int) for m in many), 'a pick has an unknown fighter or no name/seed')
    need(len({(m['me'], m['opp']) for m in many}) >= 10 and len({m['me'] for m in many}) >= 5, 'four weeks of picks hardly vary')
    week = [(m['d'], m['word']) for m in many[:7]]
    need(week == [(0.45, 'Normal'), (0.52, 'Normal'), (0.59, 'Normal'), (0.66, 'Hard'), (0.73, 'Hard'), (0.8, 'Hard'), (0.87, 'Brutal')], f'weekly strength {week}')
    need(not await shown(pg, '#mStreak'), 'a streak shows on the pill before any Daily')
    # the result rules (pure): draw keeps a running streak, a loss ends it, a forfeit pays nothing
    st0 = {'d': '2026-10-13', 'r': 1, 's': 3, 'w': '2026-10-13', 'b': 5}
    a = lambda prev, res, ff: pg.evaluate(f"{D}.after({json.dumps(st0)}, '2026-10-14', {prev}, {res}, {json.dumps(ff)})")
    r = await a(3, 1, False); need(r['chips'] == 40 and r['st'] == {'d': '2026-10-14', 'r': 1, 's': 4, 'w': '2026-10-14', 'b': 5}, f'win rule {r}')
    r = await a(5, 1, False); need(r['st']['s'] == 6 and r['st']['b'] == 6, f'win rule raises the best {r}')
    r = await a(3, 0.5, False); need(r['chips'] == 15 and r['st']['s'] == 3 and r['st']['w'] == '2026-10-14', f'draw rule {r}')
    r = await a(0, 0.5, False); need(r['chips'] == 15 and r['st']['s'] == 0 and r['st']['w'] == '2026-10-13', f'draw rule without a streak {r}')
    r = await a(3, 0, False); need(r['chips'] == 5 and r['st']['s'] == 0 and r['st']['b'] == 5 and r['st']['w'] == '2026-10-13', f'loss rule {r}')
    r = await a(3, 0, True); need(r['chips'] == 0 and r['st']['s'] == 0, f'forfeit rule {r}')
    # ----- the sheet
    await clk('#bDaily'); await pg.wait_for_timeout(400)
    need(await shown(pg, '#scrDaily'), 'the Daily sheet does not open')
    sh = await txt(pg, '#scrDaily')
    me_n, op_n = await name(pg, pk['me']), await name(pg, pk['opp'])
    need(me_n.upper() in sh.upper() and op_n.upper() in sh.upper() and pk['cpu'] in sh, f'sheet does not show the matchup: {sh!r}')
    need('One try' in sh and '40 chips' in sh and 'Wed 14 Oct' in sh, f'sheet text: {sh!r}')
    need(await shown(pg, '#dlyGo'), 'no Fight button')
    await shot(pg, tag, '1_sheet', errs, (SHEET, '#scrDaily .sheet'))
    await clk('#dlyBack'); await pg.wait_for_timeout(300)
    need(not await shown(pg, '#scrDaily') and await pg.evaluate("window.__blastline.mode") == 'menu', 'Back does not close the sheet')
    # ----- the match
    await clk('#bDaily'); await pg.wait_for_timeout(300); await clk('#dlyGo')
    await pg.wait_for_function(f"{G} !== null", timeout=20000)
    p1 = await prof(pg)
    need(p1['daily']['d'] == '2026-10-14' and p1['daily']['r'] == -1, f"starting does not record the try: {p1.get('daily')}")
    gi = await pg.evaluate(f"(() => {{ const g = {G}; return {{ f: g.fighters.map((f) => f.spec.id), pal: g.fighters.map((f) => f.pal.name), stocks: g.stocks, timer: g.timer, timed: g.timed }}; }})()")
    need(gi['f'] == [pk['me'], pk['opp']], f"fighters {gi['f']}, want {[pk['me'], pk['opp']]}")
    my_pal = await pg.evaluate(f"BL.FIGHTERS.find((f) => f.id === '{pk['me']}').palettes[1].name")
    need(gi['pal'][0] == my_pal, f"your skin is {gi['pal'][0]}, want the equipped {my_pal}")
    if pk['me'] == pk['opp']: need(gi['pal'][1] != gi['pal'][0], 'mirror match: the CPU wears your skin')
    need(gi['stocks'] == 3 and gi['timed'] and 10000 < gi['timer'] <= 180 * 60, f'not 3 lives / 3 minutes: {gi}')
    need(await pg.evaluate(f"{D}.match.bot.d") == 0.59 and await pg.evaluate(f"{D}.match.cpu") == pk['cpu'], 'CPU strength or name is not the day\'s')
    sub = await txt(pg, '#pc1 .pc-sub')
    need(pk['cpu'] in sub and 'Normal' in sub, f'CPU card: {sub!r}')
    await in_match(pg)
    await clk('#pauseBtn'); await pg.wait_for_timeout(300)
    need(await txt(pg, '#pQuit') == 'Forfeit' and "today's try" in await txt(pg, '#pNote'), 'the pause menu does not offer Forfeit for the Daily')
    await clk('#pResume'); await pg.wait_for_timeout(200)
    await end_match(pg, True)
    # ----- the results of a win
    need(await txt(pg, '#rMode') == 'Daily Potato · Wed 14 Oct', f"results head {await txt(pg, '#rMode')!r}")
    need(await txt(pg, '#rTitle') == 'Victory' and pk['cpu'] in await txt(pg, '#rSub'), 'results title / CPU name')
    ch = await txt(pg, '#rChips')
    need('+40 chips' in ch and 'Daily win +40 · 1-day streak' in ch, f'chips line {ch!r}')
    need(not await shown(pg, '#rRank'), 'the rating block shows')
    need(await txt(pg, '#rAgain') == 'Menu' and not await shown(pg, '#rMenu') and await shown(pg, '#rChange'), 'results buttons: want Menu + Fighters')
    p2 = await prof(pg)
    need(p2['tokens'] == 85 + 40, f"chips {p2['tokens']}, want {85 + 40}")
    need(p2['daily'] == {'d': '2026-10-14', 'r': 1, 's': 1, 'w': '2026-10-14', 'b': 1}, f"daily after a win {p2['daily']}")
    need(all(p2[k] == START[k] for k in ['rating', 'peak', 'wins', 'losses', 'matches']) and p2['history'] == START['history'] and not p2.get('fstats'), 'the Daily changed the ranked record')
    await shot(pg, tag, '2_won', errs)
    await clk('#rAgain'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'menu', 'Menu on the results does not go to the menu')
    need(await txt(pg, '#mDaily') == 'Won · 1-day streak · next in 14 h', f"menu line after a win {await txt(pg, '#mDaily')!r}")
    need(await shown(pg, '#mStreak') and await txt(pg, '#mStreak') == '1', 'the pill shows no streak after a win')
    need('1-day Daily Potato streak' in (await pg.get_attribute('#mRank', 'aria-label') or ''), 'the pill label does not mention the streak')
    need(await pg.evaluate("!document.querySelector('#rMenu').hidden"), 'the results Menu button stays hidden after the Daily')
    await clk('#bDaily'); await pg.wait_for_timeout(300)
    sh = await txt(pg, '#scrDaily')
    need(not await shown(pg, '#dlyGo') and 'Won today' in sh and '14 h' in sh and 'Best streak: 1 day' in sh, f'done sheet: {sh!r}')
    await shot(pg, tag, '3_done_sheet', errs, (SHEET, '#scrDaily .sheet'))
    await clk('#dlyBack'); await pg.wait_for_timeout(200)
    # ----- one try: a reload changes nothing
    await reload_at(pg, at(14, '10:05'))
    need((await txt(pg, '#mDaily')).startswith('Won · 1-day streak'), 'after a reload the Daily is open again')
    await clk('#bDaily'); await pg.wait_for_timeout(300)
    need(not await shown(pg, '#dlyGo'), 'after a reload the sheet offers Fight again')
    await clk('#dlyBack'); await pg.wait_for_timeout(200)
    need((await prof(pg))['tokens'] == 125, 'chips changed over a reload')
    # ----- the next day: a new matchup, yesterday's streak still shows; a forfeit ends it and pays nothing
    await reload_at(pg, at(15))
    pk15, want = await line_for(pg, '2026-10-15')
    need(await txt(pg, '#mDaily') == want and want.endswith('· Hard'), f"Thursday's line {await txt(pg, '#mDaily')!r}, want {want!r}")
    need(await txt(pg, '#mStreak') == '1', "a streak won yesterday does not show today")
    await clk('#bDaily'); await pg.wait_for_timeout(300)
    need('2-day streak' in await txt(pg, '#dlyRule'), 'the sheet does not say a win makes it 2 days')
    await clk('#dlyGo'); await in_match(pg)
    need(await pg.evaluate(f"{D}.match.bot.d") == 0.66, 'Thursday is not 0.66')
    await clk('#pauseBtn'); await pg.wait_for_timeout(300)
    await clk('#pQuit'); await pg.wait_for_timeout(200)
    need('again' in (await txt(pg, '#pQuit')).lower(), 'the forfeit is not confirmed with a second tap')
    await clk('#pQuit'); await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=20000); await pg.wait_for_timeout(400)
    need(await txt(pg, '#rTitle') == 'Forfeit' and 'No chips for a forfeit · streak reset' in await txt(pg, '#rChips'), f"forfeit results: {await txt(pg, '#rChips')!r}")
    p3 = await prof(pg)
    need(p3['tokens'] == 125 and p3['daily'] == {'d': '2026-10-15', 'r': 0, 's': 0, 'w': '2026-10-14', 'b': 1}, f"after a forfeit: chips {p3['tokens']}, daily {p3['daily']}")
    await shot(pg, tag, '4_forfeit', errs)
    await clk('#rAgain'); await pg.wait_for_timeout(400)
    need(await txt(pg, '#mDaily') == 'Lost · next in 14 h' and not await shown(pg, '#mStreak'), f"menu after a forfeit {await txt(pg, '#mDaily')!r}")
    # ----- a finished loss: +5, no streak to lose
    await reload_at(pg, at(16))
    await clk('#bDaily'); await pg.wait_for_timeout(300); await clk('#dlyGo')
    await end_match(pg, False)
    ch = await txt(pg, '#rChips')
    need(await txt(pg, '#rTitle') == 'Defeat' and '+5 chips' in ch and 'Daily played +5' in ch and 'streak reset' not in ch, f'loss chips line {ch!r}')
    p4 = await prof(pg)
    need(p4['tokens'] == 130 and p4['daily']['r'] == 0 and p4['daily']['s'] == 0, f"after a loss: chips {p4['tokens']}, daily {p4['daily']}")
    await clk('#rAgain'); await pg.wait_for_timeout(300)
    # ----- a reload in the middle of the match counts as a loss and ends a running streak
    await reload_at(pg, at(17), {'d': '2026-10-16', 'r': 1, 's': 4, 'w': '2026-10-16', 'b': 6})
    need(await txt(pg, '#mStreak') == '4', 'the 4-day streak from yesterday does not show')
    await clk('#bDaily'); await pg.wait_for_timeout(300); await clk('#dlyGo'); await in_match(pg)
    await reload_at(pg, at(17, '10:02'))
    need(await txt(pg, '#mDaily') == 'Lost · next in 14 h' and not await shown(pg, '#mStreak'), f"after a reload mid-match: {await txt(pg, '#mDaily')!r}")
    p5 = await prof(pg)
    need(p5['tokens'] == 130 and p5['daily'] == {'d': '2026-10-17', 'r': -1, 's': 0, 'w': '2026-10-16', 'b': 6}, f"after a reload mid-match: chips {p5['tokens']}, daily {p5['daily']}")
    await clk('#bDaily'); await pg.wait_for_timeout(300)
    need(not await shown(pg, '#dlyGo') and 'Lost today' in await txt(pg, '#dlyRule'), 'an unfinished Daily can be started again')
    await clk('#dlyBack'); await pg.wait_for_timeout(200)
    # ----- a streak with a gap shows 0 and a win starts again at 1 (the best stays); Sunday is Brutal
    await reload_at(pg, at(18), {'d': '2026-10-16', 'r': 1, 's': 3, 'w': '2026-10-16', 'b': 3})
    need(not await shown(pg, '#mStreak') and (await txt(pg, '#mDaily')).endswith('· Brutal'), 'a streak with a gap still shows, or Sunday is not Brutal')
    await clk('#bDaily'); await pg.wait_for_timeout(300); await clk('#dlyGo'); await in_match(pg)
    need(await pg.evaluate(f"{D}.match.bot.d") == 0.87, 'Sunday is not 0.87')
    await end_match(pg, True)
    p6 = await prof(pg)
    need(p6['daily'] == {'d': '2026-10-18', 'r': 1, 's': 1, 'w': '2026-10-18', 'b': 3} and p6['tokens'] == 170, f"win after a gap: {p6['daily']}, chips {p6['tokens']}")
    await clk('#rAgain'); await pg.wait_for_timeout(300)
    # ----- late at night the line counts minutes, and at midnight it turns over to the next matchup by itself
    await reload_at(pg, at(19, '23:30'), {'d': '2026-10-19', 'r': 0.5, 's': 2, 'w': '2026-10-19', 'b': 3})
    need(await txt(pg, '#mDaily') == 'Draw · 2-day streak · next in 30 min' and await txt(pg, '#mStreak') == '2', f"late-night line {await txt(pg, '#mDaily')!r}")
    await pg.evaluate(f"window.__pwNow({json.dumps(at(20, '00:00'))})")
    _, want = await line_for(pg, '2026-10-20')
    try: await pg.wait_for_function(f"document.querySelector('#mDaily').textContent === {json.dumps(want)}", timeout=40000)
    except Exception: need(False, f"the menu did not turn over at midnight: {await txt(pg, '#mDaily')!r}, want {want!r}")
    need(await txt(pg, '#mStreak') == '2', "yesterday's draw (with a streak) does not keep the streak")
    await ctx.close()

async def sizes(b, tag, errs):
    """A won Daily at one size: the menu before and after, the sheet, the results."""
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    # yesterday was won (a 2-day streak), so the pill already shows the glyph; plenty of chips and cups to fill the pill
    p0 = dict(START, tokens=12345, rating=1688, peak=1700, cups=12, daily={'d': '2026-10-13', 'r': 1, 's': 2, 'w': '2026-10-13', 'b': 2})
    ctx, pg, mob = await new_page(b, tag, vp, up, errs, p0, at(14))
    clk = pg.tap if mob else pg.click
    await shot(pg, tag, '0_menu', errs, (FIT,))
    # the longest lines the tile can get, at this size: the longest matchup (with the reward line under it), and the longest result of
    # a day already played (the tile has no reward line then, as menuDaily in ui/screens.js leaves it)
    for t, done in [('Gunslinger vs Gunslinger · Brutal', False), ('Draw · 12-day streak · next in 23 h', True)]:
        await pg.evaluate(f"(() => {{ document.querySelector('#mDaily').textContent = {json.dumps(t)}; if ({json.dumps(done)}) {{ document.querySelector('#bDaily').classList.add('done'); document.querySelector('#mDailyR').textContent = ''; }} }})()")
        bad = await pg.evaluate(FIT)
        if bad: errs.append(f'{tag} long line {t!r}: ' + '; '.join(bad[:3]))
    if up:   # upright: the sideways hint and the menu still fit, the line sits under the name
        await shot(pg, tag, '0_menu_longline', errs)
    await clk('#bDaily'); await pg.wait_for_timeout(500)
    await shot(pg, tag, '1_sheet', errs, (SHEET, '#scrDaily .sheet'))
    await clk('#dlyGo')
    await end_match(pg, True)
    await shot(pg, tag, '2_results', errs, (SHEET, '#resSheet'))
    if '3-day streak' not in await txt(pg, '#rChips'): errs.append(f"{tag}: results chips line {await txt(pg, '#rChips')!r}")
    await clk('#rAgain'); await pg.wait_for_timeout(600)
    await shot(pg, tag, '3_menu_after', errs, (FIT,))
    if up:   # a 360-wide phone: the pill with the streak, big chips and cups still fits
        await pg.set_viewport_size({'width': 360, 'height': 780}); await pg.wait_for_timeout(500)
        await shot(pg, tag, '3_menu_after_360', errs, (FIT,))
    if await txt(pg, '#mDaily') != 'Won · 3-day streak · next in 14 h': errs.append(f"{tag}: menu after {await txt(pg, '#mDaily')!r}")
    if await txt(pg, '#mStreak') != '3': errs.append(f"{tag}: pill streak {await txt(pg, '#mStreak')!r}")
    await ctx.close()

async def main():
    errs = []
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    tags = ONLY or ['flow', 's667', 'p844', 'd1280', 'up390']
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for t in tags:
            print('running', t, flush=True)
            try:
                if t == 'flow': await flow(b, errs)
                else: await sizes(b, t, errs)
            except Exception as e:
                errs.append(f'{t}: {type(e).__name__}: {str(e)[:300]}')
        await b.close()
    for e in errs: print('PROBLEM', e)
    print('no errors' if not errs else f'{len(errs)} problems')
asyncio.run(main())
