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
// the maps' names as the page shows them (the names inside game/maps/*.js are the English fallback): one table here, wrapped for translation
const MAP_NAMES = { moon: _t("Potato Moon"), bay: _t("Spudset Bay"), castle: _t("Hashbrown Keep"), deep: _t("The Deep"), field: _t("The Field"), fryer: _t("Deep Fryday"), kitchen: _t("The Kitchen") };
const mapName = (i) => { const m = BL.MAPS[i]; return m && MAP_ART[m.id] ? MAP_NAMES[m.id] || MAP_ART[m.id].name : MAP_NAMES.moon; };
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

/* ---- 2v2 team rims (UI only; TEAM_COL is in ui/duo.js): while a 2v2 is drawn (render2D sets TEAM_RIM) every potato gets a thin outline in its
   team's colour behind it (teamRimBody, called from drawPotato: one more stroke of the body path, wider than the ink outline so a ring
   about 2 screen pixels thick shows) and a steady ring at the feet (drawTeamRing, from drawShadow). Ice blue is your team, ember red the foes. ---- */
let TEAM_RIM = false;
function teamRimBody(c, f, P) {
  const tc = TEAM_COL[f.team];
  if (!tc) return;
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);   // the body's own transform
  potatoPath(c, P); c.lineJoin = "round"; c.lineWidth = 2.5 + 4 / cam.z; c.strokeStyle = tc; c.stroke();
  c.restore();
}
function drawTeamRing(c, f) {
  const tc = TEAM_RIM && TEAM_COL[f.team];
  if (!tc || f.state === "dead" || f.state === "gone") return;
  const r = f.s.w * 0.95;
  c.save(); c.strokeStyle = tc; c.globalAlpha = 0.55; c.lineWidth = 2 / cam.z;
  c.beginPath(); c.ellipse(f.x, f.y + 1, r, r * 0.26, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}
function drawShadow(c, f) {
  drawTeamRing(c, f);
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
function finOrbFx(c, p, tk) {   // the orb half as big again with a lime ribbon tail and drips falling off it (ui/hk-alchemist.js)
  c.save();
  hkAlcOrb(c, p, tk, FIN_K.orb, true);
  c.restore();
}
function finRavenFx(c, p, tk) {   // finish-ready: a long gold pennant wake with two ruled lines (Odin's kit, ui/hk-odin.js), and its eyes burn red
  const s = p.vx >= 0 ? 1 : -1, sp = Math.abs(p.vx), K = HK_KIT.odin;
  hkOdnPennant(c, p.x - s * 12, p.y - 1, s > 0 ? 0 : Math.PI, 60 + sp * 11, 11, K, 1);
  c.save(); c.lineCap = "round";
  for (const [dy, len] of [[-13, 58 + sp * 4], [12, 44 + sp * 3]]) { c.strokeStyle = HK_INK; c.lineWidth = 4; c.beginPath(); c.moveTo(p.x - s * 22, p.y + dy); c.lineTo(p.x - s * (22 + len), p.y + dy * 0.7); c.stroke(); c.strokeStyle = K.cols[1]; c.lineWidth = 2; c.stroke(); }
  c.restore();
}
function finRavenEyes(c, p) {   // the eye burns: a flat red ring round it (no glow)
  const s = p.vx >= 0 ? 1 : -1, x = p.x + s * 15, y = p.y - 5.1;
  c.save(); c.lineWidth = 1.6; c.strokeStyle = "#e3453b"; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.stroke(); c.restore();
}
function finBoltFx(c, p, tk) {   // the crystal bolt trails stars
  c.save();   // a longer segmented wake, an outer violet cut and crystal chips tumbling behind (ui/hk-wizard.js)
  hkWizBolt(c, p, tk, FIN_K.bolt, true);
  c.restore();
}
function finFireFx(c, p, tk, who) {   // Phoenix: the ball with a wake twice as long, an outer flame and more feathers; Dragon: the breath's lobes trail on
  if (who === "dragon") hkDrgBreath(c, p, tk, FIN_K.dragon, true); else hkPhxBall(c, p, tk, FIN_K.phoenix, true);
}

function drawProj(c, p, tk) {
  if (drawBossProj(c, p, tk)) return;   // a boss's fire (ui/draw-boss.js)
  if (p.style === "cloud") return uvDrawCloud(c, p, tk);    // the Ultimates' projectiles (below)
  if (p.style === "spear") return uvDrawSpear(c, p, tk);
  if (p.style === "star" || p.style === "bigstar") return uvDrawStar(c, p, tk);
  const rdy = p.style !== "burst" && finishReady(foeSlot(p.owner)), K = finProjK(p, rdy);
  if (p.style === "orb") {
    if (rdy) finOrbFx(c, p, tk); else hkAlcOrb(c, p, tk, 1, false);   // Bubbling acid (ui/hk-alchemist.js; where it bursts: UV_BACK.alchemist)
    return;
  }
  if (p.style === "burst") {
    hkAlcBurst(c, p, tk);   // its dashed true size and a cluster of beads (ui/hk-alchemist.js)
    return;
  }
  if (p.style === "raven") {
    if (rdy) finRavenFx(c, p, tk);
    hkOdnRaven(c, p, tk, rdy);   // the bird, its pennant wake, feathers shed on the turn (ui/hk-odin.js)
    if (rdy) finRavenEyes(c, p);
    return;
  }
  if (p.style === "bolt") {
    if (rdy) finBoltFx(c, p, tk); else hkWizBolt(c, p, tk, 1, false);   // a long cut diamond, a segmented wake (ui/hk-wizard.js)
    return;
  }
  if (p.style === "fire") {
    const who = RG && RG.fighters[p.owner] ? RG.fighters[p.owner].spec.id : "phoenix";   // Feather fire / Rolling flame (ui/hk-phoenix.js, ui/hk-dragon.js)
    if (rdy) finFireFx(c, p, tk, who); else if (who === "dragon") hkDrgBreath(c, p, tk, 1, false); else hkPhxBall(c, p, tk, 1, false);
    return;
  }
  if (p.style === "bullet" || p.style === "gold") {
    // a ruled tracer with a squared brass head; High Noon's (finish-ready) is a gold slug twice the size with a longer, double rule; Dead Eye's
    // first five are ivory dashes, its sixth the gold slug (the kit's, ui/hk-gunslinger.js; the drawing only, the hitbox is the same)
    hkGunBullet(c, p, tk);
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

function drawTag(c, f, isP1, lift, o) {   // o: a 2v2's { label, col } (duoTags below); without it the 1v1's YOU / CPU
  if (f.state === "dead" || f.state === "gone") return;
  const fade = tagAlpha();   // hud.js: off 3 s after the start, back for 3 s after a respawn
  if (fade < 0.02) return;
  const label = o ? o.label : isP1 ? (match && match.rpTag) || _t("YOU") : match && match.online && !NET.cpuMate ? (NET.oppName || _t("FRIEND")).slice(0, 10).toUpperCase() : _t("CPU");
  const k = 1 / cam.z, y = f.y - f.s.h - (22 + (lift || 0)) * k;
  c.save(); c.globalAlpha = fade; c.translate(f.x, y); c.scale(k, k);
  // an ink outline keeps the tag readable on the daylight maps (Hashbrown Keep's sky, Spudset Bay's sunset)
  c.fillStyle = o ? o.col : isP1 ? "#f3d9a4" : match && match.boss ? TEAM_COL[f.team] : "#a4a9c8"; c.strokeStyle = "rgba(14,16,34,.85)"; c.lineWidth = 3; c.lineJoin = "round";
  c.beginPath(); c.moveTo(-6, -2); c.lineTo(6, -2); c.lineTo(0, 6); c.closePath(); c.stroke(); c.fill();
  c.font = '800 12px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center";
  c.strokeText(label, 0, -6); c.fillText(label, 0, -6);
  c.restore();
}
// 2v2: a tag over every fighter still in it, in its team's colour: YOU, your partner's and the foes' CPU names (match.names). Close tags
// stack (the later one, left to right, goes up a step) so four names never sit on top of each other.
function duoTags(c, g) {
  if (tagAlpha() < 0.02) return;
  const placed = [], z = cam.z;
  for (const f of [...g.fighters].sort((a, b) => a.x - b.x)) {
    if (f.state === "dead" || f.state === "gone") continue;
    const nm = match.tb ? tbMark(f.slot) : f.slot === meSlot ? _t("YOU") : ((match.names && match.names[f.slot]) || _t("CPU")).toUpperCase();   // online: friends' names, CPU (ui/online-team.js)
    const label = nm.length > 12 ? nm.slice(0, 11) + "…" : nm, w = label.length * 6.4 + 12, x = f.x * z, y = (f.y - f.s.h) * z;
    let lift = 0;
    while (lift < 60 && placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - (y - lift)) < 20)) lift += 20;
    placed.push({ x, y: y - lift, w });
    drawTag(c, f, f.slot === meSlot, lift, { label, col: match.tb && f.slot === meSlot ? "#f3d9a4" : TEAM_COL[f.team] || "#ffffff" });   // online: a gold YOU (the colours are the teams')
  }
}


/* ---- Ultimates: the projectiles and the marks on the floor (UI only; the hitboxes are the sim's, only the drawing grows) ---- */
// Alchemist: Mutagen Cloud is one giant living cell (ui/hk-alchemist.js): a clear inside, two nuclei, bubbles, a broken lime rim that swells
// on every pulse (p.t % 30 === 0); it trembles and the rim turns cream in the 30 ticks before the last pulse, which launches. Flat fills.
function uvDrawCloud(c, p, tk) {
  c.save();
  hkAlcCell(c, p, tk);
  c.restore();
}
// Odin: Gungnir, a long golden spear with runes that glow; it tumbles over at the far end of the boomerang and trails light
function uvDrawSpear(c, p, tk) {
  const dir = p.dir || 1, s = p.vx * dir, turn = 1 - clamp((s + 5) / 10, 0, 1), sp = Math.abs(p.vx);
  const ang = (dir > 0 ? turn * Math.PI : Math.PI - turn * Math.PI) + Math.sin(tk * 0.45) * 0.06;
  c.save(); c.translate(p.x, p.y);
  if (sp > 4) {   // flat, the kit's (ui/hk-odin.js): out, the stage-long line is behind it (UV_BACK.odin); back, a pennant streams from it
    const hd = p.vx >= 0 ? 1 : -1;
    if (s < 0) hkOdnPennant(c, -hd * 40, 0, hd > 0 ? 0 : Math.PI, Math.min(170, 40 + sp * 7), 12, HK_KIT.odin, Math.min(1, sp / 12));
    for (let i = 0; i < 3; i++) { const k = (tk * 0.07 + i / 3) % 1; c.globalAlpha = 1 - k; hkShard(c, -hd * (70 + k * 120), (nz(i * 5.5) - 0.5) * 22, 5 * (1 - k * 0.4), hd > 0 ? Math.PI : 0, HK_KIT.odin, i); }
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
  hkSamDisc(c, 92, 0, 15, HK_KIT.odin.cols[1], 0.9); hkSpark(c, 92, 0, 7, HK_KIT.odin, 1, 0, 3, 0);   // the tip: a flat halo and the kit's star (ui/hitkit.js)
  for (let i = 0; i < 3; i++) { c.globalAlpha = 0.45 + 0.5 * Math.sin(tk * 0.2 + i * 1.9) ** 2; rune(c, -34 + i * 28, -17, 6.5, i + 1, "#fff2b8", 1.5); }   // the runes pulse one after the other
}
// Wizard: a falling star with a long pale trail; the fifth is bigger and golden
function uvDrawStar(c, p, tk) {
  c.save();   // a cut crystal falling on a three-tone streak, the fifth gold and bigger (ui/hk-wizard.js)
  hkWizFallStar(c, p, tk);
  c.restore();
}
// the marks on the floor: under each falling star a ring that grows as the star comes down, with a ring closing in on it (they meet at
// the moment of the hit), and a pale lane up to the star
function uvStarMarks(c, g, tk) {
  hkWizStarMarks(c, g, tk);   // the lane, the ring growing as the star comes down, a ring closing in on it, the cross (ui/hk-wizard.js)
}
function uvFloor(c, g, tk) {
  for (const f of g.fighters) if (uvHeld(f) === "dive") uvPhoenixMark(c, f, tk);   // draw-fighters.js
  uvStarMarks(c, g, tk);
}
