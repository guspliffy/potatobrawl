# The maps (UI only): every map in a real Practice match at four sizes, picked through the Map picker. For each map and size:
#   start   both fighters on their spawns (the layout: STAGE follows the map, game.map is the picked one)
#   fight   six seconds of two CPUs fighting (the player's side is driven by BL.botInput), then a still
#   ko      the CPU put past the blast zone: the map's KO splash a few frames later
# and the frame cost of the fight against Potato Moon's (always run first as the baseline): mean within +6 ms, p95 within +12 ms
# (software canvas in headless Chromium, so a phone is cheaper). Prints "no errors" when every check passed and no page errors happened.
#   python3 pwmaps.py [outdir [mapid ...]]     (default: every map; sizes s667 = 667x320, p844 = 844x390, d1280 = 1280x760, up390 = upright)
import asyncio, sys, os, json, pathlib, statistics
from playwright.async_api import async_playwright
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
ONLY = sys.argv[2:]
G = 'window.__blastline.game'
SIZES = [('p844', (844, 390), False), ('s667', (667, 320), False), ('d1280', (1280, 760), False), ('up390', (390, 844), True)]
CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__realNow = realNow;
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; } };
})();"""
errs, notes, NAMES = [], [], []
def need(ok, msg):
    if not ok: errs.append(msg)

async def steps(pg, n):
    """n frames of the frozen clock; returns what each frame cost on this machine (ms). A step that found no frame waiting
    (the page had not asked for one yet) is retried after a short real wait."""
    out = []
    while len(out) < n:
        r = await pg.evaluate("() => { const t0 = window.__realNow(), k = window.__clock.step(1000 / 60); return [k, window.__realNow() - t0]; }")
        if r[0]: out.append(r[1])
        else: await pg.wait_for_timeout(15)
    return out

async def run(b, tag, vp, up, mi, mid):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    prof = {'tokens': 85, 'rating': 1080, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True}
    if up: prof['screen'] = 'up'
    await ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', %s)" % json.dumps(json.dumps(prof)))
    await ctx.add_init_script(CLOCK)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{mid} {tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{mid} {tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.wait_for_timeout(900)
    await pg.click('#bPractice'); await pg.wait_for_timeout(400)
    await pg.click('#mapPick'); await pg.wait_for_timeout(200)
    NAMES[:] = [n.strip() for n in (await pg.evaluate("[...document.querySelectorAll('#mapPop button')].map((x) => x.textContent)"))[1:]]   # the picker's names (0 is Random)
    await pg.evaluate("(i) => document.querySelectorAll('#mapPop button')[i + 1].click()", mi)   # 0 is Random
    await pg.wait_for_timeout(200)
    await pg.click('#selGo')
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    await pg.evaluate("window.__clock.freeze()")
    need(await pg.evaluate(f"{G}.map") == mi, f'{mid} {tag}: the match is on map {await pg.evaluate(f"{G}.map")}, want {mi}')
    need(await pg.evaluate("BL.STAGE.id") == mid, f'{mid} {tag}: STAGE is {await pg.evaluate("BL.STAGE.id")}')
    await steps(pg, 40)
    await pg.screenshot(path=f'{OUT}/{mid}-{tag}-1start.png')
    # two CPUs: the player's side is driven by the CPU brain too
    await pg.evaluate(f"(() => {{ const bot = BL.makeBot(0.7); window.__blInput = () => BL.botInput({G}, {G}.fighters[0], {G}.fighters[1], bot); }})()")
    cost = await steps(pg, 360)
    await pg.screenshot(path=f'{OUT}/{mid}-{tag}-2fight.png')
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[1].stocks = Math.max(2, g.fighters[1].stocks); g.fighters[1].x = 900; g.fighters[1].y = -200; }})()")
    await steps(pg, 9)
    await pg.screenshot(path=f'{OUT}/{mid}-{tag}-3ko.png')
    await ctx.close()
    return statistics.mean(cost), sorted(cost)[int(len(cost) * 0.95)]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg0 = await (await b.new_context()).new_page(); await pg0.goto(TEST_URL); await pg0.wait_for_timeout(600)
        maps = await pg0.evaluate("BL.MAPS.map((m) => m.id)")
        want = [m for m in maps if not ONLY or m in ONLY or m == 'moon']
        base = {}
        for tag, vp, up in SIZES:
            for mid in want:
                mean, p95 = await run(b, tag, vp, up, maps.index(mid), mid)
                if mid == 'moon': base[tag] = (mean, p95)
                bm, bp = base.get(tag, (mean, p95))
                line = f'{mid:7s} {tag:6s} frame {mean:5.1f} ms mean, {p95:5.1f} ms p95 (Potato Moon {bm:.1f} / {bp:.1f})'
                print(line, flush=True)
                need(mean <= bm + 6 and p95 <= bp + 12, f'{mid} {tag}: drawing costs too much: {line}')
        for i, (m, n) in enumerate(zip(maps, NAMES)):
            need(m == 'moon' or n.lower() != 'potato moon', f'map {m} has no MAP_ART entry (its picker name is {n!r})')
        await b.close()
    for e in errs: print('PROBLEM', e)
    print('no errors' if not errs else f'{len(errs)} problems')
asyncio.run(main())
