/* ---- Spudset Bay (map "bay"): a fishing boat, the "Sweet Potato", on the water at a bright sundown. Fable's design "Map 1: Spudset Bay".
   bg (screen space, back to front): the sky, the setting sun (glow + disc), long sunset clouds, the sea, the horizon haze, the headland with
   the salt-shaker lighthouse and two far sails, the sun path, the wave rows, a buoy. stage (world space): the mast, the boom and the crow's
   nest (the two platforms), the hull with its deck, then the KO splashes (screen space, so they sit on the water at the bottom edge).
   Gradients are cached by (gw, gh, round(hz)); the clouds are one pre-rendered sprite. UI only: nothing here writes to the game. */
const BAY = { key: "", sky: null, sea: null, haze: null, glow: null, disc: null, beam: null, refl: null, hull: null, hullP: null, hullK: "", cloud: null, splash: [], wave: 0, gull: 0 };
function bayGrads(c, gw, gh, hz, u) {
  const key = gw + "x" + gh + "x" + Math.round(hz);
  if (BAY.key === key) return BAY;
  BAY.key = key;
  const sky = c.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#2b3f7d"); sky.addColorStop(0.4, "#7c5f9c"); sky.addColorStop(0.75, "#e58a68"); sky.addColorStop(1, "#ffd38c");
  const sea = c.createLinearGradient(0, hz, 0, gh);
  sea.addColorStop(0, "#e3955f"); sea.addColorStop(0.25, "#3f5f93"); sea.addColorStop(1, "#1b2b52");
  const haze = c.createLinearGradient(0, hz - u * 0.06, 0, hz + u * 0.03);
  haze.addColorStop(0, "rgba(255,214,140,0)"); haze.addColorStop(0.67, "rgba(255,214,140,0.35)"); haze.addColorStop(1, "rgba(255,214,140,0)");
  // the sun's gradients sit at the origin: bayBg translates to the sun, so they only change with u
  const r = u * 0.17, glow = c.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 3);
  glow.addColorStop(0, "rgba(255,200,120,0.35)"); glow.addColorStop(1, "rgba(255,200,120,0)");
  const disc = c.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r);
  disc.addColorStop(0, "#fff3d6"); disc.addColorStop(0.55, "#ffe9b8"); disc.addColorStop(1, "#ffcf7a");
  const beam = c.createLinearGradient(0, 0, u * 0.3, 0);
  beam.addColorStop(0, "rgba(255,230,160,0.32)"); beam.addColorStop(1, "rgba(255,230,160,0)");
  const refl = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);   // the sun's warm reflection on the water (drawn squashed tall)
  refl.addColorStop(0, "rgba(255,214,140,0.42)"); refl.addColorStop(0.5, "rgba(255,190,110,0.18)"); refl.addColorStop(1, "rgba(255,190,110,0)");
  Object.assign(BAY, { sky, sea, haze, glow, disc, beam, refl });
  return BAY;
}
// one long flat sunset cloud (seven puffs), lit from below by the sun
function bayCloudSprite() {
  if (BAY.cloud) return BAY.cloud;
  const W = 320, H = 72, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), E = [[0.5, 0.7, 0.46, 0.15], [0.12, 0.66, 0.09, 0.14], [0.23, 0.56, 0.12, 0.25], [0.37, 0.46, 0.15, 0.33], [0.53, 0.4, 0.13, 0.35], [0.67, 0.5, 0.13, 0.27], [0.81, 0.6, 0.11, 0.18]];
  const blob = (dy) => { x.beginPath(); for (const [a, b, rx, ry] of E) { x.moveTo(a * W + rx * W, b * H + dy); x.ellipse(a * W, b * H + dy, rx * W, ry * H, 0, 0, Math.PI * 2); } x.fill(); };
  x.fillStyle = "#ffc989"; blob(6);   // lit from below by the sun: a gold underside, a coral band, the mauve body, a darker top
  x.fillStyle = "#ec9888"; blob(3);
  x.fillStyle = "#b5698c"; blob(0);
  x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(110,66,128,0.26)"; blob(-10);
  return (BAY.cloud = cv);
}
// the lighthouse is a chip-shop salt shaker: a glass body full of salt, a domed cap with six holes; the top hole is the lamp
// (1 s on, 2 s off), and a grain of salt drops off the cap at every blink. (x, base): the foot; h: the height.
function bayShaker(c, x, base, h, tk) {
  const bw = h * 0.6, tw = h * 0.48, gh = h * 0.66, top = base - gh, ph = tk % 180, on = ph < 60;
  c.save();
  if (on) {   // the lamp's beam out over the sea, fading in and out
    const a = Math.min(1, ph / 6, (60 - ph) / 10);
    c.globalAlpha = a; c.save(); c.translate(x, top - h * 0.24); c.fillStyle = BAY.beam;
    c.beginPath(); c.moveTo(0, -1); c.lineTo(h * 6, -h * 0.55); c.lineTo(h * 6, h * 0.35); c.closePath(); c.fill(); c.restore();
    c.globalAlpha = 1;
  }
  // glass body with the salt in it
  c.beginPath(); c.moveTo(x - bw / 2, base); c.lineTo(x - tw / 2, top); c.lineTo(x + tw / 2, top); c.lineTo(x + bw / 2, base); c.closePath();
  c.fillStyle = "#cdb9d2"; c.fill();
  c.fillStyle = "#f6eef0"; c.beginPath(); c.moveTo(x - bw / 2, base); c.lineTo(x - bw / 2 + (bw - tw) * 0.35, base - gh * 0.7); c.lineTo(x + bw / 2 - (bw - tw) * 0.35, base - gh * 0.7); c.lineTo(x + bw / 2, base); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,0.7)"; c.fillRect(x - tw * 0.32, top + gh * 0.1, Math.max(1, h * 0.06), gh * 0.75);
  c.lineWidth = Math.max(1, h * 0.05); c.strokeStyle = "#4b3566";
  c.beginPath(); c.moveTo(x - bw / 2, base); c.lineTo(x - tw / 2, top); c.lineTo(x + tw / 2, top); c.lineTo(x + bw / 2, base); c.closePath(); c.stroke();
  // the cap: a band and a dome
  c.fillStyle = "#aeb3c6"; c.fillRect(x - tw / 2 - h * 0.03, top - h * 0.08, tw + h * 0.06, h * 0.09);
  c.beginPath(); c.ellipse(x, top - h * 0.08, tw / 2, h * 0.22, 0, Math.PI, Math.PI * 2); c.fillStyle = "#c9cddb"; c.fill(); c.stroke();
  c.fillStyle = "#4b3566";
  for (const [dx, dy] of [[-0.14, 0.13], [0, 0.13], [0.14, 0.13], [-0.08, 0.2], [0.08, 0.2]]) { c.beginPath(); c.arc(x + dx * h, top - h * dy, Math.max(0.7, h * 0.03), 0, Math.PI * 2); c.fill(); }
  const lx = x, ly = top - h * 0.255;
  if (on) { glowDot(c, lx, ly, h * 0.6, 0.85, "#ffe6a0"); c.fillStyle = "#fff6d6"; c.beginPath(); c.arc(lx, ly, Math.max(1.2, h * 0.05), 0, Math.PI * 2); c.fill(); }
  else { c.fillStyle = "#4b3566"; c.beginPath(); c.arc(lx, ly, Math.max(0.7, h * 0.035), 0, Math.PI * 2); c.fill(); }
  // the grain of salt, falling off the cap's edge to the foot of the shaker
  if (ph < 40) { const gy = top - h * 0.06 + 0.018 * ph * ph * (h / 20); if (gy < base) { c.fillStyle = "#ffffff"; c.fillRect(x + tw / 2 + h * 0.06, gy, 2, 2); } }
  c.restore();
}
// a far sail: a small hull and a triangle, tilting on a 4 s swell
function baySail(c, x, y, s, tk, seed) {
  c.save(); c.translate(x, y); c.rotate(Math.sin(tk * 0.026 + seed) * 0.05);
  c.beginPath(); c.moveTo(-s * 0.55, 0); c.lineTo(s * 0.55, 0); c.lineTo(s * 0.4, s * 0.18); c.lineTo(-s * 0.42, s * 0.18); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-s * 0.05, -s); c.lineTo(-s * 0.05, -s * 0.06); c.lineTo(-s * 0.48, -s * 0.06); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(s * 0.04, -s * 0.86); c.lineTo(s * 0.04, -s * 0.06); c.lineTo(s * 0.38, -s * 0.06); c.closePath(); c.fill();
  c.restore();
}
function bayBg(c, tk) {
  const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), up = L.portrait, z = cam.z, s = u / 390;
  const hz = gh * 0.7 - (cam.y + 110) * z * 0.16, par = (k) => -cam.x * z * k;
  const B = bayGrads(c, gw, gh, hz, u);
  c.fillStyle = B.sky; c.fillRect(0, 0, gw, Math.max(0, hz) + 1);
  // the sun: half set, pale gold, the glow does the brightness
  const r = u * 0.17, sx = gw * (up ? 0.72 : 0.78) + par(0.04), sy = hz - r * 0.2;
  c.save(); c.translate(sx, sy);
  c.fillStyle = B.glow; c.fillRect(-r * 3, -r * 3, r * 6, r * 6);
  c.fillStyle = B.disc; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  const spr = bayCloudSprite();   // two thin streaks of cloud across the sun (the same sprite, stretched flat)
  c.globalAlpha = 0.85; c.drawImage(spr, -r * 1.5, -r * 0.62, r * 2.6, r * 0.2); c.drawImage(spr, -r * 0.4, -r * 0.3, r * 1.9, r * 0.14);
  c.globalAlpha = 1;
  c.restore();
  // clouds: long and flat, drifting right and wrapping
  const CL = up ? [[0.3, 0.15, 0.1], [0.2, 0.3, 0.6], [0.25, 0.45, 0.25], [0.22, 0.6, 0.8]] : [[0.3, 0.25, 0.12], [0.2, 0.4, 0.62], [0.25, 0.55, 0.36]];
  CL.forEach(([w, yk, x0], i) => {
    const cw = u * w, ch = cw * 0.22, span = gw + cw, x = ((((x0 * gw + tk * 0.05 * s + par(0.03)) % span) + span) % span) - cw;
    if (i % 2) { c.save(); c.translate(x + cw, 0); c.scale(-1, 1); c.drawImage(spr, 0, hz * yk - ch / 2, cw, ch); c.restore(); }
    else c.drawImage(spr, x, hz * yk - ch / 2, cw, ch);
  });
  // the sea (the haze along the horizon goes over the far shore, below)
  c.fillStyle = B.sea; c.fillRect(0, hz, gw, gh - hz + 1);
  // the far shore: a headland on the left with the salt-shaker lighthouse; two sails out on the water
  // (upright the deck sits ~40 px above the horizon and the hull hides it: the headland is a taller cliff there so it shows behind the bow)
  const hw = gw * (up ? 0.4 : 0.28), hh = gh * (up ? 0.13 : 0.07), hx = par(0.07) - hw * 0.08;
  c.fillStyle = "#4b3566";
  c.beginPath(); c.moveTo(hx - hw * 0.1, hz + 1); c.lineTo(hx - hw * 0.1, hz - hh * 0.75);
  c.quadraticCurveTo(hx + hw * 0.25, hz - hh * 1.15, hx + hw * 0.62, hz - hh); c.quadraticCurveTo(hx + hw * 0.74, hz - hh * 0.98, hx + hw * 0.78, hz - hh * 0.6);
  c.quadraticCurveTo(hx + hw * 0.86, hz - hh * 0.1, hx + hw, hz + 1); c.closePath(); c.fill();
  const shH = u * (up ? 0.06 : 0.065);
  bayShaker(c, hx + hw * 0.6, hz - hh * 0.99, shH, tk);
  // the sails sit on the horizon, which is the deck line in landscape: behind the boat they would read as things on the deck, so they
  // fade out over the boat's span on screen. They drift in from the right edge, past the sun.
  c.fillStyle = "#4b3566";
  const S = STAGE.main, b1 = gw / 2 + (S.x1 - 30 - cam.x) * z, b2 = gw / 2 + (S.x2 + 30 - cam.x) * z, fw = gw * 0.03;
  for (let i = 0; i < (up ? 1 : 2); i++) {
    const rng = gw * 0.5, d = (((i * 0.5 + 0.16) * rng + tk * 0.02 * s) % rng), x = gw * 1.04 - d + par(0.07);
    const a = Math.min(1, d / fw, (rng - d) / fw, Math.max(0, b1 - x, x - b2) / fw);
    if (a <= 0.02) continue;
    c.globalAlpha = a; baySail(c, x, hz - 1, u * (i ? 0.026 : 0.032), tk, i * 2.3);
  }
  c.globalAlpha = 1;
  c.fillStyle = B.haze; c.fillRect(0, hz - u * 0.06, gw, u * 0.09);
  // the sun path: a warm glow on the water under the sun and shimmer bars in it
  c.save(); c.translate(sx, hz); c.scale(1, up ? 3 : 2.4); c.fillStyle = B.refl; c.fillRect(-r * 1.3, 0, r * 2.6, r * 1.3); c.restore();
  for (let i = 0; i < 10; i++) {
    const y = hz + 3 + (i * i * 2.6 + i * 3) * (up ? 1.4 : 1) * Math.max(0.8, s);
    if (y > gh) break;
    const wd = r * (1.5 - i * 0.11) * (0.75 + 0.25 * Math.sin(tk * 0.035 + i * 1.7));
    c.fillStyle = `rgba(255,224,168,${0.5 - i * 0.04})`; c.fillRect(sx - wd / 2 + Math.sin(tk * 0.02 + i * 2.3) * r * 0.08, y, wd, 2);
  }
  // wave crests: rows of short bumps sliding left, each row with its own parallax
  const WV = [[0.05, 0.12, 0.3, 0.5, 1.6, 0.22], [0.12, 0.18, 0.45, 0.62, 2.2, 0.26], [0.22, 0.25, 0.6, 0.75, 2.8, 0.28]];
  if (up) WV.push([0.36, 0.32, 0.75, 0.85, 3.2, 0.26]);
  const bw = gw / 10;
  c.lineWidth = 1.5; c.lineCap = "round";
  WV.forEach(([yk, k, sp, wk, amp, al], row) => {
    const y = hz + u * yk;
    if (y > gh) return;
    const off = tk * sp * s - par(k), j0 = Math.floor(off / bw) - 1, j1 = Math.floor((off + gw) / bw) + 1;
    c.strokeStyle = `rgba(255,230,200,${al})`; c.beginPath();
    for (let j = j0; j <= j1; j++) {
      const n = nz(j * 3.7 + row * 11.3);
      if (n < 0.28) continue;
      const w = bw * wk * (0.7 + 0.3 * n), x = j * bw - off + (n - 0.5) * bw * 0.4, a = amp * s * (0.75 + 0.25 * n);
      c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y - a * 2, x + w, y);
    }
    c.stroke();
  });
  // a red-and-white buoy, close by, bobbing
  const bx = gw * 0.9 + par(0.6), by = hz + u * (up ? 0.2 : 0.17) + Math.sin(tk * 0.035) * 2 * s, br = u * 0.03;
  if (bx > -br * 3 && bx < gw + br * 3) {
    c.fillStyle = "rgba(223,246,255,0.35)"; c.beginPath(); c.ellipse(bx, by + br * 0.2, br * 1.6, br * 0.35, 0, 0, Math.PI * 2); c.fill();
    c.lineWidth = Math.max(1.2, br * 0.12); c.strokeStyle = OUT;
    c.beginPath(); c.moveTo(bx, by - br * 1.1); c.lineTo(bx, by - br * 1.9); c.stroke();
    c.beginPath(); c.moveTo(bx - br, by + br * 0.2); c.quadraticCurveTo(bx - br, by - br * 1.3, bx, by - br * 1.3); c.quadraticCurveTo(bx + br, by - br * 1.3, bx + br, by + br * 0.2); c.closePath();
    c.fillStyle = "#d24a3a"; c.fill();
    c.save(); c.clip(); c.fillStyle = "#f6efe2"; c.fillRect(bx - br, by - br * 0.75, br * 2, br * 0.42); c.restore();
    c.stroke();
    glowDot(c, bx, by - br * 2, br * 0.9, 0.5 + 0.4 * Math.sin(tk * 0.09), "#ffd38c");
  }
}

// the boat. Platforms: the wide low one is the boom (a round yard with a furled sail under it), the high one the crow's nest.
function bayStage(c, tk) {
  const S = STAGE.main, P = STAGE.plats;
  let top = P[0];
  for (const p of P) if (p.y < top.y) top = p;
  // the mast (behind everything, thin and mid-dark; nothing on it in the fighters' band), up to the nest's underside
  c.beginPath(); c.rect(-3.5, top.y + 10, 7, -top.y - 10);
  c.fillStyle = "#7f5a35"; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = "rgba(255,214,150,0.35)"; c.fillRect(-2.2, top.y + 12, 1.6, -top.y - 14);
  // stays from under the nest to the bow and stern, faint
  c.strokeStyle = "rgba(60,36,30,0.4)"; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(-2, top.y + 14); c.lineTo(S.x1 + 14, S.top - 3); c.moveTo(2, top.y + 14); c.lineTo(S.x2 - 14, S.top - 3); c.stroke();
  // the rope coil at the mast's foot
  c.lineWidth = 1.4; c.strokeStyle = OUT;
  for (const [y, rx] of [[-3, 13], [-6.5, 11], [-10, 8.5]]) { c.beginPath(); c.ellipse(0, y, rx, 3.2, 0, 0, Math.PI * 2); c.fillStyle = "#d9b77c"; c.fill(); c.stroke(); }
  // platforms
  for (const p of P) {
    const w = p.x2 - p.x1, mx = (p.x1 + p.x2) / 2, gy = p.y + 18 + Math.sin(tk * 0.03 + p.x1) * 2, nest = p === top && P.length > 1;
    c.fillStyle = "rgba(255,200,140,0.14)"; c.beginPath(); c.ellipse(mx, gy, w * 0.4, 5, 0, 0, Math.PI * 2); c.fill();
    if (!nest) {
      // the furled sail: cloth rolled and hanging in scallops under the yard
      c.beginPath(); c.moveTo(p.x1 + 8, p.y + 8);
      const n = Math.max(3, Math.round((w - 16) / 26)), sw = (w - 16) / n;
      for (let i = 0; i < n; i++) c.quadraticCurveTo(p.x1 + 8 + sw * (i + 0.5), p.y + 20, p.x1 + 8 + sw * (i + 1), p.y + 8);
      c.closePath(); c.fillStyle = "#f1e4c8"; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.roundRect(p.x1, p.y - 1, w, 11, 5.5);
      c.fillStyle = "#a67a48"; c.fill();
      c.fillStyle = "rgba(94,65,38,0.55)"; c.fillRect(p.x1 + 3, p.y + 6, w - 6, 3);
      c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = "#e8c384"; c.fillRect(p.x1 + 4, p.y, w - 8, 2.5);
      // rope lashings round the yard and the sail
      c.strokeStyle = "rgba(17,16,28,0.4)"; c.lineWidth = 1.2;
      for (const lx of [p.x1 + w * 0.18, mx, p.x2 - w * 0.18]) { c.beginPath(); for (const d of [-3, 0, 3]) { c.moveTo(lx + d - 1, p.y + 2.5); c.lineTo(lx + d + 1, p.y + 14); } c.stroke(); }
    } else {
      // the crow's nest: a round-ended plank with a rope trim, a pennant flapping at its left end
      const fx = p.x1 + 5, fy = p.y - 1, fl = Math.sin(tk * 0.12);
      c.lineWidth = 1.6; c.strokeStyle = OUT; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 26); c.stroke();
      c.beginPath(); c.moveTo(fx, fy - 26); c.quadraticCurveTo(fx - 9, fy - 23 + fl * 2, fx - 17, fy - 21 + fl * 3.5); c.quadraticCurveTo(fx - 9, fy - 18 + fl * 1.5, fx, fy - 16); c.closePath();
      c.fillStyle = "#b4533c"; c.fill(); c.lineWidth = 1.4; c.stroke();
      c.beginPath(); c.roundRect(p.x1, p.y - 1, w, 11, 5.5);
      c.fillStyle = "#c89a5e"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = "#e8c384"; c.fillRect(p.x1 + 4, p.y, w - 8, 2.5);
      c.strokeStyle = "#f3d9a4"; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x1 + 6, p.y + 6.5); c.lineTo(p.x2 - 6, p.y + 6.5); c.stroke();
      c.strokeStyle = "rgba(127,90,53,0.8)"; c.lineWidth = 1; c.beginPath();
      for (let x = p.x1 + 9; x < p.x2 - 6; x += 5) { c.moveTo(x, p.y + 5.4); c.lineTo(x - 2, p.y + 7.6); }
      c.stroke();
    }
  }
  // the hull
  if (!BAY.hull) { BAY.hull = c.createLinearGradient(0, 0, 0, 64); BAY.hull.addColorStop(0, "#a67a48"); BAY.hull.addColorStop(1, "#5e4126"); }
  const X2 = S.x2, X1 = S.x1, T = S.top, hk = X1 + "," + X2 + "," + T;
  if (BAY.hullK !== hk) {   // the hull's outline only changes with the layout
    const h = new Path2D();
    h.moveTo(X1, T); h.lineTo(X2, T); h.lineTo(X2 + 6, T + 14); h.lineTo(X2 - 8, T + 48); h.lineTo(X2 - 50, T + 64);
    h.lineTo(X1 + 50, T + 64); h.lineTo(X1 + 8, T + 48); h.lineTo(X1 - 6, T + 14); h.closePath();
    BAY.hullP = h; BAY.hullK = hk;
  }
  // its shadow on the water, then the hull: planks, the bumper stripe, the red waterline
  c.fillStyle = "rgba(20,28,60,0.3)"; c.beginPath(); c.ellipse((X1 + X2) / 2, T + 68, (X2 - X1) / 2 - 30, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = BAY.hull; c.fill(BAY.hullP);
  c.save(); c.clip(BAY.hullP);
  c.strokeStyle = "rgba(17,16,28,0.35)"; c.lineWidth = 2; c.beginPath();
  for (const y of [16, 32, 48]) { c.moveTo(X1 - 10, T + y); c.lineTo(X2 + 10, T + y); }
  c.stroke();
  c.strokeStyle = "rgba(255,214,150,0.18)"; c.lineWidth = 1; c.beginPath();
  for (const y of [17.5, 33.5]) { c.moveTo(X1 - 10, T + y); c.lineTo(X2 + 10, T + y); }
  c.stroke();
  c.fillStyle = "#f1e4c8"; c.fillRect(X1 - 10, T + 10.5, X2 - X1 + 20, 3);
  c.fillStyle = "#b4533c"; c.fillRect(X1 - 10, T + 52, X2 - X1 + 20, 13);
  c.fillStyle = "rgba(255,190,140,0.35)"; c.fillRect(X1 - 10, T + 52, X2 - X1 + 20, 1.5);
  c.restore();
  c.lineWidth = 3; c.lineJoin = "round"; c.strokeStyle = OUT; c.stroke(BAY.hullP);
  // her name on the bow
  c.font = '800 11px "Barlow Condensed", "Arial Narrow", sans-serif'; c.textAlign = "center"; c.fillStyle = "rgba(241,228,200,0.9)";
  c.fillText("SWEET POTATO", X2 - 135, T + 44);
  // portholes and tyre fenders
  for (const px of [-200, -90, 90, 200]) {
    c.beginPath(); c.arc(px, T + 30, 6, 0, Math.PI * 2); c.fillStyle = "#c4c8d2"; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(px, T + 30, 3.8, 0, Math.PI * 2); c.fillStyle = "#3f5f93"; c.fill();
    c.fillStyle = "#ffd38c"; c.beginPath(); c.arc(px - 1.2, T + 28.8, 1.3, 0, Math.PI * 2); c.fill();
  }
  for (const tx of [X1 + 30, X2 - 30]) {
    c.strokeStyle = "#d9b77c"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(tx, T + 4); c.lineTo(tx, T + 13); c.stroke();
    c.beginPath(); c.arc(tx, T + 22, 9, 0, Math.PI * 2); c.lineWidth = 7; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.5; c.strokeStyle = "#2e2a33"; c.stroke();
    c.beginPath(); c.arc(tx, T + 22, 9, Math.PI * 1.1, Math.PI * 1.5); c.lineWidth = 1.5; c.strokeStyle = "rgba(255,214,150,0.45)"; c.stroke();
  }
  // foam along the waterline (y 58..66), drifting, tapering where the water meets the hull's ends: the boat floats
  const fa = X1 + 38, fb = X2 - 38, off = tk * 0.2;
  c.beginPath();
  for (let i = Math.floor(off / 11), x = fa + i * 11 - off; x < fb; i++, x += 11) {
    const k = Math.min(1, (x - fa) / 34, (fb - x) / 34);
    if (k <= 0.05) continue;
    const n = nz(i * 1.37), rx = (7 + 2.5 * n) * k, ry = (2.2 + 1.2 * n) * k, cy = T + 61.5 + (n - 0.5) * 1.6;
    c.moveTo(x + rx, cy); c.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
  }
  c.fillStyle = "rgba(223,246,255,0.62)"; c.fill();
  // the deck edge (the lip), plank gaps, cleats on the corners as the ledge marks
  c.beginPath(); c.roundRect(X1 - 4, T - 3, X2 - X1 + 8, 12, 5);
  c.fillStyle = "#c89a5e"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = "#e8c384"; c.fillRect(X1, T - 2, X2 - X1, 3);
  c.strokeStyle = "rgba(17,16,28,0.3)"; c.lineWidth = 1.2; c.beginPath();
  for (let x = X1 + 40; x < X2 - 10; x += 40) { c.moveTo(x, T + 1.5); c.lineTo(x, T + 8); }
  c.stroke();
  for (const cx of [X1, X2]) { c.beginPath(); c.roundRect(cx - 5, T - 6, 10, 4, 2); c.fillStyle = "#f3d9a4"; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke(); }
  baySplashes(c, tk);
}

// a bottom KO: a splash on the water at the screen's bottom edge, under where the fighter went down (ring, spout, 8 drops)
function bayKo(e, live) {
  if (e.y <= STAGE.blast.bottom - 40) return;
  BAY.splash.push({ x: e.x, t0: tick, d: Array.from({ length: 8 }, (_, i) => ({ a: -Math.PI / 2 + (i / 7 - 0.5) * 1.9 + (Math.random() - 0.5) * 0.15, v: 4 + Math.random() * 3.2, r: 3 + Math.random() * 2 })) });
  if (BAY.splash.length > 4) BAY.splash.shift();
  if (live) { Sfx.noise(0.15, 0.2, 600); Sfx.tone(320, 110, 0.18, "sine", 0.2); }
}
function baySplashes(c, tk) {
  if (!BAY.splash.length) return;
  const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), s = u / 390, y0 = gh - u * 0.08;
  c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (let i = BAY.splash.length - 1; i >= 0; i--) {
    const q = BAY.splash[i], t = tk - q.t0;
    if (t < 0 || t > 40) { BAY.splash.splice(i, 1); continue; }
    const x = clamp(gw / 2 + (q.x - cam.x) * cam.z, u * 0.1, gw - u * 0.1);
    if (t <= 25) {
      const k = t / 25, r = (10 + 50 * (1 - (1 - k) * (1 - k))) * s;
      c.globalAlpha = 1 - k; c.strokeStyle = "#dff6ff"; c.lineWidth = 3 * (1 - k) + 1;
      c.beginPath(); c.ellipse(x, y0, r, r * 0.32, 0, 0, Math.PI * 2); c.stroke();
    }
    if (t <= 24) {   // the spout
      const k = t / 24, hgt = 46 * s * Math.sin(k * Math.PI), wd = 9 * s * (1 - k * 0.5);
      c.globalAlpha = 0.85 * (1 - k * 0.6); c.fillStyle = "#dff6ff";
      c.beginPath(); c.moveTo(x - wd, y0); c.quadraticCurveTo(x - wd * 0.3, y0 - hgt * 0.6, x, y0 - hgt); c.quadraticCurveTo(x + wd * 0.3, y0 - hgt * 0.6, x + wd, y0); c.closePath(); c.fill();
    }
    if (t <= 30) {
      c.globalAlpha = Math.min(1, (30 - t) / 10); c.fillStyle = "#dff6ff";
      for (const d of q.d) {
        const dx = x + Math.cos(d.a) * d.v * s * t, dy = y0 + Math.sin(d.a) * d.v * s * t + 0.15 * s * t * t;
        if (dy > y0 + 4) continue;
        c.beginPath(); c.arc(dx, dy, d.r * s, 0, Math.PI * 2); c.fill();
      }
    }
  }
  c.restore();
}
// ambience, only in a live match with the sound on: a soft wash of waves swelling every 5 s, a gull now and then
function bayTick(g, live) {
  if (!live || !Sfx.ok()) return;
  if (tick >= BAY.wave || BAY.wave - tick > 600) { bayWash(); BAY.wave = tick + 300; }
  if (!BAY.gull || BAY.gull - tick > 1300 || tick - BAY.gull > 30) BAY.gull = tick + 300 + Math.random() * 600;   // first one 5-15 s in
  else if (tick >= BAY.gull) { Sfx.tone(1700, 1150, 0.12, "sine", 0.03); Sfx.later(200, () => Sfx.tone(1650, 1100, 0.12, "sine", 0.026)); BAY.gull = tick + 720 + Math.random() * 480; }
}
function bayWash() {
  const A = Sfx, ac = A.ctx, t = ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(), v = 0.032;
  src.buffer = A.noiseBuf; src.loop = true; f.type = "lowpass"; f.frequency.value = 400; f.Q.value = 0.5;
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v * 0.3, t + 0.4); gn.gain.linearRampToValueAtTime(v, t + 2.5);
  gn.gain.linearRampToValueAtTime(v * 0.3, t + 4.8); gn.gain.linearRampToValueAtTime(0.0001, t + 5.3);
  src.connect(f); f.connect(gn); gn.connect(A.out); src.start(t, Math.random() * 0.5); src.stop(t + 5.4);
}
MAP_ART.bay = { name: "Spudset Bay", bg: bayBg, stage: bayStage, tick: bayTick, ko: bayKo };
