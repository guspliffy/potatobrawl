/* ---- The Kitchen (map "kitchen"; Fable's design /mnt/project-files/bosses2/fable-design.md section 3): Zorp's arena, also a normal map.
   A diner kitchen seen across the counter at night: teal tiles, wood, steel, a window. bg (screen space, back to front): the tiled wall
   (one cached sprite), the window (a saucer-shaped hole in its top-right pane, three shards on the sill), the clock (2:47, the second
   hand jumps every 60 ticks), the upper cabinets, the shelf with three jars (SALT, VINEGAR, ???), the spice rack, the pendant lamp and
   its warm pool on the wall behind the fight; the back counter (a steel strip) with the fridge at the left edge (a potato magnet, a note
   BUY SALT), the toaster (two slices pop every 20 s) and the fruit bowl, whose potato in a foil cone hat looks up and ducks into the
   bowl for 60 ticks whenever a boss move starts (the joke); under the counter the cabinet fronts and the checker floor (a dropped fork,
   a band of flour). stage (world space): a butcher's block (end grain, a seam, knife scores, a steel band, rubber feet at the ledges);
   the platforms: a stack of plates (left), a frying pan with an egg over the hob coil (right), the pot rack on two chains (top; a ladle
   and a whisk hang from its end hooks only). A boss fight (Zorp on stage): three green mothership lights blink past the hole, the lamp
   flickers, the fridge hum goes up a fifth and wobbles; Nightmare in rage: the tiles go dark and only the lamp, the saucer and the hob
   light the counter. ko: a bottom KO throws a fork, a spoon and a spatula up from the bottom edge with a flour puff, a clang and a
   clatter. Upright: the window centred and wider, the clock on the shelf, the lamp centred, a second checker row and a bucket.
   UI only: reads RG / the game, never writes it. The wall tiles are one sprite per (gw, gh, DPR); glows are sprites; no shadowBlur. */
MAP_ART.kitchen = (() => {
  const TAU = Math.PI * 2;
  const C = {
    tile: "#2e4a52", tileLt: "#3d5e66", grout: "#1c2e34", night: "#0f1a3a", frame: "#d8d2c4", cab: "#8a5a3a", panel: "#a86a44",
    steel: "#9aa3ab", steelLt: "#d8dce6", board: "#c9a06a", boardDk: "#a87a48", lip: "#d9b27a", lipLt: "#ecc98e", plate: "#e3dccb",
    plateRim: "#c23f3a", iron: "#3a3f48", ironTop: "#5a5f68", coil: "#ff6a2b", lamp: "#ffb347", bowl: "#6a3f8f", foil: "#c9ced8",
    floorA: "#2a2d36", floorB: "#3a3d48", green: "#9dff5a", spud: "#d9b27a",
  };
  const K = { tiles: null, tilesKey: "", pool: null, warm: null, hob: null, gr: new WeakMap(), rg: null, boss: null, duck: 0, mvT: -1, flick: 0, nextFlick: 0,
    clatter: [], g: null, hole: null, holeKey: "" };
  const hash = (n) => { const x = Math.sin(n * 91.73 + 17.31) * 43758.5453; return x - Math.floor(x); };
  const STAR8 = [[0.2, 0.25], [0.7, 0.18], [0.35, 0.7], [0.82, 0.62], [0.12, 0.55], [0.55, 0.4], [0.9, 0.3], [0.45, 0.88]];

  // the boss on stage in the game drawn this frame (cached per game): Zorp or any boss
  function bossOf() {
    if (K.rg !== RG) { K.rg = RG; K.boss = RG ? RG.fighters.find((f) => f.spec.boss) || null : null; }
    return K.boss;
  }
  function rageDark() {   // Nightmare, Zorp in rage: the tiles go dark
    const b = bossOf();
    if (!b || !RG || RG.lv !== 2 || b.state === "broken" || b.doomed) return 0;
    return b.hp * 100 <= b.hpMax * b.spec.boss.rageAt[2] ? 1 : 0;
  }
  function sprite(w, h, draw) { const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); draw(cv.getContext("2d"), cv.width, cv.height); return cv; }
  function glowSprite(r, g, b) {
    return sprite(96, 96, (x, S) => {
      const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},0.45)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, S, S);
    });
  }
  function sprites() {
    if (K.pool) return;
    K.pool = glowSprite(255, 180, 70);
    K.hob = glowSprite(255, 120, 50);
    K.warm = glowSprite(255, 200, 140);
  }
  const glow = (c, spr, x, y, rx, ry, a) => { if (a <= 0) return; const ga = c.globalAlpha; c.globalAlpha = ga * Math.min(1, a); c.drawImage(spr, x - rx, y - ry, rx * 2, ry * 2); c.globalAlpha = ga; };
  // the tiled wall: tiles u*0.06 with grout lines, a few lighter tiles; repeats every 4 tiles across (so the parallax offset wraps cleanly)
  function tileSprite(gw, gh, u) {
    const T = u * 0.06, key = gw + "," + gh + "," + DPR;
    if (K.tilesKey === key) return K.tiles;
    K.tilesKey = key;
    const W = gw + T * 4;
    K.tiles = sprite(W * DPR, gh * DPR, (x) => {
      x.scale(DPR, DPR);
      x.fillStyle = C.tile; x.fillRect(0, 0, W, gh);
      const nx = Math.ceil(W / T) + 1, ny = Math.ceil(gh / T) + 1;
      x.fillStyle = C.tileLt;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const h = hash((i % 4) * 13.1 + j * 7.7); if (h < 0.18) x.fillRect(i * T, j * T, T, T); }
      x.fillStyle = "rgba(255,255,255,0.05)";   // a lit top edge on every tile
      for (let j = 0; j < ny; j++) x.fillRect(0, j * T + 1, W, Math.max(1, T * 0.06));
      x.strokeStyle = C.grout; x.lineWidth = Math.max(1, u * 0.004); x.beginPath();
      for (let i = 0; i <= nx; i++) { x.moveTo(i * T, 0); x.lineTo(i * T, gh); }
      for (let j = 0; j <= ny; j++) { x.moveTo(0, j * T); x.lineTo(W, j * T); }
      x.stroke();
    });
    return K.tiles;
  }

  // ---- bg pieces (screen space) ----
  // the window: four panes of night, a saucer-shaped hole in the top-right pane (jagged edges), three shards on the sill
  function windowArt(c, cx, cy, W, H, s, tk, boss) {
    const fw = Math.max(3, 4 * s), x0 = cx - W / 2, y0 = cy - H / 2, mw = Math.max(2, 3 * s);
    // the night
    c.fillStyle = C.night; c.fillRect(x0, y0, W, H);
    c.fillStyle = "rgba(60,80,150,0.25)"; c.fillRect(x0, y0 + H * 0.6, W, H * 0.4);
    c.fillStyle = "rgba(235,240,255,0.85)";
    for (const [a, b] of STAR8) c.fillRect(x0 + a * W, y0 + b * H, Math.max(1, s * 1.2), Math.max(1, s * 1.2));
    // the pane with the hole: px0..px1, py0..py1 (top right)
    const px0 = cx + mw / 2, px1 = x0 + W, py0 = y0, py1 = cy - mw / 2, hx = (px0 + px1) / 2, hy = (py0 + py1) / 2 + (py1 - py0) * 0.04;
    const hr = (px1 - px0) * 0.36, hk = Math.round(hr * 10) + "";
    if (K.holeKey !== hk) {   // the jagged saucer outline (a flat disc, a dome on top), relative to its centre
      K.holeKey = hk;
      const base = [], rd = hr * 0.4;
      for (let i = 0; i <= 4; i++) { const a = Math.PI + (i / 4) * Math.PI * 0.42; base.push([Math.cos(a) * hr, Math.sin(a) * hr * 0.3]); }   // the disc's top left
      for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; base.push([Math.cos(a) * rd, -hr * 0.2 + Math.sin(a) * rd * 0.95]); }   // the dome
      for (let i = 0; i <= 4; i++) { const a = Math.PI * 1.58 + (i / 4) * Math.PI * 0.42; base.push([Math.cos(a) * hr, Math.sin(a) * hr * 0.3]); }   // the disc's top right
      for (let i = 1; i < 8; i++) { const a = (i / 8) * Math.PI; base.push([Math.cos(a) * hr, Math.sin(a) * hr * 0.26]); }   // its underside
      K.hole = base.map(([x, y], i) => { const j = 1 + (hash(i * 3.7) - 0.5) * (i % 2 ? 0.34 : 0.14); return [x * j, y * j + (i % 2 ? hr * 0.04 : 0)]; });
    }
    // the glass: a pale tint and two sheen streaks on each pane, cut round the hole
    c.save();
    c.beginPath(); c.rect(x0, y0, W, H);
    c.moveTo(hx + K.hole[0][0], hy + K.hole[0][1]); for (let i = K.hole.length - 1; i > 0; i--) c.lineTo(hx + K.hole[i][0], hy + K.hole[i][1]); c.closePath();
    c.clip();
    c.fillStyle = "rgba(150,190,220,0.1)"; c.fillRect(x0, y0, W, H);
    c.strokeStyle = "rgba(220,240,255,0.12)"; c.lineWidth = Math.max(2, W * 0.03); c.beginPath();
    for (const [qx, qy] of [[x0, y0], [cx, y0], [x0, cy], [cx, cy]]) { c.moveTo(qx + W * 0.08, qy + H * 0.36); c.lineTo(qx + W * 0.26, qy + H * 0.08); c.moveTo(qx + W * 0.2, qy + H * 0.42); c.lineTo(qx + W * 0.3, qy + H * 0.28); }
    c.stroke();
    // cracks from the hole
    c.strokeStyle = "rgba(220,240,255,0.35)"; c.lineWidth = Math.max(1, s * 0.8); c.beginPath();
    for (const [a, l] of [[0.5, 1.5], [2.2, 1.3], [3.6, 1.6], [5.4, 1.4]]) { c.moveTo(hx + Math.cos(a) * hr * 0.6, hy + Math.sin(a) * hr * 0.3); c.lineTo(hx + Math.cos(a) * hr * l, hy + Math.sin(a) * hr * l * 0.55); }
    c.stroke();
    c.restore();
    // through the hole: the mothership's three green lights blink in a boss fight
    if (boss) {
      for (let i = 0; i < 3; i++) {
        const on = ((tk >> 4) + i) % 3 !== 0, lx = hx + (i - 1) * hr * 0.45, ly = hy - hr * 0.08;
        if (!on) continue;
        c.fillStyle = "rgba(157,255,90,0.35)"; c.beginPath(); c.arc(lx, ly, Math.max(2, 3.4 * s), 0, TAU); c.fill();
        c.fillStyle = C.green; c.beginPath(); c.arc(lx, ly, Math.max(1, 1.4 * s), 0, TAU); c.fill();
      }
    }
    c.lineJoin = "miter";
    c.beginPath(); c.moveTo(hx + K.hole[0][0], hy + K.hole[0][1]); for (let i = 1; i < K.hole.length; i++) c.lineTo(hx + K.hole[i][0], hy + K.hole[i][1]); c.closePath();
    c.strokeStyle = "rgba(220,240,255,0.5)"; c.lineWidth = Math.max(2.4, 3.2 * s); c.stroke();   // the broken glass edge
    c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.3 * s); c.stroke();
    c.lineJoin = "round";
    // the frame, the mullions, the sill and the shards on it
    c.strokeStyle = C.frame; c.lineWidth = fw; c.strokeRect(x0 - fw / 2, y0 - fw / 2, W + fw, H + fw);
    c.fillStyle = C.frame; c.fillRect(cx - mw / 2, y0, mw, H); c.fillRect(x0, cy - mw / 2, W, mw);
    c.strokeStyle = OUT; c.lineWidth = Math.max(1, s); c.strokeRect(x0 - fw, y0 - fw, W + fw * 2, H + fw * 2); c.strokeRect(x0, y0, W, H);
    const sy = y0 + H + fw, sh = Math.max(3, 5 * s);
    c.fillStyle = C.frame; c.fillRect(x0 - fw * 2.5, sy, W + fw * 5, sh); c.strokeRect(x0 - fw * 2.5, sy, W + fw * 5, sh);
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x0 - fw * 2.5, sy + sh, W + fw * 5, sh * 0.6);
    c.fillStyle = "rgba(210,235,255,0.85)"; c.strokeStyle = OUT; c.lineWidth = Math.max(0.8, s * 0.8);
    for (const [dx, w, h, lean] of [[0.62, 7, 5, 1], [0.74, 5, 7, -1], [0.86, 6, 4, 1]]) {
      const bx = x0 + W * dx, bw = w * s, bh = h * s;
      c.beginPath(); c.moveTo(bx - bw / 2, sy); c.lineTo(bx + lean * bw * 0.2, sy - bh); c.lineTo(bx + bw / 2, sy); c.closePath(); c.fill(); c.stroke();
    }
  }
  function clockArt(c, x, y, r, tk, s) {
    c.fillStyle = C.frame; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = OUT; c.lineWidth = Math.max(1.5, 2.2 * s); c.stroke();
    c.fillStyle = "#f4efe2"; c.beginPath(); c.arc(x, y, r * 0.82, 0, TAU); c.fill();
    c.fillStyle = OUT;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, q = i % 3 ? 0.05 : 0.09; c.fillRect(x + Math.cos(a) * r * 0.68 - r * q / 2, y + Math.sin(a) * r * 0.68 - r * q / 2, r * q, r * q); }
    c.strokeStyle = OUT; c.lineCap = "round";
    const hand = (a, l, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); c.stroke(); };
    hand(((2 + 47 / 60) / 12) * TAU, r * 0.42, Math.max(1.5, r * 0.11));   // 2:47
    hand((47 / 60) * TAU, r * 0.62, Math.max(1.2, r * 0.07));
    c.strokeStyle = C.plateRim; hand(((Math.floor(tk / 60) % 60) / 60) * TAU, r * 0.66, Math.max(0.8, r * 0.035));
    c.fillStyle = OUT; c.beginPath(); c.arc(x, y, Math.max(1.2, r * 0.07), 0, TAU); c.fill();
  }
  // a run of cabinet doors from x0 (period dw) between y0 and y1, with OUT handles near hy (0 top, 1 bottom)
  function cabinets(c, x0, dw, y0, y1, gw, hy, s) {
    const h = y1 - y0;
    c.fillStyle = C.cab; c.fillRect(0, y0, gw, h);
    const ins = Math.max(2, dw * 0.08);
    c.fillStyle = C.panel; c.beginPath();
    for (let x = x0; x < gw; x += dw) c.rect(x + ins, y0 + ins, dw - ins * 2, h - ins * 2);
    c.fill();
    c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.4 * s); c.stroke();
    c.fillStyle = "rgba(255,230,190,0.12)"; for (let x = x0; x < gw; x += dw) c.fillRect(x + ins, y0 + ins, dw - ins * 2, Math.max(1, s * 1.5));
    c.beginPath();
    for (let x = x0; x < gw; x += dw) { c.moveTo(x, y0); c.lineTo(x, y1); }
    c.moveTo(0, y0); c.lineTo(gw, y0); c.moveTo(0, y1); c.lineTo(gw, y1);
    c.stroke();
    c.fillStyle = OUT;   // the handles: a short bar beside each door's split
    const hl = Math.max(4, h * 0.18), hw = Math.max(2, 2.4 * s), yy = y0 + h * hy - hl / 2;
    for (let x = x0; x < gw; x += dw) { c.fillRect(x + dw - ins - hw * 2.2, yy, hw, hl); c.fillRect(x + ins + hw * 1.2, yy, hw, hl); }
  }
  function jar(c, x, base, w, h, label, fill, s) {
    c.fillStyle = fill; c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.3 * s);
    c.beginPath(); c.roundRect(x - w / 2, base - h, w, h, w * 0.18); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x - w * 0.36, base - h * 0.88, w * 0.12, h * 0.7);
    c.fillStyle = "#5a5f68"; c.beginPath(); c.roundRect(x - w * 0.45, base - h - h * 0.14, w * 0.9, h * 0.16, 2); c.fill(); c.stroke();
    c.fillStyle = "#efe6cf"; c.fillRect(x - w * 0.42, base - h * 0.62, w * 0.84, h * 0.3);
    const fs = Math.max(5, Math.min(w * 0.26, h * 0.22));
    c.fillStyle = OUT; c.font = `800 ${fs.toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(label, x, base - h * 0.47, w * 0.8);
  }
  function spiceRack(c, x, y, w, s) {
    const h = w * 0.62, sh = Math.max(2, 3 * s);
    c.fillStyle = C.cab; c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.3 * s);
    c.fillRect(x - w / 2, y, w, sh); c.strokeRect(x - w / 2, y, w, sh); c.fillRect(x - w / 2, y + h * 0.5, w, sh); c.strokeRect(x - w / 2, y + h * 0.5, w, sh);
    c.fillRect(x - w / 2 - sh, y - h * 0.5, sh, h * 1.05); c.strokeRect(x - w / 2 - sh, y - h * 0.5, sh, h * 1.05);
    c.fillRect(x + w / 2, y - h * 0.5, sh, h * 1.05); c.strokeRect(x + w / 2, y - h * 0.5, sh, h * 1.05);
    const tops = ["#c23f3a", "#e0a63a", "#5a8a3a", "#7a4a2e", "#d8dce6"], bw = w / 5.6;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const bx = x - w / 2 + bw * 0.9 + i * bw * 1.25, by = (r ? y + h * 0.5 : y), bh = h * 0.4;
      c.fillStyle = "rgba(220,215,200,0.75)"; c.fillRect(bx - bw / 2, by - bh, bw, bh); c.strokeRect(bx - bw / 2, by - bh, bw, bh);
      c.fillStyle = tops[(i + r * 2) % 5]; c.fillRect(bx - bw / 2, by - bh - bh * 0.22, bw, bh * 0.22); c.strokeRect(bx - bw / 2, by - bh - bh * 0.22, bw, bh * 0.22);
    }
  }
  // the pendant lamp, swinging from (x, 0): a cord, a cone shade, the bulb; the warm pool on the wall is drawn by the caller
  function lamp(c, x, cordY, u, s, sw, lit) {
    c.save(); c.translate(x, 0); c.rotate(sw);
    c.strokeStyle = OUT; c.lineWidth = Math.max(1.2, 1.6 * s); c.beginPath(); c.moveTo(0, -4); c.lineTo(0, cordY); c.stroke();
    const tw = u * 0.022, bw = u * 0.05, hh = u * 0.045;
    if (lit > 0) { glow(c, K.pool, 0, cordY + hh + u * 0.005, u * 0.07, u * 0.05, 0.9 * lit); }
    c.fillStyle = "#ffe2b0"; c.globalAlpha = 0.4 + 0.6 * lit; c.beginPath(); c.ellipse(0, cordY + hh, bw * 0.55, u * 0.009, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
    c.fillStyle = "#3a3d48"; c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.4 * s);
    c.beginPath(); c.moveTo(-tw, cordY); c.lineTo(tw, cordY); c.lineTo(bw, cordY + hh); c.lineTo(-bw, cordY + hh); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.14)"; c.beginPath(); c.moveTo(-tw * 0.6, cordY + 1); c.lineTo(-tw * 0.1, cordY + 1); c.lineTo(-bw * 0.45, cordY + hh - 1); c.lineTo(-bw * 0.85, cordY + hh - 1); c.closePath(); c.fill();
    c.restore();
  }
  function fridge(c, x0, top, w, bot, s, tk) {
    c.fillStyle = C.frame; c.strokeStyle = OUT; c.lineWidth = Math.max(1.5, 2 * s);
    c.beginPath(); c.roundRect(x0, top, w, bot - top + 4, [w * 0.12, w * 0.12, 0, 0]); c.fill(); c.stroke();
    c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x0 + w * 0.82, top + 3, w * 0.12, bot - top);
    const split = top + (bot - top) * 0.3;
    c.beginPath(); c.moveTo(x0, split); c.lineTo(x0 + w, split); c.stroke();
    c.fillStyle = "#7f8b93"; c.lineWidth = Math.max(1, 1.2 * s);
    for (const [y, h] of [[split - (split - top) * 0.62, (split - top) * 0.42], [split + (bot - split) * 0.08, (bot - split) * 0.28]]) { c.beginPath(); c.roundRect(x0 + w * 0.8, y, w * 0.07, h, 2); c.fill(); c.stroke(); }
    // the note: BUY SALT
    const nx = x0 + w * 0.18, ny = split + (bot - split) * 0.16, nw = w * 0.42, nh = w * 0.34;
    c.save(); c.translate(nx + nw / 2, ny + nh / 2); c.rotate(-0.08);
    c.fillStyle = "#ffe58a"; c.fillRect(-nw / 2, -nh / 2, nw, nh); c.lineWidth = Math.max(0.8, s * 0.8); c.strokeRect(-nw / 2, -nh / 2, nw, nh);
    c.fillStyle = OUT; c.font = `800 ${Math.max(4, nh * 0.32).toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("BUY", 0, -nh * 0.17, nw * 0.9); c.fillText("SALT", 0, nh * 0.2, nw * 0.9);
    c.fillStyle = C.plateRim; c.beginPath(); c.arc(0, -nh / 2, Math.max(1.2, nw * 0.07), 0, TAU); c.fill();
    c.restore();
    // the potato magnet, with eyes that follow nothing in particular
    const mx = x0 + w * 0.38, my = top + (split - top) * 0.5, mr = w * 0.14, look = Math.sin(tk / 90) * mr * 0.12;
    c.fillStyle = C.spud; c.beginPath(); c.ellipse(mx, my, mr * 1.15, mr, 0.2, 0, TAU); c.fill(); c.lineWidth = Math.max(1, s); c.stroke();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(mx - mr * 0.35, my - mr * 0.15, mr * 0.28, 0, TAU); c.arc(mx + mr * 0.35, my - mr * 0.15, mr * 0.28, 0, TAU); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.arc(mx - mr * 0.35 + look, my - mr * 0.15, mr * 0.13, 0, TAU); c.arc(mx + mr * 0.35 + look, my - mr * 0.15, mr * 0.13, 0, TAU); c.fill();
  }
  function toaster(c, x, base, u, s, tk) {
    const w = u * 0.08, h = u * 0.05, q = tk % 1200, pop = q < 8 ? q / 8 : q < 300 ? 1 : q < 320 ? 1 - (q - 300) / 20 : 0;
    const jump = q < 14 ? Math.sin((q / 14) * Math.PI) * u * 0.035 : 0, out = pop * h * 0.45 + jump;
    c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.4 * s);
    for (const dx of [-0.2, 0.2]) {   // the two slices
      c.fillStyle = "#d9a55a"; c.beginPath(); c.roundRect(x + dx * w - w * 0.14, base - h - out + h * 0.15, w * 0.28, h * 0.6, [w * 0.08, w * 0.08, 0, 0]); c.fill(); c.stroke();
      c.fillStyle = "#a86a3a"; c.fillRect(x + dx * w - w * 0.1, base - h - out + h * 0.18, w * 0.2, h * 0.08);
    }
    c.fillStyle = "#b9c0c8"; c.beginPath(); c.roundRect(x - w / 2, base - h, w, h, [w * 0.2, w * 0.2, w * 0.05, w * 0.05]); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(x - w * 0.38, base - h * 0.85, w * 0.08, h * 0.6);
    c.fillStyle = OUT; c.fillRect(x - w * 0.32, base - h - 1, w * 0.24, Math.max(1.5, 2 * s)); c.fillRect(x + w * 0.08, base - h - 1, w * 0.24, Math.max(1.5, 2 * s));
    c.fillRect(x + w * 0.5, base - h * (pop ? 0.75 : 0.35), w * 0.1, Math.max(1.5, h * 0.12));   // the lever
  }
  // the fruit bowl and the potato in a foil cone hat; d (0..1) how far he has ducked into the bowl
  function bowl(c, x, base, u, s, tk, d) {
    const w = u * 0.11, h = u * 0.04;
    // fruit behind: an apple and a pear
    c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.3 * s);
    c.fillStyle = "#c23f3a"; c.beginPath(); c.arc(x - w * 0.28, base - h * 0.95, w * 0.17, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = "#b8c84a"; c.beginPath(); c.ellipse(x + w * 0.3, base - h * 1.05, w * 0.14, w * 0.19, 0.3, 0, TAU); c.fill(); c.stroke();
    // the potato: rises out of the bowl, looks up; ducks when a boss move starts
    const py = base - h * 0.6 - (1 - d) * u * 0.038, pr = u * 0.026;
    c.save(); c.beginPath(); c.rect(x - w, base - u * 0.3, w * 2, u * 0.3 - h * 0.7); c.clip();
    c.fillStyle = C.spud; c.beginPath(); c.ellipse(x, py, pr * 0.9, pr, 0, 0, TAU); c.fill(); c.stroke();
    const blink = (tk % 260) < 6;
    if (blink) { c.beginPath(); c.moveTo(x - pr * 0.5, py - pr * 0.25); c.lineTo(x - pr * 0.15, py - pr * 0.25); c.moveTo(x + pr * 0.15, py - pr * 0.25); c.lineTo(x + pr * 0.5, py - pr * 0.25); c.stroke(); }
    else {
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x - pr * 0.32, py - pr * 0.22, pr * 0.24, 0, TAU); c.arc(x + pr * 0.32, py - pr * 0.22, pr * 0.24, 0, TAU); c.fill();
      c.fillStyle = OUT; c.beginPath(); c.arc(x - pr * 0.28, py - pr * 0.36, pr * 0.11, 0, TAU); c.arc(x + pr * 0.36, py - pr * 0.36, pr * 0.11, 0, TAU); c.fill();   // looking up
    }
    // the foil cone hat, crinkled
    c.fillStyle = C.foil; c.beginPath(); c.moveTo(x - pr * 0.8, py - pr * 0.62); c.lineTo(x + pr * 0.05, py - pr * 2.3); c.lineTo(x + pr * 0.8, py - pr * 0.6); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = Math.max(0.8, s * 0.8); c.beginPath(); c.moveTo(x - pr * 0.2, py - pr * 0.8); c.lineTo(x - pr * 0.05, py - pr * 1.8); c.stroke();
    c.restore();
    // the bowl in front
    c.fillStyle = C.bowl; c.strokeStyle = OUT; c.lineWidth = Math.max(1.2, 1.6 * s);
    c.beginPath(); c.moveTo(x - w / 2, base - h); c.quadraticCurveTo(x - w * 0.45, base, x - w * 0.18, base); c.lineTo(x + w * 0.18, base); c.quadraticCurveTo(x + w * 0.45, base, x + w / 2, base - h); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x - w * 0.36, base - h * 0.8, w * 0.5, Math.max(1, h * 0.12));
    c.fillStyle = "#8a5aa8"; c.fillRect(x - w / 2, base - h - Math.max(1, s), w, Math.max(2, 2.2 * s));
  }
  function fork(c, x, y, len, a, s) {   // a dropped fork lying on the floor
    c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = OUT; c.fillStyle = C.foil; c.lineWidth = Math.max(0.8, s);
    c.beginPath(); c.roundRect(-len / 2, -len * 0.04, len * 0.62, len * 0.08, len * 0.04); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(len * 0.1, -len * 0.09, len * 0.12, len * 0.18, len * 0.03); c.fill(); c.stroke();
    for (const o of [-0.075, -0.025, 0.025, 0.075]) { c.fillRect(len * 0.21, o * len - len * 0.012, len * 0.28, len * 0.024); }
    c.restore();
  }

  function bg(c, tk) {
    const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), s = u / 390, up = L.portrait, boss = !!bossOf(), dark = rageDark();
    let hz = gh * 0.7 - (cam.y + 110) * cam.z * 0.16;
    if (up && STAGE.main) hz = Math.min(hz, toScreen(0, STAGE.main.top)[1] - u * 0.03);
    const P = (k) => -cam.x * cam.z * k;
    sprites();
    c.lineCap = "butt"; c.lineJoin = "round";
    // 1. the wall (k 0.02): tiles from the top down to the counter
    const T = u * 0.06, per = T * 4, tw = tileSprite(gw, gh, u), off = ((P(0.02) % per) + per) % per, th = clamp(hz + 2, 1, gh);
    c.drawImage(tw, 0, 0, tw.width, Math.min(tw.height, Math.round(th * DPR)), off - per, 0, tw.width / DPR, Math.min(tw.height, Math.round(th * DPR)) / DPR);
    // the window (k 0.03) and the clock
    const ww = up ? u * 0.5 : u * 0.3, wh = up ? u * 0.38 : u * 0.24, wx = gw * (up ? 0.5 : 0.62) + P(0.03), wy = up ? hz * 0.36 : Math.max(hz * 0.44, wh * 0.5 + u * 0.12);
    windowArt(c, wx, wy, ww, wh, s, tk, boss);
    // 2. the cabinets (k 0.06): the upper row along the top, the shelf with three jars, the spice rack
    const ch = Math.max(u * 0.06, hz * 0.15), dw = u * 0.2, cx0 = ((P(0.06) % dw) + dw) % dw - dw;
    cabinets(c, cx0, dw, -2, ch, gw, 0.82, s);
    c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(0, ch, gw, u * 0.018);
    const shY = up ? hz * 0.62 : hz * 0.6, shx0 = gw * (up ? 0.05 : 0.12) + P(0.06), shw = up ? gw * 0.36 : gw * 0.2;
    c.fillStyle = C.cab; c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.4 * s);
    c.fillRect(shx0, shY, shw, Math.max(3, 4 * s)); c.strokeRect(shx0, shY, shw, Math.max(3, 4 * s));
    c.fillStyle = "rgba(0,0,0,0.2)"; c.fillRect(shx0, shY + Math.max(3, 4 * s), shw, u * 0.012);
    for (const bx of [shx0 + shw * 0.1, shx0 + shw * 0.88]) { c.fillStyle = C.cab; c.beginPath(); c.moveTo(bx, shY + 4 * s); c.lineTo(bx + 5 * s, shY + 4 * s); c.lineTo(bx, shY + 12 * s); c.closePath(); c.fill(); c.stroke(); }
    const jw = u * 0.045, jh = u * 0.065, jx = up ? shx0 + shw * 0.52 : shx0 + shw * 0.22;
    jar(c, jx, shY, jw, jh, "SALT", "rgba(235,240,245,0.85)", s);
    jar(c, jx + jw * 1.35, shY, jw * 0.9, jh * 1.15, "VINEGAR", "rgba(200,190,120,0.75)", s);
    jar(c, jx + jw * 2.6, shY, jw, jh * 0.85, "???", "rgba(157,255,90,0.55)", s);
    // the clock: on the wall (wide) or on the shelf (upright)
    const cr = u * 0.05;
    if (up) clockArt(c, shx0 + shw * 0.22, shY - cr * 1.02, cr, tk, s);
    else clockArt(c, gw * 0.3 + P(0.02), Math.max(hz * 0.3, ch + cr * 1.5, u * 0.29), cr, tk, s);   // under the HUD's corners on a phone
    if (!up) spiceRack(c, gw * 0.84 + P(0.06), hz * 0.56, u * 0.1, s);
    // Nightmare rage: the wall goes dark (the lamp's pool still shows)
    if (dark) { c.fillStyle = "rgba(4,6,16,0.62)"; c.fillRect(0, 0, gw, hz + 2); }
    // 3. the pendant lamp (k 0.08): its warm pool on the wall behind the fight; it flickers in a boss fight
    const lx = gw * (up ? 0.5 : 0.4) + P(0.08), sw = Math.sin((tk / 240) * TAU) * 0.04, cordY = Math.max(ch + u * 0.02, hz * (up ? 0.12 : 0.24));
    const lit = K.flick > 0 ? 0.25 : 1, poolX = lx + Math.sin(sw) * hz * 0.5;
    glow(c, K.pool, poolX, hz * 0.62, u * 0.42, u * 0.38, (dark ? 0.32 : 0.2) * lit);
    lamp(c, lx, cordY, u, s, sw, lit);
    // 4. the counter (k 0.3): a steel strip, the toaster, the fruit bowl; the fridge at the left edge
    const cb = hz + u * 0.06;
    c.fillStyle = C.steel; c.fillRect(0, hz, gw, cb - hz);
    c.fillStyle = C.steelLt; c.fillRect(0, hz, gw, Math.max(1.5, u * 0.008));
    c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(0, cb - u * 0.012, gw, u * 0.012);
    c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.4 * s); c.beginPath(); c.moveTo(0, hz); c.lineTo(gw, hz); c.moveTo(0, cb); c.lineTo(gw, cb); c.stroke();
    toaster(c, gw * 0.12 + P(0.3), hz + 1, u, s, tk);
    const d = K.duck > 0 ? (K.duck > 50 ? (60 - K.duck) / 10 : K.duck < 12 ? K.duck / 12 : 1) : 0;
    bowl(c, gw * (up ? 0.86 : 0.9) + P(0.3), hz + 1, u, s, tk, d);
    // 5. below (k 0.5): the cabinet fronts, the checker floor (a dropped fork, a band of flour; upright: a second row and a bucket)
    const cab1 = cb + (up ? u * 0.14 : u * 0.12), dw2 = u * 0.22, cx2 = ((P(0.5) % dw2) + dw2) % dw2 - dw2;
    if (cb < gh) {
      cabinets(c, cx2, dw2, cb, cab1, gw, 0.18, s);
      c.fillStyle = "#1e1a1c"; c.fillRect(0, cab1, gw, u * 0.015);
    }
    const fy = cab1 + u * 0.015;
    if (fy < gh) {
      const sq = u * 0.08, fx0 = ((P(0.5) % (sq * 2)) + sq * 2) % (sq * 2) - sq * 2;
      c.fillStyle = C.floorA; c.fillRect(0, fy, gw, gh - fy);
      c.fillStyle = C.floorB; c.beginPath();
      for (let r = 0; fy + r * sq < gh; r++) for (let x = fx0 + (r % 2) * sq; x < gw; x += sq * 2) c.rect(x, fy + r * sq, sq, sq);
      c.fill();
      c.fillStyle = "rgba(240,235,220,0.16)"; c.beginPath(); c.ellipse(gw * 0.3 + P(0.5), fy + sq * 0.6, u * 0.16, sq * 0.22, -0.04, 0, TAU); c.fill();
      fork(c, gw * 0.66 + P(0.5), fy + sq * 0.55, u * 0.07, 0.35, s);
      if (up) {   // the bucket
        const bx = gw * 0.2 + P(0.5), by = fy + sq * 1.6, bw = u * 0.09;
        c.fillStyle = "#7f8b93"; c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.4 * s);
        c.beginPath(); c.moveTo(bx - bw / 2, by - bw * 0.8); c.lineTo(bx + bw / 2, by - bw * 0.8); c.lineTo(bx + bw * 0.4, by); c.lineTo(bx - bw * 0.4, by); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.arc(bx, by - bw * 0.8, bw * 0.45, Math.PI, TAU); c.stroke();
        c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(bx - bw * 0.36, by - bw * 0.72, bw * 0.08, bw * 0.6);
      }
    }
    // the fridge in front of the counter (k 0.3), at the left edge
    const fw = u * 0.14, fx = -fw * 0.18 + P(0.3) * 0.5;
    fridge(c, fx, hz - u * (up ? 0.3 : 0.34), fw, Math.min(gh, fy + u * 0.03), s, tk);
    if (dark) { c.fillStyle = "rgba(4,6,16,0.45)"; c.fillRect(0, hz, gw, gh - hz); }
    c.lineCap = "butt"; c.lineJoin = "miter";
  }

  // ---- the stage (world space): a butcher's block ----
  function grads(c) {
    let G0 = K.gr.get(c);
    if (!G0) {
      const S = STAGE.main, g = c.createLinearGradient(0, S.top, 0, S.bottom);
      g.addColorStop(0, C.board); g.addColorStop(1, C.boardDk);
      G0 = { block: g };
      K.gr.set(c, G0);
    }
    return G0;
  }
  function stage(c, tk) {
    const S = STAGE.main, x1 = S.x1, x2 = S.x2, w = x2 - x1, top = S.top, bot = S.bottom, dark = rageDark();
    c.lineCap = "round"; c.lineJoin = "round";
    // the block
    c.beginPath(); c.roundRect(x1, top, w, bot - top, [0, 0, 8, 8]);
    c.fillStyle = grads(c).block; c.fill();
    c.save(); c.clip();
    // end grain: staves in two courses (the seam at 32), offset like bricks, a few growth rings
    c.strokeStyle = "rgba(17,16,28,0.25)"; c.lineWidth = 1.5; c.beginPath();
    for (let x = x1 + 36; x < x2; x += 48) { c.moveTo(x, top + 8); c.lineTo(x, top + 32); c.moveTo(x + 24, top + 32); c.lineTo(x + 24, bot - 4); }
    c.stroke();
    c.lineWidth = 1; c.beginPath();
    for (let x = x1 + 12, i = 0; x < x2 - 10; x += 48, i++) {
      const cx = x + hash(i) * 12, cy = top + 20 + hash(i * 2.1) * 6, r = 5 + hash(i * 3.3) * 4;
      c.moveTo(cx + r, cy); c.ellipse(cx, cy, r, r * 0.6, 0, 0, TAU);
      c.moveTo(cx + 24 + r * 0.7 + 14, cy + 24); c.ellipse(cx + 38, cy + 24, r * 0.7, r * 0.45, 0, 0, TAU);
    }
    c.stroke();
    c.fillStyle = "rgba(60,30,10,0.35)"; c.fillRect(x1, top + 31, w, 2.5);   // the seam
    c.fillStyle = "rgba(255,240,200,0.12)"; c.fillRect(x1, top + 33.5, w, 1.5);
    c.strokeStyle = "#8a6a3a"; c.lineWidth = 1.5; c.beginPath();   // five knife scores on the top band
    for (const [x, y, l, a] of [[-250, 14, 22, -0.3], [-120, 20, 16, 0.25], [-30, 12, 26, -0.15], [110, 18, 20, 0.35], [240, 13, 18, -0.4]]) { c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
    c.stroke();
    c.fillStyle = C.steel; c.fillRect(x1, bot - 6, w, 4); c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(x1, bot - 6, w, 1);   // the steel band
    if (dark) { c.fillStyle = "rgba(4,6,16,0.35)"; c.fillRect(x1, top, w, bot - top); }
    c.restore();
    c.beginPath(); c.roundRect(x1, top, w, bot - top, [0, 0, 8, 8]); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    // rubber feet under the corners
    c.fillStyle = "#2a2a2e";
    for (const x of [x1 + 14, x2 - 34]) { c.beginPath(); c.roundRect(x, bot - 1, 20, 7, [0, 0, 3, 3]); c.fill(); c.lineWidth = 1.5; c.stroke(); }
    // the lip: the top band of the board, its highlight, grain gaps every 40, rubber caps at the ledges
    c.beginPath(); c.roundRect(x1 - 4, top - 3, w + 8, 12, 5);
    c.fillStyle = C.lip; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = C.lipLt; c.fillRect(x1, top - 2, w, 3);
    c.strokeStyle = "rgba(17,16,28,0.3)"; c.lineWidth = 1.5; c.beginPath();
    for (let x = x1 + 20; x < x2 - 10; x += 40) { c.moveTo(x, top - 2); c.lineTo(x + 1.5, top + 8); }
    c.stroke();
    c.fillStyle = "#2a2a2e"; c.strokeStyle = OUT; c.lineWidth = 1;
    for (const x of [x1, x2]) { c.beginPath(); c.roundRect(x - 5, top - 4, 10, 4, 1); c.fill(); c.stroke(); }
    // the platforms: plates (left), the pan (right), the pot rack (top)
    const pl = STAGE.plats;
    for (const p of pl) {
      const cx = (p.x1 + p.x2) / 2;
      if (p.y < -200) rack(c, p, tk);
      else if (cx < 0) plates(c, p);
      else pan(c, p, tk);
    }
    c.lineCap = "butt";
    // bottom-KO cutlery: screen space (the bottom edge), drawn here so it flies in front of the floor
    if (K.clatter.length) {
      const z = cam.z, s = Math.min(L.gw, L.gh) / 390;
      c.save(); c.translate(cam.x - (L.gw / 2 + cam.sx) / z, cam.y - (L.gh / 2 + cam.sy) / z); c.scale(1 / z, 1 / z);
      for (const D of K.clatter) clatterArt(c, D, L.gh, s);
      c.restore();
    }
  }
  function plates(c, p) {
    const pw = p.x2 - p.x1, cx = (p.x1 + p.x2) / 2;
    glow(c, K.pool, cx, p.y + 22, pw * 0.5, 12, 0.14 / 0.45 * 0.6);
    c.strokeStyle = OUT; c.lineWidth = 2;
    for (const [dy, ins] of [[18, 10], [12, 5]]) {   // two thinner plates under it
      c.beginPath(); c.roundRect(p.x1 + ins, p.y + dy, pw - ins * 2, 4, 2); c.fillStyle = "#d6cfbd"; c.fill(); c.stroke();
      c.fillStyle = C.plateRim; c.fillRect(p.x1 + ins + 3, p.y + dy + 1, pw - ins * 2 - 6, 1);
    }
    c.beginPath(); c.roundRect(p.x1, p.y - 1, pw, 11, 5);
    c.fillStyle = C.plate; c.fill(); c.lineWidth = 2.5; c.stroke();
    c.fillStyle = "rgba(170,160,140,0.35)"; c.fillRect(p.x1 + 4, p.y + 6, pw - 8, 3);
    c.fillStyle = "#f1ebdc"; c.fillRect(p.x1 + 5, p.y, pw - 10, 2.5);
    c.fillStyle = C.plateRim; c.fillRect(p.x1 + 6, p.y + 3.5, pw - 12, 1.5);
  }
  function pan(c, p, tk) {
    const pw = p.x2 - p.x1, cx = (p.x1 + p.x2) / 2, pulse = 0.65 + 0.15 * Math.sin((tk / 90) * TAU);
    glow(c, K.hob, cx, p.y + 22, pw * 0.5, 14, 0.16 / 0.45 * 0.7 * pulse / 0.65);
    // the hob coil under it, glowing
    c.strokeStyle = `rgba(255,106,43,${pulse.toFixed(3)})`; c.lineWidth = 3;
    c.beginPath(); c.ellipse(cx, p.y + 24, 40, 6, 0, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(cx, p.y + 24, 24, 3.4, 0, 0, TAU); c.stroke();
    c.strokeStyle = "rgba(255,210,150,0.5)"; c.lineWidth = 1; c.beginPath(); c.ellipse(cx, p.y + 23.5, 40, 6, 0, Math.PI, TAU); c.stroke();
    // the handle out past the right end (no collision)
    c.fillStyle = C.iron; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(p.x2 - 4, p.y + 1, 44, 6, 3); c.fill(); c.stroke();
    c.fillStyle = OUT; c.beginPath(); c.arc(p.x2 + 32, p.y + 4, 1.6, 0, TAU); c.fill();
    // the pan: iron, its top line, sloped sides
    c.beginPath(); c.moveTo(p.x1, p.y - 1); c.lineTo(p.x2, p.y - 1); c.lineTo(p.x2 - 5, p.y + 10); c.lineTo(p.x1 + 5, p.y + 10); c.closePath();
    c.fillStyle = C.iron; c.fill(); c.lineWidth = 2.5; c.stroke();
    c.fillStyle = C.ironTop; c.fillRect(p.x1 + 3, p.y, pw - 6, 2.5);
    c.fillStyle = "rgba(255,255,255,0.1)"; c.fillRect(p.x1 + 8, p.y + 5, pw - 16, 1.5);
    // a fried egg at its left end: 20 x 12 seen edge-on, 3 tall
    const ex = p.x1 + 18;
    c.fillStyle = "#f1ebdc"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(ex, p.y - 1, 11, 2.4, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = C.lamp; c.beginPath(); c.ellipse(ex + 1, p.y - 2.2, 3.6, 2.6, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#fff6d8"; c.fillRect(ex - 0.5, p.y - 3.8, 1.5, 1);
  }
  function rack(c, p, tk) {
    const pw = p.x2 - p.x1, cx = (p.x1 + p.x2) / 2;
    glow(c, K.warm, cx, p.y + 18, pw * 0.5, 12, 0.1 / 0.45 * 0.8);
    // two dashed chains up out of frame
    c.lineCap = "butt";
    for (const x of [p.x1 + 14, p.x2 - 14]) {
      c.setLineDash([7, 4]); c.strokeStyle = OUT; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x, p.y - 1); c.lineTo(x, p.y - 900); c.stroke();
      c.strokeStyle = "#9aa3ab"; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
    }
    c.lineCap = "round";
    // a ladle (left end hook) and a whisk (right end hook), behind the bar, swinging a little
    const sw = Math.sin((tk / 150) * TAU) * 0.05;
    c.save(); c.translate(p.x1 + 6, p.y + 6); c.rotate(sw);
    c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 24); c.stroke();
    c.strokeStyle = "#c9ced8"; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(0, 30, 7, 0, Math.PI); c.closePath(); c.fillStyle = "#c9ced8"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    c.restore();
    c.save(); c.translate(p.x2 - 6, p.y + 6); c.rotate(-sw);
    c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 10); c.stroke(); c.strokeStyle = "#7f8b93"; c.lineWidth = 2.4; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath();
    for (const k of [-1, -0.4, 0.4, 1]) { c.moveTo(0, 10); c.bezierCurveTo(k * 7, 14, k * 7, 26, 0, 30); }
    c.stroke(); c.strokeStyle = "#c9ced8"; c.lineWidth = 1.1; c.stroke();
    c.restore();
    // the bar: steel, its top line, the hooks' rings
    c.beginPath(); c.roundRect(p.x1, p.y - 1, pw, 9, 4);
    c.fillStyle = "#7a7f88"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "#c9ced8"; c.fillRect(p.x1 + 4, p.y, pw - 8, 2.5);
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(p.x1 + 4, p.y + 5, pw - 8, 2);
  }

  // ---- bottom KO: a fork, a spoon and a spatula fly up from the bottom edge, a flour puff, a clang and a clatter ----
  function utensil(c, k, len, s) {
    c.fillStyle = C.foil; c.strokeStyle = OUT; c.lineWidth = Math.max(1, 1.4 * s);
    c.beginPath(); c.roundRect(-len * 0.5, -len * 0.045, len * 0.6, len * 0.09, len * 0.045); c.fill(); c.stroke();
    if (k === 0) {   // fork
      c.beginPath(); c.roundRect(len * 0.08, -len * 0.11, len * 0.12, len * 0.22, len * 0.04); c.fill(); c.stroke();
      c.beginPath(); for (const o of [-0.09, -0.03, 0.03, 0.09]) c.rect(len * 0.18, o * len - len * 0.014, len * 0.32, len * 0.028); c.fill(); c.stroke();
    } else if (k === 1) {   // spoon
      c.beginPath(); c.ellipse(len * 0.3, 0, len * 0.2, len * 0.12, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = "rgba(255,255,255,0.5)"; c.beginPath(); c.ellipse(len * 0.26, -len * 0.04, len * 0.08, len * 0.03, 0, 0, TAU); c.fill();
    } else {   // spatula
      c.beginPath(); c.roundRect(len * 0.08, -len * 0.14, len * 0.38, len * 0.28, len * 0.04); c.fill(); c.stroke();
      c.strokeStyle = "rgba(17,16,28,0.5)"; c.beginPath(); for (const o of [-0.06, 0, 0.06]) { c.moveTo(len * 0.16, o * len); c.lineTo(len * 0.4, o * len); } c.stroke();
    }
  }
  function clatterArt(c, D, gh, s) {
    const t = D.t, y0 = gh + 4;
    if (t < 25) {   // the flour puff
      const k = t / 25;
      c.fillStyle = `rgba(240,235,220,${(0.5 * (1 - k)).toFixed(3)})`;
      for (const [dx, r] of [[-24, 20], [0, 30], [25, 21]]) { c.beginPath(); c.arc(D.x + dx * s * (1 + k * 0.7), y0 - 12 * s - k * 26 * s, r * s * (0.7 + k * 0.8), 0, TAU); c.fill(); }
    }
    for (const q of D.c) {
      const x = D.x + q.vx * t * s, y = y0 + (q.vy * t + 0.15 * t * t) * s;
      if (y > gh + 40 * s) continue;
      c.save(); c.translate(x, y); c.rotate(q.rot + q.vr * t); utensil(c, q.k, 46 * s, s); c.restore();
    }
  }
  function ko(e, live) {
    if (!(e.y > STAGE.blast.bottom - 40)) return;   // only a fall out of the bottom
    const u = Math.min(L.gw, L.gh), x = clamp(toScreen(e.x, e.y)[0], u * 0.08, L.gw - u * 0.08);
    if (K.clatter.length > 3) K.clatter.shift();
    const cl = [];
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.42 + (Math.random() - 0.5) * 0.15, sp = 7.5 + Math.random() * 2; cl.push({ k: i, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 1.15, rot: Math.random() * TAU, vr: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.2) }); }
    K.clatter.push({ x, t: 0, c: cl });
    if (live && Sfx.ok()) {
      Sfx.tone(1400, 900, 0.2, "sine", 0.2); Sfx.tone(2100, 1500, 0.12, "triangle", 0.04);
      for (let i = 0; i < 4; i++) Sfx.later(90 + i * 70 + Math.random() * 30, () => Sfx.noise(0.03, 0.12, 2000));
    }
  }

  // ---- once per sim frame: the cutlery clocks, the bowl potato's duck, the lamp flicker, the quiet ambience ----
  const amb = { bed: 0, drip: 0, tick: -1 };
  function hum(a, t, boss) {   // the fridge: sines at 50 + 100 Hz (75 + 150 and wobbling in a boss fight), swelling 0.6 <-> 1 over 9 s, ~-36 dB
    const D = 1.5, g = a.createGain(), sw = 0.8 + 0.2 * Math.sin((t / 9) * TAU);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(sw, t + 0.5); g.gain.setValueAtTime(sw, t + D - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + D);
    g.connect(Sfx.out);
    for (const f0 of boss ? [75, 150] : [50, 100]) {
      const o = a.createOscillator(), og = a.createGain();
      o.frequency.setValueAtTime(f0, t);
      if (boss) { o.frequency.linearRampToValueAtTime(f0 * 1.03, t + D * 0.5); o.frequency.linearRampToValueAtTime(f0, t + D); }
      og.gain.value = f0 < 70 || (boss && f0 < 100) ? 0.016 : 0.009; o.connect(og); og.connect(g); o.start(t); o.stop(t + D + 0.05);
    }
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, (D + 0.3) * 1000);
  }
  function tick(g, live) {
    if (K.g !== g) { K.g = g; K.clatter.length = 0; K.duck = 0; K.mvT = -1; K.flick = 0; K.nextFlick = 0; }
    for (let i = K.clatter.length - 1; i >= 0; i--) if (++K.clatter[i].t >= 40) K.clatter.splice(i, 1);
    if (K.duck > 0) K.duck--;
    const b = g.fighters.find((f) => f.spec.boss);
    if (b) {
      if (b.state === "attack" && b.moveT !== K.mvT) { K.mvT = b.moveT; K.duck = 60; }
      // the lamp flickers 3 ticks every 2-4 s
      if (K.flick > 0) K.flick--;
      if (g.t >= K.nextFlick) { if (K.nextFlick) K.flick = 3; K.nextFlick = g.t + 120 + Math.floor(Math.random() * 120); }
    }
    if (!live || !Sfx.ok()) return;
    const a = Sfx.ctx, t = a.currentTime;
    if (t >= amb.bed) { amb.bed = t + 1; hum(a, t, !!b); }
    if (t >= amb.drip) { if (amb.drip) Sfx.tone(1100, 700, 0.06, "sine", 0.02); amb.drip = t + 3 + Math.random() * 2; }
    if (g.t % 60 === 0) Sfx.noiseF(0.008, 0.016, "highpass", 4000, 4200, 0.8);   // the clock
  }

  return { name: "The Kitchen", bg, stage, tick, ko };
})();
