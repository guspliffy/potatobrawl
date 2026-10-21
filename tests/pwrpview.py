"""The replay viewer (ui/rpview.js, css/97-replay.css, the ▶ / WATCH / LAST WEEK parts of ui/bwsheet.js) at five sizes, no server: window.__blBwMock stands in for the
boards, window.fetch for GET /api/run/<id>, a bot plays the run (window.__blRp.botRun) and the engine plays it again.
What the buttons do runs once, in real time, on the 'phone' (844x390, touch):
  - the board's ▶ opens a run; the strip (play/pause, seek bar with the break and the final launch, the time, speed 1x/2x/0.5x, again, KO, clean view, share, X); the livetag under your card;
    fading after 3 s and waking on a key or a tap (which is no move in the game), Space, seeking by the bar, KO, clean view and its tap out, X back to the Boards sheet
  - every end card's buttons (a run seen on the board, your own try, a Ranked vs CPU match, a lost run): WATCH AGAIN / BOARD / MENU
  - the title card of a share link leaves every way (Escape, X, FIGHT, WATCH), over the Boss Week sheet, the Boards sheet and the welcome sheet; the toast goes after 2.6 s
At every size (the other four are set up state by state, no waiting for the fade, the run's end reached by seeking to it) the layout of: board rows (▶, "older version", your row, nothing below 10),
the sheet (top 3, WATCH ▶ on your best), the strip playing / at 2x and 0.5x / paused / after a seek, the toast over a replay and over the menu, the end card of each variant, the title card in every
state (load, ok, a long name, old, gone, net, off), LAST WEEK › and ‹ THIS WEEK, the staged results row with WATCH.
Every visible text must lie in its box and in the viewport, texts must not overlap each other. (The results' WATCH ▶ button on the real results is tests/pwreplay.py's, against a real server.)
The phone runs first, the other four side by side (PWRPV_SERIAL=1: one after the other). It prints the seconds it took (PWRPV_TIME=1: each part of each size).
Usage: python3 tests/pwrpview.py [shots folder, default build/shots/rpview]      PWRPV_ONLY=phone,upright to run some sizes; PWRPV_ONLY=side adds the sixth, an upright phone with
the game turned sideways on it (the app rotated: the bar runs down the screen; runs the real-time flow too). Needs `python3 game/build.py` first."""
import asyncio, os, sys, json, re, time
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEST_URL = (ROOT / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer
OUT = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / 'build' / 'shots' / 'rpview')
SIZES = [('se', 667, 320, True, False), ('s740', 740, 360, True, False), ('phone', 844, 390, True, False), ('desk', 1280, 760, False, False), ('upright', 390, 844, True, True)]
SIDE = ('side', 390, 844, True, False)   # an upright phone with the game turned sideways on it (the app is rotated): only when asked for, PWRPV_ONLY=side
if os.environ.get('PWRPV_ONLY'): SIZES = [z for z in SIZES + [SIDE] if z[0] in os.environ['PWRPV_ONLY'].split(',')]
errs = []

# ---- the runs and the boards ----
CFG_BW = {'kind': 'bw', 'pl': [['phoenix', 0], ['samurai', 0], ['zorp', 0]], 'map': 0, 'lv': 1, 'hp': 0.05, 'seed': 7, 'd': 0.9, 'bs': 'samurai'}
CFG_PLAY = dict(CFG_BW, hp=0.4)   # a run of 45 s, long enough to poke at
CFG_LOST = dict(CFG_BW, hp=3.0, d=0.05)   # a boss who does not go down, a weak partner and a weak fighter: the three hearts go
CFG_VC = {'kind': 'vc', 'pl': [['phoenix', 0], ['samurai', 0]], 'map': 0, 'seed': 7, 'd': 0.6, 'bs': 'samurai'}
def meta(**kw):
    m = {'kind': 'bw', 'id': '0123456789ab', 'tid': '0123456789ab', 'own': False, 'nm': 'Tuber Tom', 'f': 'phoenix', 'pf': 'samurai', 'boss': 'zorp', 'wk': 40, 'no': 41, 't': 0, 'fl': 0, 'place': 1, 'n': 23,
         'cr': 0, 'fin': False, 'v': 0, 'plate': ''}
    m.update(kw); return m
META_OWN = dict(id='', own=True, nm='Jonny', place=0, n=0)
META_VC = dict(kind='vc', id='', tid='', own=True, nm='Jonny', boss='', wk=0, no=0, place=0, n=0, cpu='Hard CPU', res=1)
def rid(i): return f'{0xabc000000000 + i:012x}'
ROWS = [('Tuber Tom', 'phoenix', 4884, 0, 2), ('Peel Appeal', 'reaper', 5274, 1, 0), ('Spudnik', 'samurai', 5412, 0, 0), ('Mash Gordon', 'odin', 5733, 2, 0), ('Lord Starchington Jr', 'wizard', 5765, 1, 0),
        ('Gunslinger Jo', 'gunslinger', 5900, 3, 0), ('Alchemist Al', 'alchemist', 6000, 2, 0), ('Tater Tot', 'phoenix', 6100, 4, 0), ('Fry Guy', 'reaper', 6200, 0, 0), ('Hash Brown', 'samurai', 6300, 1, 0),
        ('Too Slow', 'odin', 6400, 5, 0), ('Way Too Slow', 'wizard', 6500, 6, 0), ('Slowest', 'phoenix', 6600, 7, 0)]
def top(proto, old=(1,), norun=(5,)):   # row i (0 based): old: another game version; norun: no run kept
    return [{'id': f'r{i}', 'nm': n, 'f': f, 't': t, 'fl': fl, 'cr': cr, 'pl': '', 'r': '' if i in norun else rid(i), 'v': proto - 1 if i in old else proto} for i, (n, f, t, fl, cr) in enumerate(ROWS)]
def board(rows, me=None, n=23, boss='zorp', wk=40): return {'k': 'w', 'wk': wk, 'no': wk + 1, 'boss': boss, 'n': n, 'at': 0, 'top': rows, 'me': me}
def mock(proto, boss='zorp', me_run=True, me_old=False, last='board', brd='full'):
    m = {'live': True, 'wk': {'wk': 40, 'no': 41, 'boss': boss, 'lv': 1, 'pf': 'samurai', 'n': 23, 'endsIn': (3 * 24 + 4) * 3600e3 + 5 * 60e3}}
    m['me'] = {'t': 6131, 'fl': 2, 'f': 'phoenix', 'pl': 6, 'cr': 0, 'tries': 5}
    if me_run: m['me'].update(r=rid(40), v=proto - 1 if me_old else proto)
    mine = {'id': 'me', 'nm': 'Jonny', 'f': 'phoenix', 't': 6131, 'fl': 2, 'cr': 0, 'pl': '', 'r': rid(40), 'v': proto}
    m['board'] = board(top(proto), {'i': 14, 'row': mine}) if brd == 'full' else board(top(proto)[:3], {'i': 0})
    if last == 'board': m['last'] = board(top(proto, old=(2,), norun=(4,))[:8], {'i': 12, 'row': dict(mine, r=rid(41))}, 19, 'kraken', 39)
    elif last == 'empty': m['last'] = board([], None, 0, 'kraken', 39)
    else: m['last'] = None
    return m
SET_MOCK = "(m) => { m.wk.ends = Date.now() + m.wk.endsIn; window.__blBwMock = m; }"

# a stand-in for the server's GET /api/run/<id>: every id is this run (the page believes it is on our server while a ▶ is tapped)
STUB = """(a) => { const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', c = window.__blRp.botRun(a.cfg, a.lv); let s = '';
  for (let i = 0; i < c.length;) { let n = 1; while (n < 64 && c[i + n] === c[i]) n++; s += B64[c[i] >> 6] + B64[c[i] & 63] + B64[n - 1]; i += n; }
  const j = { f: a.cfg.pl[0][0], p: 0, pf: a.cfg.pl[1][0], pp: 0, boss: a.cfg.pl[2][0], map: a.cfg.map, lv: a.cfg.lv, hp: a.cfg.hp, seed: a.cfg.seed, d: a.cfg.d, wk: 40, no: 41, t: 0, fl: 0, place: 1, n: 23, cr: 0, fin: false, v: window.__blRpv.proto, pl: '', nm: 'Tuber Tom', lg: s };
  window.__blQuick = window.__blQuick || { send() { return false; }, on() {} };
  window.fetch = (u) => { const m = /\\/api\\/run\\/([0-9a-f]{12})/.exec(String(u)); return Promise.resolve(m ? { status: 200, json: () => Promise.resolve(Object.assign({ id: m[1] }, j)) } : { status: 404, json: () => Promise.resolve({}) }); };
  return c.length; }"""
UNSTUB = "() => { delete window.__blQuick; }"
OPEN = """(a) => { const R = window.__blRp; window.__codes = window.__codes || {}; const k = JSON.stringify(a.cfg) + a.lv;
  const codes = window.__codes[k] || (window.__codes[k] = R.botRun(a.cfg, a.lv)); R.open(a.cfg, codes, a.meta, a.from); return codes.length; }"""

# ---- what must hold on the page (the same checks as tests/pwbwsheet.py) ----
TEXTS = """([root, scroller]) => {
  const bad = [], R = document.querySelector(root); if (!R) return ['no ' + root];
  const W = innerWidth, H = innerHeight, rr = R.getBoundingClientRect();
  const items = [];
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { if (e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return false; } return true; };
  const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : ''));
  for (const el of R.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own.length) continue;
    const rg = document.createRange(); rg.selectNodeContents(el);
    const t = [...rg.getClientRects()].reduce((a, r) => a ? { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom }, null);
    if (!t || t.r - t.l < 1) continue;
    if (scroller) { const sc = el.closest(scroller); if (sc) { const sr = sc.getBoundingClientRect(); if (t.t < sr.top - 1 || t.b > sr.bottom + 1) continue; } }   // a row of a scrolling list that is not (all) in view
    const label = name(el) + ' "' + el.textContent.trim().slice(0, 24) + '"', cs = getComputedStyle(el), b = el.getBoundingClientRect();
    const ls = Math.max(0, parseFloat(cs.letterSpacing) || 0), fs = parseFloat(cs.fontSize) || 14;
    if (cs.textOverflow === 'ellipsis' && cs.overflowX !== 'visible') { t.r = Math.min(t.r, b.right); t.l = Math.max(t.l, b.left); }   // what the ellipsis hides is not drawn
    if (t.l < -1 || t.t < -1 || t.r > W + 1 || t.b > H + 1) bad.push('off screen: ' + label);
    if (!el.classList.contains('tag') && (t.l < rr.left - 1 || t.r > rr.right + 1 || t.t < rr.top - 1 || t.b > rr.bottom + 1)) bad.push('outside ' + root + ': ' + label);
    if ((cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis') && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 + ls && cs.display !== 'inline' && (cs.textOverflow !== 'ellipsis' || /[0-9]/.test(el.textContent))) bad.push('cut: ' + label + ' ' + el.scrollWidth + '>' + el.clientWidth);   // a name may end in an ellipsis; a number never
    if (cs.overflow !== 'visible' && el.scrollHeight > el.clientHeight + 3 && cs.display !== 'inline') bad.push('cut (height): ' + label + ' ' + el.scrollHeight + '>' + el.clientHeight);
    if (cs.display !== 'inline' && el.tagName !== 'BUTTON' && (t.l < b.left - 1.5 || t.r > b.right + 1.5 + ls || t.b > b.bottom + 1.5 + 0.25 * fs || t.t < b.top - 1.5 - 0.25 * fs)) bad.push('spills out of its box: ' + label + ' ' + [t.l - b.left, b.right - t.r, b.bottom - t.b, t.t - b.top].map((x) => Math.round(x * 10) / 10));
    const bt = el.closest('button'); if (bt && !el.classList.contains('tag')) { const q = bt.getBoundingClientRect(); if (t.l < q.left - 1 || t.r > q.right + 1 + ls || t.t < q.top - 1 - 0.25 * fs || t.b > q.bottom + 1 + 0.25 * fs) bad.push('text outside its button: ' + label); }
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
  for (const s of sels) for (const el of document.querySelectorAll(s)) { if (el.hidden || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue; const r = el.getBoundingClientRect(); if (r.width < 1) continue; rs.push([s + (el.id ? '#' + el.id : ''), r]); }
  for (const [n, r] of rs) if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push('off screen: ' + n + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i][1], b = rs[j][1], ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 2 && oy > 2) bad.push('overlap: ' + rs[i][0] + ' / ' + rs[j][0]);
  }
  return bad;
}"""
# the cells of a board row stay in the row and off each other; no row is taller than the list makes it
ROWS_FIT = """([sel, scroller]) => {
  const bad = [], sc = document.querySelector(scroller), sr = sc.getBoundingClientRect();
  for (const r of document.querySelectorAll(sel)) {
    const br = r.getBoundingClientRect(); if (br.width < 1 || (sc.contains(r) && (br.bottom < sr.top || br.top > sr.bottom))) continue;
    const min = parseFloat(getComputedStyle(r).minHeight) || 0; if (min > 0 && br.height > min + 1.5) bad.push('row taller than ' + min + 'px: ' + Math.round(br.height * 10) / 10 + ' (' + r.textContent.trim().slice(0, 18) + ')');
    const kids = [...r.children].filter((e) => e.getClientRects().length);
    for (const k of kids) { const q = k.getBoundingClientRect(); if (q.left < br.left - 1 || q.right > br.right + 1 || q.top < br.top - 1 || q.bottom > br.bottom + 1) bad.push('cell out of its row: ' + (k.className || k.tagName) + ' (' + r.textContent.trim().slice(0, 18) + ')'); }
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect(), ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) bad.push('cells overlap: ' + kids[i].className + ' / ' + kids[j].className + ' (' + r.textContent.trim().slice(0, 18) + ')');
    }
  }
  return bad;
}"""
TOP = """(sel) => { const e = document.querySelector(sel); if (!e) return 'none'; const r = e.getBoundingClientRect(), pe = e.style.pointerEvents; e.style.pointerEvents = 'auto';   // the toast takes no taps: look as if it did
  const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); e.style.pointerEvents = pe; return t && e.contains(t) ? 'ok' : 'covered by ' + (t ? (t.id || t.className || t.tagName) : 'nothing'); }"""

async def new_page(b, tag, w, h, mob, up):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    await ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5, last: 'alchemist', name: 'Jonny'%s}))" % (", screen: 'up'" if up else ""))
    await ctx.add_init_script("localStorage.setItem('potatobrawl.bw.v1', JSON.stringify({seen: 40}))")
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: page error {e}'))
    pg.on('console', lambda m: errs.append(f'{tag}: console {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.wait_for_function("window.__blastline && window.__blRpv && window.__blRp && window.__blBoards && window.__blBwSheet", timeout=20000)
    await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(300)
    if mob and h > w and not up: await pg.tap('#turnGo'); await pg.wait_for_timeout(300)   # the turn-it-sideways screen: Ready
    return ctx, pg

async def shot(pg, tag, name): await pg.screenshot(path=f'{OUT}/{tag}_{name}.png')
async def norm(pg, sel): return ((await pg.evaluate("(s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }", sel)) or '').replace('\xa0', ' ').replace('\n', ' ')
def has(hay, *subs):
    h = (hay or '').lower()
    return all(x.lower() in h for x in subs)
# every running animation that ends (a sheet sliding in, a card dropping, a transition) is over: the boxes stand still. The ones that never end (a spinner) do not count.
SETTLE = """() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 800))])"""
BD_BOXES = ['#bdTabs', '#bdMain', '#bdYou']
SHEET_BOXES = ['#bwBoss', '.bw-you', '#bwTop']
HUD = ['.rpv-tag', '#pc0', '#pc1', '#bossBar', '#rpv']
END_BOXES = ['.rpv-ec', '#rpv', '.rpv-tag']
BTN = "[...document.querySelectorAll('.rpv-ec .btn')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim())"
TIMES = {}   # (size, section) -> seconds

class Sz:
    """One size of the five. `flow`: the one that also runs what the buttons do over real time (phone: 844x390, touch); the others only set up each state and check its layout."""
    def __init__(s, b, tag, w, h, mob, up):
        s.b, s.tag, s.w, s.h, s.mob, s.up = b, tag, w, h, mob, up
        s.rot = mob and h > w and not up   # the page is turned sideways (the app is rotated): geometry checks measure screen boxes, so they are skipped; what the buttons do is still tested
        s.flow = tag in ('phone', 'side')
    # ---- helpers ----
    def need(s, ok, msg):
        if not ok: errs.append(f'{s.tag}: {msg}')
    async def tap(s, sel):
        if s.mob: await s.pg.tap(sel)
        else: await s.pg.click(sel)
    async def tap_at(s, x, y):
        if s.mob: await s.pg.touchscreen.tap(x, y)
        else: await s.pg.mouse.click(x, y)
    async def wake(s): await s.pg.keyboard.press('Shift')
    def st(s, js): return s.pg.evaluate(f"(() => {{ const R = window.__blRp.st; return {js}; }})()")
    def M(s, **kw): return mock(s.proto, **kw)
    async def setm(s, m): await s.pg.evaluate(SET_MOCK, m)
    async def shot(s, name): await shot(s.pg, s.tag, name)
    async def norm(s, sel): return await norm(s.pg, sel)
    async def settle(s): await s.pg.evaluate(SETTLE)
    async def waitf(s, js, what, secs=30):
        try: await s.pg.wait_for_function(js, timeout=secs * 1000); return True
        except Exception:
            st = await s.pg.evaluate("(() => { const b = window.__blastline, r = window.__blRp && window.__blRp.st; return b ? [b.mode, r && r.on, r && r.loading, r && r.seeking, r && r.ended, r && r.i, r && r.mk && r.mk.n, r && r.mk && r.mk.end] : null; })()")
            errs.append(f'{s.tag}: timed out: {what} (mode, on, loading, seeking, ended, tick, ticks, end: {st})'); return False
    async def geo(s, what, js, arg):
        if not s.rot:
            for x in await s.pg.evaluate(js, arg): errs.append(f'{s.tag} {what}: {x}')
    async def chk(s, what, root, boxes=None, scroller=None):
        if s.rot: return
        for r in ([root] if isinstance(root, str) else root):
            for x in await s.pg.evaluate(TEXTS, [r, scroller]): errs.append(f'{s.tag} {what}: {x}')
        if boxes:
            for x in await s.pg.evaluate(BOXES, boxes): errs.append(f'{s.tag} {what}: {x}')
    async def board_open(s, m=None):
        if m: await s.setm(m)
        await s.pg.evaluate("window.__blBoards.close(); window.__blBoards.open('w')")
        await s.pg.wait_for_selector('#bdList .bd-r', state='attached', timeout=8000)
        await s.settle()
    async def sheet_open(s, m=None):
        if m: await s.setm(m)
        await s.pg.evaluate("window.__blBoards.close(); window.__blBwSheet.close(); window.__blBwSheet.open()")
        await s.pg.wait_for_selector('#bwRows .bw-r', state='attached', timeout=8000)
        await s.settle()
    async def to_menu(s):
        await s.pg.evaluate("window.__blBoards.close(); window.__blBwSheet.close(); document.getElementById('scrWelcome').hidden = true")
    async def leave(s):
        await s.pg.evaluate("window.__blRp.close('')")
        await s.waitf("window.__blastline.mode === 'menu'", 'back to the menu', 10)
    async def reach_end(s, what):
        """to the end of the run: the last 5 ticks at 2x, a key or a tap skips the KO page once it is on screen"""
        pg = s.pg
        await pg.evaluate("(() => { const R = window.__blRp; R.speed(2); R.seek(R.st.mk.end - 5); })()")
        for _ in range(120):
            if await pg.evaluate("window.__blRp.st.ended && !document.querySelector('.rpv-end').hidden"):
                await s.settle()
                if s.flow: await pg.wait_for_timeout(300)   # a click within 450 ms of the key that skipped the KO page is dropped on purpose (finisher.js)
                return True
            await pg.keyboard.press('Shift'); await pg.wait_for_timeout(100)
        errs.append(f'{s.tag}: timed out: {what}: the end card'); return False
    async def to_end(s, cfg, lv, mt, frm, what):
        await s.pg.evaluate(OPEN, {'cfg': cfg, 'lv': lv, 'meta': mt, 'from': frm})
        if not await s.waitf("window.__blRp.st.on && window.__blRp.st.mk && !window.__blRp.st.loading", f'{what}: opens', 60): return False
        return await s.reach_end(what)

    async def run(s):
        s.ctx, s.pg = await new_page(s.b, s.tag, s.w, s.h, s.mob, s.up)
        s.proto = await s.pg.evaluate("window.__blRpv.proto")
        for name in ('boards', 'play', 'ends', 'titles', 'toasts', 'lastweek', 'results'):
            t0 = time.time()
            try: await getattr(s, name)()
            except Exception as e:
                errs.append(f'{s.tag}: {name} crashed: {type(e).__name__}: {str(e).splitlines()[0][:200]}')
                try: await s.to_menu(); await s.pg.evaluate("window.__blRp.st.on && window.__blRp.close('')")
                except Exception: pass
            TIMES[(s.tag, name)] = time.time() - t0
        await s.ctx.close()

    # ================= 1. board rows and the sheet =================
    async def boards(s):
        pg, need = s.pg, s.need
        await s.board_open(s.M())
        await s.chk('board rows', '#scrBoards .bd-sheet', BD_BOXES, '#bdList')
        await s.geo('board rows', ROWS_FIT, ['#bdList .bd-r, #bdYou .bd-r', '#bdList'])
        await s.shot('board_rows')
        n_ok = await pg.evaluate("document.querySelectorAll('#bdList .bd-r .rpv-pl').length")
        need(n_ok == 8, f'board: {n_ok} ▶ in the list, want 8 (the top 10 less the older version and the one with no run)')
        need(await pg.evaluate("document.querySelectorAll('#bdList .rpv-old').length") == 1, 'board: not exactly one "older version"')
        need(await pg.evaluate("document.querySelectorAll('#bdList .bd-r').length") >= 13, 'board: fewer than 13 rows in the list')
        need(await pg.evaluate("[...document.querySelectorAll('#bdList .bd-r')].slice(10).every((r) => !r.querySelector('.rpv-pl, .rpv-old'))"), 'board: a ▶ or an older-version tag below place 10')
        need(await pg.evaluate("!!document.querySelector('#bdYou .rpv-pl')"), 'board: no ▶ on your row')
        need(await pg.evaluate("!!document.querySelector('#bdList .bd-r .rpv-pl[aria-label=\"Watch Tuber Tom\\'s run\"]')"), 'board: ▶ lacks its "Watch Tuber Tom\'s run" label')
        need(await pg.evaluate("document.querySelector('#bdList .rpv-old').closest('.bd-r').textContent.includes('Peel Appeal')"), 'board: "older version" is not on the older row')
        for x in await pg.evaluate("""() => [...document.querySelectorAll('.rpv-pl')].filter((e) => e.getClientRects().length).map((e) => [e.getBoundingClientRect(), e]).filter(([r]) => r.width < 24 || r.height < 24).map(([r]) => 'a ▶ is ' + r.width + 'x' + r.height)"""): errs.append(f'{s.tag} board: {x}')
        # the sheet: top 3 with ▶ (and older version), your row, WATCH ▶ on your best
        await s.sheet_open(s.M())
        await s.chk('sheet with ▶', '#scrBw .bw-sheet', SHEET_BOXES)
        await s.geo('sheet rows', ROWS_FIT, ['#bwRows .bw-r', '#bwRows'])
        await s.shot('sheet_watch')
        need(await pg.evaluate("document.querySelectorAll('#bwRows .rpv-pl').length") == 3, 'sheet: not 3 ▶ (two of the top 3, one older version, and yours)')
        need(await pg.evaluate("document.querySelectorAll('#bwRows .rpv-old').length") == 1, 'sheet: not exactly one "older version"')
        need(await pg.evaluate("!!document.querySelector('.bw-sub .rpv-wl')") and has(await s.norm('.bw-sub'), 'watch'), 'sheet: no WATCH ▶ on your best')
        await s.setm(s.M(me_old=True)); await pg.evaluate("window.__blBwSheet.render()")
        need(await pg.evaluate("!document.querySelector('.bw-sub .rpv-wl')"), 'sheet: WATCH ▶ on a best from another game version')
        await s.setm(s.M(me_run=False)); await pg.evaluate("window.__blBwSheet.render()")
        need(await pg.evaluate("!document.querySelector('.bw-sub .rpv-wl')"), 'sheet: WATCH ▶ on a best with no run')
        await s.to_menu()

    # ================= 2. the replay: the strip, the livetag (the phone also does what every button does, in real time) =================
    async def play(s):
        pg, need, st, w, h = s.pg, s.need, s.st, s.w, s.h
        if s.flow:   # a ▶ on the board opens the run (fetch stands in for the server)
            await s.board_open(s.M())
            await pg.evaluate(STUB, {'cfg': CFG_PLAY, 'lv': 0.95})
            await s.tap('#bdList .bd-r .rpv-pl')
        else:
            await s.setm(s.M()); await pg.evaluate(OPEN, {'cfg': CFG_PLAY, 'lv': 0.95, 'meta': meta(v=s.proto), 'from': 'board'})
        if not await s.waitf("window.__blRp.st.on && window.__blRp.st.mk", 'the replay opens', 60): return
        if s.flow: await pg.evaluate(UNSTUB)
        need(await st("R.from") == 'board', 'the replay: from is not "board"')
        need(await pg.evaluate("window.__blastline.mode") == 'match' and await pg.evaluate("!document.getElementById('rpv').hidden"), 'the strip is not up')
        need(await pg.evaluate("document.getElementById('app').classList.contains('replay')"), '#app lacks the replay class')
        need(await pg.evaluate("getComputedStyle(document.getElementById('ctl')).display === 'none' && getComputedStyle(document.getElementById('pauseBtn')).display === 'none'"), 'the touch pad or the pause button shows in a replay')
        await s.wake(); await s.settle()   # the countdown: the boss's line is up
        await s.chk('strip at the start', ['#rpv', '.rpv-tag'], HUD + ['.bb-q'])
        t = await s.norm('.rpv-tag')
        need(has(t, 'replay', 'tuber tom'), f'livetag: {t}')
        need(await pg.evaluate("!!document.querySelector('.rpv-tag').closest('#hud')"), 'the livetag is not in the HUD')
        await s.shot('strip_start')
        mk = await st("JSON.parse(JSON.stringify(R.mk))"); D = mk['end']
        need(mk['ko'] > 0 and mk['go'] > 0 and mk['end'] >= mk['ko'] and mk['end'] > 2000, f'the scan found no KO / GO (or a run that is too short): {mk}')
        need(await pg.evaluate("!document.querySelector('.rpv-mk.ko').hidden") and await pg.evaluate("!document.querySelector('.rpv-kob').hidden"), 'the final launch mark or the KO button is missing')
        need(await pg.evaluate("!document.querySelector('.rpv-mk.brk').hidden") == (mk['brk'] > 0), 'the break mark does not follow the scan')
        need(await pg.evaluate("!!document.querySelector('.rpv-mk.ko svg') && !!document.querySelector('.rpv-mk.brk svg')"), 'the marks have no icon')
        need(await pg.evaluate("!document.querySelector('[aria-label=\"Share this run\"]').hidden"), 'a run on the server has no share button')
        need(re.fullmatch(r'\d+:\d\d\.\d / \d+:\d\d\.\d\d', await s.norm('.rpv-time')) is not None, f'time text: {await s.norm(".rpv-time")}')
        if s.flow:
            # fades after 3 s of playing (no pointer, no key), comes back on a key or a tap, and the tap is not a move in the game; a paused replay keeps its controls
            t0 = time.time(); await s.wake()
            need(await pg.evaluate("!document.getElementById('app').classList.contains('rpidle')"), 'the strip is faded right after a key')
            await s.waitf("document.getElementById('app').classList.contains('rpidle')", 'the strip fades', 6); dt = time.time() - t0
            need(2.6 < dt < 4.5, f'the strip fades after {dt:.1f} s, want about 3')
            await pg.wait_for_timeout(300)
            need(await pg.evaluate("+getComputedStyle(document.getElementById('rpv')).opacity < 0.05 && +getComputedStyle(document.querySelector('.rpv-tag')).opacity < 0.05"), 'the strip and the livetag do not fade out')
            await s.wake(); await pg.wait_for_timeout(300)
            need(await pg.evaluate("!document.getElementById('app').classList.contains('rpidle') && +getComputedStyle(document.getElementById('rpv')).opacity > 0.95"), 'a key does not bring the strip back')
            need(await st("!R.pause && !R.ended"), 'a key paused or ended the replay')
            await s.waitf("document.getElementById('app').classList.contains('rpidle')", 'the strip fades again', 6)
            x0 = await st("R.i")
            await s.tap_at(w / 2, h * 0.3); await pg.wait_for_timeout(250)   # a tap on the arena
            need(await pg.evaluate("!document.getElementById('app').classList.contains('rpidle')"), 'a tap does not bring the strip back')
            need(await st("!R.pause && !R.ended && R.i > %d" % x0), 'a tap on the arena paused or ended the replay (or it stood still)')
            seq = []   # speed 1x -> 2x -> 0.5x -> 1x
            for _ in range(3):
                await s.wake(); await s.tap('.rpv-sp'); seq.append((await s.norm('.rpv-sp')).strip())
                if len(seq) < 3: await s.chk(f'strip at {seq[-1]}', ['#rpv', '.rpv-tag'], HUD)
            need(seq == ['2×', '0.5×', '1×'], f'speed button: {seq}, want 2× 0.5× 1×')
            # Space plays and pauses, once: a strip button that has the focus must not be pressed by it as well (it would change the speed)
            await pg.evaluate("document.querySelector('.rpv-sp').focus()")
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(150)
            need(await st("R.pause") and (await s.norm('.rpv-sp')).strip() == '1×', f'Space on a focused strip button: paused {await st("R.pause")}, speed {await s.norm(".rpv-sp")}')
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(150)
            need(await st("!R.pause") and (await s.norm('.rpv-sp')).strip() == '1×', 'Space again does not play on')
            await pg.evaluate("document.activeElement && document.activeElement.blur()")
            await s.wake(); await s.tap('.rpv-play'); await pg.wait_for_timeout(150)
            need(await st("R.pause"), 'the pause button does not pause')
            need(await pg.evaluate("document.querySelector('.rpv-play').getAttribute('aria-label')") == 'Play', 'paused: the button is not "Play"')
            await pg.wait_for_timeout(3300)
            need(await pg.evaluate("!document.getElementById('app').classList.contains('rpidle')"), 'the strip fades while paused')
        else:
            for sp in (2, 0.5):
                await pg.evaluate("(sp) => window.__blRp.speed(sp)", sp)
                await s.waitf("document.querySelector('.rpv-sp').textContent === '%s×'" % sp, f'speed {sp}', 5)
                await s.wake(); await s.chk(f'strip at {sp}x', ['#rpv', '.rpv-tag'], HUD)
            await pg.evaluate("window.__blRp.speed(1); window.__blRp.toggle()")
            await s.waitf("document.querySelector('.rpv-play').getAttribute('aria-label') === 'Play'", 'paused', 5)
        await s.shot('strip_paused')
        await s.chk('strip paused', ['#rpv', '.rpv-tag'], HUD)
        # a toast over the replay sits clear of the strip
        await pg.evaluate("window.__blRpv.toast('Link copied')"); await s.settle()
        await s.chk('toast in a replay', ['.rpv-toast:not(.rpv-load)', '#rpv'], ['.rpv-toast:not(.rpv-load)', '#rpv'])
        await s.shot('toast_replay')
        await pg.evaluate("document.querySelector('.rpv-toast:not(.rpv-load)').hidden = true")
        if not s.flow:
            await pg.evaluate("window.__blRp.seek(%d)" % round(0.4 * D))
            await s.waitf("window.__blRp.st.seeking === false && window.__blRp.st.i > %d" % (0.39 * D), 'seek', 20)
            await s.wake(); await s.chk('strip after a seek', ['#rpv', '.rpv-tag'], HUD)
            await s.shot('strip_seek')
            await s.leave(); return
        # seek by the bar (paused: the tick lands where the bar was tapped)
        rail = await pg.locator('.rpv-rail').bounding_box()
        if s.rot: await s.tap_at(rail['x'] + rail['width'] / 2, rail['y'] + rail['height'] * 0.6)   # turned sideways: the bar runs down the screen
        else: await s.tap_at(rail['x'] + rail['width'] * 0.6, rail['y'] + rail['height'] / 2)
        await s.waitf("window.__blRp.st.seeking === false && Math.abs(window.__blRp.st.i - 0.6 * %d) < 0.02 * %d" % (D, D), 'the bar seeks to 60%', 40)
        i = await st("R.i"); need(abs(i - 0.6 * D) < 0.02 * D and await st("R.pause"), f'seek bar: tick {i} of {D}, want 60% and still paused')
        fw = float((await pg.evaluate("document.querySelector('.rpv-fill').style.width"))[:-1]); need(abs(fw - 60) < 3, f'the fill is at {fw}% after a seek to 60%')
        await s.shot('strip_seek')
        # the spinner while it re-simulates (forced: a seek is over in a blink)
        await pg.evaluate("window.__blRp.st.seeking = true")
        await s.waitf("document.querySelector('.rpv-seek').classList.contains('sk')", 'the spinner shows', 3)
        await s.shot('strip_seeking')
        await pg.evaluate("window.__blRp.st.seeking = false")
        await s.waitf("!document.querySelector('.rpv-seek').classList.contains('sk')", 'the spinner goes', 3)
        # back to the start, then KO
        await s.tap('[aria-label="Watch from the start"]')
        await s.waitf("window.__blRp.st.seeking === false && window.__blRp.st.i < 40", 'the restart button', 40)
        await s.wake(); await s.tap('.rpv-kob')
        await s.waitf("window.__blRp.st.seeking === false && window.__blRp.st.i > %d" % (mk['ko'] - 160), 'the KO button seeks', 40)
        i = await st("R.i"); need(mk['ko'] - 160 <= i <= mk['ko'] + 120 and await st("!R.pause"), f'KO button: tick {i}, the final launch is at {mk["ko"]}')
        # clean view
        await s.wake(); await s.tap('[aria-label="Clean view"]'); await pg.wait_for_timeout(150)
        need(await pg.evaluate("document.getElementById('app').classList.contains('rpclean') && getComputedStyle(document.getElementById('rpv')).visibility === 'hidden' && getComputedStyle(document.getElementById('hud')).visibility === 'hidden'"), 'clean view leaves the HUD or the strip')
        await s.shot('clean')
        p0 = await st("R.pause")
        await s.tap_at(w / 2, h * 0.3); await pg.wait_for_timeout(250)
        need(await pg.evaluate("!document.getElementById('app').classList.contains('rpclean') && getComputedStyle(document.getElementById('rpv')).visibility === 'visible'"), 'a tap does not leave clean view')
        need(await st("R.pause") == p0, 'the tap out of clean view paused or resumed the replay')
        # X: back to the Boards sheet
        await s.wake(); await s.tap('.rpv-x')
        await s.waitf("!window.__blRp.st.on && window.__blastline.mode === 'menu'", 'X leaves the replay', 10)
        need(await pg.evaluate("!document.getElementById('scrBoards').hidden && document.querySelector('#bdTabs .bd-tab.on').textContent === 'Boss Week'"), 'X does not come back to the Boards sheet (Boss Week tab)')
        need(await pg.evaluate("document.getElementById('rpv').hidden && document.querySelector('.rpv-tag').hidden && !document.getElementById('app').classList.contains('replay')"), 'the strip or the livetag stay after X')
        await s.to_menu()

    # ================= 3. the end card: every variant (the phone also taps the buttons) =================
    async def ends(s):
        pg, need, st = s.pg, s.need, s.st
        proto = s.proto
        await s.setm(s.M(boss='kraken'))
        # a run seen on the board
        if await s.to_end(CFG_BW, 0.95, meta(v=proto), 'board', 'end card, not yours'):
            await s.chk('end card (not yours)', ['.rpv-ec', '#rpv', '.rpv-tag'], END_BOXES)
            await s.shot('end_other')
            bt = await pg.evaluate(BTN); t = await s.norm('.rpv-ec')
            need(len(bt) == 5 and has(bt[0], 'your turn', 'fight', 'kraken') and has(bt[1], 'watch again') and has(bt[2], 'board') and has(bt[3], 'menu') and has(bt[4], 'share'), f'end card buttons (not yours): {bt}')
            need(has(t, 'boss week 41', 'zorp', '#1 of 23'), f'end card text: {t}')
            need(re.search(r'\d+:\d\d\.\d\d', t) is not None, f'end card shows no time: {t}')
            need(await pg.evaluate("document.querySelector('.rpv-ea .btn').className.includes('primary')"), 'the first end button is not the gold one')
            if not s.up and not s.rot: need(await pg.evaluate("[...document.querySelectorAll('.rpv-ea2')].every((r) => new Set([...r.children].map((b) => Math.round(b.getBoundingClientRect().top))).size === 1)"), 'the end card\'s small buttons wrap onto a second row')
            if s.flow:
                await s.tap('.rpv-ea2 .btn:nth-child(1)')   # WATCH AGAIN: the end card goes, the run starts over
                await s.waitf("window.__blRp.st.on && !window.__blRp.st.ended && document.querySelector('.rpv-end').hidden", 'WATCH AGAIN starts the run over', 10)
                need(await st("R.i < 400"), 'WATCH AGAIN does not start the run over')
                await s.reach_end('the end card again')
                await s.tap('.rpv-ea2 .btn:nth-child(2)')   # BOARD ›
                await s.waitf("!window.__blRp.st.on && !document.getElementById('scrBoards').hidden", 'BOARD › opens the Boards sheet', 10)
                await s.to_menu()
            else:   # the same card for your own try: the card is made again from the meta
                await pg.evaluate("(() => { const R = window.__blRp.st; Object.assign(R.meta, { own: true, id: '', tid: '', nm: 'Jonny', place: 0, n: 0 }); window.__blRpv.end(); })()"); await s.settle()
                await s.chk('end card (yours)', ['.rpv-ec', '#rpv', '.rpv-tag'], END_BOXES)
                await s.shot('end_own')
                bt = await pg.evaluate(BTN)
                need(len(bt) == 4 and has(bt[0], 'retry') and 'your turn' not in bt[0].lower() and has(bt[1], 'watch again') and has(bt[2], 'board') and has(bt[3], 'menu'), f'end card buttons (yours): {bt}')
                await s.leave()
        if s.flow:
            if await s.to_end(CFG_BW, 0.95, meta(v=proto), 'board', 'end card, MENU'):
                await s.tap('.rpv-ea2 .btn:nth-child(3)')   # MENU
                await s.waitf("!window.__blRp.st.on && window.__blastline.mode === 'menu'", 'MENU leaves the replay', 10)
                need(await pg.evaluate("document.getElementById('scrBoards').hidden"), 'MENU does not go to the menu')
            # your own try: RETRY
            if await s.to_end(CFG_BW, 0.95, meta(v=proto, **META_OWN), 'results', 'end card, yours'):
                await s.chk('end card (yours)', ['.rpv-ec', '#rpv', '.rpv-tag'], END_BOXES)
                await s.shot('end_own')
                bt = await pg.evaluate(BTN)
                need(len(bt) == 4 and has(bt[0], 'retry') and 'your turn' not in bt[0].lower() and has(bt[1], 'watch again') and has(bt[2], 'board') and has(bt[3], 'menu'), f'end card buttons (yours): {bt}')
                need(has(await pg.text_content('.rpv-tag'), 'replay', 'you'), f'livetag of your own run: {await pg.text_content(".rpv-tag")}')
                need(await pg.evaluate("document.querySelector('[aria-label=\"Share this run\"]').hidden"), 'your try has a share button before the server says it is your best')
                await s.leave()
        # a Ranked vs CPU match
        if await s.to_end(CFG_VC, 0.6, meta(v=proto, **META_VC), 'results', 'end card, CPU match'):
            await s.chk('end card (CPU match)', ['.rpv-ec', '#rpv', '.rpv-tag'], END_BOXES)
            await s.shot('end_vc')
            bt = await pg.evaluate(BTN); t = await s.norm('.rpv-ec')
            need(len(bt) == 2 and has(bt[0], 'watch again') and has(bt[1], 'menu'), f'end card buttons (CPU match): {bt}')
            need(await pg.evaluate("document.querySelector('.rpv-ea .btn').className.includes('primary')"), 'the CPU match\'s first end button is not the gold one')
            need(has(t, 'ranked vs cpu') and (has(t, 'victory') or has(t, 'defeat') or has(t, 'draw')), f'CPU end card text: {t}')
            need(has(await pg.text_content('.rpv-tag'), 'replay', 'you vs hard cpu'), f'livetag of a CPU match: {await pg.text_content(".rpv-tag")}')
            need(await pg.evaluate("getComputedStyle(document.querySelector('.rpv-tag')).visibility === 'hidden'"), 'the livetag stays under the end card')
            need(await pg.evaluate("document.querySelector('.rpv-mk.brk').hidden"), 'a CPU match has a break mark')
            need(await pg.evaluate("document.querySelector('.rpv-kob').hidden") == (await st("R.mk.ko") <= 0), 'the KO button of a CPU match does not follow its final launch')
            await s.leave()
        # a lost run: no final launch, no ⚑ and no KO button; the card says what stopped it
        if await s.to_end(CFG_LOST, 0.05, meta(v=proto, id='', own=True, nm='Jonny', place=0, n=0), 'results', 'end card, lost run'):
            await s.chk('end card (lost)', ['.rpv-ec', '#rpv', '.rpv-tag'], END_BOXES)
            await s.shot('end_lost')
            t = await s.norm('.rpv-ec')
            need(has(t, "he's still up") or has(t, 'out of time'), f'lost run: the end card does not say what stopped it: {t}')
            need(await pg.evaluate("document.querySelector('.rpv-kob').hidden && document.querySelector('.rpv-mk.ko').hidden"), 'a lost run has a KO button or a final launch mark')
            await s.leave()

    # ================= 4. the title card of a share link: every state (the phone also leaves it every way) =================
    async def titles(s):
        pg, need, st, proto = s.pg, s.need, s.st, s.proto
        await s.setm(s.M())
        land = lambda l: pg.evaluate("(l) => { window.__blRp.st.land = l; window.__blRpv.title(); }", l)
        OK = {'id': '0123456789ab', 'st': 'ok', 'cfg': CFG_BW, 'meta': meta(v=proto, t=4884), 'codes': [0]}
        LONG = meta(v=proto, nm='Lord Starchington Jr', f='gunslinger', pf='alchemist', boss='kraken', t=14400, fl=12, place=123, n=1234)
        TITLES = [('load', {'st': 'load'}), ('ok', {'st': 'ok', 'cfg': CFG_BW, 'meta': meta(v=proto, t=4884), 'codes': [0]}),
                  ('ok_long', {'st': 'ok', 'cfg': dict(CFG_BW, pl=[['gunslinger', 0], ['alchemist', 0], ['kraken', 0]]), 'meta': LONG, 'codes': [0]}),
                  ('old', {'st': 'old', 'cfg': CFG_BW, 'meta': meta(v=proto - 1, t=4884)}), ('gone', {'st': 'gone'}), ('net', {'st': 'net'}), ('off', {'st': 'off'})]
        WANT = {'load': ['loading the run'], 'ok': ['boss week 41', 'tuber tom', 'vs zorp', '1:21.40', '#1 of 23', 'watch', 'fight zorp'], 'ok_long': ['lord starchington', 'vs kraken', '4:00.00', '#123 of 1234', '12 ♥ lost', 'fight zorp'],
                'old': ['older version', '1:21.40', 'fight zorp'], 'gone': ['isn\'t on the board any more', 'fight zorp'], 'net': ['couldn\'t reach the server', 'try again', 'close'], 'off': ['replays need the server', 'ok']}
        for name, l in TITLES:
            await land(dict({'id': '0123456789ab'}, **l)); await s.settle()
            await s.chk(f'title card {name}', '.rpv-tc', ['.rpv-tc'])
            await s.geo(f'title card {name}', BOXES, ['.rpv-tw > *', '.rpv-tr2 > *', '.rpv-ta .btn', '.rpv-tx', '.rpv-tk'])
            need(await pg.evaluate(TOP, '.rpv-tc') == 'ok', f'title card {name}: covered: {await pg.evaluate(TOP, ".rpv-tc")}')
            await s.shot(f'title_{name}')
            t = await s.norm('.rpv-tc')
            for x in WANT[name]: need(x in t.lower(), f'title card {name} lacks "{x}": {t}')
            need((name in ('ok', 'ok_long')) == (await pg.evaluate("!!document.querySelector('.rpv-go')")), f'title card {name}: the WATCH button is wrong')
        await pg.evaluate("window.__blRpv.titleClose()")
        if not s.flow: return
        # above everything: the Boss Week sheet, the Boards sheet, the welcome sheet
        for what, js in [('the Boss Week sheet', "window.__blBwSheet.open()"), ('the Boards sheet', "window.__blBoards.open('w')"), ('the welcome sheet', "document.getElementById('scrWelcome').hidden = false")]:
            await pg.evaluate(js); await s.settle(); await land(OK); await s.settle()
            need(await pg.evaluate(TOP, '.rpv-tc') == 'ok', f'title card over {what}: {await pg.evaluate(TOP, ".rpv-tc")}')
            need(await pg.evaluate("(() => { const e = document.elementFromPoint(6, 6); return !!e && !!e.closest('.rpv-ti'); })()"), f'title card over {what}: the corner is not under the scrim')
            if what == 'the Boss Week sheet': await s.shot('title_over_sheet')
            await pg.evaluate("window.__blRpv.titleClose()"); await s.to_menu()
        # Escape, X, FIGHT, WATCH
        await land(OK); await s.settle()
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        need(await pg.evaluate("document.querySelector('.rpv-ti').hidden") and await st("!R.land"), 'Escape does not close the title card')
        await land(OK); await s.settle()
        await s.tap('.rpv-tx'); await pg.wait_for_timeout(100)
        need(await pg.evaluate("document.querySelector('.rpv-ti').hidden") and await st("!R.land"), 'X does not close the title card')
        await land(OK); await s.settle()
        await s.tap('.rpv-ta .btn:not(.rpv-go)'); await s.waitf("!document.getElementById('scrBw').hidden", 'FIGHT opens the Boss Week sheet', 5)
        need(await pg.evaluate("document.querySelector('.rpv-ti').hidden && !document.getElementById('scrBw').hidden"), 'FIGHT on the title card does not open the Boss Week sheet')
        await s.to_menu()
        # WATCH plays the run (a real log), under the runner's name; X leaves for the menu
        await pg.evaluate("(a) => { window.__codes = window.__codes || {}; const k = JSON.stringify(a.cfg) + 0.95; if (!window.__codes[k]) window.__codes[k] = window.__blRp.botRun(a.cfg, 0.95);"
                          " window.__blRp.st.land = { id: '0123456789ab', st: 'ok', cfg: a.cfg, meta: a.meta, codes: window.__codes[k] }; window.__blRpv.title(); }", {'cfg': CFG_BW, 'meta': meta(v=proto, t=4884)})
        await s.settle(); await s.tap('.rpv-go')
        await s.waitf("window.__blRp.st.on && window.__blRp.st.mk", 'WATCH on the title card', 60)
        need(await pg.evaluate("document.querySelector('.rpv-ti').hidden") and await st("R.from") == 'link' and has(await s.norm('.rpv-tag'), 'tuber tom'), 'WATCH on the title card does not play the run from the link')
        await s.shot('link_play')
        await s.wake(); await s.tap('.rpv-x')
        await s.waitf("!window.__blRp.st.on && window.__blastline.mode === 'menu'", 'X leaves a link run', 10)
        need(await pg.evaluate("document.getElementById('scrBoards').hidden"), 'X after a link run does not go to the menu')

    # ================= 5. the toast and the loading pill =================
    async def toasts(s):
        pg, need = s.pg, s.need
        TST = '.rpv-toast:not(.rpv-load)'
        for what, js in [('the menu', None), ('the Boss Week sheet', "window.__blBwSheet.open()"), ('the Boards sheet', "window.__blBoards.open('w')")]:
            if what != 'the menu' and not s.flow: continue
            if js: await pg.evaluate(js); await s.settle()
            await pg.evaluate("window.__blRpv.toast('Couldn\\'t reach the server. Try again.')"); await s.settle()
            await s.chk(f'toast over {what}', TST, [TST])
            need(await pg.evaluate(TOP, TST) == 'ok', f'toast over {what}: covered: {await pg.evaluate(TOP, TST)}')
            if what == 'the menu' or what == 'the Boss Week sheet': await s.shot('toast_menu' if what == 'the menu' else 'toast_sheet')
            await s.to_menu()
        if s.flow:   # gone after about 2.6 s
            await pg.evaluate("window.__blRpv.toast('Link copied')")
            await s.waitf("document.querySelector('.rpv-toast:not(.rpv-load)').hidden", 'the toast goes', 4)
        await pg.evaluate("window.__blRpv.load(true)"); await s.settle()
        await s.chk('loading pill', '.rpv-load', ['.rpv-load']); await s.shot('loading')
        need(await pg.evaluate(TOP, '.rpv-load') == 'ok', 'the loading pill is covered')
        await pg.evaluate("window.__blRpv.load(false)")
        need(await pg.evaluate("document.querySelector('.rpv-load').hidden"), 'the loading pill stays')

    # ================= 6. LAST WEEK › =================
    async def lastweek(s):
        pg, need = s.pg, s.need
        await s.board_open(s.M())
        need(await pg.evaluate("!document.getElementById('bdLast').hidden") and has(await s.norm('#bdLast'), 'last week'), f'Last week: no LAST WEEK › in the kicker row ({await s.norm("#bdLast")})')
        await s.chk('kicker row', ['#bdKick', '#bdLast'], ['#bdKick', '#bdLast'])
        await s.tap('#bdLast')
        await s.waitf("document.getElementById('bdKick').innerText.toLowerCase().includes('final')", 'LAST WEEK › loads', 8); await s.settle()
        k = await s.norm('#bdKick')
        need(has(k, 'last week', 'kraken', 'final') and 'ends' not in k.lower(), f'Last week: kicker "{k}"')
        need(has(await s.norm('#bdLast'), 'this week'), f'Last week: toggle says "{await s.norm("#bdLast")}"')
        await s.chk('last week', '#scrBoards .bd-sheet', BD_BOXES, '#bdList')
        await s.geo('last week rows', ROWS_FIT, ['#bdList .bd-r, #bdYou .bd-r', '#bdList'])
        await s.shot('last_week')
        need(await pg.evaluate("document.querySelectorAll('#bdList .bd-r .rpv-pl').length") == 6, 'last week: not 6 ▶ (8 rows, one older version, one with no run)')
        need(await pg.evaluate("document.querySelectorAll('#bdList .rpv-old').length") == 1, 'last week: no "older version"')
        need(await pg.evaluate("!!document.querySelector('#bdYou .rpv-pl')"), 'last week: no ▶ on your row')
        need(await pg.evaluate("document.querySelectorAll('#bdList .bd-r').length") == 8, 'last week: not 8 rows')
        await s.tap('#bdLast')
        await s.waitf("document.getElementById('bdKick').innerText.toLowerCase().includes('ends')", 'THIS WEEK loads', 8)
        k = await s.norm('#bdKick')
        need(has(k, 'zorp', 'ends') and 'final' not in k.lower() and has(await s.norm('#bdLast'), 'last week'), f'This week: kicker "{k}" / toggle "{await s.norm("#bdLast")}"')
        need(await pg.evaluate("document.querySelectorAll('#bdList .bd-r').length") >= 13, 'this week: the board did not come back')
        for what, m in [('no board', s.M(last=None)), ('an empty board', s.M(last='empty'))]:
            await s.setm(m); await s.tap('#bdLast')
            await s.waitf("document.getElementById('bdKick').innerText.toLowerCase().includes('final')", f'LAST WEEK › with {what}', 8)
            await s.waitf("!document.getElementById('bdState').hidden", f'the state with {what}', 8); await s.settle()
            need(has(await s.norm('#bdState'), 'no times last week'), f'Last week with {what}: "{await s.norm("#bdState")}"')
            if what == 'no board': await s.chk('last week, no board', '#scrBoards .bd-sheet', ['#bdTabs', '#bdMain'], '#bdList'); await s.shot('last_week_none')
            await s.tap('#bdLast')
            await s.waitf("document.getElementById('bdKick').innerText.toLowerCase().includes('ends')", 'THIS WEEK loads', 8)
        await pg.evaluate("window.__blBoards.close()")
        # the other tabs have no LAST WEEK
        await pg.evaluate("window.__blBoards.open('c')"); await s.settle()
        need(await pg.evaluate("getComputedStyle(document.getElementById('bdLast')).display === 'none'"), 'the VS CPU tab shows LAST WEEK ›')
        await pg.evaluate("window.__blBoards.close()")

    # ================= 7. WATCH on the results (staged: the real results, with a real server, are tests/pwreplay.py's) =================
    async def results(s):
        pg, need = s.pg, s.need
        await pg.evaluate("(() => { const R = window.__blRp.st; R.last = R.last || { cfg: {}, codes: [], meta: {} }; })()")
        for name, again, chg in [('bw', 'Retry', 'Board'), ('vc', 'Another CPU fight', 'Fighters')]:
            await pg.evaluate("(a) => { window.__blRpv.results({ bw: {} }); document.getElementById('scrResult').hidden = false; document.getElementById('resSheet').classList.add('in');"
                              " document.querySelector('#rAgain span').textContent = a[0]; document.querySelector('#rChange span').textContent = a[1]; document.getElementById('resSheet').scrollTop = 1e5; }", [again, chg])
            await s.settle()
            need(await pg.evaluate("!document.getElementById('rWatch').hidden"), 'results: WATCH is hidden with a run kept')
            await s.chk(f'results {name}', '#resSheet .res-actions', ['#rAgain', '#rWatch', '#rChange', '#rMenu'])
            await s.shot(f'results_{name}')
            need(has(await s.norm('#rWatch'), 'watch'), 'results: the WATCH button has no text')
        await pg.evaluate("document.getElementById('scrResult').hidden = true; window.__blRp.st.last = null; window.__blRpv.results({ bw: {} })")
        need(await pg.evaluate("document.getElementById('rWatch').hidden"), 'results: WATCH stays with no run kept')

async def run_size(b, tag, w, h, mob, up):
    n0, t0 = len(errs), time.time()
    z = Sz(b, tag, w, h, mob, up)
    await z.run()
    print(f'{tag} done in {time.time() - t0:.0f} s, {len(set(errs[n0:]))} problems' + (' (' + ', '.join(f'{k[1]} {v:.0f}' for k, v in TIMES.items() if k[0] == tag) + ')' if os.environ.get('PWRPV_TIME') else ''), flush=True)

async def main():
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        flow = [z for z in SIZES if z[0] in ('phone', 'side')]
        lay = [z for z in SIZES if z[0] not in ('phone', 'side')]
        for z in flow: await run_size(b, *z)   # the real-time flow first, alone
        if os.environ.get('PWRPV_SERIAL'):
            for z in lay: await run_size(b, *z)
        else: await asyncio.gather(*[run_size(b, *z) for z in lay])   # the layout states of the others side by side
        await b.close()
    print('\n'.join(dict.fromkeys(errs)))
    print(f'total {time.time() - t0:.0f} s')
    print('no errors' if not errs else f'{len(set(errs))} problems')
    if not errs: print('rpview ok')
if __name__ == '__main__': asyncio.run(main())
