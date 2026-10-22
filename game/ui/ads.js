/* ===================== rewarded ads (UI only; nothing here touches the sim, the fighters or the profile) =====================
   Watching an ad is always a choice and always optional: it doubles the Harvest's chips (ui/harvest.js) and, in the Shop (ui/shop.js, ui/pshop.js),
   pays Pommes and Free chips. This file is the one adapter to Google's H5 Games Ad Placement API (developers.google.com/ad-placement); everything else asks it.
     adsOn()                 ads exist (ADS_CLIENT is set, or the test fake is on)
     adsPrime(kind, cb)      ask for a rewarded ad for kind ("pommes" | "harvest" | "chips"); cb(true) once one is ready, cb(false) when none comes
                             (not ready, capped, an error, an ad blocker, 8 s). Every cb is called exactly once, always from a timer, never inside adsPrime.
                             One break at a time: priming another kind while one is waiting or ready replaces it, and the replaced one's cb(false) comes
                             (adsState(oldKind) is then "off", not "none"; don't prime again from that cb). Priming while an ad shows answers cb(false).
     adsState(kind)          "off" (nothing asked for this kind, or its break is spent) | "wait" | "ready" | "none" (asked, none came) | "busy" (showing)
     adsShow(kind, onReward, onEnd)   plays the ready ad (call it from the tap); false when none is ready. onReward() once, only if watched to the end;
                             onEnd(watched) always, after the ad has closed. The break is spent then: the next ad needs a new adsPrime.
     adsDay() / adsMark(kind)  today's use on this device: { d: dailyKey(), hv: 0|1 (Harvest x2 used), ch: Free-chips ads }; kind "harvest" | "chips"
   Test fake: window.__blAdFake = "view" | "skip" | "none", set before the page loads. No script is loaded; priming answers after 50 ms (ready, or none for
   "none"), showing after 300 ms (rewarded for "view", closed for "skip"). The server never trusts any of this: it is the page's word only. */
const ADS_CLIENT = "";   // the AdSense publisher id ("ca-pub-..."); empty = ads off. Flip it together with web/ads.txt and pommes.js's server switch.
const ADS_KEY = "potatobrawl.ads.v1";
const ADS_WAIT = 8000;       // ms a prime waits for an ad
const ADS_CAP = 180000;      // ms an ad may show before the page gives up waiting for its end
const ADS = { kind: "", st: "off", tok: 0, tmr: 0, cb: null, fn: null, run: null, load: 0, vol: -1, mem: null };

// the fake only on a test page (a file or this machine), never on the live site
const adsFake = () => { const f = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) && window.__blAdFake; return f === "view" || f === "skip" || f === "none" ? f : ""; };
const adsOn = () => !!ADS_CLIENT || !!adsFake();
const adsState = (kind) => (adsOn() && ADS.kind === kind ? ADS.st : "off");
// Google's wrappers (adBreak and adConfig are both a push onto adsbygoogle); named with the prefix, never the bare globals of their sample code
function adsPush(o) { try { (window.adsbygoogle = window.adsbygoogle || []).push(o); } catch (e) { /* the break times out */ } }
// the game's sound off while an ad plays: the master gain only, so the Sound setting in the profile is never touched
function adsMute(on) {
  try {
    const g = Sfx.out && Sfx.out.gain;
    if (!g) return;
    if (on) { if (ADS.vol < 0) ADS.vol = g.value; g.cancelScheduledValues(0); g.value = 0; }
    else if (ADS.vol >= 0) { g.cancelScheduledValues(0); g.value = ADS.vol; ADS.vol = -1; }
  } catch (e) { ADS.vol = -1; }
}
// inject Google's tag on first use (a blocker or no network: onerror answers the waiting prime at once, and a later prime loads it again)
function adsLoad() {
  if (ADS.load) return;
  ADS.load = 1;
  window.adsbygoogle = window.adsbygoogle || [];
  try {
    const s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.setAttribute("data-ad-frequency-hint", "30s");
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) s.setAttribute("data-adbreak-test", "on");
    s.onerror = () => {
      ADS.load = 0; s.remove();
      try { if (Array.isArray(window.adsbygoogle)) window.adsbygoogle.length = 0; } catch (e) { /* kept */ }
      if (ADS.st === "wait") adsSettle(ADS.tok, false);
    };
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(ADS_CLIENT);
    document.head.appendChild(s);
  } catch (e) { ADS.load = 0; }
  adsPush({ preloadAdBreaks: "on", sound: P.sound ? "on" : "off" });
}
// a waiting prime is answered: ready (fn = Google's showAdFn) or none
function adsSettle(tok, ok, fn) {
  if (tok !== ADS.tok || ADS.st !== "wait") return;
  clearTimeout(ADS.tmr);
  const cb = ADS.cb;
  ADS.cb = null; ADS.fn = ok ? fn || null : null; ADS.st = ok ? "ready" : "none";
  if (cb) setTimeout(() => cb(ok), 0);   // from a timer even when Google answers inside adsPrime
}
// the ad is over (adBreakDone, the end of the fake, or the watchdog): the break is spent
function adsFinish(tok) {
  if (tok !== ADS.tok || ADS.st !== "busy") return;
  clearTimeout(ADS.tmr);
  const run = ADS.run;
  ADS.run = null; ADS.st = "off"; ADS.kind = ""; ADS.fn = null;
  adsMute(false);
  if (run && run.onEnd) run.onEnd(run.got);
}
function adsReward(tok) {
  const run = ADS.run;
  if (tok !== ADS.tok || ADS.st !== "busy" || !run || run.got) return;
  run.got = true;
  if (run.onReward) run.onReward();
}
// one rewarded break with Google: beforeReward = an ad is available (showAdFn is kept; that is "ready"), adViewed = the reward, adDismissed = none
function adsBreak(tok, kind) {
  adsLoad();
  adsPush({ sound: P.sound ? "on" : "off" });
  adsPush({
    type: "reward", name: "x2_" + kind,
    beforeAd: () => { if (tok === ADS.tok) adsMute(true); },
    afterAd: () => { adsMute(false); if (tok === ADS.tok && ADS.st === "busy") { clearTimeout(ADS.tmr); ADS.tmr = setTimeout(() => adsFinish(tok), 4000); } },
    beforeReward: (showAdFn) => adsSettle(tok, true, showAdFn),
    adDismissed: () => { /* no reward */ },
    adViewed: () => adsReward(tok),
    adBreakDone: () => {   // info.breakStatus: "notReady", "frequencyCapped", "viewed", "dismissed", ...
      if (tok !== ADS.tok) return;
      if (ADS.st === "wait") adsSettle(tok, false);
      else if (ADS.st === "busy") adsFinish(tok);
      else if (ADS.st === "ready") { ADS.st = "off"; ADS.kind = ""; ADS.fn = null; }   // the ad it had expired unused
    },
  });
}
function adsPrime(kind, cb) {
  const late = (ok) => { if (cb) setTimeout(() => cb(ok), 0); };
  if (!adsOn() || ADS.st === "busy") { late(false); return; }
  if (ADS.st === "wait") { clearTimeout(ADS.tmr); const old = ADS.cb; ADS.cb = null; if (old) setTimeout(() => old(false), 0); }   // replaced
  const tok = ++ADS.tok;
  ADS.kind = kind; ADS.st = "wait"; ADS.cb = cb || null; ADS.fn = null; ADS.run = null;
  ADS.tmr = setTimeout(() => adsSettle(tok, false), ADS_WAIT);
  const fk = adsFake();
  if (fk) setTimeout(() => adsSettle(tok, fk !== "none"), 50);
  else adsBreak(tok, kind);
}
function adsShow(kind, onReward, onEnd) {
  if (!adsOn() || ADS.st !== "ready" || ADS.kind !== kind) return false;
  const tok = ADS.tok, show = ADS.fn, fk = adsFake();
  ADS.fn = null; ADS.st = "busy"; ADS.run = { got: false, onReward, onEnd };
  clearTimeout(ADS.tmr); ADS.tmr = setTimeout(() => adsFinish(tok), ADS_CAP);
  if (fk) {
    adsMute(true);
    setTimeout(() => { if (fk === "view") adsReward(tok); adsFinish(tok); }, 300);
  } else setTimeout(() => { try { show(); } catch (e) { adsFinish(tok); } }, 0);
  return true;
}

/* ----- today's use on this device (localStorage, memory when the storage fails; a new day starts empty) ----- */
function adsDay() {
  const d = dailyKey(), ok = (o) => o && typeof o === "object" && o.d === d, size = (o) => (o.hv ? 1 : 0) + (o.ch | 0);
  let o = null;
  try { o = JSON.parse(localStorage.getItem(ADS_KEY)); } catch (e) { o = null; }
  if (!ok(o)) o = null;
  if (ok(ADS.mem) && (!o || size(ADS.mem) > size(o))) o = ADS.mem;   // a write the storage refused
  return o ? { d, hv: o.hv ? 1 : 0, ch: Math.max(0, Math.min(99, o.ch | 0)) } : { d, hv: 0, ch: 0 };
}
function adsMark(kind) {
  const o = adsDay();
  if (kind === "harvest") o.hv = 1; else if (kind === "chips") o.ch++; else return;
  ADS.mem = o;
  try { localStorage.setItem(ADS_KEY, JSON.stringify(o)); } catch (e) { /* kept in memory */ }
}
window.__blAds = { on: adsOn, prime: adsPrime, state: adsState, show: adsShow, day: adsDay, mark: adsMark };
