# The Pommes Shop (ui/pshop.js, css/93-pshop.css) and the Pommes pill on the start page (#mPommes, ui/acct.js). UI only: there is no server here, so
# like pwshop.py the test says what the server said: window.__blAcct.st.code (a sync code exists), window.__blKo.st (kopages.js: the balance, the items owned,
# ads, buy, busy, why), and window.__blAdFake ("view") for the ad tile. For the buy and the ad claim it puts a stand-in for net-ws.js's __blQuick on the page
# (it records what is sent: pmb, pma) and answers by changing the state, as kopages.js koMsg would. At 667x320, 844x390, 1280x760 and 390x844 (upright, is_mobile):
#  - the start page's pill shows the balance ("0" dim without a sync code), fits in the top bar (menuFit) even with seven digits, and a tap opens the sheet;
#  - the sheet never scrolls (scrollHeight <= clientHeight, nothing sideways) and nothing runs out of its card or tile: for every fighter, in a state with
#    nothing owned (BUY armed) and in one with pages in the mix and a skin worn; no cut-off name, line, price or button;
#  - a tap on another fighter in the strip changes the cards (names, words, skins, the ring and the name under him) and the figures are drawn;
#  - a finisher card: owned USE / PLAYS with the gold badge, Classic always there, the pick is one of Classic / page 1 / page 2 / SHUFFLE (IN MIX on the owned
#    pages while Shuffle plays), Shuffle only with two owned pages (else a shake and a toast); locked and affordable BUY arms ("Sure?" for 3 s) and the second tap
#    sends pmb (KO.busy, "…"), the server's answer makes the card yours and the pick (a burst of fries); short of Pommes the card shakes, the toast says
#    how many more and the ad tile pulses, nothing is sent; a page that is not drawn yet reads SOON;
#  - a skin card: BUY arms like a page, owned reads WEAR, a tap wears it (P.pal, saved), WORN with its badge; the figure is drawn live;
#  - Get Pommes: no sync code = one make-a-code tile (a tap closes the sheet and opens Account > Profile), the pill and the header say 0 dim, BUY dim;
#    ads off = SOON; ads on = "3 of 5 today", a tap plays the ad, its reward sends pma, the answer counts 4 of 5; 5 of 5 = "back tomorrow"; a cool-down counts in seconds;
#    the pack tile says SOON until the server says buy;
#  - WATCH (844x390 plays them; the others check the buttons): Classic, page 1 and page 2 play on the dummy (FIN.alt 0 / 1 / 2) and the sheet comes back
#    on that fighter; away from the menu it says so; Escape and the X close the sheet.
# A build whose fighters do not all have their second page yet (MANGA[id].alt2) is tested with a copy of the page in which page 2 is page 1 again.
# Prints "pshop ok" (or the problems). Shots in <outdir> (default pshop): <size>_menu, <size>_pshop (Reaper, 85 Pommes, page 1 in play), _armed, _nocode, _mix.
#   python3 pwpshop.py [outdir [tag ...]]   tags: s667 p844 d1280 up390
import asyncio, sys, json, pathlib
BUILD = pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'pshop'
ONLY = sys.argv[2:]
pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = 'potatobrawl.profile.v1'
IDS = ['phoenix', 'alchemist', 'odin', 'wizard', 'samurai', 'dragon', 'gunslinger', 'reaper']
NAMES = {'phoenix': ('Well Done', 'New Potatoes'), 'alchemist': ('Mashed', "Philosopher's Spud"), 'odin': ('Frozen Fries', 'Smash Landing'), 'wizard': ('Crisp-tal Ball', 'Hocus Croquettes'),
         'samurai': ('Hasselback', 'Snake Eyes'), 'dragon': ('Jacket Potato', 'Air Fryer'), 'gunslinger': ('Tater Tots', 'Loaded'), 'reaper': ('Rest in Peel', 'Gravy Digger')}
P0 = {'tokens': 1500, 'rating': 1080, 'peak': 1080, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True, 'last': 'phoenix', 'name': 'Potato 74', 'owned': {'phoenix': [0, 1, 2]}, 'pal': {'phoenix': 2}}
errs = []

def need(ok, msg):
    if not ok: errs.append(msg)
    return ok

async def new_page(b, tag, url, vp, up):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, timezone_id='Europe/Berlin', locale='en-US')
    p = dict(P0)
    if up: p['screen'] = 'up'
    await ctx.add_init_script("if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, json.dumps(json.dumps(p))))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' or (m.type == 'warning' and m.text.startswith('WATCH failed')) else None)
    await pg.goto(url); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(900)
    return ctx, pg, mob

async def prof(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)
async def txt(pg, sel): return ' '.join(((await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{}}).textContent || ''")) or '').split())
async def cls(pg, sel): return await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{ className: '' }}).className.split(' ')")
async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; }})()")
async def fast(pg, sel): await pg.evaluate("(s) => document.querySelector(s).click()", sel)

# ----- what the page must look like -----
# the sheet: on the screen, never scrolling, every card and tile whole (no cut-off or overflowing text, nothing out of its card), cards apart, the strip and header whole
FIT = """(() => {
  const bad = [], sh = document.getElementById('psSheet'), r = sh.getBoundingClientRect(), id = (document.querySelector('.ps-f.on') || { dataset: {} }).dataset.id;
  if (r.top < -0.5 || r.left < -0.5 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5) bad.push('the sheet runs off the screen');
  if (sh.scrollHeight > sh.clientHeight) bad.push('the sheet scrolls: ' + sh.scrollHeight + ' > ' + sh.clientHeight);
  if (sh.scrollWidth > sh.clientWidth + 1) bad.push('the sheet scrolls sideways');
  const body = sh.querySelector('.ps-body'); if (body.scrollHeight > body.clientHeight + 1) bad.push('the body is cut: ' + body.scrollHeight + ' > ' + body.clientHeight);
  const bal = document.getElementById('psBal'); if (bal.scrollWidth > bal.clientWidth + 1) bad.push('the balance is cut');
  const xr = document.getElementById('psClose').getBoundingClientRect(), br = bal.getBoundingClientRect(), ht = sh.querySelector('h3').getBoundingClientRect();
  if (br.left < ht.right - 1 && ht.right > br.left + 2 && sh.querySelector('h3').scrollWidth > sh.querySelector('h3').clientWidth + 1) bad.push('the title is cut by the balance');
  if (br.right > xr.left + 1 || xr.right > r.right + 1) bad.push('the balance and the X overlap');
  const cards = [...sh.querySelectorAll('.ps-c, .ps-tile')].filter((c) => c.getClientRects().length);
  for (const c of cards) {
    const cr = c.getBoundingClientRect(), nm = (c.querySelector('.ps-nm, .ps-tx b') || { textContent: '?' }).textContent;
    if (cr.left < r.left || cr.right > r.right || cr.top < r.top || cr.bottom > r.bottom) bad.push(id + ' ' + nm + ': the card is out of the sheet');
    if (cr.width < 40 || cr.height < 28) bad.push(id + ' ' + nm + ': the card is tiny ' + Math.round(cr.width) + 'x' + Math.round(cr.height));
    for (const e of c.querySelectorAll('.ps-nm, .ps-ln, .ps-pr, .ps-btn, .ps-tx b, .ps-tx small, .ps-tn, .ps-tu, .ps-mkb, .ps-badge, .ps-tag')) {
      if (!e.getClientRects().length || e.closest('[hidden]')) continue;
      if (e.scrollWidth > e.clientWidth + 1) bad.push(id + ' ' + nm + ': cut off "' + e.textContent + '" (' + e.className + ')');
      if (e.scrollHeight > e.clientHeight + 2 && !e.classList.contains('ps-badge')) bad.push(id + ' ' + nm + ': cut off vertically "' + e.textContent + '" (' + e.className + ')');
      const q = e.getBoundingClientRect();
      if (q.left < cr.left - 4 || q.right > cr.right + 4 || q.top < cr.top - 4 || q.bottom > cr.bottom + 4) bad.push(id + ' ' + nm + ': "' + e.textContent + '" runs out of its card');
    }
    for (const e of c.querySelectorAll('.ps-tx')) {   // a tile's wrapped text sits inside its border, with air above and below
      const q = e.getBoundingClientRect();
      if (e.getClientRects().length && (q.top < cr.top + 3 || q.bottom > cr.bottom - 3)) bad.push(id + ' ' + nm + ': the text of the tile touches its border (' + Math.round(q.top - cr.top) + ', ' + Math.round(cr.bottom - q.bottom) + ')');
    }
    const kids = [...c.querySelectorAll('.ps-nm, .ps-ln, .ps-pr, .ps-btn, .ps-tx, .ps-tv, .ps-ti, .ps-mkb, .ps-soon')].filter((e) => e.getClientRects().length && !e.closest('[hidden]'));
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      if (kids[i].contains(kids[j]) || kids[j].contains(kids[i])) continue;
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && a.width > 1 && b.width > 1 && a.height > 1 && b.height > 1) bad.push(id + ' ' + nm + ': "' + kids[i].textContent + '" overlaps "' + kids[j].textContent + '"');
    }
  }
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i].getBoundingClientRect(), b = cards[j].getBoundingClientRect();
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(id + ': two cards overlap');
  }
  const f = [...sh.querySelectorAll('.ps-f')].map((e) => e.getBoundingClientRect());
  for (const q of f) if (q.left < r.left || q.right > r.right || q.width < 20) bad.push('a fighter in the strip is off the sheet or tiny');
  const on = sh.querySelector('.ps-f.on .ps-fn'); if (!on || on.scrollWidth > on.clientWidth + 1 || on.getBoundingClientRect().right > r.right || on.getBoundingClientRect().left < r.left) bad.push('the name under the chosen fighter is cut');
  return bad;
})()"""
# the start page's top bar: the pill whole, nothing cut off or past the screen or the title (menuFit shrinks the plate)
MENU = """(() => {
  const bad = [], me = document.getElementById('mRank'), bar = me.closest('.mm-bar'), top = me.parentNode, pm = document.getElementById('mPommes'), pr = pm.getBoundingClientRect(), rg = document.createRange();
  rg.selectNodeContents(document.querySelector('#scrMenu h1'));
  const h1 = rg.getBoundingClientRect(), L = document.getElementById('app').classList.contains('portrait');
  if (!pm.getClientRects().length) return ['no Pommes pill'];
  if (me.scrollWidth > me.clientWidth + 1) bad.push('the plate button is cut off');
  if (bar.scrollWidth > bar.clientWidth + 1 || top.scrollWidth > top.clientWidth + 1) bad.push('the top bar is crowded');
  if (pm.scrollWidth > pm.clientWidth + 1) bad.push('the pill cuts its number');
  if (pr.left < -0.5 || pr.right > innerWidth + 0.5) bad.push('the pill runs off the screen');
  if (!L && pr.left < h1.right - 1 && pr.bottom > h1.top + 1 && pr.top < h1.bottom - 1) bad.push('the pill overlaps the title');
  for (const e of me.querySelectorAll('.who b, .who small')) if (e.scrollWidth > e.clientWidth + 1) bad.push('the plate cuts "' + e.textContent + '"');
  const t = document.getElementById('mTokens').getBoundingClientRect(), s = document.getElementById('mStreak').getBoundingClientRect();
  if (t.right > pr.left + 1 || pr.right > s.left + 1) bad.push('the pill overlaps the chips or the flame');
  const cs = getComputedStyle(pm), ct = getComputedStyle(document.getElementById('mTokens'));
  if (cs.height !== ct.height || cs.borderTopLeftRadius !== ct.borderTopLeftRadius) bad.push('the pill is not the chips pill\\'s height and radius: ' + cs.height + ' / ' + ct.height);
  return bad;
})()"""
# a figure's canvas is drawn (some opaque pixels)
INKED = """[...document.querySelectorAll('#psSk canvas')].map((c) => { if (!c.width || !c.height) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 20) n++; return n; })"""

# the stand-in for net-ws.js's __blQuick: records what is sent, says it is connected and signed in (QM is read through __blastline.qm)
FAKEQ = "(() => { window.__sent = []; window.__blQuick = { send(m) { window.__sent.push(m); return true; }, on() {}, onConnection() {}, connected: () => true }; const q = window.__blastline.qm; q.conn = true; q.authed = true; q.authCode = 'TESTCODE'; })()"
NOFAKEQ = "(() => { delete window.__blQuick; const q = window.__blastline.qm; q.conn = false; q.authed = false; })()"
# the signed-in state as the server would have said it; o: what differs. items: "ko:reaper", "ko2:reaper", "sk1:dragon" ...
SIGN = """(o) => { window.__blAcct.st.code = 'TESTCODE'; const k = window.__blKo.st, items = o.items || [];
  Object.assign(k, { code: 'TESTCODE', bal: 515, items, own: items.filter((i) => i.startsWith('ko:')).map((i) => i.slice(3)), pick: {}, off: {}, buy: false, ads: false, adN: 0, adMax: 5, adIn: 0, adT: 0, busy: '', why: '' }, o);
  window.__blKo.refresh(); }"""
SIGNOUT = "() => { window.__blAcct.st.code = ''; const k = window.__blKo.st; Object.assign(k, { code: '', bal: 0, items: [], own: [], pick: {}, off: {}, busy: '', why: '' }); window.__blKo.refresh(); }"

# a card by its slot: c0 Classic, p1, p2, sh Shuffle (finishers), k1, k2 (skins), in the order of the row
def fc(i): return f'#psFin .ps-c:nth-child({i + 1})'
def kc(i): return f'#psSk .ps-c:nth-child({i + 1})'
async def states(pg):
    return await pg.evaluate("""() => [...document.querySelectorAll('#psFin .ps-c, #psSk .ps-c')].map((c) => ({ nm: c.querySelector('.ps-nm').textContent, cls: c.className.split(' ').filter((x) => x !== 'ps-c'), btn: c.querySelector('.ps-btn').textContent.trim(), pr: c.querySelector('.ps-pr').textContent.trim().replace(/\\s+/g, ' '), badge: c.querySelector('.ps-badge').textContent.trim() }))""")

async def pshop_size(b, tag, url, has2):
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    ctx, pg, mob = await new_page(b, tag, url, vp, up)
    clk = pg.tap if mob else pg.click
    async def sign(**o): await pg.evaluate(SIGN, o); await pg.wait_for_timeout(120)
    async def opened(fid=None):
        await pg.evaluate("(id) => window.__blPshop.open(id)", fid); await pg.wait_for_timeout(420)
    async def fit(name, extra=''):
        bad = await pg.evaluate(FIT)
        if bad: errs.append(f'{tag} {name}{extra}: ' + '; '.join(bad[:6]))
    async def toast(): return await txt(pg, '#psToast') if await shown(pg, '#psToast') else ''
    async def sent(t): return await pg.evaluate("(t) => window.__sent.filter((m) => m.t === t)", t)
    async def shot(name): await pg.screenshot(path=f'{OUT}/{tag}_{name}.png')
    async def choose(fid):
        await clk(f'.ps-f[data-id="{fid}"]'); await pg.wait_for_timeout(150)
    # ----- the pill on the start page: 0 dim without a sync code, the balance with one; it fits, even with seven digits (1.2M)
    need(await shown(pg, '#mPommes') and await txt(pg, '#mPommes') == '0' and 'zero' in await cls(pg, '#mPommes'), f"{tag}: the pill signed out: {await txt(pg, '#mPommes')!r} {await cls(pg, '#mPommes')}")
    bad = await pg.evaluate(MENU)
    if bad: errs.append(f'{tag} menu signed out: ' + '; '.join(bad))
    await sign(bal=85, items=['ko:reaper'])
    need(await txt(pg, '#mPommes') == '85' and 'zero' not in await cls(pg, '#mPommes'), f"{tag}: the pill says {await txt(pg, '#mPommes')!r}")
    need('85 Pommes' in (await pg.get_attribute('#mRank', 'aria-label') or ''), f"{tag}: the pill's label does not say the Pommes")
    await shot('menu')
    bad = await pg.evaluate(MENU)
    if bad: errs.append(f'{tag} menu: ' + '; '.join(bad))
    for bal, say in ((99999, '99,999'), (123456, '123k'), (1234567, '1.2M')):   # up to 99,999 whole, then 123k, 1.2M (the sheet says it whole)
        await sign(bal=bal, items=['ko:reaper']); await pg.wait_for_timeout(150)
        need(await txt(pg, '#mPommes') == say, f"{tag}: the pill with {bal} says {await txt(pg, '#mPommes')!r}")
        bad = await pg.evaluate(MENU)
        if bad: errs.append(f'{tag} menu with {bal}: ' + '; '.join(bad))
    await sign(bal=85, items=['ko:reaper'])
    # the chip coin and the plate still open the Account sheet, not this one
    await clk('#mTokens'); await pg.wait_for_timeout(500)
    need(await shown(pg, '#scrAccount') and not await shown(pg, '#scrPshop'), f'{tag}: the chip coin does not open the Account Shop')
    await clk('#acClose'); await pg.wait_for_timeout(450)
    # ----- a tap on the pill opens the sheet on your fighter (the one picked last: Phoenix)
    await clk('#mPommes'); await pg.wait_for_timeout(500)
    need(await shown(pg, '#scrPshop') and not await shown(pg, '#scrAccount'), f'{tag}: the pill does not open the Pommes Shop')
    need(await pg.evaluate("window.__blPshop.st.id") == 'phoenix' and 'on' in await cls(pg, '.ps-f[data-id="phoenix"]'), f"{tag}: the sheet opens on {await pg.evaluate('window.__blPshop.st.id')}")
    need(await txt(pg, '#psBal') == '85 Pommes' and await txt(pg, '#psTitle') == 'Pommes Shop', f"{tag}: header {await txt(pg, '#psBal')!r} {await txt(pg, '#psTitle')!r}")
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    need(not await shown(pg, '#scrPshop'), f'{tag}: Escape does not close the sheet')
    await opened('reaper')
    await clk('#psClose'); await pg.wait_for_timeout(300)
    need(not await shown(pg, '#scrPshop') and await shown(pg, '#scrMenu'), f'{tag}: the X does not close the sheet')
    # ----- the Reaper: 85 Pommes, page 1 owned and in play; the look of every state
    await opened('reaper')
    st = await states(pg)
    need(len(st) == 6, f'{tag}: {len(st)} cards')
    need([s['nm'] for s in st][:3] == ['Classic'] + list(NAMES['reaper']) and st[4]['nm'] == 'Ink Noir' and st[5]['nm'] == 'Starfall', f"{tag}: names {[s['nm'] for s in st]}")
    need('on' in st[1]['cls'] and st[1]['btn'] == 'Plays ✓' and st[1]['badge'] == 'Plays' and st[1]['pr'] == 'Owned', f'{tag}: page 1 in play: {st[1]}')
    need('own' in st[0]['cls'] and st[0]['btn'] == 'Use' and st[0]['pr'] == 'Free' and not st[0]['badge'], f'{tag}: Classic: {st[0]}')
    need(('short' in st[2]['cls'] and st[2]['btn'] == 'Buy' and st[2]['pr'].endswith('300 · €2.99')) if has2['reaper'] else ('soon' in st[2]['cls'] and st[2]['btn'] == 'Soon'), f'{tag}: page 2: {st[2]}')
    need('off' in st[3]['cls'] and st[3]['pr'] != '' and 'on' not in st[3]['cls'], f'{tag}: Shuffle with one page: {st[3]}')
    need(all('short' in s['cls'] and s['btn'] == 'Buy' and s['pr'].endswith('300 · €2.99') for s in st[4:]), f'{tag}: skins {st[4:]}')
    need(not any('tokglyph' in h or 'pmglyph' in h for h in await pg.evaluate("[...document.querySelectorAll('#scrPshop .ps-pr, #scrPshop .ps-bal')].map((e) => e.innerHTML)")), f'{tag}: a coin glyph on a Pommes price')
    need(await pg.evaluate("[...document.querySelectorAll('#psFin .ps-c .ps-go')].map((b) => b.disabled)") == [False, False, not has2['reaper']], f'{tag}: WATCH buttons')
    await pg.wait_for_timeout(300)
    ink = await pg.evaluate(INKED)
    need(len(ink) == 2 and all(n > 12 for n in ink), f'{tag}: the skin figures are not drawn {ink}')
    await fit('reaper')
    await shot('pshop')
    # the ad tile with ads off: SOON, dashed, dim; the pack tile SOON
    need('soon' in await cls(pg, '.ps-ad') and await shown(pg, '.ps-ad .ps-soon') and await shown(pg, '.ps-pk .ps-soon') and await txt(pg, '.ps-ad small') == 'ads come soon', f"{tag}: ads off: {await cls(pg, '.ps-ad')} {await txt(pg, '.ps-ad small')!r}")
    pk = ' '.join((await pg.evaluate("document.querySelector('.ps-pk').innerText")).lower().split())
    need(pk in ('300 pommes one page or skin €2.99 soon', '300 pommes one page or skin soon €2.99'), f'{tag}: pack tile {pk!r}')
    # ----- short of Pommes: BUY dim; a tap shakes the card, the toast says how many more, the ad tile pulses, nothing is sent
    await pg.evaluate(FAKEQ)
    await choose('dragon')
    need(await pg.evaluate("window.__blPshop.st.id") == 'dragon' and 'on' in await cls(pg, '.ps-f[data-id="dragon"]') and 'on' not in await cls(pg, '.ps-f[data-id="reaper"]'), f'{tag}: the strip does not move to the Dragon')
    st = await states(pg)
    need([s['nm'] for s in st][:3] == ['Classic'] + list(NAMES['dragon']) and 'short' in st[1]['cls'] and 'own' in st[0]['cls'] and not any('on' in s['cls'] for s in st[1:]), f"{tag}: the Dragon's cards {[s['nm'] for s in st]} {st[1]}")
    need(await pg.evaluate("[...document.querySelectorAll('#psFin .ps-word')].map((e) => e.textContent).join(' ')") == 'KO FWOOM WHIRRR', f"{tag}: sound words {await pg.evaluate('[...document.querySelectorAll(\"#psFin .ps-word\")].map((e) => e.textContent).join(\" \")')}")
    await sign(bal=85, items=['ko:reaper'])
    await choose('dragon')
    await clk(fc(1) + ' .ps-main'); await pg.wait_for_timeout(100)
    need('shake' in await cls(pg, fc(1)) and await toast() == '215 more Pommes' and 'arm' not in await cls(pg, fc(1)) and await sent('pmb') == [], f"{tag}: short: {await cls(pg, fc(1))} {await toast()!r} sent {await sent('pmb')}")
    await pg.wait_for_timeout(100)
    need('pulse' in await cls(pg, '.ps-ad'), f'{tag}: short: the ad tile does not pulse')
    await pg.wait_for_timeout(400)
    need('shake' not in await cls(pg, fc(1)), f'{tag}: the shake does not end')
    await fit('dragon short')
    # ----- affordable: BUY arms ("Sure?", red, 3 s), a tap elsewhere keeps the arming, the second tap sends pmb, "…" until the server answers
    await sign(bal=515, items=['ko:reaper'])
    await choose('dragon')
    st = await states(pg)
    need('buy' in st[1]['cls'] and st[1]['btn'] == 'Buy' and 'short' not in st[1]['cls'], f"{tag}: affordable: {st[1]}")
    await clk(fc(1) + ' .ps-main'); await pg.wait_for_function("document.querySelector('#psFin .ps-c:nth-child(2)').classList.contains('arm')", polling=40, timeout=4000)
    st = await states(pg)
    need(st[1]['btn'] == 'Sure?' and await sent('pmb') == [] and (await pg.evaluate("window.__blKo.st.busy")) == '', f'{tag}: the first tap: {st[1]} sent {await sent("pmb")}')
    await fit('dragon armed', ' (Sure?)')
    await shot('armed')
    await pg.wait_for_function("!document.querySelector('#psFin .ps-c:nth-child(2)').classList.contains('arm')", polling=100, timeout=6000)   # 3 s later it is back to BUY
    need((await states(pg))[1]['btn'] == 'Buy', f'{tag}: the arming does not end')
    await clk(fc(1) + ' .ps-main'); await pg.wait_for_function("document.querySelector('#psFin .ps-c:nth-child(2)').classList.contains('arm')", polling=40, timeout=4000)
    await fast(pg, fc(1) + ' .ps-main'); await pg.wait_for_timeout(150)
    need(await sent('pmb') == [{'t': 'pmb', 'item': 'ko:dragon'}] and (await pg.evaluate("window.__blKo.st.busy")) == 'ko:dragon' and (await states(pg))[1]['btn'] == '…' and 'busy' in await cls(pg, fc(1)), f"{tag}: the second tap: sent {await sent('pmb')} busy {await pg.evaluate('window.__blKo.st.busy')!r}")
    await fast(pg, fc(2) + ' .ps-main'); await pg.wait_for_timeout(100)
    need(len(await sent('pmb')) == 1, f'{tag}: a tap while the server thinks sends another buy')
    # the server's answer (kopages.js koMsg): the item, the new balance, and the page you bought is the pick
    await pg.evaluate("() => { const k = window.__blKo.st; k.items = ['ko:reaper', 'ko:dragon']; k.own = ['reaper', 'dragon']; k.bal = 215; k.busy = ''; k.why = ''; window.__blKo.setPick('dragon', 1); }")
    await pg.wait_for_timeout(60)
    need(await pg.evaluate("document.querySelectorAll('#psFin .ps-fry').length") > 5, f'{tag}: no burst of fries on a bought card')
    st = await states(pg)
    need('on' in st[1]['cls'] and st[1]['btn'] == 'Plays ✓' and st[1]['pr'] == 'Owned' and st[1]['badge'] == 'Plays' and 'on' not in st[0]['cls'], f'{tag}: bought and in play: {st[1]}')
    need(await txt(pg, '#psBal') == '215 Pommes' and await txt(pg, '#mPommes') == '215', f"{tag}: balance {await txt(pg, '#psBal')!r} pill {await txt(pg, '#mPommes')!r}")
    await pg.wait_for_timeout(900)
    need(await pg.evaluate("document.querySelectorAll('.ps-fry').length") == 0, f'{tag}: the fries stay')
    # a no from the server is said once
    await pg.evaluate("() => { const k = window.__blKo.st; k.why = 'fail'; window.__blKo.refresh(); }")
    need(await toast() == "That didn't go through: try again.", f'{tag}: the server says fail: {await toast()!r}')
    # ----- the picker: Classic, page 1, page 2, Shuffle; one of them plays
    async def plays():
        st = await states(pg); return [i for i, s in enumerate(st[:4]) if 'on' in s['cls']]
    both = ['ko:reaper', 'ko2:reaper'] if has2['reaper'] else ['ko:reaper']
    await sign(bal=15, items=both)
    await choose('reaper')
    need(await plays() == [1], f'{tag}: the first owned page plays by default: {await plays()}')
    await clk(fc(0) + ' .ps-main'); await pg.wait_for_timeout(150)
    st = await states(pg)
    need(await plays() == [0] and st[0]['btn'] == 'Plays ✓' and st[0]['badge'] == 'Plays' and st[1]['btn'] == 'Use' and (await pg.evaluate("window.__blKo.pick('reaper')")) == 0, f'{tag}: Classic plays: {st[:2]}')
    await clk(fc(1) + ' .ps-main'); await pg.wait_for_timeout(150)
    need(await plays() == [1] and (await pg.evaluate("window.__blKo.pick('reaper')")) == 1, f'{tag}: page 1 plays again: {await plays()}')
    if has2['reaper']:
        await clk(fc(2) + ' .ps-main'); await pg.wait_for_timeout(150)
        st = await states(pg)
        need(await plays() == [2] and st[2]['badge'] == 'Plays' and (await pg.evaluate("window.__blKo.pick('reaper')")) == 2, f'{tag}: page 2 plays: {await plays()}')
        need('own' in st[3]['cls'] and 'off' not in st[3]['cls'], f'{tag}: Shuffle with two pages is not on offer: {st[3]}')
        await clk(fc(3) + ' .ps-main'); await pg.wait_for_timeout(150)
        st = await states(pg)
        need(await plays() == [3] and (await pg.evaluate("window.__blKo.pick('reaper')")) == 's' and st[3]['badge'] == 'Plays', f'{tag}: Shuffle plays: {await plays()}')
        need(all('mix' in st[i]['cls'] and st[i]['btn'] == 'In the mix' and st[i]['badge'] == 'In mix' for i in (1, 2)) and 'mix' not in st[0]['cls'], f'{tag}: the owned pages are not in the mix: {st[1:3]}')
        await fit('reaper mix')
        await shot('mix')
        await clk(fc(2) + ' .ps-main'); await pg.wait_for_timeout(150)
        need(await plays() == [2], f'{tag}: a page out of the mix: {await plays()}')
        await clk(fc(1) + ' .ps-main'); await pg.wait_for_timeout(100)
    else:
        await shot('mix')
    # Shuffle needs two owned pages: with one (or none) it shakes and says so, the pick stays
    await sign(bal=15, items=['ko:reaper'])
    await choose('reaper'); await pg.evaluate("window.__blKo.setPick('reaper', 1)")
    await clk(fc(3) + ' .ps-main'); await pg.wait_for_timeout(100)
    need('shake' in await cls(pg, fc(3)) and await toast() == 'Shuffle needs two Potatalities.' and await plays() == [1] and (await pg.evaluate("window.__blKo.pick('reaper')")) == 1, f"{tag}: Shuffle with one page: {await toast()!r} {await plays()}")
    await choose('odin')
    await clk(fc(3) + ' .ps-main'); await pg.wait_for_timeout(100)
    need(await toast() == 'Buy a Potatality to shuffle.' and (await pg.evaluate("window.__blKo.pick('odin')")) == 0, f"{tag}: Shuffle with none: {await toast()!r}")
    # ----- skins: BUY arms like a page and sends pmb sk1; owned is WEAR; a tap wears it; the Rack's own state shows it
    await sign(bal=515, items=['ko:reaper'])
    await choose('dragon')
    await clk(kc(0) + ' .ps-main'); await pg.wait_for_function("document.querySelector('#psSk .ps-c:nth-child(1)').classList.contains('arm')", polling=40, timeout=4000)
    need((await states(pg))[4]['btn'] == 'Sure?', f'{tag}: the skin does not arm')
    await fast(pg, kc(0) + ' .ps-main'); await pg.wait_for_timeout(150)
    need((await sent('pmb'))[-1:] == [{'t': 'pmb', 'item': 'sk1:dragon'}], f"{tag}: the skin buy sends {await sent('pmb')}")
    await sign(bal=215, items=['ko:reaper', 'sk1:dragon'])
    await choose('dragon')
    idx = await pg.evaluate("window.__blPshop.skin('dragon', 1)")
    need(idx > 0, f'{tag}: no Pommes skin for the Dragon')
    st = await states(pg)
    need('own' in st[4]['cls'] and st[4]['btn'] == 'Wear' and st[4]['pr'] == 'Owned' and 'short' in st[5]['cls'], f'{tag}: skin owned: {st[4]}')
    await clk(kc(0) + ' .ps-main'); await pg.wait_for_timeout(200)
    st = await states(pg)
    need((await pg.evaluate("window.__blAcct.P.pal.dragon")) == idx and idx in (await pg.evaluate("window.__blAcct.P.owned.dragon")) and (await prof(pg))['pal']['dragon'] == idx, f"{tag}: WEAR does not set P.pal: {await pg.evaluate('window.__blAcct.P.pal.dragon')} want {idx}")
    need('worn' in st[4]['cls'] and st[4]['btn'] == 'Worn ✓' and st[4]['badge'] == 'Worn', f'{tag}: worn: {st[4]}')
    await fit('dragon worn')
    await pg.evaluate(NOFAKEQ)
    # ----- every fighter: the cards whole in a state with BUY armed and in one with pages in the mix and a skin worn
    await pg.evaluate(FAKEQ)
    for fid in IDS:
        await sign(bal=515, items=[])
        await choose(fid)
        await fit(fid + ' fresh')
        await clk(fc(1) + ' .ps-main'); await pg.wait_for_timeout(60)
        await fit(fid + ' armed')
        items = [f'ko:{fid}', f'ko2:{fid}', f'sk1:{fid}', f'sk2:{fid}']
        await sign(bal=1234567, items=items, pick={fid: 's'})
        await choose(fid)
        await pg.evaluate("(id) => { window.__blAcct.P.pal[id] = window.__blPshop.skin(id, 2); window.__blKo.refresh(); }", fid)
        await pg.wait_for_timeout(60)
        await fit(fid + ' owned')
    await pg.evaluate(NOFAKEQ)
    # ----- Get Pommes: the ad tile
    await pg.evaluate("window.__blAdFake = 'view'")
    await pg.evaluate(FAKEQ)
    await sign(bal=85, items=['ko:reaper'], ads=False, adN=3, adMax=5)
    await opened('reaper')
    need('soon' in await cls(pg, '.ps-ad'), f"{tag}: the server has no ads: {await cls(pg, '.ps-ad')}")
    await sign(bal=85, items=['ko:reaper'], ads=True, adN=3, adMax=5)
    await pg.evaluate("window.__blPshop.close(); window.__blPshop.open('reaper')"); await pg.wait_for_timeout(500)
    need('ready' in await cls(pg, '.ps-ad') and await txt(pg, '.ps-ad small') == '3 of 5 today' and not await shown(pg, '.ps-ad .ps-soon'), f"{tag}: ads on: {await cls(pg, '.ps-ad')} {await txt(pg, '.ps-ad small')!r}")
    await fit('ads ready'); await shot('ad')
    await clk('.ps-ad'); await pg.wait_for_timeout(700)
    need(await sent('pma') == [{'t': 'pma'}] and (await pg.evaluate("window.__blKo.st.busy")) == 'ad', f"{tag}: the ad's reward does not ask the server: {await sent('pma')} busy {await pg.evaluate('window.__blKo.st.busy')!r}")
    need('busy' in await cls(pg, '.ps-ad') and await txt(pg, '.ps-ad small') == '…', f"{tag}: the ad tile while the server thinks: {await cls(pg, '.ps-ad')}")
    await pg.evaluate("() => { const k = window.__blKo.st; k.bal = 95; k.adN = 4; k.busy = ''; k.why = ''; window.__blKo.refresh(); }")
    await pg.wait_for_timeout(500)
    need(await txt(pg, '#psBal') == '95 Pommes' and await txt(pg, '.ps-ad small') == '4 of 5 today' and 'ready' in await cls(pg, '.ps-ad'), f"{tag}: after the ad: {await txt(pg, '#psBal')!r} {await txt(pg, '.ps-ad small')!r} {await cls(pg, '.ps-ad')}")
    await pg.evaluate("() => { const k = window.__blKo.st; k.adN = 5; window.__blKo.refresh(); }")
    need('gone' in await cls(pg, '.ps-ad') and await txt(pg, '.ps-ad small') == 'back tomorrow', f"{tag}: all ads used: {await cls(pg, '.ps-ad')} {await txt(pg, '.ps-ad small')!r}")
    await fast(pg, '.ps-ad'); await pg.wait_for_timeout(100)   # (aria-disabled: Playwright will not tap it, a person can)
    need('tomorrow' in await toast(), f'{tag}: a tap on a used-up tile says {await toast()!r}')
    await pg.evaluate("() => { const k = window.__blKo.st; k.adN = 3; k.why = 'wait'; k.adIn = 30; k.adT = Date.now(); window.__blKo.refresh(); }")
    need('wait' in await cls(pg, '.ps-ad') and await txt(pg, '.ps-ad small') in ('in 30s', 'in 29s'), f"{tag}: the cool-down: {await txt(pg, '.ps-ad small')!r}")
    await fit('ads wait')
    # the pack tile when money can buy Pommes: no SOON, a button
    await pg.evaluate("() => { const k = window.__blKo.st; k.why = ''; k.buy = true; window.__blKo.refresh(); }")
    need(not await shown(pg, '.ps-pk .ps-soon') and 'go' in await cls(pg, '.ps-pk') and await pg.get_attribute('.ps-pk', 'role') == 'button', f"{tag}: the pack tile with payments on: {await cls(pg, '.ps-pk')}")
    await pg.evaluate(NOFAKEQ)
    await pg.evaluate("window.__blAdFake = ''")
    await pg.evaluate("window.__blPshop.close()")
    # ----- no sync code: one tile to make a code; BUY dim; USE and WEAR work; the pill and header say 0, dim
    await pg.evaluate(SIGNOUT); await pg.wait_for_timeout(100)
    need(await txt(pg, '#mPommes') == '0' and 'zero' in await cls(pg, '#mPommes'), f"{tag}: the pill with no code: {await txt(pg, '#mPommes')!r}")
    await opened('wizard')
    need(await txt(pg, '#psBal') == '0 Pommes' and 'zero' in await cls(pg, '#psBal'), f"{tag}: header with no code {await txt(pg, '#psBal')!r}")
    need(await shown(pg, '.ps-mk') and not await shown(pg, '.ps-ad') and not await shown(pg, '.ps-pk') and 'make a code' in (await txt(pg, '.ps-mk')).lower() and 'sync code' in await txt(pg, '.ps-mk'), f"{tag}: the make-a-code tile: {await txt(pg, '#psGet')!r}")
    st = await states(pg)
    need(all('nocode' in s['cls'] for s in st[1:3] + st[4:]) or not has2['wizard'], f'{tag}: BUY is not dim: {st}')
    await fit('no code'); await shot('nocode')
    await clk(fc(1) + ' .ps-main'); await pg.wait_for_timeout(100)
    need('sync code' in await toast() and 'shake' in await cls(pg, fc(1)) and 'pulse' in await cls(pg, '.ps-mk'), f"{tag}: BUY with no code says {await toast()!r}")
    await clk(fc(0) + ' .ps-main'); await pg.wait_for_timeout(100)
    need(await plays() == [0], f'{tag}: USE does not work without a code')
    await pg.evaluate("window.__blAcct.P.owned.wizard = [0, window.__blPshop.skin('wizard', 1)]"); await pg.evaluate("window.__blKo.refresh()")
    await clk(kc(0) + ' .ps-main'); await pg.wait_for_timeout(150)
    need(await pg.evaluate("window.__blAcct.P.pal.wizard") == await pg.evaluate("window.__blPshop.skin('wizard', 1)") and 'worn' in await cls(pg, kc(0)), f'{tag}: WEAR does not work without a code')
    await pg.evaluate("window.__blAcct.P.pal.wizard = 0; window.__blAcct.P.owned.wizard = [0]")
    await clk('.ps-mkb'); await pg.wait_for_timeout(600)
    need(not await shown(pg, '#scrPshop') and await shown(pg, '#scrAccount') and await shown(pg, '#acPanP'), f'{tag}: MAKE A CODE does not open Account > Profile')
    await clk('#acClose'); await pg.wait_for_timeout(450)
    await ctx.close()

# ----- WATCH (a page plays on the dummy, then the sheet is back on that fighter) -----
async def watch_size(b, tag, url, has2, full):
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    ctx, pg, mob = await new_page(b, tag, url, vp, up)
    clk = pg.tap if mob else pg.click
    await pg.evaluate(SIGN, {'bal': 515, 'items': ['ko:reaper', 'ko2:reaper'] if has2['reaper'] else ['ko:reaper']})
    await pg.evaluate("window.__blPshop.open('reaper')"); await pg.wait_for_timeout(450)
    # away from the menu (a page is playing) it says so and the sheet stays
    await pg.evaluate("window.__blastline.fin.on = true")
    await clk('#psFin .ps-c:nth-child(2) .ps-go'); await pg.wait_for_timeout(200)
    await pg.evaluate("window.__blastline.fin.on = false")
    need(await txt(pg, '#psToast') == 'Watch works from the menu.' and await shown(pg, '#scrPshop'), f"{tag}: WATCH away from the menu: {await txt(pg, '#psToast')!r}")
    dis = await pg.evaluate("[...document.querySelectorAll('#psFin .ps-go')].map((b) => b.disabled)")
    need(len(dis) == 3 and dis[0] is False and dis[1] is False and dis[2] == (not has2['reaper']), f'{tag}: WATCH buttons disabled: {dis}')
    if not full:
        await ctx.close(); return
    for n in ([0, 1, 2] if has2['reaper'] else [0, 1]):
        await pg.evaluate("window.__blPshop.focus('reaper')")
        await clk(f'#psFin .ps-c:nth-child({n + 1}) .ps-go')
        try: await pg.wait_for_function("window.__blastline.fin.on === true", timeout=8000)
        except Exception:
            errs.append(f'{tag}: WATCH {n} does not play'); continue
        need(await pg.evaluate("window.__blastline.fin.alt") == n, f"{tag}: WATCH {n} plays page {await pg.evaluate('window.__blastline.fin.alt')}")
        need(not await shown(pg, '#scrPshop') and await pg.evaluate("window.__blastline.mode") == 'match', f'{tag}: the sheet stays under the page')
        await pg.wait_for_function("window.__blastline.fin.t > 1300", timeout=15000)
        if n == 1: await pg.screenshot(path=f'{OUT}/{tag}_watch.png')
        await pg.touchscreen.tap(vp[0] // 2, vp[1] // 2) if mob else await pg.mouse.click(vp[0] // 2, vp[1] // 2)   # a tap skips it (once the page is up)
        try: await pg.wait_for_function("window.__blastline.fin.on === false", timeout=20000)
        except Exception: errs.append(f'{tag}: the page {n} did not end')
        try: await pg.wait_for_function("document.getElementById('scrPshop') && !document.getElementById('scrPshop').hidden", timeout=6000)
        except Exception: errs.append(f'{tag}: not back on the Pommes Shop after WATCH {n}')
        await pg.wait_for_timeout(500)
        need(await shown(pg, '#scrPshop') and await pg.evaluate("window.__blPshop.st.id") == 'reaper' and await pg.evaluate("window.__blastline.mode") == 'menu' and await txt(pg, '#psBal') == '515 Pommes', f"{tag}: back from WATCH {n}: {await pg.evaluate('window.__blPshop.st.id')} {await pg.evaluate('window.__blastline.mode')}")
        bad = await pg.evaluate(FIT)
        if bad: errs.append(f'{tag} back from WATCH {n}: ' + '; '.join(bad[:4]))
    await ctx.close()

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS)
        # which fighters have their second page in this build? (the real one; else a copy of the page where page 2 is page 1 again)
        ctx, pg, _ = await new_page(b, 'probe', BUILD.as_uri(), (844, 390), False)
        has2 = await pg.evaluate("Object.fromEntries(" + json.dumps(IDS) + ".map((id) => [id, window.__blPshop.has(id, 2)]))")
        await ctx.close()
        url = BUILD.as_uri()
        if not all(has2.values()):
            html = BUILD.read_text()
            marker = 'window.__blKo = {'
            assert html.count(marker) == 1
            patched = pathlib.Path(OUT) / 'pshop_test_page.html'
            patched.write_text(html.replace(marker, 'for (const id in KO_PAGES) if (MANGA[id] && MANGA[id].alt && !MANGA[id].alt2) MANGA[id].alt2 = MANGA[id].alt;\n' + marker, 1))
            url = patched.resolve().as_uri()
            has2 = {k: True for k in has2}
            print('note: not every fighter has page 2 in this build; testing with page 2 = page 1')
        for tag in (ONLY or list(SIZES)):
            await pshop_size(b, tag, url, has2)
            await watch_size(b, tag, url, has2, tag == 'p844')
        await b.close()
    if errs:
        print('\n'.join(errs)); sys.exit(1)
    print('pshop ok')

asyncio.run(main())
