/* ===================== The Road, region 2: The Kitchen's map (UI only) =====================
   RD_ART.kitchen (the registry and roadPaint are in road.js): bg(c, w, h, r, k) the still part (road.js caches it per size and progress),
   peek(c, x, y, u, tk) Zorp's glimpse through the window over the boss stop, ink: the stop discs drawn as plates. Fable's design
   (/mnt/project-files/bosses2/fable-design.md section 5): a diner kitchen floor from a low angle; the path is a trail of spilled salt
   across the checker tiles from the swinging back door (bottom left, a porthole) to the night window (top right) with the saucer hole in
   its top pane; eight plates; a cleared stop gets a crossed fork and knife (under its plate); the counter runs along the top with the
   fridge (its light spilling) at the left and two pendants; the gate is the window's latch (closed until 12 stars, then flipped up and the
   lower sash raised). The window sits on the counter right behind the boss stop, so bg and peek find it from that stop alone (rkGeo). */
const RDK = {
  tile: "#2e4a52", tileLt: "#3d5e66", grout: "#1c2e34", cab: "#8a5a3a", panel: "#a86a44", steel: "#9aa3ab", steelLt: "#d8dce6",
  frame: "#d8d2c4", frameDk: "#a9a291", floorA: "#4a4f5c", floorB: "#2c303b", salt: "#f4f1e8", fridge: "#e6e1d6", brass: "#d9b23a",
  green: "#9dff5a", tin: "#c9ced8",
};
const RDK_TAU = Math.PI * 2;
const rkHash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };   // a stable scatter (UI only)
// the window on the counter behind the boss stop (bx, by): its sill is the counter's top
function rkGeo(bx, by, u) {
  const cTop = by + u * 0.035, ww = u * 0.32, wh = Math.max(u * 0.08, Math.min(u * 0.24, cTop - u * 0.03));
  return { cTop, ww, wh, wx: bx, wy: cTop - wh, fr: Math.max(2, u * 0.014) };
}
// points along road.js's path (the same Catmull-Rom Béziers as rdPath), n per segment
function rkAlong(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let q = 0; q < n; q++) {
      const t = q / n, a = (1 - t) * (1 - t) * (1 - t), b = 3 * (1 - t) * (1 - t) * t, d = 3 * (1 - t) * t * t, e = t * t * t;
      const x = a * p1[0] + b * c1[0] + d * c2[0] + e * p2[0], y = a * p1[1] + b * c1[1] + d * c2[1] + e * p2[1];
      const tx = 3 * (1 - t) * (1 - t) * (c1[0] - p1[0]) + 6 * (1 - t) * t * (c2[0] - c1[0]) + 3 * t * t * (p2[0] - c2[0]);
      const ty = 3 * (1 - t) * (1 - t) * (c1[1] - p1[1]) + 6 * (1 - t) * t * (c2[1] - c1[1]) + 3 * t * t * (p2[1] - c2[1]);
      const l = Math.hypot(tx, ty) || 1;
      out.push([x, y, -ty / l, tx / l]);
    }
  }
  return out;
}

function rkBg(c, w, h, r, k) {
  const { gate, pts, tall } = rdPoints(w, h), u = Math.min(w, h), lw = Math.max(1, u * 0.005), [bx, by] = pts[pts.length - 1];
  const G = rkGeo(bx, by, u), cTop = G.cTop, hz = Math.max(h * (tall ? 0.2 : 0.3), cTop + u * 0.07), open = roadGateOpen(r, k);
  c.lineCap = "round"; c.lineJoin = "round";
  // the wall: tiles down to the counter, darker at the top
  const T = u * 0.055;
  c.fillStyle = RDK.grout; c.fillRect(0, 0, w, cTop + 2);
  for (let y = 0, j = 0; y < cTop + 2; y += T, j++) for (let x = 0, i = 0; x < w; x += T, i++) {
    c.fillStyle = (i + j * 3) % 7 === 0 ? RDK.tileLt : RDK.tile; c.fillRect(x + 1, y + 1, T - 2, T - 2);
  }
  const wg = c.createLinearGradient(0, 0, 0, cTop); wg.addColorStop(0, "rgba(6,10,20,0.55)"); wg.addColorStop(1, "rgba(6,10,20,0.05)");
  c.fillStyle = wg; c.fillRect(0, 0, w, cTop + 2);
  // the floor: a checker in perspective from the kick plate down
  rkFloor(c, w, h, hz, u);
  // the pendants' pools on the floor
  // two pendants between the fridge and the window
  const lb = u * (tall ? 0.2 : 0.17) * 1.22 + u * 0.06, rb = G.wx - G.ww / 2 - u * 0.05, pend = [lb + (rb - lb) * 0.28, lb + (rb - lb) * 0.76];
  for (const fx of pend) {
    const x = fx, y = hz + (h - hz) * 0.42, rx = w * (tall ? 0.3 : 0.17), ry = (h - hz) * 0.3;
    const pg = c.createRadialGradient(x, y, 0, x, y, rx); pg.addColorStop(0, "rgba(255,196,120,0.2)"); pg.addColorStop(1, "rgba(255,196,120,0)");
    c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = pg; c.beginPath(); c.arc(x, y, rx, 0, RDK_TAU); c.fill(); c.restore();
  }
  // the counter: steel top on the window's sill line, cabinet doors, the kick plate
  rkCounter(c, w, cTop, hz, u, lw, tall);
  // the window over the boss stop (the latch is the gate)
  rkWindow(c, G, u, lw, open);
  // the pendants: cords, shades, warm bulbs (drawn over the wall, above the counter)
  for (const fx of pend) rkPendant(c, fx, Math.max(u * 0.05, cTop * 0.42), u, lw);
  // the fridge at the left: the door ajar, its light spilling on the floor
  rkFridge(c, u, cTop, hz, lw, tall);
  // the salt trail: from the back door through the plates to the window
  const all = [gate, ...pts];
  rdPath(c, all); c.strokeStyle = "rgba(10,12,20,0.22)"; c.lineWidth = u * 0.07; c.stroke();
  rdPath(c, all); c.strokeStyle = "rgba(240,236,226,0.22)"; c.lineWidth = u * 0.05; c.stroke();
  rdPath(c, all); c.strokeStyle = "rgba(250,248,240,0.36)"; c.lineWidth = u * 0.02; c.stroke();
  const S = rkAlong(all, tall ? 26 : 34);
  c.fillStyle = RDK.salt;
  S.forEach(([x, y, nx, ny], i) => {
    for (let q = 0; q < 2; q++) {
      const o = (rkHash(i * 3 + q) - 0.5) * u * 0.06, rr = u * (0.0022 + 0.003 * rkHash(i * 7 + q + 0.5));
      c.globalAlpha = 0.4 + 0.5 * rkHash(i + q * 13); c.beginPath(); c.arc(x + nx * o, y + ny * o, rr, 0, RDK_TAU); c.fill();
    }
  });
  c.globalAlpha = 1;
  // won stops: a crossed fork and knife under the plate (roadPaint lays the plate over the middle)
  const R = clamp(u * 0.052, 7, 30);
  pts.forEach(([x, y], j) => { if (j < ROAD_N && (roadBits(r, k * ROAD_N + j) & 1)) rkCutlery(c, x, y, R, lw); });
  // the back door at the start: swung open toward you, its porthole lit; a salt shaker on its side by it, still pouring
  rkDoor(c, gate, u, lw);
  // the edges in shadow
  const vg = c.createRadialGradient(w * 0.5, h * 0.55, u * 0.3, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(4,6,14,0.45)");
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
}

function rkFloor(c, w, h, hz, u) {
  const vx = w * 0.5, vy = hz - (h - hz) * 1.4, N = 9, cell = u * 0.11;
  const ys = []; for (let i = 0; i <= N; i++) ys.push(hz + (h - hz) * Math.pow(i / N, 1.45));
  const xAt = (xb, y) => vx + (xb - vx) * (y - vy) / (h - vy);   // a floor line through xb at the bottom, toward the vanishing point
  const cols = Math.ceil((w * 2.4) / cell);
  c.fillStyle = RDK.floorB; c.fillRect(0, hz, w, h - hz);
  c.fillStyle = RDK.floorA;
  for (let i = 0; i < N; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    c.beginPath();
    for (let j = -cols; j < cols; j++) {
      if ((i + j) & 1) continue;
      const xa = vx + j * cell, xb = xa + cell;
      c.moveTo(xAt(xa, y0), y0); c.lineTo(xAt(xb, y0), y0); c.lineTo(xAt(xb, y1), y1); c.lineTo(xAt(xa, y1), y1); c.closePath();
    }
    c.fill();
  }
  // far tiles darker, a sheen near the front
  const fg = c.createLinearGradient(0, hz, 0, h); fg.addColorStop(0, "rgba(8,10,20,0.55)"); fg.addColorStop(0.45, "rgba(8,10,20,0.12)"); fg.addColorStop(1, "rgba(8,10,20,0.25)");
  c.fillStyle = fg; c.fillRect(0, hz, w, h - hz);
}

function rkCounter(c, w, cTop, hz, u, lw, tall) {
  const lip = Math.max(3, u * 0.018), dw = u * 0.16;
  // the cabinets
  c.fillStyle = RDK.cab; c.fillRect(0, cTop + lip, w, hz - cTop - lip);
  const kick = Math.max(2, u * 0.012), dt = cTop + lip + u * 0.008, db = hz - kick - u * 0.006;
  c.strokeStyle = "#11101c"; c.lineWidth = lw;
  for (let x = u * 0.01; x < w; x += dw) {
    if (db - dt > 4) {
      c.fillStyle = RDK.panel; c.beginPath(); c.rect(x + u * 0.008, dt, dw - u * 0.016, db - dt); c.fill(); c.stroke();
      c.fillStyle = "rgba(255,230,190,0.18)"; c.fillRect(x + u * 0.014, dt + 1, dw - u * 0.028, Math.max(1, (db - dt) * 0.12));
      c.fillStyle = RDK.steelLt; c.beginPath(); c.rect(x + dw * 0.44, dt + (db - dt) * 0.18, dw * 0.12, Math.max(2, u * 0.008)); c.fill(); c.stroke();
    }
  }
  c.fillStyle = "#1a1418"; c.fillRect(0, hz - kick, w, kick + 1);
  // the steel top, its highlight, the shadow it throws on the cabinets
  c.fillStyle = RDK.steel; c.beginPath(); c.rect(-2, cTop, w + 4, lip); c.fill(); c.stroke();
  c.fillStyle = RDK.steelLt; c.fillRect(0, cTop + 1, w, Math.max(1, lip * 0.3));
  c.fillStyle = "rgba(0,0,0,0.28)"; c.fillRect(0, cTop + lip, w, Math.max(1, u * 0.01));
  // a toaster and a jar of salt on it (wide maps)
  if (!tall) {
    const tx = w * 0.47, tw_ = u * 0.07, th = u * 0.045;
    c.fillStyle = RDK.tin; c.beginPath(); c.roundRect(tx - tw_ / 2, cTop - th, tw_, th, u * 0.01); c.fill(); c.stroke();
    c.fillStyle = "#3a3f48"; for (const s of [-1, 1]) c.fillRect(tx + s * tw_ * 0.2 - tw_ * 0.12, cTop - th - 1, tw_ * 0.24, Math.max(1.5, u * 0.006));
    c.fillStyle = "rgba(255,255,255,0.45)"; c.fillRect(tx - tw_ * 0.4, cTop - th * 0.8, tw_ * 0.08, th * 0.6);
    const jx = w * 0.62, jw = u * 0.032, jh = u * 0.05;
    c.fillStyle = "rgba(235,240,245,0.85)"; c.beginPath(); c.roundRect(jx - jw / 2, cTop - jh, jw, jh, u * 0.006); c.fill(); c.stroke();
    c.fillStyle = RDK.steel; c.beginPath(); c.rect(jx - jw / 2 - 1, cTop - jh - u * 0.012, jw + 2, u * 0.012); c.fill(); c.stroke();
  }
}

function rkWindow(c, G, u, lw, open) {
  const { wx, wy, ww, wh, cTop, fr } = G, x0 = wx - ww / 2, x1 = wx + ww / 2, mid = wy + wh * 0.5;
  // the night through the glass, a few stars
  const sk = c.createLinearGradient(0, wy, 0, cTop); sk.addColorStop(0, "#0a1230"); sk.addColorStop(1, "#1f2e60");
  c.fillStyle = sk; c.fillRect(x0, wy, ww, wh);
  c.fillStyle = "rgba(230,240,255,0.8)";
  for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(x0 + fr + rkHash(i) * (ww - 2 * fr), wy + fr + rkHash(i + 40) * (wh - 2 * fr), u * (0.002 + 0.002 * rkHash(i + 9)), 0, RDK_TAU); c.fill(); }
  // the hole in the top pane: the saucer's outline, broken through
  const hx = wx + ww * 0.12, hy = wy + wh * 0.27, hr = Math.min(ww * 0.18, wh * 0.2), hole = new Path2D();
  const HP = [[-1, 0.15], [-0.95, -0.12], [-0.6, -0.22], [-0.45, -0.3], [-0.38, -0.62], [-0.15, -0.8], [0.12, -0.78], [0.36, -0.58], [0.42, -0.3], [0.62, -0.24], [0.96, -0.1], [1, 0.16], [0.7, 0.3], [0.3, 0.36], [-0.2, 0.34], [-0.7, 0.3]];
  HP.forEach(([px_, py_], i) => { const j = 1 + (rkHash(i + 70) - 0.5) * 0.25, X = hx + px_ * hr * j, Y = hy + py_ * hr * j; if (i) hole.lineTo(X, Y); else hole.moveTo(X, Y); });
  hole.closePath();
  // the glass: a cool tint and a sheen (the lower pane's only while the window is shut), the hole cut out
  const glass = new Path2D(); glass.rect(x0, wy, ww, wh * 0.5); if (!open) glass.rect(x0, mid, ww, wh * 0.5); glass.addPath(hole);
  c.fillStyle = "rgba(160,200,255,0.12)"; c.fill(glass, "evenodd");
  c.save(); c.clip(glass, "evenodd");
  c.strokeStyle = "rgba(230,240,255,0.22)"; c.lineWidth = Math.max(2, u * 0.012);
  for (const q of [0.15, 0.32]) { c.beginPath(); c.moveTo(x0 + ww * q, cTop); c.lineTo(x0 + ww * (q + 0.3), wy); c.stroke(); }
  c.restore();
  c.strokeStyle = "rgba(220,240,255,0.65)"; c.lineWidth = Math.max(1, lw * 1.4); c.stroke(hole);
  c.strokeStyle = "#11101c"; c.lineWidth = lw; c.stroke(hole);
  c.strokeStyle = "rgba(220,240,255,0.45)"; c.lineWidth = Math.max(0.8, lw * 0.7);
  for (const [a, l] of [[-2.6, 1.7], [-0.4, 1.6], [0.5, 1.9], [2.7, 1.5]]) { c.beginPath(); c.moveTo(hx + Math.cos(a) * hr, hy + Math.sin(a) * hr * 0.5); c.lineTo(hx + Math.cos(a) * hr * l, hy + Math.sin(a) * hr * 0.5 * l); c.stroke(); }
  // the frame: the outer frame, the mullion, the meeting rail (raised with the lower sash when open)
  c.strokeStyle = "#11101c"; c.lineWidth = lw; c.fillStyle = RDK.frame;
  const bar = (x, y, bw, bh) => { c.beginPath(); c.rect(x, y, bw, bh); c.fill(); c.stroke(); };
  bar(x0 - fr, wy - fr, ww + 2 * fr, fr); bar(x0 - fr, wy, fr, wh); bar(x1, wy, fr, wh);
  bar(wx - fr * 0.4, wy, fr * 0.8, wh * 0.5);
  if (!open) { bar(wx - fr * 0.4, mid, fr * 0.8, wh * 0.5); bar(x0, mid - fr * 0.5, ww, fr); }
  else {   // the lower sash raised in front of the top pane: its bottom rail high up, the opening below it
    bar(x0, mid - wh * 0.08, ww, fr * 1.2); bar(x0, wy + wh * 0.06, ww, fr * 0.6);
  }
  // the sill: a ledge on the counter
  c.fillStyle = RDK.frameDk; bar(x0 - fr * 2, cTop - fr * 0.7, ww + fr * 4, fr * 0.9);
  // the latch on the meeting rail: shut (lever across, a little padlock) or flipped up
  const ly = open ? mid - wh * 0.08 : mid - fr * 0.5, lx = wx - ww * 0.3;   // left of the boss stop's "12 ★"
  c.fillStyle = RDK.brass; bar(lx - u * 0.016, ly - u * 0.006, u * 0.032, u * 0.012 + fr * 0.4);
  c.lineWidth = Math.max(1.5, u * 0.008); c.strokeStyle = "#11101c";
  c.beginPath(); c.moveTo(lx, ly); c.lineTo(open ? lx - u * 0.006 : lx + u * 0.03, open ? ly - u * 0.03 : ly); c.stroke();
  c.lineWidth = Math.max(1, u * 0.004); c.strokeStyle = RDK.brass; c.stroke();
  if (!open) {
    c.fillStyle = RDK.brass; c.strokeStyle = "#11101c"; c.lineWidth = lw;
    c.beginPath(); c.arc(lx + u * 0.03, ly + u * 0.012, u * 0.007, Math.PI, 0); c.stroke();
    c.beginPath(); c.roundRect(lx + u * 0.021, ly + u * 0.012, u * 0.018, u * 0.016, u * 0.003); c.fill(); c.stroke();
  }
}

function rkPendant(c, x, y, u, lw) {
  const sw = u * 0.06, sh = u * 0.032;
  c.strokeStyle = "#11101c"; c.lineWidth = Math.max(1, lw * 0.8); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - sh); c.stroke();
  const gl = c.createRadialGradient(x, y + sh * 0.2, 0, x, y + sh * 0.2, u * 0.12); gl.addColorStop(0, "rgba(255,200,120,0.45)"); gl.addColorStop(1, "rgba(255,200,120,0)");
  c.fillStyle = gl; c.fillRect(x - u * 0.12, y - u * 0.1, u * 0.24, u * 0.24);
  c.fillStyle = "#3a3f48"; c.beginPath(); c.moveTo(x - sw * 0.18, y - sh); c.lineTo(x + sw * 0.18, y - sh); c.lineTo(x + sw * 0.5, y); c.lineTo(x - sw * 0.5, y); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#5a5f68"; c.fillRect(x - sw * 0.3, y - sh * 0.62, sw * 0.12, sh * 0.45);
  c.fillStyle = "#ffd9a0"; c.beginPath(); c.ellipse(x, y + 1, sw * 0.2, sh * 0.25, 0, 0, Math.PI); c.fill(); c.stroke();
}

function rkFridge(c, u, cTop, hz, lw, tall) {
  const x0 = u * 0.02, fw = u * (tall ? 0.2 : 0.17), y0 = Math.max(u * 0.03, cTop - u * 0.22), y1 = hz + u * 0.02, rr = u * 0.02;
  // its light on the floor, out of the door ajar
  const lg = c.createLinearGradient(0, y1, 0, y1 + u * 0.3); lg.addColorStop(0, "rgba(255,244,214,0.28)"); lg.addColorStop(1, "rgba(255,244,214,0)");
  c.fillStyle = lg; c.beginPath(); c.moveTo(x0 + fw * 0.7, y1); c.lineTo(x0 + fw * 1.05, y1); c.lineTo(x0 + fw * 1.9, y1 + u * 0.3); c.lineTo(x0 + fw * 0.6, y1 + u * 0.3); c.closePath(); c.fill();
  c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.ellipse(x0 + fw * 0.5, y1, fw * 0.6, u * 0.012, 0, 0, RDK_TAU); c.fill();
  // the body
  c.strokeStyle = "#11101c"; c.lineWidth = lw * 1.2;
  c.fillStyle = RDK.fridge; c.beginPath(); c.roundRect(x0, y0, fw, y1 - y0, [rr, rr, rr * 0.4, rr * 0.4]); c.fill(); c.stroke();
  c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x0 + fw * 0.82, y0 + rr, fw * 0.14, y1 - y0 - rr * 1.5);
  const sp = y0 + (y1 - y0) * 0.32;
  c.beginPath(); c.moveTo(x0, sp); c.lineTo(x0 + fw, sp); c.stroke();
  c.fillStyle = "#a9a291"; for (const [a, b] of [[y0 + (sp - y0) * 0.3, y0 + (sp - y0) * 0.75], [sp + (y1 - sp) * 0.1, sp + (y1 - sp) * 0.45]]) { c.beginPath(); c.roundRect(x0 + fw * 0.08, a, fw * 0.06, b - a, fw * 0.03); c.fill(); c.stroke(); }
  // the door ajar on the right: its lit edge, the light inside
  c.fillStyle = "#fff4d6"; c.beginPath(); c.moveTo(x0 + fw, sp + u * 0.008); c.lineTo(x0 + fw + fw * 0.12, sp - u * 0.004); c.lineTo(x0 + fw + fw * 0.12, y1 + u * 0.004); c.lineTo(x0 + fw, y1 - u * 0.006); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#d8d2c4"; c.beginPath(); c.moveTo(x0 + fw + fw * 0.12, sp - u * 0.004); c.lineTo(x0 + fw + fw * 0.22, sp + u * 0.01); c.lineTo(x0 + fw + fw * 0.22, y1 - u * 0.01); c.lineTo(x0 + fw + fw * 0.12, y1 + u * 0.004); c.closePath(); c.fill(); c.stroke();
  // a potato magnet and the note
  c.fillStyle = "#d9b27a"; c.beginPath(); c.ellipse(x0 + fw * 0.55, y0 + (sp - y0) * 0.45, fw * 0.11, fw * 0.13, 0.2, 0, RDK_TAU); c.fill(); c.stroke();
  c.fillStyle = "#11101c"; for (const s of [-1, 1]) { c.beginPath(); c.arc(x0 + fw * 0.55 + s * fw * 0.04, y0 + (sp - y0) * 0.42, Math.max(0.8, fw * 0.015), 0, RDK_TAU); c.fill(); }
  c.save(); c.translate(x0 + fw * 0.5, sp + (y1 - sp) * 0.3); c.rotate(-0.08);
  c.fillStyle = "#ffe066"; c.beginPath(); c.rect(-fw * 0.2, -fw * 0.16, fw * 0.4, fw * 0.32); c.fill(); c.lineWidth = Math.max(0.8, lw * 0.7); c.stroke();
  if (u > 240) { c.fillStyle = "#11101c"; c.font = `800 ${Math.max(6, fw * 0.1)}px "Barlow Condensed", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("BUY", 0, -fw * 0.05); c.fillText("SALT", 0, fw * 0.07); }
  c.restore();
}

function rkCutlery(c, x, y, R, lw) {
  const L = R * 1.7, t = Math.max(1.6, R * 0.12), ol = Math.max(0.8, lw * 0.6);
  c.save(); c.translate(x, y); c.strokeStyle = "#11101c"; c.lineWidth = ol; c.lineJoin = "round";
  // the fork: three prongs up left, the handle down right (the plate covers its middle)
  c.save(); c.rotate(0.38);
  c.beginPath(); c.moveTo(L * 0.95, -t * 0.55); c.lineTo(-L * 0.6, -t * 0.45); c.lineTo(-L * 0.68, -t * 1.6);
  for (const [a, b] of [[-1.6, -0.75], [-0.38, 0.38], [0.75, 1.6]]) { c.lineTo(-L, a * t); c.lineTo(-L, b * t); if (b < 1) { c.lineTo(-L * 0.8, b * t); c.lineTo(-L * 0.8, b * t + 0.37 * t); } }
  c.lineTo(-L * 0.68, t * 1.6); c.lineTo(-L * 0.6, t * 0.45); c.lineTo(L * 0.95, t * 0.55); c.quadraticCurveTo(L * 1.02, 0, L * 0.95, -t * 0.55); c.closePath();
  c.fillStyle = RDK.tin; c.fill(); c.stroke();
  c.restore();
  // the knife: the blade up right, the wooden handle down left
  c.save(); c.rotate(-0.38);
  c.fillStyle = "#6a4a32"; c.beginPath(); c.roundRect(-L, -t * 0.8, L * 0.72, t * 1.6, t * 0.7); c.fill(); c.stroke();
  c.fillStyle = "#d9c9a8"; for (const q of [-0.85, -0.6]) { c.beginPath(); c.arc(L * q, 0, t * 0.25, 0, RDK_TAU); c.fill(); }
  c.fillStyle = RDK.tin; c.beginPath(); c.moveTo(-L * 0.28, -t * 0.9); c.lineTo(L * 0.7, -t * 1.0); c.quadraticCurveTo(L * 1.04, -t * 0.7, L * 1.04, t * 0.25); c.lineTo(-L * 0.28, t * 0.9); c.closePath(); c.fill(); c.stroke();
  c.restore();
  c.restore();
}

function rkDoor(c, gate, u, lw) {
  const [gx, gy] = gate, dh = u * 0.27, ow = u * 0.1, ox = gx - ow * 0.55;
  // the doorway: a warm-lit gap in a dark frame (the back of the restaurant)
  c.strokeStyle = "#11101c"; c.lineWidth = lw * 1.2;
  c.fillStyle = "#3a2a22"; c.beginPath(); c.rect(ox - u * 0.012, gy - dh - u * 0.012, ow + u * 0.024, dh + u * 0.012); c.fill(); c.stroke();
  const dg = c.createLinearGradient(0, gy - dh, 0, gy); dg.addColorStop(0, "#5a4030"); dg.addColorStop(1, "#c98a4a");
  c.fillStyle = dg; c.beginPath(); c.rect(ox, gy - dh, ow, dh); c.fill(); c.stroke();
  // light out of the doorway onto the floor
  c.fillStyle = "rgba(255,200,130,0.18)"; c.beginPath(); c.moveTo(ox, gy); c.lineTo(ox + ow, gy); c.lineTo(ox + ow * 2.2, gy + u * 0.12); c.lineTo(ox - ow * 0.2, gy + u * 0.12); c.closePath(); c.fill();
  // the door, swung open toward you on its right hinge: steel, a kick plate, the porthole
  const hx = ox + ow, dw = u * 0.075;
  c.fillStyle = RDK.steel; c.beginPath(); c.moveTo(hx, gy - dh); c.lineTo(hx + dw, gy - dh * 1.05); c.lineTo(hx + dw, gy + u * 0.025); c.lineTo(hx, gy); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#7f8b93"; c.beginPath(); c.moveTo(hx, gy - dh * 0.2); c.lineTo(hx + dw, gy - dh * 0.2 + u * 0.004); c.lineTo(hx + dw, gy + u * 0.025); c.lineTo(hx, gy); c.closePath(); c.fill(); c.stroke();
  const px_ = hx + dw * 0.5, py_ = gy - dh * 0.66, pr = dw * 0.32;
  c.fillStyle = "#ffcf7a"; c.beginPath(); c.ellipse(px_, py_, pr * 0.8, pr, 0, 0, RDK_TAU); c.fill();
  c.lineWidth = Math.max(1.5, u * 0.008); c.strokeStyle = RDK.steelLt; c.stroke(); c.lineWidth = lw; c.strokeStyle = "#11101c"; c.beginPath(); c.ellipse(px_, py_, pr * 0.8 + u * 0.004, pr + u * 0.004, 0, 0, RDK_TAU); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.ellipse(px_ - pr * 0.25, py_ - pr * 0.3, pr * 0.18, pr * 0.3, 0.4, 0, RDK_TAU); c.fill();
  // the salt shaker on its side by the door, its salt pouring out toward the trail
  const sx = hx + dw + u * 0.05, sy = gy + u * 0.012, sl = u * 0.05, sr = u * 0.016;
  c.save(); c.translate(sx, sy); c.rotate(-0.15);
  c.fillStyle = RDK.salt; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(sl * 0.95, sr * 0.5, sl * 0.45, sr * 0.45, 0, 0, RDK_TAU); c.fill(); c.globalAlpha = 1;
  c.fillStyle = "rgba(225,235,245,0.85)"; c.strokeStyle = "#11101c"; c.lineWidth = lw; c.beginPath(); c.roundRect(-sl * 0.5, -sr, sl * 0.8, sr * 2, sr * 0.5); c.fill(); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.9)"; c.fillRect(-sl * 0.45, -sr * 0.1, sl * 0.7, sr * 0.9);
  c.fillStyle = RDK.steel; c.beginPath(); c.roundRect(sl * 0.3, -sr * 1.05, sl * 0.25, sr * 2.1, sr * 0.4); c.fill(); c.stroke();
  c.restore();
}

// past the window: the saucer hovers by the hole it made, three eyes glinting in the dome, the lights round its rim chasing
function rkPeek(c, bx, by, u, tk) {
  const G = rkGeo(bx, by, u), x0 = G.wx - G.ww / 2;
  c.save();
  c.beginPath(); c.rect(x0, G.wy, G.ww, G.wh * 0.5); c.clip();
  const S = Math.min(u * 0.05, G.ww * 0.18), sx = G.wx + G.ww * 0.12 + Math.sin(tk * 0.017) * S * 0.25, sy = G.wy + G.wh * 0.24 + Math.sin(tk * 0.05) * S * 0.08;
  const gl = c.createRadialGradient(sx, sy, 0, sx, sy, S * 1.8); gl.addColorStop(0, "rgba(157,255,90,0.3)"); gl.addColorStop(1, "rgba(157,255,90,0)");
  c.fillStyle = gl; c.fillRect(sx - S * 2, sy - S * 2, S * 4, S * 4);
  c.strokeStyle = "#11101c"; c.lineWidth = Math.max(1, u * 0.004); c.lineJoin = "round";
  // the dome, the pilot's three eyes
  c.fillStyle = "#6f8a6c"; c.beginPath(); c.ellipse(sx, sy - S * 0.2, S * 0.36, S * 0.34, 0, Math.PI, RDK_TAU); c.fill();
  for (let i = 0; i < 3; i++) {
    const ex = sx + (i - 1) * S * 0.17, ey = sy - S * 0.32, on = ((tk >> 4) + i) % 4 !== 0;
    c.fillStyle = on ? "#eaffd8" : "#9ab894"; c.beginPath(); c.arc(ex, ey, S * 0.06, 0, RDK_TAU); c.fill();
    if (on && (tk + i * 37) % 120 < 10) { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(ex, ey, S * 0.11, 0, RDK_TAU); c.globalAlpha = 0.4; c.fill(); c.globalAlpha = 1; }
  }
  c.fillStyle = "rgba(170,235,255,0.28)"; c.beginPath(); c.ellipse(sx, sy - S * 0.12, S * 0.46, S * 0.5, 0, Math.PI, RDK_TAU); c.closePath(); c.fill(); c.stroke();
  // the disc and its lights
  c.fillStyle = "#8f9ba3"; c.beginPath(); c.ellipse(sx, sy, S, S * 0.24, 0, 0, RDK_TAU); c.fill(); c.stroke();
  c.fillStyle = "#c9d2d6"; c.beginPath(); c.ellipse(sx, sy - S * 0.05, S * 0.85, S * 0.13, 0, Math.PI, RDK_TAU); c.fill();
  for (let i = 0; i < 6; i++) {
    const lx = sx + (i - 2.5) * S * 0.3, ly = sy + S * 0.08 * (1 - Math.abs(i - 2.5) / 3), on = i === ((tk >> 3) % 6);
    c.fillStyle = on ? RDK.green : i % 2 ? "#7a2a2a" : "#3a6a2a"; c.beginPath(); c.arc(lx, ly, Math.max(1, S * 0.06), 0, RDK_TAU); c.fill();
  }
  c.fillStyle = "rgba(60,255,160,0.5)"; c.beginPath(); c.ellipse(sx, sy + S * 0.2, S * 0.24, S * 0.07, 0, 0, RDK_TAU); c.fill();
  c.restore();
}

RD_ART.kitchen = { bg: rkBg, peek: rkPeek, won: () => {}, ink: { disc: "#e3dccb", ring: "#c23f3a", boss: "#1f3a2c", bossRing: "#9dff5a", num: "#3a2a20" } };
