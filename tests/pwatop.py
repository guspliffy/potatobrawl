# A skin's atop paint (game/skinfx.js skcAtop, laid by game/ui/carve.js K.paintRun) never lands outside the parts it paints.
# For each fighter x each skin with atop paint (Devil's Roast, Specimen, Harvest Gold, Ink Noir, Starfall) x each way the kit draws:
#   sprite  the figure from its sprites (the paint baked in, clipped to each part's fills under its ink: cvAtopGroups), after 30 frames
#           that bake them all
#   path    the figure as paths (window.__cvTest.vec: what a manga page and the hit flash get; the paint laid the same way)
#   dim     the helpless figure (P.dim: paths, half alpha)
#   big     drawn 14 device pixels a unit, so the runs are over CV_SPRITE_MAX and fall back to paths (the select screen, the Skin Rack)
# the figure is drawn twice on a transparent canvas, the same frame with and without the atop paint (window.__cvTest.atopOff drops the
# sprites too), and two kinds of pixel are counted, 0 expected of each: outside, the paint where the figure without it left the canvas
# empty (alpha over 8 of 255: less is a fill edge's antialiasing); on the ink, the paint on a pixel wholly of a carved part's ink
# without it (window.__cvTest.inkTest draws that ink pure green in both pictures; a painted-over outline reads as a pale ghost round
# the part and changes its pixels by 150 or more), changed by more than 32 of 255 in a channel (less is a fill's edge pixel, where the
# clip and the fill are antialiased apart: up to 24 seen; the largest of each is printed). Also counted: the pixels the paint changed
# elsewhere (it must draw something). Opens build/test.html (python3 game/build.py first).
# Prints one line per fighter and "atop ok" or "atop FAILED"; "no errors" when no page error happened.
#   python3 tests/pwatop.py [fighter ...] [--modes=sprite,path,dim,big]
import sys, json, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
T = (ROOT / 'build' / 'test.html').as_uri()
args = sys.argv[1:]
ALL = ['phoenix', 'alchemist', 'odin', 'wizard', 'samurai', 'dragon', 'gunslinger', 'reaper']
IDS = [a for a in args if a in ALL] or ALL
MODES = next((a.split('=', 1)[1].split(',') for a in args if a.startswith('--modes=')), ['sprite', 'path', 'dim', 'big'])
SKINS = [(4, "Devil's Roast"), (5, 'Specimen'), (7, 'Harvest Gold'), (8, 'Ink Noir'), (9, 'Starfall')]
errs, bad, inkmax, outmax = [], [], 0, 0

CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; } };
})();"""
# fighter 0 standing (or helpless, in the air) where the camera does not matter: the test draws it on its own canvas
POSE = """([st]) => {
  const g = window.__blastline.game, f = g.fighters[0];
  Object.assign(f, { x: -60, y: 0, facing: 1, vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, grounded: true, state: 'idle', st: 6, move: null, mid: null, mt: 0,
    chg: 0, spr: 0, tumble: false, dodgeKind: null, armorFlash: 0, invuln: 0 });
  if (st === 'helpless') Object.assign(f, { state: 'helpless', grounded: false, y: -60, vy: 3 });
}"""
# one case: the frame drawn with and without the atop paint (each after the same warm-up frames); returns the counts and where the
# outside pixels are (standing-frame units, the feet at 0)
CASE = """([z, mode, pal, warm]) => {
  const X = window.__cvTest, f = window.__blastline.game.fighters[0], W = Math.round(150 * z), H = Math.round(140 * z);
  const p0 = f.pal; f.pal = f.spec.palettes[pal];
  X.vec = mode === 'path';
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const draw = (tk) => { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.setTransform(z, 0, 0, z, (75 - f.x) * z, (120 - f.y) * z); X.draw(c, f, tk); };
  const shot = (off) => { X.atopOff = off; for (let i = 0; i < warm; i++) draw(100 + i); draw(100 + warm); c.setTransform(1, 0, 0, 1, 0, 0); return c.getImageData(0, 0, W, H).data; };
  let A, B;
  X.inkTest = '#00ff00';   // the carved ink drawn pure green (both pictures), so a pixel of it is known exactly
  try { A = shot(false); B = shot(true); } finally { X.atopOff = false; X.vec = false; X.inkTest = null; f.pal = p0; }
  let out = 0, outMax = 0, ink = 0, inkMax = 0, inside = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const at = (i) => { const ux = ((i / 4) % W) / z - 75, uy = Math.floor(i / 4 / W) / z - 120; x0 = Math.min(x0, ux); x1 = Math.max(x1, ux); y0 = Math.min(y0, uy); y1 = Math.max(y1, uy); };
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]), Math.abs(A[i + 3] - B[i + 3]));
    if (B[i + 3] === 0) { outMax = Math.max(outMax, A[i + 3]); if (A[i + 3] > 8) { out++; at(i); } }
    else if (d && B[i] === 0 && B[i + 1] === 255 && B[i + 2] === 0 && B[i + 3] === 255) { inkMax = Math.max(inkMax, d); if (d > 32) { ink++; at(i); } }
    else if (d) inside++;
  }
  return { out, outMax, ink, inkMax, inside, box: out || ink ? [x0, y0, x1, y1].map((v) => Math.round(v)) : null, name: f.spec.palettes[pal].name };
}"""

def step(pg, n=1):
    for _ in range(n):
        for _ in range(200):
            if pg.evaluate("() => window.__clock.step(17)"):
                break
            pg.wait_for_timeout(10)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--disable-gpu'])
    for fid in IDS:
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
        prof = {'tut': True, 'last': fid, 'sound': False, 'fs': False, 'screen': 'cw'}
        ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('potatobrawl.profile.v1', %s);" % json.dumps(json.dumps(prof)))
        ctx.add_init_script(CLOCK)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'{fid}: {e}'))
        pg.goto(T); pg.wait_for_timeout(1200)
        pg.click('#bPractice'); pg.wait_for_timeout(300)
        pg.click('#lvlPick'); pg.click("#lvlPop button:has-text('Dummy')")
        pg.click('#oppPick'); pg.click(f'#oppPop button >> nth={1 + (ALL.index(fid) + 1) % len(ALL)}')
        pg.click('#selGo')
        pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
        pg.wait_for_timeout(300)
        pg.evaluate("() => window.__clock.freeze()")
        pg.evaluate("() => { const g = window.__blastline.game; g.hitstop = 1e9; window.__blastline.r3.lockQ = true; }")
        step(pg, 2)
        sid = pg.evaluate("() => window.__blastline.game.fighters[0].spec.id")
        if sid != fid: bad.append(f'{fid}: playing {sid}')
        line = []
        for pal, sk in SKINS:
            for mode in MODES:
                pg.evaluate(POSE, ['helpless' if mode == 'dim' else 'idle'])
                r = pg.evaluate(CASE, [14 if mode == 'big' else 4, mode, pal, 30 if mode in ('sprite', 'big') else 2])
                if r['name'] != sk: bad.append(f'{fid}: palette {pal} is {r["name"]}, not {sk}')
                if r['out'] or r['ink']: bad.append(f"{fid} {sk} {mode}: atop paint {r['out']} px outside the figure, {r['ink']} px on its ink, at x {r['box'][0]}..{r['box'][2]}, y {r['box'][1]}..{r['box'][3]}")
                if not r['inside']: bad.append(f'{fid} {sk} {mode}: the atop paint drew nothing')
                line.append(f"{sk.split()[0][:6]}/{mode} {r['out']}+{r['ink']}")
                inkmax, outmax = max(inkmax, r['inkMax']), max(outmax, r['outMax'])
        print(f'{fid}: px outside + on the ink: ' + ', '.join(line), flush=True)
        ctx.close()
    b.close()
for e in bad: print('BAD', e)
print(f'the largest change on an ink pixel: {inkmax} of 255; the largest alpha outside the figure: {outmax} of 255')
print('atop ok' if not bad else 'atop FAILED')
print('errors:', errs[:5] if errs else 'no errors')
