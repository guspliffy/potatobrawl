/* ===================== Bosses: Kraken Spud, the Sea Monster (UI only): his head and tentacles, the Wave, his tells, the Ink Spray blots, his sounds =====================
   Registers BOSS_ART.kraken (the registry and the hand-over are in draw-boss.js). Fable's design: /mnt/project-files/bosses2/fable-design.md section 2.
   The simulation (core.js krakenStep) never reads anything here; this file reads the fighter, the game and its projectiles only.
   Where he is: the head waits in the sea past the right ledge (f.x, f.y = 470, -20 is the head's bottom; its centre 100 above, 180 x 200), the top of
   a very big purple potato whose lower half goes on down into the water (the water line KR_SEA_Y = 100, the piles' in maps/deep.js; the horizon sits
   near y 25, so the sea there is the background's). Only the Chomp, a stagger or the break bring the head onto the deck, where it lies squashed to
   0.7 (170 x 130, the hurtbox) with two tentacles draped over the lip. His other tentacles are projectiles: a slam leaves a "tent" standing on the
   deck (hurtable: a pulsing pink outline), the Sweep is the Laser's floor projectile ("sweep", z laser) drawn as a tentacle lying along the deck,
   the Wave a water wall. The tells behind the pier (the slams' arches, the Sweep's tentacle rising past its ledge, the two far tentacles swaying past
   the right ledge) are drawn by krBehind from the map's stage(), before the jetty, so they rise from behind it.
   Ink Spray (bossInk): the blots are UI only and live in screen space: BOSS_ART.kraken.screen(c, g, tk) draws them over the fight and under the HUD
   (render2D calls it through bossScreen once that hook is in; until then krDraw draws them itself, under the fighter drawn after him).
   Once-per-tick work (cues, particles, the seagull, sounds) runs from krSync when the UI tick has moved on. Gradients are made once per canvas
   context, glows are sprites, no shadowBlur. */
const KC = {
  hi: "#8a5aa8", body: "#6a3f8f", lo: "#3a1f55", teal: "#3ef2c0", suck: "#ff8fb0", suckIn: "#c25a80", sclera: "#e8e0f0", maw: "#3a1f55", throat: "#1e0f30",
  tongue: "#e07a9a", teeth: "#e3dccb", barn: "#d9d2c0", barnIn: "#5a4e44", foam: "#bfe8e0", rage: "#ff3b2b", gold: "#ffd34a", wet: "rgba(200,240,255,0.35)",
  dimHi: "#7a6a88", dim: "#574766", dimLo: "#2e2238", gull: "#f2f0ea", gullW: "#9aa3ab", beak: "#ffb347",
};
const KR_TAU = Math.PI * 2;
const KR_SEA_Y = 100;   // the water line round the pier (world y): his lower half and the tentacles' roots are under it
const KR_RX = 90, KR_RY = 100, KR_RYB = 250;   // the head (Fable: 180 x 200); at sea the potato runs on 250 below its centre (into the water)
const KR_EX = 34, KR_EY = -30, KR_ER = 16, KR_MY = 38;   // the eyes and the mouth about the head's centre
const KR_BARN = [[-50, -80, 5], [-20, -95, 6], [12, -98, 4.2], [40, -88, 5.4], [64, -64, 4]];   // barnacles on the crown: x, y, r
const KR_BODYB = [[-62, 70, 6], [48, 104, 5], [-30, 150, 7], [58, 190, 5.5]];   // and on the body, seen when he is launched out
const KR_FRECK = [[-66, -6], [-58, 12], [-74, 28], [-46, 28], [62, -4], [72, 14], [54, 26], [6, -64]];   // the bioluminescent freckles

// ---- cached art: the body outline (by its lower radius), gradients per canvas context, glow sprites ----
const KR_PATHS = new Map(), krGradCache = new WeakMap(), KR_GLOW = {}, KR_TD = new WeakMap();
function krBlob(ryB) {
  const key = Math.round(ryB);
  let p = KR_PATHS.get(key);
  if (p) return p;
  p = new Path2D();
  for (let i = 0; i <= 44; i++) {
    const a = (i / 44) * KR_TAU, s = Math.sin(a), bump = 1 + 0.035 * Math.sin(a * 4 + 1.1) + 0.02 * Math.sin(a * 7 + 0.3);
    const wide = 1 + 0.08 * Math.max(0, s) * Math.min(1, (key - KR_RY) / 100);   // the body under the head is a touch wider
    const x = Math.cos(a) * KR_RX * bump * wide, y = s * (s > 0 ? key : KR_RY) * bump;
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  if (KR_PATHS.size > 60) KR_PATHS.clear();
  KR_PATHS.set(key, p);
  return p;
}
function krGrads(c) {
  let G0 = krGradCache.get(c);
  if (!G0) {
    const sk = (a, b, d) => { const g = c.createRadialGradient(-KR_RX * 0.35, -KR_RY * 0.45, 8, 0, 0, KR_RY * 1.6); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, d); return g; };
    const wa = c.createLinearGradient(0, -90, 0, 0); wa.addColorStop(0, "rgba(130,205,220,0.82)"); wa.addColorStop(1, "rgba(50,130,165,0.78)");
    G0 = { n: sk(KC.hi, KC.body, KC.lo), d: sk(KC.dimHi, KC.dim, KC.dimLo), wa };
    krGradCache.set(c, G0);
  }
  return G0;
}
function krGlowSprite(key, r, g, b) {
  if (KR_GLOW[key]) return KR_GLOW[key];
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const x = cv.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},0.95)`); gr.addColorStop(0.4, `rgba(${r},${g},${b},0.42)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (KR_GLOW[key] = cv);
}
function krGlow(c, x, y, r, a, key) {
  if (a <= 0 || r <= 0) return;
  const spr = key === "red" ? krGlowSprite("red", 255, 70, 50) : key === "white" ? krGlowSprite("white", 235, 250, 255) : key === "pink" ? krGlowSprite("pink", 255, 143, 176) : krGlowSprite("teal", 62, 242, 192);
  const ga = c.globalAlpha; c.globalAlpha = ga * Math.min(1, a); c.drawImage(spr, x - r, y - r, r * 2, r * 2); c.globalAlpha = ga;
}

// ---- a tentacle ----
// a spine by turtle: from (x, y) heading a, len long in n steps; bend = turn spread evenly, curl = turn packed into the tip, wig = a travelling wiggle
function krSpine(x, y, a, len, n, bend, curl, wig, ph) {
  const pts = [[x, y]], sl = len / n;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    a += bend / n + (curl * 4 * t * t * t) / n + (wig ? (wig * Math.sin(ph - t * 4)) / n : 0);
    x += Math.cos(a) * sl; y += Math.sin(a) * sl;
    pts.push([x, y]);
  }
  return pts;
}
function krEdge(p, P, first) {
  if (first) p.moveTo(P[0][0], P[0][1]); else p.lineTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length - 1; i++) p.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
  p.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
}
// the tentacle along pts, w0 wide at the root -> w1 at the tip (a round tip); o: { suck: +1 / -1 the side the suckers are on (the left of the
// spine's direction is +1), pulse (sucker size), hurt (a pink outline: hurtable), gold, flash, dim, a (alpha), lw }
function krTent(c, pts, w0, w1, o) {
  const n = pts.length;
  if (n < 2) return;
  o = o || {};
  const Lf = [], Rt = [], N = [], W = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2, nx = -ty, ny = tx;
    N.push([nx, ny, tx, ty]); W.push(w);
    Lf.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); Rt.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  const tip = pts[n - 1], an = Math.atan2(N[n - 1][1], N[n - 1][0]), path = new Path2D();
  krEdge(path, Lf, true);
  path.arc(tip[0], tip[1], W[n - 1], an, an - Math.PI, true);
  krEdge(path, Rt.slice().reverse(), false);
  path.closePath();
  const ga = c.globalAlpha;
  if (o.a !== undefined) c.globalAlpha = ga * Math.max(0, Math.min(1, o.a));
  c.lineJoin = "round"; c.lineCap = "round";
  if (o.hurt && !o.flash) { c.strokeStyle = `rgba(255,143,176,${(0.5 * o.hurt).toFixed(3)})`; c.lineWidth = 9; c.stroke(path); }
  if (o.gold && !o.flash) { c.strokeStyle = `rgba(255,211,74,${Math.min(1, o.gold).toFixed(3)})`; c.lineWidth = 9; c.stroke(path); }
  c.fillStyle = o.flash ? "#ffffff" : o.dim ? KC.dim : KC.body; c.fill(path);
  if (!o.flash) {
    // the light along the top edge (the side away from the suckers), a darker band along the underside
    const side = -(o.suck || 1), lw = Math.max(2, w0 * 0.1);
    c.strokeStyle = o.dim ? KC.dimHi : KC.hi; c.lineWidth = lw; c.beginPath();
    for (let i = 0; i < n - 1; i++) { const q = pts[i], w = W[i] - lw * 0.9; const x = q[0] + N[i][0] * side * w, y = q[1] + N[i][1] * side * w; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
    c.strokeStyle = o.dim ? "rgba(30,20,40,0.35)" : "rgba(40,20,60,0.35)"; c.lineWidth = lw * 1.4; c.beginPath();
    for (let i = 0; i < n - 1; i++) { const q = pts[i], w = W[i] - lw; const x = q[0] - N[i][0] * side * w, y = q[1] - N[i][1] * side * w; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
  c.strokeStyle = OUT; c.lineWidth = o.lw || 3; c.stroke(path);
  // the suckers, every other point, on the inside of the curl
  if (o.suck && !o.flash) {
    const pu = o.pulse || 1;
    for (let i = 2; i < n - 1; i += 2) {
      const [nx, ny, tx, ty] = N[i], w = W[i], r = Math.max(1.5, w * 0.34) * pu;
      const x = pts[i][0] + nx * o.suck * w * 0.52, y = pts[i][1] + ny * o.suck * w * 0.52;
      c.fillStyle = o.dim ? "#b07a90" : KC.suck; c.beginPath(); c.ellipse(x, y, r, r * 0.72, Math.atan2(ty, tx), 0, KR_TAU); c.fill();
      c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = KC.suckIn; c.beginPath(); c.arc(x, y, r * 0.38, 0, KR_TAU); c.fill();
    }
  }
  c.globalAlpha = ga;
}

// ---- who and what ----
function krRage(f) {
  const lv = RG && RG.lv != null ? RG.lv : 0, B = f.spec.boss;
  return !!B && f.hpMax > 0 && f.hp * 100 <= f.hpMax * B.rageAt[clamp(lv, 0, 2)];
}
// the move being played: phase 0 tell (mt <= startup), 1 strike, 2 end lag; k = progress through that phase
function krPhase(f) {
  const m = f.move;
  if (f.state !== "attack" || !m) return null;
  const a0 = m.startup + 1, a1 = m.startup + m.active, mt = f.mt, ph = mt < a0 ? 0 : mt <= a1 ? 1 : 2;
  const k = ph === 0 ? clamp(mt / Math.max(1, m.startup), 0, 1) : ph === 1 ? (m.active > 1 ? clamp((mt - a0) / (m.active - 1), 0, 1) : 1) : clamp((mt - a1) / Math.max(1, m.endlag), 0, 1);
  return { key: m.boss || f.mid, m, a0, a1, mt, ph, k, e: mt - a1 };
}
// the nearest player to x in the game drawn this frame
function krFoe(x) {
  let best = null, bd = 1e9;
  if (RG) for (const o of RG.fighters) if (!o.spec.boss && o.state !== "dead" && o.state !== "gone" && Math.abs(o.x - x) < bd) { bd = Math.abs(o.x - x); best = o; }
  return best;
}
// the countdown: he rises out of the water over its first 90 frames (world units still under the water)
const krRise = () => (RG && RG.phase === "countdown" ? (1 - ease(clamp((150 - RG.cd) / 90, 0, 1))) * 330 : 0);
const krSea = (f) => (f.spec.boss && f.spec.boss.sea) || { x: 470, y: -20 };
// his head on (or onto) the deck: 0 at sea, 1 lying on it
const krDeckK = (f) => clamp((krSea(f).x - 30 - f.x) / 120, 0, 1);

/* ---- the look: where the head is, its squash, face, mouth, outline (Q) ---- */
function krLook(f, tk, at) {
  const st = f.state, P = at ? null : krPhase(f), S = STAGE.main, puppet = !!at && st === "fin";
  const Q = { x: at ? at[0] : f.x, y: at ? at[1] : f.y, sx: 1, sy: 1, ryB: KR_RYB, bob: 0, rot: 0, swell: 1, clip: !at, eye: "open", lid: 0.3, at: null, look: null,
    mouth: "closed", mo: 0, cheek: 0, hurt: 0, dim: false, rage: false, stars: false, shake: 0, body: false, deck: 0, rise: 0, drape: 0, lick: -1 };
  if (puppet) {   // the KO page's puppet: down on the deck, dazed, the tentacles flat round him
    Q.deck = 1; Q.sy = 0.72; Q.sx = 1.06; Q.ryB = KR_RY; Q.eye = "spiral"; Q.mouth = "tongue"; Q.stars = true; Q.drape = 1;
    return Q;
  }
  if (at) { Q.ryB = KR_RY; Q.rage = krRage(f); return Q; }   // drawn somewhere else (the off-screen marker): just his head
  Q.rage = krRage(f) && st !== "broken" && !f.doomed;
  if (f.doomed) {   // launched out: the whole potato under the head, somersaulting, screaming
    Q.body = true; Q.clip = false; Q.ryB = 270; Q.eye = "wide"; Q.mouth = "scream"; Q.rot = f.st * 0.2 * (f.kbx >= 0 ? 1 : -1);
    return Q;
  }
  const kd = krDeckK(f), foe = krFoe(Q.x);
  Q.deck = kd; Q.ryB = lerp(KR_RYB, KR_RY, kd); Q.rise = krRise();
  if (foe) Q.at = [foe.x, foe.y - 40];
  let syD = 0.7;
  if (st === "stagger") {
    Q.eye = "spiral"; Q.mouth = "tongue"; Q.stars = f.st >= 8; Q.hurt = f.st >= 10 ? 1 : 0; Q.drape = kd;
  } else if (st === "broken") {
    Q.eye = "broken"; Q.mouth = "slack"; Q.dim = true; Q.hurt = 0.7; Q.drape = kd;
  } else if (P) {
    const { key, ph, k, mt, m } = P;
    if (key === "slam") {
      Q.eye = "lock"; Q.mouth = ph === 0 ? "grin" : "closed";
      const second = f.bk < 1e4 && mt >= m.pairT && mt <= P.a0 + m.pairT;
      Q.at = [clamp(second && mt > P.a0 ? f.bk : f.bx, S.x1 + 30, S.x2 - 30), 0];
    } else if (key === "sweep") {
      Q.eye = "lock"; Q.mouth = "grin";
      const sw = RG && RG.projs.find((p) => p.owner === f.slot && p.style === "sweep");
      Q.at = sw ? [sw.x, -30] : [S.x1, -60];
    } else if (key === "ink") {
      if (ph === 0) { Q.swell = 1 + 0.15 * ease(k); Q.eye = "squeeze"; Q.cheek = k; Q.mouth = "puff"; }
      else if (mt - P.a0 < 10) { Q.eye = "wide"; Q.mouth = "ptoo"; Q.swell = 1 + 0.15 * (1 - (mt - P.a0) / 10); }
      else Q.mouth = "grin";
    } else if (key === "wave") {
      if (ph === 0) { Q.at = [S.x2 + 500, KR_SEA_Y - 40]; Q.mouth = "open"; Q.mo = 0.25 + 0.15 * k; }
      else if (ph === 1 && mt - P.a0 < 45) { Q.eye = "lock"; Q.mouth = "open"; Q.mo = 0.85; Q.shake = Math.sin(tk * 1.7) * 1.5; }
      else Q.mouth = "grin";
    } else if (key === "chomp") {
      const lt = m.startup - m.lunge, lx = clamp(f.bx, 40, 300), total = P.a1 + m.endlag;
      if (mt <= lt) { Q.eye = "lock"; Q.at = [lx, -40]; Q.mouth = "open"; Q.mo = ease(clamp(mt / lt, 0, 1)); }
      else if (mt <= m.startup) { Q.eye = "lock"; Q.at = [lx, -40]; Q.mouth = "gape"; syD = 0.9; }
      else if (f.bk > 0) { Q.eye = "happy"; Q.mouth = "chew"; Q.cheek = 0.7; Q.shake = Math.sin(tk * 1.3) * 3; syD = 0.82; }
      else if (f.bk === 0) { Q.eye = "lock"; Q.mouth = "gape"; syD = 0.9; }
      else if (f.ph === 1) { Q.eye = "woozy"; Q.mouth = "pant"; Q.hurt = 1; Q.drape = kd; }
      else if (mt > total - m.slide) { Q.eye = "open"; Q.mouth = "closed"; }
    }
  } else {
    // at sea between moves: a slow bob (2.4 s), the eyes on the nearest player
    Q.bob = 6 * Math.sin((tk / 144) * KR_TAU);
  }
  if (tk - KR.lick < 70 && kd < 0.2 && !P) { Q.mouth = "lick"; Q.lick = (tk - KR.lick) / 70; Q.at = [S.x2 + 400, KR.lickY]; }
  Q.sy = lerp(1, syD, kd); Q.sx = lerp(1, 1.05, kd);
  return Q;
}

/* ---- the head ---- */
function krBarnacle(c, x, y, r) {
  c.fillStyle = KC.barn; c.strokeStyle = OUT; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(x - r, y + r * 0.35); c.lineTo(x - r * 0.55, y - r * 0.55); c.lineTo(x + r * 0.55, y - r * 0.55); c.lineTo(x + r, y + r * 0.35); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = KC.barnIn; c.beginPath(); c.ellipse(x, y - r * 0.5, r * 0.42, r * 0.17, 0, 0, KR_TAU); c.fill();
  c.strokeStyle = "rgba(17,16,28,0.35)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - r * 0.3, y + r * 0.3); c.lineTo(x - r * 0.2, y - r * 0.4); c.moveTo(x + r * 0.3, y + r * 0.3); c.lineTo(x + r * 0.2, y - r * 0.4); c.stroke();
}
function krBody(c, Q, tk, flash, armor) {
  const p = krBlob(Q.ryB), G0 = krGrads(c);
  if (Q.hurt > 0 && !flash) { c.strokeStyle = `rgba(255,143,176,${(0.5 * Q.hurt * (0.75 + 0.25 * Math.sin(tk * 0.2))).toFixed(3)})`; c.lineWidth = 13; c.stroke(p); }
  if (armor > 0 && !flash) { c.strokeStyle = `rgba(255,211,74,${Math.min(1, armor / 8).toFixed(3)})`; c.lineWidth = 12; c.stroke(p); }
  c.fillStyle = flash ? "#ffffff" : Q.dim ? G0.d : G0.n; c.fill(p);
  if (!flash) {
    c.save(); c.clip(p);
    // the body under the head goes darker toward the water; potato eyes (dimples) on it
    if (Q.ryB > KR_RY + 20) {
      const gr = c.createLinearGradient(0, 40, 0, Q.ryB); gr.addColorStop(0, "rgba(20,10,40,0)"); gr.addColorStop(1, "rgba(20,10,40,0.55)");
      c.fillStyle = gr; c.fillRect(-KR_RX * 1.2, 40, KR_RX * 2.4, Q.ryB);
      c.strokeStyle = "rgba(30,15,50,0.55)"; c.lineWidth = 2.2;
      for (const [x, y] of [[-40, 130], [30, 160], [-10, 205]]) if (y < Q.ryB - 10) { c.beginPath(); c.arc(x, y, 6, 0.3, Math.PI - 0.3); c.stroke(); }
    }
    // wet highlights
    c.strokeStyle = KC.wet; c.lineCap = "round";
    c.lineWidth = 7; c.beginPath(); c.arc(-24, -36, 52, 3.55, 4.4); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.arc(-36, -10, 50, 2.95, 3.38); c.stroke();
    c.restore();
    for (const [x, y, r] of KR_BARN) krBarnacle(c, x, y, r);
    if (Q.body) for (const [x, y, r] of KR_BODYB) krBarnacle(c, x, y, r);
    // the freckles glow in rage
    for (const [x, y] of KR_FRECK) {
      if (Q.rage) krGlow(c, x, y, 10, 0.55 + 0.3 * Math.sin(tk * 0.2 + x), "teal");
      c.fillStyle = Q.dim ? "#5fa894" : KC.teal; c.beginPath(); c.arc(x, y, 2.1, 0, KR_TAU); c.fill();
    }
  }
  c.strokeStyle = OUT; c.lineWidth = 4; c.stroke(p);
}
// one eye (s: -1 his right, on our left; +1 the other)
function krEye(c, x, y, s, Q, tk, lx, ly, flash) {
  const r = KR_ER, kind = Q.eye;
  c.strokeStyle = OUT; c.lineCap = "round"; c.lineJoin = "round";
  if (kind === "squeeze") {   // > <
    c.lineWidth = 3.6; c.beginPath(); c.moveTo(x + s * r * 0.6, y - r * 0.55); c.lineTo(x - s * r * 0.6, y); c.lineTo(x + s * r * 0.6, y + r * 0.55); c.stroke();
    return;
  }
  if (kind === "happy") { c.lineWidth = 3.6; c.beginPath(); c.arc(x, y + r * 0.45, r * 0.72, Math.PI + 0.35, KR_TAU - 0.35); c.stroke(); return; }
  if (kind === "broken" && s < 0) { c.lineWidth = 3.2; c.beginPath(); c.moveTo(x - r * 0.8, y + 1); c.quadraticCurveTo(x, y + r * 0.45, x + r * 0.8, y + 3); c.stroke(); return; }
  const blink = kind === "open" && ((tk + (s > 0 ? 97 : 0)) % (s > 0 ? 233 : 211)) < 7;
  if (blink) { c.lineWidth = 3.2; c.beginPath(); c.arc(x, y - r * 0.2, r * 0.8, 0.35, Math.PI - 0.35); c.stroke(); return; }
  const rr = kind === "wide" ? r * 1.12 : r;
  c.fillStyle = flash ? "#ffffff" : Q.rage ? "#ffd2ca" : Q.dim ? "#c9c0d0" : KC.sclera;
  c.beginPath(); c.arc(x, y, rr, 0, KR_TAU); c.fill();
  if (kind === "spiral") {
    c.lineWidth = 2.4; c.beginPath();
    for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * 9.5 + tk * 0.2 * s, d = t * (r - 3); const px_ = x + Math.cos(a) * d, py_ = y + Math.sin(a) * d; if (i) c.lineTo(px_, py_); else c.moveTo(px_, py_); }
    c.stroke();
  } else {
    let pr = kind === "lock" ? 6.5 : kind === "wide" ? 3.6 : 8, dx = lx, dy = ly;
    if (kind === "woozy") { dx = Math.cos(tk * 0.07 + s) * 5; dy = Math.sin(tk * 0.07 + s) * 4; }
    if (kind === "broken") { dx = -3; dy = 4; }
    const lim = rr - pr - 1.5, d = Math.hypot(dx, dy);
    if (d > lim) { dx *= lim / d; dy *= lim / d; }
    const px_ = x + dx, py_ = y + dy;
    if (Q.rage && !flash) krGlow(c, px_, py_, pr * 2.6, 0.7, "red");
    c.fillStyle = flash ? "#ffffff" : Q.rage ? "#8a1010" : OUT; c.beginPath(); c.arc(px_, py_, pr, 0, KR_TAU); c.fill();
    if (Q.rage && !flash) { c.strokeStyle = KC.rage; c.lineWidth = 2; c.beginPath(); c.arc(px_, py_, pr + 1.2, 0, KR_TAU); c.stroke(); }
    c.fillStyle = KC.teal; c.beginPath(); c.arc(px_ - pr * 0.36, py_ - pr * 0.38, Math.max(1.2, pr * 0.3), 0, KR_TAU); c.fill();
    // the purple lid over the top (more or less of it)
    const lid = kind === "lock" ? 0.12 : kind === "woozy" ? 0.5 : kind === "broken" ? 0.62 : kind === "wide" ? 0 : Q.lid;
    if (lid > 0) {
      const ly2 = y - rr + 2 * rr * lid, hw = Math.sqrt(Math.max(0, rr * rr - (ly2 - y) * (ly2 - y)));
      c.save(); c.beginPath(); c.arc(x, y, rr, 0, KR_TAU); c.clip();
      c.fillStyle = flash ? "#ffffff" : Q.dim ? KC.dim : KC.body; c.fillRect(x - rr - 1, y - rr - 1, rr * 2 + 2, ly2 - (y - rr) + 1);
      c.restore();
      c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - hw, ly2); c.quadraticCurveTo(x, ly2 + 2.5, x + hw, ly2); c.stroke();
    }
  }
  c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.arc(x, y, rr, 0, KR_TAU); c.stroke();
}
function krTeeth(c, xs, y, h, up) {
  c.fillStyle = KC.teeth; c.strokeStyle = OUT; c.lineWidth = 1.4;
  for (const x of xs) { c.beginPath(); c.moveTo(x - h * 0.55, y); c.lineTo(x, y + (up ? -h : h)); c.lineTo(x + h * 0.55, y); c.closePath(); c.fill(); c.stroke(); }
}
function krMouth(c, Q, tk, flash) {
  const y = KR_MY, k = Q.mouth;
  c.strokeStyle = OUT; c.lineJoin = "round"; c.lineCap = "round";
  const maw = flash ? "#ffffff" : KC.maw;
  if (k === "closed" || k === "grin" || k === "chew" || k === "lick") {
    const w = k === "chew" ? 38 : 50, up = k === "grin" ? 10 : k === "lick" ? 7 : 4, wob = k === "chew" ? Math.sin(tk * 0.9) * 4 : 0;
    const P = [[-w, y - up], [-w / 2, y + 1], [0, y + 2], [w / 2, y + 1], [w, y - up]];
    c.lineWidth = 3.6; c.beginPath(); c.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) c.quadraticCurveTo((P[i - 1][0] + P[i][0]) / 2, (P[i - 1][1] + P[i][1]) / 2 + (i % 2 ? 5 : -3) + wob * (i % 2 ? 1 : -1), P[i][0], P[i][1]);
    c.stroke();
    if (k === "grin") krTeeth(c, [20], y + 1, 7, false);
    if (k === "lick") {
      const lx = lerp(-38, 38, ease(clamp(Q.lick * 1.3, 0, 1)));
      c.fillStyle = flash ? "#ffffff" : KC.tongue; c.lineWidth = 2; c.beginPath(); c.ellipse(lx, y + 2, 12, 7.5, 0, 0, Math.PI); c.fill(); c.stroke();
      c.strokeStyle = "rgba(17,16,28,0.4)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(lx, y + 3); c.lineTo(lx, y + 8); c.stroke();
    }
    return;
  }
  if (k === "puff" || k === "ptoo") {
    const r = k === "puff" ? 6.5 : 12;
    c.fillStyle = maw; c.beginPath(); c.arc(0, y, r, 0, KR_TAU); c.fill();
    c.strokeStyle = flash ? "#ffffff" : KC.hi; c.lineWidth = 4; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.arc(0, y, r + 2.4, 0, KR_TAU); c.stroke();
    return;
  }
  if (k === "slack") {
    c.lineWidth = 3.4; c.beginPath(); c.moveTo(-38, y - 2); c.quadraticCurveTo(-4, y + 4, 30, y + 10); c.stroke();
    c.fillStyle = flash ? "#ffffff" : KC.tongue; c.lineWidth = 1.8; c.beginPath(); c.ellipse(24, y + 12, 6, 4.5, 0.4, 0, Math.PI); c.fill(); c.stroke();
    return;
  }
  // open mouths: a maw, a tongue in it, teeth
  let cx = 0, cy = y + 4, rx = 30, ry = 12, tongueOut = 0;
  if (k === "open") { rx = 30 + 16 * Q.mo; ry = 6 + 24 * Q.mo; }
  else if (k === "gape") { cy = 34; rx = 52; ry = 40; }
  else if (k === "tongue") { rx = 20; ry = 9; tongueOut = 1; }
  else if (k === "pant") { rx = 22; ry = 9 + 2 * Math.sin(tk * 0.15); tongueOut = 0.5; }
  else if (k === "scream") { rx = 22; ry = 32; }
  c.fillStyle = maw; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, KR_TAU); c.fill();
  if (!flash) {
    c.save(); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, KR_TAU); c.clip();
    if (ry > 18) { c.fillStyle = KC.throat; c.beginPath(); c.ellipse(cx, cy - ry * 0.15, rx * 0.5, ry * 0.45, 0, 0, KR_TAU); c.fill(); }
    c.fillStyle = KC.tongue; c.beginPath(); c.ellipse(cx, cy + ry * 0.7, rx * 0.62, ry * 0.5, 0, 0, KR_TAU); c.fill();
    c.strokeStyle = "rgba(17,16,28,0.4)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx, cy + ry * 0.35); c.lineTo(cx, cy + ry * 0.75); c.stroke();
    if (ry > 8) {
      const tx = [-0.62, -0.24, 0.24, 0.62].map((q) => cx + q * rx * 0.95);
      krTeeth(c, tx, cy - ry - 1, Math.min(10, ry * 0.42), false);
      if (k === "gape" || k === "scream") krTeeth(c, [-0.45, 0, 0.45].map((q) => cx + q * rx), cy + ry + 1, Math.min(9, ry * 0.3), true);
    }
    c.restore();
  }
  c.strokeStyle = OUT; c.lineWidth = 3.4; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, KR_TAU); c.stroke();
  if (tongueOut) {   // the tongue hanging out at the side, wobbling
    const wv = Math.sin(tk * 0.18) * 0.15, L = 20 * tongueOut + 6;
    c.save(); c.translate(cx + rx * 0.35, cy + ry * 0.55); c.rotate(0.35 + wv);
    c.fillStyle = flash ? "#ffffff" : KC.tongue; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-7, 0); c.lineTo(-7, L); c.arc(0, L, 7, Math.PI, 0, true); c.lineTo(7, 0); c.fill(); c.stroke();
    c.strokeStyle = "rgba(17,16,28,0.4)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 3); c.lineTo(0, L); c.stroke();
    c.restore();
  }
}
function krFace(c, Q, tk, flash, hx, hy) {
  // where the pupils look: at a world point, or a little down and to the pier
  let lx = -3, ly = 2;
  if (Q.at) { const dx = Q.at[0] - hx, dy = Q.at[1] - (hy + KR_EY * Q.sy); const d = Math.hypot(dx, dy) || 1; lx = (dx / d) * 6; ly = (dy / d) * 5; }
  // the cheeks: bulging purple-black (Ink Spray), round (chewing)
  if (Q.cheek > 0 && !flash) {
    for (const s of [-1, 1]) {
      c.fillStyle = Q.mouth === "chew" ? "rgba(58,31,85,0.45)" : `rgba(26,16,48,${(0.6 * Q.cheek).toFixed(3)})`;
      c.beginPath(); c.ellipse(s * 58, 22, 18 + 10 * Q.cheek, 12 + 8 * Q.cheek, 0, 0, KR_TAU); c.fill();
    }
  }
  for (const s of [-1, 1]) krEye(c, s * KR_EX, KR_EY, s, Q, tk, lx, ly, flash);
  krMouth(c, Q, tk, flash);
}
// stars round his head (stagger, the puppet)
function krStars(c, x, y, tk) {
  for (let i = 0; i < 3; i++) {
    const a = tk * 0.08 + (i * KR_TAU) / 3, sx = x + Math.cos(a) * 52, sy = y + Math.sin(a) * 11;
    star4(c, sx, sy, 9, OUT); star4(c, sx, sy, 6.5, "#ffe9a0");
  }
}
// the seagull on his crown (sitting) or flying (flap: wing phase), d = the way it faces
function krGull(c, x, y, s, fly, flap, d) {
  c.save(); c.translate(x, y); c.scale(s * d, s);
  c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = OUT; c.lineWidth = 1.5;
  if (!fly) { c.strokeStyle = KC.beak; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-2, -5); c.lineTo(-3, 0); c.moveTo(2, -5); c.lineTo(3, 0); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.5; }
  c.fillStyle = "#d8d4cc"; c.beginPath(); c.moveTo(-8, -11); c.lineTo(-16, -14); c.lineTo(-15, -8); c.closePath(); c.fill(); c.stroke();
  if (fly) {   // the far wing
    const a = Math.sin(flap);
    c.fillStyle = "#c9c6c0"; c.beginPath(); c.moveTo(-3, -12); c.quadraticCurveTo(-2, -20 - 8 * a, 4, -26 * a - 4); c.lineTo(3, -11); c.closePath(); c.fill(); c.stroke();
  }
  c.fillStyle = KC.gull; c.beginPath(); c.ellipse(0, -10, 10, 6.2, 0, 0, KR_TAU); c.fill(); c.stroke();
  if (fly) {
    const a = Math.sin(flap);
    c.fillStyle = KC.gull; c.beginPath(); c.moveTo(-4, -11); c.quadraticCurveTo(-6, -18 - 10 * a, -2, -30 * a - 2); c.quadraticCurveTo(2, -16 - 6 * a, 4, -10); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#3a3f4a"; c.beginPath(); c.arc(-2, -30 * a - 2, 2.2, 0, KR_TAU); c.fill();
  } else { c.fillStyle = KC.gullW; c.beginPath(); c.ellipse(-3, -10.5, 7.5, 3.8, -0.15, 0, KR_TAU); c.fill(); c.stroke(); c.fillStyle = "#3a3f4a"; c.beginPath(); c.ellipse(-9, -10, 2.4, 1.8, -0.2, 0, KR_TAU); c.fill(); }
  c.fillStyle = KC.gull; c.beginPath(); c.arc(8, -16, 4.8, 0, KR_TAU); c.fill(); c.stroke();
  c.fillStyle = OUT; c.beginPath(); c.arc(9.4, -17, 1, 0, KR_TAU); c.fill();
  c.fillStyle = KC.beak; c.lineWidth = 1; c.beginPath(); c.moveTo(12, -17.2); c.lineTo(18, -15.6); c.lineTo(12, -14.4); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
// tentacles on the deck round the lying head: draped over the front lip (the puppet: lying flat round him)
function krDrape(c, hx, y, Q, tk, flash, puppet) {
  for (const s of [-1, 1]) {
    const sw = Math.sin(tk * 0.05 + s) * 0.06;
    const pts = puppet ? krSpine(hx + s * 58 * Q.sx, y - 8, s > 0 ? 0.05 : Math.PI - 0.05, 112, 12, s * 0.15, -s * 1.5, 0, 0)
      : krSpine(hx + s * 64 * Q.sx, y - 8, (s > 0 ? -0.1 : Math.PI + 0.1) + sw, 118, 12, s * 1.55, s * 0.5, 0.3, tk * 0.06 + s);
    krTent(c, pts, 34, 11, { suck: s, dim: Q.dim, flash, hurt: Q.hurt * 0.6 });
  }
}
// the foam collar where his body goes into the water; ripples, bubbles (boiling in rage), the Ink Spray's dark ring
function krCollar(c, f, Q, hx, tk) {
  const S = STAGE.main, bot = Q.y + Q.bob + Q.rise + (Q.ryB - KR_RY) * Q.sy;
  if (bot < KR_SEA_Y - 2) return;
  const w = KR_RX * Q.sx * 1.1 + 4, P = krPhase(f);
  if (P && P.key === "ink" && P.ph === 0) {   // the water darkens round him
    const k = ease(P.k);
    c.fillStyle = `rgba(26,16,48,${(0.5 * k).toFixed(3)})`; c.beginPath(); c.ellipse(hx, KR_SEA_Y + 2, w + 70 * k, 10 + 6 * k, 0, 0, KR_TAU); c.fill();
  }
  // ripples spreading (the front half: the back is behind him)
  for (let i = 0; i < 2; i++) {
    const q = ((tk + i * 45) % 90) / 90;
    c.strokeStyle = `rgba(191,232,224,${(0.45 * (1 - q)).toFixed(3)})`; c.lineWidth = 2;
    c.beginPath(); c.ellipse(hx, KR_SEA_Y, w + 70 * q, 8 + 8 * q, 0, 0.05, Math.PI - 0.05); c.stroke();
  }
  c.strokeStyle = "rgba(191,232,224,0.75)"; c.lineWidth = 3.5; c.beginPath(); c.ellipse(hx, KR_SEA_Y, w, 8, 0, 0.1, Math.PI - 0.1); c.stroke();
  c.fillStyle = KC.foam;
  for (let i = 0; i < 9; i++) {
    const a = 0.2 + (i / 8) * (Math.PI - 0.4), b = Math.sin(tk * 0.1 + i * 1.3) * 1.2;
    c.beginPath(); c.arc(hx + Math.cos(a) * w, KR_SEA_Y + Math.sin(a) * 8 + b, 3 + (i % 3), 0, KR_TAU); c.fill();
  }
  // bubbles popping (boiling in rage)
  const nb = Q.rage ? 7 : 3;
  c.strokeStyle = "rgba(191,232,224,0.8)"; c.lineWidth = 1.4;
  for (let i = 0; i < nb; i++) {
    const per = Q.rage ? 24 : 50, q = ((tk + i * 17) % per) / per, x = hx + (nz(i * 7.3 + Math.floor((tk + i * 17) / per)) - 0.5) * w * 2.4, r = (Q.rage ? 4 : 2.5) * (0.4 + q);
    c.beginPath(); c.arc(x, KR_SEA_Y + 3 - q * 4, r, 0, KR_TAU); c.stroke();
  }
}
// the Wave's tell: a swell rising past the right ledge, a water wall with a foam crest growing to 90 over the deck
function krSwell(c, f, tk) {
  const P = krPhase(f);
  if (!P || P.key !== "wave" || P.ph !== 0) return;
  const S = STAGE.main, k = ease(P.k), x = S.x2 + 45, top = KR_SEA_Y - (KR_SEA_Y + 90) * k, w = 30 + 30 * k;
  c.save();
  c.beginPath(); c.rect(S.x2, -1e4, 1e4, 2e4); c.rect(-1e4, -1e4, 2e4, 1e4 + S.top); c.clip();
  c.beginPath(); c.moveTo(x - w * 1.7, KR_SEA_Y + 2);
  c.quadraticCurveTo(x - w * 0.9, top + (KR_SEA_Y - top) * 0.2, x - w * 0.15, top);
  c.quadraticCurveTo(x + w * 0.8, top + 6, x + w * 1.8, KR_SEA_Y + 2);
  c.closePath();
  const gr = c.createLinearGradient(0, top, 0, KR_SEA_Y); gr.addColorStop(0, "rgba(120,200,215,0.82)"); gr.addColorStop(1, "rgba(60,140,170,0.75)");
  c.fillStyle = gr; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
  // light streaks and the foam crest
  c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const yy = top + (KR_SEA_Y - top) * (0.3 + i * 0.2); c.beginPath(); c.moveTo(x - w * 0.6 + i * 6, yy); c.lineTo(x + w * 0.3 + i * 6, yy - 6); c.stroke(); }
  c.strokeStyle = KC.foam; c.lineWidth = 5; c.beginPath(); c.moveTo(x - w * 0.75, top + (KR_SEA_Y - top) * 0.08); c.quadraticCurveTo(x - w * 0.15, top - 4, x + w * 0.5, top + 6); c.stroke();
  c.fillStyle = KC.foam;
  for (let i = 0; i < 6; i++) { const q = i / 5, bx = lerp(x - w * 0.7, x + w * 0.45, q), by = top + 2 + Math.sin(q * Math.PI) * -4 + Math.sin(tk * 0.3 + i) * 1.5; c.beginPath(); c.arc(bx, by, 3 + (i % 2) * 1.5, 0, KR_TAU); c.fill(); }
  c.restore();
}

/* ---- draw: the fighter (or the KO page's puppet with `at`) ---- */
function krDraw(c, f, tk, at) {
  const Q = krLook(f, tk, at), flash = f.flash > 0 && f.flash % 2 === 0 && !f.doomed, S = STAGE.main, puppet = !!at && f.state === "fin";   // launched out: no white flash, the reveal is the point
  const hx = Q.x + Q.shake, hy = Q.y + Q.bob + Q.rise - KR_RY * Q.sy * Q.swell;   // the head's centre
  c.save();
  try {
    c.lineCap = "round"; c.lineJoin = "round";
    if (Q.drape > 0.6) krDrape(c, hx, Q.y, Q, tk, flash, puppet);
    if (Q.clip) {   // under the deck, and under the water past the ledge, nothing of him shows
      c.save(); c.beginPath(); c.rect(-1e4, -1e4, S.x2 + 2 + 1e4, 1e4 + S.top + 2); c.rect(S.x2 + 2, -1e4, 1e4, 1e4 + KR_SEA_Y); c.clip();
    }
    c.save(); c.translate(hx, hy); if (Q.rot) c.rotate(Q.rot); c.scale(Q.sx * Q.swell, Q.sy * Q.swell);
    krBody(c, Q, tk, flash, f.armorFlash || 0);
    krFace(c, Q, tk, flash, hx, hy);
    c.restore();
    if (Q.clip) c.restore();
    if (Q.clip && Q.deck < 0.9) krCollar(c, f, Q, hx, tk);
    const crown = [hx + 14 * Q.sx, hy - KR_RY * Q.sy * Q.swell + 4];
    if (Q.stars) krStars(c, hx, crown[1] - 14, tk);
    // the seagull: on his crown, or flying off (every move) and back
    if (puppet) krGull(c, crown[0] + 8, crown[1] + 1, 1.1, false, 0, -1);
    else if (!at && !f.doomed) krGullAt(c, crown, Q, tk);
    if (!at) {
      krSwell(c, f, tk);
      // Ink Spray, until render2D calls BOSS_ART.kraken.screen: the blots from here, in screen space
      if (KI.list.length && KI.frame - KI.scr > 1 && RG === G) { c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0); krInkDraw(c); c.restore(); }
    }
  } finally { c.restore(); }
}
function krGullAt(c, crown, Q, tk) {
  const g = KR.gull;
  if (g.s === "sit") { KR.crown = crown; if (Q.deck < 0.2) krGull(c, crown[0], crown[1] + 1, 1.15, false, 0, -1); return; }
  if (g.s === "off") {
    const k = (tk - g.t) / 90, x = g.x0 - 420 * k, y = g.y0 - 60 * Math.sin(k * 3) - 380 * k * k;
    if (k <= 1) krGull(c, x, y, 1.15, true, tk * 0.6, -1);
    return;
  }
  if (g.s === "in") {
    KR.crown = crown;
    const k = clamp((tk - g.t) / 50, 0, 1), e = 1 - (1 - k) * (1 - k), x = lerp(crown[0] + 360, crown[0], e), y = lerp(crown[1] - 300, crown[1] + 1, e) - Math.sin(k * Math.PI) * 30;
    krGull(c, x, y, 1.15, k < 0.92, tk * 0.6, -1);
  }
}

/* ---- behind the pier (world space, from the map's stage() before the jetty): the far tentacles, the slams' arches, the Sweep's tentacle ---- */
function krBehind(c, g, f, tk) {
  if (!g || !f) return;
  krSync(g, f, tk);
  if (f.doomed || f.state === "dead" || f.state === "gone") return;
  const S = STAGE.main, P = krPhase(f), lv = clamp(g.lv | 0, 0, 2);
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath(); c.rect(-1e4, -1e4, 2e4, 1e4 + KR_SEA_Y); c.clip();   // nothing of him under the water
  krFar(c, f, P, tk);
  if (P && P.key === "slam") {
    const { mt, m } = P;
    krArch(c, clamp(f.bx, S.x1 + 30, S.x2 - 30), mt / m.startup, tk, 0, f);
    if (f.bk < 1e4 && mt >= m.pairT) krArch(c, clamp(f.bk, S.x1 + 30, S.x2 - 30), (mt - m.pairT) / m.startup, tk, 1, f);
  }
  if (P && P.key === "sweep") {
    if (P.ph === 0) krRiser(c, 1, P.k, tk);
    if (f.spec.boss.sweepN[lv] > 1 && P.mt >= P.a0 - 12 && P.mt < P.a0 + 30) krRiser(c, -1, (P.mt - (P.a0 - 12)) / 42, tk);
  }
  c.restore();
}
// the two far tentacles past the right ledge: swaying (±0.15 rad, 3 s; faster in rage), slapping the water twice in the Wave's tell, limp when the head is on the deck
function krFar(c, f, P, tk) {
  const H = krSea(f), rage = krRage(f), kd = krDeckK(f), rise = krRise(), per = rage ? 100 : 180;
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1, bx = H.x + (i ? 112 : -90), by = KR_SEA_Y + 40 + rise;
    let a = -Math.PI / 2 + (i ? 0.25 : -0.16) + 0.15 * Math.sin((tk / per) * KR_TAU + i * 1.7), len = i ? 190 : 200, bend = i ? 0.5 : 0.3, curl = i ? 1.9 : 1.7, wig = rage ? 1.1 : 0.45;
    if (P && P.key === "wave" && P.ph === 0) a += s * krSlap(P.mt);
    if (kd > 0.5 || f.state === "broken") { a = -Math.PI / 2 + s * (f.state === "broken" ? 1.3 : 0.9); len = 170; bend = s * 0.7; curl = s * 0.4; wig = 0.12; }
    const pts = krSpine(bx, by, a, len, 14, bend, curl, wig, tk * 0.1 + i * 2);
    krTent(c, pts, 42, 12, { suck: bend + curl >= 0 ? 1 : -1, dim: f.state === "broken" });
    krRing(c, pts, tk);
  }
}
// the slap in the Wave's tell (two, 20 frames apart): raise, then smash down to the outside
function krSlap(mt) {
  let off = 0;
  for (const c0 of [16, 36]) {
    const d = mt - c0;
    if (d >= -12 && d < 0) off = -0.55 * ((d + 12) / 12);
    else if (d >= 0 && d < 12) off = 1.5 * (1 - d / 12);
  }
  return off;
}
// foam where a tentacle goes into the water (its spine crossing the water line)
function krRing(c, pts, tk) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if ((y0 - KR_SEA_Y) * (y1 - KR_SEA_Y) > 0) continue;
    const q = (KR_SEA_Y - y0) / (y1 - y0 || 1), x = x0 + (x1 - x0) * q, w = 24 + Math.sin(tk * 0.12 + x) * 2;
    c.strokeStyle = "rgba(191,232,224,0.7)"; c.lineWidth = 3; c.beginPath(); c.ellipse(x, KR_SEA_Y - 1, w, 5, 0, 0.1, Math.PI - 0.1); c.stroke();
    c.fillStyle = KC.foam; for (const dx of [-w, -w * 0.4, w * 0.3, w]) { c.beginPath(); c.arc(x + dx, KR_SEA_Y + 1, 2.6, 0, KR_TAU); c.fill(); }
    return;
  }
}
// a slam's tentacle rising from behind the deck and arching over the spot (k: through the tell; i: first or second of a pair)
function krArch(c, x, k, tk, i, f) {
  if (k <= 0 || k > 1.02) return;
  const e = ease(Math.min(1, k)), len = 110 + 240 * e, d = x > 0 ? 1 : -1;   // it comes from the far side of the spot (away from the middle)
  const pts = krSpine(x + d * 96, 74, -Math.PI / 2 - d * 0.08, len, 16, 0, -d * (0.8 + 1.7 * e), 0.35, tk * 0.15 + i * 2);
  krTent(c, pts, 40, 13, { suck: -d, gold: 0 });
  // drips off it (the particles: krTick)
  KR.archTip[i] = pts[pts.length - 1];
}
// the Sweep's tentacle rising past its ledge (dir 1: the left ledge, sweeping right) to y -240, dripping, its tip curling into a hook
function krRiser(c, dir, k, tk) {
  if (k <= 0) return;
  const S = STAGE.main, e = ease(clamp(k, 0, 1)), bx = dir > 0 ? S.x1 - 48 : S.x2 + 48;
  const pts = krSpine(bx, KR_SEA_Y + 30, -Math.PI / 2 + dir * 0.06, 60 + 330 * e, 16, dir * 0.05, dir * (0.5 + 1.5 * e), 0.4, tk * 0.15);
  krTent(c, pts, 42, 13, { suck: dir });
  krRing(c, pts, tk);
  KR.riserTip = pts[pts.length - 1];
}

/* ---- his projectiles (world space): the tentacle left by a slam, the slam's splash, the Sweep, the Wave ---- */
function krProj(c, p, tk) {
  if (p.style === "tent") { krTentProj(c, p, tk); return true; }
  if (p.style === "slam") { krSlamProj(c, p, tk); return true; }
  if (p.style === "sweep") { krSweepBody(c, p.x, p.dir || (p.vx >= 0 ? 1 : -1), tk, 1); return true; }
  if (p.style === "wave") { krWave(c, p, tk); return true; }
  return false;
}
// the slammed tentacle standing on the deck: curled toward the nearest player, six suckers pulsing (0.6 <-> 1 every 20 f), the tip twitching,
// a pink outline (hit me now); it unrolls over 6 frames and sinks back over the last 12
function krTentProj(c, p, tk) {
  let st = KR_TD.get(p);
  const foe = krFoe(p.x);
  if (!st) { st = { d: foe ? (foe.x >= p.x ? 1 : -1) : -1 }; st.dv = st.d; KR_TD.set(p, st); }
  if (foe) st.d = foe.x >= p.x ? 1 : -1;
  st.dv += (st.d - st.dv) * 0.06;
  const t = p.t, inK = clamp(t / 6, 0, 1), outK = clamp((t - (p.life - 12)) / 12, 0, 1), dv = clamp(st.dv, -1, 1), sd = dv >= 0 ? 1 : -1;
  const len = 132 * (0.4 + 0.6 * easeOut2(inK)), sink = 140 * ease(outK);
  const tw = (((Math.floor(tk + p.x) % 50) + 50) % 50) < 7 ? Math.sin(tk * 1.6) * 0.9 : 0.25;   // the tip twitches now and then
  const pts = krSpine(p.x - dv * 10, p.y + 6 + sink, -Math.PI / 2, len, 14, dv * 0.3, dv * (2.8 - 1.2 * (1 - inK)), tw, tk * 0.14 + p.x);
  const o = RG && RG.fighters[p.owner], flash = !!o && o.flash > 0 && o.flash % 2 === 0;
  c.save();
  c.fillStyle = "rgba(191,232,224,0.3)"; c.beginPath(); c.ellipse(p.x, p.y + 1, 34 * (1 - outK), 5, 0, 0, KR_TAU); c.fill();   // the puddle round its foot
  c.beginPath(); c.rect(p.x - 300, p.y - 400, 600, 400 + 3); c.clip();
  krTent(c, pts, 40, 12, { suck: sd, pulse: 0.8 + 0.2 * Math.cos((t / 20) * Math.PI), hurt: outK > 0 ? 0 : 0.75 + 0.25 * Math.sin(tk * 0.25), flash, dim: !!o && o.state === "broken" });
  c.restore();
  // a wet sheen of foam where it slapped down (first frames)
  if (t < 10) { c.globalAlpha = 1 - t / 10; c.strokeStyle = KC.foam; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y + 1, 40 + t * 4, 6 + t * 0.4, 0, 0, KR_TAU); c.stroke(); c.globalAlpha = 1; }
}
// the slam's hit (6 frames): the tip comes down in a burst of foam
function krSlamProj(c, p, tk) {
  const k = clamp(p.t / Math.max(1, p.life), 0, 1), fy = STAGE.main.top;
  krGlow(c, p.x, fy - 20, 70, 0.6 * (1 - k), "white");
  c.fillStyle = `rgba(191,232,224,${(0.85 * (1 - k)).toFixed(3)})`;
  for (let i = 0; i < 7; i++) {   // a crown of foam tongues
    const a = -Math.PI / 2 + (i - 3) * 0.32, h = (34 + (i % 2) * 16) * Math.sin(Math.min(1, k * 1.6 + 0.2) * Math.PI), bx = p.x + (i - 3) * 9;
    c.beginPath(); c.moveTo(bx - 5, fy); c.quadraticCurveTo(bx + Math.cos(a) * h * 0.4, fy + Math.sin(a) * h * 0.6, bx + Math.cos(a) * h, fy + Math.sin(a) * h); c.quadraticCurveTo(bx + 2, fy - h * 0.3, bx + 5, fy); c.closePath(); c.fill();
  }
}
// the Sweep's tentacle: up out of the water past its ledge, over the lip, lying along the deck to the hooked tip at x (alpha a)
function krSweepBody(c, x, dir, tk, a) {
  const S = STAGE.main, ex = dir > 0 ? S.x1 : S.x2, bx = ex - dir * 44, y = S.top - 15;
  const pts = [];
  const p0 = [bx, KR_SEA_Y + 30], c0 = [bx, y], p1 = [ex + dir * 34, y];
  for (let i = 0; i <= 7; i++) { const t = i / 7, u = 1 - t; pts.push([u * u * p0[0] + 2 * u * t * c0[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c0[1] + t * t * p1[1]]); }
  const end = x - dir * 34;
  let hx = p1[0];
  if ((end - p1[0]) * dir > 0) {
    const n = Math.max(1, Math.round(Math.abs(end - p1[0]) / 40));
    for (let i = 1; i <= n; i++) { const xx = p1[0] + ((end - p1[0]) * i) / n; pts.push([xx, y + Math.sin(tk * 0.35 - xx * 0.05) * 2.5]); }
    hx = end;
  }
  const last = pts[pts.length - 1], hook = krSpine(last[0], last[1], dir > 0 ? 0 : Math.PI, 66, 7, 0, -dir * 3.1, 0.25, tk * 0.3);
  for (let i = 1; i < hook.length; i++) pts.push(hook[i]);
  c.save();
  c.beginPath(); c.rect(-1e4, -1e4, 2e4, 1e4 + KR_SEA_Y); c.clip();
  krTent(c, pts, 46, 14, { suck: dir, a });
  c.restore();
  krRing(c, pts, tk);
  return hx;
}
// the Wave: a water wall (p.w tall, 90 wide) rolling right to left, its crest curling forward, foam on top
function krWave(c, p, tk) {
  const S = STAGE.main, d = Math.sign(p.vx) || -1, r = p.r || 45, G0 = krGrads(c);
  const h = (p.w || 60) * clamp(p.t / 8, 0.25, 1) * (1 + 0.04 * Math.sin(tk * 0.4)), x = p.x, y = S.top;
  // past a ledge the water runs on down to the sea
  const x0 = Math.min(x + d * (r + 8), x - d * (r + 46)), x1 = Math.max(x + d * (r + 8), x - d * (r + 46));
  if (x1 > S.x2 || x0 < S.x1) {
    c.save(); c.beginPath(); c.rect(S.x2, y - 2, 1e4, KR_SEA_Y - y + 2); c.rect(-1e4, y - 2, 1e4 + S.x1, KR_SEA_Y - y + 2); c.clip();
    c.fillStyle = "rgba(50,130,165,0.6)"; c.fillRect(x0 + 6, y - 2, x1 - x0 - 12, KR_SEA_Y - y + 2);
    c.fillStyle = "rgba(191,232,224,0.5)"; for (let i = 0; i < 3; i++) c.fillRect(x0 + 10 + i * 24, y + ((tk * 2 + i * 31) % (KR_SEA_Y - y)), 3, 10);
    c.restore();
    c.strokeStyle = "rgba(191,232,224,0.7)"; c.lineWidth = 3; c.beginPath(); c.ellipse((x0 + x1) / 2, KR_SEA_Y, (x1 - x0) / 2 + 10, 6, 0, 0.1, Math.PI - 0.1); c.stroke();
  }
  c.save(); c.translate(x, y); c.scale(d, 1);
  c.lineJoin = "round"; c.lineCap = "round";
  const wall = new Path2D();
  wall.moveTo(-r - 46, 0);
  wall.quadraticCurveTo(-r, -h * 0.15, -r * 0.35, -h * 0.82);
  wall.quadraticCurveTo(0, -h * 1.1, r * 0.55, -h);
  wall.quadraticCurveTo(r * 1.12, -h * 0.9, r * 0.98, -h * 0.58);
  wall.quadraticCurveTo(r * 0.72, -h * 0.66, r * 0.7, -h * 0.46);
  wall.quadraticCurveTo(r * 0.88, -h * 0.18, r + 8, 0);
  wall.closePath();
  c.fillStyle = G0.wa; c.fill(wall);
  c.save(); c.clip(wall);
  c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { const yy = -h * (0.18 + i * 0.17), off = ((tk * 2 + i * 23) % 40) - 20; c.beginPath(); c.moveTo(-r * 0.7 + off, yy + 4); c.quadraticCurveTo(off, yy - 5, r * 0.4 + off, yy + 2); c.stroke(); }
  c.fillStyle = "rgba(20,60,90,0.35)"; c.beginPath(); c.ellipse(r * 0.55, -h * 0.5, r * 0.28, h * 0.16, 0, 0, KR_TAU); c.fill();   // under the curl
  c.restore();
  c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke(wall);
  // the foam crest along the top and over the curl
  c.strokeStyle = KC.foam; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-r * 0.4, -h * 0.84); c.quadraticCurveTo(0, -h * 1.08, r * 0.55, -h * 0.99); c.quadraticCurveTo(r * 1.06, -h * 0.88, r * 0.95, -h * 0.62); c.stroke();
  c.fillStyle = KC.foam;
  for (let i = 0; i < 8; i++) {
    const q = i / 7, fx = lerp(-r * 0.5, r * 0.95, q), fy = -h * (0.86 + 0.18 * Math.sin(q * Math.PI)) + (q > 0.8 ? (q - 0.8) * h * 1.2 : 0) + Math.sin(tk * 0.4 + i * 1.7) * 2;
    c.beginPath(); c.arc(fx, fy, 3.2 + (i % 3) * 1.2, 0, KR_TAU); c.fill();
  }
  // froth at its foot, running ahead
  for (let i = 0; i < 5; i++) { const fx = r + 4 - ((tk * 3 + i * 11) % 40), fy = -2 - (i % 2) * 2; c.beginPath(); c.arc(fx, fy, 2.6, 0, KR_TAU); c.fill(); }
  c.restore();
}

/* ---- per game UI state: cues played (by move instance), splashes, limp tentacles, the Sweep's retreat, the seagull, Ink Spray ---- */
const KR = { g: null, tk: -1, cues: new Set(), spl: [], ghosts: [], sweeps: [], tentsNow: [], beat: 0, hop0: -999, lick: -999, lickY: -60, flopT: -999, downT: -999, downX: 0,
  gull: { s: "sit", t: 0, x0: 0, y0: 0 }, crown: [470, -220], archTip: [null, null], riserTip: null, bub: 0 };
function krReset(g) {
  KR.g = g; KR.tk = -1; KR.cues.clear(); KR.spl.length = 0; KR.ghosts.length = 0; KR.sweeps.length = 0; KR.tentsNow = []; KR.beat = 0;
  KR.hop0 = KR.lick = KR.flopT = KR.downT = -999; KR.gull.s = "gone"; KR.gull.t = tick; KR.archTip = [null, null]; KR.riserTip = null; KR.bub = 0;
  KI.list.length = 0;
}
function krCue(f, name) { const k = f.moveT + "." + f.mid + "." + name; if (KR.cues.has(k)) return false; KR.cues.add(k); if (KR.cues.size > 400) KR.cues.clear(); return true; }
function krSync(g, f, tk) { if (KR.g !== g) krReset(g); if (tk !== KR.tk) { KR.tk = tk; krTick(g, f, tk); } }
// the crates and pots hop when he is launched out (maps/deep.js adds this to their y)
function krHop() { const t = tick - KR.hop0; return t < 0 || t > 50 ? 0 : -Math.abs(Math.sin(t * 0.3)) * 10 * Math.exp(-t / 15); }
const krDrop = (x, y, vx, vy, col) => addFx({ k: "mote", x, y, vx, vy, col: col || KC.foam, r: 1.6 + Math.random() * 1.4, t: 0, life: 26 + Math.random() * 10, g: 0.28, damp: 0.98 });
function krSplash(x, y, n, big) {
  KR.spl.push({ x, y, t0: tick, big: !!big });
  if (KR.spl.length > 14) KR.spl.shift();
  for (let i = 0; i < n; i++) krDrop(x + (Math.random() - 0.5) * 30, y - 2, (Math.random() - 0.5) * (big ? 7 : 4), -2 - Math.random() * (big ? 7 : 4), i % 4 ? KC.foam : "#7fd8e8");
}

/* ---- floor: his tells on the floor (world space, after the stage, under the fighters) ---- */
function krFloor(c, g, f, tk) {
  krSync(g, f, tk);
  KI.frame++;
  krInkGate(g);
  if (STAGE.id !== "deep") krBehind(c, g, f, tk);   // his own map draws these before the jetty; anywhere else, here
  const S = STAGE.main, top = S.top, P = krPhase(f);
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  // splashes: a foam ring and a crown of foam tongues (slams, slaps, the head landing)
  for (const s of KR.spl) {
    const t = tk - s.t0;
    if (t < 0 || t > 22) continue;
    const k = Math.min(1, t / 14), rr = (s.big ? 90 : 55) * easeOut2(k), a = t < 14 ? 1 : 1 - (t - 14) / 8;
    c.globalAlpha = a * 0.85; c.strokeStyle = KC.foam; c.lineWidth = 5 * (1 - k) + 2;
    c.beginPath(); c.ellipse(s.x, s.y + 1, rr, rr * 0.18, 0, 0, KR_TAU); c.stroke();
    if (t < 12) {
      c.fillStyle = KC.foam; c.globalAlpha = 0.8 * (1 - t / 12);
      for (let i = 0; i < 6; i++) { const ox = (i - 2.5) * (s.big ? 16 : 10), h = (s.big ? 40 : 24) * Math.sin((t / 12) * Math.PI) * (0.6 + 0.4 * ((i * 7) % 3) / 2); c.beginPath(); c.ellipse(s.x + ox, s.y - h / 2, 3.5, h / 2 + 2, ox * 0.01, 0, KR_TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  // limp tentacles (a stagger or the break): falling over onto the deck and fading
  for (const q of KR.ghosts) {
    const t = tk - q.t0, k = clamp(t / 16, 0, 1), a = 1 - clamp((t - 46) / 30, 0, 1);
    if (a <= 0) continue;
    const pts = krSpine(q.x, top + 4, -Math.PI / 2 + q.d * 1.42 * easeOut2(k), 124, 12, q.d * 0.2, q.d * 0.7 * (1 - k) + q.d * 0.25, 0, 0);
    c.save(); c.beginPath(); c.rect(q.x - 400, -1e4, 800, 1e4 + top + 3); c.clip();
    krTent(c, pts, 40, 12, { suck: q.d, dim: true, a });
    c.restore();
  }
  // the Sweep's tentacle pulled back after it reached the far ledge
  for (const q of KR.sweeps) {
    const t = tk - q.t0, k = clamp(t / 18, 0, 1);
    if (k >= 1) continue;
    const back = q.dir > 0 ? S.x1 - 30 : S.x2 + 30;
    krSweepBody(c, lerp(q.x, back, ease(k)), q.dir, tk, 1 - k * k);
  }
  if (f && !f.doomed && f.state !== "dead" && f.state !== "gone" && P) {
    const { key, ph, mt, m } = P;
    if (key === "slam") {   // a foam ring at each spot: eight arcs circling, bubbles; the tentacle's shadow growing over the last 16 frames
      krFoamRing(c, clamp(f.bx, S.x1 + 30, S.x2 - 30), mt, m.startup, tk);
      if (f.bk < 1e4 && mt >= m.pairT) krFoamRing(c, clamp(f.bk, S.x1 + 30, S.x2 - 30), mt - m.pairT, m.startup, tk);
    }
    if (key === "sweep") {   // a foam line along the lip from its ledge toward the head
      if (ph === 0) krFoamLine(c, S.x1, S.x1 + (S.x2 - S.x1) * ease(P.k), top + 4, tk);
      if (f.spec.boss.sweepN[clamp(g.lv | 0, 0, 2)] > 1 && mt >= P.a0 - 12 && mt < P.a0 + 30) krFoamLine(c, S.x2, S.x2 - (S.x2 - S.x1) * ease(clamp((mt - P.a0 + 12) / 42, 0, 1)), top + 4, tk);
    }
    if (key === "chomp" && mt <= m.startup) {   // a foam line racing along the deck from the head to the target's x in 20 frames, boiling there
      const lx = clamp(f.bx, 40, 300), k = clamp(mt / 20, 0, 1);
      krFoamLine(c, S.x2, lerp(S.x2, lx, easeOut2(k)), top - 1, tk);
      if (k >= 1) {
        const pu = 1 + 0.08 * Math.sin(tk * 0.5);
        c.fillStyle = "rgba(191,232,224,0.18)"; c.beginPath(); c.ellipse(lx, top, 56 * pu, 9 * pu, 0, 0, KR_TAU); c.fill();
        c.strokeStyle = "rgba(191,232,224,0.75)"; c.lineWidth = 3; c.beginPath(); c.ellipse(lx, top, 56 * pu, 9 * pu, 0, 0, KR_TAU); c.stroke();
        c.strokeStyle = "rgba(191,232,224,0.85)"; c.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) { const q = ((tk + i * 7) % 18) / 18, bx = lx + (nz(i * 3.1 + Math.floor((tk + i * 7) / 18)) - 0.5) * 90; c.beginPath(); c.arc(bx, top - 2 - q * 8, 2 + q * 3, 0, KR_TAU); c.stroke(); }
      }
    }
  }
  c.restore();
}
function krFoamRing(c, x, mt, startup, tk) {
  if (mt < 0 || mt > startup + 1) return;
  const top = STAGE.main.top, a = clamp(mt / 6, 0, 1), q = clamp((mt - (startup - 16)) / 16, 0, 1);
  if (q > 0) { c.fillStyle = `rgba(10,8,20,${(0.38 * q).toFixed(3)})`; c.beginPath(); c.ellipse(x, top + 1, 50 * (0.4 + 0.6 * q), 8 * (0.4 + 0.6 * q), 0, 0, KR_TAU); c.fill(); }
  c.globalAlpha = a;
  c.fillStyle = "rgba(191,232,224,0.12)"; c.beginPath(); c.ellipse(x, top + 1, 60, 10, 0, 0, KR_TAU); c.fill();
  c.strokeStyle = "rgba(191,232,224,0.7)"; c.lineWidth = 3;
  for (let i = 0; i < 8; i++) { const a0 = tk * 0.08 + (i * KR_TAU) / 8; c.beginPath(); c.ellipse(x, top + 1, 60, 10, 0, a0, a0 + 0.42); c.stroke(); }
  c.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) { const p = ((tk + i * 9) % 30) / 30, bx = x + (nz(i * 5.3 + Math.floor((tk + i * 9) / 30)) - 0.5) * 80; c.beginPath(); c.arc(bx, top - p * 7, 1.8 + p * 2.2, 0, KR_TAU); c.stroke(); }
  c.globalAlpha = 1;
}
function krFoamLine(c, x0, x1, y, tk) {
  if (Math.abs(x1 - x0) < 2) return;
  c.strokeStyle = "rgba(191,232,224,0.75)"; c.lineWidth = 3; c.setLineDash([7, 6]); c.lineDashOffset = -tk * 0.8 * Math.sign(x1 - x0);
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.setLineDash([]);
  c.fillStyle = KC.foam;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x1 - Math.sign(x1 - x0) * i * 7, y + Math.sin(tk * 0.5 + i) * 1.5, 3.4 - i * 0.8, 0, KR_TAU); c.fill(); }
}

/* ---- once per UI tick: the cues of the move being played, his particles, the seagull, the rage drum ---- */
function krTick(g, f, tk) {
  const live = bsLive(g), S = STAGE.main;
  for (let i = KR.spl.length - 1; i >= 0; i--) if (tk - KR.spl[i].t0 > 24) KR.spl.splice(i, 1);
  for (let i = KR.ghosts.length - 1; i >= 0; i--) if (tk - KR.ghosts[i].t0 > 80) KR.ghosts.splice(i, 1);
  for (let i = KR.sweeps.length - 1; i >= 0; i--) if (tk - KR.sweeps[i].t0 > 20) KR.sweeps.splice(i, 1);
  if (!f) return;
  KR.tentsNow = g.projs.filter((p) => p.owner === f.slot && p.style === "tent" && !p.done).map((p) => ({ x: p.x, d: (KR_TD.get(p) || { dv: -1 }).dv >= 0 ? 1 : -1 }));
  // the seagull: off at every move (or a stagger), back once he has been at sea a while
  const gu = KR.gull, atSea = !f.doomed && f.state !== "stagger" && f.state !== "broken" && krDeckK(f) < 0.2 && (!f.move || f.mid !== "chomp");
  if (gu.s === "sit" && (f.move || !atSea || f.doomed)) { gu.s = "off"; gu.t = tk; gu.x0 = KR.crown[0]; gu.y0 = KR.crown[1]; if (live) KSND.gull(); }
  else if (gu.s === "off" && tk - gu.t > 90) { gu.s = "gone"; gu.t = tk; }
  else if (gu.s === "gone") { if (!atSea || f.doomed) gu.t = tk; else if (tk - gu.t > 100) { gu.s = "in"; gu.t = tk; } }
  else if (gu.s === "in") { if (!atSea) { gu.s = "gone"; gu.t = tk; } else if (tk - gu.t >= 50) gu.s = "sit"; }
  if (f.doomed) {   // a spray column where he went up
    const t = tk - KR.downT;
    if (t >= 0 && t < 30 && tk % 2 === 0) for (let i = 0; i < 3; i++) krDrop(KR.downX + (Math.random() - 0.5) * 60, S.top - 4, (Math.random() - 0.5) * 3, -6 - Math.random() * 8, i ? KC.foam : KC.teal);
    return;
  }
  if (f.state === "dead" || f.state === "gone") return;
  const P = krPhase(f), rage = krRage(f) && f.state !== "broken";
  // the stagger's flop: the head lands on the deck (10 frames after the stagger began)
  if (tk - KR.flopT === 9) { krSplash(f.x, S.top, 10, true); cam.shake = Math.max(cam.shake, 5); if (live) KSND.flop(); }
  if (P) {
    const { key, ph, mt, m } = P;
    if (key === "slam") {
      for (let i = 0; i < 2; i++) { const tp = KR.archTip[i]; if (tp && tk % 5 === i * 2) krDrop(tp[0], tp[1] + 4, 0, 0.5); }
      if (f.bk < 1e4 && mt >= m.pairT && krCue(f, "g2")) { if (live) KSND.gurgle(); }
      KR.archTip[0] = KR.archTip[1] = null;
    } else if (key === "sweep") {
      for (let i = 0; i < 3; i++) if (ph === 0 && mt >= i * 9 && krCue(f, "plink" + i)) { if (live) KSND.plink(i); }
      if (ph === 0 && KR.riserTip && tk % 4 === 0) krDrop(KR.riserTip[0], KR.riserTip[1] + 6, 0, 0.5);
      KR.riserTip = null;
    } else if (key === "wave") {
      for (const [c0, nm] of [[16, "s1"], [36, "s2"]]) if (ph === 0 && mt >= c0 && krCue(f, nm)) {
        const H = krSea(f);
        krSplash(H.x - 96 - 150, KR_SEA_Y, 8, false); krSplash(H.x + 112 + 150, KR_SEA_Y, 8, false);
        if (live) KSND.slap();
      }
      if (ph === 0 && mt > 20 && tk % 3 === 0) krDrop(S.x2 + 45 + (Math.random() - 0.5) * 60, KR_SEA_Y - (KR_SEA_Y + 90) * ease(P.k), (Math.random() - 0.5) * 2, -1.5 - Math.random() * 2);
      if (ph >= 1 && krCue(f, "roar")) { if (live) KSND.roar(); }
    } else if (key === "chomp") {
      const lt = m.startup - m.lunge;
      if (mt > lt && krCue(f, "lunge")) { if (live) KSND.lunge(); }
      if (mt > m.startup && krCue(f, "land")) { krSplash(clamp(f.bx, 40, 300), S.top, 12, true); cam.shake = Math.max(cam.shake, 5); }
      if (f.ph === 1 && tk % 40 === 0) { krDrop(f.x + (Math.random() - 0.5) * 120, S.top - 60, (Math.random() - 0.5) * 2, -1); if (live) KSND.bubble(); }
      if (mt > P.a1 + m.endlag - m.slide && krCue(f, "slide")) { if (live) KSND.squelch(); }
    }
  }
  // the wave rolling: spray off its crest, a hiss now and then; the Sweep: a drag noise following the tip, spray
  for (const p of g.projs) {
    if (p.owner !== f.slot) continue;
    if (p.style === "wave") {
      if (tk % 2 === 0) krDrop(p.x - (p.r || 45) * 0.9 + Math.random() * 20, -(p.w || 60) * 0.9, -2 - Math.random() * 2, -1 - Math.random() * 2);
      if (live && tk % 24 === 0) KSND.hiss();
    } else if (p.style === "sweep") {
      const d = p.dir || 1;
      if (tk % 2 === 0) krDrop(p.x - d * 20, S.top - 4, -d * (1 + Math.random() * 2), -1 - Math.random() * 2.5);
      if (live && tk % 6 === 0) KSND.drag();
    }
  }
  // broken: the tentacles drip; the head lying: bubbles
  if (f.state === "broken" && tk % 9 === 0) { const s = (tk / 9) & 1 ? 1 : -1; krDrop(f.x + s * (64 + 60), S.top + 50 + Math.random() * 20, 0, 0.4); }
  // rage: the drum every 550 ms
  if (rage && live && ++KR.beat >= 33) { KR.beat = 0; KSND.drum(); }
  // bubbles round him at sea (the sounds belong to the map's ambience)
}

/* ---- Ink Spray: blots over the screen (UI only; the sim only sends bossInk { n, dur, seed }) ---- */
const KI = { list: [], frame: 0, scr: -9 };
function krRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// one blot: an irregular splat (spikes with drops on their ends, satellite drops), a radial #1a1030 0.92 core -> 0.7 rim and a wet highlight,
// so it reads as ink on the glass over the dark sea; drawn once into a sprite (every subpath clockwise: one union, no holes)
function krInkSprite(r, rnd) {
  const D = DPR, S = Math.ceil(r * 3.2), cv = document.createElement("canvas");
  cv.width = cv.height = Math.max(2, Math.ceil(S * D));
  const x = cv.getContext("2d"), c0 = S / 2, p = new Path2D();
  x.scale(D, D);
  const N = 34, ph = rnd() * 6, ph2 = rnd() * 6, P = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * KR_TAU, k = 0.8 + 0.1 * Math.sin(a * 3 + ph) + 0.06 * Math.sin(a * 7 + ph2) + (rnd() - 0.5) * 0.08; P.push([c0 + Math.cos(a) * r * k, c0 + Math.sin(a) * r * k]); }
  p.moveTo((P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2);
  for (let i = 1; i <= N; i++) { const q = P[i % N], n = P[(i + 1) % N]; p.quadraticCurveTo(q[0], q[1], (q[0] + n[0]) / 2, (q[1] + n[1]) / 2); }
  p.closePath();
  const circ = (cx, cy, rr) => { p.moveTo(cx + rr, cy); p.arc(cx, cy, rr, 0, KR_TAU); };
  for (let i = 0; i < 5; i++) { const a = rnd() * KR_TAU, d = r * (0.72 + rnd() * 0.18); circ(c0 + Math.cos(a) * d, c0 + Math.sin(a) * d, r * (0.14 + rnd() * 0.12)); }   // lobes
  for (let i = 0; i < 7; i++) {   // spikes: a tapered streak out of the rim, a drop on its end
    const a = (i / 7) * KR_TAU + (rnd() - 0.5) * 0.7, w = 0.05 + rnd() * 0.05, R0 = r * 0.7, R1 = r * (1.12 + rnd() * 0.32);
    p.moveTo(c0 + Math.cos(a - w) * R0, c0 + Math.sin(a - w) * R0); p.lineTo(c0 + Math.cos(a) * R1, c0 + Math.sin(a) * R1); p.lineTo(c0 + Math.cos(a + w) * R0, c0 + Math.sin(a + w) * R0); p.closePath();
    circ(c0 + Math.cos(a) * R1, c0 + Math.sin(a) * R1, r * (0.04 + rnd() * 0.04));
  }
  for (let i = 0; i < 8; i++) { const a = rnd() * KR_TAU, d = r * (1.15 + rnd() * 0.4); circ(c0 + Math.cos(a) * d, c0 + Math.sin(a) * d, r * (0.02 + rnd() * 0.045)); }   // satellite drops
  const gr = x.createRadialGradient(c0, c0, 0, c0, c0, r * 1.2);
  gr.addColorStop(0, "rgba(26,16,48,0.92)"); gr.addColorStop(0.6, "rgba(26,16,48,0.9)"); gr.addColorStop(1, "rgba(26,16,48,0.7)");
  x.fillStyle = gr; x.fill(p);
  // the wet highlight: a crescent and a glint up and to the left
  x.lineCap = "round";
  x.strokeStyle = "rgba(185,155,235,0.3)"; x.lineWidth = Math.max(1.5, r * 0.08); x.beginPath(); x.arc(c0 - r * 0.08, c0 - r * 0.06, r * 0.56, 3.45, 4.35); x.stroke();
  x.fillStyle = "rgba(235,225,255,0.45)"; x.beginPath(); x.arc(c0 - r * 0.42, c0 - r * 0.42, Math.max(1, r * 0.055), 0, KR_TAU); x.fill();
  return { cv, S };
}
// bossInk: n blots for dur frames, placed from the seed: none within r + 30 px of your fighter, none in the top 90 px (cards, boss bar), all over the
// game canvas only (upright: not over the touch pad under it), spread out; they splat one after another (3 frames apart)
function krInkStart(g, e) {
  const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), rnd = krRng((Math.imul(e.seed | 0, 2654435761) ^ 0x5bd1e995) >>> 0);
  const me = g.fighters[meSlot];
  let mx = -1e4, my = -1e4;
  if (me && me.state !== "dead" && me.state !== "gone") [mx, my] = toScreen(me.x, me.y - me.s.h * 0.5);
  KI.list.length = 0;
  for (let i = 0; i < (e.n | 0); i++) {
    let r = ((70 + rnd() * 60) * u) / 390, best = null, bs = -1e9;
    for (let tries = 0; tries < 3 && !best; tries++, r *= 0.82) {
      for (let j = 0; j < 16; j++) {
        const x = r * 0.3 + rnd() * Math.max(1, gw - r * 0.6), y = 90 + r * 1.15 + rnd() * Math.max(1, gh - 90 - r * 1.45);
        if (y - r * 1.15 < 90 || y > gh - r * 0.3) continue;   // its spikes too stay out of the top 90 px
        if (Math.hypot(x - mx, y - my) < r + 30) continue;
        let sc = 1e9;
        for (const b of KI.list) sc = Math.min(sc, Math.hypot(x - b.x, y - b.y) - b.r - r * 0.4);
        if (sc > bs) { bs = sc; best = { x, y, r }; }
      }
    }
    if (!best) continue;
    const t0 = tick + i * 3, spr = krInkSprite(best.r, rnd);
    const drips = Array.from({ length: 3 }, () => ({ dx: (rnd() - 0.5) * best.r * 1.1, len: best.r * (0.35 + rnd() * 0.6), w: best.r * (0.07 + rnd() * 0.06) }));
    KI.list.push({ x: best.x, y: best.y, r: best.r, t0, end: t0 + (e.dur | 0), spr: spr.cv, S: spr.S, drips, wob: rnd() * 6 });
  }
}
// the blots go when the match ends or the KO page starts (and with the game)
function krInkGate(g) {
  if (KI.list.length && (FIN.on || mode !== "match" || g !== G || g.phase === "end" || g.phase === "over")) KI.list.length = 0;
  for (let i = KI.list.length - 1; i >= 0; i--) if (tick >= KI.list[i].end) KI.list.splice(i, 1);
}
// screen space (CSS px): splat over 10 frames (0.3 -> 1 with a wobble), hold, fade over the last 30; the drips run down
function krInkDraw(c) {
  const now = tick;
  for (const b of KI.list) {
    const t = now - b.t0, left = b.end - now;
    if (t < 0 || left <= 0) continue;
    const a = Math.min(1, left / 30);
    let s;
    if (t < 10) { const k = t / 10; s = 0.3 + 0.7 * easeOut2(k) + Math.sin(k * Math.PI) * 0.12; }
    else s = 1 + 0.03 * Math.sin((t - 10) * 0.5 + b.wob) * Math.exp(-(t - 10) / 12);
    c.globalAlpha = a;
    if (t >= 8) {   // the drips, growing
      const g = clamp((t - 8) / 70, 0, 1);
      c.fillStyle = "rgba(26,16,48,0.85)";
      for (const d of b.drips) {
        const L = d.len * easeOut2(g), x = b.x + d.dx, y0 = b.y + Math.sqrt(Math.max(0, b.r * b.r * 0.7 - d.dx * d.dx)) * 0.9;
        c.beginPath(); c.roundRect(x - d.w / 2, y0 - d.w, d.w, L + d.w, d.w / 2); c.fill();
        c.beginPath(); c.arc(x, y0 + L, d.w * 0.8, 0, KR_TAU); c.fill();
      }
    }
    const S = b.S * s;
    c.drawImage(b.spr, b.x - S / 2, b.y - S / 2, S, S);
  }
  c.globalAlpha = 1;
}
// BOSS_ART.kraken.screen: called by render2D in screen space (DPR transform, the game area clipped) after the fight, before the HUD
function krScreen(c, g, tk) {
  KI.scr = KI.frame;
  krInkGate(g);
  if (KI.list.length && g === G) krInkDraw(c);
}

/* ---- events: his moves, the slams, the ink, grabs, bites and spits, staggers and fall (looks and sounds; sounds only while `live`) ---- */
function krEvent(g, e, live) {
  if (KR.g !== g) krReset(g);
  const S = STAGE.main, kf = g.fighters.find((o) => o.spec.boss) || null, mine = (slot) => !!kf && slot === kf.slot;
  switch (e.type) {
    case "bossMove":
      if (!mine(e.slot)) return false;
      if (live) {
        if (e.mv === "slam") KSND.gurgle();
        else if (e.mv === "ink") KSND.inhale();
        else if (e.mv === "chomp") KSND.deep();
      }
      return false;
    case "bossSlam":
      if (!mine(e.slot)) return false;
      krSplash(e.x, e.y, 14, true);
      cam.shake = Math.max(cam.shake, 6);
      if (live) KSND.slam();
      return false;
    case "bossInk":
      if (!mine(e.slot)) return false;
      if (live) { krInkStart(g, e); KSND.ptoo(); KSND.blups(Math.min(11, e.n | 0)); }
      for (let i = 0; i < 10; i++) krDrop(e.x - 20 + (Math.random() - 0.5) * 30, e.y - 70, -3 - Math.random() * 5, -4 - Math.random() * 4, "#2a1a40");
      return false;
    case "bossWave":
      if (!mine(e.slot)) return false;
      for (let i = 0; i < 6; i++) krDrop(e.x + (Math.random() - 0.5) * 20, e.y - 20 - Math.random() * 30, -2 - Math.random() * 3, -2 - Math.random() * 3);
      if (live) KSND.splash();
      return false;
    case "bossGrab":
      if (!mine(e.slot)) return false;
      addFx({ k: "ring", x: e.x, y: e.y - 40, t: 0, life: 14, r0: 10, r1: 56, col: KC.foam });
      if (live) KSND.gulp();
      return false;
    case "bossBite":
      if (!mine(e.slot)) return false;
      for (let i = 0; i < 5; i++) addFx({ k: "line", x: e.x, y: e.y - 40, vx: (Math.random() - 0.5) * 8, vy: -2 - Math.random() * 5, t: 0, life: 9, col: i % 2 ? "#ffffff" : KC.teeth, w: 2.4 });
      cam.shake = Math.max(cam.shake, 3);
      if (live) KSND.crunch();
      return false;
    case "bossThrow":
      if (!mine(e.slot)) return false;
      for (let i = 0; i < 12; i++) krDrop(e.x + (Math.random() - 0.5) * 30, e.y - 30, (Math.random() - 0.5) * 4, -4 - Math.random() * 7, i % 3 ? KC.foam : KC.tongue);
      addFx({ k: "ring", x: e.x, y: e.y - 30, t: 0, life: 12, r0: 8, r1: 44, col: KC.foam });
      if (live) KSND.spit();
      return false;
    case "bossStagger": {
      if (!mine(e.slot)) return false;
      for (const q of KR.tentsNow) KR.ghosts.push({ x: q.x, d: q.d, t0: tick });
      KR.flopT = tick;
      addFx({ k: "ring", x: kf.x, y: kf.y - 90, t: 0, life: 18, r0: 20, r1: 110, col: KC.teal });
      if (live) KSND.stagger();
      return false;
    }
    case "bossBroken": {
      if (!mine(e.slot)) return false;
      for (const q of KR.tentsNow) KR.ghosts.push({ x: q.x, d: q.d, t0: tick });
      krSplash(kf.bx || e.x, S.top, 14, true);
      cam.shake = Math.max(cam.shake, 9);
      if (live) KSND.broken();
      return false;
    }
    case "projEnd":
      if (!mine(e.slot) || e.style !== "sweep") return false;
      KR.sweeps.push({ x: e.x, dir: e.x > 0 ? 1 : -1, t0: tick });
      for (let i = 0; i < 6; i++) krDrop(e.x, S.top - 10, (e.x > 0 ? 1 : -1) * (1 + Math.random() * 3), -2 - Math.random() * 3);
      return true;
    case "ko":   // a player knocked out past the right ledge: his eyes follow, he licks his lips
      if (kf && !mine(e.slot) && !kf.doomed && e.x > S.x2 + 40) { KR.lick = tick; KR.lickY = e.y; if (live) KSND.lick(); }
      return false;
    case "hit": {
      if (e.boss && kf && e.def === kf.slot) {
        if (e.down) {   // the launch-out: a spray column, the pier rocks, the crates hop, the long "waaaah"
          KR.hop0 = KR.downT = tick; KR.downX = e.x;
          addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 22, r0: 20, r1: 170, col: KC.teal });
          for (let i = 0; i < 18; i++) { const a = Math.random() * KR_TAU, sp = 3 + Math.random() * 7; krDrop(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp - 3, i % 3 ? KC.foam : KC.teal); }
          krSplash(e.x, S.top, 16, true);
          cam.shake = Math.max(cam.shake, 10);
          if (live) KSND.down();
        } else if (e.stag) {   // sparks while he is staggered: teal and gold
          addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 12, r0: 6, r1: 34 + e.dmg * 1.5, col: KC.gold });
          for (let i = 0; i < 7; i++) { const a = Math.random() * KR_TAU, sp = 3 + Math.random() * 5; addFx({ k: "line", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 9 + Math.random() * 6, col: i % 2 ? KC.teal : KC.gold, w: 2.6 }); }
          if (live) KSND.squelch();
        } else if (e.broken) addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 8, r0: 4, r1: 18, col: "#c9ced8" });
        else {   // a hit through a tentacle or on the head: a wet splat
          for (let i = 0; i < 6; i++) krDrop(e.x, e.y, (Math.random() - 0.5) * 6, -1 - Math.random() * 4, i % 2 ? KC.teal : KC.foam);
          if (live) KSND.squelch();
        }
      } else if (kf && e.slot === kf.slot) {   // his hits on a player: water
        for (let i = 0; i < 8; i++) krDrop(e.x, e.y, (Math.random() - 0.5) * 7, -2 - Math.random() * 5);
      }
      return false;
    }
  }
  return false;
}

/* ---- his sounds (base.js Sfx helpers; quiet like the rest of the game) ---- */
const KSND = {
  gurgle() { Sfx.noiseF(0.3, 0.22, "lowpass", 400, 260, 1.2); for (let i = 0; i < 3; i++) Sfx.at(0.05 + i * 0.08, 240 - i * 30, 130, 0.06, "sine", 0.05); },
  slam() { Sfx.noise(0.12, 0.42, 200); Sfx.tone(80, 40, 0.3, "sine", 0.5); Sfx.later(60, () => Sfx.noiseF(0.14, 0.18, "bandpass", 900, 380, 2)); },
  plink(i) { const f0 = [800, 1000, 1200][i] || 1200; Sfx.tone(f0, f0 * 0.98, 0.1, "sine", 0.07); },
  drag() { Sfx.noise(0.1, 0.1, 600); },
  inhale() { Sfx.noiseF(0.4, 0.2, "lowpass", 200, 600, 1); Sfx.tone(120, 180, 0.4, "sine", 0.05); },
  ptoo() { Sfx.noise(0.06, 0.4, 1000); Sfx.tone(520, 300, 0.06, "sine", 0.08); },
  blups(n) { for (let i = 0; i < n; i++) Sfx.at(0.08 + i * 0.05 + Math.random() * 0.02, 400, 150, 0.06, "sine", 0.07); },
  slap() { Sfx.noise(0.09, 0.42, 300); Sfx.tone(150, 70, 0.08, "sine", 0.2); },
  roar() { Sfx.noiseF(1.5, 0.24, "lowpass", 500, 1200, 0.8); Sfx.tone(70, 55, 1.2, "sawtooth", 0.03); },
  hiss() { Sfx.noiseF(0.3, 0.07, "highpass", 3000, 4000, 0.7); },
  deep() { Sfx.noiseF(0.5, 0.24, "lowpass", 150, 500, 1); Sfx.tone(90, 120, 0.5, "sine", 0.1); },
  lunge() { Sfx.noiseF(0.18, 0.3, "bandpass", 300, 1400, 0.9); Sfx.later(130, () => { Sfx.noise(0.08, 0.45, 500); Sfx.tone(120, 60, 0.12, "sine", 0.3); }); },
  gulp() { Sfx.tone(300, 120, 0.12, "sine", 0.16); Sfx.noise(0.06, 0.3, 700); },
  crunch() { Sfx.noise(0.04, 0.5, 900); Sfx.later(45, () => Sfx.noise(0.04, 0.35, 900)); },
  spit() { Sfx.tone(300, 900, 0.18, "sine", 0.12); Sfx.noise(0.08, 0.3, 1400); },
  squelch() { Sfx.noiseF(0.08, 0.22, "bandpass", 700, 300, 2); },
  splash() { Sfx.noise(0.14, 0.22, 900); },
  flop() { Sfx.noise(0.15, 0.4, 300); Sfx.tone(90, 45, 0.2, "sine", 0.4); },
  stagger() { Sfx.tone(520, 260, 0.25, "triangle", 0.06); Sfx.later(120, () => Sfx.tone(440, 220, 0.25, "triangle", 0.05)); Sfx.later(240, () => Sfx.tone(370, 185, 0.25, "triangle", 0.04)); },
  broken() { Sfx.tone(160, 55, 0.8, "sawtooth", 0.045); Sfx.tone(110, 50, 0.9, "sine", 0.2); Sfx.noise(0.4, 0.15, 400); },
  down() { Sfx.tone(300, 80, 0.9, "sine", 0.16); Sfx.tone(302, 81, 0.9, "triangle", 0.05); Sfx.noise(0.5, 0.3, 900); Sfx.tone(70, 30, 0.5, "sine", 0.4); },
  drum() { Sfx.tone(50, 50, 0.06, "sine", 0.5); },
  gull() { Sfx.tone(1500, 1100, 0.12, "triangle", 0.02); Sfx.at(0.14, 1450, 1050, 0.14, "triangle", 0.016); },
  lick() { Sfx.noiseF(0.25, 0.12, "bandpass", 500, 1200, 3); },
  bubble() { Sfx.tone(380 + Math.random() * 200, 150, 0.06, "sine", 0.03); },
};

BOSS_ART.kraken = { draw: krDraw, proj: krProj, floor: krFloor, event: krEvent, screen: krScreen };
