/* ===================== effects ===================== */
const fx = [], sfx = [], trails = [[], []], combos = [null, null];
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
  skinTick(g, tick);
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
  for (let i = 0; i < 2; i++) { const cb = combos[i]; if (cb) { cb.t++; cb.pop *= 0.82; if (cb.t > 80) combos[i] = null; } }
  for (let i = sfx.length - 1; i >= 0; i--) if (sfx[i].t >= sfx[i].life) sfx.splice(i, 1);
  g.fighters.forEach((f, i) => {
    const tr = trails[i];
    if (f.state === "hitstun" && Math.hypot(f.kbx, f.kby) > 7) tr.push([f.x, f.y - f.s.h * 0.5]);
    else if (tr.length) tr.shift();
    if (tr.length > 16) tr.shift();
    if (f.state === "dead" || f.state === "gone") tr.length = 0;
  });
}
function drawFx(c) {
  for (const e of fx) {
    const a = 1 - e.t / e.life;
    if (drawSkinFx(c, e, a)) continue;
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
// "3 HIT · 14%" pop-up above the fighter taking the combo
function drawCombos(c, g) {
  for (let i = 0; i < 2; i++) {
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
    c.restore();
  }
}
function drawBubbles(c, g, tk, img) {
  for (const f of g.fighters) {
    if (f.state === "dead" || f.state === "gone") continue;
    const [sx, sy] = toScreen(f.x, f.y - f.s.h * 0.5);
    const m = 6;
    if (sx > m && sx < L.gw - m && sy > m && sy < L.gh - m) continue;
    const R = 28, bx = clamp(sx, R + 10, L.gw - R - 10), by = clamp(sy, R + 64, L.gh - R - 10);
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

/*GFX3D*/

function render(g, tk) {
  // during the KO finisher the scene shows its two stand-ins instead of the real fighters
  const fin = FIN.on && mode === "match";
  if (fin) g = finFrame(g, tk);
  if (use3D()) render3D(g, tk); else render2D(g, tk);
  if (fin) finOverlay(use3D() ? octx : ctx, tk);
}
function render2D(g, tk) {
  r3Layers(false);
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.save(); c.beginPath(); c.rect(0, 0, L.gw, L.gh); c.clip();
  drawBackground(c, tk);
  finSkyTint(c);
  const ox = L.gw / 2 - cam.x * cam.z + cam.sx, oy = L.gh / 2 - cam.y * cam.z + cam.sy;
  c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * ox, DPR * oy);
  drawStage(c, tk);
  for (const f of g.fighters) drawShadow(c, f);
  drawTrails(c, g);
  for (const f of g.fighters) drawRespawnPlat(c, f, tk);
  for (const f of g.fighters) f._ravenOut = g.projs.some((p) => p.owner === f.slot && p.style === "raven");
  for (const p of g.projs) drawProj(c, p, tk);
  const order = [...g.fighters].sort((a, b) => (a.slot === 0 ? 1 : 0) - (b.slot === 0 ? 1 : 0));
  for (const f of order) if (f.state !== "dead" && f.state !== "gone") drawFighter(c, f, tk);
  drawFx(c);
  if (mode === "match" && !FIN.on) {
    const [a, b] = g.fighters;
    const close = Math.abs(a.x - b.x) * cam.z < 44 && Math.abs((a.y - a.s.h) - (b.y - b.s.h)) * cam.z < 22;
    drawTag(c, a, meSlot === 0, meSlot === 1 && close ? 20 : 0); drawTag(c, b, meSlot === 1, meSlot === 0 && close ? 20 : 0);
  }
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawScreenFx(c);
  if (mode === "match") drawCombos(c, g);
  drawBubbles(c, g, tk);
  c.restore();
}

/* ===================== events from the simulation ===================== */
function handleEvent(g, e, live) {
  skinEvent(g, e);
  switch (e.type) {
    case "hit": {
      if (e.fin && live) finHit(g, e);   // finisher-ui: the finishing blow's flash + banner (finHit lives in finisher.js)
      spark(e.x, e.y, e.fire ? "#ff8a3d" : col(e.pal), e.kb, e.dirx, e.diry);
      const hAtt = !e.ps && !e.armor ? g.fighters[e.slot] : null;   // a heavy connecting: bigger ring plus the fighter's own sparks
      if (hAtt && isHeavyKey(hAtt.mid)) heavyHit(hAtt, e);
      if (e.combo >= 2 && e.def !== undefined) combos[e.def] = { n: e.combo, dmg: Math.round(e.comboDmg), t: 0, col: col(e.pal), fin: !!e.finisher, pop: 1, at: combos[e.def] && combos[e.def].at };
      if (e.finisher) cam.shake = Math.max(cam.shake, 7);
      if (e.fire) for (let i = 0; i < 10; i++) ember(e.x, e.y, (Math.random() - 0.5) * 6, -Math.random() * 4);
      if (e.kb > 12) cam.shake = Math.max(cam.shake, Math.min(16, e.kb * 0.45));
      if (live) e.armor ? Sfx.armor() : Sfx.hit(e.kb);
      break;
    }
    case "lethal": if (live) finLethal(g, e); break;   // the hit that cannot be survived: KO zoom, or the finisher on the last life
    case "chargeMax": if (live && e.slot === meSlot) finChargeMax(); break;
    case "ko":
      if (e.doomed && FIN.on) { trails[e.slot].length = 0; break; }   // the finisher stages its own exit
      sfx.push({ k: "beam", wx: e.x, wy: e.y, t: 0, life: 50, col: col(e.pal),
        fries: Array.from({ length: 8 }, () => ({ da: (Math.random() - 0.5) * 1.1, sp: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, len: 12 + Math.random() * 8 })) });
      sfx.push({ k: "flash", t: 0, life: 10 });
      cam.shake = 20; trails[e.slot].length = 0;
      if (live) Sfx.ko();
      break;
    case "jump": if (e.ground) dust(e.x, e.y, 5, 18); else addFx({ k: "ring", x: e.x, y: e.y - 4, t: 0, life: 12, r0: 6, r1: 26, col: "#d9d4ea" }); if (live) Sfx.jump(); break;
    case "land": dust(e.x, e.y, 3, 22); break;
    case "bounce": dust(e.x, e.y, 6, 30); break;
    case "pound": addFx({ k: "shock", x: e.x, y: e.y, t: 0, life: 18 }); dust(e.x, e.y, 8, 50); cam.shake = Math.max(cam.shake, 6); break;
    case "swing": {
      if (live) Sfx.swing(e.heavy);
      const hSw = g.fighters[e.slot];   // a heavy: camera shake and the low heavy sound arrive when the hit window opens
      if (hSw && isHeavyKey(hSw.mid)) heavySwing(g, hSw, live);
      break;
    }
    case "proj":
      if (e.style === "orb" || e.style === "bolt") { if (live) Sfx.bolt(e.style === "orb"); }
      else if (e.style === "raven") { if (live) Sfx.caw(); }
      else if (e.style === "fire") { for (let i = 0; i < 6; i++) ember(e.x, e.y, (Math.random() - 0.5) * 3, -Math.random() * 2); if (live) Sfx.fire(); }
      else if (e.style === "fry") { if (live) Sfx.fry(); }
      else if (live) Sfx.swing(true);
      break;
    case "burst":
      addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 16, r0: 8, r1: e.r * 1.2, col: "#7dff62" });
      for (let i = 0; i < 12; i++) addFx({ k: "line", x: e.x, y: e.y, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 7, t: 0, life: 12 + Math.random() * 8, col: i % 2 ? "#d9ffcf" : "#55e05a", w: 2.5 });
      cam.shake = Math.max(cam.shake, 5);
      if (live) Sfx.burst();
      break;
    case "projEnd":
      if (e.style === "fire") { addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 6, r1: 34, col: "#ff8a3d" }); for (let i = 0; i < 10; i++) ember(e.x, e.y, (Math.random() - 0.5) * 6, -Math.random() * 4); }
      else dust(e.x, e.y, 2, 10);
      break;
    case "go": if (live) { showBanner("Go!", "", "go", 650); Sfx.count(true); } break;
    case "tech": dust(e.x, e.y, 6, 30); addFx({ k: "ring", x: e.x, y: e.y - 4, t: 0, life: 12, r0: 8, r1: 30, col: "#d9d4ea" }); if (live) Sfx.jump(); break;
    case "sudden":
      combos[0] = combos[1] = null; trails[0].length = trails[1].length = 0;
      if (live) { showBanner("Sudden death", "Next KO wins", "game", 1700); Sfx.count(true); }
      camStep(g, true);
      break;
    case "game":
      if (!live) break;
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

