# KO finisher: for each fighter, win a practice match by a forced KO and screenshot the cinematic.
# Usage (from the folder that should get the screenshots): python3 tests/pwfin.py [fighter ...] [--2d] [WxH] [--skip] [--up]
# --up plays an upright phone with the Screen setting on Upright (controls panel under the arena).
# Prints "no errors" when no page errors happened and every finisher ended on the results screen.
import sys, json, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
gfx = "2d" if "--2d" in args else "3d"
screen = "up" if "--up" in args else "cw"
skip = "--skip" in args
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
ids = [a for a in args if not a.startswith("--") and not a[0].isdigit()] or ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon"]
TIMES = [400, 800, 1250, 1600, 1760, 1900, 2200, 2700, 3200] if not skip else []
errs, bad = [], []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for fid in ids:
        ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=1)
        ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": gfx, "sound": False, "fs": False, "screen": screen}))
        pg = ctx.new_page(); pg.on("pageerror", lambda e, fid=fid: errs.append(f"{fid}: {e}"))
        pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
        pg.click("#bPractice"); pg.wait_for_timeout(300); pg.click("#selGo")
        pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
        pg.evaluate("() => { const g = window.__blastline.game, f = g.fighters[1]; f.stocks = 1; f.x = 99999; }")
        pg.wait_for_function("() => window.__blastline.game.phase !== 'play'", timeout=10000)
        t0 = pg.evaluate("() => performance.now()")
        for ms in TIMES:
            # run the cinematic slowly up to this moment, freeze it, take the picture, carry on
            pg.evaluate("() => { window.__blastline.fin.rate = 0.35; }")
            pg.wait_for_function(f"() => !window.__blastline.fin.on || window.__blastline.fin.t >= {ms}", timeout=60000)
            pg.evaluate("() => { window.__blastline.fin.rate = 0; }"); pg.wait_for_timeout(120)
            pg.screenshot(path=f"fin-{fid}-{gfx}-{W}x{H}-{ms:04d}.png")
        pg.evaluate("() => { window.__blastline.fin.rate = 1; }")
        if skip:
            pg.wait_for_timeout(1300); pg.mouse.click(W // 2, H // 2)
        pg.wait_for_function("() => window.__blastline.mode === 'result'", timeout=15000)
        took = pg.evaluate("() => performance.now()") - t0
        pg.wait_for_timeout(500)
        pg.screenshot(path=f"fin-{fid}-{gfx}-{W}x{H}-result.png")
        print(f"{fid}: results after {took:.0f} ms")
        if skip and took > 3000: bad.append(f"{fid}: skip didn't end it ({took:.0f} ms)")
        ctx.close()
    b.close()
for e in errs + bad: print("ERROR", e)
if not errs and not bad: print("no errors")
