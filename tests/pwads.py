# Rewarded ads (ui/ads.js) and the Harvest's "×2 · watch an ad" button (ui/harvest.js), at 844x390.
# Without a fake the button is the disabled SOON one (pwdaily.py expects exactly that). With window.__blAdFake set before the page loads:
#   "view"  the ad is ready, a tap plays it, today's gift is claimed twice over (once), the button says Doubled and keeps saying it after a reload
#   "skip"  a tap plays it and nothing is paid; the button can be tried again, and a plain Claim still works
#   "none"  "No ad right now" (disabled); a plain Claim still works
# Unit checks go through window.__blAds (on / prime / state / show / day / mark): the states, one break at a time, a replaced prime, a prime while
# an ad shows, onReward once, onEnd always, adsDay / adsMark with a new day and with a storage that throws.
# The last part loads a copy of the page with ADS_CLIENT set and a stand-in for Google's adsbygoogle.js (the real adapter, no network): the tag
# (async, crossorigin, frequency hint), adConfig, the rewarded break, sound muted between beforeAd and afterAd, a viewed / dismissed / notReady /
# blocked / silent answer.
#   python3 tests/pwads.py [outdir]      (run it from a scratch folder; prints "ads ok" at the end)
import asyncio, sys, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEST_URL = (ROOT / 'build' / 'test.html').as_uri()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'ads'
from playwright.async_api import async_playwright
ARGS = ['--disable-gpu']
VP = (844, 390)
PROF = "potatobrawl.profile.v1"
ADSKEY = "potatobrawl.ads.v1"
TZ = 'Europe/Berlin'
def at(day, hm='10:00'): return f'2026-10-{day:02d}T{hm}:00+02:00'   # the 12th is a Monday
START = {'tokens': 85, 'rating': 1210, 'peak': 1210, 'wins': 3, 'losses': 2, 'matches': 5, 'tut': True,
         'history': [{'r': 1, 'd': 12, 'me': 'odin', 'op': 'wizard', 'opr': 1200, 't': 5}]}
# the page's clock: localStorage 'pwdaily.at' is "now" at load; window.__pwNow(iso) moves it while the page is open (as pwdaily.py does)
CLOCK = """(() => {
  const RD = Date; let off = 0;
  const set = (iso) => { off = iso ? RD.parse(iso) - RD.now() : 0; };
  try { set(localStorage.getItem('pwdaily.at')); } catch (e) {}
  class D extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
  window.Date = D; window.__pwNow = set;
})();"""
# a reload carries the page's storage over in window.name (Playwright's in-memory profiles commit localStorage lazily)
KEEP = "try { if (window.name.indexOf('pwkeep:') === 0) { const s = JSON.parse(window.name.slice(7)); window.name = ''; for (const k in s) localStorage.setItem(k, s[k]); } } catch (e) {}\n"
FIT = """(() => {
  const bad = [], g = document.querySelector('#hvGift').getBoundingClientRect();
  for (const e of document.querySelectorAll('#hvGift .btn')) { const q = e.getBoundingClientRect(); if (q.right > g.right + 0.5 || q.left < g.left - 0.5 || q.bottom > g.bottom + 0.5) bad.push('the gift panel: ' + e.id + ' sticks out'); }
  for (const e of document.querySelectorAll('#hvGift .btn > span, #hvGift .btn > small')) {
    const q = e.getBoundingClientRect(), r = e.parentNode.getBoundingClientRect();
    if (q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5) bad.push('the words "' + e.textContent + '" run out of their button');
  }
  const sh = document.querySelector('#scrDaily .sheet');
  if (sh.scrollHeight > sh.clientHeight + 1) bad.push('the Daily sheet has to scroll (' + sh.scrollHeight + ' > ' + sh.clientHeight + ')');
  return bad;
})()"""
# a stand-in for Google's adsbygoogle.js: runs what was pushed before it loaded, then every push; window.__stub = { mode, watch, log, vols }
STUB = """(() => {
  const q = window.adsbygoogle = window.adsbygoogle || [], S = window.__stub = window.__stub || {};
  S.log = []; S.vols = [];
  const gain = () => { const g = (window.__gains || [])[0]; return g ? g.gain.value : null; };
  function handle(o) {
    if (o.type !== 'reward') { S.log.push('config ' + Object.keys(o).sort().join(',') + ' ' + JSON.stringify(o)); return; }
    S.log.push('break ' + o.name);
    const m = S.mode || 'ready';
    setTimeout(() => {
      if (m === 'silent') return;
      if (m === 'notReady') { o.adBreakDone({ breakStatus: 'notReady' }); return; }
      o.beforeReward(() => {
        S.log.push('show');
        o.beforeAd(); S.vols.push(gain());
        setTimeout(() => {
          if (S.watch) o.adViewed(); else o.adDismissed();
          o.afterAd(); S.vols.push(gain());
          o.adBreakDone({ breakStatus: S.watch ? 'viewed' : 'dismissed' });
        }, 200);
      });
    }, 30);
  }
  const pending = q.slice(); q.length = 0; q.push = (o) => { handle(o); return 0; }; pending.forEach(handle);
})();"""
# every GainNode the page creates (the first one is the game's master volume)
GAINS = "window.__gains = []; try { const f = AudioContext.prototype.createGain; AudioContext.prototype.createGain = function () { const g = f.call(this); window.__gains.push(g); return g; }; } catch (e) {}"

async def reload(pg):
    await pg.evaluate("window.name = 'pwkeep:' + JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))")
    await pg.reload()

async def new_page(b, errs, tag, fake='', when=at(14), url=TEST_URL, extra='', quiet=False):
    ctx = await b.new_context(viewport={'width': VP[0], 'height': VP[1]}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id=TZ, locale='en-US')
    await ctx.add_init_script(KEEP + "if (localStorage.getItem('%s') === null) { localStorage.setItem('%s', %s); localStorage.setItem('pwdaily.at', %s); }"
                              % (PROF, PROF, json.dumps(json.dumps(START)), json.dumps(when)))
    await ctx.add_init_script(CLOCK)
    await ctx.add_init_script(GAINS)
    if fake: await ctx.add_init_script(f"window.__blAdFake = {json.dumps(fake)};")
    if extra: await ctx.add_init_script(extra)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
    pg.on('console', lambda m: errs.append(f'{tag} console: {m.text}') if m.type == 'error' and not quiet else None)
    await pg.goto(url); await pg.evaluate("window.__blastline.perf.lockQ = true"); await pg.wait_for_timeout(700)
    await pg.wait_for_function("window.__blastline && window.__blastline.mode === 'menu'", timeout=20000)
    return ctx, pg

prof = lambda pg: pg.evaluate("JSON.parse(localStorage.getItem('%s'))" % PROF)
async def txt(pg, sel): return ' '.join((await pg.text_content(sel) or '').split())
async def btn(pg): return ' '.join(await pg.evaluate("[...document.querySelector('#hvAd').children].map((c) => c.textContent.trim())"))   # its words, one line
async def shown(pg, sel): return await pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; }})()")
async def disabled(pg, sel): return await pg.evaluate(f"document.querySelector('{sel}').disabled")
async def state(pg, kind='harvest'): return await pg.evaluate(f"window.__blAds.state('{kind}')")
async def sheet(pg):
    await pg.tap('#mStreak'); await pg.wait_for_timeout(400)
async def reload_sheet(pg, when=None):
    if when: await pg.evaluate("localStorage.setItem('pwdaily.at', %s)" % json.dumps(when))
    await reload(pg); await pg.wait_for_timeout(900)
    await pg.wait_for_function("window.__blastline && window.__blastline.mode === 'menu'", timeout=20000)
async def shot(pg, errs, tag, name):
    await pg.screenshot(path=f'{OUT}/ads_{tag}_{name}.png')
    bad = await pg.evaluate(FIT)
    if bad: errs.append(f'{tag} {name}: ' + '; '.join(bad[:4]))
async def ready(pg, kind='harvest'): await pg.wait_for_function(f"window.__blAds.state('{kind}') === 'ready'", timeout=4000)

async def off(b, errs):
    tag = 'off'
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
    ctx, pg = await new_page(b, errs, tag)
    need(not await pg.evaluate("window.__blAds.on()"), 'adsOn() is true without a switch or a fake')
    need(await pg.evaluate("document.querySelectorAll('script[src*=adsbygoogle]').length") == 0, 'a script was loaded')
    await sheet(pg)
    need(await shown(pg, '#hvAd') and await disabled(pg, '#hvAd') and 'Soon' in await btn(pg) and '15 → 30' in await btn(pg), f"x2 button: {await btn(pg)!r}")
    need(await pg.get_attribute('#hvAd', 'aria-label') == 'Double it by watching an ad: coming soon', 'the aria text changed')
    need(await state(pg) == 'off', 'adsState is not off')
    need('Ads come later and are never needed' in await txt(pg, '#hvGift'), f"note: {await txt(pg, '#hvGift')!r}")
    await pg.evaluate("document.querySelector('#hvAd').click()"); await pg.wait_for_timeout(200)
    need((await prof(pg))['tokens'] == 85, 'the x2 button gave something')
    await shot(pg, errs, tag, '1_sheet')
    # the unit API answers "no" at once
    r = await pg.evaluate("new Promise((res) => { const out = []; const a = window.__blAds; a.prime('pommes', (ok) => { out.push(ok); res([out, a.state('pommes'), a.show('pommes', () => {}, () => {})]); }); })")
    need(r == [[False], 'off', False], f'prime with ads off: {r}')
    await ctx.close()

async def view(b, errs):
    tag = 'view'
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
    ctx, pg = await new_page(b, errs, tag, 'view')
    A = "window.__blAds"
    need(await pg.evaluate(f"{A}.on()"), 'adsOn() is false with the fake')
    need(await pg.evaluate("document.querySelectorAll('script[src*=adsbygoogle]').length") == 0, 'the fake loaded a script')
    # ----- the unit API (in the menu, before the Daily sheet asks for an ad)
    need(await state(pg, 'pommes') == 'off' and await state(pg) == 'off', 'states do not start off')
    r = await pg.evaluate("""new Promise((res) => {
      const a = window.__blAds, log = [];
      a.prime('pommes', (ok) => log.push('pommes ' + ok));
      log.push('sync ' + a.state('pommes') + ' ' + a.state('harvest'));
      setTimeout(() => {
        log.push('t100 ' + a.state('pommes') + ' ' + a.state('harvest'));
        a.prime('chips', (ok) => log.push('chips ' + ok));   // replaces the ready one
        log.push('replaced ' + a.state('pommes') + ' ' + a.state('chips'));
        a.prime('harvest', (ok) => log.push('harvest ' + ok));   // replaces the waiting chips: its cb answers false
        setTimeout(() => {
          log.push('t200 ' + a.state('chips') + ' ' + a.state('harvest') + ' wrong-kind-show ' + a.show('chips', () => {}, () => {}));
          let rew = 0, end = [];
          log.push('show ' + a.show('harvest', () => rew++, (w) => end.push(w)));
          log.push('busy ' + a.state('harvest') + ' show2 ' + a.show('harvest', () => rew++, () => {}));
          a.prime('pommes', (ok) => log.push('pommes-while-busy ' + ok));
          setTimeout(() => {
            log.push('t800 ' + a.state('harvest') + ' ' + a.state('pommes') + ' rew ' + rew + ' end ' + JSON.stringify(end) + ' show-after ' + a.show('harvest', () => {}, () => {}));
            res(log);
          }, 500);
        }, 150);
      }, 100);
    })""")
    want = ['sync wait off', 'pommes true', 't100 ready off', 'replaced off wait', 'chips false', 'harvest true', 't200 off ready wrong-kind-show false', 'show true',
            'busy busy show2 false', 'pommes-while-busy false', 't800 off off rew 1 end [true] show-after false']
    # the order of the log lines: cbs come from timers, so "pommes true" lands after "sync", and the replaced cb after the sync lines
    need(sorted(r) == sorted(want), f'unit log: {r}')
    need(r.index('sync wait off') < r.index('pommes true') < r.index('t100 ready off') < r.index('chips false') < r.index('harvest true'), f'unit order: {r}')
    # ----- adsDay / adsMark, a new day, a storage that throws
    d = await pg.evaluate(f"{A}.day()")
    need(d == {'d': '2026-10-14', 'hv': 0, 'ch': 0}, f'day at start {d}')
    await pg.evaluate(f"{A}.mark('chips'); {A}.mark('chips'); {A}.mark('bogus')")
    d = await pg.evaluate(f"{A}.day()")
    need(d == {'d': '2026-10-14', 'hv': 0, 'ch': 2}, f'day after two chips ads {d}')
    await pg.evaluate(f"{A}.mark('harvest')")
    need(await pg.evaluate(f"{A}.day()") == {'d': '2026-10-14', 'hv': 1, 'ch': 2}, 'harvest mark')
    need(json.loads(await pg.evaluate(f"localStorage.getItem('{ADSKEY}')")) == {'d': '2026-10-14', 'hv': 1, 'ch': 2}, 'the stored record')
    await pg.evaluate("window.__pwNow(%s)" % json.dumps(at(15)))
    need(await pg.evaluate(f"{A}.day()") == {'d': '2026-10-15', 'hv': 0, 'ch': 0}, 'a new day does not start empty')
    await pg.evaluate("window.__pwNow(%s)" % json.dumps(at(14)))
    need(await pg.evaluate(f"{A}.day()") == {'d': '2026-10-14', 'hv': 1, 'ch': 2}, 'the day came back')
    th = await pg.evaluate(f"""(() => {{
      const si = Storage.prototype.setItem, gi = Storage.prototype.getItem;
      Storage.prototype.setItem = () => {{ throw new Error('full'); }}; Storage.prototype.getItem = () => {{ throw new Error('blocked'); }};
      try {{ {A}.mark('chips'); return {A}.day(); }} finally {{ Storage.prototype.setItem = si; Storage.prototype.getItem = gi; }}
    }})()""")
    need(th == {'d': '2026-10-14', 'hv': 1, 'ch': 3}, f'storage that throws: {th}')
    need((await pg.evaluate(f"{A}.day()"))['ch'] == 3, 'the memory copy is lost once the storage works again')
    await ctx.close()
    # ----- the Harvest: ready, tap, doubled once, kept after a reload, a new day starts again
    ctx, pg = await new_page(b, errs, tag, 'view')
    await sheet(pg); await ready(pg)
    need(await shown(pg, '#hvAd') and not await disabled(pg, '#hvAd'), 'x2 is not enabled when the ad is ready')
    need('×2 · watch an ad' in await btn(pg) and '15 → 30' in await btn(pg) and 'Soon' not in await btn(pg), f"x2 button: {await btn(pg)!r}")
    need('Ads are never needed' in await txt(pg, '#hvGift') and 'come later' not in await txt(pg, '#hvGift'), f"note: {await txt(pg, '#hvGift')!r}")
    await shot(pg, errs, tag, '1_ready')
    await pg.tap('#hvAd'); await pg.wait_for_timeout(120)
    need(await state(pg) == 'busy' and await disabled(pg, '#hvAd') and await disabled(pg, '#hvClaim'), 'the buttons are not held while the ad plays')
    need((await prof(pg))['tokens'] == 85, 'paid before the ad ended')
    await pg.wait_for_timeout(700)
    p1 = await prof(pg)
    need(p1['tokens'] == 85 + 30 and p1['harvest'] == {'n': 1, 'c': 0, 'd': '2026-10-14', 'sk': []}, f"after the ad: chips {p1['tokens']}, harvest {p1.get('harvest')}")
    need(await btn(pg) == 'Doubled 15 → 30' and await disabled(pg, '#hvAd'), f"after the ad the button says {await btn(pg)!r}")
    need(await pg.evaluate("window.__blAds.day()") == {'d': '2026-10-14', 'hv': 1, 'ch': 0}, 'the day was not marked')
    need('claimed' in await txt(pg, '#hvGift') and not await shown(pg, '#hvClaim'), 'the gift is not shown claimed')
    need(await pg.evaluate("window.__blHarvest.claim('')") is None and (await prof(pg))['tokens'] == 115, 'a second claim paid')
    await shot(pg, errs, tag, '2_doubled')
    await pg.tap('#dlyClose'); await pg.wait_for_timeout(250)
    need(await txt(pg, '#mTokens') == '115', f"the pill shows {await txt(pg, '#mTokens')!r} chips")
    await reload_sheet(pg)
    await sheet(pg)
    need(await btn(pg) == 'Doubled 15 → 30' and await disabled(pg, '#hvAd'), f"after a reload the button says {await btn(pg)!r}")
    need((await prof(pg))['tokens'] == 115, 'a reload paid again')
    await pg.wait_for_timeout(300)
    need(await state(pg) == 'off', 'an ad was asked for after the gift was doubled')
    await pg.tap('#dlyClose'); await pg.wait_for_timeout(250)
    await reload_sheet(pg, at(15))   # tomorrow: a new gift, a new ad
    await sheet(pg); await ready(pg)
    need(await btn(pg) == '×2 · watch an ad 15 → 30' and not await disabled(pg, '#hvAd'), f"next day the button says {await btn(pg)!r}")
    await pg.tap('#hvAd'); await pg.wait_for_timeout(900)
    need((await prof(pg))['tokens'] == 145 and (await prof(pg))['harvest']['n'] == 2, f"day 2: chips {(await prof(pg))['tokens']}")
    # a day with no chips (day 30, the skin) has no x2 button
    await pg.tap('#dlyClose'); await pg.wait_for_timeout(250)
    await pg.evaluate("(() => { const p = JSON.parse(localStorage.getItem('%s')); p.harvest = { n: 29, c: 0, d: '2026-10-15', sk: [] }; localStorage.setItem('%s', JSON.stringify(p)); })()" % (PROF, PROF))
    await reload_sheet(pg, at(16)); await sheet(pg)
    need(not await shown(pg, '#hvAd') and 'Claim for' in await txt(pg, '#hvClaim'), 'day 30 shows an x2 button')
    await ctx.close()

async def skip(b, errs):
    tag = 'skip'
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
    ctx, pg = await new_page(b, errs, tag, 'skip')
    r = await pg.evaluate("""new Promise((res) => {
      const a = window.__blAds, log = [];
      a.prime('chips', () => {
        log.push(a.show('chips', () => log.push('reward'), (w) => log.push('end ' + w + ' ' + a.state('chips'))));
        setTimeout(() => res(log), 600);
      });
    })""")
    need(r == [True, 'end false off'], f'skip unit: {r}')
    await sheet(pg); await ready(pg)
    await pg.tap('#hvAd'); await pg.wait_for_timeout(700)
    await ready(pg)
    p1 = await prof(pg)
    need(p1['tokens'] == 85 and not p1.get('harvest'), f"a skipped ad paid: chips {p1['tokens']}, harvest {p1.get('harvest')}")
    need(await btn(pg) == '×2 · watch an ad 15 → 30' and not await disabled(pg, '#hvAd') and not await disabled(pg, '#hvClaim'), f"after a skip the button says {await btn(pg)!r}")
    need(await pg.evaluate("window.__blAds.day()") == {'d': '2026-10-14', 'hv': 0, 'ch': 0}, 'a skip marked the day')
    await pg.tap('#hvAd'); await pg.wait_for_timeout(700); await ready(pg)   # and again
    need((await prof(pg))['tokens'] == 85, 'the second skip paid')
    await pg.tap('#hvClaim'); await pg.wait_for_timeout(500)   # a plain Claim: 15, no x2 button after it
    p2 = await prof(pg)
    need(p2['tokens'] == 100 and p2['harvest']['n'] == 1, f"plain claim: chips {p2['tokens']}")
    need(not await shown(pg, '#hvAd') and 'claimed' in await txt(pg, '#hvGift'), 'the x2 button is there after a plain claim')
    await ctx.close()

async def none(b, errs):
    tag = 'none'
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
    ctx, pg = await new_page(b, errs, tag, 'none')
    await sheet(pg)
    await pg.wait_for_function("window.__blAds.state('harvest') === 'none'", timeout=4000)
    need(await btn(pg) == 'No ad right now 15 → 30' and await disabled(pg, '#hvAd'), f"x2 button: {await btn(pg)!r}")
    need(await pg.get_attribute('#hvAd', 'aria-disabled') == 'true', 'aria-disabled is not set')
    await shot(pg, errs, tag, '1_none')
    await pg.evaluate("document.querySelector('#hvAd').click()"); await pg.wait_for_timeout(300)
    need((await prof(pg))['tokens'] == 85, 'a disabled x2 button paid')
    await pg.tap('#hvClaim'); await pg.wait_for_timeout(500)
    need((await prof(pg))['tokens'] == 100 and not await shown(pg, '#hvAd'), 'a plain claim without an ad went wrong')
    # closing and opening the sheet asks again
    await pg.tap('#dlyClose'); await pg.wait_for_timeout(250)
    await ctx.close()

async def real(b, errs):
    """The real adapter: ADS_CLIENT set in a copy of the page, Google's script answered by a stand-in."""
    tag = 'real'
    def need(ok, msg):
        if not ok: errs.append(f'{tag}: {msg}')
    src = (ROOT / 'build' / 'test.html').read_text()
    if 'const ADS_CLIENT = "";' not in src:
        errs.append(f'{tag}: ADS_CLIENT is not an empty string in the build'); return
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    page = pathlib.Path(OUT).resolve() / 'ads_client_copy.html'
    page.write_text(src.replace('const ADS_CLIENT = "";', 'const ADS_CLIENT = "ca-pub-1234567890123456";', 1))
    url = page.as_uri()
    async def one(mode, watch, blocked=False):
        ctx, pg = await new_page(b, errs, f'{tag}-{mode}-{watch}', '', url=url, extra=f"window.__stub = {{ mode: {json.dumps(mode)}, watch: {json.dumps(watch)} }};", quiet=blocked)
        async def route(r):
            if blocked: await r.abort()
            else: await r.fulfill(status=200, content_type='application/javascript', body=STUB, headers={'access-control-allow-origin': '*'})
        await ctx.route('https://pagead2.googlesyndication.com/**', route)
        return ctx, pg
    # viewed: the tag, the config, the break, the sound muted between beforeAd and afterAd, the gift doubled
    ctx, pg = await one('ready', True)
    need(await pg.evaluate("window.__blAds.on()"), 'adsOn() is false with ADS_CLIENT set')
    need(await pg.evaluate("document.querySelectorAll('script[src*=adsbygoogle]').length") == 0, 'the tag was loaded before first use')
    await sheet(pg); await ready(pg)
    tagi = await pg.evaluate("(() => { const s = document.querySelector('script[src*=adsbygoogle]'); return s && { src: s.src, async: s.async, co: s.getAttribute('crossorigin'), hint: s.getAttribute('data-ad-frequency-hint'), test: s.getAttribute('data-adbreak-test') }; })()")
    need(tagi == {'src': 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456', 'async': True, 'co': 'anonymous', 'hint': '30s', 'test': None}, f'the tag: {tagi}')
    log = await pg.evaluate("window.__stub.log")
    need(any(l.startswith('config') and 'preloadAdBreaks' in l and '"preloadAdBreaks":"on"' in l and '"sound":"on"' in l for l in log) and 'break x2_harvest' in log, f'the pushes: {log}')
    need(not await disabled(pg, '#hvAd'), 'x2 is not enabled when the break is ready')
    await pg.tap('#hvAd'); await pg.wait_for_timeout(1000)
    p1 = await prof(pg)
    st = await pg.evaluate("window.__stub")
    need(p1['tokens'] == 115 and await btn(pg) == 'Doubled 15 → 30', f"viewed: chips {p1['tokens']}, button {await btn(pg)!r}")
    need(st['vols'] == [0, 0.550000011920929], f"the game's sound around the ad: {st['vols']}")
    need(st['log'].count('show') == 1, f"showAdFn calls: {st['log']}")
    await ctx.close()
    # dismissed: nothing paid, another break is asked for, the button is tryable again
    ctx, pg = await one('ready', False)
    await sheet(pg); await ready(pg)
    await pg.tap('#hvAd'); await pg.wait_for_timeout(900); await ready(pg)
    st = await pg.evaluate("window.__stub")
    need((await prof(pg))['tokens'] == 85 and not await disabled(pg, '#hvAd') and st['log'].count('break x2_harvest') == 2, f"dismissed: chips {(await prof(pg))['tokens']}, breaks {st['log']}")
    need(st['vols'] == [0, 0.550000011920929], f"the game's sound after a dismissed ad: {st['vols']}")
    await ctx.close()
    # notReady (adBreakDone with nothing before it), blocked (the script fails), silent (no answer: the 8 s timeout)
    ctx, pg = await one('notReady', True)
    await sheet(pg); await pg.wait_for_function("window.__blAds.state('harvest') === 'none'", timeout=4000)
    need(await btn(pg) == 'No ad right now 15 → 30', f"notReady: {await btn(pg)!r}")
    await ctx.close()
    ctx, pg = await one('ready', True, blocked=True)
    await sheet(pg); await pg.wait_for_function("window.__blAds.state('harvest') === 'none'", timeout=3000)
    need(await btn(pg) == 'No ad right now 15 → 30', f"blocked: {await btn(pg)!r}")
    need(await pg.evaluate("document.querySelectorAll('script[src*=adsbygoogle]').length") == 0, 'the failed tag is left in the page')
    await ctx.close()
    ctx, pg = await one('silent', True)
    await sheet(pg)
    need(await state(pg) == 'wait' and await disabled(pg, '#hvAd'), 'silent: not waiting')
    await pg.wait_for_function("window.__blAds.state('harvest') === 'none'", timeout=10000)
    need(await btn(pg) == 'No ad right now 15 → 30', f"silent: {await btn(pg)!r}")
    await ctx.close()

async def main():
    errs = []
    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for name, fn in (('off', off), ('view', view), ('skip', skip), ('none', none), ('real', real)):
            print('running', name, flush=True)
            try: await fn(b, errs)
            except Exception as e: errs.append(f'{name}: {type(e).__name__}: {str(e)[:300]}')
        await b.close()
    for e in errs: print('PROBLEM', e)
    print('ads ok' if not errs else f'{len(errs)} problems')
asyncio.run(main())
