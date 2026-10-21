# The combo routes as a video: the Combo trial for a few fighters (a scripted player lands each route; the keys light up,
# the pop-up names the route, "Cleared!"), at half speed so the link is readable. The page clock only moves when the script
# steps it, so every frame is an exact moment however slow the browser is.
#   python3 tests/pwcomboreel.py [--out=combos.mp4] [WxH] [--dsf=2] [--slow=0.5]
# Needs /usr/bin/ffmpeg. Prints "no errors" when the page threw nothing.
import sys, json, pathlib, subprocess, shutil
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests"))
args = sys.argv[1:]
opt = lambda k, d=None: next((a.split("=", 1)[1] for a in args if a.startswith(k + "=")), d)
out = pathlib.Path(opt("--out", "combos.mp4")).resolve()
dsf = float(opt("--dsf", "2"))
slow = float(opt("--slow", "0.5"))
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
FRAME = 1000 / 30
errs = []
src = (ROOT / "tests" / "pwcombo.py").read_text()
DRIVER = src.split('DRIVER = r"""')[1].split('"""')[0]
CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; } };
})();"""
CAP = """(t) => { let e = document.getElementById('reelCap');
  if (!e) { e = document.createElement('div'); e.id = 'reelCap'; e.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;padding:4px 12px;border-radius:6px;background:rgba(10,10,20,.72);color:#fff;font:700 15px/1.2 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;white-space:nowrap'; document.body.appendChild(e); }
  e.textContent = t; e.style.display = t ? 'block' : 'none'; }"""
SHOW = [("samurai", "blink"), ("samurai", "lift"), ("samurai", "sig"), ("odin", "hammer"), ("reaper", "reap"), ("phoenix", "skyburn"), ("gunslinger", "rising")]

frames_dir = out.with_name(out.stem + "-frames")
shutil.rmtree(frames_dir, ignore_errors=True); frames_dir.mkdir(parents=True)
n = 0


def step(pg, ms):
    for _ in range(100):
        if pg.evaluate("(ms) => window.__clock.step(ms)", ms): return
        pg.wait_for_timeout(20)


def frame(pg, speed):
    global n
    step(pg, FRAME * speed); n += 1
    pg.screenshot(path=str(frames_dir / f"f{n:05d}.png"))


with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-gpu"])
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=dsf, has_touch=False, is_mobile=False)
    ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": "samurai", "sound": False, "fs": False}))
    ctx.add_init_script(CLOCK)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
    pg.evaluate("() => window.__clock.freeze()")
    for _ in range(10): step(pg, FRAME)
    cur = None
    for fid, rid in SHOW:
        if fid != cur:
            if cur: pg.click("#tutSkip"); step(pg, FRAME)
            pg.click("#bSettings"); step(pg, FRAME); pg.click("#bHelp"); step(pg, FRAME)
            pg.click(f'#helpCombos .rc-figs .chip[data-f="{fid}"]'); step(pg, FRAME)
            pg.click("#hTrial")
            pg.evaluate(DRIVER)
            for _ in range(60): step(pg, FRAME)   # the countdown, off camera
            cur = fid
        for _ in range(8):
            if pg.evaluate("() => window.__blastline.trial.id") == rid: break
            pg.click("#tutNext"); step(pg, FRAME)
        name = pg.text_content("#tutT")
        pg.evaluate(CAP, f"{name}  (half speed)")
        k, done = 0, -1
        while k < 600:
            frame(pg, slow); k += 1
            t = pg.evaluate("() => window.__blastline.trial")
            if done < 0 and t["hold"] > 0: done = k
            if done >= 0 and k - done > 40: break
        if done < 0: errs.append(f"{fid} {rid} not cleared in the video")
        while pg.evaluate("() => window.__blastline.trial.hold") > 0: step(pg, FRAME)
    pg.evaluate(CAP, "")
    b.close()

subprocess.run(["/usr/bin/ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", str(frames_dir / "f%05d.png"),
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", str(out)], check=True)
shutil.rmtree(frames_dir, ignore_errors=True)
print(out, n, "frames")
for e in errs: print("ERROR", e)
if not errs: print("no errors")
