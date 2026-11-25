/* ===================== Reaper's attacks: the Carved Ink effect kit (ui/hitkit.js, concept redesign/concept.md D.2 and D.3; UI only) ===================== */
/* Kit "Soul crescents" (pale core, mint body, violet edge): hitkit's split crescent and crescent shards; the floor mark here is a hooked
   stroke. Every scythe trail (lights and heavies, scyTrail) is the kit's three tones over an ink edge. The flat heavies (Reap, Grave sweep)
   hit behind him too, so their smear is a full flat ring for two frames; the overhead and air heavies follow the blade tip's real path; all
   of them behind both fighters (UV_BACK.reaper). Harvest: the spin is one closed ring round him with thin ribbons running inwards (the
   pull); finish-ready, a second dashed ring and Last Rites' hook twice as wide. Soul Harvest: after the pull, a moon-sized crescent takes
   the screen behind the foe and lifts with him (from the sweep's third tick: the impact frames own the first two).
   Helpers shared by the T6 kits are in ui/hk-samurai.js (hkSam*). */
const HK_RPR = { hit: [null, null, null, null] };   // Soul Harvest's sweep that landed, per slot: { g, t: tick, x, y }

/* ---------- the kit's own parts ---------- */
// the floor mark: one hooked stroke along the floor, the hook turned up at its end, and a crescent chip
HK_KIT.reaper.mark = (c, x, y, w, K, a) => {
  const C = K.cols, ga = c.globalAlpha;
  c.globalAlpha = ga * (a === undefined ? 1 : a);
  c.lineCap = "round"; c.lineJoin = "round";
  const path = () => { c.beginPath(); c.moveTo(x - w, y + 1); c.quadraticCurveTo(x, y + 2.5, x + w * 0.62, y - 1); c.quadraticCurveTo(x + w * 0.95, y - 4, x + w * 0.62, y - 9); };
  path(); c.lineWidth = 5; c.strokeStyle = HK_INK; c.stroke();
  path(); c.lineWidth = 3; c.strokeStyle = C[2]; c.stroke();
  path(); c.lineWidth = 1.3; c.strokeStyle = C[1]; c.stroke();
  hkShard(c, x - w * 0.3, y - 6, 4.2, -0.6, K, 1);
  c.globalAlpha = ga;
};
// the charge-up: the flat halo on the blade and the scythe's reach (reapReach, the kit's colours) from the first charge frame
HK_KIT.reaper.charge = (c, f, P, tk, st, q, pts) => {
  hkSamCharge(c, f, P, tk, st, q, pts, HK_KIT.reaper);
  c.save(); reapReach(c, f, P, tk); c.restore();
};

/* ---------- the scythe's trail: the kit's three tones over an ink edge (scyTrail, draw-fighters.js) ---------- */
function hkRprTrail(c, pts, n, wmax, a) {
  if (a <= 0 || n < 2) return;
  const C = HK_KIT.reaper.cols, ga = c.globalAlpha;
  c.globalAlpha = a; c.fillStyle = HK_INK; brush(c, pts, wmax * 1.3 + 2.4, n);
  c.fillStyle = C[2]; brush(c, pts, wmax * 1.1, n);
  c.fillStyle = C[1]; brush(c, pts, wmax * 0.72, n);
  c.fillStyle = C[0]; brush(c, pts, wmax * 0.3, n);
  c.globalAlpha = ga;
}

/* ---------- the heavies (behind the fighters, the attacker's space) ---------- */
// a full flat ring on the swing's own ellipse (front and back reach differ), tilted so it reads as a ring, thickest at the near side
function hkRprRing(c, F, w, a) {
  const R = (F.rf + F.rb) / 2, cx = F.cx + (F.rf - F.rb) / 2;
  hkSmear(c, cx, F.cy, R, F.t1, F.t2, w * (1 + 0.7 * HV_K), HK_KIT.reaper, { ry: 0.36, a });
}
const hkRprHv = {
  hSide(c, f, P, hv) { const T = hv.trail; if (T && T.flat) hkRprRing(c, T.flat, 46, hkSamFade(hv, 2, 5)); },
  hDown(c, f, P, hv) { const T = hv.trail; if (T && T.flat) hkRprRing(c, T.flat, 36, hkSamFade(hv, 2, 5)); },
  hUp(c, f, P, hv) { hkRprTip(c, P, hv, 26); },
  hAir(c, f, P, hv) { hkRprTip(c, P, hv, 24); },
};
// the blade tip's real path (scyPts) as a crescent towards the hands
function hkRprTip(c, P, hv, w) {
  const T = hv.trail, a = hkSamFade(hv, 2, 6);
  if (!T || T.flat || a <= 0) return;
  hkSamRibbon(c, scyPts(T, P.w, 20), lerp2(T.h1, T.h2, 0.5), w * (1 + 0.7 * HV_K), HK_KIT.reaper, { a });
}

/* ---------- Harvest: one closed ring round him, thin ribbons running in (the pull); finish-ready a second, dashed ring ---------- */
function hkRprHarvest(c, g, f, tk) {
  const m = f.move;
  if (f.state !== "attack" || f.mid !== "spec" || !m || f.mt <= m.startup || f.mt > m.startup + m.active + 4) return;
  const P = pose(f, tk), K = HK_KIT.reaper, C = K.cols, w = P.w, cx = w * 0.25 + 6, cy = -P.leg - P.tor * 0.26, R = 60, ry = 0.3;
  const u = clamp((f.mt - m.startup - 1) / Math.max(1, m.active - 1), 0, 1), a = f.mt <= m.startup + m.active ? 1 : 1 - (f.mt - m.startup - m.active) / 5, rdy = finishReady(foeSlot(f.slot));
  const ps = Math.PI - 0.1 + Math.PI * 3 * u;   // the blade's angle round him (reaperPose)
  c.save(); c.translate(f.x, f.y); c.scale(f.facing, 1); c.globalAlpha = a; c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 0; i < 7; i++) {   // the ribbons, from far out running in to the ring
    const ph = (tk * 0.07 + i / 7) % 1, an = (i / 7) * CV_TAU + 0.3, r1 = R * (2 - ph * 0.85), r0 = r1 - 22, ca = Math.cos(an), sa = Math.sin(an);
    c.globalAlpha = a * Math.sin(Math.PI * ph);
    hkStreak(c, [cx + ca * r1, cy + sa * r1 * ry], [cx + ca * r0, cy + sa * r0 * ry], 2.2, K, { head: 0.8, noInk: true });
  }
  c.globalAlpha = a;
  for (const [lw, col] of [[10, HK_INK], [7.6, C[2]], [4.8, C[1]], [1.8, C[0]]]) { c.lineWidth = lw; c.strokeStyle = col; c.beginPath(); c.ellipse(cx, cy, R, R * ry, 0, 0, CV_TAU); c.stroke(); }
  if (rdy) { c.setLineDash([22, 12]); c.lineDashOffset = -tk * 2; c.lineWidth = 4.4; c.strokeStyle = HK_INK; c.beginPath(); c.ellipse(cx, cy, R + 18, (R + 18) * ry, 0, 0, CV_TAU); c.stroke(); c.lineWidth = 2.2; c.strokeStyle = C[0]; c.stroke(); c.setLineDash([]); }
  hkSmear(c, cx, cy, R + 4, ps - 1.6, ps, rdy ? 20 : 14, K, { ry, a });   // the blade's own crescent riding the ring
  c.restore();
}

/* ---------- Soul Harvest: the moon-sized crescent ---------- */
function hkRprMoon(c, g, f, tk) {
  const H = HK_RPR.hit[f.slot];
  let age = H && H.g === g ? tk - H.t - 1 : 999, x = H ? H.x : 0, y = H ? H.y : 0;
  if (age >= 60 && uvHeld(f) === "harvest" && f.mt >= 25) {   // a sweep that missed: the same crescent by the move's clock, where the foe would be
    const o = g.fighters[1 - f.slot];
    age = f.mt - 25; x = o && Math.abs(o.x - f.x) < 300 ? o.x : f.x + f.facing * 160; y = f.y - 46;
  }
  if (age < 2 || age >= 50) return;   // the impact frames own the hit's first two ticks
  const d = f.facing, R = clamp((L.gh / cam.z) * 0.8, 260, 560), w = R * 0.24, k = ease(clamp((age - 1) / 5, 0, 1)), a = age < 30 ? 1 : 1 - (age - 30) / 20;
  const lift = 0.5 * ease(clamp((age - 2) / 28, 0, 1)), cx = x - d * (R - w * 0.45), cy = y + 10;
  c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.globalAlpha = a * (hkCalm() ? 0.3 : 0.5); c.fillStyle = HK_INK; c.fillRect(0, 0, L.gw, L.gh);   // the night it takes (Reduce flashes: dimmer)
  c.restore();
  const a0 = 1.15 - lift, a1 = a0 - 3.1 * k;   // from below the floor in front, up over him, swinging higher as he goes up
  hkSmear(c, cx, cy, R, d > 0 ? a0 : Math.PI - a0, d > 0 ? a1 : Math.PI - a1, w, HK_KIT.reaper, { a });
}

UV_BACK.reaper = (c, g, f, tk) => {
  hkSamOwnFx(c, f);
  hkSamHeavy(c, f, tk, hkRprHv);
  hkRprHarvest(c, g, f, tk);
  hkRprMoon(c, g, f, tk);
};
