# Manga KO finisher (game/ui/manga.js + game/manga/<id>.js): win a practice match with a real lethal final hit and look at the page.
# Usage (from the folder that should get the pictures):
#   python3 tests/pwmanga.py [--fighter=dragon] [--vs=wizard,odin,...] [--at=600,1500,...] [WxH] [--dsf=N] [--up] [--aim=side|left|up]
#                            [--skip] [--reduced] [--sheet] [--throttle=4] [--video=path.mp4] [--nopage]
# The CPU is a Dummy at 1 life and 400%; the chosen fighter stands next to it and a heavy is pressed, so the engine reports a lethal hit on the
# last life and the finisher starts on that hit. From then on the page clock only moves when the test steps it, so every picture is taken at an
# exact moment of the page however slow the headless browser is. Pictures are named by ms after the final hit.
#   --at=...      freeze frames at those ms (default 600,1500,2200,2900,2950,3100,3700,4300)
#   --skip        tap mid-page (at 1300 ms) and check that the results follow at once
#   --fail        make the page throw while it builds: the 2D finisher must take over and the results must still follow (a warning is expected)
#   --sound       sound on (the page's cues then run for real; with the default sound off they are skipped)
#   --reduced     prefers-reduced-motion: the impact frames become one white frame
#   --sheet       stitch the pictures of all opponents into manga-sheet-<size>.jpg (rows: opponents, columns: moments)
#   --slow / --adaptive  the cheap tier / let the page choose its tier by its own timing (the default pins the full tier)
#   --throttle=N  CPU throttling (a mid phone is about 4); the page's own timing of its draw (FIN.mgStat) is printed either way
#   --video=      step the page at 30 fps from the hit to the results, screenshot every frame at the given size and device scale, encode with ffmpeg
# Prints "no errors" when no page errors happened and every run ended on the results screen as expected.
import sys, json, pathlib, subprocess, shutil
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
opt = lambda k, d=None: next((a.split("=", 1)[1] for a in args if a.startswith(k + "=")), d)
screen = "up" if "--up" in args else "cw"
skip, sheet, reduced, fail = "--skip" in args, "--sheet" in args, "--reduced" in args, "--fail" in args
aim = opt("--aim", "side")
dsf = float(opt("--dsf", "1"))
video = opt("--video")
fighter = opt("--fighter", "dragon")
throttle = float(opt("--throttle", "1"))
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
ALL = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon", "gunslinger", "reaper"]
# a fighter whose page (game/manga/<id>.js) is not written yet (the Reaper, for now) gets the 2D finisher: the run then checks that
# the 2D fallback played and the results followed, instead of failing on the missing page. Once the file exists the page is required.
HAS_PAGE = (ROOT / "game" / "manga" / f"{fighter}.js").exists()
vs = opt("--vs", "wizard").split(",")
AT = [int(x) for x in opt("--at", "600,1500,2200,2900,2950,3100,3700,4300").split(",")] if not (skip or video) else []
tag = f"{W}x{H}" + ("-up" if screen == "up" else "") + ("" if aim == "side" else "-" + aim) + ("-reduced" if reduced else "")
errs, bad, made = [], [], {}

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
    # the DOM layers (white frame, shutters) are CSS animations on the real timeline: park them at the page's own time
    pg.evaluate("() => { const f = window.__blastline.fin; document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Math.min(f.on ? f.t : 9999, 9999); }); }")
    pg.screenshot(path=name)

def run(b, fid, opp):
    ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=dsf, reduced_motion="reduce" if reduced else "no-preference")
    ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": "2d", "sound": "--sound" in args, "fs": False, "screen": screen}))
    ctx.add_init_script(CLOCK)
    ctx.add_init_script("window.__mangaSlow = %s;" % ("true" if "--slow" in args else "undefined" if "--adaptive" in args else "false"))   # pin the quality tier so the pictures do not depend on the machine's speed
    ctx.add_init_script("(() => { const o = CanvasRenderingContext2D.prototype.createPattern; CanvasRenderingContext2D.prototype.createPattern = function (...a) { if (window.__fail) throw new Error('forced failure'); return o.apply(this, a); }; })();")
    warned = []
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{fid}/{opp}: {e}"))
    pg.on("request", lambda r: errs.append(f"{fid}/{opp}: requested {r.url}") if "three" in r.url.lower() else None)   # three.js is not part of the game any more
    def on_console(m):
        if m.type in ("error", "warning"):
            (warned if fail and "Manga finisher failed" in m.text else errs).append(m.text if fail and "Manga finisher failed" in m.text else f"{fid}/{opp}: console {m.text}")
    pg.on("console", on_console)
    if throttle > 1:
        ctx.new_cdp_session(pg).send("Emulation.setCPUThrottlingRate", {"rate": throttle})
    pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
    pg.click("#bPractice"); pg.wait_for_timeout(300)
    pg.click("#lvlPick"); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click("#oppPick"); pg.click(f"#oppPop button >> nth={1 + ALL.index(opp)}")
    pg.click("#selGo")
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    pg.wait_for_timeout(300)
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
    info = pg.evaluate("() => { const f = window.__blastline.fin; return { on: f.on, manga: f.manga, ev: f.ev ? { final: f.ev.final, mv: f.ev.mv, fin: f.ev.fin, dirx: f.ev.dirx, diry: f.ev.diry } : null }; }")
    if not info["on"] or not info["ev"] or not info["ev"]["final"]: bad.append(f"{fid}/{opp}: no finisher on the lethal hit ({info})")
    if not info["manga"] and "--nopage" not in args and HAS_PAGE: bad.append(f"{fid}/{opp}: the manga page did not start")
    if not HAS_PAGE: print(f"{fid}: no manga page yet (game/manga/{fid}.js), the 2D finisher plays: page={info['manga']}")
    if not HAS_PAGE and info["manga"]: bad.append(f"{fid}/{opp}: a manga page started although game/manga/{fid}.js does not exist")
    files = []
    if fail: pg.evaluate("() => { window.__fail = true; }")
    if video:
        frames = pathlib.Path.cwd() / (pathlib.Path(video).stem + "-frames")
        shutil.rmtree(frames, ignore_errors=True); frames.mkdir(parents=True)
        n = 0
        while True:
            on = pg.evaluate("() => window.__blastline.fin.on")
            if not on and n > 20: break
            ff(pg, 1000 / 30); n += 1
            shot(pg, str(frames / f"f{n:04d}.png"))
            if n > 400: break
        for _ in range(8):
            ff(pg, 1000 / 30); n += 1; shot(pg, str(frames / f"f{n:04d}.png"))
        print(f"video frames: {n} in {frames}")
    cdp = None
    if "--cpuprof" in args:
        cdp = ctx.new_cdp_session(pg); cdp.send("Profiler.enable"); cdp.send("Profiler.setSamplingInterval", {"interval": 200}); cdp.send("Profiler.start")
    if "--prof" in args:
        # the draw time of the page over its life: the average and the worst of every 250 ms window, stepped at 60 fps
        rows, outl = {}, []
        for _ in range(400):
            f = pg.evaluate("() => { const f = window.__blastline.fin; return f.on ? [f.t, f.mgStat ? f.mgStat.last : 0] : null; }")
            if f is None: break
            rows.setdefault(int(f[0] // 250) * 250, []).append(f[1]); ff(pg, 1000 / 60)
            if f[1] > 14: outl.append((int(f[0]), f[1]))
        print("frames over 14 ms: " + ", ".join(f"{t}:{v:.0f}" for t, v in outl))
        print("draw ms per 250 ms window (avg/max): " + "  ".join(f"{k}:{sum(v) / len(v):.1f}/{max(v):.1f}" for k, v in sorted(rows.items())))
    for ms in AT:
        until_t(pg, ms)
        name = f"manga-{fid}-vs-{opp}-{tag}-{ms:04d}.png"
        shot(pg, name); files.append(name)
    if skip:
        until_t(pg, 1300); pg.mouse.click(W // 2, H // 2)
    until(pg, "() => window.__blastline.mode === 'result'", 9000, 32)
    took = pg.evaluate("() => performance.now()") - t0
    if cdp:
        prof = cdp.send("Profiler.stop")["profile"]; self_t = {}
        dt = prof["timeDeltas"]; idx = {n["id"]: n for n in prof["nodes"]}
        for sid, d in zip(prof["samples"], dt):
            cf = idx[sid]["callFrame"]; key = f"{cf['functionName'] or '(anon)'}:{cf['lineNumber']}"; self_t[key] = self_t.get(key, 0) + d
        par = {}
        for n in prof["nodes"]:
            for ch in n.get("children", []): par[ch] = n["id"]
        by_caller = {}
        for sid, d in zip(prof["samples"], dt):
            cf = idx[sid]["callFrame"]
            if cf["functionName"] in ("drawImage", "fillRect", "fill", "stroke", "measureText", "getContext", "createPattern", "fillText", "strokeText", "clip"):
                q = idx.get(par.get(sid)); pc = q["callFrame"] if q else None
                key = f"{cf['functionName']} <- {pc['functionName'] if pc else '?'}:{pc['lineNumber'] if pc else 0}:{pc['columnNumber'] if pc else 0}"
                by_caller[key] = by_caller.get(key, 0) + d
        print("native calls by caller (ms):")
        for k, v in sorted(by_caller.items(), key=lambda kv: -kv[1])[:16]: print(f"  {v / 1000:8.1f}  {k}")
        tot = sum(self_t.values()) or 1
        print("cpu profile (self time, ms of %.0f):" % (tot / 1000))
        for k, v in sorted(self_t.items(), key=lambda kv: -kv[1])[:28]: print(f"  {v / 1000:8.1f}  {k}")
    ok = pg.evaluate("() => window.__blastline.mode") == "result"
    ff(pg, 500)
    shot(pg, f"manga-{fid}-vs-{opp}-{tag}-result.png")
    st = pg.evaluate("() => { const s = window.__blastline.fin.mgStat; return s ? { frames: s.n, avg: s.n ? s.sum / s.n : 0, max: s.max } : null; }")
    ev = info["ev"] or {}
    print(f"{fid} vs {opp}: lethal {ev.get('mv')} dir=({ev.get('dirx', 0):.2f},{ev.get('diry', 0):.2f}) page={info['manga']} results after {took:.0f} ms; draw ms: " + (f"avg {st['avg']:.2f} max {st['max']:.2f} over {st['frames']} frames" if st else "-"))
    if not ok: bad.append(f"{fid}/{opp}: no results screen")
    if pg.evaluate("() => typeof THREE") != "undefined": bad.append(f"{fid}/{opp}: three.js is loaded")
    if fail:
        if not warned: bad.append(f"{fid}/{opp}: the forced failure was never reported (the page did not fall back?)")
        else: print("fallback worked:", warned[0][:110])
    if skip and took > 1700: bad.append(f"{fid}/{opp}: skip didn't end it ({took:.0f} ms)")
    if not skip and not video and not fail and HAS_PAGE and not (4400 <= took <= 5000): bad.append(f"{fid}/{opp}: results at {took:.0f} ms, wanted 4400-5000")
    if not skip and not video and not fail and not HAS_PAGE and not (3600 <= took <= 4600): bad.append(f"{fid}/{opp}: 2D finisher results at {took:.0f} ms, wanted 3600-4600")
    made[opp] = files
    ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
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
        out.save(f"manga-sheet-{tag}.jpg", quality=88)
        print(f"sheet: manga-sheet-{tag}.jpg ({len(ims)} rows x {len(ims[0])} columns)")
for e in errs + bad: print("ERROR", e)
if not errs and not bad: print("no errors")
if video and not errs:
    frames = pathlib.Path.cwd() / (pathlib.Path(video).stem + "-frames")
    subprocess.run(["/usr/bin/ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", str(frames / "f%04d.png"), "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video], check=True)
    print("video:", video)
