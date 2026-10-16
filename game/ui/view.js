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
  if (mode === "result") rvPlace();   // ui/rivals.js: the rival strip moves with the layout
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

// x, y, z are what the renderers read. bx/by/bz are the eased follow-camera; the KO punch-in (UI only) is added on top.
const cam = { x: 0, y: -110, z: 0.6, shake: 0, sx: 0, sy: 0, bx: 0, by: -110, bz: 0.6, pt: 99, pn: 1, px: 0, py: 0, pk: 1, pa: 0.18, ph: 0.5 };
function camTarget(g) {
  const B = STAGE.blast;
  const base = L.portrait ? 250 : 360, pad = L.portrait ? 110 : 150;
  let x1 = -base, x2 = base, y1 = -300, y2 = 110;
  for (const f of g.fighters) {
    if (f.state === "dead" || f.state === "gone") continue;
    // a hidden boss out at sea (Kraken Spud behind the pier) is no reason to pull the camera out: only his reach onto the deck counts
    if (f.spec.boss && f.spec.boss.hide && !f.doomed && f.x > STAGE.main.x2 + 40) continue;
    // Ultimates (UI only): Phoenix's dive goes far above the screen, the camera stays on the stage; the Dragon is drawn 1.6x
    const fy = uvCamY(f), fh = f.s.h * uvScale(f);
    x1 = Math.min(x1, f.x - pad); x2 = Math.max(x2, f.x + pad);
    y1 = Math.min(y1, fy - fh - 130); y2 = Math.max(y2, fy + 90);
  }
  x1 = Math.max(x1, B.left + 40); x2 = Math.min(x2, B.right - 40);
  y1 = Math.max(y1, B.top + 40); y2 = Math.min(y2, B.bottom - 20);
  const zFit = Math.min(L.gw / (x2 - x1), L.gh / (y2 - y1));
  const zMin = Math.min(L.gw / 1450, L.gh / 1000);
  const zMax = L.portrait ? Math.min(L.gw / 540, L.gh / 420) : Math.min(L.gw / 740, L.gh / 470);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, z: clamp(zFit, zMin, Math.max(zMin, zMax)) };
}
// KO zoom: push the camera towards a world point for `ticks` sim ticks (60 per second) and ease back. Pure view, never read by the sim.
// qa / qh (optional, fractions of the ticks): where the snap-in ends and where the hold ends (the super freeze holds for its 30 ticks).
function camPunch(wx, wy, k, ticks, qa, qh) { cam.px = wx; cam.py = wy; cam.pk = k; cam.pt = 0; cam.pn = ticks; cam.pa = qa || 0.18; cam.ph = qh || 0.5; }
function camPunchK() {
  if (cam.pt >= cam.pn) return 0;
  const q = cam.pt / cam.pn;
  if (q < cam.pa) { const a = q / cam.pa; return 1 - (1 - a) * (1 - a); }   // snaps in
  if (q < cam.ph) return 1;                                                  // holds through the freeze
  const a = (q - cam.ph) / (1 - cam.ph); return 1 - a * a * (3 - 2 * a);    // eases back out
}
function camStep(g, snap) {
  const t = camTarget(g), k = snap ? 1 : 0.075;
  cam.bx += (t.x - cam.bx) * k; cam.by += (t.y - cam.by) * k; cam.bz += (t.z - cam.bz) * k;
  if (snap) cam.pt = cam.pn;
  const pk = camPunchK() * cam.pk, mv = Math.min(1, pk) * 0.6;
  cam.x = cam.bx + (cam.px - cam.bx) * mv; cam.y = cam.by + (cam.py - cam.by) * mv; cam.z = cam.bz * (1 + 0.45 * pk);
  if (cam.pt < cam.pn) cam.pt++;
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
// The percent stays white until about 90, warms to yellow by 130, and runs to red between 150 and 175, where finish mode starts
// (BL.TUNE.finishPct) and the HUD card pulses. The card's pulse and the off-screen bubble's number share this red.
function pctColor(p) {
  const F = BL.TUNE.finishPct, stops = [[0, "#f4f2ec"], [90, "#f4f2ec"], [130, "#ffd84a"], [F - 25, "#ffd84a"], [F, "#ff3b32"], [F + 65, "#e0202c"]];
  for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; return mix(ca, cb, (p - a) / (b - a)); }
  return stops[stops.length - 1][1];
}

