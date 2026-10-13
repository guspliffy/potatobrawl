/* ===================== KO films: live three.js cutscenes =====================
   One engine runs shot lists ("films", FILMS[fighterId]) for the winner of a match. UI only: nothing here reads or writes the
   game state G, so online lockstep is untouched (each browser plays its own copy). Layers: #cv (2D game, frozen once the
   picture shatters), #gl (this engine, composer + grade pass), #ov (2D: letterbox, flashes, lens flare, name card).
   Flow, ms after the final hit: 0-120 the real hit; 120-420 a crack web grows over the 2D picture; 420 the picture becomes
   a pane in 3D space and shatters while the camera falls through it; 760-3900 the film; 3900-4150 shutters; results.
   three.js (r128) is injected in the background after the menu is up. If anything is missing or breaks (no WebGL, context
   lost, a shader that fails, three.js not loaded, a winner without a film) the old 2D finisher plays unchanged.
   Blocks (Fable's numbering): B1 hero rig (gfx3d.js + the helpers here), B2 set, B3 lights, B4 env map, B5 post, B6 GPU
   particles, B7 sprites, B8 effect meshes, B9 blast-out, B10 shatter, B11 camera director, B12 expressions, B13 sound. */
const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
// timeline of the film path, ms after the final hit
const CT = { CRACK: 120, SHATTER: 420, THROUGH: 760, SKIP: 900, CARD: 3450, OUTRO: 3900, CLOSED: 4150, END: 4250 };
const CINE = {
  libs: false, loading: false, failed: false, why: "",
  T: null, renderer: null, composer: null, bloom: null, gradePass: null, scene: null, camera: null,
  tier: "B", pin: null, prFix: 0, cfg: null,
  stage: 0, ready: false, ids: "", slots: "",
  rigs: [null, null], set: null, lights: null, env: null, fx: null, films: {},
  film: null, active: false, t: 0, tw: 0, last: 0, w: 0, h: 0, pr: 0, slow: 0, slowT: 0,
  pane: null, own: [], hasRes: false, tail: 0, rnd: null, lab: null, frames: 0, ms: 0,
};
const FILMS = {};
const CT_TIERS = {
  A: { name: "A", pr: 1.5, touchPr: 1.5, bloom: 2, shadow: true, seg: [48, 32], parts: 6000, hdr: true, msaa: 4, shatter: true, distort: true, grain: true, flame: 1 },
  B: { name: "B", pr: 1, touchPr: 1, bloom: 1, shadow: false, seg: [36, 24], parts: 2500, hdr: false, msaa: 0, shatter: true, distort: true, grain: true, flame: 0.7 },
  C: { name: "C", pr: 0.75, touchPr: 0.75, bloom: 0, shadow: false, seg: [24, 16], parts: 900, hdr: false, msaa: 0, shatter: false, distort: false, grain: false, flame: 0.4 },
};

/* ---------- loading three.js in the background ---------- */
function cineLoadThree() {
  if (CINE.libs || CINE.loading || CINE.failed) return;
  if (window.THREE && window.THREE.WebGLRenderer) { cineLibsUp(); return; }
  CINE.loading = true;
  const s = document.createElement("script");
  s.src = THREE_URL; s.async = true;
  s.onload = () => { CINE.loading = false; cineLibsUp(); };
  s.onerror = () => { CINE.loading = false; CINE.loadErr = (CINE.loadErr || 0) + 1; if (CINE.loadErr < 2) setTimeout(() => { s.remove(); cineLoadThree(); }, 20000); };
  document.head.appendChild(s);
}
function cineLibsUp() {
  try {
    cineAddons(window.THREE);
    const T = window.THREE;
    if (!T.EffectComposer || !T.UnrealBloomPass || !T.ShaderPass || !T.RenderPass) throw new Error("add-ons missing");
    CINE.T = T; R3.T = T; CINE.libs = true;
  } catch (e) { cineFail("add-ons: " + (e && e.message)); }
}
function cineFail(why) {
  CINE.failed = true; CINE.why = String(why || "");
  try { console.warn("KO film unavailable, using the 2D finisher:", CINE.why); } catch (e) { /* no console */ }
  if (FIN.on && FIN.cine) cineBail();
  else if (!FIN.on) cineFree();
}
// background load once the page is idle (the menu is up by then); a match started earlier just plays the 2D finisher
(function () {
  const go = () => setTimeout(cineLoadThree, 600);
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 7000 }); else setTimeout(go, 2500);
})();

/* ---------- tiers ---------- */
function cineTierName() {
  const pin = window.__cineTier || CINE.pin;
  if (pin && CT_TIERS[pin]) return pin;
  const q = R3.q | 0;                      // the frame-time watchdog (r3Perf) also times the 2D match frames
  if (q >= 2) return "C";
  return q >= 1 || touchUI ? "B" : "A";
}
function cinePixelRatio() {
  if (CINE.prFix) return CINE.prFix;
  const c = CINE.cfg, dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, touchUI ? c.touchPr : c.pr);
}

/* ---------- small helpers ---------- */
const cnSmooth = (k) => k * k * (3 - 2 * k);
const cnClamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const cnProg = (a, b, t) => cnClamp01((t - a) / (b - a));
const cnMix = (a, b, k) => a + (b - a) * k;
const cnOut3 = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const cnInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function cnRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function cnOwn(o) { CINE.own.push(o); return o; }
// piecewise-linear track: [[t, v], ...] sampled at t
function cnTrack(tr, t) {
  if (t <= tr[0][0]) return tr[0][1];
  for (let i = 1; i < tr.length; i++) if (t <= tr[i][0]) { const a = tr[i - 1], b = tr[i]; return a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0] || 1)); }
  return tr[tr.length - 1][1];
}
function cnCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function cnTex(c, srgb) {
  const T = CINE.T, t = new T.CanvasTexture(c);
  if (srgb) t.encoding = T.sRGBEncoding;
  t.userData = { shared: true }; return cnOwn(t);
}
const cnLin = (hex) => new CINE.T.Color(hex).convertSRGBToLinear();

/* ---------- procedural textures (all drawn at runtime, no files) ---------- */
function cnGlowCanvas(size, stops) {
  const c = cnCanvas(size, size), x = c.getContext("2d"), r = size / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
// 4 cells in one 512x128 atlas: 0 soft glow, 1 ember (hot core), 2 smoke puff, 3 flame tongue
function cnAtlas() {
  const c = cnCanvas(512, 128), x = c.getContext("2d"), rnd = cnRng(7);
  x.drawImage(cnGlowCanvas(128, [[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,0.6)"], [0.6, "rgba(255,255,255,0.12)"], [1, "rgba(255,255,255,0)"]]), 0, 0);
  x.drawImage(cnGlowCanvas(128, [[0, "rgba(255,255,255,1)"], [0.1, "rgba(255,255,255,1)"], [0.2, "rgba(255,255,255,0.45)"], [0.5, "rgba(255,255,255,0.1)"], [1, "rgba(255,255,255,0)"]]), 128, 0);
  const puff = (ox, spread, n, a0, wob) => {
    for (let i = 0; i < n; i++) {
      const ang = rnd() * 6.283, d = rnd() * spread, px = ox + 64 + Math.cos(ang) * d, py = 64 + Math.sin(ang) * d * wob, r = 14 + rnd() * 20;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255,255,255,${a0 * (0.5 + rnd() * 0.5)})`); g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
  };
  puff(256, 30, 26, 0.16, 1);
  puff(384, 22, 22, 0.2, 1.5);
  // fade the cell borders so neighbouring cells never bleed
  for (let i = 0; i < 4; i++) { const g = x.createRadialGradient(i * 128 + 64, 64, 36, i * 128 + 64, 64, 64); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)"); x.globalCompositeOperation = "destination-out"; x.fillStyle = g; x.fillRect(i * 128, 0, 128, 128); x.globalCompositeOperation = "source-over"; }
  return cnTex(c, false);
}
// bark-like grass and a matching bump for the hero slab
function cnGrassTex() {
  const T = CINE.T, N = 256, c = cnCanvas(N, N), x = c.getContext("2d"), rnd = cnRng(5);
  x.fillStyle = "#5f9c55"; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) {
    const px = rnd() * N, py = rnd() * N, l = 3 + rnd() * 7, a = (rnd() - 0.5) * 0.9, d = rnd();
    x.strokeStyle = d < 0.5 ? `rgba(34,86,48,${0.25 + rnd() * 0.35})` : `rgba(168,224,120,${0.2 + rnd() * 0.3})`; x.lineWidth = 0.8 + rnd();
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.sin(a) * l, py + oy - Math.cos(a) * l); x.stroke(); }
  }
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.userData = { shared: true };
  return cnOwn(t);
}
// jagged ember cracks on black, for the charred skin's emissive map (sphere UVs)
function cnCrackTex() {
  const c = cnCanvas(512, 256), x = c.getContext("2d"), rnd = cnRng(23);
  x.fillStyle = "#000"; x.fillRect(0, 0, 512, 256);
  x.lineCap = "round"; x.lineJoin = "round";
  for (let i = 0; i < 46; i++) {
    let px = rnd() * 512, py = rnd() * 256, a = rnd() * 6.283;
    const segs = 4 + Math.floor(rnd() * 8);
    for (const [w, col] of [[5, "rgba(255,90,10,0.35)"], [2.4, "rgba(255,170,40,0.9)"], [0.9, "rgba(255,244,200,1)"]]) {
      let qx = px, qy = py, qa = a; const r2 = cnRng(i * 77 + 3);
      x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(qx, qy);
      for (let s = 0; s < segs; s++) { qa += (r2() - 0.5) * 1.3; qx += Math.cos(qa) * (8 + r2() * 16); qy += Math.sin(qa) * (8 + r2() * 16); x.lineTo(qx, qy); }
      x.stroke();
    }
  }
  const T = CINE.T, t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.userData = { shared: true };
  return cnOwn(t);
}

/* ===================== B1 / B12: hero rig helpers, anchors, expressions ===================== */
// body point for a direction (az, el) on the potato, in world space (rig matrices must be up to date)
const _cnD = { x: 0, y: 0, z: 0 };
function cnBodyPt(rig, az, el, k, out) {
  const T = CINE.T, d = CINE.v.d.set(0, 0, 0), o = CINE.v.o;
  dirAE(az, el, d); surf(rig.B, d, k || 1, o);
  return rig.bodyC.localToWorld(out.copy(o));
}
function cnAnchors(rig, A) {
  const V = CINE.v, B = rig.B;
  rig.root.updateMatrixWorld(true);
  cnBodyPt(rig, AZ0 - 0.02, EL_EYE, 1.06, A.eyes);
  cnBodyPt(rig, AZ0 - 0.02, -0.12, 1.06, A.mouth);
  cnBodyPt(rig, AZ0, 0.02, 1.0, A.face);
  cnBodyPt(rig, AZ0 + 0.05, -0.78, 1.04, A.chest);
  rig.bodyC.localToWorld(A.head.set(0, B.ry * 0.62, 0));
  rig.bodyC.localToWorld(A.body.set(0, 0, 0));
  rig.root.localToWorld(A.feet.set(0, 0, 0));
  // a point in front of the mouth along the way the body faces (for flames, rings)
  cnBodyPt(rig, AZ0 - 0.02, -0.12, 1.6, A.snout);
}
const cnAnchorSet = () => { const T = CINE.T, mk = () => new T.Vector3(); return { eyes: mk(), mouth: mk(), face: mk(), chest: mk(), head: mk(), body: mk(), feet: mk(), snout: mk() }; };

// expressions: pins the face decal, the eye size, the pupils and the brows. k (0..1) fades the brows and pupils in.
const CN_BROWS = { terror: { dy: 0.55, abs: -0.5 }, rage: { dy: -0.38, abs: 0.62 }, fierce: { dy: -0.1, abs: null }, grin: { dy: 0.12, abs: -0.12 }, dazed: { dy: 0.1, abs: -0.15 }, ko: { dy: 0, abs: 0.3 }, rest: { dy: 0, abs: null } };
const CN_PUPIL = { terror: 0.4, rage: 0.75, fierce: 0.9, rest: 1, grin: 1, dazed: 1, ko: 1 };
function cnExpr(rig, expr, k) {
  const T = CINE.T, H = rig.hero;
  if (!H) return;
  const e = expr || "rest", kk = k === undefined ? 1 : k;
  rig.xl = e === "rest" || e === "fierce" ? "" : e;
  rig.eyeK = e === "terror" ? cnMix(1, 1.28, kk) : 1;
  const ps = cnMix(1, CN_PUPIL[e] === undefined ? 1 : CN_PUPIL[e], kk), tgt = CN_BROWS[e] || CN_BROWS.rest;
  for (const p of H.pupils) { p.pu.scale.set(p.s0.x * ps, p.s0.y * (e === "terror" ? ps : cnMix(1, ps, 0.6)), p.s0.z); }
  for (const b of H.brows) {
    b.m.position.copy(b.p0); b.m.quaternion.copy(b.q0);
    if (tgt.dy) { const u = CINE.v.a.set(0, 1, 0).applyQuaternion(b.q0); b.m.position.addScaledVector(u, tgt.dy * b.k * kk); }
    if (tgt.abs !== null) b.m.rotateZ((tgt.abs * b.s - b.a0) * kk);
  }
}
// pupils (and glints) follow a point: the camera for the hero close-ups
function cnLookAt(rig, target, k) {
  const H = rig.hero;
  if (!H) return;
  const v = CINE.v.a, er = rig.B.w * 0.105;
  for (const p of H.pupils) {
    const eg = p.pu.parent;
    if (!eg) continue;
    eg.updateWorldMatrix(true, false);
    v.copy(target); eg.worldToLocal(v); v.normalize();
    const dx = v.x * er * 0.3 * k, dy = v.y * er * 0.3 * k;
    p.pu.position.set(p.p0.x + dx, p.p0.y + dy, p.p0.z); p.ir.position.set(p.i0.x + dx * 0.8, p.i0.y + dy * 0.8, p.i0.z);
  }
}
// scales the environment light on a rig's materials (the film dims the world while a glow takes over)
function cnEnvK(rig, k) {
  for (const s of rig.mats) { const m = s.m; if (m.envMapIntensity === undefined) continue; if (s.env0 === undefined) s.env0 = m.envMapIntensity; m.envMapIntensity = s.env0 * k; }
}
function cnLimbVis(L, v) { for (const m of [L.s1, L.s2, L.j0, L.j1, L.end]) m.visible = v; }
// char: skin and every material darkens towards burnt black, the cracks glow ember-red (k 0..1)
const CN_CHAR = [0.1, 0.05, 0.03];
function cnChar(rig, k) {
  const T = CINE.T, ch = CINE.v.c0 || (CINE.v.c0 = new T.Color());
  ch.setRGB(CN_CHAR[0], CN_CHAR[1], CN_CHAR[2]);
  for (const s of rig.mats) {
    if (!s.m.color) continue;
    s.m.color.copy(s.c0).lerp(ch, k * (s.m === rig.skin ? 0.97 : 0.88));
    if (s.e0 && s.m.emissive) { s.m.emissive.copy(s.e0).lerp(ch, k * 0.6); }
  }
  if (rig.hero && rig.hero.u) { rig.hero.u.char.value = k; }
}

/* ===================== B4: env map (PMREM of a generated studio + the film's own sky) ===================== */
const CN_SOFT_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
function cineEnv(film) {
  // One opaque sky sphere with the soft boxes computed in its shader (PMREM stores RGBD: no blending, and the output goes through
  // linearToOutputTexel so it is encoded the way the target wants).
  const T = CINE.T, r = CINE.renderer, scn = new T.Scene(), sk = film.sky, bx = film.env.boxes, N = 5;
  const dir = [], right = [], up = [], size = [], col = [];
  for (let i = 0; i < N; i++) {
    const b = bx[i];
    if (!b) { dir.push(new T.Vector3(0, -1, 0)); right.push(new T.Vector3(1, 0, 0)); up.push(new T.Vector3(0, 0, 1)); size.push(new T.Vector2(0.001, 0.001)); col.push(new T.Color(0, 0, 0)); continue; }
    const p = new T.Vector3(b.p[0], b.p[1], b.p[2]), l = p.length(), d = p.clone().normalize(), rt = new T.Vector3().crossVectors(d, new T.Vector3(0, 1, 0));
    if (rt.lengthSq() < 1e-4) rt.set(1, 0, 0);
    rt.normalize(); const u = new T.Vector3().crossVectors(rt, d).normalize();
    dir.push(d); right.push(rt); up.push(u); size.push(new T.Vector2(b.w / 2 / l, b.h / 2 / l)); col.push(cnLin(b.col).multiplyScalar(b.I));
  }
  const mat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, depthTest: false,
    uniforms: { cTop: { value: cnLin(sk.top) }, cHor: { value: cnLin(sk.horizon) }, cBot: { value: cnLin(sk.bottom) }, bDir: { value: dir }, bRight: { value: right }, bUp: { value: up }, bSize: { value: size }, bCol: { value: col } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 cTop, cHor, cBot; uniform vec3 bDir[5], bRight[5], bUp[5], bCol[5]; uniform vec2 bSize[5]; varying vec3 vP;
void main(){ vec3 d = normalize(vP); float h = d.y;
  vec3 c = mix(cBot, cHor, smoothstep(-0.6, 0.0, h)); c = mix(c, cTop, smoothstep(0.0, 0.8, h)); c += cHor * exp(-abs(h) * 7.0) * 1.2;
  for (int i = 0; i < 5; i++) { float dd = dot(d, bDir[i]); if (dd > 0.05) { vec2 q = vec2(dot(d, bRight[i]), dot(d, bUp[i])) / dd / bSize[i]; c += bCol[i] * smoothstep(1.0, 0.55, max(abs(q.x), abs(q.y))); } }
  gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }`,
  });
  const sph = new T.Mesh(new T.SphereGeometry(50, 32, 16), mat); scn.add(sph);
  const pm = new T.PMREMGenerator(r);
  const rt = pm.fromScene(scn, 0.03);
  pm.dispose(); sph.geometry.dispose(); mat.dispose();
  return rt;
}

/* ===================== B2: the set (hero slab, floor, dome sky, stars, far rocks) ===================== */
const CN_DOME_FS = `
uniform vec3 cTop, cHor, cBot, cHot; uniform float uTime, uHaze, uHotA, uPulse; uniform vec4 uHot;
varying vec3 vP;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn3(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vP); float h = d.y;
  vec3 c = mix(cBot, cHor * 0.5, smoothstep(-0.5, 0.0, h)); c = mix(c, cTop, smoothstep(0.0, 0.62, h));
  float n = fbm(vec3(d.x * 3.2 + uTime * 0.012, d.y * 8.0, d.z * 3.2 - uTime * 0.008));
  float n2 = fbm(vec3(d.x * 9.0 - uTime * 0.02, d.y * 20.0, d.z * 9.0) + 4.0);
  float band = exp(-abs(h - 0.03) * 9.0), core = exp(-abs(h - 0.01) * 26.0);
  float smoke = smoothstep(0.38, 0.78, n * 0.75 + n2 * 0.45);          // dark smoke masses that the glow burns through
  c += cHor * band * uHaze * (0.25 + 1.05 * n2) * (1.0 - 0.8 * smoke * smoothstep(0.0, 0.25, h + 0.1));
  c += cHot * core * uHaze * 0.55 * (0.5 + n2);
  c += cHor * smoothstep(0.55, 0.9, n) * smoothstep(0.02, 0.3, h) * (1.0 - smoothstep(0.3, 0.55, h)) * 0.35 * uHaze;   // ember-lit cloud edges
  float ang = acos(clamp(dot(d, uHot.xyz), -1.0, 1.0));
  float hot = smoothstep(uHot.w, uHot.w * 0.15, ang) * uHotA;
  float rim = smoothstep(uHot.w * 1.25, uHot.w, ang) * smoothstep(uHot.w * 0.7, uHot.w, ang) * uHotA;
  c += cHot * (hot * (1.1 + 1.2 * n) + rim * 0.8);
  c += cHot * uPulse * band * 0.5;
  gl_FragColor = vec4(c, 1.0);
}`;
function cnSlabGeom(x1, x2, d, th, r) {
  const T = CINE.T, sh = new T.Shape();
  sh.moveTo(x1 + r, -d); sh.lineTo(x2 - r, -d); sh.quadraticCurveTo(x2, -d, x2, -d + r); sh.lineTo(x2, d - r); sh.quadraticCurveTo(x2, d, x2 - r, d);
  sh.lineTo(x1 + r, d); sh.quadraticCurveTo(x1, d, x1, d - r); sh.lineTo(x1, -d + r); sh.quadraticCurveTo(x1, -d, x1 + r, -d);
  const g = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.computeBoundingBox(); g.translate(0, -g.boundingBox.max.y, 0);
  return g;
}
function cnRockGeom(hw, hd, hh, seed, flat) {
  const T = CINE.T, rock = new T.IcosahedronGeometry(1, flat ? 3 : 4), p = rock.attributes.position, v = new T.Vector3(), rnd = cnRng(seed);
  const a1 = rnd() * 6, a2 = rnd() * 6, colors = new Float32Array(p.count * 3), top = cnLin("#5a4638"), bot = cnLin("#1a1418"), c = new T.Color();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const n = 1 + 0.13 * Math.sin(7.1 * v.x + a1 + 2.3 * v.z) * Math.cos(5.3 * v.y + 1.7 * v.x) + 0.07 * Math.sin(13 * v.z + 4 * v.x + a2);
    let y = Math.min(0, v.y) * hh * n;
    const taper = 1 - 0.28 * Math.min(1, -y / hh);
    p.setXYZ(i, v.x * hw * taper * n, v.y > 0 ? 0 : y, v.z * hd * taper * n);
    c.copy(top).lerp(bot, Math.min(1, -y / hh)); colors.set([c.r, c.g, c.b], i * 3);
  }
  rock.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  rock.computeVertexNormals();
  return rock;
}
function cineSet(film) {
  const T = CINE.T, cfg = CINE.cfg, grp = new T.Group(), S = {}, sk = film.sky;
  scnAdd(grp);
  // dome sky
  S.domeMat = cnOwn(new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { cTop: { value: cnLin(sk.top) }, cHor: { value: cnLin(sk.horizon) }, cBot: { value: cnLin(sk.bottom) }, cHot: { value: cnLin(sk.hot || "#ff6a1a") },
      uTime: { value: 0 }, uHaze: { value: sk.haze === undefined ? 1 : sk.haze }, uHotA: { value: 0 }, uPulse: { value: 0 }, uHot: { value: new T.Vector4(0, 0, -1, 0.3) } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: cfg.name === "C" ? CN_DOME_FS.replace(/fbm\([^;]*\);/g, "0.5;") : CN_DOME_FS,
  }));
  S.dome = new T.Mesh(cnOwn(new T.SphereGeometry(2600, 36, 18)), S.domeMat); S.dome.renderOrder = -10; S.dome.frustumCulled = false; grp.add(S.dome);
  // stars
  { const n = film.stars === undefined ? 1200 : film.stars, pos = new Float32Array(n * 3), ph = new Float32Array(n * 2), rnd = cnRng(91);
    for (let i = 0; i < n; i++) {
      const u = rnd(), a = rnd() * 6.283, y = 0.04 + 0.96 * u, rr = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * rr * 2500, y * 2500, Math.sin(a) * rr * 2500], i * 3); ph.set([rnd() * 6.283, 1 + rnd() * 2.2], i * 2);
    }
    const g = cnOwn(new T.BufferGeometry()); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("ph", new T.BufferAttribute(ph, 2));
    S.starMat = cnOwn(new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uA: { value: film.starA === undefined ? 0.8 : film.starA } },
      vertexShader: "attribute vec2 ph; uniform float uTime, uPx; varying float vA; void main(){ vA = 0.55 + 0.45 * sin(uTime * 1.7 + ph.x * 3.0); gl_PointSize = ph.y * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform float uA; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float m = smoothstep(0.5, 0.1, length(d)); gl_FragColor = vec4(vec3(1.0, 0.92, 0.85) * m * vA * uA, 1.0); }",
    }));
    S.stars = new T.Points(g, S.starMat); S.stars.frustumCulled = false; S.stars.renderOrder = -9; grp.add(S.stars);
  }
  // floor: black, wet; catches the glow of every effect. The env map (with the film's horizon) gives it its sheen.
  S.floorY = film.set.floorY;
  S.floorMat = cnOwn(new T.MeshStandardMaterial({ color: cnLin(film.set.floor), roughness: 0.14, metalness: 0.55, envMapIntensity: 1.7 }));
  S.floor = new T.Mesh(cnOwn(new T.CircleGeometry(2300, 64)), S.floorMat); S.floor.rotation.x = -Math.PI / 2; S.floor.position.y = S.floorY; S.floor.receiveShadow = true; grp.add(S.floor);
  // hero slab: bevelled grass top with blades and bump, dark soil sides, a rock hanging under it
  const sw = film.set.slab[0], sd = film.set.slab[1], g1 = cnGrassTex();
  g1.repeat.set(1 / 60, 1 / 60);
  S.grassMat = cnOwn(new T.MeshStandardMaterial({ color: cnLin(film.set.grass || "#ffffff"), map: g1, bumpMap: g1, bumpScale: 2.4, roughness: 0.82, emissive: cnLin("#ff7a1a"), emissiveIntensity: 0 }));
  S.soilMat = cnOwn(new T.MeshStandardMaterial({ color: cnLin("#3b2a22"), roughness: 0.95, flatShading: true }));
  S.slab = new T.Mesh(cnOwn(cnSlabGeom(-sw / 2, sw / 2, sd, 14, 8)), [S.grassMat, S.soilMat]); S.slab.receiveShadow = true; S.slab.castShadow = true; grp.add(S.slab);
  S.rockMat = cnOwn(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));
  { const rk = new T.Mesh(cnOwn(cnRockGeom(sw / 2 - 14, sd - 10, 56, 4, true)), S.rockMat); rk.position.y = -12; rk.receiveShadow = true; grp.add(rk); S.rock = rk; }
  S.crysMat = cnOwn(new T.MeshStandardMaterial({ color: cnLin(film.set.crystal || "#ff8a3d"), emissive: cnLin(film.set.crystal || "#ff8a3d"), emissiveIntensity: 0.9, roughness: 0.25, flatShading: true }));
  { const og = cnOwn(new T.OctahedronGeometry(1, 0));
    for (const [x, z, s0, a] of [[-90, 24, 12, 0.2], [-40, -26, 9, -0.3], [30, 34, 14, -0.15], [86, -12, 10, 0.35], [124, 20, 8, 0.1], [-130, -8, 8, -0.2]]) {
      const e = 1 - ((x) / (sw / 2)) ** 2 - (z / sd) ** 2, sy = -14 - 56 * Math.sqrt(Math.max(0, e)) * 0.9;
      const m = new T.Mesh(og, S.crysMat); m.scale.set(s0 * 0.5, s0 * 1.7, s0 * 0.5); m.position.set(x, sy - s0 * 0.5, z); m.rotation.set(0.25, 0, a); grp.add(m);
    } }
  // far floating rocks: dark shapes against the horizon glow
  S.farMat = cnOwn(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, emissive: cnLin(film.set.rockGlow || "#3a1208"), emissiveIntensity: 0.8 }));
  { const rnd = cnRng(33);
    for (let i = 0; i < 9; i++) {
      const a = (-0.9 + (i / 8) * 1.8) + (rnd() - 0.5) * 0.15, dist = 650 + rnd() * 900, sz = 60 + rnd() * 120;
      const g = cnOwn(cnRockGeom(sz, sz * 0.7, sz * 0.8, 40 + i, true)); const m = new T.Mesh(g, S.farMat);
      m.position.set(Math.sin(a) * dist, 40 + rnd() * 340, -Math.cos(a) * dist); m.rotation.y = rnd() * 6; grp.add(m);
    } }
  S.grp = grp;
  return S;
}
function scnAdd(o) { CINE.scene.add(o); }

/* ===================== B3: lights ===================== */
function cineLights(film) {
  const T = CINE.T, cfg = CINE.cfg, Ls = film.lights, L = {};
  L.hemi = new T.HemisphereLight(cnLin(Ls.sky || "#46313a"), cnLin(Ls.ground || "#120b0d"), Ls.fill === undefined ? 0.4 : Ls.fill);
  L.key = new T.DirectionalLight(cnLin(Ls.key), Ls.keyI || 1.6); L.key.target.position.set(0, 40, 0);
  if (cfg.shadow) {
    L.key.castShadow = true; L.key.shadow.mapSize.set(1024, 1024);
    const sc = L.key.shadow.camera; sc.left = -230; sc.right = 230; sc.top = 230; sc.bottom = -230; sc.near = 300; sc.far = 2600;
    L.key.shadow.bias = -0.0005; L.key.shadow.normalBias = 0.9; L.key.shadow.radius = 3;
  }
  L.rim = new T.DirectionalLight(cnLin(Ls.rim), Ls.rimI || 1.2); L.rim.target.position.set(0, 40, 0);
  L.prac = new T.PointLight(cnLin(Ls.practical), 0, 460, 2);
  L.blast = new T.PointLight(cnLin(Ls.blast || Ls.practical), 0, 560, 2);
  for (const o of [L.hemi, L.key, L.key.target, L.rim, L.rim.target, L.prac, L.blast]) CINE.scene.add(o);
  L.keyPos = Ls.keyPos || [-700, 900, 900]; L.rimPos = Ls.rimPos || [800, 400, -900];
  return L;
}
function cineLightsDir(L, dir) {
  L.key.position.set(L.keyPos[0] * dir, L.keyPos[1], L.keyPos[2]);
  L.rim.position.set(L.rimPos[0] * dir, L.rimPos[1], L.rimPos[2]);
}

/* ===================== B5: post (composer: scene, bloom, one grade pass) ===================== */
const CN_GRADE = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 }, uRes: { value: null },
    uLift: { value: null }, uGamma: { value: null }, uGain: { value: null }, uSat: { value: 1 }, uVig: { value: 0.5 }, uCA: { value: 0 }, uGrain: { value: 0.03 },
    uShockC: { value: null }, uShock: { value: null },
    uHeatA: { value: 0 }, uHeatSeg: { value: null }, uHeatW: { value: 0.1 },
    uRayC: { value: null }, uBlur: { value: null }, uFlash: { value: null }, uFade: { value: 0 },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
uniform sampler2D tDiffuse;
uniform float uTime, uAspect, uSat, uVig, uCA, uGrain, uHeatA, uHeatW, uFade;
uniform vec2 uRes, uShockC, uBlur;
uniform vec3 uLift, uGamma, uGain, uShock, uRayC, uFlash;
uniform vec4 uHeatSeg;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 tap(vec2 uv){ return texture2D(tDiffuse, uv).rgb; }
void main(){
  vec2 uv = vUv;
  if (uShock.z > 0.0) {
    vec2 d = (uv - uShockC) * vec2(uAspect, 1.0); float r = length(d);
    float ring = exp(-pow((r - uShock.x) / uShock.y, 2.0));
    uv += normalize(d + 1e-6) * ring * uShock.z * vec2(1.0 / uAspect, 1.0);
  }
  if (uHeatA > 0.0) {
    vec2 A = uHeatSeg.xy * vec2(uAspect, 1.0), B = uHeatSeg.zw * vec2(uAspect, 1.0), p = uv * vec2(uAspect, 1.0);
    vec2 ba = B - A; float h = clamp(dot(p - A, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0); float dist = length(p - A - ba * h);
    float m = smoothstep(uHeatW * (0.45 + 0.55 * h), 0.0, dist);
    vec2 q = uv * vec2(18.0 * uAspect, 11.0) + vec2(0.0, -uTime * 2.6);
    vec2 n = vec2(vn(q), vn(q + 7.3)) - 0.5;
    uv += n * 0.016 * uHeatA * m * vec2(1.0 / uAspect, 1.0) * (0.3 + 0.7 * smoothstep(0.0, 0.3, h));
    uv.y += (vn(q * 0.5 + 3.0) - 0.5) * 0.004 * uHeatA * smoothstep(0.35, 0.0, dist);
  }
  vec2 cen = uv - 0.5; vec2 ca = cen * uCA;
  vec3 col = vec3(tap(uv + ca).r, tap(uv).g, tap(uv - ca).b);
  if (dot(uBlur, uBlur) > 1e-8) { vec3 acc = col; for (int i = 1; i <= 8; i++) { float k = float(i) / 8.0 - 0.5; acc += tap(uv + uBlur * k); } col = acc / 9.0; }
  if (uRayC.z > 0.0) {
    vec2 dir = uRayC.xy - uv; vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) { float k = float(i) / 10.0; vec3 s = tap(uv + dir * k * 0.6); float l = dot(s, vec3(0.3, 0.5, 0.2)); acc += s * smoothstep(0.5, 1.1, l) * (1.0 - k); }
    col += acc * uRayC.z * 0.1;
  }
  col += uFlash;
  col = col * uGain + uLift;
  col = pow(max(col, 0.0), 1.0 / uGamma);
  float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, uSat);
  vec2 vc = cen * vec2(uAspect * 0.62, 1.0);
  col *= 1.0 - uVig * smoothstep(0.28, 0.92, length(vc) * 1.45);
  col *= 1.0 - uFade;
  vec3 o = srgb(clamp(col, 0.0, 1.0));
  o += (h21(vUv * uRes + fract(uTime * 0.37) * 91.0) - 0.5) * uGrain * (0.2 + 0.8 * dot(o, vec3(0.3, 0.5, 0.2)));
  gl_FragColor = vec4(o, 1.0);
}`,
};
function cinePost() {
  const T = CINE.T, r = CINE.renderer, cfg = CINE.cfg;
  const opt = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: cfg.hdr ? T.HalfFloatType : T.UnsignedByteType };
  let rt;
  if (cfg.msaa && r.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget) { rt = new T.WebGLMultisampleRenderTarget(64, 64, opt); rt.samples = cfg.msaa; }
  else rt = new T.WebGLRenderTarget(64, 64, opt);
  const comp = new T.EffectComposer(r, rt);
  CINE.rpass = new T.RenderPass(CINE.scene, CINE.camera);
  comp.addPass(CINE.rpass);
  const bloom = new T.UnrealBloomPass(new T.Vector2(64, 64), 0.9, 0.55, 0.78);
  if (cfg.hdr) { for (const q of [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical]) q.texture.type = T.HalfFloatType; }
  bloom.enabled = cfg.bloom > 0;
  comp.addPass(bloom);
  const gp = new T.ShaderPass(new T.ShaderMaterial({ uniforms: T.UniformsUtils.clone(CN_GRADE.uniforms), vertexShader: CN_GRADE.vertexShader, fragmentShader: CN_GRADE.fragmentShader }));
  const u = gp.uniforms;
  u.uRes.value = new T.Vector2(1, 1); u.uLift.value = new T.Vector3(); u.uGamma.value = new T.Vector3(1, 1, 1); u.uGain.value = new T.Vector3(1, 1, 1);
  u.uShockC.value = new T.Vector2(0.5, 0.5); u.uShock.value = new T.Vector3(0, 0.05, 0); u.uHeatSeg.value = new T.Vector4(0.5, 0.5, 0.9, 0.5);
  u.uRayC.value = new T.Vector3(0.5, 0.5, 0); u.uBlur.value = new T.Vector2(); u.uFlash.value = new T.Vector3();
  comp.addPass(gp);
  CINE.composer = comp; CINE.bloom = bloom; CINE.gradePass = gp; CINE.gu = u;
  cnOwn({ dispose() { rt.dispose(); comp.renderTarget1.dispose(); comp.renderTarget2.dispose(); bloom.dispose(); gp.material.dispose(); gp.fsQuad.dispose(); } });
}
// size everything for the current layout and tier
function cineSize() {
  const r = CINE.renderer, cfg = CINE.cfg, pr = cinePixelRatio(), w = L.gw, h = L.gh;
  if (CINE.w === w && CINE.h === h && CINE.pr === pr) return;
  CINE.w = w; CINE.h = h; CINE.pr = pr;
  r.setPixelRatio(pr); r.setSize(w, h, false);
  glcv.style.width = w + "px"; glcv.style.height = h + "px";
  CINE.composer.setPixelRatio(pr); CINE.composer.setSize(w, h);
  if (cfg.bloom === 1) CINE.bloom.setSize(w * pr / 2, h * pr / 2);   // tier B: bloom at quarter resolution
  CINE.gu.uRes.value.set(w * pr, h * pr); CINE.gu.uAspect.value = w / h;
  if (ovcv.width !== cv.width || ovcv.height !== cv.height) { ovcv.width = cv.width; ovcv.height = cv.height; }
  CINE.camera.aspect = w / h;
}

/* ===================== noise texture (shared by flames, smoke, the dome: 3 taps instead of per-pixel hash noise) ===================== */
function cnNoiseTex() {
  const T = CINE.T, N = 256, data = new Uint8Array(N * N * 4), rnd = cnRng(1234);
  const lat = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
  const sample = (a, n, x, y) => {
    const fx = x * n, fy = y * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const g = (i, j) => a[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
    return (g(ix, iy) * (1 - sx) + g(ix + 1, iy) * sx) * (1 - sy) + (g(ix, iy + 1) * (1 - sx) + g(ix + 1, iy + 1) * sx) * sy;
  };
  const octs = [4, 8, 16, 32, 64], lats = [0, 1, 2, 3].map(() => octs.map((n) => lat(n)));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    for (let c = 0; c < 4; c++) {
      let s = 0, w = 0.5, tot = 0;
      for (let o = 0; o < octs.length; o++) { s += sample(lats[c][o], octs[o], u, v) * w; tot += w; w *= c === 3 ? 0.8 : 0.52; }
      data[(y * N + x) * 4 + c] = Math.max(0, Math.min(255, Math.round((s / tot) * 255)));
    }
  }
  const t = new T.DataTexture(data, N, N, T.RGBAFormat); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = t.minFilter = T.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; t.userData = { shared: true };
  return cnOwn(t);
}

/* ===================== B6: GPU particles ===================== */
const CN_P_VS = `
attribute vec3 v0; attribute vec4 pr;
uniform float uTime, uDrag, uSize, uScale, uTurb, uGrow, uAlpha, uPull, uSpin;
uniform vec3 uG, uCol0, uCol1, uCol2;
uniform vec4 uAtt;
varying vec4 vCol; varying float vRot;
void main(){
  float age = uTime - pr.x, u = age / pr.y;
  if (age < 0.0 || u >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vCol = vec4(0.0); vRot = 0.0; return; }
  float seed = pr.z;
  float dk = uDrag > 0.001 ? (1.0 - exp(-uDrag * age)) / uDrag : age;
  vec3 p = position + v0 * dk + 0.5 * uG * age * age;
  if (uTurb > 0.0) p += uTurb * vec3(sin(age * 3.1 + seed * 41.0), sin(age * 2.3 + seed * 17.0) * 0.6, cos(age * 2.7 + seed * 29.0)) * min(age, 1.4);
  float shrink = 1.0;
  if (uAtt.w > 0.0) {
    float thr = fract(seed * 7.13) * 0.62;
    float k = clamp((uPull - thr) / 0.38, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
    vec3 toA = uAtt.xyz - p;
    vec3 side = normalize(cross(toA, vec3(0.0, 0.0, 1.0)) + vec3(1e-4));
    p += toA * k + side * sin(k * 3.14159) * length(toA) * 0.3 * (fract(seed * 3.3) - 0.5);
    shrink = 1.0 - 0.75 * k;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float a = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.5, 1.0, u)) * uAlpha;
  float sz = uSize * pr.w * (1.0 + uGrow * u) * shrink;
  gl_PointSize = clamp(sz * uScale / max(-mv.z, 1.0), 1.0, 230.0);
  vCol = vec4(u < 0.45 ? mix(uCol0, uCol1, u / 0.45) : mix(uCol1, uCol2, (u - 0.45) / 0.55), a);
  vRot = seed * 6.283 + age * uSpin * (fract(seed * 5.0) - 0.5);
}`;
const CN_P_FS = `
uniform sampler2D tAtlas; uniform vec2 uCell;
varying vec4 vCol; varying float vRot;
void main(){
  if (vCol.a <= 0.0) discard;
  vec2 c = gl_PointCoord - 0.5; float cs = cos(vRot), sn = sin(vRot);
  c = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y) + 0.5;
  float cell = uCell.x + floor(fract(vRot * 0.159) * uCell.y);
  float m = texture2D(tAtlas, vec2((cell + clamp(c.x, 0.0, 1.0)) * 0.25, clamp(c.y, 0.0, 1.0))).a;
  gl_FragColor = vec4(vCol.rgb, m * vCol.a);
}`;
// o: { add (additive blend), g [x,y,z], drag, size, grow, turb, c0, c1, c2 (hex or [r,g,b] HDR), cell [first, count], alpha, spin }
function cnGP(max, o) {
  const T = CINE.T, g = cnOwn(new T.BufferGeometry());
  const p0 = new Float32Array(max * 3), v0 = new Float32Array(max * 3), pr = new Float32Array(max * 4);
  for (let i = 0; i < max; i++) pr[i * 4] = 1e9;
  g.setAttribute("position", new T.BufferAttribute(p0, 3)); g.setAttribute("v0", new T.BufferAttribute(v0, 3)); g.setAttribute("pr", new T.BufferAttribute(pr, 4));
  for (const a of ["position", "v0", "pr"]) g.attributes[a].setUsage(T.DynamicDrawUsage);
  const col = (c) => (Array.isArray(c) ? new T.Color(c[0], c[1], c[2]) : cnLin(c));
  const mat = cnOwn(new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: o.add ? T.AdditiveBlending : T.NormalBlending, fog: false,
    uniforms: {
      uTime: CINE.pu.uTime, uScale: CINE.pu.uScale, tAtlas: { value: CINE.atlas }, uDrag: { value: o.drag || 0 }, uSize: { value: o.size || 4 }, uGrow: { value: o.grow || 0 },
      uTurb: { value: o.turb || 0 }, uAlpha: { value: o.alpha === undefined ? 1 : o.alpha }, uPull: { value: 0 }, uSpin: { value: o.spin || 0 },
      uG: { value: new T.Vector3(o.g ? o.g[0] : 0, o.g ? o.g[1] : 0, o.g ? o.g[2] : 0) }, uCol0: { value: col(o.c0) }, uCol1: { value: col(o.c1 || o.c0) }, uCol2: { value: col(o.c2 || o.c1 || o.c0) },
      uAtt: { value: new T.Vector4(0, 0, 0, 0) }, uCell: { value: new T.Vector2(o.cell ? o.cell[0] : 0, o.cell ? o.cell[1] : 1) },
    },
    vertexShader: CN_P_VS, fragmentShader: CN_P_FS,
  }));
  const pts = new T.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = o.add ? 4 : 3;
  const S = { pts, mat, g, p0, v0, pr, head: 0, max, dmin: max, dmax: -1, em: [] };
  return S;
}
function cnGPAdd(S, x, y, z, vx, vy, vz, t0, life, seed, size) {
  const i = S.head; S.head = i + 1 >= S.max ? 0 : i + 1;
  const p = S.p0, v = S.v0, r = S.pr;
  p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz;
  r[i * 4] = t0; r[i * 4 + 1] = life; r[i * 4 + 2] = seed; r[i * 4 + 3] = size;
  if (i < S.dmin) S.dmin = i; if (i > S.dmax) S.dmax = i;
}
function cnGPFlush(S) {
  if (S.dmax < S.dmin) return;
  const lo = S.dmin, n = S.dmax - S.dmin + 1;
  for (const [a, k] of [["position", 3], ["v0", 3], ["pr", 4]]) { const at = S.g.attributes[a]; at.updateRange.offset = lo * k; at.updateRange.count = n * k; at.needsUpdate = true; }
  S.dmin = S.max; S.dmax = -1;
}
// emitters spawn with exact birth times inside each step, so the look does not depend on the frame rate
function cnEmit(S, rate, t0, t1, fn) {
  const e = S.acc || 0, n = rate * (t1 - t0) / 1000 + e, k = Math.floor(n);
  S.acc = n - k;
  for (let j = 0; j < k; j++) fn((t0 + (t1 - t0) * ((j + CINE.rnd()) / k)) / 1000);   // t0, t1 in ms; fn gets the birth time in seconds
}

/* ===================== B7 / B8: glow sprites, flame shader, smoke ring, shock rings ===================== */
function cnGlowPool(n) {
  const T = CINE.T, pool = [];
  const tex = cnTex(cnGlowCanvas(128, [[0, "rgba(255,255,255,1)"], [0.2, "rgba(255,255,255,0.7)"], [0.5, "rgba(255,255,255,0.16)"], [1, "rgba(255,255,255,0)"]]), false);
  for (let i = 0; i < n; i++) {
    const m = cnOwn(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, toneMapped: false, color: 0xffffff }));
    const s = new T.Sprite(m); s.visible = false; s.frustumCulled = false; s.renderOrder = 6; pool.push(s);
  }
  return pool;
}
function cnGlow(i, x, y, z, size, r, g, b) {
  const s = CINE.fx.glows[i];
  s.visible = size > 0; if (!s.visible) return;
  s.position.set(x, y, z); s.scale.set(size, size, 1); s.material.color.setRGB(r, g, b);
}
const CN_FIRE_VS = `
uniform float uTime, uAmp; uniform sampler2D tNoise;
varying vec2 vUv; varying vec3 vN, vV;
void main(){
  vUv = uv; vec3 p = position;
  float n = texture2D(tNoise, vec2(uv.x * 2.0 + uTime * 0.07, uv.y * 1.2 - uTime * 0.55)).r - 0.5;
  p += normal * n * uAmp * smoothstep(0.0, 0.25, uv.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const CN_FIRE_FS = `
uniform float uTime, uI, uCut, uFlick; uniform vec3 uC0, uC1, uC2; uniform sampler2D tNoise;
varying vec2 vUv; varying vec3 vN, vV;
void main(){
  float v = vUv.y;
  vec2 q = vec2(vUv.x * 3.0, v * 1.6 - uTime * 0.9);
  float n = texture2D(tNoise, q).r * 0.6 + texture2D(tNoise, q * 2.3 + vec2(0.37, -uTime * 0.6)).g * 0.4;
  float fres = pow(abs(dot(normalize(vN), normalize(vV))), 1.1);
  float dens = fres * smoothstep(0.0, 0.05, v) * (1.0 - smoothstep(0.5, 1.0, v + (n - 0.5) * 0.7 + (1.0 - uCut)));
  dens *= 0.35 + 1.25 * n;
  vec3 c = mix(uC2, uC1, smoothstep(0.1, 0.55, dens + 0.15 * (1.0 - v)));
  c = mix(c, uC0, smoothstep(0.5, 1.0, dens + 0.2 * (1.0 - v)));
  gl_FragColor = vec4(c * uI * (0.85 + 0.3 * uFlick), clamp(dens, 0.0, 1.0));
}`;
// a hollow flame along +y: radius profile r(s), from the mouth (s = 0) to the tip (s = 1)
function cnFlameGeom(len, r0, r1, rmid) {
  const T = CINE.T, pts = [];
  for (let i = 0; i <= 18; i++) { const s = i / 18, r = r0 + (r1 - r0) * Math.pow(s, 0.75) + rmid * Math.sin(Math.min(1, s * 1.05) * Math.PI) * 0.35; pts.push(new T.Vector2(Math.max(0.5, r), s * len)); }
  return cnOwn(new T.LatheGeometry(pts, 26));
}
function cnFireMat(c0, c1, c2, I, amp) {
  const T = CINE.T;
  return cnOwn(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false,
    uniforms: { uTime: CINE.pu.uTime, tNoise: { value: CINE.noise }, uI: { value: I }, uCut: { value: 1 }, uFlick: { value: 0 }, uAmp: { value: amp }, uC0: { value: new T.Color(c0[0], c0[1], c0[2]) }, uC1: { value: new T.Color(c1[0], c1[1], c1[2]) }, uC2: { value: new T.Color(c2[0], c2[1], c2[2]) } },
    vertexShader: CN_FIRE_VS, fragmentShader: CN_FIRE_FS,
  }));
}
const CN_SMOKE_FS = `
uniform float uTime, uA; uniform vec3 uCol, uLit; uniform sampler2D tNoise;
varying vec2 vUv; varying vec3 vN, vV;
void main(){
  float n = texture2D(tNoise, vUv * vec2(4.0, 1.0) + vec2(uTime * 0.05, -uTime * 0.12)).r;
  float fres = abs(dot(normalize(vN), normalize(vV)));
  float a = smoothstep(0.28, 0.8, n) * (0.35 + 0.65 * fres) * uA;
  vec3 c = mix(uCol, uLit, pow(1.0 - fres, 2.0) * 0.8 + n * 0.15);
  gl_FragColor = vec4(c, a);
}`;
function cnSmokeMat(col, lit) {
  const T = CINE.T;
  return cnOwn(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
    uniforms: { uTime: CINE.pu.uTime, tNoise: { value: CINE.noise }, uA: { value: 0 }, uAmp: { value: 2 }, uCol: { value: cnLin(col) }, uLit: { value: cnLin(lit) } },
    vertexShader: CN_FIRE_VS, fragmentShader: CN_SMOKE_FS,
  }));
}
// one expanding shock sphere / ring (fresnel edge, additive)
function cnShockMat() {
  const T = CINE.T;
  return cnOwn(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false,
    uniforms: { uA: { value: 0 }, uC: { value: new T.Color(1, 0.8, 0.5) } },
    vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform float uA; uniform vec3 uC; varying vec3 vN, vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uC * (0.03 + 1.5 * pow(f, 3.0)), uA * (0.05 + 0.95 * pow(f, 2.2))); }",
  }));
}

/* ===================== B11: camera director ===================== */
const CN_EASE = { lin: (k) => k, in: (k) => k * k, out: (k) => 1 - (1 - k) * (1 - k), inout: cnSmooth, io3: cnInOut, out3: cnOut3 };
const CN_SEP = 150, CN_MID = 75;   // the loser stands CN_SEP units from the winner; the pair is centred on the slab
// a position spec: [x, y, z] in script space (the winner at x = 0, the loser CN_SEP further on, mirrored by dir), or { a: "W.head", o: [x, y, z] }
function cnPt(spec, out) {
  const D = CINE.dir;
  if (Array.isArray(spec)) return out.set((spec[0] - CN_MID) * D, spec[1], spec[2]);
  const A = CINE.anc[spec.a.charAt(0)][spec.a.slice(2)];
  out.copy(A);
  if (spec.o) { out.x += spec.o[0] * D; out.y += spec.o[1]; out.z += spec.o[2]; }
  return out;
}
function cnFovFix(fov) {
  const asp = CINE.w / CINE.h, k = asp >= 1.6 ? 1 : Math.min(fov > 24 ? 3.4 : 2.4, Math.pow(1.6 / asp, 0.85));   // upright phones: widen the lens so the pair still fits
  return (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * k) * 180) / Math.PI;
}
// evaluates the film's shots at real time tr into CINE.camera (position, look, roll, fov) plus shake, kick and hand-held drift
function cnCamera(film, tr) {
  const V = CINE.v, cam = CINE.camera, shots = film.shots;
  let sh = shots[0];
  for (let i = 0; i < shots.length; i++) if (tr >= shots[i].t0) sh = shots[i];
  let fov = 30, roll = 0;
  const pos = V.cp, look = V.cl;
  if (sh.fn) { const r = sh.fn(cnProg(sh.t0, sh.t1, tr), tr, pos, look); fov = r.fov; roll = r.roll || 0; }
  else {
    const ks = sh.keys; let i = 1;
    while (i < ks.length - 1 && tr > ks[i].t) i++;
    const a = ks[Math.max(0, i - 1)], b = ks[i], k = (CN_EASE[b.e || sh.e || "inout"])(cnProg(a.t, b.t, tr));
    cnPt(a.pos, V.p0); cnPt(b.pos, V.p1); pos.lerpVectors(V.p0, V.p1, k);
    cnPt(a.look, V.p0); cnPt(b.look, V.p1); look.lerpVectors(V.p0, V.p1, k);
    fov = cnMix(a.fov, b.fov, k); roll = cnMix(a.roll || 0, b.roll || 0, k);
  }
  const dist = Math.max(60, pos.distanceTo(look)), sc = dist / 300;
  // shake: a sum of three slow sines (a hand, never random jitter); drift is always on
  const tt = tr / 1000;
  let sx = Math.sin(tt * 1.3) * 0.5 + Math.sin(tt * 2.9 + 1) * 0.25, sy = Math.sin(tt * 1.7 + 2) * 0.4 + Math.sin(tt * 3.3) * 0.2, sr = 0;
  const sk = film.shake || [];
  for (const s of sk) {
    if (tr < s.t0 || tr > s.t0 + s.dur) continue;
    const u = (tr - s.t0) / s.dur, env = s.amp * (s.hold ? Math.min(1, (1 - u) * 6) : Math.pow(1 - u, 1.6)) * sc;
    sx += env * (Math.sin(tt * 7.3 * 6.283) * 0.6 + Math.sin(tt * 17.7 * 6.283 + 1.3) * 0.4);
    sy += env * (Math.sin(tt * 11.1 * 6.283 + 0.7) * 0.6 + Math.sin(tt * 7.9 * 6.283 + 2.1) * 0.4);
    sr += env * 0.0016 * Math.sin(tt * 9.1 * 6.283);
  }
  cam.position.copy(pos);
  V.fw.subVectors(look, pos).normalize(); V.rt.crossVectors(V.fw, cam.up.set(0, 1, 0)).normalize(); V.up2.crossVectors(V.rt, V.fw);
  cam.position.addScaledVector(V.rt, sx * 0.5 * sc).addScaledVector(V.up2, sy * 0.5 * sc);
  const kk = CINE.kick;
  if (kk.amp && tr >= kk.t0) { const u = (tr - kk.t0) / 1000, e = Math.exp(-u * 7) * Math.cos(u * 14); cam.position.addScaledVector(kk.dir, kk.amp * e); if (u > 1) kk.amp = 0; }
  cam.up.set(0, 1, 0);
  cam.lookAt(look);
  if (roll + sr) cam.rotateZ(roll + sr);
  const f = cnFovFix(fov);
  if (Math.abs(cam.fov - f) > 1e-4) { cam.fov = f; cam.updateProjectionMatrix(); }
  CINE.fov = f;
}
function cnKick(dirVec, amp, tr) { const k = CINE.kick; k.dir.copy(dirVec).normalize(); k.amp = amp; k.t0 = tr; }
// world time: real time with the film's speed ramp folded in (integrated in small steps so a long frame is exact)
function cnAdvanceWorld(film, tr0, tr1) {
  const n = Math.max(1, Math.ceil((tr1 - tr0) / 16)), h = (tr1 - tr0) / n;
  let tw = CINE.tw;
  for (let i = 0; i < n; i++) tw += h * cnTrack(film.ramp, tr0 + h * (i + 0.5));
  CINE.tw = tw;
}

/* ===================== B10: the crack web (2D) and the shattering pane (3D) ===================== */
function cnClip(poly, w, h) {
  // Sutherland-Hodgman against the viewport rectangle
  let out = poly;
  const edges = [[(p) => p[0] >= 0, (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + (b[1] - a[1]) * t]; }],
    [(p) => p[0] <= w, (a, b) => { const t = (w - a[0]) / (b[0] - a[0]); return [w, a[1] + (b[1] - a[1]) * t]; }],
    [(p) => p[1] >= 0, (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, 0]; }],
    [(p) => p[1] <= h, (a, b) => { const t = (h - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, h]; }]];
  for (const [inside, cut] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
// ix, iy: the impact in screen px. Rays bend at three ring radii, so the cracks drawn in 2D are exactly the edges of the shards.
function cnWeb(ix, iy, w, h) {
  const rnd = cnRng(777), n = 10, D = Math.hypot(w, h), R = [0.07, 0.16, 0.32].map((r) => r * D), a0 = rnd() * 6.283, rays = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + (rnd() - 0.5) * 0.5) * (6.2832 / n), pts = [[ix, iy]];
    for (let k = 0; k < 3; k++) { const r = R[k] * (0.82 + 0.36 * rnd()), aa = a + (rnd() - 0.5) * 0.16; pts.push([ix + Math.cos(aa) * r, iy + Math.sin(aa) * r]); }
    const far = [ix + Math.cos(a) * D * 3, iy + Math.sin(a) * D * 3];
    rays.push({ a, pts, far, spd: 0.8 + rnd() * 0.5 });
  }
  const cells = [];
  for (let i = 0; i < n; i++) {
    const A = rays[i], B = rays[(i + 1) % n], c = [ix, iy];
    cells.push([c, A.pts[1], B.pts[1]], [A.pts[1], A.pts[2], B.pts[2], B.pts[1]], [A.pts[2], A.pts[3], B.pts[3], B.pts[2]], [A.pts[3], A.far, B.far, B.pts[3]]);
  }
  // little forks along the rays (cosmetic)
  const forks = [];
  for (const r of rays) for (let k = 1; k <= 3; k++) { if (rnd() < 0.7) { const a = r.a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7), l = 14 + rnd() * 34; forks.push({ x: r.pts[k][0], y: r.pts[k][1], x2: r.pts[k][0] + Math.cos(a) * l, y2: r.pts[k][1] + Math.sin(a) * l, k }); } }
  return { ix, iy, w, h, rays, cells, forks, n };
}
// draws the web grown to time t onto a 2D context in screen px (the glass is in front of the picture)
function cnDrawWeb(c, web, t) {
  const k0 = cnProg(CT.CRACK, CT.SHATTER - 40, t);
  if (k0 <= 0) return;
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  const lvl = (r) => Math.min(3, k0 * 3.4 * r.spd);   // how many ring levels this ray has reached
  const segs = [];
  for (const r of web.rays) {
    const L = lvl(r); let pts = [r.pts[0]];
    for (let k = 1; k <= 3; k++) {
      if (L >= k) pts.push(r.pts[k]);
      else if (L > k - 1) { const q = L - (k - 1), a = r.pts[k - 1], b = r.pts[k]; pts.push([a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]); break; }
    }
    if (L >= 3 && k0 > 0.85) { const q = cnProg(0.85, 1, k0), a = r.pts[3]; pts.push([a[0] + (r.far[0] - a[0]) * q * 0.15, a[1] + (r.far[1] - a[1]) * q * 0.15]); }
    segs.push(pts);
  }
  const rings = [];
  for (let i = 0; i < web.n; i++) {
    const A = web.rays[i], B = web.rays[(i + 1) % web.n];
    for (let k = 1; k <= 3; k++) if (lvl(A) >= k && lvl(B) >= k) rings.push([A.pts[k], B.pts[k]]);
  }
  for (const pass of [0, 1]) {
    c.strokeStyle = pass ? "rgba(255,255,255,0.9)" : "rgba(10,12,28,0.55)"; c.lineWidth = pass ? 1.4 : 3.4;
    c.beginPath();
    for (const pts of segs) { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); }
    for (const [a, b] of rings) { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    for (const f of web.forks) if (k0 * 3.4 > f.k + 0.2) { c.moveTo(f.x, f.y); c.lineTo(f.x2, f.y2); }
    c.stroke();
  }
  // the impact itself: a bright star with a few rays
  const g = c.createRadialGradient(web.ix, web.iy, 0, web.ix, web.iy, 46); g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.3, "rgba(255,244,220,0.35)"); g.addColorStop(1, "rgba(255,244,220,0)");
  c.fillStyle = g; c.fillRect(web.ix - 46, web.iy - 46, 92, 92);
  c.restore();
}
// the pane: the captured 2D picture cut along the same cracks; every shard is a mesh that flies away from the impact
function cinePane(web, camPos, camQuat, fov) {
  const T = CINE.T, Dp = 150, Hp = 2 * Dp * Math.tan((fov * Math.PI) / 360), Wp = Hp * (web.w / web.h), rnd = cnRng(4242);
  const grp = new T.Group(), shards = [];
  const mat = cnOwn(new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide, color: 0xffffff }));
  const lineMat = cnOwn(new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, toneMapped: false, depthWrite: false }));
  const tx = (p) => (p[0] / web.w - 0.5) * Wp, ty = (p) => (p[1] / web.h - 0.5) * -Hp;
  for (const cell of web.cells) {
    const poly = cnClip(cell, web.w, web.h);
    if (poly.length < 3) continue;
    let cx = 0, cy = 0, area = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; cx += a[0]; cy += a[1]; }
    if (Math.abs(area) < 120) continue;
    cx /= poly.length; cy /= poly.length;
    const pos = [], uv = [], idx = [];
    pos.push(0, 0, 0); uv.push(cx / web.w, 1 - cy / web.h);
    for (const p of poly) { pos.push(tx(p) - tx([cx, cy]), ty(p) - ty([cx, cy]), 0); uv.push(p[0] / web.w, 1 - p[1] / web.h); }
    for (let i = 0; i < poly.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % poly.length));
    const g = cnOwn(new T.BufferGeometry());
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const lp = []; for (let i = 0; i < poly.length; i++) lp.push(pos[3 + i * 3], pos[4 + i * 3], 0.002);
    const lg = cnOwn(new T.BufferGeometry()); lg.setAttribute("position", new T.Float32BufferAttribute(lp, 3));
    const sh = new T.Group(); sh.add(new T.Mesh(g, mat)); sh.add(new T.LineLoop(lg, lineMat));
    sh.position.set(tx([cx, cy]), ty([cx, cy]), 0);
    const dx = cx - web.ix, dy = cy - web.iy, dl = Math.hypot(dx, dy) || 1, near = 1 - Math.min(1, dl / (web.w * 0.5));
    const sp = (0.5 + rnd() * 0.9) * Hp * (0.6 + near * 0.9);
    shards.push({ g: sh, x0: sh.position.x, y0: sh.position.y, vx: (dx / dl) * sp, vy: (-dy / dl) * sp, vz: Hp * (0.9 + near * 2.2 + rnd() * 1.2), ax: (rnd() - 0.5) * 7, ay: (rnd() - 0.5) * 7, az: (rnd() - 0.5) * 4 });
    grp.add(sh);
  }
  grp.position.copy(camPos).add(CINE.v.fw.set(0, 0, -Dp).applyQuaternion(camQuat)); grp.quaternion.copy(camQuat);
  CINE.scene.add(grp);
  return { grp, shards, mat, lineMat, Hp, Dp, tilt: 0 };
}
function cinePaneStep(P, tr) {
  const u = Math.max(0, (tr - CT.SHATTER) / 1000), fade = 1 - cnProg(CT.SHATTER + 130, CT.THROUGH - 10, tr);
  P.mat.opacity = fade; P.lineMat.opacity = Math.min(1, fade * 1.3); P.grp.visible = fade > 0.005;
  for (const s of P.shards) {
    s.g.position.set(s.x0 + s.vx * u, s.y0 + s.vy * u - 0.35 * P.Hp * u * u, s.vz * u);
    s.g.rotation.set(s.ax * u, s.ay * u, s.az * u);
  }
}
function cinePaneDrop() {
  const P = CINE.pane;
  if (!P) return;
  CINE.scene.remove(P.grp);
  if (P.tex) P.tex.dispose();
  for (const s of P.shards) { s.g.children[0].geometry.dispose(); s.g.children[1].geometry.dispose(); }
  P.mat.dispose(); P.lineMat.dispose(); CINE.pane = null;
}

/* ===================== B9: blast-out (the loser leaves along the real launch direction) ===================== */
// position of the launched loser, in world units: the same flight line as the 2D finisher (finTrav), plus a drift towards the lens
function cnBlastPos(C, tw, out) {
  const bo = C.bo, f = Math.max(0, (tw - bo.tw0) / FMS), trav = finTrav(f);
  out.x = bo.x0 + FIN.ldx * trav;
  out.y = bo.y0 - FIN.ldy * trav;
  out.z = bo.z0 + 55 * Math.min(1, trav / 900);
  return out;
}
function cnRibbon(N) {
  const T = CINE.T, g = cnOwn(new T.BufferGeometry()), pos = new Float32Array(N * 2 * 3), uv = new Float32Array(N * 2 * 2), idx = [];
  for (let i = 0; i < N; i++) { uv[i * 4] = 0; uv[i * 4 + 1] = i / (N - 1); uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / (N - 1); if (i < N - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
  g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("uv", new T.BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = cnOwn(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false,
    uniforms: { uTime: CINE.pu.uTime, tNoise: { value: CINE.noise }, uA: { value: 0 }, uC0: { value: new T.Color(2.4, 2.0, 1.3) }, uC1: { value: new T.Color(1.7, 0.5, 0.1) }, uC2: { value: new T.Color(0.3, 0.03, 0) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float uTime, uA; uniform vec3 uC0, uC1, uC2; uniform sampler2D tNoise; varying vec2 vUv; void main(){ float e = 1.0 - abs(vUv.x - 0.5) * 2.0; float n = texture2D(tNoise, vec2(vUv.x * 1.3, vUv.y * 2.0 - uTime * 1.6)).r; float a = pow(e, 1.4) * (1.0 - vUv.y) * (0.45 + 0.9 * n); vec3 c = mix(uC0, uC1, smoothstep(0.0, 0.45, vUv.y + (1.0 - e) * 0.4)); c = mix(c, uC2, smoothstep(0.35, 1.0, vUv.y + (1.0 - e) * 0.3)); gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * uA); }",
  }));
  const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
  return { mesh, mat, pos, g, N, pts: [], lastT: -1e9 };
}
function cnRibbonStep(R, p, tw, width, camPos) {
  if (tw - R.lastT > 11) { R.lastT = tw; R.pts.push(p.x, p.y, p.z); if (R.pts.length > R.N * 3) R.pts.splice(0, 3); }
  const n = R.pts.length / 3, V = CINE.v, pos = R.pos;
  if (n < 2) { R.mesh.visible = false; return; }
  R.mesh.visible = true;
  for (let i = 0; i < R.N; i++) {
    const j = Math.max(0, n - 1 - i), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);   // i = 0 is the head
    V.a.set(R.pts[j * 3], R.pts[j * 3 + 1], R.pts[j * 3 + 2]);
    V.b.set(R.pts[j1 * 3] - R.pts[j0 * 3], R.pts[j1 * 3 + 1] - R.pts[j0 * 3 + 1], R.pts[j1 * 3 + 2] - R.pts[j0 * 3 + 2]);
    V.c.subVectors(camPos, V.a); V.d.crossVectors(V.b, V.c); const l = V.d.length() || 1; V.d.multiplyScalar(1 / l);
    const w = width * (1 - (i / (R.N - 1)) * 0.85);
    pos[(i) * 6] = V.a.x - V.d.x * w; pos[i * 6 + 1] = V.a.y - V.d.y * w; pos[i * 6 + 2] = V.a.z - V.d.z * w;
    pos[i * 6 + 3] = V.a.x + V.d.x * w; pos[i * 6 + 4] = V.a.y + V.d.y * w; pos[i * 6 + 5] = V.a.z + V.d.z * w;
  }
  R.g.attributes.position.needsUpdate = true;
}

/* ===================== B13: the cinema sound kit (Web Audio synth, one compressed bus) ===================== */
const Cin = {
  bus: null, comp: null, duck: false,
  ok() { return Sfx.ok(); },
  open() {
    if (!Sfx.ok()) return false;
    if (this.bus && this.bus.context === Sfx.ctx) return true;
    const c = Sfx.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0.85;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.knee.value = 12; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.18;
    this.bus.connect(this.comp); this.comp.connect(c.destination);
    return true;
  },
  close() {
    try { if (this.bus) { this.bus.disconnect(); this.comp.disconnect(); } } catch (e) { /* gone */ }
    this.bus = null; this.comp = null;
    try { if (this.duck && Sfx.out) { Sfx.out.gain.cancelScheduledValues(0); Sfx.out.gain.value = 0.55; } } catch (e) { /* gone */ }
    this.duck = false;
  },
  // the game's own sounds dip to a hum while the film plays; the film's bus is untouched
  dipGame(to, sec) {
    if (!Sfx.ok()) return; const g = Sfx.out.gain, t = Sfx.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + sec); this.duck = true;
  },
  _pan(c, v) { if (!c.createStereoPanner) return null; const p = c.createStereoPanner(); p.pan.value = v; return p; },
  _env(g, t, a, peak, dur, tail) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (tail || 0)); },
  _osc(type, f0, f1, dur, vol, a, when, detune) {
    const c = Sfx.ctx, t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur); if (detune) o.detune.value = detune;
    this._env(g, t, a || 0.01, vol, dur); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.1); return o;
  },
  _noise(dur, vol, f0, f1, type, q, when, pan) {
    const c = Sfx.ctx, t = c.currentTime + (when || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = Sfx.noiseBuf; f.type = type || "lowpass"; f.Q.value = q || 0.7; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this._env(g, t, Math.min(0.05, dur * 0.3), vol, dur); s.connect(f); f.connect(g);
    const p = pan === undefined ? null : this._pan(c, pan);
    if (p) { g.connect(p); p.connect(this.bus); } else g.connect(this.bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1); return s;
  },
  // the silence before a blast: the film's bus dips to 10% in 60 ms, holds, then snaps back
  drop(hold) { if (!this.bus) return; const g = this.bus.gain, t = Sfx.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.1, t + 0.06); g.setValueAtTime(0.1, t + 0.06 + hold); g.linearRampToValueAtTime(0.85, t + 0.08 + hold); },
  go(fn) { try { if (this.open()) fn(); } catch (e) { /* sound off or not ready */ } },
  sub(f0, f1, dur, vol) { this._osc("sine", f0 || 55, f1 || 28, dur || 0.5, vol || 0.7, 0.01); },
  riser(dur, vol) { this._noise(dur, (vol || 0.3), 300, 5200, "bandpass", 1.2); this._osc("sawtooth", 180, 520, dur, (vol || 0.3) * 0.25, dur * 0.8); this._osc("sawtooth", 184, 528, dur, (vol || 0.3) * 0.25, dur * 0.8, 0, 8); },
  impact(vol) { const v = vol || 1; this._osc("sine", 90, 26, 0.9, 0.9 * v, 0.004); this._noise(0.5, 0.6 * v, 3200, 200, "lowpass", 0.7); this._noise(0.9, 0.18 * v, 1200, 400, "lowpass", 0.5, 0.12); },
  stab(f, dur) { for (const d of [-9, 0, 9]) this._osc("sawtooth", (f || 110) * 1.5, (f || 110) * 1.5 * 0.7, dur || 0.7, 0.07, 0.01, 0, d); },
  shimmer(f, dur) { for (let i = 0; i < 6; i++) this._osc("sine", (f || 880) * (1 + i * 0.5), (f || 880) * (1 + i * 0.5) * 0.99, dur || 1.6, 0.035, 0.2, 0, i * 6); },
  whoosh(dur, from, to, vol) { this._noise(dur, vol || 0.4, 400, 3600, "bandpass", 0.9, 0, from); if (to !== undefined) { /* pan sweep is approximated by two overlapping sweeps */ this._noise(dur, (vol || 0.4) * 0.7, 3600, 500, "bandpass", 0.9, dur * 0.35, to); } },
  chime(f) { this._osc("sine", f || 1760, f || 1760, 0.9, 0.08, 0.004); this._osc("sine", (f || 1760) * 2, (f || 1760) * 2, 0.5, 0.04, 0.004); },
  growl(dur) { const o = this._osc("sawtooth", 55, 50, dur || 1, 0.22, 0.2); try { const c = Sfx.ctx, l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 9; lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency); l.start(); l.stop(c.currentTime + (dur || 1) + 0.2); } catch (e) { /* no lfo */ } this._noise(dur || 1, 0.1, 260, 120, "lowpass"); },
  rumble(dur) { this._osc("sawtooth", 40, 36, dur || 1, 0.3, 0.05); this._noise(dur || 1, 0.35, 420, 140, "lowpass"); },
  inhale(dur) { this._noise(dur, 0.45, 500, 3400, "bandpass", 1.6); this._osc("sawtooth", 120, 400, dur, 0.1, dur * 0.85); },
  roar(dur) { this._noise(dur, 0.55, 1400, 700, "bandpass", 0.8); this._osc("sawtooth", 70, 58, dur, 0.28, 0.06); this._osc("square", 140, 110, dur, 0.06, 0.06); },
  tick(f) { this._osc("triangle", f || 2600, (f || 2600) * 0.4, 0.05, 0.12, 0.002); this._noise(0.03, 0.2, 7000, 3000, "highpass"); },
  glass() { this._noise(0.35, 0.5, 9000, 2400, "highpass"); this._osc("triangle", 3200, 900, 0.3, 0.1, 0.002); this._noise(0.9, 0.2, 6000, 1800, "bandpass", 2, 0.05); },
  clack() { this._noise(0.05, 0.5, 5200, 1400, "highpass"); this._osc("square", 300, 90, 0.08, 0.12, 0.002); },
  boom(vol) { this.sub(70, 24, 0.9, vol || 0.9); this._noise(0.6, 0.4 * (vol || 1), 900, 120, "lowpass"); },
};

/* ===================== the orchestrator: warm-up, start, frame, end ===================== */
function cineLayers(on) {
  if (CINE.layers === on) return;
  CINE.layers = on;
  glcv.style.display = on ? "block" : "none";
  ovcv.style.display = FIN.cine || on ? "block" : "none";
}
function cineHas(g) { for (const f of g.fighters) if (FILMS[f.spec.id]) return f.spec.id; return ""; }
// every film this match may need (both fighters can win): one "world" each (scene, set, lights, env map, the film's own objects).
// The renderer, camera, post chain, textures and the two hero rigs are shared; the rigs move into the winner's world at the start.
function cineFilmIds(g) { const ids = []; for (const f of g.fighters) if (FILMS[f.spec.id] && !ids.includes(f.spec.id)) ids.push(f.spec.id); return ids; }
function cineUse(fid) {
  const C = CINE, w = C.worlds[fid];
  C.film = w.film; C.scene = w.scene; C.set = w.set; C.lights = w.lights; C.env = w.env; C.fx = w.fx;
  if (C.rpass) C.rpass.scene = w.scene;
  if (C.renderer) C.renderer.toneMappingExposure = w.film.exposure || 1;
  for (const rig of C.rigs) if (rig) { w.scene.add(rig.root); if (rig.blob) w.scene.add(rig.blob); }
}
function cineWorld(fid) {
  const C = CINE, T = C.T, w = { film: FILMS[fid], scene: new T.Scene(), ready: false };
  C.worlds[fid] = w; C.worldIds.push(fid);
  C.scene = w.scene; C.film = w.film;
  return w;
}
function cineWorldFill(w) {   // what cineStage3 made for the current world, kept with it
  w.set = CINE.set; w.lights = CINE.lights; w.env = CINE.env; w.fx = CINE.fx;
}
function cineLost(e) { e.preventDefault(); cineFail("WebGL context lost"); }
// one step per frame while a match runs (the countdown covers it), so the KO frame never has to build or compile anything
function cineWarmStep(g) {
  if (CINE.ready || CINE.failed || !CINE.libs || CINE.warming) return;
  const ids = cineFilmIds(g), fid = ids[0];
  if (!fid) return;
  const key = rigKey(g.fighters[0]) + "/" + rigKey(g.fighters[1]);
  if (CINE.slots && CINE.slots !== key) cineFree();
  const t0 = performance.now();
  CINE.warming = true;
  try {
    const S = CINE.stage;
    if (S === 0) cineStage0(g, key, fid);
    else if (S === 1) cineStage1();
    else if (S === 2) { cinePost(); cineSize(); }
    else if (S === 3) cineStage3();
    else if (S === 4) cineRigAt(g, 0);
    else if (S === 5) cineRigAt(g, 1);
    else if (S === 6) { CINE.film.build(CINE); }
    else if (S === 7) { cineWarmRender(); cineWorldFill(CINE.worlds[fid]); CINE.worlds[fid].ready = true; }
    else {
      // the other fighter's film, if it has one: its own world, built and compiled in three more steps
      const k = Math.floor((S - 8) / 3), sub = (S - 8) % 3, fid2 = ids[1 + k];
      if (sub === 0) { cineWorld(fid2); cineStage3(); cineWorldFill(CINE.worlds[fid2]); }
      else if (sub === 1) { cineUse(fid2); CINE.film.build(CINE); }
      else { cineUse(fid2); cineWarmRender(); CINE.worlds[fid2].ready = true; }
    }
    if (!CINE.failed) {
      CINE.stage = S + 1; CINE.ms.push(Math.round(performance.now() - t0));
      // every film this match needs is warm: back to the first world, ready
      if (CINE.stage >= 8 + 3 * (ids.length - 1)) { cineUse(fid); CINE.ready = true; }
    }
  } catch (e) { CINE.warming = false; cineFail(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e); return; }
  CINE.warming = false;
}
function cineStage0(g, key, fid) {
  const T = CINE.T;
  CINE.tier = cineTierName(); CINE.cfg = CT_TIERS[CINE.tier];
  CINE.slots = key; CINE.hasRes = true; CINE.ms = []; CINE.film = FILMS[fid]; CINE.fid0 = fid; CINE.worlds = {}; CINE.worldIds = [];
  if (!CINE.renderer) {
    // probe on a throw-away canvas first: three.js logs a console error when it cannot get a context, and a phone without WebGL is a normal case, not an error
    const pc = document.createElement("canvas"); let px = null;
    try { px = pc.getContext("webgl2") || pc.getContext("webgl"); } catch (e) { px = null; }
    if (!px) throw new Error("no WebGL");
    try { const ext = px.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } catch (e) { /* the probe context is only being freed */ }
    const r = new T.WebGLRenderer({ canvas: glcv, antialias: false, alpha: true, powerPreference: "high-performance", stencil: false });
    if (!r.getContext()) throw new Error("no WebGL context");
    glcv.addEventListener("webglcontextlost", cineLost);
    CINE.renderer = r;
  }
  const r = CINE.renderer;
  r.setClearColor(0x000000, 1); r.outputEncoding = T.sRGBEncoding;
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = CINE.film.exposure || 1;
  r.shadowMap.enabled = CINE.cfg.shadow; r.shadowMap.type = T.PCFSoftShadowMap;
  const mk = () => new T.Vector3();
  CINE.v = { a: mk(), b: mk(), c: mk(), d: mk(), o: mk(), cp: mk(), cl: mk(), p0: mk(), p1: mk(), fw: mk(), rt: mk(), up2: mk(), pj: mk(), pk: mk(), tip: mk(), axis: mk(), q: new T.Quaternion(), c0: null };
  CINE.pu = { uTime: { value: 0 }, uScale: { value: 500 } };
  CINE.kick = { dir: mk(), amp: 0, t0: 0 };
  CINE.anc = { W: cnAnchorSet(), L: cnAnchorSet() };
  CINE.rnd = cnRng(20261013);
  CINE.pk = Math.max(0.1, CINE.cfg.parts / 6000);
  CINE.w = CINE.h = CINE.pr = 0;
}
function cineStage1() {
  const T = CINE.T;
  cineWorld(CINE.fid0);   // the first film's world; cineStage3 fills it
  CINE.camera = new T.PerspectiveCamera(30, 1, 4, 7000);
  CINE.noise = cnNoiseTex(); CINE.atlas = cnAtlas();
  R3.T = T;
  if (!R3.G) r3Shared();
  R3.tex.crack = cnCrackTex();
}
function cineStage3() {
  const T = CINE.T, film = CINE.film;
  CINE.set = cineSet(film);
  CINE.scene.fog = new T.FogExp2(cnLin(film.fog.color), film.fog.density);
  CINE.lights = cineLights(film);
  CINE.env = cineEnv(film);
  CINE.scene.environment = CINE.env.texture;
  CINE.fx = { glows: cnGlowPool(10) };
  for (const s of CINE.fx.glows) CINE.scene.add(s);
}
// a soft dark blob under a fighter (every tier; tier A also has the real shadow)
function cnBlobTex() { return cnTex(cnGlowCanvas(64, [[0, "rgba(0,0,0,0.85)"], [0.5, "rgba(0,0,0,0.45)"], [1, "rgba(0,0,0,0)"]]), false); }
function cnBlobStep(rig) {
  const b = rig.blob, r = rig.root, up = Math.max(0, 1 - Math.max(0, r.position.y) / 70);
  b.position.set(r.position.x, 0.6, r.position.z); const s = rig.B.w * 2.1 * r.scale.x * (0.7 + 0.3 * up); b.scale.set(s, s * 0.78, 1);
  b.material.opacity = 0.7 * up; b.visible = up > 0.02 && r.visible;
}
function cineRigAt(g, slot) {
  const T = CINE.T, rig = buildRig(g.fighters[slot], { hero: true, seg: CINE.cfg.seg });
  rig.root.visible = false; CINE.scene.add(rig.root); CINE.rigs[slot] = rig;
  if (!CINE.blobTex) CINE.blobTex = cnBlobTex();
  rig.blob = new T.Mesh(cnOwn(new T.PlaneGeometry(1, 1)), cnOwn(new T.MeshBasicMaterial({ map: CINE.blobTex, transparent: true, depthWrite: false, fog: false, color: 0x000000 })));
  rig.blob.rotation.x = -Math.PI / 2; rig.blob.renderOrder = 1; CINE.scene.add(rig.blob);
  drawFaceDecal(rig, "rest");
}
function cineWarmRender() {
  const C = CINE, r = C.renderer;
  // everything on screen once, with the real post chain, so every program is compiled and every target allocated now
  C.rigs.forEach((rig) => { rig.root.visible = true; rig.root.position.set(0, 0, 0); });
  C.film.warm(C, true);
  C.camera.position.set(0, 60, 320); C.camera.lookAt(0, 40, 0); C.camera.fov = 30; C.camera.updateProjectionMatrix();
  C.pane0 = null;
  const pane = cinePane(cnWeb(L.gw / 2, L.gh / 2, L.gw, L.gh), C.camera.position, C.camera.quaternion, 30);
  const wc = cnCanvas(4, 4), wt = new C.T.CanvasTexture(wc); wt.encoding = C.T.sRGBEncoding; wt.generateMipmaps = false; wt.minFilter = C.T.LinearFilter;
  pane.mat.map = wt; pane.mat.needsUpdate = true;
  const t0 = performance.now();
  C.composer.render(0.016);
  r.getContext().finish && r.getContext().finish();
  C.warmMs = Math.round(performance.now() - t0);
  C.pane = pane; cinePaneDrop(); wt.dispose();
  C.film.warm(C, false);
  C.rigs.forEach((rig) => { rig.root.visible = false; });
  // a shader that failed to link would show up here
  for (const p of r.info.programs || []) if (p.diagnostics && p.diagnostics.runnable === false) throw new Error("shader failed: " + (p.name || "") + " " + String(p.diagnostics.programLog || "").slice(0, 160));
}
// give everything back (end of the film, or the match was left)
function cineFree() {
  const C = CINE;
  if (!C.hasRes && !C.ready && C.stage === 0) return;
  try {
    cinePaneDrop();
    for (const rig of C.rigs) if (rig) { if (rig.root.parent) rig.root.parent.remove(rig.root); disposeObj(rig.root); }
    for (const w of Object.values(C.worlds || {})) {
      w.scene.traverse((o) => { if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose(); });
      w.scene.clear && w.scene.clear();
      if (w.env) w.env.dispose();
    }
    for (const o of C.own) { try { o.dispose(); } catch (e) { /* already gone */ } }
    if (R3.G) { for (const g of R3.G.bodies.values()) g.dispose(); for (const k of ["sph", "sphLo", "cyl", "cone", "oct", "leaf", "feather"]) R3.G[k].dispose(); R3.G = null; }
    if (R3.M) { for (const m of Object.values(R3.M)) m.dispose(); R3.M = null; }
    if (R3.tex) { if (R3.tex.skin) R3.tex.skin.dispose(); R3.tex = null; }
    if (C.renderer) { C.renderer.renderLists.dispose(); C.renderer.setRenderTarget(null); C.renderer.setSize(1, 1, false); }
  } catch (e) { /* best effort */ }
  C.own = []; C.rigs = [null, null]; C.scene = C.camera = C.composer = C.bloom = C.gradePass = C.gu = C.rpass = null; C.set = C.lights = C.env = C.fx = C.film = null; C.pane = null;
  C.worlds = {}; C.worldIds = [];
  C.stage = 0; C.blobTex = null; C.ready = false; C.slots = ""; C.hasRes = false; C.warming = false; C.w = C.h = C.pr = 0; C.active = false; C.bo = null; C.layers = null;
  R3.G = null; R3.M = null; R3.tex = null;
}
function cineIdle(g) {
  if (FIN.on) return;
  const live = mode === "match" && match && !match.tutorial && g === G && g && g.fighters;
  if (live && (g.phase === "countdown" || (CINE.stage > 0 && !CINE.ready && g.phase === "play"))) { if (!CINE.ready && !CINE.failed && CINE.libs) cineWarmStep(g); }
  else if (CINE.hasRes && !(live && g.phase !== "over")) cineFree();
}

/* ---------- starting a film (finStart calls this once the puppets are staged) ---------- */
function cineWanted(g) {
  const W = g.fighters[g.winner], film = FILMS[W.spec.id];
  const w = CINE.worlds && CINE.worlds[W.spec.id];
  return !!(film && w && w.ready && !CINE.failed && !CINE.warming && CINE.rigs[0] && CINE.rigs[1]);
}
function cineStart(g) {
  if (!cineWanted(g)) return false;
  const C = CINE, film = FILMS[g.fighters[g.winner].spec.id];
  try {
    cineUse(g.fighters[g.winner].spec.id);
    C.active = true; C.dir = FIN.dir; C.t = 0; C.tw = 0; C.wSlot = FIN.w; C.lSlot = FIN.l; C.frames = 0; C.lastNow = 0; C.slow = 0;
    C.kick.amp = 0; C.bo = null; C.pane = null; C.flare = null; C.cardSub = "";
    cineLightsDir(C.lights, C.dir);
    C.film.start(C);
    FIN.cine = true; FIN.cardSub = `${g.fighters[g.winner].spec.signature.name} finish`;
    // the crack web grows from the impact, in screen px
    const ev = FIN.ev, d = g.fighters[1 - g.winner];
    const pt = ev ? toScreen(ev.x, ev.y - d.s.h * 0.5) : toScreen(d.x, d.y - d.s.h * 0.5);
    C.web = cnWeb(clamp(pt[0], L.gw * 0.15, L.gw * 0.85), clamp(pt[1], L.gh * 0.3, L.gh * 0.7), L.gw, L.gh);
    // upright phone: take the controls panel away now so the picture that shatters is already the full screen
    if (L.panel) { finFull = true; resize(); C.web = cnWeb(C.web.ix, clamp(C.web.iy, L.gh * 0.3, L.gh * 0.7), L.gw, L.gh); }
    $("ctl").hidden = true; releaseTouch();
    cineLayers(false);
    ovcv.style.display = "block";
    if (ovcv.width !== cv.width || ovcv.height !== cv.height) { ovcv.width = cv.width; ovcv.height = cv.height; }
    Cin.go(() => Cin.dipGame(0.09, 0.2));
    return true;
  } catch (e) { cineFail(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e); return false; }
}
// a failure after the film started: the old 2D finisher plays from its start
function cineBail() {
  FIN.cine = false; cv.style.transform = "";
  FIN.t = FT.CUT - 1; FIN.cut = false; FIN.cue = {}; FIN.parts.length = 0; FIN.flashes.length = 0;
  cineEnd();
}
// end of the film (or of the match): hide the layers, free the GPU
function cineEnd() {
  const C = CINE;
  FIN.cine = false;
  cv.style.transform = "";
  if (C.layers) cineLayers(false);
  glcv.style.display = "none"; ovcv.style.display = "none"; octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, ovcv.width, ovcv.height);
  C.layers = null; C.active = false;
  Cin.close();
  cineFree();
}

/* ---------- the 2D layer over the film: letterbox, lens flare, name card, shutters ---------- */
function cnDrawFlare(o, f) {
  const cx = L.gw / 2, cy = L.gh / 2, dx = cx - f.x, dy = cy - f.y, big = Math.max(L.gw, L.gh);
  o.save(); o.globalCompositeOperation = "lighter";
  const blob = (x, y, r, rgb, a) => { const g = o.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${(a * f.a).toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`); o.fillStyle = g; o.fillRect(x - r, y - r, r * 2, r * 2); };
  blob(f.x, f.y, big * 0.2, "255,170,80", 0.55);
  for (const [k, r, rgb, a] of [[0.55, 0.045, "255,120,60", 0.5], [1.0, 0.09, "255,190,100", 0.35], [1.45, 0.035, "255,235,190", 0.55], [2.0, 0.14, "255,110,50", 0.25]]) blob(f.x + dx * k, f.y + dy * k, big * r, rgb, a);
  const sg = o.createLinearGradient(f.x - big * 0.5, 0, f.x + big * 0.5, 0); sg.addColorStop(0, "rgba(255,150,70,0)"); sg.addColorStop(0.5, `rgba(255,200,130,${(0.5 * f.a).toFixed(3)})`); sg.addColorStop(1, "rgba(255,150,70,0)");
  o.fillStyle = sg; o.fillRect(f.x - big * 0.5, f.y - 1.5, big, 3);
  o.restore();
}
function cineOverlay(o, tk) {
  const C = CINE, t = FIN.t, gl = o === octx;
  if (gl) { o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, ovcv.width, ovcv.height); }
  o.save(); o.setTransform(DPR, 0, 0, DPR, 0, 0);
  o.beginPath(); o.rect(0, 0, L.gw, L.gh); o.clip();
  if (gl && C.flare && C.flare.a > 0.01) cnDrawFlare(o, C.flare);
  if (t >= CT.CARD) finCard(o, t - CT.CARD + FT.CARD);
  const bar = easeOut(fe(0, 240, t)) * L.gh * 0.11;
  o.fillStyle = "#05050b"; o.fillRect(0, 0, L.gw, bar); o.fillRect(0, L.gh - bar, L.gw, bar);
  if (bar > 14 && t > CT.SKIP) {
    o.font = `600 ${Math.round(clamp(bar * 0.34, 10, 14))}px system-ui, sans-serif`; o.textAlign = "right"; o.textBaseline = "middle";
    o.fillStyle = "rgba(217,212,234,0.6)"; o.fillText(touchUI ? "Tap to skip" : "Click or press a key to skip", L.gw - 16, L.gh - bar / 2);
  }
  // shutters: two black halves close over the picture, the results open them again
  const sh = fe(CT.OUTRO, CT.CLOSED, t);
  if (sh > 0) { const k = cnSmooth(sh) * (L.gh / 2 + 1); o.fillStyle = "#05050b"; o.fillRect(0, 0, L.gw, k); o.fillRect(0, L.gh - k, L.gw, k); }
  o.restore();
}

/* ---------- per frame ---------- */
const CN_SHUT = $("cShut");
// called from finFrame while FIN.cine: moves the timeline, runs the one-offs of the 2D phase, ends the clip
function cineTick(g, t) {
  const C = CINE;
  if (t >= CT.CLOSED) { cineFinish(); return g; }
  // 2D phase cues
  if (t >= 140 && !FIN.cue.k1) { FIN.cue.k1 = 1; Cin.go(() => Cin.tick(2400)); }
  if (t >= 270 && !FIN.cue.k2) { FIN.cue.k2 = 1; Cin.go(() => Cin.tick(3000)); }
  if (t >= 380 && !FIN.cue.k3) { FIN.cue.k3 = 1; Cin.go(() => Cin.glass()); }
  if (t >= CT.SHATTER && !FIN.cut) {
    FIN.cut = true; fx.length = 0; sfx.length = 0; trails[0].length = trails[1].length = 0; combos[0] = combos[1] = null;
    hideBanner(); fxHitOff(); $("hud").hidden = true; $("ctl").hidden = true; releaseTouch();
    // the 2D picture becomes a pane in 3D space, tilted and slid exactly as the CSS tilt left it
    const T = C.T, cm = C.camera;
    cineSize();
    cnCamera(C.film, CT.SHATTER);
    cm.updateMatrixWorld(true);
    if (!C.cfg.shatter) { cv.style.transform = ""; Cin.go(() => { Cin.whoosh(0.4, -0.8, 0.8, 0.5); Cin.sub(62, 26, 0.9, 0.9); }); return g; }   // tier C: a flash cut, no pane
    const P = C.pane = cinePane(C.web, cm.position, cm.quaternion, cm.fov), up = P.Hp / L.gh;
    P.tex = new T.CanvasTexture(cv); P.tex.minFilter = T.LinearFilter; P.tex.generateMipmaps = false; P.tex.encoding = T.sRGBEncoding;
    P.mat.map = P.tex; P.mat.needsUpdate = true;
    P.grp.translateX(3 * up); P.grp.translateY(2 * up); P.grp.rotateZ(-2 * Math.PI / 180); P.grp.scale.setScalar(1.012);
    cv.style.transform = "";
    Cin.go(() => { Cin.whoosh(0.5, -0.8, 0.8, 0.5); Cin.sub(62, 26, 0.9, 0.9); });
  }
  return g;
}
function cineFinish() {
  if (!FIN.on) return;
  FIN.skipAt = performance.now();
  cineEnd();
  if (CN_SHUT) { CN_SHUT.className = ""; void CN_SHUT.offsetWidth; CN_SHUT.className = "open"; setTimeout(() => { CN_SHUT.className = ""; }, 450); }
  Cin.go(() => Cin.clack());
  finEnd();
}
// draws the current frame: the 2D picture with the crack web first, then the 3D film
function cineDraw(g, tk) {
  const C = CINE, t = FIN.t;
  if (t < CT.SHATTER) {
    render2D(g, tk);
    cnDrawWeb(ctx, C.web, t);   // the glass is in front of the picture
    // the pane comes loose: a slight tilt and slide
    const k = cnSmooth(cnProg(CT.CRACK, CT.SHATTER, t));
    cv.style.transform = k > 0.001 ? `translate(${(3 * k).toFixed(2)}px, ${(-2 * k).toFixed(2)}px) rotate(${(2 * k).toFixed(3)}deg) scale(${(1 + 0.012 * k).toFixed(4)})` : "";
    return;
  }
  cineFrame3D(t);
}
function cnResetPost(u) {
  u.uCA.value = 0; u.uShock.value.z = 0; u.uHeatA.value = 0; u.uRayC.value.z = 0; u.uBlur.value.set(0, 0); u.uFlash.value.set(0, 0, 0); u.uFade.value = 0;
}
function cineFrame3D(t) {
  const C = CINE, film = C.film;
  const now = Date.now();
  cineLayers(true); cineSize();
  const trPrev = C.t; C.t = t;
  const twPrev = C.tw;
  cnAdvanceWorld(film, trPrev, t);
  C.pu.uTime.value = C.tw / 1000;
  cnResetPost(C.gu);
  if (C.pane) { if (t > CT.THROUGH + 60) cinePaneDrop(); else cinePaneStep(C.pane, t); }
  else if (!C.cfg.shatter && t < CT.SHATTER + 220) { const f = 0.95 * (1 - (t - CT.SHATTER) / 220); C.gu.uFlash.value.set(f, f, f); }
  film.update(C, t, C.tw, C.tw - twPrev, t - trPrev);
  cnFinishFrame(C, film, t);
  C.composer.render(0.016);
  C.frames++;
  // watchdog: a clip that cannot hold ~40 fps steps down once (bloom/resolution first, then particles); tests pin the tier and skip it
  if (!window.__cineTier && C.lastNow && now - C.lastNow < 200) {
    if (now - C.lastNow > 26) C.slow++; else C.slow = Math.max(0, C.slow - 1);
    if (C.slow >= 12 && C.tier !== "C") { cineStepDown(); C.slow = 0; }
  }
  C.lastNow = now;
}
function cineStepDown() {
  const C = CINE, next = C.tier === "A" ? "B" : "C", old = C.cfg;
  C.tier = next; C.cfg = Object.assign({}, CT_TIERS[next], { shadow: old.shadow && next === "B", seg: old.seg, parts: old.parts, hdr: old.hdr, msaa: old.msaa });
  C.w = 0;                                              // re-size with the lower pixel ratio
  C.bloom.enabled = C.cfg.bloom > 0;
  C.pkLive = next === "B" ? 0.6 : 0.3;
}
// camera, post uniforms, lights: the shared per-frame tail after the film moved its things
function cnFinishFrame(C, film, t) {
  const cam = C.camera, u = C.gu, g = film.grade, V = C.v;
  cnCamera(film, t);
  cam.updateMatrixWorld(true);
  C.pu.uScale.value = (C.h * C.pr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
  C.renderer.toneMappingExposure = (film.exposure || 1) * (C.expo || 1);
  const k = cnSmooth(cnProg(CT.SHATTER, CT.THROUGH + 120, t));
  const m3 = (a, b) => V.a.set(cnMix(1, a[0], k), cnMix(1, a[1], k), cnMix(1, a[2], k));
  u.uGain.value.copy(m3(g.gain, 0)); u.uGamma.value.copy(m3(g.gamma, 0));
  u.uLift.value.set(g.lift[0] * k, g.lift[1] * k, g.lift[2] * k);
  u.uSat.value = cnMix(1, g.sat, k); u.uVig.value = cnMix(0.15, g.vig, k); u.uGrain.value = C.cfg.grain ? g.grain * k : 0;
  u.uTime.value = C.tw / 1000;
  C.bloom.strength = (film.bloomK || 1) * (C.cfg.bloom === 2 ? 0.6 : 0.52) * (0.4 + 0.6 * k) * (C.bloomMul === undefined ? 1 : C.bloomMul);
  C.bloom.radius = 0.55; C.bloom.threshold = C.cfg.hdr ? 0.92 : 0.8;
  if (film.post) film.post(C, t, C.tw);
  if (!C.cfg.distort) { u.uHeatA.value = 0; u.uShock.value.z = 0; }
}
