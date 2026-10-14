# The eight Ultimates in the match: a captioned reel (one clip per fighter: the ulti hitting a standing CPU), a contact sheet, and
# stills of every ulti's super freeze and key frames at 844x390 and upright 390x844. The page clock only moves when the script
# steps it (one 60 Hz sim tick per step), so every frame is an exact moment however slow the browser is. The player's bar is filled
# through the page and the ulti is pressed through window.__blInput (input.js).
# Usage (writes into --out, default ./ultimates-reel):
#   python3 tests/pwultreel.py [--fighter=all|phoenix,wizard] [--out=DIR] [--slow=0.5] [--dsf=2] [--vs=odin] [WxH]
#   --lights       only the Gunslinger light-shot pass
#   --no-video     only the stills and sheets          --no-stills   only the video and its sheet
#   --at=h16,m22,m61+4,cloud:33   dev: grab these moments of one ulti (hN = N ticks of super freeze left, mN = the first frame the ulti is at frame N,
#                        mN+k = k ticks after that, so a hit's hitstop can be stepped through) into DIR/dev-*.png
#   --mute         sound off (default: sound on, so every Sfx call of an ulti is exercised; a bad call shows as a page error)
# --slow is the game speed of the move (0.5 = half speed); the super freeze always runs at full speed.
# Checks (a failure exits 1): no page errors; the ulti starts, spends the bar, freezes the game 30 ticks and hurts the CPU; the
# frame cost of the ulti ticks stays within +8 ms of an idle tick (software canvas in headless Chromium, so a phone is cheaper).
# The Gunslinger's lights are shots (jab, side, up, down, nair, sair, uair, dair): after the ultis a second pass plays each one on a
# standing CPU (stills/gunslinger-light-<move>-844x390.png at the shot, gunslinger-lights.mp4 and gunslinger-lights-sheet.jpg); --no-lights skips it.
# Needs /usr/bin/ffmpeg for the video. Prints "no errors" when every check held.
import sys, json, pathlib, subprocess, shutil, statistics
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
opt = lambda k, d=None: next((a.split("=", 1)[1] for a in args if a.startswith(k + "=")), d)
flag = lambda k: k in args
ALL = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon", "gunslinger", "reaper"]
fighters = ALL if opt("--fighter", "all") == "all" else opt("--fighter").split(",")
out = pathlib.Path(opt("--out", "ultimates-reel")).resolve()
out.mkdir(parents=True, exist_ok=True)
dsf = float(opt("--dsf", "2"))
slow = float(opt("--slow", "0.5"))
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
UW, UH = 390, 844
sound = not flag("--mute")
dev_at = opt("--at")
vs_all = opt("--vs")
# who stands in front of whom (anyone but the user), and how far away: the same table as tests/ulti.js
OPP = {"phoenix": "odin", "alchemist": "reaper", "odin": "wizard", "wizard": "dragon", "samurai": "gunslinger", "dragon": "samurai", "gunslinger": "alchemist", "reaper": "phoenix"}
DIST = {"phoenix": 160, "alchemist": 100, "odin": 220, "wizard": 160, "samurai": 140, "dragon": 160, "gunslinger": 220, "reaper": 220}
# the key frames (label, JS test over g, A = the user, D = the CPU): the first frame it holds is the still
KEYS = {
    "phoenix": [("rises", "A.mid==='ulti'&&A.mt===9"), ("target", "A.mid==='ulti'&&A.mt===22"), ("comet", "A.mid==='ulti'&&A.mt>=31&&A.mt<60&&A.y>-210"), ("blast", "A.mid==='ulti'&&A.mt===63")],
    "alchemist": [("throw", "A.mid==='ulti'&&A.mt===26"), ("pulse", "g.projs.some(p=>p.style==='cloud'&&p.t===33)"), ("last pulse", "g.projs.some(p=>p.style==='cloud'&&p.t===150)")],
    "odin": [("windup", "A.mid==='ulti'&&A.mt===20"), ("flight", "g.projs.some(p=>p.style==='spear'&&p.t===6)"), ("back", "g.projs.some(p=>p.style==='spear'&&p.t===80)")],
    "wizard": [("marks", "A.mid==='ulti'&&A.mt===30"), ("falling", "A.mid==='ulti'&&A.mt===46"), ("big star", "g.projs.some(p=>p.style==='bigstar'&&p.y>-150)")],
    "samurai": [("crouch", "A.mid==='ulti'&&A.mt===18"), ("dash", "A.mid==='ulti'&&A.mt===30"), ("cut", "A.mid==='ulti'&&A.mt===68")],
    "dragon": [("grows", "A.mid==='ulti'&&A.mt===16"), ("stream", "A.mid==='ulti'&&A.mt===46"), ("blast", "A.mid==='ulti'&&A.mt===63")],
    "gunslinger": [("dead eye", "A.mid==='ulti'&&A.mt===12"), ("shot 3", "A.mid==='ulti'&&A.mt===42"), ("gold shot", "A.mid==='ulti'&&A.mt===66")],
    "reaper": [("the tug", "A.mid==='ulti'&&A.mt===14"), ("sweep", "A.mid==='ulti'&&A.mt===28")],
}
KEYS = {k: [(l, p) for l, p in v] for k, v in KEYS.items()}
# dev tokens like cloud:33 (a projectile of that style, t ticks old): extra predicates after the key frames
EXTRA = [(t, "g.projs.some(p=>p.style==='%s'&&p.t===%s)" % tuple(t.split(":"))) for t in (opt("--at") or "").split(",") if ":" in t]
FREEZE = "g.hitstop===16&&A.mid==='ulti'&&A.mt===0"   # the super freeze with 16 of its 30 ticks left: the banner is fully in
errs = []
checks = []

CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__realNow = realNow;
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; } };
})();"""
# one step of the clock, then the numbers the script needs (ms = what the step cost on this machine)
DRIVER = """(keys) => {
  window.__in = {};
  window.__blInput = () => window.__in;
  const tests = keys.map((k) => new Function('g', 'A', 'D', 'return (' + k + ')'));
  window.__ur = { tests, step(ms) {
    const t0 = window.__realNow(), n = window.__clock.step(ms), dt = window.__realNow() - t0;
    const g = window.__blastline.game, A = g.fighters[0], D = g.fighters[1];
    return { n, dt, hs: g.hitstop, mid: A.mid, mt: A.mt, st: A.state, ap: A.percent, dp: D.percent, np: g.projs.length, ds: D.state, ax: A.x, ay: A.y, ult: A.ult, ultN: A.ultN, t: g.t, hit: tests.map((f) => !!f(g, A, D)) };
  } };
}"""
# both fighters on their marks; o = {d: distance, pct}
RESET = """(o) => {
  const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1];
  const put = (f, x, facing, y) => { Object.assign(f, { x, y: y || 0, vx: 0, vy: 0, kbx: 0, kby: 0, facing, grounded: !y, plat: -1, state: y ? 'air' : 'idle', st: 0,
    move: null, mid: null, mt: 0, hitstun: 0, tumble: false, flash: 0, chg: 0, invuln: 0, ledge: 0, recUsed: false, airDodged: false, hitLog: {} }); f.airJumps = f.s.airJumps; };
  put(a, -o.d / 2, 1, o.ay); a.percent = 0; a.stocks = 3; a.specCd = 0;
  put(d, o.d / 2, -1, o.dy); d.percent = o.pct; d.stocks = 3; d.specCd = 0;
  g.projs.length = 0;
  a.ult = BL.ultNeed(a); a.ultN = 0;
}"""
CAP = """(t) => { let e = document.getElementById('reelCap');
  if (!e) { e = document.createElement('div'); e.id = 'reelCap'; e.style.cssText = 'position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:99999;padding:4px 12px;border-radius:6px;background:rgba(10,10,20,.72);color:#fff;font:700 15px/1.2 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;white-space:nowrap'; document.body.appendChild(e); }
  e.textContent = t; e.style.display = t ? 'block' : 'none'; }"""
STEP_MS = 16.7
frames_dir = out / "frames"
shutil.rmtree(frames_dir, ignore_errors=True); frames_dir.mkdir(parents=True)
(out / "stills").mkdir(exist_ok=True)
nframe = 0


def tick(pg):
    for _ in range(100):
        r = pg.evaluate("(ms) => window.__ur.step(ms)", STEP_MS)
        if r["n"]: return r
        pg.wait_for_timeout(20)
    raise RuntimeError("the page stopped drawing")


def start(b, fid, opp, vw, vh, upright):
    ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dsf, has_touch=upright, is_mobile=upright)
    prof = {"tut": True, "last": fid, "gfx": "2d", "sound": sound, "fs": False}
    if upright: prof["screen"] = "up"
    ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps(prof))
    ctx.add_init_script(CLOCK)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(f"{fid}: {e}"))
    pg.on("console", lambda m: errs.append(f"{fid} console: {m.text}") if m.type == "error" else None)
    pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
    pg.evaluate("() => { window.__blastline.r3.lockQ = true; }")
    pg.add_style_tag(content="#scrPause{display:none!important}")
    pg.click("#bPractice"); pg.wait_for_timeout(300)
    pg.click("#lvlPick"); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click("#oppPick"); pg.click(f"#oppPop button >> nth={1 + ALL.index(opp)}")
    pg.click("#selGo")
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    pg.wait_for_timeout(300)
    pg.evaluate("() => window.__clock.freeze()")
    return ctx, pg


def clip(pg, fid, opp, names, record, stills_tag, keys_wanted=True):
    """Plays one ulti. record(pg, st, kind) is called after every tick: kind is 'freeze' for the super-freeze ticks, else 'move'.
    Returns the list of per-tick results."""
    global nframe
    pg.evaluate(DRIVER, [FREEZE] + [p for _, p in KEYS[fid]] + [p for _, p in EXTRA])
    pg.evaluate(RESET, {"d": DIST[fid], "pct": 40})
    for _ in range(14): tick(pg)
    res = []
    pg.evaluate("() => { window.__in = { ulti: true }; }")
    done_at = None
    for i in range(520):
        st = tick(pg)
        if i == 0: pg.evaluate("() => { window.__in = {}; }")
        res.append(st)
        frz = st["hs"] > 0 and st["mid"] == "ulti" and st["mt"] == 0
        record(pg, st, "freeze" if frz else "move")
        over = st["mid"] != "ulti" and st["np"] == 0 and st["ult"] == 0 and st["ultN"] == 1
        if over and done_at is None: done_at = i
        if done_at is not None and i >= done_at + 34: break
    return res


def check_run(fid, res, idle_dt):
    hs = [r for r in res if r["hs"] > 0 and r["mid"] == "ulti" and r["mt"] == 0]
    started = any(r["mid"] == "ulti" for r in res)
    first = next((i for i, r in enumerate(res) if r["mid"] == "ulti"), None)
    checks.append((fid, "the ulti started and spent the bar", started and res[-1]["ultN"] == 1 and res[-1]["ult"] == 0))
    n_freeze = sum(1 for r in res if r["hs"] > 0 and r["mid"] == "ulti" and r["mt"] == 0)
    checks.append((fid, f"super freeze held the game ({n_freeze} ticks)", 28 <= n_freeze <= 31))
    checks.append((fid, f"the CPU took damage ({res[-1]['dp'] - 40:.0f}%)", res[-1]["dp"] > 40 + 6))
    cost = [r["dt"] for r in res if r["mid"] == "ulti" or r["np"] > 0]
    if cost:
        mean, p95 = statistics.mean(cost), sorted(cost)[int(len(cost) * 0.95)]
        checks.append((fid, f"frame cost {mean:.1f} ms mean, {p95:.1f} ms p95 (idle {idle_dt:.1f} ms)", mean < idle_dt + 8 and p95 < idle_dt + 16))


# key, the stick + light press, the user's feet above the floor, the CPU's feet above the floor, distance
LIGHTS = [("jab", {"light": True}, 0, 0, 60), ("side", {"light": True, "x": 1}, 0, 0, 62), ("up", {"light": True, "y": -1}, 0, 0, 32),
          ("down", {"light": True, "y": 1}, 0, 0, 50), ("nair", {"light": True}, -100, -100, 34), ("sair", {"light": True, "x": 1}, -100, -100, 62),
          ("uair", {"light": True, "y": -1}, -100, -200, 30), ("dair", {"light": True, "y": 1}, -160, -60, 20)]


def lights(b):
    """Each Gunslinger light on a standing CPU: a still on the second active frame (the tracer and the flash), one clip of all eight."""
    ctx, pg = start(b, "gunslinger", "odin", W, H, False)
    ld = out / "frames-lights"
    shutil.rmtree(ld, ignore_errors=True); ld.mkdir(parents=True)
    n = 0
    stills = []
    for key, inp, ay, dy, dist in LIGHTS:
        pg.evaluate(DRIVER, [f"A.mid==='{key}'&&A.mt===A.move.startup+2"])
        pg.evaluate(RESET, {"d": dist, "pct": 40, "ay": ay, "dy": dy})
        pg.evaluate(CAP, f"Gunslinger · {key} shot")
        for _ in range(0 if ay else 10):
            tick(pg); n += 1; pg.screenshot(path=str(ld / f"f{n:05d}.png"))
        pg.evaluate("(i) => { window.__in = i; }", inp)
        got, over, last = False, None, None
        for i in range(120):
            st = tick(pg); last = st
            if i == 0: pg.evaluate("() => { window.__in = {}; }")
            n += 1; pg.screenshot(path=str(ld / f"f{n:05d}.png"))
            if st["hit"][0] and not got:
                got = True
                path = out / "stills" / f"gunslinger-light-{key}-{W}x{H}.png"
                pg.screenshot(path=str(path)); stills.append((key, path))
            if i > 2 and st["mid"] != key and over is None: over = i
            if over is not None and i >= over + 10: break
        checks.append(("gunslinger", f"the {key} shot was drawn and hurt the CPU ({last['dp'] - 40:.0f}%)", got and last["dp"] > 40))
        print(f"gunslinger {key}: {n} frames so far", flush=True)
    ctx.close()
    subprocess.run(["/usr/bin/ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(ld / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-preset", "medium",
                    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", str(out / "gunslinger-lights.mp4")], check=True)
    shutil.rmtree(ld, ignore_errors=True)
    print("video", out / "gunslinger-lights.mp4")
    if stills:
        tw = 420
        ims = [label(crop_pair(Image.open(pth).convert("RGB")).resize((tw, int((H * 0.84) * tw / (W * 0.76)))), f"Gunslinger · {k} shot") for k, pth in stills]
        cols = 4
        rows = (len(ims) + cols - 1) // cols
        sh = Image.new("RGB", (tw * cols, ims[0].height * rows), (12, 12, 18))
        for i, im in enumerate(ims): sh.paste(im, ((i % cols) * tw, (i // cols) * ims[0].height))
        sh.save(out / "gunslinger-lights-sheet.jpg", quality=86); print("sheet", out / "gunslinger-lights-sheet.jpg")


def crop_pair(im):
    return im.crop((int(im.width * 0.12), int(im.height * 0.08), int(im.width * 0.88), int(im.height * 0.92)))


def label(im, text):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 6.2 * len(text) + 8, 15], fill=(0, 0, 0)); d.text((4, 2), text, fill=(255, 255, 255))
    return im


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
    meta = b.new_page(); meta.goto((ROOT / "build" / "test.html").as_uri())
    NAMES = meta.evaluate("() => Object.fromEntries(BL.FIGHTERS.map((f) => [f.id, [f.name, f.ultimate.name]]))"); meta.close()
    want_video = not flag("--no-video") and not dev_at
    want_stills = not flag("--no-stills") and not dev_at
    land = {}      # fighter -> [(label, path)] 844x390
    upr = {}       # fighter -> [(label, path)] 390x844

    # ---- pass 1: the reel at 844x390 (every tick is a frame, the freeze at full speed) and the landscape stills ----
    for fid in ([] if flag("--lights") else fighters):
        opp = vs_all or OPP[fid]
        ctx, pg = start(b, fid, opp, W, H, False)
        cap = f"{NAMES[fid][0]} · {NAMES[fid][1]}"
        pg.evaluate(CAP, cap)
        want = {}   # test index -> label, for the stills
        labels = ["freeze"] + [l for l, _ in KEYS[fid]]
        seen = set()
        dev = dev_at.split(",") if dev_at else []
        idle = []
        flip = [0]
        ti = [0]
        first = {}

        def record(pg, st, kind, fid=fid, labels=labels, seen=seen, dev=dev, flip=flip, ti=ti, first=first):
            global nframe
            hit = st["hit"]
            shots = []
            if want_stills:
                for i, ok in enumerate(hit):
                    if ok and i not in seen:
                        seen.add(i)
                        path = out / "stills" / f"{fid}-{labels[i].replace(' ', '-')}-{W}x{H}.png"
                        shots.append((labels[i], path))
            ti[0] += 1
            for tok in dev:
                key = (tok, "dev")
                if key in seen: continue
                if ":" in tok:
                    ix = 1 + len(KEYS[fid]) + [t for t, _ in EXTRA].index(tok)
                    if hit[ix]: seen.add(key); shots.append((tok, out / f"dev-{fid}-{tok.replace(':', '')}.png"))
                    continue
                kind_, num, _, plus = tok[0], int(tok[1:].split("+")[0]), 0, int(tok.split("+")[1]) if "+" in tok else 0
                if kind_ == "m" and st["mid"] == "ulti" and st["mt"] == num and ("m", num) not in first: first[("m", num)] = ti[0]
                ok = (kind_ == "h" and st["hs"] == num and st["mid"] == "ulti" and st["mt"] == 0) or (kind_ == "m" and ("m", num) in first and ti[0] == first[("m", num)] + plus)
                if ok:
                    seen.add(key); shots.append((tok, out / f"dev-{fid}-{tok}.png"))
            for lab, path in shots:
                pg.screenshot(path=str(path)); land.setdefault(fid, []).append((lab, path))
            if want_video:
                skip = False
                if kind == "freeze":
                    flip[0] ^= 1; skip = flip[0] == 1   # the freeze runs at full speed: every second tick
                elif slow >= 1: flip[0] ^= 1; skip = flip[0] == 1
                if not skip:
                    nframe += 1
                    pg.screenshot(path=str(frames_dir / f"f{nframe:05d}.png"))

        # idle cost first (the same match, the fighters just standing)
        pg.evaluate(DRIVER, [FREEZE] + [p_ for _, p_ in KEYS[fid]] + [p_ for _, p_ in EXTRA])
        pg.evaluate(RESET, {"d": DIST[fid], "pct": 40})
        idle = [tick(pg)["dt"] for _ in range(30)]
        idle_dt = statistics.mean(idle[5:])
        if want_video:
            for _ in range(8):
                nframe += 1; pg.screenshot(path=str(frames_dir / f"f{nframe:05d}.png"))
        res = clip(pg, fid, opp, NAMES, record, "")
        if want_video:
            for _ in range(10):
                nframe += 1; pg.screenshot(path=str(frames_dir / f"f{nframe:05d}.png"))
        check_run(fid, res, idle_dt)
        ctx.close()
        print(f"{fid}: {len(res)} ticks, {nframe} frames so far", flush=True)

    # ---- pass 2: upright phone 390x844 stills ----
    if want_stills:
        for fid in ([] if flag("--lights") else fighters):
            ctx, pg = start(b, fid, vs_all or OPP[fid], UW, UH, True)
            labels = ["freeze"] + [l for l, _ in KEYS[fid]]
            seen = set()

            def record(pg, st, kind, fid=fid, labels=labels, seen=seen):
                for i, ok in enumerate(st["hit"]):
                    if ok and i not in seen:
                        seen.add(i)
                        path = out / "stills" / f"{fid}-{labels[i].replace(' ', '-')}-{UW}x{UH}.png"
                        pg.screenshot(path=str(path)); upr.setdefault(fid, []).append((labels[i], path))

            clip(pg, fid, vs_all or OPP[fid], NAMES, record, "")
            ctx.close()
            print(f"{fid}: upright stills done", flush=True)
    if ("gunslinger" in fighters or flag("--lights")) and not dev_at and not flag("--no-lights"): lights(b)
    b.close()

# ---- the video and the contact sheets ----
if want_video and nframe:
    mp4 = out / "ultimates-reel.mp4"
    subprocess.run(["/usr/bin/ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(frames_dir / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-preset", "medium",
                    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", str(mp4)], check=True)
    print("video", mp4)
shutil.rmtree(frames_dir, ignore_errors=True)


def sheet(groups, path, tw, crop, cols=None, vertical=False):
    rows = []
    for fid, items in groups.items():
        ims = []
        for lab, pth in items:
            im = Image.open(pth).convert("RGB")
            if crop: im = crop(im)
            th = int(im.height * tw / im.width); im = im.resize((tw, th))
            ims.append(label(im, f"{NAMES[fid][0]} · {NAMES[fid][1]} · {lab}"))
        rows.append(ims)
    if not rows: return
    th = max(i.height for r in rows for i in r)
    if vertical:   # one column per fighter, the moments stacked
        nr = max(len(r) for r in rows)
        sh = Image.new("RGB", (tw * len(rows), th * nr), (12, 12, 18))
        for x, r in enumerate(rows):
            for y, im in enumerate(r): sh.paste(im, (x * tw, y * th))
    else:
        nc = max(len(r) for r in rows)
        sh = Image.new("RGB", (tw * nc, th * len(rows)), (12, 12, 18))
        for y, r in enumerate(rows):
            for x, im in enumerate(r): sh.paste(im, (x * tw, y * th))
    sh.save(path, quality=86); print("sheet", path)


if land and want_stills: sheet(land, out / "ultimates-sheet.jpg", 420, crop_pair)
if upr: sheet(upr, out / "ultimates-upright-sheet.jpg", 195, None, vertical=True)
if dev_at and land:
    for fid, items in land.items():
        ims = [crop_pair(Image.open(pth).convert("RGB")) for _, pth in items]
        tw = 520; ims = [im.resize((tw, int(im.height * tw / im.width))) for im in ims]
        strip = Image.new("RGB", (tw * min(3, len(ims)), ims[0].height * ((len(ims) + 2) // 3)))
        for i, im in enumerate(ims): strip.paste(label(im, f"{fid} {items[i][0]}"), ((i % 3) * tw, (i // 3) * ims[0].height))
        strip.save(out / f"dev-{fid}-strip.jpg", quality=88); print("strip", out / f"dev-{fid}-strip.jpg")

bad = [c for c in checks if not c[2]]
for fid, what, ok in checks: print(("ok   " if ok else "FAIL ") + f"{fid}: {what}")
if errs: print("errors: " + " | ".join(errs[:6]))
if bad or errs: sys.exit(1)
print("no errors")
