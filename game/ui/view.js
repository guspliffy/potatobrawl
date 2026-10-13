/* ===================== layout & camera ===================== */
let W = 1, H = 1, DPR = 1;
const L = { gw: 1, gh: 1, panel: 0, portrait: false };
/* Sideways mode: when the viewer stays upright (the Claude app's artifact view does not rotate),
   the whole game is rotated 90 degrees so it plays in landscape with the phone turned. */
let rotMode = 0;
let finFull = false; // the KO finisher uses the whole screen, also where the upright controls panel sits
const rotBox = { W0: 1, H0: 1 };
function toApp(cx, cy) {
  if (!rotMode) { const r = app.getBoundingClientRect(); return [cx - r.left, cy - r.top]; }
  const b = document.body.getBoundingClientRect(), x = cx - b.left, y = cy - b.top;
  return rotMode === 1 ? [y, rotBox.W0 - x] : [rotBox.H0 - y, x];
}
function resize() {
  const W0 = Math.max(1, document.body.clientWidth), H0 = Math.max(1, document.body.clientHeight);
  const uprightView = H0 > W0 * 1.05;
  rotMode = touchUI && uprightView && P.screen !== "up" ? (P.screen === "ccw" ? -1 : 1) : 0;
  rotBox.W0 = W0; rotBox.H0 = H0;
  if (rotMode) {
    app.style.width = H0 + "px"; app.style.height = W0 + "px";
    app.style.transform = rotMode === 1 ? `translate(${W0}px, 0) rotate(90deg)` : `translate(0, ${H0}px) rotate(-90deg)`;
  } else { app.style.width = ""; app.style.height = ""; app.style.transform = ""; }
  app.classList.toggle("rot", !!rotMode);
  // sideways mode with the browser bars showing: one of them runs along the stick or button edge
  app.classList.toggle("barside", !!rotMode && !FS.app && !isFull());
  W = Math.max(1, app.clientWidth); H = Math.max(1, app.clientHeight);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  L.portrait = H > W * 1.05;
  L.panel = L.portrait && mode === "match" && touchUI && !finFull ? Math.round(clamp(H * 0.36, 200, 300)) : 0;
  L.gw = W; L.gh = H - L.panel;
  app.classList.toggle("portrait", L.portrait);
  app.style.setProperty("--panelH", L.panel + "px");
  app.style.setProperty("--uh", H / 100 + "px");
  app.style.setProperty("--um", Math.min(W, H) / 100 + "px");
  app.classList.toggle("short", H < 520);
  app.classList.toggle("tiny", H < 360);
  app.classList.toggle("narrow", W < 420);
  $("rotHint").hidden = !(L.portrait && touchUI);
  L.canRotate = touchUI && uprightView;
  if (!$("scrSettings").hidden) renderSettings();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 120));

const cam = { x: 0, y: -110, z: 0.6, shake: 0, sx: 0, sy: 0 };
function camTarget(g) {
  const B = STAGE.blast;
  const base = L.portrait ? 250 : 360, pad = L.portrait ? 110 : 150;
  let x1 = -base, x2 = base, y1 = -300, y2 = 110;
  for (const f of g.fighters) {
    if (f.state === "dead" || f.state === "gone") continue;
    x1 = Math.min(x1, f.x - pad); x2 = Math.max(x2, f.x + pad);
    y1 = Math.min(y1, f.y - f.s.h - 130); y2 = Math.max(y2, f.y + 90);
  }
  x1 = Math.max(x1, B.left + 40); x2 = Math.min(x2, B.right - 40);
  y1 = Math.max(y1, B.top + 40); y2 = Math.min(y2, B.bottom - 20);
  const zFit = Math.min(L.gw / (x2 - x1), L.gh / (y2 - y1));
  const zMin = Math.min(L.gw / 1450, L.gh / 1000);
  const zMax = L.portrait ? Math.min(L.gw / 540, L.gh / 420) : Math.min(L.gw / 740, L.gh / 470);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, z: clamp(zFit, zMin, Math.max(zMin, zMax)) };
}
function camStep(g, snap) {
  const t = camTarget(g), k = snap ? 1 : 0.075;
  cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k; cam.z += (t.z - cam.z) * k;
  cam.shake *= 0.85; if (cam.shake < 0.3) cam.shake = 0;
  cam.sx = (Math.random() - 0.5) * cam.shake * 2; cam.sy = (Math.random() - 0.5) * cam.shake * 2;
}
const toScreen = (wx, wy) => [L.gw / 2 + (wx - cam.x) * cam.z + cam.sx, L.gh / 2 + (wy - cam.y) * cam.z + cam.sy];

/* ===================== colors ===================== */
const OUT = "#11101c";
const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(hex, v); }
  return v;
}
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; }
function rgba(hex, a) { const A = rgb(hex); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
const palExtra = new WeakMap();
function px(p) {
  let e = palExtra.get(p);
  if (!e) { e = { back: mix(p.body, "#0b0c18", 0.4), dim: mix(p.body, "#55556a", 0.6), hi: mix(p.body, "#ffffff", 0.4) }; palExtra.set(p, e); }
  return e;
}
const col = (p) => p.ui || p.body;
const PORTRAITS = /*PORTRAITS*/{};
function pctColor(p) {
  const stops = [[0, "#f4f2ec"], [50, "#f6d77a"], [100, "#f39a4c"], [150, "#e8503a"], [220, "#b8263a"]];
  for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; return mix(ca, cb, (p - a) / (b - a)); }
  return stops[stops.length - 1][1];
}

