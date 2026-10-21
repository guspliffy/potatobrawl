"""Boss Week's menu parts (ui/bwsheet.js, css/97-bossweek.css) at five sizes, with window.__blBwMock standing in for the server: the start page tile
(placed, no time, NEW, offline) next to the Daily and the minis, Settings' How to play row, the sheet (a time + top 3 + your row 6th, no time, checking,
empty board, offline, the FIGHT note), the fighter picker round trip and Practice offline, the Boards sheet's Boss Week tab (full, you in the top 3, no time,
empty, offline) and the Monday card (#4 and #1). Every visible text must lie in its box and in the viewport, texts must not overlap each other, and the
tile, the minis and the sheet's columns must not overlap or leave the screen. Usage: python3 tests/pwbwsheet.py [shots folder, default build/shots/bwsheet]."""
import asyncio, os, sys, json
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEST_URL = (ROOT / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer
OUT = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / 'build' / 'shots' / 'bwsheet')
SIZES = [('se', 667, 320, True, False), ('s740', 740, 360, True, False), ('phone', 844, 390, True, False), ('desk', 1280, 760, False, False), ('upright', 390, 844, True, True)]
if os.environ.get('PWBWS_ONLY'): SIZES = [z for z in SIZES if z[0] in os.environ['PWBWS_ONLY'].split(',')]   # while iterating: PWBWS_ONLY=phone,upright
errs = []

# ---- the mock server: one week (Zorp or another boss), your record, the board ----
def board(top, me=None, n=23, boss='zorp'):
    return {'k': 'w', 'wk': 40, 'no': 41, 'boss': boss, 'n': n, 'at': 0, 'top': top, 'me': me}
ROWS = [('Tuber Tom', 'phoenix', 4884, 0, 2), ('Peel Appeal', 'reaper', 5274, 1, 0), ('Spudnik', 'samurai', 5412, 0, 0), ('Mash Gordon', 'odin', 5733, 2, 0),
        ('Hash Slinger', 'wizard', 5765, 1, 0), ('Gunslinger Jo', 'gunslinger', 5900, 3, 0), ('Alchemist Al', 'alchemist', 6000, 2, 0)]
def top(k=7): return [{'id': f'r{i}', 'nm': n, 'f': f, 't': t, 'fl': fl, 'cr': cr, 'pl': ''} for i, (n, f, t, fl, cr) in enumerate(ROWS[:k])]
ME_ROW = {'id': 'me', 'nm': 'Jonny', 'f': 'phoenix', 't': 6131, 'fl': 2, 'cr': 0, 'pl': ''}
def mock(boss='zorp', live=True, me='best', brd='full', wk=40, pf='samurai', checking=None, lr=None, n=23):
    m = {'live': live, 'wk': {'wk': wk, 'no': wk + 1, 'boss': boss, 'lv': 1, 'pf': pf, 'n': n, 'endsIn': (3 * 24 + 4) * 3600e3 + 5 * 60e3}}
    m['me'] = None if me is None else {'t': 6131, 'fl': 2, 'f': 'phoenix', 'pl': 6, 'cr': 0, 'tries': 5} if me == 'best' else {'t': 0, 'fl': 0, 'f': '', 'pl': 0, 'cr': 0, 'tries': 0}
    if brd == 'full': m['board'] = board(top(), {'i': 6, 'row': ME_ROW}, n, boss)
    elif brd == 'intop': m['board'] = board(top(), {'i': 2, 'row': dict(top()[1], id='me', nm='Jonny')}, n, boss)
    elif brd == 'notime': m['board'] = board(top(), {'i': 0}, n, boss)
    elif brd == 'empty': m['board'] = board([], None, 0, boss)
    elif brd == 'noacct': m['board'] = board(top(), None, n, boss)
    else: m['board'] = None
    if checking is not None: m['checking'] = checking
    if lr: m['lr'] = lr
    return m
SET_MOCK = "(m) => { m.wk.ends = Date.now() + m.wk.endsIn; window.__blBwMock = m; }"

# ---- what must hold on the page ----
# every visible text: inside the viewport, inside the box it is drawn in (nowrap texts: not cut; clipping boxes: not clipping it), no two texts on top of each other
TEXTS = """([root, scroller]) => {
  const bad = [], R = document.querySelector(root); if (!R) return ['no ' + root];
  const W = innerWidth, H = innerHeight, rr = R.getBoundingClientRect();
  const items = [];
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { if (e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return false; } return true; };
  const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : ''));
  for (const el of R.querySelectorAll('*')) {
    if (!vis(el) || (el.classList.contains('bw-pn') && el.parentElement.scrollHeight > el.parentElement.clientHeight + 1)) continue;   // the tile's second part, wrapped into its clipped line on the phone
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own.length) continue;
    const rg = document.createRange(); rg.selectNodeContents(el);
    const t = [...rg.getClientRects()].reduce((a, r) => a ? { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom }, null);
    if (!t || t.r - t.l < 1) continue;
    if (scroller) { const sc = el.closest(scroller); if (sc) { const sr = sc.getBoundingClientRect(); if (t.t < sr.top - 1 || t.b > sr.bottom + 1) continue; } }   // a row of a scrolling list that is not (all) in view: scrolled out on purpose
    const label = name(el) + ' "' + el.textContent.trim().slice(0, 24) + '"', cs = getComputedStyle(el), b = el.getBoundingClientRect();
    const ls = Math.max(0, parseFloat(cs.letterSpacing) || 0), fs = parseFloat(cs.fontSize) || 14;
    if (cs.textOverflow === 'ellipsis' && cs.overflowX !== 'visible') { t.r = Math.min(t.r, b.right); t.l = Math.max(t.l, b.left); }   // what the ellipsis hides is not drawn   // the last letter's spacing trails the text; a tight line-height is shorter than the letters' own box
    if (t.l < -1 || t.t < -1 || t.r > W + 1 || t.b > H + 1) bad.push('off screen: ' + label);
    if (!el.classList.contains('tag') && (t.l < rr.left - 1 || t.r > rr.right + 1 || t.t < rr.top - 1 || t.b > rr.bottom + 1)) bad.push('outside ' + root + ': ' + label);   // a sticker sits on the corner on purpose
    if ((cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis') && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 + ls && cs.display !== 'inline' && (cs.textOverflow !== 'ellipsis' || /[0-9]/.test(el.textContent))) bad.push('cut: ' + label + ' ' + el.scrollWidth + '>' + el.clientWidth);   // a name may end in an ellipsis; a number never
    if (cs.overflow !== 'visible' && el.scrollHeight > el.clientHeight + 3 && cs.display !== 'inline') bad.push('cut (height): ' + label + ' ' + el.scrollHeight + '>' + el.clientHeight);
    // the text inside its own box (an inline box is as wide as its text: only block boxes count)
    if (cs.display !== 'inline' && el.tagName !== 'BUTTON' && (t.l < b.left - 1.5 || t.r > b.right + 1.5 + ls || t.b > b.bottom + 1.5 + 0.25 * fs || t.t < b.top - 1.5 - 0.25 * fs)) bad.push('spills out of its box: ' + label + ' ' + [t.l - b.left, b.right - t.r, b.bottom - t.b, t.t - b.top].map((x) => Math.round(x * 10) / 10));
    // a text on a button stays on the button
    const bt = el.closest('button'); if (bt && !el.classList.contains('tag')) { const q = bt.getBoundingClientRect(); if (t.l < q.left - 1 || t.r > q.right + 1 + ls || t.t < q.top - 1 - 0.25 * fs || t.b > q.bottom + 1 + 0.25 * fs) bad.push('text outside its button: ' + label); }
    // inside the clipping box above it (a scrolling sheet body clips on purpose)
    for (let a = el.parentElement; a && a !== R.parentElement; a = a.parentElement) {
      const ac = getComputedStyle(a);
      if (a !== R && ac.overflow !== 'visible' && !/scroll|auto/.test(ac.overflowY)) { const ar = a.getBoundingClientRect(); if (t.l < ar.left - 1 || t.r > ar.right + 1 || t.t < ar.top - 1 || t.b > ar.bottom + 1) bad.push('clipped by ' + name(a) + ': ' + label); break; }
    }
    items.push({ el, t, label });
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ox = Math.min(A.t.r, B.t.r) - Math.max(A.t.l, B.t.l), oy = Math.min(A.t.b, B.t.b) - Math.max(A.t.t, B.t.t);
    if (ox > 2 && oy > 3) bad.push('texts overlap: ' + A.label + ' / ' + B.label);
  }
  return bad;
}"""
# boxes that must not overlap each other and must stay on screen
BOXES = """(sels) => {
  const bad = [], W = innerWidth, H = innerHeight, rs = [];
  for (const s of sels) for (const el of document.querySelectorAll(s)) { if (el.hidden || !el.getClientRects().length) continue; const r = el.getBoundingClientRect(); if (r.width < 1) continue; rs.push([s + (el.id ? '#' + el.id : ''), r]); }
  for (const [n, r] of rs) if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push('off screen: ' + n + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i][1], b = rs[j][1], ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 2 && oy > 2) bad.push('overlap: ' + rs[i][0] + ' / ' + rs[j][0]);
  }
  return bad;
}"""
# everything inside the box stays inside it (the tile's disc and texts; the stickers on a corner are allowed out, not over the title)
INSIDE = """(sel) => {
  const bad = [], B = document.querySelector(sel), br = B.getBoundingClientRect();
  for (const el of B.querySelectorAll('*')) {
    if (el.hidden || !el.getClientRects().length || el.classList.contains('tag') || el.classList.contains('bw-pn')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1) continue;
    if (el.tagName === 'IMG') continue;
    if (r.left < br.left - 1 || r.right > br.right + 1 || r.top < br.top - 1 || r.bottom > br.bottom + 1) bad.push(sel + ' child out of the box: ' + (el.id || el.className || el.tagName));
  }
  return bad;
}"""

# the sticker on the tile's corner must not cover the title's letters
STICKER = """() => { const t = document.getElementById('mBwTag'); if (!t || t.hidden) return []; const rg = document.createRange(); rg.selectNodeContents(document.querySelector('#bBw .mm-tb > b'));
  const a = t.getBoundingClientRect(), b = rg.getBoundingClientRect(), ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return ox > 1 && oy > 1 ? ['the ' + t.textContent + ' sticker covers the title (' + Math.round(ox) + 'x' + Math.round(oy) + ' px)'] : []; }"""
async def check(pg, tag, what, root, boxes=None, inside=None, scroller=None):
    for r in ([root] if isinstance(root, str) else root):
        for b in await pg.evaluate(TEXTS, [r, scroller]): errs.append(f'{tag} {what}: {b}')
    if boxes:
        for b in await pg.evaluate(BOXES, boxes): errs.append(f'{tag} {what}: {b}')
    if inside:
        for b in await pg.evaluate(INSIDE, inside): errs.append(f'{tag} {what}: {b}')
NAMES = """() => [...document.querySelectorAll('#scrBw .bw-fs .dly-t b')].map((e) => { const cs = getComputedStyle(e), k = document.createElement('span'); k.textContent = e.textContent;
    k.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;white-space:nowrap;font:' + cs.font + ';letter-spacing:' + cs.letterSpacing + ';text-transform:' + cs.textTransform; document.body.appendChild(k);
    const w = k.getBoundingClientRect().width; k.remove(); return [e, w]; })
  .filter(([e, w]) => w > e.getBoundingClientRect().width + 0.1).map(([e, w]) => 'the fighter name "' + e.textContent + '" is cut (' + w.toFixed(1) + ' > ' + e.getBoundingClientRect().width.toFixed(1) + ')')"""   # a fighter's name never ends in an ellipsis
async def shot(pg, tag, name): await pg.screenshot(path=f'{OUT}/{tag}_{name}.png')
async def setm(pg, m): await pg.evaluate(SET_MOCK, m)
async def sheet(pg, m, wait=350):
    await setm(pg, m); await pg.evaluate("window.__blBwSheet.close()"); await pg.evaluate("window.__blBwSheet.open()"); await pg.wait_for_timeout(wait)

SHEET_BOXES = ['#bwBoss', '.bw-you', '#bwTop']
async def new_page(b, tag, w, h, mob, up, errs_, seen=40):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    await ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5, last: 'alchemist'%s}))" % (", screen: 'up'" if up else ""))
    await ctx.add_init_script("localStorage.setItem('potatobrawl.bw.v1', JSON.stringify({seen: %d}))" % seen)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: page error {e}'))
    pg.on('console', lambda m: errs.append(f'{tag}: console {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(800)
    return ctx, pg

async def run_size(b, tag, w, h, mob, up):
    ctx, pg = await new_page(b, tag, w, h, mob, up, errs)
    clk = (lambda sel: pg.tap(sel)) if mob else (lambda sel: pg.click(sel))
    need = lambda ok, msg: None if ok else errs.append(f'{tag}: {msg}')
    TILE_BOXES = ['#scrMenu .mm-hero', '#bDaily', '#bBw', '#bOnline', '#bPractice', '#bCup', '#bBoards', '#bRoad']
    # ---- the start page ----
    for name, m, boss in [('placed', mock('kraken'), 'kraken'), ('notime', mock('zorp', me='none'), 'zorp'), ('new', mock('scratch', wk=41, me='none'), 'scratch'),
                          ('offline', mock('zorp', live=False, me=None, brd=None, n=-1), 'zorp'), ('offline_best', mock('kraken', live=False), 'kraken')]:
        await setm(pg, m); await pg.evaluate("window.__blBwSheet.tile()"); await pg.wait_for_timeout(250)
        await check(pg, tag, f'tile {name}', ['#bBw', '#bCup'], TILE_BOXES, '#bBw')
        for b in await pg.evaluate(STICKER): errs.append(f'{tag} tile {name}: {b}')
        await shot(pg, tag, f'menu_{name}')
        t = (await pg.text_content('#bBw')).replace('\xa0', ' ')
        want = {'placed': ['Boss Week', 'Kraken Spud', 'Hard', '3d 4h left', 'Best 1:42.18', '#6 of 23'], 'notime': ['Zorp', 'No time yet', '23 have one'], 'new': ['Old Scratch', 'New'],
                'offline': ['needs the server'], 'offline_best': ['Best 1:42.18']}[name]
        for x in want: need(x.lower() in t.lower(), f'tile {name} lacks "{x}": {t}')
        tag_el = await pg.evaluate("(() => { const e = document.getElementById('mBwTag'); return e.hidden ? '' : e.textContent + '|' + e.className; })()")
        need((name in ('placed', 'offline_best') and tag_el.startswith('#6') and 'gold' in tag_el) or (name == 'new' and tag_el.lower().startswith('new') and 'ember' in tag_el) or (name in ('notime', 'offline') and tag_el == ''), f'tile {name} tag is "{tag_el}"')
    need('8 players' in await pg.text_content('#bCup'), 'Tournament mini lacks "8 players"')
    need(await pg.evaluate("!document.querySelector('#scrMenu .mm-row3 #bHelp')"), 'How to play is still on the start page')
    # the boards pill shown (our server): four minis in the row
    await pg.evaluate("document.getElementById('bBoards').hidden = false; document.getElementById('bBoards').parentNode.classList.add('bd4')"); await pg.wait_for_timeout(600)
    await setm(pg, mock('kraken')); await pg.evaluate("window.__blBwSheet.tile()")
    await check(pg, tag, 'menu with the boards pill', ['#bBw', '#bCup'], TILE_BOXES, '#bBw')
    await shot(pg, tag, 'menu_boards')
    await pg.evaluate("document.getElementById('bBoards').hidden = true; document.getElementById('bBoards').parentNode.classList.remove('bd4')")
    # ---- Settings: How to play is the first row and opens the sheet ----
    await clk('#bSettings'); await pg.wait_for_timeout(300)
    need(await pg.evaluate("document.querySelector('#scrSettings .sh-body').firstElementChild.id") == 'bHelp', 'How to play is not the first row of Settings')
    await check(pg, tag, 'settings', '#scrSettings .set-sheet')
    await shot(pg, tag, 'settings')
    await clk('#bHelp'); await pg.wait_for_timeout(300)
    need(await pg.evaluate("!document.getElementById('scrHelp').hidden && document.getElementById('scrSettings').hidden"), 'How to play did not open (alone)')
    await clk('#hClose'); await pg.wait_for_timeout(200)
    # ---- the sheet ----
    await setm(pg, mock('zorp', wk=41)); await pg.evaluate("window.__blBwSheet.tile()")
    need(await pg.evaluate("!document.getElementById('mBwTag').hidden"), 'NEW tag missing before the sheet is opened')
    await clk('#bBw'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("!document.getElementById('scrBw').hidden"), 'the tile does not open the sheet')
    need(await pg.evaluate("document.getElementById('mBwTag').hidden || document.getElementById('mBwTag').textContent !== 'New'"), 'NEW tag stays after the sheet opened')
    await check(pg, tag, 'sheet', '#scrBw .bw-sheet', SHEET_BOXES)
    await shot(pg, tag, 'sheet')
    t = (await pg.text_content('#scrBw .bw-sheet')).replace('\xa0', ' ')
    for x in ['Boss Week', 'Week 42', '3d 4h', 'Zorp', 'The Alien', 'The Kitchen', 'Hard', 'Your best', '1:42.18', '#6 of 23', '2 ♥ lost', 'Fight Zorp', 'Samurai', 'partner', 'CPU', 'Tuber Tom', '1:21.40', 'Jonny', 'Paid Monday', '#1 300', '2–3 150', 'Top 10 80', 'A time 25', 'Top 3']:
        need(x.lower() in t.lower(), f'sheet lacks "{x}"')
    for boss, name, long_fighter in [('kraken', 'Kraken Spud', 'gunslinger'), ('scratch', 'Old Scratch', 'alchemist')]:   # the long names
        m = mock(boss, pf=long_fighter); await sheet(pg, m)
        await check(pg, tag, f'sheet {boss}', '#scrBw .bw-sheet', SHEET_BOXES)
        for b in await pg.evaluate(NAMES): errs.append(f'{tag} sheet {boss}: {b}')
        await shot(pg, tag, f'sheet_{boss}')
        need(f'Fight {name}'.lower() in (await pg.text_content('#bwGo')).lower(), f'FIGHT button lacks {name}')
    await sheet(pg, mock('zorp', me='none', brd='notime'))
    await check(pg, tag, 'sheet no time', '#scrBw .bw-sheet', SHEET_BOXES); await shot(pg, tag, 'sheet_notime')
    need('--:--.--' in await pg.text_content('#bwTime'), 'no-time sheet lacks --:--.--')
    need("you're on" in (await pg.text_content('#bwSub')), 'no-time sheet lacks "Finish him once and you\'re on"')
    await sheet(pg, mock('zorp', checking=True))
    await check(pg, tag, 'sheet checking', '#scrBw .bw-sheet', SHEET_BOXES); await shot(pg, tag, 'sheet_checking')
    need('checking' in (await pg.text_content('#bwSub')).lower(), 'checking sheet lacks CHECKING…')
    await sheet(pg, mock('zorp', me='none', checking=True, brd='noacct'))
    await check(pg, tag, 'sheet checking, no time', '#scrBw .bw-sheet', SHEET_BOXES)
    await sheet(pg, mock('zorp', me='none', brd='empty', n=0))
    await check(pg, tag, 'sheet empty board', '#scrBw .bw-sheet', SHEET_BOXES); await shot(pg, tag, 'sheet_empty')
    need('nobody has a time yet' in (await pg.text_content('#bwRows')).lower(), 'empty sheet lacks "Nobody has a time yet"')
    await sheet(pg, mock('zorp', brd='intop'))
    await check(pg, tag, 'sheet, you in the top 3', '#scrBw .bw-sheet', SHEET_BOXES); await shot(pg, tag, 'sheet_intop')
    await sheet(pg, mock('zorp', live=False, me=None, brd=None, n=-1))
    await check(pg, tag, 'sheet offline', '#scrBw .bw-sheet', SHEET_BOXES); await shot(pg, tag, 'sheet_offline')
    t = (await pg.text_content('#scrBw .bw-sheet')).lower()
    need('needs the server' in t and 'offline' in t, 'offline sheet lacks "Boss Week needs the server" / Offline')
    need('practice zorp' in (await pg.text_content('#bwGo')).lower(), 'offline button is not PRACTICE ZORP')
    need(await pg.evaluate("document.querySelectorAll('#bwRows .sk').length === 3"), 'offline sheet has no ghost rows')
    # the full board button opens the Boards sheet on the Boss Week tab, over the sheet
    await sheet(pg, mock('zorp'))
    await clk('#bwFull'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("!document.getElementById('scrBoards').hidden && document.querySelector('#bdTabs .bd-tab.on').textContent === 'Boss Week'"), 'Full board does not open the Boss Week tab')
    await clk('#bdClose'); await pg.wait_for_timeout(200)
    need(await pg.evaluate("!document.getElementById('scrBw').hidden"), 'the sheet is gone after closing the board')
    # ---- your fighter is the picker: the select in Boss Week mode, Use <fighter> and Back come back to the sheet ----
    await clk('#bwMe'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'select' and (await pg.text_content('#selMode')).startswith('Boss Week'), 'the fighter card does not open the Boss Week select')
    need(await pg.evaluate("document.getElementById('scrBw').hidden"), 'the sheet stays open over the select')
    await shot(pg, tag, 'select')
    await pg.evaluate("document.querySelectorAll('#tiles .tile')[2].click()"); await pg.wait_for_timeout(200)   # Odin
    need((await pg.text_content('#selGo')).strip().startswith('Use'), 'select button is not "Use <fighter>"')
    await clk('#selGo'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'menu' and await pg.evaluate("!document.getElementById('scrBw').hidden"), 'Use <fighter> does not come back to the sheet')
    need('odin' in (await pg.text_content('#bwMe')).lower(), 'the sheet does not show the picked fighter')
    await clk('#bwMe'); await pg.wait_for_timeout(400); await clk('#selBack'); await pg.wait_for_timeout(500)
    need(await pg.evaluate("window.__blastline.mode") == 'menu' and await pg.evaluate("!document.getElementById('scrBw').hidden"), 'Back does not come back to the sheet')
    await clk('#bwClose'); await pg.wait_for_timeout(300)
    need(await pg.evaluate("document.getElementById('scrBw').hidden"), 'the X does not close the sheet')
    # ---- Practice without the server: the week's boss, your fighter ----
    if (w, h) == (844, 390):
        await setm(pg, mock('kraken', live=False, me=None, brd=None, n=-1)); await pg.evaluate("window.__blBwSheet.tile()")
        await clk('#bBw'); await pg.wait_for_timeout(400); await clk('#bwGo'); await pg.wait_for_timeout(1200)
        mm = await pg.evaluate("(() => { const g = window.__blastline.game; return [window.__blastline.mode, g ? g.fighters.map((f) => f.spec.id) : []]; })()")
        need(mm[0] == 'match' and mm[1][2] == 'kraken' and mm[1][0] == 'odin', f'Practice: not Kraken Spud with your fighter: {mm}')
        need(await pg.evaluate("document.getElementById('scrBw').hidden"), 'the sheet stays open over Practice')
        await shot(pg, tag, 'practice')
    await ctx.close()

    # ---- the Boards sheet's tab and the Monday card (a fresh page: the practice match above left the menu) ----
    ctx, pg = await new_page(b, tag, w, h, mob, up, errs)
    clk = (lambda sel: pg.tap(sel)) if mob else (lambda sel: pg.click(sel))
    need = lambda ok, msg: None if ok else errs.append(f'{tag}: {msg}')
    BD_BOXES = ['#bdTabs', '#bdMain', '#bdYou']
    for name, m in [('full', mock('zorp')), ('intop', mock('kraken', brd='intop')), ('notime', mock('zorp', me='none', brd='notime')), ('empty', mock('zorp', me='none', brd='empty', n=0)), ('offline', mock('zorp', live=False, me=None, brd=None, n=-1)), ('noacct', mock('scratch', me=None, brd='noacct'))]:
        await setm(pg, m); await pg.evaluate("window.__blBoards.close()"); await pg.evaluate("window.__blBoards.open('w')"); await pg.wait_for_timeout(500)
        need(await pg.evaluate("document.querySelector('#bdTabs .bd-tab.on').textContent") == 'Boss Week', f'boards {name}: bdOpen("w") is not on the Boss Week tab')
        await check(pg, tag, f'boards {name}', '#scrBoards .bd-sheet', BD_BOXES, scroller='#bdList')
        await shot(pg, tag, f'boards_{name}')
        k = (await pg.text_content('#bdKick')).replace('\xa0', ' ').lower()
        if name == 'full':
            for x in ['zorp', 'hard', '23 have a time', 'ends 3d 4h']: need(x in k, f'boards kicker lacks "{x}": {k}')
            t = (await pg.text_content('#bdList')).replace('\xa0', ' ')
            for x in ['Tuber Tom', '1:21.40', '0 ♥ lost', 'Phoenix', 'Reaper', '1:27.90']: need(x in t, f'boards list lacks "{x}"')
            need(await pg.evaluate("!!document.querySelector('#bdList .bw-crown') && document.querySelector('#bdList .bw-crown').textContent === '2'"), 'boards: no crown count on the champion')
            y = (await pg.text_content('#bdYou')).replace('\xa0', ' ')
            need('Jonny' in y and '1:42.18' in y and '6' in y, f'boards: your sticky row is wrong: {y}')
            need('time' in (await pg.text_content('#bdHd')).lower(), 'boards header lacks Time')
        if name == 'empty': need("nobody has a time yet" in (await pg.text_content('#bdState')).lower() and 'fight zorp' in (await pg.text_content('#bdState')).lower(), 'boards empty state lacks the text / FIGHT ZORP')
        if name == 'offline': need('server' in (await pg.text_content('#bdState')).lower(), 'boards offline state')
        if name == 'notime': need('no time yet' in (await pg.text_content('#bdYou')).lower(), 'boards: no-time row')
    # the other two tabs are as before
    await setm(pg, mock('zorp', brd=None, me=None))
    await pg.evaluate("window.__blBoards.open('c')"); await pg.wait_for_timeout(300)
    need(await pg.evaluate("document.querySelector('#bdTabs .bd-tab.on').textContent") == 'VS CPU' and await pg.evaluate("!document.getElementById('scrBoards').classList.contains('bw-tab')"), 'the VS CPU tab changed')
    need(await pg.evaluate("document.querySelectorAll('#bdTabs .bd-tab').length") == 3, 'the Boards sheet has not three tabs')
    await pg.evaluate("window.__blBoards.close()")
    # the Monday card
    for name, lr in [('rank4', {'wk': 40, 'no': 41, 'boss': 'zorp', 'pl': 4, 'of': 23, 'c': 80}), ('champion', {'wk': 40, 'no': 41, 'boss': 'kraken', 'pl': 1, 'of': 23, 'c': 300})]:
        await setm(pg, mock('scratch')); await pg.evaluate("(lr) => window.__blBwSheet.card(lr)", lr); await pg.wait_for_timeout(700)
        await check(pg, tag, f'Monday card {name}', '#scrBwWk .bw-wk', ['#scrBwWk .bw-wk'])
        await shot(pg, tag, f'monday_{name}')
        need(await pg.evaluate("(() => { const rg = document.createRange(); rg.selectNodeContents(document.getElementById('bwwGoT')); return new Set([...rg.getClientRects()].map((r) => Math.round(r.top / 4))).size; })()") == 1, f'Monday card {name}: the THIS WEEK button text is on more than one line')
        t = (await pg.text_content('#scrBwWk .bw-wk')).replace('\xa0', ' ')
        for x in ['Boss Week', 'Last week', f"You finished #{lr['pl']} of 23", f"+{lr['c']} chips", 'paid into your account', 'This week: Old Scratch', 'OK']: need(x.lower() in t.lower(), f'Monday card {name} lacks "{x}"')
        need((name == 'champion') == await pg.evaluate("!document.getElementById('bwwCrown').hidden && !document.getElementById('bwwH').hidden"), f'Monday card {name}: the champion crown / CHAMPION is wrong')
        if name == 'rank4':
            await clk('#bwwGo'); await pg.wait_for_timeout(400)
            need(await pg.evaluate("document.getElementById('scrBwWk').hidden && !document.getElementById('scrBw').hidden"), 'THIS WEEK does not open the sheet')
            await pg.evaluate("window.__blBwSheet.close()")
        else:
            await clk('#bwwOk'); await pg.wait_for_timeout(300)
            need(await pg.evaluate("document.getElementById('scrBwWk').hidden"), 'OK does not close the Monday card')
    await ctx.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for tag, w, h, mob, up in SIZES:
            await run_size(b, tag, w, h, mob, up)
            print(tag, 'done', len(errs), 'problems so far', flush=True)
        await b.close()
    print('\n'.join(dict.fromkeys(errs)))
    print('no errors' if not errs else f'{len(set(errs))} problems')
    if not errs: print('bwsheet ok')
if __name__ == '__main__': asyncio.run(main())
