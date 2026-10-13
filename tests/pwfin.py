# KO finisher: for each fighter, win a practice match with a real lethal final hit and screenshot the cinematic.
# Usage (from the folder that should get the screenshots): python3 tests/pwfin.py [fighter ...] [--2d] [WxH] [--skip] [--up] [--self]
# The CPU is a Dummy at 1 life and 400%; fighter 0 stands next to it and a heavy (KeyK) is pressed, so the engine
# reports a lethal hit on the last life and the finisher starts on that hit.
# Once the match is running the page's clock is taken over by the test (see CLOCK: rAF and performance.now only move when the test steps
# them), so every picture is taken at an exact moment of the cinematic no matter how slow the headless GL is. Pictures are named by ms after the final hit.
# --up    plays an upright phone with the Screen setting on Upright (controls panel under the arena); give WxH like 390x844.
# --skip  taps the screen mid-cinematic and checks that the results come right away.
# --aim=left|up  hit to the other side / with an up heavy (the launch direction then differs; the staging mirrors / flies up)
# --self  the opponent is teleported off the arena instead (a self-destruct): NO finisher may play, the "Game!" banner and the results do.
# Prints "no errors" when no page errors happened and every run ended on the results screen as expected.
import sys, json, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
gfx = "2d"   # matches are 2D only since M4 (the flag is ignored by the game)
screen = "up" if "--up" in args else "cw"
skip = "--skip" in args
selfkill = "--self" in args
aim = next((a.split("=")[1] for a in args if a.startswith("--aim=")), "side")
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
ALL = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon", "gunslinger"]
ids = [a for a in args if not a.startswith("--") and not a[0].isdigit()] or ALL
# moments (ms after the final hit): beat 0 is the real hit, 520 the cut, ~1520 the winner's impact, then the loser's flight, the card
TIMES = [] if (skip or selfkill) else [60, 200, 340, 500, 620, 1000, 1400, 1530, 1650, 1760, 1860, 1960, 2150, 2450, 2900, 3500]
tag = f"{gfx}-{W}x{H}" + ("-up" if screen == "up" else "") + ("" if aim == "side" else "-" + aim)
errs, bad = [], []

# Runs live (real rAF, real time) until freeze(); after that each step(ms) is one frame of ms milliseconds.
CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = {
    freeze() { t = realNow(); live = false; },
    step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; },
  };
})();"""

def ff(pg, ms):
    # one frame of ms milliseconds (the game clamps a frame to 120 ms)
    for _ in range(100):
        if pg.evaluate("(ms) => window.__clock.step(ms)", ms): return
        pg.wait_for_timeout(20)

def until(pg, js, limit=8000, step=64):
    for _ in range(limit // step):
        if pg.evaluate(js): return True
        ff(pg, step)
    return False

def until_t(pg, ms):
    # step the cinematic to ms after the final hit: 64 ms jumps, 16 ms near the target
    for _ in range(400):
        t = pg.evaluate("() => (window.__blastline.fin.on ? window.__blastline.fin.t : 1e9)")
        if t >= ms: return
        ff(pg, 64 if ms - t > 90 else 16)

def shot(pg, name):
    # the DOM layers (white frame, FINISH band) are CSS animations on the real timeline: park them at the cinematic's own time
    pg.evaluate("() => { const f = window.__blastline.fin; document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Math.min(f.on ? f.t : 9999, 9999); }); }")
    pg.screenshot(path=f"fin-{name}.png")

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for fid in ids:
        ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=1)
        ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": gfx, "sound": False, "fs": False, "screen": screen}))
        ctx.add_init_script(CLOCK)
        pg = ctx.new_page(); pg.on("pageerror", lambda e, fid=fid: errs.append(f"{fid}: {e}"))
        pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
        pg.click("#bPractice"); pg.wait_for_timeout(300)
        # a Dummy CPU (stands still), playing the next fighter in the list
        pg.click("#lvlPick"); pg.click("#lvlPop button:has-text('Dummy')")
        pg.click("#oppPick"); pg.click(f"#oppPop button >> nth={1 + (ALL.index(fid) + 1) % len(ALL)}")
        pg.click("#selGo")
        pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
        pg.wait_for_timeout(300)
        # from here on the page clock only moves when the test steps it
        pg.evaluate("() => window.__clock.freeze()")
        ff(pg, 100)
        if selfkill:
            pg.evaluate("() => { const g = window.__blastline.game, f = g.fighters[1]; f.stocks = 1; f.x = 99999; }")
        else:
            for attempt in range(6):
                pg.evaluate("""(aim) => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1];
                  d.stocks = 1; d.percent = 400; a.vx = a.vy = d.vx = d.vy = 0;
                  if (aim === 'left') { a.x = 10; a.facing = -1; d.x = -40; d.facing = 1; }
                  else if (aim === 'up') { a.x = -10; a.facing = 1; d.x = -10; d.facing = -1; }
                  else { a.x = -10; a.facing = 1; d.x = 40; d.facing = -1; } }""", aim)
                ff(pg, 32); pg.wait_for_timeout(1300)   # (the percent jump above shows the Finish! banner; let it go first)
                if aim == "up": pg.keyboard.down("KeyW")
                pg.keyboard.down("KeyK"); ff(pg, 48); pg.keyboard.up("KeyK")
                if aim == "up": pg.keyboard.up("KeyW")
                if until(pg, "() => window.__blastline.game.phase !== 'play'", 1500, 16): break
            else:
                bad.append(f"{fid}: the forced heavy never ended the game"); ctx.close(); continue
        if selfkill: until(pg, "() => window.__blastline.game.phase !== 'play'", 1000, 16)
        t0 = pg.evaluate("() => performance.now()")
        info = pg.evaluate("() => { const f = window.__blastline.fin; return { on: f.on, ev: f.ev ? { final: f.ev.final, fin: f.ev.fin, mv: f.ev.mv, dirx: f.ev.dirx, diry: f.ev.diry } : null, manga: !!f.manga }; }")
        if selfkill:
            # the old teleport is a self-destruct: no finisher at any moment, "Game!" banner, results appear
            seen_fin = info["on"]
            for _ in range(14): ff(pg, 32)
            banner_txt = pg.evaluate("() => (document.getElementById('banner').hidden ? '' : document.querySelector('#banner .b-main').textContent)")
            shot(pg, f"{fid}-{tag}-self-game")
            if banner_txt.strip().lower() != "game!": bad.append(f"{fid}: banner was '{banner_txt}', wanted 'Game!'")
            for _ in range(200):
                ff(pg, 32)
                if pg.evaluate("() => window.__blastline.fin.on"): seen_fin = True
                if pg.evaluate("() => window.__blastline.mode") == "result": break
            took = pg.evaluate("() => performance.now()") - t0
            ok = pg.evaluate("() => window.__blastline.mode") == "result"
            ff(pg, 400); shot(pg, f"{fid}-{tag}-self-result")
            print(f"{fid}: self-destruct, banner '{banner_txt}', finisher played: {seen_fin}, results shown: {ok} after {took:.0f} ms")
            if seen_fin: bad.append(f"{fid}: a finisher played for a self-destruct")
            if not ok: bad.append(f"{fid}: no results after the self-destruct")
            ctx.close(); continue
        if not info["on"] or not info["ev"] or not info["ev"]["final"]:
            bad.append(f"{fid}: no finisher on the lethal hit ({info})")
        for ms in TIMES:
            until_t(pg, ms)
            shot(pg, f"{fid}-{tag}-{ms:04d}")
        if skip:
            until_t(pg, 1300); pg.mouse.click(W // 2, H // 2)
        until(pg, "() => window.__blastline.mode === 'result'", 8000, 32)
        took = pg.evaluate("() => performance.now()") - t0
        ok = pg.evaluate("() => window.__blastline.mode") == "result"
        ff(pg, 500)
        shot(pg, f"{fid}-{tag}-result")
        ev = info["ev"] or {}
        print(f"{fid}: lethal {ev.get('mv')} dir=({ev.get('dirx', 0):.2f},{ev.get('diry', 0):.2f}) fin={ev.get('fin')}, results after {took:.0f} ms{' (manga page)' if info.get('manga') else ''}")
        if not ok: bad.append(f"{fid}: no results screen")
        if skip and took > 1700: bad.append(f"{fid}: skip didn't end it ({took:.0f} ms)")
        lo, hi = (4400, 5000) if info.get("manga") else (3600, 4300)   # the manga page (4.7 s) is a little longer than the 2D staging
        if not skip and not (lo <= took <= hi): bad.append(f"{fid}: results at {took:.0f} ms, wanted {lo}-{hi}")
        ctx.close()
    b.close()
for e in errs + bad: print("ERROR", e)
if not errs and not bad: print("no errors")
