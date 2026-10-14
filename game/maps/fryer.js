/* ---- Deep Fryday (fable-design.md "Map 3"): inside a giant deep fryer. We look over the fryer's far rim into a dark kitchen (the
   extractor hood and its two lamps); the steel inner wall is the backdrop of the fight; the stage is a wire fry basket dipped into
   boiling fat; the four platforms are golden fries. The fat bubbles, spits and steams, purely as decoration: it never hurts anyone.
   bg: screen space, every layer offset by -cam.x * cam.z * k (parallax); the big gradients are cached on (gw, gh, round(rimY),
   round(fatY)), the steam puff and the lamp glow are pre-rendered sprites. stage: world space (STAGE.main, STAGE.plats); the fries keep
   the platforms' standable signature (11-unit body, light top line, glow underneath). tick: the bottom-KO splashes and the quiet
   ambience (bubbling, the element's hum, the hood), sounds only while the match is live. ko: a bottom KO splashes fat and sizzles.
   Joke: a raw potato in swim goggles and a swim cap sits on the rim, legs dangling, shivering, peeking down. Next in. UI only. */
MAP_ART.fryer = (() => {
  const TAU = Math.PI * 2;
  const C = {
    kit: "#2a1d22", kitWarm: "#4a2f2e", hood: "#6a6e7c", lamp: "#ffb86a", wall: "#5a5e6c", wallShade: "#3a3d48", rim: "#8a8f9c", rimHi: "#d8dce6",
    fatTop: "#e8b24a", fat: "#c07e24", fatMid: "#8a5218", fatDeep: "#4e2c0c", splash: "#f6c45c", fry: "#f2c14e", fryHi: "#ffe48f", crust: "#c9862b", bubble: "#fff0c0",
  };
  const K = { key: "", kit: null, wall: null, warm: null, spill: null, fat: null, steam: null, glow: null, body: null, mesh: null, dip: null, bodyFor: null };
  const WL = 46;   // the waterline on the basket (world units under the floor): only its bottom dips into the fat
  const hash = (n) => { const x = Math.sin(n * 91.73 + 17.31) * 43758.5453; return x - Math.floor(x); };
  // 14 bubbles (k 0.4): x as a fraction of the width, depth d (0 = the far line of the fat, 1 = near the bottom edge), period, top radius.
  // The biggest sit beside the basket (0.15-0.25 and 0.75-0.85).
  const BUB = [
    [0.18, 0.05, 74, 7], [0.82, 0.08, 66, 7], [0.22, 0.3, 58, 6], [0.77, 0.26, 82, 6], [0.06, 0.18, 46, 4], [0.94, 0.12, 52, 4],
    [0.4, 0.75, 88, 5], [0.62, 0.68, 62, 5], [0.12, 0.55, 70, 5], [0.88, 0.5, 44, 4],
    [0.3, 0.45, 40, 4], [0.7, 0.4, 56, 4], [0.5, 0.88, 78, 4], [0.02, 0.4, 64, 3],
  ].map(([x, d, per, r], i) => ({ x, d, per, r, off: (hash(i * 3.3) * per) | 0 }));
  // floating fries (k 0.5): x, depth (fraction of the fat's height), bob period, tilt
  const FLOAT = [[0.07, 0.12, 200, 0.2], [0.93, 0.2, 230, -0.15], [0.27, 0.62, 190, -0.1], [0.72, 0.5, 215, 0.12], [0.5, 0.95, 205, 0.05]];

  function sprite(S, draw) { const cv = document.createElement("canvas"); cv.width = cv.height = S; draw(cv.getContext("2d"), S); return cv; }
  function sprites() {
    if (K.steam) return;
    K.steam = sprite(96, (x, S) => {
      const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, "rgba(255,240,220,0.18)"); g.addColorStop(0.55, "rgba(255,240,220,0.1)"); g.addColorStop(1, "rgba(255,240,220,0)");
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    });
    K.glow = sprite(96, (x, S) => {
      const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, "rgba(255,184,106,1)"); g.addColorStop(0.4, "rgba(255,184,106,0.5)"); g.addColorStop(1, "rgba(255,184,106,0)");
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    });
  }
  function grads(c, gw, gh, hz, rimY, fatY, u) {
    const key = gw + "," + gh + "," + Math.round(rimY) + "," + Math.round(fatY);
    if (K.key === key) return;
    K.key = key;
    K.kit = c.createLinearGradient(0, 0, 0, Math.max(1, rimY));
    K.kit.addColorStop(0, C.kit); K.kit.addColorStop(1, C.kitWarm);
    K.wall = c.createLinearGradient(0, rimY, 0, fatY);
    K.wall.addColorStop(0, C.wall); K.wall.addColorStop(1, C.wallShade);
    K.spill = c.createLinearGradient(0, rimY, 0, rimY + u * 0.16);   // the hood lamps' light falling on the top of the wall
    K.spill.addColorStop(0, "rgba(255,184,106,0.1)"); K.spill.addColorStop(1, "rgba(255,184,106,0)");
    K.warm = c.createLinearGradient(0, fatY - u * 0.22, 0, fatY);   // the fat's glow on the bottom of the wall
    K.warm.addColorStop(0, "rgba(255,160,60,0)"); K.warm.addColorStop(1, "rgba(255,160,60,0.2)");
    K.fat = c.createLinearGradient(0, fatY, 0, gh);
    K.fat.addColorStop(0, C.fatTop); K.fat.addColorStop(0.12, C.fat); K.fat.addColorStop(0.5, C.fatMid); K.fat.addColorStop(1, C.fatDeep);
  }

  // the raw potato in goggles and a swim cap, sitting on the rim at (x, y), legs dangling into the fryer; k = size unit
  function swimmer(c, x, y, k, tk) {
    const jit = ((tk / 20) | 0) % 2 ? 0.5 : -0.5, pq = tk % 360, peek = pq < 60 ? Math.sin((pq / 60) * Math.PI) * 0.1 : 0, kick = Math.sin((tk / 60) * TAU);
    c.save(); c.translate(x + jit, y);
    // two stubby legs over the inner wall, kicking; two little arms holding the rim
    const limbs = () => {
      c.beginPath();
      c.moveTo(-k * 1.1, -k * 0.4); c.lineTo(-k * 1.1 + kick * k * 0.5, k * 1.9); c.moveTo(k * 1.1, -k * 0.4); c.lineTo(k * 1.1 - kick * k * 0.5, k * 1.9);
      c.moveTo(-k * 2.3, -k * 1.6); c.lineTo(-k * 3.1, k * 0.1); c.moveTo(k * 2.3, -k * 1.6); c.lineTo(k * 3.1, k * 0.1);
      c.stroke();
    };
    c.lineCap = "round"; c.strokeStyle = OUT; c.lineWidth = k * 1.15 + 1.6; limbs();
    c.strokeStyle = "#c79a62"; c.lineWidth = k * 1.15; limbs();
    c.rotate(peek);
    // body: a lumpy raw potato
    c.beginPath();
    for (let i = 0; i <= 20; i++) { const a = (i / 20) * TAU, w = 1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 5); const px = Math.cos(a) * k * 2.5 * w, py = -k * 3 + Math.sin(a) * k * 3 * w; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath(); c.fillStyle = "#d4a868"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "rgba(140,92,44,0.55)";
    for (const [ex, ey] of [[-1.3, -1.5], [1.1, -1], [0.1, -0.5], [-0.6, -2.4]]) { c.beginPath(); c.ellipse(ex * k, ey * k, k * 0.32, k * 0.22, 0, 0, TAU); c.fill(); }
    // swim cap
    c.beginPath(); c.moveTo(-k * 2.5, -k * 3.6); c.quadraticCurveTo(-k * 2.4, -k * 6.4, 0, -k * 6.45); c.quadraticCurveTo(k * 2.4, -k * 6.4, k * 2.5, -k * 3.6); c.closePath();
    c.fillStyle = "#e5505e"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "rgba(255,255,255,0.75)"; c.fillRect(-k * 0.3, -k * 6.3, k * 0.6, k * 2.6);
    // goggles: a strap and two lenses
    c.fillStyle = OUT; c.fillRect(-k * 2.5, -k * 3.65, k * 5, k * 0.55);
    for (const s of [-1, 1]) {
      c.beginPath(); c.arc(s * k * 0.95, -k * 3.35, k * 0.85, 0, TAU); c.fillStyle = "#7fd8ff"; c.fill(); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = "rgba(255,255,255,0.85)"; c.beginPath(); c.arc(s * k * 0.95 - k * 0.3, -k * 3.6, k * 0.22, 0, TAU); c.fill();
    }
    c.restore();
  }
  // one bubble of hot fat sitting on the surface at (x, y): a pale dome, a light rim, a glint
  function bubble(c, x, y, r) {
    c.beginPath(); c.arc(x, y - r * 0.7, r, 0, TAU);
    c.fillStyle = "rgba(255,226,150,0.4)"; c.fill(); c.lineWidth = 1.1; c.strokeStyle = "rgba(255,240,192,0.9)"; c.stroke();
    if (r > 2) { c.fillStyle = "rgba(255,255,240,0.95)"; c.beginPath(); c.arc(x - r * 0.38, y - r * 1.08, r * 0.24, 0, TAU); c.fill(); }
  }
  // a fry lying flat, centred on (x, y), len x wd, turned by a
  // (half sunk, with a brown outline instead of the black one, so it stays background and never reads as a thrown fry)
  function lyingFry(c, x, y, len, wd, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.roundRect(-len / 2, -wd / 2, len, wd, wd * 0.3); c.fillStyle = C.fry; c.fill();
    c.fillStyle = C.crust; c.fillRect(-len / 2, -wd / 2, wd * 0.6, wd); c.fillRect(len / 2 - wd * 0.6, -wd / 2, wd * 0.6, wd);
    c.fillStyle = C.fryHi; c.fillRect(-len / 2 + wd * 0.7, -wd / 2 + 1, len - wd * 1.4, wd * 0.28);
    c.fillStyle = "rgba(192,126,36,0.6)"; c.fillRect(-len / 2, wd * 0.05, len, wd * 0.45);   // the fat over its lower half
    c.lineWidth = 1.2; c.strokeStyle = "rgba(70,36,10,0.85)"; c.beginPath(); c.roundRect(-len / 2, -wd / 2, len, wd, wd * 0.3); c.stroke();
    c.restore();
  }

  function bg(c, tk) {
    const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), s = u / 390, up = L.portrait;
    const hz = gh * 0.7 - (cam.y + 110) * cam.z * 0.16;
    // the fat line: hz + gh * 0.1, but never below the basket's waterline (so the basket always dips in, also upright and with the
    // camera low; from above, the far edge of the fat shows a little higher than the waterline, as a surface seen from above does)
    const oy = gh / 2 - cam.y * cam.z + cam.sy;
    const rimY = Math.min(hz - u * 0.62, gh * 0.1), fatY = Math.min(hz + gh * 0.1, oy + WL * cam.z);
    sprites(); grads(c, gw, gh, hz, rimY, fatY, u);
    const pk = (k) => -cam.x * cam.z * k;
    // 1. the kitchen beyond the rim, the extractor hood and its two lamps
    if (rimY > 0) {
      c.fillStyle = K.kit; c.fillRect(0, 0, gw, rimY + 1);
      const hx = gw / 2 + pk(0.02), hw = gw * (up ? 0.9 : 0.6), hh = Math.min(u * 0.12, rimY * 0.72);
      c.fillStyle = "rgba(255,255,255,0.035)";
      for (let x = ((pk(0.02) % (u * 0.08)) + u * 0.08) % (u * 0.08); x < gw; x += u * 0.08) c.fillRect(x, 0, 1, rimY);   // wall tiles
      c.fillStyle = C.hood;
      c.beginPath(); c.moveTo(hx - hw * 0.4, 0); c.lineTo(hx + hw * 0.4, 0); c.lineTo(hx + hw / 2, hh); c.lineTo(hx - hw / 2, hh); c.closePath(); c.fill();
      c.fillStyle = "#4e515d"; c.fillRect(hx - hw / 2, hh - Math.max(2, hh * 0.16), hw, Math.max(2, hh * 0.16));
      c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(hx - hw * 0.4, 0, hw * 0.8, 1);
      const pulse = 0.45 + 0.05 * Math.sin((tk / 120) * TAU), gr = u * 0.05 * 2.2;
      for (const sd of [-1, 1]) {
        const lx = hx + sd * hw * 0.42, ly = hh;
        c.globalAlpha = pulse; c.drawImage(K.glow, lx - gr, ly - gr, gr * 2, gr * 2); c.globalAlpha = 1;
        c.fillStyle = "#ffe2b0"; c.beginPath(); c.ellipse(lx, ly, u * 0.012, u * 0.005, 0, 0, TAU); c.fill();
      }
    }
    // 2. the rim and the inner wall
    const rb = u * 0.03, wy = rimY + rb;   // the rim band, then the wall below it
    c.fillStyle = K.wall; c.fillRect(0, wy, gw, fatY - wy + 1);
    c.fillStyle = K.spill; c.fillRect(0, wy, gw, u * 0.16);
    c.fillStyle = K.warm; c.fillRect(0, fatY - u * 0.22, gw, u * 0.22 + 1);
    c.fillStyle = "rgba(255,255,255,0.06)";
    for (const f of [0.22, 0.47, 0.71]) c.fillRect(0, wy + (fatY - wy) * f, gw, 1);   // brushed steel
    { // the two lamps' light pooling on the top of the wall
      const hx = gw / 2 + pk(0.02), hw = gw * (up ? 0.9 : 0.6), R = u * 0.3;
      c.globalAlpha = 0.09; for (const sd of [-1, 1]) c.drawImage(K.glow, hx + sd * hw * 0.42 - R, wy - R * 0.5, R * 2, R * 1.3); c.globalAlpha = 1;
    }
    // the light off the fat dancing on the bottom of the wall (two wavy lines)
    c.lineWidth = Math.max(1.5, u * 0.004);
    for (let j = 0; j < 2; j++) {
      const y0 = fatY - u * (0.05 + j * 0.06), amp = u * (0.008 + j * 0.004), wl = u * (0.16 + j * 0.07), ph = tk * (0.02 + j * 0.013);
      c.strokeStyle = `rgba(255,205,120,${0.13 - j * 0.04})`; c.beginPath();
      for (let x = -4; x <= gw + wl / 8; x += wl / 8) { const y = y0 + Math.sin(x / wl * TAU + ph) * amp + Math.sin(x / (wl * 0.37) - ph * 1.7) * amp * 0.5; x < 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke();
    }
    if (!up) {   // the side walls, seen at an angle, their rim running up out of the picture
      const sw = gw * 0.05, dip = u * 0.07;
      c.fillStyle = C.wallShade;
      c.beginPath(); c.moveTo(0, rimY - dip); c.lineTo(sw, rimY); c.lineTo(sw, fatY); c.lineTo(0, fatY + dip * 0.4); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(gw, rimY - dip); c.lineTo(gw - sw, rimY); c.lineTo(gw - sw, fatY); c.lineTo(gw, fatY + dip * 0.4); c.closePath(); c.fill();
      c.fillStyle = "rgba(216,220,230,0.22)"; c.fillRect(sw - 1.5, rimY, 1.5, fatY - rimY); c.fillRect(gw - sw, rimY, 1.5, fatY - rimY);
      c.fillStyle = C.rim;
      c.beginPath(); c.moveTo(0, rimY - dip - rb); c.lineTo(sw, rimY); c.lineTo(sw, wy); c.lineTo(0, rimY - dip); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(gw, rimY - dip - rb); c.lineTo(gw - sw, rimY); c.lineTo(gw - sw, wy); c.lineTo(gw, rimY - dip); c.closePath(); c.fill();
    }
    c.fillStyle = C.rim; c.fillRect(up ? 0 : gw * 0.05, rimY, up ? gw : gw * 0.9, rb);
    c.fillStyle = C.rimHi; c.fillRect(0, rimY, gw, 1);
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(0, wy, gw, 2);
    // the swimmer on the rim (between the name card and the clock, where the HUD leaves the rim free)
    swimmer(c, gw * (up ? 0.5 : 0.31) + pk(0.05), rimY + 1, u * (up ? 0.012 : 0.0105), tk);
    // 3. steam rising off the fat at the edges
    for (let i = 0; i < 5; i++) {
      const L_ = 180, a = (tk + i * 36) % L_, cyc = Math.floor((tk + i * 36) / L_), left = i % 2 === 0;
      const x = gw * (left ? 0.01 + 0.16 * hash(cyc * 7 + i) : 0.83 + 0.16 * hash(cyc * 7 + i)) + pk(0.05) + Math.sin(a * 0.04 + i) * u * 0.01;
      const y = fatY - a * 0.35 * s, r = u * 0.09 * (1 + 0.6 * (a / L_)), al = Math.min(1, a / 25) * (1 - a / L_);
      c.globalAlpha = al * 1.6 > 1 ? 1 : al * 1.6; c.drawImage(K.steam, x - r, y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    // 4. a second basket at the back, its handle hooked on a peg (a little faded: it is far behind the stage)
    {
      c.globalAlpha = 0.82;
      const bx = gw * (up ? 0.06 : 0.1) + pk(0.15), bw = u * (up ? 0.1 : 0.12), bh = u * 0.1, top = fatY - u * 0.06;
      // the handle: a short steel rod up to a peg on the wall, curled over it, a black grip
      const R = u * 0.01, hx = bx + bw * 0.62, hy = top - u * 0.13, hw = Math.max(2.2, u * 0.008), ax = bx + bw * 0.3, ex = hx - R, ey = hy + R * 2.5;
      c.fillStyle = "#4e515d"; c.beginPath(); c.arc(hx, hy, R * 1.7, 0, TAU); c.fill();   // the peg's plate
      c.fillStyle = "#8a8f9c"; c.beginPath(); c.arc(hx, hy, R * 0.6, 0, TAU); c.fill();
      c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(ax, top); c.lineTo(ex, ey); c.lineTo(ex, hy); c.arc(hx, hy, R, Math.PI, 0); c.lineTo(hx + R, hy + R * 0.9);
      c.strokeStyle = OUT; c.lineWidth = hw + 2; c.stroke();
      c.strokeStyle = "#8a8f9c"; c.lineWidth = hw; c.stroke();
      c.strokeStyle = "#1d1e25"; c.lineWidth = hw * 2;
      c.beginPath(); c.moveTo(ax + (ex - ax) * 0.35, top + (ey - top) * 0.35); c.lineTo(ax + (ex - ax) * 0.8, top + (ey - top) * 0.8); c.stroke();
      for (const [dx, len, ang] of [[-0.32, 0.075, -0.2], [-0.14, 0.09, -0.06], [0.04, 0.08, 0.05], [0.2, 0.07, 0.16], [0.34, 0.06, 0.28]]) {
        c.save(); c.translate(bx + dx * bw, top + 2); c.rotate(ang);
        c.fillStyle = C.crust; c.fillRect(-u * 0.007, -u * len, u * 0.014, u * len);
        c.fillStyle = "rgba(255,228,143,0.35)"; c.fillRect(-u * 0.007, -u * len, u * 0.005, u * len);
        c.restore();
      }
      c.fillStyle = "#2c2e38"; c.fillRect(bx - bw / 2, top, bw, bh);
      c.strokeStyle = "rgba(190,200,220,0.2)"; c.lineWidth = 1;
      c.beginPath();
      for (let x = bx - bw / 2 + bw / 8; x < bx + bw / 2 - 1; x += bw / 8) { c.moveTo(x, top); c.lineTo(x, top + bh); }
      for (let y = top + bh / 4; y < top + bh; y += bh / 4) { c.moveTo(bx - bw / 2, y); c.lineTo(bx + bw / 2, y); }
      c.stroke();
      c.fillStyle = "#6a6e7c"; c.fillRect(bx - bw / 2 - 1, top - 2, bw + 2, 3);
      c.globalAlpha = 1;
    }
    // 5. the fat
    c.fillStyle = K.fat; c.fillRect(0, fatY, gw, gh - fatY + 1);
    const fh = gh - fatY;
    // the bright surface line at the back, slowly sliding
    {
      const n = 12, bw = gw / n, ph = (tk * 0.2 * s) % bw;
      c.strokeStyle = C.bubble; c.lineWidth = 3; c.beginPath(); c.moveTo(-bw + ph, fatY);
      for (let i = 0; i <= n + 1; i++) { const x0 = -bw + ph + i * bw; c.quadraticCurveTo(x0 + bw / 2, fatY - 2, x0 + bw, fatY); }
      c.stroke();
      // the froth along it: tiny bubbles riding the same slide, swelling and popping in turn (one path)
      c.beginPath();
      for (let i = 0; i < 28; i++) {
        const q = (tk * 0.03 + hash(i * 3.7)) % 1, x = ((hash(i * 9.1) * gw + tk * 0.2 * s) % (gw + 8)) - 4, y = fatY + 2 + hash(i * 5.3) * 5 * s, r = (0.8 + 1.8 * q) * s;
        c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
      }
      c.fillStyle = "rgba(255,230,160,0.35)"; c.fill(); c.lineWidth = 1; c.strokeStyle = "rgba(255,240,192,0.75)"; c.stroke();
    }
    // floating fries (k 0.5)
    for (let i = 0; i < (up ? 5 : 4); i++) {
      const F = FLOAT[i], x = F[0] * gw + pk(0.5);
      const yy = (up ? fatY + fh * (0.05 + 0.25 * (i / 4)) : fatY + u * (0.04 + 0.08 * F[1])) + Math.sin((tk / F[2]) * TAU) * 1.5;
      c.strokeStyle = "rgba(255,240,200,0.22)"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, yy + 2, 20 * s, 4 * s, 0, 0, TAU); c.stroke();
      lyingFry(c, x, yy, 28 * s, 7 * s, F[3] * 0.4 + Math.sin((tk / (F[2] * 1.1)) * TAU) * 0.06);
      // a frying fry: small bubbles keep coming up round it
      c.beginPath();
      for (let j = 0; j < 5; j++) {
        const q = (tk * 0.04 + hash(i * 7.7 + j * 1.3)) % 1, bx = x + (hash(i * 3.1 + j * 2.9) - 0.5) * 34 * s, by = yy + (j % 2 ? 5 : -4) * s, r = (0.6 + 2 * q) * s;
        c.moveTo(bx + r, by); c.arc(bx, by, r, 0, TAU);
      }
      c.fillStyle = "rgba(255,230,160,0.4)"; c.fill(); c.strokeStyle = "rgba(255,240,192,0.8)"; c.stroke();
    }
    // bubbles (k 0.4): grow, then pop into a ring
    for (let i = 0; i < 14; i++) {
      const B = BUB[i], q = tk + B.off, cyc = Math.floor(q / B.per), k = q % B.per, grow = B.per - 5;
      const x = (B.x + (hash(i * 13.7 + cyc * 1.37) - 0.5) * 0.05) * gw + pk(0.4), y = fatY + 3 + B.d * fh * 0.8, sc = (0.7 + 0.6 * B.d) * s;
      if (k < grow) bubble(c, x, y, (1 + (B.r * 1.35 - 1) * (k / grow)) * sc);
      else {
        const p = (k - grow) / 5, r = (B.r * 1.35 + 3 * p) * sc;
        c.strokeStyle = `rgba(255,240,200,${0.7 * (1 - p)})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y - 1, r * 1.3, r * 0.45, 0, 0, TAU); c.stroke();
      }
    }
    // spitting fat: little drops hop out of the surface and fall back
    c.fillStyle = "#ffe9a8";
    for (let j = 0; j < 8; j++) {
      const per = 50 + 30 * hash(j * 5.1), q = tk + hash(j * 2.7) * per, cyc = Math.floor(q / per), k = (q % per) / per;
      if (k > 0.35) continue;
      const h = Math.sin((k / 0.35) * Math.PI) * (6 + 12 * hash(cyc + j)) * s;
      const x = gw * (j % 2 ? 0.6 + 0.4 * hash(cyc * 3.1 + j) : 0.4 * hash(cyc * 3.1 + j)) + pk(0.4), y = fatY + 2 + hash(cyc * 1.9 + j) * fh * 0.5;
      c.beginPath(); c.arc(x, y - h, 2 * s, 0, TAU); c.fill();
    }
    // bottom-KO splashes
    for (const S of splash) drawSplash(c, S, gw, gh, u, s);
    c.lineCap = "butt"; c.lineJoin = "miter";
  }

  // the stage: the fry basket
  function body(c) {
    const S = STAGE.main;
    c.beginPath();
    c.moveTo(S.x1, S.top); c.lineTo(S.x2, S.top); c.lineTo(S.x2 - 6, 48); c.quadraticCurveTo(S.x2 - 10, 62, S.x2 - 26, 62);
    c.lineTo(S.x1 + 26, 62); c.quadraticCurveTo(S.x1 + 10, 62, S.x1 + 6, 48); c.closePath();
  }
  function stage(c, tk) {
    const S = STAGE.main, w = S.x2 - S.x1;
    if (K.bodyFor !== S) {   // the body's gradient, the mesh path and the fat's gradient are in world units: built once
      K.bodyFor = S;
      K.body = c.createLinearGradient(0, S.top, 0, 64); K.body.addColorStop(0, "#4a4e5c"); K.body.addColorStop(1, "#262833");
      const m = new Path2D();
      for (let x = S.x1 + 14; x < S.x2; x += 14) { m.moveTo(x, 0); m.lineTo(x, 64); }
      for (const y of [14, 28, 42, 56]) { m.moveTo(S.x1, y); m.lineTo(S.x2, y); }
      K.mesh = m;
      K.dip = c.createLinearGradient(0, WL, 0, 66); K.dip.addColorStop(0, "rgba(232,178,74,0.92)"); K.dip.addColorStop(0.4, "rgba(192,126,36,0.9)"); K.dip.addColorStop(1, "rgba(110,62,18,0.92)");
    }
    body(c); c.fillStyle = K.body; c.fill();
    c.save(); c.clip();
    c.strokeStyle = "rgba(190,200,220,0.16)"; c.lineWidth = 1.5; c.stroke(K.mesh);
    c.strokeStyle = "#6a6e7c"; c.lineWidth = 4;   // the steel bar round the bottom
    c.beginPath(); c.moveTo(S.x2 - 3, 24); c.lineTo(S.x2 - 7, 48); c.quadraticCurveTo(S.x2 - 11, 60, S.x2 - 26, 60); c.lineTo(S.x1 + 26, 60); c.quadraticCurveTo(S.x1 + 11, 60, S.x1 + 7, 48); c.lineTo(S.x1 + 3, 24); c.stroke();
    // the dip: the bottom of the basket sits in the fat (the wires show faintly under the surface), a bright line at the waterline
    c.fillStyle = K.dip; c.fillRect(S.x1 - 4, WL, w + 8, 70 - WL);
    c.beginPath(); c.rect(S.x1 - 4, WL, w + 8, 70 - WL); c.clip();
    c.strokeStyle = "rgba(60,34,10,0.25)"; c.lineWidth = 1.5; c.stroke(K.mesh);
    c.restore();
    c.fillStyle = "rgba(255,240,192,0.9)"; c.fillRect(S.x1 + 4, WL - 1, w - 8, 2.2);
    body(c); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    // the boil along the waterline and where the basket's ends go into the fat
    for (let i = 0; i < 10; i++) {
      const per = 34 + 30 * hash(i * 4.1), q = tk + hash(i * 8.3) * per, cyc = Math.floor(q / per), k = (q % per) / per;
      const x = i < 3 ? S.x1 - 4 - 24 * hash(cyc + i * 2.2) : i < 6 ? S.x2 + 4 + 24 * hash(cyc + i * 2.2) : S.x1 + 30 + (w - 60) * hash(cyc * 1.3 + i);
      const r = (1.5 + 3.5 * k) * (i < 6 ? 1.1 : 0.7);
      if (k < 0.88) bubble(c, x, WL + 1, r);
      else { c.strokeStyle = `rgba(255,240,200,${(1 - k) / 0.12})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, WL - 1, r * 1.6, r * 0.5, 0, 0, TAU); c.stroke(); }
    }
    // the lip: the basket's steel rim, rivets, orange rubber grips on the corners (the ledges)
    c.beginPath(); c.roundRect(S.x1 - 4, S.top - 3, w + 8, 12, 5);
    c.fillStyle = C.rim; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = C.rimHi; c.fillRect(S.x1, S.top - 2, w, 3);
    c.fillStyle = OUT;
    for (let x = S.x1 + 30; x < S.x2 - 10; x += 60) { c.beginPath(); c.arc(x, S.top + 4.5, 1.5, 0, TAU); c.fill(); }
    for (const x of [S.x1, S.x2]) {
      c.beginPath(); c.roundRect(x - 5, S.top - 3.5, 10, 4, 2); c.fillStyle = "#ff9a3d"; c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
    }
    // the four fries (soft platforms): same 11-unit body, light top line and glow as everywhere, dressed as golden fries
    for (const p of STAGE.plats) {
      const pw = p.x2 - p.x1, gy = p.y + 18 + Math.sin(tk * 0.03 + p.x1) * 2;
      c.fillStyle = "rgba(255,200,100,0.14)"; c.beginPath(); c.ellipse((p.x1 + p.x2) / 2, gy, pw * 0.4, 5, 0, 0, TAU); c.fill();
      c.beginPath(); c.roundRect(p.x1, p.y - 1, pw, 11, 4);
      c.fillStyle = C.fry; c.fill();
      c.save(); c.clip();
      c.fillStyle = "rgba(201,134,43,0.45)"; c.fillRect(p.x1, p.y + 6, pw, 5);   // the shaded side face
      c.fillStyle = C.crust; c.fillRect(p.x1, p.y - 1, 6, 12); c.fillRect(p.x2 - 6, p.y - 1, 6, 12);
      c.restore();
      c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = C.fryHi; c.fillRect(p.x1 + 6, p.y, pw - 12, 2.5);
      c.fillStyle = C.crust;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(p.x1 + pw * (0.2 + 0.2 * i) + hash(p.x1 + i) * 8, p.y + 4.5 + hash(p.x2 + i) * 2, 1, 0, TAU); c.fill(); }
      c.fillStyle = "#ffffff";
      for (let i = 0; i < 3; i++) c.fillRect(p.x1 + pw * (0.28 + 0.22 * i) + hash(p.y + i * 7) * 10, p.y + 0.2, 1.2, 1.2);   // salt
    }
  }

  // bottom KO: a splash of fat from the bottom edge, a puff of steam, a sizzle
  const splash = [];
  function drawSplash(c, S, gw, gh, u, s) {
    const t = S.t, a = 1 - t / 40, y0 = gh - u * 0.03;
    if (t < 16) { c.strokeStyle = `rgba(255,240,192,${0.8 * (1 - t / 16)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(S.x, y0, (10 + t * 3.5) * s, (3 + t) * s, 0, 0, TAU); c.stroke(); }
    const r = u * 0.08 * (1 + t / 30);
    c.globalAlpha = Math.min(1, a * 2); c.drawImage(K.steam, S.x - r, y0 - u * 0.04 - t * 1.1 * s - r, r * 2, r * 2); c.drawImage(K.steam, S.x - r * 0.7, y0 - u * 0.06 - t * 1.4 * s - r * 0.7, r * 1.4, r * 1.4);
    c.globalAlpha = 1;
    if (t < 14) {   // the crown of fat thrown up where the fighter went in
      const k = t / 14, h = Math.sin(k * Math.PI) * u * 0.08, bw = u * 0.009;
      c.fillStyle = C.splash; c.strokeStyle = "rgba(60,30,8,0.8)"; c.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        const bx = S.x + i * u * 0.02, hh = h * (1 - Math.abs(i) * 0.25), lean = i * u * 0.014 * (0.4 + k);
        c.beginPath(); c.moveTo(bx - bw, y0 + 2); c.quadraticCurveTo(bx + lean * 0.4 - bw * 0.4, y0 - hh * 0.6, bx + lean, y0 - hh); c.quadraticCurveTo(bx + lean * 0.4 + bw * 0.4, y0 - hh * 0.6, bx + bw, y0 + 2); c.closePath(); c.fill(); c.stroke();
      }
    }
    for (const d of S.d) {
      const x = S.x + d.vx * t * s, y = y0 + (d.vy * t + 0.15 * t * t) * s;
      if (y > gh + 8) continue;
      c.globalAlpha = Math.min(1, a * 1.6);
      c.fillStyle = C.splash; c.beginPath(); c.arc(x, y, d.r * s, 0, TAU); c.fill(); c.lineWidth = 1.2; c.strokeStyle = "rgba(60,30,8,0.8)"; c.stroke();
      c.fillStyle = "#fff6d8"; c.fillRect(x - d.r * 0.4 * s, y - d.r * 0.5 * s, Math.max(1, d.r * 0.35 * s), Math.max(1, d.r * 0.35 * s));
    }
    c.globalAlpha = 1;
  }
  function sizzle() {
    if (!Sfx.ok()) return;
    Sfx.noiseF(0.45, 0.16, "highpass", 2000, 2400, 0.7);
    for (let i = 0; i < 6; i++) Sfx.later(20 + Math.random() * 400, () => Sfx.noiseF(0.012, 0.28, "highpass", 2600, 4200, 0.8));
  }
  function ko(e, live) {
    if (!(e.y > STAGE.blast.bottom - 40)) return;
    const u = Math.min(L.gw, L.gh), x = clamp(toScreen(e.x, e.y)[0], u * 0.06, L.gw - u * 0.06);
    if (splash.length > 3) splash.shift();
    splash.push({ x, t: 0, d: Array.from({ length: 8 }, (_, i) => { const a = -Math.PI / 2 + (i / 7 - 0.5) * 1.3 + (Math.random() - 0.5) * 0.15, sp = 4 + Math.random() * 3; return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 3 }; }) });
    if (live) sizzle();
  }

  // ambience: one quiet bed (the element's hum, the hood's rumble), re-laid every second with soft fades so it dies by itself
  // within 1.5 s when the ticks stop (pause, menu, hidden tab); and the bubbling: short band-passed pops every 150-400 ms
  const amb = { pop: 0, bed: 0 };
  function bed(a, t) {
    const D = 1.5, g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.5); g.gain.setValueAtTime(1, t + D - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + D);
    g.connect(Sfx.out);
    for (const [f, v] of [[60, 0.012], [120, 0.007]]) { const o = a.createOscillator(), og = a.createGain(); o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + D + 0.05); }
    const n = a.createBufferSource(), lp = a.createBiquadFilter(), ng = a.createGain();
    n.buffer = Sfx.noiseBuf; n.loop = true; lp.type = "lowpass"; lp.frequency.value = 200; ng.gain.value = 0.2;
    n.connect(lp); lp.connect(ng); ng.connect(g); n.start(t, Math.random() * 0.5); n.stop(t + D + 0.05);
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, (D + 0.3) * 1000);
  }
  function tick(g, live) {
    for (let i = splash.length - 1; i >= 0; i--) if (++splash[i].t >= 40) splash.splice(i, 1);
    if (!live || !Sfx.ok()) return;
    const a = Sfx.ctx, t = a.currentTime;
    if (t >= amb.pop) { amb.pop = t + 0.15 + Math.random() * 0.25; const f = 300 + Math.random() * 600; Sfx.noiseF(0.02 + Math.random() * 0.02, 0.35, "bandpass", f, f * 0.85, 2.5); }
    if (t >= amb.bed) { amb.bed = t + 1; bed(a, t); }
  }

  return { name: "Deep Fryday", bg, stage, tick, ko };
})();
