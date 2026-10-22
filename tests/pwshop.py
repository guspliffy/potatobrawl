# The Shop (ui/shop.js, css/93-shop.css) and Another go on the Daily sheet (ui/daily.js). UI only. At 667x320, 844x390, 1280x760 and 390x844:
#  - the Shop is the Account sheet's fourth tab: it opens from the tab, from a tap on the chip coin on the start page (the rest of the pill still
#    opens the Profile) and with the arrow keys; the balance, the line about where chips come from, eight nameplate cards, eight Glaze cards;
#  - a nameplate takes two taps (the first arms it, "Sure?", for 3 s), costs its price, is worn at once and changes the plate on the start page
#    and the name field of the Profile; a plate you own is worn with one tap (Ink too) and costs nothing;
#  - Glaze takes two taps and 400 chips, P.glazed gets the worn skin, the card turns "Glazed", its model is drawn; a second tap does nothing;
#  - short of chips nothing is bought, nothing is armed, and the line at the top says how many chips are missing;
#  - nothing runs past the sheet or its cards sideways, no name or price is cut off, the start-page pill keeps the whole name on every plate;
#  - the Daily sheet after a loss offers "Another go" for 50 chips (two taps, 3 s to confirm), the results show the plate you wear;
#  - (844x390 only, with the page's clock moved) the rules: Another go is offered after a finished loss or a draw, once a day, not after a win,
#    a forfeit, a quit or a reload mid-match; it starts the same match again, its win continues the streak as if the first try had been won
#    (+40, 4 days from 3), a draw pays 15 and a loss 5 instead of today's result; short of chips it says so and takes nothing.
#  - the Pommes (ui/kopages.js has the state; there is no server here, so the test sets it: window.__blAcct.st.code, window.__blKo.st): the KO PAGES section is gone
#    (no KO cards, no pack row, no kicker); the last row "Pommes Shop" (the cone, the balance, "0" dim signed out, a chevron) and the Pommes pill at the top (a button)
#    both open #scrPshop (on the fighter of the select) and closing it brings the Shop tab back; the pill and the row follow the balance (300, 12,345, 100);
#  - Free chips (window.__blAdFake, set before the page loads; ui/ads.js): without it exactly the SOON row; with "view" the row waits, reads "+25 chips · 0 of 3 today", a tap
#    pays 25 chips once per watch (1 of 3, 2 of 3), the third leaves "back tomorrow" (dim, not a button, a tap pays nothing), the next day starts at 0 of 3; "skip" pays and counts
#    nothing and asks again; "none" says "No ad right now"; the Pommes Shop's own ad replaces ours and closing it asks for ours again (844x390);
#  - the results' band "Potatality · in the Pommes Shop" (hidden after a normal result; set through window.__blShop.resKo because a lost match with a CPU's page is a
#    one-in-four chance on a fighter that has one) sits inside the results without pushing a button off the screen, and its tap opens the Pommes Shop on that fighter.
# Prints "shop ok" and "no errors" (or the problems). Shots in <outdir> (default shop). The page's clock is moved with a Date stand-in as pwdaily.py does.
#   (the Pommes and ad shots: <size>_11_pommes, _12_pommes_in, _12_pommes_big, _20_ad_ready, _21_ad_done, ads_none_22_ad_none, results _10b_results_ko, _14_ko_from_results)
#   python3 pwshop.py [outdir [tag ...]]   tags: s667 p844 d1280 up390 (the Shop and the Daily sheet at that size) rules (844x390, the Daily rules)
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'shop'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
SIZES = {'s667': (667, 320, False), 'p844': (844, 390, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = 'potatobrawl.profile.v1'
G = 'window.__blastline.game'
D = 'window.__blDaily'
TZ = 'Europe/Berlin'
def at(day, hm='10:00'): return f'2026-10-{day:02d}T{hm}:00+02:00'   # October 2026 in Berlin is CEST; the 12th is a Monday
errs = []

def need(ok, msg):
    if not ok: errs.append(msg)
    return ok

CLOCK = """(() => {
  const RD = Date; let off = 0;
  const set = (iso) => { off = iso ? RD.parse(iso) - RD.now() : 0; };
  try { set(localStorage.getItem('pwshop.at')); } catch (e) {}
  class D extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
  window.Date = D; window.__pwNow = set;
})();"""
# a reload brings the page back to the profile it saved (see pwdaily.py: Playwright's in-memory storage can lag behind a reload)
KEEP = "try { if (window.name.indexOf('pwkeep:') === 0) { const s = JSON.parse(window.name.slice(7)); window.name = ''; for (const k in s) localStorage.setItem(k, s[k]); } } catch (e) {}\n"
async def reload(pg):
    await pg.evaluate("window.name = 'pwkeep:' + JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))")
    await pg.reload()

async def new_page(b, tag, vp, up, prof, when, fake=''):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, timezone_id=TZ, locale='en-US')
    if fake: await ctx.add_init_script(f"window.__blAdFake = {json.dumps(fake)};")   # ui/ads.js: the test ad ("view", "skip", "none"), before the page loads
    p = dict(prof)
    if up: p['screen'] = 'up'
    await ctx.add_init_script(KEEP + "if (localStorage.getItem('%s') === null) { localStorage.setItem('%s', %s); localStorage.setItem('pwshop.at', %s); }"
                              % (PROF, PROF, json.dumps(json.dumps(p)), json.dumps(when)))
    await ctx.add_init_script(CLOCK)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' or (m.type == 'warning' and m.text.startswith('WATCH failed')) else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(800)
    return ctx, pg, mob

async def prof(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)
async def txt(pg, sel): return ' '.join(((await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{}}).textContent || ''")) or '').split())
async def cls(pg, sel): return await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{ className: '' }}).className.split(' ')")
async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; }})()")
async def armed(pg, sel, c):
    """Wait until the button wears its armed class."""
    await pg.wait_for_function("(a) => document.querySelector(a[0]).classList.contains(a[1])", arg=[sel, c], polling=40, timeout=4000)
# The page is heavy on a slow machine: a tap or a screenshot can take longer than the 3 s an armed button waits for its second tap.
# So the first tap is a real touch, the second a click sent at once (and a button that timed out meanwhile is armed again first).
async def fast(pg, sel): await pg.evaluate("(s) => document.querySelector(s).click()", sel)
async def two(pg, clk, sel, c='arm', after=300):
    if c not in await cls(pg, sel):
        await clk(sel); await armed(pg, sel, c)
    await fast(pg, sel); await pg.wait_for_timeout(after)
async def set_prof(pg, **kw):
    """Change the profile in the page (and what it has saved)."""
    await pg.evaluate("(kw) => { const P = window.__blAcct.P; Object.assign(P, kw); window.__blAcct.save(); }", kw)

async def reload_at(pg, when, daily=None, **kw):
    js = "localStorage.setItem('pwshop.at', %s);" % json.dumps(when)
    patch = dict(kw)
    if daily is not None: patch['daily'] = daily
    if patch: js += "{ const p = JSON.parse(localStorage.getItem('%s')); Object.assign(p, %s); localStorage.setItem('%s', JSON.stringify(p)); }" % (PROF, json.dumps(patch), PROF)
    await pg.evaluate(js)
    await reload(pg); await pg.wait_for_timeout(900)
    await pg.evaluate("window.__blastline.perf.lockQ = true")
    await pg.wait_for_function("window.__blastline && window.__blastline.mode === 'menu'", timeout=20000)

async def in_match(pg):
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=90000)
    await pg.wait_for_timeout(300)
async def end_match(pg, win):
    await in_match(pg)
    i = 1 if win else 0
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[{i}].stocks = 1; g.fighters[{i}].x = 5000; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000)
    await pg.wait_for_timeout(1100)   # the chip count-up ends
async def end_draw(pg):
    """Equal lives and the sudden-death clock about to run out: a draw."""
    await in_match(pg)
    await pg.evaluate(f"(() => {{ const g = {G}; g.sudden = true; g.timer = 2; }})()")
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=90000)
    await pg.wait_for_timeout(1100)

async def shot(pg, tag, name_, check=None):
    await pg.screenshot(path=f'{OUT}/{tag}_{name_}.png')
    if check:
        bad = await pg.evaluate(check[0] if len(check) == 1 else f"({check[0]})({json.dumps(check[1])})")
        if bad: errs.append(f'{tag} {name_}: ' + '; '.join(bad[:5]))

# ----- fit checks -----
# the Shop panel: the sheet on the screen, nothing sideways, every card inside the panel, no card text cut off (names, prices, the plate's name),
# the lines of the top and the kickers whole
SHOP_FIT = """(() => {
  const bad = [], vw = innerWidth, vh = innerHeight, sh = document.querySelector('#scrAccount .sheet'), pan = document.getElementById('acPanH');
  const s = sh.getBoundingClientRect(), p = pan.getBoundingClientRect();
  if (s.left < -0.5 || s.right > vw + 0.5 || s.top < -0.5 || s.bottom > vh + 0.5) bad.push('the sheet does not fit the screen');
  if (sh.scrollWidth > sh.clientWidth + 1) bad.push('the sheet scrolls sideways');
  if (pan.scrollWidth > pan.clientWidth + 1) bad.push('the Shop scrolls sideways');
  const cards = [...pan.querySelectorAll('.sh-c')];
  if (cards.length !== 17) bad.push('cards: ' + cards.length);
  if (pan.querySelectorAll('.sh-ko, .sh-pk').length) bad.push('KO page cards or the pack row are back');
  for (const c of cards) {
    const r = c.getBoundingClientRect(), id = c.dataset.id || '?';
    if (r.left < p.left - 1 || r.right > p.right + 1) bad.push('card ' + id + ' runs out of the panel sideways');
    for (const e of c.querySelectorAll('.sh-nm, .sh-f b, .sh-f small')) if (e.scrollWidth > e.clientWidth + 1) bad.push('cut off in ' + id + ': ' + e.textContent);
    for (const e of c.querySelectorAll('.sh-np, .sh-f, .sh-a')) {
      if (!e.getClientRects().length) continue;
      const q = e.getBoundingClientRect(); if (q.left < r.left - 1 || q.right > r.right + 1 || q.bottom > r.bottom + 1 || q.top < r.top - 3) bad.push(e.className + ' runs out of its card ' + id);
    }
  }
  // the Pommes pill (a button): whole, inside the panel, not on the chips or the line
  const pm = pan.querySelector('.sh-pm'), pr = pm.getBoundingClientRect();
  if (pm.scrollWidth > pm.clientWidth + 1) bad.push('the Pommes pill is cut off');
  if (pr.right > p.right + 1 || pr.left < p.left - 1) bad.push('the Pommes pill runs out of the panel');
  if (!/^[\\d,]+ Pommes$/.test(pm.textContent.trim().replace(/\\s+/g, ' '))) bad.push('the Pommes pill says ' + pm.textContent);
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  if (hit(pr, pan.querySelector('.sh-bal').getBoundingClientRect())) bad.push('the Pommes pill is on the chips');
  // the two rows (Free chips, Pommes Shop): every part inside the row, the text whole and the row inside the panel
  for (const row of pan.querySelectorAll('.sh-ad')) {
    const rr = row.getBoundingClientRect(), nm = row.classList.contains('sh-pms') ? 'the Pommes Shop row' : 'the Free chips row';
    if (rr.left < p.left - 1 || rr.right > p.right + 1) bad.push(nm + ' runs out of the panel');
    for (const e of row.children) { const q = e.getBoundingClientRect(); if (e.getClientRects().length && (q.right > rr.right + 1 || q.left < rr.left - 1 || q.bottom > rr.bottom + 1 || q.top < rr.top - 12)) bad.push(nm + ': ' + e.className + ' runs out of it'); }
    const rt = row.querySelector('.sh-adt'); if (rt.scrollWidth > rt.clientWidth + 1) bad.push(nm + ': the text is cut off');
    for (const e of row.querySelectorAll('.sh-adv, .sh-pmv')) if (e.scrollWidth > e.clientWidth + 1) bad.push(nm + ': ' + e.textContent + ' is cut off');
  }
  for (const e of pan.querySelectorAll('.sh-k span, .sh-skins, .sh-note')) {
    if (!e.getClientRects().length) continue;
    if (e.scrollWidth > e.clientWidth + 1 && e.className !== 'sh-skins') bad.push('line cut off: ' + e.textContent.slice(0, 30));
    const q = e.getBoundingClientRect(); if (q.right > p.right + 1) bad.push('line runs out of the panel: ' + e.textContent.slice(0, 30));
  }
  const f = pan.querySelector('.sh-from'), fr = f.getBoundingClientRect(), lh = parseFloat(getComputedStyle(f).lineHeight) || 16;
  if (fr.height > lh * 2.6) bad.push('the top line takes more than two lines: ' + Math.round(fr.height / lh * 10) / 10);
  const b = pan.querySelector('.sh-bal').getBoundingClientRect(); if (hit(b, fr) || b.right > p.right) bad.push('the balance overlaps the line');
  if (hit(pr, fr)) bad.push('the Pommes pill overlaps the line');
  return bad;
})()"""
# the start-page pill keeps the whole name on its plate
PILL = """(() => {
  const bad = [], pill = document.querySelector('#mRank'), pr = pill.getBoundingClientRect(), rg = document.createRange();
  rg.selectNodeContents(document.querySelector('#scrMenu h1'));
  const h1 = rg.getBoundingClientRect();
  for (const e of pill.querySelectorAll('.who b, .who small')) if (e.scrollWidth > e.clientWidth + 1) bad.push('the pill cuts off "' + e.textContent + '"');
  if (pill.scrollWidth > pill.clientWidth + 1) bad.push('the pill is cut off');
  if (pr.left < -0.5 || pr.right > innerWidth + 0.5) bad.push('the pill runs off the screen');
  if (pr.left < h1.right - 1 && pr.bottom > h1.top + 1 && pr.top < h1.bottom - 1) bad.push('the pill overlaps the title');
  return bad;
})()"""
SHEET = """((sel) => {
  const bad = [], vw = innerWidth, vh = innerHeight, s = document.querySelector(sel).getBoundingClientRect();
  if (s.top < -0.5 || s.bottom > vh + 0.5 || s.left < -0.5 || s.right > vw + 0.5) bad.push(sel + ' does not fit the screen');
  const bs = [...document.querySelectorAll(sel + ' .btn')].filter((b) => !b.closest('[hidden]') && b.getClientRects().length);
  for (const b of bs) { const r = b.getBoundingClientRect(); if (r.bottom > vh + 0.5 || r.right > vw + 0.5 || r.left < -0.5) bad.push('button ' + b.id + ' off screen'); if (b.scrollWidth > b.clientWidth + 1) bad.push('button ' + b.id + ' text cut'); }
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), c = bs[j].getBoundingClientRect(); if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) bad.push('buttons ' + bs[i].id + ' and ' + bs[j].id + ' overlap'); }
  for (const e of document.querySelectorAll(sel + ' .dly-t b')) if (e.scrollWidth > e.clientWidth + 1) bad.push('fighter name cut: ' + e.textContent);
  return bad;
})"""
# the results' plate pill: whole, inside the sheet, clear of the title
RES = """(() => {
  const p = document.getElementById('rPlate'), bad = [];
  if (p.hidden || !p.getClientRects().length) return ['no plate on the results'];
  const r = p.getBoundingClientRect(), s = document.getElementById('resSheet').getBoundingClientRect(), t = document.getElementById('rTitle').getBoundingClientRect();
  if (p.scrollWidth > p.clientWidth + 1) bad.push('the plate cuts the name');
  if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1) bad.push('the plate runs out of the sheet');
  if (r.bottom > t.top + 2 && r.top < t.bottom - 2 && r.right > t.left && r.left < t.right) bad.push('the plate overlaps the title');
  return bad;
})()"""
# the Potatality band on the results: whole, inside the winner's panel and the sheet, clear of the title, the story and the other lines of the panel; the title still on the screen
RESKO = """(() => {
  const k = document.getElementById('rKo'), bad = [];
  if (k.hidden || !k.getClientRects().length) return ['no Potatality band on the results'];
  const r = k.getBoundingClientRect(), sh = document.getElementById('resSheet').getBoundingClientRect(), tx = document.querySelector('#resSheet .res-txt').getBoundingClientRect();
  if (k.scrollWidth > k.clientWidth + 1) bad.push('the band cuts its words');
  for (const e of k.querySelectorAll('span')) if (e.scrollWidth > e.clientWidth + 1) bad.push('the band cuts "' + e.textContent + '" short');
  for (const e of k.children) { if (!e.getClientRects().length) continue; const q = e.getBoundingClientRect(); if (q.left < r.left - 2 || q.right > r.right + 2) bad.push('the band: ' + e.tagName + ' runs out of it'); }
  if (r.left < sh.left - 1 || r.right > sh.right + 1 || r.top < sh.top - 1 || r.bottom > sh.bottom + 1) bad.push('the band runs out of the sheet');
  if (r.right > tx.right + 1) bad.push('the band runs past the panel text column');
  for (const id of ['rTitle', 'rSub', 'rFin', 'rChl', 'rRiv', 'rStars', 'rMode']) {
    const e = document.getElementById(id); if (!e || !e.getClientRects().length) continue;
    const q = e.getBoundingClientRect();
    if (r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 2 && q.top < r.bottom - 2) bad.push('the band overlaps #' + id);
  }
  const t = document.getElementById('rTitle').getBoundingClientRect(), m = document.getElementById('rMode').getBoundingClientRect();
  if (t.top < sh.top - 1 || m.top < sh.top - 1) bad.push('the title is pushed off the top of the screen');
  return bad;
})()"""
# each Glaze card's canvas has a model drawn (some opaque pixels)
INKED = """[...document.querySelectorAll('#acPanH .sh-gz canvas')].map((c) => { if (!c.width || !c.height) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 200) n++; return n; })"""

# ----- the Shop at one size -----
P0 = {'tokens': 1500, 'rating': 1080, 'peak': 1080, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True, 'last': 'phoenix', 'name': 'Potato 74',
      'owned': {'phoenix': [0, 1, 2], 'odin': [0, 1]}, 'pal': {'phoenix': 2, 'odin': 1}}
def card(kind, id_): return f'#acPanH .sh-{kind}[data-id="{id_}"]'

async def shop_size(b, tag):
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    ctx, pg, mob = await new_page(b, tag, vp, up, P0, at(14))
    clk = pg.tap if mob else pg.click
    async def open_shop():
        await clk('#mTokens'); await pg.wait_for_timeout(600)
    async def close_sheet():
        await clk('#acClose'); await pg.wait_for_timeout(450)
    async def tokens(): return (await prof(pg))['tokens']
    # ----- the entrance: the coin opens the Shop, the rest of the pill opens the Profile
    need(await shown(pg, '#mTokens'), f'{tag}: no chip coin on the start page')
    await clk('#mRank .plate'); await pg.wait_for_timeout(500)
    need(await shown(pg, '#acPanP') and not await shown(pg, '#acPanH') and (await pg.get_attribute('#acTabP', 'aria-selected')) == 'true', f'{tag}: the pill does not open the Profile')
    await close_sheet()
    await open_shop()
    need(await shown(pg, '#acPanH') and (await pg.get_attribute('#acTabH', 'aria-selected')) == 'true' and not await shown(pg, '#acPanP'), f'{tag}: the coin does not open the Shop')
    need(await txt(pg, '#acTabH') == 'Shop', f'{tag}: the tab says {await txt(pg, "#acTabH")!r}')
    need(await txt(pg, '#shBal') == '1,500', f"{tag}: balance {await txt(pg, '#shBal')!r}")
    need(await txt(pg, '#shFrom') == 'Chips come from ranked wins, the Daily Potato, tournaments and Road stars.', f"{tag}: top line {await txt(pg, '#shFrom')!r}")
    need(await pg.evaluate("document.querySelectorAll('#acPanH .sh-pl').length") == 9 and await pg.evaluate("document.querySelectorAll('#acPanH .sh-gz').length") == 8, f'{tag}: not 9 + 8 cards')
    names = await pg.evaluate("[...document.querySelectorAll('#acPanH .sh-pl')].map((c) => c.querySelector('.sh-f b').textContent + ' ' + (c.querySelector('.tokglyph') ? c.querySelector('.sh-f small').textContent.trim() : '-'))")
    need(names == ['Ink -', 'Sunset 150', 'Mint 150', 'Night Sky 200', 'Road Dust 200', 'Kraken Ink 200', 'Halftone 300', 'Gold Leaf 300', 'Sprout -'], f'{tag}: plates {names}')
    need('worn' in await cls(pg, card('pl', '')), f'{tag}: Ink is not worn at the start')
    need(await txt(pg, '#mRank .plate .who b') != '' and not any(c.startswith('np-') for c in await cls(pg, '#mRank .plate')), f'{tag}: the start-page plate is not Ink')
    gl = await pg.evaluate("[...document.querySelectorAll('#acPanH .sh-gz')].map((c) => c.querySelector('.sh-f b').textContent + ' ' + c.querySelector('.sh-f small').textContent.trim())")
    need(len(gl) == 8 and all(x.endswith('Glaze400') for x in gl), f'{tag}: glaze cards {gl}')
    need('The worn skin of each fighter is glazed here.' in await txt(pg, '#acPanH') and (await shown(pg, '#acPanH .sh-note') or await shown(pg, '#acPanH .sh-k2')), f'{tag}: the glaze line is missing or hidden')
    ink = await pg.evaluate(INKED)
    need(len(ink) == 8 and all(n > 3 for n in ink), f'{tag}: glaze models not drawn {ink}')
    # Free chips without ads (no fake on this page): exactly the SOON row: dashed, dim, the sticker, not a button; the Pommes Shop row and pill are in pm_size
    need(not await pg.evaluate("window.__blAds.on()") and await cls(pg, AD) == ['sh-ad'] and await shown(pg, AD + ' .sh-soon') and await pg.get_attribute(AD, 'aria-disabled') == 'true' and await pg.get_attribute(AD, 'role') is None,
         f"{tag}: the SOON row: {await cls(pg, AD)} {await ad_txt(pg)!r}")
    need(await ad_txt(pg) == 'A short ad, +25 chips, 3 a day. Never required.' and await pg.get_attribute(AD, 'aria-label') == 'Free chips: a short ad, 25 chips, 3 a day, never required. Coming soon.', f"{tag}: the SOON row says {await ad_txt(pg)!r}")
    await shot(pg, tag, '1_shop', (SHOP_FIT,))
    await pg.evaluate("(() => { const s = document.querySelector('#scrAccount .sheet'); document.querySelector('#acPanH .sh-glaze').scrollIntoView({ block: 'center' }); })()"); await pg.wait_for_timeout(300)
    await shot(pg, tag, '2_shop_scrolled', (SHOP_FIT,))
    await pg.evaluate("(() => { const s = document.querySelector('#scrAccount .sheet'); s.scrollTop = 99999; })()"); await pg.wait_for_timeout(300)
    await shot(pg, tag, '2b_shop_end', (SHOP_FIT,))
    await pg.evaluate("(() => { const s = document.querySelector('#scrAccount .sheet'); s.scrollTop = 0; })()"); await pg.wait_for_timeout(200)
    # ----- Sunset: the first tap arms (3 s), a tap elsewhere or the time puts it back, the second pays
    await clk(card('pl', 'sunset')); await pg.wait_for_timeout(200)
    c0 = await cls(pg, card('pl', 'sunset'))
    need('arm' in c0 and 'Sure?' in await txt(pg, card('pl', 'sunset')), f'{tag}: the first tap does not arm: {c0}')
    need(await tokens() == 1500 and not (await prof(pg)).get('plates'), f'{tag}: the first tap already paid')
    await shot(pg, tag, '3_armed', (SHOP_FIT,))
    await pg.wait_for_timeout(3300)
    need('arm' not in await cls(pg, card('pl', 'sunset')), f'{tag}: the plate stays armed after 3 s')
    await clk(card('pl', 'sunset')); await armed(pg, card('pl', 'sunset'), 'arm'); await clk(card('pl', 'mint')); await armed(pg, card('pl', 'mint'), 'arm')
    need('arm' not in await cls(pg, card('pl', 'sunset')), f'{tag}: a tap on another card does not move the arming')
    await two(pg, clk, card('pl', 'sunset'))
    p1 = await prof(pg)
    need(p1['tokens'] == 1350 and p1.get('plates') == ['sunset'] and p1.get('plate') == 'sunset', f"{tag}: after Sunset: {p1['tokens']} {p1.get('plates')} {p1.get('plate')}")
    need('worn' in await cls(pg, card('pl', 'sunset')) and 'own' in await cls(pg, card('pl', '')) and 'Tap to wear' in await txt(pg, card('pl', '')), f'{tag}: Sunset is not worn / Ink not offered')
    need('np-sunset' in await cls(pg, '#mRank .plate'), f"{tag}: the start-page plate does not change: {await cls(pg, '#mRank .plate')}")
    need(await txt(pg, '#shBal') == '1,350', f"{tag}: balance after {await txt(pg, '#shBal')!r}")
    need('1350' in (await txt(pg, '#mTokens')).replace(',', ''), f"{tag}: the start page counts {await txt(pg, '#mTokens')!r}")
    # ----- an owned plate is worn with one tap, Ink too, for nothing
    await clk(card('pl', '')); await pg.wait_for_timeout(250)
    need((await prof(pg)).get('plate') in ('', None) and not any(c.startswith('np-') for c in await cls(pg, '#mRank .plate')) and await tokens() == 1350, f'{tag}: Ink does not wear with one tap')
    await clk(card('pl', 'sunset')); await pg.wait_for_timeout(250)
    need((await prof(pg)).get('plate') == 'sunset' and await tokens() == 1350 and 'np-sunset' in await cls(pg, '#mRank .plate'), f'{tag}: Sunset does not wear with one tap, or it costs')
    await close_sheet()
    await shot(pg, tag, '4_menu_sunset', (PILL,))
    # ----- Night Sky and Halftone: bought, worn, the pill on the start page keeps its whole name
    for id_, price in (('nightsky', 200), ('halftone', 300)):
        before = await tokens()
        await open_shop()
        await two(pg, clk, card('pl', id_))
        pr = await prof(pg)
        need(pr['tokens'] == before - price and pr.get('plate') == id_ and id_ in pr.get('plates', []), f"{tag}: {id_}: chips {pr['tokens']} (want {before - price}), plate {pr.get('plate')}")
        need('np-' + id_ in await cls(pg, '#mRank .plate'), f'{tag}: the start-page plate is not {id_}')
        await close_sheet()
        await shot(pg, tag, f'4_menu_{id_}', (PILL,))
    # ----- the Profile's name field on the plate worn (Halftone)
    await clk('#mRank .plate'); await pg.wait_for_timeout(600)
    need('np-halftone' in await cls(pg, '#acName'), f"{tag}: the Profile name is not on the plate: {await cls(pg, '#acName')}")
    need(await pg.evaluate("(() => { const e = document.getElementById('acName'); return e.scrollWidth <= e.clientWidth + 1; })()"), f'{tag}: the Profile name is cut off')
    await shot(pg, tag, '5_profile')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    if await shown(pg, '#scrAccount'): await close_sheet()
    # ----- Glaze: two taps, 400 chips, the worn skin of that fighter, a model drawn; a glazed card does nothing
    await open_shop()
    before = await tokens()
    await clk(card('gz', 'odin')); await pg.wait_for_timeout(200)
    need('arm' in await cls(pg, card('gz', 'odin')) and 'Sure?' in await txt(pg, card('gz', 'odin')) and await tokens() == before, f'{tag}: the first Glaze tap does not just arm')
    await shot(pg, tag, '6_glaze_armed', (SHOP_FIT,))
    await two(pg, clk, card('gz', 'odin')); await pg.wait_for_timeout(100)
    pr = await prof(pg)
    need(pr['tokens'] == before - 400 and (pr.get('glazed') or {}).get('odin') == [1], f"{tag}: after Glaze: chips {pr['tokens']} (want {before - 400}), glazed {pr.get('glazed')}")
    need('glazed' in await cls(pg, card('gz', 'odin')) and 'Glazed' in await txt(pg, card('gz', 'odin')), f"{tag}: the card is not Glazed: {await cls(pg, card('gz', 'odin'))}")
    need('glazed' not in await cls(pg, card('gz', 'phoenix')), f'{tag}: another fighter is glazed')
    await clk(card('gz', 'odin')); await pg.wait_for_timeout(300)
    need(await tokens() == before - 400 and 'arm' not in await cls(pg, card('gz', 'odin')), f'{tag}: a glazed card takes chips or arms')
    ink = await pg.evaluate(INKED)
    need(len(ink) == 8 and all(n > 3 for n in ink), f'{tag}: glaze models after the buy {ink}')
    await pg.evaluate("document.querySelector('#acPanH .sh-glaze').scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(300)
    await shot(pg, tag, '7_glazed', (SHOP_FIT,))
    await pg.evaluate("(() => { const s = document.querySelector('#scrAccount .sheet'); s.scrollTop = 0; })()")
    need(await txt(pg, '#shBal') == '450', f"{tag}: balance after everything {await txt(pg, '#shBal')!r}")
    # ----- short of chips: no arming, no buying, the line at the top says what is missing; owned plates still wear for nothing
    await close_sheet()
    await set_prof(pg, tokens=100)
    await open_shop()
    need('short' in await cls(pg, card('pl', 'mint')) and 'short' in await cls(pg, card('gz', 'phoenix')) and 'buy' not in ' '.join(await cls(pg, card('pl', 'kraken'))), f'{tag}: the states do not say short')
    await clk(card('pl', 'mint')); await pg.wait_for_timeout(250)
    ln = await txt(pg, '#shFrom')
    need('arm' not in await cls(pg, card('pl', 'mint')) and 'say' in await cls(pg, '#shFrom') and '50 more needed' in ln and 'Mint' in ln, f'{tag}: short of chips for Mint: {ln!r}')
    await shot(pg, tag, '8_short', (SHOP_FIT,))
    await clk(card('pl', 'mint')); await pg.wait_for_timeout(250)
    pr = await prof(pg)
    need(pr['tokens'] == 100 and 'mint' not in pr.get('plates', []), f'{tag}: a plate was bought short of chips')
    await clk(card('gz', 'phoenix')); await pg.wait_for_timeout(250)
    ln = await txt(pg, '#shFrom')
    need('300 more needed' in ln and 'arm' not in await cls(pg, card('gz', 'phoenix')), f'{tag}: short of chips for Glaze: {ln!r}')
    await clk(card('gz', 'phoenix')); await clk(card('gz', 'phoenix')); await pg.wait_for_timeout(250)
    pr = await prof(pg)
    need((pr.get('glazed') or {}).get('phoenix') in (None, [2]) and pr['tokens'] == 100, f'{tag}: chips or glaze changed short of chips')
    await clk(card('pl', 'sunset')); await pg.wait_for_timeout(250)
    need((await prof(pg)).get('plate') == 'sunset' and await tokens() == 100, f'{tag}: an owned plate does not wear short of chips')
    if tag == 'p844':   # the message goes by itself, and the arming back to the top line
        await pg.wait_for_timeout(4500)
        need(await txt(pg, '#shFrom') == 'Chips come from ranked wins, the Daily Potato, tournaments and Road stars.', f"{tag}: the line does not come back: {await txt(pg, '#shFrom')!r}")
        # the tab keys: the arrows move along the four tabs and wrap round
        await pg.focus('#acTabL'); await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(300)
        need((await pg.get_attribute('#acTabH', 'aria-selected')) == 'true' and await shown(pg, '#acPanH'), f'{tag}: ArrowRight from Locker does not reach the Shop')
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(300)
        need((await pg.get_attribute('#acTabP', 'aria-selected')) == 'true', f'{tag}: ArrowRight from the Shop does not wrap to the Profile')
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(300)
        need((await pg.get_attribute('#acTabH', 'aria-selected')) == 'true', f'{tag}: ArrowLeft from the Profile does not reach the Shop')
    await close_sheet()
    await ctx.close()

# ----- the Pommes Shop row and the pill at one size (a fresh page: nothing is bought here) -----
# the fake signed-in state: kopages.js keeps what the server said in KO; this page has no server, so the test says it (o: what differs)
SIGN = "(o) => { window.__blAcct.st.code = 'TESTCODE'; const k = window.__blKo.st; Object.assign(k, { code: 'TESTCODE', bal: 300, own: [], buy: false, ads: false, adN: 0, adMax: 0, busy: '', why: '' }, o || {}); window.__blKo.refresh(); }"
ROW = '#acPanH .sh-pms'
async def pm_size(b, tag):
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    ctx, pg, mob = await new_page(b, tag, vp, up, P0, at(14))
    clk = pg.tap if mob else pg.click
    async def sign(o=None): await pg.evaluate(SIGN, o); await pg.wait_for_timeout(150)
    async def to_row(): await pg.evaluate("document.querySelector('#acPanH .sh-pms').scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(300)
    async def pshop_open(): return await pg.evaluate("!document.getElementById('scrPshop').hidden && window.__blPshop.st.on")
    async def back_to_shop():
        await clk('#psClose'); await pg.wait_for_timeout(500)
        need(not await pshop_open() and await shown(pg, '#acPanH') and (await pg.get_attribute('#acTabH', 'aria-selected')) == 'true', f'{tag}: closing the Pommes Shop does not leave the Shop tab')
    await clk('#mTokens'); await pg.wait_for_timeout(700)
    # ----- the KO PAGES section is gone: no KO cards, no pack row, no kicker; the Pommes Shop is one row at the end and a pill at the top
    need(await pg.evaluate("document.querySelectorAll('#acPanH .sh-ko, #acPanH .sh-kogrid, #acPanH .sh-pk, #acPanH .ko-go').length") == 0, f'{tag}: KO page cards are still in the Shop')
    kick = await pg.evaluate("[...document.querySelectorAll('#acPanH .sh-k b')].map((e) => e.textContent)")
    need(kick == ['Nameplates', 'Glaze'], f'{tag}: the Shop kickers {kick}')
    need(await pg.evaluate("document.querySelectorAll('#acPanH .sh-c').length") == 17, f'{tag}: not 9 + 8 cards')
    need(await pg.evaluate("document.querySelector('#acPanH .sh-pms') === document.querySelector('#acPanH').lastElementChild"), f'{tag}: the Pommes Shop row is not the last thing in the tab')
    need(await txt(pg, ROW) == 'Pommes Shop KO pages and special skins 0 ›', f'{tag}: the row says {await txt(pg, ROW)!r}')
    need('zero' in await cls(pg, ROW) and 'zero' in await cls(pg, '#shPm') and await txt(pg, '#shPm') == '0 Pommes', f"{tag}: signed out the balance is not dim: {await cls(pg, ROW)} {await txt(pg, '#shPm')!r}")
    need(await pg.evaluate("document.querySelector('#shPm').tagName") == 'BUTTON' and await pg.evaluate("document.querySelector('#acPanH .sh-pms').tagName") == 'BUTTON', f'{tag}: the pill or the row is not a button')
    need(not any(('tokglyph' in h) for h in await pg.evaluate("[...document.querySelectorAll('#acPanH .sh-pms, #acPanH .sh-pm')].map((e) => e.innerHTML)")), f'{tag}: a chip glyph on the Pommes')
    need(await pg.evaluate("[...document.querySelectorAll('#acPanH .sh-pms .pmglyph, #acPanH .sh-pm .pmglyph')].every((e) => e.getClientRects().length > 0)"), f'{tag}: no fries cone on the pill or the row')
    await to_row()
    await shot(pg, tag, '11_pommes', (SHOP_FIT,))
    # ----- the row opens the Pommes Shop (on the fighter of the select), closing it brings the tab back
    await clk(ROW); await pg.wait_for_timeout(500)
    need(await pshop_open(), f'{tag}: the Pommes Shop row does not open #scrPshop')
    need(await pg.evaluate("window.__blPshop.fighter") == 'phoenix', f"{tag}: the Pommes Shop opens on {await pg.evaluate('window.__blPshop.fighter')!r}")
    await back_to_shop()
    # ----- the pill at the top does the same
    await pg.evaluate("document.querySelector('#scrAccount .sheet').scrollTop = 0"); await pg.wait_for_timeout(200)
    await clk('#shPm'); await pg.wait_for_timeout(500)
    need(await pshop_open(), f'{tag}: the Pommes pill does not open #scrPshop')
    await back_to_shop()
    # ----- signed in: the pill and the row follow what the server says (300, then 100), the cone no longer dim
    await sign()
    need(await txt(pg, '#shPm') == '300 Pommes' and await txt(pg, ROW) == 'Pommes Shop KO pages and special skins 300 ›' and 'zero' not in await cls(pg, ROW) and 'zero' not in await cls(pg, '#shPm'), f"{tag}: signed in: {await txt(pg, '#shPm')!r} {await txt(pg, ROW)!r}")
    await to_row()
    await shot(pg, tag, '12_pommes_in', (SHOP_FIT,))
    await sign({'bal': 12345})
    need(await txt(pg, '#shPm') == '12,345 Pommes' and '12,345' in await txt(pg, ROW), f"{tag}: a big balance: {await txt(pg, '#shPm')!r} {await txt(pg, ROW)!r}")
    await shot(pg, tag, '12_pommes_big', (SHOP_FIT,))
    await sign({'bal': 100})
    need(await txt(pg, '#shPm') == '100 Pommes' and ' 100 ' in await txt(pg, ROW), f"{tag}: the balance changes: {await txt(pg, '#shPm')!r} {await txt(pg, ROW)!r}")
    # the row reaches the Pommes Shop with the Account sheet still under it, and nothing was bought or spent by looking
    await clk(ROW); await pg.wait_for_timeout(500)
    need(await pshop_open() and await pg.evaluate("document.getElementById('psBal').textContent.includes('100')"), f'{tag}: the Pommes Shop does not show the 100 Pommes')
    await back_to_shop()
    need((await prof(pg))['tokens'] == 1500, f'{tag}: chips changed by looking at the Pommes')
    await clk('#acClose'); await pg.wait_for_timeout(450)
    await ctx.close()

# ----- Free chips (ui/ads.js): the page's fake ad ("view" watches to the end, "skip" closes early, "none" brings no ad; set before the page loads) -----
AD = '#acPanH .sh-ad:not(.sh-pms)'
async def ad_txt(pg): return await txt(pg, AD + ' .sh-adt span')
async def ad_ready(pg): await pg.wait_for_function("document.querySelector('#acPanH .sh-ad:not(.sh-pms)').classList.contains('ready')", polling=40, timeout=6000)
async def ads_day(pg): return await pg.evaluate("window.__blAds.day().ch")
async def ads_size(b, tag):
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    ctx, pg, mob = await new_page(b, tag, vp, up, P0, at(14), 'view')
    clk = pg.tap if mob else pg.click
    async def tokens(): return (await prof(pg))['tokens']
    await clk('#mTokens'); await pg.wait_for_timeout(500)
    # ----- ads on: the row waits for an ad (dim, no sticker), then reads "+25 chips · 0 of 3 today" and is a button
    need(await pg.evaluate("window.__blAds.on()") and not await shown(pg, AD + ' .sh-soon'), f'{tag}: the fake ads are not on or the SOON sticker stays')
    try: await ad_ready(pg)
    except Exception: errs.append(f"{tag}: no ad becomes ready ({await cls(pg, AD)}, {await ad_txt(pg)!r})"); await ctx.close(); return
    need(await ad_txt(pg) == '+25 chips · 0 of 3 today' and await pg.get_attribute(AD, 'role') == 'button' and await pg.get_attribute(AD, 'aria-disabled') is None, f"{tag}: ready row: {await ad_txt(pg)!r}")
    await shot(pg, tag, '20_ad_ready', (SHOP_FIT,))
    # ----- a tap plays it: +25 once per watch, the count, the balance, the start page; the next ad is asked for at once
    for n in (1, 2):
        await clk(AD); await pg.wait_for_timeout(900)
        need(await tokens() == 1500 + 25 * n and await ads_day(pg) == n, f'{tag}: watch {n}: chips {await tokens()}, ads today {await ads_day(pg)}')
        try: await ad_ready(pg)
        except Exception: errs.append(f'{tag}: no new ad after watch {n}'); break
        need(await ad_txt(pg) == f'+25 chips · {n} of 3 today' and await txt(pg, '#shBal') == f'{1500 + 25 * n:,}', f"{tag}: after watch {n}: {await ad_txt(pg)!r}, balance {await txt(pg, '#shBal')!r}")
    # the third and last: "back tomorrow", dim, not a button, a tap does nothing
    await clk(AD); await pg.wait_for_timeout(900)
    need(await tokens() == 1575 and await ads_day(pg) == 3, f'{tag}: the third watch: chips {await tokens()}, ads today {await ads_day(pg)}')
    need(await ad_txt(pg) == 'back tomorrow' and 'done' in await cls(pg, AD) and await pg.get_attribute(AD, 'role') is None and await pg.get_attribute(AD, 'aria-disabled') == 'true', f"{tag}: used up: {await ad_txt(pg)!r} {await cls(pg, AD)}")
    await shot(pg, tag, '21_ad_done', (SHOP_FIT,))
    await clk(AD); await pg.wait_for_timeout(900)
    need(await tokens() == 1575 and await ads_day(pg) == 3 and await ad_txt(pg) == 'back tomorrow', f'{tag}: a tap on the used-up row paid or changed it: chips {await tokens()}')
    await clk('#acClose'); await pg.wait_for_timeout(450)
    need('1575' in (await txt(pg, '#mTokens')).replace(',', ''), f"{tag}: the start page counts {await txt(pg, '#mTokens')!r}")
    # ----- the next day starts empty again (a reload with the clock on the 15th)
    await reload_at(pg, at(15))
    await clk('#mTokens'); await pg.wait_for_timeout(500)
    try: await ad_ready(pg)
    except Exception: errs.append(f'{tag}: no ad ready the next day')
    need(await ad_txt(pg) == '+25 chips · 0 of 3 today', f"{tag}: the next day reads {await ad_txt(pg)!r}")
    if tag == 'p844':
        # ----- the Pommes Shop asks for its own ad (signed in, the server has ads) and replaces ours; closing it brings ours back
        await pg.evaluate(SIGN, {'ads': True, 'adN': 0, 'adMax': 5})
        await pg.evaluate("document.querySelector('#acPanH .sh-pms').click()"); await pg.wait_for_timeout(500)
        need(await pg.evaluate("window.__blAds.state('pommes')") in ('wait', 'ready'), f"{tag}: the Pommes Shop did not ask for its ad: {await pg.evaluate('window.__blAds.state(\"pommes\")')}")
        await pg.evaluate("document.getElementById('psClose').click()"); await pg.wait_for_timeout(300)
        try: await ad_ready(pg)
        except Exception: errs.append(f"{tag}: back from the Pommes Shop the Free chips ad is not asked for again ({await cls(pg, AD)})")
    await ctx.close()

async def ads_other(b, kind):
    tag = 'ads_' + kind
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, P0, at(14), kind)
    clk = pg.tap
    async def tokens(): return (await prof(pg))['tokens']
    await clk('#mTokens'); await pg.wait_for_timeout(600)
    if kind == 'skip':   # an ad closed early pays nothing and counts nothing; another one is asked for
        await ad_ready(pg)
        await clk(AD); await pg.wait_for_timeout(900)
        need(await tokens() == 1500 and await ads_day(pg) == 0, f'{tag}: a skipped ad paid or counted: chips {await tokens()}, today {await ads_day(pg)}')
        try: await ad_ready(pg)
        except Exception: errs.append(f'{tag}: no new ad after a skipped one')
        need(await ad_txt(pg) == '+25 chips · 0 of 3 today', f"{tag}: after a skip: {await ad_txt(pg)!r}")
    else:   # none came: the row says so and is not a button
        need(await ad_txt(pg) == 'No ad right now' and 'none' in await cls(pg, AD) and await pg.get_attribute(AD, 'role') is None and await pg.get_attribute(AD, 'aria-disabled') == 'true', f"{tag}: the row says {await ad_txt(pg)!r} {await cls(pg, AD)}")
        await clk(AD); await pg.wait_for_timeout(700)
        need(await tokens() == 1500 and await ads_day(pg) == 0, f'{tag}: a tap with no ad paid: chips {await tokens()}')
        await shot(pg, tag, '22_ad_none', (SHOP_FIT,))
    await ctx.close()

# ----- the Daily sheet and the results at one size -----
async def daily_size(b, tag):
    vp = SIZES[tag][:2]; up = SIZES[tag][2]
    # a Daily lost this morning (the streak of 3 ended with it): Another go is open; a Sunset plate on the results
    p0 = dict(P0, tokens=85, plates=['sunset'], plate='sunset', daily={'d': '2026-10-14', 'r': 0, 's': 0, 'w': '2026-10-13', 'b': 3, 'p': 3})
    ctx, pg, mob = await new_page(b, tag, vp, up, p0, at(14))
    clk = pg.tap if mob else pg.click
    need((await txt(pg, '#mDaily')).startswith('Lost'), f"{tag}: menu line {await txt(pg, '#mDaily')!r}")
    await clk('#bDaily'); await pg.wait_for_timeout(600)
    need(await shown(pg, '#dlyAgain') and not await shown(pg, '#dlyGo'), f'{tag}: the sheet does not offer Another go (and only that)')
    need(await txt(pg, '#dlyAgain') == 'Another go 50', f"{tag}: the button says {await txt(pg, '#dlyAgain')!r}")
    need(await txt(pg, '#dlyRule') == 'Lost today. One more go for 50 chips.', f"{tag}: rule {await txt(pg, '#dlyRule')!r}")
    need(await txt(pg, '#dlyLine') == "The same match again. Its result replaces today's: a win pays 40 chips and makes it a 4-day streak, a draw 15, a loss 5.", f"{tag}: line {await txt(pg, '#dlyLine')!r}")
    await shot(pg, tag, '9_daily_again', (SHEET, '#scrDaily .sheet'))
    await clk('#dlyAgain'); await armed(pg, '#dlyAgain', 'ember')
    need(await txt(pg, '#dlyAgain') == 'Sure? 50' and (await prof(pg))['tokens'] == 85, f"{tag}: first tap: {await txt(pg, '#dlyAgain')!r}")
    await shot(pg, tag, '9_daily_armed', (SHEET, '#scrDaily .sheet'))
    await two(pg, clk, '#dlyAgain', 'ember')
    await pg.wait_for_function(f"{G} !== null", timeout=20000)
    pr = await prof(pg)
    need(pr['tokens'] == 35 and pr['daily'] == {'d': '2026-10-14', 'r': -1, 's': 0, 'w': '2026-10-13', 'b': 3, 'x': 1}, f"{tag}: starting the go: chips {pr['tokens']}, daily {pr['daily']}")
    await end_match(pg, True)
    pr = await prof(pg)
    need(pr['tokens'] == 75 and pr['daily'] == {'d': '2026-10-14', 'r': 1, 's': 4, 'w': '2026-10-14', 'b': 4, 'x': 1}, f"{tag}: the go's win: chips {pr['tokens']}, daily {pr['daily']}")
    ch = await txt(pg, '#rChips')
    need('+40 chips' in ch and 'Daily win +40 · 4-day streak · another go' in ch, f'{tag}: chips line {ch!r}')
    need(await shown(pg, '#rPlate') and 'np-sunset' in await cls(pg, '#rPlate') and await txt(pg, '#rPlate') == 'Potato 74', f"{tag}: the results plate: {await txt(pg, '#rPlate')!r} {await cls(pg, '#rPlate')}")
    await shot(pg, tag, '10_results', (RES,))
    bad = await pg.evaluate(f"({SHEET})('#resSheet')")
    if bad: errs.append(f'{tag} results sheet: ' + '; '.join(bad[:4]))
    # ----- the Potatality band: not after this result; set the way showResults sets it (a CPU's page on you), it fits the results and opens the Pommes Shop on that fighter
    need(not await shown(pg, '#rKo'), f'{tag}: the Potatality band shows after a result without a CPU page')
    await pg.evaluate("window.__blShop.resKo('reaper')"); await pg.wait_for_timeout(1000)
    need(await shown(pg, '#rKo') and await txt(pg, '#rKo') == 'Potatality · in the Pommes Shop ›' and await pg.evaluate("document.getElementById('rKo').dataset.id") == 'reaper', f"{tag}: the band says {await txt(pg, '#rKo')!r}")
    # (on the smallest screen, 667x320, the cone and "in the" give way: the column is 175px wide)
    need(await pg.evaluate("document.querySelector('#rKo .pmglyph').getClientRects().length") > 0 or tag == 's667', f'{tag}: no Pommes glyph on the band')
    await shot(pg, tag, '10b_results_ko', (RESKO,))
    bad = await pg.evaluate(f"({SHEET})('#resSheet')")
    if bad: errs.append(f'{tag} results sheet with the band: ' + '; '.join(bad[:4]))
    await clk('#rKo'); await pg.wait_for_timeout(600)
    need(await pg.evaluate("!document.getElementById('scrPshop').hidden && window.__blPshop.st.on") and await pg.evaluate("window.__blPshop.fighter") == 'reaper', f"{tag}: the band does not open the Pommes Shop on the Reaper: {await pg.evaluate('window.__blPshop.fighter')!r}")
    need(not await shown(pg, '#acPanH'), f'{tag}: the band opens the Account Shop as well')
    await shot(pg, tag, '14_ko_from_results')
    await clk('#psClose'); await pg.wait_for_timeout(500)
    need(await shown(pg, '#resSheet') and await pg.evaluate("window.__blastline.mode") == 'result' and await pg.evaluate("document.getElementById('scrPshop').hidden"), f'{tag}: the results are not back after the Pommes Shop')
    await pg.evaluate("window.__blShop.resKo('')")
    need(not await shown(pg, '#rKo'), f'{tag}: the band stays')
    await clk('#rAgain'); await pg.wait_for_timeout(500)
    need(await txt(pg, '#mStreak') == '4', f"{tag}: the pill shows the streak {await txt(pg, '#mStreak')!r}")
    await clk('#bDaily'); await pg.wait_for_timeout(400)
    need(not await shown(pg, '#dlyAgain') and not await shown(pg, '#dlyGo') and 'Won today' in await txt(pg, '#dlyRule'), f"{tag}: a won day offers more: {await txt(pg, '#dlyRule')!r}")
    await ctx.close()

# ----- the rules of Another go, one page, several days -----
async def rules(b):
    tag = 'rules'
    p0 = dict(P0, tokens=300, daily={'d': '2026-10-13', 'r': 1, 's': 3, 'w': '2026-10-13', 'b': 3})
    ctx, pg, mob = await new_page(b, tag, (844, 390), False, p0, at(14))
    clk = pg.tap
    async def sheet(): await clk('#bDaily'); await pg.wait_for_timeout(400)
    async def to_menu():
        await clk('#rAgain'); await pg.wait_for_timeout(500)
    async def daily(): return (await prof(pg)).get('daily')
    async def tokens(): return (await prof(pg))['tokens']
    async def again_two():
        await two(pg, clk, '#dlyAgain', 'ember', after=0)
        await pg.wait_for_function(f"{G} !== null", timeout=20000)
    # ----- day 14: the try is lost (streak of 3 was running): +5, the go is open
    need(await pg.evaluate(f"{D}.price") == 50, 'the price is not 50')
    await sheet(); await clk('#dlyGo')
    await end_match(pg, False)
    need(await daily() == {'d': '2026-10-14', 'r': 0, 's': 0, 'w': '2026-10-13', 'b': 3, 'p': 3} and await tokens() == 305, f'a lost try: {await daily()}, chips {await tokens()}')
    need('Daily played +5 · streak reset' in await txt(pg, '#rChips'), f"loss line {await txt(pg, '#rChips')!r}")
    await to_menu()
    await sheet()
    need(await shown(pg, '#dlyAgain') and not await shown(pg, '#dlyGo'), 'after a loss the sheet has no Another go')
    # arming times out after 3 s and a tap elsewhere puts it back; nothing is paid
    await clk('#dlyAgain')
    try: await armed(pg, '#dlyAgain', 'ember')
    except Exception: need(False, 'the first tap does not arm Another go')
    await pg.wait_for_timeout(3300)
    need('ember' not in await cls(pg, '#dlyAgain') and await txt(pg, '#dlyAgain') == 'Another go 50' and await tokens() == 305, 'the arming stays after 3 s')
    await clk('#dlyAgain'); await armed(pg, '#dlyAgain', 'ember'); await fast(pg, '#dlyRule'); await pg.wait_for_timeout(200)
    need('ember' not in await cls(pg, '#dlyAgain'), 'a tap elsewhere does not put Another go back')
    await clk('#dlyAgain'); await armed(pg, '#dlyAgain', 'ember'); await clk('#dlyClose'); await pg.wait_for_timeout(400)
    await sheet()
    need('ember' not in await cls(pg, '#dlyAgain') and await tokens() == 305, 'closing the sheet keeps Another go armed')
    await clk('#dlyClose'); await pg.wait_for_timeout(300)
    # a reload keeps it open; the go itself: two taps, 50 chips, the same match again
    await reload_at(pg, at(14, '10:05'))
    await sheet()
    need(await shown(pg, '#dlyAgain'), 'after a reload Another go is gone')
    pk = await pg.evaluate(f"{D}.pick('2026-10-14')")
    await again_two()
    need(await daily() == {'d': '2026-10-14', 'r': -1, 's': 0, 'w': '2026-10-13', 'b': 3, 'x': 1} and await tokens() == 255, f'starting the go: {await daily()}, chips {await tokens()}')
    gi = await pg.evaluate(f"({G}).fighters.map((f) => f.spec.id)")
    need(gi == [pk['me'], pk['opp']] and await pg.evaluate(f"{D}.match.bot.d") == pk['d'] and await pg.evaluate(f"{D}.match.cpu") == pk['cpu'], f"the go is not the same match: {gi} vs {pk['me']}, {pk['opp']}")
    # the win: +40, a 4-day streak as if the first try had been won
    await end_match(pg, True)
    ch = await txt(pg, '#rChips')
    need(await daily() == {'d': '2026-10-14', 'r': 1, 's': 4, 'w': '2026-10-14', 'b': 4, 'x': 1} and await tokens() == 295, f'the go won: {await daily()}, chips {await tokens()}')
    need('+40 chips' in ch and 'Daily win +40 · 4-day streak · another go' in ch, f'win line {ch!r}')
    await pg.screenshot(path=f'{OUT}/{tag}_1_go_won.png')
    await to_menu()
    need(await txt(pg, '#mStreak') == '4' and (await txt(pg, '#mDaily')).startswith('Won · 4-day streak'), f"the menu after the go: {await txt(pg, '#mDaily')!r}, streak {await txt(pg, '#mStreak')!r}")
    await sheet()
    need(not await shown(pg, '#dlyAgain') and not await shown(pg, '#dlyGo') and await pg.evaluate(f"{D}.again({D}.st, {D}.key())") is False, 'a win offers Another go')
    await clk('#dlyClose'); await pg.wait_for_timeout(300)
    # ----- day 15: lost, the go lost too: +5 and +5, the streak (4) is gone, no second go
    await reload_at(pg, at(15))
    await sheet(); await clk('#dlyGo'); await end_match(pg, False)
    need(await daily() == {'d': '2026-10-15', 'r': 0, 's': 0, 'w': '2026-10-14', 'b': 4, 'p': 4} and await tokens() == 300, f'day 15 first try: {await daily()}, chips {await tokens()}')
    await to_menu(); await sheet()
    need('a win pays 40 chips and makes it a 5-day streak' in await txt(pg, '#dlyLine'), f"day 15 line {await txt(pg, '#dlyLine')!r}")
    await again_two()
    await end_match(pg, False)
    need(await daily() == {'d': '2026-10-15', 'r': 0, 's': 0, 'w': '2026-10-14', 'b': 4, 'x': 1} and await tokens() == 255, f'the go lost: {await daily()}, chips {await tokens()}')
    need('Daily played +5' in await txt(pg, '#rChips') and 'another go' in await txt(pg, '#rChips'), f"go loss line {await txt(pg, '#rChips')!r}")
    await to_menu(); await sheet()
    need(not await shown(pg, '#dlyAgain') and not await shown(pg, '#dlyGo') and 'Lost today' in await txt(pg, '#dlyRule') and 'One more go' not in await txt(pg, '#dlyRule'), f"a second go is offered: {await txt(pg, '#dlyRule')!r}")
    await clk('#dlyClose'); await pg.wait_for_timeout(300)
    await reload_at(pg, at(15, '10:30'))
    await sheet()
    need(not await shown(pg, '#dlyAgain'), 'after a reload a second go is offered')
    await clk('#dlyClose'); await pg.wait_for_timeout(300)
    # ----- day 16: a draw (pays 15, no streak running), the go: a win makes a 1-day streak
    await reload_at(pg, at(16))
    await sheet(); await clk('#dlyGo'); await end_draw(pg)
    need(await daily() == {'d': '2026-10-16', 'r': 0.5, 's': 0, 'w': '2026-10-14', 'b': 4, 'p': 0} and await tokens() == 270, f'a drawn try: {await daily()}, chips {await tokens()}')
    need('Daily draw +15' in await txt(pg, '#rChips'), f"draw line {await txt(pg, '#rChips')!r}")
    await to_menu(); await sheet()
    need(await shown(pg, '#dlyAgain') and await txt(pg, '#dlyRule') == 'Draw today. One more go for 50 chips.', f"after a draw: {await txt(pg, '#dlyRule')!r}")
    need(await txt(pg, '#dlyLine') == "The same match again. Its result replaces today's: a win pays 40 chips, a draw 15, a loss 5.", f"draw line {await txt(pg, '#dlyLine')!r}")
    await again_two()
    await end_match(pg, True)
    need(await daily() == {'d': '2026-10-16', 'r': 1, 's': 1, 'w': '2026-10-16', 'b': 4, 'x': 1} and await tokens() == 260, f'the go after a draw, won: {await daily()}, chips {await tokens()}')
    await to_menu()
    # ----- day 17: a forfeit pays nothing and offers no go
    await reload_at(pg, at(17))
    await sheet(); await clk('#dlyGo'); await in_match(pg)
    await clk('#pauseBtn'); await pg.wait_for_timeout(300); await clk('#pQuit'); await pg.wait_for_timeout(200); await clk('#pQuit')
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=20000); await pg.wait_for_timeout(400)
    need(await txt(pg, '#rTitle') == 'Forfeit' and (await daily()).get('p') is None and (await daily())['r'] == 0, f'a forfeit: {await daily()}')
    await to_menu(); await sheet()
    need(not await shown(pg, '#dlyAgain') and 'One more go' not in await txt(pg, '#dlyRule'), 'a forfeit offers Another go')
    await clk('#dlyClose'); await pg.wait_for_timeout(300)
    # ----- day 18: a reload in the middle of the match counts as a loss and offers no go
    await reload_at(pg, at(18))
    await sheet(); await clk('#dlyGo'); await in_match(pg)
    await reload_at(pg, at(18, '10:02'))
    await sheet()
    need(not await shown(pg, '#dlyAgain') and not await shown(pg, '#dlyGo'), 'a reload mid-match leaves a go or a second try')
    need((await daily())['r'] == -1 and (await daily()).get('p') is None, f'reload mid-match: {await daily()}')
    await clk('#dlyClose'); await pg.wait_for_timeout(300)
    # ----- day 19: short of chips: the button looks dim, a tap says what is missing and takes nothing
    await reload_at(pg, at(19), {'d': '2026-10-19', 'r': 0, 's': 0, 'w': '2026-10-18', 'b': 4, 'p': 2}, tokens=30)
    await sheet()
    need(await shown(pg, '#dlyAgain') and 'dim' in await cls(pg, '#dlyAgain'), 'short of chips Another go does not look dim')
    await clk('#dlyAgain'); await pg.wait_for_timeout(250)
    ln = await txt(pg, '#dlyLine')
    need('Another go costs 50 chips and you have 30: 20 more needed.' in ln and 'ember' not in await cls(pg, '#dlyAgain'), f'short of chips: {ln!r}')
    await clk('#dlyAgain'); await pg.wait_for_timeout(250)
    need(await tokens() == 30 and await daily() == {'d': '2026-10-19', 'r': 0, 's': 0, 'w': '2026-10-18', 'b': 4, 'p': 2} and not await pg.evaluate(f"{G} !== null && {G} !== undefined && window.__blastline.mode === 'play'"), f'short of chips took something: {await daily()}, chips {await tokens()}')
    await pg.screenshot(path=f'{OUT}/{tag}_2_short.png')
    await clk('#dlyClose'); await pg.wait_for_timeout(300)
    # ----- day 20: a reload in the middle of the go counts as a loss and there is no second go; the 50 chips stay paid
    await reload_at(pg, at(20), {'d': '2026-10-20', 'r': 0, 's': 0, 'w': '2026-10-19', 'b': 4, 'p': 2}, tokens=200)
    await sheet(); await again_two(); await in_match(pg)
    await reload_at(pg, at(20, '10:03'))
    pr = await prof(pg)
    need(pr['tokens'] == 150 and pr['daily'] == {'d': '2026-10-20', 'r': -1, 's': 0, 'w': '2026-10-19', 'b': 4, 'x': 1}, f"reload mid-go: chips {pr['tokens']}, daily {pr['daily']}")
    await sheet()
    need(not await shown(pg, '#dlyAgain') and not await shown(pg, '#dlyGo'), 'a reload mid-go leaves a go')
    await ctx.close()

async def main():
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    tags = ONLY or ['s667', 'p844', 'd1280', 'up390', 'rules']
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for t in tags:
            print('running', t, flush=True)
            try:
                if t == 'rules': await rules(b)
                else:
                    await shop_size(b, t)
                    await pm_size(b, t)
                    await ads_size(b, t)
                    if t == 'p844':
                        await ads_other(b, 'skip')
                        await ads_other(b, 'none')
                    await daily_size(b, t)
            except Exception as e:
                errs.append(f'{t}: {type(e).__name__}: {str(e)[:400]}')
        await b.close()
    for e in errs: print('PROBLEM', e)
    if not errs: print('shop ok')
    print('no errors' if not errs else f'{len(errs)} problems')
asyncio.run(main())
