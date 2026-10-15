/* ---- The Field (map "field"; Fable's design /mnt/project-files/boss/fable-boss.md section 2): Old Scratch's arena, also a normal map.
   A night field under a harvest moon: wide floor, low ledges, no top platform. The sky is dark so the fighters' yellows pop; the band
   the fighters stand in keeps mid-dark, desaturated tones. bg (screen space, back to front): the sky with fixed stars (three twinkle),
   the harvest moon (a crow crosses it every 15 s), the far hills with a farmhouse (its window flickers) and a dead tree, the field's
   furrows with sprouts and a fog band on the horizon, the scarecrow with two crows (one hops), rising embers. stage (world space): a plot
   of farmland cut like a cake (topsoil, stones and three buried potatoes, roots), a stubble lip with sprouts and post stubs at the ledges;
   the platforms are two scorched barn planks held up by heat. A boss fight (Old Scratch on stage) gets a redder moon, twice the embers
   and a drone instead of the crickets. Joke: the middle buried potato watches the nearest fighter; all three shut their eyes when Old
   Scratch stomps. Upright: the moon high, the scarecrow at the right edge, five furrows, six embers. UI only: reads RG / the game, never
   writes it. Gradients are cached by (gw, gh, round(hz), boss); the moon, its glow and the sprout are sprites. */
MAP_ART.field = (() => {
  const TAU = Math.PI * 2;
  const C = {
    skyTop: "#1a0f2a", skyMid: "#4a1a3a", skyLow: "#8c2a2e", moon: "#ff6a3a", moonBoss: "#e8502a", crater: "#d94f2a", hills: "#2a1430", window: "#ffb86a",
    soil: "#5a3421", soilLight: "#7a4a2e", soilDark: "#3a2014", sprout: "#5a8a3a", stubble: "#a89048", stubbleLight: "#d4c070", post: "#e8d8a8",
    plank: "#7a4a2e", plankTop: "#a0683e", char: "#2a1a16", ember: "#ff9a3a", sack: "#c9a86a", coat: "#4a3a5a", crow: "#1a1420", pole: "#3a2a2a",
  };
  const K = { key: "", sky: null, soil: null, fog: null, moonK: "", moon: null, sprout: null, bodyFor: null, body: null, roots: null, gaps: null, rg: null, boss: false, shut: 0, dirt: [], g: null };
  const hash = (n) => { const x = Math.sin(n * 91.73 + 17.31) * 43758.5453; return x - Math.floor(x); };
  // 20 fixed stars in the top 40% of the sky; the first three twinkle
  const STARS20 = Array.from({ length: 20 }, (_, i) => ({ x: hash(i * 3.1 + 1), y: hash(i * 5.7 + 2) * 0.4, r: 1 + hash(i * 7.3 + 3) * 0.5 }));
  const FURROWS = [0.03, 0.07, 0.12, 0.18, 0.26, 0.36];
  // the cut face: five stones and three buried potatoes in the middle band, x in world units
  const STONES = [[-330, 27, 7, 4.5], [-160, 33, 9, 5.5], [-60, 24, 6, 4], [120, 31, 8, 5], [300, 26, 7.5, 4.8]];
  const SPUDS = [[-240, 29], [10, 30], [230, 28]];
  const LIP_SPROUTS = [-350, -240, -120, -20, 95, 210, 330];

  // is Old Scratch on stage in the game drawn this frame? (RG is set by render(); cached per game)
  function bossOn() {
    if (K.rg !== RG) { K.rg = RG; K.boss = !!(RG && RG.fighters.some((f) => f.spec.boss)); }
    return K.boss;
  }
  function sprite(w, h, draw) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")); return cv; }
  function grads(c, gw, gh, hz, u, boss) {
    const key = gw + "," + gh + "," + Math.round(hz) + "," + boss;
    if (K.key === key) return;
    K.key = key;
    K.sky = c.createLinearGradient(0, 0, 0, Math.max(1, hz));
    K.sky.addColorStop(0, C.skyTop); K.sky.addColorStop(0.55, C.skyMid); K.sky.addColorStop(1, boss ? "#9a2a26" : C.skyLow);
    K.soil = c.createLinearGradient(0, hz, 0, gh);
    K.soil.addColorStop(0, C.soil); K.soil.addColorStop(1, C.soilDark);
    const fh = u * 0.05;
    K.fog = c.createLinearGradient(0, hz - fh, 0, hz + fh);
    K.fog.addColorStop(0, "rgba(120,40,60,0)"); K.fog.addColorStop(0.5, "rgba(120,40,60,0.25)"); K.fog.addColorStop(1, "rgba(120,40,60,0)");
  }
  // the harvest moon with its glow (2.5 r) and three craters, as one sprite per size; redder in a boss fight
  function moonSprite(r, boss) {
    const key = Math.round(r) + (boss ? "b" : "");
    if (K.moonK === key) return K.moon;
    const R = Math.round(r), S = Math.ceil(R * 5 + 4), m = S / 2;
    K.moon = sprite(S, S, (x) => {
      const g = x.createRadialGradient(m, m, R * 0.9, m, m, R * 2.5);
      g.addColorStop(0, `rgba(255,110,60,${boss ? 0.45 : 0.3})`); g.addColorStop(1, "rgba(255,110,60,0)");
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.fillStyle = boss ? C.moonBoss : C.moon; x.beginPath(); x.arc(m, m, R, 0, TAU); x.fill();
      x.fillStyle = "rgba(255,190,140,0.25)"; x.beginPath(); x.arc(m - R * 0.25, m - R * 0.3, R * 0.62, 0, TAU); x.fill();
      x.fillStyle = C.crater;
      for (const [cx, cy, cr] of [[-0.4, -0.15, 0.2], [0.3, 0.32, 0.16], [0.25, -0.42, 0.11]]) { x.beginPath(); x.ellipse(m + cx * R, m + cy * R, cr * R * 1.15, cr * R, 0.3, 0, TAU); x.fill(); }
    });
    K.moonK = key;
    return K.moon;
  }
  function sproutSprite() {
    if (K.sprout) return K.sprout;
    K.sprout = sprite(24, 20, (x) => {   // two 6-px leaves on a short stem, drawn at 2x
      x.strokeStyle = "#3a5a26"; x.lineWidth = 2; x.lineCap = "round"; x.beginPath(); x.moveTo(12, 19); x.lineTo(12, 9); x.stroke();
      x.fillStyle = C.sprout;
      for (const s of [-1, 1]) { x.save(); x.translate(12 + s * 5, 8); x.rotate(s * 0.5); x.beginPath(); x.ellipse(0, 0, 6, 3, 0, 0, TAU); x.fill(); x.restore(); }
    });
    return K.sprout;
  }
  // a crow: two strokes (a flat V), wings up or down
  function crow(c, x, y, s, flap) {
    c.strokeStyle = C.crow; c.lineWidth = 2 * s; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(x - 7 * s, y - flap * 4 * s); c.quadraticCurveTo(x - 3 * s, y - flap * 1.5 * s - 1.5 * s, x, y); c.quadraticCurveTo(x + 3 * s, y - flap * 1.5 * s - 1.5 * s, x + 7 * s, y - flap * 4 * s); c.stroke();
  }
  // a crow sitting (on the scarecrow's arms): body, head, beak, tail
  function perched(c, x, y, s, d) {
    c.fillStyle = C.crow;
    c.beginPath(); c.ellipse(x, y - 4 * s, 4.2 * s, 3.2 * s, -0.2 * d, 0, TAU); c.fill();
    c.beginPath(); c.arc(x + 3.4 * s * d, y - 7.6 * s, 2.2 * s, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(x + 5 * s * d, y - 8 * s); c.lineTo(x + 8 * s * d, y - 7.2 * s); c.lineTo(x + 5 * s * d, y - 6.6 * s); c.fill();
    c.beginPath(); c.moveTo(x - 3 * s * d, y - 4 * s); c.lineTo(x - 8 * s * d, y - 2 * s); c.lineTo(x - 3 * s * d, y - 2 * s); c.fill();
  }
  function scarecrow(c, x, y, h, tk) {
    const s = h / 78, tilt = Math.sin((tk / 360) * TAU) * 0.1;
    c.save(); c.translate(x, y); c.lineCap = "round"; c.lineJoin = "round";
    // the stick cross
    c.strokeStyle = C.pole; c.lineWidth = 3.4 * s;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -h * 0.82); c.moveTo(-h * 0.36, -h * 0.6); c.lineTo(h * 0.36, -h * 0.6); c.stroke();
    // the torn coat hung on the crossbar
    c.fillStyle = C.coat; c.beginPath();
    c.moveTo(-h * 0.3, -h * 0.62); c.lineTo(h * 0.3, -h * 0.62); c.lineTo(h * 0.2, -h * 0.28); c.lineTo(h * 0.14, -h * 0.33); c.lineTo(h * 0.08, -h * 0.24);
    c.lineTo(0, -h * 0.3); c.lineTo(-h * 0.07, -h * 0.22); c.lineTo(-h * 0.13, -h * 0.31); c.lineTo(-h * 0.21, -h * 0.26); c.closePath(); c.fill();
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(-1 * s, -h * 0.62, 2 * s, h * 0.34);
    c.fillStyle = C.stubble;   // straw poking out of the sleeves
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * h * 0.3, -h * 0.63); c.lineTo(sd * h * 0.4, -h * 0.66); c.lineTo(sd * h * 0.39, -h * 0.6); c.lineTo(sd * h * 0.41, -h * 0.57); c.closePath(); c.fill(); }
    // the sack head with its stitched grin, under a straw hat; it tilts on a 6 s sine
    c.save(); c.translate(0, -h * 0.74); c.rotate(tilt);
    c.fillStyle = C.sack; c.beginPath(); c.ellipse(0, -h * 0.06, h * 0.12, h * 0.13, 0, 0, TAU); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.arc(-h * 0.045, -h * 0.08, 1.6 * s, 0, TAU); c.arc(h * 0.05, -h * 0.08, 1.6 * s, 0, TAU); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 1.2 * s; c.setLineDash([2 * s, 1.6 * s]);
    c.beginPath(); c.moveTo(-h * 0.07, -h * 0.01); c.quadraticCurveTo(0, h * 0.035, h * 0.075, -h * 0.015); c.stroke(); c.setLineDash([]);
    c.fillStyle = C.stubble; c.beginPath(); c.ellipse(0, -h * 0.17, h * 0.2, h * 0.04, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-h * 0.1, -h * 0.17); c.quadraticCurveTo(-h * 0.09, -h * 0.29, 0, -h * 0.29); c.quadraticCurveTo(h * 0.09, -h * 0.29, h * 0.1, -h * 0.17); c.closePath(); c.fill();
    c.fillStyle = "#6a5a2a"; c.fillRect(-h * 0.1, -h * 0.2, h * 0.2, 2 * s);
    c.restore();
    // two crows on the arms; the left one hops every 4 s
    const q = tk % 240, hop = q < 20 ? Math.sin((q / 20) * Math.PI) * 6 * s : 0;
    perched(c, -h * 0.31, -h * 0.6 - 1.5 * s - hop, s, -1);
    perched(c, h * 0.33, -h * 0.6 - 1.5 * s, s, 1);
    c.restore();
  }

  function bg(c, tk) {
    const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), s = u / 390, up = L.portrait, boss = bossOn();
    let hz = gh * 0.7 - (cam.y + 110) * cam.z * 0.16;
    if (up && STAGE.main) hz = Math.min(hz, toScreen(0, STAGE.main.top)[1] - u * 0.03);   // upright: the horizon just over the floor's lip, so the hills and the scarecrow show
    const P = (k) => -cam.x * cam.z * k;
    grads(c, gw, gh, hz, u, boss);
    // 1. the sky and its stars
    c.fillStyle = K.sky; c.fillRect(0, 0, gw, Math.max(0, hz) + 1);
    for (let i = 0; i < 20; i++) {
      const S = STARS20[i], a = i < 3 ? 0.6 + 0.3 * Math.sin((tk / 108) * TAU + i * 2.1) : 0.6;
      const x = ((((S.x * gw + P(0.02)) % gw) + gw) % gw), y = S.y * hz;
      c.fillStyle = `rgba(255,220,200,${a.toFixed(2)})`; c.beginPath(); c.arc(x, y, S.r * Math.max(1, s * 0.9), 0, TAU); c.fill();
    }
    // 2. the harvest moon (left: the boss stands right); a crow crosses it every 15 s
    const r = u * (up ? 0.12 : 0.14), mx = gw * (up ? 0.3 : 0.2) + P(0.04), my = up ? hz * 0.45 : hz - r * 1.1, ms = moonSprite(r, boss), md = ms.width / 2;
    c.drawImage(ms, mx - md, my - md);
    { const q = tk % 900;
      if (q < 160) { const k = q / 160; crow(c, mx - r * 2.2 + k * r * 4.4, my - r * 0.25 + Math.sin(k * 7) * r * 0.08, s * 1.1, ((tk >> 3) & 1) ? 1 : -0.4); } }
    // 3. the far hills: a farmhouse on the right one (its window flickers), a dead tree on the left one
    c.fillStyle = C.hills;
    const hl = [gw * (up ? 0.15 : 0.22) + P(0.06), gw * (up ? 0.5 : 0.55), u * (up ? 0.07 : 0.09)], hr = [gw * (up ? 0.8 : 0.74) + P(0.06), gw * (up ? 0.7 : 0.62), u * (up ? 0.1 : 0.12)];
    for (const [x, w, h] of [hl, hr]) {
      c.beginPath(); c.moveTo(x - w / 2, hz + 1); c.bezierCurveTo(x - w * 0.25, hz - h * 1.05, x + w * 0.25, hz - h * 1.05, x + w / 2, hz + 1); c.closePath(); c.fill();
    }
    { // the farmhouse
      const fx = hr[0] - hr[1] * 0.08, fy = hz - hr[2] * 0.78, fw = u * 0.075, fh = u * 0.045;
      c.fillRect(fx - fw / 2, fy - fh, fw, fh + 2);
      c.beginPath(); c.moveTo(fx - fw * 0.6, fy - fh); c.lineTo(fx, fy - fh - u * 0.035); c.lineTo(fx + fw * 0.6, fy - fh); c.closePath(); c.fill();
      c.fillRect(fx + fw * 0.2, fy - fh - u * 0.035, u * 0.009, u * 0.025);
      c.fillRect(fx + fw * 0.55, fy - fh * 0.7, u * 0.03, fh * 0.7 + 2);   // a lean-to
      const wa = 0.7 + 0.3 * hash(Math.floor(tk / 10));
      c.globalAlpha = wa * 0.35; c.fillStyle = C.window; c.beginPath(); c.arc(fx - fw * 0.15, fy - fh * 0.5, u * 0.022, 0, TAU); c.fill();
      c.globalAlpha = wa; c.fillRect(fx - fw * 0.15 - u * 0.007, fy - fh * 0.62, u * 0.014, u * 0.013);
      c.globalAlpha = 1; c.fillStyle = C.hills;
    }
    { // the dead tree: a trunk and four OUT branches
      const tx = hl[0] - hl[1] * 0.12, ty = hz - hl[2] * 0.82, th = u * 0.09;
      c.strokeStyle = OUT; c.lineCap = "round"; c.lineWidth = Math.max(2, 3.2 * s);
      c.beginPath(); c.moveTo(tx, ty + 2); c.quadraticCurveTo(tx + th * 0.05, ty - th * 0.5, tx - th * 0.04, ty - th); c.stroke();
      c.lineWidth = Math.max(1.4, 2 * s); c.beginPath();
      for (const [y0, dx, dy] of [[0.45, -0.3, -0.25], [0.6, 0.28, -0.22], [0.8, -0.2, -0.2], [0.9, 0.18, -0.2]]) {
        const bx = tx + th * 0.02, by = ty - th * y0;
        c.moveTo(bx, by); c.quadraticCurveTo(bx + dx * th * 0.5, by + dy * th * 0.2, bx + dx * th, by + dy * th);
      }
      c.stroke();
    }
    // 4. the field: soil, six furrows (five upright) with sprouts on the near three, a fog band drifting on the horizon
    c.fillStyle = K.soil; c.fillRect(0, hz, gw, gh - hz + 1);
    c.fillStyle = K.fog; c.fillRect(0, hz - u * 0.05, gw, u * 0.1);
    c.fillStyle = "rgba(120,40,60,0.12)";
    for (let i = 0; i < 3; i++) { const span = gw + u * 0.6, x = (((tk * 0.05 * s + i * span / 3 + P(0.08)) % span) + span) % span - u * 0.3; c.beginPath(); c.ellipse(x, hz + u * 0.004, u * 0.3, u * 0.018, 0, 0, TAU); c.fill(); }
    const nF = up ? 5 : 6, sp = sproutSprite();
    for (let i = 0; i < nF; i++) {
      const y = hz + u * FURROWS[i] + 2, k = 0.1 + (0.3 * i) / (nF - 1), off = P(k), step = 30 * s * (0.7 + 0.15 * i);
      if (y > gh + 4) break;
      const x0 = ((off % step) + step) % step - step;
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? C.soilLight : C.soilDark; c.lineWidth = (pass ? 2 : 3.5) * Math.max(0.7, s * (0.7 + 0.12 * i));
        c.beginPath(); c.moveTo(x0, y + (pass ? 0 : 1.5));
        for (let x = x0; x < gw + step; x += step) c.quadraticCurveTo(x + step / 2, y - 2 * s * (0.7 + 0.15 * i) + (pass ? 0 : 1.5), x + step, y + (pass ? 0 : 1.5));
        c.stroke();
      }
      if (i >= nF - 3) {   // sprouts every 60 px on the near three
        const ss = s * (0.36 + 0.08 * i), sw = 24 * ss, sh = 20 * ss, st = 60 * s * (0.7 + 0.15 * i), sx0 = ((off % st) + st) % st - st;
        c.globalAlpha = 0.7;
        for (let x = sx0 + st * 0.5; x < gw + st; x += st) c.drawImage(sp, x - sw / 2, y - sh + 1, sw, sh);
        c.globalAlpha = 1;
      }
    }
    // 5. the scarecrow (k 0.3) with its two crows
    scarecrow(c, gw * (up ? 0.85 : 0.78) + P(0.3), hz + u * (up ? 0.06 : 0.1), u * (up ? 0.16 : 0.2), tk);
    // 6. embers rising (10; 20 in a boss fight; 6 upright)
    const nE = up ? 6 : boss ? 20 : 10;
    c.fillStyle = C.ember;
    for (let i = 0; i < nE; i++) {
      const per = 150, q = tk + Math.floor(hash(i * 2.3) * per), cyc = Math.floor(q / per), t = q % per;
      const span = gw + 40, x = ((((hash(i * 7.1 + cyc * 3.3) * span + P(0.5)) % span) + span) % span) - 20 + Math.sin(t * 0.04 + i) * 8 * s;
      const y = gh * (0.62 + 0.36 * hash(i * 4.4 + cyc * 1.7)) - t * 0.3 * s, rr = (1.5 + hash(i * 9.9) * 1) * Math.max(0.8, s);
      const a = Math.min(1, t / 20) * (1 - t / per);
      c.globalAlpha = a * 0.3; c.beginPath(); c.arc(x, y, rr * 2.4, 0, TAU); c.fill();
      c.globalAlpha = a; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    c.lineCap = "butt"; c.lineJoin = "miter";
  }

  // ---- the stage (world space): a plot of farmland cut like a cake ----
  function body(c) {
    const S = STAGE.main, x1 = S.x1, x2 = S.x2;
    c.beginPath(); c.moveTo(x1, S.top); c.lineTo(x2, S.top);
    c.lineTo(x2 + 2, 14); c.lineTo(x2 - 1, 22); c.lineTo(x2 + 1, 36); c.lineTo(x2 - 4, 50); c.quadraticCurveTo(x2 - 8, 64, x2 - 26, 64);
    c.lineTo(x2 - 120, 66); c.lineTo(x2 - 260, 63); c.lineTo(x1 + 250, 66); c.lineTo(x1 + 110, 63); c.lineTo(x1 + 26, 64);
    c.quadraticCurveTo(x1 + 8, 64, x1 + 4, 50); c.lineTo(x1 - 1, 38); c.lineTo(x1 + 1, 24); c.lineTo(x1 - 2, 12); c.closePath();
  }
  function spud(c, x, y, shut, lx, ly) {
    c.beginPath(); c.ellipse(x, y, 8, 6, 0.1, 0, TAU); c.fillStyle = "#c79a62"; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "rgba(140,92,44,0.6)"; c.beginPath(); c.arc(x - 5, y + 2.5, 1, 0, TAU); c.arc(x + 5.5, y - 2.5, 0.9, 0, TAU); c.fill();
    if (shut) { c.lineWidth = 1.3; c.beginPath(); c.moveTo(x - 4.6, y - 0.6); c.lineTo(x - 1.2, y - 0.6); c.moveTo(x + 1.2, y - 0.6); c.lineTo(x + 4.6, y - 0.6); c.stroke(); return; }
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(x - 2.8, y - 0.8, 2.2, 0, TAU); c.arc(x + 2.8, y - 0.8, 2.2, 0, TAU); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.arc(x - 2.8 + lx, y - 0.8 + ly, 1.1, 0, TAU); c.arc(x + 2.8 + lx, y - 0.8 + ly, 1.1, 0, TAU); c.fill();
  }
  function stage(c, tk) {
    const S = STAGE.main, x1 = S.x1, x2 = S.x2, w = x2 - x1;
    if (K.bodyFor !== S) {   // the roots and the lip's dirt gaps are world-space paths: built once per layout
      K.bodyFor = S;
      const r = new Path2D();
      for (let x = x1 + 30; x < x2 - 20; x += 46) {
        let px = x + hash(x) * 14, py = 41;
        r.moveTo(px, py);
        for (let j = 0; j < 4; j++) { px += (hash(x + j * 3.3) - 0.5) * 10; py += 4 + hash(x * 1.7 + j) * 4; r.lineTo(px, py); }
      }
      K.roots = r;
      const gp = new Path2D();
      for (let x = x1 + 20; x < x2 - 10; x += 40) { gp.moveTo(x, S.top - 2.5); gp.lineTo(x + 2, S.top + 7.5); }
      K.gaps = gp;
    }
    // the cake: topsoil 0-18, a stony middle 18-40, dark soil with pale roots 40-64
    body(c);
    c.save(); c.clip();
    c.fillStyle = "#4a2a18"; c.fillRect(x1 - 10, S.top, w + 20, 18);
    c.fillStyle = "#6b3f26"; c.fillRect(x1 - 10, 18, w + 20, 22);
    c.fillStyle = C.soilDark; c.fillRect(x1 - 10, 40, w + 20, 30);
    c.strokeStyle = "rgba(0,0,0,0.22)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x1, 18); c.lineTo(x2, 18); c.moveTo(x1, 40); c.lineTo(x2, 40); c.stroke();
    c.strokeStyle = "rgba(230,200,160,0.3)"; c.lineWidth = 1.5; c.stroke(K.roots);
    c.fillStyle = "rgba(255,230,190,0.1)"; for (let i = 0; i < 18; i++) c.fillRect(x1 + 20 + hash(i * 3.9) * (w - 40), 3 + hash(i * 6.1) * 12, 2, 2);   // crumbs in the topsoil
    for (const [sx, sy, rx, ry] of STONES) { c.beginPath(); c.ellipse(sx, sy, rx, ry, 0.15, 0, TAU); c.fillStyle = "#8a7a70"; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke(); c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(sx - rx * 0.4, sy - ry * 0.55, rx * 0.5, 1.4); }
    // the buried potatoes: the middle one watches the nearest fighter; all three shut their eyes at a Stomp (and blink now and then)
    const g = RG;
    SPUDS.forEach(([sx, sy], i) => {
      let lx = 0, ly = 0;
      if (i === 1 && g) {
        let best = null, bd = Infinity;
        for (const f of g.fighters) { if (f.state === "dead" || f.state === "gone") continue; const d = Math.abs(f.x - sx) + Math.abs(f.y - sy); if (d < bd) { bd = d; best = f; } }
        if (best) { const dx = best.x - sx, dy = best.y - best.s.h * 0.5 - sy, dl = Math.hypot(dx, dy) || 1; lx = (dx / dl) * 1.1; ly = (dy / dl) * 1.1; }
      }
      const blink = (tk + i * 97) % 300 < 6;
      spud(c, sx, sy, K.shut > 0 || blink, lx, ly);
    });
    c.restore();
    body(c); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    // the lip: stubble, its highlight, dirt gaps every 40 units, seven sprouts behind the feet, post stubs at the ledges
    for (const x of LIP_SPROUTS) {
      c.strokeStyle = "#3a5a26"; c.lineWidth = 1.8; c.lineCap = "round"; c.beginPath(); c.moveTo(x, S.top - 1); c.lineTo(x, S.top - 7); c.stroke();
      c.fillStyle = C.sprout;
      for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(x + sd * 3.6, S.top - 8, 3.8, 1.9, sd * 0.5, 0, TAU); c.fill(); }
    }
    c.beginPath(); c.roundRect(x1 - 4, S.top - 3, w + 8, 12, 5);
    c.fillStyle = C.stubble; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = C.stubbleLight; c.fillRect(x1, S.top - 2, w, 3);
    c.strokeStyle = "rgba(17,16,28,0.3)"; c.lineWidth = 1.5; c.stroke(K.gaps);
    c.fillStyle = C.post; c.strokeStyle = OUT; c.lineWidth = 1;
    for (const x of [x1, x2]) { c.beginPath(); c.roundRect(x - 5, S.top - 4, 10, 4, 1); c.fill(); c.stroke(); }
    // the two scorched barn planks, lifted by heat
    for (const p of STAGE.plats) plank(c, p, tk);
    c.lineCap = "butt";
    // bottom-KO dirt bursts: screen space (the bottom edge), drawn here so they fly in front of the floor
    if (K.dirt.length) {
      const z = cam.z, s = Math.min(L.gw, L.gh) / 390;
      c.save(); c.translate(cam.x - (L.gw / 2 + cam.sx) / z, cam.y - (L.gh / 2 + cam.sy) / z); c.scale(1 / z, 1 / z);
      for (const D of K.dirt) dirtBurst(c, D, L.gh, s);
      c.restore();
    }
  }
  function plank(c, p, tk) {
    const pw = p.x2 - p.x1, cx = (p.x1 + p.x2) / 2, bob = Math.sin((tk / 180) * TAU + p.x1) * 1.5, gy = p.y + 18 + bob;
    c.fillStyle = "rgba(255,120,50,0.18)"; c.beginPath(); c.ellipse(cx, gy, pw * 0.42, 6, 0, 0, TAU); c.fill();
    c.fillStyle = C.ember;
    for (let i = 0; i < 3; i++) {   // three ember dots rising under it
      const q = ((tk * 0.012 + i / 3 + hash(p.x1 + i)) % 1), ex = cx + (i - 1) * pw * 0.26 + Math.sin(tk * 0.05 + i * 2) * 3, ey = gy + 10 - q * 20;
      c.globalAlpha = Math.sin(q * Math.PI); c.beginPath(); c.arc(ex, ey, 1.6, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    // the plank: 11 units, its top lit (2.5), wood grain and nails, charred ends (6) with two flame licks
    c.beginPath(); c.roundRect(p.x1, p.y - 1, pw, 11, 3);
    c.fillStyle = C.plank; c.fill();
    c.save(); c.clip();
    c.fillStyle = "rgba(42,26,22,0.35)"; c.fillRect(p.x1, p.y + 6, pw, 5);
    c.strokeStyle = "rgba(42,26,22,0.45)"; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x1 + 8, p.y + 4); c.lineTo(p.x1 + pw * 0.45, p.y + 4.5); c.moveTo(p.x1 + pw * 0.55, p.y + 3.5); c.lineTo(p.x2 - 8, p.y + 4); c.stroke();
    c.fillStyle = C.char; c.fillRect(p.x1, p.y - 1, 6, 12); c.fillRect(p.x2 - 6, p.y - 1, 6, 12);
    c.fillStyle = "rgba(42,26,22,0.5)"; c.fillRect(p.x1 + 6, p.y - 1, 4, 12); c.fillRect(p.x2 - 10, p.y - 1, 4, 12);
    c.restore();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = C.plankTop; c.fillRect(p.x1 + 6, p.y, pw - 12, 2.5);
    c.fillStyle = OUT; for (const nx of [p.x1 + 16, p.x2 - 16]) { c.beginPath(); c.arc(nx, p.y + 4.5, 1.2, 0, TAU); c.fill(); }
    const fl = [1, 0.7, 0.85][((tk / 3) | 0) % 3];   // the flame licks flicker every 3 frames
    for (const [x, sd] of [[p.x1 + 3, -1], [p.x2 - 3, 1]]) {
      c.fillStyle = "#ff7a2b"; c.beginPath(); c.moveTo(x - 3, p.y); c.quadraticCurveTo(x - 2 + sd, p.y - 3 * fl, x + sd * 1.5, p.y - 5.5 * fl); c.quadraticCurveTo(x + 2.5, p.y - 2.5, x + 3, p.y); c.closePath(); c.fill();
      c.fillStyle = "#ffd84a"; c.beginPath(); c.moveTo(x - 1.4, p.y); c.quadraticCurveTo(x, p.y - 2 * fl, x + sd * 0.8, p.y - 3 * fl); c.quadraticCurveTo(x + 1.2, p.y - 1, x + 1.4, p.y); c.closePath(); c.fill();
    }
  }

  // ---- bottom KO: a dirt burst at the bottom edge (8 clods, two leaves, a dust puff), a thud and a caw ----
  function dirtBurst(c, D, gh, s) {
    const t = D.t, y0 = gh + 4;
    if (t < 25) {   // the dust puff: three circles
      const k = t / 25;
      c.fillStyle = `rgba(170,130,100,${(0.6 * (1 - k)).toFixed(3)})`;
      for (const [dx, r] of [[-22, 20], [0, 28], [23, 19]]) { c.beginPath(); c.arc(D.x + dx * s * (1 + k * 0.6), y0 - 10 * s - k * 22 * s, r * s * (0.7 + k * 0.7), 0, TAU); c.fill(); }
    }
    c.lineWidth = 2; c.strokeStyle = OUT;
    for (const q of D.c) {
      const x = D.x + q.vx * t * s, y = y0 + (q.vy * t + 0.15 * t * t) * s;
      if (y > gh + 12) continue;
      if (q.leaf) {
        c.save(); c.translate(x, y); c.rotate(q.rot + t * 0.15); c.fillStyle = C.sprout; c.beginPath(); c.ellipse(0, 0, 7 * s, 3.2 * s, 0, 0, TAU); c.fill(); c.restore();
      } else {
        c.fillStyle = q.lt ? C.soilLight : C.soil; c.beginPath(); c.arc(x, y, q.r * s, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = "rgba(212,192,112,0.55)"; c.beginPath(); c.arc(x - q.r * 0.3 * s, y - q.r * 0.35 * s, q.r * 0.35 * s, 0, TAU); c.fill();   // a lit crumb on top
      }
    }
  }
  function ko(e, live) {
    if (!(e.y > STAGE.blast.bottom - 40)) return;   // only a fall out of the bottom
    const u = Math.min(L.gw, L.gh), x = clamp(toScreen(e.x, e.y)[0], u * 0.06, L.gw - u * 0.06);
    if (K.dirt.length > 3) K.dirt.shift();
    const cl = [];
    for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i / 7 - 0.5) * 1.5 + (Math.random() - 0.5) * 0.2, sp = 5 + Math.random() * 4; cl.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 1.2, r: 4.5 + Math.random() * 4.5, lt: i % 2 }); }
    for (let i = 0; i < 2; i++) cl.push({ leaf: true, vx: (i ? 1 : -1) * (1.5 + Math.random()), vy: -7 - Math.random() * 2, rot: Math.random() * 6 });
    K.dirt.push({ x, t: 0, c: cl });
    if (live && Sfx.ok()) {
      Sfx.noise(0.12, 0.2, 200); Sfx.tone(90, 50, 0.2, "sine", 0.2);
      Sfx.later(200, () => { Sfx.tone(900, 600, 0.09, "sawtooth", 0.04); Sfx.later(120, () => Sfx.tone(880, 580, 0.09, "sawtooth", 0.035)); });
    }
  }

  // ---- once per sim frame: the dirt clocks, the potatoes' Stomp watch, the quiet ambience ----
  const amb = { bed: 0, owl: 0, crk: 0 };
  function crickets(a, t) {   // 4.2 kHz chirps, 20 ms every 110 ms for the next second, swelling on a 4 s sine (about -36 dB at the top)
    const o = a.createOscillator(), g = a.createGain(), sw = 0.5 + 0.5 * Math.sin((t / 4) * TAU), pk = 0.016 * (0.25 + 0.75 * sw);
    o.frequency.value = 4200; g.gain.setValueAtTime(0, t);
    for (let q = 0; q < 1; q += 0.11) { const t0 = t + q; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(pk, t0 + 0.004); g.gain.setValueAtTime(pk, t0 + 0.016); g.gain.linearRampToValueAtTime(0, t0 + 0.02); }
    o.connect(g); g.connect(Sfx.out); o.start(t); o.stop(t + 1.05);
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 1400);
  }
  function drone(a, t) {   // a boss fight: sines at 55 and 82 Hz (about -38 dB), 1.5 s beds re-laid every second with soft fades
    const D = 1.5, g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.5); g.gain.setValueAtTime(1, t + D - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + D);
    g.connect(Sfx.out);
    for (const f of [55, 82]) { const o = a.createOscillator(), og = a.createGain(); o.frequency.value = f; og.gain.value = 0.0126; o.connect(og); og.connect(g); o.start(t); o.stop(t + D + 0.05); }
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, (D + 0.3) * 1000);
  }
  function tick(g, live) {
    if (K.g !== g) { K.g = g; K.dirt.length = 0; K.shut = 0; }
    for (let i = K.dirt.length - 1; i >= 0; i--) if (++K.dirt[i].t >= 44) K.dirt.splice(i, 1);
    if (K.shut > 0) K.shut--;
    for (const f of g.fighters) if (f.spec.boss && f.state === "attack" && f.mid === "stomp" && f.move && f.grounded && f.mt > f.move.startup && f.mt <= f.move.startup + f.move.active) K.shut = 50;
    if (!live || !Sfx.ok()) return;
    const a = Sfx.ctx, t = a.currentTime, boss = g.fighters.some((f) => f.spec.boss);
    if (t >= amb.bed) { amb.bed = t + 1; if (boss) drone(a, t); else crickets(a, t); }
    if (!boss && t >= amb.owl) {
      if (amb.owl) { Sfx.tone(440, 380, 0.25, "sine", 0.02); Sfx.later(380, () => Sfx.tone(440, 380, 0.25, "sine", 0.018)); }
      amb.owl = t + 15 + Math.random() * 10;
    }
    if (boss && t >= amb.crk) { amb.crk = t + 0.5 + Math.random() * 1.1; Sfx.noiseF(0.014, 0.05, "highpass", 2400, 3800, 0.8); }
  }

  return { name: "The Field", bg, stage, tick, ko };
})();
