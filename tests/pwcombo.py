# Combos in the browser (ui/combos.js): the route cards in How to play (switching fighter), the Combo trial (a scripted player lands
# routes on the standing CPU: keys light up, "Cleared!", the route is saved, the trial moves on; three misses show the hint;
# Next and Exit), and clearing all 13 routes pays the Combo Potato title and 30 chips once. Screenshots at four sizes.
#   python3 pwcombo.py [outdir [tag ...]]   tags: flow (844x390 with touch, the checks above) s667 d1280 up390 (shots only)
# The player is scripted through window.__blInput (tests only), the same driver tests/combos.js uses in node.
import asyncio, sys, json, pathlib
TEST_URL = (pathlib.Path(__file__).resolve().parent.parent / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'combo'
ONLY = sys.argv[2:]
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SIZES = {'flow': (844, 390, False), 's667': (667, 320, False), 'd1280': (1280, 760, False), 'up390': (390, 844, True)}
PROF = "potatobrawl.profile.v1"
START = {'tokens': 50, 'tut': True, 'last': 'samurai'}

# the scripted player: presses the current trial route's next key when it is in reach, holds a charged heavy, jumps where the route jumps
DRIVER = r"""(() => {
  const D = { start: -1, prev: -1, rid: null, k: -1, held: 0, lp: -99 };
  const LIGHT = new Set(["jab", "side", "up", "down", "nair", "sair", "uair", "dair"]);
  window.__drvWrong = 0;   // 1: land only each try's first hit, so every try is a miss
  window.__blInput = (G) => {
    const tr = window.__blastline.trial, a = G.fighters[0], d = G.fighters[1], inp = {};
    if (!tr || tr.hold > 0 || G.phase !== "play" || d.state === "dead" || d.state === "respawn") return inp;
    if (tr.id !== D.rid || tr.k !== D.k) { D.rid = tr.id; D.k = tr.k; D.start = -1; D.held = 0; D.prev = a.moveT; }   // the move that just hit is not the next one
    const toward = Math.sign(d.x - a.x) || 1;
    if (window.__drvWrong > 0 && tr.k >= 1) return inp;   // drop the combo after its first hit: one miss each time
    // which key is next: the (k+1)-th hit, or the jump in front of it once a hit has landed
    let h = 0, idx = -1;
    for (let i = 0; i < tr.keys.length; i++) {
      if (tr.keys[i] === "jump") { if (h === tr.k && tr.k > 0 && a.grounded) { idx = i; break; } continue; }
      if (h === tr.k) { idx = i; break; }
      h++;
    }
    if (idx < 0) return inp;
    const k = tr.keys[idx], key = k.replace("!", "") === "air" ? "nair" : k.replace("!", "");   // "air": any light air attack, the driver uses the neutral one
    const dx = Math.abs(d.x - a.x);
    if (key === "jump") { if (G.t % 2 === 0) inp.jump = true; if (dx > 44) inp.x = toward; return inp; }
    if (!a.grounded && (key === "nair" || key === "hAir") && a.state !== "attack" && dx > 44) { inp.x = toward; return inp; }   // drift in, then the aerial with no direction
    const btn = key === "spec" ? "special" : key[0] === "h" ? "heavy" : "light";
    const base = key[0] === "h" ? key[1].toLowerCase() + key.slice(2) : key;
    const dir = base === "side" ? "side" : base === "up" || base === "uair" ? "up" : base === "down" ? "down" : "n";
    const mk = key === "hUp" && !a.grounded ? "rec" : key;
    if (a.state === "attack" && a.mid === mk && a.moveT !== D.prev && D.start === -1) D.start = a.moveT;
    if (D.start >= 0 && a.moveT === D.start && a.state === "attack") {   // started: only a charged heavy keeps holding
      if (k.endsWith("!") && D.held < 14) { inp.heavy = true; D.held++; }
      inp.y = dir === "up" ? -1 : dir === "down" ? 1 : 0; if (dir === "side") inp.x = toward;
      return inp;
    }
    if (D.start >= 0) { D.prev = D.start; D.start = -1; }   // that one whiffed (it ended, or another move came out): go again
    const m = a.spec.moves[mk], reach = m && m.boxes.length ? Math.max(...m.boxes.map((b) => Math.max(b.x + b.r, b.x2 + b.r))) + d.s.w / 2 - 6 : 160;
    const far = Math.abs(d.x - a.x) - Math.abs(a.vx) * 5 + (tr.k > 0 ? 16 : 0) > reach;   // after the first hit, step in a bit closer
    // step in (or turn around, after a dash carried us past them), as a player would, unless the link is open
    if ((far || a.facing !== toward) && a.grounded && !(a.link > 0)) { if (BL.canAct(a)) inp.x = toward; return inp; }
    if (G.t - D.lp >= 4) { inp[btn] = true; D.lp = G.t; }   // press at once, then again every 4 ticks until it comes out
    inp.y = dir === "up" ? -1 : dir === "down" ? 1 : 0; if (dir === "side") inp.x = toward;
    return inp;
  };
})()"""

async def new_page(b, tag, vp, up, errs, prof=None):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
    p = dict(prof or START)
    if up: p['screen'] = 'up'
    await ctx.add_init_script("if (localStorage.getItem('%s') === null) localStorage.setItem('%s', %s);" % (PROF, PROF, json.dumps(json.dumps(p))))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(TEST_URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    return ctx, pg, mob

def prof(pg): return pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)

async def trial(pg):
    return await pg.evaluate("window.__blastline.trial")

async def run(b, tag, errs):
    vp = SIZES[tag]
    ctx, pg, mob = await new_page(b, tag, (vp[0], vp[1]), vp[2], errs)
    clk = pg.tap if mob else pg.click
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
    # How to play: six route cards for the fighter played last, then another fighter's
    await clk('#bHelp'); await pg.wait_for_timeout(400)
    n = await pg.eval_on_selector_all('#helpCombos .rc', 'e => e.length')
    need(n == 6, f'{n} route cards, want 6')
    names = await pg.eval_on_selector_all('#helpCombos .rc-n', 'e => e.map((x) => x.firstChild.textContent)')
    need('Blink Cut' in names, f'Samurai cards: {names}')
    await pg.evaluate("document.querySelector('#helpCombos').scrollIntoView({block: 'start'})"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'{OUT}/{tag}_help.png')
    await clk('#helpCombos .rc-figs .chip[data-f="reaper"]'); await pg.wait_for_timeout(250)
    names = await pg.eval_on_selector_all('#helpCombos .rc-n', 'e => e.map((x) => x.firstChild.textContent)')
    need(names[:1] == ['Reap'], f'Reaper cards: {names}')
    if tag != 'flow':
        await clk('#helpCombos .rc-figs .chip[data-f="samurai"]'); await pg.wait_for_timeout(250)
    # the trial
    await clk('#hTrial')
    await pg.wait_for_function("window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=30000)
    t = await trial(pg)
    need(t and t['id'] == ('reap' if tag == 'flow' else 'blink'), f'trial starts on {t}')
    need(await pg.is_visible('#tut') and await pg.is_visible('#tutNext'), 'trial panel or Next missing')
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=f'{OUT}/{tag}_trial_start.png')
    if tag != 'flow':
        await ctx.close(); return
    await pg.evaluate(DRIVER)
    # land the first two routes; check the lit keys mid-route, then "Cleared!" and that it is saved
    seen = []
    for want in range(2):
        t0 = await trial(pg)
        lit_ok = False
        for _ in range(240):
            await pg.wait_for_timeout(50)
            t = await trial(pg)
            if t['k'] > 0 and t['hold'] == 0 and not lit_ok:
                lit = await pg.eval_on_selector_all('#tutH .rk.on', 'e => e.length')
                lit_ok = lit >= 1
                if want == 0: await pg.screenshot(path=f'{OUT}/{tag}_trial_mid.png')
            if t['hold'] > 0: break
        need(t['hold'] > 0, f'route {t0["id"]} not cleared (state {t})')
        txt = await pg.text_content('#tutT')
        need('Cleared' in (txt or ''), f'title after clearing: {txt}')
        need(lit_ok, f'no lit keys during {t0["id"]}')
        if want == 0: await pg.screenshot(path=f'{OUT}/{tag}_trial_cleared.png')
        p = await prof(pg)
        need(t0['id'] in (p.get('routes') or []), f'{t0["id"]} not saved: {p.get("routes")}')
        seen.append(t0['id'])
        await pg.wait_for_function(f"window.__blastline.trial && window.__blastline.trial.id !== '{t0['id']}' && window.__blastline.trial.hold === 0", timeout=10000)
    # three misses show the hint
    await pg.evaluate("window.__drvWrong = 1")
    await pg.wait_for_function("window.__blastline.trial.miss >= 3", timeout=60000)
    await pg.wait_for_timeout(200)
    need(await pg.is_visible('#tut .tut-hint'), 'no hint after three misses')
    await pg.screenshot(path=f'{OUT}/{tag}_trial_hint.png')
    await pg.evaluate("window.__drvWrong = 0")
    # Next skips to the following route
    t = await trial(pg)
    await clk('#tutNext'); await pg.wait_for_timeout(200)
    t2 = await trial(pg)
    need(t2['i'] != t['i'] and t2['miss'] == 0, f'Next: {t} -> {t2}')
    # Exit goes to the menu
    await clk('#tutSkip'); await pg.wait_for_timeout(300)
    need(await pg.evaluate("window.__blastline.mode") == 'menu', 'Exit did not go to the menu')
    # How to play now marks the cleared routes
    await clk('#bHelp'); await pg.wait_for_timeout(300)
    ok = await pg.eval_on_selector_all('#helpCombos .rc.ok', 'e => e.length')
    need(ok == 2, f'{ok} cleared cards, want 2 ({seen})')
    count = await pg.text_content('#helpCombos .rc-count')
    need(count.startswith('2 of 13'), f'count line: {count}')
    await ctx.close()
    # clearing the last route pays the title and the chips once
    allr = ["three", "lift", "trip", "rising", "sig", "skyburn", "lab", "hammer", "staff", "blink", "tail", "whip"]
    ctx, pg, mob = await new_page(b, tag + '-all', (vp[0], vp[1]), False, errs, dict(START, routes=allr, last='reaper', tokens=10))
    clk = pg.tap
    await clk('#bHelp'); await pg.wait_for_timeout(300); await clk('#hTrial')
    await pg.wait_for_function("window.__blastline.game && window.__blastline.game.phase === 'play'", timeout=30000)
    t = await trial(pg)
    need(t['id'] == 'reap', f'the trial should start on the one route left: {t}')
    await pg.evaluate(DRIVER)
    await pg.wait_for_function("window.__blastline.trial.hold > 0", timeout=30000)
    await pg.wait_for_timeout(400)
    p = await prof(pg)
    need(p.get('tokens') == 40 and p.get('comboPaid') is True and len(p.get('routes')) == 13, f'reward: tokens {p.get("tokens")} paid {p.get("comboPaid")} routes {len(p.get("routes") or [])}')
    await pg.screenshot(path=f'{OUT}/{tag}_all13.png')
    # a second clear pays nothing more
    await pg.wait_for_function("window.__blastline.trial.hold === 0", timeout=10000)
    await pg.evaluate("document.querySelector('#tutNext').click()")
    await pg.wait_for_timeout(200)
    for _ in range(5):
        if (await trial(pg))['id'] == 'reap': break
        await pg.evaluate("document.querySelector('#tutNext').click()"); await pg.wait_for_timeout(100)
    await pg.wait_for_function("window.__blastline.trial.hold > 0", timeout=30000)
    p = await prof(pg)
    need(p.get('tokens') == 40, f'paid twice: tokens {p.get("tokens")}')
    await ctx.close()

async def main():
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    errs = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS)
        for tag in (ONLY or list(SIZES)):
            await run(b, tag, errs)
            print(tag, 'done')
        await b.close()
    for e in errs: print('ERROR', e)
    if not errs: print('no errors')

asyncio.run(main())
