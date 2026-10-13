/* ===================== Film 6: Dragon, "Inferno" =====================
   Times are ms after the final hit (see CT in cine.js). 760-1500 the reveal (he grows, the wings open, the tail whips), 1500-2500 the
   gathering (portrait dolly zoom, the world's embers fly into his mouth, the chest lights, a macro on the loser's terror, a whip pan back),
   2500-3300 the blast (flame cone, engulfed in slow motion, the loser pops out like a cork along the real launch direction and leaves
   through the dome), 3300-3900 the aftermath (back to potato size, the smirk, a smoke ring). Real time drives the camera and the cues,
   world time (with the speed ramp) drives particles, flames and the loser's flight. */
(function () {
  const D = {};                                   // objects and state of this film, rebuilt at every warm-up
  const P3 = (x, y, z) => [x + CN_MID, y, z];     // script position: x measured from the middle of the pair (the winner stands at -75)
  const A = (a, o) => ({ a, o });
  const RAMP = [[0, 1], [2690, 1], [2740, 0.25], [2890, 0.25], [2940, 1.6], [3300, 1.6], [3440, 1], [9999, 1]];
  const rest = { F: [0.75, 0.48], B: [-0.72, 0.4] }, open = { F: [1.02, 1.25], B: [-1.02, 1.25] }, roar = { F: [0.98, 0.98], B: [-0.98, 0.98] };

  /* ---- shots ---- */
  function shotPortrait(u, tr, pos, look) {          // dolly zoom: the camera backs away while the lens tightens, the face stays the same size
    const An = CINE.anc.W, V = CINE.v, k = cnSmooth(u);
    look.copy(An.eyes).lerp(An.mouth, 0.42);
    V.a.subVectors(An.face, An.body); V.a.y = 0; V.a.normalize();
    V.a.x -= CINE.dir * 0.12; V.a.normalize();
    pos.copy(look).addScaledVector(V.a, cnMix(175, 250, k)); pos.y += cnMix(3, 9, k);
    return { fov: cnMix(20, 14.1, k), roll: 0.03 * (1 - k) };
  }
  function shotMacro(u, tr, pos, look) {             // the loser's eyes, very close
    const An = CINE.anc.L, V = CINE.v;
    look.copy(An.eyes);
    V.a.subVectors(An.face, An.body); V.a.y = 0; V.a.normalize();
    V.a.x -= CINE.dir * 0.1; V.a.normalize();
    pos.copy(look).addScaledVector(V.a, cnMix(104, 94, cnSmooth(u))); pos.y += 1.5;
    return { fov: cnMix(12, 11, u), roll: -0.035 };
  }
  function shotFollow(u, tr, pos, look) {            // after the pop: the camera lets go of the pair and follows the launch for a moment
    const V = CINE.v, k = cnOut3(cnProg(0, 0.3, u)) * (1 - cnSmooth(cnProg(0.4, 0.85, u)));
    cnPt(P3(-40, 46, 330), pos); cnPt(P3(40, 58, 0), look);
    pos.z += 24 * cnSmooth(u);
    if (D.lp) { V.a.copy(D.lp).sub(look).multiplyScalar(0.8 * k); look.add(V.a); pos.x += V.a.x * 0.5; pos.y += V.a.y * 0.3; }
    return { fov: cnMix(32, 37, cnSmooth(u)), roll: 0 };
  }
  function shotSettle(u, tr, pos, look) {            // the smirk, then the card
    const An = CINE.anc.W, V = CINE.v, k = cnSmooth(cnProg(0, 1, u * 2.2));
    look.copy(An.eyes).lerp(An.mouth, 0.5);
    V.a.subVectors(An.face, An.body); V.a.y = 0; V.a.normalize();
    V.a.x -= CINE.dir * 0.15; V.a.normalize();
    pos.copy(look).addScaledVector(V.a, cnMix(190, 150, k)); pos.y += 5;
    return { fov: cnMix(21, 17, k), roll: 0.02 };
  }
  const SHOTS = [
    { t0: 420, keys: [{ t: 420, pos: P3(-20, 96, 660), look: P3(-30, 50, 0), fov: 30 }, { t: 760, pos: P3(-86, 30, 360), look: P3(-52, 42, 0), fov: 30 }], e: "io3" },
    { t0: 760, keys: [{ t: 760, pos: P3(-86, 30, 360), look: P3(-52, 42, 0), fov: 30 }, { t: 1500, pos: P3(-125, 60, 640), look: P3(-55, 74, 0), fov: 30, roll: 0.025 }], e: "inout" },
    { t0: 1500, t1: 2150, fn: shotPortrait },
    { t0: 2150, t1: 2400, fn: shotMacro },
    { t0: 2400, keys: [
      { t: 2400, pos: A("W.mouth", [-44, 8, 80]), look: A("W.mouth", [30, 2, 0]), fov: 17 },
      { t: 2500, pos: A("W.mouth", [-38, 6, 72]), look: A("W.mouth", [30, 2, 0]), fov: 16.5, e: "lin" },
      { t: 2700, pos: P3(-110, 52, 270), look: P3(8, 56, 0), fov: 28, e: "out3" },
      { t: 2920, pos: P3(-40, 46, 330), look: P3(40, 58, 0), fov: 32, e: "inout" }] },
    { t0: 2920, t1: 3300, fn: shotFollow },
    { t0: 3300, t1: 9999, fn: shotSettle },
  ];
  // the camera for t < 2400 reads anchors, so they must be fresh before it runs (update runs first)

  /* ---- cues: one-shots on the real clock ---- */
  const CUES = [
    { t: 770, fn: () => Cin.go(() => Cin.growl(1.3)) },
    { t: 900, fn: () => Cin.go(() => { Cin.clack(); Cin.whoosh(0.35, -0.6, 0.7, 0.5); Cin.sub(80, 36, 0.35, 0.5); }) },
    { t: 1100, fn: () => Cin.go(() => Cin.whoosh(0.3, 0.8, -0.8, 0.45)) },
    { t: 1500, fn: () => Cin.go(() => { Cin.inhale(0.95); Cin.riser(1.0, 0.18); }) },
    { t: 2150, fn: () => Cin.go(() => { Cin.sub(70, 30, 0.5, 0.6); Cin.stab(110, 0.75); }) },
    { t: 2330, fn: () => Cin.go(() => Cin.sub(66, 30, 0.3, 0.5)) },
    { t: 2390, fn: () => Cin.go(() => { Cin.whoosh(0.2, -0.9, 0.9, 0.6); Cin.drop(0.1); }) },
    { t: 2500, fn: (C, t, tw) => { D.roared = true; Cin.go(() => { Cin.roar(1.2); Cin.rumble(1.0); Cin.boom(0.9); }); } },
    { t: 2920, fn: (C, t, tw) => pop(C, t, tw) },
    { t: 3300, fn: () => Cin.go(() => { Cin.chime(660); Cin._noise(0.7, 0.16, 1700, 500, "bandpass", 1.1); }) },
    { t: 3450, fn: () => Cin.go(() => { Cin.stab(98, 0.9); Cin.shimmer(660, 1.4); }) },
  ];

  /* ---- puppets: the same shape the 2D finisher uses, with the pose channels written by the film ---- */
  const mkq = () => ({ lean: 0, mouth: 0, flap: 0, wingUp: 0, crouch: 0, spin: 0, tail: null, tailLift: 0, arms: false, hfx: 0, hfy: 0, hbx: 0, hby: 0 });
  function mkPuppet(src, q) {
    const p = Object.assign({}, src, { x: 0, y: 0, vx: 0, vy: 0, kbx: 0, kby: 0, grounded: true, plat: 0, state: "fin", st: 0, move: null, mid: null, mt: 0, invuln: 0, hitstun: 0, tumble: false, flash: 0, armorFlash: 0, ledge: 0, finRole: "cine", finPose: null });
    p.finPose = (P, sk) => {
      P.lean = q.lean; P.mouth = q.mouth; P.flap = q.flap; P.wingUp = q.wingUp; P.crouch = q.crouch; P.spin = q.spin; P.tailSwing = q.tail; P.tailLift = q.tailLift;
      return q.arms ? { hF: [sk.w * q.hfx, -sk.leg - sk.tor * q.hfy], hB: [sk.w * q.hbx, -sk.leg - sk.tor * q.hby] } : null;
    };
    return p;
  }
  const armK = (q, a, b, k) => { q.arms = true; q.hfx = cnMix(a.F[0], b.F[0], k); q.hfy = cnMix(a.F[1], b.F[1], k); q.hbx = cnMix(a.B[0], b.B[0], k); q.hby = cnMix(a.B[1], b.B[1], k); };

  function poseW(t, tw, q) {
    const grow = cnOut3(cnProg(820, 1380, t)), fold = cnInOut(cnProg(3300, 3700, t));
    q.lean = 0; q.mouth = 0; q.crouch = 0; q.spin = 0; q.flap = 0;
    q.wingUp = 0.55 * grow * (1 - 0.85 * fold);
    q.flap = 0.35 * Math.sin(cnProg(900, 1100, t) * Math.PI) + (t > 2500 && t < 3300 ? 0.14 * Math.sin(tw * 0.026) : 0);
    // the tail: idle sway, one whip across the floor (wind back, sweep, return), lashing while he roars
    const wu = cnProg(940, 1560, t), idle = 0.12 * Math.sin(tw * 0.0042);
    let a = idle;
    if (wu > 0 && wu < 1) { a = wu < 0.25 ? cnMix(idle, -0.85, cnSmooth(wu / 0.25)) : wu < 0.52 ? cnMix(-0.85, 0.95, cnSmooth((wu - 0.25) / 0.27)) : cnMix(0.95, idle, cnSmooth((wu - 0.52) / 0.48)); }
    q.tail = a; q.tailLift = 0.05 + 0.25 * Math.sin(Math.min(1, wu) * Math.PI) + (t > 2500 && t < 3300 ? 0.3 : 0);
    // body language
    const g = cnProg(1500, 2000, t), r = cnProg(2480, 2560, t);
    if (t < 1500) { armK(q, rest, open, cnSmooth(cnProg(880, 1150, t))); }
    else if (t < 2500) { q.lean = -0.32 * cnOut3(g) + 0.02 * Math.sin(tw * 0.03) * cnProg(1900, 2400, t); q.crouch = -0.04 * g; armK(q, open, { F: [0.86, 0.5], B: [-0.92, 0.62] }, cnSmooth(cnProg(1500, 1800, t))); q.mouth = 0.15 + 0.5 * cnProg(1750, 2450, t); }
    else if (t < 3300) { q.lean = cnMix(-0.32, 0.28, cnOut3(r)); q.mouth = 1; q.crouch = 0.08 * r; armK(q, { F: [0.86, 0.5], B: [-0.92, 0.62] }, roar, cnSmooth(r)); }
    else { const k = cnInOut(cnProg(3300, 3650, t)); q.lean = 0.28 * (1 - k); q.mouth = (1 - cnProg(3300, 3360, t)) * 1.0; q.crouch = 0.08 * (1 - k); armK(q, roar, { F: [0.8, 0.3], B: [-0.8, 0.3] }, cnSmooth(cnProg(3300, 3480, t))); }
  }
  function poseL(t, tw, q) {
    const fear = cnSmooth(cnProg(900, 1500, t));
    q.lean = -0.1 * fear + Math.sin(tw * 0.0068) * 0.035; q.mouth = 0.25 + 0.5 * cnProg(2050, 2300, t); q.crouch = 0.1 * fear + 0.12 * cnProg(2150, 2500, t);
    q.spin = 0; q.tail = null; q.flap = 0; q.wingUp = 0; q.arms = false;
    if (!D.popped) {                                  // cowers with the hands in, then throws them up when the fire comes
      const c = cnSmooth(cnProg(1500, 2100, t)), u = cnSmooth(cnProg(2500, 2660, t));
      q.arms = true; q.hfx = cnMix(cnMix(rest.F[0], 0.66, c), 0.5, u); q.hfy = cnMix(cnMix(rest.F[1], 0.6, c), 1.3, u); q.hbx = cnMix(cnMix(rest.B[0], -0.66, c), -0.5, u); q.hby = cnMix(cnMix(rest.B[1], 0.5, c), 1.3, u);
    }
    if (D.popped) {
      const f = Math.max(0, (tw - D.bo.tw0) / FMS);
      q.spin = f * 0.3; q.lean = -0.5; q.mouth = 1; q.crouch = 0; armK(q, rest, { F: [0.62, 1.2], B: [-0.62, 1.2] }, 1);
    }
  }

  /* ---- helpers ---- */
  function projUV(p, out) { const v = CINE.v.pj.copy(p).project(CINE.camera); out.x = v.x * 0.5 + 0.5; out.y = v.y * 0.5 + 0.5; out.z = v.z; return out; }
  function burst(S, n, x, y, z, speed, t0s, life, size) {
    const r = CINE.rnd;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, e = (r() - 0.5) * 2, s = speed * (0.25 + 0.75 * r()), c = Math.sqrt(1 - e * e);
      cnGPAdd(S, x, y, z, Math.cos(a) * c * s, e * s, Math.sin(a) * c * s, t0s, life * (0.6 + 0.8 * r()), r(), size * (0.6 + 0.8 * r()));
    }
  }
  function resetGP(S) { S.pr.fill(0); for (let i = 0; i < S.max; i++) S.pr[i * 4] = 1e9; S.head = 0; S.dmin = 0; S.dmax = S.max - 1; S.acc = 0; cnGPFlush(S); }
  function seedAsh(S) {
    const r = CINE.rnd, n = S.max;
    for (let i = 0; i < n; i++) cnGPAdd(S, (r() - 0.5) * 1000, -40 + r() * 460, (r() - 0.7) * 700, (r() - 0.5) * 7, 5 + r() * 12, (r() - 0.5) * 7, -r() * 3.2, 6 + r() * 3, r(), 0.6 + r() * 1.3);
  }
  function mkFire(sc, len, r0, r1, rm, c, I, amp) {
    const m = new CINE.T.Mesh(cnFlameGeom(len, r0, r1, rm), cnFireMat(c[0], c[1], c[2], I, amp));
    m.frustumCulled = false; m.renderOrder = 5; m.visible = false; sc.add(m); return m;
  }

  /* ---- the pop: the loser leaves the cone ---- */
  function pop(C, t, tw) {
    const V = C.v, An = C.anc.L;
    D.popped = true;
    D.twPop = tw - (t - 2920) * cnTrack(RAMP, 2920);
    D.bo = C.bo = { tw0: D.twPop + 85, x0: C.dir * 75, y0: 0, z0: 0 };
    D.cdirFix = true;
    burst(D.spark, Math.ceil(220 * C.pk), An.chest.x, An.chest.y, An.chest.z, 560, D.twPop / 1000, 0.9, 2.2);
    burst(D.fire, Math.ceil(120 * C.pk), An.chest.x, An.chest.y, An.chest.z, 220, D.twPop / 1000, 0.8, 5);
    V.a.set(0, 0, 1).applyQuaternion(C.camera.quaternion);
    cnKick(V.a, 6, t);
    D.rib.pts.length = 0; D.rib.lastT = -1e9;
    Cin.go(() => { Cin.impact(1); Cin.whoosh(0.5, -0.5, 0.9, 0.5); });
  }

  FILMS.dragon = {
    exposure: 0.9,
    fog: { color: "#3a120a", density: 0.0009 },
    sky: { top: "#040106", horizon: "#b02e0c", bottom: "#0b0405", hot: "#ff7a22", haze: 1.0 },
    set: { slab: [380, 168], floorY: -86, floor: "#0b0607", grass: "#86b07c", rockGlow: "#3a1208", crystal: "#ff7a2a" },
    stars: 900, starA: 0.5,
    env: { boxes: [{ w: 300, h: 190, p: [-320, 380, 330], col: "#ffe2c4", I: 1.8 }, { w: 260, h: 260, p: [340, 140, -320], col: "#ff3a14", I: 2.2 }, { w: 400, h: 90, p: [0, -50, 420], col: "#ff8a3a", I: 0.7 }, { w: 240, h: 120, p: [0, 300, -380], col: "#ff5a22", I: 0.9 }] },
    lights: { key: "#ffe0c0", keyI: 1.8, rim: "#ff2a0e", rimI: 2.6, sky: "#4a2a2a", ground: "#160a0a", fill: 0.26, practical: "#ff9a3c", blast: "#ff9a4a", keyPos: [-700, 900, 900], rimPos: [800, 420, -900] },
    grade: { lift: [-0.01, -0.012, -0.012], gamma: [1.05, 1.0, 0.94], gain: [1.08, 0.98, 0.86], sat: 1.1, vig: 0.55, grain: 0.022 },
    bloomK: 0.9,
    ramp: RAMP,
    shake: [{ t0: 900, dur: 380, amp: 2.4 }, { t0: 1240, dur: 260, amp: 1.8 }, { t0: 2500, dur: 420, amp: 6, hold: true }, { t0: 2920, dur: 420, amp: 8 }],
    shots: SHOTS,
    cues: CUES,

    build(C) {
      const T = C.T, sc = C.scene, pk = C.pk;
      D.pp = [mkq(), mkq()];
      const n = (k) => Math.ceil(k * pk) + 8;
      D.ash = cnGP(n(520), { add: true, drag: 0.15, size: 3.4, turb: 4, c0: [1.4, 0.55, 0.14], c1: [1.0, 0.3, 0.06], c2: [0.3, 0.06, 0.02], cell: [1, 1], alpha: 0.9, g: [0, 3, 0] });
      D.emb = cnGP(n(640), { add: true, drag: 0.6, size: 5.6, c0: [2.6, 1.9, 0.9], c1: [2.2, 0.8, 0.15], c2: [0.7, 0.12, 0.02], cell: [1, 1] });
      D.fire = cnGP(n(1500), { add: true, drag: 1.1, size: 2.8, grow: -0.1, g: [0, 80, 0], c0: [1.7, 1.2, 0.5], c1: [1.3, 0.45, 0.07], c2: [0.4, 0.06, 0.01], cell: [1, 1] });
      D.spark = cnGP(n(300), { add: true, drag: 1.7, size: 2.2, g: [0, -240, 0], c0: [3.2, 3.0, 2.4], c1: [2.4, 1.0, 0.2], c2: [0.4, 0.04, 0], cell: [1, 1] });
      D.smoke = cnGP(n(280), { add: false, drag: 0.9, size: 22, grow: 2.0, g: [0, 22, 0], c0: "#4a3228", c1: "#241714", c2: "#0e0909", cell: [2, 1], alpha: 0.6, spin: 1.2 });
      D.dust = cnGP(n(150), { add: false, drag: 2.2, size: 11, grow: 1.1, g: [0, 12, 0], c0: "#7a5646", c1: "#44302a", c2: "#1a1210", cell: [2, 1], alpha: 0.55 });
      D.gps = [D.ash, D.emb, D.fire, D.spark, D.smoke, D.dust];
      for (const s of D.gps) sc.add(s.pts);
      // flames: the breath (two nested cones), little fires on the grass, the burning sprout
      D.coneO = mkFire(sc, 330, 14, 58, 24, [[1.3, 0.75, 0.3], [1.1, 0.32, 0.05], [0.45, 0.06, 0.01]], 0.42, 14);
      D.coneI = mkFire(sc, 250, 7, 26, 10, [[1.7, 1.35, 0.7], [1.3, 0.6, 0.15], [0.6, 0.2, 0.03]], 0.5, 7);
      D.slabF = [];
      for (let i = 0; i < 9; i++) { const m = mkFire(sc, 46, 7, 1.5, 3, [[1.0, 0.6, 0.28], [1.0, 0.28, 0.04], [0.4, 0.04, 0.01]], 0.9, 5); m.userData.ph = i * 0.9; D.slabF.push(m); }
      D.sprout = mkFire(sc, 30, 5, 1, 2, [[2, 1.5, 0.8], [1.8, 0.6, 0.08], [0.6, 0.06, 0.01]], 1.5, 3);
      // smoke ring (torus), shock spheres, comet ribbon
      D.ring = new T.Mesh(cnOwn(new T.TorusGeometry(1, 0.15, 14, 44)), cnSmokeMat("#6a5a54", "#ffb070"));
      D.ring.material.uniforms.uAmp.value = 0.1; D.ring.frustumCulled = false; D.ring.visible = false; D.ring.renderOrder = 5; sc.add(D.ring);
      D.sh1 = new T.Mesh(cnOwn(new T.SphereGeometry(1, 28, 18)), cnShockMat()); D.sh2 = new T.Mesh(cnOwn(new T.TorusGeometry(1, 0.03, 8, 72)), cnShockMat());   // a bubble at the roar, a flat ring (facing the lens) at the pop
      for (const m of [D.sh1, D.sh2]) { m.frustumCulled = false; m.visible = false; m.renderOrder = 6; sc.add(m); }
      D.rib = cnRibbon(30); sc.add(D.rib.mesh);
      D.Y = new T.Vector3(0, 1, 0); D.Z = new T.Vector3(0, 0, 1);
      D.grass0 = cnLin(FILMS.dragon.set.grass); D.ringLit = cnLin("#ff9a50");
      D.cdir = new T.Vector3(1, 0, 0); D.lp = new T.Vector3(); D.rp = new T.Vector3(); D.uv0 = new T.Vector3(); D.uv1 = new T.Vector3();
      D.fl = { x: 0, y: 0, a: 0 };
    },
    // before the warm-up render: everything on, so every program compiles; after it: everything off again
    warm(C, pre) {
      const all = [D.coneO, D.coneI, D.sprout, D.ring, D.sh1, D.sh2, D.rib.mesh, ...D.slabF];
      if (pre) {
        for (const m of all) m.visible = true;
        for (let i = 0; i < 8; i++) cnGlow(i, 0, 60, 0, 30, 1, 0.5, 0.2);
        C.pu.uTime.value = 0.01;
        for (const s of D.gps) cnGPAdd(s, 0, 60, 0, 0, 0, 0, 0, 5, 0.5, 6);
        for (const s of D.gps) cnGPFlush(s);
      } else {
        for (const m of all) m.visible = false;
        for (let i = 0; i < 8; i++) cnGlow(i, 0, 0, 0, 0, 0, 0, 0);
        for (const s of D.gps) resetGP(s);
      }
    },
    start(C) {
      const T = C.T, g = null;
      C.rnd = cnRng(20261013);
      D.W = C.rigs[C.wSlot]; D.Lr = C.rigs[C.lSlot];
      D.pW = mkPuppet(FIN.P[C.wSlot], D.pp[C.wSlot]); D.pL = mkPuppet(FIN.P[C.lSlot], D.pp[C.lSlot]);
      for (const r of [D.W, D.Lr]) { r.root.visible = true; r.root.scale.setScalar(1); cnChar(r, 0); cnExpr(r, "rest", 0); r.eyeK = 1; r.xl = ""; r.expr = ""; if (r.hero.sprout) { r.hero.sprout.visible = true; r.hero.sprout.scale.setScalar(1); } }
      D.W.hero.belly.emissive.setRGB(1, 0.3, 0.04); D.W.hero.belly.emissiveIntensity = 0;
      D.dimK = -1; D.armHid = false; D.tintL = ""; cnLimbVis(D.W.armF, true); D.ci = 0; D.popped = false; D.exited = false; D.bo = null; D.roared = false; D.twPop = 0; D.kc = -1; D.exT = 0; D.ringT = 0; D.ringOn = false; D.cdirFix = false;
      D.fl.a = 0; D.lp.set(0, 0, 0);
      for (const s of D.gps) resetGP(s);
      seedAsh(D.ash); cnGPFlush(D.ash);
      D.ash.mat.uniforms.uAtt.value.w = 0; D.ash.mat.uniforms.uPull.value = 0; D.ash.mat.uniforms.uAlpha.value = 0.75;
      D.emb.mat.uniforms.uAlpha.value = 1; D.emb.mat.uniforms.uPull.value = 0; D.emb.mat.uniforms.uAtt.value.w = 0;
      D.rib.pts.length = 0; D.rib.lastT = -1e9; D.rib.mesh.visible = false; D.rib.mat.uniforms.uA.value = 0;
      for (const m of [D.coneO, D.coneI, D.sprout, D.ring, D.sh1, D.sh2, ...D.slabF]) m.visible = false;
      const rnd = C.rnd;
      D.slabF.forEach((m, i) => { m.position.set(C.dir * (-40 + (i / 8) * 215 + (rnd() - 0.5) * 14), 0, (rnd() - 0.4) * 70); m.scale.setScalar(0.9 + rnd() * 0.7); m.userData.ts = 2560 + i * 38 + rnd() * 30; m.userData.te = 3120 + i * 30 + rnd() * 90; });
      const S = C.set;
      S.grassMat.color.copy(D.grass0); S.grassMat.emissiveIntensity = 0;
      S.domeMat.uniforms.uHotA.value = 0; S.domeMat.uniforms.uPulse.value = 0;
      C.lights.prac.intensity = 0; C.lights.blast.intensity = 0;
      C.expo = 1; C.bloomMul = 1;
      const wp = C.rigs[C.wSlot].root, lp = C.rigs[C.lSlot].root; wp.position.set(0, 0, 0); lp.position.set(0, 0, 0);
      // anchors and the first pose, so the first camera frame is right
      this.update(C, CT.SHATTER, C.tw, 0, 0);
    },

    update(C, t, tw, dtw, dtr) {
      const V = C.v, dir = C.dir, Lt = C.lights, S = C.set, tw0m = tw - dtw, pk = C.pk;
      const W = D.W, Lr = D.Lr, AW = C.anc.W, AL = C.anc.L, camP = C.camera.position;
      while (D.ci < CUES.length && t >= CUES[D.ci].t) { CUES[D.ci].fn(C, t, tw); D.ci++; }
      /* ---- the fighters ---- */
      const tk = tw / FMS;
      poseW(t, tw, D.pp[C.wSlot]); poseL(t, tw, D.pp[C.lSlot]);
      const grow = cnSmooth(cnProg(820, 1420, t)), fold = cnInOut(cnProg(3300, 3700, t));
      const sW = 1 + 0.6 * grow - 0.6 * fold, span = 1 + 1.0 * grow - 1.0 * fold;
      syncRig(W, D.pW, pose(D.pW, tk), tk, [-75 * dir, 0]);
      W.root.scale.setScalar(sW);
      for (const wg of W.wings) wg.g.scale.multiplyScalar(span);
      // the loser: stands, trembles in the fire, then flies along the real launch line
      D.pL.flash = D.popped && tw < D.bo.tw0 ? 2 : 0;
      let lx = 75 * dir, ly = 0, lz = 0;
      if (D.popped && tw >= D.bo.tw0) { cnBlastPos(C, tw, V.o); lx = V.o.x; ly = V.o.y; lz = V.o.z; }
      else if (t > 2520 && t < 2930) lx += Math.sin(tw * 0.11) * 1.3 * dir;
      syncRig(Lr, D.pL, pose(D.pL, tk), tk, [lx, -ly]);
      Lr.root.position.z = lz;
      cnAnchors(W, AW); cnAnchors(Lr, AL);
      cnBlobStep(W); cnBlobStep(Lr);
      D.lp.copy(AL.body);
      /* ---- faces ---- */
      const exW = t >= 2500 && t < 3300 ? "rage" : "fierce";      // after the roar the fierce face with its fang is the smirk
      cnExpr(W, exW, exW === "fierce" ? Math.max(cnProg(1500, 1800, t), cnProg(3300, 3400, t)) : 1);
      cnExpr(Lr, t >= 2050 ? "terror" : "rest", cnSmooth(cnProg(2050, 2250, t)));
      if (t >= 1500 && t < 2150) cnLookAt(W, camP, 0.9); else if (t >= 3300) cnLookAt(W, camP, 1); else cnLookAt(W, AL.eyes, 0.7);
      cnLookAt(Lr, t > 2150 && t < 2500 ? AW.mouth : camP, 0.8);
      const kc = cnSmooth(cnProg(2700, 2930, t));
      if (D.tintL !== Lr.tint) { D.tintL = Lr.tint; D.kc = -1; }     // a tint change (the white flash) restores the colours: put the char back
      if (Math.abs(kc - D.kc) > 0.002) { D.kc = kc; cnChar(Lr, Math.pow(kc, 0.8)); }
      if (Lr.hero.sprout) { const sk = 1 - cnProg(2760, 2880, t); Lr.hero.sprout.scale.setScalar(Math.max(0.001, sk)); }
      /* ---- light on the potatoes and in the world ---- */
      const chestK = cnSmooth(cnProg(1500, 2400, t)), roarK = t < 2500 ? 0 : t < 3300 ? 1 : 1 - cnSmooth(cnProg(3300, 3900, t));
      const glowK = chestK * (1 - 0.55 * cnSmooth(cnProg(3300, 3900, t)));
      W.hero.belly.emissiveIntensity = 2.6 * glowK;
      W.hero.bone.emissiveIntensity = 0.5 + 2.4 * cnSmooth(cnProg(900, 1400, t)) * (1 - 0.6 * fold);
      W.hero.u.rim.value.setRGB(1.3, 0.4, 0.08).multiplyScalar(0.15 + 0.5 * Math.max(glowK, cnProg(820, 1420, t)));
      Lr.hero.u.rim.value.setRGB(1.3, 0.38, 0.07).multiplyScalar(0.12 + 0.88 * Math.max(cnProg(1900, 2400, t) * 0.8, roarK * (D.popped ? 0.6 : 1)));
      const dim = Math.min(1, 1 - 0.5 * cnProg(1500, 2150, t) - 0.42 * cnSmooth(cnProg(2100, 2300, t)) + 0.9 * cnSmooth(cnProg(2480, 2600, t)));
      Lt.key.intensity = 1.8 * dim; Lt.hemi.intensity = 0.26 * (0.2 + 0.8 * dim);
      if (Math.abs(dim - D.dimK) > 0.01) { D.dimK = dim; cnEnvK(W, 0.3 + 0.7 * dim); cnEnvK(Lr, 0.3 + 0.7 * dim); }
      const hideArm = (t >= 1500 && t < 2150) || t >= 3300;
      if (hideArm !== D.armHid) { D.armHid = hideArm; cnLimbVis(W.armF, !hideArm); }
      V.a.subVectors(AW.chest, AW.body).normalize();
      Lt.prac.position.copy(AW.chest).addScaledVector(V.a, 10 * sW).y -= 3;
      Lt.prac.intensity = 5 * glowK * (1 - 0.5 * cnProg(3300, 3600, t)) * (0.94 + 0.06 * Math.sin(tw * 0.05));
      // the blast light: from the mouth towards the loser as the fire builds, along the cone while he roars, then with the comet
      if (t >= 1800 && t < 2500) { Lt.blast.position.copy(AW.mouth).lerp(AL.face, 0.55); Lt.blast.position.y += 4; Lt.blast.intensity = 2.6 * cnSmooth(cnProg(1900, 2420, t)); }
      else if (t >= 2500 && t < 3320) { Lt.blast.position.copy(AW.mouth).addScaledVector(D.cdir, D.popped ? 150 : 110); Lt.blast.intensity = (D.popped ? 3.2 : 4) * (1 - 0.4 * cnProg(2920, 3300, t)) * (0.9 + 0.1 * Math.sin(tw * 0.07)); }
      else Lt.blast.intensity = Math.max(0, Lt.blast.intensity - dtr * 0.01);
      /* ---- the world ---- */
      S.domeMat.uniforms.uTime.value = tw / 1000; S.starMat.uniforms.uTime.value = tw / 1000; S.starMat.uniforms.uPx.value = C.pr * 1.2;
      S.domeMat.uniforms.uPulse.value = 0.05 + 0.55 * (t < 2500 ? 0.4 * chestK : roarK);
      S.grassMat.emissiveIntensity = 0.9 * cnSmooth(cnProg(2600, 3000, t)) * (1 - cnProg(3200, 3800, t));
      S.grassMat.color.copy(D.grass0).multiplyScalar(1 - 0.55 * cnSmooth(cnProg(2700, 3300, t)));
      /* ---- particles ---- */
      const au = D.ash.mat.uniforms, eu = D.emb.mat.uniforms;
      if (t < 2500) {
        const pull = cnProg(1500, 2440, t);
        au.uAtt.value.set(AW.mouth.x, AW.mouth.y, AW.mouth.z, pull > 0 ? 1 : 0); au.uPull.value = pull * pull * (3 - 2 * pull) * 1.02;
        eu.uAtt.value.copy(au.uAtt.value); eu.uPull.value = au.uPull.value;
        if (t >= 1500 && t < 1950) cnEmit(D.emb, 1300 * pk, tw0m, tw, (tb) => {
          const r = C.rnd, a = r() * 6.283, e = (r() - 0.5) * 2, rad = 80 + r() * 300, c = Math.sqrt(1 - e * e);
          cnGPAdd(D.emb, AW.mouth.x + Math.cos(a) * c * rad, AW.mouth.y + e * rad * 0.6, AW.mouth.z + Math.sin(a) * c * rad, 0, 6 + r() * 10, 0, tb, 1.9 + r() * 0.5, r(), 0.7 + r() * 0.9);
        });
      } else {
        const f = 1 - cnProg(2500, 2560, t);       // the pulled embers are spent when the roar starts
        au.uAlpha.value = 0.75 * f + (t > 3000 ? 0.75 * cnProg(3000, 3600, t) : 0); eu.uAlpha.value = f;
        if (t > 2570) { au.uAtt.value.w = 0; au.uPull.value = 0; eu.uAtt.value.w = 0; eu.uPull.value = 0; }
      }
      // ash kicked up by the tail whip
      if (t > 1000 && t < 1300) {
        W.tail.updateWorldMatrix(true, false);
        V.a.set(-1.75 * W.B.rx, -(W.B.yC + W.B.leg) + 9 + 0.55 * W.B.ry, 0.2 * W.B.rz); W.tail.localToWorld(V.a);
        cnEmit(D.dust, 220 * pk, tw0m, tw, (tb) => { const r = C.rnd; cnGPAdd(D.dust, V.a.x + (r() - 0.5) * 12, 2 + r() * 4, V.a.z + (r() - 0.5) * 12, (r() - 0.5) * 30, 14 + r() * 24, (r() - 0.5) * 30, tb, 1.1 + r() * 0.9, r(), 0.7 + r() * 0.8); });
      }
      /* ---- the flame cone ---- */
      if (!D.cdirFix) { V.b.subVectors(AL.chest, AW.mouth); V.b.y += 2; D.cdir.copy(V.b).normalize(); }
      const showCone = t >= 2400 && t < 3440;
      D.coneO.visible = D.coneI.visible = showCone;
      let cut = 0;
      if (showCone) {
        cut = t < 2500 ? 0.06 + 0.08 * cnProg(2400, 2500, t) : cnMix(0.14, 1, cnOut3(cnProg(2500, 2700, t)));
        cut *= 1 - cnSmooth(cnProg(3260, 3420, t));
        const fl = 0.5 + 0.5 * Math.sin(tw * 0.05);
        for (const [m, k] of [[D.coneO, 1], [D.coneI, 0.8]]) {
          m.position.copy(AW.mouth).addScaledVector(D.cdir, 3); m.quaternion.setFromUnitVectors(D.Y, D.cdir);
          const u = m.material.uniforms; u.uCut.value = cut * k + (k < 1 ? 0.08 * cut : 0); u.uFlick.value = fl;
          m.scale.set(1 + 0.05 * fl, 1, 1 + 0.05 * fl);
        }
        if (t >= 2500 && t < 3270) cnEmit(D.fire, 1300 * pk * C.cfg.flame, tw0m, tw, (tb) => {
          const r = C.rnd, sp = 260 + r() * 260, a = r() * 6.283, rd = r() * 9;
          V.c.set(Math.cos(a), Math.sin(a), 0).multiplyScalar(rd);
          cnGPAdd(D.fire, AW.mouth.x + D.cdir.x * 6 + V.c.x, AW.mouth.y + D.cdir.y * 6 + V.c.y, AW.mouth.z + D.cdir.z * 6 + V.c.z,
            D.cdir.x * sp + (r() - 0.5) * 70, D.cdir.y * sp + (r() - 0.5) * 70 + 20, D.cdir.z * sp + (r() - 0.5) * 70, tb, 0.7 + r() * 0.6, r(), 0.8 + r() * 1.2);
        });
      }
      // the grass burns along the slab
      for (const m of D.slabF) {
        const ud = m.userData, c = cnOut3(cnProg(ud.ts, ud.ts + 320, t)) * (1 - cnSmooth(cnProg(ud.te, ud.te + 260, t)));
        m.visible = c > 0.01; if (!m.visible) continue;
        m.material.uniforms.uCut.value = c; m.material.uniforms.uFlick.value = 0.5 + 0.5 * Math.sin(tw * 0.05 + ud.ph);
        m.scale.y = 0.8 + 0.5 * Math.sin(tw * 0.02 + ud.ph) * 0.3 + 0.9;
      }
      // the sprout burns off
      D.sprout.visible = !!Lr.hero.sprout && t > 2700 && t < 2960;
      if (D.sprout.visible) { Lr.hero.sprout.parent.localToWorld(V.a.copy(Lr.hero.sprout.position)); D.sprout.position.copy(V.a); D.sprout.material.uniforms.uCut.value = cnSmooth(cnProg(2700, 2800, t)) * (1 - cnProg(2860, 2960, t)); D.sprout.material.uniforms.uFlick.value = 0.5 + 0.5 * Math.sin(tw * 0.09); }
      /* ---- the comet ---- */
      if (D.popped && !D.exited && tw >= D.bo.tw0) {
        cnRibbonStep(D.rib, AL.body, tw, 9 + 3 * Math.sin(tw * 0.03), camP);
        D.rib.mat.uniforms.uA.value = 1;
        cnEmit(D.fire, 520 * pk, tw0m, tw, (tb) => { const r = C.rnd; cnGPAdd(D.fire, AL.body.x + (r() - 0.5) * 8, AL.body.y + (r() - 0.5) * 8, AL.body.z, (r() - 0.5) * 50 - FIN.ldx * 60, (r() - 0.5) * 50 + FIN.ldy * 60, (r() - 0.5) * 40, tb, 0.5 + r() * 0.5, r(), 1 + r()); });
        cnEmit(D.smoke, 90 * pk, tw0m, tw, (tb) => { const r = C.rnd; cnGPAdd(D.smoke, AL.body.x, AL.body.y, AL.body.z, (r() - 0.5) * 20, (r() - 0.3) * 20, (r() - 0.5) * 20, tb, 1.8 + r() * 1.0, r(), 0.9 + r() * 0.8); });
        cnGlow(2, AL.body.x, AL.body.y, AL.body.z, 70, 1.6, 0.8, 0.28);
      } else if (D.exited) {
        D.rib.mat.uniforms.uA.value = Math.max(0, 1 - (t - D.exT) / 380);
        cnGlow(2, 0, 0, 0, 0, 0, 0, 0);
        if (D.rib.mat.uniforms.uA.value <= 0) D.rib.mesh.visible = false;
      }
      /* ---- glow sprites ---- */
      const orb = cnProg(1750, 2480, t), fcl = 0.9 + 0.1 * Math.sin(tw * 0.06);
      if (t >= 1750 && t < 2700) { V.a.copy(AW.mouth).addScaledVector(D.cdir, 3); cnGlow(0, V.a.x, V.a.y, V.a.z, (6 + 26 * orb * orb) * fcl * (t < 2500 ? 1 : 1 + 1.6 * (1 - cnProg(2500, 2700, t))), 1.3, 0.65, 0.2); } else cnGlow(0, 0, 0, 0, 0, 0, 0, 0);
      if (D.popped) { const k = cnProg(2920, 3260, t); cnGlow(3, AL.chest.x, AL.chest.y, AL.chest.z, 300 * (1 - k) * (1 - k), 1.8, 1.2, 0.55); if (t > 2985 && D.exited) cnGlow(3, 0, 0, 0, 0, 0, 0, 0); } else cnGlow(3, 0, 0, 0, 0, 0, 0, 0);
      cnGlow(1, AW.chest.x, AW.chest.y, AW.chest.z, glowK > 0.02 ? 30 + 45 * glowK : 0, 0.9 * glowK, 0.32 * glowK, 0.06 * glowK);
      /* ---- the smoke ring ---- */
      if (!D.ringOn && t >= 3390) { D.ringOn = true; D.ringT = t; }
      D.ring.visible = D.ringOn && t < 4200;
      if (D.ring.visible) {
        const u = (t - D.ringT) / 760, k = cnClamp01(u);
        V.a.subVectors(camP, AW.mouth).normalize();
        D.ring.position.copy(AW.mouth).addScaledVector(V.a, 14 + 150 * k * (0.6 + 0.4 * k)).y += 2;
        D.ring.quaternion.setFromUnitVectors(D.Z, V.a);
        D.ring.scale.setScalar(5 + 20 * cnOut3(k));
        D.ring.material.uniforms.uA.value = 0.95 * cnSmooth(cnProg(0, 0.12, k)) * (1 - cnProg(0.55, 1, k));
        D.ring.material.uniforms.uLit.value.copy(D.ringLit).multiplyScalar(0.8 + 1.4 * glowK);
      }
      /* ---- shock spheres ---- */
      D.sh1.visible = t >= 2500 && t < 2900;
      if (D.sh1.visible) { const k = cnProg(2500, 2900, t); D.sh1.position.copy(AW.mouth); D.sh1.scale.setScalar(20 + 200 * cnOut3(k)); D.sh1.material.uniforms.uA.value = 0.3 * (1 - k) * (1 - k); }
      D.sh2.visible = D.popped && t < 3200;
      if (D.sh2.visible) { const k = cnProg(2920, 3200, t); D.sh2.position.set(dir * 75, 40, 0); D.sh2.quaternion.copy(C.camera.quaternion); D.sh2.scale.setScalar(16 + 300 * cnOut3(k)); D.sh2.material.uniforms.uA.value = 1.2 * (1 - k) * (1 - k); }
      for (const s of D.gps) cnGPFlush(s);
    },

    // projection-dependent post uniforms (after the camera): heat haze, shock rings, rays, whip blur, flash, flare, the dome's hot circle
    post(C, t, tw) {
      const u = C.gu, V = C.v, AW = C.anc.W, AL = C.anc.L, dir = C.dir, S = C.set, cam = C.camera;
      const m = projUV(AW.mouth, D.uv0);
      // CA: always a breath of it, spikes at the roar and the pop
      u.uCA.value = 0.0035 + 0.011 * (1 - cnProg(2500, 2640, t)) * (t >= 2500 ? 1 : 0) + 0.024 * (1 - cnProg(2920, 3060, t)) * (t >= 2920 ? 1 : 0);
      // heat haze over the cone's screen area
      const heat = t < 1500 ? 0.35 * cnProg(900, 1400, t) : t < 2500 ? 0.35 + 0.15 * cnProg(1900, 2480, t) : t < 3300 ? 1 : 1 - cnProg(3300, 3700, t);
      if (heat > 0.01) {
        const burning = t >= 2400 && t < 3440;
        const a = burning ? m : projUV(AW.feet, D.uv0), e = burning ? projUV(V.d.copy(AW.mouth).addScaledVector(D.cdir, 260), D.uv1) : projUV(V.d.copy(AW.head).setY(AW.head.y + 90), D.uv1);
        u.uHeatA.value = heat; u.uHeatSeg.value.set(a.x, a.y, e.x, e.y); u.uHeatW.value = burning ? 0.16 : 0.12;
      }
      // shock ring from the mouth at the roar, from the loser at the pop
      if (t >= 2500 && t < 3000) { const k = cnProg(2500, 3000, t); u.uShockC.value.set(m.x, m.y); u.uShock.value.set(0.7 * cnOut3(k), 0.05, 0.02 * (1 - k)); }
      if (t >= 2920 && t < 3500) { const l = projUV(AL.chest, D.uv0), k = cnProg(2920, 3500, t); u.uShockC.value.set(l.x, l.y); u.uShock.value.set(0.9 * cnOut3(k), 0.05, 0.03 * (1 - k)); }
      // radial rays from the mouth at the pop
      if (t >= 2920 && t < 3090) { u.uRayC.value.set(m.x, m.y, 1.6 * (1 - cnProg(2920, 3090, t))); }
      // whip pan: horizontal smear across the cut
      const wb = Math.max(0, 1 - Math.abs(t - 2400) / 60); u.uBlur.value.set(0.12 * wb * dir, 0);
      // white frame at the pop, a lift when the flames wash over the lens
      const fw = t >= 2920 ? 0.8 * (1 - cnProg(2920, 3020, t)) + 0.12 * Math.max(0, 1 - Math.abs(t - 3090) / 60) : 0;
      if (fw > 0.002) u.uFlash.value.set(fw, fw * 0.93, fw * 0.8);
      const f2 = t >= 2500 && t < 2560 ? 0.3 * (1 - cnProg(2500, 2560, t)) : 0; if (f2 > 0) u.uFlash.value.addScalar(f2 * 0.6);
      // lens flare (drawn on the overlay): the mouth's fire as the camera looks into it, strongest at the pop
      D.fl.x = m.x * L.gw; D.fl.y = (1 - m.y) * L.gh;
      D.fl.a = (t >= 2500 && t < 3300 ? 0.25 + 0.75 * Math.max(0, 1 - Math.abs(t - 2960) / 260) : t >= 1900 && t < 2500 ? 0.12 * cnProg(1900, 2400, t) : 0) * (m.z < 1 && m.x > -0.3 && m.x < 1.3 ? 1 : 0);
      C.flare = D.fl;
      // exit: the loser's projection leaves the frame, a hot circle opens in the dome where it passed
      if (D.popped && !D.exited && t > 2990) {
        const p = projUV(AL.body, D.uv0);
        if (p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1 || t > 3700) {
          D.exited = true; D.exT = t;
          const nx = Math.max(-0.96, Math.min(0.96, p.x * 2 - 1)), ny = Math.max(-0.9, Math.min(0.9, p.y * 2 - 1));
          V.a.set(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
          const b = cam.position.dot(V.a), c = cam.position.lengthSq() - 2600 * 2600, s = -b + Math.sqrt(Math.max(0, b * b - c));
          V.b.copy(cam.position).addScaledVector(V.a, s).normalize();
          S.domeMat.uniforms.uHot.value.set(V.b.x, V.b.y, V.b.z, 0.3);
          if (D.Lr) D.Lr.root.visible = false;
          burst(D.spark, Math.ceil(90 * C.pk), AL.body.x, AL.body.y, AL.body.z, 380, tw / 1000, 0.8, 2);
        }
      }
      if (D.exited) {
        const k = (t - D.exT) / 1000;
        S.domeMat.uniforms.uHotA.value = 1.25 * cnSmooth(cnProg(0, 0.16, k)) * (1 - cnSmooth(cnProg(0.5, 1.6, k)));
        S.domeMat.uniforms.uHot.value.w = 0.1 + 0.3 * cnOut3(cnProg(0, 0.5, k));
      }
    },
  };
})();
