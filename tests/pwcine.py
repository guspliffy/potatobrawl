# KO films (the live three.js cutscenes in game/cine.js + game/films/*.js): win a practice match with a real lethal final hit and look at the film.
# Usage (from the folder that should get the pictures):
#   python3 tests/pwcine.py [--vs=wizard,odin,...] [--at=900,1600,...] [--tier=A|B|C] [WxH] [--dsf=N] [--up] [--aim=side|left|up] [--sheet] [--skip] [--nogl] [--video=path.mp4] [--fighter=dragon]
# The CPU is a Dummy at 1 life and 400%; the chosen fighter (default dragon) stands next to it and a heavy is pressed, so the engine reports a
# lethal hit on the last life and the finisher starts on that hit. From then on the page clock only moves when the test steps it (CLOCK), so every
# picture is taken at an exact moment of the film however slow the headless GL is. Pictures are named by ms after the final hit.
#   --at=...   freeze frames at those ms (default 900,1600,2300,2800,3100,3600)
#   --tier=    pin the film's quality tier (window.__cineTier); the in-clip watchdog is off then
#   --sheet    stitch the pictures of all opponents into cine-sheet-<size>.jpg (rows: opponents, columns: moments)
#   --skip     tap mid-film (at 1300 ms) and check that the results follow at once
#   --nogl     launch the browser with WebGL off: the old 2D finisher must play, with no errors
#   --video=   step the film at 30 fps from the hit to the results, screenshot every frame at the given size and device scale, encode with ffmpeg
# Prints "no errors" when no page errors happened and every run ended on the results screen as expected.
import sys, json, pathlib, subprocess, shutil, os
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
opt = lambda k, d=None: next((a.split("=", 1)[1] for a in args if a.startswith(k + "=")), d)
screen = "up" if "--up" in args else "cw"
skip, nogl, sheet = "--skip" in args, "--nogl" in args, "--sheet" in args
aim = opt("--aim", "side")
tier = opt("--tier")
dsf = float(opt("--dsf", "1"))
video = opt("--video")
fighter = opt("--fighter", "dragon")
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
ALL = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon"]
vs = opt("--vs", "wizard").split(",")
AT = [int(x) for x in opt("--at", "900,1600,2300,2800,3100,3600").split(",")] if not (skip or video) else []
tag = f"{W}x{H}" + ("-up" if screen == "up" else "") + (f"-{tier}" if tier else "") + ("" if aim == "side" else "-" + aim) + ("-nogl" if nogl else "")
errs, bad, made = [], [], {}

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
    for _ in range(100):
        if pg.evaluate("(ms) => window.__clock.step(ms)", ms): return
        pg.wait_for_timeout(20)

def until(pg, js, limit=8000, step=64):
    for _ in range(limit // step):
        if pg.evaluate(js): return True
        ff(pg, step)
    return False

def until_t(pg, ms):
    for _ in range(400):
        t = pg.evaluate("() => (window.__blastline.fin.on ? window.__blastline.fin.t : 1e9)")
        if t >= ms: return
        ff(pg, 64 if ms - t > 90 else 16)

def shot(pg, name):
    # the DOM layers (white frame, FINISH band, shutters) are CSS animations on the real timeline: park them at the film's own time
    pg.evaluate("() => { const f = window.__blastline.fin; document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Math.min(f.on ? f.t : 9999, 9999); }); }")
    pg.screenshot(path=name)

def run(b, fid, opp):
    ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=dsf)
    ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": "2d", "sound": False, "fs": False, "screen": screen}))
    if tier: ctx.add_init_script(f"window.__cineTier = '{tier}';")
    ctx.add_init_script(CLOCK)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{fid}/{opp}: {e}"))
    pg.on("console", lambda m: errs.append(f"{fid}/{opp}: console {m.text}") if m.type == "error" else None)
    pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
    pg.click("#bPractice"); pg.wait_for_timeout(300)
    pg.click("#lvlPick"); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click("#oppPick"); pg.click(f"#oppPop button >> nth={1 + ALL.index(opp)}")
    pg.click("#selGo")
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    if not nogl:
        pg.wait_for_function("() => window.__blastline.cine.ready || window.__blastline.cine.failed", timeout=60000)
    pg.wait_for_timeout(300)
    cin = pg.evaluate("() => { const c = window.__blastline.cine; return { ready: c.ready, failed: c.failed, why: c.why, tier: c.tier, ms: c.ms, warm: c.warmMs }; }")
    if not nogl and not cin["ready"]: bad.append(f"{fid}/{opp}: the film never got ready ({cin})")
    pg.evaluate("() => window.__clock.freeze()")
    ff(pg, 100)
    for attempt in range(6):
        pg.evaluate("""(aim) => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1];
          d.stocks = 1; d.percent = 400; a.vx = a.vy = d.vx = d.vy = 0;
          if (aim === 'left') { a.x = 10; a.facing = -1; d.x = -40; d.facing = 1; }
          else if (aim === 'up') { a.x = -10; a.facing = 1; d.x = -10; d.facing = -1; }
          else { a.x = -10; a.facing = 1; d.x = 40; d.facing = -1; } }""", aim)
        ff(pg, 32); pg.wait_for_timeout(1300)
        if aim == "up": pg.keyboard.down("KeyW")
        pg.keyboard.down("KeyK"); ff(pg, 48); pg.keyboard.up("KeyK")
        if aim == "up": pg.keyboard.up("KeyW")
        if until(pg, "() => window.__blastline.game.phase !== 'play'", 1500, 16): break
    else:
        bad.append(f"{fid}/{opp}: the forced heavy never ended the game"); ctx.close(); return
    t0 = pg.evaluate("() => performance.now()")
    info = pg.evaluate("() => { const f = window.__blastline.fin; return { on: f.on, cine: f.cine, ev: f.ev ? { final: f.ev.final, mv: f.ev.mv, dirx: f.ev.dirx, diry: f.ev.diry } : null }; }")
    if not info["on"] or not info["ev"] or not info["ev"]["final"]: bad.append(f"{fid}/{opp}: no finisher on the lethal hit ({info})")
    if nogl and info["cine"]: bad.append(f"{fid}/{opp}: the film started although WebGL is off")
    if not nogl and fid == "dragon" and not info["cine"]: bad.append(f"{fid}/{opp}: the film did not start ({cin})")
    files = []
    if video:
        frames = pathlib.Path(video).with_suffix("") .parent / (pathlib.Path(video).stem + "-frames")
        shutil.rmtree(frames, ignore_errors=True); frames.mkdir(parents=True)
        n, acc = 0, 0.0
        while True:
            on = pg.evaluate("() => window.__blastline.fin.on")
            if not on and n > 20: break
            ff(pg, 1000 / 30); n += 1
            shot(pg, str(frames / f"f{n:04d}.png"))
            if n > 400: break
        for _ in range(8):
            ff(pg, 1000 / 30); n += 1; shot(pg, str(frames / f"f{n:04d}.png"))
        print(f"video frames: {n} in {frames}")
    for ms in AT:
        until_t(pg, ms)
        name = f"cine-{fid}-vs-{opp}-{tag}-{ms:04d}.png"
        shot(pg, name); files.append(name)
    if skip:
        until_t(pg, 1300); pg.mouse.click(W // 2, H // 2)
    until(pg, "() => window.__blastline.mode === 'result'", 9000, 32)
    took = pg.evaluate("() => performance.now()") - t0
    ok = pg.evaluate("() => window.__blastline.mode") == "result"
    ff(pg, 500)
    shot(pg, f"cine-{fid}-vs-{opp}-{tag}-result.png")
    st = pg.evaluate("() => { const c = window.__blastline.cine; return { frames: c.frames, tier: c.tier, failed: c.failed, why: c.why }; }")
    ev = info["ev"] or {}
    print(f"{fid} vs {opp}: lethal {ev.get('mv')} dir=({ev.get('dirx', 0):.2f},{ev.get('diry', 0):.2f}) film={info['cine']} tier={cin['tier']} warm-up stages {cin['ms']} compile {cin['warm']} ms; results after {took:.0f} ms; {st}")
    if not ok: bad.append(f"{fid}/{opp}: no results screen")
    if skip and took > 1700: bad.append(f"{fid}/{opp}: skip didn't end it ({took:.0f} ms)")
    if not skip and not video:
        lo, hi = (4100, 4700) if info["cine"] else (3600, 4300)
        if not (lo <= took <= hi): bad.append(f"{fid}/{opp}: results at {took:.0f} ms, wanted {lo}-{hi}")
    if st["failed"] and not nogl: bad.append(f"{fid}/{opp}: the film failed: {st['why']}")
    made[opp] = files
    ctx.close()

with sync_playwright() as p:
    la = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    if nogl: la = ["--disable-gpu", "--disable-3d-apis", "--disable-webgl", "--disable-webgl2"]
    b = p.chromium.launch(args=la)
    for opp in vs:
        run(b, fighter, opp)
    b.close()

if sheet and made:
    from PIL import Image
    rows = [(o, fs) for o, fs in made.items() if fs]
    if rows:
        tw = 360; ims = [[Image.open(f) for f in fs] for _, fs in rows]
        th = int(tw * ims[0][0].height / ims[0][0].width)
        out = Image.new("RGB", (tw * len(ims[0]), th * len(ims)), (10, 10, 14))
        for r, row in enumerate(ims):
            for c, im in enumerate(row): out.paste(im.resize((tw, th)), (c * tw, r * th))
        out.save(f"cine-sheet-{tag}.jpg", quality=88)
        print(f"sheet: cine-sheet-{tag}.jpg ({len(ims)} rows x {len(ims[0])} columns)")
for e in errs + bad: print("ERROR", e)
if not errs and not bad: print("no errors")
if video and not errs:
    frames = pathlib.Path(video).parent / (pathlib.Path(video).stem + "-frames")
    subprocess.run(["/usr/bin/ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", str(frames / "f%04d.png"), "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video], check=True)
    print("video:", video)
