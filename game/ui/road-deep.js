/* ===================== The Road, region 3: The Deep's map (UI only) =====================
   RD_ART.deep (the registry and roadPaint are in road.js): bg(c, w, h, r, k) the still part (road.js caches it per size and progress),
   peek(c, x, y, u, tk) the moving part drawn under the stops every frame (the lighthouse beam, the buoy's light, Kraken Spud by the pier's
   end), ink: the stop discs as life rings, won(c, x, y, R, mini) a little teal flag on a cleared stop. The harbour at night from above:
   a boardwalk on piles winds from the harbour wall and Spudset Bay's salt-shaker lighthouse (bottom left, its beam sweeping the map every
   6 s) over the dark water to the pier's end (top right, the boss stop); three wave rows, teal specks, a buoy. The gate is a chain across
   the boardwalk just before the pier's end with a NO SWIMMING sign (padlocked while closed; unhooked and hanging once 12 stars open it);
   by the pier's end the top of his head, one big eye and two pink-suckered tentacles above the water, bubbles. Upright: the same pieces on
   road.js's zigzag. krSpine / krTent / KC: draw-kraken.js. */
const RDP = {
  sky0: "#060a1c", sky1: "#10203c", sky2: "#1e3a4a", sea0: "#12304a", sea1: "#0b2238", sea2: "#04101e",
  plank: "#5a3e2a", plankDk: "#3a2a1e", plankLt: "#7a5a3c", stone: "#3b3f4a", stoneLt: "#4c525e", stoneDk: "#23262e", rope: "#c9b28a",
  iron: "#3b3f4a", ironLt: "#9aa3ab", lamp: "#ffb347", buoy: "#c23f3a", buoyW: "#e3dccb", shaker: "#d8d2c4",
};
const RDP_TAU = Math.PI * 2;
const rpHash = (i) => { const x = Math.sin(i * 91.7 + 47.3) * 43758.5453; return x - Math.floor(x); };   // a stable scatter (UI only)
// where things sit for a w x h map: the path, the horizon, the lighthouse (foot, height, lamp), his eye, the buoy, the chain
function rpGeo(w, h) {
  const { gate, pts, tall } = rdPoints(w, h), u = Math.min(w, h), [gx, gy] = gate, [bx, by] = pts[pts.length - 1], all = [gate, ...pts];
  const hz = h * (tall ? 0.07 : 0.11), H = u * (tall ? 0.13 : 0.15), ly = h - u * 0.02;
  // the harbour wall: its top edge, then its water edge slanting down to the bottom; the lighthouse stands on it
  const qTop = gy - u * 0.045, qx1 = gx + u * 0.08, qx2 = Math.min(w * 0.42, gx + u * 0.4), qEdge = qx1 + ((qx2 - qx1) * (ly - qTop)) / Math.max(1, h - qTop);
  const lx = Math.min(gx + u * (tall ? 0.3 : 0.24), qEdge - H * 0.32 - u * 0.012);
  const q0 = rdCurve(all, 8.55), q1 = rdCurve(all, 8.62), dl = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) || 1;
  return { gate, pts, all, tall, u, hz, hw: u * 0.034, bx, by, gx, gy, qTop, qx1, qx2,
    lh: { x: lx, y: ly, H, lamp: [lx, ly - H * 0.88] },
    eye: [bx - u * (tall ? 0.24 : 0.27), by + u * 0.005], buoy: tall ? [w * 0.86, h * 0.56] : [w * 0.88, h * 0.82],
    chain: { x: q0[0], y: q0[1], nx: -(q1[1] - q0[1]) / dl, ny: (q1[0] - q0[0]) / dl } };
}

function rpBg(c, w, h, r, k) {
  const G = rpGeo(w, h), { u, hz, tall } = G, lw = Math.max(1, u * 0.005), open = roadGateOpen(r, k);
  c.lineCap = "round"; c.lineJoin = "round";
  // the sky strip: night, a few stars, low storm clouds
  const sk = c.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, RDP.sky0); sk.addColorStop(0.6, RDP.sky1); sk.addColorStop(1, RDP.sky2);
  c.fillStyle = sk; c.fillRect(0, 0, w, hz + 1);
  for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(220,232,255,${(0.2 + 0.4 * rpHash(i + 3)).toFixed(2)})`; c.fillRect(rpHash(i) * w, rpHash(i + 40) * hz * 0.8, 1.2, 1.2); }
  for (let i = 0; i < 7; i++) {
    const x = w * (0.12 + i * 0.13), y = hz * (0.42 + 0.1 * Math.sin(i * 1.7)), rr = u * (0.05 + 0.025 * rpHash(i + 9));
    c.fillStyle = "rgba(70,96,130,0.35)"; c.beginPath(); c.ellipse(x - rr * 0.1, y - rr * 0.08, rr * 1.6, rr * 0.55, 0, 0, RDP_TAU); c.fill();   // a moonlit rim
    c.fillStyle = "rgba(14,22,42,0.95)"; c.beginPath(); c.ellipse(x, y, rr * 1.6, rr * 0.55, 0, 0, RDP_TAU); c.fill();
  }
  // the far shore on the horizon at the left: the harbour town, lit windows
  c.fillStyle = "#0d1828";
  c.beginPath(); c.moveTo(0, hz + 1);
  for (let i = 0; i <= 8; i++) { const x = (w * 0.34 * i) / 8, y = hz - u * (0.012 + 0.022 * rpHash(i + 20)); c.lineTo(x, y); c.lineTo(x + w * 0.034, y); }
  c.lineTo(w * 0.38, hz + 1); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,179,71,0.7)";
  for (let i = 0; i < 6; i++) c.fillRect(w * 0.34 * rpHash(i + 60), hz - u * 0.012 * rpHash(i + 70) - 2, 1.6, 1.6);
  // the sea: lighter far off, dark near; a fog band on the horizon
  const sg = c.createLinearGradient(0, hz, 0, h); sg.addColorStop(0, RDP.sea0); sg.addColorStop(0.35, RDP.sea1); sg.addColorStop(1, RDP.sea2);
  c.fillStyle = sg; c.fillRect(0, hz, w, h - hz + 1);
  const fg = c.createLinearGradient(0, hz - u * 0.03, 0, hz + u * 0.05); fg.addColorStop(0, "rgba(120,160,180,0)"); fg.addColorStop(0.45, "rgba(120,160,180,0.16)"); fg.addColorStop(1, "rgba(120,160,180,0)");
  c.fillStyle = fg; c.fillRect(0, hz - u * 0.03, w, u * 0.08);
  // three rows of wave crests (smaller far off), teal specks
  c.strokeStyle = "rgba(190,232,224,0.2)"; c.lineWidth = Math.max(1, u * 0.004);
  for (let row = 0; row < 3; row++) {
    const n = tall ? 16 : 26;
    c.beginPath();
    for (let i = 0; i < n * 3; i++) {
      const j = row * 1000 + i;
      if (rpHash(j + 3) < 0.35) continue;
      const y = hz + (h - hz) * (((i % 3) / 3 + rpHash(j) / 3 + row * 0.04) % 1), d = (y - hz) / (h - hz), ww = u * (0.018 + 0.03 * d), x = rpHash(j + 7) * (w + ww) - ww;
      c.moveTo(x, y); c.quadraticCurveTo(x + ww / 2, y - u * 0.008 * (0.4 + d), x + ww, y);
    }
    c.stroke();
  }
  for (let i = 0; i < (tall ? 18 : 28); i++) {
    const x = rpHash(i + 200) * w, y = hz + (h - hz) * (0.1 + 0.9 * rpHash(i + 300)), rr = Math.max(0.8, u * 0.003 * (0.6 + rpHash(i + 5)));
    const gl = c.createRadialGradient(x, y, 0, x, y, rr * 5); gl.addColorStop(0, "rgba(62,242,192,0.35)"); gl.addColorStop(1, "rgba(62,242,192,0)");
    c.fillStyle = gl; c.fillRect(x - rr * 5, y - rr * 5, rr * 10, rr * 10);
    c.fillStyle = `rgba(62,242,192,${(0.4 + 0.4 * rpHash(i + 9)).toFixed(2)})`; c.beginPath(); c.arc(x, y, rr, 0, RDP_TAU); c.fill();
  }
  rpBuoy(c, G.buoy[0], G.buoy[1], u, lw);
  // the harbour wall in the bottom-left corner, the pier's end round the boss stop, the boardwalk between them
  rpQuay(c, G, w, h, lw);
  rpPierEnd(c, G, lw);
  rpBoardwalk(c, G, lw);
  // the chain across the boardwalk before the pier's end (padlocked until 12 stars), the NO SWIMMING sign
  rpChain(c, G, lw, open);
  // the lighthouse on the harbour wall (its beam turns in peek)
  rpShaker(c, G.lh.x, G.lh.y, G.lh.H, lw);
  // the edges in shadow
  const vg = c.createRadialGradient(w * 0.5, h * 0.55, u * 0.3, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,4,12,0.5)");
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
}

function rpBuoy(c, x, y, u, lw) {
  const r = u * 0.018;
  c.strokeStyle = "rgba(191,232,224,0.45)"; c.lineWidth = lw; c.beginPath(); c.ellipse(x, y + r * 0.6, r * 2, r * 0.6, 0, 0, RDP_TAU); c.stroke();
  c.strokeStyle = OUT;
  c.fillStyle = RDP.buoy; c.beginPath(); c.moveTo(x - r, y + r * 0.4); c.lineTo(x - r * 0.45, y - r * 1.6); c.lineTo(x + r * 0.45, y - r * 1.6); c.lineTo(x + r, y + r * 0.4); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = RDP.buoyW; c.fillRect(x - r * 0.72, y - r * 0.55, r * 1.44, r * 0.45);
  c.fillStyle = RDP.iron; c.fillRect(x - r * 0.12, y - r * 2.3, r * 0.24, r * 0.7);
}
function rpQuay(c, G, w, h, lw) {
  const { u, gx } = G, top = G.qTop, x1 = G.qx1, x2 = G.qx2;
  c.fillStyle = RDP.stoneDk; c.beginPath(); c.moveTo(-2, top); c.lineTo(x1, top + u * 0.006); c.lineTo(x2, h + 2); c.lineTo(-2, h + 2); c.closePath(); c.fill();
  // stone blocks
  c.save(); c.clip();
  const bs = u * 0.05;
  c.strokeStyle = "rgba(17,16,28,0.55)"; c.lineWidth = lw;
  for (let y = top, j = 0; y < h; y += bs * 0.6, j++) for (let x = -bs + (j % 2) * bs * 0.5, q = 0; x < x2; x += bs, q++) {
    c.fillStyle = rpHash(j * 31 + q) < 0.3 ? RDP.stoneLt : RDP.stone; c.beginPath(); c.rect(x + 1, y + 1, bs - 2, bs * 0.6 - 2); c.fill(); c.stroke();
  }
  c.restore();
  c.strokeStyle = OUT; c.lineWidth = lw * 1.5; c.beginPath(); c.moveTo(-2, top); c.lineTo(x1, top + u * 0.006); c.lineTo(x2, h + 2); c.stroke();
  // foam where the water meets it
  c.strokeStyle = "rgba(191,232,224,0.5)"; c.lineWidth = Math.max(1, u * 0.006); c.beginPath(); c.moveTo(x1 + u * 0.01, top + u * 0.02); c.lineTo(x2 + u * 0.01, h + 2); c.stroke();
  // a lamp on the wall's top by the start
  const lx = gx - u * 0.047, ly = top - u * 0.052;
  c.fillStyle = RDP.iron; c.fillRect(gx - u * 0.05, top - u * 0.05, Math.max(1.5, u * 0.006), u * 0.05);
  const gl = c.createRadialGradient(lx, ly, 0, lx, ly, u * 0.07); gl.addColorStop(0, "rgba(255,180,70,0.35)"); gl.addColorStop(1, "rgba(255,180,70,0)");
  c.fillStyle = gl; c.fillRect(lx - u * 0.07, ly - u * 0.07, u * 0.14, u * 0.14);
  c.fillStyle = RDP.lamp; c.beginPath(); c.arc(lx, ly, Math.max(1.5, u * 0.008), 0, RDP_TAU); c.fill();
}
function rpPierEnd(c, G, lw) {
  const { u, bx, by } = G, pw = u * 0.3, ph = u * 0.12, x0 = bx - pw / 2, y0 = by - ph * 0.45;
  for (const [qx, qy] of [[x0 + u * 0.015, y0 + ph], [x0 + pw - u * 0.015, y0 + ph], [x0 + pw / 2, y0 + ph]]) {
    c.fillStyle = RDP.plankDk; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.rect(qx - u * 0.008, qy - 2, u * 0.016, u * 0.03); c.fill(); c.stroke();
    c.strokeStyle = "rgba(191,232,224,0.55)"; c.beginPath(); c.ellipse(qx, qy + u * 0.028, u * 0.018, u * 0.005, 0, 0, RDP_TAU); c.stroke();
  }
  c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x0 + u * 0.01, y0 + u * 0.016, pw, ph);
  c.fillStyle = RDP.plank; c.strokeStyle = OUT; c.lineWidth = lw * 1.4; c.beginPath(); c.rect(x0, y0, pw, ph); c.fill(); c.stroke();
  c.strokeStyle = "rgba(17,16,28,0.35)"; c.lineWidth = lw; c.beginPath();
  for (let x = x0 + u * 0.022; x < x0 + pw - 2; x += u * 0.022) { c.moveTo(x, y0 + 1); c.lineTo(x, y0 + ph - 1); }
  c.stroke();
  c.fillStyle = "rgba(190,232,224,0.1)"; c.fillRect(x0 + 1, y0 + 1, pw - 2, ph * 0.12);
  // a lamp post on the far corner, a coil of rope on the other
  const lpx = x0 + pw - u * 0.02, lpy = y0 + u * 0.01;
  const gl = c.createRadialGradient(lpx, lpy - u * 0.06, 0, lpx, lpy - u * 0.06, u * 0.09); gl.addColorStop(0, "rgba(255,180,70,0.32)"); gl.addColorStop(1, "rgba(255,180,70,0)");
  c.fillStyle = gl; c.fillRect(lpx - u * 0.09, lpy - u * 0.15, u * 0.18, u * 0.18);
  c.fillStyle = RDP.plankDk; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.rect(lpx - u * 0.004, lpy - u * 0.055, u * 0.008, u * 0.055); c.fill(); c.stroke();
  c.fillStyle = RDP.lamp; c.beginPath(); c.roundRect(lpx - u * 0.008, lpy - u * 0.072, u * 0.016, u * 0.02, u * 0.003); c.fill(); c.stroke();
  c.strokeStyle = RDP.rope; c.lineWidth = Math.max(1, u * 0.005);
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x0 + u * 0.03, y0 + ph * 0.7, u * (0.016 - i * 0.004), u * (0.009 - i * 0.002), 0, 0, RDP_TAU); c.stroke(); }
}
function rpBoardwalk(c, G, lw) {
  const { u, all, hw, tall } = G, S = rkAlong(all, tall ? 22 : 30);
  // its shadow on the water
  c.save(); c.translate(u * 0.008, u * 0.018);
  rdPath(c, all); c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = hw * 2.2; c.stroke();
  c.restore();
  // piles under both edges every so often, a foam ring on the water at each
  const step = Math.max(3, Math.round((u * 0.11) / Math.max(1, Math.hypot(S[1][0] - S[0][0], S[1][1] - S[0][1]))));
  for (let i = step >> 1; i < S.length; i += step) {
    const [x, y, nx, ny] = S[i];
    for (const s of [-1, 1]) {
      const qx = x + nx * s * hw * 0.85, qy = y + ny * s * hw * 0.85;
      c.fillStyle = RDP.plankDk; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.rect(qx - u * 0.006, qy, u * 0.012, u * 0.028); c.fill(); c.stroke();
      c.strokeStyle = "rgba(191,232,224,0.5)"; c.beginPath(); c.ellipse(qx, qy + u * 0.028, u * 0.014, u * 0.004, 0, 0, RDP_TAU); c.stroke();
    }
  }
  // the boards
  rdPath(c, all); c.strokeStyle = OUT; c.lineWidth = hw * 2 + lw * 2.4; c.stroke();
  rdPath(c, all); c.strokeStyle = RDP.plank; c.lineWidth = hw * 2; c.stroke();
  c.strokeStyle = "rgba(17,16,28,0.38)"; c.lineWidth = Math.max(0.8, lw * 0.8); c.beginPath();
  S.forEach(([x, y, nx, ny], i) => { if (i % 2) return; c.moveTo(x + nx * hw * 0.98, y + ny * hw * 0.98); c.lineTo(x - nx * hw * 0.98, y - ny * hw * 0.98); });
  c.stroke();
  // a lighter (moonlit) edge, a wet sheen down the middle
  c.strokeStyle = RDP.plankLt; c.lineWidth = Math.max(1, u * 0.004); c.beginPath();
  S.forEach(([x, y, nx, ny], i) => { const qx = x - nx * hw * 0.82, qy = y - ny * hw * 0.82; if (i) c.lineTo(qx, qy); else c.moveTo(qx, qy); });
  c.stroke();
  c.strokeStyle = "rgba(190,232,224,0.08)"; c.lineWidth = hw * 0.5; rdPath(c, all); c.stroke();
  // bollards along one edge (up to the chain) with a rope rail sagging between them along the boards
  const per = tall ? 22 : 30, B = [];
  for (let i = step; i <= Math.floor(8.3 * per); i += step * 2) B.push(i);
  c.strokeStyle = RDP.rope; c.lineWidth = Math.max(1, u * 0.0035); c.beginPath();
  for (let j = 0; j < B.length - 1; j++) for (let i = B[j]; i <= B[j + 1]; i++) {
    const [x, y, nx, ny] = S[i], t = (i - B[j]) / (B[j + 1] - B[j]), qx = x + nx * hw * 1.05, qy = y + ny * hw * 1.05 + Math.sin(t * Math.PI) * u * 0.007;
    if (i === B[0]) c.moveTo(qx, qy); else c.lineTo(qx, qy);
  }
  c.stroke();
  for (const i of B) {
    const [x, y, nx, ny] = S[i], qx = x + nx * hw * 1.05, qy = y + ny * hw * 1.05;
    c.fillStyle = RDP.iron; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.arc(qx, qy, Math.max(1.5, u * 0.007), 0, RDP_TAU); c.fill(); c.stroke();
  }
}
// the chain across the boardwalk: two posts, a sagging chain with a padlock (closed), or the chain hanging off one post (open)
function rpChain(c, G, lw, open) {
  const { u, hw, chain } = G, { x, y, nx, ny } = chain, d = hw + u * 0.014, ph = u * 0.045;
  const A = [x + nx * d, y + ny * d], B = [x - nx * d, y - ny * d];
  const post = (p) => {
    c.fillStyle = RDP.plankDk; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.rect(p[0] - u * 0.007, p[1] - ph, u * 0.014, ph); c.fill(); c.stroke();
    c.fillStyle = RDP.ironLt; c.beginPath(); c.arc(p[0], p[1] - ph, u * 0.008, 0, RDP_TAU); c.fill(); c.stroke();
  };
  // the NO SWIMMING sign on its own stick beside the post on the open-water side
  const sx = A[0] + nx * u * 0.06, sy = A[1] + ny * u * 0.06 + u * 0.02, sw = u * 0.09, sh = u * 0.042;
  c.fillStyle = RDP.plankDk; c.fillRect(sx - u * 0.003, sy - ph * 1.2, u * 0.006, ph * 1.2);
  c.fillStyle = "#ece6d6"; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.rect(sx - sw / 2, sy - ph * 1.2 - sh, sw, sh); c.fill(); c.stroke();
  c.fillStyle = "#c23f3a"; c.font = `800 ${Math.max(5, Math.round(sh * 0.38))}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("NO", sx, sy - ph * 1.2 - sh * 0.72); c.fillText("SWIMMING", sx, sy - ph * 1.2 - sh * 0.3);
  post(A); post(B);
  const links = (P) => {
    c.strokeStyle = RDP.ironLt; c.lineWidth = Math.max(1, u * 0.004);
    P.forEach(([qx, qy], i) => { c.beginPath(); c.ellipse(qx, qy, u * 0.006, u * 0.0035, i % 2 ? 1.2 : 0.3, 0, RDP_TAU); c.stroke(); });
  };
  const a = [A[0], A[1] - ph * 0.85], b = [B[0], B[1] - ph * 0.85], n = 12, P = [];
  if (!open) {   // closed: sagging across, the padlock in the middle
    for (let i = 0; i <= n; i++) { const t = i / n; P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * u * 0.03]); }
    links(P);
    const m = P[n >> 1], lr = u * 0.014;
    c.strokeStyle = RDP.ironLt; c.lineWidth = Math.max(1.2, u * 0.004); c.beginPath(); c.arc(m[0], m[1] + lr * 0.3, lr * 0.6, Math.PI, RDP_TAU); c.stroke();
    c.fillStyle = "#d9b23a"; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.roundRect(m[0] - lr * 0.8, m[1] + lr * 0.3, lr * 1.6, lr * 1.3, lr * 0.25); c.fill(); c.stroke();
    c.fillStyle = OUT; c.beginPath(); c.arc(m[0], m[1] + lr * 0.85, lr * 0.2, 0, RDP_TAU); c.fill();
  } else {   // open: unhooked, hanging down the post away from the sign onto the boards, the open padlock at its end
    for (let i = 0; i <= n; i++) { const t = i / n; P.push([b[0] - Math.sin(t * 2.6) * u * 0.01, b[1] + t * ph * 1.05]); }
    links(P);
    const e = P[n], lr = u * 0.012, px = e[0] - u * 0.01 - lr * 1.5;
    c.fillStyle = "#d9b23a"; c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.roundRect(px, e[1] - lr, lr * 1.5, lr * 1.2, lr * 0.25); c.fill(); c.stroke();
    c.strokeStyle = RDP.ironLt; c.beginPath(); c.arc(px + lr * 0.2, e[1] - lr, lr * 0.55, Math.PI * 1.1, Math.PI * 2.1); c.stroke();
  }
}
// Spudset Bay's salt-shaker lighthouse: foot at (x, y), h tall
function rpShaker(c, x, y, h, lw) {
  const bw = h * 0.5, tw = h * 0.38, gh = h * 0.7, top = y - gh;
  const body = () => { c.beginPath(); c.moveTo(x - bw / 2, y); c.lineTo(x - tw / 2, top); c.lineTo(x + tw / 2, top); c.lineTo(x + bw / 2, y); c.closePath(); };
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(x + h * 0.05, y, bw * 0.75, h * 0.07, 0, 0, RDP_TAU); c.fill();
  c.fillStyle = RDP.shaker; body(); c.fill();
  c.fillStyle = "#c23f3a"; c.beginPath(); c.moveTo(x - bw * 0.46, y - gh * 0.3); c.lineTo(x - bw * 0.44, y - gh * 0.42); c.lineTo(x + bw * 0.44, y - gh * 0.42); c.lineTo(x + bw * 0.46, y - gh * 0.3); c.closePath(); c.fill();   // a red band
  c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(x - tw * 0.32, top + gh * 0.08, Math.max(1, h * 0.04), gh * 0.75);
  c.fillStyle = "rgba(0,0,0,0.18)"; c.beginPath(); c.moveTo(x + tw * 0.1, top); c.lineTo(x + tw / 2, top); c.lineTo(x + bw / 2, y); c.lineTo(x + bw * 0.15, y); c.closePath(); c.fill();
  c.strokeStyle = OUT; c.lineWidth = lw * 1.3; body(); c.stroke();
  // the cap: a band and a dome with the shaker's holes
  c.fillStyle = "#9aa3ab"; c.beginPath(); c.rect(x - tw / 2 - h * 0.02, top - h * 0.07, tw + h * 0.04, h * 0.075); c.fill(); c.stroke();
  c.fillStyle = "#b8bfc8"; c.beginPath(); c.ellipse(x, top - h * 0.07, tw / 2, h * 0.17, 0, Math.PI, RDP_TAU); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = OUT;
  for (const [dx, dy] of [[-0.1, 0.12], [0.1, 0.12], [0, 0.17], [-0.05, 0.2], [0.05, 0.2]]) { c.beginPath(); c.arc(x + dx * h, top - h * dy, Math.max(0.6, h * 0.018), 0, RDP_TAU); c.fill(); }
}

// ---- the moving part (every frame, under the stops) ----
function rpPeek(c, bx, by, u, tk) {
  const w = c.canvas.clientWidth, h = c.canvas.clientHeight;
  if (!w || !h) return;
  const G = rpGeo(w, h), lw = Math.max(1, u * 0.005);
  c.save();
  c.lineCap = "round"; c.lineJoin = "round";
  // the lighthouse beam: a pale wedge turning once every 6 s
  const [lx, ly] = G.lh.lamp, a = (tk / 360) * RDP_TAU - Math.PI * 0.6, L = Math.max(w, h) * 1.4, sp = 0.16;
  const bm = c.createRadialGradient(lx, ly, 0, lx, ly, L); bm.addColorStop(0, "rgba(255,236,190,0.2)"); bm.addColorStop(0.5, "rgba(255,236,190,0.06)"); bm.addColorStop(1, "rgba(255,236,190,0)");
  c.fillStyle = bm; c.beginPath(); c.moveTo(lx, ly); c.arc(lx, ly, L, a - sp, a + sp); c.closePath(); c.fill();
  const lg = c.createRadialGradient(lx, ly, 0, lx, ly, u * 0.05); lg.addColorStop(0, "rgba(255,240,210,0.95)"); lg.addColorStop(1, "rgba(255,240,210,0)");
  c.fillStyle = lg; c.fillRect(lx - u * 0.05, ly - u * 0.05, u * 0.1, u * 0.1);
  // the buoy's light blinks
  if (tk % 150 < 40) {
    const [qx, qy] = G.buoy, r = u * 0.018, gl = c.createRadialGradient(qx, qy - r * 2.4, 0, qx, qy - r * 2.4, r * 1.6);
    gl.addColorStop(0, "rgba(255,180,70,0.95)"); gl.addColorStop(1, "rgba(255,180,70,0)"); c.fillStyle = gl; c.fillRect(qx - r * 2, qy - r * 4.4, r * 4, r * 4);
  }
  rpKraken(c, G, u, lw, tk);
  c.restore();
}
// Kraken Spud by the pier's end: the top of his head out of the water, one big eye, two pink-suckered tentacles, bubbles
function rpKraken(c, G, u, lw, tk) {
  const [kx, ky0] = G.eye, ky = ky0 + Math.sin(tk * 0.03) * u * 0.004, R = u * 0.075;
  c.fillStyle = "rgba(10,6,24,0.4)"; c.beginPath(); c.ellipse(kx, ky, R * 1.6, R * 0.32, 0, 0, RDP_TAU); c.fill();
  for (let i = 0; i < 2; i++) {
    const q = ((tk + i * 50) % 100) / 100;
    c.strokeStyle = `rgba(191,232,224,${(0.4 * (1 - q)).toFixed(3)})`; c.lineWidth = Math.max(1, u * 0.004);
    c.beginPath(); c.ellipse(kx, ky, R * (1.2 + q), R * (0.22 + q * 0.2), 0, 0, RDP_TAU); c.stroke();
  }
  // everything above the water line only
  c.save(); c.beginPath(); c.rect(kx - R * 4, ky - R * 4, R * 8, R * 4 + 1); c.clip();
  for (const [dx, s, ph] of [[-R * 1.55, -1, 0], [R * 1.5, 1, 2]]) {
    const sw = Math.sin(tk * 0.04 + ph) * 0.25, pts = krSpine(kx + dx, ky + R * 0.3, -Math.PI / 2 + s * 0.2 + sw * 0.4, R * 1.5, 10, s * 0.2, -s * (2 + sw), 0, 0);
    krTent(c, pts, R * 0.5, R * 0.17, { suck: -s, lw: Math.max(1, lw * 1.2) });
  }
  c.beginPath(); c.ellipse(kx, ky, R, R * 0.78, 0, Math.PI, RDP_TAU); c.closePath();
  const hg = c.createRadialGradient(kx - R * 0.3, ky - R * 0.5, R * 0.1, kx, ky, R * 1.1); hg.addColorStop(0, "#8a5aa8"); hg.addColorStop(0.6, "#6a3f8f"); hg.addColorStop(1, "#3a1f55");
  c.fillStyle = hg; c.fill(); c.strokeStyle = OUT; c.lineWidth = lw * 1.4; c.stroke();
  c.fillStyle = "#3ef2c0";
  for (const [fx, fy] of [[-0.62, -0.18], [-0.5, -0.4], [0.58, -0.2], [0.66, -0.36]]) { c.beginPath(); c.arc(kx + fx * R, ky + fy * R, Math.max(0.8, R * 0.035), 0, RDP_TAU); c.fill(); }
  c.fillStyle = "#d9d2c0"; c.beginPath(); c.arc(kx - R * 0.15, ky - R * 0.72, Math.max(1, R * 0.07), 0, RDP_TAU); c.fill(); c.lineWidth = lw * 0.7; c.stroke();   // a barnacle
  const er = R * 0.34, ex = kx, ey = ky - R * 0.36;
  if (tk % 260 < 8) { c.strokeStyle = OUT; c.lineWidth = lw * 1.4; c.beginPath(); c.arc(ex, ey - er * 0.2, er * 0.8, 0.35, Math.PI - 0.35); c.stroke(); }   // a blink
  else {
    const lk = Math.sin(tk * 0.011) * er * 0.25;   // looking along the boardwalk
    c.fillStyle = "#e8e0f0"; c.beginPath(); c.arc(ex, ey, er, 0, RDP_TAU); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.arc(ex - er * 0.35 + lk, ey + er * 0.18, er * 0.5, 0, RDP_TAU); c.fill();
    c.fillStyle = "#3ef2c0"; c.beginPath(); c.arc(ex - er * 0.5 + lk, ey + er * 0.02, er * 0.15, 0, RDP_TAU); c.fill();
    c.save(); c.beginPath(); c.arc(ex, ey, er, 0, RDP_TAU); c.clip(); c.fillStyle = "#6a3f8f"; c.fillRect(ex - er, ey - er, er * 2, er * 0.55); c.restore();   // the heavy lid
    c.strokeStyle = OUT; c.lineWidth = lw * 1.1; c.beginPath(); c.moveTo(ex - er * 0.95, ey - er * 0.45); c.quadraticCurveTo(ex, ey - er * 0.35, ex + er * 0.95, ey - er * 0.45); c.stroke();
    c.lineWidth = lw * 1.2; c.beginPath(); c.arc(ex, ey, er, 0, RDP_TAU); c.stroke();
  }
  c.restore();
  // the foam collar on the water line, bubbles rising
  c.strokeStyle = "rgba(191,232,224,0.75)"; c.lineWidth = Math.max(1, u * 0.006); c.beginPath(); c.ellipse(kx, ky, R * 1.02, R * 0.16, 0, 0.1, Math.PI - 0.1); c.stroke();
  c.strokeStyle = "rgba(191,232,224,0.8)"; c.lineWidth = Math.max(0.8, u * 0.003);
  for (let i = 0; i < 5; i++) {
    const q = ((tk + i * 23) % 70) / 70, x = kx + (rpHash(i * 3 + Math.floor((tk + i * 23) / 70)) - 0.5) * R * 3.2, y = ky + R * 0.1 - q * R * 0.25, rr = u * 0.004 * (0.6 + q);
    c.beginPath(); c.arc(x, y, rr, 0, RDP_TAU); c.stroke();
  }
}

// a cleared stop: a little flag on the life ring (a pole, a teal pennant waving)
function rpWon(c, x, y, R, mini) {
  const qx = x + R * 0.62, qy = y - R * 0.35, ph = R * (mini ? 0.9 : 1.15), wv = mini ? 0 : Math.sin(performance.now() / 260 + x) * R * 0.06;
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = OUT; c.lineWidth = mini ? 1 : 2; c.beginPath(); c.moveTo(qx, qy); c.lineTo(qx, qy - ph); c.stroke();
  c.strokeStyle = "#e3dccb"; c.lineWidth = mini ? 0.6 : 1; c.beginPath(); c.moveTo(qx, qy - 1); c.lineTo(qx, qy - ph + 1); c.stroke();
  c.fillStyle = "#3ef2c0"; c.strokeStyle = OUT; c.lineWidth = mini ? 1 : 1.6;
  c.beginPath(); c.moveTo(qx, qy - ph); c.quadraticCurveTo(qx + R * 0.3, qy - ph + R * 0.05 + wv, qx + R * 0.62, qy - ph + R * 0.2 + wv); c.lineTo(qx, qy - ph + R * 0.42); c.closePath(); c.fill(); c.stroke();
}

RD_ART.deep = { bg: rpBg, peek: rpPeek, won: rpWon, ink: { disc: "#ff8a5a", ring: "#e3dccb", boss: "#2a1640", bossRing: "#3ef2c0", num: "#2a1830" } };
