# The match HUD: a calmer screen and danger readability (UI only).
#   python3 pwhud.py [outdir [tag ...]]   tags: se phone desk up btn   (default all; screenshots go to outdir)
# Every size (667x320, 844x390, 1280x760, upright 390x844):
#   layout   the timer is a strip clear of both cards, the pause icon sits under the opponent's card, small, clear of every touch
#            button, and the percent is the biggest text on each card and on the screen
#   markers  YOU / CPU are on at the start (hud.tag 1) and gone after about 4 s; pictures of both
#   tint     the percent is white at 40%, yellow at 120%, red at 180% and the card pulses (finr) from 175%; picture
#   glow     a hard launch of the player's own fighter lights the edge it heads for (left, right, top), a soft one does not, the
#            opponent's launch does not, a pause switches it off, it is gone after the KO; pictures
# Phone only (844x390): the markers come back for 3 s after each respawn (the player's and the CPU's) and also in sudden death; the
#   tutorial keeps them on and its prompt stays clear of the pause icon; the glow is steady with reduced motion and pulses without;
#   no glow in the KO finisher (a real final lethal hit on the player) and none left on the results screen.
# Touch buttons (five sizes incl. 740x360, on The Field and The Kitchen): every button (.pb) and the stick keep the touch areas they
#   had before the ink-glass look (the rects measured on main), the words are heavy italic, a pressed button sinks 3px; pictures of
#   Light pressed, Heavy held and charging, Special cooling, ULTI ready (tag 6_buttons) and pressed / finish (tag 6b_buttons).
# Prints "no errors" when every check passed and no page errors happened.
import asyncio, sys, math, re, os
import pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'hud'
os.makedirs(OUT, exist_ok=True)
ONLY = sys.argv[2:]
G = 'window.__blastline.game'
HUD = 'window.__blastline.hud'
PROFILE = "localStorage.setItem('potatobrawl.profile.v1', JSON.stringify({tokens: 85, rating: 1080, wins: 3, losses: 2, matches: 5, tut: true%s}))"

async def frames(pg, n):
    t0 = await pg.evaluate(f"{G}.t")
    await pg.wait_for_function(f"{G}.t >= {t0 + n}", timeout=60000)

async def ticks(pg, n):   # UI ticks (they also run while the game is frozen by hitstop)
    t0 = await pg.evaluate(f"{HUD}.tick")
    await pg.wait_for_function(f"{HUD}.tick >= {t0 + n}", timeout=60000)

async def start(b, tag, vp, up, errs, level='Dummy', reduced=False, tut=False, mapb=1):
    mob = vp['width'] < 1000
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=True, reduced_motion='reduce' if reduced else 'no-preference')
    await ctx.add_init_script(PROFILE % (", screen: 'up'" if up else ""))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.r3.lockQ = true"); await pg.wait_for_timeout(900)
    if tut:
        await pg.tap('#bHelp'); await pg.wait_for_timeout(200); await pg.tap('#hTry')
    else:
        await pg.tap('#bPractice'); await pg.wait_for_timeout(500)
        await pg.tap('#lvlPick'); await pg.wait_for_timeout(200)
        await pg.evaluate("(n) => [...document.querySelectorAll('#lvlPop button')].find((x) => x.textContent === n).click()", level); await pg.wait_for_timeout(200)
        # on Potato Moon: the launch and finisher setups below are placed for its layout (Practice picks a random map otherwise)
        await pg.evaluate(f"document.querySelectorAll('#mapPop button')[{mapb}].click()"); await pg.wait_for_timeout(100)
        await pg.tap('#selGo'); await pg.wait_for_timeout(700)
    await pg.wait_for_function(f"{G} && {G}.phase === 'play'", timeout=60000)
    return ctx, pg

# ---- layout ----
LAYOUT = """(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect(), W = innerWidth, H = innerHeight, bad = [];
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const c = r('#clock'), p0 = r('#pc0'), p1 = r('#pc1'), pb = r('#pauseBtn');
  if (hit(c, p0) || hit(c, p1)) bad.push('the timer overlaps a card');
  if (c.left < 0 || c.right > W || c.top < 0) bad.push('the timer is off screen');
  if (!document.querySelector('#app').classList.contains('narrow') && !(c.left >= p0.right - 14 && c.right <= p1.left + 14)) bad.push('the timer is not between the cards');
  if (pb.top < p1.bottom - 1) bad.push('the pause icon is not under the opponent card');
  if (pb.right > p1.right + 1 || pb.left < p1.left) bad.push('the pause icon is not under the opponent card (sideways)');
  if (pb.width < 34 || pb.width > 48 || pb.height < 34 || pb.height > 48) bad.push('the pause icon is ' + pb.width + 'x' + pb.height);
  if (pb.right > W || pb.bottom > H) bad.push('the pause icon is off screen');
  for (const b of document.querySelectorAll('.pb')) {
    const q = b.getBoundingClientRect(), k = b.dataset.k === 'special' ? 1.15 : 1, cx = q.left + q.width / 2, cy = q.top + q.height / 2, rr = q.width / 2 * k;
    const nx = Math.max(pb.left, Math.min(cx, pb.right)), ny = Math.max(pb.top, Math.min(cy, pb.bottom));
    if (Math.hypot(nx - cx, ny - cy) < rr + 4) bad.push('the pause icon is on the ' + b.dataset.k + ' button');
  }
  // the ultimate bar: on each card's bottom edge (at most 14 px, pwult.py checks the size per screen), clear of the pause icon and of the other card's bar
  for (const id of ['pc0', 'pc1']) {
    const s = document.querySelector('#' + id + ' .pc-ult');
    if (!s || !s.offsetParent) { bad.push(id + ': no ultimate bar'); continue; }
    const q = s.getBoundingClientRect(), c = r('#' + id);
    if (q.top < c.bottom - 6) bad.push(id + ': the ultimate bar is not under the card');
    if (q.height > 14.5) bad.push(id + ': the ultimate bar is ' + q.height + 'px high (14 at most)');
    if (q.right > W + 1 || q.left < -6 || q.bottom > H) bad.push(id + ': the ultimate bar is off screen');
    if (hit(q, pb)) bad.push(id + ': the ultimate bar touches the pause icon');
  }
  if (hit(r('#pc0 .pc-ult'), r('#pc1 .pc-ult'))) bad.push('the two ultimate bars overlap');
  const sz = (e) => parseFloat(getComputedStyle(e).fontSize), pcts = [];
  for (const id of ['pc0', 'pc1']) {
    const card = document.getElementById(id), big = sz(card.querySelector('.pc-pct'));
    pcts.push(big);
    for (const e of card.querySelectorAll('.pc-name, .pc-tag, .pc-sub, small')) if (e.offsetParent && sz(e) >= big) bad.push(id + ': ' + e.className + ' is as big as the percent');
  }
  if (Math.min(...pcts) <= sz(document.getElementById('clock'))) bad.push('the timer is bigger than the percent');
  return bad;
})()"""
RGB = "(i) => getComputedStyle(document.querySelectorAll('.pc-pct')[i]).color"
def rgb(s): return [int(x) for x in re.findall(r'\d+', s)[:3]]

async def layout(pg, tag, errs):
    for bad in await pg.evaluate(LAYOUT): errs.append(f'{tag} layout: {bad}')

async def tints(pg, tag, errs):
    async def col(me, op):
        await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[0].percent = {me}; g.fighters[1].percent = {op}; }})()")
        await ticks(pg, 3)
        return rgb(await pg.evaluate(RGB, 0)), rgb(await pg.evaluate(RGB, 1)), await pg.evaluate("[...document.querySelectorAll('.pcard')].map((e) => e.classList.contains('finr'))")
    a, _, f = await col(40, 40)
    if min(a) < 235 or f[0]: errs.append(f'{tag} tint: 40% should be white, got {a} finr {f}')
    b, _, _ = await col(120, 120)
    if not (b[0] > 240 and b[1] > 190 and b[2] < 150): errs.append(f'{tag} tint: 120% should be yellow, got {b}')
    c, _, _ = await col(160, 160)
    if not (c[1] < b[1] - 40 and c[0] > 240): errs.append(f'{tag} tint: 160% should be on its way to red, got {c} (120%: {b})')
    d, e, f = await col(120, 180)
    if not (e[0] > 220 and e[1] < 150 and e[2] < 140): errs.append(f'{tag} tint: 180% should be red, got {e}')
    if f != [False, True]: errs.append(f'{tag} tint: finr classes at 120/180 are {f}, want [False, True]')
    if not (d[1] > 190): errs.append(f'{tag} tint: 120% (own card) should stay yellow beside a 180% card, got {d}')
    anim = await pg.evaluate("[...document.querySelectorAll('.pc-pct')].map((e) => getComputedStyle(e).animationName)")
    if anim != ['none', 'finPulse']: errs.append(f'{tag} tint: percent animations {anim}')

async def launch(pg, slot, kx, ky, freeze=True, x=0):
    # a hard hit as the simulation would leave it: hitstun + tumble + knockback; hitstop freezes it there for the picture
    await pg.evaluate(f"""(() => {{ const g = {G}, f = g.fighters[{slot}]; f.x = {x}; f.y = -70; f.grounded = false; f.plat = -1; f.state = 'hitstun'; f.hitstun = 70; f.tumble = true;
      f.move = null; f.mid = null; f.vx = 0; f.vy = 0; f.kbx = {kx}; f.kby = {ky}; {'g.hitstop = 900;' if freeze else ''} }})()""")
    await ticks(pg, 14)   # the glow eases in over a few frames

async def unfreeze(pg):
    await pg.evaluate(f"{G}.hitstop = 0")

GLOW = "(() => { const h = " + HUD + ".glow; return h.map((v) => Math.round(v * 100) / 100); })()"
EDGE = "[...document.querySelectorAll('#dgr i')].map((e) => parseFloat(getComputedStyle(e).opacity))"

async def glow(pg, vp, tag, errs):
    names = ['left', 'right', 'top', 'bottom']
    async def want(label, kx, ky, on, x=0, who=0, shot=None):
        await launch(pg, who, kx, ky, x=x)
        gl = await pg.evaluate(GLOW); ed = await pg.evaluate(EDGE)
        for i, n in enumerate(names):
            if n in on and gl[i] < 0.5: errs.append(f'{tag} glow {label}: {n} is {gl[i]}, want a clear glow')
            if n not in on and gl[i] > 0.02: errs.append(f'{tag} glow {label}: {n} is {gl[i]}, want none')
            if n in on and ed[i] < 0.25: errs.append(f'{tag} glow {label}: the {n} edge shows {ed[i]}')
        if shot: await pg.screenshot(path=f'{OUT}/{tag}_{shot}.png')
        await unfreeze(pg)
        await pg.evaluate(f"(() => {{ const f = {G}.fighters[{who}]; f.state = 'idle'; f.hitstun = 0; f.tumble = false; f.kbx = f.kby = 0; f.x = 0; f.y = 0; f.vy = 0; f.grounded = true; }})()")
        await ticks(pg, 60)
    await want('soft launch', -14, -6, [])
    await want('mid launch, back inside the stage lines', -20, -8, [])
    await want('hard launch to the left', -34, -5, ['left'], shot='5_glow_left')
    await want('hard launch to the right', 34, -5, ['right'], x=0, shot='5b_glow_right')
    await want('hard launch up', 3, -36, ['top'], shot='5c_glow_up')
    await want('the opponent is launched, not the player', 36, -6, [], who=1)
    # in between: a launch that ends well out past the stage glows a little
    await launch(pg, 0, -27, -4)
    mid = (await pg.evaluate(GLOW))[0]
    if not (0.1 < mid < 0.95): errs.append(f'{tag} glow: a launch that ends near the blast line should glow in part, got {mid}')
    # a pause switches it off
    await pg.tap('#pauseBtn'); await pg.wait_for_timeout(250)   # (the UI tick counter stands still while paused; frames keep drawing)
    await pg.wait_for_function(f"{HUD}.glow.every((v) => v < 0.02)", timeout=8000)
    await pg.tap('#pResume'); await pg.wait_for_timeout(200)
    await unfreeze(pg)
    # the KO takes it away again
    await pg.evaluate(f"(() => {{ const f = {G}.fighters[0]; f.state = 'hitstun'; f.hitstun = 70; f.tumble = true; f.kbx = -34; f.kby = -5; f.x = -600; }})()")
    await pg.wait_for_function(f"{G}.fighters[0].state === 'dead'", timeout=20000)
    try: await pg.wait_for_function(f"{HUD}.glow.every((v) => v < 0.02)", timeout=8000)
    except Exception: errs.append(f'{tag} glow: still on {await pg.evaluate(GLOW)} after the KO')
    gone = await pg.evaluate(EDGE)
    if max(gone) > 0.03: errs.append(f'{tag} glow: edges still show {gone} after the KO')

async def layout_run(b, tag, vp, up, errs):
    ctx, pg = await start(b, tag, vp, up, errs)
    await frames(pg, 20)
    await layout(pg, tag, errs)
    if await pg.evaluate(f"{HUD}.tag") < 0.99: errs.append(f'{tag} markers: not on at the start ({await pg.evaluate(HUD + ".tag")})')
    await pg.screenshot(path=f'{OUT}/{tag}_1_start.png')
    await pg.wait_for_function(f"{HUD}.tag === 0", timeout=30000)
    await pg.screenshot(path=f'{OUT}/{tag}_2_4s.png')
    await tints(pg, tag, errs)
    await layout(pg, tag + ' (with 3-digit percents)', errs)
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[0].percent = 120; g.fighters[1].percent = 180; }})()")
    await ticks(pg, 4)
    await pg.screenshot(path=f'{OUT}/{tag}_3_pct120_180.png')
    await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[0].percent = 0; g.fighters[1].percent = 0; }})()")
    await glow(pg, vp, tag, errs)
    await ctx.close()

async def flow(b, errs):
    tag, vp = 'phone', {'width': 844, 'height': 390}
    # ---- markers: respawns and sudden death ----
    ctx, pg = await start(b, tag, vp, False, errs)
    await pg.wait_for_function(f"{HUD}.tag === 0", timeout=30000)
    async def respawn_check(slot, label):
        await pg.evaluate(f"{G}.fighters[{slot}].x = 5000")   # off the arena: a self-destruct
        await pg.wait_for_function(f"{G}.fighters[{slot}].state === 'dead'", timeout=20000)
        await pg.wait_for_function(f"{G}.fighters[{slot}].state !== 'dead'", timeout=20000)
        t_resp = await pg.evaluate(f"{HUD}.tick")
        await ticks(pg, 18)
        if await pg.evaluate(f"{HUD}.tag") < 0.99: errs.append(f'{tag} markers: not back after the {label} respawned ({await pg.evaluate(HUD + ".tag")})')
        await pg.screenshot(path=f'{OUT}/{tag}_6_markers_{label}.png')   # (the sim keeps running while the picture is taken)
        await pg.wait_for_function(f"{HUD}.tag < 0.5", timeout=20000)
        shown = await pg.evaluate(f"{HUD}.tick") - t_resp
        if not 140 <= shown <= 215: errs.append(f'{tag} markers: shown for {shown} ticks after the {label} respawned, want about 180 (3 s)')
        await pg.wait_for_function(f"{HUD}.tag === 0", timeout=20000)
    await respawn_check(1, 'cpu')
    await respawn_check(0, 'player')
    # sudden death puts both fighters back: markers again
    await pg.evaluate(f"(() => {{ const g = {G}; g.timer = 2; g.fighters[0].stocks = 2; g.fighters[1].stocks = 2; }})()")
    await pg.wait_for_function(f"{G}.sudden", timeout=30000)
    await ticks(pg, 14)
    if await pg.evaluate(f"{HUD}.tag") < 0.99: errs.append(f'{tag} markers: not back in sudden death')
    # ---- the player pulses and the opponent's launch never shows ----
    await pg.wait_for_function(f"{HUD}.tag === 0", timeout=20000)
    await launch(pg, 0, -34, -5)
    vals = []
    for _ in range(12):
        vals.append((await pg.evaluate(EDGE))[0]); await ticks(pg, 5)
    if max(vals) - min(vals) < 0.05: errs.append(f'{tag} glow: no pulse in normal motion {vals}')
    await ctx.close()
    # ---- reduced motion: steady glow, no pulse ----
    ctx, pg = await start(b, tag, vp, False, errs, reduced=True)
    await launch(pg, 0, -34, -5)
    vals = []
    for _ in range(12):
        vals.append((await pg.evaluate(EDGE))[0]); await ticks(pg, 5)
    if vals[0] < 0.3 or max(vals) - min(vals) > 0.01: errs.append(f'{tag} glow: with reduced motion it should be steady and visible, got {vals}')
    await ctx.close()
    # ---- the KO finisher: a real final lethal hit on the player (a Hard CPU next to a player on the last life at 300%) ----
    # The player never moves, so a weak hit near the edge (from before the 300%, or a move with fixed knockback) can leave them
    # falling off the stage: a fall, no finisher. So the player is put back in the middle whenever both stand, and a match that
    # ends without the finisher is tried again with a new CPU (at most three tries).
    for attempt in range(3):
        ctx, pg = await start(b, tag, vp, False, errs, level='Hard')
        await pg.wait_for_function(f"{HUD}.tag === 0", timeout=30000)
        await pg.evaluate(f"(() => {{ const g = {G}; g.fighters[0].stocks = 1; g.fighters[0].percent = 300; }})()")
        seen = False
        for i in range(160):   # up to 40 s: a Hard CPU sometimes spends a while on ultis and dodges before the last hit
            if await pg.evaluate("window.__blastline.fin.on"): seen = True; break
            if await pg.evaluate(f"{G}.phase !== 'play'"): break   # the player fell without a final hit
            await pg.evaluate(f"(() => {{ const g = {G}, me = g.fighters[0], op = g.fighters[1]; if (me.state === 'idle' && op.state === 'idle' && me.y === 0) {{ me.x = 0; op.x = 50; op.y = 0; op.facing = -1; }} }})()")
            await pg.wait_for_timeout(250)
        if seen or attempt == 2: break
        await ctx.close()
    if not seen: errs.append(f'{tag} finisher: the CPU never landed the final hit in three tries (test setup)')
    else:
        for _ in range(8):
            if max(await pg.evaluate(EDGE)) > 0.001: errs.append(f'{tag} glow: edges lit during the KO finisher {await pg.evaluate(EDGE)}'); break
            await pg.wait_for_timeout(120)
    await pg.wait_for_function("window.__blastline.mode === 'result'", timeout=60000)
    await pg.wait_for_timeout(300)
    if max(await pg.evaluate(EDGE)) > 0.001: errs.append(f'{tag} glow: edges lit on the results screen {await pg.evaluate(EDGE)}')
    await ctx.close()
    # ---- the tutorial: markers stay on, and its prompt and Skip chip keep clear of the pause icon ----
    ctx, pg = await start(b, tag, vp, False, errs, tut=True)
    await pg.wait_for_timeout(500)
    await ticks(pg, 260)
    if await pg.evaluate(f"{HUD}.tag") < 0.99: errs.append(f'{tag} tutorial: the markers faded')
    bad = await pg.evaluate("""(() => { const pb = document.getElementById('pauseBtn').getBoundingClientRect(), out = [];
      for (const id of ['tut', 'tutSkip']) { const t = document.getElementById(id).getBoundingClientRect(); if (t.left < pb.right && pb.left < t.right && t.top < pb.bottom && pb.top < t.bottom) out.push(id); }
      return out; })()""")
    if bad: errs.append(f'{tag} tutorial: {bad} overlap the pause icon')
    await pg.screenshot(path=f'{OUT}/{tag}_7_tutorial.png')
    await ctx.close()

# ---- touch buttons: the touch areas from before the ink-glass look (left, top, width, height; ulti measured while shown) ----
BTN_RECTS = {
    'se': {'light': [495, 222, 80, 80], 'heavy': [413, 217, 73, 73], 'jump': [579, 150, 70, 70], 'special': [496, 143, 64, 64], 'dodge': [587, 240, 54, 54], 'ulti': [456, 97, 54, 54], 'stickZone': [0, 96, 306.8, 224], 'stickBase': [28, 158, 116, 116], 'stickKnob': [61, 191, 50, 50]},
    'mid': {'light': [568, 262, 80, 80], 'heavy': [486, 257, 73, 73], 'jump': [652, 190, 70, 70], 'special': [569, 183, 64, 64], 'dodge': [660, 280, 54, 54], 'ulti': [529, 137, 54, 54], 'stickZone': [0, 108, 340.4, 252], 'stickBase': [28, 198, 116, 116], 'stickKnob': [61, 231, 50, 50]},
    'phone': {'light': [672, 292, 80, 80], 'heavy': [590, 287, 73, 73], 'jump': [756, 220, 70, 70], 'special': [673, 213, 64, 64], 'dodge': [764, 310, 54, 54], 'ulti': [633, 167, 54, 54], 'stickZone': [0, 117, 388.2, 273], 'stickBase': [28, 228, 116, 116], 'stickKnob': [61, 261, 50, 50]},
    'desk': {'light': [1108, 662, 80, 80], 'heavy': [1026, 657, 73, 73], 'jump': [1192, 590, 70, 70], 'special': [1109, 583, 64, 64], 'dodge': [1200, 680, 54, 54], 'ulti': [1069, 537, 54, 54], 'stickZone': [0, 228, 588.8, 532], 'stickBase': [28, 598, 116, 116], 'stickKnob': [61, 631, 50, 50]},
    'up': {'light': [234.2, 755, 72, 72], 'heavy': [160.4, 750.5, 65.7, 65.7], 'jump': [309.8, 690.2, 63, 63], 'special': [235.1, 683.9, 57.6, 57.6], 'dodge': [317, 771.2, 48.6, 48.6], 'ulti': [199.1, 642.5, 48.6, 48.6], 'stickZone': [0, 544, 179.4, 300], 'stickBase': [28, 682, 116, 116], 'stickKnob': [61, 715, 50, 50]},
}
BTN_MEASURE = """(() => { const o = {}, hu = document.querySelector('.pb[data-k="ulti"]'); hu.classList.add('rdy'); hu.style.animation = 'none';
  for (const e of [...document.querySelectorAll('.pb'), ...['stickZone', 'stickBase', 'stickKnob'].map((i) => document.getElementById(i))]) {
    const q = e.getBoundingClientRect(); o[e.dataset.k || e.id] = [q.left, q.top, q.width, q.height]; }
  hu.classList.remove('rdy'); hu.style.animation = ''; return o; })()"""

async def buttons(b, errs):
    sizes = [('se', 667, 320, False, 5), ('mid', 740, 360, False, 6), ('phone', 844, 390, False, 5), ('desk', 1280, 760, False, 6), ('up', 390, 844, True, 5)]   # map buttons: 5 The Field, 6 The Kitchen
    for tag, w, h, up, mapb in sizes:
        if ONLY and tag not in ONLY and 'btn' not in ONLY: continue
        ctx, pg = await start(b, tag, {'width': w, 'height': h}, up, errs, mapb=mapb)
        await frames(pg, 10)
        got = await pg.evaluate(BTN_MEASURE)
        for k, want in BTN_RECTS[tag].items():
            if k not in got: errs.append(f'{tag} buttons: no {k}'); continue
            if max(abs(a - c) for a, c in zip(got[k], want)) > 0.6: errs.append(f'{tag} buttons: {k} touch area is {[round(v, 1) for v in got[k]]}, was {want}')
        look = await pg.evaluate("""(() => { const s = getComputedStyle(document.querySelector('.pb[data-k="light"] > span')), b = getComputedStyle(document.querySelector('.pb[data-k="light"]'));
          return [s.fontStyle, s.fontWeight, b.borderTopWidth]; })()""")
        if look != ['italic', '900', '3px']: errs.append(f'{tag} buttons: the look is {look}, want italic 900 words and a 3px rim')
        # the states: Light pressed (sinks 3px), Heavy held and charging, Special cooling (a real cooldown in the sim), ULTI ready, the stick pushed
        y0 = await pg.evaluate("document.querySelector('.pb[data-k=\"light\"]').getBoundingClientRect().top")
        await pg.evaluate(f"""(() => {{ const g = {G}, me = g.fighters[0], q = (k) => document.querySelector('.pb[data-k="' + k + '"]');
          g.hitstop = 100000; me.ult = 1e9; me.specCd = Math.round((me.spec.moves.spec.cooldown || 1) * 0.4);
          q('light').classList.add('on'); q('heavy').classList.add('on', 'chg'); q('heavy').style.setProperty('--ch', '0.62');
          document.getElementById('stickBase').classList.add('on'); document.getElementById('stickKnob').style.transform = 'translate(30px, -8px)'; }})()""")
        await ticks(pg, 30)   # the ULTI pops in once the bar is full
        y1 = await pg.evaluate("document.querySelector('.pb[data-k=\"light\"]').getBoundingClientRect().top")
        k = 0.9 if up else 1   # the pad is scaled to 90% on narrow screens
        if abs(y1 - y0 - 3 * k) > 0.6: errs.append(f'{tag} buttons: a pressed button moved {y1 - y0:.1f}px, want 3px down')
        if not await pg.evaluate("document.querySelector('.pb[data-k=\"ulti\"]').classList.contains('rdy')"): errs.append(f'{tag} buttons: the ULTI did not show')
        await pg.screenshot(path=f'{OUT}/{tag}_6_buttons.png')
        await pg.evaluate(f"""(() => {{ const g = {G}, me = g.fighters[0], q = (k) => document.querySelector('.pb[data-k="' + k + '"]');
          me.specCd = 0; g.fighters[1].percent = 300; q('light').classList.remove('on'); q('heavy').classList.remove('chg');
          q('jump').classList.add('on'); q('ulti').classList.add('on'); }})()""")
        await ticks(pg, 30)
        await pg.screenshot(path=f'{OUT}/{tag}_6b_buttons.png')
        await ctx.close()

async def main():
    errs = []
    sizes = [('se', {'width': 667, 'height': 320}, False), ('phone', {'width': 844, 'height': 390}, False), ('desk', {'width': 1280, 'height': 760}, False), ('up', {'width': 390, 'height': 844}, True)]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for tag, vp, up in sizes:
            if not ONLY or tag in ONLY: await layout_run(b, tag, vp, up, errs)
        if not ONLY or 'phone' in ONLY: await flow(b, errs)
        await buttons(b, errs)
        await b.close()
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
