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
function drawBackground(c, tk) {
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

function drawStage(c, tk) {
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

function drawShadow(c, f) {
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

function drawProj(c, p, tk) {
  if (p.style === "orb") {
    for (let i = 3; i >= 1; i--) { c.fillStyle = `rgba(120,255,110,${0.12 * (4 - i)})`; c.beginPath(); c.arc(p.x - p.vx * i * 1.6, p.y - p.vy * i * 1.6, p.r * (1 - i * 0.15), 0, Math.PI * 2); c.fill(); }
    greenOrb(c, p.x, p.y, p.r * 0.9, tk);
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
    c.save(); c.translate(p.x, p.y); c.scale(p.vx >= 0 ? 1 : -1, 1);
    ravenShape(c, 0, 0, 1.25, Math.sin(tk * 0.6) * 0.7);
    c.restore();
    return;
  }
  if (p.style === "bolt") {
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
    const g = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 2);
    g.addColorStop(0, "rgba(255,240,180,0.9)"); g.addColorStop(1, "rgba(120,220,255,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(-p.r * 0.6, 0, p.r * 2.4, p.r * 1.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(p.r * 1.1, 0); c.lineTo(0, -p.r * 0.55); c.lineTo(-p.r * 0.9, 0); c.lineTo(0, p.r * 0.55); c.closePath();
    c.fillStyle = "#ffe08a"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = "#a8701c"; c.stroke();
    c.restore();
    return;
  }
  if (p.style === "fire") {
    const fl = Math.sin(tk * 0.9 + p.x * 0.05);
    for (let i = 4; i >= 1; i--) {
      c.fillStyle = `rgba(255,${110 + i * 18},40,${0.2 * (5 - i) / 4})`;
      c.beginPath(); c.arc(p.x - p.vx * i * 1.7, p.y - p.vy * i * 1.7, p.r * (1 - i * 0.13), 0, Math.PI * 2); c.fill();
    }
    const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.5);
    gr.addColorStop(0, "#fffbe0"); gr.addColorStop(0.3, "#ffd166"); gr.addColorStop(0.65, "#ff7a2b"); gr.addColorStop(1, "rgba(255,70,30,0)");
    c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, p.r * 1.5 + fl * 1.5, 0, Math.PI * 2); c.fill();
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
  const label = isP1 ? "YOU" : match && match.online ? (NET.oppName || "FRIEND").slice(0, 10).toUpperCase() : match && match.tutorial ? "DUMMY" : "CPU";
  const k = 1 / cam.z, y = f.y - f.s.h - (22 + (lift || 0)) * k;
  c.save(); c.translate(f.x, y); c.scale(k, k);
  c.fillStyle = isP1 ? "#f3d9a4" : "#a4a9c8";
  c.beginPath(); c.moveTo(-6, -2); c.lineTo(6, -2); c.lineTo(0, 6); c.closePath(); c.fill();
  c.font = '800 12px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center";
  c.fillText(label, 0, -6);
  c.restore();
}

