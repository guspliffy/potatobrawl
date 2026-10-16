# A fighter's move reel as a video: every light, heavy (with a held charge), air move, the special, the special against a
# finish-ready opponent on his last life (the KO finisher plays), the recovery and the drift, plus the four skins. Each part is
# captioned. The page clock only moves when the script steps it, so every frame is an exact moment however slow the browser is.
# Usage (writes into the current folder unless --out is given):
#   python3 tests/pwreel.py [--fighter=reaper] [--vs=phoenix] [--out=reel.mp4] [--sheet=reel-sheet.jpg] [WxH] [--dsf=2] [--slow=0.5]
#   --slow   game speed in the move parts (0.5 = half speed, so a 6-frame swing is readable); the finisher always plays at full speed
# Needs /usr/bin/ffmpeg. Prints "no errors" when the page threw nothing.
import sys, json, pathlib, subprocess, shutil
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
opt = lambda k, d=None: next((a.split("=", 1)[1] for a in args if a.startswith(k + "=")), d)
fid = opt("--fighter", "reaper")
opp = opt("--vs", "phoenix")
out = pathlib.Path(opt("--out", f"{fid}-reel.mp4")).resolve()
sheet_path = pathlib.Path(opt("--sheet", str(out.with_name(out.stem + "-sheet.jpg")))).resolve()
dsf = float(opt("--dsf", "2"))
slow = float(opt("--slow", "0.5"))
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
ALL = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon", "gunslinger", "reaper"]
# move names for the captions; a fighter missing here gets plain labels
NAMES = {
    "reaper": {"jab": "handle poke", "side": "long thrust", "up": "overhead flick", "down": "low poke", "hSide": "Reap", "hUp": "Overhead arc",
               "hDown": "Grave sweep", "nair": "scythe spin", "sair": "slash", "uair": "high arc", "dair": "spike", "hAir": "Reap (air)",
               "pound": "plunge", "spec": "Harvest", "fin": "Last Rites", "rec": "Grave rise"},
}.get(fid, {})
nm = lambda k, d: f"{d}: {NAMES[k]}" if k in NAMES else d
FRAME = 1000 / 30
errs = []

CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; } };
})();"""
# put both fighters back on their marks; o = {x, y, air, facing, pct, stocks, ox, oy, pal}
RESET = """(o) => {
  const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1];
  const put = (f, x, y, air, facing) => { Object.assign(f, { x, y, vx: 0, vy: 0, kbx: 0, kby: 0, facing, grounded: !air, plat: -1, state: air ? 'air' : 'idle', st: 0,
    move: null, mid: null, mt: 0, hitstun: 0, tumble: false, flash: 0, chg: 0, invuln: 0, ledge: 0, recUsed: false, airDodged: false, hitLog: {} }); f.airJumps = f.s.airJumps; };
  put(a, o.x, o.y || 0, !!o.air, o.facing || 1); a.specCd = 0; a.percent = 0; a.stocks = 3;
  if (o.pal != null) a.pal = a.spec.palettes[o.pal];
  put(d, o.ox, o.oy || 0, !!o.oair, -(o.facing || 1)); d.percent = o.pct || 0; d.stocks = o.stocks || 3; d.specCd = 0;
  g.projs.length = 0;
}"""
CAP = """(t) => { let e = document.getElementById('reelCap');
  if (!e) { e = document.createElement('div'); e.id = 'reelCap'; e.style.cssText = 'position:fixed;left:50%;top:15%;transform:translateX(-50%);z-index:99999;padding:4px 12px;border-radius:6px;background:rgba(10,10,20,.72);color:#fff;font:700 15px/1.2 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;white-space:nowrap'; document.body.appendChild(e); }
  e.textContent = t; e.style.display = t ? 'block' : 'none'; }"""

frames_dir = out.with_name(out.stem + "-frames")
shutil.rmtree(frames_dir, ignore_errors=True); frames_dir.mkdir(parents=True)
n = 0
stills = []   # (caption, frame path) for the contact sheet


def step(pg, ms):
    for _ in range(100):
        if pg.evaluate("(ms) => window.__clock.step(ms)", ms): return
        pg.wait_for_timeout(20)


def frame(pg, speed=1.0):
    global n
    step(pg, FRAME * speed); n += 1
    p = frames_dir / f"f{n:05d}.png"
    pg.screenshot(path=str(p))
    return p


def part(pg, cap, setup, inputs, frames, speed=None, still=None, crop=True):
    """inputs: list of (video frame, 'down'|'up', key); still: the video frame of this part that goes on the contact sheet"""
    sp = slow if speed is None else speed
    pg.keyboard.up("KeyA"); pg.keyboard.up("KeyD"); pg.keyboard.up("KeyW"); pg.keyboard.up("KeyS")
    pg.evaluate(RESET, setup); pg.evaluate(CAP, cap + ("" if sp == 1 else "  (half speed)" if sp == 0.5 else f"  ({sp}x)"))
    step(pg, 16)
    for i in range(frames):
        for (fi, act, key) in inputs:
            if fi == i: (pg.keyboard.down if act == "down" else pg.keyboard.up)(key)
        p = frame(pg, sp)
        if still is not None and i == still: stills.append((cap, p, crop))


with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-gpu"])
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=dsf, has_touch=False, is_mobile=False)
    ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": "2d", "sound": False, "fs": False}))
    ctx.add_init_script(CLOCK)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
    pg.add_style_tag(content="#scrPause{display:none!important}")
    pg.click("#bPractice"); pg.wait_for_timeout(300)
    pg.click("#lvlPick"); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click("#oppPick"); pg.click(f"#oppPop button >> nth={1 + ALL.index(opp)}")
    pg.click("#selGo")
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    pg.wait_for_timeout(300)
    pg.evaluate("() => window.__clock.freeze()")
    for _ in range(20): step(pg, FRAME)
    G = {"x": -90, "ox": -10}                     # on the ground, the dummy close in front
    A = {"x": -90, "y": -190, "air": True, "ox": -20}   # high in the air above the stage
    tap = lambda f0, *keys: [(f0, "down", k) for k in keys] + [(f0 + 3, "up", k) for k in keys]
    # lights
    part(pg, nm("jab", "Light"), G, tap(2, "KeyJ"), 34, still=13)
    part(pg, nm("side", "Light side"), G, tap(2, "KeyD", "KeyJ"), 40, still=17)
    part(pg, nm("up", "Light up"), G, tap(2, "KeyW", "KeyJ"), 40, still=18)
    part(pg, nm("down", "Light down"), G, tap(2, "KeyS", "KeyJ"), 38, still=16)
    # heavies: a tap, then the side heavy held to full charge (the reach crescent), the others held for half a second
    part(pg, nm("hSide", "Heavy side"), dict(G, ox=10), tap(2, "KeyD", "KeyK"), 60, still=36)
    part(pg, nm("hSide", "Heavy side") + ", held: the charge shows the reach", dict(G, ox=10), [(2, "down", "KeyD"), (2, "down", "KeyK"), (8, "up", "KeyD"), (128, "up", "KeyK")], 175, still=110)
    part(pg, nm("hUp", "Heavy up") + ", held", dict(G, ox=-40, oy=-60, oair=True), [(2, "down", "KeyW"), (2, "down", "KeyK"), (8, "up", "KeyW"), (70, "up", "KeyK")], 115, still=60)
    part(pg, nm("hDown", "Heavy down") + ", held", dict(G, ox=10), [(2, "down", "KeyS"), (2, "down", "KeyK"), (8, "up", "KeyS"), (70, "up", "KeyK")], 115, still=60)
    # air moves
    part(pg, nm("nair", "Air light"), A, tap(2, "KeyJ"), 40, still=20)
    part(pg, nm("sair", "Air light side"), A, tap(2, "KeyD", "KeyJ"), 44, still=24)
    part(pg, nm("uair", "Air light up"), A, tap(2, "KeyW", "KeyJ"), 42, still=21)
    part(pg, nm("dair", "Air light down"), A, tap(2, "KeyS", "KeyJ"), 46, still=30)
    part(pg, nm("hAir", "Air heavy"), A, tap(2, "KeyK"), 50, still=36)
    part(pg, nm("pound", "Air heavy down"), A, tap(2, "KeyS", "KeyK"), 50, still=16)
    # the special: the dummy a little way off at 60% is pulled back in
    part(pg, nm("spec", "Special") + ": the hit pulls them in", dict(G, x=-120, ox=10, pct=60), tap(2, "KeyL"), 90, still=30)
    stills.append((nm("spec", "Special") + ": pulled in", frames_dir / f"f{n - 40:05d}.png", True))
    # recovery from below the stage edge, then the drift back while holding towards the stage
    part(pg, nm("rec", "Recovery") + ", then the drift", {"x": 420, "y": 50, "air": True, "facing": -1, "ox": 150}, [(2, "down", "KeyW"), (2, "down", "KeyK"), (5, "up", "KeyW"), (5, "up", "KeyK"), (34, "down", "KeyA")], 130, speed=1.0, still=14, crop=False)
    stills.append((nm("rec", "Recovery") + ": the drift", frames_dir / f"f{n - 70:05d}.png", False))
    # the four skins (their effects show in idle and on a swing)
    for i in range(4):
        part(pg, f"Skin {i + 1} of 4", dict(G, pal=i, ox=10), tap(14, "KeyD", "KeyK"), 48, speed=1.0, still=36 if i else None)
        if i == 0: stills.append(("Skin 1 of 4", frames_dir / f"f{n - 30:05d}.png", True))
    # the special against a finish-ready opponent on the last life: the finish, then the KO finisher at full speed
    part(pg, nm("fin", "Finishing special") + " on 185%, last life", dict(G, x=-110, ox=-20, pct=185, stocks=1), tap(30, "KeyL"), 50, speed=1.0, still=46)
    pg.evaluate(CAP, "")
    k = 0
    while k < 260:
        frame(pg); k += 1
        if k in (14, 46, 50, 60, 80): stills.append((nm("fin", "Finisher") + f" +{k * 33} ms", frames_dir / f"f{n:05d}.png", False))
        if pg.evaluate("() => window.__blastline.mode") == "result" and k > 20: break
    for _ in range(20): frame(pg)
    b.close()

subprocess.run(["/usr/bin/ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(frames_dir / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-preset", "medium", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", str(out)], check=True)
# contact sheet: the chosen still of every part, labelled
tw = 500; ims = []
for cap, pth, crop in stills:
    im = Image.open(pth).convert("RGB")
    if crop: im = im.crop((int(im.width * 0.2), int(im.height * 0.14), int(im.width * 0.8), int(im.height * 0.86)))   # the fighters stay near the middle
    im = im.resize((tw, int(tw * 0.462)))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 7 * len(cap) + 8, 15], fill=(0, 0, 0)); d.text((4, 2), cap, fill=(255, 255, 255)); ims.append(im)
cols = 5; th = ims[0].height; rows = (len(ims) + cols - 1) // cols
sh = Image.new("RGB", (tw * cols, th * rows), (12, 12, 18))
for i, im in enumerate(ims): sh.paste(im, ((i % cols) * tw, (i // cols) * th))
sh.save(sheet_path, quality=86)
shutil.rmtree(frames_dir, ignore_errors=True)
print(f"video {out} ({n} frames), sheet {sheet_path}")
print("no errors" if not errs else "errors: " + " | ".join(errs[:5]))
