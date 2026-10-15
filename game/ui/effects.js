/* ===================== effects ===================== */
const fx = [], sfx = [], trails = [[], [], [], []], combos = [null, null, null, null], chgPops = [], finDash = [null, null, null, null];   // per slot (a boss fight has three, a 2v2 four)
const clearTrails = () => { for (const t of trails) t.length = 0; };
function addFx(o) { if (fx.length < 260) fx.push(o); }
function spark(x, y, col, kb, dx, dy) {
  const n = 6 + Math.min(10, (kb * 0.35) | 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * (4 + kb * 0.35);
    addFx({ k: "line", x, y, vx: Math.cos(a) * sp + (dx || 0) * kb * 0.25, vy: Math.sin(a) * sp + (dy || 0) * kb * 0.25, t: 0, life: 9 + Math.random() * 8, col: i % 2 ? "#ffffff" : col, w: 2 + kb * 0.08 });
  }
  addFx({ k: "ring", x, y, t: 0, life: 14, r0: 8, r1: 26 + kb * 2.4, col });
  if (kb > 14) addFx({ k: "star", x, y, t: 0, life: 7, s: 26 + kb * 1.6 });
}
function dust(x, y, n, spread) {
  for (let i = 0; i < n; i++) addFx({ k: "puff", x: x + (Math.random() - 0.5) * spread, y: y - 2, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.4, r: 4 + Math.random() * 5, t: 0, life: 16 + Math.random() * 10 });
}
function ember(x, y, vx, vy) { addFx({ k: "ember", x, y, vx, vy, t: 0, life: 12 + Math.random() * 10, r: 1.8 + Math.random() * 2.4 }); }
function updateFx(g) {
  if (mode === "match" && g === G) tagStep(g);   // hud.js: when the YOU / CPU markers show
  skinTick(g, tick);
  uvTick(g);   // Ultimates: the super freeze clock, particles and cues of the ulti being played
  { BL.useStage(g); const ma = mapArt(); if (ma.tick) ma.tick(g, mode === "match" && g === G && !FIN.on); }   // the map's ambient particles / sounds (draw-world.js MAP_ART)
  for (const p of g.projs) if (p.style === "fire" && Math.random() < 0.7) ember(p.x - p.vx * 0.6 + (Math.random() - 0.5) * 10, p.y + (Math.random() - 0.5) * 10, -p.vx * 0.12 + (Math.random() - 0.5), -0.6 - Math.random());
  for (const f of g.fighters) {
    if (f.state !== "attack" || !f.move || !f.move.fire) continue;
    const bx = BL.activeBoxes(f);
    if (bx) for (const b of bx) ember(b.x + (Math.random() - 0.5) * b.r, b.y + (Math.random() - 0.5) * b.r, f.facing * (1 + Math.random() * 2), -0.8 - Math.random());
  }
  for (const e of fx) {
    e.t++;
    if (e.vx !== undefined) { const d = e.damp || 0.9; e.x += e.vx; e.y += e.vy; e.vx *= d; e.vy = e.vy * d + (e.g || 0); }
    if (e.vr) e.rot += e.vr;
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t >= fx[i].life) fx.splice(i, 1);
  for (const e of sfx) e.t++;
  for (let i = 0; i < combos.length; i++) { const cb = combos[i]; if (cb) { cb.t++; cb.pop *= 0.82; if (cb.t > 80) combos[i] = null; } }
  for (let i = chgPops.length - 1; i >= 0; i--) { const q = chgPops[i]; q.t++; q.pop *= 0.8; if (q.t > 56) chgPops.splice(i, 1); }
  finDashTick(g);
  for (let i = sfx.length - 1; i >= 0; i--) if (sfx[i].t >= sfx[i].life) sfx.splice(i, 1);
  g.fighters.forEach((f, i) => {
    const tr = trails[i];
    if (f.state === "hitstun" && Math.hypot(f.kbx, f.kby) > 7) tr.push([f.x, f.y - f.s.h * 0.5]);
    else if (tr.length) tr.shift();
    if (tr.length > 16) tr.shift();
    if (f.state === "dead" || f.state === "gone") tr.length = 0;
  });
}
// Reaper's Grave rise: a dark wisp cloud billows out under him (pale on the Bone skin, embers in it on Ember Wake), a low rush in place of the jump sound
function graveRise(e, f, live) {
  const lvl = skinLvl(f), col = lvl === 3 ? "#d6d0c2" : "#4a4458";
  addFx({ k: "ring", x: e.x, y: e.y + 4, t: 0, life: 14, r0: 6, r1: 34, col: lvl === 3 ? "#efeadc" : "#6a6478" });
  for (let i = 0; i < 9; i++) addFx({ k: "puff", x: e.x + frand(-18, 18), y: e.y + frand(0, 10), vx: frand(-1.6, 1.6), vy: frand(0.2, 1.1), r: frand(5, 8), t: 0, life: frand(26, 40), col });
  if (lvl === 2) for (let i = 0; i < 4; i++) ember(e.x + frand(-14, 14), e.y + 6, frand(-1, 1), frand(-0.4, 0.6));
  if (live) Sfx.graveRise();
}
// Harvest: when the spin starts (after the wind-up), the low whoosh and a little dust kicked up behind the slide
function harvestSwing(g, f, live) {
  const mv = f.move, moveT = f.moveT, slot = f.slot;
  let tries = 0;
  const poll = () => {
    const q = g.fighters[slot];
    if (!q || q.state !== "attack" || q.mid !== "spec" || q.moveT !== moveT || ++tries > 400) return;
    if (paused || q.mt < mv.startup) { setTimeout(poll, 16); return; }
    if (q.grounded) for (let i = 0; i < 4; i++) addFx({ k: "puff", x: q.x - q.facing * frand(6, 22), y: q.y - 2, vx: -q.facing * frand(0.5, 1.6), vy: frand(-0.8, -0.1), r: frand(3.5, 6), t: 0, life: frand(18, 28) });
    if (live) Sfx.harvest();
  };
  setTimeout(poll, Math.max(0, (mv.startup - 4) * STEP));
}
// Gunslinger's Powder jump: a flash, a tracer and smoke under him, and a shot sound in place of the jump sound
function powderJump(e, dir, live) {
  addFx({ k: "ring", x: e.x + dir * 14, y: e.y + 6, t: 0, life: 12, r0: 4, r1: 24, col: "#ffd27a" });
  addFx({ k: "line", x: e.x + dir * 14, y: e.y + 46, vx: 0, vy: 22, w: 2.5, col: "#fff2c4", t: 0, life: 6 });
  for (let i = 0; i < 6; i++) addFx({ k: "puff", x: e.x + dir * 14 + frand(-10, 10), y: e.y + frand(2, 12), vx: frand(-1.2, 1.2), vy: frand(0.1, 0.8), r: frand(4, 6.5), t: 0, life: frand(22, 34), col: "#cfc8d8" });
  if (live) Sfx.shot(false);
}
function drawFx(c) {
  for (const e of fx) {
    const a = 1 - e.t / e.life;
    if (drawSkinFx(c, e, a)) continue;
    if (e.k === "uv") { uvDrawFx(c, e, a); continue; }
    if (e.k === "line") { c.strokeStyle = e.col; c.globalAlpha = a; c.lineWidth = e.w; c.lineCap = "round"; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x - e.vx * 1.8, e.y - e.vy * 1.8); c.stroke(); }
    else if (e.k === "ring") { c.strokeStyle = e.col; c.globalAlpha = a * 0.8; c.lineWidth = 3 * a + 1; c.beginPath(); c.arc(e.x, e.y, lerp(e.r0, e.r1, ease(e.t / e.life)), 0, Math.PI * 2); c.stroke(); }
    else if (e.k === "ember") { const q = e.t / e.life; c.fillStyle = q < 0.4 ? "#ffe08a" : q < 0.75 ? "#ff8a3d" : "#c9362b"; c.globalAlpha = a; c.beginPath(); c.arc(e.x, e.y, e.r * (1 - q * 0.5), 0, Math.PI * 2); c.fill(); }
    else if (e.k === "puff") { c.fillStyle = e.col || "#d9d4ea"; c.globalAlpha = a * 0.5; c.beginPath(); c.arc(e.x, e.y, e.r * (1 + e.t / e.life), 0, Math.PI * 2); c.fill(); }
    else if (e.k === "star") {
      c.fillStyle = "#ffffff"; c.globalAlpha = a; const s = e.s * (0.6 + 0.4 * a);
      c.beginPath(); c.moveTo(e.x, e.y - s); c.lineTo(e.x + s * 0.18, e.y - s * 0.18); c.lineTo(e.x + s, e.y); c.lineTo(e.x + s * 0.18, e.y + s * 0.18);
      c.lineTo(e.x, e.y + s); c.lineTo(e.x - s * 0.18, e.y + s * 0.18); c.lineTo(e.x - s, e.y); c.lineTo(e.x - s * 0.18, e.y - s * 0.18); c.closePath(); c.fill();
    } else if (e.k === "shock") {
      c.strokeStyle = "#f3d9a4"; c.globalAlpha = a * 0.8; c.lineWidth = 4 * a + 1;
      const r = lerp(10, 90, ease(e.t / e.life)); c.beginPath(); c.ellipse(e.x, e.y, r, r * 0.22, 0, Math.PI, Math.PI * 2); c.stroke();
    }
  }
  c.globalAlpha = 1;
}
function drawTrails(c, g) {
  g.fighters.forEach((f, i) => {
    const tr = trails[i];
    if (tr.length < 2) return;
    c.lineCap = "round"; c.lineJoin = "round";
    for (let k = 1; k < tr.length; k++) {
      const a = k / tr.length;
      c.strokeStyle = rgba(f.lastHitBy ? col(f.lastHitBy.pal) : "#ffffff", 0.35 * a);
      c.lineWidth = f.s.w * 0.9 * a;
      c.beginPath(); c.moveTo(tr[k - 1][0], tr[k - 1][1]); c.lineTo(tr[k][0], tr[k][1]); c.stroke();
    }
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(tr[0][0], tr[0][1]); for (const p of tr) c.lineTo(p[0], p[1]); c.stroke();
  });
}
function drawScreenFx(c) {
  for (const e of sfx) {
    const a = 1 - e.t / e.life;
    if (e.k === "flash") { c.fillStyle = `rgba(255,248,235,${a * 0.35})`; c.fillRect(0, 0, L.gw, L.gh); continue; }
    if (e.k === "beam") {
      const [sx0, sy0] = toScreen(e.wx, e.wy);
      const x = clamp(sx0, 0, L.gw), y = clamp(sy0, 0, L.gh);
      const ang = Math.atan2(L.gh / 2 - y, L.gw / 2 - x);
      const len = Math.max(L.gw, L.gh) * 0.75 * (0.5 + 0.5 * ease(Math.min(1, e.t / 8)));
      const wd = Math.min(L.gw, L.gh) * 0.16 * (e.t < 6 ? e.t / 6 : a);
      c.save(); c.translate(x, y); c.rotate(ang);
      const gr = c.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, rgba(e.col, 0.95)); gr.addColorStop(1, rgba(e.col, 0));
      c.fillStyle = gr; c.beginPath(); c.moveTo(-10, -wd); c.lineTo(len, 0); c.lineTo(-10, wd); c.closePath(); c.fill();
      const gw2 = c.createLinearGradient(0, 0, len * 0.7, 0);
      gw2.addColorStop(0, "rgba(255,255,255,0.95)"); gw2.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gw2; c.beginPath(); c.moveTo(-10, -wd * 0.35); c.lineTo(len * 0.7, 0); c.lineTo(-10, wd * 0.35); c.closePath(); c.fill();
      if (e.fries) for (const fr of e.fries) {
        const d = fr.sp * e.t, fx_ = Math.cos(fr.da) * d, fy_ = Math.sin(fr.da) * d;
        c.save(); c.translate(fx_, fy_); c.rotate(fr.rot + fr.vr * e.t); c.globalAlpha = Math.min(1, a * 1.4);
        c.fillStyle = "#f2c14e"; c.strokeStyle = "rgba(14,16,34,0.8)"; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect(-fr.len / 2, -2.5, fr.len, 5, 1.5); c.fill(); c.stroke();
        c.restore();
      }
      c.restore();
    }
  }
}
// "3 HIT · 14%" pop-up above the fighter taking the combo, with the route's name over it when the hits make one
function drawCombos(c, g) {
  for (let i = 0; i < combos.length; i++) {
    const cb = combos[i], f = g.fighters[i];
    if (!cb || !f) continue;
    const alive = f.state !== "dead" && f.state !== "gone";
    if (alive) cb.at = toScreen(f.x, f.y - f.s.h);
    if (!cb.at) continue;
    const x = clamp(cb.at[0], 50, L.gw - 50), y = clamp(cb.at[1] - 58, 70, L.gh - 40);
    const a = cb.t < 60 ? 1 : 1 - (cb.t - 60) / 20, sc = 1 + cb.pop * 0.5;
    c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(sc, sc);
    c.textAlign = "center"; c.lineJoin = "round";
    c.font = 'italic 900 24px "Barlow Condensed", "Arial Narrow", sans-serif';
    c.lineWidth = 5; c.strokeStyle = "rgba(14,16,34,0.85)"; c.strokeText(`${cb.n} HIT`, 0, 0);
    c.fillStyle = cb.col; c.fillText(`${cb.n} HIT`, 0, 0);
    c.font = '800 14px "Barlow Condensed", "Arial Narrow", sans-serif';
    const sub = cb.fin ? `${cb.dmg}% · LAUNCH` : `${cb.dmg}%`;
    c.lineWidth = 4; c.strokeText(sub, 0, 16); c.fillStyle = "#f3efe6"; c.fillText(sub, 0, 16);
    if (cb.route) {   // the route's name above the count, in gold
      c.font = 'italic 900 17px "Barlow Condensed", "Arial Narrow", sans-serif';
      const rn = cb.route.toUpperCase();
      c.lineWidth = 5; c.strokeText(rn, 0, -24); c.fillStyle = "#ffd23f"; c.fillText(rn, 0, -24);
    }
    c.restore();
  }
  drawChargedPops(c);
}
// "CHARGED" pops at the spot of a full-charge hit: same pop-up style as the combo counter, rising and fading
// a word popping over the fight: CHARGED on a full-charge heavy, CAUGHT! on a 2v2 Catch (duo.js; txt)
function chargedPop(e) { chgPops.push({ x: e.x, y: e.y, t: 0, pop: 1, col: col(e.pal) }); }
function drawChargedPops(c) {
  for (const q of chgPops) {
    const [sx, sy] = toScreen(q.x, q.y - 46), x = clamp(sx, 56, L.gw - 56), y = clamp(sy - q.t * 0.7, 56, L.gh - 40);
    const a = q.t < 38 ? 1 : 1 - (q.t - 38) / 18, sc = 1 + q.pop * 0.55;
    c.save(); c.globalAlpha = Math.max(0, a); c.translate(x, y); c.scale(sc, sc);
    c.textAlign = "center"; c.lineJoin = "round";
    c.font = 'italic 900 22px "Barlow Condensed", "Arial Narrow", sans-serif';
    c.lineWidth = 5; c.strokeStyle = "rgba(14,16,34,0.85)"; c.strokeText(q.txt || "CHARGED", 0, 0);
    c.fillStyle = q.col; c.fillText(q.txt || "CHARGED", 0, 0);
    c.restore();
  }
}
// the charge hum follows the strongest charge on the field; anything but a live, unpaused match silences it
function humStep(g) {
  let n = 0;
  if (mode === "match" && !paused && !FIN.on && !document.hidden && g && g.phase === "play") {
    for (const f of g.fighters) if (f.state === "attack" && f.move && f.move.charge && f.mt === f.move.startup - BL.TUNE.chgHold && f.chg > n) n = f.chg;
  }
  Sfx.hum(n >= 4 ? n : 0);
}
// Samurai's Quick Draw while the opponent is finish-ready: the white flash line stays on the path (the 200-chip skin draws its own)
function finDashTick(g) {
  g.fighters.forEach((f, i) => {
    const m = f.move;
    if (f.spec.look.costume !== "samurai" || f.state !== "attack" || !m || m.kind !== "dash" || !finishReady(foeSlot(f.slot)) || skinLvl(f) >= 3) { finDash[i] = null; return; }
    if (f.mt === m.startup + 1) finDash[i] = f.x;
    if (f.mt === m.startup + m.active && finDash[i] !== null) { addFx({ k: "flashline", x1: finDash[i], x2: f.x, y: f.y - f.s.h * 0.45, col: "#ffffff", t: 0, life: 26 }); finDash[i] = null; }
  });
}
function drawBubbles(c, g, tk, img) {
  for (const f of g.fighters) {
    if (f.state === "dead" || f.state === "gone") continue;
    if (f.spec.boss && f.spec.boss.hide && !f.doomed) continue;   // Kraken Spud waiting out at sea is not off the stage
    const [sx, sy] = toScreen(f.x, f.y - f.s.h * 0.5);
    const m = 6;
    if (sx > m && sx < L.gw - m && sy > m && sy < L.gh - m) continue;
    const R = 28, bx = clamp(sx, R + 10, L.gw - R - 10), pz = hudPauseZone();   // the pause icon sits under the opponent's card (hud.js)
    const by = clamp(sy, R + (pz && bx + R > pz.x ? Math.max(64, pz.b) : 64), L.gh - R - 10);
    const ang = Math.atan2(sy - by, sx - bx);
    c.save();
    c.fillStyle = col(f.pal);
    c.beginPath(); c.moveTo(bx + Math.cos(ang) * (R + 12), by + Math.sin(ang) * (R + 12));
    c.lineTo(bx + Math.cos(ang + 0.45) * R, by + Math.sin(ang + 0.45) * R); c.lineTo(bx + Math.cos(ang - 0.45) * R, by + Math.sin(ang - 0.45) * R); c.fill();
    c.beginPath(); c.arc(bx, by, R, 0, Math.PI * 2); c.fillStyle = "rgba(14,16,34,0.88)"; c.fill(); c.lineWidth = 3; c.strokeStyle = col(f.pal); c.stroke();
    c.save(); c.beginPath(); c.arc(bx, by, R - 2, 0, Math.PI * 2); c.clip();
    if (img && img[f.slot]) c.drawImage(img[f.slot], bx - R, by - R, R * 2, R * 2);
    else { const sc = (R * 1.5) / f.s.h; c.translate(bx, by + R * 0.62); c.scale(sc, sc); drawFighter(c, f, tk, [0, 0]); }
    c.restore();
    c.font = '800 14px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center"; c.fillStyle = pctColor(f.percent);
    c.fillText(Math.floor(f.percent) + "%", bx, by + R + 15);
    c.restore();
  }
}

/*SKINFX*/

/* Frame-time watchdog: if a match can't hold ~45 fps for a few seconds, q steps up from 0 to 3 (it never steps back
   down). The manga KO page reads it to pick its cheap tier. Tests pin it with window.__blastline.r3.lockQ = true. */
const PERF = { q: 0, lockQ: false, last: 0, n: 0, sum: 0 };
function perfStep(now) {
  const p = PERF;
  if (!p.last) { p.last = now; return; }
  const dt = now - p.last; p.last = now;
  if (document.hidden || dt > 120 || p.q >= 3 || p.lockQ) { p.n = 0; p.sum = 0; return; }
  p.n++; p.sum += dt;
  if (p.sum > 2500) {
    if (p.sum / p.n > 22) p.q++;
    p.n = 0; p.sum = 0;
  }
}

function render(g, tk) {
  RG = g; humStep(g);   // RG: the game drawn this frame (finish-ready looks read it); humStep: the charge hum
  // during the KO finisher the scene shows its two stand-ins instead of the real fighters
  const fin = FIN.on && mode === "match";
  if (fin) g = finFrame(g, tk);
  if (fin && FIN.on && FIN.manga) mangaDraw(g, tk);
  else render2D(g, tk);
  if (fin) finOverlay(ctx, tk);
  else if (mode === "match") perfStep(performance.now());   // match frames feed the watchdog
}
function render2D(g, tk) {
  const c = ctx;
  BL.useStage(g);   // the layout (and look) of the map this game is played on
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.save(); c.beginPath(); c.rect(0, 0, L.gw, L.gh); c.clip();
  drawBackground(c, tk);
  finSkyTint(c);
  const ox = L.gw / 2 - cam.x * cam.z + cam.sx, oy = L.gh / 2 - cam.y * cam.z + cam.sy;
  c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * ox, DPR * oy);
  drawStage(c, tk);
  uvFloor(c, g, tk);   // Ultimates: marks on the floor (Phoenix's target, the Wizard's stars)
  bossFloor(c, g, tk);   // a boss's tells on the floor (ui/draw-boss.js)
  TEAM_RIM = !!(match && match.duo && g.fighters.length === 4);   // 2v2: team rims on the fighters (draw-world.js)
  for (const f of g.fighters) drawShadow(c, f);
  drawTrails(c, g);
  for (const f of g.fighters) drawRespawnPlat(c, f, tk);
  for (const f of g.fighters) f._ravenOut = g.projs.some((p) => p.owner === f.slot && p.style === "raven");
  for (const p of g.projs) drawProj(c, p, tk);
  const order = [...g.fighters].sort((a, b) => (a.slot === 0 ? 1 : 0) - (b.slot === 0 ? 1 : 0));
  const us = uvVeilSlot(g);   // the super freeze: the veil goes over the stage and the other fighter, the user is drawn lit on top of it
  if (us >= 0) {
    for (const f of order) if (f.slot !== us && f.state !== "dead" && f.state !== "gone") drawFighter(c, f, tk);
    uvVeil(c, g, tk);
    uvLitFighter(c, g.fighters[us], tk);
  } else for (const f of order) if (f.state !== "dead" && f.state !== "gone") drawFighter(c, f, tk);
  TEAM_RIM = false;
  uvFront(c, g, tk);   // Ultimates: what is drawn over the fighters (flame column, comet, chains, fire stream, slashes)
  drawFx(c);
  if (mode === "match" && !FIN.on && match && match.duo && g.fighters.length === 4) duoTags(c, g);   // 2v2: a tag on all four (draw-world.js)
  else if (mode === "match" && !FIN.on) {
    const [a, b] = g.fighters;
    const close = Math.abs(a.x - b.x) * cam.z < 44 && Math.abs((a.y - a.s.h) - (b.y - b.s.h)) * cam.z < 22;
    drawTag(c, a, meSlot === 0, meSlot === 1 && close ? 20 : 0); drawTag(c, b, meSlot === 1, meSlot === 0 && close ? 20 : 0);
  }
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  bossScreen(c, g, tk);   // a boss's layer in screen space, over the fight (Kraken Spud's ink; ui/draw-boss.js)
  drawScreenFx(c);
  uvScreen(c, g);   // Ultimates: the flash, speed lines, the banner and the Dead Eye vignette
  if (mode === "match") drawCombos(c, g);
  drawBubbles(c, g, tk);
  c.restore();
}

/* ===================== events from the simulation ===================== */
function handleEvent(g, e, live) {
  skinEvent(g, e);
  bossEvent(g, e, live);   // a boss's moves, staggers and fall: looks and sounds (ui/draw-boss.js)
  duoEvent(g, e, live);    // 2v2: the Catch's pop (ui/duo.js)
  switch (e.type) {
    case "hit": {
      if (e.fin && live) finHit(g, e);   // finisher-ui: the finishing blow's flash + banner (finHit lives in finisher.js)
      if (e.chg >= BL.TUNE.chgMax) chargedPop(e);   // a full-charge heavy: the "CHARGED" pop
      spark(e.x, e.y, e.ult ? (e.ps === "cloud" && e.kb < 12 ? "#9bff6a" : UV_GOLD) : e.fire ? "#ff8a3d" : col(e.pal), e.kb, e.dirx, e.diry);   // an ulti's hit: gold-tinged
      if (e.ult) uvHit(g, e, live);
      const hAtt = !e.ps && !e.armor ? g.fighters[e.slot] : null;   // a heavy connecting: bigger ring plus the fighter's own sparks
      if (hAtt && isHeavyKey(hAtt.mid)) heavyHit(hAtt, e);
      else if (hAtt && hAtt.move && hAtt.move.shot) gunSpark(e, 4);   // a Gunslinger light shot: a small gold spark where it lands
      const rt = e.def !== undefined ? comboRoute(g, e) : null;   // a named combo route (ui/combos.js)
      if (rt && rt.fresh && live) roadRoute(e, rt);   // ui/road.js: a stop's combo star
      if (rt && rt.fresh && live) Sfx.route();
      if (e.combo >= 2 && e.def !== undefined) combos[e.def] = { n: e.combo, dmg: Math.round(e.comboDmg), t: 0, col: col(e.pal), fin: !!e.finisher, pop: rt && rt.fresh ? 1.6 : 1, at: combos[e.def] && combos[e.def].at, route: rt ? rt.name : "" };
      if (e.finisher) cam.shake = Math.max(cam.shake, 7);
      if (e.fire) for (let i = 0; i < 10; i++) ember(e.x, e.y, (Math.random() - 0.5) * 6, -Math.random() * 4);
      if (e.kb > 12) cam.shake = Math.max(cam.shake, Math.min(16, e.kb * 0.45));
      if (live) e.armor ? Sfx.armor() : Sfx.hit(e.kb);
      break;
    }
    case "lethal": if (live) { finLethal(g, e); roadEvent(g, e); } break;   // the hit that cannot be survived: KO zoom, or the finisher on the last life
    case "chargeMax": if (live && e.slot === meSlot) finChargeMax(); break;
    case "ko":
      if (e.doomed && FIN.on) { trails[e.slot].length = 0; break; }   // the finisher stages its own exit
      sfx.push({ k: "beam", wx: e.x, wy: e.y, t: 0, life: 50, col: col(e.pal),
        fries: Array.from({ length: 8 }, () => ({ da: (Math.random() - 0.5) * 1.1, sp: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, len: 12 + Math.random() * 8 })) });
      sfx.push({ k: "flash", t: 0, life: 10 });
      cam.shake = 20; trails[e.slot].length = 0;
      { const ma = mapArt(); if (ma.ko) ma.ko(e, live); }   // the map's own KO splash (draw-world.js MAP_ART)
      if (live) Sfx.ko();
      break;
    case "jump": if (live && !e.rec && e.slot === meSlot) hudX.jb = true;   // the Special button grows while this jump lasts (updateHud)
      if (e.rec && g.fighters[e.slot] && g.fighters[e.slot].spec.look.costume === "gunslinger") { powderJump(e, g.fighters[e.slot].facing, live); break; }   // Gunslinger: the recovery is a shot fired down
      if (e.rec && g.fighters[e.slot] && g.fighters[e.slot].spec.look.costume === "reaper") { graveRise(e, g.fighters[e.slot], live); break; }   // Reaper: a dark cloud lifts him
      if (e.ground) dust(e.x, e.y, 5, 18); else addFx({ k: "ring", x: e.x, y: e.y - 4, t: 0, life: 12, r0: 6, r1: 26, col: "#d9d4ea" }); if (live) Sfx.jump(); break;
    case "land": dust(e.x, e.y, 3, 22); break;
    case "bounce": dust(e.x, e.y, 6, 30); break;
    case "pound": addFx({ k: "shock", x: e.x, y: e.y, t: 0, life: 18 }); dust(e.x, e.y, 8, 50); cam.shake = Math.max(cam.shake, 6); break;
    case "swing": {
      const hSw = g.fighters[e.slot];   // a heavy: camera shake and the low heavy sound arrive when the hit window opens
      // an ulti has its own sound (Sfx.ulti on the "ulti" event), a Gunslinger light is a shot (Sfx.pop on its first active frame, uvShotTick)
      if (live && !e.ult && !(hSw && hSw.move && hSw.move.shot)) Sfx.swing(e.heavy);
      if (hSw && isHeavyKey(hSw.mid)) heavySwing(g, hSw, live);
      if (hSw && hSw.mid === "spec" && hSw.spec.look.costume === "reaper") harvestSwing(g, hSw, live);
      break;
    }
    case "ulti": uvStart(g, e, live); break;      // the press: the super freeze (the sim holds 30 ticks)
    case "ultMark": uvMark(g, e, live); break;    // Phoenix's comet spot picked / Samurai's dash passed the opponent
    case "ultLand": uvLand(g, e, live); break;    // Phoenix's comet hits the floor
    case "proj":
      if (e.style === "cloud") { uvCloudBurst(g, e, live); }
      else if (e.style === "spear") { uvSpearThrow(g, e, live); }
      else if (e.style === "star") { uvStarCall(g, e, live); }
      else if (e.style === "orb" || e.style === "bolt") { if (live) Sfx.bolt(e.style === "orb"); }
      else if (e.style === "raven") { if (live) Sfx.caw(); }
      else if (e.style === "fire") { for (let i = 0; i < 6; i++) ember(e.x, e.y, (Math.random() - 0.5) * 3, -Math.random() * 2); if (live) Sfx.fire(); }
      else if (e.style === "fry") { if (live) Sfx.fry(); }
      else if (e.style === "bullet" || e.style === "gold") {
        const sh = g.fighters[e.slot], d = sh ? sh.facing : 1, gold = e.style === "gold";
        if (sh && sh.mid === "ulti") uvDeadEyeShot(g, e, sh, gold);   // Dead Eye: a bigger flash, ring and shell for each of the six
        for (let i = 0; i < (gold ? 6 : 2); i++) addFx({ k: "puff", x: e.x + d * (8 + Math.random() * 10), y: e.y + (Math.random() - 0.5) * 6, vx: d * (0.4 + Math.random()), vy: -0.3 - Math.random() * 0.6, r: 2.5 + Math.random() * (gold ? 4 : 2), t: 0, life: 20 + Math.random() * 12, col: "#d6cfdc" });
        if (gold) { addFx({ k: "ring", x: e.x + d * 10, y: e.y, t: 0, life: 14, r0: 4, r1: 40, col: "#ffcf3d" }); cam.shake = Math.max(cam.shake, 5); }
        if (live) Sfx.shot(gold);
      }
      else if (live) Sfx.swing(true);
      break;
    case "burst":
      if (g.fighters[e.slot] && g.fighters[e.slot].spec.boss) break;   // his fireballs land in fire (ui/draw-boss.js), not the Alchemist's green
      addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 16, r0: 8, r1: e.r * 1.2, col: "#7dff62" });
      for (let i = 0; i < 12; i++) addFx({ k: "line", x: e.x, y: e.y, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 7, t: 0, life: 12 + Math.random() * 8, col: i % 2 ? "#d9ffcf" : "#55e05a", w: 2.5 });
      cam.shake = Math.max(cam.shake, 5);
      if (live) Sfx.burst();
      break;
    case "projEnd":
      if (e.style === "star" || e.style === "bigstar") uvStarLand(g, e, live);   // the Wizard's stars: an impact sparkle on the floor
      else if (e.style === "fire") { addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 6, r1: 34, col: "#ff8a3d" }); for (let i = 0; i < 10; i++) ember(e.x, e.y, (Math.random() - 0.5) * 6, -Math.random() * 4); }
      else dust(e.x, e.y, 2, 10);
      break;
    case "go": if (live) { showBanner("Go!", "", "go", 650); Sfx.count(true); roadEvent(g, e); } break;
    case "tech": dust(e.x, e.y, 6, 30); addFx({ k: "ring", x: e.x, y: e.y - 4, t: 0, life: 12, r0: 8, r1: 30, col: "#d9d4ea" }); if (live) Sfx.jump(); break;
    case "sudden":
      combos.fill(null); clearTrails();
      if (live) { showBanner("Sudden death", "Next KO wins", "game", 1700); Sfx.count(true); }
      camStep(g, true);
      break;
    case "game":
      if (!live) break;
      roadEvent(g, e);
      // the last life lost to a lethal hit starts the finisher on that hit; a self-destruct, a time-out or the tutorial keep the banner
      if (e.hit && finWanted(g)) finStart(g);
      else showBanner(g.endReason === "time" ? "Time!" : "Game!", "", "game", 0);
      break;
    case "over":
      if (!live) { newAttract(); break; }
      if (finHold(() => { if (match && match.online) finishOnline(false); else finishMatch(false); })) break;
      if (match && match.online) finishOnline(false); else finishMatch(false);
      break;
  }
}


/* ===================== Ultimates: the super freeze and the cues of the ulti being played (UI only) =====================
   Everything here reads the game (g, the events) and writes only UI state (UV, fx, sfx, cam). The sim holds 30 ticks (g.hitstop) on the
   "ulti" event; the UI clock UV.t keeps counting through the freeze (updateFx runs every sim tick, frozen or not). In the freeze the
   camera punches in on the user (camPunch), a white-gold flash and speed lines burst from him, a veil dims the stage and the other
   fighter, the user is drawn lit with a gold rim and aura (uvLitFighter) and the banner "ULTIMATE · NAME" wipes across.
   The looks of each ulti are in draw-fighters.js (poses, uvFloor, uvFront), draw-world.js (the projectiles) and below (events). */
const UV_GOLD = "#ffd23f", UV_PALE = "#fff2c2";
const UV_FREEZE = BL.TUNE.ultFreeze, UV_BANNER = 60;
const UV = { g: null, slot: -1, t: 999, name: "", col: UV_GOLD, cueG: null, cues: new Set(), pulse: new WeakMap(), spear: [false, false, false, false], dash: [null, null, null, null], at: [null, null, null, null] };
const uvLive = (g) => UV.g === g && mode === "match" && !FIN.on;
// once per move and name (a cue that waits on a frame must not fire again while the game is held in hitstop)
function uvCue(f, name) { const k = f.slot + "." + f.moveT + "." + name; if (UV.cues.has(k)) return false; UV.cues.add(k); return true; }
const uvHeld = (f) => (f && f.state === "attack" && f.mid === "ulti" && f.move && f.move.ult ? f.move.ult : "");

function uvStart(g, e, live) {
  const f = g.fighters[e.slot];
  if (!f || !live) return;   // (the menu's demo match plays the move without the freeze show)
  Object.assign(UV, { g, slot: e.slot, t: 0, name: e.name, col: col(f.pal) });
  const cy = e.y - f.s.h * 0.5;
  // the punch aims a little above him (about 12% of the screen) so he stands lower in the frame and the banner does not cover his head
  camPunch(e.x, cy - (L.gh * 0.12) / (Math.max(0.2, cam.bz * 1.52) * 0.6), 1.15, UV_FREEZE + 22, 0.1, UV_FREEZE / (UV_FREEZE + 22));
  addFx({ k: "ring", x: e.x, y: cy, t: 0, life: 22, r0: 12, r1: 150, col: UV_GOLD });
  addFx({ k: "ring", x: e.x, y: cy, t: 0, life: 30, r0: 8, r1: 210, col: "#ffffff" });
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.2; addFx({ k: "line", x: e.x + Math.cos(a) * 26, y: cy + Math.sin(a) * 26, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, t: 0, life: 16 + (i % 3) * 3, col: i % 2 ? "#ffffff" : UV_GOLD, w: 3 }); }
  Sfx.ulti();
}
function uvVeilSlot(g) { const f = uvLive(g) && UV.t < 48 ? g.fighters[UV.slot] : null; return f && f.state !== "dead" && f.state !== "gone" ? UV.slot : -1; }
const uvVeilK = () => (UV.t < 4 ? UV.t / 4 : UV.t < UV_FREEZE ? 1 : clamp(1 - (UV.t - UV_FREEZE) / 16, 0, 1));

// the user's silhouette, drawn once into a small canvas in one flat colour (the gold rim, the lit wash, the Samurai's afterimages)
const UV_SIL = { cv: null, cx: null, S: 340 };
function uvSil(f, tk, colr) {
  const S = UV_SIL.S;
  if (!UV_SIL.cv) { UV_SIL.cv = document.createElement("canvas"); UV_SIL.cv.width = UV_SIL.cv.height = S; UV_SIL.cx = UV_SIL.cv.getContext("2d"); }
  const x = UV_SIL.cx;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, S, S);
  x.setTransform(1, 0, 0, 1, S / 2, S * 0.8);
  drawFighter0(x, f, tk, [0, 0]);
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
  x.globalCompositeOperation = "source-in"; x.fillStyle = colr; x.fillRect(0, 0, S, S); x.globalCompositeOperation = "source-over";
  return UV_SIL.cv;
}
function uvVeil(c, g, tk) {
  const f = g.fighters[UV.slot], k = uvVeilK();
  c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const [sx, sy] = toScreen(f.x, f.y - f.s.h * 0.5 * uvScale(f)), R = Math.hypot(L.gw, L.gh);
  const gr = c.createRadialGradient(sx, sy, R * 0.07, sx, sy, R * 0.6);
  gr.addColorStop(0, `rgba(12,8,34,${0.2 * k})`); gr.addColorStop(1, `rgba(6,4,22,${0.66 * k})`);
  c.fillStyle = gr; c.fillRect(0, 0, L.gw, L.gh);
  c.restore();
}
// the user in the freeze: aura and rays behind, a gold rim round the figure, then the figure with a pale gold wash
function uvLitFighter(c, f, tk) {
  const k = uvVeilK(), pulse = 0.86 + 0.14 * Math.sin(tk * 0.5), S = UV_SIL.S, hide = uvHidden(f);
  const cy = f.y - f.s.h * 0.5 * uvScale(f);
  c.save(); c.translate(f.x, cy);
  glowDot(c, 0, 0, 150 * pulse, 0.6 * k, UV_GOLD);
  if (!reducedMotion()) {
    c.rotate(tk * 0.012); c.fillStyle = `rgba(255,236,150,${0.2 * k})`;
    for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an - 0.07) * 200, Math.sin(an - 0.07) * 200); c.lineTo(Math.cos(an + 0.07) * 200, Math.sin(an + 0.07) * 200); c.closePath(); c.fill(); }
  }
  c.restore();
  if (hide) return;
  const sil = uvSil(f, tk, "#ffd84a"), d = 2.8 / cam.z, ox = f.x - S / 2, oy = f.y - S * 0.8;
  c.globalAlpha = 0.95 * k;
  for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2 + 0.4; c.drawImage(sil, ox + Math.cos(an) * d, oy + Math.sin(an) * d); }
  c.globalAlpha = 1;
  drawFighter(c, f, tk);
  c.globalAlpha = 0.24 * k * pulse; c.drawImage(sil, ox, oy); c.globalAlpha = 1;
}

// ---- once per sim tick ----
function uvTick(g) {
  if (UV.t < 999) UV.t++;
  if (UV.cueG !== g) { UV.cueG = g; UV.cues.clear(); UV.spear = [false, false, false, false]; UV.dash = [null, null, null, null]; UV.at = [null, null, null, null]; }
  if (UV.t > 1 && UV.t < UV_FREEZE - 2 && uvLive(g)) cam.shake = Math.max(cam.shake, 1.8);   // the held screen trembles
  for (const f of g.fighters) {
    if (uvHeld(f)) uvFighterTick(g, f);
    else if (f.state === "attack" && f.move && f.move.shot && f.spec.look.costume === "gunslinger") uvShotTick(g, f);   // the Gunslinger's light shots
  }
  for (const p of g.projs) if (p.style === "cloud") uvCloudTick(g, p);
  g.fighters.forEach((f, i) => {   // Odin's spear came home (a spear that hit is gone far from him): a small catch
    const sp = g.projs.find((p) => p.owner === i && p.style === "spear");
    if (UV.spear[i] && !sp && f.state !== "dead" && f.state !== "gone" && Math.abs(UV.spear[i].x - f.x) < 80) {
      const cx = f.x + f.facing * 12, cy = f.y - 34;
      addFx({ k: "ring", x: cx, y: cy, t: 0, life: 14, r0: 6, r1: 38, col: UV_GOLD });
      for (let j = 0; j < 6; j++) addFx({ k: "uv", sub: "spark4", x: cx, y: cy, vx: frand(-3, 3), vy: frand(-3, 1), s: frand(4, 7), col: j % 2 ? "#ffffff" : UV_GOLD, t: 0, life: 16, damp: 0.9 });
      if (mode === "match" && !FIN.on) Sfx.ultMark();
    }
    UV.spear[i] = sp ? { x: sp.x } : false;
  });
}
// the ground a mark sits on: the main floor, or the platform the comet will land on
const uvFloorY = (f) => (f.ultTgt >= 0 && STAGE.plats[f.ultTgt] ? STAGE.plats[f.ultTgt].y : STAGE.main.top);

function uvMark(g, e, live) {
  const f = g.fighters[e.slot];
  if (e.def === undefined) {   // Phoenix: the spot is picked; two rings close in on it
    const fy = f ? uvFloorY(f) : 0;
    for (let i = 0; i < 2; i++) addFx({ k: "uv", sub: "ringf", x: e.x, y: fy, r0: 120 + i * 40, r1: 78, col: UV_GOLD, t: -i * 6, life: 22 });
    if (live) Sfx.ultMark();
    return;
  }
  // Samurai: the dash passed the opponent, who is held still until the cut
  addFx({ k: "ring", x: e.x, y: e.y - 34, t: 0, life: 12, r0: 6, r1: 50, col: "#ffffff" });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; addFx({ k: "line", x: e.x, y: e.y - 34, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, t: 0, life: 10, col: "#ffffff", w: 2.4 }); }
  sfx.push({ k: "flash", t: 0, life: 6 });
}
function uvLand(g, e, live) {   // Phoenix's comet hits the floor
  addFx({ k: "uv", sub: "dome", x: e.x, y: e.y, r1: 200, t: 0, life: 22 });
  addFx({ k: "uv", sub: "ringf", x: e.x, y: e.y, r0: 20, r1: 240, col: UV_GOLD, t: 0, life: 22 });
  addFx({ k: "uv", sub: "ringf", x: e.x, y: e.y, r0: 10, r1: 160, col: "#ffffff", t: 0, life: 14 });
  dust(e.x, e.y, 12, 90);
  for (let i = 0; i < 22; i++) ember(e.x + frand(-40, 40), e.y - frand(0, 12), frand(-5, 5), -frand(2, 9));
  for (let i = 0; i < 8; i++) addFx({ k: "uv", sub: "spark4", x: e.x + frand(-30, 30), y: e.y - 10, vx: frand(-5, 5), vy: -frand(2, 8), s: frand(5, 9), col: i % 2 ? "#ffffff" : UV_GOLD, t: 0, life: 22, damp: 0.93, g: 0.25 });
  cam.shake = Math.max(cam.shake, 15);
  sfx.push({ k: "flash", t: 0, life: 10 });
  if (live) { camPunch(e.x, e.y - 40, 0.45, 16); Sfx.ultLand(); }
}
// an ulti's hit lands: a gold ring and chime on all of them; the Samurai's cut is a big white line and a burst of petals
function uvHit(g, e, live) {
  const att = g.fighters[e.slot], cos = att ? att.spec.look.costume : "", pulse = e.ps === "cloud" && e.kb < 12;
  if (!pulse) addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 16, r0: 8, r1: 34 + e.kb * 2, col: UV_GOLD });
  if (live && !pulse) Sfx.ultHit();
  if (cos === "samurai" && !e.ps) {
    const a = -0.5 * (att.facing >= 0 ? 1 : -1);
    addFx({ k: "uv", sub: "cut", x: e.x, y: e.y, ang: a, len: 230, w: 13, t: 0, life: 26 });
    addFx({ k: "uv", sub: "cut", x: e.x, y: e.y, ang: a + 1.15, len: 150, w: 6, t: 0, life: 20 });
    addFx({ k: "uv", sub: "cut", x: e.x, y: e.y, ang: a - 0.45, len: 170, w: 5, t: 0, life: 22 });
    for (let i = 0; i < 26; i++) addFx({ k: "petal", x: e.x + frand(-16, 16), y: e.y + frand(-20, 14), vx: frand(-6, 6), vy: frand(-5, 0.5), rot: frand(0, 6), vr: frand(-0.3, 0.3), col: i % 3 ? mix(att.pal.accent, "#ffb7c9", 0.65) : "#ffffff", r: frand(2.6, 4.2), t: 0, life: frand(34, 52), g: 0.06, damp: 0.95 });
    sfx.push({ k: "flash", t: 0, life: 8 });
    cam.shake = Math.max(cam.shake, 10);
    if (live) { camPunch(e.x, e.y, 0.55, 14); Sfx.cutClick(); }
  }
  if (e.ps === "spear") for (let i = 0; i < 8; i++) addFx({ k: "uv", sub: "spark4", x: e.x, y: e.y, vx: frand(-5, 5), vy: frand(-5, 3), s: frand(5, 9), col: i % 2 ? "#ffffff" : UV_GOLD, t: 0, life: 18, damp: 0.9 });
  if (e.ps === "bigstar" || e.ps === "star") for (let i = 0; i < 6; i++) addFx({ k: "uv", sub: "spark4", x: e.x, y: e.y, vx: frand(-5, 5), vy: frand(-6, 1), s: frand(4, 8), col: i % 2 ? "#bff3ff" : UV_GOLD, t: 0, life: 18, damp: 0.9 });
}

// ---- Alchemist: the cloud bursts out of the flask, pulses wet and heavy, and the last pulse is a burst ----
function uvCloudBurst(g, e, live) {
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 16, r0: 10, r1: 96, col: "#9bff6a" });
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, sp = frand(1, 4); addFx({ k: "puff", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4, r: frand(8, 16), t: 0, life: frand(22, 36), col: i % 2 ? "#7fe05a" : "#b8ff90" }); }
  if (live) Sfx.cloud();
}
function uvCloudTick(g, p) {
  if (p.t < 30 || p.t % 30 !== 0 || UV.pulse.get(p) === p.t) return;
  UV.pulse.set(p, p.t);
  const last = p.t + 30 > p.life;
  addFx({ k: "uv", sub: "toxring", x: p.x, y: p.y, r0: p.r * 0.9, r1: p.r * (last ? 1.9 : 1.45), t: 0, life: last ? 22 : 16, last });
  for (let i = 0; i < (last ? 16 : 7); i++) { const a = Math.random() * 6.28, sp = frand(1.5, last ? 7 : 4); addFx({ k: "puff", x: p.x + Math.cos(a) * p.r * 0.6, y: p.y + Math.sin(a) * p.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5, r: frand(7, 14), t: 0, life: frand(20, 34), col: i % 2 ? "#7fe05a" : "#d4ffbc" }); }
  if (last) for (let i = 0; i < 8; i++) addFx({ k: "uv", sub: "spark4", x: p.x, y: p.y, vx: frand(-8, 8), vy: frand(-8, 4), s: frand(5, 9), col: i % 2 ? "#ffffff" : UV_GOLD, t: 0, life: 22, damp: 0.92 });
  cam.shake = Math.max(cam.shake, last ? 9 : 2.5);
  if (mode === "match" && !FIN.on) Sfx.cloudPulse(last);
}
// ---- Odin: the throw ----
function uvSpearThrow(g, e, live) {
  const f = g.fighters[e.slot], d = f ? f.facing : 1;
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 6, r1: 46, col: UV_GOLD });
  for (let i = 0; i < 7; i++) addFx({ k: "uv", sub: "spark4", x: e.x, y: e.y + frand(-10, 10), vx: d * frand(1, 6), vy: frand(-2, 2), s: frand(4, 7), col: i % 2 ? "#ffffff" : UV_GOLD, t: 0, life: 16, damp: 0.9 });
  cam.shake = Math.max(cam.shake, 4);
  if (live) Sfx.spear();
}
// ---- Wizard: every star called flares the crystal (the stars themselves are projectiles, the marks are on the floor) ----
function uvStarCall(g, e, live) {
  const f = g.fighters[e.slot];
  if (f) {
    const [tx, ty] = staffTip(f, tick);
    addFx({ k: "ring", x: tx, y: ty, t: 0, life: 12, r0: 4, r1: 40, col: "#bff3ff" });
    addFx({ k: "uv", sub: "beam", x: tx, y: ty, t: 0, life: 12 });
    for (let i = 0; i < 5; i++) addFx({ k: "uv", sub: "spark4", x: tx, y: ty, vx: frand(-2, 2), vy: -frand(1, 5), s: frand(3, 6), col: i % 2 ? "#fff6d8" : "#bff3ff", t: 0, life: 18, damp: 0.92 });
  }
  if (live) Sfx.starCall();
}
function uvStarLand(g, e, live) {
  const big = e.style === "bigstar";
  addFx({ k: "uv", sub: "ringf", x: e.x, y: e.y, r0: 8, r1: big ? 96 : 64, col: big ? UV_GOLD : "#bff3ff", t: 0, life: big ? 20 : 15 });
  addFx({ k: "ring", x: e.x, y: e.y - 6, t: 0, life: 12, r0: 4, r1: big ? 50 : 34, col: "#ffffff" });
  for (let i = 0; i < (big ? 12 : 7); i++) { const a = -Math.PI / 2 + frand(-1.3, 1.3), sp = frand(3, big ? 9 : 6); addFx({ k: "uv", sub: "spark4", x: e.x, y: e.y - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: frand(4, big ? 10 : 7), col: i % 3 ? (big ? UV_GOLD : "#bff3ff") : "#ffffff", t: 0, life: 20, damp: 0.92, g: 0.22 }); }
  dust(e.x, e.y, big ? 6 : 3, 30);
  cam.shake = Math.max(cam.shake, big ? 8 : 3);
  if (live) Sfx.starHit(big);
}
// ---- Gunslinger: each of the six shots gets a flash ring, a star at the muzzle, a shell and smoke; the sixth is bigger ----
function uvDeadEyeShot(g, e, f, gold) {
  const d = f.facing, mx = e.x + d * 14;
  addFx({ k: "ring", x: mx, y: e.y, t: 0, life: gold ? 18 : 10, r0: 4, r1: gold ? 70 : 34, col: gold ? "#ffcf3d" : "#ff9a4d" });
  addFx({ k: "star", x: mx + d * 6, y: e.y, t: 0, life: gold ? 9 : 6, s: gold ? 54 : 30 });
  for (let i = 0; i < (gold ? 10 : 4); i++) addFx({ k: "line", x: mx, y: e.y, vx: d * frand(4, 12), vy: frand(-3, 3), t: 0, life: 9, col: i % 2 ? "#fff6d8" : "#ff9a4d", w: 2 });
  gunShell(f, 10, -34);
  cam.shake = Math.max(cam.shake, gold ? 8 : 2.6);
}

// ---- the screen layer of the super freeze: flash, speed lines, the banner (and the Dead Eye vignette, draw-fighters.js) ----
function uvScreen(c, g) {
  if (mode !== "match" || FIN.on) return;
  uvEyeVignette(c, g);
  if (UV.g !== g || UV.t > UV_BANNER) return;
  const t = UV.t, f = g.fighters[UV.slot];
  if (!f) return;
  const calm = reducedMotion(), [sx, sy] = toScreen(f.x, f.y - f.s.h * 0.5 * uvScale(f)), R = Math.max(L.gw, L.gh);
  c.save();
  if (t < 16) {   // the flash: white-gold, brightest at the user
    const a = Math.pow(1 - t / 16, 1.5) * (calm ? 0.35 : 1);
    const gr = c.createRadialGradient(sx, sy, 0, sx, sy, R * 0.85);
    gr.addColorStop(0, `rgba(255,252,230,${0.95 * a})`); gr.addColorStop(0.3, `rgba(255,230,150,${0.62 * a})`); gr.addColorStop(1, `rgba(255,205,100,${0.18 * a})`);
    c.fillStyle = gr; c.fillRect(0, 0, L.gw, L.gh);
  }
  if (t < UV_FREEZE + 4 && !calm) {   // speed lines streaming out of him
    c.lineCap = "round";
    const fade = t < 24 ? 1 : 1 - (t - 24) / 10;
    for (let i = 0; i < 22; i++) {
      const an = (i / 22) * Math.PI * 2 + nz(i * 3.7) * 0.25, ph = (t * 0.045 + nz(i * 9.1)) % 1;
      const r0 = R * (0.1 + 0.5 * ph), r1 = r0 + R * (0.16 + 0.2 * nz(i * 5.3)), ca = Math.cos(an), sa = Math.sin(an);
      c.globalAlpha = Math.max(0, (1 - ph) * 0.55 * fade); c.strokeStyle = i % 3 ? UV_PALE : "#ffffff"; c.lineWidth = 1.5 + 2 * nz(i * 2.3);
      c.beginPath(); c.moveTo(sx + ca * r0, sy + sa * r0); c.lineTo(sx + ca * r1, sy + sa * r1); c.stroke();
    }
    c.globalAlpha = 1;
  }
  uvBanner(c, t);
  c.restore();
}
function uvBanner(c, t) {
  const gw = L.gw, gh = L.gh, inK = clamp(t / 8, 0, 1), outK = clamp((t - (UV_BANNER - 12)) / 12, 0, 1);
  if (inK <= 0 || outK >= 1) return;
  const bh = clamp(gh * 0.15, 38, 66), by = gh * (L.portrait ? 0.34 : 0.3);
  const label1 = "ULTIMATE", label2 = " · " + UV.name.toUpperCase();
  let fs = bh * 0.62;
  const fnt = (s) => `italic 900 ${s}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  c.font = fnt(fs);
  const w0 = c.measureText(label1).width + c.measureText(label2).width;
  if (w0 > gw * 0.9) { fs *= (gw * 0.9) / w0; c.font = fnt(fs); }
  const w1 = c.measureText(label1).width, w2 = c.measureText(label2).width;
  c.save(); c.translate(gw / 2, by); c.rotate(-0.05);
  // the band wipes in from the left and out to the right
  const span = gw * 1.5, xl = -span * 0.5 + easeOut2(outK) * span * 1.1, xr = -span * 0.5 + easeOut2(inK) * span * 1.1;
  c.beginPath(); c.rect(xl, -bh, Math.max(0, xr - xl), bh * 2); c.clip();
  c.fillStyle = "rgba(10,8,28,0.88)"; c.fillRect(-gw, -bh / 2, gw * 2, bh);
  c.fillStyle = UV.col; c.fillRect(-gw, -bh / 2, gw * 2, 4); c.fillRect(-gw, bh / 2 - 4, gw * 2, 4);
  c.fillStyle = UV_GOLD; c.fillRect(-gw, -bh / 2 + 4, gw * 2, 2); c.fillRect(-gw, bh / 2 - 6, gw * 2, 2);
  if (t > 5 && t < 30) {   // a gold shine runs along the band
    const sx = -gw * 0.6 + ((t - 5) / 24) * gw * 1.3, sh = c.createLinearGradient(sx - bh, 0, sx + bh, 0);
    sh.addColorStop(0, "rgba(255,240,170,0)"); sh.addColorStop(0.5, "rgba(255,240,170,0.38)"); sh.addColorStop(1, "rgba(255,240,170,0)");
    c.fillStyle = sh; c.fillRect(sx - bh, -bh / 2, bh * 2, bh);
  }
  // the words slide the other way, slowly, and leave to the left
  const tx = (1 - easeOut2(inK)) * gw * 0.45 - clamp(t - 8, 0, 44) * 0.9 - easeOut2(outK) * gw * 0.35;
  c.transform(1, 0, -0.2, 1, 0, 0);
  c.textBaseline = "middle"; c.textAlign = "left"; c.lineJoin = "round";
  const x0 = tx - (w1 + w2) / 2, ty = bh * 0.03;
  c.lineWidth = fs * 0.2; c.strokeStyle = "rgba(6,4,18,0.95)";
  c.strokeText(label1, x0, ty); c.strokeText(label2, x0 + w1, ty);
  const gg = c.createLinearGradient(0, -fs * 0.5, 0, fs * 0.5); gg.addColorStop(0, "#fff3b0"); gg.addColorStop(0.55, UV_GOLD); gg.addColorStop(1, "#e89a12");
  c.fillStyle = gg; c.fillText(label1, x0, ty);
  c.fillStyle = UV.col; c.fillText(label2, x0 + w1, ty);
  c.fillStyle = "rgba(255,255,255,0.28)"; c.save(); c.beginPath(); c.rect(x0 - 4, ty - fs * 0.6, w1 + w2 + 8, fs * 0.5); c.clip(); c.fillText(label2, x0 + w1, ty); c.restore();
  c.restore();
}
const easeOut2 = (x) => 1 - (1 - x) * (1 - x) * (1 - x);

// ---- the "uv" particles (k: "uv", sub: ...): flat rings, the Phoenix dome, sparkles, the Samurai's cut line, toxic rings, beams ----
function uvDrawFx(c, e, a) {
  if (e.t < 0) return;
  const q = e.t / e.life;
  switch (e.sub) {
    case "ringf": {   // a ring lying on the floor
      const r = lerp(e.r0, e.r1, easeOut2(q));
      c.globalAlpha = a * 0.9; c.strokeStyle = e.col; c.lineWidth = 4 * a + 1.2;
      c.beginPath(); c.ellipse(e.x, e.y, r, r * 0.26, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = a * 0.16; c.fillStyle = e.col; c.fill();
      break;
    }
    case "dome": {   // Phoenix's landing: a dome of white-gold fire that rises and thins
      const r = e.r1 * (0.4 + 0.6 * easeOut2(Math.min(1, q * 1.8))), fa = Math.min(1, a * 1.6);
      c.save(); c.translate(e.x, e.y); c.scale(1, 0.7);
      const gr = c.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
      gr.addColorStop(0, `rgba(255,252,225,${fa})`); gr.addColorStop(0.3, `rgba(255,214,100,${0.95 * fa})`); gr.addColorStop(0.65, `rgba(255,110,34,${0.7 * fa})`); gr.addColorStop(1, "rgba(255,60,20,0)");
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, Math.PI, Math.PI * 2); c.closePath(); c.fill();
      c.globalCompositeOperation = "lighter"; glowDot(c, 0, -r * 0.1, r * 0.55, 0.8 * fa, "#fff3c0");
      c.restore();
      break;
    }
    case "spark4": c.globalAlpha = Math.min(1, a * 1.5); star4(c, e.x, e.y, e.s * (0.4 + 0.6 * a), e.col); break;
    case "cut": {   // a long white lens, thin at both ends, with a gold edge: it flashes in, holds, fades
      const grow = Math.min(1, (e.t + 1) / 3), len = e.len * easeOut2(grow), w = e.w * (1 - q * 0.55);
      c.save(); c.translate(e.x, e.y); c.rotate(e.ang);
      const lens = (ln, wd) => { c.beginPath(); c.moveTo(-ln, 0); c.quadraticCurveTo(0, -wd, ln, 0); c.quadraticCurveTo(0, wd, -ln, 0); c.closePath(); c.fill(); };
      c.globalAlpha = Math.min(1, a * 1.4) * 0.8; c.fillStyle = UV_GOLD; lens(len, w * 1.7);
      c.globalAlpha = Math.min(1, a * 1.6); c.fillStyle = "#ffffff"; lens(len * 0.96, w);
      c.restore();
      break;
    }
    case "toxring": {   // the cloud pulses: a ring of toxic light running out from its edge (the last one is gold-white and big)
      const r = lerp(e.r0, e.r1, easeOut2(q));
      c.globalAlpha = a * 0.9; c.strokeStyle = e.last ? "#fffbd0" : "#c9ff9e"; c.lineWidth = (e.last ? 9 : 5) * a + 1.5;
      c.beginPath(); c.arc(e.x, e.y, r, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = a * 0.28; c.strokeStyle = e.last ? UV_GOLD : "#6fe34a"; c.lineWidth = (e.last ? 22 : 12) * a; c.stroke();
      break;
    }
    case "beam": {   // the Wizard's call: a pale column to the sky
      const gr = c.createLinearGradient(0, e.y, 0, e.y - 520);
      gr.addColorStop(0, `rgba(255,246,216,${0.8 * a})`); gr.addColorStop(1, "rgba(190,243,255,0)");
      c.fillStyle = gr; c.fillRect(e.x - 5 * a - 1.5, e.y - 520, 10 * a + 3, 520);
      break;
    }
  }
  c.globalAlpha = 1;
}
