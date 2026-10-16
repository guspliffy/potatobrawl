# Online Team Brawl (2v2 for up to four phones, ui/online-team.js) through a local server. The host's lobby: Mode 1 vs 1 | 2 vs 2 |
# Vs boss, the CPUs row, Host a team brawl, the board. A friend joins from the list ("Team brawl · 3 seats open · Normal CPUs"), switches
# side and back; the host's CPU level reaches the friend's board. Host plus one friend against two CPUs: the same four fighters and CPU
# names on both phones, the names on the cards, a Focus ping between the two people, a desync forced on the friend's phone repaired by the
# host's copy in pieces, Victory with the CPUs' chips line, Rematch on both (the ready line), a Defeat, Board on both. Then four friends:
# two more join from the list (Switch side, Ice is full, START glows, a fifth sees "full"), a desync forced on one phone repaired on all
# four, a friend's page closing (a CPU on every phone from the same frame, all still in step, the drop banner), a CPU partner's Focus
# applied on every phone at the same frame, the host's page closing (the next friend takes over as the lead), the results with friends
# among the foes and a Rematch of the two still here with CPUs in the empty seats. Last, the board at four sizes. Prints "on2v2 ok" and
# "no errors".
#   python3 pwon2v2.py [outdir]     (a server must listen on ON2V2_URL, default http://localhost:8099/)
import asyncio, sys, os, json
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']   # canvas 2D on the CPU rasterizer: about 2.5x faster than SwiftShader's emulated GPU (the game has no WebGL)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'on2v2'
URL = os.environ.get('ON2V2_URL', 'http://localhost:8099/')
PROF = "potatobrawl.profile.v1"
G = "window.__blastline.game"
N = "window.__blastline.net"
T = "window.__blastline.tm"
errs = []
MOB = {}

def need(ok, msg):
    if not ok: errs.append(msg)
    return ok

async def page(b, vp, prof, name, tag):
    mob = vp[0] < 1000
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, locale='en-US')
    await ctx.add_init_script("try { localStorage.setItem('%s', %s); localStorage.setItem('potatobrawl.name', %s); } catch (e) { /* about:blank */ }"
                              % (PROF, json.dumps(json.dumps(prof)), json.dumps(name)))
    pg = await ctx.new_page()
    MOB[pg] = mob
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
    await pg.goto(URL); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    return ctx, pg

async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
async def press(pg, sel): await (pg.tap if MOB[pg] else pg.click)(sel)
async def chip(pg, row, label):
    await pg.evaluate(f"[...document.querySelectorAll('#{row} .chip')].find((b) => (b.getAttribute('aria-label') || b.textContent) === {json.dumps(label)}).click()")
async def wait(pg, js, msg, timeout=30000):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: errs.append(msg); return False
async def seats(pg): return await pg.evaluate("[0, 1, 2, 3].map((s) => { const e = document.querySelector('#onSeat' + s); return (e.classList.contains('me') ? '*' : '') + e.textContent; })")
async def my_seat(pg): return await pg.evaluate("[0, 1, 2, 3].find((s) => document.querySelector('#onSeat' + s).classList.contains('me'))")
async def list_row(pg, has):
    return await pg.evaluate(f"(() => {{ const li = [...document.querySelectorAll('#onList li')].find((li) => li.textContent.includes({json.dumps(has)})); return li ? [li.textContent, li.querySelector('.chip') ? li.querySelector('.chip').disabled : null] : null; }})()")
async def join(pg, tag):
    await press(pg, '#bOnline')
    # exactly one: a host page closed a moment ago keeps its room listed for the server's 8 s grace (the board at four sizes
    # opens a new host right after closing the last one), and Join on that room never reaches a board
    if not await wait(pg, "[...document.querySelectorAll('#onList li')].filter((li) => li.textContent.includes('Team brawl')).length === 1", f"{tag}: not exactly one team brawl in the list", 20000): return None
    row = await list_row(pg, 'Team brawl')
    await pg.evaluate("[...document.querySelectorAll('#onList li')].find((li) => li.textContent.includes('Team brawl')).querySelector('.chip').click()")
    await wait(pg, f"{N}.phase === 'board'", f"{tag}: not on the board after Join ({row})", 20000)
    return row
async def state(pg):
    return await pg.evaluate(f"(() => {{ const g = {G}, t = {T}, n = {N}; return {{ f: g.fighters.map((f) => f.spec.id + ':' + f.team), hum: t.hum.map((p) => !!p), nm: t.st.nm, id: n.matchId, d: n.D, me: t.hum.indexOf(n.myPeer) }}; }})()")
async def frame(pages): return max([await pg.evaluate(f"{N}.frame") for pg in pages])
async def in_step(pages, after, what):
    """two or more checksums made after frame `after` that every phone holds, all equal"""
    common, cks = [], []
    for _ in range(60):
        await pages[0].wait_for_timeout(500)
        cks = [dict(await pg.evaluate(f"[...{N}.ckMine]")) for pg in pages]
        common = [k for k in cks[0] if k > after and all(k in c for c in cks)]
        if len(common) >= 2: break
    return need(len(common) >= 2 and all(len(set(c[k] for c in cks)) == 1 for k in common), f'{what}: the phones are not in step (frames {common}, after {after})')
async def end(pages, losers):
    """the same frame on every phone: the losing team's two fighters on their last heart, far past the blast line"""
    fr = await frame(pages) + 60
    hook = f"window.__blTestAt = {{ f: {fr}, fn: (g) => {{ for (const i of {json.dumps(losers)}) {{ g.fighters[i].stocks = 1; g.fighters[i].x = i % 2 ? -5000 : 5000; }} }} }}"
    for pg in pages: await pg.evaluate(hook)
    for pg in pages: await wait(pg, "window.__blastline.mode === 'result'", 'the match did not end', 170000)
    for pg in pages: await pg.evaluate("delete window.__blTestAt")   # the next match counts its frames from 0 again
    await pages[0].wait_for_timeout(1200)
async def desync(lead, victim, pages, what):
    await lead.evaluate("window.__blSyncPart = 700")   # test only: smaller pieces, so the copy goes in several and every piece is confirmed
    fr = await frame(pages) + 40
    await victim.evaluate(f"window.__blTestAt = {{ f: {fr}, fn: (g) => {{ g.fighters[0].percent += 33; g.fighters[2].x += 60; g.rng.s += 7; }} }}")
    before = [await pg.evaluate(f"{N}.desyncs") for pg in pages]
    for pg, n in zip(pages, before): await wait(pg, f"{N}.desyncs > {n}", f'{what}: the forced desync was not repaired on every phone', 40000)
    need(await lead.evaluate(f"{N}.syncLast || 0") >= 4, f"{what}: the copy went in {await lead.evaluate(f'{N}.syncLast || 0')} piece(s), want 4 or more at 700 characters")
    sf = await lead.evaluate(f"{N}.syncF || 0")
    await in_step(pages, sf, f'{what}, after the repair')
    await lead.evaluate("delete window.__blSyncPart")
    await victim.evaluate("delete window.__blTestAt")
    print(what, 'desyncs', [await pg.evaluate(f"{N}.desyncs") for pg in pages], 'pieces', await lead.evaluate(f"{N}.syncLast"))

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ca, A = await page(b, (844, 390), {'tut': True, 'last': 'samurai', 'tokens': 100}, 'Jonny', 'A')
        cb, B = await page(b, (1280, 760), {'tut': True, 'last': 'odin', 'tokens': 100}, 'Spud Lad', 'B')
        # ----- the host's lobby: Mode with 2 vs 2, the CPUs row instead of Lives / Time / Format, Host a team brawl, the board
        await press(A, '#bOnline'); await A.wait_for_timeout(1200)
        need(await A.evaluate("[...document.querySelectorAll('#ruleM .chip')].map((b) => b.textContent).join('|')") == '1 vs 1|2 vs 2|Vs boss', 'no Mode row with 1 vs 1, 2 vs 2 and Vs boss')
        await chip(A, 'ruleM', '2 vs 2'); await A.wait_for_timeout(200)
        need(await A.evaluate("['rowL', 'rowT', 'rowB', 'rowBo', 'rowLv'].every((id) => document.querySelector('#' + id).hidden) && !document.querySelector('#rowCpu').hidden"),
             '2 vs 2 does not swap Lives / Time / Format for the CPUs row')
        need(await A.evaluate("[...document.querySelectorAll('#ruleCpu .chip')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')).join('|')") == 'Easy|Normal*|Hard',
             f"CPUs row {await A.evaluate('[...document.querySelectorAll(\"#ruleCpu .chip\")].map((b) => b.textContent).join()')}")
        need(await txt(A, '#onHost') == 'Host a team brawl', f"host button {await txt(A, '#onHost')!r}")
        await A.screenshot(path=f'{OUT}/lobby_A.png')
        await press(A, '#onHost'); await A.wait_for_timeout(1200)
        bd = await seats(A)
        need(bd[0].startswith('*Jonny') and 'Host' in bd[0] and all(s == 'CCPU · NormalFree for a friend' for s in bd[1:]), f'host board {bd}')
        need(await txt(A, '#onHost') == 'Start' and await A.evaluate("document.querySelector('#onHost').disabled"), 'START is not there (and off) with nobody seated')
        need(await A.evaluate("document.querySelector('#rowM').hidden"), 'the Mode row stays while the board is up')
        need(await txt(A, '#onKick') == 'Your team brawl', f"host kicker {await txt(A, '#onKick')!r}")
        await A.screenshot(path=f'{OUT}/board_alone_A.png')
        # ----- a friend joins from the list, switches side and back; the host's CPU level reaches the friend
        row = await join(B, 'B')
        need(row and row[0].endswith('Team brawl · 3 seats open · Normal CPUsJoin') and row[1] is False, f'list row {row}')
        await A.wait_for_timeout(800)
        need(await my_seat(B) == 1 and (await seats(A))[1].startswith('Spud Lad'), f'the friend is not in the second Ice seat: {await seats(A)}')
        need(await txt(B, '#onHost') == 'Leave' and 'Jonny starts the brawl' in await txt(B, '#onNote'), f"friend's button/note {await txt(B, '#onHost')!r} {await txt(B, '#onNote')!r}")
        need(await txt(B, '#onTbR') == 'Normal CPUs in empty seats · 3 hearts · 4:00', f"friend's rules line {await txt(B, '#onTbR')!r}")
        need(not await list_row(B, 'Team brawl'), "the friend's list still shows the brawl they sit at")
        await B.screenshot(path=f'{OUT}/board_B.png')
        await B.click('#onSwitch')
        await wait(B, "document.querySelector('#onSeat2').classList.contains('me')", 'Switch side did not move the friend to Ember')
        await A.wait_for_timeout(600)
        need((await seats(A))[2].startswith('Spud Lad'), f'the host does not see the switch: {await seats(A)}')
        await B.click('#onSwitch')
        await wait(B, "document.querySelector('#onSeat1').classList.contains('me')", 'Switch side did not move the friend back to Ice')
        await chip(A, 'ruleCpu', 'Hard')
        await wait(B, "document.querySelector('#onTbR').textContent.startsWith('Hard CPUs')", "the host's CPU level does not reach the friend's board")
        await chip(A, 'ruleCpu', 'Normal')
        await wait(B, "document.querySelector('#onTbR').textContent.startsWith('Normal CPUs')", "the host's CPU level change back does not reach the friend")
        await A.wait_for_timeout(400)
        need('Spud Lad is in' in await txt(A, '#onNote') and not await A.evaluate("document.querySelector('#onHost').disabled"), f"host note {await txt(A, '#onNote')!r}")
        await A.screenshot(path=f'{OUT}/board_A.png')
        # ----- START: the host and the friend against two CPUs
        await press(A, '#onHost')
        for pg in (A, B): await wait(pg, "window.__blastline.mode === 'match'", 'the team brawl did not start', 40000)
        sa, sb = await state(A), await state(B)
        need(sa['f'] == sb['f'] and sa['nm'] == sb['nm'] and sa['d'] == sb['d'], f'the phones start different matches: {sa} / {sb}')
        need(sa['hum'] == [True, True, False, False] and sa['me'] == 0 and sb['me'] == 1, f'seats {sa} / {sb}')
        need([x.split(':')[1] for x in sa['f']] == ['0', '0', '1', '1'], f'teams {sa["f"]}')
        need(sa['f'][0].startswith('samurai:') and sa['f'][1].startswith('odin:'), f'fighters {sa["f"]}')
        await A.wait_for_function(f"{G}.phase === 'play'", timeout=40000)
        await A.wait_for_timeout(1000)
        tags = [await pg.evaluate("[0, 1, 2, 3].map((c) => { const e = document.querySelector('#pc' + c); const s = e.querySelector('.pc-sub'); return e.querySelector('.pc-tag').textContent + (s && !s.hidden ? '/' + s.querySelector('.nm').textContent : ''); })") for pg in (A, B)]
        need(tags[0][:2] == ['You', 'Spud Lad'] and tags[1][:2] == ['You', 'Jonny'], f'partner tags {tags}')
        need(tags[0][2:] == tags[1][2:] == [f'CPU/{sa["nm"][2]}', f'CPU/{sa["nm"][3]}'], f'CPU tags {tags} (names {sa["nm"]})')
        await A.screenshot(path=f'{OUT}/match_A.png'); await B.screenshot(path=f'{OUT}/match_B.png')
        # ----- a Focus ping between the two people: a tap on a foe's card shows on the partner's phone (no CPU to steer)
        await press(A, '#pc2')
        await wait(B, f"{T}.fpSeen === 1 && window.__blastline.duoFocus === 2", "the host's Focus ping did not reach the friend", 10000)
        await B.wait_for_timeout(200); await B.screenshot(path=f'{OUT}/ping_B.png')
        need(await A.evaluate(f"{T}.focusQ") == -1, 'a Focus tap with a person as partner was queued for a CPU')
        # ----- a desync on the friend's phone only: the host's copy repairs it
        await desync(A, B, [A, B], 'two phones')
        # ----- Victory over the CPUs: the chips line, Rematch with the ready line
        await end([A, B], [2, 3])
        for pg, t, mate in ((A, 'A', 'Spud Lad'), (B, 'B', 'Jonny')):
            need(await txt(pg, '#rTitle') == 'Victory', f"{t}: results title {await txt(pg, '#rTitle')!r}")
            need(await txt(pg, '#rMode') == f'Team brawl · with {mate}', f"{t}: results mode {await txt(pg, '#rMode')!r}")
            sub = await txt(pg, '#rSub')
            need(sub.startswith(f'You and {mate} beat CPU '), f'{t}: results line {sub!r}')
            need((await txt(pg, '#rWhy')).startswith('Against two CPUs only a win on Hard pays chips'), f"{t}: chips line {await txt(pg, '#rWhy')!r}")
            need(await txt(pg, '#rAgain') == 'Rematch' and await txt(pg, '#rChange') == 'Board', f"{t}: buttons {await txt(pg, '#rAgain')!r} {await txt(pg, '#rChange')!r}")
        await A.screenshot(path=f'{OUT}/win_A.png')
        id1 = await A.evaluate(f"{N}.matchId")
        await press(A, '#rAgain')
        await wait(A, "document.querySelector('#rAgainSub').textContent === 'waiting for Spud Lad'", f"host's rematch line {await txt(A, '#rAgainSub')!r}", 8000)
        await wait(B, "document.querySelector('#rAgainSub').textContent === 'Jonny ready'", f"friend's rematch line {await txt(B, '#rAgainSub')!r}", 8000)
        await B.screenshot(path=f'{OUT}/rematch_B.png')
        await B.click('#rAgain')
        for pg in (A, B): await wait(pg, f"window.__blastline.mode === 'match' && {N}.matchId === {id1 + 1}", 'the rematch did not start on both', 30000)
        s2a, s2b = await state(A), await state(B)
        need(s2a['f'] == s2b['f'] and s2a['hum'] == [True, True, False, False], f'rematch {s2a} / {s2b}')
        # ----- a Defeat, then Board on both
        await A.wait_for_function(f"{G}.phase === 'play'", timeout=40000)
        await end([A, B], [0, 1])
        for pg, t in ((A, 'A'), (B, 'B')):
            need(await txt(pg, '#rTitle') == 'Defeat', f"{t}: results title {await txt(pg, '#rTitle')!r}")
            need(' beat you and ' in await txt(pg, '#rSub'), f"{t}: results line {await txt(pg, '#rSub')!r}")
        await press(A, '#rChange')
        await wait(A, f"window.__blastline.mode === 'online' && {N}.phase === 'hosting'", 'Board does not take the host back to the board')
        await wait(B, "document.querySelector('#rAgainSub').textContent === 'Jonny went back to the board' && document.querySelector('#rAgain').disabled", f"friend's line after the host went back {await txt(B, '#rAgainSub')!r}", 8000)
        await B.click('#rChange')
        await wait(B, f"window.__blastline.mode === 'online' && {N}.phase === 'board'", 'Board does not take the friend back to the board')
        await A.wait_for_timeout(800)
        need((await seats(A))[0].startswith('*Jonny') and (await seats(A))[1].startswith('Spud Lad') and await my_seat(B) == 1, f'the board after the match {await seats(A)}')
        # ----- four friends: two more join from the list, Switch side, Ice is full, START glows, a fifth sees "full"
        cc, C = await page(b, (667, 320), {'tut': True, 'last': 'reaper', 'tokens': 100}, 'Mash', 'C')
        cd, D = await page(b, (844, 390), {'tut': True, 'last': 'wizard', 'tokens': 100}, 'Tot', 'D')
        row = await join(C, 'C')
        need(row and 'Team brawl · 2 seats open · Normal CPUs' in row[0], f'list row for the third {row}')
        need(await my_seat(C) == 2, f'the third friend is not in the first Ember seat: {await seats(C)}')
        need(await C.evaluate("document.querySelector('#onSwitch').disabled") and await txt(C, '#onTbNote') == 'Ice is full.', f"C's Switch side / note {await txt(C, '#onTbNote')!r}")
        await C.screenshot(path=f'{OUT}/board_C_667.png')
        await B.click('#onSwitch')
        await wait(B, "document.querySelector('#onSeat3').classList.contains('me')", 'Switch side did not move the second friend to Ember')
        await A.wait_for_timeout(600)
        row = await join(D, 'D')
        need(row and 'Team brawl · 1 seat open · Normal CPUs' in row[0], f'list row for the fourth {row}')
        need(await my_seat(D) == 1, f'the fourth friend is not in the free Ice seat: {await seats(D)}')
        await wait(A, "document.querySelector('#onHost').classList.contains('full')", 'START does not glow with four people')
        need(await txt(A, '#onNote') == "Everyone's in. Start when you're ready.", f"host note with four {await txt(A, '#onNote')!r}")
        await A.screenshot(path=f'{OUT}/board_full_A.png'); await D.screenshot(path=f'{OUT}/board_full_D.png')
        ce, E = await page(b, (844, 390), {'tut': True}, 'Late', 'E')
        await press(E, '#bOnline')
        await wait(E, "[...document.querySelectorAll('#onList li')].some((li) => li.textContent.includes('Team brawl · full'))", 'a fifth phone does not see the brawl as full', 15000)
        row = await list_row(E, 'Team brawl')
        need(row and row[1] is True, f'the full brawl can still be joined: {row}')
        await ce.close()
        ALL = [A, D, C, B]   # by seat
        await press(A, '#onHost')
        for pg in ALL: await wait(pg, "window.__blastline.mode === 'match'", 'the four-phone brawl did not start everywhere', 40000)
        st4 = [await state(pg) for pg in ALL]
        need(all(s['f'] == st4[0]['f'] for s in st4) and [s['me'] for s in st4] == [0, 1, 2, 3] and st4[0]['hum'] == [True] * 4, f'four phones {st4}')
        await A.wait_for_function(f"{G}.phase === 'play'", timeout=40000)
        await A.wait_for_timeout(800)
        await C.screenshot(path=f'{OUT}/match4_C_667.png')
        await desync(A, C, ALL, 'four phones')
        dn = [await pg.evaluate(f"{N}.desyncs") for pg in (D, B)]   # from here on the drops must keep the phones in step without a repair
        # ----- a friend's page closes: a CPU from the same frame on every phone, all still in step
        await C.goto('about:blank'); await cc.close()
        for pg in (A, D, B): await wait(pg, f"{T}.cpuFrom[2] !== undefined", 'no CPU took over the seat of the friend who left', 30000)
        cf = [await pg.evaluate(f"{T}.cpuFrom[2]") for pg in (A, D, B)]
        need(len(set(cf)) == 1, f'the phones hand the seat over at different frames: {cf}')
        need('dropped' in (await txt(A, '#banner')).lower() or 'dropped' in (await txt(B, '#banner')).lower(), f"drop banner {await txt(A, '#banner')!r}")
        await B.screenshot(path=f'{OUT}/dropped_B.png')
        need(await B.evaluate("document.querySelector('#pc1 .pc-tag').textContent") == 'CPU' and await B.evaluate("document.querySelector('#pc1 .pc-sub .nm').textContent") == 'Mash',
             f"the dropped friend's card on the partner's phone: {await B.evaluate('document.querySelector(\"#pc1\").textContent')!r}")
        await in_step([A, D, B], cf[0], 'after the drop')
        # ----- the partner of the friend who left steers the CPU: the Focus lands on every phone at the same frame
        await B.click('#pc2')   # B is seat 3: card 2 is the first foe, seat 0
        for pg in (A, D, B): await wait(pg, f"{T}.bots[2] && {T}.bots[2].focus === 0 && {T}.bots[2].focusT > {G}.t", "the CPU partner's Focus did not land on every phone", 15000)
        ft = [await pg.evaluate(f"{T}.bots[2].focusT") for pg in (A, D, B)]
        need(len(set(ft)) == 1, f'the Focus landed at different frames: {ft}')
        # ----- the host's page closes: the next friend leads, hands the host's seat to a CPU, and both phones stay in step
        await A.goto('about:blank'); await ca.close()
        for pg in (D, B): await wait(pg, f"{T}.cpuFrom[0] !== undefined", 'no CPU took over the host\'s seat', 30000)
        cf0 = [await pg.evaluate(f"{T}.cpuFrom[0]") for pg in (D, B)]
        need(len(set(cf0)) == 1, f'the host\'s seat went to a CPU at different frames: {cf0}')
        need(await D.evaluate(f"{T}.cl.length") >= 1 and await D.evaluate(f"{T}.cl.some((c) => c[0] === 0)"), 'the claim did not come from the next friend (seat 1)')
        await in_step([D, B], cf0[0], 'after the host left')
        # ----- the end with friends among the foes; a Rematch of the two still here, CPUs in the other seats
        need([await pg.evaluate(f"{N}.desyncs") for pg in (D, B)] == dn, f'the drops needed a repair: desyncs {dn} -> {[await pg.evaluate(f"{N}.desyncs") for pg in (D, B)]}')
        await end([D, B], [0, 1])
        need(await txt(B, '#rTitle') == 'Victory' and await txt(D, '#rTitle') == 'Defeat', f"titles {await txt(B, '#rTitle')!r} {await txt(D, '#rTitle')!r}")
        need((await txt(B, '#rWhy')).startswith('Win against a friend +15'), f"winner's chips line {await txt(B, '#rWhy')!r}")
        need((await txt(D, '#rWhy')).startswith('Match played +5'), f"loser's chips line {await txt(D, '#rWhy')!r}")
        need('(CPU)' in await txt(B, '#rSub'), f"results line does not mark the dropped friends: {await txt(B, '#rSub')!r}")
        need(await txt(B, '#rMode') == 'Team brawl · with Mash (CPU)', f"results mode with a dropped partner {await txt(B, '#rMode')!r}")
        need('Jonny and Mash left · CPUs take the seats' in await txt(B, '#rAgainSub'), f"rematch line {await txt(B, '#rAgainSub')!r}")
        await B.screenshot(path=f'{OUT}/result4_B.png')
        idn = await B.evaluate(f"{N}.matchId")
        await B.click('#rAgain'); await press(D, '#rAgain')
        for pg in (D, B): await wait(pg, f"window.__blastline.mode === 'match' && {N}.matchId === {idn + 1}", 'the rematch of the two still here did not start', 30000)
        sd, sb2 = await state(D), await state(B)
        need(sd['hum'] == [False, True, False, True] and sd['f'] == sb2['f'] and sd['nm'] == sb2['nm'] and sd['nm'][0] and sd['nm'][2], f'rematch of two {sd} / {sb2}')
        await D.wait_for_function(f"{G}.phase === 'play'", timeout=40000)
        await in_step([D, B], 0, 'the rematch of two')
        await cd.close(); await cb.close()
        # ----- the board at four sizes: the host with one friend; nothing runs off the screen, START / Leave stay on it
        for (w, h, up) in ((667, 320, False), (844, 390, False), (1280, 760, False), (390, 844, True)):
            prof = {'tut': True, 'last': 'gunslinger', 'onTeam': {'on': True, 'lv': 2}}
            if up: prof['screen'] = 'up'
            c1, H = await page(b, (w, h), prof, 'Jonny', f'host{w}')
            c2, F = await page(b, (w, h), dict(prof, last='alchemist'), 'Spud Lad', f'friend{w}')
            await press(H, '#bOnline'); await H.wait_for_timeout(1000)
            need(await H.evaluate("[...document.querySelectorAll('#ruleCpu .chip.on')].map((b) => b.textContent).join()") == 'Hard', f'{w}x{h}: the saved CPU level is not picked')
            await press(H, '#onHost'); await H.wait_for_timeout(800)
            await join(F, f'friend{w}')
            await H.wait_for_timeout(800)
            for pg, who in ((H, 'host'), (F, 'friend')):
                bad = await pg.evaluate("""(() => { const vw = innerWidth, bad = []; for (const e of document.querySelectorAll('#scrOnline .chip, #onHost, .on-seat')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) bad.push(e.id || e.textContent); } return bad; })()""")
                need(not bad, f'board {w}x{h} ({who}): runs off the screen: {bad}')
                hb = await pg.evaluate("(() => { const r = document.querySelector('#onHost').getBoundingClientRect(), s = document.querySelector('#onSeat3').getBoundingClientRect(); return { b: r.bottom, s: s.bottom, sh: s.height, vh: innerHeight }; })()")
                need(hb['b'] <= hb['vh'] + 0.5 and hb['s'] <= hb['vh'] + 0.5, f"board {w}x{h} ({who}): Start/Leave ends at {hb['b']:.0f}, the last seat at {hb['s']:.0f} (screen {hb['vh']})")
                need(hb['sh'] >= 28, f"board {w}x{h} ({who}): seats only {hb['sh']:.0f} px tall")
                await pg.screenshot(path=f'{OUT}/board_{who}_{w}x{h}.png')
            await c1.close(); await c2.close()
        await b.close()
    print('on2v2 ok' if not errs else 'on2v2 FAILED')
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
