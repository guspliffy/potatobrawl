/* ===================== drawing: world ===================== */
const STARS = Array.from({ length: 70 }, (_, i) => { const r = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1; return { x: r(1), y: r(2), s: r(3) < 0.2 ? 2 : 1, a: 0.25 + r(4) * 0.5 }; });
const ISLES = [{ x: 0.08, w: 0.2, h: 0.05 }, { x: 0.33, w: 0.12, h: 0.03 }, { x: 0.86, w: 0.24, h: 0.065 }, { x: 0.58, w: 0.08, h: 0.02 }];
// The moon is a potato: lumpy outline, a few "eyes" for craters.
function potatoMoon(c, x, y, r) {
  c.save(); c.translate(x, y); c.rotate(-0.22);
  c.beginPath();
  for (let i = 0; i <= 44; i++) {
    const a = (i / 44) * Math.PI * 2, k = 1 + 0.05 * Math.sin(a * 3 + 0.6) + 0.035 * Math.sin(a * 5 + 1.9);
    const px = Math.cos(a) * r * 1.2 * k, py = Math.sin(a) * r * 0.88 * k;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath();
  const gr = c.createRadialGradient(-r * 0.35, -r * 0.3, r * 0.1, 0, 0, r * 1.3);
  gr.addColorStop(0, "#fbe3ac"); gr.addColorStop(0.6, "#f6c98a"); gr.addColorStop(1, "#dca46a");
  c.fillStyle = gr; c.fill();
  for (const [ex, ey, er] of [[-0.55, -0.16, 0.09], [0.08, -0.44, 0.07], [0.5, 0.1, 0.1], [-0.14, 0.38, 0.065], [0.86, -0.28, 0.05]]) {
    c.beginPath(); c.ellipse(ex * r, ey * r, er * r * 1.4, er * r, 0.3, 0, Math.PI * 2); c.fillStyle = "rgba(176,114,60,0.5)"; c.fill();
    c.beginPath(); c.ellipse(ex * r + er * r * 0.35, ey * r - er * r * 0.3, er * r * 0.75, er * r * 0.4, 0.3, 0, Math.PI * 2); c.fillStyle = "rgba(255,238,196,0.35)"; c.fill();
  }
  c.restore();
}
// Far out at sea, in the same muted tones as the islands: a fry box and two giant fries.
function farFries(c, gw, gh, hz) {
  const u = Math.min(gw, gh), px = -cam.x * cam.z * 0.08;
  const fry = (x, base, len, wd, ang) => {
    c.save(); c.translate(x, base); c.rotate(ang);
    c.fillStyle = "#7a5660"; c.beginPath(); c.roundRect(-wd / 2, -len, wd, len + 4, wd * 0.22); c.fill();
    c.fillStyle = "rgba(255,214,150,0.16)"; c.fillRect(-wd / 2 + wd * 0.16, -len + wd * 0.35, wd * 0.24, len - wd * 0.35);
    c.fillStyle = "rgba(40,22,40,0.35)"; c.fillRect(-wd / 2, -len, wd, wd * 0.28);
    c.restore();
  };
  // fry box
  const bx = gw * 0.2 + px, bw = u * 0.075, bh = u * 0.05, top = hz - bh;
  for (const [dx, len, ang] of [[-0.3, 0.07, -0.18], [-0.1, 0.085, -0.05], [0.1, 0.075, 0.08], [0.28, 0.065, 0.2]]) fry(bx + dx * bw, top + 3, u * len, u * 0.012, ang);
  c.fillStyle = "#58304d";
  c.beginPath(); c.moveTo(bx - bw * 0.55, top); c.lineTo(bx + bw * 0.55, top); c.lineTo(bx + bw * 0.45, hz + 2); c.lineTo(bx - bw * 0.45, hz + 2); c.closePath(); c.fill();
  c.fillStyle = "#6b3a5c"; c.fillRect(bx - bw * 0.5, top + bh * 0.3, bw, bh * 0.16);
  // two giant fries standing in the water
  fry(gw * 0.47 + px, hz + 2, u * 0.13, u * 0.026, 0.16);
  fry(gw * 0.5 + px, hz + 2, u * 0.09, u * 0.022, -0.1);
  fry(gw * 0.95 + px, hz + 2, u * 0.11, u * 0.024, -0.12);
}
function moonBg(c, tk) {
  const gw = L.gw, gh = L.gh;
  const hz = gh * 0.7 - (cam.y + 110) * cam.z * 0.16;
  const sky = c.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#121530"); sky.addColorStop(0.5, "#2a2853"); sky.addColorStop(0.85, "#7b4a66"); sky.addColorStop(1, "#d97c5c");
  c.fillStyle = sky; c.fillRect(0, 0, gw, Math.max(0, hz) + 1);
  for (const s of STARS) {
    const x = (((s.x * gw - cam.x * cam.z * 0.02) % gw) + gw) % gw, y = s.y * hz * 0.75;
    c.fillStyle = `rgba(240,236,255,${s.a})`; c.fillRect(x, y, s.s, s.s);
  }
  const sr = Math.min(gw, gh) * 0.12, sx = gw * 0.7 - cam.x * cam.z * 0.04, sy = hz - sr * 0.3;
  const glow = c.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.2);
  glow.addColorStop(0, "rgba(246,190,130,0.45)"); glow.addColorStop(1, "rgba(246,190,130,0)");
  c.fillStyle = glow; c.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
  potatoMoon(c, sx, sy, sr);
  c.fillStyle = "#3a2f55";
  for (const I of ISLES) {
    const ix = I.x * gw - cam.x * cam.z * 0.08, iw = I.w * gw, ih = I.h * gh;
    c.beginPath(); c.moveTo(ix - iw / 2, hz + 1);
    c.quadraticCurveTo(ix - iw * 0.25, hz - ih * 1.1, ix, hz - ih); c.quadraticCurveTo(ix + iw * 0.3, hz - ih * 0.9, ix + iw / 2, hz + 1); c.fill();
  }
  farFries(c, gw, gh, hz);
  const sea = c.createLinearGradient(0, hz, 0, gh);
  sea.addColorStop(0, "#463e6a"); sea.addColorStop(1, "#11132b");
  c.fillStyle = sea; c.fillRect(0, hz, gw, gh - hz);
  for (let i = 0; i < 9; i++) {
    const y = hz + 3 + i * i * 2.6 + i * 3;
    if (y > gh) break;
    const wd = sr * (1.5 - i * 0.12) * (0.75 + 0.25 * Math.sin(tk * 0.035 + i * 1.7));
    c.fillStyle = `rgba(246,201,138,${0.42 - i * 0.04})`; c.fillRect(sx - wd / 2, y, wd, 2);
  }
}

function moonStage(c, tk) {
  const S = STAGE.main;
  // hanging rock body
  c.beginPath();
  c.moveTo(S.x1, S.top); c.lineTo(S.x2, S.top); c.lineTo(S.x2, S.top + 26); c.lineTo(S.x2 - 14, S.bottom - 6);
  c.lineTo(S.x2 - 70, S.bottom + 4); c.lineTo(S.x2 - 150, S.bottom); c.lineTo(S.x2 - 230, S.bottom + 8); c.lineTo(S.x1 + 240, S.bottom + 6);
  c.lineTo(S.x1 + 150, S.bottom + 10); c.lineTo(S.x1 + 60, S.bottom + 2); c.lineTo(S.x1 + 14, S.bottom - 6); c.lineTo(S.x1, S.top + 26); c.closePath();
  const rock = c.createLinearGradient(0, S.top, 0, S.bottom + 10);
  rock.addColorStop(0, "#4a4566"); rock.addColorStop(1, "#211e37");
  c.fillStyle = rock; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
  c.save(); c.clip();
  c.strokeStyle = "rgba(14,16,34,0.35)"; c.lineWidth = 2;
  for (const [y, a, b] of [[24, -300, -80], [30, 40, 290], [44, -200, 120]]) { c.beginPath(); c.moveTo(a, y); c.lineTo(b, y + 3); c.stroke(); }
  c.restore();
  // moss lip
  c.beginPath(); c.roundRect(S.x1 - 4, S.top - 3, S.x2 - S.x1 + 8, 12, 5);
  c.fillStyle = "#5f8f6d"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = "#a7d29b"; c.fillRect(S.x1, S.top - 2, S.x2 - S.x1, 3);
  // ledge marks
  c.fillStyle = "#f3d9a4";
  c.fillRect(S.x1 - 4, S.top - 3, 8, 3); c.fillRect(S.x2 - 4, S.top - 3, 8, 3);
  // soft platforms
  for (const p of STAGE.plats) {
    const gy = p.y + 18 + Math.sin(tk * 0.03 + p.x1) * 2;
    c.fillStyle = "rgba(127,214,200,0.12)"; c.beginPath(); c.ellipse((p.x1 + p.x2) / 2, gy, (p.x2 - p.x1) * 0.4, 5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.roundRect(p.x1, p.y - 1, p.x2 - p.x1, 11, 5);
    c.fillStyle = "#4b4672"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "#d8d2f0"; c.fillRect(p.x1 + 4, p.y, p.x2 - p.x1 - 8, 2.5);
  }
}

/* ---- maps (Jonny, 2026-10-14): each map has its own fight layout (core.js MAPS, read through STAGE after BL.useStage(g)) and its own
   look. MAP_ART[id] = { name, bg(c, tk) (screen space, parallax from cam), stage(c, tk) (world space: STAGE.main and STAGE.plats),
   tick?(g, live) (once per sim frame: ambient particles via addFx / sfx, quiet sounds only when live), ko?(e, live) (the "ko" event
   {slot, x, y, pal}: a fighter left the blast zone; a map-flavoured splash on top of the usual beam) }. Potato Moon is drawn above; the other maps are in
   game/maps/<id>.js (spliced in at the MAPS marker below). UI only: nothing here touches the simulation. */
const MAP_ART = { moon: { name: "Potato Moon", bg: moonBg, stage: moonStage } };
const mapArt = () => MAP_ART[STAGE.id] || MAP_ART.moon;
const mapName = (i) => { const m = BL.MAPS[i]; return m && MAP_ART[m.id] ? MAP_ART[m.id].name : "Potato Moon"; };
function drawBackground(c, tk) { mapArt().bg(c, tk); }
function drawStage(c, tk) { mapArt().stage(c, tk); }
/*MAPS*/

/* ---- finish-ready looks (UI only: hitboxes and the simulation never change) ----
   A fighter at BL.TUNE.finishPct or more can be finished by the opponent's special. RG is the game drawn this frame (set by render()).
   Ring under the feet: drawFinRing below. Projectile extras: finOrbFx / finRavenFx / finBoltFx / finFireFx below. */
let RG = null;
// the slot a fighter is up against: the other one in a 1v1; with three on stage the nearest fighter of the other team still in it
function foeSlot(slot, g = RG) {
  if (!g || g.fighters.length < 3) return 1 - slot;
  const me = g.fighters[slot];
  let best = -1, bd = Infinity;
  if (me) g.fighters.forEach((o, i) => { if (o.team === me.team || o.state === "gone") return; const d = Math.abs(o.x - me.x); if (d < bd) { bd = d; best = i; } });
  return best;
}
// finish-ready: a fighter at the finish percent, or a boss knocked to 0 HP (broken: the next big hit ends him)
function finishReady(slot) {
  const f = RG && RG.fighters[slot];
  if (!f || f.state === "dead" || f.state === "gone") return false;
  return f.spec.boss ? f.state === "broken" : f.percent >= BL.TUNE.finishPct;
}
const finRingCol = (slot) => { const o = RG && RG.fighters[foeSlot(slot)]; return o ? col(o.pal) : "#ffffff"; };   // the colour of the fighter who can finish
function drawFinRing(c, f) {
  if (!finishReady(f.slot)) return;
  const colr = finRingCol(f.slot), w = f.s.w, ph = (tick % 54) / 54, r0 = w * 0.78;
  c.save(); c.strokeStyle = colr; c.lineWidth = 2.2;
  c.globalAlpha = 0.5 + 0.25 * Math.sin(tick * 0.2); c.beginPath(); c.ellipse(f.x, f.y + 1, r0, r0 * 0.24, 0, 0, Math.PI * 2); c.stroke();
  const r = r0 + w * 0.5 * ph; c.globalAlpha = 0.85 * (1 - ph); c.beginPath(); c.ellipse(f.x, f.y + 1, r, r * 0.24, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}

function drawShadow(c, f) {
  drawFinRing(c, f);
  const S = STAGE.main;
  if (f.state === "dead" || f.state === "gone" || f.x < S.x1 || f.x > S.x2) return;
  let gy = S.top;
  for (const p of STAGE.plats) if (f.x >= p.x1 && f.x <= p.x2 && f.y <= p.y + 1 && p.y < gy) gy = p.y;
  const hgt = gy - f.y;
  if (hgt < -2) return;
  const a = clamp(0.35 - hgt / 900, 0.05, 0.35), sc = clamp(1 - hgt / 600, 0.4, 1);
  c.fillStyle = `rgba(8,8,20,${a})`; c.beginPath(); c.ellipse(f.x, gy + 1, f.s.w * 0.75 * sc, 4 * sc, 0, 0, Math.PI * 2); c.fill();
}

function drawRespawnPlat(c, f, tk) {
  if (f.state !== "respawn") return;
  const pulse = 0.6 + Math.sin(tk * 0.15) * 0.2;
  c.fillStyle = rgba(col(f.pal), 0.25 * pulse); c.beginPath(); c.ellipse(f.x, f.y + 8, 52, 14, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.roundRect(f.x - 40, f.y, 80, 8, 4); c.fillStyle = col(f.pal); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
}

// Finish-ready projectile extras. K scales the drawing (never the hitbox).
const FIN_K = { orb: 1.25, bolt: 1.35, raven: 1, phoenix: 1.6, dragon: 1.5 };
function finProjK(p, rdy) { if (!rdy) return 1; if (p.style === "fire") return FIN_K[RG && RG.fighters[p.owner] ? RG.fighters[p.owner].spec.id : "phoenix"] || 1.6; return FIN_K[p.style] || 1; }
function teardrop(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 1.6); c.quadraticCurveTo(x + s, y + s * 0.3, x, y + s); c.quadraticCurveTo(x - s, y + s * 0.3, x, y - s * 1.6); c.fill(); }
function finOrbFx(c, p, tk) {   // the toxic orb trails a green comet tail and drips as it flies
  c.save();
  const a = Math.atan2(p.vy, p.vx), r = p.r * 1.25, len = r * 4.2;
  c.save(); c.translate(p.x, p.y); c.rotate(a);
  const g = c.createLinearGradient(0, 0, -len, 0); g.addColorStop(0, "rgba(150,255,120,0.6)"); g.addColorStop(1, "rgba(80,255,90,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(0, -r * 0.9); c.quadraticCurveTo(-len * 0.5, -r * 0.55, -len, 0); c.quadraticCurveTo(-len * 0.5, r * 0.55, 0, r * 0.9); c.closePath(); c.fill(); c.restore();
  for (let i = 0; i < 7; i++) {
    const ph = (tk * 0.045 + i / 7 + nz(i * 3.3) * 0.2) % 1, x = p.x - p.vx * (1.2 + i * 1.7) + (nz(i * 9.7) - 0.5) * 8, y = p.y + r * 0.55 + ph * 34 + i;
    c.globalAlpha = Math.min(1, (1 - ph) * 1.3); c.fillStyle = i % 2 ? "#d4ffbc" : "#46d83f"; teardrop(c, x, y, 3.6 + (i % 3) * 0.7);
    c.lineWidth = 1; c.strokeStyle = "rgba(20,90,30,0.6)"; c.stroke();
  }
  c.restore();
}
function finRavenFx(c, p, tk) {   // a pale-blue streak behind the raven, and its eyes burn red
  const s = p.vx >= 0 ? 1 : -1;
  c.save(); c.translate(p.x, p.y);
  const g = c.createLinearGradient(0, 0, -s * 110, 0); g.addColorStop(0, "rgba(200,236,255,0.8)"); g.addColorStop(1, "rgba(200,236,255,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(-s * 6, -11); c.quadraticCurveTo(-s * 50, -9, -s * 112, 0); c.quadraticCurveTo(-s * 50, 11, -s * 6, 11); c.closePath(); c.fill();
  c.strokeStyle = "rgba(235,248,255,0.8)"; c.lineWidth = 1.6; c.lineCap = "round";
  for (const [dy, len] of [[-4, 70], [2, 90], [7, 56]]) { c.beginPath(); c.moveTo(-s * 12, dy); c.lineTo(-s * (12 + len), dy * 0.5); c.stroke(); }
  c.restore();
}
function finRavenEyes(c, p) {   // the red glow over the raven's eye
  const s = p.vx >= 0 ? 1 : -1; glowDot(c, p.x + s * 11, p.y - 7.5, 11, 0.9, "#ff2a2a"); glowDot(c, p.x + s * 11, p.y - 7.5, 4, 1, "#ffd0d0");
}
function finBoltFx(c, p, tk) {   // the crystal bolt trails stars
  c.save();
  const g = c.createLinearGradient(p.x, p.y, p.x - p.vx * 12, p.y - p.vy * 12); g.addColorStop(0, "rgba(255,244,200,0.7)"); g.addColorStop(1, "rgba(150,230,255,0)");
  c.strokeStyle = g; c.lineWidth = p.r * 0.9; c.lineCap = "round"; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 12, p.y - p.vy * 12); c.stroke();
  for (let i = 1; i <= 5; i++) {
    c.globalAlpha = 1 - i / 6;
    star4(c, p.x - p.vx * (1.6 + i * 2.4), p.y + Math.sin(tk * 0.4 + i * 1.9) * p.r * 0.5, p.r * (0.95 - i * 0.1), i % 2 ? "#fff6d8" : "#bff3ff");
  }
  c.restore();
}
function finFireFx(c, p, tk, who) {   // Phoenix: a long comet tail. Dragon: every puff drags a short fat cone, together one thick stream
  const a = Math.atan2(p.vy, p.vx), dragon = who === "dragon", r = p.r * (dragon ? 1.5 : 1.6), fl = 1 + Math.sin(tk * 0.9 + p.x * 0.05) * 0.06;
  c.save(); c.translate(p.x, p.y); c.rotate(a);
  const len = (dragon ? r * 3.3 : r * 5.6) * fl, hw = dragon ? r * 1.15 : r * 0.92, tail = dragon ? hw * 1.5 : hw * 0.22;
  const g = c.createLinearGradient(0, 0, -len, 0);
  g.addColorStop(0, dragon ? "rgba(255,214,120,0.9)" : "rgba(255,236,160,0.95)"); g.addColorStop(0.45, "rgba(255,122,43,0.65)"); g.addColorStop(1, "rgba(255,60,20,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(0, -hw); c.quadraticCurveTo(-len * 0.5, -hw * (dragon ? 1.1 : 0.62), -len, -tail); c.lineTo(-len, tail); c.quadraticCurveTo(-len * 0.5, hw * (dragon ? 1.1 : 0.62), 0, hw); c.closePath(); c.fill();
  if (!dragon) { c.fillStyle = "rgba(255,250,225,0.8)"; c.beginPath(); c.moveTo(0, -hw * 0.4); c.quadraticCurveTo(-len * 0.35, -hw * 0.25, -len * 0.62, 0); c.quadraticCurveTo(-len * 0.35, hw * 0.25, 0, hw * 0.4); c.closePath(); c.fill(); }
  c.restore();
}

function drawProj(c, p, tk) {
  if (drawBossProj(c, p, tk)) return;   // a boss's fire (ui/draw-boss.js)
  if (p.style === "cloud") return uvDrawCloud(c, p, tk);    // the Ultimates' projectiles (below)
  if (p.style === "spear") return uvDrawSpear(c, p, tk);
  if (p.style === "star" || p.style === "bigstar") return uvDrawStar(c, p, tk);
  const rdy = p.style !== "burst" && finishReady(foeSlot(p.owner)), K = finProjK(p, rdy);
  if (p.style === "orb") {
    for (let i = 3; i >= 1; i--) { c.fillStyle = `rgba(120,255,110,${0.12 * (4 - i)})`; c.beginPath(); c.arc(p.x - p.vx * i * 1.6, p.y - p.vy * i * 1.6, p.r * (1 - i * 0.15) * K, 0, Math.PI * 2); c.fill(); }
    if (rdy) finOrbFx(c, p, tk);
    greenOrb(c, p.x, p.y, p.r * 0.9 * K, tk);
    return;
  }
  if (p.style === "burst") {
    const k = p.t / p.life, r = p.r * (0.55 + 0.45 * ease(Math.min(1, k * 1.6)));
    const g = c.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r);
    g.addColorStop(0, `rgba(230,255,210,${0.9 * (1 - k)})`); g.addColorStop(0.5, `rgba(120,255,100,${0.6 * (1 - k)})`); g.addColorStop(1, "rgba(60,200,70,0)");
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    return;
  }
  if (p.style === "raven") {
    if (rdy) finRavenFx(c, p, tk);
    c.save(); c.translate(p.x, p.y); c.scale(p.vx >= 0 ? 1 : -1, 1);
    ravenShape(c, 0, 0, 1.25, Math.sin(tk * 0.6) * 0.7, rdy);
    c.restore();
    if (rdy) finRavenEyes(c, p);
    return;
  }
  if (p.style === "bolt") {
    if (rdy) finBoltFx(c, p, tk);
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx)); c.scale(K, K);
    const g = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 2);
    g.addColorStop(0, "rgba(255,240,180,0.9)"); g.addColorStop(1, "rgba(120,220,255,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(-p.r * 0.6, 0, p.r * 2.4, p.r * 1.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(p.r * 1.1, 0); c.lineTo(0, -p.r * 0.55); c.lineTo(-p.r * 0.9, 0); c.lineTo(0, p.r * 0.55); c.closePath();
    c.fillStyle = "#ffe08a"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = "#a8701c"; c.stroke();
    c.restore();
    return;
  }
  if (p.style === "fire") {
    const fl = Math.sin(tk * 0.9 + p.x * 0.05), R = p.r * K;
    if (rdy) finFireFx(c, p, tk, RG.fighters[p.owner] ? RG.fighters[p.owner].spec.id : "phoenix");
    for (let i = 4; i >= 1; i--) {
      c.fillStyle = `rgba(255,${110 + i * 18},40,${0.2 * (5 - i) / 4})`;
      c.beginPath(); c.arc(p.x - p.vx * i * 1.7, p.y - p.vy * i * 1.7, R * (1 - i * 0.13), 0, Math.PI * 2); c.fill();
    }
    const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 1.5);
    gr.addColorStop(0, "#fffbe0"); gr.addColorStop(0.3, "#ffd166"); gr.addColorStop(0.65, "#ff7a2b"); gr.addColorStop(1, "rgba(255,70,30,0)");
    c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, R * 1.5 + fl * 1.5, 0, Math.PI * 2); c.fill();
    return;
  }
  if (p.style === "bullet" || p.style === "gold") {
    // a small bright tracer; High Noon's bullet is golden, bigger, with a long trail and a glow (the drawing only, the hitbox is the same)
    // Dead Eye's bullets (hit.ult) are the same with a hot red-orange glow; its sixth, the golden one, is half as big again with a longer trail
    const gold = p.style === "gold", ult = !!(p.hit && p.hit.ult), sp = Math.hypot(p.vx, p.vy) || 1, r = gold ? (ult ? 8.2 : 5.4) : ult ? 3.8 : 3;
    const len = Math.min(gold ? sp * (ult ? 9 : 6) : sp * (ult ? 4 : 2.6), p.t * sp + 4);
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
    if (gold) glowDot(c, 0, 0, r * 4.2, ult ? 0.75 : 0.55, "#ffcf3d");
    else if (ult) glowDot(c, 0, 0, r * 3.4, 0.5, "#ff5a3d");
    const gr = c.createLinearGradient(-len, 0, 0, 0);
    gr.addColorStop(0, gold ? "rgba(255,190,50,0)" : ult ? "rgba(255,70,50,0)" : "rgba(255,180,80,0)"); gr.addColorStop(1, gold ? "rgba(255,226,120,0.95)" : ult ? "rgba(255,210,180,0.95)" : "rgba(255,242,210,0.9)");
    c.fillStyle = gr; c.beginPath(); c.moveTo(0, -r * 0.85); c.lineTo(-len, -r * 0.2); c.lineTo(-len, r * 0.2); c.lineTo(0, r * 0.85); c.closePath(); c.fill();
    c.fillStyle = gold ? "#ffd84a" : "#fff6dc"; c.beginPath(); c.ellipse(0, 0, r * 1.6, r, 0, 0, Math.PI * 2); c.fill();
    if (gold) {
      c.lineWidth = 1.2; c.strokeStyle = "#9c6c16"; c.stroke();
      c.fillStyle = "#fffbe6"; c.beginPath(); c.ellipse(r * 0.3, -r * 0.3, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); c.fill();
      for (let i = 1; i <= 3; i++) star4(c, -len * (0.2 + i * 0.22), Math.sin(tk * 0.5 + i * 2) * r * 0.9, 4.2 - i * 0.7, "#fff4c8");
    }
    c.restore();
    return;
  }
  if (p.style === "fry") {
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx) + Math.sin(p.t * 0.6) * 0.08);
    c.strokeStyle = "rgba(255,240,200,0.45)"; c.lineWidth = 2; c.lineCap = "round";
    c.beginPath(); c.moveTo(-20, -2); c.lineTo(-34, -2); c.moveTo(-20, 3); c.lineTo(-28, 3); c.stroke();
    c.beginPath(); c.roundRect(-15, -4, 30, 8, 2.5); c.fillStyle = "#f2c14e"; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "#ffe48f"; c.fillRect(-12, -2.5, 20, 2);
    c.fillStyle = "#c9862b"; c.fillRect(10, -2.5, 3, 5);
    c.restore();
    return;
  }
  const a = tk * 0.5 * p.dir;
  c.save(); c.translate(p.x, p.y);
  c.strokeStyle = rgba(p.pal.body, 0.35); c.lineWidth = 3; c.lineCap = "round";
  for (let i = 1; i <= 3; i++) { c.beginPath(); c.moveTo(-sign(p.vx) * (p.r + i * 6), -6 + i * 4); c.lineTo(-sign(p.vx) * (p.r + i * 14), -6 + i * 4); c.stroke(); }
  c.rotate(a);
  c.beginPath(); c.arc(0, 0, p.r, 0, Math.PI * 2); c.fillStyle = p.pal.body; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = p.pal.trim; c.lineWidth = 3;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, p.r * 0.6, i * 2.1, i * 2.1 + 1.2); c.stroke(); }
  c.restore();
}

function drawTag(c, f, isP1, lift) {
  if (f.state === "dead" || f.state === "gone") return;
  const fade = tagAlpha();   // hud.js: off 3 s after the start, back for 3 s after a respawn
  if (fade < 0.02) return;
  const label = isP1 ? "YOU" : match && match.online ? (NET.oppName || "FRIEND").slice(0, 10).toUpperCase() : "CPU";
  const k = 1 / cam.z, y = f.y - f.s.h - (22 + (lift || 0)) * k;
  c.save(); c.globalAlpha = fade; c.translate(f.x, y); c.scale(k, k);
  // an ink outline keeps the tag readable on the daylight maps (Hashbrown Keep's sky, Spudset Bay's sunset)
  c.fillStyle = isP1 ? "#f3d9a4" : "#a4a9c8"; c.strokeStyle = "rgba(14,16,34,.85)"; c.lineWidth = 3; c.lineJoin = "round";
  c.beginPath(); c.moveTo(-6, -2); c.lineTo(6, -2); c.lineTo(0, 6); c.closePath(); c.stroke(); c.fill();
  c.font = '800 12px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center";
  c.strokeText(label, 0, -6); c.fillText(label, 0, -6);
  c.restore();
}


/* ---- Ultimates: the projectiles and the marks on the floor (UI only; the hitboxes are the sim's, only the drawing grows) ---- */
// Alchemist: the cloud is two pre-rendered sprites of billows (so a frame costs two drawImage calls and a few bubbles: no shadowBlur,
// no filter), turned against each other, swelling on every pulse (p.t % 30 === 0), trembling and brightening in the 30 ticks before the
// last pulse, which launches.
const UV_CLOUD = { base: null, hi: null };
function uvCloudSprites() {
  if (UV_CLOUD.base) return UV_CLOUD;
  const S = 256, mk = (draw) => { const cv = document.createElement("canvas"); cv.width = cv.height = S; draw(cv.getContext("2d")); return cv; };
  const puffs = (x, n, seed, dmax, rmin, rv, cols) => {
    for (let i = 0; i < n; i++) {
      const a = nz(seed + i * 3.1) * 6.283, d = Math.sqrt(nz(seed + i * 7.7)) * S * dmax, r = S * (rmin + rv * nz(seed + i * 5.3)), cx = S / 2 + Math.cos(a) * d, cy = S / 2 + Math.sin(a) * d;
      const g = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, cols[0]); g.addColorStop(0.6, cols[1]); g.addColorStop(1, cols[2]);
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
  };
  UV_CLOUD.base = mk((x) => {
    puffs(x, 30, 1, 0.3, 0.14, 0.1, ["rgba(86,190,60,0.95)", "rgba(46,140,48,0.78)", "rgba(24,92,44,0)"]);
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.46); g.addColorStop(0, "rgba(40,120,50,0.55)"); g.addColorStop(1, "rgba(24,90,44,0)");
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  });
  UV_CLOUD.hi = mk((x) => {
    puffs(x, 20, 9, 0.27, 0.09, 0.08, ["rgba(210,255,170,0.9)", "rgba(140,235,100,0.55)", "rgba(100,210,80,0)"]);
    puffs(x, 8, 4, 0.2, 0.05, 0.04, ["rgba(255,255,230,0.85)", "rgba(220,255,190,0.4)", "rgba(200,255,170,0)"]);
  });
  return UV_CLOUD;
}
function uvDrawCloud(c, p, tk) {
  const sp = uvCloudSprites(), r = p.r, grow = easeOut2(clamp(p.t / 10, 0, 1)), ph = p.t % 30;
  const pulse = p.t >= 30 ? Math.max(0, 1 - ph / 12) : 0, charge = p.t >= p.life - 31 ? clamp((p.t - (p.life - 31)) / 30, 0, 1) : 0;
  const s = ((r * 2.35) / 256) * grow * (1 + 0.13 * pulse + 0.05 * charge + Math.sin(tk * 0.15) * 0.015);
  c.save(); c.translate(p.x + (charge ? Math.sin(tk * 1.9) * 2.6 * charge : 0), p.y);
  c.globalAlpha = 0.92; c.save(); c.rotate(tk * 0.006); c.scale(s, s); c.drawImage(sp.base, -128, -128); c.restore();
  c.globalAlpha = 0.8; c.save(); c.rotate(-tk * 0.009 + 1); c.scale(s * 0.92, s * 0.92); c.drawImage(sp.hi, -128, -128); c.restore();
  c.globalAlpha = 1;
  if (pulse > 0 || charge > 0) {   // the pulse: a light flash inside; before the last one the whole cloud glows pale and gold
    c.globalCompositeOperation = "lighter";
    glowDot(c, 0, 0, r * 1.1, 0.34 * pulse + 0.3 * charge, charge > 0.5 ? "#fff3b0" : "#9bff6a");
    c.globalCompositeOperation = "source-over";
  }
  // bubbles rise inside and pop at the top
  for (let i = 0; i < 9; i++) {
    const per = 70 + nz(i * 4.4) * 50, k = ((tk + nz(i * 8.8) * per) % per) / per, bx = (nz(i * 1.7) - 0.5) * r * 1.3, half = Math.sqrt(Math.max(0, r * r - bx * bx)) * 0.86;
    const by = half - k * half * 2, br = 3.5 + nz(i * 6.1) * 5 * (k < 0.9 ? 1 : 1 + (k - 0.9) * 8);
    c.globalAlpha = k > 0.94 ? (1 - k) / 0.06 : 0.9; c.fillStyle = "rgba(170,255,130,0.28)"; c.strokeStyle = "rgba(235,255,215,0.85)"; c.lineWidth = 1.4;
    c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.8)"; c.beginPath(); c.arc(bx - br * 0.3, by - br * 0.3, br * 0.25, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // the true size of the cloud (what hurts): a faint dashed ring that flares on the pulse
  c.setLineDash([9, 7]); c.lineDashOffset = -tk * 0.35; c.lineWidth = 2 + 2 * pulse; c.strokeStyle = rgba(charge > 0.5 ? "#fff3b0" : "#c9ff9e", 0.32 + 0.5 * pulse + 0.35 * charge);
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  c.restore();
}
// Odin: Gungnir, a long golden spear with runes that glow; it tumbles over at the far end of the boomerang and trails light
function uvDrawSpear(c, p, tk) {
  const dir = p.dir || 1, s = p.vx * dir, turn = 1 - clamp((s + 5) / 10, 0, 1), sp = Math.abs(p.vx);
  const ang = (dir > 0 ? turn * Math.PI : Math.PI - turn * Math.PI) + Math.sin(tk * 0.45) * 0.06;
  c.save(); c.translate(p.x, p.y);
  if (sp > 4) {   // the streak of light behind it
    const hd = p.vx >= 0 ? 1 : -1, tl = Math.min(260, sp * 8 + 90), g = c.createLinearGradient(0, 0, -hd * tl, 0);
    g.addColorStop(0, "rgba(255,236,150,0.7)"); g.addColorStop(0.5, "rgba(255,200,70,0.3)"); g.addColorStop(1, "rgba(255,180,60,0)");
    c.fillStyle = g; c.beginPath(); c.moveTo(-hd * 84, -9); c.lineTo(-hd * tl, 0); c.lineTo(-hd * 84, 9); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,240,0.6)"; c.beginPath(); c.moveTo(-hd * 84, -2.2); c.lineTo(-hd * tl * 0.6, 0); c.lineTo(-hd * 84, 2.2); c.closePath(); c.fill();
    for (let i = 0; i < 4; i++) { const k = (tk * 0.07 + i / 4) % 1; c.globalAlpha = 1 - k; star4(c, -hd * (90 + k * (tl - 90)), (nz(i * 5.5) - 0.5) * 22, 4.5 * (1 - k * 0.5), i % 2 ? "#fff6d8" : "#ffd23f"); }
    c.globalAlpha = 1;
  }
  c.rotate(ang); c.scale(1, 0.86 + 0.14 * Math.cos(tk * 0.33)); c.translate(-58, 0);   // the head leads the hitbox by a few pixels, the shaft trails behind it
  uvSpearShape(c, tk);
  c.restore();
}
// Gungnir lying along +x, butt at -62, head tip at 94 (the thrown spear and the one in his hand share it)
function uvSpearShape(c, tk) {
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = "rgba(255,214,90,0.22)"; c.lineWidth = 17; c.beginPath(); c.moveTo(-60, 0); c.lineTo(80, 0); c.stroke();
  c.strokeStyle = OUT; c.lineWidth = 7.4; c.beginPath(); c.moveTo(-62, 0); c.lineTo(54, 0); c.stroke();
  c.strokeStyle = "#e2ad3c"; c.lineWidth = 4.4; c.stroke();
  c.strokeStyle = "#fff3b0"; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-58, -1.2); c.lineTo(52, -1.2); c.stroke();
  c.fillStyle = "#b3282d"; for (const bx of [-12, 14, 38]) c.fillRect(bx - 2.5, -3.6, 5, 7.2);   // red wraps
  c.fillStyle = "#e2ad3c"; c.beginPath(); c.arc(-62, 0, 4.6, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.moveTo(52, -3.6); c.lineTo(68, -10.5); c.lineTo(94, 0); c.lineTo(68, 10.5); c.lineTo(52, 3.6); c.closePath();
  c.fillStyle = "#f7ebb6"; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = "#e2ad3c"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(56, -3); c.lineTo(66, -8.2); c.lineTo(90, -0.6); c.moveTo(56, 3); c.lineTo(66, 8.2); c.lineTo(90, 0.6); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(56, 0); c.lineTo(88, 0); c.stroke();
  glowDot(c, 92, 0, 28, 0.75, UV_GOLD);
  for (let i = 0; i < 3; i++) { c.globalAlpha = 0.45 + 0.5 * Math.sin(tk * 0.2 + i * 1.9) ** 2; rune(c, -34 + i * 28, -17, 6.5, i + 1, "#fff2b8", 1.5); }   // the runes pulse one after the other
}
// Wizard: a falling star with a long pale trail; the fifth is bigger and golden
function uvDrawStar(c, p, tk) {
  const big = p.style === "bigstar", R = p.r * (big ? 1.2 : 1.12), tl = big ? 320 : 240, sway = Math.sin(tk * 0.2 + p.x) * 3;
  c.save(); c.translate(p.x, p.y);
  const g = c.createLinearGradient(0, 0, 0, -tl);
  g.addColorStop(0, "rgba(255,246,210,0.9)"); g.addColorStop(0.3, big ? "rgba(255,206,80,0.55)" : "rgba(180,240,255,0.55)"); g.addColorStop(1, "rgba(180,240,255,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(-R * 0.8, 0); c.quadraticCurveTo(-R * 0.4 + sway, -tl * 0.5, sway, -tl); c.quadraticCurveTo(R * 0.4 + sway, -tl * 0.5, R * 0.8, 0); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,0.7)"; c.beginPath(); c.moveTo(-R * 0.28, 0); c.lineTo(sway * 0.6, -tl * 0.62); c.lineTo(R * 0.28, 0); c.closePath(); c.fill();
  for (let i = 0; i < 5; i++) { const k = (tk * 0.05 + i / 5) % 1; c.globalAlpha = (1 - k) * 0.9; star4(c, Math.sin(tk * 0.3 + i * 2.1) * R * 0.9, -R - k * (tl - R) * 0.8, 3.2 + 3 * (1 - k), i % 2 ? "#fff6d8" : (big ? "#ffd23f" : "#bff3ff")); }
  c.globalAlpha = 1;
  glowDot(c, 0, 0, R * 2.8, 0.6, big ? "#ffcf3d" : "#bff3ff");
  c.rotate(tk * (big ? 0.05 : 0.08));
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.46 : R; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = big ? "#ffd84a" : "#fff0b8"; c.fill(); c.lineWidth = 2; c.strokeStyle = big ? "#a8701c" : "#c79a3c"; c.lineJoin = "round"; c.stroke();
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.2 : R * 0.52; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = "#ffffff"; c.fill();
  c.restore();
}
// the marks on the floor: under each falling star a ring that grows as the star comes down, with a ring closing in on it (they meet at
// the moment of the hit), and a pale lane up to the star
function uvStarMarks(c, g, tk) {
  for (const p of g.projs) {
    if (p.style !== "star" && p.style !== "bigstar") continue;
    const big = p.style === "bigstar", q = clamp((p.y + 558) / 558, 0, 1), rm = (p.r + 22) * (0.34 + 0.66 * q), hot = q > 0.8 && tk % 6 < 3;
    const colr = big ? "#ff9a3d" : "#fff0b0", fy = STAGE.main.top;
    c.save();
    c.fillStyle = big ? "rgba(255,150,60,0.07)" : "rgba(255,240,170,0.06)"; c.globalAlpha = 0.5 + 0.5 * q;
    c.fillRect(p.x - (p.r + 22), p.y, (p.r + 22) * 2, fy - p.y);   // the lane the star falls down
    c.globalAlpha = 1;
    c.fillStyle = rgba(colr, 0.12 + 0.3 * q); c.beginPath(); c.ellipse(p.x, fy + 1, rm, rm * 0.27, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hot ? "#ffffff" : colr; c.lineWidth = 2.2 + 2.2 * q; c.globalAlpha = 0.55 + 0.45 * q; c.beginPath(); c.ellipse(p.x, fy + 1, rm, rm * 0.27, 0, 0, Math.PI * 2); c.stroke();
    const rc = rm * (1 + 1.1 * (1 - q)); c.globalAlpha = 0.65 * (1 - q * 0.6); c.lineWidth = 2; c.strokeStyle = "#ffffff";
    c.beginPath(); c.ellipse(p.x, fy + 1, rc, rc * 0.27, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 0.5 + 0.5 * q; c.strokeStyle = colr; c.lineWidth = 2.4; c.beginPath(); c.moveTo(p.x - 7, fy - 2); c.lineTo(p.x + 7, fy + 4); c.moveTo(p.x + 7, fy - 2); c.lineTo(p.x - 7, fy + 4); c.stroke();
    c.restore();
  }
}
function uvFloor(c, g, tk) {
  for (const f of g.fighters) if (uvHeld(f) === "dive") uvPhoenixMark(c, f, tk);   // draw-fighters.js
  uvStarMarks(c, g, tk);
}
