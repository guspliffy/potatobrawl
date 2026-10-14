# Heavy attacks: for each fighter, compare every light with its heavy (and the air heavy with the air side light).
# Freezes the sim, sets the move state directly and photographs the wind-up, the glint, the hit window and the endlag,
# then makes contact sheets with PIL. A live pass plays real heavies against a pinned opponent (swing timer, heavy sound,
# hit effects) and photographs the swing and the hit.
# Usage: python3 tests/pwheavy.py [fighter ...] [--2d] [WxH] [--nolive] [--rows side,up,down,air] [--cols light,wind,glint,hit1,hit2,hit3,end] [--nofrozen] [--nocharge] [--nofinish] [--nohum] [--out DIR]
#   defaults: all seven fighters, 844x390, live pass on. Screenshots go to the scratchpad folder, not the repo.
#   Also (each can be skipped with --nocharge / --nofinish / --nohum):
#   charge stills   every fighter's ground heavies at the hold point with no charge, at charge stages 1 / 2 / 3 (chg 12 / 32 / 56) and released
#                   at the hit window with chg 0 and chg 60, plus a live hold to full charge and the CHARGED pop on the hit (chg-*.png, chg-all-*.png)
#   finish stills   one special per fighter drawn with the opponent at 40% and at 200% (finish-ready: bigger projectile, comet tail, ring) (fin-all-*.png)
#   hum check       a fake AudioContext counts the oscillators: exactly one while a heavy is held, none after release, pause or when frames stop
# Prints "no errors" when no page errors happened and every sheet was written.
import sys, json, pathlib, os
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
gfx = "2d"   # matches are 2D only since M4 (the flag is ignored by the game)
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
UPLIFT = {k: 30 for k in ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon", "gunslinger"]}   # up heavies swing overhead; lift the pinned opponent so they connect
live = "--nolive" not in args
frozen = "--nofrozen" not in args
charge = "--nocharge" not in args
finish = "--nofinish" not in args
hum = "--nohum" not in args
rows_arg = args[args.index("--rows") + 1].split(",") if "--rows" in args else None
out_arg = args[args.index("--out") + 1] if "--out" in args else None
OUT = pathlib.Path(out_arg or "/tmp/claude-0/-home-claude-potatobrawl/ec9f61d4-22bf-58d1-982b-e0d89ca46890/scratchpad/heavies")
OUT.mkdir(parents=True, exist_ok=True)
skip = {x for x in (out_arg, args[args.index("--rows") + 1] if "--rows" in args else None, args[args.index("--cols") + 1] if "--cols" in args else None) if x}
IDS = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon", "gunslinger"]
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

# a held heavy: the sim is frozen at the hold point (mt = startup - 3) with chg frames of charge; the Dummy stands behind so nothing hides the glow
SETC_JS = """async ([key, when, chg]) => {
  const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1];
  f.x = -40; f.facing = 1; f.vx = 0; f.vy = 0; f.kbx = 0; f.kby = 0; f.flash = 0; f.grounded = true; f.y = 0;
  o.x = -105; o.y = 0; o.facing = 1; o.vx = 0; o.vy = 0; o.state = 'idle'; o.move = null; o.mid = null; o.grounded = true;
  f.state = 'attack'; f.move = f.spec.moves[key]; f.mid = key; f.mt = when === 'hold' ? f.move.startup - 3 : f.move.startup + 2; f.hitLog = {}; f.chg = chg;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
  return [f.move.startup, f.move.active, f.move.endlag];
}"""
# a finish-ready scene: the attacker's special mid-flight, the opponent at 40% or 200% (finish-ready)
SETF_JS = """async ([ready]) => {
  const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1];
  f.x = -150; f.facing = 1; f.vx = 0; f.vy = 0; f.kbx = 0; f.kby = 0; f.flash = 0; f.grounded = true; f.y = 0; f.state = 'idle'; f.move = null; f.mid = null; f.hitLog = {};
  o.x = 150; o.y = 0; o.facing = -1; o.vx = 0; o.vy = 0; o.state = 'idle'; o.move = null; o.mid = null; o.grounded = true; o.percent = ready ? 200 : 40;
  g.projs.length = 0;
  const sp = f.spec.moves.spec, p = sp.proj;
  if (p) {
    for (let i = 0; i < (p.count || 1); i++) g.projs.push({ owner: 0, x: f.x + p.ox + 50 + i * 26, y: f.y + p.oy, dir: 1, vx: p.speed, vy: p.spreadVy ? p.spreadVy[i] : (p.vy0 || 0), grav: 0, boomer: !!p.boomer,
      style: p.style, burst: null, speed: p.speed, r: p.r, life: p.life, t: 8, pal: f.pal, hit: { dmg: p.dmg, bkb: p.bkb, kbg: p.kbg, angle: p.angle, fire: p.style === 'fire', fin: p.fin || null } });
  } else { f.x = -60; f.state = 'attack'; f.move = sp; f.mid = 'spec'; f.mt = sp.startup + 6; }   // Samurai: mid Quick Draw
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
  return 1;
}"""
CHG_COLS = [("hold", "hold", 0), ("s1", "hold", 12), ("s2", "hold", 32), ("s3", "hold", 56), ("rel0", "rel", 0), ("rel60", "rel", 60)]   # (name, moment, chg): hold = the wind-up held at its hold point, rel = released with the hit window open

# a pretend AudioContext: counts the oscillators that are running (started and not stopped)
MOCK_AUDIO = """(() => {
  const log = { live: new Set(), freqs: [], created: 0 };
  window.__aud = log;
  const prm = (onTarget) => ({ value: 0, setValueAtTime(v) { this.value = v; return this; }, linearRampToValueAtTime(v) { this.value = v; return this; }, exponentialRampToValueAtTime(v) { this.value = v; return this; },
    setTargetAtTime(v) { this.value = v; if (onTarget) onTarget(v); return this; }, cancelScheduledValues() { return this; } });
  class Nd { connect(n) { return n; } disconnect() {} }
  class Osc extends Nd { constructor() { super(); this.frequency = prm((v) => log.freqs.push(v)); this.type = 'sine'; log.created++; } start() { log.live.add(this); } stop() { log.live.delete(this); } }
  class AC { constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = new Nd(); } get currentTime() { return performance.now() / 1000; }
    createGain() { const g = new Nd(); g.gain = prm(); return g; } createOscillator() { return new Osc(); }
    createBuffer(n, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { const s = new Nd(); s.start = () => {}; s.stop = () => {}; return s; }
    createBiquadFilter() { const f = new Nd(); f.frequency = prm(); f.Q = prm(); return f; } resume() { return Promise.resolve(); } }
  window.AudioContext = AC; window.webkitAudioContext = AC;
})();"""


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


def wideclip():
    return {"x": int(W * 0.2), "y": int(H * 0.18), "width": int(W * 0.6), "height": int(H * 0.62)}


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
    allsheets, chgsheets, finsheets = {}, {}, {}
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
        if charge and any(not r[3] for r in ROWS):
            # charge stills: each ground heavy held at its hold point (no charge, stages 1 / 2 / 3), then released with and without a full charge
            crows = [r for r in ROWS if not r[3]]
            ctiles = {}
            for label_, lkey, hkey, air in crows:
                for ci, (cname, when, chg) in enumerate(CHG_COLS):
                    pg.evaluate(SETC_JS, [hkey, when, chg])
                    pg.wait_for_timeout(500 if (label_ == crows[0][0] and ci == 0) else 130)
                    path = OUT / f"chg-{fid}-{label_}-{cname}-{TAG}.png"
                    pg.screenshot(path=str(path), clip=clip())
                    ctiles[(label_, cname)] = path
            tw, th = Image.open(next(iter(ctiles.values()))).size
            im = Image.new("RGB", (tw * len(CHG_COLS), th * len(crows)), (24, 24, 32))
            for ri, r in enumerate(crows):
                for ci, (cname, when, chg) in enumerate(CHG_COLS):
                    im.paste(label(Image.open(ctiles[(r[0], cname)]).convert("RGB"), f"{fid} {r[2]} {cname} chg {chg}"), (ci * tw, ri * th))
            im.save(OUT / f"chg-{fid}-{TAG}.png")
            chgsheets[fid] = ctiles
            print(f"{fid}: charge sheet {OUT / ('chg-' + fid + '-' + TAG + '.png')}")
        if finish:
            # finish-ready stills: the special in flight (Samurai: mid dash) with the opponent at 40% and at 200%
            ft = []
            for ready in (0, 1):
                pg.evaluate(SETF_JS, [ready])
                pg.wait_for_timeout(500 if not ready else 150)
                path = OUT / f"fin-{fid}-{'ready' if ready else 'normal'}-{TAG}.png"
                pg.screenshot(path=str(path), clip={"x": int(W * 0.12), "y": int(H * 0.2), "width": int(W * 0.76), "height": int(H * 0.62)})
                ft.append(path)
            finsheets[fid] = ft
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
              window.__near = false; window.__nearX = 52; window.__nearY = 0; window.__farX = null;
              const loop = () => { const f = g.fighters[0], o = g.fighters[1];
                if (window.__near) { o.x = f.x + f.facing * window.__nearX; o.y = f.y - window.__nearY; o.vx = 0; o.vy = 0; o.kbx = 0; o.kby = 0; o.grounded = !window.__nearY; }   // the Dummy stands there (and stays put when it is hit)
                else if (o.state !== 'hitstun' && o.state !== 'tumble') { o.x = window.__farX != null ? f.x + f.facing * window.__farX : Math.max(-300, Math.min(300, f.x + f.facing * 520)); o.vx = 0; }
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
            if charge:
                # a real hold to full charge: the stage 3 look (paused at chg >= 48), then release and the CHARGED pop on the hit
                stage = "hold"
                try:
                    pg.wait_for_function("() => { const f = window.__blastline.game.fighters[0]; return f.state === 'idle' && f.grounded; }", timeout=15000)
                    pg.wait_for_timeout(300)
                    pg.evaluate("([hk]) => { const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1];"
                                " window.__near = false; window.__nearX = 52; window.__nearY = 0; window.__farX = -110; o.state = 'idle'; o.hitstun = 0; o.tumble = false; o.move = null; o.percent = 0;"
                                " window.__cw = { hk, p0: 0, held: false, rel: false, hit: false }; window.__trap = null;"
                                " const watch = () => { const a = window.__cw; if (!a) return; const m = f.spec.moves[hk];"
                                "   const key = f.state + '/' + f.mid + '/' + window.__near + '/' + (o.percent > 0) + '/' + (document.getElementById('scrPause').hidden ? 'run' : 'pause'); if (key !== a.last) { a.last = key; (a.log = a.log || []).push(key + ' mt' + f.mt + ' chg' + f.chg + ' dx' + Math.round((o.x - f.x) * f.facing) + ' fx' + Math.round(f.x)); }"
                                "   if (a.rel && f.mid === hk) window.__near = true;"
                                "   if (!a.held && f.mid === hk && f.chg >= 48 && f.mt === m.startup - 3) { a.held = true; window.__trap = 'held'; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); return; }"
                                "   if (a.rel && !a.hit && o.percent > a.p0) { a.hit = true; window.__trap = 'hit'; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); return; }"
                                "   requestAnimationFrame(watch); };"
                                " window.__cwatch = watch; requestAnimationFrame(watch); }", ["hSide"])
                    pg.keyboard.down("KeyD"); pg.keyboard.down("KeyK")
                    pg.wait_for_function("() => window.__trap === 'held'", timeout=60000)
                    pg.wait_for_timeout(250)
                    pg.screenshot(path=str(OUT / f"{fid}-live-charge-hold-{TAG}.png"), clip=wideclip())
                    stage = "hit"
                    # keep holding: the charge tops out at 60 frames and releases itself, so the hit is a full-charge one
                    # the Dummy steps in front while the game is still paused (a slow frame rate must not let the move finish before it is there)
                    pg.evaluate("() => new Promise((res) => { window.__trap = null; window.__cw.rel = true; window.__near = true; requestAnimationFrame(() => requestAnimationFrame(res)); })")
                    pg.keyboard.press("KeyP")
                    pg.evaluate("() => requestAnimationFrame(window.__cwatch)")
                    pg.wait_for_function("() => window.__trap === 'hit'", timeout=60000)   # (a software GL box can run at a few fps)
                    pg.keyboard.up("KeyK"); pg.keyboard.up("KeyD")
                    pg.wait_for_timeout(200)
                    pg.screenshot(path=str(OUT / f"{fid}-live-charge-hit-{TAG}.png"), clip=wideclip())
                    pg.evaluate("() => { window.__near = false; }")
                    pg.keyboard.press("KeyP")
                except Exception as ex:
                    try: dbg = pg.evaluate("() => { const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1]; return `state ${f.state} mid ${f.mid} mt ${f.mt} chg ${f.chg} x ${f.x|0} / dummy ${o.x|0} ${o.percent|0}% hitstop ${g.hitstop} paused ${!document.getElementById('scrPause').hidden} log ${(window.__cw && window.__cw.log || []).slice(-8).join(' | ')}`; }")
                    except Exception: dbg = "?"
                    bad.append(f"{fid} hSide: the live charge never reached the {stage}: {str(ex)[:40]} ({dbg})")
                    pg.keyboard.up("KeyK"); pg.keyboard.up("KeyD")
                    if pg.evaluate("() => !document.getElementById('scrPause').hidden"): pg.keyboard.press("KeyP")
                pg.evaluate("() => { window.__cw = null; window.__trap = null; window.__farX = null; }")
                pg.wait_for_timeout(600)
        ctx.close()
        if hum and fid == ids[0]:
            # the charge hum, against a pretend AudioContext: one oscillator while held, none after release, pause, or when the frames stop coming
            ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=1)
            ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": gfx, "sound": True, "fs": False}))
            ctx.add_init_script(MOCK_AUDIO)
            pg = ctx.new_page(); pg.on("pageerror", lambda e, fid=fid: errs.append(f"{fid} hum: {e}"))
            start(pg, fid)
            pg.evaluate("() => { window.__blastline.r3.lockQ = true; const g = window.__blastline.game; window.__hold = () => { const f = g.fighters[0]; f.percent = 0; g.fighters[1].x = f.x + 520; requestAnimationFrame(window.__hold); }; window.__hold(); }")
            nosc = lambda: pg.evaluate("() => window.__aud.live.size")
            def hold_until(n):
                pg.keyboard.down("KeyD"); pg.keyboard.down("KeyK")
                pg.wait_for_function("([n]) => { const f = window.__blastline.game.fighters[0]; return f.state === 'attack' && f.move && f.mt === f.move.startup - 3 && f.chg >= n; }", arg=[n], timeout=60000)   # (chg keeps its value after a release, so wait for the hold itself)
            try:
                pg.wait_for_function("() => { const f = window.__blastline.game.fighters[0]; return f.state === 'idle' && f.grounded; }", timeout=15000)
                pg.wait_for_timeout(300)
                hold_until(10); pg.wait_for_timeout(150)
                n1, f1 = nosc(), pg.evaluate("() => window.__aud.freqs.slice(-1)[0] || 0")
                hold_until(40); pg.wait_for_timeout(150)
                n2, f2 = nosc(), pg.evaluate("() => window.__aud.freqs.slice(-1)[0] || 0")
                pg.keyboard.up("KeyK"); pg.keyboard.up("KeyD"); pg.wait_for_timeout(700)
                n3 = nosc()
                print(f"hum: held {n1} osc at {f1:.0f} Hz, then {n2} at {f2:.0f} Hz; after release {n3}")
                if n1 != 1 or n2 != 1: bad.append(f"hum: wanted exactly one oscillator while a heavy is held, got {n1} then {n2}")
                if not (140 <= f1 <= 420 and f2 > f1): bad.append(f"hum: pitch should rise inside 140-420 Hz ({f1:.0f} then {f2:.0f})")
                if n3 != 0: bad.append(f"hum: {n3} oscillator(s) still running after the release")
                # pause: the hum must stop at once
                pg.wait_for_function("() => { const f = window.__blastline.game.fighters[0]; return f.state === 'idle' && f.grounded; }", timeout=15000)
                hold_until(8); pg.wait_for_timeout(150)
                n4 = nosc(); pg.keyboard.press("KeyP"); pg.wait_for_timeout(500); n5 = nosc()
                pg.keyboard.up("KeyK"); pg.keyboard.up("KeyD"); pg.keyboard.press("KeyP")
                print(f"hum: before pause {n4}, paused {n5}")
                if n4 != 1 or n5 != 0: bad.append(f"hum: pause should silence it ({n4} -> {n5})")
                # the frames stop (a hidden tab): the dead-man timer stops it
                pg.wait_for_function("() => { const f = window.__blastline.game.fighters[0]; return f.state === 'idle' && f.grounded; }", timeout=15000)
                hold_until(8); pg.wait_for_timeout(100)
                n6 = nosc(); pg.evaluate("() => { window.__hold = () => {}; window.requestAnimationFrame = () => 0; }"); pg.wait_for_timeout(800); n7 = nosc()
                pg.keyboard.up("KeyK"); pg.keyboard.up("KeyD")
                print(f"hum: before frames stop {n6}, after {n7}")
                if n6 != 1 or n7 != 0: bad.append(f"hum: the dead-man switch should stop it when frames stop ({n6} -> {n7})")
            except Exception as ex:
                bad.append(f"hum: check did not finish: {str(ex)[:80]}")
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
# charge overview: every fighter's side heavy at no charge, stages 1 / 2 / 3 and released with chg 0 and 60
if chgsheets:
    row = "side" if "side" in {r[0] for r in ROWS} else next(iter(next(iter(chgsheets.values())))) [0]
    tw, th = Image.open(next(iter(next(iter(chgsheets.values())).values()))).size
    im = Image.new("RGB", (tw * len(CHG_COLS), th * len(chgsheets)), (24, 24, 32))
    for ri, (fid, t) in enumerate(chgsheets.items()):
        for ci, (cname, when, chg) in enumerate(CHG_COLS):
            if (row, cname) in t: im.paste(label(Image.open(t[(row, cname)]).convert("RGB"), f"{fid} {cname} chg {chg}"), (ci * tw, ri * th))
    im.save(OUT / f"chg-all-{TAG}.png")
    print(f"charge overview: {OUT / ('chg-all-' + TAG + '.png')}")
# finish-ready overview: the special with the opponent at 40% (left) and at 200% (right)
if finsheets:
    tw, th = Image.open(next(iter(finsheets.values()))[0]).size
    im = Image.new("RGB", (tw * 2, th * len(finsheets)), (24, 24, 32))
    for ri, (fid, ft) in enumerate(finsheets.items()):
        for ci, pth in enumerate(ft): im.paste(label(Image.open(pth).convert("RGB"), f"{fid} {'finish-ready (200%)' if ci else 'normal (40%)'}"), (ci * tw, ri * th))
    im.save(OUT / f"fin-all-{TAG}.png")
    print(f"finish overview: {OUT / ('fin-all-' + TAG + '.png')}")
for e in errs + bad: print("ERROR", e)
if not errs and not bad: print("no errors")
