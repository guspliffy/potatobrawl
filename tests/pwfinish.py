# Finish mode / KO zoom / charge UI: screenshots and checks of the HUD side of the finisher work.
# Usage (from the folder that should get the screenshots): python3 tests/pwfinish.py [fighter] [--2d] [WxH]
#  1. FINISH! state: the CPU (a Dummy) is put at 180%: one "Finish!" banner, its percent pulses, the touch Special button glows with the special's name.
#  2. Charge ring: the Heavy button is held on a touch pointer; the ring fills, at full there is a ding (vibrate(12)) and a pulse.
#  3. Finishing special: the special lands on the CPU at 220% with 3 lives: white frame + diagonal "<SPECIAL> FINISH" band, and the KO zoom (lethal, not final).
#  4. KO zoom: a charged-less heavy on the CPU at 400% with 3 lives (a lethal hit that is not the last life): punch-in and back, no finisher.
# After the first screenshot the page clock is driven by the test (see pwfin.py), so pictures are taken at exact moments.
# Prints "no errors" when no page error happened and every check held.
import sys, json, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
gfx = "2d"   # matches are 2D only since M4 (the flag is ignored by the game)
size = next((a.split("x") for a in args if "x" in a and a[0].isdigit()), ["844", "390"])
W, H = int(size[0]), int(size[1])
ALL = ["phoenix", "alchemist", "odin", "wizard", "samurai", "dragon"]
fid = next((a for a in args if a in ALL), "dragon")
opp = ALL[(ALL.index(fid) + 1) % len(ALL)]
tag = f"{fid}-{gfx}-{W}x{H}"
errs, bad = [], []
SPEC = {"phoenix": "Fireball", "alchemist": "Toxic Orb", "odin": "Raven", "wizard": "Crystal Bolt", "samurai": "Quick Draw", "dragon": "Flame Breath"}

CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = {
    freeze() { t = realNow(); live = false; },
    step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; },
  };
  window.__vib = null; navigator.vibrate = (n) => { window.__vib = n; return true; };
  // the banner and the charge pulse go away on real-time timers; record that they were shown so slow GL can't make the checks flaky
  window.__banners = []; window.__chgfull = false;
  document.addEventListener("DOMContentLoaded", () => {
    const b = document.getElementById("banner"), hv = document.querySelector(".pb[data-k=heavy]");
    const bm = b.querySelector(".b-main");
    new MutationObserver(() => window.__banners.push(bm.textContent)).observe(bm, { childList: true });   // showBanner always rewrites the text
    new MutationObserver(() => { if (hv.classList.contains("chgfull")) window.__chgfull = true; }).observe(hv, { attributes: true, attributeFilter: ["class"] });
  });
})();"""

def ff(pg, ms):
    for _ in range(100):
        if pg.evaluate("(ms) => window.__clock.step(ms)", ms): return
        pg.wait_for_timeout(20)

def run(pg, ms, step=16):
    for _ in range(max(1, ms // step)): ff(pg, step)

def until(pg, js, limit=4000, step=16):
    for _ in range(limit // step):
        if pg.evaluate(js): return True
        ff(pg, step)
    return False

def shot(pg, name, park=None):
    # CSS animations (white frame, FINISH band, button glow) run on the real timeline: park them at a chosen time so the picture is repeatable
    pg.evaluate("(t) => document.getAnimations().forEach((a) => { a.pause(); if (t !== null) a.currentTime = t; })", park)
    pg.screenshot(path=f"finish-{tag}-{name}.png")

def check(cond, msg):
    if not cond: bad.append(msg)
    return cond

def newpage(b):
    ctx = b.new_context(viewport={"width": W, "height": H}, has_touch=True, is_mobile=True, device_scale_factor=1)
    ctx.add_init_script("localStorage.setItem('potatobrawl.profile.v1', JSON.stringify(%s))" % json.dumps({"tut": True, "last": fid, "gfx": gfx, "sound": False, "fs": False, "screen": "cw"}))
    ctx.add_init_script(CLOCK)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto((ROOT / "build" / "test.html").as_uri()); pg.wait_for_timeout(1200)
    pg.click("#bPractice"); pg.wait_for_timeout(300)
    pg.click("#lvlPick"); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click("#oppPick"); pg.click(f"#oppPop button >> nth={1 + ALL.index(opp)}")
    pg.click("#selGo")
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    pg.wait_for_timeout(300)
    pg.evaluate("() => window.__clock.freeze()"); ff(pg, 100)
    return ctx, pg

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])

    # ---- 1. FINISH! state ----
    ctx, pg = newpage(b)
    pg.evaluate("() => { const g = window.__blastline.game; g.fighters[1].percent = 120; g.fighters[0].percent = 40; }"); run(pg, 200)
    shot(pg, "hud-before")
    pg.evaluate("() => { window.__blastline.game.fighters[1].percent = 180; }")
    run(pg, 200)
    st = pg.evaluate("""() => ({ banner: document.getElementById('banner').hidden ? '' : document.querySelector('#banner .b-main').textContent,
      sub: document.querySelector('#banner .b-sub').textContent, col: document.querySelector('#banner .b-main').style.color,
      finr: [...document.querySelectorAll('.pcard')].map((e) => e.classList.contains('finr')),
      spec: document.querySelector('.pb[data-k=special]').className + '|' + document.querySelector('.pb[data-k=special] span').textContent })""")
    print("finish state:", st)
    seen = pg.evaluate("() => window.__banners.filter((t) => t === 'Finish!').length")
    check(seen == 1, f"the Finish! banner was shown {seen} times, wanted 1")
    check(st["finr"] == [False, True], f"finr classes {st['finr']}")
    check("fin" in st["spec"].split("|")[0].split() and st["spec"].endswith("|" + SPEC[fid]), f"special button {st['spec']}")
    shot(pg, "hud-finish-banner", 120)
    run(pg, 1400)
    shot(pg, "hud-finish-after", 300)
    # a second hit at 190% does not shout again: the banner stays gone
    pg.evaluate("() => { window.__blastline.game.fighters[1].percent = 190; }"); run(pg, 100)
    seen = pg.evaluate("() => window.__banners.filter((t) => t === 'Finish!').length")
    check(seen == 1, f"the Finish! banner fired again at 190% ({seen} times)")
    # back under the line: everything resets
    pg.evaluate("() => { window.__blastline.game.fighters[1].percent = 90; }"); run(pg, 100)
    st = pg.evaluate("() => [[...document.querySelectorAll('.pcard')].map((e) => e.classList.contains('finr')), document.querySelector('.pb[data-k=special] span').textContent]")
    check(st == [[False, False], "Special"], f"reset state {st}")
    ctx.close()

    # ---- 2. charge ring ----
    ctx, pg = newpage(b)
    pg.evaluate("() => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1]; a.x = -200; d.x = 200; }"); run(pg, 100)
    hv = ".pb[data-k=heavy]"
    pg.dispatch_event(hv, "pointerdown", {"pointerId": 7, "pointerType": "touch", "bubbles": True})
    run(pg, 560)
    st = pg.evaluate("() => { const e = document.querySelector('.pb[data-k=heavy]'); return [e.className, e.style.getPropertyValue('--ch'), window.__blastline.game.fighters[0].chg]; }")
    print("charging:", st)
    check("chg" in st[0].split() and 0.2 < float(st[1] or 0) < 0.95, f"ring while charging {st}")
    shot(pg, "charge-half", 0)
    until(pg, "() => window.__vib !== null", 2000)
    run(pg, 90)
    st = pg.evaluate("() => [document.querySelector('.pb[data-k=heavy]').className, window.__vib]")
    print("full charge:", st)
    check(st[1] == 12, f"vibrate(12) not called on chargeMax ({st})")
    check(pg.evaluate("() => window.__chgfull"), f"no full-charge pulse {st}")
    shot(pg, "charge-full", 120)
    pg.dispatch_event(hv, "pointerup", {"pointerId": 7, "pointerType": "touch", "bubbles": True})
    run(pg, 600)
    st = pg.evaluate("() => document.querySelector('.pb[data-k=heavy]').className")
    check("chg" not in st.split() or "chgfull" in st.split(), f"ring stuck on after the release: {st}")
    ctx.close()

    # ---- 3. finishing special, 4. KO zoom ----
    for what in ("special", "zoom"):
        ctx, pg = newpage(b)
        pg.evaluate("""(what) => { const g = window.__blastline.game, a = g.fighters[0], d = g.fighters[1];
          d.stocks = 3; d.percent = what === 'special' ? 220 : 400; a.x = -10; a.facing = 1; d.x = what === 'special' ? 70 : 40; d.facing = -1; }""", what)
        run(pg, 100)
        key = "KeyL" if what == "special" else "KeyK"
        pg.keyboard.down(key); ff(pg, 48); pg.keyboard.up(key)
        got = until(pg, "() => !document.getElementById('finBan').hidden || document.getElementById('fxHit').classList.contains('go')", 2500)
        if not got: bad.append(f"{what}: no hit effect appeared"); ctx.close(); continue
        info = pg.evaluate("() => ({ ban: document.getElementById('finBan').hidden ? '' : document.querySelector('#finBan .fb-t').textContent, fin: window.__blastline.fin.on })")
        print(what, info)
        check(not info["fin"], f"{what}: the finisher started on a hit that is not the last life")
        if what == "special": check(info["ban"].lower() == f"{SPEC[fid].lower()} finish", f"band text '{info['ban']}'")
        for ms in (60, 160, 300, 450):
            run(pg, 60 if ms == 60 else 100 if ms == 160 else 140 if ms == 300 else 150)
            shot(pg, f"{what}-{ms:03d}", ms)
        ctx.close()
    b.close()
for e in errs + bad: print("ERROR", e)
if not errs and not bad: print("no errors")
