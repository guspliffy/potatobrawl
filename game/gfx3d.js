/* ===================== 3D renderer (three.js r128) =====================
   The simulation and the pose system are unchanged; this layer turns each frame into a lit
   three.js scene. Layers, back to front: sky and sea (2D canvas #cv), stage, fighters and
   projectile cores (WebGL canvas #gl), then effects, swooshes, glows, tags and off-screen
   bubbles (2D canvas #ov). The 3D camera looks straight down the z axis, so the z = 0 plane
   lines up exactly with the 2D camera and the overlay keeps using world coordinates.
   Rendering never writes to the game state, so online lockstep is unaffected. */
const glcv = $("gl"), ovcv = $("ov"), octx = ovcv.getContext("2d");
const R3 = {
  ready: false, failed: false, on: false, T: null, renderer: null, scene: null, camera: null, key: null,
  rigs: [null, null], fov: 30, w: 0, h: 0, pr: 0, q: 0, perf: { t0: 0, n: 0, sum: 0 }, G: null, M: null,
  proj: { orb: [], bolt: [], raven: [] }, respawn: [null, null], bub: [null, null], pv: null, pvRigs: new Map(), frame: 0,
};
const YAW = 0.5;          // how far fighters turn toward the camera (radians)
const AZ0 = 0.62;         // face direction on the body, from forward (+x) toward the camera (+z)
const EL_EYE = 0.27;      // eye height on the body, as an elevation angle
const FACE = { span: 1.9, top: 0.62, hgt: 1.4, N: 256 };
const QUALITY = [
  { pr: 2, touchPr: 1.75, shadows: true },
  { pr: 1.5, touchPr: 1.5, shadows: true },
  { pr: 1.25, touchPr: 1.25, shadows: false },
  { pr: 1, touchPr: 1, shadows: false },
];

function lin(hex) { return new R3.T.Color(hex).convertSRGBToLinear(); }
function use3D() { return P.gfx !== "2d" && r3Init(); }
function r3Fail() { R3.failed = true; R3.ready = false; r3Layers(false); if (!$("scrSettings").hidden) renderSettings(); }

function r3Init() {
  if (R3.ready) return true;
  if (R3.failed) return false;
  const T = window.THREE;
  if (!T || !T.WebGLRenderer) { r3Fail(); return false; }
  try {
    const r = new T.WebGLRenderer({ canvas: glcv, antialias: true, alpha: true, powerPreference: "high-performance" });
    if (!r.getContext()) throw new Error("no WebGL context");
    R3.T = T; R3.renderer = r;
    r.setClearColor(0x000000, 0);
    r.outputEncoding = T.sRGBEncoding;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    glcv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); r3Fail(); });
    r3Shared(); r3Scene(); r3Stage(); r3PreviewScene();
    R3.ready = true;
    return true;
  } catch (e) {
    console.warn("3D graphics unavailable, using 2D:", e && e.message);
    r3Fail();
    return false;
  }
}
function r3Layers(on) {
  if (R3.on === on) return;
  R3.on = on;
  glcv.style.display = on ? "block" : "none";
  ovcv.style.display = on ? "block" : "none";
  if (!on) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, ovcv.width, ovcv.height); }
}
function r3PixelRatio() {
  const q = QUALITY[R3.q], dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, touchUI ? q.touchPr : q.pr);
}
function r3Size() {
  const pr = r3PixelRatio(), r = R3.renderer;
  if (R3.w !== L.gw || R3.h !== L.gh || R3.pr !== pr) {
    R3.w = L.gw; R3.h = L.gh; R3.pr = pr;
    r.setPixelRatio(pr); r.setSize(L.gw, L.gh, false);
    glcv.style.width = L.gw + "px"; glcv.style.height = L.gh + "px";
  }
  if (ovcv.width !== cv.width || ovcv.height !== cv.height) { ovcv.width = cv.width; ovcv.height = cv.height; }
  const sh = QUALITY[R3.q].shadows;
  if (R3.key.castShadow !== sh) R3.key.castShadow = sh;
}
/* Frame-time watchdog: if the game can't hold ~45 fps for a few seconds, drop resolution,
   then shadows. It only ever steps down, so it can't oscillate. */
function r3Perf(now) {
  const p = R3.perf;
  if (!p.last) { p.last = now; return; }
  const dt = now - p.last; p.last = now;
  if (document.hidden || dt > 120 || R3.q >= QUALITY.length - 1 || R3.lockQ) { p.n = 0; p.sum = 0; return; }
  p.n++; p.sum += dt;
  if (p.sum > 2500) {
    if (p.sum / p.n > 22) R3.q++;
    p.n = 0; p.sum = 0;
  }
}

/* ---------- shared geometry, textures and helpers ---------- */
function r3Shared() {
  const T = R3.T;
  R3.G = {
    sph: new T.SphereGeometry(1, 20, 14),
    sphLo: new T.SphereGeometry(1, 12, 8),
    cyl: new T.CylinderGeometry(1, 1, 1, 10, 1, true),
    cone: new T.ConeGeometry(1, 1, 10),
    oct: new T.OctahedronGeometry(1, 0),
    leaf: leafGeom(T),
    feather: featherGeom(T),
    bodies: new Map(),
  };
  for (const k of ["sph", "sphLo", "cyl", "cone", "oct", "leaf", "feather"]) R3.G[k].userData.shared = true;
  R3.tex = { skin: skinTexture(T) };
  R3.M = {
    sclera: new T.MeshStandardMaterial({ color: lin("#fbfaf6"), roughness: 0.18 }),
    iris: new T.MeshStandardMaterial({ color: lin("#5a2a14"), roughness: 0.15 }),
    pupil: new T.MeshStandardMaterial({ color: lin("#0d0806"), roughness: 0.1 }),
    glint: new T.MeshBasicMaterial({ color: 0xffffff }),
    leaf: new T.MeshStandardMaterial({ color: lin("#7cc85a"), roughness: 0.55, side: T.DoubleSide }),
    stem: new T.MeshStandardMaterial({ color: lin("#3f7d3a"), roughness: 0.6 }),
    raven: new T.MeshStandardMaterial({ color: lin("#1b1a22"), roughness: 0.38, metalness: 0.25 }),
    ravenDark: new T.MeshStandardMaterial({ color: lin("#2a2833"), roughness: 0.5, metalness: 0.2 }),
    beak: new T.MeshStandardMaterial({ color: lin("#3a3844"), roughness: 0.4 }),
    redEye: new T.MeshBasicMaterial({ color: lin("#ff3b3b") }),
    orb: new T.MeshStandardMaterial({ color: lin("#8dff70"), emissive: lin("#2eff3c"), emissiveIntensity: 0.85, roughness: 0.2 }),
    crystal: new T.MeshStandardMaterial({ color: lin("#ffe08a"), emissive: lin("#ffb83d"), emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.1 }),
    gold: new T.MeshStandardMaterial({ color: lin("#c9a227"), roughness: 0.3, metalness: 0.8 }),
  };
  for (const m of Object.values(R3.M)) m.userData.shared = true;
}
function mesh(geo, mat, cast) {
  const m = new R3.T.Mesh(geo, mat);
  if (cast !== false) m.castShadow = true;
  return m;
}
function seededRnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function skinTexture(T) {
  const W = 512, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), rnd = seededRnd(11);
  x.fillStyle = "#f7ecd9"; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 110; i++) {
    const px = rnd() * W, py = rnd() * H, r = 6 + rnd() * 30, a = 0.04 + rnd() * 0.07;
    for (const ox of [-W, 0, W]) {
      const gr = x.createRadialGradient(px + ox, py, 0, px + ox, py, r);
      gr.addColorStop(0, `rgba(176,120,62,${a})`); gr.addColorStop(1, "rgba(176,120,62,0)");
      x.fillStyle = gr; x.fillRect(px + ox - r, py - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 300; i++) {
    x.fillStyle = `rgba(112,72,36,${0.22 + rnd() * 0.35})`;
    x.beginPath(); x.ellipse(rnd() * W, 20 + rnd() * (H - 40), 0.7 + rnd() * 1.5, 0.5 + rnd() * 1, rnd() * 3, 0, Math.PI * 2); x.fill();
  }
  // a few potato "eyes", kept off the face (u ~ 0.40, v ~ 0.45)
  for (let i = 0; i < 14; i++) {
    const u = rnd(), v = 0.15 + rnd() * 0.75;
    if (Math.abs(u - 0.4) < 0.16 && Math.abs(v - 0.47) < 0.25) continue;
    const px = u * W, py = v * H;
    x.strokeStyle = "rgba(96,58,26,0.55)"; x.lineWidth = 1.6;
    x.beginPath(); x.arc(px, py, 3 + rnd() * 2, 0.3, 2.6); x.stroke();
    x.fillStyle = "rgba(96,58,26,0.35)"; x.beginPath(); x.arc(px, py + 1, 1.6, 0, Math.PI * 2); x.fill();
  }
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; t.userData = { shared: true }; // r128 textures have no userData
  return t;
}
function noiseTexture(T, base, spots, seed, size) {
  const N = size || 256, c = document.createElement("canvas"); c.width = N; c.height = N;
  const x = c.getContext("2d"), rnd = seededRnd(seed);
  x.fillStyle = base; x.fillRect(0, 0, N, N);
  for (const [col, n, r0, r1] of spots) for (let i = 0; i < n; i++) {
    const px = rnd() * N, py = rnd() * N, r = r0 + rnd() * (r1 - r0);
    x.fillStyle = col;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.beginPath(); x.ellipse(px + ox, py + oy, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); x.fill(); }
  }
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function leafGeom(T) {
  const s = new T.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(0.45, 0.42, 1, 0); s.quadraticCurveTo(0.45, -0.42, 0, 0);
  const g = new T.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -0.02);
  // cup the leaf a little so it catches light
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); p.setZ(i, p.getZ(i) + v * v * 0.9 - u * (1 - u) * 0.12); }
  g.computeVertexNormals();
  return g;
}
function featherGeom(T) {
  const s = new T.Shape(), wd = 0.17;
  s.moveTo(0, 0); s.quadraticCurveTo(0.55, wd, 1, 0); s.quadraticCurveTo(0.55, -wd, 0, 0);
  const g = new T.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -0.0175);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
  return g;
}
const UP = { x: 0, y: 1, z: 0 };
function dirAE(az, el, out) { const ce = Math.cos(el); return out.set(ce * Math.cos(az), Math.sin(el), ce * Math.sin(az)); }
function lumpF(x, y, z) {
  return 1 + 0.028 * Math.sin(3.1 * x + 1.3 * y + 0.4) * Math.cos(2.7 * z - 1.9 * y + 1.1) + 0.018 * Math.sin(5.3 * y + 2.2 * x - 0.7) + 0.012 * Math.cos(6.1 * z + 3.3 * x);
}
// point on the potato for a unit direction (x, y, z), pushed out by factor k
function surf(B, d, k, out) {
  const L = lumpF(d.x, d.y, d.z) * (k || 1), wd = 1 - B.taper * d.y;
  return out.set(d.x * B.rx * wd * L, d.y * B.ry * L, d.z * B.rz * wd * L);
}
function surfN(B, d, out) { return out.set(d.x / B.rx, d.y / B.ry, d.z / B.rz).normalize(); }
function orientTo(obj, n, roll) {
  const T = R3.T, xA = new T.Vector3(n.z, 0, -n.x);
  if (xA.lengthSq() < 1e-6) xA.set(1, 0, 0);
  xA.normalize();
  const yA = new T.Vector3().crossVectors(n, xA);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(xA, yA, n));
  if (roll) obj.rotateZ(roll);
}
function bodyGeom(B) {
  const key = `${B.rx.toFixed(2)}|${B.ry.toFixed(2)}|${B.rz.toFixed(2)}|${B.taper}`;
  let g = R3.G.bodies.get(key);
  if (g) return g;
  const T = R3.T;
  g = new T.SphereGeometry(1, 48, 32);
  const p = g.attributes.position, d = new T.Vector3(), o = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    surf(B, d, 1, o); p.setXYZ(i, o.x, o.y, o.z);
  }
  g.computeVertexNormals();
  // weld normals across the UV seam so it doesn't show as a crease
  const n = g.attributes.normal, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    const s = seen.get(k);
    if (s) s.push(i); else seen.set(k, [i]);
  }
  for (const ids of seen.values()) {
    if (ids.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of ids) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of ids) n.setXYZ(i, x / l, y / l, z / l);
  }
  g.userData.shared = true;
  R3.G.bodies.set(key, g);
  return g;
}
/* A patch of the potato surface, parametrised around a centre direction c: psi goes around c,
   gamma is the angle away from c. g0/g1 give the inner and outer edge for each psi, so holes
   (hood opening) and hems (hair line, armour edge) come out as clean edges. */
function capGeom(B, c, g0, g1, k, nPsi, nGam) {
  const T = R3.T, e1 = new T.Vector3(c.z, 0, -c.x);
  if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
  e1.normalize();
  const e2 = new T.Vector3().crossVectors(c, e1).normalize();
  const pos = [], nrm = [], idx = [], d = new T.Vector3(), o = new T.Vector3(), nn = new T.Vector3();
  for (let i = 0; i <= nPsi; i++) {
    const psi = (i / nPsi) * Math.PI * 2, a = g0(psi), b = g1(psi);
    const cp = Math.cos(psi), sp = Math.sin(psi);
    for (let j = 0; j <= nGam; j++) {
      const gm = a + ((b - a) * j) / nGam, cg = Math.cos(gm), sg = Math.sin(gm);
      d.set(c.x * cg + (e1.x * cp + e2.x * sp) * sg, c.y * cg + (e1.y * cp + e2.y * sp) * sg, c.z * cg + (e1.z * cp + e2.z * sp) * sg).normalize();
      surf(B, d, k, o); surfN(B, d, nn);
      pos.push(o.x, o.y, o.z); nrm.push(nn.x, nn.y, nn.z);
    }
  }
  const S = nGam + 1;
  for (let i = 0; i < nPsi; i++) for (let j = 0; j < nGam; j++) {
    const a = i * S + j, b = (i + 1) * S + j;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  g.userData.frame = { c: c.clone(), e1, e2 };
  return g;
}
function capPoint(c, e1, e2, psi, gm, out) {
  const cp = Math.cos(psi), sp = Math.sin(psi), cg = Math.cos(gm), sg = Math.sin(gm);
  return out.set(c.x * cg + (e1.x * cp + e2.x * sp) * sg, c.y * cg + (e1.y * cp + e2.y * sp) * sg, c.z * cg + (e1.z * cp + e2.z * sp) * sg).normalize();
}
// outer edge where keep(dir) first turns false walking away from c (at least g0 + minW)
function edgeFn(c, g0, keep, minW) {
  const T = R3.T, e1 = new T.Vector3(c.z, 0, -c.x);
  if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
  e1.normalize();
  const e2 = new T.Vector3().crossVectors(c, e1).normalize(), d = new T.Vector3();
  return (psi) => {
    const a = g0(psi);
    let lo = a, hi = Math.PI;
    for (let gm = a; gm <= Math.PI; gm += 0.04) { if (!keep(capPoint(c, e1, e2, psi, gm, d))) { hi = gm; break; } lo = gm; }
    if (hi < Math.PI) for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (keep(capPoint(c, e1, e2, psi, m, d))) lo = m; else hi = m; }
    return Math.max(lo, a + (minW || 0));
  };
}
const backness = (d) => { const l = Math.hypot(d.x, d.z) || 1; return (1 - (d.x * Math.cos(AZ0) + d.z * Math.sin(AZ0)) / l) / 2; };
const ellipseR = (a, b) => (psi) => 1 / Math.sqrt((Math.cos(psi) / a) ** 2 + (Math.sin(psi) / b) ** 2);
function bandGeom(B, elLo, elHi, k) {
  const T = R3.T, c = new T.Vector3(0, -1, 0);
  return capGeom(B, c, () => Math.PI / 2 + elLo, () => Math.PI / 2 + elHi, k, 40, 3);
}

/* ---------- scene, lights, stage ---------- */
function r3Lights(s, shadow) {
  const T = R3.T;
  s.add(new T.HemisphereLight(lin("#e4dcff"), lin("#5a3e3a"), 0.8));
  const key = new T.DirectionalLight(lin("#fff1de"), 1.12);
  key.position.set(0.42 * 1400, 80 + 1400, 0.62 * 1400); key.target.position.set(0, 80, 0);
  s.add(key, key.target);
  if (shadow) {
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -560; sc.right = 560; sc.top = 560; sc.bottom = -560; sc.near = 400; sc.far = 3200;
    key.shadow.bias = -0.0008; key.shadow.normalBias = 0.6;
  }
  const rim = new T.DirectionalLight(lin("#ffb27a"), 0.75); rim.position.set(700, 300, -900); s.add(rim);
  const fill = new T.DirectionalLight(lin("#9fa8ff"), 0.22); fill.position.set(-900, 200, 500); s.add(fill);
  return key;
}
function r3Scene() {
  const T = R3.T, s = new T.Scene();
  R3.scene = s;
  R3.camera = new T.PerspectiveCamera(R3.fov, 1, 50, 6000);
  R3.key = r3Lights(s, true);
}
function r3Stage() {
  const T = R3.T, S = STAGE.main, s = R3.scene, grp = new T.Group();
  // floating rock under the main platform: a squashed, rough half-icosphere, flat on top
  const rock = new T.IcosahedronGeometry(1, 3), p = rock.attributes.position, v = new T.Vector3();
  const cx = (S.x1 + S.x2) / 2, hw = (S.x2 - S.x1) / 2 + 6, depthH = 64, rockH = S.bottom + 34;
  const colors = new Float32Array(p.count * 3), top = lin("#5c5583"), bot = lin("#1f1b35");
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const n = 1 + 0.13 * Math.sin(7.1 * v.x + 2.3 * v.z) * Math.cos(5.3 * v.y + 1.7 * v.x) + 0.07 * Math.sin(13 * v.z + 4 * v.x);
    let y = Math.min(0, v.y) * rockH * n;
    const taper = 1 - 0.15 * Math.min(1, -y / 90);
    const x = cx + v.x * hw * taper * (v.y > 0 ? 1 : 0.98 + 0.04 * n), z = v.z * depthH * taper * n;
    if (v.y > 0) y = 0;
    p.setXYZ(i, x, y - 10, z);
    const t = Math.min(1, -y / rockH), c = top.clone().lerp(bot, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  rock.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  rock.computeVertexNormals();
  const rockMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const rm = mesh(rock, rockMat); rm.receiveShadow = true; grp.add(rm);
  // a few hanging crystals and roots for depth
  const crys = new T.MeshStandardMaterial({ color: lin("#7fd6c8"), emissive: lin("#2f8f86"), emissiveIntensity: 0.55, roughness: 0.2, flatShading: true });
  for (const [x, z, s0, a] of [[-150, 34, 13, 0.2], [-118, 22, 9, -0.3], [90, 36, 15, -0.15], [126, 24, 10, 0.35], [228, 26, 9, 0.1], [-40, 40, 8, -0.1]]) {
    const e = 1 - ((x - cx) / hw) ** 2 - (z / depthH) ** 2, sy = -10 - rockH * Math.sqrt(Math.max(0, e)) * 0.92;
    const m = mesh(R3.G.oct, crys); m.scale.set(s0 * 0.55, s0 * 1.6, s0 * 0.55); m.position.set(x, sy - s0 * 0.6, z); m.rotation.set(0.25, 0, a); grp.add(m);
  }
  // grassy top slab
  const slab = (x1, x2, d, th, r) => {
    const sh = new T.Shape();
    sh.moveTo(x1 + r, -d); sh.lineTo(x2 - r, -d); sh.quadraticCurveTo(x2, -d, x2, -d + r); sh.lineTo(x2, d - r); sh.quadraticCurveTo(x2, d, x2 - r, d);
    sh.lineTo(x1 + r, d); sh.quadraticCurveTo(x1, d, x1, d - r); sh.lineTo(x1, -d + r); sh.quadraticCurveTo(x1, -d, x1 + r, -d);
    const g = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 2.5, bevelSegments: 2, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); g.computeBoundingBox(); g.translate(0, -g.boundingBox.max.y, 0);
    return g;
  };
  const grassTex = noiseTexture(T, "#6cae62", [["rgba(150,214,120,0.5)", 160, 1.5, 5], ["rgba(52,104,62,0.5)", 200, 1, 4]], 5);
  grassTex.repeat.set(1 / 70, 1 / 70);
  const grassTop = new T.MeshStandardMaterial({ color: 0xffffff, map: grassTex, roughness: 0.9 });
  const grassSide = new T.MeshStandardMaterial({ color: lin("#4c7d5a"), roughness: 0.9 });
  const gm = mesh(slab(S.x1 - 3, S.x2 + 3, 66, 9, 10), [grassTop, grassSide]); gm.receiveShadow = true; grp.add(gm);
  // ledge markers
  const ledge = new T.MeshStandardMaterial({ color: lin("#f3d9a4"), roughness: 0.4, metalness: 0.3 });
  for (const x of [S.x1, S.x2]) { const m = mesh(new T.BoxGeometry(7, 3, 134), ledge); m.position.set(x + (x < 0 ? 1.5 : -1.5), -1.2, 0); m.receiveShadow = true; grp.add(m); }
  // floating platforms: stone slab with a light top and a small rock underneath
  const platTop = new T.MeshStandardMaterial({ color: lin("#d8d2f0"), roughness: 0.6 });
  const platSide = new T.MeshStandardMaterial({ color: lin("#4b4672"), roughness: 0.85 });
  const smallRock = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  for (const pl of STAGE.plats) {
    const m = mesh(slab(pl.x1, pl.x2, 34, 6, 6), [platTop, platSide]); m.position.y = -pl.y; m.receiveShadow = true; grp.add(m);
    const rg = new T.IcosahedronGeometry(1, 2), rp = rg.attributes.position, rc = new Float32Array(rp.count * 3);
    const mid = (pl.x1 + pl.x2) / 2, half = (pl.x2 - pl.x1) / 2 - 8;
    for (let i = 0; i < rp.count; i++) {
      v.set(rp.getX(i), rp.getY(i), rp.getZ(i)).normalize();
      const n = 1 + 0.15 * Math.sin(9 * v.x + 3 * v.z + pl.x1) * Math.cos(6 * v.y);
      const y = Math.min(0, v.y) * 26 * n;
      rp.setXYZ(i, mid + v.x * half * (1 + y / 60), -pl.y - 8 + (v.y > 0 ? 0 : y), v.z * 26 * (1 + y / 60));
      const c = top.clone().lerp(bot, Math.min(1, -y / 26)); rc.set([c.r, c.g, c.b], i * 3);
    }
    rg.setAttribute("color", new T.Float32BufferAttribute(rc, 3)); rg.computeVertexNormals();
    const rm2 = mesh(rg, smallRock); rm2.receiveShadow = true; grp.add(rm2);
  }
  // distant floating rocks for depth (no shadows)
  const farMat = new T.MeshStandardMaterial({ color: lin("#3a3360"), roughness: 1, flatShading: true });
  for (const [x, y, z, sx, sy] of [[-780, 140, -900, 120, 60], [820, 40, -1100, 170, 80], [-420, 380, -1400, 90, 45], [520, 330, -1250, 70, 36]]) {
    const g2 = new T.IcosahedronGeometry(1, 1), q = g2.attributes.position;
    for (let i = 0; i < q.count; i++) { v.set(q.getX(i), q.getY(i), q.getZ(i)); q.setXYZ(i, v.x * sx, (v.y > 0 ? v.y * 0.25 : v.y) * sy, v.z * sx * 0.5); }
    g2.computeVertexNormals();
    const m = mesh(g2, farMat, false); m.position.set(x, y, z); grp.add(m);
  }
  s.add(grp);
  R3.stage = grp;
}

/* ---------- fighter rig ---------- */
function rigKey(f) { return `${f.spec.id}|${f.pal.body}|${f.pal.accent}`; }
function rigDims(f) {
  const look = f.spec.look, w = f.s.w, h = f.s.h, leg = h * look.leg;
  const rx = w * 0.56, ry = (h - leg + 3) / 2;
  return { w, h, leg, rx, ry, rz: rx * 0.9, yC: (h - leg - 7) / 2, taper: look.costume === "samurai" ? 0.16 : 0.09 };
}
function buildRig(f) {
  const T = R3.T, spec = f.spec, look = spec.look, pal = f.pal, cos = look.costume, G = R3.G, M = R3.M;
  const B = rigDims(f), w = B.w, lvl = skinLvl(f);
  const rig = { key: rigKey(f), B, cos, lvl, mats: [], root: new T.Group(), face: 0, turn: 0, sq: 0, tint: "", expr: "", blink: 0, glow: [] };
  const own = (m) => { rig.mats.push({ m, c0: m.color.clone(), e0: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity }); return m; };
  const std = (hex, o) => own(new T.MeshStandardMaterial(Object.assign({ color: lin(hex), roughness: 0.7 }, o || {})));
  // hierarchy: root -> body (hip, lean/spin) -> mirror (facing) -> yaw -> bodyC (body centre)
  rig.body = new T.Group(); rig.mirror = new T.Group(); rig.yaw = new T.Group(); rig.bodyC = new T.Group();
  rig.root.add(rig.body); rig.body.add(rig.mirror); rig.mirror.add(rig.yaw); rig.yaw.add(rig.bodyC);
  const C = rig.bodyC;
  // a little emissive warmth stands in for light scattering through the skin
  rig.skin = own(new T.MeshStandardMaterial({ color: lin(pal.body), map: R3.tex.skin, bumpMap: R3.tex.skin, bumpScale: 0.45, roughness: 0.68, emissive: lin(pal.body), emissiveIntensity: 0.1 }));
  const body = mesh(bodyGeom(B), rig.skin); body.receiveShadow = true; C.add(body);
  const d = new T.Vector3(), o = new T.Vector3(), n = new T.Vector3();
  const put = (obj, az, el, k, out) => { dirAE(az, el, d); surf(B, d, k, o); surfN(B, d, n); obj.position.copy(o).addScaledVector(n, out || 0); orientTo(obj, n); return obj; };
  // eyes: each fighter gets its own eye shape (eager, narrowed, slit pupils, one eye under a patch)
  const er = w * 0.105, style = look.face;
  rig.eyes = [];
  let irisMat = M.iris;
  if (cos === "alchemist" && lvl >= 3) {
    irisMat = own(new T.MeshStandardMaterial({ color: lin(mix(pal.accent, "#7dff62", 0.55)), emissive: lin(mix(pal.accent, "#5dff4a", 0.6)), emissiveIntensity: 0.9, roughness: 0.2 }));
    rig.glow.push({ m: irisMat, base: 0.75, amp: 0.25, sp: 0.09 });
  } else if (cos === "dragon") irisMat = own(new T.MeshStandardMaterial({ color: lin("#e6a52a"), emissive: lin("#ff9a1f"), emissiveIntensity: 0.3, roughness: 0.2 }));
  else if (cos === "phoenix") irisMat = own(new T.MeshStandardMaterial({ color: lin("#8a3c12"), roughness: 0.15 }));
  const eyeK = style === "eager" ? 1.1 : 1, eyeH = style === "focused" ? 0.8 : 1;
  for (const s of [1, -1]) {
    if (cos === "odin" && s === -1) {
      // the Allfather's missing eye: a leather patch with a strap over the hair
      const leather = std("#2a1d18", { roughness: 0.7 });
      const patch = mesh(G.sph, leather, false); patch.scale.set(er * 1.08, er * 1.0, er * 0.3); put(patch, AZ0 - s * 0.25, EL_EYE, 1, er * 0.02); C.add(patch);
      const pd = dirAE(AZ0 - s * 0.25, EL_EYE, new T.Vector3()), q = new T.Vector3(0, 1, 0).addScaledVector(pd, -pd.y).normalize().applyAxisAngle(pd, 0.5), pts = [];
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; d.copy(pd).multiplyScalar(Math.cos(a)).addScaledVector(q, Math.sin(a)).normalize(); pts.push(surf(B, d, 1.07, new T.Vector3())); }
      C.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.9, 6, false), leather));
    } else {
      const eg = new T.Group();
      const sc = mesh(G.sph, M.sclera, false); sc.scale.set(er * eyeK, er * 1.16 * eyeK * eyeH, er * 0.62);
      const ir = mesh(G.sph, irisMat, false); ir.scale.set(er * 0.66 * eyeK, er * 0.72 * eyeK, er * 0.34); ir.position.set(er * 0.17, -er * 0.03, er * 0.42);
      const pu = mesh(G.sph, M.pupil, false);
      if (cos === "dragon") pu.scale.set(er * 0.13, er * 0.55, er * 0.2); else pu.scale.set(er * 0.38 * eyeK, er * 0.43 * eyeK, er * 0.2);
      pu.position.set(er * 0.2, -er * 0.03, er * 0.62);
      const gl = mesh(G.sphLo, M.glint, false); gl.scale.setScalar(er * 0.17); gl.position.set(er * 0.42, er * 0.32, er * 0.66);
      const gl2 = mesh(G.sphLo, M.glint, false); gl2.scale.setScalar(er * 0.08); gl2.position.set(er * 0.02, -er * 0.3, er * 0.7);
      eg.add(sc, ir, pu, gl, gl2);
      if (style === "focused" || style === "fierce") {
        // a heavy upper lid in skin colour narrows the eye into a determined squint
        const lid = mesh(G.sph, rig.skin, false); lid.scale.set(er * 1.12, er * 0.62, er * 0.7); lid.position.set(0, er * (style === "focused" ? 0.78 : 0.95), er * 0.05); lid.rotation.z = s * (style === "focused" ? 0.22 : 0.32);
        eg.add(lid);
      }
      put(eg, AZ0 - s * 0.25, EL_EYE, 1, -er * 0.28);
      C.add(eg); rig.eyes.push(eg);
    }
    // brows
    const bm = style === "stern" ? std("#efebe4", { roughness: 0.95 }) : style === "focused" ? std("#16110f", { roughness: 0.75 }) : std("#24160f", { roughness: 0.6 });
    const br = mesh(G.sph, bm, false);
    if (style === "stern") { br.scale.set(er * 1.25, er * 0.45, er * 0.5); put(br, AZ0 - s * 0.27, EL_EYE + 0.29, 1, er * 0.15); br.rotateZ(-s * 0.32); }
    else if (style === "evil") { br.scale.set(er * 1.15, er * 0.3, er * 0.34); put(br, AZ0 - s * 0.26, EL_EYE + 0.25, 1, er * 0.1); br.rotateZ(s * 0.5); }
    else if (style === "focused") { br.scale.set(er * 1.2, er * 0.32, er * 0.38); put(br, AZ0 - s * 0.26, EL_EYE + 0.2, 1, er * 0.12); br.rotateZ(s * 0.3); }
    else if (style === "fierce") { br.scale.set(er * 1.12, er * 0.28, er * 0.34); put(br, AZ0 - s * 0.27, EL_EYE + 0.23, 1, er * 0.1); br.rotateZ(s * 0.42); }
    else if (style === "eager") { br.scale.set(er * 0.9, er * 0.21, er * 0.26); put(br, AZ0 - s * 0.26, EL_EYE + 0.34, 1, er * 0.1); br.rotateZ(-s * 0.24); }
    else if (style === "kind") { br.scale.set(er * 0.95, er * 0.19, er * 0.26); put(br, AZ0 - s * 0.26, EL_EYE + 0.31, 1, er * 0.1); br.rotateZ(-s * 0.08); }
    else { br.scale.set(er * 0.95, er * 0.2, er * 0.26); put(br, AZ0 - s * 0.26, EL_EYE + 0.27, 1, er * 0.1); br.rotateZ(-s * 0.18); }
    C.add(br);
  }
  if (cos === "wizard") {
    // round gold-rimmed glasses
    const rim = std("#d8b04a", { roughness: 0.3, metalness: 0.75 }), ring = new T.TorusGeometry(er * 1.22, 0.75, 8, 28);
    for (const s of [1, -1]) { const g = mesh(ring, rim, false); put(g, AZ0 - s * 0.25, EL_EYE, 1, er * 0.42); C.add(g); }
    const pa = surf(B, dirAE(AZ0 - 0.25 + 0.17, EL_EYE + 0.02, d), 1.0, new T.Vector3()).addScaledVector(surfN(B, d, n), er * 0.42);
    const pb = surf(B, dirAE(AZ0 + 0.25 - 0.17, EL_EYE + 0.02, d), 1.0, new T.Vector3()).addScaledVector(surfN(B, d, n), er * 0.42);
    const bridge = mesh(G.cyl, rim, false); segTo(bridge, pa, pb, 0.7); C.add(bridge);
  }
  // face decal: mouth, cheeks, and the squinting eyes shown while hurt
  const fN = FACE.N, faceC = document.createElement("canvas"); faceC.width = faceC.height = fN;
  rig.faceCtx = faceC.getContext("2d");
  rig.faceTex = new T.CanvasTexture(faceC); rig.faceTex.encoding = T.sRGBEncoding; rig.faceTex.anisotropy = 4;
  const ps = Math.PI - (AZ0 + FACE.span / 2), ts = Math.PI / 2 - FACE.top;
  const fg = new T.SphereGeometry(1, 28, 22, ps, FACE.span, ts, FACE.hgt), fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++) { d.set(fp.getX(i), fp.getY(i), fp.getZ(i)).normalize(); surf(B, d, 1.012, o); fp.setXYZ(i, o.x, o.y, o.z); }
  fg.computeVertexNormals();
  const faceMat = own(new T.MeshStandardMaterial({ map: rig.faceTex, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const fm = mesh(fg, faceMat, false); fm.renderOrder = 1; C.add(fm);
  rig.faceStyle = look.face;
  // sprout on top
  const sprout = (x, y, z, s) => {
    const g = new T.Group();
    const stem = mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(new T.Vector3(0, -3 * s, 0), new T.Vector3(-1 * s, 4 * s, 0), new T.Vector3(0.8 * s, 7.5 * s, 0)), 8, 1.05 * s, 6), M.stem);
    const l1 = mesh(G.leaf, M.leaf); l1.scale.setScalar(8.5 * s); l1.position.set(0.6 * s, 7 * s, 0); l1.rotation.set(0.3, 0, 0.45);
    const l2 = mesh(G.leaf, M.leaf); l2.scale.setScalar(7.5 * s); l2.position.set(0.6 * s, 7 * s, 0); l2.rotation.set(-0.3, 0, Math.PI - 0.5);
    g.add(stem, l1, l2); g.position.set(x, y, z);
    return g;
  };
  const top = surf(B, d.set(0, 1, 0), 1, new T.Vector3());
  if (cos === "phoenix" || cos === "dragon") C.add(sprout(top.x - w * 0.02, top.y - 1, 0, 1));
  // limbs (in root space, driven by the 2D pose each frame)
  rig.limbMat = own(new T.MeshStandardMaterial({ color: lin("#22202b"), roughness: 0.42 }));
  const limb = (r, end) => {
    const L = { r, s1: mesh(G.cyl, rig.limbMat), s2: mesh(G.cyl, rig.limbMat), j0: mesh(G.sphLo, rig.limbMat), j1: mesh(G.sphLo, rig.limbMat), end: mesh(G.sph, rig.limbMat) };
    L.j0.scale.setScalar(r); L.j1.scale.setScalar(r); L.end.scale.set(end[0], end[1], end[2]); L.endS = end;
    rig.root.add(L.s1, L.s2, L.j0, L.j1, L.end);
    return L;
  };
  const lw = look.limbW, hand = look.fist ? 5.6 : 4.8;
  rig.legB = limb(Math.min(lw, 6) * 0.5, [5.2, 3.3, 4.4]); rig.legF = limb(Math.min(lw, 6) * 0.5, [5.6, 3.5, 4.6]);
  rig.armB = limb(Math.min(lw, 6) * 0.42, [hand, hand * 0.95, hand]); rig.armF = limb(Math.min(lw, 6) * 0.42, [hand, hand * 0.95, hand]);
  // costumes
  const acc = pal.accent;
  if (cos === "phoenix") {
    const wingMat = own(new T.MeshStandardMaterial({ vertexColors: true, emissive: lin(acc), emissiveIntensity: 0.4, roughness: 0.55, side: T.DoubleSide }));
    if (lvl >= 3) rig.glow.push({ m: wingMat, base: 0.5, amp: 0.22, sp: 0.35, fire: true });
    const base = lin(mix(acc, "#000000", 0.15)), mid = lin(acc), tip = lin(mix(acc, "#ffd27a", 0.65));
    const fg2 = G.feather.clone(), fpos = fg2.attributes.position, fcol = fg2.attributes.color, cc = new T.Color();
    for (let i = 0; i < fpos.count; i++) { const t = clamp(fpos.getX(i), 0, 1); cc.copy(base).lerp(mid, Math.min(1, t * 2)).lerp(tip, Math.max(0, t * 1.6 - 0.6)); fcol.setXYZ(i, cc.r, cc.g, cc.b); }
    rig.wings = [];
    // two wings behind the body, spreading to screen left and right with their faces to the camera
    // (in body space the camera sits at (sin YAW, 0, cos YAW))
    const Rv = new T.Vector3(Math.cos(YAW), 0, -Math.sin(YAW)), Fv = new T.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
    rig.wingAxes = { R: Rv, F: Fv };
    for (const sd of [-1, 1]) {
      const wg = new T.Group();
      for (let i = 0; i < 5; i++) {
        const k = 1 - Math.abs(i - 2) * 0.12, fm2 = mesh(fg2, wingMat);
        fm2.scale.set(k, 1.25, 1); fm2.rotation.z = (i - 2) * 0.27; fm2.position.z = -i * 0.012; fm2.rotation.x = (i - 2) * 0.1; // wing group is scaled by its length (~50), so this is ~0.6 units per feather
        wg.add(fm2);
      }
      wg.position.copy(Rv).multiplyScalar(sd < 0 ? -0.42 * B.rx : 0.36 * B.rx).addScaledVector(Fv, sd < 0 ? -0.35 * B.rz : -0.55 * B.rz).add(new T.Vector3(0, 0.05 * B.ry, 0));
      C.add(wg); rig.wings.push({ g: wg, s: sd });
    }
    rig.wingCfg = { lenG: 1.1, lenA: 1.3, elG: [0.58, 0.8], elA: [0.42, 0.72], flap: 1.1 };
    // a crest of flame feathers behind the sprout, and a short feather tail
    const crest = new T.Group();
    [[-1, 0.8], [0, 1], [1, 0.75]].forEach(([a, k]) => { const fm3 = mesh(fg2, wingMat); fm3.scale.set(k, 1.35, 1); fm3.rotation.z = Math.PI / 2 + 0.55 + a * 0.42; fm3.position.z = a * 0.1; crest.add(fm3); });
    crest.scale.setScalar(w * 0.42); crest.position.set(top.x - B.rx * 0.22, top.y - B.ry * 0.12, -B.rz * 0.05);
    C.add(crest);
    const ptail = new T.Group();
    [[-1, 0.75], [0, 1], [1, 0.75]].forEach(([a, k]) => { const fm3 = mesh(fg2, wingMat); fm3.scale.set(k, 1.2, 1); fm3.rotation.z = Math.PI + 0.42 + a * 0.3; fm3.position.z = a * 0.12; ptail.add(fm3); });
    ptail.scale.setScalar(w * 0.6); ptail.position.set(-B.rx * 0.78, -B.ry * 0.42, -B.rz * 0.2);
    C.add(ptail);
  }
  if (cos === "alchemist") {
    const hoodMat = std(acc, { roughness: 0.82, side: T.DoubleSide });
    const c = dirAE(AZ0, 0.08, new T.Vector3());
    const hole = ellipseR(0.86, 0.6);
    const keep = (dd) => Math.asin(clamp(dd.y, -1, 1)) > -0.36 - 0.42 * backness(dd);
    const hg = capGeom(B, c, hole, edgeFn(c, hole, keep, 0.22), 1.11, 64, 22);
    C.add(mesh(hg, hoodMat));
    const fr = hg.userData.frame, pts = [];
    for (let i = 0; i < 64; i++) { const psi = (i / 64) * Math.PI * 2; capPoint(fr.c, fr.e1, fr.e2, psi, hole(psi), d); pts.push(surf(B, d, 1.11, new T.Vector3())); }
    C.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 96, w * 0.055, 8, true), std(mix(acc, "#ffffff", 0.08), { roughness: 0.8 })));
    // a scarf wrap and a cape
    C.add(mesh(bandGeom(B, -0.62, -0.42, 1.07), std(mix(acc, "#000000", 0.25), { roughness: 0.85, side: T.DoubleSide })));
    rig.cape = makeCape(rig, B, std(mix(acc, "#000000", 0.18), { roughness: 0.85, side: T.DoubleSide }), false);
    C.add(sprout(top.x, top.y * 1.1, 0, 0.95));
    const brass = std("#b8863b", { roughness: 0.35, metalness: 0.7 });
    const lensMat = own(new T.MeshStandardMaterial({ color: lin("#8fe8d2"), emissive: lin("#3fd0a8"), emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.2 }));
    const gCyl = new T.CylinderGeometry(1, 1.12, 1, 18, 1); gCyl.rotateX(Math.PI / 2);
    for (const s of [1, -1]) {
      const gg = new T.Group();
      const tube = mesh(gCyl, brass); tube.scale.set(er * 0.66, er * 0.66, 3.4); tube.position.z = 1.7; gg.add(tube);
      const lens = mesh(G.sph, lensMat, false); lens.scale.set(er * 0.54, er * 0.54, 0.9); lens.position.z = 3.4; gg.add(lens);
      put(gg, AZ0 - s * 0.27, 0.86, 1.11, -0.5); C.add(gg);
    }
    const strap = mesh(new T.BoxGeometry(1, 1, 1), std("#3a2a22", { roughness: 0.8 })); strap.scale.set(er * 0.9, 1.6, 1.6); put(strap, AZ0, 0.87, 1.11, 0.6); C.add(strap);
    const glass = own(new T.MeshStandardMaterial({ color: lin("#e6f7ff"), transparent: true, opacity: 0.32, roughness: 0.05, depthWrite: false }));
    const cork = std("#8a5a32", { roughness: 0.9 });
    [["#7dff62", AZ0 + 0.6], ["#ff5fa2", AZ0 + 0.98], ["#ffb347", AZ0 - 0.72]].forEach(([colr, az]) => {
      const v = new T.Group(), liq = own(new T.MeshStandardMaterial({ color: lin(colr), emissive: lin(colr), emissiveIntensity: 0.45, roughness: 0.25 }));
      const lq = mesh(G.sph, liq, false); lq.scale.set(2.3, 2.6, 2.3); lq.position.y = -1.6; v.add(lq);
      const neck = mesh(G.cyl, glass, false); neck.scale.set(1.1, 3.4, 1.1); neck.position.y = 1.6; v.add(neck);
      const bulb = mesh(G.sph, glass, false); bulb.scale.set(2.7, 3.0, 2.7); bulb.position.y = -1.3; v.add(bulb);
      const ck = mesh(G.sphLo, cork, false); ck.scale.set(1.2, 1.4, 1.2); ck.position.y = 3.5; v.add(ck);
      put(v, az, -0.55, 1.07, 2.4); v.quaternion.identity(); C.add(v);
    });
    rig.orb = mesh(G.sph, M.orb, false); rig.orb.scale.setScalar(w * 0.15); rig.root.add(rig.orb);
  }
  if (cos === "odin") {
    const hairMat = std("#efebe4", { roughness: 0.95 }), metal = std("#2a2933", { roughness: 0.42, metalness: 0.55 });
    // hair: covers the top and back, open around the face
    const tp = new T.Vector3(0, 1, 0), none = () => 0;
    const keep = (dd) => { const bk = backness(dd); return Math.asin(clamp(dd.y, -1, 1)) > 0.66 - 0.62 * bk - 0.32 * bk * bk; };
    C.add(mesh(capGeom(B, tp, none, edgeFn(tp, none, keep, 0), 1.05, 56, 16), hairMat));
    // armour on the lower body, red belt with a gold buckle
    const bp = new T.Vector3(0, -1, 0);
    C.add(mesh(capGeom(B, bp, () => 0, (psi) => 1.27 + 0.05 * Math.cos(psi * 2), 1.04, 40, 10), metal));
    C.add(mesh(bandGeom(B, -0.62, -0.48, 1.07), std(acc, { roughness: 0.6, side: T.DoubleSide })));
    const buckle = mesh(new T.BoxGeometry(w * 0.16, w * 0.13, 2), M.gold); put(buckle, AZ0 - 0.15, -0.55, 1.08, 0.5); C.add(buckle);
    for (const az of [AZ0 + 0.6, AZ0 - 0.75]) { const rv = mesh(G.sphLo, M.gold, false); rv.scale.setScalar(1.6); put(rv, az, -0.95, 1.05, 0.3); C.add(rv); }
    if (lvl >= 3) {
      const runeMat = own(new T.MeshStandardMaterial({ color: lin(mix(acc, "#ffb347", 0.45)), emissive: lin(mix(acc, "#ffb347", 0.45)), emissiveIntensity: 0.8, roughness: 0.4 }));
      rig.glow.push({ m: runeMat, base: 0.75, amp: 0.35, sp: 0.07 });
      const bar = new T.BoxGeometry(1, 1, 1);
      // three simple runes, flush on the armour (strokes as [x, y, length, angle])
      const glyphs = [[[0, 0, 7, 0], [1.6, 1.6, 3.6, 0.8], [1.6, -0.6, 3.6, 0.8]], [[0, 0, 7, 0], [-1.4, 1.8, 3.6, 0.7], [1.4, 1.8, 3.6, -0.7]], [[0, 0, 7, 0], [-1.3, 2.3, 3.2, -0.75], [1.3, 2.3, 3.2, 0.75]]];
      [[AZ0 + 0.62, -0.62], [AZ0 - 0.72, -0.64], [AZ0 + 1.25, -0.58]].forEach(([az, el], k) => {
        const rg = new T.Group();
        for (const [x, y, len, ang] of glyphs[k]) { const m = mesh(bar, runeMat, false); m.scale.set(1.1, len * 1.4, 0.5); m.position.set(x * 1.4, y * 1.4, 0); m.rotation.z = ang; rg.add(m); }
        put(rg, az, el, 1.045, 0.25); C.add(rg);
      });
    }
    // nose, moustache, long beard
    const noseM = std(mix(pal.body, "#d0704a", 0.35), { roughness: 0.55 });
    const nose = mesh(G.sph, noseM); nose.scale.set(w * 0.12, w * 0.1, w * 0.11); put(nose, AZ0 - 0.02, 0.07, 1, w * 0.04); C.add(nose);
    const bg = new T.SphereGeometry(1, 24, 18), bpos = bg.attributes.position;
    for (let i = 0; i < bpos.count; i++) {
      const x = bpos.getX(i), y = bpos.getY(i), z = bpos.getZ(i), t = (y + 1) / 2;
      const wdt = 0.35 + 0.65 * Math.sqrt(t), wave = 1 + 0.05 * Math.sin(x * 9 + y * 3);
      bpos.setXYZ(i, x * wdt * wave, y - 0.2 * x * x * (1 - t), z * (0.55 + 0.45 * t));
    }
    bg.computeVertexNormals();
    const beard = mesh(bg, hairMat); beard.scale.set(w * 0.28, B.ry * 0.6, w * 0.15); put(beard, AZ0 - 0.02, -0.44, 1, -w * 0.02); C.add(beard);
    for (const s of [1, -1]) { const mu = mesh(G.sph, hairMat); mu.scale.set(w * 0.18, w * 0.07, w * 0.08); put(mu, AZ0 - 0.02 - s * 0.15, -0.08, 1, w * 0.03); mu.rotateZ(-s * 0.4); C.add(mu); }
    // a small winged helmet with a gold rim; the sprout pokes out of the top
    const helm = std("#8c93a3", { roughness: 0.32, metalness: 0.75 }), hr = 0.66;
    C.add(mesh(capGeom(B, tp, none, () => hr, 1.085, 40, 8), helm));
    const rimPts = [];
    for (let i = 0; i <= 48; i++) { capPoint(tp, new T.Vector3(1, 0, 0), new T.Vector3(0, 0, -1), (i / 48) * Math.PI * 2, hr, d); rimPts.push(surf(B, d, 1.09, new T.Vector3())); }
    C.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rimPts, true), 64, 1.5, 6, true), M.gold));
    const wingW = new T.MeshStandardMaterial({ color: lin("#f4f1ea"), roughness: 0.6, side: T.DoubleSide }); own(wingW);
    for (const s of [1, -1]) {
      const wg = new T.Group();
      [0, 1, 2].forEach((i) => { const fm3 = mesh(G.feather, wingW, false); fm3.scale.set(1 - i * 0.18, 1.5, 1); fm3.rotation.z = 0.25 + i * 0.32; fm3.position.y = -i * 0.05; wg.add(fm3); });
      wg.scale.setScalar(w * 0.36);
      put(wg, AZ0 + (s > 0 ? -1.45 : 1.45), 0.92, 1.08, 0); wg.quaternion.identity();
      wg.rotation.set(0, s > 0 ? 0.25 : -0.25, 0); wg.rotation.y += (s > 0 ? 0 : Math.PI);
      C.add(wg);
    }
    C.add(sprout(top.x + w * 0.02, top.y * 1.13, 0, 0.9));
    rig.cape = makeCape(rig, B, std(acc, { roughness: 0.75, side: T.DoubleSide }), true);
    rig.raven = makeRaven(); rig.raven.g.scale.setScalar(0.85);
    put(rig.raven.g, Math.PI * 0.78, 0.5, 1, 6); rig.raven.g.quaternion.identity(); rig.raven.g.rotation.y = -0.35;
    C.add(rig.raven.g);
  }
  if (cos === "wizard") {
    const hatMat = std(acc, { roughness: 0.85, side: T.DoubleSide }), band = std(mix(acc, "#000000", 0.35), { roughness: 0.8 });
    const hat = new T.Group(), Rb = B.rx * 0.78, H = B.ry * 1.35, prof = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new T.Vector2(Math.max(0.01, Rb * Math.pow(1 - t, 1.15)), t * H)); }
    const cone = new T.LatheGeometry(prof, 28), cp = cone.attributes.position;
    for (let i = 0; i < cp.count; i++) { const y = cp.getY(i), t = y / H; cp.setX(i, cp.getX(i) - Math.pow(t, 2.4) * H * 0.42); cp.setY(i, y - Math.pow(t, 4) * H * 0.18); }
    cone.computeVertexNormals();
    hat.add(mesh(cone, hatMat));
    const brimP = [new T.Vector2(Rb * 0.7, 0.5), new T.Vector2(B.rx * 1.42, -1.2), new T.Vector2(B.rx * 1.48, 0.6), new T.Vector2(B.rx * 1.4, 1.8), new T.Vector2(Rb * 0.95, 2.2)];
    hat.add(mesh(new T.LatheGeometry(brimP, 40), hatMat));
    const hb = mesh(new T.CylinderGeometry(Rb * 0.93, Rb * 1.0, H * 0.13, 28, 1, true), band); hb.position.y = H * 0.09; hat.add(hb);
    for (const [x, z, a] of [[-0.3, 0.75, 0.3], [0.25, 0.85, -0.4], [-0.55, 0.3, 0.9]]) { const lf = mesh(G.leaf, M.leaf); lf.scale.setScalar(7.5); lf.position.set(x * Rb, H * 0.18, z * Rb); lf.rotation.set(-0.3, a, 0.35); hat.add(lf); }
    const ht = surf(B, d.set(0, 1, 0), 1, new T.Vector3());
    hat.position.set(-B.rx * 0.04, ht.y * 0.66, 0); hat.rotation.z = 0.14; hat.rotation.x = 0.04;
    if (lvl >= 3) {
      const starMat = own(new T.MeshStandardMaterial({ color: lin("#ffe08a"), emissive: lin(mix(acc, "#ffd27a", 0.7)), emissiveIntensity: 0.95, roughness: 0.2 }));
      rig.stars = [];
      [[0.22, 0.6], [0.3, 1.5], [0.42, 0.95], [0.52, 1.9], [0.6, 0.4], [0.68, 1.25], [0.34, 2.4]].forEach(([t, ph], k) => {
        const r = Rb * Math.pow(1 - t, 1.15) * 1.04, st = mesh(G.oct, starMat, false), sc = 1.3 + (k % 3) * 0.35;
        st.position.set(Math.cos(ph) * r - Math.pow(t, 2.4) * H * 0.42, t * H - Math.pow(t, 4) * H * 0.18, Math.sin(ph) * r);
        st.scale.setScalar(sc); st.userData.sc = sc; hat.add(st); rig.stars.push(st);
      });
    }
    const moonS = new T.Shape(); moonS.absarc(0, 0, 1, Math.PI * 0.3, Math.PI * 1.7, false); moonS.absarc(0.45, 0, 0.78, Math.PI * 1.62, Math.PI * 0.38, true);
    const moon = mesh(new T.ExtrudeGeometry(moonS, { depth: 0.3, bevelEnabled: false, curveSegments: 16 }), std("#ffd66b", { roughness: 0.3, metalness: 0.6, emissive: lin("#ffb347"), emissiveIntensity: 0.25 }), false);
    moon.scale.setScalar(Rb * 0.26); moon.position.set(Math.cos(AZ0) * Rb * 1.0, H * 0.09, Math.sin(AZ0) * Rb * 1.0); moon.rotation.y = Math.PI / 2 - AZ0;
    hat.add(moon);
    C.add(hat);
    // a long robe over the lower body, hem trimmed in gold
    const robeC = new T.Vector3(0, -1, 0), robeEdge = (psi) => 1.02 + 0.05 * Math.cos(psi * 5);
    C.add(mesh(capGeom(B, robeC, () => 0, robeEdge, 1.045, 40, 10), std(mix(acc, "#000000", 0.25), { roughness: 0.85, side: T.DoubleSide })));
    const hemPts = [];
    for (let i = 0; i <= 64; i++) { const psi = (i / 64) * Math.PI * 2; capPoint(robeC, new T.Vector3(1, 0, 0), new T.Vector3(0, 0, 1), psi, robeEdge(psi), d); hemPts.push(surf(B, d, 1.05, new T.Vector3())); }
    C.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hemPts, true), 96, 1.2, 6, true), M.gold));
    rig.staff = mesh(G.cyl, std("#7a4a26", { roughness: 0.75 })); rig.root.add(rig.staff);
    rig.crystal = mesh(G.oct, M.crystal, false); rig.crystal.scale.set(5, 9, 5); rig.crystal.rotation.order = "ZYX"; rig.root.add(rig.crystal);
  }
  if (cos === "samurai") {
    const red = std("#c8352b", { roughness: 0.75, side: T.DoubleSide }), lacq = std("#24222c", { roughness: 0.35, metalness: 0.2, side: T.DoubleSide });
    C.add(mesh(bandGeom(B, 0.5, 0.64, 1.035), red));
    const knotH = mesh(G.sph, red); knotH.scale.set(3.4, 3, 3); put(knotH, Math.PI + 0.25, 0.57, 1.035, 1); C.add(knotH);
    for (const s of [1, -1]) { const tl = mesh(G.sph, red); tl.scale.set(1.8, 7, 1.1); put(tl, Math.PI + 0.25 + s * 0.1, 0.42, 1.04, 2.4); tl.rotateZ(s * 0.35 + 0.5); C.add(tl); }
    const bun = mesh(G.sph, std("#1c1714", { roughness: 0.6 })); bun.scale.set(w * 0.12, w * 0.1, w * 0.11); bun.position.set(top.x - w * 0.04, top.y + w * 0.04, 0); C.add(bun);
    const cord = mesh(new T.TorusGeometry(w * 0.08, 0.9, 6, 16), red, false); cord.rotation.x = Math.PI / 2; cord.position.set(top.x - w * 0.04, top.y + w * 0.01, 0); C.add(cord);
    C.add(sprout(top.x - w * 0.04, top.y + w * 0.12, 0, 0.85));
    // armour skirt (lacquered lames tied with red lacing)
    const skC = new T.Vector3(0, -1, 0), skEdge = () => 1.05;
    C.add(mesh(capGeom(B, skC, () => 0, skEdge, 1.035, 40, 10), lacq));
    for (const el of [-0.78, -1.0]) {
      const lp = [];
      for (let i = 0; i <= 64; i++) { dirAE((i / 64) * Math.PI * 2, el, d); lp.push(surf(B, d, 1.045, new T.Vector3())); }
      C.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(lp, true), 80, 0.7, 5, true), red));
    }
    // sheath at the hip, tilted back
    const saya = new T.Group(), sl = w * 1.35;
    const sb = mesh(G.cyl, lacq); sb.scale.set(2.4, sl, 2.4); sb.rotation.z = Math.PI / 2; saya.add(sb);
    const tip = mesh(G.sphLo, M.gold, false); tip.scale.set(2.6, 2.6, 2.6); tip.position.x = -sl / 2; saya.add(tip);
    const mouth = mesh(G.cyl, M.gold, false); mouth.scale.set(2.7, 2.2, 2.7); mouth.rotation.z = Math.PI / 2; mouth.position.x = sl / 2; saya.add(mouth);
    saya.position.set(-B.rx * 0.45, -B.ry * 0.38, -B.rz * 0.55); saya.rotation.z = 0.5;
    C.add(saya);
    const sash = std("#2a2833", { roughness: 0.8, side: T.DoubleSide });
    C.add(mesh(bandGeom(B, -0.5, -0.3, 1.04), sash));
    // katana: wrapped handle, gold guard, curved jade blade
    const k = new T.Group(), L = w * 1.35;
    const handle = mesh(G.cyl, std("#2b211c", { roughness: 0.8 })); handle.scale.set(1.9, 13, 1.9); handle.rotation.z = Math.PI / 2; handle.position.x = -3.5; k.add(handle);
    const guard = mesh(new T.CylinderGeometry(3.4, 3.4, 1.2, 18), M.gold); guard.rotation.z = Math.PI / 2; guard.position.x = 3; k.add(guard);
    const bs = new T.Shape(); bs.moveTo(4, 1.8); bs.quadraticCurveTo(L * 0.55, 3.6, L, 5.5); bs.quadraticCurveTo(L * 0.55, -0.6, 4, -1.8); bs.lineTo(4, 1.8);
    const blade = new T.ExtrudeGeometry(bs, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.35, bevelSegments: 1, curveSegments: 12 });
    blade.translate(0, 0, -0.3);
    const bladeMat = std(acc, { roughness: 0.22, metalness: 0.45, emissive: lin(acc), emissiveIntensity: 0.28 });
    if (lvl >= 3) rig.glow.push({ m: bladeMat, base: 0.6, amp: 0.2, sp: 0.22 });
    k.add(mesh(blade, bladeMat));
    rig.katana = k; rig.root.add(k);
  }
  if (cos === "dragon") {
    const memb = std(acc, { roughness: 0.6, side: T.DoubleSide });
    const boneOpt = lvl >= 3 ? { roughness: 0.45, emissive: lin(mix(acc, "#ffb347", 0.55)), emissiveIntensity: 0.7 } : { roughness: 0.5 };
    const bone = std(mix(acc, "#2a1a14", 0.45), boneOpt);
    if (lvl >= 3) rig.glow.push({ m: bone, base: 0.7, amp: 0.3, sp: 0.15 });
    // bat wing: leading edge up to the tip, scalloped trailing edge between three finger bones (unit length)
    const ws = new T.Shape();
    ws.moveTo(0, 0); ws.quadraticCurveTo(0.42, 0.44, 1, 0.42);
    ws.quadraticCurveTo(0.86, 0.22, 0.72, 0.08);
    ws.quadraticCurveTo(0.57, 0.13, 0.46, -0.02);
    ws.quadraticCurveTo(0.31, 0.03, 0.2, -0.1);
    ws.quadraticCurveTo(0.09, -0.02, 0, 0);
    const wgeo = new T.ShapeGeometry(ws, 10);
    const boneSeg = (grp, a, b, r) => {
      const m = mesh(G.cyl, bone), d = new T.Vector3(b[0] - a[0], b[1] - a[1], 0), l = d.length();
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.004); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.scale.set(r, l, r);
      grp.add(m);
      const j = mesh(G.sphLo, bone, false); j.position.set(b[0], b[1], 0.004); j.scale.setScalar(r * 1.3); grp.add(j);
    };
    const Rv = new T.Vector3(Math.cos(YAW), 0, -Math.sin(YAW)), Fv = new T.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
    rig.wingAxes = { R: Rv, F: Fv }; rig.wings = [];
    for (const sd of [-1, 1]) {
      const wg = new T.Group(), inner = new T.Group();
      inner.scale.y = sd; // the left wing is a mirror image, so its leading edge stays on top
      inner.add(mesh(wgeo, memb));
      boneSeg(inner, [0, 0], [0.5, 0.36], 0.022); boneSeg(inner, [0.5, 0.36], [1, 0.42], 0.016);
      for (const tip of [[0.72, 0.08], [0.46, -0.02], [0.2, -0.1]]) boneSeg(inner, [0.5, 0.36], tip, 0.011);
      wg.add(inner);
      wg.position.copy(Rv).multiplyScalar(sd < 0 ? -0.4 * B.rx : 0.34 * B.rx).addScaledVector(Fv, -0.5 * B.rz).add(new T.Vector3(0, -0.12 * B.ry, 0));
      C.add(wg); rig.wings.push({ g: wg, s: sd });
    }
    rig.wingCfg = { lenG: 0.95, lenA: 1.1, elG: [0.12, 0.2], elA: [0.32, 0.42], flap: 1.3 };
    // tapered tail lying behind on the ground, ending in a slight upturn
    const ground = -(B.yC + B.leg);
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(-0.45 * B.rx, -0.55 * B.ry, -0.1 * B.rz), new T.Vector3(-0.95 * B.rx, -0.88 * B.ry, -0.12 * B.rz),
      new T.Vector3(-1.45 * B.rx, ground + 3, -0.05 * B.rz), new T.Vector3(-1.95 * B.rx, ground + 5, 0.05 * B.rz), new T.Vector3(-2.2 * B.rx, ground + 9, 0.1 * B.rz),
    ]);
    const tN = 24, tg = new T.TubeGeometry(curve, tN, w * 0.15, 10, false), tp = tg.attributes.position, cpt = new T.Vector3(), v3 = new T.Vector3();
    for (let i = 0; i < tp.count; i++) {
      const ring = Math.floor(i / 11), t = ring / tN;
      curve.getPointAt(t, cpt); v3.set(tp.getX(i), tp.getY(i), tp.getZ(i)).sub(cpt).multiplyScalar(1 - 0.85 * t).add(cpt);
      tp.setXYZ(i, v3.x, v3.y, v3.z);
    }
    tg.computeVertexNormals();
    rig.tail = new T.Group(); rig.tail.add(mesh(tg, std(acc, { roughness: 0.6 })));
    rig.tail.position.set(-0.45 * B.rx, -0.55 * B.ry, -0.1 * B.rz);
    rig.tail.children[0].position.set(0.45 * B.rx, 0.55 * B.ry, 0.1 * B.rz); // pivot at the tail's root
    C.add(rig.tail);
    // horns curving back, a ridge of spikes down the back, a scaled belly
    const hornM = std("#efe3c8", { roughness: 0.4 });
    const hornG = new T.ConeGeometry(1, 1, 12, 8); hornG.translate(0, 0.5, 0);
    { const hp = hornG.attributes.position; for (let i = 0; i < hp.count; i++) { const y = hp.getY(i); hp.setX(i, hp.getX(i) - 0.55 * y * y); } hornG.computeVertexNormals(); }
    for (const s of [1, -1]) {
      const hn = mesh(hornG, hornM); hn.scale.set(w * 0.075, w * 0.34, w * 0.075);
      put(hn, AZ0 - s * 0.42, 0.98, 0.97, 0); hn.quaternion.identity(); hn.rotation.set(s * 0.22, 0, 0.35);
      C.add(hn);
    }
    const spikeG = new T.ConeGeometry(1, 1, 8); spikeG.rotateX(Math.PI / 2); spikeG.translate(0, 0, 0.5);
    const spikeM = std(mix(acc, "#2a1a14", 0.25), { roughness: 0.5 });
    [[1.05, 0.8], [0.7, 1], [0.32, 1.05], [-0.08, 0.95], [-0.45, 0.75]].forEach(([el, k]) => { const sp = mesh(spikeG, spikeM); sp.scale.set(3.6 * k, 3.6 * k, 8.5 * k); put(sp, Math.PI + 0.15, el, 0.98, 0); C.add(sp); });
    const bellyC = dirAE(AZ0 + 0.05, -0.78, new T.Vector3());
    C.add(mesh(capGeom(B, bellyC, () => 0, ellipseR(0.58, 0.42), 1.014, 40, 8), std(mix(pal.body, "#fff0c6", 0.45), { roughness: 0.6 })));
    const ridgeM = std(mix(pal.body, "#7a4a22", 0.4), { roughness: 0.6 });
    for (const el of [-0.55, -0.74, -0.93]) {
      const half = 0.5 * Math.sqrt(Math.max(0, 1 - ((el + 0.78) / 0.42) ** 2)) + 0.05, rp = [];
      for (let i = 0; i <= 12; i++) { dirAE(AZ0 + 0.05 - half + (2 * half * i) / 12, el, d); rp.push(surf(B, d, 1.02, new T.Vector3())); }
      C.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rp), 24, 0.6, 5, false), ridgeM));
    }
    // white claws on hands and feet
    const clawM = std("#f3ede2", { roughness: 0.35 });
    for (const L of [rig.armF, rig.armB]) for (const z of [-0.38, 0, 0.38]) {
      const cl = mesh(G.cone, clawM, false); cl.scale.set(0.2, 0.62, 0.2); cl.position.set(0.95, -0.42, z * 1.1); cl.rotation.z = -1.95; L.end.add(cl);
    }
    for (const L of [rig.legF, rig.legB]) for (const z of [-0.45, 0, 0.45]) {
      const cl = mesh(G.cone, clawM, false); cl.scale.set(0.14, 0.5, 0.26); cl.position.set(1.15, 0.12, z * 1.1); cl.rotation.z = -Math.PI / 2; L.end.add(cl);
    }
  }
  if (rig.cape) C.add(rig.cape.mesh);
  return rig;
}
function makeCape(rig, B, mat, long) {
  const T = R3.T, nx = 10, ny = 8, g = new T.BufferGeometry();
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3), idx = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const a = i * (ny + 1) + j, b = (i + 1) * (ny + 1) + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setIndex(idx);
  const cape = { mesh: mesh(g, mat), nx, ny, long, B };
  updateCape(cape, 0, 0);
  return cape;
}
function updateCape(cape, sway, tk) {
  const { B, nx, ny, long } = cape, p = cape.mesh.geometry.attributes.position;
  const yTop = B.ry * (long ? 0.42 : 0.55), yBot = -(B.yC + (long ? 9 : 5));
  for (let i = 0; i <= nx; i++) {
    const az = Math.PI - 1.0 + (2.0 * i) / nx;
    for (let j = 0; j <= ny; j++) {
      const t = j / ny, y = yTop + (yBot - yTop) * t, e = clamp(y / B.ry, -1, 1);
      const rr = Math.max(Math.sqrt(1 - e * e), 0.62) * 1.1 + t * t * 0.18;
      const fl = Math.sin(tk * 0.2 + i * 0.7) * t * 1.2;
      p.setXYZ(i * (ny + 1) + j, Math.cos(az) * B.rx * rr + sway * 1.5 * Math.pow(t, 1.5), y, Math.sin(az) * B.rz * rr + fl);
    }
  }
  p.needsUpdate = true;
  cape.mesh.geometry.computeVertexNormals();
  cape.mesh.geometry.computeBoundingSphere();
}
function makeRaven() {
  const T = R3.T, G = R3.G, M = R3.M, g = new T.Group();
  const body = mesh(G.sph, M.raven); body.scale.set(9, 6.4, 5.6); body.rotation.z = 0.15; g.add(body);
  const head = mesh(G.sph, M.raven); head.scale.setScalar(4.6); head.position.set(7, 5, 0); g.add(head);
  const beak = mesh(G.cone, M.beak); beak.scale.set(1.7, 6.5, 1.5); beak.rotation.z = -Math.PI / 2 - 0.12; beak.position.set(13.2, 4.2, 0); g.add(beak);
  for (const s of [1, -1]) { const e = mesh(G.sphLo, M.redEye, false); e.scale.setScalar(0.95); e.position.set(9.2, 6.2, s * 3.4); g.add(e); }
  const tail = mesh(G.cone, M.ravenDark); tail.scale.set(3.5, 11, 1.4); tail.rotation.z = Math.PI / 2 + 0.35; tail.position.set(-12, -2.5, 0); g.add(tail);
  const wings = [];
  for (const s of [1, -1]) {
    const piv = new T.Group(); piv.position.set(-0.5, 2.5, s * 4.6);
    const wm = mesh(G.sph, M.ravenDark); wm.scale.set(9, 1.2, 4.8); wm.position.set(-3.5, 0, s * 3.2); wm.rotation.y = s * 0.25;
    piv.add(wm); g.add(piv); wings.push(piv);
  }
  return { g, wings };
}
function disposeObj(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (!m.userData.shared) { if (m.map && !(m.map.userData && m.map.userData.shared)) m.map.dispose(); m.dispose(); }
  });
}

/* face decal drawing: canvas x/y map to azimuth/elevation on the body */
function drawFaceDecal(rig, expr) {
  const c = rig.faceCtx, N = FACE.N, B = rig.B, w = B.w, style = rig.faceStyle;
  const U = (az) => ((AZ0 + FACE.span / 2 - az) / FACE.span) * N, V = (el) => ((FACE.top - el) / FACE.hgt) * N;
  const kx = N / FACE.span / ((B.rx + B.rz) / 2), ky = N / FACE.hgt / B.ry; // canvas px per world unit
  c.clearRect(0, 0, N, N);
  c.lineCap = "round"; c.lineJoin = "round";
  const er = w * 0.105;
  // cheeks
  c.fillStyle = `rgba(255,96,110,${style === "focused" || style === "fierce" ? 0.22 : 0.42})`;
  for (const s of [1, -1]) { c.beginPath(); c.ellipse(U(AZ0 - s * 0.47), V(EL_EYE - 0.3), er * 1.0 * kx, er * 0.62 * ky, 0, 0, Math.PI * 2); c.fill(); }
  if (expr === "hurt") {
    c.strokeStyle = "#1a0f0c"; c.lineWidth = 2.4 * kx * 0.45;
    for (const s of [1, -1]) {
      const x = U(AZ0 - s * 0.25), y = V(EL_EYE), a = er * 0.75 * kx, b = er * 0.65 * ky;
      c.beginPath(); c.moveTo(x - s * a, y - b); c.lineTo(x + s * a * 0.7, y); c.lineTo(x - s * a, y + b); c.stroke();
    }
  }
  if (style === "stern") { rig.faceTex.needsUpdate = true; return; }
  const mx = U(AZ0 - 0.02), my = V(-0.12), ew = er * kx, eh = er * ky;
  c.strokeStyle = "#2a130d";
  if (style === "fierce") {
    // nostrils
    c.fillStyle = "#3a1c10";
    for (const s of [1, -1]) { c.beginPath(); c.ellipse(mx + s * ew * 0.32, my - eh * 0.95, ew * 0.11, eh * 0.07, s * 0.4, 0, Math.PI * 2); c.fill(); }
  }
  if (expr === "open" || expr === "hurt") {
    c.beginPath(); c.ellipse(mx, my + eh * 0.15, ew * 0.8, eh * (expr === "hurt" ? 0.5 : 0.72), 0, 0, Math.PI * 2);
    c.fillStyle = "#5a1a14"; c.fill(); c.lineWidth = 1.4 * kx * 0.5; c.stroke();
    c.fillStyle = "#e0606a"; c.beginPath(); c.ellipse(mx, my + eh * 0.42, ew * 0.45, eh * 0.22, 0, 0, Math.PI * 2); c.fill();
  } else if (style === "evil") {
    c.beginPath(); c.moveTo(mx - ew * 1.45, my - eh * 0.35); c.quadraticCurveTo(mx, my + eh * 1.45, mx + ew * 1.45, my - eh * 0.35);
    c.quadraticCurveTo(mx, my + eh * 0.25, mx - ew * 1.45, my - eh * 0.35);
    c.fillStyle = "#fffaf0"; c.fill(); c.lineWidth = 1.5 * kx * 0.5; c.stroke();
    c.lineWidth = 0.9 * kx * 0.5;
    for (const t of [-0.55, 0, 0.55]) { c.beginPath(); c.moveTo(mx + t * ew, my + eh * 0.12 - Math.abs(t) * eh * 0.15); c.lineTo(mx + t * ew, my + eh * 0.72 - Math.abs(t) * eh * 0.3); c.stroke(); }
  } else if (style === "eager") {
    // wide open grin with a tongue
    c.save();
    c.beginPath(); c.moveTo(mx - ew * 1.15, my - eh * 0.4); c.quadraticCurveTo(mx, my + eh * 1.55, mx + ew * 1.15, my - eh * 0.4); c.closePath();
    c.fillStyle = "#5a1a14"; c.fill(); c.clip();
    c.fillStyle = "#e0606a"; c.beginPath(); c.ellipse(mx, my + eh * 0.75, ew * 0.6, eh * 0.38, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#fffaf0"; c.fillRect(mx - ew * 1.2, my - eh * 0.5, ew * 2.4, eh * 0.28);
    c.restore();
    c.lineWidth = 1.5 * kx * 0.5;
    c.beginPath(); c.moveTo(mx - ew * 1.15, my - eh * 0.4); c.quadraticCurveTo(mx, my + eh * 1.55, mx + ew * 1.15, my - eh * 0.4); c.closePath(); c.stroke();
  } else if (style === "focused") {
    // firm, slightly downturned line
    c.lineWidth = 2 * kx * 0.5;
    c.beginPath(); c.moveTo(mx - ew * 0.75, my + eh * 0.05); c.quadraticCurveTo(mx, my - eh * 0.2, mx + ew * 0.75, my + eh * 0.05); c.stroke();
  } else if (style === "fierce") {
    // lopsided smirk with one fang
    c.lineWidth = 1.9 * kx * 0.5;
    c.beginPath(); c.moveTo(mx - ew * 1.05, my - eh * 0.2); c.quadraticCurveTo(mx - ew * 0.1, my + eh * 0.55, mx + ew * 1.1, my - eh * 0.62); c.stroke();
    const fx0 = mx + ew * 0.42, fy0 = my + eh * 0.12;
    c.fillStyle = "#fffaf0"; c.beginPath(); c.moveTo(fx0 - ew * 0.17, fy0 - eh * 0.04); c.lineTo(fx0 - ew * 0.02, fy0 + eh * 0.42); c.lineTo(fx0 + ew * 0.16, fy0 - eh * 0.1); c.closePath(); c.fill();
    c.lineWidth = 0.8 * kx * 0.5; c.stroke();
  } else if (style === "kind") {
    // a small, warm half-smile
    c.lineWidth = 1.8 * kx * 0.5;
    c.beginPath(); c.arc(mx + ew * 0.12, my - eh * 0.55, ew * 0.85, 0.45, Math.PI - 0.7); c.stroke();
  } else {
    c.lineWidth = 1.9 * kx * 0.5;
    c.beginPath(); c.arc(mx, my - eh * 0.75, ew * 1.05, 0.4, Math.PI - 0.4); c.stroke();
  }
  rig.faceTex.needsUpdate = true;
}

/* ---------- per-frame rig update ---------- */
const _v = [];
function tv(i) { return _v[i] || (_v[i] = new R3.T.Vector3()); }
let _m4 = null;
function tm4() { return _m4 || (_m4 = new R3.T.Matrix4()); }
function limbMid(a, b, len, bend) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dd = Math.hypot(dx, dy) || 1, half = len / 2;
  let mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (dd < len) {
    const off = Math.sqrt(Math.max(0, half * half - (dd / 2) * (dd / 2)));
    let nx = -dy / dd, ny = dx / dd;
    if (bend === "fwd" ? nx < 0 : ny < 0) { nx = -nx; ny = -ny; }
    mid = [mid[0] + nx * off, mid[1] + ny * off];
  }
  return mid;
}
function segTo(m, a, b, r) {
  const dir = tv(30).subVectors(b, a), len = dir.length();
  m.position.addVectors(a, b).multiplyScalar(0.5);
  if (len > 1e-4) m.quaternion.setFromUnitVectors(tv(31).set(0, 1, 0), dir.multiplyScalar(1 / len));
  m.scale.set(r, Math.max(len, 0.01), r);
}
function syncRig(rig, f, P, tk, at) {
  const T = R3.T, B = rig.B, fc = f.facing, h = P.h;
  const toR = (p, z, out) => {
    let x = p[0], y = p[1];
    if (P.spin) { const cy = -h * 0.5, dx = x, dy = y - cy, cs = Math.cos(P.spin), sn = Math.sin(P.spin); x = dx * cs - dy * sn; y = cy + dx * sn + dy * cs; }
    return out.set(x * fc, -y, z);
  };
  rig.root.position.set(at ? at[0] : f.x, at ? -at[1] : -f.y, 0);
  // body
  toR(P.hip, 0, rig.body.position);
  rig.body.rotation.z = -fc * (P.spin + P.lean);
  rig.mirror.scale.x = fc;
  if (rig.face !== fc) { if (rig.face) rig.turn = 1; rig.face = fc; }
  rig.yaw.rotation.y = -(YAW + (Math.PI / 2 - YAW) * rig.turn);
  rig.turn = Math.max(0, rig.turn - 0.22);
  const st = f.state;
  const sqT = st === "land" || st === "jumpsquat" ? 0.12 : st === "air" && f.vy < -5 ? -0.06 : 0;
  rig.sq += (sqT - rig.sq) * 0.35;
  rig.bodyC.scale.set(1 + rig.sq * 0.6, 1 - rig.sq, 1 + rig.sq * 0.6);
  rig.bodyC.position.y = B.yC - B.ry * rig.sq;
  // limbs
  const legLen = Math.max(P.leg * 1.25, 12), armLen = P.tor * 0.85, rz = B.rz;
  const shR = rot(P.sh, P.hip, P.lean), shB = rot(P.shB, P.hip, P.lean);
  const setLimb = (L, a, b, len, bend, za, zm, zb, isFoot) => {
    const m = limbMid(a, b, len, bend);
    const A = toR(a, za, tv(0)), Mi = toR(m, zm, tv(1)), E = toR(isFoot ? [b[0] + 2, b[1] - 1] : b, zb, tv(2)), Bp = toR(b, zb, tv(3));
    segTo(L.s1, A, Mi, L.r); segTo(L.s2, Mi, Bp, L.r);
    L.j0.position.copy(A); L.j1.position.copy(Mi); L.end.position.copy(E);
    L.end.scale.set(L.endS[0] * fc, L.endS[1], L.endS[2]);
  };
  setLimb(rig.legB, P.hipB, P.fB, legLen, "fwd", -rz * 0.35, -rz * 0.38, -rz * 0.4, true);
  setLimb(rig.legF, P.hipF, P.fF, legLen, "fwd", rz * 0.35, rz * 0.38, rz * 0.4, true);
  setLimb(rig.armB, shB, P.hB, armLen, "down", -rz * 0.5, -rz * 0.72, -rz * 0.8, false);
  setLimb(rig.armF, shR, P.hF, armLen, "down", rz * 0.5, rz * 0.78, rz * 0.88, false);
  // eyes: blink now and then, hide while hurt
  const hurt = st === "hitstun";
  rig.blink = rig.blink > 0 ? rig.blink - 1 : ((tk + f.slot * 97) % 211 === 0 ? 7 : 0);
  const ey = rig.blink > 0 ? 0.12 : 1;
  for (const e of rig.eyes) { e.visible = !hurt; e.scale.y = ey; }
  const expr = hurt ? "hurt" : P.mouth > 0.5 ? "open" : "rest";
  if (rig.expr !== expr) { rig.expr = expr; drawFaceDecal(rig, expr); }
  // costume animation
  const cos = rig.cos;
  if (rig.wings) {
    const air = !f.grounded && st !== "ledge", wc = rig.wingCfg, len = B.w * (air ? wc.lenA : wc.lenG);
    const { R: Rv, F: Fv } = rig.wingAxes;
    for (const W of rig.wings) {
      // back wing / front wing elevation; flapping lifts both
      const el = (air ? wc.elA : wc.elG)[W.s < 0 ? 0 : 1] + P.flap * wc.flap;
      // x axis = spread direction, z axis = wing surface normal (facing the camera)
      const dx = tv(10).copy(Rv).multiplyScalar(W.s * Math.cos(el)).add(tv(13).set(0, Math.sin(el), 0)).addScaledVector(Fv, -0.2).normalize();
      const nz = tv(11).copy(Fv).addScaledVector(dx, -dx.dot(Fv)).normalize();
      const yy = tv(12).crossVectors(nz, dx);
      W.g.quaternion.setFromRotationMatrix(tm4().makeBasis(dx, yy, nz));
      W.g.scale.setScalar(len);
    }
  }
  if (rig.tail) { rig.tail.rotation.y = Math.sin(tk * 0.07 + f.slot) * 0.16; rig.tail.rotation.z = (f.grounded ? 0 : 0.25) + Math.sin(tk * 0.11) * 0.04; }
  if (rig.cape) updateCape(rig.cape, Math.sin(tk * 0.12 + f.slot) * 2 - clamp((f.vx + f.kbx) * fc * 0.8, -8, 8), tk);
  if (rig.raven) {
    rig.raven.g.visible = !f._ravenOut;
    const fl = Math.sin(tk * 0.08) > 0.95 ? 0.6 : 0.05;
    rig.raven.wings[0].rotation.x = -fl; rig.raven.wings[1].rotation.x = fl;
  }
  const flash = f.flash > 0 && f.flash % 2 === 0;
  if (rig.orb) {
    rig.orb.visible = f.specCd <= 0 && !flash;
    toR([P.hF[0] + 2, P.hF[1] - 4], rz * 0.95, rig.orb.position);
  }
  const held = (rest) => heldDir(f, P, shR, rest);
  if (rig.staff) {
    const a = held(-Math.PI / 2 + 0.12), dx = Math.cos(a), dy = Math.sin(a), [hx, hy] = P.hF;
    const b = toR([hx - dx * 34, hy - dy * 34], rz * 0.95, tv(4)), t = toR([hx + dx * 40, hy + dy * 40], rz * 0.95, tv(5));
    segTo(rig.staff, b, t, 1.9);
    rig.crystal.position.copy(t); rig.crystal.rotation.set(0, tk * 0.05, -fc * (a + P.spin + Math.PI / 2));
  }
  if (rig.katana) {
    const a = held(-0.8);
    toR(P.hF, rz * 1.0, rig.katana.position);
    rig.katana.scale.x = fc; rig.katana.rotation.z = -fc * (a + P.spin);
  }
  // tint: hit flash, dodge and invincibility glow, helpless dim
  let ghost = 0;
  if (intangible(f) && st !== "respawn" && st !== "getup") ghost = (tk >> 2) % 2 ? 0.5 : 0.3;
  if (st === "dodge" && f.st >= 3 && f.st <= (f.dodgeKind === "air" ? 20 : 16)) ghost = 0.55;
  const tint = `${flash ? 1 : 0}|${ghost}|${P.dim ? 1 : 0}`;
  const plain = tint === "0|0|0";
  if (rig.tint !== tint) {
    rig.tint = tint;
    for (const s of rig.mats) {
      s.m.color.copy(s.c0); if (P.dim) s.m.color.multiplyScalar(0.55);
      if (!s.e0) continue;
      if (flash) { s.m.emissive.setRGB(1, 1, 1); s.m.emissiveIntensity = 0.9; }
      else if (ghost) { s.m.emissive.setRGB(0.55, 0.65, 1); s.m.emissiveIntensity = ghost; }
      else { s.m.emissive.copy(s.e0); s.m.emissiveIntensity = s.ei; }
    }
  }
  if (plain) {
    const flare = skinState[f.slot] ? skinState[f.slot].flare : 0;
    for (const gl of rig.glow) {
      let v = gl.base + gl.amp * Math.sin(tk * gl.sp + f.slot);
      if (gl.fire) v += 0.12 * Math.sin(tk * 1.27 + 2) + flare * 0.03;
      gl.m.emissiveIntensity = v;
    }
  }
  if (rig.stars) rig.stars.forEach((st, k) => st.scale.setScalar(st.userData.sc * (0.55 + 0.45 * Math.abs(Math.sin(tk * 0.09 + k * 1.9)))));
}
function r3Fighters(g, tk, poses) {
  g.fighters.forEach((f, i) => {
    let rig = R3.rigs[i];
    if (!rig || rig.key !== rigKey(f)) {
      if (rig) { R3.scene.remove(rig.root); disposeObj(rig.root); }
      rig = R3.rigs[i] = buildRig(f);
      R3.scene.add(rig.root);
    }
    const P0 = poses[i];
    rig.root.visible = !!P0;
    if (P0) syncRig(rig, f, P0, tk);
    // respawn platform
    let rp = R3.respawn[i];
    if (!rp) {
      const T = R3.T;
      rp = R3.respawn[i] = mesh(new T.CylinderGeometry(40, 34, 8, 28), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4 }));
      R3.scene.add(rp);
    }
    rp.visible = f.state === "respawn";
    if (rp.visible) { rp.material.color.copy(lin(col(f.pal))); rp.material.emissive.copy(rp.material.color); rp.position.set(f.x, -f.y - 4, 0); rp.scale.z = 0.45; }
  });
}
function r3Projectiles(g, tk) {
  const T = R3.T, used = { orb: 0, bolt: 0, raven: 0 };
  for (const p of g.projs) {
    const kind = p.style === "orb" || p.style === "bolt" || p.style === "raven" ? p.style : null;
    if (!kind) continue;
    const pool = R3.proj[kind], k = used[kind]++;
    let o = pool[k];
    if (!o) {
      if (kind === "orb") o = mesh(R3.G.sph, R3.M.orb);
      else if (kind === "bolt") { o = mesh(R3.G.oct, R3.M.crystal); o.rotation.order = "ZYX"; }
      else { const rv = makeRaven(); o = rv.g; o.userData.wings = rv.wings; }
      pool.push(o); R3.scene.add(o);
    }
    o.visible = true;
    o.position.set(p.x, -p.y, 0);
    if (kind === "orb") o.scale.setScalar(p.r * 0.9);
    else if (kind === "bolt") { o.scale.set(p.r * 1.15, p.r * 0.55, p.r * 0.55); o.rotation.set(tk * 0.3, 0, Math.atan2(-p.vy, p.vx)); }
    else {
      const s = p.vx >= 0 ? 1 : -1, fl = Math.sin(tk * 0.6) * 0.7;
      o.scale.set(1.25 * s, 1.25, 1.25); o.rotation.y = s * 0.3;
      o.userData.wings[0].rotation.x = -fl - 0.2; o.userData.wings[1].rotation.x = fl + 0.2;
    }
  }
  for (const kind of Object.keys(R3.proj)) for (let k = used[kind]; k < R3.proj[kind].length; k++) R3.proj[kind][k].visible = false;
}
function r3Camera(camObj, cx, cy, viewH, aspect) {
  const D = viewH / 2 / Math.tan((R3.fov * Math.PI) / 360);
  camObj.aspect = aspect; camObj.near = Math.max(20, D - 1600); camObj.far = D + 2600;
  camObj.position.set(cx, -cy, D);
  camObj.updateProjectionMatrix();
}

/* ---------- small views: card previews, online screen, off-screen bubbles ---------- */
function r3PreviewScene() {
  const T = R3.T, s = new T.Scene();
  r3Lights(s, false);
  R3.pv = { scene: s, cam: new T.PerspectiveCamera(R3.fov, 1, 20, 4000) };
}
function r3View(scene, camObj, dst, cw, ch) {
  // render into the bottom-left corner of the GL canvas, then copy into dst
  const r = R3.renderer, k = Math.min(1, L.gw / cw, L.gh / ch), vw = Math.max(1, Math.floor(cw * k)), vh = Math.max(1, Math.floor(ch * k));
  r.setScissorTest(true); r.setViewport(0, 0, vw, vh); r.setScissor(0, 0, vw, vh);
  r.setClearColor(0x000000, 0); r.render(scene, camObj);
  const pr = R3.pr, sw = Math.floor(vw * pr), sh = Math.floor(vh * pr);
  const c = dst.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, dst.width, dst.height);
  c.drawImage(glcv, 0, glcv.height - sh, sw, sh, 0, 0, dst.width, dst.height);
}
function r3Preview(dst, f, tk, fit, bottom) {
  const cw = dst.clientWidth, ch = dst.clientHeight;
  if (!cw || !ch) return;
  const w = Math.round(cw * DPR), h = Math.round(ch * DPR);
  if (dst.width !== w || dst.height !== h) { dst.width = w; dst.height = h; }
  let e = R3.pvRigs.get(f);
  if (!e || e.rig.key !== rigKey(f)) {
    if (e) { R3.pv.scene.remove(e.rig.root); disposeObj(e.rig.root); }
    e = { rig: buildRig(f), used: 0 };
    R3.pvRigs.set(f, e); R3.pv.scene.add(e.rig.root);
  }
  e.used = R3.frame;
  for (const [, o] of R3.pvRigs) o.rig.root.visible = o === e;
  syncRig(e.rig, f, pose(f, tk), tk, [0, 0]);
  const hh = f.s.h, viewH = hh / fit;
  r3Camera(R3.pv.cam, 0, -((bottom - 0.5) * viewH), viewH, cw / ch);
  r3View(R3.pv.scene, R3.pv.cam, dst, cw, ch);
}
function r3Previews(tk) {
  if (mode === "select") for (const a of cardArt) r3Preview(a.cv, a.f, tk, artFit(a), a.bottom || 0.97);
  if (mode === "online") { const cvA = $("onArt"), f = onlineArtFighter(); if (cvA && f) r3Preview(cvA, f, tk, 0.8, 0.92); }
  // forget rigs for cards that no longer exist
  for (const [f, e] of R3.pvRigs) if (R3.frame - e.used > 90) { R3.pv.scene.remove(e.rig.root); disposeObj(e.rig.root); R3.pvRigs.delete(f); }
}
function r3Bubbles(g) {
  const out = [null, null];
  for (const f of g.fighters) {
    if (f.state === "dead" || f.state === "gone") continue;
    const [sx, sy] = toScreen(f.x, f.y - f.s.h * 0.5), m = 6;
    if (sx > m && sx < L.gw - m && sy > m && sy < L.gh - m) continue;
    const R = 28, size = R * 2;
    let c = R3.bub[f.slot];
    if (!c) c = R3.bub[f.slot] = document.createElement("canvas");
    const px = Math.round(size * DPR);
    if (c.width !== px) { c.width = px; c.height = px; }
    const hh = f.s.h, viewH = hh * 1.33;
    if (!R3.bubCam) R3.bubCam = new R3.T.PerspectiveCamera(R3.fov, 1, 20, 4000);
    r3Camera(R3.bubCam, f.x, f.y - hh * 0.5 + hh * 0.087, viewH, 1);
    r3View(R3.scene, R3.bubCam, c, size, size);
    out[f.slot] = c;
  }
  return out;
}

/* ---------- overlay drawing (2D, in world space) ---------- */
function drawFighterFx(c, f, tk, P) {
  const look = f.spec.look, cos = look.costume, flash = f.flash > 0 && f.flash % 2 === 0;
  c.save(); c.translate(f.x, f.y); c.scale(f.facing, 1);
  if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
  const shR = rot(P.sh, P.hip, P.lean);
  if (cos === "wizard") {
    const a = heldDir(f, P, shR, -Math.PI / 2 + 0.12), t = [P.hF[0] + Math.cos(a) * 40, P.hF[1] + Math.sin(a) * 40], fl = 1 + Math.sin(tk * 0.3) * 0.08;
    P.staffTip = t;
    const gl = c.createRadialGradient(t[0], t[1], 1, t[0], t[1], 18 * fl);
    gl.addColorStop(0, "rgba(255,226,140,0.7)"); gl.addColorStop(1, "rgba(255,200,90,0)");
    c.fillStyle = gl; c.beginPath(); c.arc(t[0], t[1], 18 * fl, 0, Math.PI * 2); c.fill();
  }
  if (cos === "alchemist" && f.specCd <= 0 && !flash) {
    const x = P.hF[0] + 2, y = P.hF[1] - 4, r = P.w * 0.15, fl = 1 + Math.sin(tk * 0.25) * 0.08;
    const gl = c.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6 * fl);
    gl.addColorStop(0, "rgba(140,255,120,0.5)"); gl.addColorStop(1, "rgba(80,255,90,0)");
    c.fillStyle = gl; c.beginPath(); c.arc(x, y, r * 2.6 * fl, 0, Math.PI * 2); c.fill();
  }
  if (f.armorFlash > 0 || (BL.armored(f) && tk % 6 < 3)) {
    c.strokeStyle = "rgba(255,240,200,0.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -P.h * 0.5, P.w * 0.9, P.h * 0.62, 0, 0, Math.PI * 2); c.stroke();
  }
  if (P.swoosh) {
    const S = P.swoosh, m = f.move;
    c.globalAlpha = S.heavy ? 0.75 : 0.55;
    c.strokeStyle = f.pal.accent; c.lineCap = "round";
    if (S.fire) { c.globalAlpha = 1; drawFlame(c, P, S, tk); }
    else if (m && m.zap) { c.globalAlpha = 1; drawZap(c, [P.hF[0], P.hF[1] - 4], S, tk, skinLvl(f) >= 3 ? f.pal.accent : null); }
    else if (m && m.magic) { c.globalAlpha = 0.95; drawMagic(c, P.staffTip || P.hF, S, tk); }
    else drawSwoosh(c, f, P, S);
  }
  c.restore();
}
function drawProjFx(c, p, tk) {
  if (p.style === "orb") {
    for (let i = 3; i >= 1; i--) { c.fillStyle = `rgba(120,255,110,${0.12 * (4 - i)})`; c.beginPath(); c.arc(p.x - p.vx * i * 1.6, p.y - p.vy * i * 1.6, p.r * (1 - i * 0.15), 0, Math.PI * 2); c.fill(); }
    const fl = 1 + Math.sin(tk * 0.25) * 0.08, r = p.r * 0.9;
    const gl = c.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r * 2.4 * fl);
    gl.addColorStop(0, "rgba(140,255,120,0.45)"); gl.addColorStop(1, "rgba(80,255,90,0)");
    c.fillStyle = gl; c.beginPath(); c.arc(p.x, p.y, r * 2.4 * fl, 0, Math.PI * 2); c.fill();
    return;
  }
  if (p.style === "bolt") {
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
    const g = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 2);
    g.addColorStop(0, "rgba(255,240,180,0.75)"); g.addColorStop(1, "rgba(120,220,255,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(-p.r * 0.8, 0, p.r * 2.6, p.r * 1.1, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    return;
  }
  if (p.style === "raven") {
    c.strokeStyle = "rgba(200,200,230,0.3)"; c.lineWidth = 2; c.lineCap = "round";
    const s = Math.sign(p.vx) || 1;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(p.x - s * (14 + i * 4), p.y - 6 + i * 6); c.lineTo(p.x - s * (26 + i * 8), p.y - 6 + i * 6); c.stroke(); }
    return;
  }
  drawProj(c, p, tk);
}

function render3D(g, tk) {
  R3.frame++;
  r3Layers(true); r3Size();
  // sky and sea on the bottom canvas
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.save(); c.beginPath(); c.rect(0, 0, L.gw, L.gh); c.clip(); drawBackground(c, tk); c.restore();
  // 3D scene
  const poses = g.fighters.map((f) => (f.state === "dead" || f.state === "gone" ? null : pose(f, tk)));
  for (const f of g.fighters) f._ravenOut = g.projs.some((p) => p.owner === f.slot && p.style === "raven");
  r3Fighters(g, tk, poses);
  r3Projectiles(g, tk);
  if (mode === "select" || mode === "online") r3Previews(tk);
  const bub = r3Bubbles(g);
  r3Camera(R3.camera, cam.x - cam.sx / cam.z, cam.y - cam.sy / cam.z, L.gh / cam.z, L.gw / L.gh);
  const r = R3.renderer;
  r.setScissorTest(false); r.setViewport(0, 0, L.gw, L.gh); r.setClearColor(0x000000, 0);
  r.shadowMap.needsUpdate = true;
  r.render(R3.scene, R3.camera);
  // overlay
  const o = octx;
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, ovcv.width, ovcv.height);
  o.setTransform(DPR, 0, 0, DPR, 0, 0);
  o.save(); o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
  const ox = L.gw / 2 - cam.x * cam.z + cam.sx, oy = L.gh / 2 - cam.y * cam.z + cam.sy;
  o.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * ox, DPR * oy);
  drawTrails(o, g);
  for (const p of g.projs) drawProjFx(o, p, tk);
  g.fighters.forEach((f, i) => { if (poses[i]) drawFighterFx(o, f, tk, poses[i]); });
  drawFx(o);
  if (mode === "match") {
    const [a, b] = g.fighters;
    const close = Math.abs(a.x - b.x) * cam.z < 44 && Math.abs((a.y - a.s.h) - (b.y - b.s.h)) * cam.z < 22;
    drawTag(o, a, meSlot === 0, meSlot === 1 && close ? 20 : 0); drawTag(o, b, meSlot === 1, meSlot === 0 && close ? 20 : 0);
  }
  o.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawScreenFx(o);
  if (mode === "match") drawCombos(o, g);
  drawBubbles(o, g, tk, bub);
  o.restore();
  r3Perf(performance.now());
}
