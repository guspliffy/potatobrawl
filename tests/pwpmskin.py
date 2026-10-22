# The Pommes skins in the fight (game/skinfx.js: Ink Noir and Starfall, Fable's step8/fable-design-2.md section 2). UI only.
# For each fighter x line: a practice match against a Dummy wearing that skin (the profile's pal), about 1.6 s of standing, running,
# sprinting (the dash) and light attacks that land, then a KO by this fighter (the Dummy at 400 % with lives to spare and a heavy, so the
# KO is a plain one in the arena, not the last-life finisher). The page clock is taken over as in tests/pwfin.py: every picture is an
# exact frame. Checks: no page errors, the fighter wears the line, the light attacks landed, the KO happened, and the two overlay passes
# cost <= 0.5 ms a frame on average per fighter. The passes are timed by the hook in skinfx.js (window.__pmskProf: the real
# performance.now, the canvas flushed with a 1 px read before and after each pass so its raster counts; the read itself is counted
# too, so the numbers are an upper bound).
# Saves per line one contact sheet: <outdir>/<line>-844.jpg (844x390: 8 fighters x standing, dashing, KO effect) and <line>-up.jpg
# (390x844 upright: 2 fighters), prints each run's cost, the cost per line and "pommes skins ok".
#   python3 tests/pwpmskin.py [outdir] [fighter ...] [--lines=1,2] [--noup] [--raw]   (outdir default /mnt/project-files/step8/skins)
#   --raw  also saves each crop at full size (<outdir>/raw/<line>-<fighter>-<W>-<n>.png)
import sys, json, pathlib, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parent.parent
T = (ROOT / 'build' / 'test.html').as_uri()
args = sys.argv[1:]
opt = lambda k, d=None: next((a.split('=', 1)[1] for a in args if a.startswith(k + '=')), d)
pos = [a for a in args if not a.startswith('--')]
OUT = pathlib.Path(pos[0] if pos and ('/' in pos[0] or pos[0] in ('.', '..')) else '/mnt/project-files/step8/skins')
ALL = ['phoenix', 'alchemist', 'odin', 'wizard', 'samurai', 'dragon', 'gunslinger', 'reaper']
IDS = [a for a in pos if a in ALL] or ALL
LINES = [int(x) for x in opt('--lines', '1,2').split(',')]
NAME = {1: 'ink-noir', 2: 'starfall'}
UP_IDS = ['wizard', 'reaper']
BUDGET = 0.5   # ms a frame per fighter, both passes
FRAME = 17     # ms per stepped frame (one simulation step)
CELL = (252, 228)   # one picture on the sheet (the crop is 210 x 190 world units round the fighter, about 0.6 of its pixels)
errs, bad, cost = [], [], {}

# the page clock runs live until freeze(); after that each step(ms) runs one frame of ms milliseconds (tests/pwfin.py)
CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.__realNow = realNow;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = {
    freeze() { t = realNow(); live = false; },
    step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; },
  };
})();"""
# the scripted input (ui/input.js window.__blInput) and the overlay timer (skinfx.js window.__pmskProf): fighter 0's passes per frame
HOOKS = """(() => {
  window.__pmInp = {};
  window.__blInput = () => window.__pmInp;
  window.__pmskProf = { now: () => window.__realNow(), flush: true, cur: 0, rd: 0, calls: 0, add(slot, ms, rd) { if (slot === 0) { this.cur += ms; this.rd += rd; this.calls++; } } };
})();"""
# one frame with the given input; returns [frames run, ms spent in fighter 0's overlay passes this frame (with the reads), ms of the reads alone, passes]
STEP = """([inp, ms]) => { window.__pmInp = inp; const pr = window.__pmskProf; pr.cur = 0; pr.rd = 0; pr.calls = 0; const n = window.__clock.step(ms); return [n, pr.cur, pr.rd, pr.calls]; }"""
# where fighter 0 is on the screen and the camera's zoom (a 10 unit nudge of y read back through toScreen and put back at once: no frame runs)
WHERE = """() => { const B = window.__blastline, f = B.game.fighters[0], a = B.head; f.y += 10; const b = B.head; f.y -= 10;
  return { x: a[0], y: a[1], z: (b[1] - a[1]) / 10, h: f.s.h }; }"""

def frame(pg, inp, samples):
    for _ in range(200):
        n, ms, rd, calls = pg.evaluate(STEP, [inp, FRAME])
        if n:
            if calls: samples.append((ms, rd))
            return
        pg.wait_for_timeout(15)

def frames(pg, n, inp, samples):
    for _ in range(n): frame(pg, inp, samples)

def shot(pg, name):
    # a crop round fighter 0 (centred on its KO point, 0.6 of its height up), 210 x 190 world units, scaled to one cell
    w = pg.evaluate(WHERE)
    z, cx, cy = w['z'], w['x'], w['y'] + w['h'] * 0.4 * w['z']
    hw, hh = 105 * z, 95 * z
    png = pg.screenshot(clip={'x': cx - hw, 'y': cy - hh, 'width': hw * 2, 'height': hh * 2})
    if '--raw' in args: (OUT / 'raw').mkdir(exist_ok=True); (OUT / 'raw' / f'{name}.png').write_bytes(png)
    return Image.open(io.BytesIO(png)).convert('RGB').resize(CELL, Image.LANCZOS)

def run(b, fid, line, W, H, up):
    tag = f'{fid} {NAME[line]} {W}x{H}'
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
    spec_idx = 8 if line == 1 else 9   # core.js: pal.pommes 1 / 2 are palettes 8 / 9 (checked below)
    prof = {'tut': True, 'last': fid, 'sound': False, 'fs': False, 'screen': 'up' if up else 'cw', 'pal': {fid: spec_idx}, 'owned': {fid: [0, spec_idx]}}
    ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('potatobrawl.profile.v1', %s);" % json.dumps(json.dumps(prof)))
    ctx.add_init_script(CLOCK); ctx.add_init_script(HOOKS)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    pg.goto(T); pg.wait_for_timeout(1200)
    pg.click('#bPractice'); pg.wait_for_timeout(300)
    pg.click('#lvlPick'); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click('#oppPick'); pg.click(f'#oppPop button >> nth={1 + (ALL.index(fid) + 1) % len(ALL)}')
    pg.click('#selGo')
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    pg.wait_for_timeout(200)
    worn = pg.evaluate("() => { const f = window.__blastline.game.fighters[0]; return [f.pal.pommes || 0, f.spec.palettes.indexOf(f.pal), f.pal.name]; }")
    if worn[0] != line: bad.append(f'{tag}: the fighter wears {worn}, not line {line}')
    pg.evaluate("() => window.__clock.freeze()")
    S, pics = [], []
    frame(pg, {}, [])
    pg.evaluate("""() => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1];
      a.x = -190; a.facing = 1; d.x = 150; d.facing = -1; a.vx = a.vy = d.vx = d.vy = 0; }""")
    # standing (0.5 s)
    frames(pg, 30, {}, S); pics.append(shot(pg, f'{NAME[line]}-{fid}-{W}-1'))
    # running (0.5 s), then the sprint: its burst is the dash
    frames(pg, 26, {'x': 1}, S)
    frame(pg, {'x': 1, 'sprint': True}, S)
    frames(pg, 6, {'x': 1}, S)
    spr = pg.evaluate("() => window.__blastline.game.fighters[0].spr")
    if not spr: bad.append(f'{tag}: the sprint did not start')
    pics.append(shot(pg, f'{NAME[line]}-{fid}-{W}-2'))
    frames(pg, 10, {'x': 1}, S)
    # light attacks into the Dummy (Ink Noir: an ink star on each)
    pg.evaluate("""() => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1]; a.x = d.x - 34; a.facing = 1; a.vx = 0; d.percent = 0; }""")
    for i in range(24): frame(pg, {'light': True} if i % 8 == 0 else {}, S)
    hit = pg.evaluate("() => window.__blastline.game.fighters[1].percent")
    if not hit > 0: bad.append(f'{tag}: the light attacks did not land')
    # the KO: the Dummy at 400 % (lives to spare) beside him, a heavy
    s0 = pg.evaluate("() => window.__blastline.game.fighters[1].stocks")
    ko = False
    for attempt in range(4):
        pg.evaluate("""() => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1];
          d.percent = 400; a.x = -10; a.facing = 1; d.x = 40; d.facing = -1; a.vx = a.vy = d.vx = d.vy = 0; }""")
        frames(pg, 3, {}, S)
        frames(pg, 3, {'heavy': True}, S)
        for _ in range(240):
            frame(pg, {}, S)
            if pg.evaluate("(s0) => window.__blastline.game.fighters[1].stocks < s0", s0): ko = True; break
        if ko: break
    if not ko: bad.append(f'{tag}: no KO')
    frames(pg, 13 if line == 1 else 8, {}, S)   # each KO effect near its fullest: Ink Noir's word and burst, Starfall's ring (20 frames)
    pics.append(shot(pg, f'{NAME[line]}-{fid}-{W}-3'))
    frames(pg, 30, {}, S)
    ctx.close()
    n = len(S) or 1
    avg, rd = sum(m for m, _ in S) / n, sum(r for _, r in S) / n
    mx = max((m for m, _ in S), default=0)
    cost.setdefault(line, []).append((fid, avg, mx, len(S), rd))
    print(f'{tag}: overlay {avg:.3f} ms avg ({max(0, avg - rd):.3f} without the reads), {mx:.1f} ms max over {len(S)} frames; light hits {hit:.0f}%, KO {ko} (try {attempt + 1})', flush=True)
    if not S: bad.append(f'{tag}: the overlay passes never ran')
    if avg > BUDGET: bad.append(f'{tag}: the overlay costs {avg:.3f} ms a frame on average (budget {BUDGET})')   # the upper bound (reads counted) keeps to the budget
    return pics

def sheet(cols, path):
    # columns: fighters; rows: standing, dashing, KO effect
    lab, rl = 18, 64
    img = Image.new('RGB', (rl + CELL[0] * len(cols), lab + CELL[1] * 3), (18, 17, 28))
    d = ImageDraw.Draw(img)
    for r, name in enumerate(['standing', 'dashing', 'KO']): d.text((6, lab + r * CELL[1] + CELL[1] // 2 - 6), name, fill=(220, 214, 200))
    for c, (fid, pics) in enumerate(cols):
        d.text((rl + c * CELL[0] + 6, 3), fid, fill=(220, 214, 200))
        for r, p in enumerate(pics): img.paste(p, (rl + c * CELL[0], lab + r * CELL[1]))
    img.save(path, quality=86)
    print('saved', path)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--disable-gpu'])
    OUT.mkdir(parents=True, exist_ok=True)
    for line in LINES:
        cols = [(fid, run(b, fid, line, 844, 390, False)) for fid in IDS]
        sheet(cols, OUT / f'{NAME[line]}-844.jpg')
        if '--noup' not in args:
            cols = [(fid, run(b, fid, line, 390, 844, True)) for fid in UP_IDS if fid in IDS or IDS == ALL]
            if cols: sheet(cols, OUT / f'{NAME[line]}-up.jpg')
    b.close()
for line, rows in cost.items():
    n = sum(r[3] for r in rows)
    avg = sum(r[1] * r[3] for r in rows) / n if n else 0
    rd = sum(r[4] * r[3] for r in rows) / n if n else 0
    print(f'{NAME[line]}: overlay {avg:.3f} ms avg a frame per fighter ({max(0, avg - rd):.3f} without the reads), {max(r[2] for r in rows):.1f} ms max (worst avg {max(rows, key=lambda r: r[1])[0]} {max(r[1] for r in rows):.3f} ms)')
for e in errs + bad: print('ERROR', e)
print('pommes skins ok' if not errs and not bad else 'pommes skins FAILED')
