# Carved Ink figures (game/ui/carve.js + game/ui/fig-<fighter>.js): contact sheets, a skins sheet, a hurtbox sheet and the drawing cost.
# Usage: python3 tests/pwcarve.py [fighter ...] [--out DIR] [--nosheets] [--notime] [--frames N]
#        python3 tests/pwcarve.py ME OPP --live [N] [--skins A,B]
#   defaults: every fighter, --out /mnt/project-files/redesign/build/, 120 timed frames.
#   --live [N]   a live match instead (N frames, default 1800 = 30 s): Practice, ME driven by the game's own bot (BL.makeBot(0.9) through
#                window.__blInput) against the top CPU as OPP, Math.random seeded, the page clock stepped one frame at a time, each whole
#                frame (sim + draw + raster) timed with a 1 px getImageData flush. Two pages play the same match on the same seed, the new
#                drawing and the old one (window.__cvOff), stepped in turn 60 frames at a time (this machine's speed drifts). Prints per page
#                the frame median / p95 / p99 / max, the sprites baked (in all, in the first 300 frames, in the last 600), the frames that
#                baked one, the sprites and pixels held (CV_BAKE; the old page holds the few the menus drew), and writes carve-live.json.
#                --skins A,B wears palette A on ME and B on OPP (indexes into spec.palettes; 1-3 the chip skins).
# Opens build/test.html (run python3 game/build.py first), Practice against a Dummy, takes the page clock (rAF and performance.now only
# move when the test steps them) and holds the simulation (g.hitstop), then sets each state directly on fighter 0 and photographs it.
#   carve-<fighter>.png       one sheet per fighter at 844x390 (dsf 2): idle, run, sprint, air rising, air falling, side heavy at the hit,
#                             up heavy at the hit, down heavy, special, hitstun, ledge, landing, plus the motion layer (light coil, heavy
#                             coil, charged hold, first active frame), the side light and helpless
#   carve-skins.png           all ten skins of each fighter standing (one row per fighter)
#   carve-hurtbox.png         the hurtbox (f.s.w x f.s.h, core.js hurt()) drawn over idle, run and the side heavy at the hit
#   carve-faces.png           one row per fighter, drawn twice the phone's size: the face at rest, a shout (P.mouth), the expressions the
#                             manga pages set (P.expr: terror, grin, rage, calm, dazed, ko), hitstun, the hit flash, helpless (dim), Glaze,
#                             the 2v2 team rim, Ink Noir and Starfall (a stand-in pose (f.finPose) holds the front hand low, off the face)
#   carve-timing.json         per fighter the median and p95 ms of one drawFighter call over the timed frames (idle, run and a heavy in
#                             turn, a heavy's length each), for the new figure and for today's drawing (window.__cvOff = true), plus the first (cold) call. The
#                             two are timed on the same frames, in blocks of 12 frames taken in turn (this machine's speed drifts), after
#                             one untimed pass over the frames (a figure's sprites are drawn the first time a lean or sway step is met)
# The timing runs in the page on the game's own canvas and world transform: a 1 px getImageData before and after the call makes the
# canvas raster what was queued, so the raster is counted (the method of tests/pwpmskin.py); the cost of the read alone (its median over 40
# reads) is taken off. The page is served from a routed localhost origin with COOP/COEP headers, so performance.now() has its fine
# resolution (a plain file:// page rounds it to 0.1 ms).
# Prints "no errors" when no page error happened.
#
# The 2v2 team rim (ui/carve.js TEAM RIM):
#        python3 tests/pwcarve.py [fighter ...] --rim [--out DIR] [--nosheets] [--notime]
#   team-rim.png         one row per fighter in a 2v2 against his own mirror (slot 0 ice blue, slot 2 ember red; the other two are out),
#                        standing, running, the side heavy at the hit, hitstun and on the ledge, each in both team colours, at 844x390 (dsf 2)
#   team-rim-modes.png   the same pairs in the hit flash, helpless (the dimmed figure), a dodge and the intangible blink (see-through) and
#                        on the respawn platform
#   team-rim-castle.png, team-rim-fryer.png   a 2v2 match on Hashbrown Keep and Deep Fryday (the dark steel stage), four bots, the first
#                        frame from 2 s in where all four are solid and apart
#   carve-rim-timing.json   per fighter the median and p95 ms of one drawFighter call with the rim on and off (TIME's method and frames, a
#                        1v1 Practice with TEAM_RIM set: fighter 0 is team 0)
#        python3 tests/pwcarve.py ME MATE FOE1 FOE2 --live [N] --duo
#   a live 2v2 (Practice, Team Brawl 2v2, all four played by the game's bots) on two pages, the rim on and off (window.__cvTest.rimOff),
#   timed and counted as --live does; writes carve-live-duo.json
import sys, json, pathlib, io, base64
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
ALL = ['phoenix', 'alchemist', 'odin', 'wizard', 'samurai', 'dragon', 'gunslinger', 'reaper']
OUT = pathlib.Path(args[args.index('--out') + 1] if '--out' in args else '/mnt/project-files/redesign/build/')
NFR = int(args[args.index('--frames') + 1]) if '--frames' in args else 120
skip = {args[args.index(k) + 1] for k in ('--out', '--frames', '--skins') if k in args}
LIVE = None
if '--live' in args:
    i = args.index('--live')
    LIVE = int(args[i + 1]) if i + 1 < len(args) and args[i + 1].isdigit() else 1800
    skip.add(str(LIVE))
SKINS = [int(v) for v in args[args.index('--skins') + 1].split(',')] if '--skins' in args else None
ids = [a for a in args if not a.startswith('--') and a not in skip] or ALL
sheets, timing = '--nosheets' not in args, '--notime' not in args
RIM, DUO = '--rim' in args, '--duo' in args
W, H, DSF = 844, 390, 2
OUT.mkdir(parents=True, exist_ok=True)
ORIGIN = 'http://localhost:9431/'   # routed (never a real server); localhost is a secure context, so COOP/COEP isolate it
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    FONT = ImageFont.load_default()

CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__realNow = realNow;
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; } };
})();"""

# one state on fighter 0 (the sim is held by g.hitstop, so it stays as set); the Dummy stands well behind so the camera keeps its zoom
SET = """([st]) => {
  const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1];
  g.projs.length = 0;
  Object.assign(f, { x: -60, y: 0, facing: 1, vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, grounded: true, state: 'idle', st: 6, move: null, mid: null, mt: 0,
    hitLog: {}, chg: 0, spr: 0, tumble: false, dodgeKind: null, armorFlash: 0, invuln: 0 });
  Object.assign(o, { x: 150, y: 0, facing: -1, vx: 0, vy: 0, state: 'idle', move: null, mid: null, grounded: true, flash: 0 });
  const atk = (key, d) => { f.state = 'attack'; f.move = f.spec.moves[key]; f.mid = key; f.mt = Math.max(0, f.move.startup + d); };
  switch (st) {
    case 'idle': break;
    case 'run': f.state = 'run'; f.vx = f.spec.stats.run; f.anim.run = 1.1; break;
    case 'sprint': f.state = 'run'; f.vx = f.spec.stats.run * 1.4; f.anim.run = 2.4; f.spr = 4; break;
    case 'air rising': f.state = 'air'; f.grounded = false; f.y = -60; f.vy = -7; break;
    case 'air falling': f.state = 'air'; f.grounded = false; f.y = -60; f.vy = 6; break;
    case 'side heavy': atk('hSide', 1); break;
    case 'up heavy': atk('hUp', 1); break;
    case 'down heavy': atk('hDown', 1); break;
    case 'special': atk('spec', 2); break;
    case 'hitstun': f.state = 'hitstun'; f.kbx = -4; f.kby = -3; f.st = 3; break;
    case 'ledge': f.state = 'ledge'; f.grounded = false; break;
    case 'landing': f.state = 'land'; f.st = 1; break;
    case 'light coil': atk('side', 0); break;
    case 'heavy coil': atk('hSide', -1); break;
    case 'charged hold': atk('hSide', -3); f.chg = 40; break;
    case 'first active': atk('side', 1); break;
    case 'side light': atk('side', 2); break;
    case 'helpless': f.state = 'helpless'; f.grounded = false; f.y = -60; f.vy = 3; break;
  }
  return [f.x, f.y];
}"""
STATES = ['idle', 'run', 'sprint', 'air rising', 'air falling', 'side heavy', 'up heavy', 'down heavy', 'special', 'hitstun', 'ledge', 'landing',
          'light coil', 'heavy coil', 'charged hold', 'first active', 'side light', 'helpless']
WHERE = """() => { const f = window.__blastline.game.fighters[0], T = window.__cvTest; const a = T.toScreen(f.x, f.y), b = T.toScreen(f.x + 10, f.y);
  return { x: a[0], y: a[1], z: (b[0] - a[0]) / 10, w: f.s.w, h: f.s.h }; }"""

# per fighter: N frames of one drawFighter call each (idle, run, the side heavy in turn, each for as many frames as the side heavy lasts,
# as a fighter stays in a state in play), timed with a flush before and after
TIME = """([n, rim]) => {
  const T = window.__cvTest, cam = T.cam, L = T.L, DPR = T.dpr, drawFighter = T.draw;
  const g = window.__blastline.game, f = g.fighters[0], c = T.ctx, now = window.__realNow;
  const ox = L.gw / 2 - cam.x * cam.z, oy = L.gh / 2 - cam.y * cam.z, m = f.spec.moves.hSide, len = m.startup + m.active + m.endlag;
  const set = (i) => {
    const k = Math.floor(i / len) % 3; Object.assign(f, { state: 'idle', move: null, mid: null, mt: 0, vx: 0, grounded: true, flash: 0, spr: 0, chg: 0 });
    if (k === 1) { f.state = 'run'; f.vx = f.spec.stats.run; f.anim.run = i * 0.37; }
    if (k === 2) { f.state = 'attack'; f.move = m; f.mid = 'hSide'; f.mt = i % len; }
  };
  const flush = () => c.getImageData(0, 0, 1, 1);
  // (rim: "new" is the figure with the 2v2 team rim, "old" the figure without it)
  const one = (off, tk) => { if (rim) T.rim = !off; else window.__cvOff = off; flush(); const t0 = now(); drawFighter(c, f, tk); flush(); return now() - t0; };
  c.save(); c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * ox, DPR * oy);
  set(0); const cold = one(false, 1000);   // the first call carves the figure
  const rs = []; for (let i = 0; i < 40; i++) { c.fillRect(0, 0, 1, 1); flush(); const t0 = now(); flush(); rs.push(now() - t0); }   // the read alone
  rs.sort((a, b) => a - b); const rd = rs[20];
  // warm-up: every timed frame once (the sprites of each lean step and sway step are drawn the first time they are met: the timing is the
  // steady cost of a frame; the first call above is the cost of carving the figure)
  for (let i = 0; i < n; i++) { set(i); one(false, 2000 + i); one(true, 2000 + i); }
  // the frames in blocks of 12: the new drawing over a block, then the old one over the same block (the order swapped every block), so a
  // noisy machine hits both alike and each is timed in its steady state (a call right after the other drawing pays for its cold caches)
  const tn = [], to = [], B = 12, run = (off, i0, out) => { for (let i = i0; i < Math.min(n, i0 + B); i++) { set(i); out.push(one(off, 2000 + i)); } };
  for (let i0 = 0, k = 0; i0 < n; i0 += B, k++) { if (k & 1) { run(true, i0, to); run(false, i0, tn); } else { run(false, i0, tn); run(true, i0, to); } }
  c.restore(); window.__cvOff = false; T.rim = false;
  const st = (ts) => { ts.sort((a, b) => a - b); const med = ts[Math.floor(ts.length / 2)], p95 = ts[Math.floor(ts.length * 0.95)]; return { med: med - rd, p95: p95 - rd, raw: [med, p95] }; };
  const N = st(tn), O = st(to);
  return { new: Object.assign(N, { read: rd, cold: cold - rd, iso: self.crossOriginIsolated, z: DPR * cam.z }), old: O };
}"""

# one picture of fighter 0 drawn into its own canvas at z px/unit, in one of the FACES modes (the state is set first)
FACE = """([z, mode]) => {
  const X = window.__cvTest, f = window.__blastline.game.fighters[0], cv = document.createElement('canvas'); cv.width = 92 * z; cv.height = 92 * z;
  const c = cv.getContext('2d'); c.fillStyle = '#f2c79a'; c.fillRect(0, 0, cv.width, cv.height); c.setTransform(z, 0, 0, z, (46 - f.x) * z, (84 - f.y) * z);
  const ex = ['terror', 'grin', 'rage', 'calm', 'dazed', 'ko'], up = (P, k) => ({ hF: [k.w * 0.95, -k.leg * 0.2] });
  if (ex.includes(mode)) f.finPose = (P, k) => { P.expr = mode; P.exK = 1; if (mode === 'terror') P.mouth = 1; return up(P, k); };
  if (mode === 'shout') f.finPose = (P, k) => { P.mouth = 1; return up(P, k); };
  if (mode === 'flash') f.flash = 2;
  if (mode === 'glaze') X.glaze(f, true);
  if (mode === 'team rim') { X.rim = true; f.team = 1; }
  try { X.draw(c, f, 100); } finally { f.finPose = null; f.flash = 0; X.glaze(f, false); X.rim = false; f.team = undefined; }
  return cv.toDataURL('image/png');
}"""
FACES = ['idle', 'shout', 'terror', 'grin', 'rage', 'calm', 'dazed', 'ko', 'hitstun', 'flash', 'helpless', 'glaze', 'team rim', 'Ink Noir', 'Starfall']

errs = []

# the live match (--live): Math.random seeded before the page runs, the bot plays fighter 0
SEED = """(() => { let s = 12345; Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; }; window.__reseed = () => { s = 12345; }; })();"""
LIVE_GO = """([off]) => { window.__cvOff = off; const bot = BL.makeBot(0.9); window.__blInput = (G) => BL.botInput(G, G.fighters[0], G.fighters[1], bot); }"""
# a block of n frames, each timed whole (sim + draw + raster: a 1 px read before and after), with the sprites baked in each
LIVE_RUN = """([n]) => {
  const now = window.__realNow, c = window.__cvTest.ctx, ts = [], bk = [];
  let b0 = window.__cvTest.bakes().made;
  for (let i = 0; i < n; i++) {
    c.getImageData(0, 0, 1, 1);
    const t0 = now(); window.__clock.step(16.667); c.getImageData(0, 0, 1, 1); ts.push(now() - t0);
    const b = window.__cvTest.bakes(); bk.push(b.made - b0); b0 = b.made;
  }
  const g = window.__blastline.game;
  return { ts, bk, bakes: window.__cvTest.bakes(), st: g.fighters.map((f) => [f.state, f.stocks, f.dmg]) };
}"""


def live(me, opp, n):
    html = (ROOT / 'build' / 'test.html').read_bytes()
    q = lambda a, p: round(sorted(a)[min(len(a) - 1, int(len(a) * p))], 2)
    out, pgs = {}, {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--disable-gpu'])
        for key, off in (('new', False), ('old', True)):
            ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
            prof = {'tut': True, 'last': me, 'sound': False, 'fs': False, 'screen': 'cw'}
            ctx.add_init_script(SEED)
            ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('potatobrawl.profile.v1', %s);" % json.dumps(json.dumps(prof)))
            ctx.add_init_script(CLOCK)
            ctx.route(ORIGIN + '**', lambda r: r.fulfill(status=200, body=html, headers={'Content-Type': 'text/html; charset=utf-8',
                      'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless'}))
            pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'live {key}: {e}'))
            pg.goto(ORIGIN + 'test.html'); pg.wait_for_timeout(1200)
            pg.click('#bPractice'); pg.wait_for_timeout(300)
            pg.click('#lvlPick'); lv = pg.locator('#lvlPop button'); lv.nth(lv.count() - 1).click()
            pg.click('#oppPick'); pg.click(f'#oppPop button >> nth={1 + ALL.index(opp)}')
            # the clock held and Math.random seeded again before the match starts, so both pages play the very same match
            pg.evaluate("() => window.__clock.freeze()"); step(pg, 2); pg.evaluate("() => window.__reseed()")
            pg.click('#selGo')
            for _ in range(2000):
                if pg.evaluate("() => { window.__clock.step(16.667); const g = window.__blastline.game; return !!g && g.phase === 'play'; }"):
                    break
            if SKINS:
                pg.evaluate("(ks) => window.__blastline.game.fighters.forEach((f, i) => { if (ks[i] !== undefined) f.pal = f.spec.palettes[ks[i]]; })", SKINS)
            pg.evaluate(LIVE_GO, [off])
            pgs[key] = pg
        # the two matches in turn, 60 frames at a time (the order swapped every block): a noisy machine hits both alike
        res = {k: {'ts': [], 'bk': []} for k in pgs}
        for i0 in range(0, n, 60):
            for key in (('new', 'old') if (i0 // 60) % 2 == 0 else ('old', 'new')):
                r = pgs[key].evaluate(LIVE_RUN, [min(60, n - i0)])
                res[key]['ts'] += r['ts']; res[key]['bk'] += r['bk']; res[key]['r'] = r
        for key, pg in pgs.items():
            names = pg.evaluate("() => window.__blastline.game.fighters.map((f) => f.spec.id + ':' + f.pal.name)")
            r, ts, bk = res[key]['r'], res[key]['ts'], res[key]['bk']
            bf = [t for t, k in zip(ts, bk) if k]
            out[key] = {'fighters': names, 'med': q(ts, .5), 'p95': q(ts, .95), 'p99': q(ts, .99), 'max': round(max(ts), 2),
                        'over8': sum(t > 8 for t in ts), 'over16': sum(t > 16.7 for t in ts), 'baked': sum(bk), 'first300': sum(bk[:300]),
                        'last600': sum(bk[-600:]), 'bakeFrames': len(bf), 'bakeFrameMed': q(bf, .5) if bf else None,
                        'held': r['bakes']['n'], 'heldPx': r['bakes']['px'], 'biggest': r['bakes']['big'], 'end': r['st']}
            o = out[key]
            print(f"{key:4s} {' vs '.join(names)}: frame median {o['med']} ms, p95 {o['p95']}, p99 {o['p99']}, max {o['max']} | sprites baked "
                  f"{o['baked']} (first 300 frames {o['first300']}, last 600 {o['last600']}; {o['bakeFrames']} frames baked one) | held "
                  f"{o['held']} sprites, {o['heldPx'] / 1e6:.2f} M px, biggest {o['biggest'] / 1e6:.3f} M px", flush=True)
        b.close()
    (OUT / 'carve-live.json').write_text(json.dumps(out, indent=1))


def step(pg, n=1):
    for _ in range(n):
        for _ in range(200):
            if pg.evaluate("() => window.__clock.step(17)"):
                break
            pg.wait_for_timeout(10)


def grab(pg, wx, wy, up):
    # a clip of (2wx x 2wy) world units centred on the fighter, `up` units above his feet
    w = pg.evaluate(WHERE); z = w['z']
    cx, cy = w['x'], w['y'] - up * z
    png = pg.screenshot(clip={'x': cx - wx * z, 'y': cy - wy * z, 'width': 2 * wx * z, 'height': 2 * wy * z})
    return Image.open(io.BytesIO(png)).convert('RGB'), w


def label(img, text):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, 20], fill=(18, 17, 28))
    d.text((5, 2), text, fill=(240, 228, 200), font=FONT)
    return img


def start(pg, fid):
    pg.goto(ORIGIN + 'test.html'); pg.wait_for_timeout(1200)
    pg.add_style_tag(content="#scrPause{display:none!important} #hud{display:none!important}")
    pg.click('#bPractice'); pg.wait_for_timeout(300)
    pg.click('#lvlPick'); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click('#oppPick'); pg.click(f'#oppPop button >> nth={1 + (ALL.index(fid) + 1) % len(ALL)}')
    pg.click('#selGo')
    pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    pg.wait_for_timeout(300)
    pg.evaluate("() => window.__clock.freeze()")
    pg.evaluate("() => { const g = window.__blastline.game; g.hitstop = 1e9; window.__blastline.r3.lockQ = true; }")
    step(pg, 2)


def main():
    html = (ROOT / 'build' / 'test.html').read_bytes()
    results, skin_rows, hurt_rows, face_rows = {}, [], [], []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--disable-gpu'])
        for fid in ids:
            ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
            prof = {'tut': True, 'last': fid, 'sound': False, 'fs': False, 'screen': 'cw'}
            ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('potatobrawl.profile.v1', %s);" % json.dumps(json.dumps(prof)))
            ctx.add_init_script(CLOCK)
            ctx.route(ORIGIN + '**', lambda r: r.fulfill(status=200, body=html, headers={'Content-Type': 'text/html; charset=utf-8',
                      'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless'}))
            pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'{fid}: {e}'))
            start(pg, fid)
            if sheets:
                cells = []
                for st in STATES:
                    pg.evaluate(SET, [st]); step(pg, 3)
                    img, _ = grab(pg, 80, 66, 40)
                    cells.append(label(img.resize((320, 264), Image.LANCZOS), st))
                cols = 6
                sheet = Image.new('RGB', (cols * 320, -(-len(cells) // cols) * 264), (18, 17, 28))
                for i, im in enumerate(cells):
                    sheet.paste(im, ((i % cols) * 320, (i // cols) * 264))
                sheet.save(OUT / f'carve-{fid}.png')
                # all ten skins standing
                names = pg.evaluate("() => window.__blastline.game.fighters[0].spec.palettes.map((p) => p.name)")
                pics = []
                for i in range(len(names)):
                    pg.evaluate("(i) => { const f = window.__blastline.game.fighters[0]; f.pal = f.spec.palettes[i]; }", i)
                    pg.evaluate(SET, ['idle']); step(pg, 3)
                    img, _ = grab(pg, 58, 56, 36)
                    pics.append(label(img.resize((232, 224), Image.LANCZOS), names[i]))
                pg.evaluate("() => { const f = window.__blastline.game.fighters[0]; f.pal = f.spec.palettes[0]; }")
                skin_rows.append((fid, pics))
                # the hurtbox over idle, run and the side heavy at the hit
                hp = []
                for st in ['idle', 'run', 'side heavy']:
                    pg.evaluate(SET, [st]); step(pg, 3)
                    img, w = grab(pg, 64, 56, 36)
                    z, sc = w['z'], DSF
                    d = ImageDraw.Draw(img)
                    cx, fy = 64 * z * sc, (56 + 36) * z * sc
                    d.rectangle([cx - w['w'] / 2 * z * sc, fy - w['h'] * z * sc, cx + w['w'] / 2 * z * sc, fy], outline=(60, 255, 120), width=3)
                    hp.append(label(img.resize((256, 224), Image.LANCZOS), f'{st} ({w["w"]}x{w["h"]})'))
                hurt_rows.append((fid, hp))
                # the faces and the skin passes
                fz = pg.evaluate("() => window.__cvTest.dpr * window.__cvTest.cam.z") * 2
                pals = pg.evaluate("() => window.__blastline.game.fighters[0].spec.palettes.map((p) => p.pommes || 0)")
                fp = []
                for m in FACES:
                    pal = pals.index(1) if m == 'Ink Noir' else pals.index(2) if m == 'Starfall' else 0
                    pg.evaluate("(i) => { const f = window.__blastline.game.fighters[0]; f.pal = f.spec.palettes[i]; }", pal)
                    pg.evaluate(SET, ['hitstun' if m == 'hitstun' else 'helpless' if m == 'helpless' else 'idle']); step(pg, 3)
                    img = Image.open(io.BytesIO(base64.b64decode(pg.evaluate(FACE, [fz, m]).split(',')[1]))).convert('RGB')
                    fp.append(label(img.resize((276, 276), Image.LANCZOS), m))
                pg.evaluate("() => { const f = window.__blastline.game.fighters[0]; f.pal = f.spec.palettes[0]; }")
                face_rows.append((fid, fp))
            if timing:
                step(pg, 2)
                r = pg.evaluate(TIME, [NFR, False]); new, old = r['new'], r['old']
                results[fid] = {'new': new, 'old': old}
                print(f"{fid}: new median {new['med']:.3f} ms, p95 {new['p95']:.3f} ms, first call {new['cold']:.2f} ms | "
                      f"old median {old['med']:.3f} ms, p95 {old['p95']:.3f} ms (the 1 px read, {new['read']:.3f} ms, taken off; "
                      f"{new['z']:.2f} px/unit, isolated {new['iso']})", flush=True)
            ctx.close()
        b.close()
    if sheets:
        rl = 110
        img = Image.new('RGB', (rl + 232 * 10, 224 * len(skin_rows)), (18, 17, 28)); d = ImageDraw.Draw(img)
        for r, (fid, pics) in enumerate(skin_rows):
            d.text((8, r * 224 + 100), fid, fill=(240, 228, 200), font=FONT)
            for c_, pc in enumerate(pics): img.paste(pc, (rl + c_ * 232, r * 224))
        img.save(OUT / 'carve-skins.png')
        img = Image.new('RGB', (rl + 256 * 3, 224 * len(hurt_rows)), (18, 17, 28)); d = ImageDraw.Draw(img)
        for r, (fid, pics) in enumerate(hurt_rows):
            d.text((8, r * 224 + 100), fid, fill=(240, 228, 200), font=FONT)
            for c_, pc in enumerate(pics): img.paste(pc, (rl + c_ * 256, r * 224))
        img.save(OUT / 'carve-hurtbox.png')
        img = Image.new('RGB', (rl + 276 * len(FACES), 276 * len(face_rows)), (18, 17, 28)); d = ImageDraw.Draw(img)
        for r, (fid, pics) in enumerate(face_rows):
            d.text((8, r * 276 + 128), fid, fill=(240, 228, 200), font=FONT)
            for c_, pc in enumerate(pics): img.paste(pc, (rl + c_ * 276, r * 276))
        img.save(OUT / 'carve-faces.png')
    if timing:
        (OUT / 'carve-timing.json').write_text(json.dumps(results, indent=1))
    print('errors:', errs[:5] if errs else 'no errors')


# ---------- the 2v2 team rim (--rim, --live --duo) ----------
# a Team Brawl 2v2 with the four fighters given (slots 0 and 1 team 0, 2 and 3 team 1), skin 0 each: Practice > VS Team Brawl 2v2 on the
# map, Fight, then (the CPU foes are random) the four fighters are made anew with BL.newGame and laid over the game's own (same objects)
DUO_PICK = """([mid]) => {
  [...document.querySelectorAll('#oppPop button')].find((b) => b.textContent.endsWith('Team Brawl 2v2')).click();
  const pool = BL.MAPS.map((m, i) => i).filter((i) => BL.MAPS[i].pool !== false);
  return 1 + pool.indexOf(BL.MAPS.findIndex((m) => m.id === mid));
}"""
DUO_SWAP = """([ids]) => {
  const g = window.__blastline.game, F = (id) => BL.FIGHTERS.find((s) => s.id === id);
  const s = BL.newGame({ seed: 1, players: ids.map((id, i) => ({ spec: F(id), pal: F(id).palettes[0], team: i < 2 ? 0 : 1 })), map: g.map });
  BL.useStage(g);
  g.fighters.forEach((o, i) => { const f = s.fighters[i]; Object.assign(o, f, { x: o.x, y: o.y, facing: o.facing, state: o.state, st: o.st, stocks: o.stocks }); });
  return g.fighters.map((f) => f.spec.id + ':' + f.team);
}"""


def duo_start(pg, ids, mid, live=False):
    pg.click('#oppPick'); pg.wait_for_timeout(150)
    nth = pg.evaluate(DUO_PICK, [mid]); pg.wait_for_timeout(150)
    pg.click('#mapPick'); pg.wait_for_timeout(150); pg.click(f'#mapPop button >> nth={nth}'); pg.wait_for_timeout(150)
    if live:   # the clock held and Math.random seeded again before the match starts, so both pages play the very same match
        pg.evaluate("() => window.__clock.freeze()"); step(pg, 2); pg.evaluate("() => window.__reseed()")
    pg.click('#selGo')
    if live:
        for _ in range(2000):
            if pg.evaluate("() => { window.__clock.step(16.667); const g = window.__blastline.game; return !!g && g.phase !== 'countdown'; }"):
                break
    else:
        pg.wait_for_function("() => window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=20000)
    return pg.evaluate(DUO_SWAP, [ids])


# one state on slots 0 (ice, on the left facing right) and 2 (ember, on the right facing left); 1 and 3 are out of the picture
SET2 = """([st]) => {
  const g = window.__blastline.game;
  g.projs.length = 0;
  for (const i of [1, 3]) Object.assign(g.fighters[i], { state: 'gone', x: 0, y: 0 });
  return [0, 2].map((i) => {
    const f = g.fighters[i], x = i ? 85 : -85;
    Object.assign(f, { x, y: 0, facing: i ? -1 : 1, vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, grounded: true, state: 'idle', st: 6, move: null, mid: null, mt: 0,
      hitLog: {}, chg: 0, spr: 0, tumble: false, dodgeKind: null, armorFlash: 0, invuln: 0, held: -1, doomed: false });
    const atk = (key, d) => { f.state = 'attack'; f.move = f.spec.moves[key]; f.mid = key; f.mt = Math.max(0, f.move.startup + d); };
    switch (st) {
      case 'run': f.state = 'run'; f.vx = f.spec.stats.run * f.facing; f.anim.run = 1.1; break;
      case 'side heavy': atk('hSide', 1); break;
      case 'hitstun': f.state = 'hitstun'; f.kbx = -4 * f.facing; f.kby = -3; f.st = 3; break;
      case 'ledge': f.state = 'ledge'; f.grounded = false; break;
      case 'hit flash': f.flash = 2; break;
      case 'helpless': f.state = 'helpless'; f.grounded = false; f.y = -40; f.vy = 3; break;
      case 'dodge': f.state = 'dodge'; f.dodgeKind = 'spot'; f.st = 8; break;
      case 'intangible': f.invuln = 60; break;
      case 'respawn': f.state = 'respawn'; f.grounded = false; f.y = -40; break;
    }
    return f.spec.id + ':' + f.team;
  });
}"""
RIM_STATES = ['idle', 'run', 'side heavy', 'hitstun', 'ledge']
RIM_MODES = ['hit flash', 'helpless', 'dodge', 'intangible', 'respawn']
WHERE2 = """([i]) => { const f = window.__blastline.game.fighters[i], T = window.__cvTest; const a = T.toScreen(f.x, f.y), b = T.toScreen(f.x + 10, f.y);
  return { x: a[0], y: a[1], z: (b[0] - a[0]) / 10 }; }"""


def duo_page(b, ids, mid, seed=False):
    html = (ROOT / 'build' / 'test.html').read_bytes()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
    prof = {'tut': True, 'last': ids[0], 'sound': False, 'fs': False, 'screen': 'cw', 'duoTip': 3}
    if seed:
        ctx.add_init_script(SEED)
    ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('potatobrawl.profile.v1', %s);" % json.dumps(json.dumps(prof)))
    ctx.add_init_script(CLOCK)
    ctx.route(ORIGIN + '**', lambda r: r.fulfill(status=200, body=html, headers={'Content-Type': 'text/html; charset=utf-8',
              'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless'}))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'rim {ids}: {e}'))
    pg.goto(ORIGIN + 'test.html'); pg.wait_for_timeout(1200)
    pg.add_style_tag(content="#scrPause{display:none!important} #hud{display:none!important} .duo-tip{display:none!important}")
    pg.evaluate("() => { window.__blastline.r3.lockQ = true; }")
    pg.click('#bPractice'); pg.wait_for_timeout(300)
    return ctx, pg


def grab2(pg, i, wx, wy, up):
    w = pg.evaluate(WHERE2, [i]); z = w['z']
    png = pg.screenshot(clip={'x': w['x'] - wx * z, 'y': w['y'] - (wy + up) * z, 'width': 2 * wx * z, 'height': 2 * wy * z})
    return Image.open(io.BytesIO(png)).convert('RGB')


def rim_main():
    rows, mrows, results = [], [], {}
    other = lambda fid: ALL[(ALL.index(fid) + 3) % len(ALL)]
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--disable-gpu'])
        if sheets:
            for fid in ids:
                ctx, pg = duo_page(b, [fid, other(fid), fid, other(fid)], 'castle')
                duo_start(pg, [fid, other(fid), fid, other(fid)], 'castle')
                pg.wait_for_timeout(200)
                pg.evaluate("() => window.__clock.freeze()")
                pg.evaluate("() => { const g = window.__blastline.game; g.hitstop = 1e9; }")
                cells, mcells = [], []
                for lst, out in ((RIM_STATES, cells), (RIM_MODES, mcells)):
                    for st in lst:
                        who = pg.evaluate(SET2, [st]); step(pg, 3)
                        for i, tn in ((0, 'ice'), (2, 'ember')):
                            img = grab2(pg, i, 60, 50, 36)
                            out.append(label(img.resize((240, 200), Image.LANCZOS), f'{st} ({tn})'))
                rows.append((fid, cells)); mrows.append((fid, mcells))
                ctx.close()
            for name, rs in (('team-rim.png', rows), ('team-rim-modes.png', mrows)):
                rl, n = 110, max(len(c) for _, c in rs)
                img = Image.new('RGB', (rl + 240 * n, 200 * len(rs)), (18, 17, 28)); d = ImageDraw.Draw(img)
                for r, (fid, cells) in enumerate(rs):
                    d.text((8, r * 200 + 90), fid, fill=(240, 228, 200), font=FONT)
                    for c_, pc in enumerate(cells): img.paste(pc, (rl + c_ * 240, r * 200))
                img.save(OUT / name)
            # a match on each stage: four bots
            for mid, four in (('castle', ['samurai', 'odin', 'alchemist', 'reaper']), ('fryer', ['wizard', 'gunslinger', 'phoenix', 'dragon'])):
                ctx, pg = duo_page(b, four, mid, seed=True)
                duo_start(pg, four, mid, live=True)
                pg.evaluate("() => { const bot = BL.makeBot(0.9); window.__blInput = (G) => BL.teamBotInput(G, G.fighters[0], bot); }")
                pg.add_style_tag(content="#ctl{display:none!important}")
                # the first frame from 2 s in where all four are up, solid and none stands within 60 units of another (a picture that reads)
                for k in range(1800):
                    if pg.evaluate("([k]) => { window.__clock.step(16.667); const F = window.__blastline.game.fighters;"
                                   " return k > 120 && F.every((f) => !BL.intangible(f) && !f.flash)"
                                   " && F.every((f, i) => F.every((o, j) => i === j || Math.abs(f.x - o.x) > 60)); }", [k]):
                        break
                step(pg, 1)
                Image.open(io.BytesIO(pg.screenshot())).convert('RGB').save(OUT / f'team-rim-{mid}.png')
                ctx.close()
        if timing:
            for fid in ids:
                ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
                html = (ROOT / 'build' / 'test.html').read_bytes()
                prof = {'tut': True, 'last': fid, 'sound': False, 'fs': False, 'screen': 'cw'}
                ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('potatobrawl.profile.v1', %s);" % json.dumps(json.dumps(prof)))
                ctx.add_init_script(CLOCK)
                ctx.route(ORIGIN + '**', lambda r: r.fulfill(status=200, body=html, headers={'Content-Type': 'text/html; charset=utf-8',
                          'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless'}))
                pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'{fid}: {e}'))
                start(pg, fid); step(pg, 2)
                r = pg.evaluate(TIME, [NFR, True]); on, off = r['new'], r['old']
                results[fid] = {'rim': on, 'norim': off}
                print(f"{fid}: rim on median {on['med']:.3f} ms, p95 {on['p95']:.3f} | rim off median {off['med']:.3f} ms, p95 {off['p95']:.3f} | "
                      f"the rim {on['med'] - off['med']:+.3f} ms ({on['z']:.2f} px/unit)", flush=True)
                ctx.close()
            (OUT / 'carve-rim-timing.json').write_text(json.dumps(results, indent=1))
        b.close()


# the live 2v2: the rim on ('rim') and off ('norim', window.__cvTest.rimOff), the same seeded match on both, 60 frames at a time in turn
def live_duo(four, n):
    q = lambda a, p: round(sorted(a)[min(len(a) - 1, int(len(a) * p))], 2)
    out, pgs = {}, {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--disable-gpu'])
        for key in ('rim', 'norim'):
            ctx, pg = duo_page(b, four, 'castle', seed=True)
            if key == 'norim':
                pg.evaluate("() => { window.__cvTest.rimOff = true; }")
            duo_start(pg, four, 'castle', live=True)
            pg.evaluate("() => { const bot = BL.makeBot(0.9); window.__blInput = (G) => BL.teamBotInput(G, G.fighters[0], bot); }")
            pgs[key] = pg
        res = {k: {'ts': [], 'bk': []} for k in pgs}
        for i0 in range(0, n, 60):
            for key in (('rim', 'norim') if (i0 // 60) % 2 == 0 else ('norim', 'rim')):
                r = pgs[key].evaluate(LIVE_RUN, [min(60, n - i0)])
                res[key]['ts'] += r['ts']; res[key]['bk'] += r['bk']; res[key]['r'] = r
        for key, pg in pgs.items():
            names = pg.evaluate("() => window.__blastline.game.fighters.map((f) => f.spec.id + ':' + f.pal.name + ':' + f.team)")
            r, ts, bk = res[key]['r'], res[key]['ts'], res[key]['bk']
            bf = [t for t, k in zip(ts, bk) if k]
            out[key] = {'fighters': names, 'med': q(ts, .5), 'p95': q(ts, .95), 'p99': q(ts, .99), 'max': round(max(ts), 2),
                        'over16': sum(t > 16.7 for t in ts), 'baked': sum(bk), 'first300': sum(bk[:300]), 'last600': sum(bk[-600:]),
                        'bakeFrames': len(bf), 'held': r['bakes']['n'], 'heldPx': r['bakes']['px'], 'biggest': r['bakes']['big'], 'end': r['st']}
            o = out[key]
            print(f"{key:5s} {', '.join(names)}: frame median {o['med']} ms, p95 {o['p95']}, p99 {o['p99']}, max {o['max']} | sprites baked "
                  f"{o['baked']} (first 300 frames {o['first300']}, last 600 {o['last600']}; {o['bakeFrames']} frames baked one) | held "
                  f"{o['held']} sprites, {o['heldPx'] / 1e6:.2f} M px, biggest {o['biggest'] / 1e6:.3f} M px | end {o['end']}", flush=True)
        b.close()
    (OUT / 'carve-live-duo.json').write_text(json.dumps(out, indent=1))


if __name__ == '__main__':
    if LIVE and DUO:
        four = (ids + ALL)[:4]
        live_duo(four, LIVE)
        print('errors:', errs[:5] if errs else 'no errors')
    elif RIM:
        rim_main()
        print('errors:', errs[:5] if errs else 'no errors')
    elif LIVE:
        live(ids[0], ids[1] if len(ids) > 1 else ids[0], LIVE)
        print('errors:', errs[:5] if errs else 'no errors')
    else:
        main()
