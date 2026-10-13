# Heavy attacks: for each fighter, compare every light with its heavy (and the air heavy with the air side light).
# Freezes the sim, sets the move state directly and photographs the wind-up, the glint, the hit window and the endlag,
# then makes contact sheets with PIL. A live pass plays real heavies against a pinned opponent (swing timer, heavy sound,
# hit effects) and photographs the swing and the hit.
# Usage: python3 tests/pwheavy.py [fighter ...] [--2d] [WxH] [--nolive] [--rows side,up,down,air] [--cols light,wind,glint,hit1,hit2,hit3,end] [--nofrozen] [--out DIR]
#   defaults: all six fighters, 3D, 844x390, live pass on. Screenshots go to the scratchpad folder, not the repo.
# Prints "no errors" when no page errors happened and every sheet was written.
import sys, json, pathlib, os
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
gfx = "2d" if "--2d" in args else "3d"
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
UPLIFT = {k: 30 for k in ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon"]}   # up heavies swing overhead; lift the pinned opponent so they connect
live = "--nolive" not in args
frozen = "--nofrozen" not in args
rows_arg = args[args.index("--rows") + 1].split(",") if "--rows" in args else None
out_arg = args[args.index("--out") + 1] if "--out" in args else None
OUT = pathlib.Path(out_arg or "/tmp/claude-0/-home-claude-potatobrawl/ec9f61d4-22bf-58d1-982b-e0d89ca46890/scratchpad/heavies")
OUT.mkdir(parents=True, exist_ok=True)
skip = {x for x in (out_arg, args[args.index("--rows") + 1] if "--rows" in args else None, args[args.index("--cols") + 1] if "--cols" in args else None) if x}
IDS = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon"]
ids = [a for a in args if not a.startswith("--") and not a[0].isdigit() and a not in skip] or IDS
TAG = f"{gfx}-{W}x{H}"
DSF = 1 if W > 1000 else 2
# row: label, light key, heavy key, in the air
ROWS = [("side", "side", "hSide", False), ("up", "up", "hUp", False), ("down", "down", "hDown", False), ("air", "sair", "hAir", True)]
if rows_arg: ROWS = [r for r in ROWS if r[0] in rows_arg]
COLS = ["light", "wind", "glint", "hit1", "hit2", "hit3", "end"]
if "--cols" in args: COLS = [c for c in COLS if c in args[args.index("--cols") + 1].split(",")]
errs, bad = [], []

FREEZE_JS = """() => { const g = window.__blastline.game; g.hitstop = 1e9; window.__blastline.r3.lockQ = true; }"""
SET_JS = """async ([key, mt, air, dx]) => {
  const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1];
  f.x = -40; f.facing = 1; f.vx = 0; f.vy = 0; f.kbx = 0; f.kby = 0; f.flash = 0; f.grounded = !air; f.y = air ? -70 : 0;
  o.x = 45 + (dx || 0); o.y = 0; o.facing = -1; o.vx = 0; o.vy = 0; o.state = 'idle'; o.move = null; o.mid = null; o.grounded = true;
  f.state = 'attack'; f.move = f.spec.moves[key]; f.mid = key; f.mt = mt; f.hitLog = {};
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
  return [f.move.startup, f.move.active, f.move.endlag];
}"""


def start(pg, fid, sound=False):
    pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
    pg.add_style_tag(content="#scrPause{display:none!important}")
    pg.click("#bPractice"); pg.wait_for_timeout(300)
    # a Dummy CPU (it never moves or attacks) playing the next fighter in the list, so every run is the same
    pg.click("#lvlPick"); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click("#oppPick"); pg.click(f"#oppPop button >> nth={1 + (IDS.index(fid) + 1) % len(IDS)}")
    pg.click("#selGo")
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    pg.wait_for_timeout(900)


def frames(m):
    s, a, e = m
    return {"light": s + 1 + a // 2, "wind": max(1, round(s * 0.55)), "glint": s, "hit1": s + 1, "hit2": s + 1 + a // 2, "hit3": s + a, "end": s + a + max(1, round(e * 0.2))}


def clip():
    # the camera sits between the two fighters, so the middle of the screen holds the one being photographed
    cw, ch = int(W * 0.30), int(H * 0.55)
    return {"x": W // 2 - cw // 2 - int(W * 0.04), "y": int(H * 0.27), "width": cw, "height": ch}


def label(img, text):
    d = ImageDraw.Draw(img); d.rectangle([0, 0, 8 * len(text) + 6, 14], fill=(0, 0, 0)); d.text((3, 1), text, fill=(255, 255, 255))
    return img


def sheet(fid, tiles):
    # tiles[(row, col)] = path
    first = Image.open(next(iter(tiles.values())))
    tw, th = first.size
    im = Image.new("RGB", (tw * len(COLS), th * len(ROWS)), (24, 24, 32))
    for ri, r in enumerate(ROWS):
        for ci, cname in enumerate(COLS):
            p = tiles.get((r[0], cname))
            if not p: continue
            t = Image.open(p).convert("RGB")
            key = r[1] if cname == "light" else r[2]
            im.paste(label(t, f"{fid} {key} {cname}"), (ci * tw, ri * th))
    path = OUT / f"sheet-{fid}-{TAG}.png"
    im.save(path)
    return path


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
    allsheets = {}
    for fid in ids:
        ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=DSF)
        ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": gfx, "sound": False, "fs": False}))
        pg = ctx.new_page(); pg.on("pageerror", lambda e, fid=fid: errs.append(f"{fid}: {e}"))
        start(pg, fid)
        pg.evaluate(FREEZE_JS)
        tiles = {}
        for label_, lkey, hkey, air in (ROWS if frozen else []):
            mv = lambda k: pg.evaluate("([k]) => { const m = window.__blastline.game.fighters[0].spec.moves[k]; return [m.startup, m.active, m.endlag]; }", [k])
            hm, lm = mv(hkey), mv(lkey)
            fr = frames(hm)
            fr["light"] = lm[0] + 1 + lm[1] // 2
            for ci, cname in enumerate(COLS):
                key = lkey if cname == "light" else hkey
                pg.evaluate(SET_JS, [key, fr[cname], air, 0])
                pg.wait_for_timeout(500 if (label_ == ROWS[0][0] and ci == 0) else 130)
                path = OUT / f"{fid}-{label_}-{cname}-{TAG}.png"
                pg.screenshot(path=str(path), clip=clip())
                tiles[(label_, cname)] = path
        if tiles:
            sp = sheet(fid, tiles)
            allsheets[fid] = tiles
            print(f"{fid}: sheet {sp}")
        if live:
            # live pass: real heavies against a pinned opponent
            ctx.close()
            ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=1)
            ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": gfx, "sound": True, "fs": False}))
            pg = ctx.new_page(); pg.on("pageerror", lambda e, fid=fid: errs.append(f"{fid} live: {e}"))
            start(pg, fid)
            # the CPU is held far away until the heavy starts, then dropped in front of the fist
            pg.evaluate("""() => {
              window.__blastline.r3.lockQ = true;
              const g = window.__blastline.game;
              window.__near = false; window.__nearX = 52; window.__nearY = 0;
              const loop = () => { const f = g.fighters[0], o = g.fighters[1];
                if (window.__near) { o.x = f.x + f.facing * window.__nearX; o.y = f.y - window.__nearY; o.vx = 0; o.vy = 0; o.kbx = 0; o.kby = 0; o.grounded = !window.__nearY; }   // the Dummy stands there (and stays put when it is hit)
                else if (o.state !== 'hitstun' && o.state !== 'tumble') { o.x = Math.max(-300, Math.min(300, f.x + f.facing * 520)); o.vx = 0; }
                f.percent = 0; requestAnimationFrame(loop); };
              loop();
            }""")
            for label_, lkey, hkey, air in ROWS:
                if air: continue   # the air heavy is covered by the frozen pass
                kd = {"side": "KeyD", "up": "KeyW", "down": "KeyS"}[label_]
                pg.wait_for_function("() => { const f = window.__blastline.game.fighters[0]; return f.state === 'idle' && f.grounded; }", timeout=15000)
                pg.wait_for_timeout(300)
                pg.evaluate("([x, y]) => { window.__nearX = x; window.__nearY = y; }", [8 if label_ == "up" else 52, UPLIFT.get(fid, 0) if label_ == "up" else 0])   # an up heavy hits overhead, so the CPU stands right under it
                # arm the watcher: drop the CPU in front of the fist once the move starts, pause (the P key) the frame the hit window is open, and again a few ticks after the move connects
                pg.evaluate("""([hk]) => {
                  const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1];
                  window.__trap = null; window.__near = false; o.state = 'idle'; o.hitstun = 0; o.tumble = false; o.move = null; o.percent = 0;   // a fresh, healthy Dummy for each heavy
                  window.__armed = { hk, p0: o.percent, swung: false, hit: false, resumed: false };
                  const watch = () => {
                    const a = window.__armed; if (!a) return;
                    const m = f.spec.moves[hk];
                    if (f.mid === hk) window.__near = true;
                    if (!a.swung && f.mid === hk && f.mt >= m.startup + 2) { a.swung = true; window.__trap = 'swing'; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); return; }
                    if (a.swung && a.resumed && !a.hit && o.percent > a.p0 && (f.mt >= m.startup + 3 || f.mid !== hk)) { a.hit = true; window.__trap = 'hit'; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); return; }
                    requestAnimationFrame(watch);
                  };
                  window.__watch = watch; requestAnimationFrame(watch);
                }""", [hkey])
                pg.keyboard.down(kd); pg.keyboard.down("KeyK")
                try: pg.wait_for_function("([hk]) => window.__blastline.game.fighters[0].mid === hk", arg=[hkey], timeout=2500, polling="raf")   # hold until the move starts (a slow frame can swallow a short tap)
                except Exception: pass
                pg.keyboard.up("KeyK"); pg.keyboard.up(kd)
                stage = "swing"
                try:
                    pg.wait_for_function("() => window.__trap === 'swing'", timeout=8000)
                    pg.wait_for_timeout(250)
                    pg.screenshot(path=str(OUT / f"{fid}-live-{hkey}-swing-{TAG}.png"), clip=clip())
                    pg.evaluate("() => { window.__trap = null; window.__armed.resumed = true; }")
                    pg.keyboard.press("KeyP")
                    pg.evaluate("() => requestAnimationFrame(window.__watch)")
                    stage = "hit"
                    pg.wait_for_function("() => window.__trap === 'hit'", timeout=4000)
                    pg.wait_for_timeout(200)
                    pg.screenshot(path=str(OUT / f"{fid}-live-{hkey}-hit-{TAG}.png"), clip=clip())
                    pg.evaluate("() => { window.__near = false; }")
                    pg.keyboard.press("KeyP")
                except Exception as ex:
                    dbg = pg.evaluate("() => { const f = window.__blastline.game.fighters[0]; const o = window.__blastline.game.fighters[1]; return [f.state, f.mid, f.mt, f.grounded, !document.getElementById('scrPause').hidden, 'cpu', o.state, Math.round(o.x - f.x), Math.round(o.y - f.y), o.percent, window.__near]; }")
                    bad.append(f"{fid} {hkey}: the live pass never reached the {stage} (fighter {dbg}): {str(ex)[:50]}")
                    pg.evaluate("() => { window.__armed = null; }")
                    if pg.evaluate("() => !document.getElementById('scrPause').hidden"): pg.keyboard.press("KeyP")
                pg.evaluate("() => { window.__armed = null; window.__trap = null; }")
                pg.wait_for_timeout(1100)
        ctx.close()
    b.close()

# one overview with every fighter's lights next to its heavies at the middle of the hit window
if len(ids) > 1 and allsheets:
    cols = []
    for label_, lkey, hkey, air in ROWS:
        cols += [(label_, "light", lkey), (label_, "hit2", hkey)]
    any_t = next(iter(next(iter(allsheets.values())).values()))
    tw, th = Image.open(any_t).size
    im = Image.new("RGB", (tw * len(cols), th * len(ids)), (24, 24, 32))
    for ri, fid in enumerate(ids):
        for ci, (rl, cn, key) in enumerate(cols):
            t = Image.open(allsheets[fid][(rl, cn)]).convert("RGB")
            im.paste(label(t, f"{fid} {key}"), (ci * tw, ri * th))
    im.save(OUT / f"sheet-all-{TAG}.png")
    print(f"overview: {OUT / ('sheet-all-' + TAG + '.png')}")
for e in errs + bad: print("ERROR", e)
if not errs and not bad: print("no errors")
