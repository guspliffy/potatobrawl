# The hit grammar (game/ui/hitkit.js, effects.js; concept redesign/concept.md D.1): the kit sheet, each kit's hit frame by frame, and the
# check that a hit's effects never hide the fighter being hit.
# Usage: python3 tests/pwhit.py [fighter ...] [--out DIR] [--nosheets] [--nocover]
#   defaults: every fighter, --out /mnt/project-files/redesign/build/pr2/
# Opens build/test.html (run python3 game/build.py first) in Practice against a Dummy, takes the page clock (rAF and performance.now only move
# when the test steps them, one sim tick a step), sets fighter 0 into a move with the Dummy in its path and steps the real hit through.
#   hit-kits.png       the eight kits: the spark at tier 1 / 2 / 3, shards, a smear, the floor mark, the glint and a launch trail, each next
#                      to a 44 x 64 body box (the size rule: a spark's edge layer reaches at most 0.225 body heights from its centre)
#   hit-<fighter>.png  that fighter's side heavy launching its opponent (at 120 %), frame by frame at 844x390 (a crop round the pair, at
#                      the phone's real size): anticipation (the glint), smear (the first active frame, the Dummy out of reach), impact A,
#                      impact B, hit-stop, launch, residue; top row Reduce flashes off, bottom row on (the dimmed backdrop in place of the
#                      impact frames)
#   coverage           for each fighter a light (side, 0 %), a heavy (hSide, 0 %) and a launcher (hSide, 120 %), Reduce flashes on (every tick
#                      a normal picture): on every tick from the hit to 12 ticks after the freeze, the share of the victim's silhouette pixels
#                      (the victim drawn alone) that the effects change (the frame drawn with and without the fx and sfx lists, a pixel
#                      counts when a channel moves by more than 64): at most 20 %. Also checks the tier each hit got.
# Prints "no errors" when every check passed and no page error happened.
import sys, json, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
ALL = ['phoenix', 'alchemist', 'odin', 'wizard', 'samurai', 'dragon', 'gunslinger', 'reaper']
OUT = pathlib.Path(args[args.index('--out') + 1] if '--out' in args else '/mnt/project-files/redesign/build/pr2/')
skip = {args[args.index('--out') + 1]} if '--out' in args else set()
ids = [a for a in args if not a.startswith('--') and a not in skip] or ALL
sheets, cover = '--nosheets' not in args, '--nocover' not in args
W, H, DSF = 844, 390, 2
MAXCOV = 0.20
OUT.mkdir(parents=True, exist_ok=True)
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    FONT = ImageFont.load_default()

CLOCK = """(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let cbs = [], live = true, t = 0;
  window.requestAnimationFrame = (f) => { if (live) return realRAF((ts) => (live ? f(ts) : cbs.push(f))); cbs.push(f); return 1; };
  performance.now = () => (live ? realNow() : t);
  window.__clock = { freeze() { t = realNow(); live = false; }, step(ms) { t += ms; const q = cbs.splice(0); for (const f of q) f(t); return q.length; },
    tick() { return this.step(1000 / 60); } };
})();"""

# fighter 0 into `key` with mt `mt0`, the Dummy at `pct` % standing in the path of the move's first hitbox (or `far` units away)
SET = """([key, pct, far, mt0]) => {
  const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1], m = f.spec.moves[key], b = m.boxes[0];
  g.projs.length = 0; g.hitstop = 0;
  window.__hkTest.fx.length = 0;
  Object.assign(f, { x: -60, y: 0, facing: 1, vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, grounded: true, plat: -1, state: 'attack', st: 0, move: m, mid: key,
    mt: mt0 === null ? Math.max(0, m.startup - 3) : mt0, hitLog: {}, chg: 0, spr: 0, tumble: false, armorFlash: 0, invuln: 0, percent: 0, combo: 0 });
  const air = b.y < -o.s.h * 1.05;
  Object.assign(o, { x: f.x + (far ? far : b.x + o.s.w * 0.3), y: air ? Math.round(b.y + o.s.h * 0.45) : 0, facing: -1, vx: 0, vy: 0, kbx: 0, kby: 0,
    state: air ? 'air' : 'idle', st: 10, move: null, mid: null, grounded: !air, plat: -1, flash: 0, percent: pct, hitstun: 0, tumble: false, invuln: 0,
    combo: 0, strN: 0, lastHitBy: null, stocks: Math.max(o.stocks, 3) });   // lives topped up: the launches at 120 % are KOs, and the match must not end
  return [m.startup, m.active, m.endlag];
}"""
# one tick; returns what the test needs to know about it
TICK = """() => { window.__clock.tick(); const g = window.__blastline.game, f = g.fighters[0], o = g.fighters[1], T = window.__hkTest;
  return { mt: f.mt, mid: f.mid, hs: g.hitstop, hit: o.state === 'hitstun', pct: o.percent, imp: T.imp.g === g ? T.imp.t : 99,
    tiers: T.fx.filter((e) => e.k === 'hks').map((e) => e.tier), marks: T.fx.filter((e) => e.k === 'hkm').length, tick: T.tick }; }"""
# where to crop: the middle of the two fighters on the screen
WHERE = """() => { const g = window.__blastline.game, T = window.__cvTest, a = g.fighters[0], b = g.fighters[1];
  const p = T.toScreen((a.x + b.x) / 2, Math.min(a.y, b.y) - 40); return p; }"""
# the launch: between the attacker and the victim in flight; the residue: on the floor mark
WHERE_LAUNCH = """() => { const g = window.__blastline.game, T = window.__cvTest, a = g.fighters[0], b = g.fighters[1];
  return T.toScreen(a.x + (b.x - a.x) * 0.6, a.y + (b.y - a.y) * 0.6 - 40); }"""
WHERE_MARK = """() => { const g = window.__blastline.game, T = window.__cvTest, m = window.__hkTest.fx.find((e) => e.k === 'hkm'), a = g.fighters[0];
  return m ? T.toScreen(m.x, m.y - 30) : T.toScreen(a.x, a.y - 40); }"""
# the victim's silhouette pixels changed by the effects: the frame without the fx / sfx lists against the frame with all of them and the frame
# with only the hit kit's particles (kinds hk*), the victim drawn alone as the mask. With `kinds`: also each of those kinds alone
COVER = """([kinds]) => {
  const T = window.__hkTest, c = window.__cvTest.ctx, w = c.canvas.width, h = c.canvas.height;
  const M = T.alone(1).getContext('2d').getImageData(0, 0, w, h).data;
  T.frame({ noFx: true }); const A = c.getImageData(0, 0, w, h).data;
  const count = (o) => {
    T.frame(o); const B = c.getImageData(0, 0, w, h).data;
    let n = 0, k = 0;
    for (let i = 0; i < M.length; i += 4) {
      if (M[i + 3] < 128) continue;
      n++;
      if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 64) k++;
    }
    return n ? k / n : 0;
  };
  const all = count(), kit = count({ only: [...new Set(T.fx.map((e) => e.k))].filter((k) => k.startsWith('hk')) });
  const each = {}; if (kinds) for (const k of new Set(T.fx.map((e) => e.k))) each[k] = count({ only: [k] });
  T.frame();
  return { all, kit, each };
}"""

errs, bad, notes = [], [], []


def start(b, fid, opp):
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
    prof = {'tut': True, 'last': fid, 'sound': False, 'fs': False, 'screen': 'cw', 'rf': 0}
    ctx.add_init_script("window.__blNoQuick = true; localStorage.setItem('potatobrawl.profile.v1', %s);" % json.dumps(json.dumps(prof)))
    ctx.add_init_script(CLOCK)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'{fid}: {e}'))
    pg.goto((ROOT / 'build' / 'test.html').as_uri()); pg.wait_for_timeout(1200)
    pg.add_style_tag(content='#scrPause{display:none!important}')
    pg.click('#bPractice'); pg.wait_for_timeout(300)
    pg.click('#lvlPick'); pg.click("#lvlPop button:has-text('Dummy')")
    pg.click('#oppPick'); pg.click(f'#oppPop button >> nth={1 + ALL.index(opp)}')
    pg.evaluate("() => window.__clock.freeze()")
    pg.click('#selGo')
    for _ in range(3000):
        if pg.evaluate("() => { window.__clock.tick(); const g = window.__blastline.game; return !!g && g.phase === 'play'; }"):
            break
    for _ in range(110): pg.evaluate("() => window.__clock.tick()")   # the GO! banner gone
    pg.evaluate("() => { window.__blastline.r3.lockQ = true; }")
    return ctx, pg


def ticks(pg, n):
    r = None
    for _ in range(n): r = pg.evaluate(TICK)
    return r


def to_hit(pg, limit=40):
    """steps until the Dummy is hit; returns the tick record of the hit tick"""
    for _ in range(limit):
        r = pg.evaluate(TICK)
        if r['hit']: return r
    return None


def shot(pg, at):
    x, y = at
    cw, ch = 422, 234
    cx = int(max(0, min(W - cw, x - cw / 2))); cy = int(max(0, min(H - ch, y - ch * 0.55)))
    return Image.open(__import__('io').BytesIO(pg.screenshot(clip={'x': cx, 'y': cy, 'width': cw, 'height': ch}))).convert('RGB')


def label(im, text):
    d = ImageDraw.Draw(im); tw = d.textlength(text, font=FONT)
    d.rectangle([0, 0, tw + 10, 21], fill=(16, 14, 30)); d.text((5, 2), text, fill=(255, 240, 200), font=FONT)
    return im


COLS = ['anticipation', 'smear', 'light smear', 'impact A', 'impact B', 'hit-stop', 'launch', 'residue']


def first_active(pg, key, out, ante=None, name='smear'):
    """the Dummy out of reach: the last startup frame (ante) and the first active frame of `key`"""
    su, ac, el = pg.evaluate(SET, [key, 0, 150, None])
    for _ in range(40):
        r = pg.evaluate(TICK)
        if ante and r['mid'] == key and r['mt'] == su: out[ante] = shot(pg, pg.evaluate(WHERE))
        if r['mid'] == key and r['mt'] == su + 1: out[name] = shot(pg, pg.evaluate(WHERE)); break
    ticks(pg, 30)


def strip(pg, rf):
    """the side heavy at 120 %: the beats as pictures (rf: Reduce flashes); the side light's smear beside the heavy's"""
    pg.evaluate("([v]) => { window.__hkTest.rf = v; }", [rf])
    out = {}
    # run 1: the Dummy out of reach, the anticipation (the last startup frame) and the smear (the first active frame); the light's smear
    first_active(pg, 'hSide', out, 'anticipation', 'smear')
    first_active(pg, 'side', out, None, 'light smear')
    # run 2: the real hit
    pg.evaluate(SET, ['hSide', 120, 0, None])
    at = pg.evaluate(WHERE)
    r = to_hit(pg)
    if not r: bad.append('strip: the side heavy never hit'); return out
    hs = r['hs']
    out['impact A'] = shot(pg, at); r1 = r
    r = pg.evaluate(TICK); out['impact B'] = shot(pg, at); r2 = r
    if not rf and (r1['imp'] != 1 or r2['imp'] != 2): bad.append(f'impact frames: wanted ticks 1 and 2 after the hit, got {r1["imp"]}, {r2["imp"]} (tiers {r1["tiers"]})')
    if rf and (r1['imp'] in (1, 2) or r2['imp'] in (1, 2)): bad.append('impact frames shown under Reduce flashes')
    ticks(pg, 2); out['hit-stop'] = shot(pg, at)
    ticks(pg, max(1, hs - 4) + 5); out['launch'] = shot(pg, pg.evaluate(WHERE_LAUNCH))
    r = ticks(pg, 10); out['residue'] = shot(pg, pg.evaluate(WHERE_MARK))
    if not r['marks']: bad.append('residue: no floor mark under the launcher')
    ticks(pg, 40)
    return out


def cover_run(pg, fid, key, pct, want):
    """max coverage over the ticks of one hit (Reduce flashes on)"""
    pg.evaluate("() => { window.__hkTest.rf = 1; }")
    pg.evaluate(SET, [key, pct, 0, None])
    r = to_hit(pg)
    if not r: bad.append(f'{fid} {key} {pct}%: never hit'); return None
    tier = max(r['tiers']) if r['tiers'] else 0
    if tier != want: bad.append(f'{fid} {key} at {pct}%: tier {tier}, wanted {want}')
    kit, tot, why = 0.0, 0.0, ''
    for i in range(r['hs'] + 12):
        c = pg.evaluate(COVER, [False])
        kit = max(kit, c['kit'])
        if c['all'] > tot:
            tot = c['all']
            if tot > MAXCOV * 0.75:   # near the limit: which kinds of effect it is
                each = pg.evaluate(COVER, [True])['each']
                why = ', '.join(f'{kd} {v * 100:.1f}%' for kd, v in sorted(each.items(), key=lambda x: -x[1]) if v > 0.005)
        pg.evaluate(TICK)
    ticks(pg, 30)
    return kit, tot, why, tier


FXHIT = "() => document.getElementById('fxHit').classList.contains('go')"


def ko_check(pg, fid, opp):
    """the last life's lethal hit: the two impact frames come first (the finisher already on), then the finisher's own white frame"""
    pg.evaluate("() => { window.__hkTest.rf = 0; }")
    ticks(pg, 40)   # past the 30 ticks between two impact frames
    pg.evaluate(SET, ['hSide', 400, 0, None])
    pg.evaluate("() => { const o = window.__blastline.game.fighters[1]; o.stocks = 1; document.getElementById('fxHit').classList.remove('go'); }")
    r = to_hit(pg)
    if not r: bad.append('KO: the side heavy never hit'); return
    pics, seen = [], []
    for i in range(4):
        if i: r = pg.evaluate(TICK)
        fin, go = pg.evaluate("() => window.__blastline.fin.on"), pg.evaluate(FXHIT)
        seen.append((r['imp'], fin, go))
        pics.append(shot(pg, pg.evaluate(WHERE)))
    want = [(1, True, False), (2, True, False), (3, True, True)]
    if seen[:3] != want: bad.append(f'KO: wanted (impact frame, finisher on, its white frame) {want} on the three ticks after the hit, got {seen[:3]}')
    im = Image.new('RGB', (633 * 4, 351 + 30), (16, 14, 30))
    d = ImageDraw.Draw(im); d.text((8, 6), f'{fid} KO on {opp} (last life): impact A, impact B, then the finisher (its white frame)', fill=(255, 240, 200), font=FONT)
    for i, t in enumerate(pics): im.paste(label(t.resize((633, 351), Image.LANCZOS), ['impact A', 'impact B', 'finisher', 'finisher +1'][i]), (i * 633, 30))
    path = OUT / 'hit-ko.png'; im.save(path)
    print(f'KO: {seen[:3]} (impact frame, finisher on, its white frame); {path}')


def kit_sheet(pg):
    data = pg.evaluate("""() => {
      const T = window.__hkTest, ids = Object.keys(T.kits), z = 2.4, cw = 112, ch = 112, cols = 9, cv = document.createElement('canvas');
      cv.width = cols * cw * z; cv.height = ids.length * ch * z; const c = cv.getContext('2d');
      c.fillStyle = '#8fc7ef'; c.fillRect(0, 0, cv.width, cv.height);
      ids.forEach((id, row) => {
        const K = T.kits[id];
        for (let col = 0; col < cols; col++) {
          c.setTransform(z, 0, 0, z, col * cw * z, row * ch * z);
          c.fillStyle = (row + col) % 2 ? '#86bde6' : '#93cbf2'; c.fillRect(0, 0, cw, ch);
          c.fillStyle = '#d9b77a'; c.fillRect(0, 86, cw, ch - 86); c.fillStyle = '#1a1326'; c.fillRect(0, 85, cw, 1.5);
          const box = () => { c.save(); c.setLineDash([3, 3]); c.strokeStyle = 'rgba(26,19,38,0.55)'; c.lineWidth = 1; c.strokeRect(58, 85 - 64, 44, 64); c.restore(); };
          if (col < 3) {   // the spark at its real size on a 64 high body's edge (tier 1, 2, 3), at its pop (1.1)
            box(); const t = T.tiers[col + 1], ext = T.reach[K.shape] || 1.25;
            const R = Math.min(t.R, 0.225 * 64 / (1.1 * ext)) * 1.1; T.spark(c, 58, 85 - 36, R, K, col + 1, -0.6, 11 + row, 0.2);
          } else if (col === 3) { for (let i = 0; i < 6; i++) T.shard(c, 22 + (i % 3) * 32, 30 + Math.floor(i / 3) * 30, 6.5, -0.5 + i * 0.4, K, i); }
          else if (col === 4) { T.smear(c, 40, 52, 34, -1.6, 0.9, 13, K, {}); }
          else if (col === 5) { T.smear(c, 70, 60, 30, 2.6, 0.3, 9, K, { ry: 0.7 }); }
          else if (col === 6) { T.mark(c, 56, 86, 26, K, 1); }
          else if (col === 7) { T.glint(c, 56, 44, 14, K); }
          else { const pts = []; for (let i = 0; i < 14; i++) pts.push([8 + i * 6.5, 74 - i * 3.4 - Math.sin(i * 0.4) * 6]); T.trail(c, pts, 18, K); }
        }
      });
      return cv.toDataURL('image/png');
    }""")
    import base64, io
    im = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')
    kits = pg.evaluate("() => Object.keys(window.__hkTest.kits)")
    heads = ['tier 1', 'tier 2', 'tier 3', 'shards', 'smear', 'smear (flat)', 'floor mark', 'glint', 'launch trail']
    cw = im.width // len(heads); chh = im.height // len(kits)
    top = Image.new('RGB', (im.width + 130, im.height + 26), (16, 14, 30)); top.paste(im, (130, 26))
    d = ImageDraw.Draw(top)
    for i, hd in enumerate(heads): d.text((130 + i * cw + 6, 5), hd, fill=(255, 240, 200), font=FONT)
    for i, k in enumerate(kits): d.text((8, 26 + i * chh + chh // 2 - 8), k, fill=(255, 240, 200), font=FONT)
    path = OUT / 'hit-kits.png'; top.save(path)
    print(f'kit sheet: {path}')


with sync_playwright() as p:
    b = p.chromium.launch(args=['--disable-gpu'])
    results = {}
    for n, fid in enumerate(ids):
        opp = ALL[(ALL.index(fid) + 3) % len(ALL)]
        ctx, pg = start(b, fid, opp)
        if sheets and n == 0: kit_sheet(pg)
        if sheets:
            rows = [strip(pg, 0), strip(pg, 1)]
            tiles = [[r.get(cn) for cn in COLS] for r in rows]
            tw, th = 633, 351
            im = Image.new('RGB', (tw * len(COLS), th * 2 + 30), (16, 14, 30))
            d = ImageDraw.Draw(im); d.text((8, 6), f'{fid} side heavy on {opp} at 120 % (launcher): top Reduce flashes off, bottom on', fill=(255, 240, 200), font=FONT)
            for ri, row in enumerate(tiles):
                for ci, t in enumerate(row):
                    if t is None: continue
                    im.paste(label(t.resize((tw, th), Image.LANCZOS), COLS[ci] + (' (calm)' if ri and COLS[ci].startswith('impact') else '')), (ci * tw, 30 + ri * th))
            path = OUT / f'hit-{fid}.png'; im.save(path)
            print(f'{fid}: {path}')
        if cover:
            res = []
            for key, pct, want, name in (('side', 0, 1, 'light'), ('hSide', 0, 2, 'heavy'), ('hSide', 120, 3, 'launcher')):
                r = cover_run(pg, fid, key, pct, want)
                if r is None: continue
                kit, tot, why, tier = r
                res.append(f'{name} {kit * 100:.1f}% (all effects {tot * 100:.1f}%' + (f': {why}' if why else '') + ')')
                if kit > MAXCOV: bad.append(f'{fid} {name} on {opp}: the hit kit covers {kit * 100:.1f}% of the victim (max {MAXCOV * 100:.0f}%)')
                if tot > MAXCOV: notes.append(f'{fid} {name} on {opp}: all effects together cover {tot * 100:.1f}% ({why})')
            print(f'{fid} on {opp}: coverage ' + ', '.join(res))
        if n == 0 and '--noko' not in args: ko_check(pg, fid, opp)
        ctx.close()
    b.close()
for e in notes: print('NOTE', e)
for e in errs + bad: print('ERROR', e)
if not errs and not bad: print('no errors')
